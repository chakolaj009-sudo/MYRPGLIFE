// Original app mark: "Moji" peeking up with a sprout, on warm cream.
// `pad` shrinks the art for maskable safe zones.
export function iconSvg({ size = 512, pad = 0, bg = '#F7F3EC', rounded = false } = {}) {
  const s = 1 - pad;
  const r = rounded ? 112 : 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="${size}" height="${size}">
  <defs>
    <radialGradient id="b" cx="0.42" cy="0.36" r="0.75">
      <stop offset="0" stop-color="#FFE3CF"/><stop offset="0.55" stop-color="#FFC7A1"/><stop offset="1" stop-color="#F2A27C"/>
    </radialGradient>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E7F4EA"/><stop offset="1" stop-color="${bg}"/></linearGradient>
  </defs>
  <rect width="512" height="512" rx="${r}" fill="url(#g)"/>
  <g transform="translate(256 262) scale(${s}) translate(-256 -262)">
    <ellipse cx="256" cy="420" rx="150" ry="22" fill="#000" opacity=".07"/>
    <path d="M256 170 Q 252 120 262 92" stroke="#3E9467" stroke-width="12" fill="none" stroke-linecap="round"/>
    <path d="M262 100 C 300 70 340 80 352 92 C 330 120 290 124 262 100 Z" fill="#4FAE7C"/>
    <path d="M258 112 C 226 84 190 90 178 100 C 196 126 232 132 258 112 Z" fill="#8ED3A8"/>
    <ellipse cx="170" cy="190" rx="42" ry="44" fill="#F2A27C"/><ellipse cx="170" cy="190" rx="22" ry="24" fill="#F59C92"/>
    <ellipse cx="342" cy="190" rx="42" ry="44" fill="#F2A27C"/><ellipse cx="342" cy="190" rx="22" ry="24" fill="#F59C92"/>
    <ellipse cx="256" cy="290" rx="158" ry="150" fill="url(#b)"/>
    <ellipse cx="256" cy="372" rx="84" ry="52" fill="#FFF0E0"/>
    <ellipse cx="206" cy="270" rx="18" ry="23" fill="#3A2C27"/><circle cx="212" cy="261" r="7" fill="#fff"/>
    <ellipse cx="306" cy="270" rx="18" ry="23" fill="#3A2C27"/><circle cx="312" cy="261" r="7" fill="#fff"/>
    <ellipse cx="176" cy="310" rx="22" ry="13" fill="#FF8E86" opacity=".55"/><ellipse cx="336" cy="310" rx="22" ry="13" fill="#FF8E86" opacity=".55"/>
    <path d="M236 312 Q 256 334 276 312" stroke="#3A2C27" stroke-width="8" fill="none" stroke-linecap="round"/>
  </g>
</svg>`;
}
