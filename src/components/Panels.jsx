import { forwardRef, useRef, useState } from 'react';
import { Check, Lock, Plus, Trash2 } from 'lucide-react';
import { weekDays, keyToLocalDate, dayNumber, weekStart, mondayIndex } from '../domain/dates.js';
import { doneCount, isAllDone, MAX_TITLE, STAGES } from '../domain/model.js';
import { itemTitle } from '../lib/i18n.js';
import { CompanionArt } from './Companion.jsx';
import Plant from './Plant.jsx';
import { Medal, MissionIcon, MISSION_ICONS, iconKey } from './Art.jsx';
import { Sheet } from './Sheets.jsx';

export const WEEK_GOAL = 5;

// ---------------------------------------------------------------- This week (days you showed up)
export function WeekCard({ t, state, today, locale, st, id = 'week-h' }) {
  const days = weekDays(today);
  const fmt = new Intl.DateTimeFormat(locale, { weekday: 'narrow' });
  const full = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'short' });
  const won = st.week >= WEEK_GOAL;
  const dest = t(`dest.${Math.floor(dayNumber(weekStart(today)) / 7) % 5}`);
  const statusOf = (k) => {
    const d = state.days[k];
    const n = doneCount(d);
    if (isAllDone(d)) return { cls: 'done', label: t('week.all') };
    if (n) return { cls: 'some', p: `${Math.round((n / d.items.length) * 100)}%`, label: `${n}/${d.items.length}` };
    return { cls: k > today ? 'future' : '', label: '' };
  };
  return (
    <section aria-labelledby={id}>
      <h3 id={id} className="sr-only">
        {t('week.title')}
      </h3>
      <p className="t-title">{st.week ? t('week.showed', { n: st.week }) : mondayIndex(today) === 0 ? t('week.fresh') : t('week.quiet')}</p>
      <p className="t-meta mt-1">{won ? t('week.reached', { place: dest }) : t('week.toGo', { n: WEEK_GOAL - st.week, place: dest })}</p>
      <ol className="week mt-5">
        {days.map((k, i) => {
          const s = statusOf(k);
          const isToday = k === today;
          return (
            <li key={k} className="rise-in" style={{ animationDelay: `${i * 30}ms` }} aria-label={`${full.format(keyToLocalDate(k))}${s.label ? ` · ${s.label}` : ''}`}>
              <span className={`day ${s.cls} ${isToday ? 'today' : ''}`} style={s.p ? { '--p': s.p } : undefined}>
                {s.cls === 'done' ? <Check size={14} strokeWidth={3} /> : null}
              </span>
              <span className={`t-label ${isToday ? 'text-accent' : ''}`}>{fmt.format(keyToLocalDate(k))}</span>
            </li>
          );
        })}
      </ol>
      <dl className="data-row two mt-6">
        <div>
          <dt className="t-label">{t('chip.month')}</dt>
          <dd>{st.month}</dd>
        </div>
        <div>
          <dt className="t-label">{t('stats.days')}</dt>
          <dd>{st.activeDays}</dd>
        </div>
      </dl>
    </section>
  );
}

// ---------------------------------------------------------------- Done (all of today played)
export const DoneCard = forwardRef(function DoneCard({ t, praise, bonus, month, species }, ref) {
  return (
    <div ref={ref} className="done-panel rise-in">
      <div className="shrink-0">
        <CompanionArt species={species} mood="calm" size={56} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="t-body font-semibold">{praise}</p>
        <p className="t-meta num mt-0.5" dir="auto">
          {t('done.bonus', { xp: bonus })}
          {month > 0 && ` · ${t('done.month', { n: month })}`}
        </p>
      </div>
    </div>
  );
});

// ---------------------------------------------------------------- Garden: growth, totals, moments, medals, companions
const PEBBLE = { 'first-minimum': '#A78BFA', comeback: '#FB923C', 'full-after-min': '#38BDF8', 'habit-50': '#F59E0B', 'habit-month': '#22C55E' };

export function GardenPanel({ t, st, moments = [] }) {
  const [picked, setPicked] = useState(null);
  const stage = st.stage;
  const next = stage.next;
  const into = next ? (st.totalTasks - stage.min) / (next.min - stage.min) : 1;
  const tiles = [
    [t('stats.days'), st.activeDays],
    [t('stats.month'), st.month],
    [t('stats.tasks'), st.totalTasks],
    [t('stats.level'), st.level.level],
  ];
  return (
    <div className="pb-2">
      <section className="section flex items-center gap-4">
        <Plant stage={stage.id} size={72} label={t(`stage.${stage.id}`)} />
        <div className="min-w-0 flex-1">
          <p className="t-label">{t('chip.growth')}</p>
          <p className="t-title mt-0.5">{t(`stage.${stage.id}`)}</p>
          <div className="bar mt-3" aria-hidden="true">
            <span style={{ width: `${Math.round(into * 100)}%` }} />
          </div>
          <p className="t-meta mt-2">{next ? t('stage.next', { n: next.min - st.totalTasks, stage: t(`stage.${next.id}`) }) : t('stage.max')}</p>
          <p className="sr-only">
            {STAGES.findIndex((s) => s.id === stage.id) + 1} / {STAGES.length}
          </p>
        </div>
      </section>

      <section className="section">
        <dl className="data-row m-0">
          {tiles.map(([label, v]) => (
            <div key={label}>
              <dt className="t-label">{label}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="section">
        <div className="section-head">
          <h3 className="t-label">{t('keep.title')}</h3>
          {moments.length > 0 && <span className="t-label num">{moments.length}</span>}
        </div>
        {moments.length ? (
          <>
            <ul className="m-0 list-none p-0">
              {moments.map((m) => (
                <li key={m.id} className="row">
                  <span className="h-3 w-4 shrink-0 rounded-[50%]" style={{ background: PEBBLE[m.type] }} aria-hidden="true" />
                  <span className="t-body min-w-0 flex-1">{m.label}</span>
                  <span className="t-meta num">{m.date}</span>
                </li>
              ))}
            </ul>
            <p className="t-meta mt-2">{t('keep.hint')}</p>
          </>
        ) : (
          <p className="t-meta">{t('keep.empty')}</p>
        )}
      </section>

      <section className="section">
        <h3 className="t-label mb-3">{t('ach.title')}</h3>
        <ul className="m-0 grid list-none grid-cols-6 gap-1 p-0">
          {st.achievements.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                aria-pressed={picked === a.id}
                onClick={() => setPicked(picked === a.id ? null : a.id)}
                aria-label={`${t(`ach.${a.id}`)}${a.unlocked ? '' : ` · ${t('ach.locked')}`}`}
                className={`pick grid aspect-square w-full min-w-11 place-items-center ${a.unlocked ? '' : 'opacity-60'}`}
              >
                <Medal id={a.id} locked={!a.unlocked} size={30} />
              </button>
            </li>
          ))}
        </ul>
        <p className="t-meta mt-2 min-h-5" aria-live="polite">
          {picked ? `${t(`ach.${picked}`)} · ${st.achievements.find((a) => a.id === picked)?.unlocked ? t('ach.have') : t(`ach.how.${picked}`)}` : ' '}
        </p>
      </section>

      <section className="section">
        <h3 className="t-label mb-3">{t('buddies.title')}</h3>
        <ul className="m-0 grid list-none grid-cols-3 gap-2 p-0">
          {st.companions.map((c) => (
            <li key={c.id} className="flex flex-col items-center text-center">
              <CompanionArt species={c.id} size={56} silhouette={!c.unlocked} />
              <span className="t-body mt-1 font-semibold">{c.unlocked ? t(`buddy.${c.id}`) : '—'}</span>
              <span className="t-meta">{c.unlocked ? t(`buddy.${c.id}.kind`) : t(`buddy.${c.id}.how`)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------- Toasts (rare: new companion, app update)
export function Toasts({ toasts, onDismiss }) {
  return (
    <div className="safe-top pointer-events-none fixed inset-x-0 top-0 z-50 flex flex-col items-center gap-2 px-4" aria-live="polite">
      {toasts.map((x) => (
        <div key={x.id} onClick={() => onDismiss(x.id)} className="toast pointer-events-auto">
          <span className="grid h-8 w-8 shrink-0 place-items-center">{x.icon}</span>
          <span className="flex-1">{x.text}</span>
          {x.action && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                x.action.run();
              }}
              className="btn btn-sm bg-white/15" data-hit="extended"
            >
              {x.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- Settings sheet
export function SettingsSheet({ t, state, st, onSave, onLang, onProfile, onClose }) {
  const [list, setList] = useState(state.routines.map((r) => ({ ...r })));
  const [draft, setDraft] = useState('');
  const [name, setName] = useState(state.name || '');
  const listRef = useRef(list);
  listRef.current = list;
  const nameRef = useRef(name);
  nameRef.current = name;

  // Saved as the sheet starts to close (Done, Escape or tapping outside).
  function save() {
    const clean = listRef.current
      .map((r) => {
        const { edit, miniEdit, ...rest } = r;
        let out = { ...rest };
        if (edit !== undefined) {
          const title = edit.trim();
          if (!title) return null; // emptied = removed
          if (rest.key && title === t(rest.key)) delete out.title;
          else out.title = title;
        }
        if (miniEdit !== undefined) {
          const mini = miniEdit.trim();
          if (mini) out.mini = mini;
          else delete out.mini;
        }
        return out;
      })
      .filter(Boolean);
    onSave(clean);
    onProfile({ name: nameRef.current });
  }

  const add = (e) => {
    e.preventDefault();
    const title = draft.trim();
    if (!title) return;
    setList((l) => [...l, { id: `r-${Date.now().toString(36)}`, title, icon: 'star' }]);
    setDraft('');
  };
  const patch = (i, p) => setList((l) => l.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const cycleIcon = (i) => {
    const cur = MISSION_ICONS.indexOf(iconKey(list[i].icon));
    patch(i, { icon: MISSION_ICONS[(cur + 1) % MISSION_ICONS.length] });
  };

  return (
    <Sheet
      title={t('settings.title')}
      labelId="sheet-h"
      t={t}
      onClosing={save}
      onClose={onClose}
      action={(close) => (
        <button type="button" onClick={close} className="btn btn-primary btn-sm" data-hit="extended">
          {t('edit.done')}
        </button>
      )}
    >
      <section className="section">
        <h3 className="t-label mb-3">{t('buddies.pick')}</h3>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={t('buddies.pick')}>
          {st.companions.map((c) => {
            const sel = state.buddy === c.id;
            return (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={sel}
                disabled={!c.unlocked}
                onClick={() => onProfile({ buddy: c.id })}
                className="pick flex flex-col items-center px-1 pb-2 pt-1 text-center"
              >
                <CompanionArt species={c.id} size={56} silhouette={!c.unlocked} mood={sel ? 'happy' : 'idle'} />
                <span className="flex items-center gap-1 text-[13px] font-semibold">
                  {!c.unlocked && <Lock size={11} />}
                  {c.unlocked ? t(`buddy.${c.id}`) : '—'}
                </span>
                <span className="text-[11px] leading-tight text-muted">{c.unlocked ? t(`buddy.${c.id}.kind`) : t(`buddy.${c.id}.how`)}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="section">
        <label className="t-label mb-2 block" htmlFor="name-input">
          {t('settings.name')}
        </label>
        <input
          id="name-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={24}
          placeholder={t('settings.namePh')}
          enterKeyHint="done"
          autoComplete="given-name"
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          className="field"
        />
      </section>

      <section className="section">
        <h3 className="t-label">{t('edit.title')}</h3>
        <p className="t-meta mb-2 mt-1">{t('edit.hint')}</p>
        <ul className="m-0 list-none p-0">
          {list.map((r, i) => {
            const k = iconKey(r.icon);
            const title = r.edit ?? itemTitle(t, r);
            return (
              <li key={r.id} className="border-b border-line py-3 last:border-0">
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => cycleIcon(i)} aria-label={t('edit.icon')} className="tile-ico h-11 w-11 hover:bg-[var(--surface-3)]">
                    <MissionIcon kind={k} size={22} />
                  </button>
                  <input
                    value={title}
                    maxLength={MAX_TITLE}
                    onChange={(e) => patch(i, { edit: e.target.value })}
                    enterKeyHint="done"
                    onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                    aria-label={itemTitle(t, r)}
                    className="field font-semibold"
                  />
                  <button type="button" onClick={() => setList((l) => l.filter((_, j) => j !== i))} aria-label={`${t('edit.delete')}: ${itemTitle(t, r)}`} className="icon-btn">
                    <Trash2 size={17} />
                  </button>
                </div>
                <div className="mt-2 flex items-center gap-2 ps-[52px]">
                  <span className="t-label w-10 shrink-0">{t('min.tinyShort')}</span>
                  <input
                    value={r.miniEdit ?? r.mini ?? ''}
                    maxLength={MAX_TITLE}
                    onChange={(e) => patch(i, { miniEdit: e.target.value })}
                    placeholder={r.key && !r.title ? t(`${r.key}.mini`) : t('min.tinyPh')}
                    enterKeyHint="done"
                    onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                    aria-label={`${t('min.tiny')}: ${itemTitle(t, r)}`}
                    className="field h-10 text-[15px]"
                  />
                </div>
              </li>
            );
          })}
        </ul>
        <form onSubmit={add} className="mt-3 flex items-center gap-2">
          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={t('edit.add')} aria-label={t('edit.add')} maxLength={MAX_TITLE} enterKeyHint="done" className="field" />
          <button type="submit" disabled={!draft.trim()} aria-label={t('edit.add')} className="btn btn-quiet w-11 shrink-0 px-0">
            <Plus size={18} />
          </button>
        </form>
      </section>

      <section className="section mb-2">
        <h3 className="t-label mb-3">{t('edit.lang')}</h3>
        <div className="seg" role="radiogroup" aria-label={t('edit.lang')}>
          {[
            [null, t('edit.lang.auto')],
            ['en', 'English'],
            ['he', 'עברית'],
          ].map(([v, label]) => (
            <button key={label} type="button" role="radio" aria-checked={state.lang === v} onClick={() => onLang(v)}>
              {label}
            </button>
          ))}
        </div>
      </section>
    </Sheet>
  );
}
