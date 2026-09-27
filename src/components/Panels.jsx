import { forwardRef, useEffect, useRef, useState } from 'react';
import {
  Check, ChevronDown, Flower2, Leaf, Link2, Mountain, Plus, Quote, Snowflake, Sprout, Star, Sunrise, TreeDeciduous, Trash2, X,
} from 'lucide-react';
import { weekDays, keyToLocalDate } from '../domain/dates.js';
import { doneCount, isAllDone, MAX_TITLE } from '../domain/model.js';
import { itemTitle } from '../lib/i18n.js';

// ---------------------------------------------------------------- XP meter
export const XpMeter = forwardRef(function XpMeter({ t, level, glow }, fillRef) {
  const target = Math.round((level.into / level.need) * 100);
  const [pct, setPct] = useState(target);
  const [instant, setInstant] = useState(false);
  const prevLevel = useRef(level.level);
  const track = useRef(null);

  // Level up: fill to the brim first, then start the new level from the left.
  useEffect(() => {
    if (level.level > prevLevel.current) {
      setInstant(false);
      setPct(100);
      const a = setTimeout(() => {
        setInstant(true);
        setPct(0);
        requestAnimationFrame(() => requestAnimationFrame(() => {
          setInstant(false);
          setPct(target);
        }));
      }, 520);
      prevLevel.current = level.level;
      return () => clearTimeout(a);
    }
    prevLevel.current = level.level;
    setPct(target);
  }, [level.level, target]);

  useEffect(() => {
    const el = track.current;
    if (!glow || !el) return;
    el.classList.remove('bar-glow');
    void el.offsetWidth;
    el.classList.add('bar-glow');
  }, [glow]);

  return (
    <div className="flex items-center gap-2.5">
      <span className="shrink-0 rounded-full bg-sun-soft px-2.5 py-1 text-xs font-semibold text-sun-deep">{t('level', { n: level.level })}</span>
      <div
        ref={track}
        className="relative h-3.5 flex-1 overflow-hidden rounded-full bg-line/70"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={level.need}
        aria-valuenow={level.into}
        aria-label={t('xp', { a: level.into, b: level.need })}
      >
        <div
          ref={fillRef}
          className={`h-full rounded-full ${instant ? '' : 'transition-[width] duration-500 ease-out'}`}
          style={{ width: `${Math.max(pct, 3)}%`, background: 'linear-gradient(90deg, var(--sun), var(--sun-deep))' }}
        />
      </div>
      <span dir="ltr" className="shrink-0 text-xs tabular-nums text-muted">{t('xp', { a: level.into, b: level.need })}</span>
    </div>
  );
});

// ---------------------------------------------------------------- Quote
export function QuoteCard({ text }) {
  return (
    <figure className="flex gap-2.5 px-1 py-1 text-[15px] leading-relaxed text-muted">
      <Quote size={16} className="mt-1 shrink-0 text-peach" aria-hidden="true" />
      <blockquote className="italic">{text}</blockquote>
    </figure>
  );
}

// ---------------------------------------------------------------- Chain banner
export function ChainBanner({ text, frozen }) {
  return (
    <p
      className={`flex items-center gap-2 rounded-2xl px-3.5 py-2.5 text-sm ${
        frozen ? 'bg-sky-soft text-ink' : 'bg-leaf-soft text-ink'
      }`}
      role="status"
    >
      {frozen ? <Snowflake size={16} className="shrink-0 text-sky" /> : <Link2 size={16} className="shrink-0 text-leaf" />}
      <span>{text}</span>
    </p>
  );
}

// ---------------------------------------------------------------- Week view
export function WeekView({ t, state, today, locale }) {
  const days = weekDays(today);
  const fmt = new Intl.DateTimeFormat(locale, { weekday: 'narrow' });
  const full = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'short' });
  return (
    <section className="card px-3 pb-3 pt-3.5" aria-labelledby="week-h">
      <h2 id="week-h" className="mb-2.5 px-1 text-sm font-semibold">
        {t('week.title')}
      </h2>
      <ol className="grid grid-cols-7 gap-1">
        {days.map((k) => {
          const d = state.days[k];
          const n = doneCount(d);
          const total = d ? d.items.length : 0;
          const all = isAllDone(d);
          const frozen = !!(d && d.frozen && n === 0);
          const isToday = k === today;
          const future = k > today;
          const ratio = total ? n / total : 0;
          let desc = '';
          if (all) desc = t('week.legend.done');
          else if (n) desc = `${n}/${total}`;
          else if (frozen) desc = t('week.frozen');
          return (
            <li key={k} className="flex flex-col items-center gap-1.5" aria-label={`${full.format(keyToLocalDate(k))}${desc ? ` · ${desc}` : ''}`}>
              <span className={`text-[11px] ${isToday ? 'font-semibold text-ink' : 'text-muted'}`}>{fmt.format(keyToLocalDate(k))}</span>
              <span
                className={`grid h-9 w-9 place-items-center rounded-full text-[11px] ${isToday ? 'ring-2 ring-ink/70 ring-offset-2 ring-offset-card' : ''} ${
                  future ? 'opacity-40' : ''
                }`}
                style={
                  all
                    ? { background: 'var(--leaf)', color: '#fff' }
                    : frozen
                      ? { background: 'var(--sky-soft)', color: 'var(--sky)' }
                      : n
                        ? { background: `conic-gradient(var(--leaf) ${ratio * 360}deg, var(--leaf-soft) 0)` }
                        : { background: 'var(--line)' }
                }
              >
                {all ? <Check size={16} strokeWidth={3} /> : frozen ? <Snowflake size={15} /> : n ? <span className="h-5 w-5 rounded-full bg-card" /> : null}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

// ---------------------------------------------------------------- Stats
const ACH_ICONS = { sunrise: Sunrise, sprout: Sprout, flower: Flower2, tree: TreeDeciduous, mountain: Mountain, star: Star };

export function StatsPanel({ t, st }) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState(null);
  const tiles = [
    [t('stats.tasks'), st.totalTasks],
    [t('stats.days'), st.activeDays],
    [t('stats.current'), st.current],
    [t('stats.best'), st.bestStreak],
  ];
  const unlocked = st.achievements.filter((a) => a.unlocked).length;
  return (
    <section className="card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="stats-body"
        className="flex min-h-14 w-full items-center gap-3 px-4 text-start"
      >
        <Leaf size={18} className="text-leaf" />
        <span className="flex-1 text-sm font-semibold">{t('stats.title')}</span>
        <span className="flex gap-1" aria-hidden="true">
          {st.achievements.map((a) => {
            const I = ACH_ICONS[a.icon];
            return <I key={a.id} size={14} className={a.unlocked ? 'text-sun-deep' : 'text-line'} />;
          })}
        </span>
        <span className="sr-only">
          {unlocked}/{st.achievements.length}
        </span>
        <ChevronDown size={18} className={`text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div id="stats-body" className="fade-in px-4 pb-4">
          <dl className="grid grid-cols-2 gap-2">
            {tiles.map(([label, v]) => (
              <div key={label} className="rounded-2xl bg-bg px-3 py-2.5">
                <dt className="text-xs text-muted">{label}</dt>
                <dd className="text-xl font-semibold tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 flex items-start gap-2 rounded-2xl bg-sky-soft px-3 py-2.5 text-xs leading-relaxed">
            <Snowflake size={15} className="mt-0.5 shrink-0 text-sky" />
            <span>
              <strong className="font-semibold">{st.freezeAvailable ? t('stats.freezeReady') : t('stats.freezeUsed')}</strong>
              {' · '}
              {t('stats.freezeHelp')}
              {st.freezes > 0 && ` ${t('stats.freezes')}: ${st.freezes}.`}
            </span>
          </p>
          <h3 className="mb-2 mt-4 text-xs font-semibold text-muted">{t('ach.title')}</h3>
          <ul className="grid grid-cols-6 gap-1.5">
            {st.achievements.map((a) => {
              const I = ACH_ICONS[a.icon];
              const name = t(`ach.${a.id}`);
              return (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => setPicked(picked === a.id ? null : a.id)}
                    aria-label={`${name}${a.unlocked ? '' : ` · ${t('ach.locked')}`}`}
                    className={`grid aspect-square w-full place-items-center rounded-2xl ${
                      a.unlocked ? 'bg-sun-soft text-sun-deep' : 'bg-bg text-muted/40'
                    } ${picked === a.id ? 'ring-2 ring-sun' : ''}`}
                  >
                    <I size={20} />
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 min-h-5 text-center text-xs text-muted" aria-live="polite">
            {picked && `${t(`ach.${picked}`)}${st.achievements.find((a) => a.id === picked)?.unlocked ? ' ✓' : ` · ${t('ach.locked')}`}`}
          </p>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- Done card
export const DoneCard = forwardRef(function DoneCard({ t, praise, bonus, streak }, ref) {
  return (
    <div ref={ref} className="card rise-in mb-3 flex flex-col items-center px-5 py-6 text-center">
      <div className="mb-2 grid h-12 w-12 place-items-center rounded-full bg-leaf-soft text-leaf">
        <Sprout size={24} />
      </div>
      <h3 className="text-lg font-semibold">{t('done.title')}</h3>
      <p className="mt-1 text-sm text-muted">{praise}</p>
      <div className="mt-3 flex flex-wrap justify-center gap-2 text-xs font-medium">
        <span className="rounded-full bg-sun-soft px-3 py-1 text-sun-deep">{t('done.bonus', { xp: bonus })}</span>
        {streak > 0 && <span className="rounded-full bg-leaf-soft px-3 py-1 text-leaf">{t('done.chain', { n: streak })}</span>}
      </div>
    </div>
  );
});

// ---------------------------------------------------------------- Toasts
export function Toasts({ toasts, onDismiss }) {
  return (
    <div className="safe-bottom pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 px-4" aria-live="polite">
      {toasts.map((x) => (
        <div
          key={x.id}
          onClick={() => onDismiss(x.id)}
          className="toast-in pointer-events-auto flex max-w-sm items-center gap-2.5 rounded-full bg-ink px-4 py-2.5 text-sm text-bg shadow-lg"
        >
          {x.icon}
          <span>{x.text}</span>
          {x.action && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                x.action.run();
              }}
              className="ms-1 min-h-8 rounded-full bg-bg/15 px-3 font-semibold"
            >
              {x.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- Routine editor
export function RoutineSheet({ t, routines, lang, onSave, onLang, onClose }) {
  const [list, setList] = useState(routines.map((r) => ({ ...r })));
  const [draft, setDraft] = useState('');
  const panel = useRef(null);

  useEffect(() => {
    const prev = document.activeElement;
    panel.current?.focus();
    const onKey = (e) => e.key === 'Escape' && finish();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      prev && prev.focus && prev.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const listRef = useRef(list);
  listRef.current = list;
  function finish() {
    const clean = listRef.current
      .map((r) => {
        const title = (r.edit ?? '').trim();
        const { edit, ...rest } = r;
        if (edit === undefined) return rest;
        if (!title) return null; // emptied = removed
        return title === t(r.key) ? rest : { ...rest, title };
      })
      .filter(Boolean);
    onSave(clean);
    onClose();
  }

  const add = (e) => {
    e.preventDefault();
    const title = draft.trim();
    if (!title) return;
    setList((l) => [...l, { id: `r-${Date.now().toString(36)}`, title, icon: 'leaf' }]);
    setDraft('');
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center" role="dialog" aria-modal="true" aria-labelledby="sheet-h">
      <div className="fade-in absolute inset-0 bg-black/30" onClick={finish} />
      <div
        ref={panel}
        tabIndex={-1}
        className="sheet-up safe-bottom relative max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-t-[28px] bg-card px-4 pt-3 shadow-2xl focus:outline-none"
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line" />
        <div className="mb-1 flex items-center">
          <h2 id="sheet-h" className="flex-1 text-lg font-semibold">
            {t('edit.title')}
          </h2>
          <button type="button" onClick={finish} className="h-11 rounded-full bg-ink px-5 text-sm font-semibold text-bg">
            {t('edit.done')}
          </button>
        </div>
        <p className="mb-3 text-sm text-muted">{t('edit.hint')}</p>
        <ul className="space-y-2">
          {list.map((r, i) => (
            <li key={r.id} className="flex items-center gap-2">
              <input
                value={r.edit ?? itemTitle(t, r)}
                maxLength={MAX_TITLE}
                onChange={(e) => setList((l) => l.map((x, j) => (j === i ? { ...x, edit: e.target.value } : x)))}
                enterKeyHint="done"
                onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                aria-label={itemTitle(t, r)}
                className="h-12 min-w-0 flex-1 rounded-2xl bg-bg px-4 text-base text-ink focus:outline-none focus:ring-2 focus:ring-leaf"
              />
              <button
                type="button"
                onClick={() => setList((l) => l.filter((_, j) => j !== i))}
                aria-label={`${t('edit.delete')}: ${itemTitle(t, r)}`}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted active:bg-line/60"
              >
                <Trash2 size={18} />
              </button>
            </li>
          ))}
        </ul>
        <form onSubmit={add} className="mt-2 flex items-center gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t('edit.add')}
            aria-label={t('edit.add')}
            maxLength={MAX_TITLE}
            enterKeyHint="done"
            className="h-12 min-w-0 flex-1 rounded-2xl border border-dashed border-line bg-transparent px-4 text-base placeholder:text-muted focus:border-leaf focus:outline-none"
          />
          <button type="submit" disabled={!draft.trim()} aria-label={t('edit.add')} className="grid h-12 w-12 place-items-center rounded-2xl bg-leaf text-white disabled:opacity-30">
            <Plus size={20} />
          </button>
        </form>

        <div className="mb-2 mt-6">
          <h3 className="mb-2 text-xs font-semibold text-muted">{t('edit.lang')}</h3>
          <div className="grid grid-cols-3 gap-1 rounded-2xl bg-bg p-1" role="radiogroup" aria-label={t('edit.lang')}>
            {[
              [null, t('edit.lang.auto')],
              ['en', 'English'],
              ['he', 'עברית'],
            ].map(([v, label]) => (
              <button
                key={label}
                type="button"
                role="radio"
                aria-checked={lang === v}
                onClick={() => onLang(v)}
                className={`h-10 rounded-xl text-sm ${lang === v ? 'bg-card font-semibold shadow-sm' : 'text-muted'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <button type="button" onClick={finish} className="sr-only">
          <X /> {t('close')}
        </button>
      </div>
    </div>
  );
}
