#!/usr/bin/env python3
"""More paintings for named artists, generalized from sargent_extra.py (2026-10-20).

  python3 tools/artist_extra.py "Vincent van Gogh" Q5582 [--max 800]

One shard per artist: data/corpus/commons-<slug>-1.json. Same method as sargent_extra.py (below), which it replaces for new artists.


  python3 tools/sargent_extra.py            # meta -> images -> palettes -> data/corpus/commons-sargent-1.json
  python3 tools/sargent_extra.py --status

Why: the archive held 37 Sargents, nearly all dark oils (AIC, NGA, CMA, Commons), so "Sargent's palette" was really "Sargent's
portrait blacks". He also painted hundreds of bright watercolors and plein-air oils that live in museums outside the six
adapters (Brooklyn, Boston MFA, Harvard/Fogg, Tate, Gardner, Yale, Worcester, Clark, ...), plus works the Met holds outside
its "Paintings" class (the Met's Sargent watercolors are catalogued as Watercolors).

Source: Wikidata (CC0 metadata) -> Wikimedia Commons images. Every item with creator (P170) John Singer Sargent (Q155626) and
an image (P18); Sargent died in 1925, so every work is public domain. Sargent wrote many of these in the museums' own open
data: this is the one route that needs no API key (Brooklyn Museum, Harvard Art Museums and the Smithsonian require keys;
the Met's own Sargent watercolors are on Wikidata too, via the Met's Open Access program).
Kept: instance of painting / watercolor painting / gouache painting / mixed media / portrait (NOT drawing, print, sculpture:
charcoal sketches carry no color). Rows are written like tools/corpus.py's, src "commons", id "commons-<QID>", palette from
corpus.palette_of() on a 200 px copy (same k-means, same border trim), near-duplicates of each other or of the Sargents already
in the corpus dropped with corpus.py's own thresholds.
Range, not volume: corpus.py caps an artist at 50 paintings spread over the dates (ARTIST_CAP); Sargent gets an exception to
ARTIST_CAP_EXTRA (corpus.py) so the sample can show his range. This script keeps at most MAX_NEW new rows, chosen to spread over
(medium class x decade) so watercolors and light plein-air work are not crowded out by more dark portraits.
Cache: research/_raw/sargent/ (gitignored): wd.json, the SPARQL answer; images land in research/_raw/commons/img/ like every
other Commons painting, palettes in research/_raw/corpus-palettes.jsonl.
"""
import json, re, sys, urllib.parse
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
import corpus as C  # noqa: E402
from audit_artists import ALIAS  # noqa: E402

ARTIST, QID = sys.argv[1], sys.argv[2]
SLUG = re.sub(r"[^a-z]+", "", ARTIST.lower())
CACHE = C.RAW / SLUG
OUT = ROOT / "data" / ("corpus-staging" if "--stage" in sys.argv else "corpus") / f"zz-commons-{SLUG}-1.json"   # --stage: fetched and measured, but not in the app until moved into data/corpus/
OUT.parent.mkdir(parents=True, exist_ok=True)
LIFE = tuple(int(x) for x in sys.argv[sys.argv.index("--life") + 1].split("-")) if "--life" in sys.argv else None   # e.g. 1853-1890
MAX_NEW = int(sys.argv[sys.argv.index("--max") + 1]) if "--max" in sys.argv else 800   # range, not volume: one painter must not outweigh a decade or a country (corpus.py ARTIST_CAP_EXTRA = 300)
HD = {}   # museum row id -> a sharper Commons image of the same painting, merged into data/hd-images.json
HD_FILE = ROOT / "data" / "hd-images.json"
MUSEUM_SRC = {"Art Institute of Chicago": "aic", "Metropolitan Museum of Art": "met", "National Gallery of Art": "nga",
              "Cleveland Museum of Art": "cma", "Rijksmuseum": "rijks", "National Gallery of Denmark": "smk", "Statens Museum for Kunst": "smk"}
KEEP_INST = {"painting", "watercolor painting", "gouache painting", "mixed media", "portrait", "work of art", "artificial physical object",
             "fresco", "mural", "panel painting", "altarpiece", "tondo", "diptych", "triptych", "polyptych", "tempera painting", "oil painting"}   # Raphael, Michelangelo, early masters
WATER = re.compile(r"water ?colou?r|gouache|aquarelle", re.I)
OIL = re.compile(r"\boil\b|oil paint", re.I)

QUERY = """SELECT ?item ?itemLabel ?img ?inc ?collLabel ?instLabel ?matLabel ?h ?w ?cLabel ?aicid ?metid WHERE {
 ?item wdt:P170 wd:%s . ?item wdt:P18 ?img .
 OPTIONAL { ?item wdt:P571 ?inc } OPTIONAL { ?item wdt:P195 ?coll } OPTIONAL { ?item wdt:P31 ?inst }
 OPTIONAL { ?item wdt:P186 ?mat } OPTIONAL { ?item wdt:P2048 ?h } OPTIONAL { ?item wdt:P2049 ?w } OPTIONAL { ?item wdt:P495 ?c } OPTIONAL { ?item wdt:P4610 ?aicid } OPTIONAL { ?item wdt:P3634 ?metid }
 SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } }""" % QID


def sparql():
    CACHE.mkdir(parents=True, exist_ok=True)
    import hashlib
    p = CACHE / f"wd-{hashlib.sha1(QUERY.encode()).hexdigest()[:8]}.json"   # keyed to the query: a changed query re-fetches
    if p.exists():
        return json.loads(p.read_text())
    url = "https://query.wikidata.org/sparql?format=json&query=" + urllib.parse.quote(QUERY)
    C.SRC.setdefault("wdqs", dict(dir=CACHE, gap=1.0, workers=1))
    r = C.fetch("wdqs", url, headers={"Accept": "application/sparql-results+json"})
    rows = r["results"]["bindings"]
    p.write_text(json.dumps(rows))
    return rows


def items(rows):
    by = {}
    for b in rows:
        q = b["item"]["value"].rsplit("/", 1)[1]
        it = by.setdefault(q, dict(q=q, t=None, img=None, years=[], coll=set(), inst=set(), mat=set(), h=None, w=None, co=set(), ext=set()))
        v = lambda k: b[k]["value"] if k in b else None
        it["t"] = it["t"] or v("itemLabel")
        it["img"] = it["img"] or v("img")
        if v("inc"):
            m = re.match(r"^(-?\d{4})", v("inc"))
            if m:
                it["years"].append(int(m.group(1)))
        if v("aicid"):
            it["ext"].add("aic-" + v("aicid"))
        if v("metid"):
            it["ext"].add("met-" + v("metid"))
        for k, f in (("collLabel", "coll"), ("instLabel", "inst"), ("matLabel", "mat"), ("cLabel", "co")):
            if v(k):
                it[f].add(v(k))
        def num(x):   # Wikidata can hold an "unknown value" node here instead of a number
            try:
                return float(x) if x else None
            except ValueError:
                return None
        it["h"] = it["h"] or num(v("h"))
        it["w"] = it["w"] or num(v("w"))
    return by


# ---- Commons categories (2026-10-20): Wikidata lists only a fraction of many painters' works (73 Serovs; the Tretyakov and the
# Russian Museum publish no open data), while Wikimedia Commons files far more under "Category:Paintings by <name>". With
# --commons-cat, those files join the candidates as rows with id "commons-F<pageid>"; every filter, duplicate check, crop and
# palette below treats them like Wikidata items. Subcategories are followed (depth 2) only when their name says paintings or
# portraits and not drawings, sketches, prints, photos or letters.
CAT_SKIP = re.compile(r"drawing|sketch|print|etching|lithograph|photograph|letter|stamp|postcard|book|illustration|sculpture|study sheet|signature|exhibition|museum|in museums|details? of", re.I)
CAT_KEEP = re.compile(r"painting|portrait|landscape|still life|works by|by ", re.I)


def commons_category(cat, depth=2):
    import urllib.parse
    base = "https://commons.wikimedia.org/w/api.php?format=json&action=query&generator=categorymembers&gcmtype=file|subcat&gcmlimit=500" \
           "&prop=imageinfo&iiprop=url|extmetadata&iiextmetadatafilter=DateTimeOriginal|ObjectName&gcmtitle="
    C.SRC.setdefault("commonsapi", dict(dir=CACHE, gap=0.5, workers=1))
    seen_cats, files, todo = set(), {}, [(cat if cat.startswith("Category:") else "Category:" + cat, 0)]
    while todo:
        c, d = todo.pop(0)
        if c in seen_cats:
            continue
        seen_cats.add(c)
        cont = ""
        while True:
            r = C.fetch("commonsapi", base + urllib.parse.quote(c) + cont)
            for pg in (r.get("query", {}).get("pages", {}) or {}).values():
                t = pg.get("title", "")
                if pg.get("ns") == 14:
                    if d + 1 <= depth and CAT_KEEP.search(t) and not CAT_SKIP.search(t):
                        todo.append((t, d + 1))
                elif pg.get("ns") == 6 and re.search(r"\.(jpe?g|png|tiff?)$", t, re.I) and not CAT_SKIP.search(t):
                    files[pg["pageid"]] = pg
            if "continue" not in r:
                break
            cont = "&" + urllib.parse.urlencode(r["continue"])
    out = {}
    for pid, pg in files.items():
        fname = pg["title"].split(":", 1)[1]
        md = ((pg.get("imageinfo") or [{}])[0].get("extmetadata") or {})
        strip = lambda v: re.sub(r"<[^>]+>", "", str((v or {}).get("value", ""))).strip()
        title = strip(md.get("ObjectName")) or re.sub(r"\.(jpe?g|png|tiff?)$", "", fname, flags=re.I).replace("_", " ")
        years = [int(y) for y in re.findall(r"\b(1[2-9]\d\d)\b", strip(md.get("DateTimeOriginal")))]
        q = f"F{pid}"
        out[q] = dict(q=q, t=title[:160], img="http://commons.wikimedia.org/wiki/Special:FilePath/" + urllib.parse.quote(fname),
                      years=years[:1], coll=set(), inst={"painting"}, mat=set(), h=None, w=None, co=set(), ext=set())
    print(f"commons category {cat}: {len(seen_cats)} categories, {len(out)} image files", flush=True)
    return out


def medium_class(it):
    mats = " ".join(it["mat"]) + " " + " ".join(it["inst"])
    if WATER.search(mats):
        return "watercolor"
    if OIL.search(mats):
        return "oil"
    return "other"


def commons_file(img):
    return urllib.parse.unquote(img.rsplit("/", 1)[1])


def thumb(img, w=400):
    f = img.rsplit("/", 1)[1]
    return f"https://commons.wikimedia.org/wiki/Special:FilePath/{f}?width={w}"


def candidates(by):
    out = []
    for q, it in by.items():
        if not it["img"] or not re.search(r"\.(jpe?g|png|tiff?)$", it["img"], re.I):
            continue
        if not (it["inst"] & KEEP_INST):
            continue
        if it["inst"] and not (it["inst"] - {"drawing", "print", "sculpture"}):
            continue
        it["cls"] = medium_class(it)
        it["y"] = min(it["years"]) if it["years"] else None
        if it["y"] is not None and LIFE and not (LIFE[0] - 1 <= it["y"] <= LIFE[1] + 1):
            it["y"] = None   # a restoration or catalogue date, not when it was painted
        out.append(it)
    return out


def have_image(rid):
    p = C.img_path("commons", rid)
    return p.exists()


def fetch_images(cands):
    (C.SRC["commons"]["dir"] / "img").mkdir(parents=True, exist_ok=True)
    todo = [it for it in cands if not have_image(it["q"])]
    print(f"images: {len(cands)} candidates, {len(todo)} to fetch", flush=True)
    from concurrent.futures import ThreadPoolExecutor
    from PIL import Image
    import io, time
    bad = {}

    def one(it):
        try:
            im = Image.open(io.BytesIO(C.fetch("commons", thumb(it["img"]), binary=True))).convert("RGB")
            if im.width > C.IMG_W:
                im = im.resize((C.IMG_W, max(1, round(im.height * C.IMG_W / im.width))), Image.LANCZOS)
            im.save(C.img_path("commons", it["q"]), "JPEG", quality=92)
        except Exception as e:
            bad[it["q"]] = str(e)[:120]
    with ThreadPoolExecutor(C.SRC["commons"].get("workers", 4)) as ex:
        list(ex.map(one, todo))
    print(f"images done, {len(bad)} failed", flush=True)
    return bad


def palettes(cands):
    pals = C.load_palettes()
    new = []
    for it in cands:
        key = f"commons-{it['q']}"
        if key not in pals and have_image(it["q"]):
            new.append((key, str(C.img_path("commons", it["q"]))))
    print(f"palettes: {len(new)} to compute", flush=True)
    with C.PAL_CACHE.open("a") as f:
        for key, path in new:
            try:
                res = C.palette_of(path)
            except Exception as e:
                print("  palette failed", key, e)
                continue
            res["key"] = key
            f.write(json.dumps(res) + "\n")
    return C.load_palettes()


def build_rows(cands, pals):
    app = C.app_names()
    app_lab = C.rgb_to_lab(np.array([C.hex_to_rgb(h) for _, h in app]))
    rows = []
    for it in cands:
        key = f"commons-{it['q']}"
        if key in C.NONPAINTINGS:   # hand-reviewed non-paintings (data/corpus-nonpaintings.json), e.g. the Belleroche letter
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
        co = None
        for c in it["co"]:
            co = C.country_of(c) or co
        row = dict(id=key, src="commons", t=C.clean_title(it["t"]) if it["t"] and not re.match(r"^Q\d+$", it["t"]) else "Untitled",
                   a=ARTIST, y=it["y"], co=co or None, mv=None, img=thumb(it["img"], 400),
                   p=[[C.rgb_to_hex(rgbs[i]), shares[i], app[V[i]][0], C.family(Ls[i], Cs[i], Hs[i])] for i in range(len(shares))],
                   L=round(p["L"], 1), C=round(p["C"], 1), url=("https://commons.wikimedia.org/wiki/File:" + it["img"].rsplit("/", 1)[1]) if it["q"].startswith("F") else "https://www.wikidata.org/wiki/" + it["q"])
        row["_cls"], row["_coll"] = it["cls"], sorted(it["coll"])[:1]
        row["_ext"], row["_colls"] = sorted(it["ext"]), sorted(it["coll"])
        rows.append(row)
    return rows


def existing_sargents():
    out = []
    for r in C.load_corpus():
        if ALIAS.get(r.get("a"), r.get("a")) == ARTIST:
            out.append(r)
    return out


def drop_duplicates(new, old):
    """corpus.py's own tests: same image URL; same dhash with similar L/C and a similar middle of the picture."""
    import urllib.parse as _up
    norm = lambda u: _up.unquote(str(u)).split("?")[0].rsplit("/", 1)[-1].replace(" ", "_").lower()   # one file, however it was encoded
    seen_img = {norm(r["img"]) for r in old}
    keep, dropped = [], []
    old_by_id = {o["id"]: o for o in old}
    def hd_note(r, oid):   # the museum row is only our own small copy (AIC blocks hotlinking): use this Commons file for display
        o = old_by_id.get(oid)
        if o and str(o.get("img", "")).startswith("img/gallery/"):
            HD[oid] = r["img"]
    pool = list(old)
    hashes = {}
    def h_of(r):
        if r["id"] not in hashes:
            src, rid = r["id"].split("-", 1)
            try:
                hashes[r["id"]] = C.dhash(C.img_path(src, rid))
            except Exception:
                hashes[r["id"]] = 0
        return hashes[r["id"]]
    def tkey(t):
        return re.sub(r"[^a-z ]", "", (t or "").lower()).strip()
    old_ids = {o["id"] for o in old}
    old_by_title = defaultdict(list)
    for o in old:
        if len(tkey(o["t"])) > 6:
            old_by_title[tkey(o["t"])].append(o)
    for r in sorted(new, key=lambda r: r["id"]):
        if norm(r["img"]) in seen_img:
            dropped.append((r["id"], "same image")); continue
        # the same painting held by a museum we already read (AIC, NGA...) and listed again on Wikidata/Commons: the photographs
        # differ, so the image hash misses it, but artist + title + year (+-2) + overall color agree (2026-10-20 audit)
        # the same painting by museum record (2026-10-20: AIC's "The Bedroom" came back from Wikidata as "Bedroom in Arles"):
        # Wikidata carries the museum's own object id (P4610 AIC, P3634 Met) -> an exact match; or it names a collection we
        # already read, and that museum's row by the same painter has the same year (+-1) and overall color, whatever the title
        ext = next((e for e in r.get("_ext", []) if e in old_ids), None)
        if ext:
            hd_note(r, ext); dropped.append((r["id"], "same museum record as " + ext)); continue
        srcs = {MUSEUM_SRC[c] for c in r.get("_colls", []) if c in MUSEUM_SRC}
        held = next((o for o in old if o["id"].split("-", 1)[0] in srcs and r["y"] is not None and o["y"] is not None
                     and abs(r["y"] - o["y"]) <= 1 and abs(o["L"] - r["L"]) < 8 and abs(o["C"] - r["C"]) < 9), None)
        if held:
            hd_note(r, held["id"]); dropped.append((r["id"], "same painting held by " + held["id"])); continue
        twin = next((o for o in old_by_title.get(tkey(r["t"]), [])
                     if (r["y"] is None or o["y"] is None or abs(r["y"] - o["y"]) <= 2) and abs(o["L"] - r["L"]) < 8 and abs(o["C"] - r["C"]) < 8), None)
        if twin:
            hd_note(r, twin["id"]); dropped.append((r["id"], "same painting as " + twin["id"])); continue
        hr = h_of(r)
        dup = None
        if hr:
            for o in pool:
                ho = h_of(o)
                if not ho or abs(o["L"] - r["L"]) >= 3 or abs(o["C"] - r["C"]) >= 3:
                    continue
                bits = bin(hr ^ ho).count("1")
                ta, tb = C.title_words(o["t"]), C.title_words(r["t"])
                similar = bool(ta and tb) and len(ta & tb) / len(ta | tb) >= 0.6
                if (bits <= C.DUP_BITS_ANY or (similar and bits <= C.DUP_BITS_TITLE)) and C.center_de(o, r) < C.DUP_DE:
                    dup = o["id"]; break
        if dup:
            dropped.append((r["id"], "near-duplicate of " + dup)); continue
        keep.append(r); pool.append(r); seen_img.add(norm(r["img"]))
    return keep, dropped


def spread(rows, n):
    """At most n rows, spread over (medium class x decade): round-robin across the strata so no class or decade swamps another."""
    strata = defaultdict(list)
    for r in sorted(rows, key=lambda r: (r["y"] if r["y"] is not None else 9999, r["id"])):
        strata[(r["_cls"], (r["y"] // 10 * 10) if r["y"] is not None else None)].append(r)
    keys = sorted(strata, key=lambda k: (k[0], k[1] or 0))
    out = []
    while len(out) < n and any(strata.values()):
        for k in keys:
            if strata[k] and len(out) < n:
                out.append(strata[k].pop(0))
    return out


def main():
    if "--status" in sys.argv:
        by = items(sparql())
        if "--commons-cat" in sys.argv:
            by.update({k: v for k, v in commons_category(sys.argv[sys.argv.index("--commons-cat") + 1]).items() if k not in by})
        c = candidates(by)
        print(len(by), "items,", len(c), "painting-like;", Counter(x["cls"] for x in c))
        return
    if OUT.exists():
        OUT.unlink()      # this script owns that shard: rebuild it from scratch so a re-run is idempotent
    by = items(sparql())
    if "--commons-cat" in sys.argv:   # files Wikidata doesn't list (an image Wikidata already uses is dropped as "same image")
        by.update({k: v for k, v in commons_category(sys.argv[sys.argv.index("--commons-cat") + 1]).items() if k not in by})
    cands = candidates(by)
    print(f"{len(by)} Sargent items with an image; {len(cands)} painting-like; classes {dict(Counter(x['cls'] for x in cands))}", flush=True)
    existing_ids = {r["id"] for r in C.load_corpus()}
    cands = [c for c in cands if f"commons-{c['q']}" not in existing_ids]
    print(f"{len(cands)} not yet in the corpus", flush=True)
    fetch_images(cands)
    pals = palettes(cands)
    rows = build_rows(cands, pals)
    old = existing_sargents()
    keep, dropped = drop_duplicates(rows, old)
    print(f"rows: {len(rows)} with a color palette, {len(dropped)} duplicates dropped, {len(keep)} kept before the range cap", flush=True)
    chosen = spread(keep, MAX_NEW)
    for r in chosen:
        pass
    cls = Counter(r["_cls"] for r in chosen)
    print("chosen:", len(chosen), dict(cls), "| existing Sargents:", len(old))
    out = []
    for r in sorted(chosen, key=lambda r: ((r["y"] if r["y"] is not None else 99999), r["id"])):
        r = {k: v for k, v in r.items() if not k.startswith("_")}
        out.append(r)
    line = lambda r: json.dumps(r, ensure_ascii=False, separators=(",", ":"))
    OUT.write_text("[\n" + ",\n".join(line(r) for r in out) + "\n]\n", encoding="utf-8")
    print(f"wrote {OUT.relative_to(ROOT)}: {len(out)} rows, {OUT.stat().st_size / 1e3:.0f} KB")
    if HD:
        cur = json.loads(HD_FILE.read_text()) if HD_FILE.exists() else {}
        cur.update(HD)
        HD_FILE.write_text(json.dumps(dict(sorted(cur.items())), indent=0, ensure_ascii=False) + "\n")
        print(f"hd-images: {len(HD)} museum paintings get a sharper Commons image ({len(cur)} in all)")
    # Lightness story, before the analysis proper
    def mean_L(rs):
        return sum(r["L"] for r in rs) / max(len(rs), 1)
    print(f"mean L*: existing Sargents {mean_L(old):.1f}, new {mean_L(out):.1f}")


if __name__ == "__main__":
    main()
