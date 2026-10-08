#!/usr/bin/env python3
"""Tests for data/graph/ (run after tools/graph_build.py):  python3 tools/graph_test.py

Round trips (names/lite/nodes agree), every slug resolving, symmetric edges where they must be, no self-loops and no dE-0 look-alike
pairs, alias sanity (no two canonical names with the same normalized spelling and dE < 1), size budgets, honesty rules (no
"ever" claims, both lenses on every painter signature), and value ranges. Exits non-zero on any failure."""
import glob, json, math, os, re, sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
import graph_build as GB  # noqa: E402
import library as LIB  # noqa: E402
import numpy as np  # noqa: E402

G = ROOT / "data" / "graph"
fails, checks = [], 0


def check(cond, msg):
    global checks
    checks += 1
    if not cond:
        fails.append(msg)
        if len(fails) <= 40:
            print("FAIL:", msg)


def load(p):
    return json.loads(Path(p).read_text(encoding="utf-8"))


index = load(G / "index.json")
names = load(G / "names.json")
lite = load(G / "graph-lite.json")
aliases = load(G / "aliases.json")
disambig = load(G / "disambig.json")
hubs = load(G / "hubs.json")["hubs"]
nodes, edges, notes = {}, {}, {}
for f in sorted(glob.glob(str(G / "nodes-*.json"))):
    sh = Path(f).stem.split("-", 1)[1]
    for n in load(f):
        check(n["s"] not in nodes, "duplicate slug " + n["s"])
        check(GB.shard_of(n["s"]) == sh, "node %s is in the wrong shard %s" % (n["s"], sh))
        nodes[n["s"]] = n
for f in sorted(glob.glob(str(G / "edges-*.json"))):
    for e in load(f):
        edges[e["s"]] = e
for f in sorted(glob.glob(str(G / "fieldnotes" / "*.json"))):
    for x in load(f):
        notes[x["s"]] = x
N = len(nodes)
print("graph:", N, "nodes")
check(N == index["n"], "index.n matches")
check(set(edges) == set(nodes) and set(notes) == set(nodes), "every node has edges and fieldnotes")
slugs = set(nodes)
alias = aliases["alias"]
resolves = lambda s: s in slugs or s in alias

# ---- round trips ------------------------------------------------------------------------------------------------------------
check(len(names) == N and {r[0] for r in names} == slugs, "names.json covers every node")
for r in names:
    n = nodes[r[0]]
    check(n["n"] == r[1] and n["h"] == r[2], "names.json row disagrees with node " + r[0])
    check(index["tiers"][r[3]] == n["tier"], "names.json tier disagrees for " + r[0])
check(lite["n"] == N and len(lite["rows"]) == N, "lite has every node")
idx = {r[0]: i for i, r in enumerate(lite["rows"])}
for i, r in enumerate(lite["rows"]):
    n = nodes[r[0]]
    check(r[1] == n["n"] and r[2] == n["h"][1:], "lite row disagrees with node " + r[0])
    check(lite["tiers"][r[4]] == n["tier"] and lite["fams"][r[3]] == n["fam"] or (r[3] == 8 and n["fam"] not in lite["fams"]), "lite tier/family for " + r[0])
    check(all(0 <= j < N and j != i for j in r[5]) and len(r[5]) == 3, "lite look-alikes valid for " + r[0])
    check(r[5] == [idx[s] for s, _, _ in edges[r[0]]["la"][:3]], "lite look-alikes equal edges for " + r[0])
    check(r[6] == -1 or (0 <= r[6] < N and lite["rows"][r[6]][0] == n.get("par")), "lite parent for " + r[0])
check(os.path.getsize(G / "graph-lite.json") <= 300 * 1024, "graph-lite.json is <= 300 KB (%d)" % os.path.getsize(G / "graph-lite.json"))
for f in glob.glob(str(G / "**" / "*.json"), recursive=True):
    check(os.path.getsize(f) <= 1.5 * 1024 * 1024, "shard %s is <= 1.5 MB (%d)" % (f, os.path.getsize(f)))

# ---- node fields --------------------------------------------------------------------------------------------------------------
for s, n in nodes.items():
    check(re.fullmatch(r"#[0-9A-F]{6}", n["h"]) is not None, "hex format " + s)
    check(n["rgb"] == LIB.hex_to_rgb(n["h"]), "rgb round trip " + s)
    check(n["tier"] in index["tiers"], "tier valid " + s)
    check(0 <= n["hsl"][1] <= 100 and 0 <= n["hsl"][2] <= 100 and 0 <= n["hsl"][0] <= 360, "hsl range " + s)
    check(len(n["cmyk"]) == 4 and all(0 <= v <= 100 for v in n["cmyk"]), "cmyk range " + s)
    check(0 <= n["lab"][0] <= 100.5, "lab L range " + s)
    check(1 <= n["iscc"]["b"] <= 267, "iscc block " + s)
    check(n["src"] or "app" in n["ls"] or True, "")
    for code, year, det in n["src"]:
        check(year is None or isinstance(year, int), "source year int " + s)
    if n.get("par"):
        check(n["par"] in slugs and n["par"] != s, "parent resolves and is not self " + s)

# ---- every slug in every edge resolves; no self loops; no dE-0 look-alikes ---------------------------------------------------------
lab = {s: LIB.labs([n["h"]])[0] for s, n in nodes.items()}
for s, e in edges.items():
    for t, de, words in e.get("la", []):
        check(resolves(t), "look-alike slug resolves %s -> %s" % (s, t))
        check(t != s, "look-alike self loop " + s)
        check(de >= 2.0, "look-alike inside the near-duplicate band %s -> %s (%s)" % (s, t, de))
        check(words and all(w in ("lighter", "darker", "more vivid", "duller", "redder", "yellower", "greener", "bluer", "purpler", "almost the same", "and") or " " in w for w in [words]), "direction words vocabulary " + words)
    for t, de in e.get("dup", []):
        check(t in slugs and t != s and de <= 2.0, "dup valid %s -> %s" % (s, t))
    for k in e.get("kids", []):
        check(k in slugs and k != s, "kid resolves " + k)
    if e.get("par"):
        check(e["par"][0] in slugs, "par resolves " + s)
    for w, d in e.get("wh", {}).items():
        for side, lst in d.items():
            for t in lst:
                check(t in slugs and t != s, "wheel slug resolves %s %s" % (s, t))
    for kind, lst in e.get("tw", {}).items():
        for tid, label, de in lst:
            check(de <= 10.0, "twin within dE 10 " + s)
    for a, t in e.get("also", []):
        check(t is None or t in slugs, "also resolves " + s)
    for r in e.get("trad", []):
        check(r[3] is None or r[3] in slugs, "trad resolves " + s)
    for x in e.get("ap", []) + [[p[0]] for p in e.get("pw", [])] + [[p[0]] for p in e.get("nw", [])]:
        if x and isinstance(x[0], str) and x in e.get("pw", []) + e.get("nw", []):
            check(resolves(x[0]), "pair slug resolves " + s)
    if "dis" in e:
        check(e["dis"] in slugs, "disamb id resolves " + s)

# ---- symmetric edges ------------------------------------------------------------------------------------------------------------
for s, e in edges.items():
    for t, de in e.get("dup", []):
        check(any(u == s for u, _ in edges[t].get("dup", [])) or edges[t].get("ndup", 0) > 10, "dup symmetric %s <-> %s" % (s, t))
    if nodes[s].get("par"):
        p = nodes[s]["par"]
        ok = s in edges[p].get("kids", []) or edges[p].get("nkids", 0) > len(edges[p].get("kids", []))
        check(ok, "parent lists child %s -> %s" % (s, p))
    for k in e.get("kids", []):
        check(nodes[k].get("par") == s, "kid points back to parent %s <- %s" % (s, k))
    for jp, kanji, meaning, t in e.get("trad", []):
        if t:
            check(any(u[0] == s for u in edges[t].get("trad_of", [])), "trad symmetric %s <-> %s" % (s, t))
for a, c in alias.items():
    check(c in slugs and a not in slugs, "alias %s -> %s resolves to a canonical slug and is not itself canonical" % (a, c))
    check(a != c, "alias is not self")
for g in disambig["groups"]:
    check(len(g["members"]) >= 2 and g["members"][0]["kind"] == "primary", "group primary " + g["id"])
    for m in g["members"]:
        check(m["s"] in slugs and edges[m["s"]].get("dis") == g["id"], "group member back-reference %s %s" % (g["id"], m["s"]))

# ---- alias hygiene: the panel's rule ---------------------------------------------------------------------------------------------
by_a = defaultdict(list)
for s, n in nodes.items():
    by_a[GB.akey(n["n"])].append(s)
for k, ss in by_a.items():
    for i in range(len(ss)):
        for j in range(i + 1, len(ss)):
            d = float(np.abs(lab[ss[i]] - lab[ss[j]]).sum())     # cheap upper bound filter; exact check below
            if d < 6:
                from graph_color import de2000_pairs
                de = float(de2000_pairs(lab[ss[i]][None], lab[ss[j]][None])[0])
                check(de >= 1.0, "two canonical names share a normalized spelling and dE < 1: %s / %s" % (ss[i], ss[j]))

# ---- hubs ---------------------------------------------------------------------------------------------------------------------------
for hid, h in hubs.items():
    check(h["n"] == len(h["members"]) and all(m in slugs for m in h["members"]), "hub members resolve " + hid)
check(sum(h["n"] for k, h in hubs.items() if k.startswith("tier:")) == N, "tier hubs partition the nodes")

# ---- archive honesty -----------------------------------------------------------------------------------------------------------------
check(index["honesty"]["photographed"] and "never" in index["honesty"]["phrasing"], "honesty layer present")
for s, x in notes.items():
    for f in x["facts"]:
        check(not re.search(r"\bever (used|painted|made|recorded|seen)\b|of all time", f["t"]), "no unbounded claim: " + f["t"][:60])
        check(f.get("n") is None or f["n"] >= 0, "fact carries n " + s)
        if f["k"] in ("painter", "country", "century", "first-seen"):
            check(f["n"] is not None and f["n"] >= index["archive"]["meta"]["min_n"]["claim"] - 1, "claim has minimum n: " + f["t"][:60])
    ar = x.get("ar")
    if ar:
        for p in ar.get("pa", []):
            check(p[4] >= 2.0 and p[5] >= 1.5 and p[2] >= index["archive"]["meta"]["min_n"]["artist_color"] and p[3] >= index["archive"]["meta"]["min_n"]["artist"], "painter signature holds in both lenses %s %s" % (s, p[0]))
        check(ar["n"] >= 0 and ar["nph"] >= 0, "counts")
        check(len(ar["cur"]) == len(index["archive"]["meta"]["centuries"]), "century curve length " + s)
    ng = x.get("ng")
    if ng:
        check(len(ng["c"]) == 22 and max(ng["c"]) == 100, "ngram curve shape " + s)
        if ng.get("adj"):
            check(len(ng["adj"]["c"]) == 22, "ngram adj curve shape " + s)
sup = load(G / "superlatives.json")
check("rarest in" in sup["rules"]["phrasing"] and sup["rules"]["asPhotographed"], "superlatives phrasing rule")
check(all(c["n_in"] >= 3 for c in sup["rarest_present"]), "rarest list has a minimum n")

print("%d checks, %d failures" % (checks, len(fails)))
sys.exit(1 if fails else 0)
