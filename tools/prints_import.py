#!/usr/bin/env python3
"""Japanese woodblock prints (ukiyo-e, pre-1931) from the Art Institute of Chicago and the Met (2026-11-07).

  python3 tools/prints_import.py "Hokusai" --max 250 --source both --stage
  python3 tools/prints_import.py --list            # the artists this knows

One shard per artist: data/corpus-staging/zz-prints-<slug>-1.json (with --stage; otherwise data/corpus/). Rows get "kind": "print".
Sources, public domain / CC0 only:
  AIC  api.artic.edu search (artist_title phrase, is_public_domain, image_id, date_start <= 1930), images by IIIF.
  Met  candidates offline from research/_raw/met/MetObjects.csv (Open Access, public domain, classification Prints, artist name),
       then /public/collection/v1/objects/<id> for the image URL, isPublicDomain checked again on the record.
Method (the same functions as artist_extra.py / measure_staged.py): images cached 200 px in research/_raw/measure-img/, colors from
corpus.palette_of via measure_staged.measure, near-duplicates by artist_extra.drop_duplicates (same design = same title +- 2 years
+ same colors, or same image hash), plus: any id already in data/corpus or in another staging shard is dropped; rows with no year
or a year after 1930 are dropped; grey scans (keyblock-only proofs) are dropped by corpus.BW_C and a chroma floor; the cap is spread
over 5-year strata, most colorful first.
Polite: User-Agent "Chromatlas/1.0 (https://chromatlas.app; dmekibel@gmail.com)", one request at a time, ~1 s apart; after a 403/429 at
most two retries (20 s, 45 s) and then it stops (exit 3), never works around a block. Free disk is checked every 100 images and the run
stops cleanly (keeping what it has) under 6 GB.
"""
import argparse, csv, glob, json, re, shutil, sys, time, unicodedata, io, urllib.request, urllib.error, urllib.parse
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))

# canonical corpus spelling -> accepted normalized source names (lowercase, ascii, text before "|" / "(")
ARTISTS = {
    "hokusai":    ("Katsushika Hokusai", {"katsushika hokusai"}),
    "hiroshige":  ("Utagawa Hiroshige", {"utagawa hiroshige", "ando hiroshige", "hiroshige"}),
    "utamaro":    ("Kitagawa Utamaro", {"kitagawa utamaro"}),
    "kuniyoshi":  ("Utagawa Kuniyoshi", {"utagawa kuniyoshi"}),
    "kunisada":   ("Utagawa Kunisada", {"utagawa kunisada", "utagawa kunisada i", "toyokuni iii", "utagawa toyokuni iii"}),
    "yoshitoshi": ("Tsukioka Yoshitoshi", {"tsukioka yoshitoshi", "yoshitoshi"}),
    "harunobu":   ("Suzuki Harunobu", {"suzuki harunobu"}),
    "kiyonaga":   ("Torii Kiyonaga", {"torii kiyonaga"}),
    "sharaku":    ("Tōshūsai Sharaku", {"toshusai sharaku", "sharaku"}),
    "eisen":      ("Keisai Eisen", {"keisai eisen"}),
    "koryusai":   ("Isoda Koryusai", {"isoda koryusai"}),
    "shunsho":    ("Katsukawa Shunshō", {"katsukawa shunsho"}),
    "toyokuni":   ("Utagawa Toyokuni I", {"utagawa toyokuni i", "utagawa toyokuni"}),
    "hasui":      ("Kawase Hasui", {"kawase hasui", "hasui kawase"}),
    "yoshida":    ("Hiroshi Yoshida", {"hiroshi yoshida", "yoshida hiroshi"}),
    "koson":      ("Ohara Koson", {"ohara koson", "ohara shoson", "ohara shōson"}),
    "kiyochika":  ("Kobayashi Kiyochika", {"kobayashi kiyochika"}),
    "chikanobu":  ("Yōshū (Hashimoto) Chikanobu", {"hashimoto chikanobu", "hashimoto (yoshu) chikanobu", "yoshu (hashimoto) chikanobu",
                                                    "toyohara chikanobu", "yoshu chikanobu"}),
}
LAST_YEAR = 1930
MIN_CHROMA = 10.0           # below this a print is a keyblock proof / faded sheet
UA = "Chromatlas/1.0 (https://chromatlas.app; dmekibel@gmail.com)"
MIN_FREE = 6e9
BAD_TITLE = re.compile(r"\b(book|album|volume|vol\.|title page|cover|frontispiece|text|index|colophon|rubbing|stencil|catalogue|leaf from)\b", re.I)
BAD_CLASS = re.compile(r"book|album|drawing|painting|sculpture|textile|ceramic|archive", re.I)

ap = argparse.ArgumentParser()
ap.add_argument("artist", nargs="?")
ap.add_argument("--max", type=int, default=200)
ap.add_argument("--source", choices=["aic", "met", "both"], default="both")
ap.add_argument("--stage", action="store_true")
ap.add_argument("--list", action="store_true")
ap.add_argument("--status", action="store_true", help="only count candidates (AIC: one API pass, Met: offline)")
ap.add_argument("--pool", type=float, default=1.7, help="fetch/measure this many times --max candidates before choosing")
args = ap.parse_args()
if args.list or not args.artist:
    print("\n".join(f"{k}: {v[0]}" for k, v in ARTISTS.items())); sys.exit(0)


def find_key(s):
    s = norm(s)
    for k, (canon, names) in ARTISTS.items():
        if s == k or s == norm(canon) or s in names:
            return k
    for k in ARTISTS:
        if k in s:
            return k
    sys.exit("unknown artist " + args.artist)


def norm(s):
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode().lower()
    s = re.split(r"\||\s*\(|\s{2,}", s)[0] if "(yoshu)" not in s else s
    return re.sub(r"\s+", " ", re.sub(r"[^a-z() ]", " ", s)).strip()


KEY = find_key(args.artist)
CANON, NAMES = ARTISTS[KEY]
NAMES = {norm(n) for n in NAMES}
sys.argv = [sys.argv[0], CANON, "Q0"] + (["--stage"] if args.stage else [])   # artist_extra reads argv at import
import corpus as C   # noqa: E402
import measure_staged as MS   # noqa: E402
import artist_extra as AE   # noqa: E402
from audit_artists import ALIAS   # noqa: E402

SEARCH_TERM = [w for w in unicodedata.normalize("NFKD", CANON).encode("ascii", "ignore").decode().split() if w.lower().strip("()") not in ("i", "ii")][-1]
STAGE_DIR = ROOT / "data" / ("corpus-staging" if args.stage else "corpus")
OUT = STAGE_DIR / f"zz-prints-{KEY}-1.json"
SCR = ROOT / "research" / "_scratch-prints"
SCR.mkdir(parents=True, exist_ok=True)


class Blocked(Exception):
    pass


class LowDisk(Exception):
    pass


_last = [0.0]
_n_img = [0]


def free_disk():
    return shutil.disk_usage("/System/Volumes/Data").free


def get(url, data=None, headers=None, gap=1.0):
    """One polite request; after a 403/429 at most two retries (20 s, 45 s), then Blocked."""
    h = {"User-Agent": UA, "AIC-User-Agent": UA}
    h.update(headers or {})
    body = json.dumps(data).encode() if data is not None else None
    if body:
        h["Content-Type"] = "application/json"
    for attempt in range(3):
        wait = gap - (time.time() - _last[0])
        if wait > 0:
            time.sleep(wait)
        _last[0] = time.time()
        try:
            with urllib.request.urlopen(urllib.request.Request(url, data=body, headers=h), timeout=60) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code in (403, 429):
                if attempt == 2:
                    raise Blocked(f"HTTP {e.code} from {urllib.parse.urlparse(url).netloc} after two polite retries")
                w = (20, 45)[attempt]
                print(f"   HTTP {e.code}; retry in {w}s", flush=True)
                time.sleep(w); continue
            if e.code in (404, 410):
                raise
            if attempt == 2:
                raise
            time.sleep(8 * (attempt + 1))
        except (urllib.error.URLError, TimeoutError, ConnectionError):
            if attempt == 2:
                raise
            time.sleep(8 * (attempt + 1))


# ---------------------------------------------------------------- candidates
def held_ids():
    ids = set()
    for f in glob.glob(str(ROOT / "data" / "corpus" / "*.json")):
        try:
            ids |= {r["id"] for r in json.load(open(f))}
        except Exception:
            pass
    for f in glob.glob(str(ROOT / "data" / "corpus-staging" / "*.json")):
        if Path(f).resolve() == OUT.resolve():
            continue
        try:
            ids |= {r["id"] for r in json.load(open(f))}
        except Exception:
            pass
    return ids


def aic_candidates(drops):
    fields = ["id", "title", "artist_title", "date_start", "date_end", "is_public_domain", "image_id", "color",
              "classification_titles", "medium_display", "place_of_origin", "artwork_type_title"]
    cache = SCR / f"aic-{KEY}.json"
    if cache.exists():
        recs = json.loads(cache.read_text())
    else:
        recs, last = [], 0
        while True:
            q = {"bool": {"must": [{"match_phrase": {"artist_title": w}} for w in [SEARCH_TERM]] +
                          [{"term": {"is_public_domain": True}}, {"exists": {"field": "image_id"}}, {"range": {"id": {"gt": last}}}]}}
            r = json.loads(get("https://api.artic.edu/api/v1/artworks/search",
                               data={"query": q, "fields": fields, "limit": 100, "page": 1, "sort": [{"id": "asc"}]}))
            recs += r["data"]
            if len(r["data"]) < 100:
                break
            last = r["data"][-1]["id"]
        cache.write_text(json.dumps(recs, ensure_ascii=False))
    out = []
    for x in recs:
        if norm(x.get("artist_title")) not in NAMES:
            drops["aic: other artist/school"] += 1; continue
        if not (x.get("is_public_domain") and x.get("image_id")):
            drops["aic: not public domain / no image"] += 1; continue
        cls = " ".join(x.get("classification_titles") or []) + " " + str(x.get("artwork_type_title") or "")
        if BAD_CLASS.search(cls) or not re.search(r"print", cls, re.I):
            drops["aic: not a print"] += 1; continue
        y = x.get("date_start")
        if y is None:
            drops["no year"] += 1; continue
        if y > LAST_YEAR:
            drops[f"after {LAST_YEAR}"] += 1; continue
        if BAD_TITLE.search(x.get("title") or ""):
            drops["book / text page"] += 1; continue
        e = x.get("date_end")
        out.append(dict(id=f"aic-{x['id']}", src="aic", t=C.clean_title(x.get("title")), y=y,
                        span=(e - y) if e is not None and e >= y else None,
                        fetch=C.aic_iiif(x["image_id"], 200), img=C.aic_iiif(x["image_id"], 843),
                        url=f"https://www.artic.edu/artworks/{x['id']}", medium=(x.get("medium_display") or "")[:120] or None,
                        mu="Art Institute of Chicago", city="Chicago", s=((x.get("color") or {}).get("s") or 0)))
    return out


def met_candidates(drops):
    csv.field_size_limit(sys.maxsize)
    out = []
    for r in csv.DictReader(open(ROOT / "research" / "_raw" / "met" / "MetObjects.csv", newline="", encoding="utf-8-sig")):
        if r["Is Public Domain"] != "True" or not (r["Classification"] or "").startswith("Prints"):
            continue
        if norm(r["Artist Display Name"].split("|")[0]) not in NAMES:
            continue
        try:
            beg, end = int(r["Object Begin Date"]), int(r["Object End Date"])
        except ValueError:
            drops["no year"] += 1; continue
        if beg > LAST_YEAR:
            drops[f"after {LAST_YEAR}"] += 1; continue
        if BAD_TITLE.search(r["Title"] or ""):
            drops["book / text page"] += 1; continue
        out.append(dict(id=f"met-{int(r['Object ID'])}", src="met", oid=int(r["Object ID"]), t=C.clean_title(r["Title"]), y=beg,
                        span=end - beg if end >= beg else None, medium=(r["Medium"] or "")[:120] or None,
                        url=r["Link Resource"] or f"https://www.metmuseum.org/art/collection/search/{r['Object ID']}",
                        mu="The Metropolitan Museum of Art", city="New York", s=0))
    return out


def met_record(oid):
    p = SCR / "met-objects.jsonl"
    if not hasattr(met_record, "cache"):
        met_record.cache = {}
        if p.exists():
            for line in p.read_text().splitlines():
                try:
                    d = json.loads(line); met_record.cache[d["objectID"]] = d
                except Exception:
                    pass
    if oid in met_record.cache:
        return met_record.cache[oid]
    try:
        d = json.loads(get(f"https://collectionapi.metmuseum.org/public/collection/v1/objects/{oid}"))
        d = {k: d.get(k) for k in ("objectID", "isPublicDomain", "primaryImageSmall")}
    except urllib.error.HTTPError as e:
        if e.code not in (404, 410):
            raise
        d = {"objectID": oid, "isPublicDomain": False, "primaryImageSmall": ""}
    met_record.cache[oid] = d
    with p.open("a") as f:
        f.write(json.dumps(d) + "\n")
    return d


def spread_years(items, n, key=lambda c: 0):
    strata = defaultdict(list)
    for c in sorted(items, key=lambda c: (-key(c), c["id"])):
        strata[c["y"] // 5 * 5].append(c)
    out = []
    while len(out) < n and any(strata.values()):
        for k in sorted(strata):
            if strata[k] and len(out) < n:
                out.append(strata[k].pop(0))
    return out


def main():
    drops = Counter()
    cands = []
    if args.source in ("aic", "both"):
        cands += aic_candidates(drops)
    if args.source in ("met", "both"):
        cands += met_candidates(drops)
    held = held_ids()
    n0 = len(cands)
    cands = [c for c in cands if c["id"] not in held and f"{c['id']}" not in C.NONPAINTINGS]
    dup_ids = n0 - len(cands)
    by_src = Counter(c["src"] for c in cands)
    print(f"{CANON}: {n0} candidates ({dict(drops)}); {dup_ids} already in corpus/staging; {dict(by_src)} left", flush=True)
    if args.status:
        return
    pool = spread_years(cands, int(args.max * args.pool) + 10, key=lambda c: c["s"])
    print(f"pool of {len(pool)} to fetch and measure", flush=True)

    # images
    (MS.CACHE).mkdir(parents=True, exist_ok=True)
    from PIL import Image
    blocked = None
    ready = []
    for c in pool:
        p = MS.cache_path(c["id"])
        if not (p.exists() and p.stat().st_size > 500):
            if _n_img[0] % 100 == 0 and free_disk() < MIN_FREE:
                print(f"STOP: free disk {free_disk() / 1e9:.1f} GB < 6 GB", flush=True)
                blocked = "low disk"; break
            try:
                if c["src"] == "met":
                    rec = met_record(c["oid"])
                    if not (rec.get("isPublicDomain") and rec.get("primaryImageSmall")):
                        drops["met: not public domain / no image"] += 1; continue
                    big = rec["primaryImageSmall"]
                    c["img"] = big.replace("/web-large/", "/mobile-large/")
                    c["fetch"] = c["img"]
                data = get(c["fetch"])
                im = Image.open(io.BytesIO(data)).convert("RGB")
                if im.width > C.IMG_W:
                    im = im.resize((C.IMG_W, max(1, round(im.height * C.IMG_W / im.width))), Image.LANCZOS)
                im.save(p, "JPEG", quality=92)
                _n_img[0] += 1
            except Blocked as e:
                print("BLOCKED:", e, "- stopped, nothing worked around.", flush=True)
                blocked = str(e); break
            except Exception as e:
                drops["image failed"] += 1; continue
        elif c["src"] == "met":
            rec = met_record(c["oid"])   # cached
            c["img"] = (rec.get("primaryImageSmall") or "").replace("/web-large/", "/mobile-large/")
        ready.append(c)
        if len(ready) % 100 == 0:
            print(f"  {len(ready)} images ready, free {free_disk() / 1e9:.1f} GB", flush=True)

    # measure + build rows
    app = C.app_names()
    import numpy as np
    app_lab = C.rgb_to_lab(np.array([C.hex_to_rgb(h) for _, h in app]))
    rows = []
    for c in ready:
        if not c.get("img"):
            drops["no image url"] += 1; continue
        r = dict(id=c["id"], src=c["src"], t=c["t"] or "Untitled", a=CANON, y=c["y"], span=c["span"], co="Japan", mv="Ukiyo-e", img=c["img"],
                 license="CC0", url=c["url"], medium=c["medium"])
        try:
            res = MS.measure(r, app, app_lab)
        except Exception:
            drops["unmeasurable"] += 1; continue
        if not res:
            drops["too grey (keyblock proof)"] += 1; continue
        r["p"], r["L"], r["C"] = res
        if r["C"] < MIN_CHROMA:
            drops[f"chroma < {MIN_CHROMA:.0f} (faded / near black-and-white)"] += 1; continue
        r["mu"], r["city"], r["kind"] = c["mu"], c["city"], "print"
        rows.append(r)
    if not rows:
        print("no rows"); return

    # near-duplicates (same design, other impression) against what the corpus holds for this painter and what is staged
    orig_ip = C.img_path
    C.img_path = lambda src, rid: (orig_ip(src, rid) if orig_ip(src, rid).exists() else MS.cache_path(f"{src}-{rid}"))
    old = [r for r in C.load_corpus() if ALIAS.get(r.get("a"), r.get("a")) == CANON and r.get("L") is not None]
    for f in glob.glob(str(ROOT / "data" / "corpus-staging" / "*.json")):
        if Path(f).resolve() == OUT.resolve():
            continue
        try:
            old += [r for r in json.load(open(f)) if ALIAS.get(r.get("a"), r.get("a")) == CANON and r.get("L") is not None]
        except Exception:
            pass
    def uniq(r):   # IIIF urls all end in .../default.jpg: artist_extra's "same image" test would call every AIC row a twin
        m = re.search(r"/iiif/2/([^/]+)/", r.get("img") or "")
        return dict(r, img=f"iiif/{m.group(1)}.jpg") if m else r
    by_id = {r["id"]: r for r in rows}
    keep, dup = AE.drop_duplicates([uniq(r) for r in rows], [uniq(r) for r in old])
    keep = [by_id[r["id"]] for r in keep]
    (SCR / f"dups-{KEY}.json").write_text(json.dumps(dup, ensure_ascii=False))
    C.img_path = orig_ip
    chosen = spread_years(keep, args.max, key=lambda r: r["C"])
    chosen.sort(key=lambda r: (r["y"], r["id"]))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    line = lambda r: json.dumps(r, ensure_ascii=False, separators=(",", ":"))
    OUT.write_text("[\n" + ",\n".join(line(r) for r in chosen) + "\n]\n", encoding="utf-8")
    sc = Counter(r["src"] for r in chosen)
    print(f"RESULT {CANON}: staged {len(chosen)} {dict(sc)} | candidates {n0}, already-held {dup_ids}, after-{LAST_YEAR}/no-year "
          f"{drops.get(f'after {LAST_YEAR}', 0) + drops.get('no year', 0)}, near-duplicates {len(dup)}, "
          f"grey/faded {sum(v for k, v in drops.items() if 'grey' in k or 'chroma' in k)}, not chosen (cap) {len(keep) - len(chosen)} | "
          f"blocked: {blocked} | free {free_disk() / 1e9:.1f} GB", flush=True)
    print(f"wrote {OUT.relative_to(ROOT)}")
    if blocked:
        sys.exit(3 if blocked != "low disk" else 4)


if __name__ == "__main__":
    try:
        main()
    except Blocked as e:
        print("BLOCKED:", e, "- stopped, nothing worked around.")
        sys.exit(3)
