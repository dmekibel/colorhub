#!/usr/bin/env python3
"""Painting-map "By look" -> Layout "Gradual" (David, 2026-10-26: "the painting map arranged by look, but with gradual changes between areas, color taken into account").
The same even grid as tools/look_layout.py (every painting one cell, a recursive median split), but the 2-D layout is made from a vector that joins three things, so
neighbors on the map are close in all of them and any walk across it changes slowly: what the image model sees (CLIP), the painting's own colors, and the two axes of
tools/audit_scene.py (abstract <-> lifelike, close-up <-> wide).
  python3 tools/look_gradient.py        # needs data/gallery/scene.bin (tools/audit_scene.py) and the CLIP cache; writes data/gallery/look-grad.bin + look-grad.json
Weights (CLIP is 1.0): color 0.6, axes 1.0. Deterministic (the UMAP seed is fixed; the layout is cached in research/_raw/subjects/look-umap-grad.npy).
"""
import hashlib, json, os, struct, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import look_layout as LL

COLOR_WEIGHT, AXES_WEIGHT = 0.6, 1.0


def main():
    LL.ensure_venv()
    import numpy as np
    root = LL.ROOT
    ids = [l for l in (root / "data/gallery/ids.txt").read_text().splitlines() if l]
    n = len(ids)
    sb = root / "data/gallery/scene.bin"
    if not LL.EMB.exists() or not sb.exists() or sb.stat().st_size != 2 * n:
        print("look_gradient: needs the CLIP cache and a current data/gallery/scene.bin (tools/audit_scene.py), skipping"); return
    E, src = LL.load_vectors(ids)
    X = LL.prepare(E, ids)
    C = LL.color_features(n).astype(np.float32)
    S = np.frombuffer(sb.read_bytes(), np.uint8).reshape(n, 2).astype(np.float32)
    S = (S - S.mean(0)) / (S.std(0) + 1e-9); S = S / np.sqrt(S.shape[1])
    F = np.concatenate([X, COLOR_WEIGHT * C, AXES_WEIGHT * S], 1).astype(np.float32)
    Y = LL.embed2d(F, LL.CACHE / "look-umap-grad.npy")
    W = int(round((n / 1.55) ** 0.5))
    gx, gy, H = LL.even_grid(Y, W)
    import look_grid
    G = look_grid.features(F)
    thr = look_grid.smoothness(E, gx, gy, W)
    print(f"even grid, median split only: mean neighbor cosine distance {thr[0]:.4f}, seams {thr[1]:.3f}", flush=True)
    gx, gy = look_grid.refine(G, gx, gy, W)
    sm = look_grid.smoothness(E, gx, gy, W, thr[2])
    print(f"after neighbor-swap smoothing: {sm[0]:.4f}, seams {sm[1]:.3f}", flush=True)
    assert len(set(zip(gx.tolist(), gy.tolist()))) == n
    h = LL.ids_hash(ids)
    buf = bytearray(b"LOOK" + struct.pack("<IIIII", 1, n, W, H, int(h, 16)))
    buf += np.stack([gx, gy], 1).astype("<u2").tobytes()
    out = root / "data/gallery"
    (out / "look-grad.bin").write_bytes(buf)
    (out / "look-grad.json").write_text(json.dumps({"v": 1, "n": n, "w": W, "h": H, "hash": h, "built": time.strftime("%Y-%m-%d"), "model": LL.MODEL,
        "method": "CLIP + color + abstraction/scale axes -> UMAP(2-D) -> recursive median split onto an even grid -> neighbor-swap smoothing", "weights": {"clip": 1.0, "color": COLOR_WEIGHT, "axes": AXES_WEIGHT}}, indent=1) + "\n")
    print(f"wrote look-grad.bin: even grid {W}x{H}")


if __name__ == "__main__":
    main()
