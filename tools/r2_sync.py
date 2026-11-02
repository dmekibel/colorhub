#!/usr/bin/env python3
"""Upload the app's heavy data to Cloudflare R2 (bucket chromatlas-data, served at https://data.chromatlas.app).

  python3 tools/r2_sync.py            # upload everything listed in DIRS that changed since the last sync
  python3 tools/r2_sync.py --dry      # list what would upload
  python3 tools/r2_sync.py --check    # HEAD a few objects through data.chromatlas.app

Why (2026-10-20): the git repo passed 780 MB (GitHub Pages wants under ~1 GB) and the app is to ship its core data offline
and stream the rest. R2 charges no egress; data.chromatlas.app is cached by Cloudflare's CDN.

Credentials: ~/.chromatlas-r2 (R2_KEY / R2_SECRET, an Object Read & Write token limited to this bucket; created by David,
never printed or committed). Pure-Python S3 SigV4 signing, no installs. Objects keep their repo path (data/gallery/d/001.json
-> data/gallery/d/001.json), so the app switches by prefixing one base URL (js/loader.js DATA_BASE). A manifest of
sha1 per path (research/_raw/r2-manifest.json) makes re-runs upload only what changed. Cache-Control: the app always asks for
?v=<ship tag>, and R2 ignores query strings, so files are served with a short max-age plus stale-while-revalidate.
"""
import datetime, hashlib, hmac, json, mimetypes, os, sys, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ACCOUNT = "041c8f332ceba311c523162ef6f29cef"
BUCKET = "chromatlas-data"
HOST = f"{ACCOUNT}.r2.cloudflarestorage.com"
PUBLIC = "https://data.chromatlas.app"
DIRS = ["data/gallery", "data/analysis", "data/paintmap", "data/artists", "data/facets", "data/colorindex"]
SKIP = {".progress.json"}
MANIFEST = ROOT / "research" / "_raw" / "r2-manifest.json"
CACHE = "public, max-age=300, stale-while-revalidate=86400"


def creds():
    p = Path.home() / ".chromatlas-r2"
    if not p.exists():
        sys.exit("no ~/.chromatlas-r2 (R2_KEY / R2_SECRET): create the R2 token first")
    kv = dict(line.split("=", 1) for line in p.read_text().split("\n") if "=" in line)
    return kv["R2_KEY"].strip(), kv["R2_SECRET"].strip()


def sign(key, msg):
    return hmac.new(key, msg.encode(), hashlib.sha256).digest()


def put(key_id, secret, path, body, ctype):
    t = datetime.datetime.utcnow()
    amz, day = t.strftime("%Y%m%dT%H%M%SZ"), t.strftime("%Y%m%d")
    uri = "/" + BUCKET + "/" + urllib.request.quote(path)
    ph = hashlib.sha256(body).hexdigest()
    hdrs = {"host": HOST, "x-amz-content-sha256": ph, "x-amz-date": amz, "content-type": ctype, "cache-control": CACHE}
    signed = ";".join(sorted(hdrs))
    canon = "\n".join(["PUT", uri, "", "".join(f"{k}:{hdrs[k]}\n" for k in sorted(hdrs)), signed, ph])
    scope = f"{day}/auto/s3/aws4_request"
    sts = "\n".join(["AWS4-HMAC-SHA256", amz, scope, hashlib.sha256(canon.encode()).hexdigest()])
    k = sign(sign(sign(sign(("AWS4" + secret).encode(), day), "auto"), "s3"), "aws4_request")
    sig = hmac.new(k, sts.encode(), hashlib.sha256).hexdigest()
    hdrs["authorization"] = f"AWS4-HMAC-SHA256 Credential={key_id}/{scope}, SignedHeaders={signed}, Signature={sig}"
    req = urllib.request.Request("https://" + HOST + uri, data=body, method="PUT", headers=hdrs)
    for i in range(4):
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                return r.status
        except urllib.error.HTTPError as e:
            if e.code in (400, 401, 403):
                raise RuntimeError(f"{path}: HTTP {e.code} {e.read()[:200]!r}")
        except Exception:
            pass
    raise RuntimeError(f"{path}: failed after retries")


def files():
    for d in DIRS:
        for f in sorted((ROOT / d).rglob("*")):
            if f.is_file() and f.name not in SKIP:
                yield f.relative_to(ROOT).as_posix(), f


def main():
    dry, check = "--dry" in sys.argv, "--check" in sys.argv
    if check:
        for p in ["data/gallery/index.json", "data/gallery/ids.txt", "data/paintmap/manifest.json"]:
            try:
                with urllib.request.urlopen(urllib.request.Request(f"{PUBLIC}/{p}", method="HEAD", headers={"Origin": "https://chromatlas.app", "User-Agent": "Mozilla/5.0 (colorhub r2_sync check)"}), timeout=30) as r:
                    print(p, r.status, r.headers.get("content-type"), r.headers.get("access-control-allow-origin"), r.headers.get("cf-cache-status"))
            except Exception as e:
                print(p, "ERROR", e)
        return
    man = json.loads(MANIFEST.read_text()) if MANIFEST.exists() else {}
    todo = []
    for p, f in files():
        h = hashlib.sha1(f.read_bytes()).hexdigest()
        if man.get(p) != h:
            todo.append((p, f, h))
    size = sum(f.stat().st_size for _, f, _ in todo)
    print(f"{len(todo)} files to upload ({size / 1e6:.1f} MB)")
    if dry or not todo:
        return
    key_id, secret = creds()
    done = [0]

    def one(item):
        p, f, h = item
        ctype = mimetypes.guess_type(p)[0] or ("application/octet-stream" if p.endswith(".bin") else "text/plain")
        if p.endswith(".json"):
            ctype = "application/json"
        put(key_id, secret, p, f.read_bytes(), ctype)
        man[p] = h
        done[0] += 1
        if done[0] % 250 == 0:
            print(f"  {done[0]}/{len(todo)}", flush=True)
            MANIFEST.write_text(json.dumps(man))
    with ThreadPoolExecutor(16) as ex:
        list(ex.map(one, todo))
    MANIFEST.write_text(json.dumps(man))
    print(f"uploaded {done[0]} files to r2://{BUCKET} -> {PUBLIC}")


if __name__ == "__main__":
    main()
