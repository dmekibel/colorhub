#!/usr/bin/env python3
"""Rich color-page data: two small, lazy-loaded reverse indexes computed once from data already in the repo
(data/analysis/artists/*.json and data/analysis/paintings-*.json + data/gallery/d/*.json), for the 2026-10-08
"every color page is rich" job (David: "opening a random color... sometimes it gives an almost empty page").

Outputs (both lazy-loaded, never in index.html):
  data/analysis/color-artists.json  "<core name>" -> [{a: artist name, s: slug, l: lift, n: artist's paintings,
                                     sh: this artist's own share of that color}, ...] top 5 by lift, support>=4.
                                     Source: each artist file's own `signature` array (lift vs same decade+
                                     country, falling back to country then archive) -- reused as-is, just
                                     inverted from "per artist" to "per color".
  data/analysis/color-pairs.json    "<core name>" -> [{b: other name, l: lift, n: paintings with both}, ...]
                                     top 6 by lift, support>=12. Lift = how much more often the two names share
                                     a painting's named pool than chance (count-based: observed/expected under
                                     independence). Computed fresh here from the per-painting named pool (the
                                     `cm` field in data/analysis/paintings-<shard>.json, aligned positionally
                                     with data/gallery/d/<shard>.json's own `pl` pool) -- the one thing neither
                                     file ships today, because no earlier job needed co-occurrence across the
                                     whole corpus.

Run: python3 tools/build_richdata.py
"""
import json, base64, os, sys, time
from collections import defaultdict, Counter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

CORE = json.load(open("data/core-names.json", encoding="utf-8"))
N_CORE = len(CORE)
CORE_NAMES = [e["n"] for e in CORE]

# ---------------------------------------------------------------- color-artists.json
def build_artists():
    by_name = defaultdict(list)
    adir = "data/analysis/artists"
    files = sorted(os.listdir(adir))
    for fn in files:
        if not fn.endswith(".json"):
            continue
        a = json.load(open(os.path.join(adir, fn), encoding="utf-8"))
        for sig in a.get("signature", []):
            name = sig.get("name")
            lift = sig.get("lift", 0)
            support = sig.get("support", 0)
            if not name or support < 3 or lift < 1.2:
                continue
            by_name[name].append({
                "a": a["name"], "s": a["slug"], "l": round(lift, 2),
                "n": a.get("n", support), "sh": round(sig.get("ownShare", 0), 3),
            })
    out = {}
    for name, rows in by_name.items():
        rows.sort(key=lambda r: -r["l"])
        out[name] = rows[:5]
    json.dump(out, open("data/analysis/color-artists.json", "w", encoding="utf-8"), separators=(",", ":"), ensure_ascii=False)
    print(f"color-artists.json: {len(out)} names, {sum(len(v) for v in out.values())} rows, "
          f"{os.path.getsize('data/analysis/color-artists.json')} bytes")

# ---------------------------------------------------------------- color-pairs.json
def painting_pool(cm_b64, pl_b64, n):
    """-> list of (coreNameIndex, share) for one painting, length n (or less if data is short)."""
    try:
        cm = base64.b64decode(cm_b64) if cm_b64 else b""
        pl = base64.b64decode(pl_b64) if pl_b64 else b""
    except Exception:
        return []
    m = min(n, len(cm) // 2, len(pl) // 4)
    out = []
    for i in range(m):
        code = (cm[i * 2] << 8) | cm[i * 2 + 1]
        idx = code >> 4
        share = pl[i * 4 + 3] / 250.0
        if 0 <= idx < N_CORE:
            out.append((idx, share))
    return out

def build_pairs():
    t0 = time.time()
    single = Counter()      # idx -> # paintings containing it
    pair = Counter()        # (i<j) -> # paintings containing both
    n_paintings = 0
    shard = 0
    while os.path.exists(f"data/analysis/paintings-{shard:03d}.json"):
        arec = json.load(open(f"data/analysis/paintings-{shard:03d}.json", encoding="utf-8"))
        grec = json.load(open(f"data/gallery/d/{shard:03d}.json", encoding="utf-8"))
        for a, g in zip(arec, grec):
            pool = painting_pool(a.get("cm", ""), g[10] if len(g) > 10 else "", a.get("n", 0))
            if not pool:
                continue
            # dedupe within one painting (several pool positions can name the same core color)
            idxs = sorted(set(i for i, _ in pool))
            n_paintings += 1
            for i in idxs:
                single[i] += 1
            for x in range(len(idxs)):
                for y in range(x + 1, len(idxs)):
                    pair[(idxs[x], idxs[y])] += 1
        shard += 1
        if shard % 50 == 0:
            print(f"  shard {shard}, {n_paintings} paintings, {len(pair)} pairs so far, {time.time()-t0:.0f}s", file=sys.stderr)
    print(f"painting pass done: {n_paintings} paintings, {shard} shards, {len(pair)} distinct pairs, {time.time()-t0:.0f}s", file=sys.stderr)

    MIN_SUPPORT, MIN_LIFT = 12, 1.2
    by_name = defaultdict(list)
    for (i, j), cij in pair.items():
        if cij < MIN_SUPPORT:
            continue
        ci, cj = single[i], single[j]
        if not ci or not cj:
            continue
        lift = cij * n_paintings / (ci * cj)
        if lift < MIN_LIFT:
            continue
        ni, nj = CORE_NAMES[i], CORE_NAMES[j]
        by_name[ni].append({"b": nj, "l": round(lift, 2), "n": cij})
        by_name[nj].append({"b": ni, "l": round(lift, 2), "n": cij})
    out = {}
    for name, rows in by_name.items():
        rows.sort(key=lambda r: -r["l"])
        out[name] = rows[:6]
    json.dump(out, open("data/analysis/color-pairs.json", "w", encoding="utf-8"), separators=(",", ":"), ensure_ascii=False)
    print(f"color-pairs.json: {len(out)} names, {sum(len(v) for v in out.values())} rows, "
          f"{os.path.getsize('data/analysis/color-pairs.json')} bytes")

if __name__ == "__main__":
    build_artists()
    build_pairs()
