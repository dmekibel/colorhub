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
  // Gesture model (David, reported 2026-10-09: "it gets janky -- I can pan around and it gets stuck in weird
  // poses... I should only be able to zoom in, not zoom out too far"). Z is a real scale factor against the
  // image's OWN natural pixel size (not a 0-1..something-arbitrary knob): fitZ = the largest scale that still
  // shows the whole image in the stage (min(stageW/naturalW, stageH/naturalH)), computed once the image loads
  // and recomputed on resize/orientation change. Z can never go below fitZ -- "zoom out" below the size that
  // already shows everything doesn't mean anything here -- and never above fitZ*8. Pan is clamped every frame
  // so the image's own edges can never leave the stage: when the rendered size is <= the stage on an axis
  // there's nothing to pan on that axis (clamp range is exactly 0, matching "fit" always being centered, no
  // stuck half-panned state); when it's bigger, the clamp range is the overflow on each side. A live drag gets
  // soft rubber-band resistance past that range (so a flick at the edge still feels alive, not a hard wall);
  // it snaps back in bounds on release. Zoom itself is never rubber-banded -- David's ask was literal ("never
  // smaller"), so pinch/wheel are hard-clamped to [fitZ, maxZ] every frame, no overshoot to correct later.
  let Z = 1, P = [0, 0], active = null, palHex = null;
  let fitZ = 1, maxZ = 8, natW = 0, natH = 0;
  const computeFit = () => {
    natW = img.naturalWidth || 0; natH = img.naturalHeight || 0;
    const r = stage.getBoundingClientRect();
    const f = (natW && natH && r.width && r.height) ? Math.min(r.width / natW, r.height / natH) : 1;
    fitZ = Number.isFinite(f) && f > 0 ? f : 1;
    maxZ = fitZ * 8;
  };
  const panLimit = zVal => {
    const r = stage.getBoundingClientRect();
    const rw = natW * zVal, rh = natH * zVal;
    return [Math.max(0, (rw - r.width) / 2), Math.max(0, (rh - r.height) / 2)];
  };
  // a soft, diminishing-return resistance past a bound -- the further past, the less an extra px of finger
  // movement moves the image, so it never feels like it could run away ("stuck in weird poses")
  const rubber = over => over / (1 + Math.abs(over) / 140);
  const rubberClamp = (v, lo, hi) => v < lo ? lo + rubber(v - lo) : v > hi ? hi + rubber(v - hi) : v;
  const clampP = (p, zVal, soft) => {
    const [lx, ly] = panLimit(zVal);
    const cx = soft ? rubberClamp(p[0], -lx, lx) : clamp(p[0], -lx, lx);
    const cy = soft ? rubberClamp(p[1], -ly, ly) : clamp(p[1], -ly, ly);
    return [Number.isFinite(cx) ? cx : 0, Number.isFinite(cy) ? cy : 0];
  };
  const apply = () => {
    if (!Number.isFinite(Z) || Z <= 0) Z = fitZ || 1;
    if (!Number.isFinite(P[0])) P[0] = 0; if (!Number.isFinite(P[1])) P[1] = 0;
    frame.style.transform = `translate(${P[0]}px,${P[1]}px) scale(${Z})`;
  };
  const springFrame = (ms, after) => {
    frame.style.transition = `transform ${ms}ms var(--spring)`;
    const done = () => { frame.style.transition = ""; frame.removeEventListener("transitionend", done); if (after) after(); };
    frame.addEventListener("transitionend", done);
  };
  const resetView = () => { computeFit(); Z = fitZ; P = [0, 0]; frame.style.transition = ""; apply(); };
  if (img.complete && img.naturalWidth) resetView(); else img.addEventListener("load", resetView);
  const onResize = () => {
    computeFit(); Z = clamp(Z, fitZ, maxZ); P = clampP(P, Z, false);
    frame.style.transition = ""; apply();
  };
  window.addEventListener("resize", onResize);
  // zoom around a focal point (screen coords): the math that keeps the point under the fingers/cursor fixed
  // on screen while Z changes -- without this, a pinch zooms around the frame's center and the picture visibly
  // slides out from under your fingers (part of the "janky" report)
  const zoomAt = (fx, fy, newZRaw, soft) => {
    const newZ = clamp(newZRaw, fitZ, maxZ);
    if (!Number.isFinite(newZ) || newZ <= 0 || !Number.isFinite(Z) || Z <= 0) return;
    const r = stage.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const k = newZ / Z;
    if (Number.isFinite(k)) P = [(fx - cx) * (1 - k) + P[0] * k, (fy - cy) * (1 - k) + P[1] * k];
    Z = newZ; P = clampP(P, Z, soft); apply();
  };
  // pinch/pan/wheel/double-tap, with the same pointer hygiene the map got: every way a gesture can end
  // (pointerup, pointercancel, lostpointercapture, touchcancel -- iOS doesn't always send the first two) clears
  // it, a pointer older than STALE_MS is pruned defensively (a stuck phantom finger from a dropped event would
  // otherwise wedge pinch math forever), and every computed value is checked finite before it reaches style.
  // Stepped aside entirely while "Pick" or "Region" is active (their own tap/drag handlers own the gesture then).
  const pts = new Map(); let drag = null, pinch = null, raf = null;
  const STALE_MS = 2500;
  const stopMomentum = () => { if (raf) { cancelAnimationFrame(raf); raf = null; } };
  const snapBack = () => {
    const target = clampP(P, Z, false);
    if (Math.abs(target[0] - P[0]) < .5 && Math.abs(target[1] - P[1]) < .5) { P = target; apply(); return; }
    springFrame(320); P = target; apply();
  };
  const startMomentum = (vx0, vy0) => {
    stopMomentum();
    let vx = Number.isFinite(vx0) ? vx0 : 0, vy = Number.isFinite(vy0) ? vy0 : 0, last = performance.now();
    const step = now => {
      const dt = Math.min(48, now - last); last = now;
      const decay = Math.exp(-.0045 * dt);
      vx *= decay; vy *= decay;
      P[0] += vx * dt; P[1] += vy * dt;
      const [lx, ly] = panLimit(Z); let edge = false;
      if (P[0] < -lx) { P[0] = -lx; edge = true; vx = 0; } if (P[0] > lx) { P[0] = lx; edge = true; vx = 0; }
      if (P[1] < -ly) { P[1] = -ly; edge = true; vy = 0; } if (P[1] > ly) { P[1] = ly; edge = true; vy = 0; }
      apply();
      if (edge || (Math.abs(vx) < .02 && Math.abs(vy) < .02)) { raf = null; return; }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  };
  let lastTapT = 0, lastTapX = 0, lastTapY = 0;
  const maybeDoubleTap = (x, y) => {
    const now = performance.now();
    const isDouble = now - lastTapT < 320 && Math.hypot(x - lastTapX, y - lastTapY) < 24;
    lastTapT = isDouble ? 0 : now; lastTapX = x; lastTapY = y;
    if (!isDouble) return false;
    if (typeof buzz === "function") buzz(6);
    zoomAt(x, y, Z > fitZ * 1.15 ? fitZ : Math.min(maxZ, fitZ * 2.5), false);
    springFrame(280);
    return true;
  };
  const endPointer = e => {
    const aborted = e === null;   // touchcancel: the OS took the gesture away -- hard-stop, never carry momentum
    if (e && e.pointerId != null) pts.delete(e.pointerId); else pts.clear();
    if (pts.size < 2) pinch = null;
    if (!aborted && pts.size === 1) {
      const [[, v]] = pts;
      drag = { x: v.x, y: v.y, x0: v.x, y0: v.y, moved: true, lastT: performance.now(), vx: 0, vy: 0 };
      return;
    }
    if (!aborted && pts.size > 1) return;
    if (!aborted && drag && !drag.moved) { if (!maybeDoubleTap(drag.x, drag.y)) snapBack(); }
    else if (!aborted && drag && drag.moved && (Math.abs(drag.vx) > .02 || Math.abs(drag.vy) > .02)) startMomentum(drag.vx, drag.vy);
    else snapBack();
    drag = null;
  };
  stage.addEventListener("pointerdown", e => {
    if (active === "pick" || active === "region") return;
    stopMomentum(); frame.style.transition = "";
    const now = performance.now();
    for (const [id, v] of pts) if (now - v.t > STALE_MS) pts.delete(id);
    if (pts.size >= 2) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY, t: now });
    try { stage.setPointerCapture(e.pointerId); } catch (err) {}
    if (pts.size === 1) drag = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, moved: false, lastT: now, vx: 0, vy: 0 };
    else if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      pinch = { d0: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), z0: Z };
      if (drag) drag.moved = true;
    }
  });
  stage.addEventListener("pointermove", e => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now() });
    if (pinch && pts.size >= 2) {
      const [a, b] = [...pts.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y); if (!Number.isFinite(d) || d <= 0) return;
      zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, pinch.z0 * d / pinch.d0, false);
      return;
    }
    if (drag && pts.size === 1) {
      if (!drag.moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 6) return;
      drag.moved = true;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y, now = performance.now(), dt = Math.max(1, now - drag.lastT);
      drag.vx = dx / dt; drag.vy = dy / dt; drag.lastT = now;
      P = clampP([P[0] + dx, P[1] + dy], Z, true);
      drag.x = e.clientX; drag.y = e.clientY; apply();
    }
  });
  stage.addEventListener("pointerup", endPointer);
  stage.addEventListener("pointercancel", endPointer);
  stage.addEventListener("lostpointercapture", endPointer);
  stage.addEventListener("touchcancel", () => endPointer(null));
  stage.addEventListener("wheel", e => {
    if (active === "pick" || active === "region") return;
    e.preventDefault(); stopMomentum(); frame.style.transition = "";
    zoomAt(e.clientX, e.clientY, Z * Math.exp(-e.deltaY * .0015), false);
  }, { passive: false });
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
    stopMomentum(); window.removeEventListener("resize", onResize);
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
  // a QA accessor for the gesture fuzz test (tools/smoke/scenarios.js), the same pattern js/honey.js exposes
  // via HM_CTRL._qaState -- the raw camera state plus the bounds it should always be within, so the test can
  // assert on the gesture machinery itself rather than reading rendered pixels back out of a transform string
  scrim._glzQA = { state: () => ({ Z, P: P.slice(), fitZ, maxZ, natW, natH }), stopMomentum: () => stopMomentum(), reset: () => resetView() };
  return { close };
}
