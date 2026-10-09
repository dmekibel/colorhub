#!/usr/bin/env python3
"""Companion to tools/fix_alias_targets.py. A [[slug]] article link, or a plain slug in an article's
`aside.siblings` / `aside.children` / `aside.disambiguation[].slug`, naming a color that was merged away
as an `altn` (library.json) or `also` (core-names.json) entry should resolve to the PRIMARY it was
documented under (which has its own real page in data/graph/names.json), not whatever data/aliases.json's
separate nearest-CORE-name search happens to say -- that search is for the Learn-layer game/search answer
set, and routinely picks a different, farther color than the name's own documented, resolvable library
neighbor. This rewrites every such reference directly onto the documented primary's own slug, bypassing
data/aliases.json entirely for names that already have a real page to point at.

A name can be claimed by more than one primary (e.g. "Seafoam Green" sits in both "Seafoam"'s `also` list,
by stale name-text similarity -- #80F9AD, a bright mint green -- and "Lemon Meringue"'s, by exact hex,
#E9E0B7, dE 0). Picking the first one found (file order) is how an earlier run of this script got that
one wrong. This version disambiguates by actual CIEDE2000 distance to the name's own best-available hex
(maerz-paul-1930-clean.json's measured hex > an iscc-nbs block centroid > the candidate primary's own hex
as a last resort), and gives top priority to any article's own `names` array -- the most authoritative
record of a merge already applied, since tools/dupe_merge.py writes both names onto the surviving article.

  python3 tools/remap_links_to_primary.py            # apply
  python3 tools/remap_links_to_primary.py --report   # dry run
"""
import glob
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
import numpy as np        # noqa: E402
import library as LIB      # noqa: E402
import build_core_names as BCN   # noqa: E402

LIB_PATH = ROOT / "data" / "library.json"
CORE_PATH = ROOT / "data" / "core-names.json"
ARTICLES_DIR = ROOT / "data" / "articles"
LINKMAP_PATH = ARTICLES_DIR / "link-map.json"
SRC_DIR = ROOT / "data" / "sources"


def load_truth_hexes():
    """name-key -> best-available hex, from the two cited, independently-measured sources."""
    mp = {}
    for line in (SRC_DIR / "maerz-paul-1930-clean.json").read_text(encoding="utf-8").splitlines()[1:]:
        if not line.strip():
            continue
        r = json.loads(line)
        mp.setdefault(LIB.key(r["n"]), r["h"])
    rows = [json.loads(l) for l in (SRC_DIR / "iscc-nbs-names.json").read_text(encoding="utf-8").splitlines()[1:] if l.strip()]
    centroids = {}
    for line in (SRC_DIR / "iscc-nbs-centroids.json").read_text(encoding="utf-8").splitlines()[1:]:
        if not line.strip():
            continue
        r = json.loads(line)
        if "block" in r and "hex" in r:
            centroids[r["block"]] = r["hex"]
    iscc = {}
    for r in rows:
        h = centroids.get(r.get("block"))
        if h:
            iscc.setdefault(LIB.key(r["n"]), h)
    return mp, iscc


def build_remap():
    """alias_slug -> primary_slug, highest-confidence source wins (article `names` arrays last, so they
    override everything -- they reflect merges already applied, not raw documentation)."""
    lib = json.loads(LIB_PATH.read_text(encoding="utf-8"))
    core = json.loads(CORE_PATH.read_text(encoding="utf-8"))
    names_rows = json.loads((ROOT / "data" / "graph" / "names.json").read_text(encoding="utf-8"))
    canonical_slugs = {row[0] for row in names_rows}
    mp_hex, iscc_hex = load_truth_hexes()

    def truth_hex_for(slug_text, fallback):
        k = LIB.key(slug_text.replace("-", " "))
        return mp_hex.get(k) or iscc_hex.get(k) or fallback

    candidates = {}
    for e in lib:
        p_slug = BCN.slug(e["n"])
        if p_slug not in canonical_slugs:
            continue
        for a in e.get("altn", []):
            n = a.get("n") if isinstance(a, dict) else a
            if n:
                candidates.setdefault(BCN.slug(n), {})[p_slug] = e["h"]
    for e in core:
        p_slug = BCN.slug(e["n"])
        if p_slug not in canonical_slugs:
            continue
        for n in e.get("also", []):
            candidates.setdefault(BCN.slug(n), {})[p_slug] = e["h"]

    remap = {}
    for alias_slug, cands in candidates.items():
        if alias_slug in canonical_slugs or alias_slug in cands:
            continue
        if len(cands) == 1:
            remap[alias_slug] = next(iter(cands))
            continue
        truth_h = truth_hex_for(alias_slug, next(iter(cands.values())))
        best_p, best_d = None, 1e9
        for p, h in cands.items():
            d = float(LIB.de2000(LIB.labs([truth_h]), LIB.labs([h]))[0][0])
            if d < best_d:
                best_d, best_p = d, p
        remap[alias_slug] = best_p

    # current data/aliases.json, lower priority than the hex-disambiguated altn/also pass above when both
    # exist (aliases.json's own core-nearest search is what we're routing AROUND)
    aliases_path = ROOT / "data" / "aliases.json"
    if aliases_path.exists():
        aliases = json.loads(aliases_path.read_text(encoding="utf-8"))
        for s, p in aliases.get("slugs", {}).items():
            if s not in remap and s not in canonical_slugs and s != p:
                remap[s] = p

    # highest priority: every article's own `names` array -- it reflects a merge tools/dupe_merge.py has
    # ALREADY applied to that specific article, so it overrides any raw altn/also documentation or stale
    # aliases.json entry for the same name.
    for f in glob.glob(str(ARTICLES_DIR / "*.json")):
        if f.endswith("link-map.json") or f.endswith("index.json"):
            continue
        d = json.loads(Path(f).read_text(encoding="utf-8"))
        slug = d.get("slug")
        if not slug:
            continue
        for n in d.get("names", [])[1:]:
            s = BCN.slug(n)
            if s != slug:
                remap[s] = slug

    remap = {a: p for a, p in remap.items() if a != p and a not in canonical_slugs}
    return remap


def load_lookalikes():
    """slug -> [nearest-first look-alike slugs], from data/graph/edges-*.json's own `la` field -- used to
    backfill an article's connection count (siblings + children + parent + body [[links]]) back up to the
    article_gate.py minimum of 4 when de-duplicating a remapped sibling/child drops it below that."""
    la = {}
    for p in sorted((ROOT / "data" / "graph").glob("edges-*.json")):
        for e in json.loads(p.read_text(encoding="utf-8")):
            s = e.get("s")
            if s:
                la[s] = [x[0] for x in (e.get("la") or [])]
    return la


def main():
    report = "--report" in sys.argv[1:]
    remap = build_remap()
    lookalikes = load_lookalikes()

    if report:
        print(f"{len(remap)} alias-slug -> primary-slug direct remaps available")

    link_pattern = re.compile(r"\[\[([a-z0-9-]+)((?:\|[^\]]*)?)\]\]")
    fixed_files, fixed_links, fixed_aside = [], 0, 0

    def fix_links(s):
        nonlocal fixed_links

        def repl(m):
            nonlocal fixed_links
            slug_, rest = m.group(1), m.group(2)
            if slug_ in remap:
                fixed_links += 1
                return f"[[{remap[slug_]}{rest}]]"
            return m.group(0)
        return link_pattern.sub(repl, s)

    def fix_slug_list(lst):
        """aside.siblings / aside.children: plain list of slugs (not [[link]] syntax)."""
        nonlocal fixed_aside
        out, seen = [], set()
        for s in lst:
            if s in remap:
                fixed_aside += 1
                s = remap[s]
            if s not in seen:
                seen.add(s)
                out.append(s)
        return out

    def fix_disambiguation(lst):
        nonlocal fixed_aside
        out = []
        for item in lst:
            if isinstance(item, dict) and item.get("slug") in remap:
                fixed_aside += 1
                out.append({**item, "slug": remap[item["slug"]]})
            else:
                out.append(item)
        return out

    def walk_text(obj):
        if isinstance(obj, str):
            return fix_links(obj)
        if isinstance(obj, list):
            return [walk_text(x) for x in obj]
        if isinstance(obj, dict):
            return {k: walk_text(v) for k, v in obj.items()}
        return obj

    for p in sorted(ARTICLES_DIR.glob("*.json")):
        if p.name in ("link-map.json", "index.json"):
            continue
        raw = p.read_text(encoding="utf-8")
        if not any(s in raw for s in remap):
            continue
        doc = json.loads(raw)
        changed = False
        doc2 = walk_text(doc)
        if doc2 != doc:
            changed = True
            doc = doc2
        aside = doc.get("aside")
        if isinstance(aside, dict):
            before_sib = aside.get("siblings")
            if isinstance(before_sib, list):
                new_sib = fix_slug_list(before_sib)
                if new_sib != before_sib:
                    aside["siblings"] = new_sib
                    changed = True
            before_ch = aside.get("children")
            if isinstance(before_ch, list):
                new_ch = fix_slug_list(before_ch)
                if new_ch != before_ch:
                    aside["children"] = new_ch
                    changed = True
            before_dis = aside.get("disambiguation")
            if isinstance(before_dis, list):
                new_dis = fix_disambiguation(before_dis)
                if new_dis != before_dis:
                    aside["disambiguation"] = new_dis
                    changed = True
            before_parent = aside.get("parent")
            if isinstance(before_parent, str) and before_parent in remap:
                aside["parent"] = remap[before_parent]
                fixed_aside += 1
                changed = True
            # backfill: de-duplicating a remapped sibling/child can drop the article below
            # article_gate.py's 4-connection minimum (siblings + children + parent + body [[links]]) --
            # top it back up with the article's own nearest real look-alikes before that happens.
            if changed:
                own_slug = doc.get("slug") or p.stem
                body_links = set()
                for text in [doc.get("lede", "")] + [s.get("body", "") for s in doc.get("sections", [])]:
                    body_links |= {m.group(1) for m in link_pattern.finditer(text or "")}
                conns = set(aside.get("siblings") or []) | set(aside.get("children") or []) | body_links
                if aside.get("parent"):
                    conns.add(aside["parent"])
                conns.discard(own_slug)
                if len(conns) < 4:
                    siblings = aside.setdefault("siblings", [])
                    for cand in lookalikes.get(own_slug, []):
                        if cand == own_slug or cand in conns:
                            continue
                        siblings.append(cand)
                        conns.add(cand)
                        if len(conns) >= 4:
                            break
        if changed:
            fixed_files.append(p.name)
            if not report:
                p.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    lm_fixed = []
    if LINKMAP_PATH.exists():
        lm = json.loads(LINKMAP_PATH.read_text(encoding="utf-8"))
        for k, v in lm.get("links", {}).items():
            to = v.get("to")
            if to in remap:
                lm_fixed.append((k, to, remap[to]))
                if not report:
                    v["to"] = remap[to]
        if lm_fixed and not report:
            LINKMAP_PATH.write_text(json.dumps(lm, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"article [[link]] fixes: {fixed_links}")
    print(f"article aside (siblings/children/disambiguation) fixes: {fixed_aside}")
    print(f"files touched: {len(fixed_files)}")
    print(f"link-map.json fixes: {len(lm_fixed)}")
    for k, old, new in lm_fixed:
        print(f"  {k} -> {old} became -> {new}")


if __name__ == "__main__":
    main()
