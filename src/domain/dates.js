// Local-calendar date keys ("YYYY-MM-DD").
// All arithmetic goes through an integer "day number" computed with Date.UTC,
// so DST shifts and UTC offsets can never move a day boundary. Only
// `todayKey()` reads the device clock, and it uses local getters.

const KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_DAY = 86400000;

const pad = (n) => String(n).padStart(2, '0');

export function toKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayKey(now = new Date()) {
  return toKey(now);
}

export function isValidKey(key) {
  if (typeof key !== 'string') return false;
  const m = KEY_RE.exec(key);
  if (!m) return false;
  const [y, mo, d] = [+m[1], +m[2], +m[3]];
  if (y < 2000 || y > 2200) return false;
  const t = new Date(Date.UTC(y, mo - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d;
}

export function dayNumber(key) {
  const m = KEY_RE.exec(key);
  return Date.UTC(+m[1], +m[2] - 1, +m[3]) / MS_DAY;
}

export function fromDayNumber(n) {
  const t = new Date(n * MS_DAY);
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

export function addDays(key, n) {
  return fromDayNumber(dayNumber(key) + n);
}

export function diffDays(from, to) {
  return dayNumber(to) - dayNumber(from);
}

/** 0 = Monday … 6 = Sunday. 1970-01-01 (day 0) was a Thursday. */
export function mondayIndex(key) {
  return (((dayNumber(key) + 3) % 7) + 7) % 7;
}

/** Monday of the Monday–Sunday week containing `key`. */
export function weekStart(key) {
  return addDays(key, -mondayIndex(key));
}

export function weekDays(key) {
  const start = weekStart(key);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** A JS Date at local noon for display formatting only. */
export function keyToLocalDate(key) {
  const m = KEY_RE.exec(key);
  return new Date(+m[1], +m[2] - 1, +m[3], 12);
}
