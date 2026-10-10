#!/usr/bin/env python3
"""Probe every Design Objects image URL (data/design/objects-*.json, js/designobjects.js's DO_IMG_TPL) and
report which ones a real browser can actually load. Polite: a small thread pool, one request per item (HEAD
where the host supports it, GET otherwise -- several of these hosts answer HEAD with a different status than
GET), a short per-request timeout, and no certificate bypass (a script that disables TLS verification to "test"
a host would hide the exact failure a real browser hits -- if a cert is bad, that IS the result we want).

  python3 tools/design_check_images.py [--limit N] [--src chndm,npmd,...] [--workers N] [--ua safari|bot]

Checks each item twice: once with a plain desktop UA (no Referer), once with an iPhone Safari UA and
Referer: https://dmekibel.github.io/ (hotlink checks can differ by Referer, and the app is served from
GitHub Pages). Prints a per-host summary (ok / failed, grouped by reason) and writes the full per-item detail
to research/_raw/design-image-check.json for anything that needs a closer look.
"""
import json, re, ssl, sys, time, threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import quote
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

ROOT = Path(__file__).resolve().parent.parent
CATS = ["ceramics", "costume", "furniture", "glass", "graphic", "poster", "product", "stamps", "textile", "wallpaper"]
OUT = ROOT / "research" / "_raw" / "design-image-check.json"

DO_IMG_TPL = {
    "chndm": lambda i: f"https://ids.si.edu/ids/deliveryService?id={quote(i)}&max=300",
    "npmd": lambda i: f"https://ids.si.edu/ids/deliveryService?id={quote(i)}&max=300",
    "rijksd": lambda i: f"https://iiif.micr.io/{i}/full/400,/0/default.jpg",
    "metd": lambda i: f"https://images.metmuseum.org/CRDImages/{i}",
    "cmad": lambda i: i,
    "commonsd": lambda i: i,
    "aicd": lambda i, oid: f"img/design/aicd/{oid}.jpg",   # self-hosted already; checked as a local-file existence, not a fetch
}
UA_DESKTOP = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15"
UA_IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
REFERER = "https://dmekibel.github.io/"


def rows(only_srcs=None):
    out = []
    for c in CATS:
        p = ROOT / "data" / "design" / f"objects-{c}.json"
        if not p.exists():
            continue
        for r in json.loads(p.read_text()):
            if r.get("src") == "aicd":
                continue  # self-hosted; tools/check_fetched.js-style existence check, not a network probe
            if only_srcs and r.get("src") not in only_srcs:
                continue
            if r.get("i"):
                out.append(r)
    return out


def probe(url, ua, referer):
    headers = {"User-Agent": ua}
    if referer:
        headers["Referer"] = referer
    req = Request(url, headers=headers, method="GET")
    t0 = time.time()
    try:
        with urlopen(req, timeout=12) as resp:
            ctype = resp.headers.get("Content-Type", "")
            body = resp.read(2048)
            ms = round((time.time() - t0) * 1000)
            redirected = resp.geturl() != url
            if "image" in ctype:
                return {"ok": True, "status": resp.status, "type": ctype, "ms": ms, "redirected": redirected}
            kind = "html-not-image" if (b"<html" in body.lower() or "text/html" in ctype) else "non-image-response"
            return {"ok": False, "status": resp.status, "type": ctype, "reason": kind, "ms": ms, "redirected": redirected, "snippet": body[:160].decode("utf8", "replace")}
    except HTTPError as e:
        return {"ok": False, "status": e.code, "reason": f"http-{e.code}", "ms": round((time.time() - t0) * 1000)}
    except ssl.SSLCertVerificationError as e:
        reason = "ssl-cert-expired" if "expired" in str(e) else "ssl-cert-invalid"
        return {"ok": False, "status": None, "reason": reason, "detail": str(e)[:200], "ms": round((time.time() - t0) * 1000)}
    except URLError as e:
        reason = str(e.reason)
        if "CERTIFICATE_VERIFY_FAILED" in reason:
            kind = "ssl-cert-expired" if "expired" in reason else "ssl-cert-invalid"
        elif "timed out" in reason.lower():
            kind = "timeout"
        else:
            kind = "connection-error"
        return {"ok": False, "status": None, "reason": kind, "detail": reason[:200], "ms": round((time.time() - t0) * 1000)}
    except Exception as e:
        return {"ok": False, "status": None, "reason": type(e).__name__, "detail": str(e)[:200], "ms": round((time.time() - t0) * 1000)}


def check_one(r):
    tpl = DO_IMG_TPL.get(r["src"])
    if not tpl:
        return {"id": r["id"], "src": r["src"], "skip": "no template"}
    url = tpl(r["i"])
    desktop = probe(url, UA_DESKTOP, None)
    time.sleep(0.15)
    iphone = probe(url, UA_IPHONE, REFERER)
    return {"id": r["id"], "src": r["src"], "cat": r.get("cat"), "url": url, "desktop": desktop, "iphone": iphone}


def main():
    args = sys.argv[1:]
    limit, workers, only_srcs = None, 4, None
    for i, a in enumerate(args):
        if a == "--limit":
            limit = int(args[i + 1])
        if a == "--workers":
            workers = int(args[i + 1])
        if a == "--src":
            only_srcs = set(args[i + 1].split(","))
    todo = rows(only_srcs)
    if limit:
        todo = todo[:limit]
    print(f"probing {len(todo)} image URLs ({workers} workers, two requests each: desktop UA + iPhone UA/Referer)...", flush=True)
    results = []
    done = [0]
    lock = threading.Lock()

    def one(r):
        res = check_one(r)
        with lock:
            results.append(res)
            done[0] += 1
            if done[0] % 200 == 0 or done[0] == len(todo):
                print(f"  {done[0]}/{len(todo)}", flush=True)

    with ThreadPoolExecutor(workers) as ex:
        list(ex.map(one, todo))

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(results, indent=0))

    by_host = {}
    for r in results:
        if "skip" in r:
            continue
        host = r["src"]
        h = by_host.setdefault(host, {"n": 0, "ok": 0, "reasons": {}})
        h["n"] += 1
        # "broken" = fails under the iPhone probe (what David's phone actually sees); desktop is extra context
        if r["iphone"]["ok"]:
            h["ok"] += 1
        else:
            reason = r["iphone"].get("reason") or f"http-{r['iphone'].get('status')}"
            h["reasons"][reason] = h["reasons"].get(reason, 0) + 1

    print("\n== by host (iPhone UA + Referer) ==")
    total_n = total_ok = 0
    for host, h in sorted(by_host.items(), key=lambda kv: -kv[1]["n"]):
        total_n += h["n"]; total_ok += h["ok"]
        pct = round(100 * h["ok"] / h["n"]) if h["n"] else 0
        reasons = ", ".join(f"{k}×{v}" for k, v in sorted(h["reasons"].items(), key=lambda kv: -kv[1]))
        print(f"  {host:10s} {h['ok']:5d}/{h['n']:5d} ok ({pct:3d}%)  {reasons}")
    print(f"\n  TOTAL      {total_ok:5d}/{total_n:5d} ok ({round(100*total_ok/total_n) if total_n else 0}%)")
    print(f"\nfull detail: {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
