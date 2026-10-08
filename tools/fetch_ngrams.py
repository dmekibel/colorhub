#!/usr/bin/env python3
"""Fetch Google Books Ngram frequency curves (1800-2019) for ColorHub's color words. Polite and resumable.

  python3 tools/fetch_ngrams.py              # fetch every missing term (about 1,300 terms, ~10 per request)
  python3 tools/fetch_ngrams.py --limit 20   # only the first N missing terms (smoke test)
  python3 tools/fetch_ngrams.py --terms      # just print the term list
  python3 tools/fetch_ngrams.py --adj        # the color SENSE: single-word terms as "<word>_ADJ" (adjective use only)

Terms = the 1,000 core names (data/core-names.json) plus their bases (the name with its modifier words and a
trailing family word dropped: "Dark Slate Grey" -> "slate grey", "grey"; "Sapphire Blue" -> "sapphire").
Uses the public JSON endpoint https://books.google.com/ngrams/json (corpus en-2019, case-insensitive, no
smoothing, 1800-2019 = 220 yearly points), batching up to 10 terms per request, one request per 2 seconds, with
back-off on HTTP 429. Every raw response is cached in research/_raw/ngrams/ (gitignored) as n1800__<term>.json;
tools/graph_build.py reads those and ships only small normalized curves. The older ci__/cs__ files in the same
folder (1900-2019, the COLOR-SELECTION.md study) are left alone.

Honesty: Ngram counts are printed books in Google's sample, not speech; a word's curve mixes every sense of the
word ("amber" the resin, the traffic light, the color). Terms with a non-letter character are skipped because the
tokenizer splits them unpredictably.
"""
import json, re, sys, time, urllib.parse, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
Y0, Y1, CORPUS = 1800, 2019, "en-2019"
BATCH, DELAY = 10, 2.0
MODS = {"light", "dark", "pale", "deep", "dusty", "bright", "vivid", "medium", "dull", "soft", "strong", "very",
        "moderate", "greyish", "grayish", "pastel", "rich", "royal", "electric", "neon", "warm", "cool", "old", "new"}
FAMILY = {"red", "blue", "green", "yellow", "orange", "purple", "pink", "brown", "grey", "gray", "violet", "white", "black"}


def raw_dir():
    for base in [ROOT] + list(ROOT.parents):
        d = base / "research" / "_raw"
        if (d / "ngrams").exists() or (d / "corpus-pool.jsonl").exists():
            return d / "ngrams"
    return ROOT / "research" / "_raw" / "ngrams"


def clean(s):
    s = s.lower().strip()
    return s if re.fullmatch(r"[a-z]+( [a-z]+){0,3}", s) else None


def terms():
    names = [e["n"] for e in json.loads((ROOT / "data" / "core-names.json").read_text(encoding="utf-8"))]
    out = []
    for n in names:
        t = n.lower().replace("-", " ")
        out.append(t)
        words = t.split()
        while len(words) > 1 and words[0] in MODS:
            words = words[1:]
        out.append(" ".join(words))
        if len(words) > 1 and words[-1] in FAMILY:
            out.append(" ".join(words[:-1]))
        if len(words) > 1:
            out.append(words[-1])
    seen, res = set(), []
    for t in out:
        t = clean(t)
        if t and t not in seen:
            seen.add(t)
            res.append(t)
        if t and t.endswith("grey") and clean(t.replace("grey", "gray")) not in seen:
            g = t.replace("grey", "gray"); seen.add(g); res.append(g)
    return res


def path_of(d, term):
    pre = "n1800adj__" if term.endswith("_ADJ") else "n1800__"
    return d / (pre + urllib.parse.quote(term, safe="") + ".json")


def fetch_batch(batch):
    q = urllib.parse.urlencode({"content": ",".join(batch), "year_start": Y0, "year_end": Y1, "corpus": CORPUS,
                                "smoothing": 0, "case_insensitive": "true"})
    for attempt in range(5):
        try:
            req = urllib.request.Request("https://books.google.com/ngrams/json?" + q,
                                         headers={"User-Agent": "ColorHub-research/1.0 (polite, cached; dmekibel@gmail.com)"})
            with urllib.request.urlopen(req, timeout=40) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception as e:  # 429 or a network blip: back off and retry
            wait = 15 * (attempt + 1)
            print(f"  ({e}; waiting {wait}s)", file=sys.stderr)
            time.sleep(wait)
    return None


def main():
    ts = terms()
    if "--adj" in sys.argv:       # the color sense: single-word terms tagged as adjectives ("amber_ADJ" is the color, not the resin)
        ts = [t + "_ADJ" for t in ts if " " not in t]
    if "--terms" in sys.argv:
        print(len(ts)); print("\n".join(ts)); return
    limit = int(sys.argv[sys.argv.index("--limit") + 1]) if "--limit" in sys.argv else None
    d = raw_dir(); d.mkdir(parents=True, exist_ok=True)
    todo = [t for t in ts if not path_of(d, t).exists()]
    if limit:
        todo = todo[:limit]
    print(f"{len(ts)} terms, {len(todo)} to fetch -> {d}")
    for i in range(0, len(todo), BATCH):
        batch = todo[i:i + BATCH]
        res = fetch_batch(batch)
        if res is None:
            print("giving up on batch", batch); continue
        got = {}
        for r in res:
            label = re.sub(r" \((All|\w+)\)$", "", r.get("ngram", "")).lower()
            label = label.replace("_adj", "_ADJ")
            got.setdefault(label, r["timeseries"])
        for t in batch:
            series = got.get(t)
            path_of(d, t).write_text(json.dumps({"term": t, "ci": True, "found": series is not None, "y0": Y0, "ts": series or []}))
        print(f"{min(i + BATCH, len(todo))}/{len(todo)}", flush=True)
        time.sleep(DELAY)


if __name__ == "__main__":
    main()
