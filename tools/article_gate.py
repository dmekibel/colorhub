#!/usr/bin/env python3
"""Mechanical gate for data/articles/<slug>.json (the article engine, lane L7). Schema: data/articles/SCHEMA.md.

    python3 tools/article_gate.py                  # every article; exit 1 on any FAIL
    python3 tools/article_gate.py madder mauve     # just these
    python3 tools/article_gate.py --write-words    # also store the computed word count in "words"
    python3 tools/article_gate.py --surprises madder   # data-born lead candidates (genius panel L7)

FAIL (blocks the article):
  - invalid JSON, missing keys, slug != file name, bad hex, unknown tier/depth/status
  - length outside the bounds for its depth (lede + section bodies, refs and markup stripped)
  - a [n] in the text with no matching note; a note with no kind/cite; a web note with no url
  - a sentence that carries a fact (a digit, or a capitalised word after the first) with no [n]
    (the lede is exempt: it summarises the cited body)
  - a quotation over 15 words (text in double quotes, straight or curly)
  - a myth-list phrase (CLAUDE.md "Color myths") with no correcting frame in the same or the next sentence
  - the words "the 101"
  - a [[slug]] link that resolves to no color name or article; an [[art:id|label]] that is not in data/gallery
  - questions: 2-3, kind pick|true-false, answer among the choices
  - fewer than 4 connections (aside siblings + children + aka + [[links]]) or fewer than 3 field keys
WARN (printed, does not block): a 10-word run shared with a private book text; an unused note; a sentence over 45 words; "words" out of date.

Private fact cards live in ../color-kb/facts/<slug>.jsonl (never in this repo). When that folder exists the
gate also checks that the cards file is there and that every card names a source.
"""
import json, re, sys, unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ART = ROOT / "data" / "articles"
FACTS = [ROOT.parent / "color-kb" / "facts", ROOT.parents[2].parent / "color-kb" / "facts" if len(ROOT.parents) > 2 else ROOT]

TIERS = {"pigment", "traditional", "nature", "place", "person", "standard", "commercial", "descriptive"}
# Default depth per tier (MASTER-PLAN §3). An article may declare a deeper depth when the books support it
# (rule: "epic" needs >= 300 concordance hits; say so in SCHEMA/VOICE).
TIER_DEPTH = {"pigment": "epic", "traditional": "long", "nature": "long", "place": "medium", "person": "medium",
              "standard": "short", "commercial": "brief", "descriptive": "none"}
DEPTH_WORDS = {"epic": (1500, 3000), "long": (600, 1500), "medium": (300, 900), "short": (200, 600),
               "brief": (150, 400), "none": (0, 150)}
STATUS = {"pilot", "draft", "checked", "live"}
REQUIRED = ["slug", "name", "hex", "tier", "lede", "sections", "aside", "field", "notes", "questions", "openers",
            "words", "status", "checked"]

# CLAUDE.md myth list as regexes. A hit must sit next to a correcting cue.
MYTHS = [
    r"guarantee\W.{0,60}(garance|garanza|madder)|(garance|garanza).{0,60}guarantee",
    r"first synthetic (dye|colou?r)",
    r"first commercial synthetic dye",
    r"puddle|iridescent film",
    r"serpents?'? (excrement|dung)",
    r"(cyanide|prussic acid).{0,80}(releas|giv|emit|turn)|(releas|giv|emit).{0,40}(cyanide|prussic)",
    r"isabell?a.{0,80}(unwashed|linen|underwear|bodice|shift)",
    r"indigo.{0,40}(corrosive|poison)",
    r"natural indigo.{0,60}(better|different) (blue|colou?r)",
    r"seven (natural )?bands|rainbow has seven",
    r"red,? yellow,? and blue are the (true )?primar",
    r"rubens.{0,40}cobalt",
    r"greeks? (could ?n.t|could not) see blue",
    r"santa.{0,40}coca-?cola",
    r"baker-?miller",
    r"napoleon.{0,60}arsenic|arsenic.{0,60}napoleon",
    r"indian yellow.{0,60}banned",
    r"mauve decade",
]
CUES = re.compile(r"\b(myth|legend|folk|not|never|no |false|wrong|isn.t|doesn.t|didn.t|wasn.t|story|stories|rumou?r|"
                  r"claim|propaganda|evidence|unproven|disputed|disagree|nonsense|invent|actually|in fact|only)\b", re.I)
REF = re.compile(r"\[(\d+)\]")
LINK = re.compile(r"\[\[([^\]|]+)(?:\|([^\]]+))?\]\]")
QUOTE = re.compile(r"[\"“]([^\"”]{1,600})[\"”]")


def route_slug(s):
    s = unicodedata.normalize("NFKD", str(s))
    s = "".join(c for c in s if not unicodedata.combining(c)).lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def plain(text):
    t = REF.sub("", text)
    t = LINK.sub(lambda m: m.group(2) or m.group(1).split(":")[-1].replace("-", " "), t)
    return t.replace("*", "")


def words(text):
    return len(re.findall(r"[A-Za-z0-9À-ɏ぀-ヿ一-鿿][\w'’\-぀-ヿ一-鿿]*", plain(text)))


def sentences(text):
    # split after . ! ? (optionally followed by refs/closing quotes/italics) + space + capital/quote/digit/[
    t = text.replace("\n\n", "   ")
    parts = re.split(r"(?<![\s(][A-Z]\.)(?<!\b(?:St|Mr|Dr|vs|ch|pp|no|Co)\.)(?<=[.!?])((?:\s*\[\d+\])*)[\"”*]?\s+(?=[A-Z0-9\"“*\[ ])", t)
    out, buf = [], ""
    i = 0
    while i < len(parts):
        seg = parts[i]
        refs = parts[i + 1] if i + 1 < len(parts) else ""
        out.append((seg + (refs or "")).replace(" ", "").strip())
        i += 2
    return [s for s in out if s]


def load_names():
    names = set()
    for f in ("core-names.json", "library.json"):
        p = ROOT / "data" / f
        if p.exists():
            for e in json.loads(p.read_text()):
                names.add(route_slug(e["n"]))
    return names


def load_gallery_ids():
    ids = set()
    d = ROOT / "data" / "gallery" / "d"
    for f in sorted(d.glob("*.json")):
        for r in json.loads(f.read_text()):
            ids.add(r[0])
    return ids


def has_fact(sent):
    s = plain(sent).strip()
    if re.search(r"\d", s):
        return True
    toks = re.findall(r"[A-Za-z][\w'’\-]*", s)
    # a capitalised word after the first token (skip a few function words that start quoted titles)
    return any(w[0].isupper() and w not in ("I",) for w in toks[1:])


_BOOK_GRAMS = None


def book_grams(n=10):
    """10-word shingles of the private book texts (../color-kb/books/text), if present. Copyright guard: an
    article sharing a 10-word run with a book gets a WARN to reword (titles of works can trip it harmlessly)."""
    global _BOOK_GRAMS
    if _BOOK_GRAMS is None:
        _BOOK_GRAMS = set()
        for d in FACTS:
            tx = d.parent / "books" / "text"
            if tx.exists():
                for f in tx.glob("*.txt"):
                    w = re.findall(r"[a-z0-9]+", f.read_text(errors="ignore").lower())
                    _BOOK_GRAMS.update(hash(tuple(w[i:i + n])) for i in range(len(w) - n))
                break
    return _BOOK_GRAMS


def check(path, names, gallery, slugs, write_words=False):
    fails, warns = [], []
    try:
        a = json.loads(path.read_text())
    except Exception as e:
        return [f"invalid JSON: {e}"], [], None
    for k in REQUIRED:
        if k not in a:
            fails.append(f"missing key: {k}")
    if fails:
        return fails, warns, None
    if a["slug"] != path.stem:
        fails.append(f"slug {a['slug']!r} != file name {path.stem!r}")
    if a["slug"] != route_slug(a["slug"]):
        fails.append("slug is not in routeSlug form")
    if not re.fullmatch(r"#[0-9A-Fa-f]{6}", a["hex"]):
        fails.append(f"bad hex {a['hex']}")
    if a["tier"] not in TIERS:
        fails.append(f"unknown tier {a['tier']}")
    depth = a.get("depth") or TIER_DEPTH.get(a["tier"], "medium")
    if depth not in DEPTH_WORDS:
        fails.append(f"unknown depth {depth}")
        depth = "medium"
    if a["status"] not in STATUS:
        fails.append(f"unknown status {a['status']}")

    secs = a["sections"]
    ids = [s.get("id") for s in secs]
    if len(set(ids)) != len(ids) or not all(ids):
        fails.append("section ids missing or repeated")
    for s in secs:
        for k in ("id", "title", "body"):
            if not s.get(k):
                fails.append(f"section {s.get('id')}: missing {k}")

    texts = [("lede", a["lede"])] + [(s["id"], s["body"]) for s in secs]
    n_words = sum(words(t) for _, t in texts)
    lo, hi = DEPTH_WORDS[depth]
    if not lo <= n_words <= hi:
        fails.append(f"length {n_words} words outside {lo}-{hi} for depth '{depth}'")
    if a.get("words") != n_words:
        if write_words:
            a["words"] = n_words
            txt = json.dumps(a, ensure_ascii=False, indent=1)
            path.write_text(txt + "\n", encoding="utf-8")
        else:
            warns.append(f"'words' is {a.get('words')}, computed {n_words} (run with --write-words)")

    notes = {}
    for nt in a["notes"]:
        n = nt.get("n")
        if not isinstance(n, int) or n in notes:
            fails.append(f"note number bad or repeated: {n}")
            continue
        notes[n] = nt
        if nt.get("kind") not in ("book", "data", "web"):
            fails.append(f"note {n}: kind must be book|data|web")
        if not nt.get("cite"):
            fails.append(f"note {n}: empty cite")
        if nt.get("kind") == "web" and not nt.get("url"):
            fails.append(f"note {n}: web note without url")
    used = set()
    links = set()
    for where, t in texts:
        for m in REF.finditer(t):
            n = int(m.group(1))
            used.add(n)
            if n not in notes:
                fails.append(f"{where}: [{n}] has no note")
        for m in LINK.finditer(t):
            tgt = m.group(1).strip()
            if tgt.startswith("art:"):
                if gallery and tgt[4:] not in gallery:
                    fails.append(f"{where}: painting link {tgt} not in data/gallery")
            else:
                links.add(tgt)
                if tgt not in names and tgt not in slugs:
                    fails.append(f"{where}: link [[{tgt}]] resolves to no color name or article")
        for q in QUOTE.finditer(t):
            if len(q.group(1).split()) > 15:
                fails.append(f"{where}: quotation over 15 words: “{q.group(1)[:60]}…”")
        if re.search(r"\bthe 101\b", t, re.I):
            fails.append(f"{where}: says 'the 101'")
        sents = sentences(t)
        for i, s in enumerate(sents):
            xref = re.match(r"\W*see\b", plain(s), re.I) or re.search(r"\bsee \[\[", s, re.I)
            if where != "lede" and has_fact(s) and not REF.search(s) and not xref:
                fails.append(f"{where}: fact sentence without a note: “{plain(s)[:90]}…”")
            if words(s) > 45:
                warns.append(f"{where}: long sentence ({words(s)} words): “{plain(s)[:60]}…”")
            for pat in MYTHS:
                if re.search(pat, plain(s), re.I):
                    ctx = s + " " + (sents[i + 1] if i + 1 < len(sents) else "") + " " + (sents[i - 1] if i else "")
                    if not CUES.search(plain(ctx)):
                        fails.append(f"{where}: myth phrase without a correcting frame: “{plain(s)[:90]}…”")
    grams = book_grams()
    if grams:
        w = re.findall(r"[a-z0-9]+", plain(" ".join(x for _, x in texts)).lower())
        runs = [" ".join(w[i:i + 10]) for i in range(len(w) - 10) if hash(tuple(w[i:i + 10])) in grams]
        if runs:
            warns.append(f"{len(runs)} 10-word run(s) shared with a book, reword unless a title: “{runs[0]}”")
    for n in notes:
        if n not in used:
            warns.append(f"note {n} is never cited")

    q = a["questions"]
    if not 2 <= len(q) <= 3:
        fails.append(f"{len(q)} questions (want 2-3)")
    for x in q:
        if x.get("kind") not in ("pick", "true-false"):
            fails.append(f"question kind {x.get('kind')}")
        if x.get("answer") not in (x.get("choices") or []):
            fails.append(f"question answer not among choices: {x.get('q', '')[:50]}")

    asd = a["aside"]
    conns = set(asd.get("siblings") or []) | set(asd.get("children") or []) | links
    if asd.get("parent"):
        conns.add(asd["parent"])
    if len(conns) < 4:
        fails.append(f"only {len(conns)} connections (want >= 4)")
    for s in (asd.get("siblings") or []) + (asd.get("children") or []) + ([asd["parent"]] if asd.get("parent") else []):
        if s not in names and s not in slugs:
            fails.append(f"aside: {s} resolves to no color name or article")
    if len(a["field"]) < 3:
        fails.append("fewer than 3 field-note keys")

    for d in FACTS:
        if d.exists():
            cf = d / f"{a['slug']}.jsonl"
            if not cf.exists():
                warns.append(f"no private fact cards at {cf}")
            else:
                for ln, line in enumerate(cf.read_text().splitlines(), 1):
                    if not line.strip():
                        continue
                    try:
                        c = json.loads(line)
                    except Exception:
                        fails.append(f"fact card line {ln}: invalid JSON")
                        continue
                    if not c.get("claim") or not c.get("src"):
                        fails.append(f"fact card {c.get('id', ln)}: needs claim and src")
            break
    return fails, warns, n_words


def surprises(slug):
    """Data-born lead candidates: lift >= 3 with support >= 20, lightness/chroma percentile >= 95 or <= 5 among
    core names, and an Ngram peak far from the archive's peak century. Each comes with its caveat."""
    sys.path.insert(0, str(ROOT / "tools"))
    import numpy as np
    from article_field import compute
    from library import labs
    a = json.loads((ART / f"{slug}.json").read_text())
    f = compute(a["hex"], ngrams=[a["name"].lower()])
    out = [dict(hook=s, caveat=f["caveat"]) for s in f["surprises"]]
    core = json.loads((ROOT / "data" / "core-names.json").read_text())
    CL = labs([e["h"] for e in core])
    L0 = labs([a["hex"]])[0]
    Lp = float((CL[:, 0] < L0[0]).mean() * 100)
    Cp = float((np.hypot(CL[:, 1], CL[:, 2]) < np.hypot(L0[1], L0[2])).mean() * 100)
    for lab_, p in (("lightness", Lp), ("chroma", Cp)):
        if p >= 95 or p <= 5:
            word = {"lightness": ("lighter", "darker"), "chroma": ("more vivid", "greyer")}[lab_]
            out.append(dict(hook=f"{word[0] if p >= 95 else word[1]} than {round(p if p >= 95 else 100 - p)}% of our core names",
                            caveat="Screen color; approximate."))
    if f["ngram"] and f["by_century"]:
        peak_c = max((c for c in f["by_century"] if c["hits"] >= 5), key=lambda c: c["lift"], default=None)
        g = f["ngram"][0]
        if peak_c and abs(g["peak"] - (peak_c["key"] + 50)) >= 150:
            out.append(dict(hook=f"the word peaks in print around {g['peak']}, but the color peaks in our paintings in the "
                                 f"{peak_c['key']}s", caveat=f["caveat"] + " Ngram counts the word, in every sense."))
    return out


def main():
    args = [x for x in sys.argv[1:] if not x.startswith("--")]
    if "--surprises" in sys.argv:
        for s in args:
            print(json.dumps({s: surprises(s)}, ensure_ascii=False, indent=1))
        return
    write = "--write-words" in sys.argv
    files = [ART / f"{s}.json" for s in args] if args else sorted(ART.glob("*.json"))
    names = load_names()
    gallery = load_gallery_ids()
    slugs = {p.stem for p in ART.glob("*.json")}
    bad = 0
    for p in files:
        fails, warns, n = check(p, names, gallery, slugs, write)
        tag = "FAIL" if fails else "PASS"
        bad += bool(fails)
        print(f"{tag}  {p.stem:<18} {n if n is not None else '?':>5} words")
        for x in fails:
            print("   x", x)
        for x in warns:
            print("   ~", x)
    print(f"\n{len(files) - bad}/{len(files)} articles pass")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
