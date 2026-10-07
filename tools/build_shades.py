#!/usr/bin/env python3
"""ColorHub shades: the honeycomb up to ~9,000 (NOTES-TRACKER.md item 0, ROADMAP.md §13/§14's vocabulary ladder).
Generates described, computed shades to fill the gaps between the ~1,000 core names (data/core-names.json) and
the ~2,700 library names (data/library.json), using the app's own fixed modifier grammar (js/naming.js):
light/pale, dark/deep, greyish/dusty, bright/vivid, and the five hue leans (reddish/yellowish/greenish/bluish/
purplish). Each shade is one core name nudged along exactly one axis (lightness, chroma or hue) by just enough
that js/naming.js's nameOf() reads the result back as "<Modifier> <base name>" — never the base name alone
(too close) and never "between X and Y" (too far).

  python3 tools/build_shades.py                   # writes data/shades.json, target ~9,000 total (core+library+shades)
  python3 tools/build_shades.py --target 12000     # a different grand total, e.g. once more real names land
  python3 tools/build_shades.py --report           # also prints the before/mid/after counts and 30 sample names

David, 2026-10-09: paused before the real run. More real names (ISCC-NBS 1955, Maerz & Paul 1930, pigment and
19th-century dye/fashion names) are being imported into data/library.json first, so most of the ~9,000 are real
names and generated shades only fill what's left. This tool already reads data/library.json fresh every run (no
baked-in count), so it needs no change once that import lands — just rerun it. --target lets the grand total
move too, independent of the code.

How a candidate is built (one axis moves, the other two held exactly fixed, so js/naming.js's own
"biggest difference wins" axis picker can never pick a different axis than the one intended):
  lighten / darken   L moves, a/b (so C and H) held fixed      -> word is light/pale or dark/deep
  more / less chroma a,b scaled outward/inward, L held fixed   -> word is bright/vivid or greyish/dusty
  a hue lean         a,b rotated at fixed C, L held fixed      -> word is the lean itself

A binary search picks the smallest offset whose CIEDE2000 from the base lands in [4.0, 7.9) — inside
js/naming.js's NEAR_DE=8 "still names the base, with a modifier" window, and far enough (ROADMAP's "≥ ΔE 3"
read generously, since a shade close enough to be a near-duplicate of its base isn't a useful new color) that
it also clears the ≥4 distinctness bar against every core name, every library name and every other kept shade.
A candidate is dropped (not retried) when gamut or that search can't reach the window — reported as "blocked".

Then: keep only candidates that (a) land in sRGB gamut, (b) have the intended base as their true nearest core
name (CIEDE2000, so nameOf() really would pick it), (c) are >= 4 from every core and library name, and (d) don't
carry a modifier the name already has, or a hue lean matching the base's own family (js/naming.js's
MOD_AXIS_WORDS / hueLean, ported 1:1 below). Candidates that survive are then taken by farthest-point gap-
filling (core + library + already-kept shades) until the grand total is ~9,000, so the growing honeycomb always
adds color where the map is thinnest first.
"""
import argparse, json, re, sys
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
import library as LIB  # color math (labs, lch, de2000, lab_to_rgb) + load_library

# pick_modifier/hue_lean, ported 1:1 from js/naming.js -- NOT reused from tools/build_core_names.py: its own
# MOD_AXIS_RE is missing two of js/naming.js's H-axis words ("orangish", "pinkish"), which let a handful of
# early test candidates here pick a different axis than nameOf() actually would for a name like "Pinkish Tan"
# (flagged separately; out of scope for this tool to fix in build_core_names.py / the already-shipped
# data/core-names.json). This copy is the single source of truth for this file.
MOD_AXIS_RE = {
    "L": re.compile(r"\b(light|pale|dark|deep|dusky|bright)\b", re.I),
    "C": re.compile(r"\b(grey|gray|greyish|grayish|dusty|dull|vivid|bright|neon|electric)\b", re.I),
    "H": re.compile(r"\b(reddish|yellowish|greenish|bluish|purplish|orangish|pinkish)\b", re.I),
}


def hue_lean(h):
    h = h % 360
    return ("reddish" if h < 40 or h >= 345 else "yellowish" if h < 100 else
            "greenish" if h < 170 else "bluish" if h < 260 else "purplish")


def pick_modifier(name_lch, target_lch, name=""):
    Ln, Cn, Hn = name_lch
    Lt, Ct, Ht = target_lch
    dL, dC = Lt - Ln, Ct - Cn
    dH = Ht - Hn
    if dH > 180: dH -= 360
    if dH < -180: dH += 360
    scores = [("L", abs(dL), dL), ("C", abs(dC) * .8, dC)]
    if Cn > 8 and Ct > 8:
        scores.append(("H", abs(dH) * min(Cn, Ct) / 40, dH))
    scores.sort(key=lambda s: -s[1])
    ok = [s for s in scores if not MOD_AXIS_RE[s[0]].search(name)]
    if not ok:
        return ""
    axis, _, v = ok[0]
    if axis == "L":
        return ("pale" if Ct < 20 else "light") if v > 0 else ("deep" if Ct > 35 else "dark")
    if axis == "C":
        return ("greyish" if Ct < 15 else "dusty") if v < 0 else ("bright" if Lt > 55 else "vivid")
    return hue_lean(Ht)

CORE_OUT = ROOT / "data" / "core-names.json"
LIB_OUT = ROOT / "data" / "library.json"
OUT = ROOT / "data" / "shades.json"

VERY_CLOSE_DE = 3.0   # js/naming.js: below this, nameOf() shows the bare name (no modifier) -- too close to use
NEAR_DE = 8.0         # js/naming.js: at/above this, nameOf() says "between X and Y" -- too far to read as a shade
DEFAULT_MIN_DE_ALL = 4.0   # ROADMAP's "at least ~ΔE00 4 from every core name/library name/kept shade", inclusive
                           # floor -- overridable with --min-de (NOTES-TRACKER.md's spacing sweep: 4.0/3.5/3.0/2.5).
                           # Never go below 2.5 (ROADMAP: neighbours become indistinguishable on many screens).
MIN_DE_ALL = DEFAULT_MIN_DE_ALL   # reset from args.min_de at the top of main(); module-level so try_axis() etc. see it
TARGET_WINDOW = (MIN_DE_ALL + 0.3, NEAR_DE - 0.2)   # recomputed from MIN_DE_ALL at the top of main()
TARGET_DE = 5.6       # the search aims here first; the window above is what actually gets accepted
DEFAULT_TARGET_TOTAL = 9000   # overridable with --target

HUE_BANDS = [("reddish", 12.5), ("yellowish", 70.0), ("greenish", 135.0), ("bluish", 215.0), ("purplish", 302.5)]


def hue_lean_of(h):
    return hue_lean(h % 360)


def dominant_axis(base_lch, target_lch, name):
    """Which axis js/naming.js's pickModifier would actually score highest, post-quantization -- a duplicate of
    pick_modifier's own scoring (not its word-picking), so a candidate whose intended axis got edged out by
    rounding (e.g. a hue-lean move that also nudged L or C by a hair) is caught and dropped rather than shipped
    with the wrong word for its own data (ROADMAP: it must read back EXACTLY)."""
    Ln, Cn, Hn = base_lch
    Lt, Ct, Ht = target_lch
    dL, dC = Lt - Ln, Ct - Cn
    dH = Ht - Hn
    if dH > 180: dH -= 360
    if dH < -180: dH += 360
    scores = [("L", abs(dL)), ("C", abs(dC) * .8)]
    if Cn > 8 and Ct > 8:
        scores.append(("H", abs(dH) * min(Cn, Ct) / 40))
    scores.sort(key=lambda s: -s[1])
    ok = [s for s in scores if not MOD_AXIS_RE[s[0]].search(name)]
    return ok[0][0] if ok else None


def ang_delta(a, b):
    """Shortest signed delta from angle a to angle b, in (-180, 180]."""
    d = (b - a + 180) % 360 - 180
    return d


def in_gamut_lab(lab_row):
    """Unclipped sRGB round-trip check (LIB.lab_to_rgb clips, so it can't tell gamut on its own)."""
    fy = (lab_row[0] + 16) / 116
    f = np.array([fy + lab_row[1] / 500, fy, fy - lab_row[2] / 200])
    xyz = np.where(f ** 3 > 0.008856, f ** 3, (f - 16 / 116) / 7.787) * LIB._WP
    c = xyz @ np.linalg.inv(LIB._M).T
    if np.any(c < -0.003) or np.any(c > 1.003):
        return False
    g = np.where(c > 0.0031308, 1.055 * np.clip(c, 0, None) ** (1 / 2.4) - 0.055, 12.92 * c)
    return bool(np.all(g >= -0.02) and np.all(g <= 1.02))


def lab_to_hex(lab_row):
    return LIB.rgb_to_hex(LIB.lab_to_rgb(lab_row[None])[0])


# ---------------------------------------------------------------------------------------------
# One axis move, as a function of a scalar magnitude m >= 0 (direction baked in by the caller).
# ---------------------------------------------------------------------------------------------
def mover_L(lab0, sign):
    L, a, b = lab0
    return lambda m: np.array([min(100.0, max(0.0, L + sign * m)), a, b])


def mover_C(lab0, sign):
    L, a, b = lab0
    C = float(np.hypot(a, b))
    if C < 1e-6:
        return None
    def f(m):
        newC = max(0.0, C + sign * m)
        s = newC / C
        return np.array([L, a * s, b * s])
    return f


def mover_H(lab0, target_h):
    L, a, b = lab0
    C = float(np.hypot(a, b))
    H = float(np.degrees(np.arctan2(b, a)) % 360)
    d = ang_delta(H, target_h)   # full signed distance to the band's center
    def f(t):   # t in [0, 1]: fraction of the way from H to target_h
        newH = H + d * t
        rad = np.radians(newH)
        return np.array([L, C * np.cos(rad), C * np.sin(rad)])
    return f, abs(d)


def search(ok_de, hi, iters=36):
    """Largest m in [0, hi] with de2000(base, f(m)) < TARGET_DE, falling back toward the gamut/range edge when
    the target is never reached (ok_de returns (ok, de, lab) so the caller can inspect the final state)."""
    lo, hi0 = 0.0, hi
    last = ok_de(hi0)
    if last[0]:   # even the far edge is still short of TARGET_DE: take the edge itself
        return hi0, last
    for _ in range(iters):
        mid = (lo + hi0) / 2
        ok, de, lab_row = ok_de(mid)
        if ok:
            lo = mid
        else:
            hi0 = mid
    return lo, ok_de(lo)


def try_axis(base_lab, mover, hi):
    """Binary-search mover(m) for the largest m with de(base, candidate) < TARGET_DE and in gamut; returns
    (lab, de) of the best candidate found, or None if gamut/range never reaches MIN window at all."""
    def ok_de(m):
        cand = mover(m)
        if not in_gamut_lab(cand):
            return False, None, cand
        de = float(LIB.de2000(base_lab[None], cand[None])[0, 0])
        return de < TARGET_DE, de, cand
    m, (ok, de, cand) = search(ok_de, hi)
    if de is None:
        # the very first in-gamut point we can test is already past hi with de unknown: nudge in from 0
        cand = mover(0.0)
        de = 0.0
    if not in_gamut_lab(cand):
        return None
    de_final = float(LIB.de2000(base_lab[None], cand[None])[0, 0])
    return cand, de_final


def main():
    global MIN_DE_ALL, TARGET_WINDOW
    ap = argparse.ArgumentParser()
    ap.add_argument("--target", type=int, default=DEFAULT_TARGET_TOTAL,
                    help="grand total to aim for: len(core) + len(library) + shades (default 9000)")
    ap.add_argument("--min-de", type=float, default=DEFAULT_MIN_DE_ALL, dest="min_de",
                    help="minimum CIEDE2000 spacing a shade must keep from every core/library/kept-shade color "
                         "(default 4.0; NOTES-TRACKER.md's sweep tries 4.0/3.5/3.0/2.5 -- never go below 2.5)")
    ap.add_argument("--out", default=str(OUT), help="output path (default data/shades.json)")
    ap.add_argument("--report", action="store_true")
    args = ap.parse_args()
    report = args.report
    out_path = Path(args.out)
    MIN_DE_ALL = args.min_de
    # The window a shade's distance-from-its-own-base must land in has its OWN floor, independent of --min-de:
    # js/naming.js's nameOf() only prints a modifier at VERY_CLOSE_DE (3.0) or above -- below that it shows the
    # bare base name, which is exactly what check_shades.js's read-back gate catches. --min-de 4.0/3.5/3.0 are all
    # already above VERY_CLOSE_DE so this was never visible before the sweep went to 2.5, where MIN_DE_ALL + 0.3
    # (2.8) would otherwise dip under 3.0 and generate shades that read back as their bare base name.
    base_floor = max(MIN_DE_ALL, VERY_CLOSE_DE)
    TARGET_WINDOW = (base_floor + 0.3, NEAR_DE - 0.2)
    core = json.loads(CORE_OUT.read_text(encoding="utf-8"))
    lib = LIB.load_library()   # always read fresh: as real names are imported, this grows with no code change
    core_names_lower = {e["n"].lower() for e in core}

    core_lab = LIB.labs([e["h"] for e in core])
    lib_lab = LIB.labs([e["h"] for e in lib])
    core_lch = [LIB.lch(core_lab[i]) for i in range(len(core))]

    blocked = {"gamut_or_range": 0, "axis_name_conflict": 0, "hue_same_family": 0, "low_chroma": 0,
               "nearest_not_base": 0, "too_close_to_library": 0, "readback_mismatch": 0}
    candidates = []   # dicts: {n, h, base, mod, lab, de}

    for i, e in enumerate(core):
        name, hexv = e["n"], e["h"]
        lab0 = core_lab[i]
        L0, C0, H0 = core_lch[i]
        name_l = name.lower()

        moves = []   # (kind, mover_fn_or_None, hi, extra)
        if not MOD_AXIS_RE["L"].search(name):
            m = mover_L(lab0, +1)
            if m: moves.append(("L+", m, min(70.0, 100.0 - L0)))
            m = mover_L(lab0, -1)
            if m: moves.append(("L-", m, min(70.0, L0)))
        else:
            blocked["axis_name_conflict"] += 2
        if not MOD_AXIS_RE["C"].search(name):
            m = mover_C(lab0, +1)
            if m: moves.append(("C+", m, 80.0))
            if C0 >= 12:
                m = mover_C(lab0, -1)
                if m: moves.append(("C-", m, C0))
            else:
                blocked["low_chroma"] += 1
        else:
            blocked["axis_name_conflict"] += 1 + (1 if C0 >= 12 else 0)
        if C0 > 8 and not MOD_AXIS_RE["H"].search(name):
            base_fam = hue_lean_of(H0)
            for lean, center in HUE_BANDS:
                if lean == base_fam:
                    blocked["hue_same_family"] += 1
                    continue
                f, dist = mover_H(lab0, center)
                if dist < 8:   # the band center is basically where we already are: not a real lean
                    blocked["hue_same_family"] += 1
                    continue
                mover = (lambda ff: (lambda t: ff(t)))(f)   # bind this iteration's f, not the loop variable
                moves.append(("H:" + lean, mover, 1.0))
        elif C0 <= 8:
            blocked["low_chroma"] += 4   # the 4 hue leans this base never gets, since nameOf() never scores H for a near-grey

        for kind, mover, hi in moves:
            got = try_axis(lab0, mover, hi)
            if got is None:
                blocked["gamut_or_range"] += 1
                continue
            cand_lab, de = got
            # quantize to the actual sRGB hex now, and re-derive everything from THAT Lab from here on: the
            # app only ever sees the rounded hex, and even a tiny rounding nudge can flip pick_modifier across
            # a threshold (Ct just either side of 35, say "deep" vs "dark") -- so the stored `mod` must be
            # computed from exactly the color nameOf() will recompute at runtime, not the pre-rounding ideal.
            hexv = lab_to_hex(cand_lab)
            cand_lab = LIB.labs([hexv])[0]
            de = float(LIB.de2000(lab0[None], cand_lab[None])[0, 0])
            if not (TARGET_WINDOW[0] <= de < TARGET_WINDOW[1]):
                blocked["gamut_or_range"] += 1
                continue
            # the base must really be the nearest core name (so nameOf() would land here), with margin >= base_floor
            d_core = LIB.de2000(cand_lab[None], core_lab)[0]
            j = int(np.argmin(d_core))
            if j != i or not (base_floor - 0.15 <= d_core[j] < NEAR_DE):
                blocked["nearest_not_base"] += 1
                continue
            d_lib = LIB.de2000(cand_lab[None], lib_lab)[0]
            if d_lib.min() < MIN_DE_ALL:
                blocked["too_close_to_library"] += 1
                continue
            cand_lch = LIB.lch(cand_lab)
            intended_axis = kind[0]   # "L+"/"L-" -> "L", "C+"/"C-" -> "C", "H:<lean>" -> "H"
            if dominant_axis((L0, C0, H0), cand_lch, name) != intended_axis:
                blocked["readback_mismatch"] += 1   # rounding nudged a different axis into the lead: drop it
                continue
            mod = pick_modifier((L0, C0, H0), cand_lch, name)
            if not mod:
                blocked["readback_mismatch"] += 1
                continue
            label = f"{mod[0].upper()}{mod[1:]} {name.lower()}"
            candidates.append({"base": name, "mod": mod, "n": label, "h": hexv, "lab": cand_lab, "de": d_core[j]})

    # ---------- greedy gap-filling: farthest-from-everything first, until core+library+shades ~= target ----------
    budget = max(0, args.target - len(core) - len(lib))
    cand_lab = np.array([c["lab"] for c in candidates]) if candidates else np.zeros((0, 3))
    ref_lab = np.vstack([core_lab, lib_lab])
    dmin = LIB.de2000(cand_lab, ref_lab).min(1) if len(candidates) else np.zeros(0)
    chosen = np.zeros(len(candidates), bool)
    kept = []
    for _ in range(budget):
        avail = ~chosen
        if not avail.any():
            break
        best = float(dmin[avail].max())
        if best < MIN_DE_ALL:
            break
        # among those at/above the floor, prefer the single farthest (ties broken by original order, deterministic)
        idx = [k for k in range(len(candidates)) if avail[k] and dmin[k] >= best - 1e-9]
        pick = idx[0]
        chosen[pick] = True
        kept.append(candidates[pick])
        d_new = LIB.de2000(cand_lab, cand_lab[pick][None])[:, 0]
        dmin = np.minimum(dmin, d_new)

    # ---------- write data/shades.json: {n, h, base, mod}, sorted for determinism ----------
    kept.sort(key=lambda c: (c["base"].lower(), c["mod"], c["n"]))
    out = [{"n": c["n"], "h": c["h"], "base": c["base"], "mod": c["mod"]} for c in kept]
    lines = [json.dumps(e, ensure_ascii=False, separators=(",", ":")) for e in out]
    out_path.write_text("[\n" + ",\n".join(lines) + "\n]\n" if out else "[]\n", encoding="utf-8")

    total = len(core) + len(lib) + len(out)
    print(f"{out_path.name}: {len(out)} shades written ({out_path.stat().st_size / 1024:.1f} KB), min-de {MIN_DE_ALL}")
    print(f"core {len(core)} + library {len(lib)} + shades {len(out)} = {total} total (target ~{args.target})")
    print(f"candidates generated: {len(candidates)}, kept: {len(out)} ({100 * len(out) / max(1, len(candidates)):.0f}%)")
    print("blocked, by reason:", blocked)

    if report:
        by_mod = {}
        for e in out:
            by_mod[e["mod"]] = by_mod.get(e["mod"], 0) + 1
        print("\nkept shades by modifier word:", dict(sorted(by_mod.items())))
        print("\n30 sample shade names:")
        step = max(1, len(out) // 30)
        for e in out[::step][:30]:
            print(f"  {e['n']:30s} {e['h']}  (base: {e['base']}, mod: {e['mod']})")


if __name__ == "__main__":
    main()
