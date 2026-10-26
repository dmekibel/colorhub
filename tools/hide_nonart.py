#!/usr/bin/env python3
"""Hide the few items in the archive that are plainly NOT artworks (a blank scan, a journal cover, a screenshot, a hand-picked
list), WITHOUT touching the gallery order: write data/gallery/hidden.json, which the app reads as a filter.

  python3 tools/hide_nonart.py            # measure (cached) -> data/gallery/hidden.json
  python3 tools/hide_nonart.py --report   # also print what was hidden

The real fix for the pale-color pollution is the crop (tools/crop_margins.py): a small painting on a big white page is cropped to
the painting and its colors are measured inside the crop, so it no longer ranks first for White. This tool only handles items
that are not artworks at all, and it is deliberately conservative (2026-10-25, measured):
  * a CLIP zero-shot classifier ("a page of printed text", "a book cover", "a diagram" ...) was tried over all 206k items and is NOT
    reliable here: it flags Mondrians (white with black bars), Blake's text-and-image pages, Chinese calligraphy, manuscripts,
    book covers with icons and frame backs, all real collection objects. So it is not used to hide anything.
  * rule 1, blank: a cached photo whose pixels differ from its page by under 0.4% (nothing on it) on a light page.
  * rule 2, title: the title says it is not a picture ("journal cover", "magazine cover", "screenshot", "table of contents").
  * rule 3, photo (2026-10-26, David: "the Manet is a photograph of a painting instead of the painting itself"): Commons file uploads
    (commons-F...) that CLIP scores as a PHOTO OF A SETTING (a gallery wall with visitors, a frame on a wall, a church ceiling or altar)
    rather than the artwork itself. tools/audit_photos.py scores them (needs the clipenv) and writes data/hide-photos.json; this tool
    only reads that list. Checked on contact sheets of random rows per score band: nearly all >= 0.8 are such photos; Commons uploads only.
  * data/hide-overrides.json {"hide": [ids], "show": [ids]}: David's hand list; "show" wins over every rule.
Genuine drawings, sketches, prints, miniatures and watercolors are in scope and are never hidden.

Measuring (cached in research/_raw/subjects/nonart-feat.npy, about 90 s the first time): per item, from the cached 200 px photo
(research/_raw/<src>/img/<id>.jpg or measure-img/<id>.jpg), the share of pixels that differ from the border-ring color.

hidden.json: {"v":1,"n":N,"hash":sha1(ids.txt)[:8],"built":date,"idx":[sorted gallery indices],"why":{"<idx>":"blank|title|photo|hand"}}.
Items stay in the gallery (order is append-only, everything stores gallery positions). js/gallery.js loads the file with the
index (GAL.hid) and every ranking / list skips them; an address like #/gallery/<n> still opens a hidden painting.
"""
import datetime, glob, hashlib, json, os, re, sys, time
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
RAW = Path(os.environ.get("SUBJECTS_RAW", ROOT / "research" / "_raw"))
if not RAW.exists():
    RAW = Path("/Users/david/Documents/claudeCode/colorhub/research/_raw")
CACHE = Path(os.environ.get("NONART_CACHE", RAW / "subjects"))
FEAT = CACHE / "nonart-feat.npy"
OUT = ROOT / "data" / "gallery" / "hidden.json"
TITLE = re.compile(r"\b(journal|magazine)\s+cover\b|\bscreenshot\b|\btable of contents\b|\bletterhead\b", re.I)


def ids_hash(ids):
    return hashlib.sha1(("\n".join(ids) + "\n").encode()).hexdigest()[:8]


def measure(path):
    """-> (ink share, border luminance) of a cached photo, or None."""
    try:
        im = Image.open(path); im.draft("RGB", (200, 200)); a = np.asarray(im.convert("RGB"), np.float32)
    except Exception:
        return None
    ring = np.concatenate([a[:2].reshape(-1, 3), a[-2:].reshape(-1, 3), a[:, :2].reshape(-1, 3), a[:, -2:].reshape(-1, 3)])
    bg = np.median(ring, 0)
    return float((np.abs(a - bg).max(2) > 30).mean()), float(bg @ np.array([.299, .587, .114]))


def _job(a):
    i, k = a
    s, r = k.split("-", 1)
    for p in (RAW / s / "img" / f"{r}.jpg", RAW / "measure-img" / f"{k}.jpg"):
        if p.exists():
            return i, measure(p)
    return i, None


def features(ids):
    h = ids_hash(ids)
    if FEAT.exists() and (CACHE / "nonart-feat.hash").exists() and (CACHE / "nonart-feat.hash").read_text().strip() == h:
        return np.load(FEAT)
    from multiprocessing import Pool
    F = np.full((len(ids), 2), np.nan, np.float32)
    t0 = time.time()
    with Pool(8) as pool:
        for i, r in pool.imap_unordered(_job, list(enumerate(ids)), chunksize=256):
            if r:
                F[i] = r
    try:
        CACHE.mkdir(parents=True, exist_ok=True)
        np.save(FEAT, F); (CACHE / "nonart-feat.hash").write_text(h + "\n")
    except OSError:
        pass
    print(f"measured {int((~np.isnan(F[:, 0])).sum())} photos in {time.time() - t0:.0f}s")
    return F


def main():
    ids = (ROOT / "data" / "gallery" / "ids.txt").read_text().split("\n")
    pos = {k: i for i, k in enumerate(ids)}
    F = features(ids)
    why = {}
    for i in np.where((F[:, 0] < .004) & (F[:, 1] >= 200))[0]:
        why[int(i)] = "blank"
    for f in sorted(glob.glob(str(ROOT / "data" / "corpus" / "*.json"))):
        d = json.load(open(f))
        for x in (d if isinstance(d, list) else d.get("rows", [])):
            if x["id"] in pos and TITLE.search(x.get("t") or ""):
                why.setdefault(pos[x["id"]], "title")
    hp = ROOT / "data" / "hide-photos.json"
    if hp.exists():
        for k in json.load(open(hp)).get("ids", []):
            if k in pos:
                why.setdefault(pos[k], "photo")
    ov = ROOT / "data" / "hide-overrides.json"
    if ov.exists():
        o = json.load(open(ov))
        for k in o.get("hide", []):
            if k in pos:
                why[pos[k]] = "hand"
        for k in o.get("show", []):
            why.pop(pos.get(k), None)
    idx = sorted(why)
    OUT.write_text(json.dumps({"v": 1, "n": len(ids), "hash": ids_hash(ids), "built": datetime.date.today().isoformat(), "idx": idx,
                               "why": {str(i): why[i] for i in idx}}, separators=(",", ":")) + "\n")
    print(f"hidden.json: {len(idx)} of {len(ids)} hidden", {w: sum(1 for v in why.values() if v == w) for w in sorted(set(why.values()))})
    if "--report" in sys.argv:
        for i in idx:
            print(" ", i, ids[i], why[i])


if __name__ == "__main__":
    main()
