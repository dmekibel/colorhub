"use strict";
// The legibility audit's actual DOM-walking logic, shared by tools/check_legibility.js (the gate) and the
// one-time crawl that built design/LEGIBILITY-AUDIT.md. Runs INSIDE a loaded app iframe (tools/legibility-
// wrapper.html evals auditPage.toString() there, same trick scenarios.js's t.ev() uses) -- so this file is
// plain, dependency-free JS with no Node globals, callable as auditPage() once the real DOM exists.
//
// What it does: walks every element, looks at its OWN direct text (not a descendant's -- each element with
// mixed text/children is examined once per text-bearing node so a bold word inside a sentence gets its own
// check), and for each one resolves font-size/weight/style, the computed text color, and the real background
// behind it by walking up the tree and compositing every layer (solid colors, AND the simple linear-gradient
// scrims this app uses for text-over-image, sampled at the text's own position along the gradient axis).
// Where the backdrop is a photo/painting <img> or <canvas> with no scrim overlay found, contrast can't be
// computed honestly, so that node is reported as `bg:"image"` (a visual-check item) instead of guessing.
//
// Rules enforced (David, 2026-10-09 "text has to be super legible"; DESIGN-CANON.md §5; CLAUDE.md learning-
// science + craft-bar rules):
//   - reading text (length > 2 chars) below 13px is always a size failure, regardless of contrast.
//   - any text under 24px needs >= 4.5:1 against its resolved background (the hard gate check_legibility.js runs).
//   - "large" text (>=24px, or >=19px and weight>=600) only needs >= 3:1 (reported, not gated -- see check_legibility.js).
//   - italic text in the serif font under ~17px is flagged as hard-to-read independent of contrast.
//   - body-ish paragraphs (long text) with computed line-height / font-size < 1.4 are flagged.
window.__legibilityAuditSrc = function auditPage() {
  function parseColor(str) {
    if (!str) return null;
    const m = /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+))?\s*\)/.exec(str);
    if (!m) return null;
    return { r: +m[1], g: +m[2], b: +m[3], a: m[4] != null ? +m[4] : 1 };
  }
  function relLum(c) {
    const lin = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
  }
  function contrast(a, b) {
    const la = relLum(a), lb = relLum(b), hi = Math.max(la, lb), lo = Math.min(la, lb);
    return (hi + 0.05) / (lo + 0.05);
  }
  function composite(fg, bg) {   // fg OVER bg, both {r,g,b,a}; returns an opaque color
    const a = fg.a == null ? 1 : fg.a;
    return { r: fg.r * a + bg.r * (1 - a), g: fg.g * a + bg.g * (1 - a), b: fg.b * a + bg.b * (1 - a), a: 1 };
  }
  // Split a gradient's argument list on top-level commas only (commas inside rgba(...) don't count).
  function splitTopCommas(s) {
    const out = []; let depth = 0, cur = "";
    for (const ch of s) {
      if (ch === "(") depth++;
      if (ch === ")") depth--;
      if (ch === "," && depth === 0) { out.push(cur); cur = ""; } else cur += ch;
    }
    if (cur.trim()) out.push(cur);
    return out;
  }
  // Very small linear-gradient sampler: supports "to top/bottom/left/right" and plain deg angles that are
  // effectively vertical (0/180) or horizontal (90/270) -- the only directions this app's CSS uses for text
  // scrims (css/honey.css, css/explore-covers.css, css/menus2.css, css/paintmap.css, css/polish.css...).
  // Returns {color:{r,g,b,a}, axis:"v"|"h"|null} sampled at fraction f (0=start of the gradient line, 1=end),
  // or null if the gradient can't be read this way (an angle we don't model, or a non-color stop like a size).
  function sampleLinearGradient(bgImage, f) {
    const m = /linear-gradient\(([^]*)\)/.exec(bgImage);
    if (!m) return null;
    const parts = splitTopCommas(m[1]);
    let dir = parts[0].trim(), axis = "v", flip = false;
    if (/^to\s/.test(dir)) {
      if (/top/.test(dir) && !/bottom/.test(dir)) { axis = "v"; flip = true; }
      else if (/bottom/.test(dir)) { axis = "v"; flip = false; }
      else if (/left/.test(dir) && !/right/.test(dir)) { axis = "h"; flip = true; }
      else if (/right/.test(dir)) { axis = "h"; flip = false; }
      else return null;   // a diagonal corner -- not modeled
      parts.shift();
    } else if (/deg\s*$/.test(dir)) {
      const deg = ((parseFloat(dir) % 360) + 360) % 360;
      if (deg === 180) { axis = "v"; flip = false; }
      else if (deg === 0) { axis = "v"; flip = true; }
      else if (deg === 90) { axis = "h"; flip = false; }
      else if (deg === 270) { axis = "h"; flip = true; }
      else return null;   // an angle this sampler doesn't model
      parts.shift();
    }   // else: no direction keyword -- CSS default is "to bottom", axis/flip stay as set above
    const stops = [];
    for (const raw of parts) {
      const p = raw.trim();
      const c = parseColor(p);
      if (!c) return null;   // a stop we can't read as a color (e.g. a length-only hint) -- bail out honestly
      const pm = /(-?[\d.]+)%\s*$/.exec(p);
      stops.push({ color: c, pct: pm ? +pm[1] : null });
    }
    if (!stops.length) return null;
    // fill in missing positions by even distribution between the previous known stop and 100 (CSS's own rule)
    if (stops[0].pct == null) stops[0].pct = 0;
    if (stops[stops.length - 1].pct == null) stops[stops.length - 1].pct = 100;
    for (let i = 1; i < stops.length - 1; i++) {
      if (stops[i].pct == null) {
        let j = i; while (stops[j].pct == null) j++;
        const prev = stops[i - 1].pct, span = stops[j].pct - prev, n = j - i + 1;
        for (let k = i, idx = 1; k < j; k++, idx++) stops[k].pct = prev + span * idx / n;
      }
    }
    const t = (flip ? 1 - f : f) * 100;
    let a = stops[0], b = stops[stops.length - 1];
    for (let i = 0; i < stops.length - 1; i++) if (t >= stops[i].pct && t <= stops[i + 1].pct) { a = stops[i]; b = stops[i + 1]; break; }
    const span = b.pct - a.pct, lf = span > 0 ? (t - a.pct) / span : 0;
    return {
      color: {
        r: a.color.r + (b.color.r - a.color.r) * lf, g: a.color.g + (b.color.g - a.color.g) * lf, b: a.color.b + (b.color.b - a.color.b) * lf,
        a: (a.color.a == null ? 1 : a.color.a) + ((b.color.a == null ? 1 : b.color.a) - (a.color.a == null ? 1 : a.color.a)) * lf,
      }, axis,
    };
  }
  function isVisible(el) {
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return false;
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || +cs.opacity === 0) return false;
    if (el.closest('[aria-hidden="true"]')) return false;
    return true;
  }
  // Resolve the effective background behind `el` (the text node's parent element): walk up compositing every
  // non-transparent layer (solid colors, and readable linear-gradient scrims sampled at el's own position)
  // until fully opaque or we run out of ancestors. Returns {color, source, uncertain}.
  function resolveBg(el) {
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
    let node = el, uncertain = false, sawImageNoScrim = false;
    const layers = [];
    while (node && node.nodeType === 1) {
      const cs = getComputedStyle(node);
      const bgColor = parseColor(cs.backgroundColor);
      if (bgColor && bgColor.a > 0) layers.push(bgColor);
      if (cs.backgroundImage && cs.backgroundImage !== "none" && /linear-gradient/.test(cs.backgroundImage)) {
        const r2 = node.getBoundingClientRect();
        let f = 0.5;
        // sample fraction only matters along the gradient's own axis; a vertical gradient cares about y, horizontal about x
        const probe = sampleLinearGradient(cs.backgroundImage, 0) || sampleLinearGradient(cs.backgroundImage, 1);
        if (probe && r2.height > 0 && r2.width > 0) {
          f = probe.axis === "h" ? (cx - r2.left) / r2.width : (cy - r2.top) / r2.height;
          f = Math.max(0, Math.min(1, f));
        }
        const sample = sampleLinearGradient(cs.backgroundImage, f);
        if (sample) layers.push(sample.color);
        else uncertain = true;
      } else if (cs.backgroundImage && cs.backgroundImage !== "none") {
        uncertain = true;   // some other image function (url(), radial, conic) we don't sample
      }
      // an <img>/<canvas>/<video> ancestor or earlier sibling stacked under this point means a real photo/
      // painting sits behind the text; if nothing opaque enough has been layered on top of it yet, flag it.
      if (/^(IMG|CANVAS|VIDEO)$/.test(node.tagName)) sawImageNoScrim = true;
      const siblingImg = node.previousElementSibling;
      if (siblingImg && /^(IMG|CANVAS|VIDEO)$/.test(siblingImg.tagName)) {
        const sr = siblingImg.getBoundingClientRect();
        if (cx >= sr.left && cx <= sr.right && cy >= sr.top && cy <= sr.bottom) sawImageNoScrim = true;
      }
      // stop once we've accumulated a fully opaque layer -- everything further back is invisible
      let opaque = 0; for (const l of layers) opaque = opaque + (1 - opaque) * l.a;
      if (opaque >= 0.995) break;
      node = node.parentElement;
    }
    if (!layers.length) {
      // nothing at all: the document's own background (should always resolve to a concrete color -- body/html set it)
      const bodyColor = parseColor(getComputedStyle(document.body).backgroundColor) || { r: 14, g: 13, b: 11, a: 1 };
      return { color: bodyColor, source: "body", uncertain: sawImageNoScrim, imageNoScrim: sawImageNoScrim };
    }
    // composite far-to-near: the LAST pushed layer is the one closest to the viewer (walked from el outward),
    // so fold from the end (nearest) down, each one OVER the accumulated result-so-far (which represents what's behind it)
    let acc2 = { r: 14, g: 13, b: 11, a: 1 };
    const bodyColor = parseColor(getComputedStyle(document.body).backgroundColor);
    if (bodyColor) acc2 = bodyColor;
    for (let i = layers.length - 1; i >= 0; i--) acc2 = composite(layers[i], acc2);
    const stillTransparentAtTop = (() => { let o = 0; for (const l of layers) o = o + (1 - o) * l.a; return o < 0.995; })();
    return { color: acc2, source: "composited", uncertain: uncertain || (sawImageNoScrim && stillTransparentAtTop), imageNoScrim: sawImageNoScrim && stillTransparentAtTop };
  }
  const results = [];
  const seen = new Set();
  const all = document.querySelectorAll("#app *");
  for (const el of all) {
    if (!(el.childNodes && el.childNodes.length)) continue;
    let own = "";
    for (const n of el.childNodes) if (n.nodeType === 3) own += n.nodeValue;
    own = own.replace(/\s+/g, " ").trim();
    if (!own) continue;
    if (!isVisible(el)) continue;
    const cs = getComputedStyle(el);
    const fontSize = parseFloat(cs.fontSize);
    const weight = parseInt(cs.fontWeight, 10) || 400;
    const italic = cs.fontStyle === "italic";
    const serif = /Instrument Serif/.test(cs.fontFamily);
    const fg = parseColor(cs.color);
    if (!fg) continue;
    const bg = resolveBg(el);
    const ratio = bg.uncertain && bg.imageNoScrim ? null : +contrast(fg, bg.color).toFixed(2);
    // text sitting on its own color swatch (background:var(--c), ink picked by js/core.js's inkHex()) follows
    // this app's own documented standard (tools/check_contrast.js): >=3:1, not the general >=4.5:1 -- a flat
    // black/white ink is the only choice available, and a few saturated mid-lightness names can't clear 4.5
    // against either one (a property of the color, not a bug). Detected by the same convention every swatch
    // cell in this app uses: an inline `--c:` custom property plus a `data-ink` attribute on self or an ancestor.
    const onSwatch = !!el.closest('[style*="--c:"][data-ink], [data-ink][style*="--c:"]') || !!el.closest("[data-ink]");
    // build a short, stable selector for the report (class chain, no nth-child noise unless needed)
    const sel = (() => {
      let s = el.tagName.toLowerCase();
      if (el.id) s += "#" + el.id;
      if (el.className && typeof el.className === "string") s += "." + el.className.trim().split(/\s+/).slice(0, 2).join(".");
      return s;
    })();
    const key = sel + "|" + own.slice(0, 30);
    if (seen.has(key)) continue;
    seen.add(key);
    const large = fontSize >= 24 || (fontSize >= 19 && weight >= 600);
    const flags = [];
    if (own.length > 2 && fontSize < 13) flags.push("too-small");
    if (onSwatch) { if (ratio != null && ratio < 3) flags.push("low-contrast-large"); }
    else if (!large && ratio != null && ratio < 4.5) flags.push("low-contrast");
    else if (large && ratio != null && ratio < 3) flags.push("low-contrast-large");
    if (italic && serif && fontSize < 17) flags.push("italic-serif-too-small");
    if (own.length > 40) {
      const lh = parseFloat(cs.lineHeight);
      if (!isNaN(lh) && fontSize > 0 && lh / fontSize < 1.4) flags.push("tight-line-height");
    }
    if (bg.imageNoScrim) flags.push("text-over-image-no-scrim");
    if (!flags.length) continue;   // only report nodes with at least one finding -- keeps the payload small
    results.push({ sel, text: own.slice(0, 40), fontSize, weight, italic, ratio, bg: bg.uncertain ? "uncertain" : bg.source, onSwatch, flags });
  }
  return { url: location.hash || "/", checked: all.length, findings: results };
};
