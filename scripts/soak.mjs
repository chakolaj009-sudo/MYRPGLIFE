// Whole-journey soak test: ~7 weeks of lifelike use in the real app, with
// invariants checked after every simulated day. Usage: npm run build && npm run soak
import { chromium, devices } from '@playwright/test';
import { spawn } from 'node:child_process';
import { weekStart, addDays } from '../src/domain/dates.js';

const PORT = 4182;
const URL = `http://localhost:${PORT}/`;
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' });
process.on('exit', () => server.kill()); // never leave the port busy, even after a crash
await new Promise((res, rej) => {
  server.stdout.on('data', (d) => String(d).includes(String(PORT)) && res());
  setTimeout(() => rej(new Error('preview server timeout')), 15000);
});

// Deterministic "life": 0 = skip the day, 1..n = cards played; m = use Minimum day.
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ ...devices['iPhone 14'], timezoneId: 'Asia/Jerusalem', reducedMotion: 'reduce' });
const failures = [];
const errors = [];
let page;
let prevGrown = {};
let day = '2026-08-03'; // a Monday
const START = day;

async function open(key) {
  const t = new Date(`${key}T08:30:00+03:00`);
  if (!page) {
    page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`${e}`));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.clock.install({ time: t });
  } else await page.clock.setSystemTime(t);
  await page.goto(URL);
  await page.waitForTimeout(700);
  await page.clock.runFor(6000); // opening lines, growth reveal
}
const state = () => page.evaluate(() => JSON.parse(localStorage.getItem('myday.state')));
const fail = (k, msg) => failures.push(`${k}: ${msg}`);

for (let i = 0; i < 49; i++, day = addDays(day, 1)) {
  const r = rnd();
  const skip = r < 0.18 || (i >= 20 && i <= 23); // scattered misses + one 4-day gap
  if (skip) continue;
  await open(day);
  // Weekly story: answer sometimes, skip otherwise.
  if (await page.getByRole('dialog', { name: 'Your week' }).count()) {
    await page.clock.runFor(5000);
    if (rnd() < 0.5) {
      await page.getByRole('radio', { name: 'Rest' }).click();
      await page.getByRole('button', { name: 'Keep going' }).click();
      await page.clock.runFor(2000);
    } else await page.getByRole('button', { name: 'Not now' }).click();
    await page.waitForTimeout(200);
  }
  let s = await state();
  const today = s.days[day];
  if (!today) fail(day, 'no record for today');
  const prev = Object.keys(s.days).filter((k) => k < day && s.days[k].done.length).sort().pop();
  const gap = prev && (new Date(day) - new Date(prev)) / 864e5 >= 2;
  if (gap && !(today.minimum && today.comeback)) fail(day, 'comeback should open as a Minimum day');
  if (!gap && today.comeback) fail(day, 'comeback without a gap');
  if (!today.minimum && rnd() < 0.2) await page.getByRole('button', { name: 'Minimum day' }).click();
  const n = 1 + Math.floor(rnd() * 5);
  for (let c = 0; c < n; c++) {
    const card = page.locator('.hand-slot:not(.leaving) .game-card:not(.add-card)').first();
    if (!(await card.count())) break;
    await card.click();
    await page.waitForTimeout(250);
    await page.clock.runFor(800);
  }
  if (rnd() < 0.15) {
    await page.reload();
    await page.waitForTimeout(500);
    await page.clock.runFor(3000);
  }
  s = await state();
  // ---- invariants
  if (s.schema !== 2) fail(day, `schema ${s.schema}`);
  const month = Object.keys(s.days).filter((k) => k.startsWith(day.slice(0, 7)) && k <= day && s.days[k].done.length).length;
  const chip = await page.getByRole('button', { name: /^This month/ }).getAttribute('aria-label');
  const expect = month === 0 ? 'Let’s begin' : month === 1 ? '1 day' : `${month} days`;
  if (!chip.endsWith(expect)) fail(day, `month chip "${chip}" vs ${month}`);
  const weeks = {};
  for (const k of s.keepsakes) {
    const w = weekStart(k.date);
    if (weeks[w]) fail(day, `two keepsakes in week ${w}`);
    weeks[w] = 1;
  }
  for (const [id, tier] of Object.entries(prevGrown)) if ((s.grown[id] || 0) < tier) fail(day, `growth went down for ${id}`);
  prevGrown = s.grown;
  const xp = await page.getByRole('progressbar').getAttribute('aria-label');
  if (!/^\d+ \/ \d+ XP$/.test(xp)) fail(day, `bad XP label ${xp}`);
}

const s = await state();
console.log(
  JSON.stringify(
    {
      daysSimulated: Object.keys(s.days).length,
      showedUp: Object.values(s.days).filter((d) => d.done.length).length,
      minimumDays: Object.values(s.days).filter((d) => d.minimum).length,
      comebacks: Object.values(s.days).filter((d) => d.comeback).length,
      reflections: Object.keys(s.reflections).length,
      keepsakes: s.keepsakes.map((k) => `${k.type}@${k.date}`),
      grown: s.grown,
      from: START,
      to: day,
    },
    null,
    1,
  ),
);
await browser.close();
server.kill();
if (errors.length) console.log('console errors:', errors.slice(0, 5));
if (failures.length) console.log('FAILURES:\n' + failures.join('\n'));
console.log(failures.length || errors.length ? 'SOAK FAILED' : 'SOAK PASSED');
process.exit(failures.length || errors.length ? 1 : 0);
