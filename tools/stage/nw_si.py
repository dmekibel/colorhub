"""Smithsonian Open Access staging of non-Western paintings: National Museum of Asian Art (Freer|Sackler, unit FSG)
and National Museum of African Art (NMAfA). Shards come from tools/stage/si_shards.py. Kept: objectType Painting,
CC0 metadata (objectRights) and a CC0 image. Image URL is ids.si.edu/ids/deliveryService?id=<idsId>&max=400 (no download).
  python3 tools/stage/nw_si.py"""
import glob
import json
import re
import sys
from collections import Counter
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from nw import C, SCR, country, emit, parse_date  # noqa: E402

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


def rows_of(unit):
    for f in sorted(glob.glob(str(SCR / "si" / unit / "*.txt"))):
        for line in open(f):
            line = line.strip()
            if not line:
                continue
            x = json.loads(line)
            c = x["content"]
            if "Painting" not in [o.get("content") for o in (c.get("freetext") or {}).get("objectType", [])]:
                continue
            yield unit, x


pre, out = Counter(), []
total = 0
for unit in ("fsg", "nmafa"):
    for u, x in rows_of(unit):
        total += 1
        c = x["content"]
        d = c.get("descriptiveNonRepeating") or {}
        if "CC0" not in fc(c, "objectRights"):
            pre["metadata not CC0"] += 1
            continue
        media = [m for m in (d.get("online_media") or {}).get("media", []) if m.get("type") == "Images"
                 and (m.get("usage") or {}).get("access") == "CC0" and m.get("idsId")]
        if not media:
            pre["no CC0 image"] += 1
            continue
        title = (d.get("title") or {}).get("content") or ""
        if C.TEXT_PAGE.search(title):
            pre["text/calligraphy page"] += 1
            continue
        dates = fc(c, "date")
        y, span = parse_date(dates[0] if dates else "")
        origin = fc(c, "place")
        cult = (c.get("indexedStructured") or {}).get("culture") or []
        geo = [g.get("L2", {}).get("content") for g in (c.get("indexedStructured") or {}).get("geoLocation", [])] + \
              [g.get("L1", {}).get("content") for g in (c.get("indexedStructured") or {}).get("geoLocation", [])]
        co = country(*origin, *[g for g in geo if g], *cult)
        sch = " ".join(fc(c, "notes")[:3])
        mv = next((m for rx, m in C.CMA_SCHOOL if rx.search(" ".join(origin + cult + [sch]))), None)
        acc = (fc(c, "identifier") or [d.get("record_ID", "")])[0]
        out.append(dict(id=f"{unit}-{acc}", src=unit, t=C.clean_title(title), a=artist((c.get("freetext") or {}).get("name", [])),
                        y=y, span=span, co=co, mv=mv, title=title, accession_number=acc,
                        img="https://ids.si.edu/ids/deliveryService?id=%s&max=400" % media[0]["idsId"],
                        license="CC0", url=d.get("record_link") or d.get("guid")))
print("painting records:", total, flush=True)
from nw import NW_CO  # noqa: E402
print("not in scope:", Counter((r["co"], r["src"]) for r in out if r["co"] not in NW_CO).most_common(12), flush=True)
# leaf cap: one album / series keeps at most GROUP_CAP leaves, like corpus.select()
groups = {}
for r in out:
    acc = re.sub(r"[a-z]+(-[a-z]+)?$", "", r["accession_number"].strip())   # F1930.34.1a -> F1930.34.1
    groups.setdefault((r["src"], ".".join(acc.split(".")[:2])), []).append(r)   # same grouping corpus.py uses
keep = []
for g in groups.values():
    g.sort(key=lambda r: r["accession_number"])
    if len(g) > C.GROUP_CAP:
        pre["leaf cap (more than %d leaves of one album/series)" % C.GROUP_CAP] += len(g) - C.GROUP_CAP
        step = len(g) / C.GROUP_CAP
        g = [g[int(i * step)] for i in range(C.GROUP_CAP)]
    keep += g
for r in keep:
    r.pop("title"); r.pop("accession_number")
emit("freer-sackler", keep, pre_drops=pre, extra_stats=dict(api_total=total))
