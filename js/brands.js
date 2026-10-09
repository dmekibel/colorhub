"use strict";
// Brand colors as design history (CLAUDE.md goal 3: "iconic design colors"). David, 2026-10-09: "Logos are
// design history we can have in the app, like the history of the Coca-Cola logo's colors over time."
// Data: data/design/brands.json (~130 brands, each with sourced hex colors and, where documented, a color
// timeline). No logos or logo images anywhere (trademark; design/LEGAL-COLOR-DATA.md R1-R3): brand name in
// plain text plus our own approximate swatches only.
// This file owns: loading the data, the brand page (#/brand/<slug>), the "In design" compact row on a color
// page (bdRow, wired from js/richpage.js next to gmRow/btRow), and a World section tile. The guessing game
// lives in js/games/brands-game.js (its own station like Odd one out / Gradients) and reads BD from here.
// All top-level names here start with bd (tools/check_names.js: one shared global scope).

let BD = null, BD_LOADING = null;
function bdLoad() {
  if (BD) return Promise.resolve(BD);
  return BD_LOADING || (BD_LOADING = fetch("data/design/brands.json" + (DATA_VER ? "?v=" + DATA_VER : "")).then(r => r.ok ? r.json() : null).then(d => {
    if (!d) { BD_LOADING = null; return null; }
    d.byId = new Map(d.brands.map(b => [b.id, b]));
    return (BD = d);
  }).catch(() => { BD_LOADING = null; return null; }));
}
function bdWhen(fn) { bdLoad().then(d => { if (d) fn(d); }); }

// ---------- color math helpers shared with the game ----------
// the nearest of the app's ~1,000 core names (BASICS + ALL, always loaded from data/colors.js)
function bdNearest(hex) {
  const [hit] = nearestColors(hex, 1);
  return hit ? { n: hit[0].n, h: hit[0].h, d: hit[1] } : null;
}
const bdAllColors = b => (b.colors || []).map(c => c.hex);
// the brand's single best-known color, for list art and the game's answer key
const bdMainColor = b => (b.colors && b.colors[0] && b.colors[0].hex) || "#808080";
function bdBrandsNear(hex, maxDe = 15, limit = 8) {
  if (!BD) return [];
  const hits = [];
  BD.brands.forEach(b => {
    let best = null;
    bdAllColors(b).forEach(h => { const d = de2000(hex, h); if (!best || d < best.d) best = { h, d }; });
    if (best && best.d < maxDe) hits.push({ b, h: best.h, d: best.d });
  });
  return hits.sort((a, b) => a.d - b.d).slice(0, limit);
}

// ---------- "In design" row on a color page (js/richpage.js calls bdRow(entry, famC)) ----------
function bdRowHTML(c, famC) {
  let hits = bdBrandsNear(c.h), note = "";
  if (!hits.length && famC && famC.n.toLowerCase() !== c.n.toLowerCase()) {
    hits = bdBrandsNear(famC.h);
    if (hits.length) note = `<p class="fine">Nothing of ${esc(c.n.toLowerCase())}'s own; its nearest well-covered match, ${esc(famC.n)}, does.</p>`;
  }
  if (!hits.length) return "";
  return `<section class="arch-row bd-row"><h3>In design</h3><p class="fine">Brands near this color.</p>${note}
    <div class="wd-in-strip">${hits.map(h => `<button class="wd-in" data-bd-open="${esc(h.b.id)}"><i style="--c:${h.h}"></i><b>${esc(h.b.name)}</b><small>${pctFmt(100 - h.d)} match</small></button>`).join("")}</div></section>`;
}
function bdRow(c, famC) {
  const id = "bd-row-" + Math.random().toString(36).slice(2, 8);
  bdWhen(() => requestAnimationFrame(() => {
    const box = document.getElementById(id); if (!box) return;
    box.innerHTML = bdRowHTML(c, famC);
    box.querySelectorAll("[data-bd-open]").forEach(b => b.onclick = () => bdPage(b.dataset.bdOpen, { back: () => openNode(colorNode(c), false) }));
  }));
  return `<div class="bd-rows" id="${id}"></div>`;
}

// ---------- the brand page (#/brand/<slug>) ----------
function bdTitle(id) { const b = BD && BD.byId.get(id); return b ? b.name : "Brand"; }
function bdTimelineHTML(b) {
  if (!b.history || b.history.length < 1) return "";
  const steps = b.history;
  return `<h3>Color history</h3><p class="fine">${esc(b.name)}'s color over time, as reported.</p>
    <div class="bd-tl">${steps.map((s, i) => {
      const prev = steps[i - 1];
      const near = bdNearest(s.hex);
      const change = prev ? `<span class="bd-tl-d">${pctFmt(de2000(prev.hex, s.hex))} change</span>` : "";
      return `<div class="bd-tl-step"><i style="--c:${s.hex}" data-swatch="${s.hex}"></i><b>${s.year}</b>${change}<p>${esc(s.note)}</p>${near ? `<small>Nearest named color: <button class="link" data-bd-near="${esc(near.h)}" data-bd-near-n="${esc(near.n)}">${esc(near.n)}</button></small>` : ""}</div>`;
    }).join("")}</div>`;
}
function bdPage(id, opts = {}) {
  const b = BD && BD.byId.get(id);
  if (!b) { bdWhen(() => bdPage(id, opts)); return; }
  const near = bdAllColors(b).map(h => bdNearest(h)).filter(Boolean);
  const el = show(`
    <header class="art-top"><button class="icon-btn glass" data-back aria-label="Back">${ICON.back}</button></header>
    <p class="eyebrow p-type">Brand</p>
    <h1 class="p-title">${esc(b.name)}</h1>
    <p class="p-dek">${esc(b.category)}${b.country ? " · " + esc(b.country) : ""}${b.founded ? " · founded " + b.founded : ""}</p>
    <div class="bd-hero">${b.colors.map((c, i) => `<i style="--c:${c.hex}" data-swatch="${c.hex}" aria-label="${esc(c.label || c.hex)}"></i>`).join("")}</div>
    <p class="fine">${b.colors.map((c, i) => `${esc(c.label || c.hex)}${near[i] ? ` — nearest named color <button class="link" data-bd-near="${esc(near[i].h)}" data-bd-near-n="${esc(near[i].n)}">${esc(near[i].n)}</button>` : ""}`).join(". ")}.</p>
    <div data-bd-acts></div>
    ${bdTimelineHTML(b)}
    <p class="fine bd-last">Colors are our own approximate screen values from ${esc(b.source || "public sources")}, checked ${esc(b.source_date || "")}. No logo is shown; ${esc(b.name)} and other names are trademarks of their owners, and ColorHub is not affiliated with or endorsed by them.</p>
    ${typeof linksHereHTML === "function" ? linksHereHTML({ id: "brand:" + id, title: b.name }) : ""}
  `, "article bd-page");
  el.querySelector("[data-back]").onclick = opts.back || xBack;
  el.querySelectorAll("[data-bd-near]").forEach(btn => btn.onclick = () => { const h = btn.dataset.bdNear; openTappedColor(h); });
  if (typeof wireLinks === "function") wireLinks(el);
  // Surface actions (design/SIMPLIFY/PLAN.md §3.6's generic archive-object row, "♡ Keep · Share"): a brand has
  // no favorites system of its own, so Keep here means its signature colors, the same colorSet verb every
  // other archive page uses.
  if (typeof colorSet === "function" && typeof csActions === "function") {
    const acts = el.querySelector("[data-bd-acts]");
    if (acts) acts.appendChild(csActions(colorSet({ kind: "brand", id, title: b.name, colors: b.colors.map(c => ({ h: c.hex, n: c.label })), src: "brand/" + id }), { only: ["keep", "share"] }));
  }
  return el;
}
function bdOpenRoute(id) { XSTACK = []; bdWhen(() => bdPage(id)); }
function bdTileArt(host) {
  bdWhen(d => { const art = host && host.querySelector(".wd-art"); if (!art) return;
    const pick = seeded(d.brands, "bdtile").slice(0, 4);
    art.innerHTML = `<span class="bd-tile-sw">${pick.map(b => `<i style="--c:${bdMainColor(b)}"></i>`).join("")}</span>`;
    const sub = host.querySelector(".wd-sub"); if (sub) sub.textContent = `${d.brands.length} brands, by their signature color`;
  });
}

// ---------- the brand browser (#/brand) ----------
function bdBrowser(opts = {}) {
  const el = show(`
    ${worldTop("Design")}
    <h1 class="p-title">Brand colors</h1>
    <p class="p-dek" id="bd-dek">Well-known brands by their signature color, each with the nearest named color and, where documented, how it changed over time.</p>
    <div id="bd-body"><p class="fine">Loading the archive…</p></div>
  `, "article wd bd");
  if (typeof worldBackWire === "function") worldBackWire(el, opts, () => xToOrigin());
  bdWhen(d => {
    const body = el.querySelector("#bd-body"); if (!body || !el.isConnected) return;
    el.querySelector("#bd-dek").textContent = `${d.brands.length} brands, each with its signature color, the nearest named match, and any documented change over time.`;
    const cats = [...new Set(d.brands.map(b => b.category))].sort();
    body.innerHTML = `<div class="fx-chips" id="bd-cat"><button class="on" data-v="all">All</button>${cats.map(c => `<button data-v="${esc(c)}">${esc(c)}</button>`).join("")}</div>
      <div class="bd-grid" id="bd-grid"></div>`;
    const draw = cat => {
      const list = d.brands.filter(b => cat === "all" || b.category === cat);
      el.querySelector("#bd-grid").innerHTML = list.map(b => `<button class="bd-card" data-bd="${esc(b.id)}"><i style="--c:${bdMainColor(b)}"></i><b>${esc(b.name)}</b><small>${esc(b.category)}</small></button>`).join("");
      el.querySelectorAll("[data-bd]").forEach(x => x.onclick = () => bdPage(x.dataset.bd, { back: () => bdBrowser(opts) }));
    };
    draw("all");
    el.querySelectorAll("#bd-cat button").forEach(btn => btn.onclick = () => { el.querySelectorAll("#bd-cat button").forEach(x => x.classList.remove("on")); btn.classList.add("on"); draw(btn.dataset.v); });
  });
  return el;
}

// ---------- the World lens tile (js/world.js's shared WORLD_SECTIONS) ----------
function bdWorldSection(host) {
  host.innerHTML = `<p class="x-sub">Coca-Cola red, Tiffany Blue, T-Mobile Magenta: the colors that became a company's identity, and how some of them changed.</p>
    <div class="wd-tiles">${typeof wdTile === "function" ? wdTile("data-bd-browse", "Brand colors", "Loading…", "") : `<button class="wd-tile" data-bd-browse><span class="wd-art"></span><b>Brand colors</b><span class="wd-sub">Loading…</span></button>`}</div>`;
  bdTileArt(host);
  const t = host.querySelector("[data-bd-browse]"); if (t) t.onclick = () => bdBrowser();
}
if (typeof WORLD_SECTIONS !== "undefined") WORLD_SECTIONS.push({ key: "brands", title: "Design", render: bdWorldSection });
