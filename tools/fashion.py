#!/usr/bin/env python3
"""ColorHub fashion archive: garments and textiles from museum open-access APIs, each with a 6-color palette.
Re-runnable and resumable; every network step caches in research/_raw/fashion/ (gitignored).

  python3 tools/fashion.py ids          # 1. run the Met search queries -> research/_raw/fashion/met/ids.json
  python3 tools/fashion.py meta         # 2. fetch Met object records (one JSON per object) + CMA textile metadata
  python3 tools/fashion.py images [srcs] # 3. download one small image per kept record (skips cached ones)
  python3 tools/fashion.py palettes     # 4. 6-color k-means palette per image (studio backdrop masked out)
  python3 tools/fashion.py build        # 5. write data/fashion/garments.json
  python3 tools/fashion.py sheet [N] [out.png] [seed]   # contact sheet: image | backdrop mask | palette
  python3 tools/fashion.py figs         # photographs for the fashion pages -> data/images.js (own block only)
  python3 tools/fashion.py check        # gate for the fashion pages (sections, links, images) and garments.json
  python3 tools/fashion.py all          # 1-5 in order

Sources (no API key, no account; public-domain / CC0 images only):
  met = The Metropolitan Museum of Art Collection API  https://metmuseum.github.io/  (v1.1 search, then /objects/{id};
        kept only when isPublicDomain is true and primaryImageSmall exists). The Met asks for <= 80 requests a second;
        this runs one thread with a 2 s gap, pausing 10 minutes on any 403 from its bot shield.
  cma = Cleveland Museum of Art Open Access API  https://openaccess-api.clevelandart.org/  (type Textile, cc0,
        has_image). About 2 requests a second.
  aic = Art Institute of Chicago API  https://api.artic.edu/docs/  (artwork types Textile and Costume and
        Accessories, is_public_domain, has image). Metadata in pages of 100. OFF (USE_AIC): its IIIF image server
        now meets scripts with a Cloudflare bot challenge, which this tool does not try to get past.
  Skipped: Rijksmuseum (its open search returns Linked Art records without a simple image field; not worth a
  scraper), Cooper Hewitt and the Smithsonian (need an API key), LACMA (no public API any more).

Every request sends the User-Agent "ColorHubBot/1.0 (https://github.com/dmekibel/colorhub)".

Palette method (step 4), reusing tools/corpus.py: the image is trimmed of uniform border bands (corpus.autotrim),
reduced to 120px on the long side by area averaging and converted to CIELAB. Garment photographs are mostly a dress
on a form against a flat studio backdrop (white, grey or black paper, often with a soft gradient). The backdrop is
estimated from the image border and masked out before k-means (see backdrop() below): if the outer ring of pixels is
flat, a region is grown inward from the ring through pixels that are both close to their neighbor (a smooth backdrop
gradient) and close to the ring's median color. Textiles shot edge to edge have a busy ring and get no mask. Then
k-means as in corpus.py (k=6, a* b* weighted 1.5 for clustering only). Each color is named twice: the closest of the
app's 101 names (CIEDE2000) and the closest name in data/library.json (2,700 names, crude ones excluded).
"""
import io, json, math, random, re, sys, threading, time, urllib.parse, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))
import corpus as C  # noqa: E402  (color math, autotrim, kmeans, app_names)

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "research" / "_raw" / "fashion"
OUT = ROOT / "data" / "fashion"
UA = "ColorHubBot/1.0 (https://github.com/dmekibel/colorhub)"
MET = "https://collectionapi.metmuseum.org/public/collection"
IMG_SIDE = 240
# Minimum gap between request starts per host, shared by all threads. The Met's API answers in 1-2 s, so a few
# threads may run at once (WORKERS). The Met documents 80 requests a second, but its bot shield answered 403 to six
# parallel threads and, later, to two; so the Met runs one thread with a 2 s gap (images 1 s).
GAP = {"met": 2.0, "metimg": 1.0, "cma": 0.5, "cmaimg": 0.4, "aic": 1.0, "aicimg": 1.0, "commons": 0.5}
WORKERS = {"met": 1, "cma": 2, "aic": 1}
_last = defaultdict(float)
_lock = threading.Lock()


def _slot(kind):
    while True:
        with _lock:
            wait = GAP[kind] - (time.time() - _last[kind])
            if wait <= 0:
                _last[kind] = time.time()
                return
        time.sleep(wait)


def fetch(kind, url, binary=False, tries=5):
    for i in range(tries):
        _slot(kind)
        try:
            req = urllib.request.Request(urllib.parse.quote(url, safe=":/?=&%#,;+@"), headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=60) as r:
                out = r.read()
            return out if binary else json.loads(out.decode("utf-8"))
        except urllib.error.HTTPError as e:
            if e.code in (400, 403, 404, 410):
                raise
            back = 15 * (i + 1) if e.code == 429 else 4 * (i + 1)
            print(f"   {kind} HTTP {e.code}; retry in {back}s", flush=True)
            time.sleep(back)
        except (urllib.error.URLError, TimeoutError, ConnectionError, OSError) as e:
            print(f"   {kind} fetch failed ({e}); retry in {4 * (i + 1)}s", flush=True)
            time.sleep(4 * (i + 1))
    raise RuntimeError(f"could not fetch {url}")


# ---------------------------------------------------------------------------------------------
# Step 1: Met searches. (group hint, query params, how many ids to take). The group hint only breaks ties;
# each record's culture field decides its group in build().
# ---------------------------------------------------------------------------------------------
QUERIES = [
    # Western dress, The Costume Institute (dept 8). Most 20th-century pieces are not public domain and drop out.
    ("western", dict(q="dress", departmentId=8, dateBegin=1500, dateEnd=1925), 800),
    ("western", dict(q="robe a la francaise", departmentId=8, dateBegin=1500, dateEnd=1925), 120),
    ("western", dict(q="evening dress", departmentId=8, dateBegin=1500, dateEnd=1925), 250),
    ("western", dict(q="coat", departmentId=8, dateBegin=1500, dateEnd=1925), 300),
    ("western", dict(q="waistcoat", departmentId=8, dateBegin=1500, dateEnd=1925), 200),
    ("western", dict(q="bodice", departmentId=8, dateBegin=1500, dateEnd=1925), 200),
    ("western", dict(q="shawl", departmentId=8, dateBegin=1500, dateEnd=1925), 150),
    ("western", dict(q="suit", departmentId=8, dateBegin=1500, dateEnd=1925), 150),
    ("western", dict(q="mourning", departmentId=8, dateBegin=1500, dateEnd=1925), 80),
    ("western", dict(q="wedding", departmentId=8, dateBegin=1500, dateEnd=1925), 100),
    ("western", dict(q="mantle", departmentId=8, dateBegin=1500, dateEnd=1925), 100),
    ("western", dict(q="cape", departmentId=8, dateBegin=1500, dateEnd=1925), 100),
    ("western", dict(q="uniform", departmentId=8, dateBegin=1500, dateEnd=1925), 60),
    ("western", dict(q="textile", departmentId=12), 200),
    # Japan
    ("japan", dict(q="kimono"), 300),
    ("japan", dict(q="kosode"), 150),
    ("japan", dict(q="uchikake"), 60),
    ("japan", dict(q="noh costume"), 120),
    ("japan", dict(q="katabira"), 60),
    # China
    ("china", dict(q="dragon robe"), 200),
    ("china", dict(q="robe", geoLocation="China"), 200),
    ("china", dict(q="rank badge"), 80),
    ("china", dict(q="jacket", geoLocation="China"), 80),
    ("china", dict(q="textile", geoLocation="China"), 150),
    ("korea", dict(q="textile", geoLocation="Korea"), 40),
    # India and South Asia
    ("india", dict(q="sari"), 200),
    ("india", dict(q="chintz"), 80),
    ("india", dict(q="palampore"), 40),
    ("india", dict(q="shawl", geoLocation="India"), 150),
    ("india", dict(q="textile", geoLocation="India"), 200),
    ("india", dict(q="coat", geoLocation="India"), 60),
    # West and Central Africa
    ("africa", dict(q="kente"), 200),
    ("africa", dict(q="adire"), 10),
    ("africa", dict(q="adinkra"), 40),
    ("africa", dict(q="wrapper", departmentId=5), 150),
    ("africa", dict(q="textile", geoLocation="Ghana"), 60),
    ("africa", dict(q="textile", geoLocation="Nigeria"), 120),
    ("africa", dict(q="textile", geoLocation="Mali"), 60),
    ("africa", dict(q="textile", geoLocation="Sierra Leone"), 40),
    ("africa", dict(q="textile", geoLocation="Democratic Republic of the Congo"), 80),
    ("africa", dict(q="cloth", departmentId=5), 200),
    ("africa", dict(q="robe", departmentId=5), 120),
    # Indonesia and Southeast Asia
    ("seasia", dict(q="batik"), 120),
    ("seasia", dict(q="ikat"), 200),
    ("seasia", dict(q="sarong"), 120),
    ("seasia", dict(q="textile", geoLocation="Indonesia"), 200),
    ("seasia", dict(q="textile", geoLocation="Philippines"), 60),
    # The Americas
    ("americas", dict(q="tunic", departmentId=5), 250),
    ("americas", dict(q="mantle", departmentId=5), 150),
    ("americas", dict(q="textile", geoLocation="Peru"), 200),
    ("americas", dict(q="poncho"), 60),
    ("americas", dict(q="huipil"), 10),
    ("americas", dict(q="textile", geoLocation="Guatemala"), 60),
    ("americas", dict(q="textile", geoLocation="Mexico"), 80),
    ("americas", dict(q="blanket", departmentId=5), 80),
    ("americas", dict(q="dress", departmentId=5), 120),
    # Middle East, North Africa, Central Asia (Islamic Art dept 14)
    ("mideast", dict(q="textile", departmentId=14), 250),
    ("mideast", dict(q="kaftan"), 60),
    ("mideast", dict(q="robe", departmentId=14), 80),
    ("mideast", dict(q="ikat", departmentId=14), 60),
]


def met_ids():
    d = RAW / "met"
    d.mkdir(parents=True, exist_ok=True)
    out = []
    for group, params, cap in QUERIES:
        got, off = [], 0
        while len(got) < cap:
            p = dict(params, hasImages="true", offset=off, limit=min(500, cap - len(got)))
            r = fetch("met", f"{MET}/v1.1/search?{urllib.parse.urlencode(p)}")
            ids = r.get("objectIDs") or []
            got += ids
            if len(ids) < p["limit"] or off + len(ids) >= r.get("total", 0):
                break
            off += len(ids)
        print(f"met ids {group:9s} {params}: {len(got)}", flush=True)
        out.append(dict(group=group, params=params, ids=got))
    (d / "ids.json").write_text(json.dumps(out))


def met_meta():
    d = RAW / "met" / "obj"
    d.mkdir(parents=True, exist_ok=True)
    qs = json.loads((RAW / "met" / "ids.json").read_text())
    # Round-robin over the queries, so a partial run is still balanced across cultures. Cached records are skipped;
    # cached errors (403/5xx) are retried.
    seen, todo = set(), []
    lists = [list(q["ids"]) for q in qs]
    while any(lists):
        for lst in lists:
            if lst:
                i = lst.pop(0)
                if i in seen:
                    continue
                seen.add(i)
                f = d / f"{i}.json"
                if f.exists():
                    err = json.loads(f.read_text()).get("_error") or ""
                    if err and "404" not in err:
                        f.unlink()
                if not f.exists():
                    todo.append(i)
    print(f"met meta: {len(seen)} ids, {len(todo)} to fetch", flush=True)
    t0 = time.time()
    # The Met's bot shield (Incapsula) answers 403 when a client asks too fast. One thread, a 2 s gap; on a 403,
    # wait 10 minutes and try again; after three 403 pauses in a row, stop (rerun later to resume).
    blocked = 0
    for n, i in enumerate(todo):
        if n % 100 == 0:
            print(f"met meta {n + 1}/{len(todo)}  {(time.time() - t0) / 60:.1f} min", flush=True)
        while True:
            try:
                r = fetch("met", f"{MET}/v1/objects/{i}")
                blocked = 0
                break
            except urllib.error.HTTPError as e:
                if e.code == 403:
                    blocked += 1
                    if blocked > 3:
                        print("met meta: still blocked after three pauses; stopping. Rerun later.", flush=True)
                        return
                    print(f"   403 at {i}; pausing 10 min ({blocked}/3)", flush=True)
                    time.sleep(600)
                    continue
                r = {"objectID": i, "_error": str(e)[:200]}
                break
            except Exception as e:
                r = {"objectID": i, "_error": str(e)[:200]}
                break
        keep = {k: r.get(k) for k in ["objectID", "isPublicDomain", "primaryImageSmall", "title", "objectName", "culture",
                                      "period", "dynasty", "country", "region", "objectDate", "objectBeginDate",
                                      "objectEndDate", "medium", "classification", "department", "objectURL",
                                      "artistDisplayName", "artistRole", "creditLine", "accessionNumber", "_error"]}
        (d / f"{i}.json").write_text(json.dumps(keep, ensure_ascii=False))


CMA_FIELDS = "id,accession_number,title,creation_date,creation_date_earliest,creation_date_latest,culture,technique," \
             "type,department,url,images,creators"


def cma_meta():
    d = RAW / "cma"
    d.mkdir(parents=True, exist_ok=True)
    if (d / "meta.json").exists():
        return
    rows, skip = [], 0
    while True:
        q = urllib.parse.urlencode({"type": "Textile", "cc0": 1, "has_image": 1, "limit": 100, "skip": skip, "fields": CMA_FIELDS})
        r = fetch("cma", f"https://openaccess-api.clevelandart.org/api/artworks/?{q}")
        rows += r["data"]
        total = r["info"]["total"]
        print(f"cma meta {len(rows)} of {total}", flush=True)
        skip += 100
        if skip >= total or not r["data"]:
            break
    for x in rows:
        im = x.get("images") or {}
        x["images"] = {"web": im.get("web")}
    (d / "meta.json").write_text(json.dumps({"fetched": date.today().isoformat(), "rows": rows}, ensure_ascii=False))


# The AIC's IIIF image server now answers scripts with a Cloudflare bot challenge (HTTP 403, cf-mitigated: challenge,
# checked 2026-10-07), so its images can't be analyzed and hotlinks may fail too. AIC is off until that changes.
USE_AIC = False
AIC_FIELDS = ["id", "title", "place_of_origin", "date_display", "date_start", "date_end", "artwork_type_title",
              "medium_display", "department_title", "image_id", "thumbnail", "artist_title", "main_reference_number"]


def aic_meta():
    """Art Institute of Chicago: every public-domain textile and costume with an image. The search endpoint stops
    at 1,000 results, so this pages by id ("id > last id seen"), as tools/corpus.py does. ~1 request a second."""
    d = RAW / "aic"
    d.mkdir(parents=True, exist_ok=True)
    if (d / "meta.json").exists():
        return
    must = [{"term": {"is_public_domain": True}}, {"exists": {"field": "image_id"}},
            {"terms": {"artwork_type_title.keyword": ["Textile", "Costume and Accessories"]}}]
    rows, last = [], 0
    while True:
        body = json.dumps({"query": {"bool": {"must": must + [{"range": {"id": {"gt": last}}}]}}, "fields": AIC_FIELDS,
                           "limit": 100, "page": 1, "sort": [{"id": "asc"}]}).encode()
        _slot("aic")
        req = urllib.request.Request("https://api.artic.edu/api/v1/artworks/search", data=body,
                                     headers={"User-Agent": UA, "AIC-User-Agent": UA, "Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=90) as r:
            res = json.loads(r.read())
        rows += res["data"]
        print(f"aic meta {len(rows)} of ~{res['pagination']['total'] + len(rows) - len(res['data'])}", flush=True)
        if len(res["data"]) < 100:
            break
        last = res["data"][-1]["id"]
    for x in rows:
        x.pop("_score", None)
        t = x.get("thumbnail") or {}
        x["thumbnail"] = {"width": t.get("width"), "height": t.get("height"), "alt_text": t.get("alt_text")}
    (d / "meta.json").write_text(json.dumps({"fetched": date.today().isoformat(), "rows": rows}, ensure_ascii=False))


def aic_iiif(image_id, w):
    return f"https://www.artic.edu/iiif/2/{image_id}/full/{w},/0/default.jpg"


# ---------------------------------------------------------------------------------------------
# Classification: culture group and keep / drop
# ---------------------------------------------------------------------------------------------
GROUPS = [  # key, label (order = display order)
    ("western", "Europe and North America"), ("japan", "Japan"), ("china", "China"), ("korea", "Korea"),
    ("india", "India and South Asia"), ("seasia", "Indonesia and Southeast Asia"), ("mideast", "Middle East, North Africa and Central Asia"),
    ("africa", "Sub-Saharan Africa"), ("americas", "Indigenous Americas and Latin America"),
]
GROUP_RX = [(g, re.compile(p, re.I)) for g, p in [
    ("americas", r"native american|navajo|din[eé]\b|lakota|sioux|cheyenne|crow\b|plains|cree|ojibwa|seminole|tlingit|"
                 r"inuit|apache|pueblo|hopi|peru|andean|paracas|nasca|nazca|wari|inca|chim[uú]|chancay|moche|"
                 r"mexic|guatemal|maya|bolivia|ecuador|colombia|panama|kuna|aymara|quechua|aztec|huari|tiwanaku"),
    ("japan", r"japan|ainu|ryukyu|okinawa"),
    ("china", r"chin(a|ese)|tibet|manchu|qing|ming dynasty"),
    ("korea", r"korea"),
    ("india", r"india|pakistan|kashmir|bangladesh|sri lanka|mughal|gujarat|coromandel|bengal|rajasthan|deccan|punjab|"
              r"nepal|bhutan|sindh|\bsikh"),
    ("seasia", r"indonesia|java|sumatra|bali|sumba|borneo|dayak|toraja|malay|philippin|thai|burm|myanmar|cambod|"
               r"khmer|lao|vietnam|timor|flores|sulawesi|lampung|batak|palembang|iban"),
    ("mideast", r"iran|persia|ottoman|turk|syria|egypt|coptic|uzbek|bukhara|central asia|morocc|islamic|caucas|"
                r"armenia|azerbai|iraq|mamluk|safavid|qajar|yemen|tunisia|algeria|afghan|palestin|levant|spain, (nasrid|islamic)|"
                r"sasanian|byzantine"),
    ("africa", r"ghana|asante|ashanti|ewe\b|nigeria|yoruba|igbo|hausa|mali\b|bamana|dogon|senegal|wolof|sierra leone|"
               r"mende|liberia|ivory coast|c[oô]te d|baule|burkina|guinea|benin|togo|fon\b|cameroon|bamileke|kuba|congo|"
               r"kongo|zaire|ethiopia|kenya|maasai|zulu|xhosa|south africa|madagascar|sudan|tuareg|fulani|africa"),
    ("western", r"american|british|english|scottish|irish|french|italian|spanish|german|dutch|flemish|belgian|austrian|"
                r"swiss|swedish|danish|norwegian|russian|polish|hungarian|czech|europe|portuguese|greek|venetian|canadian|"
                r"australian|united states|england|france|italy|spain|netherlands|germany"),
]]

DROP_NAME = re.compile(r"\b(shoes?|boots?|slippers?|pumps?|sandals?|mules?|clogs?|hat|bonnet|cap\b|turban|headdress|"
                       r"fan|button|buckle|jewel|brooch|necklace|earrings?|ring\b|bracelet|purse|bag|reticule|wallet|"
                       r"gloves?|mittens?|parasol|umbrella|cane|walking stick|comb|hairpin|hair ornament|fashion plate|"
                       r"print|photograph|drawing|book|doll|figure|pattern|stockings?|socks?|garters?|corset|bustle|"
                       r"crinoline|hoop|pannier|mask|spectacles|sword|armor|helmet|bead|veil|wig|collar|cuff|"
                       r"handkerchief|sample|swatch|fragment of a label|label|pin\b|tie\b|bow tie|belt|sash|apron|"
                       r"kerchief|scarf|muff|tippet|stole|hood|garter|netsuke|inro|box|vessel|jar|bowl|plate|vase|"
                       r"figurine|sculpture|sticker|pouch|case|cover for|mat\b|tassel|ornament|pendant|cameo|chatelaine|"
                       r"brooch|medal|badge of)\b", re.I)


def group_of(text, hint):
    for g, rx in GROUP_RX:
        if rx.search(text or ""):
            return g
    return hint if hint else None


ERAS = [  # key, label, from, to (year mid-point of the object's date range)
    ("e0", "Before 1500", -5000, 1500), ("e1", "1500–1699", 1500, 1700), ("e2", "1700s", 1700, 1800),
    ("e3", "1800–1849", 1800, 1850), ("e4", "1850–1899", 1850, 1900), ("e5", "1900 on", 1900, 3000),
]


def era_of(y):
    for k, _, a, b in ERAS:
        if a <= y < b:
            return k
    return None


def met_records():
    qs = json.loads((RAW / "met" / "ids.json").read_text())
    hint = {}
    for q in qs:
        for i in q["ids"]:
            hint.setdefault(i, q["group"])
    out, why = [], Counter()
    for i, g in hint.items():
        p = RAW / "met" / "obj" / f"{i}.json"
        if not p.exists():
            why["no meta"] += 1
            continue
        r = json.loads(p.read_text())
        if r.get("_error"):
            why["error"] += 1
            continue
        if not r.get("isPublicDomain") or not r.get("primaryImageSmall"):
            why["not public domain / no image"] += 1
            continue
        name = f"{r.get('objectName') or ''} | {r.get('title') or ''}"
        if DROP_NAME.search(r.get("objectName") or "") or (not r.get("objectName") and DROP_NAME.search(r.get("title") or "")):
            why["accessory or not a garment/textile"] += 1
            continue
        cls = (r.get("classification") or "") + " " + (r.get("medium") or "")
        if re.search(r"ceramic|porcelain|metal|bronze|gold\b|silver\b|paint|ink on|lacquer|wood|ivory|stone|glass", r.get("classification") or "", re.I):
            why["not textile"] += 1
            continue
        if not re.search(r"silk|cotton|wool|linen|textile|bast|camelid|alpaca|hemp|ramie|rayon|fiber|fibre|felt|bark|"
                         r"raffia|velvet|satin|brocade|damask|taffeta|muslin|chiffon|lace|embroider|leather|hide|skin|"
                         r"feather|tapa|ikat|batik|plain weave|tapestry|twill|gauze|net|cashmere|mohair|yarn|thread",
                         cls, re.I):
            why["medium not fabric"] += 1
            continue
        ys = [v for v in (r.get("objectBeginDate"), r.get("objectEndDate")) if isinstance(v, int)]
        if not ys or (ys[0] == 0 and ys[-1] == 0):
            why["no date"] += 1
            continue
        y = round(sum(ys) / len(ys))
        cul = ", ".join(x for x in [r.get("culture"), r.get("country")] if x)
        grp = group_of(" ".join(x or "" for x in [r.get("culture"), r.get("country"), r.get("region"), r.get("period"), r.get("dynasty")]), None)
        if grp is None:
            # no culture field: the department decides (Costume Institute = Western dress) or the query hint
            grp = "western" if r.get("department") == "Costume Institute" else g
        out.append(dict(src="met", rid=str(i), t=r.get("title") or r.get("objectName"), on=r.get("objectName"),
                        dl=r["primaryImageSmall"].replace("/web-large/", "/mobile-large/"),
                        d=r.get("objectDate") or str(y), y=y, cul=cul or None, g=grp, m=r.get("medium"),
                        by=r.get("artistDisplayName") or None, url=r.get("objectURL"), img=r["primaryImageSmall"],
                        acc=r.get("accessionNumber")))
    return out, why


def cma_records():
    p = RAW / "cma" / "meta.json"
    if not p.exists():
        return [], Counter()
    rows = json.loads(p.read_text())["rows"]
    out, why = [], Counter()
    for x in rows:
        web = ((x.get("images") or {}).get("web") or {}).get("url")
        if not web:
            why["no image"] += 1
            continue
        title = x.get("title") or ""
        if re.search(r"\b(label|sample book|swatch book|tassel|bag|purse|cushion cover)\b", title, re.I):
            why["not a garment/textile"] += 1
            continue
        e, l = x.get("creation_date_earliest"), x.get("creation_date_latest")
        if e is None and l is None:
            why["no date"] += 1
            continue
        y = round(((e if e is not None else l) + (l if l is not None else e)) / 2)
        culture = "; ".join(x.get("culture") or [])
        grp = group_of(culture, None)
        if grp is None:
            why["no culture group"] += 1
            continue
        cr = x.get("creators") or []
        by = re.split(r" \(", cr[0]["description"])[0] if cr and cr[0].get("description") else None
        out.append(dict(src="cma", rid=str(x["id"]), t=title, on="Textile", d=x.get("creation_date") or str(y), y=y,
                        cul=(x.get("culture") or [None])[0], g=grp, m=x.get("technique"), by=by, url=x.get("url"),
                        img=web, acc=x.get("accession_number")))
    return out, why


def aic_records():
    p = RAW / "aic" / "meta.json"
    if not p.exists():
        return [], Counter()
    out, why = [], Counter()
    for x in json.loads(p.read_text())["rows"]:
        title = x.get("title") or ""
        if DROP_NAME.search(title) and not re.search(r"badge|rank", title, re.I):
            why["accessory"] += 1
            continue
        if re.search(r"\b(sample book|swatch|label|tassel|bag|purse|cushion|book cover|lace sample|sampler)\b", title, re.I):
            why["not a garment/textile"] += 1
            continue
        a, b = x.get("date_start"), x.get("date_end")
        if a is None and b is None:
            why["no date"] += 1
            continue
        y = round(((a if a is not None else b) + (b if b is not None else a)) / 2)
        grp = group_of(" ".join(v or "" for v in [x.get("place_of_origin"), title]), None)
        if grp is None:
            why["no culture group"] += 1
            continue
        t = x.get("thumbnail") or {}
        out.append(dict(src="aic", rid=str(x["id"]), t=title, on=x.get("artwork_type_title"), d=x.get("date_display") or str(y),
                        y=y, cul=x.get("place_of_origin"), g=grp, m=x.get("medium_display"), by=x.get("artist_title"),
                        url=f"https://www.artic.edu/artworks/{x['id']}", img=aic_iiif(x["image_id"], 400),
                        dl=aic_iiif(x["image_id"], 200), acc=x.get("main_reference_number"),
                        wh=[t.get("width"), t.get("height")] if t.get("width") else None))
    return out, why


def records():
    a, wa = met_records()
    b, wb = cma_records()
    c, wc = aic_records() if USE_AIC else ([], Counter())
    wb = Counter({f"cma {k}": v for k, v in wb.items()}) + Counter({f"aic {k}": v for k, v in wc.items()})
    b = b + c
    # one record per image (Met ensembles sometimes share a photograph)
    seen, out = set(), []
    for r in a + b:
        if r["img"] in seen:
            continue
        seen.add(r["img"])
        out.append(r)
    return out, wa, wb


# CMA owns hundreds of small Coptic and Peruvian fragments; cap each culture group from CMA so fragments do not
# outweigh whole garments.
CMA_CAP = {"mideast": 220, "americas": 200, "western": 160, "india": 160, "china": 90, "japan": 90, "seasia": 90,
           "africa": 90, "korea": 20}
# AIC: 7,500 public-domain textiles, mostly European fabric lengths and fragments. Each group is capped so the
# archive stays balanced; the Met's whole garments come first.
AIC_CAP = {"western": 260, "mideast": 120, "americas": 160, "india": 120, "china": 110, "japan": 140, "seasia": 90,
           "africa": 120, "korea": 20}


def select(rs):
    met = [r for r in rs if r["src"] == "met"]
    cma = defaultdict(list)
    for r in rs:
        if r["src"] == "cma":
            cma[r["g"]].append(r)
    aic = defaultdict(list)
    for r in rs:
        if r["src"] == "aic":
            aic[r["g"]].append(r)
    out = list(met)
    for src, groups, cap in (("cma", cma, CMA_CAP), ("aic", aic, AIC_CAP)):
        for g, lst in groups.items():
            lst.sort(key=lambda r: r["rid"])
            random.Random(7).shuffle(lst)
            out += lst[:cap.get(g, 50)]
    return out


# ---------------------------------------------------------------------------------------------
# Step 3: images
# ---------------------------------------------------------------------------------------------
def img_path(r):
    return RAW / r["src"] / "img" / f"{r['rid']}.jpg"


def download_images(only=None):
    rs, _, _ = records()
    rs = [r for r in select(rs) if not only or r["src"] in only]
    for s in ("met", "cma", "aic"):
        (RAW / s / "img").mkdir(parents=True, exist_ok=True)
    todo = [r for r in rs if not img_path(r).exists()]
    failed_p = RAW / "failed.json"
    failed = json.loads(failed_p.read_text()) if failed_p.exists() else {}
    todo = [r for r in todo if f"{r['src']}-{r['rid']}" not in failed]
    print(f"images: {len(rs)} records, {len(todo)} to fetch", flush=True)
    t0 = time.time()
    sizes = {}
    sp = RAW / "sizes.json"
    if sp.exists():
        sizes = json.loads(sp.read_text())
    def one(r):
        key = f"{r['src']}-{r['rid']}"
        try:
            data = fetch(r["src"] + "img", r.get("dl") or r["img"], binary=True)
            im = Image.open(io.BytesIO(data)).convert("RGB")
            sizes[key] = [im.width, im.height]
            s = IMG_SIDE / max(im.size)
            if s < 1:
                im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
            im.save(img_path(r), "JPEG", quality=92)
        except Exception as e:
            failed[key] = str(e)[:200]
            print(f"   {key} failed: {e}", flush=True)

    pools = {s: ThreadPoolExecutor(WORKERS[s]) for s in ("met", "cma", "aic")}
    with pools["met"], pools["cma"], pools["aic"]:
        futs = [pools[r["src"]].submit(one, r) for r in todo]
        for n, f in enumerate(futs):
            f.result()
            if n % 100 == 0:
                sp.write_text(json.dumps(sizes))
                failed_p.write_text(json.dumps(failed, indent=0))
                print(f"images {n + 1}/{len(todo)}  {(time.time() - t0) / 60:.1f} min", flush=True)
    sp.write_text(json.dumps(sizes))
    failed_p.write_text(json.dumps(failed, indent=0))


# ---------------------------------------------------------------------------------------------
# Step 4: palettes with the studio backdrop masked out
# ---------------------------------------------------------------------------------------------
K = 6
K_SIDE = 120
PAL_CACHE = RAW / "palettes.jsonl"


def backdrop(X, h, w, step=2.6, far=20.0):
    """Mask (True = backdrop) for a garment photographed against a flat studio backdrop, or None.

    1. The ring: the outermost 2 pixels on every side. The backdrop is its median Lab color. A real backdrop is
       flat: at least 70% of ring pixels must lie within dE76 10 of that median, and the median distance must be
       under 6. Textiles photographed edge to edge (busy ring) fail and get no mask.
    2. Growing: start from ring pixels within dE 10 of the median; repeatedly add 4-neighbors whose color is within
       `step` of the neighbor that reached them (so a smooth light-to-dark sweep of backdrop paper is followed) and
       within `far` of the ring median (so the growth never wanders deep into a garment of a similar color).
       Garment edges are a sharp step, so the region stops there.
    3. Sanity: if the region covers under 3% it is ignored; over 88% means a pale garment on a pale backdrop
       leaked, so the growth is redone with half the step and far limits; still over 88%, no mask."""
    Lab = X.reshape(h, w, 3)
    ring = np.concatenate([Lab[:2].reshape(-1, 3), Lab[-2:].reshape(-1, 3), Lab[2:-2, :2].reshape(-1, 3), Lab[2:-2, -2:].reshape(-1, 3)])
    med = np.median(ring, 0)
    dr = np.sqrt(((ring - med) ** 2).sum(-1))
    if (dr < 10).mean() < 0.7 or np.median(dr) >= 6:
        return None
    dmed = np.sqrt(((Lab - med) ** 2).sum(-1))

    def grow(step, far):
        ok = dmed < far
        reach = np.zeros((h, w), bool)
        seed = dmed < 10
        reach[:2], reach[-2:], reach[:, :2], reach[:, -2:] = seed[:2], seed[-2:], seed[:, :2], seed[:, -2:]
        # neighbor smoothness for the four directions
        dy = np.sqrt(((Lab[1:] - Lab[:-1]) ** 2).sum(-1)) < step
        dx = np.sqrt(((Lab[:, 1:] - Lab[:, :-1]) ** 2).sum(-1)) < step
        while True:
            g = reach.copy()
            g[1:] |= reach[:-1] & dy
            g[:-1] |= reach[1:] & dy
            g[:, 1:] |= reach[:, :-1] & dx
            g[:, :-1] |= reach[:, 1:] & dx
            g &= ok
            if (g == reach).all():
                return reach
            reach = g

    m = grow(step, far)
    if m.mean() > 0.88:
        m = grow(step / 2, far / 2)
        if m.mean() > 0.88:
            return None
    if m.mean() < 0.03:
        return None
    return m.reshape(-1)


def prep(path):
    im = Image.open(path).convert("RGB")
    a = np.asarray(im, dtype=np.float64)
    l, t, r, b = C.autotrim(a)
    h, w = a.shape[:2]
    if w - l - r >= 20 and h - t - b >= 20:
        im = im.crop((l, t, w - r, h - b))
    s = K_SIDE / max(im.size)
    if s < 1:
        im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.BOX)
    X = C.rgb_to_lab(np.asarray(im, dtype=np.float64).reshape(-1, 3))
    bg = backdrop(X, im.height, im.width)
    if bg is None:  # no backdrop: drop a 2% inset instead, as corpus.py does (frame slivers, tape, shadow)
        H, W = im.height, im.width
        il, it = round(W * 0.02), round(H * 0.02)
        keep = np.zeros((H, W), bool)
        keep[it:H - it or H, il:W - il or W] = True
        return im, X, None, keep.reshape(-1)
    return im, X, bg, ~bg


def palette_of(path):
    im, X, bg, keep = prep(path)
    Y = X[keep]
    lab = C.kmeans(Y * np.array([1, C.CHROMA_W, C.CHROMA_W]), K)
    counts = np.bincount(lab, minlength=K)
    order = [j for j in np.argsort(-counts) if counts[j] > 0]
    cent = np.array([Y[lab == j].mean(0) for j in order])
    shares = counts[order] / counts.sum()
    return dict(lab=np.round(cent, 2).tolist(), share=np.round(shares, 4).tolist(),
                bg=round(float(bg.mean()), 3) if bg is not None else 0)


def _job(args):
    key, path = args
    try:
        return key, palette_of(path), None
    except Exception as e:
        return key, None, str(e)


def run_palettes(workers=6):
    done = load_palettes()
    rs, _, _ = records()
    jobs = []
    for r in select(rs):
        key = f"{r['src']}-{r['rid']}"
        p = img_path(r)
        if key not in done and p.exists():
            jobs.append((key, str(p)))
    print(f"palettes: {len(done)} cached, {len(jobs)} to compute", flush=True)
    if not jobs:
        return
    from multiprocessing import Pool
    with Pool(workers) as pool, PAL_CACHE.open("a") as f:
        for i, (key, res, err) in enumerate(pool.imap_unordered(_job, jobs, chunksize=8)):
            if err:
                print(f"   {key}: {err}", flush=True)
                continue
            res["key"] = key
            f.write(json.dumps(res) + "\n")
            if i % 250 == 0:
                f.flush()
                print(f"palettes {i + 1}/{len(jobs)}", flush=True)


def load_palettes():
    out = {}
    if PAL_CACHE.exists():
        for line in PAL_CACHE.read_text().splitlines():
            if line.strip():
                r = json.loads(line)
                out[r["key"]] = r
    return out


# ---------------------------------------------------------------------------------------------
# Step 5: build data/fashion/garments.json
# ---------------------------------------------------------------------------------------------
def library_names():
    lib = json.loads((ROOT / "data" / "library.json").read_text())
    lib = [x for x in lib if not x.get("crude") and re.match(r"^#[0-9A-Fa-f]{6}$", x["h"])]
    return [x["n"] for x in lib], C.rgb_to_lab(np.array([C.hex_to_rgb(x["h"]) for x in lib]))


def short_title(t, n=80):
    t = re.sub(r"\s+", " ", t or "").strip()
    return t if len(t) <= n else t[:n - 1].rstrip(" ,;:") + "…"


def build():
    rs, wa, wb = records()
    rs = select(rs)
    pals = load_palettes()
    sizes = json.loads((RAW / "sizes.json").read_text()) if (RAW / "sizes.json").exists() else {}
    app = C.app_names()
    app_lab = C.rgb_to_lab(np.array([C.hex_to_rgb(h) for _, h in app]))
    lib_n, lib_lab = library_names()
    rows = []
    for r in rs:
        key = f"{r['src']}-{r['rid']}"
        if key not in pals:
            continue
        p = pals[key]
        rgbs = C.lab_to_rgb(np.array(p["lab"]))
        exact = C.rgb_to_lab(rgbs)
        va = C.de2000(exact, app_lab).argmin(1)
        vl = C.de2000(exact, lib_lab).argmin(1)
        shares = [round(s, 3) for s in p["share"]]
        shares[0] = round(shares[0] + 1 - sum(shares), 3)
        wh = sizes.get(key)
        row = dict(id=key, t=short_title(r["t"]), d=short_title(r["d"], 40), y=r["y"], e=era_of(r["y"]), g=r["g"],
                   cul=short_title(r["cul"], 60) if r["cul"] else None, m=short_title(r["m"], 90) if r["m"] else None,
                   by=short_title(r["by"], 50) if r["by"] else None, mu=r["src"], url=r["url"],
                   img=urllib.parse.quote(r["img"], safe=":/?=&%#,;+@"),
                   ar=round(wh[1] / wh[0], 2) if wh else 1.3,
                   p=[[C.rgb_to_hex(rgbs[i]), shares[i], lib_n[vl[i]], app[va[i]][0]] for i in range(len(shares))])
        rows.append({k: v for k, v in row.items() if v is not None})
    rows.sort(key=lambda r: (r["y"], r["id"]))
    OUT.mkdir(parents=True, exist_ok=True)
    meta = dict(built=date.today().isoformat(),
                museums={"met": dict(name="The Metropolitan Museum of Art", short="The Met", license="Public domain (Open Access)",
                                     api="https://metmuseum.github.io/"),
                         "cma": dict(name="Cleveland Museum of Art", short="Cleveland", license="CC0",
                                     api="https://openaccess-api.clevelandart.org/"),
                         "aic": dict(name="Art Institute of Chicago", short="Art Institute of Chicago", license="CC0 (public domain)",
                                     api="https://api.artic.edu/docs/")},
                groups=GROUPS, eras=[[k, l] for k, l, _, _ in ERAS],
                fields="id, t title, d date text, y year (mid-point), e era, g culture group, cul culture, m medium, by maker, "
                       "mu museum, url record, img hotlinked image, ar height/width, p palette [hex, share, library name, app name]")
    txt = "{\"meta\":" + json.dumps(meta, ensure_ascii=False) + ",\n\"rows\":[\n" + \
          ",\n".join(json.dumps(r, ensure_ascii=False, separators=(",", ":")) for r in rows) + "\n]}\n"
    (OUT / "garments.json").write_text(txt)
    by_mu, by_g, by_e = Counter(r["mu"] for r in rows), Counter(r["g"] for r in rows), Counter(r["e"] for r in rows)
    print(f"garments.json: {len(rows)} rows, {len(txt) / 1024:.0f} KB")
    print("  museums", dict(by_mu))
    print("  groups ", dict(by_g))
    print("  eras   ", dict(sorted(by_e.items())))
    print("  met drops", dict(wa))
    print("  cma drops", dict(wb))
    masked = sum(1 for r in rows if pals[r["id"]].get("bg"))
    print(f"  backdrop masked on {masked} of {len(rows)} images")


def sheet(n=24, out="research/_raw/fashion/sheet.png", seed=1):
    rs, _, _ = records()
    rs = [r for r in select(rs) if img_path(r).exists()]
    random.Random(int(seed)).shuffle(rs)
    rs = rs[:int(n)]
    W, Hh = 3 * 130 + 260, 140
    canvas = Image.new("RGB", (W, Hh * len(rs)), (18, 18, 18))
    for i, r in enumerate(rs):
        im, X, bg, keep = prep(img_path(r))
        a = im.copy()
        a.thumbnail((130, 130))
        canvas.paste(a, (0, i * Hh))
        m = Image.fromarray((np.where(keep, 255, 40).reshape(im.height, im.width)).astype(np.uint8)).convert("RGB")
        m.thumbnail((130, 130))
        canvas.paste(m, (135, i * Hh))
        p = palette_of(img_path(r))
        rgbs = C.lab_to_rgb(np.array(p["lab"]))
        x0 = 275
        d = ImageDraw.Draw(canvas)
        for c, s in zip(rgbs, p["share"]):
            wdt = max(2, round(s * 370))
            d.rectangle([x0, i * Hh + 10, x0 + wdt, i * Hh + 110], fill=tuple(int(v) for v in c))
            x0 += wdt
        d.text((275, i * Hh + 115), f"{r['src']}-{r['rid']} {r['g']} {r['y']} bg={p['bg']}  {(r['t'] or '')[:40]}", fill=(220, 220, 220))
    canvas.save(ROOT / out)
    print("wrote", out)


# ---------------------------------------------------------------------------------------------
# figs: photographs for the fashion history pages -> data/images.js (WIKI_IMAGES, keyed by page id)
# Each page lists (kind, ref, caption, alt). kind "commons" = a Wikimedia Commons file (hotlinked 900px thumbnail,
# credit and license from the file page); kind "rec" = a garment from this archive (met-/cma- id, hotlinked).
# Image 0 sits under the title; section k shows image k (the section's img field).
# ---------------------------------------------------------------------------------------------
FIG_CACHE = RAW / "figs-cache.json"
FIGS = {
    "fashion-purple-law": [
        ("commons", "File:Mosaic of Theodora - Basilica San Vitale (Ravenna).jpg", "Empress Theodora and her court in the 6th-century mosaics of San Vitale, Ravenna. Her robe is imperial purple, bordered with gold and pearls.", "A Byzantine mosaic of an empress in a dark purple robe and jeweled crown among attendants"),
        ("commons", "File:Bolinus brandaris 01.jpg", "A shell of Bolinus brandaris, one of the Mediterranean murex snails whose glands gave Tyrian purple.", "A spiny pale brown sea snail shell on a white ground"),
        ("best", {"color": "#4A2A40", "g": "mideast", "y": [200, 900], "q": "tunic|segment|clav|band"}, "{t}, {cul}, {d}. Dark purple bands like these descend from the Roman clavi that marked rank.", "A woven textile fragment with dark purple bands and figures"),
        ("commons", "File:Mosaic of Justinian I - San Vitale - Ravenna 2016.jpg", "Justinian in a purple cloak fastened with a jeweled brooch, San Vitale, Ravenna (c. 547).", "A Byzantine mosaic of an emperor with a halo in a purple cloak, among courtiers and soldiers"),
        ("commons", "File:Naturalis Biodiversity Center - RMNH.MOL.5010417 - Bolinus brandaris (Linnaeus, 1758) - Muricidae - Mollusc shell.jpeg", "Murex shells from several angles. Thousands were needed to dye the trim of a single garment.", "Several views of a murex sea snail shell"),
    ],
    "fashion-sumptuary-europe": [
        ("commons", "File:Domenico Ghirlandaio - Birth of Mary - WGA8830.jpg", "Ghirlandaio's Birth of Mary (1485–90) in Santa Maria Novella shows Florentine women in the rich reds and gold-brocades the city's laws tried to limit.", "A Renaissance fresco of women in long gowns visiting a new mother"),
        ("best", {"color": "#8C1C26", "g": "western", "y": [1400, 1650], "q": "velvet|silk|damask|brocade|fragment|textile"}, "{t}, {cul}, {d}. Deep reds on silk were among the most restricted luxuries.", "A piece of deep red patterned silk"),
        ("commons", "File:Portrait of King Henry VIII of England (1491–1547), by Hans Holbein the Younger (Thyssen-Bornemisza Museum, Madrid).jpg", "Henry VIII by Hans Holbein the Younger, about 1537. His Acts of Apparel reserved purple silk and cloth of gold for the royal family.", "A portrait of a heavyset king in a jeweled red and gold doublet and feathered cap"),
        ("commons", "File:Rogier van der Weyden - Portrait of Philip the Good - WGA25727.jpg", "Philip the Good, Duke of Burgundy, in black, after Rogier van der Weyden. His black made the color princely.", "A portrait of a man in a black gown and black hat holding a folded paper"),
        ("commons", "File:Queen Elizabeth I ('The Ditchley portrait') by Marcus Gheeraerts the Younger.jpg", "Elizabeth I in the Ditchley portrait (about 1592), in white and jewels. Her proclamations on apparel were issued again and again.", "A full-length portrait of Queen Elizabeth I in a white jeweled gown standing on a map"),
    ],
    "fashion-edo-browns": [
        ("best", {"color": "#5A4434", "g": "japan", "y": [1650, 1870], "q": "kosode|kimono|robe"}, "{t}, {cul}, {d}. Browns, greys and indigo were the legal colors of townspeople's dress.", "A Japanese robe in muted brown tones"),
        ("best", {"color": "#B3252E", "g": "japan", "y": [1650, 1760], "q": "kosode|katabira|robe"}, "{t}, {cul}, {d}. Bold reds and costly decoration were what the edicts aimed at.", "A Japanese robe or robe fragment with red designs"),
        ("best", {"color": "#6F6A66", "g": "japan", "y": [1700, 1900], "q": "kosode|kimono|robe|katabira|textile"}, "{t}, {cul}, {d}. A grey-toned piece: within the limits, dyers chased subtle shifts of grey and brown.", "A Japanese textile in soft grey tones"),
        ("best", {"color": "#25344F", "g": "japan", "y": [1700, 1900], "q": "kosode|kimono|robe|katabira|textile|furoshiki"}, "{t}, {cul}, {d}. Indigo, dyed in many dips, was everywhere in Edo dress.", "A Japanese indigo-dyed textile"),
        ("commons", "File:Utamaro Naniwaya Okita.JPG", "Naniwaya Okita, a teahouse waitress, by Kitagawa Utamaro (1793). Townspeople's dress in prints shows the taste for small patterns and quiet grounds.", "A Japanese woodblock print of a young woman in a patterned kimono holding a teacup"),
    ],
    "fashion-kasane": [
        ("commons", "File:Genji emaki Yadorigi.JPG", "A scene from the 12th-century Tale of Genji scrolls. Court women's layered robes spill out in bands of color.", "A Japanese painted scroll showing courtiers in layered robes inside a palace"),
        ("commons", "File:Empress Nagako-1926.jpg", "Empress Nagako in jūnihitoe court dress for the 1928 enthronement. The layered robes keep the Heian form.", "A photograph of a Japanese empress in layered court robes with long hair"),
        ("commons", "File:Hakubyo Genji monogatari emaki - scroll 1-5.jpg", "An ink version of the Genji scrolls (1554). Even without color, the stacked robe edges show how the layers were seen.", "A monochrome Japanese scroll painting of court ladies"),
        ("commons", "File:Tosa Mitsuoki 001.jpg", "Murasaki Shikibu, author of The Tale of Genji, imagined by Tosa Mitsuoki in the 17th century. Her name means purple.", "A painting of a court lady at a writing desk by a window"),
        ("best", {"color": "#7A3C6E", "g": "japan", "y": [1600, 1900], "q": "noh|robe|kosode|uchikake|textile"}, "{t}, {cul}, {d}. Later court and theater costume kept the old prestige of purple.", "A Japanese robe with purple tones"),
    ],
    "fashion-imperial-yellow": [
        ("commons", "File:Portrait of the Qianlong Emperor in Court Dress.jpg", "The Qianlong emperor in court dress. Bright yellow was his alone, by the rules his court codified in 1759.", "A Chinese imperial portrait of an emperor in a bright yellow dragon robe seated on a throne"),
        ("commons", "File:1996 -248-1 Beijing Forbidden City (5068463795).jpg", "Yellow glazed roof tiles in the Forbidden City, Beijing: yellow for the center, and for the emperor.", "Golden yellow tiled roofs of palace buildings"),
        ("best", {"color": "#D9A21B", "g": "china", "y": [1644, 1912], "q": "dragon|robe"}, "{t}, {cul}, {d}. Yellow grounds were restricted by rank and relation to the emperor.", "A Chinese dragon robe with a yellow ground"),
        ("best", {"color": "#1F2C5A", "g": "china", "y": [1644, 1912], "q": "rank badge|badge|square"}, "{t}, {cul}, {d}. Square badges on the surcoat showed an official's rank.", "A square embroidered or woven Chinese rank badge"),
        ("commons", "File:Portrait of Empress Dowager Cixi.jpg", "The Empress Dowager Cixi painted by Katharine Carl (1903–04), in imperial yellow.", "A portrait of an elderly Chinese empress in yellow robes on a throne"),
    ],
    "fashion-indian-cottons": [
        ("rec", "cma-163006", "{t}, {cul}, {d}. Mordant-painted reds and resist-dyed blues on cotton.", "A painted Indian cotton bed cover with flowering branches"),
        ("best", {"color": "#A8322D", "g": "india", "y": [1600, 1850], "q": "chintz|palampore|mordant|resist|painted|printed"}, "{t}, {cul}, {d}. Madder-family reds fixed with alum held fast through washing.", "A red-patterned Indian cotton"),
        ("rec", "cma-161650", "{t}, {cul}, {d}. Indian dyers made cloth to order for each market; this was for Southeast Asia.", "A long Indian cotton cloth with red and blue patterned bands"),
        ("best", {"color": "#E9DCC2", "g": "western", "y": [1700, 1820], "q": "dress|robe|gown|chintz|printed"}, "{t}, {cul}, {d}. Light printed cottons became the fashion in Europe despite the bans.", "A European dress of light printed cotton"),
        ("best", {"color": "#7E2A2E", "g": "western", "y": [1760, 1850], "q": "printed cotton|toile|indienne|fragment of printed"}, "{t}, {cul}, {d}. European printers learned to copy Indian cottons in the 18th century.", "A European printed cotton fragment"),
    ],
    "fashion-batik-ikat": [
        ("rec", "cma-97613", "{t}, {cul}, {d}. North-coast batik in bright reds and blues for a mixed market.", "An Indonesian batik sarong with colorful patterns"),
        ("commons", "File:Canting Batik Tulis.jpg", "Drawing hot wax with a canting, the small copper pen of hand-drawn batik tulis.", "A hand holding a small copper wax pen over cloth with wax lines"),
        ("best", {"color": "#7B4A27", "g": "seasia", "y": [1800, 1930], "q": "batik|waist cloth|kain|slendang|sarong|wearing"}, "{t}, {cul}, {d}. Central Javanese court batik: indigo and soga brown on cream.", "An Indonesian batik in brown, indigo and cream"),
        ("commons", "File:Man’s Shoulder Cloth (Hinggi), early 20th century; cotton; warp ikat; Indonesia, East Sumba, Kingdom of Kapunduk.jpg", "A man's shoulder cloth (hinggi) from East Sumba, early 20th century: warp ikat in morinda red and indigo.", "A long Indonesian ikat cloth with red and blue figures of animals"),
        ("best", {"color": "#7A2A25", "g": "seasia", "y": [1800, 1950], "q": "ikat|hinggi|cloth|ceremonial"}, "{t}, {cul}, {d}. Ikat's feathered edges come from threads that never quite line up.", "An ikat-patterned Southeast Asian textile"),
    ],
    "fashion-wax-prints": [
        ("commons", "File:Felicia fabric.jpg", "A wax print sold in Ghana's fabric markets. Many designs carry names given by traders and buyers.", "A length of patterned wax-print fabric"),
        ("commons", "File:Koforidua flowers fabric.jpg", "'Koforidua flowers', a wax print from Ghanaian markets.", "A wax-print fabric with large flower shapes"),
        ("commons", "File:Elmina Java Museum.jpg", "The Elmina Java Museum in Ghana tells the story of the Gold Coast soldiers who served in the Dutch East Indies.", "A small museum building in Elmina, Ghana"),
        ("commons", "File:Asobayere fabric.jpg", "Another market wax print. The same design can have different names in different countries.", "A narrow length of wax-print fabric"),
        ("commons", "File:Nsubura fabric.jpg", "Wax prints are sold in six-yard lengths and tailored into wrappers, dresses and suits.", "A wax-print fabric with bold shapes"),
    ],
    "fashion-kente-adinkra": [
        ("rec", "met-85576", "{t}, {cul}, {d}. Strips of silk and cotton sewn edge to edge.", "A large Asante kente cloth of many woven strips in bright colors"),
        ("commons", "File:Man Weaving Kente Cloth.jpg", "A weaver at a narrow strip loom. Kente is traditionally woven by men.", "A man weaving at a wooden loom with colorful threads"),
        ("commons", "File:Kente patterns, Tafi, Volta region.jpg", "Ewe kente from Tafi in Ghana's Volta region.", "Several folded kente cloths with different patterns"),
        ("commons", "File:Ewe kente stripes, Ghana.jpg", "Ewe kente strips. Ewe weavers have their own styles and motifs.", "Close view of striped and patterned kente strips"),
        ("commons", "File:NtonsoAdinkra.jpg", "Stamping adinkra cloth with a carved calabash stamp in Ntonso, Ghana.", "A man pressing a carved stamp onto cloth printed with black symbols"),
    ],
    "fashion-andean-cloth": [
        ("commons", "File:Paracas mantle, BM.jpg", "A Paracas mantle, about 2,000 years old, embroidered in camelid wool (Brooklyn Museum).", "A dark embroidered mantle with rows of colorful figures"),
        ("best", {"color": "#A3243B", "g": "americas", "y": [-500, 1550], "q": "tunic|mantle|textile|fragment"}, "{t}, {cul}, {d}. Camelid wool takes dye deeply, which is why Andean reds survive so well.", "An Andean textile with red areas"),
        ("commons", "File:Cochineal insects on prickly pear - Flickr - pellaea.jpg", "Cochineal insects on prickly-pear cactus near Urubamba, Peru. Crushed, they give carminic acid.", "White waxy clusters of insects on a green cactus pad"),
        ("commons", "File:Tupa-inca-tunic.png", "An Inca royal tunic covered in tocapu, small square motifs whose meaning is still debated (Dumbarton Oaks).", "An Andean tunic covered in a grid of small colorful geometric squares"),
        ("rec", "met-313152", "{t}, {cul}, {d}. Inca tunics followed strict designs.", "An Inca tunic woven in camelid fiber"),
    ],
    "fashion-black": [
        ("commons", "File:Portrait of Philip II of Spain by Sofonisba Anguissola - 002b.jpg", "Philip II of Spain by Sofonisba Anguissola (1565): Spanish court black, set off by a white collar and gold.", "A portrait of a bearded king in black holding a rosary"),
        ("commons", "File:Rogier van der Weyden - Portrait of Philip the Good - WGA25727.jpg", "Philip the Good of Burgundy wore black from about 1419 and made it princely.", "A portrait of a man in a black gown and hat"),
        ("commons", "File:Rembrandt - De Staalmeesters- het college van staalmeesters (waardijns) van het Amsterdamse lakenbereidersgilde - Google Art Project.jpg", "Rembrandt's Syndics of the Drapers' Guild (1662): Dutch merchants in black and white.", "A group portrait of men in black with white collars and black hats around a table"),
        ("commons", "File:Madame X (Madame Pierre Gautreau), John Singer Sargent, 1884 (unfree frame crop).jpg", "John Singer Sargent's Madame X (1884). The scandal was the pose and neckline, not the black.", "A portrait of a pale woman in a black evening gown with a low neckline"),
        ("best", {"color": "#141416", "g": "western", "y": [1890, 1926], "q": "dress|evening|ensemble|gown"}, "{t}, {cul}, {d}. Black was fashionable well before Chanel's 1926 dress.", "A black dress from the early 20th century"),
    ],
    "fashion-white": [
        ("best", {"color": "#F1ECE2", "g": "western", "y": [1795, 1825], "q": "dress"}, "{t}, {cul}, {d}. Light white cotton, often Indian muslin, in the high-waisted style of around 1800.", "A high-waisted white dress from about 1800"),
        ("commons", "File:Hans Holbein the Younger - The Ambassadors - Google Art Project.jpg", "Holbein's Ambassadors (1533): white linen at neck and cuff shows under costly dark cloth.", "A double portrait of two richly dressed men with objects on a shelf between them"),
        ("commons", "File:Marie-Antoinette en chemise ou en gaulle - Vers 1783 - Elisabeth Louise Vigée Le Brun.jpg", "Marie Antoinette in a white muslin chemise dress by Élisabeth Vigée Le Brun (1783). Critics called it underwear.", "A portrait of a queen in a loose white dress and straw hat holding a rose"),
        ("commons", "File:Marriage of Queen Victoria MET MM78359.jpg", "The marriage of Queen Victoria, 10 February 1840, a print after George Hayter. Her white satin was widely copied.", "A print of a royal wedding in a chapel with a bride in white"),
        ("best", {"color": "#EFE6D3", "g": "western", "y": [1840, 1900], "q": "wedding"}, "{t}, {cul}, {d}. White weddings spread slowly through the 19th century.", "A white or ivory wedding dress"),
    ],
    "fashion-mourning-dress": [
        ("rec", "met-174742", "{t}, {cul}, {d}.", "A black silk mourning dress"),
        ("best", {"color": "#1A191C", "g": "western", "y": [1850, 1895], "q": "mourning"}, "{t}, {cul}, {d}. Matte black for deep mourning.", "A black mourning dress"),
        ("commons", "File:WMID-7CB3B8, Modern, Victorian mourning brooch (FindID 528151).jpg", "A Victorian mourning brooch. Jet and other black stones were the only jewelry allowed in deep mourning.", "A black oval brooch"),
        ("commons", "File:Queen Victoria by Bassano 1887.JPG", "Queen Victoria in 1887, still in widow's black a quarter century after Albert's death.", "A black and white photograph of Queen Victoria in black with a white veil"),
        ("best", {"color": "#77737A", "g": "western", "y": [1850, 1900], "q": "dress|ensemble|mourning"}, "{t}, {cul}, {d}. Grey and other quiet colors returned in half mourning.", "A grey dress from the later 19th century"),
        ("best", {"color": "#9A7A9E", "g": "western", "y": [1855, 1900], "q": "dress|ensemble|mourning"}, "{t}, {cul}, {d}. Mauve and lavender marked the last stage of mourning.", "A mauve dress from the later 19th century"),
    ],
    "fashion-aniline": [
        ("best", {"color": "#8E4A9A", "g": "western", "y": [1856, 1875], "q": "dress|ensemble|bodice"}, "{t}, {cul}, {d}. Purples like this became cheap with the new aniline dyes.", "A purple dress from the 1860s"),
        ("commons", "File:Portrait of Sir William Henry Perkin (1838 – 1907), chemist Wellcome V0026997.jpg", "Sir William Henry Perkin, who made mauveine, the first aniline dye, at eighteen.", "A photograph of an older bearded man"),
        ("commons", "File:Winterhalter Franz Xavier The Empress Eugenie Surrounded by her Ladies in Waiting.jpg", "Empress Eugénie and her ladies by Winterhalter (1855). Her fondness for mauve helped start the fashion.", "A painting of a group of women in pale gowns seated in a garden"),
        ("best", {"color": "#C2307E", "g": "western", "y": [1858, 1880], "q": "dress|ensemble|bodice|shawl"}, "{t}, {cul}, {d}. Magenta and other bright aniline colors in fashion.", "A bright magenta garment from the 1860s or 70s"),
        ("best", {"color": "#2E4FA3", "g": "western", "y": [1860, 1885], "q": "dress|ensemble|bodice"}, "{t}, {cul}, {d}. Aniline blues followed within a few years.", "A bright blue dress from the 1860s or 70s"),
    ],
    "fashion-arsenic-green": [
        ("best", {"color": "#3F9F4F", "g": "western", "y": [1830, 1880], "q": "dress|ensemble|bodice|evening"}, "{t}, {cul}, {d}. A bright green of the kind once made with arsenic; this piece has not been tested.", "A bright green 19th-century dress"),
        ("best", {"color": "#2BA866", "g": "western", "y": [1820, 1880], "q": "dress|bodice|shawl|ensemble|evening"}, "{t}, {cul}, {d}. Clear, intense greens were new in the early 1800s.", "A green 19th-century garment"),
        ("commons", "File:Two skeletons dressed as lady and gentleman. Etching, 1862. Wellcome V0042226.jpg", "'The Arsenic Waltz', a skeleton couple dressed for a ball, from Punch (1862).", "An etching of two skeletons dressed in evening clothes, bowing to each other"),
        ("commons", "File:An overcrowded artificial flower maker's workshop Wellcome M0012977.jpg", "An overcrowded artificial-flower workshop on Oxford Street, London. Workers dusted leaves with green powder.", "An engraving of many women working at a long table in a crowded room"),
        ("best", {"color": "#5E8C4A", "g": "western", "y": [1875, 1925], "q": "dress|bodice|ensemble|evening"}, "{t}, {cul}, {d}. By the 1890s greens like this came from synthetic dyes.", "A green dress from the late 19th or early 20th century"),
    ],
    "fashion-khaki": [
        ("commons", "File:GentlmninKh2.jpg", "'A Gentleman in Kharki', Richard Caton Woodville's 1899 image of a British soldier of the Boer War.", "An illustration of a wounded soldier in khaki holding a rifle"),
        ("commons", "File:Benjamin West 005.jpg", "Benjamin West's Death of General Wolfe (1770): British red coats, made to be seen.", "A painting of a dying general surrounded by soldiers in red coats"),
        ("commons", "File:\"Major Pearce's Camp at Ekwendeni, Livingstonia\" Malawi, ca.1910 (imp-cswc-GB-237-CSWC47-LS4-1-024) (cropped).jpg", "Soldiers in khaki in British Central Africa, about 1910.", "An old photograph of soldiers in light uniforms at a camp"),
        ("commons", "File:Louis Porche, a French soldier in 1914 (colorized).png", "A French soldier in August 1914, in red trousers, colorized. They were replaced by horizon blue in 1915.", "A colorized photograph of a French soldier in a blue coat and red trousers"),
        ("commons", "File:SS Liberator (ID-3134) in dazzle camouflage, 1918.jpg", "SS Liberator in dazzle camouflage, 1918: stripes meant to confuse, not to hide.", "A ship painted in bold black and white zigzag stripes"),
    ],
    "fashion-navy": [
        ("commons", "File:Captain Sir Alexander Schomberg, 1720-1804 RMG BHC3015.tiff", "Captain Sir Alexander Schomberg by William Hogarth (1763), in the blue and white naval uniform.", "A portrait of a naval officer in a dark blue coat with white facings and gold"),
        ("commons", "File:Wool skein coloured with natural dyes indigo, lac, madder and tesu by Himalayan Weavers in Mussoorie.jpg", "Wool dyed with indigo and other natural dyes. Many dips build a deep navy.", "Skeins of wool in blues, reds and yellows"),
        ("commons", "File:Portret van Lord Anson, RP-P-OB-72.419.jpg", "Lord Anson, whose Admiralty issued the first Royal Navy officers' uniform in 1748.", "An engraved portrait of an 18th-century naval officer"),
        ("commons", "File:Mr. Thomas. (BM 1876,1209.521).jpg", "A Metropolitan Police superintendent around 1830, in the dark blue chosen to look civil, not military.", "A print of a policeman in a dark blue tailcoat and top hat"),
        ("commons", "File:Edward VII (1841 – 1910).jpg", "The young Prince of Wales in a sailor suit, painted by Winterhalter in 1846.", "A painting of a small boy in a white sailor suit with his hands in his pockets"),
    ],
    "fashion-denim": [
        ("commons", "File:Dorothea Lange, Farmers who have bought machinery cooperatively, West Carlton, Yamhill County, Oregon, 1939.jpg", "Farmers in overalls, Oregon, 1939, photographed by Dorothea Lange. For decades denim meant work.", "A black and white photograph of farmers in overalls standing together"),
        ("commons", "File:US139121.png", "Drawing from US patent 139,121 (1873) for riveted pocket corners, by Jacob Davis and Levi Strauss & Co.", "A patent drawing of work trousers with rivets marked"),
        ("best", {"color": "#2F4A75", "g": "western", "y": [1850, 1930], "q": "coat|jacket|overall|work|trousers|dress"}, "{t}, {cul}, {d}. Indigo-dyed cotton was the common blue of working clothes.", "A blue cotton garment"),
        ("commons", "File:The Wild One ad - 24 December 1953.jpg", "An advertisement for The Wild One (1953). Films like it tied jeans and leather to youthful revolt.", "A newspaper film advertisement showing a man in a leather jacket on a motorcycle"),
    ],
    "fashion-pink-blue": [
        ("commons", "File:Thomas Lawrence - Sarah Goodin Barrett Moulton, Pinkie (1794).jpg", "'Pinkie' by Thomas Lawrence (1794), a girl in a white dress with a pink sash and bonnet.", "A portrait of a girl in a white dress with pink ribbons against a stormy sky"),
        ("commons", "File:Thomas Gainsborough - The Blue Boy (c. 1770).jpg", "Gainsborough's Blue Boy (about 1770). Hung beside Pinkie in the Huntington, they look like a code; they were painted apart.", "A portrait of a boy in a blue satin costume holding a hat"),
        ("best", {"color": "#F1ECE2", "g": "western", "y": [1820, 1900], "q": "child|infant|baby|boy|girl|christening"}, "{t}, {cul}, {d}. Most small children of both sexes wore white.", "A white child's dress"),
        ("best", {"color": "#E9B9C3", "g": "western", "y": [1820, 1925], "q": "child|infant|baby|girl|boy|dress"}, "{t}, {cul}, {d}. Pink was a pastel for anyone before it was a code.", "A pink garment"),
    ],
    "fashion-schiaparelli": [
        ("commons", "File:1937 Elsa Schiaparelli evening gown.jpg", "A 1937 Schiaparelli evening gown on display (right).", "Museum mannequins in 1930s evening gowns"),
        ("commons", "File:Summer 1939 Schiaparelli dress.jpg", "A Schiaparelli evening dress from summer 1939, embroidered with a key motif.", "A dark evening dress with embroidered decoration on a mannequin"),
        ("commons", "File:Shocking Pink Schiaparelli.jpg", "A Schiaparelli label in shocking pink, the house signature.", "A bright pink label with black lettering"),
        ("commons", "File:Joean Honoré Fragonard - The Swing.jpg", "Fragonard's The Swing (1767): rococo pink, two centuries before shocking.", "A painting of a woman in a frothy pink dress on a swing in a garden"),
        ("commons", "File:Elsa Schiaparelli dresses.jpg", "Schiaparelli dresses in a museum exhibition.", "Several 1930s dresses on mannequins"),
    ],
    "fashion-new-look": [
        ("commons", "File:Christian Dior (Moscow exhibition, 2011) 26.jpg", "Dior's Bar suit (1947) on display: pale shantung jacket, pleated black skirt.", "A museum mannequin in a fitted cream jacket and full black skirt"),
        ("commons", "File:Utility Clothing Label Mona Roberts.jpg", "The CC41 label of Britain's wartime Utility clothing scheme.", "A small fabric label with the CC41 mark"),
        ("commons", "File:Dior denver art1.jpg", "The Bar suit in another museum display.", "A mannequin in a Dior suit with a padded hip jacket and long skirt"),
        ("commons", "File:Modeshow van Jacques Fath in Victoria hotel, Bestanddeelnr 904-2995.jpg", "A Jacques Fath fashion show in Amsterdam, 1950: full skirts and fitted waists after the New Look.", "A black and white photograph of models at a fashion show"),
        ("commons", "File:Modeshow Lydia Dickman in Pays Bas te Amsterdam, Bestanddeelnr 904-2195.jpg", "A 1950 fashion show in Amsterdam.", "A black and white photograph of a model in a full-skirted dress"),
    ],
    "fashion-sixties": [
        ("commons", "File:Mary Quant (1966).jpg", "Mary Quant arriving at Schiphol, December 1966.", "A photograph of a woman with a sharp bob haircut in a short dress"),
        ("commons", "File:Mary Quant at the Victoria and Albert Museum 37.jpg", "Mary Quant designs in the V&A's 2019 retrospective.", "Mannequins in short brightly colored 1960s dresses"),
        ("commons", "File:Mondriaanmode door Yves St Laurent (1966).jpg", "Yves Saint Laurent's Mondrian dresses shown in The Hague, January 1966.", "Models in shift dresses with black grids and primary color blocks"),
        ("commons", "File:Intercontex in Amsterdam. Vier mannequins die de verschillende modevormen laten , Bestanddeelnr 921-2061.jpg", "Four models show the season's shapes at Intercontex, Amsterdam, 1968.", "A black and white photograph of four models in late-1960s outfits"),
        ("commons", "File:Mannequins van Courreges geven show in Hilton Amsterdam, Bestanddeelnr 924-9289.jpg", "Courrèges models in Amsterdam, 1971: the space-age look lasting into the 70s.", "A photograph of models in short geometric outfits"),
    ],
    "fashion-punk": [
        ("commons", "File:Jongelui met vreemdsoortige haardracht in Amsterdam, Bestanddeelnr 932-6783.jpg", "Young punks in Amsterdam, 1983.", "A photograph of young people with spiked hair and dark clothes"),
        ("commons", "File:The Wild One ad - 24 December 1953.jpg", "An advertisement for The Wild One (1953), which fixed the black leather jacket as rebel dress.", "A newspaper film advertisement showing a man in a leather jacket on a motorcycle"),
        ("commons", "File:Hawk Club Olav Tryggvasons gate 33 (1980) (23621026758).jpg", "Outside a punk club in Trondheim, 1980.", "A color photograph of young people outside a club"),
        ("commons", "File:Nuorisoa Lepakon edustalla (Helsinki, 1984) – 03.tif", "Punk-styled youth in Helsinki, 1984.", "A photograph of a young person in punk clothing"),
    ],
    "fashion-forecasting": [
        ("commons", "File:Pantone Color of the Year 2023.jpg", "Pantone's Color of the Year for 2023, Viva Magenta, on display.", "A display of magenta-red Pantone color of the year materials"),
        ("commons", "File:Autumn leaves (pantone).jpg", "Autumn leaves matched to Pantone chips: color standards make a shared vocabulary for industry.", "Leaves laid out next to matching printed color swatches"),
        ("commons", "File:Pantone Universe products.jpg", "Pantone-branded products. The company sells its colors as much as it forecasts them.", "Colorful Pantone-branded objects"),
        ("best", {"color": "#98B4D4", "g": "western", "y": [1850, 1925], "q": "dress|ensemble|evening"}, "{t}, {cul}, {d}. Pale blues have come back into fashion many times, long before Cerulean 2000.", "A pale blue dress"),
    ],
    "fashion-fast-fashion": [
        ("commons", "File:Garment factory in Bangladesh Women working.jpg", "A garment factory in Dhaka, Bangladesh, 2011.", "Rows of women working at sewing machines in a factory"),
        ("commons", "File:La marque juillet 2017a.jpg", "A river in northern France turned by pollution; dye and finishing effluent can color rivers near textile mills.", "A small river with discolored water flowing under a bridge"),
        ("commons", "File:An overcrowded artificial flower maker's workshop Wellcome M0012977.jpg", "Workers have long carried the cost of color: an 1800s artificial-flower workshop.", "An engraving of a crowded workshop"),
        ("commons", "File:BOC Subic destroys 591 bales of used clothing (ukay-ukay).jpg", "Bales of used clothing seized and destroyed at Subic, Philippines. Much surplus clothing travels abroad as secondhand bales.", "Large bales of compressed used clothes in a yard"),
        ("commons", "File:Garment workers in Bangladesh exiting a factory during break.jpg", "Garment workers leaving a factory in Bangladesh during a break.", "A crowd of workers walking out of a factory gate"),
    ],
}


def commons_info(title):
    q = urllib.parse.urlencode({"action": "query", "titles": title, "prop": "imageinfo", "format": "json",
                                "iiprop": "url|size|extmetadata", "iiurlwidth": 900,
                                "iiextmetadatafilter": "LicenseShortName|LicenseUrl|Artist|Credit"})
    r = fetch("commons", "https://commons.wikimedia.org/w/api.php?" + q)
    page = next(iter(r["query"]["pages"].values()))
    if "imageinfo" not in page:
        raise RuntimeError(f"no such file: {title}")
    ii = page["imageinfo"][0]
    md = {k: re.sub(r"<[^>]+>", "", (v or {}).get("value", "")).strip() for k, v in (ii.get("extmetadata") or {}).items()}
    artist = re.sub(r"\s+", " ", md.get("Artist", "")).strip() or "Unknown author"
    artist = re.sub(r"^(Unknown author)+", "Unknown author", artist)[:80]
    lic = md.get("LicenseShortName", "") or "See file page"
    pd = re.search(r"public domain|^pd|cc0|no restrictions", lic, re.I)
    return dict(src=ii.get("thumburl") or ii["url"], w=ii.get("thumbwidth") or ii["width"], h=ii.get("thumbheight") or ii["height"],
                credit=f"{artist} · {lic}", license=lic, licenseUrl="" if pd and "cc0" not in lic.lower() else md.get("LicenseUrl", ""),
                commons=ii.get("descriptionurl"))


def rec_info(key, rows):
    r = rows.get(key)
    if not r:
        raise RuntimeError(f"not in the archive: {key}")
    mu = {"met": ("The Metropolitan Museum of Art", "Public domain"), "cma": ("Cleveland Museum of Art", "CC0")}[r["mu"]]
    w, h = 900, round(900 * r.get("ar", 1.3))
    return dict(src=r["img"], w=w, h=h, credit=f"{mu[0]} · {mu[1]}", license=mu[1], licenseUrl="", commons=r["url"])


def best_rec(spec, rows, used):
    """The archive garment that best fits a spec: group, year range, title regex, and the most area near a color."""
    L = C.rgb_to_lab(np.array([C.hex_to_rgb(spec["color"])]))
    rx = re.compile(spec.get("q") or ".", re.I)
    best, top = None, spec.get("min", .25)
    for r in rows.values():
        if r["id"] in used or (spec.get("g") and r["g"] != spec["g"]) or not rx.search(r["t"] + " | " + (r.get("m") or "")):
            continue
        if spec.get("y") and not spec["y"][0] <= r["y"] <= spec["y"][1]:
            continue
        labs = C.rgb_to_lab(np.array([C.hex_to_rgb(c[0]) for c in r["p"]]))
        d = C.de2000(L, labs)[0]
        score = sum(c[1] * (1 if x < 6 else max(0, (16 - x) / 10)) for c, x in zip(r["p"], d))
        score += .05 if r["mu"] == "met" else 0  # whole garments photograph better than fragments
        if score > top:
            best, top = r, score
    return best


def figs():
    cache = json.loads(FIG_CACHE.read_text()) if FIG_CACHE.exists() else {}
    rows = {r["id"]: r for r in json.loads((OUT / "garments.json").read_text())["rows"]}
    out, missing, used = {}, [], set()
    for page, items in FIGS.items():
        lst = []
        for kind, ref, caption, alt in items:
            try:
                if kind == "commons":
                    if ref not in cache:
                        cache[ref] = commons_info(ref)
                        FIG_CACHE.write_text(json.dumps(cache, ensure_ascii=False, indent=0))
                    info = dict(cache[ref])
                elif kind == "best":
                    r = best_rec(ref, rows, used)
                    if not r:
                        raise RuntimeError("no garment matches")
                    ref = r["id"]
                    info = rec_info(ref, rows)
                else:
                    info = rec_info(ref, rows)
                if kind != "commons":
                    r = rows[ref]
                    used.add(ref)
                    caption = caption.format(t=r["t"], d=r["d"], cul=r.get("cul") or dict(GROUPS)[r["g"]])
            except Exception as e:
                missing.append(f"{page}: {ref} ({e})")
                continue
            lst.append(dict(src=info["src"], w=info["w"], h=info["h"], alt=alt, caption=caption, credit=info["credit"],
                            license=info["license"], licenseUrl=info["licenseUrl"], commons=info["commons"]))
        out[page] = lst
    # write into data/images.js: replace this tool's own block (between the markers), never touch other entries
    p = ROOT / "data" / "images.js"
    src = p.read_text()
    a, b = "\n// ---- fashion pages (tools/fashion.py figs) ----\n", "// ---- end fashion pages ----\n"
    if a in src:
        src = src[:src.index(a)] + src[src.index(b) + len(b):]
    body = "".join(f"window.WIKI_IMAGES[{json.dumps(k)}] = [\n" + ",\n".join("  " + json.dumps(x, ensure_ascii=False) for x in v) + "\n];\n"
                   for k, v in out.items())
    src = src.rstrip("\n") + "\n" + a + body + b
    p.write_text(src)
    print(f"figs: {sum(len(v) for v in out.values())} images on {len(out)} pages")
    for m in missing:
        print("   missing", m)


# ---------------------------------------------------------------------------------------------
# check: the fashion pages and their images (tools/check_wiki.js checks body text; this checks the rest)
# ---------------------------------------------------------------------------------------------
NODE_DUMP = r"""
const fs = require("fs"), W = {};
for (const f of ["colors.js", "wiki-seed.js", "wiki-nodes.js", "images.js", "paintings.js"]) {
  const p = "data/" + f; if (fs.existsSync(p)) new Function("window", fs.readFileSync(p, "utf8"))(W);
}
const colors = [...W.DATA.basics.map(b => b[0]), ...W.DATA.units.flatMap(u => u.colors.map(c => c.n))];
const ids = [...W.WIKI_SEED.nodes.map(n => n[0]), ...W.WIKI_SEED.paintings.map(n => n[0]), ...W.WIKI_NODES.map(n => n.id), ...(W.PAINTINGS || []).map(p => p.id)];
console.log(JSON.stringify({ colors, ids, pages: W.WIKI_NODES.filter(n => n.fx), images: W.WIKI_IMAGES || {} }));
"""


def check():
    import subprocess
    d = json.loads(subprocess.run(["node", "-e", NODE_DUMP], cwd=ROOT, capture_output=True, text=True, check=True).stdout)
    colors, ids = {c.lower() for c in d["colors"]}, set(d["ids"])
    era_keys, group_keys = {k for k, *_ in ERAS}, {k for k, _ in GROUPS}
    errs, warns = [], []
    plain = lambda t: re.sub(r"\[\[([^\]|]+)(?:\|([^\]]+))?\]\]", lambda m: m.group(2) or m.group(1), t)
    for n in d["pages"]:
        w = n["id"]
        fx = n.get("fx") or {}
        if fx.get("e") not in era_keys or fx.get("g") not in group_keys or not isinstance(fx.get("y"), int):
            errs.append(f"{w}: fx needs y (int), e (era key) and g (group key)")
        imgs = d["images"].get(w, [])
        if len(imgs) < 4:
            warns.append(f"{w}: only {len(imgs)} images (aim 4-8)")
        for k, im in enumerate(imgs):
            for f in ("src", "w", "h", "alt", "caption", "credit", "license", "commons"):
                if not im.get(f):
                    errs.append(f"{w} image {k}: missing {f}")
        for i, sec in enumerate(n.get("sections") or []):
            texts = sec["text"] if isinstance(sec["text"], list) else [sec["text"]]
            if not sec.get("title"):
                errs.append(f"{w} section {i}: needs a title")
            for t in texts:
                if len(plain(t)) > 900:
                    errs.append(f"{w} section {i}: paragraph {len(plain(t))} chars (max 900)")
                for m in re.finditer(r"\[\[([^\]|]+)(?:\|([^\]]+))?\]\]", t):
                    tgt = m.group(1).strip()
                    if tgt.lower() not in colors and tgt not in ids:
                        errs.append(f"{w} section {i}: link [[{tgt}]] goes nowhere")
                for q in re.findall(r"[“\"]([^”\"]+)[”\"]", t):
                    if len(q.split()) > 15:
                        errs.append(f"{w} section {i}: quote over 15 words")
            if "img" in sec and sec["img"] is not None and sec["img"] >= len(imgs):
                errs.append(f"{w} section {i}: img {sec['img']} but only {len(imgs)} images")
    g = OUT / "garments.json"
    if g.exists():
        rows = json.loads(g.read_text())["rows"]
        for r in rows:
            if abs(sum(c[1] for c in r["p"]) - 1) > .02 or not all(re.match(r"^#[0-9A-F]{6}$", c[0]) for c in r["p"]):
                errs.append(f"garment {r['id']}: bad palette")
            if r.get("e") not in era_keys or r.get("g") not in group_keys:
                errs.append(f"garment {r['id']}: bad era or group")
    for m in warns:
        print("warn  " + m)
    for m in errs:
        print("FAIL  " + m)
    print(f"fashion check: {len(errs)} failures, {len(warns)} warnings ({len(d['pages'])} pages)")
    return not errs


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "all"
    if cmd == "ids":
        met_ids()
    elif cmd == "meta":
        cma_meta(); aic_meta(); met_meta()
    elif cmd == "images":  # optional: images aic,cma
        download_images(sys.argv[2].split(",") if len(sys.argv) > 2 else None)
    elif cmd == "palettes":
        run_palettes()
    elif cmd == "build":
        build()
    elif cmd == "figs":
        figs()
    elif cmd == "check":
        sys.exit(0 if check() else 1)
    elif cmd == "sheet":
        sheet(*sys.argv[2:])
    elif cmd == "all":
        met_ids(); cma_meta(); aic_meta(); met_meta(); download_images(); run_palettes(); build()
    else:
        print(__doc__)
