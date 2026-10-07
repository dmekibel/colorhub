#!/usr/bin/env python3
"""ColorHub poetry archive builder (Python 3, standard library only).

    python3 tools/poetry.py fetch     # download the source books and pages into research/_raw/poetry (cached)
    python3 tools/poetry.py build     # parse, find color words, write data/poems/*.json and data/poems-index.json
    python3 tools/poetry.py sample N  # print N random color mentions for a precision check

Copyright rule: only texts in the US public domain. Every English text and every translation here was
published before 1930; every original (Greek, Latin, Chinese, Japanese, Persian, French, Italian) is centuries old.
Translations marked "ColorHub's plain translation" are our own literal versions of public-domain originals.
Books come from Project Gutenberg through the PGLAF mirror (gutenberg.org asks bulk downloaders to use a mirror),
fetched once, slowly, and cached. Originals not on Gutenberg come from Wikisource through its API.
"""
import json, os, re, sys, time, random, unicodedata, urllib.request, urllib.parse, hashlib

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), ".."))
RAW = os.path.join(ROOT, "research", "_raw", "poetry")
OUT_DIR = os.path.join(ROOT, "data", "poems")
UA = "ColorHub-poetry-archive/1.0 (personal, non-commercial; contact dmekibel@gmail.com)"
MIRROR = "https://gutenberg.pglaf.org/cache/epub/{id}/pg{id}.txt"
PG_PAGE = "https://www.gutenberg.org/ebooks/{id}"


def get(url, path, delay=1.5):
    """Download url to path once; later runs read the cache."""
    if os.path.exists(path) and os.path.getsize(path) > 0:
        with open(path, "rb") as f:
            return f.read()
    os.makedirs(os.path.dirname(path), exist_ok=True)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                data = r.read()
            break
        except Exception as e:  # noqa
            if getattr(e, "code", None) == 404:
                raise RuntimeError("404 " + url)
            print("  retry", url, e, file=sys.stderr)
            time.sleep(5 * (attempt + 1))
    else:
        raise RuntimeError("could not fetch " + url)
    with open(path, "wb") as f:
        f.write(data)
    time.sleep(delay)
    return data


def pg_text(pid):
    path = os.path.join(RAW, "pg", f"pg{pid}.txt")
    s = str(pid)
    folder = "/".join(s[:-1]) + "/" + s if len(s) > 1 else "0/" + s
    urls = [MIRROR.format(id=pid), f"https://gutenberg.pglaf.org/{folder}/{s}-0.txt", f"https://gutenberg.pglaf.org/{folder}/{s}.txt", f"https://gutenberg.pglaf.org/{folder}/{s}-8.txt"]
    raw = None
    for u in urls:
        try:
            raw = get(u, path)
            break
        except RuntimeError:
            continue
    if raw is None:
        raise RuntimeError(f"book {pid} not found on the mirror")
    try:
        raw = raw.decode("utf-8")
    except UnicodeDecodeError:
        raw = raw.decode("latin-1")
    raw = raw.replace("\r\n", "\n").replace("﻿", "")
    a = re.search(r"\*\*\* ?START OF (THE|THIS) PROJECT GUTENBERG[^\n]*\n", raw)
    b = re.search(r"\*\*\* ?END OF (THE|THIS) PROJECT GUTENBERG", raw)
    return raw[a.end() if a else 0: b.start() if b else len(raw)]


def wikisource(lang, title):
    """Raw wikitext of a Wikisource page (cached)."""
    key = hashlib.md5(f"{lang}:{title}".encode()).hexdigest()[:12]
    url = f"https://{lang}.wikisource.org/w/index.php?" + urllib.parse.urlencode({"title": title, "action": "raw"})
    return get(url, os.path.join(RAW, "ws", f"{lang}-{key}.txt"), delay=1.0).decode("utf-8", "replace")


def ws_html(lang, title):
    """Rendered text of a Wikisource page (for pages transcluded from scans), as plain text with line breaks."""
    import html as H
    key = hashlib.md5(f"{lang}:{title}:parse".encode()).hexdigest()[:12]
    url = f"https://{lang}.wikisource.org/w/api.php?" + urllib.parse.urlencode({"action": "parse", "format": "json", "prop": "text", "formatversion": 2, "page": title})
    d = json.loads(get(url, os.path.join(RAW, "ws", f"{lang}-{key}.json"), delay=1.0).decode("utf-8"))
    t = d["parse"]["text"]
    t = re.sub(r"<style.*?</style>", "", t, flags=re.S)
    t = re.sub(r"<br ?/?>", "\n", t)
    t = re.sub(r"</(p|div|h\d|li|tr)>", "\n", t)
    t = re.sub(r"<[^>]+>", "", t)
    return H.unescape(t).replace("​", "")


# ======================================================================
# Color words in English
# ======================================================================
# surface forms -> target color. A target is an app color (data/colors.js, links to its page) or a name from
# data/library.json (shown in a small sheet). Synonyms a reader would take as that color map to it (rosy -> Pink).
# Left out on purpose because the plain word is usually not a color in old verse: rose (also "rose" = got up),
# olive, lime, jade, plum, peach, slate, navy, teal, sage, tan, rust, mint, salmon, chestnut (tree), gilt (guilt).
LEX = {}


def _lex(target, *forms):
    for f in forms:
        LEX[f] = target


_lex("Red", "red", "reds", "redder", "reddest", "redden", "reddens", "reddened", "reddening", "reddish", "redness", "gules", "ruddy", "ruddier", "incarnadine")
_lex("Orange", "orange")
_lex("Yellow", "yellow", "yellows", "yellower", "yellowest", "yellowing", "yellowed", "yellowish")
_lex("Green", "green", "greens", "greener", "greenest", "greening", "greenish", "greenness", "verdant")
_lex("Blue", "blue", "blues", "bluer", "bluest", "bluish", "blueness")
_lex("Purple", "purple", "purples", "purpled", "purpling", "purplish")
_lex("Pink", "pink", "pinker", "pinkish", "rosy", "rosier", "roseate")
_lex("Brown", "brown", "browner", "brownest", "browned", "brownish", "embrowned")
_lex("Grey", "grey", "gray", "greyer", "grayer", "greyest", "grayest", "greying", "graying", "greyish", "grayish", "greyness", "grayness")
_lex("Black", "black", "blacker", "blackest", "blackness", "blacken", "blackened", "blackening", "sable", "ebon", "ebony")
_lex("White", "white", "whiter", "whitest", "whiteness", "whiten", "whitened", "whitening", "snowy")
_lex("Crimson", "crimson", "crimsoned")
_lex("Scarlet", "scarlet")
_lex("Vermilion", "vermilion", "vermillion", "vermeil")
_lex("Carmine", "carmine")
_lex("Cerise", "cerise")
_lex("Maroon", "maroon")
_lex("Magenta", "magenta")
_lex("Coral", "coral")
_lex("Azure", "azure", "azured")
_lex("Cerulean", "cerulean")
_lex("Indigo", "indigo")
_lex("Cobalt", "cobalt")
_lex("Turquoise", "turquoise")
_lex("Emerald", "emerald")
_lex("Chartreuse", "chartreuse")
_lex("Viridian", "viridian")
_lex("Malachite", "malachite")
_lex("Celadon", "celadon")
_lex("Violet", "violet")
_lex("Lilac", "lilac")
_lex("Lavender", "lavender")
_lex("Amethyst", "amethyst")
_lex("Mauve", "mauve")
_lex("Puce", "puce")
_lex("Gold", "gold", "golden")
_lex("Amber", "amber")
_lex("Ochre", "ochre", "ocher")
_lex("Silver", "silver", "silvery", "silvered", "silvern", "argent")
_lex("Ash", "ashen", "hoary", "hoar")
_lex("Ivory", "ivory")
_lex("Beige", "beige")
_lex("Ecru", "ecru")
_lex("Taupe", "taupe", "dun")
_lex("Umber", "umber")
_lex("Sienna", "sienna")
_lex("Sepia", "sepia")
_lex("Terracotta", "terracotta")
# library names (no app page; a sheet shows them)
_lex("Sapphire", "sapphire")
_lex("Ruby", "ruby")
_lex("Tawny", "tawny")
_lex("Russet", "russet")
_lex("Auburn", "auburn")
_lex("Saffron", "saffron")
_lex("Flax", "flaxen")
_lex("Blood", "sanguine")
_lex("Ultramarine", "ultramarine")
# Middle English spellings, used only for Chaucer
LEX_ME = {"reed": "Red", "grene": "Green", "whit": "White", "whyt": "White", "whyte": "White", "blak": "Black",
          "blake": "Black", "blew": "Blue", "blewe": "Blue", "yelow": "Yellow", "yelwe": "Yellow", "broun": "Brown", "reede": "Red"}
# two-word colors that win over their parts
PHRASES = [(re.compile(r"\bsky[- ]blue\b", re.I), "Sky blue"), (re.compile(r"\bsea[- ]green\b", re.I), "Sea Green"),
           (re.compile(r"\bwine[- ]dark\b", re.I), "Wine"), (re.compile(r"\bolive[- ]green\b", re.I), "Olive Green")]
FLOWERY = {"violet", "lilac", "lavender"}
DETS = {"a", "the", "this", "that", "each", "one", "wild", "sweet", "blue", "white", "purple", "yellow", "dog", "every", "no", "my", "thy", "her", "his", "pale", "early", "shy", "modest", "humble"}
AFTER_FLOWER = {"", "by", "in", "that", "which", "is", "was", "grows", "blooms", "blows", "and", "or", "of", "to", "on", "under", "with", "from", "so", "springs", "bed", "beds", "bank", "banks", "blossom", "blossoms", "bush", "bushes", "root", "roots", "leaf", "leaves", "scent", "smell", "perfume", "plant", "bloom", "flower", "flowers"}
ORANGE_NOUNS = {"grove", "groves", "tree", "trees", "blossom", "blossoms", "bough", "boughs", "flower", "flowers", "peel", "garden", "gardens", "bower", "bowers"}
TITLES_BEFORE = {"mr", "mrs", "miss", "dr", "sir", "lady", "lord", "captain", "general", "master", "mistress", "saint", "st"}
SANGUINE_BEFORE = {"so", "too", "more", "less", "am", "is", "was", "were", "be", "are", "very", "most", "been", "not", "how"}
WORD = re.compile(r"[A-Za-z]+")


def find_colors(line, me=False):
    """Color words in one line: sorted list of (start, end, target)."""
    out, taken = [], []
    for rx, target in PHRASES:
        for m in rx.finditer(line):
            out.append((m.start(), m.end(), target)); taken.append((m.start(), m.end()))
    words = list(WORD.finditer(line))
    caps_line = line.upper() == line and any(c.isalpha() for c in line)
    for i, m in enumerate(words):
        w = m.group(0); lw = w.lower()
        target = LEX.get(lw)
        if me and lw in LEX_ME:
            target = LEX_ME[lw]
        if not target or any(a <= m.start() < b for a, b in taken):
            continue
        if i and line[words[i - 1].end():m.start()] == "'":   # o'er, e'en...: part of a contraction
            continue
        prev = words[i - 1].group(0).lower() if i else ""
        nxt = words[i + 1].group(0) if i + 1 < len(words) else ""
        gap_after = line[m.end(): words[i + 1].start()] if i + 1 < len(words) else line[m.end():]
        if prev in TITLES_BEFORE:
            continue
        # a capital mid-sentence is a name (Mr Brown, Rose, the Red Sea, the White Nile)
        if w[0].isupper() and not caps_line:
            before = line[:m.start()].rstrip(" \t\"'“‘(—-")
            sentence_start = before == "" or before[-1] in ".!?:;"
            if not sentence_start or (nxt[:1].isupper() and gap_after.strip() == "" and len(nxt) > 1):
                continue
        if lw == "orange" and nxt.lower() in ORANGE_NOUNS:
            continue
        if lw in FLOWERY and prev in DETS and (nxt.lower() in AFTER_FLOWER or re.match(r"\s*[,.;:!?)—-]", gap_after)):
            continue
        if lw in ("gold", "silver"):
            # "gold" and "silver" are often money; keep them when they describe something, or sit beside another color
            FUNC = {"can", "must", "may", "might", "could", "would", "should", "did", "does", "do", "has", "have", "had", "are", "were", "is", "was", "and", "or", "of", "to", "in", "that", "which", "will", "shall", "for", "nor", "but", "than", "as", "with", "he", "she", "they", "i", "we", "you", "it", "be"}
            describes = gap_after.strip() == "" and nxt and nxt.lower() not in FUNC
            near = any(LEX.get(words[k].group(0).lower()) for k in range(max(0, i - 3), min(len(words), i + 3)) if k != i)
            if not describes and not near:
                continue
        if lw == "sanguine" and prev in SANGUINE_BEFORE:
            continue
        if lw == "hoar" and nxt.lower() not in {"frost", "frosts", "hair", "head", "hairs", "beard", "locks", "rime"}:
            continue
        if lw == "dun" and prev in {"to", "i", "they", "we", "you", "and"}:
            continue
        if lw == "maroon" and prev in {"to", "be", "was", "were"}:
            continue
        if lw == "ruby" and nxt.lower() in {"wine"} and False:
            continue
        out.append((m.start(), m.end(), target))
    out.sort()
    return out


# ======================================================================
# Splitting a Gutenberg book into poems
# ======================================================================
ROMAN = r"(?:[IVXLC]+|\d+)"
NUMBERED = re.compile(rf"^(?:(?:BOOK|CANTO|PART|SONNET|SONG|ODE|NO|NUMBER|POEM|LYRIC|ELEGY|SECTION|EPIGRAM|FRAGMENT|IDYLL?|ECLOGUE|QUATRAIN|GAZEL|GHAZAL|CARMEN)\.?\s+)?{ROMAN}\s*[.:]?$", re.I)
JUNK_TITLE = re.compile(r"^(contents|index|index of first lines|index of titles|notes?|preface|introduction|introductory note|footnotes?|appendix|bibliography|glossary|errata|dedication|transcriber'?s? notes?|the end|finis|illustrations?|list of illustrations|biographical note|editor'?s? note|prefatory note|advertisement|corrigenda|chronology|table of contents)\.?$", re.I)


def clean_line(l):
    l = l.replace("\t", "    ").rstrip()
    l = re.sub(r"\[(?:\d+|[A-Z]|\*|Footnote[^\]]*|Illustration[^\]]*|Sidenote[^\]]*)\]", "", l)
    l = re.sub(r"(?<![A-Za-z])_([^_]+)_(?![A-Za-z])", r"\1", l)
    l = l.replace("_", "")
    l = re.sub(r"\^\d+|\[\d+\]", "", l)
    if re.search(r"\S\s{3,}\d{1,4}\s*$", l):   # line numbers at the right margin
        l = re.sub(r"\s+\d{1,4}\s*$", "", l)
    return l.rstrip()


def paragraphs(text):
    paras, cur, blank, before = [], [], 0, 0
    for raw in text.split("\n"):
        if raw.strip() == "":
            if cur:
                paras.append({"blank": before, "lines": cur}); cur = []; blank = 0
            blank += 1
            continue
        if not cur:
            before = blank
        cur.append(raw.rstrip())
    if cur:
        paras.append({"blank": before, "lines": cur})
    return paras


def is_caps(s):
    letters = [c for c in s if c.isalpha()]
    return len(letters) >= 1 and all(not c.islower() for c in letters)


def heading_kind(p, cfg):
    """'num' for a numbered heading, 'title' for a title, None for verse."""
    ls = [l.strip() for l in p["lines"]]
    if len(ls) > 4 or any(len(l) > 72 for l in ls):
        return None
    if all(NUMBERED.match(l) for l in ls):
        return "num"
    if len(ls) <= 2 and re.match(r"^[IVXLC]+\.\s+[A-Z“\"'‘].{0,64}$", ls[0]) and not re.search(r"[,;]$", ls[-1]):
        return "title"
    if cfg.get("heading_rx") and all(re.match(cfg["heading_rx"], l) for l in ls):
        return "title"
    if all(is_caps(l) for l in ls) and not cfg.get("no_caps_headings"):
        return "title"
    if cfg.get("titlecase") and len(ls) <= 2 and p["blank"] >= cfg.get("titlecase_gap", 2):
        l = ls[0]
        if len(l) <= 60 and not re.search(r"[,;:]$", l) and l[:1].isupper() and len(l.split()) <= 10 and not re.search(r"[a-z][.!?]$", l) or (len(l) <= 60 and l.endswith("?") and cfg.get("titlecase") == "loose"):
            return "title"
    return None


def is_prose(lines):
    """Gutenberg wraps prose at ~70 characters; verse lines mostly start with a capital and vary in length."""
    ls = [l.strip() for l in lines if l.strip()]
    if len(ls) < 3:
        return len(ls) >= 1 and (max(len(l) for l in ls) > 90 or (len(ls) == 2 and len(ls[0]) >= 64 and ls[1][:1].islower()))
    long_ = sum(1 for l in ls[:-1] if len(l) >= 58) / max(1, len(ls) - 1)
    lower = sum(1 for l in ls if l[:1].islower()) / len(ls)
    return long_ >= .6 and lower >= .25


def unwrap(lines):
    """Join hanging-indent continuations (Whitman's long lines) onto the line before."""
    out = []
    base = min((len(l) - len(l.lstrip()) for l in lines if l.strip()), default=0)
    for l in lines:
        ind = len(l) - len(l.lstrip())
        if out and ind >= base + 4 and len(out[-1].strip()) >= 55:
            out[-1] = out[-1].rstrip() + " " + l.strip()
        else:
            out.append(l)
    return out


SMALL = {"a", "an", "and", "as", "at", "but", "by", "for", "from", "in", "into", "o'er", "of", "on", "or", "the", "to", "upon", "with", "is", "it", "its", "nor", "than", "that"}


def smart_title(t):
    t = re.sub(r"\s+", " ", t.strip()).strip(" .:")
    t = re.sub(r"^\d+\.\s*", "", t)
    if is_caps(t):
        words = t.lower().split(" ")
        t = " ".join(w if (i and w in SMALL) else (w[:1].upper() + w[1:]) for i, w in enumerate(words))
        t = re.sub(r"(?<=-)([a-z])", lambda m: m.group(1).upper(), t)
        t = re.sub(r"\b[A-Za-z]+\b", lambda m: m.group(0).upper() if ROMAN_RX.match(m.group(0).lower()) and len(m.group(0)) > 1 else m.group(0), t)
    return t


ROMAN_RX = re.compile(r"^(?=[ivxlc]+$)c{0,3}(?:xc|xl|l?x{0,3})(?:ix|iv|v?i{0,3})$")


def is_list(lines):
    """A table of contents: many short lines, most words capitalized, no verse punctuation."""
    ls = [l.strip() for l in lines if l.strip()]
    if len(ls) < 5:
        return False
    def titley(l):
        ws = [w for w in re.findall(r"[A-Za-z’']+", l) if len(w) > 3]
        return ws and sum(1 for w in ws if w[0].isupper()) / len(ws) >= .6 and not re.search(r"[,;:]$", l)
    dotted = sum(1 for l in ls if re.search(r"(\.\s*){3,}\s*\d*$|\s{2,}\d+$", l))
    return dotted / len(ls) > .5 or sum(1 for l in ls if titley(l)) / len(ls) >= .8


def first_line_title(lines):
    l = next((x.strip() for x in lines if x.strip()), "")
    l = re.sub(r"[,;:—–-]+$", "", l).strip(" “”\"'‘’")
    return l if len(l) <= 64 else l[:60].rsplit(" ", 1)[0] + "…"


def segment(text, cfg):
    """Split a book into poems: [{title, num, section, lines}]."""
    if cfg.get("start"):
        m = re.search(cfg["start"], text, re.M)
        if m:
            text = text[m.start():]
    if cfg.get("end"):
        m = re.search(cfg["end"], text, re.M)
        if m:
            text = text[:m.start()]
    paras = paragraphs(text)
    poems, cur, heads, section = [], None, [], ""
    gap = cfg.get("gap", 3)

    def close():
        nonlocal cur
        if cur and cur["lines"]:
            while cur["lines"] and cur["lines"][-1] == "":
                cur["lines"].pop()
            poems.append(cur)
        cur = None

    for pi, p in enumerate(paras):
        lines = [clean_line(l) for l in p["lines"]]
        lines = [l for l in lines if l.strip() and not re.match(r"^\s*([*.]\s*){3,}\s*$", l)]
        if not lines:
            continue
        p = {"blank": p["blank"], "lines": lines}
        if re.match(r"^\s*\[", lines[0]):
            continue                           # editorial notes in brackets
        if is_list(lines) and not cfg.get("prose"):
            close(); heads = []
            continue
        hk = heading_kind(p, cfg)
        if hk:
            h = " ".join(l.strip() for l in lines)
            if re.match(r"^(NOTES?|NOTES AND [A-Z ]+|APPENDIX|INDEX( OF [A-Z ]+)?|GLOSSARY|BIBLIOGRAPHY|FOOTNOTES)\.?$", h) and pi > .6 * len(paras) and not cfg.get("keep_after_notes"):
                break   # back matter
            heads.append((hk, h, p["blank"]))
            continue
        prose = is_prose(lines)
        if prose and not cfg.get("prose"):
            close(); heads = []          # a prose paragraph (notes, prefaces) ends the poem it follows
            continue
        if cfg.get("prose") and prose:
            lines = [" ".join(l.strip() for l in lines)]
        else:
            lines = unwrap(lines)
        if heads and cur is not None and cur["title"] and all(h[0] == "num" for h in heads) and not cfg.get("num_split"):
            # a numbered part of a titled poem (I., II. ...): keep it in the same poem
            if cur["lines"]:
                cur["lines"].append("")
            cur["lines"].append(re.sub(r"[.:]$", "", heads[-1][1].strip()) + ".")
            heads = []
        if heads:
            close()
            nums = [h[1] for h in heads if h[0] == "num"]
            titles = [h[1] for h in heads if h[0] == "title" and not JUNK_TITLE.match(h[1].strip())]
            if any(JUNK_TITLE.match(h[1].strip()) for h in heads) and not titles and not nums:
                heads = []
                continue
            if len(titles) > 1:
                section = smart_title(titles[-2])
            elif titles and nums and heads[0][0] == "title" and cfg.get("num_split"):
                section = smart_title(titles[0]); titles = []
            if BAD_TITLE.match(section) or len(section) > 60:
                section = ""
            cur = {"title": smart_title(titles[-1]) if titles else "", "num": re.sub(r"[.:]$", "", nums[-1].strip()) if nums else "", "section": section, "lines": []}
            heads = []
        elif cur is None or (p["blank"] >= gap and not cfg.get("headed_only")):
            if cfg.get("headed_only") and cur is None:
                continue
            close()
            cur = {"title": "", "num": "", "section": section, "lines": []}
        if cur["lines"]:
            cur["lines"].append("")
        cur["lines"].extend(lines)
    close()
    out = []
    tcount = {}
    for p in poems:
        tcount[p["title"]] = tcount.get(p["title"], 0) + 1
    for p in poems:
        if cfg.get("drop_line_rx"):
            p["lines"] = [l for l in p["lines"] if not re.match(cfg["drop_line_rx"], l)]
            while p["lines"] and not p["lines"][0].strip():
                p["lines"].pop(0)
        if p["title"] and tcount[p["title"]] >= 3 and len(p["title"].split()) <= 2:
            continue   # a speaker's name in a play, not a poem title
        body = [l for l in p["lines"] if l.strip()]
        if len(body) < cfg.get("min_lines", 1 if cfg.get("prose") else 2) or len(body) > cfg.get("max_lines", 450):
            continue
        if junk_poem(body, cfg):
            continue
        ind = min(len(l) - len(l.lstrip()) for l in body)
        p["lines"] = [l[ind:] if l.strip() else "" for l in p["lines"]]
        if p["title"] and BAD_TITLE.match(p["title"]):
            p["title"] = ""
        ls = p["lines"]
        if not p["title"] and len(ls) > 3 and ls[1] == "" and len(ls[0].strip()) <= 50 and not re.search(r"[,;:]$", ls[0].strip()) and not cfg.get("prose"):
            p["title"] = smart_title(ls[0].replace("*", "")); p["lines"] = ls[2:]   # a heading set as the first line
        out.append(p)
    return out


JUNK_LINE = re.compile(r"^\s*([+|]-{3,}|\|\s|Produced by|E-?text|Note: Project Gutenberg|Transcriber|This e-?book|Project Gutenberg|Distributed Proofread|Internet Archive|https?://|www\.|Online Distributed|Printed by|Copyright|All rights reserved|Price|London:|New York:|Boston:|Chiswick Press|PRINTED)", re.I)
NOTE_LINE = re.compile(r"^\s*(\d+(-\d+)?\.\s+(=|[A-Z][a-z]+:|Note|See|Cf|The [a-z]+ )|(PAGE|Page|P\.|p\.|l\.|ll\.|Line|Lines|Stanza|St\.|v\.|vv\.)\s*\d|.*\.{4,}\s*\d+\s*$|\d+\s*\.\s+[A-Z].{0,40}$|.*\s{3,}\d{1,3}\s*$|.*\bed\.\s|.*\bMS\.|.*\bcf\.)")
BAD_TITLE = re.compile(r"^(produced|privately|transcriber|thanks|dedicat|copyright|author's edition|first printed|set up|university press|.*\bpress\b|by$|and$|to$|.{0,2}$|by |author of|poems?\b|edited|translated|with |illustrated|the poetical works|complete|contents|volume|vol\.|book of|selected|selections|notes?\b|footnotes|introduction|preface|appendix|index|finis|the end|mdc|m\.\s?a\.|oxford|london|new york|boston|henry frowde|printed)", re.I)


LATIN_WORDS = set("et est non quae mihi nec atque quod ad cum sed tibi sum sunt qui quam ut te me vel aut neque nunc iam enim hic haec hoc ille illa quid quis ego tu nos vos sua suo suis inter per sine tamen ubi".split())
ENGLISH_WORDS = set("the and of to in that is it with as his her my thy thou for but not be was are on all by me you we he she they this from at".split())


def junk_poem(body, cfg):
    if any(JUNK_LINE.match(l) for l in body[:3]):
        return True
    if all(is_caps(l) for l in body):
        return True
    if len(body) <= 3 and not cfg.get("short_ok") and not cfg.get("prose"):
        if any(len(l.split()) <= 3 or re.search(r"\d|^\s*by\b|\bNew York\b|\bLondon\b|\bedition\b", l, re.I) for l in body):
            return True   # title-page and imprint scraps
    notes = sum(1 for l in body if NOTE_LINE.match(l))
    if notes / len(body) > .2:
        return True
    if len(body) <= 3 and body[0].lstrip()[:1] in "\"“‘'" and not cfg.get("prose"):
        return True   # an epigraph
    words = re.findall(r"[a-z]+", " ".join(body).lower())
    latin = sum(1 for w in words if w in LATIN_WORDS)
    english = sum(1 for w in words if w in ENGLISH_WORDS)
    if len(words) > 4 and latin > english:
        return True   # a Latin (or other) original printed beside the translation
    letters = "".join(body)
    if sum(1 for c in letters if c.isalpha() and ord(c) < 128) < .6 * sum(1 for c in letters if c.isalpha()):
        return True   # mostly non-English (Greek in transliteration brackets, etc.)
    return False


# ======================================================================
# World poetry with originals
# ======================================================================
KANJI_NUM = {c: i for i, c in enumerate("〇一二三四五六七八九")}


def kanji_int(s):
    n, cur = 0, 0
    for ch in s:
        if ch == "百":
            n += (cur or 1) * 100; cur = 0
        elif ch == "十":
            n += (cur or 1) * 10; cur = 0
        else:
            cur = KANJI_NUM.get(ch, 0)
    return n + cur


def hyakunin():
    """The Ogura Hyakunin Isshu (compiled c. 1235): Japanese from ja.wikisource, William N. Porter's 1909 English."""
    raw = wikisource("ja", "小倉百人一首")
    out = []
    for row in raw.split("\n|-"):
        m = re.search(r'<span id="([^"]+)">', row)
        if not m:
            continue
        n = kanji_int(m.group(1))
        cells = [c.split("|", 1)[1] if c.startswith("style") else c for c in re.findall(r"\n\|([^\n]*)", row)]
        if len(cells) < 2 or not 1 <= n <= 100:
            continue
        parts = cells[0].split("<br />")
        k = next((i for i, p in enumerate(parts) if p.startswith("（")), len(parts))
        kana = re.sub(r"'''", "", " ".join(p.strip("（）") for p in parts[k:]))
        ja_lines = " ".join(parts[:k]).split()
        poet_ja = re.sub(r"\[\[(?:w:)?[^|\]]*\|([^\]]+)\]\]", r"\1", cells[1].split("<br />")[0])
        poet_ja = re.sub(r"\[\[(?:w:)?([^\]]+)\]\]", r"\1", poet_ja).strip()
        page = f"A Hundred Verses from Old Japan/Poem {n}"
        t = ws_html("en", page)
        by = re.search(rf"Poem {n} by[\s\xa0]+([^\n]+?)\s*\n", t)
        body = [l.strip() for l in t[t.find("Layout 2") + 8:].split("\n") if l.strip() and l.strip() != "\xa0"]
        # body: number, POET IN CAPS, romaji (5 lines), the poet again in caps, the English (5 lines), a prose note.
        # Porter's verses are all five lines, so take the first two runs of five verse-like lines.
        runs, run = [], []
        for l in body:
            if is_caps(l) or l.startswith("(") or len(l) > 70 or re.fullmatch(r"\d+", l):
                if len(run) >= 5:
                    runs.append(run[:5])
                run = []
            else:
                run.append(l)
        if len(run) >= 5:
            runs.append(run[:5])
        if len(runs) < 2:
            print("  porter: no structure for", n, file=sys.stderr)
            continue
        romaji, trans = runs[0], runs[1]
        out.append({
            "id": f"hyakunin-{n}", "title": f"One Hundred Poets, No. {n}", "poet": by.group(1).strip() if by else poet_ja,
            "poet_orig": poet_ja, "year": None, "era_year": 1000, "dated": "Hyakunin Isshu, compiled c. 1235",
            "trad": "Japanese", "lang": "ja", "form": "waka",
            "orig": ja_lines, "reading": [kana.strip()] if kana.strip() else [], "romaji": romaji,
            "lines": trans, "translator": "William N. Porter", "source": "A Hundred Verses from Old Japan", "pub": 1909,
            "url": "https://en.wikisource.org/wiki/" + urllib.parse.quote(page.replace(" ", "_")),
            "orig_url": "https://ja.wikisource.org/wiki/" + urllib.parse.quote("小倉百人一首"),
        })
    return out


# ---------- color words in the original languages ----------
# key: (word as shown, transliteration, one honest line on what it meant then, target color or None)
# Targets are app colors or data/library.json names; None means "a color word without one hue" (iro, poikilos).
GLOSS = {
    # Ancient Greek
    "el:kyaneos": ("κυάνεος", "kyáneos", "Dark, blue-black. From kyanos, a dark blue glaze or stone; Homer gives it to brows, clouds and ships.", "Midnight blue"),
    "el:porphyreos": ("πορφύρεος", "porphýreos", "A dark, heaving gleam: the surging sea, blood, death. Later the purple of murex dye. The word may describe motion as much as hue.", "Tyrian Purple"),
    "el:chloros": ("χλωρός", "chlōrós", "The pale green-yellow of new shoots, also of honey, sand and a face drained by fear. It means fresh and pale as much as green.", "Pistachio"),
    "el:oinops": ("οἶνοψ", "oínops", "'Wine-faced': the wine-dark sea. Whether it names a darkness, a sheen or a hue is still argued; it doesn't show the Greeks couldn't see blue.", "Wine"),
    "el:rhodo": ("ῥοδοδάκτυλος", "rhododáktylos", "'Rose-fingered', Dawn's stock epithet: the pink streaks of first light.", "Pink"),
    "el:kroko": ("κροκόπεπλος", "krokópeplos", "'Saffron-robed', Dawn's other epithet. Saffron gave a deep yellow-orange dye.", "Saffron"),
    "el:leukos": ("λευκός", "leukós", "White, but first of all bright and gleaming.", "White"),
    "el:melas": ("μέλας", "mélas", "Black or dark: the earth, ships, blood, wine.", "Black"),
    "el:erythros": ("ἐρυθρός", "erythrós", "Red. Ereúthetai, 'it reddens', is the same root.", "Red"),
    "el:xanthos": ("ξανθός", "xanthós", "Yellow to tawny gold: ripe grain, and the hair of heroes like Menelaus.", "Flax"),
    "el:chryseos": ("χρύσεος", "khrýseos", "Golden, made of gold.", "Gold"),
    "el:argyreos": ("ἀργύρεος", "argýreos", "Silver, silvery.", "Silver"),
    "el:ion": ("ἴον", "íon", "The violet flower. 'Violet-haired' or 'violet-crowned' may mean dark, glossy hair or a garland; nobody is sure.", "Violet"),
    "el:poikilos": ("ποικίλος", "poikílos", "Many-colored, dappled, intricately worked.", None),
    "el:glaukos": ("γλαυκός", "glaukós", "Gleaming, pale blue-grey or grey-green. Athena is glaukôpis, 'gleaming-eyed'.", "Glaucous"),
    "el:polios": ("πολιός", "poliós", "Grey, grizzled: the grey sea, grey hair.", "Grey"),
    "el:phoinix": ("φοῖνιξ", "phoînix", "Crimson-red, the dye the Phoenicians traded.", "Carmine"),
    # Latin
    "la:purpureus": ("purpureus", "", "Purple, the murex dye, but also simply 'glowing': Horace has purple swans.", "Tyrian Purple"),
    "la:caeruleus": ("caeruleus", "", "Dark blue or sea-blue, sometimes dark green or just dark. The root of 'cerulean'.", "Cerulean"),
    "la:candidus": ("candidus", "", "Dazzling, shining white. Albus is the plain, matte white.", "White"),
    "la:albus": ("albus", "", "Plain, matte white.", "White"),
    "la:niger": ("niger", "", "Glossy black. Ater is the dull, gloomy black.", "Black"),
    "la:ater": ("ater", "", "Dull, gloomy black, the color of death and mourning.", "Black"),
    "la:ruber": ("ruber", "", "Red.", "Red"),
    "la:roseus": ("roseus", "", "Rose-colored, pink.", "Pink"),
    "la:flavus": ("flavus", "", "Golden-yellow, blond.", "Flax"),
    "la:fulvus": ("fulvus", "", "Tawny, reddish-yellow: lions, sand, gold.", "Tawny"),
    "la:viridis": ("viridis", "", "Green, and also fresh and young.", "Green"),
    "la:croceus": ("croceus", "", "Saffron-yellow.", "Saffron"),
    "la:luteus": ("luteus", "", "Yellow, the dye of the weld plant.", "Yellow"),
    "la:aureus": ("aureus", "", "Golden.", "Gold"),
    "la:argenteus": ("argenteus", "", "Silver.", "Silver"),
    "la:niveus": ("niveus", "", "Snow-white.", "White"),
    "la:sanguineus": ("sanguineus", "", "Blood-red.", "Blood"),
    "la:pallidus": ("pallidus", "", "Pale, wan; in flowers, a pale yellow-green.", None),
    "la:ferrugineus": ("ferrugineus", "", "'Rust-colored': a dark, dusky hue. Readers disagree whether it leans red, purple or blue.", "Rust"),
    "la:puniceus": ("puniceus", "", "'Phoenician' red, crimson.", "Crimson"),
    # Chinese
    "zh:qing": ("青", "qīng", "The color of nature: blue, green, even black (青絲, black hair). One word where English needs three.", "Teal"),
    "zh:lu": ("綠", "lǜ", "Green: leaves, water, green-dyed silk.", "Green"),
    "zh:bi": ("碧", "bì", "Jade green or jade blue: deep water, a clear sky, green jade.", "Jade"),
    "zh:cui": ("翠", "cuì", "Kingfisher green, from the bird's bright blue-green feathers.", "Emerald"),
    "zh:hong": ("紅", "hóng", "Red, from pink to scarlet: flowers, blushing faces, rouge.", "Red"),
    "zh:zhu": ("朱", "zhū", "Vermilion, cinnabar red.", "Vermilion"),
    "zh:dan": ("丹", "dān", "Cinnabar red.", "Vermilion"),
    "zh:chi": ("赤", "chì", "Red, a fiery red.", "Red"),
    "zh:bai": ("白", "bái", "White; also bright, clear and plain.", "White"),
    "zh:huang": ("黃", "huáng", "Yellow, the color of earth and of the emperor.", "Yellow"),
    "zh:zi": ("紫", "zǐ", "Purple.", "Purple"),
    "zh:hei": ("黑", "hēi", "Black.", "Black"),
    "zh:cang": ("蒼", "cāng", "Deep green or grey-blue: distant hills, the sky, grey hair.", "Slate"),
    "zh:lan": ("藍", "lán", "The indigo plant. 'Green as lan' may mean its green leaves or the blue dye made from them; readers still argue.", "Indigo"),
    "zh:yin": ("銀", "yín", "Silver. The Silver River, 銀河, is the Milky Way.", "Silver"),
    "zh:sese": ("瑟瑟", "sèsè", "A blue-green gemstone; here the shaded half of the river.", "Turquoise"),
    "zh:jin": ("金", "jīn", "Gold, golden.", "Gold"),
    "zh:caose": ("草色", "cǎosè", "'Grass color': a green you can see from far off but not up close.", "Green"),
    "zh:wu": ("烏", "wū", "Crow-black.", "Black"),
    # Japanese
    "ja:shirotae": ("白妙", "shirotae", "White cloth of mulberry bark; a set epithet for white things, robes and snow.", "White"),
    "ja:shiro": ("白", "shiro", "White.", "White"),
    "ja:kurenai": ("紅", "kurenai", "Crimson from safflower. The name means 'the dye of Kure (China)'; kara-kurenai is 'Chinese crimson'.", "Crimson"),
    "ja:momiji": ("紅葉", "momiji", "Autumn leaves, from momitsu, 'to turn red or yellow'.", "Rust"),
    "ja:kurokami": ("黒髪", "kurokami", "Black hair, long and glossy, a mark of beauty in Heian poems.", "Black"),
    "ja:kuro": ("黒", "kuro", "Black.", "Black"),
    "ja:sumizome": ("墨染", "sumizome", "'Ink-dyed': the grey-black of a monk's robe.", "Charcoal"),
    "ja:iro": ("色", "iro", "Color, and also love and sensual beauty. Komachi's poem means both at once.", None),
    "ja:murasaki": ("紫", "murasaki", "Purple from gromwell root, the noblest color of the Heian court.", "Purple"),
    "ja:ao": ("青", "ao", "Blue and green together; a green traffic light is still 'ao'.", "Teal"),
    "ja:midori": ("緑", "midori", "Green, first the green of new shoots.", "Green"),
    "ja:aka": ("赤", "aka", "Red.", "Red"),
    "ja:akaaka": ("あかあか", "akaaka", "'Red, red': the blaze of a low sun.", "Red"),
    "ja:shira": ("しら", "shira", "White (as in shiratsuyu, white dew).", "White"),
    # Persian
    "fa:sabz": ("سبز", "sabz", "Green; also fresh and flourishing, and the first down on a young cheek.", "Green"),
    "fa:sorkh": ("سرخ", "sorkh", "Red.", "Red"),
    "fa:zard": ("زرد", "zard", "Yellow; also the pale face of a lover or the sick.", "Yellow"),
    "fa:siyah": ("سیاه", "siyāh", "Black.", "Black"),
    "fa:sepid": ("سپید", "sepid", "White.", "White"),
    "fa:lal": ("لعل", "laʿl", "Ruby or red spinel: the beloved's lips, and red wine.", "Ruby"),
    "fa:firuze": ("فیروزه", "firuze", "Turquoise. 'The turquoise vault' is the sky.", "Turquoise"),
    "fa:lale": ("لاله", "lāle", "The tulip or wild red tulip, Persian poetry's emblem of red, often of blood.", "Scarlet"),
    "fa:arghavan": ("ارغوان", "arghavān", "The Judas tree, whose red-purple blossom names a color.", "Mulberry"),
    "fa:banafshe": ("بنفشه", "banafshe", "The violet flower; the color word banafsh comes from it.", "Violet"),
    "fa:kabud": ("کبود", "kabud", "Dark blue, livid.", "Indigo"),
    "fa:zar": ("زر", "zar", "Gold.", "Gold"),
    # Italian (Dante)
    "it:perso": ("perso", "", "Dante's dark purple-black. In the Convivio he calls it a mix of purple and black in which black wins.", "Aubergine"),
    "it:zaffiro": ("zaffiro", "", "Sapphire.", "Sapphire"),
}
# simple words in French, Italian and German: word -> target (no note needed)
SIMPLE = {
    "fr": {"rouge": "Red", "rouges": "Red", "bleu": "Blue", "bleue": "Blue", "bleus": "Blue", "bleues": "Blue", "vert": "Green", "verte": "Green", "verts": "Green", "vertes": "Green",
           "noir": "Black", "noire": "Black", "noirs": "Black", "noires": "Black", "blanc": "White", "blanche": "White", "blancs": "White", "blanches": "White", "blancheur": "White", "blancheurs": "White",
           "jaune": "Yellow", "jaunes": "Yellow", "violet": "Violet", "violette": "Violet", "violets": "Violet", "pourpre": "Tyrian Purple", "pourpres": "Tyrian Purple", "vermeil": "Vermilion", "vermeille": "Vermilion",
           "écarlate": "Scarlet", "azur": "Azure", "gris": "Grey", "grise": "Grey", "grises": "Grey", "brun": "Brown", "brune": "Brown", "bruns": "Brown", "fauve": "Tawny", "fauves": "Tawny",
           "roux": "Auburn", "rousse": "Auburn", "cramoisi": "Crimson", "émeraude": "Emerald", "argent": "Silver", "argenté": "Silver", "argentée": "Silver", "doré": "Gold", "dorée": "Gold", "dorés": "Gold",
           "ébène": "Black", "ivoire": "Ivory", "neigeux": "White", "glauque": "Glaucous", "virides": "Green", "candeurs": "White", "candeur": "White", "vermillon": "Vermilion", "rose": None, "rosé": "Pink", "rosée": None, "rousses": "Auburn", "d'or": "Gold"},
    "it": {"rosso": "Red", "rossa": "Red", "rossi": "Red", "rosse": "Red", "verde": "Green", "verdi": "Green", "bianco": "White", "bianca": "White", "bianchi": "White", "bianche": "White", "candido": "White", "candida": "White",
           "nero": "Black", "nera": "Black", "neri": "Black", "nere": "Black", "vermiglio": "Vermilion", "vermiglia": "Vermilion", "bruno": "Brown", "bruna": "Brown", "bruni": "Brown", "giallo": "Yellow",
           "azzurro": "Azure", "azzurra": "Azure", "sanguigno": "Blood", "oro": "Gold", "d'oro": "Gold", "biondo": "Flax", "bionda": "Flax", "rosata": "Pink", "rosato": "Pink", "purpureo": "Tyrian Purple", "fiamma": None},
    "de": {"blau": "Blue", "blaue": "Blue", "blauen": "Blue", "blauer": "Blue", "blaues": "Blue", "grün": "Green", "grüne": "Green", "grünen": "Green", "grüner": "Green", "rot": "Red", "rote": "Red", "roten": "Red", "roter": "Red",
           "rosa": "Pink", "lila": "Lilac", "gelb": "Yellow", "gelbe": "Yellow", "gelben": "Yellow", "weiße": "White", "weißen": "White", "weißer": "White", "grau": "Grey", "graue": "Grey", "grauen": "Grey",
           "violett": "Violet", "grünem": "Green", "blaues": "Blue", "rosa": "Pink", "golden": "Gold", "goldne": "Gold", "goldnen": "Gold", "silbern": "Silver", "schwarz": "Black", "schwarze": "Black", "schwarzen": "Black", "Gold-Orangen": "Gold"},
}


def strip_accents(s):
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return s.lower().replace("ς", "σ")


GREEK_RULES = [  # (regex on accent-free lowercase token, gloss key)
    (r"^κυαν", "el:kyaneos"), (r"πορφυρ", "el:porphyreos"), (r"^χλωρ", "el:chloros"), (r"^οινοπ|^οινοψ", "el:oinops"),
    (r"^ροδοδακτυλ|^βροδοπαχ|^ροδοπηχ", "el:rhodo"), (r"^κροκοπεπλ|^κροκ", "el:kroko"), (r"^λευκ", "el:leukos"),
    (r"^μελαν|^μελαιν|^μελασ$", "el:melas"), (r"^ερυθρ|^ερευθ", "el:erythros"), (r"^ξανθ", "el:xanthos"),
    (r"^χρυσ", "el:chryseos"), (r"^αργυρ", "el:argyreos"), (r"^ιοπλοκ|^ιοστεφ|^ιοκολπ|^ιου$|^ιων$", "el:ion"),
    (r"^ποικιλ", "el:poikilos"), (r"^γλαυκ", "el:glaukos"), (r"^πολι(ησ|η|ον|οιο|οι|ασ|οσ|ην|ου)$", "el:polios"), (r"^φοινικ", "el:phoinix"),
]
LATIN_RULES = [
    (r"^purpure", "la:purpureus"), (r"^caerule|^caerul|^cerule", "la:caeruleus"), (r"^candid", "la:candidus"),
    (r"^alb(a|um|us|i|ae|is|o|am|as|os|ent\w*|esc\w*)$", "la:albus"), (r"^nig(er|r\w+)$", "la:niger"),
    (r"^at(er|ra|rum|ri|rae|ris|ro|ram|ras|ros)$", "la:ater"), (r"^rub(er|r\w*|ent\w*|ens|esc\w*|or\w*|icund\w*)$", "la:ruber"),
    (r"^rose(us|a|um|i|ae|is|o|am|as|os)$", "la:roseus"), (r"^flav", "la:flavus"), (r"^fulv", "la:fulvus"),
    (r"^virid|^viren|^viresc", "la:viridis"), (r"^croce", "la:croceus"), (r"^lute(us|a|um|i|ae|is|o|am|ol\w*)$", "la:luteus"),
    (r"^aure(us|a|um|i|is|o|am|as|os|ae)$", "la:aureus"), (r"^argente", "la:argenteus"), (r"^nive(us|a|um|i|ae|is|o|am|as|os)$", "la:niveus"),
    (r"^sanguine(us|a|um|i|ae|is|o|am|as|os)$", "la:sanguineus"), (r"^pallid|^pallen", "la:pallidus"), (r"^ferrugin", "la:ferrugineus"), (r"^punice", "la:puniceus"),
]
# CJK: longest match first; stop phrases are names or money, not colors
ZH_TERMS = [("瑟瑟", "zh:sese"), ("草色", "zh:caose"), ("金樽", "zh:jin"), ("烏衣", "zh:wu"), ("青", "zh:qing"), ("綠", "zh:lu"), ("绿", "zh:lu"), ("碧", "zh:bi"), ("翠", "zh:cui"),
            ("紅", "zh:hong"), ("红", "zh:hong"), ("朱", "zh:zhu"), ("丹", "zh:dan"), ("赤", "zh:chi"), ("白", "zh:bai"), ("黃", "zh:huang"), ("黄", "zh:huang"), ("紫", "zh:zi"),
            ("黑", "zh:hei"), ("蒼", "zh:cang"), ("藍", "zh:lan"), ("銀", "zh:yin")]
ZH_STOP = ["白帝", "黃師", "黄師", "丹丘", "岑夫子", "黄四娘"]
JA_TERMS = [("白妙", "ja:shirotae"), ("紅葉", "ja:momiji"), ("黒髪", "ja:kurokami"), ("墨染", "ja:sumizome"), ("あかあか", "ja:akaaka"), ("あか〳〵", "ja:akaaka"), ("しら露", "ja:shira"), ("靑", "ja:ao"), ("黑", "ja:kuro"),
            ("紅", "ja:kurenai"), ("白", "ja:shiro"), ("黒", "ja:kuro"), ("色", "ja:iro"), ("紫", "ja:murasaki"), ("青", "ja:ao"), ("緑", "ja:midori"), ("赤", "ja:aka")]
FA_TERMS = [("سبز", "fa:sabz"), ("سرخ", "fa:sorkh"), ("زرد", "fa:zard"), ("سیاه", "fa:siyah"), ("سیه", "fa:siyah"), ("سپید", "fa:sepid"), ("سفید", "fa:sepid"),
            ("لعل", "fa:lal"), ("فیروزه", "fa:firuze"), ("لاله", "fa:lale"), ("ارغوان", "fa:arghavan"), ("کبود", "fa:kabud"), ("بنفشه", "fa:banafshe")]
FA_SUFFIX = ("", "ی", "ها", "های", "ان", "ش", "م", "ت", "ین", "ه", "گون", "فام", "زار")


def find_orig(line, lang):
    """Color words in an original-language line: [(start, end, key)], key is a GLOSS key or 'simple:<Target>'."""
    out = []
    if lang in ("zh", "ja"):
        terms = ZH_TERMS if lang == "zh" else JA_TERMS
        stops = ZH_STOP if lang == "zh" else []
        blocked = set()
        for s in stops:
            for m in re.finditer(re.escape(s), line):
                blocked.update(range(m.start(), m.end()))
        used = set()
        for term, key in terms:
            for m in re.finditer(re.escape(term), line):
                r = set(range(m.start(), m.end()))
                if r & used or r & blocked:
                    continue
                used |= r
                out.append((m.start(), m.end(), key))
    elif lang == "fa":
        for m in re.finditer(r"[؀-ۿ‌]+", line):
            tok = re.sub(r"[\u064B-\u065F\u0670]", "", m.group(0).replace("\u200c", ""))
            for term, key in FA_TERMS:
                if tok.startswith(term) and tok[len(term):] in FA_SUFFIX:
                    out.append((m.start(), m.end(), key)); break
    elif lang in ("el", "la"):
        rules = GREEK_RULES if lang == "el" else LATIN_RULES
        for m in re.finditer(r"[^\W\d_]+", line):
            tok = strip_accents(m.group(0))
            for rx, key in rules:
                if re.search(rx, tok):
                    out.append((m.start(), m.end(), key)); break
    elif lang in SIMPLE:
        table = SIMPLE[lang]
        for m in re.finditer(r"[^\W\d_]+(?:-[^\W\d_]+)?", line):
            w = m.group(0); lw = w.lower()
            t = table.get(w) or table.get(lw)
            if lang == "it" and lw == "perso":
                out.append((m.start(), m.end(), "it:perso")); continue
            if lang == "it" and lw == "zaffiro":
                out.append((m.start(), m.end(), "it:zaffiro")); continue
            if t:
                out.append((m.start(), m.end(), "simple:" + t))
    out.sort()
    return out


def pg_poem(pid, title, stop=r"^\s*(_By |Note\.|\[Footnote)", skip=0):
    """One poem from a Gutenberg book: the lines after its title line, up to a stop line or a wide gap."""
    lines = pg_text(pid).split("\n")
    idx = [i for i, l in enumerate(lines) if l.strip().strip("_").rstrip(".") == title]
    if not idx or len(idx) <= skip:
        raise ValueError(f"title not found in {pid}: {title}")
    out, blank = [], 0
    for l in lines[idx[skip] + 1:]:
        if re.match(stop, l):
            break
        if not l.strip():
            blank += 1
            if out and blank >= 3:
                break
            continue
        if out and blank:
            out.append("")
        blank = 0
        out.append(clean_line(l))
    ind = min(len(l) - len(l.lstrip()) for l in out if l.strip())
    return [l[ind:] for l in out]


def pg_between(pid, start, end, include_end=True):
    """Lines of a Gutenberg book from the line containing `start` to the line containing `end`; prose is unwrapped."""
    text = pg_text(pid)
    a = text.find(start)
    if a < 0:
        raise ValueError(f"start not found in {pid}: {start}")
    a = text.rfind("\n", 0, a) + 1
    b = text.find(end, a)
    if b < 0:
        raise ValueError(f"end not found in {pid}: {end}")
    b = text.find("\n", b + len(end)) if include_end else text.rfind("\n", 0, b)
    if b < 0:
        b = len(text)
    chunk = [clean_line(l) for l in text[a:b].split("\n")]
    if is_prose(chunk):
        paras, cur = [], []
        for l in chunk:
            if l.strip():
                cur.append(l.strip())
            elif cur:
                paras.append(" ".join(cur)); cur = []
        if cur:
            paras.append(" ".join(cur))
        out = []
        for p in paras:
            if out:
                out.append("")
            out.append(p)
        return out
    ind = min(len(l) - len(l.lstrip()) for l in chunk if l.strip())
    out = [l[ind:].rstrip() for l in chunk]
    while out and not out[-1].strip():
        out.pop()
    return out


def zh_text(page):
    """A Chinese poem from zh.wikisource, one line per clause."""
    raw = wikisource("zh", page)
    blocks = re.findall(r"<poem[^>]*>(.*?)</poem>", raw, re.S)
    body = "\n".join(blocks) if blocks else raw
    body = re.sub(r"\[\[(?:Category|File|分類|Image):[^\]]*\]\]", "", body)
    body = re.sub(r"\[\[[^|\]]*\|([^\]]*)\]\]|\[\[([^\]]*)\]\]", lambda m: m.group(1) or m.group(2), body)
    body = re.sub(r"<ref[^>]*>.*?</ref>|<ref[^/]*/>", "", body, flags=re.S)
    body = re.sub(r"\{\{另2?\|([^|}]*)\|[^}]*\}\}", r"\1", body)
    body = re.sub(r"\{\{(?:ul|專名號|书名号|書名號)\|([^}]*)\}\}", r"\1", body)
    body = re.sub(r"\{\{[^}]*\}\}", "", body)
    body = re.sub(r"<[^>]+>", "", body)
    lines = []
    for l in re.split(r"[\n\s]+", body):
        l = l.strip().lstrip(":：")
        if not l:
            continue
        lines += [x for x in re.findall(r"[^，。！？；]+[，。！？；]?", l) if x.strip()]
    return lines


# Tang poems (and one older one). Translations are Ezra Pound's Cathay (1915) where he translated the poem,
# otherwise ColorHub's plain translation. Each: page, English title, poet, poet in Chinese, year, translation[, a line to pick one poem of a set].
PLAIN = "ColorHub's plain translation"
ZH_POEMS = [
    ("絕句 (兩個黃鸝鳴翠柳)", "Quatrain: Two Yellow Orioles", "Du Fu", "杜甫", 764, [
        "Two yellow orioles sing in the kingfisher-green willows;", "a line of white egrets climbs the blue-green sky.",
        "My window holds the western peaks' snow of a thousand autumns;", "at my gate are moored the boats of Eastern Wu, ten thousand li from home."]),
    ("鹿柴 (王維)", "Deer Park", "Wang Wei", "王維", 750, [
        "Empty mountain: no one to be seen,", "only the sound of voices echoing.", "Light returning enters the deep wood", "and shines again upon the green moss."]),
    ("山中 (王維)", "In the Mountains", "Wang Wei", "王維", 750, [
        "White stones rise out of the Jing stream;", "the weather turns cold, the red leaves grow few.",
        "There was no rain at all on the mountain path,", "but the empty kingfisher-green dampens our clothes."]),
    ("黃鶴樓送孟浩然之廣陵", "Seeing Meng Haoran Off to Guangling at Yellow Crane Tower", "Li Bai", "李白", 730, [
        "My old friend says farewell to Yellow Crane Tower in the west;", "in the third month, through mist and flowers, he goes down to Yangzhou.",
        "The far shadow of his lone sail fades into the blue-green hills;", "I see only the long river flowing to the edge of heaven."]),
    ("將進酒 (李白)", "Bring the Wine", "Li Bai", "李白", 752, [
        "Do you not see the waters of the Yellow River", "coming down from the sky,", "rushing to the sea, never to return?",
        "Do you not see, in the bright mirrors of high halls,", "people grieving over white hair:", "black silk in the morning, by evening turned to snow?",
        "When life goes your way, take your joy to the full;", "never let the golden cup face the moon empty.",
        "Heaven made my talents, so they must have a use;", "spend a thousand in gold and it all comes back.",
        "Boil the lamb, kill the ox, let us be merry;", "we must drink three hundred cups at one go.",
        "Master Cen,", "Danqiu,", "here comes the wine, don't put your cups down.", "Let me sing you a song;", "please lend me your ears.",
        "Bells and drums, fine food and jade are not worth prizing;", "I only want to stay drunk and never wake.",
        "Since ancient times the sages have all been forgotten;", "only the drinkers have left their names.",
        "The Prince of Chen once feasted at Pingle Palace,", "ten thousand a measure for wine, revelling as he pleased.",
        "Why should the host say he is short of money?", "Go straight out, buy wine, and pour for my friends.",
        "The dappled horse,", "the furs worth a thousand in gold:", "call the boy, take them out and trade them for fine wine,", "and with you I'll drown the sorrows of ten thousand ages."]),
    ("山行 (杜牧)", "Mountain Walk", "Du Mu", "杜牧", 840, [
        "Far up the cold mountain a stone path slants;", "where the white clouds are born, there are houses.",
        "I stop the carriage, simply for love of the maple wood at dusk:", "the frosted leaves are redder than the flowers of spring."]),
    ("憶江南 (白居易)", "Remembering the South", "Bai Juyi", "白居易", 838, [
        "The south of the river is lovely;", "its scenery I once knew well.", "At sunrise the river flowers are redder than fire;",
        "when spring comes the river water is green as indigo.", "How could I not remember the south?"], ("江南好", 5)),
    ("詠柳 (賀知章)", "The Willow", "He Zhizhang", "賀知章", 730, [
        "Dressed in jade green, one tall tree;", "ten thousand strands hang down like green silk ribbons.",
        "Who cut out these fine leaves, I wonder?", "The spring wind of the second month, like scissors."]),
    ("登鸛雀樓 (王之渙)", "Climbing Stork Tower", "Wang Zhihuan", "王之渙", 720, [
        "The white sun sinks behind the mountains;", "the Yellow River flows into the sea.", "To see a thousand li further,", "climb one more storey of the tower."]),
    ("黃鶴樓 (崔顥)", "Yellow Crane Tower", "Cui Hao", "崔顥", 730, [
        "The ancients have already ridden the yellow crane away;", "here only the Yellow Crane Tower is left.",
        "Once gone, the yellow crane never returns;", "for a thousand years the white clouds drift on, empty.",
        "Across the sunlit river the trees of Hanyang stand clear;", "sweet grass grows thick on Parrot Island.",
        "Sunset: where is my home town?", "Mist on the river waves makes me sad."]),
    ("相思", "Longing", "Wang Wei", "王維", 740, [
        "Red beans grow in the southern lands;", "spring comes, and how many branches sprout?",
        "I hope you will gather many:", "these, more than anything, mean longing."]),
    ("江南春", "Spring South of the River", "Du Mu", "杜牧", 840, [
        "For a thousand li orioles sing, green against red;", "water villages, mountain walls, wine flags in the wind.",
        "Of the Southern Dynasties' four hundred and eighty temples,", "how many towers and terraces stand in the misty rain?"]),
    ("早春呈水部張十八員外二首", "Early Spring, for Zhang the Eighteenth", "Han Yu", "韓愈", 823, [
        "Light rain on the capital's streets, soft as butter;", "the grass's color, seen from far off, is gone up close.",
        "This is the best moment of the year's spring,", "far better than the misty willows that fill the capital."], "草色遙看"),
    ("望廬山瀑布 (日照香爐生紫烟)", "Looking at the Lu Mountain Waterfall", "Li Bai", "李白", 725, [
        "Sun on Incense Burner Peak, and purple smoke rises;", "far off I see the waterfall hanging over the river.",
        "Its flying stream plunges straight down three thousand feet:", "is it the Silver River falling from the ninth heaven?"]),
    ("暮江吟", "Evening River Song", "Bai Juyi", "白居易", 822, [
        "A single beam of the setting sun spreads over the water:", "half the river jade-blue, half the river red.",
        "How lovely, the night of the third of the ninth month:", "dew like real pearls, the moon like a bow."]),
    ("送元二使安西", "Seeing Off Yuan the Second on a Mission to Anxi", "Wang Wei", "王維", 750, [
        "Morning rain in Weicheng wets the light dust;", "by the inn the willows are green on green, their color new.",
        "Let me urge you to drain one more cup of wine:", "west of Yang Pass you will have no old friends."]),
    ("烏衣巷", "Black Robe Lane", "Liu Yuxi", "劉禹錫", 826, [
        "By Vermilion Bird Bridge the wild grasses flower;", "at the mouth of Black Robe Lane the evening sun slants.",
        "The swallows that once nested before the halls of the great families", "now fly into the houses of ordinary people."]),
    ("春夜喜雨", "Welcome Rain on a Spring Night", "Du Fu", "杜甫", 761, [
        "Good rain knows its season:", "it comes just as spring brings things to life.", "Following the wind it slips into the night,", "soaking everything, fine and soundless.",
        "Over the country paths the clouds are all black;", "only a river boat's lamp glows.", "At dawn, look where it is red and wet:", "the flowers hang heavy over the City of Brocade."]),
    ("春望", "Spring View", "Du Fu", "杜甫", 757, [
        "The nation is broken; mountains and rivers remain.", "Spring in the city: grass and trees grow deep.", "Moved by the times, the flowers splash tears;",
        "grieving at parting, the birds startle the heart.", "The beacon fires have burned for three months;", "a letter from home is worth ten thousand in gold.",
        "I scratch my white head and the hair grows thinner,", "until it can hardly hold a hairpin."]),
    ("江畔獨步尋花七絶句", "Looking for Flowers Alone by the River (No. 5)", "Du Fu", "杜甫", 761, [
        "Before Master Huang's pagoda the river flows east;", "spring light, lazy and drowsy, leans on a light breeze.",
        "A cluster of peach blossom opens, belonging to no one:", "lovely, the deep red shining against the pale red."], "可愛深紅"),
    ("過故人莊", "Visiting an Old Friend's Farm", "Meng Haoran", "孟浩然", 730, [
        "My old friend made chicken and millet", "and asked me to his farm.", "Green trees close round the village;", "blue-green hills slant beyond the wall.",
        "We open the window onto the threshing floor and the garden,", "raise our cups and talk of mulberry and hemp.", "Wait for the Double Ninth:", "I'll come back for the chrysanthemums."]),
    ("送友人 (李白)", "Taking Leave of a Friend", "Li Bai", "李白", 750, ("pound", "Taking Leave of a Friend")),
    ("長干行 (妾髮初覆額)", "The River-Merchant's Wife: a Letter", "Li Bai", "李白", 725, ("pound", "The River-Merchant's Wife: a Letter")),
    ("玉階怨 (李白)", "The Jewel Stairs' Grievance", "Li Bai", "李白", 740, ("pound", "The Jewel Stairs' Grievance")),
    ("青青河畔草", "The Beautiful Toilet", "Anonymous (Han dynasty)", "無名氏", -100, ("pound", "The Beautiful Toilet")),
]


def zh_poems():
    out = []
    for spec in ZH_POEMS:
        page, title, poet, poet_zh, year, tr = spec[:6]
        lines = zh_text(page)
        if len(spec) > 6 and isinstance(spec[6], tuple):   # (first line, number of lines)
            hit = next(i for i, l in enumerate(lines) if spec[6][0] in l)
            lines = lines[hit:hit + spec[6][1]]
        elif len(spec) > 6:   # one poem out of a set of quatrains: keep the one that holds this line
            hit = next(i for i, l in enumerate(lines) if spec[6] in l)
            start = hit - hit % 4
            lines = lines[start:start + 4]
        rec = {"id": "zh-" + hashlib.md5(page.encode()).hexdigest()[:8], "title": title, "poet": poet, "poet_orig": poet_zh,
               "year": year, "approx": True, "trad": "Chinese", "lang": "zh", "orig": lines,
               "orig_url": "https://zh.wikisource.org/wiki/" + urllib.parse.quote(page.replace(" ", "_"))}
        if isinstance(tr, tuple):
            rec.update(lines=pg_poem(50155, tr[1]), translator="Ezra Pound", source="Cathay", pub=1915, url=PG_PAGE.format(id=50155),
                       tnote="Pound's free version, made from Ernest Fenollosa's notes.")
        else:
            rec.update(lines=tr, translator=PLAIN, source=None, pub=None, url=None)
        out.append(rec)
    return out


# ======================================================================
# The English-language shelf: Gutenberg books, each split into poems
# ======================================================================
# (id, poet, book year, poem year for the era filter, tradition, extra settings)
# translator/orig: who translated and what the original language was. Every edition here was published before 1930.
EN, AM = "English", "English"
BOOKS = [
    (1041, "William Shakespeare", 1609, 1600, EN, {"num_split": True, "num_title": "Sonnet {n}", "title": "Sonnets"}),
    (1934, "William Blake", 1794, 1794, EN, {"start": r"^SONGS OF INNOCENCE\s*$\n\n\n"}),
    (574, "William Blake", 1863, 1800, EN, {}),
    (8209, "John Keats", 1817, 1817, EN, {}),
    (4800, "Percy Bysshe Shelley", 1839, 1820, EN, {}),
    (8774, "William Wordsworth", 1807, 1807, EN, {}),
    (8824, "William Wordsworth", 1807, 1807, EN, {}),
    (8208, "Samuel Taylor Coleridge", 1798, 1800, EN, {}),
    (16376, "Robert Browning", 1855, 1855, EN, {}),
    (2002, "Elizabeth Barrett Browning", 1850, 1850, EN, {"num_split": True, "num_title": "Sonnets from the Portuguese, {n}"}),
    (19188, "Christina Rossetti", 1890, 1870, EN, {}),
    (16950, "Christina Rossetti", 1866, 1862, EN, {}),
    (3692, "Dante Gabriel Rossetti", 1881, 1881, EN, {"num_split": True, "num_title": "The House of Life, {n}"}),
    (18726, "Algernon Charles Swinburne", 1889, 1889, EN, {}),
    (22403, "Gerard Manley Hopkins", 1918, 1880, EN, {}),
    (1322, "Walt Whitman", 1892, 1860, AM, {"titlecase": True}),
    (12242, "Emily Dickinson", 1890, 1865, AM, {"num_split": True, }),
    (10031, "Edgar Allan Poe", 1845, 1845, AM, {}),
    (1365, "Henry Wadsworth Longfellow", 1893, 1855, AM, {}),
    (32233, "W. B. Yeats", 1899, 1899, EN, {}),
    (30652, "W. B. Yeats", 1903, 1903, EN, {"end": r"^THE RIDER FROM THE NORTH", }),
    (30488, "W. B. Yeats", 1910, 1910, EN, {"end": r"^THE GREEN HELMET\s*$", }),
    (36865, "W. B. Yeats", 1916, 1916, EN, {}),
    (32491, "W. B. Yeats", 1919, 1919, EN, {}),
    (7164, "Rabindranath Tagore", 1912, 1910, "Bengali", {"num_split": True, "prose": True, "translator": "Rabindranath Tagore", "num_title": "Gitanjali {n}"}),
    (6686, "Rabindranath Tagore", 1913, 1913, "Bengali", {"num_split": True, "prose": True, "translator": "Rabindranath Tagore", "num_title": "The Gardener {n}"}),
    (6519, "Kabir", 1915, 1450, "Hindi", {"drop_line_rx": r"^\s*[IV]+\.\s*\d+\.", "num_split": True, "translator": "Rabindranath Tagore", "prose": True, "num_title": "Songs of Kabir, {n}"}),
    (3167, "Thomas Hardy", 1898, 1898, EN, {}),
    (3168, "Thomas Hardy", 1901, 1901, EN, {}),
    (2863, "Thomas Hardy", 1914, 1914, EN, {}),
    (3255, "Thomas Hardy", 1917, 1917, EN, {}),
    (5720, "A. E. Housman", 1896, 1896, EN, {"num_split": True, "num_title": "A Shropshire Lad, {n}"}),
    (7848, "A. E. Housman", 1922, 1922, EN, {"num_split": True, "num_title": "Last Poems, {n}"}),
    (3021, "Robert Frost", 1913, 1913, AM, {"titlecase": True, }),
    (3026, "Robert Frost", 1914, 1914, AM, {"titlecase": True, }),
    (29345, "Robert Frost", 1916, 1916, AM, {}),
    (58611, "Robert Frost", 1923, 1923, AM, {}),
    (442, "Sara Teasdale", 1917, 1917, AM, {"titlecase": True, }),
    (596, "Sara Teasdale", 1915, 1915, AM, {}),
    (591, "Sara Teasdale", 1920, 1920, AM, {"titlecase": True, }),
    (400, "Sara Teasdale", 1911, 1911, AM, {"titlecase": True, }),
    (69866, "Sara Teasdale", 1926, 1926, AM, {"titlecase": True, }),
    (261, "Amy Lowell", 1912, 1912, AM, {"titlecase": True, }),
    (1020, "Amy Lowell", 1914, 1914, AM, {"titlecase": True, }),
    (841, "Amy Lowell", 1916, 1916, AM, {"titlecase": True, }),
    (28665, "H.D.", 1916, 1916, AM, {"titlecase": True, }),
    (28666, "H.D.", 1921, 1921, AM, {"titlecase": True, }),
    (62456, "H.D.", 1924, 1924, AM, {"titlecase": True, }),
    (64989, "Claude McKay", 1922, 1922, AM, {}),
    (74745, "Langston Hughes", 1926, 1926, AM, {}),
    (18338, "Paul Laurence Dunbar", 1913, 1900, AM, {}),
    (17884, "James Weldon Johnson", 1917, 1917, AM, {}),
    (70543, "Countee Cullen", 1925, 1925, AM, {"titlecase": True, }),
    (109, "Edna St. Vincent Millay", 1917, 1917, AM, {"titlecase": True, }),
    (1247, "Edna St. Vincent Millay", 1921, 1921, AM, {}),
    (4399, "Edna St. Vincent Millay", 1920, 1920, AM, {"titlecase": True, }),
    (59474, "Edna St. Vincent Millay", 1923, 1923, AM, {}),
    (6682, "Elinor Wylie", 1921, 1921, AM, {"titlecase": True, }),
    (40786, "Stephen Crane", 1895, 1895, AM, {"titlecase": True, "num_split": True, }),
    (9870, "Stephen Crane", 1899, 1899, AM, {"titlecase": True, "num_split": True, }),
    (1280, "Edgar Lee Masters", 1915, 1915, AM, {"titlecase": True, "num_split": True, }),
    (1034, "Wilfred Owen", 1920, 1918, EN, {"titlecase": True, }),
    (8930, "Siegfried Sassoon", 1918, 1918, EN, {}),
    (262, "Rupert Brooke", 1915, 1914, EN, {"titlecase": True, }),
    (22423, "Edward Thomas", 1917, 1916, EN, {}),
    (22569, "Walter de la Mare", 1912, 1912, EN, {}),
    (3753, "Walter de la Mare", 1913, 1913, EN, {}),
    (136, "Robert Louis Stevenson", 1885, 1885, EN, {}),
    (1057, "Oscar Wilde", 1881, 1881, EN, {}),
    (680, "Sarojini Naidu", 1905, 1905, EN, {}),
    (397, "John Milton", 1645, 1640, EN, {}),
    (26, "John Milton", 1667, 1667, EN, {"max_lines": 1500, "num_split": True, "title": "Paradise Lost", "num_title": "Paradise Lost, {n}"}),
    (1279, "Robert Burns", 1786, 1786, EN, {"titlecase": True, }),
    (8672, "John Clare", 1920, 1830, EN, {"titlecase": True, }),
    (409, "Phillis Wheatley", 1773, 1773, AM, {"titlecase": True, }),
    (679, "Frances Ellen Watkins Harper", 1857, 1857, AM, {}),
    (3295, "Emma Lazarus", 1889, 1880, AM, {}),
    (22421, "Robert Herrick", 1648, 1648, EN, {}),
    # translations
    (1004, "Dante Alighieri", 1867, 1320, "Italian", {"max_lines": 400, "num_split": True, "translator": "Henry Wadsworth Longfellow", "num_title": "{section}, Canto {n}"}),
    (3160, "Homer", 1726, -700, "Ancient Greek", {"max_lines": 1500, "num_split": True, "translator": "Alexander Pope", "title": "The Odyssey", "num_title": "The Odyssey, {n}"}),
    (28621, "Ovid", 1807, 8, "Latin", {"max_lines": 1500, "retitle": (r"^the (\w+) book of the metamorphoses.*", r"Metamorphoses, Book \1"), "translator": "J. J. Howard", "num_title": "Metamorphoses, {n}"}),
    (20732, "Catullus", 1894, -60, "Latin", {"num_split": True, "translator": "Richard Burton and Leonard Smithers", "num_title": "Catullus {n}"}),
    (5432, "Horace", 1863, -23, "Latin", {"num_split": True, "translator": "John Conington", "num_title": "Odes, {section} {n}"}),
    (230, "Virgil", 1900, -38, "Latin", {"translator": "J. W. Mackail", "num_title": "Eclogue {n}"}),
    (57068, "Rumi", 1903, 1260, "Persian", {"titlecase": True, "num_split": True, "translator": "William Hastie"}),
    (74883, "Hafiz", 1897, 1370, "Persian", {"num_split": True, "translator": "Gertrude Bell"}),
    (246, "Omar Khayyám", 1889, 1120, "Persian", {"end": r"^Notes:\s*$", "num_split": True, "translator": "Edward FitzGerald", "title": "Rubáiyát", "whole": True}),
    (42290, "Various Chinese poets", 1918, 800, "Chinese", {"translator": "Arthur Waley"}),
    (16500, "Bai Juyi", 1919, 820, "Chinese", {"translator": "Arthur Waley"}),
    (390, "Various Chinese poets", 1909, 750, "Chinese", {"titlecase": True, "translator": "L. Cranmer-Byng"}),
    (48222, "Various Chinese poets", 1921, 750, "Chinese", {"titlecase": True, "translator": "Florence Ayscough and Amy Lowell"}),
    (37938, "Various Chinese poets", 1912, 750, "Chinese", {"translator": "Charles Budd"}),
    (36098, "Charles Baudelaire", 1909, 1857, "French", {"titlecase": True, "translator": "Cyril Scott"}),
    (8426, "Paul Verlaine", 1895, 1870, "French", {"translator": "Gertrude Hall"}),
    (29521, "Théophile Gautier", 1903, 1852, "French", {"translator": "Agnes Lee"}),
    (1287, "Johann Wolfgang von Goethe", 1853, 1790, "German", {"translator": "Edgar Alfred Bowring"}),
    (31726, "Heinrich Heine", 1881, 1830, "German", {"titlecase": True, "translator": "Emma Lazarus"}),
    (38594, "Rainer Maria Rilke", 1918, 1905, "German", {"translator": "Jessie Lemont"}),
    (17650, "Petrarch", 1859, 1350, "Italian", {"translator": "various"}),
    (19315, "Giacomo Leopardi", 1887, 1830, "Italian", {"translator": "Frederick Townsend"}),
]
ANTHOLOGIES = [(66619, "The Oxford Book of English Verse", 1900)]


def obev():
    """The Oxford Book of English Verse 1250-1900 (Quiller-Couch, 1900): poet headings in capitals with dates, poems numbered."""
    lines = pg_text(66619).split("\n")
    start = next(i for i, l in enumerate(lines) if l.strip() == "ANONYMOUS" and i > 400)
    poems, poet, dates, cur = [], None, None, None
    i = start
    while i < len(lines):
        l = lines[i]
        s = l.strip()
        if re.match(r"^[A-Z][A-Z .,'’()&-]+$", s) and i + 2 < len(lines) and (re.search(r"\d{3,4}|\?", lines[i + 2]) or s == "ANONYMOUS"):
            poet = smart_title(s).replace("Of ", "of ")
            m = re.findall(r"\d{4}", lines[i + 2])
            dates = [int(x) for x in m] if m else None
            i += 1
            continue
        m = re.match(r"^_(\d+)\._\s*(?:_(.+?)_)?\s*$", s)
        if m:
            if cur:
                poems.append(cur)
            cur = {"num": m.group(1), "title": (m.group(2) or "").strip(), "poet": poet, "dates": dates, "lines": []}
            i += 1
            continue
        if re.match(r"^_\d+\._ ", s) or re.match(r"^\s*_\d+\._\s", l):   # glossary notes
            i += 1
            continue
        if cur is not None and not re.match(r"^\s*$", l) and (s == "INDEX OF FIRST LINES" or s.startswith("INDEX")):
            break
        if cur is not None:
            cur["lines"].append(clean_line(l))
        i += 1
    if cur:
        poems.append(cur)
    out = []
    for p in poems:
        ls = p["lines"]
        while ls and not ls[0].strip():
            ls.pop(0)
        while ls and not ls[-1].strip():
            ls.pop()
        body = [l for l in ls if l.strip()]
        if len(body) < 2:
            continue
        ind = min(len(l) - len(l.lstrip()) for l in body)
        ls = [l[ind:] if l.strip() else "" for l in ls]
        # collapse runs of blank lines
        clean = []
        for l in ls:
            if l == "" and clean and clean[-1] == "":
                continue
            clean.append(l)
        d = p["dates"]
        year = (d[0] + 35 if len(d) >= 2 else d[0]) if d else None
        out.append({"title": p["title"] or first_line_title(clean), "num": p["num"], "section": "", "lines": clean, "poet": p["poet"], "year": year})
    return out


# ======================================================================
# Build
# ======================================================================
def roman_int(s):
    s = s.upper().strip(" .")
    if s.isdigit():
        return int(s)
    vals = {"I": 1, "V": 5, "X": 10, "L": 50, "C": 100}
    if not s or any(c not in vals for c in s):
        return None
    n = 0
    for i, c in enumerate(s):
        v = vals[c]
        n += -v if i + 1 < len(s) and vals[s[i + 1]] > v else v
    return n


def book_titles():
    import csv
    out = {}
    with open(os.path.join(RAW, "pg_catalog.csv"), encoding="utf-8") as f:
        for r in csv.DictReader(f):
            out[int(r["Text#"])] = re.sub(r"\s+", " ", r["Title"]).strip()
    return out


def load_colors():
    """Every color name we can map to: app colors (data/colors.js) and the name library (data/library.json)."""
    js = open(os.path.join(ROOT, "data", "colors.js"), encoding="utf-8").read()
    app = {}
    for n, h in re.findall(r'\["([^"]+)","(#[0-9A-Fa-f]{6})"\]', js):
        app[n.lower()] = (n, h.upper())
    for n, h in re.findall(r'\{n:"([^"]+)", h:"(#[0-9A-Fa-f]{6})"', js):
        app[n.lower()] = (n, h.upper())
    lib = {}
    for x in json.load(open(os.path.join(ROOT, "data", "library.json"), encoding="utf-8")):
        k = x["n"].lower()
        if k not in lib or "app" in x.get("src", []):
            lib[k] = x
    return app, lib


def norm_key(lines):
    t = " ".join(l for l in lines if l.strip())[:120].lower()
    return re.sub(r"[^a-z]", "", t)[:60]


def english_poems(titles, skip_keys=()):
    out, seen = [], set()
    for pid, poet, pub, year, trad, cfg in BOOKS:
        try:
            ps = segment(pg_text(pid), cfg)
        except Exception as e:
            print("  skip", pid, e, file=sys.stderr)
            continue
        btitle = cfg.get("title") or titles.get(pid, "")
        for k, p in enumerate(ps):
            body = [l for l in p["lines"] if l.strip()]
            key = (poet, norm_key(body))
            tkey = (poet, re.sub(r"[^a-z]", "", (p["title"] or "").lower()))
            if key in seen or norm_key(body)[:40] in skip_keys or (len(tkey[1]) > 8 and not re.match(r"^(sonnet|song|ode|hymn|lines|stanzas|epigram|fragment|madrigal|ballad|elegy|epitaph|toa|onthe)", tkey[1]) and tkey in seen):
                continue
            seen.add(key); seen.add(tkey)
            t = p["title"]
            if cfg.get("retitle"):
                t = re.sub(cfg["retitle"][0], cfg["retitle"][1], t, flags=re.I)
                t = t[:1].upper() + t[1:]
            if not t and p["num"] and cfg.get("num_title"):
                n = roman_int(re.sub(r"^(BOOK|CANTO|PART|SONNET|SONG|NO\.?)\s+", "", p["num"], flags=re.I))
                t = cfg["num_title"].format(n=n if n else p["num"], section=p["section"] or "").strip(", ")
            if not t:
                t = first_line_title(p["lines"])
            out.append({"id": f"{pid}.{k}", "book": str(pid), "title": t, "poet": poet, "year": year, "approx": year != pub, "pub": pub, "trad": trad,
                        "lang": "en", "translator": cfg.get("translator"), "source": btitle, "url": PG_PAGE.format(id=pid),
                        "section": p["section"], "lines": p["lines"]})
    # The Oxford Book of English Verse fills in the centuries the single-poet books miss
    seen_first = {(norm_key([l for l in p["lines"] if l.strip()])[:40]) for p in out}
    for k, p in enumerate(obev()):
        body = [l for l in p["lines"] if l.strip()]
        if norm_key(body)[:40] in seen_first:
            continue
        out.append({"id": f"obev.{p['num']}", "book": "obev", "title": p["title"], "poet": p["poet"] or "Anonymous", "year": p["year"], "approx": True, "pub": 1900,
                    "trad": EN, "lang": "en", "translator": None, "source": "The Oxford Book of English Verse 1250–1900, ed. Arthur Quiller-Couch",
                    "url": PG_PAGE.format(id=66619), "section": "", "lines": p["lines"]})
    return out


def greek_clean(l):
    l = re.sub(r"\{\{crit\|(?:[^{}]|\{\{[^{}]*\}\})*\}\}", "", l)
    l = re.sub(r"\{\{[σΣ]\|\d+\}\}|\{\{[^{}]*\}\}|<!--.*?-->|''+", "", l)
    l = l.lstrip(":").replace("<", "").replace(">", "")
    return re.sub(r"\s+", " ", l).strip()


def wharton_literal():
    """H. T. Wharton, Sappho (1885/1895): fragment number -> his literal prose translation (the first italic block)."""
    lines = pg_text(57390).split("\n")
    out, i = {}, 0
    while i < len(lines):
        m = re.fullmatch(r"\s*(\d{1,3})\s*", lines[i])
        if m and i + 1 < len(lines) and not lines[i + 1].strip():
            n = int(m.group(1))
            j = i + 1
            while j < len(lines) and j < i + 40 and not lines[j].lstrip().startswith("_"):
                if re.fullmatch(r"\s*\d{1,3}\s*", lines[j]):
                    break
                j += 1
            if j < len(lines) and lines[j].lstrip().startswith("_") and n not in out:
                buf = " ".join(l.strip() for l in lines[j:j + 30])
                m2 = re.match(r"_([^_]+)_", buf)
                if m2:
                    out[n] = re.sub(r"\s+", " ", m2.group(1)).strip()
        i += 1
    return out


def sappho():
    """Sappho in Greek (el.wikisource, Wharton's numbering) beside Wharton's literal prose; only fragments that name a color."""
    greek = {}
    for page in ("Επιγράμματα Σαπφούς", "Ύμνοι και Επιθαλάμια"):   # the first follows Wharton's numbers
        raw = wikisource("el", page)
        for m in re.finditer(r"===\s*(?:Απόσπασμα|Επίγραμμα)\s+(\d+)[^=]*===(.*?)(?====|\Z)", raw, re.S):
            n = int(m.group(1))
            body = re.sub(r"</?poem[^>]*>", "", m.group(2))
            ls = [greek_clean(l) for l in body.split("\n")]
            ls = [l for l in ls if l and not l.startswith("{{") and not l.startswith("[[")]
            if ls:
                greek.setdefault(n, ls)
    raw = wikisource("el", "Ύμνος προς την Αφροδίτη")
    m = re.search(r"<poem[^>]*>(.*?)</poem>", raw, re.S)
    if m:
        greek[1] = [greek_clean(l) for l in m.group(1).split("\n")]
        while greek[1] and not greek[1][-1]:
            greek[1].pop()
        while greek[1] and not greek[1][0]:
            greek[1].pop(0)
    lit = wharton_literal()
    out = []
    for n in sorted(greek):
        g = greek[n]
        if not any(find_orig(l, "el") for l in g) or n not in lit or n in (13, 16, 44, 96):   # 13, 16, 44, 96: the Greek page holds more than Wharton's fragment
            continue
        out.append({"id": f"sappho-{n}", "title": "Hymn to Aphrodite" if n == 1 else f"Fragment {n}", "poet": "Sappho", "poet_orig": "Σαπφώ",
                    "year": -600, "approx": True, "trad": "Ancient Greek", "lang": "el", "orig": g,
                    "lines": [lit[n]], "translator": "Henry Thornton Wharton (literal prose)", "source": "Sappho: Memoir, Text, Selected Renderings and a Literal Translation",
                    "pub": 1885, "url": PG_PAGE.format(id=57390), "orig_url": "https://el.wikisource.org/wiki/" + urllib.parse.quote("Επιγράμματα Σαπφούς"),
                    "dated": "c. 600 BCE · numbered as in Wharton"})
    return out


def el_book(title):
    """Numbered lines of one book of Homer from el.wikisource (Monro and Allen's Oxford text, 1920)."""
    t = ws_html("el", title)
    verse = [l.strip() for l in t.split("\n") if re.search(r"[Ͱ-Ͽἀ-῿]{3}", l)]
    nums = {}
    for i, l in enumerate(verse):
        m = re.search(r"\s(\d{1,4})$", l)
        if m:
            nums[i] = int(m.group(1))
            verse[i] = l[:m.start()].rstrip()
    out = {}
    anchors = sorted(nums)
    for i in range(len(verse)):
        a = min(anchors, key=lambda k: abs(k - i)) if anchors else None
        if a is not None:
            out[nums[a] + (i - a)] = verse[i]
    return out


# Homer: (book page, first line, last line, title, translation book, start text, end text)
HOMER = [
    ("Ιλιάς/Α", 348, 350, "Achilles by the grey sea", 3059, "with them went the woman all unwilling", "gazing across the boundless main;"),
    ("Ιλιάς/Α", 477, 483, "The ship and the dark wave", 3059, "when rosy-fingered Dawn appeared", "accomplishing her journey."),
    ("Ιλιάς/Α", 528, 530, "Zeus bows his dark brow", 3059, "Kronion spake, and bowed his dark brow", "made great Olympus quake."),
    ("Ιλιάς/Θ", 1, 3, "Saffron-robed Dawn", 3059, "Now Dawn the saffron-robed was spreading", "many-ridged Olympus"),
    ("Ιλιάς/Σ", 541, 549, "The shield: black earth of gold", 3059, "Furthermore he set in the shield a soft fresh-ploughed field", "the great marvel of the work."),
    ("Οδύσσεια/β", 1, 1, "Rosy-fingered Dawn", 1728, "Now so soon as early Dawn shone forth, the rosy-fingered", "the rosy-fingered"),
    ("Οδύσσεια/ε", 70, 73, "Calypso's meadows", 1728, "And fountains four set orderly", "violets and parsley"),
    ("Οδύσσεια/ε", 221, 224, "The wine-dark sea", 1728, "Yea, and if some god shall wreck me", "let this be added to the tale of those."),
    ("Οδύσσεια/λ", 42, 43, "Pale fear", 1728, "And these many ghosts flocked", "pale fear gat hold on me."),
]


def prose_between(pid, start, end):
    """A passage of a prose translation, from a start phrase through an end phrase."""
    t = re.sub(r"\s+", " ", pg_text(pid)).replace("_", "")
    a = t.find(start)
    if a < 0:
        raise ValueError(f"start not found in {pid}: {start}")
    b = t.find(end, a)
    if b < 0:
        raise ValueError(f"end not found in {pid}: {end}")
    s = t[a:b + len(end)].strip()
    s = re.sub(r"\[\d+\]|\*|[{}]", "", s)
    return s[:1].upper() + s[1:]


def homer():
    out, books = [], {}
    for page, a, b, title, tr, s0, s1 in HOMER:
        if page not in books:
            books[page] = el_book(page)
        lines = [books[page].get(i) for i in range(a, b + 1)]
        if any(l is None for l in lines):
            print("  homer: missing lines", page, a, b, file=sys.stderr)
            continue
        try:
            eng = [prose_between(tr, s0, s1)]
        except ValueError as e:
            print("  homer:", e, file=sys.stderr)
            continue
        book = page.split("/")[1]
        work = "Iliad" if page.startswith("Ιλ") else "Odyssey"
        out.append({"id": f"homer-{work[0].lower()}{book}-{a}", "title": title, "poet": "Homer", "poet_orig": "Ὅμηρος", "year": -700, "approx": True,
                    "trad": "Ancient Greek", "lang": "el", "orig": lines, "lines": eng,
                    "translator": "Andrew Lang, Walter Leaf and Ernest Myers" if tr == 3059 else "S. H. Butcher and Andrew Lang",
                    "source": "The Iliad of Homer" if tr == 3059 else "The Odyssey of Homer", "pub": 1883 if tr == 3059 else 1879, "url": PG_PAGE.format(id=tr),
                    "orig_url": "https://el.wikisource.org/wiki/" + urllib.parse.quote(page), "dated": f"{work}, book {book.upper()}, lines {a}–{b} · c. 700 BCE"})
    return out


def ws_lines(lang, page, start, end):
    """Lines of a Wikisource page's wikitext from the line holding `start` through the line holding `end`."""
    raw = wikisource(lang, page)
    ls = raw.split("\n")
    a = next(i for i, l in enumerate(ls) if start in l)
    b = next(i for i in range(a, len(ls)) if end in ls[i])
    out = []
    for l in ls[a:b + 1]:
        l = re.sub(r"\{\{r\|\d+\}\}|\{\{[^{}]*\}\}|<[^>]+>|''+", "", l).strip().lstrip("'").strip()
        out.append(l)
    return out


def pg_ode(pid, incipit):
    """A short poem from a Gutenberg book, starting at its first line, ending at the next numbered heading or wide gap."""
    lines = pg_text(pid).split("\n")
    a = next(i for i, l in enumerate(lines) if l.strip().startswith(incipit))
    out, blank = [], 0
    for l in lines[a:]:
        if re.fullmatch(r"\s*[IVXLC]+\.\s*", l) or (blank >= 2 and out):
            break
        if not l.strip():
            blank += 1
            continue
        if blank and out:
            out.append("")
        blank = 0
        out.append(clean_line(l))
    while out and not out[-1]:
        out.pop()
    ind = min(len(l) - len(l.lstrip()) for l in out if l)
    return [l[ind:] for l in out]


# Latin: Horace's odes (Latin from Gutenberg #9646, John Conington's 1863 verse), Virgil, Ovid
HORACE = [("Solvitur acris hiems", "SOLVITUR ACRIS HIEMS", "Odes 1.4"), ("Quis multa gracilis", "QUIS MULTA GRACILIS", "Odes 1.5"),
          ("Vides ut alta stet nive candidum", "VIDES UT ALTA", "Odes 1.9"), ("O fons Bandusiae", "O FONS BANDUSIAE", "Odes 3.13")]


def latin_poems():
    out = []
    for inc, ctitle, ref in HORACE:
        try:
            lat = pg_ode(9646, inc)
            eng = pg_poem(5432, ctitle)
        except Exception as e:
            print("  horace:", inc, e, file=sys.stderr)
            continue
        out.append({"id": "horace-" + ref.split()[-1], "title": f"{inc} ({ref})", "poet": "Horace", "poet_orig": "Quintus Horatius Flaccus", "year": -23, "approx": True,
                    "trad": "Latin", "lang": "la", "orig": lat, "lines": eng, "translator": "John Conington", "source": "The Odes and Carmen Saeculare of Horace",
                    "pub": 1863, "url": PG_PAGE.format(id=5432), "orig_url": PG_PAGE.format(id=9646), "dated": f"{ref} · published 23 BCE"})
    ecl = [("Nonne fuit satius", "alba ligustra cadunt", "Better have borne the petulant", "dark hyacinths are culled.", "Trust not too much to color (Eclogue 2.14–18)"),
           ("Huc ades, O formose puer", "cana legam", "Come hither, beauteous boy;", "hoary down,", "The Nymphs' baskets (Eclogue 2.45–51)")]
    for la0, la1, en0, en1, title in ecl:
        try:
            lat = pg_between(229, la0, la1)
            eng = pg_between(230, en0, en1)
        except Exception as e:
            print("  virgil:", e, file=sys.stderr)
            continue
        out.append({"id": "virgil-" + hashlib.md5(title.encode()).hexdigest()[:6], "title": title, "poet": "Virgil", "poet_orig": "Publius Vergilius Maro", "year": -38, "approx": True,
                    "trad": "Latin", "lang": "la", "orig": lat, "lines": eng, "translator": "unnamed (Project Gutenberg ebook #230)", "source": "The Bucolics and Eclogues",
                    "pub": None, "url": PG_PAGE.format(id=230), "orig_url": PG_PAGE.format(id=229), "dated": "Eclogues, c. 38 BCE"})
    try:
        lat = ws_lines("la", "Metamorphoses (Ovidius)/Liber IV", "ut iacuit resupinus humo", "sic facit incertam pomi color")
        eng = [prose_between(21765, "As he falls on his back", "so uncertain does the color of the fruit make her.")]
        out.append({"id": "ovid-pyramus", "title": "Pyramus and Thisbe: how the mulberry turned dark", "poet": "Ovid", "poet_orig": "Publius Ovidius Naso", "year": 8,
                    "approx": True, "trad": "Latin", "lang": "la", "orig": lat, "lines": eng, "translator": "Henry T. Riley (literal prose)", "source": "The Metamorphoses of Ovid",
                    "pub": 1851, "url": PG_PAGE.format(id=21765), "orig_url": "https://la.wikisource.org/wiki/" + urllib.parse.quote("Metamorphoses (Ovidius)/Liber IV"),
                    "dated": "Metamorphoses 4.121–132 · c. 8 CE"})
    except Exception as e:
        print("  ovid:", e, file=sys.stderr)
    return out


def ws_poem(lang, page, drop_title=True):
    """The text inside <poem> on a Wikisource page, templates and markup removed."""
    raw = wikisource(lang, page)
    blocks = re.findall(r"<poem[^>]*>(.*?)</poem>", raw, re.S)
    body = "\n\n".join(blocks)
    body = re.sub(r"\{\{SeitePR1\|[^}]*\}\}|\{\{Zeile\|\d+\}\}|\{\{Idt\}\}|\{\{r\|\d+\}\}|<ref[^>]*>.*?</ref>", "", body, flags=re.S)
    body = re.sub(r"\{\{[^{}|]*\|([^{}|]*)\}\}", r"\1", body)
    body = re.sub(r"\{\{[^{}]*\}\}|<[^>]+>", "", body)
    body = body.replace("'''", "").replace("''", "")
    lines = [l.strip() for l in body.split("\n")]
    while lines and not lines[0]:
        lines.pop(0)
    if drop_title and lines and is_caps(lines[0]):
        lines.pop(0)
    while lines and not lines[0]:
        lines.pop(0)
    while lines and not lines[-1]:
        lines.pop()
    out = []
    for l in lines:
        if l == "" and out and out[-1] == "":
            continue
        out.append(l)
    return out


def ws_rendered_poem(lang, page, first, last=None):
    """A poem from a rendered Wikisource page (for pages transcluded from scans): from the line holding `first`."""
    t = ws_html(lang, page).replace("\xa0", " ")
    a = t.find(first)
    if a < 0:
        raise ValueError("not found: " + first)
    t = t[a:]
    if last:
        b = t.find(last)
        t = t[:b + len(last)]
    out, blank = [], 0
    for l in t.split("\n"):
        l = l.strip()
        if not l or re.fullmatch(r"[—–-]?\s*\d+\s*[—–-]?", l):
            blank += 1
            continue
        if out and blank >= 3:
            out.append("")
        blank = 0
        out.append(l)
    return out


FA_DIGITS = str.maketrans("۰۱۲۳۴۵۶۷۸۹", "0123456789")


def khayyam():
    """Omar Khayyam's quatrains in Persian beside E. H. Whinfield's 1883 English, same numbering; only quatrains naming a color."""
    fa, en = {}, {}
    ranges = ["1 — 100", "101 — 200", "201 — 300", "301 — 400", "401 — 500"]
    for rg in ranges:
        fa_rg = rg.translate(str.maketrans("0123456789", "۰۱۲۳۴۵۶۷۸۹"))
        t = ws_html("fa", f"رباعیات خیام (تصحیح وینفیلد)/رباعیات {fa_rg}")
        parts = re.split(r"\n\s*([۰-۹]{1,3})\s*\n", t)
        for i in range(1, len(parts) - 1, 2):
            n = int(parts[i].translate(FA_DIGITS))
            ls = [l.strip() for l in parts[i + 1].split("\n") if re.search(r"[؀-ۿ]", l)]
            if len(ls) >= 4:
                fa[n] = ls[:4]
        t = ws_html("en", f"Quatrains of Omar Khayyam (tr. Whinfield, 1883)/Quatrains {rg.replace(' — ', '-')}")
        parts = re.split(r"\n\s*(\d{1,3})\.\s*\n", t)
        for i in range(1, len(parts) - 1, 2):
            n = int(parts[i])
            ls = [l.replace("\xa0", " ").strip() for l in parts[i + 1].split("\n") if l.strip() and re.search(r"[A-Za-z]", l) and not re.search(r"[؀-ۿ]", l)]
            ls = [l for l in ls if not l.startswith("(Persian")]
            if len(ls) >= 4:
                en[n] = [ls[0], ls[1], "    " + ls[2], ls[3]]
    out = []
    for n in sorted(fa):
        if n not in en or not any(find_orig(l, "fa") for l in fa[n]):
            continue
        out.append({"id": f"khayyam-{n}", "title": f"Quatrain {n}", "poet": "Omar Khayyám", "poet_orig": "عمر خیام", "year": 1120, "approx": True,
                    "trad": "Persian", "lang": "fa", "form": "rubai", "orig": fa[n], "lines": en[n], "translator": "Edward Henry Whinfield",
                    "source": "The Quatrains of Omar Khayyám", "pub": 1883, "url": "https://en.wikisource.org/wiki/" + urllib.parse.quote("Quatrains of Omar Khayyam (tr. Whinfield, 1883)"),
                    "orig_url": "https://fa.wikisource.org/wiki/" + urllib.parse.quote("رباعیات خیام (تصحیح وینفیلد)"),
                    "dated": "c. 1100s · numbered as in Whinfield's edition; who wrote each quatrain is often uncertain"})
    return out


def persian_poems():
    return khayyam()


RIMBAUD_PLAIN = [
    "A black, E white, I red, U green, O blue: vowels,", "someday I will tell of your hidden births:", "A, black hairy corset of dazzling flies",
    "that buzz around cruel stenches,", "", "gulfs of shadow; E, whiteness of mists and tents,", "lances of proud glaciers, white kings, shivers of cow parsley;",
    "I, purples, spat blood, the laugh of lovely lips", "in anger or in penitent drunkenness;", "", "U, cycles, divine vibrations of green seas,",
    "peace of pastures dotted with animals, peace of the wrinkles", "that alchemy prints on wide studious brows;", "",
    "O, supreme Trumpet full of strange piercing sounds,", "silences crossed by Worlds and by Angels:", "O the Omega, violet ray of His Eyes!"]


def french_poems():
    out = []
    try:
        fr = ws_rendered_poem("fr", "Œuvres (Rimbaud)/Poésies/Voyelles", "A noir, E blanc", "de Ses Yeux !")
        out.append({"id": "rimbaud-voyelles", "title": "Vowels (Voyelles)", "poet": "Arthur Rimbaud", "poet_orig": "Arthur Rimbaud", "year": 1871, "approx": True,
                    "trad": "French", "lang": "fr", "orig": fr, "lines": RIMBAUD_PLAIN, "translator": PLAIN, "source": None, "pub": None, "url": None,
                    "orig_url": "https://fr.wikisource.org/wiki/" + urllib.parse.quote("Œuvres (Rimbaud)/Poésies/Voyelles"), "dated": "written c. 1871, published 1883"})
    except Exception as e:
        print("  rimbaud:", e, file=sys.stderr)
    try:
        fr = ws_rendered_poem("fr", "Émaux et Camées/Symphonie en blanc majeur", "De leur col blanc")
        en = pg_poem(29521, "SYMPHONY IN WHITE MAJOR")
        out.append({"id": "gautier-symphonie", "title": "Symphony in White Major", "poet": "Théophile Gautier", "poet_orig": "Théophile Gautier", "year": 1849,
                    "trad": "French", "lang": "fr", "orig": fr, "lines": en, "translator": "Agnes Lee", "source": "Enamels and Cameos and Other Poems", "pub": 1903,
                    "url": PG_PAGE.format(id=29521), "orig_url": "https://fr.wikisource.org/wiki/" + urllib.parse.quote("Émaux et Camées/Symphonie en blanc majeur"),
                    "dated": "Émaux et Camées, 1852"})
    except Exception as e:
        print("  gautier:", e, file=sys.stderr)
    # Baudelaire: Les Fleurs du mal (Gutenberg #6099) beside Cyril Scott's 1909 versions
    for fr_title, en_title in [("LA CHEVELURE", "La Chevelure")]:
        try:
            fr = pg_between(6099, "O toison, moutonnant", "le vin du souvenir?")
            en = pg_poem(36098, en_title, skip=-1)
            if not any(find_orig(l, "fr") for l in fr) and not any(find_colors(l) for l in en):
                continue
            out.append({"id": "baudelaire-" + hashlib.md5(fr_title.encode()).hexdigest()[:6], "title": smart_title(fr_title), "poet": "Charles Baudelaire",
                        "poet_orig": "Charles Baudelaire", "year": 1857, "trad": "French", "lang": "fr", "orig": fr, "lines": en, "translator": "Cyril Scott",
                        "source": "The Flowers of Evil", "pub": 1909, "url": PG_PAGE.format(id=36098), "orig_url": PG_PAGE.format(id=6099), "dated": "Les Fleurs du mal, 1857–1861"})
        except Exception as e:
            print("  baudelaire:", fr_title, e, file=sys.stderr)
    return out


DANTE = [  # (Italian start, Italian end, English start, English end, title)
    ("Dolce color d’orïental zaffiro,", "velando i Pesci ch’erano in sua scorta.", "Sweet colour of the oriental sapphire,", "Veiling the Fishes that were in her escort.",
     "Sweet color of oriental sapphire (Purgatorio I.13–21)"),
    ("Io vidi già nel cominciar del giorno", "vestita di color di fiamma viva.", "Ere now have I beheld, as day began,", "Vested in colour of the living flame.",
     "Beatrice in white, green and flame (Purgatorio XXX.22–33)"),
    ("Quali colombe dal disio chiamate", "poi c’hai pietà del nostro mal perverso.", "As turtle-doves, called onward by desire,", "Since thou hast pity on our woe perverse.",
     "Through the dark air (Inferno V.82–93)"),
]


def italian_poems():
    out = []
    for i0, i1, e0, e1, title in DANTE:
        try:
            it = pg_between(1000, i0, i1)
            en = pg_between(1004, e0, e1)
        except Exception as e:
            print("  dante:", e, file=sys.stderr)
            continue
        out.append({"id": "dante-" + hashlib.md5(title.encode()).hexdigest()[:6], "title": title, "poet": "Dante Alighieri", "poet_orig": "Dante Alighieri", "year": 1315,
                    "approx": True, "trad": "Italian", "lang": "it", "orig": it, "lines": en, "translator": "Henry Wadsworth Longfellow", "source": "The Divine Comedy",
                    "pub": 1867, "url": PG_PAGE.format(id=1004), "orig_url": PG_PAGE.format(id=1000), "dated": "Divine Comedy, c. 1308–1321"})
    return out


RILKE_BLUE = [
    "Like the last green left in pots of paint", "are these leaves, dry, dull and rough,", "behind the clusters of blossom that do not carry",
    "a blue on themselves, but only mirror it from far off.", "", "They mirror it tear-stained and inexactly,", "as if they wanted to lose it again,",
    "and as in old blue writing paper", "there is yellow in them, violet and grey;", "", "washed-out, as on a child's apron,",
    "no longer worn, to which nothing happens any more:", "how one feels the shortness of a small life.", "",
    "But suddenly the blue seems to renew itself", "in one of the clusters, and one sees", "a touching blue rejoicing in front of green."]
RILKE_PINK = [
    "Who took on this pink? Who knew, too,", "that it was gathering in these clusters?", "Like gilded things that lose their gold,",
    "they gently lose their red, as if from use.", "", "That they ask nothing for such a pink.", "Does it stay for them and smile out of the air?",
    "Are angels there to receive it tenderly", "when it fades, generous as a scent?", "", "Or perhaps they give it up as well,",
    "so that it never learns of withering.", "But under this pink a green", "has been listening, which now wilts and knows it all."]


def german_poems():
    out = []
    for page, title, year, plain in [("Blaue Hortensie", "Blue Hydrangea", 1907, RILKE_BLUE), ("Rosa Hortensie", "Pink Hydrangea", 1908, RILKE_PINK)]:
        try:
            de = ws_poem("de", page)
            out.append({"id": "rilke-" + page.split()[0].lower(), "title": f"{title} ({page})", "poet": "Rainer Maria Rilke", "poet_orig": "Rainer Maria Rilke",
                        "year": year, "trad": "German", "lang": "de", "orig": de, "lines": plain, "translator": PLAIN, "source": None, "pub": None, "url": None,
                        "orig_url": "https://de.wikisource.org/wiki/" + urllib.parse.quote(page.replace(" ", "_")), "dated": f"Neue Gedichte, {year}"})
        except Exception as e:
            print("  rilke:", e, file=sys.stderr)
    try:
        de = ws_poem("de", "Kennst du das Land? wo die Citronen blühn")
        en = pg_poem(1287, "KNOW'ST thou the land where the fair citron blows,", skip=0) if False else pg_between(1287, "KNOW'ST thou the land where the fair citron blows,", "Our path lies--Father--thither, oh repair!")
        out.append({"id": "goethe-mignon", "title": "Mignon (Kennst du das Land)", "poet": "Johann Wolfgang von Goethe", "poet_orig": "Johann Wolfgang von Goethe",
                    "year": 1795, "trad": "German", "lang": "de", "orig": de, "lines": en, "translator": "Edgar Alfred Bowring", "source": "The Poems of Goethe",
                    "pub": 1853, "url": PG_PAGE.format(id=1287), "orig_url": "https://de.wikisource.org/wiki/" + urllib.parse.quote("Kennst du das Land? wo die Citronen blühn"),
                    "dated": "Wilhelm Meisters Lehrjahre, 1795–96"})
    except Exception as e:
        print("  goethe:", e, file=sys.stderr)
    return out


HAIKU = [  # (page, exact text in the source, poet, year, plain translation)
    ("野ざらし紀行", "海暮て鴨の声ほのかに白し", "Matsuo Bashō", "松尾芭蕉", 1684, ["The sea grows dark;", "the voices of the wild ducks", "are faintly white."]),
    ("野ざらし紀行", "白げしに羽もぐ蝶のかたみ哉", "Matsuo Bashō", "松尾芭蕉", 1685, ["To the white poppy", "the butterfly tears off a wing", "as a keepsake."]),
    ("おくのほそ道", "石山の石より白{{変体仮名2|志|し}}秋の風", "Matsuo Bashō", "松尾芭蕉", 1689, ["Whiter than the stones", "of Stone Mountain:", "the autumn wind."]),
    ("おくのほそ道", "あか{{く}}と日はつれなくも秋の風", "Matsuo Bashō", "松尾芭蕉", 1689, ["Red, red,", "the sun beats down without pity;", "and yet, the autumn wind."]),
    ("おくのほそ道", "あらたふと靑葉若葉の日の光", "Matsuo Bashō", "松尾芭蕉", 1689, ["How awesome:", "on the green leaves, the young leaves,", "the light of the sun."]),
    ("おくのほそ道", "卯花に兼房みゆる白毛哉", "Kawai Sora", "河合曾良", 1689, ["In the white deutzia flowers", "I see Kanefusa's", "white hair."]),
]


def haiku():
    out = []
    for page, text, poet, poet_ja, year, plain in HAIKU:
        raw = wikisource("ja", page)
        if text not in raw:
            print("  haiku not found:", text, file=sys.stderr)
            continue
        shown = text.replace("{{変体仮名2|志|し}}", "し").replace("{{く}}", "〳〵")
        out.append({"id": "haiku-" + hashlib.md5(text.encode()).hexdigest()[:6], "title": shown, "poet": poet, "poet_orig": poet_ja, "year": year,
                    "trad": "Japanese", "lang": "ja", "form": "haiku", "orig": [shown], "lines": plain, "translator": PLAIN, "source": None, "pub": None, "url": None,
                    "orig_url": "https://ja.wikisource.org/wiki/" + urllib.parse.quote(page), "dated": f"{page}, {year}"})
    return out


def world_poems():
    out = []
    for fn in (hyakunin, zh_poems, sappho, homer, latin_poems, persian_poems, french_poems, italian_poems, german_poems, haiku):
        try:
            got = fn()
            for r in got:
                r.setdefault("book", "w-" + r["lang"])
            out += got
            print(f"  {fn.__name__}: {len(got)}", file=sys.stderr)
        except Exception as e:
            print(f"  {fn.__name__} failed: {e}", file=sys.stderr)
    return out


GOOD_POETS = {"William Shakespeare", "John Keats", "Percy Bysshe Shelley", "William Wordsworth", "Samuel Taylor Coleridge", "William Blake", "Emily Dickinson",
              "Walt Whitman", "Christina Rossetti", "Gerard Manley Hopkins", "W. B. Yeats", "Thomas Hardy", "Robert Frost", "John Milton", "Lord Byron",
              "Alfred, Lord Tennyson", "Robert Browning", "Edgar Allan Poe", "Sara Teasdale", "Claude McKay", "Langston Hughes", "Paul Laurence Dunbar",
              "H.D.", "Amy Lowell", "Rabindranath Tagore", "A. E. Housman", "Wilfred Owen", "Edna St. Vincent Millay", "Dante Alighieri", "Homer", "Sappho",
              "Li Bai", "Du Fu", "Wang Wei", "Bai Juyi", "Hafiz", "Rumi", "Omar Khayyám", "Charles Baudelaire", "Andrew Marvell", "George Herbert",
              "Robert Herrick", "John Donne", "Elizabeth Barrett Browning", "Dante Gabriel Rossetti", "Algernon Charles Swinburne", "Oscar Wilde", "Matsuo Bashō"}


def build():
    titles = book_titles()
    app, lib = load_colors()
    world = world_poems()
    poems = english_poems(titles, {norm_key([l for l in w["lines"] if l.strip()])[:40] for w in world})
    print("english poems:", len(poems), file=sys.stderr)
    poems = world + poems
    # ---- color table
    colors, cidx = [], {}

    def color_id(target):
        if target in cidx:
            return cidx[target]
        k = target.lower()
        if k in app:
            n, h = app[k]
            fam = (lib.get(k) or {}).get("fam")
            rec = [n, h, 1, fam or ""]
        elif k in lib:
            x = lib[k]
            rec = [x["n"], x["h"].upper(), 0, x.get("fam", ""), (x.get("app") or [None])[0]]
        else:
            raise KeyError("no color for " + target)
        cidx[target] = len(colors)
        colors.append(rec)
        return cidx[target]

    gloss_out = {}
    for p in poems:
        me = False
        p["m"] = []
        for li, line in enumerate(p["lines"]):
            for s, e, target in find_colors(line, me):
                p["m"].append([li, s, e, color_id(target)])
        if p.get("orig"):
            p["om"] = []
            for li, line in enumerate(p["orig"]):
                for s, e, key in find_orig(line, p["lang"]):
                    if key.startswith("simple:"):
                        p["om"].append([li, s, e, color_id(key[7:])])
                    else:
                        g = GLOSS[key]
                        if key not in gloss_out:
                            gloss_out[key] = {"w": g[0], "r": g[1], "note": g[2], "c": color_id(g[3]) if g[3] else None}
                        p["om"].append([li, s, e, key])
    # ---- poets, traditions
    poets = sorted({p["poet"] for p in poems})
    pidx = {n: i for i, n in enumerate(poets)}
    trads = sorted({p["trad"] for p in poems}, key=lambda t: (t != "English", t))
    tidx = {n: i for i, n in enumerate(trads)}
    # ---- shards of about 180 KB, filled book by book
    os.makedirs(OUT_DIR, exist_ok=True)
    for f in os.listdir(OUT_DIR):
        if f.endswith(".json"):
            os.remove(os.path.join(OUT_DIR, f))
    shards, cur, size = [], {}, 0
    rows = []
    for p in poems:
        rec = {"t": p["title"], "l": p["lines"], "m": p["m"]}
        for k_src, k_dst in (("translator", "tr"), ("source", "src"), ("url", "url"), ("pub", "pub"), ("section", "sec"), ("tnote", "tnote"),
                             ("orig", "o"), ("om", "om"), ("reading", "rd"), ("romaji", "ro"), ("orig_url", "ourl"), ("poet_orig", "po"), ("dated", "dated"),
                             ("onote", "onote"), ("osrc", "osrc")):
            if p.get(k_src):
                rec[k_dst] = p[k_src]
        js = json.dumps(rec, ensure_ascii=False, separators=(",", ":"))
        if size + len(js) > 180_000 and cur:
            shards.append(cur); cur, size = {}, 0
        cur[p["id"]] = rec
        size += len(js.encode("utf-8"))
        # palette: colors in order of first mention, with counts (English text; originals add theirs)
        pal, order = {}, []
        for _, _, _, c in p["m"]:
            if c not in pal:
                order.append(c); pal[c] = 0
            pal[c] += 1
        for m in p.get("om", []):
            c = m[3] if isinstance(m[3], int) else (gloss_out[m[3]]["c"])
            if c is None:
                continue
            if c not in pal:
                order.append(c); pal[c] = 0
            pal[c] += 1
        nl = sum(1 for l in p["lines"] if l.strip())
        year = p.get("year") if p.get("year") is not None else p.get("era_year")
        row = [p["id"], p["title"], pidx[p["poet"]], year, tidx[p["trad"]], ",".join(f"{c}:{pal[c]}" if pal[c] > 1 else str(c) for c in order), nl, len(shards)]
        row.append(1 if p.get("orig") else 0)
        row.append(1 if p.get("approx") or (p.get("year") is None and p.get("era_year")) else 0)
        rows.append(row)
    if cur:
        shards.append(cur)
    for i, sh in enumerate(shards):
        with open(os.path.join(OUT_DIR, f"s{i}.json"), "w", encoding="utf-8") as f:
            json.dump(sh, f, ensure_ascii=False, separators=(",", ":"))
    # ---- best lines per color
    lines_by_color = {}
    for p in poems:
        for li, s, e, c in p["m"]:
            text = p["lines"][li]
            L = len(text.strip())
            score = -abs(L - 48) / 12
            if text.strip()[:1].islower():
                score -= 1.2
            if is_caps(text):
                score -= 3
            if p["poet"] in GOOD_POETS or p["book"] == "obev":
                score += 1.5
            if p.get("orig"):
                score += 1
            if L < 18 or L > 95:
                score -= 3
            score += random.Random(p["id"] + str(li)).random() * .8
            lines_by_color.setdefault(c, []).append((score, p, li, s, e))
    best = {}
    for c, cand in lines_by_color.items():
        cand.sort(key=lambda x: -x[0])
        picked, per_poet, seen_poems = [], {}, set()
        for sc, p, li, s, e in cand:
            if p["id"] in seen_poems or per_poet.get(p["poet"], 0) >= 2:
                continue
            per_poet[p["poet"]] = per_poet.get(p["poet"], 0) + 1
            seen_poems.add(p["id"])
            picked.append([p["id"], li, p["lines"][li].strip(), s - (len(p["lines"][li]) - len(p["lines"][li].lstrip())), e - (len(p["lines"][li]) - len(p["lines"][li].lstrip()))] if len(picked) < 8 else [p["id"], li])
            if len(picked) >= 40:
                break
        best[c] = picked
    index = {"v": 1, "colors": colors, "poets": poets, "trads": trads, "gloss": gloss_out,
             "cols": ["id", "title", "poet", "year", "trad", "palette", "lines", "shard", "orig", "approx"], "poems": rows,
             "best": {str(c): v for c, v in best.items()}}
    with open(os.path.join(ROOT, "data", "poems-index.json"), "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, separators=(",", ":"))
    total_m = sum(len(p["m"]) + len(p.get("om", [])) for p in poems)
    print(f"poems {len(poems)}, poets {len(poets)}, traditions {len(trads)}, color mentions {total_m}, shards {len(shards)}", file=sys.stderr)
    print("index bytes", os.path.getsize(os.path.join(ROOT, "data", "poems-index.json")), file=sys.stderr)
    return poems


def sample(n=30, seed=7):
    """Random color mentions for a precision check."""
    rnd = random.Random(seed)
    idx = json.load(open(os.path.join(ROOT, "data", "poems-index.json"), encoding="utf-8"))
    shards = {}
    picks = []
    rows = [r for r in idx["poems"] if r[5]]
    while len(picks) < n:
        r = rnd.choice(rows)
        sh = shards.get(r[7]) or json.load(open(os.path.join(OUT_DIR, f"s{r[7]}.json"), encoding="utf-8"))
        shards[r[7]] = sh
        p = sh[r[0]]
        if not p["m"]:
            continue
        li, s, e, c = rnd.choice(p["m"])
        line = p["l"][li]
        picks.append((r[0], idx["poets"][r[2]], line[:s] + "[" + line[s:e] + "]" + line[e:], idx["colors"][c][0]))
    for x in picks:
        print(f"{x[0]:>10}  {x[1][:22]:22}  {x[3]:12}  {x[2].strip()}")


def fetch():
    for b in BOOKS:
        pg_text(b[0])
    pg_text(66619)
    world_poems()


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "build"
    if cmd == "fetch":
        fetch()
    elif cmd == "build":
        build()
    elif cmd == "sample":
        sample(int(sys.argv[2]) if len(sys.argv) > 2 else 30, int(sys.argv[3]) if len(sys.argv) > 3 else 7)
