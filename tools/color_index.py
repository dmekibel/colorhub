#!/usr/bin/env python3
"""ColorHub's finer color index (lane L26): where a niche color lives in paintings, down to the pixel.

  python3 tools/color_index.py [--raw DIR] [--out data/colorindex] [--limit N] [--workers 8] [--no-affinity]
  python3 tools/color_index.py --design <dir with L19's data/design/> [--out data/design/colorindex]
  python3 tools/color_index.py --items items.json --out data/design --label Design --item-name "design piece"

The 24-color pools in data/gallery/ miss niche colors: a color that is a thousandth of a canvas never wins a
k-means cluster. This index keeps (nearly) every pixel instead: a quantized CIELAB histogram per painting, stored
INVERTED (color cell -> the paintings that contain it), so a query for any color reads only the shards near it.

Pixels: the museum thumbnails cached by tools/corpus.py (research/_raw/<museum>/img/<id>.jpg, 200 px wide, all
six museums). They are photographs of varnished paintings, so a "color in a painting" is a color in the photograph.
A painting with no cached image falls back to its 24-color pool, then to the six colors in data/gallery/index.bin,
and is listed under `coarse` in index.json so the app can say "approximate".

Format (everything little-endian; one directory per corpus, so a second corpus plugs in with the same code)
  index.json   {v, source, label, item, n, Q, off, cov0, covMax, floor, leaves:[{f, lo:[L,a,b], hi:[L,a,b], np}],
                coarse:[item numbers], meta:"meta.bin"}.  Small; loaded first.
  s/NNN.bin    one leaf: a box of color cells holding about LEAF postings (a kd split balanced by postings, so the
               crowded browns and greys are split finely and the empty violets are not).
                 u16 ncells · then per cell: u8 L, u8 a, u8 b (cell indices), varint npostings ·
                 then per cell: npostings varint id deltas (items sorted), then npostings coverage bytes.
               cell index c covers Lab [ (c - off) * Q, (c - off + 1) * Q ) on a and b, [c * Q, ...) on L (off only
               for a and b). Its center stands for it in a ΔE00 test.
               coverage byte b (1..255): share of the picture = cov0 * (covMax / cov0) ** ((b - 1) / 254).
  meta.bin     6 bytes per item: u16 year + 20000 (0 = undated) · u16 artist id (0 = unknown) · u8 movement · u8 country.
  meta.json    {artists:[...], movements:[...], countries:[...]} (index 0 = unknown / none).
  affinity-<letter>.json  (paintings only) per named color: how many items hold it, its closest companions and the
                colors it avoids (lift and n, at the standard definition below). Keyed by the letter its slug starts with.

Query rule (js/colorindex.js, ciCoverage): an item "has" a color at (tol, minCover) when the sum of the shares of
its cells that are within tol (CIEDE2000, "% different") of the color, or that contain the color itself, is at
least minCover. tol = 0 therefore means "the color's own cell" (about 1.5% across; the finest this index resolves).
Standard definition for the affinity table and the per-color facts: tol 4, minCover 1% -- the same as the Color
Graph's "in a painting" (data/graph/index.json: a pool color within dE 4 covering at least 1%), so the two stay
comparable; the finer index here supersedes the pool for search and gives the larger n, because it also sees the
small areas a 24-color pool merges away. tools/color_index.py prints the two side by side.

Palette-only corpora (--items): [{id, y?, a?, mv?, co?, colors: [[hex, share], ...]}]; every item is coarse.
"""
import json, math, re, sys, time
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))

Q = 3              # cell size in Lab units (about 3% different on the ΔE00 scale at middling chroma)
OFF = 48           # a and b cell indices are stored +OFF (sRGB Lab a,b run about -86..98 and -108..95)
COV0, COVMAX = 0.0005, 1.0
FLOOR = COV0       # cells under 0.05% of the picture (about 24 px of a 200 px photo) are dropped: JPEG noise
LEAF = 30000       # postings per shard (about 75 KB)
STD_TOL, STD_COVER = 4.0, 0.01
MIN_PAIR_N = 5


def cov_to_byte(c):
    c = np.clip(c, COV0, COVMAX)
    return np.clip(np.rint(1 + 254 * np.log(c / COV0) / math.log(COVMAX / COV0)), 1, 255).astype(np.uint8)


def byte_to_cov(b):
    return COV0 * (COVMAX / COV0) ** ((b.astype(np.float64) - 1) / 254)


def cell_key(lab):
    iL = np.clip(np.floor(lab[:, 0] / Q), 0, 34).astype(np.int64)
    ia = np.clip(np.floor(lab[:, 1] / Q) + OFF, 0, 127).astype(np.int64)
    ib = np.clip(np.floor(lab[:, 2] / Q) + OFF, 0, 127).astype(np.int64)
    return (iL << 14) | (ia << 7) | ib


def key_parts(k):
    return (k >> 14) & 127, (k >> 7) & 127, k & 127


def key_center(k):
    iL, ia, ib = key_parts(np.asarray(k))
    return np.stack([iL * Q + Q / 2, (ia - OFF) * Q + Q / 2, (ib - OFF) * Q + Q / 2], -1)


def varint(n):
    out = bytearray()
    while n >= 128:
        out.append(n & 127 | 128)
        n >>= 7
    out.append(n)
    return bytes(out)


# ---------- reading one picture ----------
def image_cells(path):
    from PIL import Image
    import library as LIB
    im = np.asarray(Image.open(path).convert("RGB"))
    n = im.shape[0] * im.shape[1]
    keys = cell_key(LIB.rgb_to_lab(im.reshape(-1, 3)))
    u, c = np.unique(keys, return_counts=True)
    return u, c / n, n


def colors_cells(colors):
    """[(hex, share)] -> cells, for a coarse item."""
    import library as LIB
    rgb = np.array([[int(h.lstrip("#")[i:i + 2], 16) for i in (0, 2, 4)] for h, _ in colors])
    sh = np.array([s for _, s in colors], dtype=np.float64)
    sh = sh / (sh.sum() or 1)
    keys = cell_key(LIB.rgb_to_lab(rgb))
    out = {}
    for k, s in zip(keys, sh):
        out[int(k)] = out.get(int(k), 0) + s
    return np.array(list(out.keys()), dtype=np.int64), np.array(list(out.values())), 0


def _job(a):
    i, path = a
    try:
        u, c, n = image_cells(path)
        m = c >= FLOOR
        return i, u[m], c[m], None
    except Exception as e:
        return i, None, None, str(e)


def unpack_pool(pl):
    import base64
    b = base64.b64decode(pl)
    return [("#%02X%02X%02X" % (b[j], b[j + 1], b[j + 2]), b[j + 3] / 250) for j in range(0, len(b) - 3, 4)]


# ---------- the inverted index ----------
def kd_leaves(cell_ids, weights, cells_lab_idx):
    """Split cells (their indices into the unique-cell table) into boxes of about LEAF postings."""
    leaves = []
    stack = [np.arange(len(cell_ids))]
    while stack:
        part = stack.pop()
        w = weights[part]
        if w.sum() <= LEAF or len(part) == 1:
            leaves.append(part)
            continue
        co = cells_lab_idx[part]
        ext = co.max(0) - co.min(0)
        ax = int(np.argmax(ext))
        if ext[ax] == 0:
            ax = int(np.argmax(ext + 1e-9 * np.arange(3)))
        order = part[np.argsort(co[:, ax], kind="stable")]
        cw = np.cumsum(weights[order])
        cut = int(np.searchsorted(cw, cw[-1] / 2))
        cut = min(max(cut, 0), len(order) - 2)
        # never split two cells that share this axis value apart from their equals unless forced
        stack.append(order[:cut + 1])
        stack.append(order[cut + 1:])
    return leaves


def write_index(out, label, item, n, keys_by_item, cov_by_item, coarse, meta_rows, meta, source):
    """keys_by_item[i]: cell keys; cov_by_item[i]: coverage (floats); writes shards + index.json + meta."""
    out.mkdir(parents=True, exist_ok=True)
    for d in (out / "s",):
        if d.exists():
            for f in d.glob("*.bin"):
                f.unlink()
        d.mkdir(exist_ok=True)
    lens = np.array([len(k) for k in keys_by_item])
    allk = np.concatenate(keys_by_item) if len(keys_by_item) else np.zeros(0, np.int64)
    allc = np.concatenate(cov_by_item) if len(cov_by_item) else np.zeros(0)
    allp = np.repeat(np.arange(n), lens)
    ucell, inv = np.unique(allk, return_inverse=True)
    order = np.lexsort((allp, inv))
    inv, allp, allb = inv[order], allp[order], cov_to_byte(allc[order])
    starts = np.searchsorted(inv, np.arange(len(ucell) + 1))
    cw = np.diff(starts)
    parts = key_parts(ucell)
    cl = np.stack(parts, -1).astype(np.int64)
    leaves = kd_leaves(np.arange(len(ucell)), cw, cl)
    leaves.sort(key=lambda p: (cl[p, 0].min(), cl[p, 1].min(), cl[p, 2].min()))
    head_leaves, total = [], 0
    for li, part in enumerate(leaves):
        part = part[np.lexsort((cl[part, 2], cl[part, 1], cl[part, 0]))]
        buf = bytearray(len(part).to_bytes(2, "little"))
        for c in part:
            buf += bytes(int(v) for v in cl[c]) + varint(int(cw[c]))
        for c in part:
            ids = allp[starts[c]:starts[c + 1]]
            prev = 0
            for v in ids.tolist():
                buf += varint(v - prev)
                prev = v
            buf += allb[starts[c]:starts[c + 1]].tobytes()
        name = f"s/{li:03d}.bin"
        (out / name).write_bytes(bytes(buf))
        total += len(buf)
        head_leaves.append({"f": name, "lo": [int(v) for v in cl[part].min(0)], "hi": [int(v) for v in cl[part].max(0)],
                            "np": int(cw[part].sum())})
    # meta
    artists, movements, countries = meta["artists"], meta["movements"], meta["countries"]
    mb = bytearray()
    for y, a, mv, co in meta_rows:
        mb += (0 if y is None else max(1, min(65535, int(y) + 20000))).to_bytes(2, "little")
        mb += int(a).to_bytes(2, "little") + bytes([mv, co])
    (out / "meta.bin").write_bytes(bytes(mb))
    (out / "meta.json").write_text(json.dumps({"artists": artists, "movements": movements, "countries": countries},
                                              ensure_ascii=False, separators=(",", ":")))
    head = {"v": 1, "source": source, "label": label, "item": item, "n": n, "Q": Q, "off": OFF, "cov0": COV0, "covMax": COVMAX,
            "floor": FLOOR, "std": [STD_TOL, STD_COVER], "leaves": head_leaves, "coarse": coarse, "meta": "meta.bin",
            "postings": int(len(allk)), "cells": int(len(ucell)), "built": time.strftime("%Y-%m-%d")}
    (out / "index.json").write_text(json.dumps(head, separators=(",", ":")))
    return head, total, (ucell, starts, allp, allb)


# ---------- the paintings corpus ----------
def build_paintings(args):
    import gallery as G
    raw = Path(args["raw"])
    rows, _ = G.load_corpus()
    gal = json.loads((ROOT / "data" / "gallery" / "index.json").read_text())
    if len(rows) != gal["n"]:
        raise SystemExit(f"corpus has {len(rows)} paintings but data/gallery/ has {gal['n']}; rebuild the gallery first")
    if args.get("limit"):
        rows = rows[:args["limit"]]
    n = len(rows)
    pools = {}
    pp = raw / "corpus-pool.jsonl"
    if pp.exists():
        for line in pp.read_text().splitlines():
            if line.strip():
                r = json.loads(line)
                pools[r["key"]] = r["pl"]
    jobs, fallback = [], []
    for i, x in enumerate(rows):
        p = G.img_cache_path(raw, x["src"], x["id"])
        (jobs if p.exists() else fallback).append((i, str(p)) if p.exists() else i)
    print(f"{n} paintings: {len(jobs)} with a cached photo, {len(fallback)} coarse", flush=True)
    keys, covs = [None] * n, [None] * n
    from multiprocessing import Pool
    t0 = time.time()
    bad = 0
    with Pool(args["workers"]) as pool:
        for c, (i, k, cv, err) in enumerate(pool.imap_unordered(_job, jobs, chunksize=16)):
            if err:
                bad += 1
                fallback.append(i)
                print("  unreadable", rows[i]["id"], err, flush=True)
                continue
            keys[i], covs[i] = k, cv
            if c % 3000 == 2999:
                print(f"  read {c + 1}/{len(jobs)}  {time.time() - t0:.0f}s", flush=True)
    coarse = sorted(set(fallback))
    for i in coarse:
        x = rows[i]
        cols = unpack_pool(pools[x["id"]]) if pools.get(x["id"]) else [(p[0], p[1]) for p in x["p"]]
        k, cv, _ = colors_cells(cols)
        keys[i], covs[i] = k, np.maximum(cv, COV0)
    # meta
    art, mvs, cos = {"": 0}, {"": 0}, {"": 0}
    arts, mvl, col = [""], [""], [""]
    meta_rows = []
    for x in rows:
        def idx(d, lst, v):
            v = v or ""
            if v not in d:
                d[v] = len(lst)
                lst.append(v)
            return d[v]
        meta_rows.append((x.get("y"), idx(art, arts, x.get("a")), idx(mvs, mvl, x.get("mv")), idx(cos, col, x.get("co"))))
    head, total, built = write_index(Path(args["out"]), "Paintings", "painting", n, keys, covs, coarse, meta_rows,
                                     {"artists": arts, "movements": mvl, "countries": col}, "paintings")
    print(f"index: {head['postings']:,} postings, {head['cells']:,} cells, {len(head['leaves'])} shards, {total / 1e6:.1f} MB, "
          f"{len(coarse)} coarse, {time.time() - t0:.0f}s", flush=True)
    return rows, head, built, meta_rows, arts


def read_index(out):
    """Decode a written index back into (head, (ucell, starts, allp, allb)) -- so affinity can be rebuilt without re-reading pixels."""
    out = Path(out)
    head = json.loads((out / "index.json").read_text())
    cells, ids, covs = [], [], []
    for lf in head["leaves"]:
        u = (out / lf["f"]).read_bytes()
        nc = u[0] | u[1] << 8
        p = 2
        keys, cnt = [], []
        for _ in range(nc):
            keys.append((u[p] << 14) | (u[p + 1] << 7) | u[p + 2])
            p += 3
            v = sh = 0
            while True:
                x = u[p]; p += 1
                v |= (x & 127) << sh; sh += 7
                if not x & 128:
                    break
            cnt.append(v)
        for c in range(nc):
            idl, acc = [], 0
            for _ in range(cnt[c]):
                v = sh = 0
                while True:
                    x = u[p]; p += 1
                    v |= (x & 127) << sh; sh += 7
                    if not x & 128:
                        break
                acc += v
                idl.append(acc)
            ids.append(np.array(idl, dtype=np.int64))
            covs.append(np.frombuffer(u[p:p + cnt[c]], dtype=np.uint8))
            p += cnt[c]
            cells.append(np.full(cnt[c], keys[c], dtype=np.int64))
    allk, allp, allb = np.concatenate(cells), np.concatenate(ids), np.concatenate(covs)
    ucell, inv = np.unique(allk, return_inverse=True)
    order = np.argsort(inv, kind="stable")
    inv, allp, allb = inv[order], allp[order], allb[order]
    starts = np.searchsorted(inv, np.arange(len(ucell) + 1))
    return head, (ucell, starts, allp, allb)


# ---------- affinity and facts (paintings) ----------
def routeSlug(s):
    import unicodedata
    s = unicodedata.normalize("NFKD", s)
    s = "".join(ch for ch in s if not unicodedata.combining(ch)).lower()
    return re.sub(r"^-+|-+$", "", re.sub(r"[^a-z0-9]+", "-", s))


def affinity(args, rows, head, built, meta_rows, arts):
    from scipy import sparse
    import library as LIB
    ucell, starts, allp, allb = built
    n = head["n"]
    names = json.loads((ROOT / "data" / "core-names.json").read_text())
    V = len(names)
    vlab = LIB.labs([e["h"] for e in names])
    ccen = key_center(ucell)
    K = len(ucell)
    cov = byte_to_cov(allb)
    inv = np.repeat(np.arange(K), np.diff(starts))
    Cp = sparse.csr_matrix((cov, (allp, inv)), shape=(n, K))            # item x cell
    own = cell_key(vlab)                                                 # each name's own cell
    pos = np.minimum(np.searchsorted(ucell, own), K - 1)
    valid = ucell[pos] == own
    t0 = time.time()
    TOLS = {"exact": 0.0, "3": 3.0, "4": 4.0, "10": 10.0}
    M = {k: [] for k in TOLS}
    for v0 in range(0, V, 16):
        d = LIB.de2000(vlab[v0:v0 + 16], ccen)                          # (16, K)
        for k, t in TOLS.items():
            m = d <= t
            for j in range(m.shape[0]):
                if valid[v0 + j]:
                    m[j, pos[v0 + j]] = True      # a color always counts its own cell
            M[k].append(sparse.csr_matrix(m.T.astype(np.float32)))
    M = {k: sparse.hstack(v).tocsr() for k, v in M.items()}
    print(f"membership done {time.time() - t0:.0f}s", flush=True)
    covm = {k: (Cp @ M[k]).tocsc() for k in M}                           # item x name coverage
    def count(k, c):
        return np.asarray((covm[k] >= c).sum(0)).ravel()
    n_std = count("4", STD_COVER)
    P = (covm["4"] >= STD_COVER).astype(np.float32).tocsr()
    pair = (P.T @ P).toarray()
    de_names = np.zeros((V, V), dtype=np.float32)
    for v0 in range(0, V, 64):
        de_names[v0:v0 + 64] = LIB.de2000(vlab[v0:v0 + 64], vlab)
    facts = {"exact_any": count("exact", COV0), "3_5": count("3", .05), "4_1": n_std, "10_1": count("10", .01),
             "4_5": count("4", .05)}
    shards = {}
    nn = n_std.astype(np.float64)
    exp = np.outer(nn, nn) / n
    with np.errstate(divide="ignore", invalid="ignore"):
        lift = np.where(exp > 0, pair / exp, 0)
        z = np.where(exp > 0, (pair - exp) / np.sqrt(exp), 0)
    far = de_names >= 2 * STD_TOL
    np.fill_diagonal(far, False)
    for i, e in enumerate(names):
        if n_std[i] < 10:
            ent = {"n": int(n_std[i])}
        else:
            ok = far[i] & (n_std >= 10)
            comp = np.where(ok & (pair[i] >= MIN_PAIR_N) & (z[i] >= 3))[0]
            comp = comp[np.argsort(-lift[i][comp])][:12]
            avo = np.where(ok & (exp[i] >= 8) & (z[i] <= -3))[0]
            avo = avo[np.argsort(lift[i][avo])][:6]
            ent = {"n": int(n_std[i]),
                   "c": [[names[j]["n"], names[j]["h"], int(pair[i][j]), round(float(lift[i][j]), 2)] for j in comp],
                   "a": [[names[j]["n"], names[j]["h"], round(float(exp[i][j]), 1), int(pair[i][j]), round(float(lift[i][j]), 2)] for j in avo]}
        ent["h"] = e["h"]
        ent["k"] = [int(facts[k][i]) for k in ("exact_any", "3_5", "4_1", "10_1", "4_5")]
        shards.setdefault(routeSlug(e["n"])[:1] if routeSlug(e["n"])[:1].isalpha() else "_", {})[routeSlug(e["n"])] = {"n_": e["n"], **ent}
    out = Path(args["out"])
    for f in out.glob("affinity-*.json"):
        f.unlink()
    size = 0
    for k, v in shards.items():
        s = json.dumps(v, ensure_ascii=False, separators=(",", ":"))
        (out / f"affinity-{k}.json").write_text(s)
        size += len(s)
    print(f"affinity: {V} colors, {sum(1 for s in shards.values() for e in s.values() if e.get('c'))} with companions, "
          f"{size / 1e3:.0f} KB in {len(shards)} shards ({time.time() - t0:.0f}s)", flush=True)
    # colors a painter used in at least a quarter of their works (artists with 12+ works)
    aid = np.array([m[1] for m in meta_rows])
    P2 = P.tocsr()
    pj = {}
    for a_id in np.unique(aid):
        if a_id == 0:
            continue
        mem = np.where(aid == a_id)[0]
        if len(mem) < 12:
            continue
        sh = np.asarray(P2[mem].sum(0)).ravel() / len(mem)
        rate = n_std / n
        order = np.argsort(-sh)
        picked = []
        for j in order:
            if sh[j] < .25:
                break
            if all(de_names[j][q] >= 8 for q in picked):
                picked.append(j)
            if len(picked) >= 10:
                break
        sig = [j for j in picked if rate[j] > 0 and sh[j] / rate[j] >= 1.8]
        pj[arts[a_id]] = {"n": int(len(mem)),
                          "c": [[names[j]["n"], names[j]["h"], round(float(sh[j]) * 100)] for j in picked],
                          "s": [names[j]["n"] for j in sig]}
    chords(out, rows, P, names, vlab, de_names)
    (out / "painters.json").write_text(json.dumps(pj, ensure_ascii=False, separators=(",", ":")))
    print(f"painters: {len(pj)} artists with 12+ works, {(out / 'painters.json').stat().st_size / 1e3:.0f} KB", flush=True)
    # the Color Graph's own count at its definition, for the consistency report
    try:
        gr = {}
        for f in sorted((ROOT / "data" / "graph" / "fieldnotes").glob("*.json")):
            for r in json.loads(f.read_text()):
                if isinstance(r, dict) and r.get("ar"):
                    gr[r["s"]] = r["ar"]
        a, b = [], []
        for i, e in enumerate(names):
            ar = gr.get(routeSlug(e["n"]))
            if ar and ar.get("n") is not None:
                a.append(int(ar["n"]))
                b.append(int(n_std[i]))
        if a:
            a, b = np.array(a), np.array(b)
            print(f"consistency with the Color Graph's 'in a painting' (pool, dE 4, 1%): {len(a)} colors; "
                  f"Spearman r = {np.corrcoef(np.argsort(np.argsort(a)), np.argsort(np.argsort(b)))[0, 1]:.3f}; "
                  f"median n here / graph = {np.median(b[a > 20] / a[a > 20]):.2f}", flush=True)
    except Exception as e:
        print("(consistency report skipped:", e, ")")



# ---------- the masters' chords: pairs and triads painters combine, per slice of the archive ----------
REL = ["neutrals", "neutral+color", "analogous", "between", "opposite"]


def relation(lch1, lch2):
    """Color-wheel theory's name for two colors, on the perceptual (CIELAB) wheel: a stated convention, not a law.
    neutral = chroma under 12; analogous = hues within 40 degrees; opposite = 150 degrees or more apart."""
    (_, c1, h1), (_, c2, h2) = lch1, lch2
    if c1 < 12 and c2 < 12:
        return 0
    if c1 < 12 or c2 < 12:
        return 1
    d = abs(h1 - h2) % 360
    d = 360 - d if d > 180 else d
    return 2 if d <= 40 else 4 if d >= 150 else 3


SLICES = [("all", "All of it", lambda x: True)] + \
    [(f"c{c}", f"{c}s", (lambda c: lambda x: x.get("y") is not None and c <= x["y"] < c + 100)(c)) for c in (1400, 1500, 1600, 1700, 1800, 1900)] + \
    [("it1500", "Italy, 1500s", lambda x: x.get("co") == "Italy" and x.get("y") is not None and 1500 <= x["y"] < 1600),
     ("nl1600", "Dutch, 1600s", lambda x: x.get("co") == "Netherlands" and x.get("y") is not None and 1600 <= x["y"] < 1700),
     ("fr1800", "France, 1800s", lambda x: x.get("co") == "France" and x.get("y") is not None and 1800 <= x["y"] < 1900),
     ("jp", "Japan", lambda x: x.get("co") == "Japan"),
     ("in", "India", lambda x: x.get("co") == "India")] + \
    [(f"mv{m}", m, (lambda m: lambda x: x.get("mv") == m)(m)) for m in ("Impressionism", "Post-Impressionism", "Realism", "Renaissance")]


def chords(out, rows, P, names, vlab, de_names):
    import library as LIB
    lchs = []
    for L, a, b in vlab:
        h = math.degrees(math.atan2(b, a)) % 360
        lchs.append((L, math.hypot(a, b), h))
    relm = np.array([[relation(lchs[i], lchs[j]) for j in range(len(names))] for i in range(len(names))])
    P = P.tocsr()
    res = []
    for key, label, f in SLICES:
        mask = np.array([bool(f(x)) for x in rows])
        Ns = int(mask.sum())
        if Ns < 150:
            continue
        Ps = P[mask]
        ni = np.asarray(Ps.sum(0)).ravel()
        pair = (Ps.T @ Ps).toarray()
        exp = np.outer(ni, ni) / Ns
        with np.errstate(divide="ignore", invalid="ignore"):
            lift = np.where(exp > 0, pair / exp, 0)
            z = np.where(exp > 0, (pair - exp) / np.sqrt(exp), 0)
        minpair = max(5, int(.002 * Ns))
        minn = max(8, int(.004 * Ns))
        far = de_names >= 12
        okc = (ni >= minn)
        base = far & okc[:, None] & okc[None, :]
        iu = np.triu_indices(len(names), 1)

        def pick(cond, order_key, k, ascending):
            idx = np.where(cond[iu])[0]
            idx = idx[np.argsort(order_key[iu][idx] * (1 if ascending else -1), kind="stable")]
            chosen = []
            for t in idx:
                i, j = iu[0][t], iu[1][t]
                if any((de_names[i][a] < 10 and de_names[j][b] < 10) or (de_names[i][b] < 10 and de_names[j][a] < 10) for a, b, _ in chosen):
                    continue
                chosen.append((i, j, t))
                if len(chosen) >= k:
                    break
            return chosen
        top = pick(base & (pair >= minpair) & (z >= 3), lift, 30, False)
        avoid = pick(base & (exp >= max(8, .004 * Ns)) & (z <= -3), lift, 15, True)
        # triads among the most common, well-spread colors
        cand = []
        for i in np.argsort(-ni):
            if ni[i] < max(15, .01 * Ns):
                break
            if all(de_names[i][c] >= 10 for c in cand):
                cand.append(i)
            if len(cand) >= 70:
                break
        triads = []
        if len(cand) >= 3:
            Pc = Ps[:, cand].toarray().astype(np.float32)
            for a in range(len(cand)):
                M = Pc * Pc[:, a:a + 1]
                T = M.T @ Pc
                for b in range(a + 1, len(cand)):
                    for c in range(b + 1, len(cand)):
                        obs = T[b, c]
                        if obs < minpair:
                            continue
                        ia, ib, ic = cand[a], cand[b], cand[c]
                        ex = ni[ia] * ni[ib] * ni[ic] / Ns ** 2
                        if ex <= 0 or (obs - ex) / math.sqrt(ex) < 3:
                            continue
                        if min(lift[ia][ib], lift[ia][ic], lift[ib][ic]) < 1.2:
                            continue
                        triads.append((obs / ex, int(obs), ia, ib, ic))
            triads.sort(reverse=True)
            kept = []
            for t in triads:
                if any(len({t[2], t[3], t[4]} & {u[2], u[3], u[4]}) >= 2 for u in kept):
                    continue
                kept.append(t)
                if len(kept) >= 12:
                    break
            triads = kept
        # how each kind of relation fares across every well-measured pair
        allp = np.where((base & (pair >= 3))[iu])[0]
        rel = {}
        rv = relm[iu][allp]
        lv = np.log(np.maximum(lift[iu][allp], 1e-3))
        topr = [int(relm[i][j]) for i, j, _ in top]
        for r, nm in enumerate(REL):
            m = rv == r
            rel[nm] = {"pairs": int(m.sum()), "lift": round(float(math.exp(lv[m].mean())), 2) if m.any() else None, "top": topr.count(r)}
        nm = lambda i: [names[i]["n"], names[i]["h"]]
        res.append({"k": key, "label": label, "n": Ns,
                    "pairs": [nm(i) + nm(j) + [int(pair[i][j]), round(float(lift[i][j]), 2), int(relm[i][j])] for i, j, _ in top],
                    "triads": [nm(a) + nm(b) + nm(c) + [o, round(float(l), 2)] for l, o, a, b, c in triads],
                    "avoid": [nm(i) + nm(j) + [round(float(exp[i][j]), 1), int(pair[i][j]), round(float(lift[i][j]), 2)] for i, j, _ in avoid],
                    "rel": rel})
        print(f"  chords {label}: n={Ns} pairs={len(top)} triads={len(triads)} avoid={len(avoid)}", flush=True)
    doc = {"v": 1, "std": [STD_TOL, STD_COVER], "classes": REL, "slices": res,
           "how": "A painting has a color when something within 4% of it covers at least 1% of the canvas. Lift = pairs observed / expected if the two colors were scattered independently. Pairs under 12% different are skipped (they are the same color twice)."}
    (out / "chords.json").write_text(json.dumps(doc, ensure_ascii=False, separators=(",", ":")))
    print(f"chords: {len(res)} slices, {(out / 'chords.json').stat().st_size / 1e3:.0f} KB", flush=True)


def build_items(args):
    items = json.loads(Path(args["items"]).read_text())
    n = len(items)
    keys, covs = [], []
    art, mvs, cos = {"": 0}, {"": 0}, {"": 0}
    arts, mvl, col = [""], [""], [""]
    meta_rows = []
    def idx(d, lst, v):
        v = v or ""
        if v not in d:
            d[v] = len(lst)
            lst.append(v)
        return d[v]
    for x in items:
        k, cv, _ = colors_cells(x["colors"])
        keys.append(k)
        covs.append(np.maximum(cv, COV0))
        meta_rows.append((x.get("y"), idx(art, arts, x.get("a")), idx(mvs, mvl, x.get("mv")), idx(cos, col, x.get("co"))))
    head, total, _ = write_index(Path(args["out"]), args.get("label", "Items"), args.get("item", "item"), n, keys, covs,
                                 list(range(n)), meta_rows, {"artists": arts, "movements": mvl, "countries": col},
                                 Path(args["out"]).name)
    print(f"{n} items -> {head['postings']} postings, {len(head['leaves'])} shards, {total / 1e3:.0f} KB")


def build_design(args):
    """The design corpus (lane L19: data/design/objects-*.json, six-color palettes) -> data/design/colorindex/.
    Palette-only, so every piece is coarse. items.json carries what a result tile needs (the app never loads L19's
    own shards for this): [id, title, maker, year, category, [palette hexes]]."""
    d = Path(args["design"])
    cats = json.loads((d / "index.json").read_text())["cats"]
    objs = []
    for f in sorted(d.glob("objects-*.json")):
        objs += json.loads(f.read_text())
    objs = [o for o in objs if len(o.get("p") or []) >= 2]
    items = [{"id": o["id"], "y": o.get("y"), "a": o.get("a"), "mv": cats.get(o.get("cat"), o.get("cat")), "co": o.get("co"),
              "colors": [[c[0], c[1]] for c in o["p"]]} for o in objs]
    tmp = Path(args["out"]) / "_items.json"
    Path(args["out"]).mkdir(parents=True, exist_ok=True)
    tmp.write_text(json.dumps(items))
    build_items({**args, "items": str(tmp)})
    tmp.unlink()
    (Path(args["out"]) / "items.json").write_text(json.dumps(
        [[o["id"], o.get("t") or "Untitled", o.get("a") or "", o.get("y"), cats.get(o.get("cat"), ""), [c[0] for c in o["p"]]] for o in objs],
        ensure_ascii=False, separators=(",", ":")))
    h = json.loads((Path(args["out"]) / "index.json").read_text())
    h["items"] = "items.json"
    (Path(args["out"]) / "index.json").write_text(json.dumps(h, separators=(",", ":")))


def main():
    a = sys.argv[1:]
    g = lambda k, d=None: a[a.index(k) + 1] if k in a else d
    args = {"raw": g("--raw", str(ROOT / "research" / "_raw")), "out": g("--out", str(ROOT / "data" / "colorindex")),
            "limit": int(g("--limit", 0)), "workers": int(g("--workers", 8)), "items": g("--items"), "design": g("--design"),
            "label": g("--label", "Items"), "item": g("--item-name", "item")}
    if args["design"]:
        args["out"] = g("--out", str(ROOT / "data" / "design" / "colorindex")); args["label"] = "Design"; args["item"] = "design piece"
        return build_design(args)
    if args["items"]:
        return build_items(args)
    if "--affinity-only" in a:
        import gallery as G
        rows, _ = G.load_corpus()
        head, built = read_index(args["out"])
        arts = json.loads((Path(args["out"]) / "meta.json").read_text())["artists"]
        mb = (Path(args["out"]) / "meta.bin").read_bytes()
        meta_rows = [(None, int.from_bytes(mb[i * 6 + 2:i * 6 + 4], "little"), mb[i * 6 + 4], mb[i * 6 + 5]) for i in range(head["n"])]
        return affinity(args, rows, head, built, meta_rows, arts)
    rows, head, built, meta_rows, arts = build_paintings(args)
    if "--no-affinity" not in a and not args["limit"]:
        affinity(args, rows, head, built, meta_rows, arts)


if __name__ == "__main__":
    main()
