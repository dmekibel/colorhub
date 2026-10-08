# data/articles/<slug>.json: the article schema

One file per article. Written by the article engine (lane L7), read by the article UI (lane L8). Gate: `python3 tools/article_gate.py` must PASS before an article is committed. Voice rules: `design/ARTICLE-VOICE.md`.

## Top level

| Key | Type | Meaning |
|---|---|---|
| `slug` | string | File name without `.json`. Always `routeSlug(name)` form (js/router.js): lowercase ASCII, hyphens. `B'dazzled Blue` → `b-dazzled-blue`, `Konjō-iro` → `konjo-iro`. |
| `name` | string | Display name. Always the learnable **English** name. Other-language names go in `aside.aka` / `aside.other_languages` and a section (e.g. Indigo carries a "In Japan: ai-iro" section). |
| `hex` | `#RRGGBB` | The swatch the page shows. For a family article (Madder) it is the most standard member (Madder Lake). |
| `names` | string[] | Every color name in data/core-names.json or data/library.json this article serves. The UI shows this article on each of those names' pages. First entry = the main one. |
| `tier` | enum | Origin of the name: `pigment` (pigment, mineral, dye), `traditional` (Japanese and other traditional systems, filed under the English name), `nature`, `place` (places and institutions), `person`, `standard` (CSS/X11, ISCC-NBS, NCS…), `commercial` (Crayola, paint brands), `descriptive` (Light X; normally no article). |
| `depth` | enum | Length class: `epic` 1,500–3,000 words, `long` 600–1,500, `medium` 300–900, `short` 200–600, `brief` 150–400. Defaults by tier: pigment→epic, traditional/nature→long, place/person→medium, standard→short, commercial→brief. A nature or person color with a book-length history may go one depth deeper (gate-checked by word count only). |
| `lede` | string | One sentence (two at most). What the color is and why it matters. No note refs. |
| `sections` | object[] | Ordered. See below. |
| `aside` | object | The family-tree / origin box. See below. |
| `field` | object | Compact computed facts that the prose quotes (see below). Free-form keys, but numbers in prose must match. At least 3 keys. |
| `notes` | object[] | Numbered sources. See below. |
| `questions` | object[] | 2–3 check questions. They come back as Journey steps 1–7 days after reading. |
| `openers` | string[] | 1–3 one-line hooks, for Explore cards, lesson feedback, Did-you-know, share previews. Each must be true and sourced in the body. |
| `words` | int | Word count of lede + section bodies (refs and markup stripped). `article_gate.py --write-words` fills it; the UI uses it for reading time (~200 wpm, shown only past 2 minutes). |
| `status` | enum | `pilot` · `draft` · `checked` · `live`. |
| `checked` | object | `{by, date, issues[]}`: who fact-checked, when, and the open caveats (conflicts, web-only facts). Not shown to readers. |

## sections[]

```json
{"id": "turkey-red", "title": "Turkey red", "body": "…"}
```

- `id`: kebab-case, unique in the article; used for the table-of-contents chips and `#/color/<slug>#<id>` anchors.
- `title`: short noun phrase, sentence case.
- `body`: plain text. Paragraphs separated by `\n\n` (2–4 sentences each). Inline markup, the only kinds allowed:
  - `[n]`: a note reference, one or more after the sentence's final punctuation is fine, or before it. Render as a superscript link to note n.
  - `*text*`: italics (titles of works, foreign words, words-as-words).
  - `` `text` ``: code (CSS keywords only, e.g. `darkslategray`).
  - `[[slug]]`: a link to a color. Resolves to an article if `data/articles/<slug>.json` exists, else to the color's page (`#/color/<slug>` for the app colors, `#/name/<slug>` for library names, the router decides). Label = that color's display name.
  - `[[slug|label]]`: same, with custom text.
  - `[[art:<painting-id>|label]]`: a painting in data/gallery (`#/gallery/…`). The id is the gallery id (e.g. `nga-72328`).
  - Never raw HTML.
- Common section ids (use them when they fit, so the UI can give them icons): `name`, `material`, `chemistry`, `discovery`, `history`, `trade`, `art`, `painters`, `japan` (or another tradition), `myths`, `swatch`, `field`. **`field` is always last** and holds the "Field notes" prose (our own data, always with n and "as photographed").

## aside

```json
"aside": {
  "origin": {"named_after": "…", "first_recorded": "…", "source": "…"},
  "aka": ["Berlin blue", "…"],
  "siblings": ["berlin-blue", "paris-blue"],
  "parent": null,
  "children": ["midnight-blue"],
  "disambiguation": ["One line each"],
  "other_languages": [{"lang": "ja", "name": "bero, Konjō-iro (紺青色)"}]
}
```

- `origin.named_after`: plain words; say "origin undocumented" when true.
- `aka`: alternative names, display text (not slugs).
- `siblings` / `parent` / `children`: **slugs** that resolve to a slug in `data/graph/names.json` or to an article (gate-checked). Siblings = same material or same name in other systems; children = modifiers and named variants.
- `disambiguation`: lines for same-name-different-color cases (Indigo vs Indigo Dye; Isabelline vs Isabella Color).

## notes[]

```json
{"n": 8, "kind": "book", "cite": "Ball, Bright Earth, ch. 17", "loc_kind": "epub-chapter", "url": null}
```

- `n`: integer, unique. Numbers need not be contiguous (a removed note leaves a gap); render in numeric order.
- `kind`: `book` (one of the 29 color books, or a public-domain classic), `data` (our own computed data: archive, library, Ngram), `web` (verification source; must have `url`).
- `cite`: Author, short title, locator. Locators follow the source: printed chapter titles where the book has them ("Finlay, Colour, ch. 8 (\"Blue\")"), PDF page numbers where the concordance gives pages ("Balfour-Paul, Indigo, p. 116"), entry names for dictionaries ("Paterson, A Dictionary of Colour, \"alizarin\"").
- `loc_kind`: `epub-chapter` · `book-chapter` · `pdf-page` · `entry` · null. Tells a reader how to interpret the locator.
- Book text is never in the repo. Notes cite; they do not quote.

## questions[]

```json
{"q": "…", "choices": ["…", "…"], "answer": "…", "kind": "pick"}
```

- `kind`: `pick` (3–4 choices; wrong choices plausible, never silly-obvious) or `true-false` (choices `["True","False"]`).
- `answer` must be one of `choices`, and must be a claim made (and cited) in the body.
- Prefer questions that test seeing or reasoning ("why do old Prussian-blue skies look washed out?") over trivia dates.

## field

The numbers the prose quotes, so the UI can draw them (charts, shelves) and later regenerations can diff them. Produced by `python3 tools/article_field.py "#hex" --ngram word` (archive presence, top paintings, first dated painting, century and decade lift, painters, countries, movements, role in the painting's lightness order, company, Ngram curve, data-born surprises) plus `data/graph/` (L6: look-alikes `la`, twins `tw`, `fieldnotes/`). Typical keys: `dataset`, `match {hex, de2000, min_cover}`, `n_present`, `top_paintings` (gallery ids), `painters`, `role`, `company`, `ngram`, `measured {lch, contrast_white, nearest}`. Every archive number is "as photographed".

## Private side (never in this repo)

`../color-kb/facts/<slug>.jsonl`: one atomic fact card per line, `{id, claim, src:[{book|web|data, loc}], conf: H|M|L, theme, nodes[], edge?, conflict?}`. Every sentence in the article traces to a card. Cards may paraphrase books; they never leave color-kb. The gate warns if an article has no cards file.

## What the gate fails on (`tools/article_gate.py`)

- Invalid JSON; a missing required key; `slug` not equal to the file name or not in routeSlug form; a bad hex; an unknown `tier`, `depth` or `status`.
- Length (lede + section bodies, refs and markup stripped) outside the bounds of `depth`.
- `words` not equal to the computed count (fix with `--write-words`).
- A `[n]` with no note; a note with a bad kind, an empty cite, or (web) no url; a fact sentence (a digit, or a capitalised word after the first) with no `[n]` (the lede is exempt).
- A quotation over 15 words.
- A phrase from the CLAUDE.md myth list without a correcting cue (myth, legend, not, never, claim, rumor, disputed…) in the same sentence or the next.
- The words "the 101".
- A `[[slug]]` link, or an aside sibling/child/parent, that resolves to no slug in `data/graph/names.json` and no article; an `[[art:id|label]]` not in `data/gallery`.
- Not 2–3 questions, a bad question kind, or an answer not among its choices.
- Fewer than 4 connections (siblings + children + parent + `[[links]]`) or fewer than 3 `field` keys.

Warnings (do not block): a 10-word run shared with a private book text, an unused note, a sentence over 45 words, a missing private fact-card file.
