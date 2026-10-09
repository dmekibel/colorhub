"use strict";
// Full-screen "Look closer" (David's painting-page rebuild brief, 2026-10-09, point 1): pinch/pan the picture
// itself, plus three switches that read the same coarse pixel data the painting page already builds for
// "On the painting" (js/gallery.js litBuild) -- no extra network or canvas work, just a bigger stage for it:
//   Value   greyscale, to see the light structure without color getting in the way
//   Squint  blurred, so the big shapes read before the detail does (a classic painting-study trick)
//   Where   pick a palette color; everywhere else dims, same as the page's own Highlight
// opts: { src, alt, title, pal: [{h,share}], pix: {w,h,L}|null (litBuild()'s coarse Lab read, or null when this
// image's pixels can't be read here, which just leaves Where out) }
function glZoomOpen(opts) {
  const scrim = document.createElement("div");
  scrim.className = "glz-scrim";
  scrim.innerHTML = `
    <div class="glz-top"><button class="icon-btn glass" data-glzclose aria-label="Close">${ICON.x}</button><span class="glz-title">${esc(opts.title || "")}</span></div>
    <div class="glz-stage"><div class="glz-frame"><img class="glz-img" src="${esc(opts.src)}" alt="${esc(opts.alt || "")}"><canvas class="glz-cv" aria-hidden="true"></canvas></div></div>
    <div class="glz-tools">
      <div class="seg glz-seg" role="group" aria-label="Look at it">
        <button data-glzv="value">Value</button><button data-glzv="squint">Squint</button>${opts.pix ? `<button data-glzv="where">Where</button>` : ""}
      </div>
      <div class="glz-pal" hidden role="group" aria-label="Which color"></div>
    </div>`;
  document.body.appendChild(scrim);
  const prevOverflow = document.body.style.overflow; document.body.style.overflow = "hidden";
  const frame = scrim.querySelector(".glz-frame"), cv = scrim.querySelector(".glz-cv"), stage = scrim.querySelector(".glz-stage");
  let Z = 1, P = [0, 0], active = null, palHex = null;
  const ZMAX = 6;
  const apply = () => { frame.style.transform = `translate(${P[0]}px,${P[1]}px) scale(${Z})`; };
  // pinch/pan/wheel, the same pointer-map pattern js/paintmap.js uses for its canvas
  const pts = new Map(); let drag = null, pinch = null;
  stage.addEventListener("pointerdown", e => {
    pts.set(e.pointerId, [e.clientX, e.clientY]);
    try { stage.setPointerCapture(e.pointerId); } catch (err) {}
    if (pts.size === 1) drag = { x: e.clientX, y: e.clientY, moved: false, x0: e.clientX, y0: e.clientY };
    else if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d0: Math.hypot(a[0] - b[0], a[1] - b[1]), z0: Z }; if (drag) drag.moved = true; }
  });
  stage.addEventListener("pointermove", e => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pinch && pts.size >= 2) { const [a, b] = [...pts.values()]; Z = clamp(pinch.z0 * Math.hypot(a[0] - b[0], a[1] - b[1]) / Math.max(10, pinch.d0), 1, ZMAX); apply(); return; }
    if (drag && pts.size === 1) {
      if (!drag.moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 6) return;
      drag.moved = true;
      P[0] += e.clientX - drag.x; P[1] += e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; apply();
    }
  });
  const up = e => { pts.delete(e.pointerId); if (pts.size < 2) pinch = null; if (!pts.size) drag = null; };
  stage.addEventListener("pointerup", up); stage.addEventListener("pointercancel", up);
  stage.addEventListener("wheel", e => { e.preventDefault(); Z = clamp(Z * Math.exp(-e.deltaY * .0015), 1, ZMAX); apply(); }, { passive: false });
  stage.addEventListener("dblclick", () => { Z = Z > 1.2 ? 1 : 2.4; if (Z === 1) P = [0, 0]; apply(); });
  stage.addEventListener("contextmenu", e => e.preventDefault());
  // Value / Squint / Where
  const setMode = m => {
    active = active === m ? null : m;
    scrim.querySelectorAll("[data-glzv]").forEach(b => { const on = b.dataset.glzv === active; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); });
    scrim.querySelector(".glz-img").style.filter = active === "value" ? "grayscale(1)" : active === "squint" ? "blur(min(2.5vw,16px))" : "";
    const palBox = scrim.querySelector(".glz-pal"); palBox.hidden = active !== "where";
    if (active !== "where") { cv.classList.remove("on"); palHex = null; } else drawPalRow();
    drawWhere();
  };
  const drawPalRow = () => {
    const box = scrim.querySelector(".glz-pal");
    box.innerHTML = (opts.pal || []).slice(0, 8).map(p => `<button data-glzc="${p.h}" style="--c:${p.h}" class="${palHex === p.h ? "on" : ""}" aria-label="${esc(typeof nameOf === "function" ? nameOf(p.h).n : p.h)}"></button>`).join("");
  };
  const drawWhere = () => {
    const P2 = opts.pix;
    if (!P2 || !palHex) { cv.classList.remove("on"); return; }
    cv.width = P2.w; cv.height = P2.h;
    const x = cv.getContext("2d"), out = x.createImageData(P2.w, P2.h), t = lab(palHex);
    for (let j = 0; j < P2.w * P2.h; j++) {
      const dd = Math.hypot(P2.L[j * 3] - t[0], P2.L[j * 3 + 1] - t[1], P2.L[j * 3 + 2] - t[2]);
      const o = j * 4; out.data[o] = 14; out.data[o + 1] = 13; out.data[o + 2] = 11; out.data[o + 3] = dd < 13 ? 0 : 205;
    }
    x.putImageData(out, 0, 0); cv.classList.add("on");
  };
  scrim.querySelector(".glz-tools").onclick = e => {
    const v = e.target.closest("[data-glzv]"); if (v) { if (typeof buzz === "function") buzz(5); setMode(v.dataset.glzv); return; }
    const c = e.target.closest("[data-glzc]"); if (c) { if (typeof buzz === "function") buzz(5); palHex = palHex === c.dataset.glzc ? null : c.dataset.glzc; drawPalRow(); drawWhere(); }
  };
  let closed = false;
  const close = () => {
    if (closed) return; closed = true;
    document.body.style.overflow = prevOverflow; scrim.remove(); document.removeEventListener("keydown", onKey);
  };
  const onKey = e => { if (e.key === "Escape") close(); };
  document.addEventListener("keydown", onKey);
  scrim.querySelector("[data-glzclose]").onclick = close;
  scrim.addEventListener("click", e => { if (e.target === scrim) close(); });
  // the scrim lives on <body>, outside the screen it opened over (so pinch/pan isn't clipped by the screen's own
  // transform), same reason js/richpage.js's rp-bar does. That means the screen swap that show() does on ANY
  // navigation away -- forward to another page, or Back/the iOS swipe-back gesture, which both re-render through
  // show() too -- never touches it on its own. Without this, swiping back while "Look closer" was open left this
  // near-opaque scrim (background rgba(6,6,5,.97), z-index 60, covering the full viewport) sitting over the page
  // behind it forever: the color page you landed on was really there, just invisible under it -- "the screen goes
  // black" (David, reported 2026-10-09). core.js show() runs every registered cleanup first, on every screen it
  // draws, so this is where every other body-level overlay already protects itself (js/browse-ui.js's jump nav,
  // js/richpage.js's rp-bar/rp-hold).
  cleanup.push(close);
  requestAnimationFrame(() => scrim.classList.add("in"));
  return { close };
}
