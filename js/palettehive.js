"use strict";
// Palette honeycomb (David, 2026-10-09): "Tapping a color palette or a painting and showing it on the color map
// is a useless feature -- it doesn't give you anything." Lighting a painting's six colors among all ~2,700 on
// the big shared map just dims the colors you already knew were there. What's actually useful: see EVERY color
// inside the one thing you tapped, sized by how much of it there really is, with a slider from 3 up to every
// distinct color the palette engine can measure -- recomputed at that count, not a truncated top-N. One shared
// module so a painting, a photo/camera frame, a color set and a subject's measured colors all get the same
// honeycomb, the same arrangements and the same one-tap-opens-the-page rule (CLAUDE.md: one tap, no sheet in
// between).
//
//   openPaletteHive({ title, subtitle?, colors: [{h,n?,share?}…], source?, poolFn?(n), max? })
//     title       the sheet's heading
//     subtitle    an optional honest line (e.g. "as photographed"); appended to the count line
//     colors      the set to show at open (already picked at whatever count the caller was showing)
//     poolFn(n)   optional: recompute the real top-n from the full measured pool (gallery's csPoolPick, a
//                 subject's svPool…) -- when given, the slider can go up to `max` and every step re-asks the
//                 engine instead of slicing `colors` short past what it holds
//     source      a short kind label ("painting", "painter", "set", "camera"…) for the default eyebrow
//     max         the slider's ceiling (defaults to `colors.length` when there's no pool to redraw from)
//
// Honey.js's own honeycomb() is a singleton tuned for the ENTIRE name list (Home's pan memory, its own
// highlight/dim machinery, cell sizing from the lens alone, never from a data field like share) -- not built to
// size cells by share, so this is the "lightweight canvas honeycomb with the same look" the brief allows: real
// circles (honey.js's own shape-0 cells are circles too), named, contrast ink, a hairline seam, pinch/pan with
// the same clamp-and-never-stick discipline, same fonts.
//
// No navigation, no trail entry: a near-full sheet (app.css sheet()) over the page that opened it, so Back,
// close, the scrim and a swipe down all just reveal that page again -- the same as any other sheet in the app.
// A tapped cell closes the sheet and opens that color's page in one tap (js/swatch.js openTappedColor); Back
// from there returns to the sheet's own source page, never to the hive.

const PH_MIN_N = 3, PH_MAXN = 200, PH_GAP = 3;
const PH_ZMIN = .12, PH_ZMAX = 8;
const PH_ARR = [["share", "By share"], ["hue", "By hue"], ["light", "Light → dark"], ["spiral", "Spiral"]];
const PH_GA = Math.PI * (3 - Math.sqrt(5));   // the golden angle -- the same spiral honey.js's Sunflower/Spiral layouts use
const PH_SRC_LABEL = { painting: "Painting", painter: "Painter", decade: "Decade", movement: "Movement", country: "Country", museum: "Museum", look: "Style", set: "Set", palette: "Palette", camera: "Camera", photo: "Photo" };

const phName = c => c.n || (typeof nameOf === "function" ? nameOf(c.h).text : c.h);
function phHash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967295; }

// ---------- layout: circles sized by share (area), positioned per arrangement, pass-relaxed to never overlap ----------
// arr "hue": a real wheel -- angle = hue, radius out from chroma (greys stay near the middle). "light": a ramp,
// lightest at the top. "share"/"spiral" both use the same golden-angle spiral (the honeycomb's own natural
// packing); "share" orders biggest first (center out), "spiral" orders by hue so neighbors along the ribbon
// read as a hue walk.
function phAnchor(arr, it, i, n, W, H) {
  if (arr === "hue") {
    const grey = it.C < 14, ang = (it.H - 90) * Math.PI / 180;
    const rad = grey ? 8 + it.L * .22 : Math.min(W, H) * (.14 + Math.min(it.C, 70) / 70 * .32);
    return [Math.cos(ang) * rad, Math.sin(ang) * rad];
  }
  if (arr === "light") {
    const y = (50 - it.L) / 50 * (H * .36), x = (phHash(it.h) - .5) * W * .62;
    return [x, y];
  }
  const r = Math.sqrt(i + .5) * (Math.min(W, H) * .1), a = i * PH_GA;
  return [Math.cos(a) * r, Math.sin(a) * r];
}
function phOrderKey(arr, it) {
  if (arr === "hue" || arr === "spiral") return it.C < 14 ? -1000 + (100 - it.L) : it.H;
  if (arr === "light") return -it.L;
  return -(it.share || 0);
}
function phLayout(colors, arr, W, H) {
  if (!colors.length) return [];
  const withLch = colors.map(c => { const [L, C, H2] = lch(c.h); return { h: c.h, n: c.n || phName(c), share: c.share != null ? c.share : 1 / colors.length, L, C, H: H2 }; });
  const ordered = withLch.sort((a, b) => phOrderKey(arr, a) - phOrderKey(arr, b));
  const totalShare = ordered.reduce((a, c) => a + c.share, 0) || 1;
  const targetArea = Math.max(1, W * H * .5);
  const minR = Math.max(13, Math.min(W, H) * .028), maxR = Math.min(W, H) * .34;
  const nodes = ordered.map((it, i) => {
    const r = clamp(Math.sqrt(targetArea * (it.share / totalShare) / Math.PI), minR, maxR);
    const [ax, ay] = phAnchor(arr, it, i, ordered.length, W, H);
    return { ...it, r, x: ax, y: ay, ax, ay };
  });
  const spring = arr === "hue" || arr === "light" ? .06 : 0;
  // "share"/"spiral": pull toward the middle every step, not just toward each node's own loose spiral seed --
  // repulsion alone only stops OVERLAP, it never closes a gap between bubbles that never touched in the first
  // place, which left the whole cluster sitting at its spread-out seed spacing with a big dead margin around it
  // (David would call this "empty gaps", P16). Cohesion + repulsion in balance is what actually packs them tight.
  const cohesion = spring > 0 ? 0 : .03;
  const iters = clamp(Math.round(16000 / nodes.length), 50, 240);
  for (let k = 0; k < iters; k++) {
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j];
      let dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
      const min = a.r + b.r + PH_GAP;
      if (d < min) {
        if (d < 1e-4) { dx = phHash(a.h + i) - .5 || .01; dy = phHash(a.h + j) - .5 || .01; d = Math.hypot(dx, dy); }
        const push = (min - d) / 2, ux = dx / d, uy = dy / d;
        a.x -= ux * push; a.y -= uy * push; b.x += ux * push; b.y += uy * push;
      }
    }
    if (spring > 0) nodes.forEach(nd => { nd.x += (nd.ax - nd.x) * spring; nd.y += (nd.ay - nd.y) * spring; });
    else nodes.forEach(nd => { nd.x -= nd.x * cohesion; nd.y -= nd.y * cohesion; });
  }
  const cx = nodes.reduce((s, nd) => s + nd.x, 0) / nodes.length, cy = nodes.reduce((s, nd) => s + nd.y, 0) / nodes.length;
  nodes.forEach(nd => { nd.x -= cx; nd.y -= cy; });
  return nodes;
}

// ---------- the sheet ----------
// no count here: "How many" (right above the slider) already says it big -- restating it reads as redundant,
// doubly so when the title itself already names a count (a subject's "Monet's 20 most-used colors…").
const PH_SUB = "Sized by how much there is.";
function openPaletteHive(o = {}) {
  const seed = (o.colors || []).map(c => typeof c === "string" ? { h: c } : c).filter(c => c && c.h);
  if (!seed.length) return;
  const poolFn = typeof o.poolFn === "function" ? o.poolFn : null;
  // the floor is PH_MIN_N (3) UNLESS the thing itself holds fewer than that (a pair is 2 colors, full stop) --
  // never force a slider past what's really there (David, 2026-10-09: "don't write the word different" -- the
  // same honesty rule as everywhere else: say what's real, not a padded-out number).
  const max = clamp(o.max != null ? o.max : (poolFn ? PH_MAXN : seed.length), 1, PH_MAXN);
  const minN = Math.min(PH_MIN_N, max);
  const title = o.title || "Colors", kindLabel = PH_SRC_LABEL[o.source] || "Colors";
  let count = clamp(seed.length || minN, minN, max), arr = "share";
  const getColors = n => (poolFn ? (poolFn(n) || []) : seed).slice(0, Math.min(n, max));

  const { sh, close } = sheet(`
    <p class="eyebrow">${esc(kindLabel)}</p>
    <h1 class="ph-title">${esc(title)}</h1>
    <p class="ph-sub" data-ph-sub></p>
    <div class="ph-count"><label class="ph-count-l"><span>How many</span><input type="range" aria-label="How many colors"><b data-ph-n></b></label></div>
    <div class="ph-arr" role="group" aria-label="Arrange">${PH_ARR.map(([k, t]) => `<button class="ph-arr-b${k === arr ? " on" : ""}" data-ph-arr="${k}">${t}</button>`).join("")}</div>
    <div class="ph-stage" data-ph-stage><canvas class="ph-cv" aria-label="Every color here, sized by how much of it there is. Drag to pan, pinch to zoom, tap a color to open its page."></canvas></div>
    <p class="fine ph-fine">Screen colors are approximate${o.subtitle ? " · " + esc(o.subtitle) : ""}.</p>
  `);
  sh.classList.add("ph-sheet");
  const stage = sh.querySelector("[data-ph-stage]"), cv = sh.querySelector(".ph-cv"), ctx = cv.getContext("2d");
  const subEl = sh.querySelector("[data-ph-sub]");

  let W = 0, H = 0, dpr = 1, nodes = [], bbox = null, pan = [0, 0], zoom = 1, baseZoom = 1;
  let animFrom = null, animT0 = 0, raf = 0, pressed = null, dead = false;
  const RM = reduceMotion;

  function resize() {
    const r = stage.getBoundingClientRect();
    W = Math.max(40, r.width); H = Math.max(40, r.height); dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cv.style.width = W + "px"; cv.style.height = H + "px";
  }
  function fitView() {
    if (!nodes.length) { bbox = null; zoom = baseZoom = 1; pan = [0, 0]; return; }
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    nodes.forEach(n => { if (n.x - n.r < minX) minX = n.x - n.r; if (n.x + n.r > maxX) maxX = n.x + n.r; if (n.y - n.r < minY) minY = n.y - n.r; if (n.y + n.r > maxY) maxY = n.y + n.r; });
    bbox = { minX, maxX, minY, maxY };
    const cw = Math.max(20, maxX - minX), ch = Math.max(20, maxY - minY), margin = 18;
    const fitZoom = Math.min((W - margin * 2) / cw, (H - margin * 2) / ch);
    zoom = baseZoom = clamp(isFinite(fitZoom) ? fitZoom : 1, PH_ZMIN, PH_ZMAX);
    pan = [-(minX + maxX) / 2 * zoom, -(minY + maxY) / 2 * zoom];
  }
  function clampPan() {
    if (!bbox) return;
    const cx = (bbox.minX + bbox.maxX) / 2 * zoom, cy = (bbox.minY + bbox.maxY) / 2 * zoom;
    const cw = (bbox.maxX - bbox.minX) * zoom, ch = (bbox.maxY - bbox.minY) * zoom;
    const slackX = Math.max(W * .55, cw * .6), slackY = Math.max(H * .55, ch * .6);
    pan[0] = clamp(pan[0], -cx - slackX, -cx + slackX);
    pan[1] = clamp(pan[1], -cy - slackY, -cy + slackY);
  }
  function worldToScreen(x, y) { return [W / 2 + pan[0] + x * zoom, H / 2 + pan[1] + y * zoom]; }
  function screenToWorld(x, y) { return [(x - W / 2 - pan[0]) / zoom, (y - H / 2 - pan[1]) / zoom]; }
  function hitTest(sx, sy) {
    const [wx, wy] = screenToWorld(sx, sy);
    let best = null, bd = Infinity;
    for (const n of nodes) { const d = Math.hypot(n.x - wx, n.y - wy); if (d <= n.r && d < bd) { bd = d; best = n; } }
    return best;
  }
  function draw(e) {
    if (dead) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const list = animFrom && e != null ? nodes.map((n, i) => { const f = animFrom[i]; return f ? { ...n, x: f.x + (n.x - f.x) * e, y: f.y + (n.y - f.y) * e, r: f.r + (n.r - f.r) * e } : n; }) : nodes;
    list.forEach(n => {
      const [sx, sy] = worldToScreen(n.x, n.y), rr = Math.max(.4, n.r * zoom) * (pressed === n ? .94 : 1);
      ctx.beginPath(); ctx.arc(sx, sy, rr, 0, 6.283185307); ctx.fillStyle = n.h; ctx.fill();
      if (rr >= 9) { ctx.lineWidth = Math.max(1, rr * .025); ctx.strokeStyle = n.L < 50 ? `rgba(236,232,223,${n.L < 14 ? .3 : .18})` : "rgba(14,13,11,.12)"; ctx.stroke(); }
      const d = rr * 2;
      if (d * .19 < HONEY_LABEL_FS_MIN) return;
      const w = honeyWrap(ctx, n.n), fsReal = w.fs * d;
      if (fsReal < HONEY_LABEL_FS_MIN) return;
      const fs = Math.min(fsReal, 28), lh = fs * 1.02, showPct = d > 64;
      const y0 = sy - (w.lines.length - 1) * lh / 2 + fs * .06 - (showPct ? fs * .46 : 0);
      ctx.font = `${fs}px "Instrument Serif",Georgia,serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillStyle = inkHex(n.h); ctx.globalAlpha = Math.min(1, (fsReal - HONEY_LABEL_FS_MIN) / 2);
      w.lines.forEach((s, i2) => ctx.fillText(s, sx, y0 + i2 * lh));
      if (showPct) { ctx.font = `500 ${Math.min(13, d * .05)}px "Geist Mono",ui-monospace,monospace`; ctx.globalAlpha *= .78; ctx.fillText(pctFmt(n.share * 100), sx, y0 + (w.lines.length - 1) * lh + fs * 1.05); }
      ctx.globalAlpha = 1;
    });
  }
  function runAnim() {
    cancelAnimationFrame(raf);
    const t0 = animT0, dur = 380;
    const step = () => {
      const t = clamp((performance.now() - t0) / dur, 0, 1), e = 1 - Math.pow(1 - t, 3);
      draw(e);
      if (t < 1) raf = requestAnimationFrame(step); else { animFrom = null; raf = 0; }
    };
    raf = requestAnimationFrame(step);
  }
  function relayout(animate) {
    const cols = getColors(count), prev = nodes;
    nodes = phLayout(cols, arr, W, H);
    fitView();
    subEl.textContent = PH_SUB;
    if (animate && !RM && prev.length) {
      const prevBy = new Map(prev.map(n => [n.h, n]));
      animFrom = nodes.map(n => { const p = prevBy.get(n.h); return p ? { x: p.x, y: p.y, r: p.r } : { x: n.x, y: n.y, r: 0 }; });
      animT0 = performance.now(); runAnim();
    } else { animFrom = null; draw(); }
  }

  // ---------- pointer hygiene: tracked pointers, pinch-with-anchor pan+zoom, a tap that never fires mid-drag,
  // and the same belt-and-suspenders clears the map uses so a lost/obscured pointer can never leave this stuck ----------
  const ptrs = new Map();
  let down = null, pinch = null;
  function resetPointers() { ptrs.clear(); down = null; pinch = null; pressed = null; }
  function pt(e) { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
  stage.addEventListener("pointerdown", e => {
    e.stopPropagation();
    try { cv.setPointerCapture(e.pointerId); } catch (err) {}
    ptrs.set(e.pointerId, pt(e));
    if (ptrs.size === 1) {
      const [sx, sy] = pt(e), node = hitTest(sx, sy);
      down = { x: sx, y: sy, t: performance.now(), node, moved: false, pan0: pan.slice() };
      pressed = node; if (node) draw();
    } else if (ptrs.size === 2) {
      down = null; pressed = null;
      const [p1, p2] = [...ptrs.values()], mid = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];
      pinch = { dist0: Math.hypot(p2[0] - p1[0], p2[1] - p1[1]), zoom0: zoom, world: screenToWorld(mid[0], mid[1]) };
    } else { down = null; pinch = null; }
  });
  stage.addEventListener("pointermove", e => {
    if (!ptrs.has(e.pointerId)) return;
    e.stopPropagation(); ptrs.set(e.pointerId, pt(e));
    if (pinch && ptrs.size >= 2) {
      const [p1, p2] = [...ptrs.values()], mid = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];
      const dist = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
      if (dist < 4 || pinch.dist0 < 4) return;
      const nz = clamp(pinch.zoom0 * (dist / pinch.dist0), PH_ZMIN, PH_ZMAX);
      const nx = mid[0] - W / 2 - pinch.world[0] * nz, ny = mid[1] - H / 2 - pinch.world[1] * nz;
      if (!Number.isFinite(nz) || !Number.isFinite(nx) || !Number.isFinite(ny)) return;
      zoom = nz; pan = [nx, ny]; clampPan(); draw();
      return;
    }
    if (!down) return;
    const [sx, sy] = pt(e), dx = sx - down.x, dy = sy - down.y;
    if (!down.moved && Math.hypot(dx, dy) > 8) { down.moved = true; pressed = null; }
    if (!down.moved) return;
    const nx = down.pan0[0] + dx, ny = down.pan0[1] + dy;
    if (!Number.isFinite(nx) || !Number.isFinite(ny)) return;
    pan = [nx, ny]; clampPan(); draw();
  });
  const up = e => {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.delete(e.pointerId);
    if (pinch) { if (ptrs.size < 2) pinch = null; return; }
    if (!down) return;
    const d = down; down = null;
    if (!d.moved && d.node && performance.now() - d.t < 500) {
      const hex = d.node.h; pressed = null; buzz(6); close(); openTappedColor(hex); return;
    }
    pressed = null; draw();
  };
  stage.addEventListener("pointerup", up); stage.addEventListener("pointercancel", up);
  stage.addEventListener("lostpointercapture", up);
  stage.addEventListener("pointerleave", e => { if (e.pointerType !== "mouse") up(e); });
  stage.addEventListener("touchstart", e => { if (ptrs.size > e.touches.length) resetPointers(); }, { passive: true });
  stage.addEventListener("touchcancel", () => resetPointers(), { passive: true });
  stage.addEventListener("touchmove", e => e.preventDefault(), { passive: false });
  const onBlur = () => resetPointers();
  addEventListener("blur", onBlur); addEventListener("pagehide", onBlur);

  // ---------- controls ----------
  const nOut = sh.querySelector("[data-ph-n]"), input = sh.querySelector(".ph-count input");
  nOut.textContent = count;
  countify(input, { min: minN, max, value: count, out: nOut, onSet: (v, final) => { nOut.textContent = v; if (v === count) return; count = v; relayout(true); if (final) buzz(3); } });
  sh.querySelectorAll("[data-ph-arr]").forEach(b => b.onclick = () => {
    if (b.dataset.phArr === arr) return;
    buzz(4); arr = b.dataset.phArr;
    sh.querySelectorAll("[data-ph-arr]").forEach(x => x.classList.toggle("on", x === b));
    relayout(true);
  });

  const ro = new ResizeObserver(() => { resize(); relayout(false); });
  ro.observe(stage);
  resize(); relayout(false);
  const teardown = () => { dead = true; cancelAnimationFrame(raf); ro.disconnect(); resetPointers(); removeEventListener("blur", onBlur); removeEventListener("pagehide", onBlur); if (window.PH_DEBUG === DEBUG) window.PH_DEBUG = null; };
  cleanup.push(teardown);
  // QA hook (tools/smoke/scenarios.js), same pattern as js/home.js's window.HM_CTRL: every field reads the live
  // closure state, never a snapshot, so it stays correct across a slider change, an arrangement switch or a pinch.
  const DEBUG = {
    count: () => nodes.length,
    max: () => max,
    hexAt: i => nodes[i] && nodes[i].h,
    screenOf(hex) {
      const n = nodes.find(x => x.h === hex); if (!n) return null;
      const [sx, sy] = worldToScreen(n.x, n.y), r = cv.getBoundingClientRect();
      return { x: r.left + sx, y: r.top + sy, r: n.r * zoom };
    },
  };
  window.PH_DEBUG = DEBUG;
  return { close: () => { teardown(); close(); } };
}
