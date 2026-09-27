// The whole persistent state lives in ONE versioned object:
//
// {
//   schema: 1,
//   lang: null | 'en' | 'he',          // null = follow the device
//   routines: [{ id, key?, title?, icon }],
//   days: {
//     'YYYY-MM-DD': {
//       items: [{ id, kind: 'routine'|'custom', key?, title?, icon? }],
//       done: [itemId, ...],
//       frozen?: true                  // a streak freeze protected this day
//     }
//   },
//   seen: [achievementId, ...],        // only used to show each unlock toast once
//   archive: { tasks, xp, activeDays, bestStreak, runAtCutoff, cutoff },
//   legacy?: { ... }                   // untouched snapshot of the old prototype data
// }
//
// Everything the UI shows (totals, XP, level, streaks, achievements) is DERIVED
// from `days` + `archive`, never kept as a running counter, so toggling a task
// on and off any number of times always gives the same result.

import { addDays, diffDays, isValidKey, weekStart, dayNumber, fromDayNumber } from './dates.js';

export const SCHEMA_VERSION = 1;
export const STORAGE_KEY = 'myday.state';
export const LEGACY_KEYS = ['arch_record_v1', 'bridge_rpg_v1'];
export const HISTORY_KEEP_DAYS = 400;
export const XP_PER_TASK = 10;
export const ALL_DONE_BONUS = 20;
export const MAX_TITLE = 80;

export const DEFAULT_ROUTINES = [
  { id: 'r-teeth', key: 'routine.teeth', icon: 'tooth' },
  { id: 'r-bed', key: 'routine.bed', icon: 'bed' },
  { id: 'r-read', key: 'routine.read', icon: 'book' },
  { id: 'r-mind', key: 'routine.mind', icon: 'lotus' },
];

export const STAGES = [
  { id: 'seed', min: 0 },
  { id: 'sprout', min: 5 },
  { id: 'young', min: 15 },
  { id: 'sapling', min: 30 },
  { id: 'mature', min: 50 },
  { id: 'ancient', min: 100 },
];

export const ACHIEVEMENTS = [
  { id: 'first-day', icon: 'sunrise', test: (s) => s.activeDays >= 1 },
  { id: 'streak-7', icon: 'sprout', test: (s) => s.bestStreak >= 7 },
  { id: 'streak-14', icon: 'flower', test: (s) => s.bestStreak >= 14 },
  { id: 'streak-30', icon: 'tree', test: (s) => s.bestStreak >= 30 },
  { id: 'streak-100', icon: 'mountain', test: (s) => s.bestStreak >= 100 },
  { id: 'tasks-50', icon: 'star', test: (s) => s.totalTasks >= 50 },
];

/** Companions: one starter, two found through progress (checked against derived stats). */
export const COMPANIONS = [
  { id: 'moji', test: () => true },
  { id: 'luma', test: (s) => s.bestStreak >= 7 },
  { id: 'nori', test: (s) => s.totalTasks >= 50 },
];

/** Outfit pieces the buddy unlocks by level. */
export const WARDROBE = [
  { id: 'scarf', level: 2 },
  { id: 'backpack', level: 4 },
  { id: 'beanie', level: 6 },
  { id: 'cape', level: 9 },
];

const emptyArchive = () => ({ tasks: 0, xp: 0, activeDays: 0, bestStreak: 0, runAtCutoff: 0, cutoff: null });

export function createState() {
  return {
    schema: SCHEMA_VERSION,
    lang: null,
    name: null,
    buddy: 'moji',
    routines: DEFAULT_ROUTINES.map((r) => ({ ...r })),
    days: {},
    seen: [],
    archive: emptyArchive(),
  };
}

// ---------------------------------------------------------------------------
// Validation / normalisation: never trust what comes out of storage.

const str = (v) => (typeof v === 'string' ? v : null);
const num = (v) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);
const cleanTitle = (v) => {
  const s = str(v);
  return s ? s.trim().slice(0, MAX_TITLE) : null;
};

function normItem(raw, kind) {
  if (!raw || typeof raw !== 'object') return null;
  const id = str(raw.id);
  if (!id) return null;
  const item = { id, kind: raw.kind === 'custom' || raw.kind === 'routine' ? raw.kind : kind };
  const key = str(raw.key);
  const title = cleanTitle(raw.title);
  if (key) item.key = key;
  if (title) item.title = title;
  if (!item.key && !item.title) return null;
  const icon = str(raw.icon);
  if (icon) item.icon = icon;
  return item;
}

function uniqueBy(list, f) {
  const seen = new Set();
  return list.filter((x) => (seen.has(f(x)) ? false : (seen.add(f(x)), true)));
}

function normDay(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const items = uniqueBy(
    (Array.isArray(raw.items) ? raw.items : []).map((i) => normItem(i, 'custom')).filter(Boolean),
    (i) => i.id,
  );
  const ids = new Set(items.map((i) => i.id));
  const done = [...new Set((Array.isArray(raw.done) ? raw.done : []).filter((id) => ids.has(id)))];
  const day = { items, done };
  if (raw.frozen === true) day.frozen = true;
  return day;
}

export function normalize(raw) {
  const base = createState();
  if (!raw || typeof raw !== 'object') return base;
  const s = migrate(raw);
  // Unknown top-level fields (e.g. written by a newer version) are kept as-is.
  const out = { ...s, ...base };
  out.lang = s.lang === 'en' || s.lang === 'he' ? s.lang : null;
  out.name = cleanTitle(s.name)?.slice(0, 24) || null;
  out.buddy = COMPANIONS.some((c) => c.id === s.buddy) ? s.buddy : 'moji';
  if (Array.isArray(s.routines)) {
    out.routines = uniqueBy(
      s.routines.map((r) => normItem(r, 'routine')).filter(Boolean).map(({ kind, ...r }) => r),
      (r) => r.id,
    );
  }
  out.days = {};
  if (s.days && typeof s.days === 'object') {
    for (const [k, v] of Object.entries(s.days)) {
      if (!isValidKey(k)) continue;
      const d = normDay(v);
      if (d) out.days[k] = d;
    }
  }
  out.seen = Array.isArray(s.seen) ? [...new Set(s.seen.filter((x) => typeof x === 'string'))] : [];
  const a = s.archive && typeof s.archive === 'object' ? s.archive : {};
  out.archive = {
    tasks: num(a.tasks),
    xp: num(a.xp),
    activeDays: num(a.activeDays),
    bestStreak: num(a.bestStreak),
    runAtCutoff: num(a.runAtCutoff),
    cutoff: isValidKey(a.cutoff) ? a.cutoff : null,
  };
  if (s.legacy && typeof s.legacy === 'object') out.legacy = s.legacy;
  out.schema = Math.max(SCHEMA_VERSION, typeof s.schema === 'number' ? s.schema : 0);
  return out;
}

/** Step-wise schema migrations. Add `N: (s) => s'` entries as the schema grows. */
const MIGRATIONS = {
  // 0: pre-versioned objects — nothing to reshape yet, fields are validated by normalize().
  0: (s) => ({ ...s, schema: 1 }),
};

export function migrate(raw) {
  let s = raw;
  let v = typeof s.schema === 'number' ? s.schema : 0;
  while (v < SCHEMA_VERSION && MIGRATIONS[v]) {
    s = MIGRATIONS[v](s);
    v += 1;
  }
  return s;
}

// ---------------------------------------------------------------------------
// Legacy prototype import ("Life RPG" — arch_record_v1 / bridge_rpg_v1).
// Its habits were a persistent daily list → they become routines. Open one-off
// tasks become today's custom tasks. Old XP is carried into the archive so the
// level is not lost. Old per-day XP history used UTC dates and did not record
// what was done, so it is kept verbatim for reference but does NOT invent
// completed days or streaks.

const LEGACY_SEED_MAP = { 'סידור מיטה': 'r-bed' };

export function importLegacy(legacyRaw, today) {
  const s = createState();
  const legacy = {};
  let xp = 0;
  const routines = [...s.routines];
  const custom = [];
  for (const [storageKey, raw] of Object.entries(legacyRaw)) {
    if (!raw || typeof raw !== 'object') continue;
    legacy[storageKey] = raw;
    xp = Math.max(xp, num(raw.xp));
    for (const h of Array.isArray(raw.habits) ? raw.habits : []) {
      const title = cleanTitle(h && h.txt);
      if (!title || LEGACY_SEED_MAP[title]) continue;
      if (routines.some((r) => r.title === title)) continue;
      routines.push({ id: `r-legacy-${routines.length}-${num(h.id)}`, title, icon: 'sprout' });
    }
    for (const t of Array.isArray(raw.tasks) ? raw.tasks : []) {
      const title = cleanTitle(t && t.txt);
      if (!title || (t && t.done) || custom.some((c) => c.title === title)) continue;
      custom.push({ id: `c-legacy-${custom.length}-${num(t.id)}`, kind: 'custom', title });
    }
  }
  if (!Object.keys(legacy).length) return null;
  s.routines = routines;
  s.archive.xp = xp;
  s.legacy = { ...legacy, importedOn: today };
  s.days[today] = { items: [...routineItems(routines), ...custom], done: [] };
  return s;
}

// ---------------------------------------------------------------------------
// Day helpers

export const routineItems = (routines) =>
  routines.map((r) => ({ id: r.id, kind: 'routine', ...(r.key ? { key: r.key } : {}), ...(r.title ? { title: r.title } : {}), icon: r.icon }));

export function doneCount(day) {
  if (!day) return 0;
  const ids = new Set(day.items.map((i) => i.id));
  return day.done.filter((id) => ids.has(id)).length;
}

export const isActive = (day) => doneCount(day) > 0;
export const isAllDone = (day) => !!day && day.items.length > 0 && doneCount(day) === day.items.length;

/** 'active' | 'frozen' | 'none' */
export function dayStatus(state, key) {
  const d = state.days[key];
  if (isActive(d)) return 'active';
  if (d && d.frozen) return 'frozen';
  return 'none';
}

const dayXp = (day) => doneCount(day) * XP_PER_TASK + (isAllDone(day) ? ALL_DONE_BONUS : 0);

/**
 * Make sure today's record exists. A new day gets the current routines plus
 * any unfinished custom tasks from the most recent earlier day.
 */
export function ensureDay(state, today) {
  if (state.days[today]) return state;
  const prevKey = Object.keys(state.days)
    .filter((k) => k < today)
    .sort()
    .pop();
  const prev = prevKey ? state.days[prevKey] : null;
  const carried = prev ? prev.items.filter((i) => i.kind === 'custom' && !prev.done.includes(i.id)) : [];
  return {
    ...state,
    days: { ...state.days, [today]: { items: [...routineItems(state.routines), ...carried.map((i) => ({ ...i }))], done: [] } },
  };
}

export function toggleItem(state, today, id) {
  const s = ensureDay(state, today);
  const day = s.days[today];
  if (!day.items.some((i) => i.id === id)) return s;
  const done = day.done.includes(id) ? day.done.filter((x) => x !== id) : [...day.done, id];
  return { ...s, days: { ...s.days, [today]: { ...day, done } } };
}

export function addCustom(state, today, title, id = `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`) {
  const t = cleanTitle(title);
  if (!t) return state;
  const s = ensureDay(state, today);
  const day = s.days[today];
  return { ...s, days: { ...s.days, [today]: { ...day, items: [...day.items, { id, kind: 'custom', title: t }] } } };
}

export function removeItem(state, today, id) {
  const day = state.days[today];
  if (!day) return state;
  return {
    ...state,
    days: { ...state.days, [today]: { ...day, items: day.items.filter((i) => i.id !== id), done: day.done.filter((x) => x !== id) } },
  };
}

/**
 * Replace the routine list. Today's snapshot follows (added/renamed/removed),
 * past days are left exactly as they were.
 */
export function setRoutines(state, today, routines) {
  const clean = uniqueBy(
    routines.map((r) => normItem(r, 'routine')).filter(Boolean).map(({ kind, ...r }) => r),
    (r) => r.id,
  );
  const s = ensureDay({ ...state, routines: clean }, today);
  const day = s.days[today];
  const customs = day.items.filter((i) => i.kind === 'custom');
  const items = [...routineItems(clean), ...customs];
  const ids = new Set(items.map((i) => i.id));
  return { ...s, days: { ...s.days, [today]: { ...day, items, done: day.done.filter((x) => ids.has(x)) } } };
}

// ---------------------------------------------------------------------------
// Streaks & freezes
//
// A day "counts" when at least one task was completed. The chain survives a
// frozen day (it is skipped, never counted). Today never breaks the chain —
// until today is over, the chain may still end yesterday.
//
// FREEZE RULE (deterministic):
//  • A freeze protects exactly ONE missed day: the gap between the last
//    counted/frozen day ("anchor") and today must be exactly one day.
//  • At most one freeze per Monday–Sunday local week (the week of the
//    protected day).
//  • It only protects an existing chain (anchor is part of a chain ≥ 1).
//  • Two or more consecutive missed days: no freeze is spent; the chain
//    restarts gently.
//  • A frozen day adds nothing: no completions, tasks or XP.
//  • It is evaluated when a day begins (app open / date rollover), so it is
//    idempotent: re-running it changes nothing.

export function freezeWeeksUsed(state) {
  return new Set(Object.keys(state.days).filter((k) => state.days[k].frozen).map(weekStart));
}

export function applyFreezes(state, today) {
  const anchor = Object.keys(state.days)
    .filter((k) => k < today && dayStatus(state, k) !== 'none')
    .sort()
    .pop();
  if (!anchor) return { state, frozen: null };
  const gap = diffDays(anchor, today) - 1;
  if (gap !== 1) return { state, frozen: null };
  const missed = addDays(anchor, 1);
  if (runEndingAt(state, anchor) < 1) return { state, frozen: null };
  if (freezeWeeksUsed(state).has(weekStart(missed))) return { state, frozen: null };
  const prev = state.days[missed] || { items: [], done: [] };
  return {
    state: { ...state, days: { ...state.days, [missed]: { ...prev, frozen: true } } },
    frozen: missed,
  };
}

function firstTrackedDay(state) {
  const keys = Object.keys(state.days).sort();
  const cut = state.archive.cutoff;
  if (cut) return addDays(cut, 1);
  return keys[0] || null;
}

/** Chain length (counted days) ending at `key`, walking back through frozen days. */
export function runEndingAt(state, key) {
  const first = firstTrackedDay(state);
  if (!first) return 0;
  let run = 0;
  let k = key;
  while (k >= first) {
    const st = dayStatus(state, k);
    if (st === 'none') return run;
    if (st === 'active') run += 1;
    k = addDays(k, -1);
  }
  // Walked past everything kept: continue with the chain that was archived.
  return run + (state.archive.cutoff ? state.archive.runAtCutoff : 0);
}

export function currentStreak(state, today) {
  if (dayStatus(state, today) === 'active') return runEndingAt(state, today);
  return runEndingAt(state, addDays(today, -1));
}

/** Longest chain in the kept history, including archived chains. */
function scanRuns(state, from, to, initialRun) {
  let run = initialRun;
  let best = initialRun;
  for (let n = dayNumber(from); n <= dayNumber(to); n++) {
    const k = fromDayNumber(n);
    const st = dayStatus(state, k);
    if (st === 'active') run += 1;
    else if (st === 'none' && k !== to) run = 0;
    best = Math.max(best, run);
  }
  return { best, run };
}

export function bestStreak(state, today) {
  const first = firstTrackedDay(state);
  if (!first || first > today) return state.archive.bestStreak;
  const { best } = scanRuns(state, first, today, state.archive.cutoff ? state.archive.runAtCutoff : 0);
  return Math.max(best, state.archive.bestStreak);
}

// ---------------------------------------------------------------------------
// Pruning: keep a bounded window of day records, fold older ones into archive.

export function prune(state, today, keep = HISTORY_KEEP_DAYS) {
  const cutoff = addDays(today, -keep);
  const old = Object.keys(state.days).filter((k) => k <= cutoff).sort();
  if (!old.length) return state;
  const first = firstTrackedDay(state);
  const { best, run } = scanRuns(state, first, cutoff, state.archive.cutoff ? state.archive.runAtCutoff : 0);
  const archive = { ...state.archive };
  for (const k of old) {
    const d = state.days[k];
    archive.tasks += doneCount(d);
    archive.xp += dayXp(d);
    archive.activeDays += isActive(d) ? 1 : 0;
  }
  archive.bestStreak = Math.max(archive.bestStreak, best);
  // `run` counts through `cutoff`; if cutoff itself was a plain missed day the chain is 0.
  archive.runAtCutoff = dayStatus(state, cutoff) === 'none' ? 0 : run;
  archive.cutoff = cutoff;
  const days = { ...state.days };
  for (const k of old) delete days[k];
  return { ...state, days, archive };
}

/** Everything that should happen when a (new) day is opened. */
export function prepareDay(state, today) {
  const { state: s1, frozen } = applyFreezes(state, today);
  const s2 = prune(ensureDay(s1, today), today);
  return { state: s2, frozen };
}

// ---------------------------------------------------------------------------
// Derived stats

export function levelFromXp(xp) {
  let level = 1;
  let need = 50;
  let rest = xp;
  while (rest >= need) {
    rest -= need;
    level += 1;
    need = 50 + 25 * (level - 1);
  }
  return { level, into: rest, need };
}

export function stageFor(totalTasks) {
  let idx = 0;
  STAGES.forEach((st, i) => {
    if (totalTasks >= st.min) idx = i;
  });
  const next = STAGES[idx + 1] || null;
  return { ...STAGES[idx], index: idx, next };
}

export function stats(state, today) {
  let totalTasks = state.archive.tasks;
  let xp = state.archive.xp;
  let activeDays = state.archive.activeDays;
  let freezes = 0;
  for (const d of Object.values(state.days)) {
    totalTasks += doneCount(d);
    xp += dayXp(d);
    activeDays += isActive(d) ? 1 : 0;
    freezes += d.frozen ? 1 : 0;
  }
  const day = state.days[today] || { items: [], done: [] };
  const s = {
    totalTasks,
    xp,
    activeDays,
    freezes,
    todayDone: doneCount(day),
    todayTotal: day.items.length,
    allDone: isAllDone(day),
    current: currentStreak(state, today),
    bestStreak: bestStreak(state, today),
    level: levelFromXp(xp),
    stage: stageFor(totalTasks),
    freezeAvailable: !freezeWeeksUsed(state).has(weekStart(today)),
  };
  s.achievements = ACHIEVEMENTS.map((a) => ({ id: a.id, icon: a.icon, unlocked: a.test(s) }));
  s.companions = COMPANIONS.map((c) => ({ id: c.id, unlocked: c.test(s) }));
  return s;
}

/** Achievements that are unlocked now but whose toast has never been shown. */
export function newlyUnlocked(state, st) {
  return [
    ...st.achievements.filter((a) => a.unlocked && !state.seen.includes(a.id)).map((a) => a.id),
    ...st.companions.filter((c) => c.id !== 'moji' && c.unlocked && !state.seen.includes(`buddy-${c.id}`)).map((c) => `buddy-${c.id}`),
  ];
}

export function markSeen(state, ids) {
  if (!ids.length) return state;
  return { ...state, seen: [...new Set([...state.seen, ...ids])] };
}

export function setProfile(state, { name, buddy }) {
  const next = { ...state };
  if (name !== undefined) next.name = cleanTitle(name)?.slice(0, 24) || null;
  if (buddy !== undefined && COMPANIONS.some((c) => c.id === buddy)) next.buddy = buddy;
  return next;
}

export function setLang(state, lang) {
  return { ...state, lang: lang === 'en' || lang === 'he' ? lang : null };
}

// ---------------------------------------------------------------------------
// Storage (thin, injectable for tests)

export function load(storage, today) {
  let raw = null;
  try {
    const txt = storage.getItem(STORAGE_KEY);
    if (txt) raw = JSON.parse(txt);
  } catch {
    try {
      const bad = storage.getItem(STORAGE_KEY);
      if (bad) storage.setItem(`${STORAGE_KEY}.corrupt`, bad);
    } catch {
      /* ignore */
    }
    raw = null;
  }
  if (raw && typeof raw === 'object') return normalize(raw);
  const legacy = {};
  for (const k of LEGACY_KEYS) {
    try {
      const txt = storage.getItem(k);
      if (txt) legacy[k] = JSON.parse(txt);
    } catch {
      /* unreadable legacy data is skipped, never deleted */
    }
  }
  return importLegacy(legacy, today) || createState();
}

export function save(storage, state) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
