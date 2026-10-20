#!/usr/bin/env python3
"""Audit one or more artists across every corpus shard (2026-10-20, after Wikidata credited a 1658 painting to Van Gogh).

  python3 tools/audit_artists.py                 # the Tier 1 list below
  python3 tools/audit_artists.py "Claude Monet"  # one artist

Flags, per artist: dates outside the lifespan (+-1), same-title groups (versions of one painting from several museums),
and titles that read as non-paintings (letter, sketchbook, study sheet, photograph...). Prints counts and examples; with
--drop it appends the lifespan outliers to data/corpus-nonpaintings.json (never silently: the reason is written there).
"""
import json, glob, re, sys, collections
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LIFE = {
    "Vincent van Gogh": (1853, 1890), "Claude Monet": (1840, 1926), "Rembrandt van Rijn": (1606, 1669),
    "Johannes Vermeer": (1632, 1675), "J. M. W. Turner": (1775, 1851), "Paul Cézanne": (1839, 1906),
    "Edgar Degas": (1834, 1917), "Pierre-Auguste Renoir": (1841, 1919), "Paul Gauguin": (1848, 1903),
    "Georges Seurat": (1859, 1891), "Édouard Manet": (1832, 1883), "John Singer Sargent": (1856, 1925),
}
ALIAS = {"Paul Cezanne": "Paul Cézanne", "Joseph Mallord William Turner": "J. M. W. Turner", "Hilaire Germain Edgar Degas": "Edgar Degas",
         "Edouard Manet": "Édouard Manet", "Rembrandt Harmensz. van Rijn": "Rembrandt van Rijn"}
for _k, _v in ALIAS.items():
    LIFE.setdefault(_k, LIFE[_v])
NONPAINT = re.compile(r"\b(letter|sketchbook|album|photograph|print|etching|engraving|drawing|sheet of studies|manuscript|stamp|medal)\b", re.I)


def norm_title(t):
    return re.sub(r"[^a-z ]", "", (t or "").lower()).strip()


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    drop = "--drop" in sys.argv
    names = args or list(LIFE)
    rows = collections.defaultdict(list)
    for f in sorted(glob.glob(str(ROOT / "data" / "corpus" / "*.json"))):
        d = json.load(open(f))
        if not isinstance(d, list):
            continue
        for r in d:
            a = ALIAS.get(r.get("a"), r.get("a"))
            if a in names and isinstance(r, dict) and "id" in r:
                rows[a].append(dict(r, _f=Path(f).name))
    out_np = []
    for a in names:
        rs = rows.get(a, [])
        lo, hi = LIFE.get(a, (None, None))
        bad = [r for r in rs if lo and r.get("y") is not None and not (lo - 1 <= r["y"] <= hi + 1)]
        undated = sum(1 for r in rs if r.get("y") is None)
        groups = collections.defaultdict(list)
        for r in rs:
            k = norm_title(r.get("t"))
            if len(k) > 6:
                groups[k].append(r)
        dups = {k: v for k, v in groups.items() if len(v) > 1}
        np_ = [r for r in rs if NONPAINT.search(r.get("t") or "")]
        print(f"\n{a}: {len(rs)} rows | undated {undated} | outside {lo}-{hi}: {len(bad)} | same-title groups: {len(dups)} ({sum(len(v) for v in dups.values())} rows) | non-painting-looking titles: {len(np_)}")
        for r in bad[:6]:
            print(f"   DATE  {r['id']}  {r['y']}  {r['t'][:50]}  [{r['_f']}]")
        for k, v in list(dups.items())[:4]:
            print(f"   DUP   {k[:40]}: " + ", ".join(f"{r['id']}({r['_f'].split('-')[0]})" for r in v[:4]))
        for r in np_[:4]:
            print(f"   TITLE {r['id']}  {r['t'][:60]}")
        out_np += [(a, r) for r in bad]
    if drop and out_np:
        p = ROOT / "data" / "corpus-nonpaintings.json"
        cur = json.load(open(p))
        have = {x["id"] for x in cur}
        for a, r in out_np:
            if r["id"] not in have:
                cur.append({"id": r["id"], "artist": a, "title": r["t"], "reason": f"Dated {r['y']}, outside {a}'s lifetime: a wrong Wikidata attribution (tools/audit_artists.py)."})
        json.dump(cur, open(p, "w"), indent=2, ensure_ascii=False)
        open(p, "a").write("\n")
        print(f"\nappended {len(out_np)} to corpus-nonpaintings.json")


if __name__ == "__main__":
    main()
