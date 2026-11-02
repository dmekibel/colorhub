#!/usr/bin/env python3
"""One reusable Commons batch: a region or tradition is a config file, not a new script (2026-10-27; generalizes persian_extra.py +
persian_filter.py + run_persian_pipeline.sh).

  python3 tools/commons_batch.py caucasus-central-asia --status   # crawl (cached) + counts; NO image downloads, NO writes under data/
  python3 tools/commons_batch.py caucasus-central-asia            # full run: crawl, candidates, dedupe, caps, fetch images, palettes,
                                                                  #   CLIP filter, write data/corpus/zz-batch-<name>-1.json
  options: --max N (total rows, overrides config), --stage (write data/corpus-staging/ instead), --no-filter, --force-concurrent,
           --root "Category:X" (only that root: for a small test), --depth N (override every root's depth)

Config: design/batches/<name>.json (see design/batches/_example.json and the three starter configs). The tool NEVER rebuilds: it ends by
printing the one command to run (tools/rebuild_all.sh --atlas), which adds the shard to the gallery (append-only order).

What a config says
  name, note
  slug            source slug of the rows (default "commons": ids are commons-F<pageid>, like every Commons row)
  depth           default category depth below each root (default 3)
  date            {"from": 1000, "to": 1925}  window for DATED files; "to" is clamped to 1925 (public domain)
  roots           [{cat, co, mv, artist | artist_periods, depth?, max?, per_group?, died?, undated_ok?, nofilter?, sure?, note?}]
                  co = country stamped on the row, mv = movement/tradition label, artist = default painter label (a "Paintings by X"
                  category on the file wins), artist_periods = [[before_year, label], ...], max = most rows from this root,
                  per_group = most folios per leaf category (a manuscript), died = painter's death year: if < 1955 every file of the
                  root is accepted whatever its date (public domain by life+70), undated_ok = accept files with no date at all
                  (use for medieval manuscripts and icons), nofilter = skip the CLIP filter for this root (painters' oil paintings).
  co_rules, mv_rules  [[regex over file title + categories, value]]: refine co / mv per file (first match wins)
  skip_cat, skip_file extra regexes (added to the built-in lists of non-paintings and modern painters)
  min_px, min_short   size floor (default 500 long side, 200 short side)
  caps            {"per_group": 30, "total": 3000, "overshoot": 1.3}  per-manuscript cap, total rows, extra fetched for the filters
  filter          {"enabled": true, "text": 0.75, "blank": 0.5, "sketch": 0.5, "ornament": 0.6, "dup": 0.975, "text_prompt": "..."}
Cache: research/_raw/batch/ (gitignored): cats.json (category members, shared by all configs), <name>/ (status, dropped). Images land in
research/_raw/commons/img/ like every Commons painting (so a file fetched for one batch is never fetched again).
Politeness: API 1 request per second; images the fetch_missing_images pattern (Wikimedia hosts ~0.33 s per request, 3 workers, one HTTP 429
pauses the whole host 60 s). A full run refuses to start while rebuild_all.sh or another fetch is running (--force-concurrent overrides).
"""
import argparse, io, json, os, re, subprocess, sys, threading, time, urllib.error, urllib.parse, urllib.request
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
CLIPENV = ROOT / "research" / "_raw" / "clipenv" / "bin" / "python"
BATCHES = ROOT / "design" / "batches"
UA = "ChromatlasBatch/1.0 (https://github.com/dmekibel/colorhub; dmekibel@gmail.com)"
WM = ("wikimedia.org", "wikipedia.org")

# ---- built-in exclusions (from persian_extra.py): non-paintings and obviously modern or copyrighted material -------------------------
SKIP_CAT = re.compile(r"Door|doors|Bookbinding|Binding|Sketches|Lithograph|Abstract|Details of|Copies of|Horoscope|Nude|oil on canvas location missing|"
                      r"Calligraphy|Photographs|Photographers|Coins|Ceramic|Textile|Carpet|Rugs|Metalwork|Glassware|Architecture|Mosque|Exhibition|Stamps|"
                      r"Banknotes|Posters|Postcards|Sculpture|Statue|Monument|Cemetery|Museum interiors|Maps|Mosaic", re.I)
SKIP_FILE = re.compile(r"binding|reliure|cover|colophon|stamp|coin|ceramic|tile|carpet|photograph|photo\b|map of|diagram|signature|seal|rubbing|bowl|ewer|"
                       r"vase|textile|armor|sword|\.svg|logo|flag of|coat of arms|banknote|postcard|poster|sculpture|statue", re.I)
PAINTER_CAT = re.compile(r"^(?:Persian miniatures|Paintings|Google Art Project works|Portrait paintings|Miniatures|Icons|Orientalist paintings) by (.+?)(?: in .*| by museum)?$")
CENTURY = re.compile(r"^(\d\d)(?:st|nd|rd|th)-century")


def load_config(name):
    p = Path(name) if name.endswith(".json") else BATCHES / f"{name}.json"
    cfg = json.loads(p.read_text())
    cfg.setdefault("name", p.stem)
    cfg.setdefault("slug", "commons")
    cfg.setdefault("depth", 3)
    cfg["date"] = dict({"from": 1000, "to": 1925}, **cfg.get("date", {}))
    cfg["date"]["to"] = min(cfg["date"]["to"], 1925)
    cfg.setdefault("min_px", 500)
    cfg.setdefault("min_short", 200)
    cfg["caps"] = dict({"per_group": 30, "total": 3000, "overshoot": 1.3}, **cfg.get("caps", {}))
    cfg["filter"] = dict({"enabled": True, "text": 0.75, "blank": 0.5, "sketch": 0.5, "ornament": 0.6, "dup": 0.975}, **cfg.get("filter", {}))
    for r in cfg["roots"]:
        r.setdefault("cat", "")
        if not r["cat"].startswith("Category:"):
            r["cat"] = "Category:" + r["cat"]
    return cfg


# ---- Commons API (read-only, cached, 1 request per second) ---------------------------------------------------------------------------
API = ("https://commons.wikimedia.org/w/api.php?format=json&action=query&generator=categorymembers&gcmtype=file|subcat&gcmlimit=500"
       "&prop=imageinfo|pageprops&ppprop=wikibase_item&iiprop=url|size|mime|extmetadata&iiextmetadatafilter=DateTimeOriginal|ObjectName|Artist&gcmtitle=")
_api_lock, _api_last = threading.Lock(), [0.0]


def api_get(url, tries=5):
    for n in range(tries):
        with _api_lock:
            wait = _api_last[0] + 1.0 - time.time()
            _api_last[0] = max(time.time(), _api_last[0] + 1.0)
        if wait > 0:
            time.sleep(wait)
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=90) as r:
                return json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            if e.code in (429, 503):
                print(f"  API HTTP {e.code}: pausing 60 s", flush=True)
                with _api_lock:
                    _api_last[0] = time.time() + 60
                continue
            if e.code in (400, 403, 404, 410):
                raise
        except Exception:
            time.sleep(3 * (n + 1))
    raise RuntimeError("api failed: " + url[-120:])


def cat_members(cache, cat):
    """Members (files and subcategories) of one category, merged by page id across continuation batches. Cached in cats.json."""
    if cat in cache["cats"]:
        return cache["cats"][cat]
    by_id, cont = {}, ""
    while True:
        r = api_get(API + urllib.parse.quote(cat) + cont)
        for pg in (r.get("query", {}).get("pages", {}) or {}).values():
            m = by_id.setdefault(pg.get("pageid"), dict(t=pg.get("title", ""), ns=pg.get("ns"), id=pg.get("pageid")))
            ii = (pg.get("imageinfo") or [None])[0]
            if ii:
                m.update(w=ii.get("width"), h=ii.get("height"), mime=ii.get("mime"),
                         md={k: re.sub(r"<[^>]+>", "", str(v.get("value", ""))).strip() for k, v in (ii.get("extmetadata") or {}).items()})
            q = (pg.get("pageprops") or {}).get("wikibase_item")
            if q:
                m["wd"] = q
        if "continue" not in r:
            break
        cont = "&" + urllib.parse.urlencode(r["continue"])
    cache["cats"][cat] = list(by_id.values())
    cache["dirty"] = cache.get("dirty", 0) + 1
    return cache["cats"][cat]


def save_cache(cache, path):
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps({"cats": cache["cats"]}))
    tmp.replace(path)
    cache["dirty"] = 0


def crawl(cfg, cache, cpath, only=None, depth_override=None):
    """BFS per root to its depth. Returns {file title: member + cats + root index}, categories seen."""
    files, seen_all = {}, set()
    skip = re.compile(cfg["skip_cat"], re.I) if cfg.get("skip_cat") else None
    for ri, root in enumerate(cfg["roots"]):
        if only and root["cat"] != only:
            continue
        depth = depth_override if depth_override is not None else root.get("depth", cfg["depth"])
        todo, seen = [(root["cat"], 0)], set()
        while todo:
            cat, d = todo.pop(0)
            if cat in seen:
                continue
            seen.add(cat)
            try:
                mem = cat_members(cache, cat)
            except urllib.error.HTTPError as e:
                print(f"  skipped {cat}: HTTP {e.code}", flush=True)
                mem = cache["cats"].setdefault(cat, [])
            if cache.get("dirty", 0) >= 20:
                save_cache(cache, cpath)
                print(f"  crawled {len(cache['cats'])} categories", flush=True)
            for m in mem:
                if m["ns"] == 14:
                    if d + 1 <= depth and not SKIP_CAT.search(m["t"]) and not (skip and skip.search(m["t"])):
                        todo.append((m["t"], d + 1))
                elif m["ns"] == 6 and m.get("mime"):
                    f = files.setdefault(m["t"], dict(m, cats=[], root=ri))
                    if f["root"] == ri:
                        f["cats"].append(cat)
        seen_all |= seen
    save_cache(cache, cpath)
    return files, seen_all


# ---- candidates --------------------------------------------------------------------------------------------------------------------
def year_of(f, cfg, root):
    """Year of a file, or None. Metadata date wins (a range that ends after the public-domain limit rejects the file: returns 'late')."""
    md, t, lim = f["md"], f["t"], cfg["date"]["to"]
    ds = md.get("DateTimeOriginal", "")
    ys = [int(y) for y in re.findall(r"(?<!\d)(1[0-9]\d\d|20[0-2]\d)(?!\d)", ds)]
    if ys:
        if max(ys) > lim and not root.get("_pd_painter"):
            return "late"
        if min(ys) >= cfg["date"]["from"]:
            return min(ys)
    ys = [int(y) for y in re.findall(r"(?<!\d)(1[0-9]\d\d)(?!\d)", t) if cfg["date"]["from"] <= int(y) <= lim]
    if ys:
        return ys[0]
    for c in f["cats"]:
        m = CENTURY.match(c.replace("Category:", ""))
        if m and 10 <= int(m.group(1)) <= 20:
            return (int(m.group(1)) - 1) * 100 + 50
    return None


def artist_of(f, y, root):
    for c in f["cats"]:
        m = PAINTER_CAT.match(c.replace("Category:", ""))
        if m and not re.search(r"artist|museum|century|collection|dynastic|genre|subject|country|medium|technique|style|date", m.group(1), re.I):
            return re.sub(r" \(painter\)$", "", m.group(1))
    if root.get("artist_periods") and isinstance(y, int):
        return next((lab for lim, lab in root["artist_periods"] if y < lim), root["artist_periods"][-1][1])
    return root.get("artist") or "Unknown painter"


def candidates(cfg, files, min_px=None):
    out, why = [], Counter()
    for t, f in files.items():
        root = cfg["roots"][f["root"]]
        root["_pd_painter"] = bool(root.get("died") and root["died"] < 1955)
        if not re.search(r"\.(jpe?g|png|tiff?)$", t, re.I) or SKIP_FILE.search(t) or (cfg.get("skip_file") and re.search(cfg["skip_file"], t, re.I)):
            why["not a picture file / skipped name"] += 1; continue
        if f.get("mime") not in ("image/jpeg", "image/png", "image/tiff") or max(f.get("w") or 0, f.get("h") or 0) < cfg["min_px"] or min(f.get("w") or 0, f.get("h") or 0) < cfg["min_short"]:
            why["too small or wrong type"] += 1; continue
        y = year_of(f, cfg, root)
        if y == "late":
            why["dated after 1925"] += 1; continue
        if y is None and not (root.get("undated_ok") or root["_pd_painter"]):
            why["undated (cannot show it is public domain)"] += 1; continue
        text = " ".join(f["cats"]) + " " + t
        title = f["md"].get("ObjectName") or re.sub(r"\.(jpe?g|png|tiff?)$", "", t.split(":", 1)[1], flags=re.I).replace("_", " ")
        co, mv = root.get("co", ""), root.get("mv", "")
        co = next((v for rx, v in cfg.get("co_rules", []) if re.search(rx, text, re.I)), co)
        mv = next((v for rx, v in cfg.get("mv_rules", []) if re.search(rx, text, re.I)), mv)
        out.append(dict(q=f"F{f['id']}", wd=f.get("wd"), file=t.split(":", 1)[1], t=title[:160], y=y, a=artist_of(f, y, root), co=co, mv=mv, root=f["root"],
                        nofilter=bool(root.get("nofilter")), group=f["cats"][-1] if f["cats"] else "", cats=f["cats"]))
    return out, why


def norm_title(s):
    s = urllib.parse.unquote(str(s)).split("?")[0].rsplit("/", 1)[-1]
    s = re.sub(r"^\d+px-", "", s.replace("File:", ""))
    s = re.sub(r"\.(jpe?g|png|tiff?|webp)$", "", s, flags=re.I).replace("_", " ").lower()
    s = re.sub(r"google art project|\(.*?\)|\bcopy\b", " ", s)
    return re.sub(r"[^a-z0-9À-￿]+", " ", s).strip()


def corpus_index(C):
    ids, titles, qs = set(), set(), set()
    for r in C.load_corpus():
        ids.add(r["id"])
        for k in ("img", "url"):
            if r.get(k) and ("File:" in r[k] or "wikimedia.org" in r[k]):
                titles.add(norm_title(r[k]))
        m = re.search(r"/(Q\d+)", r.get("url", "") or "")
        if m:
            qs.add(m.group(1))
        if re.match(r"commons2?-Q\d+$", r["id"]):
            qs.add(r["id"].split("-", 1)[1])
    return ids, titles, qs


def drop_existing(cands, idx, slug):
    ids, titles, qs = idx
    kept, gone = [], Counter()
    for c in cands:
        if f"{slug}-{c['q']}" in ids or f"commons-{c['q']}" in ids:
            gone["same id already in the corpus"] += 1
        elif norm_title(c["file"]) in titles:
            gone["same file title as an existing row"] += 1
        elif c.get("wd") and c["wd"] in qs:
            gone["same Wikidata item as an existing row"] += 1
        else:
            kept.append(c)
    return kept, gone


def spread(rows, n, per_group, root_max=None):
    """At most per_group folios per leaf category (a manuscript), at most root_max[root] per root, then n rows round-robin over decades."""
    by_group = defaultdict(list)
    for r in sorted(rows, key=lambda r: r["id"]):
        by_group[(r["_root"], r["_group"])].append(r)
    limited = []
    for (ro, g), rs in by_group.items():
        pg = per_group.get(ro, per_group["default"])
        if len(rs) > pg:
            step = len(rs) / pg
            rs = [rs[int(i * step)] for i in range(pg)]
        limited += rs
    if root_max:
        by_root = defaultdict(list)
        for r in sorted(limited, key=lambda r: (r["y"] if isinstance(r["y"], int) else 9999, r["id"])):
            by_root[r["_root"]].append(r)
        limited = []
        for ro, rs in by_root.items():
            m = root_max.get(ro)
            if m and len(rs) > m:
                step = len(rs) / m
                rs = [rs[int(i * step)] for i in range(m)]
            limited += rs
    strata = defaultdict(list)
    for r in sorted(limited, key=lambda r: (r["y"] if isinstance(r["y"], int) else 9999, r["id"])):
        strata[(r["y"] // 10 * 10) if isinstance(r["y"], int) else None].append(r)
    keys = sorted(strata, key=lambda k: k or 0)
    out = []
    while len(out) < n and any(strata.values()):
        for k in keys:
            if strata[k] and len(out) < n:
                out.append(strata[k].pop(0))
    return out


def caps_for(cfg):
    per_group = {"default": cfg["caps"]["per_group"]}
    root_max = {}
    for i, r in enumerate(cfg["roots"]):
        if r.get("per_group"):
            per_group[i] = r["per_group"]
        if r.get("max"):
            root_max[i] = r["max"]
    return per_group, root_max


def pool(cands, q_key="q"):
    return [dict(c, id=c[q_key], _group=c["group"], _root=c["root"]) for c in cands]


def thumb(file, w=400):
    return f"https://commons.wikimedia.org/wiki/Special:FilePath/{urllib.parse.quote(file)}?width={w}"


# ---- polite image fetch (the fetch_missing_images.py pattern) --------------------------------------------------------------------------
_host_gap, _host_lock = {}, threading.Lock()


def polite_get(url, tries=5):
    host = urllib.parse.urlparse(url).netloc
    for n in range(tries):
        gap = 0.33 if host.endswith(WM) else 0.25
        with _host_lock:
            wait = _host_gap.get(host, 0) + gap - time.time()
            _host_gap[host] = max(time.time(), _host_gap.get(host, 0) + gap)
        if wait > 0:
            time.sleep(wait)
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=60) as r:
                data = r.read()
            final = urllib.parse.urlparse(r.geturl()).netloc   # Special:FilePath redirects to upload.wikimedia.org: pace that host too
            if final != host:
                with _host_lock:
                    _host_gap[final] = max(time.time(), _host_gap.get(final, 0) + (0.33 if final.endswith(WM) else 0.25))
            return data
        except urllib.error.HTTPError as e:
            if e.code in (429, 503):
                with _host_lock:   # one 429 pauses the whole host for 60 s, not just this worker
                    _host_gap[host] = max(_host_gap.get(host, 0), time.time() + 60)
                print(f"  {e.code} from {host}: pausing it 60 s", flush=True)
                continue
            if e.code in (404, 403, 410):
                raise
        except Exception:
            time.sleep(3 * (n + 1))
    raise RuntimeError("fetch failed")


def fetch_images(C, cands):
    from concurrent.futures import ThreadPoolExecutor
    from PIL import Image
    (C.RAW / "commons" / "img").mkdir(parents=True, exist_ok=True)
    todo = [c for c in cands if not C.img_path("commons", c["q"]).exists()]
    print(f"images: {len(cands)} candidates, {len(todo)} to fetch (3 workers, one request per 0.33 s per Wikimedia host)", flush=True)
    bad, done = {}, [0]

    def one(c):
        try:
            im = Image.open(io.BytesIO(polite_get(thumb(c["file"])))).convert("RGB")
            if im.width > C.IMG_W:
                im = im.resize((C.IMG_W, max(1, round(im.height * C.IMG_W / im.width))), Image.LANCZOS)
            im.save(C.img_path("commons", c["q"]), "JPEG", quality=92)
        except Exception as e:
            bad[c["q"]] = str(e)[:120]
        done[0] += 1
        if done[0] % 500 == 0:
            print(f"  {done[0]}/{len(todo)} fetched, {len(bad)} failed", flush=True)
    with ThreadPoolExecutor(3) as ex:
        list(ex.map(one, todo))
    print(f"images done, {len(bad)} failed", flush=True)
    return bad


def palettes(C, cands):
    pals = C.load_palettes()
    new = [(f"commons-{c['q']}", str(C.img_path("commons", c["q"]))) for c in cands if f"commons-{c['q']}" not in pals and C.img_path("commons", c["q"]).exists()]
    print(f"palettes: {len(new)} to compute", flush=True)
    with C.PAL_CACHE.open("a") as fh:
        for i, (key, path) in enumerate(new):
            try:
                res = C.palette_of(path)
            except Exception as e:
                print("  palette failed", key, e)
                continue
            res["key"] = key
            fh.write(json.dumps(res) + "\n")
            if (i + 1) % 500 == 0:
                print(f"  {i + 1}/{len(new)}", flush=True)
    return C.load_palettes()


def build_rows(C, cands, pals, slug):
    import numpy as np
    app = C.app_names()
    app_lab = C.rgb_to_lab(np.array([C.hex_to_rgb(h) for _, h in app]))
    rows = []
    for c in cands:
        key = f"commons-{c['q']}"
        p = pals.get(key)
        if key in C.NONPAINTINGS or not p or p["C"] < C.BW_C:
            continue
        rgbs = C.lab_to_rgb(np.array(p["lab"]))
        exact = C.rgb_to_lab(rgbs)
        V = C.de2000(exact, app_lab).argmin(1)
        Ls, Cs, Hs = C.lch(exact)
        shares = [round(s, 3) for s in p["share"]]
        shares[0] = round(shares[0] + 1 - sum(shares), 3)
        rows.append(dict(id=key, src="commons", t=C.clean_title(c["t"]) or "Untitled", a=c["a"], y=c["y"] if isinstance(c["y"], int) else None, co=c["co"], mv=c["mv"],
                         img=thumb(c["file"], 400),
                         p=[[C.rgb_to_hex(rgbs[i]), shares[i], app[V[i]][0], C.family(Ls[i], Cs[i], Hs[i])] for i in range(len(shares))],
                         L=round(p["L"], 1), C=round(p["C"], 1), url="https://commons.wikimedia.org/wiki/File:" + urllib.parse.quote(c["file"]),
                         _group=c["group"], _root=c["root"], _nofilter=c["nofilter"]))
    return rows


def drop_duplicates(C, new, old):
    """Same file, or the same picture (dHash + center dE), against rows of the same countries already in the corpus."""
    seen_img = {norm_title(r["img"]) for r in old}
    hashes = {}

    def h_of(r):
        if r["id"] not in hashes:
            src, rid = r["id"].split("-", 1)
            try:
                hashes[r["id"]] = C.dhash(C.img_path(src, rid))
            except Exception:
                hashes[r["id"]] = 0
        return hashes[r["id"]]
    kept, dropped, pl = [], [], list(old)
    for r in sorted(new, key=lambda r: r["id"]):
        if norm_title(r["img"]) in seen_img:
            dropped.append((r["id"], "same image")); continue
        hr, dup = h_of(r), None
        if hr:
            for o in pl:
                ho = h_of(o)
                if not ho or ("L" in o and "L" in r and (abs(o["L"] - r["L"]) >= 3 or abs(o["C"] - r["C"]) >= 3)):
                    continue
                if bin(hr ^ ho).count("1") <= C.DUP_BITS_ANY and C.center_de(o, r) < C.DUP_DE:
                    dup = o["id"]; break
        if dup:
            dropped.append((r["id"], "near-duplicate of " + dup)); continue
        kept.append(r); pl.append(r); seen_img.add(norm_title(r["img"]))
    return kept, dropped


# ---- CLIP filter (persian_filter.py, generic): runs in research/_raw/clipenv as a subprocess ----------------------------------------------
def clip_filter_main(rows_path, out_path, cfg_path):
    """Internal mode (--_clip): score each row's cached image, drop text pages / blank paper / sketches / ornament / CLIP duplicates."""
    import numpy as np, torch, open_clip
    from PIL import Image
    import corpus as C
    cfg = load_config(cfg_path)
    F = cfg["filter"]
    rows = json.loads(Path(rows_path).read_text())
    dev = "mps" if torch.backends.mps.is_available() else "cpu"
    model, _, pre = open_clip.create_model_and_transforms("ViT-B-32", pretrained="laion2b_s34b_b79k")
    model = model.to(dev).eval(); tok = open_clip.get_tokenizer("ViT-B-32")
    CLS = ["a miniature painting with figures, animals, buildings or landscape", "a portrait painting of a person",
           F.get("text_prompt", "a manuscript page that is mostly lines of Arabic, Persian, Armenian, Georgian or Cyrillic calligraphy text"),
           "a blank, stained or faded sheet of paper", "a pencil or ink sketch on paper", "a decorative geometric or floral ornament"]
    keep, dropped, embs = [], {}, {}
    with torch.no_grad():
        T = model.encode_text(tok(CLS).to(dev)); T = T / T.norm(dim=-1, keepdim=True)
        for i, r in enumerate(rows):
            src, rid = r["id"].split("-", 1)
            try:
                im = pre(Image.open(C.img_path(src, rid)).convert("RGB")).unsqueeze(0).to(dev)
                e = model.encode_image(im); e = e / e.norm(dim=-1, keepdim=True)
                p = (100 * e @ T.T).softmax(-1)[0].cpu().numpy()
            except Exception:
                keep.append(r); continue
            embs[r["id"]] = e[0].cpu().numpy().astype(np.float32)
            if not r.get("_nofilter") and (p[2] > F["text"] or p[3] > F["blank"] or p[4] > F["sketch"] or p[5] > F["ornament"]):
                dropped[r["id"]] = [round(float(x), 2) for x in p] + [r["t"][:60]]
            else:
                keep.append(r)
            if (i + 1) % 500 == 0:
                print(f"  {i + 1}/{len(rows)} scored, {len(dropped)} dropped", flush=True)
    DUP, BAND = F["dup"], 0.93
    ids = [r["id"] for r in keep if r["id"] in embs]
    band, gone = [], set()
    if ids:
        M = np.stack([embs[i] for i in ids]); S = M @ M.T; np.fill_diagonal(S, 0)
        for a in range(len(ids)):
            if ids[a] in gone:
                continue
            for b in np.where(S[a, a + 1:] >= BAND)[0] + a + 1:
                if ids[b] in gone:
                    continue
                if S[a, b] >= DUP:
                    gone.add(ids[b]); dropped[ids[b]] = ["duplicate of", ids[a], round(float(S[a, b]), 3)]
                else:
                    band.append([ids[a], ids[b], round(float(S[a, b]), 3)])
    keep = [r for r in keep if r["id"] not in gone]
    Path(out_path).write_text(json.dumps(keep, ensure_ascii=False))
    d = Path(rows_path).parent
    (d / "dropped.json").write_text(json.dumps(dropped, ensure_ascii=False, indent=0))
    (d / "dup-band.json").write_text(json.dumps(band))
    print(f"CLIP filter: {len(rows)} rows, {len(keep)} kept, {len(dropped)} dropped (text, blank paper, sketches, ornament, {len(gone)} duplicates); scores in {d / 'dropped.json'}")


# ---- main ----------------------------------------------------------------------------------------------------------------------------
def busy():
    out = subprocess.run(["pgrep", "-fl", r"rebuild_all\.sh|persian_extra\.py|fetch_missing_images\.py|run_persian_pipeline\.sh|r2_sync\.py"], capture_output=True, text=True).stdout
    return [l for l in out.splitlines() if "pgrep" not in l and str(os.getpid()) != l.split()[0]]


def main():
    if len(sys.argv) > 1 and sys.argv[1] == "--_clip":
        return clip_filter_main(*sys.argv[2:5])
    ap = argparse.ArgumentParser(description="Reusable Commons batch (design/batches/<name>.json)")
    ap.add_argument("name")
    ap.add_argument("--status", action="store_true", help="crawl (cached) and count; no downloads, nothing under data/ written")
    ap.add_argument("--max", type=int, default=0)
    ap.add_argument("--stage", action="store_true", help="write to data/corpus-staging/ instead of data/corpus/")
    ap.add_argument("--no-filter", action="store_true")
    ap.add_argument("--force-concurrent", action="store_true")
    ap.add_argument("--root", default="", help="only this root category (for a small test)")
    ap.add_argument("--depth", type=int, default=None, help="override every root's depth")
    a = ap.parse_args()
    cfg = load_config(a.name)
    name = cfg["name"]
    import corpus as C
    work = C.RAW / "batch" / name
    work.mkdir(parents=True, exist_ok=True)
    cpath = C.RAW / "batch" / "cats.json"
    cache = json.loads(cpath.read_text()) if cpath.exists() else {"cats": {}}
    if a.root and not a.root.startswith("Category:"):
        a.root = "Category:" + a.root
    files, seen = crawl(cfg, cache, cpath, only=a.root or None, depth_override=a.depth)
    cands, why = candidates(cfg, files)
    print(f"[{name}] crawl: {len(seen)} categories, {len(files)} files, {len(cands)} candidates after the picture/size/date/public-domain rules")
    for k, v in why.most_common():
        print(f"   dropped {v:6d}  {k}")
    idx = corpus_index(C)
    fresh, gone = drop_existing(cands, idx, cfg["slug"])
    for k, v in gone.most_common():
        print(f"   dropped {v:6d}  {k}")
    per_group, root_max = caps_for(cfg)
    total = a.max or cfg["caps"]["total"]
    capped = spread(pool(fresh), int(total * cfg["caps"]["overshoot"]), per_group, root_max)
    print(f"[{name}] {len(fresh)} not yet in the corpus; {len(capped)} after the per-manuscript / per-root / per-decade caps (target {total} + {int((cfg['caps']['overshoot'] - 1) * 100)}% for the filters)")
    by_root = Counter(c["root"] for c in fresh); by_cap = Counter(c["root"] for c in capped)
    for i, r in enumerate(cfg["roots"]):
        if a.root and r["cat"] != a.root:
            continue
        sure = f" [{r['sure']}]" if r.get("sure") else ""
        print(f"   {r['cat'][9:]:60.60s} {r.get('co', ''):12.12s} fresh {by_root[i]:5d}  capped {by_cap[i]:5d}{sure}")
    decades = Counter((c["y"] // 50 * 50) if isinstance(c["y"], int) else None for c in fresh)
    print("   by half century:", sorted(decades.items(), key=lambda kv: kv[0] or 0))
    status = dict(name=name, categories=len(seen), files=len(files), candidates=len(cands), fresh=len(fresh), capped=len(capped),
                  by_root={cfg["roots"][i]["cat"]: n for i, n in by_root.items()}, dropped=dict(why), existing=dict(gone), when=time.strftime("%Y-%m-%d %H:%M"))
    (work / "status.json").write_text(json.dumps(status, indent=1, ensure_ascii=False))
    if a.status:
        print(f"[{name}] --status: no images fetched, nothing written under data/ (summary in {work.relative_to(ROOT)}/status.json)")
        return
    if not a.force_concurrent and (b := busy()):
        sys.exit("refusing to run: another job is using the Wikimedia budget or rebuilding the corpus:\n  " + "\n  ".join(b) + "\n(--force-concurrent overrides)")

    bad = fetch_images(C, capped)
    pals = palettes(C, capped)
    rows = build_rows(C, capped, pals, cfg["slug"])
    cos = {r["co"] for r in rows}
    old = [r for r in C.load_corpus() if r.get("co") in cos]
    kept, dropped = drop_duplicates(C, rows, old)
    print(f"rows: {len(rows)} with a palette, {len(dropped)} duplicates of existing rows dropped, {len(kept)} kept before the caps")
    chosen = spread(kept, total, per_group, root_max)
    strip = lambda r: {k: v for k, v in r.items() if not k.startswith("_")}
    if cfg["filter"]["enabled"] and not a.no_filter:
        tmp_in, tmp_out = work / "rows-prefilter.json", work / "rows-filtered.json"
        tmp_in.write_text(json.dumps(chosen, ensure_ascii=False))
        if not CLIPENV.exists():
            sys.exit("needs research/_raw/clipenv for the CLIP filter (or pass --no-filter)")
        subprocess.run([str(CLIPENV), str(Path(__file__).resolve()), "--_clip", str(tmp_in), str(tmp_out), a.name if a.name.endswith(".json") else str(BATCHES / f"{a.name}.json")], check=True)
        chosen = json.loads(tmp_out.read_text())
    out = [strip(r) for r in sorted(chosen, key=lambda r: ((r["y"] if r["y"] is not None else 99999), r["id"]))]
    dest = ROOT / "data" / ("corpus-staging" if a.stage else "corpus") / f"zz-batch-{name}-1.json"
    dest.parent.mkdir(parents=True, exist_ok=True)
    line = lambda r: json.dumps(r, ensure_ascii=False, separators=(",", ":"))
    dest.write_text("[\n" + ",\n".join(line(r) for r in out) + "\n]\n", encoding="utf-8")
    print(f"wrote {dest.relative_to(ROOT)}: {len(out)} rows ({dest.stat().st_size / 1e3:.0f} KB); {len(bad)} image fetches failed")
    print("by country:", Counter(r["co"] for r in out).most_common(12))
    print("by artist:", Counter(r["a"] for r in out).most_common(12))
    print("\nNOT rebuilt. When no other fetch or rebuild is running, the one command is:\n    tools/rebuild_all.sh --atlas        (NO_R2=1 to hold the upload)\n"
          "then audit_beauty / audit_scene / audit_mood / look_gradient, and tools/hide_duplicates.py + hide_nonart.py if you want cross-source duplicate hiding.")


if __name__ == "__main__":
    main()
