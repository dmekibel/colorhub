# Etymology fact-check, 2026-10-07

This pass checks word origins and dates. It covers the `o:` lines in `data/colors.js`, the "language" facets in `data/wiki-colors.js`, and the name origins in `data/wiki-nodes.js` and `data/stories.js`. It redoes an earlier pass whose work was lost.

**How we checked.** Etymonline, Merriam-Webster and the OED blocked direct reads. We read them through the Wayback Machine or search excerpts. Other sources: Wiktionary, Wikipedia (with its citations), Crossref and PubMed, Japanese dictionaries on Kotobank, the Newton Project, and the book notes in `color-kb/books/notes.jsonl`. Many Wikipedia "first recorded use" dates come from Maerz & Paul, *A Dictionary of Color* (1930).

**Totals.** About 150 claims checked: 15 fixed, 12 hedged, 0 cut, and the rest verified. `node tools/check.js` and `node tools/check_wiki.js` both report 0 failures.

## Fixed (15)

| Claim | File | Verdict | Source | Change |
|---|---|---|---|---|
| Kelly green: "St Patrick's color was blue until the 1700s" | colors.js o: | Wrong. Green was worn on St Patrick's Day by 1681. Blue became his official color only with the Order of St Patrick in 1783. St Clair's book has it backwards. | Wikipedia, "St. Patrick's blue" (Dineley 1681; Order of St Patrick 1783) | Now: "Green was worn on St Patrick's Day by the 1680s; his official blue came later, in 1783." |
| Navy: "dyed dark to resist sun and sea" | colors.js o: | Unsupported as the original reason. Sources say dark cloth hid dirt and wear, and the blue was darkened later to fight fading. | Wikipedia, "Navy blue" | Now: "From the dark indigo blue the Royal Navy chose for officers' uniforms in the 1740s." This also carries out the Navy upgrade. |
| Violet: "Newton's first spectrum ended in 'purple'" | colors.js o: | Half right. The 1672 letter has "a Violet-purple" and calls the extreme rays "a deep Violet". The 1665 notebook's "purple" comes from thin-film experiments, not a prism spectrum. | Newton, *Phil. Trans.* 80 (1672), Newton Project; Gage, *Colour and Culture* | Now: "In 1672 Newton called the far end of the spectrum 'violet-purple'; by Opticks (1704) it was simply violet." |
| Turquoise: "Europeans thought the stone came from Turkey" | colors.js o:; wiki-colors language | Wrong emphasis. It reached Europe through Turkish (Ottoman) lands from mines in Khorasan, Persia. | Etymonline, "turquoise"; Wikipedia, "Turquoise" | Both now say it came through Turkish lands and was mined in Persia. |
| Khaki: "the Persian and Urdu word for dust" | colors.js o:; stories before-orange | Imprecise. Khaki is Urdu/Hindustani for "dusty, soil-colored". The Persian root khak means "dust". | Wikipedia, "Khaki"; Wiktionary | Now "Urdu for 'dusty', from Persian khak, dust", and the story says "an Urdu word for dusty". |
| Gunmetal: "after the bronze once used to cast cannons" | colors.js o: | Incomplete. Freshly cast gunmetal is golden. The grey is tarnished metal, later blued gun steel. | Merriam-Webster, "gunmetal"; Wikipedia, "Gunmetal" | Now: "in its dark tarnished state". |
| Lime green: facet "by 1883", but its source said 1890 | wiki-colors language | Both dates are real. Etymonline has "lime" as a color by 1883. The OED's first "lime green" is in the *Daily News*, London, 14 July 1890. | Etymonline (search excerpt); Wikipedia, "Lime (color)" citing the OED | Facet now gives both dates; sources updated. |
| Petrol blue: "a British and European name ... appears in the early 1900s" | wiki-colors language | The earliest OED record (1913) is from an American newspaper, the *Fort Wayne News*. | OED, "petrol blue, n." (via search); Wiktionary talk page | Now "mostly a British and European name", noting the 1913 American first record. |
| Taupe: "an English fashion note of 1846"; "since the 1940s it has stretched" | wiki-colors language | The 1846 note was printed in the *Maitland Mercury*, New South Wales. The 1940s claim has no citation. The books date the drift to brown to the 1930s. | Wikipedia, "Taupe"; St Clair, *The Secret Lives of Colour* (2016) | Now "an English-language fashion note of 1846, printed in Australia". The drift is put in the 1930s, with the St Clair source added. |
| Apricot: "then Spanish and French" | wiki-colors language | The chain runs through Catalan (abercoc). French only shaped the later spelling. | Etymonline, "apricot"; Wiktionary | Now "then Catalan". |
| Saffron: "from Persian zafaran, perhaps from an older word meaning 'gold-strung'" | wiki-nodes saffron-dye | Wrong. The word is Arabic za'faran, origin unknown. The Persian "gold-feathered" idea is a minority guess, and Wikipedia flags its "gold-strung" gloss as citation needed. | Etymonline, "saffron"; Wiktionary | Now "Arabic za'faran, of uncertain origin; one guess traces it to a Persian word meaning 'gold-feathered'." |
| Midori "comes from an old verb for coming into leaf" | stories blue-go-light (text and source line) | Unsupported. Japanese dictionaries say midori first meant new shoots or buds, or freshness. | Kotobank (Daijisen; Nihon Kokugo Daijiten), 緑; Gogen-yurai | Now "Midori first meant fresh new shoots", with the source line fixed. |
| Mauveine "first sold as 'aniline purple'" | wiki-nodes mauveine | Incomplete. Perkin first marketed it as "Tyrian purple". "Aniline purple" was also used. It was called mauve by 1859. | Wikipedia, "Mauve" (Travis 1993; St Clair); Ball, Garfield, Finlay, Greenfield | Now gives Tyrian purple first, aniline purple as the other name, mauve by 1859. |
| Magenta: "British makers renamed their version after the 1859 Battle of Magenta"; "British chemists renamed the dye" | wiki-nodes mauveine; wiki-colors Magenta history | Imprecise. Simpson, Maule & Nicholson sold a similar dye as "roseine", then as "magenta" by 1860. | Wikipedia, "Magenta" (citing Ball and St Clair); Etymonline, "magenta" (1860) | Both now say "by 1860". |
| Mauveine "the first to become a mass-market hit"; Purple "the first coal-tar dye to become a hit" | wiki-nodes mauveine; wiki-colors Purple | Unsafe. The books disagree on commercial synthetic dyes before mauve: picric acid dyed silk on an industrial scale from 1849. Only "first aniline dye" is safe. | CONFLICTS.md (Ball vs Garfield); CLAUDE.md myth list | Now "the first aniline dye ... a fashion sensation". |

## Hedged (12)

| Claim | File | Verdict | Source | Change |
|---|---|---|---|---|
| Scarlet cloth "could be any color, even blue or black" | colors.js o: | Disputed. Five books say so. John Munro and newer work argue all scarlets were kermes-dyed, and the color words describe the ground color. Origin of the word: uncertain (Arabic siqillat; Persian saqirlat was borrowed from Arabic). | Wikipedia, "Scarlet (cloth)"; Etymonline; Ball, Gage, Pastoureau *Red* | Now "not always red: many historians say it came in other colors too". The language facet already hedges the origin. |
| Pink as a color word "in the 1600s" | wiki-colors language | Sources differ: late 17th century (Wikipedia), 1720 or 1733 (Etymonline). Early "pink" also meant a yellowish lake pigment. | Wikipedia, "Pink"; Wiktionary, "pink"; Etymonline | Now "in the late 1600s; at the time 'pink' could also mean a yellowish paint". |
| Beige as a color in English "from 1887" | wiki-colors language | Wikipedia (via Maerz & Paul) says 1887; Etymonline says 1891. | Wikipedia, "Beige"; Etymonline | Now "from the late 1880s". |
| Hunter green "worn by hunters to blend into woods" | colors.js o: | Only Wikipedia's "Shades of green" says so; no dictionary etymology found. First recorded 1892. | Wikipedia, "Shades of green" | Now "Said to be named for the green hunters wore in the 1800s". |
| Peach "domesticated around 6000 BCE in the Yangtze valley" | wiki-colors language | The evidence shows peach stones being selected (growing larger) from about 8000 BP. | Zheng, Crawford & Chen, *PLoS ONE* 9(9): e106595 (2014) | Now "people in the Yangtze valley were already selecting peaches by about 6000 BCE". |
| Jade "piedra de ijada, recorded in 1565" | wiki-colors language | Monardes' book had 1565, 1569 and 1574 editions, and it is unclear which first has the term. Etymonline gives the 1560s. | Wikipedia, "Jade"; Etymonline | Now "recorded in the 1560s". |
| Amethyst: Anglican bishops "traditionally wear amethyst rings, recalling ... Acts 2:15" | wiki-colors language | A common custom, not a rule. The link to Acts is a traditional explanation. | Wikipedia, "Amethyst" | Now "often wear amethyst rings, traditionally explained as recalling ...". |
| Canary Islands "islands of dogs" | wiki-colors language | Pliny's dog story may be folk etymology. The name may come from the Canarii, a Berber people. | Etymonline, "canary"; Wikipedia | Now "probably 'islands of dogs' ... though the name may instead come from a local people". |
| Caeruleum "from caelum, the sky" | wiki-nodes egyptian-blue | Etymonline says "perhaps" (dissimilation of caelulum). | Etymonline, "cerulean"; Wikipedia, "Cerulean" | Now "probably from caelum". |
| Cerulean paint: painters "only got it after ... Rowney sold it as 'coeruleum' around 1860"; "does not fade" | wiki-colors history | "Some sources claim" Rowney was first. Roberson was buying it from a German maker earlier. It was thought fugitive in the 1890s and is now considered stable. | Wikipedia, "Cerulean"; Ball; Gage | Now "in the 1860s, when London colormen such as George Rowney began selling it", and "now counted among the lightfast pigments". |
| Russian speakers "tell those blues apart a little faster" | wiki-colors Blue language; wiki-nodes linguistic-relativity (dek, body); stories two-blues | Winawer 2007 is real. Martinovic, Paramei & MacInnes (2020) repeated the tasks and found no speed advantage at the siniy/goluboy boundary, only at goluboy/green. A corrigendum appeared in 2026 (see below), but we could not read it. | PNAS 104(19) 2007; Cognition 201: 104281 (2020, author postprint) | All now say the 2020 repeat did not find the edge, so the effect may be smaller or less reliable than first reported. |
| Lilac "goes back to Persian lilak" | wiki-colors language | The chain runs through Arabic līlak. | Wiktionary, "lilac" | Now "through Arabic, to Persian lilak". |

## Loose end from the first pass: the Cognition correction

The 2020 paper did receive a published erratum: "Corrigendum to 'Russian blues reveal the limits of language influencing colour discrimination'", *Cognition* 275 (Oct 2026), article 106566, doi:10.1016/j.cognition.2026.106566, PMID 42270523. It went online on 10 June 2026. Crossref lists it in the 2020 paper's "updated-by" field. The text is paywalled, and ScienceDirect, the Elsevier API and PubMed (no abstract) all failed, so we don't know what it changes.

The 2020 abstract (author postprint) supports the claim the app makes. Because the correction is unread, every claim resting on the paper is now softened: "a careful 2020 repeat found no speed advantage ... so the effect may be smaller or less reliable". Nothing now depends on the exact 2020 numbers.

## Verified (no change)

| Claim | File | Source |
|---|---|---|
| Maroon: color 1789, from French marron "chestnut"; maroon "to strand" from Spanish cimarrón | wiki-colors | Wikipedia, "Maroon (color)" (Maerz & Paul); Wiktionary |
| Burgundy 1881; salmon 1776; moss green 1884; burnt orange 1915; sienna 1760 and burnt sienna 1853; lavender 1705; lilac 1775 | wiki-colors | Wikipedia color articles (OED; Maerz & Paul) |
| Cerise: The Times 1858 (OED); 1845 use in Cornelia Mee, *Crochet Explained and Illustrated*, p. 117 | wiki-colors | Wikipedia, "Cerise (color)" |
| Teal: 1917, some sources 1923 | wiki-colors | Wikipedia, "Teal"; Etymonline |
| Eggplant 1763; aubergine chain back to Sanskrit and Dravidian | wiki-colors | Wikipedia, "Eggplant"; Wiktionary |
| Lavender: lavare vs lividus both offered; the facet's hedge matches | wiki-colors | Wiktionary; Etymonline |
| Tan from Medieval Latin tannum, oak bark; tannin shares the root | colors.js, wiki-colors | Etymonline, "tan", "tannin" |
| Crimson: early 1400s, Medieval Latin cremesinus, Arabic qirmiz, Sanskrit krmi-ja "worm-made" | colors.js, wiki-colors, wiki-nodes kermes | Etymonline; Wiktionary; Greenfield, Finlay |
| Vermilion from vermiculus, "little worm", first the kermes dye | colors.js, wiki-nodes | Ball; Greenfield; Etymonline |
| Pistachio, ochre (ochros "pale"), mustard (mustum), orchid (orkhis), marigold (Mary + gold), malachite (molochites, mallow), jade (lapis nephriticus, nephrite) | wiki-colors | Etymonline; Wiktionary |
| Chocolate: the xocolatl "bitter water" derivation is disputed | wiki-colors | Coe & Coe, via Wikipedia, "Chocolate" |
| Orange: Sanskrit to Persian to Arabic to French; n lost to the article; Old English geoluhread; 1502 color use (Etymonline: 1510s) | wiki-colors, stories | Etymonline; Wikipedia, "Orange (colour)" |
| Azure: Persian lajward, l- dropped as if the article l' | wiki-colors, wiki-nodes heraldry | Etymonline, "azure" |
| Cobalt from Kobold; Brandt about 1735 | colors.js, wiki-colors, wiki-nodes | Etymonline; Wikipedia, "Cobalt" |
| Celadon from d'Urfé's shepherd in L'Astrée (1607–1627) | colors.js, wiki-colors | Wikipedia, "L'Astrée", "Celadon" |
| Amber, Greek elektron; Gilbert's electricus (1600) | colors.js, wiki-colors | Etymonline, "electric" |
| Denim probably from serge de Nîmes (hedge kept); jean from Gênes, Genoa | colors.js, wiki-colors | Etymonline; Wikipedia, "Jeans" |
| Indigo from Greek indikon; anil to aniline (Fritzsche 1841) | colors.js, wiki-colors, wiki-nodes | Etymonline, "indigo", "aniline"; Balfour-Paul |
| Gules: from fur neckpieces (gula, throat); the Persian "rose" link is a fancy | wiki-nodes heraldry | Etymonline, "gules" |
| Verdigris: verte grez, "green of Greece"; "green of vinegar" a minority view | wiki-nodes verdigris | Etymonline; Wikipedia, "Verdigris" |
| Spectrum, Latin "apparition"; chromium from Greek chroma | wiki-nodes | Etymonline |
| Bear "the brown one" (taboo theory); blæc and blac; Blake surname | wiki-colors | Etymonline, "bear", "black" |
| Japan: 1930 signal rules said green (緑色信号); the law says 青 (since 1947) | stories blue-go-light | ja.wikipedia, 日本の交通信号機 |
| Red/ruber/erythros; rubric; yellow, gold and gleam (*ghel-); green, grow, grass; white and wheat; periwinkle; plum and prune; ecru (crudus); terracotta; sepia; puce (flea); taupe (talpa); peach (persicum) | wiki-colors, colors.js | Etymonline (via Wayback); Wiktionary |

## Book notes that disagree with the web

- **St Patrick's blue.** St Clair says Patrick was linked with blue until the mid-1700s. Wikipedia's sources say green came first (1681) and blue in 1783. CONFLICTS.md's proposed Kelly green line inherited the error. It is now fixed in colors.js.
- **Mauve "first synthetic".** Westland and Eckstut repeat it. The app follows the safe wording, "first aniline dye", per CONFLICTS.md.
