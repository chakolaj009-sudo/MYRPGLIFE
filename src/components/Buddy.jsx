import { useCallback, useEffect, useRef, useState } from 'react';
import { prefersReducedMotion, haptic } from '../lib/fx.js';

// "Moji" — an original little companion. Pseudo-3D turntable: every part sits
// at an angle φ around the body's vertical axis; for the current turn angle we
// place it at x = R·sin(a+φ) and draw it in front of or behind the body based
// on depth = cos(a+φ). Cheap (a few dozen SVG nodes), no WebGL.

const RAD = Math.PI / 180;
const place = (a, phi, R) => {
  const t = (a + phi) * RAD;
  return { x: R * Math.sin(t), d: Math.cos(t) };
};
const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

const C = {
  body: '#FFC7A1',
  bodyShade: '#F2A27C',
  belly: '#FFF0E0',
  ear: '#F59C92',
  eye: '#3A2C27',
  cheek: '#FF8E86',
  scarf: '#E86F6F',
  scarfDark: '#C75555',
  pack: '#6DB58B',
  packDark: '#4E946D',
  beanie: '#6FA8DC',
  beanieBand: '#4F87BD',
  cape: '#5C5FB8',
  capeDark: '#474A99',
};

function Parts({ a, mood, wear }) {
  const s = Math.sin(a * RAD);
  const c = Math.cos(a * RAD);
  const front = [];
  const back = [];
  const put = (depth, node) => (depth > 0 ? front : back).push(node);

  // Arms
  [-84, 84].forEach((phi) => {
    const p = place(a, phi, 55);
    put(
      p.d,
      <ellipse key={`arm${phi}`} cx={p.x} cy={20} rx={10} ry={15} fill={C.bodyShade}
        transform={`rotate(${phi > 0 ? -18 : 18} ${p.x} 20)`} />,
    );
  });

  // Leaf tail
  const tail = place(a, 180, 52);
  put(
    tail.d - 0.05,
    <g key="tail" transform={`translate(${tail.x} 44) scale(${0.45 + 0.55 * Math.abs(Math.sin((a + 180) * RAD)) + 0.2}, 1)`}>
      <path d="M0 0 C 14 -6 24 -18 22 -30 C 8 -28 -2 -16 0 0 Z" fill="var(--leaf)" />
      <path d="M1 -2 C 8 -10 14 -18 18 -26" stroke="#fff" strokeOpacity=".5" strokeWidth="1.5" fill="none" />
    </g>,
  );

  // Cape (level 9)
  if (wear.includes('cape')) {
    const p = place(a, 180, 26);
    const w = 0.55 + 0.45 * Math.abs(p.d);
    put(
      p.d,
      <g key="cape" transform={`translate(${p.x * 0.5} 0) scale(${w} 1)`}>
        <path d="M-50 -18 Q 0 -30 50 -18 L 66 62 Q 0 74 -66 62 Z" fill={C.cape} />
        <path d="M-50 -18 Q 0 -30 50 -18 L 54 -4 Q 0 -16 -54 -4 Z" fill={C.capeDark} />
        {p.d > 0 && (
          <g fill="#FFE39A">
            <path d="M-20 20 l3 6 6 1 -5 4 1 6 -5 -3 -5 3 1 -6 -5 -4 6 -1z" />
            <path d="M18 34 l2 4 4 .6 -3 3 .8 4 -3.8 -2 -3.8 2 .8 -4 -3 -3 4 -.6z" />
            <circle cx="4" cy="8" r="2" />
          </g>
        )}
      </g>,
    );
  }

  // Backpack (level 4)
  if (wear.includes('backpack')) {
    const p = place(a, 180, 40);
    const w = 0.25 + 0.75 * Math.abs(p.d);
    put(
      p.d,
      <g key="pack" transform={`translate(${p.x} 22) scale(${w} 1)`}>
        <rect x="-26" y="-26" width="52" height="54" rx="16" fill={C.pack} />
        <rect x="-18" y="4" width="36" height="20" rx="8" fill={C.packDark} />
        <circle cx="0" cy="-8" r="4" fill="#FFE39A" />
      </g>,
    );
  }

  const bellyOn = clamp(c * 3);
  const faceOn = clamp(c * 3 - 0.3);
  const eyeX = (phi) => place(a, phi, 50);
  const eyeL = eyeX(-24);
  const eyeR = eyeX(24);
  const mouth = place(a, 0, 52);
  const cheekL = place(a, -42, 52);
  const cheekR = place(a, 42, 52);
  const squish = 0.35 + 0.65 * clamp(c);

  const eye = (p, key) => {
    if (mood === 'happy')
      return <path key={key} d={`M${p.x - 7} -4 Q ${p.x} -13 ${p.x + 7} -4`} stroke={C.eye} strokeWidth="3.5" fill="none" strokeLinecap="round" />;
    if (mood === 'dizzy')
      return (
        <path key={key} d={`M${p.x} -6 m-6 0 a6 6 0 1 1 6 6 a3.5 3.5 0 1 1 -3.5 -3.5`} stroke={C.eye} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      );
    return (
      <g key={key} className="buddy-eye">
        <ellipse cx={p.x} cy={-6} rx={6.5 * squish} ry={8} fill={C.eye} />
        <circle cx={p.x + 2 * squish} cy={-9} r={2.4 * squish} fill="#fff" />
      </g>
    );
  };

  return (
    <>
      {/* ears (always behind the head) */}
      {[-46, 46].map((phi) => {
        const p = place(a, phi, 40);
        return (
          <g key={`ear${phi}`} transform={`translate(${p.x} -46)`}>
            <ellipse rx={15 * (0.6 + 0.4 * Math.abs(p.d))} ry={16} fill={C.bodyShade} />
            {p.d > 0.1 && <ellipse rx={8 * p.d} ry={9} fill={C.ear} />}
          </g>
        );
      })}
      {back}
      {/* feet */}
      {[-30, 30].map((phi) => {
        const p = place(a, phi, 34);
        return <ellipse key={`foot${phi}`} cx={p.x} cy={62} rx={15} ry={9} fill={C.bodyShade} />;
      })}
      {/* body */}
      <ellipse cx="0" cy="10" rx="58" ry="56" fill="url(#moji-body)" />
      <ellipse cx={s * 22} cy={38} rx={30 * bellyOn} ry={20} fill={C.belly} opacity={bellyOn} />
      {/* face */}
      {faceOn > 0 && (
      <g opacity={faceOn}>
        {eye(eyeL, 'el')}
        {eye(eyeR, 'er')}
        <ellipse cx={cheekL.x} cy={8} rx={8 * clamp(cheekL.d)} ry={5} fill={C.cheek} opacity=".55" />
        <ellipse cx={cheekR.x} cy={8} rx={8 * clamp(cheekR.d)} ry={5} fill={C.cheek} opacity=".55" />
        {mood === 'happy' || mood === 'dizzy' ? (
          <path d={`M${mouth.x - 7} 9 Q ${mouth.x} 21 ${mouth.x + 7} 9 Z`} fill="#8C3B3B" />
        ) : (
          <path d={`M${mouth.x - 5 * squish} 10 Q ${mouth.x} 16 ${mouth.x + 5 * squish} 10`} stroke={C.eye} strokeWidth="2.6" fill="none" strokeLinecap="round" />
        )}
      </g>
      )}
      {/* scarf (level 2) */}
      {wear.includes('scarf') && (
        <g>
          <path d="M-54 22 Q 0 42 54 22 L 52 32 Q 0 52 -52 32 Z" fill={C.scarf} />
          {(() => {
            const k = place(a, 38, 50);
            return k.d > -0.2 ? (
              <g transform={`translate(${k.x} 34)`} opacity={clamp(k.d * 3 + 0.6)}>
                <rect x="-7" y="0" width="14" height="24" rx="5" fill={C.scarfDark} transform="rotate(-8)" />
              </g>
            ) : null;
          })()}
        </g>
      )}
      {front}
      {/* beanie (level 6) */}
      {wear.includes('beanie') && (
        <g>
          <path d="M-40 -34 Q -38 -70 0 -72 Q 38 -70 40 -34 Z" fill={C.beanie} />
          <rect x="-44" y="-40" width="88" height="13" rx="6.5" fill={C.beanieBand} />
          <circle cx={s * 10} cy="-74" r="8" fill="#fff" />
        </g>
      )}
    </>
  );
}

export default function Buddy({ label, sayings, wear = [], cheer = 0 }) {
  const [angle, setAngle] = useState(0);
  const [mood, setMood] = useState('idle');
  const [anim, setAnim] = useState('');
  const [bubble, setBubble] = useState(null);
  const angleRef = useRef(0);
  const drag = useRef(null);
  const raf = useRef(0);
  const timers = useRef([]);
  const lastReaction = useRef(-1);

  const setA = (v) => {
    angleRef.current = v;
    setAngle(v);
  };
  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms));
  const stopAnim = () => cancelAnimationFrame(raf.current);

  useEffect(
    () => () => {
      stopAnim();
      timers.current.forEach(clearTimeout);
    },
    [],
  );

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

  const settleHome = useCallback(() => {
    const a = angleRef.current;
    tweenTo(Math.round(a / 360) * 360, 650);
  }, [tweenTo]);

  const react = useCallback(
    (kind) => {
      haptic(10);
      timers.current.forEach(clearTimeout);
      timers.current = [];
      const say = sayings[Math.floor(Math.random() * sayings.length)];
      setBubble({ text: say, id: Math.random() });
      later(() => setBubble(null), 1400);
      if (prefersReducedMotion()) {
        setMood('happy');
        later(() => setMood('idle'), 900);
        return;
      }
      let r = kind;
      if (!r) {
        const options = ['boing', 'wiggle', 'twirl'];
        let i = Math.floor(Math.random() * options.length);
        if (i === lastReaction.current) i = (i + 1) % options.length;
        lastReaction.current = i;
        r = options[i];
      }
      if (r === 'twirl') {
        setMood('happy');
        tweenTo(Math.round(angleRef.current / 360) * 360 + 360, 800, () => {
          setMood('dizzy');
          later(() => setMood('idle'), 900);
        });
      } else {
        setMood('happy');
        setAnim('');
        requestAnimationFrame(() => setAnim(r === 'boing' ? 'buddy-boing' : 'buddy-wiggle'));
        later(() => {
          setAnim('');
          setMood('idle');
        }, 800);
      }
    },
    [sayings, tweenTo],
  );

  // A small hop whenever a mission is completed.
  useEffect(() => {
    if (!cheer) return;
    if (prefersReducedMotion()) {
      setMood('happy');
      const id = setTimeout(() => setMood('idle'), 700);
      return () => clearTimeout(id);
    }
    setMood('happy');
    setAnim('');
    const r = requestAnimationFrame(() => setAnim('buddy-boing'));
    const id = setTimeout(() => {
      setAnim('');
      setMood('idle');
    }, 760);
    return () => {
      cancelAnimationFrame(r);
      clearTimeout(id);
    };
  }, [cheer]);

  const onPointerDown = (e) => {
    stopAnim();
    drag.current = { x: e.clientX, y: e.clientY, a: angleRef.current, moved: false, lx: e.clientX, lt: performance.now(), v: 0 };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.abs(dx) > 7 && Math.abs(dx) > Math.abs(dy)) d.moved = true;
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
    // Inertia, then drift back to face the user.
    let v = d.v * 1.15 * 16;
    if (prefersReducedMotion()) v = 0;
    const step = () => {
      v *= 0.93;
      setA(angleRef.current + v);
      if (Math.abs(v) > 0.3) raf.current = requestAnimationFrame(step);
      else later(settleHome, 1400);
    };
    raf.current = requestAnimationFrame(step);
  };
  const onPointerCancel = () => {
    drag.current = null;
    later(settleHome, 600);
  };
  const onKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      react();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      stopAnim();
      setA(angleRef.current + (e.key === 'ArrowLeft' ? -30 : 30));
      timers.current.forEach(clearTimeout);
      later(settleHome, 2000);
    }
  };

  const s = Math.sin(angle * RAD);
  return (
    <div className="relative select-none" style={{ touchAction: 'pan-y' }}>
      {bubble && (
        <div
          key={bubble.id}
          className="bubble pointer-events-none absolute left-1/2 top-0 z-10 whitespace-nowrap rounded-full bg-card px-3 py-1 text-sm font-medium text-ink shadow-md"
        >
          {bubble.text}
        </div>
      )}
      <div
        role="button"
        tabIndex={0}
        aria-label={label}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onKeyDown={onKeyDown}
        className="mx-auto block h-[150px] w-[150px] cursor-grab rounded-full active:cursor-grabbing"
      >
        <svg viewBox="-80 -92 160 170" width="150" height="150" aria-hidden="true" style={{ overflow: 'visible' }}>
          <defs>
            <radialGradient id="moji-body" cx={0.42 - s * 0.18} cy="0.36" r="0.75">
              <stop offset="0" stopColor="#FFE3CF" />
              <stop offset="0.55" stopColor={C.body} />
              <stop offset="1" stopColor={C.bodyShade} />
            </radialGradient>
          </defs>
          <ellipse cx="0" cy="70" rx={46} ry={7} fill="#000" opacity=".08" />
          <g className="buddy-idle">
            <g className={anim}>
              <Parts a={angle} mood={mood} wear={wear} />
            </g>
          </g>
        </svg>
      </div>
    </div>
  );
}
