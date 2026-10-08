#!/usr/bin/env python3
"""Field notes for the article engine: what our own data says about one color.

    python3 tools/article_field.py "#CC3336" [--de 6] [--min 0.05] [--ngram madder] [--json]

Reads only the repo's own data (data/gallery index.bin + detail shards, data/library.json) and, when present,
the private Ngram cache in the main checkout's research/_raw/ngrams (never committed). Prints a compact JSON
block that a writer copies into data/articles/<slug>.json "field" and quotes in the prose, always with
"as photographed" and the n.

What counts as "in a painting": one of the painting's six area colors lies within --de (CIEDE2000, default 6)
of the target, and those matching colors together cover at least --min (default 5%) of the canvas. That is the
same honesty gate the Journey uses. A match says a *screen color near this one* was photographed there. It never
proves a pigment: a madder-red patch may be vermilion, and a Prussian-blue-looking shadow may be indigo or soot.

Outputs (all "as photographed", museum photographs of aged, varnished paintings):
  n_archive, n_present, rate          how many of the 23,531 paintings carry it
  top[]                               the paintings where it covers the most canvas
  first                               the earliest dated painting that carries it
  by_century[], peak_decade           rate per century / decade, lift against the archive's rate
  painters[]                          painters with >= 12 dated works, ranked by lift (support >= 3)
  countries[], movements[]            the same, n >= 25
  role                                where it sits in its paintings' lightness order: shadow / mid / highlight
  company[]                           the color words that share its canvases more than chance (lift, support)
  surprises[]                         data-born hooks (genius panel L7): lift >= 3 with support >= 20, or a
                                      percentile >= 95, each with its caveat
  ngram                               when the word was most printed (Google Books, case-insensitive)
"""
import argparse, base64, json, math, sys
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
from library import labs, de2000  # noqa: E402

GAL = ROOT / "data" / "gallery"
# The Ngram cache lives in the main checkout (gitignored). A worktree finds it two levels up.
NGRAM_DIRS = [ROOT / "research" / "_raw" / "ngrams", ROOT.parents[2] / "research" / "_raw" / "ngrams"
              if len(ROOT.parents) > 2 else ROOT]


def load_index():
    head = json.loads((GAL / "index.json").read_text())
    b = np.frombuffer((GAL / "index.bin").read_bytes(), dtype=np.uint8)
    n, rec = head["n"], head["rec"]
    b = b[: n * rec].reshape(n, rec)
    y = b[:, 0].astype(np.int32) | (b[:, 1].astype(np.int32) << 8)
    year = np.where(y > 0, y - head["year0"], -99999)
    L = b[:, 4] / 2.5
    cols = b[:, 6:30].reshape(n, 6, 4)
    rgb = cols[:, :, :3].reshape(-1, 3)
    hexes = ["#%02X%02X%02X" % tuple(int(v) for v in r) for r in rgb]
    lab = labs(hexes).reshape(n, 6, 3)
    share = cols[:, :, 3] / 250.0
    return head, year, L, lab, share


def load_details(n, shard):
    rows = []
    for k in range(math.ceil(n / shard)):
        rows += json.loads((GAL / "d" / f"{k:03d}.json").read_text())
    return rows


def ngram(word):
    for d in NGRAM_DIRS:
        p = d / ("n1800__" + word.replace(" ", "%20") + ".json")
        if p.exists():
            j = json.loads(p.read_text())
            ts, y0 = j.get("ts") or [], j.get("y0", 1800)
            if not ts or not any(ts):
                return None
            # 5-year smoothing so one OCR blip doesn't become a "peak"
            sm = [sum(ts[max(0, i - 2): i + 3]) / len(ts[max(0, i - 2): i + 3]) for i in range(len(ts))]
            pk = max(range(len(sm)), key=sm.__getitem__)
            first = next((i for i in range(len(sm)) if sm[i] > sm[pk] * 0.05), None)
            pts = {str(y0 + i): round(sm[i] / sm[pk], 3) for i in range(0, len(sm), 20)}
            return dict(word=word, peak=y0 + pk, first_5pct=None if first is None else y0 + first,
                        rel=pts, src="Google Books Ngram (case-insensitive, 5-yr smoothed, relative to peak)")
    return None


_CACHE = {}


def compute(hex_, de=6.0, min_cover=0.05, ngrams=(), top_n=6):
    """All field notes for one hex, as a dict (see the module docstring)."""
    if "index" not in _CACHE:
        _CACHE["index"] = load_index()
    head, year, Lmean, lab, share = _CACHE["index"]
    n = len(year)
    t = labs([hex_])[0]
    d = de2000(lab.reshape(-1, 3), t[None, :]).reshape(n, 6)
    hit = d <= de
    cov = (share * hit).sum(1)
    present = cov >= min_cover
    rate = present.mean()
    if "det" not in _CACHE:
        _CACHE["det"] = load_details(n, head["shard"])
    det = _CACHE["det"]
    app = head["app"]

    def info(i):
        r = det[i]
        return dict(id=r[0], title=r[1], painter=r[2], year=int(year[i]) if year[i] > -9999 else None,
                    cover=round(float(cov[i]), 3))

    order = np.argsort(-cov)
    top = [info(i) for i in order[:top_n] if present[i]]
    dated = np.where(present & (year > -9999))[0]
    first = info(dated[np.argmin(year[dated])]) if len(dated) else None

    def group(keyf, minn):
        tot, hitc = Counter(), Counter()
        for i in range(n):
            k = keyf(i)
            if k is None:
                continue
            tot[k] += 1
            hitc[k] += bool(present[i])
        out = []
        for k, m in tot.items():
            if m >= minn:
                r = hitc[k] / m
                out.append(dict(key=k, n=m, hits=hitc[k], rate=round(r, 3), lift=round(r / rate, 2) if rate else None))
        return out

    cent = sorted(group(lambda i: int(year[i] // 100 * 100) if year[i] > -9999 else None, 25), key=lambda x: x["key"])
    dec = group(lambda i: int(year[i] // 10 * 10) if year[i] > -9999 else None, 25)
    dec = [x for x in dec if x["hits"] >= 5]
    peak_dec = max(dec, key=lambda x: x["rate"]) if dec else None
    painters = [p for p in group(lambda i: det[i][2] or None, 12) if p["hits"] >= 3]
    painters.sort(key=lambda x: (-x["lift"], -x["hits"]))
    countries = sorted(group(lambda i: det[i][3] or None, 25), key=lambda x: -x["lift"])[:5]
    moves = sorted(group(lambda i: det[i][4] or None, 20), key=lambda x: -x["lift"])[:5]

    # role: the target's lightness rank among the painting's six colors
    roles = Counter()
    for i in np.where(present)[0]:
        Ls = lab[i, :, 0]
        j = int(np.argmin(d[i]))
        rank = (Ls < Ls[j]).sum() / 5.0
        roles["shadow" if rank < 0.34 else "highlight" if rank > 0.66 else "mid"] += 1
    tot_r = sum(roles.values()) or 1
    role = {k: round(v / tot_r, 2) for k, v in roles.items()}

    # company: app words on the same canvases (from each painting's six app words), lift vs archive
    base, withc = Counter(), Counter()
    npres = int(present.sum())
    for i in range(n):
        words = {app[w] for w in det[i][8]} if det[i][8] else set()
        for w in words:
            base[w] += 1
            if present[i]:
                withc[w] += 1
    company = []
    for w, c in withc.items():
        if c >= 20 and npres:
            lift = (c / npres) / (base[w] / n)
            company.append(dict(word=w, hits=c, lift=round(lift, 2)))
    company.sort(key=lambda x: -x["lift"])

    surprises = []
    for p in painters[:5]:
        if p["lift"] >= 3 and p["hits"] >= 20:
            surprises.append(f"{p['key']}: {p['hits']} of {p['n']} paintings carry it, {p['lift']}x the archive rate")
    for c in cent:
        if c["lift"] >= 3 and c["hits"] >= 20:
            surprises.append(f"{c['key']}s: {c['lift']}x the archive rate ({c['hits']} of {c['n']})")
    for c in countries + moves:
        if c["lift"] >= 3 and c["hits"] >= 20:
            surprises.append(f"{c['key']}: {c['hits']} of {c['n']} works carry it, {c['lift']}x the archive rate")

    return dict(
        hex=hex_, de=de, min_cover=min_cover, n_archive=n, n_present=npres, rate=round(float(rate), 4),
        caveat="As photographed: museum photographs of aged, varnished paintings. A color match, not a pigment test.",
        top=top, first=first, by_century=cent, peak_decade=peak_dec, painters=painters[:8],
        countries=countries, movements=moves, role=role, company=company[:8], surprises=surprises,
        ngram=[g for g in (ngram(w) for w in ngrams) if g],
    )


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("hex")
    ap.add_argument("--de", type=float, default=6.0)
    ap.add_argument("--min", type=float, default=0.05)
    ap.add_argument("--ngram", action="append", default=[])
    ap.add_argument("--top", type=int, default=6)
    a = ap.parse_args()
    out = compute(a.hex, a.de, a.min, a.ngram, a.top)
    print(json.dumps(out, ensure_ascii=False, separators=(",", ":")).replace("},{", "},\n {").replace('],"', '],\n"'))


if __name__ == "__main__":
    main()
