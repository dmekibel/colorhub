"""Final pass over data/corpus-staging/zz-medieval-ancient-*.json (before measuring): drop manuscript leaves and objects that
slipped through (boxes, hypocephali, psalter pages, Decameron illustrations ...), blank junk artist strings, fill a missing
country from the artist's country elsewhere in data/corpus (most common value, only when >= 3 corpus rows agree at 80%),
and write the drop counts to $STAGE_SCRATCH/stats/ma-finalize.json.  python3 tools/stage/ma_finalize.py"""
import glob, json, re, sys
from collections import Counter, defaultdict
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from ma_common import ROOT, OUT, SCR

OBJ = re.compile(r"\b(box|hypocephalus|cartonnage|mummy case|mask|shabti|canopic|ostracon|ostraca|amulet|scarab|jar|bowl|plate|dish|"
                 r"cup|lamp|tile|brick|bag|garment|shroud|pectoral|chest|table|stool|chair|bed)\b", re.I)
MS = re.compile(r"psaltir|psalter|kalpasutra|kalpa sutra|d[ée]cam[ée]ron|chronik|chronicle|pri[èe]res|maq[âa]m[âa]t|livre|manuscrit|"
                r"book of hours|heures|breviar|missal|gospel book|evangeli|codex|\bfol\b|folio|bible|\bms\b|\bmss\b|\bcod\.|haggadah|"
                r"shahnama|shahnameh|khamsa|manafi|hamzanama|cantigas|apocalypse of|beatus|roman de|speculum|\bleaf\b|\bleaves\b", re.I)
BADA = re.compile(r"photo|unk+nown|;|\bcirca\b|\bcopy\b|\d{3,4}|artist\b.*\bartist|anonymous|^master$|attributed|manner of|studio of", re.I)

amap = defaultdict(Counter)
for f in glob.glob(str(ROOT / "data" / "corpus" / "*.json")):
    for r in json.load(open(f)):
        if r.get("a") and r.get("co"):
            amap[r["a"]][r["co"]] += 1
infer = {}
for a, c in amap.items():
    top, n = c.most_common(1)[0]
    if sum(c.values()) >= 3 and n / sum(c.values()) >= 0.8:
        infer[a] = top

drops, filled, kept = Counter(), 0, Counter()
for f in sorted(glob.glob(str(OUT / "zz-medieval-ancient-*.json"))):
    rows = json.load(open(f))
    out = []
    for r in rows:
        t = r["t"]
        if MS.search(t) and r["id"].startswith(("cf-", "commonscc-")) or (MS.search(t) and re.search(r"\bfol\b|folio|codex|psalter|psaltir|d[ée]cam[ée]ron", t, re.I)):
            drops["manuscript leaf / book illustration"] += 1
            continue
        if OBJ.search(t):
            drops["title names an object (box, mask, jar ...)"] += 1
            continue
        if r["a"] and (BADA.search(r["a"]) or len(r["a"]) > 60):
            r["a"] = None
        if not r["co"] and r["a"] in infer:
            r["co"] = infer[r["a"]]
            filled += 1
        out.append(r)
    kept[f.rsplit("/", 1)[1]] = len(out)
    Path(f).write_text("[\n" + ",\n".join(json.dumps(r, ensure_ascii=False, separators=(",", ":")) for r in out) + "\n]\n")
st = dict(drops=dict(drops), country_filled_from_artist=filled, kept=dict(kept))
(SCR / "stats" / "ma-finalize.json").write_text(json.dumps(st, indent=1))
print(json.dumps(st))
