// End-to-end checks against the production build in an iPhone-14-like Chromium
// (WebGL via SwiftShader). Usage: npm run build && npm run e2e
// Chromium is not Safari: the on-device checks are listed in README.
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

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
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
const cards = (page) => page.locator('.hand-slot:not(.leaving) .game-card:not(.add-card)');
const handTitles = (page) => cards(page).locator('.card-title').allInnerTexts();
const state = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('myday.state')));
const settle = (page, ms = 900) => page.waitForTimeout(ms);
const doneToday = async (page) => {
  const s = await state(page);
  const days = Object.keys(s.days).sort();
  return s.days[days[days.length - 1]].done.length;
};
const worldReady = (page) => page.waitForFunction(() => !!window.__world, null, { timeout: 15000 });

await check('loads: PWA meta, 3D world, hand of 4 cards, no horizontal scroll', async (page) => {
  await page.goto(URL + '?debug');
  await worldReady(page);
  await settle(page);
  const vp = await page.locator('meta[name=viewport]').getAttribute('content');
  assert(vp.includes('viewport-fit=cover'), 'viewport-fit=cover missing');
  const man = await (await page.request.get(URL + 'manifest.webmanifest')).json();
  assert(man.display === 'standalone', 'display not standalone');
  for (const i of man.icons) assert((await page.request.get(URL + i.src)).ok(), `icon ${i.src} missing`);
  assert(await page.locator('canvas').count(), 'no WebGL canvas');
  assert((await cards(page).count()) === 4, 'expected 4 mission cards');
  assert(await page.getByRole('button', { name: 'Add task' }).isVisible(), 'no add card');
  for (const w of [390, 320]) {
    await page.setViewportSize({ width: w, height: 800 });
    const sw = await page.evaluate(() => document.documentElement.scrollWidth);
    assert(sw <= w, `horizontal overflow at ${w}: ${sw}`);
  }
});

await check('touch targets are at least 44px', async (page) => {
  await page.goto(URL);
  await settle(page, 1500);
  const small = await page.evaluate(() =>
    [...document.querySelectorAll('button, [role=button], input')]
      .filter((b) => b.offsetParent && !b.classList.contains('sr-only') && b.dataset.hit !== 'extended')
      .map((b) => [b.getAttribute('aria-label') || b.textContent.trim().slice(0, 20), b.getBoundingClientRect()])
      .filter(([, r]) => r.height < 44 || r.width < 44)
      .map(([n, r]) => `${n} ${Math.round(r.width)}x${Math.round(r.height)}`),
  );
  assert(!small.length, `small targets: ${small.join(', ')}`);
});

await check('play a card → companion does it → persists → undo from played pile', async (page) => {
  await page.goto(URL + '?debug');
  await worldReady(page);
  await settle(page);
  const first = (await handTitles(page))[0];
  await cards(page).first().click();
  await settle(page, 2600);
  assert((await cards(page).count()) === 3, 'card should leave the hand');
  assert((await doneToday(page)) === 1, 'not saved');
  assert(await page.evaluate(() => [...window.__world.objects.values()].filter((o) => o.done).length === 1), 'world object not marked done');
  await page.reload();
  await worldReady(page);
  await settle(page);
  assert((await cards(page).count()) === 3, 'not persisted after reload');
  await page.getByRole('button', { name: /Done today · 1/ }).click();
  await page.getByRole('button', { name: /Undo/ }).click();
  await page.getByRole('button', { name: 'Close' }).click();
  await settle(page, 700);
  assert((await cards(page).count()) === 4, 'undo did not return the card');
  assert((await handTitles(page)).includes(first), 'undone card missing');
  assert((await doneToday(page)) === 0, 'storage not updated on undo');
});

await check('tap a glowing object in the 3D world to do that mission', async (page) => {
  await page.goto(URL + '?debug');
  await worldReady(page);
  await settle(page, 1200);
  const pt = await page.evaluate(() => {
    const w = window.__world;
    const id = [...w.objects.keys()][0];
    return { id, ...w.screenPoint(id) };
  });
  await page.mouse.click(pt.x, pt.y + 10);
  await settle(page, 2600);
  const s = await state(page);
  const d = Object.values(s.days)[0];
  assert(d.done.includes(pt.id), 'tapping the object did not complete it');
});

await check('drag spins the island (inspect from every side)', async (page) => {
  await page.goto(URL + '?debug');
  await worldReady(page);
  await settle(page);
  const before = await page.evaluate(() => window.__world.spin.rotation.y);
  await page.mouse.move(200, 420);
  await page.mouse.down();
  await page.mouse.move(330, 425, { steps: 8 });
  await page.mouse.up();
  await settle(page, 300);
  const after = await page.evaluate(() => window.__world.spin.rotation.y);
  assert(Math.abs(after - before) > 0.5, `island did not spin (${before} → ${after})`);
  assert((await doneToday(page)) === 0, 'a drag must not complete anything');
});

await check('XP is derived: play/undo repeatedly never inflates it', async (page) => {
  await page.goto(URL);
  await settle(page, 1500);
  for (let i = 0; i < 3; i++) {
    await cards(page).first().click();
    await settle(page, 2400);
    await page.getByRole('button', { name: /Done today/ }).click();
    await page.getByRole('button', { name: /Undo/ }).first().click();
    await page.getByRole('button', { name: 'Close' }).click();
    await settle(page, 600);
  }
  await cards(page).first().click();
  await settle(page, 3200);
  const label = await page.getByRole('progressbar').getAttribute('aria-label');
  assert(label === '10 / 50 XP', `XP drifted: ${label}`);
});

await check('add a custom task from the + card, persists, removable', async (page) => {
  await page.goto(URL);
  await settle(page, 1500);
  await page.getByRole('button', { name: 'Add task' }).click();
  await settle(page, 400);
  await page.keyboard.type('Call grandma');
  await page.keyboard.press('Enter');
  await settle(page, 600);
  assert((await handTitles(page)).includes('Call grandma'), 'custom card not shown');
  await page.reload();
  await settle(page, 1500);
  assert((await cards(page).count()) === 5, 'custom not persisted');
  await page.getByRole('button', { name: 'Remove task: Call grandma' }).click();
  await settle(page, 400);
  assert((await cards(page).count()) === 4, 'remove failed');
});

await check('all done → celebration card, bonus and level 2', async (page) => {
  await page.goto(URL);
  await settle(page, 1500);
  for (let i = 0; i < 4; i++) {
    await cards(page).first().click();
    await settle(page, 400);
  }
  await settle(page, 9000); // companion does each mission in turn
  assert(await page.getByText('All done for today').isVisible(), 'no completion card');
  assert(await page.getByText('+20 XP day bonus').isVisible(), 'no bonus');
  const label = await page.getByRole('progressbar').getAttribute('aria-label');
  assert(label === '10 / 75 XP', `expected level 2 with 10 XP, got ${label}`);
});

await check('local midnight rollover while open (Asia/Jerusalem)', async (page) => {
  await page.clock.install({ time: new Date('2026-09-27T23:59:20+03:00') });
  await page.goto(URL);
  await settle(page, 1500);
  await cards(page).first().click();
  await settle(page, 2500);
  await page.clock.fastForward('01:00');
  await settle(page, 400);
  const s = await state(page);
  assert(s.days['2026-09-27']?.done.length === 1, 'yesterday lost');
  assert(s.days['2026-09-28'], 'no record for the new local date');
  assert((await cards(page).count()) === 4, 'new day should deal a fresh hand');
  assert(await page.getByRole('button', { name: 'Chain: 1' }).isVisible(), 'chain chip should show 1');
});

await check('streak freeze applied on reopen after one missed day, shown in the week sheet', async (page, ctx) => {
  await page.clock.install({ time: new Date('2026-09-22T09:00:00+03:00') }); // Tue
  await page.goto(URL);
  await settle(page, 1500);
  await cards(page).first().click();
  await settle(page, 2500);
  await page.close();
  const p2 = await ctx.newPage();
  await p2.clock.install({ time: new Date('2026-09-24T09:00:00+03:00') }); // Thu, Wed missed
  await p2.goto(URL);
  await settle(p2, 1500);
  const s = await state(p2);
  assert(s.days['2026-09-23']?.frozen === true, 'freeze not recorded on the missed date');
  await p2.getByRole('button', { name: /^Chain:/ }).click();
  assert(await p2.getByText('A freeze kept your chain safe yesterday.').isVisible(), 'freeze message missing');
  assert((await p2.locator('li[aria-label*="Freeze"]').count()) === 1, 'week should show one freeze');
  await p2.getByRole('button', { name: 'Close' }).click();
  await cards(p2).first().click();
  await settle(p2, 2500);
  assert(await p2.getByRole('button', { name: 'Chain: 2' }).isVisible(), 'chain should continue through the freeze');
  await p2.reload();
  await settle(p2, 1200);
  const s2 = await state(p2);
  assert(Object.values(s2.days).filter((d) => d.frozen).length === 1, 'freeze must be idempotent');
});

await check('two missed days: no freeze spent, gentle fresh start', async (page, ctx) => {
  await page.clock.install({ time: new Date('2026-09-21T09:00:00+03:00') });
  await page.goto(URL);
  await settle(page, 1500);
  await cards(page).first().click();
  await settle(page, 2500);
  await page.close();
  const p2 = await ctx.newPage();
  await p2.clock.install({ time: new Date('2026-09-24T09:00:00+03:00') });
  await p2.goto(URL);
  await settle(p2, 1500);
  const s = await state(p2);
  assert(!Object.values(s.days).some((d) => d.frozen), 'no freeze expected');
  assert(await p2.getByRole('button', { name: 'Chain: 0' }).isVisible(), 'chain should restart');
});

await check('imports legacy Life RPG data and keeps the old keys', async (page) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('arch_record_v1'))
      localStorage.setItem('arch_record_v1', JSON.stringify({ xp: 140, wordIdx: 3, habits: [{ id: 1, txt: 'מקלחת קרה', done: true }, { id: 2, txt: 'סידור מיטה', done: false }], history: {}, bestDayXp: 60 }));
  });
  await page.goto(URL);
  await settle(page, 1500);
  assert((await handTitles(page)).includes('מקלחת קרה'), 'legacy habit not imported');
  assert((await cards(page).count()) === 5, 'expected 4 defaults + 1 imported');
  assert(await page.evaluate(() => !!localStorage.getItem('arch_record_v1')), 'legacy key deleted');
  const label = await page.getByRole('progressbar').getAttribute('aria-label');
  assert(label === '15 / 100 XP', `legacy XP not carried (${label})`);
});

await check('corrupt storage recovers and keeps a backup', async (page) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.setItem('myday.state', '{"schema":1,"days":{bad json');
      sessionStorage.setItem('seeded', '1');
    }
  });
  await page.goto(URL);
  await settle(page, 1500);
  assert((await cards(page).count()) === 4, 'app did not recover');
  assert(await page.evaluate(() => localStorage.getItem('myday.state.corrupt')), 'no backup of corrupt data');
});

await check('Hebrew device → RTL, no overflow', async (page) => {
  await page.goto(URL);
  await settle(page, 1500);
  assert((await page.evaluate(() => document.documentElement.dir)) === 'rtl', 'not rtl');
  assert((await handTitles(page)).includes('לצחצח שיניים'), 'hebrew routine missing');
  assert((await page.evaluate(() => document.documentElement.scrollWidth)) <= 390, 'overflow in rtl');
}, { locale: 'he-IL' });

await check('reduced motion: no flying particles, instant progress', async (page) => {
  await page.goto(URL);
  await settle(page, 1500);
  await cards(page).first().click();
  await settle(page, 200);
  const orbs = await page.evaluate(() => document.getElementById('fx-layer')?.children.length || 0);
  assert(orbs === 0, 'particles shown with reduced motion');
  assert((await page.getByRole('progressbar').getAttribute('aria-label')) === '10 / 50 XP', 'ring not updated');
}, { reducedMotion: 'reduce' });

await check('settings: routine editor rename/add/delete apply to today', async (page) => {
  await page.goto(URL);
  await settle(page, 1500);
  await page.getByRole('button', { name: 'Settings and routines' }).click();
  await page.getByRole('textbox', { name: 'Read one page' }).fill('Read two pages');
  await page.getByRole('button', { name: 'Delete routine: Make the bed' }).click();
  await page.getByPlaceholder('Add a routine…').fill('Stretch');
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await settle(page, 600);
  const titles = await handTitles(page);
  assert(titles.includes('Read two pages') && titles.includes('Stretch') && !titles.includes('Make the bed'), `hand: ${titles}`);
  await page.reload();
  await settle(page, 1500);
  assert((await cards(page).count()) === 4, 'routine edit not persisted');
});

await check('companions: locked ones cannot be picked; name shows in HUD', async (page) => {
  await page.goto(URL);
  await settle(page, 1500);
  await page.getByRole('button', { name: 'Settings and routines' }).click();
  assert(await page.getByRole('radio', { name: /Finish 50 tasks/ }).isDisabled(), 'Nori should be locked');
  await page.getByLabel('Your name').fill('Dana');
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await settle(page, 300);
  assert(await page.getByRole('heading', { name: 'Dana' }).isVisible(), 'name not shown');
});

await check('Luma unlocks at a 7-day chain and appears in the world', async (page) => {
  await page.clock.install({ time: new Date('2026-09-20T09:00:00+03:00') });
  await page.goto(URL + '?debug');
  await settle(page, 1500);
  for (let i = 0; i < 7; i++) {
    await cards(page).first().click();
    await settle(page, 600);
    await page.clock.fastForward('24:00:00');
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await settle(page, 300);
  }
  assert((await state(page)).seen.includes('buddy-luma'), 'luma unlock not recorded');
  await page.getByRole('button', { name: 'Settings and routines' }).click();
  await page.getByRole('radio', { name: /Luma/ }).click();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await settle(page, 300);
  assert((await state(page)).buddy === 'luma', 'buddy not saved');
  assert((await page.evaluate(() => window.__world?.species)) === 'luma', 'world should show Luma');
});

await check('service worker: works offline after first visit', async (page, ctx) => {
  await page.goto(URL);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await settle(page, 1500);
  await ctx.setOffline(true);
  await page.reload();
  await settle(page, 2000);
  assert((await cards(page).count()) === 4, 'app did not load offline');
  assert(await page.locator('canvas').count(), '3D world did not load offline');
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
