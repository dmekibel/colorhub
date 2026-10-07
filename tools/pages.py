#!/usr/bin/env python3
"""Crawlable copies of ColorHub's pages, for search engines and link previews.

The app routes with hashes (#/color/teal), which search engines don't index and chat apps can't preview.
This writes a small static HTML page for every color, wiki page and painting, each with a real <title>,
meta description, Open Graph tags (title, description, a 1200x630 image), a canonical link and the page's
text in plain HTML. People are sent straight on into the app route; crawlers and link previewers stay
and read the text.

  c/<slug>/index.html     every color (basics + unit colors), og/c/<slug>.png
  p/<id>/index.html       every written wiki page, og/p/<id>.png (its swatches)
  art/<slug>/index.html   every painting (its own image is the preview)
  og/app.png              the home page preview
  sitemap.xml, robots.txt

Run from anywhere:  python3 tools/pages.py      (needs node and Pillow)
Output is deterministic: same data in, same files out. Files it no longer makes are removed.
Fonts for the preview images: Georgia and Menlo (macOS system fonts); another machine may draw them
slightly differently, so regenerate on a Mac to keep diffs clean.
"""
import colorsys, html, json, os, re, subprocess, sys, unicodedata
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = "https://dmekibel.github.io/colorhub/"
OUT_DIRS = ["c", "p", "art", "og"]

# ---------- data (read through node, exactly as the app reads it) ----------
def load_data():
    js = """
    global.window = global;
    for (const f of ["colors", "wiki-seed", "wiki-colors", "wiki-nodes", "stories", "paintings", "images"]) require(process.argv[1] + "/data/" + f + ".js");
    process.stdout.write(JSON.stringify({ DATA, WIKI_SEED, WIKI_COLORS, WIKI_NODES, STORIES, PAINTINGS, WIKI_IMAGES }));
    """
    out = subprocess.run(["node", "-e", js, ROOT], capture_output=True, check=True, text=True).stdout
    return json.loads(out)

def slug(s):
    s = unicodedata.normalize("NFKD", str(s))
    s = "".join(ch for ch in s if not unicodedata.combining(ch)).lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")

FACET_LABEL = {"language": "Language", "history": "History", "art": "Art", "culture": "Culture", "symbolism": "Symbolism", "poetry": "Poetry",
               "philosophy": "Philosophy", "science": "Science", "design": "Design"}
TYPE_LABEL = {"concept": "Idea", "tradition": "Tradition", "movement": "Movement", "pigment": "Pigment", "person": "Person", "work": "Book",
              "culture": "Culture", "painting": "Painting", "color": "Color", "story": "Story"}
LINK = re.compile(r"\[\[([^\]|]+)(?:\|([^\]]+))?\]\]")
esc = lambda s: html.escape(str(s), quote=True)

class Site:
    def __init__(self, d):
        self.d = d
        self.colors = []   # (name, hex, info dict)
        for n, h in d["DATA"]["basics"]:
            self.colors.append({"n": n, "h": h, "basic": True})
        for i, u in enumerate(d["DATA"]["units"]):
            for c in u["colors"]:
                self.colors.append({**c, "unit": f"Unit {i + 1} · {d['DATA']['tiers'][str(u['tier'])]['short']}"})
        self.by_name = {c["n"].lower(): c for c in self.colors}
        self.pages = {p["id"]: p for p in d["WIKI_NODES"]}
        self.paintings = {p["id"]: p for p in d["PAINTINGS"]}
        self.stories = {s["id"]: s for s in d["STORIES"]}

    # where a [[link]] points, relative to a page two folders deep
    def href(self, target):
        t = target.strip()
        if t.lower() in self.by_name: return f"../../c/{slug(self.by_name[t.lower()]['n'])}/"
        if t in self.pages: return f"../../p/{t}/"
        if t in self.paintings: return f"../../art/{t[len('painting-'):]}/"
        if t in self.stories or t.startswith("s:"): return f"../../#/story/{t[2:] if t.startswith('s:') else t}"
        return None

    def rich(self, text):
        out, at = [], 0
        for m in LINK.finditer(text):
            out.append(esc(text[at:m.start()]))
            label, h = m.group(2) or m.group(1), self.href(m.group(1))
            out.append(f'<a href="{esc(h)}">{esc(label)}</a>' if h else esc(label))
            at = m.end()
        out.append(esc(text[at:]))
        return "".join(out)

def plain(text):
    return LINK.sub(lambda m: m.group(2) or m.group(1), str(text or ""))

def clip(text, n=158):
    t = re.sub(r"\s+", " ", plain(text)).strip()
    if len(t) <= n: return t
    cut = t[:n - 1].rsplit(" ", 1)[0].rstrip(",;:—-")
    return cut + "…"

def codes(hexv):
    r, g, b = (int(hexv[i:i + 2], 16) for i in (1, 3, 5))
    k = 1 - max(r, g, b) / 255
    cmy = [0 if k >= 1 else round((1 - v / 255 - k) / (1 - k) * 100) for v in (r, g, b)]
    mx, mn = max(r, g, b) / 255, min(r, g, b) / 255
    l, dd = (mx + mn) / 2, mx - mn
    h = 0
    if dd:
        if mx == r / 255: h = ((g - b) / 255 / dd) % 6
        elif mx == g / 255: h = (b - r) / 255 / dd + 2
        else: h = (r - g) / 255 / dd + 4
        h = round(h * 60 + 360) % 360
    s = dd / (1 - abs(2 * l - 1)) if dd else 0
    return [("HEX", hexv), ("RGB", f"{r} {g} {b}"), ("HSL", f"{h}° {round(s * 100)}% {round(l * 100)}%"), ("CMYK", f"{' '.join(map(str, cmy))} {round(k * 100)}")]

# ---------- the page shell ----------
CSS = """body{margin:0;background:#0E0D0B;color:#ECE8DF;font:17px/1.6 Georgia,serif}main{max-width:640px;margin:0 auto;padding:28px 22px 60px}
a{color:#ECE8DF}.top{font:12px/1 Menlo,monospace;letter-spacing:.12em;text-transform:uppercase;color:#9A958A}.top a{text-decoration:none}
h1{font-weight:400;font-size:52px;line-height:1;margin:18px 0 8px}h2{font:600 12px/1 Menlo,monospace;letter-spacing:.14em;text-transform:uppercase;color:#9A958A;margin:34px 0 10px}
.sw{height:220px;margin:20px -22px}.sws{display:flex;height:160px;margin:20px -22px}.sws i{flex:1}.meta{color:#9A958A;font:13px/1.5 Menlo,monospace}
dl{display:grid;grid-template-columns:auto 1fr;gap:4px 16px;font:14px/1.5 Menlo,monospace}dt{color:#9A958A}dd{margin:0}
ul{padding-left:20px}.go{display:inline-block;margin-top:28px;padding:12px 18px;background:#ECE8DF;color:#141311;text-decoration:none;font:600 14px/1 Menlo,monospace}
img{max-width:100%;height:auto}.fine{color:#837E73;font:12px/1.5 Menlo,monospace;margin-top:30px}"""

BOT = r"bot|crawl|spider|slurp|facebookexternalhit|embedly|preview|whatsapp|telegram|discord|slack|skype|vkshare|pinterest|quora|outbrain|w3c_validator"

def page(path, route, title, desc, image, body, img_w=1200, img_h=630, kind="article"):
    url = SITE + path
    full = f"{title} · ColorHub"
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{esc(full)}</title>
<meta name="description" content="{esc(desc)}">
<link rel="canonical" href="{esc(url)}">
<meta property="og:type" content="{kind}">
<meta property="og:site_name" content="ColorHub">
<meta property="og:title" content="{esc(full)}">
<meta property="og:description" content="{esc(desc)}">
<meta property="og:url" content="{esc(url)}">
<meta property="og:image" content="{esc(SITE + image)}">
<meta property="og:image:width" content="{img_w}">
<meta property="og:image:height" content="{img_h}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#0E0D0B">
<link rel="icon" href="../../icon.svg" type="image/svg+xml">
<script>if(!/{BOT}/i.test(navigator.userAgent))location.replace("../../#/{route}");</script>
<style>{CSS}</style>
</head>
<body>
<main>
<p class="top"><a href="../../">ColorHub</a></p>
{body}
<p><a class="go" href="../../#/{route}">Open in ColorHub</a></p>
<p class="fine">Hex values are screen approximations. Every page lists its sources.</p>
</main>
</body>
</html>
"""

# ---------- preview images ----------
def font(names, size, index=0):
    for n in names:
        try: return ImageFont.truetype(n, size, index=index)
        except OSError: pass
    return ImageFont.load_default()

SERIF = ["/System/Library/Fonts/Supplemental/Georgia.ttf", "Georgia.ttf", "DejaVuSerif.ttf"]
MONO = ["/System/Library/Fonts/Menlo.ttc", "Menlo.ttc", "DejaVuSansMono.ttf"]
PAPER, PAPER_INK, PAPER_SOFT = (239, 235, 227), (20, 19, 17), (110, 106, 96)
rgb = lambda h: tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))

def fit(draw, text, names, size, width):
    f = font(names, size)
    while size > 28 and draw.textlength(text, font=f) > width:
        size -= 4; f = font(names, size)
    return f

def chip_image(fills, title, sub, out):
    """A paint chip: the color(s) on top, a paper label with the name below."""
    W, H, LBL = 1200, 630, 190
    im = Image.new("RGB", (W, H), PAPER)
    d = ImageDraw.Draw(im)
    x = 0
    for i, (h, share) in enumerate(fills):
        w = W - x if i == len(fills) - 1 else round(W * share)
        d.rectangle([x, 0, x + w, H - LBL], fill=rgb(h)); x += w
    d.text((56, H - LBL + 34), title, font=fit(d, title, SERIF, 84, W - 112), fill=PAPER_INK)
    d.text((58, H - 52), sub, font=font(MONO, 24), fill=PAPER_SOFT)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    # a 256-color palette makes the file a third the size; keep it only if every swatch stays exact
    q = im.quantize(colors=256, method=Image.Quantize.MEDIANCUT)
    qr, x = q.convert("RGB"), 0
    exact = True
    for i, (h, share) in enumerate(fills):
        w = W - x if i == len(fills) - 1 else round(W * share)
        if w > 2 and qr.getpixel((x + w // 2, 20)) != rgb(h): exact = False
        x += w
    (q if exact else im).save(out, "PNG", optimize=True)

# ---------- writers ----------
def main():
    d = load_data()
    s = Site(d)
    written = set()

    def write(rel, text=None, image=None):
        p = os.path.join(ROOT, rel)
        os.makedirs(os.path.dirname(p), exist_ok=True)
        if text is not None:
            with open(p, "w", encoding="utf-8", newline="\n") as f: f.write(text)
        written.add(os.path.normpath(p))

    urls = [SITE]
    # which paintings use each color word
    in_ptg = {}
    for pid in sorted(s.paintings):
        for x in s.paintings[pid].get("palette", []):
            if x.get("vocab"): in_ptg.setdefault(x["vocab"].lower(), []).append(pid)

    # colors
    for c in s.colors:
        sl, w = slug(c["n"]), d["WIKI_COLORS"].get(c["n"])
        facets = (w or {}).get("facets", [])
        desc = clip(facets[0]["text"] if facets else c.get("o") or c.get("d") or f"{c['n']}, {c['h']}: one of the color names you can learn on ColorHub.")
        nb = s.by_name.get(str(c.get("vs", "")).lower())
        parts = [f'<div class="sw" style="background:{c["h"]}"></div>',
                 f'<p class="meta">{"Basic color word" if c.get("basic") else esc(c.get("unit", ""))}</p>',
                 f"<h1>{esc(c['n'])}</h1>",
                 "<dl>" + "".join(f"<dt>{k}</dt><dd>{esc(v)}</dd>" for k, v in codes(c["h"])) + "</dl>"]
        if nb and c.get("d"):
            parts.append(f'<h2>{esc(c["n"])} or {esc(nb["n"])}?</h2><p>{esc(c["d"])}</p><p class="meta">Compare: <a href="../../c/{slug(nb["n"])}/">{esc(nb["n"])}</a></p>')
        if c.get("o") and not any(f["k"] == "language" for f in facets):
            parts.append(f"<p>{esc(c['o'])}</p>")
        for f in facets:
            parts.append(f"<h2>{esc(FACET_LABEL.get(f['k'], f['k']))}</h2><p>{s.rich(f['text'])}</p>")
        rel = [(s.by_name.get(r["to"].lower()), r["why"]) for r in (w or {}).get("related", [])]
        rel = [(x, why) for x, why in rel if x]
        if rel:
            parts.append("<h2>Kin</h2><ul>" + "".join(f'<li><a href="../../c/{slug(x["n"])}/">{esc(x["n"])}</a>: {esc(why)}</li>' for x, why in rel) + "</ul>")
        ptgs = in_ptg.get(c["n"].lower(), [])
        if ptgs:
            parts.append("<h2>In paintings</h2><ul>" + "".join(f'<li><a href="../../art/{pid[len("painting-"):]}/">{esc(s.paintings[pid]["title"])}</a>, {esc(s.paintings[pid].get("artist", ""))}</li>' for pid in ptgs) + "</ul>")
        if w and w.get("sources"):
            parts.append("<h2>Sources</h2><ul>" + "".join(f"<li>{esc(x)}</li>" for x in w["sources"]) + "</ul>")
        og = f"og/c/{sl}.png"
        chip_image([(c["h"], 1)], c["n"], f"{c['h']}   ·   COLORHUB", os.path.join(ROOT, og)); write(og)
        write(f"c/{sl}/index.html", page(f"c/{sl}/", f"color/{sl}", c["n"], desc, og, "\n".join(parts)))
        urls.append(SITE + f"c/{sl}/")

    # wiki pages (written ones only)
    for pid in sorted(s.pages):
        n = s.pages[pid]
        if not n.get("body") and not n.get("sections") and not n.get("dek"): continue
        sw = [x for x in n.get("swatches", []) if re.match(r"^#[0-9A-Fa-f]{6}$", str(x.get("h", "")))]
        desc = clip(n.get("dek") or (n.get("body") or [""])[0])
        parts = []
        if sw: parts.append('<div class="sws">' + "".join(f'<i style="background:{x["h"]}" title="{esc(x.get("label", ""))}"></i>' for x in sw) + "</div>")
        parts.append(f'<p class="meta">{esc(TYPE_LABEL.get(n.get("type"), "Page"))}</p><h1>{esc(n["title"])}</h1>')
        if n.get("dek"): parts.append(f"<p><em>{s.rich(n['dek'])}</em></p>")
        if n.get("facts"): parts.append("<dl>" + "".join(f"<dt>{esc(f['label'])}</dt><dd>{s.rich(f['value'])}</dd>" for f in n["facts"]) + "</dl>")
        for para in n.get("body", []): parts.append(f"<p>{s.rich(para)}</p>")
        for sec in n.get("sections", []) or []:
            texts = sec["text"] if isinstance(sec["text"], list) else [sec["text"]]
            parts.append(f"<h2>{esc(sec['title'])}</h2>" + "".join(f"<p>{s.rich(t)}</p>" for t in texts))
        if sw and any(x.get("label") for x in sw):
            parts.append("<h2>Swatches</h2><ul>" + "".join(f'<li>{esc(x.get("label", ""))} <span class="meta">{x["h"]}</span></li>' for x in sw) + "</ul>")
        cols = [s.by_name.get(str(x).lower()) for x in n.get("colors", [])]
        cols = [x for x in cols if x]
        if cols: parts.append("<h2>Colors</h2><ul>" + "".join(f'<li><a href="../../c/{slug(x["n"])}/">{esc(x["n"])}</a></li>' for x in cols) + "</ul>")
        if n.get("sources"): parts.append("<h2>Sources</h2><ul>" + "".join(f"<li>{esc(x)}</li>" for x in n["sources"]) + "</ul>")
        og = f"og/p/{pid}.png"
        fills = [(x["h"], 1 / len(sw)) for x in sw[:8]] if sw else [("#3A3A3A", 1)]
        chip_image(fills, n["title"], f"{TYPE_LABEL.get(n.get('type'), 'Page').upper()}   ·   COLORHUB", os.path.join(ROOT, og)); write(og)
        write(f"p/{pid}/index.html", page(f"p/{pid}/", f"page/{pid}", n["title"], desc, og, "\n".join(parts)))
        urls.append(SITE + f"p/{pid}/")

    # paintings
    for pid in sorted(s.paintings):
        n = s.paintings[pid]
        sl = pid[len("painting-"):]
        pal = n.get("palette", [])
        desc = clip(n.get("note") or f"{n['title']} by {n.get('artist', '')}: its palette, six exact colors, each named.")
        parts = [f'<p class="meta">Painting · {esc(n.get("year", ""))}</p><h1>{esc(n["title"])}</h1>',
                 f'<p class="meta">{esc(n.get("artist", ""))}{" · " + esc(n["place"]) if n.get("place") else ""}</p>']
        if n.get("img"): parts.append(f'<p><img src="../../{esc(n["img"])}" width="{n.get("w", "")}" height="{n.get("h", "")}" alt="{esc(n["title"])} by {esc(n.get("artist", ""))}"></p>')
        if pal:
            parts.append('<div class="sws">' + "".join(f'<i style="background:{x["h"]};flex:{max(x["share"], .08)}"></i>' for x in pal) + "</div>")
            parts.append("<h2>Palette</h2><ul>" + "".join(
                f'<li>{esc(x["name"])} <span class="meta">{x["h"]} · {round(x["share"] * 100)}%</span>'
                + (f' · your word: <a href="../../c/{slug(x["vocab"])}/">{esc(x["vocab"])}</a>' if x.get("vocab") and x["vocab"].lower() in s.by_name else "") + "</li>" for x in pal) + "</ul>")
        if n.get("note"): parts.append(f"<p>{s.rich(n['note'])}</p>")
        if n.get("commons"): parts.append(f'<h2>Image</h2><p><a href="{esc(n["commons"])}">Wikimedia Commons</a> · {esc(n.get("license", "Public domain"))}</p>')
        img = n.get("img") or "og/app.png"
        write(f"art/{sl}/index.html", page(f"art/{sl}/", f"painting/{sl}", n["title"], desc, img, "\n".join(parts), n.get("w", 1200), n.get("h", 630)))
        urls.append(SITE + f"art/{sl}/")

    # the home preview: a wall of chips, light to dark by hue
    def hue_key(c):
        h, l, sat = colorsys.rgb_to_hls(*(v / 255 for v in rgb(c["h"])))
        return (sat < .15 or l < .08 or l > .94, round((h + .03) % 1, 4), -round(l, 4), c["n"])
    wall = sorted(s.colors, key=hue_key)
    chip_image([(c["h"], 1 / len(wall)) for c in wall], "ColorHub", "LEARN THE NAMES OF COLORS", os.path.join(ROOT, "og/app.png")); write("og/app.png")

    write("sitemap.xml", '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
          + "".join(f"  <url><loc>{esc(u)}</loc></url>\n" for u in urls) + "</urlset>\n")
    write("robots.txt", f"User-agent: *\nAllow: /\n\nSitemap: {SITE}sitemap.xml\n")

    # remove pages and images this run didn't make (a renamed color, a removed page)
    removed = 0
    for top in OUT_DIRS:
        for dp, dn, fn in os.walk(os.path.join(ROOT, top), topdown=False):
            for f in fn:
                p = os.path.normpath(os.path.join(dp, f))
                if p not in written: os.remove(p); removed += 1
            if not os.listdir(dp): os.rmdir(dp)
    n_html = sum(1 for p in written if p.endswith(".html"))
    n_png = sum(1 for p in written if p.endswith(".png"))
    print(f"pages: {n_html} html ({len(s.colors)} colors, {len([u for u in urls if '/p/' in u])} wiki pages, {len(s.paintings)} paintings), {n_png} preview images, {len(urls)} sitemap urls, {removed} stale files removed")

if __name__ == "__main__":
    main()
