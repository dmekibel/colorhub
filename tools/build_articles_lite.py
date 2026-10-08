#!/usr/bin/env python3
"""A small index of the written articles, for the color page's "Its story lives with ..." twin block (design/
COLOR-PAGE-DESIGN.md §5): data/analysis/articles-lite.json = [[slug, name, hex, words, tier, lede, [served names]], ...].
The page loads it lazily; re-run after articles are added (python3 tools/build_articles_lite.py)."""
import json, glob, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
out = []
for f in sorted(glob.glob("data/articles/*.json")):
    if f.endswith("index.json"):
        continue
    a = json.load(open(f, encoding="utf-8"))
    if not a.get("lede") or not a.get("hex"):
        continue
    out.append([a.get("slug") or os.path.basename(f)[:-5], a.get("name"), a["hex"], int(a.get("words") or 0), a.get("tier", ""), a["lede"], a.get("names", [])])
json.dump(out, open("data/analysis/articles-lite.json", "w", encoding="utf-8"), separators=(",", ":"), ensure_ascii=False)
print(len(out), "articles,", os.path.getsize("data/analysis/articles-lite.json"), "bytes")
