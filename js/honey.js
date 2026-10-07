"use strict";
// The honeycomb: one view mode of the color browser (js/colorsets.js). It shows ANY list of colors as bubbles on a
// hex lattice seen through a fisheye lens, drawn on one canvas so even the 2,700-name library stays smooth on a phone.
//  - layout "map": hue runs left to right and wraps around (greys get their own band at the seam); lightness runs
//    top to bottom and tiles mirrored (light, dark, light...), so the plane has no edges and no seams.
//    The mirrored tile is turned half way round the hue circle, so a color never sits beside its own copy.
//  - layout "wheel": greys in the middle, hue around, strength outward; the hexagon-shaped wheel tiles the plane.
//  Small sets (under HONEY_FINITE colors) don't wrap: they sit as one cluster and spring back if you pull away.
// Drag with momentum; on release a spring settles the nearest bubble into the center (with a haptic tick).
// Before the first touch the map drifts and breathes softly. Tap a bubble (or the caption) to pick it.
// Zoom: pinch, ctrl/trackpad wheel, or double-tap (again to reset; a two-finger tap resets too), 0.4x to 2.5x.
// Zoomed out the territory turns to dots; zoomed in the names grow and the hex shows under them.
//
// honeycomb(host, { items, layout, focus, pick, zoom, onZoom })
//   -> { update({ items, layout, focus, soft }), zoom(z), current(), destroy() }   (soft: cross-fade, keep the center)
//   items  [{ n, h, c?, lib? }]  c = the app color (one of the 101), lib = its data/library.json entry.
//          Defaults to the 101 app colors as { n, h, c }.
//   focus  an item (or anything with .n or .h) to center first.   pick(item, { morph }) on tap; morph() flies the bubble.
//   onPeek(item)  optional: a long still press (480ms) calls this instead of pick (js/home.js: peek.js's quick look).

const HONEY_SQ3 = Math.sqrt(3) / 2, HONEY_FINITE = 48;
let HONEY_PAN = null;                 // where you were: { key, x, y, z, name }
const HONEY_NORM = new WeakMap();     // original item -> normalized item (Lab, LCh, ink)
const HONEY_LAYOUTS = new Map();      // layout cache by contents

function honeyNorm(o) {
  let it = HONEY_NORM.get(o); if (it) return it;
  const [L, a, b] = lab(o.h), C = Math.hypot(a, b);
  let H = Math.atan2(b, a) * 180 / Math.PI; if (H < 0) H += 360;
  it = { o, n: o.n, h: o.h, c: o.c || null, lib: o.lib || (o.src ? o : null), lab: [L, a, b], L, C, H,
    ink: ink(o.h) === "dark" ? "rgba(20,19,17,.86)" : "rgba(255,255,255,.93)" };
  HONEY_NORM.set(o, it);
  return it;
}

// ---------- layouts: base points on the unit hex lattice (+ the two vectors the plane repeats along) ----------
const honeyHueKey = it => it.C < 7 ? 400 + (100 - it.L) / 100 : (it.H - 15 + 360) % 360;   // greys after the purples
function honeyMap(items) {
  const N = items.length, h0 = Math.max(2, Math.round(Math.sqrt(N / 2.4)));
  let best = null;
  for (let H = Math.max(2, h0 - 3); H <= h0 + 3; H++) {
    const W = Math.ceil(N / H), e = W * H - N, score = e + Math.abs(H - h0) * .6;
    if (!best || score < best.score) best = { H, W, e, score };
  }
  const { H, W, e } = best, half = Math.floor(W / 2);
  // greys get their own band at the seam, dealt round-robin so each grey column runs light to dark
  const grey = items.filter(it => it.C < 7).sort((a, b) => b.L - a.L), gc = Math.max(1, Math.round(grey.length / H));
  const order = items.filter(it => it.C >= 7).sort((a, b) => honeyHueKey(a) - honeyHueKey(b))
    .concat(grey.map((it, i) => [i % gc, i, it]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(x => x[2]));
  const pts = [];
  for (let j = 0, k = 0; j < W; j++) {
    const short = Math.floor((j + 1) * e / W) > Math.floor(j * e / W), col = order.slice(k, k + (short ? H - 1 : H)).sort((a, b) => b.L - a.L);
    k += col.length;
    col.forEach((it, r) => {
      const x = j + (r & 1 ? .5 : 0), y = r * HONEY_SQ3;
      pts.push({ it, x, y });
      // the mirrored tile, turned half way round the hue circle so no color sits next to its own copy
      // (it meets the original only along the lightest and darkest rows, where hue is hardest to see)
      if (r > 0 && r < H - 1) pts.push({ it, x: x + half, y: -y });
    });
  }
  return { pts, A: [W, 0], B: [0, 2 * (H - 1) * HONEY_SQ3] };
}
// cells of a hexagon of radius n, ring by ring, each with its angle
function honeyRings(n) {
  const rings = [];
  for (let q = -n; q <= n; q++) for (let r = -n; r <= n; r++) {
    const d = Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)); if (d > n) continue;
    const x = q + r / 2, y = r * HONEY_SQ3; let a = Math.atan2(-y, x) * 180 / Math.PI; if (a < 0) a += 360;
    (rings[d] = rings[d] || []).push({ x, y, a });
  }
  return rings;
}
function honeyWheel(items) {
  const N = items.length;
  let n = 0; while (3 * n * n + 3 * n + 1 < N) n++;
  const rings = honeyRings(n), byC = items.slice().sort((a, b) => a.C - b.C), pts = [];
  const ad = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
  for (let d = 0, k = 0; d <= n && k < N; d++) {
    const cells = rings[d].sort((a, b) => a.a - b.a), m = Math.min(cells.length, N - k);
    const grp = byC.slice(k, k + m).sort((a, b) => a.H - b.H); k += m;
    const sel = grp.map((_, i) => Math.floor(i * cells.length / m));
    let bo = 0, bc = Infinity;   // turn the ring so each color sits nearest its hue angle
    for (let o = 0; o < cells.length; o++) {
      let c = 0; for (let i = 0; i < m && c < bc; i++) c += ad(grp[i].H, cells[(sel[i] + o) % cells.length].a);
      if (c < bc) { bc = c; bo = o; }
    }
    grp.forEach((it, i) => { const cell = cells[(sel[i] + bo) % cells.length]; pts.push({ it, x: cell.x, y: cell.y }); });
  }
  const cart = (q, r) => [q + r / 2, r * HONEY_SQ3];
  return { pts, A: cart(2 * n + 1, -n), B: cart(n, n + 1) };
}
// a small set as one compact cluster: hue across, light to dark down, each color in the nearest free cell
function honeyCluster(items) {
  const N = items.length, cells = honeyRings(8).flat().sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y) || a.a - b.a).slice(0, N);
  const R = Math.max(.5, ...cells.map(c => Math.hypot(c.x, c.y)));
  const byHue = items.slice().sort((a, b) => honeyHueKey(a) - honeyHueKey(b)), Ls = items.map(it => it.L);
  const lo = Math.min(...Ls), span = Math.max(1, Math.max(...Ls) - lo);
  const tg = byHue.map((it, i) => ({ it, x: (N > 1 ? i / (N - 1) - .5 : 0) * 2 * R, y: ((100 - it.L) - (100 - lo - span)) / span * 2 * R - R }));
  const pairs = [];
  tg.forEach((t, i) => cells.forEach((c, j) => pairs.push([(t.x - c.x) ** 2 + (t.y - c.y) ** 2, i, j])));
  pairs.sort((a, b) => a[0] - b[0]);
  const ti = new Set(), cj = new Set(), pts = [];
  for (const [, i, j] of pairs) { if (ti.has(i) || cj.has(j)) continue; ti.add(i); cj.add(j); pts.push({ it: tg[i].it, x: cells[j].x, y: cells[j].y }); }
  return { pts, finite: true, ext: R };
}
function honeyLayout(raw, layout) {
  let hs = 2166136261; for (const o of raw) for (let i = 0; i < o.n.length; i++) { hs ^= o.n.charCodeAt(i); hs = Math.imul(hs, 16777619); }
  const key = `${layout}|${raw.length}|${hs >>> 0}`;
  const hit = HONEY_LAYOUTS.get(key); if (hit && hit.raw === raw) return hit;
  const items = raw.map(honeyNorm);
  const lay = items.length < HONEY_FINITE ? (layout === "wheel" ? Object.assign(honeyWheel(items), { finite: true }) : honeyCluster(items))
    : layout === "wheel" ? honeyWheel(items) : honeyMap(items);
  if (lay.finite) lay.ext = Math.max(.5, ...lay.pts.map(p => Math.hypot(p.x, p.y)));
  else { const [A, B] = [lay.A, lay.B], det = A[0] * B[1] - B[0] * A[1]; lay.inv = [B[1] / det, -B[0] / det, -A[1] / det, A[0] / det]; lay.per = Math.min(Math.hypot(...A), Math.hypot(...B)); }
  Object.assign(lay, { key, raw, items, mixed: items.some(it => it.c) && items.some(it => !it.c) });
  if (HONEY_LAYOUTS.size > 24) HONEY_LAYOUTS.clear();
  HONEY_LAYOUTS.set(key, lay);
  return lay;
}

// ---------- the lens ----------
const honeyErf = x => { const s = x < 0 ? -1 : 1; x = Math.abs(x); const t = 1 / (1 + .3275911 * x);
  return s * (1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - .284496736) * t + .254829592) * t * Math.exp(-x * x)); };
const HONEY_WRAP = new Map();
// line breaks for a name, worked out once at a 100px reference bubble and then scaled with the bubble
function honeyWrap(ctx, name) {
  let w = HONEY_WRAP.get(name); if (w) return w;
  const maxW = 76, words = name.split(" ");
  for (let fs = 19; fs >= 10; fs -= .5) {
    ctx.font = `${fs}px "Instrument Serif",Georgia,serif`;
    const lines = []; let cur = "";
    for (const wd of words) { const t = cur ? cur + " " + wd : wd; if (!cur || ctx.measureText(t).width <= maxW) cur = t; else { lines.push(cur); cur = wd; } }
    lines.push(cur);
    w = { fs: fs / 100, lines };
    if (lines.length <= 3 && lines.every(l => ctx.measureText(l).width <= maxW)) break;
  }
  HONEY_WRAP.set(name, w);
  return w;
}
// one line on where a color comes from
function honeyWhere(it) {
  if (it.c) {
    const u = UNITS.find(u => u.colors.includes(it.c)), s = it.c.id && S.cards[it.c.id];
    return [u ? `Unit ${u.i + 1} of the 101` : "A basic word", s ? (isMine(s) ? "you know it" : "learning") : ""].filter(Boolean).join(" · ");
  }
  return (it.lib && srcLine(it.lib)) || "Name library";
}

function honeycomb(host, opts = {}) {
  host.classList.add("hc");
  host.innerHTML = `<div class="hc-box"><canvas class="hc-cv" aria-label="Colors as bubbles: drag to browse, pinch to zoom, tap one to open it"></canvas></div>
    <button class="hc-cap"><i></i><span><b></b><small></small></span><em></em></button>`;
  const cv = host.querySelector("canvas"), ctx = cv.getContext("2d"), cap = host.querySelector(".hc-cap");
  const RM = reduceMotion, SHOOT = typeof SHOT !== "undefined" && !!SHOT, DRIFT = .2, LENS = { m0: 3.7, m1: .82, sig: 1.9 }, ZMAX = 2.5;
  let VIG_BG = "";
  let ZMIN = .4;   // per set: zoom out until the screen holds most of one repeat; the vignette hides the copies (see zFloor)
  let layout = opts.layout === "wheel" ? "wheel" : "map", lay = null, P = [0, 0], W = 0, Hh = 0, dpr = 1, base = 30, dead = false;
  let Z = clamp(+opts.zoom || 1, .4, ZMAX), zAnim = null, ghost = null, ghostT0 = 0;
  let phase = "idle", spring = null, touched = RM || SHOOT, visible = true, raf = 0, last = 0;
  let bloom = RM || SHOOT ? 1 : 0, bloomT0 = performance.now(), pressed = null, pressK = 0, drawn = [], center = null, settled = null;

  // ---- geometry: the lens maps a world distance z (in bubble spacings) to a screen radius ----
  const lens = t => {
    const e = 1 - Math.pow(1 - bloom, 3), s = (.72 + .28 * e) * Z;
    const br = phase === "drift" ? 1 + .028 * Math.sin(t / 1000 * Math.PI * 2 / 3.8) : 1;
    return { s, a: e, m0: LENS.m0 * br, m1: LENS.m1, sig: LENS.sig };
  };
  const F = (z, l) => base * l.s * (l.m1 * z + (l.m0 - l.m1) * l.sig * .8862 * honeyErf(z / l.sig));
  const mag = (z, l) => l.m1 + (l.m0 - l.m1) * Math.exp(-((z / l.sig) ** 2));
  const Finv = (r, l) => { let lo = 0, hi = 400; for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (F(m, l) > r) hi = m; else lo = m; } return (lo + hi) / 2; };
  const reach = l => Finv(Math.hypot(W, Hh) / 2 + 40, l);
  // the smallest zoom for a wrapping set: zoomed all the way out, one whole repeat (a disc of unique colors, half a repeat
  // in radius) spans about the screen's width, and the vignette (draw) fades everything beyond it, so a color
  // never shows twice.
  const zFloor = () => {
    if (!lay || lay.finite || !W) return .4;
    const want = 1.35 * Math.min(W, Hh) / 2;   // tuned on a phone: the faded disc then spans about the full width
    const fits = z => F(lay.per * .52, { s: z, m0: LENS.m0, m1: LENS.m1, sig: LENS.sig }) >= want;
    let lo = .05, hi = ZMAX; if (!fits(hi)) return ZMAX;
    for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; if (fits(m)) hi = m; else lo = m; }
    return Math.max(.15, hi);
  };
  // the world offset (from the pan point) under a screen point
  const offAt = (sx, sy, l) => { const dx = sx - W / 2, dy = sy - Hh / 2, r = Math.hypot(dx, dy); if (r < 1e-6) return [0, 0]; const z = Finv(r, l); return [dx / r * z, dy / r * z]; };
  // every copy of a base point within distance R of world point Q (a wrapping plane repeats along A and B)
  function copies(p, Q, R, fn) {
    const dx = p.x - Q[0], dy = p.y - Q[1], R2 = R * R;
    if (lay.finite) { if (dx * dx + dy * dy < R2) fn(dx, dy); return; }
    const [a, b, c, d] = lay.inv, A = lay.A, B = lay.B;
    const al = Math.round(a * dx + b * dy), be = Math.round(c * dx + d * dy), K = Math.min(12, Math.ceil(R / lay.per) + 1);
    for (let i = al - K; i <= al + K; i++) for (let j = be - K; j <= be + K; j++) {
      const ex = dx - i * A[0] - j * B[0], ey = dy - i * A[1] - j * B[1];
      if (ex * ex + ey * ey < R2) fn(ex, ey);
    }
  }
  function nearestTo(Q) {
    let best = null, bd = Infinity;
    const R = lay.finite ? 1e9 : Math.max(2, lay.per);
    for (const p of lay.pts) copies(p, Q, R, (ex, ey) => { const d = ex * ex + ey * ey; if (d < bd) { bd = d; best = { p, x: Q[0] + ex, y: Q[1] + ey }; } });
    return best;
  }

  // ---- drawing ----
  function draw(t = performance.now()) {
    if (!lay || !W || dead) return;
    const l = lens(t), R = reach(l), cx = W / 2, cy = Hh / 2, mark = lay.mixed;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, Hh);
    ctx.globalAlpha = l.a;
    drawn = [];
    let cbest = Infinity, cItem = null;
    for (const p of lay.pts) copies(p, P, R, (ex, ey) => {
      const z = Math.hypot(ex, ey), k = z ? F(z, l) / z : base * l.s * l.m0;
      const x = cx + ex * k, y = cy + ey * k, d = base * l.s * mag(z, l) * .9;
      if (x < -d || y < -d || x > W + d || y > Hh + d || d < 1.6) return;
      if (z < cbest) { cbest = z; cItem = p.it; }
      drawn.push({ it: p.it, x, y, d });
    });
    // the pressed bubble goes last, so its scale-up sits on top
    let pb = null;
    if (pressed) { const i = drawn.findIndex(b => b.it === pressed.it && Math.abs(b.x - pressed.x) < 3 && Math.abs(b.y - pressed.y) < 3); if (i >= 0) { pb = drawn.splice(i, 1)[0]; drawn.push(pb); } }
    for (const b of drawn) {
      const it = b.it, d = b.d * (b === pb ? 1 + .12 * pressK : 1), r = d / 2;
      ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, 6.2832); ctx.fillStyle = it.h; ctx.fill();
      if (d < 8) continue;
      if (it.L < 20) { ctx.lineWidth = 1; ctx.strokeStyle = "rgba(236,232,223,.14)"; ctx.stroke(); }
      const own = it.c && it.c.id && isMine(S.cards[it.c.id]);
      if (own && d > 16) { ctx.beginPath(); ctx.arc(b.x, b.y, r + 3, 0, 6.2832); ctx.lineWidth = 1.2; ctx.strokeStyle = "rgba(236,232,223,.85)"; ctx.stroke(); }
      const la = Math.min(1, Math.max(0, (d - 50) / 6));
      if (la > 0) {
        const w = honeyWrap(ctx, it.n), fs = Math.min(w.fs * d, 30), lh = fs * 1.02, dot = mark && it.c;
        const sub = Math.min(1, Math.max(0, (d - 150) / 30)), subH = sub ? fs * .9 : 0;   // at high zoom: the hex under the name
        const y0 = b.y - (w.lines.length - 1) * lh / 2 + fs * .06 + (dot ? fs * .3 : 0) - subH / 2;
        ctx.font = `${fs}px "Instrument Serif",Georgia,serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillStyle = it.ink; ctx.globalAlpha = l.a * la;
        w.lines.forEach((s, i) => ctx.fillText(s, b.x, y0 + i * lh));
        if (dot) { ctx.beginPath(); ctx.arc(b.x, y0 - fs * .95, Math.max(1.6, d * .022), 0, 6.2832); ctx.fill(); }
        if (sub) {
          ctx.globalAlpha = l.a * sub * .72; ctx.font = `500 ${Math.min(13, d * .055)}px "Geist Mono",ui-monospace,monospace`;
          ctx.fillText(it.h, b.x, y0 + (w.lines.length - 1) * lh + fs * 1.05);
        }
        ctx.globalAlpha = l.a;
      } else if (mark && it.c && d > 9) {   // one of the 101, inside a bigger set
        ctx.beginPath(); ctx.arc(b.x, b.y, Math.max(1.3, d * .09), 0, 6.2832); ctx.fillStyle = it.ink; ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    // the previous contents fade out over the new ones after a live filter change
    if (ghost) {
      const a = 1 - (t - ghostT0) / 240;
      if (a > 0) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = a; ctx.drawImage(ghost, 0, 0); ctx.globalAlpha = 1; } else ghost.on = false;
      if (!ghost.on) ghost = null;
    }
    // vignette: everything farther than ~half a repeat from the center fades out, so a wrapping set never shows a color twice
    if (lay && !lay.finite) {
      const l = lens(t), r0 = F(lay.per * .4, l), r1 = F(lay.per * .52, l), far = Math.hypot(W, Hh) / 2;
      if (r0 < far) {
        VIG_BG = VIG_BG || getComputedStyle(document.body).backgroundColor || "rgb(14,13,11)";
        const g = ctx.createRadialGradient(W / 2, Hh / 2, r0, W / 2, Hh / 2, Math.max(r0 + 1, r1));
        g.addColorStop(0, VIG_BG.replace(/rgba?\(([^,]+),([^,]+),([^,)]+).*\)/, "rgba($1,$2,$3,0)")); g.addColorStop(1, VIG_BG);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.fillRect(0, 0, W, Hh);
      }
    }
    if (cItem !== center) { center = cItem; caption(); }
  }
  function caption() {
    const it = center; if (!it) return;
    cap.querySelector("i").style.setProperty("--c", it.h);
    cap.querySelector("b").textContent = it.n;
    cap.querySelector("small").textContent = honeyWhere(it);
    cap.querySelector("em").textContent = it.h;
  }

  // ---- motion ----
  const kick = () => { if (!raf && visible && !dead) { last = performance.now(); raf = requestAnimationFrame(loop); } };
  function loop(t) {
    raf = 0;
    const dt = Math.min(.05, Math.max(0, (t - last) / 1000)); last = t;
    let more = false;
    if (zAnim) {
      const nz = Math.abs(zAnim.to - Z) < .003 ? zAnim.to : Z + (zAnim.to - Z) * Math.min(1, dt * (RM ? 60 : 11));
      zoomAround(nz, zAnim.sx, zAnim.sy);
      if (nz === zAnim.to) { zAnim = null; if (opts.onZoom) opts.onZoom(Z); if (!down && !pinch) snap(); } else more = true;
    }
    if (phase === "spring") {
      const s = spring, tau = (t - s.t0) / 1000, e = Math.exp(-s.w * tau);
      let off = 0;
      for (let k = 0; k < 2; k++) { const q = (s.A[k] + s.B[k] * tau) * e; P[k] = s.X[k] + q; off = Math.max(off, Math.abs(q)); }
      if (off < .002 && tau > .05) { P = s.X.slice(); phase = "idle"; spring = null; draw(t); settle(); } else more = true;
    } else if (phase === "drift") { if (!lay.finite) P[0] += DRIFT * dt; more = true; }
    const pt = pressed ? 1 : 0;
    if (Math.abs(pressK - pt) > .01) { pressK += (pt - pressK) * Math.min(1, dt * 18); more = true; } else pressK = pt;
    if (bloom < 1) { bloom = Math.min(1, (t - bloomT0) / 700); more = true; }
    if (ghost) more = true;
    draw(t);
    if (more) kick();
  }
  const remember = () => { if (lay) HONEY_PAN = { key: lay.key, x: P[0], y: P[1], z: Z, name: center && center.n }; };
  function settle() {
    if (center && settled && center !== settled) buzz(4);
    settled = center; remember();
  }
  // critically damped spring from the current pan and velocity to the bubble nearest where the throw would land.
  // With the projection at v/w the motion is a plain exponential glide that ends exactly on a bubble.
  function snap(V = [0, 0]) {
    if (!lay) return;
    const sp = Math.hypot(V[0], V[1]), w = RM ? 30 : sp < 1.5 ? 9 : 2.7;
    const n = nearestTo([P[0] + V[0] / w, P[1] + V[1] / w]); if (!n) return;
    const X = [n.x, n.y], A = [P[0] - X[0], P[1] - X[1]];
    spring = { t0: performance.now(), X, A, B: [V[0] + w * A[0], V[1] + w * A[1]], w };
    phase = "spring"; kick();
  }
  // zoom to z keeping the world point under screen point (sx, sy) where it is
  function zoomAround(z, sx, sy) {
    const l0 = lens(0), o0 = offAt(sx, sy, l0); Z = z;
    const o1 = offAt(sx, sy, lens(0));
    P = [P[0] + o0[0] - o1[0], P[1] + o0[1] - o1[1]];
  }
  const zoomTo = (to, sx = W / 2, sy = Hh / 2) => { phase = phase === "drift" ? "idle" : phase; spring = null; zAnim = { to: clamp(to, ZMIN, ZMAX), sx, sy }; kick(); };
  const rubber = z => z > ZMAX ? ZMAX * Math.pow(z / ZMAX, .3) : z < ZMIN ? ZMIN * Math.pow(z / ZMIN, .3) : z;

  // ---- input: drag with momentum, pinch or ctrl-wheel to zoom, double-tap to zoom in (again to reset) ----
  let down = null, pinch = null, lastTap = null, tapTimer = 0;
  const ptrs = new Map();
  const hit = (x, y) => { let best = null, bd = Infinity; for (const b of drawn) { const d = Math.hypot(b.x - x, b.y - y); if (d < b.d / 2 + 4 && d / b.d < bd) { bd = d / b.d; best = b; } } return best; };
  const local = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  cv.addEventListener("pointerdown", e => {
    if (!lay) return;
    const [x, y] = local(e); ptrs.set(e.pointerId, [x, y]);
    try { cv.setPointerCapture(e.pointerId); } catch (er) {}
    if (phase === "spring" || zAnim) loop(performance.now());
    phase = "drag"; spring = null; zAnim = null; touched = true;
    if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()], mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], o = offAt(mid[0], mid[1], lens(0));
      pinch = { d0: Math.max(10, Math.hypot(a[0] - b[0], a[1] - b[1])), Z0: Z, W0: [P[0] + o[0], P[1] + o[1]], t0: performance.now(), moved: false };
      pressed = null; down = null; clearTimeout(tapTimer); kick(); return;
    }
    if (ptrs.size > 2 || pinch) return;
    const b = hit(x, y);
    pressed = b ? { it: b.it, x: b.x, y: b.y, b } : null;
    down = { x, y, P0: P.slice(), moved: false, hist: [[performance.now(), P[0], P[1]]] };
    kick();
  });
  cv.addEventListener("pointermove", e => {
    if (!ptrs.has(e.pointerId)) return;
    const [x, y] = local(e); ptrs.set(e.pointerId, [x, y]);
    if (pinch && ptrs.size >= 2) {
      const [a, b] = [...ptrs.values()], mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (Math.abs(d - pinch.d0) > 8) pinch.moved = true;
      Z = rubber(pinch.Z0 * d / pinch.d0);
      const o = offAt(mid[0], mid[1], lens(0)); P = [pinch.W0[0] - o[0], pinch.W0[1] - o[1]];
      draw(); return;
    }
    if (!down) return;
    const dx = x - down.x, dy = y - down.y;
    if (!down.moved && Math.hypot(dx, dy) > 7) { down.moved = true; pressed = null; kick(); }
    if (!down.moved) return;
    const k = base * lens(0).s * LENS.m0, now = performance.now();
    P = [down.P0[0] - dx / k, down.P0[1] - dy / k];
    if (lay.finite) {   // rubber band past the edge of a small cluster
      const r = Math.hypot(P[0], P[1]), ext = lay.ext + .6;
      if (r > ext) { const s = (ext + (r - ext) * .35) / r; P = [P[0] * s, P[1] * s]; }
    }
    down.hist.push([now, P[0], P[1]]); while (down.hist.length > 2 && now - down.hist[0][0] > 100) down.hist.shift();
    draw();
  });
  const up = e => {
    if (!ptrs.has(e.pointerId)) return;
    const at = ptrs.get(e.pointerId); ptrs.delete(e.pointerId);
    if (pinch) {
      if (ptrs.size) return;   // wait for the last finger
      const p = pinch; pinch = null; phase = "idle";
      if (!p.moved && performance.now() - p.t0 < 260) return zoomTo(1);   // two-finger tap: reset
      if (Z < ZMIN || Z > ZMAX) return zoomTo(clamp(Z, ZMIN, ZMAX), at[0], at[1]);
      if (opts.onZoom) opts.onZoom(Z);
      return snap();
    }
    if (!down) return;
    const d = down; down = null; phase = "idle";
    if (!d.moved) {
      const now = performance.now(), p = pressed, held = now - d.hist[0][0];
      // a long, still press peeks instead of opening (js/home.js wires onPeek on the honeycomb home)
      if (p && opts.onPeek && held >= 480) { pressed = null; kick(); return opts.onPeek(p.it.o); }
      if (lastTap && now - lastTap.t < 300 && Math.hypot(d.x - lastTap.x, d.y - lastTap.y) < 36) {   // double tap
        clearTimeout(tapTimer); lastTap = null; pressed = null; kick();
        return zoomTo(Z > 1.25 ? 1 : 2.1, d.x, d.y);
      }
      lastTap = { t: now, x: d.x, y: d.y };
      if (p && e.type === "pointerup") { tapTimer = setTimeout(() => { pressed = null; kick(); open(p.it, p.b); }, 240); return; }
      pressed = null; kick();
      return snap();
    }
    const h = d.hist, a = h[0], b = h[h.length - 1], dt = (b[0] - a[0]) / 1000;
    let V = performance.now() - b[0] > 70 || dt < .008 ? [0, 0] : [(b[1] - a[1]) / dt, (b[2] - a[2]) / dt];
    const sp = Math.hypot(V[0], V[1]); if (sp > 40) V = [V[0] * 40 / sp, V[1] * 40 / sp];   // a hard flick still lands nearby
    snap(V);
  };
  cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
  // desktop: trackpad pinch (ctrl + wheel) zooms; a sideways two-finger swipe pans
  let wheelT = 0;
  cv.addEventListener("wheel", e => {
    if (!lay) return;
    const [x, y] = local(e);
    if (e.ctrlKey) { e.preventDefault(); touched = true; phase = "idle"; spring = null; zAnim = null; zoomAround(rubber(clamp(Z * Math.exp(-e.deltaY * .012), ZMIN * .8, ZMAX * 1.2)), x, y); }
    else if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) { e.preventDefault(); touched = true; phase = "idle"; spring = null; const k = base * lens(0).s * LENS.m0; P = [P[0] + e.deltaX / k, P[1] + e.deltaY / k]; }
    else return;
    draw(); clearTimeout(wheelT);
    wheelT = setTimeout(() => { if (Z < ZMIN || Z > ZMAX) zoomTo(clamp(Z, ZMIN, ZMAX), x, y); else { if (opts.onZoom) opts.onZoom(Z); snap(); } }, 160);
  }, { passive: false });
  cap.onclick = () => { if (center) open(center, drawn.find(b => b.it === center)); };

  function open(it, b) {
    remember();
    const morph = () => {
      if (!b) return;
      const m = document.createElement("div"), r = b.d * 1.06;
      m.className = "hc-morph"; Object.assign(m.style, { left: b.x - r / 2 + "px", top: b.y - r / 2 + "px", width: r + "px", height: r + "px", background: it.h });
      cv.parentNode.appendChild(m); morphFrom(m); m.remove();
    };
    if (opts.pick) opts.pick(it.o, { morph });
  }

  // ---- contents ----
  function setItems(raw, focus, how) {
    raw = raw && raw.length ? raw : EVERY().map(c => ({ n: c.n, h: c.h, c }));
    if (how === "soft" && W && !RM) {   // cross-fade from what was on screen
      ghost = ghost || document.createElement("canvas"); ghost.on = true;
      if (ghost.width !== cv.width || ghost.height !== cv.height) { ghost.width = cv.width; ghost.height = cv.height; }
      const g = ghost.getContext("2d"); g.clearRect(0, 0, ghost.width, ghost.height); g.drawImage(cv, 0, 0); ghostT0 = performance.now();
    }
    lay = honeyLayout(raw, layout);
    ZMIN = zFloor(); Z = clamp(Z, ZMIN, ZMAX);
    if (how === "restore" && HONEY_PAN && HONEY_PAN.key === lay.key) { P = [HONEY_PAN.x, HONEY_PAN.y]; if (!opts.zoom && HONEY_PAN.z) Z = HONEY_PAN.z; }
    else {
      // center the focus color, or its nearest look-alike in this set
      const f = focus && (focus.h ? focus : BYNAME.get(String(focus.n || "").toLowerCase()));
      let p = f && lay.pts.find(q => q.it.n === f.n);
      if (!p && f && f.h) { const L = lab(f.h); let bd = Infinity; for (const q of lay.pts) { const dd = (q.it.lab[0] - L[0]) ** 2 + (q.it.lab[1] - L[1]) ** 2 + (q.it.lab[2] - L[2]) ** 2; if (dd < bd) { bd = dd; p = q; } } }
      if (lay.finite && how !== "soft") p = null;   // a small cluster opens centered
      if (!p && lay.finite) p = lay.pts.reduce((m, q) => Math.hypot(q.x, q.y) < Math.hypot(m.x, m.y) ? q : m, lay.pts[0]);
      p = p || lay.pts[0];
      P = [p.x, p.y];
    }
    center = null; draw(); settled = center;
    phase = touched ? "idle" : "drift"; spring = null;
    if (how !== "soft" && !RM && !SHOOT) { bloom = 0; bloomT0 = performance.now(); }
    kick();
  }

  // ---- size, visibility, teardown ----
  function resize() {
    const r = cv.getBoundingClientRect(); dpr = Math.min(3, devicePixelRatio || 1);
    W = r.width; Hh = r.height; cv.width = Math.round(W * dpr); cv.height = Math.round(Hh * dpr);
    base = clamp(W / 13, 26, 34); ghost = null; ZMIN = zFloor(); Z = clamp(Z, ZMIN, ZMAX); draw();
  }
  const ro = new ResizeObserver(resize); ro.observe(cv);
  const io = "IntersectionObserver" in window ? new IntersectionObserver(es => { visible = es[0].isIntersecting && !document.hidden; if (visible) kick(); }) : null;
  if (io) io.observe(host);
  const vis = () => { visible = !document.hidden; if (visible) kick(); };
  document.addEventListener("visibilitychange", vis);
  if (document.fonts && document.fonts.load) Promise.all([document.fonts.load('16px "Instrument Serif"'), document.fonts.load('500 12px "Geist Mono"')]).then(() => { HONEY_WRAP.clear(); draw(); }).catch(() => {});
  function destroy() {
    if (dead) return;
    remember(); dead = true; clearTimeout(tapTimer); clearTimeout(wheelT);
    cancelAnimationFrame(raf); raf = 0; ro.disconnect(); if (io) io.disconnect();
    document.removeEventListener("visibilitychange", vis);
  }
  cleanup.push(destroy);
  // screenshot and benchmark hooks (js/boot.js screenshot mode)
  host.addEventListener("honeyshot", e => {
    const act = e.detail, b = center && drawn.find(x => x.it === center);
    if (act === "tap" && center) open(center, b);
    if (act === "press" && b) { phase = "idle"; pressed = { it: center, x: b.x, y: b.y, b }; pressK = 1; draw(); }
    if (act === "zoomin") { Z = 2.3; draw(); }
    if (/^bench/.test(act)) {
      phase = "idle"; bloom = 1; if (act === "benchout") Z = .4;
      const t0 = performance.now(), n = 240; for (let i = 0; i < n; i++) { P[0] += .037; P[1] += .021; draw(); }
      document.title = `bench ${((performance.now() - t0) / n).toFixed(2)}ms/frame, zoom ${Z}, ${drawn.length} drawn of ${lay.pts.length}`;
      fetch("bench?" + encodeURIComponent(document.title)).catch(() => {});   // shows up in the dev server's log
    }
  });
  resize();
  setItems(opts.items, opts.focus || (HONEY_PAN && { n: HONEY_PAN.name }), "restore");
  return {
    // items: a new list (soft: true cross-fades and keeps the bubble in the middle), layout: "map" | "wheel"
    update(o = {}) { if (o.layout) layout = o.layout === "wheel" ? "wheel" : "map"; setItems(o.items || (lay && lay.raw), o.focus || (center && center.o), o.soft ? "soft" : ""); },
    zoom: (z, animate = true) => animate ? zoomTo(z) : (Z = clamp(z, ZMIN, ZMAX), draw()),
    current: () => center && center.o,
    destroy,
  };
}
