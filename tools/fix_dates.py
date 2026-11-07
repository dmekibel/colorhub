#!/usr/bin/env python3
"""Fill missing years on Commons rows (2026-11-07: 637 of Sargent's new Commons rows had no year).

  python3 tools/fix_dates.py            DRY RUN: counts per source
  python3 tools/fix_dates.py --write    rewrites the corpus shards that change

Order of trust: 1) the file page's own {{Artwork}}/{{Information}} date field (Commons wikitext, 50 pages a request, cached in
research/_raw/commons-dates.json); 2) a year in the title. A year counts only inside the painter's plausible span (their other
dated rows, widened by 10 years before and 5 after; else 1200-1955), never an accession number ("1933.507") or a day.month.year.
Each filled row gets "ysrc": "commons-date" or "title". Titles lose a leading "<Painter> - " and a trailing ", <year>, <accession>".
"""
import glob, json, re, sys, time, urllib.parse, urllib.request
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "research/_raw/commons-dates.json"
UA = {"User-Agent": "Chromatlas/1.0 (https://chromatlas.app; dmekibel@gmail.com) fix_dates"}
YEAR = re.compile(r"(?<![\d.\-/])(1[2-9]\d\d)(?![\d]|\.\d)")


def years_in(s, lo, hi):
    s = re.sub(r"\b\d{1,2}[./]\d{1,2}[./](1[2-9]\d\d)\b", "", str(s or ""))   # 21.9.1989: a day, not a work year
    return [int(y) for y in YEAR.findall(s) if lo <= int(y) <= hi]


def clean_title(t, painter):
    u = str(t or "")
    last = painter.split()[-1] if painter else ""
    u = re.sub(rf"^\s*({re.escape(painter)}|{re.escape(last)})\s*[-–:,]\s*", "", u, flags=re.I)
    u = re.sub(r"(,\s*(c\.\s*)?1[2-9]\d\d(\s*[-–]\s*\d{2,4})?)?(,\s*[\d.]+)?\s*$", "", u) if re.search(r",\s*[\d.]+\s*$", u) else u
    u = re.sub(r"\s*\(\d{8,}\)\s*$", "", u).strip(" ,;-")
    return u or t


def fetch_dates(pageids):
    cache = json.loads(CACHE.read_text()) if CACHE.exists() else {}
    todo = [p for p in pageids if p not in cache]
    for i in range(0, len(todo), 50):
        chunk = todo[i:i + 50]
        url = "https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode({"action": "query", "format": "json", "prop": "revisions", "rvprop": "content", "rvslots": "main", "pageids": "|".join(chunk)})
        for attempt in range(3):
            try:
                d = json.load(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60)); break
            except urllib.error.HTTPError as e:
                if e.code in (403, 429) and attempt == 2: print("BLOCKED", e.code, "- stopping, cache kept"); CACHE.write_text(json.dumps(cache)); return cache
                time.sleep(20 * (attempt + 1))
            except Exception:
                time.sleep(10)
        else:
            continue
        for pid, pg in (d.get("query", {}).get("pages", {}) or {}).items():
            try: w = pg["revisions"][0]["slots"]["main"]["*"]
            except Exception: w = ""
            m = re.search(r"^[ \t]*\|[ \t]*date[ \t]*=[ \t]*(.*)$", w, re.I | re.M)   # the whole line: {{other date|circa|1880}} keeps its year
            cache[pid] = m.group(1).strip()[:200] if m else ""
        if i % 1000 == 0: CACHE.write_text(json.dumps(cache)); print(f"  {i + len(chunk)}/{len(todo)} pages")
        time.sleep(1.0)
    CACHE.write_text(json.dumps(cache))
    return cache


def main():
    write = "--write" in sys.argv
    files = sorted(glob.glob(str(ROOT / "data/corpus/*.json")))
    data = {f: json.load(open(f, encoding="utf-8")) for f in files}
    span = defaultdict(list)
    for rows in data.values():
        for r in rows:
            if isinstance(r, dict) and isinstance(r.get("y"), int): span[r.get("a")].append(r["y"])
    def rng(a):
        ys = sorted(span.get(a, []))
        if len(ys) >= 5: return ys[len(ys) // 20] - 10, ys[-1 - len(ys) // 20] + 5
        return 1200, 1955
    need = [(f, r) for f, rows in data.items() for r in rows if isinstance(r, dict) and str(r.get("id", "")).startswith("commons-F") and r.get("y") in (None, "")]
    print(len(need), "undated Commons file rows")
    dates = fetch_dates([r["id"][len("commons-F"):] for _, r in need]) if "--no-fetch" not in sys.argv else {}
    n = defaultdict(int); changed = set()
    for f, r in need:
        lo, hi = rng(r.get("a"))
        raw = dates.get(r["id"][len("commons-F"):], "")
        y = years_in(raw, lo, hi); src = "commons-date"
        if not y: y = years_in(r.get("t"), lo, hi); src = "title"
        if y:
            r["y"] = y[0]; r["ysrc"] = src; n[src] += 1; changed.add(f)
        t = clean_title(r.get("t"), r.get("a") or "")
        if t != r.get("t"): r["t"] = t; n["title cleaned"] += 1; changed.add(f)
    n["still undated"] = sum(1 for _, r in need if r.get("y") in (None, ""))
    print(("WROTE " if write else "DRY RUN ") + json.dumps(n))
    if write:
        for f in changed:
            Path(f).write_text("[\n" + ",\n".join(json.dumps(x, ensure_ascii=False, separators=(",", ":")) for x in data[f]) + "\n]\n", encoding="utf-8")


if __name__ == "__main__":
    main()
