#!/usr/bin/env python3
"""data/gallery/kinds.json: gallery positions of rows that are not paintings (2026-11-07: the Illustration room).

  python3 tools/kinds.py      run after tools/gallery.py (rebuild_all.sh does); positions follow data/gallery/ids.txt

A corpus row marks its kind with "kind" ("illustration"; no key = painting). Output: {"n": rows, "ids": sha1 of ids.txt,
"illustration": [gallery positions]}. The app keeps illustrations out of the painting feeds and gives them their own room.
"""
import glob, hashlib, json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
raw = (ROOT / "data/gallery/ids.txt").read_bytes()
ids = raw.decode().split("\n")
ids = [i for i in ids if i]
pos = {k: n for n, k in enumerate(ids)}
kinds = {}
for f in glob.glob(str(ROOT / "data/corpus/*.json")):
    try:
        rows = json.load(open(f, encoding="utf-8"))
    except Exception:
        continue
    for r in rows if isinstance(rows, list) else []:
        k = isinstance(r, dict) and r.get("kind")
        if k and r.get("id") in pos:
            kinds.setdefault(k, []).append(pos[r["id"]])
out = {"n": len(ids), "ids": hashlib.sha1(raw).hexdigest()[:12]}
out.update({k: sorted(v) for k, v in kinds.items()})
(ROOT / "data/gallery/kinds.json").write_text(json.dumps(out, separators=(",", ":")) + "\n")
print("kinds.json:", {k: len(v) for k, v in kinds.items()} or "no non-painting rows")
