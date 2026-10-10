#!/usr/bin/env python3
"""ColorHub: a lightweight painter index for every named painter who ISN'T one of the ~840 full profiles
(data/artists/meta.json, tools/wikidata_artists.py). Built straight from the gallery corpus -- no analysis
pipeline, no Wikidata lookups -- so it costs nothing to keep current and never blocks on a painter Wikidata
can't resolve.

  python3 tools/painters_lite.py

Why this exists (David, 2026-10-10): "Old Woman" (1655, Rijksmuseum) credits Moses ter Borch, a real painter
with real paintings in this archive but far too few (and too little documented) to earn one of the full,
analysis-backed profiles -- so his name rendered as plain, dead text instead of a link (js/artwiki.js's
awPaintingHook downgraded any painter missing from meta.json to inert text, rather than link to nothing). The
rule now: every painter name is tappable. js/artwiki.js's awPainter() tries the full profile first and falls
back to awPainterLite() -- a plain "every painting we have, with its palette" page -- for anyone this file lists.

Output: data/artists/lite.json  {v, built, a: {<slug>: {n, ix:[gallery index...], co?, y0?, y1?}}}
  ix are gallery indices (js/gallery.js's own order, the same one data/gallery/d/*.json and index.bin use) --
  js/gallery.js already knows how to draw any of those with its own palette, title and image, lazily, via
  glPinHTML/glGrid, so this file carries nothing about the paintings themselves, just which ones are whose.
  co is the most common non-null country among their paintings here (a stand-in for nationality: the gallery
  corpus doesn't carry a painter's nationality directly, only where a work is catalogued); y0/y1 is the
  earliest/latest dated work, when any of their paintings here has a year. Slugs use the exact same routeSlug()
  algorithm as js/router.js (NFKD, strip combining marks, lowercase, non-alnum runs -> '-'), so a painter who IS
  one of the full ~840 never gets a redundant lite entry here, and a lite slug never collides with a real one.

Safe to re-run: it rewrites data/artists/lite.json from scratch from whatever corpus and meta.json exist. Run it
after tools/gallery.py (which can reorder or rename gallery indices) and after tools/wikidata_artists.py (which
can grow the full ~840 and should shrink this file by exactly the painters it newly covers).
"""
import json, re, sys, unicodedata
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
import gallery as GAL  # noqa: E402  load_corpus() -- the exact same corpus, in the exact same order, tools/gallery.py builds index.bin/d/*.json from


def slug(s):
    """The same routeSlug() algorithm js/router.js uses at runtime: NFKD-normalize, drop combining marks
    (so "ter Borch", "Daniëlsz." and "van der Tempel" all fold the way the client will look them up), lowercase,
    collapse any run of non-alphanumerics to one '-', trim the ends."""
    s = unicodedata.normalize("NFKD", str(s))
    s = "".join(ch for ch in s if not unicodedata.combining(ch)).lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def main():
    corpus, files = GAL.load_corpus()
    meta_path = ROOT / "data" / "artists" / "meta.json"
    full = set(json.loads(meta_path.read_text(encoding="utf-8"))["a"].keys()) if meta_path.exists() else set()

    by_slug = {}
    skipped_full = 0
    for i, x in enumerate(corpus):
        a = x.get("a")
        if not a:
            continue
        sl = slug(a)
        if sl in full:
            skipped_full += 1
            continue   # already has a real profile -- js/artwiki.js's awPainter() reaches it directly, no lite entry needed
        e = by_slug.setdefault(sl, {"n": a, "ix": [], "co": {}, "y0": None, "y1": None})
        e["ix"].append(i)
        if x.get("co"):
            e["co"][x["co"]] = e["co"].get(x["co"], 0) + 1
        y = x.get("y")
        if y is not None:
            e["y0"] = y if e["y0"] is None else min(e["y0"], y)
            e["y1"] = y if e["y1"] is None else max(e["y1"], y)

    out = {}
    for sl, e in sorted(by_slug.items()):
        row = {"n": e["n"], "ix": e["ix"]}
        if e["co"]:
            row["co"] = max(e["co"].items(), key=lambda kv: kv[1])[0]
        if e["y0"] is not None:
            row["y0"] = e["y0"]
            row["y1"] = e["y1"]
        out[sl] = row

    doc = {"v": 1, "built": date.today().isoformat(), "a": out}
    out_path = ROOT / "data" / "artists" / "lite.json"
    out_path.write_text(json.dumps(doc, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    n_paintings = sum(len(e["ix"]) for e in out.values())
    print(f"data/artists/lite.json: {len(out)} painters without a full profile ({skipped_full} paintings already "
          f"covered by one of the {len(full)} full profiles), {n_paintings} paintings, "
          f"{out_path.stat().st_size / 1e3:.0f} KB")


if __name__ == "__main__":
    main()
