// Visual review: captures every screen of the production build at phone and
// desktop widths, light and dark. Usage: npm run build && node scripts/shots.mjs [outDir]
import { chromium, devices } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { createState, toggleItem, setMinimum, markGrown, awardReaction, recordReflection } from '../src/domain/model.js';
import { addDays, weekStart } from '../src/domain/dates.js';

const OUT = process.argv[2] || 'shots';
mkdirSync(OUT, { recursive: true });
const PORT = 4186;
const URL = `http://localhost:${PORT}/`;
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' });
process.on('exit', () => server.kill());
await new Promise((res, rej) => {
  server.stdout.on('data', (d) => String(d).includes(String(PORT)) && res());
  setTimeout(() => rej(new Error('preview server timeout')), 15000);
});

const TODAY = '2026-09-28'; // a Monday
// Three weeks of lived-in history (a Minimum day, a gap, growth, a keepsake).
function history({ reflected = true } = {}) {
  let s = createState();
  const ids = ['r-teeth', 'r-bed', 'r-read', 'r-mind'];
  for (let i = 20; i >= 1; i--) {
    const k = addDays(TODAY, -i);
    if (i === 9 || i === 10) continue;
    const n = i % 4 === 0 ? 2 : 4;
    if (i === 12) s = setMinimum(s, k, true);
    for (const id of ids.slice(0, n)) s = toggleItem(s, k, id);
    s = awardReaction(s, k).state;
    s = markGrown(s, addDays(k, 1));
  }
  if (reflected) s = recordReflection(s, weekStart(addDays(TODAY, -7)), 'Rest', TODAY);
  return s;
}

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
async function open({ state, hour = 10, dark = false, width, height, mobile = true } = {}) {
  const base = mobile ? devices['iPhone 14'] : { viewport: { width, height }, deviceScaleFactor: 1 };
  const ctx = await browser.newContext({ ...base, ...(width ? { viewport: { width, height } } : {}), colorScheme: dark ? 'dark' : 'light', timezoneId: 'Asia/Jerusalem' });
  const page = await ctx.newPage();
  page.setDefaultTimeout(15000);
  if (state) await page.addInitScript((j) => localStorage.getItem('myday.state') || localStorage.setItem('myday.state', j), JSON.stringify(state));
  await page.clock.install({ time: new Date(`${TODAY}T${String(hour).padStart(2, '0')}:10:00+03:00`) });
  await page.clock.resume();
  await page.goto(URL + '?debug');
  await page.waitForFunction(() => !!window.__world, null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1800);
  return { page, ctx };
}
const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}.png` });

// Home, fresh install
{
  const { page, ctx } = await open();
  await shot(page, '01-home-fresh');
  await page.getByRole('button', { name: 'Minimum day' }).click();
  await page.waitForTimeout(900);
  await shot(page, '02-home-minimum');
  await ctx.close();
}
// Home with history, a card played, then the sheets
{
  const { page, ctx } = await open({ state: history() });
  await page.waitForTimeout(4000);
  await shot(page, '03-home-history');
  await page.locator('.hand-slot:not(.leaving) .game-card:not(.add-card)').first().click();
  await page.waitForTimeout(350);
  await shot(page, '04-play-motion');
  await page.waitForTimeout(3500);
  await shot(page, '05-home-played');
  await page.getByRole('button', { name: /^This month/ }).click();
  await page.waitForTimeout(500);
  await shot(page, '06-sheet-week');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /^Growth/ }).click();
  await page.waitForTimeout(500);
  await shot(page, '07-sheet-garden');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /^Done today/ }).click();
  await page.waitForTimeout(500);
  await shot(page, '08-sheet-played');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Add task' }).click();
  await page.waitForTimeout(500);
  await page.getByLabel('Task', { exact: true }).fill('Call mum');
  await shot(page, '09-sheet-add');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Settings and routines' }).click();
  await page.waitForTimeout(500);
  await shot(page, '10-sheet-settings');
  await ctx.close();
}
// All done
{
  let s = history();
  for (const id of ['r-teeth', 'r-bed', 'r-read', 'r-mind']) s = toggleItem(s, TODAY, id);
  const { page, ctx } = await open({ state: s });
  await page.waitForTimeout(1500);
  await shot(page, '11-home-alldone');
  await ctx.close();
}
// Weekly story
{
  const { page, ctx } = await open({ state: history({ reflected: false }) });
  await page.waitForTimeout(8000);
  await page.waitForSelector('.reflect-ask.on', { timeout: 30000 });
  await page.getByRole('radio', { name: 'Rest' }).click();
  await page.waitForTimeout(300);
  await shot(page, '12-reflection');
  await ctx.close();
}
// Night / dark, desktop
{
  const { page, ctx } = await open({ state: history(), hour: 22, dark: true });
  await page.waitForTimeout(3000);
  await shot(page, '13-home-night');
  await ctx.close();
}
{
  const { page, ctx } = await open({ state: history(), mobile: false, width: 1440, height: 900 });
  await page.waitForTimeout(3000);
  await shot(page, '14-desktop');
  await page.getByRole('button', { name: /^Growth/ }).click();
  await page.waitForTimeout(500);
  await shot(page, '15-desktop-garden');
  await ctx.close();
}
// Hebrew, right to left
{
  const { page, ctx } = await open({ state: { ...history(), lang: 'he' } });
  await page.waitForTimeout(3000);
  await shot(page, '16-home-rtl');
  await ctx.close();
}
await browser.close();
server.kill();
console.log('shots written to', OUT);
