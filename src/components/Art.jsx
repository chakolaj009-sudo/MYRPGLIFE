// Colourful icon art (mission tiles, streak flame, keepsake medals, journey peak).
// Mission/flame/medal/peak designs follow the "My Day" design artifact.
import { useId } from 'react';

export const MISSION_ICONS = ['tooth', 'bed', 'book', 'lotus', 'sun', 'water', 'breakfast', 'shower', 'moon', 'walk', 'heart', 'sprout', 'star'];

export const MISSION_TINT = {
  sun: '#FFF4E0', water: '#E6F3FF', book: '#E3F8EF', breakfast: '#FFEFE3', shower: '#F1ECFF', moon: '#ECEEFF',
  walk: '#ECEEFF', heart: '#FFEAEE', star: '#FFF7DB', tooth: '#E6F3FF', bed: '#F1ECFF', lotus: '#FCEBF7', sprout: '#E3F8EF',
};

// Old icon keys from earlier builds → current art.
const ALIAS = { teeth: 'tooth', wind: 'lotus', leaf: 'sprout' };
export const iconKey = (k) => (MISSION_TINT[ALIAS[k] || k] ? ALIAS[k] || k : 'star');

export function MissionIcon({ kind, size = 27 }) {
  const u = useId().replace(/:/g, '');
  const a = `a${u}`;
  const b = `b${u}`;
  const k = iconKey(kind);
  const svg = (children, defs) => (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">
      {defs && <defs>{defs}</defs>}
      {children}
    </svg>
  );
  switch (k) {
    case 'sun':
      return svg(
        <>
          <g stroke="#FFB02E" strokeWidth="2.4" strokeLinecap="round">
            <path d="M16 3.5v3M16 25.5v3M3.5 16h3M25.5 16h3M7.2 7.2l2.1 2.1M22.7 22.7l2.1 2.1M7.2 24.8l2.1-2.1M22.7 9.3l2.1-2.1" />
          </g>
          <circle cx="16" cy="16" r="6.8" fill={`url(#${a})`} />
          <circle cx="13.8" cy="13.6" r="2" fill="#fff" opacity=".55" />
        </>,
        <radialGradient id={a} cx=".4" cy=".35" r=".7"><stop offset="0" stopColor="#FFE27A" /><stop offset="1" stopColor="#FF9F1C" /></radialGradient>,
      );
    case 'water':
      return svg(
        <>
          <path d="M16 3.5c4.8 6.2 8.6 10.9 8.6 15.4a8.6 8.6 0 0 1-17.2 0C7.4 14.4 11.2 9.7 16 3.5z" fill={`url(#${a})`} />
          <path d="M11.6 19.5c.2 2.6 1.9 4.4 4.3 4.8" stroke="#fff" strokeWidth="2" strokeLinecap="round" fill="none" opacity=".75" />
        </>,
        <linearGradient id={a} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#7DD3FC" /><stop offset="1" stopColor="#2563EB" /></linearGradient>,
      );
    case 'book':
      return svg(
        <>
          <path d="M4 7.5c3.8-1.4 8-1 12 1.6v17c-4-2.6-8.2-3-12-1.6z" fill={`url(#${a})`} />
          <path d="M28 7.5c-3.8-1.4-8-1-12 1.6v17c4-2.6 8.2-3 12-1.6z" fill={`url(#${b})`} />
          <path d="M16 9.1v17" stroke="#065F46" strokeWidth="1.2" opacity=".5" />
          <path d="M7 11.5c2-.5 4-.3 6 .6M7 15c2-.5 4-.3 6 .6M19 12.1c2-.9 4-1.1 6-.6M19 15.6c2-.9 4-1.1 6-.6" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" opacity=".7" />
        </>,
        <>
          <linearGradient id={a} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#34D399" /><stop offset="1" stopColor="#0E9F6E" /></linearGradient>
          <linearGradient id={b} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#6EE7B7" /><stop offset="1" stopColor="#10B981" /></linearGradient>
        </>,
      );
    case 'breakfast':
      return svg(
        <>
          <path d="M4 15h24a12 11 0 0 1-24 0z" fill={`url(#${a})`} />
          <ellipse cx="16" cy="15" rx="12" ry="2.6" fill="#FFF3E0" />
          <circle cx="12.5" cy="14.3" r="2.2" fill="#EF4444" /><circle cx="17.5" cy="13.8" r="1.8" fill="#8B5CF6" /><circle cx="20.8" cy="14.8" r="1.5" fill="#FACC15" />
          <path d="M11 6.5c-1 1.3 1 2.3 0 3.6M16 5c-1 1.3 1 2.3 0 3.6M21 6.5c-1 1.3 1 2.3 0 3.6" stroke="#CBD5E1" strokeWidth="1.6" strokeLinecap="round" fill="none" />
        </>,
        <linearGradient id={a} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FDBA74" /><stop offset="1" stopColor="#F97316" /></linearGradient>,
      );
    case 'shower':
      return svg(
        <>
          <path d="M8 13a8 8 0 0 1 16 0z" fill={`url(#${a})`} />
          <rect x="14.6" y="3" width="2.8" height="3.6" rx="1.2" fill="#A78BFA" />
          <g fill="#38BDF8">
            {[[10, 17.5], [16, 17.5], [22, 17.5], [8.5, 22.5], [14, 22.5], [19, 22.5], [24, 22.5], [11, 27.5], [17, 27.5], [22.5, 27.5]].map(([x, y]) => (
              <circle key={`${x}-${y}`} cx={x} cy={y} r="1.4" />
            ))}
          </g>
        </>,
        <linearGradient id={a} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#C4B5FD" /><stop offset="1" stopColor="#7C3AED" /></linearGradient>,
      );
    case 'moon':
      return svg(
        <>
          <path d="M20.5 4.5A11.5 11.5 0 1 0 27.5 20 9 9 0 0 1 20.5 4.5z" fill={`url(#${a})`} />
          <path d="M24 6.5l.8 1.7 1.7.8-1.7.8-.8 1.7-.8-1.7-1.7-.8 1.7-.8z" fill="#FCD34D" />
          <circle cx="12" cy="15" r="1.3" fill="#fff" opacity=".45" /><circle cx="15.5" cy="21" r="2" fill="#fff" opacity=".3" />
        </>,
        <linearGradient id={a} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#A5B4FC" /><stop offset="1" stopColor="#4F46E5" /></linearGradient>,
      );
    case 'walk':
      return svg(
        <>
          <path d="M5 21.5c0-2.6 1.3-6.8 3.6-9.6l3 1.4c1.5.7 3.1 2.6 4.6 4.1 2.3 2.3 6.4 2 9.8 2.6 1.4.2 1.9 1.2 1.9 2.3v1.6H5z" fill={`url(#${a})`} />
          <rect x="5" y="23.5" width="23" height="3" rx="1.5" fill="#E0E7FF" />
          <path d="M13 15.5l2-1.6M15.4 17.8l2-1.6" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
        </>,
        <linearGradient id={a} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#818CF8" /><stop offset="1" stopColor="#4338CA" /></linearGradient>,
      );
    case 'heart':
      return svg(
        <>
          <path d="M16 27.5S4 20.4 4 12.3A6.3 6.3 0 0 1 16 9.4a6.3 6.3 0 0 1 12 2.9c0 8.1-12 15.2-12 15.2z" fill={`url(#${a})`} />
          <ellipse cx="10.5" cy="12" rx="2.2" ry="1.5" fill="#fff" opacity=".5" transform="rotate(-30 10.5 12)" />
        </>,
        <linearGradient id={a} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FB7185" /><stop offset="1" stopColor="#E11D48" /></linearGradient>,
      );
    case 'tooth':
      return svg(
        <>
          <path d="M10.2 4.5c-3.4 0-5.7 2.6-5.7 6.3 0 3.1 1.3 5 2.1 7.4.9 2.7 1 7.8 3.3 9.3 1.9 1.2 2.6-3.3 3.3-5.6.5-1.6 1.3-2.4 2.8-2.4s2.3.8 2.8 2.4c.7 2.3 1.4 6.8 3.3 5.6 2.3-1.5 2.4-6.6 3.3-9.3.8-2.4 2.1-4.3 2.1-7.4 0-3.7-2.3-6.3-5.7-6.3-2.4 0-3.8 1.3-5.8 1.3s-3.4-1.3-5.8-1.3z" fill={`url(#${a})`} />
          <path d="M9 9.5c.6-1.6 1.8-2.3 3.4-2.1" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" fill="none" />
          <path d="M24.5 3.5l.7 1.6 1.6.7-1.6.7-.7 1.6-.7-1.6-1.6-.7 1.6-.7z" fill="#7DD3FC" />
        </>,
        <linearGradient id={a} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFFFFF" /><stop offset="1" stopColor="#BFDBFE" /></linearGradient>,
      );
    case 'bed':
      return svg(
        <>
          <rect x="3.5" y="9" width="3" height="18" rx="1.5" fill="#7C3AED" />
          <rect x="5" y="17" width="23.5" height="7" rx="2.5" fill={`url(#${a})`} />
          <rect x="7.5" y="12.5" width="7.5" height="5" rx="2.2" fill="#fff" />
          <path d="M14 14.5c3-2 8-2.3 12.8-.4 1 .4 1.7 1.4 1.7 2.9H14z" fill={`url(#${b})`} />
          <rect x="26" y="22" width="2.5" height="5" rx="1.2" fill="#7C3AED" />
        </>,
        <>
          <linearGradient id={a} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#C4B5FD" /><stop offset="1" stopColor="#8B5CF6" /></linearGradient>
          <linearGradient id={b} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#FBCFE8" /><stop offset="1" stopColor="#F472B6" /></linearGradient>
        </>,
      );
    case 'lotus':
      return svg(
        <>
          <path d="M16 6c3.2 3 4.6 6.6 4.6 10.2S18.9 22.6 16 24.5c-2.9-1.9-4.6-4.7-4.6-8.3S12.8 9 16 6z" fill={`url(#${a})`} />
          <path d="M4.5 13.5c4.2-.5 8 1.3 10.2 4.6 1 1.6 1.3 4 1.3 6.4-3.6.4-7-.6-9.2-3.1-1.7-2-2.5-4.9-2.3-7.9z" fill={`url(#${b})`} />
          <path d="M27.5 13.5c-4.2-.5-8 1.3-10.2 4.6-1 1.6-1.3 4-1.3 6.4 3.6.4 7-.6 9.2-3.1 1.7-2 2.5-4.9 2.3-7.9z" fill={`url(#${b})`} />
          <path d="M7 27h18" stroke="#A5B4FC" strokeWidth="2" strokeLinecap="round" />
        </>,
        <>
          <linearGradient id={a} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FBCFE8" /><stop offset="1" stopColor="#EC4899" /></linearGradient>
          <linearGradient id={b} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#F9A8D4" /><stop offset="1" stopColor="#DB2777" /></linearGradient>
        </>,
      );
    case 'sprout':
      return svg(
        <>
          <path d="M16 28V15" stroke="#15803D" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M16 16C16 10 11.5 6.5 5 7c0 6 4.5 9.5 11 9z" fill={`url(#${a})`} />
          <path d="M16 13.5c0-5.5 4-8.8 10.5-8.5 0 5.6-4 8.8-10.5 8.5z" fill={`url(#${b})`} />
          <ellipse cx="16" cy="28" rx="7" ry="1.8" fill="#D6C3A5" />
        </>,
        <>
          <linearGradient id={a} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#86EFAC" /><stop offset="1" stopColor="#22C55E" /></linearGradient>
          <linearGradient id={b} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#4ADE80" /><stop offset="1" stopColor="#15803D" /></linearGradient>
        </>,
      );
    default:
      return svg(<path d="M16 4l3.6 7.4 8.1 1.2-5.9 5.7 1.4 8.1L16 22.6l-7.2 3.8 1.4-8.1-5.9-5.7 8.1-1.2z" fill="#FBBF24" />);
  }
}

/** Chain flame that grows with milestones: spark → flame → strong → blaze → spirit fire (30+). */
export function flameTier(n) {
  if (n >= 30) return 4;
  if (n >= 14) return 3;
  if (n >= 7) return 2;
  if (n >= 3) return 1;
  return 0;
}

const FLAME_PAL = [
  ['#FFD66B', '#FF9F43', '#FFE8A3'],
  ['#FFB547', '#FF6A2B', '#FFE08A'],
  ['#FF9A3C', '#F4452B', '#FFD166'],
  ['#FF7A59', '#E0265B', '#FFC46B'],
  ['#9C8CFF', '#5B4BFF', '#8FE3FF'],
];
const FLAME_PATH = [
  'M16 26c-4.4 0-7-2.8-7-6.3 0-3.4 2.6-5.3 4-8 .9 1.6 1.6 2.4 2.6 3 .4-2.7 1.8-5.2 3.9-7.2-.1 3.6 3.5 6.5 3.5 11.6 0 4-2.6 6.9-7 6.9z',
  'M16 27.5c-5 0-8-3.1-8-7.2 0-4.4 3.4-6.3 4.6-10.1 1.2 1.8 1.8 2.8 3 3.4.3-3.3 2.3-6.9 5.2-9.1-.3 4.7 4.2 7.9 4.2 14.2 0 5.1-3.5 8.8-9 8.8z',
  'M16 28.5c-5.6 0-9-3.3-9-7.8 0-4.9 3.8-7 5-11.6 1.3 2 2 3.1 3.3 3.8C15.6 9 18 5.1 21.4 2.5c-.4 5.3 5.1 8.8 5.1 15.9 0 6-4 10.1-10.5 10.1z',
  'M16 29c-6.1 0-9.8-3.6-9.8-8.5 0-5.2 4-7.5 5.1-12.4 1.4 2.1 2.2 3.3 3.5 4 .1-4.4 2.9-8.6 6.8-11.1-.6 3.1 1.6 5.2 3 3.7 2.8 3.6 3.7 7.4 3.7 11.3 0 7.1-4.3 13-12.3 13z',
];

export function Flame({ tier = 0, size = 27, dim = false }) {
  const u = useId().replace(/:/g, '');
  const p = FLAME_PAL[tier];
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true" className={`flame t${tier}`} style={dim ? { filter: 'grayscale(.6)', opacity: 0.6 } : undefined}>
      <defs>
        <linearGradient id={`fa${u}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={p[0]} /><stop offset="1" stopColor={p[1]} /></linearGradient>
        <radialGradient id={`fb${u}`} cx=".5" cy=".7" r=".6"><stop offset="0" stopColor="#FFFBEA" /><stop offset=".6" stopColor={p[2]} /><stop offset="1" stopColor={p[2]} stopOpacity="0" /></radialGradient>
      </defs>
      {tier >= 3 && (
        <>
          <circle cx="6" cy="9" r="1.1" fill={p[2]} /><circle cx="27" cy="12" r=".9" fill={p[2]} /><circle cx="25" cy="5" r=".7" fill={p[0]} />
        </>
      )}
      <path d={FLAME_PATH[Math.min(tier, 3)]} fill={`url(#fa${u})`} />
      <path d="M16 26.2c-2.6 0-4.1-1.6-4.1-3.7 0-2.4 2-3.4 2.9-5.6 1 1.4 1.2 2 2 2.3.5-1.3.9-2.3 1.9-3.4.4 2.3 1.9 3.6 1.9 6.1 0 2.5-1.8 4.3-4.6 4.3z" fill={`url(#fb${u})`} />
    </svg>
  );
}

/** Medal-style keepsake. Colour by family; greyed when locked. */
export function Medal({ id, size = 34, locked = false }) {
  const u = useId().replace(/:/g, '');
  const c = id.startsWith('streak') ? ['#FFB547', '#F97316'] : id === 'tasks-50' ? ['#A78BFA', '#6D28D9'] : ['#5EEAD4', '#0D9488'];
  const streakGlyph = id.startsWith('streak');
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true" style={locked ? { filter: 'grayscale(1)', opacity: 0.35 } : undefined}>
      <defs>
        <linearGradient id={`ma${u}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={c[0]} /><stop offset="1" stopColor={c[1]} /></linearGradient>
        <linearGradient id={`mb${u}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FDE68A" /><stop offset="1" stopColor="#F59E0B" /></linearGradient>
      </defs>
      <path d="M11 2.5h4l2.2 6-3.6 1.6zM21 2.5h-4l-2.2 6 3.6 1.6z" fill={c[1]} opacity=".85" />
      <circle cx="16" cy="17.5" r="10" fill={`url(#mb${u})`} />
      <circle cx="16" cy="17.5" r="7.6" fill={`url(#ma${u})`} />
      <path d="M10.6 13.5a7.6 7.6 0 0 1 6.5-3.5" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" opacity=".55" fill="none" />
      {streakGlyph ? (
        <path d="M16 21.2c-2.1 0-3.3-1.3-3.3-3 0-1.9 1.6-2.7 2.3-4.5.8 1.1 1 1.6 1.6 1.9.4-1.1.8-1.9 1.6-2.8.3 1.9 1.5 2.9 1.5 4.9 0 2-1.4 3.5-3.7 3.5z" fill="#fff" />
      ) : id === 'first-day' ? (
        <path d="M11.5 20h9M13 20a3 3 0 0 1 6 0M16 13.2v1.6M12 15.2l1 1M20 15.2l-1 1" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" fill="none" />
      ) : (
        <path d="M16 11.6l1.5 3.1 3.4.5-2.5 2.4.6 3.4-3-1.6-3 1.6.6-3.4-2.5-2.4 3.4-.5z" fill="#fff" />
      )}
    </svg>
  );
}

export function Peak({ size = 28, won = false }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">
      <path d="M2.5 27L12 11l4 6 3.5-5L29.5 27z" fill={won ? '#6366F1' : '#8FA2E8'} />
      <path d="M12 11l-3 5 2 -1 1.5 1.5L14 15z" fill="#fff" />
      <path d="M19.5 12L17.3 15.2l1.4-.6 1.1 1 1.1-1.4z" fill="#fff" />
      <path d="M19.5 12V3.5" stroke="#4F46E5" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M19.5 4l6 2.2-6 2.2z" fill="#F59E0B" />
    </svg>
  );
}
