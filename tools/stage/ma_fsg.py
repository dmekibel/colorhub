"""National Museum of Asian Art (Freer|Sackler) paintings dated before 1500 (Smithsonian Open Access shards in
$STAGE_SCRATCH/si/fsg from si_shards.py). Painting records, CC0 metadata and CC0 image; years before 1000 kept (BCE as negative);
date spans over 200 years dropped; at most GROUP_CAP leaves per album (as corpus.select).  python3 tools/stage/ma_fsg.py"""
import glob, json, re, sys
from collections import Counter
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import ma_common as M
from ma_common import C, SCR
from nw import country, parse_date

QUAL = re.compile(r"^(possibly|probably|attributed to|formerly attributed to|style of|after|school of|copy after|"
                  r"follower of|workshop of|circle of|manner of|in the manner of|related to|signed|inscribed)\b", re.I)
PRE = re.compile(r"^(possibly|probably|attributed to|signed|inscribed)( by)?\s+", re.I)


def artist(names):
    for n in names:
        if n.get("label") not in ("Artist", "Painter", "Maker", "Calligrapher", "Artist/Maker"):
            continue
        s = n.get("content") or ""
        if QUAL.match(s) and not PRE.match(s):
            continue
        s = PRE.sub("", s)
        s = re.split(r"\s*\(|\s*,\s*(?=\d)", s)[0].strip()
        if s and not re.search(r"unidentified|unknown|anonymous|school|workshop", s, re.I):
            return C.clean_artist(s)
    return None


def fc(c, key):
    return [o.get("content") or "" for o in (c.get("freetext") or {}).get(key, [])]


def date_of(text):
    """(year, span) with BCE support: '3rd century BCE', '1200 BCE', '500-300 BCE'; else nw.parse_date."""
    t = (text or "").strip()
    if re.search(r"\bBCE?\b|B\.C\.", t):
        nums = [int(n) for n in re.findall(r"(?<!\d)(\d{1,4})(?!\d)", t)]
        m = re.search(r"(\d{1,2})(?:st|nd|rd|th)\s+century", t)
        if m:
            return -(int(m.group(1)) * 100), 100
        if nums:
            lo, hi = max(nums), min(nums)
            return -lo, lo - hi
        return None, None
    return parse_date(t)


held = M.Held("fsg")
drops, out, total = Counter(), [], 0
for f in sorted(glob.glob(str(SCR / "si" / "fsg" / "*.txt"))):
    for line in open(f):
        line = line.strip()
        if not line:
            continue
        x = json.loads(line)
        c = x["content"]
        if "Painting" not in [o.get("content") for o in (c.get("freetext") or {}).get("objectType", [])]:
            continue
        total += 1
        d = c.get("descriptiveNonRepeating") or {}
        if "CC0" not in fc(c, "objectRights"):
            drops["metadata not CC0"] += 1
            continue
        media = [m for m in (d.get("online_media") or {}).get("media", []) if m.get("type") == "Images"
                 and (m.get("usage") or {}).get("access") == "CC0" and m.get("idsId")]
        if not media:
            drops["no CC0 image"] += 1
            continue
        title = (d.get("title") or {}).get("content") or ""
        if C.TEXT_PAGE.search(title):
            drops["text/calligraphy page"] += 1
            continue
        dates = fc(c, "date")
        y, span = date_of(dates[0] if dates else "")
        if y is None:
            drops["no usable date"] += 1
            continue
        if y >= 1500:
            drops["1500 or later"] += 1
            continue
        if span is not None and span > 200:
            drops["date span over 200 years"] += 1
            continue
        origin = fc(c, "place")
        cult = (c.get("indexedStructured") or {}).get("culture") or []
        geo = [g.get("L2", {}).get("content") for g in (c.get("indexedStructured") or {}).get("geoLocation", [])] + \
              [g.get("L1", {}).get("content") for g in (c.get("indexedStructured") or {}).get("geoLocation", [])]
        co = country(*origin, *[g for g in geo if g], *cult)
        mv = next((m for rx, m in C.CMA_SCHOOL if rx.search(" ".join(origin + cult))), None)
        acc = (fc(c, "identifier") or [d.get("record_ID", "")])[0]
        t = C.clean_title(title)
        if not t:
            drops["no usable title"] += 1
            continue
        out.append(dict(id=f"fsg-{acc}", src="fsg", t=t, a=artist((c.get("freetext") or {}).get("name", [])), y=y, span=span, co=co, mv=mv,
                        img="https://ids.si.edu/ids/deliveryService?id=%s&max=400" % media[0]["idsId"], license="CC0",
                        url=d.get("record_link") or d.get("guid"), _acc=acc))
print("painting records:", total, "pre-1500 candidates:", len(out), flush=True)
groups = {}
for r in out:
    acc = re.sub(r"[a-z]+(-[a-z]+)?$", "", r["_acc"].strip())
    groups.setdefault(".".join(acc.split(".")[:2]), []).append(r)
keep = []
for g in groups.values():
    g.sort(key=lambda r: r["_acc"])
    if len(g) > C.GROUP_CAP:
        drops["leaf cap (more than %d leaves of one album)" % C.GROUP_CAP] += len(g) - C.GROUP_CAP
        step = len(g) / C.GROUP_CAP
        g = [g[int(i * step)] for i in range(C.GROUP_CAP)]
    keep += g
rows = []
for r in keep:
    if r["id"] in held.ids:
        drops["already held (id)"] += 1
        continue
    if held.twin(r):
        drops["artist+title+year twin"] += 1
        continue
    held.add(r)
    rows.append(r)
files = M.write("fsg", rows)
st = dict(source="Freer|Sackler", painting_records=total, new=len(rows), drops=dict(drops), files=files)
print(json.dumps(st), flush=True)
(SCR / "stats" / "ma-fsg.json").write_text(json.dumps(st, indent=1))
