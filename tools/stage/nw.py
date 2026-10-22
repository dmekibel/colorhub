"""Shared helpers for the non-Western and women-painter staging (2026-10-22). Builds on tools/stage/lib.py.
Nothing here touches data/corpus, data/gallery or index.html; output goes to data/corpus-staging/ only.

emit(key, rows, ...) takes normalized rows (id, src, t, a, y, co, mv, img, license, url, span), drops what the archive
or any other staging file already holds (id, or artist+title+year twin), rows with no usable title or no date, and
writes zz-museum-<key>-N.json (or zz-commons-<key>-N.json when kind="commons")."""
import glob
import json
import re
from collections import Counter

from lib import C, OUT, SCR, ROOT, clean, twin_key, _k  # noqa: F401

# Countries David's "non-Western" scope covers (lib.NON_WESTERN_CO plus Latin America and Indigenous Australia)
NW_CO = {"China", "Japan", "Korea", "India", "Tibet", "Nepal", "Afghanistan", "Pakistan", "Bangladesh", "Sri Lanka",
         "Thailand", "Cambodia", "Vietnam", "Indonesia", "Myanmar", "Iran", "Iraq", "Egypt", "Mongolia", "Bhutan",
         "Uzbekistan", "Laos", "Taiwan", "Syria", "Ethiopia", "Nigeria", "Kyrgyzstan", "Turkmenistan", "Tajikistan",
         "Malaysia", "Singapore", "Yemen", "Saudi Arabia", "Turkey", "Philippines", "Azerbaijan", "Armenia",
         "Georgia", "Lebanon", "Israel", "Jordan", "Morocco", "Algeria", "Tunisia", "Ghana", "Senegal", "Mali",
         "Cameroon", "Kenya", "Tanzania", "South Africa", "Zimbabwe", "Congo", "Benin", "Madagascar", "Sudan",
         "Mexico", "Peru", "Bolivia", "Ecuador", "Colombia", "Brazil", "Argentina", "Chile", "Venezuela", "Cuba",
         "Guatemala", "Haiti", "Dominican Republic", "Uruguay", "Paraguay", "Panama", "Costa Rica", "Honduras",
         "Nicaragua", "El Salvador", "Puerto Rico", "Jamaica", "Trinidad and Tobago", "Papua New Guinea",
         "Australia", "New Zealand", "Fiji", "Uganda", "Zambia", "Mozambique", "Angola", "Ivory Coast", "Burkina Faso"}

EXTRA = [(re.compile(p, re.I), c) for p, c in [
    (r"thai|siam", "Thailand"), (r"cambod|khmer|angkor", "Cambodia"), (r"vietnam|annam|tonkin", "Vietnam"),
    (r"indonesia|java|bali\b|sumatra|dutch east", "Indonesia"), (r"burma|myanmar", "Myanmar"), (r"\blaos?\b|lao ", "Laos"),
    (r"malay", "Malaysia"), (r"philipp", "Philippines"), (r"taiwan|formosa", "Taiwan"), (r"\bsyria", "Syria"),
    (r"\biraq|mesopotamia|baghdad", "Iraq"), (r"lebanon", "Lebanon"), (r"morocc", "Morocco"),
    (r"nigeria|yoruba|benin", "Nigeria"), (r"ghana|asante|ashanti", "Ghana"), (r"\bcongo", "Congo"),
    (r"south africa", "South Africa"), (r"kenya", "Kenya"), (r"tanzania", "Tanzania"), (r"zimbabwe", "Zimbabwe"),
    (r"chile", "Chile"), (r"venezuel", "Venezuela"), (r"haiti", "Haiti"), (r"dominican", "Dominican Republic"),
    (r"uruguay", "Uruguay"), (r"paraguay", "Paraguay"), (r"costa rica", "Costa Rica"), (r"panama", "Panama"),
    (r"puerto ric", "Puerto Rico"), (r"jamaica", "Jamaica"), (r"new zealand|maori", "New Zealand"),
    (r"papua", "Papua New Guinea"), (r"aborigin|torres strait", "Australia"), (r"uzbek|samarkand", "Uzbekistan"),
    (r"azerbaijan", "Azerbaijan"), (r"armenia", "Armenia"), (r"georgia \(country\)", "Georgia"),
    (r"cusco|cuzco", "Peru"), (r"bangladesh|dhaka", "Bangladesh"), (r"bhutan", "Bhutan"),
]]


def country(*texts):
    """First country any of the texts names, via corpus.py's rules, then the extra rules above."""
    for t in texts:
        if not t:
            continue
        c = C.country_of(t)
        if c:
            return c
        for rx, cc in EXTRA:
            if rx.search(t):
                return cc
    return None


_ORD = re.compile(r"(\d{1,2})(?:st|nd|rd|th)\s+century", re.I)
_QUAL = {"early": 0, "mid": 25, "middle": 25, "late": 50}


def parse_date(text):
    """(start year, span) from a free-text date ("15th century", "late 16th century", "ca. 1550", "1625-1650",
    "1700s"), or (None, None). BCE and undated dynasty names give (None, None)."""
    t = (text or "").strip()
    if not t or re.search(r"\bBCE?\b|B\.C\.", t):
        return None, None
    nums = [int(n) for n in re.findall(r"(?<!\d)(\d{4})(?!\d)", t)]
    if nums:
        if re.search(r"\b\d{4}s\b", t) and len(nums) == 1:
            return nums[0], (10 if nums[0] % 100 else 100)
        lo = nums[0]
        hi = nums[-1] if len(nums) > 1 and nums[-1] >= lo else lo
        return lo, hi - lo
    m = _ORD.search(t)
    if m:
        base = (int(m.group(1)) - 1) * 100
        q = re.search(r"\b(early|mid|middle|late)\b", t, re.I)
        if q:
            return base + _QUAL[q.group(1).lower()], 50
        return base, 100
    return None, None


def load_held(skip_files=()):
    """ids and (artist, title) -> years of data/corpus plus every other staging file (except skip_files)."""
    ids, staged, twins = set(), set(), {}

    def tw(r):
        if r.get("a") and r.get("t"):
            twins.setdefault(twin_key(r["a"], r["t"]), []).append(r.get("y"))
    for f in glob.glob(str(ROOT / "data" / "corpus" / "*.json")):
        for r in json.load(open(f)):
            ids.add(r["id"])
            tw(r)
    for f in glob.glob(str(OUT / "*.json")):
        if f.rsplit("/", 1)[1] in skip_files:
            continue
        for r in json.load(open(f)):
            staged.add(r["id"])
            tw(r)
    return ids, staged, twins


def is_twin(twins, r):
    if not (r.get("a") and r.get("t")):
        return False
    ys = twins.get(twin_key(r["a"], r["t"]))
    return bool(ys) and any(r.get("y") is None or y is None or abs(r["y"] - y) <= 3 for y in ys)


FIELDS = ("id", "src", "t", "a", "y", "co", "mv", "img", "license", "url", "span")


def emit(key, rows, kind="museum", pre_drops=None, skip_files=(), require_nw=True, extra_stats=None, replace=True):
    """Filter and write. Returns the stats dict (also saved to $STAGE_SCRATCH/stats/<kind>-<key>.json)."""
    own = tuple(p.name for p in OUT.glob(f"zz-{kind}-{key}-*.json"))   # a re-run replaces its own earlier files
    ids, staged, twins = load_held(tuple(skip_files) + own)
    nonp = C.load_nonpaintings()
    drops, out, seen, outside = Counter(pre_drops or {}), [], set(), Counter()
    for r in rows:
        if r["id"] in ids:
            drops["already in data/corpus"] += 1
            continue
        if r["id"] in staged:
            drops["already in another staging file"] += 1
            continue
        if r["id"] in seen:
            drops["duplicate id"] += 1
            continue
        if r["id"] in nonp:
            drops["hand-listed non-painting"] += 1
            continue
        seen.add(r["id"])
        r["t"] = re.sub(r"</?[a-z]+>", "", r.get("t") or "")
        if r.get("a"):
            r["a"] = re.sub(r"[⺀-鿿가-힯＀-￯]+", "", r["a"])
            r["a"] = re.sub(r"\s+", " ", r["a"]).strip(" ,;/") or None
        if (r.get("span") or 0) > 200:
            drops["date is only a period longer than 200 years"] += 1
            continue
        why = clean(r)
        if why:
            drops[why] += 1
            continue
        if r.get("y") is None:
            drops["no usable date"] += 1
            continue
        if require_nw and r.get("co") not in NW_CO:
            drops["country outside the non-Western list (or unknown)"] += 1
            outside[r.get("co")] += 1
            continue
        if is_twin(twins, r):
            drops["artist+title+year twin of a held/staged row"] += 1
            continue
        if r.get("a") and r.get("t"):
            twins.setdefault(twin_key(r["a"], r["t"]), []).append(r.get("y"))
        out.append({k: r.get(k) for k in FIELDS})
    out.sort(key=lambda r: r["id"])
    if replace:
        for old in OUT.glob(f"zz-{kind}-{key}-*.json"):
            old.unlink()
    files = []
    for i in range(0, len(out), 5000):
        p = OUT / f"zz-{kind}-{key}-{i // 5000 + 1}.json"
        p.write_text("[\n" + ",\n".join(json.dumps(r, ensure_ascii=False, separators=(",", ":")) for r in out[i:i + 5000]) + "\n]\n")
        files.append(p.name)
    st = dict(key=key, kind=kind, candidates=len(rows), new_staged=len(out), dropped=dict(drops), files=files,
              no_artist=sum(1 for r in out if not r["a"]),
              countries=dict(Counter(r["co"] for r in out).most_common(20)))
    st.update(extra_stats or {})
    if outside:
        st["outside_scope_countries"] = dict(outside.most_common(8))
    (SCR / "stats" / f"{kind}-{key}.json").write_text(json.dumps(st, indent=1))
    print(json.dumps(st, ensure_ascii=False), flush=True)
    return st
