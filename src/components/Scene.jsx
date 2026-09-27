// Hero environment: sky, layered mountains with haze, distant floating islands,
// clouds and the grassy island the companion lives on. Adapted from the
// "My Day" design artifact, re-lit for the local time of day.

const PHASES = {
  dawn: {
    sky: ['#8FA4E8', '#C7B8EC', '#F4C6D6', '#FFD2BE', '#FFE9D8'],
    glow: { x: 70, y: 210, c: '#FFE3C2' },
    far: ['#B7B1E6', '#F0DDE8'], mid: ['#8A8BD4', '#C1B5E6', '#E6D3EC'], lit: '#FFF0F4',
    ridge: '#7A83BE', near: '#5E6FA6', haze: '#FBEFF1', cloud: ['#FFFFFF', '#F3E6EE'],
    rock: ['#9D93C6', '#7B73AA', '#5E5A8C'], grass: ['#B5E07A', '#7CC055', '#4F9A45'], isle: ['#A9B8B4', '#B3AEDA', '#94A0C8'],
  },
  day: {
    sky: ['#9FBCF3', '#C3D4F7', '#E6E3F7', '#F8E6EA', '#FFF1EA'],
    glow: { x: 300, y: 175, c: '#FFF7DF' },
    far: ['#AEB9EA', '#E4E0F4'], mid: ['#7F90D6', '#B7BEEA', '#D9D8F2'], lit: '#EEF0FF',
    ridge: '#6F86B8', near: '#557AA0', haze: '#F7F2FA', cloud: ['#FFFFFF', '#E9E8F7'],
    rock: ['#9D93C6', '#7B73AA', '#5E5A8C'], grass: ['#B5E07A', '#7CC055', '#4F9A45'], isle: ['#9DB9A8', '#A9AED8', '#8FA4C4'],
  },
  evening: {
    sky: ['#6F79CF', '#A58FD6', '#EE9EB5', '#FFB98F', '#FFD9B8'],
    glow: { x: 310, y: 235, c: '#FFD08A' },
    far: ['#9D93D6', '#EDC9D6'], mid: ['#6E6FC0', '#A897D8', '#DDC2DC'], lit: '#FFE3E8',
    ridge: '#6A6FB0', near: '#4C5A95', haze: '#F8E8EC', cloud: ['#FFF4EE', '#EBCFDC'],
    rock: ['#8E84BE', '#6C64A0', '#514D82'], grass: ['#A9D873', '#72B650', '#4A8F42'], isle: ['#9AAFA6', '#A69CD2', '#8A94C0'],
  },
  night: {
    sky: ['#0B1030', '#141B47', '#222960', '#30366F', '#3B3B78'],
    glow: { x: 300, y: 92, c: '#C7D2FE' },
    far: ['#3A427C', '#4B4F8A'], mid: ['#252D66', '#343B78', '#434887'], lit: '#5A62A8',
    ridge: '#1E2656', near: '#161D45', haze: '#2C2F66', cloud: ['#7D84BE', '#565D96'],
    rock: ['#5A5487', '#433E6E', '#2F2B53'], grass: ['#7FA86F', '#557F55', '#3A6340'], isle: ['#5C6F7A', '#4D5288', '#465283'],
  },
};

export function phaseFor(hour, dark) {
  if (dark) return 'night';
  if (hour >= 5 && hour < 8) return 'dawn';
  if (hour >= 8 && hour < 17) return 'day';
  if (hour >= 17 && hour < 20) return 'evening';
  return 'night';
}

function cloud(x, y, s, fill, op = 1, key) {
  const puffs = [[0, 0, 22], [24, -10, 26], [52, -4, 22], [74, 4, 16], [-20, 6, 15], [36, 8, 20], [12, 10, 18]];
  return (
    <g key={key} transform={`translate(${x} ${y}) scale(${s})`} fill={fill} opacity={op}>
      {puffs.map(([dx, dy, r], i) => (
        <circle key={i} cx={dx} cy={dy} r={r} />
      ))}
    </g>
  );
}

const pine = (x, y, h, fill, key) => {
  const w = h * 0.42;
  return (
    <path
      key={key}
      d={`M${x} ${y - h} L${x + w * 0.55} ${y - h * 0.55} L${x + w * 0.32} ${y - h * 0.55} L${x + w * 0.75} ${y - h * 0.18} L${x + w * 0.45} ${y - h * 0.18} L${x + w} ${y} L${x - w} ${y} L${x - w * 0.45} ${y - h * 0.18} L${x - w * 0.75} ${y - h * 0.18} L${x - w * 0.32} ${y - h * 0.55} L${x - w * 0.55} ${y - h * 0.55} Z`}
      fill={fill}
    />
  );
};
const trees = (list, fill) => list.map(([x, y, h], i) => pine(x, y, h, fill, i));

function Isle({ x, y, s, tone }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-30 0 C-24 16 -10 34 2 46 C8 30 20 14 30 0 Z" fill={tone[1]} />
      <path d="M-32 1 C-26 -6 26 -6 32 1 C24 5 -24 5 -32 1Z" fill={tone[0]} />
      {trees([[-14, 0, 22], [-4, -1, 30], [8, 0, 18], [17, 0, 14]], tone[2])}
    </g>
  );
}

const STARS = [
  [22, 40, 1.2], [58, 88, 0.9], [96, 30, 1.4], [134, 70, 0.8], [170, 22, 1.1], [214, 54, 0.9], [252, 26, 1.3], [352, 58, 1],
  [378, 20, 0.8], [40, 130, 0.8], [120, 118, 1], [236, 110, 0.7], [330, 150, 0.9], [8, 190, 0.7], [382, 110, 1.1], [190, 94, 0.8],
];

const FLOWERS = [
  [130, 302, '#fff', '#FACC15'], [262, 300, '#FBCFE8', '#F472B6'], [150, 296, '#E9D5FF', '#A855F7'], [246, 309, '#fff', '#FACC15'],
  [116, 309, '#FDE68A', '#F59E0B'], [276, 306, '#BFDBFE', '#3B82F6'], [168, 312, '#FBCFE8', '#EC4899'], [226, 314, '#fff', '#F472B6'],
  [138, 314, '#E9D5FF', '#8B5CF6'], [256, 294, '#FDE68A', '#F97316'],
];

export default function Scene({ phase = 'day', stageIndex = 0 }) {
  const p = PHASES[phase] || PHASES.day;
  const night = phase === 'night';
  const flowers = FLOWERS.slice(0, 2 + stageIndex * 2);
  return (
    <svg className="scene-svg" viewBox="0 0 390 380" preserveAspectRatio="xMidYMin slice" aria-hidden="true">
      <defs>
        <linearGradient id="sc-sky" x1="0" y1="0" x2="0" y2="1">
          {p.sky.map((c, i) => (
            <stop key={i} offset={[0, 0.32, 0.58, 0.74, 1][i]} stopColor={c} />
          ))}
        </linearGradient>
        <radialGradient id="sc-glow" cx={p.glow.x} cy={p.glow.y} r={night ? 90 : 170} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={p.glow.c} stopOpacity={night ? 0.45 : 0.95} />
          <stop offset=".35" stopColor={p.glow.c} stopOpacity={night ? 0.15 : 0.5} />
          <stop offset="1" stopColor={p.glow.c} stopOpacity="0" />
        </radialGradient>
        <linearGradient id="sc-far" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={p.far[0]} /><stop offset="1" stopColor={p.far[1]} /></linearGradient>
        <linearGradient id="sc-mid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.mid[0]} /><stop offset=".7" stopColor={p.mid[1]} /><stop offset="1" stopColor={p.mid[2]} />
        </linearGradient>
        <linearGradient id="sc-lit" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={p.lit} /><stop offset="1" stopColor={p.lit} stopOpacity=".15" /></linearGradient>
        <linearGradient id="sc-haze" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.haze} stopOpacity="0" />
          <stop offset=".55" stopColor={p.haze} stopOpacity=".75" />
          <stop offset="1" style={{ stopColor: 'var(--bg)' }} stopOpacity=".95" />
        </linearGradient>
        <linearGradient id="sc-rock" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.rock[0]} /><stop offset=".55" stopColor={p.rock[1]} /><stop offset="1" stopColor={p.rock[2]} />
        </linearGradient>
        <linearGradient id="sc-rockSide" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#554F86" stopOpacity=".55" /><stop offset=".45" stopColor="#554F86" stopOpacity="0" />
          <stop offset=".7" stopColor="#C8BFEA" stopOpacity="0" /><stop offset="1" stopColor="#C8BFEA" stopOpacity=".45" />
        </linearGradient>
        <linearGradient id="sc-grass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.grass[0]} /><stop offset=".6" stopColor={p.grass[1]} /><stop offset="1" stopColor={p.grass[2]} />
        </linearGradient>
        <radialGradient id="sc-grassLight" cx="240" cy="296" r="80" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#E4F7A8" stopOpacity={night ? 0.25 : 0.8} /><stop offset="1" stopColor="#E4F7A8" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="sc-cloud" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={p.cloud[0]} /><stop offset="1" stopColor={p.cloud[1]} /></linearGradient>
        <filter id="sc-soft" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="1.2" /></filter>
        <filter id="sc-softer" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3" /></filter>
        <filter id="sc-mist" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="6" /></filter>
      </defs>

      <rect width="390" height="380" fill="url(#sc-sky)" />
      <rect width="390" height="380" fill="url(#sc-glow)" />
      {night && (
        <g>
          {STARS.map(([x, y, r], i) => (
            <circle key={i} cx={x} cy={y} r={r} fill="#fff" className="twinkle" style={{ animationDelay: `${(i % 5) * 0.6}s` }} />
          ))}
          <circle cx="300" cy="92" r="15" fill="#F5F3FF" />
          <circle cx="307" cy="86" r="14" fill={p.sky[1]} />
        </g>
      )}

      <g filter="url(#sc-softer)" className="drift-slow">
        {cloud(40, 62, 0.55, p.cloud[0], night ? 0.25 : 0.55, 'w1')}
        {cloud(300, 40, 0.45, p.cloud[0], night ? 0.2 : 0.5, 'w2')}
      </g>

      <g opacity=".75" filter="url(#sc-soft)" className="bob-slow">
        <Isle x={52} y={158} s={0.62} tone={p.isle} />
      </g>
      <g opacity=".8" filter="url(#sc-soft)" className="bob-slower">
        <Isle x={344} y={128} s={0.8} tone={p.isle} />
        <path d="M352 131 C352 150 351 170 352 190" stroke="#F4F6FF" strokeWidth="1.6" opacity=".6" fill="none" />
      </g>

      <path filter="url(#sc-soft)" fill="url(#sc-far)" d="M0 238 L30 214 L58 222 L92 188 L126 214 L150 204 L178 226 L214 196 L246 216 L276 186 L312 208 L346 180 L390 206 L390 320 L0 320Z" />
      <g filter="url(#sc-soft)">
        <path fill="url(#sc-mid)" d="M-10 330 L-10 212 L22 176 L44 196 L70 150 L104 204 L126 196 L160 262 L150 330Z" />
        <path fill="url(#sc-lit)" opacity=".85" d="M70 150 L104 204 L126 196 L112 214 L96 206 L82 214 L78 188Z" />
        <path fill="#EEF0FF" opacity={night ? 0.25 : 0.7} d="M70 150 L78 166 L72 172 L66 160Z M22 176 L30 186 L24 190Z" />
        <path fill="url(#sc-mid)" d="M236 330 L246 262 L270 214 L292 222 L322 140 L352 196 L372 184 L400 216 L400 330Z" />
        <path fill="url(#sc-lit)" opacity=".9" d="M322 140 L352 196 L372 184 L382 196 L362 204 L346 214 L334 190Z" />
        <path fill="#F3F4FF" opacity={night ? 0.25 : 0.75} d="M322 140 L332 160 L325 166 L318 152Z" />
      </g>
      <g opacity=".85" filter="url(#sc-soft)">
        {trees([[8, 292, 34], [22, 296, 44], [38, 292, 30], [54, 300, 40], [70, 298, 28], [86, 304, 34], [120, 306, 26]], p.ridge)}
        {trees([[270, 304, 28], [290, 300, 36], [306, 296, 44], [322, 298, 32], [340, 292, 46], [358, 296, 34], [376, 290, 40]], p.ridge)}
      </g>
      <rect x="-20" y="262" width="430" height="140" fill="url(#sc-haze)" />
      <g filter="url(#sc-soft)">
        {trees([[-2, 344, 62], [18, 350, 48], [34, 356, 36]], p.near)}
        {trees([[362, 352, 44], [382, 346, 64], [396, 350, 52]], p.near)}
      </g>

      <g transform="translate(0 -24)">
        <ellipse cx="195" cy="392" rx="120" ry="14" fill="#C9C6EA" opacity=".35" filter="url(#sc-mist)" />
        <path fill="url(#sc-rock)" d="M104 308 C112 330 132 346 150 358 C162 368 176 384 194 398 C212 382 226 366 240 356 C258 344 278 330 286 308Z" />
        <path fill="url(#sc-rockSide)" d="M104 308 C112 330 132 346 150 358 C162 368 176 384 194 398 C212 382 226 366 240 356 C258 344 278 330 286 308Z" />
        <path d="M128 330 L150 338 M232 336 L256 326 M160 352 L178 356 M204 362 L222 354" stroke="#524C80" strokeOpacity=".35" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M100 306 C110 292 150 286 195 286 C240 286 280 292 290 306 C284 316 250 322 195 322 C140 322 106 316 100 306Z" fill="url(#sc-grass)" />
        <path d="M100 306 C110 292 150 286 195 286 C240 286 280 292 290 306 C284 316 250 322 195 322 C140 322 106 316 100 306Z" fill="url(#sc-grassLight)" />
        <path fill={p.grass[2]} d="M108 312 C112 322 118 322 120 314 Z M142 319 C146 330 152 330 154 320Z M226 320 C230 332 236 331 238 319Z M262 316 C266 326 272 325 274 313Z" />
        <ellipse cx="195" cy="302" rx="42" ry="6.5" fill="#3F7A3A" opacity=".28" />
        {flowers.map(([x, y, petal, heart], i) => (
          <g key={i}>
            <circle cx={x} cy={y} r="2.5" fill={petal} />
            <circle cx={x} cy={y} r="1" fill={heart} />
          </g>
        ))}
        <ellipse cx="236" cy="306" rx="4" ry="2.4" fill="#CFCBE8" />
      </g>

      <g filter="url(#sc-soft)" transform="translate(0 -30)">
        <g className="drift">
          {cloud(64, 382, 1.05, 'url(#sc-cloud)', 1, 'f1')}
          {cloud(300, 386, 1.15, 'url(#sc-cloud)', 1, 'f2')}
          {cloud(170, 408, 0.9, p.cloud[0], 0.9, 'f3')}
        </g>
      </g>
    </svg>
  );
}
