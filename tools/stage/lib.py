"""Shared staging helpers (2026-10-21): load what the archive and the other staging branch already hold, filter, dedupe
and write data/corpus-staging/zz-museum-<museum>-<n>.json (split at 5,000 rows). Never touches data/corpus or data/gallery.
Scratch (API caches) lives in $STAGE_SCRATCH/raw (corpus.py's RAW dir); delete it when done.
The three staging files of origin/staging/us-uk-cc0 (nga, saam, walters) are read from $STAGE_SCRATCH/<name>.json,
dumped there with `git show origin/staging/us-uk-cc0:data/corpus-staging/zz-museum-<name>-1.json`."""
import glob
import json
import os
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCR = Path(os.environ.get("STAGE_SCRATCH", "/private/tmp/claude-503/-Users-david-Documents-claudeCode-colorhub/"
                          "39435604-0b2d-422b-8d32-1f4c8f058381/scratchpad"))
os.environ["COLORHUB_RAW"] = str(SCR / "raw")
sys.path.insert(0, str(ROOT / "tools"))
import corpus as C  # noqa: E402

C.UA = "Chromatlas/1.0 (https://chromatlas.app; dmekibel@gmail.com)"
OUT = ROOT / "data" / "corpus-staging"
OUT.mkdir(parents=True, exist_ok=True)
(SCR / "stats").mkdir(parents=True, exist_ok=True)


NON_WESTERN_CO = {"China", "Japan", "Korea", "India", "Tibet", "Nepal", "Afghanistan", "Pakistan", "Bangladesh",
                  "Sri Lanka", "Thailand", "Cambodia", "Vietnam", "Indonesia", "Myanmar", "Burma", "Iran", "Iraq",
                  "Egypt", "Mongolia", "Bhutan", "Uzbekistan", "Laos", "Taiwan", "Syria", "Ethiopia", "Nigeria",
                  "Kyrgyzstan", "Turkmenistan", "Tajikistan", "Malaysia", "Singapore", "Yemen", "Saudi Arabia"}


def _k(s):
    return re.sub(r"[^a-z0-9]", "", (s or "").lower())


def twin_key(a, t):
    return (_k(a), _k(t))


class Held:
    """Ids and (artist, title) twins already in data/corpus and in the staging files of origin/staging/us-uk-cc0."""

    def __init__(self):
        self.ids, self.twins, self.staged_ids = set(), {}, set()
        for f in glob.glob(str(ROOT / "data" / "corpus" / "*.json")):
            for r in json.load(open(f)):
                self.ids.add(r["id"])
                self._tw(r)
        for f in ("nga", "saam", "walters"):
            p = SCR / f"{f}.json"
            if p.exists():
                for r in json.load(open(p)):
                    self.staged_ids.add(r["id"])
                    self._tw(r)
        self.nonpaint = C.load_nonpaintings()

    def _tw(self, r):
        if r.get("a") and r.get("t"):
            self.twins.setdefault(twin_key(r["a"], r["t"]), []).append(r.get("y"))

    def add_twin(self, r):
        self._tw(r)

    def is_twin(self, r):
        if not (r.get("a") and r.get("t")):
            return False
        ys = self.twins.get(twin_key(r["a"], r["t"]))
        if not ys:
            return False
        return any(r.get("y") is None or y is None or abs(r["y"] - y) <= 3 for y in ys)


def clean(r):
    """Title/date tidy. Returns a drop reason or None."""
    t = re.sub(r"\s+", " ", (r.get("t") or "")).strip()
    t = re.sub(r"\s*\((recto|verso)[^)]*\)\s*$", "", t, flags=re.I)
    if not t or re.fullmatch(r"\[?(untitled|unknown|no title)\]?", t, re.I):
        return "no usable title"
    r["t"] = C.clean_title(t)
    y = r.get("y")
    if y is not None and (y < 1000 or y > 2026):
        r["y"], r["span"] = None, None
    elif y is not None and r.get("span") is not None and (r["span"] < 0 or r["span"] > 400):
        r["span"] = None
    return None


def stage(museum, api_total, raw, norm, license, url_of, pre_drops=None, select_src=None, group_cap=True, held_pre=0):
    """raw: records (each with 'id') that passed the museum's own filter (pre_drops: Counter of what that filter
    removed). Applies corpus.py's select() (text pages, group cap, hand-listed non-paintings), then held / twin /
    clean, and writes the files."""
    held = Held()
    drops = Counter(pre_drops or {})
    if group_cap:
        sel_ids = {x["id"] for x in C.select(select_src or museum, raw)}
    else:  # a source whose ids are not leaves of books: text pages and hand-listed non-paintings only
        sel_ids = {x["id"] for x in raw if not C.TEXT_PAGE.search(x.get("title") or "")
                   and f"{museum}-{x['id']}" not in held.nonpaint}
    rows, seen_here, held_n = [], set(), held_pre
    for x in raw:
        if x["id"] not in sel_ids:
            drops["text page / group cap / hand-listed non-painting"] += 1
            continue
        r = norm(x)
        if r["id"] in held.ids:
            held_n += 1
            continue
        if r["id"] in held.staged_ids:
            drops["already in staging/us-uk-cc0"] += 1
            continue
        if r["id"] in seen_here:
            drops["duplicate id"] += 1
            continue
        seen_here.add(r["id"])
        why = clean(r)
        if why:
            drops[why] += 1
            continue
        if r.get("co") in NON_WESTERN_CO:
            drops["non-Western painting (Asian/Islamic/African), set aside"] += 1
            continue
        if held.is_twin(r):
            drops["artist+title+year twin of a held/staged row"] += 1
            continue
        held.add_twin(r)
        r["license"] = license
        r["url"] = url_of(x)
        rows.append({k: r.get(k) for k in ("id", "src", "t", "a", "y", "co", "mv", "img", "license", "url", "span")})
    rows.sort(key=lambda r: r["id"])
    for old in OUT.glob(f"zz-museum-{museum}-*.json"):
        old.unlink()
    files = []
    for i in range(0, len(rows), 5000):
        chunk = rows[i:i + 5000]
        p = OUT / f"zz-museum-{museum}-{i // 5000 + 1}.json"
        p.write_text("[\n" + ",\n".join(json.dumps(r, ensure_ascii=False, separators=(",", ":")) for r in chunk) + "\n]\n")
        files.append(p.name)
    st = dict(museum=museum, api_total=api_total, passed_museum_filter=len(raw), already_held=held_n,
              new_staged=len(rows), dropped=dict(drops), files=files,
              no_country=sum(1 for r in rows if not r["co"]), no_artist=sum(1 for r in rows if not r["a"]),
              no_year=sum(1 for r in rows if r["y"] is None),
              countries=dict(Counter(r["co"] for r in rows).most_common(12)))
    (SCR / "stats" / f"{museum}.json").write_text(json.dumps(st, indent=1))
    print(json.dumps(st), flush=True)
    return rows
