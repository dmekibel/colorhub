#!/usr/bin/env python3
"""Per-decade fashion color stats, 1700s-2020s, combining every source this repo has:
  - data/fashion/garments.json: the Met + Cleveland Museum of Art CC0/PD corpus (tools/fashion.py).
    Rights-cleared: its rows can be shown as photos in the gallery.
  - data/fashion/va-measured.json: the V&A Collections API, measure-only (tools/fashion_va.py). Its images
    are (c) Victoria and Albert Museum and were never kept -- these rows carry hex values and metadata only,
    and contribute to palettes and counts but never to the photo gallery.

David (2026-10-09), after the first pass only covered 1700s/1800-49/1850-99 from 991 CC0 pieces: "A couple
palettes from a couple garments is not true archive data." This version buckets every real year 1700-2029
into its decade, reports the ACTUAL combined count per decade (so a thin decade reads as thin, not padded),
and only computes a garment-kind split (dress / menswear / accessory / other) where that slice has enough
pieces (>=8) to mean anything.

Run: python3 tools/fashion_measure.py
Writes data/fashion/measured-decades.json (gallery entries still carry full image URLs, but only for CC0/PD
rows -- a V&A row never gets an "img" key, so js/world.js can never accidentally display one).
"""
import json, re, collections

ROOT_GARMENTS = "data/fashion/garments.json"
ROOT_VA = "data/fashion/va-measured.json"
OUT = "data/fashion/measured-decades.json"

DECADES = list(range(1700, 2021, 10))
SHARE_MIN = 0.12
NEUTRAL_NAMES = {"Black", "White", "Ivory", "Ecru", "Silver", "Grey", "Gray", "Taupe", "Beige", "Cream", "Umber", "Sepia", "Camel", "Stone", "Charcoal"}

DRESS_RX = re.compile(r"\bdress(es)?\b", re.I)
MENS_RX = re.compile(r"\b(waistcoat|coat|breeches|suit|frock coat|doublet|justaucorps|vest|trousers?)\b", re.I)
ACCESSORY_RX = re.compile(r"\b(shawl|sash|ribbon|glove|stocking|fan|handkerchief|apron|cap|bonnet)\b", re.I)


def decade_of(y):
    return (y // 10) * 10


def garment_kind(title, ot=None):
    t = (ot or title or "")
    if DRESS_RX.search(t) or (ot and ot.strip().lower() == "dress"):
        return "dress"
    if MENS_RX.search(t):
        return "menswear"
    if ACCESSORY_RX.search(t):
        return "accessory"
    return "other"


def load():
    cc0 = []
    try:
        d = json.load(open(ROOT_GARMENTS))
        for r in d["rows"]:
            if r["g"] != "western" or r.get("y") is None:
                continue
            cc0.append(dict(id=r["id"], t=r["t"], ot=None, y=r["y"], p=r["p"], src="cc0",
                             img=r["img"], mu=r["mu"], d=r.get("d"), cul=r.get("cul"), url=r["url"]))
    except FileNotFoundError:
        pass
    va = []
    try:
        d = json.load(open(ROOT_VA))
        for r in d["rows"]:
            va.append(dict(id=r["id"], t=r["t"], ot=r.get("ot"), y=r["y"], p=r["p"], src="va",
                            img=None, mu="va", d=r.get("d"), cul=r.get("place"), url=r.get("url")))
    except FileNotFoundError:
        pass
    return cc0, va


def weighted_palette(rows, top_n=8):
    total_share, coverage, rep_hex, rep_share = collections.Counter(), collections.Counter(), {}, {}
    for r in rows:
        seen = set()
        for hexval, share, _lib, name in r["p"]:
            total_share[name] += share
            if name not in seen:
                coverage[name] += 1
                seen.add(name)
            if share >= rep_share.get(name, -1):
                rep_share[name] = share
                rep_hex[name] = hexval
    n = len(rows)
    grand = sum(total_share.values()) or 1
    ranked = total_share.most_common(top_n)
    return [dict(hex=rep_hex[name], name=name, shareOfCloth=round(total_share[name] / grand, 4),
                 pctGarments=round(100 * coverage[name] / n, 1) if n else 0) for name, _ in ranked]


def coverage_map(rows):
    cov = collections.Counter()
    for r in rows:
        for name in {name for _h, s, _l, name in r["p"] if s >= SHARE_MIN}:
            cov[name] += 1
    return cov


def findings(rows, label):
    n = len(rows)
    out = []
    if n < 8:
        return out
    cov = coverage_map(rows)
    if cov:
        top_name, top_cov = cov.most_common(1)[0]
        out.append(f"{top_name} is the most common visible color, present on {round(100 * top_cov / n)}% of the {n} measured {label} pieces here.")
    neutral = sum(1 for r in rows if any(name in NEUTRAL_NAMES and s >= SHARE_MIN for _h, s, _l, name in r["p"]))
    out.append(f"{round(100 * neutral / n)}% show a neutral (black, white, grey, beige or brown family) covering 12% or more of the piece.")
    cc0_n = sum(1 for r in rows if r["src"] == "cc0")
    va_n = n - cc0_n
    if cc0_n and va_n:
        out.append(f"{cc0_n} from CC0/public-domain museum photographs (Met, Cleveland), {va_n} measured from the V&A's catalogue (colors only -- its photographs are not public domain, so they aren't shown here).")
    return out


ERA_BANDS = [("1700s", 1700, 1799), ("1800-1849", 1800, 1849), ("1850-1899", 1850, 1899)]


def build_eras(all_rows):
    """The three long-form 'deep read' pages (data/fashion-eras.js) still want one wide palette + findings +
    gallery each, now drawn from the combined cc0+va rows (a V&A row never enters the gallery, same rule as
    the decade cards)."""
    out = []
    for era_id, lo, hi in ERA_BANDS:
        rows = [r for r in all_rows if lo <= r["y"] <= hi]
        cc0_rows = [r for r in rows if r["src"] == "cc0"]
        n = len(rows)
        by_kind = {}
        for kind in ("dress", "menswear", "accessory", "other"):
            krows = [r for r in rows if garment_kind(r["t"], r.get("ot")) == kind]
            if len(krows) >= 8:
                by_kind[kind] = dict(n=len(krows), palette=weighted_palette(krows))
        gallery = sorted(cc0_rows, key=lambda r: -max(s for _h, s, _l, _n in r["p"]))[:18]
        out.append(dict(
            id=era_id, n=n, nCc0=len(cc0_rows), nVa=n - len(cc0_rows),
            palette=weighted_palette(rows),
            byKind=by_kind,
            findings=findings(rows, era_id),
            gallery=[dict(id=r["id"], img=r["img"], mu=r["mu"], t=r["t"], d=r["d"], cul=r["cul"], url=r["url"], p=r["p"]) for r in gallery],
        ))
    return out


def build():
    cc0, va = load()
    all_rows = cc0 + va
    by_decade = collections.defaultdict(list)
    for r in all_rows:
        dec = decade_of(r["y"])
        if 1700 <= dec <= 2020:
            by_decade[dec].append(r)

    out_eras = build_eras(all_rows)
    out_decades = []
    for dec in DECADES:
        rows = by_decade.get(dec, [])
        n = len(rows)
        cc0_rows = [r for r in rows if r["src"] == "cc0"]
        va_rows = [r for r in rows if r["src"] == "va"]
        by_kind = {}
        for kind in ("dress", "menswear", "accessory", "other"):
            krows = [r for r in rows if garment_kind(r["t"], r.get("ot")) == kind]
            if len(krows) >= 8:
                by_kind[kind] = dict(n=len(krows), palette=weighted_palette(krows))
        gallery_src = sorted(cc0_rows, key=lambda r: -max(s for _h, s, _l, _n in r["p"]))[:14]
        coverage = "thick" if n >= 60 else "thin" if n >= 8 else "bare"
        out_decades.append(dict(
            id=f"{dec}s", decade=dec, n=n, nCc0=len(cc0_rows), nVa=len(va_rows), coverage=coverage,
            palette=weighted_palette(rows) if n >= 4 else [],
            byKind=by_kind,
            findings=findings(rows, f"{dec}s"),
            gallery=[dict(id=r["id"], img=r["img"], mu=r["mu"], t=r["t"], d=r["d"], cul=r["cul"], url=r["url"], p=r["p"])
                     for r in gallery_src],
        ))

    meta = dict(
        built="2026-10-09",
        method="tools/fashion_measure.py, combining data/fashion/garments.json (CC0/PD: Met + Cleveland Museum "
               "of Art) and data/fashion/va-measured.json (V&A Collections API, measure-only -- colors kept, "
               "photographs never stored). Every item is bucketed by its own year into a real decade, 1700-2020; "
               "a decade with fewer than 8 western garments in this corpus is marked 'bare' and shown with a "
               "count but no palette claim; 8-59 is 'thin' (a palette, heavily caveated); 60+ is 'thick'.",
        totalItems=len(all_rows), totalCc0=len(cc0), totalVa=len(va),
    )
    with open(OUT, "w") as f:
        json.dump({"meta": meta, "decades": out_decades, "eras": out_eras}, f, ensure_ascii=False, separators=(",", ":"))
    print(f"{OUT}: {len(all_rows)} items total ({len(cc0)} CC0, {len(va)} V&A measure-only)")
    for d in out_decades:
        print(f"  {d['id']}: n={d['n']:4d} (cc0={d['nCc0']:4d} va={d['nVa']:4d}) {d['coverage']:5s} kinds={ {k: v['n'] for k, v in d['byKind'].items()} }")


if __name__ == "__main__":
    build()
