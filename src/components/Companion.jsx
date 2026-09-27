import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { prefersReducedMotion, haptic } from '../lib/fx.js';

// Three original companions sharing one rig. Pseudo-3D turntable: each part
// sits at an angle φ around the body's vertical axis; for turn angle `a` it is
// drawn at x = R·sin(a+φ), in front of or behind the body by depth = cos(a+φ).
// Soft "3D render" look from layered gradients, a moving specular highlight,
// rim light and contact shadow — all plain SVG, no WebGL.

const RAD = Math.PI / 180;
const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const place = (a, phi, R) => {
  const t = (a + phi) * RAD;
  return { x: R * Math.sin(t), d: Math.cos(t) };
};

export const SPECIES = {
  moji: {
    // peach, round, bear-ish ears, leaf tail — earth & growth
    body: 'M0 -46 C 34 -46 58 -24 58 10 C 58 44 34 66 0 66 C -34 66 -58 44 -58 10 C -58 -24 -34 -46 0 -46 Z',
    light: '#FFE9D9', mid: '#FFC6A0', shade: '#EE9B78', deep: '#D97E5E',
    belly: '#FFF3E8', cheek: '#FF8E86', accent: '#57B97F', accentDark: '#3A9563',
    eyeY: -2, faceR: 55, bellyY: 40, neckY: 26, topY: -46, armY: 24,
  },
  luma: {
    // lavender pear, crescent-moon horn, star freckles, cloud tail — calm & night
    body: 'M0 -50 C 32 -50 52 -24 56 10 C 60 44 36 66 0 66 C -36 66 -60 44 -56 10 C -52 -24 -32 -50 0 -50 Z',
    light: '#F6F2FF', mid: '#D9CEFF', shade: '#AE9CF2', deep: '#8C77DB',
    belly: '#FBF9FF', cheek: '#F9A8D4', accent: '#FFD66B', accentDark: '#F2B233',
    eyeY: 2, faceR: 54, bellyY: 42, neckY: 28, topY: -50, armY: 28,
  },
  nori: {
    // aqua droplet spirit, fin ears, curled tip, bubble — water & flow
    body: 'M0 -58 C 18 -40 58 -16 58 16 C 58 48 32 66 0 66 C -32 66 -58 48 -58 16 C -58 -16 -18 -40 0 -58 Z',
    light: '#E9FFFB', mid: '#9FE6DC', shade: '#4FC2B6', deep: '#2F9E96',
    belly: '#F2FFFC', cheek: '#FF9EB0', accent: '#7CC7FF', accentDark: '#3D9BE9',
    eyeY: 8, faceR: 55, bellyY: 44, neckY: 30, topY: -44, armY: 30,
  },
};
export const SPECIES_IDS = Object.keys(SPECIES);

const WEAR = {
  scarf: '#F26D7D', scarfDark: '#C9485A',
  pack: '#F7B84B', packDark: '#D98E1E',
  beanie: '#6C7BF0', beanieBand: '#4E59CF',
  cape: '#4F46E5', capeDark: '#3730A3',
};

function Eye({ x, y, squish, mood }) {
  const u = useId().replace(/:/g, '');
  if (mood === 'happy')
    return <path d={`M${x - 8} ${y + 2} Q ${x} ${y - 9} ${x + 8} ${y + 2}`} stroke="#2B2140" strokeWidth="3.6" fill="none" strokeLinecap="round" />;
  if (mood === 'calm')
    return <path d={`M${x - 7.5} ${y - 1} Q ${x} ${y + 6} ${x + 7.5} ${y - 1}`} stroke="#2B2140" strokeWidth="3.2" fill="none" strokeLinecap="round" />;
  if (mood === 'dizzy')
    return <path d={`M${x} ${y} m-6 0 a6 6 0 1 1 6 6 a3.5 3.5 0 1 1 -3.5 -3.5`} stroke="#2B2140" strokeWidth="2.5" fill="none" strokeLinecap="round" />;
  if (mood === 'excited')
    return (
      <path
        transform={`translate(${x} ${y}) scale(${squish} 1)`}
        d="M0 -10 L2.6 -3 L10 -2.6 L4.2 2 L6.2 9.4 L0 5.2 L-6.2 9.4 L-4.2 2 L-10 -2.6 L-2.6 -3 Z"
        fill="#2B2140"
      />
    );
  return (
    <g className="buddy-eye">
      <defs>
        <radialGradient id={`iris${u}`} cx=".5" cy=".75" r=".75">
          <stop offset="0" stopColor="#6A58A8" />
          <stop offset=".55" stopColor="#35295A" />
          <stop offset="1" stopColor="#1E1633" />
        </radialGradient>
      </defs>
      <ellipse cx={x} cy={y} rx={9 * squish} ry={11.5} fill={`url(#iris${u})`} />
      <ellipse cx={x - 2.4 * squish} cy={y - 4.4} rx={3.7 * squish} ry={4.1} fill="#fff" />
      <circle cx={x + 3 * squish} cy={y + 4} r={1.5 * squish} fill="#fff" opacity=".85" />
    </g>
  );
}

/** Pure drawing — used by the interactive companion and the picker. */
export function CompanionArt({ species = 'moji', a = 0, mood = 'idle', wear = [], size = 150, silhouette = false }) {
  const sp = SPECIES[species] || SPECIES.moji;
  const u = useId().replace(/:/g, '');
  const s = Math.sin(a * RAD);
  const c = Math.cos(a * RAD);
  const front = [];
  const back = [];
  const put = (depth, node) => (depth > 0 ? front : back).push(node);
  const fill = (v) => (silhouette ? '#C9CDE3' : v);

  // Arms (small nubs)
  [-82, 82].forEach((phi) => {
    const p = place(a, phi, 55);
    put(
      p.d,
      <ellipse key={`arm${phi}`} cx={p.x} cy={sp.armY} rx={9.5} ry={13.5} fill={fill(sp.shade)} transform={`rotate(${phi > 0 ? -20 : 20} ${p.x} ${sp.armY})`} />,
    );
  });

  // Species tail (back)
  const tail = place(a, 180, 50);
  const tailScale = 0.5 + 0.5 * Math.abs(Math.sin((a + 180) * RAD)) + 0.15;
  if (species === 'moji') {
    put(
      tail.d - 0.05,
      <g key="tail" transform={`translate(${tail.x} 46) scale(${tailScale} 1)`}>
        <path d="M0 0 C 14 -6 24 -18 22 -30 C 8 -28 -2 -16 0 0 Z" fill={fill(sp.accent)} />
        <path d="M1 -2 C 8 -10 14 -18 18 -26" stroke="#fff" strokeOpacity=".5" strokeWidth="1.5" fill="none" />
      </g>,
    );
  } else if (species === 'luma') {
    put(
      tail.d - 0.05,
      <g key="tail" transform={`translate(${tail.x} 48) scale(${tailScale} 1)`} fill={fill('#FFFFFF')}>
        <circle cx="0" cy="0" r="11" /><circle cx="10" cy="-6" r="8" /><circle cx="-9" cy="-5" r="7" />
      </g>,
    );
  } else {
    put(
      tail.d - 0.05,
      <path key="tail" transform={`translate(${tail.x} 52) scale(${tailScale} 1)`} d="M0 -4 C 10 -2 20 4 24 14 C 14 14 4 10 0 4 Z" fill={fill(sp.shade)} />,
    );
  }

  // Cape (level 9)
  if (wear.includes('cape')) {
    const p = place(a, 180, 26);
    const w = 0.55 + 0.45 * Math.abs(p.d);
    put(
      p.d,
      <g key="cape" transform={`translate(${p.x * 0.5} 0) scale(${w} 1)`}>
        <path d={`M-50 ${sp.neckY - 38} Q 0 ${sp.neckY - 50} 50 ${sp.neckY - 38} L 66 64 Q 0 76 -66 64 Z`} fill={fill(WEAR.cape)} />
        <path d={`M-50 ${sp.neckY - 38} Q 0 ${sp.neckY - 50} 50 ${sp.neckY - 38} L 54 ${sp.neckY - 24} Q 0 ${sp.neckY - 36} -54 ${sp.neckY - 24} Z`} fill={fill(WEAR.capeDark)} />
        {p.d > 0 && !silhouette && (
          <g fill="#FFE39A">
            <path d="M-20 22 l3 6 6 1 -5 4 1 6 -5 -3 -5 3 1 -6 -5 -4 6 -1z" />
            <path d="M18 36 l2 4 4 .6 -3 3 .8 4 -3.8 -2 -3.8 2 .8 -4 -3 -3 4 -.6z" />
            <circle cx="4" cy="8" r="2" />
          </g>
        )}
      </g>,
    );
  }

  // Backpack (level 4)
  if (wear.includes('backpack')) {
    const p = place(a, 180, 42);
    const w = 0.25 + 0.75 * Math.abs(p.d);
    put(
      p.d,
      <g key="pack" transform={`translate(${p.x} 24) scale(${w} 1)`}>
        <rect x="-26" y="-24" width="52" height="54" rx="17" fill={fill(WEAR.pack)} />
        <rect x="-18" y="6" width="36" height="20" rx="8" fill={fill(WEAR.packDark)} />
        <circle cx="0" cy="-6" r="4.5" fill={fill('#FFF3C4')} />
      </g>,
    );
  }

  // Head features
  const heads = [];
  if (species === 'moji') {
    [-44, 44].forEach((phi) => {
      const p = place(a, phi, 40);
      heads.push(
        <g key={`ear${phi}`} transform={`translate(${p.x} -40)`}>
          <ellipse rx={15 * (0.6 + 0.4 * Math.abs(p.d))} ry={16} fill={fill(sp.shade)} />
          {p.d > 0.1 && !silhouette && <ellipse rx={8 * p.d} ry={9} fill="#F59C92" />}
        </g>,
      );
    });
  } else if (species === 'nori') {
    [-74, 74].forEach((phi) => {
      const p = place(a, phi, 54);
      const dir = Math.sign(p.x || (phi > 0 ? 1 : -1));
      heads.push(
        <path
          key={`fin${phi}`}
          transform={`translate(${p.x} -6) scale(${dir * (0.4 + 0.6 * Math.abs(Math.sin((a + phi) * RAD)))} 1)`}
          d="M0 -6 C 14 -18 26 -18 30 -12 C 24 -6 16 2 0 8 Z"
          fill={fill(sp.shade)}
        />,
      );
    });
  }

  const faceOn = clamp(c * 3 - 0.3);
  const bellyOn = clamp(c * 3);
  const squish = 0.35 + 0.65 * clamp(c);
  const eyeL = place(a, -26, sp.faceR);
  const eyeR = place(a, 26, sp.faceR);
  const mouth = place(a, 0, sp.faceR + 2);
  const cheekL = place(a, -44, sp.faceR);
  const cheekR = place(a, 44, sp.faceR);
  const my = sp.eyeY + 14;

  const beanie = wear.includes('beanie');
  const topFeature = () => {
    const tip = place(a, 0, 6);
    if (species === 'luma') {
      const y = sp.topY + (beanie ? -20 : -2);
      return (
        <g key="horn" transform={`translate(${tip.x} ${y})`}>
          <path d="M-9 0 C -12 -14 -4 -24 6 -26 C -2 -20 -3 -10 4 -2 C 0 0 -5 1 -9 0 Z" fill={fill(sp.accent)} />
          {!silhouette && <path d="M-6 -4 C -8 -12 -4 -18 1 -21" stroke="#fff" strokeOpacity=".7" strokeWidth="1.6" fill="none" strokeLinecap="round" />}
        </g>
      );
    }
    if (species === 'nori') {
      return (
        <path
          key="curl"
          transform={`translate(${tip.x} 0)`}
          d="M0 -58 C 4 -66 12 -70 16 -66 C 19 -63 16 -58 12 -60"
          stroke={fill(sp.shade)}
          strokeWidth="6"
          fill="none"
          strokeLinecap="round"
        />
      );
    }
    return null;
  };

  return (
    <svg viewBox="-92 -112 184 196" width={size} height={size * (196 / 184)} aria-hidden="true" style={{ overflow: 'visible' }}>
      <defs>
        <radialGradient id={`body${u}`} cx={0.4 - s * 0.2} cy="0.32" r="0.78">
          <stop offset="0" stopColor={fill(sp.light)} />
          <stop offset="0.5" stopColor={fill(sp.mid)} />
          <stop offset="0.88" stopColor={fill(sp.shade)} />
          <stop offset="1" stopColor={fill(sp.deep)} />
        </radialGradient>
        <linearGradient id={`ao${u}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.6" stopColor={sp.deep} stopOpacity="0" />
          <stop offset="1" stopColor={sp.deep} stopOpacity=".35" />
        </linearGradient>
        <clipPath id={`clip${u}`}>
          <path d={sp.body} />
        </clipPath>
      </defs>
      <ellipse cx="0" cy="70" rx="48" ry="7" fill="#1E1B4B" opacity=".14" />
      {heads}
      {back}
      {[-30, 30].map((phi) => {
        const p = place(a, phi, 34);
        return <ellipse key={`foot${phi}`} cx={p.x} cy={63} rx={15} ry={9} fill={fill(sp.shade)} />;
      })}
      <path d={sp.body} fill={`url(#body${u})`} />
      {!silhouette && (
        <g clipPath={`url(#clip${u})`}>
          <rect x="-70" y="-70" width="140" height="140" fill={`url(#ao${u})`} />
          <ellipse cx={s * 22} cy={sp.bellyY} rx={30 * bellyOn} ry={20} fill={sp.belly} opacity={bellyOn * 0.95} />
          {/* specular highlight slides as the body turns */}
          <ellipse cx={-20 - s * 26} cy={sp.topY + 24} rx="15" ry="9" fill="#fff" opacity=".55" transform={`rotate(-24 ${-20 - s * 26} ${sp.topY + 24})`} />
          <path d={sp.body} fill="none" stroke="#fff" strokeOpacity=".35" strokeWidth="3" transform="translate(1.5 1.5) scale(.97)" />
        </g>
      )}
      {!silhouette && faceOn > 0 && (
        <g opacity={faceOn}>
          <Eye x={eyeL.x} y={sp.eyeY} squish={squish} mood={mood} />
          <Eye x={eyeR.x} y={sp.eyeY} squish={squish} mood={mood} />
          {species === 'luma' ? (
            [cheekL, cheekR].map((p, i) => (
              <path
                key={i}
                transform={`translate(${p.x} ${my - 4}) scale(${clamp(p.d)} 1)`}
                d="M0 -4 L1.2 -1.2 L4 0 L1.2 1.2 L0 4 L-1.2 1.2 L-4 0 L-1.2 -1.2 Z"
                fill={sp.accentDark}
                opacity=".9"
              />
            ))
          ) : (
            <>
              <ellipse cx={cheekL.x} cy={my - 4} rx={8 * clamp(cheekL.d)} ry={5} fill={sp.cheek} opacity=".5" />
              <ellipse cx={cheekR.x} cy={my - 4} rx={8 * clamp(cheekR.d)} ry={5} fill={sp.cheek} opacity=".5" />
            </>
          )}
          {mood === 'happy' || mood === 'excited' || mood === 'dizzy' ? (
            <path d={`M${mouth.x - 7} ${my - 1} Q ${mouth.x} ${my + 11} ${mouth.x + 7} ${my - 1} Z`} fill="#8C3B4B" />
          ) : (
            <path d={`M${mouth.x - 5 * squish} ${my} Q ${mouth.x} ${my + 6} ${mouth.x + 5 * squish} ${my}`} stroke="#2B2140" strokeWidth="2.6" fill="none" strokeLinecap="round" />
          )}
        </g>
      )}
      {wear.includes('scarf') && (
        <g>
          <path d={`M-55 ${sp.neckY - 2} Q 0 ${sp.neckY + 18} 55 ${sp.neckY - 2} L 53 ${sp.neckY + 9} Q 0 ${sp.neckY + 29} -53 ${sp.neckY + 9} Z`} fill={fill(WEAR.scarf)} />
          {(() => {
            const k = place(a, 38, 50);
            return k.d > -0.2 ? (
              <rect x={k.x - 7} y={sp.neckY + 10} width="14" height="24" rx="5" fill={fill(WEAR.scarfDark)} opacity={clamp(k.d * 3 + 0.6)} transform={`rotate(-8 ${k.x} ${sp.neckY + 10})`} />
            ) : null;
          })()}
        </g>
      )}
      {front}
      {beanie && (
        <g>
          <path d={`M-38 ${sp.topY + 14} Q -36 ${sp.topY - 22} 0 ${sp.topY - 24} Q 36 ${sp.topY - 22} 38 ${sp.topY + 14} Z`} fill={fill(WEAR.beanie)} />
          <rect x="-42" y={sp.topY + 8} width="84" height="13" rx="6.5" fill={fill(WEAR.beanieBand)} />
          {species !== 'nori' && species !== 'luma' && <circle cx={s * 10} cy={sp.topY - 26} r="8" fill={fill('#fff')} />}
        </g>
      )}
      {topFeature()}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Interactive companion: tap reactions, drag to turn, idle life.

export default function Companion({ species = 'moji', label, sayings, wear = [], cheer = 0, celebrate = 0, greet = null, size = 154 }) {
  const [angle, setAngle] = useState(0);
  const [mood, setMood] = useState('idle');
  const [anim, setAnim] = useState('');
  const [bubble, setBubble] = useState(null);
  const angleRef = useRef(0);
  const drag = useRef(null);
  const raf = useRef(0);
  const timers = useRef([]);
  const last = useRef(-1);

  const setA = (v) => {
    angleRef.current = v;
    setAngle(v);
  };
  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms));
  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  const stopAnim = () => cancelAnimationFrame(raf.current);

  useEffect(() => () => (stopAnim(), clearTimers()), []);

  // A soft hello once when the app opens.
  useEffect(() => {
    if (!greet) return;
    const id = setTimeout(() => {
      setBubble({ text: greet, id: Math.random() });
      setMood('happy');
      setTimeout(() => setMood((m) => (m === 'happy' ? 'idle' : m)), 1200);
      setTimeout(() => setBubble((b) => (b && b.text === greet ? null : b)), 2600);
    }, 700);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Idle life: now and then close the eyes for a calm little breath.
  useEffect(() => {
    let id;
    const tick = () => {
      id = setTimeout(() => {
        setMood((m) => (m === 'idle' ? 'calm' : m));
        setTimeout(() => setMood((m) => (m === 'calm' ? 'idle' : m)), 1100);
        tick();
      }, 8000 + Math.random() * 7000);
    };
    tick();
    return () => clearTimeout(id);
  }, []);

  const say = (text, ms = 1500) => {
    setBubble({ text, id: Math.random() });
    later(() => setBubble(null), ms);
  };

  const tweenTo = useCallback((target, ms, done) => {
    stopAnim();
    const from = angleRef.current;
    const t0 = performance.now();
    const step = (t) => {
      const k = clamp((t - t0) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      setA(from + (target - from) * e);
      if (k < 1) raf.current = requestAnimationFrame(step);
      else {
        setA(target % 360);
        done && done();
      }
    };
    raf.current = requestAnimationFrame(step);
  }, []);

  const settleHome = useCallback(() => tweenTo(Math.round(angleRef.current / 360) * 360, 650), [tweenTo]);

  const play = (cls, moodDuring, ms = 800) => {
    setMood(moodDuring);
    setAnim('');
    requestAnimationFrame(() => setAnim(cls));
    later(() => {
      setAnim('');
      setMood('idle');
    }, ms);
  };

  const react = useCallback(() => {
    haptic(10);
    clearTimers();
    const options = ['boing', 'wiggle', 'twirl', 'breathe'];
    let i = Math.floor(Math.random() * options.length);
    if (i === last.current) i = (i + 1) % options.length;
    last.current = i;
    const r = options[i];
    if (r === 'breathe') {
      say(sayings.breathe, 2400);
      setMood('calm');
      if (!prefersReducedMotion()) {
        setAnim('');
        requestAnimationFrame(() => setAnim('buddy-breathe'));
      }
      later(() => {
        setAnim('');
        setMood('idle');
      }, 2600);
      return;
    }
    say(sayings.tap[Math.floor(Math.random() * sayings.tap.length)]);
    if (prefersReducedMotion()) {
      setMood('happy');
      later(() => setMood('idle'), 900);
    } else if (r === 'twirl') {
      setMood('happy');
      tweenTo(Math.round(angleRef.current / 360) * 360 + 360, 800, () => {
        setMood('dizzy');
        later(() => setMood('idle'), 900);
      });
    } else play(r === 'boing' ? 'buddy-boing' : 'buddy-wiggle', r === 'boing' ? 'happy' : 'excited');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sayings, tweenTo]);

  useEffect(() => {
    if (!cheer) return;
    clearTimers();
    say(sayings.cheer[Math.floor(Math.random() * sayings.cheer.length)], 1200);
    if (prefersReducedMotion()) {
      setMood('happy');
      later(() => setMood('idle'), 800);
    } else play('buddy-boing', 'happy', 760);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cheer]);

  useEffect(() => {
    if (!celebrate) return;
    clearTimers();
    say(sayings.allDone, 2600);
    if (prefersReducedMotion()) {
      setMood('excited');
      later(() => setMood('idle'), 1800);
    } else play('buddy-cheer', 'excited', 1800);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [celebrate]);

  const onPointerDown = (e) => {
    stopAnim();
    drag.current = { x: e.clientX, y: e.clientY, a: angleRef.current, moved: false, lx: e.clientX, lt: performance.now(), v: 0 };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    if (!d.moved && Math.abs(dx) > 7 && Math.abs(dx) > Math.abs(e.clientY - d.y)) d.moved = true;
    if (!d.moved) return;
    const now = performance.now();
    d.v = (e.clientX - d.lx) / Math.max(1, now - d.lt);
    d.lx = e.clientX;
    d.lt = now;
    setA(d.a + dx * 1.15);
  };
  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (!d.moved) return react();
    let v = prefersReducedMotion() ? 0 : d.v * 18;
    const step = () => {
      v *= 0.93;
      setA(angleRef.current + v);
      if (Math.abs(v) > 0.3) raf.current = requestAnimationFrame(step);
      else later(settleHome, 1400);
    };
    raf.current = requestAnimationFrame(step);
  };
  const onKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      react();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      stopAnim();
      clearTimers();
      setA(angleRef.current + (e.key === 'ArrowLeft' ? -30 : 30));
      later(settleHome, 2000);
    }
  };

  return (
    <div className="companion-wrap">
      {bubble && (
        <div key={bubble.id} className="bubble" role="status">
          <svg viewBox="0 0 24 24" className="spark" aria-hidden="true">
            <path d="M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z" fill="#F5A524" />
          </svg>
          <span>{bubble.text}</span>
        </div>
      )}
      <div
        role="button"
        tabIndex={0}
        aria-label={label}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          drag.current = null;
          later(settleHome, 600);
        }}
        onKeyDown={onKeyDown}
        className="companion"
      >
        <div className="buddy-idle">
          <div className={anim}>
            <CompanionArt species={species} a={angle} mood={mood} wear={wear} size={size} />
          </div>
        </div>
        {species === 'nori' && <span className="nori-bubble" aria-hidden="true" />}
      </div>
    </div>
  );
}
