import { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, RotateCcw, X } from 'lucide-react';
import { itemTitle } from '../lib/i18n.js';
import { MAX_TITLE } from '../domain/model.js';
import { prefersReducedMotion } from '../lib/fx.js';
import { MissionIcon, MISSION_ICONS, iconKey } from './Art.jsx';

const EXIT_MS = 180;

/**
 * Bottom sheet (a centred dialog on desktop). Closing plays a short exit
 * before unmounting so it never just vanishes. `action` replaces the close
 * button (e.g. a "Done" button); `onClosing` runs as the exit starts,
 * `onClose` after it.
 */
export function Sheet({ title, onClose, onClosing, children, t, action, labelId }) {
  const panel = useRef(null);
  const [closing, setClosing] = useState(false);
  const done = useRef(onClose);
  done.current = onClose;
  const starting = useRef(onClosing);
  starting.current = onClosing;
  const leaving = useRef(false);
  const close = useCallback(() => {
    if (leaving.current) return;
    leaving.current = true;
    starting.current?.();
    setClosing(true);
    setTimeout(() => done.current(), prefersReducedMotion() ? 0 : EXIT_MS);
  }, []);
  useEffect(() => {
    const prev = document.activeElement;
    panel.current?.focus();
    const onKey = (e) => e.key === 'Escape' && close();
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [close]);
  return (
    <div className={`sheet-wrap ${closing ? 'closing' : ''}`} role="dialog" aria-modal="true" {...(labelId ? { 'aria-labelledby': labelId } : { 'aria-label': title })}>
      <div className="sheet-scrim" onClick={close} />
      <div ref={panel} tabIndex={-1} className="sheet safe-bottom">
        <div className="sheet-head">
          <h2 id={labelId} className="t-title flex-1">
            {title}
          </h2>
          {action ? action(close) : (
            <button type="button" onClick={close} aria-label={t('close')} className="icon-btn">
              <X size={18} />
            </button>
          )}
        </div>
        <div className="sheet-body">{typeof children === 'function' ? children(close) : children}</div>
      </div>
    </div>
  );
}

export function PlayedSheet({ t, items, minimum, onUndo, onClose }) {
  return (
    <Sheet title={t('today.doneDrawer', { n: items.length })} onClose={onClose} t={t}>
      <p className="t-meta mb-2">{t('played.hint')}</p>
      <ul className="m-0 mb-4 list-none p-0">
        {items.map((item) => (
          <li key={item.id} className="row fade-in">
            <span className="tile-ico">
              <MissionIcon kind={iconKey(item.icon || (item.kind === 'custom' ? 'star' : 'sprout'))} size={22} />
            </span>
            <span className="t-body min-w-0 flex-1">{itemTitle(t, item, minimum)}</span>
            <button type="button" onClick={() => onUndo(item.id)} className="btn btn-ghost btn-sm" data-hit="extended">
              <RotateCcw size={14} /> {t('today.undoShort')}
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

export function AddSheet({ t, onAdd, onClose }) {
  const [title, setTitle] = useState('');
  const [mini, setMini] = useState('');
  const [icon, setIcon] = useState('star');
  const input = useRef(null);
  useEffect(() => {
    const id = setTimeout(() => input.current?.focus(), 250);
    return () => clearTimeout(id);
  }, []);
  return (
    <Sheet title={t('add.title')} onClose={onClose} t={t}>
      {(close) => (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const v = title.trim();
            if (!v) return;
            onAdd(v, icon, mini.trim() || null);
            close();
          }}
          className="flex flex-col gap-4 pb-4"
        >
          <div>
            <label className="t-label mb-2 block" htmlFor="new-task">
              {t('add.label')}
            </label>
            <input
              id="new-task"
              ref={input}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('today.add')}
              maxLength={MAX_TITLE}
              enterKeyHint="done"
              autoComplete="off"
              autoCapitalize="sentences"
              className="field"
            />
          </div>
          <div>
            <label className="t-label mb-2 block" htmlFor="new-task-mini">
              {t('min.tiny')}
            </label>
            <input
              id="new-task-mini"
              value={mini}
              onChange={(e) => setMini(e.target.value)}
              placeholder={t('min.tinyPh')}
              maxLength={MAX_TITLE}
              enterKeyHint="done"
              autoComplete="off"
              className="field"
            />
          </div>
          <div>
            <p className="t-label mb-2">{t('add.icon')}</p>
            <div className="grid grid-cols-7 gap-1" role="radiogroup" aria-label={t('add.icon')}>
              {MISSION_ICONS.map((k) => (
                <button key={k} type="button" role="radio" aria-checked={icon === k} aria-label={k} onClick={() => setIcon(k)} className="pick grid aspect-square min-h-11 place-items-center">
                  <MissionIcon kind={k} size={22} />
                </button>
              ))}
            </div>
          </div>
          <button type="submit" disabled={!title.trim()} className="btn btn-primary mt-1 w-full">
            <Plus size={18} /> {t('add.cta')}
          </button>
        </form>
      )}
    </Sheet>
  );
}
