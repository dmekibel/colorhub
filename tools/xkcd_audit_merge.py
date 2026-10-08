#!/usr/bin/env python3
"""Apply the design/NAMES-XKCD-AUDIT.md verdicts (2026-10-09 coordinator scope extension): every
data/library.json entry whose only source is `xkcd` gets a final CRUDE / ALIAS / KEEP call. This is a
sibling of tools/vague_ish_merge.py (same merge mechanics, generalized to the full xkcd-only sweep instead of
just the `-ish` names), applied in the same run so an ALIAS name is never merged onto a CRUDE one.

  python3 tools/xkcd_audit_merge.py            # apply (writes data/library.json, data/core-names.json, data/aliases.json)
  python3 tools/xkcd_audit_merge.py --report   # dry run, print the merges, write nothing

CRUDE (32 names, vulgar/crude crowd-survey words): dropped from library.json and core-names.json entirely --
no title, no altn trace, no search alias. Any other entry's "near"/"also" field that happened to point at one
is cleaned (those fields aren't read by the app, but a crude word has no business surviving anywhere).

ALIAS (129 names: the original 75 compound/modifier/spelling-variant rows the automated pass already proposed,
plus 54 of the 79 "KEEP?" rows that a human/dictionary check (this run) found to be either (a) a pure
modifier+base-hue or two-base-hue tautology, (b) "-y"/"-ey"/"-ish" crowd-spelling slang, (c) a subjective
derogatory crowd descriptor (boring/nasty/sickly), (d) a pop-culture nickname (Barney, Kermit), (e) a
non-English word for a base hue (Azul), or (f) a plain spelling/redundancy variant of a name the library
already carries from a non-xkcd source (Burnt Siena/Sienna, Dusky/Dusty Rose, Grape Purple/Grape, Green
Apple/Apple Green, Kiwi Green/Kiwi, Mud Brown|Green/Mud, Grassy Green/Grass, Algae Green/Algae, Pea Soup/Pea
Soup Green): merged exactly like vague_ish_merge.py's targets -- library.json altn + src union, core-names.json
`also`, data/aliases.json so #/name/<slug> addresses keep resolving (js/learnmore.js's lxRekey reads this same
file to move a saved card/favorite to its new id automatically; no separate save-migration step needed).

KEEP (25 of the 79 "KEEP?" rows): unchanged. These are real, independently-recognizable color words (checked
by dictionary sense and, where noted in the audit table, cross-referenced against another non-xkcd source in
data/library.json) even though this library's own copy of them happens to carry only the xkcd source -- per the
brief, "skip if obvious" (Avocado, Celery, Squash, Racing Green already given as examples) covers most of them.

Safe to rerun: a name already merged away is skipped (same idempotency rule as vague_ish_merge.py).
"""
import json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
import numpy as np
import library as LIB            # noqa: E402
import build_core_names as BCN   # noqa: E402

LIB_PATH = ROOT / "data" / "library.json"
CORE_PATH = ROOT / "data" / "core-names.json"
ALIASES_PATH = ROOT / "data" / "aliases.json"
ARTICLES_DIR = ROOT / "data" / "articles"

# ---- CRUDE: scrubbed entirely, no trace, no alias ----
CRUDE = [
    "Baby Poo", "Baby Poop", "Baby Poop Green", "Baby Puke Green", "Baby Shit Brown", "Baby Shit Green",
    "Barf Green", "Booger", "Booger Green", "Diarrhea", "Piss Yellow", "Poo", "Poo Brown", "Poop",
    "Poop Brown", "Poop Green", "Puke", "Puke Brown", "Puke Green", "Puke Yellow", "Shit", "Shit Brown",
    "Shit Green", "Snot", "Snot Green", "Ugly Blue", "Ugly Brown", "Ugly Green", "Ugly Purple", "Vomit",
    "Vomit Green", "Vomit Yellow",
]

# ---- ALIAS: name -> short reason. Target is computed by nearest CIEDE2000 unless in EXPLICIT_TARGET. ----
ALIAS = {
    # the original automated pass's 75 compound/modifier/spelling-variant rows
    "Baby Purple": "modifier+base compound ('baby' + base hue), not a distinct name",
    "Bright Blue": "modifier+base compound ('bright' + base hue), not a distinct name",
    "Bright Light Blue": "modifier+base compound ('bright' + base hue), not a distinct name",
    "Bright Magenta": "modifier+base compound ('bright' + base hue), not a distinct name",
    "Bright Olive": "modifier+base compound ('bright' + base hue), not a distinct name",
    "Bright Pink": "modifier+base compound ('bright' + base hue), not a distinct name",
    "Brownish Green": "-ish crowd modifier slang",
    "Brownish Pink": "-ish crowd modifier slang",
    "Cool Green": "modifier+base compound ('cool' + base hue), not a distinct name",
    "Dark Aqua": "modifier+base compound ('dark' + base hue), not a distinct name",
    "Dark Beige": "modifier+base compound ('dark' + base hue), not a distinct name",
    "Dark Blue Grey": "modifier+base compound ('dark' + base hue), not a distinct name",
    "Dark Cream": "modifier+base compound ('dark' + base hue), not a distinct name",
    "Dark Forest Green": "modifier+base compound ('dark' + base hue), not a distinct name",
    "Dark Green Blue": "modifier+base compound ('dark' + base hue), not a distinct name",
    "Dark Indigo": "modifier+base compound ('dark' + base hue), not a distinct name",
    "Dark Lilac": "modifier+base compound ('dark' + base hue), not a distinct name",
    "Dark Lime": "modifier+base compound ('dark' + base hue), not a distinct name",
    "Dark Maroon": "modifier+base compound ('dark' + base hue), not a distinct name",
    "Dark Mauve": "modifier+base compound ('dark' + base hue), not a distinct name",
    "Dark Mustard": "modifier+base compound ('dark' + base hue), not a distinct name",
    "Dark Pink": "modifier+base compound ('dark' + base hue), not a distinct name",
    "Dark Rose": "modifier+base compound ('dark' + base hue), not a distinct name",
    "Dark Sage": "modifier+base compound ('dark' + base hue), not a distinct name",
    "Dark Tan": "modifier+base compound ('dark' + base hue), not a distinct name",
    "Dark Yellow Green": "modifier+base compound ('dark' + base hue), not a distinct name",
    "Deep Lilac": "modifier+base compound ('deep' + base hue), not a distinct name",
    "Deep Purple": "modifier+base compound ('deep' + base hue), not a distinct name",
    "Deep Sea Blue": "modifier+base compound ('deep' + base hue), not a distinct name",
    "Deep Violet": "modifier+base compound ('deep' + base hue), not a distinct name",
    "Dirty Blue": "modifier+base compound ('dirty' + base hue), not a distinct name",
    "Dirty Green": "modifier+base compound ('dirty' + base hue), not a distinct name",
    "Dirty Pink": "modifier+base compound ('dirty' + base hue), not a distinct name",
    "Dirty Purple": "modifier+base compound ('dirty' + base hue), not a distinct name",
    "Dirty Yellow": "modifier+base compound ('dirty' + base hue), not a distinct name",
    "Drab Green": "modifier+base compound ('drab' + base hue), not a distinct name",
    "Dull Blue": "modifier+base compound ('dull' + base hue), not a distinct name",
    "Dusty Red": "modifier+base compound ('dusty' + base hue), not a distinct name",
    "Dusty Teal": "modifier+base compound ('dusty' + base hue), not a distinct name",
    "Faded Blue": "modifier+base compound ('faded' + base hue), not a distinct name",
    "Faded Green": "modifier+base compound ('faded' + base hue), not a distinct name",
    "Greenish Brown": "-ish crowd modifier slang",
    "Greenish Teal": "-ish crowd modifier slang",
    "Greyish Pink": "-ish crowd modifier slang",
    "Hot Purple": "modifier+base compound ('hot' + base hue), not a distinct name",
    "Light Greenish Blue": "modifier+base compound ('light' + base hue), not a distinct name",
    "Light Khaki": "modifier+base compound ('light' + base hue), not a distinct name",
    "Light Light Green": "modifier+base compound ('light' + base hue), not a distinct name",
    "Light Magenta": "modifier+base compound ('light' + base hue), not a distinct name",
    "Light Maroon": "modifier+base compound ('light' + base hue), not a distinct name",
    "Light Mint": "modifier+base compound ('light' + base hue), not a distinct name",
    "Light Navy Blue": "modifier+base compound ('light' + base hue), not a distinct name",
    "Light Pastel Green": "modifier+base compound ('light' + base hue), not a distinct name",
    "Light Plum": "modifier+base compound ('light' + base hue), not a distinct name",
    "Light Royal Blue": "modifier+base compound ('light' + base hue), not a distinct name",
    "Light Sage": "modifier+base compound ('light' + base hue), not a distinct name",
    "Lighter Purple": "modifier+base compound ('lighter' + base hue), not a distinct name",
    "Liliac": "spelling variant of another name",
    "Medium Brown": "modifier+base compound ('medium' + base hue), not a distinct name",
    "Muddy Brown": "modifier+base compound ('muddy' + base hue), not a distinct name",
    "Muddy Green": "modifier+base compound ('muddy' + base hue), not a distinct name",
    "Pale Salmon": "modifier+base compound ('pale' + base hue), not a distinct name",
    "Pale Teal": "modifier+base compound ('pale' + base hue), not a distinct name",
    "Pastel Red": "modifier+base compound ('pastel' + base hue), not a distinct name",
    "Pinkish Brown": "-ish crowd modifier slang",
    "Rich Purple": "modifier+base compound ('rich' + base hue), not a distinct name",
    "Soft Blue": "modifier+base compound ('soft' + base hue), not a distinct name",
    "Soft Green": "modifier+base compound ('soft' + base hue), not a distinct name",
    "Soft Purple": "modifier+base compound ('soft' + base hue), not a distinct name",
    "Vibrant Purple": "modifier+base compound ('vibrant' + base hue), not a distinct name",
    "Warm Blue": "modifier+base compound ('warm' + base hue), not a distinct name",
    "Warm Brown": "modifier+base compound ('warm' + base hue), not a distinct name",
    "Warm Pink": "modifier+base compound ('warm' + base hue), not a distinct name",
    "Warm Purple": "modifier+base compound ('warm' + base hue), not a distinct name",
    "Weird Green": "modifier+base compound ('weird' + base hue), not a distinct name",
    # this run's 54 reclassified "KEEP?" rows (human/dictionary check, 2026-10-09)
    "Algae Green": "redundant modifier+base ('algae' is already green); 'Algae' alone is kept",
    "Almost Black": "a description, not a name; functions like an idiom, not a standalone color word",
    "Azul": "Spanish for 'blue'; naming policy keeps non-English words out of Learn/Archive titles",
    "Barney": "pop-culture nickname (the purple dinosaur), not a dictionary color word",
    "Barney Purple": "pop-culture nickname (the purple dinosaur), not a dictionary color word",
    "Blue Purple": "tautological two-base-hue compound, not a distinct name",
    "Bluey Purple": "-y crowd modifier slang on a two-base-hue compound",
    "Boring Green": "subjective crowd judgment word, not a distinct name",
    "Brick Orange": "modifier+base compound ('brick' + base hue), not independently documented",
    "Brown Yellow": "tautological two-base-hue compound, not a distinct name",
    "Browny Orange": "-y crowd modifier slang",
    "Burnt Siena": "misspelling of Burnt Sienna, already a non-xkcd library name",
    "Burple": "crowd portmanteau (blue+purple), less documented than Blurple, which is kept",
    "Dark Seafoam": "modifier+base compound ('dark' + base hue), not a distinct name",
    "Dark Taupe": "modifier+base compound ('dark' + base hue), not a distinct name",
    "Dirt Brown": "redundant modifier+base (dirt is already brown)",
    "Dusky Rose": "variant wording of Dusty Rose, already a non-xkcd library name",
    "Easter Green": "seasonal modifier+base compound, not a distinct name",
    "Easter Purple": "seasonal modifier+base compound, not a distinct name",
    "Flat Green": "modifier+base compound ('flat' + base hue), not a distinct name",
    "Fresh Green": "modifier+base compound ('fresh' + base hue), not a distinct name",
    "Grape Purple": "redundant modifier+base; 'Grape' alone is already a non-xkcd library name",
    "Grassy Green": "redundant modifier+base; 'Grass' alone is kept",
    "Green Apple": "fruit+base-hue compound; 'Apple Green' (Werner) is a different, duller shade, so this merges on nearest color instead",
    "Greeny Blue": "-y crowd modifier slang",
    "Kermit Green": "pop-culture nickname (Kermit the Frog), not a dictionary color word",
    "Kiwi Green": "redundant modifier+base; 'Kiwi' alone is kept",
    "Leafy Green": "modifier+base compound ('leafy' + base hue), not a distinct name",
    "Light Aquamarine": "modifier+base compound ('light' + base hue), not a distinct name",
    "Light Burgundy": "modifier+base compound ('light' + base hue), not a distinct name",
    "Light Seafoam": "modifier+base compound ('light' + base hue), not a distinct name",
    "Mud Brown": "redundant modifier+base; 'Mud' alone is already a non-xkcd library name",
    "Mud Green": "redundant modifier+base; 'Mud' alone is already a non-xkcd library name",
    "Murky Green": "modifier+base compound ('murky' + base hue), not a distinct name",
    "Nasty Green": "subjective derogatory crowd descriptor, same pattern as the CRUDE 'Ugly X' rows",
    "Orangey Brown": "-y crowd modifier slang",
    "Orangey Red": "-y crowd modifier slang",
    "Pea Soup": "redundant word-order variant of the already-documented 'Pea Soup Green'",
    "Peachy Pink": "modifier+base compound ('peachy' + base hue), not a distinct name",
    "Pink Purple": "tautological two-base-hue compound, not a distinct name",
    "Pure Blue": "modifier+base compound ('pure' + base hue), not a distinct name",
    "Purple Grey": "tautological two-base-hue compound, not a distinct name",
    "Purpley": "-ey crowd spelling slang (non-standard spelling of purplish/purply)",
    "Purpley Grey": "-ey crowd spelling slang",
    "Purpley Pink": "-ey crowd spelling slang",
    "Purply": "-y crowd spelling slang (non-standard spelling of purplish)",
    "Purply Pink": "-y crowd spelling slang",
    "Red Pink": "tautological two-base-hue compound, not a distinct name",
    "Reddy Brown": "-y crowd spelling slang (non-standard spelling of ruddy brown)",
    "Sand Brown": "redundant modifier+base (sand is already a tan/brown color)",
    "Sickly Green": "subjective derogatory crowd descriptor, same pattern as the CRUDE 'Ugly X' rows",
    "Stormy Blue": "modifier+base compound ('stormy' + base hue), not a distinct name",
    "Very Light Pink": "modifier+base compound ('very light' + base hue), not a distinct name",
    "Yellowy Green": "-y crowd modifier slang",
}

# spelling/word-order duplicates: always resolve through the sibling's own computed/explicit target
SPELLING_OF = {"Liliac": None}  # kept for parity with vague_ish_merge.py's shape; none needed here currently

# names already known, independently documented elsewhere in this same library (non-xkcd source) --
# used instead of a blind nearest-CIEDE2000 search for the redundancy-type ALIAS rows
EXPLICIT_TARGET = {
    "Grape Purple": "Grape",
    "Dusky Rose": "Dusty Rose",
    "Pea Soup": "Pea Soup Green",
    "Burnt Siena": "Burnt Sienna",
    "Kiwi Green": "Kiwi",
    "Mud Brown": "Mud",
    "Mud Green": "Mud",
    "Grassy Green": "Grass",
    "Algae Green": "Algae",
}

# KEEP (25 of the 79 "KEEP?" rows; unchanged, listed here only for the report)
KEEP = [
    "Algae", "Apple", "Army Green", "Asparagus", "Avocado", "Blurple", "Celery", "Grass", "Hospital Green",
    "Kiwi", "Lavender Pink", "Merlot", "Metallic Blue", "Midnight Purple", "Military Green", "Milk Chocolate",
    "Mustard Green", "Ocean", "Racing Green", "Red Wine", "Sea", "Seaweed", "Squash", "Swamp Green", "Velvet",
]

ALSO_CAP = BCN.ALSO_CAP + 4   # same cap apply_quality_fixes' _merge loop uses


def nearest(hexv, pool_labs, pool):
    lab = LIB.labs([hexv])[0]
    d = LIB.de2000(lab[None], pool_labs)[0]
    j = int(np.argmin(d))
    return pool[j], float(d[j])


def strip_crude(lib):
    """Drop CRUDE entries outright: no altn trace, no alias, no src merge. Also scrub any other entry's
    now-dangling 'near'/'also' pointer at one (those fields aren't read by the app, but a crude word
    shouldn't sit in the data either way)."""
    crude_keys = {LIB.key(n) for n in CRUDE}
    present = [n for n in CRUDE if LIB.key(n) in {LIB.key(e["n"]) for e in lib}]
    out = [e for e in lib if LIB.key(e["n"]) not in crude_keys]
    for e in out:
        if e.get("near") and LIB.key(e["near"]) in crude_keys:
            del e["near"]
        if e.get("also"):
            e["also"] = [a for a in e["also"] if LIB.key(a["n"] if isinstance(a, dict) else a) not in crude_keys]
            if not e["also"]:
                del e["also"]
    return out, present


def strip_crude_core(core):
    crude_keys = {LIB.key(n) for n in CRUDE}
    out = [e for e in core if LIB.key(e["n"]) not in crude_keys]
    for e in out:
        also = e.get("also") or []
        new_also = [a for a in also if LIB.key(a) not in crude_keys]
        if len(new_also) != len(also):
            e["also"] = new_also
    out.sort(key=lambda e: e["rank"])
    for i, e in enumerate(out):
        e["rank"] = i
    return out


def merge_library(lib, report):
    by_key = {LIB.key(e["n"]): e for e in lib}
    alias_keys = {LIB.key(n) for n in ALIAS if LIB.key(n) in by_key}
    if not alias_keys:
        return lib, {}
    rest = [e for e in lib if LIB.key(e["n"]) not in alias_keys]
    rest_by_key = {LIB.key(e["n"]): e for e in rest}
    rest_labs = LIB.labs([e["h"] for e in rest])
    targets = {}
    for n in ALIAS:
        e = by_key.get(LIB.key(n))
        if e is None:
            continue
        if n in SPELLING_OF and SPELLING_OF[n]:
            continue
        explicit = EXPLICIT_TARGET.get(n)
        if explicit:
            t = rest_by_key.get(LIB.key(explicit))
            if t is None:
                print(f"WARNING: explicit target {explicit!r} for {n!r} not found in library; falling back to nearest", file=sys.stderr)
            else:
                d = float(LIB.de2000(LIB.labs([e["h"]]), LIB.labs([t["h"]]))[0][0])
                targets[n] = (t["n"], d)
                continue
        tgt, d = nearest(e["h"], rest_labs, rest)
        targets[n] = (tgt["n"], d)
    log = []
    for n, (tname, d) in targets.items():
        e = by_key[LIB.key(n)]
        c = by_key[LIB.key(tname)]
        if LIB.key(e["n"]) != LIB.key(c["n"]):
            c.setdefault("altn", [])
            if not any(LIB.key(a["n"]) == LIB.key(e["n"]) for a in c["altn"]):
                c["altn"].append({"n": e["n"], "src": e["src"][0] if len(e["src"]) == 1 else "+".join(e["src"]),
                                   "note": f"xkcd-only crowd-survey name ({ALIAS[n]}), dE {d:.1f}"})
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
        for n, t, d in sorted(log):
            print(f"  {n:20s} -> {t:24s} dE {d}")
        return lib, targets
    out = [e for e in lib if LIB.key(e["n"]) not in alias_keys]
    return out, targets


def merge_core(core, lib_targets, report):
    by_key = {LIB.key(e["n"]): e for e in core}
    drops = [n for n in ALIAS if LIB.key(n) in by_key]
    if not drops:
        return core, {}
    drop_keys = {LIB.key(n) for n in drops}
    log, done = [], {}
    for n in drops:
        tinfo = lib_targets.get(n)
        tname = tinfo[0] if tinfo else None
        ek = by_key.get(LIB.key(tname)) if tname else None
        if ek is None:
            rest = [e for e in core if LIB.key(e["n"]) not in drop_keys]
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
        for n, t, d in sorted(log):
            print(f"  {n:20s} -> {t:24s} dE {d}")
        return core, done
    out = [e for e in core if LIB.key(e["n"]) not in {LIB.key(n) for n in done}]
    out.sort(key=lambda e: e["rank"])
    for i, e in enumerate(out):
        e["rank"] = i
    return out, done


def update_aliases(doc, lib_targets, core_targets, core_name_slugs):
    names, slugs = doc.setdefault("names", {}), doc.setdefault("slugs", {})
    merged = doc.setdefault("merged", [])
    redirect_slug = {BCN.slug(n): BCN.slug(t) for n, (t, _) in core_targets.items()}
    redirect_name = {n: t for n, (t, _) in core_targets.items()}
    slugs = {k: (redirect_slug.get(v, v)) for k, v in slugs.items()}
    names = {k: (redirect_name.get(v, v)) for k, v in names.items()}
    prim = set(core_name_slugs)
    for n, (t, d) in core_targets.items():
        for variant in {n, n.replace("Grey", "Gray").replace("grey", "gray"), n.replace("-", " "), n.replace(" ", "-")}:
            if BCN.slug(variant) in prim:
                continue
            names.setdefault(variant, t)
            slugs.setdefault(BCN.slug(variant), BCN.slug(t))
        if not any(m[0] == t and m[1] == n for m in merged):
            merged.append([t, n, round(d, 1)])
    # library-only merges (a core-names target doesn't exist for this ALIAS name): still point its address
    # at the library merge target so #/name/<slug> resolves, even though it never touches core-names.json
    for n, (t, d) in lib_targets.items():
        if n in core_targets:
            continue
        slug_n = BCN.slug(n)
        if slug_n in prim:
            continue
        names.setdefault(n, t)
        slugs.setdefault(slug_n, BCN.slug(t))
        if not any(m[0] == t and m[1] == n for m in merged):
            merged.append([t, n, round(d, 1)])
    doc["names"] = dict(sorted(names.items()))
    doc["slugs"] = dict(sorted(slugs.items()))
    doc["merged"] = merged
    return doc


def delete_orphan_articles(removed_names, report):
    """An article whose own slug IS one of the removed names (it's about the name itself, not a painter/place/
    pigment that happens to share a hue word) is now orphaned: nothing in Learn/Archive carries that title any
    more. Deleted outright; any other article's [[slug]] link or aside reference to it still resolves, because
    data/aliases.json now maps that slug to its merge target (or, for CRUDE, there are zero such incoming
    references -- checked by hand against the full committed article set before this script was written)."""
    deleted = []
    for n in removed_names:
        slug = BCN.slug(n)
        p = ARTICLES_DIR / f"{slug}.json"
        if not p.exists():
            continue
        try:
            data = json.loads(p.read_text(encoding="utf-8"))
        except Exception:
            continue
        if data.get("slug") != slug:
            continue
        deleted.append(str(p.relative_to(ROOT)))
        if not report:
            p.unlink()
    return deleted


def fix_crude_dangling_aliases(doc, crude_present, core_before, core_name_slugs):
    """A pre-existing data/aliases.json entry (from an earlier pass, unrelated to this script) can point at a
    CRUDE name's slug (e.g. "napoli" -> "ugly-blue"). CRUDE gets no new alias of its own, but an *existing*
    alias must still resolve to something real: repoint it at that CRUDE name's own nearest surviving core
    name (same CIEDE2000 method as everywhere else in this script), computed against the library *before* the
    crude strip (so the nearest-neighbor search sees the crude entry's real hex)."""
    if not crude_present:
        return doc
    by_key = {LIB.key(e["n"]): e for e in core_before}
    crude_keys = {LIB.key(n) for n in CRUDE}
    rest = [e for e in core_before if LIB.key(e["n"]) not in crude_keys]
    rest_labs = LIB.labs([e["h"] for e in rest])
    redirect = {}
    for n in crude_present:
        e = by_key.get(LIB.key(n))
        if e is None:
            continue
        tgt, _ = nearest(e["h"], rest_labs, rest)
        redirect[BCN.slug(n)] = BCN.slug(tgt["n"])
        redirect[n] = tgt["n"]
    names, slugs = doc["names"], doc["slugs"]
    fixed = 0
    for k, v in list(slugs.items()):
        if v in redirect and redirect[v] in core_name_slugs:
            slugs[k] = redirect[v]; fixed += 1
    for k, v in list(names.items()):
        if v in redirect:
            names[k] = redirect[v]; fixed += 1
    if fixed:
        print(f"fixed {fixed} pre-existing alias(es) pointing at a now-dropped CRUDE name")
    return doc


def main():
    report = "--report" in sys.argv[1:]
    lib = json.loads(LIB_PATH.read_text(encoding="utf-8"))
    core = json.loads(CORE_PATH.read_text(encoding="utf-8"))
    aliases = json.loads(ALIASES_PATH.read_text(encoding="utf-8"))

    lib0, crude_present = strip_crude(lib)
    lib2, lib_targets = merge_library(lib0, report)
    core0 = strip_crude_core(core) if not report else core
    core2, core_targets = merge_core(core0, lib_targets, report)

    if report:
        print(f"\nCRUDE present and would be dropped: {len(crude_present)} ({crude_present})")
        print(f"{len(lib_targets)} library names to merge, {len(core_targets)} of them also core primaries")
        return

    core_name_slugs = {BCN.slug(e["n"]) for e in core2}
    aliases2 = update_aliases(aliases, lib_targets, core_targets, core_name_slugs)
    aliases2 = fix_crude_dangling_aliases(aliases2, crude_present, core, core_name_slugs)

    deleted = delete_orphan_articles(list(ALIAS.keys()) + CRUDE, report)

    order = __import__("library_final").ORDER
    lib_lines = [json.dumps({k: e[k] for k in order if k in e}, ensure_ascii=False, separators=(",", ":")) for e in lib2]
    LIB_PATH.write_text("[\n" + ",\n".join(lib_lines) + "\n]\n", encoding="utf-8")
    core_lines = [json.dumps(e, ensure_ascii=False, separators=(",", ":")) for e in core2]
    CORE_PATH.write_text("[\n" + ",\n".join(core_lines) + "\n]\n", encoding="utf-8")
    ALIASES_PATH.write_text(json.dumps(aliases2, ensure_ascii=False, indent=0, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"CRUDE dropped: {len(crude_present)}")
    print(f"library.json: {len(lib)} -> {len(lib2)} entries ({len(lib_targets)} ALIAS merged away, {len(crude_present)} CRUDE dropped)")
    print(f"core-names.json: {len(core)} -> {len(core2)} entries ({len(core_targets)} ALIAS merged away)")
    print(f"aliases.json: {len(aliases2['slugs'])} slugs, {len(aliases2['merged'])} merged pairs")
    print(f"orphaned articles deleted: {len(deleted)}")
    for d in deleted:
        print(f"  {d}")


if __name__ == "__main__":
    main()
