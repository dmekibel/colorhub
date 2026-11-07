#!/usr/bin/env python3
"""Illustrators' work from a Wikimedia Commons CATEGORY of files (2026-11-07).

  python3 tools/commons_category.py "J. C. Leyendecker" "J. C. Leyendecker" --life 1874-1951 [--depth 2] [--max 400] [--pd-year 1930] --stage

Why: artist_extra.py reads Wikidata items that are instance-of painting. Golden Age illustrators have almost none, but their
public-domain work sits on Commons as plain FILES in categories. This crawls the category (and sensible subcategories) through the
MediaWiki API, keeps large-enough public-domain image files, and measures them with artist_extra's own download / palette / row /
duplicate functions, so the rows have exactly the schema of artist_extra's (plus "kind": "illustration").

Copyright rule (hard): a file is kept only if the artist died before 1956, OR the year parsed from the file's metadata is <= --pd-year
(default 1930); a file with no year from an artist who died in 1956 or later is dropped. The Commons license must be public domain /
PD-* / CC0 (CC-BY-SA and the like are dropped).
Polite: descriptive User-Agent (corpus.UA), one request at a time, a pause between requests, at most two retries after a 403/429, then
it stops (never works around a block). Output: data/corpus-staging/zz-commons-<slug>-ill-1.json (with --stage; otherwise data/corpus/).
--check only reports whether the category exists.
"""
import argparse, json, re, sys, time, urllib.parse, urllib.request, urllib.error
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))

ap = argparse.ArgumentParser()
ap.add_argument("artist")
ap.add_argument("category")
ap.add_argument("--depth", type=int, default=2)
ap.add_argument("--max", type=int, default=400)
ap.add_argument("--life", required=True, help="born-died, e.g. 1874-1951")
ap.add_argument("--pd-year", type=int, default=1930)
ap.add_argument("--stage", action="store_true")
ap.add_argument("--max-cats", type=int, default=80)
ap.add_argument("--check", action="store_true")
args = ap.parse_args()
BORN, DIED = (int(x) for x in args.life.split("-"))

# artist_extra reads sys.argv at import time (artist, QID, --life, --stage): hand it what it expects.
sys.argv = [sys.argv[0], args.artist, "Q0", "--life", args.life] + (["--stage"] if args.stage else [])
import artist_extra as AE  # noqa: E402
C = AE.C

OUT = ROOT / "data" / ("corpus-staging" if args.stage else "corpus") / f"zz-commons-{AE.SLUG}-ill-1.json"
API = "https://commons.wikimedia.org/w/api.php"
UA = C.UA + " illustration-category-importer"

CAT_SKIP = re.compile(r"photograph|photos? of|building|house|grave|cemeter|tomb|portrait of|\bpeople\b|\bmuseum|exhibition|"
                      r"signature|monogram|statue|bust\b|stamp|biograph|memorial|plaque|\bsites?\b|studio|"
                      r"unidentified|by country|by year|by author|templates|derivative|wikidata|"
                      r"needing|disputed|unknown|maps? of|logos?|lithographs? by .* in", re.I)
FILE_SKIP = re.compile(r"photo\b|photograph|exhibition|installation|\bframe[d]?\b|signature|grave|portrait photograph", re.I)
IMG_EXT = re.compile(r"\.(jpe?g|png|tiff?)$", re.I)
PD_OK = re.compile(r"public domain|^pd\b|^pd-|cc0|\bpdm\b|no known copyright", re.I)
LIC_BAD = re.compile(r"cc[- ]by|gfdl|fair use|attribution|non-?commercial|copyrighted", re.I)


class Blocked(Exception):
    pass


_last = [0.0]


def api(params):
    """One polite GET: ~1.2 s between requests; after a 403/429 at most two retries (20 s, 45 s), then stop."""
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
                wait = (20, 45)[attempt]
                print(f"   HTTP {e.code}; retry in {wait}s", flush=True)
                time.sleep(wait)
                continue
            if e.code >= 500 and attempt < 2:
                time.sleep(10 * (attempt + 1)); continue
            raise
        except (urllib.error.URLError, TimeoutError, ConnectionError, json.JSONDecodeError):
            if attempt == 2:
                raise
            time.sleep(8 * (attempt + 1))


def strip(v):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", str((v or {}).get("value", "")))).strip()


def parse_year(md, title):
    for t in (strip(md.get("DateTimeOriginal")), strip(md.get("ObjectName")), strip(md.get("ImageDescription")), title):
        for y in re.findall(r"(?<!\d)(1[5-9]\d\d|20[0-2]\d)(?!\d)", t):
            if BORN <= int(y) <= DIED:
                return int(y)
    return None


def crawl(cat):
    """All image files (pageid -> page) in cat and its good subcategories, breadth first to --depth."""
    cat = cat if cat.startswith("Category:") else "Category:" + cat
    todo, seen, files, skipped = [(cat, 0)], set(), {}, 0
    while todo and len(seen) < args.max_cats:
        c, d = todo.pop(0)
        if c in seen:
            continue
        seen.add(c)
        cont = {}
        while True:
            p = dict(format="json", action="query", generator="categorymembers", gcmtitle=c, gcmtype="file|subcat", gcmlimit=50,
                     prop="imageinfo", iiprop="url|size|mime|extmetadata",
                     iiextmetadatafilter="DateTimeOriginal|ObjectName|ImageDescription|LicenseShortName")
            p.update(cont)
            r = api(p)
            for pg in (r.get("query", {}).get("pages", {}) or {}).values():
                t = pg.get("title", "")
                if pg.get("ns") == 14:
                    if d + 1 <= args.depth and not CAT_SKIP.search(t):
                        todo.append((t, d + 1))
                    else:
                        skipped += 1
                elif pg.get("ns") == 6 and ("imageinfo" in pg or pg["pageid"] not in files):
                    files[pg["pageid"]] = pg
            if "continue" not in r:
                break
            cont = r["continue"]
        print(f"   {c}: depth {d}, {len(files)} files so far", flush=True)
    print(f"crawled {len(seen)} categories, {len(files)} files, {skipped} subcategories skipped/too deep", flush=True)
    return files


def check(cat):
    cat = cat if cat.startswith("Category:") else "Category:" + cat
    r = api(dict(format="json", action="query", titles=cat, prop="categoryinfo"))
    pg = next(iter(r["query"]["pages"].values()))
    ci = pg.get("categoryinfo")
    print(cat, "->", ("missing" if "missing" in pg else f"files {ci['files']}, subcats {ci['subcats']}" if ci else "empty"))


def select(files):
    drops, cands = Counter(), []
    for pid, pg in files.items():
        t = pg["title"].split(":", 1)[1]
        ii = (pg.get("imageinfo") or [{}])[0]
        md = ii.get("extmetadata") or {}
        if not IMG_EXT.search(t) or not str(ii.get("mime", "")).startswith("image/"):
            drops["type"] += 1; continue
        if min(ii.get("width", 0), ii.get("height", 0)) < 600:
            drops["size"] += 1; continue
        name = re.sub(r"\.(jpe?g|png|tiff?)$", "", t, flags=re.I).replace("_", " ")
        if FILE_SKIP.search(name):
            drops["title"] += 1; continue
        lic = strip(md.get("LicenseShortName"))
        if not lic or LIC_BAD.search(lic) or not PD_OK.search(lic):
            drops["license"] += 1; continue
        y = parse_year(md, name)
        if not (DIED < 1956 or (y is not None and y <= args.pd_year)):
            drops["copyright"] += 1; continue
        title = strip(md.get("ObjectName")) or name
        cands.append(dict(q=f"F{pid}", t=title[:160], img="http://commons.wikimedia.org/wiki/Special:FilePath/" + urllib.parse.quote(t),
                          years=[y] if y else [], coll=set(), inst={"painting"}, mat=set(), co=set(), ext=set(), cls="other", h=None, w=None,
                          y=y))
    return cands, drops


def spread_by_period(cands, n):
    strata = defaultdict(list)
    for c in sorted(cands, key=lambda c: (c["y"] or 9999, c["q"])):
        strata[(c["y"] // 5 * 5) if c["y"] else 0].append(c)
    out, keys = [], sorted(strata)
    while len(out) < n and any(strata.values()):
        for k in keys:
            if strata[k] and len(out) < n:
                out.append(strata[k].pop(0))
    return out


def main():
    if args.check:
        check(args.category); return
    files = crawl(args.category)
    cands, drops = select(files)
    existing_ids = {r["id"] for r in C.load_corpus()}
    n0 = len(cands)
    cands = [c for c in cands if f"commons-{c['q']}" not in existing_ids]
    print(f"{len(files)} files -> {n0} pass metadata filters ({dict(drops)}); {n0 - len(cands)} already in corpus", flush=True)
    cands = spread_by_period(cands, int(args.max * 1.3) + 10)   # headroom for failed downloads, colorless scans, duplicates

    orig, blocks = C.fetch, [0]

    def guarded(src, url, *a, **k):   # image downloads: 2 tries, and stop after repeated 403/429
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
        AE.fetch_images(cands)
    finally:
        C.fetch = orig
    blocked = blocks[0] >= 3
    pals = AE.palettes(cands)
    rows = AE.build_rows(cands, pals)
    old = AE.existing_sargents()   # (named for Sargent; it returns the corpus rows of ARTIST)
    for f in (ROOT / "data" / "corpus-staging").glob("*.json"):
        if f.resolve() == OUT.resolve():
            continue
        try:
            old += [r for r in json.loads(f.read_text(encoding="utf-8")) if AE.ALIAS.get(r.get("a"), r.get("a")) == args.artist]
        except Exception:
            pass
    keep, dup = AE.drop_duplicates(rows, old)
    chosen = AE.spread(keep, args.max)
    out = []
    for r in sorted(chosen, key=lambda r: ((r["y"] if r["y"] is not None else 99999), r["id"])):
        r = {k: v for k, v in r.items() if not k.startswith("_")}
        r["kind"] = "illustration"
        out.append(r)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    line = lambda r: json.dumps(r, ensure_ascii=False, separators=(",", ":"))
    OUT.write_text("[\n" + ",\n".join(line(r) for r in out) + "\n]\n", encoding="utf-8")
    print(f"RESULT {args.artist}: staged {len(out)} | dropped: copyright {drops['copyright']}, license {drops['license']}, "
          f"size {drops['size']}, title {drops['title']}, type {drops['type']}, duplicates {len(dup)}, "
          f"no palette/failed {len(cands) - len(rows)} | blocked: {blocked}")
    print(f"wrote {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    try:
        main()
    except Blocked as e:
        print("BLOCKED:", e, "- stopped, nothing worked around.")
        sys.exit(3)
