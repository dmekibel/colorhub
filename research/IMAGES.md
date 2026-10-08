# Wiki photographs

Photos that break up the wiki text: the mineral, insect, plant or object behind each pigment, the real thing each color is named after, portraits, and historical artifacts (color wheels, plates, manuscripts). Data is in `data/images.js` (`window.WIKI_IMAGES`) and the files are in `img/wiki/`.

## Counts
- **309 images** on **155 pages** (197 on 150 pages in the first pass, 112 added in the recovery pass below).
- **29.2 MB** in total (the 112 added files are 8.8 MB, none over 150 KB; 17 first-pass files are 150 to 318 KB and were left as they were). Every file is a JPEG with its long side at most 900 px, saved progressive. Quality is 80, stepped down to 76, 72 or 68 for detailed textures so each file stays under about 125 KB.
- Pages get 1 to 3 images: pigments and concepts usually have 2, and most colors have 1.

## Licenses
| License | Images |
|---|---|
| Public domain | 116 |
| CC0 | 23 |
| CC BY (2.0 to 4.0) | 41 |
| CC BY-SA (2.0 to 4.0) | 129 |

- Every file comes from Wikimedia Commons. Nothing is fair use or non-free, and nothing has an unclear license.
- Each entry stores the author and license as `credit`, plus `licenseUrl` and the Commons file page as `commons`.
- **The UI must show `credit` and link `licenseUrl` (or `commons`) wherever a CC BY or CC BY-SA image appears.** This is not optional for 170 of the 309 images. Both the inline figures (`figHTML`, js/explore.js) and the gallery strip and viewer (js/gallery-strip.js) do.
- Author strings come from Commons `extmetadata.Artist` with the HTML removed. A few long or garbled ones were shortened by hand to the real author (for example Moses Harris, Patrick Nouhailler, Wellcome Collection). The `commons` page always has the full attribution.
- Colors are honest. Embedded ICC profiles were converted to sRGB, and no filters were applied. One deliberate exception is `value-2`, a lightness-only (greyscale) version of `value-1`.

## Method
- Candidates came from the images in the matching English Wikipedia articles plus Commons search (`list=search`, namespace 6), using the User-Agent `ColorHubBot/1.0`, with the API calls throttled. The cache is in `research/_raw/images/` (gitignored).
- Each pick was made by eye from contact sheets of about 20 candidates per page.
- Captions and alt text are original. Facts in captions follow the Commons file description or the wiki text.
- Images are reused across pages in a few places: the sienna earths, the viridian swatch, and the indigo cake.

## Pages still without images
- **Nodes:** simultaneous-contrast (no clean free scan of Chevreul's contrast plates turned up), color-psychology, qualia, warm-and-cool (nothing beat a generic sunset), josef-albers, yves-klein and interaction-of-color (the artists' works and most photos are still in copyright), berlin-and-kay (living people, no openly licensed photos), remarks-on-colour.
- **Colors:** the basics except Orange, Purple and Pink (Red, Yellow, Green, Blue, Brown, Grey, Black, White), plus Royal blue, Baby pink, Hot pink, Kelly green, Hunter green and Burnt orange. These are named for nothing photographable. Steel blue was also dropped: the only free blued-steel photo was dull.
- **Ideas for later:** a Chevreul contrast plate scan from a library (Gallica or Internet Archive), heat-blued watch screws for Steel blue, and a photo of a 19th-century hunting coat for Hunter green.

## Recovery pass (2026-10-08): 112 more photographs
A cut-off lane had downloaded 323 more JPEGs (img/wiki/<page>-2 and up) but never wrote their data, so none had an author, license or Commons page. Only files whose Commons source could be identified again were kept:
- Each file was matched to its Commons original by image content (difference hash plus a 16x16 correlation, both thresholded; the 197 first-pass files all re-matched by the same test). 104 matched the first pass's candidate cache; 8 more matched a fresh Commons search of the page's title. Author, license, license URL and file page come from Commons' own metadata (`extmetadata`), and every file is public domain, CC0, CC BY or CC BY-SA.
- Captions and alt text are the Commons description, shortened to a sentence, not hand-written prose like the first pass: they describe the picture, not the page. Worth a human polish pass.
- **211 downloaded files were not committed**: their source could not be found again, so there is no attribution to show. They are still in the abandoned worktree. A second pass with a longer Commons search budget (the API answered in about 6 s per request) could recover more.
- Wired in by js/gallery-strip.js (Gallery strip of the photos a page's text does not place, full-size viewer) and the figure placement in js/explore.js (figure i + 1 in section i). The paintings strips the first version of that script drew are not used: color pages already have the paintings row from js/gallery.js.
