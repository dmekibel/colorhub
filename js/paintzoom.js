"use strict";
// Full-screen "Look closer" (David's painting-page rebuild brief, 2026-10-09, point 1): pinch/pan the picture
// itself, plus five tools that read the same coarse pixel data the painting page already builds for "On the
// painting" (js/gallery.js litBuild) -- no extra network or canvas work, just a bigger stage for it:
//   Value   greyscale, to see the light structure without color getting in the way
//   Squint  blurred, so the big shapes read before the detail does (a classic painting-study trick)
//   Where   pick a palette color; everywhere else dims, same as the page's own Highlight
//   Pick    the palette editor (David, 2026-10-20): tap the painting to drop a loupe + a swatch, drag loupes (the
//           swatch follows live), reorder/remove swatches, save the palette. Pan and pinch stay live; see "Pick: the
//           palette editor" below. (Replaced the one-shot eyedropAttach version.)
//   Select  tap the thing you want (the dress, the sky, the sleeve) and get a real object mask, not a guessed
//           color region -- MobileSAM, on-device (js/segment.js, greenlit 2026-10-09 after a measured
//           prototype). Replaces the old precomputed SLIC "Region" tool entirely (data/regions/,
//           tools/regions_build.py and js/gallery.js's glRegionsFor/glPaintRegionMask/glRegionAt/
//           glRegionSheet are gone in the same change this landed in) -- this one really is the object you
//           pointed at, with +/- taps to refine it, not a fixed color-boundary guess.
// opts: { src, alt, title, pal: [{h,share}], pix: {w,h,L}|null (litBuild()'s coarse Lab read, or null when this
// image's pixels can't be read here, which just leaves Where/Pick out), galleryIndex: int|null (unused by
// Select, kept for callers that still pass it), startTool: "value"|"squint"|"where"|"pick"|"select"|null (opens
// straight into that tool -- js/gallery.js's ⋯ › Look group, PLAN §3.6, jumps here instead of making the
// visitor pick the tool twice) }
const GLZ_PALETTES = {};   // Pick editor: each painting's palette, kept for the session (key g<index> or the image src)
function glZoomOpen(opts) {
  const scrim = document.createElement("div");
  scrim.className = "glz-scrim";
  scrim.innerHTML = `
    <div class="glz-top"><button class="tl-exit" data-glzclose aria-label="Done, back to the painting">${ICON.back}<span>Done</span></button><span class="glz-title">${esc(opts.title || "")}</span><span class="glz-zc" data-glzzc role="group" aria-label="Zoom"><button type="button" data-glzfit>Fit</button><button type="button" data-glz100>100%</button></span>${opts.onDetails ? `<button type="button" class="glz-details" data-glzdetails>Open the page</button>` : ""}<span class="glz-pk-slot" data-glz-pk>${typeof pkButtonHTML === "function" ? pkButtonHTML() : ""}</span></div>
    <div class="glz-stage"><div class="glz-frame"><img class="glz-img" src="${esc(opts.src)}"${opts.cors ? ' crossorigin="anonymous"' : ""} alt="${esc(opts.alt || "")}"><canvas class="glz-cv" aria-hidden="true"></canvas><div class="glz-pk-layer" data-glzpklayer hidden></div></div>${typeof eydPreviewHTML === "function" ? eydPreviewHTML() : ""}</div>
    <p class="glz-cap" aria-hidden="true"><b>${esc(opts.title || "")}</b>${opts.sub ? `<span>${esc(opts.sub)}</span>` : ""}</p>
    <div class="glz-tools">
      <div class="seg glz-seg" role="group" aria-label="Look at it">
        <button data-glzv="value">Value</button><button data-glzv="squint">Squint</button>${opts.pix ? `<button data-glzv="where">Where</button>` : ""}${typeof eyedropAttach === "function" ? `<button data-glzv="pick">${typeof icon === "function" ? icon("pipette", 15) : ""}<span>Pick</span></button>` : ""}${opts.src && typeof segProbe === "function" ? `<button data-glzv="select" hidden>Select</button>` : ""}
      </div>
      <div class="glz-pal" hidden role="group" aria-label="Which color"></div>
      <div class="glz-pk" data-glzpk hidden>
        <div class="glz-pk-info" data-glzpkinfo aria-live="polite"></div>
        <div class="glz-pk-strip" data-glzpkstrip role="listbox" aria-label="Your palette, in order"></div>
        <div class="glz-pk-act" data-glzpkact></div>
        <div class="glz-pk-size" data-glzpksize>${typeof eydSizeControlHTML === "function" ? eydSizeControlHTML() : ""}</div>
      </div>
      <div class="glz-sel" data-glzsel hidden>
        <div class="glz-sel-prog" data-glzselprog hidden>
          <p class="glz-sel-prog-label" data-glzselproglabel></p>
          <div class="glz-sel-bar"><i data-glzselbar></i></div>
          <p class="fine glz-sel-wifi" data-glzselwifi hidden>Downloads once, then works without a connection. Best on Wi-Fi.</p>
        </div>
        <p class="glz-tool-hint" data-glzselhint hidden>Getting ready&hellip;</p>
        <details class="fine glz-sel-errdetail" data-glzselerrdetail hidden><summary>Details</summary><p data-glzselerrmsg></p></details>
        <div class="glz-sel-ctl" data-glzselctl hidden>
          <div class="seg glz-sel-pm" role="group" aria-label="Tap mode">
            <button data-glzselpm="1" aria-pressed="true" aria-label="Add to the selection">+</button>
            <button data-glzselpm="0" aria-pressed="false" aria-label="Remove from the selection">&minus;</button>
          </div>
          <button class="glz-sel-btn" data-glzselundo disabled>Undo</button>
          <button class="glz-sel-btn" data-glzselclear disabled>Clear</button>
        </div>
      </div>
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
  // The hover-pan loupe (desktop, opened from a map card; David, 2026-10-21). LP = this viewer was opened from a card.
  // Zoomed up to 4x fit with loupeOn, the mouse position across the window maps to the position across the picture
  // (the window's left edge shows the picture's left edge), eased ~120ms. Past 4x (or after a wheel/trackpad move)
  // it is a free zoom: drag pans, two-finger scroll pans 1:1, wheel/pinch zooms about the cursor. Space freezes the loupe.
  const DESKV = document.documentElement.classList.contains("desk");
  const LP = !!opts.fromRect || DESKV;
  let firstShown = false, enterRect = null, closed = false, loupeOn = false, spaceDown = false, lastPtype = "touch", armPos = null, lastMouse = null, tgt = null, lpRaf = 0, lpT = 0;
  const LP_MAX = 4.05;
  let fitZ = 1, maxZ = 8, natW = 0, natH = 0;
  const computeFit = () => {
    natW = img.naturalWidth || 0; natH = img.naturalHeight || 0;
    const r = stage.getBoundingClientRect();
    // desktop: the whole painting with breathing room on black (immersive, David 2026-10-21)
    const pad = DESKV ? Math.max(36, Math.min(r.width, r.height) * .05) : 0;
    const f = (natW && natH && r.width && r.height) ? Math.min((r.width - 2 * pad) / natW, (r.height - 2 * pad) / natH) : 1;
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
  let pkAfterApply = null;   // Pick: keep the ring's size and the preview's corner right as the picture zooms and pans
  const apply = () => {
    if (!Number.isFinite(Z) || Z <= 0) Z = fitZ || 1;
    if (!Number.isFinite(P[0])) P[0] = 0; if (!Number.isFinite(P[1])) P[1] = 0;
    frame.style.transform = `translate(${P[0]}px,${P[1]}px) scale(${Z})`;
    if (LP) stage.dataset.cur = Z <= fitZ * 1.05 ? "fit" : (loupeOn && !spaceDown && Z <= fitZ * LP_MAX) ? "loupe" : "free";
    frame.style.setProperty("--iz", String(1 / Z));   // the Pick reticle lives inside the frame and counter-scales, so it stays one size on screen but glued to its painting point
    if (pkAfterApply) pkAfterApply();
  };
  const springFrame = (ms, after) => {
    frame.style.transition = `transform ${ms}ms var(--spring)`; scrim.classList.add("glz-spring");
    const done = () => { frame.style.transition = ""; scrim.classList.remove("glz-spring"); frame.removeEventListener("transitionend", done); if (after) after(); };
    frame.addEventListener("transitionend", done);
  };
  const resetView = () => { computeFit(); Z = fitZ; P = [0, 0]; frame.style.transition = ""; apply(); };
  // Same CORS-flake defense as js/gallery.js's own hero image: a host on the "safe" allowlist can still drop
  // its CORS header on any single request (found live on the Met's Imperva CDN -- the identical URL answered
  // with the header moments earlier from a plain curl). With crossorigin="anonymous" set and that header
  // missing, the <img> doesn't just lose pixel-read access -- it fails to load AT ALL, leaving Look closer's
  // whole stage blank. One retry without crossOrigin keeps the picture visible; Pick/Where then honestly find
  // nothing to read (opts.sampleOk below), instead of a dead, unexplained gap where the painting should be.
  // opts.fallback is the smaller copy the page already shows: if the big URL fails for any reason (a host that
  // doesn't serve that size, a dropped request) the viewer falls back to it first, then to the no-crossorigin retry.
  let zFell = !opts.fallback, zPlain = !img.crossOrigin;
  img.addEventListener("error", () => {
    if (!zFell) { zFell = true; img.addEventListener("load", resetView, { once: true }); img.src = opts.fallback; return; }
    if (zPlain) return;
    zPlain = true; const src = img.src; img.crossOrigin = null; img.addEventListener("load", resetView, { once: true }); img.src = ""; img.src = src;
  });
  // Opened from a map card (opts.fromRect = the card's rectangle on screen, opts.focal = the clicked point as 0..1 of the picture):
  // the picture grows out of the card and lands zoomed in on the point that was clicked (David, 2026-10-21), ~260ms ease-out, no bounce.
  const ZIN_EASE = "cubic-bezier(.2,.7,.2,1)";
  const enterFrom = () => {
    const fr = opts.fromRect; if (!fr || !natW || !natH || !fr.width || !fr.height) return;
    const r = stage.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const z0 = Math.min(fr.width / natW, fr.height / natH), p0 = [fr.left + fr.width / 2 - cx, fr.top + fr.height / 2 - cy];
    enterRect = { z0, p0 };
    let z1 = fitZ, p1 = [0, 0];
    if (opts.focal) {
      z1 = clamp(fitZ * 2.5, fitZ, maxZ);
      p1 = clampP([-(opts.focal.fx - .5) * natW * z1, -(opts.focal.fy - .5) * natH * z1], z1, false);
    }
    loupeOn = !!opts.focal; if (loupeOn) { armPos = { x: opts.focal.cx, y: opts.focal.cy }; showHint(); }
    frame.style.transition = "none"; Z = z0; P = p0; apply(); frame.getBoundingClientRect();
    if (matchMedia("(prefers-reduced-motion:reduce)").matches) { Z = z1; P = p1; frame.style.transition = ""; apply(); return; }
    frame.style.transition = `transform 260ms ${ZIN_EASE}`; Z = z1; P = p1; apply();
    setTimeout(() => { if (!closed) frame.style.transition = ""; }, 300);
  };
  const firstShow = () => { resetView(); if (!firstShown) { firstShown = true; enterFrom(); } };
  if (img.complete && img.naturalWidth) firstShow(); else img.addEventListener("load", firstShow);
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
  // Stepped aside entirely while "Select" is active (its own tap handler owns the gesture then). Pick keeps pan and
  // pinch live (its pickers are glued to image coordinates); a still tap there drops a picker.
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
    // a mouse (html.desk): double-click toggles Fit and real size (100%, one image pixel per screen pixel)
    const real = document.documentElement.classList.contains("desk") && fitZ < .9 ? 1 : Math.min(maxZ, fitZ * 2.5);
    zoomAt(x, y, Z > fitZ * 1.15 ? fitZ : real, false);
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
    // Pick: a still tap on the painting drops a new picker (pan and pinch stay live; double-tap zoom steps aside)
    if (!aborted && drag && drag.ret) { if (!drag.moved) pkSetFromPoint(drag.x, drag.y); snapBack(); }   // a still tap jumps the reticle there; a drag just ends
    else if (!aborted && drag && !drag.moved) { if (LP && lastPtype === "mouse") loupeClick(drag.x, drag.y); else if (!maybeDoubleTap(drag.x, drag.y)) snapBack(); }
    else if (!aborted && drag && drag.moved && (Math.abs(drag.vx) > .02 || Math.abs(drag.vy) > .02)) startMomentum(drag.vx, drag.vy);
    else snapBack();
    drag = null;
  };
  stage.addEventListener("pointerdown", e => {
    if (active === "select") return;
    lastPtype = e.pointerType || "mouse";
    stopMomentum(); frame.style.transition = "";
    const now = performance.now();
    for (const [id, v] of pts) if (now - v.t > STALE_MS) pts.delete(id);
    if (pts.size >= 2) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY, t: now });
    try { stage.setPointerCapture(e.pointerId); } catch (err) {}
    // Pick: one finger moves the reticle (relative motion, offset from the finger); a mouse drags it directly
    if (pts.size === 1) {
      drag = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, moved: false, lastT: now, vx: 0, vy: 0, ret: active === "pick" };
      if (drag.ret && e.pointerType === "mouse") pkSetFromPoint(e.clientX, e.clientY);
    }
    else if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      pinch = { d0: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), z0: Z };
      if (drag) drag.moved = true;
    }
  });
  stage.addEventListener("pointermove", e => {
    if (LP && e.pointerType === "mouse" && !e.buttons) { hoverMove(e.clientX, e.clientY); return; }
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
      if (drag.ret) {
        if (e.pointerType === "mouse") pkSetFromPoint(e.clientX, e.clientY);
        else { const r = img.getBoundingClientRect(); pkMoveBy((e.clientX - drag.x) / r.width, (e.clientY - drag.y) / r.height); }
        drag.x = e.clientX; drag.y = e.clientY; return;
      }
      if (LP && lastPtype === "mouse" && loupeOn && Z <= fitZ * LP_MAX) { drag.x = e.clientX; drag.y = e.clientY; return; }   // in the loupe the mouse looks around by hovering; a drag does nothing
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
    if (active === "select") return;
    e.preventDefault(); stopMomentum(); frame.style.transition = "";
    if (LP) {
      const k = wheelKind(e);
      if (k === "pad" && Z > fitZ * 1.02) { loupeOn = false; P = clampP([P[0] - wheelPx(e, e.deltaX), P[1] - wheelPx(e, e.deltaY)], Z, false); apply(); return; }   // two-finger scroll pans 1:1
      loupeOn = false;
      zoomAt(e.clientX, e.clientY, Z * Math.exp(-wheelPx(e, e.deltaY) * (k === "pinch" ? .01 : .0015)), false);
      return;
    }
    zoomAt(e.clientX, e.clientY, Z * Math.exp(-e.deltaY * .0015), false);
  }, { passive: false });
  // ---- the loupe's own pieces ----
  const ZEASE = "cubic-bezier(.2,.7,.2,1)";
  const animTo = fn => { frame.style.transition = `transform 260ms ${ZEASE}`; fn(); lpT = performance.now() + 300; setTimeout(() => { if (!closed && performance.now() >= lpT - 5) frame.style.transition = ""; }, 310); };
  const loupeActive = () => LP && loupeOn && !spaceDown && Z > fitZ * 1.05 && Z <= fitZ * LP_MAX;
  const hoverTarget = (mx, my) => {
    const r = stage.getBoundingClientRect(), [lx, ly] = panLimit(Z);
    const u = clamp((mx - r.left) / (r.width || 1), 0, 1), v = clamp((my - r.top) / (r.height || 1), 0, 1);
    return [(.5 - u) * 2 * lx, (.5 - v) * 2 * ly];   // left edge of the window = left edge of the picture; an axis that already fits has no range, so stays centered
  };
  const lpStep = now => {
    lpRaf = 0; if (!loupeActive() || !tgt) return;
    const dt = Math.min(48, now - (lpStep.t || now)); lpStep.t = now;
    const a = 1 - Math.exp(-dt / 45);
    P = [P[0] + (tgt[0] - P[0]) * a, P[1] + (tgt[1] - P[1]) * a]; apply();
    if (Math.abs(tgt[0] - P[0]) > .3 || Math.abs(tgt[1] - P[1]) > .3) lpRaf = requestAnimationFrame(lpStep); else { P = tgt.slice(); apply(); lpStep.t = 0; }
  };
  const hoverMove = (mx, my) => {
    lastMouse = { x: mx, y: my };
    if (armPos) { if (Math.hypot(mx - armPos.x, my - armPos.y) < 5) return; armPos = null; }
    if (!loupeActive() || performance.now() < lpT) return;
    frame.style.transition = ""; tgt = hoverTarget(mx, my);
    if (!lpRaf) { lpStep.t = 0; lpRaf = requestAnimationFrame(lpStep); }
  };
  const goFit = () => { loupeOn = false; animTo(() => { Z = fitZ; P = [0, 0]; apply(); }); };
  const loupeClick = (x, y) => {
    if (Z > fitZ * 1.15) { goFit(); return; }
    loupeOn = true; armPos = { x, y }; showHint();
    animTo(() => zoomAt(x, y, fitZ * 2.5, false));
  };
  function showHint() {
    let seen = false; try { seen = !!localStorage.getItem("glz-loupe-hint"); localStorage.setItem("glz-loupe-hint", "1"); } catch (e) {}
    if (seen || !stage) return;
    const h = document.createElement("div"); h.className = "glz-hint"; h.textContent = "Move to look around \u00b7 Esc to close"; stage.appendChild(h);
    setTimeout(() => h.classList.add("out"), 3200); setTimeout(() => h.remove(), 3700);
  }
  if (LP) {
    document.addEventListener("keydown", e => { if (e.key === " " && loupeOn && !closed) { e.preventDefault(); spaceDown = true; apply(); } });
    document.addEventListener("keyup", e => { if (e.key === " " && spaceDown) { spaceDown = false; armPos = lastMouse; apply(); } });
  }
  stage.addEventListener("contextmenu", e => e.preventDefault());
  // "Pick": eyedropAttach (js/eyedrop.js) on the zoomed image itself, armed only while this tool is active, so
  // it never fights the pan/pinch handlers above (D+E of David's palette-engine brief, 2026-10-09). The readout
  // card's "Where else" switches straight into the Where tool with the sampled hex, even when it isn't one of
  // the painting's own named palette colors.
  // Select: fetch nothing upfront (unlike the old Region tool, there's no precomputed data to wait for) --
  // instead probe once, cheaply, whether this image's host even lets the encoder read its pixels at all
  // (js/segment.js's segProbe: a real 1x1 canvas read, cached per host for the session), and reveal the tool
  // enabled or honestly disabled accordingly. Never a silent dead button (David's own instruction, 2026-10-09:
  // "if neither [a CORS-clean host nor a local copy], disable Select with an honest note").
  if (opts.src && typeof segProbe === "function") {
    segProbe(opts.src).then(ok => {
      const btn = scrim.querySelector('[data-glzv="select"]'); if (!btn) return;
      btn.hidden = false;
      if (!ok) { btn.disabled = true; btn.title = "Select isn't available for this museum's photo yet"; }
    });
  }
  // ===== Pick: the palette editor (David, 2026-10-20) =====
  // Tap the painting and a small loupe (a ring filled with the sampled color, hollow in the middle so the exact
  // spot stays visible) lands there; its color becomes a square swatch in the strip below. Every loupe stays on
  // the painting. Drag one and its swatch updates live; select a swatch and its loupe is the active one (and the
  // other way round). Loupes are stored in IMAGE space (fx, fy = 0..1 of the picture) and live inside the zoomed
  // frame, counter-scaled by --iz, so pinch and pan can never separate a loupe from its painting point. The pixel
  // source is the same one the old Pick used (js/eyedrop.js eydSource/eydSampleAt), so a host that can't be read
  // is still answered honestly, never silently. The palette is kept per painting in GLZ_PALETTES for the session.
  // EXCEPTION to "one tap on a color opens its page" (David, 2026-10-08): inside this editor a tap on a swatch
  // SELECTS it (it has to, to reorder, remove and adjust). The open-the-page affordance is the explicit name
  // button above the strip, with an arrow.
  const pkKey = opts.galleryIndex != null ? "g" + opts.galleryIndex : String(opts.src || "");
  const PKS = GLZ_PALETTES[pkKey] || (GLZ_PALETTES[pkKey] = { picks: [], active: null, seq: 0, savedId: null, savedSig: "", ret: null });
  const pkLayer = scrim.querySelector("[data-glzpklayer]"), pkPanel = scrim.querySelector("[data-glzpk]"), pkInfo = scrim.querySelector("[data-glzpkinfo]");
  const pkStrip = scrim.querySelector("[data-glzpkstrip]"), pkActEl = scrim.querySelector("[data-glzpkact]"), pkPrev = stage.querySelector(".eyd-prev"), pkSizeEl = scrim.querySelector("[data-glzpksize]");
  const PK_MAX = 100;
  let pkSrc = null, pkBlocked = false, pkSwallowClick = 0, pkRet = null, pkLive = null, pkLiveName = null, pkRaf = 0;
  const pkGet = id => PKS.picks.find(p => p.id === id);
  const pkSource = () => {
    if (!pkSrc || pkSrc.key !== img.currentSrc) { const s2 = typeof eydSource === "function" ? eydSource(img) : null; pkSrc = s2 ? Object.assign(s2, { key: img.currentSrc }) : null; }
    return pkSrc;
  };
  img.addEventListener("load", () => { pkSrc = null; });
  const pkSample = (fx, fy) => {
    const s2 = pkSource(); if (!s2) { pkBlocked = true; return null; }
    const r = eydSampleAt(s2, fx, fy, typeof getSampleSize === "function" ? getSampleSize() : 1);
    return r ? r.hex : null;
  };
  const pkNameOf = hex => {
    const nm = typeof nameOf === "function" ? nameOf(hex) : null;
    return { nm, label: nm && nm.n ? (typeof nameOfTapped === "function" ? nameOfTapped(hex, nm) : nm.n) : "Your color" };
  };
  // image fraction -> screen point (the picture's rect already carries the live pan/zoom)
  const pkScreen = p => { const r = img.getBoundingClientRect(); return { x: r.left + p.fx * r.width, y: r.top + p.fy * r.height }; };
  // ----- the reticle (Adobe Capture style, David 2026-10-25): ONE ring that you move around; "+" keeps its color -----
  const pkRingEl = () => pkLayer.querySelector(".eyd-ret") || (pkLayer.insertAdjacentHTML("beforeend", typeof eydReticleHTML === "function" ? eydReticleHTML() : ""), pkLayer.querySelector(".eyd-ret"));
  // the preview sits top-left of the picture area, top-right when the ring is under it
  const pkLayoutPrev = () => {
    if (!pkPrev || pkPrev.hidden || !pkRet) return;
    const sr = stage.getBoundingClientRect(), q = pkScreen(pkRet), x = q.x - sr.left, y = q.y - sr.top;
    const pv = pkPrev.offsetWidth || 120, ph = pkPrev.offsetHeight || pv + 40, pad = 10, d = (pkRingEl().offsetWidth || 44) / 2 + 4;
    const hit = l => x > l - d && x < l + pv + d && y > pad - d && y < pad + ph + d;
    const useRight = hit(pad) && !hit(sr.width - pad - pv);
    pkPrev.style.left = (useRight ? sr.width - pad - pv : pad) + "px"; pkPrev.style.top = pad + "px";
    pkPrev.classList.toggle("eyd-prev-r", useRight);
  };
  // the ring's own size (it grows with the averaged area) and the screen-px-per-source-px scale
  const pkScale = () => { const s2 = pkSource(), r = img.getBoundingClientRect(); return s2 && r.width ? r.width / s2.w : 1; };
  const pkLayoutRing = () => {
    if (!pkRet) return;
    const s2 = pkSource(), ring = pkRingEl();
    ring.style.left = (pkRet.fx * 100) + "%"; ring.style.top = (pkRet.fy * 100) + "%";
    ring.style.setProperty("--d", (s2 ? eydRingPx(eydN(s2, getSampleSize()), pkScale()) : 44) + "px");
  };
  pkAfterApply = () => { if (pkRet && !pkLayer.hidden) { pkLayoutRing(); pkLayoutPrev(); } };
  // read the live color under the ring, redraw the close-up, and (when the color or the selection changed) the readout
  const pkUpdate = (force) => {
    if (!pkRet) return;
    const s2 = pkSource(); if (!s2) { pkBlocked = true; pkRenderInfo(); return; }
    const r = eydSampleAt(s2, pkRet.fx, pkRet.fy, getSampleSize());
    pkLayoutRing(); pkLayoutPrev();
    if (!r) return;
    eydPreviewDraw(pkPrev, s2, pkRet.fx, pkRet.fy, r.n, pkScale(), r.hex);
    const nm = pkNameOf(r.hex).label;
    if (nm !== pkLiveName && pkLiveName !== null && typeof buzz === "function") buzz(3);
    if (r.hex !== pkLive || nm !== pkLiveName || force) { pkLive = r.hex; pkLiveName = nm; pkRenderInfo(); pkRenderAct(); }
  };
  const pkSchedule = () => { if (!pkRaf) pkRaf = requestAnimationFrame(() => { pkRaf = 0; pkUpdate(); }); };
  // move the ring (image fractions); a selected swatch lets go, because the ring is live again
  const pkPlaceRet = (fx, fy) => {
    pkRet = PKS.ret = { fx: clamp(fx, 0, 1), fy: clamp(fy, 0, 1) };
    if (PKS.active) { PKS.active = null; pkRenderStrip(); }
    pkSchedule();
  };
  const pkSetFromPoint = (x, y) => { const m = typeof eydMap === "function" ? eydMap(img, x, y) : null; if (m) pkPlaceRet(m.fx, m.fy); };
  const pkMoveBy = (dfx, dfy) => { if (pkRet) pkPlaceRet(pkRet.fx + dfx, pkRet.fy + dfy); };
  const pkSig = () => PKS.picks.map(p => p.hex).join();
  const pkRenderInfo = () => {
    const a = pkGet(PKS.active);
    if (pkBlocked) { pkInfo.innerHTML = `<p class="glz-pk-hint">This museum's photo can't be read here, so colors can't be picked from it.</p>`; return; }
    const hex = a ? a.hex : pkLive;
    if (!hex) { pkInfo.innerHTML = `<p class="glz-pk-hint">Drag anywhere on the painting to pick a color.</p>`; return; }
    const { nm, label } = pkNameOf(hex), n = PKS.picks.length;
    const where = a ? `${PKS.picks.indexOf(a) + 1} of ${n}` : n ? `${n} added` : "Tap + to keep it";
    pkInfo.innerHTML = `<button class="glz-pk-name" data-glzpkopen aria-label="Open the page for ${esc(nm && nm.n ? nm.n : label)}"><span>${esc(label)}</span>${typeof ICON !== "undefined" ? ICON.arrow : ""}</button>
      <p class="glz-pk-sub"><span class="glz-pk-hex">${esc(hex)}</span><span aria-hidden="true"> · </span>${where}</p>`;
  };
  const pkRenderAct = () => {
    const n = PKS.picks.length, saved = n >= 2 && PKS.savedSig === pkSig();
    pkActEl.innerHTML = `<button class="glz-pk-save" data-glzpksave${n < 2 || saved ? " disabled" : ""}>${saved ? "Saved to Kept" : "Save palette"}</button>${n === 0 ? `<span class="glz-pk-note">Add two colors to save</span>` : n === 1 ? `<span class="glz-pk-note">Add one more color to save</span>` : `<span class="glz-pk-note">${n} colors</span>`}`;
  };
  const pkRenderStrip = () => {
    const keep = pkStrip.scrollLeft;
    pkStrip.innerHTML = PKS.picks.map(p => {
      const on = p.id === PKS.active;
      return `<div class="glz-sw-w" data-id="${p.id}"><button class="glz-sw${on ? " on" : ""}" style="--c:${p.hex}" role="option" aria-selected="${on}" aria-label="${esc(pkNameOf(p.hex).label)}, ${p.hex}"></button>${on ? `<button class="glz-sw-x" data-glzpkx aria-label="Remove this color"><svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button>` : ""}</div>`;
    }).join("") + `<button class="glz-sw glz-sw-add" data-glzpkadd aria-label="Add a color">+</button>`;
    pkStrip.scrollLeft = keep;
  };
  const pkRender = () => { pkRenderStrip(); pkRenderInfo(); pkRenderAct(); };
  const pkScrollToActive = smooth => {
    const w = pkStrip.querySelector(`.glz-sw-w[data-id="${PKS.active}"]`); if (!w) return;
    const L = w.offsetLeft - (pkStrip.clientWidth - w.offsetWidth) / 2;
    pkStrip.scrollTo({ left: Math.max(0, L), behavior: smooth ? "smooth" : "auto" });
  };
  // pan the painting so a selected loupe that is off screen comes back into view
  const pkReveal = p => {
    const s2 = stage.getBoundingClientRect(), q = pkScreen(p);
    if (q.x > s2.left + 28 && q.x < s2.right - 28 && q.y > s2.top + 28 && q.y < s2.bottom - 28) return;
    springFrame(320); P = clampP([P[0] + (s2.left + s2.width / 2 - q.x), P[1] + (s2.top + s2.height / 2 - q.y)], Z, false); apply();
  };
  const pkSelect = (id, o = {}) => {
    if (PKS.active === id && !o.force) return;
    const p = pkGet(id); if (!p) return;
    PKS.active = id; pkRet = PKS.ret = { fx: p.fx, fy: p.fy };   // the ring goes to where this color was taken
    pkRenderStrip(); pkUpdate(true);
    if (o.scroll !== false) pkScrollToActive(true);
    if (o.reveal) pkReveal(p);
  };
  // "+" keeps the color under the ring as a swatch (the ring stays live, so you can keep looking)
  const pkAddLive = () => {
    if (PKS.picks.length >= PK_MAX) { if (typeof toast === "function") toast(`${PK_MAX} colors is the most a palette holds here.`); return null; }
    if (!pkRet) return null;
    const hex = pkSample(pkRet.fx, pkRet.fy); if (!hex) { pkRenderInfo(); return null; }
    const p = { id: "k" + (++PKS.seq), fx: pkRet.fx, fy: pkRet.fy, hex };
    PKS.picks.push(p); PKS.active = p.id;
    pkRender(); pkScrollToActive(true);
    if (typeof buzz === "function") buzz(6);
    return p;
  };
  // a still tap on the painting jumps the ring there (a QA hook as well)
  const pkTap = (x, y) => pkSetFromPoint(x, y);
  const pkRemove = id => {
    const i = PKS.picks.findIndex(p => p.id === id); if (i < 0) return;
    const gone = PKS.picks[i];
    PKS.picks.splice(i, 1);
    const next = PKS.picks[Math.min(i, PKS.picks.length - 1)];
    PKS.active = null;   // the ring stays where it is, live
    pkRender(); pkScrollToActive(true);
    if (typeof buzz === "function") buzz(5);
    if (typeof toast === "function") toast("Color removed", { undo: () => { PKS.picks.splice(Math.min(i, PKS.picks.length), 0, gone); PKS.active = gone.id; pkRender(); pkScrollToActive(true); } });
  };
  // ----- the strip: tap selects, the x removes, long-press then drag reorders -----
  let pkLift = null;
  const pkStepOf = items => items.length > 1 ? items[1].offsetLeft - items[0].offsetLeft : 54;
  const pkLiftMove = () => {
    const L = pkLift; if (!L) return;
    const tx = L.cx - L.x0 + (pkStrip.scrollLeft - L.sl0), items = L.items;
    L.el.style.transform = `translateX(${tx}px) scale(1.12)`;
    const to = clamp(Math.round(L.from + tx / L.step), 0, items.length - 1); L.to = to;
    items.forEach((it, j) => { if (j === L.from) return; const sh = L.from < to && j > L.from && j <= to ? -L.step : L.from > to && j < L.from && j >= to ? L.step : 0; it.style.transform = sh ? `translateX(${sh}px)` : ""; });
  };
  const pkLiftTick = () => {
    const L = pkLift; if (!L) return;
    const r = pkStrip.getBoundingClientRect(), edge = 44;
    if (L.cx < r.left + edge) pkStrip.scrollLeft -= 9; else if (L.cx > r.right - edge) pkStrip.scrollLeft += 9;
    pkLiftMove(); L.raf = requestAnimationFrame(pkLiftTick);
  };
  pkStrip.addEventListener("pointerdown", e => {
    const w = e.target.closest(".glz-sw-w"); if (!w || e.target.closest("[data-glzpkx]") || pkLift) return;
    const items = [...pkStrip.querySelectorAll(".glz-sw-w")], from = items.indexOf(w);
    const L = { el: w, from, to: from, items, step: pkStepOf(items), x0: e.clientX, y0: e.clientY, cx: e.clientX, sl0: pkStrip.scrollLeft, pid: e.pointerId, lifted: false, timer: 0, raf: 0 };
    L.timer = setTimeout(() => {
      L.lifted = true; pkLift = L; L.sl0 = pkStrip.scrollLeft; L.x0 = L.cx;
      if (typeof buzz === "function") buzz(8);
      w.classList.add("lift"); pkStrip.classList.add("lifting");
      try { pkStrip.setPointerCapture(L.pid); } catch (err) {}
      L.raf = requestAnimationFrame(pkLiftTick);
    }, 360);
    pkStrip._arm = L;
  });
  pkStrip.addEventListener("pointermove", e => {
    const L = pkStrip._arm; if (!L || e.pointerId !== L.pid) return;
    L.cx = e.clientX; if (L.lifted) pkLiftMove();
    if (!L.lifted && Math.hypot(e.clientX - L.x0, e.clientY - L.y0) > 8) { clearTimeout(L.timer); pkStrip._arm = null; }
  });
  pkStrip.addEventListener("touchmove", e => { if (pkLift) e.preventDefault(); }, { passive: false });
  pkStrip.addEventListener("contextmenu", e => e.preventDefault());
  const pkLiftEnd = (e, commit) => {
    const L = pkStrip._arm; if (!L || (e && e.pointerId !== L.pid)) return;
    clearTimeout(L.timer); pkStrip._arm = null;
    if (!L.lifted) return;
    cancelAnimationFrame(L.raf); pkLift = null; pkSwallowClick = performance.now();
    try { pkStrip.releasePointerCapture(L.pid); } catch (err) {}
    const to = commit ? L.to : L.from;
    L.el.style.transition = "transform .2s var(--spring)"; L.el.style.transform = `translateX(${(to - L.from) * L.step}px)`;
    L.el.classList.remove("lift");
    setTimeout(() => {
      pkStrip.classList.remove("lifting");
      if (to !== L.from) { const [m] = PKS.picks.splice(L.from, 1); PKS.picks.splice(to, 0, m); if (typeof buzz === "function") buzz(5); }
      pkRenderStrip(); pkRenderInfo(); pkRenderAct();
    }, 200);
  };
  pkStrip.addEventListener("pointerup", e => pkLiftEnd(e, true));
  pkStrip.addEventListener("pointercancel", e => pkLiftEnd(e, false));
  pkStrip.addEventListener("click", e => {
    if (performance.now() - pkSwallowClick < 400) return;
    if (e.target.closest("[data-glzpkx]")) { const w = e.target.closest(".glz-sw-w"); if (w) pkRemove(w.dataset.id); return; }
    if (e.target.closest("[data-glzpkadd]")) { if (typeof buzz === "function") buzz(5); pkAddLive(); return; }
    const w = e.target.closest(".glz-sw-w");
    if (w) { if (typeof buzz === "function") buzz(4); pkSelect(w.dataset.id, { reveal: true, force: true }); }
  });
  pkInfo.addEventListener("click", e => {
    if (!e.target.closest("[data-glzpkopen]")) return;
    const a = pkGet(PKS.active); if (a && typeof openTappedColor === "function") openTappedColor(a.hex);
  });
  pkActEl.addEventListener("click", e => {
    if (!e.target.closest("[data-glzpksave]")) return;
    const hexes = PKS.picks.map(p => p.hex); if (hexes.length < 2) return;
    // the painting it came from, with where each color was picked (fractions of the image), so the palette's page
    // can show the painting and a dot at every pick (js/setpage.js, "On the painting")
    const pref = { i: opts.galleryIndex != null ? opts.galleryIndex : null, t: opts.title || "", pts: PKS.picks.map(p => [String(p.hex).toUpperCase(), +(+p.fx).toFixed(4), +(+p.fy).toFixed(4)]) };
    const ex = PKS.savedId && (S.palettes || []).find(x => x.id === PKS.savedId);
    if (ex) {
      ex.cols = hexes.slice(); ex.at = today(); ex.painting = pref; save();
      if (typeof buzz === "function") buzz([10, 30, 20]);
      if (typeof toast === "function") toast("Kept palette updated", { action: "Open", onAction: () => { if (typeof spPage === "function") spPage(hexes, { push: true, painting: pref }); } });
    } else if (typeof glSavePalette === "function") {
      const sp = glSavePalette(hexes, glSaveName(opts.title || "A painting", "My palette"), false, pref);
      if (!sp) return;
      PKS.savedId = sp.id;
    }
    PKS.savedSig = hexes.join(); pkRenderAct();
  });
  const pkEnter = on => {
    pkPanel.hidden = !on; pkLayer.hidden = !on;
    if (pkPrev) pkPrev.hidden = !on;
    if (!on) return;
    pkBlocked = false; PKS.active = null; pkLive = null; pkLiveName = null;
    // the ring comes back where it was; the first time it waits at the middle of what's on screen
    if (!pkRet) {
      pkRet = PKS.ret;
      if (!pkRet) { const sr = stage.getBoundingClientRect(), m = typeof eydMap === "function" ? eydMap(img, sr.left + sr.width / 2, sr.top + sr.height / 2) : null; pkRet = PKS.ret = m ? { fx: m.fx, fy: m.fy } : { fx: .5, fy: .5 }; }
    }
    pkRingEl(); pkRender();
    if (img.complete && img.naturalWidth) pkUpdate(true);
    requestAnimationFrame(() => { pkScrollToActive(false); if (active === "pick" && img.complete && img.naturalWidth) pkUpdate(true); });
  };
  if (pkSizeEl) eydBindSizes(pkSizeEl, () => pkUpdate(true));
  img.addEventListener("load", () => { if (active === "pick") pkUpdate(true); });
  // Select: an accumulated list of tap points in this image's own resized pixel space (js/segment.js's
  // segEncode/segPointForTap), each +1 (add) or 0 (remove); every tap re-runs the decoder (fast -- see
  // js/segment.js's header) with the full list so far, live-refining one mask rather than restarting it.
  // selBusy guards against a tap landing mid-decode; the ONE encode per image is cached in js/segment.js
  // itself (SEG_CUR), so switching tools and back to Select on the SAME painting skips straight to ready.
  let selPoints = [], selTapMode = 1, selSheetClose = null, selBusy = false;
  const selEls = () => ({
    wrap: scrim.querySelector("[data-glzsel]"), prog: scrim.querySelector("[data-glzselprog]"),
    progLabel: scrim.querySelector("[data-glzselproglabel]"), bar: scrim.querySelector("[data-glzselbar]"),
    wifi: scrim.querySelector("[data-glzselwifi]"), hint: scrim.querySelector("[data-glzselhint]"),
    ctl: scrim.querySelector("[data-glzselctl]"), undo: scrim.querySelector("[data-glzselundo]"), clear: scrim.querySelector("[data-glzselclear]"),
    errDetail: scrim.querySelector("[data-glzselerrdetail]"), errMsg: scrim.querySelector("[data-glzselerrmsg]"),
  });
  const selSetHint = (txt, show) => {
    const { hint, errDetail } = selEls();
    if (hint) { hint.hidden = show === false; hint.textContent = txt; }
    if (errDetail) errDetail.hidden = true;   // any honest-hint update (including a fresh retry) clears a stale error disclosure
  };
  // a failure is never silent: the honest one-line hint above, plus the real error text one tap away in
  // "Details" -- never a spinner that just stops (David's "no hype, no fake progress" rule cuts both ways:
  // no fake progress on the way up, and no silent death on the way down either)
  const selSetError = (hintTxt, err) => {
    selSetHint(hintTxt);
    const { errDetail, errMsg } = selEls();
    if (errDetail && errMsg) { errMsg.textContent = String((err && (err.message || err)) || "Unknown error"); errDetail.hidden = false; }
  };
  const selReset = () => {
    selPoints = []; selBusy = false; selTapMode = 1;   // Clear/leaving Select starts over clean -- back to the default "+" tap mode too, not just an empty point list
    scrim.querySelectorAll("[data-glzselpm]").forEach(b => { const on = b.dataset.glzselpm === "1"; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); });
    cv.classList.remove("on");
    if (selSheetClose) { selSheetClose(); selSheetClose = null; }
    const { ctl, undo, clear } = selEls();
    if (undo) undo.disabled = true; if (clear) clear.disabled = true;
    if (ctl && !ctl.hidden) selSetHint("Tap the thing you want.");
  };
  // runs (or re-runs) the decoder against the current point list; a "-" tap with no "+" tap yet has nothing
  // to decode against (SAM needs at least one positive point to mean anything), so that's caught here rather
  // than sent to the model
  const selRunDecode = () => {
    if (selBusy || typeof segDecode !== "function") return;
    if (!selPoints.some(p => p.label === 1)) {
      cv.classList.remove("on");
      if (selSheetClose) { selSheetClose(); selSheetClose = null; }
      selSetHint("Add a + tap first, then − to remove any of it.");
      return;
    }
    selBusy = true; selSetHint("", false);
    segDecode(selPoints).then(({ mask, mw, mh }) => {
      selBusy = false;
      if (typeof segPaintMask === "function") { segPaintMask(cv, mask, mw, mh); cv.classList.add("on"); }
      const pool = typeof segPoolFromMask === "function" ? segPoolFromMask(mask, mw, mh) : [];
      if (selSheetClose) selSheetClose();
      // each sheet's own onClose only clears selSheetClose if it's STILL the current one -- sheet()'s close()
      // animates for up to 400ms before actually removing the element (js/core.js), so the OLD sheet closed on
      // the line above can fire its onClose well after this new one has already replaced selSheetClose; without
      // this check that late callback nulls out the handle to the sheet that's open right now, and Clear/a tool
      // switch silently stops being able to close it (found live, not guessed -- tools/smoke's Select scenario)
      const mySheet = pool.length && typeof segSheet === "function" ? segSheet(pool, () => { if (selSheetClose === mySheet) selSheetClose = null; }) : null;
      selSheetClose = mySheet;
    }).catch(err => { selBusy = false; selSetError("Couldn't select that -- try tapping again.", err); });
  };
  // activates on entry into Select (not before -- "lazy-load only on entering Select"): downloads+caches the
  // model the first time ever (segEnsureReady's own progress callback drives the banner), then encodes this
  // one image (free on every later visit to the same painting, segEncode's own src check)
  const selActivate = () => {
    const { wrap, prog, progLabel, bar, wifi, ctl } = selEls();
    if (wrap) wrap.hidden = false;
    if (ctl) ctl.hidden = true;
    selSetHint("Getting ready…");
    if (typeof segEnsureReady !== "function") { selSetHint("Select isn't available right now."); return; }
    segEnsureReady((frac, mb) => {
      if (!prog) return;
      prog.hidden = false; selSetHint("", false);
      if (progLabel) progLabel.textContent = `Downloading the selection tool · ${mb} MB`;
      if (bar) bar.style.width = Math.max(2, Math.round(frac * 100)) + "%";
      if (wifi) wifi.hidden = false;
    }).then(() => {
      if (prog) prog.hidden = true;
      selSetHint("Preparing this image…");
      return segEncode(img);
    }).then(() => {
      selSetHint("Tap the thing you want. + adds, − removes.");
      if (ctl) ctl.hidden = false;
    }).catch(err => { if (prog) prog.hidden = true; selSetError("Select couldn't load — try again.", err); });
  };
  scrim.querySelector(".glz-sel-pm").onclick = e => {
    const b = e.target.closest("[data-glzselpm]"); if (!b) return;
    selTapMode = +b.dataset.glzselpm;
    scrim.querySelectorAll("[data-glzselpm]").forEach(x => { const on = x === b; x.classList.toggle("on", on); x.setAttribute("aria-pressed", on); });
    if (typeof buzz === "function") buzz(4);
  };
  scrim.querySelector("[data-glzselundo]").onclick = () => {
    if (!selPoints.length) return;
    selPoints.pop();
    if (typeof buzz === "function") buzz(5);
    const { undo, clear } = selEls(); if (undo) undo.disabled = !selPoints.length; if (clear) clear.disabled = !selPoints.length;
    if (selPoints.length) selRunDecode(); else { cv.classList.remove("on"); if (selSheetClose) { selSheetClose(); selSheetClose = null; } selSetHint("Tap the thing you want."); }
  };
  scrim.querySelector("[data-glzselclear]").onclick = () => { if (typeof buzz === "function") buzz(5); selReset(); };
  // Select: a tap (not a drag -- pan/pinch are gated off above while this tool is active) adds a point in the
  // current +/- mode and re-decodes. Ignored until this exact image has finished encoding (segPointForTap
  // returns null while still downloading/encoding, or if the active tool isn't Select at all).
  const selTap = (clientX, clientY) => {
    if (typeof eydMap !== "function" || typeof segPointForTap !== "function") return;
    const m = eydMap(img, clientX, clientY); if (!m) return;
    const p = segPointForTap(img.src, m.fx, m.fy); if (!p) return;   // img.src (browser-normalized), matching segEncode's own SEG_CUR.src -- opts.src may be relative and never compare equal
    if (typeof buzz === "function") buzz(6);
    selPoints.push({ x: p.x, y: p.y, label: selTapMode });
    const { undo, clear } = selEls(); if (undo) undo.disabled = false; if (clear) clear.disabled = false;
    selRunDecode();
  };
  img.addEventListener("click", e => { if (active === "select") selTap(e.clientX, e.clientY); });
  // Value / Squint / Where / Pick / Select
  const setMode = m => {
    // Pick needs a real canvas read on THIS image (js/eyedrop.js eydSource), unlike Where/Select which only
    // ever touch the painting page's own precomputed opts.pix or their own CORS-safe probe image -- so Pick is
    // the one tool that silently did nothing at all when the image couldn't be read (David's report, "the
    // color picker isn't working"): the drag just never showed a loupe, no error, nothing. Honest now, the
    // same rule Select's own probe already follows (never a silent dead button).
    if (m === "pick" && active !== "pick" && !opts.sampleOk) { if (typeof toast === "function") toast("This museum's photo can't be read here, so colors can't be picked from it."); return; }
    active = active === m ? null : m;
    scrim.querySelectorAll("[data-glzv]").forEach(b => { const on = b.dataset.glzv === active; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); });
    scrim.querySelector(".glz-img").style.filter = active === "value" ? "grayscale(1)" : active === "squint" ? "blur(min(2.5vw,16px))" : "";
    const palBox = scrim.querySelector(".glz-pal"); palBox.hidden = active !== "where";
    if (active !== "where") { cv.classList.remove("on"); palHex = null; } else drawPalRow();
    const { wrap } = selEls(); if (wrap) wrap.hidden = active !== "select";
    if (active === "select") selActivate(); else { selReset(); if (active !== "where") cv.classList.remove("on"); }
    drawWhere(); pkEnter(active === "pick");
  };
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
  // Immersive desktop viewer (David, 2026-10-21): the controls and caption fade after ~2s without mouse movement and come back on
  // movement; a tool in use keeps them. The browser's real fullscreen is requested too (the click is the user gesture); leaving it
  // with Esc closes the viewer. Blocked or unsupported: silently stays a full-window black page.
  let idleT = 0, fsOn = false;
  const wake = () => {
    scrim.classList.remove("idle"); clearTimeout(idleT);
    if (!DESKV) return;
    idleT = setTimeout(() => { if (closed) return; if (active || scrim.querySelector(".glz-top:hover,.glz-tools:hover")) { wake(); return; } scrim.classList.add("idle"); }, 2000);
  };
  const onFs = () => { if (fsOn && !document.fullscreenElement && !closed) close(); };
  if (DESKV) {
    scrim.addEventListener("pointermove", wake); scrim.addEventListener("pointerdown", wake); wake();
    try { const rq = scrim.requestFullscreen && scrim.requestFullscreen({ navigationUI: "hide" }); if (rq && rq.then) rq.then(() => { fsOn = true; document.addEventListener("fullscreenchange", onFs); }).catch(() => {}); } catch (e) {}
  }
  const close = () => {
    if (closed) return; closed = true;
    clearTimeout(idleT); document.removeEventListener("fullscreenchange", onFs);
    if (fsOn && document.fullscreenElement) { try { document.exitFullscreen().catch(() => {}); } catch (e) {} }
    stopMomentum(); cancelAnimationFrame(lpRaf); window.removeEventListener("resize", onResize);
    document.body.style.overflow = prevOverflow; scrim.remove(); window.removeEventListener("keydown", onKey, true);
  };
  const stepTo = z => { const r = stage.getBoundingClientRect(); stopMomentum(); loupeOn = false; animTo(() => zoomAt(r.left + r.width / 2, r.top + r.height / 2, z, false)); };
  const closeBack = () => {   // from a map card: shrink back into it; anywhere else (or a gesture away) just close
    if (closed || !enterRect || matchMedia("(prefers-reduced-motion:reduce)").matches) return close();
    stopMomentum(); frame.style.transition = `transform 220ms ${ZIN_EASE}`; scrim.style.transition = "opacity .22s var(--ease)"; scrim.classList.remove("in");
    Z = enterRect.z0; P = enterRect.p0; frame.style.transform = `translate(${P[0]}px,${P[1]}px) scale(${Z})`;
    setTimeout(close, 230);
  };
  const onKey = e => {
    if (e.key === "Escape") { e.stopImmediatePropagation(); e.preventDefault(); if (LP && Z > fitZ * 1.15) goFit(); else closeBack(); return; }
    if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
    // Pick: the arrow keys nudge the ring one image pixel (Shift = ten)
    if (active === "pick" && pkRet && /^Arrow(Left|Right|Up|Down)$/.test(e.key) && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const s2 = pkSource(); if (!s2) return;
      const st = e.shiftKey ? 10 : 1, dx = e.key === "ArrowLeft" ? -st : e.key === "ArrowRight" ? st : 0, dy = e.key === "ArrowUp" ? -st : e.key === "ArrowDown" ? st : 0;
      e.preventDefault(); e.stopPropagation(); pkMoveBy(dx / s2.w, dy / s2.h); return;
    }
    if (e.key === "+" || e.key === "=") stepTo(Z * 1.5); else if (e.key === "-") stepTo(Z / 1.5); else if (e.key === "0") stepTo(fitZ);
  };
  window.addEventListener("keydown", onKey, true);
  scrim.querySelector("[data-glzclose]").onclick = closeBack;
  scrim.addEventListener("click", e => { if (e.target === scrim) closeBack(); });
  scrim.querySelector("[data-glzfit]").onclick = () => { loupeOn = false; stepTo(fitZ); };
  scrim.querySelector("[data-glz100]").onclick = () => { loupeOn = false; stepTo(fitZ < 1 ? 1 : Math.min(maxZ, fitZ * 2.5)); };
  const dBtn = scrim.querySelector("[data-glzdetails]"); if (dBtn) dBtn.onclick = () => { close(); opts.onDetails(); };
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
  // startTool (js/gallery.js ⋯ › Look, PLAN §3.6): jump straight into a tool instead of making the visitor pick
  // it again. "where" needs opts.pix; "select" just needs a src (its own probe decides if the host allows it);
  // anything else (or a tool this image can't offer) falls back to the plain zoomed view, never a dead screen.
  if (opts.startTool === "where" && opts.pix) setMode("where");
  else if (opts.startTool === "select" && opts.src) setMode("select");
  else if (opts.startTool === "pick" && typeof eydSource === "function") setMode("pick");
  // a QA accessor for the gesture fuzz test (tools/smoke/scenarios.js), the same pattern js/honey.js exposes
  // via HM_CTRL._qaState -- the raw camera state plus the bounds it should always be within, so the test can
  // assert on the gesture machinery itself rather than reading rendered pixels back out of a transform string
  scrim._glzQA = { state: () => ({ Z, P: P.slice(), fitZ, maxZ, natW, natH }), stopMomentum: () => stopMomentum(), reset: () => resetView(),
    pk: () => ({ picks: PKS.picks.map(p => ({ id: p.id, fx: p.fx, fy: p.fy, hex: p.hex })), active: PKS.active, blocked: pkBlocked, ret: pkRet, live: pkLive }), pkTap: (x, y) => pkTap(x, y), pkAdd: () => pkAddLive() };
  return { close };
}
