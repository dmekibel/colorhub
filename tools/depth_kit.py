#!/usr/bin/env python3
"""Depth kit assembler for the article DEPTH WAVE (design/articles-depth-brief.md).

    python3 tools/depth_kit.py aero                     # kit for one slug, printed as JSON
    python3 tools/depth_kit.py aero --out /tmp/aero.json
    python3 tools/depth_kit.py aero --field              # also run article_field.py's compute() (slow:
                                                          # loads the whole gallery index the first time)
    python3 tools/depth_kit.py --rank-all --out /tmp/queue.json   # cheap score() over every article, for
                                                          # tools/rank_depth_queue.py

Pulls together, read-only, every piece of real per-color material a writer needs to go past the
tier-default word count -- so depth comes from what we can show, not padding. One writer problem this
fixes directly: Aero's own color-graph node already carries a real dictionary "origin" ("Textile-trade
name.", data/sources/maerz-paul-1930-dictionary.json) that the live article missed, printing "The name's
link to aviation is not confirmed" instead. A kit surfaces that before a writer has to go looking.

Sections of the returned dict:
  node        data/graph/nodes-<letter>.json: hex, Lab/LCh/Munsell, the node's own *computed* nearest
              ISCC-NBS block ("iscc"), first-recorded year+source+plate ("src"/"fy"/"fs"), the filing
              reason ("why"), percentile rank in lightness/chroma ("pL"/"pC"), and its free-text "note".
  dictionary  data/sources/maerz-paul-1930-dictionary.json (1930 entry, incl. an "origin" paraphrase when
              Maerz & Paul printed one) and data/sources/mp-etymology.json (first-recorded year + a short
              paraphrased origin note). Two different extraction passes over the same 1930 book; use
              whichever has more in it, and say when they agree.
  iscc        data/sources/iscc-nbs-names.json + iscc-nbs-centroids.json: the REAL 1955 dictionary filing
              for this exact name, if the name was filed. article_lint.py pattern 2 exists because a
              Sonnet writer conflated this with the node's own *computed* nearest block above -- the kit
              keeps them in separate keys on purpose, with a warning string if they'd be easy to conflate.
  la          data/graph/edges-<letter>.json "la": the REAL look-alike edges (slug, dE2000, one-line
              qualitative difference, e.g. "almost the same", "purpler and more vivid"). Never
              library.json's old-101 "app" field (article_lint.py pattern 1 exists because a writer used
              that instead) -- la_warning says so again at the point of use.
  family      edges "kids"/"nkids" (named variants: "aqua-blue", "deep-aqua"...), "also"/"also_of"
              (cross-system same-color aliases), "trad"/"trad_of" (traditional-system siblings, e.g. a
              Japanese name filed under this English one).
  wheel       edges "wh": the nearest CORE (Learn-layer) name at the complement and +-30 degrees on three
              real, computed color wheels -- perceptual (Lab hue rotation), painter's (RYB rotation), and
              RGB light (HSL hue rotation). Three different "what goes with this" answers, not one vibe.
  archive     data/graph/fieldnotes/<letter>.json: the two-lens archive engine's own numbers (ar) AND
              ready-made, pre-verified prose sentences (facts[].t, with the "n" the sentence itself
              already cites) -- prefer quoting/paraphrasing these sentences over re-deriving the same
              numbers by hand, since article_lint.py checks role/century/first-seen claims against them.
  field       tools/article_field.py compute() output, only with --field (slow: loads data/gallery's full
              index + detail shards once per process). A second, legitimate lens (dE<=6, 5% min cover,
              single pass) -- Aero's live article used this one. Say in the article's own field.match /
              notes which lens a field claim came from; article_lint.py checks role claims against both.
  paintings   edges "ap": the actual paintings carrying this color (gallery id, dE, role, % cover),
              resolved to title/painter/year via data/gallery's detail shards, with an [[painting:id|…]]
              reference ready to paste (gate requires the |label).
  twins       edges "tw": fashion/film/gem/botany "twins" within dE 10, resolved to real titles via
              data/looks.js, data/films.js, data/gems.js, data/botany.js, each with a ready
              [[gem:id|…]] / [[flower:id|…]] / [[look:id|…]] / [[film:id|…]] reference.
  library     data/library.json entry: field/useRank/note (never its "app" field -- same trap as la).
  books       ../color-kb/concordance/by-color/<slug>.jsonl, tried under several punctuation variants of
              the slug (Scheele's Green files as "scheeles-green", Van Dyke Brown as "vandyke-brown") and
              ../color-kb/facts/<slug>.jsonl if a fact-card pass already ran. Only METADATA is surfaced
              here (book id, chapter/section/page, matched phrase, strength, a hit count) -- never a
              book's own sentences or long context. CLAUDE.md's book rule ("book text is never in the
              repo") covers this kit too, since a kit can land on disk next to repo files. Read the real
              passage in ../color-kb/books/text/<book>.txt yourself before writing a sentence from it.
  myth_scan   every CLAUDE.md "Color myths" item whose keyword turned up anywhere in the gathered
              material (dictionary origin text, fact cards), flagged so the writer either corrects it
              explicitly (myth, legend, not, disputed...) in the same breath or leaves it out.
  score       a rough 0-100 "how much real, usable material exists beyond the current word count" score
              and a recommended depth bucket (see score_breakdown for the parts). Cheap by design (no
              --field, no gallery index) so tools/rank_depth_queue.py can run it over the whole corpus.
"""
import argparse
import json
import re
import sys
import unicodedata
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
ART = ROOT / "data" / "articles"
GRAPH = ROOT / "data" / "graph"
SRC = ROOT / "data" / "sources"
# color-kb is a sibling of the main colorhub checkout. From a worktree
# (.../colorhub/.claude/worktrees/agent-x) that main checkout is three parents up.
_CKB_CANDIDATES = [ROOT.parent / "color-kb", ROOT.parents[3] / "color-kb" if len(ROOT.parents) > 3 else ROOT]
COLOR_KB = next((p for p in _CKB_CANDIDATES if p.exists()), _CKB_CANDIDATES[0])

sys.path.insert(0, str(ROOT / "tools"))


def route_slug(s):
    s = unicodedata.normalize("NFKD", str(s))
    s = "".join(c for c in s if not unicodedata.combining(c)).lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


# ---------------------------------------------------------------- cached loaders

_CACHE = {}


def _letter(slug):
    return (slug[:1] or "a").lower()


def _load_json(path):
    if path not in _CACHE:
        _CACHE[path] = json.loads(path.read_text(encoding="utf-8")) if path.exists() else None
    return _CACHE[path]


def _load_jsonl(path, skip_meta=True):
    key = ("jsonl", path)
    if key not in _CACHE:
        out = []
        if path.exists():
            for line in path.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if not line or (skip_meta and line.startswith('{"_')):
                    continue
                try:
                    out.append(json.loads(line))
                except Exception:
                    pass
        _CACHE[key] = out
    return _CACHE[key]


def load_node(slug):
    d = _load_json(GRAPH / f"nodes-{_letter(slug)}.json") or []
    return next((n for n in d if n["s"] == slug), None)


def load_edge(slug):
    d = _load_json(GRAPH / f"edges-{_letter(slug)}.json") or []
    return next((e for e in d if e["s"] == slug), None)


def load_fieldnote(slug):
    d = _load_json(GRAPH / "fieldnotes" / f"{_letter(slug)}.json") or []
    return next((e for e in d if e["s"] == slug), None)


def load_names_index():
    """slug -> [name, hex, rank, list-codes] from data/graph/names.json."""
    key = "names_idx"
    if key not in _CACHE:
        rows = _load_json(GRAPH / "names.json") or []
        _CACHE[key] = {r[0]: r for r in rows}
    return _CACHE[key]


def load_library_by_name():
    key = "lib_by_name"
    if key not in _CACHE:
        rows = _load_json(ROOT / "data" / "library.json") or []
        _CACHE[key] = {e["n"].lower(): e for e in rows}
    return _CACHE[key]


def load_mp_dictionary():
    key = "mp_dict"
    if key not in _CACHE:
        rows = _load_jsonl(SRC / "maerz-paul-1930-dictionary.json")
        _CACHE[key] = {r.get("n", "").lower(): r for r in rows if isinstance(r, dict)}
    return _CACHE[key]


def load_mp_etymology():
    key = "mp_etym"
    if key not in _CACHE:
        d = _load_json(SRC / "mp-etymology.json") or {}
        _CACHE[key] = {k.lower(): v for k, v in d.items() if not k.startswith("_")}
    return _CACHE[key]


def load_iscc():
    key = "iscc"
    if key not in _CACHE:
        names = _load_jsonl(SRC / "iscc-nbs-names.json")
        by_name = {}
        for r in names:
            by_name.setdefault(r.get("n", "").lower(), []).append(r)
        centroids = {r["block"]: r.get("name") for r in _load_jsonl(SRC / "iscc-nbs-centroids.json") if "block" in r}
        _CACHE[key] = (by_name, centroids)
    return _CACHE[key]


# ---------------------------------------------------------------- reference-dataset id -> label

def _gem_titles():
    key = "gem_titles"
    if key not in _CACHE:
        t = (ROOT / "data" / "gems.js").read_text(encoding="utf-8")
        _CACHE[key] = dict(re.findall(r'id:\s*"([a-z0-9-]+)",\s*title:\s*"([^"]+)"', t))
    return _CACHE[key]


def _botany_titles():
    key = "botany_titles"
    if key not in _CACHE:
        t = (ROOT / "data" / "botany.js").read_text(encoding="utf-8")
        j = json.loads(t[t.index("{", t.index("window.BOTANY")):t.rindex("}") + 1])
        out = {}
        for p in j.get("plants", []) + j.get("dyes", []):
            out[p["id"]] = p.get("plant") or p.get("color") or p["id"]
        _CACHE[key] = out
    return _CACHE[key]


def _look_titles():
    key = "look_titles"
    if key not in _CACHE:
        t = (ROOT / "data" / "looks.js").read_text(encoding="utf-8")
        _CACHE[key] = dict(re.findall(r'"id":"([a-z0-9-]+)","name":"([^"]+)"', t))
    return _CACHE[key]


def _film_titles():
    key = "film_titles"
    if key not in _CACHE:
        t = (ROOT / "data" / "films.js").read_text(encoding="utf-8")
        _CACHE[key] = dict(re.findall(r'"id":\s*"([a-z0-9-]+)",\s*"title":\s*"([^"]+)"', t))
    return _CACHE[key]


def resolve_twins(tw):
    """edges[*]['tw'] has four pools, only two of which are real [[kind:id|label]] reference-card
    material: 'gems' (data/gems.js ids, as-is) and 'films' (data/films.js ids, after stripping the
    'film:' prefix the graph builder adds). The other two are NOT the same id space as any reference
    kind in SCHEMA.md, so a writer who turns them into a [[...]] card fails the gate:
      'botany'  -- ids are 'werner-N', an index into Werner's 1821 nomenclature comparison
                   (color-kb/werner.json), not a data/botany.js plant/dye id. Real prose material
                   ("Werner's Nomenclature placed this beside the snow-drop"), never a [[flower:id]].
      'fashion' -- ids are 'decade:*' / 'coty:*' (Pantone Color of the Year) / 'house:*' / 'history:*',
                   from data/fashion.js, not a data/looks.js aesthetic-look id. Real prose material
                   ("Pantone named it Cerulean, Color of the Year 2000"), never a [[look:id]].
    Both are kept, clearly labelled prose_only, so the writer still gets the material."""
    out = {}
    for item in (tw or {}).get("gems") or []:
        tid, label = item[0], item[1] if len(item) > 1 else item[0]
        title = _gem_titles().get(tid, label)
        out.setdefault("gems", []).append({"id": tid, "label": title or label,
                                            "de": item[2] if len(item) > 2 else None,
                                            "ref": f"[[gem:{tid}|{title or label}]]"})
    for item in (tw or {}).get("films") or []:
        tid, label = item[0], item[1] if len(item) > 1 else item[0]
        tid_bare = tid.split(":", 1)[-1] if ":" in str(tid) else tid
        title = _film_titles().get(tid_bare, label)
        out.setdefault("films", []).append({"id": tid_bare, "label": title or label,
                                             "de": item[2] if len(item) > 2 else None,
                                             "ref": f"[[film:{tid_bare}|{title or label}]]"})
    for cat in ("botany", "fashion"):
        rows = []
        for item in (tw or {}).get(cat) or []:
            tid, label = item[0], item[1] if len(item) > 1 else item[0]
            rows.append({"id": tid, "label": label, "de": item[2] if len(item) > 2 else None,
                         "prose_only": True,
                         "note": "not a [[flower:id]] reference" if cat == "botany" else "not a [[look:id]] reference"})
        if rows:
            out[cat] = rows
    return out


def resolve_look_and_garment_candidates(hexval, de_limit=8.0):
    """Real [[look:id]] / [[garment:id]] candidates, computed the way SCHEMA.md's closeness rule
    requires (a look's palette color within dE2000 8), since data/graph's 'tw' pool does not cover
    either dataset. Cheap: both files are small; skipped entirely if hexval is missing."""
    if not hexval:
        return {"looks": [], "garments": []}
    sys.path.insert(0, str(ROOT / "tools"))
    from library import labs, de2000
    target = labs([hexval])
    out = {"looks": [], "garments": []}
    looks_path = ROOT / "data" / "looks.js"
    if looks_path.exists():
        key = "looks_raw"
        if key not in _CACHE:
            t = looks_path.read_text(encoding="utf-8")
            _CACHE[key] = re.findall(r'\{"id":"([a-z0-9-]+)","name":"([^"]+)".*?"pals":(\[.*?\]\}\])\}', t)
        best = {}
        for lid, name, pals_txt in _CACHE[key]:
            try:
                pals = json.loads(pals_txt)
            except Exception:
                continue
            for pal in pals:
                for c in pal.get("c", []):
                    try:
                        d = float(np.ravel(de2000(labs([c[0]]), target))[0])
                    except Exception:
                        continue
                    if d <= de_limit and (lid not in best or d < best[lid][0]):
                        best[lid] = (d, name, c[1])
        out["looks"] = [{"id": lid, "label": name, "de": round(d, 1), "matched_swatch": swatch,
                          "ref": f"[[look:{lid}|{name}]]"} for lid, (d, name, swatch) in
                         sorted(best.items(), key=lambda kv: kv[1][0])[:3]]
    garments_path = ROOT / "data" / "fashion" / "garments.json"
    if garments_path.exists():
        rows = (_load_json(garments_path) or {}).get("rows", [])
        hits = []
        for r in rows:
            for c in r.get("p", []):
                try:
                    d = float(np.ravel(de2000(labs([c[0]]), target))[0])
                except Exception:
                    continue
                if d <= de_limit:
                    hits.append((d, r))
                    break
        hits.sort(key=lambda x: x[0])
        out["garments"] = [{"id": r["id"], "label": r.get("t"), "de": round(d, 1), "culture": r.get("cul"),
                             "ref": f"[[garment:{r['id']}|{r.get('t')}]]"} for d, r in hits[:3]]
    return out


def flower_family_candidates(fam):
    """data/botany.js's byColor[family]: NOT ΔE-matched (the file carries no hex per plant), so these
    are candidates by color-family only -- a writer still has to judge the thematic fit (and should
    prefer a plant/dye that is actually in data/botany.js's plants/dyes id list, for a real [[flower:id]]
    link, over a 'werner'/'flori'/'tradition' entry that is prose-only)."""
    key = "botany_bycolor"
    if key not in _CACHE:
        t = (ROOT / "data" / "botany.js").read_text(encoding="utf-8")
        j = json.loads(t[t.index("{", t.index("window.BOTANY")):t.rindex("}") + 1])
        _CACHE[key] = j.get("byColor", {})
        _CACHE["botany_ids"] = {p["id"] for p in j.get("plants", []) + j.get("dyes", [])}
    return {"candidates": _CACHE[key].get(fam, []), "linkable_flower_ids": sorted(_CACHE["botany_ids"])}


def resolve_paintings(ap):
    """edges[*]['ap'] -> [id, de, role, cover] resolved to title/painter/year via data/gallery."""
    key = "gallery_by_id"
    if key not in _CACHE:
        idx = {}
        d = ROOT / "data" / "gallery" / "d"
        if d.exists():
            for f in sorted(d.glob("*.json")):
                for r in json.loads(f.read_text(encoding="utf-8")):
                    idx[r[0]] = r
        _CACHE[key] = idx
    gal = _CACHE[key]
    out = []
    for row in ap or []:
        pid, de, role, cover = (row + [None, None, None, None])[:4]
        g = gal.get(pid)
        if g:
            out.append({"id": pid, "title": g[1], "painter": g[2], "country": g[3], "de": de, "role": role,
                        "cover_pct": cover, "ref": f"[[painting:{pid}|{g[1]}]]"})
        else:
            out.append({"id": pid, "title": None, "de": de, "role": role, "cover_pct": cover})
    return out


# ---------------------------------------------------------------- color-kb (research only; never copied)

def _concordance_variants(slug):
    """Punctuation/hyphen variants the color-kb concordance is actually filed under. color-kb slugifies
    display names with its own rules, not routeSlug, so a name can land under more than one plausible
    spelling (Van Dyke Brown has BOTH a sparse 'van-dyke-brown.jsonl', 3 hits, exact-slug match, AND the
    real 'vandyke-brown.jsonl', 77 hits, first-two-words-joined) -- picking the first variant that exists
    silently grabs the thin one. So this returns every combination of hyphen positions removed (the
    hyphens are rarely more than 2-3, so the combinations are cheap), plus the apostrophe-stripped form,
    and load_concordance/load_fact_cards try ALL of them and keep whichever has the most hits."""
    bare = slug.replace("-s-", "s-").replace("'", "")
    variants = {slug, bare}
    for base in (slug, bare):
        parts = base.split("-")
        n = len(parts) - 1
        if 0 < n <= 4:
            for mask in range(1 << n):
                joined = parts[0]
                for i in range(n):
                    joined += ("" if (mask >> i) & 1 else "-") + parts[i + 1]
                variants.add(joined)
    return list(variants)


def load_concordance(slug, max_rows=12):
    d = COLOR_KB / "concordance" / "by-color"
    best_v, best_rows = None, []
    for v in _concordance_variants(slug):
        p = d / f"{v}.jsonl"
        if p.exists():
            rows = _load_jsonl(p, skip_meta=False)
            if len(rows) > len(best_rows):
                best_v, best_rows = v, rows
    if best_v is None:
        return {"slug_used": None, "n_hits": 0, "sample": [],
                "note": "no concordance hits under any tried slug variant -- this name's depth has to come "
                        "from our own measured data (archive, graph, dictionary), not the 29 books"}
    out = [{"book": r.get("book"), "where": r.get("chapter") or r.get("section") or r.get("page"),
            "section": r.get("section"), "matched": r.get("matched"), "strength": r.get("strength")}
           for r in best_rows[:max_rows]]
    return {"slug_used": best_v, "n_hits": len(best_rows), "sample": out,
            "note": "metadata only (book, locator, matched phrase) -- never book text; read the "
                    f"real passage in {COLOR_KB}/books/text/<book>.txt before writing a sentence"}


def load_fact_cards(slug):
    best_v, best_rows = None, []
    for v in _concordance_variants(slug):
        p = COLOR_KB / "facts" / f"{v}.jsonl"
        if p.exists():
            rows = _load_jsonl(p)
            if len(rows) > len(best_rows):
                best_v, best_rows = v, rows
    return best_rows


# ---------------------------------------------------------------- myth scan

MYTH_KEYWORDS = [
    ("first synthetic dye", "Mauveine was the first aniline dye, not the first synthetic dye (picric acid dyed Lyon silk from 1845)."),
    ("rainbow", "Newton's seven rainbow colors are not natural bands; he chose seven to match the musical scale."),
    ("puddle", "Perkin did not find coal-tar colors in a rainbow film on a puddle; it was a failed quinine experiment."),
    ("serpent", "Murexide came from bird guano, not serpent excrement."),
    ("cyanide", "Prussian blue does not release cyanide under normal conditions."),
    ("isabella", "Isabelline is not Archduchess Isabella's unwashed linen."),
    ("corrosive", "Indigo is not corrosive or poisonous; that was woad growers' propaganda."),
    ("arsenic", "Arsenic wallpaper killing Napoleon is unproven."),
    ("indian yellow", "No record of a ban on Indian yellow for cruelty; the mango-cow story is unverified."),
    ("mummy brown", "Bone black did not come from human corpses; mummy brown did."),
    ("cobalt blue", "Rubens did not use cobalt blue (it postdates him)."),
    ("baker-miller", "Baker-Miller pink calming aggression is not supported."),
    ("chromotherapy", "Colors do not heal (chromotherapy)."),
    ("moonlight", "Moonlight is reflected sunlight, not blue light."),
    ("primary", "Red, yellow and blue are a teaching convention, not the only true primaries."),
    ("cones", "Say long/medium/short cones, not red/green/blue; the 'red' cone peaks in yellow-green."),
    ("greek", "The Greeks-couldn't-see-blue claim is a myth."),
    ("coca-cola", "Santa's red suit does not come from Coca-Cola."),
    ("victoria", "Queen Victoria did not single-handedly start the white wedding dress."),
    ("crusader", "Red in heraldry honoring Crusader blood is a legend."),
    ("napoleon", "Napoleon did not start Empire green."),
    ("moliere", "Moliere did not die on stage in green."),
    ("universe is turquoise", "The 'universe is turquoise' line was a 2002 error, corrected to beige."),
    ("inuit", "The Inuit having dozens of snow words is exaggerated."),
    ("bull", "Bulls are not enraged by red specifically."),
    ("pink was always", "Pink was not always coded for girls."),
    ("mauve decade", "The exact dates of the 'Mauve Decade' are disputed; hedge."),
]


def myth_scan(text_blobs):
    hay = " ".join(b for b in text_blobs if b).lower()
    return [{"keyword": kw, "reminder": reminder} for kw, reminder in MYTH_KEYWORDS if kw in hay]


# ---------------------------------------------------------------- the kit

def build_kit(slug, do_field=False, do_looks_garments=True):
    slug = route_slug(slug)
    node = load_node(slug)
    edge = load_edge(slug) or {}
    fn = load_fieldnote(slug)
    names_idx = load_names_index()
    name = node["n"] if node else (names_idx.get(slug) or [slug])[1] if len(names_idx.get(slug, [])) > 1 else slug

    mp_dict = load_mp_dictionary().get(name.lower())
    mp_etym = load_mp_etymology().get(name.lower())
    iscc_by_name, iscc_centroids = load_iscc()
    real_filing = iscc_by_name.get(name.lower())
    real_filing_resolved = None
    if real_filing:
        real_filing_resolved = [{"block": r["block"], "centroid_name": iscc_centroids.get(r["block"]),
                                  "src": r.get("src")} for r in real_filing]

    lib_entry = load_library_by_name().get(name.lower())
    lib_entry_safe = None
    if lib_entry:
        lib_entry_safe = {k: v for k, v in lib_entry.items() if k != "app"}
        lib_entry_safe["_warning"] = ("library.json's own 'app' field is the OLD 101-curriculum nearest "
                                       "name, not a look-alike edge -- omitted on purpose; use kit['la'] instead")

    la = edge.get("la") or []
    kit = {
        "slug": slug,
        "name": name,
        "node": node,
        "dictionary": {
            "maerz_paul_1930": mp_dict,
            "mp_etymology": mp_etym,
            "agree": bool(mp_dict and mp_etym and mp_dict.get("date") == mp_etym.get("year")) if mp_etym else None,
        },
        "iscc_real_1955_filing": real_filing_resolved,
        "iscc_computed_nearest_block": (node or {}).get("iscc"),
        "la_warning": "look-alikes below are the REAL graph edges (dE2000 + qualitative diff) -- do not "
                      "substitute library.json's 'app' field or anything from data/core-names.json 'near'",
        "la": [{"slug": s, "name": names_idx.get(s, [None, s.replace('-', ' ').title()])[1], "de": de,
                "diff": diff, "ref": f"[[{s}]]"} for s, de, diff in la],
        "family": {
            "kids": edge.get("kids") or [], "also": edge.get("also") or [], "also_of": edge.get("also_of") or [],
            "trad": edge.get("trad") or [], "trad_of": edge.get("trad_of") or [],
        },
        "wheel": edge.get("wh") or {},
        "archive_fieldnotes": fn,
        "paintings": resolve_paintings(edge.get("ap")),
        "twins": resolve_twins(edge.get("tw")),
        "look_and_garment_candidates": (resolve_look_and_garment_candidates((node or {}).get("h"))
                                         if do_looks_garments else {"looks": [], "garments": [], "skipped": True}),
        "flower_candidates": flower_family_candidates((node or {}).get("fam")),
        "library_entry": lib_entry_safe,
        "books": load_concordance(slug),
        "fact_cards": load_fact_cards(slug),
    }
    if do_field:
        from article_field import compute
        kit["field_compute"] = compute(node["h"] if node else kit.get("node", {}).get("h"), ngrams=[name.lower()])

    blobs = [json.dumps(mp_dict), json.dumps(mp_etym), json.dumps(kit["fact_cards"]),
             json.dumps(kit["archive_fieldnotes"])]
    kit["myth_scan"] = myth_scan(blobs)
    kit["score"], kit["score_breakdown"], kit["suggested_depth"] = score_kit(kit, names_idx.get(slug))
    return kit


# ---------------------------------------------------------------- scoring (cheap: no --field, no gallery)

def score_kit(kit, names_row):
    b = {}
    b["book_hits"] = min(25, (kit["books"]["n_hits"] or 0))
    b["fact_cards"] = min(10, len(kit["fact_cards"]) * 2)
    fn = kit["archive_fieldnotes"] or {}
    b["archive_n"] = min(20, (fn.get("ar") or {}).get("n", 0))
    b["graph_degree"] = min(20, len(kit["la"]) + sum(len(v) for v in kit["family"].values())
                             + sum(len(v) for v in kit["twins"].values()) + len(kit["paintings"]))
    b["dictionary"] = 10 if (kit["dictionary"]["maerz_paul_1930"] or {}).get("origin") else (
        5 if kit["dictionary"]["maerz_paul_1930"] or kit["dictionary"]["mp_etymology"] else 0)
    b["iscc_real"] = 5 if kit["iscc_real_1955_filing"] else 0
    b["learn_word"] = 10 if names_row and len(names_row) > 4 and "c" in (names_row[4] or "") else 0
    total = sum(b.values())
    depth = "epic" if total >= 60 else "long" if total >= 35 else "medium" if total >= 18 else "short"
    return min(100, total), b, depth


# ---------------------------------------------------------------- rank-all (for tools/rank_depth_queue.py)

def rank_all():
    import glob
    out = []
    names_idx = load_names_index()
    for p in sorted(ART.glob("*.json")):
        if p.stem in ("link-map", "index"):
            continue
        try:
            a = json.loads(p.read_text(encoding="utf-8"))
        except Exception:
            continue
        slug = a.get("slug") or p.stem
        kit = build_kit(slug, do_field=False, do_looks_garments=False)
        out.append({"slug": slug, "name": a.get("name"), "tier": a.get("tier"), "depth": a.get("depth"),
                    "words": a.get("words"), "score": kit["score"], "score_breakdown": kit["score_breakdown"],
                    "suggested_depth": kit["suggested_depth"], "book_hits": kit["books"]["n_hits"],
                    "archive_n": (kit["archive_fieldnotes"] or {}).get("ar", {}).get("n", 0),
                    "graph_degree": kit["score_breakdown"]["graph_degree"],
                    "is_learn_word": "c" in (names_idx.get(slug, [None] * 5)[4] or "" if len(names_idx.get(slug, [])) > 4 else "")})
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("slug", nargs="?")
    ap.add_argument("--field", action="store_true", help="also run article_field.py compute() (slow)")
    ap.add_argument("--out")
    ap.add_argument("--rank-all", action="store_true")
    a = ap.parse_args()
    if a.rank_all:
        data = rank_all()
    elif a.slug:
        data = build_kit(a.slug, do_field=a.field)
    else:
        ap.error("give a slug, or pass --rank-all")
        return
    txt = json.dumps(data, ensure_ascii=False, indent=1)
    if a.out:
        Path(a.out).write_text(txt + "\n", encoding="utf-8")
        print(f"wrote {a.out}")
    else:
        print(txt)


if __name__ == "__main__":
    main()
