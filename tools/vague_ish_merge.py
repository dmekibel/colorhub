#!/usr/bin/env python3
"""One-time, re-runnable (idempotent) fix for David's 2026-10-08 naming-policy pass: bare single-word '-ish'
crowd-survey names (Pinkish, Tealish, Greenish, Orangeish, Orangish, Purpleish) and xkcd/wiki-only compound
modifiers (Lightish Blue/Green/Purple/Red, Darkish Green/Pink/Red, Purpleish/Purplish Blue/Pink) are not real
color names -- they never appear in any standard (ISCC-NBS, Ridgway, Werner, RAL, Maerz & Paul), only in the
xkcd crowd survey (and Wikipedia's copy of it). CLAUDE.md naming policy: these leave the Learn and Archive
layers (never a titled color) and become Search-only aliases to the nearest real name. "Brownish" keeps its
title -- it has independent Ridgway/ISCC-NBS backing.

This is a scoped, targeted patch, not a full pipeline rebuild: a full `python3 tools/library.py --build` /
`python3 tools/build_core_names.py` was tried first and found NOT reproducible in this environment (minor
useRank drift in library.py's output, and real churn -- different primaries chosen -- in build_core_names.py's
farthest-point trim, likely sensitive to a stats cache that has since moved on). Rerunning either wholesale
would bury this targeted fix in thousands of lines of unrelated, unreviewable diff. This script instead
performs the exact same merge build_core_names.py's `_merge` override and library_final.py's merge_duplicates()
would perform, for only these names, and nothing else in data/library.json or data/core-names.json changes.

  python3 tools/vague_ish_merge.py            # apply (writes data/library.json, data/core-names.json, data/aliases.json)
  python3 tools/vague_ish_merge.py --report   # dry run, print the merges, write nothing

Safe to rerun: a name already merged away is skipped.
"""
import json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
import numpy as np
import library as LIB            # noqa: E402
import build_core_names as BCN   # noqa: E402

LIB_PATH = ROOT / "data" / "library.json"
CORE_PATH = ROOT / "data" / "core-names.json"
ALIASES_PATH = ROOT / "data" / "aliases.json"

# name -> why it's vague (kept short; the full reasoning is in design/NAMES-XKCD-AUDIT.md)
VAGUE = {
    "Pinkish": "bare xkcd crowd-survey modifier, no standard backs it as a name",
    "Tealish": "bare xkcd crowd-survey modifier, no standard backs it as a name",
    "Greenish": "bare xkcd crowd-survey modifier, no standard backs it as a name",
    "Orangeish": "bare xkcd crowd-survey modifier; also a spelling duplicate of Orangish",
    "Orangish": "bare xkcd/wiki crowd-survey modifier; also a spelling duplicate of Orangeish",
    "Purpleish": "bare xkcd crowd-survey modifier, no standard backs it as a name",
    "Lightish Blue": "xkcd/wiki-only compound modifier slang, not a standard name",
    "Lightish Green": "xkcd-only compound modifier slang, not a standard name",
    "Lightish Purple": "xkcd-only compound modifier slang, not a standard name",
    "Lightish Red": "xkcd/wiki-only compound modifier slang, not a standard name",
    "Darkish Green": "xkcd-only compound modifier slang, not a standard name",
    "Darkish Pink": "xkcd/wiki-only compound modifier slang, not a standard name",
    "Darkish Red": "xkcd/wiki-only compound modifier slang, not a standard name",
    "Purpleish Blue": "xkcd-only compound modifier slang; also a spelling duplicate of Purplish Blue",
    "Purplish Blue": "xkcd-only compound modifier slang (crowd spelling, not ISCC-NBS/Ridgway-backed)",
    "Purpleish Pink": "xkcd-only compound modifier slang; also a spelling duplicate of Purplish Pink",
    "Purplish Pink": "xkcd-only compound modifier slang (crowd spelling, not ISCC-NBS/Ridgway-backed)",
}
# duplicate spellings: the non-canonical one always resolves through its canonical sibling's own target,
# so both ever point to the exact same real color (never two different "nearest real name"s for one duplicate)
SPELLING_OF = {"Orangeish": "Orangish", "Purpleish Blue": "Purplish Blue", "Purpleish Pink": "Purplish Pink"}

ALSO_CAP = BCN.ALSO_CAP + 4   # same cap apply_quality_fixes' _merge loop uses


def nearest(hexv, pool_labs, pool):
    lab = LIB.labs([hexv])[0]
    d = LIB.de2000(lab[None], pool_labs)[0]
    j = int(np.argmin(d))
    return pool[j], float(d[j])


def merge_library(lib, report):
    by_key = {LIB.key(e["n"]): e for e in lib}
    vague_keys = {LIB.key(n) for n in VAGUE if LIB.key(n) in by_key}
    if not vague_keys:
        return lib, {}
    rest = [e for e in lib if LIB.key(e["n"]) not in vague_keys]
    rest_labs = LIB.labs([e["h"] for e in rest])
    targets = {}   # dropped name -> (target name, dE)
    for n in VAGUE:
        e = by_key.get(LIB.key(n))
        if e is None:
            continue   # already merged away (idempotent rerun)
        if n in SPELLING_OF:
            continue   # resolved after its canonical sibling, below
        tgt, d = nearest(e["h"], rest_labs, rest)
        targets[n] = (tgt["n"], d)
    for dropped, canon in SPELLING_OF.items():
        if canon in targets:
            targets[dropped] = targets[canon]
    log = []
    for n, (tname, d) in targets.items():
        e = by_key[LIB.key(n)]
        c = by_key[LIB.key(tname)]
        if LIB.key(e["n"]) != LIB.key(c["n"]):
            c.setdefault("altn", [])
            if not any(LIB.key(a["n"]) == LIB.key(e["n"]) for a in c["altn"]):
                c["altn"].append({"n": e["n"], "src": e["src"][0] if len(e["src"]) == 1 else "+".join(e["src"]),
                                   "note": f"vague crowd-survey modifier ({VAGUE[n]}), dE {d:.1f}"})
        for a in e.get("altn", []):
            if not any(LIB.key(x["n"]) == LIB.key(a["n"]) for x in c.setdefault("altn", [])) and LIB.key(a["n"]) != LIB.key(c["n"]):
                c["altn"].append(a)
        for s in e["src"]:
            if s not in c["src"]:
                c["src"].append(s)
        if e["h"] != c["h"] and d > LIB.ALT_DE:
            c.setdefault("alts", [])
            if [e["src"][0], e["h"]] not in c["alts"]:
                c["alts"].append([e["src"][0], e["h"]])
        log.append((n, tname, round(d, 1)))
    if report:
        print("library.json merges:")
        for n, t, d in log:
            print(f"  {n:16s} -> {t:20s} dE {d}")
        return lib, targets
    out = [e for e in lib if LIB.key(e["n"]) not in vague_keys]
    return out, targets


def merge_core(core, lib_targets, report):
    by_key = {LIB.key(e["n"]): e for e in core}
    drops = [n for n in VAGUE if LIB.key(n) in by_key]
    if not drops:
        return core, {}
    log, done = [], {}
    for n in drops:
        tinfo = lib_targets.get(n)
        tname = tinfo[0] if tinfo else None
        ek = by_key.get(LIB.key(tname)) if tname else None
        if ek is None:
            # the library target isn't (yet) a core primary -- fall back to nearest core primary directly
            rest = [e for e in core if LIB.key(e["n"]) not in {LIB.key(x) for x in drops}]
            rest_labs = LIB.labs([e["h"] for e in rest])
            e = by_key[LIB.key(n)]
            tgt, d = nearest(e["h"], rest_labs, rest)
            ek = by_key[LIB.key(tgt["n"])]
        ed = by_key[LIB.key(n)]
        if ek is ed:
            continue
        de = float(LIB.de2000(LIB.labs([ek["h"]]), LIB.labs([ed["h"]]))[0][0])
        ek["also"] = ([ed["n"]] + list(ed.get("also") or []) + list(ek.get("also") or []))
        seen, res = {LIB.key(ek["n"])}, []
        for a in ek["also"]:
            if LIB.key(a) not in seen:
                seen.add(LIB.key(a)); res.append(a)
        ek["also"] = res[:ALSO_CAP]
        ek["src"] = sorted(set(ek["src"]) | set(ed["src"]), key=lambda x: BCN.SRC_RANK.get(x, 6))
        if ed.get("notes") and not ek.get("notes"):
            ek["notes"] = ed["notes"]
        log.append((ed["n"], ek["n"], round(de, 1)))
        done[ed["n"]] = (ek["n"], de)
    if report:
        print("core-names.json merges:")
        for n, t, d in log:
            print(f"  {n:16s} -> {t:20s} dE {d}")
        return core, done
    out = [e for e in core if LIB.key(e["n"]) not in {LIB.key(n) for n in done}]
    out.sort(key=lambda e: e["rank"])
    for i, e in enumerate(out):
        e["rank"] = i
    return out, done


def update_aliases(doc, lib_targets, core_targets, core_name_slugs):
    """data/aliases.json's `slugs`/`names` resolve to CORE names only (check_solvable.js enforces this: every
    alias must point at one of the ~1,000 core names, the game's own answer set). A library-only merge target
    (Keppel, Cinnamon Satin, ...) is never added here -- that half of the fix lives entirely in library.json's
    own `altn` field, which router.js's live "also"/altn fallback and the article gate's alias resolution don't
    need this file for. What DOES need fixing here: any alias that already pointed at one of the six names we
    just demoted out of core-names.json must be re-pointed at its new target, so it keeps resolving."""
    names, slugs = doc.setdefault("names", {}), doc.setdefault("slugs", {})
    merged = doc.setdefault("merged", [])
    redirect_slug = {BCN.slug(n): BCN.slug(t) for n, (t, _) in core_targets.items()}
    redirect_name = {n: t for n, (t, _) in core_targets.items()}
    # 1. re-point every existing alias whose target was one of the six demoted core names
    slugs = {k: (redirect_slug.get(v, v)) for k, v in slugs.items()}
    names = {k: (redirect_name.get(v, v)) for k, v in names.items()}
    # 2. the six demoted names themselves (plus simple spelling variants) become new aliases of their target
    prim = set(core_name_slugs)
    for n, (t, d) in core_targets.items():
        for variant in {n, n.replace("Grey", "Gray").replace("grey", "gray"), n.replace("-", " "), n.replace(" ", "-")}:
            if BCN.slug(variant) in prim:
                continue
            names.setdefault(variant, t)
            slugs.setdefault(BCN.slug(variant), BCN.slug(t))
        if not any(m[0] == t and m[1] == n for m in merged):
            merged.append([t, n, round(d, 1)])
    doc["names"] = dict(sorted(names.items()))
    doc["slugs"] = dict(sorted(slugs.items()))
    doc["merged"] = merged
    return doc


def main():
    report = "--report" in sys.argv[1:]
    lib = json.loads(LIB_PATH.read_text(encoding="utf-8"))
    core = json.loads(CORE_PATH.read_text(encoding="utf-8"))
    aliases = json.loads(ALIASES_PATH.read_text(encoding="utf-8"))

    lib2, lib_targets = merge_library(lib, report)
    core2, core_targets = merge_core(core, lib_targets, report)
    if report:
        print(f"\n{len(lib_targets)} library names to merge, {len(core_targets)} of them also core primaries")
        return
    core_name_slugs = {BCN.slug(e["n"]) for e in core2}
    aliases2 = update_aliases(aliases, lib_targets, core_targets, core_name_slugs)

    order = __import__("library_final").ORDER
    lib_lines = [json.dumps({k: e[k] for k in order if k in e}, ensure_ascii=False, separators=(",", ":")) for e in lib2]
    LIB_PATH.write_text("[\n" + ",\n".join(lib_lines) + "\n]\n", encoding="utf-8")
    core_lines = [json.dumps(e, ensure_ascii=False, separators=(",", ":")) for e in core2]
    CORE_PATH.write_text("[\n" + ",\n".join(core_lines) + "\n]\n", encoding="utf-8")
    ALIASES_PATH.write_text(json.dumps(aliases2, ensure_ascii=False, indent=0, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"library.json: {len(lib)} -> {len(lib2)} entries ({len(lib_targets)} merged away)")
    print(f"core-names.json: {len(core)} -> {len(core2)} entries ({len(core_targets)} merged away)")
    print(f"aliases.json: {len(aliases2['slugs'])} slugs, {len(aliases2['merged'])} merged pairs")


if __name__ == "__main__":
    main()
