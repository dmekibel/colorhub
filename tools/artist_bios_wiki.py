#!/usr/bin/env python3
"""Painter bios from Wikipedia's opening two sentences (CC BY-SA, credited in the sources line).
Writes data/artists/bios/<slug>.json for painters with a Wikipedia title (meta.json 'wp') and no bio yet.
Hand-written bios are never touched. Resumable: skips existing files. Then run tools/r2_sync.py."""
import json, os, re, time, urllib.request, urllib.parse
A = json.load(open("data/artists/meta.json"))["a"]; OUT = "data/artists/bios/"; os.makedirs(OUT, exist_ok=True)
ABBR = re.compile(r"(?:\b[A-Z]|\b(?:c|b|d|St|Dr|Mr|Mrs|Jr|Sr|ca|fl|r|Hon|Rev))\.$")
def sentences(t, n=2):
    t = re.sub(r"\s*\([^()]*\)", lambda m: m.group(0) if re.search(r"\d{3,4}", m.group(0)) else "", t)
    out, cur = [], ""
    for p in re.split(r"(?<=[.!?])\s+(?=[A-Z\"“])", t):
        cur = (cur + " " + p).strip()
        if ABBR.search(cur): continue
        out.append(cur); cur = ""
        if len(out) == n: break
    return out
done = bad = 0
for slug, v in A.items():
    f = OUT + slug + ".json"
    if not v.get("wp") or os.path.exists(f): continue
    try:
        r = urllib.request.Request("https://en.wikipedia.org/api/rest_v1/page/summary/" + urllib.parse.quote(v["wp"], safe="_"), headers={"User-Agent": "Chromatlas/1.0 (https://chromatlas.app; dmekibel@gmail.com)"})
        j = json.load(urllib.request.urlopen(r, timeout=20))
        if j.get("type") != "standard" or not j.get("extract"): bad += 1; continue
        s = sentences(j["extract"])
        if not s or len(s[0]) < 40: bad += 1; continue
        json.dump({"slug": slug, "lead": s[0], "paras": s[1:], "sources": ["From Wikipedia (CC BY-SA 4.0)"], "status": "wiki"}, open(f, "w"), ensure_ascii=False)
        done += 1
    except Exception as e:
        bad += 1
    time.sleep(0.15)
print("wrote", done, "skipped", bad)
