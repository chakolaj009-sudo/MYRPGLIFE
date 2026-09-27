import { useEffect, useRef, useState } from 'react';
import { BedDouble, BookOpen, Check, ChevronDown, Feather, Leaf, Plus, Sparkles, Wind, X } from 'lucide-react';
import { itemTitle } from '../lib/i18n.js';
import { MAX_TITLE } from '../domain/model.js';

const ICONS = { teeth: Sparkles, bed: BedDouble, book: BookOpen, wind: Wind, leaf: Leaf };
const LEAVE_MS = 700;

function Row({ item, t, checked, onTap, onRemove, state }) {
  const Icon = ICONS[item.icon] || Feather;
  return (
    <div className={`task-wrap mb-2 ${state}`}>
      <div>
        <div className="task-row card flex items-center gap-1 !rounded-2xl pe-1">
          <button
            type="button"
            onClick={(e) => onTap(item.id, e.currentTarget)}
            aria-pressed={checked}
            className="flex min-h-[56px] flex-1 items-center gap-3 rounded-2xl px-3 py-2 text-start active:scale-[0.99]"
          >
            <span
              className={`check-dot grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 transition-colors ${
                checked ? 'border-leaf bg-leaf text-white' : 'border-line bg-card'
              }`}
            >
              {checked && <Check size={16} strokeWidth={3} />}
            </span>
            <Icon size={18} className="shrink-0 text-muted" aria-hidden="true" />
            <span className={`min-w-0 flex-1 break-words text-[15px] leading-snug ${checked ? 'text-muted line-through' : ''}`}>
              {itemTitle(t, item)}
            </span>
          </button>
          {item.kind === 'custom' && onRemove && (
            <button
              type="button"
              onClick={() => onRemove(item.id)}
              aria-label={`${t('today.remove')}: ${itemTitle(t, item)}`}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted active:bg-line/60"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TaskList({ t, day, onToggle, onRemove, onAdd, doneCard }) {
  const [leaving, setLeaving] = useState({}); // id -> true while the exit transition runs
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
    if (!v) {
      inputRef.current?.blur();
      return;
    }
    onAdd(v);
    setDraft('');
  };

  return (
    <section aria-labelledby="today-h">
      {allDone ? (
        doneCard
      ) : day.items.length === 0 ? (
        <p className="card mb-2 px-4 py-5 text-center text-sm text-muted">{t('today.empty')}</p>
      ) : null}

      <div>
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
      </div>

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
          className="h-12 min-w-0 flex-1 rounded-2xl border border-dashed border-line bg-transparent px-4 text-base text-ink placeholder:text-muted focus:border-leaf focus:bg-card focus:outline-none"
        />
        <button
          type="submit"
          aria-label={t('today.addBtn')}
          className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-ink text-bg active:scale-95 disabled:opacity-30"
          disabled={!draft.trim()}
        >
          <Plus size={20} />
        </button>
      </form>

      {finished.length > 0 && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setDrawer((d) => !d)}
            aria-expanded={drawer}
            className="flex min-h-11 w-full items-center gap-2 rounded-xl px-2 text-sm text-muted"
          >
            <Check size={16} className="text-leaf" />
            <span className="flex-1 text-start">{t('today.doneDrawer', { n: finished.length })}</span>
            <ChevronDown size={18} className={`transition-transform ${drawer ? 'rotate-180' : ''}`} />
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
                    className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-start text-sm text-muted active:bg-line/50"
                  >
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-leaf-soft text-leaf">
                      <Check size={14} strokeWidth={3} />
                    </span>
                    <span className="min-w-0 flex-1 break-words line-through decoration-muted/50">{itemTitle(t, item)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
