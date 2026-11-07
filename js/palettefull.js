"use strict";
// Palette full screen (David, 2026-10-24: "we can preview the palette full screen, where the whole palette takes up the
// full screen. Can we keep that feature available in other views ... and have different types of preview modes").
// ONE viewer for every place a palette lives: a saved palette (js/setpage.js), the painting page's strip and its Pick /
// Edit sheets (js/gallery.js, js/paintzoom.js), the Palette view feed (js/paletteview.js), Studio's result
// (js/studio.js) and the archive's painter palettes (js/artwiki.js). It always previews the palette AS IT IS NOW
// (unsaved edits, the chosen count, locked colors, the order), because the caller hands over the current colors.
//
//   palFullOpen(colors, opts)    colors: ["#RRGGBB" | { h|hex, share?, name?, locked? }]
//     opts.title / subtitle / source   words in the top chip (source is the small label: "Painting", "Studio"…)
//     opts.onSave / onEdit            optional: adds a Save / Edit button in the top bar (the viewer closes first)
//     opts.startMode                  one of PF_MODES ids; else the remembered mode
//     opts.equal                      start Bands on equal widths (else widths follow share when shares are given)
//     opts.from                       the element (or rect) the viewer grows out of and shrinks back into
//   palFullBtn(label?)                the shared "Full screen" button markup (SVG expand icon + words)
//   <button data-palfull="#A,#B" data-palfull-title="…">   a ready-made trigger (delegated click, below)
//
// Eight modes, a switcher of words with tiny live thumbnails (remembered): Bands, Rows/Columns, Mosaic, Gradient,
// Circles, Poster, On a screen, Split. Tap a color for its name and hex, hold to copy; swipe or arrow keys change
// mode; N toggles names; F the browser's own full screen; H or a tap on empty space hides the chrome; Esc closes.
// Pure CSS and DOM, no image loads.

const PF_MODES = [
  { id: "bands", label: "Bands" },
  { id: "lines", label: "Stripes" },
  { id: "mosaic", label: "Mosaic" },
  { id: "gradient", label: "Gradient" },
  { id: "circles", label: "Circles" },
  { id: "poster", label: "Poster" },
  { id: "screen", label: "On a screen" },
  { id: "split", label: "Split" },
];
const PF_ICON_FULL = sv('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>', 18, 1.8);
const PF_KEY = "chromatlas-palfull";
let PF = null;   // the open viewer, or null

function pfLoad() { try { return JSON.parse(localStorage.getItem(PF_KEY)) || {}; } catch (e) { return {}; } }
function pfSave(o) { try { localStorage.setItem(PF_KEY, JSON.stringify(o)); } catch (e) {} }
function palFullBtn(label, cls) {
  return `<button type="button" class="pf-btn ${cls || ""}" data-pf-open aria-label="View the palette full screen">${PF_ICON_FULL}<span>${label || "Full screen"}</span></button>`;
}

// a ready-made, labeled trigger that sits right under a `.palette` strip and grows out of it
function palFullLink(hexes, title, source) {
  return `<button type="button" class="pf-btn pf-link" data-palfull="${(hexes || []).join(",")}" data-palfull-title="${esc(title || "Palette")}" data-palfull-source="${esc(source || "")}" data-palfull-from=".palette">${PF_ICON_FULL}<span>Full screen</span></button>`;
}

// ---------- helpers ----------
function pfNorm(colors, o = {}) {
  const out = (colors || []).map(c => typeof c === "string" ? { hex: c } : { hex: c.hex || c.h, share: c.share, name: c.name || c.n, locked: !!c.locked })
    .map(c => ({ ...c, hex: String(c.hex).toUpperCase() })).filter(c => /^#[0-9A-F]{6}$/.test(c.hex)).slice(0, 20);
  const haveShare = out.length > 1 && out.every(c => typeof c.share === "number" && c.share > 0);
  out.forEach(c => { c.w = haveShare ? Math.max(c.share, .02) : 1; });
  out.hasShare = haveShare;
  // a plain palette (no area widths, nothing hand-ordered or locked) opens in the gradient order (js/palorder.js)
  if (!o.keepOrder && (!haveShare || o.equal) && !out.some(c => c.locked) && typeof palOrderItems === "function") { const r = palOrderItems(out, c => c.hex); r.hasShare = haveShare; return r; }
  return out;
}
const pfName = c => { if (c.name) return c.name; try { const n = nameOf(c.hex); return n.text || n.n || c.hex; } catch (e) { return c.hex; } };
const pfL = hex => lab(hex)[0];
const pfC = hex => { const l = lab(hex); return Math.hypot(l[1], l[2]); };
function pfAverage(cols) {
  const t = cols.reduce((a, c) => a + c.w, 0) || 1, m = [0, 0, 0];
  cols.forEach(c => { const l = lab(c.hex); m[0] += l[0] * c.w / t; m[1] += l[1] * c.w / t; m[2] += l[2] * c.w / t; });
  return labHex(m[0], m[1], m[2]).toUpperCase();
}
function pfRoles(cols) {
  const byL = cols.slice().sort((a, b) => pfL(a.hex) - pfL(b.hex));
  const light = byL[byL.length - 1].hex, dark = byL[0].hex;
  // a calm ground: the lightest color when it is truly light, else the darkest
  const bg = pfL(light) >= 72 ? light : pfL(dark) <= 28 ? dark : light;
  const others = cols.map(c => c.hex).filter(h => h !== bg);
  const text = others.slice().sort((a, b) => contrastRatio(b, bg) - contrastRatio(a, bg))[0];
  const textOk = text && contrastRatio(text, bg) >= 4.5 ? text : (ink(bg) === "dark" ? "#141311" : "#FFFFFF");
  const chroma = others.slice().sort((a, b) => pfC(b) - pfC(a));
  const accent = chroma[0] || textOk, accent2 = chroma.find(h => h !== accent && pfC(h) > 8) || accent;
  const surface = others.filter(h => h !== textOk && h !== accent).sort((a, b) => Math.abs(pfL(a) - pfL(bg)) - Math.abs(pfL(b) - pfL(bg)))[0] || (ink(bg) === "dark" ? "#FFFFFF" : "#000000");
  const surf = Math.abs(pfL(surface) - pfL(bg)) < 4 ? labHex(Math.max(0, Math.min(100, pfL(bg) + (pfL(bg) > 50 ? -5 : 7))), ...lab(bg).slice(1)) : surface;
  return { bg, text: textOk, accent, accent2, surface: surf, onAccent: ink(accent) === "dark" ? "#141311" : "#FFFFFF" };
}

// ---------- renderers: (cols, o) -> { html, top } ; o = { w, h, thumb, names, opt } ----------
const pfLabel = (c, o, big) => o.thumb || !o.names ? "" :
  `<span class="pf-tag${big ? " big" : ""}"><b>${esc(pfName(c))}</b><i>${c.hex}${c.locked ? " · locked" : ""}</i></span>`;
const pfItem = (c, i, o, style, inner, cls) =>
  `<div class="pf-it ${cls || ""}" data-i="${i}" data-ink="${ink(c.hex)}" style="--c:${c.hex};${style || ""}">${inner || ""}${pfLabel(c, o)}</div>`;

const PF_R = {
  bands(cols, o) {
    const rows = o.w < o.h ? cols.length > 3 : false;   // landscape: columns; portrait: columns for 2-3, rows for more
    const eq = o.opt.eq === true || !cols.hasShare;
    return { top: cols[0].hex, html: `<div class="pf-flex ${rows ? "col" : "row"}">${cols.map((c, i) => pfItem(c, i, o, `flex:${eq ? 1 : c.w}`)).join("")}</div>` };
  },
  lines(cols, o) {
    const dir = o.opt.dir || (o.w < o.h ? "columns" : "rows"), col = dir === "rows";
    const vert = !col && cols.length > 7 && o.w < 700;
    return { top: cols[0].hex, html: `<div class="pf-flex ${col ? "col" : "row"}${vert ? " vert" : ""}">${cols.map((c, i) => pfItem(c, i, o, "flex:1", "", "lines")).join("")}</div>` };
  },
  mosaic(cols, o) {
    const n = cols.length, r = Math.max(1, Math.min(n, Math.round(Math.sqrt(n * o.h / o.w)))), per = [];
    for (let i = 0; i < r; i++) per.push(Math.floor(n / r) + (i < n % r ? 1 : 0));
    let k = 0;
    return { top: cols[0].hex, html: `<div class="pf-flex col">${per.map(cnt => `<div class="pf-flex row" style="flex:1">${cols.slice(k, k += cnt).map((c, j) => pfItem(c, k - cnt + j, o, "flex:1", "", "tile")).join("")}</div>`).join("")}</div>` };
  },
  gradient(cols, o) {
    const dir = o.w < o.h ? "to bottom" : "to right", n = cols.length, steps = o.opt.steps === true;
    let bg;
    if (n === 1) bg = cols[0].hex;
    else if (steps) bg = `linear-gradient(${dir},${cols.map((c, i) => `${c.hex} ${(i / n * 100).toFixed(2)}% ${((i + 1) / n * 100).toFixed(2)}%`).join(",")})`;
    else bg = `linear-gradient(${dir} in oklab,${cols.map((c, i) => `${c.hex} ${(i / Math.max(1, n - 1) * 100).toFixed(2)}%`).join(",")})`;
    const vert = o.w < o.h;
    const tags = o.thumb || !o.names ? "" : cols.map((c, i) => {
      const at = steps ? (i + .5) / n : (n === 1 ? .5 : i / (n - 1)), pos = (vert ? at : Math.max(.07, Math.min(.93, at))) * 100;
      return `<div class="pf-gtag" data-i="${i}" data-ink="${ink(c.hex)}" style="${vert ? `--f:${(pos / 100).toFixed(4)}` : `left:${pos}%`}"><span class="pf-dot" style="--c:${c.hex}"></span>${pfLabel(c, o)}</div>`;
    }).join("");
    return { top: cols[0].hex, html: `<div class="pf-grad ${vert ? "v" : "h"}" style="background:${bg}">${tags}</div>`, raw: true };
  },
  circles(cols, o) {
    const avg = pfAverage(cols), n = cols.length, W = o.w, topPad = o.thumb ? 0 : (o.top || 0), botPad = o.thumb ? 0 : (o.bh || 0), H = Math.max(80, o.h - topPad - botPad), m = Math.min(W, H);
    const mx = Math.max(...cols.map(c => c.w)), order = cols.map((c, i) => i).sort((a, b) => cols[b].w - cols[a].w);
    const base = m * (n <= 4 ? .62 : n <= 8 ? .5 : .4), cx = W / 2, cy = topPad + H / 2, R = (Math.max(W, H) / 2 - base * .3) * .9;
    const eq = !cols.hasShare;
    const pts = cols.map((c, i) => {
      const rank = order.indexOf(i), a = rank * 2.39996, rr = n === 1 ? 0 : R * Math.sqrt((rank + .6) / (n + .2)) * .78;
      const d = base * (eq ? .72 : Math.max(.3, Math.sqrt(c.w / mx))) * (n > 8 ? .8 : 1);
      const x = cx + Math.cos(a) * rr * (W >= H ? 1.12 : .8), y = cy + Math.sin(a) * rr * (W >= H ? .82 : 1.1);
      return { i, d, x: Math.max(d / 2 + 4, Math.min(W - d / 2 - 4, x)), y: Math.max(topPad + d / 2 + 4, Math.min(topPad + H - d / 2 - 4, y)) };
    });
    const html = pts.sort((p, q) => q.d - p.d).map(p => {
      const c = cols[p.i];
      return `<div class="pf-circ" data-i="${p.i}" data-ink="${ink(c.hex)}" style="--c:${c.hex};width:${p.d.toFixed(1)}px;height:${p.d.toFixed(1)}px;left:${(p.x - p.d / 2).toFixed(1)}px;top:${(p.y - p.d / 2).toFixed(1)}px">${o.thumb || !o.names || p.d < 70 ? "" : `<span class="pf-tag center"><b>${esc(pfName(c))}</b><i>${c.hex}</i></span>`}</div>`;
    }).join("");
    return { top: avg, html: `<div class="pf-circs" style="background:${avg}" data-bg>${html}</div>`, raw: true, bg: avg };
  },
  poster(cols, o) {
    const n = cols.length, port = o.w < o.h, pc = port ? (n <= 3 ? 1 : n <= 8 ? 2 : 3) : (n <= 4 ? n : n <= 8 ? 4 : n <= 12 ? 6 : 7);
    const paper = "#F4F1EA";
    const chips = cols.map((c, i) => `<div class="pf-chip" data-i="${i}"><i style="--c:${c.hex}"></i>${o.thumb || !o.names ? "" : `<p><b>${esc(pfName(c))}</b><em>${c.hex}</em></p>`}</div>`).join("");
    const head = o.thumb ? "" : `<div class="pf-poster-h"><h2>${esc(o.title || "Palette")}</h2><p>${n} ${n === 1 ? "color" : "colors"}${o.source ? " · " + esc(o.source) : ""}</p></div>`;
    return { top: paper, html: `<div class="pf-poster" style="--pc:${pc}" data-bg>${head}<div class="pf-chips">${chips}</div></div>`, raw: true, bg: paper };
  },
  screen(cols, o) {
    const r = pfRoles(cols);
    if (o.thumb) return { top: r.bg, bg: "#151412", html: `<div class="pf-th-scr" style="--bg:${r.bg};--ac:${r.accent};--tx:${r.text}"><i></i><b></b><u></u></div>`, raw: true };
    const poster = o.opt.kind === "poster", land = o.w >= o.h;
    const bars = cols.map((c, i) => `<i data-i="${i}" style="--c:${c.hex};height:${30 + (i * 37 % 60)}%"></i>`).join("");
    const dots = cols.slice(0, 4).map((c, i) => `<li><i style="--c:${c.hex}"></i><span><b>${["Morning light", "Quiet hours", "Studio time", "Evening walk"][i]}</b><em>${["8:30", "11:00", "14:15", "18:40"][i]}</em></span></li>`).join("");
    const css = `--bg:${r.bg};--tx:${r.text};--ac:${r.accent};--ac2:${r.accent2};--sf:${r.surface};--onac:${r.onAccent}`;
    const html = poster
      ? `<div class="pf-mock-poster" style="${css}"><div class="pf-mp-top"><span>${esc((o.title || "Palette").toUpperCase())}</span><span>${new Date().getFullYear()}</span></div><h2>${esc(o.title || "Color in use")}</h2><div class="pf-mp-art">${cols.slice(0, 7).map((c, i) => `<i data-i="${i}" style="--c:${c.hex};--k:${i}"></i>`).join("")}</div><p>A calm layout, set in your colors.</p><span class="pf-mp-btn">Read more</span></div>`
      : `<div class="pf-mock ${land ? "wide" : ""}" style="${css}">
          ${land ? `<nav><b>Atlas</b><span class="on">Today</span><span>Library</span><span>Studio</span><span>Settings</span></nav>` : ""}
          <div class="pf-m-main">
            <div class="pf-m-bar"><span>Today</span><i style="--c:${r.accent}"></i></div>
            <div class="pf-m-card"><small>Good morning</small><h3>Your week in color</h3><p>Seven small moments, one palette.</p><span class="pf-m-btn">Start looking</span></div>
            <div class="pf-m-chart">${bars}</div>
            <ul class="pf-m-list">${dots}</ul>
          </div>
          ${land ? "" : `<div class="pf-m-tabs"><span class="on">Today</span><span>Library</span><span>Studio</span></div>`}
        </div>`;
    return { top: poster ? r.bg : "#151412", html: `<div class="pf-screen" data-bg>${html}</div>`, raw: true, bg: "#151412" };
  },
  split(cols, o) {
    const byL = cols.slice().sort((a, b) => pfL(a.hex) - pfL(b.hex)), d = byL[0], l = byL[byL.length - 1];
    const ratio = contrastRatio(d.hex, l.hex), grade = ratio >= 7 ? "passes AAA" : ratio >= 4.5 ? "passes AA" : ratio >= 3 ? "large text only" : "too close for text";
    const half = (c, other, i) => `<div class="pf-it half" data-i="${cols.indexOf(c)}" data-ink="${ink(c.hex)}" style="--c:${c.hex};flex:1"><div class="pf-aa" style="color:${other.hex}">Aa</div>${o.thumb ? "" : (o.names ? pfLabel(c, o) : "")}</div>`;
    return { top: d.hex, html: `<div class="pf-flex ${o.w < o.h ? "col" : "row"}">${half(d, l)}${half(l, d)}${o.thumb ? "" : `<div class="pf-ratio"><b>${ratio.toFixed(1)} : 1</b><span>${grade}</span></div>`}</div>`, raw: false };
  },
};

// ---------- the viewer ----------
function palFullOpen(colors, opts = {}) {
  if (PF) return;
  const cols = pfNorm(colors, opts); if (!cols.length) return;
  const pref = pfLoad(), reduce = typeof reduceMotion !== "undefined" && reduceMotion;
  const st = {
    mode: PF_MODES.some(m => m.id === opts.startMode) ? opts.startMode : (PF_MODES.some(m => m.id === pref.mode) ? pref.mode : "bands"),
    names: pref.names !== false, chrome: true, sel: -1, opt: { eq: opts.equal === true || pref.eq === true, dir: pref.dir || null, steps: pref.steps === true, kind: pref.kind || "app" },
  };
  const ov = document.createElement("div");
  ov.className = "palfull"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-label", "Palette full screen");
  const titleTxt = opts.title || "Palette";
  ov.innerHTML = `
    <div class="pf-stage" data-pf-stage></div>
    <div class="pf-read" data-pf-read hidden></div>
    <div class="pf-top" data-pf-top>
      <div class="pf-title"><b>${esc(titleTxt)}</b><span>${[opts.source, `${cols.length} ${cols.length === 1 ? "color" : "colors"}`].filter(Boolean).map(esc).join(" · ")}</span></div>
      <div class="pf-top-acts">${opts.heart ? `<button type="button" class="pf-x pf-heart" data-pf-heart aria-label="Save this palette" aria-pressed="false"></button>` : ""}${opts.onEdit ? `<button type="button" class="pf-pill" data-pf-edit>Edit</button>` : ""}${opts.onSave ? `<button type="button" class="pf-pill solid" data-pf-save>Save</button>` : ""}<button type="button" class="pf-x" data-pf-close aria-label="Close full screen">${ICON.x}</button></div>
    </div>
    <div class="pf-bot" data-pf-bot>
      <div class="pf-opts" data-pf-opts></div>
      <div class="pf-modes" data-pf-modes role="tablist" aria-label="Preview mode"></div>
      <p class="pf-fine">${opts.subtitle ? esc(opts.subtitle) + " " : ""}Screen colors are approximate.</p>
    </div>`;
  document.body.appendChild(ov);
  const stage = ov.querySelector("[data-pf-stage]"), readEl = ov.querySelector("[data-pf-read]"), optsEl = ov.querySelector("[data-pf-opts]"), modesEl = ov.querySelector("[data-pf-modes]");
  lockScroll();
  const meta = document.querySelector('meta[name="theme-color"]'), metaWas = meta && meta.getAttribute("content");
  const setBar = hex => { if (meta && hex) meta.setAttribute("content", hex); };
  let closed = false, readT = 0, built = false;
  const dims = () => { const r = stage.getBoundingClientRect(); return { w: Math.max(1, Math.round(r.width)), h: Math.max(1, Math.round(r.height)) }; };

  // the options under the mode switcher: only the ones the current mode has, plus Names
  const optDefs = () => {
    const m = st.mode, o = st.opt, d = dims(), autoDir = d.w < d.h ? "columns" : "rows";
    const on = (key, v) => key === "dir" ? (o.dir || autoDir) === v : o[key] === v;
    const seg = (key, items) => `<div class="pf-seg" role="group">${items.map(([v, t]) => `<button type="button" data-pf-opt="${key}" data-v="${v}" aria-pressed="${on(key, v)}">${t}</button>`).join("")}</div>`;
    const parts = [];
    if (m === "bands" && cols.hasShare) parts.push(seg("eq", [[false, "By share"], [true, "Equal"]]));
    if (m === "lines") parts.push(seg("dir", [["rows", "Rows"], ["columns", "Columns"]]));
    if (m === "gradient" && cols.length > 1) parts.push(seg("steps", [[false, "Smooth"], [true, "Steps"]]));
    if (m === "screen") parts.push(seg("kind", [["app", "App"], ["poster", "Poster"]]));
    else parts.push(`<button type="button" class="pf-chipbtn" data-pf-names aria-pressed="${st.names}">${st.names ? "Names on" : "Names off"}</button>`);
    parts.push(`<button type="button" class="pf-chipbtn" data-pf-fs aria-pressed="${!!document.fullscreenElement}">Full window</button>`);
    return parts.join("");
  };
  const paintOpts = () => { optsEl.innerHTML = optDefs(); };

  const render = () => {
    const { w, h } = dims(), mode = PF_R[st.mode];
    const botEl = ov.querySelector("[data-pf-bot]"), bh = st.chrome && botEl ? botEl.offsetHeight : 28;
    const res = mode(cols, { w, h, names: st.names, opt: st.opt, title: titleTxt, source: opts.source, top: 72, bh });
    stage.className = "pf-stage m-" + st.mode;
    stage.style.background = res.bg || "";
    stage.innerHTML = res.html;
    setBar(res.top);
    const bot = ov.querySelector("[data-pf-bot]"); if (bot && st.chrome && bot.offsetHeight > 60) ov.style.setProperty("--pf-bh", (bot.offsetHeight + 8) + "px");
    ov.style.setProperty("--pf-ink", ink(res.top || "#000") === "dark" ? "#141311" : "#fff");
    markSel();
  };
  const markSel = () => { stage.querySelectorAll("[data-i]").forEach(e => e.classList.toggle("sel", +e.dataset.i === st.sel)); };
  const paintModes = () => {
    modesEl.innerHTML = PF_MODES.map(m => {
      const th = PF_R[m.id](cols, { w: 56, h: 40, thumb: true, names: false, opt: st.opt, title: "", source: "" });
      const lbl = m.label;
      return `<button type="button" role="tab" class="pf-mode${m.id === st.mode ? " on" : ""}" data-pf-mode="${m.id}" aria-selected="${m.id === st.mode}"><span class="pf-th" aria-hidden="true" style="${th.bg ? "background:" + th.bg : ""}">${th.html}</span><em>${lbl}</em></button>`;
    }).join("");
    const on = modesEl.querySelector(".on"); if (on && on.scrollIntoView) { const L = on.offsetLeft - (modesEl.clientWidth - on.clientWidth) / 2; modesEl.scrollTo({ left: L, behavior: built && !reduce ? "smooth" : "auto" }); }
  };
  const setMode = (id, dirn) => {
    if (id === st.mode) return;
    st.mode = id; st.sel = -1; hideRead(); buzz(5);
    pfSave({ ...pfLoad(), mode: id });
    render(); paintOpts(); paintModes();
    if (!reduce) { stage.classList.remove("swap-l", "swap-r"); void stage.offsetWidth; stage.classList.add(dirn < 0 ? "swap-r" : "swap-l"); }
  };
  const step = d => { const i = PF_MODES.findIndex(m => m.id === st.mode); setMode(PF_MODES[(i + d + PF_MODES.length) % PF_MODES.length].id, d); };

  // the readout: a tapped color's name and hex; hold copies
  const hideRead = () => { clearTimeout(readT); readEl.hidden = true; st.sel = -1; markSel(); };
  const showRead = (i, msg) => {
    const c = cols[i]; if (!c) return;
    st.sel = i; markSel();
    readEl.hidden = false; readEl.style.setProperty("--c", c.hex);
    readEl.innerHTML = `<i style="--c:${c.hex}"></i><span><b>${esc(pfName(c))}</b><em>${msg || c.hex + (c.locked ? " · locked" : "") + " · hold to copy"}</em></span>`;
    clearTimeout(readT); readT = setTimeout(() => { readEl.hidden = true; }, msg ? 1800 : 3600);
  };
  const copyHex = i => {
    const c = cols[i]; if (!c) return;
    const done = () => { buzz(10); showRead(i, "Copied " + c.hex); };
    try { navigator.clipboard.writeText(c.hex).then(done, () => showRead(i, "Couldn't copy here")); } catch (e) { showRead(i, "Couldn't copy here"); }
  };
  const setChrome = on => { st.chrome = on; ov.classList.toggle("bare", !on); if (!on) { readEl.hidden = true; } };

  // pointer: tap / hold / swipe on the stage
  let pd = null, lastHold = 0;
  stage.addEventListener("pointerdown", e => {
    const it = e.target.closest("[data-i]");
    pd = { x: e.clientX, y: e.clientY, t: performance.now(), i: it ? +it.dataset.i : -1, id: e.pointerId, hold: 0, moved: false };
    if (pd.i >= 0) pd.hold = setTimeout(() => { if (pd && !pd.moved) { lastHold = performance.now(); copyHex(pd.i); pd.held = true; } }, 520);
  });
  stage.addEventListener("pointermove", e => { if (pd && Math.hypot(e.clientX - pd.x, e.clientY - pd.y) > 10) { pd.moved = true; clearTimeout(pd.hold); } });
  const endP = (e, cancel) => {
    if (!pd) return; clearTimeout(pd.hold); const p = pd; pd = null; if (cancel || p.held) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    if (Math.abs(dx) > 56 && Math.abs(dx) > Math.abs(dy) * 1.6) return step(dx < 0 ? 1 : -1);
    if (p.moved) return;
    if (!st.chrome) return setChrome(true);   // a bare screen: any tap brings the controls back
    // one tap on a color opens its page (never a sheet in between): the viewer closes first, so Back returns here
    if (p.i >= 0 && cols[p.i] && typeof openTappedColor === "function") { const hex = cols[p.i].hex; close(); setTimeout(() => openTappedColor(hex), 0); return; }
    setChrome(false); hideRead(); buzz(4);   // empty space: the pure view
  };
  stage.addEventListener("pointerup", e => endP(e, false));
  stage.addEventListener("pointercancel", e => endP(e, true));
  stage.addEventListener("contextmenu", e => e.preventDefault());

  ov.addEventListener("click", e => {
    const t = e.target;
    if (t.closest("[data-pf-close]")) return close();
    const mb = t.closest("[data-pf-mode]"); if (mb) { const ids = PF_MODES.map(m => m.id); return setMode(mb.dataset.pfMode, ids.indexOf(mb.dataset.pfMode) < ids.indexOf(st.mode) ? -1 : 1); }
    const ob = t.closest("[data-pf-opt]");
    if (ob) {
      const key = ob.dataset.pfOpt, raw = ob.dataset.v, v = raw === "true" ? true : raw === "false" ? false : raw;
      st.opt[key] = v; pfSave({ ...pfLoad(), [key]: v }); buzz(5); render(); paintOpts(); paintModes(); return;
    }
    if (t.closest("[data-pf-names]")) return toggleNames();
    if (t.closest("[data-pf-fs]")) return toggleBrowserFs();
    if (t.closest("[data-pf-heart]")) { opts.heart.toggle(); paintHeart(true); return; }
    if (t.closest("[data-pf-save]")) { const f = opts.onSave; close(); setTimeout(() => f && f(), 0); return; }
    if (t.closest("[data-pf-edit]")) { const f = opts.onEdit; close(); setTimeout(() => f && f(), 0); return; }
  });
  // the heart: filled = saved (aria-pressed + the filled icon), read from the caller's own store each time it is drawn
  const paintHeart = fb => {
    const h = ov.querySelector("[data-pf-heart]"); if (!h || !opts.heart) return;
    const on = !!opts.heart.isOn(); h.setAttribute("aria-pressed", on); h.classList.toggle("on", on); h.setAttribute("aria-label", on ? "Saved: tap to remove" : "Save this palette");
    h.innerHTML = on ? ICON.heartOn : ICON.heart;
    if (fb) { buzz(on ? 10 : 6); toast(on ? "Saved" : "Removed"); }
  };
  paintHeart(false);
  const toggleNames = () => { st.names = !st.names; pfSave({ ...pfLoad(), names: st.names }); buzz(4); render(); paintOpts(); };
  const toggleBrowserFs = () => {
    // iPhone Safari has no element full screen, and a desktop browser can refuse it: either way, fill the window by hiding the controls (a tap brings them back)
    const bare = () => { setChrome(false); buzz(5); };
    const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
    try {
      if (fsEl) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
      const rq = ov.requestFullscreen || ov.webkitRequestFullscreen;
      if (!rq) return bare();
      const p = rq.call(ov, { navigationUI: "hide" });
      let settled = false;
      if (p && p.then) p.then(() => { settled = true; }, () => { settled = true; bare(); });
      // some browsers (in-app views) leave the request hanging forever: no full screen after a moment means hide the controls instead
      setTimeout(() => { if (!settled && !closed && !(document.fullscreenElement || document.webkitFullscreenElement)) bare(); }, 700);
    } catch (e) { bare(); }
  };
  const onFs = () => { paintOpts(); setTimeout(() => !closed && render(), 60); };
  document.addEventListener("fullscreenchange", onFs);
  const onKey = e => {
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    const k = e.key;
    if (k === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); return close(); }
    if (k === "ArrowRight" || k === "ArrowDown") { e.preventDefault(); step(1); }
    else if (k === "ArrowLeft" || k === "ArrowUp") { e.preventDefault(); step(-1); }
    else if (k === "n" || k === "N") toggleNames();
    else if (k === "f" || k === "F") toggleBrowserFs();
    else if (k === "h" || k === "H") setChrome(!st.chrome);
  };
  document.addEventListener("keydown", onKey, true);
  let rzT = 0; const onRz = () => { clearTimeout(rzT); rzT = setTimeout(() => { if (!closed) { render(); paintOpts(); } }, 90); };
  addEventListener("resize", onRz);
  addEventListener("orientationchange", onRz);
  if (typeof loadCoreNames === "function") loadCoreNames().then(() => { if (!closed) { render(); } });

  // enter: the strip grows into the whole screen (the painting zoom's motion family); reduced motion = a fade
  const rectOf = f => { try { const r = f && (f.getBoundingClientRect ? f.getBoundingClientRect() : f); return r && r.width > 8 && r.height > 8 ? r : null; } catch (e) { return null; } };
  const clipFor = r => r ? `inset(${Math.max(0, r.top)}px ${Math.max(0, innerWidth - r.right)}px ${Math.max(0, innerHeight - r.bottom)}px ${Math.max(0, r.left)}px round 14px)` : "";
  render(); paintOpts(); paintModes(); built = true;
  // the sheet's height drives --pf-bh (where tags and the Bands/Stripes floor sit): render() measures before the options and modes are drawn, so follow its real size
  const botEl0 = ov.querySelector("[data-pf-bot]"), syncBh = () => { if (st.chrome && botEl0.offsetHeight > 60) ov.style.setProperty("--pf-bh", (botEl0.offsetHeight + 8) + "px"); };
  syncBh(); let bhRO = null; if (typeof ResizeObserver === "function") { bhRO = new ResizeObserver(syncBh); bhRO.observe(botEl0); }
  const from0 = rectOf(opts.from);
  if (reduce || !from0) { ov.classList.add("fade"); requestAnimationFrame(() => ov.classList.add("on")); }
  else {
    ov.style.clipPath = clipFor(from0); ov.style.transition = "none";
    requestAnimationFrame(() => requestAnimationFrame(() => { ov.style.transition = ""; ov.classList.add("on", "grow"); ov.style.clipPath = "inset(0 0 0 0 round 0px)"; }));
  }
  buzz(6);
  PF = { ov, close: () => close(), update(next) { const c2 = pfNorm(next, opts); if (!c2.length) return; cols.length = 0; c2.forEach(c => cols.push(c)); cols.hasShare = c2.hasShare; render(); paintModes(); } };

  function close() {
    if (closed) return; closed = true;
    document.removeEventListener("keydown", onKey, true); document.removeEventListener("fullscreenchange", onFs);
    removeEventListener("resize", onRz); removeEventListener("orientationchange", onRz); if (bhRO) bhRO.disconnect();
    try { if (document.fullscreenElement) document.exitFullscreen(); } catch (e) {}
    if (meta && metaWas != null) meta.setAttribute("content", metaWas);
    unlockScroll(); PF = null; buzz(4);
    const to = rectOf(opts.from && opts.from.isConnected !== false ? opts.from : null);
    if (reduce || !to) { ov.classList.remove("on"); setTimeout(() => ov.remove(), 240); }
    else { ov.classList.remove("on"); ov.style.clipPath = clipFor(to); setTimeout(() => ov.remove(), 400); }
  }
  cleanup.push(close);
  return PF;
}

// ready-made triggers: <button data-palfull="#A,#B,#C" data-palfull-title="…" data-palfull-source="…">; the grow-from
// element is the button's nearest strip (data-palfull-from="selector" inside the closest card) else the button itself
document.addEventListener("click", e => {
  const b = e.target.closest && e.target.closest("[data-palfull]"); if (!b) return;
  e.preventDefault(); e.stopPropagation();
  const hexes = (b.dataset.palfull || "").split(",").map(s => s.trim()).filter(Boolean); if (!hexes.length) return;
  const host = b.closest("[data-palfull-card]") || b.parentElement, sel = b.dataset.palfullFrom;
  palFullOpen(hexes, { title: b.dataset.palfullTitle || "", source: b.dataset.palfullSource || "", from: (sel && host && host.querySelector(sel)) || b });
}, true);
