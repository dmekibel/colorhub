# ColorHub: the plan (2026-10-06)

Live, editable version: https://claude.ai/code/artifact/ec29def4-0026-4608-8e16-ae2ad2ce25ac

## The goals
1. **Learn color words.** The flashcard path gives you more color names so you notice more colors.
2. **Train artists to see.** Eye-training drills and paint mixing build the skill of judging hue, value and temperature.
3. **Educate.** The history, culture and psychology of each color, and the famous paintings and designs where it lives.
4. **Archive great palettes.** Curated palettes from painters, films and designers, 3 to 20 colors each.

The science behind goal 1: Russian speakers, who have separate words for light blue (goluboy) and dark blue (siniy), tell those blues apart faster (Winawer et al. 2007, PNAS). The effect is real but modest. Words give you handles, and practice with feedback sharpens the eye. The app does both.

## The curriculum
One path, one unit at a time, each unit about 10 colors from one family. A 60-second swipe placement test at the start puts you at the right tier.

| Tier | What it adds | Examples | Size |
| --- | --- | --- | --- |
| 1. Basics | The 11 basic words, placement only | red, blue, brown, grey | 11 |
| 2. The in-betweens | The everyday words from the "men see 11 colors, women see 50" meme | teal, navy, maroon, coral, salmon, beige, khaki, olive, mint, lavender, mauve, mustard, taupe, charcoal | ~35 |
| 3. The designer's vocabulary | Precise names designers and painters use | cerulean, cobalt, vermilion, carmine, ochre, sienna, celadon, chartreuse, aubergine, ecru, gunmetal | ~60 |
| 4. Pigments and their stories | Real paints with their history | ultramarine, Prussian blue, lead white, Tyrian purple, mummy brown | ~30 |
| 5. Iconic design colors | Colors that became brands and objects | Tiffany blue, Facebook blue, Hermès orange, Barbie pink, Klein blue, Ferrari red | ~30 |
| 6. Color systems | Pantone, RAL, CSS names, reading hex | Pantone Colors of the Year, #RRGGBB | ~60 |
| 7. World color traditions | Other cultures' color words | Japanese, Chinese, French traditional colors | ~60 |

## The core loop
1. **Meet the unit** (about 1 min): ten cards, each with a big swatch, the name, and one line on how it differs from its neighbor ("Teal: greener and darker than turquoise"). Swipe up for the next card, with neighbors shown side by side.
2. **Got it?** One tap starts the deck.
3. **Swipe deck:** a swatch fills the screen. Say the name in your head, tap to flip, then swipe right if you knew it and left if not. Each card takes about 2 seconds. Left-swiped cards come back until all are right.
4. **Reverse cards** (name to swatch) mix in once you know a color.
5. **Daily review** uses the same swipe deck, spaced over days.

## Eye training (a separate gym, like ear training for musicians)
- **Same or different?** The gap shrinks as you improve (staircase), so it finds your limit.
- **Lighter or darker?** Value judgment.
- **Warmer or cooler?** Greys and whites.
- **Sort the strip:** order 5 to 8 close colors by value.
- **Paint mixing:** a target color and real paints (titanium white, ivory black, cadmium yellow, cadmium red, ultramarine, burnt umber). Tap to add drops and mix them the way pigments really mix (Mixbox).
- **Progress** is shown as your current limit, like "you can now tell apart greys that differ by 2%".

## Stories
- **Every color:** one line on how it differs from its nearest neighbor.
- **Family stories:** shared history, told once per family (for example, the purple dye that cost more than gold).
- **Signature stories:** only for colors with their own history (IKB, mauveine, pink's gender flip).
- **Iconic design colors pack:** Tiffany, Facebook, Coca-Cola, Hermès, Barbie, UPS brown, John Deere, Ferrari, Cadbury.
- Cite sources and avoid myths (for example, "red makes you win").

## Paintings and the palette archive
- Real public-domain images from Wikimedia Commons.
- 6 main colors per painting, weighted by area, each with its closest precise name and how close the match is. Tap a swatch to highlight where that color sits in the painting.
- **Archive:** palettes from painters, films and designers, with each color's role and share, artist timelines (Monet by year), and export to CSS, Figma, Procreate and Adobe. Films and recent art show color data only, no images.

## Goals to add or sharpen (Claude's suggestions)
- **A color eye score:** the smallest difference you can spot per family, tracked over weeks and shareable.
- **A page for every color** (name, story, neighbors, paintings, palettes, hex/RGB/CMYK/closest Pantone): a reference people return to, and search traffic.
- **Name any color in the world:** use the camera or a photo to name its colors with the words you've learned.
- **Connect the parts:** learned words unlock paintings and palettes, and a saved palette becomes a deck.
- **Daily color,** Wordle-style: its story, a 30-second deck and a painting.
- **Real-work matching:** skin tones, wall paint, print vs screen.
