import { useRef, useState } from 'react';
import { Check, Plus, X } from 'lucide-react';
import { itemTitle } from '../lib/i18n.js';
import { MissionIcon } from './Art.jsx';
import { haptic, prefersReducedMotion } from '../lib/fx.js';

// Today's tasks. The first one is "up next" and carries the weight; tap it or
// flick it up to play it into the world while the companion does the mission.
function Card({ item, t, onPlay, onRemove, leaving, index, primary, minimum, xp }) {
  const [lift, setLift] = useState(0);
  const drag = useRef(null);
  const el = useRef(null);
  const flicked = useRef(-Infinity); // time of the last flick-to-play (guards the click that follows it)
  const reduce = prefersReducedMotion();

  const onDown = (e) => {
    if (leaving) return;
    drag.current = { y: e.clientY, dy: 0 };
    haptic(5);
  };
  const onMove = (e) => {
    const d = drag.current;
    if (!d) return;
    d.dy = e.clientY - d.y;
    if (!reduce) setLift(Math.max(-40, Math.min(0, d.dy)) * 0.5);
  };
  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    setLift(0);
    if (!d) return;
    // A quick upward flick plays the card (taps are handled by onClick).
    if (d.dy < -55) {
      flicked.current = performance.now();
      onPlay(item.id, el.current);
    }
  };
  const title = itemTitle(t, item, minimum);
  const swapKey = minimum ? 'm' : 'f';

  return (
    <li className={`hand-slot ${primary ? 'primary' : ''} ${leaving ? 'leaving' : ''}`} style={{ '--i': index }}>
      <div
        ref={el}
        role="button"
        tabIndex={0}
        aria-label={`${title}, +${xp} XP`}
        onClick={() => !leaving && performance.now() - flicked.current > 500 && onPlay(item.id, el.current)}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onPlay(item.id, el.current))}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={() => {
          drag.current = null;
          setLift(0);
        }}
        className={`game-card ${lift ? 'dragging' : ''}`}
        style={lift ? { transform: `translateY(${lift}px)` } : undefined}
      >
        <span className="card-art">
          <MissionIcon kind={item.icon || (item.kind === 'custom' ? 'star' : 'sprout')} size={24} />
        </span>
        <span className="card-body">
          <span key={swapKey} className="card-title swap" style={{ '--i': index }}>
            {title}
          </span>
          <span className="card-meta">
            <span className="card-foot">{primary ? t('hand.next') : item.kind === 'custom' ? t('task.custom') : t('task.daily')}</span>
            <span key={swapKey} className="card-xp swap" dir="ltr" style={{ '--i': index }}>
              +{xp}
            </span>
          </span>
        </span>
      </div>
      {item.kind === 'custom' && !leaving && (
        <button type="button" className="card-x" data-hit="extended" onClick={() => onRemove(item.id)} aria-label={`${t('today.remove')}: ${itemTitle(t, item)}`}>
          <X size={14} strokeWidth={2.4} />
        </button>
      )}
    </li>
  );
}

export default function CardHand({ t, items, doneItems, leaving, allDone, onPlay, onRemove, onAdd, onShowDone, doneCard, bonus, minimum, onMinimum, xp }) {
  const remaining = items.filter((i) => !leaving[i.id]).length;
  const primaryId = items.find((i) => !leaving[i.id])?.id;
  return (
    <section className="hand" aria-labelledby="hand-h">
      <div className="hand-inner">
        <div className="hand-head">
          <div className="min-w-0">
            <h2 id="hand-h" className="t-title">
              {allDone ? t('hand.allDone') : remaining ? t('hand.title', { n: remaining }) : t('hand.none')}
            </h2>
            {!allDone && remaining > 0 && (
              <p className="t-meta num" dir="auto">
                {t('hand.bonus', { xp: bonus })}
              </p>
            )}
          </div>
          <div className="hand-actions">
            {doneItems.length > 0 && (
              <button key={doneItems.length} type="button" onClick={onShowDone} className="done-btn" data-hit="extended" aria-label={t('today.doneDrawer', { n: doneItems.length })}>
                <Check size={14} strokeWidth={2.6} /> {doneItems.length}
              </button>
            )}
            <button type="button" onClick={onMinimum} aria-pressed={minimum} className={`min-toggle ${minimum ? 'on' : ''}`} data-hit="extended">
              {t('min.toggle')}
              <span className="track" aria-hidden="true" />
            </button>
          </div>
        </div>
        {allDone ? (
          <div className="hand-done">{doneCard}</div>
        ) : (
          <>
            {!remaining && <p className="hand-empty t-meta">{t('hand.empty')}</p>}
            <ul className="hand-row" data-testid="hand">
              {items.map((item, i) => (
                <Card key={item.id} item={item} t={t} index={i} primary={item.id === primaryId} leaving={!!leaving[item.id]} onPlay={onPlay} onRemove={onRemove} minimum={minimum} xp={xp} />
              ))}
              <li className="hand-slot" style={{ '--i': items.length }}>
                <button type="button" className="game-card add-card" onClick={onAdd} aria-label={t('today.addBtn')}>
                  <span className="card-art">
                    <Plus size={18} strokeWidth={2.2} />
                  </span>
                  <span className="card-body">
                    <span className="card-title">{t('hand.add')}</span>
                  </span>
                </button>
              </li>
            </ul>
          </>
        )}
      </div>
    </section>
  );
}
