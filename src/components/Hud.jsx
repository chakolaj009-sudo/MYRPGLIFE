import { forwardRef, useEffect, useRef, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';

/** Level meter: the XP orbs fly into it. One JS tween drives the fill so it also works in Safari. */
const LevelStat = forwardRef(function LevelStat({ t, level, ping }, ref) {
  const target = level.into / level.need;
  const [pct, setPct] = useState(target);
  const cur = useRef(target);
  const prev = useRef(level.level);
  const raf = useRef(0);
  const box = useRef(null);
  const pulse = (cls) => {
    const el = box.current;
    if (!el) return;
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  };
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
      tween(1, 360, () => {
        cur.current = 0;
        setPct(0);
        pulse('levelup');
        tween(target, 480);
      });
    } else tween(target, 480);
    prev.current = level.level;
    return () => cancelAnimationFrame(raf.current);
  }, [level.level, target]);
  useEffect(() => {
    if (ping) pulse('ping');
  }, [ping]);
  return (
    <div
      ref={box}
      className="stat stat-level"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={level.need}
      aria-valuenow={level.into}
      aria-label={t('xp', { a: level.into, b: level.need })}
    >
      <span className="t-label">{t('stats.level')}</span>
      <span className="t-data">
        <b ref={ref} className="inline-block font-[650]">
          {level.level}
        </b>
        <small className="num" dir="ltr">
          {level.into}/{level.need}
        </small>
      </span>
      <span className="meter" aria-hidden="true">
        <span style={{ transform: `scaleX(${Math.max(0, Math.min(1, pct))})` }} />
      </span>
    </div>
  );
});

const Hud = forwardRef(function Hud({ t, hello, title, level, ping, month, stageLabel, onSettings, onMonth, onGrowth, boxRef }, ringRef) {
  const days = month === 0 ? t('chip.begin') : month === 1 ? t('chip.days1') : t('chip.days', { n: month });
  return (
    <header ref={boxRef} className="hud">
      <div className="hud-top">
        <div className="min-w-0 flex-1">
          <p className="t-label hud-date truncate">{hello}</p>
          <h1 className="t-display hud-title truncate">{title}</h1>
        </div>
        <button type="button" className="icon-btn" onClick={onSettings} aria-label={t('settings.open')}>
          <SlidersHorizontal size={18} strokeWidth={2} />
        </button>
      </div>
      <div className="status">
        <button type="button" className="stat" onClick={onMonth} aria-label={`${t('chip.month')}: ${days}`}>
          <span className="t-label">{t('chip.month')}</span>
          <span className="t-data">{days}</span>
        </button>
        <LevelStat ref={ringRef} t={t} level={level} ping={ping} />
        <button type="button" className="stat" onClick={onGrowth} aria-label={`${t('chip.growth')}: ${stageLabel}`}>
          <span className="t-label">{t('chip.growth')}</span>
          <span className="t-data">{stageLabel}</span>
        </button>
      </div>
    </header>
  );
});

export default Hud;
