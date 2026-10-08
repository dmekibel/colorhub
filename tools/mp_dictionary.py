#!/usr/bin/env python3
"""Maerz & Paul, *A Dictionary of Color* (1930), round 2: the INDEX OF COLOR NAMES -> data/sources/maerz-paul-1930-dictionary.json
and data/sources/mp-etymology.json.   See research/MAERZ-PAUL.md s8 for the method, the numbers and the limits.

Pipeline (each step is a function here; the OCR itself is tools/mp_index_ocr.py, the line parser tools/mp_parse.py,
the all-cells plate digitization tools/mp_chips.py, the hand-paraphrased Notes section tools/mp_notes_data.py):

  1. parse   every index entry: date of first recorded use, name, superscript codes, translation/etymology
             parentheses, and the plate/column/row it points at.  The plate reference is read twice (whole line,
             and a digits+A-L only crop); disagreements and impossible refs are repaired against, in order: the
             round-1 key-page name at that cell, and the ISCC-NBS block color of the name.
  2. map     each name to its chip (all 144 cells of all 55 recovered plates are digitized, not only the 825 cells
             round 1 could read a name from).  Plate 2 is missing from the scan, so its entries keep name, date
             and note but get no color.
  3. color   per-plate correction fitted in CIELAB against the chips whose name is also an ISCC-NBS 1955 name
             sourced to Maerz & Paul (block centroid = target), 20% held out; outliers flagged uncertain.
  4. write   data/sources/maerz-paul-1930-dictionary.json and data/sources/mp-etymology.json.

  python3 tools/mp_dictionary.py            # run everything from the cached OCR (research/_raw/mp-index/)
"""
import json
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import library as L  # noqa: E402
import maerz_paul as mp  # noqa: E402
import mp_chips  # noqa: E402
import mp_notes_data  # noqa: E402
import mp_parse as P  # noqa: E402

ROOT = mp.ROOT
SRC = ROOT / "data" / "sources"
OUT_DICT = SRC / "maerz-paul-1930-dictionary.json"
OUT_ETYM = SRC / "mp-etymology.json"
CACHE = ROOT / "research" / "_raw" / "mp-index"
FIRST_LEAF, LAST_LEAF = 199, 221


# ---------------------------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------------------------
def lev(a, b, cap=3):
    if abs(len(a) - len(b)) > cap:
        return cap + 1
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def ascii_key(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z]", "", s)


def hex_of(rgb):
    return "#" + "".join(f"{int(round(min(255, max(0, v)))):02X}" for v in rgb)


def load_round1():
    rows = [json.loads(l) for l in (SRC / "maerz-paul-1930.json").read_text(encoding="utf-8").splitlines()[1:] if l.strip()]
    return {(r["plate"], r["col"] + str(r["row"])): r for r in rows}


def load_iscc():
    names = [json.loads(l) for l in (SRC / "iscc-nbs-names.json").read_text(encoding="utf-8").splitlines()[1:] if l.strip()]
    cents = {}
    for l in (SRC / "iscc-nbs-centroids.json").read_text(encoding="utf-8").splitlines()[1:]:
        if l.strip():
            r = json.loads(l)
            cents[r["block"]] = r["hex"]
    by_key = {}
    for r in names:
        by_key.setdefault(L.key(r["n"]), []).append(r)
    return by_key, cents, names


class Vocab:
    """Known words for OCR-repair of names: system dictionary + tokens of every name this project already holds."""

    def __init__(self, extra_names):
        words = set()
        try:
            words |= {w.strip().lower() for w in open("/usr/share/dict/words", encoding="utf-8", errors="ignore") if w.strip()}
        except OSError:
            pass
        self.color_tokens = Counter()
        for n in extra_names:
            for t in re.split(r"[\s\-/]+", n.lower()):
                t = re.sub(r"[^a-z']", "", t)
                if len(t) >= 3:
                    self.color_tokens[t] += 1
        self.words = words | set(self.color_tokens)
        self.by_len = defaultdict(list)
        for t in self.color_tokens:
            self.by_len[len(t)].append(t)

    def known(self, tok):
        t = re.sub(r"[^a-z']", "", unicodedata.normalize("NFKD", tok).encode("ascii", "ignore").decode().lower())
        return len(t) < 3 or t in self.words or t.rstrip("s") in self.words or t.endswith("'s") and t[:-2] in self.words

    def repair(self, tok):
        """-> the word without glued superscript/dagger letters, or None.  (No edit-distance spelling repair:
        rare real names like Azurn or Kasseler look like typos and were being 'fixed' into other words.)"""
        t = re.sub(r"[^a-z']", "", unicodedata.normalize("NFKD", tok).encode("ascii", "ignore").decode().lower())
        if len(t) < 4:
            return None
        # glued superscript / dagger letters: "Greyt", "RedM", "PinkP" -> the word without its last 1-2 letters
        for cut in (1, 2):
            rest, tail = t[:-cut], tok[-cut:]
            if len(rest) >= 4 and rest in self.words and all(ch in "ABCFHMOPRTVYtfj" for ch in tail) \
                    and (len(rest) >= 5 or not tok.isupper()):
                return rest
        return None


FOREIGN_TAGS = {"Fr": "French", "It": "Italian", "Sp": "Spanish", "Ln": "Latin", "Ger": "German", "Gr": "Greek",
                "Dut": "Dutch", "Port": "Portuguese", "Rus": "Russian", "Pers": "Persian", "Ar": "Arabic"}
SUP_TEXT = {"A": "dye or pigment from an animal source", "B": "British ready-mixed paint name",
            "C": "ceramics color name", "F": "listed only in Funk & Wagnalls (1892)", "H": "heraldic color",
            "M": "American ready-mixed paint name", "O": "name from Oberthur's Repertoire de Couleurs (1905)",
            "P": "pigment or paint name used by artists and painters", "R": "name from Ridgway (1912)",
            "T": "textile-trade name", "V": "dye or pigment from a vegetable source"}


def _sane_phrase(t):
    """a translation / synonym phrase read from the OCR: plain words only, no stray single letters or fragments"""
    if not t or not re.fullmatch(r"[A-Za-z][A-Za-z' ,.\-]{2,38}", t):
        return None
    toks = re.split(r"[\s,]+", t.strip(" ,.-"))
    if any(len(w.strip(".")) < 2 and w.lower() not in ("a",) for w in toks) or len(toks[-1].strip(".")) < 3:
        return None
    return t.strip(" ,.-")


def paren_facts(parens):
    """-> (lang or None, translation, etymology, equiv, f_cell, see)"""
    lang = trans = etym = equiv = fcell = see = None
    for p in parens:
        p = p.strip(" .;:|-")
        m = re.match(r"^(?:<\s*)?(Fr|It|Sp|Ln|Ger|Gr|Dut|Port|Rus|Pers|Ar)\.?\s+(.*)$", p)
        if p.startswith("<"):
            etym = re.sub(r"^<\s*", "", p)
            m2 = re.match(r"^(Fr|It|Sp|Ln|Ger|Gr|Dut)\.?\s+(.*)$", etym)
            if m2:
                lang = FOREIGN_TAGS.get(m2.group(1), lang)
            continue
        if m:
            lang = FOREIGN_TAGS[m.group(1)]
            trans = m.group(2).strip(" ,.")
            continue
        m = re.match(r"^F\s*=\s*(\d{1,2})\s*([A-L])\s*(\d{1,2})$", p.replace(" ", " "))
        if m:
            fcell = f"{m.group(1)} {m.group(2)} {m.group(3)}"
            continue
        if re.match(r"^see\b", p, re.I):
            see = re.sub(r"^see\s*[†‡t¢f]*\s*", "", p, flags=re.I).strip()
            continue
        if re.fullmatch(r"[A-Za-z' ,.-]{3,40}", p):
            equiv = p
    trans, equiv = _sane_phrase(trans), _sane_phrase(equiv)
    if etym and not re.fullmatch(r"[A-Za-z\u00c0-\u00ff][A-Za-z\u00c0-\u00ff' ,.:\-]{3,60}", etym):
        etym = None
    return lang, trans, etym, equiv, fcell, see


# ---------------------------------------------------------------------------------------------
# step 1-2: parse + map
# ---------------------------------------------------------------------------------------------
def parse_entries():
    out = []
    for e in P.parse_all(FIRST_LEAF, LAST_LEAF):
        if not e["name"] or len(re.sub(r"[^A-Za-z]", "", e["name"])) < 3:
            continue
        out.append(e)
    return out


def chip_tables():
    chips = mp_chips.load()
    tab = {}
    for pl, d in chips.items():
        margin = np.array(d["margin"])
        for cell, rgb in d["cells"].items():
            raw = np.array(rgb)
            tab[(int(pl), cell)] = dict(raw=raw, margin=margin, wb=mp.white_balance(raw, margin))
    return tab


def cell_str(r):
    return f"{r[1]}{r[2]}"


def resolve_refs(entries, tab, r1, iscc_by_key, cents):
    """Choose one (plate, col, row) per entry from the two OCR reads and their repairs."""
    stats = Counter()
    for e in entries:
        cands = {}

        def add(r, w, why):
            if r and P.valid_ref(r):
                c = cands.setdefault(r, dict(score=0.0, why=[]))
                c["score"] += w
                c["why"].append(why)

        A, B = e["refA"], e["refB"]
        add(A, 1.0, "line")
        add(B, 1.0, "field")
        if A and not P.valid_ref(A):
            for v in P.ref_variants(A):
                add(v, 0.5, "line-repair")
        if B and not P.valid_ref(B):
            for v in P.ref_variants(B):
                add(v, 0.5, "field-repair")
        if A and B and A != B:
            for r in (A, B):
                for v in P.ref_variants(r):
                    add(v, 0.25, "swap-repair")
        # known context
        nk = L.key(e["name"])
        ik = iscc_by_key.get(nk)
        centroid = None
        if ik:
            blocks = {r["block"] for r in ik if "M" in r.get("src", [])}
            if len(blocks) == 1:
                centroid = cents.get(next(iter(blocks)))
        for r, c in list(cands.items()):
            t = tab.get((r[0], cell_str(r)))
            r1row = r1.get((r[0], cell_str(r)))
            if r1row and L.key(r1row["n"]) == nk:
                c["score"] += 3.0
                c["why"].append("round1-name")
            elif r1row and ascii_key(r1row["n"]) and lev(ascii_key(r1row["n"]), ascii_key(e["name"]), 2) <= 2 and len(ascii_key(e["name"])) >= 5:
                c["score"] += 2.0
                c["why"].append("round1-near")
            if centroid and t is not None:
                de = float(L.de2000(L.labs([hex_of(t["wb"])]), L.labs([centroid]))[0, 0])
                c["de_iscc"] = de
                c["score"] += 1.5 if de < 12 else (0.5 if de < 20 else -0.5)
                if de < 12:
                    c["why"].append("iscc-near")
        if not cands:
            e["ref"], e["ref_conf"], e["ref_why"] = None, 0.0, []
            stats["no_ref"] += 1
            continue
        ranked = sorted(cands.items(), key=lambda kv: -kv[1]["score"])
        best, bc = ranked[0]
        second = ranked[1][1]["score"] if len(ranked) > 1 else -9
        e["ref"] = best
        margin = bc["score"] - max(second, 0)
        conf = 0.35 + 0.1 * min(bc["score"], 5) + 0.05 * min(margin, 3)
        if best == A == B:
            conf += 0.15
        e["ref_conf"] = round(min(conf, 0.99), 2)
        e["ref_why"] = bc["why"]
        stats["ref"] += 1
    return stats


# ---------------------------------------------------------------------------------------------
# step 3: color correction
# ---------------------------------------------------------------------------------------------
def fit_affine(X, Y, w=None, ridge=1e-3):
    n = len(X)
    A = np.hstack([X, np.ones((n, 1))])
    w = np.ones(n) if w is None else w
    Aw = A * w[:, None]
    reg = ridge * np.eye(4)
    reg[3, 3] = 0
    return np.linalg.solve(A.T @ Aw + reg, Aw.T @ Y)


def irls_affine(X, Y, iters=8, scale=5.0, ridge=1e-3):
    w = np.ones(len(X))
    W = fit_affine(X, Y, w, ridge)
    for _ in range(iters):
        r = np.linalg.norm(np.hstack([X, np.ones((len(X), 1))]) @ W - Y, axis=1)
        w = np.where(r <= scale, 1.0, scale / np.maximum(r, 1e-9))
        W = fit_affine(X, Y, w, ridge)
    return W


def apply_affine(W, X):
    return np.hstack([X, np.ones((len(X), 1))]) @ W


def de_rows(lab_a, lab_b):
    """Row-wise CIEDE2000."""
    out = np.zeros(len(lab_a))
    for i in range(0, len(lab_a), 400):
        D = L.de2000(lab_a[i:i + 400], lab_b[i:i + 400])
        out[i:i + 400] = np.diag(D) if D.shape[0] == D.shape[1] else D[np.arange(D.shape[0]), np.arange(D.shape[0])]
    return out


class PlateModel:
    """Global robust affine in Lab + a per-plate shrunken offset (and, optionally, per-plate shrunken affine)."""

    def __init__(self, lam_off=4.0, lam_aff=None):
        self.lam_off, self.lam_aff = lam_off, lam_aff

    def fit(self, X, Y, plates):
        self.W = irls_affine(X, Y)
        R = Y - apply_affine(self.W, X)
        self.off, self.dW = {}, {}
        for p in set(plates):
            idx = np.where(plates == p)[0]
            if self.lam_aff is not None and len(idx) >= 4:
                Xp = np.hstack([X[idx], np.ones((len(idx), 1))])
                reg = self.lam_aff * np.eye(4)
                reg[3, 3] = self.lam_off
                self.dW[p] = np.linalg.solve(Xp.T @ Xp + reg, Xp.T @ R[idx])
            else:
                self.off[p] = R[idx].sum(0) / (len(idx) + self.lam_off)
        return self

    def predict(self, X, plates):
        out = apply_affine(self.W, X)
        for i, p in enumerate(plates):
            if p in self.dW:
                out[i] += np.append(X[i], 1.0) @ self.dW[p]
            elif p in self.off:
                out[i] += self.off[p]
        return out


def lab_of_rgb(rgb):
    return L.rgb_to_lab(np.clip(np.asarray(rgb, dtype=float), 0, 255))


def run_color_fit(gt_rows, seed=11):
    """gt_rows: list of dict(plate, wb (rgb), target (hex)).  Returns report dict and the chosen model."""
    X = lab_of_rgb(np.array([g["wb"] for g in gt_rows]))
    Y = L.labs([g["target"] for g in gt_rows])
    plates = np.array([g["plate"] for g in gt_rows])
    # trim name collisions: an ISCC-NBS name can mean a different color than the chip the index sends it to (a mapping
    # misread, or one name shared by two blocks); anything >25 dE00 from the robust global fit is not used to fit
    g0 = apply_affine(irls_affine(X, Y), X)
    keep = de_rows(g0, Y) <= 25.0
    trimmed = int((~keep).sum())
    gt_rows = [g for g, k in zip(gt_rows, keep) if k]
    X, Y, plates = X[keep], Y[keep], plates[keep]
    n = len(X)
    rng = np.random.RandomState(seed)
    base_de = de_rows(X, Y)
    configs = {"global affine": dict(lam_off=1e9),
               "global + plate offset (lam 2)": dict(lam_off=2.0),
               "global + plate offset (lam 5)": dict(lam_off=5.0),
               "global + plate offset (lam 12)": dict(lam_off=12.0),
               "global + plate affine (shrunk 400)": dict(lam_off=5.0, lam_aff=400.0),
               "global + plate affine (shrunk 100)": dict(lam_off=5.0, lam_aff=100.0)}
    # model selection: 5 random 80/20 splits, median held-out dE00
    perf = {k: [] for k in configs}
    perf["none"] = []
    for rep in range(5):
        perm = rng.permutation(n)
        te, tr = perm[: n // 5], perm[n // 5:]
        perf["none"].append(float(np.median(base_de[te])))
        for k, cfg in configs.items():
            m = PlateModel(**cfg).fit(X[tr], Y[tr], plates[tr])
            pred = m.predict(X[te], plates[te])
            perf[k].append(float(np.median(de_rows(pred, Y[te]))))
    summary = {k: float(np.mean(v)) for k, v in perf.items()}
    best_name = min(configs, key=lambda k: summary[k])
    # the reported headline split: one fixed 80/20 split with the chosen model
    perm = np.random.RandomState(seed + 100).permutation(n)
    te, tr = perm[: n // 5], perm[n // 5:]
    m_tr = PlateModel(**configs[best_name]).fit(X[tr], Y[tr], plates[tr])
    pred_te = m_tr.predict(X[te], plates[te])
    held_before = de_rows(X[te], Y[te])
    held_after = de_rows(pred_te, Y[te])
    full = PlateModel(**configs[best_name]).fit(X, Y, plates)
    pred_all = full.predict(X, plates)
    rep = dict(n=n, trimmed_outliers=trimmed, model=best_name, cv=summary,
               held_out=dict(n=len(te), before_median=float(np.median(held_before)), after_median=float(np.median(held_after)),
                             before_mean=float(held_before.mean()), after_mean=float(held_after.mean())),
               train=dict(n=len(tr), before_median=float(np.median(base_de[tr])),
                          after_median=float(np.median(de_rows(m_tr.predict(X[tr], plates[tr]), Y[tr])))),
               all_before_median=float(np.median(base_de)), all_after_median=float(np.median(de_rows(pred_all, Y))))
    return rep, full, pred_all


# ---------------------------------------------------------------------------------------------
# main build
# ---------------------------------------------------------------------------------------------
LATINISH = {"mortuum", "caput", "aurum", "mussivum", "mosaicum", "terra", "vert", "bleu", "rouge", "jaune", "gris", "noir",
            "blanc", "feuille", "morte", "couleur", "fleur", "lys", "de", "du", "des", "la", "le", "l", "et"}


def clean_text_name(raw, vocab, line_conf=100.0):
    s = raw.replace("’", "'").replace("‘", "'")
    s = re.sub(r"[^A-Za-z'À-ÿ\- .,&]", " ", s)
    s = re.sub(r"\s+", " ", s).strip(" .,-'")
    toks, fixes, suspect = [], [], False
    for t in s.split(" "):
        if not t:
            continue
        base = re.sub(r"[^A-Za-z'À-ÿ]", "", t)
        if base and not vocab.known(base):
            fx = vocab.repair(base)
            if fx:
                fixes.append((base, fx))
                t = t.replace(base, fx.upper() if base.isupper() else fx.capitalize() if base[0].isupper() else fx)
            else:
                suspect = True
        toks.append(t)
    return " ".join(toks), fixes, suspect


def build_notes_index():
    idx = {}
    for names, fact, year in mp_notes_data.NOTES:
        for n in names:
            idx.setdefault(L.key(n), (fact, year, names[0]))
    return idx


def origin_fact(e, note_hit):
    bits = []
    lang, trans, etym, equiv, fcell, see = e["_pf"]
    if etym:
        bits.append(f"Etymology given as: {etym}.")
    if lang and trans:
        bits.append(f"{lang} for '{trans.lower()}'.")
    elif lang:
        bits.append(f"A {lang} term.")
    if equiv and not (lang and trans):
        bits.append(f"Listed as a synonym of {equiv}.")
    if e["sups"]:
        bits.append(SUP_TEXT[e["sups"]][0].upper() + SUP_TEXT[e["sups"]][1:] + ".")
    if note_hit:
        bits.append(note_hit[0])
    return " ".join(bits)


def main():
    entries = parse_entries()
    print(f"parsed {len(entries)} index entries from leaves {FIRST_LEAF}-{LAST_LEAF}")
    tab = chip_tables()
    r1 = load_round1()
    iscc_by_key, cents, iscc_names = load_iscc()
    stats = resolve_refs(entries, tab, r1, iscc_by_key, cents)
    print(dict(stats))
    lib = json.loads((ROOT / "data" / "library.json").read_text(encoding="utf-8"))
    vocab = Vocab([r["n"] for r in iscc_names] + [e["n"] for e in lib] + [r["n"] for r in r1.values()]
                  + [a["n"] for e in lib for a in e.get("altn", [])])
    notes_idx = build_notes_index()
    for e in entries:
        name, fixes, suspect = clean_text_name(e["name"], vocab, e["conf_ocr"])
        e["name_clean"], e["fixes"], e["suspect"] = name, fixes, suspect
        e["_pf"] = paren_facts(e["paren"])
        e["lang"] = e["_pf"][0]
        e["nkey"] = L.key(name)
        hit = notes_idx.get(e["nkey"]) or (e["generic"] and notes_idx.get(L.key(name + " " + e["generic"])))
        if not hit and e["_pf"][3]:
            hit = notes_idx.get(L.key(e["_pf"][3]))
        e["note_hit"] = hit
    gt = []
    for e in entries:
        # ground truth must not depend on the ISCC color it will be fitted to: both OCR reads agree, or the
        # round-1 key page names this very cell with this very name
        if not e["ref"] or not ((e["refA"] == e["refB"] == e["ref"]) or "round1-name" in e["ref_why"]):
            continue
        if e["suspect"]:
            continue
        t = tab.get((e["ref"][0], cell_str(e["ref"])))
        ik = iscc_by_key.get(e["nkey"])
        if t is None or not ik:
            continue
        blocks = {r["block"] for r in ik if "M" in r.get("src", [])}
        if len(blocks) != 1:
            continue
        gt.append(dict(entry=e, plate=e["ref"][0], wb=t["wb"], target=cents[next(iter(blocks))]))
    print(f"color-fit ground truth: {len(gt)} chips ({len({g['plate'] for g in gt})} plates)")
    rep, model, pred_all = run_color_fit(gt)
    print(json.dumps(rep, indent=1))
    return dict(entries=entries, tab=tab, r1=r1, gt=gt, rep=rep, model=model, pred_all=pred_all, vocab=vocab,
                iscc_by_key=iscc_by_key, cents=cents, lib=lib)


FOREIGN_WORDS = {"acier", "ardoise", "bleu", "bleuet", "rouge", "vert", "jaune", "gris", "noir", "blanc", "feuille",
                 "couleur", "fleur", "lys", "mesange", "eveque", "cuivre", "azur", "pervenche", "terre", "oiseau",
                 "negro", "rosso", "verde", "azzurro", "giallo", "bianco", "nero", "grigio", "amarillo", "azul", "caput",
                 "mortuum", "aurum", "mussivum", "mosaicum", "sandaracha", "chrysocolla", "ochra", "minium"}


def display_name(n):
    n = re.sub(r"\s+", " ", n).strip(" ,.-")
    if n.isupper() or n.islower():
        n = L.title(n.lower())
    return n


def is_clean(name, vocab):
    if not name or len(name) < 3 or len(name) > 36:
        return False
    if re.search(r"[^A-Za-z'\- ]", unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()):
        return False
    toks = [t for t in re.split(r"[\s\-]+", name) if t]
    if not 1 <= len(toks) <= 4:
        return False
    for t in toks:
        if len(t) < 3 and t.lower() not in L.SMALL:
            return False
        if re.search(r"[a-z][A-Z]", t):       # glued superscript / dagger: "WoodY", "RedM"
            return False
        if not vocab.known(t):
            return False
    return True


def build_rows(ctx):
    entries, tab, vocab = ctx["entries"], ctx["tab"], ctx["vocab"]
    model, gt = ctx["model"], ctx["gt"]
    ctx["iscc_m_keys"] = {k for k, rs in ctx["iscc_by_key"].items() if any("M" in r.get("src", []) for r in rs)}
    Xg = lab_of_rgb(np.array([g["wb"] for g in gt]))
    pg = model.predict(Xg, np.array([g["plate"] for g in gt]))
    res = {id(g["entry"]): v for g, v in zip(gt, de_rows(pg, L.labs([g["target"] for g in gt])))}
    T = float(max(15.0, np.percentile(np.array(list(res.values())), 90)))
    ctx["uncertain_de"] = T
    chip_keys = sorted({(e["ref"][0], cell_str(e["ref"])) for e in entries if e["ref"] and (e["ref"][0], cell_str(e["ref"])) in tab})
    X = lab_of_rgb(np.array([tab[k]["wb"] for k in chip_keys]))
    Yp = model.predict(X, np.array([k[0] for k in chip_keys]))
    chip_hex = {k: hex_of(L.lab_to_rgb(y)) for k, y in zip(chip_keys, Yp)}
    chip_hex0 = {k: hex_of(tab[k]["wb"]) for k in chip_keys}
    rows, junk = [], 0
    for e in entries:
        name = e["name_clean"]
        if not name or not re.match(r"^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'\- ,.&]*$", name) or len(name) > 48 or len(name.split()) > 7:
            junk += 1
            continue
        parts = [name]
        if "," in name and not name.rstrip().endswith("d'"):
            ps = [p.strip() for p in name.split(",") if len(p.strip()) >= 3]
            if len(ps) >= 2 and all(len(p.split()) <= 3 for p in ps) and not re.search(r"\bd'?$", ps[0]):
                parts = ps
        lang, trans, etym, equiv, fcell, see = e["_pf"]
        folded = unicodedata.normalize("NFKD", name.lower()).encode("ascii", "ignore").decode()
        foreign = bool(lang) or any(w in FOREIGN_WORDS for w in re.split(r"[\s\-]+", folded)) or bool(re.search(r"[À-ÿ]", name))
        origin = origin_fact(e, e["note_hit"])
        year = e["year"]
        for nm in parts:
            disp = display_name(nm)
            row = {"n": disp}
            if e["generic"] and len(parts) == 1:
                row["generic"] = e["generic"].title()
            if year:
                row["date"] = year
                if e["year_approx"]:
                    row["date_approx"] = True
            ref = e["ref"]
            if ref:
                k = (ref[0], cell_str(ref))
                row["plate"], row["cell"], row["plate_cell"] = ref[0], f"{ref[1]}{ref[2]}", f"{ref[0]} {ref[1]} {ref[2]}"
                if k in chip_hex:
                    row["h"], row["h0"] = chip_hex[k], chip_hex0[k]
                else:
                    row["no_chip"] = "plate 2 is missing from the scan" if ref[0] == 2 else "no chip"
            if origin:
                row["origin"] = origin
            if lang:
                row["lang"] = lang
            if e["sups"]:
                row["sup"] = e["sups"]
            row["caps"] = bool(e["allcaps"])
            if e["dagger"]:
                row["has_note"] = True
            if equiv:
                row["synonym_of"] = equiv
            if fcell:
                row["funk_cell"] = fcell
            r1n = ctx["r1"].get((ref[0], cell_str(ref))) if ref else None
            if r1n and L.key(r1n["n"]) != L.key(disp):
                row["round1_label"] = r1n["n"]
            name_c = (0.5 + 0.5 * min(1.0, e["conf_ocr"] / 85.0)) * (0.6 if e["suspect"] else 1.0)
            ref_c = e["ref_conf"] if ref else 0.0
            date_ok = 1.0 if year else 0.0
            conf = 0.4 * name_c + 0.45 * ref_c + 0.15 * date_ok if ref else 0.6 * name_c + 0.4 * date_ok
            reasons = []
            if e["suspect"]:
                reasons.append("name has a word not in any dictionary or name list")
            if ref and e["ref_conf"] < 0.6:
                reasons.append("plate reference uncertain")
            if e.get("date_conflict"):
                reasons.append("date read two ways")
            de = res.get(id(e))
            if de is not None:
                row["de_iscc"] = round(float(de), 1)
                if de > T:
                    reasons.append(f"color is dE00 {de:.0f} from its ISCC-NBS block")
            row["conf"] = round(min(conf, 0.99), 2)
            row["uncertain"] = bool(reasons) or conf < 0.62
            if reasons:
                row["uncertain_why"] = "; ".join(reasons)
            row["clean"] = bool(is_clean(disp, vocab) and not e["suspect"] and row["conf"] >= 0.62)
            row["verified"] = L.key(disp) in ctx["iscc_m_keys"]
            row["foreign"] = foreign
            rows.append(row)
    ctx["junk"] = junk
    return rows


def write_outputs(ctx, rows):
    prov = {"_provenance": ("Maerz, A. & Paul, M. Rea, \"A Dictionary of Color\", 1st ed. (McGraw-Hill, 1930), INDEX OF COLOR NAMES "
                            "(printed pp. 189-206) and Plates. U.S. public domain since 2026-01-01. OCR of the Internet Archive item "
                            "dictionaryofcolo0000aloy original camera JP2s; see research/MAERZ-PAUL.md s8."),
            "_built": "tools/mp_dictionary.py",
            "_fields": ("n=name, generic=optional generic word the index puts in brackets, date=year of first recorded use (index), "
                        "date_approx, plate/cell/plate_cell=where the chip is, h=hex after the per-plate Lab correction, h0=hex as round 1 "
                        "measured it, origin=short paraphrased fact, lang, sup=index superscript code, caps=ALL CAPS in the index (constant "
                        "use), has_note=has an entry in the Notes section, synonym_of, funk_cell, round1_label=round-1 garbled key-page "
                        "label at this cell, de_iscc=dE00 to the ISCC-NBS block (fit chips only), conf 0-1, uncertain, uncertain_why, clean (a real, "
                        "well-formed English-looking name), verified (the same name is an ISCC-NBS 1955 entry citing Maerz & Paul), foreign")}
    with open(OUT_DICT, "w", encoding="utf-8") as f:
        f.write(json.dumps(prov, ensure_ascii=False) + "\n")
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False, separators=(",", ":")) + "\n")
    best = {}
    for r in rows:
        if not (r.get("date") or r.get("origin")):
            continue
        if not r["clean"]:
            continue
        k = L.key(r["n"])
        score = (r["clean"], r["conf"], bool(r.get("origin")), bool(r.get("date")))
        if k not in best or score > best[k][0]:
            best[k] = (score, r)
    ety = {}
    for k, (_, r) in sorted(best.items(), key=lambda kv: kv[1][1]["n"].lower()):
        d = {}
        if r.get("date"):
            d["date"] = r["date"]
            if r.get("date_approx"):
                d["date_approx"] = True
        if r.get("origin"):
            d["origin"] = r["origin"]
        if r.get("lang"):
            d["lang"] = r["lang"]
        if r.get("plate_cell"):
            d["plate_cell"] = r["plate_cell"]
        d["source"] = "Maerz & Paul, A Dictionary of Color (1930), Index of Color Names"
        if r.get("uncertain"):
            d["uncertain"] = True
        ety[r["n"]] = d
    meta = {"_provenance": ("name -> first recorded use (year in the 1930 index) and a short paraphrased origin note, from Maerz & Paul, A "
                            "Dictionary of Color (1930; public domain). Dates are the index's own 'earliest date found' column; "
                            "date_approx = the book prints only a century or decade (18--, 185-). Built by tools/mp_dictionary.py."),
            "_count": len(ety)}
    OUT_ETYM.write_text(json.dumps({**meta, "names": ety}, ensure_ascii=False, indent=0, separators=(",", ":")) + "\n", encoding="utf-8")
    return ety


if __name__ == "__main__":
    ctx = main()
    rows = build_rows(ctx)
    ety = write_outputs(ctx, rows)
    print(f"rows {len(rows)} (junk dropped {ctx['junk']}); etymology names {len(ety)}; uncertain dE00 threshold {ctx['uncertain_de']:.1f}")
