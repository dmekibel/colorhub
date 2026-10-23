"""Smithsonian Open Access paintings beyond SAAM / Freer|Sackler / NMAfA (2026-10-23): National Portrait Gallery (npg),
Hirshhorn (hmsg), Cooper Hewitt (chndm), Archives of American Art (aaa), NMAAHC (nmaahc), NMAH (nmah). Shards come from
tools/stage/si_shards.py. Kept: objectType Painting, a paint medium (oil, tempera, watercolor, gouache, acrylic, encaustic,
fresco), CC0 metadata and a CC0 image (the museum's own open-access statement is the public-domain gate; licence "CC0").
Image URL is ids.si.edu/ids/deliveryService?id=<idsId>&max=400 (no download).
  python3 tools/stage/si_us.py npg hmsg chndm aaa nmaahc nmah"""
import glob
import json
import re
import sys
from collections import Counter
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib import C, SCR, stage  # noqa: E402
from nw import country, parse_date  # noqa: E402
from museums import common  # noqa: E402

UNITS = sys.argv[1:] or ["npg", "hmsg", "chndm", "aaa", "nmaahc", "nmah"]
PAINT = re.compile(r"\b(oil|tempera|water-?colou?r|gouache|acrylic|encaustic|fresco|casein|egg|oil paint|distemper|polymer)\b", re.I)
BAD_MED = re.compile(r"\b(photograph|print|lithograph|etching|engraving|silhouette|cut paper|plaster|bronze|marble|ceramic|clay)\b", re.I)
QUAL = re.compile(r"^(possibly|probably|attributed to|formerly attributed to|style of|after|school of|copy after|follower of|"
                  r"workshop of|circle of|manner of|in the manner of)\b", re.I)


def fc(c, key):
    return [o.get("content") or "" for o in (c.get("freetext") or {}).get(key, [])]


def artist_of(c):
    for n in (c.get("freetext") or {}).get("name", []):
        if n.get("label") not in ("Artist", "Painter", "Maker", "Artist/Maker"):
            continue
        s = (n.get("content") or "").strip()
        if not s or QUAL.match(s) or re.search(r"unidentified|unknown|anonymous|school|workshop|studio of", s, re.I):
            continue
        name = re.split(r"\s*\(|,\s*", s)[0].strip()
        rest = s[len(name):]
        nat = None
        m = re.match(r",\s*([A-Z][A-Za-z\-]+(?: [A-Z][a-z]+)?),", rest)
        if m:
            nat = m.group(1)
        return C.clean_artist(name), nat
    return None, None


pre, out, total = Counter(), [], 0
for unit in UNITS:
    for f in sorted(glob.glob(str(SCR / "si" / unit / "*.txt"))):
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
                pre["metadata not CC0"] += 1
                continue
            media = [m for m in (d.get("online_media") or {}).get("media", []) if m.get("type") == "Images"
                     and (m.get("usage") or {}).get("access") == "CC0" and m.get("idsId")]
            if not media:
                pre["no CC0 image"] += 1
                continue
            med = " ; ".join(fc(c, "physicalDescription")[:1])
            meds = " ".join(o.get("content") or "" for o in (c.get("freetext") or {}).get("physicalDescription", [])
                            if o.get("label") == "Medium")
            if not PAINT.search(meds) or (BAD_MED.search(meds) and not re.search(r"\bon\b", meds, re.I)):
                pre["not a painting medium (drawing, print, mixed, no medium)"] += 1
                continue
            title = (d.get("title") or {}).get("content") or ""
            if C.TEXT_PAGE.search(title):
                pre["text page"] += 1
                continue
            a, nat = artist_of(c)
            dates = fc(c, "date")
            y, span = parse_date(dates[0] if dates else "")
            co = common.nationality_country(C, nat) if nat else None
            if not co:
                places = fc(c, "place") + [g.get("L2", {}).get("content") or "" for g in
                                           (c.get("indexedStructured") or {}).get("geoLocation", [])]
                co = country(*places) or "United States"
            acc = (fc(c, "identifier") or [d.get("record_ID", "")])[0]
            out.append(dict(id=f"{unit}-{acc}", src=unit, t=C.clean_title(title), a=a, y=y, span=span, co=co, mv=None,
                            img="https://ids.si.edu/ids/deliveryService?id=%s&max=400" % media[0]["idsId"],
                            url=d.get("record_link") or d.get("guid"), unit=unit))
print("painting records:", total, "kept before dedupe:", len(out), dict(Counter(r["unit"] for r in out)), flush=True)
by_url = {r["id"]: r["url"] for r in out}
rows = stage("us-si", total, [dict(r, id=r["id"]) for r in out], lambda x: {k: x[k] for k in ("id", "src", "t", "a", "y", "span", "co", "mv", "img")},
             "CC0", lambda x: x["url"], pre, group_cap=False)
print("per unit:", dict(Counter(r["src"] for r in rows)), flush=True)
