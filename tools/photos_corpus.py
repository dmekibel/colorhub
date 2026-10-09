#!/usr/bin/env python3
"""ColorHub color-photography corpus: public-domain / CC0 COLOR photographs (Prokudin-Gorsky, FSA/OWI Kodachrome,
autochromes...), built the same way as the painting corpus (tools/corpus.py, imported here for its network, image,
k-means and color math) and the design corpus (tools/design_corpus.py). Sources, licenses and the "why Commons, not
loc.gov" explanation: research/PHOTOGRAPHY.md. Everything resumable, cached under research/_raw/photod/ (gitignored).

  python3 tools/photos_corpus.py meta [--resume]     # 1. candidate files -> research/_raw/photod/meta.json
  python3 tools/photos_corpus.py images              # 2. one ~200px image per candidate (cached, skipped if present)
  python3 tools/photos_corpus.py palettes             # 3. 6-color k-means palette + mono/color test -> research/_raw/photo-palettes.jsonl
  python3 tools/photos_corpus.py build                # 4. name the colors, drop black-and-white/sepia, write data/photography/*.json
  python3 tools/photos_corpus.py photographers        # 5. per-photographer stats (Phase 2) -> data/photography/photographers.json
  python3 tools/photos_corpus.py colorindex            # 6. the finer per-pixel index (Phase 2) -> data/photography/colorindex/ ("In photographs")
  python3 tools/photos_corpus.py status               # what is cached so far
  python3 tools/photos_corpus.py all [--resume]        # 1-6 in order
  python3 tools/photos_corpus.py sheet [N] [out.png] [seed]  # contact sheet: image | palette | names

Color/B&W exclusion (per David: "except black-and-white photos, since this app is about color"): a metadata-only
filter is not reliable (many true autochromes and Kodachromes have titles that say nothing about color, and a few
"Autochromes" plates have faded to near-monochrome), so every candidate's real downloaded pixels get the final say,
run the same way tools/corpus.py already drops a black-and-white photograph of a painting (BW_C, mean CIELAB
chroma). Two tests, both against the 6-cluster palette's pixel-weighted mean:
  - mean chroma C* < MONO_C: true grayscale (no color information at all).
  - mean chroma C* < TINT_C *and* the clusters' hues cluster within TINT_HUE_SPREAD degrees of each other (a
    circular spread, weighted by share): a single-hue wash -- sepia, a faded or heavily color-shifted scan,
    cyanotype blue -- which is a toned monochrome, not a color photograph, even though C* alone would not catch it.
A photograph that passes both is still "as scanned": old dyes fade and shift, scanners differ, and the published
caveat on every photography page must say so (the same caveat the painting and design corpora already carry).

Needs Python 3 with Pillow and numpy only.
"""
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
import corpus as C  # noqa: E402
from museums import photod  # noqa: E402

RAW = C.RAW
OUT = ROOT / "data" / "photography"
PAL = RAW / "photo-palettes.jsonl"
SRC = "photod"
C.ADAPTERS[SRC] = photod
C.SRC[SRC] = dict(dir=RAW / SRC, **photod.INFO)

MONO_C = 2.0     # mean chroma below this: no real color signal, a plain black-and-white scan
TINT_C = 14.0    # mean chroma below this AND...
TINT_HUE_SPREAD = 20.0  # ...clusters within this many degrees of each other: a single-hue tint (sepia/cyanotype)


def _hue_circ_spread(h_deg, w):
    """Weighted circular spread (0-180) of hue angles in degrees: the angular radius of the smallest arc that
    holds (nearly) all the weight, approximated via the resultant vector length (R=1 -> spread 0, R=0 -> spread 180)."""
    rad = np.radians(h_deg)
    w = w / w.sum()
    R = np.hypot((w * np.cos(rad)).sum(), (w * np.sin(rad)).sum())
    R = min(max(R, 0), 1)
    return float(np.degrees(np.arccos(R)))


def classify_color(lab, share):
    """(is_color, mean_chroma, hue_spread) from a palette's cluster Lab means and shares."""
    lab = np.asarray(lab, dtype=np.float64)
    share = np.asarray(share, dtype=np.float64)
    L, Ch, H = C.lch(lab)
    mean_c = float((Ch * share).sum())
    spread = _hue_circ_spread(H, share * np.clip(Ch, 0.1, None))  # near-neutral clusters barely vote on hue
    if mean_c < MONO_C:
        return False, mean_c, spread
    if mean_c < TINT_C and spread < TINT_HUE_SPREAD:
        return False, mean_c, spread
    return True, mean_c, spread


# ---------------------------------------------------------------------------------------------
def cmd_meta(resume):
    photod.meta(C, resume)


def cmd_images():
    meta = C.load_meta(SRC)["rows"]
    print(f"photos_corpus: {len(meta)} candidate files, fetching images", flush=True)
    import threading
    from concurrent.futures import ThreadPoolExecutor
    (C.SRC[SRC]["dir"] / "img").mkdir(parents=True, exist_ok=True)
    failed_p = C.SRC[SRC]["dir"] / "failed.json"
    failed = {}
    lock = [threading.Lock()]
    # each row's stable key is its Commons file title (no numeric museum id here), made filesystem-safe
    todo = [x for x in meta if not (C.SRC[SRC]["dir"] / "img" / (_safe_id(x) + ".jpg")).exists()]
    print(f"photos_corpus: {len(todo)} images to fetch", flush=True)
    done = [0]

    def one(x):
        p = C.SRC[SRC]["dir"] / "img" / (_safe_id(x) + ".jpg")
        try:
            data = C.fetch(SRC, x["thumb"], binary=True)
            im = Image.open(__import__("io").BytesIO(data)).convert("RGB")
            if im.width > C.IMG_W:
                im = im.resize((C.IMG_W, max(1, round(im.height * C.IMG_W / im.width))), Image.LANCZOS)
            im.save(p, "JPEG", quality=92)
        except Exception as e:
            with lock[0]:
                failed[_safe_id(x)] = str(e)[:200]
                failed_p.write_text(json.dumps(failed, indent=0))
            return
        with lock[0]:
            done[0] += 1
            if done[0] % 100 == 1:
                print(f"photos_corpus images {done[0]}/{len(todo)}", flush=True)

    with ThreadPoolExecutor(photod.INFO["workers"]) as ex:
        list(ex.map(one, todo))
    print(f"photos_corpus: images done, {len(failed)} failed", flush=True)


def _safe_id(x):
    return re.sub(r"\W+", "_", x["title"].split(":", 1)[-1])[:70]


def cmd_palettes(workers=6):
    meta = {_safe_id(x): x for x in C.load_meta(SRC)["rows"]}
    done = set()
    if PAL.exists():
        for line in PAL.read_text().splitlines():
            if line.strip():
                done.add(json.loads(line)["key"])
    jobs = []
    for key, x in meta.items():
        p = C.SRC[SRC]["dir"] / "img" / f"{key}.jpg"
        if p.exists() and key not in done:
            jobs.append((key, str(p)))
    print(f"photos_corpus: {len(done)} palettes cached, {len(jobs)} to compute", flush=True)
    if not jobs:
        return
    from multiprocessing import Pool
    with Pool(workers) as pool, PAL.open("a") as f:
        for i, (key, res, err) in enumerate(pool.imap_unordered(_palette_job, jobs, chunksize=8)):
            if err:
                print(f"   {key}: {err}", flush=True)
                continue
            res["key"] = key
            f.write(json.dumps(res) + "\n")
            if i % 200 == 0:
                f.flush()
                print(f"photos_corpus palettes {i + 1}/{len(jobs)}", flush=True)


def _palette_job(args):
    key, path = args
    try:
        res = C.palette_of(path)
        return key, res, None
    except Exception as e:
        return key, None, str(e)


def load_photo_palettes():
    out = {}
    if PAL.exists():
        for line in PAL.read_text().splitlines():
            if line.strip():
                r = json.loads(line)
                out[r["key"]] = r
    return out


DECADE_MIN_PROCESS = {"poster": None}


def cmd_build():
    app = C.app_names()
    app_lab = C.rgb_to_lab(np.array([C.hex_to_rgb(h) for _, h in app]))
    pals = load_photo_palettes()
    meta = C.load_meta(SRC)["rows"]
    rows, dropped_mono, dropped_tint, dropped_other = [], 0, 0, 0
    by_process, by_decade, by_source_cat = Counter(), Counter(), Counter()
    photographers = Counter()
    for x in meta:
        key = _safe_id(x)
        p = pals.get(key)
        if not p:
            dropped_other += 1
            continue
        is_color, mean_c, spread = classify_color(p["lab"], p["share"])
        if not is_color:
            if mean_c < MONO_C:
                dropped_mono += 1
            else:
                dropped_tint += 1
            continue
        try:
            r = photod.norm(C, x)
        except Exception as e:
            print(f"   build: skipped {key}: {e}", flush=True)
            continue
        rgbs = C.lab_to_rgb(np.array(p["lab"]))
        exact = C.rgb_to_lab(rgbs)
        V = C.de2000(exact, app_lab).argmin(1)
        Ls, Cs, Hs = C.lch(exact)
        shares = [round(s, 3) for s in p["share"]]
        if shares:
            shares[0] = round(shares[0] + 1 - sum(shares), 3)
        r["p"] = [[C.rgb_to_hex(rgbs[i]), shares[i], app[V[i]][0], C.family(Ls[i], Cs[i], Hs[i])]
                  for i in range(len(shares))]
        r["L"], r["C"] = round(p["L"], 1), round(mean_c, 1)
        rows.append(r)
        by_process[r.get("process") or "unknown"] += 1
        if r.get("y"):
            by_decade[r["y"] // 10 * 10] += 1
        by_source_cat[r.get("category") or ""] += 1
        if r.get("a"):
            photographers[r["a"]] += 1
    rows.sort(key=lambda r: (r.get("y") if r.get("y") is not None else 99999, r["id"]))
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "photos.json").write_text(json.dumps(rows, ensure_ascii=False))
    summary = dict(
        total_candidates=len(meta), kept=len(rows),
        dropped_black_and_white=dropped_mono, dropped_toned_monochrome=dropped_tint, dropped_other=dropped_other,
        by_process=dict(by_process.most_common()),
        by_decade=dict(sorted(by_decade.items())),
        by_source_category=dict(by_source_cat.most_common(30)),
        top_photographers=dict(photographers.most_common(30)),
        thresholds=dict(mono_c=MONO_C, tint_c=TINT_C, tint_hue_spread=TINT_HUE_SPREAD),
    )
    (OUT / "index.json").write_text(json.dumps(summary, ensure_ascii=False, indent=0))
    print(f"photos_corpus build: {len(rows)} color photographs kept of {len(meta)} candidates "
          f"({dropped_mono} dropped as black-and-white, {dropped_tint} as toned/near-monochrome, "
          f"{dropped_other} missing a palette)", flush=True)
    print(json.dumps(summary, indent=2), flush=True)
    return rows, summary


PHOTOGRAPHER_MIN_N = 3   # a photographer needs at least this many kept photos before statistics are published


def _slug(s):
    s = re.sub(r"[̀-ͯ]", "", __import__("unicodedata").normalize("NFKD", s))
    return re.sub(r"^-+|-+$", "", re.sub(r"[^a-z0-9]+", "-", s.lower()))


def cmd_photographers():
    """Per-photographer statistics (Phase 2, like a simplified painter page: artwiki.js's own "percentile among
    painters" idea, scaled down to what this corpus can honestly support). Written to
    data/photography/photographers.json: [{slug, name, n, processes, decades, countries, meanL, meanC, vivid,
    pctDarker, pctDuller, typical, leastTypical}]. The comparison pool is OTHER PHOTOGRAPHERS' own means, each
    counted once regardless of how many photos they have, so a photographer with 1,200 surviving plates
    (Prokudin-Gorsky) cannot skew what "typical" means for the group."""
    rows = json.loads((OUT / "photos.json").read_text())
    by = defaultdict(list)
    for r in rows:
        if r.get("a"):
            by[r["a"]].append(r)
    groups = {a: rs for a, rs in by.items() if len(rs) >= PHOTOGRAPHER_MIN_N}
    print(f"photographers: {len(by)} distinct names, {len(groups)} with >= {PHOTOGRAPHER_MIN_N} kept photos", flush=True)

    def vivid_share(r):
        tot = 0.0
        for hexv, share, name, fam in r["p"]:
            rgb = C.hex_to_rgb(hexv)
            lab = C.rgb_to_lab(np.array([rgb]))[0]
            _, Cc, _ = C.lch(lab[None, :])
            if float(Cc[0]) >= 40:
                tot += share
        return tot

    stats = {}
    for a, rs in groups.items():
        Ls, Cs = np.array([r["L"] for r in rs]), np.array([r["C"] for r in rs])
        vivids = np.array([vivid_share(r) for r in rs])
        meanL, meanC, meanV = float(Ls.mean()), float(Cs.mean()), float(vivids.mean())
        d = np.hypot(Ls - meanL, (Cs - meanC) * 1.2)   # a simple (L*, C*) distance; chroma weighted up a touch
        typical, least_typical = rs[int(d.argmin())]["id"], rs[int(d.argmax())]["id"]
        stats[a] = dict(name=a, n=len(rs), meanL=round(meanL, 1), meanC=round(meanC, 1), vivid=round(meanV, 4),
                        typical=typical, leastTypical=least_typical,
                        processes=Counter(r.get("process") or "unknown" for r in rs).most_common(),
                        decades=sorted(Counter((r["y"] // 10 * 10) for r in rs if r.get("y")).items()),
                        countries=Counter(r.get("co") or "unknown" for r in rs if r.get("co")).most_common(10))
    allL = sorted(s["meanL"] for s in stats.values())
    allC = sorted(s["meanC"] for s in stats.values())
    pct = lambda arr, v: round(100 * sum(1 for x in arr if x < v) / max(1, len(arr) - 1), 1) if len(arr) > 1 else 50.0
    out = []
    for a, s in stats.items():
        out.append(dict(s, slug=_slug(a), peers=len(stats),
                        pctDarker=round(100 - pct(allL, s["meanL"]), 1),   # % of photographers LIGHTER than this one, i.e. "darker than N%"
                        pctDuller=round(pct(allC, s["meanC"]), 1)))        # % of photographers DULLER (lower chroma) than this one
    out.sort(key=lambda s: -s["n"])
    (OUT / "photographers.json").write_text(json.dumps(out, ensure_ascii=False))
    print(f"photographers: wrote {len(out)} photographer pages ({PHOTOGRAPHER_MIN_N}+ photos each)", flush=True)
    return out


def cmd_colorindex():
    """data/photography/colorindex/: the finer per-pixel-cell color index (tools/color_index.py --items), the
    same mechanism the main design corpus already uses (CI_SOURCES.design in js/colorindex.js), so "In
    photographs" appears next to "In paintings" on any color page for free once js/colorindex.js lists this
    source. Palette-only (every photograph is `coarse`): the 200px analysis copy is already a k-means summary,
    not a full pixel histogram, so this is the honest resolution to index at, same call shape as build_design()."""
    rows = json.loads((OUT / "photos.json").read_text())
    items = [{"id": r["id"], "y": r.get("y"), "a": r.get("a"), "mv": r.get("process"), "co": r.get("co"),
              "colors": [[c[0], c[1]] for c in r["p"]]} for r in rows]
    idx_p = OUT / "colorindex"
    idx_p.mkdir(parents=True, exist_ok=True)
    tmp = idx_p / "_items.json"
    tmp.write_text(json.dumps(items))
    import subprocess
    subprocess.run([sys.executable, str(ROOT / "tools" / "color_index.py"), "--items", str(tmp),
                    "--out", str(idx_p), "--label", "Photography", "--item-name", "photograph"], check=True)
    tmp.unlink()
    tiles = [[r["id"], r["t"], r.get("a") or "", r.get("y"), r.get("process") or "", r["img"]] for r in rows]
    (idx_p / "items.json").write_text(json.dumps(tiles, ensure_ascii=False, separators=(",", ":")))
    h = json.loads((idx_p / "index.json").read_text())
    h["items"] = "items.json"
    (idx_p / "index.json").write_text(json.dumps(h, separators=(",", ":")))
    print(f"colorindex: {len(items)} photographs indexed -> {idx_p}", flush=True)


def cmd_status():
    meta = C.load_meta(SRC)["rows"] if (C.SRC[SRC]["dir"] / "meta.json").exists() else []
    n_img = len(list((C.SRC[SRC]["dir"] / "img").glob("*.jpg"))) if (C.SRC[SRC]["dir"] / "img").exists() else 0
    n_pal = len(load_photo_palettes())
    n_built = len(json.loads((OUT / "photos.json").read_text())) if (OUT / "photos.json").exists() else 0
    print(f"photod: {len(meta)} candidate files meta, {n_img} images cached, {n_pal} palettes, {n_built} built rows")


def cmd_sheet(n=24, out="research/_raw/photo-sheet.png", seed=1):
    import random
    rows = json.loads((OUT / "photos.json").read_text()) if (OUT / "photos.json").exists() else []
    if not rows:
        print("no built rows yet; run build first")
        return
    random.Random(int(seed)).shuffle(rows)
    rows = rows[:int(n)]
    cell = 220
    cols = 6
    grid_rows = (len(rows) + cols - 1) // cols
    from PIL import ImageDraw
    sheet = Image.new("RGB", (cols * cell, grid_rows * cell), "white")
    draw = ImageDraw.Draw(sheet)
    for i, r in enumerate(rows):
        cx, cy = (i % cols) * cell, (i // cols) * cell
        key = r["id"].replace("photod-", "")
        img_p = C.SRC[SRC]["dir"] / "img" / f"{key}.jpg"
        if img_p.exists():
            im = Image.open(img_p).convert("RGB")
            im.thumbnail((cell - 10, cell - 60))
            sheet.paste(im, (cx + 5, cy + 5))
        x0 = cx + 5
        for hexv, share, name, fam in r.get("p", []):
            w = max(2, round(share * (cell - 10)))
            draw.rectangle([x0, cy + cell - 50, x0 + w, cy + cell - 30], fill=hexv)
            x0 += w
        draw.text((cx + 5, cy + cell - 20), f"{r.get('t', '')[:28]}", fill="black")
    Path(out).parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out)
    print(f"wrote {out}")


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "all"
    resume = "--resume" in sys.argv
    if cmd == "meta":
        cmd_meta(resume)
    elif cmd == "images":
        cmd_images()
    elif cmd == "palettes":
        cmd_palettes()
    elif cmd == "build":
        cmd_build()
    elif cmd == "photographers":
        cmd_photographers()
    elif cmd == "colorindex":
        cmd_colorindex()
    elif cmd == "status":
        cmd_status()
    elif cmd == "sheet":
        args = [a for a in sys.argv[2:] if a != "--resume"]
        cmd_sheet(*args)
    elif cmd == "all":
        cmd_meta(resume)
        cmd_images()
        cmd_palettes()
        cmd_build()
        cmd_photographers()
        cmd_colorindex()
    else:
        print(__doc__)
