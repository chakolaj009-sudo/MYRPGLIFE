import { useEffect, useRef, useState } from 'react';
import { keyToLocalDate } from '../domain/dates.js';
import { MAX_TITLE } from '../domain/model.js';
import { itemTitle } from '../lib/i18n.js';
import { iconKey } from './Art.jsx';
import { CompanionArt } from './Companion.jsx';

const THEMED = ['walk', 'book', 'water', 'lotus'];
const ANSWERS = ['mornings', 'small', 'rest', 'people', 'outside'];

/** Plain-language lines for a week story (see weekStory() in the model). */
export function storyLines(t, story, locale) {
  const day = (k) => new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(keyToLocalDate(k));
  const lines = [];
  const p = story.pattern;
  if (p?.item) {
    const k = iconKey(p.item.icon);
    if (THEMED.includes(k) && p.count > 1) lines.push(t(`reflect.pattern.${k}`, { n: p.count }));
    else lines.push(p.count > 1 ? t('reflect.pattern', { habit: itemTitle(t, p.item), n: p.count }) : t('reflect.pattern1', { habit: itemTitle(t, p.item) }));
  }
  const m = story.moment;
  if (m) {
    if (m.type === 'full') lines.push(t('reflect.moment.full', { day: day(m.date) }));
    else lines.push(t(`reflect.moment.${m.type}`, { day: day(m.date), habit: itemTitle(t, m.item, m.type === 'minimum') }));
  }
  const c = story.change;
  if (c.type === 'growth') {
    const k = THEMED.includes(iconKey(c.item.icon)) ? iconKey(c.item.icon) : 'any';
    lines.push(t('reflect.change.growth', { thing: t(`g.${k}.${c.tier}`), habit: itemTitle(t, c.item) }));
  } else if (c.type === 'stage') lines.push(t('reflect.change.stage', { stage: t(`stage.${c.stage}`) }));
  else lines.push(t('reflect.change.quiet'));
  return lines;
}

export default function Reflection({ t, story, locale, species, onDone }) {
  const lines = storyLines(t, story, locale);
  const [shown, setShown] = useState(0);
  const [answer, setAnswer] = useState(null);
  const [other, setOther] = useState('');
  const [thanks, setThanks] = useState(false);
  const input = useRef(null);
  const panel = useRef(null);

  useEffect(() => {
    panel.current?.focus();
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return setShown(lines.length + 1);
    const ids = [0, 1, 2, 3].map((i) => setTimeout(() => setShown(i + 1), 500 + i * 1100));
    return () => ids.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finish = (value) => {
    if (value) {
      setThanks(true);
      setTimeout(() => onDone(value), 1300);
    } else onDone(null);
  };
  const picked = answer === 'other' ? other.trim() : answer ? t(`reflect.a.${answer}`) : '';

  return (
    <div className="reflect fade-in" role="dialog" aria-modal="true" aria-labelledby="reflect-h">
      <div ref={panel} tabIndex={-1} className="reflect-panel safe-top safe-bottom focus:outline-none">
        <div className="flex flex-col items-center pt-6">
          <CompanionArt species={species} mood={thanks ? 'happy' : 'calm'} size={112} />
          <h2 id="reflect-h" className="mt-2 text-[13px] font-bold uppercase tracking-[0.12em] text-white/70">
            {t('reflect.title')}
          </h2>
        </div>
        {thanks ? (
          <p className="reflect-line mt-8 text-center text-xl font-bold" role="status">
            {t('reflect.thanks')}
          </p>
        ) : (
          <>
            <ol className="m-0 mt-5 list-none space-y-3 p-0">
              {lines.map((l, i) => (
                <li key={i} className={`reflect-line ${shown > i ? 'on' : ''}`}>
                  {l}
                </li>
              ))}
            </ol>
            <div className={`reflect-ask ${shown > lines.length ? 'on' : ''}`}>
              <p className="mb-3 mt-7 text-center text-lg font-extrabold">{t('reflect.ask')}</p>
              <div className="flex flex-wrap justify-center gap-2" role="radiogroup" aria-label={t('reflect.ask')}>
                {[...ANSWERS, 'other'].map((a) => (
                  <button
                    key={a}
                    type="button"
                    role="radio"
                    aria-checked={answer === a}
                    onClick={() => {
                      setAnswer(a);
                      if (a === 'other') setTimeout(() => input.current?.focus(), 50);
                    }}
                    className={`reflect-chip ${answer === a ? 'on' : ''}`}
                  >
                    {a === 'other' ? t('reflect.other') : t(`reflect.a.${a}`)}
                  </button>
                ))}
              </div>
              {answer === 'other' && (
                <input
                  ref={input}
                  value={other}
                  onChange={(e) => setOther(e.target.value)}
                  maxLength={MAX_TITLE}
                  enterKeyHint="done"
                  aria-label={t('reflect.other')}
                  onKeyDown={(e) => e.key === 'Enter' && picked && finish(picked)}
                  className="mt-3 h-12 w-full rounded-2xl bg-white/95 px-4 text-base text-ink placeholder:text-muted focus:outline-none"
                />
              )}
              <div className="mt-6 flex flex-col gap-2">
                <button type="button" disabled={!picked} onClick={() => finish(picked)} className="h-12 rounded-2xl bg-white text-base font-bold text-primary-deep disabled:opacity-40">
                  {t('reflect.save')}
                </button>
                <button type="button" onClick={() => finish(null)} className="h-11 rounded-2xl text-sm font-semibold text-white/80">
                  {t('reflect.skip')}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
