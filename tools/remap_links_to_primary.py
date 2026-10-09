#!/usr/bin/env python3
"""Companion to tools/fix_alias_targets.py. A [[slug]] article link to a name that was merged away as an
`altn` (library.json) or `also` (core-names.json) entry should open the PRIMARY it was documented under
(which has its own real page in data/graph/names.json), not whatever data/aliases.json's separate
nearest-CORE-name search happens to say -- that search is for the Learn-layer game/search answer set, and
routinely picks a different, farther color than the name's own documented, resolvable library neighbor.
This rewrites every such [[alias-slug]] / [[alias-slug|label]] link in data/articles/*.json (and every
`to` in data/articles/link-map.json) directly onto the documented primary's own slug, bypassing
data/aliases.json entirely for names that already have a real page to point at.

  python3 tools/remap_links_to_primary.py            # apply
  python3 tools/remap_links_to_primary.py --report   # dry run
"""
import json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
import build_core_names as BCN   # noqa: E402

LIB_PATH = ROOT / "data" / "library.json"
CORE_PATH = ROOT / "data" / "core-names.json"
ARTICLES_DIR = ROOT / "data" / "articles"
LINKMAP_PATH = ARTICLES_DIR / "link-map.json"


def main():
    report = "--report" in sys.argv[1:]
    lib = json.loads(LIB_PATH.read_text(encoding="utf-8"))
    core = json.loads(CORE_PATH.read_text(encoding="utf-8"))
    names_rows = json.loads((ROOT / "data" / "graph" / "names.json").read_text(encoding="utf-8"))
    canonical_slugs = {row[0] for row in names_rows}

    remap = {}  # alias_slug -> primary_slug, only when the primary is itself a real canonical page
    for e in lib:
        p_slug = BCN.slug(e["n"])
        if p_slug not in canonical_slugs:
            continue
        for a in e.get("altn", []):
            n = a.get("n") if isinstance(a, dict) else a
            if n:
                remap.setdefault(BCN.slug(n), p_slug)
    for e in core:
        p_slug = BCN.slug(e["n"])
        if p_slug not in canonical_slugs:
            continue
        for n in e.get("also", []):
            remap.setdefault(BCN.slug(n), p_slug)
    # never remap a slug onto itself, and never remap something that IS itself canonical (it already has
    # its own page; an altn/also note on some other entry doesn't override that)
    remap = {a: p for a, p in remap.items() if a != p and a not in canonical_slugs}

    if report:
        print(f"{len(remap)} alias-slug -> primary-slug direct link remaps available")

    pattern = re.compile(r"\[\[([a-z0-9-]+)((?:\|[^\]]*)?)\]\]")
    fixed_files, fixed_links = [], 0

    def fix_text(s):
        nonlocal fixed_links

        def repl(m):
            nonlocal fixed_links
            slug_, rest = m.group(1), m.group(2)
            if slug_ in remap:
                fixed_links += 1
                return f"[[{remap[slug_]}{rest}]]"
            return m.group(0)
        return pattern.sub(repl, s)

    def walk(obj):
        if isinstance(obj, str):
            return fix_text(obj)
        if isinstance(obj, list):
            return [walk(x) for x in obj]
        if isinstance(obj, dict):
            return {k: walk(v) for k, v in obj.items()}
        return obj

    for p in sorted(ARTICLES_DIR.glob("*.json")):
        if p.name in ("link-map.json", "index.json"):
            continue
        raw = p.read_text(encoding="utf-8")
        if not any(f"[[{s}" in raw for s in remap):
            continue
        doc = json.loads(raw)
        doc2 = walk(doc)
        if doc2 != doc:
            fixed_files.append(p.name)
            if not report:
                p.write_text(json.dumps(doc2, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

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

    print(f"article [[link]] fixes: {fixed_links} in {len(fixed_files)} files")
    print(f"link-map.json fixes: {len(lm_fixed)}")
    for k, old, new in lm_fixed:
        print(f"  {k} -> {old} became -> {new}")


if __name__ == "__main__":
    main()
