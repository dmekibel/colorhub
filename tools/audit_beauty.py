#!/usr/bin/env python3
"""A picture-appeal reading for every painting (David, 2026-10-26: "the app can make honest aesthetic judgments; some work is simply prettier,
and the home should give people a beautiful palette for their eyes"). CLIP zero-shot on the cached embeddings (no network): the softmax mass on
"beautiful, luminous, harmonious" prompts against "dull, muddy, damaged, cluttered, snapshot" ones, turned into a rank (0..255) so it is
comparable across the archive. js/homefeed.js hfBeauty() combines it with what the palette itself says (harmony, vividness, contrast, muddiness).

  python3 tools/audit_beauty.py            # writes data/gallery/aesthetic.bin (one byte per painting, gallery order) and aesthetic.json
  python3 tools/audit_beauty.py --top 60   # also prints the 60 highest and 20 lowest rows, to read with your own eyes

Paintings with no cached embedding (about a sixth of the archive) get the middle value 128 and are listed as unscored in aesthetic.json.
Needs research/_raw/clipenv and research/_raw/subjects/clip-embeds.npy (tools/subjects_clip.py). Rerun after the gallery order grows (it is append-only,
so old rows keep their place); `hash` in aesthetic.json names the ids.txt it was made for (tools/check_ids.js).
"""
import hashlib, json, os, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = Path(os.environ.get("SUBJECTS_RAW", ROOT / "research" / "_raw"))
VENV_PY = RAW / "clipenv" / "bin" / "python"
CACHE = RAW / "subjects"
MODEL, PRETRAINED = "ViT-B-32", "laion2b_s34b_b79k"

GOOD = [
    "a beautiful painting with harmonious, luminous colors",
    "a stunning masterpiece painting",
    "a joyful, bright, vibrant painting",
    "an elegant painting with a lovely composition",
    "a serene and graceful painting",
    "a painting with glowing light and rich, pure color",
]
BAD = [
    "a dull, muddy, dark painting",
    "an ugly, awkward painting",
    "a faded, damaged, stained old painting",
    "a cluttered, chaotic painting",
    "a blurry, low quality photograph",
    "a plain sketch on yellowed paper",
    "a photograph of a room or a person",
    "a flat, lifeless picture",
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
    with torch.no_grad():
        T = model.encode_text(tok(GOOD + BAD).to(dev)); T = (T / T.norm(dim=-1, keepdim=True)).float().cpu().numpy()
    ids = [l for l in (ROOT / "data/gallery/ids.txt").read_text().splitlines() if l]
    have = (CACHE / "clip-embeds.ids.txt").read_text().splitlines(); arr = np.load(CACHE / "clip-embeds.npy")
    row = {k: i for i, k in enumerate(have)}
    ix = np.array([row.get(i, -1) for i in ids]); ok = ix >= 0
    E = np.zeros((len(ids), 512), np.float32); E[ok] = arr[ix[ok]].astype(np.float32)
    E /= np.maximum(np.linalg.norm(E, axis=1, keepdims=True), 1e-6)
    L = 100.0 * E @ T.T; L -= L.max(axis=1, keepdims=True)
    P = np.exp(L); P /= P.sum(axis=1, keepdims=True)
    s = P[:, :len(GOOD)].sum(axis=1)
    # The model's idea of "beautiful" leans hard toward ink-and-silk birds and flowers, so the raw score would fill a home with cranes. Each painting is
    # ranked against its own kind (same movement and country, from the facets) and only lightly against everything: the prettiest Rococo and the
    # prettiest Ukiyo-e each compete in their own group. 70% within the group, 30% across the archive, then 0..255.
    meta = json.load(open(ROOT / "data/facets/facets.json")); R = meta["rec"]; fb = np.frombuffer((ROOT / "data/facets/facets.bin").read_bytes(), np.uint8)[:len(ids) * R].reshape(len(ids), R)
    mv, co = fb[:, 3].astype(np.int32), fb[:, 2].astype(np.int32)
    def pct(vals):  # percentile rank of each value among `vals` (0..1)
        o = np.argsort(vals, kind="stable"); r = np.empty(len(vals), np.float32); r[o] = np.arange(len(vals)) / max(1, len(vals) - 1); return r
    glob_rk = np.full(len(ids), .5, np.float32); glob_rk[ok] = pct(s[ok])
    grp_rk = glob_rk.copy(); big = np.zeros(len(ids), bool)
    for g in np.unique((mv * 256 + co)[ok]):
        m = ok & ((mv * 256 + co) == g)
        if m.sum() >= 60: idx = np.where(m)[0]; grp_rk[idx] = pct(s[idx]); big[idx] = True
    for g in np.unique(co[ok]):
        m = ok & (co == g) & ~big
        if m.sum() >= 60: idx = np.where(m)[0]; grp_rk[idx] = pct(s[idx])
    fin = .7 * grp_rk + .3 * glob_rk
    out = np.full(len(ids), 128, np.uint8); out[ok] = np.round(np.clip(fin[ok], 0, 1) * 255).astype(np.uint8)
    s = np.where(ok, fin, -1)
    (ROOT / "data/gallery/aesthetic.bin").write_bytes(out.tobytes())
    h = hashlib.sha1(("\n".join(ids) + "\n").encode()).hexdigest()[:8]
    (ROOT / "data/gallery/aesthetic.json").write_text(json.dumps({"v": 1, "n": len(ids), "hash": h, "scored": int(ok.sum()), "unscored": int((~ok).sum())}) + "\n")
    print(f"aesthetic.bin: {len(ids)} paintings, {int(ok.sum())} scored, {int((~ok).sum())} left at 128")
    if "--top" in sys.argv:
        import glob
        k = int(sys.argv[sys.argv.index("--top") + 1]); names = {}
        for f in glob.glob(str(ROOT / "data/corpus/*.json")):
            d = json.load(open(f, encoding="utf-8"))
            for r in (d if isinstance(d, list) else d.get("items", d.get("rows", []))): names[r.get("id")] = (r.get("a"), r.get("t"))
        o = np.argsort(-s)
        print("-- highest"); [print(" ", ids[i], names.get(ids[i])) for i in o[:k]]
        print("-- lowest scored"); [print(" ", ids[i], names.get(ids[i])) for i in o[ok.sum() - 20:ok.sum()]]


if __name__ == "__main__":
    main()
