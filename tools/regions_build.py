#!/usr/bin/env python3
"""ColorHub painting regions (Option A, the classical-CV region segmentation evaluated for the palette-engine
lane, 2026-10-09): SLIC superpixels + region-adjacency-graph color merging (scikit-image), giving each painting
a handful of coherent, tappable color regions -- "the dress", "the sky" -- without a downloaded ML model.

  python3 tools/regions_build.py [--raw DIR] [--limit N] [--workers N]

Reads the same cached museum images as tools/gallery.py's extract_pool() (research/_raw/<src>/img/<id>.jpg,
the same crop boxes). Writes data/regions/d/NNN.json, one shard per 100 paintings, SAME shard/order as
data/gallery/d/NNN.json (GAL.SHARD, gallery order) so the client can fetch "this painting's regions" with the
same index math it already uses for its own detail shard.

Per painting: a label grid (GRID_SIDE long side, nearest-neighbor downsampled from the merge result, RLE'd) and,
per surviving region (>= MIN_REGION_SHARE of the canvas), its own small pool (medoid colors + shares, same
4-byte pack_pool() scheme tools/gallery.py already uses, so js/gallery.js's existing glPoolDecode() reads it
unchanged) and its area share of the whole canvas. A painting with no cached image, or whose merge produces no
region clearing the floor, gets null (and the client just doesn't offer the Region tool for it).

Labels stay honest: "this area", never a guessed name. A Background-vs-Figure split was evaluated (region
centroid distance from the image center + how much of its pixels sit within the outer 4% border) and DROPPED --
tested against Gari Melchers' "Maternity", Madrazo's "Diane" and Vermeer's "Girl with the Red Hat": a background
that wraps around a centered figure has a centroid that is ALSO near-center (so the heuristic calls a 75%-of-
the-canvas background "the figure"), and unsupervised color segmentation naturally splits one person into
several same-colored pieces (skin, hair, one garment) rather than a single "figure" blob, so even a correct
center/border read would at best label a stray patch of skin, not the subject. Not reliable enough to ship; the
"this area" default stays honest instead. Re-evaluate with real position/pose data (a pose or saliency model) if
this is wanted later -- out of scope for the classical-CV pass.
"""
import argparse, base64, json, math, sys, time
from pathlib import Path

import numpy as np
from PIL import Image
from skimage import segmentation, graph

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
import gallery as GAL  # noqa: E402  crop_image, img_cache_path, _srgb_to_lin, _oklab_fwd, _ok_hex, pack_pool, load_corpus, SHARD

OUT = ROOT / "data" / "regions"
WORK_SIDE = 500        # long side of the copy SLIC/merge run on (matches the Option A prototype's own benchmark)
GRID_SIDE = 64          # long side of the stored label grid (RLE'd, so a blobby region costs very few bytes)
N_SEGMENTS = 220        # SLIC's initial over-segmentation target
COMPACTNESS = 12
MERGE_THRESH = 45       # RAG color-distance merge threshold (the Option A prototype's tuned value)
MIN_REGION_SHARE = .01  # a region under 1% of the canvas is a sliver, not a tappable region
REGION_POOL_K = 8       # colors kept per region's own pool


def weight_mean_color(g, src, dst, n):
    diff = g.nodes[dst]["mean color"] - g.nodes[n]["mean color"]
    return {"weight": np.linalg.norm(diff)}


def merge_mean_color(g, src, dst):
    g.nodes[dst]["total color"] += g.nodes[src]["total color"]
    g.nodes[dst]["pixel count"] += g.nodes[src]["pixel count"]
    g.nodes[dst]["mean color"] = g.nodes[dst]["total color"] / g.nodes[dst]["pixel count"]


def region_pool(px_ok, idxs, k=REGION_POOL_K):
    """A small pool (medoid colors + shares) for one region's own pixels -- same medoid-snap honesty rule as
    tools/gallery.py's extract_pool() ("never pick muddy averages"), just scoped and smaller."""
    sub = px_ok[idxs]
    n = len(sub)
    if n == 0:
        return []
    kk = min(k, max(1, n // 20))
    rng = np.random.RandomState(7)
    if n <= kk:
        C = sub.copy()
    else:
        C = sub[rng.choice(n, kk, replace=False)]
        for _ in range(8):
            d2 = ((sub[:, None, :] - C[None, :, :]) ** 2).sum(-1)
            lab = d2.argmin(1)
            C = np.array([sub[lab == j].mean(0) if np.any(lab == j) else C[j] for j in range(len(C))])
    d2 = ((sub[:, None, :] - C[None, :, :]) ** 2).sum(-1)
    lab = d2.argmin(1)
    out = []
    for j in range(len(C)):
        members = np.nonzero(lab == j)[0]
        if not len(members):
            continue
        mean = sub[members].mean(0)
        medoid_i = members[int(np.argmin(((sub[members] - mean) ** 2).sum(1)))]
        out.append((GAL._ok_hex(sub[medoid_i]), len(members) / n))
    out.sort(key=lambda x: -x[1])
    return out


def rle_encode(flat):
    """[label,label,label,...] -> bytes of (label, runlen<=255) pairs. Decoded by js/paintzoom.js's own mirror."""
    out = bytearray()
    i, n = 0, len(flat)
    while i < n:
        v = int(flat[i])
        j = i + 1
        while j < n and flat[j] == v and j - i < 255:
            j += 1
        out.append(v & 0xFF)
        out.append(j - i)
        i = j
    return bytes(out)


def build_regions(path, crop=None):
    im = GAL.crop_image(Image.open(path).convert("RGB"), crop)
    w0, h0 = im.size
    sc = min(1.0, WORK_SIDE / max(w0, h0))
    if sc < 1.0:
        im = im.resize((max(1, round(w0 * sc)), max(1, round(h0 * sc))), Image.LANCZOS)
    arr = np.asarray(im)
    w, h = im.size
    if w < 8 or h < 8:
        return None
    segs = segmentation.slic(arr, n_segments=N_SEGMENTS, compactness=COMPACTNESS, sigma=1, start_label=1)
    g = graph.rag_mean_color(arr, segs)
    merged = graph.merge_hierarchical(segs, g, thresh=MERGE_THRESH, rag_copy=False, in_place_merge=True,
                                       merge_func=merge_mean_color, weight_func=weight_mean_color)

    lin = GAL._srgb_to_lin(arr.astype(np.float64))
    px_ok = GAL._oklab_fwd(lin[..., 0], lin[..., 1], lin[..., 2]).reshape(-1, 3)
    flat = merged.flatten()
    N = len(flat)
    uniq, counts = np.unique(flat, return_counts=True)
    kept = [(u, c) for u, c in zip(uniq, counts) if c / N >= MIN_REGION_SHARE]
    if not kept:
        return None
    kept.sort(key=lambda x: -x[1])
    remap = {int(u): i + 1 for i, (u, c) in enumerate(kept)}  # compact ids 1..n
    # Every sub-floor sliver (a merged segment under MIN_REGION_SHARE on its own -- common in finely textured
    # areas, like dappled foliage, that fragment into many small same-ish-color pieces) folds into its nearest
    # KEPT region by mean color, rather than being left unlabeled. Tested on "The Watermill with the Great Red
    # Roof": leaving slivers as 0 ("no region") left real, sizeable gaps a tap would just do nothing on --
    # exactly the textured areas someone is most likely to try tapping. A tap should always land somewhere.
    # Mean colors come straight from this painting's own OKLab pixels (px_ok), not graph.RAG node attributes --
    # merge_hierarchical()'s returned label array uses its own fresh ids, not the RAG's original node ids, so
    # g.nodes[label] is not a safe lookup once merging is done.
    all_idxs = {int(u): np.nonzero(flat == u)[0] for u in uniq}
    kept_ids = [int(u) for u, c in kept]
    kept_colors = np.array([px_ok[all_idxs[u]].mean(0) for u in kept_ids])
    for u in uniq:
        iu = int(u)
        if iu in remap:
            continue
        c = px_ok[all_idxs[iu]].mean(0)
        nearest = int(np.argmin(((kept_colors - c) ** 2).sum(1)))
        remap[iu] = nearest + 1
    regions = []
    for i, (u, _cnt) in enumerate(kept):
        idxs_list = [all_idxs[int(u)]]
        # also pull in every sliver now remapped to this kept region, so its pool/area reflect what the grid
        # actually shows (the sliver's pixels are real canvas pixels, not noise -- just too small alone)
        for ou, remapped_to in remap.items():
            if remapped_to == i + 1 and ou != int(u):
                idxs_list.append(all_idxs[ou])
        idxs = np.concatenate(idxs_list)
        pool = region_pool(px_ok, idxs)
        if not pool:
            continue
        regions.append({"a": round(len(idxs) / N, 4), "p": GAL.pack_pool(pool)})
    if not regions:
        return None

    # downsample the (remapped) label grid to the storage grid, nearest-neighbor, then RLE it
    remap_arr = np.vectorize(lambda v: remap.get(int(v), 0))(merged).astype(np.uint8)
    grid_im = Image.fromarray(remap_arr).resize(
        (max(1, round(w * GRID_SIDE / max(w, h))), max(1, round(h * GRID_SIDE / max(w, h)))), Image.NEAREST)
    grid = np.asarray(grid_im)
    rle = base64.b64encode(rle_encode(grid.flatten())).decode("ascii")
    return {"w": int(grid.shape[1]), "h": int(grid.shape[0]), "rle": rle, "regions": regions}


def _job(args):
    key, path, crop = args
    try:
        return key, build_regions(path, crop), None
    except Exception as e:
        return key, None, str(e)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--raw")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--workers", type=int, default=8)
    args = ap.parse_args()

    raw = Path(args.raw) if args.raw else ROOT / "research" / "_raw"
    corpus, _ = GAL.load_corpus()
    if args.limit:
        corpus = corpus[:args.limit]
    print(f"{len(corpus)} paintings", flush=True)

    jobs, no_img = [], 0
    for x in corpus:
        p = GAL.img_cache_path(raw, x["src"], x["id"])
        if p.exists():
            jobs.append((x["id"], str(p), x.get("crop") or None))
        else:
            no_img += 1
    print(f"{len(jobs)} with a cached image, {no_img} without", flush=True)

    results = {}
    t0 = time.time()
    from multiprocessing import Pool
    n_err = 0
    with Pool(args.workers) as pool:
        for i, (key, regions, err) in enumerate(pool.imap_unordered(_job, jobs, chunksize=8)):
            if err:
                n_err += 1
                if n_err <= 20:
                    print(f"   ERR {key}: {err}", flush=True)
                continue
            if regions:
                results[key] = regions
            if (i + 1) % 1000 == 0:
                el = time.time() - t0
                rate = (i + 1) / el
                eta = (len(jobs) - (i + 1)) / rate if rate > 0 else 0
                print(f"regions {i + 1}/{len(jobs)}  {el:.0f}s elapsed  ~{eta:.0f}s left  ({n_err} errors, "
                      f"{len(results)} with regions)", flush=True)
    print(f"done in {time.time() - t0:.0f}s, {n_err} errors, {len(results)}/{len(corpus)} paintings with regions", flush=True)

    if OUT.exists():
        import shutil
        shutil.rmtree(OUT)
    (OUT / "d").mkdir(parents=True)
    shard = GAL.SHARD
    total_bytes = 0
    for s0 in range(0, len(corpus), shard):
        chunk = corpus[s0:s0 + shard]
        out = [results.get(x["id"]) for x in chunk]
        p = OUT / "d" / f"{s0 // shard:03d}.json"
        text = json.dumps(out, separators=(",", ":"))
        p.write_text(text)
        total_bytes += len(text)
    (OUT / "index.json").write_text(json.dumps({
        "v": 1, "n": len(corpus), "shard": shard, "withRegions": len(results),
        "params": {"workSide": WORK_SIDE, "gridSide": GRID_SIDE, "nSegments": N_SEGMENTS,
                   "compactness": COMPACTNESS, "mergeThresh": MERGE_THRESH, "minRegionShare": MIN_REGION_SHARE,
                   "regionPoolK": REGION_POOL_K},
    }))
    print(f"data/regions/: {len(results)}/{len(corpus)} paintings, {len(corpus)//shard+1} shards, "
          f"{total_bytes/1e6:.2f} MB total", flush=True)


if __name__ == "__main__":
    main()
