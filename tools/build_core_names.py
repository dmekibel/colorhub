#!/usr/bin/env python3
"""ColorHub core names: the one unified naming list (ROADMAP.md §13 "One naming system", "Why 1,000 and not
2,700"). Merges data/library.json's 2,711 names into about 1,000 distinct, primary-named colors.

  python3 tools/build_core_names.py           # writes data/core-names.json
  python3 tools/build_core_names.py --report  # also prints cluster counts and a coverage check

Rule (one distinct color = one primary name): near-identical names (CIEDE2000 below MERGE_DE, about 2.5) merge
into one entry. The most common English name wins: app > xkcd > css/wiki > werner/ral > ridgway (reusing
tools/library.py's silly-name detector to skip obscure/awkward names as primaries when a plainer one is close).
The rest become `also` synonyms. A Japanese name is never a primary (ROADMAP §17 job #1): its English
translation takes that slot instead, and the romaji/kanji/meaning stay as a cultural `notes` entry. The app's
own 101 colors (data/colors.js) are always present with their exact name and hex, and never merge into anything
else.

Plain-English primaries (ROADMAP §17 job #1, David 2026-10-08/09 "every color name a user sees must be plain
English that a normal person can read and say"): a name is "obscure" when it
  - carries a parenthetical qualifier ("Blue (Munsell)", "Royal Blue (Dark)") or a bare "#"/" Or " variant,
  - contains one of OBSCURE_TOKENS, a 19th-century naturalist/dye coinage no one says out loud (vinaceous,
    glaucous, zinnwaldite, rose doree, drab...),
  - is flagged by tools/library.py's silly_names() as RAL signage or effect paint ("Traffic Red", "Pure
    White" — paint-chart codes, not its other reasons, which answer a different question; see is_obscure()), or
  - is a Ridgway (1912) coinage with no other source backing it up, joining two hues with a hyphen where at
    least one side isn't an ordinary hue word (SAFE_HUE_WORDS) — e.g. "Heliotrope-Slate", "Olive-Citrine".
This changes which names merge into an existing cluster (an obscure one needs to be closer, JUNK_SKIP_DE not
MERGE_DE) and, when one still doesn't merge, what becomes its primary — never the obscure name as-is. First
choice: if it only has a parenthetical qualifier, the bare name before the parenthesis, when that's itself
plain and not already taken. Otherwise: a plain descriptive name built from the nearest already-settled,
one-or-two-word color ("the base") plus at most one modifier from the app's own fixed grammar (js/naming.js's
pickModifier: light/pale, dark/deep, greyish/dusty, bright/vivid, a hue lean), e.g. "Dusty rose", "Greyish
green". The original name is always kept as an `also` synonym, so no name is lost. This never touches which
rival name wins a cluster, or the farthest-point trim order — junk_penalty(), unchanged, still does that.

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
MERGE_DE = 2.5      # near-identical names merge into one entry
JUNK_SKIP_DE = 4.0   # an obscure/awkward name only becomes a primary if nothing plainer is at least this close
JP_MERGE_DE = 4.0    # a Japanese name is a cultural note, not a primary, when an English name is this close
BASE_SEARCH_DE = 10.0  # how far a synthesized name may reach for an existing plain color to build on
TARGET = 1000        # aim for about this many; fewer is fine if distinctness gives less
ALSO_CAP = 10        # keep the file well under 150 KB
NOTES_CAP = 3

SRC_RANK = {"app": 0, "xkcd": 1, "css": 2, "wiki": 2, "werner": 3, "ral": 3, "ridgway": 4, "jp": 5}

# ---------------------------------------------------------------------------------------------
# Plain-English rules (ROADMAP §17 job #1): an explicit list, not a blanket reuse of silly_names() (that one
# answers a different question — "fit for a painting caption?" — and its wiki brand/novelty and xkcd-casual
# reasons flag plenty of names ("Cambridge Blue", "Brownish") that are perfectly plain English; only its RAL
# signage reason ("Traffic Red", "Pure White" — paint-chart codes, not words a person reaches for) lines up
# with this job, so that's the one reason this file still borrows).
# ---------------------------------------------------------------------------------------------
# Whole words that read as 19th-century naturalist/dye jargon no matter where they appear — flagged regardless
# of source. Kept short and specific (false positives just get a synthesized plain name instead; false
# negatives are the real risk, so judgment erred toward including rather than excluding).
OBSCURE_TOKENS = {
    "vinaceous", "glaucous", "plumbeous", "ochraceous", "rufous", "livid", "fuscous", "griseous",
    "testaceous", "avellaneous", "viridine", "cendre", "rosolane", "naphthalene", "anthracene",
    "neropalin", "nigrosin", "diamine", "zinnwaldite", "isabelline", "drab", "doree", "dore",
    "medal", "amparo", "corinthian", "saccardo", "saccardo's", "hay's", "rood's", "pallid",
}
# A small, curated set of ordinary hue nouns (ROADMAP §13's 11 basics plus the common secondary colors people
# actually say). Used only to judge a Ridgway (1912) hyphenated two-hue compound ("Heliotrope-Slate"): when
# every side is one of these, the compound reads as plain as "Blue-Grey" does and is left alone; otherwise
# (one side is some other, rarer word Ridgway reached for) it's obscure.
SAFE_HUE_WORDS = {
    "red", "orange", "yellow", "green", "blue", "purple", "violet", "pink", "brown", "grey", "gray",
    "black", "white", "olive", "rose", "salmon", "buff", "slate", "tan", "cream", "plum", "wine",
    "rust", "bronze", "lilac", "teal", "navy", "coral", "peach", "maroon", "beige", "khaki", "gold",
    "silver", "copper", "mauve", "indigo", "turquoise", "cyan", "cinnamon", "citrine", "chestnut",
    "apricot", "amber", "honey", "sage", "moss", "jade", "emerald", "charcoal", "ivory", "stone",
    "sand", "hazel", "chocolate", "umber", "sienna", "sepia", "mahogany", "scarlet", "crimson",
    "vermilion", "magenta", "fuchsia", "burgundy", "raspberry", "cerise", "lavender",
}
# Words that already read as a modifier (ROADMAP §13's fixed grammar); a name built only from these plus hue
# nouns doesn't need a side to be judged, and a color used as a synthesis *base* must be free of them (so a
# generated name never stacks two modifiers, "Bright soft purple").
MOD_WORDS = {
    "light", "pale", "dark", "deep", "dusky", "bright", "grey", "gray", "greyish", "grayish",
    "dusty", "dull", "vivid", "neon", "electric", "reddish", "yellowish", "greenish", "bluish",
    "purplish", "dirty", "nice", "muddy", "faded", "soft",
}
PAREN_RE = re.compile(r"\s*\([^)]*\)\s*")


def tokens(name):
    return [w.lower() for w in re.split(r"[ '\-]+", name) if w]


def is_obscure(name, srcs, silly):
    if re.search(r"[()#]| Or ", name):
        return True
    toks = tokens(name)
    if any(t in OBSCURE_TOKENS for t in toks):
        return True
    if silly.get(name) == "RAL signage or effect paint":
        return True
    # a Ridgway coinage with no other source backing it up, joining two hues with a hyphen: obscure unless
    # every side is an ordinary hue word (so "Blue-Grey"-style compounds that happen to carry a Ridgway
    # citation too are never touched, but "Heliotrope-Slate" — sole-sourced, no safe side — is)
    if list(srcs) == ["ridgway"] and "-" in name:
        sides = [t for t in toks if t not in MOD_WORDS]
        if sides and not all(s in SAFE_HUE_WORDS for s in sides):
            return True
    return False


def is_clean_base(name, silly):
    """Fit to build a synthesized name on: one or two tokens, none of them already a modifier — so adding one
    more modifier can never stack ("Dusty light coral red") — and not itself a name silly_names() flagged
    (a brand/crayon/novelty name like "Kobi" makes an odd, unrecognizable base even when it's left alone as
    its own primary)."""
    if name in silly:
        return False
    toks = tokens(name)
    return 1 <= len(toks) <= 2 and not any(t in MOD_WORDS for t in toks)


def junk_penalty(name, silly):
    """Unchanged from the pre-existing build (ROADMAP §17 job #1 only changes *what* counts as obscure for the
    merge-threshold/rename decision, via is_obscure() below — not this ranking, which decides which rival name
    among several for the same color is tried first as a cluster's primary, and processing order within a
    pass). Keeping this exactly as it was keeps everyone else's cluster assignments exactly as they were."""
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


def src_rank(srcs):
    return min((SRC_RANK.get(s, 6) for s in srcs), default=6)


# ---------------------------------------------------------------------------------------------
# Synthesizing a plain descriptive name (js/naming.js's pickModifier, ported 1:1 so a generated name reads
# exactly like any other nameOf() result): base hue word + at most one modifier from the fixed grammar.
# ---------------------------------------------------------------------------------------------
MOD_AXIS_RE = {
    "L": re.compile(r"\b(light|pale|dark|deep|dusky|bright)\b", re.I),
    "C": re.compile(r"\b(grey|gray|greyish|grayish|dusty|dull|vivid|bright|neon|electric)\b", re.I),
    "H": re.compile(r"\b(reddish|yellowish|greenish|bluish|purplish)\b", re.I),
}


def hue_lean(h):
    h = h % 360
    return ("reddish" if h < 40 or h >= 345 else "yellowish" if h < 100 else
            "greenish" if h < 170 else "bluish" if h < 260 else "purplish")


def pick_modifier(name_lch, target_lch, name=""):
    Ln, Cn, Hn = name_lch
    Lt, Ct, Ht = target_lch
    dL, dC = Lt - Ln, Ct - Cn
    dH = Ht - Hn
    if dH > 180: dH -= 360
    if dH < -180: dH += 360
    scores = [("L", abs(dL), dL), ("C", abs(dC) * .8, dC)]
    if Cn > 8 and Ct > 8:
        scores.append(("H", abs(dH) * min(Cn, Ct) / 40, dH))
    scores.sort(key=lambda s: -s[1])
    ok = [s for s in scores if not MOD_AXIS_RE[s[0]].search(name)]
    if not ok:
        return ""
    axis, _, v = ok[0]
    if axis == "L":
        return ("pale" if Ct < 20 else "light") if v > 0 else ("deep" if Ct > 35 else "dark")
    if axis == "C":
        return ("greyish" if Ct < 15 else "dusty") if v < 0 else ("bright" if Lt > 55 else "vivid")
    return hue_lean(Ht)


def make_unique(label, used_lower):
    if label.lower() not in used_lower:
        return label
    for suffix in (" tone", " shade", " hue"):
        alt = label + suffix
        if alt.lower() not in used_lower:
            return alt
    i = 2
    while f"{label} {i}".lower() in used_lower:
        i += 1
    return f"{label} {i}"


def synth_plain_name(lab_e, clusters, centers, used_lower, silly):
    """The nearest already-settled, one-or-two-word, modifier-free color within BASE_SEARCH_DE becomes the
    base hue word (so the result is always exactly "base" or "modifier base", never a stack); failing that,
    the nearest of the 11 basics (always clusters[:11], always clean) does. The modifier itself is picked the
    same way nameOf() would pick it for this color against that base (js/naming.js's pickModifier, ported)."""
    Lt, Ct, Ht = LIB.lch(lab_e)
    d_all = LIB.de2000(lab_e[None], centers)[0]
    order = np.argsort(d_all)
    base = None
    for idx in order:
        if d_all[idx] > BASE_SEARCH_DE:
            break
        if clusters[idx].get("synth") or not is_clean_base(clusters[idx]["n"], silly):
            continue
        base = clusters[idx]
        break
    if base is None:
        bi = int(np.argmin(LIB.de2000(lab_e[None], centers[:11])[0]))
        base = clusters[bi]
    mod = pick_modifier(LIB.lch(base["lab"]), (Lt, Ct, Ht), base["n"])
    label = f"{mod[0].upper()}{mod[1:]} {base['n'].lower()}" if mod else base["n"]
    return make_unique(label, used_lower)


def clean_jp_meaning(meaning):
    """'Red plum colored' -> 'Red plum'; 'Sumi-iro' meaning 'ink color' -> 'Ink'; drops a parenthetical aside
    ('Medium crimson (dye)' -> 'Medium crimson') the same way the old romaji-primary notes already did."""
    m = meaning.split("(")[0].strip()
    m = re.sub(r"[\s-]+colou?red$", "", m, flags=re.I).strip()
    m = re.sub(r"[\s-]+colou?r$", "", m, flags=re.I).strip()
    if not m:
        return None
    return m[0].upper() + m[1:].lower()


MODS = {"light", "pale", "dark", "deep", "dusky", "bright", "dusty", "dull", "vivid", "neon", "electric",
        "medium", "soft", "muted", "pastel", "greyish", "grayish", "reddish", "yellowish", "greenish", "bluish",
        "purplish", "orangish", "pinkish", "brownish", "very", "rich", "warm", "cool", "faded"}
HUE_SUFFIX = {"green", "blue", "red", "pink", "purple", "yellow", "orange", "brown", "grey", "gray", "violet"}


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", re.sub(r"[\u0300-\u036f]", "", __import__("unicodedata").normalize("NFKD", str(s)).lower())).strip("-")


def apply_quality_fixes(out, ov):
    """tools/core-name-overrides.json sections (all optional):
       _fixes:   {old_hex: {h?: new_hex, n?: new_name, move_old_to?: name, why: str}} -- a wrong hex or a name that
                 contradicts its hex. A hex fix re-homes any synonym whose own library hex is >5 dE from the new
                 hex onto the nearest other entry (the synonyms described the old color, not the new one).
                 `drop_also: [names]` removes synonyms from just this entry.
       _typos:   {wrong: right} applied word-wise to every primary and synonym; a synonym that then equals another
                 entry's primary is dropped.
       _drop_also: [names] garbage synonyms removed outright.
    Then flags compound/modifier names: `compound: true` + `base: <slug of the root color>`."""
    fixes = ov.get("_fixes", {})
    typos = {k.lower(): v for k, v in ov.get("_typos", {}).items()}
    drop = {LIB.key(x) for x in ov.get("_drop_also", [])}
    by_hex = {e["h"].upper(): e for e in out}
    lib = {}
    for le in LIB.load_library():
        lib.setdefault(LIB.key(le["n"]), le)
    labs = {e["h"]: LIB.labs([e["h"]])[0] for e in out}
    log = []

    def nearest_other(hexv, exclude):
        lab = LIB.labs([hexv])[0]
        best, bd = None, 1e9
        for e in out:
            if e is exclude:
                continue
            d = float(LIB.de2000(lab[None], labs[e["h"]][None])[0][0])
            if d < bd:
                best, bd = e, d
        return best

    for old_hex, f in fixes.items():
        e = by_hex.get(old_hex.upper())
        if not e:
            print("FIX NOT APPLIED (hex not found):", old_hex)
            continue
        before = (e["n"], e["h"])
        old_name = e["n"]
        if f.get("h"):
            e["h"] = f["h"].upper()
            labs[e["h"]] = LIB.labs([e["h"]])[0]
            keep, move = [], []
            for a in e.get("also", []):
                le = lib.get(LIB.key(a))
                if le and float(LIB.de2000(labs[e["h"]][None], LIB.labs([le["h"]]))[0][0]) > 5:
                    move.append((a, le["h"]))
                else:
                    keep.append(a)
            for a, ah in move:
                tgt = nearest_other(ah, e)
                tgt["also"] = (tgt.get("also") or []) + [a]
            e["also"] = keep
            if not e["also"]:
                e.pop("also")
        if f.get("drop_also"):
            e["also"] = [a for a in (e.get("also") or []) if LIB.key(a) not in {LIB.key(x) for x in f["drop_also"]}]
            if not e["also"]:
                e.pop("also")
        if f.get("n") and f["n"] != e["n"]:
            e["n"] = f["n"]
            tgt = next((x for x in out if x["n"].lower() == f.get("move_old_to", "").lower()), None) if f.get("move_old_to") else None
            if tgt is not None:
                tgt["also"] = (tgt.get("also") or []) + [old_name]
            elif not f.get("drop_old"):
                e["also"] = [old_name] + [a for a in (e.get("also") or []) if a.lower() != e["n"].lower()]
        log.append((before[0], before[1], e["n"], e["h"], f.get("why", "")))

    def fix_typos(name):
        def sub(m):
            w = m.group(0)
            r = typos.get(w.lower())
            if not r:
                return w
            return r[0].upper() + r[1:] if w[0].isupper() else r
        return re.sub(r"[A-Za-z]+", sub, name)

    prim_keys = {}
    for e in out:
        e["n"] = fix_typos(e["n"])
        prim_keys[LIB.key(e["n"])] = e
    for e in out:
        if e.get("also"):
            seen, res = set(), []
            for a in e["also"]:
                if LIB.key(a) in drop:
                    continue
                a2 = fix_typos(a)
                k = LIB.key(a2)
                other = prim_keys.get(k)
                if (other is not None and other is not e) or k == LIB.key(e["n"]) or k in seen:
                    continue
                seen.add(k)
                res.append(a2)
            if res:
                e["also"] = res[:ALSO_CAP]
            else:
                e.pop("also")

    # compound / modifier flags: `base` is the slug of the root color the name varies (Light Seafoam -> seafoam)
    prim_keys = {LIB.key(e["n"]): e for e in out}
    alias_keys = {}
    for e in out:
        for a in e.get("also", []):
            alias_keys.setdefault(LIB.key(a), e)

    def base_of(name):
        toks = re.split(r"[\s-]+", name.strip())
        if len(toks) >= 2 and toks[0].lower() in MODS:
            rest = LIB.key(" ".join(toks[1:]))
            b = prim_keys.get(rest) or alias_keys.get(rest)   # "Dark Fuchsia" -> Magenta (Fuchsia is its synonym)
            if b is not None and b["n"] != name:
                return b
        if len(toks) >= 2 and toks[-1].lower() in HUE_SUFFIX and toks[-2].lower() not in HUE_SUFFIX:
            b = prim_keys.get(LIB.key(" ".join(toks[:-1])))
            if b is not None and b["n"] != name:
                return b
        return None

    n_comp = 0
    for e in out:
        e.pop("compound", None)
        e.pop("base", None)
        b = base_of(e["n"])
        hops = 0
        while b is not None and hops < 4:
            nb = base_of(b["n"])
            if nb is None:
                break
            b, hops = nb, hops + 1
        if b is not None:
            e["compound"] = True
            e["base"] = slug(b["n"])
            n_comp += 1
    print(f"\nQuality pass: {len(log)} fixes applied, {n_comp} compound names flagged")
    if log:
        print("\nFixes (before -> after):")
        for bn, bh, an, ah, why in log:
            print(f"  {bn:24s} {bh}  ->  {an:24s} {ah}  {why}")


def main():
    report = "--report" in sys.argv[1:]
    app_rows = LIB.load_app()  # [{n, h, src}], curriculum order: basics, then every unit's colors in order
    lib = [e for e in LIB.load_library() if not e.get("crude")]
    silly = LIB.silly_names(lib)

    app_keys = {LIB.key(e["n"]) for e in app_rows}
    lib_by_key = {LIB.key(e["n"]): e for e in lib}
    jp_only = [e for e in lib if e["src"] == ["jp"]]
    rest = [e for e in lib if LIB.key(e["n"]) not in app_keys and e["src"] != ["jp"]]

    # ---------- clusters: {n, h, lab, locked, synth, src, also: [(name, srcs)], notes: [{jp,kanji,meaning}]} ----------
    clusters = []
    centers = None  # numpy (k,3), kept in lockstep with `clusters`
    used_lower = set()
    renames = []  # (original, new, kind) for the before/after report

    def add_cluster(name, hexv, labv, srcs, locked=False, synth=False):
        nonlocal centers
        clusters.append({"n": name, "h": hexv, "lab": labv, "locked": locked, "synth": synth,
                          "src": list(srcs), "also": [], "notes": []})
        centers = labv[None] if centers is None else np.vstack([centers, labv[None]])
        used_lower.add(name.lower())

    def plain_primary_for(e, lab_e):
        """An obscure entry that didn't merge into anything close: try the bare name (paren qualifier
        stripped) first, then fall back to a synthesized base+modifier name."""
        if "(" in e["n"]:
            bare = PAREN_RE.sub("", e["n"]).strip()
            if bare and bare.lower() not in used_lower and not is_obscure(bare, e["src"], silly):
                return bare, "stripped qualifier", False
        return synth_plain_name(lab_e, clusters, centers, used_lower, silly), "synthesized", True

    # 1. the 101 app colors, always present, exact name and hex, never merged into anything else
    for row in app_rows:
        n, h = row["n"], row["h"]
        e = lib_by_key.get(LIB.key(n))
        add_cluster(n, h, LIB.labs([h])[0], e["src"] if e else ["app"], locked=True)

    # 2. every other English-sourced name, best-named first, merged into the nearest cluster within MERGE_DE
    #    (or JUNK_SKIP_DE for a name junk_penalty() already flagged — unchanged from the pre-existing build);
    #    an obscure name (ROADMAP §17 job #1's wider net — is_obscure(), not junk_penalty()) that still doesn't
    #    merge gets a plain primary instead of its raw name, and survives as that new cluster's first synonym.
    #    The two checks are kept separate on purpose: is_obscure() only ever changes what a name LOOKS like
    #    once it's decided to be its own cluster, never which colors merge into which — so every color that
    #    wasn't touched by job #1 keeps exactly the primary it already had.
    rest.sort(key=lambda e: rank_key(e, silly))
    for e in rest:
        lab_e = LIB.labs([e["h"]])[0]
        d = LIB.de2000(lab_e[None], centers)[0]
        j = int(np.argmin(d))
        threshold = JUNK_SKIP_DE if junk_penalty(e["n"], silly) > 0 else MERGE_DE
        if d[j] < threshold:
            if e["n"] != clusters[j]["n"]:
                clusters[j]["also"].append((e["n"], e["src"], round(float(d[j]), 1)))
        elif is_obscure(e["n"], e["src"], silly):
            label, kind, synth = plain_primary_for(e, lab_e)
            add_cluster(label, e["h"], lab_e, e["src"], synth=synth)
            clusters[-1]["also"].append((e["n"], e["src"], 0.0))
            renames.append((e["n"], label, kind))
        else:
            add_cluster(e["n"], e["h"], lab_e, e["src"])

    # 3. Japanese names: a cultural note on the nearest color if one is close; otherwise its English
    #    translation becomes its own primary (never the romaji) — learnable like any other color, with the
    #    romaji/kanji/meaning kept as a notes entry.
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
            label = clean_jp_meaning(jp["meaning"]) or jp["romaji"]
            label = make_unique(label, used_lower)
            if label != jp["romaji"]:
                renames.append((jp["romaji"], label, "Japanese translated"))
            add_cluster(label, e["h"], lab_e, e["src"], synth=True)
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
    free_sorted = sorted([c for c in clusters if not c["locked"]],
                         key=lambda c: (src_rank(c["src"]), junk_penalty(c["n"], silly), c["n"]))
    final = locked_sorted + free_sorted

    out = []
    for i, c in enumerate(final):
        also = sorted(set(a[0] for a in c["also"]) - {c["n"]}, key=lambda n: (next((a[2] for a in c["also"] if a[0] == n), 99), n))[:ALSO_CAP]
        entry = {"n": c["n"], "h": c["h"], "src": c["src"], "rank": i}
        if also:
            entry["also"] = also
        if c["notes"]:
            entry["notes"] = c["notes"][:NOTES_CAP]
        out.append(entry)

    # hand-picked plain names (tools/core-name-overrides.json) win last; the generated name stays as a synonym
    ov = json.loads((ROOT / "tools" / "core-name-overrides.json").read_text(encoding="utf-8"))
    for e in out:
        nn = ov.get(e["h"].upper())
        if nn and nn != e["n"]:
            e["also"] = [e["n"]] + [a for a in (e.get("also") or []) if a.lower() != nn.lower()][:9]
            e["n"] = nn

    # data-quality pass (L15, 2026-10-08): hex fixes, typos, bad synonyms, compound flags
    apply_quality_fixes(out, ov)

    # sanity check: no two primaries are now identical
    seen_names = {}
    dupes = []
    for e in out:
        k = e["n"].lower()
        if k in seen_names:
            dupes.append(e["n"])
        seen_names[k] = True
    if dupes:
        print(f"DUPLICATE PRIMARY NAMES ({len(dupes)}):", dupes)

    lines = [json.dumps(e, ensure_ascii=False, separators=(",", ":")) for e in out]
    OUT.write_text("[\n" + ",\n".join(lines) + "\n]\n", encoding="utf-8")
    size_kb = OUT.stat().st_size / 1024
    print(f"core-names.json: {len(out)} entries ({merged_count} after merge, {len(dropped)} trimmed), {size_kb:.1f} KB")
    out_keys = {LIB.key(e["n"]) for e in out}
    missing = [row["n"] for row in app_rows if LIB.key(row["n"]) not in out_keys]
    if missing:
        print("MISSING app colors:", missing)

    print(f"\nPlain-English renames: {len(renames)} primary names changed")
    by_kind = {}
    for _, _, kind in renames:
        by_kind[kind] = by_kind.get(kind, 0) + 1
    for kind, n in sorted(by_kind.items()):
        print(f"  {kind}: {n}")
    print("\nBefore -> after (sorted):")
    for old, new, kind in sorted(renames, key=lambda r: r[0].lower()):
        print(f"  {old!r:45s} -> {new!r:35s} ({kind})")

    if report:
        print(f"\njp-only primaries: {sum(1 for c in final if c['src'] == ['jp'])}")
        print(f"entries with also-synonyms: {sum(1 for e in out if e.get('also'))}, "
              f"with notes: {sum(1 for e in out if e.get('notes'))}")


if __name__ == "__main__":
    main()
