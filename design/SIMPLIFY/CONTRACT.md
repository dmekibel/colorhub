# The day-0 contract (Lane 1, 2026-10-09)

What Lane 1 (chrome + wayfinding) built, for lanes 2-4 to call from their own files. See `PLAN.md` for the
full plan this implements (§9's "day-0 contract" is the spec this file reports against).

**Scope note:** this session delivered Lane 1 solo (lanes 2-4 haven't started). Everything below is real,
working and smoke-tested from Lane 1's own files (`js/core.js`, `js/trail.js`, `js/you.js`, the new
`js/places.js`/`js/search.js`/`js/collections.js`/`js/pagekit.js`/`js/orient.js`, `css/places.css`,
`css/trail.css`, `css/menus2.css`, `index.html`). Lanes 2-4's own files (`js/home.js`, `js/explore.js`,
`js/studio.js`, `js/gallery.js`, `js/richpage.js`, `js/artwiki.js`, …) were **not edited** — see "What's not
done yet" below for exactly what each lane needs to change in its own files to adopt this contract.

## Naming (js/core.js)

```js
const NAV = { map: "Map", learn: "Learn", train: "Train", museum: "Museum", studio: "Studio" };
const KEEP = { verb: "Keep", done: "Kept" };
const NAV_MAP = NAV.map, NAV_MAP_NOTE = "Every color", NAV_MUSEUM = NAV.museum;   // old aliases, unchanged shape
const ROOMS_LIST = [["learn", NAV.learn], ["gym", NAV.train], ["explore", NAV_MUSEUM], ["studio", NAV.studio]];
```

- The home is renamed **"Map"** (was "Explore"). The Museum **keeps its name** (David's 2026-10-08 decision;
  PLAN §3.1 explains why). `NAV_MAP`/`NAV_MUSEUM` are kept as aliases so every existing call site across every
  file (there are dozens) keeps working untouched — read from `NAV` in new code, but don't rename the aliases.
- **You folds into Studio.** `ROOMS_LIST` no longer has a "you" entry. `go("you")` (core.js) and every address
  that used to open `youPage()` now opens `studio()` instead. `youPage()` itself is untouched and still
  renders correctly if something calls it directly (boot.js's `#shot=you` design-review hook still does).
  **Lane 3:** this is where Studio should grow its "Kept" section and absorb what `youPage()` showed (progress
  note → Learn, eye → Train, hearts/taste/palettes/photos → Studio). Nothing was deleted; `js/you.js`'s
  rendering code (`ymYours`, `ymWeek`, `ymEyeBars`, `ymSets`, the mix-up/Untangle flow, the photo shelf) is
  all still there to lift from.
- `KEEP` exists for the rename (Favorites/Your colors/Saved/Collections›Yours → Keep/Kept) but **no file was
  changed to use it yet** — that's Lane 3's `js/favs.js` and whichever files render those old words.

## The Places sheet (js/places.js)

```js
function placesOpen()                      // opens the sheet; call it, or just rely on the corner (below)
```

Replaces the left corner's old bubble-arc stem (`js/core.js` `toggleStem`, removed). The corner itself
(`[data-rooms-corner]`, rendered by `roomChrome()` in core.js **and** separately by `js/home.js` line ~423)
now opens this sheet via a `document`-level click delegator in core.js — nothing else needs to call
`placesOpen()` directly for the corner to work.

**What's inside:** "Pick up where you left off" (if `TL_RECENT` has something stashed), the 5 places
(Map/Learn/Train/Museum/Studio, each with live art from the existing `roomsBubbleArt`/`roomsNote`), then every
collection from `COLLECTIONS` as a picture tile, recent-first (`collRecent()`).

**Ghost-click guard:** same corner, same empirically-observed iOS quirk the old stem was fixed for
(`stemJustClosed`/`STEM_CLOSED_AT`). `placesJustClosed()` (380ms window) guards it; set synchronously on a
scrim tap, and via a `MutationObserver` as a fallback for swipe-down/Escape closes. The corner's click
delegator checks both `stemJustClosed()` (home.js's own right-corner menu) and `placesJustClosed()`.

**Lane 2 (home.js):** your own corner markup at `js/home.js:423` still renders the old unlabeled
`${ROOMS_GLYPH}` — core.js's version (`roomChrome()`) now renders a labeled "≡ Places" pill
(`class="corner l pl-corner"`, `${ROOMS_GLYPH}<span>Places</span>`). Match that markup in home.js so the map's
own corner looks the same as every room's. (Left as-is for this contract, since home.js is your file.)

## The one ⋯ More sheet (js/places.js)

```js
moreRegister(ctx, groupsFn)   // ctx: a string key (see below). groupsFn(): () => groups[]
moreOpen(ctx)                 // opens the sheet for ctx (default: auto-detected, see moreCtxNow())
```

A group: `{ title?, note?, items: [...] }`. An item is one of:
- `{ t, n?, icon?, run }` — a labeled row (icon optional, a sub-label `n` optional), calls `run()` on tap.
- `{ chips: [{ t, run }, ...] }` — a row of chip buttons.
- `{ html }` — raw HTML for anything custom; wire it yourself after the sheet opens (see below).

The sheet always renders, in order: a Search field (opens `searchOpen()`), every registered group (≤6 items
visible per group, same as every other sheet in the app — `moreGroupHTML` truncates and shows "+N more"; it
does **not** yet build the "+N more" sub-page PLAN §3.4 describes — that's a real gap, see below), then
**Settings** (`ymSettingsSheet()`) as the last row. Nothing is required to register: an unregistered `ctx`
still gets Search + Settings, so ⋯ always does something.

**ctx keys:** for a **page** (anything with `[data-back]`, decorated by `js/trail.js` `tlDecorate`), the key
is `tlRouteKind()` — the hash's first path segment (`"color"`, `"painting"` is actually `"gallery"`,
`"painter"`, `"set"`, `"pair"`, etc. — check `ROUTE_NOW` for the exact string a given screen uses, or just log
`tlRouteKind()` once from that screen). For a **room home** (inside `.room-sheet`), the key is the room id
(`"learn"`, `"gym"`, `"explore"`, `"studio"`). Register once per screen type, e.g.:

```js
moreRegister("gallery", () => [
  { title: "Look", items: [{ t: "Where each color sits", run: () => ... }, { t: "Value and squint", run: () => ... }] },
  { title: "Read the colors", items: [{ t: "Diverse", run: () => ... }, { t: "Pick from it", run: () => ... }] },
  { title: "Go", items: [{ t: "On the map", run: () => ... }, { t: "The painter", run: () => ... }] },
]);
```

**Wired automatically:** every page with a back button gets a ⋯ button in its top bar (see below) that calls
`moreOpen(tlRouteKind())` — Lane 4 only needs to call `moreRegister()` once per screen type; the button
and the open call are already there. **Room homes do not get a ⋯ button automatically** (Lane 1 only
decorates pages, not room homes — Train/Explore/Studio still use the older `tabHead()` → `data-menu` →
`menu()` (js/learn.js) → `ymSettingsSheet()` path for their own corner menu). **Lane 2/3:** if you want a
room home to use this same ⋯ sheet instead, call `moreOpen("gym")` (etc.) from wherever that room's own menu
button is, and register its groups the same way.

## One search (js/search.js)

```js
searchOpen({ q?, scope?, from? })   // q: pre-filled query. scope/from: unused placeholders today (see below)
featureRegister(id, { t, where, words, run })
```

A real, working, from-scratch search sheet: colors (all ~101 + archive names, `BYNAME`/`ALL`/`BASICS`),
collections (`COLLECTIONS` by title), and anything registered with `featureRegister`. Opened from the Places
sheet's search row and every ⋯ sheet's search row. **It does not replace or redirect any existing search**
(home.js's own map menu search/pull-down, explore.js's `exploreSearchSheet`) — those are each in a file this
session didn't touch. **Lane 2/3:** PLAN §3.7 calls for merging those into this one; the simplest path is
changing their own "Search" button's `onclick` to call `searchOpen()` instead of building their own sheet, and
`featureRegister`-ing whatever those sheets did ("Slideshow", "Surprise me", "Name any color", a scope chip
UI) so it's still findable here, then deleting the old sheet code. `scope`/`from` in `searchOpen()`'s options
are accepted but not yet used to filter results or add scope chips (PLAN §3.7's "All · Colors · Paintings ·
Painters · Collections · Tools" row) — that's real remaining work, not just a rename.

## Collections (js/collections.js)

```js
const COLLECTIONS = [{ id, t, group, count, pic, open() }, ...]
collOpen(id)      // records S.recentColl, then calls the entry's open(), wrapped in try/catch (never a dead tap)
collRecent()      // COLLECTIONS reordered recent-first, from S.recentColl
```

**Stubbed conservatively, on purpose:** only collections with a real, already-shipped, zero-argument entry
point are listed (Paintings, Art history by color, Gems, Flowers & dyes, Pulp covers, Photography, Brands,
Design objects, Ukiyo-e prints, Botanical & bird plates — 10 total). Each calls an existing global function
(`openPart("art")`, `awIndex()`, `gmListPage("gems")`, `pulpGrid()`, …) — none of these files were edited.
Fashion has no zero-arg landing yet, so its entry falls back to the World lens (`S.lens="world"; go("explore")`)
— one tap deeper than ideal, but not a dead end.

**Not included at all** (per PLAN §3.1's full list): Poems, Painters as their own page (today they share
`awIndex()` with Art history), Movements & decades as their own page (same), Stories, Aesthetics,
Pigments & ideas, Literature, Films. These need real pages before they can be safe collection entries — see
PLAN §9's Lane 3 list (`js/poems.js` browse, `js/artwiki.js` painter index, splitting the old Ideas lens into
its own pages from the existing section builders `lkSections`/`passagesSection`/`filmsSection`). **Lane 3:
widen `COLLECTIONS` as you build these** — same shape, just add entries and give each a real `pic` (a
representative hex or small image, still without reading lazily-loaded wiki data at load time).

`S.recentColl` is a new, unversioned save key — `migrateState()` wasn't touched (unnecessary: `collRecent()`/
`collOpen()` already guard with `Array.isArray`, and unknown keys already survive migration untouched).

## Page actions (js/pagekit.js)

```js
pageActions(el, actions)   // actions: [{ t, icon?, primary?, run }], length <= 3; renders the HTML and wires clicks if `el` is a DOM node
```

A stub per PLAN §3.6/§9 ("at most 3 actions, one paper"). **Not used anywhere yet** — Lane 4 wires each page's
own action row through it (`js/gallery.js`, `js/richpage.js`, `js/setpage.js`, `js/artwiki.js`). Warns to the
console (not a hard failure) if given more than 3 actions.

## The one top bar (js/trail.js)

Every page with a back button (`[data-back]`, i.e. everything `tlDecorate` already touched) now gets:
**`‹ <previous page, where there's room>` · `⋯` · `<place pill, where it isn't redundant>`**.

- **‹** is unchanged in behavior (`xBack()`/the gesture); it's now also labeled with the previous page's title
  where the header has room for it (`.nav-top` with a reserved `.nav-r`, or a bare ad-hoc header with nothing
  else in it). A **crowded** ad-hoc header (one that already has its own button — a painter page's "Compare",
  Art's "Surprise me") and the two special header shapes (`.cp-close` float, the pinned `.rp-bar`) keep the icon
  alone; its `aria-label` always says where it leads either way.
- **⋯** (`.tl-more`, a new 40px circle beside the place pill) opens `moreOpen(tlRouteKind())`.
- **The place pill** (`.tl-exit`, `[data-tl-exit]`) is the old "Close" pill, renamed to the place it closes to
  (icon + name, e.g. "Map", "Museum") and still calling the same `tlExit()`. **It hides when ‹ already leads
  to the same place** (`XSTACK.length <= 1` — PLAN §3.5 rule 8, "never two buttons that do the same thing").
  This is the single biggest behavior change existing callers need to know: **don't assume `[data-tl-exit]`
  exists on every page** — it's absent on a trail's first hop, by design.
- **A crowded ad-hoc header** (as above) keeps only the place pill, not ⋯ too — there's no reserved room for
  both without overflowing a narrow phone screen. Once Lane 4 moves that page's own extra header button (e.g.
  the painter page's "Compare") into its action row (`pageActions`, above), its header stops being "crowded"
  and both ⋯ and the pill start appearing there too, automatically — no further change needed in `trail.js`.
- **Pull-down from the top now closes the whole pile** (same destination as the place pill — PLAN §3.5
  changed this from the old "one step back"). The left-edge swipe is unchanged (one step back, like ‹).

## First-run orientation (js/orient.js)

`S.orient` (0/undefined → 1 → 2 → 3 "done"), three steps, each dismissed by any tap and never repeated:
1. The live map, first time it's shown after placement ("Tap any color.") — hooked from `js/trail.js`
   `tlNote`'s map-render branch.
2. The first page opened off the map ("‹ goes back a step...") — hooked from `tlDecorate`.
3. Back on the map a second time, the Places pill glows once ("Learn, Train, Museum and Studio are in
   here...").

**Did not touch `js/learn.js`'s `welcome()`** (the old static "Find my level" screen unplaced visitors see) —
that's Lane 3's file, and PLAN §5 asks for it to be folded away as a screen with "Find my level" becoming
Learn's own paper button. `welcome()` is unchanged and still works exactly as before; the orientation overlay
above is purely additive, playing on top of the live map/pages once someone has already placed.

## What's not done yet (for lanes 2-4)

Everything in this file marked **Lane N:** above, plus, not called out individually: no room home besides
what `tabHead()`/`data-menu` already did gets a search icon in its header (PLAN §3.7); the Museum room itself
(`js/explore.js` `exploreHome`/`explorePager`) is untouched — it's still the 5-screen pager from before this
plan, not the one-screen-of-collections PLAN §3.1 describes; the Map sheet (⋯ on the honeycomb itself) is
still `js/home.js`'s `doMenu`, not rebuilt through `moreRegister`; renames (Grid for the arrangement, Keep/Kept
everywhere) haven't touched any Lane 2/3 file's own strings.
