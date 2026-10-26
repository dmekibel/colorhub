#!/usr/bin/env python3
"""Twelve moods for every painting (David, 2026-10-26: "moods can be their own folders, like periods and movements"). CLIP zero-shot on the cached embeddings
(no network): each mood is described by a few phrases; a painting's reading is how much of the softmax mass over all twelve falls on that mood, then ranked across the
archive (0..255) so every mood uses its whole range and a board of "the most serene" is the top of that ranking. The model's reading of a picture's mood, not a claim
about how colors feel (see the color myths in CLAUDE.md).
  python3 tools/audit_mood.py [--show]    # writes data/gallery/mood.bin (12 bytes per painting, gallery order, MOODS order) and mood.json
Paintings with no cached embedding get 128 everywhere and are counted as unscored. Needs research/_raw/clipenv and research/_raw/subjects/clip-embeds.npy.
"""
import hashlib, json, os, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = Path(os.environ.get("SUBJECTS_RAW", ROOT / "research" / "_raw"))
VENV_PY = RAW / "clipenv" / "bin" / "python"
CACHE = RAW / "subjects"
MODEL, PRETRAINED = "ViT-B-32", "laion2b_s34b_b79k"

MOODS = [   # id, name, phrases
    ("serene", "Serene", ["a serene, peaceful, calm painting", "a quiet tranquil scene with soft light", "a still and restful painting"]),
    ("joyful", "Joyful", ["a joyful, happy, bright painting", "a cheerful sunny scene full of delight", "a painting that radiates happiness"]),
    ("festive", "Festive", ["a festive painting of a celebration, a feast or a dance", "a lively gathering with music and dancing", "a carnival or a party scene"]),
    ("playful", "Playful", ["a playful, whimsical, humorous painting", "a charming painting of children or animals at play", "a light-hearted fanciful scene"]),
    ("romantic", "Romantic", ["a romantic, tender painting of lovers", "a dreamy, sentimental, affectionate scene", "an intimate loving embrace"]),
    ("intimate", "Intimate", ["an intimate, quiet domestic scene", "a private, gentle moment between people", "a cozy interior with a person absorbed in thought"]),
    ("majestic", "Majestic", ["a majestic, grand, monumental painting", "a solemn ceremonial scene of power and glory", "a vast awe-inspiring sublime landscape"]),
    ("dramatic", "Dramatic", ["a dramatic painting with strong contrasts of light and dark", "an intense stormy scene full of action", "a turbulent dynamic composition"]),
    ("tense", "Tense", ["a tense, anxious, uneasy painting", "a frightening or threatening scene", "a nervous painting with a sense of dread"]),
    ("somber", "Somber", ["a somber, grave, serious painting", "a dark funeral or mourning scene", "a heavy, solemn and grim painting"]),
    ("melancholy", "Melancholy", ["a melancholy, wistful, lonely painting", "a pensive sad figure alone", "a nostalgic, longing, faded mood"]),
    ("mysterious", "Mysterious", ["a mysterious, enigmatic, dreamlike painting", "an eerie, uncanny, strange scene", "a surreal haunting twilight atmosphere"]),
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

    def enc(ph):
        with torch.no_grad():
            T = model.encode_text(tok(ph).to(dev)); T = T / T.norm(dim=-1, keepdim=True)
        return T.float().cpu().numpy()

    ids = [l for l in (ROOT / "data/gallery/ids.txt").read_text().splitlines() if l]
    have = (CACHE / "clip-embeds.ids.txt").read_text().splitlines(); arr = np.load(CACHE / "clip-embeds.npy")
    row = {k: i for i, k in enumerate(have)}
    ix = np.array([row.get(i, -1) for i in ids]); ok = ix >= 0
    E = np.zeros((len(ids), 512), np.float32); E[ok] = arr[ix[ok]].astype(np.float32)
    E /= np.maximum(np.linalg.norm(E, axis=1, keepdims=True), 1e-6)
    S = np.stack([(E @ enc(ph).T).max(axis=1) for _, _, ph in MOODS], axis=1) * 100.0   # (n, 12): each mood's best phrase
    S -= S.max(axis=1, keepdims=True); P = np.exp(S); P /= P.sum(axis=1, keepdims=True)
    out = np.full((len(ids), len(MOODS)), 128, np.uint8)
    m = int(ok.sum())
    for k in range(len(MOODS)):
        o = np.argsort(P[ok, k], kind="stable"); rk = np.empty(m, np.float32); rk[o] = np.arange(m) / max(1, m - 1)
        out[ok, k] = np.round(rk * 255).astype(np.uint8)
    (ROOT / "data/gallery/mood.bin").write_bytes(out.tobytes())
    h = hashlib.sha1(("\n".join(ids) + "\n").encode()).hexdigest()[:8]
    (ROOT / "data/gallery/mood.json").write_text(json.dumps({"v": 1, "n": len(ids), "hash": h, "moods": [[a, b] for a, b, _ in MOODS], "scored": m, "unscored": int(len(ids) - m)}, indent=1) + "\n")
    print(f"mood.bin: {len(ids)} paintings x {len(MOODS)} moods, {m} scored")
    if "--show" in sys.argv:
        import glob
        names = {}
        for f in glob.glob(str(ROOT / "data/corpus/*.json")):
            d = json.load(open(f, encoding="utf-8"))
            for r in (d if isinstance(d, list) else d.get("items", d.get("rows", []))): names[r.get("id")] = (r.get("a"), r.get("t"))
        idx = np.where(ok)[0]
        for k, (a, b, _) in enumerate(MOODS):
            top = idx[np.argsort(-P[idx, k])[:7]]
            print("--", b); [print("  ", names.get(ids[i])) for i in top]


if __name__ == "__main__":
    main()
