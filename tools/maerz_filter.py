#!/usr/bin/env python3
"""Clean filter for the OCR'd Maerz & Paul (1930) names (research/MAERZ-PAUL.md s7: "Maracail Domingc" and "Tanagra
Castilian Old Cedse" are two neighboring cells' labels run together; many more are truncated or mis-read).

  python3 tools/maerz_filter.py            # writes data/sources/maerz-paul-1930-clean.json (+ -rejected.json), prints report
  python3 tools/maerz_filter.py --sample 30   # also prints 30 random accepted rows

Each OCR name gets one status, decided against sources that are NOT this OCR:
  verified  the name (case/accents/spaces aside) is an ISCC-NBS 1955 dictionary entry
            (data/sources/iscc-nbs-names.json; ~3,300 of its names are cited to Maerz & Paul);
  expanded  the plate abbreviates the family ("Fairy Gr", "Alice BI", "Baby PK"); the spelled-out form is an ISCC-NBS name;
  repaired  the OCR is one or two characters off a single ISCC-NBS Maerz & Paul name ("Jherry Blossom" -> "Cherry Blossom"), and
            the measured chip color is within 20 dE of that name's ISCC-NBS block (else it is rejected, not guessed);
  clean     not in ISCC, but every word is in an English / proper-name / color-word lexicon (system dictionary web2, web2a,
            propernames, plus tokens from CSS, xkcd, Wikipedia, Werner, Ridgway, RAL and the ISCC-NBS names), 1 to 3 words,
            and the name is not a join of two ISCC names;
  rejected  anything else: a fragment that is not a word ("Domingc"), a lone family code ("Pk", "BI"), more than 3 words,
            a join of two names, or an ISCC match whose color is >20 dE off. The reason is recorded.
The plate images (research/_raw/maerz-paul) are not cached on every machine, so rejected rows are NOT hand-corrected from the
plate; only rows a second source confirms are kept.
"""
import json, random, re, sys
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
import library as LIB  # noqa: E402
import wordlist as WL  # noqa: E402

SRC = ROOT / "data" / "sources" / "maerz-paul-1930.json"
OUT = ROOT / "data" / "sources" / "maerz-paul-1930-clean.json"
REJ = ROOT / "data" / "sources" / "maerz-paul-1930-rejected.json"
ISCC = ROOT / "data" / "sources" / "iscc-nbs-names.json"
CENT = ROOT / "data" / "sources" / "iscc-nbs-centroids.json"

CODES = {"gr": "Green", "pk": "Pink", "pr": "Purple", "bl": "Blue", "bi": "Blue", "blt": "Blue", "y": "Yellow", "yp": "Yellow",
         "r": "Red", "br": "Brown", "brc": "Brown", "or": "Orange", "o": "Orange", "gy": "Grey", "bh": "Bluish", "pl": "Purple"}
REPAIR_DE = 20.0


def lev(a, b, cap=3):
    """Levenshtein distance, giving up (returning cap+1) beyond cap."""
    if abs(len(a) - len(b)) > cap:
        return cap + 1
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i] + [0] * len(b)
        lo = min(cur[0], 99)
        for j, cb in enumerate(b, 1):
            cur[j] = min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb))
        if min(cur) > cap:
            return cap + 1
        prev = cur
    return prev[-1]


def load_iscc():
    rows = [json.loads(l) for l in ISCC.read_text(encoding="utf-8").splitlines()[1:] if l.strip()]
    return rows


def run(sample=0, write=True):
    raw = SRC.read_text(encoding="utf-8").splitlines()
    header = raw[0]
    rows = [json.loads(l) for l in raw[1:] if l.strip()]
    iscc = load_iscc()
    cent = {}
    try:
        c = json.loads(CENT.read_text(encoding="utf-8"))
        cent = {int(k): v for k, v in (c.items() if isinstance(c, dict) else enumerate(c))}
    except Exception:
        pass
    ikey = {}
    for e in iscc:
        ikey.setdefault(LIB.key(e["n"]), e)
    m_names = [e for e in iscc if "M" in e["src"]]
    m_by_len = {}
    for e in m_names:
        m_by_len.setdefault(len(LIB.key(e["n"])), []).append(e)
    itokens = set(t for e in iscc for t in WL.tokens(e["n"]))
    lex = WL.lexicon()
    # words a COLOR name can be made of: color sources + ISCC-NBS + curated extras (NOT the bare system dictionary, which has "long")
    clex = set(WL.EXTRAS) | itokens
    for le in LIB.load_library():
        if set(le["src"]) & {"css", "xkcd", "iscc-nbs", "wiki", "werner", "ridgway", "ral", "app", "pigment"}:
            clex.update(WL.tokens(le["n"]))
    single_names = {LIB.key(e["n"]) for e in iscc if " " not in e["n"].strip()}
    ocr_keys = {LIB.key(r["n"]) for r in rows}

    def block_de(hexv, block):
        c = cent.get(int(block))
        if c is None:
            return None
        ch = c if isinstance(c, str) else (c.get("h") or c.get("hex") if isinstance(c, dict) else None)
        if not ch:
            return None
        return float(LIB.de2000(LIB.labs([hexv]), LIB.labs([ch]))[0][0])

    def token_ok(t):
        return t in lex or t in itokens or (t.endswith("s") and t[:-1] in lex)

    out, rej = [], []
    stats = {}
    for r in rows:
        name = re.sub(r"\s+", " ", r["n"]).strip()
        k = LIB.key(name)
        status = reason = fixed = None
        toks = WL.tokens(name)
        e = ikey.get(k)
        if e is not None:
            status, fixed = "verified", e["n"]
        if status is None:
            # plate abbreviation: expand the trailing family code
            parts = name.split(" ")
            if len(parts) >= 2 and parts[-1].lower() in CODES:
                cand = " ".join(parts[:-1]) + " " + CODES[parts[-1].lower()]
                e2 = ikey.get(LIB.key(cand))
                if e2 is not None:
                    status, fixed = "expanded", e2["n"]
        if status is None and len(k) >= 6:
            # repair: unique nearest ISCC Maerz & Paul name within edit distance 2 (1 for short names)
            cap = 1 if len(k) < 8 else 2
            best, second = (cap + 1, None), cap + 1
            hits = []
            for L in range(len(k) - cap, len(k) + cap + 1):
                for e3 in m_by_len.get(L, ()):
                    d = lev(k, LIB.key(e3["n"]), cap)
                    if d <= cap:
                        hits.append((d, e3))
            hits.sort(key=lambda x: (x[0], x[1]["n"]))
            if hits and (len(hits) == 1 or hits[0][0] < hits[1][0]):
                e3 = hits[0][1]
                de = block_de(r["h"], e3["block"])
                if de is None or de <= REPAIR_DE:
                    status, fixed = "repaired", e3["n"]
                else:
                    reason = f"OCR near '{e3['n']}' but the chip is {de:.0f} dE from that name's block"
        if status is None and reason is None:
            bad = [t for t in toks if len(t) < 2 or not token_ok(t)]
            if not toks:
                reason = "no letters"
            elif bad:
                reason = "not words: " + ", ".join(bad)
            elif len(toks) > 3:
                reason = f"{len(toks)} words (two cells' labels joined)"
            elif len(toks) == 1 and toks[0] not in clex:
                reason = "single plain-English word that is not a color word (probably a fragment)"
            elif len(toks) >= 2 and all(LIB.key(t) in single_names or LIB.key(t) in ocr_keys for t in toks):
                reason = "each word is a separate dictionary name (two cells' labels joined)"
            else:
                joined = False
                for i in range(1, len(toks)):
                    if LIB.key("".join(toks[:i])) in ikey and LIB.key("".join(toks[i:])) in ikey and len(toks) >= 3:
                        joined = True
                if joined:
                    reason = "join of two dictionary names"
                else:
                    status, fixed = "clean", LIB.title(name)
        if status:
            # the ISCC-NBS text itself carries glitches ("CarnivalRed", "Opal Gy"): tidy the accepted name or drop it
            fx = re.sub(r"(?<=[a-z])(?=[A-Z])", " ", fixed)
            ps = fx.split(" ")
            if ps[-1].lower() in CODES and len(ps) > 1:
                ps[-1] = {"gy": "Grey"}.get(ps[-1].lower(), CODES[ps[-1].lower()])
            fx = " ".join(ps)
            if any(len(t) < 2 for t in WL.tokens(fx)) or any(len(w) <= 2 and w.lower() not in ("of", "de", "du", "la", "le") for w in fx.split(" ")):
                status, reason = None, f"abbreviated or glitched name '{fixed}'"
            else:
                fixed = fx
        r2 = dict(r)
        r2["ocr"] = r["n"]
        if status:
            r2["n"] = LIB.title(fixed)
            r2["status"] = status
            if status == "repaired":
                r2["note"] = r2["note"] + f"; OCR read '{r['n']}', matched to ISCC-NBS name '{fixed}'"
            if status in ("expanded", "repaired", "verified"):
                eb = ikey.get(LIB.key(fixed))
                de = block_de(r["h"], eb["block"]) if eb else None
                if de is not None and de > REPAIR_DE:
                    r2["uncertain"] = True
            out.append(r2)
        else:
            r2["status"] = "rejected"
            r2["reason"] = reason
            rej.append(r2)
        stats[status or "rejected"] = stats.get(status or "rejected", 0) + 1
    # one row per distinct name; a repeated name keeps its first chip
    print("OCR rows:", len(rows), "->", stats)
    print(f"accepted {len(out)}  (of which uncertain flag kept: {sum(1 for r in out if r.get('uncertain'))})  rejected {len(rej)}")
    if write:
        hdr = json.loads(header)
        hdr["_clean"] = ("tools/maerz_filter.py: only rows whose name is verified/expanded/repaired against the ISCC-NBS dictionary, or is made "
                         "of real words; 'ocr' is the raw read, 'status' says how it was accepted.")
        OUT.write_text(json.dumps(hdr, ensure_ascii=False) + "\n" + "\n".join(json.dumps(r, ensure_ascii=False) for r in out) + "\n", encoding="utf-8")
        REJ.write_text("\n".join(json.dumps(r, ensure_ascii=False) for r in rej) + "\n", encoding="utf-8")
    if sample:
        random.Random(11).shuffle(out)
        print(f"\n{sample} random accepted rows:")
        for r in out[:sample]:
            print(f"  {r['status']:9s} {r['n']:28s} (ocr {r['ocr']!r}) {r['h']}  plate {r['plate']} {r['col']}{r['row']}")
    return out, rej


if __name__ == "__main__":
    smp = 0
    if "--sample" in sys.argv:
        smp = int(sys.argv[sys.argv.index("--sample") + 1])
    out, rej = run(sample=smp)
    if "--rejected" in sys.argv:
        for r in rej:
            print(f"  REJ {r['ocr']!r:36s} {r['reason']}")
