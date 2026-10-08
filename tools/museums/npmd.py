"""Smithsonian National Postal Museum: stamps, from the Smithsonian Open Access bulk data. No key, no API.

Route:   https://smithsonian-open-access.s3-us-west-2.amazonaws.com/metadata/edan/npm/00.txt ... ff.txt (about 46 MB of
         line-delimited JSON, CC0). The same bucket and record format as tools/museums/chndm.py, whose parser this reuses.
Kept:    records of object type "Postage stamps" (not covers, proofs, equipment or letters) with a CC0 image and a date
         of 1800-1979.
Images:  https://ids.si.edu/ids/deliveryService?id=<idsId>&max=300.
Pace:    ~4 requests a second.
"""
import re
from pathlib import Path

from . import chndm, common

BASE = "https://smithsonian-open-access.s3-us-west-2.amazonaws.com/metadata/edan/npm/"
INFO = dict(gap=0.12, workers=8, name="Smithsonian National Postal Museum", api="https://www.si.edu/openaccess (bulk data, no key)",
            license="CC0 (Smithsonian Open Access)")
STAMP = re.compile(r"^(postage )?stamps?$|^postage stamps|commemorative stamps|definitive stamps|air ?mail stamps", re.I)


def meta(C, resume=False):
    d = C.SRC["npmd"]["dir"]
    sd = d / "shards"
    sd.mkdir(parents=True, exist_ok=True)
    rows = []
    for i in range(256):
        p = sd / f"{i:02x}.txt"
        if not (resume and p.exists() and p.stat().st_size):
            C.download("npmd", BASE + p.name, p)
        for line in p.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            x = chndm.parse(line)
            if not x["media"] or x["y"] is None or not (1800 <= x["y"] <= 1979):
                continue
            if any(STAMP.search(t) for t in x["types"]):
                rows.append(dict(x, cat="stamps"))
    print(f"npmd: {len(rows)} stamps with CC0 images, 1800-1979", flush=True)
    return C.write_meta("npmd", rows)


def group_key(C, x):
    return f"npmd:{x['id']}"


def image_urls(x):
    return [chndm.IDS + x["media"][0] + "&max=300"]


def norm(C, x):
    return dict(id=f"npmd-{x['acc'] or x['id']}", src="npmd", t=C.clean_title(x.get("title")), a=x["maker"], y=x["y"],
                co=C.country_of(x.get("place")) or "United States", cat="stamps", ty="postage stamp", img=image_urls(x)[0],
                url=x["link"])
