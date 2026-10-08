#!/usr/bin/env python3
"""Journey strand coverage: for the first N colors in (draft) stage order, which "world strands" can feed a
world step in a lesson (design/JOURNEY.md §6). Read-only: it writes nothing unless --json is given.

  python3 tools/journey_coverage.py                 # table + gaps for the first 250, stage by stage
  python3 tools/journey_coverage.py --n 400         # a different cut
  python3 tools/journey_coverage.py --list          # one row per color (what each one has)
  python3 tools/journey_coverage.py --json out.json # the per-color rows, for the §19 writing plan
  python3 tools/journey_coverage.py --xkcd PATH     # xkcd rgb.txt (default: research/_raw/library/xkcd-rgb.txt,
                                                    # gitignored; falls back to the main checkout, then to `rank`)

Stage order. data/core-names.json `rank` is family-blocked for 0-100 (the old units) and alphabetical after that,
so this script builds the DRAFT order the journey spec assumes until the real ordering job (ROADMAP §14) lands:
the 11 basics first (placement only), then every other core name by usefulness (its best xkcd survey rank, the
"most named first" proxy COLOR-SELECTION.md uses), skipping any name closer than CIEDE2000 6.5 to one already
placed (it waits for a later stage, where the finer distinctions belong). The result mixes families on its own.

A strand "has" a color when the data can build a 10-second world step for it:
  painting  a featured painting (data/paintings.js) has a palette swatch named it, >= 5% of the canvas
  museum    museum paintings (data/gallery/, 23.5k) with a swatch >= 5% whose nearest core name is it, within 5
  poem      a vetted line in data/poems-index.json `best` (poem shards) that uses the word as a color
  prose     a literary passage (data/passages.json) that mentions it
  flower    a plant whose own color is it: BOTANY.byColor (Werner/named/floriography links, not dye sources),
            Werner's 1821 plant examples, or Greenaway's floriography colors (nearest within 5)
  gem       a gem that lent it its name, or a gem palette swatch whose nearest core name is it, within 5
  fashion   a decade palette, a Pantone Color of the Year or a house signature color, by name or nearest within 5
  film      a film's discussed colors (data/films.js), by app name or nearest within 5
  article   its own color article (data/wiki-colors.js)
  story     named ([[link]]) in a story (data/stories.js) or a topic page (data/wiki-nodes.js)
"Nearest" uses all 1,000 core names, the same pool nameOf() names with (ROADMAP §13).
"""
import argparse, json, re, subprocess, sys
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
from library import labs, de2000, family  # same CIEDE2000 + family rule as the rest of the tools

STAGES = [25, 50, 100, 150, 250, 400, 600, 800, 1000]
NEAR = 5.0          # "nearest core name within 5" = what a step can honestly call that color
SHARE = 0.05        # a painting spot must cover at least 5% to be findable in 10 seconds
FLOOR = 6.5         # COLOR-SELECTION.md rule (b): taught names stay this far apart
STRANDS = ["painting", "museum", "poem", "prose", "flower", "gem", "fashion", "film", "article", "story"]


def load_js(names):
    """Evaluate the data/*.js files in node and hand back their window globals as JSON."""
    js = "global.window={};" + "".join(f'require("{ROOT}/data/{n}.js");' for n in names) + \
         "process.stdout.write(JSON.stringify(window));"
    return json.loads(subprocess.run(["node", "-e", js], capture_output=True, text=True, check=True).stdout)


def xkcd_ranks(path):
    cands = [Path(path)] if path else [ROOT / "research/_raw/library/xkcd-rgb.txt"]
    if not path and ".claude/worktrees" in str(ROOT):          # a worktree has no gitignored files: use the main one
        cands.append(Path(str(ROOT).split("/.claude/worktrees")[0]) / "research/_raw/library/xkcd-rgb.txt")
    for p in cands:
        if p.exists():
            rows = [l.split("\t")[0].strip().lower().replace("gray", "grey") for l in p.read_text().splitlines()
                    if l and not l.startswith("#")]
            return {n: len(rows) - i for i, n in enumerate(rows)}, str(p)   # rank 1 = most named (end of file)
    return {}, None


def best_rank(name, xr):
    n = name.lower().replace("gray", "grey")
    opts = [n] + [f"{n} {b}" for b in ("blue", "green", "red", "pink", "purple", "brown", "yellow", "orange", "grey")]
    opts += ["burnt " + n]
    r = [xr[o] for o in opts if o in xr]
    return min(r) if r else None


MODS = {"light", "dark", "pale", "bright", "deep", "dull", "dusty", "dusky", "medium", "pastel", "darkish", "lightish",
        "greyish", "bluish", "reddish", "pinkish", "yellowish", "greenish", "purplish", "brownish", "pinky", "purply",
        "faded", "soft", "vivid", "pure", "very", "true"}
BASIC = {"red", "orange", "yellow", "green", "blue", "purple", "pink", "brown", "grey", "black", "white"}


def _ish(x):
    """reddish -> red, purplish -> purple, tealish -> teal; anything else -> None"""
    if not x.endswith("ish"): return None
    b = x[:-3]
    return {"redd": "red", "purpl": "purple", "orang": "orange"}.get(b, b)


def grammar_kind(name, rank, core_rank):
    """Names the modifier grammar builds (ROADMAP §13: light/dark/pale/..., hue leans) or that only repeat a word
    already on the list. They aren't new words: the journey teaches the grammar once and these come free."""
    w = name.lower().replace("-", " ").split()
    if len(w) == 1:
        if w[0] in {"dark", "light", "pale", "purply", "pinky"} or _ish(w[0]) in BASIC | {"teal"}: return "modifier"
        twins = [core_rank[f"{w[0]} {b}"] for b in BASIC if f"{w[0]} {b}" in core_rank]
        return "repeat" if twins and min(twins) < rank else None                 # Sky, when Sky blue ranks first
    if w[0] in MODS: return "modifier"                                                # Light Blue, Dull Green
    if all(x in BASIC or _ish(x) in BASIC for x in w): return "lean"                  # Blue Purple, Yellow green
    head = " ".join(w[:-1])
    if w[-1] in BASIC and head in core_rank and core_rank[head] < rank: return "repeat"   # Lime Green (Lime)
    return None


def stage_order(core, xr):
    core_rank = {c["n"].lower().replace("-", " "): c["rank"] for c in core}
    for c in core: c["_gram"] = grammar_kind(c["n"], c["rank"], core_rank) if c["rank"] > 10 else None
    basics = [c for c in core if c["rank"] <= 10]
    rest = [c for c in core if c["rank"] > 10 and not c["_gram"]]
    gram = [c for c in core if c["_gram"]]
    for c in rest:
        r = best_rank(c["n"], xr)
        c["_use"] = r if r is not None else 2000 + c["rank"]      # unranked names keep their old order, after
    rest.sort(key=lambda c: (c["_use"], c["rank"]))
    D = de2000(labs([c["h"] for c in rest]), labs([c["h"] for c in rest]))
    placed, waiting = [], list(range(len(rest)))
    while waiting:                          # each pass takes, in usefulness order, every name that clears the floor
        later = []
        for i in waiting:
            if all(D[i, j] >= FLOOR for j in placed): placed.append(i)
            else: later.append(i)
        if len(later) == len(waiting):      # nothing left clears it: the rest follow in usefulness order
            placed += later; break
        waiting = later
    gram.sort(key=lambda c: (best_rank(c["n"], xr) or 2000 + c["rank"]))
    return basics + [rest[i] for i in placed] + gram    # grammar-built names last: they fill no word slot


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=250)
    ap.add_argument("--list", action="store_true")
    ap.add_argument("--json")
    ap.add_argument("--xkcd")
    a = ap.parse_args()

    core = json.loads((ROOT / "data/core-names.json").read_text())
    xr, xsrc = xkcd_ranks(a.xkcd)
    order = stage_order(core, xr)
    names = [c["n"] for c in core]
    L = labs([c["h"] for c in core])

    def nearest(hexes):
        """nearest core name and its distance, for a list of hexes"""
        if not hexes: return []
        d = de2000(labs(hexes), L)
        i = d.argmin(1)
        return [(names[k], float(d[j, k])) for j, k in enumerate(i)]

    W = load_js(["paintings", "botany", "gems", "fashion", "films", "wiki-colors", "wiki-nodes", "stories"])
    has = {n: {s: 0 for s in STRANDS} for n in names}
    ex = {n: {} for n in names}            # one example per strand, for the spec's sample lessons

    def hit(n, s, e=None):
        if n in has:
            has[n][s] += 1
            if e and s not in ex[n]: ex[n][s] = e

    # featured paintings
    for p in W["PAINTINGS"]:
        sw = [x for x in p["palette"] if x.get("share", 0) >= SHARE]
        for x, (nn, d) in zip(sw, nearest([x["h"] for x in sw])):
            # only a close match counts: Monet's "mauve" in Houses of Parliament is 12.6 from Mauve (a greyish one)
            got = {nn} if d <= NEAR else set()
            if x.get("vocabDE", 99) <= NEAR: got.add(x["vocab"])
            for g in got: hit(g, "painting", f'{p["title"]} ({p["artist"]}), {round(x["share"] * 100)}%')

    # museum gallery: decode index.bin (30-byte records: year, museum, aspect, L, C, then 6 x RGB + share*250)
    gi = json.loads((ROOT / "data/gallery/index.json").read_text())
    b = np.frombuffer((ROOT / "data/gallery/index.bin").read_bytes(), dtype=np.uint8).reshape(gi["n"], gi["rec"])
    sw = b[:, 6:30].reshape(-1, 6, 4)
    rgb, share = sw[..., :3].reshape(-1, 3), sw[..., 3].reshape(-1) / 250
    keep = share >= SHARE
    from library import rgb_to_lab
    lab = rgb_to_lab(rgb[keep])
    best_i, best_d = np.zeros(len(lab), int), np.zeros(len(lab))
    for s in range(0, len(lab), 4000):
        d = de2000(lab[s:s + 4000], L)
        best_i[s:s + 4000], best_d[s:s + 4000] = d.argmin(1), d.min(1)
    painting_of = np.repeat(np.arange(gi["n"]), 6)[keep]
    per, top = {}, {}
    for k, dd, pi, sh in zip(best_i, best_d, painting_of, share[keep]):
        if dd <= NEAR:
            per.setdefault(names[k], set()).add(int(pi))
            if sh > top.get(names[k], (0, 0))[0]: top[names[k]] = (float(sh), int(pi))
    for n, s in per.items(): has[n]["museum"] = len(s)
    for n, (sh, pi) in top.items(): ex[n]["museum"] = f"gallery #{pi}, {round(sh * 100)}%"

    # poems: the vetted best lines per color word, and prose passages
    pidx = json.loads((ROOT / "data/poems-index.json").read_text())
    for ci, col in enumerate(pidx["colors"]):
        lines = pidx["best"].get(str(ci), [])
        for l in lines:
            hit(col[0], "poem", l[2] if len(l) > 2 else None)
    for p in json.loads((ROOT / "data/passages.json").read_text())["passages"]:
        for c in p.get("colors", []):
            hit(c.get("app") or c.get("name"), "prose", f'{p["author"]}, {p["work"]}')

    # flowers
    by = W["BOTANY"]["byColor"]
    for n, plants in by.items():
        for pl in plants:
            if pl.get("link") != "dye": hit(n, "flower", pl["plant"])
    wer = W["BOTANY"]["werner"]
    for w_, (nn, d) in zip(wer, nearest([w["hex"] for w in wer])):
        if d <= NEAR and w_.get("plant"): hit(nn, "flower", f'{w_["plant"]} (Werner: {w_["name"]})')
    for row in W["BOTANY"]["flori"]:
        for c in (row[3] or []):
            if row[2]: hit(c, "flower", f'{row[0]}, "{row[1]}"')

    # gems
    for g in W["GEMS"]["gems"]:
        for c in g.get("colors", []): hit(c, "gem", g["title"])
        for (h, label), (nn, d) in zip(g["palette"], nearest([x[0] for x in g["palette"]])):
            if d <= NEAR: hit(nn, "gem", f'{g["title"]}: {label}')

    # fashion
    F = W["FASHION"]
    for dec in F["decades"]:
        for (h, nm), (nn, d) in zip(dec["swatches"], nearest([s[0] for s in dec["swatches"]])):
            for g in ({nm} & set(names)) | ({nn} if d <= NEAR else set()): hit(g, "fashion", f'the {dec["label"]}')
    for c in F["coty"]:
        nn, d = nearest([c["hex"]])[0]
        if d <= NEAR: hit(nn, "fashion", f'Color of the Year {c["year"]}: {c["name"]}')
    for c in F["houses"]:
        nn, d = nearest([c["hex"]])[0]
        if d <= NEAR: hit(nn, "fashion", f'{c["house"]}: {c["label"]}')

    # films
    for f in W["FILMS"]:
        cs = f.get("colors", [])
        for c, (nn, d) in zip(cs, nearest([c["h"] for c in cs])):
            for g in ({c.get("app")} & set(names)) | ({nn} if d <= NEAR else set()):
                hit(g, "film", f'{f["title"]} ({f["year"]}): {c.get("note", "")}')

    # articles and stories
    for n in W["WIKI_COLORS"]: hit(n, "article", "own article")
    link = re.compile(r"\[\[([^\]|]+)(?:\|[^\]]*)?\]\]")
    low = {n.lower(): n for n in names}
    for s in W["STORIES"]:
        for nm in {m.lower() for sl in s["slides"] for m in link.findall(sl.get("text", ""))}:
            if nm in low: hit(low[nm], "story", f'story "{s["title"]}"')
    for nd in W["WIKI_NODES"]:
        text = " ".join(nd.get("body", []))
        for nm in {m.lower() for m in link.findall(text)} | {c.lower() for c in nd.get("colors", [])}:
            if nm in low: hit(low[nm], "story", f'page "{nd["title"]}"')

    # ---- report ----
    cut = order[:a.n]
    rows = []
    for i, c in enumerate(cut):
        st = next(k for k, s in enumerate(STAGES) if i < s) + 1
        lab0 = labs([c["h"]])[0]
        Lh, Ch, Hh = lab0[0], float(np.hypot(lab0[1], lab0[2])), float(np.degrees(np.arctan2(lab0[2], lab0[1])) % 360)
        h = has[c["n"]]
        world = sum(1 for s in ("painting", "poem", "flower", "gem", "fashion", "film") if h[s]) + (h["museum"] >= 10)
        rows.append({"i": i + 1, "stage": st, "n": c["n"], "h": c["h"], "fam": family(Lh, Ch, Hh),
                     "basic": c["rank"] <= 10, "xkcd": best_rank(c["n"], xr), **h, "world": world,
                     "ex": ex[c["n"]]})

    print(f"Draft stage order: basics, then xkcd usefulness ({'from ' + xsrc if xsrc else 'NO xkcd file: core rank'}),"
          f" ΔE00 floor {FLOOR}. First {a.n} names.\n")
    taught = [r for r in rows if not r["basic"]]
    def pct(k, rs, t=1): return f'{sum(1 for r in rs if r[k] >= t)}/{len(rs)}'
    cols = [("painting", 1), ("museum", 1), ("museum", 10), ("poem", 1), ("prose", 1), ("flower", 1), ("gem", 1),
            ("fashion", 1), ("film", 1), ("article", 1), ("story", 1)]
    hdr = ["stage", "new"] + [f"{k}{'≥' + str(t) if t > 1 else ''}" for k, t in cols] + ["no world step"]
    print(" | ".join(hdr))
    for st in sorted({r["stage"] for r in rows}):
        rs = [r for r in taught if r["stage"] == st]
        if not rs: continue
        print(" | ".join([f"{st} ({STAGES[st - 1]})", str(len(rs))] + [pct(k, rs, t) for k, t in cols] +
                         [str(sum(1 for r in rs if r["world"] == 0))]))
    print(" | ".join(["all", str(len(taught))] + [pct(k, taught, t) for k, t in cols] +
                     [str(sum(1 for r in taught if r["world"] == 0))]))
    g = [c for c in core if c.get("_gram")]
    print(f"\nGrammar-built names left out of the word slots: {len(g)} of {len(core)} "
          f"(modifier {sum(c['_gram'] == 'modifier' for c in g)}, hue lean {sum(c['_gram'] == 'lean' for c in g)}, "
          f"repeat of a word {sum(c['_gram'] == 'repeat' for c in g)}), e.g. " + ", ".join(c["n"] for c in g[:12]))
    print("\nFamilies in each stage (taught names):")
    for st in sorted({r["stage"] for r in rows}):
        fams = {}
        for r in taught:
            if r["stage"] == st: fams[r["fam"]] = fams.get(r["fam"], 0) + 1
        print(f"  stage {st}: " + ", ".join(f"{k} {v}" for k, v in sorted(fams.items(), key=lambda x: -x[1])))
    print("\nStage 1-3 names in order:")
    for st in (1, 2, 3):
        print(f"  stage {st}: " + ", ".join(r["n"] for r in taught if r["stage"] == st))
    print("\nGaps: taught names with no featured/vetted world strand (only museum<10 or nothing):")
    for st in sorted({r["stage"] for r in rows}):
        g = [r["n"] for r in taught if r["stage"] == st and r["world"] == 0]
        if g: print(f"  stage {st} ({len(g)}): " + ", ".join(g))
    print("\nNo article and no story mention:")
    for st in sorted({r["stage"] for r in rows}):
        g = [r["n"] for r in taught if r["stage"] == st and not r["article"] and not r["story"]]
        if g: print(f"  stage {st} ({len(g)}): " + ", ".join(g))
    if a.list:
        print()
        for r in rows:
            print(f'{r["i"]:>4} s{r["stage"]} {r["n"]:<18} {r["fam"]:<9} ' +
                  " ".join(f'{k[:4]}={r[k]}' for k in STRANDS))
    if a.json:
        Path(a.json).write_text(json.dumps(rows, indent=1, ensure_ascii=False))
        print(f"\nwrote {a.json}")


if __name__ == "__main__":
    main()
