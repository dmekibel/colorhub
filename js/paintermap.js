"use strict";
// The painter map (David, 2026-11-07): "Similar to the painting map, we can do a painter map, where each cell is a painter,
// with different types of grouping arrangements." One circle per painter with a painter page (data/artists/map.json,
// built by tools/painter_map.py; the faces are cut from the painting map's own atlas, so nothing new is fetched from the
// network). Same chrome as the painting map (css/paintmap.css pmx-*), same honeycomb color arrangement (honeySunArr in
// js/honey.js), same sheet; the painter page it opens is the normal one, so Back is the normal trail.
//
//   ptmGo(query)   open it: "arr=color|like|time|place|movement|fame&face=famous|color|dna|portrait&min=10&only=portrait&near=%23c8501e"
//   #/painters/map  the address;  any element with data-ptmap="<query>" opens it (Boards > Painters, the painting map's sheet,
//                   a color page's "Painters who love this").
//
// Cell face (⋯ sheet): Famous painting (default), Signature color, Color DNA (the five vivid colors of the painter page's
// strip, as a tiny quilt) or Portrait (own gallery self-portraits only; others keep their painting).
// Position (the one line under the title says which): By color, Paints like, By time, By place, By movement, By fame.
// "By look" (the painting map's image-model layout) is not offered: it needs the 238k-painting look.bin (a few MB and
// UMAP positions per painting) just to average per painter, and "Paints like" already answers "who looks alike".

const PTM_ARR = [["color", "By color"], ["like", "Paints like"], ["time", "By time"], ["place", "By place"], ["movement", "By movement"], ["fame", "By fame"]];
const PTM_WHY = {
  color: "Vivid signature colors in the middle, hue around",
  like: "Painters with alike palettes sit together, across centuries",
  time: "Born earlier to the left, a band for each part of the world",
  place: "A block for each country, the biggest first",
  movement: "A block for each movement, the biggest first",
  fame: "The best known in the middle, the rest spiralling out",
};
const PTM_FACE = [["portrait", "Portrait"], ["famous", "Painting"], ["color", "Color"], ["dna", "Color DNA"]];
const PTM_FACE_WHY = { famous: "Each painter shown by their best-known painting", color: "Each painter shown by the vivid color they are known for", dna: "Each painter shown by five signature colors", portrait: "Each painter shown by their portrait, or their best-known painting" };
const PTM_ICON = {
  color: sv('<circle cx="8" cy="8" r="3.2"/><circle cx="16" cy="8" r="3.2"/><circle cx="12" cy="15.5" r="3.2"/>', 22, 1.7),
  like: sv('<circle cx="8" cy="9" r="4"/><circle cx="14" cy="14" r="4"/><path d="M11.5 10.5l1 1.5"/>', 22, 1.7),
  time: sv('<path d="M4 6h16M4 12h16M4 18h16"/><path d="M8 4v4M14 10v4M10 16v4"/>', 22, 1.7),
  place: sv('<path d="M12 21s6.5-5.6 6.5-11a6.5 6.5 0 0 0-13 0c0 5.4 6.5 11 6.5 11z"/><circle cx="12" cy="10" r="2.3"/>', 22, 1.7),
  movement: sv('<circle cx="7" cy="7" r="3.4"/><circle cx="16.5" cy="6.5" r="2.4"/><circle cx="7" cy="16.5" r="2.4"/><circle cx="17" cy="16" r="3"/>', 22, 1.7),
  fame: sv('<path d="M12 3.8l2.4 5 5.4.7-4 3.8 1 5.4-4.8-2.7-4.8 2.7 1-5.4-4-3.8 5.4-.7z"/>', 22, 1.7),
};
// David, 2026-11-07: "palettes as cells look weird; a self-portrait / portrait, or their most famous painting if there is none"
const ptmFaceAuto = () => "portrait";
const PTM_REG = [
  ["Western Europe", ["France", "Italy", "Spain", "Portugal", "Netherlands", "Belgium", "Germany", "Austria", "Switzerland", "United Kingdom", "Ireland", "Luxembourg", "Monaco"]],
  ["Northern and Eastern Europe", ["Russia", "Poland", "Sweden", "Norway", "Denmark", "Finland", "Czechia", "Hungary", "Greece", "Ukraine", "Romania", "Croatia", "Serbia", "Estonia", "Latvia", "Lithuania", "Iceland", "Bulgaria", "Slovakia", "Slovenia", "Belarus", "Georgia", "Armenia"]],
  ["The Americas", ["United States", "Canada", "Mexico", "Brazil", "Argentina", "Chile", "Peru", "Colombia", "Cuba", "Venezuela", "Uruguay", "Ecuador", "Bolivia", "Guatemala"]],
];
const PTM_DEF = { arr: "color", face: "", min: 6, only: "all", near: "", p: "" };
const ptmMag = () => { try { const v = localStorage.getItem("ptm-mag"); if (v != null && isFinite(+v)) return Math.max(0, Math.min(1, +v)); } catch (e) {} return .5; };
const PTM_STATE = new Map();   // the address a map opened with -> its spec as you left it
const PTM_VIEW = new Map();    // arrangement|face|filter -> { tx, ty, s }: where you were, so Back from a painter lands on it again
const PTM_LAY = new Map();     // arrangement|filter -> layout
let PTM = null, PTM_P = null, PTM_CSS = null;

const ptmNum = n => Number(n).toLocaleString("en-US");
const ptmNorm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const ptmYears = r => r.b != null ? `${r.b < 0 ? -r.b + " BCE" : r.b}–${r.d != null ? (r.d < 0 ? -r.d + " BCE" : r.d) : ""}` : (r.y0 ? `${r.y0}–${r.y1}` : "");
const ptmWhen = r => r.b != null ? r.b : (r.y0 != null ? (r.y0 + r.y1) / 2 : 1800);
// not a person: museum catch-alls for unknown hands never sit on the map as if they were a painter
const PTM_ANON = /^(unknown|anonymous|okänd|onbekend|unbekannt|anonyme?|anónimo|ignoto|inconnu)\b|\bunknown (painter|artist)\b/i;
const ptmScore = r => r.k + 60 * Math.min(3, r.fm) + (r.p >= 0 ? 10 : 0);
const ptmVer = () => (typeof DATA_VER !== "undefined" && DATA_VER ? "?v=" + DATA_VER : "");

// ---------- the data ----------
function ptmImg(src) {
  return new Promise(res => { const im = new Image(); im.decoding = "async"; im.onload = () => res(im); im.onerror = () => res(null); im.src = src + ptmVer(); });
}
// David, 2026-11-07 ("on desktop painter map is super slow"): each face used to be clipped to a circle on every frame
// (thousands of save/clip/restore per frame). The sheets are cut round once here, so a frame is plain drawImage calls.
function ptmRound(img, tile) {
  if (!img) return null;
  const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
  const g = c.getContext("2d"); g.drawImage(img, 0, 0); g.globalCompositeOperation = "destination-in"; g.beginPath();
  const r = tile / 2;
  for (let y = 0; y < img.height; y += tile) for (let x = 0; x < img.width; x += tile) { g.moveTo(x + tile, y + r); g.arc(x + r, y + r, r, 0, 6.2832); }
  g.fill(); return c;
}
function ptmColors(r) {
  // the painter page's strip rule (js/artwiki.js awVividStrip): vivid, mid-light colors of their most famous paintings, distinct from each other
  const pass = (cmin) => {
    const cand = [];
    r.ids.forEach(i => { for (let j = 0; j < 6; j++) { const h = glHex(i, j), l = lab(h), c = Math.hypot(l[1], l[2]); if (c >= cmin && l[0] > 18 && l[0] < 92) cand.push({ h, l, w: c * (.5 + GAL.sh[i * 6 + j]) }); } });
    cand.sort((a, b) => b.w - a.w);
    const out = [];
    cand.forEach(x => { if (out.length < 5 && out.every(o => Math.hypot(o.l[0] - x.l[0], o.l[1] - x.l[1], o.l[2] - x.l[2]) > 18)) out.push(x); });
    return out;
  };
  let out = pass(16); if (out.length < 3) out = pass(7);
  if (!out.length && r.f >= 0) out = [{ h: glHex(r.f, 0), l: lab(glHex(r.f, 0)) }];
  r.dna = out.map(x => x.h); r.dl = out.map(x => x.l);
  r.sig = r.dna[0] || "#8A857C";
  const l = r.dl[0] || [55, 0, 0]; r.C = Math.hypot(l[1], l[2]); r.L = l[0]; r.H = (Math.atan2(l[2], l[1]) * 180 / Math.PI + 360) % 360;
}
function ptmLoad() {
  if (PTM) return Promise.resolve(PTM);
  return PTM_P || (PTM_P = Promise.all([fetch("data/artists/map.json").then(r => { if (!r.ok) throw new Error("map " + r.status); return r.json(); }), loadGallery(), ptmImg("data/artists/map-faces.webp"), ptmImg("data/artists/map-portraits.webp")]).then(async ([m, , fi, pi]) => {
    const A = m.a;
    for (let i = 0; i < A.length; i += 300) { for (let j = i; j < Math.min(A.length, i + 300); j++) ptmColors(A[j]); await new Promise(r => setTimeout(r, 0)); }
    const ix = new Map(A.map((r, i) => [r.s, i])), nb = A.map(() => []);
    (m.e || []).forEach(([a, b, k]) => { nb[a].push([b, k, 0]); nb[b].push([a, k, 1]); });   // [other, 0 teacher | 1 influence, 0 = they came first]
    return (PTM = { A, ix, nb, W: m.W, H: m.H, tile: m.tile, cols: m.cols, pc: m.pc, faces: ptmRound(fi, m.tile), ports: ptmRound(pi, m.tile), t0: 0 });
  }).catch(e => { PTM_P = null; throw e; }));
}

// ---------- layouts: every one returns { x, y (Float32Array by painter index, NaN = not shown), labels, ticks, n } ----------
const PTM_SQ = .866;
function ptmHex(c, r) { return [c * PTM_SQ, r + (c & 1 ? .5 : 0)]; }
function ptmSplit(ids, gx, gy, x0, y0, w, h, out) {   // recursive median split onto an even grid: the layout keeps neighbors, never leaves a void
  if (!ids.length || w <= 0 || h <= 0) return;
  if (ids.length === 1 || (w === 1 && h === 1)) { ids.forEach(i => out.set(i, [x0, y0])); return; }
  if (w >= h) { ids = ids.slice().sort((a, b) => gx(a) - gx(b)); const w1 = Math.max(1, Math.min(w - 1, w >> 1)), k = Math.round(ids.length * w1 / w); ptmSplit(ids.slice(0, k), gx, gy, x0, y0, w1, h, out); ptmSplit(ids.slice(k), gx, gy, x0 + w1, y0, w - w1, h, out); }
  else { ids = ids.slice().sort((a, b) => gy(a) - gy(b)); const h1 = Math.max(1, Math.min(h - 1, h >> 1)), k = Math.round(ids.length * h1 / h); ptmSplit(ids.slice(0, k), gx, gy, x0, y0, w, h1, out); ptmSplit(ids.slice(k), gx, gy, x0, y0 + h1, w, h - h1, out); }
}
function ptmBlank(P) { return { x: new Float32Array(P).fill(NaN), y: new Float32Array(P).fill(NaN), labels: [], ticks: [], n: 0 }; }
function ptmSpiral(ids, ox, oy, lay) {   // ids in rank order, best in the middle
  ids.forEach((id, k) => { const rr = .56 * Math.sqrt(k + .5), a = k * 2.399963; lay.x[id] = ox + rr * Math.cos(a); lay.y[id] = oy + rr * Math.sin(a); });
}
function ptmBlocks(groups, lay, lastKey) {   // groups: [[title, ids in rank order]]; packs round blocks, the biggest in the middle, labels at their centers
  const B = groups.map(([t, ids]) => ({ t, ids, R: .56 * Math.sqrt(ids.length) + .9 }));
  B.sort((a, b) => (a.t === lastKey) - (b.t === lastKey) || b.ids.length - a.ids.length);
  const placed = [];
  B.forEach((b, i) => {
    let best = null;
    if (!i) best = [0, 0];
    else for (let rad = 0; !best; rad += 1.2) {
      const steps = Math.max(12, Math.round(rad * 1.6));
      for (let k = 0; k < steps && !best; k++) { const a = k / steps * 6.2832, x = rad * Math.cos(a), y = rad * Math.sin(a); if (placed.every(p => Math.hypot(p.x - x, p.y - y) >= p.R + b.R + 1.1)) best = [x, y]; }
    }
    b.x = best[0]; b.y = best[1]; placed.push(b);
    ptmSpiral(b.ids, b.x, b.y, lay);
    lay.labels.push({ t: b.t, n: b.ids.length, x: b.x, y: b.y - b.R + .2, r: b.R });
  });
}
function ptmLayout(arr, ids, st) {
  const D = PTM, A = D.A, lay = ptmBlank(A.length); lay.n = ids.length; if (!ids.length) return lay;
  const byFame = (a, b) => ptmScore(A[b]) - ptmScore(A[a]);
  if (arr === "fame") { ptmSpiral(ids.slice().sort(byFame), 0, 0, lay); }
  else if (arr === "color") {
    const items = ids.map(i => ({ i, h: A[i].sig, L: A[i].L, C: A[i].C, H: A[i].H })), rank = honeyVividRank(items), r = honeySunArr(items, rank, null);
    r.pts.forEach(p => { lay.x[p.it.i] = p.x; lay.y[p.it.i] = p.y; });
  } else if (arr === "like") {
    const w = Math.ceil(Math.sqrt(ids.length * 1.15)), h = Math.ceil(ids.length / w), out = new Map();
    ptmSplit(ids, i => D.A[i].lx, i => D.A[i].ly, 0, 0, w, h, out);
    out.forEach(([c, r], id) => { const [x, y] = ptmHex(c, r); lay.x[id] = x; lay.y[id] = y; });
  } else if (arr === "time") {
    const bands = PTM_REG.map(([t, cs]) => ({ t, cs: new Set(cs), ids: [] })).concat([{ t: "Asia and elsewhere", cs: null, ids: [] }]);
    ids.forEach(i => { const c = A[i].co; (bands.find(b => b.cs && b.cs.has(c)) || bands[bands.length - 1]).ids.push(i); });
    let y0 = 1.6;
    bands.filter(b => b.ids.length).forEach(b => {
      b.ids.sort((p, q) => ptmWhen(A[p]) - ptmWhen(A[q]) || p - q);
      const H = Math.max(3, Math.round(Math.sqrt(b.ids.length) * .6)), cols = Math.ceil(b.ids.length / H);
      b.ids.forEach((id, k) => { const c = Math.floor(k / H), r = k % H, [x, y] = ptmHex(c, r); lay.x[id] = x; lay.y[id] = y0 + 1.2 + y; });
      for (let c = 8; c < cols; c += Math.max(8, Math.round(cols / 9))) { const id = b.ids[Math.min(b.ids.length - 1, c * H)], yr = Math.round(ptmWhen(A[id]) / 10) * 10; lay.ticks.push({ t: yr + "s", x: c * PTM_SQ, y: y0 }); }
      lay.labels.push({ t: b.t, n: b.ids.length, x: 0, y: y0, left: true, yb: y0 + 1.2 + H });
      y0 += H + 2.2;
    });
  } else {
    const key = arr === "place" ? (i => A[i].co || "Place unknown") : (i => A[i].mv), g = new Map();
    if (arr === "movement") { const keep = ids.filter(i => A[i].mv); lay.skipped = ids.length - keep.length; ids = keep; lay.n = keep.length; }
    ids.slice().sort(byFame).forEach(i => { const k = key(i); (g.get(k) || g.set(k, []).get(k)).push(i); });
    const other = arr === "place" ? "Other places" : "Other movements", none = "Place unknown", groups = [], rest = [];
    g.forEach((v, k) => { if (v.length < 3 && k !== none) rest.push(...v); else groups.push([k, v]); });
    if (rest.length) groups.push([other, rest.sort(byFame)]);
    ptmBlocks(groups, lay, other);
  }
  return lay;
}

// ---------- the screen ----------
function ptmParse(q) {
  const u = new URLSearchParams(String(q || "").replace(/^\?/, "")), s = { ...PTM_DEF };
  if (PTM_ARR.some(a => a[0] === u.get("arr"))) s.arr = u.get("arr");
  if (PTM_FACE.some(a => a[0] === u.get("face"))) s.face = u.get("face");
  else { try { const f = localStorage.getItem("ptm-face"); if (PTM_FACE.some(a => a[0] === f)) s.face = f; } catch (e) {} }
  const mn = +u.get("min"); if (mn >= 6) s.min = mn;
  if (["portrait", "famous"].includes(u.get("only"))) s.only = u.get("only");
  const nr = u.get("near"); if (/^#?[0-9a-f]{6}$/i.test(nr || "")) s.near = "#" + nr.replace("#", "").toUpperCase();
  if (u.get("p")) s.p = u.get("p");
  if (s.near && !u.get("arr")) s.arr = "color";
  return s;
}
function ptmQS(s) {
  const o = [];
  if (s.arr !== PTM_DEF.arr) o.push(["arr", s.arr]); 
  if (s.min > 6) o.push(["min", s.min]); if (s.only !== "all") o.push(["only", s.only]); if (s.near) o.push(["near", s.near]);
  return o.map(([k, v]) => k + "=" + encodeURIComponent(v)).join("&");
}
function ptmRouteOf(spec) { const q = typeof spec === "string" ? spec.replace(/^\?/, "") : ptmQS({ ...PTM_DEF, ...(spec || {}) }); return routed("Painters", "painters/map" + (q ? "?" + q : "")); }
function ptmGo(spec, fromAddress) {
  return ptmOpen(spec, { address: !!fromAddress, fresh: true });
}
function ptmIds(s) {
  const A = PTM.A, out = [];
  for (let i = 0; i < A.length; i++) { const r = A[i]; if (r.k < s.min || PTM_ANON.test(r.n)) continue; if (s.only === "portrait" && r.pt == null) continue; if (s.only === "famous" && !r.fm) continue; out.push(i); }
  return out;
}
function ptmOpen(spec, o = {}) {
  const from = typeof spec === "string" ? spec : JSON.stringify(spec || {}), fresh = o.fresh && !o._used; o._used = true;
  const el = show(`
    <div class="pmx-stage ptm-stage"><canvas class="pmx-cv ptm-cv" aria-label="Painters as a map: drag to browse, pinch to zoom, tap a painter to open them"></canvas><p class="pmx-wait">Laying out the painters…</p></div>
    <header class="pmx-top">
      <button class="icon-btn glass" data-back aria-label="Back">${ICON.back}</button>
      <p class="pmx-title"><b>Painters</b><small data-ptwhy></small></p>
      <button class="icon-btn glass ptm-find-b" data-ptfindb aria-label="Find a painter">${ICON.search}</button>
    </header>
    <div class="ptm-find" data-ptfind hidden>
      <div class="ptm-find-bar"><span aria-hidden="true">${ICON.search}</span><input type="search" data-ptq placeholder="Find a painter" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Find a painter"><button class="iconq" data-ptfindx aria-label="Close search">${ICON.x}</button></div>
      <div class="ptm-find-list" data-ptlist role="listbox"></div>
    </div>
    <button class="corner l pl-corner" data-rooms-corner aria-label="Places">${ROOMS_GLYPH}<span>Places</span></button>
    <button class="corner r hm-do pmx-do" data-do-corner aria-label="Arrange the painter map" aria-haspopup="dialog">${ICON.more}</button>
    <div class="pmx-chipbar ptm-chips" data-ptchips hidden></div>
    <div class="ptm-empty" data-ptempty hidden></div>
    <div class="ptm-tip" data-pttip hidden></div>
    <div class="pmx-cap" data-ptcap hidden>
      <button class="pmx-cap-main" data-ptopen aria-label="Open this painter"><b data-ptct></b><small data-ptcb></small><i class="pmx-cap-go" aria-hidden="true">${ICON.chev}</i></button>
    </div>`, "fixed cx pmx ptm");
  el.querySelector("[data-back]").onclick = () => xBack();
  onKey = e => { if (e.key === "Escape" && !document.querySelector(".sheet,.rooms-stem")) { const f = el.querySelector("[data-ptfind]"); if (f && !f.hidden) f.hidden = true; else xBack(); } };
  ptmLoad().then(() => {
    if (!el.isConnected) return;
    const s = (!fresh && PTM_STATE.get(from)) || ptmParse(typeof spec === "string" ? spec : ptmQS({ ...PTM_DEF, ...(spec || {}) }));
    PTM_STATE.set(from, s);
    ptmMount(el, s, from);
  }).catch(err => {
    if (!el.isConnected) return;
    console.warn(err);
    el.querySelector(".pmx-wait").innerHTML = `The painters didn't load. <button class="wl" data-ptretry>Try again</button>`;
    el.querySelector("[data-ptretry]").onclick = () => ptmOpen(spec, o);
  });
  return el;
}

function ptmMount(el, s, from) {
  const D = PTM, A = D.A, cv = el.querySelector("canvas"), ctx = cv.getContext("2d"), stage = el.querySelector(".ptm-stage");
  const $ = sel => el.querySelector(sel);
  let W = 0, H = 0, dpr = 1, dead = false, raf = 0, lay = null, ids = [], view = { tx: 0, ty: 0, s: 20 }, minS = 4, bb = null, hash = null, sel = -1, hover = -1, centerI = -1;
  let ground = "#0E0D0B", ink = "#ECE8DF", fadeT0 = performance.now(), vx = 0, vy = 0, glide = null, dirty = true, lit = null, litSet = null, focus = null;
  const vis = [];   // the cells as last drawn: [painter, x, y, radius, lens size] on screen (hit testing follows the lens)
  const cleanup = [], faceOf = () => s.face || ptmFaceAuto(s.arr);
  const topPad = () => 120, botPad = () => 150;
  const readTheme = () => { const cs = getComputedStyle(stage); ground = cs.backgroundColor || ground; ink = getComputedStyle(el).color || ink; dirty = true; };
  const vkey = () => `${from}|${s.arr}|${s.min}|${s.only}|${s.near}`;

  // ---- layout and view ----
  function ensure() {
    ids = ptmIds(s);
    const k = `${s.arr}|${s.min}|${s.only}`;
    lay = PTM_LAY.get(k) || (PTM_LAY.set(k, ptmLayout(s.arr, ids, s)), PTM_LAY.get(k));
    if (PTM_LAY.size > 6) PTM_LAY.delete(PTM_LAY.keys().next().value);
    ids = ids.filter(i => isFinite(lay.x[i]));
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    ids.forEach(i => { const x = lay.x[i], y = lay.y[i]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; });
    lay.labels.forEach(l => { if (l.y - 1.5 < y0) y0 = l.y - 1.5; });
    bb = ids.length ? { x0: x0 - .7, y0: y0 - .7, x1: x1 + .7, y1: y1 + .7 } : { x0: -1, y0: -1, x1: 1, y1: 1 };
    hash = new Map();
    ids.forEach(i => { const key = Math.floor(lay.x[i] / 2) * 100003 + Math.floor(lay.y[i] / 2); (hash.get(key) || hash.set(key, []).get(key)).push(i); });
    litCompute();
    $(`[data-ptwhy]`).textContent = s.near ? "Lit: painters who use this color most" : PTM_WHY[s.arr];
    chips(); empty();
  }
  function fit() { const w = W - 24, h = H - topPad() - botPad(); return Math.min(w / (bb.x1 - bb.x0), h / (bb.y1 - bb.y0)); }
  function place(initial) {
    const f = fit(); minS = Math.max(2, f * .85);
    const saved = PTM_VIEW.get(vkey());
    if (saved) { view = { ...saved }; return; }
    // open readable: faces at least ~30 px, centered on the best-known painter (or the lit ones), never on a void
    let s0 = Math.max(f, 30), cx, cy;
    if (litSet && lit && lit.length) { const top = lit.slice(0, 3); cx = top.reduce((a, i) => a + lay.x[i], 0) / top.length; cy = top.reduce((a, i) => a + lay.y[i], 0) / top.length; s0 = Math.max(f, 38); }
    else if (s.arr === "fame" || s.arr === "color") { cx = 0; cy = 0; s0 = Math.max(f, W / 8); }
    else { let best = -1; ids.forEach(i => { if (best < 0 || ptmScore(A[i]) > ptmScore(A[best])) best = i; }); cx = best >= 0 ? lay.x[best] : 0; cy = best >= 0 ? lay.y[best] : 0; }
    if (f >= 30) { s0 = f; cx = (bb.x0 + bb.x1) / 2; cy = (bb.y0 + bb.y1) / 2; }
    view = { s: s0, tx: W / 2 - cx * s0, ty: topPad() + (H - topPad() - botPad()) / 2 - cy * s0 };
    // never open with a void: the edge of the map may come no further in than a sixth of the screen
    if (s.arr === "fame" || s.arr === "color") return;
    const x0 = bb.x0 * s0 + view.tx, x1 = bb.x1 * s0 + view.tx, y0 = bb.y0 * s0 + view.ty, y1 = bb.y1 * s0 + view.ty, T = topPad(), B = H - botPad() * .6;
    if (x1 - x0 > W) { if (x1 < W * .85) view.tx += W * .85 - x1; else if (x0 > W * .15) view.tx -= x0 - W * .15; }
    if (y1 - y0 > B - T) { if (y1 < B) view.ty += B - y1; else if (y0 > T) view.ty -= y0 - T; }
  }
  function clampView() {
    view.s = Math.max(minS, Math.min(160, view.s));
    const mx = 60, x0 = bb.x0 * view.s + view.tx, x1 = bb.x1 * view.s + view.tx, y0 = bb.y0 * view.s + view.ty, y1 = bb.y1 * view.s + view.ty;
    if (x1 < mx) view.tx += mx - x1; if (x0 > W - mx) view.tx -= x0 - (W - mx);
    if (y1 < topPad()) view.ty += topPad() - y1; if (y0 > H - botPad()) view.ty -= y0 - (H - botPad());
  }
  function size() {
    const r = stage.getBoundingClientRect(); dpr = Math.min(2, devicePixelRatio || 1);
    W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height)); cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + "px"; cv.style.height = H + "px"; dirty = true;
  }

  // ---- near a color: the painters whose signature colors are closest ----
  function litCompute() {
    lit = litSet = null;
    if (!s.near) return;
    const t = lab(s.near), sc = ids.map(i => { const r = A[i]; let d = 1e9; r.dl.forEach((l, k) => { const dd = Math.hypot(l[0] - t[0], (l[1] - t[1]) * 1.2, (l[2] - t[2]) * 1.2) * (k ? 1.15 : 1); if (dd < d) d = dd; }); return [i, d]; });
    sc.sort((a, b) => a[1] - b[1]);
    const cut = sc.filter((x, k) => k < 60 && x[1] < 24);
    lit = (cut.length >= 3 ? cut : sc.slice(0, 3)).map(x => x[0]); litSet = new Set(lit);
  }

  // ---- drawing ----
  const faceSrc = (r, mode) => {
    if (mode === "portrait" && r.pt != null && D.ports) { const k = r.pt, pc = D.pc; return [D.ports, (k % pc) * D.tile, Math.floor(k / pc) * D.tile]; }
    if (mode !== "color" && mode !== "dna" && D.faces && r.f >= 0) return [D.faces, (r._i % D.cols) * D.tile, Math.floor(r._i / D.cols) * D.tile];
    return null;
  };
  function draw(now) {
    dirty = false;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = ground; ctx.fillRect(0, 0, W, H);
    const sc = view.s, rad = sc * .47, dotOnly = sc < 9, mode = faceOf(), fa = 1;
    const dim = litSet ? .22 : 1;
    ctx.textBaseline = "middle"; ctx.textAlign = "center";
    // block and band names sit behind the cells
    const lbl = (l) => {
      let x = l.x * sc + view.tx, y = l.y * sc + view.ty;
      if (l.left) { const yb = l.yb * sc + view.ty, top = topPad() + 14; if (y < top && yb > top + 40) y = top; }   // a band name stays at the top while its band is on screen
      if (y < -40 || y > H + 40 || (!l.left && (x < -300 || x > W + 300))) return;
      const big = Math.min(26, Math.max(13, sc * (l.r ? Math.min(2.6, l.r / 6) : 1.6)));
      ctx.font = `400 ${big}px "Instrument Serif", Georgia, serif`; ctx.textAlign = l.left ? "left" : "center";
      ctx.lineWidth = 4; ctx.strokeStyle = ground; ctx.fillStyle = ink; ctx.globalAlpha = .9;
      const t = l.t + (sc > 6 || !l.left ? "" : ""); ctx.strokeText(t, l.left ? Math.max(14, x) : x, y); ctx.fillText(t, l.left ? Math.max(14, x) : x, y);
      ctx.globalAlpha = 1;
    };
    // the cells, through the Magnify lens (David, 2026-11-07: "i wanna add magnification"): cells near the lens grow and
    // push their neighbors out, so nothing overlaps; the lens follows the mouse on a desktop, sits mid-screen on a phone.
    const mag = s.mag == null ? ptmMag() : s.mag, k0 = mag * 2 * Math.max(0, Math.min(1, (120 - sc) / 80));
    const fx = focus ? focus[0] : W / 2, fy = focus ? focus[1] : topPad() + (H - topPad() - botPad()) / 2, R = Math.max(110, Math.min(W, H) * .2), R2 = R * R;
    vis.length = 0;
    for (let k = 0; k < ids.length; k++) {
      const i = ids[k], r = A[i]; let x = lay.x[i] * sc + view.tx, y = lay.y[i] * sc + view.ty, m = 1;
      if (k0 > 0) { const dx = x - fx, dy = y - fy, u2 = (dx * dx + dy * dy) / R2; if (u2 < 9) { const e = Math.exp(-u2), t = 1 + k0 * e; m = Math.max(.35, Math.min(t, 1 + k0 * e * (1 - 2 * u2))); x = fx + dx * t; y = fy + dy * t; } }
      const rr = rad * m;
      if (x < -rr || x > W + rr || y < -rr || y > H + rr) continue;
      vis.push([i, x, y, rr, m]);
    }
    if (k0 > 0) vis.sort((p, q) => p[4] - q[4]);   // the biggest last, on top
    for (const [i, x, y, rr] of vis) {
      const r = A[i], on = !litSet || litSet.has(i); ctx.globalAlpha = on ? 1 : dim;
      const src = faceSrc(r, mode);
      if (src) ctx.drawImage(src[0], src[1], src[2], D.tile, D.tile, x - rr, y - rr, rr * 2, rr * 2);
      else if (mode === "dna" && !dotOnly && r.dna.length > 1) {
        ctx.save(); ctx.beginPath(); ctx.arc(x, y, rr, 0, 6.2832); ctx.clip(); const n = r.dna.length, w = rr * 2 / n;
        r.dna.forEach((h, q) => { ctx.fillStyle = h; ctx.fillRect(x - rr + q * w - .3, y - rr, w + .6, rr * 2); }); ctx.restore();
      } else { ctx.fillStyle = r.sig; ctx.beginPath(); ctx.arc(x, y, rr, 0, 6.2832); ctx.fill(); }
      if (litSet && on) { ctx.globalAlpha = 1; ctx.lineWidth = 2; ctx.strokeStyle = ink; ctx.beginPath(); ctx.arc(x, y, rr + 1.5, 0, 6.2832); ctx.stroke(); }
      if (i === sel || i === hover) { ctx.globalAlpha = 1; ctx.lineWidth = 2.5; ctx.strokeStyle = ink; ctx.beginPath(); ctx.arc(x, y, rr + 2, 0, 6.2832); ctx.stroke(); }
    }
    ctx.globalAlpha = 1;
    lay.labels.forEach(lbl);
    ctx.font = `400 12px "Geist", system-ui, sans-serif`; ctx.fillStyle = ink; ctx.globalAlpha = .55; ctx.textAlign = "center";
    lay.ticks.forEach(t => { const x = t.x * sc + view.tx, y = t.y * sc + view.ty; if (x > 340 && x < W + 30 && y > 0 && y < H) ctx.fillText(t.t, x, y); });
    ctx.globalAlpha = 1;
    // names, where a cell is big enough to read them (David, 2026-11-07, "at this distance looks a bit messy"): best-known
    // painters first, only where a name fits, never over another name
    // (David, 2026-11-07, desktop: a name under every face "looks wrong at this distance"): only faces at least ~96 px wide
    // carry a name, so a wall of small faces stays clean and the Magnify lens is what brings names up
    const cand = vis.filter(v => v[3] * 2 >= 96 && v[2] + v[3] + 11 < H + 20 && (!litSet || litSet.has(v[0])));
    if (cand.length) {
      ctx.lineWidth = 4; ctx.strokeStyle = ground; ctx.fillStyle = ink; ctx.textAlign = "center";
      cand.sort((p, q) => q[4] - p[4] || ptmScore(A[q[0]]) - ptmScore(A[p[0]]));
      const placed = [];
      for (const [i, x, y0, rr] of cand) {
        const fs = Math.min(17, rr * .5); ctx.font = `400 ${fs}px "Instrument Serif", Georgia, serif`;
        const y = y0 + rr + 11, w = ctx.measureText(A[i].n).width + 8;
        if (w > Math.max(rr * 3.8, 80)) continue;   // wider than about two cells: wait for a closer zoom
        const b = [x - w / 2 - 6, y - fs * 1.1, x + w / 2 + 6, y + fs * .6];
        if (placed.some(q => b[0] < q[2] && b[2] > q[0] && b[1] < q[3] && b[3] > q[1])) continue;
        placed.push(b); ctx.strokeText(A[i].n, x, y); ctx.fillText(A[i].n, x, y);
      }
    }
  }
  function tick(now) {
    raf = 0; if (dead) return;
    if (glide) { const t = Math.min(1, (now - glide.t0) / glide.dur), e = 1 - Math.pow(1 - t, 3); view.s = glide.s0 + (glide.s1 - glide.s0) * e; view.tx = glide.x0 + (glide.x1 - glide.x0) * e; view.ty = glide.y0 + (glide.y1 - glide.y0) * e; if (t >= 1) glide = null; dirty = true; }
    else if (Math.abs(vx) + Math.abs(vy) > .15 && !drag) { view.tx += vx; view.ty += vy; vx *= .92; vy *= .92; clampView(); dirty = true; centerSoon(); }
    if (now - fadeT0 < 420) dirty = true;
    if (dirty) draw(now);
    if (dirty || glide || Math.abs(vx) + Math.abs(vy) > .15 || now - fadeT0 < 420) kick();
  }
  const kick = () => { if (!raf && !dead) raf = requestAnimationFrame(tick); };
  const redraw = () => { dirty = true; kick(); };

  // ---- hit testing, the caption, the tip ----
  const worldOf = (px, py) => [(px - view.tx) / view.s, (py - view.ty) / view.s];
  function hit(px, py, slack = .15) {
    let best = -1, bd = 1e18;
    for (const [i, x, y, rr] of vis) { const d = (x - px) ** 2 + (y - py) ** 2, lim = (rr * (1 + slack * 2)) ** 2; if (d < lim && d < bd) { bd = d; best = i; } }
    if (vis.length) return best;
    return hitWorld(px, py, slack);
  }
  function hitWorld(px, py, slack) {
    const [wx, wy] = worldOf(px, py), cx = Math.floor(wx / 2), cy = Math.floor(wy / 2); let best = -1, bd = (.5 + slack) ** 2;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const L = hash.get((cx + a) * 100003 + cy + b); if (!L) continue; for (const i of L) { const d = (lay.x[i] - wx) ** 2 + (lay.y[i] - wy) ** 2; if (d < bd) { bd = d; best = i; } } }
    return best;
  }
  function nearestCenter() {
    const [wx, wy] = worldOf(W / 2, topPad() + (H - topPad() - botPad()) / 2); const cx = Math.floor(wx / 2), cy = Math.floor(wy / 2); let best = -1, bd = 1e9;
    for (let r = 0; r < 12 && best < 0; r++) for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) { if (Math.max(Math.abs(a), Math.abs(b)) !== r) continue; const L = hash.get((cx + a) * 100003 + cy + b); if (!L) continue; for (const i of L) { const d = (lay.x[i] - wx) ** 2 + (lay.y[i] - wy) ** 2; if (d < bd) { bd = d; best = i; } } }
    return best;
  }
  let capT = 0;
  const centerSoon = () => { clearTimeout(capT); capT = setTimeout(caption, 90); };
  function caption() {
    const cap = $("[data-ptcap]"); if (!ids.length) { cap.hidden = true; return; }
    const i = sel; if (i < 0) { cap.hidden = true; return; }
    centerI = i; const r = A[i];
    cap.hidden = false; cap.style.setProperty("--c", r.sig);
    $("[data-ptct]").textContent = r.n;
    $("[data-ptcb]").textContent = [ptmYears(r), r.co, ptmNum(r.k) + " paintings"].filter(Boolean).join(" · ");
  }
  function tip(i, px, py) {
    const t = $("[data-pttip]"); if (i < 0) { t.hidden = true; return; }
    const r = A[i]; t.hidden = false;
    t.innerHTML = `<b>${esc(r.n)}</b><small>${esc([ptmYears(r), r.co].filter(Boolean).join(" · "))}</small>`;
    const w = t.offsetWidth, x = Math.max(8, Math.min(W - w - 8, px - w / 2)), y = Math.max(topPad() - 10, py - view.s * .5 - t.offsetHeight - 10);
    t.style.left = x + "px"; t.style.top = y + "px";
  }
  function openPainter(i) {
    if (i < 0) return; buzz(8);
    PTM_VIEW.set(vkey(), { ...view });
    awPainter(A[i].s);
  }

  // ---- pointers: drag, pinch, wheel, tap opens, long press peeks, hover peeks ----
  let drag = null, pts = new Map(), pinch = null, lpT = 0, moved = false, lastMove = 0;
  cv.addEventListener("pointerdown", e => {
    try { cv.setPointerCapture(e.pointerId); } catch (er) {} pts.set(e.pointerId, [e.clientX, e.clientY]); glide = null; vx = vy = 0; moved = false;
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), s: view.s, mx: (a[0] + b[0]) / 2, my: (a[1] + b[1]) / 2 }; drag = null; clearTimeout(lpT); return; }
    const r = cv.getBoundingClientRect(); drag = { x: e.clientX, y: e.clientY, px: e.clientX - r.left, py: e.clientY - r.top, id: e.pointerId, t: performance.now() };
    clearTimeout(lpT);
    lpT = setTimeout(() => { if (drag && !moved) { const i = hit(drag.px, drag.py, .3); if (i >= 0) { buzz(10); sel = i; drag.peek = true; tip(i, drag.px, drag.py); caption(); redraw(); } } }, 380);
  });
  cv.addEventListener("pointermove", e => {
    const r = cv.getBoundingClientRect();
    if (pts.has(e.pointerId)) pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pinch && pts.size >= 2) {
      const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]), ns = Math.max(minS, Math.min(160, pinch.s * d / pinch.d)), mx = (a[0] + b[0]) / 2 - r.left, my = (a[1] + b[1]) / 2 - r.top;
      const [wx, wy] = worldOf(mx, my); view.s = ns; view.tx = mx - wx * ns; view.ty = my - wy * ns; clampView(); redraw(); centerSoon(); return;
    }
    if (drag && e.pointerId === drag.id) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!moved && Math.hypot(dx, dy) > 6) { moved = true; clearTimeout(lpT); if (sel >= 0 && drag.peek) { sel = -1; tip(-1); } }
      if (moved) { view.tx += dx; view.ty += dy; vx = dx; vy = dy; drag.x = e.clientX; drag.y = e.clientY; clampView(); redraw(); centerSoon(); }
      return;
    }
    if (e.pointerType === "mouse" && !pts.size) {   // hover on a desktop: the name, and the lens follows the mouse
      const now = performance.now(); if (now - lastMove < 16) return; lastMove = now;
      const mx = e.clientX - r.left, my = e.clientY - r.top, lens = (s.mag == null ? ptmMag() : s.mag) > 0;
      if (lens) { focus = [mx, my]; draw(now); }
      const i = hit(mx, my); if (i !== hover) { hover = i; tip(i, mx, my); cv.style.cursor = i >= 0 ? "pointer" : ""; redraw(); }
    }
  });
  const up = e => {
    pts.delete(e.pointerId); clearTimeout(lpT);
    if (pinch) { if (pts.size < 2) pinch = null; drag = null; PTM_VIEW.set(vkey(), { ...view }); return; }
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag; drag = null;
    if (d.peek) { const t = $("[data-pttip]"); setTimeout(() => { if (sel >= 0) { sel = -1; tip(-1); caption(); redraw(); } }, 2600); return; }   // a long press peeks, then lets go
    if (!moved && performance.now() - d.t < 600) { const i = hit(d.px, d.py); if (i >= 0) { sel = -1; openPainter(i); return; } sel = -1; tip(-1); caption(); redraw(); }
    PTM_VIEW.set(vkey(), { ...view }); kick();
  };
  cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
  cv.addEventListener("pointerleave", e => { if (e.pointerType === "mouse") { focus = null; hover = -1; tip(-1); redraw(); } });
  cv.addEventListener("wheel", e => {
    e.preventDefault(); const r = cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top, [wx, wy] = worldOf(mx, my);
    const ns = Math.max(minS, Math.min(160, view.s * Math.exp(-e.deltaY * (e.ctrlKey ? .01 : .0018)))); view.s = ns; view.tx = mx - wx * ns; view.ty = my - wy * ns; clampView(); PTM_VIEW.set(vkey(), { ...view }); redraw(); centerSoon();
  }, { passive: false });
  $("[data-ptopen]").onclick = () => openPainter(centerI);
  function flyTo(i, sNew) {
    const s1 = Math.max(view.s, sNew || 64); glide = { t0: performance.now(), dur: 520, s0: view.s, s1, x0: view.tx, y0: view.ty, x1: W / 2 - lay.x[i] * s1, y1: topPad() + (H - topPad() - botPad()) / 2 - lay.y[i] * s1 }; kick();
  }

  // ---- search ----
  const fbox = $("[data-ptfind]"), fq = $("[data-ptq]"), flist = $("[data-ptlist]");
  const norm = A.map(r => ptmNorm(r.n));
  function runFind() {
    const q = ptmNorm(fq.value); if (!q) { flist.innerHTML = ""; return; }
    const toks = q.split(" "), res = [];
    for (let i = 0; i < A.length && res.length < 40; i++) { const n = norm[i]; if (toks.every(t => n.includes(t))) res.push([i, n.startsWith(q) ? 0 : n.split(" ").some(w => w.startsWith(toks[0])) ? 1 : 2]); }
    res.sort((a, b) => a[1] - b[1] || A[b[0]].k - A[a[0]].k);
    flist.innerHTML = res.length ? res.slice(0, 7).map(([i]) => `<button type="button" class="ptm-row" role="option" data-ptpick="${i}"><i style="--c:${A[i].sig}"></i><span><b>${esc(A[i].n)}</b><small>${esc([ptmYears(A[i]), A[i].co].filter(Boolean).join(" · "))}</small></span></button>`).join("")
      : `<p class="ptm-none">No painter called “${esc(fq.value.trim())}”. Try the last name.</p>`;
  }
  $("[data-ptfindb]").onclick = () => { buzz(4); fbox.hidden = false; fq.value = ""; flist.innerHTML = ""; setTimeout(() => fq.focus(), 40); };
  $("[data-ptfindx]").onclick = () => { fbox.hidden = true; fq.blur(); };
  fq.oninput = runFind;
  flist.onclick = e => {
    const b = e.target.closest("[data-ptpick]"); if (!b) return; buzz(6);
    const i = +b.dataset.ptpick; fbox.hidden = true; fq.blur();
    if (isNaN(lay.x[i])) { s.min = 6; s.only = "all"; s.near = ""; PTM_STATE.set(from, s); rebuild(); }   // a filter was hiding them: show everyone
    sel = i; flyTo(i, 70); caption(); redraw(); tip(-1);
    setTimeout(() => { if (sel === i) { sel = -1; caption(); redraw(); } }, 4200);
  };

  // ---- chips and states ----
  function chips() {
    const c = $("[data-ptchips]"), parts = [], x = (k, label, sw) => `<button class="pmx-xchip" data-ptclear="${k}" aria-label="Clear: ${esc(label)}">${sw ? `<span class="ptm-sw" style="--c:${sw}"></span>` : ""}${esc(label)}<i>${ICON.x}</i></button>`;
    if (s.near) parts.push(x("near", "Painters who reach for this color", s.near));
    if (lay.skipped) parts.push(`<span class="pmx-xchip ptm-note">${ptmNum(lay.skipped)} painters have no movement on record</span>`);
    if (s.min > 6) parts.push(x("min", ptmNum(s.min) + "+ paintings"));
    if (s.only !== "all") parts.push(x("only", s.only === "portrait" ? "With a portrait" : "With famous works"));
    c.hidden = !parts.length; c.innerHTML = parts.join("");
    c.querySelectorAll("[data-ptclear]").forEach(b => b.onclick = () => { buzz(5); const k = b.dataset.ptclear; if (k === "near") s.near = ""; if (k === "min") s.min = 6; if (k === "only") s.only = "all"; rebuild(); });
  }
  function empty() {
    const e = $("[data-ptempty]");
    if (ids.length) { e.hidden = true; return; }
    e.hidden = false; e.innerHTML = `<b>No painters match</b><p>Nobody has ${ptmNum(s.min)}+ paintings${s.only === "portrait" ? " and a portrait" : s.only === "famous" ? " and famous works" : ""} here.</p><button type="button" class="pmx-ebtn" data-ptreset>Show everyone</button>`;
    e.querySelector("[data-ptreset]").onclick = () => { s.min = 6; s.only = "all"; s.near = ""; rebuild(); };
  }
  function rebuild(keepView) {
    sel = -1; tip(-1); ensure(); if (!keepView) place(); else clampView(); fadeT0 = performance.now() - 380; caption(); redraw();
  }

  // ---- the ⋯ sheet ----
  function openSheet() {
    if (document.querySelector(".sheet")) return;
    if (typeof stemJustClosed === "function" && stemJustClosed()) return;
    const maxK = Math.max(...A.map(r => r.k)), seg = (id, arr, cur, label) => `<div class="hm-seg ptm-seg" role="radiogroup" aria-label="${label}">${arr.map(([k, t]) => `<button class="${cur === k ? "on" : ""}" data-pt${id}="${k}" title="${esc(PTM_FACE_WHY[k] || "")}" role="radio" aria-checked="${cur === k}">${esc(t)}</button>`).join("")}</div>`;
    const { sh, close } = sheet(`<div class="hm-chooser pmx-chooser"><div class="hm-ch-head" data-sheet-grab><b class="ptm-sh-t">Painters</b><button class="iconq hm-ch-x" data-sheet-close aria-label="Close">${ICON.x}</button></div><div class="hm-ch-scroll" data-sheet-scroll data-ptbody></div></div>`, { lock: false });
    sh.classList.add("pmx-sheet", "hm-sheet-panel", "hm-sheet-arrange"); sh.setAttribute("aria-label", "Arrange the painter map");
    const scrim = sh.previousElementSibling; if (scrim && scrim.classList.contains("scrim")) scrim.classList.add("hm-scrim-clear");
    sh.querySelectorAll("[data-sheet-close]").forEach(b => b.onclick = () => { buzz(4); close(); });
    const body = sh.querySelector("[data-ptbody]");
    const render = () => {
      body.innerHTML = `
        <div class="cx-sec"><b>Position</b></div>
        <div class="hm-arr pmx-arr ptm-arr" role="radiogroup" aria-label="Arrange by">${PTM_ARR.map(([k, t]) => `<button class="hm-arr-b${s.arr === k ? " on" : ""}" data-ptarr="${k}" role="radio" aria-checked="${s.arr === k}"><span class="hm-arr-pic">${PTM_ICON[k]}</span><b>${esc(t)}</b></button>`).join("")}</div>
        <div class="cx-sec"><b>Each painter shown as</b></div>${seg("face", PTM_FACE, faceOf(), "Cell face")}
        <div class="cx-sec"><b>Show</b></div>${seg("only", [["all", "Everyone"], ["famous", "Famous works"], ["portrait", "A portrait"]], s.only, "Show")}
        <div class="hm-feel"><label class="hm-feel-row"><span class="hm-feel-l">At least</span><span class="hm-feel-r"><i>6</i><input type="range" min="6" max="${Math.min(300, maxK)}" step="1" value="${s.min}" data-ptmin aria-label="Fewest paintings"><i>${Math.min(300, maxK)}</i></span></label></div>
        <p class="hm-arr-sub" data-ptminl>${ptmNum(ids.length)} painters${s.min > 6 ? ` with ${s.min}+ paintings` : ""}</p>
        <div class="hm-feel"><label class="hm-feel-row"><span class="hm-feel-l">Magnify</span><span class="hm-feel-r"><i>Flat</i><input type="range" min="0" max="1" step="0.01" value="${s.mag == null ? ptmMag() : s.mag}" data-ptmag aria-label="Magnify, flat to strong"><i>Strong</i></span></label></div>`;
      body.querySelectorAll("[data-ptarr]").forEach(b => b.onclick = () => { if (s.arr === b.dataset.ptarr) return; buzz(5); s.arr = b.dataset.ptarr; s.near = s.arr === "color" ? s.near : ""; rebuild(); render(); });
      body.querySelectorAll("[data-ptface]").forEach(b => b.onclick = () => { buzz(5); s.face = b.dataset.ptface; try { localStorage.setItem("ptm-face", s.face); } catch (e) {} redraw(); render(); });
      body.querySelectorAll("[data-ptonly]").forEach(b => b.onclick = () => { buzz(5); s.only = b.dataset.ptonly; rebuild(); render(); });
      const rg = body.querySelector("[data-ptmin]");
      rg.oninput = () => { s.min = +rg.value; ids = ptmIds(s); body.querySelector("[data-ptminl]").textContent = `${ptmNum(ids.length)} painters${s.min > 6 ? ` with ${s.min}+ paintings` : ""}`; };
      rg.onchange = () => { rebuild(); render(); };
      const mg = body.querySelector("[data-ptmag]");
      mg.oninput = () => { s.mag = +mg.value; try { localStorage.setItem("ptm-mag", s.mag); } catch (e) {} redraw(); };
    };
    render();
  }
  $("[data-do-corner]").onclick = () => { buzz(5); openSheet(); };

  // ---- go ----
  A.forEach((r, i) => { r._i = i; });
  size(); readTheme(); ensure(); place(true);
  $(".pmx-wait").hidden = true;
  const ro = new ResizeObserver(() => { const w = W, h = H; size(); if (w < 100 || h < 100) { PTM_VIEW.delete(vkey()); place(); } if (Math.abs(w - W) > 1 || Math.abs(h - H) > 1) { clampView(); caption(); redraw(); } }); ro.observe(stage);
  const mq = matchMedia("(prefers-color-scheme: dark)"), onTheme = () => { readTheme(); redraw(); }; mq.addEventListener && mq.addEventListener("change", onTheme);
  cleanup.push(() => { dead = true; cancelAnimationFrame(raf); ro.disconnect(); clearTimeout(lpT); clearTimeout(capT); mq.removeEventListener && mq.removeEventListener("change", onTheme); });
  // draw a first frame the moment the structure is ready; faces fade in when their sheet is decoded
  if (s.p && D.ix.has(s.p)) { const i = D.ix.get(s.p); if (!isNaN(lay.x[i])) { sel = i; flyTo(i, 70); } }
  caption(); draw(performance.now()); kick();
  const mo = new MutationObserver(() => { if (!el.isConnected) { cleanup.forEach(f => f()); mo.disconnect(); } }); mo.observe(document.body, { childList: true, subtree: true });
  el._ptm = { s, redraw, get lay() { return lay; }, get view() { return view; }, set view(v) { view = v; clampView(); redraw(); }, flyTo, get ids() { return ids; } };
}

document.addEventListener("click", e => {
  const b = e.target.closest && e.target.closest("[data-ptmap]"); if (!b) return;
  e.preventDefault(); e.stopPropagation(); buzz(6); ptmGo(b.dataset.ptmap);
}, true);
