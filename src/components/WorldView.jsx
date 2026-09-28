import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { CompanionArt } from './Companion.jsx';
import { prefersReducedMotion } from '../lib/fx.js';

const SKY = {
  dawn: 'linear-gradient(180deg,#8FA4E8 0%,#C7B8EC 30%,#F4C6D6 58%,#FFD2BE 78%,#FFE9D8 100%)',
  day: 'linear-gradient(180deg,#8FB2F2 0%,#BCD0F7 32%,#E3E1F7 58%,#F7E6EC 78%,#FFF1EA 100%)',
  evening: 'linear-gradient(180deg,#5F6AC7 0%,#9C86D3 30%,#EE9EB5 58%,#FFB98F 80%,#FFD9B8 100%)',
  night: 'linear-gradient(180deg,#070B26 0%,#111845 35%,#1F2660 65%,#2E3272 100%)',
};
const STARS = Array.from({ length: 34 }, (_, i) => [(i * 37) % 100, (i * 53) % 55, 1 + (i % 3) * 0.6, (i % 7) * 0.5]);

/**
 * Full-bleed 3D island. `missions` = [{ id, kind, done }].
 * Imperative API via ref: play(id), undo(id), focus(id), react(), celebrate(), screenPoint(id).
 */
const WorldView = forwardRef(function WorldView({ phase, stage, species, wear, missions, minimum = false, offset = 0.13, onTapMission, onTapCompanion, label }, ref) {
  const host = useRef(null);
  const world = useRef(null);
  const [fallback, setFallback] = useState(false);
  const cb = useRef({});
  cb.current = { onTapMission, onTapCompanion };

  const [ready, setReady] = useState(false);
  const latest = useRef({});
  latest.current = { offset, phase, stage, species, wear, missions, minimum };

  // The 3D engine is loaded lazily so the HUD and cards paint immediately.
  useEffect(() => {
    let dead = false;
    import('../world/World.js')
      .then(({ World, webglAvailable }) => {
        if (dead) return;
        if (!webglAvailable()) return setFallback(true);
        const w = new World(host.current, {
          reducedMotion: prefersReducedMotion(),
          onTapMission: (id) => cb.current.onTapMission?.(id),
          onTapCompanion: () => cb.current.onTapCompanion?.(),
        });
        const L = latest.current;
        w.setOffset(L.offset);
        w.setPhase(L.phase);
        w.setStage(L.stage);
        w.setCompanion(L.species, L.wear);
        w.setMissions(L.missions);
        w.setMinimum(L.minimum);
        world.current = w;
        if (/[?&]debug\b/.test(location.search)) window.__world = w;
        setReady(true);
      })
      .catch(() => !dead && setFallback(true));
    return () => {
      dead = true;
      world.current?.dispose();
      world.current = null;
    };
  }, []);

  useEffect(() => world.current?.setOffset(offset), [offset, ready]);
  useEffect(() => world.current?.setPhase(phase), [phase, ready]);
  useEffect(() => world.current?.setStage(stage), [stage, ready]);
  useEffect(() => world.current?.setCompanion(species, wear), [species, wear, ready]);
  useEffect(() => world.current?.setMissions(missions), [missions, ready]);
  useEffect(() => world.current?.setMinimum(minimum), [minimum, ready]);

  useImperativeHandle(ref, () => ({
    play: (id) => world.current?.play(id) ?? Promise.resolve(),
    undo: (id) => world.current?.undo(id),
    focus: (id) => world.current?.focus(id),
    react: () => world.current?.react(),
    celebrate: () => world.current?.celebrate(),
    screenPoint: (id) => world.current?.screenPoint(id) ?? null,
    hasWorld: () => !!world.current,
  }));

  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: SKY[phase] || SKY.day }} role="img" aria-label={label}>
      {phase === 'night' &&
        STARS.map(([x, y, r, d], i) => (
          <span key={i} className="twinkle absolute rounded-full bg-white" style={{ left: `${x}%`, top: `${y}%`, width: r, height: r, animationDelay: `${d}s` }} />
        ))}
      {phase === 'night' && <span className="absolute right-[12%] top-[43%] h-9 w-9 rounded-full" style={{ boxShadow: 'inset -9px 5px 0 0 #F5F3FF', filter: 'drop-shadow(0 0 12px rgb(199 210 254 / .7))' }} />}
      {(phase === 'day' || phase === 'dawn' || phase === 'evening') && (
        <span
          className="absolute h-64 w-64 rounded-full"
          style={{
            left: phase === 'dawn' ? '-18%' : '55%',
            top: phase === 'evening' ? '22%' : '6%',
            background: `radial-gradient(circle, ${phase === 'evening' ? 'rgb(255 208 138 / .75)' : 'rgb(255 247 223 / .85)'} 0%, transparent 65%)`,
          }}
        />
      )}
      <div ref={host} className={`absolute inset-0 transition-opacity duration-700 ${ready ? 'opacity-100' : 'opacity-0'}`} />
      {fallback && (
        <div className="absolute inset-x-0 top-[26%] flex justify-center">
          <CompanionArt species={species} wear={wear} size={170} />
        </div>
      )}
    </div>
  );
});

export default WorldView;
