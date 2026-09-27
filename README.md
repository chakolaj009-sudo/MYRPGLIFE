# My Day — Mindful Growth

An installable, offline, iPhone-first PWA for small daily wins: open → see a few simple missions → complete them → feel calm progress.
Local-only (no backend, no login). English + Hebrew (RTL), light/dark.

```bash
npm install
npm run dev        # local dev server
npm test           # domain unit tests (Vitest)
npm run build      # production build → dist/
npm run e2e        # browser checks on the build, iPhone-14 viewport (Playwright + Chromium)
npm run icons      # re-render PNG icons + iOS splash screens from scripts/icon-art.mjs
```

## What's in the app

- **Hero**: a living scene (dawn / day / evening / starry night, or night in dark mode), your companion on a floating island, an **XP arc** that XP orbs fly into, a chain chip (flame grows at 3/7/14/30 days) and a growth chip.
- **Companions** (original designs): **Moji** (earth sprite, starter), **Luma** (moon sprite, unlocks at a 7-day chain), **Nori** (water sprite, unlocks at 50 tasks). Tap for a reaction (hop, wiggle, twirl, or a "breathe with me" moment); drag sideways to turn them around and inspect outfits. Outfits unlock by level: scarf (2), backpack (4), beanie (6), starry cape (9).
- **This week**: Monday–Sunday slots (all done ★, partial ring, freeze ❄), a gentle weekly destination (5 active days), chain message and freeze status.
- **Today**: daily missions + one-off tasks, +10 XP each, +20 XP when all are done. Completed missions leave the list; "Done today" lets you undo. All done → calm completion card.
- **Your garden** (collapsible): growth stage (Seed 0 → Sprout 5 → Young plant 15 → Sapling 30 → Mature tree 50 → Ancient tree 100 all-time tasks), totals, streaks, freeze info, keepsakes (first day, 7/14/30/100-day chains, 50 tasks) and the companion collection.
- **Settings sheet**: companion, optional name, daily missions (rename, delete, add, tap the icon to change it), language.

## Data model (`src/domain/model.js`)

One localStorage key, `myday.state`, holding a versioned object (`schema: 1`). Days are keyed by the **local** calendar date `YYYY-MM-DD`; all date math goes through integer day numbers (`src/domain/dates.js`), so DST and UTC offsets never move a boundary.

- Totals, XP, level, streaks, stages, keepsakes and companion unlocks are **derived** from `days` + `archive`, never kept as running counters, so toggling a task any number of times cannot drift.
- Malformed data is normalised; corrupt JSON is copied to `myday.state.corrupt` and the app starts fresh. Unknown fields from newer versions are kept.
- History is bounded: days older than 400 are folded into `archive` without changing totals or streaks.
- The old "Life RPG" prototype data (`arch_record_v1`, `bridge_rpg_v1`) is imported once (habits → daily missions, open tasks → today, old XP kept) and **never deleted**. The old pages live in `legacy/`.

### Streak freeze rule (deterministic)

- A day counts when at least one task is done. Today can never break the chain.
- A freeze protects **exactly one** missed day: the gap between the last counted/frozen day and today must be exactly one day, and the chain before it must be ≥ 1.
- **At most one freeze per Monday–Sunday week** (the week of the protected day).
- Two or more consecutive missed days: no freeze is spent, and the chain restarts gently.
- A frozen day is recorded on that date (`frozen: true`) and shown as ❄ in the week. It adds no tasks, completions or XP, and does not lengthen the chain.
- It is evaluated when a day begins (app open, midnight rollover, returning to the app) and is idempotent.

## Remaining checks on a real iPhone (Safari / installed PWA)

Automated checks run in Chromium, not WebKit. Please verify on device:

1. Add to Home Screen: icon, name, splash, standalone launch, sky under the status bar (black-translucent) and safe areas on notch / Dynamic Island.
2. Offline launch from the home screen after one online visit, and the "fresh version" refresh toast after a new deploy.
3. Drag-to-turn on the companion doesn't fight vertical page scrolling; tap reactions feel right.
4. Keyboard: adding a task keeps focus, the "done" key submits, no zoom on focus, and the sheet scrolls with the keyboard open.
5. Midnight rollover and freeze behaviour over real days, and that data survives iOS storage pressure (installed PWAs keep their own storage).
6. Reduced Motion (Settings → Accessibility) disables particles and bouncing.
