import { forwardRef, useEffect, useRef, useState } from 'react';
import { SlidersHorizontal, Snowflake } from 'lucide-react';
import { Flame, flameTier } from './Art.jsx';
import Plant from './Plant.jsx';

/** Level ring: the XP orbs fly into it. One JS tween drives the fill so it also works in Safari. */
const LevelRing = forwardRef(function LevelRing({ t, level, ping }, ref) {
  const target = level.into / level.need;
  const [pct, setPct] = useState(target);
  const cur = useRef(target);
  const prev = useRef(level.level);
  const raf = useRef(0);
  const box = useRef(null);
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const tween = (to, ms, done) => {
      cancelAnimationFrame(raf.current);
      const from = cur.current;
      const t0 = performance.now();
      const step = (now) => {
        const k = reduce ? 1 : Math.min(1, (now - t0) / ms);
        cur.current = from + (to - from) * (1 - Math.pow(1 - k, 3));
        setPct(cur.current);
        if (k < 1) raf.current = requestAnimationFrame(step);
        else done && done();
      };
      raf.current = requestAnimationFrame(step);
    };
    if (level.level > prev.current) {
      tween(1, 600, () => {
        cur.current = 0;
        setPct(0);
        box.current?.classList.remove('levelup');
        void box.current?.offsetWidth;
        box.current?.classList.add('levelup');
        tween(target, 700);
      });
    } else tween(target, 800);
    prev.current = level.level;
    return () => cancelAnimationFrame(raf.current);
  }, [level.level, target]);
  useEffect(() => {
    if (!ping || !box.current) return;
    box.current.classList.remove('ring-ping');
    void box.current.offsetWidth;
    box.current.classList.add('ring-ping');
  }, [ping]);
  const R = 27;
  const C = 2 * Math.PI * R;
  return (
    <div
      ref={box}
      className="level-ring"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={level.need}
      aria-valuenow={level.into}
      aria-label={t('xp', { a: level.into, b: level.need })}
    >
      <svg viewBox="0 0 64 64" width="64" height="64" aria-hidden="true">
        <defs>
          <linearGradient id="ringFill" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#A5B4FC" />
            <stop offset="1" stopColor="#4F46E5" />
          </linearGradient>
        </defs>
        <circle cx="32" cy="32" r={R} fill="none" stroke="rgb(99 102 241 / .16)" strokeWidth="6" />
        <circle
          cx="32"
          cy="32"
          r={R}
          fill="none"
          stroke="url(#ringFill)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${Math.max(0.001, pct) * C} ${C}`}
          transform="rotate(-90 32 32)"
        />
      </svg>
      <span ref={ref} className="ring-core">
        <small>{t('lv')}</small>
        <b>{level.level}</b>
      </span>
    </div>
  );
});

const Hud = forwardRef(function Hud({ t, hello, title, level, ping, chain, frozen, stage, stageLabel, onSettings, onChain, onGrowth }, ringRef) {
  const tier = flameTier(chain);
  return (
    <header className="hud">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="hud-hello">{hello}</p>
          <h1 className="hud-title truncate">{title}</h1>
        </div>
        <button type="button" className="glass-btn" onClick={onSettings} aria-label={t('settings.open')}>
          <SlidersHorizontal size={20} />
        </button>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <button type="button" className="glass-chip" onClick={onChain} aria-label={`${t('streak.current')}: ${chain}`}>
          <span className="chip-ico" style={{ background: frozen ? 'linear-gradient(180deg,#E6F6FF,#CFEAFE)' : 'linear-gradient(180deg,#FFF3E2,#FFE0C4)' }}>
            {frozen ? <Snowflake size={20} color="#38BDF8" /> : <Flame tier={tier} size={24} dim={chain === 0} />}
          </span>
          <span className="flex flex-col items-start leading-tight">
            <b>{chain === 1 ? t('chip.day') : chain > 0 ? t('chip.days', { n: chain }) : t('chip.start')}</b>
            <small>{t('chip.chain')}</small>
          </span>
        </button>
        <LevelRing ref={ringRef} t={t} level={level} ping={ping} />
        <button type="button" className="glass-chip" onClick={onGrowth} aria-label={`${t('chip.growth')}: ${stageLabel}`}>
          <span className="chip-ico" style={{ background: 'linear-gradient(180deg,#EAFBF1,#CFF3DD)' }}>
            <Plant stage={stage} size={24} soil={false} />
          </span>
          <span className="flex min-w-0 flex-col items-start leading-tight">
            <b className="max-w-[78px] truncate">{stageLabel}</b>
            <small>{t('chip.growth')}</small>
          </span>
        </button>
      </div>
    </header>
  );
});

export default Hud;
