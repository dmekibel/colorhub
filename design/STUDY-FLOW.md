# Study flow: meet, then practice at your level

David, 2026-10-08: "Clicking Study goes straight into guessing while I don't really know. A study session should include some of the Look menu and then the study naturally ... We need a smart system where learning is fun, intuitive and always at your level."

The engine is a small DOM-free pacer (`js/studypace.js`, `spNew` / `spNext` / `spAnswer`) that decides what comes next. `lsStudy` (js/learnset.js) only draws what it says. `tools/practice_test.js` drives the pacer with simulated learners.

## 1. Meet, in small waves (learning, clearly separate from testing)
- Colors you can't name yet (knowState `none` or `met`) are met before they're asked. Colors that are `learning` or `yours` skip Meet.
- A **wave** is 2 or 3 new colors: 3 by default, 2 when the set's colors are near-twins (closest pair under ΔE 5) or when you're struggling. The first wave is met, practiced until each is past plain recognition, and then the next wave is met. The first new names are never all dumped on you at once.
- A **Meet card** fills the stage: a big swatch, the name, and one line on how it differs from its nearest neighbor in the set (a small pair chip beside it). Header: "Meet · 2 of 3". One tap (Next) moves on, at your pace.
- After a wave of 2 or more, a **pair card** shows the two closest colors of the wave side by side, halves of one big swatch, with the difference line. That's the Look's Pairs view, inside the session.
- **Mix-ups you've made before** (Learner Model `confusions()`, both colors in the set) get the same pair card before either is first asked, even if both are known.

## 2. Practice climbs a scaffold (recall before reveal on every question)
Each color climbs rungs; a right answer climbs one, a miss drops one.

| rung | question | options |
|---|---|---|
| 0 | see the color, pick its name | 3, far apart within its family (ΔE ≥ 14) |
| 1 | see the color, pick its name | 4 same-family neighbors (the usual) |
| 2 | see the name, find the color, or odd one out | 4 neighbors |
| 3 | recall: the color alone, its name among 6 to 8 close names (typing only when asked for; design/LEARN-ROOM-2.md has the full format library per rung) | 6-8 neighbors |
| 4 | climbed | |

- Start rung: new 0, `learning` 1, `yours` 3 (straight to recall). In "Choose · Test me" everything starts at 2 and Meet is skipped.
- Never the same kind twice in a row; a Matching round of the colors in play now and then (unchanged).
- A miss shows the big miss compare (js/misscompare.js), drops a rung, and the color comes back two questions later.

## 3. Always at your level (target 80-85% right)
- Rolling accuracy over the last 8 answers, seeded from the Learner Model (how much of the set you already know).
- **Ease** when it falls under 70%: rung 0 and 1 questions use 3 far options, a missed color gets a **re-Look** (its Meet card again, "Look again") before it comes back, and no new wave starts until things settle.
- **Harden** over 92%: a right answer on rung 0 jumps two rungs, waves grow to 3, no re-Looks.
- In between: a re-Look only after a second miss on the same color.
- A color missed 3 times in one session is **set aside for tomorrow** (its card is due tomorrow anyway): "Puce comes back tomorrow". So a session always ends, and a hard color never turns the session into a wall of red.

## 4. The sheet
- **For you** (default): the pacer above.
- **Choose**: Gentle (meet everything, ease on), Standard (meet the new ones), Test me (no Meet, start at rung 2).
- "Just one way" chips and Look stay as they are. A Learn it quick session (lsQuick, `o.quick`) keeps Meet for the unknown ones only and climbs to rung 3 (no typing round), so it stays short.

## States
Meet card (first, middle, last of a wave; very light and very dark swatches), pair card, re-Look, wave 2 starting ("2 more to meet"), set aside, ease and harden (silent: the questions change, not a banner), the results.

## 5. Pinned sets (from a pair, a set or a palette)
Study started from a pair, set or palette (csLearn kinds `set`, `palette`; the You page's kept sets) opens the sheet with those colors **pinned**: always in, marked, the set's identity (the end screen shows only them, "with N look-alikes"). **Neighbors** slider 0 to 4 per color (default 2 for a pair, 1 for 3 to 5, 0 beyond); `lsNeighbors` gives each pinned color its nearest Learn-layer names (ones you can't name yet first, round-robin so no neighbor is shared, ΔE >= 3 apart). Tap a look-alike to leave it out; "+ Add a color" reuses the set picker. The pacer gets `groups` (`[[pin, nb...]]`): a wave is one group (pin first), Meet compares a color with its group, and quiz distractors are the group's colors first. The saved set records `pin` and the route it came from.
