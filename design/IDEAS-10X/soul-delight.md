# Ideas 10×, round 2: soul and delight (the whole-app layer)

Area: the soul and voice, visual identity, motion, sound and haptics, the daily ritual and retention, sharing, the You page, accounts and percentiles, accessibility, performance and offline, SEO, the business, and the app's name.

Read for this: CLAUDE.md, MASTER-PLAN-2026-10-08, GENIUS-PANEL-1, REQUESTS-LEDGER (including all 29 rejections), DESIGN.md, DESIGN-SYSTEM.md, HANDOFF, ROADMAP §1, §6, §9–11, NOTES-TRACKER "Later". In the code I read index.html, manifest, sw.js, core.js (buzz, state), challenge.js, the daily color and share card in explore.js, camera.js, naming.js, lookalikes.js, learn.js `home()`, loader.js, and app.css plus css/* for the tokens and leftovers.

**Builds on round 1, doesn't repeat it.** Genius Panel 1 already proposed these, so they appear here only as dependencies: one share-card renderer, fly to the map, Color DNA, the merged You page, the painting of the day, the relation mark, and "name it before the camera does".

---

## 0. Two conflicts to settle before anyone builds (round 1 against David's rejections)

1. **The honeycomb must not dim or mark.** Round 1's L18 "Your map" ("Yours lit, met outlined, unmet dim, mix-ups threaded") and L12's relation mark "on the honeycomb" both break X7. David said progress marks on bubbles are "a bad idea cuz then honey comb won't look as cool", and DESIGN.md says true colors only, no rings, no dimming. **Resolution:** progress on the map stays a *view* (the existing Learned / Learning / New filter). The relation mark can live on chips, palettes, the Cabinet and lists, but never on honeycomb bubbles. Everything in this file follows that.
2. **Duels are deferred (X3, "duels we can think of later").** Every social idea below is asynchronous: a link, a gift, or a shared daily seed. None is head-to-head or real-time. Idea 10's "mystery swatch" is the closest thing to a duel, so it's marked "ask David first".

---

## 1. Diagnosis: what's boring, thin, confusing or ugly today

**Soul and voice**
- The soul is written down (CLAUDE.md, the master plan) but the app doesn't speak it. The manifest, `<meta description>` and OG text still say "Learn the names of colors, one family at a time": the family-by-family idea David called boring (X22). The first thing a stranger reads about the app is the rejected version of it.
- Verdict copy is generic quiz-app talk: "A perfect *eye.*", "Sharp *eyes.*", "Good *start.*", "Tough *one.*" It could be any trivia game. Nothing in it says what you just *saw*.
- The camera still says "A lesson word" and "Nearest lesson word", the 101-as-a-special-list framing David rejected (X19), now in its third place.
- **ΔE is presented as a percent** ("3.0% different"; "about 1% is the limit for most eyes"). ΔE00 isn't a percentage of anything, so this is the one place the "measure, then tell" voice tells a small untruth. (`pctFmt`/`pctDiff` in core.js.)
- **Dead end:** after the 101, Learn says "The path is *complete*. More tiers are coming." For a retention product that's the worst sentence it can show: the day you're most invested, it tells you to leave.

**Visual identity**
- The logo and app icon (`LOGO` in core.js, `icon.svg`) are a **fan deck of four paint strips** in red, amber, green and azure. That's the paint-chip family David rejected as the signature (X25), drawn in near-primary colors that read as the "RYB primaries" myth or a Google logo. Meanwhile the app's real signature, the bubble that grows into its page, appears nowhere in the identity.
- `theme-color` and the manifest use `#121212`, but the ground is `#0E0D0B`. The status bar and splash are a different black from the app.
- Rejected glass survives in five places, along with uppercase mono labels: `.xp-search` (Explore covers), `.eye-hint` (camera, which is also uppercase), `.gl-badge` (gallery, also uppercase), `.glass-box` (honey.css) and `.pm-view` (poems). The share card draws "COLOR OF THE DAY · …" in uppercase Geist on `#121212`, against DS §4 and §3.
- The share card draws text without waiting for the web fonts, so on a cold start it can render in Georgia or system sans.

**Motion, sound, haptics**
- Haptics are good plumbing (the iOS switch trick in `buzz`). Motion has a spec (DS §8). Sound doesn't exist. The moments David approved (lesson complete, a color owned, level up) aren't built, so the one time the app should feel like something, it shows a toast or nothing.

**Daily ritual and retention**
- The daily set is a 6-round odd-one-out, a name quiz on today's color, and a Train tile. Two of the three are tests and none of them faces outward: nothing asks you to look at the world today.
- **The color of the day draws from `ALL`, the 101 unit colors** (`dailyColor` in graph.js). The archive has ~3,700 names, 23,531 paintings and 29 books, and the daily color cycles through 101 swatches, repeating within four months.
- Streaks: only the challenge has one ("3-day streak"), counted per feature. There's no rhythm that survives a weekend away without guilt.
- Nothing happens in the evening, and nothing turns today into something you keep.

**Sharing and social**
- The challenge shares **🟩⬛ squares**, a Wordle clone that throws away the one thing we have: the colors. The six colors of the round are known, and the share hides them.
- The color-of-the-day card is a swatch plus a name. Any palette site makes that. It teaches nothing, so it spreads nothing.
- No gift or link format exists for a palette, a painting reading or a verdict.

**You page, accounts, percentile**
- "You" is split across Your eye (challenge.js), taste (taste.js), the quilt in Learn, and Studio photos (round 1 already said: merge). Nothing records *your history with a color*: when you met it, where, when it became yours.
- World percentile (T7, Bz4) is parked on "needs a backend". There's an honest version that needs almost none (idea 14).

**Accessibility**
- No idea anywhere serves the roughly 1 in 12 men with red-green color vision deficiency, though a color-*naming* app is unusually useful to them (camera naming is assistive tech).
- Type sizes are fixed px. Larger text breaks the expensive layouts instead of scaling them.
- Swatches have aria labels in many places, but nothing conveys a painting's or palette's *lightness structure* without sight.

**Performance and offline**
- First load is **58 blocking requests and ~1.3 MB of uncompressed JS and CSS** (38 scripts, 20 stylesheets), plus Google Fonts from another origin.
- The service worker only caches what you've already fetched, ignores cross-origin requests (so no fonts and no Wikimedia images), and precaches nothing. "Works offline", as the install card promises, really means "works offline for screens you've already opened, in fallback fonts".

**SEO**
- Static pages exist for **101 colors** and ~99 stories. Not one exists for the ~3,700 names, the 837 painters or the 23,531 paintings: the content nobody else has.
- Pages have OG tags but no structured data, and no answer-first sentence for "what color is puce".

**Business**
- Nothing is defined: what is free, what Plus is, or what the print shop sells. The sister's affiliate idea is in NOTES-TRACKER with no rule for what must never be paywalled.

**The name**
- "ColorHub" is already taken twice: an App Store app ("Color Hub", handpicked colors) and a web palette tool (ColorHub, 150 palettes for web designers). "Hub" says aggregator or SaaS, invites an obvious adult-site association, and says nothing about *seeing*. See §7.

---

## 2. North star

At 10×, the app has one voice and one object. **The voice is a curator who birdwatches:** exact names, measured claims, wonder that's true, and a habit of pointing out the window. **The object is the bubble:** a named disc of color that grows into its page, which is also the logo, the icon, the share card's shape and the stamp on everything you own. **The ritual has two beats.** In the morning the app hands you one color from the whole archive and tells you where to look for it. In the evening you hand it back three colors you saw, by name, from memory. Over a year those evenings become a calendar of your life in named colors, which you can print. Every share teaches one true thing, so it's worth forwarding. Every number you're shown, from your eye threshold to your percentile on today's shared board, is one we can defend. The business sells making (posters, exports, real pigments), never seeing. And it's fast, readable at any text size, and useful to people who can't tell red from green, because a color-naming app should be.

---

## 3. Ideas, ranked (25)

Format: what it is · why it's 10× · **Connects** · effort · honesty risk.

### 1. ★ Your year in color (the evening three)
Each evening, one quiet prompt: "Three colors from today." You type the names from memory (or pick from a photo you took), and they become three thin stripes on today's square. A month becomes a 31-square calendar, a year a 365-square poster of your life in named colors.
- **Why 10×:** It's the missing second beat of the daily ritual. It faces outward (you had to *notice* to answer) and it's production practice (typing a name from memory is the strongest recall the KB lists). It's beautiful by accident, because people's months really do shift with the seasons. It's a reason to come back tomorrow that isn't a streak.
- **Connects:** Learner Model (each typed name is a `recall_ok` or `met`, and an unknown word becomes a "new to you" with Learn it), the Journey (diary words seed world steps: "you saw *sage* on Tuesday"), Studio (your month as a palette, with the ColorSet verbs: `toSet()` and on to Studio), the print shop (idea 19, the year poster), the share renderer (the month card), the map (the month as a constellation, as a *view* only).
- **Effort:** S for v0 (§6, spec 3), M for the month and year views plus photo picking.
- **Honesty:** a diary, not a measurement. Say nothing about mood or personality from its colors (the myth list forbids "colors = emotions").

### 2. ★ Settle it (the argument-ender)
Point the camera, or open a photo, and tap the couch, the dress or the car. You get a verdict card: "It's **petrol**, not teal: darker and bluer, 6 steps apart," with the photo crop, the three nearest names and their direction words. Share it as an image.
- **Why 10×:** People argue about color names constantly ("that's not navy, that's teal"). It's the most viral honest use of the naming engine. Every verdict teaches one boundary between two neighbors, which is exactly how CLAUDE.md says words are learned.
- **Connects:** the camera, the naming engine (`nameOf`, `lookDiff`), color pages (every chip opens its page in one tap), Learner Model (`seen` with `surf: "camera"`; "settled" pairs become look-alike reviews), the share renderer, Train (a "Settle it" pair becomes a 5-trial duel board, the GP1 L5 mechanic).
- **Effort:** S for v0 (§6, spec 2).
- **Honesty:** "As your camera sees it." Cameras, light and screens shift color, so offer white balance on the card. Never claim the *object's* true color.

### 3. ★ The name hunt (the daily word game: Colordle, done our way)
One hidden color a day from the full ~3,700 names. You guess *names* (with autocomplete from the core list). Each guess paints its own swatch and says how far it is and which way: "lighter, and bluer, 14 steps". Six guesses. The share is a row of your guesses' real colors closing in on the target, with the target hidden.
- **Why 10×:** Existing color-guess games are about hex or mixing. This one is about *names*, which is the app's whole thesis, and the feedback teaches the neighborhood map (direction words, the same vocabulary as `lookDiff`). The share spoils nothing and is genuinely pretty, a gradient converging on a color.
- **Connects:** the naming engine, Learner Model (every wrong guess is a logged confusion with direction, the most valuable data GP1 named), the map (your six guesses plotted as a path on the honeycomb after the reveal), the article for the answer (the reveal opens its page), the Journey (the answer becomes a "new to you" if you didn't know it).
- **Effort:** M.
- **Honesty:** the answer pool must be solvable. Use only names whose nearest neighbor is at least ~3 steps away (the `shownDE` gate), so the game never hinges on a near-duplicate.

### 4. ★ Provenance: every color you own has a history like a museum object
When a color becomes Yours (the delayed check), it's **stamped** into your field notebook: a 700 ms press of the bubble into a paper page, the date, and its provenance line, "First met 3 Oct in Whistler's *Nocturne*; mixed up with lavender twice; yours since 9 Oct". The color page's hero note shows the same line.
- **Why 10×:** It turns the one honest number (Yours) into a *collection of stories about you and color*, which is how a curator thinks. It's the "color owned" moment ROADMAP §11 asked for, made of real content instead of confetti.
- **Connects:** Learner Model (`lmStatus`, `lmSeen`, `lmPairs` give the whole line), the Cabinet (the stamp is the card's front), color pages (the hero note), the You page (the notebook *is* the page), the share renderer ("Yours since…" card).
- **Effort:** M. It needs L19 `learner.js` first. The stamp animation alone is S.
- **Honesty:** provenance only from logged events. For anything older than the log, say "before 8 Oct", never invent a first meeting.

### 5. ★ "Teal vs turquoise" pages (the contrast pages)
Static pages for every confusable pair in the look-alike graph. Each has an answer-first sentence ("Teal is darker and greener than turquoise; they're 9 steps apart"), the two swatches side by side, the paintings where both appear on the same canvas, each word's first recorded date, and a "Learn the difference in 2 minutes" button that opens Learn it.
- **Why 10×:** "X vs Y" is how people actually search for color ("taupe vs greige", "navy vs midnight blue"). Contrast is how CLAUDE.md says the words are learned, and nobody else can show "paintings where both sit side by side".
- **Connects:** the Color Graph (look-alike and *confusable* edges), Learn it, painter pages (co-occurrence), articles (each side's article), Learner Model (the in-app version shows "you've mixed these up 3 times").
- **Effort:** M (`pages.py` gets a `vs/<a>-<b>/` template; around 2–4k pairs).
- **Honesty:** computed facts only, labeled. Hex values are approximations, and the page says so.

### 6. The life list and the big day (birding for color)
Birders keep a *life list* of every species they've seen. Yours is every named color you've *found in the world*: named first, then confirmed by the camera, dated, with a small crop, and no location unless you opt in. A **big day** is an opt-in Saturday game: how many distinct named colors can you find before midnight?
- **Why 10×:** It gives "learn by seeing" a hobby's shape, with a second honest number beside Yours. It's real-world practice at a pace you choose, and everyone understands it in one sentence.
- **Connects:** the camera (guess-first, GP1 #7), Learner Model (`found`), Journey missions (a find passes a mission), the Cabinet (a *Life list* drawer), the evening three (a find can be one of today's three), the map (life list as a view).
- **Effort:** M.
- **Honesty:** a find counts only when *you* named it first (GP1 guardrail). Rarity, if shown, is "uncommon in the archive's paintings", never "rare in the world".

### 7. Hear the value (the app's sound)
The app's one sound language maps **lightness to pitch**: lighter sounds higher, which is one of the most consistent cross-sensory matches people make in experiments. Bubbles crossing the honeycomb's center tick at their own pitch, so panning plays the map. A painting can be "played" left to right as its value structure. Lesson complete is a chord built from the lesson's colors' lightness. Off by default, one switch in View.
- **Why 10×:** Sound that *teaches value* instead of decorating. The squint test becomes something you can hear, and it's real accessibility for low-vision users.
- **Connects:** the honeycomb, Train's value stations (an eyes-closed "which is lighter?" round), painting pages (the squint key, GP1 L12), the moments pass (ROADMAP §11).
- **Effort:** S for the ticks and the chord (Web Audio, no files). M for painting playback.
- **Honesty:** say plainly that lightness-to-pitch is a widely shared association, and that hue has no natural note. No synesthesia claims, and no "each color has a sound".

### 8. The color-blind ally
A first-class mode for people with color vision deficiency, chosen once, never a diagnosis. The camera leads with names and confusion warnings ("this may look like the brown next to it"). Color pages show "how this pair looks to deuteranopes". Palettes get a CVD-safe check. Train skips boards that rely on an axis you can't see, and says so.
- **Why 10×:** Tens of millions of people need "what color is this?" answered daily, and we already have the best naming engine and a camera. It turns accessibility into an audience instead of a checkbox.
- **Connects:** the camera, color pages, Studio palette critique (ROADMAP §8), Train (solvability per viewer), the Learner Model (`lmWeak` already finds weak axes).
- **Effort:** M.
- **Honesty:** never screen or diagnose. Simulations are approximations (Brettel or Viénot, labeled). The DESIGN.md caveat about the old "simple adjustment" applies.

### 9. Postcards: share cards that teach one true thing
The content spec for round 1's single renderer. Every card is the bubble shape plus one sourced or measured fact. Color: "First recorded in English in 1802" plus a crop of the painting where it covers the most canvas. Challenge: the six real colors, not 🟩⬛. Palette: names under each plate. Painting: its three-stop guided look. Verdict: idea 2.
- **Why 10×:** A card that teaches is a card people forward. It also passes the one-sentence test: the person who *receives* it sees more color.
- **Connects:** the share renderer, articles and fact cards (the fact line), painter pages (the crop), the challenge, Studio palettes, the Cabinet.
- **Effort:** S for v0 (§6, spec 1).
- **Honesty:** one fact per card, from the fact-card store or the computed field notes. Label "as photographed" on archive numbers.

### 10. Gift a color, gift a palette (no backend)
A link that *is* the gift: `#/gift/teal` or `#/gift/p/<hexes>`, plus an optional first name. It opens straight into a 60-second meet-and-recall of that color (or a palette's names), ending with "Mira sent you this. Now go find it." A palette gift opens as a ColorSet with every verb.
- **Why 10×:** A personal reason to send the app that teaches the receiver something in the first minute. Zero servers.
- **Connects:** Learn it (the composer), ColorSet (`toSet` and its verbs), the share renderer (the link preview), the Cabinet (a received gift lands in a *Gifts* drawer).
- **Effort:** S.
- **Honesty:** the name is optional and only in the link the sender chooses to send. A variant, the **mystery swatch** ("what's the name of my couch's color?", where the friend guesses before the reveal), is duel-adjacent: **ask David first (X3)**.

### 11. A week kept, not a streak
Replace per-feature streaks with one rhythm: **a week is kept when you saw color on 5 of 7 days**. "Saw" means a real recall, a find or an evening three, not just opening the app. Weekends off are built in, and nothing ever turns red.
- **Why 10×:** The same pull as a streak without the dread. It counts *seeing*, so it can't be gamed by opening the app.
- **Connects:** the challenge, the evening three, the life list, Journey lessons, the You page (a year of kept weeks as a quiet ring of 52 ticks).
- **Effort:** S.
- **Honesty:** no loss notifications. Never "your streak will die".

### 12. Our promises (the covenant page)
One short page, linked from View and the You page: no ads; no selling your data; your photos stay on your phone; progress means what you remember a day later, not taps; no countdowns, hearts or lives; we say "as photographed" and "origin undocumented" when it's true; myths only to correct them.
- **Why 10×:** It turns the honesty rules into identity, and it's a trust signal for parents, teachers and the color-blind audience.
- **Connects:** the soul, every honesty guardrail (GP1 §8), the business (it constrains Plus), accounts (data terms).
- **Effort:** S.
- **Honesty:** only promise what's built. Rewrite it when accounts arrive.

### 13. Today in color (an almanac from the fact cards)
The morning color, rebuilt. The pool is all names, weighted toward colors with a painting, a fact card or an article. On dates with a sourced anniversary, that color leads (e.g. the date of a pigment patent from the fact cards). The reveal ends with **where to look today**: its twins in the world (flowers in season, gems, a fashion decade) from the graph's *twins* edges.
- **Why 10×:** It points out of the window every morning. With 3,700 colors, the daily color won't repeat for ten years.
- **Connects:** the Color Graph (twins, first recorded), fact cards (anniversaries), the challenge seed, the evening three (did you see it?), painter pages.
- **Effort:** S for the full pool. M for the almanac.
- **Honesty:** an anniversary needs two agreeing sources in the fact cards. If the books disagree (CONFLICTS.md), there's no anniversary.

### 14. An honest world percentile: today's board, same for everyone
The daily challenge is already the same six boards for everyone (a seeded generator). One tiny counter per day per round (a Cloudflare Worker or Supabase row, anonymous, opt-in) gives "**Round 5: 31% of players today got it.**" It's a percentile on identical boards, which is the only fair comparison an app can make.
- **Why 10×:** It answers David's "what percentile you are in the world" (T7) without an accounts system or a fake norm.
- **Connects:** the challenge, the name hunt (the same counter design), Train (your threshold beside the day's distribution), the You page.
- **Effort:** M (the first backend, and a small one).
- **Honesty:** screens differ, so say "on their screens". Show the sample size ("of 212 players"). Opt-in, no IDs, and only a count is sent.

### 15. The bubble as the app's signature object
Settle the open question (HANDOFF, S12). The signature is **the bubble**, a named disc of color. It's already the honeycomb's material, the stem's rooms and the start of the grow motion. Make it the logo (one bubble with six smaller ones shrinking around it: the fisheye honeycomb in miniature), the app icon, the share card's frame, the Yours stamp and the loading state.
- **Why 10×:** One object everywhere, and it's the thing people actually touch. The home screen *is* the logo.
- **Connects:** the honeycomb, the signature motion (DS §8), share cards, provenance stamps, the Cabinet.
- **Effort:** S for the logo and icon. The rest follows the existing work.
- **Honesty:** none. It replaces the four-strip fan deck (X25 family).

### 16. The voice guide and a microcopy pass
A one-page voice: **the curator who birdwatches.** Name it exactly; measure, then tell; one wonder per screen; say "we don't know" plainly; point outside. Then rewrite the 40 most-seen strings. Examples:
- verdicts: "Tough one." → "Round five was 1.2 steps apart. Few eyes get that one."
- the dead end: "The path is complete" → the stage-5 door.
- the camera: "A lesson word" → "One of your words" or "New to you".
- **Connects:** every screen, articles (the writers get the same voice), share cards, empty states (DS §10).
- **Effort:** S.
- **Honesty:** this is the honesty rules, written as tone.

### 17. Steps, not percent
Replace "% different" with **steps**: 1 step is a ΔE00 of 1.0, which is roughly the smallest difference most people can see side by side in good conditions. "6 steps apart." "Your blue threshold: 1.4 steps."
- **Why 10×:** An ownable, honest unit that stays the same in Train, the challenge, the name hunt, Settle it, look-alike rows and painter pages. People learn it once and read it everywhere.
- **Connects:** Train, look-alikes, the Learner Model eye profile, color pages, every share card.
- **Effort:** S (`pctFmt`/`pctDiff` in core.js, plus copy).
- **Honesty:** call it "a rule of thumb, about the smallest difference most eyes see side by side". Thresholds vary with size, surround and screen.

### 18. Tap the masterpiece (the first minute)
The welcome is a single public-domain painting, full-bleed: "Tap anything." Every tap names that spot exactly and grows a bubble from your finger. If the painting has a fact card, one true line about its pigments follows. Three taps in, it offers to teach you to see like this, and placement begins. Detail in §5.
- **Connects:** painting analysis (the color map), naming, fact cards, the signature motion, placement.
- **Effort:** S–M.
- **Honesty:** "as photographed", and pigment facts only from fact cards.

### 19. A print shop with a gamut check
Print-on-demand (Printful or Gelato, per NOTES-TRACKER): your year in color, a painting's named palette (public-domain paintings with our own computed palettes, so the rights are clean), a palette card. Before checkout, **we check the print gamut** with the color math we already have: "2 of these colors can't be printed exactly; here are the nearest printable ones."
- **Why 10×:** The only print shop that tells you the truth about ink before you pay, and it teaches gamut along the way.
- **Connects:** the evening three (the year poster), Studio palettes, painter pages, the Mix lab (subtractive mode), the share renderer (the same layouts at print resolution).
- **Effort:** M.
- **Honesty:** say screen and print will differ. No trademarked names (Tiffany, Pantone) on products, per NOTES-TRACKER.

### 20. The real-pigments shelf
At the end of epic pigment articles (lapis ultramarine, vermilion, Prussian blue, the ochres), a quiet "Own the real thing" row. It links to suppliers that sell the genuine historical pigment (Kremer sells natural lapis ultramarine, for example), with today's price per gram set beside the story of what it once cost.
- **Why 10×:** Affiliate revenue that deepens the article instead of interrupting it: you can hold the history.
- **Connects:** articles, the Mix lab, painter pages ("the pigment Vermeer used here"), the business.
- **Effort:** S per article once the articles exist.
- **Honesty:** an affiliate disclosure on the row. Toxicity warnings where real (lead white, vermilion), without inventing any (the cyanide myth about Prussian blue stays corrected).

### 21. Plus: pay for making, never for seeing
Write the business line down. **Free forever:** every lesson, the eye gym, every article and every archive reading. **Plus** (about $3/month or $25/year, plus a lifetime option): exports (ASE, Procreate, Figma, CSS), print-resolution cards, unlimited photo analyses kept, custom decks (F1), sync across devices once accounts exist, and the offline museum pack (idea 22).
- **Why 10×:** It protects the soul (seeing is free) and charges the people who make things for work, who are the ones who'd pay.
- **Connects:** Studio, the print shop, accounts, the promises page.
- **Effort:** S to decide, M to build with accounts.
- **Honesty:** no paywall in the middle of a lesson, and no trial that auto-charges without a reminder.

### 22. The offline museum
Self-host Instrument Serif and Geist (both open font license). Precache the shell, the wiki and the core names on install. Cache the Wikimedia images of everything in your Cabinet (opaque responses). The app then works on a plane, as the install card already promises.
- **Why 10×:** It makes a promise the app already prints come true. Phones on the subway are where the daily ritual happens.
- **Connects:** the loader (`loadWiki`), the Cabinet, the daily challenge (seeded, so it works offline), the evening three.
- **Effort:** S–M.
- **Honesty:** say which content is offline and which isn't.

### 23. The truth pass on metadata
The manifest and meta say what the app is now, with the soul's line. `theme-color` becomes `#0E0D0B`. Add a maskable icon and manifest shortcuts (Today's color, Camera, Challenge: long-press on Android). Purge the five glass leftovers and the uppercase labels.
- **Connects:** SEO (OG text), identity, DS QA.
- **Effort:** S.
- **Honesty:** this item is a fix.

### 24. Big text that stays beautiful
Map the type scale to `rem` with a clamp, read the iOS text-size setting through `-apple-system-body` font sizing, and let the layout reflow (one column, the hero name wraps) instead of clipping.
- **Connects:** every screen, the DS fit test.
- **Effort:** M.
- **Honesty:** none.

### 25. The Sunday sheet
One quiet card on Sunday: this week's evening threes as a strip, the pair you finally stopped confusing, the life-list additions, and next week's edge of your map (`lmEdge`). No push notification, only a card that waits.
- **Connects:** Learner Model, the evening three, the life list, Explore's For you.
- **Effort:** S once ideas 1 and 6 and L19 exist.
- **Honesty:** only real events. If the week was empty, the card says so kindly or doesn't appear.

---

## 4. Kill list (surface that adds no seeing)

1. **The 🟩⬛ emoji grid** as the only challenge share. Replace it with the real colors (spec 1).
2. **The fan-deck logo and icon.** Replace with the bubble (idea 15).
3. **"One family at a time"** in the manifest, meta and OG description. It's the rejected idea, published.
4. **The glass leftovers** (`.xp-search`, `.eye-hint`, `.gl-badge`, `.glass-box`, `.pm-view`) and the remaining **uppercase mono labels**, including the share card's.
5. **"% different"** for ΔE. Steps instead (idea 17).
6. **"The path is complete. More tiers are coming."** Never end the path. Until stages exist, the last screen opens Learn it on the edge of your map.
7. **Per-feature streaks.** One "week kept" (idea 11).
8. **The 101-pool daily color.** Use the full list (idea 13).
9. **"Lesson word" copy in the camera.** It's X19 in a third place.
10. **Any confetti, XP, coins, flames, mascot or seasonal skin**, now or later (DESIGN.md "left out on purpose", X6). The moments are made of the colors themselves.
11. **Progress marks on honeycomb bubbles**, including round 1's dimming proposal (X7). Progress is a view.

---

## 5. The 60-second wow: "Tap the masterpiece"

Second 0: the app opens on one public-domain painting, full-bleed on warm black. No menu, no form, one serif line: "*Tap anything.*"

You tap the girl's turban. A bubble grows out of your fingertip, the size of a coin, filled with exactly the color under your finger, and a name sits on it: **Lapis blue**. Under it, one small line: "Vermeer's blue here is natural ultramarine, ground from lapis lazuli." (Shown only where a fact card supports it; otherwise only the name and "as photographed".) You tap the shadow on her cheek and get **olive drab**: the green in the skin, the "hidden color" the analysis already stores. A third tap, the background: **ink**.

At about 40 seconds the three bubbles slide into a row: "Three names you could use tomorrow. Want to learn to see like this?" The paper button reads "Begin · 1 min" and grows into placement.

Why this one: no permissions, no typing, and it uses the only thing no other app has (every spot of 23,531 paintings has an exact name and some have a true story). It shows the soul in one gesture: *a name is a lens.* Pick the painting from archive paintings that have a fact card and a clear `hid` color. The Vermeer above is the example, if it's in the archive.

---

## 6. Buildable today (each under 4 hours)

### Spec 1: one share-card renderer, and the challenge in real colors (S, about 3 h)
- **New file** `js/sharecard.js`. Names must be unique in the shared global scope (explore.js already owns `shareCard`):
  - `cardRender(spec) → Promise<Blob>` draws to a 1080×1350 canvas;
  - `cardShare(spec, text, url)` shares the file through `navigator.canShare({files})`, then text, then a download, the same fallback chain as today's `shareCard`.
- **Before drawing:** `await Promise.all([document.fonts.load("130px 'Instrument Serif'"), document.fonts.load("32px 'Geist Mono'")])`, so the card never renders in Georgia.
- **Style (DS):**
  - the ground is `#0E0D0B`;
  - the label is paper `#EFEBE3` with ink `#141311`;
  - the note is Instrument Serif italic 34 px in paper-soft `#5E5A51`, sentence case ("Color of the day, 8 October");
  - the name is serif at 130 px, the hex is Geist Mono at 32 px;
  - a small serif wordmark sits bottom right;
  - **no uppercase anywhere.**
- **Layouts:**
  - `color`: the swatch slab, then the label with the name, the hex, and one difference line from `lookDiff(c, lookalikes(c,1)[0].x)` ("Darker and bluer than teal").
  - `grid`: the day's six `rounds[i].base` colors as a 3×2 of swatches with gaps. A hit gets a 6 px paper ring *outside* the swatch (DS feedback rule). A miss has no ring and a small serif "missed" under it. The note reads "Daily No. 12 · 4 of 6 · smallest seen 1.2 steps".
  - `verdict`: used by spec 2.
- **Wire-up:**
  - `explore.js shareCard()` keeps its name and becomes a 3-line call to `cardShare({layout:"color",…})`.
  - `challenge.js shareChallenge()` attaches the grid image and changes the text to family squares from `family(r.base)`: Reds and Pinks 🟥, Oranges 🟧, Yellows 🟨, Greens 🟩, Blues 🟦, Purples 🟪, Browns 🟫, Greys ⬜, misses ⬛. Example: `ColorHub daily No. 12 🟦🟩⬛🟪🟫⬛ 4/6`.
- **Index:** one `<script src="js/sharecard.js">` before explore.js. The conductor bumps `?v=`.
- **Verify:**
  - run `check.js`, `check_wiki.js` and `check_names.js` (duplicate globals);
  - render all three layouts under `#shot=card-color|card-grid` (a small case in boot.js) and look at the PNGs;
  - test the share sheet on the phone.

### Spec 2: Settle it v0 in the camera (S, about 3 h)
- **Where:** `js/camera.js`, additive only. When frozen and a spot is tapped, `paint()` already has `cur = {hex, nm, m}`. Add a text button "Settle it" to the result area, visible only when frozen.
- **The sheet** (the existing modal-sheet pattern):
  - **Crop:** a 360 px square cut from `#still` around `at`, drawn into a circle (the bubble) with a 4 px paper ring at the sampled point.
  - **Name:** `nm.text` in `title-1` with the hex in `code`.
  - **Neighbors:** three rows from `nm.near.slice(1,4)` (entries `{n, h, de}`). Each row is a chip with `data-swatch` (swatch.js opens the page in one tap, per the product rule), the name, and the direction phrase `lookDiff({h: hex}, {h: x.h})` read as "Teal is lighter and greener". The distance appears in `code` as steps (`de.toFixed(1)`, plus " steps").
  - **Caveat:** one `small` line, "As your camera sees it. Light and screens shift color; WB helps." If white balance is off, add a WB text link.
  - **Primary (paper):** "Share the verdict", which calls `cardShare({layout:"verdict", crop, hex, name, near})`. The verdict layout is the crop bubble, the name, and the three neighbors as chips with their direction words.
- **Hook:** if `typeof lmLog === "function"`, log `lmLog({k:"seen", c: slug(nm.n), surf:"camera"})` (it's a no-op until L19 lands).
- **CSS:** about 25 lines in `css/booth.css` or a new `css/settle.css`. Solid surfaces only, no glass (fix `.eye-hint` while you're there).
- **Verify:** freeze a test photo through the file input in headless Chrome, tap three spots, screenshot the sheet at 375×812, and confirm each chip opens its color page.

### Spec 3: the evening three, v0 (S, about 3.5 h)
- **State:** `S.diary = {"2026-10-08": [{n, h, t}]}`, an additive key. `migrateState` keeps unknown keys, so no `STATE_V` bump is needed, but add a default in `migrateState` if the conductor prefers explicit keys. Use `today()` (it already starts the day at 4 a.m.).
- **New file** `js/diary.js`:
  - `diarySheet()` is a modal sheet titled "Three colors from *today*" with a text field.
  - Type-ahead over `CORE_NAMES` (`loadCoreNames()`; prefix matches first, then contains), at most 6 suggestion rows (chip, name).
  - Recall first: suggestions appear only after 2 typed letters, and the chip is shown *after* a name is chosen, so you produce the word before seeing the color.
  - Picking a name adds its stripe to today's square. Three fill it, and you can edit until the day ends.
  - An unknown word gets "Not a name we know yet. Nearest spellings: …", by spelling only, never by color.
- **Month strip:** under the field, the current month as a 7-column grid of small squares, each split into its day's 1–3 stripes. Tapping a day lists its names, and each name is a `data-swatch` chip that opens its page.
- **Entry point:** in `learn.js home()`, one quiet row under Today's three, shown from 5 p.m. local time or once all three tiles are done: "Three colors from today" with today's stripes as its art. Learn keeps one primary button (DS rule 4).
- **Route:** add `#/diary` as one line in router.js `ROUTED` plus an `openRoute` case.
- **Hook:** each chosen name calls `lmLog({k:"recall_ok", c, surf:"diary"})` when available.
- **Files:** `js/diary.js`, `css/diary.css`, `index.html` (the tag), and one line each in learn.js and router.js.
- **Verify:**
  - check scripts plus a small `tools/diary_test.js` (date bucketing, the 3-per-day cap);
  - screenshots of an empty day, 3 names and the month view at 375×812;
  - confirm a backup and restore round-trips `S.diary`.

---

## 7. Name and identity

**Why not ColorHub:** it's already taken at least twice (the App Store's "Color Hub" and the web palette tool "ColorHub"). "Hub" reads as an aggregator, invites an obvious adult-site association, and says nothing about seeing. It's a fine working name and a weak brand.

**Recommendation: _Ochre._**
- **The story:** red ochre is one of the oldest pigments people are known to have used. A paint-making kit at Blombos Cave in South Africa is about 100,000 years old. The app's line writes itself: *every color since ochre.*
- **It's in the app:** ochre is a real color with an epic pigment article, so the name has its own page, and the app's first fact card is about itself.
- **The look:** one short word that sets beautifully in Instrument Serif (lowercase roman, *ochre*). The icon is a single ochre bubble ringed by six smaller bubbles on warm black (idea 15). Tagline: **"Learn to see color."**
- **Risks:**
  - It's also a common color word, so "ochre" searches mean the color. Use the tagline in titles and a domain like ochre.app or "Ochre: learn to see color".
  - An ochre icon could suggest "earth tones only". The bubble cluster answers that.
  - A quick web search found no color app named Ochre. That isn't a trademark search.

**Runner-up: _Nuance._** It has the best meaning of any word: French *nuance*, from *nuer*, "to shade", built on *nue*, "cloud", the idea being how mist shades a color. The app teaches nuance, literally. But Nuance Communications (now Microsoft) holds the name in software, so it's likely blocked on the App Store and usable only with a qualifier. Keep it as a section or feature name: "Nuance", the look-alike lessons.

**Fallback:** keep "ColorHub" until there's an App Store plan, and drop "Hub" from the UI wordmark meanwhile (the honeycomb glyph alone).

**Outward-facing, so David decides.** Run a trademark and domain check before any rename. Nothing in the repo changes until he says so.

---

### Sources checked for this file
- [Color Hub on the App Store](https://apps.apple.com/app/id1027137191) and [ColorHub, the web palette tool](https://webdesignerdepot.com/colorhub-lets-designers-browse-and-customize-over-150-color-palettes): the name collisions.
- [Etymonline: nuance](https://www.etymonline.com/word/nuance) and [PMLA: "The French Word Nuance"](https://www.cambridge.org/core/journals/pmla/article/french-word-nuance/DDB5554FE0BC7BA6BF7C0A4A09A78E70): nuer, from nue, "cloud".
- A web search for an "Ochre" color app ([PrintMag's list of iPhone color apps](https://www.printmag.com/article/the-25-best-color-apps-for-iphone/) among the results) found none, as far as a quick search shows.
- Blombos Cave ochre toolkit (Henshilwood et al., *Science* 2011), lightness–pitch correspondence (Spence 2011 review), ΔE00 ≈ 1 as a rule-of-thumb threshold, red-green CVD at about 1 in 12 men: standard references, not re-checked online here. The article pipeline should source them before any of them ships in the UI.
