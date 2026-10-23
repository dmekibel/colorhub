"""Germany/Britain staging (2026-10-23): Staedel, Bavarian State Painting Collections, Staatliche Museen zu Berlin, Museum Wales.
The museums' own channels are closed to a script (Staedel OAI needs a registered account; Pinakothek/SMB/Museum Wales have no
public API), so the paintings come from each museum's Wikidata collection (CC0 metadata) with the Wikimedia Commons image.
The image licence is read per file from Commons (extmetadata LicenseShortName): only CC0 / PD / CC BY / CC BY-SA are kept, anything
NC/ND/unknown is dropped. Rows: src <code>, id "<code>-<QID>", url = the Wikidata record, license as Commons states it.
Politeness: UA Chromatlas/1.0, one request at a time, maxlag=5, backoff on 429."""
import json, re, sys, time, urllib.parse
from collections import Counter
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import requests
import wd
from lib import C, OUT, SCR, Held, clean, NON_WESTERN_CO

MUS = {
    "staedel": [("Q163804", "Städel Museum")],
    "bsb": [("Q812285", "Bavarian State Painting Collections"), ("Q154568", "Alte Pinakothek"), ("Q170152", "Neue Pinakothek"),
            ("Q523652", "Schack Collection"), ("Q250195", "Pinakothek der Moderne")],
    "smb": [("Q165631", "Gemäldegalerie Berlin"), ("Q162111", "Alte Nationalgalerie"), ("Q162610", "National Gallery Berlin"),
            ("Q641630", "Berggruen Museum")],
    "wales": [("Q2046319", "Amgueddfa Cymru"), ("Q1321874", "National Museum Cardiff")],
}
sess = requests.Session()
sess.headers["User-Agent"] = wd.UA
_last = [0.0]
LIC = SCR / "raw" / "lic.json"
lic = json.loads(LIC.read_text()) if LIC.exists() else {}


def commons_lic(names):
    todo = [n for n in names if n not in lic]
    for i in range(0, len(todo), 40):
        part = todo[i:i + 40]
        for t in range(6):
            w = _last[0] + 1.5 - time.time()
            if w > 0:
                time.sleep(w)
            _last[0] = time.time()
            try:
                r = sess.get("https://commons.wikimedia.org/w/api.php", timeout=60, params=dict(
                    action="query", prop="imageinfo", iiprop="extmetadata", iiextmetadatafilter="LicenseShortName",
                    titles="|".join("File:" + n for n in part), format="json", maxlag=5, redirects=1))
                if r.status_code == 429:
                    time.sleep(15 * (t + 1))
                    continue
                d = r.json()
                if "error" in d:
                    time.sleep(5 * (t + 1))
                    continue
                break
            except Exception as e:
                print("  commons retry", e, flush=True)
                time.sleep(5 * (t + 1))
        else:
            raise RuntimeError("commons gave up")
        q = d.get("query", {})
        back = {}
        for x in q.get("normalized", []) + q.get("redirects", []):
            back[x["to"]] = x["from"]
        for pg in q.get("pages", {}).values():
            nm = "File:" + pg.get("title", "")[5:]
            nm = back.get(nm, nm)
            nm = back.get(nm, nm)[5:]
            em = (pg.get("imageinfo") or [{}])[0].get("extmetadata", {})
            lic[nm] = (em.get("LicenseShortName") or {}).get("value", "")
        for n in part:
            lic.setdefault(n, "")
        LIC.write_text(json.dumps(lic))
        if (i // 40) % 10 == 0:
            print(f"  licences {i + len(part)}/{len(todo)}", flush=True)


def norm_lic(s):
    s = (s or "").strip()
    if re.fullmatch(r"CC[ -]BY[ -]SA[ -]4\.0", s, re.I):
        return "CC BY-SA 4.0"
    if re.fullmatch(r"CC[ -]BY[ -]SA[ -]3\.0.*", s, re.I):
        return "CC BY-SA 3.0"
    if re.fullmatch(r"CC[ -]BY[ -]4\.0", s, re.I):
        return "CC BY 4.0"
    if re.fullmatch(r"CC[ -]BY[ -]3\.0.*", s, re.I):
        return "CC BY 3.0"
    if re.match(r"CC0|CC ?Zero", s, re.I):
        return "CC0"
    if re.match(r"(public domain|PD|Pubic domain)", s, re.I):
        return "PD"
    return None


def fname(img):
    m = re.search(r"Special:FilePath/([^?]+)", img or "")
    return urllib.parse.unquote(m.group(1)).replace("_", " ") if m else None


def run(code):
    held = Held()
    wd.other_staged_twins(held, code)
    raws = {}
    for qid, cl in MUS[code]:
        for b in wd.collection_items(f"wd:{qid}", f"{code}-{qid}"):
            raws.setdefault(b["q"], (b, cl))
    total = len(raws)
    rs = [wd.to_row(b, cl) for b, cl in raws.values()]
    labs = wd.english_labels([r["q"] for r in rs], f"{code}-all")
    drops, rows, seen, held_n, cand = Counter(), [], set(), 0, []
    for r in rs:
        r["t"] = labs.get(r["q"])
        r["id"] = f"{code}-{r['q']}"
        if not r["t"] or re.fullmatch(r"Q\d+", r["t"]):
            drops["no label"] += 1
            continue
        if r["id"] in held.ids or f"commons-{r['q']}" in held.ids:
            held_n += 1
            continue
        if r["id"] in held.staged_ids or f"commons-{r['q']}" in held.staged_ids:
            drops["already staged elsewhere"] += 1
            continue
        if wd.NOT_PAINTING.search(r["t"]):
            drops["title names a drawing/print/photo/sculpture/object"] += 1
            continue
        if not wd.pd_ok(r):
            drops["work not clearly PD (creator died after 1955 / undated)"] += 1
            continue
        if not r["a"] and r["y"] is None:
            drops["no artist and no date"] += 1
            continue
        cand.append(r)
    print(code, "candidates for licence check:", len(cand), flush=True)
    commons_lic([fname(r["img"]) for r in cand if fname(r["img"])])
    for r in cand:
        r["src"] = code
        if r["id"] in seen:
            drops["duplicate id"] += 1
            continue
        seen.add(r["id"])
        L = norm_lic(lic.get(fname(r["img"]) or "", ""))
        if not L:
            drops["image licence not CC0/PD/CC BY/CC BY-SA on Commons"] += 1
            continue
        why = clean(r)
        if why:
            drops[why] += 1
            continue
        if r["co"] in NON_WESTERN_CO:
            drops["non-Western painting, set aside"] += 1
            continue
        if held.is_twin(r):
            drops["artist+title+year twin of a held/staged row"] += 1
            continue
        held.add_twin(r)
        r["license"] = L
        r["url"] = "https://www.wikidata.org/wiki/" + r["q"]
        if L.startswith("CC BY"):  # attribution licences: own src code (tools/gallery.py SOURCES credit) and the Commons file page
            r["src"] = code + "cc"                      # as the record link, which shows the exact licence and author
            r["id"] = f"{r['src']}-{r['q']}"
            r["url"] = "https://commons.wikimedia.org/wiki/File:" + urllib.parse.quote(fname(r["img"]).replace(" ", "_"))
        rows.append({k: r.get(k) for k in ("id", "src", "t", "a", "y", "co", "mv", "img", "license", "url", "span")})
    rows.sort(key=lambda r: r["id"])
    for old in OUT.glob(f"zz-museum-{code}-*.json"):
        old.unlink()
    for i in range(0, len(rows), 5000):
        (OUT / f"zz-museum-{code}-{i // 5000 + 1}.json").write_text(
            "[\n" + ",\n".join(json.dumps(r, ensure_ascii=False, separators=(",", ":")) for r in rows[i:i + 5000]) + "\n]\n")
    st = dict(code=code, wd_paintings_with_image=total, already_held=held_n, new_staged=len(rows), dropped=dict(drops),
              licenses=dict(Counter(r["license"] for r in rows)), countries=dict(Counter(r["co"] for r in rows).most_common(6)))
    print(json.dumps(st, ensure_ascii=False), flush=True)
    (SCR / "stats").mkdir(exist_ok=True)
    (SCR / "stats" / f"{code}.json").write_text(json.dumps(st, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    for c in sys.argv[1:] or MUS:
        run(c)
