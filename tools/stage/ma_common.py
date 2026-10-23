"""Shared bits for the pre-1500 staging (2026-10-23): what is already held (data/corpus plus every staging directory of the
sibling worktrees and origin staging branches), Commons file names, writing zz-medieval-ancient-<n>.json."""
import glob, json, re, sys, urllib.parse
from collections import Counter
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib import C, OUT, SCR, ROOT, twin_key, _k

SIBLINGS = sorted(glob.glob(str(ROOT.parent / "*" / "data" / "corpus-staging" / "*.json")))
FIELDS = ("id", "src", "t", "a", "y", "co", "mv", "img", "license", "url", "span")


def fname(img):
    if not img:
        return None
    m = re.search(r"Special:FilePath/([^?]+)", img)
    if m:
        return urllib.parse.unquote(m.group(1)).replace("_", " ").lower()
    m = re.search(r"upload\.wikimedia\.org/wikipedia/commons/(?:thumb/)?[0-9a-f]/[0-9a-f]{2}/([^/]+)", img)
    return urllib.parse.unquote(m.group(1)).replace("_", " ").lower() if m else None


class Held:
    def __init__(self, key=None):
        self.ids, self.files, self.twins = set(), set(), {}
        self.src_counts = Counter()
        paths = glob.glob(str(ROOT / "data" / "corpus" / "*.json"))
        paths += [p for p in SIBLINGS if not (key and f"zz-medieval-ancient-{key}-" in p)]
        for p in paths:
            try:
                rows = json.load(open(p))
            except Exception:
                continue
            for r in rows:
                self.ids.add(r["id"])
                f = fname(r.get("img"))
                if f:
                    self.files.add(f)
                if r.get("a") and r.get("t"):
                    self.twins.setdefault(twin_key(r["a"], r["t"]), []).append(r.get("y"))
        self.nonpaint = C.load_nonpaintings()
        for p in ("nga", "saam", "walters"):
            q = SCR / f"{p}.json"
            if q.exists():
                for r in json.load(open(q)):
                    self.ids.add(r["id"])

    def twin(self, r):
        if not (r.get("a") and r.get("t")):
            return False
        ys = self.twins.get(twin_key(r["a"], r["t"]))
        return bool(ys) and any(r.get("y") is None or y is None or abs(r["y"] - y) <= 3 for y in ys)

    def add(self, r):
        self.ids.add(r["id"])
        f = fname(r.get("img"))
        if f:
            self.files.add(f)
        if r.get("a") and r.get("t"):
            self.twins.setdefault(twin_key(r["a"], r["t"]), []).append(r.get("y"))


def write(key, rows):
    for old in OUT.glob(f"zz-medieval-ancient-{key}-*.json"):
        old.unlink()
    files = []
    rows = sorted(rows, key=lambda r: r["id"])
    for i in range(0, len(rows), 5000):
        p = OUT / f"zz-medieval-ancient-{key}-{i // 5000 + 1}.json"
        p.write_text("[\n" + ",\n".join(json.dumps({k: r.get(k) for k in FIELDS}, ensure_ascii=False, separators=(",", ":"))
                                        for r in rows[i:i + 5000]) + "\n]\n")
        files.append(p.name)
    return files


_KNOWN = None
CO_MAP = [(re.compile(p, re.I), c) for p, c in [
    (r"dynasty|china|chinese", "China"), (r"aragon|castil|navarr|leon$|spain|spanish|catalon", "Spain"),
    (r"papal|florence|venice|siena|genoa|milan|naples|sicily|lombard|italy|italian|savoy|ferrara|mantua|urbino|pisa|lucca|roman republic|roman empire|ancient rome", "Italy"),
    (r"holy roman|germany|german|saxony|bavaria|prussia|bohemia", "Germany"), (r"burgundian|flanders|brabant|belgi", "Belgium"),
    (r"england|scotland|britain|united kingdom", "United Kingdom"), (r"france|french", "France"),
    (r"byzantine|ottoman|turkey", "Turkey"), (r"egypt", "Egypt"), (r"japan", "Japan"), (r"korea|goryeo|joseon", "Korea"),
    (r"persia|iran|safavid|timurid|ilkhan", "Iran"), (r"mughal|india|delhi sultanate", "India"), (r"netherlands|dutch|holland", "Netherlands"),
    (r"portug", "Portugal"), (r"russia|novgorod|muscovy|grand duchy of moscow", "Russia"), (r"poland", "Poland"), (r"hungary", "Hungary"),
    (r"serbia", "Serbia"), (r"greece|greek", "Greece"), (r"armenia", "Armenia"), (r"georgia", "Georgia"), (r"ethiopia", "Ethiopia"),
    (r"united states|usa", "United States"), (r"austria", "Austria"), (r"switzerland|swiss", "Switzerland"), (r"bulgaria", "Bulgaria"),
    (r"romania|wallachia|moldavia", "Romania"), (r"croatia|dalmatia|ragusa", "Croatia"), (r"cyprus", "Cyprus"), (r"sweden", "Sweden"),
]]


def norm_co(co):
    """Only countries the archive already uses; historic states (Yuan dynasty, Crown of Aragon ...) are mapped, anything else -> None."""
    global _KNOWN
    if co is None:
        return None
    if _KNOWN is None:
        _KNOWN = Counter(r.get("co") for f in glob.glob(str(ROOT / "data" / "corpus" / "*.json")) for r in json.load(open(f)))
    if _KNOWN.get(co, 0) >= 3:
        return co
    for rx, c in CO_MAP:
        if rx.search(co):
            return c
    return None
