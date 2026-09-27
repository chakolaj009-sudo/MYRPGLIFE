import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw, Sparkles, Star } from 'lucide-react';
import { useStore } from './lib/useStore.js';
import { detectLang, makeT, QUOTES, safeLocale } from './lib/i18n.js';
import { addDays, dayNumber, keyToLocalDate } from './domain/dates.js';
import {
  addCustom, ALL_DONE_BONUS, levelFromXp, markSeen, newlyUnlocked, removeItem, setLang, setProfile, setRoutines, stats, toggleItem, WARDROBE, XP_PER_TASK,
} from './domain/model.js';
import { flyXp, floatText, prefersReducedMotion, sparkleBurst, haptic } from './lib/fx.js';
import { phaseFor } from './components/Scene.jsx';
import { CompanionArt } from './components/Companion.jsx';
import { iconKey } from './components/Art.jsx';
import WorldView from './components/WorldView.jsx';
import Hud from './components/Hud.jsx';
import CardHand from './components/CardHand.jsx';
import { DoneCard, GardenPanel, SettingsSheet, Toasts, WeekCard } from './components/Panels.jsx';
import { AddSheet, PlayedSheet, Sheet } from './components/Sheets.jsx';

const EMPTY_DAY = { items: [], done: [] };
const LEAVE_MS = 650;

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
const worldKind = (item) => iconKey(item.icon || (item.kind === 'custom' ? 'star' : 'sprout'));

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
  const phase = phaseFor(hour, dark);
  const buddyName = t(`buddy.${state.buddy}`);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr';
    document.title = t('app.name');
  }, [lang, t]);

  // ---------------------------------------------------------------- toasts & speech bubble
  const [toasts, setToasts] = useState([]);
  const toast = useCallback((x, ms = 3200) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((l) => [...l.slice(-2), { ...x, id }]);
    if (ms) setTimeout(() => setToasts((l) => l.filter((y) => y.id !== id)), ms);
  }, []);
  const dismiss = (id) => setToasts((l) => l.filter((y) => y.id !== id));

  const world = useRef(null);
  const [bubble, setBubble] = useState(null);
  const bubbleTimer = useRef(0);
  const say = useCallback((text, ms = 2600) => {
    const p = world.current?.screenPoint('companion');
    clearTimeout(bubbleTimer.current);
    setBubble({ text, x: p?.x ?? window.innerWidth / 2, y: p?.y ?? window.innerHeight * 0.4, id: Math.random() });
    bubbleTimer.current = setTimeout(() => setBubble(null), ms);
  }, []);

  // ---------------------------------------------------------------- playing a card
  const [heldXp, setHeldXp] = useState(null);
  const flights = useRef(0);
  const ringRef = useRef(null);
  const [ping, setPing] = useState(0);
  const [leaving, setLeaving] = useState({});
  const [walking, setWalking] = useState({});
  const shownLevel = levelFromXp(heldXp ?? st.xp);

  const play = useCallback(
    (id, cardEl) => {
      let prevXp = 0;
      let already = false;
      commit((s, k) => {
        const d = s.days[k];
        already = !!d && d.done.includes(id);
        if (already) return s;
        prevXp = stats(s, k).xp;
        return toggleItem(s, k, id);
      });
      if (already) {
        world.current?.focus(id);
        say(t('say.already'), 1600);
        return;
      }
      haptic(12);
      setLeaving((l) => ({ ...l, [id]: true }));
      setTimeout(() => setLeaving(({ [id]: _, ...rest }) => rest), LEAVE_MS);
      const reduce = prefersReducedMotion();
      if (!reduce) {
        flights.current += 1;
        setHeldXp((h) => h ?? prevXp);
        setWalking((w) => ({ ...w, [id]: true }));
      }
      const hasWorld = world.current?.hasWorld();
      const fromCard = center(cardEl);
      (hasWorld ? world.current.play(id) : Promise.resolve()).then(() => {
        setWalking(({ [id]: _, ...rest }) => rest);
        if (reduce) return;
        const from = (hasWorld && world.current.screenPoint(id)) || fromCard;
        const to = center(ringRef.current);
        floatText(from, `+${XP_PER_TASK} XP`);
        say(t(`say.cheer.${Math.floor(Math.random() * 4)}`), 1500);
        flyXp(from, to, { count: 9 }).then(() => {
          flights.current -= 1;
          if (flights.current === 0) setHeldXp(null);
          setPing((p) => p + 1);
        });
      });
    },
    [commit, say, t],
  );
  const undo = useCallback((id) => commit((s, k) => (s.days[k]?.done.includes(id) ? toggleItem(s, k, id) : s)), [commit]);
  const add = useCallback((title, icon) => commit((s, k) => addCustom(s, k, title, undefined, icon)), [commit]);
  const remove = useCallback((id) => commit((s, k) => removeItem(s, k, id)), [commit]);

  // World objects mirror today's missions; a mission stays "to do" in the
  // world until the companion has walked over and done it.
  const missions = useMemo(
    () => day.items.map((i) => ({ id: i.id, kind: worldKind(i), done: day.done.includes(i.id) && !walking[i.id] })),
    [day, walking],
  );

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
  const wearKey = WARDROBE.filter((w) => shownLevel.level >= w.level)
    .map((w) => w.id)
    .join(',');
  const wear = useMemo(() => (wearKey ? wearKey.split(',') : []), [wearKey]);

  // ---------------------------------------------------------------- keepsakes & new friends
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
      }, 1600 + i * 800),
    );
  }, [state, st, commit, t, toast]);

  // ---------------------------------------------------------------- daily completion
  const doneRef = useRef(null);
  const wasAllDone = useRef(st.allDone);
  const walkingNow = Object.keys(walking).length > 0;
  useEffect(() => {
    if (st.allDone && !wasAllDone.current && !walkingNow) {
      wasAllDone.current = true;
      const id = setTimeout(() => {
        world.current?.celebrate();
        say(t('say.allDone'), 3200);
        sparkleBurst(doneRef.current);
      }, 500);
      return () => clearTimeout(id);
    }
    if (!st.allDone) wasAllDone.current = false;
  }, [st.allDone, walkingNow, say, t]);

  // ---------------------------------------------------------------- hello + thought of the day
  const n = dayNumber(today);
  const quotes = QUOTES[lang] || QUOTES.en;
  const quote = quotes[((n % quotes.length) + quotes.length) % quotes.length];
  useEffect(() => {
    const a = setTimeout(() => say(st.allDone ? t('say.allDone') : st.todayDone ? t('say.back') : t('say.tap.3'), 2200), 900);
    const b = setTimeout(() => say(t('bubble.quote', { q: quote }), 5200), 3400);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today]);

  // ---------------------------------------------------------------- service worker updates
  useEffect(() => {
    const onNeed = (e) =>
      toast({ icon: <RefreshCw size={16} />, text: t('update.ready'), action: { label: t('update.reload'), run: () => e.detail.update() } }, 0);
    window.addEventListener('sw-need-refresh', onNeed);
    return () => window.removeEventListener('sw-need-refresh', onNeed);
  }, [t, toast]);

  // ---------------------------------------------------------------- copy
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
  const header = state.name ? { hello: `${greet},`, title: state.name } : { hello: dateLabel, title: greet };

  const [sheet, setSheet] = useState(null); // 'settings' | 'week' | 'garden' | 'played' | 'add'
  const close = useCallback(() => setSheet(null), []);
  const handItems = day.items.filter((i) => !day.done.includes(i.id) || leaving[i.id]);
  const doneItems = day.items.filter((i) => day.done.includes(i.id) && !leaving[i.id]);
  const handAllDone = st.allDone && !Object.keys(leaving).length;

  return (
    <div className={`game ${phase === 'night' ? 'night' : ''}`}>
      <WorldView
        ref={world}
        phase={phase}
        stage={st.stage.id}
        species={state.buddy}
        wear={wear}
        missions={missions}
        label={t('world.label')}
        onTapMission={(id) => play(id, null)}
        onTapCompanion={() => say(t(`say.tap.${Math.floor(Math.random() * 5)}`), 1500)}
      />

      <Hud
        ref={ringRef}
        t={t}
        {...header}
        level={shownLevel}
        ping={ping}
        chain={st.current}
        frozen={yesterdayFrozen && !todayActive}
        stage={st.stage.id}
        stageLabel={t(`stage.${st.stage.id}`)}
        onSettings={() => setSheet('settings')}
        onChain={() => setSheet('week')}
        onGrowth={() => setSheet('garden')}
      />

      {bubble && (
        <div key={bubble.id} className="world-bubble" style={{ left: bubble.x, top: bubble.y }} role="status">
          {bubble.text}
        </div>
      )}

      <CardHand
        t={t}
        items={handItems}
        doneItems={doneItems}
        leaving={leaving}
        allDone={handAllDone}
        bonus={ALL_DONE_BONUS}
        onPlay={play}
        onRemove={remove}
        onAdd={() => setSheet('add')}
        onShowDone={() => setSheet('played')}
        doneCard={<DoneCard ref={doneRef} t={t} praise={praise} bonus={ALL_DONE_BONUS} streak={st.current} species={state.buddy} />}
      />

      <Toasts toasts={toasts} onDismiss={dismiss} />

      {sheet === 'week' && (
        <Sheet title={t('week.title')} onClose={close} t={t}>
          <div className="mb-4">
            <WeekCard t={t} state={state} today={today} locale={locale} chainText={chainText} freezeAvailable={st.freezeAvailable} />
          </div>
          <figure className="card m-0 mb-4 px-4 py-3.5">
            <figcaption className="eyebrow mb-1">{t('quote.title')}</figcaption>
            <blockquote className="m-0 text-[15px] leading-relaxed text-ink2">{quote}</blockquote>
          </figure>
        </Sheet>
      )}
      {sheet === 'garden' && (
        <Sheet title={t('stats.title')} onClose={close} t={t}>
          <div className="mb-4">
            <GardenPanel t={t} st={st} open setOpen={() => {}} />
          </div>
        </Sheet>
      )}
      {sheet === 'played' && <PlayedSheet t={t} items={doneItems} onUndo={undo} onClose={close} />}
      {sheet === 'add' && <AddSheet t={t} onAdd={add} onClose={close} />}
      {sheet === 'settings' && (
        <SettingsSheet
          t={t}
          state={state}
          st={st}
          onSave={(list) => commit((s, k) => setRoutines(s, k, list))}
          onLang={(v) => commit((s) => setLang(s, v))}
          onProfile={(p) => commit((s) => setProfile(s, p))}
          onClose={close}
        />
      )}
    </div>
  );
}
