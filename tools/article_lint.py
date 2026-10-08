#!/usr/bin/env python3
"""Mechanical fact-check for data/articles/<slug>.json against our own data (lane L7 QA).

    python3 tools/article_lint.py madder mauve        # specific articles (slug or path)
    python3 tools/article_lint.py --untracked          # every git-untracked data/articles/*.json
    python3 tools/article_lint.py                       # every article

Two Opus spot-audits (2026-10-09) found five systematic, script-checkable error patterns in the
Sonnet-written wave-2/3 article drafts:

  1. nearest  - "nearest neighbor" / aside.siblings / field.measured.nearest taken from the color
                library's `app` field (nearest of the old 101-color curriculum) instead of the real
                look-alike edges in data/graph/edges-<letter>.json (`la`): wrong names, wrong distances.
  2. iscc     - our own *computed* nearest ISCC-NBS block (graph node `iscc: {b, n, de}`) reported in
                prose as the 1955 dictionary's *own* filing ("filed by the ISCC-NBS system in 1955").
                The real 1955 filing (when the exact name is in the dictionary) is in
                data/sources/iscc-nbs-names.json + data/sources/iscc-nbs-centroids.json (also mirrored
                in data/library.json's per-entry "note" / "src" for names the library tracks). The two
                can and do differ.
  3. lookalike - any "nearer/closer/duller/brighter/lighter/darker/same ... as/than <Name>" sentence,
                checked heuristically against the real la edges and field.measured.nearest.
  4. wording  - leftover pipeline wording ("in this batch", "this batch('s)") and 101-curriculum leakage
                ("our 101", "101 learnable", "the 101" - also gated by article_gate.py).
  5. fieldnum - field-note numbers whose *meaning* drifted from the data: a percentage restated against
                the wrong denominator (e.g. a within-painting role share reported as "N% of M paintings"
                where neither N nor M match field.role / field.n_present), a century/decade superlative
                with no sample size, or a dropped caveat (earliest-match "floor, not a first", the
                varnish / "as photographed" / not-a-pigment-test line).

This script checks 1, 2, 4 and 5 mechanically against data/graph (nodes, edges `la`), data/library.json,
data/sources/iscc-nbs-*.json and tools/article_field.py's own compute(), and flags 3 heuristically.
It is read-only: it never edits an article. Pair it with a fixer pass and re-run until clean, then
python3 tools/article_gate.py on each file.
"""
import glob
import json
import re
import string
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ART = ROOT / "data" / "articles"
GRAPH = ROOT / "data" / "graph"

sys.path.insert(0, str(ROOT / "tools"))
from article_field import compute  # noqa: E402

# ---------------------------------------------------------------- data loading

def route_slug(s):
    import unicodedata
    s = unicodedata.normalize("NFKD", str(s))
    s = "".join(c for c in s if not unicodedata.combining(c)).lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


_NODES, _EDGES, _LIB_BY_NAME, _ISCC_FILING, _ISCC_CENTROID = None, None, None, None, None


def load_graph():
    global _NODES, _EDGES
    if _NODES is not None:
        return _NODES, _EDGES
    nodes, edges = {}, {}
    for c in string.ascii_lowercase:
        p = GRAPH / f"nodes-{c}.json"
        if p.exists():
            for n in json.loads(p.read_text()):
                nodes[n["s"]] = n
        p = GRAPH / f"edges-{c}.json"
        if p.exists():
            for e in json.loads(p.read_text()):
                edges[e["s"]] = e
    _NODES, _EDGES = nodes, edges
    return nodes, edges


def load_library():
    global _LIB_BY_NAME
    if _LIB_BY_NAME is None:
        _LIB_BY_NAME = {}
        for e in json.loads((ROOT / "data" / "library.json").read_text()):
            _LIB_BY_NAME[e["n"]] = e
    return _LIB_BY_NAME


def load_iscc():
    """name (lower) -> real 1955-filed block number; block number -> centroid name."""
    global _ISCC_FILING, _ISCC_CENTROID
    if _ISCC_FILING is None:
        _ISCC_FILING = {}
        p = ROOT / "data" / "sources" / "iscc-nbs-names.json"
        for line in p.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith('{"_'):
                continue
            try:
                r = json.loads(line)
            except Exception:
                continue
            if "n" in r and "block" in r:
                _ISCC_FILING[r["n"].strip().lower()] = r["block"]
        _ISCC_CENTROID = {}
        p = ROOT / "data" / "sources" / "iscc-nbs-centroids.json"
        for line in p.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith('{"_'):
                continue
            try:
                r = json.loads(line)
            except Exception:
                continue
            if "block" in r:
                _ISCC_CENTROID[r["block"]] = r["name"]
    return _ISCC_FILING, _ISCC_CENTROID


def real_nearest(slug):
    """[(slug, de, desc), ...] from the real look-alike edges, or [] if this slug has none."""
    _, edges = load_graph()
    e = edges.get(slug)
    return list(e.get("la") or []) if e else []


def display_name(slug):
    nodes, _ = load_graph()
    n = nodes.get(slug)
    return n["n"] if n else slug.replace("-", " ").title()


# ---------------------------------------------------------------- text helpers

REF = re.compile(r"\[(\d+)\]")
LINK = re.compile(r"\[\[([^\]|]+)(?:\|([^\]]+))?\]\]")


def all_text(a):
    """[(where, raw text)] for lede + every section body."""
    out = [("lede", a.get("lede") or "")]
    for s in a.get("sections") or []:
        out.append((s.get("id"), s.get("body") or ""))
    return out


def plain(t):
    t = REF.sub("", t)
    t = LINK.sub(lambda m: m.group(2) or m.group(1).split(":")[-1].replace("-", " "), t)
    return t.replace("*", "")


def sentences(text):
    t = text.replace("\n\n", "  ")
    return [s.strip() for s in re.split(r"(?<=[.!?])\s+(?=[A-Z0-9\"“\[])", t) if s.strip()]


# ---------------------------------------------------------------- checks

def check_nearest(a, issues):
    """Pattern 1: nearest-neighbor data must come from the real look-alike edges (`la`), not the
    library's old-101 `app` field."""
    slug = a.get("slug")
    la = real_nearest(slug)
    if not la:
        return
    real_slugs = {x[0] for x in la}
    real_names = {display_name(s) for s in real_slugs}

    nearest = ((a.get("field") or {}).get("measured") or {}).get("nearest") or []
    claimed = set()
    for x in nearest:
        if isinstance(x, (list, tuple)) and x and isinstance(x[0], str):
            claimed.add(x[0])
    if claimed and not (claimed & real_names):
        issues.append(f"nearest: field.measured.nearest {sorted(claimed)} matches none of the real "
                       f"look-alike edges {sorted(real_names)} (data/graph/edges-*.json 'la') - looks "
                       f"like it came from library.json's 'app' field instead")

    siblings = (a.get("aside") or {}).get("siblings") or []
    if siblings and not (set(siblings) & real_slugs):
        issues.append(f"nearest: aside.siblings {siblings} matches none of the real look-alike slugs "
                       f"{sorted(real_slugs)}")

    # a separate, independent prose claim ("the nearest everyday/library/learnable name on file is
    # [[X]], N units") that isn't mirrored in the structural fields above, so it slips past both checks
    # unless read directly: verify every such claim against the real look-alike edges too.
    for where, t in all_text(a):
        for m in NEAREST_PROSE_RE.finditer(t):
            target = m.group(1).split(":")[-1]
            if target == slug or target in real_slugs:
                continue
            issues.append(f"nearest ({where}): prose claim “{m.group(0)[:100]}” names [[{target}]], "
                           f"not among the real look-alike edges {sorted(real_slugs)} - looks like the "
                           f"library 'app' field again")


NEAREST_PROSE_RE = re.compile(
    r"nearest[^.\[]{0,60}?\[\[([a-z0-9-]+)(?:\|[^\]]*)?\]\][^.]{0,40}?"
    r"(?:(?:\d+(?:\.\d+)?)\s*(?:ΔE|CIEDE2000|units?|color-distance)"
    r"|(?:color-distance|ΔE|CIEDE2000)\s+of\s+(?:\d+(?:\.\d+)?))", re.I)


def check_iscc(a, issues):
    """Pattern 2: a computed ISCC-NBS block reported in prose as the dictionary's own 1955 filing."""
    nodes, _ = load_graph()
    filing, centroid = load_iscc()
    node = nodes.get(a.get("slug"))
    name = a.get("name") or ""
    real_block = filing.get(name.strip().lower())
    if real_block is None:
        return  # this exact name was never filed in the 1955 dictionary; nothing to compare
    real_name = centroid.get(real_block)
    computed_n = (node or {}).get("iscc", {}).get("n")
    for where, t in all_text(a):
        for sent in sentences(t):
            low = sent.lower()
            if "1955" in low and ("filed" in low or "iscc-nbs" in low):
                if computed_n and computed_n.lower() in low and real_name and real_name.lower() not in low:
                    issues.append(f"iscc ({where}): prose states the 1955 filing is '{computed_n}' "
                                   f"(our computed nearest block) but the real 1955 dictionary entry for "
                                   f"'{name}' is block {real_block}, '{real_name}' (data/sources/"
                                   f"iscc-nbs-names.json + iscc-nbs-centroids.json): “{sent[:140]}”")


BATCH_RE = re.compile(r"\bthis batch(?:'s)?\b|\bin this batch\b", re.I)
HUNDRED_ONE_RE = re.compile(r"\bour 101\b|\b101 learnable\b|\bthe 101\b", re.I)


def check_wording(a, issues):
    """Pattern 4: leftover pipeline wording and 101-curriculum leakage."""
    for where, t in all_text(a):
        for m in BATCH_RE.finditer(t):
            issues.append(f"wording ({where}): leftover pipeline phrase {m.group(0)!r}")
        for m in HUNDRED_ONE_RE.finditer(t):
            issues.append(f"wording ({where}): 101-curriculum leak {m.group(0)!r}")
    # openers / checked.issues can leak it too
    for op in a.get("openers") or []:
        if BATCH_RE.search(op) or HUNDRED_ONE_RE.search(op):
            issues.append(f"wording (openers): leftover phrase in {op!r}")


CAVEAT_HINTS = ("as photographed", "screen color", "screen approximation", "not a pigment", "approximate")
ROLE_NAMES = ["shadow", "mid", "light", "accent", "hidden"]

_FIELDNOTES = None


def load_fieldnotes():
    """data/graph/fieldnotes/<letter>.json: the authoritative two-lens archive stats per color (ar{...}) plus
    ready-made, pre-verified prose sentences (facts[].t) - the real ground truth for field-note numbers.
    A *different*, looser pipeline (tools/article_field.py's compute(), de<=6/min_cover=0.05, single lens) is
    also legitimate when an article's own field.match / notes say it used that tool instead - this script does
    not force every article onto fieldnotes, only checks the specific claims it can verify unambiguously."""
    global _FIELDNOTES
    if _FIELDNOTES is None:
        _FIELDNOTES = {}
        d = GRAPH / "fieldnotes"
        for c in string.ascii_lowercase:
            p = d / f"{c}.json"
            if p.exists():
                for e in json.loads(p.read_text()):
                    _FIELDNOTES[e["s"]] = e
    return _FIELDNOTES


ROLE_CLAIM_RE = re.compile(
    r"\bplays?\s+(?:an?\s+)?(shadow|mid-?tone|mid\b|light|accent|hidden)\b[^.]{0,80}?"
    r"(\d+(?:\.\d+)?)\s*(?:per\s*cent|%)\s+of\s+(?:its|the)\s+([\d,]+)", re.I)


def check_fieldnum(a, issues):
    """Pattern 5: field-note numbers whose meaning drifted from the data."""
    slug = a.get("slug")
    field = a.get("field") or {}
    fn = load_fieldnotes().get(slug)
    full_text = " ".join(t for _, t in all_text(a))

    # 5a: a "plays a <role>, in X% of Y paintings" claim - check against fieldnotes ar.role/ar.n (two-lens
    # archive engine) first, falling back to the article's own field.role/n_present (article_field.py lens).
    for where, t in all_text(a):
        for m in ROLE_CLAIM_RE.finditer(t):
            role_word = re.sub(r"-?tone$", "", m.group(1).lower()).strip()
            n = int(m.group(3).replace(",", ""))
            # a sentence comparing two roles ("plays a light more often than a hidden color, 56% against
            # 44%...") can have the regex's single percent-of-N slot land on either number; accept any
            # percentage mentioned in the matched span, not just the one captured.
            pcts = [float(x) for x in re.findall(r"(\d+(?:\.\d+)?)\s*(?:per\s*cent|%)", m.group(0))] or [float(m.group(2))]
            ok = False
            if fn:
                role_pct = {ROLE_NAMES[i]: fn["ar"]["role"][i] for i in range(5)}
                if role_word in role_pct and n == fn["ar"]["n"] and any(abs(role_pct[role_word] - p) < 1.5 for p in pcts):
                    ok = True
            role2, n_present2 = field.get("role"), field.get("n_present")
            if isinstance(role2, dict) and n_present2 is not None:
                key = "highlight" if role_word == "light" else role_word
                if key in role2 and n == n_present2 and any(abs(role2[key] * 100 - p) < 1.5 for p in pcts):
                    ok = True
            if not ok:
                hint = f"fieldnotes ar.role={fn['ar']['role']} (n={fn['ar']['n']})" if fn else "no data/graph/fieldnotes entry for this slug"
                issues.append(f"fieldnum ({where}): role claim “{m.group(0)}” does not match "
                               f"field.role {role2!r}/n_present {n_present2!r}; {hint}")

    # 5b: "first" / earliest-match claim needs its floor-not-a-first caveat
    has_first_claim = bool(re.search(r"earliest dated|first dated match|earliest match|our earliest match", full_text, re.I))
    if has_first_claim and not re.search(r"floor[^.]{0,70}(?:first|sighting|appearance|age|existed)|thin[^.]{0,70}floor", full_text, re.I):
        issues.append("fieldnum: an earliest/first-dated claim with no 'floor, not a first' caveat")

    # 5c: any field-section paragraph about the archive should carry an 'as photographed' style caveat
    field_body = ""
    for s in a.get("sections") or []:
        if s.get("id") == "field":
            field_body = s.get("body") or ""
    if field_body and not any(h in field_body.lower() for h in CAVEAT_HINTS):
        issues.append("fieldnum: field section has no 'as photographed' / screen-color / not-a-pigment-test caveat")

    # 5d: a century/decade superlative ("peaks in the NNNNs") with no sample size nearby - but only for an
    # archive (painting-match) peak claim; a Google-Books/Ngram word- or phrase-frequency peak ("the word
    # X peaks in the 1930s") is a different metric with no painting count to give, so it is exempt.
    for where, t in all_text(a):
        for m in re.finditer(r"peaks? in[^.]{0,15}(\d{3,4})0?s\b", t, re.I):
            window = t[max(0, m.start() - 20): m.end() + 90]
            sent_start = t.rfind(".", 0, m.start())
            sentence = t[sent_start + 1 if sent_start != -1 else 0: t.find(".", m.end()) + 1 or len(t)]
            if re.search(r"\bword\b|\bphrase\b|ngram|google books|every sense|all senses|all-sense|printed english",
                          sentence, re.I):
                continue
            if not re.search(r"\d[\d,]*\s*(?:of|paintings)[^.]{0,20}[\d,]+|\bn\s*=\s*\d+|\(\d[\d,]*\s*painting", window):
                issues.append(f"fieldnum ({where}): decade/century peak claim with no sample size: "
                               f"“{window.strip()[:110]}”")


LOOKALIKE_RE = re.compile(
    r"\b(?:nearer|closer|duller|brighter|lighter|darker|more vivid|less vivid|the same|almost the same)\b"
    r"[^.]{0,40}\b(?:as|than|to)\b\s*\[\[([^\]|]+)(?:\|([^\]]+))?\]\]", re.I)


def check_lookalike(a, issues):
    """Pattern 3 (heuristic): a comparative look-alike claim not supported by the real distance data."""
    slug = a.get("slug")
    la = real_nearest(slug)
    la_by_slug = {x[0]: x for x in la}
    for where, t in all_text(a):
        for m in LOOKALIKE_RE.finditer(t):
            target = m.group(1).split(":")[-1].strip()
            if target == slug:
                continue
            if re.search(r"canvas|painting|chance|archive|museum|source\b", m.group(0), re.I):
                continue  # a co-occurrence/company claim ("shares canvases as"), not a ΔE look-alike claim
            if target not in la_by_slug:
                issues.append(f"lookalike ({where}): comparative claim about [[{target}]] is not among "
                              f"{slug}'s real look-alike edges {sorted(la_by_slug)} - unverifiable/unsupported: "
                              f"“{m.group(0)[:100]}”")


def lint_one(path):
    a = json.loads(path.read_text())
    issues = []
    check_nearest(a, issues)
    check_iscc(a, issues)
    check_wording(a, issues)
    check_fieldnum(a, issues)
    check_lookalike(a, issues)
    return issues


def untracked_articles():
    out = subprocess.run(["git", "status", "--porcelain", "-uall", "--", "data/articles"],
                          cwd=ROOT, capture_output=True, text=True).stdout
    paths = []
    for line in out.splitlines():
        line = line.strip()
        if not line.startswith("??"):
            continue
        rel = line[3:].strip()
        if rel.endswith(".json") and not rel.endswith("link-map.json") and not rel.endswith("index.json"):
            paths.append(ROOT / rel)
    return sorted(paths)


def main():
    args = [x for x in sys.argv[1:] if not x.startswith("--")]
    if "--untracked" in sys.argv:
        files = untracked_articles()
    elif args:
        files = [ART / f"{a}.json" if not a.endswith(".json") else Path(a) for a in args]
    else:
        files = sorted(p for p in ART.glob("*.json") if p.stem not in ("link-map", "index"))

    bad = 0
    totals = {}
    for p in files:
        try:
            issues = lint_one(p)
        except Exception as e:
            issues = [f"lint crashed: {e}"]
        if issues:
            bad += 1
            print(f"FAIL {p.stem}")
            for x in issues:
                kind = x.split(":", 1)[0].split(" (")[0]
                totals[kind] = totals.get(kind, 0) + 1
                print(f"   x {x}")
        else:
            print(f"ok   {p.stem}")
    print(f"\n{len(files) - bad}/{len(files)} articles clean")
    if totals:
        print("issue counts:", totals)
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
