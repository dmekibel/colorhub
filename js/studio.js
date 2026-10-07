"use strict";
// Palette Studio: make a palette three ways (camera, photo, gamut wheel), see it in a few views, keep it.
// The gamut wheel follows the painter's "gamut mask" idea (James Gurney; Peter Donahue's Color Fidget and
// ColorDisk): lay a shape on a perceptual color wheel and the colors inside it are your palette.

// ---------- OKLab (Björn Ottosson, 2020): a color space where equal steps look roughly equal ----------
const lin8 = v => { v /= 255; return v > .04045 ? ((v + .055) / 1.055) ** 2.4 : v / 12.92; };
function oklabRgb(r, g, b) {   // linear sRGB -> OKLab
  const l = Math.cbrt(.4122214708 * r + .5363325363 * g + .0514459929 * b), m = Math.cbrt(.2119034982 * r + .6806995451 * g + .1073969566 * b), s = Math.cbrt(.0883024619 * r + .2817188376 * g + .6299787005 * b);
  return [.2104542553 * l + .793617785 * m - .0040720468 * s, 1.9779984951 * l - 2.428592205 * m + .4505937099 * s, .0259040371 * l + .7827717662 * m - .808675766 * s];
}
function oklabToLin(L, a, b) {
  const l = (L + .3963377774 * a + .2158037573 * b) ** 3, m = (L - .1055613458 * a - .0638541728 * b) ** 3, s = (L - .0894841775 * a - 1.291485548 * b) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + .2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - .3413193965 * s, -.0041960863 * l - .7034186147 * m + 1.707614701 * s];
}
const okIn = (L, C, h) => oklabToLin(L, C * Math.cos(h), C * Math.sin(h)).every(v => v >= -1e-4 && v <= 1.0001);
const enc8 = v => Math.round(clamp(v > .0031308 ? 1.055 * v ** (1 / 2.4) - .055 : 12.92 * v, 0, 1) * 255);
const okHex = (L, C, h) => "#" + oklabToLin(L, C * Math.cos(h), C * Math.sin(h)).map(v => enc8(v).toString(16).padStart(2, "0")).join("").toUpperCase();
const hexOk = hex => oklabRgb(...rgb(hex).map(lin8));

// the most vivid screen color at each hue (the "cusp"): its lightness and strength, every 2 degrees
let CUSPS = null;
function cusps() {
  if (CUSPS) return CUSPS;
  CUSPS = [];
  for (let d = 0; d < 360; d += 2) {
    const h = d * Math.PI / 180; let best = [.7, 0];
    for (let L = .3; L <= .97; L += .01) {
      let lo = 0, hi = .4;
      for (let i = 0; i < 14; i++) { const mid = (lo + hi) / 2; if (okIn(L, mid, h)) lo = mid; else hi = mid; }
      if (lo > best[1]) best = [L, lo];
    }
    CUSPS.push(best);
  }
  return CUSPS;
}
// a point on the wheel (unit disk, y up) -> color. Rim = the most vivid color of that hue; center = a soft grey.
const GREY_L = .7;
function diskColor(x, y) {
  const r = Math.min(1, Math.hypot(x, y)), a = Math.atan2(y, x), deg = ((a * 180 / Math.PI) + 360) % 360;
  const cs = cusps(), i = Math.floor(deg / 2), f = deg / 2 - i, c0 = cs[i % 180], c1 = cs[(i + 1) % 180];
  const cL = c0[0] + (c1[0] - c0[0]) * f, cC = c0[1] + (c1[1] - c0[1]) * f;
  let L = GREY_L + (cL - GREY_L) * r, C = cC * r;
  while (C > 0 && !okIn(L, C, a)) C *= .97;
  return okHex(L, C, a);
}

// ---------- Studio home ----------
function studio() {
  const saved = S.palettes || [];
  const el = show(`
    <header class="bar"><div class="brand">${LOGO}<span>ColorHub</span></div><span class="eyebrow">Make</span></header>
    <p class="eyebrow kick">Palettes and tools</p>
    <h1 class="tab-title">The <em>Studio</em></h1>
    <div class="st-tiles">
      <button class="st-tile" data-wheel><span class="st-art st-wheel" id="mini"></span><b>Gamut wheel</b><small>Lay a shape on the wheel. What's inside is your palette.</small></button>
      <button class="st-tile" data-eye><span class="st-art st-eye"><i></i></span><b>Camera</b><small>Name what you see, or turn it into colors.</small></button>
      <label class="st-tile"><span class="st-art st-photo">${ICON_PHOTO}</span><b>From a photo</b><small>Pull the main colors out of any picture.</small><input type="file" accept="image/*" hidden id="file"></label>
    </div>
    <div class="labs st-labs">${LAB_TILES(["harmony", "contrast"])}</div>
    <div class="sec-head"><b>Your palettes</b><span>${saved.length || ""}</span></div>
    ${saved.length ? `<div class="st-saved">${saved.map((p, i) => `<button class="st-pal" data-i="${i}"><span class="strip">${p.cols.map(h => `<i style="--c:${h}"></i>`).join("")}</span><span class="st-meta"><b>${esc(p.from || "Palette")}</b><em>${esc(p.at || "")}</em></span></button>`).join("")}</div>`
      : `<p class="x-sub">Palettes you keep, from the wheel, a photo or the taste test, land here.</p>`}
  `, "studio", "studio");
  el.querySelectorAll("[data-lab]").forEach(b => b.onclick = () => LAB[b.dataset.lab]());
  el.querySelector("[data-wheel]").onclick = () => gamutWheel();
  el.querySelector("[data-eye]").onclick = () => eye();
  el.querySelector("#file").onchange = e => { const f = e.target.files[0]; if (f) loadImage(f, c => studioFromImage(c, "From a photo")); };
  el.querySelectorAll("[data-i]").forEach(b => b.onclick = () => { const p = saved[+b.dataset.i]; paletteView({ cols: p.cols.map(h => ({ h })), from: p.from, savedAt: +b.dataset.i }); });
  // a small live wheel as the tile's picture
  const mini = el.querySelector("#mini");
  requestAnimationFrame(() => {
    const box = document.createElement("span"), pts = MASKS.Warm.map(polar).map(([x, y]) => `${(x + 1) * 60},${(1 - y) * 60}`).join(" ");
    box.className = "st-mini"; box.appendChild(wheelCanvas(120));
    box.insertAdjacentHTML("beforeend", `<svg viewBox="0 0 120 120"><path d="M60 0A60 60 0 1 1 59.99 0Z M${pts.split(" ").join(" L")}Z" fill="rgba(22,21,15,.55)" fill-rule="evenodd"/><polygon points="${pts}" fill="none" stroke="#F3F3F1" stroke-width="1.2" stroke-linejoin="round"/></svg>`);
    mini.appendChild(box);
  });
}

function loadImage(file, done) {
  const img = new Image();
  img.onload = () => { const k = Math.min(1, 900 / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement("canvas"); c.width = img.naturalWidth * k; c.height = img.naturalHeight * k; c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(img.src); done(c); };
  img.onerror = () => toast("Couldn't open that image");
  img.src = URL.createObjectURL(file);
}

function wheelCanvas(size) {
  const dpr = Math.min(devicePixelRatio || 1, 2), n = Math.round(size * dpr), cv = document.createElement("canvas");
  cv.width = cv.height = n; cv.style.width = cv.style.height = size + "px";
  const x = cv.getContext("2d"), img = x.createImageData(n, n), R = n / 2, cache = new Map();
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const u = (i + .5 - R) / R, v = (R - j - .5) / R, r = Math.hypot(u, v); if (r > 1) continue;
    // quantize so the wheel renders quickly; steps are finer than the eye can see on this size
    const key = Math.round(Math.atan2(v, u) * 90) * 1000 + Math.round(r * 60);
    let hx = cache.get(key); if (!hx) { hx = rgb(diskColor(u, v)); cache.set(key, hx); }
    const p = (j * n + i) * 4, edge = clamp((1 - r) * R, 0, 1);
    img.data[p] = hx[0]; img.data[p + 1] = hx[1]; img.data[p + 2] = hx[2]; img.data[p + 3] = edge * 255;
  }
  x.putImageData(img, 0, 0);
  return cv;
}

// ---------- the gamut wheel ----------
const MASKS = {
  Warm: [[15, .92], [85, .95], [235, .28]],
  Cool: [[175, .9], [265, .92], [45, .26]],
  Triad: [[30, .86], [150, .86], [270, .86]],
  Muted: [[40, .48], [165, .42], [285, .44]],
  Complement: [[55, .92], [148, .2], [235, .92], [322, .2]],
};
const polar = ([d, r]) => [r * Math.cos(d * Math.PI / 180), r * Math.sin(d * Math.PI / 180)];
const BASIC_HUES = ["Red", "Orange", "Yellow", "Green", "Blue", "Purple", "Pink"];

function maskPalette(pts) {
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  const corners = pts.map(([x, y]) => [cx + (x - cx) * .9, cy + (y - cy) * .9]).map(([x, y]) => diskColor(x, y));
  // the mask's neutral (its center) gives the palette a light and a dark, so it has a value structure
  const [nL, na, nb] = hexOk(diskColor(cx, cy)), h = Math.atan2(nb, na), C = Math.hypot(na, nb);
  const light = okHex(.95, Math.min(C * .35, .03), h), dark = okHex(.27, Math.min(C * .6, .05), h);
  return { cols: [light, ...corners, dark], center: [cx, cy] };
}

function gamutWheel(preset = "Warm") {
  let pts = MASKS[preset].map(polar), names = !!S.wheelNames;
  const el = show(`
    <header class="art-top"><button class="icon-btn glass" data-back aria-label="Back">${ICON.back}</button><span class="eyebrow">Studio · Gamut wheel</span><span style="width:44px"></span></header>
    <div class="gw" id="gw"><canvas class="gw-mask" id="mask"></canvas><div class="gw-names" id="names"></div></div>
    <p class="gw-hint">Drag the shape to move it. Drag a corner to reshape it.</p>
    <div class="schemes">${Object.keys(MASKS).map(k => `<button class="${k === preset ? "on" : ""}" data-m="${k}">${k}</button>`).join("")}<button class="${names ? "on" : ""}" data-names>Names</button></div>
    <div class="gw-pal" id="pal"></div>
    <div class="h-list" id="hlist"></div>
    <div class="row2" style="margin-top:18px"><button class="btn" data-keep>Keep it</button><button class="btn ghost" data-open>Views & export</button></div>
    <p class="p-body">${linkText("Painters call this a gamut mask. Mix only from colors inside the shape and a picture holds together, because every color shares the same few ingredients. The idea comes from the painter James Gurney; the [[color-wheel]] here is perceptual, so colors facing each other are the eye's opposites, not the painter's-wheel pairs (see [[complementary-colors|complements]]).")}</p>
    <p class="fine">The wheel is OKLab hue (Björn Ottosson, 2020); the Harmony lab rotates CIELAB hue, so their angles differ a little. Rim: the most vivid screen color of each hue. Center: grey. The palette is the shape's corners, plus a light and a dark mixed from its middle. Inspired by <a href="https://petertdonahue.com/" target="_blank" rel="noopener">Peter Donahue (Color Nerd)</a>: his Color Fidget and ColorDisk.</p>
  `, "article lab studio");
  el.querySelector("[data-back]").onclick = () => studio();
  wireLinks(el);
  const gw = el.querySelector("#gw"), mcv = el.querySelector("#mask");
  let size = 0, cur = null;
  const setup = () => {
    size = Math.min(gw.clientWidth, 420);
    gw.querySelector(".gw-wheel")?.remove();
    const w = wheelCanvas(size); w.className = "gw-wheel"; gw.prepend(w);
    const dpr = Math.min(devicePixelRatio || 1, 2); mcv.width = mcv.height = size * dpr; mcv.style.width = mcv.style.height = size + "px";
    drawNames(); draw();
  };
  const toPx = ([x, y]) => [(x + 1) / 2 * size, (1 - y) / 2 * size];
  const drawNames = () => {
    el.querySelector("#names").innerHTML = names ? BASIC_HUES.map(n => { const [, a, b] = hexOk(BYNAME.get(n.toLowerCase()).h), d = Math.atan2(b, a), [x, y] = toPx([Math.cos(d) * 1.08, Math.sin(d) * 1.08]); return `<span style="left:${x}px;top:${y}px">${n}</span>`; }).join("") : "";
  };
  const draw = () => {
    const dpr = mcv.width / size, c = mcv.getContext("2d");
    c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, size, size);
    const P = pts.map(toPx);
    // everything outside the shape goes dark; the shape stays a clean window onto the wheel
    c.fillStyle = "rgba(14,13,11,.55)"; c.beginPath(); c.arc(size / 2, size / 2, size / 2 + 1, 0, Math.PI * 2);
    c.moveTo(P[0][0], P[0][1]); P.slice(1).forEach(p => c.lineTo(p[0], p[1])); c.closePath(); c.fill("evenodd");
    c.strokeStyle = "#F3F3F1"; c.lineWidth = 1.5; c.lineJoin = "round"; c.beginPath(); c.moveTo(P[0][0], P[0][1]); P.slice(1).forEach(p => c.lineTo(p[0], p[1])); c.closePath(); c.stroke();
    const pal = maskPalette(pts);
    P.forEach((p, i) => { c.fillStyle = pal.cols[i + 1]; c.beginPath(); c.arc(p[0], p[1], 9, 0, Math.PI * 2); c.fill(); c.strokeStyle = "#F3F3F1"; c.lineWidth = 2; c.stroke(); });
    const [qx, qy] = toPx(pal.center); c.fillStyle = "#F3F3F1"; c.beginPath(); c.arc(qx, qy, 3, 0, Math.PI * 2); c.fill();
    if (cur && cur.join() === pal.cols.join()) return;
    cur = pal.cols;
    el.querySelector("#pal").innerHTML = pal.cols.map(h => `<i style="--c:${h}"></i>`).join("");
    el.querySelector("#hlist").innerHTML = pal.cols.map((h, i) => { const { mine, long } = nameColor(h, 1), b = long[0] && (!mine[0] || long[0].d <= mine[0].d + 1.5) ? long[0] : mine[0]; return `<button class="h-item" data-copy="${h}"><i style="--c:${h}"></i><span><b>${esc(b ? b.n : h)}</b><em class="mono">${h}${i === 0 ? " · light" : i === pal.cols.length - 1 ? " · dark" : ""}</em></span></button>`; }).join("");
  };
  // dragging: a corner reshapes, the inside moves the whole shape; everything stays on the wheel
  let drag = null;
  const loc = e => { const r = mcv.getBoundingClientRect(); return [((e.clientX - r.left) / size) * 2 - 1, 1 - ((e.clientY - r.top) / size) * 2]; };
  const inside = (p, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > p[1]) !== (yj > p[1]) && p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi) c = !c; } return c; };
  const keepIn = ([x, y]) => { const r = Math.hypot(x, y); return r > 1 ? [x / r, y / r] : [x, y]; };
  mcv.addEventListener("pointerdown", e => {
    const p = loc(e), hitR = 26 / size * 2, vi = pts.findIndex(q => Math.hypot(q[0] - p[0], q[1] - p[1]) < hitR);
    if (vi >= 0) drag = { vi }; else if (inside(p, pts)) drag = { from: p, orig: pts.map(q => q.slice()) }; else return;
    mcv.setPointerCapture(e.pointerId); e.preventDefault(); buzz(4);
    el.querySelectorAll("[data-m]").forEach(x => x.classList.remove("on"));
  });
  mcv.addEventListener("pointermove", e => {
    if (!drag) return;
    const p = loc(e);
    if (drag.vi != null) pts[drag.vi] = keepIn(p);
    else { const dx = p[0] - drag.from[0], dy = p[1] - drag.from[1], moved = drag.orig.map(([x, y]) => [x + dx, y + dy]); if (moved.every(q => Math.hypot(...q) <= 1.001)) pts = moved; }
    draw();
  });
  const end = () => { drag = null; };
  mcv.addEventListener("pointerup", end); mcv.addEventListener("pointercancel", end);
  el.querySelectorAll("[data-m]").forEach(b => b.onclick = () => { pts = MASKS[b.dataset.m].map(polar); el.querySelectorAll("[data-m]").forEach(x => x.classList.toggle("on", x === b)); draw(); buzz(5); });
  el.querySelector("[data-names]").onclick = e => { names = S.wheelNames = !names; save(); e.currentTarget.classList.toggle("on", names); drawNames(); };
  el.querySelector("#hlist").addEventListener("click", e => { const b = e.target.closest("[data-copy]"); if (b) { try { navigator.clipboard.writeText(b.dataset.copy); toast("Copied " + b.dataset.copy); } catch (x) {} } });
  el.querySelector("[data-keep]").onclick = () => { keepPalette(cur, "Gamut wheel"); };
  el.querySelector("[data-open]").onclick = () => paletteView({ cols: cur.map(h => ({ h })), from: "Gamut wheel" });
  requestAnimationFrame(setup);
  addEventListener("resize", setup); cleanup.push(() => removeEventListener("resize", setup));
}

function keepPalette(cols, from) {
  S.palettes = S.palettes || [];
  if (S.palettes.some(p => p.cols.join() === cols.join())) return toast("Already kept");
  S.palettes.unshift({ cols: cols.slice(), from, at: today() }); S.palettes = S.palettes.slice(0, 60); save();
  buzz(10); toast("Kept in your palettes");
}

// ---------- palette from an image: k-means in OKLab, weighted by area ----------
function extractPalette(canvas, k) {
  const sc = Math.min(1, 140 / Math.max(canvas.width, canvas.height)), w = Math.max(1, Math.round(canvas.width * sc)), h = Math.max(1, Math.round(canvas.height * sc));
  const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d"); x.drawImage(canvas, 0, 0, w, h);
  const d = x.getImageData(0, 0, w, h).data, px = [];
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 128) px.push(oklabRgb(lin8(d[i]), lin8(d[i + 1]), lin8(d[i + 2])).concat([(i / 4) % w / w, Math.floor(i / 4 / w) / h]));
  const dist = (p, q) => (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;
  // k-means++ start with a fixed seed, so the same image always gives the same palette
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const cents = [px[Math.floor(rnd() * px.length)].slice(0, 3)];
  while (cents.length < k) {
    const ds = px.map(p => Math.min(...cents.map(cc => dist(p, cc)))), tot = ds.reduce((a, b) => a + b, 0);
    let t = rnd() * tot, i = 0; while (t > ds[i] && i < ds.length - 1) t -= ds[i++];
    cents.push(px[i].slice(0, 3));
  }
  let lab = new Array(px.length).fill(0);
  for (let it = 0; it < 12; it++) {
    lab = px.map(p => { let b = 0, bd = 1e9; cents.forEach((cc, j) => { const dd = dist(p, cc); if (dd < bd) { bd = dd; b = j; } }); return b; });
    const sum = cents.map(() => [0, 0, 0, 0]);
    px.forEach((p, i) => { const s = sum[lab[i]]; s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; s[3]++; });
    sum.forEach((s, j) => { if (s[3]) cents[j] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]]; });
  }
  const out = cents.map((cc, j) => {
    const mine = px.filter((p, i) => lab[i] === j); if (!mine.length) return null;
    // where in the picture: the pixel closest to the cluster's average color
    let best = mine[0], bd = 1e9; mine.forEach(p => { const dd = dist(p, cc); if (dd < bd) { bd = dd; best = p; } });
    const lin = oklabToLin(...cc), hx = "#" + lin.map(v => enc8(v).toString(16).padStart(2, "0")).join("").toUpperCase();
    return { h: hx, share: mine.length / px.length, at: [best[3], best[4]] };
  }).filter(Boolean);
  // k-means averages small bright details away (a red boat on a grey sea). Look for the most striking pixels that
  // no cluster explains; if there are enough of them, they replace the smallest cluster as an accent.
  if (k >= 6) {
    const chroma = p => Math.hypot(p[1], p[2]), near = p => Math.min(...cents.map(cc => dist(p, cc)));
    let cand = null, score = 0;
    for (const p of px) { const sc = chroma(p) * Math.sqrt(near(p)); if (sc > score) { score = sc; cand = p; } }
    if (cand && chroma(cand) > .09 && near(cand) > .012) {
      // the accent = pixels of the same hue that are nearly as vivid (a red drop shades from bright to dark)
      const hc = Math.atan2(cand[2], cand[1]), cc = chroma(cand), dh = p => Math.abs(((Math.atan2(p[2], p[1]) - hc + 3 * Math.PI) % (2 * Math.PI)) - Math.PI);
      const group = px.filter(p => chroma(p) > cc * .55 && dh(p) < .4);
      if (group.length >= Math.max(6, px.length * .001)) {
        const m = [0, 1, 2].map(j => group.reduce((t, p) => t + p[j], 0) / group.length), lin = oklabToLin(...m);
        out.sort((a, b) => b.share - a.share).pop();
        out.push({ h: "#" + lin.map(v => enc8(v).toString(16).padStart(2, "0")).join("").toUpperCase(), share: group.length / px.length, at: [cand[3], cand[4]], accent: true });
      }
    }
  }
  return out.sort((a, b) => b.share - a.share);
}

function studioFromImage(canvas, from) {
  const pals = {}; [3, 6, 10].forEach(k => { pals[k] = extractPalette(canvas, k); });
  paletteView({ img: canvas.toDataURL("image/jpeg", .85), pals, from });
}

// ---------- palette view: count, percentages and three looks; keep, copy or share ----------
function paletteView(p) {
  const hasImg = !!p.img, counts = hasImg ? [3, 6, 10] : null;
  let n = hasImg ? 6 : null, pct = hasImg, look = hasImg ? "weighted" : "stripes";
  const colsNow = () => hasImg ? p.pals[n] : p.cols;
  const el = show(`
    <header class="art-top"><button class="icon-btn glass" data-back aria-label="Back">${ICON.back}</button><span class="eyebrow">Studio · ${esc(p.from || "Palette")}</span><span style="width:44px"></span></header>
    ${hasImg ? `<div class="pv-img"><img src="${p.img}" alt=""><div id="dots"></div></div>` : ""}
    <div class="pv-ctrl">
      ${hasImg ? `<div class="seg" id="cnt">${counts.map(k => `<button class="${k === n ? "on" : ""}" data-n="${k}">${k}</button>`).join("")}</div>` : ""}
      <div class="seg" id="look">${[["stripes", "Stripes"], ["weighted", "By area"], ["chips", "Chips"]].filter(x => hasImg || x[0] !== "weighted").map(([k, t]) => `<button class="${k === look ? "on" : ""}" data-look="${k}">${t}</button>`).join("")}</div>
      ${hasImg ? `<button class="seg-t ${pct ? "on" : ""}" data-pct>%</button>` : ""}
    </div>
    <div class="pv-pal" id="pv"></div>
    <div class="h-list" id="hlist"></div>
    <div class="row2" style="margin-top:18px"><button class="btn" data-keep>${p.savedAt != null ? "Kept" : "Keep it"}</button><button class="btn ghost" data-share>${ICON.share} Share</button></div>
    <div class="row2" style="margin-top:10px"><button class="btn ghost" data-css>Copy as CSS</button><button class="btn ghost" data-hex>Copy hex list</button></div>
    ${p.savedAt != null ? `<button class="btn ghost" data-del style="margin-top:10px">Remove from your palettes</button>` : ""}
    ${hasImg ? `<p class="fine">Colors are grouped by similarity (k-means in OKLab) on a small copy of the image; "by area" shows how much of the picture each one covers. A small, striking color that the groups miss is added as an accent.</p>` : ""}
  `, "article studio");
  el.querySelector("[data-back]").onclick = () => studio();
  const named = h => { const { mine, long } = nameColor(h, 1), b = long[0] && (!mine[0] || long[0].d <= mine[0].d + 1.5) ? long[0] : mine[0]; return { b, m: mine[0] }; };
  const render = () => {
    const cols = colsNow();
    el.querySelector("#pv").className = "pv-pal pv-" + look;
    el.querySelector("#pv").innerHTML = cols.map(c => `<i style="--c:${c.h};--w:${look === "weighted" ? Math.max(c.share, .02) : 1}" data-ink="${ink(c.h)}">${pct && c.share != null && look !== "chips" ? `<span>${c.share < .01 ? "<1" : Math.round(c.share * 100)}%</span>` : ""}</i>`).join("");
    el.querySelector("#hlist").innerHTML = cols.map(c => { const { b, m } = named(c.h); return `<button class="h-item" data-copy="${c.h}"><i style="--c:${c.h}"></i><span><b>${esc(b ? b.n : c.h)}</b><em class="mono">${c.h}${c.accent ? " · accent" : ""}${pct && c.share != null ? ` · ${c.share < .01 ? "<1" : Math.round(c.share * 100)}%` : ""}${m && b !== m ? ` · lesson word ${esc(m.n)}` : ""}</em></span></button>`; }).join("");
    if (hasImg) el.querySelector("#dots").innerHTML = cols.map(c => `<i style="--c:${c.h};left:${c.at[0] * 100}%;top:${c.at[1] * 100}%"></i>`).join("");
  };
  loadLongNames().then(render); render();
  const seg = (sel, attr, set) => el.querySelectorAll(`${sel} [${attr}]`).forEach(b => b.onclick = () => { set(b.getAttribute(attr)); el.querySelectorAll(`${sel} [${attr}]`).forEach(x => x.classList.toggle("on", x === b)); render(); buzz(4); });
  if (hasImg) { seg("#cnt", "data-n", v => { n = +v; }); el.querySelector("[data-pct]").onclick = e => { pct = !pct; e.currentTarget.classList.toggle("on", pct); render(); }; }
  seg("#look", "data-look", v => { look = v; });
  el.querySelector("#hlist").addEventListener("click", e => { const b = e.target.closest("[data-copy]"); if (b) { try { navigator.clipboard.writeText(b.dataset.copy); toast("Copied " + b.dataset.copy); } catch (x) {} } });
  const hexes = () => colsNow().map(c => c.h);
  const copy = t => { try { navigator.clipboard.writeText(t); toast("Copied"); } catch (e) {} };
  el.querySelector("[data-css]").onclick = () => copy(":root {\n" + colsNow().map((c, i) => `  --color-${i + 1}: ${c.h}; /* ${named(c.h).b ? named(c.h).b.n : ""} */`).join("\n") + "\n}");
  el.querySelector("[data-hex]").onclick = () => copy(hexes().join(" "));
  el.querySelector("[data-keep]").onclick = e => { if (p.savedAt != null) return; keepPalette(hexes(), p.from || "Palette"); e.currentTarget.textContent = "Kept"; };
  el.querySelector("[data-share]").onclick = () => sharePalette(colsNow(), p.from, named);
  const del = el.querySelector("[data-del]");
  if (del) del.onclick = () => { S.palettes.splice(p.savedAt, 1); save(); toast("Removed"); studio(); };
}

// a 1080x1350 card: the palette as tall stripes with names
function sharePalette(cols, from, named) {
  const W = 1080, H = 1350, cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const x = cv.getContext("2d"), m = 60, top = 60, bh = 980, bw = (W - 2 * m) / cols.length;
  x.fillStyle = "#121212"; x.fillRect(0, 0, W, H);
  x.save(); x.beginPath(); x.roundRect(m, top, W - 2 * m, bh, 40); x.clip();
  cols.forEach((c, i) => { x.fillStyle = c.h; x.fillRect(m + i * bw - .5, top, bw + 1, bh); });
  x.restore();
  cols.forEach((c, i) => {
    const nm = named(c.h).b; x.save(); x.translate(m + i * bw + bw / 2 + 12, top + bh - 40); x.rotate(-Math.PI / 2);
    x.fillStyle = ink(c.h) === "dark" ? "rgba(20,19,17,.85)" : "rgba(255,255,255,.9)"; x.font = `500 ${Math.min(30, bw * .32)}px 'Geist Mono', monospace`;
    x.fillText(((nm ? nm.n : "") + "  " + c.h).toUpperCase(), 0, 0); x.restore();
  });
  x.fillStyle = "#F3F3F1"; x.font = "400 92px 'Instrument Serif', Georgia, serif"; x.fillText(from || "A palette", m, 1180);
  x.fillStyle = "#8C8A84"; x.font = "500 30px 'Geist Mono', monospace"; x.fillText("MADE IN COLORHUB", m, 1250);
  cv.toBlob(async blob => {
    const file = new File([blob], "colorhub-palette.png", { type: "image/png" });
    try { if (navigator.canShare && navigator.canShare({ files: [file] })) return await navigator.share({ files: [file] }); } catch (e) { if (e && e.name === "AbortError") return; }
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = file.name; a.click(); toast("Saved the image");
  }, "image/png");
}
LAB.studio = () => studio();
