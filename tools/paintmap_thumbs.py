#!/usr/bin/env python3
"""Build data/gallery/thumbs.txt: one line per painting, in gallery order, with just what the painting map
(js/paintmap.js) needs to draw a thumbnail: the image address (prefix-compressed) and the frame crop.

The detail shards (data/gallery/d/*.json, ~11 MB) carry titles, records and the 24-color pools. A map screen
of a few hundred tiles in a color arrangement touches nearly every shard, so the map reads this small file
instead, and loads a shard only for the painting in the middle (its title and painter).

Line format:  <code><address>\t<crop>
  L  img/gallery/<address>                                   (our own small copies)
  C  https://commons.wikimedia.org/wiki/Special:FilePath/<address>?width=400
  M  https://iiif.micr.io/<address>/full/<w>,/0/default.jpg  (the app picks the width)
  N  https://api.nga.gov/iiif/<address>/full/<w>,/0/default.jpg
  V  https://openaccess-cdn.clevelandart.org/<address>
  E  https://images.metmuseum.org/CRDImages/<address>
  U  <address> as it is
  crop: "l,t,r,b" in thousandths of the photo (tools/crop_paintings.py), or empty.
Run it after tools/gallery.py or tools/crop_paintings.py changes the shards:  python3 tools/paintmap_thumbs.py
"""
import json, os, re, sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
GAL = os.path.join(ROOT, "data", "gallery")
RULES = [
    ("L", r"^img/gallery/(.+)$"),
    ("C", r"^https://commons\.wikimedia\.org/wiki/Special:FilePath/([^?]+)\?width=400$"),
    ("M", r"^https://iiif\.micr\.io/([^/]+)/full/[^/]+/0/default\.jpg$"),
    ("N", r"^https://api\.nga\.gov/iiif/([^/]+)/full/[^/]+/0/default\.jpg$"),
    ("V", r"^https://openaccess-cdn\.clevelandart\.org/(.+)$"),
    ("E", r"^https://images\.metmuseum\.org/CRDImages/(.+)$"),
]


def code(url):
    u = url or ""
    for k, pat in RULES:
        m = re.match(pat, u)
        if m:
            return k + m.group(1)
    return "U" + u


def main():
    head = json.load(open(os.path.join(GAL, "index.json")))
    n, per = head["n"], head["shard"]
    lines = []
    for k in range((n + per - 1) // per):
        rows = json.load(open(os.path.join(GAL, "d", "%03d.json" % k)))
        for r in rows:
            crop = r[11] if len(r) > 11 and r[11] else None
            c = ",".join(str(int(v)) for v in crop) if crop and len(crop) == 4 else ""
            lines.append(code(r[5]) + "\t" + c)
    if len(lines) != n:
        sys.exit("thumbs: %d rows for %d paintings" % (len(lines), n))
    out = os.path.join(GAL, "thumbs.txt")
    with open(out, "w") as f:
        f.write("\n".join(lines) + "\n")
    print("wrote %s: %d paintings, %d bytes" % (out, n, os.path.getsize(out)))


if __name__ == "__main__":
    main()
