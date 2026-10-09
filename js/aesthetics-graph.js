"use strict";
// The family tree: a node-link browser over data/aesthetics/graph.json (tools/build_aesthetics_graph.js) --
// every look (data/looks.js), every painting movement with painters in the archive (data/artists/meta.json +
// context.json), a short hand-curated list of subcultures/design movements with no painter corpus of their own,
// and all 840 painters. Addresses: #/web (the graph), #/web/node/<id> (a page for a node with no page of its
// own elsewhere), #/web/focus/<id> (the graph, centered and opened on one node -- "See its family tree" from a
// look page). One canvas, pan/zoom by pointer and wheel; the layout (x/y/r per node) is precomputed at build
// time, never simulated on the phone (ROADMAP: this screen must stay smooth at 1,000+ nodes on an iPhone).
//
// AG.data: { nodes: Map<id,node>, edges: [...], out: Map<id,edge[]>, in: Map<id,edge[]> }   (fetched once, cached)
// AG.view: { x, y, scale }   world-space pan/zoom (world units: node.px/py * AG_K)
// AG.filter: { types: Set, edgeTypes: Set, y0, y1, place }

const AG_K = 1200;   // world-space scale of the precomputed -1..1 layout
const AG_TYPE_LABEL = { look: "Look", movement: "Movement", subculture: "Subculture", artist: "Painter" };
const AG_EDGE_LABEL = { lineage: "Teacher → student", influence: "Influence", member_of: "Belongs to movement",
  shared_colors: "Shares colors", shared_artists: "Shares painters", same_era: "Same era", same_place: "Same place",
  motifs: "Shares motifs", revival: "Revival" };
const AG_EDGE_ORDER = ["influence", "lineage", "member_of", "shared_colors", "shared_artists", "same_era", "same_place", "motifs", "revival"];
let AG = null, AG_LOADING = null;

function agLoad() {
  if (AG) return Promise.resolve(AG);
  return AG_LOADING || (AG_LOADING = fetch("data/aesthetics/graph.json").then(r => r.json()).then(g => {
    const nodes = new Map(g.nodes.map(n => [n.id, n]));
    const out = new Map(), inc = new Map();
    for (const e of g.edges) {
      if (!out.has(e.from)) out.set(e.from, []); out.get(e.from).push(e);
      if (!inc.has(e.to)) inc.set(e.to, []); inc.get(e.to).push(e);
    }
    AG = { meta: { v: g.v, built: g.built, source: g.source, counts: g.counts }, nodes, edges: g.edges, out, inc };
    AG_LOADING = null;
    return AG;
  }).catch(e => { AG_LOADING = null; throw e; }));
}
// every edge touching a node, either direction, with the "other" node resolved
function agTouching(id) {
  const g = AG, list = [];
  (g.out.get(id) || []).forEach(e => { const to = g.nodes.get(e.to); if (to) list.push({ e, dir: "out", other: to }); });
  (g.inc.get(id) || []).forEach(e => { const from = g.nodes.get(e.from); if (from) list.push({ e, dir: "in", other: from }); });
  return list;
}
const agPlaces = () => [...new Set([...AG.nodes.values()].map(n => n.place).filter(Boolean))].sort();
// one tap opens the node's real page when it has one elsewhere in the app (DESIGN-CANON law 3: no in-between
// sheet) -- called directly, like any other in-app chip tap (data-awpainter, data-lk), so the trail's own
// "r:<path>" auto-join (js/trail.js) remembers this graph screen as where Back returns to. A hash-change
// navigation would reset XSTACK instead (js/router.js openRoute), which is right for a typed/shared link but
// wrong for a tap from inside the graph.
function agOpen(n) {
  buzz(6);
  // look pages take an explicit `back`, so Back returns here exactly; painter/movement pages (js/artwiki.js)
  // keep their own XSTACK trail tokens and fall back to the app's usual Back behavior instead (a disclosed
  // scope trim -- see the final report).
  if (n.type === "look" && typeof lkOpenRoute === "function") { if (typeof lkWhen === "function") return lkWhen(() => lkOpen(n.slug, { back: () => agHome(null) })); return lkOpenRoute(n.slug); }
  if (n.type === "artist" && typeof awPainter === "function") return awPainter(n.slug);
  if (n.type === "movement" && n.hasPage && typeof awGroup === "function") return awGroup("movement", n.title);
  return agNodePage(n.id);
}

// ========================================================================
// the graph screen
// ========================================================================
let AGV = null;   // { el, canvas, ctx, raf, destroy() } of the currently-open screen, so a re-filter can redraw in place
const AG_DEFAULT_FILTER = () => ({ types: new Set(["look", "movement", "subculture", "artist"]), edgeTypes: new Set(["influence", "lineage", "member_of", "revival"]), y0: null, y1: null, place: "" });
let AG_FILTER = AG_DEFAULT_FILTER();

function agHome(focusId) {
  ROUTE_NEXT = routed("Family tree", focusId ? "web/focus/" + focusId : "web");
  const el = show(`
    <div class="ag-screen">
      <header class="art-top ag-top"><button class="icon-btn glass" data-back aria-label="Back">${ICON.back}</button>
        <button class="glass-pill ag-title">${ICON.web}<span>Family tree</span></button>
        <button class="icon-btn glass" data-agshow aria-label="Filter">${ICON.tune}</button></header>
      <canvas class="ag-canvas"></canvas>
      <div class="ag-hint" data-aghint>Pinch or scroll to zoom &middot; drag to pan &middot; tap a bubble to open it</div>
      <div class="ag-panel" data-agpanel hidden></div>
    </div>
  `, "article");
  el.querySelector("[data-back]").onclick = () => xToOrigin();
  agMount(el, focusId);
}

// a page for a node that has no page anywhere else (a subculture, or a Wikidata movement tag too thin for its
// own js/artwiki.js group page): essence, era/place, an illustrative palette, and its in/out connections,
// each tappable (recurses into another node's real page, or another agNodePage)
function agNodePage(id) {
  const open = (n) => {
    ROUTE_NEXT = routed(n.title, "web/node/" + n.id);
    const touch = agTouching(n.id);
    const byType = {};
    touch.forEach(t => { (byType[t.e.type] = byType[t.e.type] || []).push(t); });
    const sectionsHTML = AG_EDGE_ORDER.filter(t => byType[t]).map(t => `
      <div class="sec-head"><b>${esc(AG_EDGE_LABEL[t])}</b><span>${byType[t].length}</span></div>
      <div class="ag-rel">${byType[t].slice(0, 20).map(x => `<button class="ag-chip" data-agnode="${esc(x.other.id)}" style="--c:${esc(x.other.swatch || "#8C9096")}"><b>${esc(x.other.title)}</b>${x.e.why ? `<small>${esc(x.e.why)}</small>` : ""}</button>`).join("")}</div>`).join("");
    const essence = n.essence || (n.type === "movement" ? `A movement tagged on ${n.memberCount || 0} painter${n.memberCount === 1 ? "" : "s"} in this archive's Wikidata records.` : "");
    const el = show(`
      <header class="art-top"><button class="icon-btn glass" data-back aria-label="Back">${ICON.back}</button><span class="eyebrow">${esc(AG_TYPE_LABEL[n.type] || "")}</span><span style="width:44px"></span></header>
      <div class="ag-nodehero">${(n.palette || [n.swatch]).filter(Boolean).slice(0, 6).map(h => `<i style="--c:${esc(h)}"></i>`).join("")}</div>
      <p class="eyebrow p-type">${esc(AG_TYPE_LABEL[n.type] || "")}${n.era ? " · " + esc(n.era) : ""}</p>
      <h1 class="p-title">${esc(n.title)}</h1>
      ${essence ? `<p class="p-dek">${esc(essence)}</p>` : ""}
      ${n.place ? `<p class="fine">${esc(n.place)}</p>` : ""}
      ${sectionsHTML}
      <section class="srcs"><h3>Sources</h3><ul><li>${esc(n.source || "ColorHub's own curation.")}</li>${n.type === "subculture" ? "<li>The palette shown is ColorHub's own illustrative choice, not measured from source photographs.</li>" : ""}</ul></section>
    `, "article");
    el.querySelector("[data-back]").onclick = () => xToOrigin();
    el.addEventListener("click", e => { const b = e.target.closest("[data-agnode]"); if (b) { e.preventDefault(); const t = AG.nodes.get(b.dataset.agnode); if (t) agOpen(t); } });
  }
  agLoad().then(g => { const n = g.nodes.get(id); if (n) open(n); else { toast("That connection isn't in the archive"); xToOrigin(); } }).catch(() => { toast("The family tree didn't load"); xToOrigin(); });
}

// router entry (js/router.js openRoute): id is undefined (#/web), "focus" (#/web/focus/<nodeId>) or "node" (#/web/node/<nodeId>)
// id/more arrive already decoded (js/router.js openRoute decodes the whole hash before splitting on "/")
function agOpenRoute(id, more) {
  if (id === "node" && more) return agNodePage(more);
  if (id === "focus" && more) return agHome(more);
  return agHome(null);
}

// ---------- mount: fetch, layout math, canvas drawing, pan/zoom, hit-testing ----------
function agMount(el, focusId) {
  const canvas = el.querySelector(".ag-canvas"), ctx = canvas.getContext("2d");
  const panel = el.querySelector("[data-agpanel]"), hint = el.querySelector("[data-aghint]");
  const view = { x: 0, y: 0, scale: 0.42 };
  let nodes = [], edgesVisible = [], dpr = Math.min(2, window.devicePixelRatio || 1), destroyed = false;
  let hoverId = null, pressId = null;
  const fit = () => { const r = el.getBoundingClientRect(); canvas.width = Math.round(r.width * dpr); canvas.height = Math.round((r.height) * dpr); canvas.style.width = r.width + "px"; canvas.style.height = r.height + "px"; };
  fit();
  const ro = new ResizeObserver(fit); ro.observe(el);

  const worldToScreen = (x, y) => [(x * AG_K * view.scale + view.x) * dpr, (y * AG_K * view.scale + view.y) * dpr];
  const screenToWorld = (sx, sy) => [((sx / dpr) - view.x) / (AG_K * view.scale), ((sy / dpr) - view.y) / (AG_K * view.scale)];

  function recompute() {
    if (!AG) return;
    const f = AG_FILTER;
    nodes = [...AG.nodes.values()].filter(n => f.types.has(n.type) && (!f.place || n.place === f.place) && (f.y0 == null || n.y == null || n.y >= f.y0) && (f.y1 == null || n.y == null || n.y <= f.y1));
    const shown = new Set(nodes.map(n => n.id));
    edgesVisible = AG.edges.filter(e => f.edgeTypes.has(e.type) && shown.has(e.from) && shown.has(e.to));
  }

  function draw() {
    if (destroyed) return;
    const r = el.getBoundingClientRect();
    ctx.save(); ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--ground") || "#0E0D0B";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const zoomedIn = view.scale > 0.9;
    // edges first, thin, under the bubbles
    ctx.lineWidth = Math.max(0.5, 0.7 * dpr);
    for (const e of edgesVisible) {
      const a = AG.nodes.get(e.from), b = AG.nodes.get(e.to); if (!a || !b) continue;
      const [ax, ay] = worldToScreen(a.px, a.py), [bx, by] = worldToScreen(b.px, b.py);
      if (ax < -50 && bx < -50) continue; if (ax > canvas.width + 50 && bx > canvas.width + 50) continue;
      ctx.strokeStyle = e.type === "lineage" ? "rgba(236,232,223,.22)" : "rgba(236,232,223,.09)";
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    }
    // nodes
    const minR = zoomedIn ? 3 : 1.4;
    for (const n of nodes) {
      const [sx, sy] = worldToScreen(n.px, n.py);
      if (sx < -40 || sy < -40 || sx > canvas.width + 40 || sy > canvas.height + 40) continue;
      const rad = Math.max(minR, n.r * view.scale * dpr * 0.9);
      ctx.beginPath(); ctx.arc(sx, sy, rad, 0, Math.PI * 2);
      ctx.fillStyle = n.swatch || "#8C9096";
      ctx.globalAlpha = n.id === hoverId || n.id === pressId ? 1 : 0.92;
      ctx.fill();
      if (n.id === focusId) { ctx.lineWidth = 2 * dpr; ctx.strokeStyle = "#ECE8DF"; ctx.stroke(); }
      ctx.globalAlpha = 1;
      if (zoomedIn && rad > 7 * dpr) {
        ctx.font = `${Math.min(13, 9 + rad / 6) * dpr}px var(--sans, sans-serif)`;
        ctx.fillStyle = "rgba(236,232,223,.92)";
        ctx.textBaseline = "top";
        ctx.fillText(n.title, sx + rad + 4 * dpr, sy - 6 * dpr);
      }
    }
    ctx.restore();
  }

  function nodeAt(sx, sy) {
    let best = null, bestD = Infinity;
    for (const n of nodes) {
      const [x, y] = worldToScreen(n.px, n.py);
      const rad = Math.max(6 * dpr, n.r * view.scale * dpr);
      const d = Math.hypot(sx - x, sy - y);
      if (d <= rad + 6 * dpr && d < bestD) { best = n; bestD = d; }
    }
    return best;
  }

  // pan + pinch/wheel zoom (pointer events cover mouse and touch alike)
  const pts = new Map();
  let pinchD0 = 0, scale0 = 1;
  canvas.addEventListener("pointerdown", e => { try { canvas.setPointerCapture(e.pointerId); } catch (err) {} pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (pts.size === 1) { pressId = (nodeAt((e.clientX - el.getBoundingClientRect().left) * dpr, (e.clientY - el.getBoundingClientRect().top) * dpr) || {}).id || null; } });
  canvas.addEventListener("pointermove", e => {
    if (!pts.has(e.pointerId)) {
      const r = el.getBoundingClientRect();
      const n = nodeAt((e.clientX - r.left) * dpr, (e.clientY - r.top) * dpr);
      if ((n && n.id) !== hoverId) { hoverId = n ? n.id : null; canvas.style.cursor = n ? "pointer" : "grab"; draw(); }
      return;
    }
    const prev = pts.get(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 1) { view.x += e.clientX - prev.x; view.y += e.clientY - prev.y; pressId = null; draw(); }
    else if (pts.size === 2) {
      const [a, b] = [...pts.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchD0) { view.scale = clamp(scale0 * (d / pinchD0), 0.06, 4); draw(); }
    }
  });
  const pinchStart = () => { if (pts.size === 2) { const [a, b] = [...pts.values()]; pinchD0 = Math.hypot(a.x - b.x, a.y - b.y); scale0 = view.scale; } };
  canvas.addEventListener("pointerdown", pinchStart);
  const release = e => { pts.delete(e.pointerId); pinchD0 = 0; if (pts.size === 0 && pressId != null) { const n = AG.nodes.get(pressId); if (n) agOpen(n); } pressId = null; };
  canvas.addEventListener("pointerup", release); canvas.addEventListener("pointercancel", release);
  canvas.addEventListener("wheel", e => { e.preventDefault(); const r = el.getBoundingClientRect(); const before = screenToWorld((e.clientX - r.left) * dpr, (e.clientY - r.top) * dpr); view.scale = clamp(view.scale * (e.deltaY < 0 ? 1.12 : 0.89), 0.06, 4); const [ax, ay] = worldToScreen(before[0], before[1]); view.x += e.clientX - r.left - ax / dpr; view.y += e.clientY - r.top - ay / dpr; draw(); }, { passive: false });

  function centerOn(id, scale) {
    const n = AG.nodes.get(id); if (!n) return;
    const r = el.getBoundingClientRect();
    view.scale = scale || Math.max(view.scale, 1.1);
    view.x = r.width / 2 - n.px * AG_K * view.scale;
    view.y = r.height / 2 - n.py * AG_K * view.scale;
  }

  function loop() { if (destroyed) return; draw(); requestAnimationFrame(loop); }

  agLoad().then(() => {
    recompute();
    if (focusId && AG.nodes.has(focusId)) centerOn(focusId); else { view.x = el.clientWidth / 2; view.y = el.clientHeight / 2; }
    hint.classList.add("in"); setTimeout(() => hint.classList.remove("in"), 3200);
    loop();
  }).catch(() => { toast("The family tree didn't load"); });

  el.querySelector("[data-agshow]").onclick = () => agShowSheet(() => { recompute(); draw(); });

  AGV = { destroy() { destroyed = true; ro.disconnect(); } };
  cleanup.push(() => { destroyed = true; try { ro.disconnect(); } catch (e) {} });
}

// ---------- the Show sheet: filter by type, era, region, and which edge types draw ----------
function agShowSheet(onChange) {
  const f = AG_FILTER;
  const places = AG ? agPlaces() : [];
  const typeChip = (t, label) => `<button class="ag-f-chip${f.types.has(t) ? " on" : ""}" data-agtype="${t}">${esc(label)}</button>`;
  const edgeChip = t => `<button class="ag-f-chip${f.edgeTypes.has(t) ? " on" : ""}" data-agedge="${t}">${esc(AG_EDGE_LABEL[t])}</button>`;
  const { sh, close } = sheet(`
    <div class="ag-sheet">
      <h3>Show</h3>
      <p class="eyebrow">Kinds of nodes</p>
      <div class="ag-f-row">${typeChip("look", "Looks")}${typeChip("movement", "Movements")}${typeChip("subculture", "Subcultures")}${typeChip("artist", "Painters")}</div>
      <p class="eyebrow">Connections</p>
      <div class="ag-f-row">${AG_EDGE_ORDER.map(edgeChip).join("")}</div>
      <p class="eyebrow">Era</p>
      <div class="ag-f-years"><input type="number" inputmode="numeric" placeholder="From" data-agy0 value="${f.y0 ?? ""}"><span>&ndash;</span><input type="number" inputmode="numeric" placeholder="To" data-agy1 value="${f.y1 ?? ""}"></div>
      <p class="eyebrow">Region</p>
      <select data-agplace><option value="">Everywhere</option>${places.map(p => `<option value="${esc(p)}"${f.place === p ? " selected" : ""}>${esc(p)}</option>`).join("")}</select>
      <button class="btn" data-agapply>Show these ${ICON.arrow}</button>
      <button class="btn ghost" data-agreset>Reset</button>
    </div>
  `);
  const toggle = (set, id) => set.has(id) ? set.delete(id) : set.add(id);
  sh.addEventListener("click", e => {
    const t = e.target.closest("[data-agtype]"); if (t) { toggle(f.types, t.dataset.agtype); t.classList.toggle("on"); return; }
    const g = e.target.closest("[data-agedge]"); if (g) { toggle(f.edgeTypes, g.dataset.agedge); g.classList.toggle("on"); return; }
    if (e.target.closest("[data-agreset]")) { AG_FILTER = AG_DEFAULT_FILTER(); onChange(); close(); return; }
    if (e.target.closest("[data-agapply]")) {
      f.y0 = sh.querySelector("[data-agy0]").value ? +sh.querySelector("[data-agy0]").value : null;
      f.y1 = sh.querySelector("[data-agy1]").value ? +sh.querySelector("[data-agy1]").value : null;
      f.place = sh.querySelector("[data-agplace]").value;
      onChange(); close();
    }
  });
}
