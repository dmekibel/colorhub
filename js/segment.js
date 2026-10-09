"use strict";
// AI object selection for "Look closer" (David, greenlit 2026-10-09 after a measured prototype: "AI
// segmentation... MobileSAM clears the bar") -- replaces the old SLIC "Region" tool (js/gallery.js's
// glRegionsFor/glPaintRegionMask/glRegionAt/glRegionSheet, tools/regions_build.py, data/regions/, all removed
// in this same change) with a real promptable object mask: tap the dress, the sky, the sleeve, and get THAT
// shape, not a precomputed color-region guess. MobileSAM (Apache-2.0, github.com/ChaoningZhang/MobileSAM),
// run entirely on-device via onnxruntime-web, vendored under models/ort/ (no CDN -- this is now core
// functionality, not a scratch prototype, and the app already has no build step or third-party runtime
// dependency anywhere else).
//
// Architecture (every number below is measured, not guessed -- a real prototype run on real painting crops,
// both native (onnxruntime-node, a lower bound) and in an actual browser via onnxruntime-web/WASM, reported
// 2026-10-09):
//  - Two ONNX graphs, split (the standard SAM/MobileSAM export shape): an IMAGE ENCODER
//    (models/mobilesam-encoder.onnx, 26.9MB) that runs ONCE per image (measured 2.7-3.4s single-thread WASM
//    on a modern laptop -- the slow step, shown with its own "Preparing this image" state) and a MASK DECODER
//    (models/mobilesam-decoder.onnx, quantized, 8.4MB) that runs once per point tap, REUSING the cached
//    encoder output (measured 125-157ms -- fast enough for live +/- refine on every tap).
//  - Both run inside one dedicated Worker (js/segment-worker.js) via onnxruntime-web, vendored at
//    models/ort/ (ort.min.js, 434KB + ort-wasm-simd-threaded.wasm, 10.5MB -- the one WASM binary the package
//    ships; there's no smaller single-thread variant). Single-thread WASM only: multi-thread needs
//    cross-origin isolation (COOP/COEP headers), which GitHub Pages does not serve by default, and WebGPU is
//    left as a documented follow-up rather than a half-verified code path -- these are the numbers above, for
//    real, not an untested "should be faster" guess.
//  - All four files (~46MB total first run) are fetched once with byte-level progress and written into the
//    Cache API (not relying on GitHub Pages' own HTTP cache headers, which this app doesn't control) under
//    SEG_CACHE_NAME, so every session after the first reads them straight from the cache with no network at
//    all. The Worker and its loaded sessions persist for the rest of this page session once warmed up, so
//    opening Select on a second painting skips straight to encoding -- no re-download, no re-init.
//  - CORS: the encoder needs real pixels (canvas getImageData), which throws on a cross-origin image unless
//    its host sends Access-Control-Allow-Origin. Checked for real against this corpus's actual hosts
//    (2026-10-09): Commons (upload.wikimedia.org, the museum's own self-reuse policy), api.nga.gov,
//    images.metmuseum.org and iiif.micr.io (Rijks/SMK's host) all send it; openaccess-cdn.clevelandart.org
//    (Cleveland Museum of Art) does not, and AIC/SMK's own local copies (img/gallery/aic|smk/*.jpg) are
//    same-origin so CORS never applies to them at all. Rather than hardcode that list (brittle -- a museum
//    can add the header later, or a new source can lack it), segProbe() finds out for real, once per host,
//    by actually trying a 1x1 canvas read and catching the SecurityError if the browser taints the canvas --
//    the same test the real encode would hit, just cheap. A host that fails gets Select disabled with an
//    honest note, never a silent dead button or a surprise failure mid-selection.
//  - The selected area's own palette reuses the exact pool shape and picking logic the rest of the app
//    already has (js/gallery.js glPoolByArea/glPoolDiverse/glStandOut, built for the precomputed region pools
//    and for the painting page's own dynamic palette) -- segPoolFromMask() builds a live {h,share}[] pool by
//    walking the same resized pixel buffer the encoder used (so no second full-resolution canvas read),
//    weighted by the mask's own soft alpha at each sampled pixel (a pixel right on the fading edge counts
//    partially, not as a hard in/out cut), quantized into coarse buckets and merged -- the client-side
//    analogue of tools/gallery.py's extract_pool, fast enough to run on every tap.

const SEG_CACHE_NAME = "colorhub-sam-v1";
const SEG_DIM = 1024;   // MobileSAM's expected long edge, same as the reference encoder export
// approximate byte sizes, used only to size the combined progress bar before a real Content-Length arrives
// (GitHub Pages always sends one for a static file, so this is a same-frame fallback, not a real estimate)
const SEG_FILES = [
  { key: "ort", url: "models/ort/ort.min.js", kind: "text", bytes: 433678, label: "Loading the selection tool" },
  { key: "wasm", url: "models/ort/ort-wasm-simd-threaded.wasm", kind: "buffer", bytes: 11018731, label: "Loading the selection tool" },
  { key: "encoder", url: "models/mobilesam-encoder.onnx", kind: "buffer", bytes: 28195125, label: "Downloading the selection tool" },
  { key: "decoder", url: "models/mobilesam-decoder.onnx", kind: "buffer", bytes: 8837301, label: "Downloading the selection tool" },
];
const SEG_TOTAL_MB = Math.round(SEG_FILES.reduce((a, f) => a + f.bytes, 0) / 1e6);

// ---------- CORS probe: can this host's pixels actually be read into a canvas? Cached per host for the
// session (a real probe costs one small image load, not worth repeating per painting). ----------
const SEG_HOST_OK = new Map();   // host -> Promise<boolean>
function segHostOf(url) { try { return new URL(url, location.href).host; } catch (e) { return ""; } }
function segProbe(src) {
  if (window.__segStub) return Promise.resolve(true);   // smoke test: tools/smoke/scenarios.js stubs the whole pipeline, never hits the network
  const host = segHostOf(src);
  if (SEG_HOST_OK.has(host)) return SEG_HOST_OK.get(host);
  const p = new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    const fail = () => resolve(false);
    img.onerror = fail;
    img.onload = () => {
      try {
        const cv = document.createElement("canvas"); cv.width = 1; cv.height = 1;
        cv.getContext("2d").drawImage(img, 0, 0, 1, 1);
        cv.getContext("2d").getImageData(0, 0, 1, 1);   // throws SecurityError on a tainted (no-CORS) canvas
        resolve(true);
      } catch (e) { resolve(false); }
    };
    img.src = src;
  });
  SEG_HOST_OK.set(host, p);
  return p;
}

// ---------- fetch + Cache API, with combined byte progress across all four files ----------
async function segFetchOne(url, onBytes) {
  const cache = await caches.open(SEG_CACHE_NAME);
  const cached = await cache.match(url);
  if (cached) { const buf = await cached.arrayBuffer(); onBytes(buf.byteLength, buf.byteLength); return buf; }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  const total = +res.headers.get("content-length") || 0;
  if (!res.body || !res.body.getReader) {
    const buf = await res.arrayBuffer(); onBytes(buf.byteLength, buf.byteLength || total);
    await cache.put(url, new Response(buf, { headers: res.headers })).catch(() => {});
    return buf;
  }
  const reader = res.body.getReader(), chunks = []; let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value); loaded += value.length; onBytes(loaded, total || loaded);
  }
  const buf = new Uint8Array(loaded); let o = 0;
  for (const c of chunks) { buf.set(c, o); o += c.length; }
  cache.put(url, new Response(buf, { headers: { "content-type": "application/octet-stream", "content-length": String(loaded) } })).catch(() => {});
  return buf.buffer;
}

let SEG_WORKER = null, SEG_READY = null, SEG_MSG_ID = 0;
const SEG_PENDING = new Map();   // msg id -> { resolve, reject }
function segRPC(type, data, transfer) {
  return new Promise((resolve, reject) => {
    const id = ++SEG_MSG_ID;
    SEG_PENDING.set(id, { resolve, reject });
    SEG_WORKER.postMessage(Object.assign({ id, type }, data), transfer || []);
  });
}
// Lazy, idempotent: the first call downloads+inits everything and every later call (this painting or the
// next one) returns the same resolved promise instantly -- "downloads once", a real promise, not a flag.
function segEnsureReady(onProgress) {
  if (SEG_READY) return SEG_READY;
  SEG_READY = (async () => {
    if (window.__segStub) return true;   // smoke test stub: see tools/smoke/scenarios.js
    const progress = new Map();
    const report = () => {
      let loaded = 0, total = 0, label = SEG_FILES[0].label;
      for (const f of SEG_FILES) { const p = progress.get(f.key) || { loaded: 0, total: f.bytes }; loaded += p.loaded; total += p.total || f.bytes; if (p.loaded < p.total && p.loaded > 0) label = f.label; }
      if (onProgress) onProgress(total ? loaded / total : 0, SEG_TOTAL_MB);
    };
    report();
    const results = {};
    await Promise.all(SEG_FILES.map(f => segFetchOne(f.url, (loaded, total) => { progress.set(f.key, { loaded, total }); report(); })
      .then(buf => { results[f.key] = buf; })));
    const ortText = new TextDecoder().decode(results.ort);
    const ortBlobUrl = URL.createObjectURL(new Blob([ortText], { type: "application/javascript" }));
    const wasmBlobUrl = URL.createObjectURL(new Blob([results.wasm], { type: "application/wasm" }));
    SEG_WORKER = new Worker("js/segment-worker.js");
    SEG_WORKER.onmessage = e => {
      const { id, ok, error } = e.data, p = SEG_PENDING.get(id); if (!p) return;
      SEG_PENDING.delete(id);
      if (ok) p.resolve(e.data); else p.reject(new Error(error || "segment worker error"));
    };
    SEG_WORKER.onerror = e => { for (const [, p] of SEG_PENDING) p.reject(e); SEG_PENDING.clear(); };
    await segRPC("init", { ortUrl: ortBlobUrl, wasmUrl: wasmBlobUrl, encoderBuf: results.encoder, decoderBuf: results.decoder }, [results.encoder, results.decoder]);
    return true;
  })().catch(e => { SEG_READY = null; throw e; });   // a failed first attempt (offline mid-download, etc.) can be retried, not stuck forever
  return SEG_READY;
}

// ---------- per-image state: the resized pixel buffer (reused for both the encoder input and the live
// palette's own pixel read) and which src it belongs to, so re-opening Select on the SAME image after
// switching tools skips straight back to decode -- no re-encode. ----------
let SEG_CUR = null;   // { src, rw, rh, origW, origH, pixels: Float32Array }
function segPixelsFor(img) {
  return new Promise((resolve, reject) => {
    const probe = new Image();
    probe.crossOrigin = "anonymous";
    probe.onerror = () => reject(new Error("image failed to load for selection"));
    probe.onload = () => {
      const origW = probe.naturalWidth, origH = probe.naturalHeight;
      const scale = SEG_DIM / Math.max(origW, origH), rw = Math.round(origW * scale), rh = Math.round(origH * scale);
      const cv = document.createElement("canvas"); cv.width = rw; cv.height = rh;
      const cx = cv.getContext("2d", { willReadFrequently: true });
      cx.drawImage(probe, 0, 0, rw, rh);
      let data;
      try { data = cx.getImageData(0, 0, rw, rh).data; } catch (e) { reject(e); return; }
      const pixels = new Float32Array(rw * rh * 3);
      for (let i = 0, j = 0; i < data.length; i += 4, j += 3) { pixels[j] = data[i]; pixels[j + 1] = data[i + 1]; pixels[j + 2] = data[i + 2]; }
      resolve({ rw, rh, origW, origH, pixels, canvas: cv, cx });
    };
    probe.src = img.src;
  });
}
// encode this image (once per image; re-entering Select on the same painting is free). onProgress gets a
// single indeterminate tick -- a WASM run has no incremental signal to report honestly, so this is a "working"
// state, never a fake percentage (ROADMAP's "no hype, no fake progress" rule applies to this UI as much as to
// any game's).
async function segEncode(img, onStart) {
  if (window.__segStub) {
    const origW = img.naturalWidth || 800, origH = img.naturalHeight || 1000;
    const scale = SEG_DIM / Math.max(origW, origH);
    const rw = Math.round(origW * scale), rh = Math.round(origH * scale);
    const cv = document.createElement("canvas"); cv.width = rw; cv.height = rh;
    const cx = cv.getContext("2d"); try { cx.drawImage(img, 0, 0, rw, rh); } catch (e) {}
    SEG_CUR = { src: img.src, rw, rh, origW, origH, cx, ms: 0 };
    return SEG_CUR;
  }
  if (SEG_CUR && SEG_CUR.src === img.src) return SEG_CUR;
  const { rw, rh, origW, origH, pixels, cx } = await segPixelsFor(img);
  if (onStart) onStart();
  const { ms } = await segRPC("encode", { pixels, w: rw, h: rh }, [pixels.buffer]);
  SEG_CUR = { src: img.src, rw, rh, origW, origH, cx, ms };
  return SEG_CUR;
}
// points: [{x,y,label}] in SEG_CUR's resized (rw x rh) pixel space, label 1 = "+" (add), 0 = "-" (remove)
async function segDecode(points) {
  if (!SEG_CUR) throw new Error("no image encoded");
  if (window.__segStub) {
    // a plausible synthetic mask for the smoke test, no network/model involved: a soft disc around the mean
    // of the "+" points, shrunk a bit by any "-" points -- enough for the rest of the UI (sheet, slider,
    // chip-tap-opens-color-page) to be genuinely exercised without downloading 46MB in a 10-second test run
    const mw = SEG_CUR.rw, mh = SEG_CUR.rh, mask = new Float32Array(mw * mh);
    const plus = points.filter(p => p.label === 1), minus = points.filter(p => p.label === 0);
    const cx = plus.reduce((a, p) => a + p.x, 0) / plus.length, cy = plus.reduce((a, p) => a + p.y, 0) / plus.length;
    const r = Math.min(mw, mh) * (0.28 - minus.length * 0.06);
    for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) {
      let d = Math.hypot(x - cx, y - cy);
      for (const m of minus) d = Math.max(d, r - Math.hypot(x - m.x, y - m.y) + r * .4);
      mask[y * mw + x] = r - d;
    }
    return { mask, mw, mh, iou: [0.9] };
  }
  const flat = [], labels = [];
  for (const p of points) { flat.push(p.x, p.y); labels.push(p.label); }
  // orig_im_size is deliberately the RESIZED (rw x rh) size, not the painting's true original pixel size: the
  // mask then comes back aligned 1:1 with the same pixel buffer segEncode already built (segPoolFromMask reads
  // it straight off that canvas), instead of a second full-resolution draw plus a coordinate remap
  const { mask, mw, mh, iou } = await segRPC("decode", { points: flat, labels, rw: SEG_CUR.rw, rh: SEG_CUR.rh }, []);
  return { mask, mw, mh, iou };
}

// a tap's fraction coords (eydMap's {fx,fy}, 0..1 each way) -> this image's own resized pixel space, or null
// if nothing has been encoded yet for this exact image (still downloading/encoding, or a different image)
function segPointForTap(src, fx, fy) {
  if (!SEG_CUR || SEG_CUR.src !== src) return null;
  return { x: fx * SEG_CUR.rw, y: fy * SEG_CUR.rh };
}

// ---------- soft mask paint, same look as the painting page's own Where/Region masks (glPaintMask /
// glPaintRegionMask): dim everywhere except the selection, smoothed so the raw logit field's own edge reads
// as a soft fade rather than a hard cut. ----------
function segPaintMask(cv, mask, mw, mh) {
  cv.width = mw; cv.height = mh;
  const x = cv.getContext("2d"), out = x.createImageData(mw, mh);
  for (let j = 0; j < mw * mh; j++) {
    const a = 1 / (1 + Math.exp(-mask[j] * .35));   // a smooth logistic fade around the model's own 0 boundary, not a hard >0 cut
    const o = j * 4; out.data[o] = 14; out.data[o + 1] = 13; out.data[o + 2] = 11; out.data[o + 3] = Math.round((1 - a) * 170);
  }
  x.putImageData(out, 0, 0);
}
// ---------- the selected area's own color pool: walk the same resized pixel buffer the encoder used,
// weighted by each pixel's mask alpha (soft, not a hard cut -- see segPaintMask), quantized into coarse RGB
// buckets and merged into up to 24 {h,share} entries -- the live analogue of tools/gallery.py's extract_pool,
// fast enough to run after every decode. ----------
function segPoolFromMask(mask, mw, mh) {
  // smoke test: a fixed, varied synthetic pool, never a real pixel read -- the stubbed segEncode draws the
  // displayed <img> onto SEG_CUR.cx without crossOrigin (it doesn't need pixels, only its own size), so that
  // canvas may well be cross-origin-tainted; segSheet only cares that this returns a plausible {h,share}[]
  if (window.__segStub) return [{ h: "#8B6F47", share: .34 }, { h: "#C9A876", share: .22 }, { h: "#4A5D3A", share: .18 }, { h: "#D4C4A8", share: .14 }, { h: "#2E2A24", share: .12 }];
  if (!SEG_CUR || !SEG_CUR.cx) return [];
  const data = SEG_CUR.cx.getImageData(0, 0, mw, mh).data;
  const BUCKET = 10;   // ~16^3 cells at this width -- coarse enough to merge near-duplicates, fine enough to keep real distinct families apart
  const buckets = new Map();   // "r,g,b" bucket key -> { r, g, b, n, w }
  let totalW = 0;
  const step = mw * mh > 500000 ? 2 : 1;   // stride-sample on a big image; 1024-long-edge images rarely need it
  for (let y = 0; y < mh; y += step) for (let x = 0; x < mw; x += step) {
    const j = y * mw + x, a = 1 / (1 + Math.exp(-mask[j] * .35));
    if (a < .12) continue;   // well outside the selection -- not worth a bucket slot
    const o = j * 4, r = data[o], g = data[o + 1], b = data[o + 2];
    const key = `${(r / BUCKET) | 0},${(g / BUCKET) | 0},${(b / BUCKET) | 0}`;
    let e = buckets.get(key); if (!e) { e = { r: 0, g: 0, b: 0, n: 0, w: 0 }; buckets.set(key, e); }
    e.r += r * a; e.g += g * a; e.b += b * a; e.n += a; e.w += a; totalW += a;
  }
  if (!totalW) return [];
  const hex = n => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  const pool = Array.from(buckets.values()).sort((p, q) => q.w - p.w).slice(0, 24)
    .map(e => ({ h: "#" + (hex(e.r / e.n) + hex(e.g / e.n) + hex(e.b / e.n)).toUpperCase(), share: e.w / totalW }));
  const tot = pool.reduce((a, p) => a + p.share, 0) || 1;
  return pool.map(p => ({ h: p.h, share: p.share / tot }));
}

// ---------- the selection's own palette sheet: the same compact strip + mode switcher + slider as the old
// region sheet (js/gallery.js's glRegionSheet, which this replaces), reusing its exact CSS (.rgs-sheet,
// .gl-pal-ui, .gl-strip) and the same pool-picking functions (glPoolByArea/glPoolDiverse/glStandOut), just
// fed a live pool instead of a precomputed one, and honestly labeled "Selected area" rather than borrowing
// the old region sheet's "This area" (a plain color-boundary guess) -- this one really is the object you
// pointed at. ----------
function segSheet(pool, onClose) {
  let curK = Math.min(6, pool.length), mode = "area", kCtl = null;
  const flatPrior = new Array(13).fill(0);
  const modeSet = (m, k) => {
    if (m === "area") return { pal: glPoolByArea(pool, k) };
    if (m === "diverse") return { pal: glPoolDiverse(pool, k) };
    if (m === "out") return { pal: glStandOut(pool, k, flatPrior) };
    return null;
  };
  const curSet = () => modeSet(mode, Math.min(curK, pool.length)) || modeSet("area", curK);
  const { sh, close } = sheet(`
    <div class="rgs-head"><b>Selected area</b><span>AI selection, not a color-boundary guess</span></div>
    <div class="seg rgs-modes" role="group" aria-label="Palette type">
      <button data-rgm="area" aria-pressed="true">By area</button>
      <button data-rgm="diverse" aria-pressed="false">Diverse</button>
      <button data-rgm="out" aria-pressed="false">Stands out</button>
    </div>
    <div class="pr-slide gl-slide rgs-slide" data-rgslide hidden><input type="range" data-rgk aria-label="How many colors"><span class="gl-kn-t" data-rgkn></span></div>
    <div class="palette gl-strip" data-rgswatches></div>
    <div class="pal-names" data-rgrows></div>
    <p class="fine">Read from this painting's photograph, just inside the shape you selected. Screen colors are approximate.</p>
  `, { lock: false });
  sh.classList.add("rgs-sheet", "gl-pal-ui");
  const draw = () => {
    const set = curSet(), pal = set.pal || [];
    sh.querySelectorAll("[data-rgm]").forEach(b => { const on = b.dataset.rgm === mode; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); });
    const slide = sh.querySelector("[data-rgslide]"), inp = slide.querySelector("input"), max = Math.max(2, Math.min(pool.length, 8)), kk = Math.min(Math.max(curK, 2), max);
    slide.hidden = pool.length <= 2;
    if (!slide.hidden) {
      if (!kCtl) kCtl = countify(inp, { min: 2, max, value: kk, out: sh.querySelector("[data-rgkn]"), onSet: (v, final) => { curK = v; draw(); if (final) buzz(5); } });
      else { kCtl.range(2, max); kCtl.set(kk); }
    }
    sh.querySelector("[data-rgkn]").textContent = kk + " colors";
    sh.querySelector("[data-rgswatches]").innerHTML = pal.map(p => `<button class="pal" data-swatch="${p.h}" style="--c:${p.h};flex:${(Math.max(p.share, .08) * 100).toFixed(1)}" data-ink="${ink(p.h)}" aria-label="${esc(nameOf(p.h).n)}"><span>${p.share < .005 ? "<1%" : Math.round(p.share * 100) + "%"}</span></button>`).join("");
    sh.querySelector("[data-rgrows]").innerHTML = pal.map(p => {
      const nm = glName(p.h), fam = !nm.sub && typeof familyOf === "function" && familyOf(p.h);
      const sub = [nm.sub ? nm.sub.charAt(0).toUpperCase() + nm.sub.slice(1) : fam ? fam.head.n + " family" : "", glPctTxt(p.share)].filter(Boolean).join(" · ");
      return `<button class="pal-name" data-swatch="${p.h}"><i style="--c:${p.h}" data-ink="${ink(p.h)}"></i><b>${esc(nm.t)}</b><span>${esc(sub)}</span><em class="mono">${p.h}</em></button>`;
    }).join("");
  };
  sh.querySelector(".rgs-modes").onclick = e => { const b = e.target.closest("[data-rgm]"); if (!b || b.dataset.rgm === mode) return; mode = b.dataset.rgm; buzz(5); draw(); };
  draw();
  if (onClose) {
    const mo = new MutationObserver(() => { if (!sh.isConnected) { mo.disconnect(); onClose(); } });
    mo.observe(document.body, { childList: true });
  }
  return close;
}
