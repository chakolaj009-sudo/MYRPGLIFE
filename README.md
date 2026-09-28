# My Day — Mindful Growth

An installable, offline, iPhone-first PWA that grounds you in the present and builds self-esteem through small daily wins. You don't tick a list: you play **cards** into a living **3D floating island**, and your companion walks over and does each mission with you. Local-only (no account, no server). English + Hebrew (RTL). Light and dark.

```bash
npm install
npm run dev        # local dev server
npm test           # domain unit tests (Vitest)
npm run build      # production build → dist/
npm run e2e        # 22 browser checks on the build, iPhone-14 viewport (Playwright + Chromium/SwiftShader)
npm run soak       # ~7 weeks of simulated real use with invariants checked every day
npm run icons      # re-render PNG icons + iOS splash screens
```

## The daily loop

- **The world is the home screen.** A floating island under a sky that follows your local time (dawn, day, evening, starry night; night in dark mode). Drag to spin it and see everything from every side.
- **Play a card, do the thing.** Today's missions are a hand of chunky cards. Tap or flick one up (or tap its glowing object on the island): the companion walks over and acts it out, sparkles burst, and XP orbs fly into the level ring. Played cards go to a pile you can undo from. The **+** card adds a one-off task.
- **Minimum day.** Every habit can have a tiny version ("Read 20 min" → "Read 1 page"). One quiet toggle swaps every card to its tiny version. It counts fully: no asterisk, no "partial" label, only slightly lower XP (7 instead of 10). The light softens and the companion curls up nearby. The app never asks why.
- **Gentle comeback.** After any gap, the app opens straight into a Minimum day with one line: *"You're here. That's the whole thing."* It never shows what was missed.
- **Continuity, not streaks.** The HUD shows *days you showed up this month*. Missing a day never erases anything.

## A world that grows from your real habits

Each habit grows its own corner from lifetime completions (1 · 3 · 7 · 14 · 30 · 60):

- **Reading:** a stack of books, then more books, a bookshelf, a reading lamp, a plant, a cosy armchair.
- **Walking:** a stepping-stone path, a longer path, trees along it, flowers, a little signpost.
- **Water:** a puddle, then a pond, lily pads, reeds, a ring of stones, a frog.
- **Mindfulness:** a stone cairn, a taller cairn, a bonsai, a wind chime, a sand garden, a glowing lantern.
- **Everything else:** flowers, a bush, a tree, a lantern, more flowers, a blossoming tree.

Growth appears **overnight**: today's completions plant a glowing bud, and the new piece is revealed the next time you open the app. The island turns to show it: *"Look — something new grew by …"*. Nothing ever wilts or decays. The central tree follows your all-time tasks (Seed → Sprout → Young plant → Sapling → Mature tree → Ancient tree).

## Once a week: your story

On the first open of a new week (if you showed up), the companion tells the week in three plain lines: a pattern (*"You walked 4 times this week."*), one real moment (*"On Thursday you used Minimum day and still …"*) and what changed (*"A longer path appeared by …"*). Then it asks one question, *"What helped this week?"*, with one-tap answers or a line of text. Now and then it quotes a past answer back. There are no charts; numbers live one tap deeper, in *Your garden*.

## Rare moments

Rare moments are triggered by meaning and capped at **one per week**:
- your first Minimum day
- coming back after a gap
- a full day right after a Minimum day
- the 50th completion of one habit
- a habit kept up through a month

Each gets a small unique animation, one line from the companion, and a dated **pebble** left on the island. Tap a pebble to remember the moment.

## Companions and rewards

**Moji** (earth sprite) is the first friend. **Luma** (moon sprite) appears after 7 days showed up, and **Nori** (water sprite) after 50 tasks. All three are original designs, in 3D on the island and 2D in menus. As you level up, the companion finds a scarf, a backpack, a beanie and a starry cape. Medals for days showed up and tasks done unlock quietly in the garden.

Deliberately avoided: streak loss, wilting, guilt copy, currencies or shops, leaderboards, daily reward popups and notifications. At most one gentle reminder a day, if reminders are ever added.

## Data (`src/domain/model.js`)

- **One store.** Everything lives in one localStorage key, `myday.state`, as a versioned object (`schema: 2`). Days are keyed by the **local** calendar date `YYYY-MM-DD`; date math uses integer day numbers, so DST and UTC offsets can't shift a day.
- **Derived, never counted.** Totals, XP, level, days showed up, growth tiers and medals are always recalculated from history, so toggling a task never drifts. Keepsakes and reflection answers are stored as history.
- **Migrations.** v1 (the streak era) → v2 keeps all completions and simply drops old freeze markers. The old "Life RPG" prototype data (`arch_record_v1`, `bridge_rpg_v1`) is imported once and never deleted; its pages live in `legacy/`.
- **Resilience.** Corrupt data is backed up to `myday.state.corrupt`. History older than 400 days folds into an archive (never inside the current month), and unknown fields from newer versions are kept.
- **Graceful fallbacks.** Without WebGL the app shows the 2D companion and every card still works. With Reduced Motion, particles, walking and bouncing are skipped.

## Checks still to do on a real iPhone

Automated checks run in Chromium (WebGL via SwiftShader), not Safari:
1. Add to Home Screen: icon, splash, standalone launch, the sky running under the status bar, and safe areas on notch / Dynamic Island.
2. 3D smoothness and battery on the device's GPU. Rendering pauses in the background.
3. Drag-to-spin vs. scrolling the card row, and that tap and flick feel right.
4. Offline launch after one online visit, and the "fresh version" refresh toast after a deploy.
5. Keyboard: adding a task and the reflection text field (no zoom, the "done" key submits).
6. Real days: overnight growth, the Monday reflection, comeback after a gap.
