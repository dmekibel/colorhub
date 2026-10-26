#!/usr/bin/env python3
"""Find rows whose picture is a PHOTOGRAPH OF A PAINTING IN ITS SETTING (a gallery wall with visitors, a frame on a wall, a church
interior, a snapshot of a ceiling) instead of the painting itself (David, 2026-10-26: the Manet row was a press photo of three people
standing beside a framed painting). CLIP zero-shot on the cached embeddings (no network): a row's score is the softmax mass on the
"setting" prompts against the "the artwork itself" prompts.

  python3 tools/audit_photos.py                    # score everything, print the distribution and the top rows
  python3 tools/audit_photos.py --id commons-F16370473
  python3 tools/audit_photos.py --out research/photos-flagged.json --min 0.6   # write rows at or above the score
  python3 tools/audit_photos.py --hide                # write data/hide-photos.json: Commons file uploads (commons-F...) scoring >= 0.8,
                                                      # which tools/hide_nonart.py turns into hidden.json (reason "photo"); rerun after new Commons paintings

Needs research/_raw/clipenv and research/_raw/subjects/clip-embeds.npy (see tools/subjects_clip.py). Env SUBJECTS_RAW as there.
"""
import json, os, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = Path(os.environ.get("SUBJECTS_RAW", ROOT / "research" / "_raw"))
VENV_PY = RAW / "clipenv" / "bin" / "python"
CACHE = RAW / "subjects"
MODEL, PRETRAINED = "ViT-B-32", "laion2b_s34b_b79k"

SETTING = [
    "a photograph of people standing in a museum gallery",
    "a photo of a framed painting hanging on a wall in a museum",
    "a snapshot of a gallery wall with a picture in a gold frame",
    "a photograph of a church interior",
    "a photo of a ceiling fresco in a church taken from below",
    "a photograph of a room with furniture",
    "a photograph of a person",
    "a press photo of people at an exhibition",
    "a photo of an altarpiece in a church with candles",
    "a tourist snapshot of a museum display",
]
ITSELF = [
    "a painting",
    "an oil painting on canvas",
    "a flat frontal scan of a painting filling the whole frame",
    "a watercolor painting",
    "a drawing on paper",
    "a painted portrait",
    "a landscape painting",
    "a still life painting",
]


def main():
    if not (VENV_PY.exists() and Path(sys.executable).resolve() != VENV_PY.resolve()) and Path(sys.executable).resolve() != VENV_PY.resolve():
        sys.exit("needs research/_raw/clipenv")
    if Path(sys.executable).resolve() != VENV_PY.resolve():
        os.execv(str(VENV_PY), [str(VENV_PY), *sys.argv])
    import numpy as np, torch, open_clip
    dev = "mps" if torch.backends.mps.is_available() else "cpu"
    model, _, _ = open_clip.create_model_and_transforms(MODEL, pretrained=PRETRAINED)
    model = model.to(dev).eval()
    tok = open_clip.get_tokenizer(MODEL)
    with torch.no_grad():
        T = model.encode_text(tok(SETTING + ITSELF).to(dev)); T = (T / T.norm(dim=-1, keepdim=True)).float().cpu().numpy()
    ids = [l for l in (ROOT / "data/gallery/ids.txt").read_text().splitlines() if l]
    have = (CACHE / "clip-embeds.ids.txt").read_text().splitlines(); arr = np.load(CACHE / "clip-embeds.npy")
    row = {k: i for i, k in enumerate(have)}
    ix = np.array([row.get(i, -1) for i in ids]); ok = ix >= 0
    E = np.zeros((len(ids), 512), np.float32); E[ok] = arr[ix[ok]].astype(np.float32)
    E /= np.maximum(np.linalg.norm(E, axis=1, keepdims=True), 1e-6)
    L = 100.0 * E @ T.T
    L -= L.max(axis=1, keepdims=True)
    P = np.exp(L); P /= P.sum(axis=1, keepdims=True)
    score = P[:, :len(SETTING)].sum(axis=1); score[~ok] = 0
    names = {}
    import glob
    for f in glob.glob(str(ROOT / "data/corpus/*.json")):
        d = json.load(open(f, encoding="utf-8"))
        for r in (d if isinstance(d, list) else d.get("items", d.get("rows", []))):
            names[r.get("id")] = (r.get("a"), r.get("t"))
    if "--id" in sys.argv:
        k = sys.argv[sys.argv.index("--id") + 1]
        i = ids.index(k); print(k, names.get(k), "score %.3f" % score[i], "embedded" if ok[i] else "NO EMBEDDING"); return
    print(f"{ok.sum()} embedded of {len(ids)}")
    for t in (.3, .5, .6, .7, .8, .9): print(f"score >= {t}: {(score >= t).sum()}  (of commons-F: {sum(1 for i in np.where(score >= t)[0] if ids[i].startswith('commons-F'))})")
    thr = float(sys.argv[sys.argv.index("--min") + 1]) if "--min" in sys.argv else 0.5
    o = [i for i in np.argsort(-score) if score[i] >= thr]
    out = [{"id": ids[i], "artist": names.get(ids[i], ("", ""))[0], "title": names.get(ids[i], ("", ""))[1], "score": round(float(score[i]), 3)} for i in o]
    if "--out" in sys.argv:
        p = ROOT / sys.argv[sys.argv.index("--out") + 1]; p.write_text(json.dumps(out, ensure_ascii=False, indent=1)); print("wrote", p, len(out))
    if "--hide" in sys.argv:
        import datetime
        cut = float(sys.argv[sys.argv.index("--min") + 1]) if "--min" in sys.argv else 0.8
        keep = [ids[i] for i in np.argsort(-score) if score[i] >= cut and ids[i].startswith("commons-F")]
        (ROOT / "data/hide-photos.json").write_text(json.dumps({"v": 1, "min": cut, "built": datetime.date.today().isoformat(), "ids": sorted(keep)}, separators=(",", ":")) + "\n")
        print(f"wrote data/hide-photos.json: {len(keep)} Commons file uploads at >= {cut}")
    for r in out[:40]: print(r["score"], r["id"], "|", r["artist"], "|", str(r["title"])[:80])


if __name__ == "__main__":
    main()
