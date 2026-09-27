import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw, Sparkles, Star } from 'lucide-react';
import { useStore } from './lib/useStore.js';
import { detectLang, makeT, QUOTES, safeLocale } from './lib/i18n.js';
import { addDays, dayNumber, keyToLocalDate } from './domain/dates.js';
import {
  addCustom, ALL_DONE_BONUS, levelFromXp, markSeen, newlyUnlocked, removeItem, setLang, setProfile, setRoutines, stats, toggleItem, WARDROBE, XP_PER_TASK,
} from './domain/model.js';
import { flyXp, floatText, prefersReducedMotion, sparkleBurst } from './lib/fx.js';
import Hero from './components/Hero.jsx';
import { phaseFor } from './components/Scene.jsx';
import { CompanionArt } from './components/Companion.jsx';
import TaskList from './components/TaskList.jsx';
import { DoneCard, GardenPanel, QuoteCard, SettingsSheet, Toasts, WeekCard } from './components/Panels.jsx';

const EMPTY_DAY = { items: [], done: [] };

function greetingKey(h) {
  if (h < 5) return 'greet.night';
  if (h < 12) return 'greet.morning';
  if (h < 18) return 'greet.afternoon';
  return h < 22 ? 'greet.evening' : 'greet.night';
}

const center = (el) => {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
};

/** Hour of day + dark-mode preference, refreshed every minute. */
function useAmbient() {
  const mq = useMemo(() => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null), []);
  const [hour, setHour] = useState(() => new Date().getHours());
  const [dark, setDark] = useState(() => !!mq?.matches);
  useEffect(() => {
    const id = setInterval(() => setHour(new Date().getHours()), 60000);
    const onMq = (e) => setDark(e.matches);
    mq?.addEventListener?.('change', onMq);
    return () => {
      clearInterval(id);
      mq?.removeEventListener?.('change', onMq);
    };
  }, [mq]);
  return { hour, dark };
}

export default function App() {
  const { state, today, commit } = useStore();
  const lang = state.lang || detectLang();
  const t = useMemo(() => makeT(lang), [lang]);
  const locale = useMemo(() => safeLocale(lang), [lang]);
  const st = useMemo(() => stats(state, today), [state, today]);
  const day = state.days[today] || EMPTY_DAY;
  const { hour, dark } = useAmbient();
  const buddyName = t(`buddy.${state.buddy}`);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr';
    document.title = t('app.name');
  }, [lang, t]);

  // ---------------------------------------------------------------- toasts
  const [toasts, setToasts] = useState([]);
  const toast = useCallback((x, ms = 3200) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((l) => [...l.slice(-2), { ...x, id }]);
    if (ms) setTimeout(() => setToasts((l) => l.filter((y) => y.id !== id)), ms);
  }, []);
  const dismiss = (id) => setToasts((l) => l.filter((y) => y.id !== id));

  // ---------------------------------------------------------------- XP wave into the arc
  const [heldXp, setHeldXp] = useState(null);
  const flights = useRef(0);
  const tipRef = useRef(null);
  const [ping, setPing] = useState(0);
  const [cheer, setCheer] = useState(0);
  const [celebrate, setCelebrate] = useState(0);
  const shownLevel = levelFromXp(heldXp ?? st.xp);

  const toggle = useCallback(
    (id, el) => {
      let prevXp = 0;
      let wasDone = false;
      commit((s, k) => {
        const d = s.days[k];
        wasDone = !!d && d.done.includes(id);
        prevXp = stats(s, k).xp;
        return toggleItem(s, k, id);
      });
      if (wasDone) return;
      setCheer((c) => c + 1);
      if (prefersReducedMotion()) return;
      const from = center(el?.querySelector('.check-dot') || el);
      const to = center(tipRef.current);
      if (from) floatText(from, `+${XP_PER_TASK} XP`);
      if (!from || !to) return;
      flights.current += 1;
      setHeldXp((h) => h ?? prevXp);
      flyXp(from, to).then(() => {
        flights.current -= 1;
        if (flights.current === 0) setHeldXp(null);
        setPing((p) => p + 1);
      });
    },
    [commit],
  );
  const add = useCallback((title) => commit((s, k) => addCustom(s, k, title)), [commit]);
  const remove = useCallback((id) => commit((s, k) => removeItem(s, k, id)), [commit]);

  // ---------------------------------------------------------------- level-ups & wardrobe
  const prevLevel = useRef(shownLevel.level);
  useEffect(() => {
    const lv = shownLevel.level;
    if (lv > prevLevel.current) {
      const piece = WARDROBE.find((w) => w.level === lv);
      toast({
        icon: <Star size={17} className="text-amber" fill="currentColor" />,
        text: piece ? `${t('levelup', { n: lv })} ${t(`wear.${piece.id}`, { name: buddyName })}` : t('levelup', { n: lv }),
      });
    }
    prevLevel.current = lv;
  }, [shownLevel.level, t, toast, buddyName]);
  const wear = WARDROBE.filter((w) => shownLevel.level >= w.level).map((w) => w.id);

  // ---------------------------------------------------------------- keepsakes & new friends (toast once)
  useEffect(() => {
    const ids = newlyUnlocked(state, st);
    if (!ids.length) return;
    commit((s) => markSeen(s, ids));
    ids.forEach((id, i) =>
      setTimeout(() => {
        if (id.startsWith('buddy-')) {
          const sp = id.slice(6);
          toast({ icon: <CompanionArt species={sp} size={26} mood="happy" />, text: t('buddy.found', { name: t(`buddy.${sp}`) }) }, 4200);
        } else toast({ icon: <Sparkles size={17} className="text-amber" />, text: t('ach.unlocked', { name: t(`ach.${id}`) }) });
      }, 1000 + i * 800),
    );
  }, [state, st, commit, t, toast]);

  // ---------------------------------------------------------------- daily completion moment
  const doneRef = useRef(null);
  const wasAllDone = useRef(st.allDone);
  useEffect(() => {
    if (st.allDone && !wasAllDone.current) {
      wasAllDone.current = true;
      const id = setTimeout(() => {
        sparkleBurst(doneRef.current);
        setCelebrate((c) => c + 1);
      }, 850);
      return () => clearTimeout(id);
    }
    wasAllDone.current = st.allDone;
  }, [st.allDone]);

  // ---------------------------------------------------------------- service worker updates
  useEffect(() => {
    const onNeed = (e) =>
      toast({ icon: <RefreshCw size={16} />, text: t('update.ready'), action: { label: t('update.reload'), run: () => e.detail.update() } }, 0);
    window.addEventListener('sw-need-refresh', onNeed);
    return () => window.removeEventListener('sw-need-refresh', onNeed);
  }, [t, toast]);

  // ---------------------------------------------------------------- copy
  const n = dayNumber(today);
  const quotes = QUOTES[lang] || QUOTES.en;
  const quote = quotes[((n % quotes.length) + quotes.length) % quotes.length];
  const praise = t(`done.praise.${((n % 4) + 4) % 4}`);
  const yesterdayFrozen = !!state.days[addDays(today, -1)]?.frozen;
  const todayActive = st.todayDone > 0;
  let chainText;
  if (yesterdayFrozen && !todayActive) chainText = t('chain.frozen');
  else if (todayActive) chainText = st.current <= 1 ? t('chain.first') : t('chain.going', { n: st.current });
  else if (st.current > 0) chainText = t('chain.waiting', { n: st.current });
  else chainText = t('chain.fresh');

  const dateLabel = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' }).format(keyToLocalDate(today));
  const greet = t(greetingKey(hour));
  const header = state.name ? { hello: `${greet},`, title: state.name, sub: dateLabel } : { hello: dateLabel, title: greet, sub: t('hello.tagline') };

  const sayings = useMemo(
    () => ({
      tap: [0, 1, 2, 3, 4].map((i) => t(`say.tap.${i}`)),
      cheer: [0, 1, 2, 3].map((i) => t(`say.cheer.${i}`)),
      allDone: t('say.allDone'),
      breathe: t('say.breathe'),
    }),
    [t],
  );

  const [sheet, setSheet] = useState(false);
  const [gardenOpen, setGardenOpen] = useState(false);
  const weekRef = useRef(null);
  const gardenRef = useRef(null);
  const scrollTo = (el) => el?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' });
  const remaining = st.todayTotal - st.todayDone;

  return (
    <div className="mx-auto w-full max-w-md">
      <Toasts toasts={toasts} onDismiss={dismiss} />

      <Hero
        ref={tipRef}
        t={t}
        phase={phaseFor(hour, dark)}
        {...header}
        level={shownLevel}
        chain={st.current}
        frozen={yesterdayFrozen && !todayActive}
        stage={st.stage}
        stageLabel={t(`stage.${st.stage.id}`)}
        species={state.buddy}
        wear={wear}
        cheer={cheer}
        celebrate={celebrate}
        sayings={sayings}
        greet={st.allDone ? t('say.allDone') : st.todayDone ? t('say.back') : t('say.tap.3')}
        ping={ping}
        onSettings={() => setSheet(true)}
        onChain={() => scrollTo(weekRef.current)}
        onGrowth={() => {
          setGardenOpen(true);
          setTimeout(() => scrollTo(gardenRef.current), 50);
        }}
      />

      <main className="safe-bottom relative z-10 -mt-7 space-y-4 px-4">
        <WeekCard ref={weekRef} t={t} state={state} today={today} locale={locale} chainText={chainText} freezeAvailable={st.freezeAvailable} />

        <section aria-labelledby="today-h">
          <div className="mx-1 mb-2 mt-5 flex items-baseline gap-2">
            <h2 id="today-h" className="text-[21px] font-extrabold tracking-[-0.02em]">
              {t('today.title')}
            </h2>
            <span className="text-[15px] font-semibold tabular-nums text-muted" data-testid="progress" dir="ltr">
              {st.todayDone} / {st.todayTotal}
            </span>
            <button type="button" onClick={() => setSheet(true)} className="-me-2 ms-auto min-h-11 min-w-11 px-2 text-sm font-semibold text-primary-deep">
              {t('edit.edit')}
            </button>
          </div>
          <div className="mx-1 mb-3.5">
            <div className="h-1.5 overflow-hidden rounded-full bg-line" aria-hidden="true">
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{
                  width: `${st.todayTotal ? (st.todayDone / st.todayTotal) * 100 : 0}%`,
                  background: st.allDone ? 'linear-gradient(90deg,#4ADE80,#10B981)' : 'linear-gradient(90deg,#8B93FF,#6366F1)',
                }}
              />
            </div>
            <p className="mt-2 text-[13px] text-ink2">
              {st.allDone ? (
                <b className="font-bold text-green-deep">{t('today.allDone')}</b>
              ) : st.todayTotal ? (
                <>
                  <b className="font-bold text-ink">{t('today.remaining', { n: remaining })}</b> · <span dir="ltr">{t('today.bonusHint', { xp: ALL_DONE_BONUS })}</span>
                </>
              ) : null}
            </p>
          </div>
          <TaskList
            t={t}
            day={day}
            onToggle={toggle}
            onRemove={remove}
            onAdd={add}
            doneCard={<DoneCard ref={doneRef} t={t} praise={praise} bonus={ALL_DONE_BONUS} streak={st.current} species={state.buddy} />}
          />
        </section>

        <QuoteCard t={t} text={quote} />
        <GardenPanel ref={gardenRef} t={t} st={st} open={gardenOpen} setOpen={setGardenOpen} />
        <p className="pb-2 text-center text-[11px] text-muted/70">{t('app.name')}</p>
      </main>

      {sheet && (
        <SettingsSheet
          t={t}
          state={state}
          st={st}
          onSave={(list) => commit((s, k) => setRoutines(s, k, list))}
          onLang={(v) => commit((s) => setLang(s, v))}
          onProfile={(p) => commit((s) => setProfile(s, p))}
          onClose={() => setSheet(false)}
        />
      )}
    </div>
  );
}
