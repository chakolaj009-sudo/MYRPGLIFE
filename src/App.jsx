import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useStore } from './lib/useStore.js';
import { detectLang, itemTitle, makeT, QUOTES, safeLocale } from './lib/i18n.js';
import { dayNumber, keyToLocalDate } from './domain/dates.js';
import {
  addCustom, ALL_DONE_BONUS, awardReaction, discoveries, levelFromXp, markGrown, markSeen, newlyUnlocked, pastAnswer, pendingReflection, recordReflection, removeItem,
  setLang, setMinimum, setProfile, setRoutines, stats, toggleItem, WARDROBE, weekStory, worldGrowth, xpPerTask,
} from './domain/model.js';
import { flyXp, floatText, prefersReducedMotion, sparkleBurst, haptic } from './lib/fx.js';
import { phaseFor } from './lib/ambient.js';
import { CompanionArt } from './components/Companion.jsx';
import { iconKey } from './components/Art.jsx';
import WorldView from './components/WorldView.jsx';
import Hud from './components/Hud.jsx';
import CardHand from './components/CardHand.jsx';
import { DoneCard, GardenPanel, SettingsSheet, Toasts, WeekCard } from './components/Panels.jsx';
import { AddSheet, PlayedSheet, Sheet } from './components/Sheets.jsx';
import Reflection from './components/Reflection.jsx';
import SpeechBubble from './components/SpeechBubble.jsx';

const EMPTY_DAY = { items: [], done: [] };
const LEAVE_MS = 420; // card exit (180ms) + slot collapse (240ms, overlapping)

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

  // ---------------------------------------------------------------- toasts (rare) & companion speech
  const [toasts, setToasts] = useState([]);
  const toast = useCallback((x, ms = 3600) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((l) => [...l.slice(-1), { ...x, id }]);
    if (ms) setTimeout(() => setToasts((l) => l.filter((y) => y.id !== id)), ms);
  }, []);
  const dismiss = (id) => setToasts((l) => l.filter((y) => y.id !== id));

  const world = useRef(null);
  const hudRef = useRef(null);
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
  const xpEach = xpPerTask(day);

  const play = useCallback(
    (id, cardEl) => {
      let prevXp = 0;
      let already = false;
      let gain = 0;
      commit((s, k) => {
        const d = s.days[k];
        already = !!d && d.done.includes(id);
        if (already) return s;
        prevXp = stats(s, k).xp;
        gain = xpPerTask(d);
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
        // A rare, meaningful moment? (at most one a week)
        let ks = null;
        commit((s, k) => {
          const r = awardReaction(s, k);
          ks = r.keepsake;
          return r.state;
        });
        if (ks) {
          setTimeout(() => {
            world.current?.reaction(ks.type, ks.habit);
            say(t(`keep.line.${ks.type}`, { habit: keepHabit(ks) }), 4200);
          }, reduce ? 300 : 1300);
        }
        if (reduce) return;
        const from = (hasWorld && world.current.screenPoint(id)) || fromCard;
        floatText(from, `+${gain} XP`);
        say(t(`say.cheer.${Math.floor(Math.random() * 4)}`), 1500);
        flyXp(from, center(ringRef.current), { count: 9 }).then(() => {
          flights.current -= 1;
          if (flights.current === 0) setHeldXp(null);
          setPing((p) => p + 1);
        });
      });
    },
    [commit, say, t],
  );
  const keepHabit = (k) => (k.title || k.key ? itemTitle(t, { title: k.title, key: k.key }) : '');
  const undo = useCallback((id) => commit((s, k) => (s.days[k]?.done.includes(id) ? toggleItem(s, k, id) : s)), [commit]);
  const add = useCallback((title, icon, mini) => commit((s, k) => addCustom(s, k, title, undefined, icon, mini)), [commit]);
  const remove = useCallback((id) => commit((s, k) => removeItem(s, k, id)), [commit]);
  const toggleMinimum = useCallback(() => {
    haptic(8);
    commit((s, k) => setMinimum(s, k, !s.days[k]?.minimum));
  }, [commit]);

  // World objects mirror today's missions; a mission stays "to do" in the
  // world until the companion has walked over and done it. Each habit's
  // growth shows what the user has already discovered until the reveal.
  const growth = useMemo(() => worldGrowth(state, today), [state, today]);
  const [revealed, setRevealed] = useState(false);
  const missions = useMemo(
    () =>
      day.items.map((i) => {
        const g = growth[i.id] || { visible: 0, pending: false };
        return {
          id: i.id,
          kind: worldKind(i),
          done: day.done.includes(i.id) && !walking[i.id],
          tier: revealed ? g.visible : Math.min(g.visible, state.grown[i.id] || 0),
          pending: g.pending,
        };
      }),
    [day, walking, growth, revealed, state.grown],
  );

  // ---------------------------------------------------------------- level-ups: the companion finds outfit pieces
  const prevLevel = useRef(shownLevel.level);
  useEffect(() => {
    const lv = shownLevel.level;
    if (lv > prevLevel.current) {
      const piece = WARDROBE.find((w) => w.level === lv);
      if (piece) setTimeout(() => say(t('wear.found', { name: buddyName, item: t(`wear.${piece.id}`) }), 3000), 700);
    }
    prevLevel.current = lv;
  }, [shownLevel.level, t, say, buddyName]);
  const wearKey = WARDROBE.filter((w) => shownLevel.level >= w.level)
    .map((w) => w.id)
    .join(',');
  const wear = useMemo(() => (wearKey ? wearKey.split(',') : []), [wearKey]);

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

  // ---------------------------------------------------------------- opening: hello → what grew → thought of the day
  // After a gap: one gentle line, nothing about what was missed.
  const n = dayNumber(today);
  const quotes = QUOTES[lang] || QUOTES.en;
  const quote = quotes[((n % quotes.length) + quotes.length) % quotes.length];
  const latest = useRef({});
  latest.current = { state, today, st };

  // Once a week the companion tells the story of the week that just ended.
  // It comes first; the usual opening lines follow when it closes.
  const [reflectWeek, setReflectWeek] = useState(() => pendingReflection(state, today));
  const [openingFor, setOpeningFor] = useState(null);
  useEffect(() => {
    const w = pendingReflection(latest.current.state, today);
    setReflectWeek(w);
    if (!w) setOpeningFor(today);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today]);
  const story = useMemo(() => (reflectWeek ? weekStory(state, reflectWeek) : null), [reflectWeek]); // eslint-disable-line react-hooks/exhaustive-deps
  const closeReflection = (answer) => {
    const w = reflectWeek;
    commit((s, k) => recordReflection(s, w, answer, k));
    setReflectWeek(null);
    setOpeningFor(today);
  };

  // ---------------------------------------------------------------- a new friend (rare)
  useEffect(() => {
    if (reflectWeek) return; // wait until the weekly story is closed
    const ids = newlyUnlocked(state, st);
    if (!ids.length) return;
    commit((s) => markSeen(s, ids));
    ids.forEach((id, i) =>
      setTimeout(() => {
        const sp = id.slice(6);
        toast({ icon: <CompanionArt species={sp} size={26} mood="happy" />, text: t('buddy.found', { name: t(`buddy.${sp}`) }) }, 4200);
      }, 1600 + i * 900),
    );
  }, [state, st, commit, t, toast, reflectWeek]);

  useEffect(() => {
    if (openingFor !== today) return;
    setRevealed(false);
    const timers = [];
    const at = (ms, fn) => timers.push(setTimeout(fn, ms));
    const { st: s0 } = latest.current;
    const first = s0.comeback && !s0.todayDone ? t('say.comeback') : s0.allDone ? t('say.allDone') : s0.todayDone ? t('say.back') : t('say.tap.3');
    at(900, () => say(first, s0.comeback ? 3600 : 2000));
    at(s0.comeback ? 4600 : 3100, () => {
      const { state: s, today: k } = latest.current;
      const found = discoveries(s, k).filter((id) => s.days[k]?.items.some((i) => i.id === id));
      setRevealed(true);
      if (found.length) {
        const item = s.days[k].items.find((i) => i.id === found[0]);
        world.current?.focus(found[0]);
        say(found.length > 1 ? t('grow.foundMany') : t('grow.found', { habit: itemTitle(t, item) }), 3400);
        commit((x, kk) => markGrown(x, kk));
        at(3800, () => !s0.comeback && say(closing(), 5200));
      } else {
        commit((x, kk) => markGrown(x, kk));
        if (!s0.comeback) say(closing(), 5200);
      }
    });
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openingFor, today]);
  // Now and then a past reflection answer is gently quoted back instead of the thought of the day.
  const closing = () => {
    const past = pastAnswer(latest.current.state, latest.current.today);
    return past ? t('recall', { n: past.weeksAgo, answer: past.answer }) : t('bubble.quote', { q: quote });
  };

  // ---------------------------------------------------------------- service worker updates
  useEffect(() => {
    const onNeed = (e) =>
      toast({ icon: <RefreshCw size={16} />, text: t('update.ready'), action: { label: t('update.reload'), run: () => e.detail.update() } }, 0);
    window.addEventListener('sw-need-refresh', onNeed);
    return () => window.removeEventListener('sw-need-refresh', onNeed);
  }, [t, toast]);

  // ---------------------------------------------------------------- layout
  const praise = t(`done.praise.${((n % 4) + 4) % 4}`);
  const dateLabel = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' }).format(keyToLocalDate(today));
  const greet = t(greetingKey(hour));
  const shortDate = (k) => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(keyToLocalDate(k));
  const moments = state.keepsakes.map((k) => ({ id: k.id, type: k.type, date: shortDate(k.date), label: t(`keep.label.${k.type}`, { habit: keepHabit(k) }) }));
  const header = state.name ? { hello: `${greet},`, title: state.name } : { hello: dateLabel, title: greet };

  const [sheet, setSheet] = useState(null); // 'settings' | 'week' | 'garden' | 'played' | 'add'
  // A sheet unmounts after its exit animation; only clear it if no other sheet was opened meanwhile.
  const closeFor = useMemo(() => {
    const m = {};
    for (const k of ['week', 'garden', 'played', 'add', 'settings']) m[k] = () => setSheet((cur) => (cur === k ? null : cur));
    return m;
  }, []);
  const handItems = day.items.filter((i) => !day.done.includes(i.id) || leaving[i.id]);
  const doneItems = day.items.filter((i) => day.done.includes(i.id) && !leaving[i.id]);
  const handAllDone = st.allDone && !Object.keys(leaving).length;

  return (
    <div className={`game ${phase === 'night' ? 'night' : ''} ${st.minimum ? 'soft' : ''}`}>
      <WorldView
        ref={world}
        phase={phase}
        stage={st.stage.id}
        species={state.buddy}
        wear={wear}
        missions={missions}
        minimum={st.minimum}
        label={t('world.label')}
        loadingLabel={t('world.loading')}
        onTapMission={(id) => play(id, null)}
        onTapCompanion={() => say(t(`say.tap.${Math.floor(Math.random() * 5)}`), 1500)}
        keepsakes={state.keepsakes}
        onTapKeepsake={(id) => {
          const k = state.keepsakes.find((x) => x.id === id);
          if (k) say(`${shortDate(k.date)} · ${t(`keep.label.${k.type}`, { habit: keepHabit(k) })}`, 3200);
        }}
      />
      <div className="soft-veil" aria-hidden="true" />

      <Hud
        ref={ringRef}
        boxRef={hudRef}
        t={t}
        {...header}
        level={shownLevel}
        ping={ping}
        month={st.month}
        stage={st.stage.id}
        stageLabel={t(`stage.${st.stage.id}`)}
        onSettings={() => setSheet('settings')}
        onMonth={() => setSheet('week')}
        onGrowth={() => setSheet('garden')}
      />

      {bubble && <SpeechBubble key={bubble.id} x={bubble.x} y={bubble.y} text={bubble.text} hudRef={hudRef} />}

      <CardHand
        t={t}
        items={handItems}
        doneItems={doneItems}
        leaving={leaving}
        allDone={handAllDone}
        bonus={ALL_DONE_BONUS}
        xp={xpEach}
        minimum={st.minimum}
        onMinimum={toggleMinimum}
        onPlay={play}
        onRemove={remove}
        onAdd={() => setSheet('add')}
        onShowDone={() => setSheet('played')}
        doneCard={<DoneCard ref={doneRef} t={t} praise={praise} bonus={ALL_DONE_BONUS} month={st.month} species={state.buddy} />}
      />

      <aside className="rail-extra" aria-label={t('week.title')}>
        <p className="t-label mb-3">{t('week.title')}</p>
        <WeekCard t={t} state={state} today={today} locale={locale} st={st} id="rail-week-h" />
      </aside>

      <Toasts toasts={toasts} onDismiss={dismiss} />

      {story && <Reflection t={t} story={story} locale={locale} species={state.buddy} onDone={closeReflection} />}

      {sheet === 'week' && (
        <Sheet title={t('week.title')} onClose={closeFor.week} t={t}>
          <div className="section">
            <WeekCard t={t} state={state} today={today} locale={locale} st={st} />
          </div>
          <figure className="section m-0 mb-2">
            <figcaption className="t-label mb-2">{t('quote.title')}</figcaption>
            <blockquote className="quote t-body text-ink2">{quote}</blockquote>
          </figure>
        </Sheet>
      )}
      {sheet === 'garden' && (
        <Sheet title={t('stats.title')} onClose={closeFor.garden} t={t}>
          <GardenPanel t={t} st={st} moments={moments} />
        </Sheet>
      )}
      {sheet === 'played' && <PlayedSheet t={t} items={doneItems} minimum={st.minimum} onUndo={undo} onClose={closeFor.played} />}
      {sheet === 'add' && <AddSheet t={t} onAdd={add} onClose={closeFor.add} />}
      {sheet === 'settings' && (
        <SettingsSheet
          t={t}
          state={state}
          st={st}
          onSave={(list) => commit((s, k) => setRoutines(s, k, list))}
          onLang={(v) => commit((s) => setLang(s, v))}
          onProfile={(p) => commit((s) => setProfile(s, p))}
          onClose={closeFor.settings}
        />
      )}
    </div>
  );
}
