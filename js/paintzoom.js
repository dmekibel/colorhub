"use strict";
// Full-screen "Look closer" (David's painting-page rebuild brief, 2026-10-09, point 1): pinch/pan the picture
// itself, plus five tools that read the same coarse pixel data the painting page already builds for "On the
// painting" (js/gallery.js litBuild) -- no extra network or canvas work, just a bigger stage for it:
//   Value   greyscale, to see the light structure without color getting in the way
//   Squint  blurred, so the big shapes read before the detail does (a classic painting-study trick)
//   Where   pick a palette color; everywhere else dims, same as the page's own Highlight
//   Pick    the eyedropper, explicit here too (David, relayed 2026-10-09: "pressing on the picture should make
//           it full screen, instead of instantly starting the color picker" -- a plain drag pans/zooms as
//           always; Pick arms eyedropAttach instead, same loupe + readout as the painting page's own button)
//   Region  tap any area (the dress, the sky) to see it lit alone with its own palette -- precomputed offline
//           (tools/regions_build.py, "Option A": SLIC + region-adjacency-graph color merging, js/gallery.js's
//           glRegionsFor/glPaintRegionMask), labeled honestly "this area" (no guessed object names)
// opts: { src, alt, title, pal: [{h,share}], pix: {w,h,L}|null (litBuild()'s coarse Lab read, or null when this
// image's pixels can't be read here, which just leaves Where/Pick out), galleryIndex: int|null (for Region) }
function glZoomOpen(opts) {
  const scrim = document.createElement("div");
  scrim.className = "glz-scrim";
  scrim.innerHTML = `
    <div class="glz-top"><button class="icon-btn glass" data-glzclose aria-label="Close">${ICON.x}</button><span class="glz-title">${esc(opts.title || "")}</span></div>
    <div class="glz-stage"><div class="glz-frame"><img class="glz-img" src="${esc(opts.src)}" alt="${esc(opts.alt || "")}"><canvas class="glz-cv" aria-hidden="true"></canvas></div></div>
    <div class="glz-tools">
      <div class="seg glz-seg" role="group" aria-label="Look at it">
        <button data-glzv="value">Value</button><button data-glzv="squint">Squint</button>${opts.pix ? `<button data-glzv="where">Where</button>` : ""}${typeof eyedropAttach === "function" ? `<button data-glzv="pick">${typeof icon === "function" ? icon("pipette", 15) : ""}<span>Pick</span></button>` : ""}${opts.galleryIndex != null ? `<button data-glzv="region" hidden>Region</button>` : ""}
      </div>
      <div class="glz-pal" hidden role="group" aria-label="Which color"></div>
      <p class="glz-region-hint" data-glzrhint hidden>Tap any area to see it alone, with its own palette.</p>
    </div>`;
  document.body.appendChild(scrim);
  const prevOverflow = document.body.style.overflow; document.body.style.overflow = "hidden";
  const frame = scrim.querySelector(".glz-frame"), cv = scrim.querySelector(".glz-cv"), stage = scrim.querySelector(".glz-stage"), img = scrim.querySelector(".glz-img");
  let Z = 1, P = [0, 0], active = null, palHex = null;
  const ZMAX = 6;
  const apply = () => { frame.style.transform = `translate(${P[0]}px,${P[1]}px) scale(${Z})`; };
  // pinch/pan/wheel, the same pointer-map pattern js/paintmap.js uses for its canvas -- stepped aside while
  // "Pick" is active (eydAttach, below, owns the gesture then; a one-finger drag samples, not pans)
  const pts = new Map(); let drag = null, pinch = null;
  stage.addEventListener("pointerdown", e => {
    if (active === "pick" || active === "region") return;
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
  stage.addEventListener("dblclick", () => { if (active !== "pick" && active !== "region") { Z = Z > 1.2 ? 1 : 2.4; if (Z === 1) P = [0, 0]; apply(); } });
  stage.addEventListener("contextmenu", e => e.preventDefault());
  // "Pick": eyedropAttach (js/eyedrop.js) on the zoomed image itself, armed only while this tool is active, so
  // it never fights the pan/pinch handlers above (D+E of David's palette-engine brief, 2026-10-09). The readout
  // card's "Where else" switches straight into the Where tool with the sampled hex, even when it isn't one of
  // the painting's own named palette colors.
  // Region: fetch once, reveal the tool only once real region data comes back (never offer a tool that would
  // just sit there doing nothing -- most paintings have regions, but a few have no cached image or too flat a
  // palette to clear the area floor, tools/regions_build.py's MIN_REGION_SHARE)
  let regionData = null, regionLabel = null, regionSheetClose = null;
  if (opts.galleryIndex != null && typeof glRegionsFor === "function") {
    glRegionsFor(opts.galleryIndex).then(rd => {
      if (!rd || !rd.regions || !rd.regions.length) return;
      regionData = rd;
      const btn = scrim.querySelector('[data-glzv="region"]'); if (btn) btn.hidden = false;
    }).catch(() => {});
  }
  let eyd = null;
  const syncPick = () => {
    if (eyd) { eyd.detach(); eyd = null; }
    if (active === "pick" && typeof eyedropAttach === "function") {
      eyd = eyedropAttach(img, { onPick: hex => {
        if (typeof buzz === "function") buzz(6);
        if (typeof glColorReadout === "function") glColorReadout(hex, { pal: opts.pal, locateHex: opts.pix ? (h => {
          palHex = h;
          if (active !== "where") {
            active = "where";
            scrim.querySelectorAll("[data-glzv]").forEach(b => { const on = b.dataset.glzv === "where"; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); });
            scrim.querySelector(".glz-img").style.filter = ""; scrim.querySelector(".glz-pal").hidden = false; syncPick();
          }
          drawPalRow(); drawWhere();
        }) : null });
      } });
    }
  };
  // Value / Squint / Where / Pick / Region
  const setMode = m => {
    active = active === m ? null : m;
    scrim.querySelectorAll("[data-glzv]").forEach(b => { const on = b.dataset.glzv === active; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); });
    scrim.querySelector(".glz-img").style.filter = active === "value" ? "grayscale(1)" : active === "squint" ? "blur(min(2.5vw,16px))" : "";
    const palBox = scrim.querySelector(".glz-pal"); palBox.hidden = active !== "where";
    if (active !== "where") { cv.classList.remove("on"); palHex = null; } else drawPalRow();
    const hint = scrim.querySelector("[data-glzrhint]"); if (hint) hint.hidden = active !== "region";
    if (active !== "region") { regionLabel = null; if (regionSheetClose) { regionSheetClose(); regionSheetClose = null; } if (active !== "where") cv.classList.remove("on"); }
    drawWhere(); syncPick();
  };
  // Region: a tap (not a drag -- pan/pinch are gated off above while this tool is active) picks whichever
  // region sits under the finger, lights it alone (glPaintRegionMask, the same soft-blur treatment as Where)
  // and opens a compact sheet with that region's own palette -- By area / Diverse / Stands out, the shared
  // slider, every chip opening its color page in one tap, same as the rest of the app.
  const pickRegion = (clientX, clientY) => {
    if (!regionData || typeof eydMap !== "function" || typeof glRegionAt !== "function") return;
    const m = eydMap(img, clientX, clientY); if (!m) return;
    const label = glRegionAt(regionData, m.fx, m.fy);
    if (!label) return;
    const region = regionData.regions[label - 1]; if (!region) return;
    regionLabel = label;
    if (typeof buzz === "function") buzz(6);
    glPaintRegionMask(cv, regionData, label); cv.classList.add("on");
    if (regionSheetClose) regionSheetClose();
    regionSheetClose = typeof glRegionSheet === "function" ? glRegionSheet(region, () => { regionLabel = null; cv.classList.remove("on"); }) : null;
  };
  img.addEventListener("click", e => { if (active === "region") pickRegion(e.clientX, e.clientY); });
  const drawPalRow = () => {
    const box = scrim.querySelector(".glz-pal");
    box.innerHTML = (opts.pal || []).slice(0, 8).map(p => `<button data-glzc="${p.h}" style="--c:${p.h}" class="${palHex === p.h ? "on" : ""}" aria-label="${esc(typeof nameOf === "function" ? nameOf(p.h).n : p.h)}"></button>`).join("");
  };
  // the same soft mask the painting page's own "Where" uses (js/gallery.js glPaintMask) -- a smooth ΔE falloff,
  // speckle filter and box blur instead of a hard per-pixel cut (David's audit, 2026-10-09: blocky, glitchy)
  const drawWhere = () => {
    const P2 = opts.pix;
    if (!P2 || !palHex || typeof glPaintMask !== "function") { cv.classList.remove("on"); return; }
    glPaintMask(cv, P2, palHex); cv.classList.add("on");
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
