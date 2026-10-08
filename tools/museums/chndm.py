"""Cooper Hewitt, Smithsonian Design Museum, through the Smithsonian Open Access bulk data. No key, no API.

Route:   s3://smithsonian-open-access (public bucket, https://smithsonian-open-access.s3-us-west-2.amazonaws.com/):
         metadata/edan/chndm/00.txt ... ff.txt, 256 files of line-delimited JSON (EDAN "edanmdm" records), about
         240 MB in all, CC0 (Smithsonian Open Access, https://www.si.edu/openaccess). This is the keyless
         alternative to api.si.edu, which needs a free api.data.gov key. Nothing is signed up for.
         (Cooper Hewitt's own repo, github.com/cooperhewitt/collection, is a mirror of the same records.)
Kept:    a record with an image whose media usage.access is CC0, whose department (setName) is one of the four
         design departments, and whose object type maps to a design category (see CATEGORY). Date from the
         record's date text (first year found, else the decade string, else the century midpoint).
Images:  https://ids.si.edu/ids/deliveryService?id=<idsId>&max=300  (the Smithsonian Image Delivery Service resizes
         on request; CC0 media only). The row's img is that URL. Only a 200 px copy is cached, in research/_raw.
Pace:    ~8 requests a second (the IDS is a CDN).
Maker:   the first "Designer", "Artist", "Maker", "Print Maker", "Manufacturer", "Company", "Architect" or
         "Embroiderer" name, in that order of preference, with the credited role kept in `role`.
"""
import json
import re
from pathlib import Path

from . import common

BASE = "https://smithsonian-open-access.s3-us-west-2.amazonaws.com/metadata/edan/chndm/"
INFO = dict(gap=0.12, workers=8, name="Cooper Hewitt, Smithsonian Design Museum",
            api="https://www.si.edu/openaccess (bulk data, no key)", license="CC0 (Smithsonian Open Access)")
IDS = "https://ids.si.edu/ids/deliveryService?id="

DEPT = {"Drawings, Prints, and Graphic Design Department": "gp", "Textiles Department": "tx",
        "Product Design and Decorative Arts Department": "pd", "Wallcoverings Department": "wc"}
ROLE_ORDER = ["Designer", "Artist", "Maker", "Print Maker", "Illustrator", "Architect", "Embroiderer", "Engraver",
              "Manufacturer", "Company", "Creator", "Attributed to", "Probably", "Possibly", "Publisher"]

# object type (Cooper Hewitt's own controlled vocabulary + free text) -> design category.
# Order matters: the first rule that matches wins. Departments break ties.
RULES = [
    ("poster", r"\bposters?\b|broadsides?|handbills?|placards?|billboards?|advertisement|advertising"),
    ("wallpaper", r"wall ?covering|wallpaper|wall facing|wall hanging|fill papers?|ceiling papers?|borders? \(ornament|"
                  r"friezes?|panel papers?|sample, wall|dado"),
    ("textile", r"textiles?|embroider|lace|needlework|samplers?|tapestr|brocade|damask|velvet|fabric|trimm|woven|"
                r"printed cotton|ribbon|carpets?|rugs?|coverlets?|quilt|shawl|handkerchief|upholstery|braid|tassel|"
                r"passementerie|towel|linen|bandboxes"),
    ("costume", r"costume|dress|garments?|apparel|hats?|shoes?|gloves?|fans?\b|parasol|umbrella|jewelry|ornament,|"
                r"buttons?|buckles?|handbags?|purses?|bags?\b"),
    ("ceramics", r"ceramic|porcelain|earthenware|stoneware|pottery|tile\b|tiles\b|plates?\b|vases?|cup|saucer|"
                 r"teapot|bowls?|jugs?|pitchers?|figurines?|figures? \(rep|dish|mugs?|tureen|platter|faience|majolica"),
    ("glass", r"glass|bottles?|goblet|tumbler|decanter|stained"),
    ("furniture", r"furniture|chairs?\b|tables?\b|desks?|cabinets?|sofa|beds?\b|stools?|lamps?\b|lighting|"
                  r"clocks?|mirror|screens?\b|shelf|shelves|cupboard"),
    ("product", r"product|appliance|radio|telephone|camera|typewriter|toasters?|razor|watches?|flatware|cutlery|"
                r"spoons?|forks?|knives|silver|metalwork|tableware|utensil|kettle|container|tool|toys?|games?\b|"
                r"playing cards|machine|model|equipment|housewares|bowl|tray|candle|lantern|vessel"),
    ("graphic", r"graphic|book|magazine|periodical|cover|label|package|packaging|trade card|ephemera|bookplate|"
                r"ex libris|calendar|catalog|brochure|stationery|letterhead|typograph|type specimen|alphabet|"
                r"lettering|logo|greeting|valentine|postcard|card\b|sheet music|illustrat|print|bound|album|"
                r"sketchbook|design drawing|newspaper"),
]
RX = [(c, re.compile(p, re.I)) for c, p in RULES]
DEPT_DEFAULT = {"tx": "textile", "wc": "wallpaper", "pd": "product", "gp": None}
# Fine-art drawing / print / study types in the graphics department that are not graphic design.
FINE = re.compile(r"^(drawings?|studies|sketch|figure study|landscapes?|seascapes?|portraits?|interior views|"
                  r"mural paintings|cityscapes|architectural|religious|genre|still lifes?|prints?)\b", re.I)


def shards(raw_dir):
    return sorted(Path(raw_dir).glob("*.txt"))


def year_of(text):
    """Year (midpoint) read from a date text, or None when it is too vague to place in a decade: centuries
    ("19th century"), round-hundred decades ("1900s" can mean the century), ranges wider than 25 years. A range
    ("1850-1860") gives its midpoint; "ca. 1925" gives 1925; a decade ("1920s") gives its midpoint."""
    if not text or re.search(r"century|unknown|undated", text, re.I):
        return None
    ys = [int(n) for n in re.findall(r"(?<!\d)(1[0-9]{3}|20[0-2][0-9])(?!\d)", text)]
    if ys and not re.search(r"\d0s", text):
        lo, hi = min(ys), max(ys)
        return (lo + hi) // 2 if hi - lo <= 25 else None
    m = re.fullmatch(r"\s*(1[0-9][1-9]0)s\s*", text)  # 1810s ... 1990s, not 1800s / 1900s
    if m:
        return int(m.group(1)) + 5
    return None


def parse(line):
    r = json.loads(line)
    c = r.get("content", {})
    fr, ix, dn = c.get("freetext", {}), c.get("indexedStructured", {}), c.get("descriptiveNonRepeating", {})
    media = [m for m in (dn.get("online_media", {}) or {}).get("media", []) if m.get("type") == "Images"
             and (m.get("usage", {}) or {}).get("access") == "CC0" and m.get("idsId")]
    dept = next((DEPT[s["content"]] for s in fr.get("setName", []) if s.get("content") in DEPT), None)
    types = [t["content"] for t in fr.get("objectType", []) if t.get("content")] + ix.get("object_type", [])
    names = {}
    for n in fr.get("name", []):
        names.setdefault(n.get("label"), []).append(n.get("content"))
    maker, role = None, None
    for lab in ROLE_ORDER:
        if lab in names:
            maker, role = common.artist_name(re.sub(r",\s*\d{4}.*$", "", names[lab][0])), lab
            if maker:
                break
    dates = [d["content"] for d in fr.get("date", [])]
    y = next((year_of(d) for d in dates if year_of(d)), None)
    if y is None:  # the structured list runs wide to narrow ("1600s", "1690s"): the narrowest decade
        y = next((year_of(d) for d in reversed(ix.get("date", [])) if year_of(d)), None)
    place = next((p["content"] for p in fr.get("place", []) if p.get("label") in ("made in", "manufactured in",
                 "possibly made in", "probably made in", "published in")), None)
    acc = next((i["content"] for i in fr.get("identifier", [])), None)
    desc = next((n["content"] for n in fr.get("notes", []) if n.get("label") == "Description"), "")
    return dict(id=r["id"], acc=acc, title=r.get("title") or dn.get("title", {}).get("content"), dept=dept,
                types=types, maker=maker, role=role, date=dates[0] if dates else None, y=y, place=place,
                medium=next((p["content"] for p in fr.get("physicalDescription", []) if p.get("label") == "Medium"), ""),
                desc=desc[:200], media=[m["idsId"] for m in media], link=dn.get("record_link"),
                credit=next((x["content"] for x in fr.get("creditLine", [])), None))


def category(x):
    types = " | ".join(x["types"] + [x.get("title") or ""])
    dept = x["dept"]
    if dept == "gp" and x["types"] and all(FINE.match(t) for t in x["types"][:2]) and \
            not re.search(r"poster|design|graphic|book|label|card|advertis|ephemera|alphabet|bookplate", types, re.I):
        return None
    for cat, rx in RX:
        if rx.search(types):
            if dept == "gp" and cat in ("product", "ceramics", "glass", "furniture", "costume") and \
                    not re.search(r"design drawing|product|model", types, re.I):
                continue
            return cat
    return DEPT_DEFAULT.get(dept)


def meta(C, resume=False):
    d = C.SRC["chndm"]["dir"]
    sd = d / "shards"
    sd.mkdir(parents=True, exist_ok=True)
    for i in range(256):
        p = sd / f"{i:02x}.txt"
        if not (resume and p.exists() and p.stat().st_size):
            C.download("chndm", BASE + p.name, p)
            print(f"chndm shard {p.name}", flush=True)
    rows = []
    for p in shards(sd):
        for line in p.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            x = parse(line)
            if not x["media"] or not x["dept"] or x["y"] is None:
                continue
            x["cat"] = category(x)
            if x["cat"]:
                rows.append(x)
    return C.write_meta("chndm", rows)


def group_key(C, x):
    return f"chndm:{x['id']}"


def image_urls(x):
    return [IDS + x["media"][0] + "&max=300"]


def norm(C, x):
    t = (x.get("title") or "").strip()
    return dict(id=f"chndm-{x['acc'] or x['id']}", src="chndm", t=C.clean_title(t), a=x["maker"], y=x["y"],
               co=C.country_of(x.get("place")), cat=x["cat"], ty=(x["types"] or [""])[0][:40], img=image_urls(x)[0],
               url=x["link"])
