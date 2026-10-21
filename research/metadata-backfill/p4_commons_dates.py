"""Phase 4 (extra): years for Commons-category rows that have no Wikidata item (ids commons-F...) and no year.
Commons API prop=imageinfo&iiprop=extmetadata, 50 file titles per request; DateTimeOriginal parsed conservatively.
Cache: scratchpad cdate.jsonl {file title: raw DateTimeOriginal text}.  Output: scratchpad cdate_years.json {row id: [year, approx]}"""
import json, re, html, urllib.parse
from wd import *

CAPI = "https://commons.wikimedia.org/w/api.php"
rows = json.load(open(SCR + "/rows.json"))
todo = {}
for r in rows:
    if r["id"].startswith("commons-Q") or r["src"] != "commons" or r["y"]: continue
    # the file title comes from the thumbnail address (Special:FilePath/<name>) in the corpus rows; the page url is not in rows.json
    todo[r["id"]] = None
import glob
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
for f in glob.glob(ROOT + "/data/corpus/*.json"):
    for r in json.load(open(f)):
        if r["id"] in todo and todo[r["id"]] is None:
            m = re.search(r"/wiki/File:([^?]+)", r.get("url") or "") or re.search(r"Special:FilePath/([^?]+)", r.get("img") or "")
            if m: todo[r["id"]] = urllib.parse.unquote(m.group(1)).replace("_", " ")
files = sorted({v for v in todo.values() if v})
print(len(todo), "rows without a year;", len(files), "file titles", flush=True)
C = jl_load("cdate.jsonl")
need = [f for f in files if f not in C]
for i in range(0, len(need), 20):
    ch = need[i:i + 20]
    d = get(CAPI, dict(action="query", prop="imageinfo", iiprop="extmetadata", iiextmetadatafilter="DateTimeOriginal|DateTime",
                       titles="|".join("File:" + f for f in ch), format="json", maxlag=5, redirects=1))
    pages = d.get("query", {}).get("pages", {})
    norm = {n["to"]: n["from"] for n in d.get("query", {}).get("normalized", [])}
    red = {n["to"]: n["from"] for n in d.get("query", {}).get("redirects", [])}
    got = {}
    for pg in pages.values():
        t = pg.get("title", "")[5:]
        em = (pg.get("imageinfo") or [{}])[0].get("extmetadata", {})
        val = (em.get("DateTimeOriginal") or {}).get("value")
        got[t] = val
        src = red.get("File:" + t, "File:" + t); src = norm.get(src, src)
        got[src[5:]] = val
    for f in ch: jl_add("cdate.jsonl", f, got.get(f)); C[f] = got.get(f)
    if (i // 20) % 50 == 0: print(i, "/", len(need), flush=True)


def parse(s):
    if not s: return None
    t = html.unescape(re.sub(r"<[^>]+>", " ", s))
    t = re.sub(r"\s+", " ", t)
    if re.search(r"\d{1,2}(st|nd|rd|th)\s+century|century|siècle|secolo|Jahrhundert", t, re.I): return None
    ys = [int(x) for x in re.findall(r"(?<!\d)(1[2-9]\d\d)(?!\d)", t)]
    if not ys or len(set(ys)) > 2: return None
    lo, hi = min(ys), max(ys)
    if hi - lo > 30: return None
    approx = bool(re.search(r"\b(c\.|ca\.?|circa|about|around|um|vers|between|zwischen|entre)\b|\?", t, re.I)) or lo != hi
    return (lo + hi) // 2, int(approx)


out = {}
for rid, f in todo.items():
    if f and C.get(f):
        p = parse(C[f])
        if p: out[rid] = list(p)
json.dump(out, open(SCR + "/cdate_years.json", "w"))
print(len(out), "rows with a parsed year")
