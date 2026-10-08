"""Color math for tools/graph_build.py. Same Lab/CIEDE2000 as tools/library.py (so the graph agrees with the app),
plus HSL, naive CMYK, OKLCH, an RYB painter's wheel, direction words (a port of js/lookalikes.js lookDiff), and an
approximate Munsell via colour-science (cached; near-neutrals get the neutral scale, the rest may be missing)."""
import json, math, os, sys, warnings
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import library as LIB  # noqa: E402

hex_to_rgb, labs = LIB.hex_to_rgb, LIB.labs


def de2000_pairs(l1, l2):
    """Elementwise CIEDE2000 for matching rows of l1 (n,3) and l2 (n,3) -> (n,)."""
    l1, l2 = np.asarray(l1, float), np.asarray(l2, float)
    L1, a1, b1 = l1[:, 0], l1[:, 1], l1[:, 2]
    L2, a2, b2 = l2[:, 0], l2[:, 1], l2[:, 2]
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


def lch_of(lab):
    lab = np.asarray(lab, float)
    return lab[..., 0], np.hypot(lab[..., 1], lab[..., 2]), np.degrees(np.arctan2(lab[..., 2], lab[..., 1])) % 360


def hsl_of(rgb):
    r, g, b = [v / 255.0 for v in rgb]
    mx, mn = max(r, g, b), min(r, g, b)
    l = (mx + mn) / 2
    if mx == mn:
        return 0.0, 0.0, l
    d = mx - mn
    s = d / (1 - abs(2 * l - 1))
    if mx == r:
        h = ((g - b) / d) % 6
    elif mx == g:
        h = (b - r) / d + 2
    else:
        h = (r - g) / d + 4
    return h * 60, s, l


def hsl_to_hex(h, s, l):
    h %= 360
    c = (1 - abs(2 * l - 1)) * s
    x = c * (1 - abs((h / 60) % 2 - 1))
    m = l - c / 2
    r, g, b = [(c, x, 0), (x, c, 0), (0, c, x), (0, x, c), (x, 0, c), (c, 0, x)][int(h // 60) % 6]
    return "#%02X%02X%02X" % tuple(int(round((v + m) * 255)) for v in (r, g, b))


def cmyk_naive(rgb):
    r, g, b = [v / 255.0 for v in rgb]
    k = 1 - max(r, g, b)
    if k >= 1:
        return [0, 0, 0, 100]
    return [round((1 - r - k) / (1 - k) * 100), round((1 - g - k) / (1 - k) * 100), round((1 - b - k) / (1 - k) * 100), round(k * 100)]


def oklch_of(rgb):
    c = np.array([v / 255.0 for v in rgb])
    c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    r, g, b = c
    l_ = np.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
    m_ = np.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
    s_ = np.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
    L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_
    a = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_
    bb = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_
    return float(L), float(math.hypot(a, bb)), float(math.degrees(math.atan2(bb, a)) % 360)


# --- painter's (RYB) wheel: piecewise map between the RGB hue wheel and an Itten-style RYB wheel -----------------------
_RGB_A = [0, 60, 120, 180, 240, 300, 360]
_RYB_A = [0, 120, 180, 210, 240, 300, 360]


def rgb_to_ryb_hue(h):
    return float(np.interp(h % 360, _RGB_A, _RYB_A))


def ryb_to_rgb_hue(h):
    return float(np.interp(h % 360, _RYB_A, _RGB_A))


def dir_words(a_lch, b_lch):
    """How b differs from a, from the biggest LCh differences. A port of lookDiff() in js/lookalikes.js
    (a fixed vocabulary: never a color name as a direction word)."""
    La, Ca, Ha = a_lch
    Lb, Cb, Hb = b_lch
    dL, dC = Lb - La, Cb - Ca
    dH = Hb - Ha
    if dH > 180:
        dH -= 360
    if dH < -180:
        dH += 360

    def hue_word(h):
        h = (h + 360) % 360
        return "redder" if (h < 55 or h >= 345) else "yellower" if h < 130 else "greener" if h < 190 else "bluer" if h < 280 else "purpler"
    parts = []
    if abs(dL) >= 4:
        parts.append((abs(dL), "lighter" if dL > 0 else "darker"))
    if abs(dC) >= 5:
        parts.append((abs(dC) * .8, "more vivid" if dC > 0 else "duller"))
    if Ca > 8 and Cb > 8 and abs(dH) >= 8:
        parts.append((abs(dH) * min(Ca, Cb) / 40, hue_word(Ha + (1 if dH > 0 else -1) * 25)))
    parts.sort(key=lambda p: -p[0])
    out = [p[1] for p in parts[:2]]
    return " and ".join(out) if out else "almost the same"


def contrast_ratio(rgb1, rgb2):
    def lum(rgb):
        c = np.array([v / 255.0 for v in rgb])
        c = np.where(c > 0.03928, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
        return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
    a, b = lum(rgb1), lum(rgb2)
    hi, lo = max(a, b), min(a, b)
    return (hi + 0.05) / (lo + 0.05)


# --- approximate Munsell (colour-science), cached --------------------------------------------------------------------
def munsell_many(hexes, cache_path):
    cache = {}
    if cache_path and Path(cache_path).exists():
        cache = json.loads(Path(cache_path).read_text())
    todo = [h for h in dict.fromkeys(hexes) if h not in cache]
    if todo:
        warnings.filterwarnings("ignore")
        try:
            import colour
            C = colour.CCS_ILLUMINANTS["CIE 1931 2 Degree Standard Observer"]["C"]
        except Exception:
            colour = None
        for h in todo:
            val = None
            if colour is not None:
                rgb = np.array(hex_to_rgb(h)) / 255.0
                try:
                    XYZ = colour.sRGB_to_XYZ(rgb, illuminant=C, chromatic_adaptation_transform="Bradford")
                    xyY = colour.XYZ_to_xyY(XYZ)
                    val = colour.notation.munsell.xyY_to_munsell_colour(xyY)
                except Exception:
                    try:  # near-neutral or very dark/light: the neutral scale from luminance
                        lab = labs([h])[0]
                        if math.hypot(lab[1], lab[2]) < 6:
                            Y = float(XYZ[1]) * 100
                            v = colour.notation.munsell.munsell_value_ASTMD1535(Y)
                            val = "N %.1f" % v
                    except Exception:
                        val = None
            cache[h] = val
        if cache_path:
            Path(cache_path).parent.mkdir(parents=True, exist_ok=True)
            Path(cache_path).write_text(json.dumps(cache))
    return {h: cache[h] for h in hexes}
