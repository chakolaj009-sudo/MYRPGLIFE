import { useEffect, useRef, useState } from 'react';
import { Plus, RotateCcw, X } from 'lucide-react';
import { itemTitle } from '../lib/i18n.js';
import { MAX_TITLE } from '../domain/model.js';
import { MissionIcon, MISSION_ICONS, MISSION_TINT, iconKey } from './Art.jsx';

export function Sheet({ title, onClose, children, t }) {
  const panel = useRef(null);
  useEffect(() => {
    const prev = document.activeElement;
    panel.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="fade-in absolute inset-0 bg-[#121735]/40" onClick={onClose} />
      <div ref={panel} tabIndex={-1} className="sheet-up safe-bottom relative max-h-[86dvh] w-full max-w-md overflow-y-auto rounded-t-[28px] bg-bg px-4 pt-3 shadow-2xl focus:outline-none">
        <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-line" />
        <div className="mb-3 flex items-center">
          <h2 className="flex-1 text-xl font-extrabold tracking-[-0.02em]">{title}</h2>
          <button type="button" onClick={onClose} aria-label={t('close')} className="grid h-11 w-11 place-items-center rounded-full bg-card text-ink2 shadow-sm">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function PlayedSheet({ t, items, minimum, onUndo, onClose }) {
  return (
    <Sheet title={t('today.doneDrawer', { n: items.length })} onClose={onClose} t={t}>
      <p className="mb-3 text-[13px] text-ink2">{t('played.hint')}</p>
      <ul className="m-0 mb-3 list-none space-y-2 p-0">
        {items.map((item) => {
          const k = iconKey(item.icon || (item.kind === 'custom' ? 'star' : 'sprout'));
          return (
            <li key={item.id} className="card flex items-center gap-3 px-3 py-2.5">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[13px]" style={{ background: MISSION_TINT[k] }}>
                <MissionIcon kind={k} size={24} />
              </span>
              <span className="min-w-0 flex-1 text-[15px] font-semibold">{itemTitle(t, item, minimum)}</span>
              <button type="button" onClick={() => onUndo(item.id)} className="flex min-h-11 items-center gap-1.5 rounded-full bg-bg px-3 text-sm font-semibold text-ink2">
                <RotateCcw size={15} /> {t('today.undoShort')}
              </button>
            </li>
          );
        })}
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
  const submit = (e) => {
    e.preventDefault();
    const v = title.trim();
    if (!v) return;
    onAdd(v, icon, mini.trim() || null);
    onClose();
  };
  return (
    <Sheet title={t('add.title')} onClose={onClose} t={t}>
      <form onSubmit={submit}>
        <label className="sr-only" htmlFor="new-task">
          {t('today.add')}
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
          className="h-14 w-full rounded-2xl bg-card px-4 text-base text-ink shadow-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <label className="eyebrow mb-2 mt-4 block" htmlFor="new-task-mini">
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
          className="h-12 w-full rounded-2xl bg-card px-4 text-base text-ink shadow-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <p className="eyebrow mb-2 mt-4">{t('add.icon')}</p>
        <div className="grid grid-cols-7 gap-1.5" role="radiogroup" aria-label={t('add.icon')}>
          {MISSION_ICONS.map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={icon === k}
              aria-label={k}
              onClick={() => setIcon(k)}
              className={`grid aspect-square min-h-11 place-items-center rounded-[13px] ${icon === k ? 'ring-2 ring-primary' : ''}`}
              style={{ background: MISSION_TINT[k] }}
            >
              <MissionIcon kind={k} size={22} />
            </button>
          ))}
        </div>
        <button
          type="submit"
          disabled={!title.trim()}
          className="mb-3 mt-5 flex h-13 min-h-12 w-full items-center justify-center gap-2 rounded-2xl text-base font-bold text-white shadow-[0_8px_20px_rgb(79_70_229/0.35)] disabled:opacity-40"
          style={{ background: 'linear-gradient(135deg,#8B93FF,#4F46E5)' }}
        >
          <Plus size={20} /> {t('add.cta')}
        </button>
      </form>
    </Sheet>
  );
}
