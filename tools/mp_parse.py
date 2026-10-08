"""Parse the OCR'd lines of the Maerz & Paul (1930) INDEX OF COLOR NAMES into entries.

An index line is   [date] Name [superscript letters] [+/-] [dagger] .... (notes) plate col row
  * date   = first recorded use: 1905, or an approximate 18-- / 185- / 17--
  * name   = ALL CAPS: constant everyday use; Capitalized: current but seldom used; italic (not detectable here): obsolete
  * [Generic] in square brackets = the generic word is optional (FAWN [Brown] = Fawn and Fawn Brown)
  * (Fr. Bishop) = foreign-language name with its translation; (Golden) = the main name of a synonym group
  * (F = 22 J 8) = Funk & Wagnalls (1892) put a different color under this name, at that cell
  * (< Fr. florée, ...) = etymology; the dagger marks a name that has a note in the Notes section
  * superscripts: A animal dye/pigment, B British ready-mixed paint, C ceramics, F Funk & Wagnalls only,
    H heraldry, M American ready-mixed paint, O Oberthur 1905 only, P pigment/paint, R Ridgway only,
    T textile only, V vegetable dye/pigment
  * a name with no plate reference is an obsolete synonym (indented under its main name)
"""
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import maerz_paul as mp  # noqa: E402

IDX = mp.ROOT / "research" / "_raw" / "mp-index"
COLS = "ABCDEFGHIJKL"
SUPS = set("ABCFHMOPRTV")
LANGS = {"Fr": "French", "It": "Italian", "Ln": "Latin", "Sp": "Spanish", "Ger": "German", "Gr": "Greek",
         "Eng": "English", "Am": "American", "Eur": "European", "Dut": "Dutch", "Pers": "Persian", "Ar": "Arabic",
         "Rus": "Russian", "Port": "Portuguese", "Turk": "Turkish", "Hind": "Hindi", "Sansk": "Sanskrit",
         "Heb": "Hebrew", "Chin": "Chinese", "Jap": "Japanese"}

_DIGIT_FIX = str.maketrans({"O": "0", "o": "0", "I": "1", "l": "1", "|": "1", "S": "5", "B": "8", "Z": "2", "]": "1"})


def norm_date(s):
    """-> (year or None, approx bool, text). Handles 1905, 185-, 17--, 18--; OCR confusions in digits."""
    if not s:
        return None, False, ""
    t = s.strip().replace("—", "-").replace("–", "-").replace("=", "-")
    m = re.match(r"^(\d{1,4})(-+)?$", t)
    if not m:
        return None, False, t
    digits, dash = m.group(1), bool(m.group(2))
    if dash or len(digits) < 4:
        if len(digits) == 4 and not dash:
            pass
        elif len(digits) in (2, 3):
            lo = int(digits.ljust(4, "0"))
            hi = int((digits + "9" * 4)[:4])
            if 1100 <= lo <= 1930 or 1100 <= hi <= 1930:
                return (lo + hi) // 2 if len(digits) == 3 else lo + 50, True, f"{digits}-"
            return None, False, t
        else:
            return None, False, t
    y = int(digits)
    if 300 <= y <= 1930:
        return y, False, digits
    return None, False, t


REF_END = re.compile(r"(\d{1,2})\s*([A-L])\s*(\d{1,2})\s*[\.\)\|]*\s*$")
REF_ANY = re.compile(r"^(\d{1,2})([A-L])(\d{1,2})$")


def ref_from_text(text):
    t = text.rstrip(" .,;:|!')_-")
    m = REF_END.search(t)
    if m:
        return int(m.group(1)), m.group(2), int(m.group(3))
    # the column letter I is read as the digit 1 / l / | : "27 1 9" -> 27 I 9
    m = re.search(r"(\d{1,2})\s*[1l|]\s*(\d{1,2})\s*[\.\)\|]*\s*$", t)
    if m:
        return int(m.group(1)), "I", int(m.group(2))
    return None


def ref_from_field(field):
    f = re.sub(r"[^0-9A-L]", "", field or "")
    m = REF_ANY.match(f)
    if m:
        return int(m.group(1)), m.group(2), int(m.group(3))
    # field may carry leading junk digits, try the tail
    m = re.search(r"(\d{1,2})([A-L])(\d{1,2})$", f)
    return (int(m.group(1)), m.group(2), int(m.group(3))) if m else None


def valid_ref(r):
    return bool(r) and 1 <= r[0] <= 56 and r[1] in COLS and 1 <= r[2] <= 12


def ref_variants(r):
    """Plausible corrections for a ref whose plate number is out of range or likely mis-OCR'd (3<->8 on bold)."""
    out = []
    if not r:
        return out
    p, c, w = r
    cand_plates = {p}
    s = str(p)
    swap = {"8": "3", "3": "8", "6": "5", "5": "6", "0": "8", "1": "7"}
    for i, ch in enumerate(s):
        if ch in swap:
            cand_plates.add(int(s[:i] + swap[ch] + s[i + 1:]))
    # leading junk digit ("86F" -> "6F") or ("1L1": dropped digit unknowable)
    if len(s) == 2:
        cand_plates.add(int(s[1]))
    cand_rows = {w}
    sw = str(w)
    for i, ch in enumerate(sw):
        if ch in swap:
            cand_rows.add(int(sw[:i] + swap[ch] + sw[i + 1:]))
    for pp in cand_plates:
        for ww in cand_rows:
            v = (pp, c, ww)
            if valid_ref(v) and v != r:
                out.append(v)
    return out


SUPERS_CHARS = "™®©°*¹²³·"


def split_name(core):
    """core = text between the date and the plate reference (leader dots and all).
    -> dict(name, generic, sups, plus_minus, dagger, paren, allcaps)"""
    t = core.strip()
    # parenthetical blocks (may be unbalanced because a wrapped line was cut)
    parens = re.findall(r"\(([^()]*)\)?", t)
    t_noparen = re.sub(r"\([^()]*\)?", " ", t)
    t_noparen = re.sub(r"\.{2,}.*$", "", t_noparen)       # leader dots and anything after
    t_noparen = re.sub(r"\s\.(?:\s|$).*$", "", t_noparen)    # garbled leaders (". . :")
    t_noparen = re.sub(r"\.\s+[a-z .:;]{2,}.*$", "", t_noparen)  # "Grenadine Red to. veces"
    t_noparen = re.sub(r"\s+[.,]\s*$", "", t_noparen)
    plus_minus = ""
    m = re.search(r"([+\-—–]+)\s*$", t_noparen)
    if m:
        plus_minus = m.group(1)
        t_noparen = t_noparen[:m.start()]
    dagger = False
    m = re.search(r"\s*(?:[†‡¢¥}]|\bt\b|\bf\b|\bj\b|\|\|?|\{|\bff\b|\+t|t\+)+\s*$", t_noparen)
    # careful: a dagger OCRs as t / f / † / { ; only strip when it follows a complete word
    if m and len(t_noparen[:m.start()].strip()) >= 3:
        dagger = True
        t_noparen = t_noparen[:m.start()]
    sups = ""
    # superscript letters follow the name, often glued ("Fern™", "EVENGLOWT") or separated ("Faience T")
    t_noparen = t_noparen.rstrip(" ,;:.")
    m = re.search(r"(?:\s+|(?<=[a-z]))([A-Z]|[A-Z]{2}|™)[\s™®*+\-—]*$", t_noparen)
    base = t_noparen
    allcaps_name = bool(re.fullmatch(r"[^a-z]*[A-Z][^a-z]*", t_noparen.strip().replace(" ", ""))) if t_noparen.strip() else False
    # strip TM / R-in-circle style markers
    base = re.sub(r"[™®©°*¹²³·?\"“”]+", "", base)
    base = re.sub(r"(?<=[a-z])\s+\d[A-Z]?\s*$", "", base)
    # trailing single-letter superscripts after a lowercase letter (Faience T / FaienceT)
    mm = re.search(r"(?<=[a-z\]])\s*([A-Z])\s*$", base)
    if mm and mm.group(1) in SUPS and len(base[:mm.start()].strip()) >= 3:
        sups = mm.group(1)
        base = base[:mm.start()]
    else:
        # ALL-CAPS name with glued superscript: only T/P/V/R/M/B are ever printed this way and names rarely end in them
        mm = re.search(r"(?<=[A-Z]{3})([TPVRMB])\s*$", base.replace(" ", " "))
        if mm and re.fullmatch(r"[A-Z \-\[\]']+", base.strip()) and not base.strip().endswith(("ART", "PT")):
            sups = mm.group(1)
            base = base[:mm.start()]
    base = base.strip(" ._,;:-—+|")
    generic = ""
    mg = re.search(r"\[([^\]]*)\]?", base)
    if mg:
        generic = mg.group(1).strip()
        base = (base[:mg.start()] + base[mg.end():]).strip()
    base = re.sub(r"\s+", " ", base)
    return dict(name=base, generic=generic, sups=sups, plus_minus=plus_minus, dagger=dagger,
                paren=[p.strip() for p in parens if p.strip()], allcaps=allcaps_name)


def lines_for_leaf(leaf):
    p = IDX / f"leaf{leaf}.json"
    if not p.exists():
        return []
    return json.loads(p.read_text()).get("lines", [])


def lead_date_from_text(text):
    m = re.match(r"^\s*([\[\(\|lLI1]?[0-9OSB]{2,3}[0-9OSB—\-–=]?)\b[\s]*", text)
    return m


def parse_leaf(leaf):
    """-> list of raw entry dicts for one leaf, in reading order."""
    entries = []
    cur = None
    for ln in lines_for_leaf(leaf):
        text = (ln["text"] or "").strip()
        if not text and not ln["ref"]:
            continue
        if re.match(r"^(DICTIONARY OF COLOR|INDEX OF COLOR)", text, re.I):
            continue
        # leading date from the text (4 digits / 3 digits + dash / 2 digits + dash)
        t = text
        m = re.match(r"^\s*[\[\(|]?([1lIO][0-9OSBlI]{2,3}|[1l][0-9OSBlI]{1,2}\s*[—\-–=]+)\s*", t)
        date_txt = None
        rest = text
        if m:
            date_txt = re.sub(r"\s+", "", m.group(1)).translate(_DIGIT_FIX)
            rest = t[m.end():]
        fd = ln.get("date") or ""
        has_date = bool(date_txt) or bool(re.fullmatch(r"1\d{3}", fd))
        # decide continuation
        is_cont = False
        if not has_date and cur is not None:
            opens = cur["raw"].count("(") - cur["raw"].count(")")
            if rest.lstrip().startswith(("(", ")")) or re.match(r"^[a-z]", rest.lstrip()) or \
               (")" in rest and rest.count(")") > rest.count("(")) or \
               (opens > 0) or (not cur["has_ref_text"] and cur["raw"].rstrip().endswith("-")):
                is_cont = True
            elif cur["raw"].rstrip().endswith(("(", "-", "[")):
                is_cont = True
        if is_cont:
            cur["raw"] += " " + rest
            cur["lines"].append(ln)
            cur["field_refs"].append(ln["ref"])
            cur["confs"].append(ln["conf"])
            if ref_from_text(rest):
                cur["has_ref_text"] = True
            continue
        cur = dict(leaf=leaf, col=ln["col"], y=ln["y"], date_text=date_txt, date_field=fd, raw=rest,
                   lines=[ln], field_refs=[ln["ref"]], confs=[ln["conf"]],
                   has_ref_text=bool(ref_from_text(rest)))
        entries.append(cur)
    return entries


def finalize(e):
    """From a raw multi-line entry compute fields."""
    raw = e["raw"]
    refA = ref_from_text(raw)
    refB = None
    for f in reversed(e["field_refs"]):
        refB = ref_from_field(f)
        if refB:
            break
    core = raw
    if refA:
        core = REF_END.sub("", raw.rstrip(" .,;:|!')_-"))
    sp = split_name(core)
    # date
    y, approx, dtxt = norm_date(e["date_text"] or "")
    y2, approx2, dtxt2 = norm_date(e["date_field"] or "")
    if y is None and y2 is not None:
        y, approx, dtxt = y2, approx2, dtxt2
    elif y is not None and y2 is not None and y != y2 and not approx and not approx2:
        # two reads disagree: prefer the digits-only field read (whitelisted)
        y, approx, dtxt = y2, approx2, dtxt2
        e["date_conflict"] = True
    e.update(sp)
    e["refA"], e["refB"] = refA, refB
    e["year"], e["year_approx"], e["date_str"] = y, approx, dtxt
    e["conf_ocr"] = float(sum(e["confs"]) / max(1, len(e["confs"])))
    return e


def parse_all(first=199, last=222):
    out = []
    for leaf in range(first, last + 1):
        for e in parse_leaf(leaf):
            out.append(finalize(e))
    return out


if __name__ == "__main__":
    a, b = int(sys.argv[1]), int(sys.argv[2])
    for e in parse_all(a, b):
        print(e["leaf"], e["col"], e["year"], e["year_approx"], "|", e["name"], "|", e["generic"], "|", e["sups"], "|",
              e["dagger"], "|", e["paren"], "|", e["refA"], e["refB"], "|", e["raw"][:70])
