"use strict";
// The standard color map for ONE thing's colors (David, 2026-10-25: "I want it visualized like a regular color map like
// everything else in the app: circles or honeycombs"). One module behind every "See its colors" door: a painting, an
// uploaded photo, a palette, a set, a subject, and a painter's whole color map (js/paintercolors.js drives this with
// its own data and arrangements). It looks and behaves like the app's regular map:
//
//   * the map's own screen chrome: Back top-left, the title, the ⋯ corner (the same sheet component as the painting map's
//     and the color map's: Look, Arrange, which colors, how many, and the size switch). No floating mini-menu.
//   * the regular map's cells: the named color as the fill, Instrument Serif labels (honeyWrap), the same hairline seams.
//   * Look: Circles (the default) or Honeycomb. Every cell is the SAME size and sits on one hexagonal lattice; the
//     most-used / most-prominent color is in the CENTER and the rest spiral out. "Size circles by how much there is" is an
//     option for Circles only (a honeycomb can't scale), off by default.
//   * pinch / pan with the same clamp-and-never-stick discipline, one tap opens the color's page.
//
//   openPaletteHive({ title, colors: [{h,n?,share?}…], source?, poolFn?(n), max?, ... })
//     title       the heading            source   a short kind ("painting", "painter", "set", "camera"…)
//     poolFn(n)   recompute the real top-n from the full measured pool (the "How many" slider re-asks the engine)
//     max         the slider's ceiling   sub(arr, mode)  the one-line caption under the title   fine  the honest footnote
//     cta         { label, run } a door out ("All of <painter>'s colors")
//   And the hooks js/paintercolors.js uses: arrs (its own arrangements), itemsFn(arr, n, mode), rowsFn(arr, items) -> labelled
//   row groups (By decade / Against peers), noCount(arr, mode), modes ([[key, label]…], e.g. Vivid | All colors),
//   label2(arr, node) (the second line in a big cell), onTap(node, close, {mode}), sizeLabel, defer(progress, handle) (an
//   async load behind a calm progress bar; resolves to more options, or null to close).
//
// Opening is an overlay on the page that opened it: closing it (Back, Escape) reveals that page again, and a tapped cell
// closes it and opens that color's page in one tap (js/swatch.js openTappedColor); Back from there returns to the page.

const PH_MIN_N = 3, PH_MAXN = 200;   // o.maxCap lifts PH_MAXN (the painter's color map goes to 400)
const PH_ZMIN = .12, PH_ZMAX = 8;
const PH_D = 100, PH_ROW = PH_D * .8660254, PH_LINE = 7;   // one cell: diameter 100 on a pointy-top hexagonal lattice
const PH_ARR = [["share", "By amount"], ["hue", "By hue"], ["light", "By lightness"], ["spiral", "Spiral"]];
const PH_GA = Math.PI * (3 - Math.sqrt(5));
const PH_SRC_LABEL = { painting: "Painting", painter: "Painter", decade: "Decade", movement: "Movement", country: "Country", museum: "Museum", look: "Style", set: "Set", palette: "Palette", camera: "Camera", photo: "Photo" };
const PH_SUBS = {
  share: "The most prominent color is in the middle, the rest spiral out.",
  hue: "Around the ring by hue, darker colors toward the middle.",
  light: "Darkest on the left to lightest on the right.",
  spiral: "Walking round the hue wheel from the middle out.",
};
const PH_KEY = "colorhub-hive-v1";
function phPrefs() { try { const p = JSON.parse(localStorage.getItem(PH_KEY)); return p && typeof p === "object" ? p : {}; } catch (e) { return {}; } }
function phSavePref(fn) { try { const p = phPrefs(); fn(p); localStorage.setItem(PH_KEY, JSON.stringify(p)); } catch (e) {} }

const phName = c => c.n || (typeof nameOf === "function" ? nameOf(c.h).text : c.h);
function phHash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967295; }

// ---------- the lattice: slots in a round blob, nearest the middle first ----------
// asp = the room's height over its width: a tall phone gets a taller blob, so the cells come out as big as the room allows
function phSlots(n, asp = 1) {
  asp = clamp(asp, .6, 1.9);
  const R = Math.ceil(Math.sqrt(n * 1.4 * Math.max(asp, 1 / asp))) + 3, out = [];
  for (let q = -R; q <= R; q++) for (let r = -R; r <= R; r++) {
    if (Math.abs(q + r) > R) continue;
    const x = PH_D * (q + r / 2), y = PH_ROW * r;
    out.push({ x, y, d: Math.round((x * x * asp + y * y / asp) * 10) / 10, a: Math.atan2(y, x) });
  }
  return out.sort((a, b) => a.d - b.d || a.a - b.a);
}
// lightness read against THIS set's own range, so the ring and the ramp use the whole room
function phRange(items) {
  const Ls = items.map(i => i.L), lo = Math.min(...Ls), hi = Math.max(...Ls);
  return v => hi - lo < 6 ? .5 : (v - lo) / (hi - lo);
}
const phHueKey = it => it.C < 14 ? -1000 + (100 - it.L) : it.H;
// where each arrangement wants a color to sit (world units, centred on 0,0; Rw = the lattice's rough radius)
function phAnchor(arr, it, f, Rw) {
  if (arr === "hue") {
    if (it.C < 10) { const a = phHash(it.h) * 6.2832, r = Rw * .12 * Math.sqrt(f(it.L) * 3 + .3); return [Math.cos(a) * r, Math.sin(a) * r]; }
    const ang = (it.H - 90) * Math.PI / 180, rad = Rw * (.28 + .7 * f(it.L));
    return [Math.cos(ang) * rad, Math.sin(ang) * rad];
  }
  // light: dark on the left to light on the right, hue stacked up each column, neutrals at the bottom
  const x = (f(it.L) - .5) * 2 * Rw * .95, y = it.C < 10 ? Rw * .85 : (((it.H + 340) % 360) / 360 - .5) * 2 * Rw * .8;
  return [x, y];
}
// ONE layout for everything: the same equal cells whatever the look. Returns { nodes, rows, ends }.
function phPlace(arr, cols, rowsFn, asp) {
  const n = cols.length;
  const groups = rowsFn ? rowsFn(arr, cols) : null;
  if (groups && groups.length) {
    const nodes = [], rows = []; let line = 0;
    groups.forEach(g => {
      const items = g.items.slice().sort((a, b) => b.share - a.share || String(a.n).localeCompare(String(b.n))), start = line;
      for (let k = 0; k < items.length; k += PH_LINE) {
        items.slice(k, k + PH_LINE).forEach((it, c) => nodes.push({ ...it, x: c * PH_D + (line % 2 ? PH_D / 2 : 0), y: line * PH_ROW }));
        line++;
      }
      rows.push({ label: g.label, sub: g.sub, y: (start + line - 1) / 2 * PH_ROW });
      line++;
    });
    nodes.push({ h: "#000000", key: "ghost", ghost: true, r: 1, x: -PH_D * 3.6, y: 0, L: 0, C: 0, H: 0, share: 0, n: "" });   // room for the row labels
    return { nodes, rows };
  }
  const slots = phSlots(n, asp);
  if (arr === "share" || arr === "spiral") {
    const ordered = cols.slice().sort(arr === "spiral" ? (a, b) => phHueKey(a) - phHueKey(b) : (a, b) => b.share - a.share || String(a.n).localeCompare(String(b.n)));
    return { nodes: ordered.map((it, i) => ({ ...it, x: slots[i].x, y: slots[i].y })) };
  }
  const f = phRange(cols), Rw = PH_D * (.58 * Math.sqrt(n) + 1), free = slots.map(() => true), nodes = [];
  cols.slice().sort((a, b) => b.share - a.share || String(a.n).localeCompare(String(b.n))).forEach(it => {
    const [ax, ay] = phAnchor(arr, it, f, Rw);
    let bi = -1, bd = Infinity;
    for (let i = 0; i < slots.length; i++) { if (!free[i]) continue; const d = (slots[i].x - ax) ** 2 + (slots[i].y - ay) ** 2; if (d < bd) { bd = d; bi = i; } }
    free[bi] = false; nodes.push({ ...it, x: slots[bi].x, y: slots[bi].y });
  });
  return { nodes };
}

// ---------- the map ----------
function openPaletteHive(o0 = {}) {
  const seed0 = (o0.colors || []).map(c => typeof c === "string" ? { h: c } : c).filter(c => c && c.h);
  if (!seed0.length && !o0.defer) return;
  let o = o0, dead = false, started = false;
  const RM = reduceMotion, prefs = phPrefs();
  const el = document.createElement("div");
  el.className = "screen fixed cx pmx phx";
  el.setAttribute("role", "dialog"); el.style.animation = "none";   // an overlay over a page, not a screen change: no entrance, so it is opaque from the first frame
  el.innerHTML = `
    <div class="pmx-stage"><canvas class="pmx-cv" aria-label="Every color here. Drag to pan, pinch to zoom, tap a color to open its page."></canvas>
      <div class="pmx-wait phx-wait" data-phwait><p data-phwt>${esc(o0.waitText || "Laying out the colors…")}</p><div class="pc-bar" data-phbarw hidden><i data-phbar></i></div></div></div>
    <header class="pmx-top">
      <button class="icon-btn glass" data-phback aria-label="Back">${ICON.back}</button>
      <p class="pmx-title"><b data-phtitle>${esc(o0.title || "Colors")}</b><small data-phsub></small></p>
      <span class="pmx-sp" aria-hidden="true"></span>
    </header>
    <button class="corner r hm-do pmx-do" data-phdo aria-label="More" aria-haspopup="dialog" hidden>${ICON.more}</button>
    ${o0.cta ? `<button type="button" class="phx-cta" data-phcta hidden>${esc(o0.cta.label)} ${ICON.arrow}</button>` : ""}
  `;
  document.body.appendChild(el);
  const stage = el.querySelector(".pmx-stage"), cv = el.querySelector(".pmx-cv"), ctx = cv.getContext("2d");
  const subEl = el.querySelector("[data-phsub]"), doBtn = el.querySelector("[data-phdo]"), waitEl = el.querySelector("[data-phwait]");

  // state (set once the options are known: immediately, or when a deferred load lands)
  let seed = [], poolFn = null, itemsFn = null, arrs = PH_ARR, max = 0, minN = 3, count = 3, arr = "share", modes = null, mode = "";
  let look = prefs.look === "honey" ? "honey" : "circles", size = !!prefs.size;
  let W = 0, H = 0, dpr = 1, nodes = [], rowsNow = [], bbox = null, pan = [0, 0], zoom = 1, baseZoom = 1;
  let animFrom = null, animT0 = 0, raf = 0, pressed = null;
  const src = () => o.source || "set";
  const honey = () => look === "honey";

  function resize() {
    const r = stage.getBoundingClientRect();
    W = Math.max(40, r.width); H = Math.max(40, r.height); dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cv.style.width = W + "px"; cv.style.height = H + "px";
  }
  const topPad = () => { const t = el.querySelector(".pmx-top"); return Math.max(60, (t ? t.offsetHeight : 80) - 12); };
  const botPad = () => 84;
  function fitView() {
    const real = nodes.filter(n => !n.ghost);
    if (!nodes.length || !real.length) { bbox = null; zoom = baseZoom = 1; pan = [0, 0]; return; }
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    nodes.forEach(n => { const rx = n.ghost ? n.r : PH_D / 2, ry = n.ghost ? n.r : PH_D * .58; if (n.x - rx < minX) minX = n.x - rx; if (n.x + rx > maxX) maxX = n.x + rx; if (n.y - ry < minY) minY = n.y - ry; if (n.y + ry > maxY) maxY = n.y + ry; });
    bbox = { minX, maxX, minY, maxY };
    const cw = Math.max(20, maxX - minX), ch = Math.max(20, maxY - minY), mt = topPad(), mb = botPad(), mx = 14;
    const fitZoom = Math.min((W - mx * 2) / cw, (H - mt - mb - 8) / ch);
    zoom = baseZoom = clamp(isFinite(fitZoom) ? fitZoom : 1, PH_ZMIN, PH_ZMAX);
    pan = [-(minX + maxX) / 2 * zoom, (mt - mb) / 2 - (minY + maxY) / 2 * zoom];
  }
  function clampPan() {
    if (!bbox) return;
    const cx = (bbox.minX + bbox.maxX) / 2 * zoom, cy = (bbox.minY + bbox.maxY) / 2 * zoom;
    const cw = (bbox.maxX - bbox.minX) * zoom, ch = (bbox.maxY - bbox.minY) * zoom;
    const slackX = Math.max(W * .55, cw * .6), slackY = Math.max(H * .55, ch * .6);
    pan[0] = clamp(pan[0], -cx - slackX, -cx + slackX);
    pan[1] = clamp(pan[1], -cy - slackY, -cy + slackY);
  }
  const worldToScreen = (x, y) => [W / 2 + pan[0] + x * zoom, H / 2 + pan[1] + y * zoom];
  const screenToWorld = (x, y) => [(x - W / 2 - pan[0]) / zoom, (y - H / 2 - pan[1]) / zoom];
  function hitTest(sx, sy) {
    const [wx, wy] = screenToWorld(sx, sy);
    let best = null, bd = Infinity;
    for (const n of nodes) { if (n.ghost) continue; const d = Math.hypot(n.x - wx, n.y - wy); if (d <= Math.max(n.r, PH_D * .3) && d < bd) { bd = d; best = n; } }
    return best;
  }
  function hexPath(cx, cy, apo) {
    const R6 = apo / .8660254;
    ctx.beginPath();
    for (let k = 0; k < 6; k++) { const a = -Math.PI / 2 + k * Math.PI / 3, x = cx + Math.cos(a) * R6, y = cy + Math.sin(a) * R6; if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
    ctx.closePath();
  }
  function draw(e) {
    if (dead) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    underLabels();
    const list = animFrom && e != null ? nodes.map((n, i) => { const f = animFrom[i]; return f ? { ...n, x: f.x + (n.x - f.x) * e, y: f.y + (n.y - f.y) * e, r: f.r + (n.r - f.r) * e } : n; }) : nodes;
    const hx = honey(), labMin = 8.5;   // the regular map hides a name under 11px (a smudge); one thing's few colors read from 8.5 (honey.js's own floor for palette views is 7), and pinching in shows the rest
    list.forEach(n => {
      if (n.ghost) return;
      const [sx, sy] = worldToScreen(n.x, n.y), rr = Math.max(.4, n.r * zoom) * (pressed === n ? .94 : 1);
      if (hx) { hexPath(sx, sy, rr); } else { ctx.beginPath(); ctx.arc(sx, sy, rr, 0, 6.283185307); }
      ctx.fillStyle = n.h; ctx.fill();
      if (rr >= 5) {
        ctx.lineWidth = hx ? Math.max(1, zoom * 2.4) : Math.max(1, rr * .025);
        ctx.strokeStyle = hx ? "rgba(20,19,17,.4)" : n.L < 50 ? `rgba(236,232,223,${n.L < 14 ? .3 : .18})` : "rgba(14,13,11,.12)";
        ctx.stroke();
      }
      const d = rr * 2;
      if (d * .19 < labMin) return;
      const w = honeyWrap(ctx, n.n), fsReal = w.fs * d;
      if (fsReal < labMin) return;
      const fs = Math.min(fsReal, 30), lh = fs * 1.02, showSub = d > 64;
      const y0 = sy - (w.lines.length - 1) * lh / 2 + fs * .06 - (showSub ? fs * .46 : 0);
      ctx.font = `${fs}px "Instrument Serif",Georgia,serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillStyle = inkHex(n.h); ctx.globalAlpha = Math.min(1, (fsReal - labMin) / .3);
      w.lines.forEach((s, i2) => ctx.fillText(s, sx, y0 + i2 * lh));
      if (showSub) { ctx.font = `500 ${o.label2 ? clamp(d * .085, 11, 16) : Math.min(13, d * .05)}px "Geist Mono",ui-monospace,monospace`; ctx.globalAlpha *= .78; ctx.fillText(o.label2 ? (o.label2(arr, n) || "") : pctFmt(n.share * 100), sx, y0 + (w.lines.length - 1) * lh + fs * 1.05); }
      ctx.globalAlpha = 1;
    });
  }
  // row labels (By decade / Against peers) and the Darker / Lighter ends of By lightness
  function underLabels() {
    const fs = Math.max(13, Math.min(17, 14 * zoom));
    ctx.save(); ctx.fillStyle = "rgba(236,232,223,.82)"; ctx.textBaseline = "middle";
    if (rowsNow.length) {
      ctx.textAlign = "right";
      rowsNow.forEach(r => {
        const [sx, sy] = worldToScreen(-PH_D * .75, r.y);
        ctx.font = `400 ${fs * 1.25}px "Instrument Serif",Georgia,serif`; ctx.fillText(r.label, sx, sy - fs * (r.sub ? .4 : 0));
        if (r.sub) { ctx.font = `400 ${fs * .8}px "Geist",system-ui,sans-serif`; ctx.globalAlpha = .6; ctx.fillText(r.sub, sx, sy + fs * .75); ctx.globalAlpha = 1; }
      });
    } else if (arr === "light" && bbox) {
      ctx.font = `400 ${fs}px "Geist",system-ui,sans-serif`; ctx.globalAlpha = .7;
      ctx.textAlign = "left"; const [lx, ly] = worldToScreen(bbox.minX, bbox.maxY + PH_D * .35); ctx.fillText("Darker", lx, ly);
      ctx.textAlign = "right"; const [rx, ry] = worldToScreen(bbox.maxX, bbox.maxY + PH_D * .35); ctx.fillText("Lighter", rx, ry);
    }
    ctx.restore();
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

  // the items for the current arrangement, with the numbers the layout reads
  const getColors = n => {
    const raw = itemsFn ? (itemsFn(arr, n, mode) || []) : (poolFn ? (poolFn(n) || []) : seed).slice(0, Math.min(n, max));
    return raw.map(c => { const [L, C, H2] = lch(c.h); return { ...c, n: c.n || phName(c), share: c.share != null ? c.share : 1 / raw.length, L, C, H: H2 }; });
  };
  // Circles: all one size unless "Size circles…" is on. A honeycomb never scales.
  function relayout(animate) {
    const cols = getColors(count), prev = nodes;
    const res = phPlace(arr, cols, o.rowsFn, (H - topPad() - botPad()) / Math.max(W, 1));
    const scaled = !honey() && size, RC = PH_D / 2 - 2, RH = PH_D / 2;
    const real = res.nodes.filter(n => !n.ghost), mx = Math.max(...real.map(n => n.share), .0001);
    res.nodes.forEach(n => { if (n.ghost) return; n.r = honey() ? RH : scaled ? RC * (.25 + .75 * Math.sqrt(clamp(n.share / mx, 0, 1))) : RC; });
    if (scaled && !res.rows && (arr === "share" || arr === "spiral")) {   // smaller circles drift in toward the middle until they touch
      const it = clamp(Math.round(40000 / Math.max(1, real.length)), 70, 200), settle = 36;   // the last passes only separate, so nothing ends overlapped
      for (let k = 0; k < it; k++) {
        if (k < it - settle) real.forEach(nd => { nd.x -= nd.x * .03; nd.y -= nd.y * .03; });
        for (let i = 0; i < real.length; i++) for (let j = i + 1; j < real.length; j++) {
          const a = real[i], b = real[j]; let dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
          const min = a.r + b.r + 3;
          if (d < min) {
            if (d < 1e-4) { dx = .01; dy = 0; d = .01; }
            const push = (min - d) / 2, ux = dx / d, uy = dy / d;
            if (i === 0) { b.x += ux * push * 2; b.y += uy * push * 2; } else { a.x -= ux * push; a.y -= uy * push; b.x += ux * push; b.y += uy * push; }
          }
        }
      }
    }
    nodes = res.nodes; rowsNow = res.rows || [];
    fitView();
    subEl.textContent = (o.sub && o.sub(arr, mode, look)) || (PH_SUBS[arr] || "") + (!honey() && size ? " Circle size shows how much." : "");
    if (animate && !RM && prev.length) {
      const prevBy = new Map(prev.map(n => [n.key || n.h, n]));
      animFrom = nodes.map(n => { const p = prevBy.get(n.key || n.h); return p ? { x: p.x, y: p.y, r: p.r } : { x: n.x, y: n.y, r: 0 }; });
      animT0 = performance.now(); runAnim();
    } else { animFrom = null; draw(); }
  }

  // ---------- pointer hygiene: tracked pointers, pinch-with-anchor pan+zoom, a tap that never fires mid-drag ----------
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
      const hex = d.node.h; pressed = null; buzz(6);
      if (o.onTap) { o.onTap(d.node, close, { mode }); return; }
      close(); openTappedColor(hex); return;
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

  // ---------- the ⋯ sheet: the app's standard map sheet (same component and classes as the painting map's) ----------
  const arrOk = k => arrs.some(a => a[0] === k);
  const showCount = () => !(o.noCount && o.noCount(arr, mode)) && max > minN;
  const saveArr = () => phSavePref(p => { p.arr = { ...(p.arr || {}), [src()]: arr }; });
  const saveMode = () => phSavePref(p => { p.mode = { ...(p.mode || {}), [src()]: mode }; });
  function setLook(k) { if (k === look) return; look = k; phSavePref(p => { p.look = k; }); relayout(true); }
  function setSize(on) { if (on === size) return; size = on; phSavePref(p => { p.size = on; }); relayout(true); }
  function setArr(k) { if (k === arr || !arrOk(k)) return; arr = k; saveArr(); relayout(true); }
  function setMode(k) { if (k === mode || !modes || !modes.some(m => m[0] === k)) return; mode = k; saveMode(); relayout(true); }
  function setCount(v) { if (v === count) return; count = v; relayout(true); }

  let openSheetClose = null;
  function openOpts() {
    if (document.querySelector(".sheet") || dead) return;
    if (typeof stemJustClosed === "function" && stemJustClosed()) return;
    const { sh, close: sclose } = sheet(`<div class="hm-chooser pmx-chooser">
        <div class="hm-ch-head" data-sheet-grab><div class="hm-ch-tabs pmx-tabs" role="tablist" aria-label="Arrange this color map"><button class="hm-ch-tab on" role="tab" aria-selected="true">Arrange</button></div>
          <button class="iconq hm-ch-x" data-sheet-close aria-label="Close">${ICON.x}</button></div>
        <div class="hm-ch-scroll" data-sheet-scroll data-phbody></div></div>`, { lock: false });
    openSheetClose = sclose;
    sh.classList.add("pmx-sheet", "hm-sheet-panel", "hm-sheet-arrange", "phx-sheet");
    sh.setAttribute("aria-label", "Arrange this color map");
    const scrim = sh.previousElementSibling; if (scrim && scrim.classList.contains("scrim")) scrim.classList.add("hm-scrim-clear");
    sh.querySelector("[data-sheet-close]").onclick = () => { buzz(4); sclose(); };
    const body = sh.querySelector("[data-phbody]");
    const icon = id => typeof hmLookIcon === "function" ? `<i class="hm-look-ic">${hmLookIcon(id)}</i>` : "";
    function render() {
      const sizeOn = !honey();
      body.innerHTML = `
        <div class="cx-sec"><b>Look</b></div>
        <div class="hm-seg hm-look-seg" role="radiogroup" aria-label="Look">
          <button class="hm-look-chip${look === "circles" ? " on" : ""}" data-phlook="circles" role="radio" aria-checked="${look === "circles"}">${icon("original")}<span>Circles</span></button>
          <button class="hm-look-chip${look === "honey" ? " on" : ""}" data-phlook="honey" role="radio" aria-checked="${look === "honey"}">${icon("honeycomb")}<span>Honeycomb</span></button></div>
        ${arrs.length > 1 ? `<div class="cx-sec"><b>Arrange</b></div>
        <div class="hm-seg phx-seg" role="radiogroup" aria-label="Arrange by">${arrs.map(([k, t]) => `<button class="${k === arr ? "on" : ""}" data-pharr="${k}" role="radio" aria-checked="${k === arr}">${esc(t)}</button>`).join("")}</div>` : ""}
        ${modes ? `<div class="cx-sec"><b>${esc(o.modesTitle || "Colors")}</b></div>
        <div class="hm-seg phx-seg" role="radiogroup" aria-label="Which colors">${modes.map(([k, t]) => `<button class="${k === mode ? "on" : ""}" data-phmode="${k}" role="radio" aria-checked="${k === mode}">${esc(t)}</button>`).join("")}</div>` : ""}
        ${sizeOn ? `<button class="pmx-tg${size ? " on" : ""}" data-phsize role="switch" aria-checked="${size}"><span class="pmx-tg-t"><b>${esc(o.sizeLabel || "Size circles by how much there is")}</b></span><i class="pmx-tg-sw" aria-hidden="true"></i></button>` : ""}
        ${showCount() ? `<div class="cx-sec"><b>How many</b></div>
        <div class="ph-count"><label class="ph-count-l"><input type="range" aria-label="How many colors"><b data-ph-n>${count}</b></label></div>` : ""}
        <p class="fine ph-fine">${o.fine ? esc(o.fine) : `Screen colors are approximate${o.subtitle ? " · " + esc(o.subtitle) : ""}.`}</p>`;
      body.querySelectorAll("[data-phlook]").forEach(b => b.onclick = () => { buzz(4); setLook(b.dataset.phlook); render(); });
      body.querySelectorAll("[data-pharr]").forEach(b => b.onclick = () => { buzz(4); setArr(b.dataset.pharr); render(); });
      body.querySelectorAll("[data-phmode]").forEach(b => b.onclick = () => { buzz(4); setMode(b.dataset.phmode); render(); });
      const sw = body.querySelector("[data-phsize]"); if (sw) sw.onclick = () => { buzz(5); setSize(!size); render(); };
      const input = body.querySelector(".ph-count input");
      if (input) { const nOut = body.querySelector("[data-ph-n]"); countify(input, { min: minN, max, value: count, out: nOut, onSet: (v, final) => { nOut.textContent = v; setCount(v); if (final) buzz(3); } }); }
    }
    render();
  }

  // ---------- start: once the options are known ----------
  function start() {
    seed = (o.colors || []).map(c => typeof c === "string" ? { h: c } : c).filter(c => c && c.h);
    poolFn = typeof o.poolFn === "function" ? o.poolFn : null; itemsFn = typeof o.itemsFn === "function" ? o.itemsFn : null;
    arrs = o.arrs || PH_ARR;
    const capN = o.maxCap || PH_MAXN;
    max = clamp(o.max != null ? o.max : (poolFn ? capN : seed.length), 1, capN);
    minN = Math.min(PH_MIN_N, max);
    count = clamp(o.count0 || seed.length || minN, minN, max);
    modes = o.modes || null;
    const pm = prefs.mode && prefs.mode[src()], pa = prefs.arr && prefs.arr[src()];
    mode = modes ? (modes.some(m => m[0] === pm) ? pm : (o.mode0 || modes[0][0])) : "";
    arr = arrOk(pa) ? pa : (o.arr0 && arrOk(o.arr0) ? o.arr0 : arrs[0][0]);
    if (o.title) el.querySelector("[data-phtitle]").textContent = o.title;
    waitEl.hidden = true; doBtn.hidden = false;
    const cta = el.querySelector("[data-phcta]"); if (cta) { cta.hidden = false; cta.onclick = () => { buzz(6); const run = o.cta.run; close(); run(); }; }
    started = true;
    resize(); relayout(false);
  }
  doBtn.onclick = () => { buzz(4); openOpts(); };
  const ro = new ResizeObserver(() => { resize(); if (started) relayout(false); });
  ro.observe(stage);

  const onKeyDown = e => { if (e.key === "Escape" && !document.querySelector(".sheet")) { e.preventDefault(); close(); } };
  addEventListener("keydown", onKeyDown, true);
  function teardown() {
    if (dead) return; dead = true; cancelAnimationFrame(raf); ro.disconnect(); resetPointers();
    removeEventListener("blur", onBlur); removeEventListener("pagehide", onBlur); removeEventListener("keydown", onKeyDown, true);
    if (openSheetClose) { try { openSheetClose(); } catch (e) {} }
    el.remove();
    if (window.PH_DEBUG === DEBUG) window.PH_DEBUG = null;
  }
  function close() { teardown(); }
  el.querySelector("[data-phback]").onclick = () => { buzz(4); close(); };
  cleanup.push(teardown);

  // QA hook (tools/smoke/scenarios.js), same pattern as js/home.js's window.HM_CTRL: every field reads live state.
  const DEBUG = {
    count: () => nodes.filter(n => !n.ghost).length,
    arr: () => arr, mode: () => mode, look: () => look, size: () => size,
    setMode, setArr, setLook: k => setLook(k === "honeycomb" ? "honey" : k), setSize, openOpts,
    nodes: () => nodes.filter(n => !n.ghost).map(n => ({ h: n.h, n: n.n, key: n.key, r: n.r, x: n.x, y: n.y, share: n.share, hollow: !!n.hollow })),
    max: () => max,
    hexAt: i => nodes[i] && nodes[i].h,
    screenOf(hex) {
      const n = nodes.find(x => x.h === hex); if (!n) return null;
      const [sx, sy] = worldToScreen(n.x, n.y), r = cv.getBoundingClientRect();
      return { x: r.left + sx, y: r.top + sy, r: n.r * zoom };
    },
  };
  window.PH_DEBUG = DEBUG;

  if (o0.defer) {
    const bw = el.querySelector("[data-phbarw]"), bar = el.querySelector("[data-phbar]"), wt = el.querySelector("[data-phwt]");
    const handle = { title: t => { const b = el.querySelector("[data-phtitle]"); if (b) b.textContent = t; }, text: t => { if (wt) wt.textContent = t; } };
    const prog = (k, n) => { if (dead) return; bw.hidden = false; bar.style.width = Math.round(k / n * 100) + "%"; };
    Promise.resolve().then(() => o0.defer(prog, handle)).then(r => {
      if (dead) return;
      if (!r) { close(); return; }
      o = { ...o0, ...r }; start();
    }).catch(() => { if (!dead) { close(); if (typeof toast === "function") toast("The colors didn't load"); } });
  } else { resize(); start(); }
  return { close };
}
