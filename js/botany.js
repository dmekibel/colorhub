"use strict";
// Botany: the plants behind ColorHub's color names, dye plants, why-plants-are-colored essays, Greenaway's
// 1884 language of flowers, and Werner's 1821 plant pairings. Data: data/botany.js (window.BOTANY), loaded
// in the background, same pattern as js/passages.js and js/films.js.
// Registers a "World" lens section (window.WORLD_SECTIONS, shared with other contributors) and an
// "In nature" row on color pages (btRow(c), called once from js/explore.js's colorPage).
// All top-level names here are prefixed bt to stay out of everyone else's way (tools/check_names.js).
// Plant, dye and essay pages render through the app's own generic wikiPage(n) (they're graph nodes shaped
// like any other wiki page); only the language-of-flowers index is a page of its own, btFloriPage().

const btV = ((document.currentScript && document.currentScript.src.match(/[?&]v=([\w.-]+)/)) || [])[1] || "";
let btOK = false, btStale = false, btGraphSeen = null;
const btWaitQ = [];
let btPlantByColor = new Map(), btDyesByColor = new Map();

// a couple of new, friendlier labels for the page types this file adds (TYPE_LABEL is graph.js's own
// shared, mutable map — extending it here is the same trick js/world.js-style files use for WORLD_SECTIONS)
Object.assign(TYPE_LABEL, { botplant: "Plant", botdye: "Dye plant", botessay: "Botany", bottradition: "Tradition" });

(() => {
  const s = document.createElement("script");
  s.src = "data/botany.js" + (btV ? "?v=" + btV : "");
  s.onload = () => { btOK = true; btReady(); };
  s.onerror = () => { btOK = false; };
  document.head.appendChild(s);
})();

function btReady() {
  if (!window.BOTANY) return;
  btBuildNodes();
  btWaitQ.splice(0).forEach(f => { try { f(); } catch (e) { console.error(e); } });
  if (btStale && document.getElementById("feed") && typeof exploreHome === "function") { const y = scrollY; exploreHome(); scrollTo(0, y); }
  btStale = false;
}
// run fn now if the data's here, otherwise once it lands
function btWhen(fn) { if (window.BOTANY) { btBuildNodes(); fn(); } else btWaitQ.push(fn); }

// ---------- turn the data into graph nodes, once ----------
// Small enough (about 50 pages) to register all at once, unlike the hundreds of passages/films that only
// become nodes when first opened. Each node is shaped like a generic wiki page, so wikiPage(n) renders it
// for free: dek, swatches, facts, body (first paragraph open, the rest folds under "The full story"), and a
// "Colors" row from n.colors. kind "botany" (not "page") so router.js can give it its own #/botany/<id>.
function btBuildNodes() {
  if (!window.BOTANY) return;
  const g = graph();
  // loader.js sets G = null once the main wiki lands, so graph() returns a brand-new Map that wouldn't
  // otherwise include these nodes; re-add them whenever graph() hands back an object we haven't seen yet.
  if (g === btGraphSeen) return;
  btGraphSeen = g;
  const B = window.BOTANY;
  btPlantByColor = new Map(); btDyesByColor = new Map();
  const swFor = names => names.map(n => { const c = BYNAME.get(n.toLowerCase()); return c ? { h: c.h, label: n } : null; }).filter(Boolean);
  B.plants.forEach(p => {
    const id = "bt:plant:" + p.id;
    g.nodes.set(id, { kind: "botany", type: "botplant", id, title: p.plant, dek: "The plant behind ColorHub's " + p.color + ".",
      facts: p.facts, body: p.body, colors: [p.color], sources: p.sources, swatches: swFor([p.color]) });
    btPlantByColor.set(p.color, id);
  });
  B.dyes.forEach(d => {
    const id = "bt:dye:" + d.id;
    g.nodes.set(id, { kind: "botany", type: "botdye", id, title: d.title, dek: "Dye plant",
      facts: d.facts, body: d.body, colors: d.colors, sources: d.sources, swatches: swFor(d.colors) });
    d.colors.forEach(c => { if (!btDyesByColor.has(c)) btDyesByColor.set(c, []); btDyesByColor.get(c).push(id); });
  });
  B.essays.forEach(e => {
    const id = "bt:essay:" + e.id;
    g.nodes.set(id, { kind: "botany", type: "botessay", id, title: e.title, dek: e.dek,
      body: e.body, colors: e.colors, sources: e.sources, swatches: swFor(e.colors) });
  });
  g.nodes.set("bt:flori-index", { kind: "botany", type: "bottradition", id: "bt:flori-index", title: "The language of flowers",
    dek: B.flori.length + " flowers from Kate Greenaway's 1884 dictionary — a Victorian tradition, not a fact about flowers.",
    swatches: [], page: () => btFloriPage() });
}
const btNode = id => graph().nodes.get(id);

// ---------- the World lens section ----------
function btWorldSection() {
  if (!window.BOTANY) { btStale = true; return { title: "Botany", sub: "Loading the plants behind the colors…", pins: [] }; }
  btBuildNodes();
  const B = window.BOTANY;
  const plantNodes = B.plants.map(p => btNode("bt:plant:" + p.id)).filter(Boolean);
  const dyeNodes = B.dyes.map(d => btNode("bt:dye:" + d.id)).filter(Boolean);
  const essayNodes = B.essays.map(e => btNode("bt:essay:" + e.id)).filter(Boolean);
  const floriNode = btNode("bt:flori-index");
  return [
    { title: "Flowers and plants behind the names", sub: "Why a color took a plant's name, and how the real plant actually varies.", pins: seeded(plantNodes, "btplants" + today()).map(n => pin(n)) },
    { title: "Dye plants", sub: "What grew the colors before chemistry did.", pins: dyeNodes.map(n => pin(n)) },
    { title: "Why plants are colored", pins: essayNodes.map(n => pin(n)) },
    { title: "The language of flowers", sub: "A Victorian parlor tradition, not a fact about flowers — 19th-century dictionaries disagree with each other.", pins: floriNode ? [pin(floriNode)] : [] },
  ];
}
window.WORLD_SECTIONS = window.WORLD_SECTIONS || [];
window.WORLD_SECTIONS.push(btWorldSection);

// ---------- "In nature" row on a color page (js/explore.js colorPage calls btRow(c)) ----------
const btLinkLabel = { werner: "Werner, 1821", flori: "Victorian language of flowers", tradition: "Also linked", garden: "Jekyll's color garden, 1908", "false": "False friend" };
function btDyeForPlant(text) {
  const t = text.toLowerCase();
  return (window.BOTANY.dyes || []).find(d => t.includes(d.id.split("-")[0]));
}
function btRowHTML(c) {
  const entries = ((window.BOTANY || {}).byColor || {})[c.n] || [];
  if (!entries.length) return "";
  const plantId = btPlantByColor.get(c.n);
  const rows = entries.map(e => {
    if (e.link === "named" && plantId) {
      const n = btNode(plantId), sw = n.swatches[0];
      return `<button class="kin" data-to="${esc(plantId)}"><i style="--c:${sw ? sw.h : c.h}"></i><b>${esc(e.plant)}</b><span>${esc(e.detail)}</span></button>`;
    }
    if (e.link === "dye") {
      const d = btDyeForPlant(e.plant);
      if (d) return `<button class="kin" data-to="${esc("bt:dye:" + d.id)}"><i style="--c:${c.h}"></i><b>${esc(e.plant)}</b><span>${esc(e.detail)}</span></button>`;
    }
    return `<p class="bt-fact"><b>${esc(btLinkLabel[e.link] || "Also")}:</b> ${esc(e.plant)} — ${esc(e.detail)}</p>`;
  }).join("");
  return `<section class="arch-row bt-row"><h3>In nature</h3>${rows}</section>`;
}
function btRow(c) {
  const id = "bt-row-" + Math.random().toString(36).slice(2, 8);
  btWhen(() => requestAnimationFrame(() => {
    const box = document.getElementById(id); if (!box) return;
    box.innerHTML = btRowHTML(c);
    wireLinks(box);
  }));
  return `<div class="bt-rows" id="${id}"></div>`;
}

// ---------- the language of flowers: a browsable, searchable, Victorian-not-factual list ----------
let btQ = "", btFam = "all", btShown = 60;
function btFloriFam(f) {
  const names = f[3]; if (!names || !names.length) return null;
  const c = BYNAME.get(names[0].toLowerCase()); return c ? psgFam(c.h) : null;
}
function btFloriRowHTML(f) {
  const [flower, meaning, typical, names] = f;
  if (names && names.length) {
    const c = BYNAME.get(names[0].toLowerCase());
    return `<button class="kin" data-to="c:${esc(names[0])}"><i style="--c:${c ? c.h : "#555"}"></i><b>${esc(flower)}</b><span>${esc(meaning)}${names.length > 1 ? ` · also ${names.slice(1).map(esc).join(", ")}` : ""}</span></button>`;
  }
  return `<div class="kin bt-plain"><i></i><b>${esc(flower)}</b><span>${esc(meaning)}${typical ? ` · ${esc(typical)}` : ""}</span></div>`;
}
function btFloriPage() {
  const B = window.BOTANY, withColor = B.flori.filter(f => f[3] && f[3].length);
  const el = show(`
    <header class="art-top"><button class="icon-btn glass" data-back aria-label="Back">${ICON.back}</button></header>
    <p class="eyebrow p-type">Botany · ${B.flori.length} flowers</p>
    <h1 class="p-title">The language of flowers</h1>
    <p class="p-dek">Kate Greenaway's 1884 dictionary of flower meanings — a Victorian parlor tradition, not a fact about flowers. 19th-century dictionaries often disagree with each other on what the same flower means.</p>
    <label class="search bt-search"><span>${ICON.search}</span><input id="bt-q" type="search" placeholder="Search by flower" autocomplete="off" value="${esc(btQ)}"></label>
    <div class="lens-key in-page psg-fams">${PSG_FAMS.map(([k, t]) => `<button class="${k === btFam ? "on" : ""}" data-fam="${esc(k)}">${k !== "all" ? `<i style="--c:${BYNAME.get(k.toLowerCase()).h}"></i>` : ""}${esc(t)}</button>`).join("")}</div>
    <div class="sec-head" id="bt-head"><b>Flowers</b><span></span></div>
    <div id="bt-list"></div>
    <p class="fine">${withColor.length} of ${B.flori.length} flowers are matched here to a ColorHub color; the rest are listed by name and meaning only.</p>
    <section class="srcs"><h3>Source</h3><ul><li>Kate Greenaway, Language of Flowers (1884), public domain.</li>
      <li>Floriography dictionaries contradicted each other even in the 1800s; treat any single meaning as one writer's opinion, not a fixed fact.</li></ul></section>
  `, "article bt-flori-page");
  const listEl = el.querySelector("#bt-list"), head = el.querySelector("#bt-head");
  const filtered = () => {
    const q = btQ.trim().toLowerCase();
    return B.flori.filter(f => (btFam === "all" || btFloriFam(f) === btFam) && (!q || f[0].toLowerCase().includes(q)));
  };
  const draw = () => {
    const rows = filtered();
    head.innerHTML = `<b>Flowers</b><span>${rows.length.toLocaleString()}</span>`;
    listEl.innerHTML = rows.length
      ? rows.slice(0, btShown).map(btFloriRowHTML).join("") + (rows.length > btShown ? `<button class="btn ghost bt-more" data-more>Show more ${ICON.arrow}</button>` : "")
      : `<p class="fine">No flowers match.</p>`;
  };
  draw();
  el.querySelector("[data-back]").onclick = xBack;
  onKey = e => { if (e.key === "Escape") xBack(); };
  el.querySelectorAll("[data-fam]").forEach(b => b.onclick = () => { btFam = b.dataset.fam; btShown = 60; el.querySelectorAll("[data-fam]").forEach(x => x.classList.toggle("on", x === b)); draw(); });
  el.querySelector("#bt-q").addEventListener("input", e => { btQ = e.target.value; btShown = 60; draw(); });
  el.addEventListener("click", e => { if (e.target.closest("[data-more]")) { btShown += 80; draw(); } });
  wireLinks(el);
}

// ---------- opening a direct #/botany/<id> address (router.js) ----------
function btOpenRoute(id) {
  XSTACK = [];
  btWhen(() => {
    const n = id === "flori" ? btNode("bt:flori-index") : btNode("bt:plant:" + id) || btNode("bt:dye:" + id) || btNode("bt:essay:" + id);
    if (n) openNode(n); else go(S.tab || "learn");
  });
}
