# Simplify: one map, four places (2026-10-09)

David: "Think about every menu in the app and how to make it easier, more palatable, less overwhelming, more user-friendly. The app is becoming more complicated and it's easy to get lost in it now." Then: "Don't necessarily delete features. Maybe change how you access them." And: "Why do I need to go to Museum and then World just to reach pulp covers and photography? Too many steps."

So this plan is about **access, not removal**, and about **depth**: no collection should sit behind a container whose name doesn't predict it. Every capability stays. Most changes are MOVE (a new, findable home), MERGE (two copies of one thing become one) or TUCK (one tap deeper, in the same place on every screen). REMOVE is only for true duplicates and broken controls, and those are listed separately in §7 for David to approve.

Prototype: `design/SIMPLIFY/mockups.html` (open it from the repo so the painting images load; `?s=<state>` jumps to a state). Before/after pictures: `design/SIMPLIFY/shots/`.

---

## Summary

### The new model in 5 lines
1. **Home is the Map.** One map with two layers, Colors and Paintings, switched in one place.
2. **Four places sit beside it: Learn, Train, Museum, Studio.** One labeled button, bottom left ("≡ Places"), lists them and, under them, **every collection as a picture tile, recent first: any collection is two taps from any place.**
3. **Every screen has one ⋯ More sheet with the same anatomy:** search first, then this screen's options and tools, then Settings. Nothing is deleted. It's one tap down, always in the same spot, and search finds collections, features and settings too. Places also show a search icon in their header.
4. **Every page has the same top bar: ‹ (named for where it goes) · ⋯ · the place you started from.** ‹ is one step back. The place pill closes the pages. "Pick up where you left off" in the place list brings them back.
5. **On the surface: the content, at most 3 actions and one paper button.** Everything else is one tap down in ⋯, and every power feature is findable by name in search.

### The 10 biggest changes
| # | Change | Kind |
|---|---|---|
| 1 | **Every collection is two taps from anywhere.** The Museum keeps its name but loses its swipe-only lenses (Art, Ideas, World): it becomes **one screen of collections**, picture tiles, one plain noun each (Paintings, Painters, Photographs, Pulp covers, Fashion, Brands, Gems, Flowers & dyes, Poems, Literature, Films, Stories, Aesthetics, Movements & decades…), recent first. The same tiles sit under the place list in the Places menu, and search finds any collection by name. Today, pulp covers and photographs take 7 taps and swipes; poems, painters and movements have no door at all. | MERGE + MOVE |
| 2 | The map's right-corner menu (5 rows) and the Colors & Arrange sheet (2 tabs, 67 controls) become **one Map sheet behind ⋯**. On top: Colors \| Paintings, How many (a slider), Family, Arrange. One tap deeper: More filters, Look & feel, Map tools. | MERGE + TUCK |
| 3 | **The paintings floor becomes the map's second layer.** Its 176-button Arrange/Filter sheet becomes 5 filter rows with their current values (When, Painter, Movement, Country, Museum) and "More options". | MERGE + TUCK |
| 4 | **You folds into the four places:** "colors yours" goes to Learn, your eye to Train, hearts, taste and photos to Studio's Kept, and settings to one Settings sheet reached from every ⋯. | MOVE |
| 5 | **One search, at the top of every ⋯.** The map's search and the Museum's search merge into one, and it also finds tools and settings ("slideshow", "eyedropper", "haptics"). | MERGE |
| 6 | **One word for saving: Keep (♡), and one shelf: Kept, in Studio.** "Yours" means only "learned" (named again a day later). Today there are seven words for this. | MERGE |
| 7 | **One top bar on every page.** ‹ shows where it goes ("‹ Periwinkle"). ⋯ holds the page's tools. The right pill names the place you'll return to ("Map", "Museum"). It replaces "Close", the map glyph and the 8-second "Back to…" pill. | MERGE |
| 8 | **At most 3 actions on any page.** Color: Learn it · Pair with… · ♡. Painting: Learn these · Keep · Share. Set: Learn · Keep · Share. Everything else goes to the page's ⋯. | TUCK |
| 9 | **The painting page's surface drops from 30 controls to 18:** the picture with Pick a color and Look closer, the palette, 3 readings and the slider, and 3 actions. The six "Where" glyphs move into Look closer; Diverse, Pick from it, On the map, Play and the museum link move into ⋯. | TUCK |
| 10 | **Today's boards live in Train only.** The second copies of Today's painting, Name it in six and Look in Learn's "Or choose" list go away. Learn keeps one path, Review and "More ways to learn". | REMOVE (duplicates) |

### Counts, before → after (measured in headless Chrome at 440×956, `main` at 539ed49e)
| What | Before | After |
|---|---|---|
| Top-level destinations | 7 (Map, the paintings floor, Learn, Train, Museum, Studio, You), plus the Museum's 5 full-screen lenses | **5** (Map with 2 layers, Learn, Train, Museum, Studio) |
| Taps and swipes from the map to a collection | Paintings 4 · Fashion 6 · Photographs, Pulp covers, Brands, Gems, Flowers 7 · Films, Literature, Stories 5 plus a long scroll · Poems, Painters, Movements & decades: **no door** | **2 for every collection** (≡ Places, then its tile), from the map or any place; or search |
| Containers whose name doesn't predict what's inside | 3 (Art holds poems; Ideas holds films and 159 looks; World holds pulp, photographs, brands, gems and flowers) | **0** (the group headings inside the Museum are labels, not doors) |
| Floating controls on the map | 2, both unlabeled glyphs | **2**: "≡ Places" (labeled) and ⋯. The map names itself in its caption ("Map · hue across, light to dark down"). |
| Choices one tap from the map | 10 (5 rooms + 5 menu rows), and no collection | **5 places** first (+1 "Pick up where you left off" when there is one), then every collection below them in the same sheet |
| Controls within two taps of the map | ~86 on the Colors side, plus ~187 on the paintings floor | **~30 visible**; the rest one more tap down, all findable by search |
| Kinds of sheet and menu reachable from the map | 8 (Rooms stem, menu stem, Colors & Arrange, map search bar, favorites picker, paintings sheet, its painter search, slideshow) | **3**, all one sheet component (Places, ⋯, Settings) |
| Ways back or out of a page | 9 (‹, iOS swipe or browser back, long-press trail sheet, Close pill, map glyph, pull-down, "Back to…" pill, the room's floor strip, the lit-set bar's ‹) | **3 ideas, 5 ways in:** ‹ one step (also the edge swipe and browser Back; hold it for the trail); the place pill closes the pages (also a pull-down from the top); "Pick up where you left off" reopens them |
| Global search fields | 2 (map, Museum), plus 8 list searches | **1**. The list searches stay, as filters on long lists. |
| Words for "save" | 7 (Favorites, Your colors, Add to your colors, Add to your favorites, Keep, Saved, Collections › Yours) | **1** (Keep, Kept) |
| Icons meaning "menu" in the corner | 3 (stacked list, four dots, sliders) | **1** (⋯) |
| Painting page, controls above the fold | 30 | **18** |
| Paintings browse page (today Museum › Art), controls on the first screen | 25 (188 on a 48,000 px page) | **11** |

### Build order: 4 lanes (details in §9)
| Lane | Builds | Owns (no one else edits these) |
|---|---|---|
| **1 · Chrome & wayfinding** (goes first: the day-0 contract) | Places menu, ⋯ More sheet frame, one search with the feature index, Settings sheet, the top bar (named ‹, place pill), the trail changes, the renames, first-run orientation, You folding away | `js/core.js`, `js/trail.js`, `js/router.js`, `js/boot.js`, `js/you.js`, new `js/places.js`, `js/search.js`, `js/orient.js`, `css/menus2.css`, `css/trail.css`, `css/shell.css`, new `css/places.css`, `index.html` |
| **2 · The map** | The Map sheet (Colors \| Paintings), How many slider, sub-pages, the paintings layer's chrome and card | `js/home.js`, `js/honey.js`, `js/paintmap.js`, `js/colorsets.js`, `css/home.css`, `css/honey.css`, `css/paintmap.css` |
| **3 · The four places** | Learn, Train, Museum and Studio homes; the collections registry (`js/collections.js`) and recent-first order; the Paintings browse page; the Ideas lens split into its own collections (Stories, Aesthetics, Films, Literature, Pigments & ideas); Kept; Practice's one slider | new `js/collections.js`, `js/learn.js`, `js/learnhub.js`, `js/rooms2.js`, `js/gym.js`, `js/explore.js`, `js/browse-ui.js`, `js/studio.js`, `js/favs.js`, `js/favprofile.js`, `js/practice.js`, their CSS |
| **4 · Pages** | The 3-action row, each page's ⋯ sections, Look closer's Done, the set page's Edit; the two missing collection pages (Poems, Painters) | new `js/pagekit.js`, `js/gallery.js`, `js/paintzoom.js`, `js/richpage.js`, `js/setpage.js`, `js/artwiki.js`, `js/sources.js`, `js/poems.js`, their CSS |

---

## 1. Inventory: what's there today

Walked in headless Chrome (Playwright, system Chrome) at 440×956 with a placed profile, on `main` at 539ed49e. "Visible" = tappable and not covered in the first viewport; "total" = every control on the screen, scrolled.

### The map and its corners
| Surface | How you get there | Controls |
|---|---|---|
| The map (`#/home`) | Landing screen | Canvas + 2 unlabeled corners (a stacked-list glyph, four dots). No title on screen. Pull-down opens search. |
| Left corner: Rooms stem | Tap the stacked-list glyph | 5 capsules: Learn, Train, Museum, Studio, You (6 inside a room: Explore is added) |
| Right corner: map menu | Tap the four dots | 5 capsules: Study the map, Favorites, Search, Colors & Arrange, Paintings |
| Colors & Arrange sheet, Colors tab | Menu › Colors & Arrange | 45: 2 tabs, 4 icon-only buttons (Search, Name any color, Surprise me, Slideshow), Close, 10 stage chips, 10 families, 5 tones, 4 "Your words", 9 collections |
| Colors & Arrange sheet, Arrange tab | Tab | 22: 5 shapes, 6 orders, Bubbles/Honeycomb, 3 sliders, Reset, Edges (2) |
| Map search | Menu › Search, or pull down | A field at the top; results fly to a color |
| Favorites picker | Menu › Favorites | A tap-to-heart mode on the map |
| Paintings floor (`#/paintings/map`) | Menu › Paintings | 11 visible: ‹, a "By color ▾" title that is also a menu, a card with ♡ and center, 5 chips (Walk from here, More like this, 1600s, Commons, a color), a sliders corner. The card shows the literal text "undefined" next to the heart (bug). |
| Paintings sheet | The sliders corner | 176 controls across Arrange (7 shapes, 3 "place by", 5 "center on", When) and Filter (7 centuries, 10 of 44 countries, 18 movements, 7 museums, 10 painters + More painters) |

### The rooms
| Room | Visible / total | What's in it |
|---|---|---|
| Learn (`#/today`) | 14 / 20 | 10-color strip, "Your first ten" + Study, a family wheel (9 wedges, "0 yours"), "Or choose": Today's painting, Surprise me, Make your own deck, Slideshow, Slideshow from today's color, Look, Name it in six |
| Train (`#/train`) | 12 / 12 | Today (Painting, Color, Gradient), Games (Odd one out, Gradients, Across the line, Color memory, Painters' pairs, Brand colors), Drills, Your eye |
| Museum (`#/museum`) | For you 9 / 30 | A vertical pager of 5 full-screen lenses: For you, Art, Ideas, World, Saved, with a search button. The For you cover is a full screen of one color with a tiny dot pager. |
| Museum › Art | 25 / 188, 48,086 px tall | 4 "ways in" icons, 8 filter dropdowns, Shuffle, a Rooms carousel (12), Grid/River/Painters/Wall/Map + Sort, then 60 decade sections, each with "Show N more" and "Only 1270s" |
| Museum › Ideas | 5 / 359, 41,014 px | 30 stories, 7 ideas, traditions, cultures, pigments, people, books, 159 looks |
| Museum › World | 7 / 17 | Fashion, Pulp covers, Photography, Botany, Gems, Design: a good contents page |
| Studio | 6 / 7 | Capture (camera, photo), Name any color, Build (Gamut wheel, Albers), Your colors |
| You | 8 / 16 | "0 colors yours", Your colors, Find your color, Find your palette, Odd one out profile, and 10 settings rows |
| Practice (`#/practice`) | 46 | One number set three ways (chips First 25…First 1,000, a slider, and −/+), plus family, lists, order, ask, round, 4 methods. Both ‹ and Close in the header. |

### How deep each collection sits today
Shortest path from the map, counting every tap and swipe (the Museum pager's dots are decorative, `aria-hidden`, so its lenses can only be swiped to).

| Collection | Path today | Taps + swipes |
|---|---|---|
| Paintings (browse) | Rooms › Museum › swipe › Enter Art | 4 |
| Paintings (as a map) | ⋯ › Paintings | 2 |
| Painters | No index. Art › the Painter dropdown › a name | 6 |
| Poems (11,440) | **No door.** Only a color page's "In poems", or Art's color search, which adds a poems rail | — |
| Movements & decades | **No door** from any room. Only links inside painter and movement pages | — |
| Aesthetics (159 looks) | Rooms › Museum › swipe × 2 › Read Ideas › a look | 6 |
| The family tree | Rooms › Museum › swipe › Enter Art › swipe the Rooms carousel › its tile | 6 |
| Stories, Pigments & ideas | Rooms › Museum › swipe × 2 › Read Ideas, then a long scroll | 5 + scroll |
| Films, Literature | The same, then a scroll past 159 looks, 30 stories and the systems | 5 + a very long scroll |
| Fashion | Rooms › Museum › swipe × 3 › Enter World › Decades | 7 |
| Pulp covers, Photographs | Rooms › Museum › swipe × 3 › Enter World › its tile (lower down) | 7 |
| Brands, Gems, Flowers | Rooms › Museum › swipe × 3 › Enter World › its tile (near the bottom) | 7 |
| Design objects, ukiyo-e prints, botanical and bird plates | Not built yet, and no home planned | — |

**What the container names promise:** "Art" holds poems. "Ideas" holds films, literature and 159 looks. "World" holds pulp covers, photographs, brands, gems and flowers. A first-time user can't predict any of these.

### Pages
| Page | Visible / total | Notes |
|---|---|---|
| Color (`#/color/periwinkle`) | 9 / 91, 9,060 px | Good top: Learn it, Pair with…, ♡, hex. 21 section titles below. ‹ and Close. |
| Painting, curated (`#/painting/arnolfini`) | 10 / 31 | More like this in the top bar; palette; On the map, Learn, Play, Learn these colors |
| Painting, archive (`#/gallery/1200`) | **30** / 122 | Top bar: ‹, museum link ("Chicago"), ♡, Close. On the image: Pick a color, Look closer. 6 chips, each with a second "Where" glyph. 5 readings + Pick from it, a slider **and** −/+. Then Learn the rest, Keep, Share, On the map, Play… |
| Look closer | 6 | ✕ at top left (pages use top right), Value, Squint, Where, Pick, Region |
| Set (`#/set/…`) | 21 / 58 | 3 colors as 3 swatches, 3 rows each with drag and remove, then Learn, Keep, Share, Add a color |
| Painter (`#/painter/…`) | 10 / 160, 48,357 px | Compare in the top bar; filters; findings |
| Trail sheet | long-press ‹ | Where you've been, newest first |

### Duplicate paths to the same thing
- **Search:** map menu row, the Colors sheet's magnifier, a pull-down on the map, the Museum's own search button and sheet (a different search). Plus 8 list searches (painters, flowers, fashion, poems, paintings-map painter, browse, the color dial, set pages).
- **Favorites:** map menu › Favorites, Studio › Your colors, You › Your colors, Museum › Saved, Colors sheet › Collections › Yours.
- **Paintings by color on a map:** map menu › Paintings, Art › Map view, Art › "See these paintings as a map", a painting's On the map and Similar paintings on the map, a painter's "Their work on the map".
- **Today's painting / Name it in six / Look:** Learn › Or choose and Train › Today.
- **Slideshow:** the Colors sheet's play icon, Learn › Slideshow, Learn › Slideshow from today's color.
- **Surprise me:** the Colors sheet's dice, Learn › Surprise me.
- **Name any color:** the Colors sheet's pipette, Studio › Name, `#/studio/namer`.
- **Your eye:** Train › Your eye and You › Odd one out profile.
- **Arrange the paintings:** the paintings floor's title menu and its sheet's Shape row.
- **One number, three controls:** Practice's chips, slider and −/+; the painting page's slider and −/+.
- **Exit to the map:** the Close pill, the map glyph (in CLAUDE.md, now the pill), the room's dimmed floor strip, Rooms › Explore, the pull-down.

### Inconsistent names for the same thing
- **The map is called four things:** "Explore" (Rooms stem, page title, trail sheet), "the map" (Close's label, "On the map"), "Home" (code, `#/home`, the glyph) and "Map", which is also the name of one *arrangement* inside the map.
- **The Museum** is `explore` inside, and every `#/explore…` address opens it, while "Explore" on screen means the map.
- **Learn** lives at `#/today`, and "Today" is also a row in Train and a heading in Learn.
- **Save** has seven words (see the counts table). "Yours" means *learned* in Learn and *hearted* in Collections.
- **Close** means three things: close a sheet, leave Look closer, and exit every page to the map.
- **Study verbs:** Study, Study these, Study the map, Learn it, Learn these, Learn these colors, Learn the rest, Learn, Practice, Recall, Review, Test yourself, Make your own deck.
- **The paintings floor** is "Paintings" in the menu, "Painting map" in the tab title, "By color" on screen, and "Map" inside Art.
- **Train's tiles** say "Painting", "Color" and "Gradient", but the games are called Five ways to look, Name it in six and Today's gradient.

### Places a first-time user can't tell where they are, or how to get back
1. **The map has no name on screen.** The trunk test fails on the landing screen.
2. **Both corners are private symbols** (DESIGN-CANON A1). The same corner spot shows a third glyph on the paintings floor (sliders), with different contents.
3. **The paintings floor looks like another app.** It has no place name, only "By color ▾", and it's only reachable from the four-dots menu.
4. **The Museum opens on a full screen of one color** with "For you" and a dot pager. Nothing says four more sections sit below, and the dots can't be tapped. Pulp covers and photographs are 7 taps and swipes from home, inside "World", a word that doesn't predict them.
5. **On a page, neither control says where it goes:** ‹ has no label, and "Close" doesn't say "to the map".
6. **Look closer puts ✕ at top left;** pages put Close at top right, and they mean different things.
7. **Practice shows ‹ and Close together.** A user can't know which to press.
8. **After Close, the phone's Back stays on the map** (deliberate: TL_FORGOT). Without a visible "Pick up where you left off", the chain feels lost after the 8-second pill fades.

### Dead or rarely useful controls (found on the walk)
- The paintings card's literal "undefined" text (a bug).
- A white-flip selected tab on Colors | Arrange: a paper-white "Colors" or "Arrange" pill, a banned pattern (VISUAL-DIRECTION §2).
- Four icon-only buttons in the Colors sheet header (Search, Name any color, Surprise me, Slideshow): private symbols. Unclear, not dead.
- "Only 1270s" on each of 60 decade sections in Art: the When filter does the same thing.
- The paintings floor's "By color ▾" title menu: the sheet's Shape row does the same.
- −/+ beside the painting page's How many slider, and Practice's chips and −/+ beside its slider.

---

## 2. Diagnosis: why it's easy to get lost

**The mental model today.** It is a floor (the map) with five rooms rising from one corner, a second corner that is a toolbox for the floor, and a hidden second floor (paintings) behind the toolbox. Each room then grew its own sub-navigation: the Museum has a pager of five full-screen lenses, Art has its own search, filters and five view modes, and Learn has an "Or choose" list that repeats Train. Pages have three ways out (‹, Close, pull-down) plus two more after you leave (the 8-second pill and the long-press sheet). Every addition was reasonable on its own; together there is no single answer to "where is X?", because most things have two or three homes and some have none you can see.

**The four root causes**
1. **No place says its own name.** The map is nameless, the corners are glyphs, and pages don't say where ‹ or Close lead.
2. **Things have several homes, and the homes have different names.** People learn a map of the app by repetition. Two paths with two names to the same thing feel like two different things.
3. **Each screen invents its own menu.** There are stems, tile panels, a two-tab sheet with icon buttons, a sliders sheet with seven groups, a dot pager and dropdown chips. Nothing transfers from one screen to the next.
4. **The surface shows every option at once** (67 on the Colors side, 176 on the Paintings side, 30 on a painting). David's principle 22 is exactly this: "the user would be overwhelmed and would never reach certain features."

**The one model that fixes all four:** a home, four places, and one set of rules that is the same on every screen. (Canon A1–A4 and laws 2–4; DAVID-MODEL P6, P13, P14, P17, P22.)

---

## 3. The new model

### 3.1 Places
| Place | One word | What lives there | Address |
|---|---|---|---|
| Home | **Map** | Every color, and, as a second layer, every painting | `#/map` (`#/home` stays as an alias) |
| | **Learn** | Your next names, Review, your families, "colors yours", More ways to learn (your own deck, Surprise me, placement) | `#/learn` (`#/today` alias) |
| | **Train** | Next for you, Today's three boards, the 6 games, Drills, Your eye | `#/train` |
| | **Museum** | Today's painting; Recent (your last 3 collections); then every collection as a picture tile, under plain group headings (Art · Design · Nature · Writing & film · Looks & ideas) | `#/museum` (`#/explore…` aliases) |
| | **Studio** | Camera; Kept (colors, paintings, palettes, photos, anything ♡'d); Tools (Name any color, Gamut wheel, Albers); taste tests | `#/studio` (`#/you` alias opens Studio) |

**Why the name stays "Museum".** David named it on 2026-10-08 (P21: don't regress what he chose). The depth problem was never the name; it was the lenses inside it. Real museums hold exactly this mix (the V&A has fashion, posters, jewelry and botanical plates), and once the Museum's first screen *shows* every collection as a picture, the word no longer has to predict them. "Collections" was considered and is one constant away (`NAV.museum`) if David prefers it.

**The collections, one tile each** (the registry lives in `js/collections.js`; a new archive is one line):

| Group heading (a label, not a door) | Tiles |
|---|---|
| Art | Paintings (23,778) · Painters (840) · Photographs (3,465) · Movements & decades · Ukiyo-e prints (soon) |
| Design | Fashion (decades, houses, 991 garments, Color of the year) · Brands (129) · Pulp covers (832) · Design objects (soon: posters, textiles, ceramics, furniture, glass, stamps, wallpaper) |
| Nature | Flowers & dyes (37 plants, 12 dye plants, the language of flowers) · Gems (29) · Botanical & bird plates (soon) |
| Writing & film | Poems (11,440) · Literature (225 passages) · Films (32) |
| Looks & ideas | Aesthetics (159 looks, with the family tree) · Stories (58) · Pigments & ideas (74 pages) |

Rules: a tile shows real pictures from its collection and its count. A design-object type gets its own tile once it clears the data bar (100+ pictured items); until then the types share the Design objects tile, with a type filter. "Soon" tiles appear only when a lane is actually building them. Recent (the last 3 opened, in `S.recentColl`) leads both the Museum screen and the Places menu's grid.

**Why Studio absorbs You.** Studio is "make and keep": what you capture, keep and build. Everything personal in You fits one of the others: progress belongs with what produced it (Learn, Train), and settings belong everywhere (⋯). That gets the count to four places plus home, and it ends "You" opening on a 120 px "0" (DESIGN-CANON §3.7). Veto option: keep You as a fifth place holding Kept and Settings; the rest of the plan works unchanged.

### 3.2 Naming: one word per thing
| Concept | The word | Retired words |
|---|---|---|
| The home | **Map** | Explore (for the map), Home, "the map" as a label |
| The map's two layers | **Colors**, **Paintings** | Painting map, By color (as a title) |
| The place of archives | **Museum** (the place), and each collection by its plain noun (Pulp covers, Photographs, Gems…) | Art, Ideas, World (as containers), For you (as a lens) |
| The name lists in the map's filters (Werner, Ridgway, RAL, xkcd…) | **Name lists** | Collections (that word now means the Museum's archives) |
| The grid arrangement | **Grid** | "Map" (as the shape's name: it collided with the place) |
| Saving anything | **Keep** (verb), **Kept** (the shelf), ♡ icon | Favorites, Your colors, Add to your colors, Add to your favorites, Saved, Collections › Yours |
| Learned for real | **Yours** (named again on a later day) | — (now unambiguous) |
| Learning verbs | **Learn** (new names), **Review** (due ones), **Practice** (your own deck), **Test yourself** (a quick check on a page) | Study, Study these, Study the map, Recall, Learn the rest, Learn these colors |
| Today's boards | **Today** (in Train only) | Today's painting and Name it in six as rows in Learn |
| The list of places | **Places** (≡, bottom left, always this word) | Rooms, the stacked-list glyph |
| The menu of a screen | **More** (⋯) | Menu, Settings and more, the four dots, the sliders corner |
| One step back | **‹ + the page's name** | an unlabeled ‹ |
| Closing a pile of pages | **the starting place's name** ("Map", "Museum") | Close, the map glyph, "Back to…" |
| Leaving a tool | **Done** | ✕ (in Look closer) |
| Closing a sheet | **✕** | — (✕ now means only this) |

### 3.3 The depth ladder (where every feature lives)
| Level | What's here | Rule |
|---|---|---|
| **Surface** | The content, the place pill or top bar, at most **3 actions**, at most **one paper button** | If it isn't the thing itself or one of the 3 most-used actions, it goes down a level |
| **One tap: ⋯ More** | 1. Search. 2. This screen's options and tools, in titled groups. 3. Settings. | Same sheet, same order, same spot (bottom right on places, top bar on pages) |
| **Two taps** | "+4 more" inside a group, sub-pages (More filters, Look & feel, Map tools), a tool's own screen (Look closer) | A sub-page slides in inside the sheet, with ‹ to come back. Never a second sheet on top. |
| **Findable** | Every option, tool and setting at any level | Registered in the search's feature index by its name and the words people use for it ("eyedropper" → Pick a color) |

### 3.4 The one sheet pattern
- **One component** (`sheet()` in core.js, already in use): opaque `--s1`, radius 28 on top, a grabber, a title-2 title on the left, a 44 pt ✕ on the right. No icon-only header buttons (DESIGN-CANON A1).
- **At most one segmented control,** with 2–3 segments, directly under the search field (the Map's Colors | Paintings).
- **Groups:** a title-3 heading, then at most **6 options** visible; the 7th is "+N more", which opens the full list as a sub-page.
- **At most 4 groups** before a block of rows ("More filters ›", "Look & feel ›").
- **The ≤6 rule is for choices** (filters, orders, settings). A **directory of destinations** (the collections under the place list, the Museum screen) shows every destination as a picture, recent first, because a destination you can't see is the depth problem this plan fixes. In the Places sheet the 5 places come first and fill the opening view; the collections start below them.
- **Selected** = `--s3`, a 1.5 px ring and a color dot. Never a white fill.
- **A sheet that changes what's behind it** (the Map sheet, its sub-pages) **doesn't dim** and stays at most 64% tall, so the map changes live above it as you choose (HOME-VIEWS §5, P13: "you can see what's happening"). Every other sheet dims what's behind it.
- **Closes** with ✕, a tap outside, a swipe down on the header, Escape and Back.
- **The Places menu** is the same sheet with place rows (live art, a one-line note, "Here" on the current one) and, when there is one, a paper "Pick up where you left off" row on top.

### 3.5 The one top bar (every page)
`[‹ Previous page's name]   ……   [⋯]   [Starting place's name]`
- **‹** goes one step back. Its label is the previous page's title, cut at about 14 characters. The iOS edge swipe, the browser's Back and Escape do the same. Long-press opens the trail sheet (as now).
- **⋯** opens the page's More sheet. It lists what isn't on the surface; it never repeats a surface action.
- **The place pill** ("Map", "Museum", "Learn"…, with that place's icon) closes the pile of pages and returns to where the trail started, with its scroll and pan kept. A pull-down from the top of the page does the same. It hides when ‹ already leads there, so the bar never shows two buttons that do one thing.
- **Nothing else goes in the bar.** Museum links, ♡, Compare and More like this move into the page.

### 3.6 Page actions: at most 3
One row under the hero: one primary (paper only if it's *the* action of the page) and up to two secondary pills. Only ♡ may be icon-only, because everyone knows it. Everything else on a page is either content (links, chips, sections) or in its ⋯.

| Page | Surface actions | In ⋯ |
|---|---|---|
| Color | Learn it · Pair with… · ♡ | Find it in paintings, See it on the map, Test yourself, Codes (copy any), Share |
| Painting | Learn these · ♡ Keep · Share (and, on the picture itself, Pick a color and Look closer) | Look: Where each color sits, Value and squint, Region. Read the colors: Diverse, Pick from it, Focal. Go: On the map, The painter, Full size at the museum, Play with these colors |
| Set / pair | Learn · ♡ Keep · Share | Edit (reorder, remove), Add a color, See it in paintings, On the map |
| Painter | Compare · ♡ Keep · On the map | Filters, Their most typical painting, Sources |
| Source, gem, flower, film, poem… | ♡ Keep · Share (+ one primary where it exists) | Their own tools |

### 3.7 One search
- **Where:** the top of every ⋯ sheet; a search icon in each place's header (Learn, Train, Museum, Studio); a pull-down on the map. All open one full-screen search.
- **What it finds:** colors (all ~4,300 names and aliases, and hex), paintings, painters, **every collection by name** ("pulp", "photographs", "gems"), ideas and looks, **and features and settings.** Results are grouped, and scope chips sit on top: All · Colors · Paintings · Painters · Collections · Tools.
- **What a result does:** opens its page in one tap. A tool opens the tool (Slideshow starts; "eyedropper" opens Look closer with Pick on). A setting opens Settings at that row. On the map, a color result also flies the map there (as today), so the map's own search behavior is kept.
- **The feature index** (`featureRegister` in js/search.js): every lane registers what it tucked away, with a name, where it lives ("Map · More · Map tools") and the words people use.

### 3.8 One Settings
One sheet (today's `ymSettingsSheet`), grouped: How you see (Color vision and tools, Eyedropper sample size), Feel (Haptics, Quick mode, Idle slideshow), Your progress (Back up, Restore, Retake the placement), About (About the colors, Reset all progress). It's reached from the last row of every ⋯ and from search. The You page's copy of it goes away with You (a merge, not a loss).

---

## 4. Per-surface recommendations

Kind: MOVE · MERGE · TUCK (one tap deeper) · KEEP · REMOVE (only §7).

| Surface | Kind | What changes | Why | Items: before → after |
|---|---|---|---|---|
| Map, left corner | KEEP + label | The glyph becomes a labeled pill, "≡ Places", on the map and every place. It opens Places: "Pick up where you left off", the 5 places, then every collection as a tile, recent first. The map names itself in its caption line. | Trunk test; the corner says what it opens (A1, A2); it never shows a place name, so it can't be confused with a page's place pill | 5 unlabeled capsules → 5 labeled places (+1) |
| Map, right corner | MERGE | Four dots → ⋯. It opens the Map sheet directly; no intermediate stem. | One menu, not a menu of menus (P13) | 5 rows → the sheet itself |
| Map menu › Study the map | MOVE | → Map ⋯ › Map tools › "Learn these names". The lit-set bar keeps "Learn these". | A learn action, used from the map | 1 → 1, one tap deeper |
| Map menu › Favorites | MOVE | → Map ⋯ › Map tools › "Keep colors from the map", and Studio › Kept › Colors › "Pick on the map" | One shelf for kept things | 1 → 2 entries to one feature |
| Map menu › Search | MERGE | → the search field at the top of every ⋯; the pull-down stays | One search | 3 entries → 2 to one search |
| Map menu › Paintings | MERGE | → Colors \| Paintings at the top of the Map sheet, remembered (`S.hm.mode`) | The paintings floor is the map's other layer, not a hidden place (P10) | 1 → 1, visible |
| Colors sheet header icons (Search, Name any color, Surprise me, Slideshow) | MOVE | → labeled rows in Map ⋯ › Map tools (Name any color also stays in Studio) | No private symbols (A1) | 4 icons → 4 labeled rows |
| How many (10 stage chips) | MERGE | → one slider with stage ticks and the count shown ("100 names") | David P12 (sliders over fixed steps); 10 chips that ran off the screen | 10 → 1 |
| Family (10) | TUCK | 6 visible (All, Reds, Blues, Greens, Yellows, Purples) + "+4 more" | ≤6 per group | 10 → 7 |
| Tone, Your words, Collections (the name lists) | TUCK | → ⋯ › More filters (the group is renamed Name lists) | Used less often; still one tap | 18 → 1 row |
| Arrange (5 shapes, 6 orders) | KEEP + TUCK | 5 shape pictures on the surface; 4 orders + "+2 more" | Arrangement is the map's signature; keep it visible | 11 → 10 |
| Look, Magnify, Spacing, Size, Reset, Edges | TUCK | → ⋯ › Look & feel | Set once, rarely changed | 9 → 1 row |
| Colors \| Arrange tabs (white flip) | MERGE | One scrolling sheet: Show, then Arrange. No tabs. | Removes a banned white flip and a choice | 2 tabs → 0 |
| Paintings floor, top | REMOVE + MERGE | The "By color ▾" title menu goes (§7). The place pill and ⋯ replace ‹ when you got there from Places or ⋯; a named ‹ appears when you came from a painting ("On the map"). | A duplicate, and the floor was nameless | 3 → 2 |
| Paintings sheet (176) | TUCK | Arrange: 5 shapes + "+2". Filter: 5 rows (When, Painter, Movement, Country, Museum), each showing its value and opening a picker with the top 6 + search. "More options": Place by, Center on. | ≤6 per group; values visible (P13) | 176 → ~14 visible |
| Paintings card chips (Walk from here, More like this, 1600s, Commons, a color) | KEEP + MOVE | Walk from here and More like this stay as chips. 1600s, Commons and the color become quiet links on the card's second line. The "undefined" text is fixed (§7). | Facts read as facts, not as actions | 5 chips → 2 chips + 3 links |
| Rooms stem inside a room (6) | MERGE | → the same Places menu | One menu | 6 → 5 (+1) |
| Learn | KEEP + TUCK | Strip + "Your next ten" + Learn these (paper), Review (when due), Your families as 9 chips, "More ways to learn ›". The note says "3 yours · 625 to fluent" (from You). | One path (product rule 1); no repeated Train rows | 20 → 13 |
| Learn › Or choose | REMOVE + MOVE | Today's painting, Look and Name it in six go (they live in Train › Today, §7). Make your own deck and Surprise me → Learn ⋯. The two Slideshow rows → one Slideshow in Map ⋯ and Museum ⋯. | Duplicates; the list was a menu of modes in the path | 7 rows → 1 row ("More ways to learn") |
| Train | KEEP + add a hero | "Next for you" (one game at your level) with one paper Play; Today (3); Games as 6 rows with your level; Drills; Your eye | One recommended next (A4, law 4) | 12 → 12 (one more item, but now ranked) |
| Museum pager (5 full-screen lenses) | MERGE | One Museum screen: today's painting (tap → its page; a "Today's picks" row → the For you pager, kept as a page), Recent, then every collection as a tile | Five swipe-only screens hid four of the five, and the dots can't be tapped | 5 screens → 1 screen; every collection 7 → 2 taps |
| Museum › World (a contents page of tiles) | MERGE | Its tiles (Fashion, Pulp covers, Photographs, Flowers & dyes, Gems, Brands) become Museum tiles | "World" doesn't predict pulp or brands | 2 levels → 0 |
| Museum › Ideas (one 41,000 px page) | MOVE | Split into its own collections: Aesthetics (looks + the family tree), Stories, Pigments & ideas, Literature, Films. Each opens its own page, built from the section builders that already exist (`lkSections`, `passagesSection`, `filmsSection`). | One page of 359 controls | 359 → one page per collection |
| Poems, Painters, Movements & decades | MOVE (new doors) | Each gets a tile and an index page: Poems by color word (new, `js/poems.js`), Painters (new index with search, `js/artwiki.js`), Movements & decades (`awIndex`, which exists) | They had no door at all | none → 2 taps |
| Museum › Saved | MOVE | → Studio › Kept (with a "From the collections" filter) | One shelf | — |
| Museum search | MERGE | → the one search (scope chips, including Collections) | One search | 2 searches → 1 |
| Art (→ the Paintings collection) | TUCK | One search field ("A color, a painter, a decade, a mood"); Grid \| Wall \| Map + one Filter button; the Rooms carousel; the grid. The dial, photo and camera "ways in" → Paintings ⋯. River and Painters views → ⋯. 8 filter dropdowns → the Filter rows. Shuffle → Museum ⋯. Tapping a decade's title shows only that decade. | The first screen was 25 controls and the page 48,000 px | 25 → 11 first screen |
| Studio | MERGE | Capture (camera, paper button; "or pick a photo"); Kept (Colors, Paintings, Palettes, Photos); Tools (Name any color, Gamut wheel, Albers). Studio ⋯: Find your color, Find your palette, Export what you've kept. | Absorbs You's personal half | 7 → 10 |
| You | MERGE away | Its rows move: progress → Learn note, eye → Train, kept and taste → Studio, settings → Settings. `#/you` opens Studio. | §3.1 | 16 → 0 (all moved) |
| Practice | REMOVE (dup) | One slider with stage ticks for "which colors" (the chips and −/+ go, §7); one ‹ (no Close: it's a page) | One number, one control | 46 → 37 |
| Color page | KEEP + MOVE | The bar becomes ‹ name · ⋯ · place pill. The actions stay (Learn it · Pair with… · ♡). The hex stays as text; Codes and Share → ⋯. | Already the best page; only the bar changes | 9 → 8 visible |
| Painting page (archive) | TUCK | Bar: ‹ · ⋯ · place pill (the museum link, ♡ and More like this leave the bar). On the image: Pick a color and Look closer stay (the eyedropper is used daily). The chip's "Where" glyph → Look closer › Where, ⋯ › Where each color sits, and a long-press on a chip. Readings: Stands out · By area · Accents (Diverse, Pick from it → ⋯). The slider stays; −/+ go (§7). Actions: Learn these · Keep · Share. On the map, Play → ⋯. | 30 controls above the fold | 30 → 18 |
| Painting page (curated) | TUCK | Same bar and action row as the archive page; More like this leaves the bar for its own section | One painting page, two builders | 10 → 9 |
| Look closer | KEEP + rename | ✕ (top left) → "Done" in the ‹ spot. Tools stay: Value, Squint, Where, Pick, Region. | ✕ meant three things | 6 → 6 |
| Set / pair page | TUCK | Learn · Keep · Share. "Add a color" → a "+" swatch at the end of the swatches. The per-row drag and remove handles → ⋯ › Edit (or a long-press on a swatch). | 21 visible, 6 of them handles | 21 → 12 |
| Painter page | MOVE | Compare leaves the bar for the action row: Compare · ♡ Keep · On the map | Bar holds navigation only | 10 → 10 |
| Trail: Close pill | MERGE | → the place pill, named for the trail's start | Says where it goes | — |
| Trail: "Back to…" pill (8 s) | MOVE | → "Pick up where you left off" at the top of Places, until a new trail replaces it | A timed pill is easy to miss; the trail must not feel lost (David 2026-10-09) | 1 → 1, persistent |
| Trail: pull-down from the top | KEEP | = the place pill | Gesture = button | — |
| Trail: long-press ‹ | KEEP | The trail sheet, as now | An accelerator, the iOS convention | — |
| A room's dimmed floor strip | KEEP | Still goes to the map | Harmless; the Places pill is the taught way | — |
| Settings | MERGE | One sheet from every ⋯ and search | One settings place | 2 copies → 1 |

---

## 5. Wayfinding

**Where am I?**
- **Places say their name** in a title-1 at the top; the map, which has no header, says it in its caption line ("Map · hue across, light to dark down"), the trunk-test fix for the landing screen. The Places menu marks the current place "Here".
- **Pages say what they are:** the eyebrow ("Color", "Painting · 1434") and the title that matches the tap that opened it (A3).
- **The bar says where each exit goes:** "‹ Periwinkle", and the place pill "Museum".
- **Places have icons, not colors:** Map (bubbles), Learn (cards), Train (eye), Museum (frame), Studio (brush), one icon family (B4). Color stays for content (VISUAL-DIRECTION law 1); the Places menu art is live content (today's due colors, today's painting).

**A reliable way home.** From any page: the place pill (one tap) returns to where you started; from any place: the Places pill → Map (two taps). Every place and every collection is two taps from anywhere you can see the Places pill, and nothing is lost: "Pick up where you left off" brings the last pile of pages back.

**The trail, made understandable.** Three ideas instead of nine controls: **‹ is one step back** (and says to what), **the place pill closes the pages**, and **Pick up where you left off** reopens them. Every gesture maps onto one of these. The long-press sheet stays for people who discover it.

**First run, in 3 steps.** One line each; any tap dismisses; it never comes back once done (stored in `S.orient`). Prototype: `?s=first`.
1. **The live map,** with one bubble breathing near the thumb: "Tap any color." (The toy first: DESIGN-CANON §4.5.)
2. **On its page:** "‹ goes back a step. The name on the right takes you back to where you started."
3. **Back on the map,** the Places pill glows once: "Learn, Train, Museum and Studio are in here, and every collection." Learn's row carries "Find my level · 60 sec" until the placement is done.

The current welcome screen (a static grid, a paragraph and a button) goes away as a screen; "Find my level" becomes Learn's paper button for a new user. That's a MOVE, and the placement test itself is unchanged.

---

## 6. Where everything went (nothing is lost)
| Was | Now |
|---|---|
| Map menu › Study the map | Map ⋯ › Map tools › Learn these names · the lit-set bar's Learn these |
| Map menu › Favorites (pick on the map) | Map ⋯ › Map tools › Keep colors from the map · Studio › Kept › Colors › Pick on the map |
| Map menu › Search · pull-down | ⋯ › search (every screen) · pull-down (map) |
| Map menu › Colors & Arrange | Map ⋯ |
| Map menu › Paintings | Map ⋯ › Colors \| Paintings |
| Colors sheet › Name any color · Surprise me · Slideshow | Map ⋯ › Map tools (and Studio › Tools for Name any color) |
| Colors sheet › Tone · Your words · Collections | Map ⋯ › More filters |
| Arrange › Look · Magnify · Spacing · Size · Reset · Edges | Map ⋯ › Look & feel |
| Paintings sheet › Place by · Center on | Map ⋯ (Paintings) › More options |
| Paintings sheet › Country · Movement · Museum · Painter lists | Map ⋯ (Paintings) › Filter rows → pickers with search |
| Rooms › You | Studio (Kept, taste), Learn (yours count), Train (your eye), Settings |
| Museum › For you | Museum › today's painting · "Today's picks" (the pager, as a page) |
| Museum › Art | Museum › Paintings (and Poems gets its own tile) |
| Museum › Ideas | Museum › Aesthetics · Stories · Pigments & ideas · Literature · Films |
| Museum › World | Museum › Fashion · Pulp covers · Photographs · Flowers & dyes · Gems · Brands |
| Museum › Saved | Studio › Kept |
| Museum search | The one search (scope chips) |
| Colors sheet › Collections (name lists) | Map ⋯ › More filters › Name lists |
| Art › Any color · Type · Photo · Camera | Paintings page search field · Paintings ⋯ › More ways in |
| Art › Color · When · Painter · Mood · Palette · Museum · Country · Movement dropdowns | Paintings ⋯ › Filter |
| Art › Shuffle | Museum ⋯ › Shuffle a painting |
| Art › River · Painters views | Paintings ⋯ › Views |
| Learn › Make your own deck · Surprise me | Learn ⋯ (and "More ways to learn") |
| Learn › Slideshow (×2) | Map ⋯ › Map tools · Museum ⋯ (one Slideshow, with "start from today's color" as its first choice) |
| You › Settings rows | Settings (every ⋯, search) |
| You › Find your color · Find your palette | Studio ⋯ · search |
| Painting › museum link ("Chicago") | Painting ⋯ › Full size at the museum |
| Painting › Pick a color (on the image) | Stays on the image · also Look closer › Pick · long-press the picture |
| Painting › chip "Where" glyphs | Look closer › Where · long-press a chip |
| Painting › Diverse · Pick from it | Painting ⋯ › Read the colors |
| Painting › On the map · Play | Painting ⋯ › Go |
| Set › Add a color · drag · remove | A "+" swatch · Set ⋯ › Edit · long-press a swatch |
| Painter › Compare (top bar) | The painter's action row |
| Close pill · map glyph | The place pill |
| "Back to…" pill | Places › Pick up where you left off |

---

## 7. Removals for David's approval
Only true duplicates (a second path to the identical thing; the better one stays) and broken controls.

| # | Remove | The one that stays | Why |
|---|---|---|---|
| R1 | The paintings floor's "By color ▾" title menu | Map ⋯ (Paintings) › Arrange | Same shapes, two places |
| R2 | The painting page's −/+ beside the How many slider | The slider, with its value shown | One number, one control (P12) |
| R3 | Practice's "First 25 … First 1,000" chips and its −/+ | One slider with stage ticks | One number, three controls |
| R4 | "Only 1270s" on each of the 60 decade sections in Art | Tap the decade's title (or the When filter) | 60 buttons that repeat a filter |
| R5 | Learn › Or choose: Today's painting, Look, Name it in six | Train › Today | The same three boards in two rooms |
| R6 | The second Slideshow row ("starting with today's color") | One Slideshow whose first screen offers "from today's color" | Two rows for one feature |
| R7 | You › Odd one out profile | Train › Your eye | Same profile |
| R8 | The Museum's own search sheet | The one search | Two searches |
| R9 | The Close pill, the map glyph and the "Back to…" pill as separate controls | The place pill and "Pick up where you left off" | Replaced, not lost |
| R10 | Practice's Close (beside its ‹) | ‹ | Two exits on one header |
| Broken | The "undefined" text on the paintings card (`js/paintmap.js` card markup) | — | A bug |
| Broken | The white-flip selected tab on Colors \| Arrange (`.hm-ch-tab` selected style) | The tabs go away in the merged sheet | A banned pattern |

---

## 8. Rules for every future screen (put these in DESIGN-CANON)
1. A screen is either a **place** (Places pill bottom left, ⋯ bottom right) or a **page** (the top bar). Nothing else floats.
2. **≤3 actions** on the surface, **one paper button**, everything else in ⋯.
3. **⋯ anatomy is fixed:** search, this screen's groups, Settings.
4. **Groups show ≤6 options;** the rest behind "+N more".
5. **Every tucked feature registers in search** (`featureRegister`), with its words.
6. **One word per concept** (§3.2). A new name needs a row in that table first.
7. **No duplicate path on the same screen;** across screens, only when it's the same feature opening from its own context (Learn it on a color, Learn these on a painting).
8. **The bar never shows two buttons that do the same thing** (the place pill hides when ‹ leads there).
9. **Every exit says where it goes.**
10. **Run the trunk test** on every new screen: app, page, place, way back, search.

---

## 9. Build lanes

### Day-0 contract (Lane 1's first commit, before the others start)
So lanes 2–4 can build in parallel without touching Lane 1's files:
- `js/core.js`: `NAV = { map: "Map", learn: "Learn", train: "Train", museum: "Museum", studio: "Studio" }` (the Museum's internal id stays `explore`, so saves and old addresses keep working) and `KEEP = { verb: "Keep", done: "Kept" }`. `NAV_MAP` becomes "Map"; `ROOMS_LIST` loses You.
- `js/places.js`: `placesOpen()`; `moreRegister(ctx, () => groups)`, where a group is `{ title, note?, items: [{ t, n?, icon, run } | { chips: [...] } | { html }] }`; `moreOpen(ctx)`. The sheet adds the search field on top and Settings at the bottom by itself.
- `js/search.js`: `searchOpen({ q, scope, from })` and `featureRegister(id, { t, where, words, run })`.
- `js/collections.js` (stub by Lane 1 with the list in §3.1, then owned by Lane 3): `COLLECTIONS = [{ id, t, count, group, pic, open }]`, `collOpen(id)` (records `S.recentColl`), `collRecent()`. The Places menu reads it.
- `js/pagekit.js` (stub by Lane 1, then owned by Lane 4): `pageActions(el, [{ t, icon, primary, run }])`, which refuses a 4th action in dev with a console warning.
- **Lazy wiki:** `js/collections.js`, `js/search.js` and the Places grid must not read `window.WIKI_*`, `STORIES` or other lazily loaded data at load time. Tiles and results that need it render a quiet placeholder and fill in after `loadWiki()` (or are opened through `needsWiki()`-wrapped screens), per CLAUDE.md's lazy-wiki rule. The tile pictures themselves come from small files that ship with the registry.
- `index.html`: the new script tags. The `?v=` bump happens once, at merge.

### Lane 1 · Chrome & wayfinding (Sonnet)
- Places menu (`toggleStem` → `placesOpen`), opened by a labeled "≡ Places" pill on the map and every place (it never shows the current place's name): "Pick up where you left off" (from `TL_RECENT`, replacing `tlRecentPill`), the 5 places, then the collections grid from `COLLECTIONS` (recent first, 3 per row). The Places pill shows the place's name.
- The page top bar in `tlDecorate`: named ‹ (from `TL_META`'s title), ⋯, the place pill named for `X_ROOT` and hidden when ‹ leads there. Pull-down = the place pill.
- One search: merge `home.js`'s `openSearch` behavior (fly to a color on the map) and `exploreSearchSheet` (kinds, results) into `js/search.js`; the feature index with Lane 1's own entries (Settings rows).
- A search icon in every place's header (Learn, Train, Museum, Studio), opening `searchOpen()`.
- Settings: `ymSettingsSheet` reachable from every ⋯; fold You away (`#/you` → Studio); move `ymBubbleArt`/`ymNote` users.
- Renames (§3.2) in `router.js` titles and `TL_KIND`; new aliases `#/map`, `#/learn`; keep every old address working.
- First-run orientation (`js/orient.js`, `S.orient`), replacing `welcome()` as a screen (placement unchanged).
- Smoke: the nav group (Places opens, ⋯ opens on a place and a page, search finds "slideshow", the place pill returns to the origin, Pick up where you left off restores the trail).

### Lane 2 · The map (Sonnet)
- **First, a one-line rename that is easy to miss:** the arrangement called "Map" becomes "Grid" (labels only; `HONEY_ARR` ids unchanged), because "Map" is now the home's name.
- Remove `doMenu`'s stem; the right corner becomes ⋯ → `moreOpen("map")`. Register the Map groups: Colors \| Paintings, How many (slider with stage ticks), Family (6 + more), Arrange (5 shapes, 4 orders + more), and rows for More filters, Look & feel, Map tools (sub-pages inside the sheet).
- The paintings layer: no title menu (R1); place pill + ⋯ when reached as home, named ‹ when reached from a page; ⋯ (Paintings) groups: Arrange, Filter rows with pickers, More options; card fix (the "undefined"), chips → 2 + facts as links.
- Register map features in search (Slideshow, Surprise me, Name any color, Look & feel, each arrangement and order).
- Smoke: the home group (every sheet path), Paintings layer switch and back.

### Lane 3 · The four places (Sonnet)
- Learn: remove the Or choose duplicates (R5, R6), "More ways to learn" → Learn ⋯; the "yours" note from You; "Find my level" as the new-user paper button.
- Train: "Next for you" hero + Play; Today; Games as rows with levels; Drills; Your eye (R7).
- Museum: `js/collections.js` (every collection's tile, picture, count and `open`, wired to what exists: `pulpGrid`, `photographyGrid`, `bdBrowser`, `gmListPage`, `btListPage`, `fashionPage`, `awIndex`, `agOpenRoute`…); the Museum screen (today's painting, Recent, grouped tiles); the For you pager kept as a page; the Paintings page (search field, Grid \| Wall \| Map, Filter → ⋯); the Ideas lens split into Aesthetics, Stories, Pigments & ideas, Literature and Films pages (from the existing section builders); Saved → Kept; `exploreSearchSheet` → `searchOpen({ scope })` (R8); register every collection in search.
- Studio: Kept (one shelf, kinds as rows), Tools, taste in Studio ⋯. `favs.js`: rename to Keep/Kept in every string; data keys unchanged.
- Practice: one slider (R3), one ‹ (R10).
- Curated `paintingPage` and `colorPage` live in `explore.js`: apply Lane 4's `pageActions` and bar rules there (Lane 3 owns the file; Lane 4's helper does the work).
- Smoke: the rooms group.

### Lane 4 · Pages (Sonnet)
- `js/pagekit.js`: `pageActions` (≤3), and the ⋯ group helpers for pages.
- Color page (`richpage.js`): register ⋯ (Find it in paintings, See it on the map, Test yourself, Codes, Share). The action row stays.
- Painting page (`gallery.js`): the bar stripped to navigation; Pick a color and Look closer stay on the image; the "Where" glyphs → Look closer, ⋯ › Where each color sits, and a long-press on a chip; readings 3 + ⋯; slider without −/+ (R2); Learn these · Keep · Share; ⋯ groups (Look, Read the colors, Go).
- Look closer (`paintzoom.js`): ✕ → Done in the ‹ spot.
- Set page (`setpage.js`): Learn · Keep · Share; "+" swatch; Edit in ⋯ and on long-press.
- Painter (`artwiki.js`): Compare · Keep · On the map in the action row.
- Register page tools in search ("eyedropper", "value", "squint", "where").
- The two collections with no index today: Poems (`js/poems.js`: browse by color word, with search) and Painters (`js/artwiki.js`: the 840, by their colors, with search). Lane 3's registry points at them.
- Smoke: the pages group.

### Order and merge
1. Lane 1's day-0 commit (contract + stubs) → 2. Lanes 2, 3 and 4 in parallel, with Lane 1 finishing its own work → 3. Merge in order 1, 2, 3, 4, running `tools/smoke.sh` and the check scripts after each → 4. 440×956 and 375×812 screenshots of every surface in §4 → 5. A fresh-context craft critique (CRAFT-RUBRIC) and the trunk test on six random screens → fix → ship.

**Smoke ownership:** `tools/smoke/scenarios.js` is shared, so each lane edits only its own group (nav → 1, home → 2, rooms → 3, pages → 4). Today's scenarios that open `#hmDo` and `.hm-do-stem` must move to the ⋯ sheet in the same lane commit that removes the stem (Lane 2).

**Risks**
- **Muscle memory:** David uses the right-corner stem daily. Mitigation: the ⋯ sheet opens with Colors | Paintings and the controls he uses most on top; "Paintings" stays one tap from the corner (the switch).
- **Hiding Studio's camera behind a place:** it's still the place's paper button, and search finds "camera".
- **Merging You:** veto option in §3.1.
- **One search that does too much:** scope chips, and colors first on the map.

---

## 10. Fresh-context critique and revisions
A fresh-context critic (Sonnet) read DAVID-MODEL, DESIGN-CANON §5, this plan and the six before/after shots, ran the 12 David-critic questions and the four personas, and walked five first-time tasks. **Verdict: REVISE.** What it found, and what changed:

| # | Finding | Revision |
|---|---|---|
| 1 | Renaming "Museum" (and the map's "Explore") the day after David chose them risks P21. | **The place keeps the name Museum.** Only the lenses inside it go (§3.1). "Collections" stays an option, one constant away. The map is still called Map, because "Explore" collided with the Museum's own id and addresses; it's listed in §11 for David's veto. |
| 2 | Tucking Pick a color inside Look closer turns a daily 1-tap action into 2. | **Pick a color stays on the picture,** beside Look closer. Only the six small "Where" glyphs move. The painting surface is 18 controls, not 17. |
| 3 | The bottom-left pill showing the place's name ("≡ Map") and the page's place pill ("Map") look alike but do opposite things. | **The bottom-left pill always says "≡ Places".** Only the page's exit pill shows a place name. The map names itself in its caption line instead. |
| 4 | The Places sheet, with every collection under the places, could be the new overstuffed menu, and it breaks the plan's own ≤6 rule. | **Kept, with the rule made explicit (§3.4):** ≤6 applies to choices; a directory of destinations shows them all, recent first, below the 5 places. A collection you can't see from home is the exact problem David named. The critic's alternative (Recent + "All collections ›") is the fallback if the grid feels heavy on a real phone. |
| 5 | Search loses its visible icon if it only lives inside ⋯. | **A search icon sits in every place's header** (Learn, Train, Museum, Studio), plus the ⋯ field and the map's pull-down. |
| 6 | The day-0 contract ignores the lazy-wiki rule. | **Added to the contract (§9):** the registry, search and the Places grid never read lazily loaded data at load time. |
| 7 | "9 ways back → 3" overstates it, since long-press and pull-down stay. | **Reworded:** 3 ideas, 5 ways in, each gesture mapped onto a button. |
| 8 | The "Map" → "Grid" arrangement rename is easy for a lane to miss. | **Moved to the top of Lane 2's list.** |

**The five first-time tasks, after revision**
| Task | Taps | Doubt |
|---|---|---|
| Find pulp covers | 2 (≡ Places, Pulp covers) | None: the tile is visible when the sheet opens, and recent ones lead |
| Show paintings on the map instead of colors | 2 (⋯, Paintings) | None: it's the first control in the sheet |
| From Color › Painting › Color, back to the map | 1 (the "Map" pill) | Small: ‹ says "Water Lilies" and the pill says "Map", so the words tell them apart |
| Turn off haptics | 3 (⋯, Settings, the switch), or search "haptics" (3) | Knowing Settings sits at the bottom of ⋯; taught by the same anatomy on every screen |
| Find the eyedropper on a painting | 1 (Pick a color on the picture) | None |

**Kept as the critic asked:** every collection two taps from a place; one sheet pattern for every menu; "Pick up where you left off" instead of the 8-second pill; sliders instead of chip rows and −/+.

---

## 11. Decisions for David
1. **Approve the removals in §7** (true duplicates and two bugs), or veto any one.
2. **Studio absorbs You** (§3.1), or keep You as a fifth place for Kept and Settings.
3. **The home is called "Map"** on screen (today "Explore"), or keep "Explore". The rest of the plan works either way; it's `NAV_MAP`.
4. **The place stays "Museum"** (recommended), or rename it "Collections".
5. **Every collection in the Places sheet** (recommended), or only Recent plus "All collections ›" (3 taps for the rest).
