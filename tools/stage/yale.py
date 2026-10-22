"""Yale Center for British Art staging via LUX (Linked Art, https://lux.collections.yale.edu/api/), CC0 metadata.
Search: classification "Paintings" + hasDigitalImage + member of the YCBA "Paintings and Sculpture Collection" set
(the same classification also holds YUAG pieces and YCBA watercolours, which sit in the Prints and Drawings set).
Each hit is fetched as a Linked Art object (reduced and cached in scratch yale_items.jsonl), each artist once
(nationality, yale_people.json). Kept: classified "painting", not miniature/sculpture. Image: media.collections.yale.edu thumbnail."""
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
SET = "Paintings and Sculpture Collection, Yale Center for British Art"
Q = {"AND": [{"classification": {"name": "Paintings"}}, {"hasDigitalImage": 1}, {"memberOf": {"name": SET}}]}
HDR = {"User-Agent": C.UA, "Accept": "application/ld+json"}


def get(url):
    for i in range(3):
        try:
            time.sleep(0.15)
            return json.loads(urllib.request.urlopen(urllib.request.Request(url, headers=HDR), timeout=90).read())
        except Exception as e:
            code = getattr(e, "code", None)
            if code in (400, 404, 410):
                raise
            time.sleep(3 * (i + 1))
    raise RuntimeError(url)


ids, url = [], B + "search/item?pageLength=100&q=" + urllib.parse.quote(json.dumps(Q))
total = None
while url:
    d = get(url)
    total = d["partOf"][0].get("totalItems")
    ids += [x["id"] for x in d["orderedItems"]]
    url = (d.get("next") or {}).get("id")
print(f"yale: search total {total}, {len(ids)} ids", flush=True)

item_p, people_p = SCR / "yale_items.jsonl", SCR / "yale_people.json"
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
            elif re.match(r"^[A-Z]\d", c) and not acc:
                acc = c
    img = None
    for rep in r.get("representation", []):
        for dob in rep.get("digitally_shown_by", []):
            for ap in dob.get("access_point", []):
                img = img or ap.get("id")
    return dict(uri=uri, title=LBL(r), acc=acc, nid=nid, artist=LBL(who), artist_uri=who.get("id"), qual=qual,
                disp=disp, b=yr(ts.get("begin_of_the_begin")), e=yr(ts.get("end_of_the_end")), img=img,
                cls=[LBL(c) for c in r.get("classified_as", [])], mats=[LBL(m) for m in r.get("made_of", [])])


def fetch_item(u):
    if u in items:
        return
    try:
        items[u] = reduce(u, get(u))
        with open(item_p, "a") as f:
            f.write(json.dumps(items[u], ensure_ascii=False) + "\n")
    except Exception as e:
        print("yale item fail", u, e, flush=True)


with ThreadPoolExecutor(3) as ex:
    list(ex.map(fetch_item, ids))
print(f"yale: {len(items)} items cached", flush=True)


def fetch_person(u):
    if not u or u in people:
        return
    try:
        r = get(u)
        nat = [LBL(c) for c in r.get("classified_as", [])
               if any(LBL(k) == "Nationality" for k in c.get("classified_as", []))]
        people[u] = dict(nat=nat[0] if nat else None)
    except Exception as e:
        people[u] = dict(nat=None)
        print("yale person fail", u, e, flush=True)


with ThreadPoolExecutor(3) as ex:
    list(ex.map(fetch_person, sorted({v["artist_uri"] for v in items.values() if v.get("artist_uri")})))
people_p.write_text(json.dumps(people))

raw, pre = [], {}
for u in ids:
    v = items.get(u)
    if not v:
        pre["record not fetched"] = pre.get("record not fetched", 0) + 1
    elif "painting" not in [(c or "").lower() for c in v["cls"]]:
        pre["not classified painting (sculpture etc.)"] = pre.get("not classified painting (sculpture etc.)", 0) + 1
    elif any("miniature" in (c or "").lower() for c in v["cls"]) or "ivory" in v["mats"]:
        pre["miniature"] = pre.get("miniature", 0) + 1
    elif not v.get("img"):
        pre["no image"] = pre.get("no image", 0) + 1
    elif not (v.get("acc") or v.get("nid")):
        pre["no accession number"] = pre.get("no accession number", 0) + 1
    else:
        raw.append(dict(v, id=v["acc"] or v["nid"]))


def norm(x):
    a = C.clean_artist(common.artist_name(x.get("artist"), x.get("qual") or ""))
    y, span = common.year_span(x.get("disp"), x.get("b"), x.get("e"))
    nat = (people.get(x.get("artist_uri")) or {}).get("nat")
    co = common.nationality_country(C, nat)
    return dict(id=f"ycba-{x['id']}", src="ycba", t=x.get("title"), a=a, y=y, span=span, co=co, mv=None, img=x["img"])


stage("ycba", total, raw, norm, "CC0",
      lambda x: f"https://collections.britishart.yale.edu/catalog/tms:{x['nid']}" if x.get("nid") else x["uri"], pre,
      group_cap=False)
