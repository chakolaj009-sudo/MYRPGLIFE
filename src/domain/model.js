// The whole persistent state lives in ONE versioned object:
//
// {
//   schema: 2,
//   lang: null | 'en' | 'he',               // null = follow the device
//   name: string | null,
//   buddy: 'moji' | 'luma' | 'nori',
//   routines: [{ id, key?, title?, mini?, icon }],   // mini = the tiny version
//   days: {
//     'YYYY-MM-DD': {
//       items: [{ id, kind: 'routine'|'custom', key?, title?, mini?, icon? }],
//       done: [itemId, ...],
//       minimum?: true,                     // a Minimum Day (counts fully)
//       comeback?: true                     // first day back after a gap
//     }
//   },
//   reflections: { [weekStartKey]: { answer: string|null, on: 'YYYY-MM-DD' } },
//   keepsakes: [{ id, type, date, habit?, title? }],  // rare moments, left in the world
//   grown: { [habitId]: tier },             // growth the user has already seen
//   seen: [id, ...],                        // one-time notices already shown
//   archive: { tasks, xp, activeDays, habits: { [habitId]: count }, cutoff },
//   legacy?: { ... }                        // untouched snapshot of the old prototype data
// }
//
// Everything shown (totals, XP, level, days showed up, growth, keepsake medals)
// is DERIVED from `days` + `archive`, never kept as a running counter, so
// toggling a task on and off any number of times always gives the same result.
//
// There are no streaks: missing a day never erases anything. Continuity is
// measured as "days you showed up" (this month, and in total).

import { addDays, dayNumber, diffDays, isValidKey, weekStart, weekDays } from './dates.js';

export const SCHEMA_VERSION = 2;
export const STORAGE_KEY = 'myday.state';
export const LEGACY_KEYS = ['arch_record_v1', 'bridge_rpg_v1'];
export const HISTORY_KEEP_DAYS = 400;
export const XP_PER_TASK = 10;
export const XP_PER_TASK_MIN = 7; // slightly lower on a Minimum Day — the day itself is never lesser
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

/** Per-habit growth: lifetime completions needed for each new element in the world. */
export const GROWTH_STEPS = [1, 3, 7, 14, 30, 60];

export const ACHIEVEMENTS = [
  { id: 'first-day', test: (s) => s.activeDays >= 1 },
  { id: 'days-7', test: (s) => s.activeDays >= 7 },
  { id: 'days-30', test: (s) => s.activeDays >= 30 },
  { id: 'days-100', test: (s) => s.activeDays >= 100 },
  { id: 'tasks-50', test: (s) => s.totalTasks >= 50 },
  { id: 'tasks-250', test: (s) => s.totalTasks >= 250 },
];

/** Companions: one starter, two found through progress (checked against derived stats). */
export const COMPANIONS = [
  { id: 'moji', test: () => true },
  { id: 'luma', test: (s) => s.activeDays >= 7 },
  { id: 'nori', test: (s) => s.totalTasks >= 50 },
];

/** Outfit pieces the companion finds by level. */
export const WARDROBE = [
  { id: 'scarf', level: 2 },
  { id: 'backpack', level: 4 },
  { id: 'beanie', level: 6 },
  { id: 'cape', level: 9 },
];

const emptyArchive = () => ({ tasks: 0, xp: 0, activeDays: 0, habits: {}, cutoff: null });

export function createState() {
  return {
    schema: SCHEMA_VERSION,
    lang: null,
    name: null,
    buddy: 'moji',
    routines: DEFAULT_ROUTINES.map((r) => ({ ...r })),
    days: {},
    reflections: {},
    keepsakes: [],
    grown: {},
    seen: [],
    archive: emptyArchive(),
  };
}

// ---------------------------------------------------------------------------
// Validation / normalisation: never trust what comes out of storage.

const str = (v) => (typeof v === 'string' ? v : null);
const num = (v) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);
export const cleanTitle = (v) => {
  const s = str(v);
  const t = s ? s.trim().slice(0, MAX_TITLE) : null;
  return t || null;
};
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

function normItem(raw, kind) {
  if (!isObj(raw)) return null;
  const id = str(raw.id);
  if (!id) return null;
  const item = { id, kind: raw.kind === 'custom' || raw.kind === 'routine' ? raw.kind : kind };
  const key = str(raw.key);
  const title = cleanTitle(raw.title);
  const mini = cleanTitle(raw.mini);
  if (key) item.key = key;
  if (title) item.title = title;
  if (!item.key && !item.title) return null;
  if (mini) item.mini = mini;
  const icon = str(raw.icon);
  if (icon) item.icon = icon;
  return item;
}

function uniqueBy(list, f) {
  const seen = new Set();
  return list.filter((x) => (seen.has(f(x)) ? false : (seen.add(f(x)), true)));
}

function normDay(raw) {
  if (!isObj(raw)) return null;
  const items = uniqueBy(
    (Array.isArray(raw.items) ? raw.items : []).map((i) => normItem(i, 'custom')).filter(Boolean),
    (i) => i.id,
  );
  const ids = new Set(items.map((i) => i.id));
  const done = [...new Set((Array.isArray(raw.done) ? raw.done : []).filter((id) => ids.has(id)))];
  const day = { items, done };
  if (raw.minimum === true) day.minimum = true;
  if (raw.comeback === true) day.comeback = true;
  return day;
}

const normRoutines = (list) =>
  uniqueBy(
    list.map((r) => normItem(r, 'routine')).filter(Boolean).map(({ kind, ...r }) => r),
    (r) => r.id,
  );

export function normalize(raw) {
  const base = createState();
  if (!isObj(raw)) return base;
  const s = migrate(raw);
  // Unknown top-level fields (e.g. written by a newer version) are kept as-is.
  const out = { ...s, ...base };
  out.lang = s.lang === 'en' || s.lang === 'he' ? s.lang : null;
  out.name = cleanTitle(s.name)?.slice(0, 24) || null;
  out.buddy = COMPANIONS.some((c) => c.id === s.buddy) ? s.buddy : 'moji';
  if (Array.isArray(s.routines)) out.routines = normRoutines(s.routines);
  out.days = {};
  if (isObj(s.days)) {
    for (const [k, v] of Object.entries(s.days)) {
      if (!isValidKey(k)) continue;
      const d = normDay(v);
      if (d) out.days[k] = d;
    }
  }
  out.reflections = {};
  if (isObj(s.reflections)) {
    for (const [k, v] of Object.entries(s.reflections)) {
      if (!isValidKey(k) || !isObj(v)) continue;
      out.reflections[k] = { answer: cleanTitle(v.answer), on: isValidKey(v.on) ? v.on : k };
    }
  }
  out.keepsakes = Array.isArray(s.keepsakes)
    ? uniqueBy(
        s.keepsakes
          .filter((k) => isObj(k) && str(k.id) && str(k.type) && isValidKey(k.date))
          .map((k) => ({
            id: k.id,
            type: k.type,
            date: k.date,
            ...(str(k.habit) ? { habit: k.habit } : {}),
            ...(cleanTitle(k.title) ? { title: cleanTitle(k.title) } : {}),
            ...(str(k.key) ? { key: k.key } : {}),
          })),
        (k) => k.id,
      )
    : [];
  out.grown = {};
  if (isObj(s.grown)) for (const [k, v] of Object.entries(s.grown)) if (Number.isInteger(v) && v >= 0 && v <= GROWTH_STEPS.length) out.grown[k] = v;
  out.seen = Array.isArray(s.seen) ? [...new Set(s.seen.filter((x) => typeof x === 'string'))] : [];
  const a = isObj(s.archive) ? s.archive : {};
  const habits = {};
  if (isObj(a.habits)) for (const [k, v] of Object.entries(a.habits)) if (num(v)) habits[k] = num(v);
  out.archive = { tasks: num(a.tasks), xp: num(a.xp), activeDays: num(a.activeDays), habits, cutoff: isValidKey(a.cutoff) ? a.cutoff : null };
  if (isObj(s.legacy)) out.legacy = s.legacy;
  out.schema = Math.max(SCHEMA_VERSION, typeof s.schema === 'number' ? s.schema : 0);
  return out;
}

/** Step-wise schema migrations. Field validation/defaults live in normalize(). */
const MIGRATIONS = {
  // 0 → 1: pre-versioned objects.
  0: (s) => ({ ...s, schema: 1 }),
  // 1 → 2: streaks & freezes were replaced by "days you showed up"; old frozen
  // markers and streak archive fields are simply dropped (nothing is lost:
  // completions, XP and active days are untouched).
  1: (s) => ({ ...s, schema: 2 }),
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
// completed days.

const LEGACY_SEED_MAP = { 'סידור מיטה': 'r-bed' };

export function importLegacy(legacyRaw, today) {
  const s = createState();
  const legacy = {};
  let xp = 0;
  const routines = [...s.routines];
  const custom = [];
  for (const [storageKey, raw] of Object.entries(legacyRaw)) {
    if (!isObj(raw)) continue;
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
  routines.map((r) => ({
    id: r.id,
    kind: 'routine',
    ...(r.key ? { key: r.key } : {}),
    ...(r.title ? { title: r.title } : {}),
    ...(r.mini ? { mini: r.mini } : {}),
    icon: r.icon,
  }));

export function doneCount(day) {
  if (!day) return 0;
  const ids = new Set(day.items.map((i) => i.id));
  return day.done.filter((id) => ids.has(id)).length;
}

export const isActive = (day) => doneCount(day) > 0;
export const isAllDone = (day) => !!day && day.items.length > 0 && doneCount(day) === day.items.length;
export const xpPerTask = (day) => (day && day.minimum ? XP_PER_TASK_MIN : XP_PER_TASK);
export const dayXp = (day) => doneCount(day) * xpPerTask(day) + (isAllDone(day) ? ALL_DONE_BONUS : 0);

/** Most recent day before `today` on which the user showed up. */
export function lastShowedUp(state, today) {
  return Object.keys(state.days)
    .filter((k) => k < today && isActive(state.days[k]))
    .sort()
    .pop() || null;
}

/**
 * Make sure today's record exists. A new day gets the current routines plus
 * any unfinished custom tasks from the most recent earlier day. After a gap
 * (at least one day without showing up) it opens as a gentle Minimum Day.
 */
export function ensureDay(state, today) {
  if (state.days[today]) return state;
  const prevKey = Object.keys(state.days)
    .filter((k) => k < today)
    .sort()
    .pop();
  const prev = prevKey ? state.days[prevKey] : null;
  const carried = prev ? prev.items.filter((i) => i.kind === 'custom' && !prev.done.includes(i.id)) : [];
  const last = lastShowedUp(state, today);
  const comeback = !!last && diffDays(last, today) >= 2;
  const day = { items: [...routineItems(state.routines), ...carried.map((i) => ({ ...i }))], done: [] };
  if (comeback) {
    day.minimum = true;
    day.comeback = true;
  }
  return { ...state, days: { ...state.days, [today]: day } };
}

export function toggleItem(state, today, id) {
  const s = ensureDay(state, today);
  const day = s.days[today];
  if (!day.items.some((i) => i.id === id)) return s;
  const done = day.done.includes(id) ? day.done.filter((x) => x !== id) : [...day.done, id];
  return { ...s, days: { ...s.days, [today]: { ...day, done } } };
}

export function setMinimum(state, today, on) {
  const s = ensureDay(state, today);
  const { minimum, ...rest } = s.days[today];
  return { ...s, days: { ...s.days, [today]: on ? { ...rest, minimum: true } : rest } };
}

export function addCustom(state, today, title, id = `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, icon, mini) {
  const t = cleanTitle(title);
  if (!t) return state;
  const s = ensureDay(state, today);
  const day = s.days[today];
  const m = cleanTitle(mini);
  const item = { id, kind: 'custom', title: t, ...(typeof icon === 'string' ? { icon } : {}), ...(m ? { mini: m } : {}) };
  return { ...s, days: { ...s.days, [today]: { ...day, items: [...day.items, item] } } };
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
  const clean = normRoutines(routines);
  const s = ensureDay({ ...state, routines: clean }, today);
  const day = s.days[today];
  const customs = day.items.filter((i) => i.kind === 'custom');
  const items = [...routineItems(clean), ...customs];
  const ids = new Set(items.map((i) => i.id));
  return { ...s, days: { ...s.days, [today]: { ...day, items, done: day.done.filter((x) => ids.has(x)) } } };
}

// ---------------------------------------------------------------------------
// Continuity: days you showed up. Nothing is ever lost by missing a day.

export function showedUpInMonth(state, today) {
  const prefix = today.slice(0, 7);
  return Object.keys(state.days).filter((k) => k.startsWith(prefix) && k <= today && isActive(state.days[k])).length;
}

/** Lifetime completions per habit id (routines and custom tasks alike). `before` excludes that day and later. */
export function habitCounts(state, before = null) {
  const counts = { ...state.archive.habits };
  for (const [k, d] of Object.entries(state.days)) {
    if (before && k >= before) continue;
    const ids = new Set(d.items.map((i) => i.id));
    for (const id of d.done) if (ids.has(id)) counts[id] = (counts[id] || 0) + 1;
  }
  return counts;
}

export function growthTier(count) {
  return GROWTH_STEPS.filter((n) => count >= n).length;
}

/**
 * Growth in the world reflects cumulative history and appears overnight:
 * what you do today is "planted" and shows up the next time a day begins.
 * Nothing ever wilts — tiers only go up with lifetime completions.
 *   visible: tier revealed in the world (history before today)
 *   pending: something new will grow tomorrow from today's completions
 */
export function worldGrowth(state, today) {
  const before = habitCounts(state, today);
  const all = habitCounts(state);
  const out = {};
  for (const id of new Set([...Object.keys(all), ...Object.keys(before)])) {
    const visible = growthTier(before[id] || 0);
    out[id] = { visible, pending: growthTier(all[id] || 0) > visible };
  }
  return out;
}

/** Habits whose revealed growth the user hasn't seen yet (the "something new grew" moment). */
export function discoveries(state, today) {
  const g = worldGrowth(state, today);
  return Object.keys(g).filter((id) => g[id].visible > (state.grown[id] || 0));
}

export function markGrown(state, today) {
  const g = worldGrowth(state, today);
  const grown = { ...state.grown };
  let changed = false;
  for (const [id, v] of Object.entries(g)) {
    if (v.visible > (grown[id] || 0)) {
      grown[id] = v.visible;
      changed = true;
    }
  }
  return changed ? { ...state, grown } : state;
}

// ---------------------------------------------------------------------------
// Weekly reflection: once a week, three plain lines about the week that just
// ended (a pattern, one real moment, what changed) and one question.

const itemIn = (state, id, fromKey, toKey) => {
  for (const [k, d] of Object.entries(state.days)) {
    if (k < fromKey || k > toKey) continue;
    const it = d.items.find((i) => i.id === id);
    if (it) return it;
  }
  return null;
};

/** The week (Monday key) whose story should be told now, or null. */
export function pendingReflection(state, today) {
  const week = addDays(weekStart(today), -7);
  if (state.reflections[week]) return null;
  const days = weekDays(week);
  if (!days.some((k) => isActive(state.days[k]))) return null;
  return week;
}

export function weekStory(state, week) {
  const days = weekDays(week);
  const end = days[6];
  const counts = {};
  for (const k of days) {
    const d = state.days[k];
    if (!d) continue;
    const ids = new Set(d.items.map((i) => i.id));
    for (const id of d.done) if (ids.has(id)) counts[id] = (counts[id] || 0) + 1;
  }
  const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1] || (a[0].startsWith('r-') ? -1 : 1));
  const pattern = ranked.length ? { item: itemIn(state, ranked[0][0], week, end), count: ranked[0][1] } : null;

  let moment = null;
  for (const k of days) {
    const d = state.days[k];
    if (d && d.minimum && isActive(d)) {
      moment = { type: 'minimum', date: k, item: d.items.find((i) => i.id === d.done.find((id) => d.items.some((x) => x.id === id))) };
      break;
    }
  }
  if (!moment) {
    const full = days.find((k) => isAllDone(state.days[k]));
    if (full) moment = { type: 'full', date: full };
  }
  if (!moment) {
    const first = days.find((k) => isActive(state.days[k]));
    if (first) {
      const d = state.days[first];
      moment = { type: 'showed', date: first, item: d.items.find((i) => i.id === d.done.find((id) => d.items.some((x) => x.id === id))) };
    }
  }

  // What changed: a habit whose growth tier rose during the week (revealed by next Monday).
  const before = habitCounts(state, week);
  const after = habitCounts(state, addDays(end, 1));
  let change = null;
  for (const [id, n] of Object.entries(after)) {
    const t0 = growthTier(before[id] || 0);
    const t1 = growthTier(n);
    if (t1 > t0) {
      const item = itemIn(state, id, week, end);
      if (item && (!change || t1 > change.tier)) change = { type: 'growth', item, tier: t1 };
    }
  }
  if (!change) {
    const total = (b) => Object.values(b).reduce((x, y) => x + y, 0);
    const s0 = stageFor(total(before));
    const s1 = stageFor(total(after));
    if (s1.index > s0.index) change = { type: 'stage', stage: s1.id };
  }
  return { week, pattern, moment, change: change || { type: 'quiet' } };
}

export function recordReflection(state, week, answer, today) {
  return { ...state, reflections: { ...state.reflections, [week]: { answer: cleanTitle(answer), on: today } } };
}

/** Now and then, gently quote a past answer back (2+ weeks old). */
export function pastAnswer(state, today) {
  if (((dayNumber(today) % 4) + 4) % 4 !== 0) return null;
  const old = Object.entries(state.reflections)
    .filter(([week, r]) => r.answer && diffDays(week, today) >= 14)
    .sort((a, b) => (a[0] < b[0] ? 1 : -1));
  if (!old.length) return null;
  const [week, r] = old[Math.floor(dayNumber(today) / 4) % old.length];
  return { answer: r.answer, weeksAgo: Math.floor(diffDays(addDays(week, 7), today) / 7) || 1 };
}

// ---------------------------------------------------------------------------
// Rare reactions: triggered by meaning, not volume. At most one per
// Monday–Sunday week; each leaves a dated keepsake pebble in the world.
// Keepsakes are moments — they stay even if a task is later unchecked.

export const REACTIONS = ['first-minimum', 'comeback', 'full-after-min', 'habit-50', 'habit-month'];

const habitRef = (item) => ({ habit: item.id, ...(item.title ? { title: item.title } : {}), ...(item.key ? { key: item.key } : {}) });

export function checkReaction(state, today) {
  if (state.keepsakes.some((k) => weekStart(k.date) === weekStart(today))) return null;
  const day = state.days[today];
  if (!isActive(day)) return null;
  const has = (id) => state.keepsakes.some((k) => k.id === id);
  const make = (type, id, extra = {}) => ({ id, type, date: today, ...extra });

  if (day.minimum && !state.keepsakes.some((k) => k.type === 'first-minimum')) return make('first-minimum', 'first-minimum');
  if (day.comeback && !has(`comeback-${today}`)) return make('comeback', `comeback-${today}`);
  const y = state.days[addDays(today, -1)];
  if (isAllDone(day) && y && y.minimum && isActive(y) && !has(`full-after-min-${today}`)) return make('full-after-min', `full-after-min-${today}`);

  const counts = habitCounts(state);
  for (const item of day.items) {
    if (!day.done.includes(item.id)) continue;
    if ((counts[item.id] || 0) >= 50 && !has(`habit-50-${item.id}`)) return make('habit-50', `habit-50-${item.id}`, habitRef(item));
  }
  const last30 = Array.from({ length: 30 }, (_, i) => addDays(today, -i));
  for (const item of day.items) {
    if (!day.done.includes(item.id) || item.kind !== 'routine') continue;
    const id = `habit-month-${item.id}-${today.slice(0, 7)}`;
    if (has(id)) continue;
    const n = last30.filter((k) => state.days[k]?.done.includes(item.id)).length;
    if (n >= 20) return make('habit-month', id, habitRef(item));
  }
  return null;
}

export function awardReaction(state, today) {
  const k = checkReaction(state, today);
  if (!k) return { state, keepsake: null };
  return { state: { ...state, keepsakes: [...state.keepsakes, k] }, keepsake: k };
}

// ---------------------------------------------------------------------------
// Pruning: keep a bounded window of day records, fold older ones into archive.

export function prune(state, today, keep = HISTORY_KEEP_DAYS) {
  // Never prune into the current month ("showed up this month" stays exact).
  const monthStart = `${today.slice(0, 7)}-01`;
  const byAge = addDays(today, -keep);
  const cutoff = byAge < monthStart ? byAge : addDays(monthStart, -1);
  const old = Object.keys(state.days).filter((k) => k <= cutoff).sort();
  if (!old.length) return state;
  const archive = { ...state.archive, habits: { ...state.archive.habits } };
  for (const k of old) {
    const d = state.days[k];
    archive.tasks += doneCount(d);
    archive.xp += dayXp(d);
    archive.activeDays += isActive(d) ? 1 : 0;
    const ids = new Set(d.items.map((i) => i.id));
    for (const id of d.done) if (ids.has(id)) archive.habits[id] = (archive.habits[id] || 0) + 1;
  }
  archive.cutoff = cutoff;
  const days = { ...state.days };
  for (const k of old) delete days[k];
  return { ...state, days, archive };
}

/** Everything that should happen when a (new) day is opened. */
export function prepareDay(state, today) {
  const isNew = !state.days[today];
  const s = prune(ensureDay(state, today), today);
  return { state: s, comeback: isNew && !!s.days[today].comeback };
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
  for (const d of Object.values(state.days)) {
    totalTasks += doneCount(d);
    xp += dayXp(d);
    activeDays += isActive(d) ? 1 : 0;
  }
  const day = state.days[today] || { items: [], done: [] };
  const week = weekDays(today).filter((k) => k <= today && isActive(state.days[k])).length;
  const s = {
    totalTasks,
    xp,
    activeDays,
    month: showedUpInMonth(state, today),
    week,
    todayDone: doneCount(day),
    todayTotal: day.items.length,
    allDone: isAllDone(day),
    minimum: !!day.minimum,
    comeback: !!day.comeback,
    level: levelFromXp(xp),
    stage: stageFor(totalTasks),
    habits: habitCounts(state),
  };
  s.achievements = ACHIEVEMENTS.map((a) => ({ id: a.id, unlocked: a.test(s) }));
  s.companions = COMPANIONS.map((c) => ({ id: c.id, unlocked: c.test(s) }));
  return s;
}

/** Companions found but not yet announced (medals unlock quietly). */
export function newlyUnlocked(state, st) {
  return st.companions.filter((c) => c.id !== 'moji' && c.unlocked && !state.seen.includes(`buddy-${c.id}`)).map((c) => `buddy-${c.id}`);
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

export { weekStart };
