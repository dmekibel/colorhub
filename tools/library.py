#!/usr/bin/env python3
"""ColorHub reference library: a few thousand named colors, merged from open sources. Re-runnable; every
download is cached in research/_raw/library/ (gitignored).

  python3 tools/library.py              # build data/library.json, then add lib/libDE to data/paintings.js
  python3 tools/library.py --build      # only data/library.json
  python3 tools/library.py --paintings  # only re-name the painting palettes (needs data/library.json)
  python3 tools/library.py --report     # print the numbers for research/LIBRARY.md (coverage, gaps, next words)

Two layers: the 101 curated, learnable words in data/colors.js stay as they are. This is the big reference layer
behind them: every entry can get an auto-generated page, be searched, and name painting swatches precisely.

Sources (key used in `src`; provenance and license in research/LIBRARY.md):
  app      the 101 ColorHub colors (data/colors.js). Their hex wins when a name is shared, so a library page and
           the learnable color never disagree.
  css      the 148 CSS Color 4 / X11 keywords (W3C). "gray" and "grey" spellings collapse to one entry.
  wiki     Wikipedia "List of colors" A-F, G-M, N-Z (CC BY-SA text; the cited source of each row goes in `note`).
           Rows Wikipedia sources to Pantone are dropped (proprietary).
  werner   Werner's Nomenclature of Colours (Syme 1821, public domain); hex from Rougeux's 2018 digitization via
           Graphics-ColorNames-Werner (CC0). Aged hand-tinted swatches: approximate.
  ridgway  Ridgway, Color Standards and Color Nomenclature (1912, public domain). Hex = dominant color of each swatch in
           the Project Gutenberg plate scans, from github.com/davo/Color-Standards-and-Color-Nomenclature (re-measured
           here from the same crops). Kept only where the scan agrees with the independent NBS/ISCC dictionary
           (Kelly & Judd, NBS Circular 553, 1955), see load_ridgway().
  jp       Wikipedia "Traditional colors of Japan" (name = romaji; kanji and English meaning in `jp`).
  ral      Wikipedia "List of RAL colours", RAL Classic only. Approximate screen values of a paint standard.
  xkcd     The xkcd color survey (Munroe 2010), rgb.txt, CC0. Crowd names; crude ones get "crude": 1.

Merge rules (see research/LIBRARY.md): names are title-cased and "Gray" spelled "Grey"; two names are the same
entry when they match after dropping case, accents, spaces, hyphens, slashes and apostrophes. A merged entry keeps
every source; its hex comes from the highest-priority source (order of SOURCES), and any other source whose hex
is more than CIEDE2000 3 away is kept in `alts` as [src, hex]. Different names for nearly the same color all stay.

Output, one compact JSON object per line (data/library.json), sorted by family, then hue (Neutrals by lightness):
  n name, h hex, src [sources], fam family, lch [L, C, h] (CIELAB D65, rounded), app [nearest of the 101, CIEDE2000],
  alts?, werner? {animal, vegetable, mineral}, jp? {kanji, romaji, meaning}, note? (provenance detail), crude?

Needs Python 3 with numpy and Pillow (Pillow only for re-measuring the Ridgway swatches).
"""
import html, json, re, sys, time, unicodedata, urllib.request, urllib.parse
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "research" / "_raw" / "library"
OLD_RAW = ROOT / "research" / "_raw" / "paintings"  # tools/paintings.py cached the List of colors pages here
KB = ROOT.parent / "color-kb"                        # David's private color KB (Werner table)
OUT = ROOT / "data" / "library.json"
UA = "ColorHubBot/1.0 (https://github.com/dmekibel/colorhub)"

SOURCES = ["app", "css", "wiki", "werner", "ridgway", "jp", "ral", "xkcd"]  # hex priority, highest first
FAMILIES = ["Reds", "Pinks", "Oranges", "Browns", "Yellows", "Greens", "Blues", "Purples", "Neutrals"]
ALT_DE = 3.0  # a source's hex differing by more than this from the entry's hex is kept in alts

# ---------------------------------------------------------------------------------------------
# Color math: sRGB (D65) -> CIELAB, CIEDE2000. Same formulas as tools/colormath.js and tools/paintings.py.
# ---------------------------------------------------------------------------------------------
_M = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
_WP = np.array([0.95047, 1.0, 1.08883])


def hex_to_rgb(h):
    h = h.lstrip("#")
    return [int(h[i:i + 2], 16) for i in (0, 2, 4)]


def rgb_to_hex(rgb):
    return "#" + "".join(f"{int(v):02X}" for v in rgb)


def rgb_to_lab(rgb):
    c = np.asarray(rgb, dtype=np.float64) / 255.0
    c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    xyz = c @ _M.T / _WP
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


def lab_to_rgb(lab):
    lab = np.asarray(lab, dtype=np.float64)
    fy = (lab[..., 0] + 16) / 116
    f = np.stack([fy + lab[..., 1] / 500, fy, fy - lab[..., 2] / 200], -1)
    xyz = np.where(f ** 3 > 0.008856, f ** 3, (f - 16 / 116) / 7.787) * _WP
    c = np.clip(xyz @ np.linalg.inv(_M).T, 0, 1)
    c = np.where(c > 0.0031308, 1.055 * c ** (1 / 2.4) - 0.055, 12.92 * c)
    return np.clip(np.round(c * 255), 0, 255).astype(int)


def labs(hexes):
    return rgb_to_lab(np.array([hex_to_rgb(h) for h in hexes]))


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


def lch(lab):
    L, a, b = lab
    return L, float(np.hypot(a, b)), float(np.degrees(np.arctan2(b, a)) % 360)


def family(L, C, H):
    """The app's rule (js/gym.js `family`), with the app's "Greys" called "Neutrals"."""
    if C < 12:
        return "Neutrals"
    if H >= 345 or H < 40:
        return "Pinks" if L > 70 else "Reds"
    if H < 70:
        return "Browns" if L < 48 else "Oranges"
    if H < 100:
        return "Browns" if L < 55 else "Yellows"
    if H < 195:
        return "Greens"
    if H < 290:
        return "Blues"
    return "Pinks" if L > 72 else "Purples"


# ---------------------------------------------------------------------------------------------
# Names
# ---------------------------------------------------------------------------------------------
SMALL = {"of", "and", "de", "du", "des", "la", "le", "au", "aux", "en", "in", "on", "the", "with", "di", "del", "da"}


def title(name):
    """Title case, keeping internal capitals (YInMn, NCS), minor words lower, and Grey for Gray."""
    name = re.sub(r"(?<=\w)\(", " (", re.sub(r"\s+", " ", name.strip()))
    out, n_words = [], len(name.split(" "))
    for i, word in enumerate(name.split(" ")):
        parts = re.split(r"([-/(])", word)
        res = []
        for p in parts:
            if p in ("-", "/", "(") or not p:
                res.append(p)
            elif re.search(r"[A-Z]", p[1:]) or not p[0].isalpha():
                res.append(p)  # YInMn, M&P, #3, 'Kara'
            elif i > 0 and (p.lower() in SMALL or (p.lower() == "a" and i < n_words - 1)) and (not res or res[-1] != "("):
                res.append(p.lower())
            else:
                res.append(p[0].upper() + p[1:].lower())
        out.append("".join(res))
    s = " ".join(out)
    s = re.sub(r"\bGray", "Grey", s)
    s = re.sub(r"\bgray", "grey", s)
    return s


def key(name):
    """Merge key: same name ignoring case, accents, spaces, hyphens, slashes, apostrophes and gray/grey."""
    s = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode().lower()
    s = s.replace("gray", "grey").replace("colour", "color")
    return re.sub(r"[^a-z0-9()]", "", s)


# ---------------------------------------------------------------------------------------------
# Network + cache
# ---------------------------------------------------------------------------------------------
def fetch(url, binary=False, tries=4):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=120) as r:
                data = r.read()
            return data if binary else data.decode("utf-8")
        except Exception as e:  # network trouble: back off and retry
            print(f"   fetch failed ({e}); retry in {5 * (i + 1)}s", flush=True)
            time.sleep(5 * (i + 1))
    raise RuntimeError(f"could not fetch {url}")


def cached(name, url, fallback=None, binary=False):
    path = RAW / name
    if not path.exists():
        if fallback and fallback.exists():
            path.write_bytes(fallback.read_bytes())
        else:
            path.write_bytes(fetch(url, binary=True))
            time.sleep(1)
    return path.read_bytes() if binary else path.read_text(encoding="utf-8")


def wiki_raw(title_, cache_name, fallback=None):
    url = "https://en.wikipedia.org/w/index.php?" + urllib.parse.urlencode({"title": title_, "action": "raw"})
    return cached(cache_name, url, fallback)


def strip_wiki(s):
    """Plain text from a wikitext snippet: links, templates, refs and markup removed."""
    s = re.sub(r"<ref[^>]*/>", "", s)
    s = re.sub(r"<ref[^>]*>.*?</ref>", "", s, flags=re.S)
    for _ in range(4):  # innermost templates first
        s = re.sub(r"\{\{(?:efn|refn|rp|sfn|citation needed|cn)[^{}]*\}\}", "", s, flags=re.I)
        s = re.sub(r"\{\{(?:lang|translit|nihongo3?)\|[^|{}]*\|([^|{}]*)[^{}]*\}\}", r"\1", s)
        s = re.sub(r"\{\{cvt\|([^|{}]*)\|([^|{}]*)[^{}]*\}\}", r"\1 \2", s)
        s = re.sub(r"\{\{[^{}]*\}\}", "", s)
    s = re.sub(r"\[\[(?:[^\]|]*\|)?([^\]]*)\]\]", r"\1", s)
    s = re.sub(r"'''?|<[^>]+>", "", s)
    return html.unescape(re.sub(r"\s+", " ", s)).strip()


# ---------------------------------------------------------------------------------------------
# Sources. Each loader returns rows: dict(n=name, h=hex, src=key, plus optional werner/jp/note/crude).
# ---------------------------------------------------------------------------------------------
def load_app():
    src = (ROOT / "data" / "colors.js").read_text()
    out = re.findall(r'\["([^"]+)","(#[0-9A-Fa-f]{6})"\]', src)  # basics
    out += re.findall(r'\{n:"([^"]+)", h:"(#[0-9A-Fa-f]{6})"', src)  # unit colors
    return [dict(n=n, h=h.upper(), src="app") for n, h in out]


# CSS Color Module Level 4, section 6.1 "Named Colors" (the 148 keywords, from X11). Word breaks added.
CSS = """Alice Blue=#F0F8FF|Antique White=#FAEBD7|Aqua=#00FFFF|Aquamarine=#7FFFD4|Azure=#F0FFFF|Beige=#F5F5DC|
Bisque=#FFE4C4|Black=#000000|Blanched Almond=#FFEBCD|Blue=#0000FF|Blue Violet=#8A2BE2|Brown=#A52A2A|Burlywood=#DEB887|
Cadet Blue=#5F9EA0|Chartreuse=#7FFF00|Chocolate=#D2691E|Coral=#FF7F50|Cornflower Blue=#6495ED|Cornsilk=#FFF8DC|
Crimson=#DC143C|Cyan=#00FFFF|Dark Blue=#00008B|Dark Cyan=#008B8B|Dark Goldenrod=#B8860B|Dark Gray=#A9A9A9|
Dark Grey=#A9A9A9|Dark Green=#006400|Dark Khaki=#BDB76B|Dark Magenta=#8B008B|Dark Olive Green=#556B2F|
Dark Orange=#FF8C00|Dark Orchid=#9932CC|Dark Red=#8B0000|Dark Salmon=#E9967A|Dark Sea Green=#8FBC8F|
Dark Slate Blue=#483D8B|Dark Slate Gray=#2F4F4F|Dark Slate Grey=#2F4F4F|Dark Turquoise=#00CED1|Dark Violet=#9400D3|
Deep Pink=#FF1493|Deep Sky Blue=#00BFFF|Dim Gray=#696969|Dim Grey=#696969|Dodger Blue=#1E90FF|Firebrick=#B22222|
Floral White=#FFFAF0|Forest Green=#228B22|Fuchsia=#FF00FF|Gainsboro=#DCDCDC|Ghost White=#F8F8FF|Gold=#FFD700|
Goldenrod=#DAA520|Gray=#808080|Grey=#808080|Green=#008000|Green Yellow=#ADFF2F|Honeydew=#F0FFF0|Hot Pink=#FF69B4|
Indian Red=#CD5C5C|Indigo=#4B0082|Ivory=#FFFFF0|Khaki=#F0E68C|Lavender=#E6E6FA|Lavender Blush=#FFF0F5|
Lawn Green=#7CFC00|Lemon Chiffon=#FFFACD|Light Blue=#ADD8E6|Light Coral=#F08080|Light Cyan=#E0FFFF|
Light Goldenrod Yellow=#FAFAD2|Light Green=#90EE90|Light Gray=#D3D3D3|Light Grey=#D3D3D3|Light Pink=#FFB6C1|
Light Salmon=#FFA07A|Light Sea Green=#20B2AA|Light Sky Blue=#87CEFA|Light Slate Gray=#778899|Light Slate Grey=#778899|
Light Steel Blue=#B0C4DE|Light Yellow=#FFFFE0|Lime=#00FF00|Lime Green=#32CD32|Linen=#FAF0E6|Magenta=#FF00FF|
Maroon=#800000|Medium Aquamarine=#66CDAA|Medium Blue=#0000CD|Medium Orchid=#BA55D3|Medium Purple=#9370DB|
Medium Sea Green=#3CB371|Medium Slate Blue=#7B68EE|Medium Spring Green=#00FA9A|Medium Turquoise=#48D1CC|
Medium Violet Red=#C71585|Midnight Blue=#191970|Mint Cream=#F5FFFA|Misty Rose=#FFE4E1|Moccasin=#FFE4B5|
Navajo White=#FFDEAD|Navy=#000080|Old Lace=#FDF5E6|Olive=#808000|Olive Drab=#6B8E23|Orange=#FFA500|
Orange Red=#FF4500|Orchid=#DA70D6|Pale Goldenrod=#EEE8AA|Pale Green=#98FB98|Pale Turquoise=#AFEEEE|
Pale Violet Red=#DB7093|Papaya Whip=#FFEFD5|Peach Puff=#FFDAB9|Peru=#CD853F|Pink=#FFC0CB|Plum=#DDA0DD|
Powder Blue=#B0E0E6|Purple=#800080|Rebecca Purple=#663399|Red=#FF0000|Rosy Brown=#BC8F8F|Royal Blue=#4169E1|
Saddle Brown=#8B4513|Salmon=#FA8072|Sandy Brown=#F4A460|Sea Green=#2E8B57|Seashell=#FFF5EE|Sienna=#A0522D|
Silver=#C0C0C0|Sky Blue=#87CEEB|Slate Blue=#6A5ACD|Slate Gray=#708090|Slate Grey=#708090|Snow=#FFFAFA|
Spring Green=#00FF7F|Steel Blue=#4682B4|Tan=#D2B48C|Teal=#008080|Thistle=#D8BFD8|Tomato=#FF6347|Turquoise=#40E0D0|
Violet=#EE82EE|Wheat=#F5DEB3|White=#FFFFFF|White Smoke=#F5F5F5|Yellow=#FFFF00|Yellow Green=#9ACD32"""


def load_css():
    return [dict(n=n, h=h, src="css") for n, h in (p.strip().split("=") for p in CSS.replace("\n", "").split("|"))]


WIKI_PAGES = {"AF": "List of colors: A–F", "GM": "List of colors: G–M", "NZ": "List of colors: N–Z"}
# Parentheses that only say "this is the CSS/X11 value of the name": strip them, so the row merges with css.
# Only when the plain name is a CSS keyword with that same hex; "Purple (X11)" (#A020F0) stays its own entry.
WEB_QUAL = re.compile(r"\s*\((?:web|x11|x11/web color|x11 gray|web color|html/css|css)\)\s*", re.I)
WIKI_RENAME = {  # "Name (synonym)" rows: keep the plain name
    "Ocher (Ochre)": "Ochre", "Red ocher (Red ochre)": "Red ochre", "Zaffer (Zaffre)": "Zaffre",
    "Olive Drab (#3)": "Olive drab", "Gold (web) (Golden)": "Gold", "Khaki (X11) (Light khaki)": "Khaki",
    "Lime (web) (X11 green)": "Lime", "Midnight green (eagle green)": "Midnight green",
    "Pullman Brown (UPS Brown)": "Pullman brown", "Chocolate (traditional)": "Chocolate (traditional)",
}


def load_wiki():
    css = {key(r["n"]): r["h"] for r in load_css()}
    rows, dropped = [], []
    for k, t in WIKI_PAGES.items():
        text = wiki_raw(t, f"wiki-colors_{k}.txt", OLD_RAW / f"colors_{k}.txt")
        for line in re.split(r"\n(?=\{\{Colort/Color)", text):
            if not line.startswith("{{Colort/Color"):
                continue
            hx = re.search(r"hex=\s*([0-9A-Fa-f]{6})", line)
            nm = re.search(r"name=\s*(\[\[[^\]]*\]\]|[^|}]*)", line)
            sm = re.search(r"source=\s*(.*?)(?:\|link target|\}\}\s*$)", line, re.S)
            if not hx or not nm:
                continue
            n = nm.group(1)
            if n.startswith("[["):
                n = n[2:-2].split("|")[-1]
            n = strip_wiki(n)
            src = strip_wiki(sm.group(1)) if sm else ""
            if "pantone" in (n + " " + src).lower():
                dropped.append(n)
                continue
            n = WIKI_RENAME.get(n, n)
            h = "#" + hx.group(1).upper()
            plain = WEB_QUAL.sub(" ", n).strip()
            if plain != n and css.get(key(title(plain))) == h:
                n = plain
            row = dict(n=n, h=h, src="wiki")
            if src:
                row["note"] = "Wikipedia cites " + src
            rows.append(row)
    return rows, dropped


def load_xkcd():
    text = cached("xkcd-rgb.txt", "https://xkcd.com/color/rgb.txt")
    rows = []
    for line in text.splitlines():
        if line.startswith("#") or "\t" not in line:
            continue
        n, h = line.split("\t")[:2]
        row = dict(n=n.strip(), h=h.strip().upper(), src="xkcd")
        if CRUDE.search(n):
            row["crude"] = 1
        rows.append(row)
    return rows


# Survey names a family app should not show by default (they stay in the data, flagged "crude": 1).
CRUDE = re.compile(r"\b(puke|vomit|barf|poo|poop|shit|piss|pee|snot|booger|diarrhea)\b", re.I)


def load_werner():
    w = json.loads((KB / "werner.json").read_text())["colors"]
    rows = []
    for c in w:
        ex = {k: c[k] for k in ("animal", "vegetable", "mineral") if c.get(k)}
        rows.append(dict(n=c["name"], h=c["hex_approx"].upper(), src="werner", werner=ex,
                         note=f"Werner no. {c['no']} ({c['group']}), aged swatch, approximate"))
    return rows


def load_jp():
    text = wiki_raw("Traditional colors of Japan", "wiki-Traditional_colors_of_Japan.txt")
    text = text[text.index("==Colors=="):text.index("==Notes==")]
    rows, mismatch = [], []
    for table in re.findall(r"\{\|.*?\n\|\}", text, re.S):
        cells = []
        for line in table.split("\n"):
            if line.startswith("|") and not line.startswith(("|-", "|}", "{|")):
                cells.append(line[1:])
        # five cells per color: kanji, romaji, meaning, "r,g,b", styled hex
        for i in range(0, len(cells) - 4, 5):
            kanji, romaji, meaning, rgb, hexcell = cells[i:i + 5]
            m = re.search(r"#([0-9A-Fa-f]{6})\s*$", hexcell)
            if not m or "translit" not in romaji:
                continue
            h = "#" + m.group(1).upper()
            r = re.findall(r"\d+", rgb)
            note = None
            if len(r) == 3 and rgb_to_hex(r) != h:
                mismatch.append((strip_wiki(romaji), h, rgb_to_hex(r)))
                note = f"Wikipedia's RGB column gives {rgb_to_hex(r)}"
            ro = strip_wiki(romaji).split(" or ")[0]  # "Hanaba-iro or kayou-iro": first spelling
            row = dict(n=ro[0].upper() + ro[1:], h=h, src="jp",
                       jp={"kanji": strip_wiki(kanji), "romaji": ro, "meaning": strip_wiki(meaning)})
            if note:
                row["note"] = note
            rows.append(row)
    return rows, mismatch


def load_ral():
    text = wiki_raw("List of RAL colours", "wiki-List_of_RAL_colours.txt")
    text = text[text.index("==RAL Classic=="):text.index("=== Overview ===")]
    rows = []
    for m in re.finditer(r"\{\{vanchor\|RAL (\d{4})\}\}\s*\|\|\s*\{\{#invoke:biglist\|coltit\|([0-9A-Fa-f]{6})\}\}\s*\|\|(.*)", text):
        num, h, rest = m.groups()
        n = strip_wiki(re.sub(r"<ref.*?(</ref>|/>)", "", rest).split("||")[0])
        if not n:
            continue
        rows.append(dict(n=n, h="#" + h.upper(), src="ral", note=f"RAL {num}, approximate screen value"))
    return rows


# ---------------------------------------------------------------------------------------------
# Ridgway: scan-derived hex, re-measured here and cross-checked against the NBS/ISCC dictionary
# ---------------------------------------------------------------------------------------------
DAVO = "https://raw.githubusercontent.com/davo/Color-Standards-and-Color-Nomenclature/main/"
ISCC = "https://web.archive.org/web/2010id_/http://tx4.us/isccnam.htm"
RIDGWAY_DE = 10.0  # max CIEDE2000 from the scan to an NBS/ISCC centroid the dictionary assigns to that name ...
RIDGWAY_RANK = 2   # ... or that centroid is among the 2 nearest of all 267 (vivid centroids are clipped in sRGB)


def iscc_dictionary():
    """NBS Circular 553 (Kelly & Judd 1955) as digitized by D. Mundie / J. C. Foster: Ridgway name -> centroids."""
    t = cached("isccnam.htm", ISCC, binary=True).decode("latin-1")
    cent, R = {}, {}
    for n, h in re.findall(r'title="(\d+)" style="background-color:(#[0-9A-Fa-f]{6})', t):
        cent[int(n)] = h.upper()
    for name, cells in re.findall(r'<tr><td>(.*?)</td>((?:<td title="\d+"[^>]*>[^<]*</td>)+)</tr>', t):
        m = re.match(r"(.*?)\(([^)]*)\)", html.unescape(name))
        if not m or "R" not in [s.strip() for s in m.group(2).split(",")]:
            continue
        cs = re.findall(r'title="(\d+)"[^>]*>(\d+)([+-]?)</td>', cells)
        R[key(m.group(1).replace("[", "").replace("]", ""))] = [int(n) for n, _, f in cs if f != "-"]  # "-" = removed by Foster
    return cent, R


def load_ridgway():
    """Returns (kept rows, report). A Ridgway name is kept only when
       1. its swatch crop re-measures (median in Lab of the central 70%) within dE 3 of the published hex,
       2. no other Ridgway name has the identical hex (a crop assigned to two names), and
       3. the NBS/ISCC dictionary lists the name and the hex agrees with it (RIDGWAY_DE / RIDGWAY_RANK)."""
    data = json.loads(cached("ridgway-davo-colornames.json", DAVO + "dist/colornames.json"))
    cent, R = iscc_dictionary()
    cn = sorted(cent)
    CL = labs([cent[n] for n in cn])
    try:
        from PIL import Image
    except ImportError:
        Image = None
    hex_count = {}
    for x in data:
        hex_count[x["hex"].upper()] = hex_count.get(x["hex"].upper(), 0) + 1
    rows, rep = [], {"total": len(data), "remeasure": 0, "dup": 0, "unlisted": 0, "disagree": 0, "kept": 0, "fails": []}
    for x in data:
        h = x["hex"].upper()
        name = re.sub(r"\s+(\d)$", r" (\1)", x["name"])  # "Blackish Brown 3" -> "Blackish Brown (3)", as in the book
        lab = labs([h])
        img = RAW / "ridgway-swatches" / x["image"]
        if Image is not None:
            if not img.exists():
                img.parent.mkdir(parents=True, exist_ok=True)
                img.write_bytes(fetch(DAVO + "src/plate_swatches/" + urllib.parse.quote(x["image"]), binary=True))
            a = np.asarray(Image.open(img).convert("RGB"), dtype=np.float64)
            hh, ww, _ = a.shape
            core = rgb_to_lab(a[int(hh * .15):int(hh * .85), int(ww * .15):int(ww * .85)].reshape(-1, 3))
            if de2000(lab, np.median(core, 0)[None])[0, 0] > 3:
                rep["remeasure"] += 1; rep["fails"].append((name, h, "re-measure")); continue
        if hex_count[h] > 1:
            rep["dup"] += 1; rep["fails"].append((name, h, "same hex as another name")); continue
        k = key(x["name"])
        k = k if k in R else key(name)
        cs = [c for c in R.get(k, []) if c in cent]  # centroid 12 has no swatch in the digitized table
        if not cs:
            rep["unlisted"] += 1; rep["fails"].append((name, h, "not in NBS/ISCC")); continue
        D = de2000(lab, CL)[0]
        order = [cn[i] for i in np.argsort(D)]
        best_de = min(D[cn.index(c)] for c in cs)
        rank = min(order.index(c) for c in cs) + 1
        if best_de > RIDGWAY_DE and rank > RIDGWAY_RANK:
            rep["disagree"] += 1; rep["fails"].append((name, h, f"NBS/ISCC dE {best_de:.0f}")); continue
        tone = x.get("tone") if x.get("tone") not in (None, "—") else None
        where = f"plate {x['plate']}, hue {x['hue']}" + (f", tone {tone}" if tone else "")
        row = dict(n=name, h=h, src="ridgway", note=f"Ridgway 1912, {where}; scan of an aged plate, approximate")
        rows.append(row)
        rep["kept"] += 1
    return rows, rep


# ---------------------------------------------------------------------------------------------
# Merge
# ---------------------------------------------------------------------------------------------
def merge(rows):
    groups = {}
    for r in rows:
        r["n"] = r["n"] if r["src"] == "jp" else title(r["n"])
        groups.setdefault(key(r["n"]), []).append(r)
    out = []
    for k, g in groups.items():
        # Highest-priority source first; within one source, "Blue Grey" before "Blue/Grey" or "Bluegrey".
        g.sort(key=lambda r: (SOURCES.index(r["src"]), "/" in r["n"], -r["n"].count(" ") - r["n"].count("-")))
        main = g[0]
        e = dict(n=main["n"], h=main["h"], src=[])
        for r in g:
            if r["src"] not in e["src"]:
                e["src"].append(r["src"])
        L0 = labs([e["h"]])
        alts = []
        for r in g[1:]:
            if r["h"] != e["h"] and de2000(L0, labs([r["h"]]))[0, 0] > ALT_DE and [r["src"], r["h"]] not in alts:
                alts.append([r["src"], r["h"]])
        if alts:
            e["alts"] = alts
        for r in g:
            for f in ("werner", "jp"):
                if f in r and f not in e:
                    e[f] = r[f]
        notes = []
        for r in g:
            if r.get("note") and r["note"] not in notes:
                notes.append(r["note"])
        if notes:
            e["note"] = "; ".join(notes)
        if all(r.get("crude") for r in g):
            e["crude"] = 1
        out.append(e)
    return out


def annotate(entries, app):
    L = labs([e["h"] for e in entries])
    A = labs([h for _, h in app])
    D = de2000(L, A)
    for e, lab, row in zip(entries, L, D):
        l, c, h = lch(lab)
        e["lch"] = [round(float(l)), round(c), round(h)]
        e["fam"] = family(l, c, h)
        j = int(np.argmin(row))
        e["app"] = [app[j][0], round(float(row[j]), 1)]
    return entries


def sort_key(e):
    L, C, H = e["lch"]
    fam = FAMILIES.index(e["fam"])
    if e["fam"] == "Neutrals":
        return (fam, -L, H)
    start = {"Reds": 345, "Pinks": 290}.get(e["fam"], 0)  # families that wrap past 0 degrees
    return (fam, (H - start) % 360, -L)


def build():
    RAW.mkdir(parents=True, exist_ok=True)
    app_rows = load_app()
    app = [(r["n"], r["h"]) for r in app_rows]
    wiki, wiki_dropped = load_wiki()
    jp, jp_mismatch = load_jp()
    ridgway, rrep = load_ridgway()
    per = {"app": app_rows, "css": load_css(), "wiki": wiki, "werner": load_werner(), "ridgway": ridgway,
           "jp": jp, "ral": load_ral(), "xkcd": load_xkcd()}
    rows = [dict(r) for s in SOURCES for r in per[s]]
    entries = annotate(merge(rows), app)
    entries.sort(key=sort_key)
    order = ["n", "h", "src", "fam", "lch", "app", "alts", "werner", "jp", "note", "crude"]
    lines = [json.dumps({k: e[k] for k in order if k in e}, ensure_ascii=False, separators=(",", ":")) for e in entries]
    OUT.write_text("[\n" + ",\n".join(lines) + "\n]\n", encoding="utf-8")
    counts = {s: len(per[s]) for s in SOURCES}
    print("rows per source:", counts)
    print(f"wiki rows dropped as Pantone: {len(wiki_dropped)}; jp RGB/hex mismatches: {len(jp_mismatch)}")
    print("ridgway:", {k: v for k, v in rrep.items() if k != "fails"})
    print("entries by source:", {s: sum(s in e["src"] for e in entries) for s in SOURCES})
    print(f"library: {len(entries)} entries, {OUT.stat().st_size / 1024:.0f} KB")
    (RAW / "build-report.json").write_text(json.dumps(dict(counts=counts, wiki_dropped=wiki_dropped,
                                                           jp_mismatch=jp_mismatch, ridgway=rrep), ensure_ascii=False, indent=1))
    return entries


def load_library():
    return json.loads(OUT.read_text(encoding="utf-8"))


# ---------------------------------------------------------------------------------------------
# Paintings: give every palette swatch its true nearest library name (`lib`, CIEDE2000 `libDE`)
# ---------------------------------------------------------------------------------------------
# A name is "silly" on a painting page when it is crude, a brand/novelty/team name (tools/paintings.py BLOCK),
# a variant with a qualifier ("(Crayola)", "#7"), RAL signage and effect paints, or a casual survey form
# ("Bluey Grey", "Greyish", "Toupe"). Japanese traditional names are kept for Japanese works and are second
# choice elsewhere. The nearest name is used unless it is silly (or Japanese on a Western work) and a better
# name is within LIB_SLACK of it.
LIB_SLACK = 2.0
RAL_SIGNAGE = re.compile(r"\b(Traffic|Signal|Telegrey|Luminous|Pure|Pearl|Window|Aluminium|Clean Room)\b|\bGrey [AB]$")
XKCD_CASUAL = re.compile(r"ish\b|\b(Bluey|Greeny|Pinky|Yellowy|Browny|Purpley|Purply|Orangey|Orangy|Reddy|Greyey)\b|"
                         r"^(Toupe|Forrest Green|Off \w+|Cool \w+|Warm \w+|Bland|Camo|Dust|Earth|Mud|Dirt\b.*)$")
PAINT_AVOID = {"Dark Grey"}  # the CSS keyword, lighter than "Grey": reads as the opposite of what it is
JP_WORKS = {"painting-great-wave"}

# Hand review (2026-10-07) of every swatch after the automatic pick: (painting id, swatch hex) -> (name, why).
# The chosen name must be in data/library.json; its libDE is recomputed. Each one is marked in paintings.js.
LIB_OVERRIDES = {
    ("painting-sunflowers", "#9F7425"): ("Bistre Brown", "ties with Sand Dune (3.2); these are seed heads, not sand"),
    ("painting-sunflowers", "#896228"): ("Golden Brown", "0.2 further than Dresden Brown and says what the seed heads look like"),
    ("painting-mona-lisa", "#201625"): ("Ink Black", "the near-black dress; Shikon and Dark Purple overstate a faint violet cast (same call as tools/paintings.py)"),
    ("painting-temeraire", "#8D806B"): ("Taupe", "Pearl Beige (1.4) is a pearlescent RAL car paint; Taupe is 2.3 further and is the app's own word"),
    ("painting-the-kiss", "#819554"): ("Moss Green", "three-way tie (2.2) with Turtle Green and Moss; says what the meadow looks like"),
    ("painting-the-swing", "#81A088"): ("Sage Green", "ties with Deep Malachite Green (4.0); the plainer, better-known name"),
}


def silly_names(lib):
    """{name: why it is a poor label on a painting page}."""
    sys.path.insert(0, str(ROOT / "tools"))
    from paintings import BLOCK, BLOCK_PREFIX  # the curated novelty/brand list used for color-names.json
    block = {key(title(b)) for b in BLOCK if b}
    out = {}
    for e in lib:
        n, src = e["n"], e["src"]
        if n in PAINT_AVOID:
            out[n] = "the CSS keyword is lighter than Grey"
        elif e.get("crude"):
            out[n] = "crude survey name"
        elif re.search(r"[(#]| Or ", n):
            out[n] = "a variant with a qualifier"
        elif src == ["wiki"] and (key(n) in block or n.startswith(BLOCK_PREFIX)):  # only Wikipedia has them
            out[n] = "brand, crayon or novelty name"
        elif src == ["ral"] and RAL_SIGNAGE.search(n):
            out[n] = "RAL signage or effect paint"
        elif src == ["xkcd"] and XKCD_CASUAL.search(n):
            out[n] = "casual survey form"
    return out


def pick_lib(pid, year, palette, lib, LL, silly, since):
    """Nearest library name per swatch, preferring a non-silly name within LIB_SLACK, never the same name twice in
    one palette (the swatch closer to it keeps it), and skipping pigment names newer than the work.
    Returns per swatch (name, dE), the ranked candidates, and why the plain nearest name was passed over (or None)."""
    jp_ok = pid in JP_WORKS
    cands, nearest = [], []
    for c in palette:
        D = de2000(labs([c["h"]]), LL)[0]
        order = list(np.argsort(D)[:60])
        nearest.append((lib[order[0]]["n"], round(float(D[order[0]]), 1)))
        idx = [i for i in order if since.get(lib[i]["n"], 0) <= year]
        near = D[idx[0]]

        def rank(i):
            bad = lib[i]["n"] in silly or (lib[i]["src"] == ["jp"] and not jp_ok)
            return (bad and D[i] <= near + LIB_SLACK, D[i]) if D[i] <= near + LIB_SLACK else (True, 99 + D[i])
        idx.sort(key=rank)
        cands.append([(lib[i]["n"], round(float(D[i]), 1)) for i in idx])
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
            break
    whys = []
    by_name = {e["n"]: e for e in lib}
    for (n0, d0), (n, d) in zip(nearest, chosen):
        if n0 == n:
            whys.append(None)
        elif since.get(n0, 0) > year:
            whys.append(f"nearest {n0} ({d0}) is a pigment newer than the work")
        elif n0 in silly:
            whys.append(f"nearest {n0} ({d0}): {silly[n0]}")
        elif by_name[n0]["src"] == ["jp"] and not jp_ok:
            whys.append(f"nearest {n0} ({d0}) is a Japanese name; this is a Western work")
        elif n0 in [c[0] for c in chosen]:
            whys.append(f"nearest {n0} ({d0}) names a closer swatch in this palette")
        else:
            whys.append(f"nearest is {n0} ({d0})")
    return chosen, cands, whys


PAINT_NOTE = ("// lib = nearest name in the reference library (data/library.json, CIEDE2000 libDE), added by tools/library.py;"
              " a trailing // comment says when the plain nearest name was passed over (rule:) or overridden by hand (hand:).")


def rename_paintings(verbose=False, write=True):
    """Adds lib/libDE to each palette line of data/paintings.js in place, touching nothing else in the file."""
    sys.path.insert(0, str(ROOT / "tools"))
    from paintings import PIGMENT_SINCE
    lib = load_library()
    LL = labs([e["h"] for e in lib])
    names = {e["n"]: i for i, e in enumerate(lib)}
    silly = silly_names(lib)
    path = ROOT / "data" / "paintings.js"
    lines = path.read_text(encoding="utf-8").split("\n")
    # pass 1: find each painting's palette lines
    paintings, cur = [], None
    for i, line in enumerate(lines):
        m = re.search(r'\{"id": "(painting-[^"]+)".*?"year": "([^"]*)"', line)
        if m:
            cur = dict(id=m.group(1), year=int(re.search(r"\d{4}", m.group(2)).group()), rows=[])
            paintings.append(cur)
        m = re.match(r'^(\s*)(\{"h": "#[0-9A-F]{6}".*?\})(,?)\s*(//.*)?$', line)
        if m and cur:
            cur["rows"].append((i, m.group(1), json.loads(m.group(2)), m.group(3)))
    used = set()
    report = []
    for p in paintings:
        pal = [r[2] for r in p["rows"]]
        chosen, cands, whys = pick_lib(p["id"], p["year"], pal, lib, LL, silly, PIGMENT_SINCE)
        for (i, ind, c, comma), (name, d), cl, why in zip(p["rows"], chosen, cands, whys):
            if why:
                why = "rule: " + why
            if (p["id"], c["h"]) in LIB_OVERRIDES:
                name, why = LIB_OVERRIDES[(p["id"], c["h"])]
                why = "hand: " + why
                used.add((p["id"], c["h"]))
                d = round(float(de2000(labs([c["h"]]), labs([lib[names[name]]["h"]]))[0, 0]), 1)
            c.pop("lib", None), c.pop("libDE", None)
            c["lib"], c["libDE"] = name, d
            lines[i] = ind + json.dumps(c, ensure_ascii=False) + comma + (f"  // lib: {why}" if why else "")
            report.append((p["id"], c["h"], c["share"], name, d, c["name"], c["vocab"], c["vocabDE"], cl[:6], c["dE"]))
    unused = set(LIB_OVERRIDES) - used
    if unused:
        raise SystemExit(f"LIB_OVERRIDES not matched (palette changed?): {sorted(unused)}")
    if PAINT_NOTE not in lines:
        lines = [l for l in lines if not l.startswith("// lib = nearest name")]  # an older wording of the note
        k = max(i for i, l in enumerate(lines[:12]) if l.startswith("//"))
        lines.insert(k + 1, PAINT_NOTE)
    if write:
        path.write_text("\n".join(lines), encoding="utf-8")
    des = [r[4] for r in report]
    print(f"paintings.js: {len(report)} swatches named; libDE median {np.median(des):.1f}, max {max(des):.1f} "
          f"(old curated name: median {np.median([r[9] for r in report]):.1f}, max {max(r[9] for r in report):.1f})"
          + ("" if write else "  [dry run, file not written]"))
    if verbose:
        for r in report:
            print(f"{r[0][9:]:22} {r[1]} {r[2]:.2f} lib={r[3]} ({r[4]})  name={r[5]} vocab={r[6]}({r[7]}) | " +
                  "; ".join(f"{n} {dd}" for n, dd in r[8]))
    return report


# ---------------------------------------------------------------------------------------------
# Report: coverage, gaps, and the next learnable words (numbers for research/LIBRARY.md)
# ---------------------------------------------------------------------------------------------
def nearest_de(L, ref, chunk=2000):
    out = []
    for i in range(0, len(L), chunk):
        out.append(de2000(L[i:i + chunk], ref).min(1))
    return np.concatenate(out)


def dist_row(label, d):
    p = np.percentile(d, [50, 75, 90, 95])
    shares = [100 * np.mean(d <= t) for t in (2, 3, 5, 10)]
    return (f"| {label} | {p[0]:.1f} | {p[1]:.1f} | {p[2]:.1f} | {p[3]:.1f} | {d.max():.1f} | "
            + " | ".join(f"{s:.0f}%" for s in shares) + " |")


def describe(lab):
    L, C, H = lch(lab)
    light = "very dark" if L < 25 else "dark" if L < 45 else "mid" if L < 65 else "light" if L < 85 else "very light"
    sat = "greyish" if C < 15 else "muted" if C < 35 else "strong" if C < 60 else "vivid"
    hue = ["red", "orange", "yellow", "yellow-green", "green", "cyan", "blue", "violet", "purple", "magenta"]
    cuts = [20, 60, 95, 115, 160, 200, 270, 300, 330, 360]
    if H < 20:
        name = "pink-red"
    else:
        name = hue[next(i for i, c in enumerate(cuts) if H < c)]
    return f"{light} {sat} {name}"


def corpus_swatches():
    """Every palette color of the 4,655-painting corpus plus the 22 painting pages: (hex, share, painting id)."""
    out = [(h, s, p["id"]) for p in json.loads((ROOT / "data" / "corpus.json").read_text()) for h, s, *_ in p["p"]]
    for line in (ROOT / "data" / "paintings.js").read_text().split("\n"):
        m = re.search(r'\{"id": "(painting-[^"]+)"', line)
        if m:
            pid = m.group(1)
        m = re.match(r'\s*(\{"h": "#[0-9A-F]{6}".*?\})', line)
        if m:
            c = json.loads(m.group(1))
            out.append((c["h"], c["share"], pid))
    return out


LEARN_MODIFIERS = re.compile(r"^(Light|Dark|Pale|Pallid|Deep|Dull|Dusky|Bright|Medium|Very|Clear|Vivid|Soft|Brilliant|"
                             r"Strong|Mid|\w+ish)\b")


def learnable(e, silly):
    """Could this be a word in a future learnable tier? At most two words, not a lightness/strength modifier + a color
    (Dark Olive, Greyish Blue), not silly or a variant, not already an app word, not a crayon-only name. It must be
    in Wikipedia's list or CSS, or in two sources, or a one-word survey noun: a name found only in Ridgway, Werner,
    RAL or the Japanese list is a fine reference name but not yet everyday vocabulary."""
    n = e["n"]
    if n in silly or n in LEARN_SKIP or "(" in n or e.get("crude") or "app" in e["src"]:
        return False
    if e["src"] == ["wiki"] and "Crayola" in e.get("note", ""):
        return False
    if len(e["src"]) == 1 and e["src"][0] in ("jp", "ridgway", "werner", "ral"):  # one specialist source only
        return False
    if e["src"] == ["xkcd"] and " " in n:  # survey names: only plain one-word nouns (Stone, Putty, Clay)
        return False
    if len(re.split(r"[ -]", n)) > 2 or LEARN_MODIFIERS.match(n):
        return False
    return True


LEARN_RADIUS, LEARN_APART = 6, 6  # a word "covers" a painting color within dE 6; picked words are >= dE 6 apart
LEARN_SKIP = {"Pullman Brown": "a brand color (UPS brown), not a word to teach"}


def report(n_random=2000, seed=7):
    lib = load_library()
    app = load_app()
    names390 = json.loads((ROOT / "data" / "color-names.json").read_text())
    LL = labs([e["h"] for e in lib])
    sets = [("Reference library (all sources)", LL),
            ("Library without xkcd", labs([e["h"] for e in lib if e["src"] != ["xkcd"]])),
            ("color-names.json (390)", labs([h for _, h, _ in names390])),
            ("App words (101)", labs([r["h"] for r in app]))]
    rng = np.random.default_rng(seed)
    R = rgb_to_lab(rng.integers(0, 256, size=(n_random, 3)))
    print(f"## Coverage: {n_random} random sRGB colors (seed {seed}), nearest-name CIEDE2000")
    print("| Name set | median | p75 | p90 | p95 | max | <=2 | <=3 | <=5 | <=10 |\n|---|---|---|---|---|---|---|---|---|---|")
    for label, ref in sets:
        print(dist_row(f"{label}: {len(ref)}", nearest_de(R, ref)))
    sw = corpus_swatches()
    S = labs([h for h, _, _ in sw])
    W = np.array([s for _, s, _ in sw])
    print(f"\n## Coverage: {len(sw)} painting palette colors (data/corpus.json + data/paintings.js)")
    print("| Name set | median | p75 | p90 | p95 | max | <=2 | <=3 | <=5 | <=10 |\n|---|---|---|---|---|---|---|---|---|---|")
    for label, ref in sets:
        print(dist_row(f"{label}: {len(ref)}", nearest_de(S, ref)))

    # Gaps: random colors still far from every library name, grouped greedily into regions.
    G = rgb_to_lab(rng.integers(0, 256, size=(40000, 3)))
    gd = nearest_de(G, LL)
    far = G[gd > 4]
    print(f"\n## Gaps: {100 * np.mean(gd > 4):.1f}% of 40,000 random colors are over dE 4 from any library name, "
          f"{100 * np.mean(gd > 6):.1f}% over 6")
    left = far.copy()
    rows = []
    while len(left) and len(rows) < 12:
        # seed each region at the densest uncovered point: the one with most uncovered neighbours within dE 6
        sample = left[:: max(1, len(left) // 600)]
        M = de2000(sample, left) <= 6
        c = sample[int(np.argmax(M.sum(1)))]
        members = de2000(c[None], left)[0] <= 6
        centre = left[members].mean(0)
        d_lib = de2000(centre[None], LL)[0]
        j = int(np.argmin(d_lib))
        rows.append((int(members.sum()), rgb_to_hex(lab_to_rgb(centre)), describe(centre), lib[j]["n"], d_lib[j]))
        left = left[~members]
    print("| region (centre) | uncovered colors | looks like | nearest library name (dE) |\n|---|---|---|---|")
    for n, h, desc, nm, d in rows:
        print(f"| {h} | {n} | {desc} | {nm} ({d:.1f}) |")
    # Gaps that matter for paintings: palette colors still over dE 5 from every library name.
    sd = nearest_de(S, LL)
    far = S[sd > 5]
    print(f"\nPainting colors over dE 5 from any library name: {len(far)} of {len(S)} ({100 * len(far) / len(S):.1f}%)")
    print("| region (centre) | palette colors | looks like | nearest library name (dE) |\n|---|---|---|---|")
    left = far.copy()
    for _ in range(8):
        if not len(left):
            break
        M = de2000(left[:: max(1, len(left) // 600)], left) <= 6
        c = left[:: max(1, len(left) // 600)][int(np.argmax(M.sum(1)))]
        members = de2000(c[None], left)[0] <= 6
        centre = left[members].mean(0)
        d_lib = de2000(centre[None], LL)[0]
        j = int(np.argmin(d_lib))
        print(f"| {rgb_to_hex(lab_to_rgb(centre))} | {int(members.sum())} | {describe(centre)} | {lib[j]['n']} ({d_lib[j]:.1f}) |")
        left = left[~members]

    # Next learnable words: frequent painting colors with no close app word, greedy coverage by learnable names.
    A = labs([r["h"] for r in app])
    appd = nearest_de(S, A)
    silly = silly_names(lib)
    cand = [i for i, e in enumerate(lib) if learnable(e, silly) and e["app"][1] >= 6]
    C = LL[cand]
    gap = appd > 8
    print(f"\n## Next words: {100 * np.mean(gap):.0f}% of painting colors ({100 * W[gap].sum() / W.sum():.0f}% of area) "
          f"are over dE 8 from every app word; {len(cand)} learnable candidates")
    Sg, Wg, Ag = S[gap], W[gap], appd[gap]
    pid = np.array([p for _, _, p in sw])[gap]
    DC = np.vstack([de2000(Sg[i:i + 3000], C) for i in range(0, len(Sg), 3000)])  # (swatches, candidates)
    covers = (DC <= LEARN_RADIUS) & (DC < Ag[:, None])
    CC = de2000(C, C)
    alive = np.ones(len(Sg), bool)
    picked = []
    for _ in range(40):
        score = (covers & alive[:, None]).T @ Wg
        for k in picked:
            score[CC[k] < LEARN_APART] = -1  # each new word must be tellable apart from the ones already picked
        k = int(np.argmax(score))
        hit = covers[:, k] & alive
        e = lib[cand[k]]
        picked.append(k)
        print(f"| {len(picked)} | {e['n']} | {e['h']} | {e['fam']} | {100 * Wg[hit].sum() / W.sum():.2f}% | "
              f"{len(set(pid[hit]))} | {e['app'][0]} ({e['app'][1]}) | {', '.join(e['src'])} |")
        alive &= ~hit
    print(f"40 words cover {100 * (Wg[~alive].sum()) / Wg.sum():.0f}% of the uncovered painting area within dE {LEARN_RADIUS}")


if __name__ == "__main__":
    args = sys.argv[1:]
    if not args or "--build" in args:
        build()
    if not args or "--paintings" in args:
        rename_paintings(verbose="-v" in args, write="--dry" not in args)
    if "--report" in args:
        report()
