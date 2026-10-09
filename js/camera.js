"use strict";
// The color eye: point the camera at anything and it names the exact pixel in the middle of the frame, live,
// from the ~1,000 core names, with the next-nearest name underneath. Freeze to tap any spot, keep a find, or
// turn the whole frame into a palette. Cameras shift color, so the copy says so plainly.
//
// David, 2026-10-09, exact pixel: isoSample's patch (js/isolate.js) is a touch-friendly average (about 5% of
// the short edge) built for the tap-to-guess games. The camera reads differently: eyeSample() below samples the
// reticle's exact pixel (or a small Photoshop-style average -- getSampleSize(), js/eyedrop.js: Point through
// 31x31, shared with the rest of the app's eyedroppers) straight off the SOURCE's native resolution -- the
// <video> or <img> element itself, never a canvas that was resized to fit the screen. Live, that's ~12 times a
// second; only the NAME shown eases between readings (Lab-smoothed), never the sampled color or hex, so flicker
// can't quietly swap in a slightly-wrong swatch. Freezing pauses the <video> itself (it keeps its last decoded,
// full-resolution frame), and a tap on the frozen frame maps back through the exact cover-crop transform the
// screen drew it with (toNative), so a tap always samples where it looks like it's sampling.
//
// David, 2026-10-09, no quiz after a pick: freezing is an exposure, not a test. It's logged to the Learner
// Model as "seen" once, immediately -- never as an "answer". Naming it never interrupts with a guess-the-name
// step (that's the Isolator's job elsewhere: js/isolate.js, opened from a photo or a painting, not from here).
// After a freeze the card offers Keep (your colors), Add to a palette (the set tray) or Pick another.
//
// Optional white balance: tap WB, then something white or grey; readings are then corrected by von Kries
// scaling (wbFrom in js/accuracy.js), so that reference comes out neutral. That reference sampling deliberately
// keeps isoSample's bigger, noise-averaged patch -- a reliable reference benefits from it; the live read does
// not. Lock asks the camera hardware itself to hold exposure and white balance steady (MediaStreamTrack.
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
const ICON_PAL = sv('<rect x="3" y="6" width="4" height="12" rx="1"/><rect x="8.5" y="6" width="4" height="12" rx="1"/><rect x="14" y="6" width="7" height="12" rx="1"/>', 22, 1.8);
const ICON_LOCK = sv('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>', 20, 1.8);
const ICON_SHADES = sv('<path d="M12 3l8 4.6v9.1L12 21l-8-4.3V7.6z"/><path d="M12 3v18M4 7.6l8 4.4 8-4.4"/>', 22, 1.6);
const ICON_HONEY = sv('<path d="M8 4.2l8 0 4 6.8-4 6.8-8 0-4-6.8z"/>', 20, 1.6);

// ---------- "Shades of this" (David, 2026-10-09): segment the object the reticle is pointing at from a frozen
// frame, then read out the array of related shades that really exist inside it, by percentage.
//
// 1. Segment: region-growing flood fill from the seed pixel, over a ~480px-long-edge downscale of the native
//    frame (never the on-screen display copy), using an adaptive CIELAB tolerance against the region's running
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
  if (insecure) return { head: "This page isn't secure", fix: "The camera only works on https:// (or localhost). Open ColorHub over a secure link, then try again." };
  if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== "function") {
    if (ios && standalone_) return { head: "This iPhone can't open the camera here", fix: "Home Screen apps got camera access in iOS 16.4. Update iOS, or open ColorHub in Safari instead of from the Home Screen icon." };
    return { head: "This browser can't open a camera", fix: "Try Safari or Chrome, or name the colors in a photo instead." };
  }
  const name = e && e.name;
  if (name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError") {
    return { head: "Camera access is off", fix: ios
      ? (standalone_ ? "Open Settings > ColorHub (or Safari) > Camera and turn it on, then come back and try again." : "Open Settings > Safari > Camera (or tap the camera icon by the address bar) and allow it, then try again.")
      : "Allow camera access for this site -- usually the camera or lock icon by the address bar -- then try again." };
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") return { head: "No camera here", fix: "This device doesn't have a camera ColorHub can use." };
  if (name === "NotReadableError" || name === "TrackStartError") return { head: "The camera's busy", fix: "Another app may be using it right now. Close it and try again." };
  return { head: "No camera here", fix: "" };
}
// opts (David, 2026-10-09, cameraPick/photoPick): { pick, multi, onPick(hex,meta), onDone(hexes), title, forcePhoto }.
// Plain eye() (no opts) is the Train > Your eye camera screen, unchanged. Pick mode swaps the frozen card's own
// actions for "Use this color" (single) or "Add" + a running strip + "Done" (multi) -- never Keep/tray/quiz --
// and forcePhoto skips getUserMedia entirely, going straight to "choose a photo" (photoPick's door).
function eye(opts = {}) {
  const el = show(`
    <div class="eye-stage" id="stage">
      <video id="vid" playsinline muted autoplay></video>
      <canvas id="still" hidden></canvas>
      <i class="eye-ret" id="ret"><b class="eye-ret-h"></b><b class="eye-ret-v"></b></i>
      <i class="eye-flash" id="flash"></i>
    </div>
    <header class="eye-top"><button class="icon-btn glass" data-back aria-label="Back">${ICON.back}</button><span class="eye-hint" id="hint"><b class="eye-live-dot" id="liveDot" aria-hidden="true"></b><span id="hintText">${esc(opts.title || "Live — point at anything")}</span></span><span class="eye-top-r"><button class="icon-btn glass eye-lock" id="lock" hidden aria-label="Lock exposure and white balance" aria-pressed="false">${ICON_LOCK}</button><button class="icon-btn glass eye-wb" id="wb" aria-label="White balance: tap, then tap something white or grey" aria-pressed="false">WB</button></span></header>
    <div class="eye-card" id="card">
      <button class="eye-name" id="nm"><i id="chip"></i><span><b id="big">Looking…</b><em id="src"></em></span></button>
      <p class="eye-hex mono" id="hexline"></p>
      <button class="eye-mine" id="mine"></button>
      <div class="eye-picks" id="picks" hidden></div>
      <div class="eye-acts" id="acts" hidden>
        <button data-act="keep" id="keepBtn">Keep</button>
        <button data-act="tray">Add to a palette</button>
        <button data-act="again">Pick another</button>
      </div>
      <button class="eye-shades" id="shadesBtn" hidden>${ICON_SHADES}<span>Shades of this</span></button>
      <p class="eye-note">Phones auto-adjust color and exposure, so this is a close read, not a lab measurement.</p>
      <div class="eye-bar">
        <label class="eye-side" aria-label="Choose a photo">${ICON_PHOTO}<input type="file" accept="image/*" id="file" hidden></label>
        <span class="eye-shut-wrap"><button class="eye-shut" id="shut" aria-label="Freeze the frame (this does not record video)"><i></i></button><b class="eye-shut-label" id="shutLabel">Freeze</b></span>
        <button class="eye-side" id="pal" aria-label="Palette from this frame">${ICON_PAL}</button>
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
  // pick-for-caller mode: swap the frozen card's own actions, never Keep/Add to a palette/Pick another/quiz.
  // multi's Done lives in the picks strip, not in #acts: #acts only shows while frozen, but Done has to stay
  // reachable after "Add" sends the camera back live for the next color.
  const PICK = opts.pick ? { multi: !!opts.multi, list: [], onPick: opts.onPick, onDone: opts.onDone } : null;
  if (PICK) {
    $("#acts").innerHTML = PICK.multi ? `<button data-act="add" id="addBtn">Add</button>` : `<button data-act="use" id="useBtn">Use this color</button>`;
    $("#shadesBtn").remove();
  }
  const renderPicks = () => {
    if (!PICK || !PICK.multi) return;
    const p = $("#picks"); if (!p) return;
    p.hidden = !PICK.list.length;
    p.innerHTML = PICK.list.map(h => `<i style="--c:${h}"></i>`).join("") + (PICK.list.length ? `<button class="eye-picks-done" data-act="done" id="doneBtn">Done · ${PICK.list.length}</button>` : "");
  };
  const vid = $("#vid"), still = $("#still"), ret = $("#ret"), stage = $("#stage");
  let stream = null, track = null, frozen = false, raf = 0, cur = null, smooth = null, last = 0, at = [.5, .5], wb = null, wbArm = false, hwLocked = false, loggedThisFreeze = false;
  let capKind = "camera";   // "camera" | "photo": the live feed, or a chosen image (js/learner.js learnerLog "find"/"seen")
  // the transform from a stage-fraction tap to the source's own fraction: the same cover-crop scale + offset the
  // freeze canvas was drawn with, so a tap samples the exact pixel it looks like it's pointing at (toNative)
  let camSrc = null, camW = 0, camH = 0, camK = 1, camOx = 0, camOy = 0;
  const read = hex => wb ? wb(hex) : hex;
  const stop = () => { cancelAnimationFrame(raf); if (stream) stream.getTracks().forEach(t => t.stop()); stream = null; track = null; };
  cleanup.push(stop);
  // pick mode's own onDone often navigates on its own (settray's finish() opens the set page) -- calling go()
  // unconditionally right after would stomp on that. show() always replaces #app's content -- the OLD screen
  // is moved into a fading .fade-ghost under <body> for its exit animation, not removed, so el.isConnected
  // alone stays true even after a real navigation; app.contains(el) is the one that actually tells "did this
  // screen leave #app". Only fall back to leaving the screen ourselves when it didn't (a hash comparison isn't
  // reliable either: an unrouted inner screen like this one falls back to the current tab's own address,
  // which a caller's navigation can legitimately land on too).
  const leaveAfter = fn => { fn(); if (app.contains(el)) go(S.tab || "explore"); };
  $("[data-back]").onclick = () => { stop(); leaveAfter(() => PICK && PICK.onDone && PICK.onDone(PICK.list.slice())); };
  loadCoreNames();

  const paint = (hex, nameHex) => {
    if (!hex) return;
    nameHex = nameHex || hex;
    const nm = nameOf(nameHex), nx = nm.near.find(x => x.n !== nm.n && x.de < 12);
    cur = { hex, nm, nx };
    ret.style.setProperty("--c", hex); $("#chip").style.setProperty("--c", hex);
    $("#big").textContent = nm.text;
    $("#src").textContent = nm.de < VERY_CLOSE_DE ? "Nearest of about 1,000 names" : `Nearest of about 1,000 names · ${pctDiff(nm.de)}`;
    $("#hexline").textContent = hex;
    // second line: the next-nearest name, one tap to its page (every name is equal)
    $("#mine").innerHTML = nx ? `<i style="--c:${nx.h}"></i><span>Also near <b>${esc(nx.n)}</b></span><em>${pctDiff(nx.de)}</em>` : "";
    syncKeepBtn();
  };
  const syncKeepBtn = () => { const b = $("#keepBtn"); if (b && cur) b.textContent = typeof fvHas === "function" && fvHas(cur.hex) ? "Kept" : "Keep"; };
  // live: sample about every 80ms (roughly 12 times a second). The swatch and hex always show the RAW exact
  // reading; only the name eases between readings (a Lab-smoothed point feeds nameOf), so sensor noise can't
  // flicker the name every frame without ever touching what's shown as the sampled color itself.
  const tick = t => {
    raf = requestAnimationFrame(tick);
    if (frozen || !vid.videoWidth || t - last < 80) return;
    last = t;
    const hex = read(eyeSample(vid, vid.videoWidth, vid.videoHeight, .5, .5, getSampleSize()));
    if (!hex) return;
    const L = lab(hex);
    smooth = smooth ? smooth.map((x, i) => x + (L[i] - x) * .45) : L;
    paint(hex, labHex(...smooth));
    if (typeof twLive === "function") twLive(vid, stage);   // the closest painting in the archive to what the camera sees (js/twins.js)
  };
  const toNative = (sfx, sfy) => {
    const R = stage.getBoundingClientRect();
    const sx = (sfx * R.width - camOx) / camK, sy = (sfy * R.height - camOy) / camK;
    return [clamp(sx / camW, 0, 1), clamp(sy / camH, 0, 1)];
  };
  const freeze = (src, w, h) => {
    frozen = true; el.classList.add("frozen"); loggedThisFreeze = false;
    if (src === vid) vid.pause();   // the <video> keeps its last decoded, full-resolution frame while paused
    camSrc = src; camW = w; camH = h;
    // draw what's on screen (cover-cropped) so a tap LOOKS like it lands where it samples; the sample itself
    // always comes from camSrc at full resolution through toNative(), never from this display-sized copy
    const R = stage.getBoundingClientRect(), k = Math.max(R.width / w, R.height / h), dpr = Math.min(devicePixelRatio || 1, 2);
    camK = k; camOx = (R.width - w * k) / 2; camOy = (R.height - h * k) / 2;
    still.width = R.width * dpr; still.height = R.height * dpr; still.hidden = false;
    const c = still.getContext("2d"); c.drawImage(src, camOx * dpr, camOy * dpr, w * k * dpr, h * k * dpr);
    vid.style.visibility = "hidden";
    $("#hintText").textContent = opts.title && !PICK ? opts.title : "Frozen — tap anywhere to name it";
    $("#liveDot").hidden = true;
    $("#acts").hidden = false;
    if (!PICK) $("#shadesBtn").hidden = false;
    $("#shut").setAttribute("aria-label", "Back to live (tap to unfreeze)");
    $("#shutLabel").textContent = "Live";
    // a snap of brightness, like a photo shutter -- a camera cue, never a recording one (David, 2026-10-09:
    // "the video feature is confusing" -- this freezes one frame, it never records)
    if (!reduceMotion) { const fl = $("#flash"); fl.classList.remove("snap"); void fl.offsetWidth; fl.classList.add("snap"); }
    at = [.5, .5]; placeRet();
    paint(read(eyeSample(camSrc, camW, camH, .5, .5, getSampleSize())));
    // a freeze is an exposure, not a quiz answer: log it once to the Learner Model as "seen" (js/learner.js)
    if (typeof learnerLog === "function" && cur && !loggedThisFreeze) { loggedThisFreeze = true; learnerLog({ type: "seen", color: { n: cur.nm.n, h: cur.hex }, src: capKind }); }
    buzz(10);
  };
  const live = () => {
    frozen = false; capKind = "camera"; el.classList.remove("frozen"); still.hidden = true; vid.style.visibility = ""; $("#acts").hidden = true;
    const sb = $("#shadesBtn"); if (sb) sb.hidden = true;
    $("#hintText").textContent = opts.title || "Live — point at anything"; $("#liveDot").hidden = false;
    $("#shut").setAttribute("aria-label", "Freeze the frame (this does not record video)"); $("#shutLabel").textContent = "Freeze";
    if (stream) vid.play().catch(() => {});
    at = [.5, .5]; placeRet();
  };
  const placeRet = () => { ret.style.left = at[0] * 100 + "%"; ret.style.top = at[1] * 100 + "%"; };
  // white balance: the next tap picks the reference (live: the middle circle; frozen: where you tap). A
  // reliable reference benefits from isoSample's bigger, noise-averaged patch (js/isolate.js) -- unlike the
  // live read above, this one point is deliberately not the exact-pixel eyeSample.
  const hintNow = () => $("#hintText").textContent = wbArm ? (frozen ? "Tap something white or grey" : "Aim the circle at white or grey, tap") : frozen ? "Frozen — tap anywhere to name it" : "Live — point at anything";
  const wbBtn = $("#wb");
  const setWb = f => { wb = f; wbBtn.classList.toggle("on", !!f); wbBtn.setAttribute("aria-pressed", f ? "true" : "false"); smooth = null; };
  wbBtn.onclick = () => {
    if (wb) { setWb(null); wbArm = false; toast("White balance off"); }
    else { wbArm = !wbArm; wbBtn.classList.toggle("arm", wbArm); }
    hintNow();
  };
  // Lock: ask the camera hardware itself to stop re-adjusting exposure and white balance, where it allows it
  const lockBtn = $("#lock");
  const lockMode = (modes, want) => modes && modes.includes(want) ? want : null;
  lockBtn.onclick = async () => {
    if (!track || typeof track.getCapabilities !== "function") return;
    const cap = track.getCapabilities(), next = !hwLocked, adv = [];
    const em = lockMode(cap.exposureMode, next ? "manual" : "continuous"), wm = lockMode(cap.whiteBalanceMode, next ? "manual" : "continuous");
    if (!em && !wm) { toast("This camera won't lock exposure or white balance"); return; }
    if (em) adv.push({ exposureMode: em });
    if (wm) adv.push({ whiteBalanceMode: wm });
    try {
      await track.applyConstraints({ advanced: adv });
      hwLocked = next; lockBtn.classList.toggle("on", hwLocked); lockBtn.setAttribute("aria-pressed", String(hwLocked));
      toast(hwLocked ? "Exposure and white balance locked" : "Back to auto"); buzz(8);
    } catch (e) { toast("Couldn't lock this camera"); }
  };
  stage.addEventListener("pointerdown", e => {
    if (wbArm) {
      const R = stage.getBoundingClientRect(), p = frozen ? [(e.clientX - R.left) / R.width, (e.clientY - R.top) / R.height] : [.5, .5];
      const ref = frozen ? isoSample(still, p[0], p[1]) : vid.videoWidth ? isoSample(vid, .5, .5) : null;
      const f = ref && wbFrom(ref);
      wbArm = false; wbBtn.classList.remove("arm");
      if (f) { setWb(f); toast("White set"); if (frozen) paint(read(eyeSample(camSrc, camW, camH, at[0], at[1], getSampleSize()))); }
      else toast("Too dark or too colorful. Try white or grey");
      hintNow(); buzz(5); return;
    }
    if (!frozen) return;
    const R = stage.getBoundingClientRect(), sfx = (e.clientX - R.left) / R.width, sfy = (e.clientY - R.top) / R.height;
    at = [sfx, sfy]; placeRet();
    const [fx, fy] = toNative(sfx, sfy);
    paint(read(eyeSample(camSrc, camW, camH, fx, fy, getSampleSize()))); buzz(5);
  });
  $("#shut").onclick = () => {
    if (frozen) return stream ? live() : null;
    if (vid.videoWidth) freeze(vid, vid.videoWidth, vid.videoHeight);
  };
  // after a freeze: Keep (your colors), Add to a palette (the set tray) or Pick another -- never a name-it quiz.
  // In pick mode (cameraPick/photoPick) these three are swapped for the caller's own Use/Add+Done instead.
  $("#acts").onclick = e => {
    const b = e.target.closest("[data-act]"); if (!b || !cur) return;
    const act = b.dataset.act;
    if (PICK) {
      if (act === "use") { buzz(10); stop(); PICK.onPick && PICK.onPick(cur.hex, { src: capKind }); leaveAfter(() => PICK.onDone && PICK.onDone([cur.hex])); }
      else if (act === "add") {
        PICK.list.push(cur.hex); PICK.onPick && PICK.onPick(cur.hex, { src: capKind }); buzz(10); renderPicks();
        toast(`${nameOf(cur.hex).text} added`);
        if (capKind === "camera") live();
      }
      return;
    }
    if (act === "keep") { if (typeof fvSet === "function") fvSet(cur.hex, cur.nm.n, true, "camera"); toast("Kept"); syncKeepBtn(); buzz(8); }
    else if (act === "tray") { if (typeof sxAdd === "function") sxAdd(cur.hex); buzz(8); }
    else if (act === "again") { if (capKind === "photo") $("#file").click(); else live(); }
  };
  // Done lives in the picks strip (renderPicks above), reachable whether frozen or back live for the next color
  if (PICK && PICK.multi) $("#picks").onclick = e => {
    if (!e.target.closest('[data-act="done"]')) return;
    buzz(10); stop(); leaveAfter(() => PICK.onDone && PICK.onDone(PICK.list.slice()));
  };
  if (!PICK) $("#shadesBtn").onclick = () => eyeShadesOpen({ camSrc, camW, camH, fx: toNative(at[0], at[1])[0], fy: toNative(at[0], at[1])[1], title: cur && cur.nm ? cur.nm.text : "" });
  // a tap on either name is a kept find: you looked, the app named it, and you chose to open it (js/learner.js learnerLog "find")
  const logFind = (n, h) => { if (typeof learnerLog === "function") learnerLog({ type: "find", color: { n, h }, src: capKind }); };
  $("#nm").onclick = () => { if (!cur) return; logFind(cur.nm.n, cur.hex); openTappedColor(cur.hex); };   // David, 2026-10-07: one tap opens the page, not the sheet
  $("#mine").onclick = () => { if (cur && cur.nx) { logFind(cur.nx.n, cur.nx.h); openTappedColor(cur.nx.h); } };
  const fromFile = f => {
    if (!f) return;
    const img = new Image();
    img.onload = () => { stop(); capKind = "photo"; el.classList.remove("nocam"); $("#off").hidden = true; freeze(img, img.naturalWidth, img.naturalHeight); URL.revokeObjectURL(img.src); };
    img.src = URL.createObjectURL(f);
  };
  $("#file").onchange = e => fromFile(e.target.files[0]);
  $("#file2").onchange = e => fromFile(e.target.files[0]);
  $("#pal").onclick = () => {
    const src = frozen ? still : vid;
    if (!src.width && !src.videoWidth) return;
    const c = document.createElement("canvas"), w = frozen ? still.width : vid.videoWidth, h = frozen ? still.height : vid.videoHeight, k = Math.min(1, 900 / Math.max(w, h));
    c.width = w * k; c.height = h * k; c.getContext("2d").drawImage(src, 0, 0, c.width, c.height);
    stop(); phCaptureAndOpen(c, "From the camera");
  };

  (async () => {
    // photoPick: skip getUserMedia entirely and go straight to "choose a photo" (the same honest no-camera door)
    if (opts.forcePhoto) { el.classList.add("nocam"); $("#off").hidden = false; later(() => { const f2 = $("#file2"); if (f2) f2.click(); }, 30); return; }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 1280 } }, audio: false });
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
      try {
        const cap = track.getCapabilities();
        if ((cap.exposureMode && cap.exposureMode.includes("manual")) || (cap.whiteBalanceMode && cap.whiteBalanceMode.includes("manual"))) lockBtn.hidden = false;
      } catch (e) {}
    }
    raf = requestAnimationFrame(tick);
  })();
}

// ---------- the "Shades of this" sheet: adjust the segmented region, then read its shades out ----------
// o: { camSrc, camW, camH, fx, fy, title } -- the same native-resolution source and source-fraction seed the
// frozen eye card samples from (toNative), so the segmentation starts exactly where the reticle is pointing.
function eyeShadesOpen(o) {
  const { camSrc, camW, camH, fx, fy, title } = o;
  if (!camSrc || !camW || !camH) return;
  const prep = segPrep(camSrc, camW, camH);
  let tolMult = 1, grow = segGrow(prep, fx, fy, tolMult), km, dendro, maxD = 2, kNow = 6, shades = [], sort = "share", hlIdx = -1;
  const recluster = () => {
    km = segKmeans(prep, grow, Math.min(40, grow.count));
    dendro = segDendrogram(km.clusters);
    maxD = segMaxDistinct(dendro);
    kNow = Math.min(kNow, maxD);
    shades = segShades(prep, km, dendro, kNow);
    hlIdx = -1;
  };
  recluster(); kNow = Math.min(6, maxD); shades = segShades(prep, km, dendro, kNow);
  const { sh, close } = sheet(`
    <p class="eyebrow">Shades of this</p>
    <h2 class="shd-h">${esc(title || "What's really there")}</h2>
    <div class="shd-stage" data-shd-stage><canvas class="shd-base" data-shd-base></canvas><canvas class="shd-mask" data-shd-mask></canvas></div>
    <label class="shd-tol"><span>Tighter</span><input type="range" min="40" max="220" value="100" data-shd-tol aria-label="Tighter or wider, re-grows the region"><span>Wider</span></label>
    <div class="shd-count"><b>How many shades</b><span class="shd-n-row"><input type="range" data-shd-n><b class="shd-n-out" data-shd-nout></b></span></div>
    <div class="shd-strip" data-shd-strip></div>
    <div class="shd-sort" role="group" aria-label="Sort the list"><button class="on" data-sort="share">By share</button><button data-sort="light">Light → dark</button></div>
    <div class="shd-list" data-shd-list></div>
    <div class="shd-acts">
      <button data-shd="keep">Keep</button>
      <button data-shd="honey">${ICON_HONEY}<span>See as honeycomb</span></button>
      ${typeof mapSelect === "function" ? `<button data-shd="map">Show on the big map</button>` : ""}
      <button data-shd="share">Share</button>
    </div>
    <p class="eye-note">Camera exposure, white balance and lighting shift these shades. Lock (top bar) helps.</p>
  `);
  sh.classList.add("shd-sheet");
  const base = sh.querySelector("[data-shd-base]"), maskCv = sh.querySelector("[data-shd-mask]"), stageEl = sh.querySelector("[data-shd-stage]");
  const drawBase = () => {
    const w = Math.max(240, stageEl.clientWidth || 320), h = Math.round(w * camH / camW);
    [base, maskCv].forEach(c => { c.width = w; c.height = h; });
    base.getContext("2d").drawImage(camSrc, 0, 0, w, h);
  };
  const paintOverlay = keepIdx => {
    const ov = segOverlay(prep, keepIdx), x = maskCv.getContext("2d");
    x.clearRect(0, 0, maskCv.width, maskCv.height);
    x.imageSmoothingEnabled = true;
    x.drawImage(ov, 0, 0, maskCv.width, maskCv.height);
  };
  const regionIdx = () => { const out = []; for (let i = 0; i < grow.mask.length; i++) if (grow.mask[i]) out.push(i); return out; };
  const showRegion = () => { hlIdx = -1; paintOverlay(regionIdx()); sh.querySelectorAll("[data-hl]").forEach(b => b.classList.remove("on")); };
  drawBase(); showRegion();

  function renderStrip() {
    const list = sort === "light" ? shades.slice().sort((a, b) => lab(a.hex)[0] - lab(b.hex)[0]) : shades;
    sh.querySelector("[data-shd-strip]").innerHTML = list.map(s => `<div class="shd-seg" style="--c:${s.hex};flex:${Math.max(s.share, .02).toFixed(4)}"></div>`).join("");
    sh.querySelector("[data-shd-list]").innerHTML = list.map(s => {
      const realI = shades.indexOf(s);
      return `<div class="shd-row"><button class="shd-sw" data-hl="${realI}" style="--c:${s.hex}" aria-label="Highlight ${esc(s.name)} in the photo"></button><button class="shd-name" data-open="${s.hex}">${esc(s.name)}</button><span class="shd-pct">${pctFmt(s.share * 100)}</span></div>`;
    }).join("");
  }
  const countOut = sh.querySelector("[data-shd-nout]");
  countify(sh.querySelector("[data-shd-n]"), {
    min: 2, max: maxD, value: kNow, out: countOut,
    onSet: v => { kNow = v; shades = segShades(prep, km, dendro, kNow); showRegion(); renderStrip(); },
  });
  countOut.textContent = kNow;
  renderStrip();

  let tolT = 0;
  sh.querySelector("[data-shd-tol]").addEventListener("input", e => {
    tolMult = (+e.target.value) / 100;
    grow = segGrow(prep, fx, fy, tolMult);
    showRegion();
    clearTimeout(tolT);
    tolT = setTimeout(() => { recluster(); kNow = Math.min(kNow, maxD); shades = segShades(prep, km, dendro, kNow); renderStrip(); }, 120);
  });
  sh.addEventListener("click", e => {
    const sortBtn = e.target.closest("[data-sort]");
    if (sortBtn) { sort = sortBtn.dataset.sort; sh.querySelectorAll("[data-sort]").forEach(b => b.classList.toggle("on", b === sortBtn)); renderStrip(); return; }
    const hl = e.target.closest("[data-hl]");
    if (hl) {
      const i = +hl.dataset.hl;
      buzz(5);
      if (hlIdx === i) { showRegion(); return; }
      hlIdx = i; paintOverlay(shades[i].pix);
      sh.querySelectorAll("[data-hl]").forEach(b => b.classList.toggle("on", +b.dataset.hl === i));
      return;
    }
    const open = e.target.closest("[data-open]");
    if (open) { close(); openTappedColor(open.dataset.open); return; }
    const act = e.target.closest("[data-shd]");
    if (!act) return;
    const k = act.dataset.shd;
    if (k === "keep") { if (typeof keepPalette === "function") keepPalette(shades.map(s => s.hex), title ? `Shades of ${title}` : "Shades of this"); buzz(10); }
    else if (k === "honey") { close(); shdHoneycomb(shades, title); }
    else if (k === "map") { if (typeof mapSelect === "function") mapSelect({ title: title ? `Shades of ${title}` : "Shades of this", colors: shades.map(s => ({ h: s.hex, n: s.name, share: s.share })), source: "set" }); }
    else if (k === "share") { if (typeof sharePalette === "function") sharePalette(shades.map(s => ({ h: s.hex })), title ? `Shades of ${title}` : "Shades of this", h => ({ nm: nameOf(h) })); else toast("Sharing isn't ready here yet"); }
  });
}
// ---------- "See as honeycomb": exactly the chosen shades, their real photo hexes, sized by share ----------
function shdHoneycomb(shades, title) {
  const total = shades.reduce((a, c) => a + c.share, 0) || 1;
  const cells = shades.map(c => `<button class="shd-hcell" data-open="${c.hex}" style="--c:${c.hex};--w:${Math.max(c.share / total, .03).toFixed(3)}"><b>${esc(c.name)}</b><span>${pctFmt(c.share / total * 100)}</span></button>`).join("");
  const el = show(`
    <header class="nav-top"><button class="icon-btn" data-back aria-label="Back">${ICON.back}</button><span class="nav-title">${esc(title ? `Shades of ${title}` : "Shades of this")}</span><span class="nav-r"></span></header>
    <div class="shd-honey">${cells}</div>
    ${typeof mapSelect === "function" ? `<button class="btn ghost shd-honey-map" data-honey-map>Show on the big map</button>` : ""}
  `, "fixed shd-honeyscreen");
  el.querySelector("[data-back]").onclick = () => typeof xBack === "function" ? xBack() : history.back();
  el.querySelectorAll("[data-open]").forEach(b => b.onclick = () => openTappedColor(b.dataset.open));
  const mapBtn = el.querySelector("[data-honey-map]");
  if (mapBtn) mapBtn.onclick = () => mapSelect({ title: title ? `Shades of ${title}` : "Shades of this", colors: shades.map(c => ({ h: c.hex, n: c.name, share: c.share })), source: "set" });
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
