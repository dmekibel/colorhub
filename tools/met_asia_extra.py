#!/usr/bin/env python3
"""More Asian and Islamic art from the Met's Open Access API (2026-10-27): Japanese woodblock prints, Islamic codex
folios, illustrated books, and the paintings/drawings/fans the first Met Asia pass (zz-museum-met-asia-1.json) capped out.

  python3 tools/met_asia_extra.py --status     # selection only (no network): what the Open Access CSV offers, what survives
  python3 tools/met_asia_extra.py              # select, fetch records + 200 px images (polite), write the shard, measure palettes
  python3 tools/met_asia_extra.py --no-measure # same, without the last step
Resumable: records go to research/_scratch-met-asia/objects.jsonl, images to research/_raw/measure-img/ (tools/measure_staged.py's
cache, so the measuring step fetches nothing). Writes ONLY data/corpus/zz-met-asia-1.json. Then the parent runs the rebuild.

Candidates (offline, from research/_raw/met/MetObjects.csv): Department Asian Art or Islamic Art, public domain, classification
Paintings / Drawings / Illustrated Books / Manuscripts / Codices / Prints / Screens / Fans / Albums, ended by 1925, not text or
calligraphy pages, id not already in any data/corpus shard. Caps: 30 leaves per manuscript/album/book (accession prefix), 40 prints
per artist, and the whole set at MAX_NEW, round-robin over half-centuries so no era swallows the rest.
Pace: one API request a second and one image a second (the Met's Imperva shield refused 2 a second before); a 403/429 cools down.
Country: the Met's country, else culture, else period/dynasty (Safavid -> Iran ...), mapped to the archive's names via corpus.country_of.
"""
import csv, glob, json, re, sys, time, urllib.request, urllib.error
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
import corpus as C  # noqa: E402
import measure_staged as MS  # noqa: E402

SCR = ROOT / "research" / "_scratch-met-asia"
SCR.mkdir(parents=True, exist_ok=True)
OUT = ROOT / "data" / "corpus" / "zz-met-asia-1.json"
CSV = ROOT / "research" / "_raw" / "met" / "MetObjects.csv"
API = "https://collectionapi.metmuseum.org/public/collection/v1/objects/"
UA = "Chromatlas/1.0 (https://chromatlas.app; dmekibel@gmail.com)"
FIELDS = ["objectID", "isPublicDomain", "primaryImageSmall", "accessionNumber", "department", "objectName", "title", "culture",
          "period", "dynasty", "artistRole", "artistPrefix", "artistDisplayName", "artistNationality", "objectDate",
          "objectBeginDate", "objectEndDate", "medium", "classification", "country", "region", "objectURL"]
MAX_NEW, GROUP_CAP, PRINT_ARTIST_CAP, GAP, LAST_YEAR = 3000, 30, 40, 1.0, 1925
CLASSES = re.compile(r"^(Paintings|Drawings|Illustrated Books|Manuscripts|Codices|Prints|Screens|Fans|Albums)(\||$)", re.I)
BAD_TITLE = re.compile(r"^(genealogical )?text\b|text page|calligraph|colophon|^poem in |^album cover|title page|binding|"
                       r"^page of (text|calligraphy)|stencil|rubbing", re.I)
EXTRA = [(re.compile(p, re.I), c) for p, c in [
    (r"safavid|qajar|timurid|ilkhanid|zand|persia|turkman|khurasan|shiraz|isfahan|tabriz|herat|bukhara", "Iran"),
    (r"ottoman|istanbul|anatolia|seljuk of rum", "Turkey"), (r"mughal|deccan|rajput|pahari|kashmir|bengal|punjab", "India"),
    (r"edo|meiji|muromachi|heian|kamakura|momoyama|ukiyo", "Japan"), (r"joseon|choson|goryeo", "Korea"),
    (r"ming|qing|yuan dynasty|song dynasty|tang dynasty", "China"), (r"mamluk|fatimid|ayyubid|cairo", "Egypt"),
    (r"thai|siam", "Thailand"), (r"cambod|khmer", "Cambodia"), (r"vietnam|annam", "Vietnam"), (r"burma|myanmar", "Myanmar"),
    (r"indonesia|java|bali\b", "Indonesia"), (r"\bsyria", "Syria"), (r"\biraq|mesopotamia|baghdad", "Iraq"),
    (r"morocc|maghrib", "Morocco"), (r"uzbek|samarkand", "Uzbekistan"), (r"nepal", "Nepal"), (r"tibet", "Tibet"),
    (r"sri lanka|ceylon|sinhal", "Sri Lanka"), (r"afghan", "Afghanistan"), (r"mongol", "Mongolia"), (r"ryukyu", "Japan")]]


def country(*texts):
    for t in texts:
        if t:
            c = C.country_of(t)
            if c:
                return c
    for t in texts:
        for rx, cc in EXTRA:
            if t and rx.search(t):
                return cc
    return None


def held_ids():
    ids = set()
    for f in glob.glob(str(ROOT / "data" / "corpus" / "*.json")):
        if f.endswith("zz-met-asia-1.json"):
            continue
        try:
            ids |= {r["id"] for r in json.load(open(f)) if str(r.get("id", "")).startswith("met-")}
        except Exception:
            pass
    return ids


def half_century(y):
    return f"{y // 50 * 50}-{y // 50 * 50 + 49}"


def select(drops):
    csv.field_size_limit(sys.maxsize)
    held, nonp = held_ids(), C.load_nonpaintings()
    cands = []
    for r in csv.DictReader(open(CSV, newline="", encoding="utf-8-sig")):
        if r["Department"] not in ("Asian Art", "Islamic Art") or r["Is Public Domain"] != "True":
            continue
        if not CLASSES.match(r["Classification"] or ""):
            continue
        oid = int(r["Object ID"])
        if f"met-{oid}" in held:
            drops["already in data/corpus"] += 1
            continue
        if f"met-{oid}" in nonp:
            drops["hand-listed non-painting"] += 1
            continue
        try:
            end, beg = int(r["Object End Date"]), int(r["Object Begin Date"])
        except ValueError:
            drops["no date"] += 1
            continue
        if end > LAST_YEAR:
            drops["dated after 1925"] += 1
            continue
        if beg < 1000:
            drops["before 1000 (the archive keeps 1000+)"] += 1
            continue
        if end - beg > 200:
            drops["date is a period longer than 200 years"] += 1
            continue
        if BAD_TITLE.search(r["Title"] or "") or C.TEXT_PAGE.search(r["Title"] or ""):
            drops["text / calligraphy / binding / stencil page"] += 1
            continue
        cands.append(dict(id=oid, acc=r["Object Number"], title=r["Title"], cls=r["Classification"], artist=r["Artist Display Name"],
                          y=(beg + end) // 2, culture=r["Culture"]))
    # groups: leaves of one manuscript / album / book (accession prefix), prints by one artist
    groups = defaultdict(list)
    for x in cands:
        if re.match(r"(Codices|Illustrated Books|Manuscripts|Albums)", x["cls"]) or C.LEAF.search(x["title"] or ""):
            k = ("book", ".".join(re.sub(r"[\s–—-]+.*$", "", x["acc"]).split(".")[:2]))
        elif x["cls"].startswith("Prints"):
            k = ("print", (x["artist"] or "").split("|")[0] or x["id"])
        else:
            k = ("one", x["id"])
        groups[k].append(x)
    chosen = []
    for k, g in groups.items():
        cap = GROUP_CAP if k[0] == "book" else PRINT_ARTIST_CAP if k[0] == "print" else 1
        g.sort(key=lambda x: (x["y"], x["acc"]))
        if len(g) > cap:
            step = len(g) / cap
            g2 = [g[int(i * step)] for i in range(cap)]
            drops[f"group cap ({k[0]}: {GROUP_CAP if k[0] == 'book' else PRINT_ARTIST_CAP} per manuscript/album or artist)"] += len(g) - cap
            g = g2
        chosen += g
    # whole-set cap, round-robin over half-centuries; paintings/drawings/fans/screens (rare) always first
    pri = [x for x in chosen if not re.match(r"(Prints|Illustrated|Codices)", x["cls"])]
    rest = [x for x in chosen if x not in pri]
    room = max(0, MAX_NEW - len(pri))
    by = defaultdict(list)
    for x in rest:
        by[half_century(x["y"])].append(x)
    for v in by.values():
        v.sort(key=lambda x: (x["id"] * 2654435761) % 4294967296)  # stable pseudo-shuffle
    keep, i = [], 0
    while len(keep) < room and any(by.values()):
        for k in sorted(by):
            if by[k] and len(keep) < room:
                keep.append(by[k].pop())
    drops["over the 3000-row cap (round-robin by half-century)"] += sum(len(v) for v in by.values())
    return pri + keep


def get_record(oid, gap):
    for n in range(6):
        time.sleep(gap)
        try:
            req = urllib.request.Request(API + str(oid), headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=40) as r:
                d = json.load(r)
            return {k: d.get(k) for k in FIELDS}
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return {"objectID": oid, "_missing": True}
            wait = 300 if e.code in (403, 429) else 10
            print(f"HTTP {e.code} on {oid}; cooling {wait}s", flush=True)
            gap = min(4.0, gap * 1.5)
            time.sleep(wait)
        except Exception as e:
            print("err", oid, type(e).__name__, flush=True)
            time.sleep(5 * (n + 1))
    return None


def to_row(x):
    r = C.norm_record("met", dict(x, id=x["objectID"]))
    r["co"] = r.get("co") or country(x.get("country"), x.get("culture"), x.get("region"), x.get("period"), x.get("dynasty"),
                                     x.get("artistNationality"), x.get("title"))
    if r.get("a"):
        r["a"] = re.sub(r"[⺀-鿿가-힯＀-￯]+", "", r["a"])
        r["a"] = re.sub(r"\s+", " ", r["a"]).strip(" ,;/") or None
    r["license"], r["url"] = "CC0", x.get("objectURL")
    r["medium"] = (x.get("medium") or "")[:120] or None
    return r


def main():
    drops = Counter()
    cands = select(drops)
    print(f"{len(cands)} selected; selection drops: {dict(drops)}", flush=True)
    print("by class:", dict(Counter(x["cls"].split("|")[0] for x in cands)), flush=True)
    if "--status" in sys.argv:
        return
    objp = SCR / "objects.jsonl"
    have = {}
    if objp.exists():
        for line in objp.read_text().splitlines():
            try:
                x = json.loads(line)
                have[x["objectID"]] = x
            except Exception:
                pass
    todo = [x["id"] for x in cands if x["id"] not in have]
    print(f"{len(have)} records cached, {len(todo)} to fetch", flush=True)
    f = objp.open("a")
    for n, oid in enumerate(todo, 1):
        rec = get_record(oid, GAP)
        if rec is None:
            print("giving up on", oid, flush=True)
            continue
        have[oid] = rec
        f.write(json.dumps(rec, ensure_ascii=False) + "\n")
        if not rec.get("_missing") and rec.get("isPublicDomain") and rec.get("primaryImageSmall"):
            row = to_row(rec)
            if not MS.cache_path(row["id"]).exists():
                time.sleep(GAP)
                try:
                    MS.get_image(row)
                except Exception as e:
                    print("image failed", oid, str(e)[:60], flush=True)
        if n % 100 == 0:
            f.flush()
            print(f"fetched {n}/{len(todo)}", flush=True)
    f.close()
    # stage
    out, d2, seen = [], Counter(), set()
    twins = {}
    for x in cands:
        rec = have.get(x["id"])
        if not rec or rec.get("_missing"):
            d2["404 / not fetched"] += 1
        elif not rec.get("isPublicDomain"):
            d2["API says not public domain"] += 1
        elif not rec.get("primaryImageSmall"):
            d2["no primary image"] += 1
        else:
            r = to_row(rec)
            why = None
            if not (r.get("t") or "").strip() or re.fullmatch(r"\[?(untitled|unknown)\]?", r["t"], re.I):
                why = "no usable title"
            elif r.get("y") is None or r["y"] < 1000 or r["y"] > LAST_YEAR:
                why = "no usable date"
            elif not r.get("co"):
                why = "country unknown"
                C.UNMAPPED["met-asia: " + " | ".join(filter(None, [rec.get("country"), rec.get("culture"), rec.get("period")]))] += 1
            if why:
                d2[why] += 1
                continue
            k = ((r.get("a") or "").lower(), r["t"].lower())
            if r.get("a") and any(abs(r["y"] - y) <= 3 for y in twins.get(k, [])):
                d2["artist+title+year twin"] += 1
                continue
            twins.setdefault(k, []).append(r["y"])
            out.append(r)
    out.sort(key=lambda r: r["id"])
    OUT.write_text("[\n" + ",\n".join(json.dumps(r, ensure_ascii=False, separators=(",", ":")) for r in out) + "\n]\n")
    print(f"wrote {OUT} ({len(out)} rows); stage drops: {dict(d2)}", flush=True)
    (SCR / "stats.json").write_text(json.dumps(dict(selection_drops=drops, stage_drops=d2, rows=len(out),
                                                     countries=Counter(r["co"] for r in out).most_common(),
                                                     unmapped=dict(C.UNMAPPED)), indent=1))
    if "--no-measure" not in sys.argv:
        import subprocess
        subprocess.run([sys.executable, str(ROOT / "tools" / "measure_staged.py"), "--workers", "4", "--files", str(OUT)], check=False)


if __name__ == "__main__":
    main()
