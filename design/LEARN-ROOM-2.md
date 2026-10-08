# Learn room 2: choose what goes into Study

David, 2026-10-09: "Learn mode is linear: it forces you to learn blue and you can't continue … I like how Study works from the map: pick a color, Study, settings, go: overview (story) then the different games. That should be the classic studying for this app." Then: "The coolest part of Study is that it combines all the other games into one and gives a natural progression feeling." And: "Like Duolingo: a bunch of different mini games and tests disguised in a single lesson that keeps changing formats." And: "Typing the name really broke the flow."

## The spine
**The mixed Study session is the Learn room.** One lesson weaves meet (the story pager) → echo → recognize → match → spot it → odd one out → where it ends → recall, getting harder as each color climbs, with the progress visible: the climb bar, colors graduating, rings filling at the end. Everything on the Learn room only chooses **what goes into that lesson**, and every door opens the same Study sheet (lsOpen) as the map, with the same settings, story and games.

No unit is forced. Nothing is locked. There is no "finish blue first": every family is open from day one.

## The screen (four blocks, one filled button) — js/learnhub.js
1. **For you** (the hero). Plates of the colors picked, a headline and the only filled button, **Study**. The headline counts exactly what the sheet starts with: "4 to recall" (then "Then 6 more for you"), "Ten for you", or "Your first ten" on day one. The line under it says why: "3 next door to silver · 6 new at your level · one with a story".
2. **Your colors** (the one intentional thing): a rose of the nine families around the hue circle. Each wedge fills outward (area-true) as names become yours (solid) or are on the way (lighter); the hub says "N yours". Tap a wedge: Study opens on that family at your level (its due ones, then what you're learning, then new ones in the learning order; a finished family studies all of itself to keep it sharp). Under it: the current stage ("The first 150 words · 98 of 150 met") and "See them on the map".
3. **Or choose** (rows only when they have something): Stage test (once a stage is mostly met; optional) · Colors you looked at · Your favorites · Mix-ups · A painting's colors (the last one you looked at, else today's) · Surprise me · Make your own deck (Practice).
4. **Today** (the daily painting and Name it in six, unchanged).

## For you: the selection policy
In order, each pick at least ΔE00 4 from the others (a due review always goes in):
1. **Due reviews** (spaced review). Asked first in the lesson, from memory, never shown on a Meet or pair card first (studypace `due`). Their first answer is the review (prApply).
2. **Mix-ups** you've made (up to 4 colors), **colors you looked at** (up to 3), **the edge of your map** (edgeOfMap: names next door to yours, up to 3).
3. **One with a story**, clearly marked: an iconic name worth a detour (Tiffany blue, Mountbatten pink, Falu red …) or, every third day, a color from today's painting.
4. **New at your level.** The outer progression is the learning order's stages (common words first: the first 53, 101, 150, 250, 400, Fluent, Expert, every learnable color). The current stage is the first with under 80% of its names met. Inside it the picks **roam across every family**, round-robin, two per family at most, the families you're into first (favorites, what you looked at, the wedges you tapped, plus a daily jitter so the lead family changes). You're never "stuck on blues".
5. Colors that keep failing are set aside in the lesson (3 misses) and come back tomorrow; the ones that stick are reviewed less (the 1-3-7-16-35-90 day ladder).
6. **Stage test**: once a stage is mostly met, an optional row runs a mixed recall (Test me pace, 20 names) across the whole previous stage. Nothing waits on it; stragglers keep cycling in later lessons.

## The lesson: a format library — js/studypace.js spKind, js/studyformats.js
Each color climbs rungs; every rung has several formats, from easy to hard:

| rung | formats | the dial |
|---|---|---|
| 0 just met | **echo** (which of two is it? far apart) · name from 3 far · color from 3 far | far options while struggling |
| 1 recognize | name from 4 neighbors · color from 4 neighbors · **flash** (see it with its name for a moment, then find it among 4 close ones) | flash off while struggling and for a due review |
| 2 tell apart | color from 4 · odd one out (spot the difference) · **spot it** among 6, 8 or 10 tiles · **where does it end?** (nine steps to its nearest mate; tap the last one you'd still call it) | 6 / 8 / 10 tiles by how it's going |
| 3 recall | **recall**: the color alone, its name among 6 to 8 close same-family names, no hint (tap, never typing) · spot it among 10 when it's going well | typing only if you ask for it in the sheet (off by default) |
| set-level | matching (now and then), the lightning final round | |

Sequencing rules:
- The format is the one this color has met least on its rung, never the kind just asked (no two in a row).
- Due reviews first, then a wave of 2 or 3 new colors is met (story), echoed, and climbs; the next wave comes once it settles.
- Aim for 80-85% right: under 70% the session eases (far options, re-Looks, smaller waves); over 92% it hardens.
- A color missed 3 times is set aside for tomorrow, so a lesson always ends: about 3 to 5 minutes at the default 10.
- Every answer goes through prRecord: the Learner Model logs it (and the mix-up pair on a miss), a due card counts it as its review. Where-does-it-end keeps your border (S.edges) like Learn it does; it's perception, so it never counts as naming.
- Flashcards stay as one way in "Just one way"; self-graded cards are never part of the climb's top rung.

## How many
The sheet's How many (and Practice's, the map's lit-set count and Study the map's field): stops on the track (2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50, 75, 100 …) so small sizes get most of it, a short range keeps every number, and − / + steppers (44 pt, hold to repeat) for an exact count (core.js countify / stepify).

## Honest progress and saves
- Progress is the Learner Model's knowState per name (yours = named right on a later day). The wheel reads the same cards the path wrote, so old progress shows at once. Old unit cards and S.done stay; no migrateState step was needed. New keys: S.lh.fam (wedge taps), S.lh.tested (stage tests run), S.practice.ls.typingV (typing turned off once by default).
- Placement still sets the starting level (it gives the skipped tier its cards, so the first stage it lands in is the next one).

## States
New user (wheel empty, "Your first ten", "Every family is open"), mid user (dues, edge, mix-ups), no dues, a finished family, names still loading ("Gathering your colors"), each choice row hidden when empty, the stage test row once a stage is mostly met.

## Next
Sort light to dark and the mini gradient board as set-level formats; the edge and odd-one-out results feeding the eye profile in Train.
