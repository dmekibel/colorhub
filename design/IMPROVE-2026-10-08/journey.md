# The whole journey: three people, five rooms, one loop (2026-10-08)

Reviewer 5 of 5. Read-only on code. Method: I drove the real app in headless Chrome (Playwright on system Chrome) at **440×956** (David's iPhone 16 Pro Max, touch + mobile UA) and checked the tight cases at 375×812. I ran three people through it:
- **Mira, brand new:** empty storage, welcome, the real placement (15 answers, 1 in 4 wrong on purpose), then wherever the app sends her.
- **David, returning daily:** the saved state from Mira's run, booted cold.
- **Theo, a curious art lover:** arriving on `#/museum/art`, a painting, a color page and Learn it.

I also measured a throttled cold start, listed every 4xx, and ran `tools/smoke.sh` (74/74 pass). Screenshots are in the session scratchpad. Nothing here repeats the CRITIQUE or AUDIT fixes that already shipped.

David's framing is "we're dancing around the perfect mechanic." I agree, and the evidence is concrete. The app has **eight ways to learn a color, seven things called "today", three places for your favorites and two names for the map.** Each was a good idea on the day it was built. Together they make a user choose before they can play. The core-loop section says what everything should orbit. The skeptic section tries to break that loop.

---

## What each person actually lives through

### Mira (brand new, first 5 minutes)
1. **Welcome** (`js/learn.js:6`). It's a paint-chip wall of the 112 basics and in-betweens, under the four-strip fan logo. The copy says "Learn a few at a time…" It's handsome, but it isn't the app: the honeycomb, which *is* the app, never appears. The logo is the paint-chip family David rejected (X25).
2. **"Find my level · 60 sec" → a how-to screen → placement.** This is good: four same-family swatches with real stakes, and it's quick. The ceiling is low, though. It only tests the first 101-word tiers (`sampleTier(2|3)`, `js/pickit.js:235`), so a designer who knows 400 words places exactly where a curious amateur does.
3. **Result: "The designer's vocabulary".** The copy is honest and good, but the button takes her to **the Learn room, not the map** (`js/learn.js:303-304`). The comment there says "Straight to the honeycomb home", and the code does `go("learn")`, which draws the Learn sheet full-screen over it. Her first sight of the app's soul needs a tap on the corner, then a row labeled "Explore".
4. **The Learn room on day one** (screens `room-today-*`) holds 14 things:
   - Begin "Blues";
   - Today's painting and Today's color;
   - Practice ("Make your own deck");
   - the path: The in-betweens, then the designer's units "Blues", "Reds", "Oranges & yellows", then "and 3 more units **to 101 words**";
   - six stage rows (150 to 984 words);
   - "Every learnable color · about 1,225";
   - a 655-square collection grid that is 94% empty dark squares;
   - "Spectrum →" and "Settings & more".

   **The first unit is a color family ("Blues"),** which is the family-by-family lesson David called boring (X22). The Journey that replaces it (ledger L3/L4) still isn't built.
5. **First visit to Train → a questionnaire wall:** "Before you train · How do you see, and what do you make?" (`js/core.js:558`). It wants two decisions before she has touched a game, and its footnote points to "the ⋯ menu" (`js/learn.js:44`), which no longer exists (it's You → Settings now).
6. **Train after that:**
   - 16 game tiles, 12 of them labeled "New", then today's painting, a row of nine "–" dashes ("Your eye"), 12 drills and 3 checks: **31 entries** (smoke counts 31);
   - "New" on almost everything means nothing;
   - "Odd one out · Start here" is the only signpost.

**What Mira understands at minute 5:** "It's a quiz app about color names, with a lot of games." She doesn't understand the map, that a tap on any color opens its whole world, or that the museum exists.

### David (returning daily)
1. **Cold boot lands on the honeycomb** (`#/home`). That's right, and it's beautiful: big names in the middle, the fisheye, a calm drift.
2. **Five floating controls.** Rooms bottom-left; then Study the map (hexagon), Study (cards), View (sliders) and Pick favorites (heart). Two of them both say "study" and lead to different engines.
3. **Rooms menu.** Learn ("9 new names"), Train ("Odd one out"), Museum ("van Eyck, The Arnolfini Portrait"), Studio ("Make a palette from a photo"), You. The subtitles are live and good. **But the Museum's painting of the day (Arnolfini) is not the Learn room's "Today's painting" (Vermeer's Milkmaid).**
4. **"Today" is fractured: seven of them.**

   | Where | What it calls "today" | Source |
   |---|---|---|
   | Learn room | Today's color (Name it in six) | `dnTarget()`, `js/colordle.js:33`, from ~1,000 core names |
   | Museum, For you | "Today, Sky blue" | `dailyColor()`, `js/graph.js:171`, from **`ALL` (the 101)** |
   | Learn room and Train | Today's painting (Vermeer) | `dpLoad()`, `js/challenge.js:46` |
   | Museum, Art cover and Rooms menu | "Today, The Arnolfini Portrait, in black" | `js/explore.js:198` |
   | Train | Today's gradient | `hgDaily` |
   | Museum, Ideas | "Today, Does red make you win?" | `js/explore.js:221` |
   | Museum, World | "Today, Cloud Dancer · 2026" | `js/explore.js:224` |

   Two different "colors of the day" on one day is a bug of meaning, not code. The Museum's comes from the 101, which also breaks the never-the-101 spirit and repeats every ~3 months.
5. **Daily review lives inside "Begin"** (the Learn room). Nothing on the map tells him he has due cards. The map is the floor and the place he opens to, yet it carries no "today" at all.
6. **You page:** "0 colors yours", 42 learning, a Your-week row (good: "Color on 1 of the last 7 days" is the kept-week idea), "You mix these up" (excellent: real pairs, measured direction words), What you love, Your eye, Settings.
   - "Your colors" and "Find your color" also live in Studio → Yours **and** behind the heart on the map.
   - "Settings & more" also lives at the bottom of the Learn room.

### Theo (curious art lover)
1. **`#/museum/art`.** It opens on a search row (dial, Type, Photo, Camera), nine facet chips, "23,781 paintings", "Rooms · ways in" (seven curated collections: excellent, but **named "Rooms" inside a room**), then Grid/River/Painters/Wall. **The default grid is sorted by Date and starts "Before 1200":** an ostracon, a funerary papyrus, then decade buckets "1210s · 2", "1220s · 5", each with "Show N more / Only 1220s". The first thing an art lover meets is the database's oldest rows, not its best ones.
2. **A painting** (`#/gallery/12`, van Dyck, *Helena Tromper Du Bois*): "Computed palette · 6 colors, by area" is **Dark black 36%, Between mahogany and umber 31%, Between black and umber 22%**, then three 2–4% chips.
   - This is the exact "almost a good idea" David named. Area-weighted palettes of varnished Old Masters are mud. The interesting colors (the lace, the flesh, the one accent) are the 2% chips, and they show last.
   - "Between mahogany and umber" isn't a name.
   - The "Accents, hidden, focal, glue" reading, which *is* the interesting one, is folded away far down the page.
   - "More like this" then matches dark paintings with dark paintings ("Near black to Smoky Black", "Café Noir to Bistre", in mixed casing).
3. **A color page** (Grey, Teal).
   - The hero is gorgeous.
   - The lead stat card is "the paintings · **1320**" (a year, unlabeled, with the count unformatted next to it), saying the color was "first seen in our archive 592 years before the name's earliest record… not proof of the pigment." That finding is ranked first (`js/richpage.js:92`, score 90) on every color, and it cancels itself in its own sentence. It's the weakest fact on the page, in the strongest spot.
   - Teal shows three counts that disagree on one screen: "1520" (a year), "11 paintings hold a color close to it", and "0.05%… (11 paintings…; the within-painting lens finds it in 1)".
   - "Its twins: aquamarine, garnet, mad max: fury road": garnet as teal's twin reads as a bug, and the film title is lowercase.
   - Grey's article shows "A draft: not yet fact-checked." to users (`js/article.js:323`).
4. **"Learn it · 2 min" on the color page opens a configuration sheet, not a lesson** (`js/explore.js:662` → `prQuick` → `lsOpen`, `js/practice.js:1549`). It has two sliders (How many: 10, How close), Look or Study, a "type names near the end" checkbox and four "Just one way" chips. The set is Teal plus nine look-alikes, including Skobeloff Green, Capri Blue and Jouvence Blue, in Title Case beside sentence-case "Teal". The button promised one tap and two minutes. It delivers a form, then a ten-color session.

---

## (A) Top annoyances (ranked by how often they bite)

1. **"Learn it" is a form, not a lesson.** It's the most-tapped primary on the most-visited page, and it costs five decisions. (`js/practice.js:1549`, `js/learnset.js:46`)
2. **Two colors of the day, two paintings of the day, seven "todays".** (Table above.)
3. **Placement lands on the Learn list, not the map** (`js/learn.js:304`), so the signature is hidden on day one.
4. **The Train questionnaire wall** before the first game (`js/core.js:558`), with stale copy (`js/learn.js:44`).
5. **Every lead finding on a color page is "first seen N years before its record… not proof"** (`js/richpage.js:92`). It's the same self-cancelling sentence on every page, so it reads as boilerplate after the second visit.
6. **The painting palette leads with area,** so Old Masters read as three browns (A2 "many readings" exists but is buried).
7. **Museum Art defaults to Date ascending,** so you meet ostraca first.
8. **"New" badges on 24 of 31 Train entries.** A badge on everything is no badge.
9. **Every launch revalidates ~140 files.**
   - `sw.js` is network-first with `cache: "no-cache"` even for `?v=`-stamped files, which are immutable by construction.
   - index.html loads **90 scripts and 43 stylesheets synchronously** (≈2.5 MB JS + 0.5 MB CSS uncompressed).
   - At 4× CPU and ~1.5 MB/s it measured 3.0 s to DOMContentLoaded and 3.8 s to the honeycomb, and that's every day, online, even when nothing changed.
   - A render-blocking Google Fonts stylesheet sits in `<head>` (index.html:29). On a bad cell connection the whole app waits on a third-party host.
10. **Mixed casing in names** inside learning sets and painting comparisons ("Capri Blue", "Smoky Black", "Café Noir" next to "Teal", "Near black"). CRITIQUE flagged it on hubs. It's app-wide.
11. **Copy that still says "percent"** for ΔE: Train's footer (`js/rooms2.js:174`) and "2.1% different" on painting matches. soul-delight #17 already argued for "steps". Still open.
12. **Every color page without an article** fires a 404 probe (`data/articles/teal.json`, `artists/bios/<slug>.json`). That's harmless, but it's one wasted round trip per page and noise in any error log. A single `articles/index.json` of slugs would remove it.

## (B) Confusions (things a user can't predict)

- **What's the map called?** Inside the rooms menu and the trail it's **"Explore"** (`NAV_MAP`, `js/core.js:387`). The Museum was called Explore until today, and the code, comments and `#/explore` addresses still say so. The Museum's own Art lens has a section called **"Rooms"**, inside a *room*. Its search facet is called **"Museum"**, inside the *Museum*.
- **What's the difference between Study, Study the map, Practice, Learn it, Learn a set, Begin and the review?**

  | Way in | Engine | Where it lives |
  |---|---|---|
  | Path unit (Begin) | meet + swipe deck, `js/learn.js` | Learn room |
  | Daily review | deck + Pick it / Say it / Make it | inside Begin |
  | Learn it | meet → deck → pick, `js/learnit.js` | now replaced by the Learn a set sheet on color pages |
  | Learn a set | Look + mixed Study, `js/learnset.js` | the Study corner, color pages |
  | Practice | own deck, 6+ methods, `js/practice.js` | Learn room row "Make your own deck", the cards corner |
  | Study the map | five modes, 7 levels, `js/mapstudy.js` | hexagon corner, first Train tile |
  | Name it in six | `js/colordle.js` | Learn room, Train |
  | Placement | `js/pickit.js` | You → Retake |

  Eight doors, five engines, three progress rules (Practice's `prApply`, mapstudy's copy of it, the deck's own). A user can't say which one "counts".
- **Which progress number is real?** Home "42 placed", Learn "0 of about 655 · Fluent", You "0 colors yours · 42 learning", Study the map "N on your map" / "N found", Learn a set "0 of 10 mastered", Train "Your eye – – –". Six counters for one question ("how many colors do I know?").
- **What does the heart do vs Keep vs Save vs Saved?** Heart = Your colors (favs). The painting page has "Keep". The Museum has a "Saved" lens. Studio's "Yours" holds photos and palettes.
- **Where are my settings?** You → Settings, Learn → "Settings & more", and the questionnaire's "⋯ menu" (gone).
- **"Today's painting · Five ways to look"** (Learn/Train), **"A guided look · 1 of 3"** (the painting page) and **"Squint"** (Train and the painting hero) are three looking-at-a-painting modes that don't share a name or a progression.

## (C) What to cut or merge

| Merge or cut | Into | Why |
|---|---|---|
| Learn it, Learn a set, Practice's "Make your own deck", the Study corner | **One verb, "Learn", with one engine** (Learn a set's mixed session, which is the best one). The tap starts immediately with smart defaults. The sheet's sliders move behind a small "Adjust" link on the session's first screen. | One way in, decisions optional (fixes A1). |
| Study the map's 5 modes as a separate room-level destination | Keep the engine; make it **the map's own "play" state** (the hexagon corner), and make "Find it" the *test* step of the core loop (below). Drop it from Train's first tile (Train should be the eye, not names). | Names belong to the map and Learn; Train is the eye gym (CLAUDE.md: thinky things live in the gym, names in the loop). |
| Seven todays | **One Today**, a single seeded object per day: one color (from the ~1,000 core list, weighted to colors with a painting and an article), one painting that *contains* that color, and one game board built from both. Museum, Learn, Train and the rooms menu all quote the same object. `dailyColor()` and the Arnolfini pick become views of it. | One ritual. Fixes the two-colors-of-the-day bug. |
| Learn room's six stage rows + the 655-square collection grid + "Spectrum →" | **One "your map" line** with a one-tap "show me on the map" (the existing Learned/Learning view filter). The stages are a single progress bar with the next stop named. | The map already *is* the collection. The grid of dark squares is a worse honeycomb. |
| "Settings & more" in Learn | Delete. You → Settings is the one place. | A duplicate. |
| Train "New" labels | Show "New" only on games that unlocked *since your last visit* (max 2). | A badge on everything means nothing. |
| The Train questionnaire wall | Ask the two questions **inline after the first game** ("Want drills tuned to how you see? Two taps"), or never unless the user opens Settings. | No wall before play. |
| Three looking modes for paintings | One **"Look"** sequence on every painting (guided look → squint → find the color), with today's painting as its daily instance. | One name, one progression. |
| "Rooms · ways in" in Art | Rename **"Collections"**. Rename the facet "Museum" to **"Collection"** or "Held at". | No room inside a room. |
| The map's name "Explore" | **"Map"** everywhere (rooms menu, trail, title, `#/home` → `#/map`, keeping the alias). | It's what everyone calls it, and it ends the Explore/Museum ghost. |

## (D) Fun: what's there, and what's missing

What's genuinely fun now:
- placement (real stakes, fast);
- Odd one out (David's sister);
- the honeycomb itself (pan, fisheye, the grow);
- "You mix these up" (it *knows* you);
- Name it in six;
- the trail (long-press ‹).

What kills the fun:
- **choosing before playing** (the Learn sheet, the questionnaire, 31 Train entries);
- **no stakes on the map:** you can pan it forever and nothing asks anything of you;
- **no payoff moment** that is about *you and a color* (soul-delight's provenance stamp is still unbuilt);
- **the area-palette:** "Dark black 36%" is the opposite of delight.

Small, high-fun moves that fit the existing systems:
- **Map dares.** While panning, a bubble you've learned occasionally hides its label for one beat with a quiet "?" ring. Tap and name it from four for a recall credit. It's opt-in from View, at most 3 a day, and the ring follows the rules (a study ring is allowed in play, per `js/mapstudy.js:22`). This is "learning from the map" without leaving it.
- **"Find it in this painting".** On any painting, name a color and tap where it lives; the existing where-it-lives mask (L26) checks it. It turns the painting page from a report into a game, and it's the honest answer to "tapping a painting to see its colors".
- **The day's three-step board** (see the core loop): one color, met in a painting, found on the map. It takes three minutes, the result is shareable as the three real colors, not squares.
- **A "settled" moment.** When a mix-up pair from "You mix these up" is finally told apart twice on separate days, the pair's two chips slide apart with one haptic and a line: "Teal and bottle green: settled." It's the most honest "level up" the data supports.

## (E) Connective tissue: the threads that should run through everything

1. **One color followed everywhere.** Whatever color you're "on" (today's, the one you just learned, the one you tapped last) should glow quietly in every room:
   - Museum filters to it in one tap;
   - Train's next board is built around its family;
   - Studio's camera says "you're hunting *teal* today";
   - the map centers on it when you return.

   One global `S.focus = {hex, name, since, why}`, set by Today, Learn and color pages; every room reads it.
2. **One Learner Model, one progress rule.** `learner.js` exists. Make it the only writer: Practice, mapstudy, deck, Learn a set and pickit all call one `lmAnswer()`. Then one number ("colors yours") and one secondary ("in progress") show everywhere, with the same words.
3. **Confusions as the app's spine.**
   - "You mix these up" is the single most personal thing in the app, and it lives only on the You page.
   - It should seed: the next Learn session (the pair as twins), Train's next Odd one out family, the color page ("You've mixed it up with bottle green · Duel the two": already there on Teal, good), Museum (a painting where both sit side by side), and the map (a dare on the pair).
4. **Paintings as the place colors live.**
   - Every learned color should be shown *in a painting* at least once (the reveal step).
   - Every painting should offer its colors *to learn* (a "Learn this painting's colors" button that seeds the Learn engine with the painting's named colors, distinctive-first).
5. **The map as the receipt.** After every session, the colors fly to the map (`flyToMap`, `js/polish.js`, already built). Make sure *every* engine calls it, not just Learn it, so the map is visibly where progress lands.

---

## The core loop (the mechanic everything should orbit)

**Every thing in the world is a handful of named colors. ColorHub's loop is: *Meet → Name → Prove → Find*. You meet colors inside a thing (a painting, a photo, today's pick, the map), name them, prove you know them a day later, and find them again in a new thing.**

```
        ┌──────────── a THING ────────────┐
        │ painting · photo · today · map  │
        │ article · look · flower · film  │
        └───────────────┬─────────────────┘
                        │ its colors, distinctive-first
                        ▼
   MEET  ─────►  NAME  ─────►  PROVE (a day later)  ─────►  FIND
 (see it in     (Learn: the    (the review: recall     (spot it in a NEW
  context, one   one engine,    before reveal; owns     thing: another
  tap = its      ~2 min,        it honestly; the map    painting, your
  page)          look-alikes)   lights)                 camera, the map)
                        ▲                                       │
                        └──────── the new thing is the next ────┘
                                  thing to Meet
```

**Why this loop and not "flashcards" or "the honeycomb":**
- It's the soul sentence ("everything is a color dataset → teach people to see") as a verb sequence.
- It uses every asset we have. Things come from 23,781 paintings, looks, flowers, gems, films and photos. Naming comes from the 1,000-word Learn layer. Proof is the honest delayed recall rule. Finding uses the camera, the color index (L26) and the map.
- **FIND closes the loop into the real world,** which is the one-sentence test ("does it make someone see more color in the real world?"). Today nothing asks you to find anything except the opt-in Study the map.

**How each room plugs in (one job each):**

| Room | Its job in the loop | What changes |
|---|---|---|
| **Map** (the floor) | Where everything lands and where you start. *Prove* lives here: due reviews show as "N to recall" on the map's own corner, and a dare can happen while panning. | Rename to Map. Today's color glows at the center on open. A due-count corner replaces the two "study" corners. |
| **Learn** | *Name.* One engine, one tap. Today's lesson = today's color + its look-alikes + whatever the Learner Model says you confuse. | Path units become "your next 6–10 words", chosen across families (the Journey), never "Blues". The stage list collapses to one bar. |
| **Museum** | *Meet* and *Find.* Every painting offers "Find the colors you know" (the find game) and "Learn this painting's colors". | Default Art view = Collections + today's painting, not Date ascending. Painting palette leads with distinctive colors. |
| **Train** | Sharpens the eye that *Find* depends on. Each game feeds the eye profile, and its boards are seeded from your focus color and confusions. | Order: today's board, your weak-family game, then the rest. No wall, fewer "New". |
| **Studio** | *Find* in your life: the camera and photos. "Name it before the camera does" (GP1) is the find step for the real world. | The camera opens with today's color as a hunt ("find something teal"). A found color counts as a Find (life list). |
| **You** | The record of the loop: yours, settled pairs, finds, kept weeks. | Merge in "Your colors" (one home for favorites). Progress = the one Learner Model number. |

**One daily instance of the loop (the Today object),** about 3 minutes:
1. **Meet:** today's painting opens with today's color highlighted in it (the where-it-lives mask).
2. **Name:** a 60-second Learn of that color and its two closest neighbors.
3. **Prove:** yesterday's colors come back (recall before reveal).
4. **Find:** "Find today's color on the map" (one Study-the-map *find* round). Optionally "point the camera at something like it today."

The share is a postcard of the real colors and the painting crop (soul-delight #9). Every "Today" tile in every room points to this one object.

**What to change so every feature reinforces the loop:**
- Every color chip, anywhere, already opens its page (a rule kept). Add one consistent secondary on the page, **"Learn it"** (one tap, starts immediately), and one on every thing (painting, look, photo, flower), **"Learn its colors"**.
- Every engine ends with `flyToMap()`, so the map visibly receives what you learned.
- Every game board in Train can take a seed (a color, a pair, a painting). The default seed is your focus color, so games stop being random.
- Remove anything that can't answer "which step of the loop is this?". Candidates: the Learn room's 655-square grid, the duplicate settings, the parallel daily colors, Train's "New" wall.

---

## Skeptic (a pre-mortem: "a month from now, users stop opening the app because…")

| # | The failure | Why it would happen here | Design against it |
|---|---|---|---|
| 1 | "…every day is the same three minutes." | A fixed Meet-Name-Prove-Find ritual gets rote, like any daily puzzle after week 3. | Rotate the *thing* type by weekday (painting, film still, flower, look, your own photo Sunday) and let Prove mix in old mix-ups. The ritual's shape stays; the content and the difficulty change. One "skip to the game" tap for people who only want the board. |
| 2 | "…I ran out of colors I care about." | After ~200 words the core list gets obscure (Jouvence Blue, Skobeloff). | Learn sets weighted by the Learner Model's interests and by "you met this in a painting you opened". After stage 4, words come from *your* things (your photos, saved paintings), not the global order. |
| 3 | "…FIND is fake, because I can't find teal on my commute." | Real-world finds depend on luck and lighting; the camera lies about color. | FIND accepts a *near* find (same family, within a few steps), says "as your camera sees it", and always has an in-app fallback (find it on the map, or in a painting). Never a streak on finds. |
| 4 | "…the map is gorgeous but I never do anything there." | Panning is passive. The map is the floor, but the loop's verbs live in rooms. | Due recalls and dares live *on* the map. Opening the app centers today's color. A finished session flies colors back onto it. The map changes because of you (as a view; no dimming, per X7). |
| 5 | "…too many places, I don't know where I am." | Five rooms, plus the map, plus Museum lenses, plus eight learning doors. | One Today object. One Learn engine. Map/Learn/Museum/Train/Studio/You, each with one job. Every "where am I" answered by the title and the trail. Measure it: a fresh user should reach the map, learn a color and see it in a painting within 3 minutes without help. |
| 6 | "…the numbers don't mean anything." | Six progress counters, ΔE as "percent", "first seen 592 years before…". | One honest number (yours), one unit (steps), and findings ranked by how *surprising and certain* they are, not by availability. Self-cancelling findings drop below the fold. |
| 7 | "…it's slow to open on the train." | ~140 revalidations per launch, blocking fonts. | Cache-first for `?v=` assets, fonts self-hosted or non-blocking, a precache of the first screen's scripts. Then launch is instant offline and online. |
| 8 | "…I lost my progress." | localStorage only. iOS evicts storage for sites not added to the Home Screen after 7 days without use (Safari ITP). | The Home Screen nudge already exists. Tie the backup reminder to the first time "yours" reaches 10, and make the backup a one-tap share-sheet file. Accounts later. |
| 9 | "…Learn it feels like homework." | Ten colors and a form. | Default to 4 colors (the color + 3 look-alikes), start instantly, 90 seconds. "More like this" at the end if they want ten. |
| 10 | The core loop itself is wrong: "people want to browse, not be taught." | Theo never wants a lesson. | The loop is *available*, never forced. The Museum stays a pure browse. Loop actions are one quiet secondary per thing ("Find the colors you know"). Theo's loop is Meet → Find with Name optional, and Find (the painting game) is fun with zero learned words, since it can show the name and ask you to find it. |

Feature-level skepticism, the "almost good ideas":
- **Tapping a painting to see its colors** is a report, not an experience. The fix is the find game, plus distinctive-first palettes, plus the guided look moved up.
- **The 655-square collection grid** shows emptiness, not progress. Use the map's view filter instead.
- **Study the map's five modes** risk being the eighth learning door. Keep "find" and "name" as the map's play state and fold "path", "hood" and "light up" in as variations that unlock.
- **The Learn a set sheet** is a power tool shown to everyone. Keep it, one link deep.
- **"Your eye" with nine dashes** is an empty state that looks broken. Show one sentence and one button ("Play one Odd one out to see your eye") until it has data.

---

## (F) Top 7 recommendations (ranked by impact ÷ effort)

### 1. One Today (impact: very high · effort: S–M)
Make one seeded daily object, `todayPick(k)`, in a small new `js/today.js`, returning `{ color, painting, board }`:
- **color:** from the ~1,000 core names, weighted toward names with an article or a painting where the color covers ≥ 2% and is distinctive;
- **painting:** the archive painting where that color is most distinctive (from the L26 color index);
- **board:** the daily challenge seeded from both.

`dailyColor()` (`js/graph.js:171`), `dnTarget()` (`js/colordle.js:33`), `dpLoad()` and the Museum covers (`js/explore.js:188-224`) all read it, so Learn, Train, Museum, the rooms menu and the map show the *same* color and painting. The Learn room's "Today" pair becomes one card ("Today · Teal, in Vermeer's *View of Delft*"). It opens the four-step ritual: meet the color in the painting (highlighted), a 60-second Learn, yesterday's recall, then find it on the map. The share is the real colors plus the painting crop. Kill the per-lens "Today" lines in Ideas and World, or derive them from the same color.

### 2. "Learn it" means learn it now (impact: very high · effort: S)
On every color page, name page, chip sheet and the map's study corner, "Learn it" starts the Learn a set **Study** session immediately with defaults. The defaults are the color plus its 3 closest same-family names from the Learn layer (not the archive), "Close", typing on only after the second round, and about 90 seconds. Change `js/explore.js:662` and `js/names.js:157` to call a new `lsQuick(seed)` that skips `lsOpen`'s sheet. The sheet stays reachable from a quiet "Adjust" link on the session's first screen and from Practice. Fix name casing in sets (sentence case from the Learn layer). The session ends with `flyToMap()` and back to the page. This is a one-line routing change, plus a defaults function, plus the casing pass.

### 3. Land on the map, and put "today" on the map (impact: high · effort: S)
- Placement's "Start learning" goes to the map, with a one-time guided first tap ("Tap any color", then its page, then "Learn it"). In `js/learn.js:304` use `hmHome()` plus a first-run flag.
- Replace the two study corners (hexagon "Study the map" and cards "Study") with **one corner showing the due count**. Its first tap starts due reviews; if nothing's due, it starts today's Learn.
- On open, the map glides to today's color. The welcome screen shows a slowly drifting honeycomb instead of the chip wall; retire the fan-deck logo for the bubble (soul-delight #15).
- Rename the map **"Map"** (`NAV_MAP`, `js/core.js:387`), and rename "Rooms · ways in" in Art to "Collections".

### 4. Paintings that play, not report (impact: high · effort: M)
On every painting page (`js/gallery.js` and artwiki), the palette defaults to **distinctive-first**: rank by chroma × rarity-in-this-painter × contrast with the painting's mean, then fill by area. Show "by area" as the second tab. Never name a chip "Between X and Y" as its primary; use the nearest Learn-layer name, with "between X and Y" as the subline. Move "Accents, hidden, focal" above the area bars. Add **"Find the colors"**: name one of the painting's distinctive colors, and the user taps where it lives (check against the L26 per-painting color index, with tolerance); three rounds; the found colors fly to the map and join Learn as "met in this painting". Also add "Learn this painting's colors" (seeds #2). "More like this" defaults to "Accents", not overall palette, so dark paintings stop matching dark paintings.

### 5. One Learner Model writer, one number, one unit (impact: high · effort: M)
- Route every answer from the deck, pickit, Learn a set, Practice, Study the map and Colordle through `learnerLog`/`lmAnswer` with one scheduling policy (`prApply` becomes the only one). Delete mapstudy's copy.
- Everywhere progress shows (map corner, Learn, You, the rooms menu), use the same two numbers and words: "**N yours**" and "**M on the way**".
- Replace "percent" with **steps** (ΔE00 1.0) in `pctFmt`/`pctDiff` (core.js), Train's footer (`js/rooms2.js:174`) and painting matches.
- Collapse the Learn room's six stage rows and the 655-square grid into one bar plus "See them on the map". Remove "and N more units to 101 words" (`js/learnmore.js:485`); stages are named by size ("150 words"), never by the 101.

### 6. Launch speed: cache-first, non-blocking (impact: high for daily return · effort: S)
- In `sw.js`, serve any same-origin request whose URL has `?v=` **cache-first** (it's immutable by construction), and keep network-first only for index.html and un-versioned data.
- Precache the first screen's scripts and styles on install.
- Make the Google Fonts stylesheet non-blocking (`media="print" onload`) or self-host the three families.
- Then start the bundling question (90 scripts): even a dumb concatenation at deploy time into 3 files, `core`, `home` and `rest` (with `rest` deferred), cuts ~130 requests.

Measured baseline to beat: 3.8 s to the honeycomb at 4× CPU / 1.5 MB/s, about 140 requests every launch.

### 7. Color pages lead with their best true thing (impact: medium–high · effort: S)
In `js/richpage.js:90-96`, re-rank the stat cards:
- "first seen N years before its record" drops to the bottom (or appears only when N < 100 and the match is exact), since it negates itself;
- lead with the strongest *certain* fact: first recorded date, peak decade with lift, the painter most devoted to it, its most-confused neighbor for *you*;
- years get a label ("first seen · 1520"), counts get formatting ("1,320");
- one owner for the paintings count, so Teal can't say 1520, 11 and 1 on one screen;
- fix the twins pass so a gem only counts when its *variety's* color is near (garnet is not teal), and title-case films;
- hide "A draft: not yet fact-checked" from the reader view: either ship only checked articles or show the computed field notes alone until the article passes.

---

### Also worth a ticket (small, specific)
- Train's questionnaire: remove the wall (`js/core.js:558`) and fix "⋯ menu" (`js/learn.js:44`).
- Train "New" only for games new since your last visit. Today's three Train dailies collapse into the one Today board (#1).
- Museum Art's default sort: Collections first, then a curated "highlights" wall (paintings with articles, painter pages or high distinctiveness), with Date as an option, not the default.
- Remove "Settings & more" from the Learn room; one Settings, on You.
- "Your eye" empty state: one sentence and one button, not nine dashes.
- `data/articles/index.json` to skip 404 probes for missing articles and bios.
- Placement: an optional "keep going" ceiling test past the 101 for people who ace tier 3 (sample from stages 150–655), so experts start where they are.
