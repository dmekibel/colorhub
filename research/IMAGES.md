# Wiki photographs

Photos that break up the wiki text: the mineral, insect, plant or object behind each pigment, the real thing each color is named after, portraits, and historical artifacts (color wheels, plates, manuscripts). Data is in `data/images.js` (`window.WIKI_IMAGES`) and the files are in `img/wiki/`.

## Counts
- **197 images** on **150 pages**: 64 wiki nodes and 86 colors.
- **20.3 MB** in total. Every file is a JPEG with its long side at most 900 px, saved progressive. Quality is 80, stepped down to 76, 72 or 68 for detailed textures so each file stays under about 125 KB.
- Pages get 1 to 3 images: pigments and concepts usually have 2, and most colors have 1.

## Licenses
| License | Images |
|---|---|
| Public domain | 64 |
| CC0 | 19 |
| CC BY (2.0 to 4.0) | 29 |
| CC BY-SA (2.0 to 4.0) | 85 |

- Every file comes from Wikimedia Commons. Nothing is fair use or non-free, and nothing has an unclear license.
- Each entry stores the author and license as `credit`, plus `licenseUrl` and the Commons file page as `commons`.
- **The UI must show `credit` and link `licenseUrl` (or `commons`) wherever a CC BY or CC BY-SA image appears.** This is not optional for 114 of the 197 images.
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
