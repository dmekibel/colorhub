# ColorHub (working name: Learn Colors)

An all-in-one color site, mobile first. David is the product owner. Read `PLAN.md` first, then `HANDOFF.md` for where things stand.

## The four goals
1. **Learn color words.** More color names lets you notice more colors. This is the goal of the learning/flashcard part only.
2. **Train artists to see.** An eye-training gym modeled on ear-training apps for musicians, plus a paint-mixing simulator.
3. **Educate.** History, culture and psychology of colors, famous paintings, and iconic design colors (Tiffany blue, Facebook blue…).
4. **Archive great palettes.** A curated palette archive (painters, films, designers), 3 to 20 colors each, for designers.

## Product rules (from David's feedback, 2026-10-06)
- **One clear learning path, one unit at a time.** No lesson-picking, no menu of game modes in the path. Basics (red, blue…) are placement only and never taught to adults who pass them.
- **Core loop = fast flashcards.** A quick "this is that" intro of about 10 colors, then a Tinder-style swipe deck (flip, then swipe right if you knew it, left if not) until every card is known. Thumb-driven, quick, slightly addictive.
- Thinky exercises (sorting light to dark, mixing, typing) live in the eye-training gym, never inside the flashcard loop.
- Wrong-answer options must be same-family neighbors (three blues), never obviously different colors.
- Painting palettes must be exact: pull about 6 colors from the real image and give each the most precise name, like "salmon pink", not "pink".
- Stories must be deep but honest. Every color gets a line on how it differs from its neighbor. Shared history lives at the family level, and only colors with a real history get a signature story.
- Beautiful UI; most use is on David's phone.

## Learning-science rules
Source: `../learning-kb/EXPORT-learning-kb-for-claude-project.md` (David's mental-gym KB). The rules that matter here:
- Recall before reveal: the name is recalled before it's shown. Never show the answer before the attempt is finished.
- Spaced review across days. The first gap crosses a night of sleep.
- Progress means delayed, unassisted recall, not XP or completion.
- Interleave neighbors once each one is known. Perceptual skills learn from many varied examples.
- Never promise anything from the KB's anti-claims list (§3). Example: the "jungle tribe with many greens" story is a misreported TV demo, so don't use it. The Russian blues study (Winawer 2007) is real but the effect is modest.

## Color myths: never state these as fact
Checked against 18 modern color books (private notes in `../color-kb/books/`, see `CONFLICTS.md` there). Mention a myth only to correct it.
- **Names and origins:** Newton's seven rainbow colors are natural bands (he chose seven to match the musical scale). Mauveine was the first synthetic dye, or the first commercial one (only "first aniline dye" is safe; picric acid dyed Lyon silk from 1845). Perkin found coal-tar colors in a rainbow film on a puddle (it was a failed quinine experiment). Murexide came from serpent excrement (bird guano). The navy-blue uniform was chosen to please a king's favorite (a legend; one book even names a king who was already dead). Drebbel found tin-scarlet by spilling acid (disputed). "Guarantee" comes from garance. Isabelline is Archduchess Isabella's unwashed linen. Indigo is corrosive or poisonous (woad growers' propaganda). Prussian blue releases cyanide. Natural indigo is a different or better blue than synthetic (same molecule).
- **Gems and minerals:** Nero watched games through an emerald like sunglasses (disputed). Amber holds dinosaur DNA. Celadon detects poison. The legendary Chai ware exists. The flecks in lapis are gold (they're pyrite).
- **Pigments and poison:** Arsenic wallpaper killed Napoleon (unproven). Indian yellow was banned for cruelty (no record of a ban; the mango-cow story is unverified). Chartres blue is a lost recipe. Bone black came from human corpses (mummy brown did). Rubens used cobalt blue.
- **Psychology and perception:** Baker-Miller pink calms aggression. Each color triggers one fixed emotion (red = anger, blue = calm). Colors heal (chromotherapy). Moonlight is blue light (it's reflected sunlight; moonlit scenes only look blue). Red, yellow and blue are the true primaries (a teaching convention; no three primaries make every color). Every color has one true complement (it depends on the system: painter's wheel, light, or perceptual). Pointillist dots mix in the eye into brighter colors (blue and yellow dots average to grey). Warm colors advance and cool ones recede (mostly chroma, and reversible). We have red, green and blue cones (say long, medium and short; the "red" cone peaks in yellow-green). Rods see brightness and cones see color (rods only take over at night). Black and white aren't colors (they're colors without hue). Color-blind people see no color (most see color but confuse some). Bulls are enraged by red. Pink was always for girls. A red room drives prisoners mad. Green paper is easiest to read (report the old belief as a belief). The Greeks couldn't see blue. Impressionists saw violet from afterimages or ultraviolet. The Inuit have dozens of snow words.
- **Culture and history:** Greek statues were white. Le Corbusier's architecture was all white. Santa's red suit comes from Coca-Cola. Queen Victoria started the white wedding dress. Medieval prostitutes wore a golden belt. Red in heraldry honors Crusader blood. Jeans were always rebel clothing. Ancient painters used only four colors. Napoleon started Empire green. Molière died on stage in green. The Tuareg name means "abandoned by God". The universe is turquoise (a 2002 error, corrected to beige). Half the world wears jeans on any given day (unsourced).
- **Books disagree, so hedge or leave out:** when cardinals got scarlet (say "in the 1460s, when Byzantine purple ran out"), the dates of the "Mauve Decade", who invented magenta (usually credited to Verguin), whether Caesar's Britons painted themselves with woad, the origin of "denim", where synthetic vermilion began, whether there were commercial synthetic dyes before mauve, and how many cochineal insects make a pound of dye (say "tens of thousands").
- **Birren (1950) claims marked "contested"** are old opinion, not modern evidence.
- **Book rule:** the color books are copyrighted. Write original prose from their facts; quotes stay rare, attributed and under 15 words. Never copy anything from `../color-kb/books/` into this repo.

## Tech
- Static site, no build tools needed yet. Deploy on GitHub Pages (same as `alter/`).
- `prototype/` holds the last cloud prototype (v3, "Play + modes"). David rejected its structure, but it has reusable parts: Lab/ΔE color math, a lookalike finder, color-family classification, a spaced-repetition scheduler, a hex gym and the color data (~165 colors with stories and painting hooks in `prototype/src/data.js`). Rebuild with `prototype/build.sh`.
- Before each push, bump the `?v=` tag on every script and stylesheet in index.html (one shared value, e.g. the date plus a letter), so phones never mix new HTML with cached old scripts.
- Progress is stored in localStorage for now. Accounts (e.g. Supabase) come later.
- Public-domain painting images come from Wikimedia Commons (upload.wikimedia.org). Hex values for Pantone, Crayola and pigments are screen approximations, and the UI should say so.
