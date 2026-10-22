# Icon painters: staged paintings (2026-10-22)

Metadata-only staging for famous painters whose corpus count is capped below what Wikidata/Commons holds.
Output: `data/corpus-staging/zz-commons-<slug>-<N>.json` (N = next free number across data/corpus and data/corpus-staging). Nothing under
`data/corpus`, `data/gallery` or `index.html` was touched. Script: `tools/stage_extra.py plan.json`.

How it was chosen: painters resolved in `data/artists/meta.json`, ranked by Wikipedia sitelinks (top 220 who died before 1955), plus
Monet, Van Gogh, Rembrandt, Renoir, Degas, Turner, Manet and Seurat (not resolved in meta.json, QIDs checked). Wikidata painting count
(P170 + P18, painting-like classes) compared with current corpus rows; painters with a gap of 15 or more were staged, up to 600 each.

Rules applied: painting-like classes only (no drawing/print/sculpture); titles with study/sketch/drawing/print/photograph/etching/engraving/
woodcut/lithograph/cartoon/letter are skipped; dropped if the id, the Commons file, or painter + normalized title + year (+-2) already exists
in data/corpus or in the staged set; spread over (medium x decade) when over the cap. UA `Chromatlas/1.0 (https://chromatlas.app;
dmekibel@gmail.com)`, one WDQS request at a time, 429/5xx back-off. No Commons API calls and NO images downloaded.

Rows are therefore **metadata only**: `id, src, t, a, y, co, mv, img (400 px Commons thumb URL), url`. They have no palette (`p`, `L`, `C`),
so a later lane must fetch thumbs, compute palettes, run the image-hash near-duplicate pass (`artist_extra.drop_duplicates`) and only then
move them into data/corpus. Some museum-held twins (different title, same painting) will only be caught by that pass.
Note `ARTIST_CAP_EXTRA` in tools/corpus.py: painters without an entry cap at 50, and those with one (e.g. Rubens 200, Munch 300) will drop
rows at build time; raise the caps for the painters below when merging.

| Painter | Wikidata | Corpus before | Wikidata paintings | Staged | Corpus if merged | Files |
|---|---|---|---|---|---|---|
| Émile Bernard | Q264193 | 26 | 1327 | +600 | 626 | zz-commons-milebernard-1.json |
| Edvard Munch | Q41406 | 730 | 1822 | +600 | 1330 | zz-commons-edvardmunch-3.json |
| Lovis Corinth | Q157610 | 25 | 1070 | +277 | 302 | zz-commons-loviscorinth-1.json |
| Peter Paul Rubens | Q5599 | 761 | 1600 | +595 | 1356 | zz-commons-peterpaulrubens-3.json |
| Max Beckmann | Q164683 | 28 | 780 | +600 | 628 | zz-commons-maxbeckmann-1.json |
| Eugène Boudin | Q212600 | 33 | 619 | +318 | 351 | zz-commons-eugneboudin-1.json |
| Piet Mondrian | Q151803 | 12 | 574 | +517 | 529 | zz-commons-pietmondrian-1.json |
| Paul Klee | Q44007 | 10 | 476 | +403 | 413 | zz-commons-paulklee-1.json |
| James Tissot | Q381248 | 10 | 474 | +452 | 462 | zz-commons-jamestissot-1.json |
| Anthony van Dyck | Q150679 | 886 | 1305 | +136 | 1022 | zz-commons-anthonyvandyck-2.json |
| Jan van Goyen | Q315996 | 50 | 454 | +359 | 409 | zz-commons-janvangoyen-1.json |
| Jacob Jordaens | Q270658 | 46 | 412 | +306 | 352 | zz-commons-jacobjordaens-1.json |
| Fernand Léger | Q157183 | 7 | 367 | +225 | 232 | zz-commons-fernandlger-1.json |
| Félix Vallotton | Q123740 | 43 | 392 | +237 | 280 | zz-commons-flixvallotton-1.json |
| Akseli Gallen-Kallela | Q170068 | 6 | 353 | +312 | 318 | zz-commons-akseligallenkallela-1.json |
| Albert Edelfelt | Q356644 | 17 | 363 | +210 | 227 | zz-commons-albertedelfelt-1.json |
| Angelica Kauffmann | Q123098 | 29 | 351 | +282 | 311 | zz-commons-angelicakauffmann-1.json |
| Aelbert Cuyp | Q313194 | 31 | 310 | +275 | 306 | zz-commons-aelbertcuyp-1.json |
| Charles-François Daubigny | Q252357 | 35 | 305 | +214 | 249 | zz-commons-charlesfranoisdaubigny-1.json |
| Joseph Wright of Derby | Q214062 | 8 | 277 | +248 | 256 | zz-commons-josephwrightofderby-1.json |
| Thomas Eakins | Q214905 | 17 | 284 | +196 | 213 | zz-commons-thomaseakins-1.json |
| Franz Xaver Winterhalter | Q168659 | 19 | 278 | +227 | 246 | zz-commons-franzxaverwinterhalter-1.json |
| Rosa Bonheur | Q241732 | 29 | 285 | +153 | 182 | zz-commons-rosabonheur-1.json |
| Ernst Ludwig Kirchner | Q229272 | 35 | 276 | +272 | 307 | zz-commons-ernstludwigkirchner-1.json |
| Ferdinand Hodler | Q214564 | 10 | 244 | +78 | 88 | zz-commons-ferdinandhodler-1.json |
| Pieter Brueghel the Younger | Q255828 | 24 | 249 | +184 | 208 | zz-commons-pieterbruegheltheyounger-1.json |
| Jean Siméon Chardin | Q207447 | 12 | 219 | +122 | 134 | zz-commons-jeansimonchardin-1.json |
| Hyacinthe Rigaud | Q49898 | 9 | 216 | +146 | 155 | zz-commons-hyacintherigaud-1.json |
| Philippe de Champaigne | Q314814 | 11 | 217 | +119 | 130 | zz-commons-philippedechampaigne-1.json |
| Élisabeth Louise Vigée Le Brun | Q213163 | 28 | 233 | +182 | 210 | zz-commons-lisabethlouisevigelebrun-1.json |
| Franz Marc | Q44054 | 6 | 203 | +163 | 169 | zz-commons-franzmarc-1.json |
| Gerard van Honthorst | Q314548 | 27 | 224 | +178 | 205 | zz-commons-gerardvanhonthorst-1.json |
| Joshua Reynolds | Q194402 | 587 | 776 | +61 | 648 | zz-commons-joshuareynolds-2.json |
| Claude Lorrain | Q214074 | 42 | 227 | +160 | 202 | zz-commons-claudelorrain-1.json |
| Lucas Cranach the Younger | Q170339 | 11 | 182 | +152 | 163 | zz-commons-lucascranachtheyounger-1.json |
| Jean-Baptiste Camille Corot | Q148475 | 844 | 998 | +116 | 960 | zz-commons-jeanbaptistecamillecorot-2.json |
| August Macke | Q33981 | 7 | 155 | +91 | 98 | zz-commons-augustmacke-1.json |
| Simon Vouet | Q317920 | 17 | 159 | +101 | 118 | zz-commons-simonvouet-1.json |
| Théodore Rousseau | Q310025 | 32 | 162 | +100 | 132 | zz-commons-thodorerousseau-1.json |
| Antoine Watteau | Q183221 | 2 | 131 | +58 | 60 | zz-commons-antoinewatteau-1.json |
| Quinten Metsys | Q314275 | 14 | 138 | +97 | 111 | zz-commons-quintenmetsys-1.json |
| Adriaen Brouwer | Q364139 | 23 | 147 | +116 | 139 | zz-commons-adriaenbrouwer-1.json |
| Horace Vernet | Q161145 | 37 | 148 | +105 | 142 | zz-commons-horacevernet-1.json |
| John Constable | Q159297 | 423 | 533 | +60 | 483 | zz-commons-johnconstable-2.json |
| Maurice Denis | Q440369 | 47 | 153 | +54 | 101 | zz-commons-mauricedenis-1.json |
| Lucas Cranach the Elder | Q191748 | 832 | 937 | +32 | 864 | zz-commons-lucascranachtheelder-3.json |
| Thomas Couture | Q326434 | 21 | 112 | +62 | 83 | zz-commons-thomascouture-1.json |
| Paula Modersohn-Becker | Q234370 | 6 | 96 | +69 | 75 | zz-commons-paulamodersohnbecker-1.json |
| Hans Baldung Grien | Q164696 | 20 | 105 | +84 | 104 | zz-commons-hansbaldunggrien-1.json |
| Antoine-Jean Gros | Q216999 | 8 | 92 | +64 | 72 | zz-commons-antoinejeangros-1.json |
| Paulus Potter | Q355406 | 34 | 111 | +77 | 111 | zz-commons-pauluspotter-1.json |
| Albert Bierstadt | Q77132 | 411 | 483 | +70 | 481 | zz-commons-albertbierstadt-2.json |
| Raphael | Q5597 | 183 | 253 | +12 | 195 | zz-commons-raphael-2.json |
| Hans von Aachen | Q152835 | 7 | 73 | +57 | 64 | zz-commons-hansvonaachen-1.json |
| Paul Delaroche | Q322582 | 15 | 77 | +50 | 65 | zz-commons-pauldelaroche-1.json |
| Dieric Bouts | Q313561 | 14 | 75 | +50 | 64 | zz-commons-diericbouts-1.json |
| Filippo Lippi | Q205148 | 22 | 79 | +56 | 78 | zz-commons-filippolippi-1.json |
| Filippino Lippi | Q296265 | 21 | 76 | +49 | 70 | zz-commons-filippinolippi-1.json |
| Ludovico Carracci | Q380553 | 7 | 62 | +41 | 48 | zz-commons-ludovicocarracci-1.json |
| Vittore Carpaccio | Q5581 | 24 | 78 | +47 | 71 | zz-commons-vittorecarpaccio-1.json |
| Jan Brueghel the Elder | Q209050 | 370 | 424 | +7 | 377 | zz-commons-janbruegheltheelder-2.json |
| Frédéric Bazille | Q207298 | 13 | 64 | +47 | 60 | zz-commons-frdricbazille-1.json |
| Giulio Romano | Q215305 | 6 | 57 | +46 | 52 | zz-commons-giulioromano-1.json |
| Hendrick Avercamp | Q212593 | 6 | 57 | +47 | 53 | zz-commons-hendrickavercamp-1.json |
| Pieter Aertsen | Q326548 | 14 | 63 | +52 | 66 | zz-commons-pieteraertsen-1.json |
| André Derain | Q156272 | 27 | 75 | +26 | 53 | zz-commons-andrderain-1.json |
| El Greco | Q301 | 463 | 510 | +36 | 499 | zz-commons-elgreco-2.json |
| Francisco Goya | Q5432 | 482 | 526 | +33 | 515 | zz-commons-franciscogoya-2.json |
| Bartolomé Esteban Murillo | Q192062 | 270 | 314 | +6 | 276 | zz-commons-bartolomestebanmurillo-2.json |
| Jan Steen | Q205863 | 361 | 405 | +18 | 379 | zz-commons-jansteen-2.json |
| Antonio da Correggio | Q8457 | 86 | 128 | +7 | 93 | zz-commons-antoniodacorreggio-2.json |
| Jacob van Ruisdael | Q213612 | 443 | 485 | +20 | 463 | zz-commons-jacobvanruisdael-2.json |
| Antonello da Messina | Q5594 | 9 | 50 | +33 | 42 | zz-commons-antonellodamessina-1.json |
| Fra Bartolomeo | Q7780 | 7 | 46 | +39 | 46 | zz-commons-frabartolomeo-1.json |
| Pietro Lorenzetti | Q309635 | 8 | 46 | +37 | 45 | zz-commons-pietrolorenzetti-1.json |
| Sofonisba Anguissola | Q236038 | 9 | 45 | +32 | 41 | zz-commons-sofonisbaanguissola-1.json |
| Piero di Cosimo | Q280851 | 11 | 47 | +39 | 50 | zz-commons-pierodicosimo-1.json |
| Frans Hals | Q167654 | 266 | 298 | +11 | 277 | zz-commons-franshals-2.json |
| Jusepe de Ribera | Q297838 | 232 | 264 | +7 | 239 | zz-commons-jusepederibera-2.json |
| Simone Martini | Q221043 | 11 | 43 | +28 | 39 | zz-commons-simonemartini-1.json |
| Gentile da Fabriano | Q312393 | 12 | 42 | +30 | 42 | zz-commons-gentiledafabriano-1.json |
| Hugo van der Goes | Q215251 | 10 | 39 | +26 | 36 | zz-commons-hugovandergoes-1.json |
| Hans Holbein the Younger | Q48319 | 124 | 152 | +3 | 127 | zz-commons-hansholbeintheyounger-2.json |
| Paul Cézanne | Q35548 | 725 | 752 | +24 | 749 | zz-commons-paulczanne-2.json |
| Alfred Sisley | Q175130 | 789 | 814 | +6 | 795 | zz-commons-alfredsisley-2.json |
| Wilhelm Busch | Q109540 | 7 | 31 | +14 | 21 | zz-commons-wilhelmbusch-1.json |
| Cosimo Rosselli | Q29447 | 6 | 27 | +17 | 23 | zz-commons-cosimorosselli-1.json |
| Edward Burne-Jones | Q216406 | 215 | 234 | +0 | 215 | (none new) |
| Jacopo Bellini | Q313310 | 7 | 26 | +13 | 20 | zz-commons-jacopobellini-1.json |
| Nicolai Abildgaard | Q319854 | 100 | 119 | +26 | 126 | zz-commons-nicolaiabildgaard-2.json |
| Camille Pissarro | Q134741 | 758 | 776 | +19 | 777 | zz-commons-camillepissarro-2.json |
| Andrea del Castagno | Q240737 | 7 | 25 | +17 | 24 | zz-commons-andreadelcastagno-1.json |
| Robert Campin | Q80442 | 15 | 30 | +11 | 26 | zz-commons-robertcampin-1.json |
| Vincent van Gogh | Q5582 | 1229 | - | +7 | 1236 | zz-commons-vincentvangogh-3.json |
| Claude Monet | Q296 | 1191 | - | +8 | 1199 | zz-commons-claudemonet-2.json |
| Pierre-Auguste Renoir | Q39931 | 991 | - | +360 | 1351 | zz-commons-pierreaugusterenoir-3.json |
| Rembrandt van Rijn | Q5598 | 853 | - | +33 | 886 | zz-commons-rembrandtvanrijn-3.json |
| Edgar Degas | Q46373 | 753 | - | +7 | 760 | zz-commons-edgardegas-3.json |
| J. M. W. Turner | Q159758 | 659 | - | +2 | 661 | zz-commons-jmwturner-3.json |
| Édouard Manet | Q40599 | 569 | - | +11 | 580 | zz-commons-douardmanet-3.json |
| Georges Seurat | Q34013 | 150 | - | +3 | 153 | zz-commons-georgesseurat-2.json |

Total: 12485 rows staged across 100 painters, 0 duplicate ids inside the staged set.
