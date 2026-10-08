#!/usr/bin/env python3
"""Painter identity merge: one painter, one name.

  python3 tools/artist_aliases.py          -> data/artists/aliases.json   {variant name: canonical name}

The museum feeds spell the same painter several ways ("Hilaire Germain Edgar Degas" / "Edgar Degas",
"Sir Anthony van Dyck" / "Anthony van Dyck", "Jan Josefsz van Goyen" / "Jan van Goyen"), and each spelling used to
become its own painter page with a fraction of the work. tools/gallery.py load_corpus() applies this table to every
row's "a" before anything is counted, so gallery, analysis, art wiki and metrics all see one identity.

Matching (names only; the corpus carries no Wikidata ids, and data/artists/meta.json has no two slugs sharing a QID):
  * accents, case and punctuation are ignored;
  * the shorter name's words must all appear in the longer name, same last word, two words or more (an initial
    matches a word that starts with it): full names vs common names, patronymics, "Sir", "Baron", hyphenated forms;
  * "attributed to / workshop of / school of / circle of / follower of / after / copy / the elder / the younger /
    Master of ..." and similar qualifiers are never merged (they stay separate on purpose);
  * KEEP_APART lists pairs that look alike but are different people (father and son, brothers, a pair credited
    together).
The canonical name is the plainest form: the fewest words, no honorific, then the most paintings.
"""
import json, re, sys, unicodedata
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))

QUAL = re.compile(r"attributed|workshop|school|circle|follower|manner|studio|after|copy|imitator|style|the elder|"
                  r"the younger|^\W*$|\bor\b|\?|\bunknown|anonymous|\bson\b|\bfather\b|\bI+\b|\bjr\b|\bsr\b|^master\b|"
                  r"\band\b|\bcalled\b|\bnamed\b", re.I)
HONOR = {"sir", "baron", "fra", "lord", "saint"}
# different people that the name rule would join
KEEP_APART = {
    frozenset(["Jan Weenix", "Jan Baptist Weenix"]),               # son and father
    frozenset(["Antoine Coypel", "Charles-Antoine Coypel"]),       # father and son
    frozenset(["Hubert Drouais", "François-Hubert Drouais"]),      # son and father
    frozenset(["Thomas Barker", "Thomas Jones Barker"]),
    frozenset(["Émile Jacque", "Charles-Émile Jacque"]),
    frozenset(["Dirck van Bergen", "Dirck van der Bergen"]),
    frozenset(["Hans Hansen", "Hans Nikolaj Hansen"]),
    frozenset(["Le Nain", "Louis Le Nain"]),                       # three brothers share the name
    frozenset(["de Coninck", "David de Coninck"]),
}


def toks(n):
    n = unicodedata.normalize("NFKD", n)
    n = "".join(ch for ch in n if not unicodedata.combining(ch)).lower()
    return re.sub(r"[^a-z ]", " ", n.replace("'", "")).split()


def subset(ta, tb):
    for x in ta:
        if x in tb:
            continue
        if len(x) == 1 and any(y[0] == x for y in tb):
            continue
        return False
    return True


def build(counts):
    names = [n for n in counts if n and not QUAL.search(n)]
    T = {n: toks(n) for n in names}
    parent = {n: n for n in names}

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    for a in names:
        for b in names:
            ta, tb = T[a], T[b]
            if a == b or len(ta) < 2 or len(tb) <= len(ta) or ta[-1] != tb[-1] or not subset(ta, tb):
                continue
            if frozenset([a, b]) in KEEP_APART:
                continue
            parent[find(a)] = find(b)
    comp = {}
    for n in names:
        comp.setdefault(find(n), []).append(n)
    out = {}
    for members in comp.values():
        if len(members) < 2:
            continue
        def rank(n):
            t = T[n]
            return (bool(HONOR & set(t)), len(t), -counts[n], n)
        canon = min(members, key=rank)
        for m in members:
            if m != canon:
                out[m] = canon
    return out


def main():
    import gallery as GAL
    rows, _ = GAL.load_corpus(aliases=False)
    counts = Counter(r.get("a") for r in rows if r.get("a"))
    al = build(counts)
    (ROOT / "data" / "artists").mkdir(parents=True, exist_ok=True)
    (ROOT / "data" / "artists" / "aliases.json").write_text(
        json.dumps(dict(sorted(al.items())), ensure_ascii=False, indent=0) + "\n", encoding="utf-8")
    byc = Counter()
    for v, c in al.items():
        byc[c] += counts[v]
    print(f"{len(al)} variant names -> {len(set(al.values()))} painters")
    for c, k in byc.most_common(20):
        print(f"  {c}: +{k} paintings from {[v for v in al if al[v] == c]}")


if __name__ == "__main__":
    main()
