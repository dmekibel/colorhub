#!/usr/bin/env python3
"""ColorHub Color Graph builder (design/MASTER-PLAN-2026-10-08.md section 2, lane L6). Deterministic: no LLM, no book text.

  python3 tools/graph_build.py              # build everything into data/graph/
  python3 tools/graph_build.py --no-archive # skip the 23k-painting statistics (fast; for iterating on nodes/edges)

Reads:  data/core-names.json (the ~1,000 core names), data/library.json (the reference library), data/colors.js (the
        curriculum), data/sources/ (ISCC-NBS 1955, Maerz and Paul 1930), data/analysis/ + the painting corpus + pools
        (tools/graph_archive.py), the botany/gems/fashion/films files (twins), ../color-kb/werner.json and ridgway.json
        (names, plates and dates only: public-domain 1821 and 1912 sources), research/_raw/ngrams/n1800__*.json
        (tools/fetch_ngrams.py). Writes data/graph/:

  index.json            counts, shard rule, tier counts, source dates, honesty rules, the museum baselines, how to read it
  names.json            [slug, name, hex, tierIdx, listFlags] for every canonical color (search / resolve)
  aliases.json          alias slug -> canonical slug (spelling, hyphen and -ish twins), plus unmerged conflicts
  graph-lite.json       <= 300 KB, loaded early: canonical ids, hex, family, tier, top 3 look-alikes, parent
  nodes-<a-z>.json     the node records (codes, sources with dates, origin tier, ...)
  edges-<a-z>.json     look-alikes, dups, parent/kids, aka, traditional siblings, disambiguation group, wheels, twins,
                        appears-in, favored-by, paired-with
  fieldnotes/<a-z>.json per-color field facts: archive stats (two lenses), word over time, plain-English facts
  disambig.json         the true collisions ("Sapphire" vs "Sapphire Blue" vs "Sapphire (Crayola)", contested hexes)
  hubs.json             membership lists by tier, source, family, century, namesake
  superlatives.json     archive-wide records (with minimum n and honest phrasing)

HONESTY RULES (also written into index.json): every archive number is "as photographed" (aged varnish, six museum
cameras) and says so; claims carry their n and a minimum n; two lenses (photo = share as photographed, within = relative to
the painting: lightness rank, accent and hidden roles) must AGREE before anything is called a painter's signature, and
painter lift is measured against the same museum's baseline; we say "rarest in our 23,531-painting archive", never
"rarest ever used".
"""
import json, math, re, subprocess, sys, time, unicodedata
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
import library as LIB  # noqa: E402
import graph_color as GC  # noqa: E402
import graph_tiers as GT  # noqa: E402

OUT = ROOT / "data" / "graph"
VERSION = 1


def jdump(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def slugify(s):
    s = unicodedata.normalize("NFKD", str(s))
    s = "".join(ch for ch in s if not unicodedata.combining(ch)).lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-") or "color"


def find_up(name):
    for base in [ROOT] + list(ROOT.parents):
        if (base / name).exists():
            return base / name
    return None


# --- spelling / alias normalization ---------------------------------------------------------------------------------
SPELL = {"gray": "grey", "colour": "color", "bister": "bistre", "ocher": "ochre", "ocre": "ochre", "sulfur": "sulphur",
         "vermillion": "vermilion", "terracota": "terracotta", "lavendar": "lavender", "liliac": "lilac", "siena": "sienna",
         "wistaria": "wisteria", "aluminum": "aluminium", "harbor": "harbour", "kelley": "kelly", "forrest": "forest",
         "perrywinkle": "periwinkle", "mauvette": "mauvette", "hellebore": "hellebore", "grayish": "greyish",
         "chartruese": "chartreuse", "fuschia": "fuchsia", "tumeric": "turmeric", "carribean": "caribbean"}
ISH = {"bluish": "blue", "greenish": "green", "reddish": "red", "yellowish": "yellow", "purplish": "purple", "brownish": "brown",
       "pinkish": "pink", "orangish": "orange", "orangeish": "orange", "greyish": "grey", "blackish": "black",
       "whitish": "white", "tealish": "teal", "purpleish": "purple", "greeny": "green", "bluey": "blue", "pinky": "pink",
       "purply": "purple", "yellowy": "yellow", "orangey": "orange", "reddy": "red", "browny": "brown"}


def toks_of(name):
    return [t for t in re.split(r"[^a-z0-9()&']+", unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode().lower()) if t]


def akey(name):
    return "".join(SPELL.get(t, t) for t in toks_of(name))


def ikey(name):
    return "".join(ISH.get(SPELL.get(t, t), SPELL.get(t, t)) for t in toks_of(name))


# --- js data (curriculum, twins pools, 'since' dates) via node ------------------------------------------------------------
NODE_JS = """
global.window = global;
const R = process.argv[1];
for (const f of ["colors","wiki-colors","botany","gems","fashion","films"]) { try { require(R + "/data/" + f + ".js"); } catch (e) {} }
const cur = []; (DATA.basics||[]).forEach(([n,h]) => cur.push({n, h, basic:true}));
(DATA.units||[]).forEach(u => u.colors.forEach(c => cur.push({n:c.n, h:c.h, o:c.o||null, unit:u.id})));
const since = {}; Object.entries(WIKI_COLORS||{}).forEach(([k,v]) => { if (v.since) since[k] = v.since; });
const tw = {botany:[], gems:[], fashion:[], films:[]};
(BOTANY.werner||[]).filter(w => w.plant).forEach((w,i) => tw.botany.push({id:"werner-"+(i+1), label:w.plant+" (Werner 1821, for "+w.name+")", h:w.hex}));
(GEMS.gems||[]).forEach(g => (g.palette||[]).forEach(p => tw.gems.push({id:g.id, label:g.title+": "+p[1], h:p[0]})));
(FASHION.decades||[]).forEach(d => (d.swatches||[]).forEach(s => tw.fashion.push({id:"decade:"+d.id, label:d.label+": "+s[1], h:s[0]})));
(FASHION.coty||[]).forEach(c => tw.fashion.push({id:"coty:"+c.year, label:"Pantone Color of the Year "+c.year+": "+c.name, h:c.hex}));
(FASHION.houses||[]).forEach(c => tw.fashion.push({id:"house:"+c.id, label:c.house+": "+c.label, h:c.hex}));
(FASHION.history||[]).forEach(d => (d.swatches||[]).forEach(s => tw.fashion.push({id:"history:"+d.id, label:d.title+": "+s[1], h:s[0]})));
(FILMS||[]).forEach(f => (f.colors||[]).forEach(c => tw.films.push({id:"film:"+f.id, label:f.title+" ("+f.year+"): "+c.name, h:c.h})));
process.stdout.write(JSON.stringify({cur, since, tw}));
"""


def load_js():
    out = subprocess.run(["node", "-e", NODE_JS, str(ROOT)], capture_output=True, check=True, text=True).stdout
    return json.loads(out)


def read_jsonl(path):
    rows = []
    for line in Path(path).read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line.startswith("{"):
            try:
                rows.append(json.loads(line))
            except Exception:
                pass
    return rows


# =====================================================================================================================
# 1. NODES
# =====================================================================================================================
def build_nodes(js, verbose=True):
    core = json.loads((ROOT / "data" / "core-names.json").read_text(encoding="utf-8"))
    lib = json.loads((ROOT / "data" / "library.json").read_text(encoding="utf-8"))
    raw = []   # one dict per raw entry
    for i, e in enumerate(core):
        raw.append(dict(n=e["n"], h=e["h"], src=set(e.get("src", [])), list="core", core=e, rank=e.get("rank", i)))
    for e in lib:
        raw.append(dict(n=e["n"], h=e["h"], src=set(e.get("src", [])), list="lib", lib=e))
    for e in js["cur"]:
        raw.append(dict(n=e["n"], h=e["h"], src={"app"}, list="cur", cur=e))
    labs_raw = LIB.labs([r["h"] for r in raw])
    for r, l in zip(raw, labs_raw):
        r["lab"] = l
    # --- merge: same key (library's own key) -> same node; spelling variants (any dE; the other hex is kept in alts); -ish twins (dE < 2) ----
    parent = list(range(len(raw)))

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a, b):
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[max(ra, rb)] = min(ra, rb)
    by_k, by_a, by_i = defaultdict(list), defaultdict(list), defaultdict(list)
    for i, r in enumerate(raw):
        by_k[LIB.key(r["n"])].append(i)
        by_a[akey(r["n"])].append(i)
        by_i[ikey(r["n"])].append(i)
    merges = []     # (kind, a, b, dE)
    for k, idx in by_k.items():
        for j in idx[1:]:
            union(idx[0], j)
    conflicts = []
    for kind, table, limit in (("spelling", by_a, 1e9), ("ish-twin", by_i, 2.0)):
        for k, idx in table.items():
            if kind == "ish-twin" and len(toks_of(raw[idx[0]]["n"])) < 2:
                continue          # "Red" and "Reddish" are different words, not twins
            if len(set(find(i) for i in idx)) < 2:
                continue
            base = idx[0]
            for j in idx[1:]:
                if find(base) == find(j):
                    continue
                d = float(GC.de2000_pairs(labs_raw[[base]], labs_raw[[j]])[0])
                if d <= limit:
                    union(base, j)
                    merges.append((kind, raw[base]["n"], raw[j]["n"], round(d, 1)))
                elif d < 4 and not any(c["a"] == raw[base]["n"] and c["b"] == raw[j]["n"] for c in conflicts):
                    conflicts.append(dict(kind=kind, a=raw[base]["n"], b=raw[j]["n"], de=round(d, 1)))
    groups = defaultdict(list)
    for i in range(len(raw)):
        groups[find(i)].append(i)
    # --- canonical node per group ---------------------------------------------------------------------------------
    nodes = []
    for root_i, idx in groups.items():
        mem = [raw[i] for i in idx]

        def pri(r):
            return (0 if r["list"] == "core" else 1 if r["list"] == "cur" else 2, -len(r["src"]), len(r["n"]), r["n"])
        mem_sorted = sorted(mem, key=pri)
        main = mem_sorted[0]
        # prefer a core/cur entry's name and hex; else library's
        srcs = set().union(*[r["src"] for r in mem])
        lists = {r["list"] for r in mem}
        node = dict(n=main["n"], h=main["h"], srcs=srcs, lists=lists, members=[r["n"] for r in mem_sorted],
                    core=next((r["core"] for r in mem_sorted if "core" in r), None),
                    libe=next((r["lib"] for r in mem_sorted if "lib" in r), None),
                    cur=next((r["cur"] for r in mem_sorted if "cur" in r), None))
        alts = []
        if node["libe"]:
            alts += [list(a) for a in node["libe"].get("alts", [])]
        for r in mem_sorted[1:]:
            if float(GC.de2000_pairs(LIB.labs([main["h"]]), LIB.labs([r["h"]]))[0]) > 3 and [x for x in alts if x[1] == r["h"]] == []:
                alts.append(["alias:" + r["n"], r["h"]])
        node["alts"] = alts
        nodes.append(node)
    nodes.sort(key=lambda d: (0 if "core" in d["lists"] else 1, d["core"]["rank"] if d["core"] else 9999, d["n"].lower()))
    seen = {}
    for nd in nodes:
        s = slugify(nd["n"])
        if s in seen:
            s = s + "-" + slugify(nd["h"])
        seen[s] = 1
        nd["slug"] = s
    if verbose:
        print(f"nodes: {len(raw)} raw entries -> {len(nodes)} canonical colors ({len(merges)} alias merges, {len(conflicts)} unmerged spelling conflicts)")
    return nodes, merges, conflicts


# =====================================================================================================================
# 2. CODES, SOURCES, TIERS
# =====================================================================================================================
def attach_sources(nodes, js):
    kb = find_up("color-kb")
    werner, ridgway = {}, {}
    if kb:
        for w in json.loads((kb / "werner.json").read_text(encoding="utf-8")).get("colors", []):
            werner[LIB.key(w["name"])] = w
        for r in json.loads((kb / "ridgway.json").read_text(encoding="utf-8")).get("colors", []):
            ridgway[LIB.key(r["name"])] = r
    mp = {}
    for r in read_jsonl(ROOT / "data" / "sources" / "maerz-paul-1930.json"):
        if "n" in r and not r.get("uncertain"):
            mp[LIB.key(r["n"])] = r
    iscc_names = {}
    for r in read_jsonl(ROOT / "data" / "sources" / "iscc-nbs-names.json"):
        if "n" in r:
            iscc_names[LIB.key(r["n"])] = r
    since = {LIB.key(k): v for k, v in js["since"].items()}
    for nd in nodes:
        ks = {LIB.key(m) for m in nd["members"]}
        s = []
        for code in sorted(nd["srcs"]):
            if code == "app":
                s.append(["app", None, "ColorHub curriculum"])
            elif code in ("css", "xkcd", "ral", "jp", "pigment", "iscc-nbs", "ridgway", "werner", "wiki"):
                d = GT.SOURCE_DATES[code][0]
                det = None
                if code == "iscc-nbs":
                    r = next((iscc_names[k] for k in ks if k in iscc_names), None)
                    if r:
                        det = "block %s (%s)" % (r["block"], "/".join(r["src"]))
                if code == "ridgway":
                    r = next((ridgway[k] for k in ks if k in ridgway), None)
                    if r:
                        det = "plate %s, hue %s" % (r["plate"], r["hue_no"])
                        if r.get("from_1886"):
                            s.append(["ridgway-1886", 1886, "carried over from Ridgway's 1886 Nomenclature of Colors"])
                if code == "werner":
                    r = next((werner[k] for k in ks if k in werner), None)
                    if r:
                        det = "no. %s, %s" % (r["no"], r["group"])
                if code == "jp" and nd["libe"] and nd["libe"].get("jp"):
                    det = nd["libe"]["jp"].get("kanji")
                if code == "pigment" and nd["libe"]:
                    m = re.search(r"(?:in use from|since|from) (\d{4})", nd["libe"].get("note", ""))
                    if m:
                        d = int(m.group(1)); det = "dated in the pigment note"
                s.append([code, d, det])
        note = (nd["libe"] or {}).get("note", "") or ""
        if "Crayola" in note or any(GT.qualifier(m) == "crayola" for m in nd["members"]):
            s.append(["crayola", None, "named in the Crayola list (Wikipedia)"])
            nd["srcs"].add("crayola")
        r = next((mp[k] for k in ks if k in mp), None)
        if r:
            s.append(["maerz-paul", 1930, "plate %s %s%s" % (r["plate"], r["col"], r["row"])])
            nd["srcs"].add("maerz-paul")
        elif "M" in (iscc_names.get(next((k for k in ks if k in iscc_names), ""), {}).get("src") or []):
            s.append(["maerz-paul", 1930, "cited by NBS Circular 553 (1955)"])
            nd["srcs"].add("maerz-paul")
        sn = next((since[k] for k in ks if k in since), None)
        if sn:
            nd["since"] = dict(y=sn.get("year"), what=sn.get("what"), approx=bool(sn.get("approx")))
        nd["sources"] = s
        dated = [(x[1], x[0]) for x in s if x[1]]
        if sn and sn.get("year") is not None:
            dated.append((sn["year"], "since"))
        nd["first"] = min(dated) if dated else None
        nd["note"] = note
        nd["werner_d"] = next(({"animal": werner[k].get("animal"), "vegetable": werner[k].get("vegetable"), "mineral": werner[k].get("mineral"), "no": werner[k]["no"]} for k in ks if k in werner), None) \
            or (nd["libe"] or {}).get("werner")
        nd["jp_d"] = (nd["libe"] or {}).get("jp")


def attach_codes(nodes, verbose=True):
    hexes = [n["h"] for n in nodes]
    labs = LIB.labs(hexes)
    raw_dir = find_up("research/_raw")
    cache = (raw_dir / "graph-munsell-cache.json") if raw_dir else (ROOT / "research" / "_raw" / "graph-munsell-cache.json")
    if verbose:
        print("munsell (cached)...")
    mun = GC.munsell_many(hexes, cache)
    cen = read_jsonl(ROOT / "data" / "sources" / "iscc-nbs-centroids.json")
    cen = [c for c in cen if "block" in c]
    clab = LIB.labs([c["hex"] for c in cen])
    D = LIB.de2000(labs, clab)
    L, C, H = GC.lch_of(labs)
    pL = (np.argsort(np.argsort(L)) / max(1, len(L) - 1) * 100)
    pC = (np.argsort(np.argsort(C)) / max(1, len(C) - 1) * 100)
    for i, nd in enumerate(nodes):
        rgb = LIB.hex_to_rgb(nd["h"])
        h, s, l = GC.hsl_of(rgb)
        o = GC.oklch_of(rgb)
        j = int(D[i].argmin())
        nd.update(rgb=rgb, hsl=[round(h), round(s * 100), round(l * 100)], cmyk=GC.cmyk_naive(rgb),
                  lab=[round(float(x), 1) for x in labs[i]], lch=[round(float(L[i]), 1), round(float(C[i]), 1), round(float(H[i]), 1)],
                  ok=[round(o[0], 3), round(o[1], 3), round(o[2], 1)], mu=mun[nd["h"]],
                  iscc=dict(b=cen[j]["block"], n=cen[j]["name"], de=round(float(D[i, j]), 1)),
                  fam=LIB.family(float(L[i]), float(C[i]), float(H[i])), pL=round(float(pL[i])), pC=round(float(pC[i])),
                  cw=round(GC.contrast_ratio(rgb, (255, 255, 255)), 2), cb=round(GC.contrast_ratio(rgb, (0, 0, 0)), 2))
    return labs


def classify_tiers(nodes, verbose=True):
    overrides = {}
    ov = ROOT / "data" / "graph-tier-overrides.json"
    if ov.exists():
        overrides = json.loads(ov.read_text(encoding="utf-8"))
    by_key = {}
    for i, nd in enumerate(nodes):
        for m in nd["members"]:
            by_key.setdefault(LIB.key(m), i)
    key_of = LIB.key
    for nd in nodes:
        jp_name = bool(nd["jp_d"]) and "core" not in nd["lists"] and "jp" in nd["srcs"]
        node = dict(n=nd["n"], slug=nd["slug"], srcs=nd["srcs"], note=nd["note"], jp_name=jp_name)
        tier, why, parent = GT.classify(node, key_of, by_key, overrides)
        nd["tier"], nd["why"] = tier, why
        nd["par"], nd["pk"] = None, None
        if parent is not None and parent in by_key and by_key[parent] is not None:
            pi = by_key[parent]
            if nodes[pi]["slug"] != nd["slug"]:
                nd["par"] = nodes[pi]["slug"]
                nd["pk"] = "modifier" if tier == "descriptive-modifier" else "variant"
        elif tier not in ("descriptive-modifier", "basic-term"):
            # "Sapphire Blue" -> Sapphire: a name plus a trailing family word where the shorter name exists
            tk = [t for t in re.split(r"[\s\-]+", re.sub(r"\(.*?\)", " ", nd["n"].lower())) if t]
            if len(tk) >= 2 and tk[-1] in GT.FAMILY and len(" ".join(tk[:-1])) >= 3:
                pk = key_of(" ".join(tk[:-1]))
                if pk in by_key and nodes[by_key[pk]]["slug"] != nd["slug"] and " ".join(tk[:-1]) not in GT.MODIFIERS:
                    nd["par"], nd["pk"] = nodes[by_key[pk]]["slug"], "family-word"
    if verbose:
        print("tiers:", dict(Counter(n["tier"] for n in nodes)))
    return by_key


# =====================================================================================================================
# 3. EDGES (colors only; the archive edges come from tools/graph_archive.py)
# =====================================================================================================================
def build_edges(nodes, labs, by_key, js, verbose=True):
    N = len(nodes)
    D = np.zeros((N, N), dtype=np.float32)
    for i in range(0, N, 400):
        D[i:i + 400] = LIB.de2000(labs[i:i + 400], labs)
    np.fill_diagonal(D, 1e9)
    idx = {nd["slug"]: i for i, nd in enumerate(nodes)}
    lch = [tuple(nd["lch"]) for nd in nodes]
    # real lch for direction words (unrounded not needed)
    edges = [dict() for _ in range(N)]
    for i, nd in enumerate(nodes):
        row = D[i]
        dup = np.where(row < 2.0)[0]
        edges[i]["dup"] = [[nodes[j]["slug"], round(float(row[j]), 1)] for j in dup[np.argsort(row[dup])][:10]]
        edges[i]["ndup"] = int(len(dup))
        masked = np.where(row < 2.0, 1e9, row)
        near = np.argpartition(masked, 6)[:6]
        near = near[np.argsort(masked[near])]
        edges[i]["la"] = [[nodes[j]["slug"], round(float(masked[j]), 1), GC.dir_words(lch[i], lch[j])] for j in near]
    # parent / kids
    kids = defaultdict(list)
    for nd in nodes:
        if nd["par"]:
            kids[nd["par"]].append(nd["slug"])
    for i, nd in enumerate(nodes):
        edges[i]["par"] = [nd["par"], nd["pk"]] if nd["par"] else None
        edges[i]["kids"] = sorted(kids.get(nd["slug"], []))[:40]
        edges[i]["nkids"] = len(kids.get(nd["slug"], []))
    # aka: spelling aliases merged into this canonical node + the core list's `also` near-names that exist as nodes
    for i, nd in enumerate(nodes):
        edges[i]["aka"] = [m for m in dict.fromkeys(nd["members"][1:]) if m != nd["n"]]
        also = (nd["core"] or {}).get("also", [])
        edges[i]["also"] = [[a, by_key[LIB.key(a)] is not None and nodes[by_key[LIB.key(a)]]["slug"]] if LIB.key(a) in by_key else [a, None] for a in also]
        edges[i]["also"] = [[a, s] for a, s in edges[i]["also"]]
        # traditional siblings: the core list's Japanese notes
        tr = []
        for n in (nd["core"] or {}).get("notes", []):
            j = by_key.get(LIB.key(n.get("jp", "")))
            tr.append([n.get("jp"), n.get("kanji"), n.get("meaning"), nodes[j]["slug"] if j is not None else None])
        edges[i]["trad"] = tr
    rev = defaultdict(list)
    for i, nd in enumerate(nodes):
        for jp, kanji, meaning, s in edges[i]["trad"]:
            if s:
                rev[s].append([nd["slug"], meaning])
        for a, s in edges[i]["also"]:
            if s:
                rev["also:" + s].append(nd["slug"])
    for i, nd in enumerate(nodes):
        edges[i]["trad_of"] = rev.get(nd["slug"], [])
        edges[i]["also_of"] = rev.get("also:" + nd["slug"], [])
    # wheels: complement + analogous, nearest CORE names (so the hop lands on a familiar color)
    core_idx = np.array([i for i, nd in enumerate(nodes) if "core" in nd["lists"]])
    core_lab = labs[core_idx]
    for i, nd in enumerate(nodes):
        h, s, l = GC.hsl_of(nd["rgb"])
        lh = nd["lch"]
        wheels = {}
        specs = {
            "p": lambda dh: GC.hsl_to_hex(0, 0, 0) if False else None,
        }
        targets = {}
        # perceptual: LCh hue rotation, same L and C
        for name, dh in (("c", 180), ("l", -30), ("r", 30)):
            a = math.radians((lh[2] + dh) % 360)
            lab_t = np.array([[lh[0], lh[1] * math.cos(a), lh[1] * math.sin(a)]])
            targets[("p", name)] = lab_t
        # RYB painter's wheel: map hue to RYB, rotate, map back, same S and L
        ry = GC.rgb_to_ryb_hue(h)
        for name, dh in (("c", 180), ("l", -30), ("r", 30)):
            targets[("b", name)] = LIB.labs([GC.hsl_to_hex(GC.ryb_to_rgb_hue(ry + dh), s, l)])
        # RGB light wheel: HSL hue rotation
        for name, dh in (("c", 180), ("l", -30), ("r", 30)):
            targets[("l", name)] = LIB.labs([GC.hsl_to_hex(h + dh, s, l)])
        for w in ("p", "b", "l"):
            res = {}
            for name in ("c", "l", "r"):
                dd = LIB.de2000(targets[(w, name)], core_lab)[0]
                dd = np.where(D[i, core_idx] < 6, 1e9, dd) if nd["lch"][1] > 4 else dd
                dd = np.where(core_idx == i, 1e9, dd)
                k = 3 if name == "c" else 2
                top = np.argsort(dd)[:k]
                res[name] = [nodes[core_idx[t]]["slug"] for t in top]
            wheels[w] = res
        edges[i]["wh"] = wheels
    # twins
    for kind, pool in js["tw"].items():
        if not pool:
            continue
        pl = LIB.labs([p["h"] for p in pool])
        DD = LIB.de2000(labs, pl)
        for i in range(N):
            row = DD[i]
            seen, out = set(), []
            for j in np.argsort(row):
                if row[j] > 10 or len(out) >= 2:
                    break
                if pool[j]["id"] in seen:
                    continue
                seen.add(pool[j]["id"])
                out.append([pool[j]["id"], pool[j]["label"], round(float(row[j]), 1)])
            if out:
                edges[i].setdefault("tw", {})[kind] = out
    return D, edges, idx


# =====================================================================================================================
# 4. DISAMBIGUATION
# =====================================================================================================================
def gkey(nd):
    """The head a name collides on: spelling-normalized, qualifier dropped, one trailing family word dropped."""
    t = [SPELL.get(x, x) for x in toks_of(re.sub(r"\(.*?\)", " ", nd["n"]))]
    t = [x for x in t if x not in ("color", "colour")]
    if len(t) >= 2 and t[-1] in GT.FAMILY:
        t = t[:-1]
    return "".join(t)


def build_disambig(nodes, D, edges):
    idx_of = {nd["slug"]: i for i, nd in enumerate(nodes)}
    """True collisions only: a bare name that exists as a color ("Sapphire") with variants that mean (nearly) the same
    color under another label: a qualifier ("Sapphire (Crayola)", dE <= 25) or its own family word ("Sapphire Blue", dE <= 15).
    "Signal Black" and "Signal Blue" are NOT a collision: there is no color called "Signal"."""
    by_head = defaultdict(list)
    for i, nd in enumerate(nodes):
        if nd["tier"] in ("descriptive-modifier", "basic-term"):
            continue
        k = gkey(nd)
        if len(k) >= 3:
            by_head[k].append(i)
    out = []
    for k, mem in by_head.items():
        prim = [i for i in mem if akey(nodes[i]["n"]) == k and not GT.qualifier(nodes[i]["n"])]
        if not prim or len(mem) < 2:
            continue
        p = sorted(prim, key=lambda i: (0 if "core" in nodes[i]["lists"] else 1, -len(nodes[i]["srcs"]), nodes[i]["n"]))[0]
        members = [dict(s=nodes[p]["slug"], n=nodes[p]["n"], h=nodes[p]["h"], de=0.0, kind="primary", q=None, tier=nodes[p]["tier"], src=sorted(nodes[p]["srcs"])[:6])]
        for i in mem:
            if i == p:
                continue
            nd = nodes[i]
            q = GT.qualifier(nd["n"])
            d = float(D[p, i])
            kind = "qualifier" if q else "family-word" if akey(nd["n"]) != k else "same-name"
            if (kind == "qualifier" and d > 25) or (kind == "family-word" and d > 15):
                continue
            members.append(dict(s=nd["slug"], n=nd["n"], h=nd["h"], de=round(d, 1), kind=kind, q=q, tier=nd["tier"], src=sorted(nd["srcs"])[:6]))
        if len(members) < 2:
            continue
        gid = nodes[p]["slug"]
        out.append(dict(id=gid, base=nodes[p]["n"], members=members, spread=round(max(m["de"] for m in members), 1)))
        for m in members:
            edges[idx_of[m["s"]]]["dis"] = gid
    out.sort(key=lambda g: (-len(g["members"]), g["id"]))
    # contested: one name, different hex in different sources
    contested = []
    for i, nd in enumerate(nodes):
        if nd["alts"]:
            hexes = [["main", nd["h"]]] + [a for a in nd["alts"] if not str(a[0]).startswith("alias:")]
            if len(hexes) < 2:
                continue
            labs_ = LIB.labs([h for _, h in hexes])
            sp = float(max(GC.de2000_pairs(labs_[[0] * (len(hexes) - 1)], labs_[1:])))
            if sp >= 6:
                contested.append(dict(s=nd["slug"], n=nd["n"], spread=round(sp, 1), hexes=hexes))
                edges[i]["contested"] = True
    contested.sort(key=lambda c: -c["spread"])
    return out, contested


# =====================================================================================================================
# 5. THE WORD OVER TIME (Google Books Ngram, tools/fetch_ngrams.py)
# =====================================================================================================================
DECADES = list(range(1800, 2020, 10))      # 22 decade points


def ngram_dir():
    for base in [ROOT] + list(ROOT.parents):
        d = base / "research" / "_raw" / "ngrams"
        if d.exists():
            return d
    return None


def curve(ts):
    """220 yearly points (1800-2019) -> 22 decade means, normalized to the peak decade (0-100); mx = the peak decade's
    frequency per million words; pk = peak decade; rise = decade of the steepest jump (None if under 15% of the peak)."""
    dm = ts.reshape(22, 10).mean(1)
    mx = float(dm.max())
    norm = dm / mx
    diffs = np.diff(norm)[:-1]          # the 2010s are left out of the rise search: the corpus itself changes character after ~2008
    rise = int(np.argmax(diffs)) + 1
    return dict(c=[int(round(x * 100)) for x in norm], mx=float("%.3g" % (mx * 1e6)), pk=DECADES[int(np.argmax(dm))],
                rise=DECADES[rise] if diffs[rise - 1] >= 0.15 else None, first=next((DECADES[j] for j in range(22) if norm[j] >= 0.1), None))


def load_ngrams(nodes, verbose=True):
    d = ngram_dir()
    out = [None] * len(nodes)
    if not d:
        return out, dict(found=0, terms=0)
    import urllib.parse
    cache = {}

    def get(term):
        if term in cache:
            return cache[term]
        f = d / ("n1800__" + urllib.parse.quote(term, safe="") + ".json")
        v = None
        if f.exists():
            j = json.loads(f.read_text())
            if j.get("found") and len(j.get("ts", [])) == 220:
                v = np.array(j["ts"], dtype=float)
        cache[term] = v
        return v
    found = 0
    for i, nd in enumerate(nodes):
        if "(" in nd["n"]:
            continue          # "Red (Crayola)" is a variant: the word's curve belongs to the bare name
        base = re.sub(r"\(.*?\)", " ", nd["n"].lower()).replace("-", " ")
        base = unicodedata.normalize("NFKD", base).encode("ascii", "ignore").decode()
        base = re.sub(r"[^a-z ]+", "", base)
        base = re.sub(r"\s+", " ", base).strip()
        if not base:
            continue
        ts = None
        for term in {base, base.replace("grey", "gray"), base.replace("gray", "grey")}:
            v = get(term)
            if v is not None:
                ts = v if ts is None else ts + v
        if ts is None or ts.max() <= 0:
            continue
        out[i] = curve(ts)
        out[i]["term"] = base
        if " " not in base:
            va = None
            fa = d / ("n1800adj__" + urllib.parse.quote(base + "_ADJ", safe="") + ".json")
            fb = d / ("n1800adj__" + urllib.parse.quote(base.replace("grey", "gray") + "_ADJ", safe="") + ".json")
            for ff in sorted({fa, fb}):
                if ff.exists():
                    j = json.loads(ff.read_text())
                    if j.get("found") and len(j.get("ts", [])) == 220:
                        v = np.array(j["ts"], dtype=float)
                        va = v if va is None else va + v
            if va is not None and va.max() > 0:
                out[i]["adj"] = curve(va)
        found += 1
    if verbose:
        print(f"ngrams: curves for {found} of {len(nodes)} colors")
    return out, dict(found=found, terms=len(cache))


# =====================================================================================================================
# 6. HUBS
# =====================================================================================================================
FLOWERS = set("""lilac lavender rose violet iris orchid pansy petunia wisteria heliotrope marigold dandelion primrose jasmine daffodil lotus
poppy tulip carnation magnolia hyacinth hydrangea dahlia begonia geranium cyclamen fuchsia mallow mauve thistle heather periwinkle
cornflower buttercup sunflower daisy lily camellia azalea columbine gentian campanula hellebore lobelia phlox nasturtium bluebell
foxglove lupin peony mimosa gardenia hibiscus clover anemone celandine dogwood tulip wistaria forget-me-not cyclamen amaranth
chrysanthemum jonquil lotus orchid zinnia sweet-pea""".split())
MINERALS = set("""emerald amethyst sapphire ruby topaz citrine jade jasper opal onyx garnet spinel zircon carnelian tourmaline aquamarine
turquoise peridot olivine agate quartz basalt graphite chalcedony fluorite tyrolite microcline pyrite serpentine zinnwaldite
rhodonite thulite variscite pearl amber jet malachite azurite lapis cobalt cinnabar orpiment realgar sulphur diamond opal beryl
chessylite smalt verdigris gold silver bronze copper platinum nickel steel iron zinc titanium""".split())


def build_hubs(nodes):
    hubs = {}

    def add(hid, title, kind, slugs, blurb=""):
        slugs = list(dict.fromkeys(slugs))
        if slugs:
            hubs[hid] = dict(title=title, kind=kind, n=len(slugs), blurb=blurb, members=slugs)
    tier_title = {"pigment-mineral-dye": "Pigments, minerals and dyes", "traditional-system": "Japanese traditional colors",
                  "nature": "Named for nature", "place-institution": "Named for places and institutions", "person": "Named for people",
                  "standard-system": "Standards and systems", "commercial": "Commercial names", "descriptive-modifier": "Descriptive variations",
                  "basic-term": "The basic color words", "undocumented": "Origin not documented"}
    for t, title in tier_title.items():
        add("tier:" + t, title, "tier", [n["slug"] for n in nodes if n["tier"] == t])
    src_title = {"crayola": "Crayola colors", "css": "CSS and X11 colors", "jp": "Traditional colors of Japan", "iscc-nbs": "ISCC-NBS 1955 names",
                 "ridgway": "Ridgway 1912 names", "werner": "Werner 1821 names", "maerz-paul": "Maerz and Paul 1930 names", "ral": "RAL colors",
                 "xkcd": "xkcd survey names (2010)", "pigment": "Historical pigment names"}
    for c, title in src_title.items():
        add("source:" + c, title, "source", [n["slug"] for n in nodes if c in n["srcs"]])
    for f in sorted({n["fam"] for n in nodes}):
        add("family:" + f.lower(), f, "family", [n["slug"] for n in nodes if n["fam"] == f])
    cent = defaultdict(list)
    for n in nodes:
        y = n["first"][0] if n["first"] else None
        if y is not None:
            cent["pre-1000" if y < 1000 else str(y // 100 * 100)].append(n["slug"])
    for c, sl in cent.items():
        add("century:" + c, ("First recorded before 1000" if c == "pre-1000" else "First recorded in the %ss" % c), "century", sl,
            "Earliest date in our own source lists (a name's record, not the color's invention).")

    def toks(n):
        return set(GT.tokens(n["n"]))
    add("namesake:people", "Colors named after people", "namesake", [n["slug"] for n in nodes if n["tier"] == "person"])
    add("namesake:places", "Colors named after places", "namesake", [n["slug"] for n in nodes if n["tier"] == "place-institution"])
    add("namesake:flowers", "Colors named after flowers", "namesake", [n["slug"] for n in nodes if n["tier"] == "nature" and toks(n) & FLOWERS])
    add("namesake:minerals", "Colors named after minerals and gems", "namesake",
        [n["slug"] for n in nodes if n["tier"] == "pigment-mineral-dye" and toks(n) & MINERALS])
    add("namesake:animals-foods", "Colors named after animals and foods", "namesake",
        [n["slug"] for n in nodes if n["tier"] == "nature" and not (toks(n) & FLOWERS)])
    return hubs


# =====================================================================================================================
# 7. FIELD NOTES (plain-English facts with their n)
# =====================================================================================================================
def century_label(c):
    return "the %ds" % c


def make_facts(nd, ar, ng, meta, names_by_slug, art_slug):
    f = []
    fy = nd["first"][0] if nd.get("first") else None
    P = meta["P"]
    if ar is None:
        return f
    n, nph = ar["n"], ar["nph"]
    if n == 0 and nph == 0:
        f.append(dict(k="presence", t="No painting in our %s-painting archive has this color covering at least 1%% of its canvas (within %s of it), as photographed. That describes this archive, not painting as a whole." % (format(P, ","), "CIEDE2000 4"), n=0))
        return f
    f.append(dict(k="presence", t="Appears in %s%% of the %s paintings in our archive (%s paintings, as photographed; the within-painting lens finds it in %s)." %
                  (ar["pctph"], format(P, ","), format(nph, ","), format(n, ",")), n=nph))
    if n >= 1:
        rarity = "more common than %d%% of the named colors" % ar["rp"] if ar["rp"] >= 50 else "rarer than %d%% of the named colors" % (100 - ar["rp"])
        f.append(dict(k="rank", t="In our %s-painting archive it is %s." % (format(P, ","), rarity), n=n))
    pc = ar.get("pc")
    if pc and pc["obs"] >= meta["min_n"]["claim"]:
        f.append(dict(k="century", t="Peaks in %s: found in %s%% of the %s paintings we have from then (%s paintings). Against the same museums' baseline that is %sx the expected rate." % (
            century_label(pc["y"]), pc["rate"], format(pc["n"], ","), pc["obs"], pc["lift"]), n=pc["obs"]))
    role = ar.get("role")
    if role and sum(role) and n >= 10:
        names_r = ["a shadow", "a mid-tone", "a light", "an accent", "a hidden color"]
        j = int(np.argmax(role))
        f.append(dict(k="role", t="Inside a painting it most often plays %s (%d%% of the %d paintings, by lightness rank within each painting, so varnish cannot fake it)." % (names_r[j], role[j], n), n=n))
    if ar.get("pa"):
        a = ar["pa"][0]
        f.append(dict(k="painter", t="Most devoted painter: %s, in %d of %d works here (%sx the baseline of the museums those works come from; as photographed %sx; n=%d)." % (
            a[0], a[1], a[2], a[3], a[4], a[1]), n=a[1], artist=art_slug(a[0])))
    elif ar.get("pn") and n >= 20:
        a = ar["pn"][0]
        f.append(dict(k="painter-count", t="Painted most often by %s (%d of %d works here, %d%% of them). No painter stands out against the museum baseline." % (a[0], a[1], a[2], a[3]), n=a[1]))
    fs = ar.get("fs")
    if fs and fs["n"] >= meta["min_n"]["claim"]:
        f.append(dict(k="first-seen", t="First seen in our archive in %d (%s%s); the third-earliest painting is %d, and the latest %d (%d dated paintings, at least 2%% of the canvas, as photographed). The archive's early centuries are thin, so this is a floor, not a first." % (
            fs["y"], fs["id"], (", by " + fs["fa"]) if fs.get("fa") else "", fs["y3"], fs["ly"], fs["n"]), n=fs["n"], before_record=bool(fy and fs["y"] < fy - 30)))
        if fy and fs["y"] < fy - 30:
            f[-1]["t"] += " That is %d years before the name's earliest record in our sources (%d): the match is a look-alike hue in an aged photograph, not proof of the pigment or dye." % (fy - fs["y"], fy)
    if ar.get("co"):
        c = ar["co"][0]
        f.append(dict(k="country", t="Most over-represented in %s (%sx expected; %d of %d paintings)." % (c[0], c[3], c[1], c[2]), n=c[1]))
    if ar.get("pw"):
        top = ar["pw"][:2]
        f.append(dict(k="company", t="Shares canvases with %s more than chance (lift %s and %s; n=%d and %d)." % (
            " and ".join(names_by_slug(t[0]) for t in top), top[0][2], top[1][2] if len(top) > 1 else "-", top[0][1], top[1][1] if len(top) > 1 else 0), n=top[0][1]))
    if ng:
        g = ng.get("adj") or ng
        t = "In printed English the word peaks in the %ds" % g["pk"]
        if g["rise"]:
            t += " and rose fastest in the %ds" % g["rise"]
        t += " (Google Books, adjective use only, which is the color sense)." if ng.get("adj") else " (Google Books, all senses of the word, so a color name that is also an object or a place can mislead)."
        f.append(dict(k="word", t=t, n=None, sense="adjective" if ng.get("adj") else "all"))
    return f


# =====================================================================================================================
# 8. SUPERLATIVES
# =====================================================================================================================
def build_superlatives(nodes, ar, meta, raw, D, art_slug):
    P = meta["P"]
    N = len(nodes)
    cin, cph = raw["cnt_in"], raw["cnt_ph"]
    arch = "our %s-painting archive" % format(P, ",")

    def card(i, **kw):
        return dict(s=nodes[i]["slug"], name=nodes[i]["n"], h=nodes[i]["h"], **kw)

    known = np.array([("core" in nd["lists"] or "cur" in nd["lists"]) for nd in nodes])    # records name the well-known colors

    def dedupe(order, limit, gap=8.0):
        chosen = []
        for i in order:
            if known[i] and all(D[i, j] >= gap for j in chosen):
                chosen.append(int(i))
            if len(chosen) >= limit:
                break
        return chosen
    sup = dict(
        rules=dict(
            archive=arch, minN=meta["min_n"], lenses="photo = share as photographed; within = relative to the painting (lightness rank, accent, hidden roles). Lists use the within lens, and show the photo count beside it.",
            asPhotographed=True, pool="records name colors from the core list and the curriculum (about 1,000 familiar names); near-identical neighbors within dE 6-8 are collapsed to one",
            phrasing="Say 'rarest in %s', never 'rarest ever used'. A color absent here is absent from this archive, not from painting. Every record carries its n." % arch,
            match="a named color is 'in' a painting when a pool color within CIEDE2000 %s of it covers >= 1%% of the canvas (photo) and >= 15%% of its role band (within)" % meta["match_de"]))
    # rarest that do appear (n >= 3 so a single odd pixel patch is not a record)
    order = [i for i in np.argsort(cin, kind="stable") if cin[i] >= 3]
    sup["rarest_present"] = [card(i, n_in=int(cin[i]), n_photo=int(cph[i])) for i in dedupe(order, 25, 6.0)]
    sup["never_in_archive"] = dict(count=int((cph == 0).sum() + 0), of=N, note="Named colors with no painting at >= 1% of the canvas within dE 4, as photographed. Mostly neons, fluorescents and synthetic brights that paint and canvas rarely reach.",
                                   examples=[card(i) for i in dedupe([i for i in np.argsort(-np.array([nodes[j]["lch"][1] for j in range(N)])) if cph[i] == 0], 12, 10.0)])
    sup["rare_counts"] = dict(zero=int((cin == 0).sum()), one_to_two=int(((cin >= 1) & (cin <= 2)).sum()), three_plus=int((cin >= 3).sum()))
    order = list(np.argsort(-cin, kind="stable"))
    sup["most_common"] = [card(i, n_in=int(cin[i]), pct=round(100 * cin[i] / P, 1), n_photo=int(cph[i])) for i in dedupe(order, 25, 6.0)]
    # per century: most common (rate) and most distinctive (museum-adjusted lift)
    per_c = {}
    DY = raw["DY"]
    for t, cname in enumerate(raw["cen_names"]):
        rate = DY["obs_in"][t] / max(DY["n"][t], 1)
        lift = DY["obs_in"][t] / (DY["exp_in"][t] + 0.5)
        top = dedupe(np.argsort(-rate), 5, 8.0)
        dist = dedupe([i for i in np.argsort(-lift) if DY["obs_in"][t][i] >= 15 and lift[i] >= 2], 5, 8.0)
        per_c[str(cname)] = dict(n=int(DY["n"][t]), most_common=[card(i, pct=round(float(rate[i] * 100), 1), n=int(DY["obs_in"][t][i])) for i in top],
                                 distinctive=[card(i, lift=round(float(lift[i]), 1), n=int(DY["obs_in"][t][i])) for i in dist])
    sup["by_century"] = per_c
    # rose and fell fastest: adjacent centuries, both lenses
    risers, fallers = [], []
    cn = raw["cen_names"]
    for t in range(1, len(cn)):
        if DY["n"][t] < 500 or DY["n"][t - 1] < 500:
            continue
        r1 = DY["obs_in"][t - 1] / DY["n"][t - 1] * 100
        r2 = DY["obs_in"][t] / DY["n"][t] * 100
        p1 = DY["obs_ph"][t - 1] / DY["n"][t - 1] * 100
        p2 = DY["obs_ph"][t] / DY["n"][t] * 100
        for i in range(N):
            if known[i] and DY["obs_in"][t][i] >= 40 and r2[i] - r1[i] >= 3 and p2[i] > p1[i]:
                risers.append((float(r2[i] - r1[i]), i, int(cn[t - 1]), int(cn[t]), float(r1[i]), float(r2[i]), int(DY["obs_in"][t][i])))
            if known[i] and DY["obs_in"][t - 1][i] >= 40 and r1[i] - r2[i] >= 3 and p1[i] > p2[i]:
                fallers.append((float(r1[i] - r2[i]), i, int(cn[t - 1]), int(cn[t]), float(r1[i]), float(r2[i]), int(DY["obs_in"][t - 1][i])))
    for name, lst in (("rose_fastest", risers), ("fell_fastest", fallers)):
        lst.sort(reverse=True)
        out, used = [], []
        for d, i, a, b, r1, r2, nn in lst:
            if all(D[i, j] >= 8 for j in used):
                used.append(i)
                out.append(card(i, **{"from": a, "to": b, "pct_from": round(r1, 1), "pct_to": round(r2, 1), "points": round(d, 1), "n": nn}))
            if len(out) >= 15:
                break
        sup[name] = out
    # concentrated in one painter: the share of a color's paintings that come from its single biggest painter
    DA = raw["DA"]
    conc = []
    for i in range(N):
        if cin[i] >= 10 and known[i]:
            col = DA["obs_in"][:, i]
            t = int(np.argmax(col))
            if col[t] >= 4:
                conc.append((float(col[t] / cin[i]), i, t, float(col[t])))
    conc.sort(reverse=True)
    conc_cards = [card(i, painter=raw["art_names"][t], artist=art_slug(raw["art_names"][t]), n_painter=int(c), of=int(cin[i]), frac=round(f, 2))
                  for f, i, t, c in conc[:15]]
    sup["unique_to_one_painter"] = dict(
        threshold=0.5, found=[c for c in conc_cards if c["frac"] >= 0.5],
        note="No familiar named color belongs to a single painter in our archive; the most concentrated is below. Painters hold at most %d works each here (a per-painter cap in the corpus), so this is a floor on sharing." % int(raw["DA"]["n"].max()),
        most_concentrated=conc_cards)
    # most loyal color-painter pairs: the share of a painter's works that contain the color, with real lift on both lenses
    lo = DA["obs_in"] / np.maximum(DA["n"], 1)[:, None]
    lift_in = DA["obs_in"] / (DA["exp_in"] + 0.5)
    lift_ph = DA["obs_ph"] / (DA["exp_ph"] + 0.5)
    ok = (DA["n"][:, None] >= 30) & (DA["obs_in"] >= 8) & (lift_in >= 4) & (lift_ph >= 2.5)
    cand = np.argwhere(ok)
    cand = sorted(cand.tolist(), key=lambda ti: -lo[ti[0], ti[1]])
    used, pairs = defaultdict(list), []
    for t, i in cand:
        if known[i] and all(D[i, j] >= 8 for j in used[t]) and len(used[t]) < 2:
            used[t].append(i)
            pairs.append(card(i, painter=raw["art_names"][t], artist=art_slug(raw["art_names"][t]), works=int(DA["n"][t]), with_color=int(DA["obs_in"][t, i]),
                              frac=round(float(lo[t, i]), 2), lift=round(float(lift_in[t, i]), 1), lift_photo=round(float(lift_ph[t, i]), 1)))
        if len(pairs) >= 25:
            break
    sup["most_loyal_pairs"] = pairs
    # longest-lived and one-century colors
    cur = np.array([ar[i]["cur"] for i in range(N)])         # N x centuries, % of paintings
    live = (cur >= 1.0).sum(1)
    order = [i for i in np.argsort(-live, kind="stable") if cin[i] >= 100]
    sup["longest_lived"] = [card(i, centuries=int(live[i]), of=len(cn), n=int(cin[i])) for i in dedupe(order, 15, 8.0)]
    return sup


def build_baselines(nodes, corpus, raw, D):
    """Each museum's mean palette: the colors its photographs contain most often (both lenses) and its mean L*/C*. Painter lift is
    measured against these, so one camera's brown cannot become a painter's signature."""
    known = [("core" in nd["lists"] or "cur" in nd["lists"]) for nd in nodes]
    out = {}
    for si, sname in enumerate(raw["src_names"]):
        rows = [x for x in corpus if x.get("src") == sname]
        Ls = [x["L"] for x in rows if x.get("L") is not None]
        Cs = [x["C"] for x in rows if x.get("C") is not None]
        top = []
        for i in np.argsort(-raw["base_in"][si]):
            if known[i] and all(D[i, j] >= 8 for j in top):
                top.append(int(i))
            if len(top) >= 12:
                break
        out[sname] = dict(n=int(raw["n_src"][si]), L_mean=round(float(np.mean(Ls)), 1) if Ls else None, C_mean=round(float(np.mean(Cs)), 1) if Cs else None,
                          top=[dict(s=nodes[i]["slug"], name=nodes[i]["n"], within_pct=round(float(raw["base_in"][si][i] * 100), 1),
                                    photo_pct=round(float(raw["base_ph"][si][i] * 100), 1)) for i in top])
    return out


# =====================================================================================================================
# 9. LITE
# =====================================================================================================================
FAMS = ["Reds", "Oranges", "Yellows", "Greens", "Blues", "Purples", "Pinks", "Browns", "Neutrals"]
TIERS = ["pigment-mineral-dye", "traditional-system", "nature", "place-institution", "person", "standard-system", "commercial",
         "descriptive-modifier", "basic-term", "undocumented"]


def build_lite(nodes, edges, idx):
    rows = []
    for i, nd in enumerate(nodes):
        la = [idx[s] for s, _, _ in edges[i]["la"][:3]]
        par = idx.get(nd["par"], -1) if nd["par"] else -1
        rows.append([nd["slug"], nd["n"], nd["h"][1:], FAMS.index(nd["fam"]) if nd["fam"] in FAMS else 8, TIERS.index(nd["tier"]), la, par])
    return dict(v=VERSION, fams=FAMS, tiers=TIERS, cols=["slug", "name", "hex6", "fam", "tier", "lookalikes(idx)", "parent(idx|-1)"], n=len(rows), rows=rows)


# =====================================================================================================================
# main
# =====================================================================================================================
def shard_of(slug):
    c = slug[0]
    return c if c.isalpha() else "_"


def main():
    t0 = time.time()
    do_archive = "--no-archive" not in sys.argv
    js = load_js()
    nodes, merges, conflicts = build_nodes(js)
    attach_sources(nodes, js)
    labs = attach_codes(nodes)
    by_key = classify_tiers(nodes)
    D, edges, idx = build_edges(nodes, labs, by_key, js)
    groups, contested = build_disambig(nodes, D, edges)
    print(f"disambiguation: {len(groups)} groups, {len(contested)} contested-hex names")
    N = len(nodes)
    # alias file
    aliases = {}
    for nd in nodes:
        for m in nd["members"][1:]:
            s = slugify(m)
            if s != nd["slug"]:
                aliases[s] = nd["slug"]
    # ---- archive ----
    ar = [None] * N
    meta = dict(P=0, min_n=__import__("graph_archive").MIN_N, centuries=[], cen_n=[], decades=[], sources={})
    sup = None
    baselines = None
    if do_archive:
        import graph_archive as GA
        corpus, A = GA.build(ROOT, labs)
        ar, meta, raw = GA.stats(corpus, A, N, D)
        for c in range(N):
            ar[c]["pw"] = [[nodes[j]["slug"]] + rest for j, *rest in ar[c]["pw"]]
            ar[c]["nw"] = [[nodes[j]["slug"]] + rest for j, *rest in ar[c]["nw"]]
        art_slug = GA.aslug
        sup = build_superlatives(nodes, ar, meta, raw, D, art_slug)
        baselines = build_baselines(nodes, corpus, raw, D)
    else:
        art_slug = lambda s: slugify(s)
    ng, ng_meta = load_ngrams(nodes)
    hubs = build_hubs(nodes)
    # ---- write ----
    if OUT.exists():
        for f in list(OUT.glob("*.json")) + list((OUT / "fieldnotes").glob("*.json")):
            f.unlink()
    shards = defaultdict(lambda: dict(nodes=[], edges=[], fn=[]))
    name_of = {nd["slug"]: nd["n"] for nd in nodes}
    for i, nd in enumerate(nodes):
        sh = shard_of(nd["slug"])
        rec = dict(s=nd["slug"], n=nd["n"], h=nd["h"], ls=sorted(nd["lists"]), fam=nd["fam"], rgb=nd["rgb"], hsl=nd["hsl"], cmyk=nd["cmyk"], lab=nd["lab"],
                   lch=nd["lch"], ok=nd["ok"], iscc=nd["iscc"], mu=nd["mu"], src=nd["sources"], tier=nd["tier"], why=nd["why"], pL=nd["pL"], pC=nd["pC"],
                   cw=nd["cw"], cb=nd["cb"])
        if nd["par"]:
            rec["par"] = nd["par"]; rec["pk"] = nd["pk"]
        if nd["first"]:
            rec["fy"] = nd["first"][0]; rec["fs"] = nd["first"][1]
        for key, v in (("since", nd.get("since")), ("alts", nd["alts"] or None), ("aka", [m for m in dict.fromkeys(nd["members"][1:]) if m != nd["n"]] or None), ("jp", nd["jp_d"]),
                       ("werner", nd["werner_d"]), ("note", nd["note"] or None)):
            if v:
                rec[key] = v
        shards[sh]["nodes"].append(rec)
        e = {k: v for k, v in edges[i].items() if v not in (None, [], {}, 0)}
        e["s"] = nd["slug"]
        if ar[i] is not None:
            a = ar[i]
            e["ap"] = a["ap"]
            if a["pa"]:
                e["fb"] = [[art_slug(x[0]), x[3], x[4], x[1], x[2]] for x in a["pa"]]      # artist slug, lift(within), lift(photo), n with, n works
            if a["pw"]:
                e["pw"] = a["pw"]
            if a["nw"]:
                e["nw"] = a["nw"]
        shards[sh]["edges"].append(e)
        fn = dict(s=nd["slug"])
        if ar[i] is not None:
            a = {k: v for k, v in ar[i].items() if k not in ("ap", "pw", "nw")}
            a["pa"] = [[art_slug(x[0])] + x for x in a["pa"]]
            a["pn"] = [[art_slug(x[0])] + x for x in a["pn"]]
            fn["ar"] = a
            fn["facts"] = make_facts(nd, ar[i], ng[i], meta, lambda s: name_of.get(s, s), art_slug)
        else:
            fn["facts"] = []
        if ng[i]:
            fn["ng"] = ng[i]
        fn["rec"] = dict(first=nd["first"][0] if nd["first"] else None, first_src=nd["first"][1] if nd["first"] else None,
                         sources=[[x[0], x[1]] for x in nd["sources"]], since=nd.get("since"), origin="documented in the tier's why" if nd["tier"] != "undocumented" else "origin undocumented in our data")
        shards[sh]["fn"].append(fn)
    sizes = {}
    for sh, d in sorted(shards.items()):
        for kind, sub in (("nodes", "nodes-%s.json"), ("edges", "edges-%s.json")):
            jdump(OUT / (sub % sh), d[kind])
        jdump(OUT / "fieldnotes" / ("%s.json" % sh), d["fn"])
    jdump(OUT / "names.json", [[nd["slug"], nd["n"], nd["h"], TIERS.index(nd["tier"]), "".join(sorted(x[0] for x in nd["lists"]))] for nd in nodes])
    jdump(OUT / "aliases.json", dict(v=VERSION, note="alias slug -> canonical slug. Merged: same key, spelling variants (any dE; the other hex is kept in alts) and -ish twins (dE < 2). Not merged (listed under conflicts) when the spelling matches but the colors differ.",
                                     alias=dict(sorted(aliases.items())), merges=[dict(kind=k, a=a, b=b, de=d) for k, a, b, d in merges], conflicts=conflicts))
    jdump(OUT / "disambig.json", dict(v=VERSION, groups=groups, contested=contested))
    jdump(OUT / "hubs.json", dict(v=VERSION, hubs=hubs))
    if sup:
        jdump(OUT / "superlatives.json", sup)
    if baselines:
        jdump(OUT / "baselines.json", dict(v=VERSION, note="Per-museum mean palette (named colors found most often in that museum's photographs). Painter, country and century lift is computed against the baseline of the museums the works come from.", sources=baselines))
    lite = build_lite(nodes, edges, idx)
    jdump(OUT / "graph-lite.json", lite)
    tier_counts = dict(Counter(n["tier"] for n in nodes))
    edge_counts = dict(look_alike=sum(len(e["la"]) for e in edges), dup=sum(len(e["dup"]) for e in edges) // 2, parent=sum(1 for e in edges if e.get("par")),
                       aka=sum(len(e["aka"]) for e in edges), traditional_sibling=sum(len(e["trad"]) for e in edges), also=sum(len(e["also"]) for e in edges),
                       wheels=N * 3, twins=sum(len(v) for e in edges for v in e.get("tw", {}).values()),
                       appears_in=sum(len(a["ap"]) for a in ar if a), favored_by=sum(len(a["pa"]) for a in ar if a),
                       paired_with=sum(len(a["pw"]) for a in ar if a), never_with=sum(len(a["nw"]) for a in ar if a),
                       disambiguation_groups=len(groups), contested=len(contested))
    jdump(OUT / "index.json", dict(
        v=VERSION, built=time.strftime("%Y-%m-%d"), n=N, shard_rule="first character of the slug: a-z, else '_'; nodes-<s>.json, edges-<s>.json, fieldnotes/<s>.json",
        shards=sorted(shards), tiers=TIERS, tier_counts=tier_counts, edge_counts=edge_counts, families=FAMS, lists=dict(core=sum("core" in n["lists"] for n in nodes),
        library=sum("lib" in n["lists"] for n in nodes), curriculum=sum("cur" in n["lists"] for n in nodes)),
        source_dates={k: v[1] for k, v in GT.SOURCE_DATES.items()}, archive=dict(meta=meta, ngram=ng_meta),
        honesty=dict(photographed="Every archive number is as photographed (aged varnish, six museum cameras); screen colors are approximate.",
                     lenses="photo = share as photographed; within = relative to the painting (lightness rank band, accent, hidden). Signatures need both, measured against the same museum's baseline.",
                     phrasing="Say 'rarest in our %s-painting archive', never 'rarest ever used'." % format(meta["P"], ","), min_n=meta["min_n"]),
        schema=dict(
            node="s slug, n name, h hex, ls lists(core|lib|cur), fam family, rgb, hsl[h,s%,l%], cmyk(naive), lab, lch, ok oklch[L,C,h], iscc{b block,n name,de}, mu approx Munsell|null, src [[code,year|null,detail]], tier, why, par parent slug, pk parent kind(modifier|variant|family-word), fy/fs earliest dated record (year, source), since{y,what,approx} (curated, 101 colors), alts [[source,hex]] other hexes for this name, aka alternate spellings, jp, werner, pL/pC lightness/chroma percentile among named colors, cw/cb contrast ratio on white/black",
            edge="s; la [[slug,dE2000,direction words]x6] (excludes dE<2); dup [[slug,dE]] near-duplicates (dE<2, ndup=true count); par [slug,kind]; kids; nkids; aka; also [[name,slug|null]] (core list near-names); trad [[romaji,kanji,meaning,slug|null]]; trad_of; also_of; dis disambiguation group id; contested true when sources disagree on the hex; wh{p perceptual LCh, b RYB painter's, l RGB light}{c complement x3, l/r analogous x2 each side} (nearest core names); tw{botany,gems,fashion,films}[[id,label,dE]] within dE 10; ap appears-in [[paintingId, photo share %, role, within weight %]]; fb favored-by [[artistSlug, within lift, photo lift, paintings with, works]]; pw paired-with [[slug, paintings, within lift, photo lift]]; nw seldom seen with [[slug, expected, observed]]",
            fieldnotes="ar archive record: n/nph paintings (within/photo lens), pct/pctph % of archive, rk rank among all named colors (1 = rarest, ties share the lowest rank), rp % of named colors that are rarer than this one, pa painters by museum-adjusted lift, pn painters by count, co countries, mv movements, pd/pc peak decade/century, cur/curp/curl per-century rate (within / photo / lift), fs first/last seen, role % shadow|mid|light|accent|hidden, rp_ painting where each role is strongest; ng word-over-time {c 22 decade points 1800s..2010s normalized to peak, mx peak per million, pk, rise, adj: same for the adjective (color) sense}; facts plain-English sentences each with its n; rec record dates"),
        how="names.json resolves slugs; aliases.json resolves alias slugs; graph-lite.json is the small early-load file; nodes/edges/fieldnotes shards are lazy."))
    print("tier counts:", tier_counts)
    print("edge counts:", edge_counts)
    print("done in %.0fs" % (time.time() - t0))


if __name__ == "__main__":
    main()
