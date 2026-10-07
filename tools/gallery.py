#!/usr/bin/env python3
"""ColorHub painting gallery: every corpus painting, browsable and searchable by color. Read by js/gallery.js.

  python3 tools/gallery.py [--raw DIR] [--shard N]    # corpus + data/library.json -> data/gallery/

Safe to re-run: it rewrites data/gallery/ from scratch from whatever corpus exists.

Input
  data/corpus.json and/or data/corpus/*.json (tools/corpus.py and its museum expansions): one record per painting,
    {id: "<src>-<museum id>", src, t title, a artist|null, y year|null, co country|null, mv movement|null,
     img image URL, p [[hex, share, app name, family] x 6], L, C, optional url (museum record page)}.
    A record id that appears twice is kept once (first file wins).
  data/library.json (tools/library.py): ~2,700 named colors.
  Image size for the layout (h/w): research/_raw/<src>/meta.json for aic and cma (gitignored; --raw points elsewhere,
    e.g. the main checkout when running in a worktree), else a record's own `r` (h/w) or `w` and `h`. A painting
    without a known size gets a 4:5 box.

Per palette color it adds the most precise library name, picked with tools/library.py's painting rule (pick_lib):
the nearest non-crude name by CIEDE2000, passing over a novelty / brand / signage name when a plain one is within
2.0, never the same name twice in one palette, and never a pigment name newer than the work. Japanese traditional
names are allowed only on works from Japan.

Output: data/gallery/ (deleted and rewritten each run)
  index.json   header: {v, built, n, shard, rec (bytes per painting), app [app words], sources [{k, name, short,
               credit, home}], method}. Small; loaded with index.bin.
  index.bin    the search index, `rec` bytes per painting in corpus order (museum, then id), loaded in one go:
               u16 year + 20000 (0 = undated) · u8 museum (sources index) · u8 aspect (ln(h/w) mapped -1.6..1.6
               onto 0..255) · u8 mean L* x 2.5 · u8 mean C* x 3 · 6 x (R, G, B, share x 250).
               About 30 bytes a painting: 40,000 paintings is 1.2 MB.
  names.json   the library names used: [[name, hex, "src src", kanji?, meaning?]]. Loaded with the first painting page.
  d/NNN.json   detail shards of `shard` paintings (index order): [id, title, artist, country, movement, image URL,
               record URL, [library name index x 6], [app word index x 6]]. Loaded for the paintings on screen.

Museums: one row each in SOURCES (name, credit line, record-URL pattern). A record's own `url` wins over the
pattern. A museum without a row still works (its code is shown) and the script warns.
"""
import json, math, re, shutil, sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
import library as LIB  # noqa: E402  (labs, load_library, silly_names, pick_lib, JP_WORKS)
from paintings import PIGMENT_SINCE  # noqa: E402

OUT = ROOT / "data" / "gallery"
SHARD = 100     # paintings per detail shard: a screen of results spread over the whole corpus loads ~30 small files
REC = 30        # bytes per painting in index.bin
YEAR0 = 20000

# One row per museum. rec: record-page pattern; {num} = the id after "<src>-", {acc} = CMA accession number
# (from the image URL). credit: the image and data terms shown under each painting.
SOURCES = {
    "aic": dict(name="Art Institute of Chicago", short="Chicago", credit="public domain · CC0 data",
                home="https://www.artic.edu/collection", rec="https://www.artic.edu/artworks/{num}"),
    "cma": dict(name="Cleveland Museum of Art", short="Cleveland", credit="CC0 image · CC0 data",
                home="https://www.clevelandart.org/art/collection/search", rec="https://clevelandart.org/art/{acc}"),
    # Rows for the museums being added. Patterns from each museum's public site; check credit lines against the
    # corpus build's license notes when their records land (the Met and NGA pages refuse scripted requests).
    "met": dict(name="The Metropolitan Museum of Art", short="The Met", credit="public domain · CC0 data (Open Access)",
                home="https://www.metmuseum.org/art/collection", rec="https://www.metmuseum.org/art/collection/search/{num}"),
    "rijks": dict(name="Rijksmuseum", short="Rijksmuseum", credit="public domain · CC0 data",
                  home="https://www.rijksmuseum.nl/en/collection", rec="https://www.rijksmuseum.nl/en/collection/{num}"),
    "nga": dict(name="National Gallery of Art", short="NGA", credit="public domain · CC0 data (Open Access)",
                home="https://www.nga.gov/collection", rec="https://www.nga.gov/collection/art-object-page.{num}.html"),
    "smk": dict(name="SMK, National Gallery of Denmark", short="SMK", credit="public domain · CC0 data",
                home="https://open.smk.dk", rec="https://open.smk.dk/artwork/image/{num}"),
}
CMA_IMG = re.compile(r"^https://openaccess-cdn\.clevelandart\.org/([^/]+)/\1_web\.jpg$")


def load_corpus():
    files = ([ROOT / "data" / "corpus.json"] if (ROOT / "data" / "corpus.json").exists() else []) + \
        sorted((ROOT / "data" / "corpus").glob("*.json"))
    seen, rows = set(), []
    for f in files:
        data = json.loads(f.read_text(encoding="utf-8"))
        data = data.get("rows", data) if isinstance(data, dict) else data
        for x in data:
            if x["id"] in seen or not x.get("img") or len(x.get("p") or []) != 6:
                continue
            seen.add(x["id"])
            rows.append(x)
    order = {k: i for i, k in enumerate(SOURCES)}

    def natural(x):
        rest = x["id"].split("-", 1)[1] if "-" in x["id"] else x["id"]
        return (order.get(x["src"], len(order)), x["src"], [(0, int(t), "") if t.isdigit() else (1, 0, t)
                                                             for t in re.findall(r"\d+|\D+", rest)])
    rows.sort(key=natural)
    return rows, files


def sizes(raw):
    """{corpus id: h/w} from cached museum metadata, where present."""
    out = {}
    p = raw / "aic" / "meta.json"
    if p.exists():
        for x in json.loads(p.read_text())["rows"]:
            t = x.get("thumbnail") or {}
            if t.get("width") and t.get("height"):
                out[f"aic-{x['id']}"] = t["height"] / t["width"]
    p = raw / "cma" / "meta.json"
    if p.exists():
        for x in json.loads(p.read_text())["rows"]:
            w = (x.get("images") or {}).get("web") or {}
            if w.get("width") and w.get("height"):
                out[f"cma-{x['id']}"] = int(w["height"]) / int(w["width"])
    # every other museum: read the size of the small copy cached when the palettes were measured
    try:
        from PIL import Image
    except ImportError:
        return out
    for src in ("nga", "rijks", "smk", "met"):
        d = raw / src / "img"
        if not d.is_dir():
            continue
        for f in d.iterdir():
            if f.suffix.lower() not in (".jpg", ".jpeg", ".png"):
                continue
            try:
                with Image.open(f) as im:
                    w, h = im.size
                out.setdefault(f"{src}-{f.stem}", h / w)
            except Exception:
                pass
    return out


def record_url(x):
    if x.get("url") or x.get("rec"):
        return x.get("url") or x.get("rec")
    s = SOURCES.get(x["src"])
    if not s:
        return None
    num = x["id"].split("-", 1)[1] if "-" in x["id"] else x["id"]
    acc = ""
    if "{acc}" in s["rec"]:
        m = CMA_IMG.match(x["img"] or "")
        if not m:
            return None
        acc = m.group(1)
    return s["rec"].format(num=num, acc=acc)


def byte(v, lo=0, hi=255):
    return max(lo, min(hi, int(round(v))))


def main():
    args = sys.argv[1:]
    raw = Path(args[args.index("--raw") + 1]) if "--raw" in args else ROOT / "research" / "_raw"
    shard = int(args[args.index("--shard") + 1]) if "--shard" in args else SHARD
    corpus, files = load_corpus()
    if not corpus:
        raise SystemExit("no corpus found (data/corpus.json or data/corpus/*.json)")
    lib = [e for e in LIB.load_library() if not e.get("crude")]
    LL = LIB.labs([e["h"] for e in lib])
    silly = LIB.silly_names(lib)
    by_name = {e["n"]: e for e in lib}
    ratio = sizes(raw)

    srcs = list(SOURCES)
    for x in corpus:
        if x["src"] not in srcs:
            srcs.append(x["src"])
            print(f"warning: no SOURCES row for museum '{x['src']}'; add one (name, credit, record URL pattern)")
    used_srcs = [s for s in srcs if any(x["src"] == s for x in corpus)]
    src_idx = {s: i for i, s in enumerate(used_srcs)}

    app_idx, lib_idx, app, libs, details = {}, {}, [], [], []
    index = bytearray(REC * len(corpus))
    no_size = no_rec = 0
    for k, x in enumerate(corpus):
        if x.get("co") == "Japan":
            LIB.JP_WORKS.add(x["id"])
        year = max(x["y"], 0) if x.get("y") is not None else 1900  # pick_lib compares against pigment dates (0 = ancient)
        chosen, _, _ = LIB.pick_lib(x["id"], year, [{"h": p[0]} for p in x["p"]], lib, LL, silly, PIGMENT_SINCE)
        li = []
        for name, _ in chosen:
            if name not in lib_idx:
                e = by_name[name]
                lib_idx[name] = len(libs)
                row = [e["n"], e["h"], " ".join(e["src"])]
                if e.get("jp"):
                    row += [e["jp"].get("kanji", ""), e["jp"].get("meaning", "")]
                libs.append(row)
            li.append(lib_idx[name])
        wi = []
        for p in x["p"]:
            if p[2] not in app_idx:
                app_idx[p[2]] = len(app)
                app.append(p[2])
            wi.append(app_idx[p[2]])
        rec = record_url(x)
        no_rec += rec is None
        img = x["img"]
        # The Art Institute of Chicago's image server now refuses requests from other sites, so its
        # paintings are served from our own small copies (img/gallery/aic/<number>.jpg, 200px wide).
        # SMK's image server is too slow for a phone (often 15-40 s per image), so it gets the same treatment.
        for pre in ("aic", "smk"):
            if x["id"].startswith(pre + "-") and (ROOT / "img" / "gallery" / pre / (x["id"][len(pre) + 1:] + ".jpg")).exists():
                img = f"img/gallery/{pre}/" + x["id"][len(pre) + 1:] + ".jpg"
        details.append([x["id"], x.get("t") or "Untitled", x.get("a"), x.get("co"), x.get("mv"), img, rec, li, wi])

        r = ratio.get(x["id"]) or x.get("r") or (x["h"] / x["w"] if x.get("w") and x.get("h") else None)
        if not r:
            no_size += 1
            r = 1.25
        o = k * REC
        y = x.get("y")
        index[o:o + 2] = (0 if y is None else byte(y + YEAR0, 1, 65535)).to_bytes(2, "little")
        index[o + 2] = src_idx[x["src"]]
        index[o + 3] = byte((math.log(r) + 1.6) / 3.2 * 255)
        index[o + 4] = byte(x["L"] * 2.5)
        index[o + 5] = byte(x["C"] * 3)
        for j, p in enumerate(x["p"]):
            h = p[0].lstrip("#")
            index[o + 6 + j * 4:o + 9 + j * 4] = bytes(int(h[i:i + 2], 16) for i in (0, 2, 4))
            index[o + 9 + j * 4] = byte(p[1] * 250)
        if k % 2000 == 1999:
            print(f"  named {k + 1} of {len(corpus)}", flush=True)

    if OUT.exists():
        shutil.rmtree(OUT)
    (OUT / "d").mkdir(parents=True)
    head = dict(v=2, built=date.today().isoformat(), n=len(corpus), shard=shard, rec=REC, year0=YEAR0, app=app,
                sources=[dict(k=s, **{f: (SOURCES.get(s) or {}).get(f, s if f in ("name", "short") else "")
                                      for f in ("name", "short", "credit", "home")}) for s in used_srcs],
                method="Six colors per painting by k-means in CIELAB on the museum's small image (tools/corpus.py); "
                       "each share is that color's area. Names: nearest library name by CIEDE2000 (tools/gallery.py).")
    (OUT / "index.json").write_text(json.dumps(head, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    (OUT / "index.bin").write_bytes(bytes(index))
    names = json.dumps(libs, ensure_ascii=False, separators=(",", ":")).replace('],["', '],\n["')
    (OUT / "names.json").write_text(names, encoding="utf-8")
    n_sh = 0
    for s in range(0, len(details), shard):
        text = json.dumps(details[s:s + shard], ensure_ascii=False, separators=(",", ":")).replace('],["', '],\n["')
        (OUT / "d" / f"{s // shard:03d}.json").write_text(text, encoding="utf-8")
        n_sh += 1
    tot = sum(f.stat().st_size for f in OUT.rglob("*") if f.is_file())
    print(f"data/gallery/: {len(corpus)} paintings from {', '.join(f.name for f in files)}; "
          f"index.bin {len(index) / 1e3:.0f} KB, index.json {(OUT / 'index.json').stat().st_size / 1e3:.1f} KB, "
          f"names.json {(OUT / 'names.json').stat().st_size / 1e3:.0f} KB ({len(libs)} names), "
          f"{n_sh} detail shards of {shard}; {tot / 1e6:.2f} MB in all. "
          f"{no_size} without a known image size, {no_rec} without a record URL.")


if __name__ == "__main__":
    main()
