# Color data and the law: encyclopedias, Pantone and proprietary systems (R1 §7–8, 2026-10-08)

> **This is not legal advice.** It is a research summary by a non-lawyer, built from public sources linked below. Laws differ by country, and the points marked **⚖ counsel** need a qualified IP lawyer's review before any commercial launch (subscriptions, ads, merch, paid export).

**The short version:**
- A color value is a fact.
- A single color name is a short phrase.
- Neither is protected by copyright in the US.
- Protection does attach to brand names (**trademarks**), to some **compilations** (the selection and arrangement of a whole system), to the **physical products** (fan decks, books), and in the EU and UK to **databases** built with substantial investment.
- So we may *talk about* any color system and cite single codes in context. We may not *rebuild or redistribute* a proprietary library.

---

## 7. Color encyclopedias and datasets: what's there, the terms, and what we may take

Key: **Take** = what we can use. **Don't** = what we must not copy. Checked 2026-10-08.

### 7a. Open datasets worth importing or cross-referencing

| Dataset | What it holds | License / status | Take | Don't | Link |
|---|---|---|---|---|---|
| **ISCC-NBS Dictionary** (NBS Special Publication 440, 1976) and the **centroid colors** | 267 named color blocks over Munsell space, plus thousands of synonyms from older dictionaries | A US federal government work, so public domain in the US (17 U.S.C. §105) | Everything: names, blocks, centroids. We already have `data/sources/iscc-nbs-*.json` | n/a | [NIST PDF](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nbsspecialpublication440.pdf) |
| **Maerz & Paul, *A Dictionary of Color* (1st ed., 1930)** | About 4,000 names; 7,056 swatches on plates; origins and dates | **In the US public domain since 2026-01-01**: 1930 works entered it that day. **⚖ counsel** before use outside the US. The **1950 2nd edition is not** public domain. | Names, plate and cell, origin notes (as facts, in our words), swatch colors measured from 1930 scans | 1950-edition material; long quotes | [Duke CSPD 2026](https://web.law.duke.edu/cspd/publicdomainday/2026/) |
| **Ridgway, *Color Standards and Color Nomenclature* (1912)** | 1,113 colors on 53 plates (21 each) | Public domain (Project Gutenberg edition; Ridgway died 1929) | Names plus plate colors | Modern scan-site layouts | [Gutenberg](https://gutenberg.org/cache/epub/63087/pg63087-images.html), [Smithsonian](https://siarchives.si.edu/collections/siris_arc_217324) |
| **Werner's *Nomenclature of Colours* (Syme, 1821)** | 110 colors, each with animal, vegetable and mineral examples | The book is public domain. Rougeux's c82.net *site design* is his own work | Names, descriptions as facts, nature examples (re-researched) | His site's images, layout or photos | [c82.net/werner](https://www.c82.net/werner/) |
| **Munsell Renotation data** (1943; RIT) | The x, y, Y coordinates for Munsell notations (about 2,700 real colors in `real.dat`; the revised re-renotation has 2,986) (`real.dat`, `all.dat`) | Published research data, freely downloadable from RIT. The **notation system** is public science; "Munsell" is a **trademark** (now X-Rite/Pantone) | "Nearest Munsell notation (computed)" for every color | Implying an official Munsell match; copying *Book of Color* chips | [RIT MCSL](https://www.rit.edu/science/munsell-color-science-lab-educational-resources), [IEEE re-renotation](https://ieee-dataport.org/documents/munsell-re-renotation-revised) |
| **xkcd color survey** (954 names, from several hundred thousand participants) | The most common monitor color names | **CC0** | All of it, as "everyday names" | n/a | [license note](https://chuck.stanford.edu/chai/data/xkcd/license-credits.txt), [CTAN](https://ctan.org/tex-archive/macros/latex/contrib/xkcdcolors?lang=en) |
| **colornames.org** | Crowd names with vote counts | Data download is **CC0**; website content is CC BY-NC-SA | The data dump (filter it hard; many joke names) | Website text | [download](https://colornames.org/download/) |
| **color-name-list** (meodai) | 31,918 unique names | **MIT**, but compiled from mixed sources (Wikipedia, Crayola, paint and nail-polish lists, ML-generated names) | Use it for **cross-checking**, plus the subsets whose upstream is open (Werner, xkcd, CSS) | Bulk import: MIT can't clean brand-name upstreams | [README](https://unpkg.com/color-name-list@14.50.0/README.md) |
| **Name That Color (ntc.js)** | About 1,500 names | CC BY 2.5 (per its package) | Cross-check, with attribution | Code without attribution | [npm](https://www.npmjs.com/package/ntc) |
| **Sanzo Wada, *A Dictionary of Color Combinations*** (1933–34) | 348 combinations of 159 colors | mattdesl's JSON is **MIT**. Wada died 1967, so the book is likely public domain in Japan. **⚖ counsel** on US and EU status; the Seigensha reprint has its own layout rights | The combinations as facts (which colors pair) | Seigensha page images | [GitHub](https://github.com/mattdesl/dictionary-of-colour-combinations) |
| **Wikidata** | Color items, hexes, links to pigments and people | Structured data **CC0** | Hex, inception dates, links | n/a | [Licensing](https://www.wikidata.org/wiki/Wikidata:Licensing) |
| **Wikipedia color lists** | Names, hexes, a source per list | Text is **CC BY-SA 4.0**. Individual names and hex values are facts | Names, hex values, the source lists they cite (then verify upstream) | Pasting article prose (that triggers ShareAlike) | [List A–F](https://en.wikipedia.org/wiki/List_of_colors:_A%E2%80%93F), [Reuse](https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia) |
| **CSS / X11 named colors** | 148 web names | A public W3C standard; names are facts | All | n/a | (W3C CSS Color spec) |
| **Google Books Ngram** | Word frequency by year | Compilation under **CC BY 3.0** | Curves, with attribution | n/a | [datasets](https://storage.googleapis.com/books/ngrams/books/datasetsv3.html) |
| **Museum open data** | Paintings and metadata | Met: public-domain works under **CC0**. AIC: data **CC0**, but the `description` field is **CC BY 4.0**. Rijksmuseum: public-domain images since 2013 | Images and metadata for public-domain works | AIC descriptions without credit; in-copyright images | [Met](https://www.metmuseum.org/hubs/open-access), [AIC API](https://api.artic.edu/docs/), [Rijksmuseum](https://data.rijksmuseum.nl/) |

### 7b. Reference sites: read and cite them, don't import

| Site | What it holds | Terms (as found) | Take | Don't |
|---|---|---|---|---|
| **Encycolorpedia** | A page per hex: conversions, related names, schemes, paint matches with ΔE and LRV across many brands (RAL, NCS, Coloro, Farrow & Ball, Sherwin-Williams, Benjamin Moore, Crayola, TRUMATCH, HKS, Toyo…), color-blind simulations, WCAG contrast; an OpenAPI | No open license found. Treat as all rights reserved. **No Pantone in its brand list** (checked 2026-10-08) | Ideas and individual facts, verified by hand; our own computations | Scraping, the API in bulk, its brand-match tables. ([paints](https://encycolorpedia.com/paints), [API](https://encycolorpedia.com/api)) |
| **ColorHexa** | Conversions into about 12 spaces, schemes, a blindness simulator | © 2012–2026; no open license | Nothing needed: we compute all of this ourselves | Copying pages |
| **color-name.com** | Hex pages and names | Terms owned by SimplyGraphix LLP; it says it uses logos and images under "fair usage" | Nothing | Copying ([terms](https://www.color-name.com/terms)) |
| **ColourLex** | A pigment lexicon, painting pigment analyses, timelines | No open license found; it sells a book and teacher resources | Facts (which pigment was identified in which painting) re-sourced to the underlying scientific papers, with citation | Text, images, timelines as drawn ([site](https://colourlex.com/)) |
| **The Color of Art Pigment Database** | Color Index names and numbers, chemistry | No open license found | Color Index codes and chemical names are facts. Cross-check them against the Colour Index (SDC/AATCC) | Its tables and descriptions ([site](https://www.artiscreation.com/Color_index_names.html)) |
| **The Secret Lives of Colour** and the 29 books in color-kb | Narrative color history | © the publishers | Facts in our own prose; quotes under 15 words, attributed | Anything copied, per CLAUDE.md |

### 7c. Proprietary systems: public information versus the product

| System | What's public | What's the product, and protected | Our use |
|---|---|---|---|
| **Pantone** (PMS, FHI, COTY) | The fact that it exists; individual codes cited in news and history (e.g. Pantone 448 C for plain cigarette packs) | The libraries and color data (Pantone says it owns the copyright in its "color data", per licensee notices); the PANTONE marks; guides and chips | Nominative mentions only. No library, no "nearest Pantone" tool. See §8 |
| **RAL** (Classic etc.) | The existence of codes, and individual codes in context | RAL claims trademark (the name and logo) and **copyright** in its color collections and system, and forbids unauthorized physical or digital reproduction. A 1998 German appeals court (OLG Düsseldorf, 2 U 102/98) still let a third party make a color overview "according to RAL" | Mention individual codes in context. **No RAL matcher before counsel** | 
| **NCS** | The notation logic (blackness, chromaticness, hue) is published science | NCS Colour AB: trademark and copyright; **commercial use requires a license** | Explain the system; no NCS code lookup |
| **Munsell** | The notation and the renotation data | The *Book of Color* (Glossy Edition about $900 or more) and the trademark | Computed "≈ Munsell" with a notice |
| **Coloro** | How the code works: hue 000–160, lightness 00–99, chroma 00–99 | The library (4,459 stocked standards) | Explain it; no library |

Sources: [Pantone notice via licensee](https://learn.foundry.com/colorway/Content/legal.html), [RAL legal notice](https://www.ral-farben.de/en/legal-notice), [OLG Düsseldorf via freiefarbe](https://freiefarbe.de/en/?p=118), [NCS terms via ASTM E2970](https://store.astm.org/e2970-22.html), [Munsell Book (Pantone store)](https://www.pantone.com/munsell-book-of-color-glossy-edition), [Coloro system](https://www.coloro.com/the-coloro-system).

---

## 8. Legal: Pantone and the other proprietary systems

### 8.1 Is a color value copyrightable? No.
- US copyright needs original creative expression. Facts don't qualify (*Feist v. Rural*, 1991).
- The Copyright Office's rule lists **names, short phrases** and "mere variations of… coloring" as not copyrightable (37 CFR §202.1).
- So `#BB2649` is a fact, and so is "Viva Magenta" as a phrase.
- Sources: [37 CFR 202.1 (eCFR)](https://www.ecfr.gov/current/title-37/chapter-II/subchapter-A/part-202/section-202.1), [Cornell LII](https://www.law.cornell.edu/cfr/text/37/202.1).

### 8.2 What about a whole system or database? Partly protected.
- **Compilation copyright (thin):** the creative *selection and arrangement* of a system can be protected, even though each color can't. Before the 1976 Act (and before *Feist*), Pantone won a preliminary injunction against a competing seller of booklets ([Caponigri 2026, summarized by Tushnet](https://tushnet.com/2026/02/28/wipip-panel-6-design-and-brand-protectable-subject-matter-copyright-theory-and-doctrine-ii/)). How far that holds after *Feist* is untested here. **⚖ counsel.**
- **EU and UK sui generis database right:**
  - It protects a **substantial investment in obtaining, verifying or presenting** contents. It lasts 15 years and renews when the database is substantially changed.
  - It bars extracting or reusing the whole or a substantial part ([European Commission](https://digital-strategy.ec.europa.eu/en/policies/protection-databases)).
  - The CJEU held that investment in **creating** the data doesn't count, only investment in obtaining and verifying existing materials (*BHB v William Hill*, C-203/02, 2004; [CJEU press release](https://curia.europa.eu/en/actu/communiques/cp04/aff/cp040089en.pdf)).
  - Whether a system like Pantone or RAL qualifies is arguable both ways. **⚖ counsel.** The practical answer: **never extract a substantial part of any library.**
- **Contract and terms:** licensees of Pantone data agree not to print Pantone-identified color guides or swatch printouts ([licensee notice](https://learn.foundry.com/colorway/Content/legal.html)). We are not a licensee. We would have no Pantone data to leak, because we wouldn't take any.

### 8.3 Trademarks: names and numbers
- **PANTONE®** and its other marks belong to Pantone LLC, a subsidiary of X-Rite ([licensee notice](https://learn.foundry.com/colorway/Content/legal.html), [pantone.com footer](https://www.pantone.com/pantone-connect)). "PMS 186 C" mainly identifies *Pantone's* system, so using it is a **nominative** use of their mark.
- **Nominative fair use (US, Ninth Circuit, *New Kids on the Block*)** has three factors ([FindLaw](https://caselaw.findlaw.com/us-9th-circuit/1233126.html)):
  1. the thing can't readily be identified without the mark;
  2. you use only as much of the mark as needed;
  3. you imply no sponsorship.
  Other circuits and the EU use different tests. **⚖ counsel.**
- **Brand color names are registered marks** (for paint and crayons, not as words in general):
  - Farrow & Ball: "Elephant's Breath" (US serial 77567868, filed 2008) and dozens more ([Justia](https://trademark.justia.com/owners/farrow-ball-holdings-limited-1560397)).
  - Crayola: "Outer Space", "Pink Flamingo", "Granny Smith Apple" and others (filed 2008) ([Justia](https://trademarks.justia.com/owners/crayola-properties-inc-2462009/page2)).
  - **RAL** and **NCS** are marks as well.
- **Color marks** (a single color as a brand) exist and get litigated. This is good material for articles and safe to report as facts:
  - Cadbury's Pantone 2865C: lost on appeal ([Irwin Mitchell](https://www.irwinmitchell.com/news-and-insights/newsandmedia/2013/october/complexities-of-trademark-law-emphasised-by-cadburys-purple%20battle-jq-800445)).
  - V's green 376C: lost ([Packaging News](https://packagingnews.com.au/news/v-energy-loses-colour-trademark-battle-with-coca-cola)).
  - T-Mobile magenta ([NC JOLT](https://journals.law.unc.edu/ncjolt/?p=1847)).
  - Orkla's 2144 C in Norway: won ([Schjødt](https://schjodt.com/news/orkla-and-mondelez-reach-settlement-over-trademark-dispute-on-chocolate-packaging)).

### 8.4 Pantone's enforcement posture and the 2022 Adobe change
- **From August 2022,** most Pantone Color Books were dropped from Photoshop, Illustrator and InDesign updates. Files that used them showed those colors as **black** until users bought Pantone Connect Premium and its plug-in. CMYK Coated, CMYK Uncoated and Metallics Coated stayed in. ([PetaPixel](https://petapixel.com/2022/10/28/you-have-to-pay-a-subscription-to-use-pantone-colors-in-photoshop-now), [PPAI](https://www.ppai.org/media-hub/pre-installed-pantone-color-books-phased-out-of-adobe-applications/), [NPR via TPR](https://www.tpr.org/2022-11-06/in-the-adobe-and-pantone-dispute-creators-are-left-in-the-dark))
- **The reaction:** Stuart Semple's free "Freetone" (1,280 "Pantone-ish" colors). Its download terms exclude Adobe and Pantone staff ([The Dieline](https://thedieline.com/blog/2022/11/1/stuart-semple-liberates-color-books-inside-adobe-software-with-freetone-plug-in)). This is activism, not a safe harbor; don't copy the model.
- **The lesson:** Pantone's business is licensing its *data*. It defends the library, while the press freely reports single codes and Colors of the Year. Our risk comes from **replicating the library or a matcher**, not from naming a color.

### 8.5 How encyclopedias handle it today (observed 2026-10-08)
- **Encycolorpedia** lists paint matches for RAL, NCS, Coloro, Farrow & Ball, Sherwin-Williams, Benjamin Moore and Crayola, each with ΔE and the note "computed from the digital color". **No Pantone brand appears** in its list ([paints](https://encycolorpedia.com/paints)). That looks like a deliberate removal, but this is my inference.
- **Small apps** (e.g. Color Name AR) still advertise Pantone suggestions ([App Store](https://apps.apple.com/us/app/color-name-ar/id906955675)). That's no proof it's safe.
- **Pantone's own licensees** must say that on-screen colors may not match the physical standards ([licensee notice](https://learn.foundry.com/colorway/Content/legal.html)). The *approximation* label is the industry norm.
- **The press** writes "Pantone 18-1750 Viva Magenta" freely as news ([Hotel Management](https://www.hotelmanagement.net/design/pantone-names-color-year-2023)).

### 8.6 What's safe for an *archive* like ours (low risk)
- **Factual, nominative history:**
  - "Pantone's Color of the Year 2023 was Viva Magenta (18-1750)."
  - "Australia's plain packs use Pantone 448 C."
  - This is the kind of text our `wiki-colors.js` and `fashion.js` already hold.
- **Our own screen approximations, labeled:** "≈ #BB2649 on screens, an approximation, not an official Pantone value". One value per mentioned color, not a library.
- **A Color of the Year timeline:** about 27 entries, one sentence each, with our approximate swatches. **⚖ counsel** before a paid launch, since a complete yearly list is a small compilation of Pantone's choices. The facts themselves are public news.
- **No logos, no Pantone chip styling** (the white card with a label), no "official" wording, and a visible non-affiliation notice.

### 8.7 Same questions for the other systems
| System | Mention single codes in context | Show our approximate swatch | Search, matcher or full list | Notes |
|---|---|---|---|---|
| Pantone | ✅ | ✅ labeled ≈ | ❌ | Non-affiliation notice |
| RAL | ✅ | ✅ labeled ≈ | ❌ until **⚖ counsel** (RAL is aggressive; the OLG Düsseldorf ruling helps but is German and from 1998) | |
| NCS | ✅ | ✅ | ❌ (needs a license for commercial use) | Explaining how the notation works is fine |
| Munsell | ✅ | ✅ | ✅ **computed** from the RIT renotation data, labeled "nearest Munsell (computed)" | Trademark notice; don't imitate the Book |
| Coloro | ✅ | ✅ | ❌ | |
| Farrow & Ball, Benjamin Moore, Sherwin-Williams, Little Greene… | ✅ always with the brand ("Elephant's Breath, Farrow & Ball") | ✅ ≈ | ❌ no brand fan-deck import | Names are registered marks for paint. Never use them as *our* names for a color |
| Crayola | ✅ as "X (Crayola)", with its introduction year | ✅ ≈ (Wikipedia-listed values) | ⚠ `core-names.json` has about 27 Crayola mentions. Keep the brand tag; prefer an open synonym as the headword when one exists | Some crayon names are registered marks. Teaching the word is nominative; selling crayon-branded goods is not |
| Tiffany Blue, Cadbury Purple, T-Mobile Magenta, UPS Brown, Barbie Pink | ✅ as history | ✅ ≈ | n/a | These are color marks. Never use them for our own merch or branding |

---

## 9. Recommended policy for ColorHub (rules)

**R1. Facts yes, libraries no.**
- We may state any fact about any color system: that it exists, how it works, and single codes in context.
- We never reproduce, import, scrape or bulk-list a proprietary library (Pantone, RAL, NCS, Coloro, paint fan decks).
- We never ship a "nearest Pantone/RAL/NCS" search or matcher.

**R2. Every proprietary value is ours and labeled.**
- Any swatch shown for a proprietary color is our own screen approximation, marked "≈ approximate, not an official value".
- The color page's existing "screens are approximate" caveat applies everywhere.

**R3. Nominative only, with no affiliation.**
- Brand names appear as plain text next to the brand ("Elephant's Breath (Farrow & Ball)", "Pantone 448 C"). No logos, no look-alike chip or fan-deck styling, no "official" wording.
- A footer and About-page notice reads: "PANTONE®, RAL, NCS, Munsell, Crayola, Farrow & Ball and other names are trademarks of their owners. ColorHub is not affiliated with or endorsed by them."

**R4. Open sources first, with provenance on every name.**
- Import only from public-domain, CC0, MIT or CC BY sources (§7a).
- Keep `src`, `license` and `date` on every name (the `library.json` `src` field already exists).
- Keep an Attributions page (CC BY: Ngram, ntc.js, AIC descriptions).
- Never paste CC BY-SA prose. Never copy from all-rights-reserved sites (§7b); cite them as references instead.

**R5. A counsel gate before money.**
- Before any subscription, ads, merch, paid export or app-store launch, an IP lawyer reviews:
  - EU and UK database-right exposure;
  - the Color of the Year timeline;
  - Crayola names in learn decks;
  - the RAL, NCS and Munsell features;
  - the chosen product name (Ochre's descriptiveness).
- Until then, these features stay off: a RAL or NCS matcher, Pantone-anything search, and brand fan-deck imports.

Supporting habits:
- Color trademarks (Tiffany, Cadbury, T-Mobile) are history to report, never branding to use.
- Book facts stay in our own words, per CLAUDE.md.
- The Maerz & Paul import uses the 1930 edition only.
