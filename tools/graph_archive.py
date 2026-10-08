"""Archive statistics for tools/graph_build.py: how every named color shows up in the 23,531-painting archive.

Input: the node Lab array (one row per canonical color) plus the corpus (tools/gallery.py load_corpus), each painting's
24-color pool with area shares (research/_raw/corpus-pool.jsonl) and data/analysis/paintings-*.json (per-painting accent
`acc` and hidden `hid` pool positions, positionally aligned with the corpus).

A named color "is in" a painting when one of the painting's pool colors is within CIEDE2000 <= MATCH_DE of it. Two weights:

  photo   the matched pool colors' summed area share, as photographed (aged varnish, six museum cameras).
  within  relative to the painting itself: the pool is split into role bands by lightness RANK inside the painting
          (shadow = darkest quarter of the canvas, mid, light = lightest quarter, plus accents and hidden colors from the
          analysis), and a color's within weight is the fraction of its role band it fills. A uniformly darkened or yellowed
          photograph moves the bands with it, so rank-based weight survives what raw share does not.

Presence (a painting "contains" a color) needs photo >= MIN_PHOTO and within >= MIN_WITHIN. Painter lift is computed
against the baseline of the SAME museum (each source's mean palette), so one camera's brown cannot become one painter's
"signature". Everything here is deterministic numpy; no LLM.
"""
import base64, json, math, sys
from collections import Counter
from pathlib import Path

import numpy as np
from scipy.spatial import cKDTree
from scipy import sparse

sys.path.insert(0, str(Path(__file__).resolve().parent))
import gallery as GAL  # noqa: E402
import library as LIB  # noqa: E402
from graph_color import de2000_pairs  # noqa: E402

MATCH_DE = 4.0          # a pool color within this CIEDE2000 of a named color counts as that color
MIN_PHOTO = 0.01        # at least 1% of the canvas (as photographed)
MIN_WITHIN = 0.15       # and at least 15% of its role band
ROLES = ["shadow", "mid", "light", "accent", "hidden"]
MIN_N = dict(artist=12, artist_color=4, country=25, movement=20, decade=25, century=50, source=25, pair=30, claim=5)


def find_raw_dir(root):
    for base in [root] + list(root.parents):
        d = base / "research" / "_raw"
        if (d / "corpus-pool.jsonl").exists():
            return d
    return root / "research" / "_raw"


def decode_pool(b64):
    if not b64:
        return []
    raw = base64.b64decode(b64)
    return [("#%02X%02X%02X" % (raw[i], raw[i + 1], raw[i + 2]), raw[i + 3] / 250.0) for i in range(0, len(raw) - 3, 4)]


def load_archive(root):
    corpus, _ = GAL.load_corpus()
    raw = find_raw_dir(root)
    pools = {}
    for line in (raw / "corpus-pool.jsonl").read_text(encoding="utf-8").splitlines():
        if line.strip():
            r = json.loads(line)
            pools[r["key"]] = r["pl"]
    acc, hid = [], []
    shards = sorted((root / "data" / "analysis").glob("paintings-*.json"), key=lambda p: int(p.stem.split("-")[1]))
    for f in shards:
        for rec in json.loads(f.read_text(encoding="utf-8")):
            acc.append(set(rec.get("acc") or []))
            hid.append(set(rec.get("hid") or []))
    assert len(acc) == len(corpus), (len(acc), len(corpus))
    entries = []
    for x in corpus:
        e = decode_pool(pools.get(x["id"], "")) or [(p[0], p[1]) for p in x["p"]]
        tot = sum(s for _, s in e) or 1.0
        e = [(h, s / tot) for h, s in e]
        e.sort(key=lambda t: -t[1])           # same stable order analyze.py used, so acc/hid positions line up
        entries.append(e)
    return corpus, entries, acc, hid


def roles_and_within(ent, acc, hid):
    """Per pool entry: role code 0..4 and within weight (share / its role band's share)."""
    n = len(ent)
    shares = np.array([s for _, s in ent])
    role = np.full(n, -1)
    for j in range(n):
        role[j] = 3 if j in acc else (4 if j in hid else -1)
    free = [j for j in range(n) if role[j] < 0]
    return shares, role, free


def build(root, node_labs, uniq_cache=None, verbose=True):
    corpus, entries, acc, hid = load_archive(root)
    P, N = len(corpus), len(node_labs)
    if verbose:
        print(f"archive: {P} paintings, {N} named colors")
    # ---- unique pool hexes -> Lab -> matched nodes ------------------------------------------------------------------
    hexes = sorted({h for e in entries for h, _ in e})
    hidx = {h: i for i, h in enumerate(hexes)}
    ulab = LIB.labs(hexes)
    if verbose:
        print(f"  {len(hexes)} unique pool colors")
    tn, tu = cKDTree(node_labs), cKDTree(ulab)
    coo = tn.sparse_distance_matrix(tu, 13.0, output_type="coo_matrix")
    ni, ui = coo.row, coo.col
    de = de2000_pairs(node_labs[ni], ulab[ui])
    keep = de <= MATCH_DE
    ni, ui, de = ni[keep], ui[keep], de[keep]
    order = np.argsort(ui, kind="stable")
    ni, ui, de = ni[order], ui[order], de[order]
    indptr = np.zeros(len(hexes) + 1, dtype=np.int64)
    np.add.at(indptr, ui + 1, 1)
    indptr = np.cumsum(indptr)
    if verbose:
        print(f"  {len(ni)} (pool color, named color) matches within dE {MATCH_DE}")
    # ---- per painting: roles, within weights, expand to node matches -----------------------------------------------
    out_p, out_k, out_s, out_w, out_r = [], [], [], [], []
    for p in range(P):
        ent = entries[p]
        if not ent:
            continue
        shares = np.array([s for _, s in ent])
        n = len(ent)
        role = np.full(n, -1)
        for j in acc[p]:
            if j < n:
                role[j] = 3
        for j in hid[p]:
            if j < n and role[j] < 0:
                role[j] = 4
        free = np.where(role < 0)[0]
        if len(free):
            Ls = ulab[[hidx[ent[j][0]] for j in free], 0]
            o = np.argsort(Ls, kind="stable")
            sf = shares[free][o]
            tot = sf.sum() or 1.0
            q = (np.cumsum(sf) - 0.5 * sf) / tot
            r = np.where(q < 0.25, 0, np.where(q > 0.75, 2, 1))
            role[free[o]] = r
        band = np.zeros(5)
        for c in range(5):
            band[c] = shares[role == c].sum()
        within = shares / np.maximum(band[role], 1e-9)
        ui_p = np.array([hidx[h] for h, _ in ent])
        cnt = indptr[ui_p + 1] - indptr[ui_p]
        tot = int(cnt.sum())
        if not tot:
            continue
        rep = np.repeat(np.arange(n), cnt)
        starts = np.repeat(indptr[ui_p], cnt)
        offs = np.arange(tot) - np.repeat(np.cumsum(cnt) - cnt, cnt)
        k = ni[starts + offs]
        s, w, r = shares[rep], within[rep], role[rep]
        # sum duplicates (several pool colors matching one named color); role = role of the largest contributor
        key = k.astype(np.int64)
        o = np.lexsort((s, key))
        key, s, w, r = key[o], s[o], w[o], r[o]
        first = np.concatenate(([True], key[1:] != key[:-1]))
        gi = np.cumsum(first) - 1
        S = np.bincount(gi, weights=s)
        W = np.bincount(gi, weights=w)
        last = np.concatenate((key[1:] != key[:-1], [True]))
        R = r[last]
        K = key[last]
        ok = (S >= 0.005) & ((S >= MIN_PHOTO) | (W >= MIN_WITHIN))
        if ok.any():
            out_p.append(np.full(int(ok.sum()), p, dtype=np.int32))
            out_k.append(K[ok].astype(np.int32)); out_s.append(S[ok].astype(np.float32))
            out_w.append(np.minimum(W[ok], 1.0).astype(np.float32)); out_r.append(R[ok].astype(np.int8))
    A = dict(p=np.concatenate(out_p), k=np.concatenate(out_k), s=np.concatenate(out_s), w=np.concatenate(out_w),
             r=np.concatenate(out_r))
    A["photo"] = A["s"] >= MIN_PHOTO
    A["within"] = (A["w"] >= MIN_WITHIN) & (A["s"] >= 0.005)
    if verbose:
        print(f"  {len(A['p'])} (painting, color) rows; photo-present {int(A['photo'].sum())}, within-present {int(A['within'].sum())}")
    return corpus, A


# =====================================================================================================================
# Statistics per named color
# =====================================================================================================================
def aslug(s):
    """Same slug rule as tools/analyze.py's slug(), so painter links resolve to data/analysis/artists/<slug>.json."""
    import re, unicodedata
    s = unicodedata.normalize("NFKD", str(s))
    s = "".join(ch for ch in s if not unicodedata.combining(ch)).lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-") or "unknown"


NOT_A_PAINTER = ("unknown", "anonymous", "unidentified", "various", "workshop", "school of", "circle of", "follower of",
                 "after ", "attributed", "manner of", "studio of")


def _years(corpus):
    ys = np.full(len(corpus), -1, dtype=np.int32)
    for i, x in enumerate(corpus):
        try:
            y = int(x.get("y"))
            if 700 <= y <= 2025:
                ys[i] = y
        except Exception:
            pass
    return ys


def _index(labels, min_n):
    """labels: list of hashable/None -> (idx array (-1 = too few works), sorted names)."""
    c = Counter(l for l in labels if l is not None)
    names = sorted([l for l, n in c.items() if n >= min_n])
    m = {l: i for i, l in enumerate(names)}
    return np.array([m.get(l, -1) if l is not None else -1 for l in labels], dtype=np.int32), names


def _onehot(idx, n):
    ok = np.where(idx >= 0)[0]
    return sparse.csr_matrix((np.ones(len(ok), dtype=np.float32), (ok, idx[ok])), shape=(len(idx), n))


def _top_lift(obs_in, exp_in, obs_ph, exp_ph, n_dim, min_n, min_obs, k):
    """Per column (named color): the top-k rows by within-lens lift (against the same museums' baseline), kept only
    where BOTH lenses agree and the excess over expectation is real."""
    lift_in = obs_in / (exp_in + 0.5)
    lift_ph = obs_ph / (exp_ph + 0.5)
    z = (obs_in - exp_in) / np.sqrt(exp_in + 1.0)
    ok = (n_dim[:, None] >= min_n) & (obs_in >= min_obs) & (lift_in >= 2.0) & (lift_ph >= 1.5) & (z >= 3.0)
    score = np.where(ok, lift_in, -1.0)
    res = []
    for c in range(score.shape[1]):
        col = score[:, c]
        if col.max() <= 0:
            res.append([])
            continue
        top = np.argpartition(-col, min(k, len(col) - 1))[:k]
        res.append([t for t in top[np.argsort(-col[top])] if col[t] > 0])
    return res, lift_in, lift_ph


def stats(corpus, A, N, D, verbose=True):
    """Everything per named color, in both lenses. Returns (per-color dicts, meta, raw material for superlatives)."""
    from scipy.stats import rankdata
    P = len(corpus)
    ys = _years(corpus)
    art_lab = [x.get("a") if x.get("a") and not any(b in x["a"].lower() for b in NOT_A_PAINTER) else None for x in corpus]
    art_i, art_names = _index(art_lab, MIN_N["artist"])
    co_i, co_names = _index([x.get("co") for x in corpus], MIN_N["country"])
    mv_i, mv_names = _index([x.get("mv") for x in corpus], MIN_N["movement"])
    src_i, src_names = _index([x.get("src") for x in corpus], 1)
    dec_i, dec_names = _index([int(y // 10 * 10) if y >= 0 else None for y in ys], MIN_N["decade"])
    cen_i, cen_names = _index([int(y // 100 * 100) if y >= 0 else None for y in ys], MIN_N["century"])
    p, k, s, w, r = A["p"], A["k"], A["s"], A["w"], A["r"]
    ph, wi = A["photo"], A["within"]

    def mat(mask):
        return sparse.csr_matrix((np.ones(int(mask.sum()), dtype=np.float32), (p[mask], k[mask])), shape=(P, N))
    Mph, Mwi = mat(ph), mat(wi)
    cnt_ph = np.asarray(Mph.sum(0)).ravel().astype(int)
    cnt_in = np.asarray(Mwi.sum(0)).ravel().astype(int)
    S1 = _onehot(src_i, len(src_names))
    n_src = np.asarray(S1.sum(0)).ravel()
    base_ph = (S1.T @ Mph).toarray() / np.maximum(n_src, 1)[:, None]
    base_in = (S1.T @ Mwi).toarray() / np.maximum(n_src, 1)[:, None]

    def dim(idx, names):
        O = _onehot(idx, len(names))
        nds = (O.T @ S1).toarray()
        return dict(n=np.asarray(O.sum(0)).ravel(), obs_ph=(O.T @ Mph).toarray(), obs_in=(O.T @ Mwi).toarray(),
                    exp_ph=nds @ base_ph, exp_in=nds @ base_in, names=names)
    DA, DC, DM, DD, DY = dim(art_i, art_names), dim(co_i, co_names), dim(mv_i, mv_names), dim(dec_i, dec_names), dim(cen_i, cen_names)
    ar = [dict() for _ in range(N)]
    rk = rankdata(cnt_in, method="min")
    for c in range(N):
        ar[c].update(n=int(cnt_in[c]), nph=int(cnt_ph[c]), pct=round(100 * cnt_in[c] / P, 2), pctph=round(100 * cnt_ph[c] / P, 2),
                     rk=int(rk[c]), rp=round(100 * (rk[c] - 1) / max(1, N - 1)))
    for name, Dm, minobs, kk, mn in (("pa", DA, MIN_N["artist_color"], 5, MIN_N["artist"]), ("co", DC, 6, 4, MIN_N["country"]),
                                     ("mv", DM, 5, 3, MIN_N["movement"])):
        tops, li, lp = _top_lift(Dm["obs_in"], Dm["exp_in"], Dm["obs_ph"], Dm["exp_ph"], Dm["n"], mn, minobs, kk)
        for c in range(N):
            ar[c][name] = [[Dm["names"][t], int(Dm["obs_in"][t, c]), int(Dm["n"][t]), round(float(li[t, c]), 1), round(float(lp[t, c]), 1)] for t in tops[c]]
    for c in range(N):
        col = DA["obs_in"][:, c]
        top = np.argsort(-col)[:3] if len(col) else []
        ar[c]["pn"] = [[art_names[t], int(col[t]), int(DA["n"][t]), round(float(col[t] / DA["n"][t] * 100)),
                        round(float(col[t] / (DA["exp_in"][t, c] + 0.5)), 1)] for t in top if col[t] >= MIN_N["artist_color"]]
    for name, Dm, mn in (("pd", DD, MIN_N["decade"]), ("pc", DY, MIN_N["century"])):
        for c in range(N):
            rate = Dm["obs_in"][:, c] / np.maximum(Dm["n"], 1)
            lift = Dm["obs_in"][:, c] / (Dm["exp_in"][:, c] + 0.5)
            ok = (Dm["n"] >= mn) & (Dm["obs_in"][:, c] >= MIN_N["claim"])
            if ok.any():
                t = int(np.argmax(np.where(ok, rate, -1)))
                tl = int(np.argmax(np.where(ok, lift, -1)))
                ar[c][name] = dict(y=int(Dm["names"][t]), rate=round(float(rate[t] * 100), 1), n=int(Dm["n"][t]), obs=int(Dm["obs_in"][t, c]),
                                   yl=int(Dm["names"][tl]), lift=round(float(lift[tl]), 1))
    cen_rates = DY["obs_in"] / np.maximum(DY["n"], 1)[:, None] * 100
    cen_rates_ph = DY["obs_ph"] / np.maximum(DY["n"], 1)[:, None] * 100
    cen_lift = DY["obs_in"] / (DY["exp_in"] + 0.5)
    for c in range(N):
        ar[c]["cur"] = [round(float(v), 1) for v in cen_rates[:, c]]
        ar[c]["curp"] = [round(float(v), 1) for v in cen_rates_ph[:, c]]
        ar[c]["curl"] = [round(float(v), 1) for v in cen_lift[:, c]]
    # first / last seen (photo lens, >= 2% of the canvas, dated paintings only)
    sel = ph & (s >= 0.02) & (ys[p] >= 0)
    kp, pp, yy = k[sel], p[sel], ys[p[sel]]
    o = np.lexsort((yy, kp))
    kp, pp, yy = kp[o], pp[o], yy[o]
    starts = np.searchsorted(kp, np.arange(N), "left")
    ends = np.searchsorted(kp, np.arange(N), "right")
    for c in range(N):
        a, b = starts[c], ends[c]
        if b - a >= 1:
            ar[c]["fs"] = dict(y=int(yy[a]), id=corpus[int(pp[a])]["id"], y3=int(yy[min(a + 2, b - 1)]), ly=int(yy[b - 1]),
                               lid=corpus[int(pp[b - 1])]["id"], ly3=int(yy[max(b - 3, a)]), n=int(b - a), fa=corpus[int(pp[a])].get("a"))
    # roles (within-lens rows) and the painting where each role is strongest
    role_cnt = np.zeros((N, 5))
    np.add.at(role_cnt, (k[wi], r[wi]), 1)
    rsum = np.maximum(role_cnt.sum(1), 1)
    best = {}
    for rc in range(5):
        m = wi & (r == rc)
        kk_, ww_, pp_ = k[m], w[m] + s[m] * 0.01, p[m]
        o2 = np.lexsort((ww_, kk_))
        kk_, pp_ = kk_[o2], pp_[o2]
        lastm = np.concatenate((kk_[1:] != kk_[:-1], [True])) if len(kk_) else np.array([], bool)
        best[rc] = dict(zip(kk_[lastm].tolist(), pp_[lastm].tolist()))
    for c in range(N):
        ar[c]["role"] = [round(float(role_cnt[c, j] / rsum[c] * 100)) for j in range(5)]
        ar[c]["rp_"] = {ROLES[j]: corpus[best[j][c]]["id"] for j in range(5) if c in best[j] and role_cnt[c, j] >= MIN_N["claim"]}
    # top paintings by share as photographed (with the within weight beside it)
    o3 = np.lexsort((-s, k))
    kk3, pp3, ss3, ww3, rr3 = k[o3], p[o3], s[o3], w[o3], r[o3]
    st3 = np.searchsorted(kk3, np.arange(N), "left")
    en3 = np.searchsorted(kk3, np.arange(N), "right")
    for c in range(N):
        a, b = st3[c], min(en3[c], st3[c] + 5)
        ar[c]["ap"] = [[corpus[int(pp3[j])]["id"], round(float(ss3[j] * 100), 1), ROLES[int(rr3[j])], round(float(ww3[j] * 100))] for j in range(a, b)]
    # paired with: co-occurrence lift that holds in BOTH lenses; and never-with
    Cin = (Mwi.T @ Mwi).toarray().astype(np.float32)
    Cph = (Mph.T @ Mph).toarray().astype(np.float32)
    ci, cp = cnt_in.astype(np.float32), cnt_ph.astype(np.float32)
    for c in range(N):
        if ci[c] < MIN_N["pair"]:
            ar[c]["pw"], ar[c]["nw"] = [], []
            continue
        exp_i = ci[c] * ci / P
        lift_i = Cin[c] / np.maximum(exp_i, 1e-6)
        exp_p = cp[c] * cp / P
        lift_p = Cph[c] / np.maximum(exp_p, 1e-6)
        far = D[c] > 12
        far[c] = False
        good = far & (ci >= MIN_N["pair"]) & (Cin[c] >= MIN_N["pair"]) & (lift_i >= 1.5) & (lift_p >= 1.3)
        cand = np.where(good)[0]
        cand = cand[np.argsort(-lift_i[cand])]
        chosen = []
        for j in cand:
            if all(D[j, q] >= 8 for q in chosen):
                chosen.append(j)
            if len(chosen) >= 6:
                break
        ar[c]["pw"] = [[int(j), int(Cin[c, j]), round(float(lift_i[j]), 1), round(float(lift_p[j]), 1)] for j in chosen]
        never = far & (exp_i >= 25) & (Cin[c] <= 0.15 * exp_i) & (Cph[c] <= 0.3 * exp_p)
        cand = np.where(never)[0]
        cand = cand[np.argsort(-exp_i[cand])]
        ch = []
        for j in cand:
            if all(D[j, q] >= 8 for q in ch):
                ch.append(j)
            if len(ch) >= 4:
                break
        ar[c]["nw"] = [[int(j), int(round(float(exp_i[j]))), int(Cin[c, j])] for j in ch]
    meta = dict(P=P, centuries=[int(x) for x in cen_names], cen_n=[int(x) for x in DY["n"]], decades=[int(x) for x in dec_names],
                sources={n: int(v) for n, v in zip(src_names, n_src)}, n_artists=len(art_names), countries=co_names, movements=mv_names,
                min_n=MIN_N, match_de=MATCH_DE, min_photo=MIN_PHOTO, min_within=MIN_WITHIN)
    raw = dict(cnt_in=cnt_in, cnt_ph=cnt_ph, DA=DA, DY=DY, art_names=art_names, cen_names=cen_names, src_names=src_names, ys=ys,
               base_in=base_in, base_ph=base_ph, n_src=n_src)
    return ar, meta, raw
