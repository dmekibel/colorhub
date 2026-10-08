"""Compact facet indexes for browsing the 23,531-painting gallery (lane L16, Explore 2.0: js/browse.js).

Reads what's already built and shipped (nothing from research/_raw):
  data/gallery/index.json + index.bin   year, museum, six colors per painting (tools/gallery.py)
  data/gallery/d/NNN.json                title, artist, country, movement, 24-color pool (base64)
  data/analysis/paintings-NNN.json       per-painting stats: value key, mean chroma, warm share, contrast,
                                         effective color count, nearest cross-century painting (tools/analyze.py)
  data/analysis/artists/<slug>.json      the 837 painters with a page (6+ works)
  data/core-names.json                   the ~1,000 core names (for "The Unpainted")

Writes data/facets/:
  facets.bin   9 bytes a painting, positional with data/gallery (same order):
                 0-1  artist index (uint16 little-endian; 0 = unknown, else 1 + index into artists[])
                 2    country index (0 = unknown, else 1 + index into countries[])
                 3    movement index (0 = none, else 1 + index into movements[])
                 4    value key (0 dark, 1 mid, 2 light: analyze.py's stat.key low/mid/high)
                 5    mean chroma C* (0-100, clipped to 255)
                 6    warm share (permille / 4, 0-250)
                 7    contrast range (L* p95 - p5, 0-100)
                 8    effective color count x 10 (3.1 colors -> 31)
  facets.json  the lookup lists (artists with slug, n and whether they have a painter page; countries;
               movements), the archive-relative cut points the mood chips use, the curated "Twins across time"
               pairs and "The Unpainted" (core names no painting comes close to).

Deterministic. Run after tools/gallery.py or tools/analyze.py change:  python3 tools/facets.py
"""
import base64, json, struct, sys, unicodedata, re
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import library as LIB  # noqa: E402
from graph_color import de2000_pairs  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
GAL = ROOT / "data" / "gallery"
ANA = ROOT / "data" / "analysis"
OUT = ROOT / "data" / "facets"
REC = 9


def slug(s):   # the same rule as tools/analyze.py's slug(), so painter pages and this index agree
    s = unicodedata.normalize("NFKD", str(s))
    s = "".join(ch for ch in s if not unicodedata.combining(ch)).lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-") or "unknown"


def load():
    head = json.loads((GAL / "index.json").read_text())
    n, rec, shard = head["n"], head["rec"], head["shard"]
    b = (GAL / "index.bin").read_bytes()
    year = np.zeros(n, np.int32)
    rgb = np.zeros((n, 6, 3), np.uint8)
    sh = np.zeros((n, 6), np.float64)
    for i in range(n):
        o = i * rec
        y = b[o] | b[o + 1] << 8
        year[i] = y - head["year0"] if y else -32768
        for j in range(6):
            p = o + 6 + j * 4
            rgb[i, j] = (b[p], b[p + 1], b[p + 2])
            sh[i, j] = b[p + 3] / 250
    rows, ana = [], []
    for k in range((n + shard - 1) // shard):
        rows += json.loads((GAL / "d" / f"{k:03d}.json").read_text())
        ana += json.loads((ANA / f"paintings-{k:03d}.json").read_text())
    assert len(rows) == n == len(ana), (len(rows), n, len(ana))
    for r, a in zip(rows, ana):
        assert r[0] == a["id"], (r[0], a["id"])
    return head, year, rgb, sh, rows, ana


def to_lab(rgb_flat):
    return LIB.rgb_to_lab(np.asarray(rgb_flat, np.float64))


def matched(labA, shA, labB, shB):
    """Two-way area-weighted nearest-color distance between two 6-color palettes (js/gallery.js glSimilar)."""
    d = LIB.de2000(labA, labB)
    return (float((d.min(1) * shA).sum()) + float((d.min(0) * shB).sum())) / 2


def main():
    head, year, rgb, sh, rows, ana = load()
    n = head["n"]
    pal_lab = to_lab(rgb.reshape(-1, 3)).reshape(n, 6, 3)

    # ---- lookup lists ----
    with_page = {}
    for f in sorted((ANA / "artists").glob("*.json")):
        a = json.loads(f.read_text())
        with_page[a["name"]] = a["slug"]
    count = {}
    for r in rows:
        if r[2]:
            count[r[2]] = count.get(r[2], 0) + 1
    artists = sorted(count, key=lambda s: (slug(s), s))
    a_ix = {a: i + 1 for i, a in enumerate(artists)}
    countries = sorted({r[3] for r in rows if r[3]})
    c_ix = {c: i + 1 for i, c in enumerate(countries)}
    movements = sorted({r[4] for r in rows if r[4]})
    m_ix = {m: i + 1 for i, m in enumerate(movements)}
    KEY = {"low": 0, "mid": 1, "high": 2}

    buf = bytearray(n * REC)
    Cm, wf, ct, ef = (np.zeros(n) for _ in range(4))
    for i, (r, a) in enumerate(zip(rows, ana)):
        s = a["stat"]
        Cm[i], wf[i], ct[i], ef[i] = s["Cm"], s["wf"], s["ct"], s["ef"]
        struct.pack_into("<HBBBBBBB", buf, i * REC, a_ix.get(r[2], 0), c_ix.get(r[3], 0), m_ix.get(r[4], 0),
                         KEY[s["key"]], min(255, int(round(s["Cm"]))), min(250, int(round(s["wf"] / 4))),
                         min(255, int(round(s["ct"]))), min(255, int(round(s["ef"]))))

    # archive-relative cut points (thirds) for the mood chips; the client compares the same stored bytes
    def thirds(v, scale=1):
        lo, hi = np.percentile(v, [100 / 3, 200 / 3])
        return [int(round(lo / scale)), int(round(hi / scale))]
    cuts = {"Cm": thirds(Cm), "wf": thirds(wf, 4), "ct": thirds(ct), "ef": thirds(ef)}

    # ---- Twins across time (design/IDEAS-10X/explore-art.md §6A): nn pairs, both colorful and not low-key,
    # confirmed by the same two-way palette distance glSimilar() uses; the closest 150 ----
    by_id = {r[0]: i for i, r in enumerate(rows)}
    seen, twins = set(), []
    for i, a in enumerate(ana):
        nn = a.get("nn")
        if not nn or nn["id"] not in by_id:
            continue
        j = by_id[nn["id"]]
        key = (min(i, j), max(i, j))
        if key in seen:
            continue
        seen.add(key)
        si, sj = a["stat"], ana[j]["stat"]
        if si["Cm"] < 22 or sj["Cm"] < 22 or si["key"] == "low" or sj["key"] == "low":
            continue
        if year[i] == -32768 or year[j] == -32768 or abs(int(year[i]) - int(year[j])) < 100:
            continue
        d = matched(pal_lab[i], sh[i], pal_lab[j], sh[j])
        if d < 6:
            a0, b0 = (i, j) if year[i] <= year[j] else (j, i)
            twins.append([int(a0), int(b0), round(d, 2)])
    twins.sort(key=lambda t: (t[2], t[0]))
    twins = twins[:150]

    # ---- The Unpainted: core names whose nearest color in any painting's 24-color pool is far ----
    pool = []
    for r in rows:
        if not r[10]:
            continue
        raw = base64.b64decode(r[10])
        pool += [(raw[k], raw[k + 1], raw[k + 2]) for k in range(0, len(raw) - 3, 4)]
    pool_rgb = np.unique(np.array(pool + [tuple(x) for x in rgb.reshape(-1, 3)], np.uint8), axis=0)
    pool_lab = to_lab(pool_rgb)
    core = json.loads((ROOT / "data" / "core-names.json").read_text())
    core_lab = LIB.labs([c["h"] for c in core])
    unpainted = []
    for c, L in zip(core, core_lab):
        d76 = np.sqrt(((pool_lab - L) ** 2).sum(1))
        cand = np.argsort(d76)[:400]
        d = de2000_pairs(np.repeat(L[None, :], len(cand), 0), pool_lab[cand])
        m = float(d.min())
        if m >= 8:   # js/naming.js NEAR_DE: nothing in the archive is even "close"
            unpainted.append([c["n"], c["h"], round(m, 1)])
    unpainted.sort(key=lambda u: -u[2])

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "facets.bin").write_bytes(bytes(buf))
    meta = {
        "v": 1, "built": head.get("built"), "n": n, "rec": REC,
        "method": "Built by tools/facets.py from data/gallery and data/analysis. Mood cuts are thirds of this archive "
                  "(as photographed), so 'warmer' means warmer than most paintings here, not warm in absolute terms.",
        "artists": [[a, with_page.get(a) or slug(a), count[a], 1 if a in with_page else 0] for a in artists],
        "countries": countries, "movements": movements, "cuts": cuts,
        "twins": twins, "unpainted": unpainted,
        "poolColors": int(len(pool_rgb)),
    }
    (OUT / "facets.json").write_text(json.dumps(meta, ensure_ascii=False, separators=(",", ":")))
    print(f"{n} paintings, {len(artists)} artists ({len(with_page)} with pages), {len(countries)} countries, "
          f"{len(movements)} movements; cuts {cuts}; {len(twins)} twins; {len(unpainted)} unpainted of {len(core)} "
          f"core names (over {len(pool_rgb)} distinct pool colors); facets.bin {len(buf)} B, "
          f"facets.json {(OUT / 'facets.json').stat().st_size} B")


if __name__ == "__main__":
    main()
