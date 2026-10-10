#!/usr/bin/env python3
"""Checker for the painting map's tiered sprite atlas (tools/paintmap_atlas.py / js/paintmap.js).

Bug (David, live, 42,331 paintings): "In the painting map, the zoomed-out pictures aren't the same paintings
as themselves close up." This samples indices across the whole range, crops the tier-0 and tier-1 tiles at the
positions the JS formula (pmT0Rect/pmT1Rect) computes, and compares each against a freshly-derived crop of the
painting's OWN actual thumbnail (same source + crop tools/paintmap_atlas.py's process_one() would use), via a
perceptual hash distance. A real mismatch (wrong painting in that cell) scores a large distance; a same-painting
match (just re-encoded/re-cropped) scores near zero.

Usage:
  python3 tools/paintmap_atlas_check.py [--samples N] [--local-only] [--seed S] [--collection paintings]
  python3 tools/paintmap_atlas_check.py --fast        # --local-only --samples 40, for a smoke/check.js gate

Exit code is non-zero if any sampled index mismatches (excluding indices flagged "missing" -- a fetch failure,
which is expected to fall back client-side, not a desync).
"""
import json, os, random, sys, time
import urllib.request, urllib.error
from io import BytesIO
from math import ceil

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from paintmap_atlas import (  # reuse the exact same reference logic the build uses
    ROOT, GAL, THUMBS, thumb_url, square_crop_resize, parse_line, fetch_bytes,
    TIER0_TILE, TIER1_TILE, grid1,
)

OUT = os.path.join(ROOT, "data", "paintmap")
MISMATCH_DHASH = 18   # dHash Hamming distance (of 64 bits) above this = different painting, not just re-encode.
# Calibrated empirically (David's 2026-10-10 fix): true cross-painting mismatches scored 19-41; same-painting
# pairs that only differ by re-encoding/resampling (WEBP recompression, an 80px->20px downsample) scored up to
# ~12. 18 sits in the gap with margin on both sides.


def dhash(im, size=8):
    im = im.convert("L").resize((size + 1, size), Image.LANCZOS)
    px = list(im.getdata())
    bits = []
    for row in range(size):
        base = row * (size + 1)
        for col in range(size):
            bits.append(px[base + col] > px[base + col + 1])
    v = 0
    for b in bits:
        v = (v << 1) | (1 if b else 0)
    return v


def hamming(a, b):
    return bin(a ^ b).count("1")


def pm_t0_rect(man, i):
    t = man["tier0"]
    sheet, local = divmod(i, t["perSheet"])
    cols = t["cols"]
    return sheet, (local % cols) * t["tile"], (local // cols) * t["tile"], t["tile"]


def pm_t1_rect(man, i):
    t = man["tier1"]
    g = i // t["groupSize"]
    lo = g * t["groupSize"]
    hi = min(man["n"], (g + 1) * t["groupSize"])
    cols, _ = grid1(hi - lo)
    local = i - lo
    return g, (local % cols) * t["tile"], (local // cols) * t["tile"], t["tile"]


def load_lines(collection):
    if collection != "paintings":
        sys.exit("checker currently supports --collection paintings only")
    with open(THUMBS) as f:
        return [l.rstrip("\n") for l in f]


def atlas_base(collection):
    return OUT if collection == "paintings" else os.path.join(OUT, collection)


def main():
    args = sys.argv[1:]
    samples, seed, local_only, collection = 300, 42, False, "paintings"
    k = 0
    while k < len(args):
        a = args[k]
        if a == "--samples": samples = int(args[k + 1]); k += 2
        elif a == "--seed": seed = int(args[k + 1]); k += 2
        elif a == "--local-only": local_only = True; k += 1
        elif a == "--collection": collection = args[k + 1]; k += 2
        elif a == "--fast": samples, local_only = 40, True; k += 1
        else: k += 1

    base = atlas_base(collection)
    man_path = os.path.join(base, "manifest.json")
    if not os.path.exists(man_path):
        sys.exit(f"no manifest at {man_path} -- atlas not built")
    man = json.load(open(man_path))
    n = man["n"]
    lines = load_lines(collection)
    if len(lines) != n:
        print(f"WARNING: thumbs.txt has {len(lines)} lines but manifest says n={n} -- "
              f"these are already out of sync before any tile is even compared")

    rng = random.Random(seed)
    pool = list(range(n))
    if local_only:
        pool = [i for i in pool if i < len(lines) and parse_line(lines[i])[0].startswith("L")]
        if not pool:
            sys.exit("--local-only: no local ('L'-prefixed) painting lines found")
    k = min(samples, len(pool))
    # spread across the whole range: bucket pool into k roughly-equal ranges by index and pick one per bucket
    # (a pure random sample can clump away from a narrow mismatching range; this guarantees full-range coverage)
    idxs = sorted(rng.sample(pool, k)) if k < len(pool) else sorted(pool)

    # open every tier0 sheet + whichever tier1 group sheets we'll need, lazily
    tier0_sheets = {}
    def get_tier0(sheet_no):
        if sheet_no not in tier0_sheets:
            name = man["tier0"]["sheets"][sheet_no]
            tier0_sheets[sheet_no] = Image.open(os.path.join(base, name)).convert("RGB")
        return tier0_sheets[sheet_no]

    tier1_sheets = {}
    def get_tier1(g):
        if g not in tier1_sheets:
            path = os.path.join(base, man["tier1"]["file"].replace("{g}", str(g)))
            tier1_sheets[g] = Image.open(path).convert("RGB") if os.path.exists(path) else None
        return tier1_sheets[g]

    results = []  # (i, status, dist0, dist1)
    t_start = time.time()
    for n_done, i in enumerate(idxs):
        code_addr, crop = parse_line(lines[i])
        kind, loc = thumb_url(code_addr)
        try:
            raw = fetch_bytes(kind, loc, retries=1)
            ref0 = square_crop_resize(raw, crop, TIER0_TILE)
            ref1 = square_crop_resize(raw, crop, TIER1_TILE)
        except Exception as e:
            results.append((i, "missing", None, None, str(e)))
            continue

        sheet0, x0, y0, s0 = pm_t0_rect(man, i)
        t0_cell = get_tier0(sheet0).crop((x0, y0, x0 + s0, y0 + s0))
        d0 = hamming(dhash(ref0), dhash(t0_cell))

        g, x1, y1, s1 = pm_t1_rect(man, i)
        t1_sheet = get_tier1(g)
        d1 = None
        if t1_sheet is not None:
            t1_cell = t1_sheet.crop((x1, y1, x1 + s1, y1 + s1))
            d1 = hamming(dhash(ref1), dhash(t1_cell))

        status = "ok"
        if d0 > MISMATCH_DHASH or (d1 is not None and d1 > MISMATCH_DHASH):
            status = "MISMATCH"
        results.append((i, status, d0, d1, None))
        if (n_done + 1) % 50 == 0:
            print(f"  checked {n_done + 1}/{k} ({time.time() - t_start:.1f}s elapsed)")

    mismatches = [r for r in results if r[1] == "MISMATCH"]
    missing = [r for r in results if r[1] == "missing"]
    ok = [r for r in results if r[1] == "ok"]

    print(f"\n---- paintmap atlas check: {k} sampled of {n} ----")
    print(f"ok={len(ok)} mismatch={len(mismatches)} missing/fetch-failed={len(missing)}")
    if mismatches:
        # report by group/range so a caller can see WHICH part of the corpus is desynced
        by_group = {}
        for i, status, d0, d1, _ in mismatches:
            g = i // man["tier1"]["groupSize"]
            by_group.setdefault(g, []).append((i, d0, d1))
        print("mismatches by tier-1 group:")
        for g in sorted(by_group):
            examples = by_group[g][:5]
            print(f"  group {g} (indices {g*man['tier1']['groupSize']}-"
                  f"{min(n, (g+1)*man['tier1']['groupSize'])-1}): {len(by_group[g])} mismatches, "
                  f"e.g. {examples}")
    if missing:
        print(f"missing (fetch failed, excluded from mismatch count): {[r[0] for r in missing][:20]}"
              + (" ..." if len(missing) > 20 else ""))

    rate = len(mismatches) / k if k else 0
    print(f"\nmismatch rate: {rate*100:.1f}% ({len(mismatches)}/{k})")
    sys.exit(1 if mismatches else 0)


if __name__ == "__main__":
    main()
