#!/usr/bin/env python3
"""Model-detected subject tags ("im") for every painting, by CLIP zero-shot on our own cached images (no network).

  python3 tools/subjects_clip.py              # embed images not yet cached (resumable), then label and write "im"
  python3 tools/subjects_clip.py --label-only # skip embedding, just re-label from the cached embeddings
  python3 tools/subjects_clip.py --embed-only # only fill the embeddings cache (used by look_layout.py / rebuild_all.sh), no labelling
  python3 tools/subjects_clip.py --report     # also print the per-tag precision table

Needs the venv at research/_raw/clipenv (torch + open_clip_torch; NOT in the repo): the script re-runs itself under it, and
exits quietly if the venv is missing. Model: open_clip ViT-B-32 laion2b_s34b_b79k. Uses Apple GPU (mps) when available.
Env SUBJECTS_RAW=/path/to/research/_raw points at the caches when running from a worktree.

Embeddings cache (never in the repo): <RAW>/subjects/clip-embeds.npy (float16, N x 512) + clip-embeds.ids.txt (row -> id).
Only paintings with no cached row are encoded, so a new batch of paintings costs minutes.

Labels: only GENRE and THINGS vocabulary tags (CLIP cannot tell saints apart; iconography is left to Wikidata).
  genre  = softmax over the genre prompts, top-1 only; things = 100*cosine to the tag's prompts, minus the painting's mean.
Calibration: against the AUTHORITY tags ("ia") of paintings that have them. For each tag the score threshold is the lowest score
at which "score >= t" has >= 85% precision against ia (and >= MIN_PRED predictions); tags that never reach 85% are dropped.
Confidence (0-100) = that empirical precision at the painting's own score (85..100).
Authority tags are incomplete, so measured precision is a floor: true precision is higher.
Per painting at most 1 genre (only if the authority tags carry no genre) + 4 things, and never a tag the painting already has in ia or it (im is purely additive).
Output: data/gallery/subjects.json "im": [[tagIdx, conf], ...] per painting (same order as ids.txt).
"""
import json, os, sys, time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = Path(os.environ.get("SUBJECTS_RAW", ROOT / "research" / "_raw"))
VENV_PY = RAW / "clipenv" / "bin" / "python"
CACHE = RAW / "subjects"
EMB = CACHE / "clip-embeds.npy"
EMB_IDS = CACHE / "clip-embeds.ids.txt"
MODEL, PRETRAINED = "ViT-B-32", "laion2b_s34b_b79k"
PREC = 0.85
MIN_PRED = 15
MIN_POS = 25
MAX_THINGS = 4

GENRE_PROMPT = {
    "portrait": "a portrait painting of a person", "self-portrait": "a self-portrait of a painter",
    "group portrait": "a group portrait painting of several people", "landscape": "a landscape painting",
    "seascape": "a seascape painting of the sea", "cityscape": "a painting of a city view",
    "architecture": "a painting of architecture", "still life": "a still life painting",
    "flowers": "a painting of a vase of flowers", "religious": "a religious painting", "mythological": "a mythological painting",
    "history": "a history painting", "battle": "a painting of a battle", "genre scene": "a genre painting of everyday life",
    "interior": "a painting of a room interior", "nude": "a painting of a nude figure", "animal": "a painting of animals",
    "allegory": "an allegorical painting", "vanitas": "a vanitas painting with a skull", "hunting": "a hunting scene painting",
    "abstract": "an abstract painting", "orientalist": "an orientalist painting", "fantasy": "a fantasy painting of a dream or monsters",
    "music & dance": "a painting of music or dancing",
}
THING_NAME = {"musical instrument": "a musical instrument", "grapes": "grapes and wine", "artist": "an artist at an easel",
              "windmill": "a windmill", "carriage": "a carriage or cart", "weapon": "a sword or weapon", "bread": "bread and food",
              "dress": "an elaborate dress", "crowd": "a crowd of people", "family": "a family", "ruins": "ancient ruins",
              "hat": "a hat", "village": "a village", "sky": "a dramatic sky with clouds", "sun": "the sun", "moon": "the moon",
              "night": "a night scene", "snow": "a snowy winter scene", "child": "a child", "woman": "a woman", "man": "a man",
              "couple": "a couple", "soldier": "a soldier", "elephant": "an elephant", "lion": "a lion", "butterfly": "an insect or butterfly",
              "cross": "a cross", "table": "a table", "window": "a window", "mirror": "a mirror", "candle": "a candle", "book": "a book",
              "vase": "a vase", "fruit": "fruit", "apple": "an apple", "lemon": "a lemon", "skull": "a skull", "flower": "flowers",
              "statue": "a statue", "chair": "a chair", "house": "a house", "city": "a city", "street": "a street",
              "waterfall": "a waterfall", "mountain": "mountains", "tree": "trees", "forest": "a forest", "field": "a field",
              "garden": "a garden", "bridge": "a bridge", "church": "a church", "castle": "a castle or palace", "desert": "a desert",
              "harbor": "a harbor", "beach": "a beach", "river": "a river", "lake": "a lake", "sea": "the sea", "boat": "a boat",
              "ship": "a sailing ship", "deer": "a deer", "rabbit": "a rabbit", "pig": "a pig", "goat": "a goat", "donkey": "a donkey",
              "sheep": "sheep", "cow": "a cow", "cat": "a cat", "dog": "a dog", "horse": "a horse", "bird": "a bird", "fish": "a fish"}
TEMPLATES = ["a painting of {}.", "an oil painting showing {}.", "a museum artwork depicting {}."]


def ensure_venv():
    try:
        import torch, open_clip  # noqa: F401
        return
    except ImportError:
        pass
    if not VENV_PY.exists():
        print("subjects_clip: no clipenv venv, skipping (see header of tools/subjects_clip.py)")
        sys.exit(0)
    if os.environ.get("_CLIP_REEXEC"):
        print("subjects_clip: venv python cannot import torch/open_clip, skipping")
        sys.exit(0)
    os.environ["_CLIP_REEXEC"] = "1"
    os.execv(str(VENV_PY), [str(VENV_PY), *sys.argv])


def load_model():
    import torch, open_clip
    dev = "mps" if torch.backends.mps.is_available() else "cpu"
    model, _, pre = open_clip.create_model_and_transforms(MODEL, pretrained=PRETRAINED)
    model = model.to(dev).eval()
    return torch, open_clip, model, pre, dev


class ImgDS:
    """Module level so DataLoader workers (spawn on macOS) can pickle it."""
    def __init__(self, todo, pre): self.todo, self.pre = todo, pre
    def __len__(self): return len(self.todo)
    def __getitem__(self, k):
        import torch
        from PIL import Image
        s, r = self.todo[k].split("-", 1)
        try:
            f = RAW / s / "img" / f"{r}.jpg"
            if not f.exists():
                f = RAW / "measure-img" / f"{self.todo[k]}.jpg"   # staged-measure cache (tools/measure_staged.py)
            im = Image.open(f)
            im.draft("RGB", (448, 448))
            return self.pre(im.convert("RGB")), 1
        except Exception:
            return torch.zeros(3, 224, 224), 0


def embed_new(ids, torch, model, pre, dev):
    import numpy as np
    from PIL import Image
    CACHE.mkdir(parents=True, exist_ok=True)
    have = EMB_IDS.read_text().splitlines() if EMB_IDS.exists() else []
    arr = np.load(EMB) if EMB.exists() and have else np.zeros((0, 512), np.float16)
    if len(arr) != len(have):
        have, arr = [], np.zeros((0, 512), np.float16)
    known = set(have)
    todo = [i for i in ids if i not in known]
    print(f"embeddings cached {len(have)}, to encode {len(todo)}", flush=True)
    if not todo:
        return have, arr

    dl = torch.utils.data.DataLoader(ImgDS(todo, pre), batch_size=64, num_workers=6, shuffle=False)
    st = {"ids": [], "new": [], "have": have, "arr": arr}
    bad, t0 = 0, time.time()

    def flush():
        if st["new"]:
            st["arr"] = np.concatenate([st["arr"], np.concatenate(st["new"])]); st["have"] = st["have"] + st["ids"]
            np.save(EMB, st["arr"]); EMB_IDS.write_text("\n".join(st["have"]) + "\n")
            st["ids"], st["new"] = [], []

    done = 0
    with torch.no_grad():
        for bi, (x, ok) in enumerate(dl):
            f = model.encode_image(x.to(dev))
            f = f / f.norm(dim=-1, keepdim=True)
            f = f.float().cpu().numpy().astype(np.float16)
            keep = ok.numpy().astype(bool)
            bad += int((~keep).sum())
            st["new"].append(f[keep]); st["ids"] += [todo[done + j] for j in range(len(keep)) if keep[j]]
            done += len(keep)
            if bi % 20 == 0:
                el = time.time() - t0
                print(f"  {done}/{len(todo)}  {done/el:.0f} img/s  eta {(len(todo)-done)/max(done/el,1e-9)/60:.0f} min  unreadable {bad}", flush=True)
            if bi % 100 == 99:
                flush()
    flush()
    print(f"encoded in {(time.time()-t0)/60:.1f} min; unreadable {bad}", flush=True)
    return st["have"], st["arr"]


def text_emb(names, torch, open_clip, model, dev, prompts=None):
    import numpy as np
    tok = open_clip.get_tokenizer(MODEL)
    out = []
    for n in names:
        ps = [prompts[n]] if prompts else [t.format(THING_NAME.get(n, n)) for t in TEMPLATES]
        with torch.no_grad():
            e = model.encode_text(tok(ps).to(dev)); e = e / e.norm(dim=-1, keepdim=True)
            e = e.mean(0); e = e / e.norm()
        out.append(e.float().cpu().numpy())
    return np.stack(out)


def prec_curve(scores, pos):
    """Scores sorted descending and the precision of 'score >= s' at each of them."""
    import numpy as np
    o = np.argsort(-scores)
    s, p = scores[o], pos[o].astype(np.float64)
    return s, np.cumsum(p) / np.arange(1, len(p) + 1)


def main():
    ensure_venv()
    import numpy as np
    label_only = "--label-only" in sys.argv
    ids = [l for l in (ROOT / "data/gallery/ids.txt").read_text().splitlines() if l]
    sj = json.load(open(ROOT / "data/gallery/subjects.json", encoding="utf-8"))
    tags, grp = sj["tags"], sj["grp"]
    torch, open_clip, model, pre, dev = load_model()
    print("device", dev, flush=True)
    if label_only:
        have = EMB_IDS.read_text().splitlines(); arr = np.load(EMB)
    else:
        have, arr = embed_new(ids, torch, model, pre, dev)
        if "--embed-only" in sys.argv:
            print(f"embed-only: {len(have)} cached embeddings"); return
    row = {k: i for i, k in enumerate(have)}
    idx = np.array([row.get(i, -1) for i in ids]); ok = idx >= 0
    E = np.zeros((len(ids), 512), np.float32); E[ok] = arr[idx[ok]].astype(np.float32)
    print(f"paintings with an embedding: {ok.sum()} / {len(ids)}  (missing/unreadable {(~ok).sum()})", flush=True)

    g_ix = [i for i, g in enumerate(grp) if g == "g"]; t_ix = [i for i, g in enumerate(grp) if g == "t"]
    gT = text_emb([tags[i] for i in g_ix], torch, open_clip, model, dev, GENRE_PROMPT)
    tT = text_emb([tags[i] for i in t_ix], torch, open_clip, model, dev)
    S = 100 * E @ gT.T
    S -= S.max(1, keepdims=True); P = np.exp(S); P /= P.sum(1, keepdims=True)    # genre softmax
    top = P.argmax(1); topp = P.max(1)
    TS = 100 * E @ tT.T
    TS = TS - TS.mean(1, keepdims=True)    # remove each painting's overall level so one image does not fire every tag

    ia = [set(x) for x in sj["ia"]]; it = [set(x) for x in sj["it"]]
    report = []
    cand = [[] for _ in ids]   # per painting [(kind, tagIdx, conf)]

    def calibrate(ti, sc, pos, sel_rows, fire_rows, fire_scores, kind):
        n_pos = int(pos.sum())
        if n_pos < MIN_POS or len(sc) == 0:
            return
        s, pr = prec_curve(sc, pos)
        good = np.where((pr >= PREC) & (np.arange(1, len(pr) + 1) >= MIN_PRED))[0]
        if len(good) == 0:
            report.append((tags[ti], n_pos, None, 0.0, 0.0, 0)); return
        cut = good[-1]; thr = s[cut]
        rec = pos[np.argsort(-sc)][: cut + 1].sum() / n_pos
        report.append((tags[ti], n_pos, float(thr), float(pr[cut]), float(rec), int(cut + 1)))
        for j, v in zip(fire_rows, fire_scores):
            if v >= thr:
                c = float(pr[min(np.searchsorted(-s, -v, side="right"), len(pr)) - 1])
                cand[j].append((kind, ti, max(c, PREC)))

    gset = set(g_ix)
    tr = [a | b for a, b in zip(ia, it)]   # calibration truth = authority OR title keyword (authority alone is very sparse)
    has_g = np.array([bool(a & gset) for a in tr]) & ok
    for k, ti in enumerate(g_ix):
        sel = np.where(has_g & (top == k))[0]
        pos = np.array([ti in tr[j] for j in sel], dtype=bool)
        n_pos_all = int(sum(ti in tr[j] for j in np.where(has_g)[0]))
        if n_pos_all < MIN_POS or len(sel) == 0:
            continue
        # calibrate the top-1 prediction against authority genre; recall is relative to all authority positives
        s, pr = prec_curve(topp[sel], pos)
        good = np.where((pr >= PREC) & (np.arange(1, len(pr) + 1) >= MIN_PRED))[0]
        if len(good) == 0:
            report.append((tags[ti], n_pos_all, None, 0.0, 0.0, 0)); continue
        cut = good[-1]; thr = s[cut]
        report.append((tags[ti], n_pos_all, float(thr), float(pr[cut]), float(pos[np.argsort(-topp[sel])][: cut + 1].sum() / n_pos_all), int(cut + 1)))
        fire = np.where(ok & (top == k) & (topp >= thr))[0]
        for j in fire:
            c = float(pr[min(np.searchsorted(-s, -topp[j], side="right"), len(pr)) - 1])
            cand[j].append(("g", ti, max(c, PREC)))

    has_a = np.array([bool(a) for a in tr]) & ok
    sel = np.where(has_a)[0]
    okrows = np.where(ok)[0]
    for k, ti in enumerate(t_ix):
        pos = np.array([ti in tr[j] for j in sel], dtype=bool)
        calibrate(ti, TS[sel, k], pos, sel, okrows, TS[okrows, k], "t")

    im = []
    for j in range(len(ids)):
        have_t = ia[j] | it[j]
        # a model genre only fills a gap: never next to a genre the museum/Wikidata already gave (CLIP calls gold portraits "religious")
        g = [] if any(i in gset for i in ia[j]) else [c for c in cand[j] if c[0] == "g" and c[1] not in have_t][:1]
        th = sorted([c for c in cand[j] if c[0] == "t" and c[1] not in have_t], key=lambda c: -c[2])[:MAX_THINGS]
        im.append([[c[1], int(round(c[2] * 100))] for c in g + th])
    sj["im"] = im
    sj.setdefault("prov", {})["im"] = {"model": f"{MODEL}/{PRETRAINED}", "min_precision": PREC, "embedded": int(ok.sum()),
                                       "any": sum(1 for x in im if x), "tags_used": sum(1 for r in report if r[2] is not None)}
    (ROOT / "data/gallery/subjects.json").write_text(json.dumps(sj, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    tab = sorted(report, key=lambda r: -r[1])
    lines = ["tag\tauthority_n\tthreshold\tprecision\trecall\tn_pred"] + [
        f"{a}\t{b}\t{'DROPPED' if c is None else f'{c:.3f}'}\t{d:.2f}\t{e:.2f}\t{f}" for a, b, c, d, e, f in tab]
    CACHE.mkdir(parents=True, exist_ok=True)
    (CACHE / "clip-calibration.tsv").write_text("\n".join(lines) + "\n", encoding="utf-8")
    kept = sum(1 for r in report if r[2] is not None)
    print(f"im written: {sum(1 for x in im if x)} paintings have at least one model tag; {kept}/{len(report)} tags passed {PREC:.0%} precision")
    if "--report" in sys.argv:
        print("\n".join(lines[:30]))


if __name__ == "__main__":
    main()
