"""Commons category staging (2026-10-23): files in chosen Wikimedia Commons categories (the Yorck Project's PD-Art files, Fayum
portraits, Pompeii frescoes, Egyptian paintings, Book of the Dead, icons, Gothic and century-of-painting categories) with their
{{Artwork}} metadata (title, artist, date) read from the API (extmetadata), no download. Rows: id cf-<pageid>, src commons,
url = the Commons file page, license from the file's LicenseShortName (PD / CC0; CC BY(-SA) -> src commonscc).
Dates before 1500 only (negative = BCE), span <= 200, no details/crops. Politeness: UA Chromatlas/1.0, one request at a time,
1.2 s apart, maxlag=5, backoff on 429.
  python3 tools/stage/ma_commons.py crawl   # fill the cache ($STAGE_SCRATCH/raw/cc)
  python3 tools/stage/ma_commons.py stage"""
import hashlib, html, json, re, sys, time, urllib.parse
from collections import Counter
from pathlib import Path
import requests
sys.path.insert(0, str(Path(__file__).resolve().parent))
import ma_common as M
import de_gb
from ma_common import C, SCR
from nw import country

A = "https://commons.wikimedia.org/w/api.php"
UA = "Chromatlas/1.0 (https://chromatlas.app; dmekibel@gmail.com)"
RAW = SCR / "raw" / "cc"
RAW.mkdir(parents=True, exist_ok=True)
sess = requests.Session()
sess.headers["User-Agent"] = UA
_last = [0.0]

ROOTS = [("PD-Art (Yorck Project)", 0), ("Yorck Project paintings missing described by source", 0),
         ("Fayum mummy portraits", 3), ("Ancient Roman frescos in Pompeii", 3), ("Ancient Roman paintings", 3),
         ("Ancient Egyptian paintings", 3), ("Book of the Dead", 3), ("Byzantine icons", 3), ("Coptic icons", 3),
         ("Gothic paintings", 3), ("Etruscan paintings", 3), ("Ancient paintings", 3), ("Medieval paintings", 3),
         ("Icons by country", 3), ("Icons", 2), ("Russian icons", 2)] + \
        [(f"{n}-century{' BC' if bc else ''} paintings", 3) for bc, n in
         [(True, "13th"), (True, "6th"), (True, "5th"), (True, "4th"), (True, "3rd"), (True, "1st")]] + \
        [(f"{n}-century paintings", 3) for n in ("1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th", "11th", "12th",
                                                  "13th", "14th", "15th")]
SKIP_CAT = re.compile(r"by artist|painters|by title|Details of|Black and white|not categori|stamps|in art|by museum|by location|"
                      r"by subject|photograph|reproduction|copies|forgeries|exhibition|books|sculpt|coins|ceramics|vases", re.I)


def api(params):
    key = hashlib.md5(json.dumps(params, sort_keys=True).encode()).hexdigest()
    p = RAW / (key + ".json")
    if p.exists():
        return json.loads(p.read_text())
    for i in range(8):
        w = _last[0] + 1.2 - time.time()
        if w > 0:
            time.sleep(w)
        _last[0] = time.time()
        try:
            r = sess.get(A, params=dict(params, format="json", maxlag=5), timeout=90)
            if r.status_code == 429:
                time.sleep(20 * (i + 1))
                continue
            d = r.json()
            if "error" in d:
                time.sleep(6 * (i + 1))
                continue
            p.write_text(json.dumps(d))
            return d
        except Exception as e:
            print("  retry", e, flush=True)
            time.sleep(6 * (i + 1))
    raise RuntimeError("commons gave up")


def members(cat, typ):
    out, cont = [], {}
    while True:
        d = api(dict(action="query", list="categorymembers", cmtitle="Category:" + cat, cmtype=typ, cmlimit=500, **cont))
        out += [x["title"] for x in d["query"]["categorymembers"]]
        if "continue" not in d:
            return out
        cont = d["continue"]


def files_with_meta(cat):
    """All files of one category with extmetadata, 50 per request (generator)."""
    out, cont = [], {}
    while True:
        d = api(dict(action="query", generator="categorymembers", gcmtitle="Category:" + cat, gcmtype="file", gcmlimit=50,
                     prop="imageinfo", iiprop="extmetadata|mime|size",
                     iiextmetadatafilter="ObjectName|Artist|DateTimeOriginal|LicenseShortName|ImageDescription", **cont))
        for pg in (d.get("query") or {}).get("pages", {}).values():
            ii = (pg.get("imageinfo") or [{}])[0]
            if ii.get("mime", "").startswith("image/") and ii["mime"] in ("image/jpeg", "image/png", "image/tiff"):
                out.append(dict(pid=pg["pageid"], title=pg["title"], em={k: v.get("value", "") for k, v in (ii.get("extmetadata") or {}).items()},
                                w=ii.get("width"), h=ii.get("height")))
        if "continue" not in d:
            return out
        cont = d["continue"]
        if len(out) % 1000 < 50:
            print(f"    {cat}: {len(out)} files", flush=True)


def crawl():
    seen, files = set(), {}
    stack = [(c, d, c) for c, d in ROOTS]
    while stack:
        cat, depth, root = stack.pop(0)
        if cat in seen:
            continue
        seen.add(cat)
        fs = files_with_meta(cat)
        for f in fs:
            files.setdefault(f["pid"], dict(f, roots=set()))["roots"].add(root)
        print(f"{cat} (depth {depth}, root {root}): {len(fs)} files; total {len(files)}", flush=True)
        if depth > 0:
            for sc in members(cat, "subcat"):
                name = sc[len("Category:"):]
                if not SKIP_CAT.search(name) and name not in seen:
                    stack.append((name, depth - 1, root))
    return files


def txt(h):
    h = re.sub(r"<div style=\"display: ?none;?\">.*?</div>", "", h or "", flags=re.S)
    h = re.sub(r"<(br|/div|/p|/li)[^>]*>", "\n", h)
    h = html.unescape(re.sub(r"<[^>]+>", "", h))
    return [re.sub(r"\s+", " ", l).strip() for l in h.split("\n") if l.strip()]


LANG = re.compile(r"^(english|german|french|italian|spanish|dutch|russian|deutsch|français|italiano|español|nederlands|русский|polski|czech|greek|"
                  r"[A-Za-z ]{3,12}):\s*", re.I)


def title_of(em, fname):
    lines = txt(em.get("ObjectName"))
    en = [l for l in lines if re.match(r"^english\b", l, re.I)]
    cand = en[0] if en else (lines[0] if lines else "")
    cand = LANG.sub("", cand) if LANG.match(cand) else cand
    if not cand or len(cand) < 3:
        cand = re.sub(r"\.\w+$", "", fname[5:]).replace("_", " ")
    return C.clean_title(cand)


def date_of(em):
    raw = em.get("DateTimeOriginal") or ""
    qs = re.findall(r"(P571|P1319|P1326),([+-])(\d+)-\d+-\d+T[^/]*/(\d+)", raw)
    ys = {}
    for pr, sg, y, prec in qs:
        ys.setdefault(pr, []).append((int(y) * (-1 if sg == "-" else 1), int(prec)))
    if ys:
        pts = [y for v in ys.values() for y, _ in v]
        if ys.get("P1319") or ys.get("P1326"):
            lo = min(y for pr in ("P1319",) for y, _ in ys.get(pr, [])) if ys.get("P1319") else min(pts)
            hi = max(y for y, _ in ys.get("P1326", [])) if ys.get("P1326") else max(pts)
            return lo, hi - lo
        y, prec = ys["P571"][0]
        if prec < 7:
            return None, None
        return y, {7: 100, 8: 10}.get(prec, 0)
    plain = " ".join(txt(raw))
    bc = re.search(r"\bBC|\bBCE|v\. ?Chr", plain)
    m = re.search(r"(\d{1,2})(?:st|nd|rd|th)[- ]century", plain)
    if m:
        c = int(m.group(1))
        return (-(c * 100), 100) if bc else ((c - 1) * 100, 100)
    nums = [int(n) for n in re.findall(r"(?<!\d)(\d{3,4})(?!\d)", plain)]
    if nums:
        return (-nums[0] if bc else nums[0]), (abs(nums[-1] - nums[0]) if len(nums) > 1 else 0)
    return None, None


def artist_of(em):
    lines = txt(em.get("Artist"))
    a = lines[0] if lines else ""
    a = re.sub(r"^(artist|creator|painter):\s*", "", a, flags=re.I)
    if not a or re.search(r"unknown|anonym|unbekannt|inconnu|sconosciut|^\?+$|workshop|school of|circle of|follower", a, re.I):
        return None
    return C.clean_artist(re.split(r"\s*\(|\s+\d{3,4}\s*[-–]", a)[0].strip()) or None


def stage(files):
    held = M.Held("cf")
    drops, cand = Counter(), []
    for pid, f in files.items():
        fn = f["title"]
        if re.search(r"Pal\.? ?lat|\bcodex\b|manuscript|\bfol\.|folio|\bBNF\b|\bMS\.? |Add\.? ?MS|Cod\.|psalter|breviary|book of hours|bible", fn + " " + title_of(f["em"], fn), re.I):
            drops["manuscript leaf (not a stand-alone painting)"] += 1
            continue
        if re.search(r"detail|crop|ausschnitt|particolare|\bsvg\b|map of|stamp|logo|flag", fn, re.I):
            drops["detail/crop/other non-painting file name"] += 1
            continue
        t = title_of(f["em"], fn)
        if not t or C.TEXT_PAGE.search(t):
            drops["no title / text page"] += 1
            continue
        if re.search(r"\b(drawing|sketch|etching|engraving|woodcut|print|photograph|sculpture|bust|statue|relief|vase|ceramic|tapestry|coin|coffin|"
                     r"sarcophagus|mosaic|stained glass|amphora|kylix|krater|pottery|ostrac|stele|capital|reliquary|casket|manuscript page)\b", t, re.I):
            drops["title names a drawing/print/object"] += 1
            continue
        y, span = date_of(f["em"])
        if y is None:
            drops["no usable date"] += 1
            continue
        if y >= 1500 or y < -3500:
            drops["outside -3500..1499"] += 1
            continue
        if span > 200:
            drops["date span over 200 years"] += 1
            continue
        L = de_gb.norm_lic(f["em"].get("LicenseShortName", ""))
        if not L:
            drops["licence not PD/CC0/CC BY/CC BY-SA"] += 1
            continue
        a = artist_of(f["em"])
        name = fn[5:].replace(" ", "_")
        r = dict(id=f"cf-{f['pid']}", src="commons", t=t, a=a, y=y, span=span, co=M.norm_co(country(t, " ".join(f["roots"]))), mv=None,
                 img="https://commons.wikimedia.org/wiki/Special:FilePath/" + urllib.parse.quote(name) + "?width=400",
                 license=L, url="https://commons.wikimedia.org/wiki/" + urllib.parse.quote(fn.replace(" ", "_")),
                 yorck=any("Yorck" in x for x in f["roots"]))
        if M.fname(r["img"]) in held.files:
            drops["image file already held"] += 1
            continue
        if held.twin(r):
            drops["artist+title+year twin of a held/staged row"] += 1
            continue
        held.add(r)
        if L.startswith("CC BY"):
            r["src"], r["id"] = "commonscc", f"commonscc-{f['pid']}"
        cand.append(r)
    files_out = M.write("cf", cand)
    st = dict(source="Commons categories", files_seen=len(files), new=len(cand), drops=dict(drops), files=files_out,
              yorck=sum(1 for r in cand if r["yorck"]), no_artist=sum(1 for r in cand if not r["a"]),
              no_country=sum(1 for r in cand if not r["co"]), licenses=dict(Counter(r["license"] for r in cand)))
    print(json.dumps(st, ensure_ascii=False), flush=True)
    (SCR / "stats" / "ma-cf.json").write_text(json.dumps(st, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    import pickle
    pk = SCR / "cf_files.pkl"
    if sys.argv[1] == "crawl":
        pickle.dump(crawl(), open(pk, "wb"))
        print("crawl done", flush=True)
    else:
        stage(pickle.load(open(pk, "rb")))
