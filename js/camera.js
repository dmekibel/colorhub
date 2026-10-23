"use strict";
// The color eye: point the camera at anything and it names the color under a circle you move around, live, from
// the ~1,000 core names, with the next-nearest name underneath. The shutter takes a real photo and opens it in
// Studio, where it can be analyzed (Eyedropper, Select a part: js/studio.js). Cameras shift color, so the copy
// says so plainly.
//
// Sampling: eyeSample() below reads an n x n square (n = getSampleSize(), js/eyedrop.js: Point through 31x31,
// default a medium average) straight off the SOURCE's native resolution -- the <video> or <img> element itself,
// never a canvas that was resized to fit the screen. Live, that's ~12 times a second; only the NAME shown eases
// between readings (Lab-smoothed), never the sampled color or hex, so flicker can't swap in a slightly-wrong swatch.
//
// Optional white balance: tap WB, then something white or grey; readings are then corrected by von Kries
// scaling (wbFrom in js/accuracy.js). That reference sampling keeps isoSample's bigger, noise-averaged patch.
// Lock asks the camera hardware itself to hold exposure and white balance steady (MediaStreamTrack.
// applyConstraints), where the device allows it; it's hidden when the camera reports no such capability.

// ---------- exact-pixel sampling (n x n, n = getSampleSize() at the call site), always off the source's native
// resolution, never the display-sized copy ----------
let EYE_PROBE = null;
function eyeSample(src, w, h, fx, fy, n = 2) {
  if (!src || !w || !h) return null;
  if (!EYE_PROBE) { const c = document.createElement("canvas"); c.width = c.height = n; EYE_PROBE = c.getContext("2d", { willReadFrequently: true }); }
  if (EYE_PROBE.canvas.width !== n) { EYE_PROBE.canvas.width = n; EYE_PROBE.canvas.height = n; }
  const x = clamp(Math.round(fx * w) - (n >> 1), 0, Math.max(0, w - n)), y = clamp(Math.round(fy * h) - (n >> 1), 0, Math.max(0, h - n));
  try { EYE_PROBE.clearRect(0, 0, n, n); EYE_PROBE.drawImage(src, x, y, n, n, 0, 0, n, n); }
  catch (e) { return null; }
  const d = EYE_PROBE.getImageData(0, 0, n, n).data;
  let r = 0, g = 0, b = 0; const m = d.length / 4;
  for (let p = 0; p < d.length; p += 4) { r += lin8(d[p]); g += lin8(d[p + 1]); b += lin8(d[p + 2]); }
  return ("#" + isoEncode(r / m) + isoEncode(g / m) + isoEncode(b / m)).toUpperCase();
}

const ICON_PHOTO = sv('<rect x="3" y="5" width="18" height="14" rx="2.5"/><circle cx="9" cy="10" r="1.8"/><path d="M21 16l-5.5-5.5L6 19"/>', 22, 1.8);
const ICON_LOCK = sv('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>', 20, 1.8);

// ---------- Select a part (David, 2026-10-09; now used by the photo page, js/studio.js, 2026-10-23): segment
// the object the person tapped, so "what color is the dress" has an answer: the shades that really exist inside it.
//
// 1. Segment: region-growing flood fill from the seed pixel, over a ~480px-long-edge downscale of the native
//    photo (never the on-screen display copy), using an adaptive CIELAB tolerance against the region's running
//    mean AND the immediate neighbor pixel -- so folds and shadows of the same fabric keep joining while a
//    skin or background edge stops it -- tightened near a Sobel edge on L* so a real boundary stops it even
//    when the color gap alone wouldn't. Typed arrays + an explicit stack keep this comfortably under budget.
// 2. Cluster: k-means in Lab (seeded to spread across the real shades) at a high k, every masked pixel assigned
//    to its nearest centroid, then agglomerative merging by CIEDE2000 into one dendrogram. Cutting that same
//    dendrogram at any k (segCutAssign) is then just a union-find replay -- instant, so a "how many shades"
//    slider never recomputes k-means. segMaxDistinct finds the natural ceiling: the largest k whose pairwise
//    gaps are all at least ~2 ΔE (anything closer is a k-means artifact, not a second shade).
const EYE_SEG_MAX = 480;
let SEG_CANVAS = null, SEG_CTX = null;
function segCanvas(src, w, h) {
  const k = Math.min(1, EYE_SEG_MAX / Math.max(w, h)), sw = Math.max(1, Math.round(w * k)), sh = Math.max(1, Math.round(h * k));
  if (!SEG_CANVAS) { SEG_CANVAS = document.createElement("canvas"); SEG_CTX = SEG_CANVAS.getContext("2d", { willReadFrequently: true }); }
  if (SEG_CANVAS.width !== sw || SEG_CANVAS.height !== sh) { SEG_CANVAS.width = sw; SEG_CANVAS.height = sh; }
  SEG_CTX.clearRect(0, 0, sw, sh); SEG_CTX.drawImage(src, 0, 0, sw, sh);
  return { sw, sh, k, data: SEG_CTX.getImageData(0, 0, sw, sh).data };
}
// Lab for every downscaled pixel, plus a Sobel edge magnitude on L* (built once per freeze or tolerance change)
function segPrep(src, w, h) {
  const { sw, sh, k, data } = segCanvas(src, w, h), n = sw * sh;
  const L = new Float32Array(n), A = new Float32Array(n), B = new Float32Array(n);
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    const r = data[p] / 255, g = data[p + 1] / 255, b = data[p + 2] / 255;
    const lr = r > .04045 ? ((r + .055) / 1.055) ** 2.4 : r / 12.92, lg = g > .04045 ? ((g + .055) / 1.055) ** 2.4 : g / 12.92, lb = b > .04045 ? ((b + .055) / 1.055) ** 2.4 : b / 12.92;
    let x = (lr * .4124 + lg * .3576 + lb * .1805) / .95047, y = lr * .2126 + lg * .7152 + lb * .0722, z = (lr * .0193 + lg * .1192 + lb * .9505) / 1.08883;
    const f = t => t > .008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
    x = f(x); y = f(y); z = f(z);
    L[i] = 116 * y - 16; A[i] = 500 * (x - y); B[i] = 200 * (y - z);
  }
  const E = new Float32Array(n);
  for (let yy = 1; yy < sh - 1; yy++) for (let xx = 1; xx < sw - 1; xx++) {
    const i = yy * sw + xx;
    const gx = (L[i - sw - 1] + 2 * L[i - 1] + L[i + sw - 1]) - (L[i - sw + 1] + 2 * L[i + 1] + L[i + sw + 1]);
    const gy = (L[i - sw - 1] + 2 * L[i - sw] + L[i - sw + 1]) - (L[i + sw - 1] + 2 * L[i + sw] + L[i + sw + 1]);
    E[i] = Math.min(1, Math.hypot(gx, gy) / 180);
  }
  return { sw, sh, k, L, A, B, E };
}
const segDe = (L, A, B, i, l, a, b) => { const dl = L[i] - l, da = A[i] - a, db = B[i] - b; return Math.sqrt(dl * dl + da * da + db * db); };
// region-growing flood fill from a seed fraction (fx,fy); tolMult scales the base tolerance ("tighter <-> wider")
function segGrow(prep, fx, fy, tolMult = 1) {
  const { sw, sh, L, A, B, E } = prep, n = sw * sh;
  const sx = clamp(Math.round(fx * sw), 0, sw - 1), sy = clamp(Math.round(fy * sh), 0, sh - 1), s0 = sy * sw + sx;
  const mask = new Uint8Array(n), stack = new Int32Array(n); let sp = 0;
  const baseTol = 9 * tolMult, nbTol = 6 * tolMult;
  let mL = L[s0], mA = A[s0], mB = B[s0], count = 1;
  mask[s0] = 1; stack[sp++] = s0;
  while (sp) {
    const i = stack[--sp], xx = i % sw, yy = (i / sw) | 0, edge = E[i];
    const tol = baseTol * (1 - .55 * edge), ntol = nbTol * (1 - .55 * edge);
    const cand = [];
    if (xx > 0) cand.push(i - 1); if (xx < sw - 1) cand.push(i + 1);
    if (yy > 0) cand.push(i - sw); if (yy < sh - 1) cand.push(i + sw);
    for (const j of cand) {
      if (mask[j]) continue;
      if (segDe(L, A, B, j, mL, mA, mB) <= tol && segDe(L, A, B, j, L[i], A[i], B[i]) <= ntol) {
        mask[j] = 1; stack[sp++] = j; count++;
        mL += (L[j] - mL) / count; mA += (A[j] - mA) / count; mB += (B[j] - mB) / count;
      }
    }
  }
  return { mask, sw, sh, k: prep.k, count, mean: [mL, mA, mB] };
}
// k-means in Lab over the region's pixels (sampled for speed above a cap; every masked pixel still gets assigned
// to its nearest finished centroid, so shares reflect the whole region). Returns { idx, assign, clusters }: idx
// and assign are parallel arrays over EVERY masked pixel (idx[s] is the pixel index, assign[s] its cluster).
function segKmeans(prep, grow, k) {
  const { mask } = grow, { L, A, B } = prep, idx = [];
  for (let i = 0; i < mask.length; i++) if (mask[i]) idx.push(i);
  if (!idx.length) return { idx: [], assign: [], clusters: [] };
  const CAP = 6000, sample = idx.length > CAP ? shuffle(idx).slice(0, CAP) : idx;
  k = Math.max(1, Math.min(k, sample.length));
  const cen = [sample[Math.floor(Math.random() * sample.length)]];
  while (cen.length < k) {
    let best = sample[0], bd = -1;
    for (const i of sample) {
      let d = Infinity;
      for (const c of cen) { const dd = segDe(L, A, B, i, L[c], A[c], B[c]); if (dd < d) d = dd; }
      if (d > bd) { bd = d; best = i; }
    }
    cen.push(best);
  }
  let centroids = cen.map(i => [L[i], A[i], B[i]]);
  const assignSample = new Int32Array(sample.length);
  for (let it = 0; it < 6; it++) {
    for (let s = 0; s < sample.length; s++) {
      const i = sample[s]; let bi = 0, bd = Infinity;
      for (let c = 0; c < centroids.length; c++) { const [l, a, b] = centroids[c], dd = segDe(L, A, B, i, l, a, b); if (dd < bd) { bd = dd; bi = c; } }
      assignSample[s] = bi;
    }
    const sums = centroids.map(() => [0, 0, 0, 0]);
    for (let s = 0; s < sample.length; s++) { const i = sample[s], g = sums[assignSample[s]]; g[0] += L[i]; g[1] += A[i]; g[2] += B[i]; g[3]++; }
    centroids = sums.map((g, c) => g[3] ? [g[0] / g[3], g[1] / g[3], g[2] / g[3]] : centroids[c]);
  }
  const assign = new Int32Array(idx.length);
  for (let s = 0; s < idx.length; s++) {
    const i = idx[s]; let bi = 0, bd = Infinity;
    for (let c = 0; c < centroids.length; c++) { const [l, a, b] = centroids[c], dd = segDe(L, A, B, i, l, a, b); if (dd < bd) { bd = dd; bi = c; } }
    assign[s] = bi;
  }
  const clusters = centroids.map(c => ({ lab: c, count: 0 }));
  for (let s = 0; s < assign.length; s++) clusters[assign[s]].count++;
  return { idx, assign, clusters };
}
// agglomerative merge of the k-means clusters by CIEDE2000, one dendrogram; segCutAssign/segMaxDistinct below
// read it without ever re-running k-means. de2000 (js/core.js) takes Lab arrays directly.
function segDendrogram(clusters) {
  const n = clusters.length;
  const nodes = clusters.map(c => ({ lab: c.lab, count: Math.max(1, c.count) }));
  const merges = [];
  let alive = nodes.map((_, i) => i);
  while (alive.length > 1) {
    let bi = 0, bj = 1, bd = Infinity;
    for (let x = 0; x < alive.length; x++) for (let y = x + 1; y < alive.length; y++) {
      const d = de2000(nodes[alive[x]].lab, nodes[alive[y]].lab);
      if (d < bd) { bd = d; bi = x; bj = y; }
    }
    const ai = alive[bi], aj = alive[bj], a = nodes[ai], b = nodes[aj], w = a.count + b.count;
    const lab = [0, 1, 2].map(k => (a.lab[k] * a.count + b.lab[k] * b.count) / w);
    nodes.push({ lab, count: w });
    const into = nodes.length - 1;
    merges.push({ de: bd, left: ai, right: aj, into });
    alive = alive.filter((_, x) => x !== bi && x !== bj); alive.push(into);
  }
  return { nodes, merges, n };
}
// the dendrogram cut at k clusters: a union-find replay of the first (n-k) merges, then every original k-means
// cluster's final group (lab = the pixel-count-weighted mean of its original centroids, count = total pixels)
function segCutAssign(dendro, k) {
  const { nodes, merges, n } = dendro;
  const parent = Array.from({ length: nodes.length }, (_, i) => i);
  const find = x => parent[x] === x ? x : (parent[x] = find(parent[x]));
  const steps = Math.max(0, Math.min(merges.length, n - Math.max(1, k)));
  for (let s = 0; s < steps; s++) { const m = merges[s]; parent[find(m.left)] = find(m.into); parent[find(m.right)] = find(m.into); }
  const rootOf = new Array(n);
  for (let i = 0; i < n; i++) rootOf[i] = find(i);
  return { rootOf };
}
// the largest k whose pairwise gaps are all >= ~2 ΔE (clusters closer than that are a k-means artifact, not a
// second real shade): walk the merge order (ascending ΔE by construction) and stop at the first gap that clears it.
function segMaxDistinct(dendro) {
  const { merges, n } = dendro;
  for (let s = 0; s < merges.length; s++) if (merges[s].de >= 2) return Math.max(2, n - s);
  return Math.max(2, n - merges.length);
}
// the shades at k clusters, biggest share first: { hex, name, de (vs. its nearest of ~1,000 names), share, pix }.
// pix (downscaled pixel indices) lets the sheet highlight exactly where a shade sits in the frozen photo.
function segShades(prep, km, dendro, k) {
  if (!km.idx.length) return [];
  const { rootOf } = segCutAssign(dendro, k);
  const order = [], groups = new Map();
  for (let s = 0; s < km.idx.length; s++) {
    const root = rootOf[km.assign[s]];
    if (!groups.has(root)) { groups.set(root, { count: 0, pix: [] }); order.push(root); }
    const g = groups.get(root); g.count++; g.pix.push(km.idx[s]);
  }
  const total = km.idx.length;
  return order.map(root => {
    const g = groups.get(root);
    let L = 0, A = 0, B = 0;
    for (const i of g.pix) { L += prep.L[i]; A += prep.A[i]; B += prep.B[i]; }
    L /= g.count; A /= g.count; B /= g.count;
    const hex = labHex(L, A, B), nm = nameOf(hex);
    return { hex, name: nm.text, de: nm.de, share: g.count / total, pix: g.pix };
  }).sort((a, b) => b.share - a.share);
}
// a dim-everywhere-but-this overlay, drawn tiny (the prep's own downscale) then stretched: the upscale blur is
// exactly the "soft outline" the region view wants, for free. keepIdx: the pixel indices to leave lit (the
// whole grown region, or just one shade's pix, for "highlight where it sits in the region").
function segOverlay(prep, keepIdx) {
  const { sw, sh } = prep, n = sw * sh, c = document.createElement("canvas"); c.width = sw; c.height = sh;
  const x = c.getContext("2d"), id = x.createImageData(sw, sh), d = id.data, keep = new Uint8Array(n);
  (keepIdx || []).forEach(i => keep[i] = 1);
  for (let i = 0; i < n; i++) { const p = i * 4; d[p] = 0; d[p + 1] = 0; d[p + 2] = 0; d[p + 3] = keep[i] ? 0 : 150; }
  x.putImageData(id, 0, 0);
  return c;
}

// Camera failures, explained (David, 2026-10-09: "the video feature is confusing" -- a flat "no camera here"
// hid the actual, fixable reason). iOS Home Screen apps have had camera access since iOS 16.4; an older iOS
// (or a camera simply blocked for Safari/this app) needs the Settings fix this spells out.
function eyeOffReason(e) {
  const ios = typeof isIOS === "function" && isIOS(), standalone_ = typeof standalone === "function" && standalone();
  const insecure = location.protocol !== "https:" && location.hostname !== "localhost" && location.hostname !== "127.0.0.1";
  if (insecure) return { head: "This page isn't secure", fix: "The camera only works on https:// (or localhost). Open Chromatlas over a secure link, then try again." };
  if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== "function") {
    if (ios && standalone_) return { head: "This iPhone can't open the camera here", fix: "Home Screen apps got camera access in iOS 16.4. Update iOS, or open Chromatlas in Safari instead of from the Home Screen icon." };
    return { head: "This browser can't open a camera", fix: "Try Safari or Chrome, or name the colors in a photo instead." };
  }
  const name = e && e.name;
  if (name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError") {
    return { head: "Camera access is off", fix: ios
      ? (standalone_ ? "Open Settings > Chromatlas (or Safari) > Camera and turn it on, then come back and try again." : "Open Settings > Safari > Camera (or tap the camera icon by the address bar) and allow it, then try again.")
      : "Allow camera access for this site -- usually the camera or lock icon by the address bar -- then try again." };
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") return { head: "No camera here", fix: "This device doesn't have a camera Chromatlas can use." };
  if (name === "NotReadableError" || name === "TrackStartError") return { head: "The camera's busy", fix: "Another app may be using it right now. Close it and try again." };
  return { head: "No camera here", fix: "" };
}

// opts: { pick, multi, onPick(hex,meta), onDone(hexes), title, forcePhoto }.
// Plain eye() (no opts) is the Train > Your eye camera screen. Pick mode (cameraPick) swaps "Add color" for the
// caller's own "Use" (single) or "Add" + a running strip + "Done" (multi), and has no shutter.
//
// David, 2026-10-23: the old camera froze one frame and left you stuck in it with a single pixel. Now the camera
// stays live and does two separate jobs. (1) The eyedropper: a circle you drag around the live view, reading the
// AVERAGE of a small square under it by default (Point, Tiny, Small, Medium or Wide: the same sample size the
// loupe uses elsewhere), with "Add color" building a palette strip as you go. (2) The shutter: takes a real photo,
// saves it to Studio and opens its page (js/photos.js), where Eyedropper and Select a part (js/studio.js) analyze it.
const ICON_ADD = sv('<path d="M12 5v14M5 12h14"/>', 24, 2);
const EYE_WORDS = { 1: "Point", 3: "Tiny", 5: "Small", 11: "Medium", 31: "Wide" };
const eyeSizeHTML = () => `<div class="eye-size" role="group" aria-label="How many pixels to average under the circle">${EYD_SIZES.map(n => `<button type="button" data-eydsize="${n}" aria-pressed="${n === getSampleSize()}" class="${n === getSampleSize() ? "on" : ""}">${EYE_WORDS[n]}</button>`).join("")}</div><p class="eye-size-cap" id="sizeCap"></p>`;
const eyeSizeCap = () => { const n = getSampleSize(); return n === 1 ? "Reads one pixel" : `Averages ${n} × ${n} pixels`; };
// David, 2026-10-23 (second pass: "still hard to use and overwhelming"): the live screen is now just the picture, the
// circle, one line saying what it is, and three buttons -- Photos, the shutter, Add. Everything else (how much to
// average, white balance, the exposure lock, the "close read" caveat) lives behind the ⋯ button, one sheet.
function eye(opts = {}) {
  const el = show(`
    <div class="eye-stage" id="stage">
      <video id="vid" playsinline muted autoplay></video>
      <i class="eye-ret" id="ret"><b class="eye-ret-h"></b><b class="eye-ret-v"></b></i>
      <i class="eye-flash" id="flash"></i>
    </div>
    <header class="eye-top"><button class="icon-btn glass" data-back aria-label="Back">${ICON.back}</button><span class="eye-hint" id="hint" hidden><span id="hintText"></span></span><button class="icon-btn glass" id="more" aria-label="Camera settings: how much to read, white balance">${ICON.more}</button></header>
    <div class="eye-card" id="card">
      <button class="eye-read" id="nm"><i id="chip"></i><span><b id="big">Looking…</b><em class="mono" id="hexline"></em></span>${ICON.chev}</button>
      <div class="eye-picks" id="picks" hidden></div>
      <div class="eye-bar">
        <label class="eye-side" aria-label="Choose a photo">${ICON_PHOTO}<input type="file" accept="image/*" id="file" hidden></label>
        <button class="eye-shut" id="shut" aria-label="Take a photo"><i></i></button>
        <button class="eye-side eye-add" id="add" aria-label="Add this color">${ICON_ADD}</button>
      </div>
    </div>
    <div class="eye-off" id="off" hidden>
      <p class="eyebrow" id="offEyebrow">No camera here</p>
      <h2 id="offHead">Name the colors in a <em>photo</em> instead.</h2>
      <p class="eye-off-fix" id="offFix" hidden></p>
      <label class="btn">Choose a photo<input type="file" accept="image/*" id="file2" hidden></label>
    </div>
  `, "fixed eye");
  const $ = s => el.querySelector(s);
  const PICK = opts.pick ? { multi: !!opts.multi, list: [], onPick: opts.onPick, onDone: opts.onDone } : null;
  const list = PICK ? PICK.list : [];
  if (PICK) { $("#shut").hidden = true; if (!PICK.multi) { $("#add").innerHTML = ICON.check || ICON_ADD; $("#add").setAttribute("aria-label", "Use this color"); } }
  const vid = $("#vid"), ret = $("#ret"), stage = $("#stage");
  let stream = null, track = null, raf = 0, cur = null, smooth = null, last = 0, at = [.5, .4], wb = null, wbArm = false, hwLocked = false, drag = null, lockable = false;
  const read = hex => wb ? wb(hex) : hex;
  const stop = () => { cancelAnimationFrame(raf); if (stream) stream.getTracks().forEach(t => t.stop()); stream = null; track = null; };
  cleanup.push(stop);
  // pick mode's own onDone often navigates on its own (settray's finish() opens the set page) -- calling go()
  // unconditionally right after would stomp on that. show() moves the OLD screen into a fading ghost, so
  // el.isConnected stays true after a real navigation; app.contains(el) is what tells "did this screen leave".
  const leaveAfter = fn => { fn(); if (app.contains(el)) go(S.tab || "explore"); };
  $("[data-back]").onclick = () => { stop(); leaveAfter(() => PICK && PICK.onDone && PICK.onDone(list.slice())); };
  loadCoreNames();
  // a short instruction only when there is one to give (white balance armed, or a caller's own title)
  const hint = () => { const t = wbArm ? "Tap something white or grey" : (opts.title || ""); $("#hint").hidden = !t; $("#hintText").textContent = t; };
  hint();

  // the stage fraction (0..1 on screen) -> the video's own fraction, through the exact cover-crop the screen draws
  const geom = () => { const R = stage.getBoundingClientRect(), w = vid.videoWidth, h = vid.videoHeight, k = Math.max(R.width / w, R.height / h); return { R, w, h, k, ox: (R.width - w * k) / 2, oy: (R.height - h * k) / 2 }; };
  const toNative = (sfx, sfy) => { const g = geom(); return [clamp((sfx * g.R.width - g.ox) / g.k / g.w, 0, 1), clamp((sfy * g.R.height - g.oy) / g.k / g.h, 0, 1)]; };
  // keep the circle out from under the bottom card (or the side rail in landscape): where it can't be seen it can't be aimed
  const bound = a2 => {
    const R = stage.getBoundingClientRect(), C = $("#card").getBoundingClientRect(), side = C.width < R.width * .8;
    const x = side ? (C.left - R.left - 34) / R.width : .98, y = side ? .98 : (C.top - R.top - 34) / R.height;
    return [clamp(a2[0], .02, Math.max(.05, x)), clamp(a2[1], .02, Math.max(.05, y))];
  };
  const placeRet = instant => { ret.style.transition = instant ? "none" : ""; ret.style.left = at[0] * 100 + "%"; ret.style.top = at[1] * 100 + "%"; };
  placeRet(true);

  let lastName = "";
  const paint = (hex, nameHex) => {
    if (!hex) return;
    const nm = nameOf(nameHex || hex);
    cur = { hex, nm };
    ret.style.setProperty("--c", hex); $("#chip").style.setProperty("--c", hex);
    $("#big").textContent = nm.text;
    $("#hexline").textContent = hex;
    if (nm.text !== lastName) { if (lastName) buzz(3); lastName = nm.text; }   // a light tick each time the name changes, so aiming can be felt
  };
  // the swatch and hex always show the RAW reading; only the name eases between readings (a Lab-smoothed point
  // feeds nameOf), so sensor noise can't flicker the name every frame without touching the sampled color itself
  const sampleNow = (ease = true) => {
    if (!vid.videoWidth) return;
    const [fx, fy] = toNative(at[0], at[1]);
    const hex = read(eyeSample(vid, vid.videoWidth, vid.videoHeight, fx, fy, getSampleSize()));
    if (!hex) return;
    const L = lab(hex);
    smooth = smooth && ease ? smooth.map((x, i) => x + (L[i] - x) * .45) : L;
    paint(hex, labHex(...smooth));
  };
  const tick = t => {
    raf = requestAnimationFrame(tick);
    if (!vid.videoWidth || t - last < 80) return;
    last = t; sampleNow();
  };

  // white balance: the next tap picks the reference, read with isoSample's bigger, noise-averaged patch
  const setWb = f => { wb = f; smooth = null; };
  const lockMode = (modes, want) => modes && modes.includes(want) ? want : null;
  const toggleLock = async () => {
    if (!track || typeof track.getCapabilities !== "function") return;
    const cap = track.getCapabilities(), next = !hwLocked, adv = [];
    const em = lockMode(cap.exposureMode, next ? "manual" : "continuous"), wm = lockMode(cap.whiteBalanceMode, next ? "manual" : "continuous");
    if (!em && !wm) { toast("This camera won't lock exposure or white balance"); return; }
    if (em) adv.push({ exposureMode: em });
    if (wm) adv.push({ whiteBalanceMode: wm });
    try { await track.applyConstraints({ advanced: adv }); hwLocked = next; toast(hwLocked ? "Exposure and white balance locked" : "Back to auto"); buzz(8); }
    catch (e) { toast("Couldn't lock this camera"); }
  };
  // ⋯: every setting in one place, so the live screen stays clear
  $("#more").onclick = () => {
    const { sh, close } = sheet(`<div class="mn-confirm eye-sheet">${mnHead("Camera")}
      <p class="eye-sh-h">How much to read under the circle</p>${eyeSizeHTML()}
      <p class="eye-sh-h">If the colors look off</p>
      <div class="eye-sh-acts"><button class="pv-pill${wb ? " on" : ""}" data-wb>${wb ? "White balance on · turn off" : "Set white balance"}</button>${lockable ? `<button class="pv-pill${hwLocked ? " on" : ""}" data-lock>${hwLocked ? "Locked · unlock" : "Lock exposure"}</button>` : ""}</div>
      <p class="mn-body eye-sh-note">Phones adjust color on their own, so this is a close read, not a lab measurement.</p></div>`);
    const sync = () => { sh.querySelector("#sizeCap").textContent = eyeSizeCap(); sh.querySelectorAll("[data-eydsize]").forEach(b => { const on = +b.dataset.eydsize === getSampleSize(); b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); }); };
    sync();
    sh.addEventListener("click", e => {
      const sz = e.target.closest("[data-eydsize]");
      if (sz) { setSampleSize(+sz.dataset.eydsize); buzz(6); sync(); sampleNow(false); return; }
      if (e.target.closest("[data-wb]")) { close(); if (wb) { setWb(null); toast("White balance off"); } else { wbArm = true; hint(); } return; }
      if (e.target.closest("[data-lock]")) { close(); toggleLock(); }
    });
  };

  // the circle: a tap puts it there, a drag moves it by how far the finger moved (so the finger never covers it)
  stage.addEventListener("pointerdown", e => {
    if (!e.isPrimary) return;
    if (wbArm) {
      const R = stage.getBoundingClientRect(), [fx, fy] = toNative((e.clientX - R.left) / R.width, (e.clientY - R.top) / R.height);
      const ref = vid.videoWidth ? isoSample(vid, fx, fy) : null, f = ref && wbFrom(ref);
      wbArm = false; hint();
      if (f) { setWb(f); toast("White set"); sampleNow(false); } else toast("Too dark or too colorful. Try white or grey");
      buzz(5); return;
    }
    drag = { x: e.clientX, y: e.clientY, at0: at.slice(), moved: false };
    try { stage.setPointerCapture(e.pointerId); } catch (err) {}
  });
  stage.addEventListener("pointermove", e => {
    if (!drag || !e.isPrimary) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) > 6) drag.moved = true;
    if (!drag.moved) return;
    const R = stage.getBoundingClientRect();
    at = bound([drag.at0[0] + dx / R.width, drag.at0[1] + dy / R.height]);
    placeRet(true); sampleNow(false);
  });
  const endDrag = e => {
    if (!drag) return;
    if (!drag.moved && e.type === "pointerup") {
      const R = stage.getBoundingClientRect();
      at = bound([(e.clientX - R.left) / R.width, (e.clientY - R.top) / R.height]);
      placeRet(false); sampleNow(false); buzz(5);
    }
    drag = null;
  };
  stage.addEventListener("pointerup", endDrag); stage.addEventListener("pointercancel", endDrag);

  // the shutter: a real photo, saved to Studio, opening already reading the part under the circle (js/photos.js)
  $("#shut").onclick = () => {
    if (!vid.videoWidth) return;
    const w = vid.videoWidth, h = vid.videoHeight, k = Math.min(1, 2000 / Math.max(w, h)), c = document.createElement("canvas");
    c.width = Math.round(w * k); c.height = Math.round(h * k); c.getContext("2d").drawImage(vid, 0, 0, c.width, c.height);
    const [sfx, sfy] = toNative(at[0], at[1]);
    vid.pause();
    if (!reduceMotion) { const fl = $("#flash"); fl.classList.remove("snap"); void fl.offsetWidth; fl.classList.add("snap"); }
    buzz(12);
    phCaptureAndOpen(c, "From the camera", { seed: { fx: sfx, fy: sfy } });
  };

  // +: into a small strip (a palette you build as you go), or, in pick mode, to the caller
  const renderPicks = () => {
    const p = $("#picks"); p.hidden = !list.length;
    p.innerHTML = list.map(h => `<i style="--c:${h}"></i>`).join("") + (!list.length ? "" : PICK
      ? (PICK.multi ? `<button class="eye-picks-done" data-act="done">Done · ${list.length}</button>` : "")
      : `<button class="eye-picks-clear" data-act="clear">Clear</button><button class="eye-picks-done" data-act="save">Save palette</button>`);
  };
  $("#add").onclick = () => {
    if (!cur) return;
    const hex = cur.hex, nm = cur.nm;
    if (PICK && !PICK.multi) { buzz(10); stop(); PICK.onPick && PICK.onPick(hex, { src: "camera" }); leaveAfter(() => PICK.onDone && PICK.onDone([hex])); return; }
    if (list.length >= 20) return toast("That's 20 colors. Save this palette first.");
    list.push(hex); PICK && PICK.onPick && PICK.onPick(hex, { src: "camera" });
    if (typeof learnerLog === "function") learnerLog({ type: "seen", color: { n: nm.n, h: hex }, src: "camera" });
    buzz(10); renderPicks();
  };
  $("#picks").onclick = e => {
    const b = e.target.closest("[data-act]"); if (!b) return;
    if (b.dataset.act === "clear") { list.length = 0; buzz(6); renderPicks(); return; }
    if (b.dataset.act === "done") { buzz(10); stop(); leaveAfter(() => PICK.onDone && PICK.onDone(list.slice())); return; }
    if (b.dataset.act === "save") {
      const cols = list.slice(); keepPalette(cols, "Camera");
      const kept = (S.palettes || []).find(p => p.cols.join() === cols.join());
      if (kept) { stop(); openSavedPalette(kept.id); }
    }
  };
  // a tap on the name opens its page: you looked, the app named it, and you chose to open it (js/learner.js "find")
  $("#nm").onclick = () => { if (!cur) return; if (typeof learnerLog === "function") learnerLog({ type: "find", color: { n: cur.nm.n, h: cur.hex }, src: "camera" }); openTappedColor(cur.hex); };

  // a photo from the library goes the same road as the shutter (or, in pick mode, to the caller's drag picker)
  const fromFile = f => {
    if (!f) return;
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      if (PICK) { stop(); photoPickOpen(img, { multi: PICK.multi, title: opts.title, onPick: PICK.onPick }, hexes => PICK.onDone && PICK.onDone(hexes)); return; }
      const w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, 2000 / Math.max(w, h)), c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k)); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      stop(); phCaptureAndOpen(c, "From a photo");
    };
    img.onerror = () => toast("That photo didn't load");
    img.src = URL.createObjectURL(f);
  };
  $("#file").onchange = e => fromFile(e.target.files[0]);
  $("#file2").onchange = e => fromFile(e.target.files[0]);

  (async () => {
    // photoPick-style: skip getUserMedia entirely and go straight to "choose a photo" (the same honest no-camera door)
    if (opts.forcePhoto) { el.classList.add("nocam"); $("#off").hidden = false; later(() => { const f2 = $("#file2"); if (f2) f2.click(); }, 30); return; }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 1920 } }, audio: false });
    } catch (e) {
      const r = eyeOffReason(e);
      el.classList.add("nocam"); $("#off").hidden = false;
      $("#offEyebrow").textContent = r.head;
      $("#offHead").innerHTML = "Name the colors in a <em>photo</em> instead.";
      $("#offFix").hidden = !r.fix; $("#offFix").textContent = r.fix || "";
      return;
    }
    // a refused play() (power saving, autoplay rules) is not a missing camera: the muted video starts on its own
    vid.srcObject = stream; vid.play().catch(() => {});
    track = stream.getVideoTracks()[0] || null;
    if (track && typeof track.getCapabilities === "function") {
      try { const cap = track.getCapabilities(); lockable = !!((cap.exposureMode && cap.exposureMode.includes("manual")) || (cap.whiteBalanceMode && cap.whiteBalanceMode.includes("manual"))); } catch (e) {}
    }
    raf = requestAnimationFrame(tick);
  })();
}

// ---------- public pick APIs (David, 2026-10-09): cameraPick({ onPick(hex,meta), multi, title }) opens this
// camera in pick-for-caller mode (exact pixel; multi keeps it open with a strip of picks and a Done); photoPick
// does the same starting straight from an uploaded photo (forcePhoto). js/settray.js's "Pair with… -> Point
// your camera" already feature-detects window.cameraPick -- this is that door, made real.
// Either a Promise of the final hexes, or (when the caller passes onDone) a plain, non-thenable object, so a
// defensive caller that tries both `.then(finish)` and `onDone: finish` only ever gets `finish` called once.
function cameraPick(o = {}) {
  let resolveDone = null;
  const promise = o.onDone ? null : new Promise(res => { resolveDone = res; });
  const finish = hexes => { if (o.onDone) o.onDone(hexes); if (resolveDone) resolveDone(hexes); };
  eye({ pick: true, multi: !!o.multi, title: o.title, onPick: o.onPick, onDone: finish });
  return promise;
}
// photoPick: a photo, picked with the shared drag loupe (js/eyedrop.js eyedropAttach) -- the same picker the
// camera, set-page photo picking and future callers all use, instead of a second one built here. Choose a photo,
// then press-and-drag on it for a magnified, live-named read; release = pick. multi keeps a running strip with
// a persistent Done (same markup/classes as cameraPick's own picks strip, css already covers both).
function photoPick(o = {}) {
  let resolveDone = null;
  const promise = o.onDone ? null : new Promise(res => { resolveDone = res; });
  const finish = hexes => { if (o.onDone) o.onDone(hexes); if (resolveDone) resolveDone(hexes); };
  const input = document.createElement("input");
  input.type = "file"; input.accept = "image/*"; input.hidden = true;
  document.body.appendChild(input);
  input.onchange = () => {
    const f = input.files[0]; input.remove();
    if (!f) return finish([]);
    const img = new Image();
    img.onload = () => photoPickOpen(img, o, finish);
    img.onerror = () => { toast("That photo didn't load"); finish([]); };
    img.src = URL.createObjectURL(f);
  };
  input.click();
  return promise;
}
function photoPickOpen(img, o, finish) {
  const picks = [];
  img.className = "eye-photopick-img"; img.alt = "";
  const el = show(`
    <header class="eye-top"><button class="icon-btn glass" data-back aria-label="Back">${ICON.back}</button><span class="eye-hint">${esc(o.title || "Press and drag for the exact color")}</span></header>
    <div class="eye-stage eye-photopick-stage" id="stage"></div>
    <div class="eye-card">
      <button class="eye-name" id="nm" hidden><i id="chip"></i><span><b id="big"></b><em id="src"></em></span></button>
      <p class="eye-hex mono" id="hexline"></p>
      <div class="eye-picks" id="picks" hidden></div>
      <p class="eye-note">${o.multi ? "Release to add a color; press elsewhere for the next one." : "Release to pick."}</p>
    </div>
  `, "fixed eye photopick");
  const $ = s => el.querySelector(s);
  $("#stage").appendChild(img);
  let cur = null, left = false;
  const paint = hex => {
    if (!hex) return;
    cur = { hex, nm: nameOf(hex) };
    $("#nm").hidden = false; $("#chip").style.setProperty("--c", hex);
    $("#big").textContent = cur.nm.text;
    $("#src").textContent = cur.nm.de < VERY_CLOSE_DE ? "Nearest of about 1,000 names" : `Nearest of about 1,000 names · ${pctDiff(cur.nm.de)}`;
    $("#hexline").textContent = hex;
  };
  const renderPicks = () => {
    const p = $("#picks"); p.hidden = !picks.length;
    p.innerHTML = picks.map(h => `<i style="--c:${h}"></i>`).join("") + (picks.length ? `<button class="eye-picks-done" data-act="done">Done · ${picks.length}</button>` : "");
  };
  const leave = () => { if (left) return; left = true; drop.detach(); };
  const drop = eyedropAttach(img, {
    onMove: hex => paint(hex),
    onPick: hex => {
      paint(hex);
      o.onPick && o.onPick(hex, { src: "photo" });
      if (!o.multi) { leave(); finish([hex]); if (app.contains(el)) go(S.tab || "explore"); return; }
      picks.push(hex); renderPicks(); buzz(10);
    },
  });
  cleanup.push(leave);
  $("[data-back]").onclick = () => { leave(); finish(picks.slice()); if (app.contains(el)) go(S.tab || "explore"); };
  $("#picks").onclick = e => {
    if (!e.target.closest('[data-act="done"]')) return;
    buzz(10); leave(); finish(picks.slice()); if (app.contains(el)) go(S.tab || "explore");
  };
}
window.cameraPick = cameraPick;
window.photoPick = photoPick;
LAB.eye = o => eye(o);
