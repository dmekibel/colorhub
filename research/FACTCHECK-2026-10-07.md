# Wiki fact-check, 2026-10-07

Scope: `data/wiki-colors.js`, `data/wiki-nodes.js`, `data/stories.js`, `data/paintings.js`. Covers every claim the writers flagged as uncertain, plus a sweep for other shaky numbers, dates and "first/most/only" claims. Journal citations were checked against Crossref metadata. `node tools/check_wiki.js` reports 0 failures.

**Totals:** 35 corrected, 12 softened, 4 cut, 63 verified (one row bundles about 50 journal citations and one bundles about 26 etymologies). The flagged Indian-yellow claim does not appear in any of the four files.

Paintings have no `sources` field, so their sources are listed only here.

## Corrected (35)

| Claim | Verdict | Source |
|---|---|---|
| The Fighting Temeraire: "thick paint and glazes of the sunset are unusually intact" | corrected (NG says the clouds are so thick the paint stands proud of the canvas) | National Gallery, London, painting page |
| Starry Night story: "painted ... from his window" | corrected (painted from the view out of his window; worked from memory in the studio) | MoMA / Wikipedia, The Starry Night |
| Tyrian purple story source "Cooksey 2010, Preparation of Tyrian Purple ... Molecules 15(8)" | corrected (authors are Wolk & Frimer; pp. 5473–5508) | Crossref, doi:10.3390/molecules15085473 |
| Ultramarine story source "Vandivere et al. 2020, Out of the blue" | corrected (first author van Loon) | Crossref, doi:10.1186/s40494-020-00364-5 |
| Yellow source "Monico et al. 2015 ... Analytical Chemistry" | corrected (Angewandte Chemie Int. Ed. 54(47), 2015) | Crossref, doi:10.1002/anie.201505840 |
| Ochre "since" date -73,000 for engraved ochre, while the text says 75,000 | corrected to -75,000 | Henshilwood et al. 2002, Science 295: 1278–1280; Wikipedia, Ochre |
| Ou et al. 2004: warmth peaks at red-orange, coolness "around blue" (warm-and-cool) | corrected (model's cool pole is the opposite hue, a greenish blue; chroma strengthens both) | Ou, Luo, Woodcock & Wright, Color Res. Appl. 29(3): 232–240 (2004), doi:10.1002/col.20010 |
| Red facet: "a reanalysis of the same games traced the edge to a bias in how the contests were set up" | corrected (that reanalysis is an unreviewed 2016 preprint; replaced with the 2024 meta-analysis: red won 50.5% of 6,589 bouts) | Peperkoorn, Hill, Barton & Pollet, Scientific Reports 14: 30822 (2024) |
| Simner 2006: "roughly 1 to 2% had colored letters or numbers" | corrected to about 1% | Simner et al., Perception 35(8): 1024–1033 (2006) |
| Genschow 2015: 59 prisoners in "pink or grey cells" | corrected (control cells were white, with a grey floor) | BPS, The Psychologist, 'Are prisoners calmer when their cells are pink?' |
| Wilhelmina "revived white mourning in 1934 and the Dutch royal family has kept it since" | corrected (white was Prince Hendrik's own request; used again in 1962 and 2004, but Prince Claus's 2002 funeral was in black) | Irish Times, 'Dutch mourn Queen Juliana at funeral' (2004); EO Blauw Bloed, 'Koninklijke uitvaarten in wit' |
| Great Wave: "series advertised in 1831 for its use of Prussian blue" | corrected (advertised as aizuri, blue-printed pictures; the ad does not name the pigment) | Scholten Japanese Art, 'aizuri-e'; Korenberg 2020 |
| Great Wave story: "about 1,000 copies at first ... more than a hundred first-edition impressions" | corrected (cut the 1,000 figure; about 111 original impressions survive across all printings) | Korenberg, British Museum (2020) |
| Great Wave story: Prussian blue reached Japan "from 1820" | corrected (sporadic from the 1780s; cheap and plentiful from about 1829) | Scholten Japanese Art, 'aizuri-e' |
| Girl with the Wine Glass: ultramarine "beneath the red dress" | corrected (beneath the shadows of the dress) | Essential Vermeer, after Wheelock 1995 |
| Monet "first saw an eye specialist in 1913" | corrected (cataracts diagnosed 1912; surgery 1923) | Marmor, Arch. Ophthalmol. 124(12) (2006) |
| Viridian: "traces turn up" in Monet's Gare Saint-Lazare | corrected (used extensively) | ColourLex, 'Monet, The Gare Saint-Lazare' (NG6479) |
| Van Gogh: complements raise each other "to a pitch the eye can scarcely bear" | corrected (he was copying Charles Blanc's words in letter 494, April 1885) | vangoghletters.org, letter 494 |
| Albers' Black Mountain students "included ... Cy Twombly" | corrected (Twombly arrived 1951, after the Alberses left in 1949) | Guggenheim, 'Cy Twombly'; Albers Foundation biography |
| Homage to the Square "begun in 1949" | corrected to 1950 | Josef and Anni Albers Foundation |
| "Theory of colors discovered by M. Chevreul": Pissarro "reported Seurat describing" it | corrected (Pissarro's own words, letter to Durand-Ruel, Nov 1886) | Rewald, History of Impressionism; Wikiquote, Camille Pissarro |
| Ultramarine start date "c. 500 CE" in Buddhist cave temples | corrected to 6th–7th century, Bamiyan | Plesters, Studies in Conservation (1966), via Wikipedia, 'Ultramarine' |
| Cadbury purple "since the bar's launch" | corrected (since 1914; bar launched 1905) | Nestlé v Cadbury [2012] EWHC 2637 (Ch) |
| Cerulean "calling it the color of the millennium" | corrected ("to mark the turn of the millennium") | Pantone Color of the Year 2024 press release (history) |
| Redbreast "dates from the 1400s" | corrected to the 1300s | Etymonline, 'redbreast' |
| Tangerine: "OED's first example ... 1710" | corrected (1710 means a native of Tangier; the fruit from the 1840s) | Etymonline, 'tangerine' |
| Aqua: "the X Window System gave cyan a second name, aqua, in 1987" | corrected (aqua came from the 16 HTML colors / Windows VGA palette; X11 added it only in 2014) | W3C, HTML 3.2 Reference Specification (1997) |
| Chartreuse: liqueurs "since 1737" | corrected (work began 1737; formula fixed 1764; Green Chartreuse 1840 and color name 1884 verified) | chartreuse.fr, 'Our story'; Etymonline |
| Beige computers: "a look that started in Germany" | corrected (Apple II and IBM PC popularized it; German office rules helped) | Wikipedia, 'Beige box' (Fortune 1998) |
| Lime green "from 1890, in a London newspaper" | corrected to "by 1883" | Etymonline, 'lime' |
| Qing yellow: "even crown princes were limited to yellow trim" | corrected (crown prince apricot yellow, other princes golden yellow) | Huangchao liqi tushi (1759), via Bonhams |
| Emerald: Egyptians mining emeralds "by about 1500 BCE" | corrected (mines opened under the Ptolemies; worked by the Romans) | Harrell, Geoscience Canada 31(2) (2004) |
| Tyrian purple: trade ended "with the fall of Constantinople" (1453) vs 1204 in the royal-purple page | corrected to 1204 | Jacoby, Dumbarton Oaks Papers 58 (2004) |
| Perkin "named it after the French word for mallow" | corrected (sold as aniline purple; called mauve by 1859) | Oxford DNB via Wikipedia, 'Mauveine' |
| Kelly green: "the national football team played in blue until 1931" | corrected (the all-Ireland IFA team) | Wikipedia, "St. Patrick's blue" |

## Softened (12)

| Claim | Verdict | Source |
|---|---|---|
| Woman with a Parasol "in a single outdoor session" | softened ("probably in a single session of a few hours") | National Gallery of Art / Wikipedia |
| Baker-Miller pink: "later studies, including his own, did not find the effect" | softened ("by other researchers"; Schauss's 1985 paper still argued for it) | Genschow et al., Psychol. Crime Law 21(5): 482–489 (2015) |
| Pink for girls: "Historians have found it in the Netherlands in 1823, France in 1834 and England in 1862" | softened ("old sources tie it to girls"; the dates are period sources, not a historian's finding) | Wikipedia, 'Gendered associations of pink and blue' (Garnier 1823; Bayle-Mouillard 1834; Englishwoman's Domestic Magazine 1862) |
| Starry Night: "Its paint has never been sampled"; 2008 modelling found ultramarine around the stars, cobalt in the swirls | softened (study verified; "never sampled" unprovable, now "pigment map comes from imaging, not paint samples") | Zhao, Berns, Taplin & Coddington, Proc. SPIE 6810 (2008); ColourLex, 'Van Gogh, The Starry Night' |
| Turban: "ultramarine and lead white under a glaze of pure ultramarine" (vermeer, ultramarine-pigment) | softened (darker blue over lighter blue, varying lead white; no pure glaze found in the 2018–20 papers) | Delaney et al. 2020; Vandivere et al. 2020 |
| Ultramarine extraction "first described by al-Tifashi" | softened ("described by"; an earlier Arabic mention is ascribed to Jabir) | AramcoWorld, 'The quest for blue' (2021) |
| Japan: 1973 order for the bluest legal green | softened (no document found; only that lights since the 1970s are made bluer) | Oita Prefectural Police FAQ; Ayama et al., J. Illum. Eng. Inst. Japan 66(10) (1982) |
| Cadbury "lost a long fight" to register purple | softened (lost the 2013 Court of Appeal round; won part of a 2022 appeal) | [2013] EWCA Civ 1174; [2022] EWHC 1671 (Ch) |
| Owens Corning pink "the first US color trademark" (node and quiz) | softened ("a landmark ruling"; "first" is the company's own claim) | In re Owens-Corning Fiberglas, 774 F.2d 1116 (Fed. Cir. 1985) |
| Scarlet "from Persian saqerlat" | softened (origin uncertain; perhaps Arabic siqillat) | Etymonline, 'scarlet'; Wiktionary |
| Lilac from Persian lilak/nilak | softened ("probably"; sources disagree) | American Heritage Dictionary; Etymonline |
| Teal as a color word "from 1917" | softened (Wikipedia 1917; Etymonline 1923) | Etymonline, 'teal'; Wikipedia, 'Teal' |

## Cut (4)

| Claim | Verdict | Source |
|---|---|---|
| Monet "in the 1870s took an interest in Chevreul's color theories" | cut (no direct evidence found) | n/a |
| Rouen Cathedral: "A 2025 National Gallery of Art study found ... cadmium yellow that has since turned brown" | cut (no such study found; cadmium yellow fades or whitens rather than browns) | n/a |
| The Kiss: "Lab analysis found the red is vermilion and the blue is cobalt" | cut (no published analysis found) | n/a |
| Puce: "no portrait shows her wearing it" | cut (unsupported) | Emerging Infectious Diseases 28(2) (2022) cover essay |

## Verified (63)

| Claim | Verdict | Source |
|---|---|---|
| Diocletian's edict: purple silk 150,000 denarii a pound, same as a first-class lion; purple wool 50,000; gold 72,000; farm labourer 25 a day (royal-purple, Purple, snail-purple) | verified | Kropff 2016, An English translation of the Edict on Maximum Prices (kark.uib.no/antikk/dias/priceedict.pdf), XXIV.1a, XXIV.2, XXX.1a, XXXII.1a, VII.1a |
| Fire trucks: USFA 2009 study found fluorescent yellow-green and orange most visible by day (Lime) | verified, source added | US Fire Administration, Emergency Vehicle Visibility and Conspicuity Study, FA-323 (Aug 2009) |
| The Fighting Temeraire: ship repainted white and gold; sun in an impossible place | verified | National Gallery, London, painting page |
| Mona Lisa: yellowed varnish turns blue sky greenish; dress probably dark green with yellow sleeves | verified | Louvre statement quoted on Wikimedia Commons ('original colors approximation') |
| The Milkmaid: 2022 Rijksmuseum scans found a jug holder and a fire basket he painted out | verified | Rijksmuseum press release, Sept 2022 |
| The Japanese Footbridge: plot bought 1893, stream diverted, 12 views in 1899 | verified | National Gallery of Art, Washington, object page |
| "Emerald Isle" from William Drennan's 'When Erin First Rose' (1795) | verified | Wikipedia/Wikiquote, William Drennan; IrishCentral |
| Egyptian blue: Harvard Gazette 'When Egyptians made blue' (2026) exists | verified | news.harvard.edu, April 2026 |
| Newton's seven colours and music: 'Music inspired Newton's rainbow', Nature 520: 436 (2015) | verified | Crossref, doi:10.1038/520436a |
| Journal citations with volume/issue/pages (Winawer 2007; Regier & Kay 2009; Schloss & Palmer 2011; Palmer et al. 2013; Lafer-Sousa 2015; Foster 2011; Newton 1672; Bowmaker & Dartnall 1980; Young 1802; Hunt 1995; Birch 2012; Mollon & Cavonius 2012; Jordan 2010; Simner 2006; Witthoft & Winawer 2013; Palmer & Schloss 2010; Jackson 1982; Ou 2004; Land 1977; Viénot 2002; Berns 2006; Henshilwood 2002, 2011; Verri 2009; Splitstoser 2016; Cooksey 2001; Monico 2011; Cui & Wardle 2019; Marmor 2006; Woodcock 1996; Del Giudice 2012; Gnambs 2020; Genschow 2015; Gettens et al. 1972; Hagemann 2008; Heider 1972; Crane & Piantanida 1983; Billock 2001; Hsieh & Tse 2006; Wallisch 2017; Jacobsen 2002; Makin & Wuerger 2013; Chen 2015; Carmichael 2015; Martinovic 2020; Machado 2009; Hill & Barton 2005; Fong 2025) | verified | Crossref metadata for each DOI |
| Titanium white mass-produced from 1916, in artists' tubes from 1921 (White) | verified | WebExhibits, Pigments through the Ages, 'Titanium dioxide whites' |
| Barbie's pink is Pantone 219 C (Pink) | verified | Mattel Creations, 'Barbie Pink, with a Pantone twist' |
| color-psychology: 2024 meta-analysis found red won about 50.5% of bouts | verified, full citation added | Peperkoorn et al., Sci. Rep. 14: 30822 (2024) |
| Hill & Barton 2005: red won 55% of bouts, about 60% in close ones (red-wins story) | verified (55%; 62% in close bouts) | Hill & Barton, Nature 435: 293 (2005); Peperkoorn et al. 2024 |
| Hue-heat paper cited without authors | verified, full citation added | Battistel et al., Sci. Rep. 14: 21413 (2024) |
| Two blues story: a 2020 study found no speed advantage at the goluboy/siniy line | verified | Martinovic, Paramei & MacInnes, Cognition 201: 104281 (2020) |
| Witthoft & Winawer 2013: 11 synesthetes, 10 remembered owning the magnet set | verified | Psychol. Sci. 24(3): 258–265, doi:10.1177/0956797612452573 |
| Grapheme-color synesthesia 1.2% of 2,847 people (vowels story) | verified | Carmichael et al., Conscious. Cogn. 33: 375–385 (2015) |
| Jacobsen 2002: 200 students, about half chose red triangle, blue square, yellow circle; Kandinsky's pairing least popular | verified | Perceptual and Motor Skills 95(3): 903–913, PubMed 12509195 |
| Time 1927: six stores said pink for boys, four said blue | verified | Time, 14 Nov 1927, 'Fashions: Baby's Clothes' |
| Paoletti: pink/blue code known by the late 1860s, dominant only by the 1950s | verified | Paoletti, Pink and Blue (2012), p. 89 |
| Del Giudice: no evidence of a pink-for-boys reversal | verified | Arch. Sex. Behav. 41(6): 1321–1323 (2012) |
| Gladstone: readers took him to mean the Greeks were color-blind, "which he later denied" | verified, source added | Gladstone, 'The Colour-Sense', The Nineteenth Century 2 (Oct 1877) |
| Aristotle: painters cannot mix red, green or purple ("no mixing will give red, green, or purple") | verified | Aristotle, Meteorology III.2, trans. Webster (MIT Classics) |
| Homer: oinops pontos 5 times in the Iliad, 12 in the Odyssey; oxen the only other use | verified | Perseus Greek text (Il. 2.613 ... Od. 19.274; Il. 13.703, Od. 13.32) |
| The dress: 1,401 people, 57% blue/black, 30% white/gold, 11% blue/brown | verified | Lafer-Sousa et al., Curr. Biol. 25(13): R545–R546 (2015) |
| Tetrachromacy: one of 24 carriers behaved as a tetrachromat | verified | Jordan et al., J. Vision 10(8): 12 (2010) |
| Olo: five subjects; "blue-green of unprecedented saturation" | verified | Fong et al., Sci. Adv. 11: eadu1052 (2025) |
| Great Wave: foam is the bare paper | verified | Metropolitan Museum essay; Korenberg (British Museum, 2020) |
| Great Wave: outlines mix Prussian blue and indigo; indigo fades faster | verified | Vermeulen et al., Heritage Science 8 (2020), doi:10.1186/s40494-020-00406-y |
| Amsterdam Sunflowers: chrome yellow darkening | verified; Yellow facet corrected (study was on the Amsterdam version, sulfate-rich chrome yellow darkens) | Monico et al., Angew. Chem. Int. Ed. 54 (2015); Van Gogh Museum press release, 24 Jan 2019 |
| Sunflowers: "three chrome yellows, yellow ochre and Veronese green and nothing else" | verified (letter 740 to Arnold Koning, c. 22 Jan 1889, about the August 1888 pair incl. London) | vangoghletters.org, letter 740 |
| Vermeer mixed ultramarine into the shadows of the yellow jacket (Blue) | verified | Delaney et al., Heritage Science 8: 4 (2020) |
| Girl with a Pearl Earring: English lead white; green indigo-and-weld curtain; vermilion and red lake lips | verified | Vandivere et al., Heritage Science 8 (2020); Delaney et al. 2020 |
| Monet's 1905 palette: lead white, cadmium yellow, vermilion, deep madder, cobalt blue, viridian | verified ("vert émeraude" = viridian; letter to Georges Durand-Ruel, June 1905) | Roy, National Gallery Technical Bulletin 28 (2007) |
| Whistler's Mother: varnished 1878 for Whistler v. Ruskin; thin, oily paint; bought by the French state 1891 | verified | University of Glasgow, Whistler paintings catalogue (y101); Musée d'Orsay |
| The Scream (1893): vermilion and viridian present; fading yellows belong to the Munch Museum version | verified | Singer et al., Studies in Conservation 55 (2010); Monico et al., Science Advances (2020) |
| Viridian: Turner by 1840, Winsor & Newton by 1849 | verified | Newman, 'Chromium oxide greens', Artists' Pigments vol. 3 (1997) |
| Burne-Jones's mummy-brown funeral, recalled by Kipling | verified | Kipling, Something of Myself (1937), ch. 1; G. Burne-Jones, Memorials (1904) |
| Botticelli's Mystical Nativity: angels' copper-green robes darkened | verified (secondary) | Bomford & Roy, A Closer Look: Colour (National Gallery, 2009) |
| The Kiss: gold, silver, platinum leaf; brass ('composition gold') background | verified | Belvedere online collection, object 6678 |
| Arnolfini: tabard once dark crimson-purple; dress = verdigris layers under a verdigris glaze | verified | Campbell, National Gallery catalogue (1998) |
| Woman with a Parasol: white dress in blues and greys; painted outdoors | verified | National Gallery of Art, Washington |
| Goethe prouder of his color theory than his poetry; "in my century I am the only person who knows the truth" | verified (Eckermann, 19 Feb 1829; a remark Goethe "would repeatedly" make) | Eckermann, Conversations with Goethe, trans. Oxenford |
| The Swing: pink dress; 2021 cleaning (not cleaned for over a century) brought back crisper whites and pinks, the young man's flush, the older man's shimmering blue | verified | Wallace Collection, 'Conserving The Swing' |
| Klimt saw the Ravenna mosaics in 1903 | verified (two trips, May and Nov–Dec 1903) | Klimt Foundation database |
| "Ivory tower" from Sainte-Beuve's 1837 poem; Song of Songs 7:4 | verified | Sainte-Beuve, 'Pensées d'août' (1837); KJV |
| CITES voted in 1989 to ban the international ivory trade | verified (CoP7, Lausanne, Oct 1989; in force Jan 1990) | CITES CoP documents |
| Starbucks dropped cochineal from strawberry drinks in 2012 after vegetarian objections | verified | CNN Money, 19 Apr 2012 |
| Periwinkle: Simon Fraser crowned with it in mockery in 1306; Italian "flower of death" | verified (as Grieve tells it) | Grieve, A Modern Herbal (1931), 'Periwinkle' |
| Japan: first lights 1930; rules said green, law now says 青 | verified | Road Traffic Act Enforcement Order, art. 2 |
| Qualitex: "green-gold" dry-cleaning press pads | verified | Qualitex Co. v. Jacobson Products Co., 514 U.S. 159 (1995) |
| Olympic gold medals not solid gold since 1912; silver plated with 6 g of gold | verified | IOC Olympic Studies Centre, 'Olympic Games medals from Athens 1896 to Rio 2016' |
| Pantone Colors of the Year and codes (2000–2026) | verified | pantone.com press releases |
| Tiffany Blue: Blue Book 1845, trademark 1998, Pantone "1837" | verified | Tiffany & Co. press materials |
| Functional colors: phone booths, coral earplugs, John Deere green | verified, wording softened (Deere was an infringement case), sources added | In re Orange Communications (TTAB 1996); In re Howard S. Leight (TTAB 1996); Deere v. Farmhand (1982) |
| Etymologies resting on Etymonline: red/ruber/erythros and rubric; yellow, gold, gleam, glow (*ghel-); green, grow, grass; bear "the brown one"; blæc/blac and Blake; white/wheat; periwinkle; crimson; maroon; carmine; raspberry; lavender; plum/prune; orchid; mustard; khaki; chocolate (disputed); peach; apricot; ecru; umber (uncertain); pistachio; cyan; cerulean; turquoise; sage | verified | Etymonline entries (read via Wayback snapshots); AHD |
| Model T: fastest-drying-black story has little evidence | verified | Model T Ford Club of America (Boggess) |
| Lincoln scarlet cost more than twice Lincoln green in 1182 | verified (6s 8d vs 3s an ell) | Hill, Medieval Lincoln (1948) |
| Gordon Bennett Cup colors; Britain's 1902 win; 1903 race in Ireland in shamrock green | verified | Wikipedia, '1901 Gordon Bennett Cup'; 'British racing green' |
| Wedgwood exported most of his output by the 1780s | verified (nearly 80% by 1784) | McKendrick, via Wikipedia, 'Josiah Wedgwood' |
| Burnt orange: UT Austin, Auburn, Virginia Tech | verified | Wikipedia, 'Shades of orange' |
| Mahogany imports: 525 tons (1740) to over 30,000 (1788) | verified | Bowett, Regional Furniture Society |

## Not applicable (1)

| Claim | Verdict | Source |
|---|---|---|
| Indian yellow (urine origin; mango diet) | not in the files (nothing to check) | n/a |

## Still worth a look

- Martinovic et al. 2020 (Cognition) received a corrigendum in 2026 (Cognition 275: 106566) that we could not read. The two-blues story relies on this paper. Follow-up in FACTCHECK-ETYMOLOGY-2026-10-07.md: the corrigendum is confirmed but still unread, so every claim resting on the paper is now softened.
- Several museum sites (Met, Mauritshuis, NGA, vangoghletters.org, olympics.com, cites.org) blocked automated reading. For those, the verdicts rest on peer-reviewed papers, museum PDFs or search excerpts.
