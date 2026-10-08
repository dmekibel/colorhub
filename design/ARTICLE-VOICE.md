> **Voice decision (David, 2026-10-08):** "Keep it as is: grounded, encyclopedic, sourced." The pilot articles (Madder, Prussian blue, Mauve) are the models.

# Article voice: how ColorHub writes about a color

Learned from the 8 pilot articles (2026-10-08: Madder, Prussian Blue, Indigo, Mauve, Isabelline, Delft Blue, Dark Slate Grey, B'dazzled Blue). Every batch writer reads this, `data/articles/SCHEMA.md`, CLAUDE.md's myth list, and one pilot of the same tier before writing.

## The register

A good museum wall label crossed with a dictionary entry, written by someone who has read all 29 books and checked the archive. Specific nouns, dates, places, prices, names. Calm sentences. No hype, no "you won't believe", no rhetorical-question hooks, no exclamation marks, no "fascinating", "iconic", "stunning", "rich history", "throughout history", "since time immemorial".

The delight comes from the facts themselves, placed well: madder cost 30 shillings a hundredweight in 1868 and 8 a year later; the poison cyanide is named after the paint; in Japanese *ai* means both indigo and love. Put the strongest true fact where it lands, and stop.

## Rules

1. **English name first (David, 2026-10-08).** The article's `name` is always the learnable English name. Japanese, French and other names are secondary: in `aside.aka`, `aside.other_languages`, and a section such as "In Japan: ai-iro". Never title an article with a non-English word when an English name exists.
2. **Lede: one sentence that defines and hooks.** What the color is (in plain color words), where the name comes from, and the one thing that makes it matter. The lede has no note refs; everything in it is cited in the body.
3. **Every fact sentence carries a note.** A sentence with a date, number, name or claim ends with `[n]`. Connective or interpretive sentences ("It was not luck alone.") need none, but keep them rare and short. The gate enforces this.
4. **Name the books' disagreements in the sentence.** "Books disagree on the year: Ball and Paterson give 1820, Garfield 1827 [8][23][5]." Never silently pick one. Dates, names (Diesbach's first name), counts and "firsts" are where books disagree most.
5. **Myths: only to correct, and say what is true instead.** State the myth briefly, say it is a legend or wrong, give the evidence, give the truth. ("The story only appears in print in the nineteenth century, and the color name is older than the siege.") Use CLAUDE.md's safe wordings: "first aniline dye", never "first synthetic dye". Leave out a myth that does not touch this color.
6. **Hedge single-source and web-only facts.** "Garfield passes on a tale…", "Gurney credits…", "By Ball's account…". A fact only on a website gets a `web` note and a hedge if it is not institutional.
7. **The swatch is not the history.** Say plainly when the screen color differs from the historical thing: Indigo's chart swatch is violet-blue while the dye is dark grey-blue; Delft Blue the color is greyed, the pottery is cobalt; Isabelline on screens is near-white, Ridgway's Isabella is tan; Perkin's mauve was vivid, today's is dusty. Give the ΔE when it helps.
8. **Field notes are ours, and they are honest.** The last section is always "Field notes": what our archive, library and Ngram data show, with the n ("in 71 of 23,531 paintings"), the threshold ("within six units… at least five per cent of the canvas"), and the caveat ("photographs of aged, varnished paintings; a color match is not a pigment test"). The best field notes surprise and teach at the same time: Prussian-blue-like darks in 1400s paintings, centuries before the pigment existed; Van Gogh's *Roses* reading as all green today. Run `tools/article_gate.py --surprises <slug>` for lead candidates.
9. **Connect outward, inside the prose.** Link sibling colors, look-alikes and every other thing the sentence is about where they come up naturally: `[[alizarin]]`, `[[painting:nga-72328|Roses]]`, `[[gem:spinel|spinel]]`, `[[flower:madder|madder]]`, `[[look:art-nouveau|Art Nouveau]]`, `[[garment:<id>|a textile]]`, `[[film:vertigo|Vertigo]]`, `[[painter:john-singer-sargent|Sargent]]` (kinds, ids and the closeness rule: `data/articles/SCHEMA.md`). At least four connections per article (gate). Link the painting, gem, flower or film when our data has it: David wants every reference to be alive in the article. The reader turns each into a chip and, when the thing really is close in color, a picture card with "94% match to <this color>", so name the thing when you mean it as a color match ("the pink of a spinel"), and keep a reference out of a sentence where it is only a comparison in passing (a card follows its paragraph). Always add the `|label` and read it aloud inside the sentence: it must work as plain words. You do not place pictures or choose the closing "Seen in" strip; the reader does, from the data.
10. **Teach the eye.** Each article should leave the reader able to notice the color somewhere: madder beside indigo in old carpets, the white core of a worn indigo thread, a washed-out Prussian-blue sky. One "where to look" line, usually in `openers`.
11. **Paragraphs of 2–4 sentences, sentences under ~35 words.** The gate warns over 45. Split long data sentences in two.
12. **No quotes, almost.** Paraphrase everything. A quotation is allowed only when the exact words are the point, stays under 15 words, and is attributed. The pilots use none longer than a two-word phrase ("mauve measles").
13. **Never copy from color-kb.** Facts in, your own sentences out. Do not follow a book's paragraph order or its turns of phrase.
14. **Check questions test understanding.** 2–3 per article: one "why" question, one myth true/false where there is a myth, one that a reader who saw the color would get right. Wrong choices are plausible.
15. **Say "undocumented" when it is.** "Who coined it is undocumented." A short honest article (B'dazzled Blue, 229 words) beats a padded one.
16. **Never "the 101".**

## Shape by tier (what the pilots did)

| Tier | Pilot | Words | Sections, in order |
|---|---|---|---|
| Pigment / dye (epic) | Madder 1,960; Prussian Blue 1,654 | 1,500–3,000 | name · material/discovery · history · trade · the special process (Turkey red) · art/painters · chemistry or fading · Japan or other world thread · myths · field |
| Traditional (filed under English) | Indigo 992 | 600–1,500 | which "indigo" (swatch vs dye) · name · chemistry · history · **In Japan: ai-iro** (plant, process, dip-count names, linked to our jp library names) · field |
| Nature | Mauve 1,008 | 600–1,500 | the flower's name · the fashion before the dye · the chemist · the craze · legacy (with the "first aniline dye" hedge) · paint and words · field |
| Person | Isabelline 498 | 300–900 | the story and why it is wrong · what the word meant · the swatches · field |
| Place / institution | Delft Blue 502 | 300–900 | the place and its product · how the name drifted (swatch) · field |
| Standard | Dark Slate Grey 373 | 200–600 | lineage (file → spec → browser) · why it looks odd · field |
| Commercial | B'dazzled Blue 229 | 150–400 | where the name comes from (or "undocumented") · flat swatch caveat · field |

## Sources, in order of trust

1. The 29 books via `../color-kb/concordance/by-color/<slug>.jsonl` and `../color-kb/books/notes.jsonl`; read around strong hits in `books/text/`. Specialist books win on their subject (Garfield on mauve, Balfour-Paul on indigo, Ball and the Pigment Compendium on pigments). Check `books/CONFLICTS.md`.
2. Public-domain classics (Pliny, Field, Werner/Syme, Greenaway) via `../color-kb/atoms.jsonl`.
3. Our data: `tools/article_field.py`, `data/graph/` (L6 fieldnotes, look-alikes, twins), `data/library.json`, `data/passages.json`, Ngram cache in the main checkout's `research/_raw/ngrams`.
4. Web, only for facts the books leave open (Japanese print history, X11 history, Crayola dates): museum and institutional pages first, Wikipedia with its cited source, collector sites hedged.

## Pipeline per color (what worked)

1. Pull notes for the slug and its aliases (`notes-by-color.json`), then the concordance hits book by book; read the full-text passage behind every number you will use.
2. Write fact cards to `../color-kb/facts/<slug>.jsonl` (claim, sources with locators, H/M/L, theme, conflicts). 15–45 cards for an epic, 5–10 for a short.
3. Run `tools/article_field.py "#hex" --ngram <word>` and read the graph fieldnotes; add the numbers you will quote as `data` cards.
4. Write the article from the cards only.
5. Self-check: each sentence → a card; myth list; hedges; swatch-vs-history line; field caveat. Record open issues in `checked.issues`.
6. `python3 tools/article_gate.py <slug> --write-words` until PASS.
