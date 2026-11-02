#!/usr/bin/env python3
"""Europeana pull (2026-10-29): Mongolia, Armenia, Uzbekistan paintings and Romanian icons -> data/corpus/zz-europeana-1.json.
Open reuse only (reusability=open; NC/ND licences rejected again here), api2demo key, 1 request/s. Row format = met_asia_extra.py's
(id, src "europeana", t, a, y, span, co, mv, img (400 px Europeana thumbnail), license, url, credit=provider · licence, p/L/C by measure_staged).
Cache: research/_scratch-met2/eu-*.jsonl. Atomic write via research/_scratch-met2/zz-europeana-1.json.tmp. Stops at 02:45.
"""
import datetime, json, re, sys, time, urllib.parse, urllib.request, urllib.error
from collections import Counter
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
SCR = ROOT / "research" / "_scratch-met2"; SCR.mkdir(parents=True, exist_ok=True)
TMP, FINAL = SCR / "zz-europeana-1.json.tmp", ROOT / "data" / "corpus" / "zz-europeana-1.json"
API = "https://api.europeana.eu/record/v2/search.json"
UA = "Chromatlas/1.0 (https://chromatlas.app; dmekibel@gmail.com)"
RIGHTS = {"publicdomain/zero": "CC0", "publicdomain/mark": "Public domain", "licenses/by-sa/4.0": "CC BY-SA 4.0", "licenses/by-sa/3.0": "CC BY-SA 3.0",
          "licenses/by/4.0": "CC BY 4.0", "licenses/by/3.0": "CC BY 3.0", "licenses/by/2.0": "CC BY 2.0"}
PAINT = re.compile(r"icon|icoan|pictur|painting|thangka|tanka|tangka|scroll|tablou|miniatur|folio|manuscript|gouache|watercolo|"
                   r"fresc|triptych|mural|album leaf|schilder|peinture|malerei|målning|måleri|sv[aä]rd", re.I)
BAD = re.compile(r"textile|țesătur|ștergar|poal|ceram|farfur|photograph|fotograf|glass negative|negativ|sculpt|skulptur|stupa|schack|"
                 r"monedă|coin|clopot|costum|covor|cămaș|herbar|specimen|botanical|map\b|hartă|musical|automat|furnitur|mobil|vas\b|"
                 r"ceașcă|bowl|cup\b|mask|statue|statuet|figurine|jewel|bijut|armour|weapon|sword|saddle|drum|boot|hat\b|dress|rug\b|"
                 r"carpet|embroider|broderi|tapestr|print\b|gravur|woodcut|postcard|carte poștal|iconostas|cruce|cross\b|"
                 r"book cover|binding|caseta|ladă|chest|tool\b|unealt|obiect de cult|veșmânt|epitrahil|brâu|ștergar", re.I)
PLACES = [("Mongolia", re.compile(r"mongol", re.I)), ("Armenia", re.compile(r"armeni|erevan|yerevan|etchmiadzin", re.I)),
          ("Uzbekistan", re.compile(r"uzbek|samarkand|bukhara|bokhara|tashkent|khiva", re.I))]
QUERIES = {  # (query, extra qf, max pages of 100)
    "Mongolia": [("thangka", [], 7), ("Mongolia painting", [], 2), ("Mongolian scroll painting", [], 2), ("Mongolia", ["DATA_PROVIDER:Museum of Far Eastern Antiquities"], 3),
                 ("Mongolia", ["DATA_PROVIDER:Museum of Ethnography"], 3), ("Mongolian painting", [], 2)],
    "Armenia": [("Armenia painting", [], 2), ("Armenian painting", [], 2), ("Armenia", [], 4), ("Armenian manuscript", [], 2)],
    "Uzbekistan": [("Uzbekistan painting", [], 2), ("Uzbekistan", [], 4), ("Samarkand painting", [], 2), ("Bukhara painting", [], 2)],
    "Romania": [("icoana", ["COUNTRY:Romania"], 75), ("icoană pe sticlă", [], 10), ("icon painting Romania", ["COUNTRY:Romania"], 10), ("icoană pe lemn", [], 20)],
}


def late():
    return datetime.time(2, 45) <= datetime.datetime.now().time() < datetime.time(12, 0)


def search(query, qf, cursor):
    p = [("wskey", "api2demo"), ("reusability", "open"), ("qf", "TYPE:IMAGE"), ("query", query), ("rows", 100), ("profile", "rich"), ("cursor", cursor)] + [("qf", x) for x in qf]
    for n in range(5):
        time.sleep(1.0)
        try:
            with urllib.request.urlopen(urllib.request.Request(API + "?" + urllib.parse.urlencode(p), headers={"User-Agent": UA}), timeout=60) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            print("HTTP", e.code, query, flush=True)
            time.sleep(60 if e.code in (429, 403) else 10)
        except Exception as e:
            print("err", type(e).__name__, flush=True); time.sleep(5 * (n + 1))
    return None


def first(x):
    return (x[0] if isinstance(x, list) and x else x) or ""


def lang(i, key):
    d = i.get(key + "LangAware") or {}
    return [v for k in ("en", "def") for v in d.get(k, [])] or i.get(key) or []


def year_of(i):
    y = first(i.get("year"))
    if str(y)[:4].isdigit():
        return int(str(y)[:4]), 0
    for t in i.get("edmTimespan") or []:
        m = re.match(r"#(-?\d{3,4})%2F(-?\d{3,4})", t)
        if m:
            a, b = int(m[1]), int(m[2]); return (a + b) // 2, b - a
    for lab in (i.get("edmTimespanLabelLangAware") or {}).get("en", []):
        m = re.match(r"(\d+)(?:st|nd|rd|th) century", lab)
        if m:
            c = int(m[1]); return (c - 1) * 100 + 50, 99
    txt = " ".join(i.get("title", []) + i.get("dcDescription", [])[:6])
    m = re.search(r"\b(?:sec(?:olul|\.)?|secolul al)\s+(X{0,2}I{0,3}V?I{0,3}X?)\b", txt)
    ROM = {"X": 10, "XI": 11, "XII": 12, "XIII": 13, "XIV": 14, "XV": 15, "XVI": 16, "XVII": 17, "XVIII": 18, "XIX": 19, "XX": 20}
    if m and m[1] in ROM:
        c = ROM[m[1]]; return (c - 1) * 100 + 50, 99
    m = re.search(r"\b(1[0-9]{3})\b", txt)
    return (int(m[1]), 0) if m else (None, 0)


def to_row(i, group):
    rights = first(i.get("rights"))
    lic = next((v for k, v in RIGHTS.items() if k in rights), None)
    if not lic or re.search(r"/(by-nc|by-nd)|nc|nd/", rights.replace("licenses/by-sa", "x")) and "publicdomain" not in rights and not lic:
        return None, "licence"
    title = first(lang(i, "dcTitle")) or first(i.get("title"))
    types = " ".join(lang(i, "dcType")); desc = " ".join(i.get("dcDescription", [])[:5])[:600]
    hay = f"{title} {types}"
    if BAD.search(hay) or not PAINT.search(f"{title} {types} {desc[:200]}"):
        return None, "not a painting (type/title filter)"
    places = " ".join(sum(((i.get("edmPlaceLabelLangAware") or {}).get(k, []) for k in ("en", "def")), []) + i.get("dctermsSpatial", []))
    co = None
    if group == "Romania":
        if first(i.get("country")) != "Romania":
            return None, "romanian query, other country"
        co = "Romania"
    else:
        ev = f"{title} {desc} {places} {types} {' '.join(lang(i, 'dcSubject'))} {' '.join(lang(i, 'dcCreator'))}"
        co = next((c for c, rx in PLACES if rx.search(ev)), None)
        if co != group:
            return None, "no evidence of " + group
    y, span = year_of(i)
    if y is None:
        return None, "no date"
    if not (1000 <= y <= 1925):
        return None, "date outside 1000-1925"
    img = first(i.get("edmPreview"))
    if not img:
        return None, "no image"
    cr = first(lang(i, "dcCreator"))
    a = re.sub(r"\s+", " ", cr).strip() if cr and not cr.startswith("http") else None
    prov = first(i.get("dataProvider")) or first(i.get("provider"))
    mv = "Icon" if group == "Romania" else ("Thangka" if re.search("thang|thank|tanka", hay, re.I) else "Scroll or album painting" if group == "Mongolia" else "Miniature")
    rid = "eu-" + i["id"].strip("/").replace("/", "_")
    return dict(id=rid, src="europeana", t=re.sub(r"\s+", " ", title).strip()[:160], a=a, y=y, span=span, co=co, mv=mv, img=img,
                license=lic, url=first(i.get("edmIsShownAt")) or first(i.get("guid")).split("?")[0], medium=None,
                credit=f"{prov} via Europeana · {lic}"), None


def main():
    seen, rows, drops, cnt = set(), [], Counter(), Counter()
    cache = SCR / "eu-items.jsonl"
    items = {}
    if cache.exists():
        for l in cache.read_text().splitlines():
            x = json.loads(l); items[(x["g"], x["i"]["id"])] = x
    out = cache.open("a")
    for group, qs in QUERIES.items():
        for query, qf, pages in qs:
            cursor = "*"
            for pg in range(pages):
                if late():
                    break
                d = search(query, qf, cursor)
                if not d or not d.get("items"):
                    break
                for i in d["items"]:
                    if (group, i["id"]) not in items:
                        items[(group, i["id"])] = dict(g=group, i=i)
                        out.write(json.dumps(dict(g=group, i=i), ensure_ascii=False) + "\n")
                cursor = d.get("nextCursor")
                if not cursor:
                    break
            out.flush()
            print(group, query, "-> total items", len(items), flush=True)
    out.close()
    for (group, iid), x in items.items():
        if iid in seen:
            continue
        r, why = to_row(x["i"], group)
        if r:
            seen.add(iid); rows.append(r); cnt[r["co"]] += 1
        else:
            drops[f"{group}: {why}"] += 1
    rows.sort(key=lambda r: r["id"])
    TMP.write_text("[\n" + ",\n".join(json.dumps(r, ensure_ascii=False, separators=(",", ":")) for r in rows) + "\n]\n")
    print(len(rows), dict(cnt), dict(drops), flush=True)
    import subprocess
    subprocess.run([sys.executable, str(ROOT / "tools" / "measure_staged.py"), "--workers", "3", "--files", str(TMP)], check=False)
    final = json.load(open(TMP))
    print("measured", sum(1 for r in final if r.get("p")), "of", len(final))
    TMP.replace(FINAL)
    print("wrote", FINAL, dict(Counter(r["co"] for r in final if r.get("p"))), flush=True)


if __name__ == "__main__":
    main()
