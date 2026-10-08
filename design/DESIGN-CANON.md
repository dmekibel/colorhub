# ColorHub design canon (2026-10-08)

David asked why we use so little of what we already own. This file puts it to work: the dev-book canon (Krug, Refactoring UI, Swink, Chou's Octalysis, Schell, Sierra, Ousterhout, via `alter/_specs/BOOKS-DEV-CANON-2026-07-18.md` and its briefs), the learning KB (`learning-kb/EXPORT-learning-kb-for-claude-project.md`), Oren Meets World's creative-direction material (`balance/pipeline/marketing-kb/wisdom/`), and the designers everyone borrows from (Rams, Ive and the Apple HIG, Jobs, Norman, Tufte, Maeda, Bret Victor, Miyamoto, von Ahn, Kare, Vignelli, Albers).

**Order of authority:** David's words and CLAUDE.md outrank every book. Where several books agree with him, his taste becomes evidence. Where a book disagrees, §2 says who wins and why. All prose here is our own; sources are credited by name.

Read with: `design/DAVID-MODEL.md` (what he will say), `DESIGN-SYSTEM.md` (tokens and motion), `design/CRAFT-RUBRIC.md` (the critic), `design/REVIEW-2/SYSTEMS.md` (the one-machine plan).

---

## 1. The rules (33)

Each rule gives its source, then a ColorHub example.

### A. Clarity and navigation

**A1. Self-evident first; self-explanatory at worst.** If a control makes you wonder what it does, it costs attention. An icon can stand alone only when everyone already knows it (‹, ✕, search, heart, share). Private symbols need a word. *Krug's first law; Norman's signifiers.*
ColorHub: the Rooms corner (four dots on a curve) and the hexagon are private symbols. The hexagon even means two things: "back to the map" on pages and "Study the map" on Home (home-map-nav B1).

**A2. Every screen passes the trunk test.** Drop someone on any screen and they can tell what app this is, what page they're on, which room they're in, how to get to the map, and how to search. *Krug.*
ColorHub: the map shows no name and no active filter (home-map-nav A7). No inner page offers search.

**A3. One name per concept, and the page name matches the tap that opened it.** *Krug's "social contract"; Ousterhout (one deep mechanism, not parallel ones); David P17.*
ColorHub: Map, Find, Recall, Kept, Yours (SYSTEMS §5). Tapping "Sky blue" opens a page titled Sky blue.

**A4. Fewer doors, each one better.** Every extra choice slows the decision and weakens the choices beside it. A room gets one hero and no more than four blocks. A grid of equal tiles is a launcher, not a room. *Hick's law; Jobs on focus as saying no; Rams, "less, but better"; David P22.*
ColorHub: Train's 16 equal tiles. Duolingo's home shows one next lesson, not sixteen.

**A5. Direct manipulation with the result visible.** A control is mapped the way the world is (lighter is up or right) and its effect changes under your thumb. Nothing waits for an "Apply". *Norman's natural mapping; Bret Victor's "immediate connection"; David P12 and P13.*
ColorHub: the map's Magnify, Spacing and Bubble size sliders get this right. Practice's count picker and the gallery's 3/6/12/20 segments should be sliders too.

**A6. Back is sacred.** Every step reverses, to the exact place and scroll position, with the same motion played backward. *Norman (user control, forgiveness); Apple HIG; David P14.*
ColorHub: the bubble that grew into a page shrinks back into the same bubble (DESIGN-SYSTEM §8).

### B. Visual craft, icons and menus

**B1. Emphasize by de-emphasizing.** When the main action doesn't stand out, quiet everything around it instead of making it bigger. *Refactoring UI.*
ColorHub: one paper button per screen (DESIGN-SYSTEM §1.4). On the welcome screen, the paragraph above "Find my level" competes with the button. Cut it.

**B2. The system is decided before the screen.** Use the type ramp, spacing, radii and elevation tokens. A one-off value is a bug. *Refactoring UI; Vignelli (a few typefaces, a few sizes, a strict grid).*
ColorHub: the 10-08 audit snapped 12 radii down to 4. Hold that line in every lane.

**B3. Hierarchy comes from size and weight. Italic is an accent, not a voice.** Vignelli built whole systems from very few type moves. Refactoring UI gets hierarchy from weight and color, not more styles. Long italic text is slow to read. *Vignelli; Refactoring UI.*
ColorHub: the audit turned about 130 mono labels into serif italic notes, which was right. But italic is now the default second voice: Studio has three italic paragraphs, and every Train subtitle and You heading is italic. Paragraphs are roman; italic is for a single word or a short note.

**B4. Icons are one family on one grid.** Same stroke, same corner radius, same optical size. Each one is a plain metaphor you can read at 24 px. Icons are monochrome on surfaces and only take a color when they stand for that color. *Susan Kare.*
ColorHub: Train mixes filled palette glyphs, outlined eyes, a lightning bolt and a ticket. They look like they came from four kits.

**B5. No dated patterns.** Each one has a replacement:

| Dated pattern | Use instead |
|---|---|
| A stack of identical chevron accordions (looks like a settings list) | Open sections with real content: a strong lead and "More" at the end of each |
| Launcher grid with a "New" badge on every tile | One recommended next, then a short labeled list |
| Unlabeled round floating buttons | One labeled corner whose arc names its verbs (PLAN decision 2) |
| 12 px color squares used as data | Big side-by-side plates with names |
| Tracked uppercase mono labels | Serif size and weight; mono only for numbers |
| Glass and blur over color | Opaque `--surface-2` |
| An "Open page" sheet in between | One tap opens the page (CLAUDE.md) |
| Cards cut off by accident at the edge | A peek that is clearly intended, or none |
| Toasts that pile up, splash screens, decorative loops | One message, in place, then gone |

*Rams (good design lasts, it isn't fashion); Krug's sizzle law; DESIGN-SYSTEM §1.*

**B6. Every mark is data, and every number answers "compared to what?"** Small multiples beat one chart with everything in it. Showing how far something sits from normal beats showing the raw value. *Tufte.*
ColorHub: "Darker than 94% of paintings" should be a dot on a thin strip of the archive, with n. The art-history index is 70 near-identical rainbow rows; show only how each decade departs from the average.

**B7. Take care of the parts nobody photographs.** Check 320 px, very pale and very dark colors, loading, empty and error states, Reduce Motion, VoiceOver labels, and color-vision deficiency (state is never shown by hue alone). *Jobs's "back of the cabinet"; Ive; Norman; DESIGN-SYSTEM §1.7.*
ColorHub: the relation marks use shape (ring, disc, half disc), not hue. Every new state marker should work the same way.

### C. Feel and feedback

**C1. The 100 ms law.** Some visible change within 100 ms of every touch, even if the full animation finishes later. At about 240 ms control feels broken. *Swink; Schell; Norman (feedback).*
ColorHub: with 2,700 bubbles, the press dip has to paint on the next frame, before any layout work. This is a test, not a matter of taste (see §4).

**C2. Each action has one envelope: anticipation, impact, settle, in three channels.** The visual, the haptic and the sound arrive together. Every motion explains where something came from, where it went or what changed. *Swink (ADSR, polish); Apple HIG; DESIGN-SYSTEM §8–9; David P15.*
ColorHub: the bubble growing into its page, the color's own note (`colorTone`), and the 4 ms tick are the signature. Never add a loop that doesn't explain something.

**C3. All effects stay at one level of abstraction.** Nothing is more realistic or more cartoonish than the system around it. *Swink's metaphor metrics.*
ColorHub: warm black, booth grey, paper, rounded and glassless. Arcade confetti next to a museum serif breaks the spell.

**C4. A miss gets as much care as a win, and never punishes.** It shows the truth big and side by side, names one fix, and makes the next round a little easier. Never imply that failing is common. *Schell; Swink (a fail can delight); Sierra ("Just Tell Them" struggle is normal); Chou on the Petrified Forest sign.*
ColorHub: misscompare's full-screen picked-vs-was is right. "Eyes trained." printed over a level drop is not.

### D. Motivation and fun

**D1. A real skill, with a curve that breathes.** A goal plus constraints makes a challenge. New twists arrive at easy difficulty, and the interest curve has a hook, a climb and one peak. *Swink; Schell; Miyamoto (World 1-1 teaches with the level itself, not text).*
ColorHub: Odd one out's "New at level 5: a time limit" is the right shape. It should be introduced in play, not listed on the results screen.

**D2. Make the user awesome, not the app.** Progress copy talks about what they can now see, never about engagement with us. *Sierra.*
ColorHub: "You can name 41 blues" is right. "12 sessions this week" is about the app.

**D3. The endgame runs on White Hat drives.** ColorHub's drives are Meaning (seeing the world), Accomplishment (colors that are yours), Creativity (palettes) and Curiosity (the archive). Black Hat drives (loss, scarcity) stay near zero: a gentle streak, one free miss a week, no "you'll lose" copy. *Chou's Octalysis; von Ahn's Duolingo, with its streak pressure as the warning.*

**D4. Retention comes from the next narrow skill, not the streak.** There's always one skill just past the user's edge, and it has a name. *Sierra (the A board is never empty); Schell (experienced players need a different game).*
ColorHub: every room ends on one named next edge: "Teal against turquoise is next."

**D5. Give them something to show.** What does the user carry out of the app to a dinner party? A visible result beats asking for word of mouth. *Sierra's dinner-party test and "Word of Obvious"; Wordle's share grid.*
ColorHub: a result card in the colors they actually saw, spoiler-free; "Send a set" (learning.md D6).

### E. Learning science

**E1. Recall before reveal.** The name is produced from memory before it's shown. A wrong guess, especially a confident one, primes the correction. *Learning KB #1 and #5.*
ColorHub: the swipe deck holds back the answer until the flip (learn.js). Keep it that way everywhere.

**E2. Progress means delayed, unassisted recall, with the first gap crossing a night's sleep.** How learning feels is not evidence that it happened. *KB #2, #3 and #12.*
ColorHub: "Yours" means you named it on a later day (PLAN decision 7). Same-session scores are labeled "climbed", never "learned".

**E3. A perceptual skill comes from many varied examples of one invariant.** Show many examples that look different on the surface but share the same rule, give feedback per round, and don't state the rule up front. *Sierra (Kellman's instrument study); KB N7 and #9; Albers.*
ColorHub: teach teal against turquoise with 30 real crops from paintings and photos, not with a definition.

**E4. Structure first for novices, then fade it. Interleave neighbors only once each is known.** *KB #4 and #8 (expertise reversal).*
ColorHub: the look-alike is shown beside a new color at first, then fades as the pair becomes Yours. Reviews mix confused pairs only after both are met.

**E5. Feedback names one fix and gives an immediate redo.** Verdicts on the person make performance worse. *KB #6 (Kluger and DeNisi; Ericsson's Focus, Feedback, Fix).*
ColorHub: "Most misses were blues. The fix: 3 rounds of blues" is right. Add a one-tap "Do it now".

**E6. Teach just in time, by doing.** Sessions are minutes long. The first minute teaches the core move with no words. *Sierra (just in time beats just in case); Krug (halve the words, then halve them again); von Ahn (bite-size lessons); Miyamoto.*
ColorHub: the first launch should be the map itself: tap a bubble, it grows, you meet a name.

**E7. Color is relative, so always show it in context.** The same chip looks different on different grounds, and color is learned by experiencing it before any theory. *Albers, "Interaction of Color"; Itten.*
ColorHub: judge on booth grey (DESIGN-SYSTEM §1.5). Every color page should show its color on black, on white and beside its closest neighbor.

### F. Creative direction and identity

**F1. One intentional thing per screen.** Every screen has one element that makes it unmistakably ColorHub and earns a second look. *Oren (the minimum for art direction is one deliberate move per shoot).*
ColorHub: a painting detail in the color page's empty hero; the map's lens; the color's note when it opens.

**F2. The look is the hook, and the product is the marketing.** A screenshot of any screen should be recognizable with no logo: warm black, booth grey, the paper button, the serif display, the honeycomb. Share cards, OG images and the icon all wear today's color. *Oren (format as a "hookless hook"; Rhode and Apple, where the product sells itself); Vignelli's identity systems; Duolingo's owl.*

**F3. Borrow Apple's care, not its emptiness.** Oren calls "minimalism signals intelligence" a lazy lesson. Maeda: take away the obvious and add the meaningful. Tufte: when it's well organized, density is clarity. *Oren; Maeda's Laws of Simplicity; Tufte.*
ColorHub: a museum with depth. The surface is calm and the layers below are rich. Not a blank white app.

**F4. A world, not a feature list.** The same characters and places keep coming back: today's color, the painters, the map as the place you return to. Each episode stands alone and also moves a longer story along. *Oren (the brand as a TV show; world-building); Miyamoto.*
ColorHub: Trails (SYSTEMS N1) are the episodes, and the map is the home they all come back to.

**F5. Taste is perception plus canon, and you defend it out loud.** Judge every screen on three axes: composition (how it's built), effectiveness (does it do its job) and vibe (does it have it). If a screen scores well on two and fails the third, you've found the problem. Honesty is part of the look: "as photographed" once, n always. *Oren's critique matrix; Rams (honest design); David P19 and P20.*

---

## 2. Where David and the canon agree, and where they don't

**Strong agreement** (his taste now has evidence behind it):
- One tap opens the thing (P2), and one name per thing (P17): Krug, Norman, Ousterhout.
- Big and side by side (P8), with no tiny squares: Tufte's small multiples, Albers, Sierra's perceptual exposure.
- Less text (P9): Krug's halve-it-twice, Sierra's just-in-time.
- Smooth, never wiggly (P15): Swink's attack and release, Apple HIG.
- Solid, even, full screen (P5, P16): Rams (honest, unobtrusive), Refactoring UI.
- Sliders you can see working (P12, P13): Victor, Norman.
- Curate (P22): Jobs, Rams, Maeda.
- Grounded and honest (P19): Rams, Tufte (show the n), the learning KB's anti-claims.

**Where they pull apart, and the call:**

| Tension | David | Canon | Resolution |
|---|---|---|---|
| Depth by default (P7) vs. reduction | "As much info as possible" | Rams, Maeda and Krug cut. Tufte and Oren side with density. | David wins on content, minimalists win on surface. Compute everything, show one summary, and put each layer one tap down (Maeda's "Organize" and "Time"). |
| "No tab bar, ever" (DESIGN-SYSTEM) vs. visible navigation | The map is the floor; rooms rise from one glyph | Krug's persistent navigation and the HIG tab bar: top-level places should be visible | Keep the no-tab-bar floor, but the corner must say where you are (the current room's name beside the glyph) and the stem's labels count as the navigation. Run the trunk test on the result. |
| A slightly addictive swipe deck vs. honest grading | Tinder speed, self-graded | KB #3 and #16: self-judgment is poorly calibrated; recognition inflates | Keep the swipe as the review surface. Unconfirmed rights sometimes become a Pick it (learning.md 1.4). Keep Bet on tomorrow. |
| Variety "the way Duolingo does it" (P11) | Many modes in a session | KB N6: word banks create an illusion of progress | Variety yes, but every mode has to be retrieval or perceptual discrimination, never recognition dressed up as a game. |
| Apple as the benchmark | "Design it like Apple" | Oren: copying today's Apple fits the wrong era | Borrow the craft (motion, care, restraint in chrome), not the white-space look. The identity comes from color and the museum (F2, F3). |
| Every element clickable (P3) | Everything opens | Norman: when everything is a link, nothing signals it | Keep everything clickable, with one consistent signifier: swatches morph, names get a hairline underline, and nothing that looks like a link fails to open. |
| Look first, then test (P11) | "Learning is a summary that doesn't hide the answer" | KB X1: a 10-second guess before teaching helps | Order: a quick guess where a guess makes sense (the painting quiz), then Meet (shown), then recall. Never a test with no meeting first. |
| Statistics and percentiles everywhere | "Percentiles against other people" | Octalysis: social comparison drifts toward Black Hat. KB: feelings aren't evidence | Percentiles against the archive and against yourself. Against other people only as opt-in, never on the first screen. |

---

## 3. Audit: which rules the app breaks most (440×956, `main` at ebfced64)

Ranked by how many screens break the rule and how hard it hits a first-time user.

1. **Private symbols and hidden navigation (A1, A2, B5).** On the Home map, both corners are unlabeled round glyphs. The hexagon means two things. Inner pages have a hexagon top-right and no search. *Files:* `js/home.js`, `js/core.js` (`HOME_GLYPH`, `NAV_MAP`), `js/mapstudy.js` (`MS_ICON`), `css/menus2.css`.
2. **The launcher grid (A4, B4, B5, D4).** Train is 16 equal tiles in three columns, most with the same "New" label, so the label carries no information. The glyphs are mixed. The rooms corner covers "Color n-back". No single "do this next" exists. *Files:* `js/rooms2.js` 81–96, `js/gym.js` 250 and 261.
3. **The settings-list color page (B5, B6, F1).** Below the hero are 11 collapsed chevron rows ("Culture" twice, "Kin", "Codes"). Connections are 12 px squares with "Looks like" repeated. On `#/color/periwinkle` the hero is about 60% empty swatch, and the stat cards use lowercase mono labels ("the paintings") and are cut off at the right edge. *Files:* `js/explore.js` (colorPage, around line 672), `js/richcolor.js`, `css/colorpage.css`.
4. **Results that overtalk and quietly punish (C4, E5).** The Odd one out results say "Eyes *trained.*" over "Level 13 → 12". Below that: a three-line grey caveat, a mono "2.2% → 2.6% different", four "New at level" lines and a misses strip running off the right edge. *Files:* `js/gym.js` 399 (headline) and the caveat string, `js/games/oo-ui.js`.
5. **Words before doing (E6, B1).** The first-run screen is a static color grid, a 30-word paragraph and a test button (`js/learn.js` 18–20). Studio opens with three italic paragraphs before any tool (`js/rooms2.js`). The first minute teaches by telling.
6. **Italic as the default second voice (B3).** Studio, the Train subtitles, the You section notes and Museum's "Today's color and its five nearest names" are all italic. With no roman secondary text, nothing ranks. *Files:* `css/polish.css` and the note class across rooms.
7. **Leading with zero (D2, D4).** You opens with a 120 px "0 colors yours". That's honest, but it's the first number a new user sees, and no next step comes before it. *File:* `js/you.js` 164.
8. **Data without comparison (B6).** The painting palette shows six chips with percentages but no names on the chips (the names sit in a list below, with mono hex). The art-history index shows 70 rainbow rows with no deviation. Findings are sentences with no picture of where they come from. *Files:* `js/explore.js` (paintingPage), `js/artwiki.js`.

These are already covered elsewhere and not repeated here: duplicates and IA (SYSTEMS), glass, radii, press and contrast (AUDIT), mono labels in the art wiki (CRITIQUE).

---

## 4. Ten high-leverage changes the existing reviews missed

1. **Label where you are, then run the trunk test.** PLAN decision 2 labels the right corner's verbs. Nobody flagged the left Rooms glyph or the absence of a "you are here". The fix: the corner shows the current place's name in small serif ("Map", "Train"), and the map shows its active view or filter as one quiet line. Test it as Krug would: screenshot six random screens, cover the content, and ask the five questions. *(A1, A2)*
2. **Albers strip on every color page.** Right under the hero, show the same color on black, on white, on booth grey and beside its nearest neighbor. It costs four divs and teaches the most important fact about color on every page. It also fills the empty hero problem honestly. *(E7, F1)*
3. **Tell-apart galleries made from the archive.** For each confusable pair (teal/turquoise, maroon/burgundy), pull 20–40 crops from the 23k paintings and from photos where the measured color sits clearly on one side. The player sorts them, with feedback per round and no rule stated first. This is the perceptual-exposure method, and it uses data only ColorHub has. Reviews proposed Find it in one painting, never many varied examples of one difference. *(E3, F2)*
4. **One chart grammar for every "Measured" finding.** Use a thin strip of the reference set with one dot for this thing, the n under it, and the sentence beside it. The same component goes on color, painting, painter, decade and movement pages. It turns the statistics David asks for into something you can see at a glance. *(B6)*
5. **The first launch is a toy, not a poster.** Frame one shows the live map, with one bubble breathing near the thumb. Tap it and it grows into its page with its note. Back shrinks it. Then one line appears: "Find my level, 60 sec". The welcome paragraph goes. DAVID-MODEL guessed he'd ask for this; the canon (Miyamoto, Schell's "build the toy first", Sierra) says it's the most important minute in the app. *(E6, D1)*
6. **One icon family, drawn on purpose.** Commission or draw one set (24 px grid, 1.75 stroke, round caps, a single metaphor each) for the rooms, the corner verbs and the Train stations. Retire the mixed glyphs. Icons take color only when they show a real color (a station's tile can wear today's color). *(B4, F2)*
7. **Make the 100 ms law a smoke test.** In `tools/smoke/scenarios.js`, time pointerdown to the first frame where the pressed element's transform changes, on the map with all 2,700 names, the deck and Train. Fail anything over 100 ms, and flag anything over 240 ms as broken. "It feels laggy" becomes a number. *(C1)*
8. **Roman text again, with a two-voice type rule.** The rule: serif display for titles, roman serif or sans for anything over one line, italic only for a short note under 8 words, mono only for numbers. Do one CSS pass over `.note` usage in paragraphs (Studio, Museum covers, Train subtitles). *(B3)*
9. **Honest endowed progress, and the A board on You.** Placement already proves which colors the user can name. Count them openly ("You already know 46 names. 0 are yours yet: that takes a day") and put one named next edge above the numbers. Zero stops being the headline, and nothing is faked. *(D2, D4, E2)*
10. **Watch real people, and label every test.** Every review so far is a screenshot or a critic. Once a month, sit three people who have never seen the app in front of a phone, give them one task each, and say nothing. Triage what you see: small stumbles they recover from on their own can wait; head-slappers get fixed. Every lane report labels its checks as QA (it runs), usability (people find it) or playtest (the feeling landed). Only the playtest answers David's "does it feel expensive". *(Krug's testing protocol; Schell's QA/usability/playtest split.)*

---

## 5. The ColorHub design doctrine (load this before any UI work)

**What we're making:** a museum curator's mind and a color nerd's obsession, wrapped in Apple-grade care. Every thing is a color dataset, and the screen's job is to help you see it.

**Ten laws**
1. **The color is the interface.** It gets the most room. Everything else is opaque, neutral and recedes. Judge on booth grey, read on warm black.
2. **Self-evident or labeled.** No private icons. Every screen passes the trunk test: app, page, place, way home, search.
3. **One tap opens; Back returns exactly.** Same motion forward and backward. No in-between sheets.
4. **Fewer, better doors.** One hero, no more than 4 blocks, and one paper button per screen. A grid of equal tiles is a menu: replace it with one next step and a short labeled list.
5. **Show, big and side by side, compared to something.** Plates, not squares. Every number has a reference and an n. One chart grammar.
6. **Calm surface, deep layers.** Compute everything, show one summary, put each layer one tap down. Never one palette.
7. **Every touch answers within 100 ms,** with one envelope (visual, haptic, sound). Every motion explains something. Nothing wiggles, snaps or loops for decoration.
8. **A miss is crafted like a win.** Truth shown big, one fix, a redo, kind words, the next round a little easier. No verdicts on the person, no fake progress.
9. **Learn the way people actually learn.** Guess or recall before reveal. Many varied real examples for perceptual skills. Structure first, then fade it. Space across sleep. "Yours" means named on a later day.
10. **One intentional thing, an unmistakable look.** Warm black, booth grey, paper, serif display, the honeycomb, the color's own note. A screenshot without a logo should still read as ColorHub.

**Banned on sight:** accordion stacks; launcher grids with "New" everywhere; unlabeled floating buttons; 12 px data squares; uppercase mono labels; glass; italic paragraphs; "Open page" interstitials; caveat paragraphs on result screens (one "as photographed" line per page); placeholder copy; emoji grids; cut-off cards that weren't meant to be cut off.

**Before you hand over a screen, answer:**
1. What is the one primary action, and is it the only filled button?
2. What is the one intentional thing?
3. Does every tap paint feedback in 100 ms, and does every color open in one tap?
4. Is anything compared in tiny squares, or shown as a number with no reference?
5. Which words could go? Cut half, then cut half again.
6. Are first-time, empty, loading, error, miss, win, level-up and come-back-tomorrow all designed?
7. Is it at 440×956, 375×812 and 320, with very pale and very dark colors, nothing covered by the corner?
8. Composition, effectiveness, vibe: which is weakest, and what's the fix?
9. Run the 12 David-critic questions (DAVID-MODEL §4).
10. Which test is this: QA, usability or playtest? Say which in the report.

**Sources, short form:** Krug, Refactoring UI, Swink, Schell, Sierra, Chou, Ousterhout (via ALTER's dev canon); the learning KB; Oren Meets World; Rams, Ive and the HIG, Jobs, Norman, Tufte, Maeda, Victor, Miyamoto, von Ahn, Kare, Vignelli, Albers.
