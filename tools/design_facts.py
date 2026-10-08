#!/usr/bin/env python3
"""Flags, parties and organizations as color facts for the Color Graph. Source: Wikidata (CC0) and the Wikimedia
Commons flag files; keyless. Writes data/design/graph-facts.json.

  python3 tools/design_facts.py [--resume]

What it records, and how honestly:
  flags   The ~197 sovereign states' national flags (Wikidata: instance of sovereign state, P41 flag image, no end date).
          Each flag's file on Wikimedia Commons is read through Commons' own PNG rendering
          (Special:FilePath/<file>?width=300). A flag's colors are the exact fill colors in that rendering, merged when
          within dE2000 3, kept when they cover at least 1.5% of the flag. So the shares are the drawn area, the hex values
          are Commons' editors' sRGB for the flag, and both are "as drawn on Commons", not the legal specification (laws
          and conventions give a Pantone or a word; Commons editors choose the sRGB). Only colors are kept: no image is
          stored or shown.
  parties Political parties (Wikidata Q7278) that carry their own sRGB hex (P465), with at least 12 Wikipedia language
          editions (a proxy for "notable"). The hex is Wikidata's, entered by editors from the party's own style guide
          or logo; it is a fact about the party, not a measurement.
  orgs    Organizations (clubs, universities, companies, bodies) whose official color (P6364) is a named shade that has
          its own hex (P465) on the color item, e.g. "UN blue" 009EDB, with at least 12 language editions. The very
          generic colors (red, blue, white, black, green, yellow, ...) are skipped: Wikidata gives them the pure screen
          hex (blue 0000FF), which says nothing about the real shade a club wears.
No logos, no images of trademarks: the name, the color word and the hex only. Trademarks are facts about who uses
which color, nothing more.
"""
import io, json, re, sys, time, urllib.parse, urllib.request
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
import corpus as C  # noqa: E402

RAW = ROOT / "research" / "_raw" / "facts"
OUT = ROOT / "data" / "design" / "graph-facts.json"
UA = "ColorHubBot/1.0 (https://github.com/dmekibel/colorhub)"
GENERIC = {"white", "blue", "red", "black", "green", "yellow", "orange", "purple", "pink", "grey", "gray", "gold",
           "silver", "brown", "cyan", "magenta", "violet", "aqua", "azure", "sky blue", "navy blue", "dark blue",
           "light blue", "dark green", "light green", "maroon", "crimson", "lilac", "turquoise", "amber", "emerald",
           "wine", "bordeaux", "garnet", "royal blue", "cherry blossom pink"}
_last = [0.0]


def get(url, binary=False, tries=5):
    for i in range(tries):
        wait = 1.2 - (time.time() - _last[0])
        if wait > 0:
            time.sleep(wait)
        _last[0] = time.time()
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/sparql-results+json"})
            with urllib.request.urlopen(req, timeout=120) as r:
                b = r.read()
            return b if binary else json.loads(b.decode())
        except Exception as e:
            print(f"   fetch failed ({str(e)[:80]}); retry in {5 * (i + 1)}s", flush=True)
            time.sleep(5 * (i + 1))
    raise RuntimeError(url)


def sparql(q):
    return get("https://query.wikidata.org/sparql?format=json&query=" + urllib.parse.quote(q))["results"]["bindings"]


def val(b, k):
    return b[k]["value"] if k in b else None


def qid(uri):
    return uri.rsplit("/", 1)[-1] if uri else None


# ---------------------------------------------------------------------------------------------
def flag_colors(png):
    im = Image.open(io.BytesIO(png)).convert("RGBA")
    a = np.asarray(im)
    opaque = a[..., 3] > 200
    rgb = a[..., :3][opaque].reshape(-1, 3)
    if len(rgb) == 0:
        return []
    cols, cnt = np.unique(rgb, axis=0, return_counts=True)
    order = np.argsort(-cnt)
    cols, cnt = cols[order], cnt[order]
    # merge anti-aliasing blends and near-identical fills into the commoner color
    lab = C.rgb_to_lab(cols.astype(np.float64))
    keep = []  # [index of dominant, count]
    for i in range(len(cols)):
        for k in keep:
            if C.de2000(lab[i:i + 1], lab[k[0]:k[0] + 1])[0, 0] < 3.0:
                k[1] += cnt[i]
                break
        else:
            keep.append([i, int(cnt[i])])
    tot = sum(k[1] for k in keep)
    out = [(C.rgb_to_hex(cols[i]), n / tot) for i, n in keep if n / tot >= 0.015]
    s = sum(x[1] for x in out)
    return [(h, round(v / s, 4)) for h, v in out]


def build_flags(resume):
    p = RAW / "flags.json"
    if resume and p.exists():
        return json.loads(p.read_text())
    rows = sparql("""SELECT ?c ?cLabel ?flag WHERE { ?c wdt:P31 wd:Q3624078 . ?c wdt:P41 ?flag .
        FILTER NOT EXISTS { ?c wdt:P576 ?end } SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } }""")
    by = {}
    for b in rows:
        by.setdefault(qid(val(b, "c")), (val(b, "cLabel"), val(b, "flag")))
    out = []
    for i, (q, (name, flag)) in enumerate(sorted(by.items(), key=lambda kv: kv[1][0])):
        fname = urllib.parse.unquote(flag.rsplit("/", 1)[-1])
        url = "https://commons.wikimedia.org/wiki/Special:FilePath/" + urllib.parse.quote(fname) + "?width=300"
        try:
            cols = flag_colors(get(url, binary=True))
        except Exception as e:
            print(f"   {name}: {e}", flush=True)
            continue
        out.append(dict(q=q, name=name, file=fname, cols=cols))
        if i % 25 == 0:
            print(f"flags {i}/{len(by)}", flush=True)
    RAW.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(out, ensure_ascii=False))
    return out


def build_parties(resume):
    p = RAW / "parties.json"
    if resume and p.exists():
        return json.loads(p.read_text())
    rows = sparql("""SELECT ?o ?oLabel ?hex ?sl ?cLabel WHERE { ?o wdt:P31 wd:Q7278 . ?o wdt:P465 ?hex .
        ?o wikibase:sitelinks ?sl . FILTER(?sl >= 12) OPTIONAL { ?o wdt:P17 ?c }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } }""")
    out = {}
    for b in rows:
        q = qid(val(b, "o"))
        out.setdefault(q, dict(q=q, name=val(b, "oLabel"), hex="#" + val(b, "hex").upper(), sl=int(val(b, "sl")),
                               country=val(b, "cLabel")))
    out = sorted(out.values(), key=lambda r: -r["sl"])
    RAW.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(out, ensure_ascii=False))
    return out


def build_orgs(resume):
    p = RAW / "orgs.json"
    if resume and p.exists():
        return json.loads(p.read_text())
    rows = sparql("""SELECT ?o ?oLabel ?c ?cLabel ?hex ?sl ?tLabel WHERE { ?o wdt:P6364 ?c . ?c wdt:P465 ?hex .
        ?o wikibase:sitelinks ?sl . FILTER(?sl >= 12) OPTIONAL { ?o wdt:P31 ?t }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } }""")
    out = {}
    for b in rows:
        cl = (val(b, "cLabel") or "").strip()
        if cl.lower() in GENERIC or re.match(r"^Q\d+$", val(b, "oLabel") or ""):
            continue
        key = (qid(val(b, "o")), qid(val(b, "c")))
        r = out.setdefault(key, dict(q=key[0], name=val(b, "oLabel"), color=cl, hexes=set(), sl=int(val(b, "sl")),
                                     kind=val(b, "tLabel")))
        r["hexes"].add("#" + val(b, "hex").upper())
    res = []
    for r in out.values():
        r["hexes"] = sorted(r["hexes"])
        if len(r["hexes"]) == 1:  # a color with two competing hex values is not a fact we can place
            r["hex"] = r.pop("hexes")[0]
            res.append(r)
    res.sort(key=lambda r: -r["sl"])
    RAW.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(res, ensure_ascii=False))
    return res


# ---------------------------------------------------------------------------------------------
def main():
    resume = "--resume" in sys.argv
    sys.path.insert(0, str(ROOT / "tools"))
    import design_corpus as D
    flags, parties, orgs = build_flags(resume), build_parties(resume), build_orgs(resume)
    core = D.core()

    def name_hexes(hexes):
        labs = C.rgb_to_lab(np.array([C.hex_to_rgb(h) for h in hexes], dtype=np.float64))
        return D.name_labs(labs)

    out = dict(built=time.strftime("%Y-%m-%d"), source="Wikidata (CC0) and Wikimedia Commons flag files",
               note=("Colors named with the app's ~1,000 core names (nearest by CIEDE2000; de is the distance). "
                     "Flag colors are the exact fills of the Commons rendering, shares are drawn area, not legal "
                     "specifications. Party and organization hexes are Wikidata editors' values from the body's own "
                     "identity guidelines, entered by hand: facts about who uses which color, not measurements. "
                     "No logos or images are stored."),
               flags=[], parties=[], orgs=[])
    for f in flags:
        if not f["cols"]:
            continue
        ci, de = name_hexes([c[0] for c in f["cols"]])
        out["flags"].append(dict(q=f["q"], n=f["name"], f=f["file"],
                                 c=[[h, s, int(ci[i]), round(float(de[i]), 1)] for i, (h, s) in enumerate(f["cols"])]))
    if parties:
        ci, de = name_hexes([x["hex"] for x in parties])
        out["parties"] = [dict(q=x["q"], n=x["name"], h=x["hex"], ci=int(ci[i]), de=round(float(de[i]), 1),
                               co=x.get("country"), sl=x["sl"]) for i, x in enumerate(parties)]
    if orgs:
        ci, de = name_hexes([x["hex"] for x in orgs])
        out["orgs"] = [dict(q=x["q"], n=x["name"], k=x.get("kind"), cn=x["color"], h=x["hex"], ci=int(ci[i]),
                            de=round(float(de[i]), 1), sl=x["sl"]) for i, x in enumerate(orgs)]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
    print(f"flags {len(out['flags'])}, parties {len(out['parties'])}, orgs {len(out['orgs'])}; "
          f"{OUT.stat().st_size / 1e3:.0f} KB")
    # which core names the flags use most
    cnt = Counter()
    for f in out["flags"]:
        for c in f["c"]:
            if c[3] <= 10:
                cnt[core["n"][c[2]]] += 1
    print("most common flag colors:", cnt.most_common(12))


if __name__ == "__main__":
    main()
