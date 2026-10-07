"""Helpers shared by the museum adapters: dates, attributions, nationalities."""
import json
import re
from pathlib import Path

# A qualifier that says someone else painted it: the row keeps no artist, so "Rembrandt" in the statistics means
# paintings catalogued as his. "Attributed to", "possibly" and "probably" keep the name.
NOT_BY = re.compile(r"^\s*(workshop|studio|atelier|werkplaats|circle|kring|follower|followers|navolger|school|"
                    r"manner|style|imitator|copy|copie|kopie|copyist|after|naar|in the style|pupil|leerling|entourage|"
                    r"environment|omgeving|replica|attributed to (the )?(workshop|circle|school|follower))\b", re.I)
MAYBE = re.compile(r"^\s*(attributed to|attr\.|toegeschreven aan|possibly|probably|perhaps)\s+", re.I)


def artist_name(name, qualifier=""):
    """Name as catalogued, or None when the qualifier (or a prefix inside the name) says it is not by this artist."""
    if not name:
        return None
    if qualifier and NOT_BY.match(qualifier):
        return None
    if NOT_BY.match(name):
        return None
    name = MAYBE.sub("", name).strip()
    name = re.sub(r"\s*\((?:signed|eigenhandig|attributed|toegeschreven|possibly|probably|mentioned|vermeld)[^)]*\)", "", name)
    return name.strip(" ,;") or None


CENTURYISH = re.compile(r"century|centuries|BCE|B\.C\.|\bperiod\b|dynasty|millennium|era\b", re.I)


def year_span(text, begin=None, end=None):
    """Start year and span, read the way corpus.py reads Cleveland's dates: the first year written in the date text
    ("c. 1670" -> 1670, "1655-1660" -> 1655), else the museum's begin year (centuries, periods and BCE dates).
    The span is end - begin, from the numeric fields where the museum gives them, else from the text."""
    text = text or ""
    nums = [int(n) for n in re.findall(r"(?<!\d)(\d{3,4})(?!\d)", text)]
    y = None
    if nums and not CENTURYISH.search(text):
        y = nums[0]
    if y is None:
        y = begin
    if begin is not None and end is not None:
        span = end - begin
    elif len(nums) >= 2 and not CENTURYISH.search(text):
        span = nums[-1] - nums[0] if nums[-1] >= nums[0] else None
    elif nums and not CENTURYISH.search(text):
        span = 0
    else:  # "18th century", "Edo period": kept out of decades (corpus.py reads a missing span as exact)
        span = 100 if y is not None else None
    if y is not None and begin is not None and abs(y - begin) > 100:  # a date text that is not a date ("No. 1234")
        y = begin
    return y, (span if span is None or span >= 0 else None)


def nationality_country(C, nat):
    """'Dutch' -> Netherlands, 'American, born Germany' -> United States (first part only), 'French|French' -> France."""
    if not nat:
        return None
    first = re.split(r"[|;,(]", nat)[0].strip()
    return C.country_of(first) if first else None


def jsonl_read(path):
    out = []
    p = Path(path)
    if p.exists():
        for line in p.read_text().splitlines():
            if line.strip():
                try:
                    out.append(json.loads(line))
                except json.JSONDecodeError:  # a line cut off by an interrupted run
                    pass
    return out
