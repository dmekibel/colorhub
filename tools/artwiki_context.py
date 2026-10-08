#!/usr/bin/env python3
"""ColorHub art wiki: where each painting sits, and each group's most typical painting.

  python3 tools/artwiki_context.py      (after tools/analyze.py and tools/artwiki_build.py)
      -> data/artists/context.json

What it holds (design/ARCHIVE-PAGES.md #1 and #8):
  * per painting, in gallery order, one byte each (base64): mean lightness (Lm), mean chroma (Cm), warm share
    in percent (wf / 10, rounded half up like the page), plus its country and movement as an index into the
    lists below (0 = none). These are the same numbers the painting page's Analysis tiles print, so the
    "In context" dots line up with them.
  * per decade / country / movement group (the groups js/artwiki.js has pages for): the gallery index of its most
    typical painting, found the same way tools/analyze.py finds a painter's: the painting nearest the group's
    centroid over the six z-scored palette features (lightness, chroma, warm share, vivid, muted, entropy).
Membership is re-derived exactly as tools/artwiki_build.py does (decade by year, country by the corpus field,
movement by museum tag, then Wikidata's tier 1 and tier 2), so counts match the group pages' n.
Deterministic; no network.
"""
import base64, json, sys
from collections import defaultdict
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
import gallery as GAL  # noqa: E402  load_corpus

AD = ROOT / "data" / "analysis"
OUT = ROOT / "data" / "artists"


def b64(arr):
    return base64.b64encode(bytes(int(v) for v in arr)).decode("ascii")


def main():
    corpus, _ = GAL.load_corpus()
    N = len(corpus)
    ids = (OUT / "ids.txt").read_text(encoding="utf-8").split("\n")
    assert len(ids) == N and all(a["id"] == b for a, b in zip(corpus, ids)), "ids.txt is out of step with the corpus"
    fv = np.zeros((N, 6))
    for s in range(0, N, 100):
        rows = json.loads((AD / f"paintings-{s // 100:03d}.json").read_text())
        for j, r in enumerate(rows):
            i = s + j
            assert r["id"] == ids[i], (r["id"], ids[i])
            st = r["stat"]
            fv[i] = [st["Lm"], st["Cm"], st["wf"] / 1000.0, st["ch"][2] / 1000.0, st["ch"][0] / 1000.0, st["en"] / 100.0]

    ge = json.loads((OUT / "groups-extra.json").read_text())
    wd = json.loads((OUT / "movements-wd.json").read_text()) if (OUT / "movements-wd.json").exists() else {"tier1": {}, "tier2": {}}
    dec_idx, co_idx, mv_idx = defaultdict(list), defaultdict(list), defaultdict(list)
    co_of, mv_of = [None] * N, [None] * N
    for i, x in enumerate(corpus):
        if x.get("y") is not None:
            dec_idx[str((x["y"] // 10) * 10)].append(i)
        if x.get("co"):
            co_idx[x["co"]].append(i)
            co_of[i] = x["co"]
        m = x.get("mv") or wd["tier1"].get(x["id"]) or wd["tier2"].get(x["id"])
        if m:
            mv_idx[m].append(i)
            mv_of[i] = m

    def typical(idxs):
        X = fv[idxs]
        d = np.sqrt((((X - X.mean(0)) / (X.std(0) + 1e-6)) ** 2).sum(1))
        return int(idxs[int(np.argmin(d))])

    typ = {"decade": {}, "country": {}, "movement": {}}
    for kind, src, idx in (("decade", "byDecade", dec_idx), ("country", "byCountry", co_idx), ("movement", "byMovement", mv_idx)):
        for k, g in ge[src].items():
            ii = idx.get(k) or []
            if len(ii) != g["n"]:
                print(f"warning: {kind} {k}: {len(ii)} members here, {g['n']} on the page", file=sys.stderr)
            if ii:
                typ[kind][k] = typical(ii)

    cos = sorted(ge["byCountry"].keys())
    mvs = sorted(ge["byMovement"].keys())
    coi, mvi = {c: k + 1 for k, c in enumerate(cos)}, {m: k + 1 for k, m in enumerate(mvs)}
    out = dict(v=1, n=N, co=cos, mv=mvs,
               L=b64(np.clip(np.round(fv[:, 0]), 0, 255)),
               C=b64(np.clip(np.round(fv[:, 1]), 0, 255)),
               W=b64(np.clip(np.floor(fv[:, 2] * 100 + .5), 0, 100)),
               CO=b64(coi.get(c, 0) for c in co_of),
               MV=b64(mvi.get(m, 0) for m in mv_of),
               typ=typ)
    (OUT / "context.json").write_text(json.dumps(out, separators=(",", ":"), ensure_ascii=False))
    print("context", N, "paintings;", {k: len(v) for k, v in typ.items()}, "typical paintings")


if __name__ == "__main__":
    main()
