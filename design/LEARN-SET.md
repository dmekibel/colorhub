# Learn a set (lane: Learn sheet + Look + Study)

David, 2026-10-08: "In Home, if I click a color I can click Learn. This is a genius feature and we need to make it perfect." Plus: "make it as fun as possible."

## One door, everywhere
Every "Learn" in the app (Home color, color and name pages, the Home Study corner, csLearn for paintings, palettes, favorites, "Learn these colors" under a palette, Colordle's misses) goes through `prQuick` → `lsOpen` (js/learnset.js). So Look and Study are never missing. `prQuick` keeps its old sheet only for a call with no seed and no colors.

## The sheet
- Title: "Learn *Rose*" (and its look-alikes) or "Learn *Sargent's colors*".
- **Live preview**: the colors that will be in the set, as tiles with names, redrawn while you slide.
- **How many** slider: 3 to 30 (or 3 to all for a given set). Snaps to whole colors, the count reads live.
- **How close** slider (only for a color and its look-alikes): Twins · Close · Neighbors · Cousins · Wide. It's the minimum ΔE2000 between any two chosen colors (2.5, 5, 9, 14, 22), picked greedily outward from the seed. Twins is the hard, nerdy set; Wide is a gentle tour.
- From (only when both exist): its look-alikes / the colors you were looking at.
- Two big buttons: **Look** (secondary) and **Study** (primary, with a time estimate).
- "Ask me to type names" switch (Study's late stage).
- "Just one way": Flashcards, Quiz, Matching, Type it, Odd one out, and the full lesson when the color has one. These start at once.
- Remembers size, closeness and typing (S.practice.ls).

## Look (nothing hidden)
One screen, a segmented switch with six views; one tap switches, the choice is remembered:
- **Grid**: big tiles, name and hex.
- **Strip**: full-width bands, sorted light to dark or by hue (a second tiny toggle).
- **Pairs**: each color with its nearest one in the set, closest pairs first, with the one-line difference and a plain closeness word.
- **Map**: the set laid out as a honeycomb cluster (honeyCluster from js/honey.js: hue across, light to dark down), plus "See it on the big map" (csOnMap).
- **Paintings**: museum paintings whose palettes hold these colors (ΔE under 10), with the matched colors under each.
- **Carousel**: one big swatch per screen, swipe through, name, hex and the difference from its nearest neighbor.
Every color tile opens its page in one tap. The footer: "Test me" starts Study.

## Study (the mixed session, like Quizlet Learn, tuned for fun)
- Each color climbs a ladder: **new → familiar → mastered** (levels 0-3).
  - level 0: see the color, pick the name (4 same-family options)
  - level 1: see the name, pick the color, or odd one out (rotates)
  - level 2: type the name (if typing is on) or a recall flashcard
  - a right answer climbs one rung; a miss drops one and the color comes back two questions later.
- At most 4 colors are "in play" at once; new ones join as others climb (no flood of new names).
- Every 6-7 questions, a **Matching** round (names on the left, colors on the right, tap one then the other) with the colors in play; each clean pair climbs a rung.
- Never the same kind of question twice in a row.
- **Momentum**: right answers move on by themselves (0.65 s); wrong answers teach (the two colors side by side with the difference) and wait for Next.
- **Combo**: a streak pill that climbs; at 3, 5, 10, 15 it pops with a stronger haptic and a line ("5 in a row").
- **Graduation**: when a color reaches mastered, its segment fills solid and a chip slides in: "Rose · mastered".
- **Boss round**: when every color is mastered, "Final round: lightning match", all (up to 6) against the clock. Best time kept per set.
- Results: the set's plate, "All 10 *mastered*", tiles (first-try %, best streak, time, boss time with best), the mastered colors (tap → page), "You mixed these up" pairs (tap → page) with "See them side by side" (Look, Pairs view). Actions: Study again, Look again, Share.
- Honest: every answer goes through prRecord (Learner Model learnerLog, Tricky, scheduling only for due learned colors). Self-graded flashcards never schedule.

## Matching (no more memory flipping)
PR_STEPS.match now lays names in a left column and colors in a right column. Tap a name then a color (or the reverse). A right pair flashes and fades out; a wrong pair shakes and teaches the difference.

## States
First time (the coach line: "Each color climbs from picking to typing"), right, wrong, streak, graduation, match round, boss, results with and without mix-ups, stopped early (results of what you did), a set of 1-2 colors (no Match, no boss), no paintings found (a quiet line), sets of very light and very dark colors (ink chosen per swatch).
