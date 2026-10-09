#!/usr/bin/env python3
"""One-time, re-runnable (idempotent) fix for the 2026-10-09 Opus article audit: data/aliases.json sends
some slugs to the wrong color (dark-seafoam -> jade, greenish-teal -> jade, light-navy-blue -> dusk-blue,
while data/library.json files those names under Green (Crayola), Imperial Green and Newport), so a
[[slug]] article link opens a color that isn't the one named.

Root cause: data/aliases.json's `slugs`/`names` must resolve to a CORE name (check_solvable.js enforces
this -- it's the game's own answer set), so every alias's target is picked by nearest-CIEDE2000-to-a-core-
name at some point in this data's history. For names whose own color was never itself a core name, that
nearest-core search was run separately from (and sometimes long after) the altn/also merge that correctly
filed the name under its true library.json neighbor -- and the two searches disagree, sometimes by a lot.

This script rebuilds a "true hex" for every name that appears in a library.json `altn` or core-names.json
`also` list (the data's own record of "this name belongs near here"), using the best source available:
  1. data/sources/maerz-paul-1930-clean.json's own measured hex, when the name is a Maerz & Paul plate name
  2. data/sources/iscc-nbs-centroids.json's block centroid, when the name only carries an ISCC-NBS block
  3. the altn/also primary's own hex, as a last-resort proxy (the recorded note dE is usually small)
then finds that name's TRUE nearest core name by CIEDE2000 (not the altn/also primary, which may not be a
core name at all) and compares it with data/aliases.json's current target. If the current target is more
than dE2000 3 from the true hex, it's retargeted to the true nearest core name (if one exists within a
reasonable dE2000 8) or dropped from data/aliases.json entirely otherwise (a far-off core target is worse
than no link; CLAUDE.md's "drop the alias, keep the library entry as its own page" -- this script doesn't
reconstruct a standalone library.json entry, since the name was deliberately merged away for a documented
reason elsewhere; dropping here only removes the now-known-wrong CORE-name routing).

  python3 tools/fix_alias_targets.py            # apply
  python3 tools/fix_alias_targets.py --report   # dry run, print every change, write nothing
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
LINKMAP_PATH = ROOT / "data" / "articles" / "link-map.json"
SRC_DIR = ROOT / "data" / "sources"

DE_OK = 3.0        # current target must be within this of the true hex, or it's wrong
DE_RETARGET_MAX = DE_OK  # a replacement core name must ALSO be within this, or there simply isn't a good
# core match for this name and the honest fix is to drop the alias rather than point at another mediocre one


def load_truth_hexes(lib, core):
    """name_key -> (true_hex, source_label), for every name documented in an altn (library.json) or also
    (core-names.json) list, best source first."""
    mp = {}
    for line in (SRC_DIR / "maerz-paul-1930-clean.json").read_text(encoding="utf-8").splitlines()[1:]:
        if not line.strip():
            continue
        r = json.loads(line)
        mp.setdefault(LIB.key(r["n"]), r["h"])

    names_rows = [json.loads(l) for l in (SRC_DIR / "iscc-nbs-names.json").read_text(encoding="utf-8").splitlines()[1:] if l.strip()]
    centroids = {}
    for line in (SRC_DIR / "iscc-nbs-centroids.json").read_text(encoding="utf-8").splitlines()[1:]:
        if not line.strip():
            continue
        r = json.loads(line)
        if "block" in r and "hex" in r:
            centroids[r["block"]] = r["hex"]
    iscc_hex = {}
    for r in names_rows:
        hx = centroids.get(r.get("block"))
        if hx:
            iscc_hex.setdefault(LIB.key(r["n"]), hx)

    truth = {}

    def record(name, primary_hex):
        k = LIB.key(name)
        if k in truth:
            return
        if k in mp:
            truth[k] = (mp[k], "maerz-paul exact")
        elif k in iscc_hex:
            truth[k] = (iscc_hex[k], "iscc-nbs block centroid")
        else:
            truth[k] = (primary_hex, "altn/also primary (proxy)")

    for e in lib:
        for a in e.get("altn", []):
            n = a.get("n") if isinstance(a, dict) else a
            if n:
                record(n, e["h"])
    for e in core:
        for n in e.get("also", []):
            record(n, e["h"])
    return truth


def nearest_core(hexv, core_hexes, core_names):
    lab = LIB.labs([hexv])[0]
    d = LIB.de2000(lab[None], core_hexes)[0]
    j = int(np.argmin(d))
    return core_names[j], float(d[j])


def slugs_referenced_in_articles():
    """Every slug any committed article still references, via a [[link]] or a plain aside.siblings /
    aside.children / aside.disambiguation[].slug / aside.parent entry. Dropping an alias a reference
    still names turns a wrong link into a dangling one -- same failure, worse, since it can't even be
    found by searching for the word "alias" any more. tools/remap_links_to_primary.py should always run
    before this script so the set below is small/empty in practice; this is the backstop, not the fix."""
    link_pattern = re.compile(r"\[\[([^\]|]+)")
    referenced = set()
    for p in sorted(ARTICLES_DIR.glob("*.json")):
        if p.name in ("link-map.json", "index.json"):
            continue
        doc = json.loads(p.read_text(encoding="utf-8"))
        for text in [doc.get("lede", "")] + [s.get("body", "") for s in doc.get("sections", [])]:
            for m in link_pattern.finditer(text or ""):
                tgt = m.group(1)
                if ":" not in tgt:
                    referenced.add(tgt)
        aside = doc.get("aside") or {}
        referenced |= set(aside.get("siblings") or [])
        referenced |= set(aside.get("children") or [])
        if aside.get("parent"):
            referenced.add(aside["parent"])
        for d in aside.get("disambiguation") or []:
            if isinstance(d, dict) and d.get("slug"):
                referenced.add(d["slug"])
    return referenced


def main():
    report = "--report" in sys.argv[1:]
    lib = json.loads(LIB_PATH.read_text(encoding="utf-8"))
    core = json.loads(CORE_PATH.read_text(encoding="utf-8"))
    aliases = json.loads(ALIASES_PATH.read_text(encoding="utf-8"))
    referenced = slugs_referenced_in_articles()

    truth = load_truth_hexes(lib, core)
    core_names = [e["n"] for e in core]
    core_hex_by_slug = {BCN.slug(e["n"]): e["h"] for e in core}
    core_hexes = LIB.labs([e["h"] for e in core])
    core_slug_set = set(core_hex_by_slug)

    slugs_map = aliases["slugs"]
    names_map = aliases["names"]
    slug_to_name = {}
    for k, v in names_map.items():
        slug_to_name.setdefault(BCN.slug(k), []).append(k)

    retargeted, dropped, refused = [], [], []
    # a name that is STILL its own live library.json/core-names.json entry resolves to its own page before
    # js/router.js ever consults data/aliases.json (routeNameAsync checks core names, then the library, and
    # only then the alias map) -- an also/altn note on some other entry doesn't make it an alias, so leave
    # those alone entirely, whatever data/aliases.json happens to say about that slug.
    live_slugs = {BCN.slug(e["n"]) for e in lib} | {BCN.slug(e["n"]) for e in core}

    # we need the original display spelling, not just the name_key, to compute each name's slug (the
    # dict in `truth` is keyed by LIB.key(), which is lossy for slugging) -- rebuild keyed by slug instead
    truth_by_slug = {}
    for e in lib:
        for a in e.get("altn", []):
            n = a.get("n") if isinstance(a, dict) else a
            if not n:
                continue
            k = LIB.key(n)
            s = BCN.slug(n)
            if k in truth and s not in live_slugs:
                truth_by_slug.setdefault(s, truth[k])
    for e in core:
        for n in e.get("also", []):
            k = LIB.key(n)
            s = BCN.slug(n)
            if k in truth and s not in live_slugs:
                truth_by_slug.setdefault(s, truth[k])

    for alias_slug, (true_hex, truth_src) in sorted(truth_by_slug.items()):
        cur_target_slug = slugs_map.get(alias_slug)
        if cur_target_slug is None or cur_target_slug not in core_hex_by_slug:
            continue
        cur_hex = core_hex_by_slug[cur_target_slug]
        de_cur = float(LIB.de2000(LIB.labs([true_hex]), LIB.labs([cur_hex]))[0][0])
        if de_cur <= DE_OK:
            continue
        best_name, de_best = nearest_core(true_hex, core_hexes, core_names)
        best_slug = BCN.slug(best_name)
        if best_slug == cur_target_slug:
            # the current target already IS the nearest core name there is -- if that's still > DE_OK, no
            # retarget would help, so drop rather than leave a known-too-far alias in place -- unless an
            # article still names this slug, in which case dropping would turn a wrong link into a
            # dangling one, which is worse; refuse and leave the (known-imprecise) alias in place instead
            if de_best > DE_RETARGET_MAX:
                if alias_slug in referenced:
                    refused.append((alias_slug, cur_target_slug, round(de_cur, 2), truth_src))
                else:
                    dropped.append((alias_slug, cur_target_slug, round(de_cur, 2), truth_src))
            continue
        if de_best <= DE_RETARGET_MAX:
            retargeted.append((alias_slug, cur_target_slug, best_slug, round(de_cur, 2), round(de_best, 2), truth_src))
        elif alias_slug in referenced:
            refused.append((alias_slug, cur_target_slug, round(de_cur, 2), truth_src))
        else:
            dropped.append((alias_slug, cur_target_slug, round(de_cur, 2), truth_src))

    if report:
        print(f"{len(retargeted)} to retarget, {len(dropped)} to drop, {len(refused)} refused-to-drop "
              f"(still referenced in an article) (current target > dE {DE_OK} from true hex)")
        for a, old, new, de_old, de_new, src in retargeted:
            print(f"  RETARGET {a:28s} {old:22s} -> {new:22s}  dE {de_old} -> {de_new}  [{src}]")
        for a, old, de_old, src in dropped:
            print(f"  DROP     {a:28s} (was {old}, dE {de_old})  [{src}]")
        for a, old, de_old, src in refused:
            print(f"  REFUSED  {a:28s} (was {old}, dE {de_old}) -- still referenced in an article; run "
                  f"tools/remap_links_to_primary.py first  [{src}]")
        return

    for alias_slug, old_slug, new_slug, de_old, de_new, src in retargeted:
        new_name = next((e["n"] for e in core if BCN.slug(e["n"]) == new_slug), new_slug)
        slugs_map[alias_slug] = new_slug
        for disp in slug_to_name.get(alias_slug, []):
            if BCN.slug(names_map.get(disp, "")) == old_slug:
                names_map[disp] = new_name

    for alias_slug, old_slug, de_old, src in dropped:
        slugs_map.pop(alias_slug, None)
        for disp in list(slug_to_name.get(alias_slug, [])):
            if BCN.slug(names_map.get(disp, "")) == old_slug:
                names_map.pop(disp, None)

    aliases["slugs"] = dict(sorted(slugs_map.items()))
    aliases["names"] = dict(sorted(names_map.items()))
    ALIASES_PATH.write_text(json.dumps(aliases, ensure_ascii=False, indent=0, separators=(",", ":")) + "\n", encoding="utf-8")

    # link-map.json: same dE>3 check against its "to" targets
    lm_fixed = []
    if LINKMAP_PATH.exists():
        lm = json.loads(LINKMAP_PATH.read_text(encoding="utf-8"))
        for k, v in list(lm.get("links", {}).items()):
            truth_e = truth_by_slug.get(k)
            to = v.get("to")
            if not truth_e or not to or to not in core_hex_by_slug:
                continue
            true_hex, src = truth_e
            de = float(LIB.de2000(LIB.labs([true_hex]), LIB.labs([core_hex_by_slug[to]]))[0][0])
            if de > DE_OK:
                best_name, de_best = nearest_core(true_hex, core_hexes, core_names)
                best_slug = BCN.slug(best_name)
                if de_best <= DE_RETARGET_MAX and best_slug != to:
                    lm_fixed.append((k, to, best_slug, round(de, 2), round(de_best, 2)))
                    v["to"] = best_slug
        if lm_fixed:
            LINKMAP_PATH.write_text(json.dumps(lm, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"retargeted: {len(retargeted)}")
    for a, old, new, de_old, de_new, src in retargeted[:20]:
        print(f"  {a:28s} {old:22s} -> {new:22s}  dE {de_old} -> {de_new}")
    if len(retargeted) > 20:
        print(f"  ... and {len(retargeted) - 20} more")
    print(f"dropped: {len(dropped)}")
    for a, old, de_old, src in dropped[:20]:
        print(f"  {a:28s} (was {old}, dE {de_old})")
    if len(dropped) > 20:
        print(f"  ... and {len(dropped) - 20} more")
    print(f"refused to drop (still referenced in an article): {len(refused)}")
    for a, old, de_old, src in refused[:20]:
        print(f"  {a:28s} (was {old}, dE {de_old}) -- run tools/remap_links_to_primary.py first")
    if len(refused) > 20:
        print(f"  ... and {len(refused) - 20} more")
    print(f"link-map.json fixed: {len(lm_fixed)}")
    for k, old, new, de_old, de_new in lm_fixed:
        print(f"  {k:28s} {old:22s} -> {new:22s}  dE {de_old} -> {de_new}")


if __name__ == "__main__":
    main()
