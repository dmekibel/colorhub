# Checkpoint: what the atlas measured (2026-10-08, 22:50)

Stage 1 of design/audit-graph/PLAN.md. Measured on a frozen copy of main (280fc4d0) by `design/audit-graph/atlas.js` (2 seconds, read-only, no agents). Full output: ATLAS.md.

**The bar was 15 real, fixable defects not already in the ledger. It found 24.** So the plan's rule applies: don't spend on invention agents yet. The next level is mostly already built and blocked.

## 1. Broken right now (a person can see it)
1. **The field notes have lost three data sources on every color page.** Commit `aa763463` (2 h ago) deleted `data/analysis/color-artists.json`, `color-pairs.json` and `reach.json` (the same wipe that took `articles-lite.json`; only that one was restored). Every color page now silently loses:
   - the painters who favor it (`js/richcolor.js:364`);
   - "Its company" (`:451`);
   - the reach glance cards (`:497`).
   This is a big part of why Cinnamon Buff felt empty. Fix: `python3 tools/build_richdata.py && python3 tools/archive_reach.py`, then extend the new check gate to every file the app fetches.
2. **Six features are silently switched off.** Each is guarded by `typeof` for a function no file defines (undef_scan's WARN list, never acted on):
   - `paintingLesson`: the "Learn this painting" button never shows (artwiki.js:509);
   - `lmYouAndPainter`: "You and this painter" (artwiki.js:325);
   - `painterPage`: painter results in Browse (browse-ui.js:703);
   - `challengeRounds`: the You week strip (you.js:129);
   - `hmDismissHint`: the home hint is never dismissed (home.js:386 and 3 more);
   - `mixLab`: an article's mix links (article.js:653; waits for the Mix lab).

## 2. Loops that never close (the Learner Model)
3. **"find" is never written.** learner.js defines it ("color, src: camera | photo"), but the camera names colors and records nothing. The last step of the core loop (Look → Learn → Recall → **Find**) has no memory. This is the backbone of ledger #17 ("spotted teal today").
4. **`interests()` has no caller.** The app tracks which strands you follow (paintings, poems, prose…), and nothing reads it: For you isn't personal.
5. **`seenIn()` has no caller.** The app knows where you met each color (this painting, that poem), and no color page says so. It is the learning KB's transfer cue: "where have you seen this before?"
   Together, 4 and 5 are ledger #19 (the color mind profile and coach). The data exists; only the readers are missing.

## 3. Computed, shipped, never shown (dark data)
6. **Role paintings for 1,434 colors** (`fieldnotes ar.rp_`): for each color, a real painting where it plays the shadow, the mid-tone, the light, the accent and the hidden note. That's "never one palette" for a single color, five ways, already computed. It feeds ledger #4 (rich pages) and #5 (painting analysis).
7. **Werner's 1821 examples** (animal / plant / mineral, e.g. Indigo Blue: "Blue Copper Ore") sit on 99 color nodes. They appear only on the Twins page, never on the color's own page.
8. **Painter analysis fields** (`data/analysis/artists/*`): `signatureAll`, `avoidedAll`, `within` (roles inside his paintings), `warmFrac`, `Cmean`, `extremePct`. Painter pages show the top few; "how warm is his work", the full signature and his within-painting habits are unshown. That's ledger #5, "Data is built, UI isn't."
9. **Word and archive timing:** `ng.adj.rise` (when the color word took off), `ar.fs.ly` (the latest painting in the archive that holds it), and the per-century curves `ar.curp` / `ar.curl`.
10. **Percentiles stored as `pL` / `pC` are recomputed at runtime** instead of being read: harmless, but the field can go.

## 4. Coverage holes
11. **411 of the 984 words the app teaches have no article.** Wave 2's queue (articles-batches-2.json) covers 214 of them; 197 stay uncovered. Learn-layer words should come first in the queue.
12. **131 color pages have no article and no painting that holds the color** (Baby Green, Barbie Pink, Bright Aqua…). Nearest stories now gives them something; Barbie Pink deserves its own story (iconic design colors, PLAN tier 5).
13. **658 of 951 articles name no painting, gem, flower, look or film in their text.** Their lead picture depends on auto-figures (the build session's lead-picture task should report how many end up with none).
14. **Only 101 of 2,037 colors have a crawlable page** (`c/<slug>/`); the 1,936 others are invisible to search. PLAN's "a page for every color" goal is mostly unmet on the web.

## 5. Possibly lost doors (needs a look; may be superseded on purpose)
15. 38 top-level functions nothing calls (209 lines). The big ones: `poemsPanel` (69 lines, poems.js:109), `colorBrowser`, `dlTodayRow` / `dlWireToday` (challenge.js), `passagesSection`, `filmsSection`, `honeyPreview`, `honeyPath`. Some were cut on purpose (IMPROVE decision 4); confirm, then delete or restore.
16. `S.profileAsked` is written and never read.

## 6. The join: your top asks are "almosts"
| Your ask (ledger rank) | What blocks it, measured |
|---|---|
| #4 Rich page for every color, never empty | items 1, 6, 7, 11, 12 |
| #5 Painter and painting analysis in the app | items 2 (`paintingLesson`, `lmYouAndPainter`, `painterPage`), 6, 8 |
| #17 Photo missions ("spotted teal today") | item 3 |
| #19 Color mind profile and coach | items 4, 5 |

## 7. Make it permanent (the ratchet)
- Add the atlas's "fetched file exists" check and undef_scan's WARN count to `tools/check.js` / smoke. Neither may grow, so a rebuild can never silently empty a page again.
- Rerun `node design/audit-graph/atlas.js` after each merge wave. The numbers should only go down.

## Recommendation
Hand sections 1–3 to the build session now (one lane each: restore + gate; the five silent features; the three loops; role paintings + Werner on the color page). Run invention agents (PLAN stage 3) only after that ships, aimed at what's still weakest.
