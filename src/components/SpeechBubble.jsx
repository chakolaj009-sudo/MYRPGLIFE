import { useLayoutEffect, useRef, useState } from 'react';

const GAP = 70; // the bubble floats this far above the speaker's head point
const EDGE = 8;

/**
 * Companion speech. Measures its real size after layout and nudges itself
 * only as far as needed to stay on screen and clear of the HUD; the tail
 * keeps pointing at the speaker.
 */
export default function SpeechBubble({ x, y, text, hudRef }) {
  const el = useRef(null);
  const [nudge, setNudge] = useState({ dx: 0, dy: 0, tail: 0 });
  useLayoutEffect(() => {
    const b = el.current;
    if (!b) return;
    const w = b.offsetWidth;
    const h = b.offsetHeight;
    const left = x - w / 2;
    const top = y - GAP - h;
    const minTop = (hudRef?.current?.getBoundingClientRect().bottom ?? 0) + EDGE;
    const vw = window.innerWidth;
    const dx = left < EDGE ? EDGE - left : left + w > vw - EDGE ? vw - EDGE - (left + w) : 0;
    const dy = top < minTop ? minTop - top : 0;
    const room = Math.max(0, w / 2 - 20); // keep the tail inside the bubble
    setNudge({ dx, dy, tail: Math.max(-room, Math.min(room, -dx)) });
  }, [x, y, text, hudRef]);
  return (
    <div ref={el} className="world-bubble" style={{ left: x + nudge.dx, top: y + nudge.dy, '--tail': `${nudge.tail}px` }} role="status">
      {text}
    </div>
  );
}
