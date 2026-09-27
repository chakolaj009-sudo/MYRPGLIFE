import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Plus, X } from 'lucide-react';
import { itemTitle } from '../lib/i18n.js';
import { MAX_TITLE, XP_PER_TASK } from '../domain/model.js';
import { MissionIcon, MISSION_TINT, iconKey } from './Art.jsx';

const LEAVE_MS = 720;

function Row({ item, t, checked, onTap, onRemove, state }) {
  const k = iconKey(item.icon || (item.kind === 'custom' ? 'star' : 'sprout'));
  return (
    <li className={`task-wrap mb-2 ${state}`}>
      <div>
        <div className="task-row card flex items-center">
          <button
            type="button"
            onClick={(e) => onTap(item.id, e.currentTarget)}
            aria-pressed={checked}
            className="flex min-h-[68px] min-w-0 flex-1 items-center gap-3 rounded-[18px] py-2.5 ps-2.5 pe-3 text-start transition-transform active:scale-[0.985]"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px]" style={{ background: MISSION_TINT[k] }}>
              <MissionIcon kind={k} />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="break-words text-[15.5px] font-semibold leading-snug tracking-[-0.01em]">{itemTitle(t, item)}</span>
              <span className="text-[12.5px] text-muted">{item.kind === 'custom' ? t('task.custom') : t('task.daily')}</span>
            </span>
            <span className="shrink-0 text-[13px] font-bold text-primary-deep" dir="ltr">
              +{XP_PER_TASK} XP
            </span>
            <span
              className={`check-dot grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 transition-colors ${
                checked ? 'on border-green bg-green text-white' : 'border-line bg-card'
              }`}
            >
              <Check size={16} strokeWidth={3} />
            </span>
          </button>
          {item.kind === 'custom' && onRemove && (
            <button
              type="button"
              onClick={() => onRemove(item.id)}
              aria-label={`${t('today.remove')}: ${itemTitle(t, item)}`}
              className="-ms-1 me-1 grid h-11 w-9 shrink-0 place-items-center rounded-full text-muted active:bg-line/60"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

export default function TaskList({ t, day, onToggle, onRemove, onAdd, doneCard }) {
  const [leaving, setLeaving] = useState({});
  const [entering, setEntering] = useState({});
  const [drawer, setDrawer] = useState(false);
  const [draft, setDraft] = useState('');
  const timers = useRef({});
  const inputRef = useRef(null);

  useEffect(() => () => Object.values(timers.current).forEach(clearTimeout), []);

  const done = new Set(day.done);
  const active = day.items.filter((i) => !done.has(i.id) || leaving[i.id]);
  const finished = day.items.filter((i) => done.has(i.id) && !leaving[i.id]);
  const allDone = day.items.length > 0 && finished.length === day.items.length;
  // An emptied drawer starts closed next time.
  useEffect(() => {
    if (!finished.length) setDrawer(false);
  }, [finished.length]);

  const complete = (id, el) => {
    onToggle(id, el);
    setLeaving((l) => ({ ...l, [id]: true }));
    clearTimeout(timers.current[id]);
    timers.current[id] = setTimeout(() => setLeaving(({ [id]: _, ...rest }) => rest), LEAVE_MS);
  };
  const undo = (id, el) => {
    onToggle(id, el);
    setEntering((e) => ({ ...e, [id]: true }));
    setTimeout(() => setEntering(({ [id]: _, ...rest }) => rest), 400);
  };
  const submit = (e) => {
    e.preventDefault();
    const v = draft.trim();
    if (!v) return inputRef.current?.blur();
    onAdd(v);
    setDraft('');
  };

  return (
    <div>
      {allDone ? doneCard : day.items.length === 0 ? <p className="card mb-2 px-4 py-5 text-center text-sm text-muted">{t('today.empty')}</p> : null}

      <ul className="m-0 list-none p-0" aria-label={t('today.title')}>
        {active.map((item) => (
          <Row
            key={item.id}
            item={item}
            t={t}
            checked={!!leaving[item.id]}
            state={leaving[item.id] ? 'leaving' : entering[item.id] ? 'entering' : ''}
            onTap={leaving[item.id] ? () => {} : complete}
            onRemove={leaving[item.id] ? null : onRemove}
          />
        ))}
      </ul>

      <form onSubmit={submit} className="mt-1 flex items-center gap-2">
        <label className="sr-only" htmlFor="new-task">
          {t('today.add')}
        </label>
        <input
          id="new-task"
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t('today.add')}
          maxLength={MAX_TITLE}
          enterKeyHint="done"
          autoComplete="off"
          autoCapitalize="sentences"
          className="h-[52px] min-w-0 flex-1 rounded-[18px] border-[1.5px] border-dashed border-line bg-transparent px-4 text-base text-ink placeholder:text-muted focus:border-primary focus:bg-card focus:outline-none"
        />
        <button
          type="submit"
          aria-label={t('today.addBtn')}
          disabled={!draft.trim()}
          className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-[18px] text-white shadow-[0_6px_16px_rgb(79_70_229/0.3)] transition active:scale-95 disabled:opacity-35 disabled:shadow-none"
          style={{ background: 'linear-gradient(135deg,#8B93FF,#4F46E5)' }}
        >
          <Plus size={22} />
        </button>
      </form>

      {finished.length > 0 && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setDrawer((d) => !d)}
            aria-expanded={drawer}
            className="flex min-h-11 w-full items-center gap-2 rounded-xl px-2 text-sm font-medium text-ink2"
          >
            <span className="grid h-5 w-5 place-items-center rounded-full bg-green text-white">
              <Check size={12} strokeWidth={3.5} />
            </span>
            <span className="flex-1 text-start">{t('today.doneDrawer', { n: finished.length })}</span>
            <ChevronDown size={18} className={`text-muted transition-transform ${drawer ? 'rotate-180' : ''}`} />
          </button>
          {drawer && (
            <ul className="fade-in mt-1 space-y-1" aria-label={t('today.undo')}>
              {finished.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={(e) => undo(item.id, e.currentTarget)}
                    aria-pressed="true"
                    title={t('today.undo')}
                    className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-start text-sm text-ink2 active:bg-line/50"
                  >
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[9px] opacity-70" style={{ background: MISSION_TINT[iconKey(item.icon || 'star')] }}>
                      <MissionIcon kind={item.icon || 'star'} size={18} />
                    </span>
                    <span className="min-w-0 flex-1 break-words line-through decoration-muted/60">{itemTitle(t, item)}</span>
                    <span className="text-xs text-muted">{t('today.undoShort')}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
