import { forwardRef, useEffect, useRef, useState } from 'react';
import { Lock, Plus, Star, Trash2 } from 'lucide-react';
import { weekDays, keyToLocalDate, dayNumber, weekStart } from '../domain/dates.js';
import { doneCount, isAllDone, MAX_TITLE, STAGES } from '../domain/model.js';
import { itemTitle } from '../lib/i18n.js';
import { CompanionArt } from './Companion.jsx';
import Plant from './Plant.jsx';
import { Medal, MissionIcon, MISSION_ICONS, MISSION_TINT, Peak, iconKey } from './Art.jsx';

export const WEEK_GOAL = 5;

// ---------------------------------------------------------------- This week (days you showed up)
export function WeekCard({ t, state, today, locale, st }) {
  const days = weekDays(today);
  const fmt = new Intl.DateTimeFormat(locale, { weekday: 'narrow' });
  const full = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'short' });
  const won = st.week >= WEEK_GOAL;
  const dest = t(`dest.${Math.floor(dayNumber(weekStart(today)) / 7) % 5}`);
  const statusOf = (k) => {
    const d = state.days[k];
    const n = doneCount(d);
    if (isAllDone(d)) return { cls: 'done', label: t('week.all') };
    if (n) return { cls: 'some', p: `${(n / d.items.length) * 360}deg`, label: `${n}/${d.items.length}` };
    return { cls: k > today ? 'future' : '', label: '' };
  };
  const lit = (s) => s.cls === 'done' || s.cls === 'some';
  return (
    <section className="card-lg px-4 pb-3.5 pt-3.5" aria-labelledby="week-h">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 id="week-h" className="eyebrow">
            {t('week.title')}
          </h2>
          <p className="mt-1 text-[17px] font-extrabold tracking-[-0.02em]">{t('week.showed', { n: st.week })}</p>
        </div>
        <div className="flex max-w-[50%] items-center gap-1.5 text-end">
          <span className="text-xs font-semibold leading-tight text-ink2">
            {won ? t('week.reached', { place: dest }) : t('week.toGo', { n: WEEK_GOAL - st.week, place: dest })}
          </span>
          <Peak won={won} />
        </div>
      </div>
      <ol className="m-0 mt-3 flex list-none items-start p-0">
        {days.map((k, i) => {
          const s = statusOf(k);
          const isToday = k === today;
          return [
            i > 0 && <li key={`l${k}`} aria-hidden="true" className={`link-line mt-[14px] ${lit(s) && lit(statusOf(days[i - 1])) ? 'on' : ''}`} />,
            <li key={k} className="flex flex-col items-center gap-1" aria-label={`${full.format(keyToLocalDate(k))}${s.label ? ` · ${s.label}` : ''}`}>
              <span className={`slot ${s.cls} ${isToday ? 'today' : ''}`} style={s.p ? { '--p': s.p } : undefined}>
                {s.cls === 'done' ? <Star size={14} fill="currentColor" strokeWidth={0} /> : null}
              </span>
              <span className={`text-[10.5px] ${isToday ? 'font-bold text-primary-deep' : 'text-muted'}`}>{fmt.format(keyToLocalDate(k))}</span>
            </li>,
          ];
        })}
      </ol>
      <p className="m-0 mt-2.5 border-t border-line pt-2.5 text-[12.5px] text-ink2">{t('week.totals', { m: st.month, a: st.activeDays })}</p>
    </section>
  );
}

// ---------------------------------------------------------------- Done card
export const DoneCard = forwardRef(function DoneCard({ t, praise, bonus, month, species }, ref) {
  return (
    <div
      ref={ref}
      className="rise-in mb-3 flex items-center gap-3 overflow-hidden rounded-[22px] px-4 py-4 text-white shadow-[0_12px_30px_rgb(79_70_229/0.3)]"
      style={{ background: 'linear-gradient(135deg,#8B93FF 0%,#6366F1 55%,#4F46E5 100%)' }}
    >
      <div className="shrink-0">
        <CompanionArt species={species} mood="calm" size={76} />
      </div>
      <div className="min-w-0">
        <h3 className="text-[17px] font-extrabold tracking-[-0.01em]">{t('done.title')}</h3>
        <p className="mt-0.5 text-[13.5px] leading-snug text-white/85">{praise}</p>
        <div className="mt-2 flex flex-wrap gap-1.5 text-[11.5px] font-bold">
          <span className="rounded-full bg-white/20 px-2.5 py-1" dir="ltr">
            {t('done.bonus', { xp: bonus })}
          </span>
          {month > 0 && <span className="rounded-full bg-white/20 px-2.5 py-1">{t('done.month', { n: month })}</span>}
        </div>
      </div>
    </div>
  );
});

// ---------------------------------------------------------------- Garden: growth, totals, medals, companions
export function GardenPanel({ t, st }) {
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
    <div className="card-lg px-4 pb-4 pt-3">
      <div className="flex items-center gap-3 rounded-[18px] px-1 py-2">
        <Plant stage={stage.id} size={86} label={t(`stage.${stage.id}`)} />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-bold">{t(`stage.${stage.id}`)}</p>
          <p className="text-xs text-ink2">{next ? t('stage.next', { n: next.min - st.totalTasks, stage: t(`stage.${next.id}`) }) : t('stage.max')}</p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full" style={{ width: `${Math.round(into * 100)}%`, background: 'linear-gradient(90deg,#4ADE80,#10B981)' }} />
          </div>
          <div className="mt-1.5 flex gap-1" aria-hidden="true">
            {STAGES.map((s, i) => (
              <span key={s.id} className={`h-1 flex-1 rounded-full ${i <= stage.index ? 'bg-green' : 'bg-line'}`} />
            ))}
          </div>
        </div>
      </div>

      <dl className="m-0 mt-2 grid grid-cols-2 gap-2">
        {tiles.map(([label, v]) => (
          <div key={label} className="rounded-2xl bg-bg px-3 py-2.5">
            <dt className="text-xs text-muted">{label}</dt>
            <dd className="m-0 text-xl font-extrabold tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>

      <h3 className="eyebrow mb-2 mt-4">{t('ach.title')}</h3>
      <ul className="m-0 grid list-none grid-cols-6 gap-1.5 p-0">
        {st.achievements.map((a) => (
          <li key={a.id}>
            <button
              type="button"
              onClick={() => setPicked(picked === a.id ? null : a.id)}
              aria-label={`${t(`ach.${a.id}`)}${a.unlocked ? '' : ` · ${t('ach.locked')}`}`}
              className={`grid aspect-square w-full min-w-11 place-items-center rounded-2xl ${a.unlocked ? 'bg-tint' : 'bg-bg'} ${picked === a.id ? 'ring-2 ring-primary' : ''}`}
            >
              <Medal id={a.id} locked={!a.unlocked} size={32} />
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-2 min-h-5 text-center text-xs text-ink2" aria-live="polite">
        {picked && `${t(`ach.${picked}`)} · ${st.achievements.find((a) => a.id === picked)?.unlocked ? t('ach.have') : t(`ach.how.${picked}`)}`}
      </p>

      <h3 className="eyebrow mb-2 mt-3">{t('buddies.title')}</h3>
      <ul className="m-0 grid list-none grid-cols-3 gap-2 p-0">
        {st.companions.map((c) => (
          <li key={c.id} className="flex flex-col items-center rounded-2xl bg-bg px-1 pb-2 pt-1">
            <CompanionArt species={c.id} size={62} silhouette={!c.unlocked} />
            <span className="text-xs font-bold">{c.unlocked ? t(`buddy.${c.id}`) : '???'}</span>
            <span className="text-center text-[10.5px] leading-tight text-muted">{c.unlocked ? t(`buddy.${c.id}.kind`) : t(`buddy.${c.id}.how`)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------- Toasts (rare: new companion, app update)
export function Toasts({ toasts, onDismiss }) {
  return (
    <div className="safe-top pointer-events-none fixed inset-x-0 top-0 z-50 flex flex-col items-center gap-2 px-4" aria-live="polite">
      {toasts.map((x) => (
        <div
          key={x.id}
          onClick={() => onDismiss(x.id)}
          className="toast-in pointer-events-auto flex max-w-sm items-center gap-2.5 rounded-full bg-navy py-2 pe-4 ps-2 text-[13.5px] font-semibold text-white shadow-[0_12px_30px_rgb(20_24_60/0.3)]"
        >
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/10">{x.icon}</span>
          <span>{x.text}</span>
          {x.action && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                x.action.run();
              }}
              className="ms-1 min-h-11 rounded-full bg-white/15 px-3 font-bold"
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
  const panel = useRef(null);
  const listRef = useRef(list);
  listRef.current = list;
  const nameRef = useRef(name);
  nameRef.current = name;

  function finish() {
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
    onClose();
  }

  useEffect(() => {
    const prev = document.activeElement;
    panel.current?.focus();
    const onKey = (e) => e.key === 'Escape' && finish();
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    <div className="fixed inset-0 z-40 flex items-end justify-center" role="dialog" aria-modal="true" aria-labelledby="sheet-h">
      <div className="fade-in absolute inset-0 bg-[#121735]/40" onClick={finish} />
      <div ref={panel} tabIndex={-1} className="sheet-up safe-bottom relative max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-[28px] bg-card px-4 pt-3 shadow-2xl focus:outline-none">
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line" />
        <div className="mb-3 flex items-center">
          <h2 id="sheet-h" className="flex-1 text-xl font-extrabold tracking-[-0.02em]">
            {t('settings.title')}
          </h2>
          <button type="button" onClick={finish} className="h-11 rounded-full px-5 text-sm font-bold text-white" style={{ background: 'linear-gradient(135deg,#8B93FF,#4F46E5)' }}>
            {t('edit.done')}
          </button>
        </div>

        <h3 className="eyebrow mb-2">{t('buddies.pick')}</h3>
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
                className={`flex flex-col items-center rounded-2xl px-1 pb-2 pt-1 transition ${sel ? 'bg-tint ring-2 ring-primary' : 'bg-bg'} disabled:cursor-not-allowed`}
              >
                <CompanionArt species={c.id} size={64} silhouette={!c.unlocked} mood={sel ? 'happy' : 'idle'} />
                <span className="flex items-center gap-1 text-xs font-bold">
                  {!c.unlocked && <Lock size={11} />}
                  {c.unlocked ? t(`buddy.${c.id}`) : '???'}
                </span>
                <span className="text-center text-[10.5px] leading-tight text-muted">{c.unlocked ? t(`buddy.${c.id}.kind`) : t(`buddy.${c.id}.how`)}</span>
              </button>
            );
          })}
        </div>

        <label className="eyebrow mb-2 mt-5 block" htmlFor="name-input">
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
          className="h-12 w-full rounded-2xl bg-bg px-4 text-base text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary"
        />

        <h3 className="eyebrow mb-1 mt-5">{t('edit.title')}</h3>
        <p className="mb-2 text-[13px] text-ink2">{t('edit.hint')}</p>
        <ul className="m-0 list-none space-y-2.5 p-0">
          {list.map((r, i) => {
            const k = iconKey(r.icon);
            const title = r.edit ?? itemTitle(t, r);
            return (
              <li key={r.id} className="rounded-2xl bg-bg p-2">
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => cycleIcon(i)} aria-label={t('edit.icon')} className="grid h-11 w-11 shrink-0 place-items-center rounded-[13px]" style={{ background: MISSION_TINT[k] }}>
                    <MissionIcon kind={k} size={22} />
                  </button>
                  <input
                    value={title}
                    maxLength={MAX_TITLE}
                    onChange={(e) => patch(i, { edit: e.target.value })}
                    enterKeyHint="done"
                    onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                    aria-label={itemTitle(t, r)}
                    className="h-11 min-w-0 flex-1 rounded-xl bg-card px-3 text-base font-semibold text-ink focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <button
                    type="button"
                    onClick={() => setList((l) => l.filter((_, j) => j !== i))}
                    aria-label={`${t('edit.delete')}: ${itemTitle(t, r)}`}
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted active:bg-line/60"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
                <div className="mt-1.5 flex items-center gap-2 ps-[52px]">
                  <input
                    value={r.miniEdit ?? r.mini ?? ''}
                    maxLength={MAX_TITLE}
                    onChange={(e) => patch(i, { miniEdit: e.target.value })}
                    placeholder={r.key && !r.title ? t(`${r.key}.mini`) : t('min.tinyPh')}
                    enterKeyHint="done"
                    onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                    aria-label={`${t('min.tiny')}: ${itemTitle(t, r)}`}
                    className="h-11 min-w-0 flex-1 rounded-xl bg-card/70 px-3 text-[15px] text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </li>
            );
          })}
        </ul>
        <form onSubmit={add} className="mt-2.5 flex items-center gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t('edit.add')}
            aria-label={t('edit.add')}
            maxLength={MAX_TITLE}
            enterKeyHint="done"
            className="h-12 min-w-0 flex-1 rounded-2xl border-[1.5px] border-dashed border-line bg-transparent px-4 text-base placeholder:text-muted focus:border-primary focus:outline-none"
          />
          <button type="submit" disabled={!draft.trim()} aria-label={t('edit.add')} className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-white disabled:opacity-30">
            <Plus size={20} />
          </button>
        </form>

        <div className="mb-3 mt-6">
          <h3 className="eyebrow mb-2">{t('edit.lang')}</h3>
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
                aria-checked={state.lang === v}
                onClick={() => onLang(v)}
                className={`h-11 rounded-xl text-sm ${state.lang === v ? 'bg-card font-bold text-primary-deep shadow-sm' : 'text-ink2'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
