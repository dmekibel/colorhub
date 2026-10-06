#!/usr/bin/env python3
"""ColorHub paintings pipeline. Re-runnable; every step caches.

  python3 tools/paintings.py                 # everything: names list, then every painting
  python3 tools/paintings.py --names         # only rebuild data/color-names.json
  python3 tools/paintings.py great-wave ...  # only these paintings (slug = id without "painting-")
  python3 tools/paintings.py --assemble      # only rewrite data/paintings.js from cached results
  python3 tools/paintings.py --sheet out.png # also draw a contact sheet (image, map, palette, names)

For each painting in data/wiki-seed.js (WIKI_SEED.paintings) it:
  1. downloads the chosen Wikimedia Commons file through the API (cached in research/_raw/paintings/),
  2. trims any frame or border, saves img/paintings/<slug>.jpg (long side <= 1200, JPEG q78 progressive) and <slug>-thumb.jpg (400),
  3. runs k-means (k-means++ init, restarts) in CIELAB on a ~200px copy; shares = pixel area,
  4. writes img/paintings/<slug>-map.png (grayscale, value = palette index x 40, same size as the 200px copy),
  5. names every palette color by CIEDE2000 against data/color-names.json (`name`) and the 101 app names (`vocab`),
  6. rewrites data/paintings.js after every painting, so a cut-off never loses finished work.

Needs Python 3 with Pillow and numpy only. Wikimedia policy: descriptive User-Agent, polite pacing.
"""
import json, re, sys, time, urllib.request, urllib.parse, urllib.error
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "research" / "_raw" / "paintings"
OUT = ROOT / "img" / "paintings"
UA = "ColorHubBot/1.0 (https://github.com/dmekibel/colorhub)"
API = "https://commons.wikimedia.org/w/api.php"
MAX_SIDE, THUMB_SIDE, MAP_SIDE = 1200, 400, 200
# k-means runs in CIELAB with a* and b* scaled by CHROMA_W, so a hue difference counts a little more than an equal
# lightness difference. Unweighted, big dark areas split into three near-blacks while a small blue or yellow that
# carries the painting is swallowed. Each palette color is still the plain (unweighted) Lab mean of its pixels.
CHROMA_W = 1.5

# ---------------------------------------------------------------------------------------------
# The paintings. file = Commons file chosen (museum's own reproduction where one exists, uncropped).
# crop = fraction trimmed from (left, top, right, bottom) to remove frame / photo border, after auto-trim.
# k = palette size (6 unless a cluster is noise or a key color is missing; reason in the comment).
# ---------------------------------------------------------------------------------------------
PAINTINGS = {
    "painting-starry-night": dict(
        file="Van Gogh - Starry Night - Google Art Project.jpg",
        place="Museum of Modern Art, New York"),
    "painting-sunflowers": dict(
        file="Vincent van Gogh - Sunflowers (1888, National Gallery London).jpg",
        place="National Gallery, London"),
    "painting-great-wave": dict(
        file="Tsunami by hokusai 19th century.jpg",
        place="Metropolitan Museum of Art, New York (one of many impressions)"),
    "painting-pearl-earring": dict(
        k=7,  # 7: the yellow cloth of the turban only separates at 7
        file="1665 Girl with a Pearl Earring.jpg",
        place="Mauritshuis, The Hague"),
    "painting-milkmaid": dict(
        k=7,  # 7: the lead-tin yellow bodice only gets its own color at 7
        file="Johannes Vermeer - Het melkmeisje - Google Art Project.jpg",
        place="Rijksmuseum, Amsterdam"),
    "painting-arnolfini": dict(
        file="Van Eyck - Arnolfini Portrait.jpg",
        place="National Gallery, London"),
    "painting-birth-of-venus": dict(
        k=7,  # 7: at 6 the sea green and the red of the cloak are lost
        # The raw Google Art Project capture is much darker than the panel looks in the Uffizi; this is the same
        # capture with levels adjusted (Wikipedia's standard image).
        file="Sandro Botticelli - La nascita di Venere - Google Art Project - edited.jpg",
        place="Uffizi Gallery, Florence"),
    "painting-mona-lisa": dict(
        file="Mona Lisa, by Leonardo da Vinci, from C2RMF retouched.jpg",
        place="Louvre, Paris"),
    "painting-the-kiss": dict(
        year="c. 1907–1909",  # the Belvedere's date (seed says 1907–1908): begun 1907, finished after the 1908 show
        file="The Kiss - Gustav Klimt - Google Cultural Institute.jpg",
        place="Belvedere, Vienna"),
    "painting-the-scream": dict(
        k=7,  # 7: at 6 the blue-black fjord merges into the greys
        file="Edvard Munch - The Scream - NG.M.00939 - National Museum of Art, Architecture and Design.jpg",
        place="National Museum, Oslo"),
    "painting-temeraire": dict(
        k=7,  # 7: at 6 the cool blue-grey of the upper sky is lost
        file="The Fighting Temeraire, JMW Turner, National Gallery.jpg",
        place="National Gallery, London"),
    "painting-wanderer": dict(
        year="c. 1817",  # the Kunsthalle's date ("um 1817"); the seed says c. 1818
        file="Ueber-die-sammlung-19-jahrhundert-caspar-david-friedrich-wanderer-ueber-dem-nebelmeer.jpg",  # from the Kunsthalle's online collection
        place="Hamburger Kunsthalle, Hamburg"),
    "painting-grande-jatte": dict(
        file="A Sunday on La Grande Jatte, Georges Seurat, 1884.png",  # the Art Institute's own image; includes Seurat's painted border
        place="Art Institute of Chicago"),
    "painting-whistlers-mother": dict(
        file="Whistlers Mother high res.jpg",
        place="Musée d'Orsay, Paris"),
    "painting-the-swing": dict(
        # Credited to the Wallace Collection, uploaded April 2020, so it shows the picture before the 2021 cleaning.
        # No post-cleaning museum image is on Commons yet.
        file="Joean Honoré Fragonard - The Swing.jpg",
        place="Wallace Collection, London"),
    "painting-composition-vii": dict(
        file="Composition VII - Wassily Kandinsky, GAC.jpg",
        place="State Tretyakov Gallery, Moscow"),
    "painting-impression-sunrise": dict(
        file="Monet - Impression, Sunrise.jpg",
        place="Musée Marmottan Monet, Paris"),
    "painting-woman-parasol": dict(
        file="Claude Monet, Woman with a Parasol - Madame Monet and Her Son, 1875, NGA 61379.jpg",
        place="National Gallery of Art, Washington"),
    "painting-rouen-cathedral": dict(
        file="Claude Monet, Rouen Cathedral, West Façade, Sunlight, 1894, NGA 46654.jpg",
        place="National Gallery of Art, Washington (Rouen Cathedral, West Façade, Sunlight)"),
    "painting-japanese-footbridge": dict(
        file="Claude Monet, The Japanese Footbridge, 1899, NGA 74796.jpg",
        place="National Gallery of Art, Washington"),
    "painting-houses-of-parliament": dict(
        file="Claude Monet - Le Parlement, coucher de soleil - 1995-0003 - Kunsthaus Zürich.jpg",
        place="Kunsthaus Zürich"),
    "painting-water-lilies": dict(
        file="Claude Monet - Water Lilies - 1933.1157 - Art Institute of Chicago.jpg",
        place="Art Institute of Chicago"),
}

# A pigment name that did not exist yet when the work was made would tell a false story about the paint
# ("YInMn blue" in a Van Gogh). Such names are skipped for earlier works. Years are when the pigment (or the
# named color) first appeared; approximate where marked ~.
PIGMENT_SINCE = {
    "YInMn blue": 2009, "Phthalo blue": 1935, "Phthalo green": 1938, "Quinacridone magenta": 1958,
    "Hansa yellow": 1909, "Arylide yellow": 1909, "Titanium yellow": 1960, "International Klein Blue": 1957,
    "Majorelle blue": 1924, "British racing green": 1902, "Cadmium orange": 1840, "Cadmium green": 1840,  # ~
    "Hooker's green": 1830, "Paris green": 1814, "Viridian": 1838, "Viridian green": 1838, "Cerulean blue": 1805,
    "Cobalt": 1802, "Zinc white": 1834, "Payne's grey": 1780, "Prussian blue": 1706,  # ~ for Hooker's, Payne's
}

# Hand-review of the names. (painting id, auto name) -> (chosen name, why). The chosen name must be in
# data/color-names.json; its dE is recomputed. Filled in after looking at every palette.
NAME_OVERRIDES = {
    ("painting-starry-night", "Olive green"): ("Khaki", "this is the moon and stars, a dull yellow in this photo; 'olive green' reads as green paint"),
    ("painting-pearl-earring", "Grey"): ("Light slate gray", "this is the ultramarine headscarf; plain 'grey' hides that it is a blue-grey"),
    ("painting-mona-lisa", "Dark purple"): ("Black", "the near-black dress and shadows; 'dark purple' overstates a faint violet cast in the scan"),
    ("painting-the-scream", "Dim gray"): ("Raw umber", "a warm brown-grey (the bridge and board); 'dim gray' is a neutral grey"),
    ("painting-grande-jatte", "Cinereous"): ("Café au lait", "cinereous means ash-grey, which misdescribes this warm pinkish tan"),
    ("painting-houses-of-parliament", "Café au lait"): ("Copper", "the sun's glow on the water; copper ties on distance (5.0) and says what it looks like"),
    ("painting-houses-of-parliament", "Sepia"): ("Café au lait", "freed by the swap above and closer (6.5) than sepia (8.7)"),
}

# One short paragraph per painting about its color. Verified facts only; sources listed with each.
NOTES = {
    # MoMA collection page (Saint Rémy, June 1889); Zhao, Berns, Taplin, Coddington 2008 (spectral modelling, not
    # sampling) doi:10.1117/12.765711; letter to Willemien, Sept 1888 (webexhibits.org/vangogh W07).
    "painting-starry-night": "Painted at the asylum in Saint-Rémy in June 1889. Its paint has never been sampled, but a 2008 study that modelled its reflected light points to [[ultramarine-pigment|ultramarine]] around the stars and [[cobalt-blue-pigment|cobalt blue]] in the swirls. In this photo the moon and stars average out to a dull [[Khaki|khaki]]: thin yellow strokes mixed with the blue around them. The year before, [[van-gogh|Van Gogh]] wrote to his sister that the night is even more richly colored than the day.",
    # National Gallery page (incl. the guest-room hanging); letters 668 and 740 (vangoghletters.org); Vanmeert et al. 2018 (Amsterdam version).
    "painting-sunflowers": "Painted in Arles in August 1888; it then hung in the guest room Van Gogh got ready for Gauguin. He called it a picture all in yellow, and wrote that his sunflowers used the three [[chrome-yellow|chrome yellows]], yellow [[Ochre|ochre]] and Veronese green and nothing else. Notice the range inside that one color: from a pale greenish yellow background to [[Mustard|mustard]] and brown in the seed heads. Chrome yellow is light-sensitive; research on the Amsterdam repeat of this picture found parts of it already darkening.",
    # Met collection JP1847 and Met essay on the Great Wave; British Museum conservation blog on indigo fading.
    "painting-great-wave": "A woodblock print, so its blue is ink on paper. The series was advertised in 1831 for its use of the newly available [[prussian-blue|Prussian blue]]. The outlines mix Prussian blue with [[indigo-dye|indigo]], and blue was printed over blue to deepen the troughs. Indigo fades faster in light than Prussian blue, one reason surviving impressions differ. The cream of the foam is the bare paper.",
    # Mauritshuis "Girl in the Spotlight" papers, Heritage Science 2019-2020 (doi:10.1186/s40494-019-0311-9 etc.).
    "painting-pearl-earring": "The headscarf is natural [[ultramarine-pigment|ultramarine]], from lapis lazuli mined in what is now Afghanistan, with [[lead-white|lead white]] made from English lead. The dark background was once a green curtain: a glaze of [[indigo-dye|indigo]] and weld, a yellow plant dye, over black. The weld faded, the green went with it, and the curtain became the near-black [[Brown|brown]] that now fills about 60% of the picture. Her lips are [[vermilion-pigment|vermilion]] with a red lake.",
    # Rijksmuseum press release 2022 (MA-XRF scans); ColourLex project page citing Liedtke (Met, 2009) for pigments.
    "painting-milkmaid": "[[vermeer|Vermeer]]'s blue and yellow pair: the apron and tablecloth are natural [[ultramarine-pigment|ultramarine]] mixed with [[lead-white|lead white]] and glazed with more ultramarine, and the bodice is lead-tin yellow. The bright wall is not white at all but a warm grey mixed from [[Umber|umber]], black and white. Scans published by the Rijksmuseum in 2022 found a jug holder and a fire basket that he painted out.",
    # National Gallery, Campbell 1998 catalogue entry for The Arnolfini Portrait.
    "painting-arnolfini": "Van Eyck built color in layers of oil. The green dress is [[verdigris]], a copper green: opaque layers first, then a glaze of verdigris in oil and pine resin for depth. The bed hangings are [[vermilion-pigment|vermilion]], red lake and red earth under red glazes. The man's tabard, now almost [[Black|black]], was once a dark crimson-purple. Two old varnish layers survive, and the lower one has yellowed.",
    # Uffizi artwork page (tempera on canvas; gold in the hair).
    "painting-birth-of-venus": "Botticelli painted this in tempera on canvas, not oil, which gives it a pale, matte light. The Uffizi notes that the glints in Venus's hair are real gold. Look how little strong color there is: most of the palette is [[Ivory|ivory]], [[Tan|tan]] and [[Camel|camel]], a grey-green sea, and one warm accent in the rose-red cloak held out to her on the right. This photo is the Google Art Project capture with its levels lightened; the raw capture is much darker.",
    # Louvre collections page INV 779 (varnish, dress, sfumato).
    "painting-mona-lisa": "Much of what you see is varnish. The Louvre says thick, oxidised varnish added after Leonardo's death works like a yellow filter: it turns the blue sky a [[Moss|moss]] green and darkens the lower half. The dress was probably dark green with yellow sleeves. The face is built from thin glazes with very little pigment, the soft shading called sfumato. So this palette is the painting as it looks today, not as Leonardo left it.",
    # Belvedere online collection, object 6678.
    "painting-the-kiss": "Not all of the gold is gold. The Belvedere lists gold, silver and platinum leaf on the figures and brass leaf in the background. Klimt then brushed a dark brown glaze over all the metal and scattered metal flakes into it while it was wet, a method the museum compares to Japanese lacquer. That glaze is why the largest swatch is a dull bronze-brown rather than bright [[Gold|gold]]. Lab analysis found the red is [[vermilion-pigment|vermilion]] and the blue is [[cobalt-blue-pigment|cobalt]].",
    # Nasjonalmuseet guide page; Munch's text of 22 Jan 1892; Monico et al. 2020 (Science Advances) on the Munch Museum version.
    "painting-the-scream": "Tempera and wax crayon on cardboard, so fragile that the museum keeps its light low. Munch wrote that as the sun set, the sky suddenly turned blood red. In this palette that red is a [[Rust|rust]] brown, set against the blue-black of the fjord: a [[warm-and-cool|warm and cool]] clash. The fading yellows reported in the news belong to a later version at the Munch Museum, not this one.",
    # National Gallery page and Egerton 2000 catalogue entry.
    "painting-temeraire": "Turner painted the old warship in pale white and gold instead of its real black and yellow, so it fades into the sky like a ghost while the dark tug pulls it to the breakers. The [[warm-and-cool|warm]] sunset on the right faces the cool, silvery ship on the left. The National Gallery notes the sun is in an impossible place for a ship heading upriver, and that the thick paint and glazes of the sunset are unusually intact.",
    # Hamburger Kunsthalle (c. 1817); palette observation from this image.
    "painting-wanderer": "Almost everything here is grey: the palette runs from [[Gunmetal|gunmetal]] rock to [[Silver|silver]] fog, with faint blue and violet in the mist. Color barely changes, so [[value]] does the work. The darkest shape, the figure in his dark coat, stands against the lightest part of the picture, and the eye goes straight to him.",
    # AIC artwork 27992; Casadio et al. 2011 (zinc yellow); RIT news on Roy Berns' 2004 reconstruction; ColourLex (border).
    "painting-grande-jatte": "Seurat built the picture from small touches of unmixed color, trusting the eye to blend them from a distance ([[optical-mixing]]), after the color theories of [[chevreul|Chevreul]]. Some of his zinc yellow has since darkened to an ochre-brown, so the sunlit grass was once brighter; in 2004 color scientist Roy Berns rebuilt its original look digitally. The border of red, orange and blue dots was added in 1888–89.",
    # Glasgow Whistler correspondence ("The Red Rag", 1878); Whistler catalogue raisonné (technique); Musée d'Orsay.
    "painting-whistlers-mother": "Its real title is Arrangement in Grey and Black No. 1. Whistler named his pictures like music, to keep sentiment out of art, and the palette obeys: [[Black|black]], [[Grey|greys]] and a pale wall, with warm color only in the face and hands. The paint is thin and oily, low in pigment. It was varnished in 1878 for his libel case against Ruskin, and the French state bought it in 1891.",
    # Wallace Collection, "Conserving The Swing" (2021 treatment by Martin Wyld).
    "painting-the-swing": "This photo shows the picture before its 2021 cleaning, when it still sat under yellowed varnish and old overpaint not removed in over a century. The cleaning brought back crisper whites and pinks in the dress, a pinker face for the young man and a shimmering blue in the older man's clothes. Even here, see how the one warm note, the dress, is framed by [[Sage|sage]] and near-black greens.",
    # Tretyakov Gallery story on Google Arts & Culture; Münter's photographs (Lenbachhaus).
    "painting-composition-vii": "[[kandinsky|Kandinsky]] made more than 30 studies, then painted the final canvas in four days, 25 to 28 November 1913, while Gabriele Münter photographed each stage. In [[spiritual-in-art|Concerning the Spiritual in Art]] he compared color to a keyboard and the soul to a piano. Up close it is a clash of pure reds, yellows and blues; the swatches here are muddier because its patches are so small and so mixed.",
    # Musée Marmottan notice 4014; Olson 2014 (phys.org); Livingstone, Vision and Art (via Harvard Magazine 2003).
    "painting-impression-sunrise": "[[monet|Monet]] painted the port of Le Havre from his hotel window in November 1872; an astronomer later used the sun and tides to pin it to 13 November, around 7:35 a.m. Shown in 1874, it gave [[impressionism|Impressionism]] its name. Neuroscientist Margaret Livingstone points out that the orange sun is about as light as the grey sky around it, a matter of [[value]]: in a black-and-white copy it nearly disappears.",
    # NGA artwork 61379.
    "painting-woman-parasol": "Monet painted Camille and their son Jean in a single outdoor session. The sky is quick strokes of blue and grey with bare canvas showing, and the white dress is barely white: it is pale blues and greys, with dabs of yellow reflected from the buttercups below. We still read it as a white dress in sunlight, which is [[color-constancy]] at work.",
    # NGA artworks 46654 and 46524; Berrie, Facture vol. 7 (2025) on the altered cadmium yellow.
    "painting-rouen-cathedral": "One of more than 30 views of the cathedral front that Monet painted in 1892–93 and finished in his Giverny studio in 1894. The stone is never plain grey: sunlit [[Cream|cream]] and [[Tan|tan]] against shadows of [[Periwinkle|periwinkle]] blue. A 2025 National Gallery of Art study found that the speckled sunlit highlights were cadmium yellow that has since turned brown.",
    # NGA artwork 74796.
    "painting-japanese-footbridge": "Monet built this view himself: he bought the marshy plot in 1893, diverted a stream to make the pond, and in 1899 painted 12 views of the bridge from the same spot. The palette is almost all green, from [[Sage|sage]] to [[Moss|moss]] to near-black shadow, with the bridge a pale blue-green and the lilies small notes of pink and yellow.",
    # Kunsthaus Zürich collection PDF; AIC (London series finished at Giverny); Baker & Thornes 2006; Albright & Huybers 2023 (PNAS) and Marmor's reply.
    "painting-houses-of-parliament": "Monet painted this motif 19 times from a terrace of St Thomas' Hospital, starting in 1900, and finished the London canvases in his Giverny studio. Researchers later found his suns placed accurately enough to date the pictures. A 2023 study linked the hazy, whitened light of his London views to coal-smoke pollution, though others see a change of style. Here the sky is [[Mauve|mauve]] and violet-grey, the sun on the water a coppery [[Ochre|ochre]].",
    # AIC artwork 16568; Monet's letter of June 1905 (Roy, NG Technical Bulletin 28, 2007); cataract dates (PMC4408507): specialist 1913, surgery 1923.
    "painting-water-lilies": "One of about 250 water-lily paintings, from a group made in 1903–08. The near-square canvas shows only the pond's surface: no bank and no horizon, just reflected sky and lily pads. In 1905 Monet listed his palette as lead white, cadmium yellow, vermilion, deep madder, cobalt blue and [[viridian-pigment|viridian]], and nothing else. His cataract trouble came later (he first saw an eye specialist in 1913), so it doesn't explain these colors.",
}

# ---------------------------------------------------------------------------------------------
# Color math (sRGB D65 <-> CIELAB, CIEDE2000), same formulas as tools/colormath.js
# ---------------------------------------------------------------------------------------------
_M = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
_WP = np.array([0.95047, 1.0, 1.08883])


def rgb_to_lab(rgb):
    """rgb: (..., 3) in 0..255 -> Lab (..., 3)."""
    c = np.asarray(rgb, dtype=np.float64) / 255.0
    c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    xyz = c @ _M.T / _WP
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


def lab_to_rgb(lab):
    lab = np.asarray(lab, dtype=np.float64)
    fy = (lab[..., 0] + 16) / 116
    fx, fz = fy + lab[..., 1] / 500, fy - lab[..., 2] / 200
    f = np.stack([fx, fy, fz], -1)
    xyz = np.where(f ** 3 > 0.008856, f ** 3, (f - 16 / 116) / 7.787) * _WP
    c = xyz @ np.linalg.inv(_M).T
    c = np.clip(c, 0, 1)
    c = np.where(c > 0.0031308, 1.055 * c ** (1 / 2.4) - 0.055, 12.92 * c)
    return np.clip(np.round(c * 255), 0, 255).astype(int)


def hex_to_rgb(h):
    h = h.lstrip("#")
    return [int(h[i:i + 2], 16) for i in (0, 2, 4)]


def rgb_to_hex(rgb):
    return "#" + "".join(f"{int(v):02X}" for v in rgb)


def de2000(lab1, lab2):
    """CIEDE2000 between every row of lab1 (N,3) and lab2 (M,3) -> (N,M)."""
    a = np.asarray(lab1, dtype=np.float64)[:, None, :]
    b = np.asarray(lab2, dtype=np.float64)[None, :, :]
    L1, a1, b1 = a[..., 0], a[..., 1], a[..., 2]
    L2, a2, b2 = b[..., 0], b[..., 1], b[..., 2]
    C1, C2 = np.hypot(a1, b1), np.hypot(a2, b2)
    Cb = (C1 + C2) / 2
    G = 0.5 * (1 - np.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)))
    a1p, a2p = a1 * (1 + G), a2 * (1 + G)
    C1p, C2p = np.hypot(a1p, b1), np.hypot(a2p, b2)
    h1p = np.degrees(np.arctan2(b1, a1p)) % 360
    h2p = np.degrees(np.arctan2(b2, a2p)) % 360
    dL, dC = L2 - L1, C2p - C1p
    prod = C1p * C2p
    dh = h2p - h1p
    dh = np.where(dh > 180, dh - 360, np.where(dh < -180, dh + 360, dh))
    dh = np.where(prod == 0, 0, dh)
    dH = 2 * np.sqrt(prod) * np.sin(np.radians(dh) / 2)
    Lb, Cbp = (L1 + L2) / 2, (C1p + C2p) / 2
    hs = h1p + h2p
    hb = np.where(np.abs(h1p - h2p) > 180, np.where(hs < 360, hs + 360, hs - 360), hs) / 2
    hb = np.where(prod == 0, hs, hb)
    T = (1 - 0.17 * np.cos(np.radians(hb - 30)) + 0.24 * np.cos(np.radians(2 * hb))
         + 0.32 * np.cos(np.radians(3 * hb + 6)) - 0.2 * np.cos(np.radians(4 * hb - 63)))
    dTh = 30 * np.exp(-(((hb - 275) / 25) ** 2))
    Rc = 2 * np.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7))
    Sl = 1 + 0.015 * (Lb - 50) ** 2 / np.sqrt(20 + (Lb - 50) ** 2)
    Sc, Sh = 1 + 0.045 * Cbp, 1 + 0.015 * Cbp * T
    Rt = -np.sin(np.radians(2 * dTh)) * Rc
    return np.sqrt((dL / Sl) ** 2 + (dC / Sc) ** 2 + (dH / Sh) ** 2 + Rt * (dC / Sc) * (dH / Sh))


# ---------------------------------------------------------------------------------------------
# Network (Wikimedia API with a descriptive User-Agent, retries with backoff)
# ---------------------------------------------------------------------------------------------
def fetch(url, binary=False, tries=5):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=120) as r:
                data = r.read()
            return data if binary else data.decode("utf-8")
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError) as e:
            wait = 5 * (i + 1)
            print(f"   fetch failed ({e}); retry in {wait}s", flush=True)
            time.sleep(wait)
    raise RuntimeError(f"could not fetch {url}")


# ---------------------------------------------------------------------------------------------
# The app's 101 names (data/colors.js) and the curated Wikipedia list (data/color-names.json)
# ---------------------------------------------------------------------------------------------
def app_names():
    src = (ROOT / "data" / "colors.js").read_text()
    out = re.findall(r'\["([^"]+)","(#[0-9A-Fa-f]{6})"\]', src)  # basics
    out += re.findall(r'\{n:"([^"]+)", h:"(#[0-9A-Fa-f]{6})"', src)  # unit colors
    return [(n, h.upper()) for n, h in out]


WIKI_PAGES = {"AF": "List_of_colors:_A%E2%80%93F", "GM": "List_of_colors:_G%E2%80%93M", "NZ": "List_of_colors:_N%E2%80%93Z"}

# Names that are novelty, brand, team, school, flag or meaningless-on-its-own. Real descriptive terms and
# pigment names stay. (Crayola-sourced rows are dropped unless in CRAYOLA_OK; parenthesised variants are
# dropped unless renamed in RENAME.)
BLOCK = set("""
Aero|Air superiority blue|Alice blue|Amazon|Android green|Antique white|Baby blue eyes|Baker-Miller pink|Barbie Pink|
Beau blue|Bitter lemon|Bittersweet|Black bean|Blanched almond|Bleu de France|Blue yonder|Burlywood|Cadet blue|Cadet grey|
Cambridge blue|Carolina blue|Catawba|Charm pink|Chili red|China pink|Columbia Blue|Congo pink|Connor's Lakefront|Cornflower blue|
Cornsilk|Cosmic latte|Coyote brown|Cyber yellow|Cyclamen|Dark electric blue|Dark jungle green|Dark lava|Deep jungle green|Desert|
Dodger blue|Duke blue|Electric purple|Electric violet|Eminence|English vermillion|Erin|Eton blue|Fandango|Fandango pink|
Field drab|Finn|Flirt|Floral white|French beige|French bistre|French fuchsia|French lilac|French lime|French mauve|French pink|
French raspberry|French sky blue|French violet|Gainsboro|Generic viridian|Ghost white|Glossy grape|GO green|Gold Fusion|
Golden poppy|Gotham green|Granny Smith apple|Green Lizard|Green Sheen|Harlequin|Heat Wave|Hollywood cerise|Honolulu blue|
Hot magenta|Iceberg|Illuminating emerald|Inchworm|Independence|India green|Irresistible|Italian sky blue|Japanese violet|
Jazzberry jam|June bud|Jungle green|Keppel|Kobe|Kobi|Kobicha|KSU purple|Languid lavender|Laser lemon|Lavender blush|Lawn green|
Lemon curry|Lemon glacier|Lemon meringue|Liberty|Light French beige|Light goldenrod yellow|Lilac Luster|Lion|Liseran purple|
Little boy blue|Liver|Liver chestnut|Livid|Macaroni and Cheese|Magenta haze|Magic mint|Manatee|Mango Tango|Mantis|Mardi Gras|
Marian blue|Mauvelous|May green|Medium candy apple red|Mellow apricot|Mellow yellow|Metallic gold|Metallic Seaweed|
Metallic Sunburst|Mexican pink|Midnight|Mikado yellow|Mimi pink|Mindaro|Ming|Minion yellow|Mint cream|Misty moss|Misty rose|
Moccasin|Mona Lisa|Morning blue|Mountain Meadow|MSU green|Mystic|Mystic maroon|Nadeshiko pink|Navajo white|Neon blue|
Neon green|Neon fuchsia|New Car|New York pink|Non-photo blue|Nyanza|Old lace|Olive Drab #7|Opera mauve|Orange soda|
Outrageous Orange|OU Crimson red|Pacific blue|Pakistan green|Palatinate purple|Pale Dogwood|Pale spring bud|Papaya whip|
Paradise pink|Patriarch|Paua|Peach puff|Pearly purple|Petunia|Pewter Blue|Phlox|Picotee blue|Pictorial carmine|Piggy pink|
Pink lace|Pink Sherbet|Plump Purple|Polished Pine|Pomp and Power|Popstar|Portland Orange|Prairie gold|Princeton orange|
Process Cyan|Psychedelic purple|Purple mountain majesty|Purple navy|Purple pizzazz|Purple Plum|Queen blue|Queen pink|
Quick Silver|Radical Red|Raisin black|Rajah|Raspberry glacé|Razzle dazzle rose|Razzmatazz|Razzmic Berry|Rebecca Purple|
Red Salsa|Resolution blue|Rhythm|Rich black|Rifle green|Rocket metallic|Rojo Spanish red|Roman silver|Rose bonbon|Rose Dust|
Rose vale|Rosso corsa|Ruber|Rubine red|Russian green|Russian violet|Sacramento State green|Satin sheen gold|Schauss pink|
Screamin' Green|Seance|Seashell|Secret|Selective yellow|Shadow|Shadow blue|Sheen green|Shimmering Blush|Shiny Shamrock|
Silver chalice|Sizzling Red|Sizzling Sunrise|Skobeloff|Skin color|Sky magenta|Slimy green|Smitten|Snow|Solid pink|
Sonic silver|Space cadet|Spring Frost|St. Patrick's blue|Star command blue|Steel pink|Strong Lime Green|Sugar Plum|Sunglow|
Sunray|Sunset|Super pink|Sweet Brown|Syracuse Orange|Tango pink|Tart Orange|Technobotanica|Telemagenta|Terra cotta|
Thulian pink|Tickle Me Pink|Tiffany Blue|Timberwolf|Tomato|Tourmaline|Tropical rainforest|True Blue|Trypan Blue|Tufts blue|
Tumbleweed|Turtle green|Tuscan|Tuscany|Twilight lavender|UA blue|UA red|Ultra pink|Ultra red|United Nations blue|
University of Pennsylvania red|Unmellow yellow|UP Forest green|UP maroon|Upsdell red|Uranian blue|USAFA blue|Vanilla ice|
Vantg blue|Vegas gold|Veronica|Volt|Weezy Blue|Willpower orange|Windsor tan|Winter Sky|Wintergreen Dream|Xanadu|Xander|
Xanthic|Xanthous|Xbox green|Xiaomi orange|Xumo|Yale Blue|Yellow Rose|Yellow Sunshine|Zarqa|Zeal|Zebra White|Zinc gray|
Zinnwaldite brown|Zinzolin|Zircon gray|Zomp|Zydeco|Desert sand|Cool grey|Bud green|Spring bud|Pansy purple|English violet|
Medium champagne|Rose Pompadour|Raspberry rose|Carnelian|Rose ebony|Wine dregs|Warm black|Smoky black|Royal yellow|
Imperial red|Purple|Celeste|Ebony
""".replace("\n", "").split("|"))
# (Ebony is blocked because the list's hex, #555D50, is a green-grey: on a painting it labels foliage "ebony".)
BLOCK_PREFIX = ("Maximum ", "Middle ", "Neon ", "Spanish ", "Vivid ", "Wild ", "Metallic ", "Mellow ", "Light French")
CRAYOLA_OK = {"Almond", "Antique brass", "Blue-gray", "Blush", "Brick red", "Canary", "Carnation pink", "Dandelion",
              "Eggplant", "Denim", "Copper"}
RENAME = {"Ocher (Ochre)": "Ochre", "Red ocher (Red ochre)": "Red ochre", "Zaffer (Zaffre)": "Zaffre",
          "Olive Drab (#3)": "Olive drab", "Dark green (X11)": "Dark green", "Chocolate (traditional)": "Chocolate brown",
          "Madder Lake": "Madder lake", "Paris Green": "Paris green", "Wine Red": "Wine red",
          "Permanent Geranium Lake": "Permanent geranium lake", "Strawberry Blonde": "Strawberry blonde",
          "YInMn Blue": "YInMn blue", "Yellow Orange": "Yellow-orange", "Ash gray": "Ash grey"}


def parse_wiki_rows(text):
    rows = []
    for line in re.split(r"\n(?=\{\{Colort/Color)", text):
        if not line.startswith("{{Colort/Color"):
            continue
        hx = re.search(r"hex=\s*([0-9A-Fa-f]{6})", line)
        nm = re.search(r"name=\s*(\[\[[^\]]*\]\]|[^|}]*)", line)
        src = re.search(r"source=\s*([^<|{}]*)", line)
        if not hx or not nm:
            continue
        n = nm.group(1)
        if n.startswith("[["):
            n = n[2:-2].split("|")[-1]
        rows.append((n.strip(), "#" + hx.group(1).upper(), src.group(1).strip() if src else ""))
    return rows


def build_names():
    """Curate the Wikipedia 'List of colors' pages + the 101 app names into data/color-names.json."""
    rows = []
    for key, title in WIKI_PAGES.items():
        cache = RAW / f"colors_{key}.txt"
        if not cache.exists():
            cache.write_text(fetch(f"https://en.wikipedia.org/w/index.php?title={title}&action=raw"))
            time.sleep(1)
        rows += parse_wiki_rows(cache.read_text())
    app = app_names()
    taken = {n.lower() for n, _ in app}
    taken_hex = {h for _, h in app}
    out = [[n, h, "colorhub"] for n, h in app]
    dropped = []
    for n, h, src in rows:
        n = RENAME.get(n, n)
        if "(" in n or n in BLOCK or n.startswith(BLOCK_PREFIX):
            dropped.append(n); continue
        if src.startswith("Crayola") and n not in CRAYOLA_OK:
            dropped.append(n); continue
        if re.search(r"University|Flag of|College|Google|Mattel|Sherwin", src):
            dropped.append(n); continue
        if n.lower() in taken or h in taken_hex:  # same name, or an exact duplicate of an app color
            continue
        taken.add(n.lower())
        taken_hex.add(h)
        out.append([n, h, "wikipedia"])
    out.sort(key=lambda r: r[0].lower())
    path = ROOT / "data" / "color-names.json"
    path.write_text("[\n" + ",\n".join(json.dumps(r, ensure_ascii=False) for r in out) + "\n]\n")
    print(f"color-names.json: {len(out)} names ({len(app)} app + {len(out) - len(app)} Wikipedia), {len(dropped)} dropped")
    return out


def load_names():
    path = ROOT / "data" / "color-names.json"
    names = json.loads(path.read_text()) if path.exists() else build_names()
    return names


# ---------------------------------------------------------------------------------------------
# Image steps
# ---------------------------------------------------------------------------------------------
def seed_paintings():
    src = (ROOT / "data" / "wiki-seed.js").read_text()
    block = src[src.index("paintings:"):]
    return re.findall(r'\["(painting-[a-z0-9-]+)", "([^"]+)", "([^"]+)", "([^"]+)"\]', block)


def commons_page(file):
    return "https://commons.wikimedia.org/wiki/File:" + urllib.parse.quote(file.replace(" ", "_"), safe="(),_-.'!")


def download(slug, file):
    meta_path, img_path = RAW / f"{slug}.meta.json", RAW / f"{slug}.src.jpg"
    if meta_path.exists() and img_path.exists():
        meta = json.loads(meta_path.read_text())
        if meta.get("file") == file:
            return meta, img_path
    q = urllib.parse.urlencode({"action": "query", "titles": "File:" + file, "prop": "imageinfo",
                                "iiprop": "url|size|extmetadata", "iiurlwidth": 1400, "format": "json"})
    data = json.loads(fetch(f"{API}?{q}"))
    page = next(iter(data["query"]["pages"].values()))
    if "imageinfo" not in page:
        raise RuntimeError(f"Commons has no file {file!r}")
    ii = page["imageinfo"][0]
    em = {k: v.get("value") for k, v in ii.get("extmetadata", {}).items()}
    meta = {"file": file, "width": ii["width"], "height": ii["height"], "url": ii.get("thumburl") or ii["url"],
            "license": re.sub(r"<[^>]+>", "", em.get("LicenseShortName") or ""),
            "credit": re.sub(r"<[^>]+>", "", em.get("Credit") or "")[:300]}
    time.sleep(1)
    img_path.write_bytes(fetch(meta["url"], binary=True))
    meta_path.write_text(json.dumps(meta, indent=1, ensure_ascii=False))
    time.sleep(1)
    return meta, img_path


def autotrim(im, max_frac=0.08, tol=10.0):
    """Trim uniform borders (scanner bed, mat, frame shadow) that differ from the painting.
    A row/column is border while its pixels are near-uniform and close to the outermost line's color."""
    a = np.asarray(im.convert("RGB"), dtype=np.float64)
    h, w, _ = a.shape

    def scan(lines, limit):
        ref = lines[0].mean(0)
        n = 0
        for line in lines[:limit]:
            if line.std(0).mean() < tol and np.abs(line.mean(0) - ref).mean() < tol:
                n += 1
            else:
                break
        return n

    t = scan([a[i] for i in range(h)], int(h * max_frac))
    b = scan([a[h - 1 - i] for i in range(h)], int(h * max_frac))
    l = scan([a[:, i] for i in range(w)], int(w * max_frac))
    r = scan([a[:, w - 1 - i] for i in range(w)], int(w * max_frac))
    return im.crop((l, t, w - r, h - b)), (l, t, r, b)


def prepare_image(slug, src_path, crop):
    im = Image.open(src_path).convert("RGB")
    im, trimmed = autotrim(im)
    if crop:
        w, h = im.size
        l, t, r, b = crop
        im = im.crop((round(w * l), round(h * t), round(w * (1 - r)), round(h * (1 - b))))
    scale = min(1.0, MAX_SIDE / max(im.size))
    big = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS) if scale < 1 else im
    big.save(OUT / f"{slug}.jpg", "JPEG", quality=78, progressive=True, optimize=True)
    ts = THUMB_SIDE / max(big.size)
    big.resize((round(big.width * ts), round(big.height * ts)), Image.LANCZOS).save(
        OUT / f"{slug}-thumb.jpg", "JPEG", quality=78, progressive=True, optimize=True)
    ms = MAP_SIDE / max(big.size)
    small = big.resize((round(big.width * ms), round(big.height * ms)), Image.BOX)  # area average
    return big, small, trimmed


def kmeans(X, k, restarts=12, iters=80, seed=1):
    """Plain Lloyd k-means with k-means++ seeding; best of `restarts` by inertia."""
    rng = np.random.default_rng(seed)
    best = None
    for _ in range(restarts):
        C = [X[rng.integers(len(X))]]
        for _ in range(1, k):
            d = np.min(((X[:, None, :] - np.array(C)[None]) ** 2).sum(-1), 1)
            C.append(X[rng.choice(len(X), p=d / d.sum())])
        C = np.array(C)
        for _ in range(iters):
            d = ((X[:, None, :] - C[None]) ** 2).sum(-1)
            lab = d.argmin(1)
            newC = np.array([X[lab == j].mean(0) if np.any(lab == j) else X[rng.integers(len(X))] for j in range(k)])
            if np.abs(newC - C).max() < 1e-3:
                C = newC
                break
            C = newC
        d = ((X[:, None, :] - C[None]) ** 2).sum(-1)
        lab = d.argmin(1)
        inertia = d.min(1).sum()
        if best is None or inertia < best[0]:
            best = (inertia, C, lab)
    return best[1], best[2]


def name_colors(labs, names, top=12):
    """For each Lab row: candidates [(name, dE)] best first, against the curated list."""
    nl = rgb_to_lab(np.array([hex_to_rgb(h) for _, h, _ in names]))
    D = de2000(labs, nl)
    out = []
    for row in D:
        idx = np.argsort(row)[:top]
        out.append([(names[i][0], round(float(row[i]), 1)) for i in idx])
    return out


def analyse(pid, slug, cfg, names, app):
    meta, src = download(slug, cfg["file"])
    big, small, trimmed = prepare_image(slug, src, cfg.get("crop"))
    px = np.asarray(small, dtype=np.float64).reshape(-1, 3)
    X = rgb_to_lab(px)
    k = cfg.get("k", 6)
    _, lab = kmeans(X * np.array([1, CHROMA_W, CHROMA_W]), k)
    counts = np.bincount(lab, minlength=k)
    order = np.argsort(-counts)
    remap = np.empty(k, dtype=int)
    remap[order] = np.arange(k)
    idx = remap[lab].reshape(small.height, small.width)
    Image.fromarray((idx * 40).astype(np.uint8)).save(OUT / f"{slug}-map.png", optimize=True)
    C = np.array([X[lab == j].mean(0) for j in order])
    shares = counts[order] / counts.sum()
    rgbs = lab_to_rgb(C)
    hexes = [rgb_to_hex(c) for c in rgbs]
    exact = rgb_to_lab(rgbs)  # Lab of the rounded hex, so dE is what the app will show
    cands = name_colors(exact, names)
    app_l = rgb_to_lab(np.array([hex_to_rgb(h) for _, h in app]))
    V = de2000(exact, app_l)
    pal = []
    for i in range(k):
        j = int(np.argmin(V[i]))
        pal.append(dict(h=hexes[i], share=float(shares[i]), cands=cands[i], vocab=app[j][0], vocabDE=round(float(V[i, j]), 1)))
    res = dict(id=pid, slug=slug, w=big.width, h=big.height, map=[small.width, small.height], trimmed=trimmed,
               commons=commons_page(cfg["file"]), license=meta["license"], credit=meta["credit"], palette=pal)
    (RAW / f"{slug}.result.json").write_text(json.dumps(res, indent=1, ensure_ascii=False))
    return res


# ---------------------------------------------------------------------------------------------
# Assembly
# ---------------------------------------------------------------------------------------------
def round_shares(vals):
    r = [round(v, 3) for v in vals]
    r[0] = round(r[0] + 1 - sum(r), 3)  # largest absorbs rounding, so shares sum to exactly 1
    return r


def work_year(year):
    return int(re.search(r"\d{4}", year).group())


def pick_names(pid, year, palette):
    """Nearest name per color, skipping pigment names newer than the work, and never the same name twice in
    one palette (the color closest to the name keeps it; the other moves to its next candidate)."""
    known = {n for n, _, _ in load_names()}
    cands = [[(n, d) for n, d in c["cands"] if PIGMENT_SINCE.get(n, 0) <= year and n in known] for c in palette]
    pos = [0] * len(palette)
    while True:
        chosen = [cands[i][pos[i]] for i in range(len(palette))]
        clash = False
        for name in {n for n, _ in chosen}:
            holders = [i for i, (n, _) in enumerate(chosen) if n == name]
            if len(holders) > 1:
                clash = True
                keep = min(holders, key=lambda i: chosen[i][1])
                for i in holders:
                    if i != keep:
                        pos[i] += 1
        if not clash:
            return chosen


def assemble(names):
    name_hex = {n: h for n, h, _ in names}
    out = []
    for pid, title, artist, year in seed_paintings():
        slug = pid[len("painting-"):]
        rp = RAW / f"{slug}.result.json"
        if not rp.exists() or pid not in PAINTINGS:
            continue
        r = json.loads(rp.read_text())
        shares = round_shares([c["share"] for c in r["palette"]])
        pal = []
        year_shown = PAINTINGS[pid].get("year", year)
        for c, s, (name, dE) in zip(r["palette"], shares, pick_names(pid, work_year(year_shown), r["palette"])):
            if (pid, name) in NAME_OVERRIDES:
                name = NAME_OVERRIDES[(pid, name)][0]
                dE = round(float(de2000(rgb_to_lab([hex_to_rgb(c["h"])]), rgb_to_lab([hex_to_rgb(name_hex[name])]))[0, 0]), 1)
            pal.append(dict(h=c["h"], share=s, name=name, dE=dE, vocab=c["vocab"], vocabDE=c["vocabDE"]))
        lic = r["license"] or "Public domain"
        if lic.upper() == "CC0":
            lic = "Public domain (CC0)"
        p = dict(id=pid, title=title, artist=artist, year=year_shown, place=PAINTINGS[pid]["place"],
                 img=f"img/paintings/{slug}.jpg", thumb=f"img/paintings/{slug}-thumb.jpg", map=f"img/paintings/{slug}-map.png",
                 w=r["w"], h=r["h"], commons=r["commons"], license=lic, palette=pal)
        if pid in NOTES:
            p["note"] = NOTES[pid]
        out.append(p)
    lines = ["// ColorHub painting pages. Generated by tools/paintings.py; edit that script, not this file.",
             "// Images: Wikimedia Commons, public domain. Palette: k-means in CIELAB on a ~200px copy, shares = area.",
             "// name = nearest curated name (data/color-names.json, CIEDE2000 dE); vocab = nearest of the 101 app names.",
             "// map = grayscale PNG, pixel value = palette index x 40.",
             "window.PAINTINGS = ["]
    for i, p in enumerate(out):
        p = dict(p)
        pal = p.pop("palette")
        note = p.pop("note", None)
        head = json.dumps(p, ensure_ascii=False)[:-1]
        body = ",\n".join("    " + json.dumps(c, ensure_ascii=False) for c in pal)
        s = f"  {head},\n  \"palette\": [\n{body}\n  ]"
        if note:
            s += f",\n  \"note\": {json.dumps(note, ensure_ascii=False)}"
        s += "\n  }" + ("," if i < len(out) - 1 else "")
        lines.append(s)
    lines.append("];")
    (ROOT / "data" / "paintings.js").write_text("\n".join(lines) + "\n")
    return out


# ---------------------------------------------------------------------------------------------
# Contact sheet: image | map rendered in palette colors | swatches with name, vocab, share, dE
# ---------------------------------------------------------------------------------------------
def font(size):
    for f in ("/System/Library/Fonts/Helvetica.ttc", "/System/Library/Fonts/Supplemental/Arial.ttf",
              "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"):
        try:
            return ImageFont.truetype(f, size)
        except OSError:
            pass
    return ImageFont.load_default()


def contact_sheet(paintings, path, row_h=260):
    f1, f2 = font(17), font(13)
    W = 1660
    sheet = Image.new("RGB", (W, row_h * len(paintings) + 10), "white")
    d = ImageDraw.Draw(sheet)
    for i, p in enumerate(paintings):
        y = i * row_h + 10
        slug = p["id"][len("painting-"):]
        im = Image.open(OUT / f"{slug}.jpg")
        s = (row_h - 40) / im.height
        tw = min(round(im.width * s), 330)
        s = min(s, tw / im.width)
        im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
        sheet.paste(im, (10, y + 30))
        m = np.asarray(Image.open(OUT / f"{slug}-map.png"))
        cols = np.array([hex_to_rgb(c["h"]) for c in p["palette"]], dtype=np.uint8)
        mi = Image.fromarray(cols[np.clip(np.round(m / 40).astype(int), 0, len(cols) - 1)]).resize(im.size, Image.NEAREST)
        sheet.paste(mi, (350, y + 30))
        d.text((10, y + 4), f"{p['title']} ({p['artist']}, {p['year']})  {p['w']}x{p['h']}", fill="black", font=f1)
        x0 = 700
        for j, c in enumerate(p["palette"]):
            x = x0 + j * 133
            d.rectangle([x, y + 30, x + 125, y + 130], fill=c["h"])
            d.rectangle([x, y + 30, x + 125 * c["share"] / max(cc["share"] for cc in p["palette"]), y + 36], fill="black")
            d.text((x, y + 136), c["name"], fill="black", font=f2)
            d.text((x, y + 153), f"dE {c['dE']}  {c['h']}", fill="#444", font=f2)
            d.text((x, y + 170), f"vocab {c['vocab']} {c['vocabDE']}", fill="#444", font=f2)
            d.text((x, y + 187), f"share {c['share']:.3f}", fill="#444", font=f2)
    sheet.save(path)
    print("contact sheet:", path)


def main(argv):
    OUT.mkdir(parents=True, exist_ok=True)
    RAW.mkdir(parents=True, exist_ok=True)
    sheet = None
    if "--sheet" in argv:
        i = argv.index("--sheet")
        sheet = argv[i + 1]
        argv = argv[:i] + argv[i + 2:]
    if "--names" in argv:
        build_names()
        return
    names = build_names() if not argv else load_names()
    app = app_names()
    seed = seed_paintings()
    if "--assemble" not in argv:
        only = {a for a in argv if not a.startswith("--")}
        for pid, title, artist, year in seed:
            slug = pid[len("painting-"):]
            if only and slug not in only:
                continue
            if pid not in PAINTINGS:
                print(f"SKIP {pid}: no Commons file chosen")
                continue
            try:
                r = analyse(pid, slug, PAINTINGS[pid], names, app)
            except Exception as e:  # report and carry on; a missing painting is reported, never substituted
                print(f"SKIP {pid}: {e}")
                continue
            picked = pick_names(pid, work_year(PAINTINGS[pid].get("year", year)), r["palette"])
            print(f"{slug}: {r['w']}x{r['h']} trimmed {r['trimmed']} -> " +
                  ", ".join(f"{n} {c['h']} {c['share']:.2f}" for c, (n, _) in zip(r["palette"], picked)), flush=True)
            assemble(names)  # save progress after every painting
    done = assemble(names)
    print(f"data/paintings.js: {len(done)} paintings")
    if sheet:
        contact_sheet(done, sheet)


if __name__ == "__main__":
    main(sys.argv[1:])
