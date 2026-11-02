#!/usr/bin/env python3
"""Original size and source quality of every Commons painting that sits in a duplicate cluster (David, 2026-10-27: "when you merge
duplicates keep the most high quality professional version"). tools/hide_duplicates.py keeps the best copy of each cluster; the cached
photos are only 200 px wide, so quality has to come from Commons itself:

  python3 tools/dup_quality.py       # reads data/hide-dups.json (clusters), asks Commons for each file's pixel size and categories,
                                     # writes research/_raw/subjects/dup-quality.json {id: {"w", "h", "pro"}}; resumable, 1 request/s

  "pro" = 1 when the file sits in a category that marks a professional reproduction: Google Art Project, the Yorck Project, or a
  museum open-access / institutional upload (Rijksmuseum, Metropolitan, National Gallery of Art, ...). The cluster's keeper is then
  chosen by pixel count with a bonus for "pro" (see quality() in tools/hide_duplicates.py). Museum-source rows (nga-, aic-, met- ...)
  have no entry and are scored as a professional scan of about 4 megapixels.

Run order: hide_duplicates.py (find clusters) -> dup_quality.py (measure the members) -> hide_duplicates.py (keep the best).
"""
import json, re, sys, time, urllib.parse, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "research" / "_raw" / "subjects" / "dup-quality.json"
UA = "Chromatlas/1.0 (https://dmekibel.github.io/colorhub; dmekibel@gmail.com) dup-quality"
PRO = re.compile(r"google art project|yorck project|rijksmuseum|metropolitan museum|national gallery of art|art institute of chicago|"
                 r"cleveland museum|museum open access|cc0|public domain.*museum|high.resolution|wga|web gallery of art", re.I)


def title_of(url):
    m = re.search(r"Special:FilePath/([^?]+)", url or "")
    return "File:" + urllib.parse.unquote(m.group(1)).replace("_", " ") if m else None


def get(url):
    for k in range(6):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=40) as r:
                return json.load(r)
        except Exception as e:
            time.sleep(10 * (k + 1))
    return None


def main():
    d = json.load(open(ROOT / "data" / "hide-dups.json"))
    members = set(d["ids"]) | set(d["keep"].values())
    members = {i for i in members if i.startswith("commons")}
    import glob
    img = {}
    for f in glob.glob(str(ROOT / "data" / "corpus" / "*.json")):
        try:
            x = json.load(open(f))
        except Exception:
            continue
        for r in (x if isinstance(x, list) else next((v for v in x.values() if isinstance(v, list)), [])):
            if isinstance(r, dict) and r.get("id") in members:
                img[r["id"]] = title_of(r.get("img"))
    cache = json.load(open(OUT)) if OUT.exists() else {}
    todo = [(i, t) for i, t in img.items() if i not in cache and t]
    print(f"{len(img)} commons members, {len(todo)} to ask", flush=True)
    for s in range(0, len(todo), 40):
        batch = todo[s:s + 40]
        url = ("https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=size|extmetadata"
               "&iiextmetadatafilter=Categories|Credit|ImageDescription&titles=" + urllib.parse.quote("|".join(t for _, t in batch)))
        res = get(url)
        pages = (res or {}).get("query", {}).get("pages", {})
        by = {p.get("title"): p for p in pages.values()}
        norm = {n["from"]: n["to"] for n in (res or {}).get("query", {}).get("normalized", [])}
        for i, t in batch:
            p = by.get(norm.get(t, t))
            ii = (p or {}).get("imageinfo", [{}])[0]
            md = ii.get("extmetadata", {})
            blob = " ".join(md.get(k, {}).get("value", "") for k in ("Categories", "Credit"))
            cache[i] = {"w": ii.get("width", 0), "h": ii.get("height", 0), "pro": 1 if PRO.search(blob) else 0}
        if (s // 40) % 10 == 9:
            OUT.write_text(json.dumps(cache))
            print(f"  {s + 40}/{len(todo)}", flush=True)
        time.sleep(1.1)
    OUT.write_text(json.dumps(cache))
    print("done", len(cache))


if __name__ == "__main__":
    main()
