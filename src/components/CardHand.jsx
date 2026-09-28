import { useRef, useState } from 'react';
import { Check, Moon, Plus, X } from 'lucide-react';
import { itemTitle } from '../lib/i18n.js';
import { MissionIcon, iconKey } from './Art.jsx';
import { haptic, prefersReducedMotion } from '../lib/fx.js';

// Chunky collectible cards. Tap or flick a card up to play it; it lifts,
// flips and flies into the world while your companion does the mission.
const CARD_THEME = {
  tooth: ['#E0F2FE', '#7DD3FC', '#0369A1'],
  bed: ['#EDE9FE', '#A78BFA', '#5B21B6'],
  book: ['#D1FAE5', '#34D399', '#047857'],
  lotus: ['#FCE7F3', '#F472B6', '#9D174D'],
  sun: ['#FEF3C7', '#FBBF24', '#92400E'],
  water: ['#DBEAFE', '#60A5FA', '#1D4ED8'],
  breakfast: ['#FFEDD5', '#FB923C', '#9A3412'],
  shower: ['#EDE9FE', '#8B5CF6', '#4C1D95'],
  moon: ['#E0E7FF', '#818CF8', '#3730A3'],
  walk: ['#E0E7FF', '#6366F1', '#312E81'],
  heart: ['#FFE4E6', '#FB7185', '#9F1239'],
  sprout: ['#DCFCE7', '#4ADE80', '#166534'],
  star: ['#FEF9C3', '#FACC15', '#854D0E'],
};
export const themeFor = (icon) => CARD_THEME[iconKey(icon)] || CARD_THEME.star;

function Card({ item, t, onPlay, onRemove, leaving, index, minimum, xp }) {
  const [tilt, setTilt] = useState({ x: 0, y: 0, lift: 0, glare: 50 });
  const drag = useRef(null);
  const el = useRef(null);
  const flicked = useRef(-Infinity); // time of the last flick-to-play (guards the click that follows it)
  const [c1, c2, ink] = themeFor(item.icon || (item.kind === 'custom' ? 'star' : 'sprout'));
  const reduce = prefersReducedMotion();

  const onDown = (e) => {
    if (leaving) return;
    drag.current = { x: e.clientX, y: e.clientY, t: performance.now(), dy: 0 };
    haptic(5);
  };
  const onMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const r = el.current.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    d.dy = e.clientY - d.y;
    if (reduce) return;
    setTilt({ x: -py * 16, y: px * 18, lift: Math.min(0, d.dy), glare: 50 + px * 60 });
  };
  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    setTilt({ x: 0, y: 0, lift: 0, glare: 50 });
    if (!d) return;
    // A quick upward flick plays the card (taps are handled by onClick).
    if (d.dy < -55) {
      flicked.current = performance.now();
      onPlay(item.id, el.current);
    }
  };

  return (
    <li
      className={`hand-slot ${leaving ? 'leaving' : ''}`}
      style={{ '--i': index, '--rot': `${((index % 3) - 1) * 1.6}deg` }}
    >
      <div
        ref={el}
        role="button"
        tabIndex={0}
        aria-label={`${itemTitle(t, item, minimum)}, +${xp} XP`}
        onClick={() => !leaving && performance.now() - flicked.current > 500 && onPlay(item.id, el.current)}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onPlay(item.id, el.current))}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={() => {
          drag.current = null;
          setTilt({ x: 0, y: 0, lift: 0, glare: 50 });
        }}
        className="game-card"
        style={{
          transform: `translateY(${tilt.lift * 0.6}px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
          background: `linear-gradient(160deg, ${c1} 0%, #ffffff 55%, ${c1} 100%)`,
          '--edge': c2,
          '--ink': ink,
        }}
      >
        <span className="card-glare" style={{ background: `radial-gradient(circle at ${tilt.glare}% 0%, rgb(255 255 255 / .85), transparent 55%)` }} />
        <span className="card-xp" dir="ltr">
          +{xp}
        </span>
        <span className="card-art" style={{ background: `radial-gradient(circle at 40% 35%, #ffffff, ${c1} 70%)`, boxShadow: `0 6px 16px ${c2}55` }}>
          <MissionIcon kind={item.icon || 'star'} size={42} />
        </span>
        <span className="card-title">{itemTitle(t, item, minimum)}</span>
        <span className="card-foot">{item.kind === 'custom' ? t('task.custom') : t('task.daily')}</span>
      </div>
      {item.kind === 'custom' && !leaving && (
        <button type="button" className="card-x" data-hit="extended" onClick={() => onRemove(item.id)} aria-label={`${t('today.remove')}: ${itemTitle(t, item)}`}>
          <X size={13} strokeWidth={3} />
        </button>
      )}
    </li>
  );
}

export default function CardHand({ t, items, doneItems, leaving, allDone, onPlay, onRemove, onAdd, onShowDone, doneCard, bonus, minimum, onMinimum, xp }) {
  const remaining = items.filter((i) => !leaving[i.id]).length;
  return (
    <section className="hand" aria-labelledby="hand-h">
      <div className="hand-head">
        <h2 id="hand-h" className="text-[17px] font-extrabold tracking-[-0.02em] text-white drop-shadow-[0_1px_6px_rgb(20_24_60/0.45)]">
          {allDone ? t('hand.allDone') : t('hand.title', { n: remaining })}
          {!allDone && <span className="ms-2 hidden text-[12.5px] font-semibold text-white/80 min-[400px]:inline" dir="ltr">{t('today.bonusHint', { xp: bonus })}</span>}
        </h2>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onMinimum} aria-pressed={minimum} className={`min-pill ${minimum ? 'on' : ''}`}>
            <Moon size={14} strokeWidth={2.4} /> {t('min.toggle')}
          </button>
          {doneItems.length > 0 && (
            <button type="button" onClick={onShowDone} className="played-pill" aria-label={t('today.doneDrawer', { n: doneItems.length })}>
              <Check size={14} strokeWidth={3} /> {doneItems.length}
            </button>
          )}
        </div>
      </div>
      {allDone ? (
        <div className="hand-done px-4">{doneCard}</div>
      ) : (
        <ul className="hand-row" data-testid="hand">
          {items.map((item, i) => (
            <Card key={item.id} item={item} t={t} index={i} leaving={!!leaving[item.id]} onPlay={onPlay} onRemove={onRemove} minimum={minimum} xp={xp} />
          ))}
          <li className="hand-slot" style={{ '--i': items.length, '--rot': '0deg' }}>
            <button type="button" className="game-card add-card" onClick={onAdd} aria-label={t('today.addBtn')}>
              <span className="grid h-12 w-12 place-items-center rounded-full bg-white/70 text-primary-deep">
                <Plus size={26} strokeWidth={2.6} />
              </span>
              <span className="card-title text-white">{t('hand.add')}</span>
            </button>
          </li>
        </ul>
      )}
    </section>
  );
}
