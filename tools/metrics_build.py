#!/usr/bin/env python3
"""Build data/gallery/metrics.bin: one fixed 27-byte record per painting, in gallery order, for the metric switch
on "Closest in the archive" (js/twins.js). Everything comes from data/analysis/paintings-NNN.json (tools/analyze.py),
so nothing is recomputed from images.

Record (27 bytes):
  0-9    Lh   lightness histogram, 10 bins of 10 L* each, one byte per bin (fraction * 255)
  10-21  hh   hue histogram, 12 bins of 30 degrees (LCh), chroma-weighted, one byte per bin
  22     Lm   mean lightness L*
  23     Cm   mean chroma (clamped to 255)
  24     ct   contrast: p95 - p5 of lightness
  25     p5   5th percentile lightness
  26     p95  95th percentile lightness

Run: python3 tools/metrics_build.py   (about a second; deterministic; commit the output)
"""
import base64, json, os, sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
GAL = os.path.join(ROOT, "data", "gallery")
AN = os.path.join(ROOT, "data", "analysis")
REC = 27


def clamp(v):
    return max(0, min(255, int(round(v))))


def main():
    head = json.load(open(os.path.join(GAL, "index.json")))
    n, shard = head["n"], head["shard"]
    out = bytearray()
    missing = 0
    for k in range((n + shard - 1) // shard):
        rows = json.load(open(os.path.join(AN, "paintings-%03d.json" % k)))
        ids = json.load(open(os.path.join(GAL, "d", "%03d.json" % k)))
        if len(rows) != len(ids) or any(r["id"] != g[0] for r, g in zip(rows, ids)):
            sys.exit("analysis shard %d is not aligned with the gallery shard" % k)
        for r in rows:
            s = r.get("stat") or {}
            lh = base64.b64decode(s["Lh"]) if s.get("Lh") else b""
            hh = base64.b64decode(s["hh"]) if s.get("hh") else b""
            if len(lh) != 10 or len(hh) != 12:
                missing += 1
                lh, hh = bytes(10), bytes(12)
            out += lh + hh + bytes([clamp(s.get("Lm", 0)), clamp(s.get("Cm", 0)), clamp(s.get("ct", 0)), clamp(s.get("p5", 0)), clamp(s.get("p95", 0))])
    assert len(out) == n * REC, (len(out), n * REC)
    open(os.path.join(GAL, "metrics.bin"), "wb").write(out)
    print("wrote data/gallery/metrics.bin: %d paintings x %d bytes = %d bytes (%d without histograms)" % (n, REC, len(out), missing))


if __name__ == "__main__":
    main()
