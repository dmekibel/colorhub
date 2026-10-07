#!/usr/bin/env python3
"""Maerz & Paul, *A Dictionary of Color*, 1st edition (McGraw-Hill, 1930) -> data/sources/maerz-paul-1930.json.

See research/MAERZ-PAUL.md for the source hunt (why this is the only usable scan) and research/LIBRARY.md s9
for the extraction method, merge rule and before/after numbers. The merge into data/library.json itself is
merge_maerz_paul() in tools/library.py, wired into build() there (not in this file).

  python3 tools/maerz_paul.py                 # build data/sources/maerz-paul-1930.json (downloads once, ~460MB
                                               # cached at research/_raw/maerz-paul/, never committed)
  python3 tools/maerz_paul.py --plate 9 -v     # debug one plate: prints every cell found, no file written
  python3 tools/maerz_paul.py --spotcheck 100  # print a random sample of N records for a manual image spot-check

--------------------------------------------------------------------------------------------------------------
THE SCAN
--------------------------------------------------------------------------------------------------------------
Internet Archive item `dictionaryofcolo0000aloy` (A. Maerz, M. Rea Paul, "A Dictionary Of Color", McGraw-Hill,
1930 -- IA metadata date=1930, confirmed public domain, see research/MAERZ-PAUL.md) is the only open digitization
found (HathiTrust's two "Full view" PD copies are both behind a Cloudflare bot challenge; Google Books serves
only session-signed placeholder images -- neither was used, per the "never bypass bot detection" rule).

IA's own processed derivative (the `_jp2.zip`, and the iiif.archive.org endpoint built from it) is desaturated
almost to nothing (mean HSV saturation ~0.07 across every plate checked) -- unusable for color. The **original,
unprocessed** per-page camera captures in `dictionaryofcolo0000aloy_orig_jp2.tar` (480MB, 224 pages, full color,
mean saturation 0.12-0.32) are the real scan and are what this module uses. Each raw page is the full camera
frame (book cradle, glass platen, 6000x4000 landscape) rotated 90 deg (even leaf, left/verso) or 270 deg (odd
leaf, right/recto) to read upright -- a fixed rule confirmed against the book's own `_scandata.xml` (handSide
LEFT/RIGHT) and by eye on >10 plates, not content-dependent.

--------------------------------------------------------------------------------------------------------------
BOOK STRUCTURE
--------------------------------------------------------------------------------------------------------------
Each plate is a facing-page pair: a "key" page (cream paper, the 12x12 lettered/numbered grid with any named
chip's name printed in it, blank otherwise) and a "color" page (the same 12x12 grid, each cell printed in its
actual color, no text, mounted on a grey board margin). Confirmed leaf numbers (1-indexed into the tar's
`_orig_NNNN.jp2` files): Plate 1 = leaves 36 (key) / 37 (color); Plate N for N=3..56 = leaves 2N+32 (key) /
2N+33 (color) -- a formula confirmed exactly at N=3, 4, 9, 29 and 56 by reading each page's own printed "Plate
N" label and page number. **Plate 2 is missing from this scan**: the leaf immediately after Plate 1's color page
(leaf 38) is already printed "Plate 3", and the book's own printed page numbers jump from 25 (Plate 1 color) to
28 (Plate 3 key) in that single leaf-to-leaf step -- two physical pages (almost certainly Plate 2's key+color
pair) were never photographed, most likely two leaves turned together during the IA scanning pass. 55 of the
56 plates are recoverable; Plate 2's names get no hex and are skipped (reported at build time).

--------------------------------------------------------------------------------------------------------------
READING THE CHIPS
--------------------------------------------------------------------------------------------------------------
Grid detection: within each page's bright (non-cradle) bounding box, the grid's outer ruled border is found by
searching near its expected relative position for the row/column with the highest fraction of true-black pixels
(R,G,B all < 80 -- not merely low luminance, which a saturated dark chip like a navy or maroon can also have).
The border found this way was checked by eye against the book's own column letters / row numbers on 6 plates
(1, 3, 4, 9, 29, 56): exact column-for-column, row-for-row match every time. The grid is then divided into 12
equal columns (A-L) and 12 equal rows (1-12) -- it is a mechanically ruled table, so equal spacing is accurate
to a pixel or two; no per-cell line detection is attempted (consistent with the project's existing "approximate,
uncalibrated scan" tolerance for Werner/Ridgway).

Color: each cell's center (interior 44% by area, avoiding borders and any text) is median-sampled in sRGB after
a slight Gaussian blur (same spirit as the Ridgway re-measurement in research/LIBRARY.md s2). **Paper/aging
correction**: the plate's own unprinted margin (the grey board strip just outside the grid's bottom border) is
sampled and used to white-balance the whole plate -- each channel is scaled so the margin itself reads neutral
(R=G=B, at its own brightness), the same corrective spirit as the Ridgway digitization's own aged-plate handling.
In practice this scan's margins are already close to neutral (measured ~(133,130,129) on Plate 1), so the
correction is a small one, not a large cast removal -- documented here rather than assumed away.

Names: OCR'd directly off the key page (no separate alphabetical index is needed -- the key page already gives
every named chip's exact plate/column/row by construction). A cell is only sent to OCR if it has enough dark
pixels to plausibly hold text (cheap pre-filter: ~75-80% of cells are blank and are skipped, which is most of
the wall-clock savings). Each cell crop is lightly binarized (fixed threshold off its own mean) and OCR'd with
tesseract `--psm 6`, multi-line results joined with a space. Output is kept only if `plausible_name()` passes:
mostly letters/spaces/hyphens/apostrophes/periods, at least 2 letters, under 40 chars.
"""
import json
import re
import subprocess
import sys
import tarfile
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "research" / "_raw" / "maerz-paul"
PAGES = RAW / "pages"
OUT = ROOT / "data" / "sources" / "maerz-paul-1930.json"
IDENT = "dictionaryofcolo0000aloy"
TAR_URL = f"https://archive.org/download/{IDENT}/{IDENT}_orig_jp2.tar"
UA = "ColorHubBot/1.0 (https://github.com/dmekibel/colorhub)"
PAGE_FMT = str(PAGES / f"{IDENT}_orig_{{:04d}}.jp2")

COLS = "ABCDEFGHIJKL"
N_COLS, N_ROWS = 12, 12


# ---------------------------------------------------------------------------------------------
# Download + cache (research/_raw/maerz-paul/, gitignored; ~460MB once extracted)
# ---------------------------------------------------------------------------------------------
def ensure_raw():
    PAGES.mkdir(parents=True, exist_ok=True)
    if len(list(PAGES.glob("*.jp2"))) >= 224:
        return
    print("downloading the original (unprocessed) page scans, ~480MB, once...", flush=True)
    tar_path = RAW / "orig_jp2.tar"
    req = urllib.request.Request(TAR_URL, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=300) as r, open(tar_path, "wb") as f:
        while True:
            chunk = r.read(1 << 20)
            if not chunk:
                break
            f.write(chunk)
    with tarfile.open(tar_path) as tf:
        for m in tf.getmembers():
            if not m.isfile():
                continue
            m.name = Path(m.name).name  # flatten: drop the tar's internal directory prefix
            tf.extract(m, PAGES)
    tar_path.unlink()


# ---------------------------------------------------------------------------------------------
# Plate <-> leaf mapping (see module docstring "BOOK STRUCTURE")
# ---------------------------------------------------------------------------------------------
MISSING_PLATES = {2}
PLATES = [n for n in range(1, 57) if n not in MISSING_PLATES]


def leaf_for(n):
    if n == 1:
        return 36, 37
    return 2 * n + 32, 2 * n + 33


# ---------------------------------------------------------------------------------------------
# Orientation + grid geometry
# ---------------------------------------------------------------------------------------------
def oriented(leaf):
    im = Image.open(PAGE_FMT.format(leaf)).convert("RGB")
    angle = 90 if leaf % 2 == 0 else 270
    return im.rotate(angle, expand=True)


def page_bbox(im, thresh=100):
    g = np.asarray(im.convert("L"), dtype=np.float64)
    rows = np.where(g.mean(1) > thresh)[0]
    cols = np.where(g.mean(0) > thresh)[0]
    return int(cols[0]), int(rows[0]), int(cols[-1]), int(rows[-1])


def grid_bbox(im, page_box, dark=80,
              xr=(0.04, 0.16), xl=(0.76, 0.92), yt=(0.06, 0.16), yb=(0.84, 0.96)):
    x0, y0, x1, y1 = page_box
    rgb = np.asarray(im.crop(page_box), dtype=np.float64)
    darkmask = (rgb[..., 0] < dark) & (rgb[..., 1] < dark) & (rgb[..., 2] < dark)
    h, w = darkmask.shape

    def best_row(f0, f1):
        a, b = int(h * f0), int(h * f1)
        frac = darkmask[a:b, int(w * 0.15):int(w * 0.80)].mean(1)
        return a + int(np.argmax(frac))

    def best_col(f0, f1):
        a, b = int(w * f0), int(w * f1)
        frac = darkmask[int(h * 0.15):int(h * 0.80), a:b].mean(0)
        return a + int(np.argmax(frac))

    top, bottom = best_row(*yt), best_row(*yb)
    left, right = best_col(*xr), best_col(*xl)
    return x0 + left, y0 + top, x0 + right, y0 + bottom


def cell_box(gbox, ci, ri):
    x0, y0, x1, y1 = gbox
    w, h = (x1 - x0) / N_COLS, (y1 - y0) / N_ROWS
    cx0, cy0 = x0 + ci * w, y0 + ri * h
    return cx0, cy0, cx0 + w, cy0 + h


def cell_interior(im, box, shrink):
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    return im.crop((x0 + w * shrink, y0 + h * shrink, x1 - w * shrink, y1 - h * shrink))


# ---------------------------------------------------------------------------------------------
# Color: sample + white-balance against the plate's own margin
# ---------------------------------------------------------------------------------------------
def sample_color(im, box, shrink=0.28):
    crop = cell_interior(im, box, shrink).filter(ImageFilter.GaussianBlur(2))
    a = np.asarray(crop, dtype=np.float64).reshape(-1, 3)
    return np.median(a, 0)


def margin_sample(im, page_box, grid_box):
    gx0, gy0, gx1, gy1 = grid_box
    _, _, _, py1 = page_box
    band = im.crop((gx0, gy1 + 15, gx1, min(py1, gy1 + 70)))
    a = np.asarray(band, dtype=np.float64).reshape(-1, 3)
    return np.median(a, 0)


def _lab_L(rgb):
    """CIE L* (D65) from sRGB -- depends only on relative luminance Y, so this is cheap and exact without
    needing a full Lab conversion."""
    c = np.asarray(rgb, dtype=np.float64) / 255.0
    c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    y = float(c @ np.array([0.2126, 0.7152, 0.0722]))
    f = y ** (1 / 3) if y > 0.008856 else 7.787 * y + 16 / 116
    return 116 * f - 16


# Fitted against the ISCC-NBS cross-check (research/MAERZ-PAUL.md s6): printed ink is partly transparent, so
# a light (thin-ink, mostly-paper) chip carries nearly the full paper-yellowing cast and a dark, ink-dense chip
# carries very little of it. A single uniform white balance (gamma=0, below) over-corrects dark chips. The
# correction is instead scaled by how much paper plausibly "shows through": w = clip(L_chip/L_paper, 0, 1)**gamma.
PAPER_GAMMA = 1.5


def white_balance(rgb, margin_rgb, gamma=PAPER_GAMMA):
    gray = margin_rgb.mean()
    scale = gray / np.clip(margin_rgb, 1, 255)
    if gamma == 0:
        w = 1.0
    else:
        Lc, Lm = _lab_L(rgb), _lab_L(margin_rgb)
        w = np.clip(Lc / max(Lm, 1e-6), 0, 1) ** gamma
    return np.clip(rgb * (1 + w * (scale - 1)), 0, 255)


def rgb_to_hex(rgb):
    return "#" + "".join(f"{int(round(v)):02X}" for v in rgb)


# ---------------------------------------------------------------------------------------------
# Names: OCR the key page, skipping cells with no text
# ---------------------------------------------------------------------------------------------
# A real chip name, by Maerz & Paul's own typography, is one of: a capitalized word ("Jonquil"), an ALL-CAPS
# word (bold chips, "GOYA"), a French-elision fragment ("d'Althea"), or a 1-2 digit + 1-2 letter superscript
# code ("1T", "YP"). OCR noise from blank/speckled cells tends to fragment into short, oddly-cased tokens
# ("as", "oN", "wy") that fail every one of these shapes -- used to reject false positives from scan noise
# (see tools/maerz_paul.py's module docstring and research/LIBRARY.md s9 for the measured error rate).
_WORD = re.compile(r"^[A-Z][a-z]*$|^[A-Z]{2,}$|^[a-z]$|^\d{1,2}[A-Z]{1,2}$")


def has_text(im, box, dark=120, frac=0.015):
    crop = cell_interior(im, box, 0.12).convert("L")
    a = np.asarray(crop, dtype=np.float64)
    return (a < dark).mean() > frac


_SUBS = str.maketrans({"¥": "Y", "|": "", "’": "'", "‘": "'", "“": "", "”": ""})


def _clean(txt):
    lines = [l.strip() for l in txt.splitlines() if l.strip(" |")]
    joined = re.sub(r"-\s+", "-", " ".join(lines))  # "Peach- blossom" -> "Peach-blossom"
    joined = joined.translate(_SUBS)
    joined = re.sub(r"\s+", " ", joined).strip(" .,:;'\"-")
    return joined


def ocr_cell(im, box, tmp):
    """Tries psm 6 (a block of text -- handles multi-line names) and psm 7 (a single line -- sometimes
    cleans up stray-pipe noise psm 6 leaves in) on the same binarized crop, keeping whichever result is
    plausible (psm 7 preferred when both are, since single-line mode is less prone to line-split artifacts)."""
    crop = cell_interior(im, box, 0.09).convert("L")
    w, h = crop.size
    crop = crop.resize((w * 4, h * 4))
    a = np.asarray(crop)
    thr = min(200, a.mean() - 15)
    bw = (a > thr).astype("uint8") * 255
    Image.fromarray(bw).save(tmp)
    cands = []
    for psm in ("6", "7"):
        out = subprocess.run(["tesseract", str(tmp), "stdout", "--psm", psm], capture_output=True)
        cands.append(_clean(out.stdout.decode("utf-8", "replace")))
    for c in cands:
        if plausible_name(c):
            return c
    return cands[0]


def plausible_name(s):
    """A real Maerz & Paul chip name is short (1-3 words, rarely 4) and each word is a real word shape,
    not a noise fragment. Tightened against spot-check failures (research/LIBRARY.md s9): a bare single
    capital letter ("A", "B") is only legitimate as a trailing color-family code, so more than two such
    short tokens in one name is a sign of OCR noise strung together, not a real name; a token that is the
    same letter repeated ("EEE") is never a real word; and more than 4 tokens is almost always two
    different cells' names run together by the OCR crop, not one name."""
    if not s or len(s) > 40:
        return False
    tokens = s.split(" ")
    if len(tokens) > 4:
        return False
    long_enough = False
    short_tokens = 0
    for tok in tokens:
        for piece in re.split(r"[-']", tok):
            if not piece or not _WORD.match(piece):
                return False
            if len(set(piece.upper())) == 1 and len(piece) > 1:  # "EEE", "LL": not a real word
                return False
            if len(piece) <= 2:
                short_tokens += 1
            else:
                long_enough = True
    return long_enough and short_tokens <= 2


# ---------------------------------------------------------------------------------------------
# Per-plate extraction
# ---------------------------------------------------------------------------------------------
def extract_plate(n, verbose=False):
    key_leaf, color_leaf = leaf_for(n)
    key_im = oriented(key_leaf)
    color_im = oriented(color_leaf)
    key_pb = page_bbox(key_im)
    color_pb = page_bbox(color_im)
    key_gb = grid_bbox(key_im, key_pb)
    color_gb = grid_bbox(color_im, color_pb)
    margin = margin_sample(color_im, color_pb, color_gb)
    tmp = RAW / "_cell.png"

    out = []
    for ri in range(N_ROWS):
        for ci in range(N_COLS):
            kbox = cell_box(key_gb, ci, ri)
            if not has_text(key_im, kbox):
                continue
            name = ocr_cell(key_im, kbox, tmp)
            if not plausible_name(name):
                if verbose and name:
                    print(f"  plate {n} {COLS[ci]}{ri+1}: rejected OCR {name!r}")
                continue
            cbox = cell_box(color_gb, ci, ri)
            raw_rgb = sample_color(color_im, cbox)
            wb_rgb = white_balance(raw_rgb, margin)
            rec = {"n": name, "plate": n, "col": COLS[ci], "row": ri + 1, "h": rgb_to_hex(wb_rgb),
                   "note": f"Maerz & Paul 1930, Plate {n} {COLS[ci]}{ri+1}; approximate: measured from a 1930 plate scan"}
            out.append(rec)
            if verbose:
                print(f"  plate {n} {COLS[ci]}{ri+1}: {name!r} {rec['h']}")
    return out


PROVENANCE = {
    "_provenance": ("Maerz, A. & Paul, M. Rea, \"A Dictionary of Color\", 1st ed. (McGraw-Hill, 1930). "
                    "U.S. public domain since 2026-01-01 (1930 registration A23794, renewed 1957 as R197244, "
                    "Stanford Copyright Renewal Database -> full 95-year term). Scanned from Internet Archive "
                    "item dictionaryofcolo0000aloy (archive.org/details/dictionaryofcolo0000aloy), using the "
                    "ORIGINAL per-page camera captures (dictionaryofcolo0000aloy_orig_jp2.tar), not IA's own "
                    "desaturated derivative. See research/MAERZ-PAUL.md for the source search and "
                    "research/LIBRARY.md s9 for the extraction method and tools/maerz_paul.py's module "
                    "docstring for the full detail."),
    "_built": "tools/maerz_paul.py",
    "_fields": "n=name (OCR'd off the plate's own key page), plate=1-56 (2 missing from this scan), "
               "col=A-L, row=1-12, h=hex (approximate, measured+white-balanced from the raw plate scan), note",
}


# ---------------------------------------------------------------------------------------------
# Spelling correction against the ISCC-NBS name dictionary. plausible_name() only checks a token's SHAPE
# (capitalized word, ALL-CAPS word, superscript code), which can't catch a truncation that still looks like
# a real word -- OCR dropping a plate's leading or trailing letter ("AUPE" for "Taupe", "Briarwoc" for
# "Briarwood", "CARLET" for "Scarlet"). The ISCC-NBS dictionary (data/sources/iscc-nbs-names.json) sources
# ~3,300 of its own names to "M" (Maerz & Paul) -- drawn from this exact book -- so it doubles as an
# independent spelling authority for it. Only SINGLE-WORD names are corrected: a multi-word OCR result
# ending in a short suffix ("Carnival R", "Clove Pk") is usually the book's own color-family abbreviation,
# not an OCR error, and "fixing" it against a dictionary entry that happens to spell the suffix out in full
# ("CarnivalRed") would replace a correct transcription with a wrong one. A correction is only applied when
# the OCR'd name and the candidate are a clean substring of one another (one is the other with up to 3
# characters trimmed off either end) and the match is unique -- catches real truncations, not a merely
# similarly-spelled but different word (an early, unconstrained difflib pass wrongly turned "Martius" into
# "Maris"; the substring rule rejects that pair since neither contains the other).
# ---------------------------------------------------------------------------------------------
def mp_candidate_names():
    sys.path.insert(0, str(ROOT / "tools"))
    import library as L
    names_path = ROOT / "data" / "sources" / "iscc-nbs-names.json"
    rows = [json.loads(l) for l in names_path.read_text(encoding="utf-8").splitlines()[1:] if l.strip()]
    return sorted({r["n"] for r in rows if "M" in r.get("src", [])}), L


def correct_spelling(all_rows):
    candidates, L = mp_candidate_names()
    by_key = {}
    for c in candidates:
        by_key.setdefault(L.key(c), c)
    cand_norm = [(re.sub(r"[^a-z]", "", c.lower()), c) for c in candidates]
    n_fixed = 0
    for r in all_rows:
        if " " in r["n"] or L.key(r["n"]) in by_key:
            continue  # multi-word (suffix codes are legitimate), or already an exact dictionary match
        norm = re.sub(r"[^a-z]", "", r["n"].lower())
        if len(norm) < 3:
            continue
        # The candidate must be as long or longer: OCR drops characters (truncation), it practically never
        # invents extra ones, so the fix direction is always "fill in what OCR lost," never "trim down."
        # Without this, a correct long OCR read like "Hudson" could wrongly collapse to a short, less
        # informative ISCC-NBS fragment entry like "son" just because it's a substring.
        hits = [c for cn, c in cand_norm
                if cn != norm and len(norm) <= len(cn) <= len(norm) + 3 and norm in cn]
        uniq = {L.key(h) for h in hits}
        if len(uniq) == 1:
            fixed = hits[0]
            r["note"] += f"; OCR {r['n']!r} corrected to {fixed!r} against the ISCC-NBS 1955 Maerz & Paul name list"
            r["n"] = fixed
            n_fixed += 1
    return n_fixed


ISCC_FLAG_DE = 20.0  # CIEDE2000 to the assigned ISCC-NBS block centroid beyond which a chip is flagged
                      # "uncertain" rather than dropped -- about 2.5x this library's own ISCC_DE=8 "near"
                      # threshold (tools/library.py), i.e. clearly outside normal block-width noise. See
                      # research/MAERZ-PAUL.md s6 for the distribution this was picked from (13% of the
                      # 322-chip cross-checked sample exceeds it).


def _write(all_rows):
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        f.write(json.dumps(PROVENANCE, ensure_ascii=False) + "\n")
        for r in all_rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")


def build():
    ensure_raw()
    all_rows = []
    missing = []
    for n in PLATES:
        try:
            rows = extract_plate(n)
        except Exception as e:
            print(f"plate {n}: FAILED ({e})", file=sys.stderr)
            missing.append(n)
            continue
        all_rows.extend(rows)
        print(f"plate {n}: {len(rows)} named chips")
    _write(all_rows)
    print(f"\n{len(all_rows)} named chips across {len(PLATES)} plates "
          f"(plate(s) {sorted(MISSING_PLATES)} missing from the scan; {len(missing)} plate(s) failed to process)")

    n_fixed = correct_spelling(all_rows)
    _write(all_rows)
    print(f"spelling correction against the ISCC-NBS Maerz & Paul name list: {n_fixed} names corrected")

    # Independent check + uncertainty flag: see research/MAERZ-PAUL.md s5-6 and iscc_check() above.
    try:
        results, agree, med, worst = iscc_check()
        flagged = {(r["plate"], r["col"], r["row"]): r["de00"] for r in results if r["de00"] > ISCC_FLAG_DE}
        for r in all_rows:
            d = flagged.get((r["plate"], r["col"], r["row"]))
            if d is not None:
                r["uncertain"] = (f"dE00 {d:.0f} from its ISCC-NBS 1955 block centroid (block "
                                   f"{next(x['block'] for x in results if x['plate']==r['plate'] and x['col']==r['col'] and x['row']==r['row'])}"
                                   f"); see research/MAERZ-PAUL.md s6")
        _write(all_rows)
        print(f"iscc-nbs cross-check: {len(results)} of {len(all_rows)} chips also ISCC-NBS-sourced to "
              f"Maerz & Paul; {agree:.0f}% agree (dE00<=8) with their assigned block, median dE00 {med:.2f}, "
              f"{len(flagged)} flagged uncertain (dE00 > {ISCC_FLAG_DE})")
    except Exception as e:
        print(f"iscc-nbs cross-check skipped: {e}", file=sys.stderr)

    print(f"wrote {OUT} ({OUT.stat().st_size / 1024:.0f} KB)")
    return all_rows


def load_rows():
    lines = OUT.read_text(encoding="utf-8").splitlines()
    return [json.loads(l) for l in lines[1:] if l.strip()]


# ---------------------------------------------------------------------------------------------
# Independent check: the ISCC-NBS dictionary (data/sources/iscc-nbs-names.json) sources many of its own
# names to "M" (Maerz & Paul) from the real physical chips -- for every one of our names that also appears
# there, how close does OUR measurement land to that name's assigned ISCC-NBS block centroid? Used to (a)
# sanity-check the whole extraction against an independent 1955 source and (b) fit PAPER_GAMMA above.
# See research/MAERZ-PAUL.md s5-6 for the result.
# ---------------------------------------------------------------------------------------------
def iscc_lookup():
    sys.path.insert(0, str(ROOT / "tools"))
    import library as L  # noqa: local import -- avoids a hard dependency for callers that don't need it
    names_path = ROOT / "data" / "sources" / "iscc-nbs-names.json"
    cent_path = ROOT / "data" / "sources" / "iscc-nbs-centroids.json"
    names = [json.loads(l) for l in names_path.read_text(encoding="utf-8").splitlines()[1:] if l.strip()]
    centroids = {json.loads(l)["block"]: json.loads(l)["hex"]
                 for l in cent_path.read_text(encoding="utf-8").splitlines()[1:] if l.strip()}
    out = {}
    for r in names:
        if "M" in r.get("src", []):
            out[L.key(r["n"])] = (r["block"], centroids.get(r["block"]))
    return out, L


def _plate_color(cache, plate):
    if plate not in cache:
        _, color_leaf = leaf_for(plate)
        im = oriented(color_leaf)
        pb = page_bbox(im)
        gb = grid_bbox(im, pb)
        margin = margin_sample(im, pb, gb)
        cache[plate] = (im, gb, margin)
    return cache[plate]


def ground_truth_chips():
    """Every shipped name that the ISCC-NBS dictionary also sources to Maerz & Paul, re-sampled for its RAW
    (pre-white-balance) RGB plus its plate's margin RGB -- the ground truth for both the ISCC-NBS check and
    the PAPER_GAMMA fit. Cheap: re-samples only the matched cells, not a full plate re-OCR."""
    lookup, L = iscc_lookup()
    rows = load_rows()
    cache = {}
    out = []
    for r in rows:
        k = L.key(r["n"])
        if k not in lookup:
            continue
        block, chex = lookup[k]
        if chex is None:
            continue
        im, gb, margin = _plate_color(cache, r["plate"])
        ci, ri = COLS.index(r["col"]), r["row"] - 1
        raw = sample_color(im, cell_box(gb, ci, ri))
        out.append({"n": r["n"], "plate": r["plate"], "col": r["col"], "row": r["row"],
                     "raw": raw, "margin": margin, "block": block, "centroid": chex})
    return out, L


def fit_gamma(gammas=None):
    gt, L = ground_truth_chips()
    if gammas is None:
        gammas = [round(x * 0.25, 2) for x in range(0, 17)]  # 0.0 .. 4.0
    report = []
    for g in gammas:
        des = [float(L.de2000(L.labs([rgb_to_hex(white_balance(c["raw"], c["margin"], gamma=g))]),
                               L.labs([c["centroid"]]))[0, 0]) for c in gt]
        report.append((g, float(np.median(des)), float(np.mean(des))))
    best = min(report, key=lambda t: t[1])
    return best, report, gt, L


def iscc_check(gamma=None, near=8.0):
    gt, L = ground_truth_chips()
    g = PAPER_GAMMA if gamma is None else gamma
    results = []
    for c in gt:
        h = rgb_to_hex(white_balance(c["raw"], c["margin"], gamma=g))
        de = float(L.de2000(L.labs([h]), L.labs([c["centroid"]]))[0, 0])
        Lc = _lab_L(c["raw"])
        results.append({"n": c["n"], "plate": c["plate"], "col": c["col"], "row": c["row"],
                         "block": c["block"], "centroid": c["centroid"], "h": h, "de00": de, "L": Lc})
    des = np.array([r["de00"] for r in results])
    agree = float(np.mean(des <= near)) * 100
    med = float(np.median(des))
    worst = sorted(results, key=lambda r: -r["de00"])[:20]
    return results, agree, med, worst


if __name__ == "__main__":
    args = sys.argv[1:]
    if "--plate" in args:
        n = int(args[args.index("--plate") + 1])
        ensure_raw()
        rows = extract_plate(n, verbose="-v" in args)
        print(f"plate {n}: {len(rows)} named chips")
    elif "--spotcheck" in args:
        import random
        k = int(args[args.index("--spotcheck") + 1])
        rows = load_rows()
        random.seed(7)
        for r in random.sample(rows, min(k, len(rows))):
            print(f"{r['n']!r:30s} {r['h']}  plate {r['plate']} {r['col']}{r['row']}")
    elif "--fit-gamma" in args:
        best, report, gt, L = fit_gamma()
        print(f"{len(gt)} ground-truth chips (shipped name also ISCC-NBS-sourced to Maerz & Paul)")
        for g, med, mean in report:
            print(f"  gamma {g:4.2f}: median dE00 {med:5.2f}  mean {mean:5.2f}")
        print(f"best: gamma={best[0]} median dE00={best[1]:.2f}")
    elif "--iscc-check" in args:
        gamma = None
        if "--gamma" in args:
            gamma = float(args[args.index("--gamma") + 1])
        results, agree, med, worst = iscc_check(gamma=gamma)
        print(f"{len(results)} chips checked against their ISCC-NBS block centroid "
              f"(gamma={PAPER_GAMMA if gamma is None else gamma})")
        print(f"agreement (dE00 <= 8): {agree:.0f}%   median dE00: {med:.2f}")
        print("worst 20:")
        for r in worst:
            print(f"  {r['n']!r:28s} plate {r['plate']:3d} {r['col']}{r['row']:<3d} h={r['h']}  "
                  f"block {r['block']:3d} centroid={r['centroid']}  dE00={r['de00']:.1f}")
    else:
        build()
