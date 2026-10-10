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
function glZoomOpen(opts) {
  const scrim = document.createElement("div");
  scrim.className = "glz-scrim";
  scrim.innerHTML = `
    <div class="glz-top"><button class="tl-exit" data-glzclose aria-label="Done, back to the painting">${ICON.back}<span>Done</span></button><span class="glz-title">${esc(opts.title || "")}</span></div>
    <div class="glz-stage"><div class="glz-frame"><img class="glz-img" src="${esc(opts.src)}"${opts.cors ? ' crossorigin="anonymous"' : ""} alt="${esc(opts.alt || "")}"><canvas class="glz-cv" aria-hidden="true"></canvas></div></div>
    <div class="glz-tools">
      <div class="seg glz-seg" role="group" aria-label="Look at it">
        <button data-glzv="value">Value</button><button data-glzv="squint">Squint</button>${opts.pix ? `<button data-glzv="where">Where</button>` : ""}${typeof eyedropAttach === "function" ? `<button data-glzv="pick">${typeof icon === "function" ? icon("pipette", 15) : ""}<span>Pick</span></button>` : ""}${opts.src && typeof segProbe === "function" ? `<button data-glzv="select" hidden>Select</button>` : ""}
      </div>
      <div class="glz-pal" hidden role="group" aria-label="Which color"></div>
      <div class="glz-sel" data-glzsel hidden>
        <div class="glz-sel-prog" data-glzselprog hidden>
          <p class="glz-sel-prog-label" data-glzselproglabel></p>
          <div class="glz-sel-bar"><i data-glzselbar></i></div>
          <p class="fine glz-sel-wifi" data-glzselwifi hidden>Downloads once, then works without a connection. Best on Wi-Fi.</p>
        </div>
        <p class="glz-tool-hint" data-glzselhint hidden>Getting ready&hellip;</p>
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
  // Same CORS-flake defense as js/gallery.js's own hero image: a host on the "safe" allowlist can still drop
  // its CORS header on any single request (found live on the Met's Imperva CDN -- the identical URL answered
  // with the header moments earlier from a plain curl). With crossorigin="anonymous" set and that header
  // missing, the <img> doesn't just lose pixel-read access -- it fails to load AT ALL, leaving Look closer's
  // whole stage blank. One retry without crossOrigin keeps the picture visible; Pick/Where then honestly find
  // nothing to read (opts.sampleOk below), instead of a dead, unexplained gap where the painting should be.
  if (img.crossOrigin) img.addEventListener("error", () => {
    const src = img.src; img.crossOrigin = null; img.addEventListener("load", resetView, { once: true }); img.src = ""; img.src = src;
  }, { once: true });
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
  // Stepped aside entirely while "Pick" or "Select" is active (their own tap/drag handlers own the gesture then).
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
    if (active === "pick" || active === "select") return;
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
    if (active === "pick" || active === "select") return;
    e.preventDefault(); stopMomentum(); frame.style.transition = "";
    zoomAt(e.clientX, e.clientY, Z * Math.exp(-e.deltaY * .0015), false);
  }, { passive: false });
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
  });
  const selSetHint = (txt, show) => { const { hint } = selEls(); if (hint) { hint.hidden = show === false; hint.textContent = txt; } };
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
    }).catch(() => { selBusy = false; selSetHint("Couldn't select that -- try tapping again."); });
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
    }).catch(() => { if (prog) prog.hidden = true; selSetHint("Select couldn't load — try again."); });
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
    drawWhere(); syncPick();
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
  // startTool (js/gallery.js ⋯ › Look, PLAN §3.6): jump straight into a tool instead of making the visitor pick
  // it again. "where" needs opts.pix; "select" just needs a src (its own probe decides if the host allows it);
  // anything else (or a tool this image can't offer) falls back to the plain zoomed view, never a dead screen.
  if (opts.startTool === "where" && opts.pix) setMode("where");
  else if (opts.startTool === "select" && opts.src) setMode("select");
  // a QA accessor for the gesture fuzz test (tools/smoke/scenarios.js), the same pattern js/honey.js exposes
  // via HM_CTRL._qaState -- the raw camera state plus the bounds it should always be within, so the test can
  // assert on the gesture machinery itself rather than reading rendered pixels back out of a transform string
  scrim._glzQA = { state: () => ({ Z, P: P.slice(), fitZ, maxZ, natW, natH }), stopMomentum: () => stopMomentum(), reset: () => resetView() };
  return { close };
}
