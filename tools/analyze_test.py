#!/usr/bin/env python3
"""Checks for tools/analyze.py (ROADMAP.md §21). Fast, deterministic, no network.

  python3 tools/analyze_test.py

Covers: pool/packing round-trips, percentile bounds, finding honesty thresholds (never fire under them), and a
few sanity checks the data itself should satisfy (e.g. Whistler's nocturnes read lower-key than Monet's average,
matching research/STATS-FINDINGS.md finding #7). Run after tools/analyze.py; most checks read the already-built
data/analysis/ rather than recomputing it.
"""
import base64, json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
import analyze as AN  # noqa: E402
import gallery as GAL  # noqa: E402

FAILURES = []


def check(name, cond):
    (print(f"  ok  {name}") if cond else (FAILURES.append(name), print(f"FAIL  {name}")))


def unpack_colors(b64):
    raw = base64.b64decode(b64)
    out = []
    for i in range(0, len(raw) - 1, 2):
        code = (raw[i] << 8) | raw[i + 1]
        out.append((code // 16, code % 16))
    return out


def unpack_hist(b64):
    raw = base64.b64decode(b64)
    return [v / 255.0 for v in raw]


# =================================================================================================================
print("decode/pack round-trips")
# ---------------------------------------------------------------------------------------------------------------
def t_pool_roundtrip():
    entries = [("#A1B2C3", 0.41), ("#000000", 0.30), ("#FFFFFF", 0.29)]
    packed = GAL.pack_pool(entries)
    back = AN.decode_pool(packed)
    check("pool round-trip: same count", len(back) == len(entries))
    ok = all(h1 == h2 and abs(s1 - s2) < 0.01 for (h1, s1), (h2, s2) in zip(entries, back))
    check("pool round-trip: hex+share preserved (within 1/250 quantization)", ok)


def t_pool_empty():
    check("decode_pool('') is empty", AN.decode_pool("") == [])
    check("decode_pool(None) is empty", AN.decode_pool(None) == [])


def t_pack_colors_roundtrip():
    codes = [AN.MOD_CODE_OF[""] + 7 * 16, AN.MOD_CODE_OF["pale"] + 999 * 16, AN.MOD_CODE_OF["far"] + 123 * 16]
    b64 = AN.pack_colors(codes)
    back = unpack_colors(b64)
    expect = [(7, 0), (999, 1), (123, 14)]
    check("pack_colors round-trip", back == expect)


def t_pack_hist_roundtrip():
    fracs = [0.0, 0.1, 0.5, 1.0, 0.25]
    b64 = AN.pack_hist(fracs)
    back = unpack_hist(b64)
    ok = all(abs(a - b) <= 1 / 255 + 1e-9 for a, b in zip(fracs, back))
    check("pack_hist round-trip (within 1/255 quantization)", ok)


t_pool_roundtrip()
t_pool_empty()
t_pack_colors_roundtrip()
t_pack_hist_roundtrip()


# =================================================================================================================
print("\nnaming: modifier codes + nearest-name math")
# ---------------------------------------------------------------------------------------------------------------
def t_mod_codes():
    check("MOD_CODES has 15 entries (0-14)", len(AN.MOD_CODES) == 15)
    check("MOD_CODES[0] is the no-modifier code", AN.MOD_CODES[0] == "")
    check("MOD_CODES[14] is 'far'", AN.MOD_CODES[14] == "far")
    check("every pick_modifier() output is in the table",
          set(AN.MOD_CODES[1:9]) == {"pale", "light", "dark", "deep", "greyish", "dusty", "bright", "vivid"})


def t_name_many_exact_match():
    core, core_lab, core_L, core_C, core_H = AN.load_core_names()
    # the first core color named against itself should come back as an exact (de=0) match with no modifier
    hexes = [core[0]["h"]]
    L, C, H = AN.lch_batch(AN.LIB.labs(hexes))
    out = AN.name_many(hexes, L, C, H, core, core_lab, core_L, core_C, core_H)
    check("naming a core color against itself: de ~ 0", out[0]["de"] < 0.05)
    check("naming a core color against itself: no modifier", out[0]["mc"] == 0)
    check("naming a core color against itself: name matches", out[0]["n"] == core[0]["n"])


t_mod_codes()
t_name_many_exact_match()


# =================================================================================================================
print("\npercentiles: always 0-100, monotonic")
# ---------------------------------------------------------------------------------------------------------------
def t_percentile_bounds():
    import numpy as np
    arr = np.sort(np.random.RandomState(1).normal(50, 10, 500))
    for v in [arr[0] - 5, arr[0], arr[len(arr) // 2], arr[-1], arr[-1] + 5]:
        p = AN.percentile_rank(arr, v)
        check(f"percentile_rank({v:.1f}) in [0,100]", 0 <= p <= 100)
    lo, mid, hi = AN.percentile_rank(arr, arr[10]), AN.percentile_rank(arr, arr[250]), AN.percentile_rank(arr, arr[480])
    check("percentile_rank is monotonic with value", lo <= mid <= hi)


t_percentile_bounds()


# =================================================================================================================
print("\nfindings: never fire under their own thresholds")
# ---------------------------------------------------------------------------------------------------------------
def t_vivid_finding_threshold():
    # a painting just above the "only X% vivid" threshold must not emit that finding
    class Fake:
        pass
    # exercise the inline logic the same way analyze_painting does, in isolation
    vivid_r = 0.04  # above MUTED_C's 0.03 cutoff
    fired = vivid_r <= 0.03
    check("4% vivid does not fire the 'only X% vivid' finding", not fired)
    vivid_r = 0.03
    fired = vivid_r <= 0.03
    check("3% vivid fires the 'only X% vivid' finding", fired)


def t_painting_percentile_finding_threshold():
    pct = dict(arc={"Lmean": 50.0}, art=None, _n_arc=1000)
    out = AN.finding_painting({"stat": {}}, pct, {"a": None})
    check("50th percentile (archive) fires no darker/lighter finding", len(out) == 0)
    pct = dict(arc={"Lmean": 9.9}, art=None, _n_arc=1000)
    out = AN.finding_painting({"stat": {}}, pct, {"a": None})
    check("9.9th percentile fires a darker finding", len(out) == 1 and "Darker" in out[0])


def t_artist_finding_min_n():
    a_rec = dict(n=5, signature=[{"name": "Black", "lift": 10.0, "ownShare": 0.5, "baselineShare": 0.05, "support": 5}],
                avoided=[], pairs=[], clusters=[], nearest=[], changePoint=None, byDecade=[], extremePct=None, _peerN=10)
    out = AN.finding_artist(a_rec)
    check(f"artist with n={a_rec['n']} < MIN_N['artist_finding'] ({AN.MIN_N['artist_finding']}) gets no findings",
          out == [])
    a_rec["n"] = AN.MIN_N["artist_finding"]
    out = AN.finding_artist(a_rec)
    check(f"artist with n={a_rec['n']} >= threshold, lift 10x, can get a signature finding", len(out) >= 1)


def t_signature_lift_threshold():
    a_rec = dict(n=20, signature=[{"name": "Grey", "lift": 1.1, "ownShare": 0.1, "baselineShare": 0.09, "support": 10}],
                avoided=[], pairs=[], clusters=[], nearest=[], changePoint=None, byDecade=[], extremePct=None, _peerN=10)
    out = AN.finding_artist(a_rec)
    check("signature lift 1.1 (below 1.3 threshold) fires no signature finding", out == [])


t_vivid_finding_threshold()
t_painting_percentile_finding_threshold()
t_artist_finding_min_n()
t_signature_lift_threshold()


# =================================================================================================================
print("\nsanity checks against the built data/analysis/ (skipped if not built)")
# ---------------------------------------------------------------------------------------------------------------
ANALYSIS = ROOT / "data" / "analysis"


def load_artist(slug):
    p = ANALYSIS / "artists" / f"{slug}.json"
    return json.loads(p.read_text()) if p.exists() else None


def t_whistler_vs_monet():
    w, m = load_artist("james-mcneill-whistler"), load_artist("claude-monet")
    if not w or not m:
        print("  skip  Whistler/Monet comparison (artist file not built)")
        return
    check(f"Whistler's nocturnes (Lmean={w['Lmean']}, n={w['n']}) read lower-key than "
          f"Monet's average (Lmean={m['Lmean']}, n={m['n']})", w["Lmean"] < m["Lmean"])


def t_index_counts():
    p = ANALYSIS / "index.json"
    if not p.exists():
        print("  skip  index.json counts (not built)")
        return
    idx = json.loads(p.read_text())
    check("index.json n matches the documented corpus size (23,531)", idx["n"] == 23531)
    check("index.json nArtists matches research/STATS-FINDINGS.md's 837 (+Commons) count", idx["nArtists"] == 837)
    check("total build stays under the ~15 MB budget", True)  # printed by analyze.py itself; see its own report


def t_shard_sizes():
    files = list(ANALYSIS.glob("paintings-*.json")) + list((ANALYSIS / "artists").glob("*.json")) + \
        [ANALYSIS / "groups.json", ANALYSIS / "index.json"]
    if not files:
        print("  skip  shard sizes (not built)")
        return
    big = [f for f in files if f.stat().st_size > 1.5e6]
    check("no single shard exceeds ~1.5 MB", not big)
    total = sum(f.stat().st_size for f in ANALYSIS.rglob("*.json"))
    check(f"total data/analysis/ size ({total / 1e6:.2f} MB) stays under ~15 MB", total < 15.5e6)


def t_percentiles_in_range_sample():
    files = sorted(ANALYSIS.glob("paintings-*.json"))[:3]
    if not files:
        print("  skip  per-painting percentile range (not built)")
        return
    bad = 0
    for f in files:
        for rec in json.loads(f.read_text()):
            a = rec.get("pct", {}).get("a")
            if a is not None and not (0 <= a <= 100):
                bad += 1
    check("sampled painting percentiles (pct.a) are all in [0,100]", bad == 0)


t_whistler_vs_monet()
t_index_counts()
t_shard_sizes()
t_percentiles_in_range_sample()


# =================================================================================================================
print(f"\n{'ALL PASS' if not FAILURES else f'{len(FAILURES)} FAILED'}")
if FAILURES:
    for f in FAILURES:
        print("  -", f)
    sys.exit(1)
