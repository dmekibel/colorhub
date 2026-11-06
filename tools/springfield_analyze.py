#!/usr/bin/env python3
"""Research only (nothing ships). Compare our palette pick + order against the human @springfield.palettes strips parsed by
tools/springfield_parse.py. All data stays under research/_raw/springfield/ (copyrighted, gitignored). Prints numbers only.
usage: python3 tools/springfield_analyze.py <raw_dir>"""
import sys, json, os, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from scipy.stats import kendalltau
from PIL import Image
import corpus as C
import gallery as G

RAW = sys.argv[1] if len(sys.argv) > 1 else "research/_raw/springfield"


def lab(hexes): return C.rgb_to_lab(np.array([C.hex_to_rgb(h) for h in hexes], float))


def ok(hexes):
    r = np.array([C.hex_to_rgb(h) for h in hexes], float)
    return G._oklab_fwd(*[G._srgb_to_lin(r[:, i]) for i in range(3)])


def pool_pick(pool, k):                      # python port of js/gallery.js glPoolPick (deterministic, by area x vivid x distinct)
    o = ok([h for h, _ in pool]); sh = [s for _, s in pool]
    left = list(range(len(pool))); picked = []
    while len(picked) < k and left:
        def sc(i):
            near = min([np.linalg.norm(o[i] - o[j]) for j in picked], default=1.0)
            return sh[i] ** .6 * (.5 + 3 * np.hypot(o[i][1], o[i][2])) * min(1, near / .14) ** 1.5
        b = max(left, key=sc); picked.append(b); left.remove(b)
    return [pool[i] for i in picked]


def oklch(hexes):
    o = ok(hexes); return o[:, 0], np.hypot(o[:, 1], o[:, 2]), np.degrees(np.arctan2(o[:, 2], o[:, 1])) % 360


def adj(order, D): return sum(D[order[i], order[i + 1]] for i in range(len(order) - 1))


def sp_path(D):
    n = len(D)
    dp = {(1 << i, i): (0, None) for i in range(n)}
    for m in range(1, 1 << n):
        for j in range(n):
            if (m, j) not in dp: continue
            c = dp[(m, j)][0]
            for t in range(n):
                if m >> t & 1: continue
                k = (m | 1 << t, t); v = c + D[j, t]
                if k not in dp or v < dp[k][0]: dp[k] = (v, (m, j))
    full = (1 << n) - 1; j = min(range(n), key=lambda j: dp[(full, j)][0]); key = (full, j); out = []
    while key: out.append(key[1]); key = dp[key][1]
    return out[::-1]


def greedy(D, start):
    o = [start]; left = set(range(len(D))) - {start}
    while left: n = min(left, key=lambda j: D[o[-1], j]); o.append(n); left.remove(n)
    return o


def hue_order(h, rot): return sorted(range(len(h)), key=lambda i: (h[i] - rot) % 360)


def families(hexes, gap=35):
    """neutrals dark->light, then hue families in wheel order, each a light/dark ramp, direction alternating."""
    L, Ch, h = oklch(hexes); n = len(hexes)
    neu = [i for i in range(n) if Ch[i] < 0.04]; chrom = sorted([i for i in range(n) if i not in neu], key=lambda i: h[i]); fams = []
    for i in chrom:
        if fams and (h[i] - h[fams[-1][-1]]) < gap: fams[-1].append(i)
        else: fams.append([i])
    out = sorted(neu, key=lambda i: L[i]); d = 0
    for f in fams:
        out += sorted(f, key=lambda i: L[i], reverse=bool(d)); d ^= 1
    return out


def best_rot_hue(h, D):
    return min((hue_order(h, r) for r in range(0, 360, 5)), key=lambda o: adj(o, D))


def tau(o, n):
    pos = np.empty(n); pos[o] = np.arange(n); return kendalltau(pos, np.arange(n))[0]


def tau_dir(o, n): return max(tau(o, n), tau(o[::-1], n))


def main():
    P = json.load(open(f"{RAW}/posts.json"))
    R = dict(minde=[], cov=[], back=[]); miss = []
    ords = {k: dict(tau=[], adj=[]) for k in ["lightness", "hue_fixed", "hue_bestrot", "greedy_best", "ham_oklab", "families", "ham_L0.5", "ham_L2"]}
    feat = dict(h_L=[], o_L=[], h_C=[], o_C=[], h_nn=[], o_nn=[], lo=[], hi=[], rise=[], small=[])
    tmp = os.path.join(tempfile.mkdtemp(), "f.jpg")
    for p in P:
        hx = p["colors"]; n = len(hx)
        Image.open(f"{RAW}/frames/{p['shot'][:8]}.png").convert("RGB").save(tmp, quality=95)
        pool = G.extract_pool(tmp, 40)
        oh = [h for h, _ in pool_pick(pool, n)]
        Lh, Lo = lab(hx), lab(oh); D = C.de2000(Lh, Lo)
        R["minde"].append(D.min(1).mean()); R["cov"].append((D.min(1) < 10).mean()); R["back"].append(D.min(0).mean())
        Dp = C.de2000(Lh, lab([h for h, _ in pool]))
        for i in range(n):
            if D[i].min() >= 10: miss.append((Lh[i, 0], np.hypot(Lh[i, 1], Lh[i, 2]), Dp[i].min()))
        feat["h_L"].append(Lh[:, 0].mean()); feat["o_L"].append(Lo[:, 0].mean())
        feat["h_C"].append(np.hypot(Lh[:, 1], Lh[:, 2]).mean()); feat["o_C"].append(np.hypot(Lo[:, 1], Lo[:, 2]).mean())
        Dh = C.de2000(Lh, Lh); Do = C.de2000(Lo, Lo); np.fill_diagonal(Dh, 99); np.fill_diagonal(Do, 99)
        feat["h_nn"].append(Dh.min(1).mean()); feat["o_nn"].append(Do.min(1).mean())
        feat["lo"].append(Lh[:, 0].min()); feat["hi"].append(Lh[:, 0].max())
        Dk = np.linalg.norm(ok(hx)[:, None] - ok(hx)[None], axis=2)
        L, Ch, h = oklch(hx)
        cand = {"lightness": list(np.argsort(L)), "hue_fixed": hue_order(h, 0), "hue_bestrot": best_rot_hue(h, Dk),
                "greedy_best": min((greedy(Dk, s) for s in range(n)), key=lambda o: adj(o, Dk)),
                "ham_oklab": sp_path(Dk), "families": families(hx),
                "ham_L0.5": sp_path(np.linalg.norm((ok(hx)[:, None] - ok(hx)[None]) * [.5, 1, 1], axis=2)),
                "ham_L2": sp_path(np.linalg.norm((ok(hx)[:, None] - ok(hx)[None]) * [2, 1, 1], axis=2))}
        for k, o in cand.items():
            ords[k]["tau"].append(tau_dir(list(o), n)); ords[k]["adj"].append(adj(list(o), Dk) / adj(list(range(n)), Dk))
        d = [((h[i + 1] - h[i] + 180) % 360 - 180) for i in range(n - 1) if Ch[i] > .04 and Ch[i + 1] > .04]
        if d: feat["rise"].append(np.mean([x > 0 for x in d])); feat["small"].append(np.mean([abs(x) < 30 for x in d]))
    f = lambda a: round(float(np.nanmean(a)), 3)
    print("posts", len(P))
    print("human->ours mean min dE00", f(R["minde"]), " coverage(<10)", f(R["cov"]), " ours->human", f(R["back"]))
    print("mean L / C   human", f(feat["h_L"]), f(feat["h_C"]), "  ours", f(feat["o_L"]), f(feat["o_C"]))
    print("mean nearest-neighbour dE inside a palette: human", f(feat["h_nn"]), " ours", f(feat["o_nn"]))
    print("human strip L min / max (mean)", f(feat["lo"]), f(feat["hi"]))
    if miss:
        m = np.array(miss)
        print("missed human colors", len(m), "mean L", round(m[:, 0].mean(), 1), "mean C", round(m[:, 1].mean(), 1),
              "nearest in our 40-pool dE", round(m[:, 2].mean(), 1), "share already in pool (<10):", round((m[:, 2] < 10).mean(), 2))
    print("human adjacent hue step: frac rising", f(feat["rise"]), " frac |step|<30deg", f(feat["small"]))
    print("ORDER candidate: tau vs human (direction-free) | path length / human path length")
    for k, v in ords.items(): print(f"  {k:12s} {f(v['tau']):6.3f}  {f(v['adj']):6.3f}")


main()
