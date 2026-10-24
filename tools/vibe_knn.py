#!/usr/bin/env python3
"""Exact nearest neighbors by "vibe" (cosine of the CLIP ViT-B-32 fingerprints) for every gallery painting.

  python3 tools/vibe_knn.py            # writes data/gallery/vibe/NNN.bin + index.json
  python3 tools/vibe_knn.py --sheet    # also design/review-shots/vibe/neighbors.png (12 random seeds, 9 nearest each)

Same vectors as the By vibe map (tools/look_layout.py load_vectors: full image, else atlas tile, else the painter's mean).
Exact top-K on the GPU (torch mps, else cpu): 2048 rows x all paintings per block, top-K kept per row, self excluded,
ties broken by the lower gallery index.
Shard NNN.bin holds 1024 paintings (gallery index i -> shard i // 1024, record i % 1024); a record is K neighbors, nearest first,
4 bytes each: u24 little-endian gallery index + u8 similarity (cosine 0.5..1.0 mapped to 0..255, clamped).
Header: data/gallery/vibe/index.json {n, k, shard, built, model, ids_hash} (ids_hash = look.json's method).
Needs the clipenv venv (re-runs itself under it; exits quietly without it or the embeddings) so rebuild_all.sh can call it blindly.
"""
import json, os, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import look_layout as L

K, SHARD, BLOCK = 60, 1024, 2048
OUT = L.ROOT / "data" / "gallery" / "vibe"


def ensure_venv():
    try:
        import numpy, torch  # noqa: F401
        return
    except ImportError:
        pass
    if not L.VENV_PY.exists() or os.environ.get("_VIBE_REEXEC"):
        print("vibe_knn: no clipenv venv with torch, skipping"); sys.exit(0)
    os.environ["_VIBE_REEXEC"] = "1"
    os.execv(str(L.VENV_PY), [str(L.VENV_PY), *sys.argv])


def main():
    ensure_venv()
    import numpy as np, torch
    ids = [l for l in (L.ROOT / "data/gallery/ids.txt").read_text().splitlines() if l]
    if not L.EMB.exists():
        print("vibe_knn: no CLIP embeddings cache, skipping"); return
    n = len(ids)
    E, src = L.load_vectors(ids)
    print(f"{n} paintings: {int((src == 2).sum())} full image, {int((src == 1).sum())} tile, {int((src == 0).sum())} imputed", flush=True)
    dev = "mps" if torch.backends.mps.is_available() else "cpu"
    X = torch.from_numpy(E).to(dev)
    X = X / X.norm(dim=1, keepdim=True).clamp_min(1e-9)
    nb = np.zeros((n, K), np.int64); sm = np.zeros((n, K), np.float32)
    t0 = time.time()
    for a in range(0, n, BLOCK):
        b = min(n, a + BLOCK)
        S = X[a:b] @ X.T
        r = torch.arange(b - a, device=dev)
        S[r, r + a] = -2.0   # never itself
        v, ix = S.topk(K + 8, dim=1)   # spare candidates so ties re-order by index without losing the cut
        v, ix = v.cpu().numpy(), ix.cpu().numpy()
        for j in range(b - a):
            o = np.lexsort((ix[j], -np.round(v[j], 5)))[:K]
            nb[a + j], sm[a + j] = ix[j][o], v[j][o]
        if (a // BLOCK) % 10 == 0: print(f"  {b}/{n}  {time.time() - t0:.0f}s", flush=True)
    q = np.clip(np.round((sm - 0.5) / 0.5 * 255), 0, 255).astype(np.uint8)
    OUT.mkdir(parents=True, exist_ok=True)
    for f in OUT.glob("*.bin"): f.unlink()
    ns = (n + SHARD - 1) // SHARD
    for s in range(ns):
        i0, i1 = s * SHARD, min(n, (s + 1) * SHARD)
        rec = np.zeros((i1 - i0, K, 4), np.uint8)
        g = nb[i0:i1]
        rec[:, :, 0], rec[:, :, 1], rec[:, :, 2] = g & 255, (g >> 8) & 255, (g >> 16) & 255
        rec[:, :, 3] = q[i0:i1]
        (OUT / f"{s:03d}.bin").write_bytes(rec.tobytes())
    json.dump({"n": n, "k": K, "shard": SHARD, "built": time.strftime("%Y-%m-%d"), "model": L.MODEL, "ids_hash": L.ids_hash(ids)},
              open(OUT / "index.json", "w"))
    print(f"vibe_knn: {ns} shards, {sum(p.stat().st_size for p in OUT.glob('*.bin')) / 1e6:.1f} MB, {time.time() - t0:.0f}s")
    if "--sheet" in sys.argv: sheet(ids, nb, sm, src)


def sheet(ids, nb, sm, src):
    import numpy as np
    from PIL import Image, ImageDraw
    rs = np.random.RandomState(11)
    seeds = rs.choice(np.where(src == 2)[0], 12, replace=False)
    S = 110; out = L.ROOT / "design" / "review-shots" / "vibe"; out.mkdir(parents=True, exist_ok=True)
    atl = {}
    def img(i):
        g = i // 625; loc = i % 625
        if g not in atl:
            try: atl[g] = Image.open(L.ROOT / "data" / "paintmap" / f"g{g}.webp").convert("RGB")
            except Exception: atl[g] = None
        if atl[g] is None: return Image.new("RGB", (S, S), "#555")
        return atl[g].crop(((loc % 25) * 80, (loc // 25) * 80, (loc % 25) * 80 + 80, (loc // 25) * 80 + 80)).resize((S, S))
    sheet = Image.new("RGB", (10 * S, 12 * S), "#222"); d = ImageDraw.Draw(sheet)
    for row, s in enumerate(seeds):
        for c, i in enumerate([s] + list(nb[s][:9])): sheet.paste(img(int(i)), (c * S, row * S))
        d.rectangle((0, row * S, S, row * S + 12), fill="#000"); d.text((2, row * S), "SEED " + ids[s][:16], fill="#fff")
    sheet.save(out / "neighbors.png")
    print("wrote", out / "neighbors.png", "seeds", [ids[s] for s in seeds])


if __name__ == "__main__":
    main()
