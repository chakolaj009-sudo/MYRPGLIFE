import { forwardRef, useEffect, useRef, useState } from 'react';
import { SlidersHorizontal, Snowflake } from 'lucide-react';
import Scene from './Scene.jsx';
import Companion from './Companion.jsx';
import Plant from './Plant.jsx';
import { Flame, flameTier } from './Art.jsx';

// XP arc around the companion (hero coordinates: 390 × 380).
const CX = 195;
const CY = 206;
const R = 100;
const A0 = 215; // start angle (deg, math orientation), bottom-left
const SWEEP = 250; // clockwise over the top to bottom-right
const pt = (deg) => [CX + R * Math.cos((deg * Math.PI) / 180), CY - R * Math.sin((deg * Math.PI) / 180)];
const [SX, SY] = pt(A0);
const [EX, EY] = pt(A0 - SWEEP);
const ARC = `M${SX.toFixed(1)} ${SY.toFixed(1)} A${R} ${R} 0 1 1 ${EX.toFixed(1)} ${EY.toFixed(1)}`;

// One JS tween drives both the arc length and its tip (Safari can't transition SVG cx/cy).
function useArcProgress(level) {
  const target = level.into / level.need;
  const [pct, setPct] = useState(target);
  const cur = useRef(target);
  const prev = useRef(level.level);
  const raf = useRef(0);
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const tween = (to, ms, done) => {
      cancelAnimationFrame(raf.current);
      const from = cur.current;
      const t0 = performance.now();
      const step = (now) => {
        const k = reduce ? 1 : Math.min(1, (now - t0) / ms);
        const v = from + (to - from) * (1 - Math.pow(1 - k, 3));
        cur.current = v;
        setPct(v);
        if (k < 1) raf.current = requestAnimationFrame(step);
        else done && done();
      };
      raf.current = requestAnimationFrame(step);
    };
    if (level.level > prev.current) {
      tween(1, 700, () => {
        cur.current = 0;
        setPct(0);
        tween(target, 700);
      });
    } else tween(target, 900);
    prev.current = level.level;
    return () => cancelAnimationFrame(raf.current);
  }, [level.level, target]);
  return pct;
}

const Hero = forwardRef(function Hero(
  { t, phase, hello, title, sub, level, chain, frozen, stage, stageLabel, species, wear, cheer, celebrate, sayings, greet, ping, onSettings, onChain, onGrowth },
  tipRef,
) {
  const pct = useArcProgress(level);
  const [tx, ty] = pt(A0 - SWEEP * pct);
  const pill = useRef(null);
  const prevLevel = useRef(level.level);
  useEffect(() => {
    if (level.level > prevLevel.current && pill.current) {
      pill.current.classList.remove('levelup');
      void pill.current.offsetWidth;
      pill.current.classList.add('levelup');
    }
    prevLevel.current = level.level;
  }, [level.level]);
  const tipWrap = useRef(null);
  useEffect(() => {
    const el = tipWrap.current;
    if (!ping || !el) return;
    el.classList.remove('ping');
    void el.getBoundingClientRect();
    el.classList.add('ping');
  }, [ping]);

  const tier = flameTier(chain);
  return (
    <section className={`hero ${phase === 'night' ? 'night' : ''}`} aria-label={t('hero.label')}>
      <Scene phase={phase} stageIndex={stage.index} />
      <div className="hero-top">
        <div className="min-w-0">
          <p className="hero-hello">{hello}</p>
          <h1 className="hero-name truncate">{title}</h1>
          <p className="hero-sub">{sub}</p>
        </div>
        <button type="button" className="icon-btn shrink-0" onClick={onSettings} aria-label={t('settings.open')}>
          <SlidersHorizontal size={20} />
        </button>
      </div>

      <svg className="xp-arc" viewBox="0 0 390 380" aria-hidden="true">
        <defs>
          <linearGradient id="arcFill" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="#8B93FF" />
            <stop offset="1" stopColor="#5B4BFF" />
          </linearGradient>
        </defs>
        <path className="arc-track" d={ARC} />
        <path className="arc-glow" d={ARC} pathLength="100" strokeDasharray={`${pct * 100} 100`} />
        <path className="arc-fill" d={ARC} pathLength="100" strokeDasharray={`${pct * 100} 100`} />
        <g ref={tipWrap} className="arc-tip-wrap">
          <circle ref={tipRef} className="arc-tip" cx={tx} cy={ty} r="6.5" />
        </g>
      </svg>

      <Companion species={species} label={t('buddy.label', { name: t(`buddy.${species}`) })} sayings={sayings} wear={wear} cheer={cheer} celebrate={celebrate} greet={greet} />

      <button type="button" className="chip chip-start" onClick={onChain} aria-label={`${t('streak.current')}: ${chain}`}>
        <span className="chip-icon" style={{ background: frozen ? 'linear-gradient(180deg,#E6F6FF,#CFEAFE)' : 'linear-gradient(180deg,#FFF3E2,#FFE3CC)' }}>
          {frozen ? <Snowflake size={24} color="#38BDF8" /> : <Flame tier={tier} dim={chain === 0} />}
        </span>
        <span className="chip-b">{chain > 0 ? t('chip.days', { n: chain }) : t('chip.start')}</span>
        <span className="chip-s">{t('chip.chain')}</span>
      </button>

      <button type="button" className="chip chip-end" onClick={onGrowth} aria-label={`${t('chip.growth')}: ${stageLabel}`}>
        <span className="chip-icon" style={{ background: 'linear-gradient(180deg,#EAFBF1,#D3F4E1)' }}>
          <Plant stage={stage.id} size={30} soil={false} />
        </span>
        <span className="chip-b">{stageLabel}</span>
        <span className="chip-s">{t('chip.growth')}</span>
      </button>

      <div ref={pill} className="level-pill" role="progressbar" aria-valuemin={0} aria-valuemax={level.need} aria-valuenow={level.into} aria-label={t('xp', { a: level.into, b: level.need })}>
        <span className="lv">
          {t('lv')} <b>{level.level}</b>
        </span>
        <span className="to">
          <b>{level.need - level.into}</b> {t('xp.toNext')}
        </span>
      </div>
    </section>
  );
});

export default Hero;
