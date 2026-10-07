"use strict";
// Match engine (Train tab, "Applied" shelves): one exercise format with interchangeable controls and references.
//   reference -> your live version -> match it -> Lock -> score + a split view (yours | target) + ONE tip -> Next.
// Controls: a slider, Resolve-style lift/gamma/gain wheels, a curve editor, a Kelvin/tint pair.
// The model (grades, scoring, tips, scenes, paint mixing) lives in js/match-model.js as pure functions.
// Two starter sets: Colorist (cast, shot matching, Kelvin eye) and Atelier (value, big masses, Zorn palette).
// API for gym.js: matchStations() -> station descriptors; openMatch(id) runs one station.
// Learning-kb: feedback names ONE specific fix (§1 #6); each station isolates one sub-skill at the edge of
// your level (§1 #7); difficulty fades in with level (§1 #4). Practice sharpens these judgments; no wider claim.

const MT_SETS = { colorist: "Colorist", atelier: "Atelier" };
// start = the level-1 score, top = the level-20 score (as in gym.js SKILLS).
const MATCH = {
  cast: { set: "colorist", name: "Kill the cast", what: "Neutralize a color cast with one wheel", unit: "ΔE", start: 12, top: 1.2, trials: 3,
    why: "A cast is one color laid over everything. Neutral things (a grey card, a white wall, clouds) show it first, so check them before skin or sky." },
  shot: { set: "colorist", name: "Shot matching", what: "Grade shot B to match shot A", unit: "ΔE", start: 12, top: 1.5, trials: 3,
    why: "Lift moves the shadows most, gamma the midtones, gain the highlights. Match the zone with the biggest error first." },
  kelvin: { set: "colorist", name: "Kelvin eye", what: "Name the color temperature of the light", unit: "mired", start: 70, top: 6, trials: 4,
    why: "A mired is a million divided by the kelvin number. Equal mired steps look about equally different: 2700 to 3000 K is a bigger shift than 6500 to 7500 K." },
  value: { set: "atelier", name: "Value scale", what: "Set the missing steps of a grey scale", unit: "ΔL*", start: 12, top: 1.2, trials: 3,
    why: "Value (light and dark) carries a picture: a painting that reads in black and white usually reads in color." },
  masses: { set: "atelier", name: "Big masses", what: "Pick the color of each big shape", unit: "ΔE", start: 10, top: 1.5, trials: 3,
    why: "Carolus-Duran, who taught John Singer Sargent, is said to have had his students lay in the big masses of color before any detail." },
  zorn: { set: "atelier", name: "Zorn palette", what: "Mix the target from four paints", unit: "ΔE", start: 15, top: 2, trials: 3,
    why: "The four-paint palette is named after the Swedish painter Anders Zorn, who is often said to have worked with just these; his actual palettes varied." },
};
const mtFmt = d => d >= 10 ? d.toFixed(0) : d.toFixed(1);
const mtState = id => { S.match = S.match || {}; return S.match[id] || (S.match[id] = { hist: [], best: null }); };
const mtLast = id => { const h = mtState(id).hist; return h.length ? h[h.length - 1][1] : null; };
const mtLevel = id => mtLevelOf(MATCH[id], mtLast(id));
const mtPaintings = () => (window.PAINTINGS || []).filter(p => p.img && p.map && p.palette && p.palette.length);
const mtPick = (a, rnd = Math.random) => a[rnd() * a.length | 0];
const mtEl = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

// ---------- images ----------
const MT_CACHE = new Map();
// A local image as ImageData, scaled to fit maxW x maxH (same-origin, so the pixels are readable).
function mtLoad(src, maxW = 360, maxH = 420) {
  const k = `${src}|${maxW}|${maxH}`;
  if (!MT_CACHE.has(k)) MT_CACHE.set(k, new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => {
      const s = Math.min(1, maxW / im.naturalWidth, maxH / im.naturalHeight), w = Math.round(im.naturalWidth * s), h = Math.round(im.naturalHeight * s);
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      const g = c.getContext("2d", { willReadFrequently: true }); g.imageSmoothingQuality = "high"; g.drawImage(im, 0, 0, w, h);
      try { res(g.getImageData(0, 0, w, h)); } catch (e) { rej(e); }
    };
    im.onerror = rej; im.src = src;
  }));
  return MT_CACHE.get(k);
}
// A palette map (grey PNG, value = index x 40) as class indices at its own size.
async function mtLoadMap(src) {
  const img = await mtLoad(src, 4000, 4000), n = img.width * img.height, m = new Uint8Array(n);
  for (let i = 0; i < n; i++) m[i] = Math.round(img.data[i * 4] / 40);
  return { w: img.width, h: img.height, m };
}
function mtCanvas(img) {
  const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
  if (img.data) c.getContext("2d").putImageData(img, 0, 0);
  return c;
}
const mtPut = (cv, img) => cv.getContext("2d").putImageData(img, 0, 0);

// ---------- figures: a neutral mat around each image, sized to fit (sight-size) ----------
function mtFitBox(mat, box, ar) {
  const fit = () => {
    const r = mat.getBoundingClientRect(), pw = r.width - 16, ph = r.height - 16; if (pw <= 0 || ph <= 0) return;
    const w = Math.min(pw, ph * ar); box.style.width = w + "px"; box.style.height = w / ar + "px";
  };
  const ro = new ResizeObserver(fit); ro.observe(mat); cleanup.push(() => ro.disconnect());
  requestAnimationFrame(fit);
}
function mtFig(inner, label, ar) {
  const f = mtEl("figure", "mt-fig"), mat = mtEl("div", "mt-mat"), box = mtEl("div", "mt-ar");
  box.append(inner); if (label) box.append(mtEl("figcaption", "", esc(label)));
  mat.append(box); f.append(mat); mtFitBox(mat, box, ar || 1);
  return f;
}
// Reveal: yours on the left, the target on the right; drag the seam to compare.
function mtSplit(a, b, ar, labels = ["Yours", "Target"]) {
  const wrap = mtEl("div", "mt-split"), seam = mtEl("i", "mt-seam");
  a.classList.add("mt-sa"); b.classList.add("mt-sb");
  wrap.append(a, b, seam, mtEl("span", "mt-lab l", esc(labels[0])), mtEl("span", "mt-lab r", esc(labels[1])));
  const set = p => { p = clamp(p, 0, 1); b.style.clipPath = `inset(0 0 0 ${p * 100}%)`; seam.style.left = p * 100 + "%"; };
  set(.5);
  wrap.addEventListener("pointerdown", e => {
    try { wrap.setPointerCapture(e.pointerId); } catch (_) {}
    const mv = ev => { const r = wrap.getBoundingClientRect(); set((ev.clientX - r.left) / r.width); };
    mv(e); wrap.onpointermove = mv; wrap.onpointerup = wrap.onpointercancel = () => { wrap.onpointermove = null; };
  });
  return mtFig(wrap, null, ar);
}

// ======================================================================
// Controls. Each is { mount(host, st, changed) -> { sync(), disable() } }; they read and write `st`.
// ======================================================================
// A slider. o: { key, label (html), min, max, fmt, toPos/fromPos (custom scale), marks: [[value, label]], track (css), cls }
function mtSlider(o) {
  return { mount(host, st, changed) {
    const toPos = o.toPos || (v => (v - o.min) / (o.max - o.min)), fromPos = o.fromPos || (p => o.min + p * (o.max - o.min));
    const el = mtEl("div", "mt-sl" + (o.cls ? " " + o.cls : ""), `<div class="mt-sl-top"><span>${o.label}</span>${o.fmt ? '<b class="mono"></b>' : ""}</div>
      <input type="range" min="0" max="1000" step="1" aria-label="${esc(o.aria || o.key)}">
      ${o.marks ? `<div class="mt-marks">${o.marks.map(([v, l], i) => `<i style="left:${(toPos(v) * 100).toFixed(2)}%"${i % 2 ? ' class="lo"' : ""}><b>${esc(l)}</b></i>`).join("")}</div>` : ""}`);
    const inp = el.querySelector("input"), out = el.querySelector(".mt-sl-top b");
    if (o.track) el.style.setProperty("--track", o.track);
    const show = () => { if (out) out.textContent = o.fmt(st[o.key]); };
    const sync = () => { inp.value = Math.round(clamp(toPos(st[o.key]), 0, 1) * 1000); show(); };
    inp.addEventListener("input", () => { st[o.key] = fromPos(inp.value / 1000); show(); changed(); });
    host.append(el); sync();
    return { sync, disable: () => { inp.disabled = true; } };
  } };
}
// Kelvin as a slider that moves evenly in mireds (so equal moves look about equally different).
const mtKelvinSlider = (key, lo = 2000, hi = 8000, o = {}) => mtSlider({
  key, label: o.label || "Color temperature", aria: "Kelvin", fmt: K => `${Math.round(K / 50) * 50} K`, cls: "mt-k",
  toPos: K => (1e6 / lo - 1e6 / K) / (1e6 / lo - 1e6 / hi), fromPos: p => 1e6 / (1e6 / lo - p * (1e6 / lo - 1e6 / hi)),
  marks: o.marks === false ? null : [[2700, "2700"], [4000, "4000"], [5600, "5600"], [6500, "6500"]], track: o.track,
});
const mtTintSlider = (key, o = {}) => mtSlider({ key, label: o.label || "Tint", aria: "Tint", min: -12, max: 12, track: o.track, cls: "mt-t",
  fmt: t => Math.abs(t) < .5 ? "0" : `${t > 0 ? "M" : "G"} ${Math.abs(t).toFixed(0)}` });

// Resolve-style color wheels: each a color-balance puck (drag; a double tap re-centers it) over a brightness slider.
const MT_WNAME = { lift: "Lift", gamma: "Gamma", gain: "Gain" };
function mtWheels(o) {
  return { mount(host, st, changed) {
    const G = st[o.key] = st[o.key] || {};
    o.which.forEach(w => { G[w] = G[w] || mtWheel0(); });
    let off = false;
    const row = mtEl("div", `mt-wheels n${o.which.length}`);
    const parts = o.which.map(w => {
      const el = mtEl("div", "mt-wh", `<div class="mt-disc"><canvas width="176" height="176"></canvas><i class="mt-cross"></i><i class="mt-puck"></i></div>
        <input type="range" min="-1000" max="1000" step="1" value="0" aria-label="${MT_WNAME[w]} brightness"><span class="mt-wh-name">${MT_WNAME[w]}</span>`);
      const cv = el.querySelector("canvas"), g = cv.getContext("2d"), im = g.createImageData(176, 176);
      for (let y = 0; y < 176; y++) for (let x = 0; x < 176; x++) {
        const u = (x - 87.5) / 86, v = -(y - 87.5) / 86, r = Math.hypot(u, v), i = (y * 176 + x) * 4;
        if (r > 1) continue;
        const c = mtWheelRGB(u, v, .3), shade = .55 + .45 * Math.min(1, (1 - r) * 8);
        im.data[i] = c[0] * 255 * shade; im.data[i + 1] = c[1] * 255 * shade; im.data[i + 2] = c[2] * 255 * shade; im.data[i + 3] = 255 * Math.min(1, (1 - r) * 60);
      }
      g.putImageData(im, 0, 0);
      const disc = el.querySelector(".mt-disc"), puck = el.querySelector(".mt-puck"), inp = el.querySelector("input");
      const place = () => { const s = G[w]; puck.style.left = 50 + s.x * 44 + "%"; puck.style.top = 50 - s.y * 44 + "%"; inp.value = Math.round(s.m * 1000); };
      let last = null, tap = 0;
      disc.addEventListener("pointerdown", e => {
        if (off) return; e.preventDefault(); try { disc.setPointerCapture(e.pointerId); } catch (_) {} last = [e.clientX, e.clientY];
        const now = performance.now(); if (now - tap < 320) { G[w].x = 0; G[w].y = 0; place(); changed(); buzz(6); } tap = now;
      });
      disc.addEventListener("pointermove", e => {
        if (!last || off) return;
        const R = disc.clientWidth / 2, s = G[w];
        s.x += (e.clientX - last[0]) / R * .5; s.y -= (e.clientY - last[1]) / R * .5;   // relative and geared down, for fine moves
        const r = Math.hypot(s.x, s.y); if (r > 1) { s.x /= r; s.y /= r; }
        last = [e.clientX, e.clientY]; place(); changed();
      });
      const up = () => { last = null; }; disc.addEventListener("pointerup", up); disc.addEventListener("pointercancel", up);
      inp.addEventListener("input", () => { G[w].m = inp.value / 1000; changed(); });
      inp.addEventListener("dblclick", () => { G[w].m = 0; place(); changed(); });
      place(); row.append(el);
      return { place, inp };
    });
    host.append(row);
    return { sync: () => parts.forEach(p => p.place()), disable: () => { off = true; parts.forEach(p => { p.inp.disabled = true; }); } };
  } };
}

// Curve editor: RGB master plus R, G, B. Tap to add a point (up to 5), drag to move, double-tap a point to remove it.
// The curve is a monotone cubic through the points (no overshoot), baked into a 256-entry table.
const MT_CCOL = { m: "#ECE8DF", r: "#E5806F", g: "#8FCB8F", b: "#86A8EA" };
function mtCurves(o) {
  return { mount(host, st, changed) {
    const C = st[o.key] = st[o.key] || mtCurves0();
    let ch = "m", off = false, drag = null, tap = { t: 0, p: null };
    const el = mtEl("div", "mt-curves", `<div class="mt-chips">${["m", "r", "g", "b"].map(k => `<button data-ch="${k}" class="${k === ch ? "on" : ""}" style="--cc:${MT_CCOL[k]}">${k === "m" ? "RGB" : k.toUpperCase()}</button>`).join("")}</div><canvas></canvas>`);
    const cv = el.querySelector("canvas"), g = cv.getContext("2d");
    const geo = () => { const r = cv.getBoundingClientRect(); return { w: r.width, h: r.height, p: 10, r }; };
    const toPx = ([x, y], G) => [G.p + x * (G.w - 2 * G.p), G.h - G.p - y * (G.h - 2 * G.p)];
    const fromPx = (px, py, G) => [clamp((px - G.p) / (G.w - 2 * G.p), 0, 1), clamp((G.h - G.p - py) / (G.h - 2 * G.p), 0, 1)];
    function draw() {
      const G = geo(), dpr = devicePixelRatio || 1; if (!G.w) return;
      cv.width = G.w * dpr; cv.height = G.h * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, G.w, G.h);
      g.strokeStyle = "rgba(236,232,223,.12)"; g.lineWidth = 1;
      for (let i = 0; i <= 4; i++) { const [x] = toPx([i / 4, 0], G), [, y] = toPx([0, i / 4], G); g.beginPath(); g.moveTo(x, G.p); g.lineTo(x, G.h - G.p); g.moveTo(G.p, y); g.lineTo(G.w - G.p, y); g.stroke(); }
      const curve = (k, a, wd) => { const f = mtSpline(C[k]); g.strokeStyle = MT_CCOL[k]; g.globalAlpha = a; g.lineWidth = wd; g.beginPath();
        for (let i = 0; i <= 64; i++) { const [x, y] = toPx([i / 64, clamp(f(i / 64), 0, 1)], G); i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); g.globalAlpha = 1; };
      ["m", "r", "g", "b"].forEach(k => { if (k !== ch && C[k].length > 2 || k !== ch && C[k].some(([x, y]) => Math.abs(x - y) > .001)) curve(k, .35, 1.2); });
      curve(ch, 1, 2);
      C[ch].forEach(pt => { const [x, y] = toPx(pt, G); g.fillStyle = "#0E0D0B"; g.strokeStyle = MT_CCOL[ch]; g.lineWidth = 2; g.beginPath(); g.arc(x, y, 6, 0, 7); g.fill(); g.stroke(); });
    }
    cv.addEventListener("pointerdown", e => {
      if (off) return; e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (_) {}
      const G = geo(), px = e.clientX - G.r.left, py = e.clientY - G.r.top, pts = C[ch];
      let best = -1, bd = 26;
      pts.forEach((p, i) => { const [x, y] = toPx(p, G), d = Math.hypot(x - px, y - py); if (d < bd) { bd = d; best = i; } });
      const now = performance.now();
      if (best > 0 && best < pts.length - 1 && tap.p === best && now - tap.t < 320) { pts.splice(best, 1); draw(); changed(); tap = { t: 0, p: null }; return; }
      if (best < 0) {
        const [x] = fromPx(px, py, G);
        if (pts.length >= 5 || x < .04 || x > .96) return;
        const y = clamp(mtSpline(pts)(x), 0, 1); pts.push([x, y]); pts.sort((a, b) => a[0] - b[0]); best = pts.findIndex(p => p[0] === x);
      }
      tap = { t: now, p: best }; drag = best; draw(); changed();
    });
    cv.addEventListener("pointermove", e => {
      if (drag == null || off) return;
      const G = geo(), pts = C[ch], [x, y] = fromPx(e.clientX - G.r.left, e.clientY - G.r.top, G);
      if (drag === 0 || drag === pts.length - 1) pts[drag] = [pts[drag][0], y];
      else pts[drag] = [clamp(x, pts[drag - 1][0] + .03, pts[drag + 1][0] - .03), y];
      draw(); changed();
    });
    const up = () => { drag = null; }; cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
    el.querySelectorAll("[data-ch]").forEach(b => b.onclick = () => { ch = b.dataset.ch; el.querySelectorAll("[data-ch]").forEach(x => x.classList.toggle("on", x === b)); draw(); });
    host.append(el);
    const ro = new ResizeObserver(draw); ro.observe(cv); cleanup.push(() => ro.disconnect());
    return { sync: draw, disable: () => { off = true; } };
  } };
}
// The four curves as a per-channel function: each channel's own curve, then the master.
function mtCurveFn(C) {
  const L = { m: mtCurveLut(C.m), r: mtCurveLut(C.r), g: mtCurveLut(C.g), b: mtCurveLut(C.b) }, ch = [L.r, L.g, L.b];
  return (c, v) => mtLutAt(L.m, mtLutAt(ch[c], v));
}
// Chips that switch between control panes (both stay live; only one shows). tabs: [[label, control]]
function mtTabs(tabs, o = {}) {
  return { mount(host, st, changed) {
    const el = mtEl("div", "mt-tabs", `<div class="mt-chips">${tabs.map(([l], i) => `<button data-i="${i}" class="${i ? "" : "on"}">${esc(l)}</button>`).join("")}</div>`);
    host.append(el);
    const panes = tabs.map(([, c], i) => { const p = mtEl("div", "mt-pane" + (i ? " off" : "")); el.append(p); return { p, inst: c.mount(p, st, changed) }; });
    const select = i => { el.querySelectorAll("[data-i]").forEach(b => b.classList.toggle("on", +b.dataset.i === i)); panes.forEach((x, j) => x.p.classList.toggle("off", j !== i)); panes[i].inst.sync(); if (o.onSelect) o.onSelect(i); };
    el.querySelectorAll("[data-i]").forEach(b => b.onclick = () => select(+b.dataset.i));
    return { select, sync: () => panes.forEach(x => x.inst.sync()), disable: () => panes.forEach(x => x.inst.disable()) };
  } };
}

// ======================================================================
// The engine
// ======================================================================
// verdict words for a score
function mtVerdict(err, unit) {
  if (unit === "mired") return err < 8 ? "spot on" : err < 20 ? "close" : err < 45 ? "noticeable" : "far off";
  if (unit === "ΔL*") return err < 2 ? "spot on" : err < 5 ? "close" : err < 10 ? "visible" : "far off";
  return err < 1.5 ? "invisible" : err < 3 ? "barely visible" : err < 6 ? "close" : err < 10 ? "visible" : "far off";
}
// One task. ui = { q, sub, view, ctl, foot }. t = { title, sub, ref, yours, view, layout, controls, apply, score, tip, split, ready, demo }.
// ref / yours = { el, label, ar }: the reference (image or swatch layout) and your live version; or t.view = one custom element.
// done(err) is called on Lock and returns the label for the Next button; next() moves on.
function matchTask(t, ui, done, next) {
  const st = t.state || {};
  ui.q.innerHTML = t.title; ui.sub.textContent = t.sub || "";
  ui.view.className = `mt-view ${t.layout || "stack"}`; ui.view.innerHTML = ""; ui.ctl.innerHTML = ""; ui.ctl.className = "mt-ctl";
  if (t.view) ui.view.append(t.view);
  else { if (t.ref) ui.view.append(mtFig(t.ref.el, t.ref.label || "Target", t.ref.ar)); ui.view.append(mtFig(t.yours.el, t.yours.label || "Yours", t.yours.ar)); }
  let raf = 0, locked = false;
  const lockBtn = mtEl("button", "btn", `${esc(t.lockLabel || "Lock it in")} ${ICON.arrow}`);
  const refresh = () => { if (t.ready) lockBtn.disabled = !t.ready(st); };
  const paint = () => { raf = 0; t.apply(st); refresh(); };
  const changed = () => { if (!raf && !locked) raf = requestAnimationFrame(paint); };
  const inst = (t.controls || []).map(c => c.mount(ui.ctl, st, changed));
  paint();
  ui.foot.innerHTML = ""; ui.foot.append(lockBtn);
  lockBtn.onclick = () => {
    if (locked || lockBtn.disabled) return; locked = true;
    cancelAnimationFrame(raf); t.apply(st); inst.forEach(c => c.disable());
    const sc = t.score(st), tip = t.tip(st, sc), unit = sc.unit || "ΔE";
    ui.view.className = "mt-view solo rev"; ui.view.innerHTML = ""; ui.view.append(t.split(st, sc));
    ui.ctl.className = "mt-ctl rev";
    ui.ctl.innerHTML = `<div class="mt-score"><b>${mtFmt(sc.err)}</b><span>${esc(unit)}<em>${esc(sc.verdict || mtVerdict(sc.err, unit))}</em></span>${sc.side ? `<small>${sc.side}</small>` : ""}</div>
      <p class="mt-tip">${esc(tip)}</p>${sc.note ? `<p class="mt-note">${sc.note}</p>` : ""}`;
    const label = done(sc.err);
    ui.foot.innerHTML = ""; const nb = mtEl("button", "btn", `${esc(label)} ${ICON.arrow}`); nb.onclick = next; ui.foot.append(nb);
  };
  return { st, inst, lock: () => lockBtn.onclick(), changed, sync: () => { inst.forEach(c => c.sync()); changed(); } };
}

// A station: a top bar with progress, then its rounds, then results.
function openMatch(id, opts = {}) {
  if (id === "list") return mtShelfDemo();
  const def = MATCH[id]; if (!def) return go("gym");
  if (opts.shot === "done") return mtDone({ id, est: def.top * 3, before: def.top * 5, pb: true, best: def.top * 3 });   // screenshot hook: results screen
  const forced = /lv(\d+)/.exec(opts.shot || "");   // screenshot hook: match:<id>:lv12 previews a level
  const lv = forced ? clamp(+forced[1], 1, 20) : Math.max(1, mtLevel(id)), f = (lv - 1) / 19, total = opts.trials || def.trials, errs = [];
  let n = 0, cur = null;
  const el = show(`
    <header class="deck-top">
      <button class="icon-btn" data-close aria-label="Close">${ICON.x}</button>
      <div class="segs">${Array.from({ length: total }, () => `<i style="--c:var(--ink)"></i>`).join("")}</div>
      <span class="left mono" id="mt-n"></span>
    </header>
    <div class="mt-head"><p class="eyebrow">${esc(def.name)} · Level ${lv}</p><h2 id="mt-q"></h2><p class="mt-sub" id="mt-sub"></p></div>
    <div class="mt-view" id="mt-view"></div>
    <div class="mt-ctl" id="mt-ctl"></div>
    <div class="mt-foot" id="mt-foot"></div>
  `, `fixed match mtx-${id}`);
  el.querySelector("[data-close]").onclick = () => go("gym");
  onKey = e => { if (e.key === "Escape") go("gym"); };
  const ui = { q: el.querySelector("#mt-q"), sub: el.querySelector("#mt-sub"), view: el.querySelector("#mt-view"), ctl: el.querySelector("#mt-ctl"), foot: el.querySelector("#mt-foot") };
  const segs = el.querySelectorAll(".segs i"), counter = el.querySelector("#mt-n");
  const done = err => {
    errs.push(err); const ok = err <= (def.unit === "mired" ? 15 : def.unit === "ΔL*" ? 3 : 3.5);
    segs[n].classList.add("on"); segs[n].style.setProperty("--c", ok ? "var(--good)" : "var(--bad)"); buzz(ok ? 10 : [10, 40, 10]);
    n++; return n >= total ? "See results" : "Next";
  };
  async function round() {
    if (n >= total) return mtDone(mtRecord(id, errs));
    counter.textContent = `${n + 1}/${total}`;
    ui.q.textContent = ""; ui.sub.textContent = ""; ui.view.innerHTML = '<p class="mt-wait mono">Preparing…</p>'; ui.ctl.innerHTML = ""; ui.foot.innerHTML = "";
    const t = await MT_MAKE[id]({ lv, f, n, total, shot: opts.shot || "" });
    if (!app.contains(el)) return;
    cur = matchTask(t, ui, done, round);
    if (opts.shot && t.demo && !/nodemo/.test(opts.shot)) { t.demo(cur.st, cur); cur.sync(); }
    if (/reveal/.test(opts.shot || "")) setTimeout(() => cur.lock(), 450);
  }
  round();
}
function mtRecord(id, errs) {
  const st = mtState(id), est = mtSetScore(errs), before = mtLast(id);
  st.hist.push([today(), +est.toFixed(2)]); st.hist = st.hist.slice(-60);
  const pb = st.best == null || est < st.best; if (pb) st.best = +est.toFixed(2);
  save();
  return { id, est, before, pb, best: st.best };
}
// Results for one set: level before and after, personal best, and the station's one-line lesson.
function mtDone(r) {
  const def = MATCH[r.id], lvA = mtLevelOf(def, r.est), lvB = r.before != null ? mtLevelOf(def, r.before) : null;
  const head = r.pb && r.before != null ? "New personal <em>best.</em>" : lvB != null && lvA > lvB ? "Level <em>up.</em>" : r.before == null ? "First <em>set.</em>" : "Set <em>done.</em>";
  const el = show(`
    <div style="flex:1"></div>
    <p class="eyebrow">${esc(def.name)} · ${MT_SETS[def.set]}</p>
    <h1>${head}</h1>
    <div class="gr-lv"><span class="mono">Level</span>${lvB != null ? `<s>${lvB}</s><i>→</i>` : ""}<b data-count="${lvA}">${lvA}</b><span class="mono">of 20</span></div>
    ${ladder(lvA, "big")}
    <div class="res-list">
      <div class="res"><span>This set</span><b class="mono">${r.before != null ? mtFmt(r.before) + " → " : ""}${mtFmt(r.est)} <small>${esc(def.unit)}</small></b>${r.pb ? "<em>best</em>" : ""}</div>
      <div class="res"><span>Personal best</span><b class="mono">${r.best != null ? mtFmt(r.best) : "—"} <small>${esc(def.unit)}</small></b><span></span></div>
    </div>
    <p class="lede">${esc(def.why)}</p>
    <p class="fine gr-fine">Smaller numbers mean closer matches. Scenes and paint mixing are simplified models. Practice sharpens this judgment; it isn't a brain-training claim.</p>
    <div class="stack"><button class="btn" data-again>Another set ${ICON.arrow}</button><button class="btn ghost" data-home>Back to Train</button></div>
  `, "result gym-res");
  el.querySelector("[data-again]").onclick = () => openMatch(r.id);
  el.querySelector("[data-home]").onclick = () => go("gym");
  onKey = e => { if (e.key === "Enter") go("gym"); };
  if (r.pb || (lvB != null && lvA > lvB)) buzz([12, 60, 12]);
}

// ---------- image-grade helpers shared by the colorist stations ----------
// An image task whose "yours" is src pushed through fn(st) (a per-channel function, baked to tables each change).
function mtImageView(src, fnOf) {
  const cv = mtCanvas(src), buf = mtImg(src.width, src.height);
  return { cv, buf, apply: st => { mtApplyLuts(src, mtLuts(fnOf(st)), buf); mtPut(cv, buf); } };
}
// Zone errors as one "whole image" zone (for single-control tasks)
const mtWhole = zs => { const n = zs.reduce((s, z) => s + z.n, 0) || 1, w = k => zs.reduce((s, z) => s + z[k] * z.n, 0) / n; return [{ name: "image", n, dL: w("dL"), da: w("da"), db: w("db"), de: w("de") }]; };

// ======================================================================
// Colorist 1: Kill the cast. A known cast (random direction and strength) is laid over an image in linear light;
// you neutralize it with one gain wheel, plus an optional temperature / tint pair.
// ======================================================================
async function mtMakeCast({ lv, f, n }) {
  const rnd = Math.random, P = mtPaintings();
  let src, label;
  if (n % 3 === 1 && P.length) { const p = mtPick(P); src = await mtLoad(p.img, 360, 400); label = `${p.artist}, ${p.title}`; }
  else { const kind = n % 3 === 0 ? "studio" : "sky"; src = mtScene(kind, 360, 260, [1, 1, 1], rnd() * 1e9 | 0); label = kind === "studio" ? "Studio scene: white wall, 18% grey card" : "Sky scene"; }
  const s = mtLerp(.55, .08, f) * (.8 + .4 * rnd()), th = rnd() * 2 * Math.PI;
  let cast = [0, 1, 2].map(c => 2 ** (s * Math.cos(th - MT_PHI[c])));
  const Y = .2126 * cast[0] + .7152 * cast[1] + .0722 * cast[2]; cast = cast.map(x => x / Y);
  const truth = mtLabBuf(src, 2);
  const fnOf = st => { const corr = mtLightGains(st.K, -st.t).map(x => 1 / x), g = { gain: st.grade.gain };
    return (c, v) => mtLinGain(mtGradeCh(g, c, mtLinGain(v, cast[c])), corr[c]); };
  const view = mtImageView(src, fnOf);
  const start = mtWhole(mtZoneErr(truth, mtLabBuf(mtApplyLuts(src, mtLuts(fnOf({ grade: { gain: mtWheel0() }, K: 6504, t: 0 }))), 2)));
  // the Temp track shows what the slider does to the image: left = bluer, right = warmer (as in Lightroom)
  const cool = mtHex(mtLightGains(9000).map(x => .45 * x)), warm = mtHex(mtLightGains(3500).map(x => .45 * x));
  return {
    title: "Kill the <em>cast</em>", sub: label, layout: "solo",
    state: { grade: { gain: mtWheel0() }, K: 6504, t: 0 },
    yours: { el: view.cv, label: "Yours", ar: src.width / src.height },
    controls: [mtWheels({ key: "grade", which: ["gain"] }),
      { mount(host, st, ch) { const box = mtEl("div", "mt-wb"); host.append(box);
        const a = mtKelvinSlider("K", 3000, 12000, { label: "Temp", marks: false, track: `linear-gradient(90deg,${cool},#8A8A8A,${warm})` }).mount(box, st, ch);
        const b = mtTintSlider("t", { track: "linear-gradient(90deg,#5E8A5E,#8A8A8A,#8A5E86)" }).mount(box, st, ch);
        return { sync: () => { a.sync(); b.sync(); }, disable: () => { a.disable(); b.disable(); } }; } }],
    apply: view.apply,
    score: () => { const y = mtLabBuf(view.buf, 2); return { err: mtMeanDE(truth, y), z: mtWhole(mtZoneErr(truth, y)) }; },
    tip: (st, sc) => mtGradeTip(sc.z, start, { whole: true }),
    split: () => mtSplit(mtCanvas(view.buf), mtCanvas(src), src.width / src.height, ["Yours", "Original"]),
    demo: st => { const k = -s / 1.1 * .6; st.grade.gain.x = k * Math.cos(th); st.grade.gain.y = k * Math.sin(th); },
  };
}

// ======================================================================
// Colorist 2: Shot matching. Two crops of one image (or two renders of one scene); B carries a different grade
// (lift / gamma / gain). Match B to A. More wheels come into play as you level up; curves sit behind a chip.
// ======================================================================
async function mtMakeShot({ lv, f, n, shot }) {
  const rnd = Math.random, P = mtPaintings(), which = lv < 6 ? ["gain"] : lv < 12 ? ["gamma", "gain"] : ["lift", "gamma", "gain"];
  let A, B, layout, label;
  if (n === 1 || !P.length) {
    const seed = rnd() * 1e9 | 0, kind = rnd() < .5 ? "studio" : "sky";
    A = mtScene(kind, 360, 230, [1, 1, 1], seed); B = mtScene(kind, 360, 230, [1, 1, 1], seed + 7); layout = "stack"; label = "Two renders of one scene";
  } else {
    const p = mtPick(P), img = await mtLoad(p.img, 360, 420), W = img.width, H = img.height;
    // two overlapping landscape crops, stacked (they share some content, as two angles on one scene do)
    if (W >= H) { const w = Math.round(W * .7), h = Math.round(H * .6), flip = rnd() < .5; A = mtCrop(img, 0, flip ? H - h : 0, w, h); B = mtCrop(img, W - w, flip ? 0 : H - h, w, h); }
    else { const h = Math.round(H * .52); A = mtCrop(img, 0, 0, W, h); B = mtCrop(img, 0, H - h, W, h); }
    layout = "stack";
    label = `Two crops of ${p.artist}, ${p.title}`;
  }
  // the grade on B
  const amt = mtLerp(.75, .3, f), G = {};
  which.forEach(w => { const a = rnd() * 2 * Math.PI, r = amt * (.6 + .4 * rnd()); G[w] = { x: r * Math.cos(a), y: r * Math.sin(a), m: (rnd() - .5) * mtLerp(.5, .2, f) }; });
  const graded = (c, v) => mtGradeCh(G, c, v);
  const truth = mtLabBuf(B, 2);
  const fnOf = st => { const cf = mtCurveFn(st.curves); return (c, v) => cf(c, mtGradeCh(st.grade, c, graded(c, v))); };
  const view = mtImageView(B, fnOf);
  const st0 = { grade: {}, curves: mtCurves0() }; which.forEach(w => { st0.grade[w] = mtWheel0(); });
  const start = mtZoneErr(truth, mtLabBuf(mtApplyLuts(B, mtLuts(fnOf(st0))), 2));
  const ar = B.width / B.height;
  return {
    title: "Match <em>B</em> to A", sub: label, layout,
    state: st0,
    ref: { el: mtCanvas(A), label: "A · reference", ar: A.width / A.height }, yours: { el: view.cv, label: "B · yours", ar },
    controls: [mtTabs([["Wheels", mtWheels({ key: "grade", which })], ["Curves", mtCurves({ key: "curves" })]])],
    apply: view.apply,
    score: () => { const y = mtLabBuf(view.buf, 2); return { err: mtMeanDE(truth, y), z: mtZoneErr(truth, y) }; },
    tip: (st, sc) => mtGradeTip(sc.z, start),
    split: () => mtSplit(mtCanvas(view.buf), mtCanvas(B), ar, ["Yours", "B ungraded"]),
    demo: (st, task) => {
      which.forEach(w => { st.grade[w].x = -G[w].x * .55; st.grade[w].y = -G[w].y * .45; st.grade[w].m = -G[w].m * .5; });
      if (shot === "curves") { st.curves.m = [[0, 0], [.3, .24], [.72, .8], [1, 1]]; st.curves.b = [[0, .04], [.5, .47], [1, .95]]; task.inst[0].select(1); }
    },
  };
}

// ======================================================================
// Colorist 3: Kelvin eye. A rendered room (white wall, grey card, three spheres) lit at a random temperature,
// with the camera fixed at daylight. Name the light. Low levels show your guess live beside it; from level 8 it's blind.
// ======================================================================
async function mtMakeKelvin({ lv, f, n, shot }) {
  const rnd = Math.random, mired = 1e6 / 7500 + rnd() * (1e6 / 2700 - 1e6 / 7500), K = 1e6 / mired;
  const tintOn = lv >= 4, tint = tintOn ? Math.round((rnd() * 2 - 1) * mtLerp(3, 6, f)) : 0, blind = lv >= 8 || /blind/.test(shot);
  const sc = mtSceneLin(n % 2 ? "sky" : "studio", 360, 240, rnd() * 1e9 | 0), ar = 1.5;
  const ref = mtLit(sc, mtLightGains(K, tint)), yb = mtImg(360, 240), ycv = mtCanvas(yb);
  // start at least 60 mireds from the answer
  let gm = mired + (rnd() < .5 ? -1 : 1) * (60 + rnd() * 50); if (gm < 115 || gm > 480) gm = mired + (mired > 250 ? -1 : 1) * (60 + rnd() * 50);
  const ctls = [mtKelvinSlider("K", 2000, 8000)]; if (tintOn) ctls.push(mtTintSlider("t", { label: "Tint of the light", track: "linear-gradient(90deg,#5E8A5E,#8A8A8A,#8A5E86)" }));
  return {
    title: blind ? "What's the <em>light?</em>" : "Match the <em>light</em>",
    sub: blind ? "Blind: name it from the scene alone. Camera fixed at daylight (6500 K)." : "Camera fixed at daylight (6500 K). Dial in the light you see.",
    layout: "stack", state: { K: 1e6 / gm, t: 0 },
    ref: { el: mtCanvas(ref), label: "The scene", ar }, yours: blind ? null : { el: ycv, label: "Your guess", ar },
    view: blind ? mtFig(mtCanvas(ref), "The scene", ar) : null,
    controls: ctls,
    apply: st => { if (!blind) { mtLit(sc, mtLightGains(st.K, st.t), yb); mtPut(ycv, yb); } },
    score: st => { const r = mtKelvinScore({ K: st.K, t: st.t }, { K, t: tint });
      return { err: r.err, unit: "mired", side: `${Math.round(K / 50) * 50} K${tintOn ? `, tint ${tint ? (tint > 0 ? "M " : "G ") + Math.abs(tint) : "0"}` : ""}`,
        note: "A mired is a million divided by kelvin; equal mired steps look about equally different. Rendered with a simplified model: blackbody light, no camera adjustment." }; },
    tip: st => mtKelvinTip({ K: st.K, t: st.t }, { K, t: tint }),
    split: st => mtSplit(mtCanvas(mtLit(sc, mtLightGains(st.K, st.t))), mtCanvas(ref), ar, ["Your guess", "The light"]),
    demo: st => { st.K = 1e6 / (mired + 18); st.t = tint + (tintOn ? 1 : 0); },
  };
}

// ======================================================================
// Atelier 1: Value scale. A grey scale with three steps blanked: set each with a slider. Higher levels squeeze the
// scale (finer steps); from level 6 the last round matches marked spots on a painting in greyscale instead.
// ======================================================================
async function mtMakeValue({ lv, f, n, total, shot }) {
  const rnd = Math.random, P = mtPaintings();
  if (P.length && ((lv >= 6 && n === total - 1) || (lv >= 12 && n === 1) || /painting/.test(shot))) { for (let k = 0; k < 4; k++) { const t = await mtMakeValuePainting(rnd, P); if (t) return t; } }
  const N = 9, span = mtLerp(80, 36, f), mid = 50 + (rnd() - .5) * (90 - span) * .6, Ls = Array.from({ length: N }, (_, i) => mid - span / 2 + span * i / (N - 1));
  const blanks = shuffle([1, 2, 3, 4, 5, 6, 7]).slice(0, 3).sort((a, b) => a - b), keys = blanks.map((_, j) => "v" + j);
  const st = {}; blanks.forEach((b, j) => { const off = (8 + rnd() * 12) * (rnd() < .5 ? -1 : 1); st[keys[j]] = clamp(Ls[b] + off, 2, 98); });
  const view = mtEl("div", "mt-scale", `<div class="mt-steps">${Ls.map((L, i) => `<i data-i="${i}" class="${blanks.includes(i) ? "blank" : ""}" style="--c:${mtLGrey(L)}"></i>`).join("")}</div>
    <div class="mt-nums">${Ls.map((_, i) => `<b class="${blanks.includes(i) ? "on" : ""}">${i + 1}</b>`).join("")}</div>`);
  const cell = i => view.querySelector(`[data-i="${i}"]`);
  return {
    title: `Fill the <em>scale</em>`, sub: `Nine even steps from dark to light. Set steps ${blanks.map(b => b + 1).join(", ")}.`, view, state: st,
    controls: blanks.map((b, j) => mtSlider({ key: keys[j], label: `Step ${b + 1}`, aria: `Step ${b + 1} lightness`, min: 0, max: 100 })),
    apply: s => blanks.forEach((b, j) => cell(b).style.setProperty("--c", mtLGrey(s[keys[j]]))),
    score: s => ({ err: blanks.reduce((a, b, j) => a + Math.abs(s[keys[j]] - Ls[b]), 0) / blanks.length, unit: "ΔL*" }),
    tip: s => mtValueTip(blanks.map((b, j) => ({ label: `Step ${b + 1}`, yours: s[keys[j]], truth: Ls[b] }))),
    split: s => { const v = view.cloneNode(true); v.classList.add("rev");
      blanks.forEach((b, j) => { const c = v.querySelector(`[data-i="${b}"]`); c.style.setProperty("--y", mtLGrey(s[keys[j]])); c.style.setProperty("--c", mtLGrey(Ls[b]));
        c.innerHTML = `<em>${(s[keys[j]] - Ls[b] > 0 ? "+" : "") + Math.round(s[keys[j]] - Ls[b])}</em>`; });
      const w = mtEl("div", "mt-scale-wrap"); w.append(v, mtEl("p", "mt-cap", "Top: yours · bottom: true · error in L*")); return w; },
    demo: s => blanks.forEach((b, j) => { s[keys[j]] = Ls[b] + (j - 1) * 4; }),
  };
}
async function mtMakeValuePainting(rnd, P) {
  const p = mtPick(P), img = await mtLoad(p.img, 360, 380), grey = mtGrey(img), spots = mtFlatSpots(img, 3, rnd);
  if (spots.length < 3) return null;
  const ar = img.width / img.height, keys = spots.map((_, j) => "s" + j), st = {};
  spots.forEach((s, j) => { st[keys[j]] = clamp(s.L + (8 + rnd() * 14) * (rnd() < .5 ? -1 : 1), 2, 98); });
  const pic = mtEl("div", "mt-pic"); pic.append(mtCanvas(grey));
  spots.forEach((s, j) => pic.append(mtEl("b", "mt-ring", `<span>${j + 1}</span>`)));
  [...pic.querySelectorAll(".mt-ring")].forEach((r, j) => { r.style.left = spots[j].x / img.width * 100 + "%"; r.style.top = spots[j].y / img.height * 100 + "%"; });
  const chips = mtEl("div", "mt-chips3", spots.map((_, j) => `<i data-j="${j}"><span>${j + 1}</span></i>`).join(""));
  const view = mtEl("div", "mt-vp"); view.append(mtFig(pic, "Greyscale", ar), chips);
  return {
    title: "Match the <em>values</em>", sub: `${p.artist}, ${p.title}. Set each chip to the lightness of its ringed spot.`, view, state: st,
    controls: spots.map((_, j) => mtSlider({ key: keys[j], label: `Spot ${j + 1}`, aria: `Spot ${j + 1} lightness`, min: 0, max: 100 })),
    apply: s => spots.forEach((_, j) => chips.querySelector(`[data-j="${j}"]`).style.setProperty("--c", mtLGrey(s[keys[j]]))),
    score: s => ({ err: spots.reduce((a, sp, j) => a + Math.abs(s[keys[j]] - sp.L), 0) / spots.length, unit: "ΔL*" }),
    tip: s => mtValueTip(spots.map((sp, j) => ({ label: `Spot ${j + 1}`, yours: s[keys[j]], truth: sp.L, sur: sp.sur })), { spot: true }),
    split: s => { const v = mtEl("div", "mt-vp rev"), pc = pic.cloneNode(true); pc.querySelector("canvas").replaceWith(mtCanvas(grey));
      const ch = mtEl("div", "mt-chips3 rev", spots.map((sp, j) => `<i style="--c:${mtLGrey(sp.L)};--y:${mtLGrey(s[keys[j]])}"><span>${j + 1}</span><em>${(s[keys[j]] - sp.L > 0 ? "+" : "") + Math.round(s[keys[j]] - sp.L)}</em></i>`).join(""));
      v.append(mtFig(pc, null, ar), ch, mtEl("p", "mt-cap", "Left: yours · right: true · error in L*")); return v; },
    demo: s => spots.forEach((sp, j) => { s[keys[j]] = sp.L + [5, -3, 9][j]; }),
  };
}

// ======================================================================
// Atelier 2: Big masses. The painting's palette map, smoothed into big shapes; pick each mass's color from close
// same-family candidates (closer as you level up; from level 15 you can also mix your own with the picker).
// ======================================================================
async function mtMakeMasses({ lv, f }) {
  const rnd = Math.random, P = mtPaintings(), p = mtPick(P);
  const [img, mp] = await Promise.all([mtLoad(p.img, 360, 420), mtLoadMap(p.map)]);
  const k = p.palette.length, sm = mtMajority(mp.m, mp.w, mp.h, k, 2, 3), labs = mtMassLabels(sm, mp.w, mp.h, k);
  const present = labs.map((l, i) => l.n > mp.w * mp.h * .015 ? i : -1).filter(i => i >= 0);
  const truth = p.palette.map(c => mtHexLab(c.h)), d = mtLerp(14, 3, f), nc = lv < 12 ? 4 : 6;
  const cands = present.map(i => shuffle([p.palette[i].h, ...Array.from({ length: nc - 1 }, () => mtLabHex(...mtNear(truth[i], d * (.8 + .4 * rnd()), rnd)))]));
  const ar = mp.w / mp.h, cv = mtCanvas(mtImg(mp.w, mp.h)), buf = mtImg(mp.w, mp.h);
  const paint = (pick, out) => { const rgbs = pick.map(h => h ? [1, 3, 5].map(j => parseInt(h.slice(j, j + 2), 16)) : [58, 58, 58]);
    for (let i = 0; i < sm.length; i++) { const c = rgbs[sm[i]]; out.data[i * 4] = c[0]; out.data[i * 4 + 1] = c[1]; out.data[i * 4 + 2] = c[2]; out.data[i * 4 + 3] = 255; } return out; };
  const pic = mtEl("div", "mt-pic mt-masspic"); pic.append(cv);
  present.forEach((i, j) => { const b = mtEl("b", "mt-ring sm", `<span>${j + 1}</span>`); b.dataset.j = j; b.style.left = clamp(labs[i].x / mp.w * 100, 7, 93) + "%"; b.style.top = clamp(labs[i].y / mp.h * 100, 7, 93) + "%"; pic.append(b); });
  const refImg = mtEl("div", "mt-pic mt-refpic"); refImg.append(mtCanvas(img));
  const st = { pick: Array(k).fill(null), sel: 0 };
  let ctlApi = null;
  const control = { mount(host, s, changed) {
    const el = mtEl("div", "mt-mass-ctl", `<div class="mt-mrow">${present.map((_, j) => `<button data-j="${j}" aria-label="Mass ${j + 1}"><span>${j + 1}</span></button>`).join("")}
      <i class="mt-gap"></i>${lv >= 15 && typeof colorPicker === "function" ? '<button class="mt-squint" data-mix>Mix</button>' : ""}<button class="mt-squint" data-squint aria-pressed="false">Squint</button></div><div class="mt-cands n${nc}"></div>`);
    host.append(el);
    let off = false;
    const sync = () => {
      el.querySelectorAll(".mt-mrow [data-j]").forEach(b => { const i = present[+b.dataset.j]; b.classList.toggle("on", +b.dataset.j === s.sel); b.style.setProperty("--c", s.pick[i] || "transparent"); b.classList.toggle("set", !!s.pick[i]); });
      pic.querySelectorAll(".mt-ring").forEach(b => b.classList.toggle("on", +b.dataset.j === s.sel));
      const i = present[s.sel], cs = cands[s.sel];
      el.querySelector(".mt-cands").innerHTML = cs.map(h => `<button class="tile${s.pick[i] === h ? " ring" : ""}" data-h="${h}" style="--c:${h}" aria-label="Candidate"></button>`).join("");
      el.querySelectorAll("[data-h]").forEach(b => b.onclick = () => { if (off) return; s.pick[i] = b.dataset.h; buzz(6);
        const nxt = present.findIndex((pi, j) => j > s.sel && !s.pick[pi]); if (nxt >= 0) s.sel = nxt; sync(); changed(); });
      const mx = el.querySelector("[data-mix]");
      if (mx) mx.onclick = () => { if (off) return; const { sh } = sheet(`<h3>Mass ${s.sel + 1}</h3><div data-cp></div>`);
        colorPicker(sh.querySelector("[data-cp]"), { hex: s.pick[i] || cs[0], onChange: h => { s.pick[i] = h; sync(); changed(); } }); };
    };
    el.querySelectorAll(".mt-mrow [data-j]").forEach(b => b.onclick = () => { s.sel = +b.dataset.j; sync(); });
    el.querySelector("[data-squint]").onclick = e => { const on = refImg.classList.toggle("squint"); e.currentTarget.setAttribute("aria-pressed", on); e.currentTarget.classList.toggle("on", on); };
    pic.addEventListener("pointerdown", e => { if (off) return; const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * mp.w | 0, y = (e.clientY - r.top) / r.height * mp.h | 0;
      const c = sm[clamp(y, 0, mp.h - 1) * mp.w + clamp(x, 0, mp.w - 1)], j = present.indexOf(c); if (j >= 0) { s.sel = j; sync(); } });
    sync();
    return ctlApi = { sync, disable: () => { off = true; el.querySelectorAll("button:not([data-squint])").forEach(b => { b.disabled = true; }); } };
  } };
  const layout = ar > 1.05 ? "stack" : "side";
  return {
    title: "Find the big <em>masses</em>", sub: `${p.artist}, ${p.title}. Tap a numbered shape, then its color.`, layout, state: st,
    ref: { el: refImg, label: "Painting", ar: img.width / img.height }, yours: { el: pic, label: "Your masses", ar },
    controls: [control], ready: s => present.every(i => s.pick[i]),
    apply: s => mtPut(cv, paint(s.pick, buf)),
    score: s => { const tot = present.reduce((a, i) => a + p.palette[i].share, 0);
      return { err: present.reduce((a, i) => a + mtDELab(mtHexLab(s.pick[i]), truth[i]) * p.palette[i].share, 0) / tot }; },
    tip: s => mtMassTip(present.map(i => ({ name: p.palette[i].name, yours: mtHexLab(s.pick[i]), truth: truth[i], share: p.palette[i].share }))),
    split: s => { const f = mtSplit(mtCanvas(paint(s.pick, mtImg(mp.w, mp.h))), mtCanvas(paint(p.palette.map(c => c.h), mtImg(mp.w, mp.h))), ar, ["Yours", "Painting's masses"]); f.classList.add("mt-massrev"); return f; },
    demo: s => { present.forEach((i, j) => { s.pick[i] = j === 1 ? cands[j].find(h => h !== p.palette[i].h) : p.palette[i].h; }); s.sel = 1; if (ctlApi) ctlApi.sync(); },
  };
}

// ======================================================================
// Atelier 3: Zorn palette. Mix a target from yellow ochre, vermilion, ivory black and titanium white.
// The mix runs through a small spectral model (js/match-model.js). From level 5 one target per set is out of range,
// to teach the palette's gamut; that one scores against the closest possible mix.
// ======================================================================
const MT_ZORN_OUT = [["blue-green", "#2E7D7A"], ["cobalt-like blue", "#2F5DA8"], ["violet", "#6A4C9C"], ["leaf green", "#4F8A3C"], ["steel blue", "#3F6E8C"]];
async function mtMakeZorn({ lv, f, n, total, shot }) {
  const rnd = Math.random, out = (lv >= 5 && n === total - 1) || /out/.test(shot);
  let target, name = null, best = null;
  if (out) { const [nm, hx] = mtPick(MT_ZORN_OUT, rnd); name = nm; target = mtHexLab(hx); best = mtZornBest(target); }
  else {
    for (let t = 0; t < 60; t++) {
      const am = [0, 0, 0, 0], use = lv < 6 ? shuffle([[0, 1], [0, 2], [1, 2], [0, 3], [1, 3]])[0] : shuffle([0, 1, 2, 3]).slice(0, lv < 12 ? 3 : 4);
      use.forEach(i => { am[i] = 1 + Math.round(rnd() * 5 * 2) / 2; });
      const m = mtMix(am); if (m.lab[0] > 22 && m.lab[0] < 90 && m.lin.every(x => x >= 0 && x <= 1)) { target = m.lab; break; }
    }
    if (!target) target = mtMix([3, 1, .5, 0]).lab;
  }
  const keys = MT_PAINTS.map(p => p.id), st = { white: 1, ochre: 0, vermilion: 0, black: 0 };
  const amounts = s => keys.map(k => s[k]), tHex = mtLabHex(...target);
  const view = mtEl("div", "mt-zorn", `<div class="mt-sw"><i style="--c:${tHex}"></i><span>Target</span></div><div class="mt-sw"><i data-mix></i><span>Your mix</span></div>`);
  const mixEl = view.querySelector("[data-mix]");
  return {
    title: out ? "Mix <em>this</em>" : "Mix the <em>target</em>", sub: "Four paints only. Parts are by volume; simplified mixing model.", view, state: st,
    controls: MT_PAINTS.map(p => mtSlider({ key: p.id, label: `<i class="mt-dab" style="--c:${mtMix(MT_PAINTS.map(q => q === p ? 1 : 0)).hex}"></i>${p.name}`, aria: p.name, min: 0, max: 8,
      fmt: v => v < .05 ? "–" : `${v.toFixed(1)} pt` })),
    apply: s => { const m = mtMix(amounts(s)); mixEl.style.setProperty("--c", m ? m.hex : "transparent"); mixEl.classList.toggle("empty", !m); },
    ready: s => !!mtMix(amounts(s)),
    score: s => { const m = mtMix(amounts(s)), de = mtDELab(m.lab, target);
      return out ? { err: Math.max(0, de - best.de), verdict: de - best.de < 1.5 ? "as close as it gets" : "short of the best mix", side: `ΔE ${mtFmt(de)} · best possible ${mtFmt(best.de)}`, note: "Out-of-range targets score how close you got to the best possible mix. Ten-band reflectance curves (approximations), mixed by weighted geometric mean under D65." }
        : { err: de, note: "Simplified model: ten-band reflectance curves (approximations), mixed by weighted geometric mean, under D65 daylight. Real paints vary by brand." }; },
    tip: s => mtZornTip(amounts(s), target, best),
    split: s => { const m = mtMix(amounts(s)), v = mtEl("div", `mt-zorn rev${best ? "" : " one"}`, `<div class="mt-sw"><i class="half" style="--c:${m.hex};--t:${tHex}"></i><span>Yours | target</span></div>`
        + (best ? `<div class="mt-sw"><i class="half" style="--c:${mtMix(best.amounts).hex};--t:${tHex}"></i><span>Closest possible | target</span></div>` : ""));
      if (name) v.append(mtEl("p", "mt-cap", `The target was a ${esc(name)}.`)); return v; },
    demo: s => { if (out) { s.white = 3; s.black = 1.2; return; }
      const b = mtZornBest(target), tot = b.amounts.reduce((a, x) => a + x, 0) || 1;
      keys.forEach((k, i) => { s[k] = +(b.amounts[i] / tot * 6 * (i === 0 ? 1.3 : i === 1 ? 1.5 : 1) + (i === 3 ? .15 : 0)).toFixed(2); }); },
  };
}
const MT_MAKE = { cast: mtMakeCast, shot: mtMakeShot, kelvin: mtMakeKelvin, value: mtMakeValue, masses: mtMakeMasses, zorn: mtMakeZorn };

// ======================================================================
// Station descriptors and tile art, for the Train home shelves (gym.js wires them in).
// ======================================================================
function mtArt(id) {
  const P = mtPaintings(), th = i => P.length ? P[(hash(today() + id) + i) % P.length].thumb : "";
  if (id === "cast") return `<span class="sa mt-art mt-art-cast"><img src="${th(0)}" alt=""><img class="b" src="${th(0)}" alt=""></span>`;
  if (id === "shot") return `<span class="sa mt-art mt-art-shot"><img src="${th(1)}" alt=""><img class="b" src="${th(1)}" alt=""></span>`;
  if (id === "kelvin") return `<span class="sa mt-art mt-art-k">${[2700, 3500, 4500, 5600, 7500].map(K => `<i style="--c:${mtHex(mtLightGains(K).map(x => .62 * x))}"></i>`).join("")}</span>`;
  if (id === "value") return `<span class="sa mt-art mt-art-v">${Array.from({ length: 9 }, (_, i) => `<i${[2, 5, 6].includes(i) ? ' class="blank"' : ""} style="--c:${mtLGrey(10 + i * 10)}"></i>`).join("")}</span>`;
  if (id === "masses") return `<span class="sa mt-art mt-art-m"><img src="${th(2)}" alt=""></span>`;
  return `<span class="sa mt-art mt-art-z">${MT_PAINTS.map(p => `<i style="--c:${mtMix(MT_PAINTS.map(q => q === p ? 1 : 0)).hex}"></i>`).join("")}</span>`;
}
function matchStations() {
  return Object.entries(MATCH).map(([id, d]) => {
    const st = mtState(id), lv = mtLevel(id);
    return { id, set: d.set, shelf: MT_SETS[d.set], name: d.name, what: d.what, unit: d.unit, level: lv,
      best: st.best != null ? `best ${mtFmt(st.best)} ${d.unit}` : "not tried yet", art: mtArt(id), open: () => openMatch(id) };
  });
}
// Tiles for the Train home, styled like gym.js station tiles. gym.js can use matchShelves() + wireMatch(el),
// or build its own from matchStations().
const matchTile = s => `<button class="gs-tile" data-mt="${s.id}">${s.art}<span class="gs-name">${esc(s.name)}</span>
  <span class="gs-meta"><span>${s.level ? `Level ${s.level}` : "New"}</span></span>${ladder(s.level)}<span class="gs-best">${esc(s.best)}</span></button>`;
const MT_SHELF_SUB = { colorist: "grade like a colorist", atelier: "see like a painter" };
function matchShelves() {
  const list = matchStations();
  return Object.entries(MT_SETS).map(([k, label]) => `<div class="sec-head"><b>${label}</b><span>${MT_SHELF_SUB[k]}</span></div>
    <div class="gs-grid">${list.filter(s => s.set === k).map(matchTile).join("")}</div>`).join("");
}
const wireMatch = root => root.querySelectorAll("[data-mt]").forEach(b => { b.onclick = () => openMatch(b.dataset.mt); });
// A preview of the two shelves (index.html#shot=match:list).
function mtShelfDemo() {
  const el = show(`<header class="bar"><div class="brand">${LOGO}<span>ColorHub</span></div><span class="eyebrow">Applied</span></header>${matchShelves()}`, "gym", "gym");
  wireMatch(el);
}
