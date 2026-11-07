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
import json, os, re, sys
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
# a second and third question, asked of the rows the first one flags (David, 2026-10-26: "keep frescoes if the photo is a good angle
# and has minimal people"): is it shot straight on, and are there people in it?
FRONTAL = ["a straight-on photograph of a fresco or painting filling the whole frame",
           "a flat, frontal, evenly lit photo of a wall painting"]
ANGLED = ["a photograph taken at a steep angle from below showing a vaulted ceiling and architecture",
          "a wide photo of a church interior with columns, arches and a ceiling",
          "a photograph of a wall painting seen from the side at a sharp angle",
          "a photo of a painting in a gold frame hanging on a wall with the room around it"]
PEOPLE = ["a photo of real people in modern clothes standing in a gallery", "tourists and visitors looking at paintings in a museum",
          "a press photo of men and women in suits standing next to a painting", "a snapshot of a visitor posing in front of an artwork"]
NOPEOPLE = ["a painting full of painted figures", "a fresco with painted saints and angels", "a photograph of an artwork with no visitors in front of it",
            "a close-up of a painted face"]
CEILING = ["a ceiling or dome seen from below", "a vaulted ceiling with frescoes photographed upwards", "a dome with a skylight seen from underneath",
           "an upward photograph of a church vault"]
WALL = ["a painting on a wall seen straight on", "a framed painting photographed straight on", "an altarpiece photographed straight on",
        "a fresco on a wall photographed straight on and evenly lit"]
# David, 2026-11-07: "remove blatant photos of paintings from bad angles": a second test, run on every Commons row, for shots of the
# painting itself that are skewed, glaring or blurry (no room or people needed to be caught).
BADSHOT = ["a photograph of a building, street or doorway", "a photograph of a memorial plaque or sign on a wall",
           "a photograph of a museum hall or corridor", "a photograph of objects in a glass display case",
           "a photograph of a shop or a souvenir stand", "a smartphone photo of a painting hanging on a wall, taken at an angle, with the wall around it",
           "a photo of a framed picture shot from the side with strong perspective", "a painting photographed with bright glare and reflections",
           "a photo of a painting behind glass reflecting the room", "a photograph of a canvas leaning on the floor"]
CLEANSHOT = ["a painting", "a dark oil painting of a candlelit interior", "an abstract geometric painting", "a painting of a room interior",
             "a flat frontal reproduction of a painting", "a painting in its frame photographed straight on", "a drawing or sketch on paper",
             "a dark nocturne painting", "a painted portrait", "a landscape painting"]
# David, 2026-11-07: "from a distance, odd angle, rather than the painting being full screen".
DISTANT = ["a photo of a framed painting taken from far away, with the wall around the frame",
           "a framed painting hanging on a museum wall photographed from a distance, the frame and wall visible",
           "a photograph of a picture frame on a wall taken at an angle from the side",
           "a small framed painting in the middle of a large photo of a wall",
           "a photo of a gallery room with paintings in frames on the walls"]
FULL = ["a painting filling the entire image edge to edge", "a straight-on reproduction of a painting cropped exactly to its edges",
        "a close-up photograph showing only the painted canvas", "a scan of a painting with no background"]
# David, 2026-11-07: "no pictures that are paintings with diagrams on top of them".
DIAGRAM = ["a painting with geometric lines, circles and a composition diagram drawn over it",
           "an annotated painting with arrows, numbers and text labels on top",
           "a painting overlaid with a golden ratio spiral and grid lines",
           "a painting with colored outlines and markings drawn on it for analysis"]
PLAIN = ["a painting", "an unmarked reproduction of a painting", "a painting with nothing drawn on it", "a drawing on paper"]
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
    def pair(a, b):
        with torch.no_grad():
            X = model.encode_text(tok(a + b).to(dev)); X = (X / X.norm(dim=-1, keepdim=True)).float().cpu().numpy()
        Z = 100.0 * E @ X.T; Z -= Z.max(axis=1, keepdims=True); Q = np.exp(Z); Q /= Q.sum(axis=1, keepdims=True)
        return Q[:, :len(a)].sum(axis=1)
    bad = pair(BADSHOT, CLEANSHOT); far = pair(DISTANT, FULL); diag = pair(DIAGRAM, PLAIN)
    if "--diag" in sys.argv:
        isc = np.array([i.startswith("commons-") for i in ids]) & ok
        for t in (.5, .7, .8, .9, .95): print(f"diag >= {t}: {int(((diag >= t) & isc).sum())}")
        (RAW / "badshot-scores.json").write_text(json.dumps({ids[i]: round(float(diag[i]), 3) for i in np.where(isc & (diag >= .5))[0]}))
        return
    if "--far" in sys.argv:
        isc = np.array([i.startswith("commons-") for i in ids]) & ok
        for t in (.5, .7, .8, .9, .95, .98): print(f"far >= {t}: {int(((far >= t) & isc).sum())}")
        (RAW / "badshot-scores.json").write_text(json.dumps({ids[i]: round(float(far[i]), 3) for i in np.where(isc & (far >= .5))[0]}))
        return
    if "--bad" in sys.argv:   # calibration: write every Commons row's bad-shot score
        isc = np.array([i.startswith("commons-") for i in ids]) & ok
        for t in (.5, .6, .7, .8, .9, .95): print(f"bad >= {t}: {int(((bad >= t) & isc).sum())}")
        (RAW / "badshot-scores.json").write_text(json.dumps({ids[i]: round(float(bad[i]), 3) for i in np.where(isc & (bad >= .5))[0]}))
        print("wrote", RAW / "badshot-scores.json"); return
    frontal = pair(FRONTAL, ANGLED); people = pair(PEOPLE, NOPEOPLE); ceiling = pair(CEILING, WALL)
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
    if "--detail" in sys.argv:   # per-row scores for review sheets
        D = {ids[i]: [round(float(score[i]), 3), round(float(frontal[i]), 3), round(float(people[i]), 3), round(float(ceiling[i]), 3)] for i in np.where(score >= 0.5)[0]}
        (ROOT / "research/photos-detail.json").write_text(json.dumps(D)); print("wrote research/photos-detail.json", len(D))
    if "--why" in sys.argv:   # every score for one row: python tools/audit_photos.py --why commons-F123
        k = sys.argv[sys.argv.index("--why") + 1]; i = ids.index(k)
        print(k, names.get(k), {n: round(float(v[i]), 3) for n, v in (("setting", score), ("bad", bad), ("far", far), ("frontal", frontal), ("people", people), ("ceiling", ceiling))}); return
    if "--hide" in sys.argv:
        import datetime
        cut = float(sys.argv[sys.argv.index("--min") + 1]) if "--min" in sys.argv else 0.8
        # David, 2026-10-26: "keep frescoes if the photo is a good angle and minimal people": a flagged row stays visible when it is shot
        # straight on (frontal >= .7), not up at a ceiling or dome (ceiling <= .25) and has no real people in it (people <= .25).
        # Checked on contact sheets: the ceilings, domes, gallery rooms with visitors and printed pages all fall on the hide side.
        good = (frontal >= 0.7) & (ceiling <= 0.25) & (people <= 0.25)
        keep = [ids[i] for i in np.argsort(-score) if score[i] >= cut and ids[i].startswith("commons-F") and not good[i]]
        # 2026-11-07 (contact sheets at research/_raw/badshot-*): a real-world photo score >= .95 is ~90% junk (buildings, plaques,
        # museum halls, display cases); .85-.95 is mixed, so there it also needs the room/setting test above (score >= .5).
        isc = np.array([i.startswith("commons-") for i in ids]) & ok
        badhide = [ids[i] for i in np.where(isc & ((bad >= .95) | ((bad >= .85) & (score >= .5))))[0]]
        print(f"bad shots / real-world photos hidden: {len(set(badhide) - set(keep))} more")
        # 2026-11-07, David: "from far away, you can see the picture frame and stuff". The frame-and-wall test (far) also fires on
        # PAINTED gallery interiors (Panini), so it needs the shot to be a real photograph too.
        real = pair(["a real photograph taken with a camera", "a smartphone snapshot of a room or a wall", "a photo of a museum wall"],
                    ["an oil painting", "a painting depicting a room interior full of pictures", "a watercolor", "a print or engraving"])
        farhide = [ids[i] for i in np.where(isc & (far >= .9) & (real >= .5))[0]]
        print(f"far-away / framed-on-the-wall shots hidden: {len(set(farhide) - set(keep) - set(badhide))} more")
        keep = set(keep) | set(badhide) | set(farhide)
        # David, 2026-11-07: "church pictures: keep them if it's the only version of that art". A church/fresco shot is hidden only
        # when another row has the same painter and title.
        church = pair(["a photograph of a church interior", "a fresco or altarpiece photographed in a church", "a ceiling fresco seen from below"],
                      ["a museum gallery", "a framed painting on a wall", "a painting"])
        # titles that differ only by a trailing number ("... Hornu 1" / "... Hornu 2") are the same work
        norm = lambda s: re.sub(r"[\s\-_.(]*\d{1,2}\)?$", "", " ".join(str(s or "").lower().replace(",", " ").split()))
        cnt = {}
        for k, (a, t) in names.items(): cnt[(norm(a), norm(t))] = cnt.get((norm(a), norm(t)), 0) + 1
        pos = {k: n for n, k in enumerate(ids)}
        # never for a photo with visitors in it (2026-11-07: a Tintoretto with five people in front was kept as the "only copy")
        only = {k for k in keep if church[pos[k]] >= .6 and people[pos[k]] < .5 and cnt.get((norm(names.get(k, ("", ""))[0]), norm(names.get(k, ("", ""))[1])), 0) <= 1}
        print(f"church shots kept because they are the only copy: {len(only)}")
        keep = sorted(keep - only)
        print(f"flagged {sum(1 for i in np.where(score >= cut)[0] if ids[i].startswith('commons-F'))}, kept visible as good straight-on photos {sum(1 for i in np.where(score >= cut)[0] if ids[i].startswith('commons-F') and good[i])}")
        (ROOT / "data/hide-photos.json").write_text(json.dumps({"v": 1, "min": cut, "built": datetime.date.today().isoformat(), "ids": sorted(keep)}, separators=(",", ":")) + "\n")
        print(f"wrote data/hide-photos.json: {len(keep)} Commons file uploads at >= {cut}")
    for r in out[:40]: print(r["score"], r["id"], "|", r["artist"], "|", str(r["title"])[:80])


if __name__ == "__main__":
    main()
