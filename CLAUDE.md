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

## Tech
- Static site, no build tools needed yet. Deploy on GitHub Pages (same as `alter/`).
- `prototype/` holds the last cloud prototype (v3, "Play + modes"). David rejected its structure, but it has reusable parts: Lab/ΔE color math, a lookalike finder, color-family classification, a spaced-repetition scheduler, a hex gym and the color data (~165 colors with stories and painting hooks in `prototype/src/data.js`). Rebuild with `prototype/build.sh`.
- Progress is stored in localStorage for now. Accounts (e.g. Supabase) come later.
- Public-domain painting images come from Wikimedia Commons (upload.wikimedia.org). Hex values for Pantone, Crayola and pigments are screen approximations, and the UI should say so.
