// End-to-end checks against the production build in an iPhone-14-like Chromium.
// Usage: npm run build && npm run e2e
// (Chromium is not Safari: real-device checks are still listed in README.)
import { chromium, devices } from '@playwright/test';
import { spawn } from 'node:child_process';

const PORT = 4179;
const URL = `http://localhost:${PORT}/`;
const iphone = devices['iPhone 14'];
const TZ = 'Asia/Jerusalem';

// Run vite directly (not via npx) so killing the process really frees the port.
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' });
await new Promise((res, rej) => {
  server.stdout.on('data', (d) => String(d).includes(String(PORT)) && res());
  server.on('exit', () => rej(new Error('preview server exited')));
  setTimeout(() => rej(new Error('preview server timeout')), 15000);
});

const browser = await chromium.launch();
const results = [];
async function check(name, fn, ctxOpts = {}) {
  const ctx = await browser.newContext({ ...iphone, timezoneId: TZ, ...ctxOpts });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  try {
    await fn(page, ctx);
    if (errors.length) throw new Error(`console errors: ${errors.slice(0, 3).join(' | ')}`);
    results.push([true, name]);
  } catch (e) {
    results.push([false, name, e.message.split('\n')[0]]);
  }
  await ctx.close();
}
const assert = (c, msg) => {
  if (!c) throw new Error(msg);
};
const progress = (page) => page.getByTestId('progress').innerText();
const firstOpen = (page) => page.locator('.task-row button[aria-pressed="false"]').first();
const state = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('myday.state')));
const settle = (page, ms = 900) => page.waitForTimeout(ms);

await check('loads with PWA meta, no horizontal scroll at 390px and 320px', async (page) => {
  await page.goto(URL);
  await settle(page);
  const vp = await page.locator('meta[name=viewport]').getAttribute('content');
  assert(vp.includes('viewport-fit=cover'), 'viewport-fit=cover missing');
  assert(await page.locator('link[rel=manifest]').count(), 'manifest link missing');
  const man = await (await page.request.get(URL + 'manifest.webmanifest')).json();
  assert(man.display === 'standalone', 'display not standalone');
  for (const i of man.icons) assert((await page.request.get(URL + i.src)).ok(), `icon ${i.src} missing`);
  assert((await page.request.get(URL + 'icons/apple-touch-icon.png')).ok(), 'apple-touch-icon missing');
  for (const w of [390, 320]) {
    await page.setViewportSize({ width: w, height: 800 });
    const sw = await page.evaluate(() => document.documentElement.scrollWidth);
    assert(sw <= w, `horizontal overflow at ${w}: ${sw}`);
  }
  assert((await progress(page)) === '0 / 4', 'expected 0 of 4');
});

await check('touch targets are at least 44px', async (page) => {
  await page.goto(URL);
  await settle(page);
  await page.getByRole('button', { name: /garden/i }).click();
  await page.waitForTimeout(300);
  const small = await page.evaluate(() =>
    [...document.querySelectorAll('button, [role=button], input')]
      .filter((b) => b.offsetParent && !b.classList.contains('sr-only'))
      .map((b) => [b.getAttribute('aria-label') || b.textContent.trim().slice(0, 20), b.getBoundingClientRect()])
      .filter(([, r]) => r.height < 44 || r.width < 44)
      .map(([n, r]) => `${n} ${Math.round(r.width)}x${Math.round(r.height)}`),
  );
  assert(!small.length, `small targets: ${small.join(', ')}`);
});

await check('complete → leaves list → persists after reload → undo from drawer', async (page) => {
  await page.goto(URL);
  await settle(page);
  await firstOpen(page).click();
  await settle(page, 1400);
  assert((await progress(page)) === '1 / 4', 'progress after complete');
  assert((await page.locator('.task-row').count()) === 3, 'completed task should leave the active list');
  await page.reload();
  await settle(page);
  assert((await progress(page)) === '1 / 4', 'not persisted after reload');
  await page.getByRole('button', { name: /Done today · 1/ }).click();
  await page.locator('ul[aria-label="Tap to undo"] button').first().click();
  await settle(page, 500);
  assert((await progress(page)) === '0 / 4', 'undo failed');
  const s = await state(page);
  const d = Object.values(s.days)[0];
  assert(d.done.length === 0, 'storage not updated on undo');
});

await check('XP is derived: toggling repeatedly never inflates it', async (page) => {
  await page.goto(URL);
  await settle(page);
  for (let i = 0; i < 3; i++) {
    await firstOpen(page).click();
    await settle(page, 900);
    await page.getByRole('button', { name: /Done today/ }).click();
    await page.locator('ul[aria-label="Tap to undo"] button').first().click();
    await settle(page, 500);
  }
  await firstOpen(page).click();
  await settle(page, 1400);
  const label = await page.getByRole('progressbar').getAttribute('aria-label');
  assert(label === '10 / 50 XP', `XP drifted: ${label}`);
});

await check('add a custom task with the keyboard, persists, removable', async (page) => {
  await page.goto(URL);
  await settle(page);
  await page.getByPlaceholder('Add a small task…').fill('Call grandma');
  await page.keyboard.press('Enter');
  await settle(page, 300);
  assert(await page.getByText('Call grandma').isVisible(), 'custom task not shown');
  assert(await page.getByPlaceholder('Add a small task…').evaluate((el) => el === document.activeElement && el.value === ''), 'input should clear and keep focus');
  await page.reload();
  await settle(page);
  assert((await progress(page)) === '0 / 5', 'custom not persisted');
  await page.getByRole('button', { name: 'Remove task: Call grandma' }).click();
  assert((await progress(page)) === '0 / 4', 'remove failed');
});

await check('all done → completion card with bonus', async (page) => {
  await page.goto(URL);
  await settle(page);
  for (let i = 0; i < 4; i++) {
    await firstOpen(page).click();
    await settle(page, 800);
  }
  await settle(page, 900);
  assert(await page.getByText('All done for today').isVisible(), 'no completion card');
  assert(await page.getByText('+20 XP day bonus').isVisible(), 'no bonus');
  const label = await page.getByRole('progressbar').getAttribute('aria-label');
  assert(label === '10 / 75 XP', `expected level 2 with 10 XP, got ${label}`); // 60 XP = L2 + 10
  assert(await page.locator('.bubble').count(), 'companion should celebrate');
});

await check('local midnight rollover while open (Asia/Jerusalem)', async (page) => {
  await page.clock.install({ time: new Date('2026-09-27T23:59:20+03:00') });
  await page.goto(URL);
  await settle(page);
  await firstOpen(page).click();
  await settle(page, 1300);
  await page.clock.fastForward('01:00');
  await settle(page, 300);
  assert((await progress(page)) === '0 / 4', 'new day should start fresh');
  const s = await state(page);
  assert(s.days['2026-09-27']?.done.length === 1, 'yesterday lost');
  assert(s.days['2026-09-28'], 'no record for the new local date');
  assert(await page.getByText('Your 1-day chain is waiting').isVisible(), 'chain should carry to the new day');
  assert(await page.getByRole('button', { name: 'Chain: 1' }).isVisible(), 'chain chip should show 1');
});

await check('streak freeze applied on reopen after one missed day, shown in week', async (page, ctx) => {
  await page.clock.install({ time: new Date('2026-09-22T09:00:00+03:00') }); // Tue
  await page.goto(URL);
  await settle(page);
  await firstOpen(page).click();
  await settle(page, 1300);
  await page.close();
  const p2 = await ctx.newPage();
  await p2.clock.install({ time: new Date('2026-09-24T09:00:00+03:00') }); // Thu, Wed missed
  await p2.goto(URL);
  await settle(p2);
  const s = await state(p2);
  assert(s.days['2026-09-23']?.frozen === true, 'freeze not recorded on the missed date');
  assert(await p2.getByText('A freeze kept your chain safe yesterday.').isVisible(), 'freeze banner missing');
  assert((await p2.locator('li[aria-label*="Freeze"]').count()) === 1, 'week view should show one freeze');
  await firstOpen(p2).click();
  await settle(p2, 1300);
  assert(await p2.getByText('2-day chain').isVisible(), 'chain should continue through the freeze');
  await p2.reload();
  await settle(p2);
  const s2 = await state(p2);
  assert(Object.values(s2.days).filter((d) => d.frozen).length === 1, 'freeze must be idempotent');
});

await check('two missed days: no freeze spent, gentle fresh start', async (page, ctx) => {
  await page.clock.install({ time: new Date('2026-09-21T09:00:00+03:00') });
  await page.goto(URL);
  await settle(page);
  await firstOpen(page).click();
  await settle(page, 1300);
  await page.close();
  const p2 = await ctx.newPage();
  await p2.clock.install({ time: new Date('2026-09-24T09:00:00+03:00') });
  await p2.goto(URL);
  await settle(p2);
  const s = await state(p2);
  assert(!Object.values(s.days).some((d) => d.frozen), 'no freeze expected');
  assert(await p2.getByText('A fresh start').isVisible(), 'expected fresh-start copy');
});

await check('imports legacy Life RPG data and keeps the old keys', async (page) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('arch_record_v1'))
      localStorage.setItem('arch_record_v1', JSON.stringify({ xp: 140, wordIdx: 3, habits: [{ id: 1, txt: 'מקלחת קרה', done: true }, { id: 2, txt: 'סידור מיטה', done: false }], history: {}, bestDayXp: 60 }));
  });
  await page.goto(URL);
  await settle(page);
  assert(await page.getByText('מקלחת קרה').isVisible(), 'legacy habit not imported');
  assert((await progress(page)) === '0 / 5', 'expected 4 defaults + 1 imported');
  assert(await page.evaluate(() => !!localStorage.getItem('arch_record_v1')), 'legacy key deleted');
  const label = await page.getByRole('progressbar').getAttribute('aria-label');
  assert(label === '15 / 100 XP', `legacy XP not carried (${label})`); // 140 = 50 + 75 + 15 → level 3
});

await check('corrupt storage recovers and keeps a backup', async (page) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.setItem('myday.state', '{"schema":1,"days":{bad json');
      sessionStorage.setItem('seeded', '1');
    }
  });
  await page.goto(URL);
  await settle(page);
  assert((await progress(page)) === '0 / 4', 'app did not recover');
  assert(await page.evaluate(() => localStorage.getItem('myday.state.corrupt')), 'no backup of corrupt data');
});

await check('Hebrew device → RTL layout, no overflow', async (page) => {
  await page.goto(URL);
  await settle(page);
  assert((await page.evaluate(() => document.documentElement.dir)) === 'rtl', 'not rtl');
  assert(await page.getByText('לצחצח שיניים').isVisible(), 'hebrew routine missing');
  assert((await page.evaluate(() => document.documentElement.scrollWidth)) <= 390, 'overflow in rtl');
}, { locale: 'he-IL' });

await check('reduced motion: no flying particles, meter updates at once', async (page) => {
  await page.goto(URL);
  await settle(page);
  await firstOpen(page).click();
  await settle(page, 100);
  const orbs = await page.evaluate(() => document.getElementById('fx-layer')?.children.length || 0);
  assert(orbs === 0, 'particles shown with reduced motion');
  assert((await page.getByRole('progressbar').getAttribute('aria-label')) === '10 / 50 XP', 'meter not updated');
}, { reducedMotion: 'reduce' });

await check('buddy: tap reacts, drag turns (no errors)', async (page) => {
  await page.goto(URL);
  await settle(page);
  const buddy = page.getByRole('button', { name: /Moji/ });
  await settle(page, 2500); // let the hello bubble pass
  await buddy.click();
  await settle(page, 200);
  assert(await page.locator('.bubble').count(), 'no speech bubble on tap');
  const b = await buddy.boundingBox();
  await page.mouse.move(b.x + 75, b.y + 75);
  await page.mouse.down();
  await page.mouse.move(b.x + 180, b.y + 78, { steps: 6 });
  await page.mouse.up();
  await settle(page, 3000);
});

await check('routine editor: rename, add, delete apply to today', async (page) => {
  await page.goto(URL);
  await settle(page);
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByRole('textbox', { name: 'Read one page' }).fill('Read two pages');
  await page.getByRole('button', { name: 'Delete routine: Make the bed' }).click();
  await page.getByPlaceholder('Add a routine…').fill('Stretch');
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await settle(page, 300);
  assert(await page.getByText('Read two pages').isVisible(), 'rename missing');
  assert(await page.getByText('Stretch').isVisible(), 'add missing');
  assert(!(await page.getByText('Make the bed').count()), 'delete failed');
  await page.reload();
  await settle(page);
  assert((await progress(page)) === '0 / 4', 'routine edit not persisted');
});

await check('companions: locked ones cannot be picked; name shows in header', async (page) => {
  await page.goto(URL);
  await settle(page);
  await page.getByRole('button', { name: 'Settings and routines' }).click();
  assert(await page.getByRole('radio', { name: /Finish 50 tasks/ }).isDisabled(), 'Nori should be locked');
  await page.getByLabel('Your name').fill('Dana');
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await settle(page, 300);
  assert(await page.getByRole('heading', { name: 'Dana' }).isVisible(), 'name not shown');
  await page.reload();
  await settle(page);
  assert(await page.getByRole('heading', { name: 'Dana' }).isVisible(), 'name not persisted');
});

await check('Luma unlocks at a 7-day chain and can be chosen', async (page) => {
  await page.clock.install({ time: new Date('2026-09-20T09:00:00+03:00') });
  await page.goto(URL);
  await settle(page);
  for (let i = 0; i < 7; i++) {
    await firstOpen(page).click();
    await settle(page, 900);
    await page.clock.fastForward('24:00:00');
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await settle(page, 300);
  }
  const s = await state(page);
  assert(s.seen.includes('buddy-luma'), 'luma unlock not recorded');
  await page.getByRole('button', { name: 'Settings and routines' }).click();
  await page.getByRole('radio', { name: /Luma/ }).click();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await settle(page, 300);
  assert((await state(page)).buddy === 'luma', 'buddy not saved');
  assert(await page.getByRole('button', { name: /^Luma, your companion/ }).isVisible(), 'hero should show Luma');
});

await check('service worker: works offline after first visit', async (page, ctx) => {
  await page.goto(URL);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await settle(page, 1500);
  await ctx.setOffline(true);
  await page.reload();
  await settle(page);
  assert((await progress(page)) === '0 / 4', 'app did not load offline');
  await ctx.setOffline(false);
}, { serviceWorkers: 'allow' });

await browser.close();
server.kill();

let failed = 0;
for (const [ok, name, err] of results) {
  console.log(`${ok ? '✓' : '✗'} ${name}${err ? `\n    ${err}` : ''}`);
  if (!ok) failed++;
}
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
