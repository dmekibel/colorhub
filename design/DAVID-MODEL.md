# The David model: predict the product owner's feedback

Built 2026-10-08 from about 240 of David's ColorHub messages (two session transcripts and their summaries), design/REQUESTS-LEDGER.md, CLAUDE.md, the memory folder and design/IMPROVE-2026-10-08. Quotes are verbatim, typos included. Use it to pre-empt his notes: run the rubric (section 4) on every screen before he sees it.

**How he works, in one paragraph.** He tests on his iPhone 16 Pro Max (440x956), mostly by tapping around. He reacts to what he sees, with a screenshot and one line ("This looks weird", "Also this broken"). Then he zooms out to a principle ("It should be a unified system") and finally to a big "brainstorm every way… tenfold" request. He approves ideas generously ("I like it all start") and rejects precisely, with a named list. He hands decisions to Claude ("Go with ur recs"), but he notices regressions at once ("we've lost something"). He reads short replies only ("Tldr", "ur previous messages were too much too read").

---

## 1. Principles (20)

**P1. Everything is connected; nothing stands alone.** Every color links to paintings, poems, gems, flowers and other colors, and the links are the product.
- "Any color should be connected to other coolers in a complex web of relationships… like a wiki full of hyperlinks"
- "It's about how all these systems work together, not a bunch of separate things that are cool by themselves"
- "And everything will be interconnected?"
Why: he sees the app as "Wikipedia on steroids". A dead end feels like missing nuance.

**P2. One tap opens the thing. No in-between sheets or extra steps.**
- "clicking on color should open that color fully not a mini open then another click to read that doesn't make sense"
- "I hate that if you press in a color, you have to press the second time open page"
- "whether it's under an analysis of a painting, a hyperlink, or anywhere in the app"
Why: browsing should feel like Pinterest, fast and exploratory.

**P3. Every element is clickable, and every reference opens.**
- "the actual colors that do exist on the painting… They're unclickable, which feels like there's not enough hyperlinks"
- "if I click on Spino, the gem, it should open the article about it, right?"
Why: an unclickable color or name reads to him as a broken promise.

**P4. Nothing may look cheap or vibe-coded.**
- "still doesn't look like an expensive website"
- "This was better conceptually, it just looks cheap."
- "some of the mini games you built were just too basic too simple… somebody who is being conservative for their tokens"
Why: his bar is Duolingo, Apple and his own app Alter. Thin work reads as low effort.

**P5. Full screen, decluttered, phone first.**
- "There should be a more of a full screen view. I don't like the thing on the bottom that's light that stays there"
- "Remove the black bAr bellow"
- "This looks off don't forget I'm on iPhone 16 pro max"
Why: color is the content, so chrome steals from it.

**P6. Simple on the surface, deep underneath.**
- "his stuff is a bit too complicated and i dont want my app to make users overwhelmed"
- "I just don't want the app to be a clusterfuck."
- "without feeling like it's overwhelming everything still has to be clean"
Why: he wants both nerd depth and calm. Depth goes one tap down, never onto the first screen.

**P7. Depth by default; never one palette.**
- "I don't want just a single palette to represent them… I want as much info as possible"
- "derive as much color information as you can from it"
- "the colour pallet that the app tells you about ignores the colour that brought you to that page"
Why: the app "sees the whole world through color". Thin defaults mean the builder didn't get the product.

**P8. Show, don't tell: side by side, big.**
- "you got to show them side by side, otherwise it's not very functional"
- "it should be almost full screen. The color you were supposed to hit and the color you actually hit… large. That's easier to memorize."
- "See the correction and color comparison is too small if u get wrong"
Why: the eye learns from big, adjacent color, not from labels or numbers.

**P9. Less text. A name, maybe a number, nothing else.**
- "too much text is on it. Like you don't need to write anything except for the name. And maybe the percentage. But don't write the word different."
- "Right now the articles seem kind of boring and hard to read. It's just one single line of text"
- "Tldr"
Why: he reads on a phone, fast. Long text belongs in an opt-in, Wikipedia-style "Read" layer.

**P10. Related things sit near each other, and similar things sit together.**
- "The whole point of this menu is to have the colors be related, don't you think?"
- "Does Niagara green really belong in that spot feels like it's color differes from all the color surrounding it"
- "it seems like it will be part of a menu inside one of the menus, not its own standalone button"
Why: placement is meaning. An unrelated neighbor on the map, or a button in the wrong group, is a logic error to him.

**P11. Learning means look first, then get tested at your level, in varied ways.**
- "learning it is basically summary, where it doesn't hide the answer from you… And then flashcards is more of a way to test you."
- "learning like five colors at a time, like just the blues, then the reds, is boring… the way Duolingo does it with many different learning things"
- "option to pick your difficulty… the one that's on your level, which always adapts to you, both options should be available."
Why: he follows the mental-gym KB and Duolingo. Variety plus adaptation keeps people in flow.

**P12. Make it modular: sliders over fixed steps.**
- "maybe can be more dynamic like sliders so for example i can slide from 2700 to 10"
- "it says how many five, 10, 20 all. Instead, this should be a slider."
- "levels are split kind of linearly, but maybe if it was a slider, it could be more subtle"
Why: he wants the user in control of amount and difficulty, but only where a slider is convenient and its result is visible.

**P13. Convenience beats features.**
- "picking the style and the tweaks has to only exist in a way where you can see what's happening otherwise it's not convenient"
- "Changing the view is not convenient… not as convenient as it could be"
- "it's actually hard to exit that menu once you open it."
Why: a feature that is awkward to reach or leave counts as broken.

**P14. Navigation is reversible, like Pinterest.**
- "like Pinterest you could track your your steps and go back one step at a time"
- "you can instantly go back to the flashcards and keep learning"
- "If you scroll all the way to the top and then scroll down, only then would it close."
Why: exploration only feels safe if Back always returns you to where you were.

**P15. Motion should be smooth and alive, never wiggly or snapping.**
- "It's supposed to be more like the Apple Watch"
- "I want subtle yet beautiful and appealing not like crazy wiggling"
- "There should be no snapping. If something becomes smaller, it should be gradual."
Why: motion is part of "expensive". Jank is part of "cheap".

**P16. Solid controls, never see-through. Every gap even, no overlap, no empty space.**
- "See-through is really bad. Maybe these should be not see-through at all."
- "I don't like those empty gaps."
- "it has to be equal everywhere"
Why: he has a painter's eye for spacing, and uneven gaps are the first thing he sees.

**P17. One name, one system, no special lists.**
- "There's two names for a thing… What, how do we reconcile this?"
- "I don't view the 101 as some special list"
- "It should be a unified system"
Why: two names or two tiers of colors confuse learners and break the links.

**P18. Learnable English first; other languages are secondary.**
- "I don't see a reason learning colors in Japanese if this app is about learning colors in English"
- "Usually Japanese words is just harder to remember. So that could be a secondary description"
Why: the goal is noticing more colors in everyday English.

**P19. Grounded and honest, never hype.**
- "I want articles to also feel grounded not like buzzed articles"
- "The Color Library is pretty good. [Keep it as is: grounded, encyclopedic, sourced.]"
- "And ur adjustment for paper becoming more yellow is flawless?"
Why: he wants a real archive and resource, so he checks accuracy himself.

**P20. Be a skeptic: almost-good is not good.**
- "Sometimes the app is almost a good idea but doesn't really hit the goal perfect example being clicking on a painting seeing its colours"
- "we're kind of like dancing around the perfect Mechanic but we haven't hit the spot just yet"
- "don't be afraid to rethink something and be a skeptic"
Why: he expects the team to find the gap before he does.

**P21. Never regress what he liked.**
- "we've lost something in our app… we lost all the cool effects"
- "well this is a new thing this issue didnt exist in the last build"
- "The way it looked before was better… keep it as an alternate view"
Why: he remembers each good version. A new option goes beside a good default; it never replaces it.

---

## 2. Complaint triggers and how to catch them

| Trigger | His words | Detect in a screenshot | Detect in code |
|---|---|---|---|
| Tiny comparisons | "tiny little two little squares" | Any right/wrong pair under ~40% of screen width | Feedback swatches sized in fixed small px |
| Two-step open | "press the second time open page" | A sheet with an "Open page" button | `onclick` on a color that opens a sheet, not `colorPage`/`openTappedColor` |
| Unclickable color | "They're unclickable" | Swatch or name with no affordance | Swatch rendered without the shared tap handler |
| Text walls | "too much text is on it" | More than 2 lines of grey copy above the fold; repeated labels ("Looks like" ×3) | Paragraph copy in games and results; labels repeated in loops |
| Odd buttons | "Something is odd about… a button that says study the map" | More than 2 floating controls; a button in an unrelated group; mixed icon styles | New fixed-position buttons; `position:fixed` count |
| Covered content | (Train screenshot, "rooms button covering text") | Rooms button over a label or tile | Last row has no bottom padding for the 64px corner button plus the safe area |
| Black bars and dead space | "Remove the black bAr bellow" | Bands at the edges or bottom at 440x956; a centered narrow column | `max-width` columns, missing `env(safe-area-inset-*)`, fixed heights |
| Gaps and overlap | "I don't like those empty gaps" | Uneven seams, holes, overlapping bubbles | Layout not re-solved on slider input |
| Stuck or broken | "New glitch clicking color makes it stick"; "the screen goes white or black" | Blank screen; a view that won't change | Errors on heavy sets (2,700); handlers lost after a merge |
| Hard to exit | "hard to exit that menu once you open it" | A sheet with no clear close; tap-outside does nothing | No backdrop tap or swipe-down; swipe closes mid-scroll |
| Doesn't make sense | "path doesn't make sense", "spiral doesn't make sense" | Unrelated colors side by side; a mode with no clear goal | Ordering not by color distance; game rules with no stated aim |
| Two names / special lists | "There's two names for a thing" | A page title that differs from the tapped name; "closest of 101" | Lookups against a sub-list instead of the full name set |
| Snapping or jank | "the size of the circle snaps" | (video) jumps in size or position | Missing easing; per-frame work on 2,700 nodes |
| Thin depth | "just gives you sometimes an almost empty page" | A page with a hex and nothing else | Sections rendered only when hand-written data exists |
| Labels that don't say what they are | (memory: "In the app's words" became "Closest lesson word") | Jargon, mono lowercase labels, "units", "delta" | New UI strings never read by a non-builder |
| Long lists | "just a giant list… you'll never arrive at the end" | Lists of 50+ items with no filter or jump | Lists with no filter, sort or contents |

---

## 3. How he invents features (use these to extrapolate)

1. **Every X gets a page.** Color, then painter, then gem, then pair, then palette. Next, predict: a page for every decade, movement, country, museum and film.
2. **Do it for N.** "a page dedicated to the two… then we can do the same thing for three colors… a whole pallet". Every single-item feature gets pair and set versions.
3. **Mechanic transfer.** A good mechanic spreads: the honeycomb becomes Home, then the study map, then favorites ("use the honeycomb feature… to quickly select multiple colors"), then filters. Predict: map-based search, map-based quizzes, maps of a painting's colors.
4. **Turn the fixed thing into a slider.** Counts, tolerance ("within 3% accuracy… within 5% of a given painting"), difficulty and stages all become sliders.
5. **Apply analysis everywhere.** What works on paintings goes to uploads, painters, films ("palette of every shot… progression"), design history and fashion.
6. **Statistics as findings.** "which colors Monet likes to use the most", "rarest color ever used in painting", "which colors pair more often in paintings", percentiles against other people.
7. **Borrow from a named app or creator.** Duolingo (journey), Quizlet (study modes), Pinterest (back trail), Apple Watch (map motion), Alter (menus), Wii U and Minecraft (sounds), I Love Hue, Adobe Capture, Peter Donahue, TikTok paint-mixing videos.
8. **Learn from anything you're browsing.** "when you click on any color… you should be able to start learning it quite instantly". Predict: "Learn these" on any painting, palette, gem set or search result.
9. **Gamify the thing he enjoys.** A favorite game (Odd one out) gets levels, results, percentile, combinations with other modes and a solo practice entry.
10. **Brainstorm every way, then judge.** "brainstorm… tenfold… panel of judges". He expects many options, a panel to judge them, and the best ones shown to him as visuals to pick from.
11. **Personalize by purpose.** Ask the user's goal (painter, filmmaker, interior designer) and adapt the content to it.

---

## 4. The David critic: 12 questions, in his voice

1. If I tap any color, name, painting or gem here, does it open its page in one tap?
2. Is this full screen on my phone (440x956), with no black bars, dead space or button covering something?
3. Would this look expensive next to Duolingo or an Apple app, or does something look cheap?
4. Can I see the comparison big and side by side, not as two tiny squares or a number?
5. Is there any text I could delete and lose nothing?
6. Is everything next to things it relates to: colors by color, buttons with their own group?
7. Is this one palette or one reading where it could be ten? Did we get all the color info out of it?
8. Is this connected to the rest of the app: the map, color pages, learning, painters?
9. Can I go back exactly where I came from, and close it easily with a tap outside or a swipe?
10. Could a fixed choice here be a slider, and can I see the result while I slide?
11. Does it start at my level, let me pick another level, and teach by showing before testing?
12. Is this almost good or actually good? What would break first, and did we lose anything that was better before?

---

## 5. Ten predicted notes on the current app

Rendered 2026-10-08 at 440x956 via tools/_qa/frame.html (shots: `#/train`, `#/studio`, `#/museum`, `#/learn`, `#/color/periwinkle`, `#/painting/arnolfini`, `#shot=home`, `#shot=gx:miss`, `#shot=cpage:Cerulean`, `#shot=learnit:meet`, `#shot=lx:room`).

1. **Museum (#/museum), "For you" deck.** At 440 the card is a narrow column with black bands on both sides and a dead band at the bottom; the next card peeks in at the bottom edge. *"Black bars, not full screen."* Fix: make the card fill the full width and height, edge to edge, with safe-area insets.
2. **Train (#/train).** 16 tiles, most tagged "New", and the rooms button covers the "Color n-back" label. *"Too many games, feels like a menu, not a gym."* Fix: apply PLAN decision 4 (5 eye games plus Study the map), retire "New" tags, pad the grid's bottom for the corner button.
3. **Home map (#shot=home).** Five floating buttons (rooms, hexagon, cards, sliders, heart). The heart sits on top of Aubergine, and bubbles are cut off at both side edges. *"Weird buttons, too many."* Fix: one right-corner arc (PLAN decision 2); never place a control over a bubble.
4. **Odd one out results (#shot=gx:miss).** "Every miss" pairs are small and run off the right edge, and the headline "Eyes trained." sits next to "Level 13 → 11" (the level went down). *"Comparison too small, and this doesn't make sense."* Fix: one miss at a time, full screen, side by side and named; honest headline wording when the level drops.
5. **Results text.** The same results page carries a grey caveat paragraph, a mono "2.2% → 2.6% different" and three "New at level" lines. *"Too much text; don't write the word different."* Fix: one number, one line, details one tap away.
6. **Color page lower half (#shot=cpage:Cerulean).** About 11 collapsed accordions, "Culture" listed twice, a tab row that repeats the accordion titles, and "Connections" as tiny 12px squares with "Looks like" repeated. *"Looks like a settings list. Show me the colors."* Fix: dedupe sections; show look-alikes as big side-by-side swatches with names only.
7. **Color page top (#/color/periwinkle).** The swatch takes ~60% of the screen with nothing on it. The stat cards use lowercase mono labels ("the paintings") and are cut off at the right edge. *"Empty, and the cards are cut."* Fix: put a painting detail or the confusables strip in the hero, use body-type labels, and make the carousel's peek look intentional.
8. **Painting page (#/painting/arnolfini).** One palette of 6 chips with percentages and no names, and nothing below it on first paint. *"One palette again; which colors are these?"* Fix: names on chips, several readings (area, accents, lights and shadows), each chip opening its color.
9. **Learn it (#shot=learnit:meet).** A full grey screen with a small strip of 5 unnamed swatches at the bottom, and the caption says "4 colors". *"Show them big with their names; the count is wrong."* Fix: big tiles, each named; make the count match.
10. **Learn room (#shot=lx:room).** Strips sit above their own titles ("The path" strip, then "The in-betweens" under it reads as one block), there's a 150-word ladder, a Practice row, and the rooms button covers "Units". *"Confusing: what do I tap, and which strip is which?"* Fix: one "Begin" plus one ladder, with titles above strips; move Practice into "Your sets" (PLAN decision 3).

Also likely: the first-run screen (`#/home` with no save) shows a static color grid and a "Find my level" pitch. He'd say *"the honeycomb should be the first thing you see"* (he asked for Home to be interactive from the start).

---

## 6. Persona panel: four Davids

**The art lover.** He reads ColorHub as a museum seen through color. He wants painter pages with many palettes, decade and country statistics (by where the painter lived, not where the museum is), sharp large images, and every color in a painting tappable. He asks: "Does this tell me something about the painting I couldn't see myself?" Triggers: one palette, blurry images, "almost empty" pages, and statistics without plain-English findings.

**The learner.** He reads it as Duolingo for color words. He wants an instant start at his level, the answer shown before the test, varied modes in one session, sliders for size, results with percent and percentile, and spaced review. He asks: "Will I remember this tomorrow, and is it fun enough to come back?" Triggers: family-by-family units, games that are too hard or unclear ("path doesn't make sense"), and silent or tiny feedback.

**The designer.** He reads it as an Apple-grade object. He wants opaque controls, even gaps, no overlap, Apple Watch motion, subtle sound, and type that never shrinks below body size. He asks: "Is it iconic, and is every spacing decision deliberate?" Triggers: see-through glass, odd buttons, heavy vignettes, mono labels, snapping and anything that "looks cheap".

**The impatient phone user.** He has one thumb and ten seconds. He wants one tap to open, swipe down to close (only from the top of the page), Back to retrace his steps, nothing covered, nothing stuck, and 3-line answers. He asks: "Did it do what I meant on the first tap?" Triggers: second taps, menus he can't leave, accidental closes while scrolling, white screens on 2,700 colors, and walls of text.

Run all four on a screen. A note two or more of them would give is one David will give.

## Principle 22: curate, don't pile on (David, 2026-10-08)
"We don't want too many features, because then the user would be overwhelmed and would never reach certain features because the pages are too long. But we want the best features."

Keep only what matches the app's vibe and philosophy and gives the most function and fun for every type of user. Every addition must earn its place, and something else should usually leave or merge to make room.

Borrow from great apps, including ones outside this field (Tinder became the flashcards), but never their boring or outdated parts.
