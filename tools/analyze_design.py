#!/usr/bin/env python3
"""Design-history color analysis (sibling of tools/analyze.py). Offline, deterministic, no LLM cost.

  python3 tools/analyze_design.py

Reads data/design/objects-<category>.json (written by tools/design_corpus.py build: 6-color palettes per object, each
color named by the app's ~1,000 core names) and the painting corpus (data/corpus/*.json, same 6-color palettes) and
writes, into data/design/:
  index.json            sources + licenses, counts per category / decade / source, the category x decade matrix,
                        thresholds, caveats, how to rebuild an image or page URL from a row.
  colors-index.json     one line per color that appears in design: slug, name, hex, design share, shard.
  colors-<k>.json       per color (by slug): design share, painting share, lift, peak decade, decade curve,
                        top categories, top designers, 6 example objects. 100 colors a shard.
  cells.json            category x decade (and "all"): n, palette, signature colors, mean L*/C*, warm share.
  makers.json           designers and makers with >= MIN_MAKER objects: palette, signature colors.
  superlatives.json     plain-English findings, each with n and its evidence.
Honesty: every figure is "as photographed"; n is on every claim; a group under its minimum n is not reported; shares
are area shares of a 6-color k-means palette, not exact pixel statistics.

Weighting. Museums hold very different amounts of each kind of object (Cooper Hewitt: wallpaper and textiles; Rijksmuseum:
posters), so the headline design share of a color is CATEGORY-BALANCED: the mean of the per-category mean shares over
the categories with at least MIN_CAT objects. Decade series are balanced the same way. The raw (object-weighted) share is
stored as `raw` so nothing is hidden.
"""
import json, math, re, sys, unicodedata
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
import design_corpus as D  # noqa: E402
import corpus as C  # noqa: E402

OUT = ROOT / "data" / "design"
DECADES = list(range(1800, 1980, 10))
MIN_CAT = 60            # a category counts toward the balanced mean only with this many objects
MIN_CELL = 25           # a category x decade cell, or a decade, is reported with at least this many objects
MIN_MAKER = 8           # a designer/maker gets a palette with at least this many objects
PRESENT = 0.03          # a color "is in" an object when it covers at least this share of the palette
SHARD = 100
STYLES = {  # curated lists of makers by movement; the n shown is how many of OUR objects name them (often few)
    "Arts and Crafts": ["William Morris", "Morris & Co.", "Walter Crane", "C. F. A. Voysey", "C.F.A. Voysey", "John Henry Dearle",
                        "Lewis F. Day", "Christopher Dresser", "Lindsay Butterfield", "Arthur Heygate Mackmurdo"],
    "Art Nouveau": ["Alphonse Mucha", "Eugène Grasset", "Henri Privat-Livemont", "Will H. Bradley", "Aubrey Beardsley",
                    "Koloman Moser", "Louis Rhead", "Louis Comfort Tiffany", "Émile Gallé", "René Lalique",
                    "Henri de Toulouse-Lautrec", "Théophile-Alexandre Steinlen", "Georges de Feure", "Gustav Klimt",
                    "Jules Chéret", "Pierre Bonnard", "Edward Penfield", "Maxfield Parrish", "Ethel Reed"],
    "Bauhaus and modernism": ["Herbert Bayer", "Josef Albers", "Anni Albers", "Marianne Brandt", "Marcel Breuer",
                              "Walter Gropius", "László Moholy-Nagy", "Wilhelm Wagenfeld", "Gunta Stölzl", "Joost Schmidt",
                              "Paul Klee", "Lyonel Feininger", "Wassily Kandinsky", "Oskar Schlemmer", "El Lissitzky",
                              "Jan Tschichold", "Piet Zwart", "Theo van Doesburg", "Gerrit Rietveld", "Alexander Rodchenko"],
    "Art Deco": ["A. M. Cassandre", "Cassandre", "Erté", "Paul Poiret", "Edouard Benedictus", "Jean Dunand",
                 "Emile-Jacques Ruhlmann", "Raymond Loewy", "Norman Bel Geddes", "Donald Deskey", "Joseph Binder"],
}


def slug(s):
    s = unicodedata.normalize("NFKD", str(s))
    s = "".join(ch for ch in s if not unicodedata.combining(ch)).lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def norm_name(s):
    s = unicodedata.normalize("NFKD", s or "")
    return re.sub(r"[^a-z0-9]+", " ", "".join(ch for ch in s if not unicodedata.combining(ch)).lower()).strip()


def load_design():
    rows = []
    for c in D.CATS:
        p = OUT / f"objects-{c}.json"
        if p.exists():
            rows += json.loads(p.read_text())
    return rows


def load_paintings():
    rows = []
    for p in sorted((ROOT / "data" / "corpus").glob("*.json")):
        rows += json.loads(p.read_text())
    return [r for r in rows if r.get("y") and r.get("p")]


def entries_of(rows, ci_from_hex=None):
    """Flat entries of a list of rows: (row index, core index, share) for design; paintings are named here."""
    ri, ci, sh, hx = [], [], [], []
    for i, r in enumerate(rows):
        for h, s, c in r["p"]:
            ri.append(i); ci.append(c); sh.append(s); hx.append(h)
    return np.array(ri), np.array(ci), np.array(sh, dtype=np.float64), hx


def share_matrix(n_rows, ri, ci, sh, ncol=1000):
    M = np.zeros((n_rows, ncol), dtype=np.float32)
    np.add.at(M, (ri, ci), sh)
    return M


def hexmean(hexes, w):
    rgb = np.array([C.hex_to_rgb(h) for h in hexes], dtype=np.float64)
    m = (rgb * w[:, None]).sum(0) / max(w.sum(), 1e-9)
    return C.rgb_to_hex(np.round(m))


def main():
    core = D.core()
    names, chex = core["n"], core["hex"]
    NC = len(names)
    rows = load_design()
    print(f"design objects: {len(rows)}")
    cats = np.array([r["cat"] for r in rows])
    decs = np.array([r["y"] // 10 * 10 for r in rows])
    srcs = np.array([r["src"] for r in rows])
    ri, ci, sh, hx = entries_of(rows)
    M = share_matrix(len(rows), ri, ci, sh, NC)                 # object x color area share
    P = (M >= PRESENT)                                          # present?
    Lr = np.array([r["L"] for r in rows]); Cr = np.array([r["C"] for r in rows])

    # ---- category-balanced means -----------------------------------------------------------------
    cat_n = Counter(cats.tolist())
    bal_cats = [c for c in D.CATS if cat_n[c] >= MIN_CAT]

    def balanced(mask_fn):
        """Mean over categories (with >= MIN_CAT objects overall) of the category mean share within the mask."""
        parts = []
        for c in bal_cats:
            m = (cats == c) & mask_fn
            if m.sum() >= 5:
                parts.append(M[m].mean(0))
        return np.mean(parts, 0) if parts else np.zeros(NC)

    allmask = np.ones(len(rows), dtype=bool)
    design_share = balanced(allmask)                            # (NC,) balanced area share
    raw_share = M.mean(0)
    dec_n = {d: int((decs == d).sum()) for d in DECADES}
    dec_share = {d: balanced(decs == d) for d in DECADES if dec_n[d] >= MIN_CELL}
    cat_share = {c: M[cats == c].mean(0) for c in bal_cats}

    # ---- paintings, named the same way ---------------------------------------------------------------
    pr = load_paintings()
    pl = np.array([lab for r in pr for lab in C.rgb_to_lab(np.array([C.hex_to_rgb(h) for h, *_ in r["p"]], dtype=np.float64))])
    pci, _ = D.name_labs(pl)
    k = 0
    for r in pr:
        r["pc"] = [int(x) for x in pci[k:k + len(r["p"])]]
        k += len(r["p"])
    pri = np.array([i for i, r in enumerate(pr) for _ in r["p"]])
    pcc = np.array([c for r in pr for c in r["pc"]])
    psh = np.array([s for r in pr for _, s, *_ in r["p"]], dtype=np.float64)
    PM = share_matrix(len(pr), pri, pcc, psh, NC)
    pdec = np.array([r["y"] // 10 * 10 for r in pr])
    in_window = (pdec >= 1800) & (pdec <= 1970)
    paint_share = PM[in_window].mean(0)
    pdec_n = {d: int((pdec == d).sum()) for d in DECADES}
    pdec_share = {d: PM[pdec == d].mean(0) for d in DECADES if pdec_n[d] >= MIN_CELL}
    print(f"paintings 1800-1979: {int(in_window.sum())}")

    # ---- makers ----------------------------------------------------------------------------------------
    mk_idx = defaultdict(list)
    for i, r in enumerate(rows):
        if r.get("a"):
            mk_idx[norm_name(r["a"])].append(i)
    mk_name = {}
    for key, idx in mk_idx.items():
        mk_name[key] = Counter(rows[i]["a"] for i in idx).most_common(1)[0][0]
    makers = {k: v for k, v in mk_idx.items() if len(v) >= MIN_MAKER}
    mk_share = {k: M[v].mean(0) for k, v in makers.items()}
    print(f"makers with >= {MIN_MAKER} objects: {len(makers)}")

    # ---- per color records ----------------------------------------------------------------------------
    order = np.argsort(-design_share)
    ex_pool = {}
    for c in range(NC):
        col = M[:, c]
        idx = np.argsort(-col)[:6]
        ex_pool[c] = [int(i) for i in idx if col[i] >= 0.12]
    colors, cindex = {}, []
    for c in range(NC):
        n_present = int(P[:, c].sum())
        if n_present < 5:
            continue
        s = float(design_share[c])
        sp = float(paint_share[c])
        rec = dict(name=names[c], hex=chex[c], n=n_present, s=round(s * 100, 3), raw=round(float(raw_share[c]) * 100, 3),
                   sp=round(sp * 100, 3), lift=round(s / sp, 2) if sp > 0.0002 else None)
        # decade curve (balanced, per mille) and peak
        curve = [round(float(dec_share[d][c]) * 1000, 1) if d in dec_share else None for d in DECADES]
        rec["dec"] = curve
        best = max(((dec_share[d][c], d) for d in dec_share if int((decs == d).sum() > 0) and P[decs == d, c].sum() >= 4),
                   default=None)
        if best and s > 0:
            rec["pk"] = best[1]
            rec["pkl"] = round(float(best[0]) / s, 2)
            rec["pkn"] = dec_n[best[1]]
        rec["pcurve"] = [round(float(pdec_share[d][c]) * 1000, 1) if d in pdec_share else None for d in DECADES]
        # categories: share of this color's area per category vs the balanced mean
        cl = []
        for cat in bal_cats:
            v = float(cat_share[cat][c])
            if v > 0 and s > 0:
                cl.append((v / s, cat, v, int((P[:, c] & (cats == cat)).sum())))
        cl.sort(reverse=True)
        rec["cat"] = [[cat, round(v * 100, 2), round(l, 2), n] for l, cat, v, n in cl[:3] if n >= 5]
        # makers
        ml = []
        for k_, v in mk_share.items():
            vs = float(v[c])
            if vs >= 0.04 and s > 0 and vs / max(s, 1e-6) >= 1.6:
                npres = int(P[makers[k_], c].sum())
                if npres >= 3:
                    ml.append((vs / s, k_, vs, npres))
        ml.sort(reverse=True)
        rec["mk"] = [[mk_name[k_], round(v * 100, 1), round(l, 1), len(makers[k_])] for l, k_, v, npr in ml[:3]]
        rec["ex"] = [[rows[i]["id"], rows[i]["src"], rows[i]["i"], (rows[i]["t"] or "")[:60], rows[i]["y"], rows[i]["cat"],
                      round(float(M[i, c]) * 100), rows[i].get("u")] for i in ex_pool[c]]
        colors[slug(names[c])] = rec
    slugs = sorted(colors, key=lambda s_: -colors[s_]["s"])
    for j, s_ in enumerate(slugs):
        colors[s_]["shard"] = j // SHARD
    for f in OUT.glob("colors-*.json"):
        f.unlink()
    for k_ in range(math.ceil(len(slugs) / SHARD)):
        part = {s_: colors[s_] for s_ in slugs[k_ * SHARD:(k_ + 1) * SHARD]}
        (OUT / f"colors-{k_}.json").write_text(json.dumps(part, ensure_ascii=False, separators=(",", ":")))
    (OUT / "colors-index.json").write_text(json.dumps(
        [[s_, colors[s_]["name"], colors[s_]["hex"], colors[s_]["shard"], colors[s_]["n"], colors[s_]["s"], colors[s_]["lift"]]
         for s_ in slugs], ensure_ascii=False, separators=(",", ":")))
    print(f"colors: {len(slugs)} appear in >= 5 objects")

    # ---- cells ---------------------------------------------------------------------------------------------
    ent_obj = ri
    hx_arr = np.array(hx)

    def cell_record(mask, label):
        n = int(mask.sum())
        if n < MIN_CELL:
            return None
        ms = M[mask].mean(0)
        top = np.argsort(-ms)[:8]
        # signature: highest lift vs the all-design balanced share, min share 0.8%
        lift = np.where(design_share > 0.0005, ms / np.maximum(design_share, 1e-9), 0)
        sig = [int(c) for c in np.argsort(-(lift * (ms > 0.008)))[:5] if lift[c] > 1.5 and ms[c] > 0.008]
        em = mask[ent_obj]
        pal = []
        for c in top:
            sel = em & (ci == c)
            pal.append([int(c), round(float(ms[c]) * 100, 2), hexmean(hx_arr[sel], sh[sel]) if sel.any() else chex[c]])
        Lm, Cm = float(Lr[mask].mean()), float(Cr[mask].mean())
        return dict(n=n, pal=pal, sig=[[int(c), round(float(ms[c]) * 100, 2), round(float(lift[c]), 1)] for c in sig],
                    L=round(Lm, 1), C=round(Cm, 1), vivid=round(float((Cr[mask] >= 35).mean()), 3),
                    dark=round(float((Lr[mask] < 35).mean()), 3), src=dict(Counter(srcs[mask].tolist())))

    cells = {"names": names}
    cells["cells"] = {}
    for c in D.CATS + ["all"]:
        cm = (cats == c) if c != "all" else allmask
        rec = cell_record(cm, c)
        if rec:
            cells["cells"][f"{c}"] = rec
        for d in DECADES:
            rec = cell_record(cm & (decs == d), f"{c} {d}")
            if rec:
                cells["cells"][f"{c}/{d}"] = rec
    # the all-category decade rows are category-balanced for L, C and vivid too
    for d in DECADES:
        parts = [(Lr[(cats == c) & (decs == d)].mean(), Cr[(cats == c) & (decs == d)].mean(),
                  (Cr[(cats == c) & (decs == d)] >= 35).mean()) for c in bal_cats if ((cats == c) & (decs == d)).sum() >= 10]
        if f"all/{d}" in cells["cells"] and parts:
            cells["cells"][f"all/{d}"]["bal"] = dict(L=round(float(np.mean([p[0] for p in parts])), 1),
                                                    C=round(float(np.mean([p[1] for p in parts])), 1),
                                                    vivid=round(float(np.mean([p[2] for p in parts])), 3), cats=len(parts))
    (OUT / "cells.json").write_text(json.dumps(cells, ensure_ascii=False, separators=(",", ":")))
    print(f"cells: {len(cells['cells'])}")

    # ---- makers file -------------------------------------------------------------------------------------
    mk_out = []
    for k_, v in sorted(makers.items(), key=lambda kv: -len(kv[1])):
        ms = mk_share[k_]
        top = np.argsort(-ms)[:6]
        lift = np.where(design_share > 0.0005, ms / np.maximum(design_share, 1e-9), 0)
        sig = [int(c) for c in np.argsort(-(lift * (ms > 0.01)))[:3] if lift[c] > 1.5 and ms[c] > 0.01]
        ys = [rows[i]["y"] for i in v]
        mk_out.append(dict(a=mk_name[k_], n=len(v), y=[min(ys), max(ys)],
                           cat=[c for c, _ in Counter(rows[i]["cat"] for i in v).most_common(2)],
                           pal=[[int(c), round(float(ms[c]) * 100, 1)] for c in top],
                           sig=[[c, round(float(ms[c]) * 100, 1), round(float(lift[c]), 1)] for c in sig]))
    (OUT / "makers.json").write_text(json.dumps(mk_out, ensure_ascii=False, separators=(",", ":")))

    # ---- superlatives ---------------------------------------------------------------------------------------
    sup = []

    def nm(c):
        return names[c]

    def add(key, title, text, n, evidence=None, **kw):
        sup.append(dict(key=key, title=title, text=text, n=n, ev=evidence or [], **kw))

    # colors of a decade of a category
    for cat, d0, d1 in [("poster", 1920, 1929), ("poster", 1890, 1909), ("wallpaper", 1900, 1929), ("textile", 1800, 1849),
                        ("stamps", 1930, 1969)]:
        mk = (cats == cat) & (decs >= d0) & (decs <= d1)
        n = int(mk.sum())
        if n >= MIN_CELL:
            ms = M[mk].mean(0)
            base = cat_share.get(cat)
            top = [int(c) for c in np.argsort(-ms)[:6]]
            add(f"colors-{cat}-{d0}", f"The colors of {d0}s {D.CAT_NAME[cat].lower()}" if d1 - d0 < 15 else
                f"The colors of {D.CAT_NAME[cat].lower()}, {d0}-{d1}",
                "Most area: " + ", ".join(f"{nm(c)} ({ms[c] * 100:.1f}%)" for c in top[:5]) + ".", n,
                [[c, round(float(ms[c]) * 100, 2)] for c in top])
    # design vs painting
    ok = [c for c in range(NC) if P[:, c].sum() >= 150 and paint_share[c] > 0.0005]
    if ok:
        up = sorted(ok, key=lambda c: -design_share[c] / paint_share[c])[:6]
        dn = sorted(ok, key=lambda c: design_share[c] / paint_share[c])[:6]
        add("design-only", "Colors designers use far more than painters",
            "Design (category-balanced) against the 1800-1979 paintings of the corpus, colors in >= 150 design objects: " +
            "; ".join(f"{nm(c)} {design_share[c] / paint_share[c]:.1f}x" for c in up) + ".",
            len(rows), [[c, round(float(design_share[c]) * 100, 2), round(float(paint_share[c]) * 100, 2)] for c in up])
        add("painter-only", "Colors painters use far more than designers",
            "; ".join(f"{nm(c)} {paint_share[c] / design_share[c]:.1f}x" for c in dn) + ". (Paintings 1800-1979, "
            f"n={int(in_window.sum())}; design n={len(rows)}.)", len(rows),
            [[c, round(float(design_share[c]) * 100, 2), round(float(paint_share[c]) * 100, 2)] for c in dn])

    # emergence: design before painting
    def emergence(series, ndec, ds):
        base = np.mean([series[d] for d in ds if d <= 1840 and d in series], 0) if any(d in series for d in ds if d <= 1840) else None
        if base is None:
            return {}
        out = {}
        later = [d for d in sorted(series) if d >= 1850 and ndec[d] >= 40]
        for c in range(NC):
            thr = max(2.0 * base[c], 0.004)
            for j, d in enumerate(later):
                nxt = later[j + 1] if j + 1 < len(later) else None
                if series[d][c] >= thr and (nxt is None or series[nxt][c] >= thr * 0.8):
                    out[c] = d
                    break
        return out
    em_d = emergence(dec_share, dec_n, DECADES)
    em_p = emergence(pdec_share, pdec_n, DECADES)
    first = []
    for c, d in em_d.items():
        if (c in em_p and em_p[c] - d >= 10) and P[:, c].sum() >= 100:
            first.append((em_p[c] - d, c, d, em_p[c]))
    first.sort(reverse=True)
    if first:
        add("design-first", "Colors that show up in design before painting",
            "First decade a color's share passes twice its 1800-1840 level (and holds), design vs painting: " +
            "; ".join(f"{nm(c)} {d}s vs {p}s" for _, c, d, p in first[:6]) +
            ". Caveat: only public-domain paintings are in the corpus, and few after 1900 (n by decade in the index), "
            "so a late painting date is partly a sampling gap.", len(rows),
            [[c, d, p] for _, c, d, p in first[:8]])

    # decades: most vivid / darkest, category-balanced
    bal_dec = {d: cells["cells"][f"all/{d}"]["bal"] for d in DECADES if f"all/{d}" in cells["cells"] and "bal" in cells["cells"][f"all/{d}"]}
    if len(bal_dec) >= 4:
        dv = max(bal_dec, key=lambda d: bal_dec[d]["C"])
        dm = min(bal_dec, key=lambda d: bal_dec[d]["C"])
        dd = min(bal_dec, key=lambda d: bal_dec[d]["L"])
        dl = max(bal_dec, key=lambda d: bal_dec[d]["L"])
        add("decade-extremes", "The most vivid, the most muted, the darkest and the lightest decade",
            f"Mean chroma C* (category-balanced): most vivid {dv}s ({bal_dec[dv]['C']}, n={cells['cells'][f'all/{dv}']['n']}), "
            f"most muted {dm}s ({bal_dec[dm]['C']}, n={cells['cells'][f'all/{dm}']['n']}); mean lightness L*: darkest {dd}s "
            f"({bal_dec[dd]['L']}), lightest {dl}s ({bal_dec[dl]['L']}). Balanced across {bal_dec[dv]['cats']}+ categories per decade.",
            len(rows), [[d, bal_dec[d]["L"], bal_dec[d]["C"], cells["cells"][f"all/{d}"]["n"]] for d in sorted(bal_dec)])
    # category extremes
    cc = {c: cells["cells"][c] for c in bal_cats if c in cells["cells"]}
    if cc:
        cv = max(cc, key=lambda c: cc[c]["C"]); cm_ = min(cc, key=lambda c: cc[c]["C"])
        add("category-extremes", "The most saturated and most muted kinds of design",
            f"Mean chroma C*: {D.CAT_NAME[cv]} {cc[cv]['C']} (n={cc[cv]['n']}) is the most saturated; {D.CAT_NAME[cm_]} "
            f"{cc[cm_]['C']} (n={cc[cm_]['n']}) the most muted.", len(rows), [[c, cc[c]["C"], cc[c]["n"]] for c in cc])

    # styles by maker lists
    for style, lst in STYLES.items():
        keys = [norm_name(x) for x in lst]
        idx = sorted({i for k_, v in mk_idx.items() if any(k_ == q for q in keys) for i in v})
        if len(idx) >= 15:
            ms = M[idx].mean(0)
            lift = np.where(design_share > 0.0005, ms / np.maximum(design_share, 1e-9), 0)
            sig = [int(c) for c in np.argsort(-(lift * (ms > 0.01)))[:4] if lift[c] > 1.4 and ms[c] > 0.01]
            top = [int(c) for c in np.argsort(-ms)[:4]]
            found = sorted({mk_name[k_] for k_, v in mk_idx.items() if k_ in keys})
            add(f"style-{slug(style)}", f"The most {style} color",
                f"Objects by {len(found)} {style} names in our data (n={len(idx)}: {', '.join(found[:6])}"
                f"{'...' if len(found) > 6 else ''}): biggest areas {', '.join(nm(c) for c in top)}; most distinctive vs all "
                f"design: {', '.join(f'{nm(c)} ({lift[c]:.1f}x)' for c in sig) or 'none stands out'}.", len(idx),
                [[c, round(float(ms[c]) * 100, 2), round(float(lift[c]), 1)] for c in (sig or top)])
        else:
            add(f"style-{slug(style)}", f"The most {style} color",
                f"Not enough objects by named {style} makers in the open data (n={len(idx)}; the minimum is 15). "
                "Most 20th-century modernist work is still in copyright, so its images are not in any open collection.", len(idx))
    # wallpaper / textile signature per century half
    for cat in ("wallpaper", "textile"):
        for d0, d1 in ((1800, 1859), (1860, 1929)):
            mk = (cats == cat) & (decs >= d0) & (decs <= d1)
            if mk.sum() >= 80:
                ms = M[mk].mean(0)
                lift = np.where(cat_share[cat] > 0.0005, ms / np.maximum(cat_share[cat], 1e-9), 0) if cat in cat_share else None
                if lift is not None:
                    sig = [int(c) for c in np.argsort(-(lift * (ms > 0.01)))[:3] if lift[c] > 1.3]
                    if sig:
                        add(f"sig-{cat}-{d0}", f"What changed in {cat}, {d0}-{d1}",
                            f"Colors over-represented in {cat} of {d0}-{d1} against all {cat} in the data: " +
                            ", ".join(f"{nm(c)} ({lift[c]:.1f}x)" for c in sig) + ".", int(mk.sum()),
                            [[c, round(float(ms[c]) * 100, 2), round(float(lift[c]), 1)] for c in sig])
    # biggest decade-to-decade shifts in a single color
    best = None
    ds = sorted(dec_share)
    for a, b in zip(ds, ds[1:]):
        if b - a != 10:
            continue
        diff = dec_share[b] - dec_share[a]
        c = int(np.argmax(np.abs(diff) * ((dec_share[a] + dec_share[b]) > 0.01)))
        if best is None or abs(diff[c]) > abs(best[3]):
            best = (a, b, c, float(diff[c]), float(dec_share[a][c]), float(dec_share[b][c]))
    if best:
        a, b, c, df, sa, sb = best
        add("biggest-shift", "The biggest one-decade color swing",
            f"{nm(c)} went from {sa * 100:.1f}% of design area in the {a}s to {sb * 100:.1f}% in the {b}s "
            f"(n={dec_n[a]} and {dec_n[b]}, category-balanced).", dec_n[a] + dec_n[b], [[c, a, b, round(sa * 100, 2), round(sb * 100, 2)]])
    # designer with the most distinctive palette
    bestm = None
    for k_, v in makers.items():
        if len(v) < 12:
            continue
        ms = mk_share[k_]
        lift = np.where(design_share > 0.002, ms / np.maximum(design_share, 1e-9), 0)
        c = int(np.argmax(lift * (ms > 0.05)))
        if ms[c] > 0.05 and (bestm is None or lift[c] > bestm[0]):
            bestm = (lift[c], k_, c, float(ms[c]))
    if bestm:
        l, k_, c, s_ = bestm
        add("designer-signature", "The designer with the most signature color",
            f"{mk_name[k_]} (n={len(makers[k_])}) uses {nm(c)} on {s_ * 100:.0f}% of the area, {l:.0f}x the design average.",
            len(makers[k_]), [[c, round(s_ * 100, 1), round(float(l), 1)]])

    # ---- vivid modern colors: when do they first appear in design? -------------------------------------
    VIV = 60.0   # a palette color with CIELAB chroma >= 60 is "vivid" (sRGB pure red is ~104, a strong poster red ~70)
    chroma_e = lambda hexes: np.hypot(*C.rgb_to_lab(np.array([C.hex_to_rgb(h) for h in hexes], dtype=np.float64))[:, 1:].T)
    viv_d = chroma_e(hx) >= VIV
    vshare = np.bincount(ri, weights=sh * viv_d, minlength=len(rows))
    cmflag = np.array([bool(r.get("cm")) for r in rows])
    ph = [h for r in pr for h, *_ in r["p"]]
    viv_p = chroma_e(ph) >= VIV
    pshare_v = np.bincount(pri, weights=psh * viv_p, minlength=len(pr))
    vivid = dict(threshold=f"CIELAB chroma C* >= {VIV:.0f} (palette color)", decades={}, source="design objects; paintings (data/corpus)")
    for d in DECADES:
        m = decs == d
        e = dict(n=int(m.sum()), nCommercial=int((m & cmflag).sum()), nPaint=int(pdec_n[d]))
        if m.sum() >= MIN_CELL:
            parts = [vshare[(cats == c) & m].mean() for c in bal_cats if ((cats == c) & m).sum() >= 8]
            e["balanced"] = round(float(np.mean(parts)) * 100, 2) if parts else None
            e["objects10"] = round(float((vshare[m] >= 0.10).mean()) * 100, 1)
        if (m & cmflag).sum() >= MIN_CELL:
            e["commercial"] = round(float(vshare[m & cmflag].mean()) * 100, 2)
            e["commercial10"] = round(float((vshare[m & cmflag] >= 0.10).mean()) * 100, 1)
        if (m & ~cmflag).sum() >= MIN_CELL:
            e["other"] = round(float(vshare[m & ~cmflag].mean()) * 100, 2)
        if pdec_n[d] >= MIN_CELL:
            e["painting"] = round(float(pshare_v[pdec == d].mean()) * 100, 2)
        vivid["decades"][str(d)] = e
    # colors no painting in the corpus gives 1% of its palette
    never = [c for c in range(NC) if PM[:, c].max() < 0.01]
    vivid["neverInPaintings"] = len(never)
    first = []
    for c in never:
        hit = np.where(M[:, c] >= 0.05)[0]
        if len(hit) >= 3:
            ys = sorted(rows[i]["y"] for i in hit)
            ex = sorted(hit, key=lambda i: rows[i]["y"])[:3]
            first.append(dict(c=c, name=names[c], n=int(len(hit)), first=ys[0], p10=ys[min(len(ys) - 1, len(ys) // 10)],
                              median=ys[len(ys) // 2], ex=[[rows[i]["id"], rows[i]["t"][:50], rows[i]["y"], rows[i]["cat"],
                                                           bool(rows[i].get("cm")), round(float(M[i, c]) * 100)] for i in ex]))
    first.sort(key=lambda r: (r["p10"], r["first"]))
    vivid["neverInPaintingsButInDesign"] = first
    com_cols = M[cmflag].mean(0) if cmflag.any() else None
    oth_cols = M[~cmflag].mean(0)
    vivid["nCommercial"] = int(cmflag.sum())
    if com_cols is not None:
        lift = np.where(oth_cols > 0.001, com_cols / np.maximum(oth_cols, 1e-9), 0)
        top = [int(c) for c in np.argsort(-(lift * (com_cols > 0.004)))[:8]]
        vivid["commercialSignature"] = [[c, round(float(com_cols[c]) * 100, 2), round(float(lift[c]), 1)] for c in top]
    (OUT / "vivid.json").write_text(json.dumps(vivid, ensure_ascii=False, separators=(",", ":")))
    series = [(d, vivid["decades"][str(d)]) for d in DECADES]
    com_first = next((d for d, e in series if e.get("commercial") is not None and e["commercial"] >= 6.0), None)
    add("vivid-emergence", "When do vivid modern colors first appear in design?",
        "Share of design area in vivid palette colors (C* >= 60), by decade, as category-balanced / commercial only / "
        "paintings: " + "; ".join(f"{d}s {e.get('balanced', '-')}/{e.get('commercial', '-')}/{e.get('painting', '-')}"
                                  for d, e in series if e.get("balanced") is not None) +
        (f". Commercial design (advertising, posters, packaging, covers, stamps, products) first passes 6% vivid area in the {com_first}s."
         if com_first else ".") + f" Commercial n={int(cmflag.sum())}; the corpus has no in-copyright 1930-1979 product design, so the late decades rest on posters, stamps and covers.",
        len(rows), [[d, e.get("balanced"), e.get("commercial"), e.get("painting"), e["n"], e["nCommercial"]] for d, e in series])
    if first:
        add("never-in-paintings", "Colors painters (in our corpus) never reach 1% with, that design does",
            f"{len(never)} named colors never reach 1% of any painting palette in {len(pr)} public-domain paintings (as photographed). "
            f"{len(first)} of them reach 5% of at least 3 design objects; earliest 10th-percentile year first: " +
            "; ".join(f"{r['name']} ({r['p10']}, n={r['n']})" for r in first[:8]) + ".", len(rows),
            [[r["c"], r["p10"], r["first"], r["n"]] for r in first[:12]])
    if com_cols is not None:
        add("commercial-signature", "The colors of commercial design",
            f"Colors over-represented in commercial design (n={int(cmflag.sum())}) against all other design (n={int((~cmflag).sum())}): " +
            ", ".join(f"{nm(c)} ({l:.1f}x, {s_:.1f}% of area)" for c, s_, l in vivid["commercialSignature"][:6]) + ".", int(cmflag.sum()),
            vivid["commercialSignature"])

    # flags
    fp = OUT / "graph-facts.json"
    if fp.exists():
        gf = json.loads(fp.read_text())
        cnt, tot = Counter(), len(gf["flags"])
        for f in gf["flags"]:
            for col in {c[2] for c in f["c"] if c[3] <= 10}:
                cnt[col] += 1
        if tot:
            top = cnt.most_common(8)
            add("flag-colors", "The colors of the world's national flags",
                f"Of {tot} national flags (Wikidata and Wikimedia Commons files, colors as drawn there), the most common color words "
                f"by nearest name: " + ", ".join(f"{nm(c)} ({n})" for c, n in top) + ".", tot, [[c, n] for c, n in top],
                source="Wikidata")

    (OUT / "superlatives.json").write_text(json.dumps(sup, ensure_ascii=False, separators=(",", ":")))

    # ---- index ---------------------------------------------------------------------------------------------
    src_info = {}
    for s in D.ADAPTERS:
        info = D.ADAPTERS[s].INFO
        src_info[s] = dict(name=info["name"], license=info["license"], api=info["api"], rights=D.RIGHTS[s], n=int((srcs == s).sum()))
    matrix = {c: {str(d): int(((cats == c) & (decs == d)).sum()) for d in DECADES} for c in D.CATS}
    idx = dict(v=1, built=__import__("datetime").date.today().isoformat(), n=len(rows), cats={c: D.CAT_NAME[c] for c in D.CATS},
               catN={c: int(cat_n[c]) for c in D.CATS}, decades=DECADES, decadeN={str(d): dec_n[d] for d in DECADES},
               paintingDecadeN={str(d): pdec_n[d] for d in DECADES}, matrix=matrix, sources=src_info,
               img={s: D.IMG_TPL[s][0] for s in D.IMG_TPL}, url={s: D.URL_TPL[s][0] for s in D.URL_TPL},
               shards=math.ceil(len(slugs) / SHARD), shardSize=SHARD,
               thresholds=dict(minCat=MIN_CAT, minCell=MIN_CELL, minMaker=MIN_MAKER, present=PRESENT),
               weighting="Design shares are category-balanced: the mean of per-category mean area shares over categories with "
                         f">= {MIN_CAT} objects ({', '.join(bal_cats)}). `raw` on a color is the object-weighted share.",
               caveats=["Every color is 'as photographed' or 'as scanned': studio light, paper that has yellowed, dyes that have faded.",
                        "Palettes are 6-color k-means clusters of a 200 px image; a share is area, not an exact pixel statistic.",
                        "Only open (CC0 / public-domain) images are included. In copyright 20th-century design is mostly absent, so 1930-1979 rests "
                        "on posters, stamps, magazine and book covers and advertisements from Wikimedia Commons, the Rijksmuseum, the Art Institute "
                        "of Chicago and the National Postal Museum; the n per cell is in the matrix.",
                        "Cooper Hewitt's Hewitt-family holdings make wallpaper and textiles of 1800-1919 the deepest cells.",
                        "Painting comparison uses the public-domain painting corpus (data/corpus), which thins out after 1900.",
                        "Designer attribution is as catalogued; 'attributed to' is kept, 'workshop of' and 'after' are dropped."])
    (OUT / "index.json").write_text(json.dumps(idx, ensure_ascii=False, separators=(",", ":")))
    print("superlatives:", len(sup))
    for s_ in sup:
        print(" -", s_["title"], "|", s_["text"][:200], "| n =", s_["n"])


if __name__ == "__main__":
    main()
