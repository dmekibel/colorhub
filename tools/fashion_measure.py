#!/usr/bin/env python3
"""Measured-era stats for Fashion, built from the already-collected garment corpus
(data/fashion/garments.json: 991 museum pieces from the Met and Cleveland Museum of Art,
public domain / CC0). David (2026-10-09): "Fashion decades have one little palette and
tiny articles — not enough. We need as much nuance as possible."

The existing 13 decade pages (data/fashion.js, 1900s-2020s) describe fashionable Paris/
London/New York, but the corpus's western-Europe-and-North-America rows are almost all
dated before 1900 (343 rows; only ~15 fall 1900-1959) -- the open-access collections used
(Met, Cleveland) hold their deepest costume/textile strength in the 1700s-1890s, not the
20th century. Rather than invent precision the corpus doesn't support for 1920s-2020s,
this script measures the period the corpus actually covers well, in the same three eras
`data/fashion/garments.json` already buckets (e2 1700s, e3 1800-1849, e4 1850-1899), and
writes real, sourced multi-palette stats for those. Output feeds a new "Measured eras"
section alongside the existing Decades (js/world.js), honestly separate from the
documented-but-unmeasured 1900s+ decade pages.

Usage: python3 tools/fashion_measure.py
Writes data/fashion/measured-eras.json.
"""
import json, re, collections, statistics

SRC = "data/fashion/garments.json"
OUT = "data/fashion/measured-eras.json"

ERAS = [
    ("e2", "1700s", "1700–1799"),
    ("e3", "1800-1849", "1800–1849"),
    ("e4", "1850-1899", "1850–1899"),
]

DRESS_RX = re.compile(r"\bdress(es)?\b", re.I)
MENS_RX = re.compile(r"\b(waistcoat|coat|breeches|suit|frock coat|doublet|justaucorps|vest)\b", re.I)
ACCESSORY_RX = re.compile(r"\b(shawl|sash|ribbon|glove|stocking|fan|handkerchief|apron|cap|bonnet)\b", re.I)

SHARE_MIN = 0.12  # a color must cover at least this fraction of a garment to count as "present"


def load():
    with open(SRC) as f:
        return json.load(f)


def garment_kind(row):
    t = row.get("t", "")
    if DRESS_RX.search(t):
        return "dress"
    if MENS_RX.search(t):
        return "menswear"
    if ACCESSORY_RX.search(t):
        return "accessory"
    return "other"


def weighted_palette(rows, top_n=8):
    """Aggregate by app color name: total weighted share (sum of share across all rows,
    so it reads as 'share of all measured cloth'), plus how many distinct garments
    carry that name at all (coverage), and one representative hex (share-weighted mean
    isn't color-accurate across very different hues, so we keep the single highest-share
    occurrence's hex as the representative swatch)."""
    total_share = collections.Counter()
    coverage = collections.Counter()
    rep_hex = {}
    rep_share = {}
    for r in rows:
        seen_this_row = set()
        for hexval, share, _lib, name in r["p"]:
            total_share[name] += share
            if name not in seen_this_row:
                coverage[name] += 1
                seen_this_row.add(name)
            if share >= rep_share.get(name, -1):
                rep_share[name] = share
                rep_hex[name] = hexval
    n = len(rows)
    grand_total = sum(total_share.values()) or 1
    ranked = total_share.most_common(top_n)
    return [
        {
            "hex": rep_hex[name],
            "name": name,
            "shareOfCloth": round(total_share[name] / grand_total, 4),
            "pctGarments": round(100 * coverage[name] / n, 1) if n else 0,
        }
        for name, _ in ranked
    ]


NEUTRAL_NAMES = {"Black", "White", "Ivory", "Ecru", "Silver", "Grey", "Gray", "Taupe", "Beige", "Cream", "Umber", "Sepia", "Camel", "Stone", "Charcoal"}


def coverage_map(rows):
    by_name_coverage = collections.Counter()
    for r in rows:
        names = {name for _h, _s, _l, name in r["p"] if _s >= SHARE_MIN}
        for name in names:
            by_name_coverage[name] += 1
    return by_name_coverage


def findings(rows, label):
    n = len(rows)
    out = []
    if n == 0:
        return out
    cov = coverage_map(rows)
    if cov:
        top_name, top_cov = cov.most_common(1)[0]
        out.append(f"{top_name} is the most common visible color, present on {round(100 * top_cov / n)}% of measured {label} pieces (n={n}, as photographed).")
    neutral_garments = sum(1 for r in rows if any(name in NEUTRAL_NAMES and s >= SHARE_MIN for _h, s, _l, name in r["p"]))
    out.append(f"{round(100 * neutral_garments / n)}% show a neutral (black, white, grey, beige or brown family) covering 12% or more of the piece -- expected for aged, faded and often undyed museum textiles, not a claim about how saturated these fabrics looked when new.")
    dress_rows = [r for r in rows if garment_kind(r) == "dress"]
    other_rows = [r for r in rows if garment_kind(r) != "dress"]
    if len(dress_rows) >= 6 and len(other_rows) >= 6:
        dc, oc = coverage_map(dress_rows), coverage_map(other_rows)
        # the name whose dress-share most exceeds its non-dress share
        best, best_gap = None, 0
        for name in set(dc) | set(oc):
            gap = dc.get(name, 0) / len(dress_rows) - oc.get(name, 0) / len(other_rows)
            if gap > best_gap:
                best, best_gap = name, gap
        if best:
            out.append(f"{best} runs noticeably more often in dresses than in the era's other textiles here ({round(100 * dc.get(best, 0) / len(dress_rows))}% vs {round(100 * oc.get(best, 0) / len(other_rows))}%).")
    return out


def cross_era_findings(eras):
    """Compare coverage of the same color name across the three measured eras, so the
    page can say something like 'X appears twice as often in 1850-1899 as in the 1700s'
    instead of three disconnected snapshots."""
    out = []
    covs = {e["id"]: (e["_cov"], e["n"]) for e in eras}
    names = set()
    for cov, _n in covs.values():
        names |= set(cov)
    best = None
    for name in names:
        rates = {eid: (cov.get(name, 0) / n if n else 0) for eid, (cov, n) in covs.items()}
        lo_id = min(rates, key=lambda k: rates[k])
        hi_id = max(rates, key=lambda k: rates[k])
        if rates[lo_id] > 0.03 and rates[hi_id] / max(rates[lo_id], 1e-9) >= 2.2:
            gap = rates[hi_id] - rates[lo_id]
            if best is None or gap > best[0]:
                best = (gap, name, hi_id, lo_id, rates[hi_id], rates[lo_id])
    if best:
        _gap, name, hi_id, lo_id, hi_rate, lo_rate = best
        out.append(f"{name} shows up on {round(100 * hi_rate)}% of measured {hi_id} pieces here, versus {round(100 * lo_rate)}% in {lo_id} -- a real shift in this corpus, not necessarily in every wardrobe of the time.")
    return out


def build():
    d = load()
    rows_all = [r for r in d["rows"] if r["g"] == "western"]
    out_eras = []
    for era_key, era_id, years in ERAS:
        rows = [r for r in rows_all if r["e"] == era_key]
        n = len(rows)
        kinds = collections.Counter(garment_kind(r) for r in rows)
        by_kind = {}
        for kind in ("dress", "menswear", "accessory", "other"):
            krows = [r for r in rows if garment_kind(r) == kind]
            if len(krows) >= 4:
                by_kind[kind] = {"n": len(krows), "palette": weighted_palette(krows)}
        museums = collections.Counter(r["mu"] for r in rows)
        # a varied gallery: spread across kinds rather than just "most saturated first"
        def gkey(r):
            return garment_kind(r), -max(s for _h, s, _l, _n in r["p"])
        gallery = sorted(rows, key=gkey)
        picked, seen_kind = [], collections.Counter()
        for r in gallery:
            k = garment_kind(r)
            if seen_kind[k] >= 9:
                continue
            seen_kind[k] += 1
            picked.append(r)
            if len(picked) >= 18:
                break
        out_eras.append({
            "id": era_id,
            "years": years,
            "n": n,
            "museums": dict(museums),
            "palette": weighted_palette(rows),
            "byKind": by_kind,
            "findings": findings(rows, years),
            "_cov": coverage_map(rows),
            "gallery": [
                {"id": r["id"], "img": r["img"], "mu": r["mu"], "t": r["t"], "d": r["d"], "cul": r.get("cul", ""), "url": r["url"], "kind": garment_kind(r), "p": r["p"]}
                for r in picked
            ],
        })
    cross = cross_era_findings(out_eras)
    for e in out_eras:
        del e["_cov"]
    meta = {
        "built": "2026-10-09",
        "method": "tools/fashion_measure.py, from data/fashion/garments.json (the Met + Cleveland Museum of Art "
                  "open-access corpus, 991 pieces). Western-group rows only, bucketed into the same eras the "
                  "garment archive already uses. A color counts as present on a garment at 12% of its measured "
                  "area or more; 'share of cloth' sums that color's share across every garment in the bucket. "
                  "These are photographs of (often faded or discolored) historical textiles, not swatches off "
                  "a dye book, and the collections are not a random sample of what people wore -- they skew to "
                  "pieces wealthy enough, or well-preserved enough, to survive and be collected.",
    }
    with open(OUT, "w") as f:
        json.dump({"meta": meta, "eras": out_eras, "crossEraFindings": cross}, f, ensure_ascii=False, separators=(",", ":"))
    for e in out_eras:
        print(e["id"], "n=", e["n"], "kinds=", {k: v["n"] for k, v in e["byKind"].items()}, "top=", e["palette"][0] if e["palette"] else None)


if __name__ == "__main__":
    build()
