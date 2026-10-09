#!/usr/bin/env python3
"""More John Singer Sargent for the painting archive (L15, 2026-10-08).

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

QID = "Q155626"
CACHE = C.RAW / "sargent"
OUT = ROOT / "data" / "corpus" / "commons-sargent-1.json"
MAX_NEW = 250   # range, not volume: one painter must not outweigh a decade or a country (corpus.py ARTIST_CAP_EXTRA = 300)
KEEP_INST = {"painting", "watercolor painting", "gouache painting", "mixed media", "portrait", "work of art", "artificial physical object"}
WATER = re.compile(r"water ?colou?r|gouache|aquarelle", re.I)
OIL = re.compile(r"\boil\b|oil paint", re.I)

QUERY = """SELECT ?item ?itemLabel ?img ?inc ?collLabel ?instLabel ?matLabel ?h ?w ?cLabel WHERE {
 ?item wdt:P170 wd:%s . ?item wdt:P18 ?img .
 OPTIONAL { ?item wdt:P571 ?inc } OPTIONAL { ?item wdt:P195 ?coll } OPTIONAL { ?item wdt:P31 ?inst }
 OPTIONAL { ?item wdt:P186 ?mat } OPTIONAL { ?item wdt:P2048 ?h } OPTIONAL { ?item wdt:P2049 ?w } OPTIONAL { ?item wdt:P495 ?c }
 SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } }""" % QID


def sparql():
    CACHE.mkdir(parents=True, exist_ok=True)
    p = CACHE / "wd.json"
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
        it = by.setdefault(q, dict(q=q, t=None, img=None, years=[], coll=set(), inst=set(), mat=set(), h=None, w=None, co=set()))
        v = lambda k: b[k]["value"] if k in b else None
        it["t"] = it["t"] or v("itemLabel")
        it["img"] = it["img"] or v("img")
        if v("inc"):
            m = re.match(r"^(-?\d{4})", v("inc"))
            if m:
                it["years"].append(int(m.group(1)))
        for k, f in (("collLabel", "coll"), ("instLabel", "inst"), ("matLabel", "mat"), ("cLabel", "co")):
            if v(k):
                it[f].add(v(k))
        it["h"] = it["h"] or (float(v("h")) if v("h") else None)
        it["w"] = it["w"] or (float(v("w")) if v("w") else None)
    return by


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
                   a="John Singer Sargent", y=it["y"], co=co or "United States", mv=None, img=thumb(it["img"], 400),
                   p=[[C.rgb_to_hex(rgbs[i]), shares[i], app[V[i]][0], C.family(Ls[i], Cs[i], Hs[i])] for i in range(len(shares))],
                   L=round(p["L"], 1), C=round(p["C"], 1), url="https://www.wikidata.org/wiki/" + it["q"])
        row["_cls"], row["_coll"] = it["cls"], sorted(it["coll"])[:1]
        rows.append(row)
    return rows


def existing_sargents():
    out = []
    for r in C.load_corpus():
        if (r.get("a") or "") == "John Singer Sargent":
            out.append(r)
    return out


def drop_duplicates(new, old):
    """corpus.py's own tests: same image URL; same dhash with similar L/C and a similar middle of the picture."""
    seen_img = {r["img"] for r in old}
    keep, dropped = [], []
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
    for r in sorted(new, key=lambda r: r["id"]):
        if r["img"] in seen_img:
            dropped.append((r["id"], "same image")); continue
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
        keep.append(r); pool.append(r); seen_img.add(r["img"])
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
        by = items(sparql()); c = candidates(by)
        print(len(by), "items,", len(c), "painting-like;", Counter(x["cls"] for x in c))
        return
    if OUT.exists():
        OUT.unlink()      # this script owns that shard: rebuild it from scratch so a re-run is idempotent
    by = items(sparql())
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
    # Lightness story, before the analysis proper
    def mean_L(rs):
        return sum(r["L"] for r in rs) / max(len(rs), 1)
    print(f"mean L*: existing Sargents {mean_L(old):.1f}, new {mean_L(out):.1f}")


if __name__ == "__main__":
    main()
