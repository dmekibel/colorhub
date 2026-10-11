"""Curated candidates for the taste trainer (js/tasteladder.js): beautiful colors and palettes, not area averages.
Source: data/games/oo/painter/*.json (each work's 12-color Diverse palette). A palette here is 5 colors from one
painting, picked vivid-first with a spread, at most one near-neutral, and kept only if it is lively and has light
and dark. Output: data/taste/pool.json {colors:[[hex, title, artist]], palettes:[[[5 hex], title, artist]]}.
Run: python3 tools/taste_pool.py"""
import json, glob, math

def lin(c): c /= 255; return c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4
def oklab(h):
    r, g, b = (lin(int(h[i:i + 2], 16)) for i in (1, 3, 5))
    l = (.4122214708 * r + .5363325363 * g + .0514459929 * b) ** (1 / 3)
    m = (.2119034982 * r + .6806995451 * g + .1073969566 * b) ** (1 / 3)
    s = (.0883024619 * r + .2817188376 * g + .6299787005 * b) ** (1 / 3)
    return (.2104542553 * l + .793617785 * m - .0040720468 * s, 1.9779984951 * l - 2.428592205 * m + .4505937099 * s, .0259040371 * l + .7827717662 * m - .808675766 * s)
def lch(h): L, a, b = oklab(h); return L, math.hypot(a, b), math.degrees(math.atan2(b, a)) % 360
def dist(a, b): return math.dist(oklab(a), oklab(b))
def muddy(h):   # dull browns/olives: warm, low chroma, mid-dark
    L, C, H = lch(h); return 40 <= H <= 110 and C < .09 and L < .62

pals = []
for f in glob.glob("data/games/oo/painter/*.json"):
    d = json.load(open(f))
    for w in d["works"]:
        gi, title, year, fam, typ, famous, cols = w[:7]
        artist = d["name"]
        hexes = [c[0] for c in cols]
        order = sorted(hexes, key=lambda h: -lch(h)[1])
        pick, neutrals = [], 0
        for h in order:
            L, C, H = lch(h)
            if muddy(h): continue
            if C < .04:
                if neutrals: continue
            if any(dist(h, p) < .09 for p in pick): continue
            if C < .04: neutrals += 1
            pick.append(h)
            if len(pick) == 5: break
        if len(pick) < 5: continue
        Ls = [lch(h)[0] for h in pick]; Cs = [lch(h)[1] for h in pick]
        if max(Ls) - min(Ls) < .35 or sorted(Cs)[2] < .08: continue
        hues = sorted(lch(h)[2] for h in pick if lch(h)[1] >= .06)
        score = sum(Cs) / 5 + .25 * (max(Ls) - min(Ls)) + (.03 if famous else 0) + .01 * min(len(set(int(x // 45) for x in hues)), 4)
        pals.append((score, sorted(pick, key=lambda h: lch(h)[0]), title, artist))

pals.sort(key=lambda p: -p[0])
keep, per = [], {}
for s, p, t, a in pals:
    if per.get(a, 0) >= 3: continue
    if any(sum(min(dist(x, y) for y in q[0]) for x in p) / 5 < .05 for q in keep): continue
    keep.append((p, t, a)); per[a] = per.get(a, 0) + 1
    if len(keep) >= 400: break

colors = []
for p, t, a in keep:
    for h in p:
        L, C, H = lch(h)
        if C < .08 or not .4 <= L <= .92 or any(dist(h, c[0]) < .035 for c in colors): continue
        colors.append((h, t, a))
json.dump({"colors": colors, "palettes": keep}, open("data/taste/pool.json", "w"), separators=(",", ":"))
print(len(pals), "candidate palettes ->", len(keep), "kept;", len(colors), "colors")
