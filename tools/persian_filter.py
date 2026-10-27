#!/usr/bin/env python3
"""Drop the pages that are not pictures from the Persian shard (David, 2026-10-26: "is it just white paper with text or actual art?").

  python3 tools/persian_filter.py [data/corpus/zz-commons-persianart-1.json]

Illustrated manuscript folios include pages that are mostly calligraphy, blank or stained paper, pencil sketches and borders.
CLIP (research/_raw/clipenv, ViT-B/32 laion2b, zero-shot) scores each cached image (research/_raw/commons/img/) against six descriptions;
a row is dropped when "mostly text" > 0.75, "blank or faded paper" > 0.5, "sketch" > 0.5 or "ornament only" > 0.6. The thresholds were set on 48
random pages looked at by eye: every page that was nearly all text scored above 0.8, every page with a real picture (even beside text) below 0.7.
The dropped ids and their scores go to research/_raw/persian-dropped.json so the audit can be read.
"""
import json, os, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VENV = ROOT / "research" / "_raw" / "clipenv" / "bin" / "python"
if Path(sys.executable).resolve() != VENV.resolve():
    if not VENV.exists():
        sys.exit("needs research/_raw/clipenv")
    os.execv(str(VENV), [str(VENV), *sys.argv])
sys.path.insert(0, str(ROOT / "tools"))
import numpy as np, torch, open_clip  # noqa: E402
from PIL import Image  # noqa: E402
import corpus as C  # noqa: E402

path = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "data" / "corpus" / "zz-commons-persianart-1.json"
rows = json.loads(path.read_text())
dev = "mps" if torch.backends.mps.is_available() else "cpu"
model, _, pre = open_clip.create_model_and_transforms("ViT-B-32", pretrained="laion2b_s34b_b79k")
model = model.to(dev).eval(); tok = open_clip.get_tokenizer("ViT-B-32")
CLS = ["a miniature painting with figures, animals, buildings or landscape", "a portrait painting of a person",
       "a manuscript page that is mostly lines of Arabic or Persian calligraphy text", "a blank, stained or faded sheet of paper",
       "a pencil or ink sketch on paper", "a decorative geometric or floral ornament"]
keep, dropped, embs = [], {}, {}
with torch.no_grad():
    T = model.encode_text(tok(CLS).to(dev)); T = T / T.norm(dim=-1, keepdim=True)
    for i, r in enumerate(rows):
        src, rid = r["id"].split("-", 1)
        try:
            im = pre(Image.open(C.img_path(src, rid)).convert("RGB")).unsqueeze(0).to(dev)
            e = model.encode_image(im); e = e / e.norm(dim=-1, keepdim=True)
            p = (100 * e @ T.T).softmax(-1)[0].cpu().numpy()
        except Exception:
            keep.append(r); continue
        if p[2] > 0.75 or p[3] > 0.5 or p[4] > 0.5 or p[5] > 0.6:
            dropped[r["id"]] = [round(float(x), 2) for x in p] + [r["t"][:60]]
        else:
            keep.append(r); embs[r["id"]] = e[0].cpu().numpy().astype(np.float32)
        if (i + 1) % 500 == 0:
            print(f"  {i + 1}/{len(rows)} scored, {len(dropped)} dropped", flush=True)
# near-duplicates by what the picture shows (the same painting scanned or cropped twice): cosine >= DUP between two kept rows drops the later id;
# the 0.93-DUP band is only written out for a look, since folios of one book share a style without being the same picture
DUP, BAND = 0.975, 0.93
ids = [r["id"] for r in keep]
if ids:
    M = np.stack([embs[i] for i in ids]); S = M @ M.T; np.fill_diagonal(S, 0)
    gone, band = set(), []
    for a in range(len(ids)):
        if ids[a] in gone:
            continue
        for b in np.where(S[a, a + 1:] >= BAND)[0] + a + 1:
            if ids[b] in gone:
                continue
            if S[a, b] >= DUP:
                gone.add(ids[b]); dropped[ids[b]] = ["duplicate of", ids[a], round(float(S[a, b]), 3)]
            else:
                band.append([ids[a], ids[b], round(float(S[a, b]), 3)])
    keep = [r for r in keep if r["id"] not in gone]
    (ROOT / "research" / "_raw" / "persian-dup-band.json").write_text(json.dumps(band))
    print(f"CLIP duplicates dropped: {len(gone)}; {len(band)} pairs between {BAND} and {DUP} written to research/_raw/persian-dup-band.json to look at")
line = lambda r: json.dumps(r, ensure_ascii=False, separators=(",", ":"))
path.write_text("[\n" + ",\n".join(line(r) for r in keep) + "\n]\n", encoding="utf-8")
(ROOT / "research" / "_raw" / "persian-dropped.json").write_text(json.dumps(dropped, ensure_ascii=False, indent=0))
print(f"{len(rows)} rows: {len(keep)} kept, {len(dropped)} dropped as text, blank paper, sketches or ornament")
