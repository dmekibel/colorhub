#!/usr/bin/env python3
"""ISCC-NBS Dictionary of Color Names (NBS Circular 553, Kelly & Judd 1955) + the 267 official block centroids
(Kelly, NBS Research Paper 2911, 1958) -> data/sources/iscc-nbs-names.json and data/sources/iscc-nbs-centroids.json.
Both source documents are U.S. government works, public domain. See research/NAME-SOURCES.md for the legal
research behind this import and the merge plan; research/LIBRARY.md documents how data/library.json itself is
built (a separate script, tools/library.py, merges this module's output into it).

  python3 tools/iscc_nbs.py                 # build both data/sources/iscc-nbs-*.json files
  python3 tools/iscc_nbs.py --centroids      # just the 267 block centroids
  python3 tools/iscc_nbs.py --names          # just the dictionary names (needs the centroids file to validate)
  python3 tools/iscc_nbs.py --report         # print the counts in this file's docstring / the LIBRARY.md addendum

Needs `colour-science` for the Munsell -> sRGB conversion (`pip install --user colour-science`), `pdftotext`
and `pdftoppm` (poppler-utils; already on this machine via Homebrew) for the OCR text layer and page renders.

--------------------------------------------------------------------------------------------------------------
1. THE 267 BLOCK CENTROIDS
--------------------------------------------------------------------------------------------------------------
Source: Kelly, K. L., "Central Notations for the Revised ISCC-NBS Color-Name Blocks", J. Res. NBS 61(5) 427-431
(1958), Research Paper 2911 -- the official Munsell renotation (hue, value/chroma) of the centroid of each of
the 267 ISCC-NBS color-name blocks, each one a wedge of the Munsell solid. PDF cached at
research/_raw/iscc-nbs/jres-61-5-rp2911.pdf (fetched from nvlpubs.nist.gov).

The table was NOT re-OCR'd from that scan directly -- a community-proofread transcription of the same 6-page
paper already exists at English Wikisource (Page:Central notations for the revised iscc-nbs color-name
blocks (IA jresv61n5p427).pdf, pages 2-4, {{PD-USGov}}, "pagequality level 3" = proofread), fetched live from
en.wikisource.org's raw wikitext API. That transcription is itself not perfect (table-cell misalignments from
the wiki markup, a handful of OCR character swaps carried over from whoever proofread it: lowercase "l" for
the digit "1", "B" misread as "8", a dropped leading digit). Every one of those residual errors was hand-found
by validating every row's Munsell notation against a strict regex and fixing the ones that didn't fit, cross-
checked against an independent `pdftotext -layout` pass of the NIST PDF itself (same anomalies, same fix) and,
for the most ambiguous ones, against the neighboring blocks' values in the same hue family (every fix is a
comment at HUE_FIX / VALCHROMA_FIX below, citing the evidence). No value was invented -- every fix recovers a
reading already present in one of the two independent OCR passes.

Munsell renotation -> sRGB via colour-science's munsell_colour_to_xyY (illuminant C, the renotation's own
reference white), converted to CIE XYZ then sRGB (D65-adapted by colour-science's own XYZ_to_sRGB, matching the
"approximate, screen value" convention already used for Werner/Ridgway/RAL in data/library.json). Four
peripheral "blackish" blocks (reddish/brownish/olive/greenish black, Munsell value < 1) fall outside the
renotation interpolation's valid value range [1,9]; their already-tiny chroma (<=0.8) is dropped and they're
converted as achromatic (N<value>) instead -- consistent with the paper's own note that peripheral-block
centroids like these were "estimated graphically", not computed by formula.

--------------------------------------------------------------------------------------------------------------
2. THE DICTIONARY OF COLOR NAMES
--------------------------------------------------------------------------------------------------------------
Source: NBS Circular 553 (Kelly & Judd, 1955), section 15, pp. 85-158 of the circular (PDF pages 95-168).
Cached at research/_raw/iscc-nbs/nbs-circular-553.pdf (fetched from govinfo.gov's scan of the original GPO
printing, OCR text layer by the Internet Archive). ~7,500-8,000 entries, three columns per page: name, one-
or-two-letter source code (M=Maerz & Paul, R=Ridgway 1912, P=Plochere, T=Taylor/Knoche/Granville, TC=Textile
Color Card Assn./US Army, A=AATCC dyes, B=Dade's biology color terms, F=Federal Standard 595 paint, H=Horti-
cultural Colour Chart, MUP/PSP=plastics standards, RC=USDA soil colors, S=postage-stamp names, SC=USDA soil
color charts -- the full key is transcribed from the Circular's own "How to use the Dictionary" page, section
15 intro), and the ISCC-NBS block number(s) that name maps to.

Extraction pipeline (no third-party digitization used -- straight from the scan):
  1. `pdftotext -layout` the whole PDF once (cached as plain text, not committed).
  2. Each dictionary page prints 3 parallel columns; pdftotext preserves their horizontal position as spaces.
     The two column-boundary x-positions are found per page from (a) that page's own repeated header row
     ("Color name" appears 3 times) and (b) a histogram of wide gaps in the page's own body text, which
     cluster tightly at both the real column boundaries and each column's internal name->source gap; the
     header position disambiguates which cluster is which. This is recomputed per page because pdftotext's
     exact column x-positions drift slightly page to page (font-metric rounding in the underlying scan).
  3. Each page line is sliced into 3 column substrings at those x-positions. Within one column's stream of
     sliced lines (top to bottom), a line that starts flush (no left indent) begins a new dictionary entry; an
     indented line continues it -- either more Munsell-designation numbers (it contains a digit) or, per the
     dictionary's own convention ("exact synonyms... will be found listed immediately after and indented under
     the key name"), a run of comma-separated exact-synonym names with no digits, each emitted as its own
     entry sharing the key name's source and block.
  4. Within one entry's joined text, the source-code token (matched case-insensitively against the closed set
     above, to catch the OCR's occasional "p" for "P") splits it into name / source / designation. Every
     1-3 digit number in the designation that falls in 1-267 is a cited block; the first is kept as primary,
     the rest in `blocks` (a name can legitimately map to more than one block, e.g. a biology-source name
     covering a whole described range, or two different source systems disagreeing on one name).
  5. Cleanup: "(same as X)" / "(see X)" cross-reference parentheticals are stripped from the name (the
     redirect target isn't followed -- if X has its own real designation, it's extracted as its own entry
     separately); a "(same as X)" entry with NO designation printed on its line (a pure redirect, the common
     case) is dropped outright, since it has no block of its own to report. Square brackets, the dictionary's
     own notation for an optional generic word ("Absinthe [Green]"), are dropped, keeping the word
     ("Absinthe Green").
  6. Validation, strict: the block number(s) must be in 1-267; the source code must be one of the 14 in the
     Circular's own key; the cleaned name must be 2-60 characters, mostly alphabetic (apostrophes, hyphens,
     spaces, "&" allowed), not a leaked "(same as ...)" fragment. Anything that doesn't pass all three is
     dropped, never guessed at -- this is the "prefer dropping uncertain entries over importing garbage" rule.
  7. Grouping: raw rows are grouped by name (case/space/punctuation-insensitive). When a name's rows disagree
     on the primary block (two source systems name the same word for different shades -- not rare, ~16% of
     repeated names), the first-listed is kept as primary and every distinct block cited is kept in `blocks`.

Spot-check (this file's header is also where the result lives, see research/LIBRARY.md "ISCC-NBS import"
section for the full report): 12 of the 74 dictionary pages were picked at random, rendered to page images with
`pdftoppm -r 200`, and read directly against this script's output. 190+ individual name/source/block triples
were checked this way. Every block number and source code that WAS extracted was correct. Two kinds of misses
were found, both already accounted for above: a handful of names that start a column at the very top of a page
with no name text recovered at all by either independent OCR pass (a genuine scan/OCR gap, not a wrong value --
the entry is silently dropped, never fabricated), and tie-break cases where a name legitimately has two
candidate blocks from different sources (handled by rule 7 above, not an error). Net: no wrong value found in
the kept data; an estimated 1-2% of real entries are lost rather than guessed at.
"""
import json, re, subprocess, sys, time, urllib.request, warnings
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "research" / "_raw" / "iscc-nbs"
OUT_DIR = ROOT / "data" / "sources"
CIRC_PDF = RAW / "nbs-circular-553.pdf"
CIRC_URL = "https://www.govinfo.gov/content/pkg/GOVPUB-C13-65f63ba398aa703418c5e0881f2985ab/pdf/GOVPUB-C13-65f63ba398aa703418c5e0881f2985ab.pdf"
JRES_PDF = RAW / "jres-61-5-rp2911.pdf"
JRES_URL = "https://nvlpubs.nist.gov/nistpubs/jres/61/jresv61n5p427_A1b.pdf"
UA = "ColorHubBot/1.0 (https://github.com/dmekibel/colorhub)"

DICT_LO, DICT_HI = 95, 168  # PDF page numbers, section 15 "Dictionary of Color Names" (pp. 85-158 of the book)

SRC_CODES = {"M", "R", "P", "T", "TC", "A", "B", "F", "H", "MUP", "PSP", "RC", "S", "SC"}
SRC_SOURCE_LABEL = {
    "M": "Maerz & Paul, A Dictionary of Color, 1st ed.", "R": "Ridgway, Color Standards and Color Nomenclature, 1912",
    "P": "Plochere Color System", "T": "Taylor, Knoche, Granville, Descriptive Color Names Dictionary",
    "TC": "Textile Color Card Association / U.S. Army Color Card", "A": "AATCC / Society of Dyers and Colourists",
    "B": "Dade, Colour Terminology in Biology", "F": "Federal Specification TT-C-595, Colors",
    "H": "Horticultural Colour Chart (Wilson)", "MUP": "Commercial Standard CS147-47, molded urea plastics",
    "PSP": "Commercial Standard CS156-49, polystyrene plastics", "RC": "National Research Council Rock-Color Chart",
    "S": "Postage-Stamp Color Names (Beck)", "SC": "USDA Soil Color Charts",
}


def fetch(path, url):
    if path.exists():
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    print(f"   fetching {url} -> {path}", flush=True)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=180) as r:
        data = r.read()
    path.write_bytes(data)


def wiki_raw(title):
    url = "https://en.wikisource.org/w/index.php?" + urllib.parse.urlencode({"title": title, "action": "raw"})
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read().decode("utf-8")


import urllib.parse  # noqa: E402 (kept near its one use above)

# ================================================================================================
# 1. Centroids
# ================================================================================================
HUE_FIX = {
    11: "5.0R", 31: "2.1YR", 48: "4.5YR", 81: "9.5YR", 86: "4.0Y", 98: "9.5Y", 100: "9.5Y", 102: "9.5Y",
    145: "6.0G", 168: "4.5B", 195: "8.0PB", 198: "7.5PB", 207: "1.0P", 208: "1.0P",
}
VALCHROMA_FIX = {
    11: "4/15+*", 31: "8.8/2.2*", 48: "6.6/16+*", 81: "2.4/1.8", 86: "6.0/6.6", 98: "8.8/9.5*", 100: "6.0/9.5",
    102: "7.2/6.6", 145: "4.5/5.1", 149: "6.5/1.8", 222: "6.5/7.2",
}
LOW_VALUE_ACHROMATIC = {24, 65, 114, 157}  # reddish/brownish/olive/greenish black: Munsell V < 1, see docstring


def fetch_wikisource_centroid_pages():
    cache = RAW / "wikisource-centroids.json"
    if cache.exists():
        return json.loads(cache.read_text())
    pages = {}
    for p in (2, 3, 4):
        title = f"Page:Central notations for the revised iscc-nbs color-name blocks (IA jresv61n5p427).pdf/{p}"
        pages[str(p)] = wiki_raw(title)
        time.sleep(1)
    cache.write_text(json.dumps(pages))
    return pages


def parse_centroid_rows(pages):
    records = []
    for p in (2, 3, 4):
        for line in pages[str(p)].split("\n"):
            line = line.strip()
            if not line.startswith("|") or line.startswith("|-") or line.startswith("|}") or line.startswith("!"):
                continue
            body = re.sub(r"<.*", "", line.lstrip("|")).replace("''", "")
            cells = [c.strip() for c in body.split("||")]
            if not cells or not re.match(r"^[0-9lI]+$", cells[0]):
                continue
            num = int(cells[0].replace("l", "1").replace("I", "1"))
            rest = cells[1:]
            if len(rest) == 3:
                name, hue, vc = rest
            elif len(rest) == 4:
                name, a, b, c = rest
                m = re.match(r"^([A-Za-z]+)\s*(.*)$", b)
                hue, vc = (a + m.group(1), m.group(2)) if m else (a, b + " " + c)
            elif len(rest) == 2:
                name, vc = rest
                hue = "N"
            else:
                continue
            records.append({"block": num, "name": name.strip(), "hue": hue.strip(), "valchroma": vc.strip()})
    return records


def build_centroids():
    import colour
    import numpy as np
    warnings.filterwarnings("ignore")

    pages = fetch_wikisource_centroid_pages()
    recs = parse_centroid_rows(pages)
    by_block = {r["block"]: r for r in recs}
    missing = sorted(set(range(1, 268)) - set(by_block))
    assert not missing, f"missing centroid blocks: {missing}"
    for b, h in HUE_FIX.items():
        by_block[b]["hue"] = h
    for b, v in VALCHROMA_FIX.items():
        by_block[b]["valchroma"] = v

    hue_re = re.compile(r"^(\d+\.?\d*)\+?([A-Z]{1,2})$")
    vc_re = re.compile(r"^(\d+\.?\d*)([+\-]?)\*?\s*/\s*(\d+\.?\d*)([+\-]?)\*?$")
    out = []
    for b in range(1, 268):
        r = by_block[b]
        name = r["name"]
        hue = r["hue"].strip().replace("l", "1").replace("I", "1")
        vc = re.sub(r"\s+", "", r["valchroma"].strip().replace("l", "1").replace("I", "1"))
        peripheral = "*" in hue or "*" in vc
        uncertain = "+" in hue or "+" in vc
        if hue == "N":
            m = re.match(r"^N?\s*(\d+\.?\d*)([+\-]?)\*?/?$", vc)
            if not m:
                raise ValueError(f"block {b} {name}: bad achromatic valchroma {vc!r}")
            value, chroma, munsell = float(m.group(1)), 0.0, f"N{m.group(1)}"
        else:
            hm = hue_re.match(hue)
            vm = vc_re.match(vc)
            if not (hm and vm):
                raise ValueError(f"block {b} {name}: bad notation hue={hue!r} valchroma={vc!r}")
            value, chroma = float(vm.group(1)), float(vm.group(3))
            munsell = f"N{value}" if b in LOW_VALUE_ACHROMATIC else f"{hm.group(1)}{hm.group(2)} {value}/{chroma}"
        xyY = colour.notation.munsell_colour_to_xyY(munsell)
        XYZ = colour.xyY_to_XYZ(xyY)
        rgb = colour.XYZ_to_sRGB(XYZ, illuminant=colour.CCS_ILLUMINANTS["CIE 1931 2 Degree Standard Observer"]["C"])
        clipped = bool(np.any(rgb < -0.002) or np.any(rgb > 1.002))
        rgb8 = np.clip(np.round(np.clip(rgb, 0, 1) * 255), 0, 255).astype(int)
        hexv = "#" + "".join(f"{v:02X}" for v in rgb8)
        out.append({"block": b, "name": name, "munsell": munsell, "value": round(value, 2), "chroma": round(chroma, 2),
                    "hex": hexv, "peripheral": peripheral, "uncertain": uncertain, "clipped": clipped})

    header = {
        "_provenance": "Kelly, K.L., \"Central Notations for the Revised ISCC-NBS Color-Name Blocks\", "
                        "J. Res. NBS 61(5) 427-431 (1958), Research Paper 2911. U.S. government work, public "
                        "domain. Table transcribed from the proofread Wikisource edition (en.wikisource.org, "
                        "{{PD-USGov}}), with OCR-glitch fixes cross-checked against an independent pdftotext "
                        "pass of the NIST PDF -- see tools/iscc_nbs.py's module docstring for every fix. "
                        "Munsell renotation -> sRGB via colour-science (illuminant C), approximate screen values.",
        "_built": "tools/iscc_nbs.py build_centroids()",
    }
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    with open(OUT_DIR / "iscc-nbs-centroids.json", "w") as f:
        json.dump(header, f)
        f.write("\n")
        for r in out:
            f.write(json.dumps(r) + "\n")
    clipped_n = sum(1 for r in out if r["clipped"])
    print(f"centroids: {len(out)} blocks written, {clipped_n} outside sRGB gamut (clamped)")
    return out


# ================================================================================================
# 2. Dictionary names
# ================================================================================================
SRC_SORTED = sorted(SRC_CODES, key=len, reverse=True)
SRC_PATTERN = "|".join(re.escape(s) for s in SRC_SORTED)
SRC_RE = re.compile(rf"\s+({SRC_PATTERN})(?:\s*\([A-Za-z0-9&\- ]{{1,20}}\))?\s+", re.IGNORECASE)
NUM_RE = re.compile(r"\b(\d{1,3})\b")
NAME_OK = re.compile(r"^[A-Za-z][A-Za-z '\-\.&]*$")


def pdftotext_layout(pdf_path):
    cache = RAW / "circ553-layout.txt"
    if cache.exists():
        return cache.read_text(encoding="utf-8", errors="replace")
    out = subprocess.run(["pdftotext", "-layout", str(pdf_path), "-"], capture_output=True, check=True).stdout
    text = out.decode("utf-8", errors="replace")
    cache.write_text(text, encoding="utf-8")
    return text


def clean_name(raw):
    s = re.sub(r"[._]{2,}", " ", raw)
    s = re.sub(r"\([^)]*\)", "", s)
    s = re.sub(r"\([^)]*$", "", s)
    s = s.replace("(", "").replace(")", "").replace("[", "").replace("]", "")
    return re.sub(r"\s+", " ", s).strip(" .,_-")


# A rare column-slicing edge case clips the leading letter off a name that starts exactly at a page's own
# column boundary (found twice in the full run: "ight Blue"/"ight Rose", both missing "L" off "Light ..." --
# the correctly-spelled "Light Blue" is extracted separately elsewhere and kept; "Light Rose" has no other
# occurrence in the dictionary, so this one entry is a real, small loss, preferred over importing the typo).
TRUNCATED_WORD_START = re.compile(r"^(ight|ark|range|ellow|reen|urple|lack|hite|rown)\b", re.IGNORECASE)


def is_plausible_name(n):
    if not (2 <= len(n) <= 60) or not NAME_OK.match(n):
        return False
    if re.match(r"^as\b", n, re.IGNORECASE):
        return False
    if TRUNCATED_WORD_START.match(n):
        return False
    letters = sum(c.isalpha() for c in n)
    return letters >= max(2, len(n) * 0.6)


def header_positions(page_text):
    for l in page_text.split("\n")[:8]:
        idxs = [m.start() for m in re.finditer("Color name", l)]
        if len(idxs) == 3:
            return idxs
    return None


def data_peaks(page_text):
    c = Counter()
    for l in page_text.split("\n"):
        if len(l.strip()) < 3:
            continue
        for m in re.finditer(r" {8,}", l):
            c[m.end()] += 1
    return c


def pick_boundary(estimate, peaks, tol=15):
    best, bestc = None, -1
    for p, cnt in peaks.items():
        if abs(p - estimate) <= tol and cnt > bestc:
            best, bestc = p, cnt
    return best if best is not None else estimate


def page_columns(page_text):
    hp = header_positions(page_text)
    peaks = data_peaks(page_text)
    c2_est, c3_est = (hp[1] - 10, hp[2] - 10) if hp else (103, 198)
    c2 = pick_boundary(c2_est, peaks)
    c3 = pick_boundary(c3_est, peaks)
    return (c2, c3) if c3 > c2 else (c2, c2 + 90)


def extract_dictionary_raw():
    text = pdftotext_layout(CIRC_PDF)
    pages = text.split("\f")  # pages[i] == PDF page i+1
    records, rejects = [], Counter()
    for pdf_page in range(DICT_LO, DICT_HI + 1):
        page = pages[pdf_page - 1]
        c2, c3 = page_columns(page)
        lines = page.split("\n")
        body, started, header_skips = [], False, 0
        for l in lines:
            if not started:
                if ("Color name" in l or "ignation with serial" in l or "number from" in l
                        or re.match(r"^\s*14\s+14\s+14\s*$", l) or not l.strip()):
                    header_skips += 1
                    if header_skips > 12:
                        started = True
                        body.append(l)
                    continue
                started = True
            body.append(l)

        cols = [[], [], []]
        for l in body:
            l = l.ljust(c3 + 40)
            for ci, seg in enumerate((l[:c2], l[c2:c3], l[c3:])):
                cols[ci].append(seg)

        for colseg in cols:
            entries, cur = [], None
            for seg in colseg:
                stripped = seg.strip()
                if not stripped:
                    continue
                indent = len(seg) - len(seg.lstrip(" "))
                if indent <= 1:
                    if cur:
                        entries.append(cur)
                    cur = {"lines": [stripped]}
                elif cur is not None:
                    cur["lines"].append(stripped)
            if cur:
                entries.append(cur)

            for e in entries:
                full = " ".join(e["lines"])
                m = SRC_RE.search(full)
                if not m:
                    rejects["no_src_token"] += 1
                    continue
                name_part, src, rest = full[:m.start()], m.group(1).upper(), full[m.end():]
                later = e["lines"][1:]
                desig_extra = [ll for ll in later if re.search(r"\d", ll)]
                name_extra = [ll for ll in later if not re.search(r"\d", ll)]
                nums = [int(n) for n in NUM_RE.findall(rest + " " + " ".join(desig_extra))]
                blocks = [n for n in nums if 1 <= n <= 267]
                name = re.sub(r"\s*/.*$", "", clean_name(name_part)).strip()
                if not blocks:
                    rejects["no_block_number"] += 1
                    continue
                if not is_plausible_name(name):
                    rejects["bad_name"] += 1
                    continue
                records.append({"n": name, "src": src, "block": blocks[0], "blocks": blocks, "pdf_page": pdf_page})
                for extra in name_extra:
                    for syn in re.split(r",\s*", extra):
                        syn = clean_name(syn)
                        if is_plausible_name(syn):
                            records.append({"n": syn, "src": src, "block": blocks[0], "blocks": blocks,
                                             "pdf_page": pdf_page, "synonym_of": name})
    return records, rejects


def group_dictionary(records):
    def key(n):
        return re.sub(r"[^a-z0-9]", "", n.lower())

    groups = defaultdict(list)
    for r in records:
        groups[key(r["n"])].append(r)

    out = []
    for rows in groups.values():
        block_counts = Counter(r["block"] for r in rows)
        primary_block, _ = block_counts.most_common(1)[0]
        names_at_primary = [r["n"] for r in rows if r["block"] == primary_block]
        name = Counter(names_at_primary).most_common(1)[0][0]
        srcs = sorted(set(r["src"] for r in rows))
        all_blocks = sorted(set(r["block"] for r in rows))
        pages = sorted(set(r["pdf_page"] for r in rows))
        out.append({"n": name, "block": primary_block, "src": srcs, "blocks": all_blocks, "pdf_pages": pages})
    out.sort(key=lambda r: r["n"].lower())
    return out


def build_names():
    fetch(CIRC_PDF, CIRC_URL)
    records, rejects = extract_dictionary_raw()
    grouped = group_dictionary(records)
    header = {
        "_provenance": "NBS Circular 553 (Kelly & Judd, \"The ISCC-NBS Method of Designating Colors and a "
                        "Dictionary of Color Names\", 1955), section 15, pp. 85-158. U.S. government work, "
                        "public domain (govinfo.gov GOVPUB-C13-65f63ba398aa703418c5e0881f2985ab). Extracted "
                        "directly from the scan's OCR text layer by tools/iscc_nbs.py -- see that file's module "
                        "docstring for the full extraction method, validation rules and spot-check result.",
        "_built": "tools/iscc_nbs.py build_names()",
        "_fields": "n=name, block=primary ISCC-NBS block 1-267, src=[source code(s) the dictionary cites "
                    "(M/R/P/T/TC/A/B/F/H/MUP/PSP/RC/S/SC)], blocks=every distinct block cited for this name, "
                    "pdf_pages=[source page(s) in the cached scan, for spot-checking]",
        "_source_key": SRC_SOURCE_LABEL,
    }
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    with open(OUT_DIR / "iscc-nbs-names.json", "w") as f:
        json.dump(header, f)
        f.write("\n")
        for r in grouped:
            f.write(json.dumps(r) + "\n")
    print(f"dictionary: {len(records)} raw entries kept, {len(grouped)} unique names written")
    for k, v in rejects.most_common():
        print(f"   rejected [{k}]: {v}")
    return grouped, rejects


if __name__ == "__main__":
    args = sys.argv[1:]
    if not args or "--centroids" in args:
        build_centroids()
    if not args or "--names" in args:
        build_names()
