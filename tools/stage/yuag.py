"""Yale University Art Gallery staging via LUX (Linked Art, https://lux.collections.yale.edu/api/), CC0 / Open Access data.
Search: classification "Paintings" + hasDigitalImage + member of the YUAG American / European / Modern and Contemporary
collection sets. Each hit is fetched as a Linked Art object (reduced, cached in scratch yuag_items.jsonl); each artist once
(nationality + death year, yuag_people.json). Kept: classified painting, paint medium in made_of, artist died <= 1955
(public domain gate). Image: media.collections.yale.edu thumbnail from the representation access point."""
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib import C, SCR, stage  # noqa: E402
from museums import common  # noqa: E402

B = "https://lux.collections.yale.edu/api/"
SETS = ["American Paintings and Sculpture Collection, Yale University Art Gallery",
        "European Art Collection, Yale University Art Gallery",
        "Modern and Contemporary Art Collection, Yale University Art Gallery"]
HDR = {"User-Agent": C.UA, "Accept": "application/ld+json"}
PAINT = re.compile(r"oil|tempera|watercolou?r|gouache|acrylic|encaustic|fresco|egg|casein|distemper|paint", re.I)


def get(url):
    for i in range(3):
        try:
            time.sleep(0.2)
            return json.loads(urllib.request.urlopen(urllib.request.Request(url, headers=HDR), timeout=90).read())
        except Exception as e:
            if getattr(e, "code", None) in (400, 404, 410):
                raise
            time.sleep(3 * (i + 1))
    raise RuntimeError(url)


ids = []
total = 0
for s in SETS:
    Q = {"AND": [{"classification": {"name": "Paintings"}}, {"hasDigitalImage": 1}, {"memberOf": {"name": s}}]}
    url = B + "search/item?pageLength=100&q=" + urllib.parse.quote(json.dumps(Q))
    while url:
        d = get(url)
        total += 0 if total and False else 0
        ids += [x["id"] for x in d["orderedItems"]]
        url = (d.get("next") or {}).get("id")
    print("yuag set done", s, len(ids), flush=True)
ids = list(dict.fromkeys(ids))
total = len(ids)

item_p, people_p = SCR / "yuag_items.jsonl", SCR / "yuag_people.json"
items = {}
if item_p.exists():
    for line in item_p.read_text().splitlines():
        r = json.loads(line)
        items[r["uri"]] = r
people = json.loads(people_p.read_text()) if people_p.exists() else {}
LBL = lambda o: o.get("_label")  # noqa: E731


def reduce(uri, r):
    prod = r.get("produced_by") or {}
    part = (prod.get("part") or [{}])[0]
    who = (part.get("carried_out_by") or [{}])[0]
    qual = " ".join(LBL(c) or "" for c in part.get("classified_as", []) if LBL(c) != "Primary Artist")
    ts = prod.get("timespan") or {}
    disp = next((n.get("content") for n in ts.get("identified_by", [])), None)
    yr = lambda s: int(s[:4]) if s and s[:4].lstrip("-").isdigit() else None  # noqa: E731
    acc = nid = None
    for i in r.get("identified_by", []):
        if i.get("type") == "Identifier":
            c = i.get("content") or ""
            if re.fullmatch(r"\d+", c):
                nid = c
            elif re.match(r"^\d{4}\.", c) and not acc:
                acc = c
    img = None
    for rep in r.get("representation", []):
        for dob in rep.get("digitally_shown_by", []):
            for ap in dob.get("access_point", []):
                img = img or ap.get("id")
    return dict(uri=uri, title=LBL(r), acc=acc, nid=nid, artist=LBL(who), artist_uri=who.get("id"), qual=qual,
                disp=disp, b=yr(ts.get("begin_of_the_begin")), e=yr(ts.get("end_of_the_end")), img=img,
                cls=[LBL(c) for c in r.get("classified_as", [])], mats=[LBL(m) for m in r.get("made_of", [])],
                nartists=len((prod.get("part") or [])))


def fetch_item(u):
    if u in items:
        return
    try:
        items[u] = reduce(u, get(u))
        with open(item_p, "a") as f:
            f.write(json.dumps(items[u], ensure_ascii=False) + "\n")
    except Exception as e:
        print("yuag item fail", u, e, flush=True)


with ThreadPoolExecutor(8) as ex:
    list(ex.map(fetch_item, ids))
print(f"yuag: {len(items)} items cached of {len(ids)}", flush=True)


def fetch_person(u):
    if not u or u in people:
        return
    try:
        r = get(u)
        nat = [LBL(c) for c in r.get("classified_as", [])
               if any(LBL(k) == "Nationality" for k in c.get("classified_as", []))]
        dd = ((r.get("died") or {}).get("timespan") or {}).get("end_of_the_end")
        people[u] = dict(nat=nat[0] if nat else None, dod=int(dd[:4]) if dd and dd[:4].isdigit() else None)
    except Exception as e:
        people[u] = dict(nat=None, dod=None)
        print("yuag person fail", u, e, flush=True)


with ThreadPoolExecutor(8) as ex:
    list(ex.map(fetch_person, sorted({v["artist_uri"] for v in items.values() if v.get("artist_uri")})))
people_p.write_text(json.dumps(people))

raw, pre = [], {}


def bump(k):
    pre[k] = pre.get(k, 0) + 1


for u in ids:
    v = items.get(u)
    if not v:
        bump("record not fetched")
    elif not any("painting" in (c or "").lower() for c in v["cls"]):
        bump("not classified painting")
    elif any("miniature" in (c or "").lower() for c in v["cls"]) or "ivory" in v["mats"]:
        bump("miniature")
    elif not any(PAINT.search(m or "") for m in v["mats"]):
        bump("no paint medium in made_of")
    elif not v.get("img"):
        bump("no image")
    elif not (v.get("acc") or v.get("nid")):
        bump("no accession number")
    else:
        dod = (people.get(v.get("artist_uri")) or {}).get("dod")
        if dod is None or dod > 1955:
            bump("artist living / died after 1955 / death unknown (PD gate)")
        else:
            raw.append(dict(v, id=v["acc"] or v["nid"]))


def norm(x):
    a = C.clean_artist(common.artist_name(x.get("artist"), x.get("qual") or ""))
    y, span = common.year_span(x.get("disp"), x.get("b"), x.get("e"))
    nat = (people.get(x.get("artist_uri")) or {}).get("nat")
    co = common.nationality_country(C, nat)
    return dict(id=f"yuag-{x['id']}", src="yuag", t=x.get("title"), a=a, y=y, span=span, co=co, mv=None, img=x["img"])


stage("yuag", total, raw, norm, "CC0",
      lambda x: f"https://artgallery.yale.edu/collection/object/{x['nid']}" if x.get("nid") else x["uri"], pre,
      group_cap=False)
