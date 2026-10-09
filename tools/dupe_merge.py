#!/usr/bin/env python3
"""One-time, re-runnable (idempotent) fix for David's 2026-10-09 "one swatch = one color tile" audit
(triggered by: he clicked Pebble Grey and was told it's identical to Quaker Drab). The real, current cause
is NOT the specific graph-stale examples first reported (those pairs -- Pebble Grey/Quaker Drab, Endive
Blue/Light Blue Grey, Clay/Testaceous, Pure Red/Signal Red, Dusty Blue/Glaucous, Dark Olive Grey/Yellow
Olive, Violet Blue/Violet-Blue (Crayola), Vinaceous-Fawn/Fawn, Ochraceous-Salmon/Light Orange, Pale Black
Shade/Pale Black Hue, Pearl Copper/Copper Brown, Pale Greyish Vinaceous/Shell Pink -- already have DIFFERENT
hexes in the current data/library.json; data/graph just hasn't been rebuilt since, and a plain
`python3 tools/graph_build.py` resolves every one of them with no data edit).

The real, live duplication is systemic: data/core-names.json (the Learn layer) already renames and
alias-links a huge number of data/library.json (the Archive layer) entries via its own `also` field -- but
data/library.json still carries the aliased name as a FULL, independent entry with the identical hex, and
tools/graph_build.py gives every library.json entry its own graph node/page regardless of any `also` link.
Net effect: every one of those pairs gets two live, independently addressable color pages for one swatch.
A full dE2000 scan of library.json ∪ core-names.json found 97 such pairs at dE2000 < 1.0 (and zero more in
the 1.0-2.0 review band): 91 already named in the core entry's own `also` list, 6 clear spelling/naming
variants (Light Lavendar/Light Orchid, Terracota/Deep Terracotta, Seafoam Green/Lemon Meringue, Dark Ash/
Grey Aqua, Wedgewood Blue/Wedgwood Blue, Perrywinkle/Wisteria Blue) not yet linked. See design/NAMES-
DUPLICATES.md for the full group list.

Policy (per CLAUDE.md "one swatch = one color tile" + David's naming policy, prefer the Learn-layer name):
keep is always the core-names.json entry (it's already the Learn-layer title); the library-only entry is
dropped as a standalone Archive page and survives only as a search alias (data/aliases.json) plus the
`also` entry core-names.json already carries (or now gets, for the 6 unlinked spelling variants).

  python3 tools/dupe_merge.py            # apply (writes library.json, core-names.json, aliases.json, articles/*)
  python3 tools/dupe_merge.py --report   # dry run, print the merges, write nothing

Article handling: if the dropped name has its own article and the kept name does too, the dropped one is
folded into the kept one (its name is added to the kept article's `aside.aka`, a data note citing its
distinct source/date is appended if it differs) and then deleted. If only the dropped name has an article,
that article is renamed onto the kept slug/name (content kept, `aside.aka` gets the dropped name) rather
than deleted, since it would otherwise be the color's only article. Every surviving article's [[slug]] wiki
link pointing at a dropped slug is remapped to the kept slug.

Safe to rerun: a name already merged away is skipped (library.json no longer has it).
"""
import json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
import library as LIB            # noqa: E402
import build_core_names as BCN   # noqa: E402

LIB_PATH = ROOT / "data" / "library.json"
CORE_PATH = ROOT / "data" / "core-names.json"
ALIASES_PATH = ROOT / "data" / "aliases.json"
ARTICLES_DIR = ROOT / "data" / "articles"

def find_dupe_groups(lib, core):
    """dE2000 < 1.0 across library.json ∪ core-names.json (entries present in both, by name key, are the
    same record and excluded). Returns [(keep_core_name, drop_lib_name, dE)]."""
    # pool keyed by (name_key, hex): a same-named entry in the other file with a DIFFERENT hex is a separate
    # pre-existing data collision (28 of them: core-names.json and library.json disagree on one name's hex --
    # see design/NAMES-DUPLICATES.md), not a duplicate-tile pair, and must not be silently dropped from the
    # pool just because its name key matches.
    seen_combo = set()
    pool = []
    for e in lib:
        k = (LIB.key(e["n"]), e["h"])
        if k in seen_combo:
            continue
        seen_combo.add(k)
        pool.append(("lib", e["n"], e["h"]))
    for e in core:
        k = (LIB.key(e["n"]), e["h"])
        if k in seen_combo:
            continue
        seen_combo.add(k)
        pool.append(("core", e["n"], e["h"]))
    names = [p[1] for p in pool]
    hexes = [p[2] for p in pool]
    origin = [p[0] for p in pool]
    labs = LIB.labs(hexes)
    N = len(pool)
    groups = []
    chunk = 400
    for i0 in range(0, N, chunk):
        i1 = min(i0 + chunk, N)
        d = LIB.de2000(labs[i0:i1], labs)
        for ii, i in enumerate(range(i0, i1)):
            row = d[ii]
            for j in range(i + 1, N):
                if row[j] < 1.0:
                    ni, nj, oi, oj = names[i], names[j], origin[i], origin[j]
                    if oi == "core" and oj != "core":
                        groups.append((ni, nj, float(row[j])))
                    elif oj == "core" and oi != "core":
                        groups.append((nj, ni, float(row[j])))
                    # core-vs-core or lib-vs-lib: none found in this dataset; skip silently if it ever occurs
    return groups


def main():
    report = "--report" in sys.argv[1:]
    lib = json.loads(LIB_PATH.read_text(encoding="utf-8"))
    core = json.loads(CORE_PATH.read_text(encoding="utf-8"))
    aliases = json.loads(ALIASES_PATH.read_text(encoding="utf-8"))

    lib_by_key = {LIB.key(e["n"]): e for e in lib}
    core_by_key = {LIB.key(e["n"]): e for e in core}

    groups = find_dupe_groups(lib, core)
    # de-dup (a name could theoretically appear twice if both EXTRA_ALSO and the scan found it -- not the
    # case today, but keep it safe for reruns after upstream data changes)
    seen = set()
    uniq = []
    for keep, drop, de in groups:
        k = (LIB.key(keep), LIB.key(drop))
        if k in seen:
            continue
        seen.add(k)
        uniq.append((keep, drop, de))
    groups = uniq

    if report:
        print(f"{len(groups)} dupe groups found (dE2000 < 1.0, library.json entry aliased under a core name)")
        for keep, drop, de in sorted(groups):
            in_also = drop.lower() in {a.lower() for a in (core_by_key[LIB.key(keep)].get("also") or [])}
            print(f"  keep={keep!r:28s} drop={drop!r:28s} dE={de:.2f}  already_linked={in_also}")
        return

    names_map, slugs_map = aliases.setdefault("names", {}), aliases.setdefault("slugs", {})
    merged_list = aliases.setdefault("merged", [])

    dropped_lib_names = []
    article_ops = []  # (keep_name, drop_name)

    for keep, drop, de in groups:
        core_e = core_by_key.get(LIB.key(keep))
        lib_e = lib_by_key.get(LIB.key(drop))
        if core_e is None or lib_e is None:
            continue  # already merged away in a previous run
        # 1. link in core's `also` if not already there
        also = core_e.setdefault("also", [])
        if not any(LIB.key(a) == LIB.key(drop) for a in also):
            also.append(drop)
        # 2. merge library src/date info onto the core entry (so "also called X (src, date)" has data)
        core_src = set(core_e.get("src", []))
        for s in lib_e.get("src", []):
            core_src.add(s)
        core_e["src"] = sorted(core_src, key=lambda x: BCN.SRC_RANK.get(x, 6))
        # 3. drop the library-only standalone entry
        dropped_lib_names.append(drop)
        article_ops.append((keep, drop, de))

    lib2 = [e for e in lib if not any(LIB.key(e["n"]) == LIB.key(d) for d in dropped_lib_names)]

    # 4. aliases.json: point the dropped name/slug at the kept name/slug
    for keep, drop, de in article_ops:
        ks, ds = BCN.slug(keep), BCN.slug(drop)
        names_map[drop] = keep
        slugs_map[ds] = ks
        if not any(m[0] == keep and m[1] == drop for m in merged_list):
            merged_list.append([keep, drop, round(de, 2)])
    aliases["names"] = dict(sorted(names_map.items()))
    aliases["slugs"] = dict(sorted(slugs_map.items()))
    aliases["merged"] = merged_list

    # 5. articles: fold or promote, then delete the drop-side file
    renamed, folded, untouched = [], [], []
    slug_remap = {}  # old drop slug -> kept slug, for sitewide [[link]] remap
    for keep, drop, de in article_ops:
        ks, ds = BCN.slug(keep), BCN.slug(drop)
        slug_remap[ds] = ks
        keep_path = ARTICLES_DIR / f"{ks}.json"
        drop_path = ARTICLES_DIR / f"{ds}.json"
        if not drop_path.exists():
            untouched.append((keep, drop))
            continue
        drop_doc = json.loads(drop_path.read_text(encoding="utf-8"))
        src_note = None
        drop_srcs = lib_by_key.get(LIB.key(drop), {}).get("src", [])
        if drop_srcs:
            src_note = "+".join(drop_srcs)
        if keep_path.exists():
            keep_doc = json.loads(keep_path.read_text(encoding="utf-8"))
            names_list = keep_doc.setdefault("names", [])
            if drop not in names_list:
                names_list.append(drop)
            aside = keep_doc.setdefault("aside", {})
            aka = aside.setdefault("aka", [])
            label = f"{drop} ({src_note})" if src_note else drop
            if not any(drop.lower() in a.lower() for a in aka):
                aka.append(label)
            keep_path.write_text(json.dumps(keep_doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            drop_path.unlink()
            folded.append((keep, drop))
        else:
            # promote: this article becomes the kept name's page. The article's own prose was written
            # with `drop` as the subject (that's the name it was an article about) -- rewrite every
            # mention of the dropped name to the kept name throughout (lede, section bodies, questions,
            # openers), drop any now-circular self-reference to the kept slug/name, and keep the dropped
            # name as a documented "also called" rather than erasing it.
            drop_rx = re.compile(re.escape(drop), re.IGNORECASE)

            def rename_text(s):
                def repl(m):
                    # preserve the matched capitalization pattern loosely: if the match started with an
                    # uppercase letter, title-case the replacement's first letter too
                    return keep if m.group(0)[:1].isupper() else keep[:1].lower() + keep[1:]
                return drop_rx.sub(repl, s)

            self_link_rx = re.compile(r"\[\[" + re.escape(ks) + r"(\|[^\]]*)?\]\]")

            def strip_self_link(s):
                def repl(m):
                    label = m.group(1)[1:] if m.group(1) else keep
                    return label
                return self_link_rx.sub(repl, s)

            drop_doc["slug"] = ks
            drop_doc["name"] = keep
            if drop_doc.get("lede"):
                drop_doc["lede"] = strip_self_link(rename_text(drop_doc["lede"]))
            for sec in drop_doc.get("sections", []):
                if sec.get("body"):
                    sec["body"] = strip_self_link(rename_text(sec["body"]))
            for q in drop_doc.get("questions", []):
                if q.get("q"):
                    q["q"] = rename_text(q["q"])
            drop_doc["openers"] = [rename_text(o) for o in drop_doc.get("openers", [])]
            fld = drop_doc.get("field") or {}
            nearest = ((fld.get("measured") or {}).get("nearest"))
            if isinstance(nearest, list):
                fld["measured"]["nearest"] = [n for n in nearest if not (isinstance(n, list) and LIB.key(n[0]) == LIB.key(keep))]
            names_list = drop_doc.setdefault("names", [])
            if keep not in names_list:
                names_list.insert(0, keep)
            if drop not in names_list:
                names_list.append(drop)
            aside = drop_doc.setdefault("aside", {})
            aside["siblings"] = [s for s in (aside.get("siblings") or []) if s != ks]
            aside["disambiguation"] = [d for d in (aside.get("disambiguation") or []) if d.get("slug") != ks]
            aka = aside.setdefault("aka", [])
            if not any(drop.lower() in a.lower() for a in aka):
                aka.append(drop)
            drop_path.unlink()
            keep_path.write_text(json.dumps(drop_doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            renamed.append((keep, drop))

    # 6. remap [[slug]] / [[slug|text]] links sitewide from any dropped slug onto its kept slug
    link_fix_count = 0
    files_fixed = []
    if slug_remap:
        pattern = re.compile(r"\[\[([a-z0-9-]+)((?:\|[^\]]*)?)\]\]")

        def fix_text(s):
            nonlocal link_fix_count

            def repl(m):
                nonlocal link_fix_count
                slug_, rest = m.group(1), m.group(2)
                if slug_ in slug_remap:
                    link_fix_count += 1
                    return f"[[{slug_remap[slug_]}{rest}]]"
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
            raw = p.read_text(encoding="utf-8")
            if not any(f"[[{s}" in raw for s in slug_remap):
                continue
            doc = json.loads(raw)
            doc2 = walk(doc)
            new_raw = json.dumps(doc2, ensure_ascii=False, indent=2) + "\n"
            if doc2 != doc:
                p.write_text(new_raw, encoding="utf-8")
                files_fixed.append(p.name)

    # 7. write library.json / core-names.json / aliases.json
    order = __import__("library_final").ORDER
    lib_lines = [json.dumps({k: e[k] for k in order if k in e}, ensure_ascii=False, separators=(",", ":")) for e in lib2]
    LIB_PATH.write_text("[\n" + ",\n".join(lib_lines) + "\n]\n", encoding="utf-8")
    core_lines = [json.dumps(e, ensure_ascii=False, separators=(",", ":")) for e in core]
    CORE_PATH.write_text("[\n" + ",\n".join(core_lines) + "\n]\n", encoding="utf-8")
    ALIASES_PATH.write_text(json.dumps(aliases, ensure_ascii=False, indent=0, separators=(",", ":")) + "\n", encoding="utf-8")

    print(f"groups merged: {len(article_ops)}")
    print(f"library.json: {len(lib)} -> {len(lib2)} entries ({len(dropped_lib_names)} dropped)")
    print(f"aliases.json: {len(aliases['slugs'])} slugs, {len(aliases['merged'])} merged pairs")
    print(f"articles folded (both existed): {len(folded)}")
    print(f"articles renamed/promoted (only drop existed): {len(renamed)}")
    print(f"article pairs with no article either side: {len(untouched)}")
    print(f"sitewide [[link]] fixes: {link_fix_count} in {len(files_fixed)} files")


if __name__ == "__main__":
    main()
