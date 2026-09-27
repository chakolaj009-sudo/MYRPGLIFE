import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link2, RefreshCw, SlidersHorizontal, Snowflake, Sparkles, Star } from 'lucide-react';
import { useStore } from './lib/useStore.js';
import { detectLang, makeT, QUOTES, safeLocale } from './lib/i18n.js';
import { addDays, dayNumber, keyToLocalDate } from './domain/dates.js';
import {
  addCustom, ALL_DONE_BONUS, levelFromXp, markSeen, newlyUnlocked, removeItem, setLang, setRoutines, stats, toggleItem, WARDROBE,
} from './domain/model.js';
import { flyXp, prefersReducedMotion, sparkleBurst } from './lib/fx.js';
import Buddy from './components/Buddy.jsx';
import Plant from './components/Plant.jsx';
import TaskList from './components/TaskList.jsx';
import { ChainBanner, DoneCard, QuoteCard, RoutineSheet, StatsPanel, Toasts, WeekView, XpMeter } from './components/Panels.jsx';

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

export default function App() {
  const { state, today, commit } = useStore();
  const lang = state.lang || detectLang();
  const t = useMemo(() => makeT(lang), [lang]);
  const locale = useMemo(() => safeLocale(lang), [lang]);
  const st = useMemo(() => stats(state, today), [state, today]);
  const day = state.days[today] || EMPTY_DAY;

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

  // ---------------------------------------------------------------- XP wave
  // While orbs are flying, the meter keeps showing the old XP and fills when they land.
  const [heldXp, setHeldXp] = useState(null);
  const flights = useRef(0);
  const fillRef = useRef(null);
  const [glow, setGlow] = useState(0);
  const [cheer, setCheer] = useState(0);
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
      const fill = fillRef.current;
      let to = null;
      if (fill) {
        const r = fill.getBoundingClientRect();
        to = { x: document.documentElement.dir === 'rtl' ? r.left + 4 : r.right - 4, y: r.top + r.height / 2 };
      }
      const from = center(el?.querySelector('.check-dot') || el);
      if (!from || !to) return;
      flights.current += 1;
      setHeldXp((h) => h ?? prevXp);
      flyXp(from, to).then(() => {
        flights.current -= 1;
        if (flights.current === 0) setHeldXp(null);
        setGlow((g) => g + 1);
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
      toast({ icon: <Star size={16} className="text-sun" />, text: piece ? `${t('levelup', { n: lv })} ${t(`wear.${piece.id}`)}` : t('levelup', { n: lv }) });
    }
    prevLevel.current = lv;
  }, [shownLevel.level, t, toast]);
  const wear = WARDROBE.filter((w) => shownLevel.level >= w.level).map((w) => w.id);

  // ---------------------------------------------------------------- achievements (toast once)
  useEffect(() => {
    const ids = newlyUnlocked(state, st);
    if (!ids.length) return;
    commit((s) => markSeen(s, ids));
    ids.forEach((id, i) =>
      setTimeout(() => toast({ icon: <Sparkles size={16} className="text-sun" />, text: t('ach.unlocked', { name: t(`ach.${id}`) }) }), 900 + i * 700),
    );
  }, [state, st, commit, t, toast]);

  // ---------------------------------------------------------------- daily completion moment
  const doneRef = useRef(null);
  const wasAllDone = useRef(st.allDone);
  useEffect(() => {
    if (st.allDone && !wasAllDone.current) {
      const id = setTimeout(() => {
        sparkleBurst(doneRef.current);
        setCheer((c) => c + 1);
      }, 800);
      wasAllDone.current = st.allDone;
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
  let chain;
  if (yesterdayFrozen && !todayActive) chain = { text: t('chain.frozen'), frozen: true };
  else if (todayActive) chain = { text: st.current <= 1 ? t('chain.first') : t('chain.going', { n: st.current }) };
  else if (st.current > 0) chain = { text: t('chain.waiting', { n: st.current }) };
  else chain = { text: t('chain.fresh') };

  const dateLabel = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' }).format(keyToLocalDate(today));
  const stage = st.stage;
  const [sheet, setSheet] = useState(false);
  const sayings = useMemo(() => [0, 1, 2, 3, 4].map((i) => t(`buddy.say.${i}`)), [t]);

  return (
    <div className="safe-top safe-bottom mx-auto w-full max-w-md px-4">
      <Toasts toasts={toasts} onDismiss={dismiss} />

      <header className="flex items-start gap-3 pb-3 pt-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted">{dateLabel}</p>
          <h1 className="text-2xl font-semibold tracking-tight">{t(greetingKey(new Date().getHours()))}</h1>
        </div>
        <div
          className="flex h-11 items-center gap-1.5 rounded-full bg-card px-3 text-sm shadow-sm"
          aria-label={`${t('streak.current')} ${st.current}, ${t('streak.best')} ${st.bestStreak}`}
        >
          {yesterdayFrozen && !todayActive ? <Snowflake size={16} className="text-sky" /> : <Link2 size={16} className="text-leaf" />}
          <span className="font-semibold tabular-nums">{st.current}</span>
          <span className="text-xs text-muted">
            · {t('streak.best')} {st.bestStreak}
          </span>
        </div>
      </header>

      <main className="space-y-4">
        <ChainBanner {...chain} />

        <section className="card px-4 pb-4 pt-3" aria-label={t(`stage.${stage.id}`)}>
          <div className="flex items-end justify-center gap-4">
            <div className="w-[150px]">
              <Buddy label={t('buddy.label')} sayings={sayings} wear={wear} cheer={cheer} />
            </div>
            <div className="flex flex-col items-center pb-1">
              <Plant stage={stage.id} label={t(`stage.${stage.id}`)} />
              <span className="mt-0.5 text-xs font-semibold">{t(`stage.${stage.id}`)}</span>
              <span className="text-[11px] text-muted">
                {stage.next ? t('stage.next', { n: stage.next.min - st.totalTasks, stage: t(`stage.${stage.next.id}`) }) : t('stage.max')}
              </span>
            </div>
          </div>
          <div className="mt-3">
            <XpMeter ref={fillRef} t={t} level={shownLevel} glow={glow} />
          </div>
        </section>

        <QuoteCard text={quote} />

        <div>
          <div className="mb-2 flex items-center gap-2 px-1">
            <h2 id="today-h" className="text-lg font-semibold">
              {t('today.title')}
            </h2>
            <span className="text-sm tabular-nums text-muted">{t('today.progress', { done: st.todayDone, total: st.todayTotal })}</span>
            <div className="mx-1 h-1.5 flex-1 overflow-hidden rounded-full bg-line/80" aria-hidden="true">
              <div
                className="h-full rounded-full bg-leaf transition-[width] duration-500"
                style={{ width: `${st.todayTotal ? (st.todayDone / st.todayTotal) * 100 : 0}%` }}
              />
            </div>
            <button
              type="button"
              onClick={() => setSheet(true)}
              aria-label={t('edit.open')}
              className="-me-2 grid h-11 w-11 place-items-center rounded-full text-muted active:bg-line/60"
            >
              <SlidersHorizontal size={18} />
            </button>
          </div>
          <TaskList
            t={t}
            day={day}
            onToggle={toggle}
            onRemove={remove}
            onAdd={add}
            doneCard={<DoneCard ref={doneRef} t={t} praise={praise} bonus={ALL_DONE_BONUS} streak={st.current} />}
          />
        </div>

        <WeekView t={t} state={state} today={today} locale={locale} />
        <StatsPanel t={t} st={st} />
        <p className="pb-2 text-center text-[11px] text-muted/70">{t('app.name')}</p>
      </main>

      {sheet && (
        <RoutineSheet
          t={t}
          routines={state.routines}
          lang={state.lang}
          onSave={(list) => commit((s, k) => setRoutines(s, k, list))}
          onLang={(v) => commit((s) => setLang(s, v))}
          onClose={() => setSheet(false)}
        />
      )}
    </div>
  );
}
