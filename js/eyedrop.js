"use strict";
// Shared eyedropper (David, 2026-10-09): press-and-drag color picking on any <img> or <canvas>, with a loupe
// that follows the finger (magnified pixels + crosshair, so the finger never hides what's being sampled), a live
// swatch/name/hex readout, a haptic tick whenever the named color changes, and release = pick. One small module
// so the camera, photo uploads and set-page photo picking can all reuse the same picker instead of three — the
// camera lane adopts it on its own later; this file never touches js/camera.js.
//
// Coordinates map through the element's own getBoundingClientRect(), assuming object-fit:contain (the only mode
// every pickable image in this app uses) for the letterbox math, so it keeps working through a CSS transform an
// ancestor applies — js/paintzoom.js's Look closer pinch/pan, say — with no special-casing: the rect already
// reflects whatever zoom/pan is live when a finger lands.
//
//   eyedropAttach(imgOrCanvasEl, { onMove(hex, {x,y}), onPick(hex, {x,y}) }) -> { detach() }
//   getSampleSize() / setSampleSize(n) -> one of EYD_SIZES, Photoshop-style ("Point" through a 31x31 average),
//     stored in S.sampleSize (migrateState-safe: js/core.js's fresh() defaults it, so an older save just inherits
//     Point the first time it's read, same as any other key fresh() adds).
//   eydSizeControlHTML(compact) -> the same five-way control, for the loupe and for Settings (js/you.js).

const EYD_SIZES = [1, 3, 5, 11, 31];
const EYD_LABEL = { 1: "Point", 3: "3×3", 5: "5×5", 11: "11×11", 31: "31×31 average" };
const getSampleSize = () => EYD_SIZES.includes(S.sampleSize) ? S.sampleSize : 1;
function setSampleSize(n) { S.sampleSize = EYD_SIZES.includes(n) ? n : 1; save(); }
const eydSizeControlHTML = (compact) => `<div class="eyd-sizes seg" role="group" aria-label="Sample size">${EYD_SIZES.map(n => {
  const on = n === getSampleSize();
  return `<button type="button" data-eydsize="${n}" class="${on ? "on" : ""}" aria-pressed="${on}">${compact ? n : (n === 1 ? "Point" : n + "×" + n)}</button>`;
}).join("")}</div>`;

// the Settings sheet for the sample size (js/you.js "How you see" wires its row here)
function eydSizeSheet() {
  const { sh, close } = sheet(`<div class="mn-confirm eyd-sheet">${mnHead("Eyedropper sample size")}
    <p class="mn-body">Point samples the exact pixel. The others average a small square around it, the way Photoshop's eyedropper does — useful right at a hard edge.</p>
    ${eydSizeControlHTML()}</div>`);
  sh.querySelectorAll("[data-eydsize]").forEach(b => b.onclick = () => {
    setSampleSize(+b.dataset.eydsize); if (typeof buzz === "function") buzz(8);
    sh.querySelectorAll("[data-eydsize]").forEach(x => { const on = x === b; x.classList.toggle("on", on); x.setAttribute("aria-pressed", on); });
  });
}
// ---------- the pixel source: the element drawn once to an offscreen canvas at native size ----------
function eydSource(el) {
  const w = el.naturalWidth || el.width, h = el.naturalHeight || el.height;
  if (!w || !h) return null;
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const cx = c.getContext("2d", { willReadFrequently: true });
  try { cx.drawImage(el, 0, 0, w, h); cx.getImageData(0, 0, 1, 1); } catch (e) { return null; }
  return { c, cx, w, h };
}
// a screen point -> the fraction of the picture it's over (0..1 each way), accounting for object-fit:contain's
// letterboxing; null outside the picture itself
function eydMap(el, clientX, clientY) {
  const r = el.getBoundingClientRect(), nw = el.naturalWidth || el.width, nh = el.naturalHeight || el.height;
  if (!nw || !nh || !r.width || !r.height) return null;
  const ar = nw / nh, bar = r.width / r.height;
  let dw = r.width, dh = r.height, ox = 0, oy = 0;
  if (ar > bar) { dh = r.width / ar; oy = (r.height - dh) / 2; } else { dw = r.height * ar; ox = (r.width - dw) / 2; }
  const fx = (clientX - r.left - ox) / dw, fy = (clientY - r.top - oy) / dh;
  if (fx < 0 || fx > 1 || fy < 0 || fy > 1) return null;
  return { fx, fy };
}
function eydSampleAt(src, fx, fy, size) {
  const px = clamp(Math.round(fx * src.w), 0, src.w - 1), py = clamp(Math.round(fy * src.h), 0, src.h - 1);
  const half = (size - 1) / 2;
  const bx = clamp(px - half, 0, src.w - 1), by = clamp(py - half, 0, src.h - 1);
  const bw = Math.max(1, Math.min(Math.round(half * 2 + 1), src.w - bx)), bh = Math.max(1, Math.min(Math.round(half * 2 + 1), src.h - by));
  const data = src.cx.getImageData(bx, by, bw, bh).data;
  let rr = 0, gg = 0, bb = 0, n = 0;
  for (let k = 0; k < data.length; k += 4) { rr += data[k]; gg += data[k + 1]; bb += data[k + 2]; n++; }
  if (!n) return null;
  const hex = "#" + [rr, gg, bb].map(v => clamp(Math.round(v / n), 0, 255).toString(16).padStart(2, "0")).join("").toUpperCase();
  return { hex, px, py };
}

// ---------- the loupe: a small floating magnifier that follows the finger ----------
let EYD_SESSION = null;   // the live drag, if any — so the size control can resample without a new touch
function eyedropAttach(el, o = {}) {
  let src = null, dragging = false, lastHex = null, loupe = null;
  const ensureSrc = () => (src = src || eydSource(el));
  const sess = { resample: null };
  const openLoupe = () => {
    if (loupe) return loupe;
    loupe = document.createElement("div"); loupe.className = "eyd-loupe";
    loupe.innerHTML = `<div class="eyd-loupe-mag"><canvas class="eyd-loupe-cv" width="132" height="132"></canvas><i class="eyd-loupe-cross"></i></div>
      <div class="eyd-loupe-info"><i class="eyd-loupe-sw"></i><span><b class="eyd-loupe-name"></b><em class="eyd-loupe-hex"></em></span></div>
      ${eydSizeControlHTML(true)}`;
    document.body.appendChild(loupe);
    loupe.querySelectorAll("[data-eydsize]").forEach(b => b.addEventListener("pointerdown", e => {
      e.stopPropagation(); e.preventDefault();
      setSampleSize(+b.dataset.eydsize);
      loupe.querySelectorAll("[data-eydsize]").forEach(x => { const on = x === b; x.classList.toggle("on", on); x.setAttribute("aria-pressed", on); });
      if (typeof buzz === "function") buzz(5);
      if (sess.resample) sess.resample();
    }));
    return loupe;
  };
  const closeLoupe = () => { if (loupe) { loupe.remove(); loupe = null; } };
  const drawLoupe = (s, px, py) => {
    const cv = loupe.querySelector(".eyd-loupe-cv"), cx = cv.getContext("2d");
    cx.imageSmoothingEnabled = false; cx.clearRect(0, 0, 132, 132);
    const half = 8;   // a 17x17 native-pixel neighborhood, each pixel ~7.8 CSS px — the finger never hides it
    const sx = clamp(px - half, 0, s.w - 1), sy = clamp(py - half, 0, s.h - 1);
    const sw = Math.min(half * 2 + 1, s.w - sx), sh = Math.min(half * 2 + 1, s.h - sy);
    cx.drawImage(s.c, sx, sy, sw, sh, 0, 0, 132, 132);
  };
  const position = (clientX, clientY) => {
    if (!loupe) return;
    const lw = 140, vw = innerWidth || document.documentElement.clientWidth;
    loupe.style.left = clamp(clientX, lw / 2 + 8, vw - lw / 2 - 8) + "px";
    loupe.style.top = Math.max(8, clientY - 172) + "px";   // above the thumb, never under it
  };
  let lastPt = null;
  const sampleAndShow = (clientX, clientY, final) => {
    const s = ensureSrc(); if (!s) return false;
    const m = eydMap(el, clientX, clientY); if (!m) return false;
    const r = eydSampleAt(s, m.fx, m.fy, getSampleSize()); if (!r) return false;
    openLoupe(); position(clientX, clientY); drawLoupe(s, r.px, r.py);
    const nm = typeof nameOf === "function" ? nameOf(r.hex) : null;
    loupe.querySelector(".eyd-loupe-sw").style.setProperty("--c", r.hex);
    loupe.querySelector(".eyd-loupe-name").textContent = nm && nm.n ? nm.n : "";
    loupe.querySelector(".eyd-loupe-hex").textContent = r.hex;
    if (r.hex !== lastHex) { lastHex = r.hex; if (typeof buzz === "function") buzz(4); }
    const fn = final ? o.onPick : o.onMove;
    if (typeof fn === "function") fn(r.hex, { x: r.px, y: r.py });
    return true;
  };
  sess.resample = () => { if (lastPt) sampleAndShow(lastPt.x, lastPt.y, false); };
  const down = e => {
    if (!e.isPrimary || e.button > 0) return;
    dragging = true; EYD_SESSION = sess; lastPt = { x: e.clientX, y: e.clientY };
    try { el.setPointerCapture(e.pointerId); } catch (err) {}
    sampleAndShow(e.clientX, e.clientY, false);
  };
  const move = e => { if (!dragging) return; lastPt = { x: e.clientX, y: e.clientY }; sampleAndShow(e.clientX, e.clientY, false); };
  const end = e => {
    if (!dragging) return;
    dragging = false; if (EYD_SESSION === sess) EYD_SESSION = null;
    sampleAndShow(e.clientX, e.clientY, true);
    closeLoupe();
  };
  const cancel = () => { dragging = false; if (EYD_SESSION === sess) EYD_SESSION = null; closeLoupe(); };
  el.addEventListener("pointerdown", down);
  el.addEventListener("pointermove", move);
  el.addEventListener("pointerup", end);
  el.addEventListener("pointercancel", cancel);
  el.addEventListener("contextmenu", e => e.preventDefault());
  return {
    detach() {
      el.removeEventListener("pointerdown", down); el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", end); el.removeEventListener("pointercancel", cancel);
      closeLoupe();
    },
  };
}
