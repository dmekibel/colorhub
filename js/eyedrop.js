"use strict";
// Shared eyedropper, Adobe Capture style (David, 2026-10-25). The old loupe that ballooned above the finger is gone.
// Now: a persistent reticle (a ring with a double outline and a center dot) sits on the picture. Drag anywhere to move
// it with RELATIVE motion (the finger never covers the sampled point); tap to jump it there; a mouse drags it directly
// and the arrow keys nudge it 1px (Shift = 10px). A square preview, ~120px, is pinned to the top-left corner of the
// picture (it flips to the top-right when the reticle gets under it): a medium close-up (about 3.5x, smooth) with a
// crosshair at the center, the sampled area outlined, and the live swatch and name beneath. The sample-size control
// (Point / Small / Medium / Large) sits below the picture. Lifting the finger commits the pick (js/picked.js pkAdd).
//
// Coordinates map through the element's own getBoundingClientRect(), assuming object-fit:contain (the only mode
// every pickable image in this app uses) for the letterbox math, so it keeps working through a CSS transform an
// ancestor applies with no special-casing.
//
//   eyedropAttach(imgOrCanvasEl, { onMove(hex, {x,y}), onPick(hex, {x,y}), sizes:false }) -> { detach(), reticle }
//   getSampleSize() / setSampleSize(n) -> one of EYD_SIZES (1, 5, 11, 21 averaged on a ~1000px picture), stored in
//     S.sampleSize once chosen (S.sampleV marks a real choice; before that it reads as Small).
//   eydSizeControlHTML(compact) / eydBindSizes(root, onChange) -> the four-way control, for the pickers and Settings.
//   eydPreviewHTML() / eydPreviewDraw(...) / eydRingPx(...) -> the shared preview square and ring size, also used by
//     js/paintzoom.js's Look closer Pick (which keeps its own palette strip).

const EYD_SIZES = [1, 5, 11, 21];
const EYD_LABEL = { 1: "Point", 5: "Small", 11: "Medium", 21: "Large" };
// Point / Small / Medium / Large = 1, 5, 11, 21 px on a ~1000 px picture; eydN() scales the square up for bigger
// sources, so "Medium" covers the same share of a 2800 px museum scan as of a phone photo. Every picker reads Small
// unless the person picks another size in the row below the picture (never by pinching). S.sampleV marks a choice
// made under this rule; older choices (the 2x2 .. 31x31 scale) start over at Small.
const EYD_DEFAULT = 5;
const getSampleSize = () => S.sampleV === 3 && EYD_SIZES.includes(S.sampleSize) ? S.sampleSize : EYD_DEFAULT;
function setSampleSize(n) { S.sampleSize = EYD_SIZES.includes(n) ? n : EYD_DEFAULT; S.sampleV = 3; save(); }
// the native-pixel side of the averaged square for a nominal size on this source (Point stays one pixel)
const eydN = (src, size) => size <= 1 ? 1 : Math.max(Math.round(size), Math.round(size * Math.min(src.w, src.h) / 1000));
// one row, four equal opaque segments, words not numbers (the caption says what they mean once)
const eydSizeControlHTML = (compact) => `<div class="eyd-sizes seg" role="group" aria-label="Sample size, how much is averaged per pick">${EYD_SIZES.map(n => {
  const on = n === getSampleSize();
  return `<button type="button" data-eydsize="${n}" class="${on ? "on" : ""}" aria-pressed="${on}">${EYD_LABEL[n]}</button>`;
}).join("")}</div>${compact ? "" : `<p class="eyd-sizes-cap">How much is averaged per pick, centered on the spot</p>`}`;
// wire a control's buttons (every control on the page follows the choice); onChange(n) resamples
function eydBindSizes(root, onChange) {
  root.querySelectorAll("[data-eydsize]").forEach(b => b.addEventListener("click", () => {
    setSampleSize(+b.dataset.eydsize); if (typeof buzz === "function") buzz(5);
    document.querySelectorAll(".eyd-sizes [data-eydsize]").forEach(x => { const on = +x.dataset.eydsize === getSampleSize(); x.classList.toggle("on", on); x.setAttribute("aria-pressed", on); });
    if (onChange) onChange(getSampleSize());
  }));
}

// the Settings sheet for the sample size (js/you.js "How you see" wires its row here)
function eydSizeSheet() {
  const { sh } = sheet(`<div class="mn-confirm eyd-sheet">${mnHead("Eyedropper sample size")}
    <p class="mn-body">Point samples the exact pixel. The others average a small square around it, the way Photoshop's eyedropper does, which helps right at a hard edge. The square grows with the picture's resolution.</p>
    ${eydSizeControlHTML()}</div>`);
  eydBindSizes(sh);
}
// ---------- the pixel source: the element drawn once to an offscreen canvas ----------
function eydSource(el) {
  let w = el.naturalWidth || el.width, h = el.naturalHeight || el.height;
  if (!w || !h) return null;
  // a 3000-4000 px museum original (the Met's, Smithsonian's) would be a 16 MP canvas, over iOS's limit: read it at ~6 MP
  const k = Math.min(1, Math.sqrt(6e6 / (w * h))); if (k < 1) { w = Math.max(1, Math.round(w * k)); h = Math.max(1, Math.round(h * k)); }
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const cx = c.getContext("2d", { willReadFrequently: true }); if (!cx) return null;
  // a canvas whose middle pixel is fully transparent (not decoded yet, or refused for memory) would read every pick as
  // #000000 (David's photo screenshot, 2026-10-24): never use it, so the next touch tries again
  try { cx.drawImage(el, 0, 0, w, h); if (!cx.getImageData(w >> 1, h >> 1, 1, 1).data[3]) return null; } catch (e) { return null; }
  return { c, cx, w, h };
}
// where the picture itself sits on screen: object-fit:contain's letterboxing inside the element's rect
function eydFit(el) {
  const r = el.getBoundingClientRect(), nw = el.naturalWidth || el.width, nh = el.naturalHeight || el.height;
  if (!nw || !nh || !r.width || !r.height) return null;
  const ar = nw / nh, bar = r.width / r.height;
  let dw = r.width, dh = r.height, ox = 0, oy = 0;
  if (ar > bar) { dh = r.width / ar; oy = (r.height - dh) / 2; } else { dw = r.height * ar; ox = (r.width - dw) / 2; }
  return { left: r.left + ox, top: r.top + oy, dw, dh };
}
// a screen point -> the fraction of the picture it's over (0..1 each way); null outside the picture itself
function eydMap(el, clientX, clientY) {
  const f = eydFit(el); if (!f) return null;
  const fx = (clientX - f.left) / f.dw, fy = (clientY - f.top) / f.dh;
  if (fx < 0 || fx > 1 || fy < 0 || fy > 1) return null;
  return { fx, fy };
}
function eydSampleAt(src, fx, fy, size) {
  const px = clamp(Math.round(fx * src.w), 0, src.w - 1), py = clamp(Math.round(fy * src.h), 0, src.h - 1);
  // an n x n square around the point (even sizes take the pixel and the ones right and below it)
  const n0 = Math.max(1, eydN(src, size)), lo = Math.floor((n0 - 1) / 2);
  const bx = clamp(px - lo, 0, src.w - 1), by = clamp(py - lo, 0, src.h - 1);
  const bw = Math.max(1, Math.min(n0, src.w - bx)), bh = Math.max(1, Math.min(n0, src.h - by));
  const data = src.cx.getImageData(bx, by, bw, bh).data;
  let rr = 0, gg = 0, bb = 0, n = 0;
  for (let k = 0; k < data.length; k += 4) { rr += data[k]; gg += data[k + 1]; bb += data[k + 2]; n++; }
  if (!n) return null;
  const hex = "#" + [rr, gg, bb].map(v => clamp(Math.round(v / n), 0, 255).toString(16).padStart(2, "0")).join("").toUpperCase();
  return { hex, px, py, n: n0 };
}
// the name the readouts show: the descriptive name of an arbitrary picked color (js/naming.js nameOfTapped)
function eydNameOf(hex) {
  const nm = typeof nameOf === "function" ? nameOf(hex) : null;
  return nm && nm.n ? (typeof nameOfTapped === "function" ? nameOfTapped(hex, nm) : nm.n) : "";
}

// ---------- the preview square (shared with Look closer) ----------
const EYD_ZOOM = 3.5;   // the close-up magnifies what's on screen by about this much
const eydPreviewHTML = (hidden) => `<div class="eyd-prev"${hidden ? " hidden" : ""} aria-hidden="true"><div class="eyd-prev-sq"><canvas width="440" height="440"></canvas><i class="eyd-prev-area"></i><i class="eyd-prev-x"></i></div><div class="eyd-prev-info"><i class="eyd-prev-sw"></i><span class="eyd-prev-name"></span></div></div>`;
// the ring's on-screen diameter: 44px, growing when the averaged square is bigger than that
const eydRingPx = (nSrc, screenPerSrc) => clamp(Math.round(nSrc * screenPerSrc), 44, 150);
// draw the close-up centered on (fx, fy). screenPerSrc = screen pixels per source pixel right now, so the close-up
// is ~3.5x of what's visible whatever the zoom. Smooth (not pixel art); past the picture's edge it stays dark.
function eydPreviewDraw(root, s, fx, fy, nSrc, screenPerSrc, hex) {
  const sq = root.querySelector(".eyd-prev-sq"), cv = root.querySelector("canvas"), cx = cv.getContext("2d");
  const pv = sq.offsetWidth || 180;
  const side = clamp(pv / (EYD_ZOOM * Math.max(screenPerSrc, 1e-3)), 14, Math.min(s.w, s.h));
  const x0 = fx * s.w - side / 2, y0 = fy * s.h - side / 2;
  cx.imageSmoothingEnabled = true; cx.imageSmoothingQuality = "high";
  cx.fillStyle = "#0b0a09"; cx.fillRect(0, 0, cv.width, cv.height);
  const sx = Math.max(0, x0), sy = Math.max(0, y0), ex = Math.min(s.w, x0 + side), ey = Math.min(s.h, y0 + side), k = cv.width / side;
  if (ex > sx && ey > sy) cx.drawImage(s.c, sx, sy, ex - sx, ey - sy, (sx - x0) * k, (sy - y0) * k, (ex - sx) * k, (ey - sy) * k);
  const area = root.querySelector(".eyd-prev-area"), ap = clamp(nSrc * pv / side, 6, pv - 4);
  area.style.width = area.style.height = ap + "px";
  if (hex) {
    root.querySelector(".eyd-prev-sw").style.setProperty("--c", hex);
    root.querySelector(".eyd-prev-name").textContent = eydNameOf(hex) || hex;
  }
}
// the reticle's markup: a ring (double outline, set in css/eyedrop.css) with a center dot; --d is its diameter
const eydReticleHTML = () => `<div class="eyd-ret" aria-hidden="true"><i class="eyd-ret-dot"></i></div>`;

// ---------- the picker on any <img>/<canvas> ----------
let EYD_SESSION = null;   // the live drag, if any
function eyedropAttach(el, o = {}) {
  let src = null, ret = null, layer = null, ringEl = null, prevEl = null, bar = null, g = null, lastHex = null, lastName = null;
  let tick = 0, raf = 0, dead = false, lastPlaced = "";
  const sess = { resample: null };
  const ensureSrc = () => (src = src || eydSource(el));
  const prevTouch = el.style.touchAction; el.style.touchAction = "none";   // one finger moves the reticle, never scrolls the page
  const build = () => {
    if (layer || dead) return;
    layer = document.createElement("div"); layer.className = "eyd-layer";
    layer.innerHTML = eydPreviewHTML() + eydReticleHTML();
    document.body.appendChild(layer);
    prevEl = layer.querySelector(".eyd-prev"); ringEl = layer.querySelector(".eyd-ret");
    if (o.sizes !== false && !bar) {
      bar = document.createElement("div"); bar.className = "eyd-sizebar"; bar.innerHTML = eydSizeControlHTML();
      if (el.insertAdjacentElement) el.insertAdjacentElement("afterend", bar);
      eydBindSizes(bar, () => sess.resample && sess.resample());
    }
    tick = setInterval(place, 250);
    window.addEventListener("resize", place); window.addEventListener("scroll", place, true);
  };
  // put the ring on the picture and the preview in the free top corner (top-left, or top-right when the ring is under it)
  const place = () => {
    if (!layer) return;
    if (!el.isConnected) { teardown(); return; }
    const f = eydFit(el), vw = innerWidth || document.documentElement.clientWidth, vh = innerHeight || document.documentElement.clientHeight;
    if (!f || !ret || !src) { layer.hidden = true; return; }
    const vis = { l: Math.max(f.left, 0), t: Math.max(f.top, 0), r: Math.min(f.left + f.dw, vw), b: Math.min(f.top + f.dh, vh) };
    if (vis.r - vis.l < 40 || vis.b - vis.t < 40) { layer.hidden = true; return; }
    layer.hidden = false;
    const x = f.left + ret.fx * f.dw, y = f.top + ret.fy * f.dh, per = f.dw / src.w, d = eydRingPx(eydN(src, getSampleSize()), per);
    const inView = x >= vis.l - 1 && x <= vis.r + 1 && y >= vis.t - 1 && y <= vis.b + 1;
    ringEl.style.cssText = `--d:${d}px;left:${x}px;top:${y}px;${inView ? "" : "display:none"}`;
    const pv = prevEl.offsetWidth || 180, pad = 8, ph = prevEl.offsetHeight || pv + 40;
    const leftBox = { l: vis.l + pad, t: vis.t + pad }, rightBox = { l: vis.r - pad - pv, t: vis.t + pad };
    const hit = b => x > b.l - d / 2 - 4 && x < b.l + pv + d / 2 + 4 && y > b.t - d / 2 - 4 && y < b.t + ph + d / 2 + 4;
    const useRight = hit(leftBox) && !hit(rightBox);
    const box = useRight ? rightBox : leftBox;
    const key = box.l + "," + box.t; if (key !== lastPlaced) { lastPlaced = key; prevEl.style.left = box.l + "px"; prevEl.style.top = box.t + "px"; }
    prevEl.classList.toggle("eyd-prev-r", useRight);
  };
  const read = () => {
    if (!ret || !ensureSrc()) return null;
    return eydSampleAt(src, ret.fx, ret.fy, getSampleSize());
  };
  // sample the reticle's spot, update the ring + preview, tell the caller
  const show = (final, fire) => {
    const r = read(); if (!r) return false;
    build(); const f = eydFit(el);
    place();
    eydPreviewDraw(prevEl, src, ret.fx, ret.fy, r.n, f ? f.dw / src.w : 1, r.hex);
    const nm = eydNameOf(r.hex);
    if (nm !== lastName) { if (lastName !== null && typeof buzz === "function") buzz(3); lastName = nm; }
    lastHex = r.hex;
    if (fire === false) return true;
    // the commit (pkAdd) happens BEFORE the caller's own onPick fires, so anything that caller shows already reflects it
    if (final && typeof pkAdd === "function") pkAdd(r.hex, { src: "eyedrop" });
    const fn = final ? o.onPick : o.onMove;
    if (typeof fn === "function") fn(r.hex, { x: r.px, y: r.py });
    return true;
  };
  sess.resample = () => { if (ret) show(false); };
  // moves ride animation frames so a fast drag never queues more samples than the screen can show
  const later = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; if (ret && !dead) show(false); }); };
  const setFromPoint = (cx, cy) => { const m = eydMap(el, cx, cy); if (!m) return false; ret = { fx: m.fx, fy: m.fy }; return true; };
  const nudge = (dx, dy) => { const f = eydFit(el); if (!f || !ret) return; ret = { fx: clamp(ret.fx + dx / f.dw, 0, 1), fy: clamp(ret.fy + dy / f.dh, 0, 1) }; };
  // the first draw, before any touch: the reticle waits at the middle of the picture, readable at once
  const init = () => { if (dead || ret) return; if (!ensureSrc()) return; ret = { fx: .5, fy: .5 }; show(false, false); };
  if (el.complete === false) el.addEventListener("load", init, { once: true }); else init();

  const down = e => {
    if (!e.isPrimary || e.button > 0) return;
    if (!ensureSrc()) return;
    const rel = e.pointerType === "touch" || e.pointerType === "pen";
    g = { id: e.pointerId, rel, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, moved: false };
    EYD_SESSION = sess;
    try { el.setPointerCapture(e.pointerId); } catch (err) {}
    if (!rel) { if (setFromPoint(e.clientX, e.clientY)) show(false); }   // a mouse drags the reticle itself
  };
  const move = e => {
    if (!g || e.pointerId !== g.id) return;
    if (g.rel) {
      if (!g.moved && Math.hypot(e.clientX - g.x0, e.clientY - g.y0) < 6) return;
      if (!g.moved) { g.moved = true; g.x = e.clientX; g.y = e.clientY; return; }
      nudge(e.clientX - g.x, e.clientY - g.y); g.x = e.clientX; g.y = e.clientY;
    } else { g.moved = true; setFromPoint(e.clientX, e.clientY); }
    later();
  };
  // Picking = saving (David, 2026-10-10): lifting the finger commits the pick to Picked colors (pkAdd) and tells the
  // caller. A tap jumps the reticle to the spot first.
  const end = e => {
    if (!g || e.pointerId !== g.id) return;
    const grab = g; g = null; if (EYD_SESSION === sess) EYD_SESSION = null;
    try { el.releasePointerCapture(e.pointerId); } catch (err) {}
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    if (grab.rel && !grab.moved) setFromPoint(e.clientX, e.clientY);
    else if (!grab.rel) setFromPoint(e.clientX, e.clientY);
    if (show(true) && typeof buzz === "function") buzz(10);
  };
  const cancel = () => { g = null; if (EYD_SESSION === sess) EYD_SESSION = null; };
  const key = e => {
    if (!ret || !layer || layer.hidden || !e.key.startsWith("Arrow") || e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target; if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
    const st = e.shiftKey ? 10 : 1, f = eydFit(el); if (!f) return;
    // one native pixel is f.dw/src.w screen px; arrow keys move by that many image pixels
    const per = src ? f.dw / src.w : 1, px = st * (per > 0 ? 1 : 1);
    const dx = e.key === "ArrowLeft" ? -px : e.key === "ArrowRight" ? px : 0, dy = e.key === "ArrowUp" ? -px : e.key === "ArrowDown" ? px : 0;
    e.preventDefault();
    nudge(dx * per, dy * per); later();
  };
  const teardown = () => {
    if (dead) return; dead = true;
    el.removeEventListener("pointerdown", down); el.removeEventListener("pointermove", move);
    el.removeEventListener("pointerup", end); el.removeEventListener("pointercancel", cancel);
    document.removeEventListener("keydown", key); el.removeEventListener("load", init);
    window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true);
    clearInterval(tick); if (raf) cancelAnimationFrame(raf);
    if (layer) { layer.remove(); layer = null; }
    if (bar) { bar.remove(); bar = null; }
    el.style.touchAction = prevTouch;
    if (EYD_SESSION === sess) EYD_SESSION = null;
  };
  el.addEventListener("pointerdown", down);
  el.addEventListener("pointermove", move);
  el.addEventListener("pointerup", end);
  el.addEventListener("pointercancel", cancel);
  document.addEventListener("keydown", key);
  el.addEventListener("contextmenu", e => e.preventDefault());
  return { detach: teardown, get reticle() { return ret; } };
}
