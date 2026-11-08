#!/usr/bin/env python3
"""Korean art for Chromatlas (2026-11-08): Wikimedia Commons categories + the Met / Cleveland / Art Institute open-access APIs.

  python3 tools/korea_import.py crawl            # Commons: walk the Korean painting categories, cache file metadata (polite, ~1.2 s a request)
  python3 tools/korea_import.py museums          # Met (CSV + API), Cleveland (CC0 API), AIC (public-domain API): Korean paintings, prints, screens
  python3 tools/korea_import.py build            # select, fetch 200 px images, measure palettes, drop duplicates, write the staging shards
Env: COLORHUB_RAW=<main checkout>/research/_raw to reuse the shared image / palette caches (the coordinator's rebuild finds them there).
Output ONLY data/corpus-staging/zz-batch-korea-N.json (never data/corpus/).

Licence rule (hard): a Commons file is kept only when its licence line is public domain / PD-* / CC0 (KOGL, CC-BY(-SA), "copyrighted"
are dropped) AND the work is old: Joseon / Goryeo / Silla-period work is pre-1910 by definition; a named painter must have died before
1956; anything else needs a year <= 1930 in the file's own metadata. Museum rows: CC0 / public-domain flag set by the museum.
Polite: descriptive User-Agent, one request at a time with a pause, two retries after a 403/429 and then STOP (exit 3). No workarounds.
Artist names: a painter's own Commons category gives the romanized name (Kim Hong-do, Shin Yun-bok ...); otherwise the archive's existing
anonymous labels ("Joseon Painter", "Goryeo Buddhist Painter", "Joseon Buddhist Painter", "Korean Folk Painter", "Korean Screen Painter",
"Korean Painter").
"""
import glob, json, re, sys, time, urllib.parse, urllib.request, urllib.error
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
SCR = ROOT / "research" / "_scratch-korea"
SCR.mkdir(parents=True, exist_ok=True)
OUTDIR = ROOT / "data" / "corpus-staging"
API = "https://commons.wikimedia.org/w/api.php"
UA = "Chromatlas/1.0 (https://chromatlas.app; dmekibel@gmail.com) korea-importer"

# (root category, max depth)
ROOTS = [
    ("Paintings of the Joseon Dynasty", 3), ("Paintings from Korea", 3), ("Joseon Paintings in the National Museum of Korea", 3),
    ("Buddhist Paintings from Joseon", 3), ("Taoist Paintings from Joseon", 3), ("Goryeo Buddhist paintings", 3),
    ("Minhwa", 2), ("Chaekgeori", 2), ("Korean folding screens", 3), ("Folding screens of the Joseon Dynasty", 3), ("Byeongpung", 2),
    ("Sansuhwa", 2), ("Yeongmohwa", 2), ("Munjado", 2), ("Donggwoldo", 2), ("Hyewon pungsokdo", 2), ("Irworobongdo", 2),
    ("Painters of the Joseon Dynasty", 2), ("Miscellaneous Painters of Joseon", 2), ("Kim Hong-do", 3), ("Shin Yun-bok", 3),
    ("Jeong Seon", 3), ("Gang Se-hwang", 2), ("Sin Wi", 2), ("An Kyŏn", 2), ("Yi In-mun", 2), ("Heo Cho-hui", 2), ("Kim Deuk-sin", 2),
    ("Korean paintings in the Nezu Museum", 2), ("Korean paintings in the Detroit Institute of Arts", 2),
    ("Tigres de papier, cinq siècles de peinture en Corée", 2), ("Art of the Joseon Dynasty", 1),
    ("Religious art of the Joseon Dynasty", 2), ("Buddhist art of the Joseon Dynasty", 1), ("Korean Art Gallery", 1),
    ("Gunseondo (Kim Hong-do)", 2), ("Danwon pungsokdo", 2),
]
SKIP_CAT = re.compile(r"photograph|photos? of|building|house\b|grave|cemeter|tomb|\bpeople\b|\bmuseum\b|exhibition|signature|monogram|"
                      r"statue|sculpture|bust\b|stamp|biograph|memorial|plaque|\bsites?\b|studio|unidentified|by country|by year|"
                      r"templates|derivative|wikidata|needing|disputed|maps? of|logos?|ceramic|porcelain|celadon|stoneware|pottery|"
                      r"calligraph|pagoda|\bbell\b|temple\b|palace|castle|gate\b|footballer|president|election|film|drama|cuisine|"
                      r"architecture|\bwood(en)? ?block|printing|book|manuscript|seal\b|crown|jewel|costume|clothing|musical|"
                      r"lacquer|furniture|textile|embroider|flag|coin|banknote|^Category:(Kim|Park|Lee|Choi|Jung) ", re.I)
FILE_SKIP = re.compile(r"photo\b|photograph|exhibition|installation|signature|grave|\bgate\b|\bpagoda\b|\bstatue\b|screenshot|poster|"
                       r"cover\b|\blogo\b|\bmap of\b|\bdetail view\b|restoration of the|replica|reproduction|stamp|banknote", re.I)
IMG_EXT = re.compile(r"\.(jpe?g|png|tiff?)$", re.I)
PD_OK = re.compile(r"public domain|^pd\b|^pd-|cc0|\bpdm\b|no known copyright|PD-Art|PD-old|PD-Korea|PD-US", re.I)
LIC_BAD = re.compile(r"cc[- ]by|gfdl|fair use|attribution|non-?commercial|copyrighted|kogl type [234]|korea open government", re.I)


class Blocked(Exception):
    pass


_last = [0.0]


def api(params):
    url = API + "?" + urllib.parse.urlencode(params)
    for attempt in range(3):
        gap = 1.2 - (time.time() - _last[0])
        if gap > 0:
            time.sleep(gap)
        _last[0] = time.time()
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=90) as r:
                return json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            if e.code in (403, 429):
                if attempt == 2:
                    raise Blocked(f"HTTP {e.code} from Commons after two polite retries")
                time.sleep((20, 45)[attempt]); continue
            if e.code >= 500 and attempt < 2:
                time.sleep(10 * (attempt + 1)); continue
            raise
        except (urllib.error.URLError, TimeoutError, ConnectionError, json.JSONDecodeError):
            if attempt == 2:
                raise
            time.sleep(8 * (attempt + 1))


def strip(v):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", str((v or {}).get("value", "")))).strip()


def crawl():
    """BFS from ROOTS. files: pageid -> {page, cats: [category chain], ...}. Resumable via crawl.json."""
    cp = SCR / "crawl.json"
    st = json.loads(cp.read_text()) if cp.exists() else {"seen": [], "files": {}}
    seen, files = set(st["seen"]), st["files"]
    todo = [("Category:" + r, d, ["Category:" + r]) for r, d in ROOTS]
    n = 0
    while todo:
        c, depth, chain = todo.pop(0)
        if c in seen:
            continue
        seen.add(c)
        cont = {}
        while True:
            p = dict(format="json", action="query", generator="categorymembers", gcmtitle=c, gcmtype="file|subcat", gcmlimit=50,
                     prop="imageinfo", iiprop="url|size|mime|extmetadata",
                     iiextmetadatafilter="DateTimeOriginal|ObjectName|ImageDescription|LicenseShortName|Artist")
            p.update(cont)
            r = api(p)
            for pg in (r.get("query", {}).get("pages", {}) or {}).values():
                t = pg.get("title", "")
                if pg.get("ns") == 14:
                    if depth > 0 and not SKIP_CAT.search(t) and t not in seen:
                        todo.append((t, depth - 1, chain + [t]))
                elif pg.get("ns") == 6:
                    k = str(pg["pageid"])
                    if k not in files:
                        ii = (pg.get("imageinfo") or [{}])[0]
                        md = ii.get("extmetadata") or {}
                        files[k] = dict(title=t, w=ii.get("width", 0), h=ii.get("height", 0), mime=ii.get("mime", ""),
                                        lic=strip(md.get("LicenseShortName")), date=strip(md.get("DateTimeOriginal")),
                                        obj=strip(md.get("ObjectName")), desc=strip(md.get("ImageDescription"))[:300],
                                        artist=strip(md.get("Artist"))[:120], chain=chain)
            if "continue" not in r:
                break
            cont = r["continue"]
        n += 1
        print(f"{c} (depth left {depth}): {len(files)} files, {len(todo)} queued", flush=True)
        if n % 10 == 0:
            cp.write_text(json.dumps({"seen": sorted(seen), "files": files}, ensure_ascii=False))
    cp.write_text(json.dumps({"seen": sorted(seen), "files": files}, ensure_ascii=False))
    print(f"crawled {len(seen)} categories, {len(files)} files")


# ---------------------------------------------------------------------------------------------------------------------------
# select + build
# ---------------------------------------------------------------------------------------------------------------------------
PD_OK = re.compile(PD_OK.pattern + r"|kogl type 1", re.I)   # KOGL Type 1 = free reuse incl. commercial, attribution; the works are Joseon / Goryeo
OLD_CTX = re.compile(r"joseon|choson|goryeo|koryo|silla|minhwa|chaekgeori|byeongpung|irworobongdo|sansuhwa|yeongmohwa|munjado|donggwoldo|"
                     r"hyewon|danwon|gwaebul|eojin|water-moon|gisa gyecheop|haenghaeng|sunjeoldo|nahan|kumgangsan|geumgang", re.I)
NOT_ART = re.compile(r"stele|headstone|armou?r|helmet|vase|porcelain|celadon|bookcase|burner|metalwork|ojukheon|statue|sculpture|pagoda|"
                     r"tomb|goguryeo|gold crown|\bbell\b|\bseal\b|lacquer|tripitaka|hanja|calligraphy|"
                     r"banknote|currency|painter of the wind|yoo youngkuk|gim jong-tae|portrait of yoo|belt ornament|lantern|\ub4f1\ub300|\uc11d\ub4f1|\u8a69|poem|ornaments", re.I)
# category (regex) -> (display name, born, died); only painters who died before 1956 and whose category carries their work
PAINTERS = [
    (r"Kim Hong-do|Danwon|Gunseondo", "Kim Hong-do", 1745, 1806), (r"Shin Yun-bok|Hyewon", "Shin Yun-bok", 1758, 1813),
    (r"Jeong Seon|Geumgang jeondo", "Jeong Seon", 1676, 1759), (r"Chae Yong-sin", "Chae Yong-sin", 1850, 1941),
    (r"An Jung-sik", "An Jung-sik", 1861, 1919), (r"^Category:Heo Mok$", "Heo Mok", 1595, 1682),
    (r"Kim Deuk-sin", "Kim Deuk-sin", 1754, 1822), (r"Jang Seung-eop|Chang Seung-ob", "Jang Seung-eop", 1843, 1897),
    (r"Yun Du-seo", "Yun Du-seo", 1668, 1715), (r"^Category:Yu Suk$", "Yu Suk", 1827, 1873),
    (r"Sim Sa-jeong", "Sim Sa-jeong", 1707, 1769), (r"Shin Saimdang", "Shin Saimdang", 1504, 1551),
    (r"^Category:Yi Jeong$", "Yi Jeong", 1541, 1622), (r"^Category:Sin Wi$", "Sin Wi", 1769, 1847),
    (r"Gang Se-hwang", "Gang Se-hwang", 1713, 1791), (r"Kang Hui-eon", "Kang Hui-eon", 1738, 1784),
    (r"Yi Jae-gwan", "Yi Jae-gwan", 1783, 1837), (r"Yi In-mun", "Yi In-mun", 1745, 1821), (r"Choe Buk|Choi Buk", "Choe Buk", 1712, 1786),
    (r"An Kyŏn", "An Gyeon", 1418, 1464), (r"Nam Gye-u", "Nam Gye-u", 1811, 1888),
    (r"Gang, Hui-an", "Gang Hui-an", 1417, 1464), (r"Gim Gyu-jin", "Gim Gyu-jin", 1868, 1933), (r"Ji Un-yeong", "Ji Un-yeong", 1852, 1935),
    (r"Yi Myeong-gi", "Yi Myeong-gi", None, None), (r"Eo Mongryong", "Eo Mongryong", None, None), (r"Yi Han-cheol", "Yi Han-cheol", None, None),
    (r"Yang Ki-hun", "Yang Ki-hun", None, None), (r"Byeon Sang-byeok", "Byeon Sang-byeok", None, None), (r"Yi in-seong", "Yi In-seong", None, None),
    (r"^Category:Yi Am$", "Yi Am", 1499, 1545), (r"^Category:Yi U \(1542\)$", "Yi U", 1542, 1609), (r"Yi Yu-won", "Yi Yu-won", None, None),
    (r"Kim Yang-ki", "Kim Yang-ki", None, None),
]
FAMILY_NAMES = [   # first match over the whole chain + title decides
    (r"goryeo", "Goryeo Buddhist Painter", "Goryeo Buddhist painting"),
    (r"gwaebul|buddhist|nahan|water-moon|avalokite|amit", "Joseon Buddhist Painter", "Joseon Buddhist painting"),
    (r"minhwa|chaekgeori|moran|hojeopdo|paintings of tigers", "Korean Folk Painter", "Minhwa"),
    (r"byeongpung|folding screen|irworobongdo|munjado|screen", "Korean Screen Painter", "Korean screen"),
    (r"eojin|official portraits|portraits of korea|portrait", "Joseon Portrait Painter", "Joseon portrait painting"),
    (r"donggwoldo|gisa gyecheop|haenghaeng|sunjeoldo|court|chochungdo|royal", "Joseon Court Painter", "Joseon court painting"),
    (r"sansuhwa|landscape|kumgangsan|geumgang", "Joseon Painter", "Joseon landscape painting"),
]
PERIOD_GUESS = [(r"first period", 1500, 220), (r"mid joseon", 1750, 100), (r"late joseon", 1855, 60), (r"goryeo", 1300, 300)]


def parse_when(date, obj, desc, title):
    """(year, span) from Commons metadata. Wikidata date strings carry 'QS:P571,+1793-00-00T00:00:00Z/9' (9 year, 8 decade, 7 century)."""
    blob = " | ".join([date, obj, desc, title])
    m = re.search(r"P1319,\+(\d{4})-[^,]*?/\d,P1326,\+(\d{4})-", blob)
    if m:
        a, b = int(m.group(1)), int(m.group(2))
        return (a + b) // 2, b - a
    m = re.search(r"P571,\+(\d{4})-\d\d-\d\dT[\d:]+Z/(\d)", blob)
    if m:
        pr = int(m.group(2))
        if pr == 9: return int(m.group(1)), 0
        if pr == 8: return int(m.group(1)) + 5, 10
        if pr == 7: return int(m.group(1)), 100
    m = re.search(r"(\d{1,2})\s*(?:st|nd|rd|th)[ -]*century", blob, re.I)
    if m and 9 <= int(m.group(1)) <= 20:
        return (int(m.group(1)) - 1) * 100 + 50, 100
    for t in (date, obj, desc, title):
        t = re.sub(r"\uc81c\s*\d+\s*\ud638|No\.?\s*\d+", "", re.sub(r"\d{4}-\d\d-\d\d[ T]\d\d:\d\d:\d\d", "", t))   # a treasure number is not a year
        for y in re.findall(r"(?<!\d)(1[0-9]\d\d)(?!\d)", t):
            if 1000 <= int(y) <= 1930:
                return int(y), 0
    return None, None


def painter_of(f):
    for pat, name, b, d in PAINTERS:
        for c in reversed(f["chain"]):
            if re.search(pat, c):
                return name, b, d
    return None


def classify(f):
    text = " ".join(f["chain"] + [f["title"], f["obj"]]).lower()
    for pat, a, mv in FAMILY_NAMES:
        if re.search(pat, text):
            return a, mv
    return "Joseon Painter", "Joseon painting"


def select_commons():
    crawl_ = json.loads((SCR / "crawl.json").read_text())["files"]
    drops, out = Counter(), []
    for pid, f in crawl_.items():
        t = f["title"].split(":", 1)[1]
        name = re.sub(r"\.(jpe?g|png|tiff?)$", "", t, flags=re.I).replace("_", " ")
        if not IMG_EXT.search(t) or not f["mime"].startswith("image/"): drops["type"] += 1; continue
        if min(f["w"], f["h"]) < 400: drops["size"] += 1; continue
        if FILE_SKIP.search(name) or NOT_ART.search(name + " " + " ".join(f["chain"])): drops["title / not a painting"] += 1; continue
        lic = f["lic"]
        if not lic or LIC_BAD.search(lic) or not PD_OK.search(lic): drops["licence (" + (lic or "none") + ")"] += 1; continue
        ctx = bool(OLD_CTX.search(" ".join(f["chain"]) + " " + name + " " + f["obj"]))
        who = painter_of(f)
        y, span = parse_when(f["date"], f["obj"], f["desc"], name)
        if who and who[2]:
            if y is not None and not (who[1] - 5 <= y <= who[2] + 30):   # a restoration / photograph date, not when it was painted
                y, span = None, None
            if y is None:
                y, span = (who[1] + who[2]) // 2 + 10, max(40, (who[2] - who[1]) // 2)
        if who and not who[2] and not ctx and y is None:
            drops["named painter, no date"] += 1; continue
        if not who and not ctx and not (y is not None and y <= 1930):
            drops["copyright / not clearly pre-1931"] += 1; continue
        if y is None:
            for pat, gy, gs in PERIOD_GUESS:
                if re.search(pat, " ".join(f["chain"]).lower()):
                    y, span = gy, gs; break
        if y is None:
            y, span = (1300, 300) if re.search("goryeo", name.lower()) else (1750, 300)   # an undated Joseon-era work: mid-Joseon, wide span
        if y > 1930 or y < 1000:
            drops["date outside 1000-1930"] += 1; continue
        if f["chain"][-1] == "Category:Portraits of Korea" and y > 1860:
            drops["portrait category: likely a photograph"] += 1; continue
        a, mv = classify(f)
        if who:
            a = who[0]
        title = f["obj"] or name
        out.append(dict(q=f"F{pid}", t=title[:160], file=t, y=y, span=span, a=a, mv=mv, lic=lic, named=bool(who)))
    return out, drops


def main_build():
    sys.argv = [sys.argv[0], "Korean artists", "Q0", "--stage"]
    import artist_extra as AE
    C = AE.C
    C.SRC["commons"].update(gap=0.5, workers=2)   # politer than the shared default (0.12 s, 6 workers)
    existing = C.load_corpus()
    held_ids = {r["id"] for r in existing}
    for fz in glob.glob(str(OUTDIR / "*.json")):
        if not Path(fz).name.startswith("zz-batch-korea-"):
            try: existing += json.loads(Path(fz).read_text())
            except Exception: pass
    kor = [r for r in existing if r.get("co") == "Korea"]
    tkey = lambda r: (re.sub(r"[^a-z0-9\uac00-\ud7a3]", "", (r.get("t") or "").lower()), re.sub(r"[^a-z]", "", (r.get("a") or "").lower()))
    kor_keys = {tkey(r) for r in kor}
    cands, drops = select_commons()
    n0 = len(cands)
    cands = [c for c in cands if f"commons-{c['q']}" not in held_ids]
    print(f"commons: {n0} pass filters ({dict(drops)}); {n0 - len(cands)} already in corpus; {len(cands)} new", flush=True)
    for c in cands:
        c.update(img="http://commons.wikimedia.org/wiki/Special:FilePath/" + urllib.parse.quote(c["file"]), years=[c["y"]], coll=set(),
                 inst={"painting"}, mat=set(), co={"Korea"}, ext=set(), cls="other", h=None, w=None)
    orig, blocks = C.fetch, [0]

    def guarded(src, url, *a, **k):
        if blocks[0] >= 3:
            raise Blocked("stopped after repeated 403/429")
        k["tries"] = 2
        try:
            return orig(src, url, *a, **k)
        except urllib.error.HTTPError as e:
            if e.code in (403, 429):
                blocks[0] += 1
            raise
    C.fetch = guarded
    try:
        bad = AE.fetch_images(cands)
    finally:
        C.fetch = orig
    pals = AE.palettes(cands)
    rows = AE.build_rows(cands, pals)
    meta = {f"commons-{c['q']}": c for c in cands}
    for r in rows:
        c = meta[r["id"]]
        r.update(a=c["a"], y=c["y"], co="Korea", mv=c["mv"], license=c["lic"])
        if c["span"]:
            r["span"] = c["span"]
        r["_cls"] = "other"
    print(f"commons rows measured: {len(rows)} (images failed {len(bad)})", flush=True)
    rows += museum_rows(C, AE, held_ids)
    keep0, dtk = [], 0
    seen = set(kor_keys)
    for r in rows:
        k = tkey(r)
        if r["a"] and k in seen and not re.match(r"^(untitled|unknown)", r["t"], re.I):
            dtk += 1; continue
        seen.add(k); keep0.append(r)
    keep, dup = AE.drop_duplicates(keep0, [o for o in kor if o.get("L") is not None])
    print(f"dropped: same title+artist {dtk}, twins/duplicates {len(dup)} ({dict(Counter(' '.join(d[1].split(' ')[:2]) for d in dup))})", flush=True)
    out = []
    for r in sorted(keep, key=lambda r: (r["a"] or "", r["y"], r["id"])):
        out.append({k: v for k, v in r.items() if not k.startswith("_")})
    OUTDIR.mkdir(parents=True, exist_ok=True)
    for f in glob.glob(str(OUTDIR / "zz-batch-korea-*.json")):
        Path(f).unlink()
    SIZE = 1500
    for n in range(0, len(out), SIZE):
        part = out[n:n + SIZE]
        p = OUTDIR / f"zz-batch-korea-{n // SIZE + 1}.json"
        p.write_text("[\n" + ",\n".join(json.dumps(r, ensure_ascii=False, separators=(",", ":")) for r in part) + "\n]\n", encoding="utf-8")
        print("wrote", p.relative_to(ROOT), len(part))
    print("by source:", dict(Counter(r["src"] for r in out)))
    print("by artist:", Counter(r["a"] for r in out).most_common(45))
    print("by mv:", dict(Counter(r["mv"] for r in out)))
    print("by licence:", dict(Counter(r.get("license") for r in out)))
    if blocks[0] >= 3:
        print("NOTE: Commons image downloads were blocked part-way (403/429); rerun later.")


def museum_rows(C, AE, held_ids):
    """Met (Open Access CSV + API) and Cleveland (CC0 API) Korean paintings / prints / screens not yet in the corpus."""
    import csv
    import numpy as np
    import measure_staged as MS
    import met_asia_extra as MA
    app = C.app_names()
    app_lab = C.rgb_to_lab(np.array([C.hex_to_rgb(h) for _, h in app]))
    rows = []
    MS.get_image = lambda row: _ensure(C, MS, row)   # corpus layout (RAW/<src>/img/<id>.jpg) so the duplicate test finds the copy
    csv.field_size_limit(sys.maxsize)
    cls_ok = re.compile(r"^(Paintings|Drawings|Illustrated Books|Prints|Screens|Albums|Fans|Codices|Manuscripts)(\||$)", re.I)
    ids = []
    csvp = C.RAW / "met" / "MetObjects.csv"
    if csvp.exists():
        for x in csv.DictReader(open(csvp, newline="", encoding="utf-8-sig")):
            t = " ".join([x["Culture"], x["Country"], x["Period"], x["Dynasty"], x["Region"]])
            if x["Is Public Domain"] != "True" or not re.search(r"korea|joseon|goryeo|choson|silla", t, re.I) or not cls_ok.match(x["Classification"] or ""):
                continue
            if f"met-{x['Object ID']}" in held_ids:
                continue
            try:
                if int(x["Object End Date"]) > 1930: continue
            except ValueError:
                continue
            ids.append(int(x["Object ID"]))
    print(f"met: {len(ids)} Korean public-domain paintings/drawings/prints not in corpus", flush=True)
    for oid in ids:
        rec = MA.get_record(oid, 1.0)
        if not rec or rec.get("_missing") or not rec.get("isPublicDomain") or not rec.get("primaryImageSmall"):
            continue
        r = MA.to_row(rec)
        r["co"] = "Korea"
        r["a"] = r.get("a") or "Korean Painter"
        r["mv"] = r.get("mv") or "Korean painting"
        if r.get("y") is None or r["y"] < 1000 or r["y"] > 1930:
            continue
        rows.append(r)
    skip = 0
    while True:
        time.sleep(0.6)
        q = urllib.parse.urlencode(dict(cc0=1, has_image=1, culture="Korea", limit=100, skip=skip,
                                        fields="id,accession_number,title,creation_date,creation_date_earliest,creation_date_latest,culture,creators,images,type,technique,department,url"))
        req = urllib.request.Request("https://openaccess-api.clevelandart.org/api/artworks/?" + q, headers={"User-Agent": UA})
        d = json.load(urllib.request.urlopen(req, timeout=60))
        for x in d["data"]:
            if x.get("type") not in ("Painting", "Drawing", "Print", "Bound Volume") or f"cma-{x['id']}" in held_ids:
                continue
            if not ((x.get("images") or {}).get("web") or {}).get("url"):
                continue
            r = C.norm_record("cma", x)
            r["co"] = "Korea"
            r["a"] = r.get("a") or "Korean Painter"
            r["mv"] = r.get("mv") or "Korean painting"
            if r.get("y") is None or r["y"] < 1000 or r["y"] > 1930:
                continue
            r["license"], r["url"], r["medium"] = "CC0", x.get("url"), (x.get("technique") or "")[:120] or None
            rows.append(r)
        skip += 100
        if skip >= d["info"]["total"]:
            break
    print(f"museums: {len(rows)} new rows ({dict(Counter(r['src'] for r in rows))}); measuring", flush=True)
    out = []
    for r in rows:
        try:
            res = MS.measure(r, app, app_lab)
        except Exception as e:
            print("  no image/palette:", r["id"], str(e)[:60]); continue
        if res:
            r["p"], r["L"], r["C"] = res
            out.append(r)
    return out


def _ensure(C, MS, row):
    import io
    from PIL import Image
    src, rid = row["id"].split("-", 1)
    p = C.img_path(src, rid)
    p.parent.mkdir(parents=True, exist_ok=True)
    if p.exists() and p.stat().st_size > 500:
        return p
    time.sleep(1.0)
    im = Image.open(io.BytesIO(MS.fetch(row["img"]))).convert("RGB")
    if im.width > C.IMG_W:
        im = im.resize((C.IMG_W, max(1, round(im.height * C.IMG_W / im.width))), Image.LANCZOS)
    im.save(p, "JPEG", quality=92)
    return p


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    try:
        if cmd == "crawl":
            crawl()
        elif cmd == "build":
            main_build()
        elif cmd == "status":
            c, d = select_commons()
            print(len(c), dict(d))
            print(Counter(x["a"] for x in c).most_common(50))
        else:
            print(__doc__)
    except Blocked as e:
        print("BLOCKED:", e, "- stopped, nothing worked around.")
        sys.exit(3)
