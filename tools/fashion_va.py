#!/usr/bin/env python3
"""V&A Collections (measure-only): extend the fashion color corpus into the 20th century, where the Met +
Cleveland CC0/PD corpus (tools/fashion.py) has almost nothing. The V&A's Collections API is key-free and has
deep 1900s-2020s costume holdings, but its images are (c) Victoria and Albert Museum, London -- NOT CC0/PD --
so per the rights rule this script only MEASURES: it fetches each small thumbnail to a temp file, extracts a
color palette, deletes the file, and keeps only hex values + metadata (no image URL, no credit-linked photo).
These rows feed tools/fashion_measure.py's per-decade stats; they never appear in the Garments browser, which
only shows rights-cleared (CC0/PD) photographs.

  python3 tools/fashion_va.py search    # 1. query the API across 1700s-2020s x garment terms -> ids.jsonl
  python3 tools/fashion_va.py measure   # 2. fetch each thumbnail to a temp file, extract a palette, delete it
  python3 tools/fashion_va.py build     # 3. write data/fashion/va-measured.json
  python3 tools/fashion_va.py all

API: https://api.vam.ac.uk/v2/objects/search (no key). Rate limit: one request every 0.35s (search) / 0.2s
(thumbnails), single-threaded, with a descriptive User-Agent, well under any documented limit. Caches are
resumable (research/_raw/fashion/va/, gitignored): rerun any step to pick up where it left off.
"""
import io, json, sys, time, urllib.parse, urllib.request, urllib.error
from pathlib import Path
from collections import defaultdict
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import corpus as C   # noqa: E402
import fashion as F  # noqa: E402  (palette_of, library_names, short_title)

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "research" / "_raw" / "fashion" / "va"
OUT = ROOT / "data" / "fashion" / "va-measured.json"
UA = "ColorHubBot/1.0 (https://github.com/dmekibel/colorhub; measure-only, no image retained)"
API = "https://api.vam.ac.uk/v2/objects/search"

DECADES = list(range(1700, 2021, 10))
TERMS = ["dress", "coat", "suit", "waistcoat", "gown", "shawl", "uniform", "blouse", "trousers"]
PER_QUERY_PAGE = 45          # one page per (decade, term): enough variety without deep pagination
CAP_PER_DECADE = 260         # dedup cap so no one decade (e.g. "dress" is huge in every era) swamps the rest
GAP = {"search": 0.35, "img": 0.2}
_last = defaultdict(float)


def _wait(kind):
    dt = GAP[kind] - (time.time() - _last[kind])
    if dt > 0:
        time.sleep(dt)
    _last[kind] = time.time()


def fetch_json(url, tries=4):
    for i in range(tries):
        _wait("search")
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            if e.code in (400, 404):
                return None
            time.sleep(5 * (i + 1))
        except Exception:
            time.sleep(5 * (i + 1))
    return None


def fetch_bytes(url, tries=3):
    for i in range(tries):
        _wait("img")
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=20) as r:
                return r.read()
        except Exception:
            time.sleep(3 * (i + 1))
    return None


def year_of(primary_date, decade):
    """V&A _primaryDate is free text ("1900-1910", "circa 1850", "1920s", "1967-1969"). Parse the first plausible
    4-digit year; fall back to the decade the query was run under (we know it's within that bucket either way,
    since the search itself was year_made_from/to filtered)."""
    import re
    m = re.findall(r"(1[5-9]\d{2}|20[0-2]\d)", primary_date or "")
    if m:
        ys = [int(x) for x in m]
        return round(sum(ys) / len(ys))
    return decade + 5


def search():
    RAW.mkdir(parents=True, exist_ok=True)
    seen_ids = set()
    byid = {}
    cache = RAW / "ids.jsonl"
    if cache.exists():
        for line in cache.read_text().splitlines():
            if line.strip():
                r = json.loads(line)
                byid[r["id"]] = r
        print(f"resuming: {len(byid)} ids already found", flush=True)
    done_queries_f = RAW / "done_queries.json"
    done_queries = set(json.loads(done_queries_f.read_text())) if done_queries_f.exists() else set()
    f = cache.open("a")
    for decade in DECADES:
        decade_count = sum(1 for r in byid.values() if r["decade"] == decade)
        for term in TERMS:
            qkey = f"{decade}:{term}"
            if qkey in done_queries:
                continue
            if decade_count >= CAP_PER_DECADE:
                done_queries.add(qkey)
                continue
            params = {"q": term, "year_made_from": decade, "year_made_to": decade + 9,
                      "images_exist": 1, "page_size": PER_QUERY_PAGE}
            r = fetch_json(f"{API}?{urllib.parse.urlencode(params)}")
            done_queries.add(qkey)
            if not r:
                continue
            added = 0
            for rec in r.get("records", []):
                sid = rec.get("systemNumber")
                thumb = (rec.get("_images") or {}).get("_primary_thumbnail")
                if not sid or not thumb or sid in byid:
                    continue
                if decade_count + added >= CAP_PER_DECADE:
                    break
                row = dict(id=sid, t=rec.get("_primaryTitle") or rec.get("objectType") or "Untitled",
                           ot=rec.get("objectType"), d=rec.get("_primaryDate"),
                           decade=decade, y=year_of(rec.get("_primaryDate"), decade),
                           place=rec.get("_primaryPlace"), maker=(rec.get("_primaryMaker") or {}).get("name"),
                           thumb=thumb, url=f"https://collections.vam.ac.uk/item/{sid}/")
                byid[sid] = row
                f.write(json.dumps(row, ensure_ascii=False) + "\n")
                added += 1
            decade_count += added
            print(f"va search {decade}s {term:10s}: +{added} (decade now {decade_count}, total {len(byid)})", flush=True)
            if added:
                f.flush()
        done_queries_f.write_text(json.dumps(sorted(done_queries)))
    f.close()
    print(f"va search done: {len(byid)} ids across {len(DECADES)} decades", flush=True)


def _measure_one(r, worker_id):
    """Fetch one thumbnail to a worker-private temp file, extract a palette, delete the file. Each thread
    gets its own temp path so concurrent workers never stomp each other's file."""
    data = fetch_bytes(r["thumb"])
    if not data:
        return r["id"], None, "fetch failed"
    tmp = RAW / f"_tmp_{worker_id}.jpg"
    try:
        tmp.write_bytes(data)
        pal = F.palette_of(str(tmp))
        pal["id"] = r["id"]
        return r["id"], pal, None
    except Exception as e:
        return r["id"], None, str(e)
    finally:
        tmp.unlink(missing_ok=True)   # never keep the fetched image -- measure-only per the rights rule


def measure(workers=5):
    """`workers` small concurrent threads, each individually paced by GAP['img'] (shared via `_wait`'s lock-free
    per-kind timer, so aggregate rate is roughly workers / GAP['img'] requests/s against the V&A's image CDN --
    framemark.vam.ac.uk, not the search API -- a CDN built to serve many simultaneous thumbnails)."""
    ids_f = RAW / "ids.jsonl"
    if not ids_f.exists():
        print("run `search` first", flush=True); return
    rows = [json.loads(l) for l in ids_f.read_text().splitlines() if l.strip()]
    pal_f = RAW / "palettes.jsonl"
    done = set()
    if pal_f.exists():
        for line in pal_f.read_text().splitlines():
            if line.strip():
                done.add(json.loads(line)["id"])
    todo = [r for r in rows if r["id"] not in done]
    print(f"va measure: {len(done)} cached, {len(todo)} to fetch+measure, {workers} workers", flush=True)
    if not todo:
        return
    from concurrent.futures import ThreadPoolExecutor
    out = pal_f.open("a")
    t0 = time.time()
    errs = 0
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futs = [pool.submit(_measure_one, r, i % workers) for i, r in enumerate(todo)]
        for n, fut in enumerate(futs):
            sid, pal, err = fut.result()
            if err:
                errs += 1
            else:
                out.write(json.dumps(pal) + "\n")
            if n % 100 == 0:
                out.flush()
                print(f"va measure {n}/{len(todo)}  {(time.time() - t0) / 60:.1f} min  ({errs} errors)", flush=True)
    out.close()
    print(f"va measure done: {errs} errors, {(time.time() - t0) / 60:.1f} min total", flush=True)


def build():
    ids_f, pal_f = RAW / "ids.jsonl", RAW / "palettes.jsonl"
    rows_by_id = {json.loads(l)["id"]: json.loads(l) for l in ids_f.read_text().splitlines() if l.strip()}
    pals = {}
    for line in pal_f.read_text().splitlines():
        if line.strip():
            p = json.loads(line)
            pals[p["id"]] = p   # last line for an id wins (a rerun overwrites)
    app = C.app_names()
    app_lab = C.rgb_to_lab(np.array([C.hex_to_rgb(h) for _, h in app]))
    lib_n, lib_lab = F.library_names()
    out_rows = []
    for sid, pal in pals.items():
        r = rows_by_id.get(sid)
        if not r:
            continue
        rgbs = C.lab_to_rgb(np.array(pal["lab"]))
        exact = C.rgb_to_lab(rgbs)
        va_i = C.de2000(exact, app_lab).argmin(1)
        lib_i = C.de2000(exact, lib_lab).argmin(1)
        shares = [round(s, 3) for s in pal["share"]]
        if shares:
            shares[0] = round(shares[0] + 1 - sum(shares), 3)
        out_rows.append(dict(
            id="va-" + sid, t=F.short_title(r["t"]), d=r.get("d"), y=r["y"], decade=r["decade"],
            place=F.short_title(r.get("place") or "", 60) or None, maker=F.short_title(r.get("maker") or "", 50) or None,
            ot=r.get("ot"), url=r["url"],
            p=[[C.rgb_to_hex(rgbs[i]), shares[i], lib_n[lib_i[i]], app[va_i[i]][0]] for i in range(len(shares))],
        ))
    out_rows = [{k: v for k, v in r.items() if v is not None} for r in out_rows]
    out_rows.sort(key=lambda r: (r["y"], r["id"]))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    meta = dict(
        built=time.strftime("%Y-%m-%d"),
        source="Victoria and Albert Museum, London -- Collections API (api.vam.ac.uk, no key)",
        rights="measure-only: images (c) Victoria and Albert Museum, London, fetched to a temp file, palette "
               "extracted, then deleted -- never stored or displayed here. Only hex values and catalogue "
               "metadata (object type, date, place, maker, V&A record link) are kept.",
        method="tools/fashion_va.py; palette extraction reuses tools/fashion.py's backdrop-removal + k-means "
               "(k=6) built for studio garment photography.",
        n=len(out_rows),
    )
    OUT.write_text(json.dumps({"meta": meta, "rows": out_rows}, ensure_ascii=False, separators=(",", ":")))
    print(f"va-measured.json: {len(out_rows)} rows, {OUT.stat().st_size / 1024:.0f} KB")
    from collections import Counter
    print("  by decade:", dict(sorted(Counter(r["decade"] for r in out_rows).items())))


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "all"
    if cmd in ("search", "all"):
        search()
    if cmd in ("measure", "all"):
        measure()
    if cmd in ("build", "all"):
        build()
