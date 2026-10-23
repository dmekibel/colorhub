# Painting image size upgrade (2026-10-23)

Measured with curl (UA `Chromatlas/1.0 (https://chromatlas.app; dmekibel@gmail.com)`, a few requests per host) and checked in a real browser on the painting page and in Look closer. Code: `glSized` / `glHiSrc` / `glZoomOpts` / `glSharpen` in js/gallery.js, `fallback` in js/paintzoom.js.

Tiers: **mid** = first frame (only sizes proven safe, never changes for hosts that might 404); **page** = swapped in after the first frame as `data-hi` (a failure keeps the first frame); **zoom** = Look closer (falls back to the page copy on any error).

| Host | Old px | Page px | Zoom px | URL pattern (page / zoom) | Works |
|---|---|---|---|---|---|
| ids.si.edu (SAAM, Freer, NMAfA) | 332 (max=400) | 1326x1600 (173 KB-408 KB) | 2061x2486 (1.1 MB) | `max=1600` / `max=3000`; CORS `*` | yes (now also pick-readable) |
| media.collections.yale.edu (YCBA) | 432x480 | 775x860 (156 KB) | same (the host's full size) | manifest `https://manifests.collections.yale.edu/ycba/obj/<n>` gives `images.collections.yale.edu/iiif/2/ycba:<uuid>/full/full/0/default.jpg`; `1600,` answers 403 (no upscaling) | yes (CORS `*`, so pick works) |
| api.smk.dk thumbnail | 1600 already | 1600 (no size parameter exists) | 1600 | unchanged | n/a |
| iip-thumb.smk.dk (IIIF) | 1000 | 1600x2451 | 1959x3000 (`!3000,3000`; max 2928x4485) | `/full/1600,/` / `/full/!3000,3000/0/default.jpg` | yes |
| images.metmuseum.org | 480x326 (mobile-large) | 3545x2410 (2.9 MB) | same | `/original/` (web-large is only 439-599 px, so skipped) | yes, but display only: the Met CDN sent no CORS header to a browser fetch from localhost, so pick is unavailable there (it already was) |
| openaccess-cdn.clevelandart.org | 900x721 (`_web`, not 400) | 900 (unchanged) | 3400x2725 (`_print`, 5 MB) | `_web.jpg` / `_print.jpg` | yes, display only (no CORS header on any size) |
| nationalmuseumse.iiifhosting.com (IIIF) | 400x488 stored; the old `glBig` asked for 843 which answers 501 | 800x976 | 800x976 | `/full/800,/` (1000 and up answer 501; `full/full` is 819x1000). http rewritten to https | yes (CORS `*`, now pick-readable) |
| iiif.micr.io (Rijksmuseum) | 843 | 1600x2134 (725 KB) | 2249x3000 (1.3 MB) | `/full/1600,/` / `/full/!3000,3000/0/default.jpg`; `max` is 5220 px, 8 MB | yes |
| api.nga.gov | 843 | 1600x2897 (1.5 MB) | 1657x3000 | same patterns as Rijksmuseum | yes |
| www.artic.edu (AIC) | 843 | unchanged | unchanged | answers 403 to curl, refuses past 843 in the browser per the existing note | not changed |
| Commons | 1280 / 2048 | unchanged | unchanged | | unchanged |

Other changes: Yale resolves once per object (cached); the hero swap retries without `crossorigin` if a CORS host drops its header (so the Met still shows its sharp copy); `eydSource` reads big originals at about 6 MP (iOS canvas limit) and `sampleHex` draws only the 7x7 patch; ids.si.edu, the Nationalmuseum IIIF host and Yale's IIIF host were added to `GL_CORS_HOSTS` (all send `Access-Control-Allow-Origin: *`); painter-page pictures and article lead pictures use the same page-size swap.

Visual check: headless Chrome could not reach the museum hosts from the sandbox, so `design/review-shots/img-size/` holds, for each host, the old and new source stretched to a 440 px, 3x-DPR painting width (`*-at-1320w.jpg`) and a 660 px centre crop of each (`*-crop.jpg`). Live checks in the browser pane confirmed natural sizes and pixel readability above.
