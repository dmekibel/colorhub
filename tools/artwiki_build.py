#!/usr/bin/env python3
"""ColorHub art wiki: the data js/artwiki.js needs on top of data/analysis/ and data/artists/meta.json.

  python3 tools/artwiki_build.py        (after tools/analyze.py and tools/wikidata_artists.py)
      -> data/artists/ids.txt           painting ids, one per line, in gallery order (line i = gallery index i)
      -> data/artists/stats.json        {slug: [contrast, vivid, effective colors]} for percentiles across painters
      -> data/artists/p/<slug>.json     per painter: gallery indices of their paintings (barcode order), the
                                        museum-baselined signature colors, the within-painting roles, their darks
      -> data/artists/groups-extra.json per decade / country / movement: key painters, hue profile, palette over
                                        time, museum-baselined signature colors; plus the archive-wide hue profile

Why this exists (design/GENIUS-PANEL-1.md, calls 2.3 and 2.4): the archive reads brown. Varnish and each museum's
camera put Ink or Smoky Black at the top of every decade, so a raw "he uses ink 2.4x more" says more about the
photograph than the painter. Three corrections are computed here:
  * spelling twins are merged before counting (Bistre / Bister, Olive-Brown / Olive brown, Grey / Gray);
  * "lift against the same museum": a painter's mean share of a color divided by what the SAME museums' other
    paintings give it, weighted by where this painter's works hang;
  * a within-painting lens: which colors a painter makes the focal color, the accent, the hidden color or the
    glue tone far more often than the archive does. Those roles are relative inside one canvas, so varnish
    cannot fake them.
All numbers carry their support (paintings), and thin groups are dropped, not softened.
"""
import base64, json, math, re, sys
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
import analyze as AN   # noqa: E402  load_pools, find_raw_dir, load_core_names
import gallery as GAL  # noqa: E402  load_corpus
import library as LIB  # noqa: E402  labs

AD = ROOT / "data" / "analysis"
OUT = ROOT / "data" / "artists"
MIN_SUP = 3        # paintings a color must appear in before a lift is stated
MIN_PAINTER = 10   # painters with fewer paintings get no within-lens / museum-lift sentences


def canon_key(n):
    k = re.sub(r"[^a-z]", "", n.lower()).replace("grey", "gray").replace("bister", "bistre")
    return k


def unpack_hist(b64):
    return np.frombuffer(base64.b64decode(b64), dtype=np.uint8).astype(float) / 255.0


def main():
    corpus, _ = GAL.load_corpus()
    N = len(corpus)
    raw = AN.find_raw_dir(None)
    pools, _fb, _ = AN.load_pools(raw, corpus)
    core, *_ = AN.load_core_names()
    # canonical index per core name (spelling merge); display = the variant used by most paintings later
    ck = {}
    canon_of = []
    for i, e in enumerate(core):
        k = canon_key(e["n"])
        canon_of.append(ck.setdefault(k, i))
    labs = LIB.labs([e["h"] for e in core])
    coreL = [float(l[0]) for l in labs]

    # ---- decode every painting's named pool + roles ----
    ids = [x["id"] for x in corpus]
    (OUT / "p").mkdir(parents=True, exist_ok=True)
    (OUT / "ids.txt").write_text("\n".join(ids), encoding="utf-8")
    names = [None] * N      # list of canonical idx per pool position
    shares = [None] * N
    roles = [None] * N      # dict foc/glu/acc/hid -> canonical idx lists
    stat = [None] * N       # (ct, vivid, ef, hue12, Lm, warm)
    use = Counter()
    for s in range(0, N, 100):
        rows = json.loads((AD / f"paintings-{s // 100:03d}.json").read_text())
        for j, r in enumerate(rows):
            i = s + j
            assert r["id"] == ids[i], (r["id"], ids[i])
            b = base64.b64decode(r["cm"])
            codes = [(b[k] << 8 | b[k + 1]) >> 4 for k in range(0, len(b), 2)]
            cn = [canon_of[c] for c in codes]
            sh = [h[1] for h in pools[i]][:len(cn)]
            if len(sh) < len(cn):
                cn = cn[:len(sh)]
            names[i], shares[i] = cn, sh
            for c in set(cn):
                use[c] += 1
            at = lambda p: cn[p] if p is not None and 0 <= p < len(cn) else None
            roles[i] = dict(foc=at(r.get("foc")), glu=at(r.get("glu")),
                            acc=[at(p) for p in r.get("acc", []) if at(p) is not None],
                            hid=[at(p) for p in r.get("hid", []) if at(p) is not None])
            st = r["stat"]
            stat[i] = (st["ct"], st["ch"][2] / 1000.0, st["ef"] / 10.0, unpack_hist(st["hh"]), st["Lm"], st["wf"] / 1000.0)
    display = {}
    var = defaultdict(Counter)
    for c, k in use.items():
        pass
    for i, e in enumerate(core):
        var[canon_of[i]][e["n"]] += use.get(i, 0) + 1e-6
    disp = {c: v.most_common(1)[0][0] for c, v in var.items()}
    hexof = {c: core[c]["h"] for c in var}
    # the colors table the page needs: canonical idx -> [name, hex]; shipped once in groups-extra.json
    used = sorted({c for cn in names for c in cn})
    ctab = {c: [disp[c], hexof[c]] for c in used}
    Lof = {c: coreL[c] for c in used}

    src = [x["src"] for x in corpus]
    # ---- museum baselines: mean share per canonical color among each museum's paintings; archive-wide role rates ----
    mus_n = Counter(src)
    mus_sum = defaultdict(Counter)
    role_present = Counter()
    role_hit = {r: Counter() for r in ("foc", "glu", "acc", "hid")}
    for i in range(N):
        m = src[i]
        agg = Counter()
        for c, s in zip(names[i], shares[i]):
            agg[c] += s
        for c, s in agg.items():
            mus_sum[m][c] += s
        for c in agg:
            role_present[c] += 1
        ro = roles[i]
        for r in ("foc", "glu"):
            if ro[r] is not None:
                role_hit[r][ro[r]] += 1
        for r in ("acc", "hid"):
            for c in set(ro[r]):
                role_hit[r][c] += 1

    def mus_base(m, c):
        return mus_sum[m][c] / mus_n[m]

    def share_map(i):
        agg = Counter()
        for c, s in zip(names[i], shares[i]):
            agg[c] += s
        return agg

    def signature(idxs):
        """museum-baselined lift for one set of paintings. -> (signature list, avoided list)"""
        n = len(idxs)
        own = Counter(); sup = Counter(); exp = Counter()
        mus_mix = Counter(src[i] for i in idxs)
        for i in idxs:
            for c, s in share_map(i).items():
                own[c] += s
                sup[c] += 1
        for m, k in mus_mix.items():
            for c in list(own.keys()) + []:
                exp[c] += k * mus_base(m, c)
        # colors the set never uses still matter for "avoided": consider the set's museums' common colors
        common = Counter()
        for m, k in mus_mix.items():
            for c, v in mus_sum[m].most_common(40):
                common[c] += k * v / mus_n[m]
                if c not in exp:
                    exp[c] = 0
        for c in common:
            if exp[c] == 0:
                exp[c] = sum(k * mus_base(m, c) for m, k in mus_mix.items())
        sig, av = [], []
        for c in set(own) | set(common):
            o, e = own[c] / n, exp[c] / n
            if e <= 0:
                continue
            lift = o / e
            if lift >= 1.3 and o >= 0.02 and sup[c] >= MIN_SUP:
                sig.append([c, round(lift, 2), round(o, 3), sup[c]])
            elif lift <= 0.6 and e >= 0.02:
                av.append([c, round(lift, 2), round(o, 3), sup[c]])
        sig.sort(key=lambda t: -t[1]); av.sort(key=lambda t: t[1])
        return sig[:8], av[:6]

    def role_sig(idxs):
        """colors used far more often than the archive as the focal / accent / hidden / glue color."""
        out = {}
        present = Counter()
        hit = {r: Counter() for r in ("foc", "glu", "acc", "hid")}
        for i in idxs:
            for c in set(names[i]):
                present[c] += 1
            ro = roles[i]
            for r in ("foc", "glu"):
                if ro[r] is not None:
                    hit[r][ro[r]] += 1
            for r in ("acc", "hid"):
                for c in set(ro[r]):
                    hit[r][c] += 1
        for r in hit:
            rows = []
            for c, k in hit[r].items():
                if k < 4 or present[c] < 4:
                    continue
                p = k / present[c]
                q = role_hit[r][c] / role_present[c]
                if q <= 0 or role_present[c] < 30:
                    continue
                if p >= 2 * q and p >= 0.3:
                    rows.append([c, k, present[c], round(p, 2), round(q, 2)])
            rows.sort(key=lambda t: -(t[3] / max(t[4], .01)) * math.sqrt(t[1]))
            if rows:
                out[r] = rows[:4]
        return out

    def darks_lights(idxs):
        dk, lt = Counter(), Counter()
        for i in idxs:
            sh = share_map(i)
            big = [c for c, s in sh.items() if s >= 0.03]
            if len(big) < 3:
                continue
            dk[min(big, key=lambda c: Lof[c])] += 1
            lt[max(big, key=lambda c: Lof[c])] += 1
        n = sum(dk.values()) or 1
        return ([[c, k, round(k / n, 2)] for c, k in dk.most_common(3)], [[c, k, round(k / n, 2)] for c, k in lt.most_common(3)], n)

    idx_of = {x: i for i, x in enumerate(ids)}
    stats_out = {}
    artists = sorted((AD / "artists").glob("*.json"))
    for f in artists:
        a = json.loads(f.read_text())
        slug = a["slug"]
        idxs = [idx_of[b[0]] for b in a["barcode"] if b[0] in idx_of]
        # all of the painter's paintings (the barcode skips undated ones)
        allix = [i for i, x in enumerate(corpus) if x.get("a") == a["name"]]
        ct = float(np.mean([stat[i][0] for i in allix])) if allix else 0
        vv = float(np.mean([stat[i][1] for i in allix])) if allix else 0
        ef = float(np.mean([stat[i][2] for i in allix])) if allix else 0
        stats_out[slug] = [round(ct, 1), round(vv, 3), round(ef, 1)]
        p = dict(ix=idxs, n=len(allix))
        for key in ("typical", "atypical"):
            if a.get(key) in idx_of:
                p[key] = idx_of[a[key]]
        p["ctyp"] = [idx_of.get(c.get("typical"), -1) for c in a.get("clusters", [])]
        if len(allix) >= MIN_PAINTER:
            sg, av = signature(allix)
            p["sig"], p["av"] = sg, av
            p["roles"] = role_sig(allix)
            dk, lt, nn = darks_lights(allix)
            p["dk"], p["lt"], p["dn"] = dk, lt, nn
            # museums the work comes from (the baseline's mix)
            p["mus"] = Counter(src[i] for i in allix).most_common(4)
        (OUT / "p" / f"{slug}.json").write_text(json.dumps(p, separators=(",", ":")))
    (OUT / "stats.json").write_text(json.dumps(stats_out, separators=(",", ":")))

    # ---- groups ----
    arch_hh = np.mean([stat[i][3] for i in range(N)], axis=0)
    artist_of = defaultdict(list)
    slug_of = {}
    for f in artists:
        a = json.loads(f.read_text())
        slug_of[a["name"]] = a["slug"]
    mv = json.loads((AD / "groups.json").read_text())["byMovement"]

    def hue_profile(idxs):
        return [round(float(v), 3) for v in np.mean([stat[i][3] for i in idxs], axis=0)]

    def group_extra(idxs, with_time=True):
        n = len(idxs)
        g = dict(n=n, hh=hue_profile(idxs), L=round(float(np.mean([stat[i][4] for i in idxs])), 1),
                 wf=round(float(np.mean([stat[i][5] for i in idxs])), 3), vv=round(float(np.mean([stat[i][1] for i in idxs])), 3))
        cnt = Counter(corpus[i]["a"] for i in idxs if corpus[i].get("a") in slug_of)
        g["art"] = [[slug_of[a], k] for a, k in cnt.most_common(8) if k >= 3]
        sg, av = signature(idxs)
        g["sig"] = sg
        if with_time:
            by = defaultdict(list)
            for i in idxs:
                y = corpus[i].get("y")
                if y is not None:
                    by[(y // 10) * 10].append(i)
            tl = []
            for d, ii in sorted(by.items()):
                if len(ii) < 5:
                    continue
                acc = Counter()
                for i in ii:
                    for c, s in share_map(i).items():
                        acc[c] += s
                tl.append([d, len(ii), round(float(np.mean([stat[i][4] for i in ii])), 1), [c for c, _ in acc.most_common(3)]])
            g["time"] = tl
        return g

    dec_idx, co_idx, mv_idx = defaultdict(list), defaultdict(list), defaultdict(list)
    for i, x in enumerate(corpus):
        if x.get("y") is not None:
            dec_idx[(x["y"] // 10) * 10].append(i)
        if x.get("co"):
            co_idx[x["co"]].append(i)
    # movement membership is whatever analyze.py just used: re-derive it the same way
    wd = json.loads((OUT / "movements-wd.json").read_text()) if (OUT / "movements-wd.json").exists() else {"tier1": {}, "tier2": {}}
    for i, x in enumerate(corpus):
        m = x.get("mv") or wd["tier1"].get(x["id"]) or wd["tier2"].get(x["id"])
        if m:
            mv_idx[m].append(i)
    ge = dict(v=1, colors={str(c): v for c, v in ctab.items()}, archive=dict(hh=[round(float(v), 3) for v in arch_hh],
              L=round(float(np.mean([s[4] for s in stat])), 1)), byDecade={}, byCountry={}, byMovement={})
    for d, ii in dec_idx.items():
        if len(ii) >= 25:
            ge["byDecade"][str(d)] = group_extra(ii, with_time=False)
    for c, ii in co_idx.items():
        if len(ii) >= 25:
            ge["byCountry"][c] = group_extra(ii)
    for m, ii in mv_idx.items():
        if m in mv:
            ge["byMovement"][m] = group_extra(ii)
    (OUT / "groups-extra.json").write_text(json.dumps(ge, separators=(",", ":"), ensure_ascii=False))
    print("ids", N, "painters", len(artists), "groups", len(ge["byDecade"]), len(ge["byCountry"]), len(ge["byMovement"]))


if __name__ == "__main__":
    main()
