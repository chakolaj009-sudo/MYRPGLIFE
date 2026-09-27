// Growth stage illustration: Seed → Sprout → Young plant → Sapling → Mature tree → Ancient tree.
const L = '#4FAE7C';
const LD = '#3E9467';
const LL = '#8ED3A8';
const BARK = '#9A6B4F';
const BARK_D = '#7C543D';

function Soil() {
  return (
    <g>
      <ellipse cx="60" cy="126" rx="44" ry="9" fill="#000" opacity=".07" />
      <path d="M20 124 Q 60 104 100 124 Z" fill="#B98A68" />
      <path d="M30 122 Q 60 110 90 122" stroke="#A47553" strokeWidth="2" fill="none" strokeLinecap="round" />
    </g>
  );
}

const leaf = (x, y, r, rot, fill = L) => (
  <path key={`${x}-${y}-${rot}`} d={`M0 0 C ${r * 0.5} ${-r * 0.4} ${r * 0.9} ${-r * 0.2} ${r} 0 C ${r * 0.9} ${r * 0.25} ${r * 0.5} ${r * 0.4} 0 0 Z`}
    transform={`translate(${x} ${y}) rotate(${rot})`} fill={fill} />
);

const crown = (blobs) => blobs.map(([x, y, r, f], i) => <circle key={i} cx={x} cy={y} r={r} fill={f || L} />);

const STAGES = {
  seed: (
    <g>
      <ellipse cx="60" cy="113" rx="8" ry="6" fill={BARK} transform="rotate(-20 60 113)" />
      <path d="M58 109 q 3 -5 7 -6" stroke={LL} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <g fill="#F2B53D">
        <circle cx="80" cy="94" r="2" />
        <circle cx="42" cy="100" r="1.5" />
      </g>
    </g>
  ),
  sprout: (
    <g>
      <path d="M60 116 Q 60 100 61 90" stroke={LD} strokeWidth="3.5" fill="none" strokeLinecap="round" />
      {leaf(61, 92, 20, -150, LL)}
      {leaf(61, 90, 20, -30)}
    </g>
  ),
  young: (
    <g>
      <path d="M60 118 Q 58 90 62 66" stroke={LD} strokeWidth="4" fill="none" strokeLinecap="round" />
      {leaf(60, 100, 22, -160, LL)}
      {leaf(59, 92, 24, -20)}
      {leaf(61, 80, 22, -150)}
      {leaf(62, 70, 20, -40, LL)}
      {leaf(62, 67, 16, -110)}
    </g>
  ),
  sapling: (
    <g>
      <path d="M57 120 L 59 72 L 63 72 L 64 120 Z" fill={BARK} />
      <path d="M61 92 Q 70 86 76 78" stroke={BARK} strokeWidth="3" fill="none" strokeLinecap="round" />
      {crown([
        [60, 60, 22, LD],
        [46, 66, 15],
        [75, 66, 15],
        [60, 52, 17, LL],
        [78, 76, 9],
      ])}
    </g>
  ),
  mature: (
    <g>
      <path d="M54 122 Q 57 96 56 70 L 66 70 Q 64 96 68 122 Z" fill={BARK} />
      <path d="M58 90 Q 46 82 40 72 M 64 84 Q 76 76 82 66" stroke={BARK} strokeWidth="4" fill="none" strokeLinecap="round" />
      {crown([
        [60, 50, 30, LD],
        [36, 60, 20],
        [84, 58, 21],
        [48, 36, 19, LL],
        [74, 36, 19],
        [60, 62, 20],
      ])}
      <g fill="#fff" opacity=".35">
        <circle cx="45" cy="32" r="4" />
        <circle cx="70" cy="30" r="3" />
      </g>
    </g>
  ),
  ancient: (
    <g>
      <path d="M50 124 Q 56 98 54 72 L 68 72 Q 66 98 72 124 Z" fill={BARK_D} />
      <path d="M50 124 q -8 0 -14 3 M 72 124 q 8 0 14 3" stroke={BARK_D} strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M58 100 q 2 -8 0 -14" stroke={BARK} strokeWidth="2" fill="none" />
      {crown([
        [60, 48, 34, LD],
        [30, 60, 22],
        [90, 58, 22],
        [42, 30, 22, LL],
        [78, 28, 22],
        [60, 20, 18, L],
        [60, 66, 22],
      ])}
      <g fill="#F7A9C4">
        {[
          [36, 44],
          [52, 24],
          [80, 44],
          [70, 60],
          [44, 64],
          [88, 32],
          [62, 40],
        ].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="3.4" />
        ))}
      </g>
      <g fill="#F2B53D">
        <circle cx="16" cy="30" r="1.8" />
        <circle cx="106" cy="44" r="1.6" />
        <circle cx="98" cy="14" r="1.4" />
      </g>
    </g>
  ),
};

export default function Plant({ stage, label, size = 118, soil = true }) {
  return (
    <svg viewBox={soil ? '0 0 120 136' : '10 6 100 122'} width={size} height={size * (soil ? 136 / 120 : 122 / 100)} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : 'true'}>
      {soil ? <Soil /> : <ellipse cx="60" cy="122" rx="30" ry="5" fill="#B98A68" />}
      <g key={stage} className="grow-in">
        {STAGES[stage] || STAGES.seed}
      </g>
    </svg>
  );
}
