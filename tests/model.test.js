import { describe, it, expect } from 'vitest';
import * as D from '../src/domain/dates.js';
import * as M from '../src/domain/model.js';

const mem = (init = {}) => {
  const m = new Map(Object.entries(init));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), map: m };
};

/** Mark `n` tasks done on each listed day (in date order, like real use). */
function withDays(spec, state = M.createState()) {
  let s = state;
  for (const key of Object.keys(spec).sort()) {
    const n = spec[key];
    s = M.prepareDay(s, key).state;
    const ids = s.days[key].items.map((i) => i.id).slice(0, n);
    for (const id of ids) s = M.toggleItem(s, key, id);
  }
  return s;
}

describe('dates', () => {
  it('uses local calendar dates, not UTC', () => {
    expect(D.todayKey(new Date(2026, 8, 27, 23, 30))).toBe('2026-09-27');
    expect(D.todayKey(new Date(2026, 8, 28, 0, 5))).toBe('2026-09-28');
  });
  it('does arithmetic across months, years and DST', () => {
    expect(D.addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(D.addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(D.addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(D.addDays('2026-03-29', 1)).toBe('2026-03-30');
    expect(D.diffDays('2026-01-01', '2026-12-31')).toBe(364);
  });
  it('weeks are Monday–Sunday', () => {
    expect(D.mondayIndex('2026-09-28')).toBe(0);
    expect(D.mondayIndex('2026-09-27')).toBe(6);
    expect(D.weekStart('2026-09-27')).toBe('2026-09-21');
  });
  it('validates keys', () => {
    expect(D.isValidKey('2026-02-30')).toBe(false);
    expect(D.isValidKey('2026-9-1')).toBe(false);
    expect(D.isValidKey('2026-09-01')).toBe(true);
  });
});

describe('toggling & derived totals', () => {
  it('repeated toggles never drift totals or XP', () => {
    let s = M.ensureDay(M.createState(), '2026-09-27');
    const id = s.days['2026-09-27'].items[0].id;
    for (let i = 0; i < 9; i++) s = M.toggleItem(s, '2026-09-27', id);
    expect(M.stats(s, '2026-09-27').totalTasks).toBe(1);
    expect(M.stats(s, '2026-09-27').xp).toBe(M.XP_PER_TASK);
    s = M.toggleItem(s, '2026-09-27', id);
    expect(M.stats(s, '2026-09-27').xp).toBe(0);
  });
  it('all-done bonus appears and disappears with unchecking', () => {
    let s = withDays({ '2026-09-27': 4 });
    expect(M.stats(s, '2026-09-27').xp).toBe(4 * M.XP_PER_TASK + M.ALL_DONE_BONUS);
    s = M.toggleItem(s, '2026-09-27', s.days['2026-09-27'].items[0].id);
    expect(M.stats(s, '2026-09-27').allDone).toBe(false);
    expect(M.stats(s, '2026-09-27').xp).toBe(3 * M.XP_PER_TASK);
  });
  it('custom tasks carry over unfinished, routines start fresh', () => {
    let s = M.addCustom(M.createState(), '2026-09-26', 'Call the bank', 'c1');
    s = M.addCustom(s, '2026-09-26', 'Water plants', 'c2', 'water', 'Look at them');
    s = M.toggleItem(s, '2026-09-26', 'c2');
    s = M.toggleItem(s, '2026-09-26', 'r-bed');
    s = M.ensureDay(s, '2026-09-27');
    const items = s.days['2026-09-27'].items.map((i) => i.id);
    expect(items).toContain('c1');
    expect(items).not.toContain('c2');
    expect(s.days['2026-09-26'].items.find((i) => i.id === 'c2').mini).toBe('Look at them');
  });
  it('editing routines (incl. tiny versions) changes today only', () => {
    let s = withDays({ '2026-09-26': 4 });
    s = M.ensureDay(s, '2026-09-27');
    s = M.toggleItem(s, '2026-09-27', 'r-bed');
    s = M.setRoutines(s, '2026-09-27', [
      { id: 'r-bed', key: 'routine.bed', icon: 'bed' },
      { id: 'r-x', title: 'Read 20 minutes', mini: 'Read 1 page', icon: 'book' },
    ]);
    expect(s.days['2026-09-27'].items.map((i) => i.id)).toEqual(['r-bed', 'r-x']);
    expect(s.days['2026-09-27'].items[1].mini).toBe('Read 1 page');
    expect(s.days['2026-09-27'].done).toEqual(['r-bed']);
    expect(s.days['2026-09-26'].items).toHaveLength(4);
  });
});

describe('Minimum Day & gentle comeback', () => {
  it('a Minimum Day counts fully toward showing up, with slightly lower XP', () => {
    let s = M.ensureDay(M.createState(), '2026-09-27');
    s = M.setMinimum(s, '2026-09-27', true);
    s = M.toggleItem(s, '2026-09-27', 'r-read');
    const st = M.stats(s, '2026-09-27');
    expect(st.minimum).toBe(true);
    expect(st.month).toBe(1);
    expect(st.activeDays).toBe(1);
    expect(st.xp).toBe(M.XP_PER_TASK_MIN);
    s = M.setMinimum(s, '2026-09-27', false);
    expect(M.stats(s, '2026-09-27').xp).toBe(M.XP_PER_TASK);
  });
  it('an all-done Minimum Day still earns the full-day bonus', () => {
    let s = M.setMinimum(M.ensureDay(M.createState(), '2026-09-27'), '2026-09-27', true);
    for (const i of s.days['2026-09-27'].items) s = M.toggleItem(s, '2026-09-27', i.id);
    expect(M.stats(s, '2026-09-27').xp).toBe(4 * M.XP_PER_TASK_MIN + M.ALL_DONE_BONUS);
  });
  it('after a gap the app opens straight into a Minimum Day', () => {
    const s = withDays({ '2026-09-20': 2 });
    const next = M.prepareDay(s, '2026-09-21');
    expect(next.comeback).toBe(false);
    expect(next.state.days['2026-09-21'].minimum).toBeUndefined();
    const back = M.prepareDay(s, '2026-09-24');
    expect(back.comeback).toBe(true);
    expect(back.state.days['2026-09-24']).toMatchObject({ minimum: true, comeback: true });
    // re-opening the same day doesn't announce it again
    expect(M.prepareDay(back.state, '2026-09-24').comeback).toBe(false);
  });
  it('opening the app without doing anything is still a gap', () => {
    let s = withDays({ '2026-09-20': 1 });
    s = M.prepareDay(s, '2026-09-21').state; // opened, nothing done
    expect(M.prepareDay(s, '2026-09-22').comeback).toBe(true);
  });
  it('first ever day is never a comeback', () => {
    expect(M.prepareDay(M.createState(), '2026-09-27').comeback).toBe(false);
  });
  it('missing days never erases anything', () => {
    const s = withDays({ '2026-09-01': 2, '2026-09-02': 1, '2026-09-10': 3 });
    const st = M.stats(M.prepareDay(s, '2026-09-27').state, '2026-09-27');
    expect(st.month).toBe(3);
    expect(st.activeDays).toBe(3);
    expect(st.totalTasks).toBe(6);
  });
  it('"showed up this month" resets with the calendar month, totals do not', () => {
    const s = withDays({ '2026-09-29': 1, '2026-09-30': 1, '2026-10-01': 1 });
    const st = M.stats(s, '2026-10-01');
    expect(st.month).toBe(1);
    expect(st.activeDays).toBe(3);
  });
});

describe('growth from real habits', () => {
  it('counts lifetime completions per habit and maps them to tiers', () => {
    const spec = {};
    for (let i = 0; i < 8; i++) spec[D.addDays('2026-09-01', i)] = 1; // r-teeth each day
    const s = withDays(spec);
    expect(M.habitCounts(s)['r-teeth']).toBe(8);
    expect(M.growthTier(0)).toBe(0);
    expect(M.growthTier(1)).toBe(1);
    expect(M.growthTier(8)).toBe(3);
    expect(M.growthTier(1000)).toBe(M.GROWTH_STEPS.length);
  });
  it('unchecking lowers the count (derived), pruning keeps it', () => {
    const spec = {};
    for (let i = 0; i < 20; i++) spec[D.addDays('2026-01-01', i)] = 2;
    const s = withDays(spec);
    const p = M.prune(s, '2026-01-20', 5);
    expect(M.habitCounts(p)).toEqual(M.habitCounts(s));
    const u = M.toggleItem(s, '2026-01-20', 'r-teeth');
    expect(M.habitCounts(u)['r-teeth']).toBe(19);
  });
});

describe('pruning', () => {
  const spec = {};
  for (let i = 0; i < 30; i++) spec[D.addDays('2026-01-01', i)] = 2;
  const s = withDays(spec);
  it('folds old days into the archive without changing totals', () => {
    const before = M.stats(s, '2026-02-20');
    const p = M.prune(s, '2026-02-20', 10);
    const after = M.stats(p, '2026-02-20');
    expect(Object.keys(p.days).length).toBeLessThan(Object.keys(s.days).length);
    for (const k of ['totalTasks', 'xp', 'activeDays']) expect(after[k]).toBe(before[k]);
    expect(M.stats(M.prune(p, '2026-02-20', 10), '2026-02-20')).toEqual(after);
  });
  it('never prunes into the current month', () => {
    const p = M.prune(s, '2026-01-30', 10);
    expect(Object.keys(p.days)).toEqual(Object.keys(s.days));
    expect(M.stats(p, '2026-01-30').month).toBe(30);
  });
});

describe('persistence, normalisation & migration', () => {
  it('round-trips through storage', () => {
    const store = mem();
    const s = withDays({ '2026-09-27': 2 });
    M.save(store, s);
    expect(M.load(store, '2026-09-27')).toEqual(s);
  });
  it('survives malformed data', () => {
    const s = M.normalize({
      schema: 2,
      routines: [null, { id: 5 }, { id: 'ok', title: '  Walk  ', mini: ' ' }, { id: 'ok', title: 'dup' }],
      days: {
        'not-a-date': { items: [], done: [] },
        '2026-02-30': { items: [], done: [] },
        '2026-09-27': { items: [{ id: 'a', title: 'A' }, 'junk', { id: 'a', title: 'dup' }], done: ['a', 'a', 'ghost', 3], minimum: 'yes' },
        '2026-09-26': 'garbage',
      },
      reflections: { '2026-09-21': { answer: 42 }, bad: {} },
      keepsakes: [{ id: 'k', type: 'comeback', date: 'nope' }, { id: 'k2', type: 'comeback', date: '2026-09-20' }],
      grown: { a: 3, b: 99, c: 'x' },
      seen: 'x',
      archive: { tasks: -5, xp: 'lots', habits: { a: -1, b: 4 } },
    });
    expect(s.routines).toEqual([{ id: 'ok', title: 'Walk' }]);
    expect(Object.keys(s.days)).toEqual(['2026-09-27']);
    expect(s.days['2026-09-27']).toEqual({ items: [{ id: 'a', kind: 'custom', title: 'A' }], done: ['a'] });
    expect(s.reflections).toEqual({ '2026-09-21': { answer: null, on: '2026-09-21' } });
    expect(s.keepsakes.map((k) => k.id)).toEqual(['k2']);
    expect(s.grown).toEqual({ a: 3 });
    expect(s.archive.habits).toEqual({ b: 4 });
    expect(s.archive.tasks).toBe(0);
  });
  it('corrupt JSON falls back safely and keeps a backup copy', () => {
    const store = mem({ [M.STORAGE_KEY]: '{oops' });
    const s = M.load(store, '2026-09-27');
    expect(s.schema).toBe(M.SCHEMA_VERSION);
    expect(store.map.get(`${M.STORAGE_KEY}.corrupt`)).toBe('{oops');
  });
  it('migrates schema 1 (streak era) without losing completions', () => {
    const v1 = {
      schema: 1,
      routines: [{ id: 'r-read', key: 'routine.read', icon: 'book' }],
      days: {
        '2026-09-20': { items: [{ id: 'r-read', kind: 'routine', key: 'routine.read' }], done: ['r-read'] },
        '2026-09-21': { items: [], done: [], frozen: true },
      },
      seen: ['streak-7'],
      archive: { tasks: 10, xp: 100, activeDays: 5, bestStreak: 9, runAtCutoff: 2, cutoff: '2025-08-01' },
    };
    const s = M.normalize(v1);
    expect(s.schema).toBe(2);
    expect(s.days['2026-09-21']).toEqual({ items: [], done: [] });
    expect(s.archive).toEqual({ tasks: 10, xp: 100, activeDays: 5, habits: {}, cutoff: '2025-08-01' });
    const st = M.stats(s, '2026-09-27');
    expect(st.totalTasks).toBe(11);
    expect(st.activeDays).toBe(6);
  });
  it('keeps unknown fields from newer versions', () => {
    const s = M.normalize({ schema: 7, futureThing: { a: 1 }, days: {} });
    expect(s.futureThing).toEqual({ a: 1 });
    expect(s.schema).toBe(7);
  });
  it('imports the legacy Life RPG prototype without inventing history', () => {
    const store = mem({
      arch_record_v1: JSON.stringify({ xp: 120, habits: [{ id: 1, txt: 'מקלחת קרה', done: true }, { id: 2, txt: 'סידור מיטה' }], history: { '2026-01-19': 40 } }),
      bridge_rpg_v1: JSON.stringify({ xp: 30, tasks: [{ id: 9, txt: 'לבדוק דואר', done: false }, { id: 8, txt: 'x', done: true }] }),
    });
    const s = M.load(store, '2026-09-27');
    expect(s.routines.map((r) => r.title || r.key)).toEqual(['routine.teeth', 'routine.bed', 'routine.read', 'routine.mind', 'מקלחת קרה']);
    expect(s.days['2026-09-27'].items.map((i) => i.title).filter(Boolean)).toEqual(['מקלחת קרה', 'לבדוק דואר']);
    expect(s.archive.xp).toBe(120);
    const st = M.stats(s, '2026-09-27');
    expect(st.totalTasks).toBe(0);
    expect(st.level.level).toBe(2);
    expect(store.map.has('arch_record_v1')).toBe(true);
  });
});

describe('growth stages, levels, medals & companions', () => {
  it('growth stages follow all-time tasks', () => {
    expect([0, 4, 5, 15, 30, 49, 50, 100, 999].map((n) => M.stageFor(n).id)).toEqual([
      'seed', 'seed', 'sprout', 'young', 'sapling', 'sapling', 'mature', 'ancient', 'ancient',
    ]);
  });
  it('levels', () => {
    expect(M.levelFromXp(0)).toEqual({ level: 1, into: 0, need: 50 });
    expect(M.levelFromXp(50)).toEqual({ level: 2, into: 0, need: 75 });
  });
  it('medals and companions unlock from showing up, not streaks', () => {
    const spec = {};
    for (let i = 0; i < 7; i++) spec[D.addDays('2026-09-01', i * 3)] = 1; // 7 scattered days
    const s = withDays(spec);
    const st = M.stats(s, '2026-09-30');
    expect(st.achievements.find((a) => a.id === 'days-7').unlocked).toBe(true);
    expect(st.companions.map((c) => c.unlocked)).toEqual([true, true, false]);
    expect(M.newlyUnlocked(s, st)).toEqual(['buddy-luma']);
    expect(M.newlyUnlocked(M.markSeen(s, ['buddy-luma']), st)).toEqual([]);
  });
  it('profile: name and companion are validated', () => {
    const s = M.normalize({ schema: 2, name: '  Dana  ', buddy: 'dragon', days: {} });
    expect(s.name).toBe('Dana');
    expect(s.buddy).toBe('moji');
    expect(M.setProfile(s, { name: '', buddy: 'luma' })).toMatchObject({ name: null, buddy: 'luma' });
  });
});

describe('growth appears overnight and never wilts', () => {
  it('today plants, tomorrow reveals', () => {
    let s = withDays({ '2026-09-27': 1 }); // r-teeth once
    let g = M.worldGrowth(s, '2026-09-27');
    expect(g['r-teeth']).toEqual({ visible: 0, pending: true });
    g = M.worldGrowth(M.prepareDay(s, '2026-09-28').state, '2026-09-28');
    expect(g['r-teeth']).toEqual({ visible: 1, pending: false });
  });
  it('discoveries are shown once, then remembered', () => {
    let s = withDays({ '2026-09-26': 1, '2026-09-27': 1, '2026-09-28': 1 });
    s = M.prepareDay(s, '2026-09-29').state;
    expect(M.discoveries(s, '2026-09-29')).toEqual(['r-teeth']);
    s = M.markGrown(s, '2026-09-29');
    expect(s.grown['r-teeth']).toBe(2); // 3 completions → tier 2
    expect(M.discoveries(s, '2026-09-29')).toEqual([]);
  });
  it('coming back after days away reveals what grew from the last visit', () => {
    let s = withDays({ '2026-09-20': 4 });
    s = M.markGrown(M.prepareDay(s, '2026-09-20').state, '2026-09-20'); // seen nothing yet
    s = M.prepareDay(s, '2026-09-24').state; // back after 3 days
    expect(M.discoveries(s, '2026-09-24').sort()).toEqual(['r-bed', 'r-mind', 'r-read', 'r-teeth']);
  });
  it('seen growth never goes down, even if today is unchecked', () => {
    let s = withDays({ '2026-09-27': 1 });
    s = M.markGrown(M.prepareDay(s, '2026-09-28').state, '2026-09-28');
    s = M.toggleItem(s, '2026-09-28', 'r-teeth');
    s = M.toggleItem(s, '2026-09-28', 'r-teeth');
    expect(s.grown['r-teeth']).toBe(1);
    expect(M.worldGrowth(s, '2026-09-28')['r-teeth'].visible).toBe(1);
  });
});

describe('weekly reflection', () => {
  // Week of Mon 2026-09-14 … Sun 2026-09-20
  function week() {
    let s = M.createState();
    s.routines.push({ id: 'r-walk', title: 'Walk', mini: 'Step outside', icon: 'walk' });
    const plan = { '2026-09-14': ['r-walk', 'r-read'], '2026-09-15': ['r-walk'], '2026-09-17': ['r-walk', 'r-teeth'], '2026-09-19': ['r-walk'] };
    for (const k of ['2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18', '2026-09-19']) {
      s = M.prepareDay(s, k).state;
      if (k === '2026-09-17') s = M.setMinimum(s, k, true);
      for (const id of plan[k] || []) s = M.toggleItem(s, k, id);
    }
    return s;
  }
  it('is offered once, on the first open of the next week', () => {
    const s = week();
    expect(M.pendingReflection(s, '2026-09-19')).toBe(null); // the week isn't over yet
    expect(M.pendingReflection(s, '2026-09-21')).toBe('2026-09-14');
    const r = M.recordReflection(s, '2026-09-14', 'Mornings', '2026-09-21');
    expect(M.pendingReflection(r, '2026-09-22')).toBe(null);
    expect(M.pendingReflection(M.recordReflection(s, '2026-09-14', null, '2026-09-21'), '2026-09-21')).toBe(null); // skipped counts as seen
  });
  it('is not offered for a week without showing up', () => {
    expect(M.pendingReflection(week(), '2026-09-28')).toBe(null);
  });
  it('tells a pattern, one real moment and what changed', () => {
    const story = M.weekStory(week(), '2026-09-14');
    expect(story.pattern.item.id).toBe('r-walk');
    expect(story.pattern.count).toBe(4);
    expect(story.moment).toMatchObject({ type: 'minimum', date: '2026-09-17' });
    expect(story.change).toMatchObject({ type: 'growth', tier: 2 });
    expect(story.change.item.id).toBe('r-walk');
  });
  it('quotes past answers back only occasionally and only when older than 2 weeks', () => {
    const s = M.recordReflection(week(), '2026-09-14', 'Mornings', '2026-09-21');
    const days = Array.from({ length: 30 }, (_, i) => D.addDays('2026-09-21', i));
    const hits = days.map((k) => M.pastAnswer(s, k)).filter(Boolean);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.length).toBeLessThan(10);
    expect(days.filter((k) => D.diffDays('2026-09-14', k) < 14).every((k) => M.pastAnswer(s, k) === null)).toBe(true);
    expect(hits[0].answer).toBe('Mornings');
  });
});
