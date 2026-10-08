# ColorHub competitor teardown (R1, 2026-10-08)

Brief: design/lanes/R1-competitors.md, sections 1 to 6. Sections 7 and 8 (encyclopedias, Pantone and legal) are in design/LEGAL-COLOR-DATA.md.

**Method.** Facts come from official pages, store listings and the press, each with a link, written in my own words. Nothing is copied.
- **iOS ratings:** pulled from Apple's public iTunes Search API (US store) on 2026-10-08. Shown as *4.8 (49.6K)*, meaning the average stars and the number of ratings.
- **Android:** "Play" figures come from the Google Play listing pages on the same day.
- **Labels:** "unverified" means I couldn't confirm the item. "Assessment" means it's my judgment, not a sourced fact.

---

## 1–2. The landscape: 49 products, in 6 groups

Columns: **What / for whom · Signature · Take (worth adapting) · Lacks (our edge) · Model & price · Scale · Sources**.

### A. Color capture and palettes (12)

| Product | What / for whom | Signature | Take | Lacks (our edge) | Model & price | Scale | Sources |
|---|---|---|---|---|---|---|---|
| **Adobe Capture** | Camera app that turns photos into design assets, for Adobe designers | Point the camera and get a live 5-color harmonized theme | Live viewfinder palette; sends straight into Creative Cloud libraries | No names, no learning, no history. iOS app last updated 2023; gone from Google Play | Free (an Adobe ID; upsells to CC) | iOS 4.8 (24.3K) | [App Store](https://apps.apple.com/us/app/adobe-capture-illustrator-ps/id1040200189), [Adobe FAQ](https://helpx.adobe.com/lu_en/mobile-apps/help/capture-faq.html) |
| **Adobe Color** | Web color wheel and theme library, for designers | Harmony rules on a wheel; Extract Theme (up to 5 colors) | **Color-blind conflict lines** between swatches that collide; a contrast checker | A color is just a swatch: no story, no names, no art | Free | Unverified | [Accessibility tools](https://helpx.adobe.com/creative-cloud/adobe-color-accessibility-tools.html) |
| **Coolors** | Fast palette generator, for designers and devs | **Spacebar shuffle with locked colors** | The lock-and-shuffle loop; a visualizer that shows a palette on real layouts; contrast checks | Thin color pages; no eye training, art or depth | Freemium. Pro $3/mo billed yearly, or a lifetime deal at $99 (listed down from $149) | Says it has "8M+" users and 10M+ palettes. iOS 4.8 (10.6K) | [Pricing](https://coolors.co/pricing), [home](https://coolors.co/), [App Store](https://apps.apple.com/us/app/coolors/id956480678) |
| **Pantone Connect** | Pantone library access in a phone, the web and Adobe | **Color Match Card**: calibrates the phone camera to match colors to Pantone | Calibrated capture, so accuracy is earned, not assumed | Closed library behind a paywall; poorly rated | Premium about $7.99/mo or $59.99/yr in the US; Card $14.99 | iOS 3.1 (214) | [Pantone Connect](https://www.pantone.com/pantone-connect), [PrintWeek](https://printweek.com/articles/pantone-hikes-connect-pricing), [Creative Bloq](https://www.creativebloq.com/news/pantone-color-match-card), [App Store](https://apps.apple.com/us/app/pantone-connect/id1491023737) |
| **Sherwin-Williams Color Expert** (formerly ColorSnap) | Paint picker for home owners | Photo of your room, then try paint on the walls; order samples | Tap a surface to recolor it (masking) | Sells one brand's paint; no learning | Free, a funnel for paint sales | iOS 4.6 (7.3K) | [App Store](https://apps.apple.com/us/app/sherwin-williams-color-expert/id6466933712) |
| **Benjamin Moore Color Portfolio** | Paint picker for home owners | Virtual fan deck; photo and AR video visualizer | AR "try on" in real time; a fan deck as a browsing metaphor | Same as above | Free (a sales funnel) | iOS 4.5 (11.7K); Play 500K+ | [App Store](https://apps.apple.com/us/app/color-portfolio/id1490161691), [Play](https://play.google.com/store/apps/details?id=com.benjaminmoore.colorportfolio) |
| **Color Grab** (Loomatix) | Android camera color detector | Live color plus a name under the crosshair | Instant "what color is that?" | Generic names, no teaching, ads | Ads plus in-app purchases | Play 1M+, 4.5 (16.4K) | [Play](https://play.google.com/store/apps/details?id=com.loomatix.colorgrab) |
| **Color Name AR** | iOS camera color namer | Names from the camera; shows Pantone suggestions | Proves people want camera naming | Shallow database; no learning | Free; Pro $4.99 | iOS 4.4 (8.2K) | [App Store](https://apps.apple.com/us/app/color-name-ar/id906955675) |
| **Khroma** | AI palette tool, for designers | **Train it on ~50 colors you like**, then it generates palettes for you | Taste training in the browser; a WCAG rating for every pair | No meaning or history; a taste engine only | Free, no sign-up | Unverified | [khroma.co](https://www.khroma.co/), [Hack Design](https://www.hackdesign.org/toolkit/khroma/) |
| **Huemint** | Machine-learning coloring for layouts | **Contrast matrix**: set how much contrast each color pair needs | Role-aware palettes (background, accent, text) | Designer-only | Free (no pricing page found) | Unverified | [huemint.com/about](https://huemint.com/about/) |
| **Colormind** | Deep-learning palette generator | **Loads a new style each day** from film, art and photos (e.g. Mao-era posters) | A daily dataset palette with a one-line context note | No depth past the one line | Free, with an API | Unverified | [colormind.io](http://colormind.io/) |
| **Color Hunt** | Hand-curated palette feed (Gal Shir, since 2015) | Community palettes with likes | **Likes kept in localStorage, no account**; tight curation | Four-color palettes only; nothing to learn | Free (donations, a Chrome extension) | Unverified | [colorhunt.co](https://colorhunt.co/), [Dribbble](https://dribbble.com/stories/2018/08/22/gal-shir-color-hunt), [Hongkiat](https://www.hongkiat.com/blog/user-curated-color-palettes-color-hunt/) |

"Palette Cam" (named in the brief) had no notable listing on the App Store; it's skipped.

### B. Color learning and eye training (9)

| Product | What / for whom | Signature | Take | Lacks (our edge) | Model & price | Scale | Sources |
|---|---|---|---|---|---|---|---|
| **I Love Hue / I Love Hue Too** (Zut, Bristol) | Calm gradient puzzle, for everyone | Drag tiles into a perfect spectrum | **Calm feel, minimal art, a synth score**; trains fine hue steps | No names, no transfer to the real world, no art | Free with ads and in-app purchases | iOS 4.9 (49.6K) plus 4.9 (40.7K); Play 10M+, 4.8 (277K) | [App Store 1](https://apps.apple.com/us/app/i-love-hue/id1081075274), [App Store 2](https://apps.apple.com/us/app/i-love-hue-too/id1395332051), [Play](https://play.google.com/store/apps/details?id=com.zutgames.ilovehue) |
| **Colorma** (Logisk) | Gradient puzzle on crossword-like grids | Gradients that cross and share tiles | Hand-made level design with twists (decoys, clones) | Puzzle only | Free with in-app purchases | iOS 4.9 (1.2K) | [App Store](https://apps.apple.com/us/app/colorma/id6471999662) |
| **Specimen** (PepRally) | Speed game: tap the blob that matches the background | **The color spread shrinks as you improve** (an adaptive staircase) | Adaptive difficulty; built at New Inc to study how age, place and screens affect color seeing | Abandoned (last update 2016); iOS 3.4 (11) | Free with in-app purchases | Small | [App Store](https://apps.apple.com/us/app/specimen-a-game-about-color/id999930535), [Macworld](https://www.macworld.com/article/226231/meet-specimen-an-ios-game-that-proves-you-cant-see-color-as-well-as-you-thought.html) |
| **X-Rite Color Challenge** | Free online test based on the Farnsworth-Munsell 100 Hue test | Order 4 rows of chips; 0 is a perfect score | A credible baseline score you can retake | One-off lead generation; no training | Free | Unverified | [xrite.com/hue-test](https://xrite.com/hue-test), [PetaPixel](https://petapixel.com/2011/04/20/test-how-well-you-see-color-with-x-rites-color-iq-test/) |
| **EnChroma test** | Online color-blindness screen | Ishihara-style plates with an adaptive algorithm | Adaptive testing | A funnel for its glasses | Free | Over 1M people have taken it (company claim) | [CreativePro](https://creativepro.com/test-your-color-vision-with-a-free-color-blindness-test-app-enchroma/) |
| **Color Blind Pal** | A tool for color-blind people | Inspect, correct, simulate ("empathy mode") | Simulation as empathy | Utility only | Free | iOS 3.9 (143) | [HMC](https://www.hmc.edu/about/?p=4345), [App Store](https://apps.apple.com/us/app/color-blind-pal/id1037744228) |
| **Dialed.gg** | Browser memory game | **See a color for a moment, then rebuild it on hue, saturation and brightness sliders**; scored /50 | One mechanic you get in 3 seconds; a humbling first score; challenge a friend | No names or meaning; "memory" is all it trains | Free (an ad-free tier) | About 30M plays and 20M visits in its first 90 days; App Store clones like "Dialed – Guess the Color" at 4.9 (478) | [dialed.gg](https://dialed.gg/), [Fast Company](https://www.fastcompany.com/91541596/dialed-color-matching-game), [App Store clone](https://apps.apple.com/us/app/dialed-guess-the-color/id6761396437) |
| **Thinkrolls** (Avokiddo) | Logic games for kids 2–8 (color only incidental) | Physics puzzles and an art station | No ads, no data collection | Kids' apps teach only basic color words | Paid or subscription | Unverified | [App Store](https://apps.apple.com/us/app/-/id1530907314) |
| **"Kolor" / hue-match clones** | Many tiny RGB-slider and gradient-dot games | Match a color with sliders | Nothing new | Tiny scale, generic | Ads | Small | [Hue Match](https://apps.apple.com/us/app/id1571431001), [Colour Match Game](https://apps.apple.com/us/app/id6502253743) |

### C. Color reference and encyclopedias (11)

Each one's data, license and what we may take are in LEGAL-COLOR-DATA.md §7.

| Product | What / for whom | Signature | Take | Lacks (our edge) | Model | Scale | Sources |
|---|---|---|---|---|---|---|---|
| **Encycolorpedia** | A page for every hex, for designers and DIYers | **Paint matches across ~100s of brands, with ΔE and LRV**; color-blindness simulations labeled with prevalence; a WCAG contrast table; an OpenAPI | A **search language** (`hue(80,170) lrv(55,65)`); a ΔE to every system; "computed, actual paint may differ" caveats | No narrative, no art, no learning. No Pantone in its brand list as seen today | Free, ads, an API | Unverified | [#bb2649](https://encycolorpedia.com/bb2649), [help](https://encycolorpedia.com/help), [paints](https://encycolorpedia.com/paints) |
| **ColorHexa** | A conversion page for every hex | ~12 color spaces; schemes; a blindness simulator; a one-line description ("strong red") | Exhaustive conversions | Pure numbers | Free, ads | Unverified | [#bb2649](https://www.colorhexa.com/bb2649) |
| **color-name.com** | Hex pages, palettes, "Name a Color" | Name lookup, trending colors, a visualizer | User naming as engagement | Thin text; its terms say logos are used under "fair usage" (weak) | Free, ads | Unverified | [terms](https://www.color-name.com/terms) |
| **Wikipedia color lists** | Large alphabetical lists of named colors, each with hex and source | A source line for each color list (X11, Crayola, ISCC-NBS…) | The source discipline | Uneven depth; no visual learning | Free, CC BY-SA text | Huge reach | [List A–F](https://en.wikipedia.org/wiki/List_of_colors:_A%E2%80%93F) |
| **The Secret Lives of Colour** (Kassia St Clair, 2016) | A narrative book: short biographies of 75 colors | A **story for every color** | Proves people want color biographies; a new edition adds 25 colors | A book: no swatches you can trust, no links, no training | A book | Sunday Times top-ten bestseller; Radio 4 Book of the Week (2017); 9 to 15+ languages | [Hachette NZ](https://www.hachette.co.nz/kassia-st-clair/the-secret-lives-of-colour), [Hachette India](https://www.hachetteindia.com/Home/bookdetails/Info/9781399823586/secret-lives-of-colour-new-edition-with-25-new-colours), [Marjacq](https://www.marjacq.com/kassia-st-clair) |
| **ColourLex** | Science and art: a pigment lexicon plus **pigment analyses of real paintings** | Paintings browsable by the pigments in them; pigment timelines | A pigment-to-painting link, with scientific method | Small corpus; no learning | Free site; sells teacher resources and a German book (367 pigments) | Unverified | [colourlex.com](https://colourlex.com/) |
| **The Color of Art Pigment Database** | Color Index names and numbers with chemistry, for painters | Every CI code (PB29, PR83…) | CI codes as the backbone of pigment identity | 1990s web; no visuals | Free, affiliate links | Unverified | [artiscreation.com](https://www.artiscreation.com/Color_index_names.html) |
| **Name That Color (ntc.js)** | Nearest-name lookup (Chirag Mehta) | ~1,500 names from Wikipedia, Crayola and dictionaries | Dead-simple "closest name" | Names with no context | Free library | Wide developer use | [npm](https://www.npmjs.com/package/ntc) |
| **colornames.org** | Crowd naming of all 16.7M RGB colors, with votes | A random color: name it, vote | A participation loop; **data CC0** | Joke names; no curation | Free | Unverified | [colornames.org](https://colornames.org/), [download](https://colornames.org/download/), [Kottke](https://kottke.org/20/04/0036545-colornames-is-a-collabora) |
| **color-name-list** (meodai) | 31,918 unique names, MIT | Strict de-duplication; an API (color.pizza) | A clean, unique name-to-hex map | Mixed upstream sources (see LEGAL §7) | Open source | Popular on npm | [README](https://unpkg.com/color-name-list@14.50.0/README.md) |
| **Werner's Nomenclature online** (Nicholas Rougeux) | Interactive 1821 Werner: 110 colors | **Each color shows its animal, vegetable and mineral example** | "Twins in nature" as a way in | A single book | Free | Press coverage | [c82.net/werner](https://www.c82.net/werner/), [Fast Company](https://www.fastcompany.com/90239248/a-200-year-old-guide-to-color-redesigned-for-the-internet-age) |

### D. Art and museum apps (7)

| Product | What / for whom | Signature | Take | Lacks (our edge) | Model & price | Scale | Sources |
|---|---|---|---|---|---|---|---|
| **Google Arts & Culture** (incl. **Art Palette**) | Culture from 2,000+ institutions in 80 countries | **Art Palette**: pick 5 colors or upload a photo and find artworks with that palette | Photo-to-paintings by palette | Color is a one-off experiment; no names, no training, no stats | Free (Google) | iOS 4.7 (133.5K); Play 10M+ | [Art Palette](https://artsandculture.google.com/story/cQWRLHCd3edAIg), [Wallpaper](https://wallpaper.com/art/google-arts-and-culture-art-palette), [App Store](https://apps.apple.com/us/app/google-arts-culture/id1050970557) |
| **Smartify** | "Shazam for art": scan a work for its story, plus audio tours | Image recognition in galleries | Scan a real object and learn | No color lens | Free; a social enterprise (CIC); shop sales | iOS 4.5 (9.5K); 140+ museum partners (2017 to 2018) | [App Store](https://apps.apple.com/us/app/smartify-arts-and-culture/id1102736524), [Dezeen](https://www.dezeen.com/2017/10/08/new-app-smartify-hailed-shazam-art-world-technology/amp/), [Attractions Mgmt](https://www.attractionsmanagement.com/attractions-products-and-services/New-Smartify-app-brings-visitors-closer-to-their-favourite-artworks-explains-Anna-Lowe/332285) |
| **Rijksmuseum** (Rijksstudio, then the 2024 collection site and Art Explorer) | Open collection: public-domain images (2013), an API (2013); AI mood search (Nov 2024) | Free high-res downloads; an **AI "Art Explorer"** | Open data as a strategy; mood prompts as search | The color-browse experiment (Rijkscolors) was switched off | Free | iOS 4.8 (1.1K) | [data.rijksmuseum.nl](https://data.rijksmuseum.nl/), [Blooloop](https://blooloop.com/museum/news/rijksmuseum-ai-tool-art-explorer/), [Cooper Hewitt Labs](https://labs.cooperhewitt.org/?p=1747) |
| **Artsy** | Art marketplace: 1M+ works by 90K+ artists | **Color as a browse category and alert filter** | Color as a first-class filter next to medium and period | Commerce; no seeing or learning | Commission on sales | iOS 4.8 (6.5K) | [App Store](https://apps.apple.com/us/app/artsy-buy-sell-fine-art/id703796080), [Lazyweb flow](https://lazyweb.com/canvas/flows/artsy/explore-by-category) |
| **WikiArt** | 250K+ works by 3,000 artists | Browse by style, genre and period | Movement and genre taxonomy | No color analysis; image rights are mixed | App $3.99; web free | iOS 4.8 (1.9K) | [App Store](https://apps.apple.com/us/app/wikiart/id1235995167) |
| **DailyArt** | One artwork a day with a short story | **A daily ritual**; 5,000 works, 1,500 bios | The daily habit format | No color lens | Freemium | iOS 4.8 (37.5K) | [App Store](https://apps.apple.com/us/app/dailyart/id547982045) |
| **Cooper Hewitt "Rijkscolors"** | A 2013 experiment browsing two museums by color | Cross-museum color browsing | The idea itself | Disabled | n/a | n/a | [Cooper Hewitt Labs](https://labs.cooperhewitt.org/?p=1747) |

### E. Design history and trend tools (2, plus Color Hunt in A)

| Product | What / for whom | Signature | Take | Lacks (our edge) | Model | Scale | Sources |
|---|---|---|---|---|---|---|---|
| **Pantone Color of the Year** | Yearly trend pick, run since 1999; 2026 is 11-4201 Cloud Dancer, the first white | **One color a year, plus brand tie-ins** (Play-Doh, Post-it, Motorola…) | An annual ritual and press moment | Marketing; no evidence; one color | Licensing and partnerships | Worldwide press | [Galerie](https://galeriemagazine.com/pantone-announces-cloud-dancer-color-of-the-year-2026/), [Manila Bulletin](https://mb.com.ph/2025/12/04/pantone-announces-its-2026-color-of-the-year-cloud-dancer) |
| **WGSN × Coloro** | B2B forecasting plus a color system; COTY 2026 "Transformative Teal" | **Coloro code**: 7 digits for hue (000–160), lightness (00–99) and chroma (00–99); 1.6M codes, 4,459 stocked | A perceptual code anyone can read | Paywalled B2B | Enterprise subscriptions (no public price) | Industry standard | [Coloro system](https://www.coloro.com/the-coloro-system), [WGSN](https://www.wgsn.com/en/blogs/colour-year-2026-transformative-teal) |

### F. Learning-app and daily-game benchmarks (9)

| Product | Signature | Take | Lacks / note | Model & price | Scale | Sources |
|---|---|---|---|---|---|---|
| **Duolingo** | Streaks, leagues, one path | One clear path. A **one-time event to revive lost streaks** helped Q2 2026 DAU growth | Progress shown as XP, not delayed recall (our rule) | Freemium | DAU 58.7M (+23% YoY), 12.7M paid subscribers, $298.5M revenue (Q2 2026); iOS 4.7 (5.5M) | [Q2 2026 letter](https://www.sec.gov/Archives/edgar/data/0001562088/000162828026053299/q2fy26duolingo6-30x26share.htm), [GlobeNewswire](https://www.globenewswire.com/news-release/2026/08/05/3339653/0/en/Duolingo-Reports-Second-Quarter-2026-Results.html) |
| **Anki** | **FSRS** scheduler (optional since 23.10): a difficulty-stability-retrievability model | A target-retention slider; fewer reviews for the same retention | Ugly; build-your-own decks | Desktop free; AnkiMobile $24.99 | iOS 4.0 (2.3K) | [Anki FAQ](https://faqs.ankiweb.net/what-spaced-repetition-algorithm), [Wikipedia](https://en.wikipedia.org/wiki/Anki_(software)) |
| **Quizlet** | Learn mode (adaptive within a session) | Fast flip-and-swipe cards | Not true spacing unless you pay | Plus about $7.99/mo or $35.99/yr | 50M+ monthly users (older figure); iOS 4.8 (1.13M) | [Mobile Marketing](https://mobilemarketingmagazine.com/mobile-learning-tool-quizlet-reaches-50m-monthly-users/), [App Store](https://apps.apple.com/us/app/quizlet-more-than-flashcards/id546473125) |
| **Elevate** | Short daily skill games with skill scores | A per-skill rating | Brain-training claims | Subscription | iOS 4.8 (544K) | [App Store](https://apps.apple.com/us/app/elevate-brain-training-games/id875063456) |
| **Brilliant** | Interactive, hands-on lessons | Learn by manipulating, not reading | Not color | Premium subscription | iOS 4.7 (32.9K) | [Pricing help](https://brilliant.org/help/pricing-and-plans/how-much-does-brilliant-premium-cost/), [App Store](https://apps.apple.com/us/app/brilliant-learn-math-coding/id913335252) |
| **Colorfle** | Daily: guess the **mix of 3 colors** in 6 tries | A mixing puzzle with Wordle feedback | No names, no pigments | Free web | Unverified | [colorfle.com](https://www.colorfle.com/) |
| **Hexcodle** | Daily hex-code guess (game #1,154 on 2026-10-08) | Archive, custom games, a streak | Hex is trivia, not seeing | Free plus donations | Long-running | [hexcodle.com](https://hexcodle.com/) |
| **Colordle** | Daily: guess the hidden color **by name or hex**; scored by CIELAB distance | **Direction hints** (lighter/darker, redder/greener, yellower/bluer); a 3D explorer | Name list unclear; no learning | Free web | Unverified | [colordle.org](https://colordle.org/) |
| **Happy Color** (benchmark) | Paint-by-number | Shows how big "calm color play" can get | It's coloring, not seeing | Ads plus in-app purchases | iOS 4.8 (3.42M) | [App Store](https://apps.apple.com/us/app/happy-color-coloring-games/id1407852246) |

---

## 3. Feature matrix (assessment from the listings and pages above)

● strong · ◐ partial · ○ none. ColorHub's row is what's on main today, plus what's in flight (marked †).

| Product | Naming depth | Learning path | Eye training | Painting archive | Sourced articles | Photo palettes | Mixing | Design history | Social / daily |
|---|---|---|---|---|---|---|---|---|---|
| **ColorHub** | ● ~3,700 names, sourced lists | ● one path + spaced review | ● gym | ● 23,531 paintings, analyzed | ◐† pilot | ● | ◐† | ◐ | ◐ |
| Adobe Capture / Color | ○ | ○ | ○ | ○ | ○ | ● | ○ | ◐ trends | ◐ |
| Coolors | ◐ | ○ | ○ | ○ | ○ | ● | ○ | ○ | ◐ |
| Pantone Connect | ◐ own names | ○ | ○ | ○ | ○ | ● calibrated | ○ | ◐ COTY | ○ |
| Paint-brand apps | ◐ own names | ○ | ○ | ○ | ○ | ● AR | ○ | ○ | ○ |
| I Love Hue | ○ | ◐ levels | ● | ○ | ○ | ○ | ○ | ○ | ◐ |
| Dialed.gg | ○ | ○ | ● memory | ○ | ○ | ○ | ○ | ○ | ● |
| X-Rite / EnChroma tests | ○ | ○ | ◐ test only | ○ | ○ | ○ | ○ | ○ | ○ |
| Encycolorpedia | ● | ○ | ○ | ○ | ○ | ◐ | ○ | ○ | ○ |
| Wikipedia lists | ● | ○ | ○ | ○ | ● | ○ | ○ | ◐ | ○ |
| Secret Lives of Colour | ◐ 75 colors | ○ | ○ | ◐ | ● | ○ | ○ | ● | ○ |
| ColourLex | ◐ pigments | ○ | ○ | ◐ dozens analyzed | ● | ○ | ○ | ◐ | ○ |
| Google Arts & Culture | ○ | ○ | ○ | ● (no color stats) | ● | ● Art Palette | ○ | ● | ◐ |
| Colorfle / Colordle / Hexcodle | ◐ Colordle | ○ | ◐ | ○ | ○ | ○ | ◐ Colorfle | ○ | ● |
| Duolingo / Anki (mechanics) | n/a | ● | n/a | n/a | n/a | n/a | n/a | n/a | ● |

**Reading it:** no one else fills more than three columns strongly. The white space is the row: names, eye and art, connected.

---

## 4. Steal list: the 20 best ideas, and how each gets better inside ColorHub

| # | Idea (credit) | ColorHub version (the connected upgrade) |
|---|---|---|
| 1 | **Lock and shuffle** (Coolors) | Shuffle inside a *source*: "shuffle within Sargent's Venice palette" or "within 1660s Dutch". Every chip is a named color that opens its page. |
| 2 | **Live camera theme** (Adobe Capture) | The camera names each color (nearest of ~1,000), offers "learn these 5" as a mini-deck, and shows the paintings that share the palette. |
| 3 | **Color-blind conflict lines** (Adobe Color) | On every palette and painting: lines between colors that merge under deuteranopia, protanopia or tritanopia. Then "see this Monet as a deuteranope". |
| 4 | **Calibrated capture** (Pantone Color Match Card) | A free calibration step: hold a white sheet in frame, and photo palettes get white-balanced. Report "± accuracy" honestly. |
| 5 | **Tap a surface to recolor** (Benjamin Moore, Sherwin-Williams) | The same masking in reverse: tap a color in a painting to light up "where it lives" (L26). Tap a wall photo to try a painter's color. |
| 6 | **Train on 50 likes** (Khroma) | The taste profile (L23): 50 quick picks from the honeycomb train it. The result is *paintings and painters* you'll love, not only palettes. |
| 7 | **Contrast matrix and roles** (Huemint) | Export a painter palette with roles (ground, mid, accent, text) and WCAG checks, so archive palettes become usable design systems. |
| 8 | **A daily dataset style** (Colormind) | "Palette of the day" from a real painting, film or flower, with its field-note facts and a link to the full reading. |
| 9 | **No-account likes in localStorage** (Color Hunt) | Already our model. Make the Cabinet and favorites work fully offline, with export and backup. |
| 10 | **Calm gradient arranging** (I Love Hue) | Gym levels by *family* ("order these 9 named blues") that use real names, so ordering teaches words as well as the eye. |
| 11 | **A shrinking spread, i.e. an adaptive staircase** (Specimen) | Measure a just-noticeable difference per family and per dimension (hue, value, chroma). Store it in the Learner Model and show a ΔE threshold that improves. |
| 12 | **A baseline FM-100 score** (X-Rite) | An optional "eye check" on day 1 and day 30. Honest wording: training, not diagnosis. |
| 13 | **See it, then rebuild it from memory** (Dialed.gg) | "Color memory" built from a painting detail or a named color. Recall before reveal; scored as ΔE; a share card shows the target and your guess. |
| 14 | **CIELAB distance plus direction hints** (Colordle) | A daily "find the color" game, answered by *name* from our list. Hints use our look-alike direction words ("a touch greener"). |
| 15 | **Guess the mix** (Colorfle) | A Mix-lab daily: "which 3 pigments made this?", using our own mixing model and real pigment names linked to articles. |
| 16 | **A shareable result grid** (Wordle, Hexcodle) | A swatch-strip share image with no spoilers; it links to the color's page. |
| 17 | **Streak repair** (Duolingo, Q2 2026) | A gentle streak with one free repair a month. Progress stays *delayed recall*, never XP. |
| 18 | **FSRS scheduling and a retention slider** (Anki) | Move the deck to a difficulty-stability model per card, and pair confusions from the Learner Model. Users set "how sure I want to be". |
| 19 | **ΔE and LRV against every system; labeled color-blind sims** (Encycolorpedia) | The "Color measured" field notes: ΔE to ISCC-NBS, Munsell, RAL and NCS approximations, always labeled as approximate. |
| 20 | **A search language** (Encycolorpedia `hue() lrv()`) | Explore power search across the graph, e.g. "greens · Monet · 1880s · lightness > 70". |

Honorable mentions:
- Art Palette's photo-to-paintings (we have the 23,531-painting index to beat it with statistics).
- Werner's animal, vegetable and mineral twins (feeds "Twins in the world").
- DailyArt's one-a-day story.
- ColourLex's pigment-in-painting analyses (a pigment layer on paintings, where it's documented).
- Artsy's color as a top-level browse facet.

---

## 5. Our moat

**What no one else can do.** ColorHub is the only product that joins four things, and it joins them through one graph:
- **the vocabulary:** ~2,700 to 3,700 names, each with a source and date, and biographies at their true depth;
- **the eye:** a gym that measures thresholds per family;
- **the art:** 23,531 paintings by 837+ painters, read for color statistically (shares, roles, lifts, decades);
- **the learner:** a Learner Model that knows what you confuse.

The links are what competitors can't copy:
- Google can match a palette to a painting, but it can't tell you the name of what you're looking at, that you mix it up with its neighbor, or that Sargent used it four times more than his peers.
- I Love Hue trains the eye but never names a color.
- Encycolorpedia names every hex but never shows you one in a painting.
- *The Secret Lives of Colour* tells 75 stories but can't measure anything.

Our edge is **measure, then tell, then train**, at archive depth, with every color one tap from every other thing.

**The 3 weakest spots, where a competitor beats us today:**

| # | Weak spot | Who beats us | Fix direction |
|---|---|---|---|
| 1 | **Distribution and proof of retention.** No App Store presence, no accounts or sync, no measured retention. | Coolors (claims 8M+ users), I Love Hue (Play 10M+), Dialed.gg (30M plays in 90 days) | A PWA install push, one viral daily game with a share card, a minimal account for sync, retention analytics |
| 2 | **Capture and workflow.** No calibrated camera, no paint-product matching, no export into Adobe or Figma. | Adobe Capture, Pantone Connect (Match Card), paint-brand apps, Coolors (plugins) | White-sheet calibration; ASE, CSS and JSON export; an optional "nearest paint (approximate)" line from open data only |
| 3 | **Published narrative depth, today.** The article engine is still at pilot stage. | Wikipedia, ColourLex (pigments), *Secret Lives of Colour* (story quality) | Ship the L7 epics first (the ~150 richest pigment stories), with sources visible |

Runner-up: instant game feel. I Love Hue and Dialed.gg each have one mechanic you understand in 3 seconds; our gym is wide and still unproven.

---

## 6. Positioning and naming

**Positioning (one line):** *ColorHub teaches you to see color: the words, the trained eye and the world's paintings, in one connected archive.*

Shorter tagline: **"Learn to see color."**

**Name check.** These are App Store title searches (US iTunes Search API, top 50 results per term) and .com WHOIS lookups, run on 2026-10-08. They aren't a trademark search.

| Candidate | App Store titles containing it | Notes |
|---|---|---|
| ColorHub / Color Hub | **2 taken**: "ColorHub: AI Coloring Page" (2025) and "Color Hub – Discover new tints, shades and tones" (2015) | Confusing, with a weak claim. Keep it only as the working name. |
| **Ochre** | 5, none color-related (Ochre Health, a meditation timer, a bike app, a life log, a game) | Short, art-rooted (one of the oldest pigments). **Risk:** a common color word may be hard to register as a trademark for color goods (descriptiveness), so ask counsel. ochreapp.com and getochre.com are registered; ochrecolor.com and learnochre.com returned no WHOIS record. |
| **Colorlore** | 0 | Says "stories plus knowledge" and is unique on the App Store. colorlore.com is registered (owner unknown). |
| **Hue Atlas** | 0 | Says "archive plus map" (the honeycomb and graph). hueatlas.com is registered. |
| Colorpedia | 0 | Too close to *Encycolorpedia*. Avoid. |
| Seeing Color, Hue School, Lexichrome, Namehue, Madder | 0 each | Usable fallbacks; hueschool.com is registered. |
| Chromatica, Tincture, Huebook, Colorwise, Swatchbook, Color Atlas | 1–7 each | Crowded or taken. Avoid. |

**The 3 best options:**
1. **Ochre**, as "Ochre: Learn to See Color". It's the best brand, but it needs a trademark check.
2. **Colorlore**: the most distinctive and the most legally ownable.
3. **Hue Atlas**: describes the archive and the map, and has no conflicts found.

**Next step (outward-facing, David's call):** run a USPTO/EUIPO search on the top two, check whether the .app domains are free (not checked here), and only then pick.
