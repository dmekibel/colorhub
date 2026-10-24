#!/usr/bin/env python3
"""Painting-map "By look" arrangement: paintings the picture model finds alike sit together.

  python3 tools/look_layout.py              # build data/gallery/look.bin + look.json from the cached CLIP embeddings
  python3 tools/look_layout.py --sheets     # also write contact sheets of random neighborhoods to design/review-shots/look/
  python3 tools/look_layout.py --islands-only   # keep look.bin, (re)write only look-islands.bin + the islands table in look.json
  python3 tools/look_layout.py --center-source  # the "Reduce photo-format effect" variant: look-reduced.bin, look-islands-reduced.bin, look-reduced.json
  python3 tools/look_layout.py --color=0.3|0.6   # "Color influence" Some / A lot: color features joined to the CLIP vector before PCA/UMAP;
                                                  # writes look-islands-c30.bin + look-c30.json (islands only; the Even grid stays look.bin)
  Measured 2026-10-24 (research notes, not shipped): per-museum centering / dropping the top 2 PCs did NOT reduce same-museum clumping
  among the 10 nearest neighbors (small museums 0.22 -> 0.29 / 0.22), so "Photo-format effect: Reduce" was not shipped.
  (tools/look_islands.py holds the islands layout: clusters, blobs, placement, labels)
  python3 tools/look_layout.py --center-source / --drop-pcs K   # mitigations for museum/scan artifacts (default: see MITIGATE)

Needs the venv at research/_raw/clipenv (numpy, torch, open_clip, umap-learn; NOT in the repo): re-runs itself under it and
exits quietly if the venv or the embeddings are missing, so tools/rebuild_all.sh can call it blindly. Env SUBJECTS_RAW points at
the caches when running from a worktree.

Pipeline (all deterministic: fixed seeds, rank-based tie-breaks)
  1. Embeddings: the 512-d CLIP ViT-B-32 laion2b vectors that tools/subjects_clip.py caches (subjects/clip-embeds.npy). Paintings
     with no cached full image are embedded from their 80 px atlas tile (data/paintmap/g<N>.webp), cached in
     subjects/look-atlas-embeds.* (coarser, but the same model). Anything still without a vector (no image at all) takes its
     painter's mean vector, else the global mean, so it lands next to that painter's work.
  2. PCA(50) -> UMAP(2-D, cosine-ish on the normalized vectors, n_neighbors 15, min_dist 0.05). UMAP keeps neighborhoods.
  3. EVEN GRID: recursive median split. The W x H cell rectangle is cut along its longer side, the point cloud is cut at the
     same proportion along the matching axis, down to single cells. Every painting gets one distinct integer cell, no clumps,
     no overlaps, and points that were close in the cloud stay close (they only separate across a cut line).
  4. data/gallery/look.bin: "LOOK", u32 version, u32 n, u32 W, u32 H, u32 ids-hash, then n x (u16 x, u16 y) in ids.txt order.
     data/gallery/look.json: grid size, method, model, built date, ids hash.
A rebuild with new paintings may move everything (UMAP and the splits are global); that is accepted.
"""
import hashlib, json, os, struct, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = Path(os.environ.get("SUBJECTS_RAW", ROOT / "research" / "_raw"))
VENV_PY = RAW / "clipenv" / "bin" / "python"
CACHE = RAW / "subjects"
EMB, EMB_IDS = CACHE / "clip-embeds.npy", CACHE / "clip-embeds.ids.txt"
ATL, ATL_IDS = CACHE / "look-atlas-embeds.npy", CACHE / "look-atlas-embeds.ids.txt"
SUFFIX = ""
MODEL = "ViT-B-32 laion2b_s34b_b79k"
COLOR_W = 0.0   # "Color influence": weight of the painting's own color features against the unit CLIP vector (0, 0.3, 0.6); set by --color=W
MITIGATE = {"center_source": False, "drop_pcs": 0}   # set by the quality check (see design notes in the commit message)


def ensure_venv():
    try:
        import numpy, umap  # noqa: F401
        return
    except ImportError:
        pass
    if not VENV_PY.exists() or os.environ.get("_LOOK_REEXEC"):
        print("look_layout: no clipenv venv with umap-learn, skipping (see header of tools/look_layout.py)")
        sys.exit(0)
    os.environ["_LOOK_REEXEC"] = "1"
    os.execv(str(VENV_PY), [str(VENV_PY), *sys.argv])


def ids_hash(ids):
    return hashlib.sha1(("\n".join(ids) + "\n").encode()).hexdigest()[:8]


def painters(n):
    """Painter name per gallery index from the detail shards (for filling in paintings that have no image)."""
    out = []
    d = ROOT / "data" / "gallery" / "d"
    for f in sorted(d.glob("*.json")):
        out.extend(r[2] or "" for r in json.load(open(f, encoding="utf-8")))
    return out if len(out) == n else [""] * n


def atlas_embed(todo_idx, ids):
    """Embed paintings from their 80 px atlas tile (cached). Returns {id: vector}."""
    import numpy as np
    from PIL import Image
    sys.path.insert(0, str(ROOT / "tools"))
    import subjects_clip as sc
    torch, open_clip, model, pre, dev = sc.load_model()
    have = ATL_IDS.read_text().splitlines() if ATL_IDS.exists() else []
    arr = np.load(ATL) if ATL.exists() and have else np.zeros((0, 512), np.float16)
    if len(arr) != len(have):
        have, arr = [], np.zeros((0, 512), np.float16)
    known = set(have)
    todo = [i for i in todo_idx if ids[i] not in known]
    print(f"atlas tiles: {len(have)} cached, {len(todo)} to embed", flush=True)
    sheets = {}
    new_ids, new = [], []
    t0 = time.time()
    for b in range(0, len(todo), 256):
        chunk, xs = todo[b:b + 256], []
        for i in chunk:
            g, loc = i // 625, i % 625
            if g not in sheets:
                sheets.clear()
                sheets[g] = Image.open(ROOT / "data" / "paintmap" / f"g{g}.webp").convert("RGB")
            x, y = (loc % 25) * 80, (loc // 25) * 80
            xs.append(pre(sheets[g].crop((x, y, x + 80, y + 80)).resize((224, 224), Image.BICUBIC)))
        with torch.no_grad():
            f = model.encode_image(torch.stack(xs).to(dev)); f = f / f.norm(dim=-1, keepdim=True)
        new.append(f.float().cpu().numpy().astype(np.float16)); new_ids += [ids[i] for i in chunk]
        if (b // 256) % 20 == 0:
            print(f"  {b + len(chunk)}/{len(todo)}  {(b + len(chunk)) / (time.time() - t0):.0f} img/s", flush=True)
    if new:
        arr = np.concatenate([arr, np.concatenate(new)]); have = have + new_ids
        np.save(ATL, arr); ATL_IDS.write_text("\n".join(have) + "\n")
    return {k: arr[j] for j, k in enumerate(have)}


def load_vectors(ids):
    import numpy as np
    n = len(ids)
    have = EMB_IDS.read_text().splitlines(); arr = np.load(EMB)
    row = {k: i for i, k in enumerate(have)}
    E = np.zeros((n, 512), np.float32); src = np.zeros(n, np.int8)   # src: 2 full image, 1 atlas tile, 0 imputed
    for i, k in enumerate(ids):
        r = row.get(k)
        if r is not None: E[i] = arr[r]; src[i] = 2
    man = json.load(open(ROOT / "data" / "paintmap" / "manifest.json"))
    nomap = set(man.get("missing", []))
    need = [i for i in range(n) if src[i] == 0 and i not in nomap and (ROOT / "data" / "paintmap" / f"g{i // 625}.webp").exists()]
    if need:
        vec = atlas_embed(need, ids)
        for i in need:
            v = vec.get(ids[i])
            if v is not None: E[i] = v; src[i] = 1
    # still nothing: the painter's mean vector (so the painting lands among that painter's work), else the global mean
    miss = np.where(src == 0)[0]
    if len(miss):
        who = painters(n); sums, cnt = {}, {}
        for i in np.where(src > 0)[0]:
            w = who[i]
            if w: sums[w] = sums.get(w, 0) + E[i]; cnt[w] = cnt.get(w, 0) + 1
        gm = E[src > 0].mean(0)
        for i in miss:
            w = who[i]; E[i] = sums[w] / cnt[w] if w in sums else gm
    return E, src


def color_features(n):
    """Per painting from data/gallery/index.bin: mean CIELAB, the six palette colors in Lab weighted by their shares, and the shares.
    Each block is z-scored and scaled to unit norm, ready to be weighted against the CLIP vector."""
    import numpy as np
    b = np.fromfile(ROOT / "data" / "gallery" / "index.bin", dtype=np.uint8).reshape(n, 30)
    rgb = b[:, 6:30].reshape(n, 6, 4)
    sh = rgb[:, :, 3].astype(np.float64) / 250.0
    c = rgb[:, :, :3].astype(np.float64) / 255.0
    lin = np.where(c > .04045, ((c + .055) / 1.055) ** 2.4, c / 12.92)
    M = np.array([[.4124, .3576, .1805], [.2126, .7152, .0722], [.0193, .1192, .9505]])
    xyz = lin @ M.T / np.array([.95047, 1, 1.08883])
    f = np.where(xyz > .008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    lab = np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)   # n x 6 x 3
    tot = sh.sum(1, keepdims=True) + 1e-9
    mean = (lab * sh[..., None]).sum(1) / tot
    def unit(a):
        a = (a - a.mean(0)) / (a.std(0) + 1e-9)
        return a / np.sqrt(a.shape[1])
    blocks = [unit(mean), unit((lab * sh[..., None]).reshape(n, 18)), unit(sh)]
    return np.concatenate(blocks, 1) / np.sqrt(len(blocks))


def prepare(E, ids):
    import numpy as np
    X = E.copy()
    if MITIGATE["center_source"]:
        srcs = np.array([k.split("-", 1)[0] for k in ids])
        for s in np.unique(srcs):
            m = srcs == s
            if m.sum() >= 200: X[m] -= X[m].mean(0)
    else:
        X -= X.mean(0)
    if MITIGATE["drop_pcs"]:
        u, s, vt = np.linalg.svd(X[np.random.RandomState(0).choice(len(X), 40000, replace=False)], full_matrices=False)
        P = vt[:MITIGATE["drop_pcs"]]
        X -= (X @ P.T) @ P
    X /= np.linalg.norm(X, axis=1, keepdims=True) + 1e-9
    if COLOR_W > 0:
        X = np.concatenate([X, COLOR_W * color_features(len(X)).astype(np.float32)], 1)
    return X


def embed2d(X, cache=None):
    import numpy as np, umap
    if cache is not None and cache.exists():
        Y = np.load(cache)
        if len(Y) == len(X):
            print(f"UMAP: using cached {cache.name}", flush=True)
            return Y.astype(np.float64)
    from numpy.linalg import svd
    rs = np.random.RandomState(7)
    sub = X[rs.choice(len(X), min(60000, len(X)), replace=False)]
    mu = sub.mean(0)
    _, _, vt = svd(sub - mu, full_matrices=False)
    Z = (X - mu) @ vt[:50].T
    t0 = time.time()
    Y = umap.UMAP(n_components=2, n_neighbors=15, min_dist=0.05, metric="euclidean", random_state=7, low_memory=True, verbose=False).fit_transform(Z)
    print(f"UMAP {len(X)} points in {(time.time() - t0) / 60:.1f} min", flush=True)
    if cache is not None: np.save(cache, Y.astype(np.float32))
    return Y.astype(np.float64)


def cells_in(x0, x1, y0, y1, W, N):
    """Cells of the W-wide raster (only the first N cells exist) inside [x0,x1) x [y0,y1)."""
    full = max(0, min(y1, N // W) - y0)
    tot = full * (x1 - x0)
    if y1 > N // W >= y0 and N % W:
        r = N % W
        tot += max(0, min(x1, r) - x0)
    return tot


def even_grid(Y, W):
    """Recursive median split of the 2-D cloud onto the first N cells of a W-wide raster."""
    import numpy as np
    N = len(Y); H = -(-N // W)
    X = np.zeros(N, np.int32); Yc = np.zeros(N, np.int32)
    stack = [(np.arange(N), 0, W, 0, H)]
    while stack:
        idx, x0, x1, y0, y1 = stack.pop()
        if len(idx) == 0: continue
        if x1 - x0 == 1 and y1 - y0 == 1:
            X[idx[0]], Yc[idx[0]] = x0, y0; continue
        if x1 - x0 >= y1 - y0 and x1 - x0 > 1:
            m = (x0 + x1) // 2; a = cells_in(x0, m, y0, y1, W, N); ax = 0; parts = [(x0, m, y0, y1), (m, x1, y0, y1)]
        else:
            m = (y0 + y1) // 2; a = cells_in(x0, x1, y0, m, W, N); ax = 1; parts = [(x0, x1, y0, m), (x0, x1, m, y1)]
        o = np.lexsort((idx, Y[idx, ax]))   # coordinate, ties by painting index: deterministic
        idx = idx[o]
        stack.append((idx[:a], *parts[0])); stack.append((idx[a:], *parts[1]))
    return X, Yc, H


def main():
    ensure_venv()
    import numpy as np
    ids = [l for l in (ROOT / "data/gallery/ids.txt").read_text().splitlines() if l]
    if not EMB.exists():
        print("look_layout: no CLIP embeddings cache (run tools/subjects_clip.py --embed-only), skipping"); return
    for a in sys.argv:
        if a == "--center-source": MITIGATE["center_source"] = True
        if a.startswith("--drop-pcs="): MITIGATE["drop_pcs"] = int(a.split("=")[1])
        if a.startswith("--color="): globals()["COLOR_W"] = float(a.split("=")[1])
        if a.startswith("--suffix="): globals()["SUFFIX"] = a.split("=")[1]
    reduced = any(MITIGATE.values())
    tag = "reduced" if reduced else f"c{int(round(COLOR_W * 100))}" if COLOR_W else "default"
    sfx = "-" + tag if tag != "default" else ""     # "Color influence" variants ship as look-islands-c30.bin + look-c30.json (islands only)
    islands_only = "--islands-only" in sys.argv or tag != "default"   # keep the shipped look.bin as it is, add only the islands layout
    n = len(ids)
    E, src = load_vectors(ids)
    print(f"{n} paintings: {int((src == 2).sum())} full image, {int((src == 1).sum())} atlas tile, {int((src == 0).sum())} imputed", flush=True)
    X = prepare(E, ids)
    Y = embed2d(X, CACHE / f"look-umap-{tag}.npy")
    W = int(round((n / 1.55) ** 0.5))   # the same shape pmLayColor uses
    gx, gy, H = even_grid(Y, W)
    assert len(set(zip(gx.tolist(), gy.tolist()))) == n
    h = ids_hash(ids)
    out = ROOT / "data" / "gallery"
    buf = bytearray(b"LOOK" + struct.pack("<IIIII", 1, n, W, H, int(h, 16)))
    buf += np.stack([gx, gy], 1).astype("<u2").tobytes()
    old = out / f"look{sfx}.bin"
    if old.exists() and tag == "default":
        print("even grid identical to the shipped look.bin:", old.read_bytes() == bytes(buf), flush=True)
    if not islands_only: old.write_bytes(buf)
    meta_p = out / f"look{sfx}.json"
    meta = json.load(open(meta_p)) if islands_only and meta_p.exists() else {"v": 1, "n": n, "w": W, "h": H, "hash": h, "built": time.strftime("%Y-%m-%d"), "model": MODEL,
            "method": "PCA(50) -> UMAP(2-D, 15 neighbors) -> recursive median split onto an even grid",
            "mitigation": {k: v for k, v in MITIGATE.items() if v}, "sources": {"image": int((src == 2).sum()), "tile": int((src == 1).sum()), "imputed": int((src == 0).sum())}}
    if "--no-islands" not in sys.argv:
        import look_islands
        isl, L, lx, ly = look_islands.build(Y, ids, h, out, ROOT, sfx, out / "subjects.json")
        if tag != "default": meta["grid"] = False; meta["color"] = COLOR_W   # no even-grid file for this variant (the page uses look.bin)
        meta["islands"] = isl; meta["gap"] = look_islands.GAP; meta["gapSib"] = look_islands.SUB_GAP
        meta["islandsMethod"] = "HDBSCAN clusters of the same UMAP cloud; each island an even blob; labels from over-represented subject tags, century and country"
        np.save(CACHE / f"look-islands-labels{sfx}.npy", L)
    meta_p.write_text(json.dumps(meta, indent=1) + "\n")
    if not reduced and not islands_only: np.save(CACHE / "look-xy.npy", np.stack([gx, gy], 1).astype(np.int32))
    print(f"wrote look{sfx}.json; even grid {W}x{H}")
    if "--sheets" in sys.argv:
        sheets(ids, gx, gy, X, src)


def sheets(ids, gx, gy, X, src):
    """Contact sheets: 12 random seeds, each with its 9 nearest paintings by cosine in the (prepared) 512-d space AND by grid distance."""
    import numpy as np
    from PIL import Image, ImageDraw
    rs = np.random.RandomState(3)
    seeds = rs.choice(np.where(src == 2)[0], 12, replace=False)
    out = ROOT / "design" / "review-shots" / "look"; out.mkdir(parents=True, exist_ok=True)
    pos = np.stack([gx, gy], 1).astype(np.float32)
    S = 110
    sheet = Image.new("RGB", (10 * S, 12 * (2 * S + 8)), "#222")
    d = ImageDraw.Draw(sheet)
    def img(i):
        k = ids[i]; s, r = k.split("-", 1)
        for f in (RAW / s / "img" / f"{r}.jpg", RAW / "measure-img" / f"{k}.jpg"):
            if f.exists():
                try:
                    im = Image.open(f).convert("RGB"); im.thumbnail((S, S)); return im
                except Exception: pass
        loc = i % 625
        try:
            g = Image.open(ROOT / "data" / "paintmap" / f"g{i // 625}.webp").convert("RGB")
            return g.crop(((loc % 25) * 80, (loc // 25) * 80, (loc % 25) * 80 + 80, (loc // 25) * 80 + 80)).resize((S, S))
        except Exception: return Image.new("RGB", (S, S), "#555")
    for row, s in enumerate(seeds):
        near_f = np.argsort(-(X @ X[s]))[:10]                       # seed + 9 nearest by the model (512-d)
        near_g = np.argsort(((pos - pos[s]) ** 2).sum(1))[:10]      # seed + 9 nearest on the map grid
        for c, i in enumerate(near_f): sheet.paste(img(i), (c * S, row * (2 * S + 8)))
        for c, i in enumerate(near_g): sheet.paste(img(i), (c * S, row * (2 * S + 8) + S))
        d.text((2, row * (2 * S + 8) + 2), "model: " + ids[s], fill="#fff"); d.text((2, row * (2 * S + 8) + S + 2), "map grid", fill="#fff")
    sheet.save(out / f"neighborhoods{SUFFIX}.png")
    print("wrote", out / f"neighborhoods{SUFFIX}.png")


if __name__ == "__main__":
    main()
