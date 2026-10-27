#!/usr/bin/env python3
"""Fill missing movement (`mv`) and missing country (`co`) on corpus rows. DRY RUN: reads data/, writes only to --out.

  research/_raw/clipenv/bin/python tools/fill_movement_country.py [--out research/_scratch-fill] [--threads 2] [--epochs 12]
      -> <out>/fills-movement-country.json   {row id: {"mv": {...}, "co": {...}}}   each value: v, src, guess (bool), conf
      -> <out>/stats.json                    coverage before/after, per-source counts, held-out accuracy, cutoffs, samples
      -> <out>/report.txt                    the same, readable

Nothing in data/, js/, index.html or R2 is touched; wiring it into the rebuild is a separate step (see the end of report.txt).

Method, in order of trust. A step only fills a blank; sourced values (guess=false) are never mixed with guesses (guess=true).
  MOVEMENT   record          the museum / Commons row's own `mv` (the baseline, never replaced)
             wikidata-work   the painting's own P135 (data/artists/movements-wd.json tier1)
             wikidata-painter  the painter's single recorded P135 (movements-wd tier2, meta.json, raw Wikidata details),
                             folded to the corpus's movement names (tools/wikidata_artists.py MOVE_FOLD)
             guess:painter-majority  >= 3 labeled rows of the same painter, >= 80% one movement (a guess, flagged)
             guess:clip      classifier on CLIP embeddings + year + country, only above a cutoff chosen on held-out PAINTERS
  COUNTRY    record          the row's own `co` (baseline; includes the earlier tools/fill_country_date.py fills)
             wikidata-painter  P27 citizenship of the painter (meta.json nat, raw Wikidata details), via the painter's
                             name or, for Commons Q-rows, the creator Q (raw paintings-*.json)
             museum          the holding museum's country, only for sources where it agrees with `co` on labeled rows >= 60%
             guess:painter-majority  same rule as movement
             guess:clip      classifier, same cutoff rule
The cutoff is the lowest confidence at which held-out precision reaches --precision (default 0.85); no cutoff reaches it -> no guesses.
"""
import argparse, glob, json, os, random, re, sys, time
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
RAW = ROOT / "research" / "_raw"

# the museum's own country; a source is used only when it passes the agreement test below
MUSEUM = {"rijks": "Netherlands", "rijks2": "Netherlands", "nm": "Sweden", "smk": "Denmark", "smk2": "Denmark",
          "bsb": "Germany", "bsbcc": "Germany", "smb": "Germany", "smbcc": "Germany", "staedel": "Germany",
          "wales": "United Kingdom", "npg": "United Kingdom", "ycba": "United Kingdom",
          "saam": "United States", "nga": "United States", "nga2": "United States", "met": "United States",
          "cma": "United States", "cma2": "United States", "aic": "United States", "yuag": "United States",
          "fsg": "United States", "chndm": "United States"}


def load_rows():
    ids = [i for i in (ROOT / "data" / "gallery" / "ids.txt").read_text(encoding="utf-8").split("\n") if i]
    want = set(ids)
    rows = {}
    for f in sorted((ROOT / "data" / "corpus").glob("*.json")):
        for attempt in range(5):  # a rebuild may be rewriting the shard: retry, then skip it
            try:
                d = json.loads(f.read_text(encoding="utf-8")); break
            except (ValueError, OSError):
                d = []; time.sleep(2)
        d = d.get("rows", d) if isinstance(d, dict) else d
        for x in d:
            if x["id"] in want and x["id"] not in rows:
                rows[x["id"]] = {k: x.get(k) for k in ("id", "src", "t", "a", "y", "co", "mv", "coest")}
    return ids, rows


def wikidata_tables(rows):
    """painter-level movement and country from Wikidata, keyed by painter name and by painter Q."""
    from wikidata_artists import fold_movement, MOVE_NAMES
    from fill_country_date import map_country
    vocab = {r["co"] for r in rows.values() if r["co"]}
    meta = json.loads((ROOT / "data/artists/meta.json").read_text(encoding="utf-8"))["a"]
    name_q = {m["n"]: m["q"] for m in meta.values() if m.get("q")}
    q_mv, q_co = defaultdict(set), defaultdict(set)
    name_mv, name_co = defaultdict(set), defaultdict(set)
    for m in meta.values():
        for x in m.get("mv", []):
            if x in MOVE_NAMES:
                name_mv[m["n"]].add(x)
        for lab in m.get("nat", []):
            c, hist = map_country(lab, vocab)
            if c:
                name_co[m["n"]].add(c)
    q = lambda u: u.rsplit("/", 1)[-1]
    for f in sorted(glob.glob(str(RAW / "wikidata" / "details-*.json"))):
        for b in json.load(open(f))["results"]["bindings"]:
            a = q(b["a"]["value"])
            if "ml" in b:
                m = fold_movement(b["ml"]["value"])
                if m:
                    q_mv[a].add(m)
            if "cl" in b:
                c, hist = map_country(b["cl"]["value"], vocab)
                if c:
                    q_co[a].add(c)
    creator = {}
    for f in sorted(glob.glob(str(RAW / "wikidata" / "paintings-*.json"))):
        for b in json.load(open(f))["results"]["bindings"]:
            if "c" in b:
                creator["commons-" + q(b["p"]["value"])] = q(b["c"]["value"])
    return name_q, name_mv, name_co, q_mv, q_co, creator


def one(s):
    return next(iter(s)) if s and len(s) == 1 else None


def painter_majority(rows, field, labeled_ids, minn=3, share=0.8):
    by = defaultdict(Counter)
    for i in labeled_ids:
        r = rows[i]
        if r["a"] and r.get(field + "_v"):
            by[r["a"]][r[field + "_v"]] += 1
    out = {}
    for a, c in by.items():
        n = sum(c.values())
        v, k = c.most_common(1)[0]
        if n >= minn and k / n >= share:
            out[a] = (v, round(k / n, 2), n)
    return out

# ---- run 2: non-Western gate, rules, period fallback, plausibility ----
NONWEST = {"China", "India", "Japan", "Korea", "Tibet", "Iran", "Turkey", "Pakistan", "Nepal", "Thailand", "Vietnam", "Indonesia",
           "Myanmar", "Cambodia", "Sri Lanka", "Bangladesh", "Mongolia", "Afghanistan", "Uzbekistan", "Iraq", "Syria", "Lebanon",
           "Egypt", "Ethiopia", "Philippines"}
ICON_LANDS = {"Greece", "Ukraine", "Belarus", "Russia", "Georgia", "Armenia", "Romania", "Serbia", "Bulgaria"}
INDIAN_SOURCED = {"Mughal", "Rajput", "Pahari", "Kalighat", "Company School"}


def nonwest_rule(co, y):
    """Country + period -> a non-Western tradition, or None. y may be None (then only period-free countries answer)."""
    if y is None:
        return {"Tibet": "Tibetan thangka", "Ethiopia": "Ethiopian painting"}.get(co)
    if co == "Iran":
        return "Persian miniature" if 1200 <= y < 1780 else "Qajar painting" if 1780 <= y < 1925 else None
    if co in ("India", "Pakistan", "Bangladesh"):
        return "Mughal / Indian miniature" if y < 1850 else None
    if co == "Nepal":
        return "Nepalese painting" if y < 1900 else None
    if co == "Japan":
        return "Yamato-e / Muromachi painting" if 1100 <= y < 1600 else "Edo-period painting" if 1600 <= y < 1868 else "Meiji-era painting" if 1868 <= y < 1912 else None
    if co == "China":
        return "Chinese literati / court painting" if y < 1912 else None
    if co == "Korea":
        return "Korean painting" if y < 1910 else None
    if co == "Tibet":
        return "Tibetan thangka"
    if co == "Turkey":
        return "Ottoman miniature" if 1400 <= y < 1923 else "Byzantine / icon painting" if y < 1400 else None
    if co in ("Uzbekistan", "Afghanistan", "Iraq", "Syria"):
        return "Islamic miniature" if y < 1850 else None
    if co == "Ethiopia":
        return "Ethiopian painting"
    if co in ICON_LANDS and y < 1450:  # Byzantine only; post-1450 Greek/Russian work (El Greco, Klontzas) is not labeled by date
        return "Byzantine / icon painting"
    return None


# sourced movement labels that count as the same tradition when scoring the rules
RULE_EQ = {"Mughal / Indian miniature": INDIAN_SOURCED, "Persian miniature": {"Persian miniature"}, "Qajar painting": {"Qajar painting"},
           "Ukiyo-e": {"Ukiyo-e"}, "Yamato-e / Muromachi painting": {"Yamato-e"}}


QURAN = re.compile(r"qur.?an|koran|calligraph|folio of text|text page|\bsura\b", re.I)
EURO_TITLE = re.compile(r"\b(van|het|der|den|bij|gezichten?|ambassade|rivier|le|la|les|du|des|sur|und|die|das|il|di|del|della|el|los|las|"
                        r"dutch|french|european)\b", re.I)


def western_made(title, painter, own_country_share):
    """True when a row filed under an Asian country is probably a European work (Dutch/European title, or the painter's other
    rows are mostly in non-gated countries)."""
    return bool(EURO_TITLE.search(title or "")) or own_country_share is False


def skip_trad(r):
    """no Asian-tradition label for Qur'an / calligraphic leaves"""
    return bool(QURAN.search(r["t"] or ""))


def period_label(y):
    if y is None: return None
    for lim, lab in ((1400, "Medieval, before 1400"), (1500, "Late medieval, 1400s"), (1600, "Early modern, 1500s"),
                     (1700, "Early modern, 1600s"), (1800, "Early modern, 1700s"), (1850, "Early 19th century"),
                     (1900, "Late 19th century"), (1945, "Early 20th century")):
        if y < lim: return lab
    return "Later 20th century and after"


def year_ranges(rows):
    """per sourced movement: (p2, p98) of its years -- a guess outside this window (+-30 y) is dropped as implausible"""
    import numpy as np
    by = defaultdict(list)
    for r in rows.values():
        if r.get("mv_v") and r["y"] is not None: by[r["mv_v"]].append(r["y"])
    return {m: (float(np.percentile(v, 2)), float(np.percentile(v, 98))) for m, v in by.items() if len(v) >= 30}


def painter_knn(rows, E, pos, precision, k=15, seed=5):
    """Painter-level label: nearest already-labeled painters by CLIP centroid + active years + country.
    Returns (pred {painter: (label, conf, nworks, ymean, country)}, report). pred covers painters with no sourced movement."""
    import numpy as np
    rng = np.random.RandomState(seed)
    P = {}
    for i, r in rows.items():
        a = r["a"]
        if not a or re.match(r"^(unknown|anonymous|okänd|see filename|master of|school of|follower|workshop)", a, re.I): continue
        P.setdefault(a, []).append(i)
    names, cent, ym, cos_, lab, nw = [], [], [], [], [], []
    for a, L in P.items():
        ev = [np.asarray(E[pos[i]], dtype="float32") for i in L if i in pos]
        if not ev: continue
        c = np.mean(ev, 0); c /= (np.linalg.norm(c) + 1e-6)
        ys = [rows[i]["y"] for i in L if rows[i]["y"] is not None]
        cc = Counter(rows[i]["co_v"] or rows[i]["co"] for i in L if (rows[i]["co_v"] or rows[i]["co"]))
        ml = Counter(rows[i]["mv_v"] for i in L if rows[i].get("mv_v"))
        l = None
        if ml:
            v, n = ml.most_common(1)[0]
            l = v if n / sum(ml.values()) >= 0.8 else "?"
        names.append(a); cent.append(c); ym.append(float(np.mean(ys)) if ys else np.nan)
        cos_.append(cc.most_common(1)[0][0] if cc else None); lab.append(l); nw.append(len(L))
    C = np.stack(cent).astype("float32"); ym = np.array(ym); cos_ = np.array(cos_, dtype=object)
    labeled = np.array([l not in (None, "?") for l in lab]); unl = np.array([l is None for l in lab])
    cls = sorted({l for l in lab if l not in (None, "?")}); cix = {c: j for j, c in enumerate(cls)}

    def sim(ia, ib):
        S = 0.5 * (C[ia] @ C[ib].T)
        dy = np.abs(ym[ia][:, None] - ym[ib][None, :])
        S += 0.3 * np.where(np.isnan(dy), 0.45, np.exp(-np.nan_to_num(dy) / 40.0))
        S += 0.2 * (cos_[ia][:, None] == cos_[ib][None, :])
        return S

    def vote(ia, ib):
        out = []
        for s in range(0, len(ia), 1500):
            b = ia[s:s + 1500]; S = sim(b, ib)
            top = np.argsort(-S, 1)[:, :k]
            for r_, t in zip(S, top):
                w = np.zeros(len(cls)); 
                for j in t: w[cix[lab[ib[j]]]] += max(r_[j], 0) ** 3
                tot = w.sum(); out.append((int(w.argmax()), float(w.max() / tot) if tot else 0.0))
        return out

    li = np.where(labeled)[0]; perm = rng.permutation(li); ho = perm[: len(perm) // 5]; tr = perm[len(perm) // 5:]
    res = vote(ho, tr)
    truth = [cix[lab[j]] for j in ho]
    table, cutoff = [], None
    for c in [0.5, 0.6, 0.7, 0.8, 0.85, 0.9, 0.95]:
        m = [(p, t) for (p, cf), t in zip(res, truth) if cf >= c]
        if m: table.append({"cutoff": c, "coverage": round(len(m) / len(res), 3), "precision": round(sum(p == t for p, t in m) / len(m), 3), "n": len(m)})
    for t in table:
        if t["precision"] >= precision and t["n"] >= 30: cutoff = t["cutoff"]; break
    acc = sum(p == t for (p, cf), t in zip(res, truth)) / max(len(res), 1)
    rep = {"labeled_painters": int(labeled.sum()), "heldout_painters": len(ho), "unlabeled_painters": int(unl.sum()),
           "accuracy_all_heldout": round(acc, 3), "table": table, "cutoff": cutoff, "precision_target": precision}
    ui = np.where(unl)[0]
    pred = {}
    for j, (p, cf) in zip(ui, vote(ui, li)):
        pred[names[j]] = (cls[p], round(cf, 3), nw[j], None if np.isnan(ym[j]) else round(float(ym[j])), cos_[j])
    return pred, rep


def classify(name, rows, ids, vals, feats, groups, targets, minclass, epochs, precision, seed=7):
    """vals: {id: label} for labeled rows. Returns (guesses {id: (label, conf)}, report dict)."""
    import numpy as np, torch
    torch.manual_seed(seed); rng = np.random.RandomState(seed)
    lab_ids = [i for i in vals if i in feats]
    cnt = Counter(vals[i] for i in lab_ids)
    classes = sorted(c for c, n in cnt.items() if n >= minclass)
    cix = {c: k for k, c in enumerate(classes)}
    lab_ids = [i for i in lab_ids if vals[i] in cix]
    X = np.stack([feats[i] for i in lab_ids]).astype("float32")
    y = np.array([cix[vals[i]] for i in lab_ids])
    gs = sorted({groups[i] for i in lab_ids}); rng.shuffle(gs)
    held = set(gs[: int(len(gs) * 0.2)])
    te = np.array([groups[i] in held for i in lab_ids]); tr = ~te

    def fit(Xa, ya):
        d = Xa.shape[1]
        net = torch.nn.Sequential(torch.nn.Linear(d, 384), torch.nn.GELU(), torch.nn.Dropout(0.3), torch.nn.Linear(384, len(classes)))
        opt = torch.optim.AdamW(net.parameters(), 2e-3, weight_decay=1e-2)
        Xt, yt = torch.from_numpy(Xa), torch.from_numpy(ya)
        n = len(yt)
        for ep in range(epochs):
            net.train(); perm = torch.randperm(n)
            for s in range(0, n, 512):
                b = perm[s:s + 512]
                loss = torch.nn.functional.cross_entropy(net(Xt[b]), yt[b], label_smoothing=0.05)
                opt.zero_grad(); loss.backward(); opt.step()
        net.eval()
        return net

    def proba(net, Xa, T=1.0):
        out = []
        with torch.no_grad():
            for s in range(0, len(Xa), 4096):
                out.append(torch.softmax(net(torch.from_numpy(Xa[s:s + 4096])) / T, 1).numpy())
        return np.concatenate(out) if out else np.zeros((0, len(classes)))

    net = fit(X[tr], y[tr])
    P = proba(net, X[te]); yh = y[te]
    pred, conf = P.argmax(1), P.max(1)
    acc_all = float((pred == yh).mean())
    table, cutoff = [], None
    for c in [0.5, 0.6, 0.7, 0.8, 0.85, 0.9, 0.95]:
        m = conf >= c
        if m.sum():
            table.append({"cutoff": c, "coverage": round(float(m.mean()), 3), "precision": round(float((pred[m] == yh[m]).mean()), 3), "n": int(m.sum())})
    for t in table:
        if t["precision"] >= precision and t["n"] >= 50:
            cutoff = t["cutoff"]; break
    rep = {"classes": len(classes), "labeled": len(lab_ids), "heldout_rows": int(te.sum()), "heldout_painters": len(held),
           "accuracy_all_heldout": round(acc_all, 3), "majority_baseline": round(float((yh == np.bincount(y[tr]).argmax()).mean()), 3),
           "table": table, "cutoff": cutoff, "precision_target": precision}
    guesses = {}
    if cutoff is not None:
        net = fit(X, y)
        todo = [i for i in targets if i in feats]
        for s in range(0, len(todo), 20000):
            chunk = todo[s:s + 20000]
            P = proba(net, np.stack([feats[i] for i in chunk]).astype("float32"))
            for i, p in zip(chunk, P):
                k = int(p.argmax())
                if p[k] >= cutoff:
                    guesses[i] = (classes[k], round(float(p[k]), 3))
    return guesses, rep


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(ROOT / "research" / "_scratch-fill"))
    ap.add_argument("--threads", type=int, default=2)
    ap.add_argument("--epochs", type=int, default=12)
    ap.add_argument("--precision", type=float, default=0.85)
    ap.add_argument("--no-classifier", action="store_true")
    a = ap.parse_args()
    out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
    t0 = time.time()
    ids, rows = load_rows()
    N = len(rows)
    log = []
    P = lambda *s: (print(*s, flush=True), log.append(" ".join(str(x) for x in s)))

    mv_base = sum(1 for r in rows.values() if r["mv"]); co_base = sum(1 for r in rows.values() if r["co"])
    P(f"rows {N}; movement present {mv_base} ({mv_base / N:.1%}); country present {co_base} ({co_base / N:.1%})")

    fills = defaultdict(dict)
    srcn = {"mv": Counter(), "co": Counter()}
    for i, r in rows.items():
        r["mv_v"], r["co_v"] = r["mv"], (r["co"] if not r.get("coest") else None)
        if r["mv"]: srcn["mv"]["record (baseline)"] += 1
        if r["co"]: srcn["co"]["record (baseline" + (", earlier guess)" if r.get("coest") else ")")] += 1

    name_q, name_mv, name_co, q_mv, q_co, creator = wikidata_tables(rows)
    mvwd = json.loads((ROOT / "data/artists/movements-wd.json").read_text(encoding="utf-8"))

    def painter_q(r):
        return name_q.get(r["a"]) if r["a"] else None

    def put(i, f, v, src, guess=False, conf=None):
        fills[i][f] = {"v": v, "src": src, "guess": guess, **({"conf": conf} if conf is not None else {})}
        rows[i][f + "_v"] = v if not guess else rows[i].get(f + "_v")  # guesses never become training labels
        srcn[f][src] += 1

    # ---- step 1: Wikidata ----
    for i, r in rows.items():
        if not r["mv"]:
            v = mvwd["tier1"].get(i)
            if v: put(i, "mv", v, "wikidata-work"); continue
            v = mvwd["tier2"].get(i)
            if not v:
                q = painter_q(r) or creator.get(i)
                v = one(name_mv.get(r["a"], set())) or one(q_mv.get(q, set()))
            if v: put(i, "mv", v, "wikidata-painter")
        if not r["co"] or r.get("coest"):
            q = painter_q(r) or creator.get(i)
            v = one(name_co.get(r["a"], set())) or one(q_co.get(q, set()))
            if v and not r["co"]: put(i, "co", v, "wikidata-painter")

    # ---- step 2: museum country (only where it agrees with the labeled rows of that source) ----
    agree = {}
    for s, c in MUSEUM.items():
        L = [r for r in rows.values() if r["src"] == s and r["co_v"]]
        if L: agree[s] = (round(sum(1 for r in L if r["co_v"] == c) / len(L), 3), len(L))
    for i, r in rows.items():
        if not r["co"] and "co" not in fills[i] and r["src"] in MUSEUM and agree.get(r["src"], (0, 0))[0] >= 0.6:
            put(i, "co", MUSEUM[r["src"]], "museum:" + r["src"], conf=agree[r["src"]][0])

    # ---- run 2 prelude: embeddings, plausibility windows, non-Western gate ----
    import numpy as np
    E = pos = None
    if not a.no_classifier:
        eid = (RAW / "subjects" / "clip-embeds.ids.txt").read_text(encoding="utf-8").split("\n")
        E = np.load(RAW / "subjects" / "clip-embeds.npy", mmap_mode="r")
        pos = {k: j for j, k in enumerate(eid) if k and j < len(E) and k in rows}
    yr = year_ranges(rows)
    dropped = Counter()

    home = defaultdict(Counter)
    for i_, r_ in rows.items():
        c_ = r_["co_v"] or r_["co"]
        if r_["a"] and c_: home[r_["a"]]["gated" if c_ in NONWEST else "west"] += 1

    def euro_made(i):
        r_ = rows[i]; h = home.get(r_["a"]) if r_["a"] else None
        own = None if not h or sum(h.values()) < 3 else (h["gated"] >= h["west"])  # False = painter mostly works in non-gated countries
        return western_made(r_["t"], r_["a"], own)

    def cur_co(i):
        r = rows[i]
        return r["co_v"] or r["co"] or (fills[i].get("co") or {}).get("v")

    def gated(i):
        return cur_co(i) in NONWEST

    def plausible(v, i):
        y, w = rows[i]["y"], yr.get(v)
        if y is None or w is None: return True
        return w[0] - 30 <= y <= w[1] + 30

    def put_mv_guess(i, v, src, conf):
        if not plausible(v, i):
            dropped[src] += 1; return False
        put(i, "mv", v, src, True, conf); return True

    def todo(i):
        return not rows[i]["mv"] and "mv" not in fills[i]

    # ---- run 2 step 2: non-Western labels, country + period first ----
    ok = Counter()
    for i, r in rows.items():
        if todo(i):
            v = nonwest_rule(cur_co(i), r["y"])
            if v and (skip_trad(r) or (cur_co(i) in NONWEST and euro_made(i))):
                v = None
            if v:
                put(i, "mv", v, "guess:rule-country-period", True, 0.0); ok[v] += 1
    rule_eval = {}
    for rule in RULE_EQ:
        L = [(r["mv_v"]) for i, r in rows.items() if r.get("mv_v") and r["mv_v"] in set().union(*RULE_EQ.values()) and nonwest_rule(cur_co(i), r["y"]) == rule]
        if L: rule_eval[rule] = {"scored_rows": len(L), "agrees_with_sourced": round(sum(1 for x in L if x in RULE_EQ[rule]) / len(L), 3)}
    P("non-Western rule labels:", dict(ok), "scored vs sourced:", rule_eval)

    # ---- step 3a: painter majority (a flagged guess); never for gated countries ----
    for f in ("mv", "co"):
        lab = [i for i, r in rows.items() if r.get(f + "_v")]
        pm = painter_majority(rows, f, lab)
        for i, r in rows.items():
            if not r.get(f + "_v") and not r[f] and f not in fills[i] and r["a"] in pm and not re.match(r"^(unknown|anonymous|okänd|see filename)", r["a"], re.I):
                v, sh, n = pm[r["a"]]
                if f == "mv":
                    if not gated(i): put_mv_guess(i, v, "guess:painter-majority", sh)
                else:
                    put(i, f, v, "guess:painter-majority", True, sh)

    # ---- run 2 step 1: painter-level label for the long tail (kNN over labeled painters) ----
    review, knn_rep = [], None
    if E is not None:
        pred, knn_rep = painter_knn(rows, E, pos, a.precision)
        P("painter-knn:", json.dumps(knn_rep))
        cut = knn_rep["cutoff"]
        by_painter = defaultdict(list)
        for i, r in rows.items():
            if r["a"]: by_painter[r["a"]].append(i)
        applied = 0
        for name, (lab_, cf, nw_, ym_, co_) in pred.items():
            ids_ = by_painter[name]
            rule_lab = Counter(fills[i]["mv"]["v"] for i in ids_ if "mv" in fills[i] and fills[i]["mv"]["src"] == "guess:rule-country-period")
            gate = co_ in NONWEST
            passes = cut is not None and cf >= cut and nw_ >= 3 and not gate
            if passes:
                for i in ids_:
                    if todo(i) and put_mv_guess(i, lab_, "guess:painter-knn", cf): applied += 1
            if nw_ >= 12 and not any(rows[i]["mv_v"] for i in ids_):
                if gate and rule_lab:
                    pl, pc, ps = rule_lab.most_common(1)[0][0], None, "rule-country-period"
                else:
                    pl, pc, ps = lab_, cf, "painter-knn"
                review.append({"painter": name, "works": nw_, "mean_year": ym_, "country": co_, "proposed": pl, "confidence": pc,
                               "basis": ps, "meets_cutoff": bool(passes or (ps != "painter-knn" and pl))})
        review.sort(key=lambda x: -x["works"])
        review = review[:2000]
        (out / "painters-to-review.json").write_text(json.dumps(review, ensure_ascii=False, indent=0), encoding="utf-8")
        P(f"painter-knn applied to {applied} rows; review list {len(review)} painters")

    # ---- step 3b: CLIP classifier ----
    guess_info = {"painter_knn": knn_rep, "nonwest_rules_vs_sourced": rule_eval}
    if not a.no_classifier:
        import torch
        torch.set_num_threads(a.threads)
        countries = [c for c, _ in Counter(r["co_v"] or r["co"] for r in rows.values() if (r["co_v"] or r["co"])).most_common(40)]
        movs = [m for m, _ in Counter(r["mv_v"] for r in rows.values() if r["mv_v"]).most_common(40)]
        cix = {c: k for k, c in enumerate(countries)}; mix = {m: k for k, m in enumerate(movs)}

        def feat(i, with_co, with_mv):
            r = rows[i]
            e = np.asarray(E[pos[i]], dtype="float32"); e = e / (np.linalg.norm(e) + 1e-6)
            y = r["y"]
            ex = [0.0 if y is None else (y - 1500) / 400.0, 1.0 if y is None else 0.0]
            if with_co:
                oh = np.zeros(len(countries) + 1, "float32"); c = r["co_v"] or r["co"]; oh[cix.get(c, len(countries)) if c else len(countries)] = 1
                ex += list(oh)
            if with_mv:
                oh = np.zeros(len(movs) + 1, "float32"); m = r["mv_v"]; oh[mix.get(m, len(movs)) if m else len(movs)] = 1
                ex += list(oh)
            return np.concatenate([e * 4, np.array(ex, "float32")])
        groups = {i: (r["a"] or i) for i, r in rows.items()}
        have = [i for i in rows if i in pos]
        P(f"embeddings cover {len(have)} of {N} rows")
        for f, wc, wm, minc in (("mv", True, False, 150), ("co", False, True, 150)):
            feats = {i: feat(i, wc, wm) for i in have}
            vals = {i: rows[i][f + "_v"] for i in have if rows[i].get(f + "_v") and (f == "mv" or not rows[i].get("coest"))}
            targets = [i for i in have if not rows[i][f] and f not in fills[i] and not (f == "mv" and gated(i))]
            P(f"[{f}] classifier: {len(vals)} labeled, {len(targets)} to predict")
            g, rep = classify(f, rows, ids, vals, feats, groups, targets, minc, a.epochs, a.precision)
            guess_info[f] = rep
            P(f"[{f}] held-out accuracy {rep['accuracy_all_heldout']} (majority baseline {rep['majority_baseline']}); cutoff {rep['cutoff']}; table {rep['table']}")
            for i, (v, c) in g.items():
                if f == "mv": put_mv_guess(i, v, "guess:clip", c)
                else: put(i, f, v, "guess:clip", True, c)
        # non-Western, CLIP second: undated rows in gated countries, classes learned from sourced + rule labels there
        gl_ = [i for i in have if gated(i)]
        nwv = {i: (rows[i].get("mv_v") or (fills[i].get("mv") or {}).get("v")) for i in gl_}
        nwv = {i: v for i, v in nwv.items() if v}
        nw_targets = [i for i in gl_ if todo(i) and rows[i]["y"] is None and not skip_trad(rows[i]) and not euro_made(i)]
        if len({v for v in nwv.values()}) >= 2 and nw_targets:
            feats = {i: feat(i, True, False) for i in set(nwv) | set(nw_targets)}
            g, rep = classify("nw", rows, ids, nwv, feats, groups, nw_targets, 40, a.epochs, a.precision)
            guess_info["nonwest_clip"] = rep
            P(f"[nonwest clip] {len(nw_targets)} targets; held-out accuracy {rep['accuracy_all_heldout']}; cutoff {rep['cutoff']}")
            allowed = defaultdict(set)
            for i, v in nwv.items(): allowed[cur_co(i)].add(v)
            for i, (v, c) in g.items():
                if v in allowed[cur_co(i)]: put(i, "mv", v, "guess:clip-nonwest", True, c)

    # ---- run 2 step 3: broad period fallback, a separate field ("pd"), never a movement ----
    pdn = 0
    for i, r in rows.items():
        if not r["mv"] and "mv" not in fills[i]:
            lab_ = period_label(r["y"])
            if lab_:
                fills[i]["pd"] = {"v": lab_, "src": "period", "guess": True, "kind": "period"}; pdn += 1
    guess_info["dropped_implausible"] = dict(dropped)
    guess_info["period_fallback_rows"] = pdn

    # ---- report ----
    after = {f: sum(1 for i, r in rows.items() if r[f] or f in fills[i]) for f in ("mv", "co")}
    sourced = {f: sum(1 for i, r in rows.items() if r[f] or (f in fills[i] and not fills[i][f]["guess"])) for f in ("mv", "co")}
    stats = {"rows": N, "built": time.strftime("%Y-%m-%d %H:%M"), "seconds": round(time.time() - t0),
             "movement": {"before": mv_base, "after_sourced_only": sourced["mv"], "after_with_guesses": after["mv"], "by_source": dict(srcn["mv"])},
             "country": {"before": co_base, "after_sourced_only": sourced["co"], "after_with_guesses": after["co"], "by_source": dict(srcn["co"])},
             "museum_agreement": agree, "classifier": guess_info}
    stats["movement"]["with_period_fallback"] = after["mv"] + guess_info["period_fallback_rows"]
    sc = []
    for i in fills:
        g_ = fills[i].get("mv")
        if g_ and g_["guess"]:
            r = rows[i]; w = yr.get(g_["v"]); out_d = 0
            if w and r["y"] is not None: out_d = max(w[0] - r["y"], r["y"] - w[1], 0)
            sc.append((out_d - 100 * (g_.get("conf") or 0), i))
    sc.sort(reverse=True)
    samp = []
    for _, i in sc[:20]:
        r = rows[i]; g_ = fills[i]["mv"]
        samp.append({"id": i, "title": (r["t"] or "")[:60], "painter": r["a"], "year": r["y"], "country": cur_co(i), "guess": g_["v"], "src": g_["src"], "conf": g_.get("conf")})
    stats["worst_20_movement_guesses"] = samp
    prev_bad = {}
    for i in ("met-61729", "met-36159", "met-737805"):
        if i in rows: prev_bad[i] = (fills[i].get("mv") or {}).get("v") or ("(period) " + fills[i]["pd"]["v"] if "pd" in fills[i] else None)
    stats["earlier_bad_examples_now"] = prev_bad
    (out / "fills-movement-country.json").write_text(json.dumps(fills, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    (out / "stats.json").write_text(json.dumps(stats, ensure_ascii=False, indent=1), encoding="utf-8")
    lines = [f"rows {N}"]
    for f, nm in (("movement", "mv"), ("country", "co")):
        s = stats[f]
        lines += [f"{f}: before {s['before']} ({s['before'] / N:.1%}) -> sourced only {s['after_sourced_only']} ({s['after_sourced_only'] / N:.1%}) -> with guesses {s['after_with_guesses']} ({s['after_with_guesses'] / N:.1%})",
                  "  by source: " + json.dumps(s["by_source"], ensure_ascii=False)]
    lines.append("museum agreement: " + json.dumps(agree))
    lines.append("classifier: " + json.dumps(guess_info))
    lines.append("period fallback rows: %d; earlier bad examples now: %s" % (guess_info["period_fallback_rows"], prev_bad))
    lines.append("movement with period fallback: %d (%.1f%%)" % (stats["movement"]["with_period_fallback"], 100 * stats["movement"]["with_period_fallback"] / N))
    lines.append("20 worst-looking movement guesses:")
    lines += ["  " + json.dumps(s, ensure_ascii=False) for s in samp]
    (out / "report.txt").write_text("\n".join(lines), encoding="utf-8")
    P("\n".join(lines))


if __name__ == "__main__":
    main()
