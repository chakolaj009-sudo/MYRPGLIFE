export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function layer() {
  let el = document.getElementById('fx-layer');
  if (!el) {
    el = document.createElement('div');
    el.id = 'fx-layer';
    el.setAttribute('aria-hidden', 'true');
    Object.assign(el.style, { position: 'fixed', inset: '0', pointerEvents: 'none', zIndex: '60', overflow: 'hidden' });
    document.body.appendChild(el);
  }
  return el;
}

/**
 * A little wave of XP orbs that arcs from `from` to `to` (viewport points).
 * Resolves when the last orb lands (immediately with reduced motion).
 * `onHit` fires as each orb arrives so the meter can tick up visibly.
 */
export function flyXp(from, to, { count = 7, onHit } = {}) {
  if (prefersReducedMotion() || !from || !to || typeof Element.prototype.animate !== 'function') {
    return Promise.resolve();
  }
  const root = layer();
  const jobs = [];
  for (let i = 0; i < count; i++) {
    const dot = document.createElement('div');
    const size = 7 + (i % 3) * 2;
    Object.assign(dot.style, {
      position: 'absolute',
      left: '0',
      top: '0',
      width: `${size}px`,
      height: `${size}px`,
      marginLeft: `${-size / 2}px`,
      marginTop: `${-size / 2}px`,
      borderRadius: '999px',
      background: i % 3 === 2 ? '#FBBF24' : 'radial-gradient(circle at 35% 35%, #fff, #A5B4FC 45%, #6366F1 100%)',
      boxShadow: i % 3 === 2 ? '0 0 10px 2px rgb(251 191 36 / 0.6)' : '0 0 12px 4px rgb(129 140 248 / 0.55)',
      willChange: 'transform, opacity',
    });
    root.appendChild(dot);
    const jx = (Math.random() - 0.5) * 36;
    const jy = (Math.random() - 0.5) * 20;
    const x0 = from.x + jx;
    const y0 = from.y + jy;
    // Control point: lift above the straight line for a soft arc.
    const mx = (x0 + to.x) / 2 + (Math.random() - 0.5) * 60;
    const my = Math.min(y0, to.y) - 40 - Math.random() * 50;
    const anim = dot.animate(
      [
        { transform: `translate(${x0}px, ${y0}px) scale(0.3)`, opacity: 0 },
        { transform: `translate(${x0 + jx * 0.4}px, ${y0 - 14}px) scale(1.15)`, opacity: 1, offset: 0.18 },
        { transform: `translate(${mx}px, ${my}px) scale(1)`, opacity: 1, offset: 0.55 },
        { transform: `translate(${to.x}px, ${to.y}px) scale(0.45)`, opacity: 0.9 },
      ],
      { duration: 620 + i * 30, delay: i * 55, easing: 'cubic-bezier(0.45, 0, 0.25, 1)', fill: 'forwards' },
    );
    jobs.push(
      anim.finished
        .catch(() => {})
        .then(() => {
          dot.remove();
          onHit && onHit(i, count);
        }),
    );
  }
  return Promise.all(jobs).then(() => undefined);
}

/** Small star burst around an element (daily completion). */
export function sparkleBurst(el, count = 14) {
  if (!el || prefersReducedMotion()) return;
  const r = el.getBoundingClientRect();
  const root = layer();
  const colors = ['#FBBF24', '#6366F1', '#22C55E', '#F472B6', '#38BDF8'];
  for (let i = 0; i < count; i++) {
    const s = document.createElement('div');
    const a = (i / count) * Math.PI * 2 + Math.random() * 0.4;
    const d = 50 + Math.random() * 50;
    s.className = 'sparkle';
    s.textContent = i % 3 ? '•' : '✦';
    Object.assign(s.style, {
      position: 'absolute',
      left: `${r.left + r.width / 2}px`,
      top: `${r.top + 44}px`,
      color: colors[i % colors.length],
      fontSize: `${10 + (i % 3) * 4}px`,
    });
    s.style.setProperty('--dx', `${Math.cos(a) * d}px`);
    s.style.setProperty('--dy', `${Math.sin(a) * d * 0.7}px`);
    root.appendChild(s);
    setTimeout(() => s.remove(), 1200);
  }
}

/** A small "+10 XP" label that floats up from a point. */
export function floatText(at, text) {
  if (!at || prefersReducedMotion()) return;
  const el = document.createElement('div');
  el.className = 'xp-float';
  el.textContent = text;
  el.style.left = `${at.x}px`;
  el.style.top = `${at.y}px`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1150);
}

export function haptic(ms = 8) {
  try {
    navigator.vibrate && navigator.vibrate(ms);
  } catch {
    /* not supported on iOS; harmless */
  }
}
