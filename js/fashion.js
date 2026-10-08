"use strict";
// Fashion garments: real museum pieces, each with six colors measured from its photograph. Lives inside the World
// lens's Fashion section (js/world.js owns the tiles, the lists and the routes: #/fashion/garments and
// #/fashion/garment-<id>); this file owns what's behind the "Garments" tile.
//  - fxBrowser: every garment and textile in data/fashion/garments.json (hotlinked museum open-access photos),
//    searchable by color (where a picked color covers the most cloth), era and culture. Virtualized grid.
//  - fxGarment: one garment: photo, its six measured colors (each one tap to its color page), date, culture, museum
//    credit and record, and "similar palettes".
//  - fxColorStrip: the garments row inside the "In fashion" section of a color page (world.js worldColorRow).
// Data and method: tools/fashion.py, research/FASHION.md. All top-level names here start with fx.

let FX = null, FX_LOADING = null;
const FX_ERAS = [["all", "All eras"], ["e0", "Before 1500"], ["e1", "1500–1699"], ["e2", "1700s"], ["e3", "1800–1849"], ["e4", "1850–1899"], ["e5", "1900 on"]];
const FX_UI = { era: "all", g: "all", color: null, q: "", y: 0 };

function fxLoad() {
  if (FX) return Promise.resolve(FX);
  return FX_LOADING || (FX_LOADING = fetch("data/fashion/garments.json" + (DATA_VER ? "?v=" + DATA_VER : "")).then(r => r.ok ? r.json() : null).then(d => {
    if (!d) { FX_LOADING = null; return null; }
    d.byId = new Map();
    d.rows.forEach(r => { r.lab = r.p.map(c => lab(c[0])); d.byId.set(r.id, r); });
    d.groupLabel = Object.fromEntries(d.meta.groups);
    return (FX = d);
  }).catch(() => { FX_LOADING = null; return null; }));
}
const fxMuseum = r => (FX && FX.meta.museums[r.mu]) || { name: r.mu, short: r.mu, license: "" };
// grids use the Met's small "mobile-large" rendition (about 360px); the garment page uses the full web image
const fxThumb = r => r.mu === "met" ? r.img.replace("/web-large/", "/mobile-large/") : r.img;
const fxImg = (r, cls = "") => `<img${cls ? ` class="${cls}"` : ""} src="${esc(fxThumb(r))}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onload="this.classList.add('ld')">`;
const fxPal = r => `<span class="mini-pal">${r.p.map(c => `<i style="--c:${c[0]};flex:${c[1]}"></i>`).join("")}</span>`;
const fxSub = r => [r.d, r.cul || (FX && FX.groupLabel[r.g])].filter(Boolean).join(" · ");
const fxAllColors = () => [...BASICS, ...ALL];
const fxErr = `<p class="fine">The garment archive didn't load. Check your connection.</p>`;

// How much of a garment is a given color: the share of its palette within reach of the color (CIEDE2000),
// full weight under 6, fading to nothing at 16.
function fxScore(r, L) {
  let s = 0;
  r.lab.forEach((x, i) => { const d = de2000(L, x); if (d < 16) s += r.p[i][1] * (d < 6 ? 1 : (16 - d) / 10); });
  return s;
}
function fxByColor(hex, rows, min = .12) {
  const L = lab(hex);
  return rows.map(r => [r, fxScore(r, L)]).filter(x => x[1] >= min).sort((a, b) => b[1] - a[1]);
}

// the World tile's picture: three garment photos side by side, once the archive is in
function fxTileArt(host) {
  fxLoad().then(d => {
    const art = host && host.querySelector(".wd-art"); if (!d || !art) return;
    const pick = seeded(d.rows.filter(r => r.mu === "met"), today() + "tile").slice(0, 4);
    art.innerHTML = `<span class="fx-tile-imgs">${pick.map(r => fxImg(r)).join("")}</span>`;
    const sub = host.querySelector(".wd-sub"); if (sub) sub.textContent = `${d.rows.length.toLocaleString()} pieces, searchable by color`;
  });
}

// ---------------------------------------------------------------- the garment browser (#/fashion/garments)
function fxColorsByHue() {
  const key = c => { const [L, C, H] = lch(c.h); return C < 12 ? 1000 + (100 - L) : (H + 330) % 360 + (100 - L) / 400; };
  return fxAllColors().slice().sort((a, b) => key(a) - key(b));
}
function fxBrowser(opts = {}) {
  const el = show(`
    ${worldTop("Fashion")}
    <h1 class="p-title">Garments</h1>
    <p class="p-dek" id="fx-dek">Dress and textiles from museum open-access collections, each with six colors measured from its photograph.</p>
    <div id="fx-body"><p class="fine">Loading the archive…</p></div>
  `, "article wd fx");
  worldBackWire(el, opts, fashionFallback);
  fxLoad().then(d => {
    const body = el.querySelector("#fx-body"); if (!body || !el.isConnected) return;
    if (!d) { body.innerHTML = fxErr; return; }
    el.querySelector("#fx-dek").textContent = `${d.rows.length.toLocaleString()} garments and textiles from ${Object.keys(d.meta.museums).filter(k => d.rows.some(r => r.mu === k)).map(k => d.meta.museums[k].name).join(" and ")}, each with six colors measured from its photograph.`;
    const groups = d.meta.groups.filter(([k]) => d.rows.some(r => r.g === k));
    body.innerHTML = `
      <div class="fx-pick">
        <div class="fx-pick-head"><span class="note">Search by color</span><span id="fx-pick-name"></span></div>
        <div class="fx-ribbon" id="fx-ribbon">${fxColorsByHue().map(c => `<button style="--c:${c.h}" data-fx-c="${esc(c.h)}" aria-label="${esc(c.n)}"></button>`).join("")}</div>
      </div>
      <div class="fx-chips" id="fx-era">${FX_ERAS.map(([k, t]) => `<button class="${k === FX_UI.era ? "on" : ""}" data-v="${k}">${esc(t)}</button>`).join("")}</div>
      <div class="fx-chips" id="fx-grp">${[["all", "All cultures"], ...groups].map(([k, t]) => `<button class="${k === FX_UI.g ? "on" : ""}" data-v="${k}">${esc(t)}</button>`).join("")}</div>
      <label class="search fx-q"><span>${ICON.search}</span><input id="fx-q" type="search" placeholder="Search titles, places, makers" autocomplete="off" value="${esc(FX_UI.q)}"></label>
      <p class="fx-count" id="fx-n"></p>
      <div class="fx-grid" id="fx-grid"></div>
      <p class="fine">Images are shown from the museums' own servers (public domain or CC0). Colors are measured from photographs, so lighting and fading shift them; hex values are screen approximations.</p>`;
    const grid = body.querySelector("#fx-grid"), nEl = body.querySelector("#fx-n"), ribbon = body.querySelector("#fx-ribbon"), pickName = body.querySelector("#fx-pick-name");
    let list = [];
    const filter = () => {
      const q = FX_UI.q.trim().toLowerCase();
      const rows = d.rows.filter(r => (FX_UI.era === "all" || r.e === FX_UI.era) && (FX_UI.g === "all" || r.g === FX_UI.g) &&
        (!q || `${r.t} ${r.cul || ""} ${r.by || ""} ${r.m || ""} ${r.d}`.toLowerCase().includes(q)));
      if (FX_UI.color) list = fxByColor(FX_UI.color, rows).map(([r, s]) => ({ r, s }));
      else list = (FX_UI.era === "all" && !q ? seeded(rows, today()) : rows).map(r => ({ r }));
      const nm = FX_UI.color ? (fxAllColors().find(c => c.h === FX_UI.color) || {}).n : "";
      nEl.innerHTML = FX_UI.color
        ? `<span><i style="--c:${FX_UI.color}"></i><span class="mono">${list.length.toLocaleString()}</span> pieces with ${esc(nm || "this color")}, most first</span><button data-clear>${ICON.xS} Clear</button>`
        : `<span><span class="mono">${list.length.toLocaleString()}</span> pieces, ${FX_UI.era === "all" && !q ? "shuffled daily" : "oldest first"}</span>`;
      const clr = nEl.querySelector("[data-clear]"); if (clr) clr.onclick = () => { FX_UI.color = null; mark(); filter(); };
      pickName.textContent = nm || "";
      layout(true);
    };
    const mark = () => ribbon.querySelectorAll("[data-fx-c]").forEach(b => b.classList.toggle("on", b.dataset.fxC === FX_UI.color));
    // virtualized two-column grid: only the rows near the viewport are in the DOM
    let colW = 0, rowH = 0, shown = "";
    const cols = 2, GAP = 14, TEXT = 58;
    const layout = reset => {
      const w = grid.clientWidth; if (!w) return;
      colW = (w - GAP * (cols - 1)) / cols; rowH = Math.round(colW * 1.25) + TEXT + 22;
      grid.style.height = Math.ceil(list.length / cols) * rowH + "px";
      if (reset) { shown = ""; grid.innerHTML = ""; }
      paint();
    };
    const paint = () => {
      if (!rowH) return;
      const top = grid.getBoundingClientRect().top, a = Math.max(0, Math.floor((-top - 600) / rowH)), b = Math.min(Math.ceil(list.length / cols), Math.ceil((-top + innerHeight + 600) / rowH));
      const key = a + ":" + b + ":" + list.length; if (key === shown) return; shown = key;
      let html = "";
      for (let row = a; row < b; row++) for (let c = 0; c < cols; c++) {
        const it = list[row * cols + c]; if (!it) continue;
        const r = it.r;
        html += `<button class="fx-card" data-fx-g="${esc(r.id)}" style="top:${row * rowH}px;left:${c * (colW + GAP)}px;width:${colW}px">
          <span class="fx-img" style="height:${Math.round(colW * 1.25)}px">${fxImg(r)}${it.s != null ? `<em class="mono">${Math.round(Math.min(1, it.s) * 100)}%</em>` : ""}</span>${fxPal(r)}<b>${esc(r.t)}</b><small>${esc(fxSub(r))}</small></button>`;
      }
      grid.innerHTML = html || `<p class="fine">Nothing matches. Try another color, era or culture.</p>`;
    };
    let raf = 0;
    const onScroll = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(paint); };
    const onResize = () => layout(true);
    addEventListener("scroll", onScroll, { passive: true }); addEventListener("resize", onResize);
    cleanup.push(() => { removeEventListener("scroll", onScroll); removeEventListener("resize", onResize); });
    grid.addEventListener("click", e => { const b = e.target.closest("[data-fx-g]"); if (b) { FX_UI.y = scrollY; fashionPage("garment-" + b.dataset.fxG, { back: () => { fxBrowser(opts); } }); } });
    ribbon.addEventListener("click", e => { const b = e.target.closest("[data-fx-c]"); if (!b) return; FX_UI.color = FX_UI.color === b.dataset.fxC ? null : b.dataset.fxC; mark(); filter(); buzz(6); });
    const chips = (id, key) => body.querySelectorAll(`#${id} [data-v]`).forEach(b => b.onclick = () => { FX_UI[key] = b.dataset.v; body.querySelectorAll(`#${id} [data-v]`).forEach(x => x.classList.toggle("on", x === b)); filter(); });
    chips("fx-era", "era"); chips("fx-grp", "g");
    let qt = 0;
    body.querySelector("#fx-q").addEventListener("input", e => { clearTimeout(qt); qt = setTimeout(() => { FX_UI.q = e.target.value; filter(); }, 180); });
    mark(); filter();
    [ribbon.querySelector(".on"), body.querySelector("#fx-era .on"), body.querySelector("#fx-grp .on")].forEach(x => x && x.scrollIntoView({ inline: "center", block: "nearest" }));
    if (FX_UI.y) { const y = FX_UI.y; requestAnimationFrame(() => { scrollTo(0, y); paint(); }); }
  });
  return el;
}

// ---------------------------------------------------------------- one garment (#/fashion/garment-<id>)
function fxGarment(id, opts = {}) {
  const el = show(`${worldTop("Fashion")}<div id="fx-one"><p class="fine">Loading…</p></div>`, "article wd fx");
  worldBackWire(el, opts, () => fxBrowser());
  fxLoad().then(d => {
    const host = el.querySelector("#fx-one"); if (!host || !el.isConnected) return;
    const r = d && d.byId.get(id);
    if (!r) { host.innerHTML = d ? `<p class="fine">That garment isn't in the archive.</p>` : fxErr; return; }
    const mu = fxMuseum(r), pal = r.p;
    document.title = `${r.t} · ColorHub`;
    host.innerHTML = `
      <div class="fx-hero" style="aspect-ratio:${Math.max(.6, Math.min(1.6, 1 / (r.ar || 1.3))).toFixed(3)}"><img src="${esc(r.img)}" alt="${esc(r.t)}" referrerpolicy="no-referrer" onload="this.classList.add('ld')"></div>
      <p class="eyebrow p-type">${esc(d.groupLabel[r.g] || "")}${r.d ? " · " + esc(r.d) : ""}</p>
      <h1 class="p-title fx-title">${esc(r.t)}</h1>
      ${r.by ? `<p class="p-dek">${esc(r.by)}</p>` : ""}
      <div class="palette fx-pal">${pal.map(p => `<button class="pal" style="--c:${p[0]};flex:${Math.max(p[1], .07)}" data-ink="${ink(p[0])}" data-swatch="${p[0]}" aria-label="${esc(p[2])}"><span class="mono">${Math.round(p[1] * 100)}%</span></button>`).join("")}</div>
      <div class="pal-names">${pal.map(p => `<button class="pal-name" data-swatch="${p[0]}"><i style="--c:${p[0]}"></i><b>${esc(p[2])}</b><em class="mono">${p[0]} · ${Math.round(p[1] * 100)}%</em></button>`).join("")}</div>
      <dl class="facts">${[["Date", r.d], ["Culture", r.cul || d.groupLabel[r.g]], ["Medium", r.m], ["Museum", mu.name]].filter(x => x[1]).map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>
      ${r.url ? `<a class="btn ghost fx-rec" href="${esc(r.url)}" target="_blank" rel="noopener">${esc(mu.short)} record ${ICON.arrow}</a>` : ""}
      <div id="fx-like"></div>
      <section class="srcs"><h3>Image and record</h3><ul>
        <li>${esc(mu.license === "CC0" ? "CC0 image from" : "Public domain image from")} <a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(mu.name)}</a>. Open the record for full credit, dimensions and more photographs.</li>
        <li>Colors measured by ColorHub: six k-means clusters in CIELAB after masking the studio backdrop. Names: the nearest of 2,700 named colors. Hex values are screen approximations.</li>
      </ul></section>`;
    // similar palettes: the garments whose six colors are nearest (each color matched to its closest, weighted by share)
    // (a cheap pass on the share-weighted mean color keeps the exact pass to 240 candidates)
    const dist = (x, y) => x.lab.reduce((s, L, i) => s + x.p[i][1] * Math.min(...y.lab.map(M => de2000(L, M))), 0);
    const mean = x => x.mean || (x.mean = x.lab.reduce((m, L, i) => m.map((v, k) => v + L[k] * x.p[i][1]), [0, 0, 0]));
    const m0 = mean(r), near = d.rows.filter(x => x !== r).map(x => { const m = mean(x); return [x, (m[0] - m0[0]) ** 2 + (m[1] - m0[1]) ** 2 + (m[2] - m0[2]) ** 2]; })
      .sort((a, b) => a[1] - b[1]).slice(0, 240).map(x => x[0]);
    const like = near.map(x => [x, dist(r, x) + dist(x, r)]).sort((a, b) => a[1] - b[1]).slice(0, 10);
    const lk = host.querySelector("#fx-like");
    lk.innerHTML = `<div class="sec-head"><b>Similar palettes</b><span class="mono">${like.length}</span></div><div class="fx-strip">${like.map(([x]) =>
      `<button class="fx-mini" data-fx-g="${esc(x.id)}"><span class="fx-img">${fxImg(x)}</span>${fxPal(x)}<small>${esc(x.d)}</small></button>`).join("")}</div>`;
    lk.querySelectorAll("[data-fx-g]").forEach(b => b.onclick = () => fashionPage("garment-" + b.dataset.fxG, { back: () => fxGarment(id, opts) }));
  });
  return el;
}

// ---------------------------------------------------------------- "In fashion" on a color page: garments strip
// Lazy (the archive is 560 KB): fetched when the row scrolls near. Adds to world.js's "In fashion" section.
function fxColorStrip(host, n) {
  if (!host || !n || n.kind !== "color" || typeof IntersectionObserver === "undefined") return;
  const io = new IntersectionObserver(es => {
    if (!es[0].isIntersecting) return;
    io.disconnect();
    fxLoad().then(d => {
      if (!d || !host.isConnected) return;
      const hits = fxByColor(n.h, d.rows, .3).slice(0, 14);
      if (hits.length < 3) return;
      host.insertAdjacentHTML("beforeend", `${host.querySelector("h3") ? "" : `<h3>In fashion</h3>`}<p class="fx-in-sub">Garments and textiles where ${esc(n.title)} covers the most cloth.</p><div class="fx-strip">${hits.map(([r, s]) =>
        `<button class="fx-mini" data-fx-g="${esc(r.id)}"><span class="fx-img">${fxImg(r)}<em class="mono">${Math.round(Math.min(1, s) * 100)}%</em></span>${fxPal(r)}<small>${esc(r.d)}${r.cul ? " · " + esc(r.cul) : ""}</small></button>`).join("")}</div>
        <button class="btn ghost" data-fx-all>All ${esc(n.title)} garments ${ICON.arrow}</button>`);
      host.querySelectorAll("[data-fx-g]").forEach(b => b.onclick = () => fashionPage("garment-" + b.dataset.fxG, { back: () => openNode(n, false) }));
      host.querySelector("[data-fx-all]").onclick = () => { Object.assign(FX_UI, { color: n.h, era: "all", g: "all", q: "", y: 0 }); fashionPage("garments", { back: () => openNode(n, false) }); };
    });
  }, { rootMargin: "300px" });
  io.observe(host);
  cleanup.push(() => io.disconnect());
}
