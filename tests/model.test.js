import { describe, it, expect } from 'vitest';
import * as D from '../src/domain/dates.js';
import * as M from '../src/domain/model.js';

const mem = (init = {}) => {
  const m = new Map(Object.entries(init));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), map: m };
};

/** Mark `n` tasks done on each listed day. */
function withDays(spec, state = M.createState()) {
  let s = state;
  for (const [key, n] of Object.entries(spec)) {
    if (n === 'frozen') {
      s = { ...s, days: { ...s.days, [key]: { items: [], done: [], frozen: true } } };
      continue;
    }
    s = M.ensureDay(s, key);
    const ids = s.days[key].items.map((i) => i.id).slice(0, n);
    for (const id of ids) s = M.toggleItem(s, key, id);
  }
  return s;
}

describe('dates', () => {
  it('uses local calendar dates, not UTC', () => {
    // 23:30 local on Sep 27 is still Sep 27, whatever the UTC date is.
    expect(D.todayKey(new Date(2026, 8, 27, 23, 30))).toBe('2026-09-27');
    expect(D.todayKey(new Date(2026, 8, 28, 0, 5))).toBe('2026-09-28');
  });
  it('does arithmetic across months, years and DST', () => {
    expect(D.addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(D.addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(D.addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(D.addDays('2026-03-29', 1)).toBe('2026-03-30'); // EU DST
    expect(D.diffDays('2026-01-01', '2026-12-31')).toBe(364);
  });
  it('weeks are Monday–Sunday', () => {
    expect(D.mondayIndex('2026-09-28')).toBe(0); // Monday
    expect(D.mondayIndex('2026-09-27')).toBe(6); // Sunday
    expect(D.weekStart('2026-09-27')).toBe('2026-09-21');
    expect(D.weekDays('2026-09-30')[0]).toBe('2026-09-28');
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
    const st = M.stats(s, '2026-09-27');
    expect(st.totalTasks).toBe(1);
    expect(st.xp).toBe(M.XP_PER_TASK);
    s = M.toggleItem(s, '2026-09-27', id);
    expect(M.stats(s, '2026-09-27').totalTasks).toBe(0);
    expect(M.stats(s, '2026-09-27').xp).toBe(0);
  });
  it('all-done bonus appears and disappears with unchecking', () => {
    let s = withDays({ '2026-09-27': 4 });
    let st = M.stats(s, '2026-09-27');
    expect(st.allDone).toBe(true);
    expect(st.xp).toBe(4 * M.XP_PER_TASK + M.ALL_DONE_BONUS);
    s = M.toggleItem(s, '2026-09-27', s.days['2026-09-27'].items[0].id);
    st = M.stats(s, '2026-09-27');
    expect(st.allDone).toBe(false);
    expect(st.xp).toBe(3 * M.XP_PER_TASK);
  });
  it('unchecking today drops the streak back correctly', () => {
    let s = withDays({ '2026-09-25': 1, '2026-09-26': 1, '2026-09-27': 1 });
    expect(M.stats(s, '2026-09-27').current).toBe(3);
    s = M.toggleItem(s, '2026-09-27', s.days['2026-09-27'].done[0]);
    // Today is not over, so the chain from yesterday is still alive.
    expect(M.stats(s, '2026-09-27').current).toBe(2);
    expect(M.stats(s, '2026-09-27').bestStreak).toBe(2);
  });
  it('custom tasks carry over unfinished, routines start fresh', () => {
    let s = M.addCustom(M.createState(), '2026-09-26', 'Call the bank', 'c1');
    s = M.addCustom(s, '2026-09-26', 'Water plants', 'c2');
    s = M.toggleItem(s, '2026-09-26', 'c2');
    s = M.toggleItem(s, '2026-09-26', 'r-bed');
    s = M.ensureDay(s, '2026-09-27');
    const items = s.days['2026-09-27'].items.map((i) => i.id);
    expect(items).toContain('c1');
    expect(items).not.toContain('c2');
    expect(s.days['2026-09-27'].done).toEqual([]);
  });
  it('editing routines changes today only', () => {
    let s = withDays({ '2026-09-26': 4 });
    s = M.ensureDay(s, '2026-09-27');
    s = M.toggleItem(s, '2026-09-27', 'r-bed');
    s = M.setRoutines(s, '2026-09-27', [{ id: 'r-bed', key: 'routine.bed', icon: 'bed' }, { id: 'r-x', title: 'Stretch', icon: 'leaf' }]);
    expect(s.days['2026-09-27'].items.map((i) => i.id)).toEqual(['r-bed', 'r-x']);
    expect(s.days['2026-09-27'].done).toEqual(['r-bed']);
    expect(s.days['2026-09-26'].items).toHaveLength(4);
    expect(M.stats(s, '2026-09-27').totalTasks).toBe(5);
  });
});

describe('streak freeze', () => {
  it('protects exactly one missed day and records it on that date', () => {
    const s = withDays({ '2026-09-22': 1, '2026-09-23': 1 }); // Tue, Wed
    const { state, frozen } = M.applyFreezes(s, '2026-09-25'); // missed Thu 24
    expect(frozen).toBe('2026-09-24');
    expect(state.days['2026-09-24'].frozen).toBe(true);
    const st = M.stats(state, '2026-09-25');
    expect(st.current).toBe(2); // freeze does not add to the chain
    expect(st.totalTasks).toBe(2); // …nor to tasks
    expect(st.xp).toBe(2 * M.XP_PER_TASK); // …nor to XP
    expect(st.activeDays).toBe(2);
  });
  it('is idempotent', () => {
    const s = withDays({ '2026-09-22': 1 });
    const a = M.applyFreezes(s, '2026-09-24').state;
    const b = M.applyFreezes(a, '2026-09-24');
    expect(b.frozen).toBe(null);
    expect(b.state).toEqual(a);
  });
  it('does nothing without an existing chain', () => {
    expect(M.applyFreezes(M.createState(), '2026-09-24').frozen).toBe(null);
    const s = M.ensureDay(M.createState(), '2026-09-22'); // opened, nothing done
    expect(M.applyFreezes(s, '2026-09-24').frozen).toBe(null);
  });
  it('two or more missed days: no freeze spent, chain restarts', () => {
    const s = withDays({ '2026-09-21': 1 });
    const { state, frozen } = M.applyFreezes(s, '2026-09-24'); // missed 22 & 23
    expect(frozen).toBe(null);
    expect(state).toBe(s);
    expect(M.stats(state, '2026-09-24').current).toBe(0);
    expect(M.stats(state, '2026-09-24').freezeAvailable).toBe(true);
  });
  it('at most one per Monday–Sunday week', () => {
    let s = withDays({ '2026-09-21': 1 }); // Mon
    s = M.applyFreezes(s, '2026-09-23').state; // freeze Tue 22
    s = withDays({ '2026-09-23': 1 }, s);
    const r = M.applyFreezes(s, '2026-09-25'); // Thu 24 missed, same week
    expect(r.frozen).toBe(null);
    expect(M.stats(r.state, '2026-09-25').current).toBe(0);
    // next week a new freeze is available
    let t = withDays({ '2026-09-25': 1, '2026-09-26': 1 }, r.state);
    const r2 = M.applyFreezes(t, '2026-09-28'); // Sun 27 missed → still last week (used)
    expect(r2.frozen).toBe(null);
    t = withDays({ '2026-09-28': 1 }, t);
    const r3 = M.applyFreezes(t, '2026-09-30'); // Tue 29 missed → new week
    expect(r3.frozen).toBe('2026-09-29');
    expect(M.stats(r3.state, '2026-09-30').current).toBe(1);
  });
  it('chain continues through the frozen day once today is done', () => {
    let s = withDays({ '2026-09-22': 1, '2026-09-23': 1 });
    s = M.prepareDay(s, '2026-09-25').state;
    s = withDays({ '2026-09-25': 1 }, s);
    expect(M.stats(s, '2026-09-25').current).toBe(3);
    expect(M.stats(s, '2026-09-25').bestStreak).toBe(3);
  });
  it('a missed day right after a freeze is not protected', () => {
    let s = withDays({ '2026-09-22': 1 });
    s = M.applyFreezes(s, '2026-09-24').state; // 23 frozen
    const r = M.applyFreezes(s, '2026-09-25'); // 24 missed too
    expect(r.frozen).toBe(null);
  });
});

describe('pruning', () => {
  it('folds old days into the archive without changing totals or streaks', () => {
    const spec = {};
    for (let i = 0; i < 30; i++) spec[D.addDays('2026-01-01', i)] = 2;
    const s = withDays(spec);
    const today = '2026-01-30';
    const before = M.stats(s, today);
    const p = M.prune(s, today, 10);
    const after = M.stats(p, today);
    expect(Object.keys(p.days).length).toBeLessThan(Object.keys(s.days).length);
    expect(after.totalTasks).toBe(before.totalTasks);
    expect(after.xp).toBe(before.xp);
    expect(after.activeDays).toBe(before.activeDays);
    expect(after.current).toBe(before.current);
    expect(after.bestStreak).toBe(before.bestStreak);
    // pruning again is stable
    expect(M.stats(M.prune(p, today, 10), today)).toEqual(after);
  });
  it('keeps best streak from pruned history', () => {
    const spec = {};
    for (let i = 0; i < 20; i++) spec[D.addDays('2026-01-01', i)] = 1;
    spec['2026-03-01'] = 1;
    const p = M.prune(withDays(spec), '2026-03-02', 30);
    expect(M.stats(p, '2026-03-02').bestStreak).toBe(20);
    expect(M.stats(p, '2026-03-02').current).toBe(1);
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
    const bad = {
      schema: 1,
      routines: [null, { id: 5 }, { id: 'ok', title: '  Walk  ' }, { id: 'ok', title: 'dup' }],
      days: {
        'not-a-date': { items: [], done: [] },
        '2026-02-30': { items: [], done: [] },
        '2026-09-27': { items: [{ id: 'a', title: 'A' }, 'junk', { id: 'a', title: 'dup' }], done: ['a', 'a', 'ghost', 3] },
        '2026-09-26': 'garbage',
      },
      seen: 'x',
      archive: { tasks: -5, xp: 'lots' },
    };
    const s = M.normalize(bad);
    expect(s.routines).toEqual([{ id: 'ok', title: 'Walk' }]);
    expect(Object.keys(s.days)).toEqual(['2026-09-27']);
    expect(s.days['2026-09-27'].done).toEqual(['a']);
    expect(s.archive.tasks).toBe(0);
    expect(s.seen).toEqual([]);
    expect(M.stats(s, '2026-09-27').totalTasks).toBe(1);
  });
  it('corrupt JSON falls back safely and keeps a backup copy', () => {
    const store = mem({ [M.STORAGE_KEY]: '{oops' });
    const s = M.load(store, '2026-09-27');
    expect(s.schema).toBe(M.SCHEMA_VERSION);
    expect(store.map.get(`${M.STORAGE_KEY}.corrupt`)).toBe('{oops');
  });
  it('migrates pre-versioned objects', () => {
    const s = M.normalize({ routines: [{ id: 'x', title: 'X' }], days: {} });
    expect(s.schema).toBe(1);
    expect(s.routines[0].title).toBe('X');
  });
  it('keeps unknown fields from newer versions', () => {
    const s = M.normalize({ schema: 7, futureThing: { a: 1 }, days: {} });
    expect(s.futureThing).toEqual({ a: 1 });
    expect(s.schema).toBe(7);
  });
  it('imports the legacy Life RPG prototype without inventing history', () => {
    const store = mem({
      arch_record_v1: JSON.stringify({
        xp: 120,
        wordIdx: 2,
        habits: [
          { id: 1, txt: 'מקלחת קרה', done: true },
          { id: 2, txt: 'סידור מיטה', done: false },
        ],
        history: { '2026-01-19': 40 },
        bestDayXp: 40,
      }),
      bridge_rpg_v1: JSON.stringify({ xp: 30, tasks: [{ id: 9, txt: 'לבדוק דואר', done: false }, { id: 8, txt: 'x', done: true }] }),
    });
    const s = M.load(store, '2026-09-27');
    expect(s.routines.map((r) => r.title || r.key)).toEqual(['routine.teeth', 'routine.bed', 'routine.read', 'routine.mind', 'מקלחת קרה']);
    expect(s.days['2026-09-27'].items.map((i) => i.title).filter(Boolean)).toEqual(['מקלחת קרה', 'לבדוק דואר']);
    expect(s.archive.xp).toBe(120);
    expect(s.legacy.arch_record_v1.history).toEqual({ '2026-01-19': 40 });
    const st = M.stats(s, '2026-09-27');
    expect(st.totalTasks).toBe(0);
    expect(st.current).toBe(0);
    expect(st.level.level).toBe(2);
    // legacy keys are left untouched
    expect(store.map.has('arch_record_v1')).toBe(true);
  });
});

describe('growth, levels & achievements', () => {
  it('growth stages follow all-time tasks', () => {
    expect([0, 4, 5, 15, 30, 49, 50, 100, 999].map((n) => M.stageFor(n).id)).toEqual([
      'seed', 'seed', 'sprout', 'young', 'sapling', 'sapling', 'mature', 'ancient', 'ancient',
    ]);
  });
  it('levels', () => {
    expect(M.levelFromXp(0)).toEqual({ level: 1, into: 0, need: 50 });
    expect(M.levelFromXp(50)).toEqual({ level: 2, into: 0, need: 75 });
    expect(M.levelFromXp(130).level).toBe(3);
  });
  it('achievement unlocks are derived and shown once', () => {
    const spec = {};
    for (let i = 0; i < 7; i++) spec[D.addDays('2026-09-01', i)] = 4;
    let s = withDays(spec);
    const st = M.stats(s, '2026-09-07');
    expect(M.newlyUnlocked(s, st)).toEqual(['first-day', 'streak-7']);
    s = M.markSeen(s, M.newlyUnlocked(s, st));
    expect(M.newlyUnlocked(s, M.stats(s, '2026-09-07'))).toEqual([]);
  });
});
