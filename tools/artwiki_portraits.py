#!/usr/bin/env python3
"""ColorHub art wiki: a portrait for every painter page, and the rail of most-famous works.

  python3 tools/artwiki_portraits.py [--raw DIR] [--offline] [--limit N]
      -> data/artists/portraits.json   {v, built, a: {<slug>: {portrait, famous}}}

Portrait, in priority order (David, 2026-10-09):
  1. A self-portrait in our own corpus: one of the painter's own paintings here whose title matches
     self-portrait / autoportrait / zelfportret / selbstbildnis / autorretrato / autoritratto.
  2. Wikidata's P18 image for the painter (data/artists/meta.json's "img"), but only when the Commons file's
     own license metadata says public domain / CC0 -- checked live against commons.wikimedia.org's API, not
     assumed. Rejects anything else (a living painter's copyrighted press photo, for one).
  3. A portrait of this painter, painted by someone else, found in our own corpus: a painting whose title
     contains "portrait" and the painter's name, by a different artist.
  4. None. js/artwiki.js falls back to the painter's signature palette as a calm field (no image needed).

Famous works, in priority order: Wikidata sitelinks count + "notable work" (P800) for the painter's own
Commons-sourced paintings here (most corpus ids keep their Wikidata Q id as "commons-Q<id>"); when a painter
has no Commons-Q paintings (most museum-sourced painters), falls back to an honest reach signal already
computed by tools/analyze.py: how much of the painter's own measured signature colors (data/artists/p/<slug>.json
"sig", lift over the same museums) each painting's barcode carries. Never invented; always says which it used.
"""
import argparse, hashlib, json, re, sys, time, urllib.parse, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
AW = ROOT / "data" / "artists"
AN = ROOT / "data" / "analysis"
GAL = ROOT / "data" / "gallery"

UA = "ColorHub/1.0 (https://dmekibel.github.io/colorhub/; dmekibel@gmail.com) painter-page portraits + famous works"
WD_ENDPOINT = "https://query.wikidata.org/sparql"
COMMONS_API = "https://commons.wikimedia.org/w/api.php"

SELF_RE = re.compile(r"self[\s-]?portrait|autoportrait|zelfportret|selbstbildnis|autorretrato|autoritratto", re.I)
PORTRAIT_RE = re.compile(r"\bportrait\b", re.I)


def http_json(url, data=None, headers=None, raw_dir=None, key=None, offline=False):
    f = (raw_dir / f"{key}.json") if raw_dir and key else None
    if f and f.exists():
        return json.loads(f.read_text())
    if offline:
        return None
    h = {"User-Agent": UA}
    h.update(headers or {})
    for attempt in range(4):
        try:
            req = urllib.request.Request(url, data=data, headers=h)
            with urllib.request.urlopen(req, timeout=60) as r:
                out = json.loads(r.read())
            if f:
                f.write_text(json.dumps(out))
            time.sleep(0.6)
            return out
        except Exception as e:
            print(f"  retry {attempt + 1} ({key}): {e}", flush=True)
            time.sleep(3 * (attempt + 1))
    print(f"  gave up on {key}", flush=True)
    return None


def sparql(query, raw_dir, key, offline):
    data = urllib.parse.urlencode({"query": query, "format": "json"}).encode()
    return http_json(WD_ENDPOINT, data=data, headers={"Accept": "application/sparql-results+json"},
                      raw_dir=raw_dir, key=key, offline=offline)


def qid(uri):
    return uri.rsplit("/", 1)[-1] if uri else None


def load_titles():
    """gi -> (id, title, artist). gi is the gallery index (ids.txt line order == data/gallery/d/ shard order)."""
    ids = (AW / "ids.txt").read_text().splitlines()
    out = [None] * len(ids)
    shards = sorted((GAL / "d").glob("*.json"), key=lambda p: int(p.stem))
    gi = 0
    for sf in shards:
        rows = json.loads(sf.read_text())
        for row in rows:
            out[gi] = (row[0], row[1], row[2])
            gi += 1
    id2gi = {x: i for i, x in enumerate(ids)}
    return out, id2gi, ids


def find_self_portrait(ix, titles):
    for gi in ix:
        row = titles[gi] if gi < len(titles) else None
        if row and SELF_RE.search(row[1] or ""):
            return gi, row[1]
    return None, None


def find_portrait_by_other(name, titles, own_ids):
    # only an exact "Portrait of <full name>" (the painter's full name, not just a shared surname -- we hit a
    # false match this way: "Portrait of Olivier van den Tempel" surfacing for the painter Abraham van den
    # Tempel, a different person who happens to share a last name). Precision over recall: better to show the
    # calm signature-color field than someone else's portrait captioned as this painter's.
    needle = "of " + name.lower()
    for gi, row in enumerate(titles):
        if row is None or row[0] in own_ids:
            continue
        _id, title, artist = row
        tl = (title or "").lower()
        if PORTRAIT_RE.search(tl) and needle in tl:
            return (gi, title, artist)
    return None


def commons_direct_url(filename):
    """The direct upload.wikimedia.org URL (same one Special:FilePath redirects to), computed from Commons'
    md5(filename)-bucketed path -- so the browser fetches it in one hop, with upload.wikimedia.org's own
    Access-Control-Allow-Origin: * (the Special:FilePath redirect chain's first hop doesn't send CORS headers,
    which silently fails a crossorigin="anonymous" <img> in a real browser)."""
    u = filename.replace(" ", "_")
    h = hashlib.md5(u.encode("utf-8")).hexdigest()
    return f"https://upload.wikimedia.org/wikipedia/commons/{h[0]}/{h[0:2]}/{urllib.parse.quote(u)}"


def looks_like_own_work(filename, name):
    """Commons names a painting '<subject> (<painter>).ext' when the file IS a work the painter made of someone
    else -- a real Wikidata miscategorization we hit (P18 pointing at one of their own paintings, not a portrait
    of them). Reject that shape so we don't caption a painter's own landscape as "Portrait"."""
    parts = [p for p in re.split(r"\s+", name.strip()) if len(p) > 2]
    last = parts[-1] if parts else name
    return bool(re.search(r"\(\s*(?:[\w.]+\s+)*" + re.escape(last) + r"\s*\)", filename, re.I))


def strip_html(s):
    return re.sub(r"<[^>]+>", " ", s or "")


def commons_meta(filename, raw_dir, offline, cache):
    """(license_ok, portrait_ok) for a Commons file, cached once per filename. license_ok: public domain / CC0.
    portrait_ok: the file's own title/description says "portrait" somewhere -- Wikidata's P18 sometimes points at
    a painter's own painting of someone or something else entirely (we hit this: a Dutch Golden Age allegory used
    as a painter's "image"), so we don't trust P18 alone to mean "a portrait of this person"."""
    if filename in cache:
        return cache[filename]
    url = COMMONS_API + "?" + urllib.parse.urlencode({
        "action": "query", "titles": "File:" + filename, "prop": "imageinfo",
        "iiprop": "extmetadata", "format": "json"})
    key = "lic-" + re.sub(r"[^a-zA-Z0-9]+", "_", filename)[:120]
    out = http_json(url, raw_dir=raw_dir, key=key, offline=offline)
    lic_ok, pt_ok = False, bool(SELF_RE.search(filename) or PORTRAIT_RE.search(filename))
    if out:
        pages = out.get("query", {}).get("pages", {})
        for p in pages.values():
            info = (p.get("imageinfo") or [{}])[0]
            meta = info.get("extmetadata", {})
            lic = (meta.get("LicenseShortName", {}).get("value", "") or "")
            cats = (meta.get("Categories", {}).get("value", "") or "")
            obj = strip_html(meta.get("ObjectName", {}).get("value", "") or "")
            desc = strip_html(meta.get("ImageDescription", {}).get("value", "") or "")
            if re.search(r"public domain|cc0|cc-pd", lic, re.I) or re.search(r"\bpd-", cats, re.I):
                lic_ok = True
            if PORTRAIT_RE.search(obj) or PORTRAIT_RE.search(desc) or SELF_RE.search(obj) or SELF_RE.search(desc):
                pt_ok = True
    cache[filename] = (lic_ok, pt_ok)
    return cache[filename]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--raw")
    ap.add_argument("--offline", action="store_true")
    ap.add_argument("--limit", type=int)
    args = ap.parse_args()
    raw_dir = Path(args.raw) if args.raw else ROOT / "research" / "_raw" / "wikidata-portraits"
    raw_dir.mkdir(parents=True, exist_ok=True)

    meta = json.loads((AW / "meta.json").read_text())["a"]
    ge = json.loads((AW / "groups-extra.json").read_text())
    code2name = {k: v[0] for k, v in ge["colors"].items()}
    titles, id2gi, ids = load_titles()
    print(f"{len(meta)} painters, {len(titles)} corpus rows", flush=True)

    slugs = sorted(meta.keys())
    if args.limit:
        slugs = slugs[:args.limit]

    # ---- portraits ----
    license_cache = {}
    wd_candidates = []  # (slug, filename) still needing a license check
    out_a = {}
    for slug in slugs:
        m = meta[slug]
        pfile = AW / "p" / f"{slug}.json"
        if not pfile.exists():
            continue
        P = json.loads(pfile.read_text())
        ix = P.get("ix", [])
        gi, cap = find_self_portrait(ix, titles)
        if gi is not None:
            year = None
            afile = AN / "artists" / f"{slug}.json"
            if afile.exists() and gi < len(ids):
                self_id = ids[gi]
                for row in json.loads(afile.read_text()).get("barcode", []):
                    if row[0] == self_id:
                        year = row[1]
                        break
            out_a[slug] = {"portrait": {"src": "self", "gi": gi, "caption": cap, "year": year}}
            continue
        if m.get("img"):
            wd_candidates.append((slug, m["img"]))
            out_a[slug] = {"portrait": {"src": "wikidata-pending", "img": m["img"]}}
            continue
        own_ids = {ids[i] for i in ix if i < len(ids)}
        hit = find_portrait_by_other(m["n"], titles, own_ids)
        if hit:
            gi, title, artist = hit
            out_a[slug] = {"portrait": {"src": "other", "gi": gi, "caption": title, "by": artist}}
        else:
            out_a[slug] = {"portrait": {"src": "none"}}

    print(f"{sum(1 for v in out_a.values() if v['portrait']['src'] == 'self')} self-portraits in corpus", flush=True)
    print(f"{len(wd_candidates)} Wikidata portrait candidates to license-check", flush=True)
    for slug, filename in wd_candidates:
        m = meta[slug]
        lic_ok, pt_ok = commons_meta(filename, raw_dir, args.offline, license_cache)
        ok = lic_ok and pt_ok and not looks_like_own_work(filename, m["n"])
        if ok:
            self_ish = SELF_RE.search(filename) is not None
            out_a[slug]["portrait"] = {"src": "wikidata", "img": filename, "url": commons_direct_url(filename), "caption": "Self-portrait" if self_ish else "Portrait"}
        else:
            # license unclear or not public domain: fall through to "other painter's portrait" in our corpus,
            # else none
            m = meta[slug]
            P = json.loads((AW / "p" / f"{slug}.json").read_text())
            own_ids = {ids[i] for i in P.get("ix", []) if i < len(ids)}
            hit = find_portrait_by_other(m["n"], titles, own_ids)
            if hit:
                gi, title, artist = hit
                out_a[slug]["portrait"] = {"src": "other", "gi": gi, "caption": title, "by": artist}
            else:
                out_a[slug]["portrait"] = {"src": "none"}
    accepted = sum(1 for s in slugs if out_a.get(s, {}).get("portrait", {}).get("src") == "wikidata")
    print(f"{accepted} Wikidata portraits accepted, {len(wd_candidates) - accepted} rejected (license or not a portrait)", flush=True)

    # ---- famous works ----
    # 1. collect every commons-Q painting id across every painter who has one
    all_q = set()
    for slug in slugs:
        pfile = AW / "p" / f"{slug}.json"
        if not pfile.exists():
            continue
        P = json.loads(pfile.read_text())
        for gi in P.get("ix", []):
            if gi < len(ids) and ids[gi].startswith("commons-Q"):
                all_q.add(ids[gi].split("-", 1)[1])
    all_q = sorted(all_q)
    print(f"{len(all_q)} Commons-sourced paintings with a Wikidata id", flush=True)
    sitelinks = {}
    CH = 300
    for k in range(0, len(all_q), CH):
        chunk = all_q[k:k + CH]
        vals = " ".join("wd:" + q for q in chunk)
        q = f"SELECT ?p ?sl WHERE {{ VALUES ?p {{ {vals} }} ?p wikibase:sitelinks ?sl }}"
        res = sparql(q, raw_dir, f"sitelinks-{k // CH:03d}", args.offline)
        if res:
            for b in res["results"]["bindings"]:
                sitelinks[qid(b["p"]["value"])] = int(b["sl"]["value"])
        print(f"  sitelinks {min(k + CH, len(all_q))}/{len(all_q)}", flush=True)

    painter_qids = sorted({meta[s]["q"] for s in slugs if meta[s].get("q")})
    notable = {}  # painter qid -> set of notable-work qids
    ND = 150
    for k in range(0, len(painter_qids), ND):
        chunk = painter_qids[k:k + ND]
        vals = " ".join("wd:" + q for q in chunk)
        q = f"SELECT ?a ?w WHERE {{ VALUES ?a {{ {vals} }} ?a wdt:P800 ?w }}"
        res = sparql(q, raw_dir, f"notable-{k // ND:03d}", args.offline)
        if res:
            for b in res["results"]["bindings"]:
                notable.setdefault(qid(b["a"]["value"]), set()).add(qid(b["w"]["value"]))
        print(f"  notable works {min(k + ND, len(painter_qids))}/{len(painter_qids)}", flush=True)

    fame_real, fame_fallback = 0, 0
    for slug in slugs:
        if slug not in out_a:
            continue
        pfile = AW / "p" / f"{slug}.json"
        afile = AN / "artists" / f"{slug}.json"
        if not pfile.exists() or not afile.exists():
            continue
        P = json.loads(pfile.read_text())
        A = json.loads(afile.read_text())
        m = meta[slug]
        scores = {}
        pq = m.get("q")
        own_notable = notable.get(pq, set())
        for gi in P.get("ix", []):
            if gi >= len(ids) or not ids[gi].startswith("commons-Q"):
                continue
            q = ids[gi].split("-", 1)[1]
            sl = sitelinks.get(q, 0)
            score = sl + (500 if q in own_notable else 0)
            if score > 0:
                scores[gi] = score
        if scores:
            famous = sorted(scores, key=lambda g: -scores[g])[:8]
            out_a[slug]["famous"] = famous
            out_a[slug]["famousBy"] = "wikidata"
            fame_real += 1
        else:
            sig_by_name = {}
            for row in P.get("sig", []):
                c, lift = row[0], row[1]
                nm = code2name.get(str(c), code2name.get(c, "")).lower()
                if nm:
                    sig_by_name[nm] = max(sig_by_name.get(nm, 0), lift)
            best = []
            if sig_by_name:
                for id_, year, names in A.get("barcode", []):
                    gi = id2gi.get(id_)
                    if gi is None:
                        continue
                    sc = sum(sig_by_name.get((n or "").lower(), 0) for n in names)
                    if sc > 0:
                        best.append((gi, sc))
            best.sort(key=lambda x: -x[1])
            famous = [g for g, _ in best[:8]]
            if famous:
                out_a[slug]["famous"] = famous
                out_a[slug]["famousBy"] = "reach"
                fame_fallback += 1
            # else: leave "famous" unset -- the client shows the grid's natural order instead of a guess

    print(f"famous rail: {fame_real} by Wikidata signal, {fame_fallback} by our own reach signal, "
          f"{len(slugs) - fame_real - fame_fallback} with neither (grid order only)", flush=True)

    doc = {"v": 1, "built": time.strftime("%Y-%m-%d"),
           "source": "Portraits: our own corpus, or Wikidata P18 images whose Commons license is public domain. "
                      "Famous works: Wikidata sitelinks + notable-work (P800) for paintings with a Wikidata id; "
                      "otherwise ranked by the painter's own measured signature colors (data/artists/p/).",
           "a": out_a}
    (AW / "portraits.json").write_text(json.dumps(doc, separators=(",", ":"), ensure_ascii=False))
    print(f"wrote {AW / 'portraits.json'}", flush=True)


if __name__ == "__main__":
    main()
