#!/usr/bin/env python3
"""Color photography for the Photos room (kind "photograph"), staged as corpus rows (2026-11-08).

  python3 tools/photos_import.py --source commons    --stage            # data/photography/photos.json converted (3,465 rows already measured)
  python3 tools/photos_import.py --source photochrom --max 3000 --stage # Photochrom prints (Detroit Publishing Co. / Library of Congress, Photochrom Zurich ...), via Commons
  python3 tools/photos_import.py --source kahn       --max 2000 --stage # Albert Kahn "Archives of the Planet" autochromes, via Commons (CC0 per file)
  python3 tools/photos_import.py --source nasa       --max 2500 --stage # NASA images: Earth from orbit, Apollo, Gemini, astronaut photography
  python3 tools/photos_import.py --source nasa --status                 # only count candidates
  python3 tools/photos_import.py --list

One shard per source: data/corpus-staging/zz-photos-<source>-1.json (with --stage; otherwise data/corpus/). Rows get "kind": "photograph".
Why Commons for the Library of Congress material: loc.gov answers a script with a Cloudflare "Just a moment" challenge (HTTP 403;
research/PHOTOGRAPHY.md, confirmed again 2026-11-08). That is a bot block, not worked around: the LoC's own photochroms, Prokudin-Gorsky
plates and FSA/OWI Kodachromes are read from their Wikimedia Commons mirrors instead (per-file licence metadata attached).
Licences, public domain / CC0 only: Commons files are kept only when LicenseShortName reads PD-old / PD-US / PD-USGov / Public domain / PDM / CC0
(tools/museums/commonsd.py OPEN/BAD); NASA media is "generally not copyrighted" (nasa.gov/nasa-brand-center/images-and-media/),
and any record whose text names a non-NASA credit or a copyright is dropped.
Method (the same functions as prints_import.py / measure_staged.py): ~200 px analysis copy in research/_raw/measure-img/<id>.jpg, 6 colors
from corpus.palette_of, black-and-white and single-hue-tint scans dropped (photos_corpus.classify_color: mean C* < 2, or < 14 inside one hue;
NASA keeps the first test only, because a night sky and an ocean are honestly one hue), near-duplicates by dHash + L/C against the shard and
every other staged/held photograph, the cap spread round-robin over the source's groups (category, mission, flight) most colorful first.
Display image: Commons rows use Special:FilePath?width=640 (the app swaps it for 1280/2048 itself, js/gallery.js glSized); NASA rows use ~medium.jpg.
Polite: User-Agent "Chromatlas/1.0 (https://chromatlas.app; dmekibel@gmail.com)", one image request at a time, ~1 s apart per host; after a 403/429 at
most two retries (20 s, 45 s) and then it stops (exit 3), never works around a block. Free disk is checked every 100 images and the run stops
cleanly (keeping what it has) under 6 GB.
"""
import argparse, glob, io, json, re, shutil, sys, time, unicodedata, urllib.request, urllib.error, urllib.parse
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))

UA = "Chromatlas/1.0 (https://chromatlas.app; dmekibel@gmail.com)"
MIN_FREE = 6e9
SRCS = ("commons", "photochrom", "kahn", "nasa")

ap = argparse.ArgumentParser()
ap.add_argument("--source", choices=SRCS)
ap.add_argument("--max", type=int, default=2000)
ap.add_argument("--stage", action="store_true")
ap.add_argument("--status", action="store_true", help="only count candidates (one metadata pass, no images)")
ap.add_argument("--list", action="store_true")
ap.add_argument("--pool", type=float, default=1.3, help="fetch/measure this many times --max candidates before choosing")
args = ap.parse_args()
if args.list or not args.source:
    print("\n".join(SRCS)); sys.exit(0)

import numpy as np   # noqa: E402
import corpus as C   # noqa: E402
import measure_staged as MS   # noqa: E402
import photos_corpus as PC   # noqa: E402  (registers the photod adapter; classify_color)
from museums import photod, commonsd   # noqa: E402

SOURCE = args.source
STAGE_DIR = ROOT / "data" / ("corpus-staging" if args.stage else "corpus")
OUT = STAGE_DIR / f"zz-photos-{SOURCE}-1.json"
SCR = ROOT / "research" / "_scratch-photos"
SCR.mkdir(parents=True, exist_ok=True)


class Blocked(Exception):
    pass


_last = defaultdict(float)


def free_disk():
    return shutil.disk_usage("/System/Volumes/Data").free


def get(url, gap=1.0):
    """One polite request per host; after a 403/429 at most two retries (20 s, 45 s), then Blocked."""
    host = urllib.parse.urlparse(url).netloc
    for attempt in range(3):
        wait = gap - (time.time() - _last[host])
        if wait > 0:
            time.sleep(wait)
        _last[host] = time.time()
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=60) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code in (403, 429):
                if attempt == 2:
                    raise Blocked(f"HTTP {e.code} from {host} after two polite retries")
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


def jget(url, gap=1.0):
    return json.loads(get(url, gap))


def safe(s):
    return re.sub(r"[^A-Za-z0-9]+", "_", s).strip("_")[:70]


def file_img(title, width=640):
    """Display URL of a Commons file (js/gallery.js glSized scales ?width= for the sharp copies)."""
    name = title.split(":", 1)[-1].replace(" ", "_")
    return "https://commons.wikimedia.org/wiki/Special:FilePath/" + urllib.parse.quote(name, safe="()!,'_-.~") + f"?width={width}"


# ---------------------------------------------------------------- held ids
def held_ids():
    ids = set()
    for f in glob.glob(str(ROOT / "data" / "corpus" / "*.json")) + glob.glob(str(ROOT / "data" / "corpus-staging" / "*.json")):
        if Path(f).resolve() == OUT.resolve():
            continue
        try:
            ids |= {r["id"] for r in json.load(open(f))}
        except Exception:
            pass
    return ids


def other_commons_titles():
    """Commons file names already staged by another photo shard (so a file is never in two shards)."""
    seen = set()
    for f in glob.glob(str(ROOT / "data" / "corpus-staging" / "zz-photos-*.json")):
        if Path(f).resolve() == OUT.resolve():
            continue
        try:
            for r in json.load(open(f)):
                seen.add(re.sub(r"\W+", "", urllib.parse.unquote(str(r.get("img", "")).split("?")[0].rsplit("/", 1)[-1])).lower())
        except Exception:
            pass
    return seen


# ---------------------------------------------------------------- Commons walking
photod._THUMB_W = 330   # the API hands back a working 330 px thumb for the analysis copy
C.ADAPTERS["photod"] = photod
if "photod" not in C.SRC:
    C.SRC["photod"] = dict(dir=C.RAW / "photod", **photod.INFO)
SKIP = photod.SKIP_SUBCAT


def walk(roots, max_cats, per_cat, sample=None, keep=None, label=None):
    """Breadth-first over Commons subcategories; returns candidate dicts, each tagged with its category (the group)."""
    cache = SCR / f"{SOURCE}-walk.json"
    done = json.loads(cache.read_text()) if cache.exists() else {}
    rows, seen, visited = {}, set(), 0
    frontier = list(roots)
    while frontier and visited < max_cats:
        cat = frontier.pop(0)
        if cat in seen:
            continue
        seen.add(cat); visited += 1
        key = "files:" + cat
        if key not in done:
            try:
                pages = photod._files(C, cat, per_cat)
                done[key] = [u for u in (photod.usable(p, label or "Photograph", None) for p in pages) if u]
            except Exception as e:
                print(f"   {cat}: {e}", flush=True)
                done[key] = []
        got = [u for u in done[key] if not keep or keep(u)]
        if sample:
            got = got[:sample]
        for u in got:
            rows.setdefault(u["title"], dict(u, group=cat.split(":", 1)[-1]))
        sk = "sub:" + cat
        if sk not in done:
            try:
                done[sk] = [s for s in photod._subcats(C, cat) if not SKIP.search(s.split(":", 1)[-1])]
            except Exception:
                done[sk] = []
        frontier += done[sk]
        if visited % 10 == 0:
            print(f"  {visited} categories, {len(rows)} usable files (at {cat[:70]})", flush=True)
            cache.write_text(json.dumps(done))
    cache.write_text(json.dumps(done))
    return list(rows.values())


def commons_cand(u, process, co=None, mu=None, mv=None, credit=None):
    name = u["title"].split(":", 1)[-1]
    stem = re.sub(r"[.]\w+$", "", name)
    return dict(id=f"{SOURCE_ID}-{safe(stem)}", t=C.clean_title(u["name"]), a=photod._clean_photographer(u.get("photographer")),
                y=u.get("year"), co=co or C.country_of(" ".join([u["name"], u.get("group", "")])), mv=mv or process, process=process,
                fetch=u["thumb"], img=file_img(u["title"]), url=u["url"], lic=u["license"], group=u.get("group", ""),
                mu=mu, credit=credit or f"{mu or 'Wikimedia Commons'} via Wikimedia Commons · {u['license']}")


SOURCE_ID = {"commons": "photod", "photochrom": "photochrom", "kahn": "kahn", "nasa": "nasa"}[SOURCE]


def cands_commons():
    """data/photography/photos.json (already measured and color-filtered by tools/photos_corpus.py)."""
    out = []
    for r in json.load(open(ROOT / "data" / "photography" / "photos.json")):
        title = urllib.parse.unquote(r["img"].split("?")[0].rsplit("/", 1)[-1])
        m = re.match(r"^\d+px-(.*)$", title)
        fname = m.group(1) if m else title
        fetch = re.sub(r"/\d+px-", "/330px-", r["img"].split("?")[0]) if "/thumb/" in r["img"] else None
        proc = r["process"]
        mv = "Prokudin-Gorsky" if proc.startswith("Prokudin") else "FSA/OWI Kodachrome" if proc.startswith("Kodachrome") else proc
        mu = "Library of Congress" if proc.startswith(("Prokudin", "Kodachrome")) else None
        a = r["a"]
        if a and re.search(r"[Ѐ-ӿ]", a):
            a = None if "Прокудин" in a else a
        out.append(dict(id=r["id"], t=C.clean_title(r["t"]), a=a, y=r["y"], co=r["co"] or C.country_of(" ".join([r["t"], r["category"]])),
                        mv=mv, process=proc, fetch=fetch or r["img"], fallback=file_img("File:" + fname, 330), img=file_img("File:" + fname),
                        url=r["url"], lic=r["lic"], group=r["category"], mu=mu, premeasured=(r["p"], r["L"], r["C"]),
                        credit=f"{mu + ' via ' if mu else ''}Wikimedia Commons · {r['lic']}"))
    return out


PHOTOCHROM_ROOTS = ["Category:Photochrom pictures from the Library of Congress", "Category:Photochrom prints collection",
                    "Category:Photochrom Travel Views", "Category:Photochrom pictures in the Rijksmuseum Amsterdam", "Category:Photochrom pictures"]


def cands_photochrom():
    us = walk(PHOTOCHROM_ROOTS, max_cats=220, per_cat=900, label="Photochrom")
    out = []
    for u in us:
        c = commons_cand(u, "Photochrom", mv="Photochrom", mu="Library of Congress" if "Library of Congress" in u["group"] else None)
        if re.search(r"\b(map|chart|diagram|poster|lithograph of)\b", c["t"], re.I):
            continue
        if c["a"] is None and re.search(r"detroit|library of congress|photochrom prints collection", u["group"], re.I):
            c["a"] = "Detroit Publishing Company"
        out.append(c)
    return out


def cands_kahn():
    # the Archives of the Planet by mission (Commons: "Collections of the musée départemental Albert-Kahn, mission ..."): autochromes carry an
    # "A<number>" inventory number in their title (the black-and-white stereos and film stills do not)
    root = 'Category:Collections of the musée départemental Albert-Kahn by mission'
    keep = lambda u: re.search(r"\bA\d{2,5}\b\s*(?:\.\w+)?$", re.sub(r"\.\w+$", "", u["title"]))
    us = walk([root], max_cats=260, per_cat=90, sample=70, keep=keep, label="Autochrome")
    us += walk(["Category:Autochromes in the musée départemental Albert-Kahn"], max_cats=12, per_cat=400, label="Autochrome")
    out = []
    for u in {u["title"]: u for u in us}.values():
        out.append(commons_cand(u, "Autochrome", mv="Autochrome", mu="Musée départemental Albert-Kahn", co=None,
                                credit=f"Musée départemental Albert-Kahn (Archives of the Planet) via Wikimedia Commons · {u['license']}"))
    return out


NASA_QUERIES = ["earth from space astronaut photograph", "earth observations from space", "astronaut photograph of earth from the international space station",
                "apollo hasselblad photograph earth", "apollo lunar surface photograph", "gemini earth photograph", "earthrise", "space shuttle earth photograph",
                "aurora from space", "hurricane from space astronaut", "city lights at night from space", "sunrise from orbit", "earth horizon limb from orbit",
                "moon photographed from spacecraft", "apollo 17 photograph", "apollo 11 photograph", "skylab earth photograph", "mercury gemini astronaut photograph",
                "desert from space", "apollo 8 photograph", "apollo 12 photograph", "apollo 14 photograph", "apollo 15 photograph", "apollo 16 photograph", "dust storm from space", "river delta from space", "thunderstorm from the space station", "sunglint ocean from space", "night lights earth astronaut", "mountains from space astronaut photograph", "lake from orbit", "coastline from orbit", "island from space", "volcano from space astronaut", "clouds over ocean from space"]
NASA_ID = re.compile(r"^(as\d+-\d+-\d+|ap\d+-?[a-z]*-?\d+|s6[3-9]-\d+|s7\d-\d+|sl\d-\d+-\d+|sts\d+-\d+-\d+|sts\d+-e-\d+|iss\d+e\d+|iss\d+-e-\d+|jsc\d+e\d+|stses?\d.*|s\d{2}-e-\d+|s\d+e\d+|as\d+-[a-z]+-\d+|e\d+|nm\d.*|s\d+-\d+)", re.I)
NASA_BAD = re.compile(r"\b(artist'?s?\s+(?:concept|rendering|impression)|illustrat|animation|simulat|render|visuali[sz]ation|computer[- ]generated|diagram|logo|patch|emblem|"
                      r"poster|graphic|chart|portrait|training|suit(?:ing)?[- ]up|press conference|ceremony|briefing|visit|simulator|mockup|mock-up|model of|infographic|"
                      r"^(?:nasa |esa |jaxa )?(?:astronauts?|cosmonauts?|commander|flight engineers?|mission specialists?|payload specialists?)\b|\b(?:works?|working|conducts?|checks?|prepares?|poses?|smiles?|floats?|exercis\w+|eats?|monitors?|trains?|installs?|repairs?|videotapes|points (?:his|her)|samples|experiment|inside the|aboard the)\b|"
                      r"launch pad|rollout|rocket test|test stand|wind tunnel|official crew|crew portrait|inspect|technician|worker|engineer|spacewalk preparations)\b", re.I)
NASA_CREDIT = re.compile(r"copyright|©|\(c\)|used with permission|courtesy of (?!nasa)|credit:\s*(?!nasa)", re.I)
NASA_EARTH = re.compile(r"\b(earth|moon|lunar|aurora|cloud|hurricane|typhoon|cyclone|sunrise|sunset|horizon|limb|island|desert|volcan|river|coast|lake|glacier|ice|city|night|"
                        r"crater|mountain|delta|reef|bay|sea|ocean|gulf|peninsula|atoll|canyon|dune|storm|smoke|fire|flood|nile|himalaya|alps|surface|apollo|gemini|orbit)", re.I)
NASA_FIELDS = ("center", "date_created", "description", "keywords", "nasa_id", "title", "photographer", "secondary_creator", "album")


def nasa_year(it):
    d = it.get("description") or ""
    m = re.match(r"^[^(]{0,40}\(([^)]{0,50}?)\)", d.strip())
    if m:
        y = re.search(r"(19[5-9]\d|20[0-3]\d)", m.group(1))
        if y:
            return int(y.group(1))
    m = re.match(r"(\d{4})", it.get("date_created") or "")
    return int(m.group(1)) if m else None


def nasa_clean(s):
    s = re.sub(r"<[^>]+>", " ", s or "")
    s = re.sub(r"^[A-Za-z0-9\-_ ]{3,24}\s*\([^)]{0,50}\)\s*-+\s*", "", s.strip())   # "AS17-148-22727 (7 Dec. 1972) --- "
    return re.sub(r"\s+", " ", s).strip()


def cands_nasa():
    cache = SCR / "nasa-items.jsonl"
    items = {}
    if cache.exists():
        for line in cache.read_text().splitlines():
            try:
                x = json.loads(line); items[x["id"]] = x
            except Exception:
                pass
    qdone = SCR / "nasa-queries.json"
    qd = json.loads(qdone.read_text()) if qdone.exists() else {}
    out = cache.open("a")
    for q in NASA_QUERIES:
        if qd.get(q):
            continue
        page, n = 1, 0
        while page <= 12:
            url = "https://images-api.nasa.gov/search?" + urllib.parse.urlencode(dict(q=q, media_type="image", page_size=100, page=page))
            try:
                r = jget(url)
            except urllib.error.HTTPError as e:
                if e.code == 400:
                    break   # past the last page
                raise
            its = r["collection"]["items"]
            for it in its:
                d = (it.get("data") or [{}])[0]
                nid = d.get("nasa_id")
                if not nid or nid in items:
                    continue
                links = {l.get("href", "") for l in it.get("links", [])}
                small = next((l for l in links if l.endswith("~small.jpg")), None) or next((l for l in links if l.endswith("~thumb.jpg")), None)
                if not small:
                    continue
                rec = dict(id=nid, d={k: d.get(k) for k in NASA_FIELDS}, small=small, q=q)
                items[nid] = rec
                out.write(json.dumps(rec, ensure_ascii=False) + "\n")
                n += 1
            out.flush()
            if len(its) < 100:
                break
            page += 1
        qd[q] = n
        qdone.write_text(json.dumps(qd))
        print(f"  nasa query '{q}': {n} new items ({len(items)} total)", flush=True)
    out.close()
    drops = Counter()
    res = []
    for nid, rec in items.items():
        d = rec["d"]
        text = " ".join([d.get("title") or "", d.get("description") or ""])
        if not NASA_ID.match(nid):
            drops["not an astronaut/crew camera frame id"] += 1; continue
        if NASA_BAD.search(d.get("title") or ""):
            drops["title says illustration / people / test"] += 1; continue
        if NASA_CREDIT.search(text) or (d.get("secondary_creator") and not re.search(r"nasa", d["secondary_creator"], re.I)):
            drops["non-NASA credit or copyright"] += 1; continue
        kw = " ".join(d.get("keywords") or [])
        if not (NASA_EARTH.search(d.get("title") or "") or re.search(r"earth observ|lunar|moon|apollo|gemini", kw, re.I)):
            drops["no Earth/Moon subject"] += 1; continue
        y = nasa_year(d)
        if y is None or y < 1960:
            drops["no year"] += 1; continue
        t = nasa_clean(d.get("title"))
        if re.match(r"^[A-Za-z]{2,6}\d", t) and len(t) < 18:   # just a frame number: take the description's first sentence
            t = nasa_clean(d.get("description")).split(". ")[0][:90] or t
        pre = nid.lower()[:3] if not nid.lower().startswith(("iss", "sts", "jsc", "sl")) else re.match(r"[a-z]+\d*", nid.lower()).group(0)
        grp = re.match(r"^(as\d+|ap\d+|s6\d|s7\d|sl\d|sts\d+|iss\d+|jsc\d+|s\d+|[a-z]+)", nid.lower()).group(1)
        res.append(dict(id=f"nasa-{safe(nid.lower())}", t=C.clean_title(t), a=d.get("photographer") or "NASA", y=y, co=None,
                        mv="Space photography", process="NASA photograph", fetch=rec["small"], img=rec["small"].replace("~small.jpg", "~medium.jpg").replace("~thumb.jpg", "~medium.jpg"),
                        url=f"https://images.nasa.gov/details/{nid}", lic="NASA media (generally not copyrighted)", group=grp, mu="NASA",
                        credit="NASA · media generally not copyrighted (nasa.gov/nasa-brand-center/images-and-media)"))
    print("nasa candidate drops:", dict(drops), flush=True)
    return res


# ---------------------------------------------------------------- images and measuring
def fetch_image(c):
    p = MS.cache_path(c["id"])
    if p.exists() and p.stat().st_size > 500:
        return p
    from PIL import Image
    last = None
    for u in [c["fetch"]] + ([c["fallback"]] if c.get("fallback") else []):
        try:
            im = Image.open(io.BytesIO(get(u))).convert("RGB")
            if im.width > C.IMG_W:
                im = im.resize((C.IMG_W, max(1, round(im.height * C.IMG_W / im.width))), Image.LANCZOS)
            im.save(p, "JPEG", quality=92)
            return p
        except Blocked:
            raise
        except Exception as e:
            last = e
    raise last


def measure(c, app, app_lab):
    if c.get("premeasured"):
        return c["premeasured"]
    pal = C.palette_of(str(MS.cache_path(c["id"])))
    if pal["C"] < C.BW_C:
        return None
    ok, mean_c, spread = PC.classify_color(pal["lab"], pal["share"])
    if SOURCE == "nasa":
        ok = mean_c >= PC.MONO_C
    if not ok:
        return None
    rgbs = C.lab_to_rgb(np.array(pal["lab"]))
    exact = C.rgb_to_lab(rgbs)
    V = C.de2000(exact, app_lab).argmin(1)
    Ls, Cs, Hs = C.lch(exact)
    shares = [round(s, 3) for s in pal["share"]]
    shares[0] = round(shares[0] + 1 - sum(shares), 3)
    p = [[C.rgb_to_hex(rgbs[i]), shares[i], app[V[i]][0], C.family(Ls[i], Cs[i], Hs[i])] for i in range(len(shares))]
    return p, round(pal["L"], 1), round(pal["C"], 1)


def round_robin(items, n, key):
    groups = defaultdict(list)
    for c in sorted(items, key=lambda c: (-key(c), c["id"])):
        groups[c["group"]].append(c)
    out = []
    while len(out) < n and any(groups.values()):
        for g in sorted(groups, key=lambda g: -len(groups[g])):
            if groups[g] and len(out) < n:
                out.append(groups[g].pop(0))
    return out


def pool_order(items, n):
    """Interleave groups AND years so a capped pool still spans the source."""
    groups = defaultdict(list)
    for c in sorted(items, key=lambda c: c["id"]):
        groups[c["group"]].append(c)
    out = []
    while len(out) < n and any(groups.values()):
        for g in sorted(groups):
            if groups[g] and len(out) < n:
                out.append(groups[g].pop(0))
    return out


def existing_photo_rows():
    rows = []
    for f in glob.glob(str(ROOT / "data" / "corpus-staging" / "zz-photos-*.json")):
        if Path(f).resolve() == OUT.resolve():
            continue
        try:
            rows += [r for r in json.load(open(f)) if r.get("L") is not None]
        except Exception:
            pass
    return rows


def main():
    drops = Counter()
    cands = {"commons": cands_commons, "photochrom": cands_photochrom, "kahn": cands_kahn, "nasa": cands_nasa}[SOURCE]()
    n0 = len(cands)
    held = held_ids()
    seen_files = other_commons_titles()
    k = []
    for c in cands:
        fn = re.sub(r"\W+", "", urllib.parse.unquote(c["img"].split("?")[0].rsplit("/", 1)[-1])).lower()
        if c["id"] in held or c["id"] in C.NONPAINTINGS:
            drops["already in corpus/staging"] += 1; continue
        if SOURCE != "nasa" and fn in seen_files:
            drops["file already in another photo shard"] += 1; continue
        k.append(c)
    cands = list({c["id"]: c for c in k}.values())
    print(f"{SOURCE}: {n0} candidates ({dict(drops)}); {len(cands)} left; groups {len({c['group'] for c in cands})}", flush=True)
    if args.status:
        by = Counter(c["group"] for c in cands)
        print("largest groups:", by.most_common(8))
        return
    pool = pool_order(cands, int(args.max * args.pool) + 10) if SOURCE != "commons" else cands
    print(f"pool of {len(pool)} to fetch and measure", flush=True)
    MS.CACHE.mkdir(parents=True, exist_ok=True)
    blocked, ready, n_img = None, [], 0
    for c in pool:
        p = MS.cache_path(c["id"])
        if not (p.exists() and p.stat().st_size > 500):
            if n_img % 100 == 0 and free_disk() < MIN_FREE:
                print(f"STOP: free disk {free_disk() / 1e9:.1f} GB < 6 GB", flush=True)
                blocked = "low disk"; break
            try:
                fetch_image(c); n_img += 1
            except Blocked as e:
                print("BLOCKED:", e, "- stopped, nothing worked around.", flush=True)
                blocked = str(e); break
            except Exception:
                drops["image failed"] += 1; continue
        ready.append(c)
        if len(ready) % 200 == 0:
            print(f"  {len(ready)} images ready, free {free_disk() / 1e9:.1f} GB", flush=True)

    app = C.app_names()
    app_lab = C.rgb_to_lab(np.array([C.hex_to_rgb(h) for _, h in app]))
    rows = []
    for c in ready:
        try:
            res = measure(c, app, app_lab)
        except Exception:
            drops["unmeasurable"] += 1; continue
        if not res:
            drops["black-and-white / single-hue tint"] += 1; continue
        r = dict(id=c["id"], src=SOURCE_ID, t=c["t"] or "Untitled", a=c["a"], y=c["y"], span=None, co=c["co"], mv=c["mv"], img=c["img"],
                 license=c["lic"], url=c["url"], medium=c["process"], credit=c["credit"], mu=c["mu"])
        r["p"], r["L"], r["C"] = res
        r["kind"] = "photograph"
        r = {k_: v for k_, v in r.items() if v is not None or k_ in ("a", "y", "co")}
        rows.append(r)
    if not rows:
        print("no rows"); return

    # near-duplicates: same picture (dHash close, L/C close) inside the shard or in any other staged/held photograph
    pool_old = existing_photo_rows()
    hashes = {}

    def h_of(r):
        if r["id"] not in hashes:
            try:
                hashes[r["id"]] = C.dhash(MS.cache_path(r["id"]))
            except Exception:
                hashes[r["id"]] = 0
        return hashes[r["id"]]
    keep, dup = [], []
    pool_k = list(pool_old)
    for r in sorted(rows, key=lambda r: r["id"]):
        hr = h_of(r)
        d = None
        if hr:
            for o in pool_k:
                ho = h_of(o)
                if ho and abs(o["L"] - r["L"]) < 4 and abs(o["C"] - r["C"]) < 4 and bin(hr ^ ho).count("1") <= 5:
                    d = o["id"]; break
        if d:
            dup.append((r["id"], d)); continue
        keep.append(r); pool_k.append(r)
    (SCR / f"dups-{SOURCE}.json").write_text(json.dumps(dup))
    grp = {c["id"]: c["group"] for c in ready}
    chosen = round_robin([dict(r, group=grp.get(r["id"], "")) for r in keep], args.max, key=lambda r: r["C"]) if len(keep) > args.max else [dict(r, group="") for r in keep]
    chosen = [{k_: v for k_, v in r.items() if k_ != "group"} for r in chosen]
    chosen.sort(key=lambda r: ((r["y"] or 9999), r["id"]))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    line = lambda r: json.dumps(r, ensure_ascii=False, separators=(",", ":"))
    OUT.write_text("[\n" + ",\n".join(line(r) for r in chosen) + "\n]\n", encoding="utf-8")
    print(f"RESULT {SOURCE}: staged {len(chosen)} | candidates {n0}, fetched/ready {len(ready)}, near-duplicates {len(dup)}, "
          f"B&W/tinted {drops.get('black-and-white / single-hue tint', 0)}, image failed {drops.get('image failed', 0)}, not chosen (cap) {len(keep) - len(chosen)} | "
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
