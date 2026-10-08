# Improve: Home, the map, rooms, navigation, search (2026-10-08)

Reviewer 3 of 5. Area: the honeycomb Home (`js/honey.js`, `js/home.js`), the rooms stem and shell (`js/core.js`, `css/menus2.css`), the back trail and addresses (`js/trail.js`, `js/router.js`), search, the View sheet (Show / Look), and favorites on the map.

**Method.**
- I rendered every state headless through `tools/_qa/frame.html` at 440x956 (David's 16 Pro Max) and 375x812:
  - Home;
  - the stem on Home and in a room;
  - View → Show and View → Look;
  - search, empty and with "dusty pink";
  - stage 9 zoomed out, with and without family names;
  - Study the map;
  - the Study corner (Learn a set);
  - favorites pick mode;
  - a color page;
  - the trail sheet;
  - Train with its stem.
- Then I read each code path behind the taps.
- Screenshots are in the session scratchpad. None were committed.
- Each feature is judged against the four goals (learn words, train the eye, educate, archive) with David's lenses: UX, function, form, dynamics, educational value, simplicity. Each also gets a skeptic's pre-mortem.

---

## 0. The almost-perfect mechanics in this area, and what makes each one click

These are the five things here that are *nearly* great. Each is one missing link from being iconic.

1. **"Show me this thing's colors on the map" (constellations).**
   - Today a painting, painter, decade, article or Learn set can light up on Home. It looks wonderful.
   - Then it's a dead end:
     - the pill can only clear it (`honey.js:1372`);
     - the Study corner ignores it (`home.js:474` studies the view's `items`, not the lit set);
     - Home wipes the trail (`trail.js:79`), so there's no way back to the painting you came from.
   - **What makes it click:** the lit set becomes the *subject* of Home until you dismiss it. It gets a title bar with ‹ back to its source, plus "Learn these" and "Find them" (map study on exactly those colors).
   - This is the missing piece of "tapping a painting to see its colors". Seeing them is half the mechanic. Doing something with them, where they live, is the other half.
2. **The map as a place you learn.**
   - Map study (find it, name it, neighborhood, path, light up 5) is the best learning idea in the area.
   - But it's a separate full-screen mode behind an unlabeled hexagon. It uses its own level ladder (10/25/50/100/250/614/all, `mapstudy.js:28`), and its first level is the basics (Red, Blue, Black), which CLAUDE.md says adults are never taught.
   - **What makes it click:** it runs on *the map you're already looking at* (your stage, your lit set, the center's neighborhood), entered as a verb, not a destination.
3. **Search that travels.**
   - The resolver (`l18Resolve`) is clever: hex, "dusty pink", "between teal and navy", decades, painters.
   - But typing *filters the honeycomb* (`home.js:430-432`), so "dusty pink" leaves one lonely bubble on black. You have to know to press Return. There's no results list, no painting titles, no recents, and the entry point is hidden (pull from the top 100 px, or View → magnifier).
   - **What makes it click:** a results list under the field. Tap a row and the map flies there, with the context kept.
4. **Stages as "how much of color you see".**
   - The 9 stages are a good idea, but they live as a 3x3 grid of number boxes inside View.
   - Home doesn't say which stage you're on (the title is hidden, `css/home.css:17`), and your stage isn't tied to your Journey.
   - Two other ladders exist (map study's, Learn a set's "Stage 3" chip), and "every name" has three counts: 2,020 (View), ~2,700 (map study) and 7,051 (the ledger).
   - **What makes it click:** one ladder everywhere, defaulting to *your* stage, with the edge of what you know visible as a view.
5. **The trail.**
   - One step back, long-press for a sheet with pictures. It's well built.
   - But it's invisible until a one-time toast. It's wiped whenever you touch the map. The pull-down goes to the *origin*, not one step. And rows can fall back to "A page you opened · Page" with a blank thumb.
   - **What makes it click:** the map remembers where you came from ("‹ Navy" for the session), and the trail becomes "Recent" in search.

---

## A. Annoyances and friction (concrete)

| # | What | Where | Repro |
|---|---|---|---|
| A1 | **Five round buttons on Home**: Rooms (left), then Map study (hexagon), Study (cards), View (sliders) and Favorites (heart, stacked above). On 375 they cover the bottom row of bubbles (Black, Midnight blue). David asked for "one quiet menu button" (D7) and rejected "3 top buttons" (X11). | `home.js:221-225`, `css/menus2.css:32-34`, `css/practice.css:357` (a second, conflicting `right:84px` for the same corner) | `#shot=home` at 375x812 |
| A2 | **Every open waits 220 ms** for a possible double-tap before the page starts to grow. On the most-used gesture in the app it feels like lag. | `honey.js:1210` (`far ? 0 : 220`) | tap the center bubble |
| A3 | **Search filters instead of answering.** "dusty pink" leaves one bubble and a "Fly to" pill. A partial word ("sag") reflows the whole honeycomb on every keystroke. Return/Go is required to travel. | `home.js:420-433` | `#shot=home:find:dusty pink` |
| A4 | **Search is hidden.** It's either a pull-down from the top 100 px (which competes with panning) or View → magnifier (two taps, and the sheet closes first). | `home.js:478-494`, `:397` | |
| A5 | **The painting → map trip is one-way.** `csOnMap` → `hmHome` → `tlNote` resets `XSTACK` because the screen is `.hm` (`trail.js:79`). Home has no ‹, so the painting is gone. The same happens to "On the map" from an article (`article.js:452`) and to Learn a set's big map (`learnset.js:174`). | `trail.js:79`, `colorset.js:37-41` | painting → "On the map" → try to go back |
| A6 | **The Study corner studies the wrong thing.** It seeds from the center bubble, which is Grey on a default Home, so a newcomer's first "Study" is ten greys. With a constellation lit, it still studies the view, not the lit colors. | `home.js:474` | `#shot=home`, tap cards → "Learn *Grey* and its look-alikes" |
| A7 | **Home never says what it's showing.** If you leave the filter on "Learned", the map looks broken-small with no label. | `css/home.css:17` hides `.hm-top`; `hmViewLabel()` is computed but unseen | View → Learned → close |
| A8 | **The first sight is Grey.** The default focus lands the biggest bubble on Grey with Silver and Ash beside it: the dullest possible opener for a color app. | `honey.js` restore/centerFirst; the stage-3 layout splices the greys into the middle | fresh `#shot=home` |
| A9 | **The View sheet is a control panel.** It holds 9 stage boxes in a 3x3 grid, "Name 2,020", 4 filter pills, about 25 collection chips under two stacked headings ("Or a collection" then "Collections"), and on Look: raw slider numbers ("2.70"), "Rate every preset (honeycomb lab) →" and (in Tweak) "Copy settings". The helper notes are tracked mono ("the colors each stage of the path teaches"), which the 10-08 audit removed everywhere else (P0 #4). | `home.js:314-341` | `#shot=home:views`, `home:look` |
| A10 | **"Every name" appears twice** in Show: the "Name 2,020" stage chip (`every-name`) and the "Every name" collection (`csSet("all")`, `colorsets.js:111`). They're the same idea with different ids and possibly different counts. | `home.js:326`, `colorsets.js:111` | |
| A11 | **Pull-down on any page jumps to the trail's *origin*, not one step.** Three pages deep, a pull-down throws away two pages. That isn't what a pull reads as. | `trail.js:124` (`hmPullClose(el, tlToOrigin)`) | |
| A12 | **Long-press is load-bearing and invisible.** Long-press View opens Look (`home.js:469`), long-press ‹ opens the trail (`trail.js:213`), long-press a bubble peeks. None is discoverable after the single toast (`trail.js:99`). | | |
| A13 | **In a room, the stem capsules sit over live tile labels** ("Sq…", "Was it there?") with a weak scrim, so the capsules and the labels collide. | stem scrim in rooms (`menus2.css`) | `#shot=home:floor` + corner |

## B. Things that don't make sense

- **B1. Two hexagons, two meanings.** On inner pages the hexagon (`HOME_GLYPH`, `core.js:390`) means "back to the map". On Home, a hexagon with a dot (`MS_ICON`, `mapstudy.js:42`) means "Study the map". It's the same shape doing opposite jobs.
- **B2. The map is called "Explore"** (`NAV_MAP`, `core.js:387`) in the stem and the trail, and "Back to the map" in aria labels. The room that used to be Explore is "Museum", but its address is still `#/explore` and its note is "The world in color". A new user meets three names for two places.
- **B3. Two "study" corners side by side**, cards and hexagon, plus "Study the map" again as Train's first tile. That's three doors to two things, none labeled.
- **B4. The pencil in View is "Name any color".** A pencil reads as "edit", and that tool has nothing to do with the view.
- **B5. Three ladders:**
  - Home stages: 25/50/100/150/250/400/600/800/1000 (`home.js:21`).
  - Map study: 10/25/50/100/250/614/all (`mapstudy.js:28`). "614" is an internal number leaking into the UI.
  - Learn a set offers a "Stage 3" chip, which is meaningless unless you've opened View.
  - Map study level 10 is the basics.
- **B6. The Show filter (Learned / Learning / New) reads `S.cards` + `isMine`** (`home.js:54`). Relation marks and the You page read the Learner Model (`knowState`). The same color can count as "Learned" on Home and "met" everywhere else.
- **B7. The Learn stem note can read "9 new names"** while Home shows 100 colors and the Journey talks about 1,000. The numbers never meet.

## C. Simplifications (remove or merge)

- **C1. One right corner, not four.** View stays. Study, Map study and Heart fold into one verbs arc (spec in F1).
- **C2. Move the lab out of the user's View.**
  - Out: "Rate every preset", "Copy settings", slider numbers, Center size, Gap, Shape. They go to `#/lab/honey` only.
  - Look keeps the 5 style chips, "Family names when zoomed out" and "One map / Endless".
  - The "Alive" slider becomes an on/off.
- **C3. Merge the two "Every name"s** into the end of the stage scrubber. Drop the "Even 500" collection, which is a developer sampling.
- **C4. Collections shrink to the ones that teach or delight:** Yours (favorites), Pastels, Vivid, Muted, plus families. Archive-source sets (Werner, Ridgway, RAL, xkcd, Web) go to a "Sources" row at the bottom, or into the Museum.
- **C5. One ladder** (see F3). Map study, Learn a set and View all read `HM_STAGES` + every name.
- **C6. Drop "Learning" as a filter.** It's indistinguishable from "Learned" for most users. Use All / Yours / Not yet, plus the new "Next door" view (E2).

## D. Fun and delight upgrades

- **D1. A daily first arrival.** On the day's first open, the map glides (about 900 ms, no snap) from where you left it to today's color, and its bubble breathes once. One line fades in at the top for 2 s, then goes: "Today: *Celadon* · 3 to recall". This answers A8 and folds "color of the day" into the floor.
- **D2. A ripple of what you know.** After a session (Learn, map study), returning to Home plays one ripple outward from each newly "Yours" color (`flyToMap` already exists in `polish.js`). It's an event, not a mark, so X7 holds.
- **D3. Hold-and-slide the stem.** Press the Rooms corner, slide up, release on a room: one gesture, like a long-press menu. It sits beside the tap-to-open, which stays.
- **D4. "Between" as a gesture.** Long-press one bubble, drag onto another, and the road between them lights as a constellation with "Learn this road" (it reuses `l18Resolve`'s `between` road). It's the map-native version of "colors you confuse".
- **D5. Shareable map views.** `#/map/painting/<slug>` already exists. Add a share on the constellation bar that sends the lit map image plus the address ("Starry Night's 9 colors on the map of every color").

## E. Interconnections

- **E1. Learner Model → Home.** `edgeOfMap()` (`learner.js:270`) computes the unknown names next door to what you know, and **nothing calls it**.
  - Make it a Show view, "Next door" (the default once you have 10+ Yours), which lights the edge as a constellation.
  - "Learn these" then opens Learn a set on exactly those colors.
  - It's the honest, X7-safe version of "your map lit by what you know".
- **E2. Confusions → map.** `confusions()` pairs become constellations of two ("You mix these up"). Tap → map study "path" between them, or Learn a set at closeness "Twins".
- **E3. Learn a set ↔ map.**
  - The Learn sheet's "big map" already calls `csOnMap`.
  - In reverse, the constellation bar's "Learn these" calls `lsOpen({ items: lit, label: title })`.
  - After a Study session, return to the map with the set still lit, plus the ripple (D2).
- **E4. Museum ↔ map.**
  - Painting and painter pages get one consistent "See on the map" (some have it, some don't).
  - The constellation bar's ‹ returns to the exact painting with its scroll kept.
  - From the map, tapping a lit bubble opens its color page with "In *Starry Night*" as the hero note, because the source travels along.
- **E5. Train ↔ map.** Train's "Study the map" tile and Home's verb open the same thing with the same ladder. From a Train result screen, "See your misses on the map" lights them.
- **E6. Studio ↔ map.**
  - A photo palette gets "See on the map".
  - The stem's Studio note already shows your last palette.
  - Search "my photo" or "last palette" lights it.
- **E7. Favorites ↔ everything.**
  - Hearts made on the map flow into the shelf (they do).
  - The shelf should open as a constellation, not just a list. The "Yours" collection and favorites should be one concept with one name.
  - Today "Yours" means *learned* (relation marks) while the heart shelf is "Your colors". Pick one word per concept: **Yours = learned, Favorites = hearted.**

---

## Per-feature verdicts (goal · verdict · ideal · connections · skeptic)

| Feature | Goal served | Verdict | The ideal, in one sentence | Should connect to | Skeptic (a month from now users hate it because…) → fix |
|---|---|---|---|---|---|
| **The honeycomb map** | Goal 1 (see many names at once), goal 4 (archive), delight | **Hits** as an object, **almost** as a teacher | A beautiful, stable geography where everything you do in the app shows up as light, and every verb starts here | Every set in the app (constellations), the Learner Model edge, map study | …it's a gorgeous launcher that teaches nothing on its own, so after a week they open rooms directly. → verbs on the map (F1, F2) and "Next door" (E1). |
| **First sight / default focus** | First 60 seconds, daily return | **Misses** | Today's color, or your next-door color, in the middle, breathing once | Color of the day, `edgeOfMap`, Learn's due count | …every open starts on Grey, Silver and Ash. → D1. |
| **Tap to open (center + ring), farther glides** | One tap opens the page (X14) | **Almost** | Instant: the grow starts on touch-up | growFrom, trail | …it feels sticky (220 ms), and when zoomed out the first tap only zooms, so "nothing happened". → F7. |
| **Long-press peek** | Quick look without leaving | **Almost** | The peek shows look-alikes plus "Learn these 2 min" | Learn a set | …nobody finds it. → one first-week hint, then gone (IDEAS 3.19). |
| **View → Show** | Choose how much of color you see | **Almost** | One scrubber from 25 to every name (your stage marked), then All / Yours / Not yet / Next door, then a short collections row | Journey stage, Learner Model | …it's a settings page, and they set it once and never again. → F3. |
| **View → Look** | Delight, personal taste | **Almost** (too much) | Five styles plus two toggles; the lab stays in the lab | none needed | …raw sliders let them break the map and blame the app. → C2. |
| **Search** | Find any color, painter, decade, painting | **Almost** (brilliant resolver, poor surface) | A results list under the field; every row flies the map or lights a set; recents and examples when empty | Trail (recents), Museum (painting titles), Studio | …"I typed sage and the map exploded into a mess, then I couldn't get back". → F4. |
| **Constellations (csOnMap)** | Educate: see where a painting or painter lives in color space | **Almost** (the key one) | A lit set becomes the map's subject, with ‹ back, Learn these, Find them, Share | Museum, articles, Learn a set, map study, Learner Model | …it's a pretty screenshot with no next step and it eats the way back. → F2. |
| **Rooms stem** | Navigation | **Hits** (live art and notes are good) | The same, plus hold-and-slide; the room scrim strong enough that labels never collide | You, Train today, Museum today | …"Explore" vs "Museum" confusion; the capsules sit over tile labels in rooms. → B2 rename (map = "Map", or keep "Explore" and never call a room by it), and A13 scrim. |
| **Corners on Home** | Reach the verbs | **Misses** (four unlabeled round buttons) | Two corners: Rooms (left) and one verbs corner (right) whose arc labels its verbs | map study, Learn a set, favorites, View | …the "one quiet button" Home has grown buttons back. → F1. |
| **Back trail (‹, long-press sheet)** | Never lose your place (N1) | **Hits** for one step, **almost** as a whole | It survives a trip to the map and doubles as "Recent" | Search empty state, Home's ‹ pill | …"I tapped the map glyph by accident and lost 6 pages". → F6. |
| **Map glyph (top-right on pages)** | Exit to the map at any time | **Hits** | Same, plus a resume pill on Home ("‹ Navy") for the session | trail | …it's the same hexagon as Map study. → B1. |
| **Pull-down on pages** | Close like a sheet | **Almost** | Pull = one step back (like a sheet), not to the origin | trail | …a pull three pages deep throws two pages away. → A11. |
| **Pull-down on Home = search** | Search entry | **Misses** (undiscoverable, fights pan) | A visible magnifier in the verbs corner; keep the pull as a shortcut | | …it fires when they meant to pan near the top. → F4. |
| **Favorites pick mode on the map** | Taste, archive (goal 4) | **Hits** (the 10-08 critique scored it 4) | The same; the shelf opens as a constellation | Taste profile, Studio palette | …it's one of four mystery buttons. → F1 (a labeled verb). |
| **Study the map (mapstudy.js)** | Goal 1 plus goal 2: learn where colors live | **Almost** (the best idea here) | A verb on the current map: "Find them" with the lit set or the current stage, the level read from the one ladder | constellations, Learner Model, Train | …level 10 is Red/Blue/Black, which insults adults; a 5-mode sheet with 7 levels, 6 sources and difficulty before you play. → F2/F3: start with "For you" (one tap), the rest under "Choose". |
| **Study corner → Learn a set** | Goal 1 | **Almost** | "Learn these" always means *what you're looking at*: the lit set, else the center's neighborhood, else Next door | Learner Model, map | …"why am I learning greys?" → A6, seed from the lit set or the edge, never from Grey by default. |
| **Surprise me (dice)** | Delight | **Almost** | A random *unmet* color that's next door to what you know, with its name shown for a beat | edgeOfMap | …buried in View, so nobody rolls it. → into the verbs arc. |
| **Family names when zoomed out** | Educate (regions) | **Almost** (labels didn't show in my `home:fam` shot at stage 9) | Region names fade in below a zoom threshold, always on | | …it's off by default and they never find it. → default on (it's labels, not marks). |

---

## F. Top 7, ranked by user impact / effort

### 1. One verbs corner and a quiet title (impact high, effort S–M)
Home keeps two corners: **Rooms** (left) and **Do** (right, the sliders icon replaced by a small "+" or the four-dots mirror).
- **The Do arc.** Tapping Do raises a labeled arc like the stem: **Search · Learn these · Find them on the map · Pick favorites · Surprise me · View…**. Each capsule says what it acts on ("Learn these · 10 near Celadon", "Find them · Stage 3"). The arc reuses the stem code (`toggleStem` markup and scrim).
- **What goes away:** the hexagon (`#hmMapStudy`), the cards corner, the heart corner and the magnifier/pencil/dice row in View.
- **A view label.** A one-line, non-island label fades in for 2 s whenever the view changes or a filter is on ("Stage 3 · 100 colors", "Yours · 41"), then fades out. It names the *view*, never the center color, so X11 holds.
- **Fixes:** A1, A4, A7, B1, B3, B4.
- **Risk:** David's earlier "one quiet button" was about clutter. A labeled arc is quieter than four mystery buttons, but show him a mockup first.

### 2. Constellations become the map's subject (impact very high, effort M)
When a set is lit (`HONEY_HL`), the bottom pill becomes a solid bar:
- the source thumbnail and title ("Starry Night · 9 colors · as photographed");
- **‹** back to the source;
- **Learn these** (`lsOpen({ items: lit, label })`);
- **Find them** (`msOpen({ set: lit })`);
- **Share** (the `#/map/...` address);
- ✕ to clear.

Supporting changes:
- **Keep the trail.** `tlNote` must not reset `XSTACK` when Home is opened *by* `csOnMap`. Pass a flag; Home shows ‹ when `XSTACK.length`.
- **Study follows the light.** The Do arc's "Learn these" and "Find them" use the lit set while one is lit.
- **The source rides along.** Tapping a lit bubble opens its page with "In *Starry Night*" in the hero note.
- **"See on the map" everywhere.** It goes on painting, painter, decade, look, garment, article and Studio photo pages.

This turns "tap a painting to see its colors" from a picture into a loop: see it → place it → learn it → find it → back to the painting. It fixes A5, A6 and the dead end.

### 3. One ladder, your stage by default, and "Next door" (impact high, effort M)
- **One ladder.** `HM_STAGES` plus "Every name" becomes the only ladder:
  - map study's `MS_LEVELS` maps onto it (drop 10 and 614);
  - Learn a set's "Stage 3" chip reads "Your stage (100)";
  - every surface uses one count for every name.
- **A scrubber.** View → Show shows the ladder as a horizontal scrubber with detents (DS §12 asked for this): the count is big, your Journey stage is marked with a small "you" tick, and it eases between sizes with no snap.
- **Defaults.** New users default to their placement stage, not stage 3.
- **Next door.** Add the **Next door** view, powered by the unused `edgeOfMap()` (`learner.js:270`). It's a constellation of the 12 unknown names nearest what you know, and it becomes the default for "Learn these" when nothing is lit.
- **Learner Model.** Switch the Show filter to `knowState` (B6): All / Yours / Not yet / Next door.
- **Fixes:** B5, B6, B7, A9 (part), C5, C6. It also gives Home its educational spine: the map shows where your knowledge ends.

### 4. Search that answers (impact high, effort S–M)
- **A results list, not a filter.** Typing shows up to 6 rows under the field, each with its swatch(es) and kind:
  - the exact color;
  - modifiers ("dusty pink ≈ Ash rose");
  - hex;
  - "between";
  - painters, decades, painting titles (`paintings.js`, gallery titles);
  - looks.
- **The honeycomb doesn't reflow while you type.** Delete the filtering branch in `home.js:427-433`.
- **What a tap does:**
  - a color row runs `flyToColor` plus a one-beat breathe;
  - a set row runs `csOnMap` (F2).
- **Empty state:** "Recent" (the trail's last 5 pages and your last 3 searches, from sessionStorage plus `S.recent`) and three example chips that really work ("Sargent", "1880s", "between teal and navy"). The current placeholder promises painters and decades, so the examples must resolve.
- **Entry points:** the Do arc's first capsule, the pull-down (kept as a shortcut), and the hardware keyboard "/".
- **Fixes:** A3, A4.

### 5. A first sight worth opening (impact medium-high, effort S)
- **The daily arrival (D1):** the first open of the day glides to today's color (or the first due card), with one 2 s line: "Today: Celadon · 3 to recall · tap to open".
- **Later opens** restore your pan, as they do today (`HONEY_PAN`).
- **Never Grey:** if nothing else applies, the default focus is the most saturated mid-light bubble of the stage, never a grey.
- **The return ripple (D2):** returning from a session plays one ripple per newly Yours color, via `flyToMap`.
- **Fixes:** A8. It makes the floor feel alive and personal without a single mark (X7 safe).

### 6. A trail that survives the map (impact medium, effort S)
- **A resume pill.** When you leave a page by the map glyph (`tlExit`), keep the stack in `TL_LAST`. Home then shows a small solid "‹ Navy" pill above the Rooms corner for the rest of the session. A tap restores the trail at that page.
- **Pull-down goes one step.** The pull-down on pages becomes **one step back** (`xBack`), not `tlToOrigin` (A11).
- **No blank rows.** The trail sheet never shows "A page you opened · Page": if meta is missing, re-capture it on jump, or drop the row.
- **Find the long-press.** Long-press ‹ stays. Add a visible "Trail" row at the top of the Do arc when the trail has 3 or more pages, so it's findable without the one-time toast.
- **Feeds search.** The trail becomes search's "Recent" (F4).

### 7. Instant taps, and a View sheet for users, not developers (impact medium, effort S)
**Tap feel:**
- Open on touch-up with no 220 ms wait (`honey.js:1210`).
- Double-tap zoom moves to empty space only (or is dropped; pinch already zooms).
- If a double-tap on a bubble is kept, cancel the grow on the second tap, which is rare, instead of delaying every tap.
- When zoomed out, the first tap zooms *and* shows the name ("Celadon · tap again to open") so it never feels dead.

**View cleanup:**
- One heading, not "View / Show / What to show / Stage / Show". No tracked-mono helper text.
- Remove the lab link, Copy settings and the raw sliders (C2).
- Merge the duplicate "Every name" (A10).
- Collections drop to 6 (C4).
- Family names when zoomed out are on by default.
- The pencil (Name any color) moves to Studio and the Do arc.

---

## Notes for whoever builds this
- **Respect the honeycomb constitution** (`design/IDEAS-10X/home-map.md` §0). Every proposal above is a view, an event or a control, never a resting mark or dim. The constellation's dimming is an explicit, dismissable view (it already exists).
- **Grep first.** `edgeOfMap`, `confusions`, `lsOpen`, `msOpen`, `csOnMap`, `flyToMap` and `HONEY_HL` already exist. Each item above is mostly wiring, not new engines.
- **Small additive edits.** F2 touches `trail.js:79` and `colorset.js:37` (pass an "opened by a set" flag). Keep it to small additive edits (INSTINCTS 4).
- **Screenshot before shipping.** Shoot every new state at 440x956 and 375x812, including the Do arc over the bottom bubbles and the constellation bar with long titles ("The Arnolfini Portrait · 11 colors · as photographed").
