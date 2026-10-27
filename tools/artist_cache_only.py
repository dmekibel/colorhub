#!/usr/bin/env python3
"""Warm the Commons image cache for one painter without writing anything under data/.

  python3 tools/artist_cache_only.py "Gustav Klimt" Q34661 --life 1862-1918 [--max-fetch N]

Reuses artist_extra.py's SPARQL + candidate filter + thumb URL, and C.fetch/C.img_path, but stops after the images land in
research/_raw/commons/img/. No corpus shard, palette cache, or hd-images file is written. Single worker, 1 request/second,
long backoff on repeated 429s. Run artist_extra.py afterwards (images are then cached, so it only does metadata work).
"""
import sys, io, time
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import artist_extra as A  # parses argv[1], argv[2], --life; defines nothing that writes at import
C = A.C
from PIL import Image

C.SRC["commons"].update(gap=1.0, workers=1)
LIMIT = int(sys.argv[sys.argv.index("--max-fetch") + 1]) if "--max-fetch" in sys.argv else None


def get(url):
    for k in range(4):   # C.fetch already retries 5x (10..50 s on 429); on top of that wait minutes
        try:
            return C.fetch("commons", url, binary=True)
        except RuntimeError:
            wait = 120 * (k + 1)
            print(f"   gave up once; cooling {wait}s", flush=True)
            time.sleep(wait)
    raise RuntimeError("persistent failure")


def main():
    by = A.items(A.sparql())
    cands = A.candidates(by)
    todo = [it for it in cands if not A.have_image(it["q"])]
    if LIMIT:
        todo = todo[:LIMIT]
    (C.SRC["commons"]["dir"] / "img").mkdir(parents=True, exist_ok=True)
    print(f"{A.ARTIST}: {len(by)} items, {len(cands)} candidates, {len(cands) - len(todo)} cached, {len(todo)} to fetch", flush=True)
    ok, bad, streak = 0, {}, 0
    for n, it in enumerate(todo, 1):
        try:
            im = Image.open(io.BytesIO(get(A.thumb(it["img"])))).convert("RGB")
            if im.width > C.IMG_W:
                im = im.resize((C.IMG_W, max(1, round(im.height * C.IMG_W / im.width))), Image.LANCZOS)
            im.save(C.img_path("commons", it["q"]), "JPEG", quality=92)
            ok += 1; streak = 0
        except Exception as e:
            bad[it["q"]] = str(e)[:100]; streak += 1
            if streak >= 8:
                print("8 failures in a row; stopping this painter", flush=True); break
        if n % 25 == 0:
            print(f"  {n}/{len(todo)} ok={ok} failed={len(bad)}", flush=True)
    print(f"DONE {A.ARTIST}: cached {ok}, failed {len(bad)} {list(bad.items())[:5]}", flush=True)


main()
