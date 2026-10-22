"""Nationalmuseum, Stockholm: the museum's own open API (https://api.nationalmuseum.se/api/objects, 100 per page, 1 request/s,
no key). The API has no filter parameter, so every page is read once and cached in $STAGE_SCRATCH/raw/nm (resumable).
Kept: category "Målningar (Måleri)" whose image licence is stated as "Public Domain", with an IIIF image base. Dropped: portrait
miniatures, stage scenery, rows with no image licence or a rights-holder licence. `img` is the IIIF 400 px URL; nothing is downloaded.
Attributions with a qualifier (school of, after, circle of ...) keep the row but not the artist name."""
import json
import os
import re
import sys
import time
import urllib.request
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import wd  # noqa: E402
from lib import C, OUT, SCR, Held, clean, NON_WESTERN_CO  # noqa: E402

UA = "Chromatlas/1.0 (https://chromatlas.app; dmekibel@gmail.com)"
RAW = SCR / "raw" / "nm"
RAW.mkdir(parents=True, exist_ok=True)
NAT = {"svensk": "Sweden", "fransk": "France", "italiensk": "Italy", "nederländsk": "Netherlands", "holländsk": "Netherlands",
       "tysk": "Germany", "flamländsk": "Belgium", "belgisk": "Belgium", "spansk": "Spain", "engelsk": "United Kingdom",
       "brittisk": "United Kingdom", "skotsk": "United Kingdom", "dansk": "Denmark", "norsk": "Norway", "finsk": "Finland",
       "rysk": "Russia", "österrikisk": "Austria", "schweizisk": "Switzerland", "schweizerisk": "Switzerland", "amerikansk": "United States",
       "polsk": "Poland", "portugisisk": "Portugal", "ungersk": "Hungary", "tjeckisk": "Czechia", "böhmisk": "Czechia"}


def crawl():
    pg, total = 1, 2083   # corrected from the first live page
    while pg <= total:
        p = RAW / f"p{pg:05d}.json"
        if p.exists():
            pg += 1
            continue
        for t in range(6):
            try:
                time.sleep(1.0)
                req = urllib.request.Request(f"https://api.nationalmuseum.se/api/objects?limit=100&page={pg}", headers={"User-Agent": UA})
                d = json.load(urllib.request.urlopen(req, timeout=90))["data"]
                break
            except Exception as e:
                print("retry", pg, e, flush=True)
                time.sleep(5 * (t + 1))
        else:
            raise SystemExit(f"gave up on page {pg}")
        total = d["paging"]["total_pages"]
        keep = [{k: i.get(k) for k in ("id", "inventory_number", "iiif", "iiif_license", "title", "technique_material", "category",
                                       "object_type", "style", "dating", "assets", "loan")}
                | {"actors": [{k: a.get(k) for k in ("actor_full_name", "actor_nationality", "relation_type", "actor_role", "actor_qualifier")}
                              for a in i.get("actors") or []]} for i in d["items"]]
        p.write_text(json.dumps(keep, ensure_ascii=False))
        pg += 1
    return total


def main():
    crawl()
    held = Held()
    wd.other_staged_twins(held, "nationalmuseum")
    drops, rows, seen, held_n, total = Counter(), [], set(), 0, 0
    for f in sorted(RAW.glob("p*.json")):
        for x in json.loads(f.read_text()):
            if "Målningar" not in str((x["category"] or {}).get("en") or (x["category"] or {}).get("sv")):
                continue
            total += 1
            lic = (x.get("iiif_license") or {}).get("license")
            if x.get("object_type") and (x["object_type"].get("sv") or "") in ("Porträttminiatyr", "Teaterkuliss"):
                drops["miniature / stage scenery"] += 1
                continue
            if not x.get("iiif") or lic != "Public Domain":
                drops["no Public Domain image"] += 1
                continue
            rid = f"nm-{x['id']}"
            if rid in held.ids:
                held_n += 1
                continue
            if rid in seen:
                continue
            seen.add(rid)
            ti = x["title"] or {}
            t = ti.get("en") or ti.get("sv")
            dts = [d for d in (x.get("dating") or []) if d.get("date_earliest")]
            y = dts[0]["date_earliest"] if dts else None
            span = (dts[0]["date_latest"] - y) if dts and dts[0].get("date_latest") else None
            acts = [a for a in x["actors"] if a["relation_type"] == "Tillkomst"]
            a0 = acts[0] if acts else None
            name = None
            if a0 and not a0.get("actor_qualifier"):
                name = C.clean_artist(a0["actor_full_name"]) if a0["actor_full_name"] != "Ingen uppgift" else None
            co = NAT.get(((a0 or {}).get("actor_nationality") or "").lower()) if a0 else None
            r = dict(id=rid, src="nm", t=t, a=name, y=y, span=span, co=co, mv=None, img=x["iiif"].rstrip("/") + "/full/400,/0/default.jpg")
            if not name and y is None:
                drops["no artist and no date"] += 1
                continue
            why = clean(r)
            if why:
                drops[why] += 1
                continue
            if r["co"] in NON_WESTERN_CO:
                drops["non-Western"] += 1
                continue
            if held.is_twin(r):
                drops["artist+title+year twin of a held/staged row"] += 1
                continue
            held.add_twin(r)
            r["license"] = "PD"
            r["url"] = f"https://collection.nationalmuseum.se/eMP/eMuseumPlus?service=ExternalInterface&module=collection&objectId={x['id']}&viewType=detailView"
            rows.append({k: r.get(k) for k in ("id", "src", "t", "a", "y", "co", "mv", "img", "license", "url", "span")})
    rows.sort(key=lambda r: r["id"])
    for old in OUT.glob("zz-museum-nationalmuseum-*.json"):
        old.unlink()
    files = []
    for i in range(0, len(rows), 5000):
        p = OUT / f"zz-museum-nationalmuseum-{i // 5000 + 1}.json"
        p.write_text("[\n" + ",\n".join(json.dumps(r, ensure_ascii=False, separators=(",", ":")) for r in rows[i:i + 5000]) + "\n]\n")
        files.append(p.name)
    st = dict(museum="nationalmuseum", source="api.nationalmuseum.se", paintings_in_api=total, already_held=held_n, new_staged=len(rows),
              dropped=dict(drops), files=files, no_artist=sum(1 for r in rows if not r["a"]))
    (SCR / "stats").mkdir(exist_ok=True)
    (SCR / "stats" / "nationalmuseum.json").write_text(json.dumps(st, indent=1))
    print(json.dumps(st), flush=True)


if __name__ == "__main__":
    main()
