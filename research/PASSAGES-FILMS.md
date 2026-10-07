# Passages and Films: sources, public-domain reasoning, method

Two archives in Explore (Ideas lens for now; they will join Poems in a "Words" lens later):

- **In books** (js/passages.js, data/passages.json): short passages where color does real work, from Homer to Woolf, each with its color words set in their own colors, a strip of the colors named, and one or two sentences of our own on why it matters.
- **Films** (js/films.js, data/films.js): short original pieces on how films use color, plus the earliest color films (before 1930), which are public domain and may show pictures.

Rebuild: `python3 tools/passages.py --fetch` (texts, cached in research/_raw/passages, gitignored), `python3 tools/passages.py` (passages.json + check), `python3 tools/passages.py --films a.json b.json` (films.js), `python3 tools/passages.py --check`.

## Passages

### The public-domain rule
US public domain only. A work qualifies if it was first published before 1930; a translation qualifies only if **the translation itself** was published before 1930 (the source text's age is not enough). We do not rely on the author's death date (that is the rule in most other countries, not the US). Every text comes from Project Gutenberg's US collection, whose clearance process checks US status; the source link on each passage points to the Gutenberg book page.

Gutenberg's robot policy asks bots not to crawl www.gutenberg.org. We read the catalog from the offered feed (`/cache/epub/feeds/pg_catalog.csv`) and fetched the texts once from a mirror (mirrors.xmission.com), with a descriptive User-Agent and a pause between files. The cache lives in research/_raw/passages/ (gitignored). Gutenberg's license and trademark text is stripped; the texts themselves are public domain.

### Works and their PD status

PDSTATUS

### Borderline calls
- **The Great Gatsby (1925), Mrs Dalloway (1925), The Guermantes Way (Scott Moncrieff, 1925), Death in Venice (Kenneth Burke's translation, 1925):** published 1925, US public domain since 1 January 2021. Fine.
- **The Tale of Genji, Arthur Waley's translation:** vol. 1 *The Tale of Genji* (1925), vol. 2 *The Sacred Tree* (1926), vol. 3 *A Wreath of Cloud* (1927), vol. 4 *Blue Trousers* (1928). All published before 1930, so US public domain (since 2021-2024). Waley died in 1966, so these volumes are still in copyright in the UK and the EU until 2037; the app is published from the US and cites them under US law. Waley's vols. 5-6 (1932-33) are **not** used.
- **The Pillow-Book of Sei Shōnagon, Arthur Waley (1928):** US public domain since 2024. Same UK/EU caveat.
- **Proust in Scott Moncrieff's translation:** Swann's Way (1922), Within a Budding Grove (1924), The Guermantes Way (1925). The Captive (1929) would qualify but is not on Gutenberg's US site, so it was not used.
- **To the Lighthouse (1927) and Orlando (1928):** US public domain, but not in Gutenberg's US collection, so not used here (no second source was needed).
- **Salammbô (PG 1290) and The Unknown Masterpiece (PG 23060):** the Gutenberg editions don't name the translator. Both were cleared by Gutenberg as US public domain (released 1998 and 2007, when clearance required a pre-1923 printed source). We show "an unnamed translator" and say so on the page.
- **War and Peace, Louise and Aylmer Maude (1922-23):** published before 1930. Fine.
- **The Travels of Marco Polo, Yule-Cordier edition (1903, notes 1920):** both before 1930.
- **Bible, King James Version (1611):** public domain in the US. (In the UK the KJV is under perpetual Crown prerogative; not relevant to US publication.)

### Method
1. `--candidates` ranks paragraphs of each work by color-word density (count and variety, normalised by length) and marks the color words.
2. Curators read the candidates plus known famous passages (`--find`) and chose 1-4 passages per work, trimming with `from`/`to`/`cut`, skipping false color words (a person named Brown, the fruit orange) with `skip`, and writing the title and context. Picks live in tools/passages.py (PICKS).
3. The color matcher (LEX in tools/passages.py) knows about 150 color words and their forms (whiteness, reddish, golden, crimsoned, sea-green, rosy, emerald…). Ambiguous words (rose, orange, olive, cream, lime, plum) count only in clearly color-like forms. Capitalised color words mid-sentence are treated as names (the Red Sea, Mr. Brown).
4. Each mention gets a display name and a hex: the app's own 101 colors first, then data/library.json, and for old words our own screen approximation of what the word meant (e.g. "rose" = a soft pink-red, "ebony" = near-black, "livid" = leaden blue-grey). Each also stores the nearest app color and its ΔE2000 distance; color pages show a passage under "In books" only when the match is close (ΔE2000 < 5) or exact.
5. Contexts are original, hedged ("critics often read…"), and checked against the CLAUDE.md myth list.

### Pictures
Passages show public-domain illustrations from early editions where they exist (e.g. W. W. Denslow's 1900 Oz plates), otherwise a PD/CC photo of the subject or a PD author portrait, from Wikimedia Commons, saved small (≤ 900 px) to img/passages/. Credit and license (with link for CC BY/BY-SA) are shown under every picture.

## Films

### Copyright rule
Films after 1929 are under copyright. For them: **no stills, no frames, no posters, no frame-sampled palettes**, and no quotes over 15 words (we avoid dialogue entirely). Each piece is our own 150-300 words, fact-checked against at least two sources (listed on the page), with interpretations hedged. The palette is 3-5 **named** colors we chose to illustrate what the text discusses, labelled "Colors discussed · chosen by name, not sampled". Pictures on these pages are only of real places, objects or public-domain paintings the text mentions (PD/CC from Commons, captioned as not from the film).

Early color films (before 1930) are US public domain: they show small Commons images (frames from colored prints, period posters) and a palette sampled from that scan (k-means in CIELAB, as for paintings), with a note that old prints fade. Faithful scans of public-domain films carry no new US copyright (Bridgeman v. Corel); we only use files Commons tags as public domain.

FILMNOTES
