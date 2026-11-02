#!/usr/bin/env python3
"""Persian art: a much larger archive (David, 2026-10-26: "right now it's around 100 paintings, that's not enough").

  python3 tools/persian_extra.py --status        # crawl (cached), print what the categories hold and what survives each filter
  python3 tools/persian_extra.py [--max 4500] [--stage]   # fetch images, measure palettes, write data/corpus/zz-commons-persianart-1.json

Then, as for every new art: tools/rebuild_all.sh --atlas (NO_R2=1 to hold the upload), and the audits that follow the gallery order
(tools/audit_beauty.py, audit_scene.py, audit_mood.py, look_gradient.py).

Source: Wikimedia Commons' own category tree for Persian painting (the only open source that is large and already holds the
Met, Freer, Walters, British Library, BnF, Chester Beatty, Aga Khan, David Collection and Louvre scans): the roots in ROOTS, followed
to depth 4. Wikidata lists about eleven paintings with origin Iran, so the SPARQL route of tools/artist_extra.py cannot do this.
What is kept (public domain only, by construction):
  - paintings, miniatures and illustrated manuscript folios dated 1925 or earlier (or undated, but only from a dynastic or
    century category: Ilkhanid, Timurid, Turkman, Safavid, Zand, Qajar), at least 500 px on the long side, jpg/png/tif;
  - no modern artists (Sepehri, Farrokhzad ...: not public domain), no photographs, bindings, doors, coins, sketches, lithographs,
    and nothing that is Mughal, Indian or Ottoman by category.
Artist: the painter's own category where there is one ("Persian miniatures by Reza Abbasi", "Sultan Muhammad"); otherwise the
period's painters ("Safavid Painter", "Qajar Painter" ...: the archive already has "Byzantine Painter" and "Chinese Painter").
Range, not volume: one manuscript (its category) gives at most 30 folios, spread over the book, and the whole set at most --max
rows spread over decades. Duplicates of the 150 Iranian rows already here (same file, same museum record, near-identical image) are dropped.
Cache: research/_raw/persian/ (gitignored); images land in research/_raw/commons/img/ like every Commons painting.
"""
import io, json, re, sys, urllib.parse
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
import corpus as C  # noqa: E402

CACHE = C.RAW / "persian"
OUT = ROOT / "data" / ("corpus-staging" if "--stage" in sys.argv else "corpus") / "zz-commons-persianart-1.json"
MAX_NEW = int(sys.argv[sys.argv.index("--max") + 1]) if "--max" in sys.argv else 4500
PER_GROUP = 30
DEPTH = 4
ROOTS = ["Category:Persian miniatures", "Category:Paintings from Iran", "Category:Qajar paintings", "Category:Safavid paintings",
         "Category:Timurid miniatures", "Category:Ilkhanid miniatures", "Category:Zand paintings", "Category:Turkman style"]
# categories never followed: modern painters (not public domain), non-paintings, and other traditions
SKIP_CAT = re.compile(r"""Sepehri|Farrokhzad|Hedayat|Jazani|Pezeshknia|Mahmood Olia|Shahbazian|Arjangi|Ali Mahmudi|Habib Mohammadi|Reza Shahabi|Mostaghni|
  Vaiziri|Yasemi|Gharabegean|Mehdi Taeb|Esmaeil Ashtiani|Shokat al-Moluk|Gholamhossein Saber|Hossein Behzad|Modabber|Hossein Qollar|Arshak|Art as a bridge|
  Iranian Masterpieces|Dura-Europos|Parthian|Door|doors|Bookbinding|Sketches|Lithograph|Abstract|Details of|Copies of|Trees by|Horoscope|Coffeehouse|
  Mughal|India|Rampur|Raza Library|Asiatic Society|Ottoman|Nude|Oil paintings from Iran|oil on canvas|oil paintings|location missing|Calligraphy|
  Aboutorab|Works of Bijan|Oxford Brookes""", re.I | re.X)
SKIP_FILE = re.compile(r"binding|reliure|cover|colophon|stamp|coin|ceramic|tile|carpet|photograph|photo\b|map of|diagram|signature|seal|rubbing|bowl|ewer|vase|textile|armor|sword", re.I)
PAINTER_CAT = re.compile(r"^(?:Persian miniatures|Paintings|Paintings from Iran|Google Art Project works|Portrait paintings) by (.+?)(?: in .*| by museum)?$")
PAINTERS = {"Abd al Hayy", "Abdul-Samad", "Abdullah (painter)", "Abd al-Aziz (painter)", "Abul Hasan Ghaffari", "Aqa Mirak", "Bahram (painter)", "Darvish Muhammad",
            "Dust Muhammad", "Mahmud Muzahhib", "Mir Musavvir", "Mir Sayyid Ali", "Mirza Ali", "Muhammad Jafar", "Muhammad Mahdi", "Muhammad Muqim",
            "Muhammad Murad Samarqandi", "Muhammad Zaman", "Muzaffar Ali", "Qasim Ali", "Sadiqi Beg", "Shaykhi", "Shaykhzada", "Sultan Muhammad", "Amir Khalil",
            "Kamal-ol-molk", "Jafar Chehrenegar", "Mihr 'Ali", "Mirza Baba", "Reza Abbasi", "Mu'in Musavvir", "Muhammad Qasim", "Habiballah Savaji"}
PERIODS = [(1256, "Seljuk-era Persian Painter"), (1353, "Ilkhanid Painter"), (1501, "Timurid Painter"), (1736, "Safavid Painter"), (1796, "Zand Painter"), (1926, "Qajar Painter")]
DYN = [("Qajar", "Qajar Painter"), ("Zand", "Zand Painter"), ("Safavid", "Safavid Painter"), ("Timurid", "Timurid Painter"), ("Turkman|Aq Qoyunlu|Qara Qoyunlu", "Turkman Painter"),
       ("Jalayer|Jalayir", "Jalayirid Painter"), ("Ilkhanid|Injuid|Muzaffarid", "Ilkhanid Painter")]
API = "https://commons.wikimedia.org/w/api.php?format=json&action=query&generator=categorymembers&gcmtype=file|subcat&gcmlimit=500" \
      "&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiextmetadatafilter=DateTimeOriginal|ObjectName|Artist&gcmtitle="


def crawl():
    """BFS over ROOTS to DEPTH: {file title: {pageid, w, h, mime, md, cats:[category it sits in]}} and the categories seen. Cached per category."""
    CACHE.mkdir(parents=True, exist_ok=True)
    C.SRC.setdefault("commonsapi", dict(dir=CACHE, gap=0.5, workers=1))
    store = CACHE / "crawl.json"
    done = json.loads(store.read_text()) if store.exists() else {"cats": {}}
    todo, seen = [(r, 0) for r in ROOTS], set()
    files = {}
    while todo:
        cat, d = todo.pop(0)
        if cat in seen:
            continue
        seen.add(cat)
        if cat not in done["cats"]:
            members, cont = [], ""
            while True:
                r = C.fetch("commonsapi", API + urllib.parse.quote(cat) + cont)
                for pg in (r.get("query", {}).get("pages", {}) or {}).values():
                    ii = (pg.get("imageinfo") or [{}])[0]
                    members.append(dict(t=pg.get("title", ""), ns=pg.get("ns"), id=pg.get("pageid"), w=ii.get("width"), h=ii.get("height"), mime=ii.get("mime"),
                                        md={k: re.sub(r"<[^>]+>", "", str(v.get("value", ""))).strip() for k, v in (ii.get("extmetadata") or {}).items()}))
                if "continue" not in r:
                    break
                cont = "&" + urllib.parse.urlencode(r["continue"])
            done["cats"][cat] = members
            if len(done["cats"]) % 25 == 0:
                store.write_text(json.dumps(done))
                print(f"  crawled {len(done['cats'])} categories", flush=True)
        for m in done["cats"][cat]:
            if m["ns"] == 14:
                if d + 1 <= DEPTH and not SKIP_CAT.search(m["t"]):
                    todo.append((m["t"], d + 1))
            elif m["ns"] == 6:
                f = files.setdefault(m["t"], dict(m, cats=[]))
                f["cats"].append(cat)
    store.write_text(json.dumps(done))
    return files, seen


def year_of(f):
    md, t = f["md"], f["t"]
    for src in (md.get("DateTimeOriginal", ""), t):
        ys = [int(y) for y in re.findall(r"\b(1[2-9]\d\d)\b", src)]
        ys = [y for y in ys if y <= 1925]
        if ys:
            return ys[0]
    for c in f["cats"]:
        m = re.match(r"^(\d\d)th-century", c.replace("Category:", ""))
        if m and 13 <= int(m.group(1)) <= 20:
            return (int(m.group(1)) - 1) * 100 + 50
    return None


def dynasty_hint(f):
    s = " ".join(f["cats"]) + " " + f["t"]
    return next((lab for rx, lab in DYN if re.search(rx, s, re.I)), None)


def artist_of(f, y):
    for c in f["cats"]:
        n = c.replace("Category:", "")
        m = PAINTER_CAT.match(n)
        if m and not re.search(r"artist|museum|century|collection|dynastic|genre|subject", m.group(1), re.I):
            return re.sub(r" \(painter\)$", "", m.group(1))
        if n in PAINTERS:
            return re.sub(r" \(painter\)$", "", n)
    if y is not None:
        lab = next((l for lim, l in PERIODS if y < lim), "Qajar Painter")
        return lab
    return dynasty_hint(f) or "Persian Painter"


def keep(f):
    t = f["t"]
    if not re.search(r"\.(jpe?g|png|tiff?)$", t, re.I) or SKIP_FILE.search(t):
        return False
    if f["mime"] not in ("image/jpeg", "image/png", "image/tiff") or max(f["w"] or 0, f["h"] or 0) < 500 or min(f["w"] or 0, f["h"] or 0) < 200:
        return False
    y = year_of(f)
    if y is None and not (dynasty_hint(f) or any(re.match(r"^Category:\d\dth-century", c) for c in f["cats"])):
        return False   # undated and no period: cannot say it is old enough to be public domain
    # a dated file that the BFS reached only through a modern painter's category never gets here (SKIP_CAT above)
    return True


def candidates():
    files, seen = crawl()
    print(f"crawl: {len(seen)} categories, {len(files)} files", flush=True)
    out = []
    for t, f in files.items():
        if not keep(f):
            continue
        y = year_of(f)
        title = f["md"].get("ObjectName") or re.sub(r"\.(jpe?g|png|tiff?)$", "", t.split(":", 1)[1], flags=re.I).replace("_", " ")
        out.append(dict(q=f"F{f['id']}", file=t.split(":", 1)[1], t=title[:160], y=y, a=artist_of(f, y), cats=f["cats"], group=f["cats"][-1] if f["cats"] else ""))
    return out


def thumb(file, w=400):
    return f"https://commons.wikimedia.org/wiki/Special:FilePath/{urllib.parse.quote(file)}?width={w}"


def have_image(q):
    return C.img_path("commons", q).exists()


def fetch_images(cands):
    (C.SRC["commons"]["dir"] / "img").mkdir(parents=True, exist_ok=True)
    C.SRC["commons"].update(gap=max(C.SRC["commons"].get("gap", 0), 1.0), workers=1)   # 2026-10-27: Commons answered 429 to the default pace
    todo = [c for c in cands if not have_image(c["q"])]
    print(f"images: {len(cands)} candidates, {len(todo)} to fetch", flush=True)
    from concurrent.futures import ThreadPoolExecutor
    from PIL import Image
    bad = {}

    def one(c):
        try:
            im = Image.open(io.BytesIO(C.fetch("commons", thumb(c["file"]), binary=True))).convert("RGB")
            if im.width > C.IMG_W:
                im = im.resize((C.IMG_W, max(1, round(im.height * C.IMG_W / im.width))), Image.LANCZOS)
            im.save(C.img_path("commons", c["q"]), "JPEG", quality=92)
        except Exception as e:
            bad[c["q"]] = str(e)[:120]
    with ThreadPoolExecutor(C.SRC["commons"].get("workers", 4)) as ex:
        list(ex.map(one, todo))
    print(f"images done, {len(bad)} failed", flush=True)


def palettes(cands):
    pals = C.load_palettes()
    new = [(f"commons-{c['q']}", str(C.img_path("commons", c["q"]))) for c in cands if f"commons-{c['q']}" not in pals and have_image(c["q"])]
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


def build_rows(cands, pals):
    app = C.app_names()
    app_lab = C.rgb_to_lab(np.array([C.hex_to_rgb(h) for _, h in app]))
    rows = []
    for c in cands:
        key = f"commons-{c['q']}"
        if key in C.NONPAINTINGS:
            continue
        p = pals.get(key)
        if not p or p["C"] < C.BW_C:
            continue
        rgbs = C.lab_to_rgb(np.array(p["lab"]))
        exact = C.rgb_to_lab(rgbs)
        V = C.de2000(exact, app_lab).argmin(1)
        Ls, Cs, Hs = C.lch(exact)
        shares = [round(s, 3) for s in p["share"]]
        shares[0] = round(shares[0] + 1 - sum(shares), 3)
        co = "Uzbekistan" if re.search(r"Bukhar|Samarqand", " ".join(c["cats"]) + c["file"], re.I) else "Iran"
        mv = "Qajar painting" if (c["y"] or 0) >= 1796 else "Persian miniature"
        rows.append(dict(id=key, src="commons", t=C.clean_title(c["t"]) or "Untitled", a=c["a"], y=c["y"], co=co, mv=mv, img=thumb(c["file"], 400),
                         p=[[C.rgb_to_hex(rgbs[i]), shares[i], app[V[i]][0], C.family(Ls[i], Cs[i], Hs[i])] for i in range(len(shares))],
                         L=round(p["L"], 1), C=round(p["C"], 1), url="https://commons.wikimedia.org/wiki/File:" + urllib.parse.quote(c["file"]),
                         _group=c["group"]))
    return rows


def drop_duplicates(new, old):
    norm = lambda u: urllib.parse.unquote(str(u)).split("?")[0].rsplit("/", 1)[-1].replace(" ", "_").lower()
    seen_img = {norm(r["img"]) for r in old}
    hashes = {}

    def h_of(r):
        if r["id"] not in hashes:
            src, rid = r["id"].split("-", 1)
            try:
                hashes[r["id"]] = C.dhash(C.img_path(src, rid))
            except Exception:
                hashes[r["id"]] = 0
        return hashes[r["id"]]
    pool, kept, dropped = list(old), [], []
    for r in sorted(new, key=lambda r: r["id"]):
        if norm(r["img"]) in seen_img:
            dropped.append((r["id"], "same image")); continue
        hr, dup = h_of(r), None
        if hr:
            for o in pool:
                ho = h_of(o)
                if not ho or abs(o["L"] - r["L"]) >= 3 or abs(o["C"] - r["C"]) >= 3:
                    continue
                if bin(hr ^ ho).count("1") <= C.DUP_BITS_ANY and C.center_de(o, r) < C.DUP_DE:
                    dup = o["id"]; break
        if dup:
            dropped.append((r["id"], "near-duplicate of " + dup)); continue
        kept.append(r); pool.append(r); seen_img.add(norm(r["img"]))
    return kept, dropped


def spread(rows, n):
    """At most PER_GROUP folios per manuscript, then at most n rows round-robin over decades."""
    by_group = defaultdict(list)
    for r in sorted(rows, key=lambda r: r["id"]):
        by_group[r["_group"]].append(r)
    limited = []
    for g, rs in by_group.items():
        if len(rs) > PER_GROUP:
            step = len(rs) / PER_GROUP
            rs = [rs[int(i * step)] for i in range(PER_GROUP)]
        limited += rs
    strata = defaultdict(list)
    for r in sorted(limited, key=lambda r: (r["y"] if r["y"] is not None else 9999, r["id"])):
        strata[(r["y"] // 10 * 10) if r["y"] is not None else None].append(r)
    keys = sorted(strata, key=lambda k: k or 0)
    out = []
    while len(out) < n and any(strata.values()):
        for k in keys:
            if strata[k] and len(out) < n:
                out.append(strata[k].pop(0))
    return out


def main():
    cands = candidates()
    yrs = Counter((c["y"] // 50 * 50) if c["y"] else None for c in cands)
    print(f"{len(cands)} candidates; by half century {sorted(yrs.items(), key=lambda kv: kv[0] or 0)}", flush=True)
    print("artists:", Counter(c["a"] for c in cands).most_common(12), flush=True)
    if "--status" in sys.argv:
        return
    existing_ids = {r["id"] for r in C.load_corpus()}
    cands = [c for c in cands if f"commons-{c['q']}" not in existing_ids]
    print(f"{len(cands)} not yet in the corpus", flush=True)
    # cap before fetching (the images are the slow part): per manuscript, then spread over decades, with room for the palette filter and duplicates
    pre = spread([dict(c, id=c["q"], _group=c["group"]) for c in cands], int(MAX_NEW * 1.3))
    keep_q = {c["q"] for c in pre}
    cands = [c for c in cands if c["q"] in keep_q]
    print(f"{len(cands)} after the per-manuscript and per-decade caps", flush=True)
    fetch_images(cands)
    pals = palettes(cands)
    rows = build_rows(cands, pals)
    old = [r for r in C.load_corpus() if r.get("co") in ("Iran", "Uzbekistan") or re.search(r"persian|iran", str(r.get("t", "")) + str(r.get("mv", "")), re.I)]
    kept, dropped = drop_duplicates(rows, old)
    print(f"rows: {len(rows)} with a palette, {len(dropped)} duplicates dropped, {len(kept)} kept before the caps", flush=True)
    chosen = spread(kept, MAX_NEW)
    out = [{k: v for k, v in r.items() if not k.startswith("_")} for r in sorted(chosen, key=lambda r: ((r["y"] if r["y"] is not None else 99999), r["id"]))]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    line = lambda r: json.dumps(r, ensure_ascii=False, separators=(",", ":"))
    OUT.write_text("[\n" + ",\n".join(line(r) for r in out) + "\n]\n", encoding="utf-8")
    print(f"wrote {OUT.relative_to(ROOT)}: {len(out)} rows ({OUT.stat().st_size / 1e3:.0f} KB); existing Iranian rows kept as they are: {len(old)}")
    print("by artist:", Counter(r["a"] for r in out).most_common(15))


if __name__ == "__main__":
    main()
