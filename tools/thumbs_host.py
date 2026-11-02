#!/usr/bin/env python3
"""Self-host feed-size copies of the most beautiful Commons paintings on Cloudflare R2 (David, 2026-10-26: Wikimedia thumbnails take
300-900 ms each because Special:FilePath?width=400 redirects twice and renders the size on demand; 86% of the archive is Commons).

  python3 tools/thumbs_host.py --top 30000        # fetch 500 px copies, re-encode to WebP, upload to r2://chromatlas-data/thumb/<index>.webp
  python3 tools/thumbs_host.py --top 30000 --dry  # only list how many would be fetched
  python3 tools/thumbs_host.py --bitset           # rewrite data/gallery/hosted.bin from what is already on disk (then run tools/r2_sync.py)

Which paintings: the top N by data/gallery/aesthetic.bin among Commons rows that are not hidden (data/gallery/hidden.json). The
app (js/todayfeed.js tfThumb) uses the copy when its bit in data/gallery/hosted.bin is set and falls back to the Commons URL otherwise.
Polite to Wikimedia: one identified client (User-Agent with contact), 4 downloads at a time, the batch API (50 titles per call), 429/5xx
back off and honor Retry-After. Resumable: research/_raw/thumbs/<index>.webp that exist are skipped (and uploaded if not yet, see uploaded.json).
Public domain images only (the archive's Commons rows are PD / CC0 data); credit lines stay on the painting pages as before.
"""
import json, os, sys, time, threading, urllib.parse, urllib.request, urllib.error, io
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
import r2_sync  # noqa: E402

OUT = ROOT / "research" / "_raw" / "thumbs"
UP = OUT / "uploaded.json"
UA = "ChromatlasThumbs/1.0 (https://chromatlas.app; dmekibel@gmail.com) python-urllib"
WIDTH = 500   # a standard Commons thumbnail width: usually already rendered and cached on their side
API = "https://commons.wikimedia.org/w/api.php"


def rows():
    ids = [l for l in (ROOT / "data/gallery/ids.txt").read_text().splitlines() if l]
    out = {}
    for f in sorted((ROOT / "data/gallery/d").glob("*.json")):
        k = int(f.stem)
        for j, r in enumerate(json.load(open(f))):
            out[k * 100 + j] = r
    return ids, out


def pick(top):
    ids, rs = rows(); n = len(ids)
    aes = (ROOT / "data/gallery/aesthetic.bin").read_bytes()
    hid = set(json.load(open(ROOT / "data/gallery/hidden.json"))["idx"])
    cand = []
    for i in range(n):
        r = rs.get(i)
        if not r or i in hid: continue
        u = r[5] or ""
        if "commons.wikimedia.org/wiki/Special:FilePath/" not in u: continue
        cand.append((aes[i], i))
    cand.sort(reverse=True)
    sel = [i for _, i in cand[:top]]
    return n, rs, sel


def fname(url):
    return urllib.parse.unquote(url.split("Special:FilePath/", 1)[1].split("?", 1)[0])


def get(url, tries=6):
    for t in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=60) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503, 504):
                time.sleep(min(60, float(e.headers.get("Retry-After") or 2 ** t * 2))); continue
            return None
        except Exception:
            time.sleep(2 ** t)
    return None


def thumb_urls(names):
    q = {"action": "query", "prop": "imageinfo", "iiprop": "url", "iiurlwidth": WIDTH, "format": "json", "titles": "|".join("File:" + n for n in names)}
    data = get(API + "?" + urllib.parse.urlencode(q))
    if not data: return {}
    j = json.loads(data); out = {}
    norm = {x["from"]: x["to"] for x in j.get("query", {}).get("normalized", [])}
    byt = {}
    for p in j.get("query", {}).get("pages", {}).values():
        ii = (p.get("imageinfo") or [None])[0]
        if ii: byt[p["title"]] = ii.get("thumburl") or ii.get("url")
    for n in names:
        t = "File:" + n; t = norm.get(t, t)
        if byt.get(t): out[n] = byt[t]
    return out


def encode(raw):
    from PIL import Image
    im = Image.open(io.BytesIO(raw)); im.load()
    if im.mode not in ("RGB", "L"): im = im.convert("RGB")
    if im.width > WIDTH: im = im.resize((WIDTH, round(im.height * WIDTH / im.width)), Image.LANCZOS)
    b = io.BytesIO(); im.save(b, "WEBP", quality=72, method=5); return b.getvalue()


def bitset(n):
    have = bytearray((n + 7) // 8)
    for f in OUT.glob("*.webp"):
        i = int(f.stem)
        if i < n: have[i >> 3] |= 1 << (i & 7)
    return bytes(have)


def main():
    a = sys.argv
    if "--bitset" in a:
        n = len([l for l in (ROOT / "data/gallery/ids.txt").read_text().splitlines() if l])
        b = bitset(n); (ROOT / "data/gallery/hosted.bin").write_bytes(b); print("hosted.bin:", sum(bin(x).count("1") for x in b), "of", n); return
    top = int(a[a.index("--top") + 1]) if "--top" in a else 30000
    n, rs, sel = pick(top)
    OUT.mkdir(parents=True, exist_ok=True)
    done = json.loads(UP.read_text()) if UP.exists() else {}
    todo = [i for i in sel if not (OUT / f"{i}.webp").exists()]
    print(f"{len(sel)} chosen, {len(todo)} to fetch, {sum(1 for i in sel if str(i) not in done and (OUT / f'{i}.webp').exists())} fetched but not uploaded")
    if "--dry" in a: return
    key_id, secret = r2_sync.creds()
    lock = threading.Lock(); cnt = [0, 0]
    def upload(i):
        if str(i) in done: return
        body = (OUT / f"{i}.webp").read_bytes()
        r2_sync.put(key_id, secret, f"thumb/{i}.webp", body, "image/webp")
        with lock:
            done[str(i)] = 1
            if len(done) % 200 == 0: UP.write_text(json.dumps(done))
    def grab(i, url):
        raw = get(url)
        if not raw: cnt[1] += 1; return
        try: (OUT / f"{i}.webp").write_bytes(encode(raw))
        except Exception: cnt[1] += 1; return
        upload(i); cnt[0] += 1
        if cnt[0] % 250 == 0: print(f"  {cnt[0]}/{len(todo)} fetched ({cnt[1]} failed)", flush=True)
    # fetched earlier but never uploaded
    for i in sel:
        if (OUT / f"{i}.webp").exists(): upload(i)
    with ThreadPoolExecutor(4) as ex:
        for s in range(0, len(todo), 50):
            batch = todo[s:s + 50]; names = {i: fname(rs[i][5]) for i in batch}
            urls = thumb_urls(list(set(names.values())))
            for i in batch:
                u = urls.get(names[i])
                if u: ex.submit(grab, i, u)
                else: cnt[1] += 1
            time.sleep(1.0)   # one API call a second
    UP.write_text(json.dumps(done))
    print(f"done: {cnt[0]} new, {cnt[1]} failed; run: python3 tools/thumbs_host.py --bitset && python3 tools/r2_sync.py")


if __name__ == "__main__":
    main()
