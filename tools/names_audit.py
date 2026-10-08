#!/usr/bin/env python3
"""Audit data/core-names.json: names whose hex contradicts their words, and 'also' lists that mix clearly
different colors. Read-only report:  python3 tools/names_audit.py"""
import json, re, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
import library as LIB  # noqa: E402


def hue_in(H, lo, hi):
    H %= 360
    return lo <= H <= hi if lo <= hi else (H >= lo or H <= hi)


# word -> predicate(L, C, H); deliberately generous: only clear contradictions get flagged
RULES = {
    "red": lambda L, C, H: C >= 18 and hue_in(H, 335, 58),
    "green": lambda L, C, H: C >= 6 and hue_in(H, 88, 200),
    "blue": lambda L, C, H: C >= 8 and hue_in(H, 195, 312),
    "yellow": lambda L, C, H: C >= 18 and hue_in(H, 72, 118),
    "orange": lambda L, C, H: C >= 25 and hue_in(H, 38, 88),
    "pink": lambda L, C, H: C >= 8 and hue_in(H, 320, 38) and L >= 45,
    "purple": lambda L, C, H: C >= 8 and hue_in(H, 275, 350),
    "violet": lambda L, C, H: C >= 8 and hue_in(H, 262, 350),
    "brown": lambda L, C, H: 5 <= C <= 60 and hue_in(H, 15, 105) and L <= 68,
    "grey": lambda L, C, H: C <= 16,
    "gray": lambda L, C, H: C <= 16,
    "teal": lambda L, C, H: C >= 6 and hue_in(H, 150, 235),
    "cyan": lambda L, C, H: C >= 10 and hue_in(H, 170, 250),
    "turquoise": lambda L, C, H: C >= 10 and hue_in(H, 150, 250),
    # specific words whose color is not in doubt
    "seafoam": lambda L, C, H: C >= 8 and hue_in(H, 115, 205),
    "mint": lambda L, C, H: C >= 8 and hue_in(H, 115, 205) and L >= 60,
    "emerald": lambda L, C, H: C >= 20 and hue_in(H, 115, 200),
    "lime": lambda L, C, H: C >= 25 and hue_in(H, 100, 150),
    "lemon": lambda L, C, H: C >= 18 and hue_in(H, 85, 112) and L >= 70,
    "navy": lambda L, C, H: L <= 40 and hue_in(H, 235, 310),
    "sky": lambda L, C, H: C >= 8 and hue_in(H, 200, 270) and L >= 55,
    "cobalt": lambda L, C, H: C >= 25 and hue_in(H, 235, 300),
    "ultramarine": lambda L, C, H: C >= 25 and hue_in(H, 255, 310),
    "crimson": lambda L, C, H: C >= 35 and hue_in(H, 5, 40),
    "scarlet": lambda L, C, H: C >= 40 and hue_in(H, 15, 55),
    "lavender": lambda L, C, H: C >= 4 and hue_in(H, 255, 340) and L >= 55,
    "lilac": lambda L, C, H: C >= 4 and hue_in(H, 255, 345) and L >= 55,
    "magenta": lambda L, C, H: C >= 35 and hue_in(H, 315, 360),
    "ivory": lambda L, C, H: L >= 85 and C <= 20,
    "cream": lambda L, C, H: L >= 80 and C <= 35,
    "charcoal": lambda L, C, H: L <= 35 and C <= 15,
    "peach": lambda L, C, H: C >= 15 and hue_in(H, 35, 85) and L >= 65,
    "coral": lambda L, C, H: C >= 30 and hue_in(H, 15, 60),
}


def toks(n):
    return [t for t in re.split(r"[^a-z]+", n.lower()) if t]


def lchs(h):
    return LIB.lch(LIB.labs([h])[0])


def audit():
    """Returns (contradictions, mixed). contradictions: [(name, hex, L, C, H, word)]."""
    core = json.loads((ROOT / "data" / "core-names.json").read_text())
    lib = {LIB.key(e["n"]): e for e in LIB.load_library()}
    bad = []
    for e in core:
        L, C, H = lchs(e["h"])
        for t in toks(e["n"]):
            r = RULES.get(t)
            if r and not r(L, C, H):
                others = [RULES[o] for o in toks(e["n"]) if o in RULES and o != t]
                if others and any(o(L, C, H) for o in others):
                    continue
                bad.append((e["n"], e["h"], round(L), round(C), round(H), t))
                break
    # alias words that contradict the primary's own hex ("Dark red" under a near-black)
    alias_bad = []
    for e in core:
        L, C, H = lchs(e["h"])
        for a in e.get("also", []):
            for t in toks(a):
                r = RULES.get(t)
                if r and not r(L, C, H) and not any(RULES[o](L, C, H) for o in toks(a) if o in RULES and o != t):
                    alias_bad.append((e["n"], e["h"], a, t))
                    break
    mixed = []
    labs = {e["h"]: LIB.labs([e["h"]])[0] for e in core}
    for e in core:
        for a in e.get("also", []):
            le = lib.get(LIB.key(a))
            if not le:
                continue
            d = float(LIB.de2000(labs[e["h"]][None], LIB.labs([le["h"]]))[0][0])
            if d > 12:
                mixed.append((round(d, 1), e["n"], e["h"], a, le["h"]))
    mixed.sort(reverse=True)
    return bad, mixed, alias_bad


if __name__ == "__main__":
    bad, mixed, alias_bad = audit()
    print(f"== primary name contradicts its hex: {len(bad)}")
    for b in bad:
        print("  %-28s %s L%d C%d H%d  (word: %s)" % b)
    print(f"== alias words that contradict the primary's hex: {len(alias_bad)}")
    for a in alias_bad:
        print("  %-26s %s  also %-30s (word: %s)" % a)
    print(f"== 'also' synonyms with a library hex >12 dE away: {len(mixed)}")
    for m in mixed[:80]:
        print("  dE%5.1f %-26s %s  also %-26s %s" % m)
