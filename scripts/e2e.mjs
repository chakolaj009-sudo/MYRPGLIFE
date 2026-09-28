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
process.on('exit', () => server.kill()); // never leave the port busy, even after a crash
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
/** Poll until the level ring shows `label` (XP lands after the companion walks + orbs fly). */
const xpIs = async (page, label, ms = 10000) => {
  const t0 = Date.now();
  let last = '';
  while (Date.now() - t0 < ms) {
    last = await page.getByRole('progressbar').getAttribute('aria-label');
    if (last === label) return true;
    await page.waitForTimeout(250);
  }
  throw new Error(`expected XP "${label}", got "${last}"`);
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
  await page.mouse.move(120, 330);
  await page.mouse.down();
  await page.mouse.move(280, 335, { steps: 8 });
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
  await xpIs(page, '10 / 50 XP');
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
  await xpIs(page, '10 / 75 XP');
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
  assert(await page.getByRole('button', { name: 'This month: 1 day' }).isVisible(), 'month chip should show 1 day');
});

await check('comeback after a gap: opens gently into Minimum day, nothing shown as lost', async (page, ctx) => {
  await page.clock.install({ time: new Date('2026-09-21T09:00:00+03:00') });
  await page.goto(URL);
  await settle(page, 1500);
  await cards(page).first().click();
  await settle(page, 2500);
  await page.close();
  const p2 = await ctx.newPage();
  await p2.clock.install({ time: new Date('2026-09-24T09:00:00+03:00') }); // two days missed
  await p2.goto(URL);
  await settle(p2, 1600);
  const s = await state(p2);
  assert(s.days['2026-09-24']?.minimum && s.days['2026-09-24']?.comeback, 'comeback day should be a Minimum day');
  await p2.getByText("You're here. That's the whole thing.").waitFor({ timeout: 6000 });
  assert((await p2.getByRole('button', { name: 'Minimum day' }).getAttribute('aria-pressed')) === 'true', 'toggle should be on');
  assert((await handTitles(p2)).includes('Rinse your mouth'), 'tiny versions should be shown');
  assert(await p2.getByRole('button', { name: 'This month: 1 day' }).isVisible(), 'showed-up days are never erased');
  const text = await p2.locator('body').innerText();
  assert(!/streak|chain|lost|missed|broke/i.test(text), 'no loss language on screen');
  await cards(p2).first().click();
  await settle(p2, 2600);
  assert(await p2.getByRole('button', { name: 'This month: 2 days' }).isVisible(), 'minimum day counts fully');
  await xpIs(p2, '17 / 50 XP');
});

await check('Minimum day toggle: tiny versions, softer world, counts fully', async (page) => {
  await page.goto(URL + '?debug');
  await worldReady(page);
  await settle(page);
  await page.getByRole('button', { name: 'Minimum day' }).click();
  await settle(page, 400);
  const titles = await handTitles(page);
  assert(titles.join('|') === 'Rinse your mouth|Straighten the pillow|Read one sentence|Three slow breaths', `tiny titles: ${titles}`);
  assert(await page.evaluate(() => window.__world.soft === true), 'world should soften');
  assert((await cards(page).first().locator('.card-xp').innerText()).includes('7'), 'card shows +7');
  await cards(page).first().click();
  await settle(page, 3200);
  await xpIs(page, '7 / 50 XP');
  assert(await page.getByRole('button', { name: 'This month: 1 day' }).isVisible(), 'minimum day counts as showing up');
  await page.getByRole('button', { name: 'Minimum day' }).click();
  await settle(page, 300);
  assert((await handTitles(page)).includes('Make the bed'), 'full versions back');
  const s = await state(page);
  assert(Object.values(s.days)[0].minimum === undefined, 'toggle off persisted');
});

await check('growth appears overnight: planted today, discovered next open', async (page, ctx) => {
  await page.clock.install({ time: new Date('2026-09-26T09:00:00+03:00') });
  await page.goto(URL + '?debug');
  await worldReady(page);
  await settle(page, 1200);
  await cards(page).first().click(); // first ever completion of this habit
  await settle(page, 3000);
  const id = (await state(page)).days['2026-09-26'].done[0];
  assert(await page.evaluate((id) => window.__world.objects.get(id).bud.visible, id), 'a bud should show something was planted');
  assert(await page.evaluate((id) => window.__world.objects.get(id).tier, id) === 0, 'growth must not appear the same day');
  await page.close();
  const p2 = await ctx.newPage();
  await p2.clock.install({ time: new Date('2026-09-27T09:00:00+03:00') });
  await p2.goto(URL + '?debug');
  await worldReady(p2);
  await p2.clock.runFor(4500); // the opening sequence: hello → what grew
  await p2.getByText(/something new grew/).waitFor({ timeout: 10000 });
  assert(await p2.evaluate((id) => window.__world.objects.get(id).tier, id) === 1, 'new growth revealed');
  assert((await state(p2)).grown[id] === 1, 'discovery remembered');
  await p2.reload();
  await worldReady(p2);
  await p2.clock.runFor(6000);
  assert(!(await p2.getByText(/something new grew/).count()), 'discovery is shown only once');
});

await check('weekly reflection: once a week, three lines, one-tap answer, then the day', async (page, ctx) => {
  await page.clock.install({ time: new Date('2026-09-22T09:00:00+03:00') }); // Tue
  await page.goto(URL);
  await settle(page, 1500);
  await cards(page).first().click();
  await settle(page, 2500);
  await page.close();
  const p2 = await ctx.newPage();
  await p2.clock.install({ time: new Date('2026-09-28T09:00:00+03:00') }); // next Monday
  await p2.goto(URL);
  await p2.getByRole('dialog', { name: 'Your week' }).waitFor({ timeout: 8000 });
  await p2.clock.runFor(5000);
  const lines = await p2.locator('.reflect-line').allInnerTexts();
  assert(lines.length === 3, `expected 3 lines, got ${lines.length}`);
  assert(/once this week/.test(lines[0]) && /^On Tuesday/.test(lines[1]), `lines: ${lines.join(' / ')}`);
  await p2.getByRole('radio', { name: 'Mornings' }).click();
  await p2.getByRole('button', { name: 'Keep going' }).click();
  await p2.clock.runFor(2000);
  await settle(p2, 500);
  assert(!(await p2.getByRole('dialog', { name: 'Your week' }).count()), 'reflection should close');
  const s = await state(p2);
  assert(s.reflections['2026-09-21']?.answer === 'Mornings', 'answer not saved');
  await p2.reload();
  await settle(p2, 2000);
  assert(!(await p2.getByRole('dialog', { name: 'Your week' }).count()), 'shown only once a week');
  assert((await cards(p2).count()) >= 1, 'the day continues normally');
});

await check('rare moment: first Minimum day leaves a dated pebble in the world (max one a week)', async (page) => {
  await page.goto(URL + '?debug');
  await worldReady(page);
  await settle(page, 1000);
  await page.getByRole('button', { name: 'Minimum day' }).click();
  await settle(page, 400);
  await cards(page).first().click();
  await page.getByText("A tiny day still counts. I'll keep this pebble for it.").waitFor({ timeout: 15000 });
  const s = await state(page);
  assert(s.keepsakes.length === 1 && s.keepsakes[0].type === 'first-minimum', 'keepsake not saved');
  assert(await page.evaluate(() => window.__world.pebbles.size === 1), 'pebble not in the world');
  await cards(page).first().click();
  await settle(page, 3500);
  assert((await state(page)).keepsakes.length === 1, 'at most one a week');
  await page.getByRole('button', { name: /^Growth/ }).click();
  assert(await page.getByText('Your first Minimum day').isVisible(), 'moment missing from the garden');
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
  await xpIs(page, '15 / 100 XP');
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
  await page.getByRole('textbox', { name: 'Read one page', exact: true }).fill('Read two pages');
  await page.getByRole('button', { name: 'Delete routine: Make the bed' }).click();
  await page.getByPlaceholder('Add a routine…').fill('Stretch');
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await settle(page, 600);
  const titles = await handTitles(page);
  assert(titles.includes('Read two pages') && titles.includes('Stretch') && !titles.includes('Make the bed'), `hand: ${titles}`);
  // tiny version editing
  await page.getByRole('button', { name: 'Settings and routines' }).click();
  await page.getByRole('textbox', { name: 'Tiny version: Read two pages' }).fill('Read one line');
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('button', { name: 'Minimum day' }).click();
  await settle(page, 300);
  assert((await handTitles(page)).includes('Read one line'), 'custom tiny version not used');
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

await check('Luma appears after showing up on 7 days', async (page) => {
  await page.clock.install({ time: new Date('2026-09-20T09:00:00+03:00') });
  await page.goto(URL + '?debug');
  await settle(page, 1500);
  for (let i = 0; i < 7; i++) {
    // Crossing into a new week brings the weekly story first; skip it here.
    const skip = page.getByRole('button', { name: 'Not now' });
    if (await skip.count()) {
      await page.clock.runFor(5000);
      await skip.click();
      await settle(page, 300);
    }
    await cards(page).first().click();
    await settle(page, 600);
    await page.clock.fastForward('24:00:00');
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await settle(page, 400);
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
