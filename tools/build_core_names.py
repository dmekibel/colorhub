#!/usr/bin/env python3
"""ColorHub core names: the one unified naming list (ROADMAP.md §13 "One naming system", "Why 1,000 and not
2,700"). Merges data/library.json's 2,711 names into about 1,000 distinct, primary-named colors.

  python3 tools/build_core_names.py           # writes data/core-names.json
  python3 tools/build_core_names.py --report  # also prints cluster counts and a coverage check

Rule (one distinct color = one primary name): near-identical names (CIEDE2000 below MERGE_DE, about 2.5) merge
into one entry. The most common English name wins: app > xkcd > css/wiki > werner/ral > ridgway (reusing
tools/library.py's silly-name detector to skip obscure/awkward names as primaries when a plainer one is close).
The rest become `also` synonyms. A Japanese name is the primary only when no English name is within JP_MERGE_DE
(about 4); otherwise it's a cultural `notes` entry on the nearest color. The app's own 101 colors (data/colors.js)
are always present with their exact name and hex, and never merge into anything else.

Coverage: after the distinctness merge, if there are still clearly more than ~1,000 good colors, the list is
trimmed to TARGET by farthest-point selection in Lab space (the 101 app colors are never dropped); a trimmed
color's name survives as an `also` synonym on whichever final color is now nearest it, so no name just vanishes.

Deterministic: every sort key is explicit (no dict-order or randomness), so the same inputs always give the
same output.
"""
import json, re, sys
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
import library as LIB  # noqa: E402  (color math, title/key, load_app, load_library, silly_names)

OUT = ROOT / "data" / "core-names.json"
MERGE_DE = 2.5     # near-identical names merge into one entry
JUNK_SKIP_DE = 4.0  # an obscure/awkward name only becomes a primary if nothing plainer is at least this close
JP_MERGE_DE = 4.0  # a Japanese name is a primary only when no English name is this close
TARGET = 1000      # aim for about this many; fewer is fine if distinctness gives less
ALSO_CAP = 10      # keep the file well under 150 KB
NOTES_CAP = 3

SRC_RANK = {"app": 0, "xkcd": 1, "css": 2, "wiki": 2, "werner": 3, "ral": 3, "ridgway": 4, "jp": 5}


def src_rank(srcs):
    return min((SRC_RANK.get(s, 6) for s in srcs), default=6)


def junk_penalty(name, silly):
    """Downranks obscure/awkward names as primaries (ROADMAP §13: "no obscure or awkward names ... when a
    plainer English name sits within about ΔE 4"). Doesn't exclude them outright: a junky name can still win
    if nothing plainer is close enough (library.py's silly_names is itself about painting-label fitness, a
    good proxy for "a normal person would say this")."""
    p = 0
    if name in silly:
        p += 5
    if re.search(r"[()#]", name):
        p += 3
    if len(re.split(r"[ -]", name)) > 2:
        p += 2
    if re.search(r"\bish\b", name, re.I):
        p += 1
    return p


def rank_key(e, silly):
    return (src_rank(e["src"]), junk_penalty(e["n"], silly), e["n"])


def main():
    report = "--report" in sys.argv[1:]
    app_rows = LIB.load_app()  # [{n, h, src}], curriculum order: basics, then every unit's colors in order
    lib = [e for e in LIB.load_library() if not e.get("crude")]
    silly = LIB.silly_names(lib)

    app_keys = {LIB.key(e["n"]) for e in app_rows}
    lib_by_key = {LIB.key(e["n"]): e for e in lib}
    jp_only = [e for e in lib if e["src"] == ["jp"]]
    rest = [e for e in lib if LIB.key(e["n"]) not in app_keys and e["src"] != ["jp"]]

    # ---------- clusters: {n, h, lab, locked, src, also: [(name, srcs)], notes: [{jp,kanji,meaning}]} ----------
    clusters = []
    centers = None  # numpy (k,3), kept in lockstep with `clusters`

    def add_cluster(name, hexv, labv, srcs, locked=False):
        nonlocal centers
        clusters.append({"n": name, "h": hexv, "lab": labv, "locked": locked, "src": list(srcs), "also": [], "notes": []})
        centers = labv[None] if centers is None else np.vstack([centers, labv[None]])

    # 1. the 101 app colors, always present, exact name and hex, never merged into anything else
    for row in app_rows:
        n, h = row["n"], row["h"]
        e = lib_by_key.get(LIB.key(n))
        add_cluster(n, h, LIB.labs([h])[0], e["src"] if e else ["app"], locked=True)

    # 2. every other English-sourced name, best-named first, merged into the nearest cluster within MERGE_DE
    rest.sort(key=lambda e: rank_key(e, silly))
    for e in rest:
        lab_e = LIB.labs([e["h"]])[0]
        d = LIB.de2000(lab_e[None], centers)[0]
        j = int(np.argmin(d))
        # a plainly obscure/awkward name needs a wider berth from an existing, better-named color before it
        # gets to be its own primary (ROADMAP §13: "no obscure or awkward names as primaries ... when a
        # plainer English name sits within about ΔE 4")
        threshold = JUNK_SKIP_DE if junk_penalty(e["n"], silly) > 0 else MERGE_DE
        if d[j] < threshold:
            if e["n"] != clusters[j]["n"]:
                clusters[j]["also"].append((e["n"], e["src"], round(float(d[j]), 1)))
        else:
            add_cluster(e["n"], e["h"], lab_e, e["src"])

    # 3. Japanese names: a cultural note on the nearest color if one is close; otherwise its own primary,
    #    romanized with a short meaning ("Ebizome (vine grape)"), and learnable like any other color.
    jp_only.sort(key=lambda e: e["n"])
    for e in jp_only:
        jp = e["jp"]
        lab_e = LIB.labs([e["h"]])[0]
        d = LIB.de2000(lab_e[None], centers)[0]
        j = int(np.argmin(d))
        note = {"jp": jp["romaji"], "kanji": jp["kanji"], "meaning": jp["meaning"]}
        if d[j] < JP_MERGE_DE:
            if len(clusters[j]["notes"]) < NOTES_CAP:
                clusters[j]["notes"].append(note)
        else:
            meaning = jp["meaning"].split("(")[0].strip().lower() if jp["meaning"] else ""  # short; never nest parens
            name = f"{jp['romaji']} ({meaning})" if meaning else jp["romaji"]
            add_cluster(name, e["h"], lab_e, e["src"])
            clusters[-1]["notes"].append(note)

    merged_count = len(clusters)

    # ---------- coverage: trim to ~TARGET by farthest-point selection, locked colors always kept ----------
    locked = [c for c in clusters if c["locked"]]
    free = [c for c in clusters if not c["locked"]]
    budget = TARGET - len(locked)
    dropped = []
    if budget < len(free):
        free.sort(key=lambda c: (src_rank(c["src"]), junk_penalty(c["n"], silly), c["n"]))  # stable tie-break
        free_lab = np.array([c["lab"] for c in free])
        locked_lab = np.array([c["lab"] for c in locked])
        dmin = LIB.de2000(free_lab, locked_lab).min(1)
        chosen = np.zeros(len(free), bool)
        for _ in range(budget):
            # among the farthest-from-selected, prefer the better-named one (first in the stable sort)
            best = float(dmin[~chosen].max())
            cand = [i for i in range(len(free)) if not chosen[i] and dmin[i] >= best - 1e-9]
            pick = cand[0]
            chosen[pick] = True
            d_pick = LIB.de2000(free_lab, free_lab[pick][None])[:, 0]
            dmin = np.minimum(dmin, d_pick)
        kept = [free[i] for i in range(len(free)) if chosen[i]]
        dropped = [free[i] for i in range(len(free)) if not chosen[i]]
        # a dropped color's name isn't lost: it becomes a synonym of whichever surviving color is now nearest it
        survivors = locked + kept
        surv_lab = np.array([c["lab"] for c in survivors])
        for c in dropped:
            d = LIB.de2000(c["lab"][None], surv_lab)[0]
            j = int(np.argmin(d))
            survivors[j]["also"].append((c["n"], c["src"], round(float(d[j]), 1)))
            survivors[j]["also"].extend(c["also"])
        clusters = survivors
    else:
        kept = free

    # ---------- order and rank: the app's 101 first (curriculum order), then the rest by commonness ----------
    app_order = {LIB.key(row["n"]): i for i, row in enumerate(app_rows)}
    locked_sorted = sorted([c for c in clusters if c["locked"]], key=lambda c: app_order.get(LIB.key(c["n"]), 999))
    free_sorted = sorted([c for c in clusters if not c["locked"]], key=lambda c: (src_rank(c["src"]), junk_penalty(c["n"], silly), c["n"]))
    final = locked_sorted + free_sorted

    out = []
    for i, c in enumerate(final):
        also = sorted(set(a[0] for a in c["also"]) - {c["n"]}, key=lambda n: next((a[2] for a in c["also"] if a[0] == n), 99))[:ALSO_CAP]
        entry = {"n": c["n"], "h": c["h"], "src": c["src"], "rank": i}
        if also:
            entry["also"] = also
        if c["notes"]:
            entry["notes"] = c["notes"][:NOTES_CAP]
        out.append(entry)

    lines = [json.dumps(e, ensure_ascii=False, separators=(",", ":")) for e in out]
    OUT.write_text("[\n" + ",\n".join(lines) + "\n]\n", encoding="utf-8")
    size_kb = OUT.stat().st_size / 1024
    print(f"core-names.json: {len(out)} entries ({merged_count} after merge, {len(dropped)} trimmed), {size_kb:.1f} KB")
    out_keys = {LIB.key(e["n"]) for e in out}
    missing = [row["n"] for row in app_rows if LIB.key(row["n"]) not in out_keys]
    if missing:
        print("MISSING app colors:", missing)
    if report:
        jp_primaries = sum(1 for e in out if e.get("notes") and not e.get("src") == ["app"] and "(" in e["n"])
        print(f"jp-only primaries: {sum(1 for c in final if c['src'] == ['jp'])}")
        print(f"entries with also-synonyms: {sum(1 for e in out if e.get('also'))}, "
              f"with notes: {sum(1 for e in out if e.get('notes'))}")


if __name__ == "__main__":
    main()
