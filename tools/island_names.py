#!/usr/bin/env python3
"""Names, cover paintings and palettes for the painting map's "By vibe" ISLANDS (the Museum > Art > Subjects list, js/subjectisl.js).

  python3 tools/island_names.py            # writes data/gallery/island-names.json (about 30 KB)

Same islands as the map: membership is data/gallery/look-islands.bin (island id per painting, the map's default "keep" islands),
the tree is look.json -> islands[].par. Nothing is invented; every word comes from data:

  Name      "<adjective> <what it shows>, <era>": the 1-2 subject tags (data/gallery/subjects.json: Wikidata genre/depicts, title words,
            image model) most over-represented in the island against the whole archive; the century (or half) that holds most of its
            dated paintings; the nationality that holds a clear share. Names are unique: when two islands read alike, the facet that
            actually tells them apart is added (a place, a mood word measured from their colors, the painter who leads one).
            An island with no clear subject is named by what it mostly is ("Italian paintings, 1400s", "Dark paintings") -- never
            "Mixed".
  Detail    "France, Netherlands and Italy · 1650 to 1918 · Monet, Renoir, Van Gogh" (top places, the middle 80% of the dated years,
            painters who are a real part of it).
  Cover     three paintings nearest the island's middle on the map (that is where its most typical work sits), with a usable photo
            (a big copy exists, no frame crop), a sane shape, of the island's main subject when it has one, by different painters.
  Palette   eight distinct colors the island's paintings use most, light to dark (their six measured colors weighted by area).
  Family    islands that share a parent on the map (an archipelago) are listed together; `fam` names each such family.

Guards (tools/check_ids.js): `hash` = sha1 prefix of ids.txt (like look.bin), `isl` = sha1 prefix of look-islands.bin. Either differing
means the file is stale. Deterministic: no clocks, no randomness. Needs only numpy.
"""
import hashlib, json, re, sys
from collections import Counter
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
GAL = ROOT / "data" / "gallery"
OUT = GAL / "island-names.json"
TAG_OK = 94        # tags 0..93 are the genres and things (before the named saints and myths): the only ones used for names
PEOPLE = {"man": "men", "woman": "women", "child": "children", "couple": "couples", "family": "families", "soldier": "soldiers", "artist": "artists"}
PLURAL = {"portrait": "portraits", "self-portrait": "self-portraits", "group portrait": "group portraits", "landscape": "landscapes", "seascape": "seascapes",
          "cityscape": "cityscapes", "architecture": "architecture", "still life": "still lifes", "flowers": "flowers", "flower": "flowers", "religious": "religious scenes",
          "mythological": "myths", "history": "history scenes", "battle": "battles", "genre scene": "genre scenes", "interior": "interiors", "nude": "nudes",
          "animal": "animals", "allegory": "allegory", "vanitas": "vanitas", "hunting": "hunting scenes", "abstract": "abstract work", "orientalist": "orientalist scenes",
          "fantasy": "fantasy", "music & dance": "music and dance", "fish": "fish", "fruit": "fruit", "sky": "skies", "snow": "snow scenes", "night": "night scenes",
          "sun": "sun", "moon": "the moon", "sea": "seas", "dance": "dance", "sheep": "sheep", "deer": "deer", "crowd": "crowds", "bread": "bread", "cross": "crosses",
          "house": "houses", "city": "cities", "street": "streets", "river": "rivers", "boat": "boats", "ship": "ships", "horse": "horses", "bird": "birds",
          "church": "churches", "castle": "castles", "tree": "trees", "mountain": "mountains", "lake": "lakes", "book": "books", "vase": "vases", "window": "windows",
          "table": "tables", "dress": "dresses", "hat": "hats", "chair": "chairs", "statue": "statues", "ruins": "ruins", "garden": "gardens", "forest": "forests",
          "field": "fields", "bridge": "bridges", "harbor": "harbors", "beach": "beaches", "waterfall": "waterfalls", "cow": "cows", "dog": "dogs", "cat": "cats"}
GENRES = {"portrait", "self-portrait", "group portrait", "landscape", "seascape", "cityscape", "architecture", "still life", "flowers", "religious", "mythological",
          "history", "battle", "genre scene", "interior", "nude", "animal", "allegory", "vanitas", "hunting", "abstract", "orientalist", "fantasy", "music & dance"}
OF = {"portrait", "self-portrait", "group portrait", "nude"}      # "Portraits of men"
SAME = {}                                                          # tags that mean the same thing: one of them is enough
for g in (("seascape", "sea", "harbor", "beach", "ship", "boat", "lake", "river", "waterfall"), ("flowers", "flower", "vase", "garden"),
          ("landscape", "field", "tree", "forest", "mountain", "sky"), ("portrait", "self-portrait", "group portrait"),
          ("architecture", "cityscape", "church", "castle", "house", "village", "city", "street", "ruins", "bridge"), ("religious", "cross")):
    for t in g: SAME[t] = g[0]
ZS_MIN_Z = 2.5     # a picture-model phrase must score at least this (z over all islands) to rename an island
ZS_SMALL = 1000    # islands this small (the carved-out bumps) have too few tags to name them from: the picture-model phrase is used when it is clear
ADJ = {"Italy": "Italian", "France": "French", "Netherlands": "Dutch", "United States": "American", "Russia": "Russian", "Japan": "Japanese", "China": "Chinese",
       "India": "Indian", "Spain": "Spanish", "United Kingdom": "British", "Germany": "German", "Belgium": "Flemish", "Austria": "Austrian", "Sweden": "Swedish",
       "Denmark": "Danish", "Norway": "Norwegian", "Poland": "Polish", "Switzerland": "Swiss", "Brazil": "Brazilian", "Mexico": "Mexican", "Greece": "Greek",
       "Czechia": "Czech", "Finland": "Finnish", "Hungary": "Hungarian", "Portugal": "Portuguese", "Ireland": "Irish", "Canada": "Canadian", "Australia": "Australian"}


def ids_hash():
    return hashlib.sha1((GAL / "ids.txt").read_text().rstrip("\n").encode() + b"\n").hexdigest()[:8]   # the same hash look.bin's header carries


def slugify(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def srgb2lab(rgb):
    c = rgb / 255.0
    c = np.where(c > .04045, ((c + .055) / 1.055) ** 2.4, c / 12.92)
    x = (c[:, 0] * .4124 + c[:, 1] * .3576 + c[:, 2] * .1805) / .95047
    y = c[:, 0] * .2126 + c[:, 1] * .7152 + c[:, 2] * .0722
    z = (c[:, 0] * .0193 + c[:, 1] * .1192 + c[:, 2] * .9505) / 1.08883
    f = lambda t: np.where(t > .008856, np.cbrt(t), 7.787 * t + 16 / 116)
    fx, fy, fz = f(x), f(y), f(z)
    return np.stack([116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)], 1)


def load(sfx=""):
    lk = json.loads((GAL / f"look{sfx}.json").read_text())
    n = lk["n"]
    raw = (GAL / f"look-islands{sfx}.bin").read_bytes()
    hs = ids_hash()
    assert lk["hash"] == hs, f"look.json is for ids hash {lk['hash']}, ids.txt is {hs}: python3 tools/look_layout.py"
    assert raw[:4] == b"LISL" and np.frombuffer(raw, "<u4", 5)[2] == n and int(hs, 16) == np.frombuffer(raw, "<u4", 5)[4], "look-islands.bin does not match ids.txt: python3 tools/look_layout.py"
    K = len(lk["islands"])
    isl = np.frombuffer(raw, np.uint8, n, 20)
    lx = np.frombuffer(raw, np.uint8, n, 20 + n).astype(np.float64)
    ly = np.frombuffer(raw, np.uint8, n, 20 + 2 * n).astype(np.float64)
    rows = []
    for f in sorted((GAL / "d").glob("*.json"), key=lambda q: int(q.stem)):
        rows.extend(json.loads(f.read_text(encoding="utf-8")))
    assert len(rows) == n
    sj = json.loads((GAL / "subjects.json").read_text())
    assert len(sj["ia"]) == n
    head = json.loads((GAL / "index.json").read_text())
    rec = np.frombuffer((GAL / "index.bin").read_bytes(), np.uint8).reshape(n, head["rec"])
    return lk, n, K, isl, lx, ly, rows, sj, head, rec, hashlib.sha1(raw).hexdigest()[:8], hs


def tag_stats(isl, K, sj, n):
    T = len(sj["tags"])
    cnt = np.zeros((K, T), np.int64); glob = np.zeros(T, np.int64)
    for i in range(n):
        s = set(sj["ia"][i]) | set(sj["it"][i]) | {r[0] for r in sj["im"][i]}
        for t in s:
            if t < TAG_OK: cnt[isl[i], t] += 1; glob[t] += 1
    return cnt, glob


def plural(t):
    return PLURAL.get(t) or (t[:-1] + "ies" if t.endswith("y") and t[-2:-1] not in "aeiou" else t + ("es" if t.endswith(("s", "x", "ch", "sh")) else "s"))


def topic_of(cnt_row, size, glob, n, tags, strict=True):
    """The 1-2 tags that define a set of paintings, as a phrase ('Portraits of men'), plus the genre tag used (or None)."""
    g = glob / n; sh = cnt_row / max(size, 1)
    mins, minl = (0.06, 1.5) if strict else (0.04, 2.5)
    sc = []
    for t in range(len(cnt_row)):
        if glob[t] < 300: continue
        lift = sh[t] / max(g[t], 1e-9)
        if sh[t] >= mins and lift >= minl: sc.append((sh[t] * np.log(lift), t))
    sc.sort(reverse=True)
    picked = []
    for _, t in sc:
        nm = tags[t]
        if any(SAME.get(nm, nm) == SAME.get(p, p) for p in picked): continue
        picked.append(nm)
        if len(picked) == 2: break
    if not picked: return "", None, []
    gen = [p for p in picked if p in GENRES]; ppl = [p for p in picked if p in PEOPLE]; oth = [p for p in picked if p not in GENRES and p not in PEOPLE]
    if len(picked) == 1:
        p = picked[0]; ph = PEOPLE.get(p) or plural(p)
        return ph[0].upper() + ph[1:], p if p in GENRES else None, picked
    if gen and ppl:
        g1, p1 = gen[0], ppl[0]
        return f"{plural(g1)[0].upper() + plural(g1)[1:]} {'of' if g1 in OF else 'with'} {PEOPLE[p1]}", g1, picked
    a, b = picked
    pa = PEOPLE.get(a) or plural(a); pb = PEOPLE.get(b) or plural(b)
    return f"{pa[0].upper() + pa[1:]} and {pb}", (a if a in GENRES else b if b in GENRES else None), picked


def era_of(years):
    """The century (or half century) that holds most dated paintings, or '' when they are spread out."""
    y = years[years > -9000]
    if len(y) < 30: return ""
    for step, share in ((50, .6), (100, .55)):
        v, c = np.unique((y // step) * step, return_counts=True)
        j = c.argmax()
        if c[j] / len(y) >= share and 1000 <= v[j] <= 1990:
            s = int(v[j])
            if step == 100: return f"{s}s"
            return ("Early " if s % 100 == 0 else "Later ") + f"{s // 100 * 100}s"
    v, c = np.unique((y // 100) * 100, return_counts=True)
    o = np.argsort(-c)[:2]
    if len(o) == 2 and abs(int(v[o[0]]) - int(v[o[1]])) == 100 and (c[o[0]] + c[o[1]]) / len(y) >= .75 and 1000 <= min(v[o]) and max(v[o]) <= 1990:
        a, b = sorted(int(x) for x in v[o]); return f"{a}s to {b}s"
    return ""


def place_of(countries, gshare):
    """(nationality words when one or two places clearly dominate, [(country, share)] for the places that stand out against the archive)."""
    cs = [c for c in countries if c]
    if len(cs) < 30: return "", [], ""
    cc = Counter(cs); tot = len(cs); top = cc.most_common(6)
    adj = ""
    if top[0][1] / tot >= .38 and top[0][0] in ADJ and top[0][1] / tot >= 1.5 * gshare.get(top[0][0], 1): adj = ADJ[top[0][0]]
    elif len(top) > 1 and (top[0][1] + top[1][1]) / tot >= .6 and top[1][1] / tot >= .2 and top[0][0] in ADJ and top[1][0] in ADJ: adj = f"{ADJ[top[0][0]]} and {ADJ[top[1][0]]}"
    shown = [(c, k / tot) for c, k in top if k / tot >= .08 and k / tot >= 1.1 * gshare.get(c, 1)][:3]
    if not shown: shown = [(c, k / tot) for c, k in top[:2] if k / tot >= .12]
    adj2 = ADJ.get(top[0][0], "") if top[0][1] / tot >= .22 else ""   # a weaker nationality word, only used to tell look-alikes apart
    return adj, shown, adj2


def facet_stats(rec, isl, K):
    """Mean lightness, chroma and warmth per island, as z-scores across islands (for the mood word)."""
    L = rec[:, 4].astype(np.float64) / 2.5; C = rec[:, 5].astype(np.float64) / 3
    # warmth: share-weighted a* of the six colors (red-ward positive)
    off = 6
    rgb = rec[:, off:off + 24].reshape(-1, 6, 4)
    sh = rgb[:, :, 3].astype(np.float64) / 250.0
    lab = srgb2lab(rgb[:, :, :3].reshape(-1, 3).astype(np.float64)).reshape(-1, 6, 3)
    w = sh / np.maximum(sh.sum(1, keepdims=True), 1e-9)
    warm = (w * (lab[:, :, 1] * .6 + lab[:, :, 2] * .8)).sum(1)   # reds and yellows up, blues and greens down
    out = np.zeros((K, 3))
    for k in range(K):
        m = isl == k; out[k] = [L[m].mean(), C[m].mean(), warm[m].mean()]
    z = (out - out.mean(0)) / np.maximum(out.std(0), 1e-9)
    return out, z


def mood_of(z):
    """Up to two words from different axes (lightness, chroma, warmth), strongest first, only where this island is clearly unlike the others."""
    cand = [(abs(z[0]), "Dark" if z[0] < 0 else "Light"), (abs(z[1]), "Muted" if z[1] < 0 else "Vivid"), (abs(z[2]), "Cool" if z[2] < 0 else "Warm")]
    cand.sort(reverse=True)
    return [w for v, w in cand if v >= .7][:2]


def palette_of(rec_m, k=8):
    rgb = rec_m[:, 6:30].reshape(-1, 6, 4).reshape(-1, 4)
    w = rgb[:, 3].astype(np.float64) / 250.0
    col = rgb[:, :3].astype(np.float64)
    lab = srgb2lab(col)
    key = (np.floor(lab[:, 0] / 8).astype(np.int64) * 10000 + np.floor((lab[:, 1] + 100) / 10).astype(np.int64) * 100 + np.floor((lab[:, 2] + 100) / 10).astype(np.int64))
    order = np.argsort(key, kind="stable"); ks, ws = key[order], w[order]
    u, st = np.unique(ks, return_index=True)
    sums = np.add.reduceat(ws, st)
    pick = []
    for b in np.argsort(-sums, kind="stable")[:60]:
        idx = order[st[b]: (st[b + 1] if b + 1 < len(st) else len(order))]
        ww = w[idx]; lm = (lab[idx] * ww[:, None]).sum(0) / max(ww.sum(), 1e-9)
        if all(np.sqrt(((lm - p[0]) ** 2).sum()) >= 14 for p in pick):
            rg = (col[idx] * ww[:, None]).sum(0) / max(ww.sum(), 1e-9)
            pick.append((lm, rg, sums[b]))
        if len(pick) == k: break
    pick.sort(key=lambda p: -p[0][0])
    return ["#%02X%02X%02X" % tuple(int(round(v)) for v in p[1]) for p in pick]


def load_embeds(rows, n):
    """CLIP vectors (cached by tools/subjects_clip.py) as an (n, 512) float16 array in gallery order; zero rows where there is none. None if the cache is missing."""
    import os
    for raw in (os.environ.get("SUBJECTS_RAW"), ROOT / "research" / "_raw", ROOT.parent.parent.parent / "research" / "_raw"):
        if not raw: continue
        d = Path(raw) / "subjects"
        if (d / "clip-embeds.npy").exists():
            ids = (d / "clip-embeds.ids.txt").read_text().splitlines(); E = np.load(d / "clip-embeds.npy", mmap_mode="r")
            pos = {r[0]: i for i, r in enumerate(rows)}
            out = np.zeros((n, 512), np.float16)
            for j, x in enumerate(ids):
                i = pos.get(x)
                if i is not None: out[i] = E[j]
            return out
    return None


def main(sfx=""):
    """sfx "" = the default islands: writes island-names.json and the map labels. sfx "-c30" / "-c60" (Color influence variants): only the map labels in look<sfx>.json."""
    lk, n, K, isl, lx, ly, rows, sj, head, rec, ihash, hs = load(sfx)
    tags = sj["tags"]; I = lk["islands"]
    cnt, glob = tag_stats(isl, K, sj, n)
    idx0 = rec[:, 0].astype(np.int64) | rec[:, 1].astype(np.int64) << 8
    year = np.where(idx0 > 0, idx0 - head["year0"], -99999)
    L2, Z = facet_stats(rec, isl, K)
    size = np.bincount(isl, minlength=K)
    junk = lambda a: bool(a) and (":" in a or "(" in a or a.lower() in ("okänd", "unknown", "anonymous", "unknown artist", "ukjent"))
    pcount = Counter(r[2] for r in rows if r[2] and not junk(r[2]))
    cg = Counter(r[3] for r in rows if r[3]); gshare = {c: v / sum(cg.values()) for c, v in cg.items()}
    info = []
    for k in range(K):
        m = np.where(isl == k)[0]
        topic, gen, picked = topic_of(cnt[k], size[k], glob, n, tags)
        if not topic: topic, gen, picked = topic_of(cnt[k], size[k], glob, n, tags, strict=False)
        zs = I[k].get("zs")   # the picture model's best phrases for this island (tools/look_vocab.py), when look_layout wrote them
        if zs:
            lab, kind, z = zs[0][0], zs[0][1], zs[0][2]
            if z >= ZS_MIN_Z and (not topic or size[k] < ZS_SMALL):
                topic, gen = lab, None   # the tags are silent, or the island is too small for tag counts to mean much: name it by what the pictures show
        ad, places, ad2 = place_of([rows[i][3] for i in m], gshare)
        pa = [(nm, c) for nm, c in Counter(rows[i][2] for i in m if rows[i][2] and not junk(rows[i][2])).most_common(40) if c >= 40 and c >= .3 * pcount[nm]][:6]   # painters who are really HERE: at least 30% of their work
        mv = Counter(rows[i][4] for i in m if rows[i][4]).most_common(1)
        yk = year[m]; yk = yk[yk > -9000]
        info.append(dict(k=k, m=m, topic=topic, gen=gen, era=era_of(year[m]), adj=ad, adj2=ad2, places=places, mood=mood_of(Z[k]), painters=pa,
                         move=mv[0] if mv else None, yr=(np.percentile(yk, [10, 90]) if len(yk) > 30 else None)))

    def compose(d, use):
        t = d["topic"]
        if t in ("Men", "Women", "Children"): t = "Paintings of " + t.lower()   # a bare "Women" reads like a category label, not a kind of painting
        pre = []
        if "mood" in use and d["mood"]: pre.append(d["mood"][0])
        if "mood2" in use and len(d["mood"]) > 1: pre.append(d["mood"][1])
        if "adj" in use and d["adj"]: pre.append(d["adj"])
        elif "adj2" in use and d["adj2"]: pre.append(d["adj2"])
        if not t: t = "paintings" if pre else "Paintings"
        if pre:
            words = [pre[0]] + [w if (w in ADJ.values() or " and " in w) else w.lower() for w in pre[1:]]
            t = t[0].lower() + t[1:] if not t.startswith(("Paintings", "paintings")) else t.lower()
            s = " ".join(words + [t])
        else: s = t
        s = s[0].upper() + s[1:]
        if "era" in use and d["era"]: s += ", " + d["era"]
        if "painter" in use and d["painters"]: s += f", with {d['painters'][0][0]}"
        return s

    # names: start with topic + era; add the facets that tell colliding islands apart until every name is unique
    use = {d["k"]: ["era"] for d in info}
    order = ["adj", "mood", "mood2", "adj2", "painter"]
    for _ in range(6):
        names = {d["k"]: compose(d, use[d["k"]]) for d in info}
        groups = {}
        for k, nm in names.items(): groups.setdefault(nm, []).append(k)
        dup = [g for g in groups.values() if len(g) > 1]
        if not dup: break
        for g in dup:
            for facet in order:
                vals = {kk: compose(info[kk], use[kk] + [facet]) for kk in g}
                if len(set(vals.values())) > 1:
                    for kk in g:
                        if facet not in use[kk] and vals[kk] != names[kk]: use[kk].append(facet)
                    break
    names = {d["k"]: compose(d, use[d["k"]]) for d in info}
    seen = {}
    for d in info:   # last resort, only if still identical
        nm = names[d["k"]]
        if nm in seen: names[d["k"]] = nm + " II"
        seen[nm] = d["k"]

    if sfx:   # a variant has no Subjects list of its own: the map labels are all it needs
        for k in range(K): I[k]["lab"] = names[k]
        (GAL / f"look{sfx}.json").write_text(json.dumps(lk, indent=1) + "\n", encoding="utf-8")
        print(f"look{sfx}.json: {K} island labels")
        return

    # families on the map (islands sharing a parent): a name from the union of their paintings
    fam_members = {}
    for k in range(K): fam_members.setdefault(I[k]["par"], []).append(k)
    fam = {}
    for p, ks in fam_members.items():
        if len(ks) < 2: continue
        m = np.isin(isl, ks); c = np.zeros(len(tags), np.int64); c[:] = cnt[ks].sum(0)
        t, _, _ = topic_of(c, int(m.sum()), glob, n, tags)
        t = t or "Paintings"
        if t in fam.values() or t in names.values(): t = names[p]   # a family never shares a name with another family or an island: the parent island's own name
        fam[str(p)] = t

    emb = load_embeds(rows, n)
    out = []
    for d in info:
        k, m = d["k"], d["m"]
        # detail line
        parts = []
        pl = [c for c, s in d["places"] if s >= .08][:3]
        if len(pl) >= 2: parts.append(", ".join(pl[:-1]) + " and " + pl[-1])
        elif pl: parts.append(pl[0])
        if d["yr"] is not None:
            yr = lambda v: f"{-v} BC" if v < 0 else str(v)
            a, b = int(round(d["yr"][0] / 10) * 10), int(round(d["yr"][1] / 10) * 10)
            parts.append(f"{yr(a)} to {yr(b)}" if b > a else yr(a))
        pp = [nm for nm, c in d["painters"]][:3]
        if pp: parts.append(", ".join(pp))
        sub = " · ".join(parts)
        # covers: nearest the island's middle, with a usable photo
        mx, my = I[k]["mx"], I[k]["my"]
        dist = np.hypot(lx[m] - mx, ly[m] - my)
        near = m[np.argsort(dist, kind="stable")[:700]]
        if emb is not None:   # most TYPICAL by picture: nearest the island's CLIP centroid (the subject tags are too noisy to pick a cover with)
            have = m[emb[m, 0] != 0]
            if len(have) > 50:
                cen = emb[have].astype(np.float32).mean(0); cen /= np.linalg.norm(cen) + 1e-9
                sc = emb[have].astype(np.float32) @ cen
                near = have[np.argsort(-sc, kind="stable")[:400]]
        want = d["gen"]; tix = tags.index(want) if want in tags else -1
        picked, used_artists = [], set()
        def ok(i, lo, hi):
            r = rows[i]; asp = np.exp(rec[i, 3] / 255 * 3.2 - 1.6)
            return not (len(r) > 11 and r[11]) and (r[9] or not str(r[5]).startswith("img/gallery/")) and lo <= asp <= hi and year[i] > -9000 and r[2] and r[2] not in used_artists
        for slot, (lo, hi) in enumerate(((.62, 1.15), (.6, 1.6), (.6, 1.6))):
            best = None
            for pass_ in (0, 1):
                for i in near:
                    if i in [p[0] for p in picked] or not ok(i, lo, hi): continue
                    has = tix >= 0 and (tix in sj["it"][i] or any(r[0] == tix and r[1] >= 85 for r in sj["im"][i]))   # the title or the image model; the authority list has wrong entries for some Commons uploads
                    if pass_ == 0 and tix >= 0 and not has: continue
                    if any(np.hypot(lx[i] - lx[p[0]], ly[i] - ly[p[0]]) < 6 for p in picked): continue
                    best = i; break
                if best is not None: break
            if best is None: continue
            picked.append((int(best),)); used_artists.add(rows[best][2])
        if len(picked) < 3:   # small or anonymous islands (manuscript pages have no painter): relax the painter/year/aspect rules, keep the photo rule
            for i in near:
                if len(picked) >= 3: break
                r = rows[i]
                if i in [p[0] for p in picked] or (len(r) > 11 and r[11]) or not (r[9] or not str(r[5]).startswith("img/gallery/")): continue
                if any(np.hypot(lx[i] - lx[p[0]], ly[i] - ly[p[0]]) < 6 for p in picked): continue
                picked.append((int(i),))
        cov = []
        for (i,) in picked:
            r = rows[i]; cov.append([i, r[0], r[9] or r[5], round(float(np.exp(rec[i, 3] / 255 * 3.2 - 1.6)), 3), r[1][:80]])
        out.append(dict(k=k, slug=slugify(names[k]), name=names[k], sub=sub, n=int(size[k]), par=int(I[k]["par"]), c=[I[k]["mx"], I[k]["my"]], cov=cov, pal=palette_of(rec[m])))
    slugs = Counter(o["slug"] for o in out)
    assert max(slugs.values()) == 1, [s for s, c in slugs.items() if c > 1]
    data = dict(v=1, n=n, hash=hs, isl=ihash, method="Tools/island_names.py: names from subject-tag lift, dominant century and nationality, then the facet that tells look-alike islands apart; covers nearest each island's middle; palettes pooled from the paintings' six measured colors.",
                islands=out, fam=fam)
    OUT.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    # the map's island labels (look.json islands[].lab) are these same names, so the map and the Subjects list agree
    for o in out: I[o["k"]]["lab"] = o["name"]
    (GAL / "look.json").write_text(json.dumps(lk, indent=1) + "\n", encoding="utf-8")
    print(f"island-names.json: {len(out)} islands, {len(fam)} families, {OUT.stat().st_size / 1e3:.0f} KB")
    for o in out: print(f"  {o['k']:2d} {o['n']:5d} par {o['par']:2d}  {o['name']}   [{o['sub']}]")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "")
