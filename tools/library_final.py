#!/usr/bin/env python3
"""Finishing pass over data/library.json (L15, 2026-10-08): one canonical card per distinct color, English titles, a
usefulness order for the whole path, a field for each color, and a flag for the ones too close to teach.

  python3 tools/library_final.py            # rewrites data/library.json in place (idempotent)
  python3 tools/library_final.py --report   # also prints counts and before/after samples

tools/library.py's build() calls finalize() last, so a rebuild keeps all of this.

1. English titles (CLAUDE.md: English primary names; other languages secondary). A Japanese-only entry (src ["jp"], 225 of them,
   titled by their romaji) gets an English title and keeps the Japanese name in `also` as {n, lang:"ja", kanji, meaning}
   (the old `jp` object stays, js/colorsets.js reads it). The title is:
     - none, when a near-identical English-named color exists (CIEDE2000 < MERGE_DE): the entry is folded into that one as an alias;
     - otherwise the nearest plain English-named color (one or two words, no modifier, from CSS / xkcd / Wikipedia / the app)
       plus at most one modifier from the app's fixed grammar (light / pale / dark / deep, greyish / dusty / bright / vivid,
       a hue lean), the same rule js/naming.js's nameOf() and tools/build_core_names.py use. "Dusty plum", not "Ebizome".
2. Canonical cards. Entries closer than MERGE_DE (CIEDE2000 2.5) are one color: the best-named (app > xkcd > css/wiki > werner/ral >
   ridgway > maerz-paul > jp) keeps the card; the others become `altn` aliases ({n, src, note}) and their sources join its `src`.
   The app's own 101 colors and the 28 crude survey names are never merged away.
3. `useRank`: the app's 101 first, in curriculum order; then every other card by one usefulness score, the same four signals as
   data/core-names.json's useRank (sources carrying the name, xkcd survey, Google Books frequency, share of the painting archive),
   each a 0-1 percentile, averaged; ties by name.
4. `field`: where the color lives, from its sources and its name: "painter's pigments" (a pigment source or a pigment word),
   "fashion and textiles" (Japanese dye colors, Maerz & Paul 1930, textile words), "interiors and paint" (RAL),
   "design and print" (CSS / web, Crayola), "nature" (Werner's animal-vegetable-mineral names, Ridgway's bird colors, flower /
   gem / sea / sky words), "everyday" (the survey, the app, general ISCC-NBS names).
5. `teach:false` on a card whose nearest higher-priority card is closer than TEACH_DE (CIEDE2000 3.5) -- too close to tell apart
   as two lessons -- and on every crude name. `near` names that neighbor. Everything else is learnable.
"""
import json, re, sys
from collections import Counter
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
import library as LIB  # noqa: E402
import build_core_names as BCN  # noqa: E402

MERGE_DE = 2.5
TEACH_DE = 3.5
BASE_SEARCH_DE = 10.0
PRIORITY = {"app": 0, "xkcd": 1, "css": 2, "wiki": 2, "pigment": 2, "werner": 3, "ral": 3, "iscc-nbs": 3, "ridgway": 4,
            "maerz-paul": 5, "jp": 6}

PIGMENT_WORDS = re.compile(r"\b(cadmium|cobalt|ultramarine|cerulean|viridian|vermilion|vermillion|ochre|ocher|sienna|umber|madder|"
                           r"alizarin|carmine|gamboge|verdigris|azurite|malachite|orpiment|realgar|cinnabar|smalt|zaffre|"
                           r"lake|massicot|minium|sepia|bistre|bister|terre verte|indigo|woad|weld|prussian|phthalo|"
                           r"quinacridone|naples|chrome|lead|zinc|titanium|ivory black|lamp black|bone black|mars|"
                           r"viridine|brunswick|sap green|hooker|payne|indian yellow|lapis)\b", re.I)
TEXTILE_WORDS = re.compile(r"\b(silk|satin|linen|velvet|denim|tweed|wool|cotton|cashmere|taffeta|chiffon|lace|calico|khaki|"
                           r"fawn|mink|sable|ecru|beige|champagne|navy|cardinal|bordeaux|burgundy|claret|garnet)\b", re.I)
NATURE_WORDS = re.compile(r"\b(rose|lily|lilac|violet|iris|orchid|tulip|daisy|poppy|lavender|jasmine|moss|fern|leaf|grass|forest|"
                          r"pine|olive|sage|mint|lime|lemon|orange|peach|plum|cherry|apple|berry|grape|banana|apricot|sky|sea|"
                          r"ocean|lake|river|sand|stone|rock|slate|clay|mud|earth|dust|snow|ice|cloud|storm|sun|dawn|dusk|"
                          r"twilight|night|moon|star|fire|flame|ember|ash|smoke|coal|amber|jade|ruby|emerald|sapphire|opal|"
                          r"topaz|garnet|coral|pearl|shell|salmon|peacock|robin|dove|raven|parrot|canary|flamingo|swan|duck|"
                          r"mouse|rat|fox|wolf|bear|elephant|camel|tiger|leopard|honey|wheat|corn|straw|hay|bark|wood|walnut|"
                          r"chestnut|hazel|pistachio|avocado|pumpkin|tomato|carrot|mustard|ginger|cinnamon|nutmeg|coffee|"
                          r"chocolate|cocoa|caramel|butter|cream|wine)\b", re.I)


def src_rank(srcs):
    return min((PRIORITY.get(s, 7) for s in srcs), default=7)


def obscure(e, silly):
    return BCN.is_obscure(e["n"], e["src"], silly) or e["n"] in silly


def rank_key(e, silly):
    # a plain name always outranks an obscure / novelty / qualified one for the same color
    return (1 if obscure(e, silly) else 0, src_rank(e["src"]), BCN.junk_penalty(e["n"], silly), e["n"])


def _lab(e):
    return LIB.labs([e["h"]])[0]


def english_titles(entries, silly, log):
    """Step 1."""
    english = [e for e in entries if e["src"] != ["jp"] and not e.get("crude")]
    jps = sorted([e for e in entries if e["src"] == ["jp"] and not e.get("jpEn")], key=lambda e: e["n"])
    if not jps:
        return entries
    e_lab = LIB.labs([e["h"] for e in english])
    plain = lambda e: "app" in e["src"] or (len(BCN.tokens(e["n"])) == 1 and BCN.tokens(e["n"])[0] in BCN.SAFE_HUE_WORDS and BCN.tokens(e["n"])[0] not in ("black", "white"))   # "Moss", "Dusty rose"'s base, not "Black olive"
    base_ok = [i for i, e in enumerate(english) if ("app" in e["src"] or "css" in e["src"] or set(e["src"]) & {"xkcd", "wiki", "iscc-nbs"})
               and BCN.is_clean_base(e["n"], silly) and not obscure(e, silly) and plain(e)]
    base_lab = e_lab[base_ok] if base_ok else None
    basics = [e for e in english if "app" in e["src"]][:11]
    used = {LIB.key(e["n"]) for e in entries}
    drop = set()
    for e in jps:
        lab = _lab(e)
        d = LIB.de2000(lab[None], e_lab)[0]
        j = int(np.argmin(d))
        jp = e.get("jp") or {}
        note = {"n": jp.get("romaji") or e["n"], "lang": "ja", "kanji": jp.get("kanji"), "meaning": jp.get("meaning")}
        close = [i for i in range(len(english)) if d[i] < MERGE_DE]
        if close:
            j = min(close, key=lambda i: (rank_key(english[i], silly), d[i]))
            t = english[j]
            t.setdefault("also", []).append(note)
            for k in ("jp",):
                if k in e and k not in t:
                    t[k] = e[k]
            if "jp" not in t["src"]:
                t["src"] = t["src"] + ["jp"]
            drop.add(id(e))
            log.append((note["n"], t["n"], "merged", float(d[j])))
            continue
        db = LIB.de2000(lab[None], base_lab)[0]
        fam = e.get("fam")
        cands = [english[base_ok[i]] for i in np.argsort(db)[:8] if db[i] <= BASE_SEARCH_DE and english[base_ok[i]].get("fam") == fam][:4]
        if not cands:
            k = int(np.argmin(LIB.de2000(lab[None], LIB.labs([b["h"] for b in basics]))[0]))
            cands = [basics[k]] if basics[k].get("fam") == fam else []
            if not cands:
                cands = [english[base_ok[int(np.argmin(db))]]]
        label = None
        for base in cands:                      # first nearest base whose title is unused (no "tone" suffix games)
            mod = BCN.pick_modifier(LIB.lch(_lab(base)), LIB.lch(lab), base["n"])
            lb = f"{mod[0].upper()}{mod[1:]} {base['n'].lower()}" if mod else base["n"]
            if LIB.key(lb) not in used:
                label = lb
                break
        if label is None:                       # every nearby plain base is taken: the plain-English translation of the Japanese name
            tr = BCN.clean_jp_meaning((jp.get("meaning") or "").replace('"', "").replace("'", "")) 
            if tr and len(tr.split()) <= 3 and LIB.key(tr) not in used and not re.search(r"[()]", tr):
                label = tr
        if label is None:
            label = lb
            for suf in (" tone", " shade", " hue"):
                if LIB.key(label + suf) not in used:
                    label += suf
                    break
        used.add(LIB.key(label))
        e.setdefault("also", []).append(note)
        e["n"] = label
        e["jpEn"] = 1
        log.append((note["n"], label, "titled", float(d[j])))
    return [e for e in entries if id(e) not in drop]


def merge_duplicates(entries, silly, log):
    """Step 2: greedy, best-named first."""
    locked = [e for e in entries if "app" in e["src"]]
    crude = [e for e in entries if e.get("crude") and "app" not in e["src"]]
    rest = [e for e in entries if e not in locked and e not in crude]
    order = sorted(locked, key=lambda e: e["n"]) + sorted(rest, key=lambda e: rank_key(e, silly))
    canon, centers = [], None
    for e in order:
        lab = _lab(e)
        if centers is not None:
            d = LIB.de2000(lab[None], centers)[0]
            j = int(np.argmin(d))
            if d[j] < MERGE_DE and "app" not in e["src"]:
                c = canon[j]
                if LIB.key(e["n"]) != LIB.key(c["n"]):
                    c.setdefault("altn", [])
                    if not any(LIB.key(a["n"]) == LIB.key(e["n"]) for a in c["altn"]):
                        c["altn"].append({"n": e["n"], "src": e["src"][0] if len(e["src"]) == 1 else "+".join(e["src"]),
                                          "note": f"near-duplicate, dE {float(d[j]):.1f}"})
                for a in e.get("altn", []):
                    if not any(LIB.key(x["n"]) == LIB.key(a["n"]) for x in c.setdefault("altn", [])) and LIB.key(a["n"]) != LIB.key(c["n"]):
                        c["altn"].append(a)
                for s in e["src"]:
                    if s not in c["src"]:
                        c["src"].append(s)
                if e["h"] != c["h"] and float(d[j]) > LIB.ALT_DE:
                    c.setdefault("alts", [])
                    if [e["src"][0], e["h"]] not in c["alts"]:
                        c["alts"].append([e["src"][0], e["h"]])
                for a in e.get("alts", []):
                    if a not in c.setdefault("alts", []):
                        c["alts"].append(a)
                for k in ("werner", "jp"):
                    if k in e and k not in c:
                        c[k] = e[k]
                for a in e.get("also", []):
                    if a not in c.setdefault("also", []):
                        c["also"].append(a)
                if e.get("note") and e["note"] not in (c.get("note") or ""):
                    c["note"] = (c["note"] + "; " + e["note"]) if c.get("note") else e["note"]
                log.append((e["n"], c["n"], "dup", float(d[j])))
                continue
        canon.append(e)
        centers = lab[None] if centers is None else np.vstack([centers, lab[None]])
    return canon + crude


def field_of(e):
    s, n = set(e["src"]), e["n"]
    names = " ".join([n] + [a["n"] for a in e.get("altn", [])])
    if "pigment" in s or PIGMENT_WORDS.search(n):
        return "painter's pigments"
    if "jp" in s and s <= {"jp"}:
        return "fashion and textiles"
    if "app" in s:
        return "everyday"
    if "ral" in s and not (s & {"css", "wiki", "xkcd"}):
        return "interiors and paint"
    if "maerz-paul" in s and not (s & {"css", "xkcd", "app"}):
        return "fashion and textiles" if TEXTILE_WORDS.search(names) or s == {"maerz-paul"} else "nature" if NATURE_WORDS.search(n) else "fashion and textiles"
    if s & {"werner", "ridgway"} and not (s & {"css", "xkcd", "app"}):
        return "nature"
    if "css" in s:
        return "design and print"
    if "wiki" in s:
        note = (e.get("note") or "") + names
        if "Crayola" in note:
            return "design and print"
        if TEXTILE_WORDS.search(n):
            return "fashion and textiles"
        return "nature" if NATURE_WORDS.search(n) else "everyday"
    if "ral" in s:
        return "interiors and paint"
    return "nature" if NATURE_WORDS.search(n) and not (s & {"xkcd"}) else "everyday"


def teach_flags(entries, silly):
    order = sorted([e for e in entries if not e.get("crude")], key=lambda e: (0 if "app" in e["src"] else 1,) + rank_key(e, silly))
    taught, centers, names = [], None, []
    for e in order:
        lab = _lab(e)
        e.pop("teach", None); e.pop("near", None)
        if centers is not None and "app" not in e["src"]:
            d = LIB.de2000(lab[None], centers)[0]
            j = int(np.argmin(d))
            if d[j] < TEACH_DE:
                e["teach"] = False
                e["near"] = names[j]
                continue
        taught.append(e)
        names.append(e["n"])
        centers = lab[None] if centers is None else np.vstack([centers, lab[None]])
    for e in entries:
        if e.get("crude"):
            e["teach"] = False
        elif e.get("teach") is not False and obscure(e, silly):
            e["teach"] = False
            e["near"] = None
            e["why"] = "obscure, qualified or novelty name"
        if e.get("near", 1) is None:
            e.pop("near")


def use_rank(entries, app_rows):
    app_order = {LIB.key(r["n"]): i for i, r in enumerate(app_rows)}
    live = [e for e in entries if not e.get("crude")]
    free = [e for e in live if LIB.key(e["n"]) not in app_order or "app" not in e["src"]]
    arch = BCN._archive_presence([{"h": e["h"]} for e in live])
    arch_by = {id(e): (float(arch[i]) if arch is not None else 0.0) for i, e in enumerate(live)}
    ng = [BCN._ngram_freq({"n": e["n"], "also": [a["n"] for a in e.get("altn", [])] + [a["n"] for a in e.get("also", []) if isinstance(a, dict) and a.get("lang") != "ja"]}) for e in free]
    present = sorted(x for x in ng if x is not None)
    med = present[len(present) // 2] if present else 0.0

    def pct(vals):
        order = sorted(range(len(vals)), key=lambda i: vals[i])
        r = [0.0] * len(vals)
        i = 0
        while i < len(order):
            j = i
            while j + 1 < len(order) and vals[order[j + 1]] == vals[order[i]]:
                j += 1
            for k in range(i, j + 1):
                r[order[k]] = (i + j) / 2 / max(len(vals) - 1, 1)
            i = j + 1
        return r
    sig = [pct([len(e["src"]) for e in free]),
           [1.0 if "xkcd" in e["src"] else 0.0 for e in free],
           pct([(x if x is not None else med) for x in ng]),
           pct([arch_by[id(e)] for e in free]) if arch is not None else [0.0] * len(free)]
    used = sig if arch is not None else sig[:3]
    score = {id(e): sum(s[i] for s in used) / len(used) for i, e in enumerate(free)}
    ranked = sorted(free, key=lambda e: (-score[id(e)], e["n"]))
    for e in live:
        e.pop("useRank", None)
    nxt = 0
    for e in sorted([e for e in live if "app" in e["src"] and LIB.key(e["n"]) in app_order], key=lambda e: app_order[LIB.key(e["n"])]):
        e["useRank"] = nxt
        nxt += 1
    for e in ranked:
        if "useRank" not in e:
            e["useRank"] = nxt
            nxt += 1
    for e in entries:
        if e.get("crude"):
            e["useRank"] = nxt
            nxt += 1


def finalize(entries, app_rows=None, report=False):
    app_rows = app_rows or LIB.load_app()
    entries = [dict(e) for e in entries]
    silly = LIB.silly_names(entries)
    log = []
    before = len(entries)
    entries = english_titles(entries, silly, log)
    entries = merge_duplicates(entries, silly, log)
    for e in entries:
        e["field"] = field_of(e)
    teach_flags(entries, silly)
    use_rank(entries, app_rows)
    entries.sort(key=LIB.sort_key)
    if report:
        k = Counter(x[2] for x in log)
        print(f"library: {before} -> {len(entries)} cards  ({dict(k)})")
        print("fields:", dict(Counter(e["field"] for e in entries)))
        learn = [e for e in entries if e.get("teach") is not False]
        print(f"learnable cards (teach != false): {len(learn)}; teach:false {len(entries) - len(learn)} "
              f"(crude {sum(1 for e in entries if e.get('crude'))}, obscure name {sum(1 for e in entries if e.get('why'))}, too close {sum(1 for e in entries if e.get('near'))})")
    return entries, log


ORDER = ["n", "h", "src", "fam", "lch", "app", "field", "useRank", "teach", "near", "why", "alts", "altn", "also", "approx", "werner", "jp", "jpEn", "note", "crude"]


def write(entries):
    lines = [json.dumps({k: e[k] for k in ORDER if k in e}, ensure_ascii=False, separators=(",", ":")) for e in entries]
    LIB.OUT.write_text("[\n" + ",\n".join(lines) + "\n]\n", encoding="utf-8")


if __name__ == "__main__":
    entries = LIB.load_library()
    out, log = finalize(entries, report=True)
    if "--sample" in sys.argv or "--report" in sys.argv:
        print("\nJapanese titles (romaji -> English):")
        for a, b, kind, d in log:
            if kind in ("titled", "merged"):
                print(f"  {a:24s} -> {b:28s} {kind} ({d:.1f})")
    write(out)
