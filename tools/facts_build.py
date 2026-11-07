#!/usr/bin/env python3
"""data/gallery/facts/: Wikidata facts per painting (2026-11-07: the facts block on the painting page).

  python3 tools/facts_build.py     run after tools/gallery.py (rebuild_all.sh does); positions follow data/gallery/ids.txt

Corpus rows (data/corpus/*.json) carry mu (museum), city, size ([height, width] in cm), medium, genre (list of labels), qid and fame.
The gallery data does not, so this writes compact shards keyed by gallery position (line number in ids.txt), PER positions each:
  data/gallery/facts/<n>.json    {"o": first position, "t": [strings], "r": [row | 0, ...]}
      row = [museum, city, h, w, medium, genre, qid]   museum/city/medium/genre are indexes into "t" (-1 = none), h/w in cm (0 = none), qid a number (0 = none)
  data/gallery/facts/index.json  {"n": rows, "ids": sha1[:12] of ids.txt (same stamp as kinds.json), "per": PER}
A row with no fact at all is 0. When several corpus rows share an id, the one with the most facts wins.
"""
import glob, hashlib, json
from pathlib import Path

PER = 2000
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data/gallery/facts"


def clean(s, n=80):
    s = " ".join(str(s or "").split())
    return s[:n] if s else ""


def num(v):
    try:
        v = float(v)
    except (TypeError, ValueError):
        return 0
    if v <= 0 or v > 3000:
        return 0
    v = round(v, 1)
    return int(v) if v == int(v) else v


def row_of(r):
    mu, city, med = clean(r.get("mu"), 70), clean(r.get("city"), 40), clean(r.get("medium"), 70)
    g = r.get("genre")
    gen = clean("; ".join(str(x) for x in g if x) if isinstance(g, list) else g, 60)
    sz = r.get("size")
    h = w = 0
    if isinstance(sz, (list, tuple)) and len(sz) >= 2:
        h, w = num(sz[0]), num(sz[1])
        if not (h and w):
            h = w = 0
    q = str(r.get("qid") or "")
    q = int(q[1:]) if q[:1] == "Q" and q[1:].isdigit() else 0
    if not (mu or city or med or gen or h or q):
        return None
    return [mu, city, h, w, med, gen, q]


def main():
    raw = (ROOT / "data/gallery/ids.txt").read_bytes()
    ids = [i for i in raw.decode().split("\n") if i]
    pos = {k: n for n, k in enumerate(ids)}
    best = {}
    for f in sorted(glob.glob(str(ROOT / "data/corpus/*.json"))):
        try:
            rows = json.load(open(f, encoding="utf-8"))
        except Exception:
            continue
        for r in rows if isinstance(rows, list) else []:
            if not isinstance(r, dict) or r.get("id") not in pos:
                continue
            fr = row_of(r)
            if not fr:
                continue
            p = pos[r["id"]]
            score = sum(1 for x in fr if x)
            if p not in best or score > best[p][0]:
                best[p] = (score, fr)
    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob("*.json"):
        old.unlink()
    total = 0
    for s in range((len(ids) + PER - 1) // PER):
        o = s * PER
        table, tix, rows = [], {}, []

        def ti(x):
            if not x:
                return -1
            if x not in tix:
                tix[x] = len(table)
                table.append(x)
            return tix[x]

        for p in range(o, min(o + PER, len(ids))):
            b = best.get(p)
            if not b:
                rows.append(0)
                continue
            mu, city, h, w, med, gen, q = b[1]
            rows.append([ti(mu), ti(city), h, w, ti(med), ti(gen), q])
            total += 1
        while rows and rows[-1] == 0:
            rows.pop()
        (OUT / f"{s}.json").write_text(json.dumps({"o": o, "t": table, "r": rows}, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    idx = {"n": len(ids), "ids": hashlib.sha1(raw).hexdigest()[:12], "per": PER}
    (OUT / "index.json").write_text(json.dumps(idx, separators=(",", ":")) + "\n")
    size = sum(f.stat().st_size for f in OUT.glob("*.json"))
    print(f"facts: {total:,} of {len(ids):,} paintings have facts; {size/1e6:.2f} MB in {len(list(OUT.glob('*.json'))) - 1} shards")


if __name__ == "__main__":
    main()
