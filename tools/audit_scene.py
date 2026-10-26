#!/usr/bin/env python3
"""Two reading axes for every painting, so the home's river can change gradually in WHAT a picture is, not only its color (David, 2026-10-26: "from
representational to abstract has to be gradual; from a close-up of a face to a landscape, with a group of people somewhere between: close-up, medium, wide").
CLIP zero-shot on the cached embeddings (no network):
  abstraction  0 = a lifelike, recognizable scene ... 255 = pure abstraction (percentile rank across the archive, so the range is used evenly)
  scale        0 = a close-up (a face, one object) ... 255 = a vast view; between: a head and shoulders, a figure, a group or an interior, a town or a landscape
               (the expected position over five ordered descriptions, not ranked, so the middle really is "medium")
  python3 tools/audit_scene.py        # writes data/gallery/scene.bin (2 bytes per painting, gallery order: abstraction, scale) and scene.json
Paintings with no cached embedding get 128, 128 and are counted as unscored. Needs research/_raw/clipenv and research/_raw/subjects/clip-embeds.npy.
"""
import hashlib, json, os, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = Path(os.environ.get("SUBJECTS_RAW", ROOT / "research" / "_raw"))
VENV_PY = RAW / "clipenv" / "bin" / "python"
CACHE = RAW / "subjects"
MODEL, PRETRAINED = "ViT-B-32", "laion2b_s34b_b79k"

ABS = ["an abstract painting of shapes, lines and color", "a non-representational abstract artwork", "geometric abstraction", "an abstract expressionist painting"]
REP = ["a realistic painting of a recognizable scene", "a lifelike representational painting", "a painting of people, a landscape or objects that you can recognize", "a detailed figurative painting"]
SCALE = [   # ordered close -> wide
    ["a close-up painting of a face", "a tight close-up of one object", "a detail of a painting, filling the frame"],
    ["a head and shoulders portrait", "a half-length portrait of a person", "a still life of a few objects on a table"],
    ["a full-length painting of one or two figures", "a painting of a few people in a room", "a painting of an animal"],
    ["a painting of a group of people, a crowd or a gathering", "a painting of an interior or a street scene with several figures", "a medium shot of a scene with people"],
    ["a wide landscape painting", "a panorama of a city, a sea or a wide valley", "a vast view with tiny figures"],
]


def main():
    if Path(sys.executable).resolve() != VENV_PY.resolve():
        if not VENV_PY.exists():
            sys.exit("needs research/_raw/clipenv")
        os.execv(str(VENV_PY), [str(VENV_PY), *sys.argv])
    import numpy as np, torch, open_clip
    dev = "mps" if torch.backends.mps.is_available() else "cpu"
    model, _, _ = open_clip.create_model_and_transforms(MODEL, pretrained=PRETRAINED)
    model = model.to(dev).eval(); tok = open_clip.get_tokenizer(MODEL)

    def enc(prompts):
        with torch.no_grad():
            T = model.encode_text(tok(prompts).to(dev)); T = T / T.norm(dim=-1, keepdim=True)
        return T.float().cpu().numpy()

    ids = [l for l in (ROOT / "data/gallery/ids.txt").read_text().splitlines() if l]
    have = (CACHE / "clip-embeds.ids.txt").read_text().splitlines(); arr = np.load(CACHE / "clip-embeds.npy")
    row = {k: i for i, k in enumerate(have)}
    ix = np.array([row.get(i, -1) for i in ids]); ok = ix >= 0
    E = np.zeros((len(ids), 512), np.float32); E[ok] = arr[ix[ok]].astype(np.float32)
    E /= np.maximum(np.linalg.norm(E, axis=1, keepdims=True), 1e-6)

    # abstraction: softmax mass on the abstract descriptions against the representational ones, then a percentile rank
    T = enc(ABS + REP); L = 100.0 * E @ T.T; L -= L.max(axis=1, keepdims=True); P = np.exp(L); P /= P.sum(axis=1, keepdims=True)
    a = P[:, :len(ABS)].sum(axis=1)
    o = np.argsort(a[ok], kind="stable"); rk = np.empty(int(ok.sum()), np.float32); rk[o] = np.arange(int(ok.sum())) / max(1, int(ok.sum()) - 1)
    absn = np.full(len(ids), 128, np.uint8); absn[ok] = np.round(rk * 255).astype(np.uint8)

    # scale: five ordered steps, each a few descriptions; the expected step (0..4) over a softmax of each step's best match
    S = np.stack([enc(g) for g in SCALE]).reshape(len(SCALE), -1, 512)
    sims = np.stack([100.0 * (E @ S[k].T).max(axis=1) for k in range(len(SCALE))], axis=1)   # (n, 5)
    sims -= sims.max(axis=1, keepdims=True); W = np.exp(sims); W /= W.sum(axis=1, keepdims=True)
    ev = (W * np.arange(len(SCALE))).sum(axis=1) / (len(SCALE) - 1)
    lo, hi = np.percentile(ev[ok], 2), np.percentile(ev[ok], 98)   # stretch the used range to the whole byte
    sc = np.full(len(ids), 128, np.uint8); sc[ok] = np.round(np.clip((ev[ok] - lo) / max(1e-6, hi - lo), 0, 1) * 255).astype(np.uint8)

    out = np.stack([absn, sc], axis=1).astype(np.uint8)
    (ROOT / "data/gallery/scene.bin").write_bytes(out.tobytes())
    h = hashlib.sha1(("\n".join(ids) + "\n").encode()).hexdigest()[:8]
    (ROOT / "data/gallery/scene.json").write_text(json.dumps({"v": 1, "n": len(ids), "hash": h, "scored": int(ok.sum()), "unscored": int((~ok).sum())}) + "\n")
    print(f"scene.bin: {len(ids)} paintings, {int(ok.sum())} scored")
    if "--show" in sys.argv:
        import glob
        names = {}
        for f in glob.glob(str(ROOT / "data/corpus/*.json")):
            d = json.load(open(f, encoding="utf-8"))
            for r in (d if isinstance(d, list) else d.get("items", d.get("rows", []))): names[r.get("id")] = (r.get("a"), r.get("t"))
        idx = np.where(ok)[0]
        for label, col, asc in [("most abstract", 0, False), ("most lifelike", 0, True), ("closest-up", 1, True), ("widest", 1, False), ("middle scale", 1, None)]:
            if asc is None: o2 = idx[np.argsort(np.abs(sc[idx].astype(int) - 128))]
            else: o2 = idx[np.argsort(out[idx, col].astype(int) * (1 if asc else -1))]
            print("--", label); [print("  ", ids[i], names.get(ids[i])) for i in o2[:8]]


if __name__ == "__main__":
    main()
