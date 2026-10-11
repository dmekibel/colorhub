"use strict";
// The archive browse grid (David, 2026-10-11): one grid for every archive the painting map can lay out --
// Design objects (10,577), Photography (3,465), Ukiyo-e prints, Botanical & bird plates and Pulp covers -- with
// the SAME Filter sheet the painting map has, not a row of single-pick chips per archive.
//
// Nothing here is a second engine. The data is js/paintmap.js's own adapter F (pmColLoad -> pmAdapterBuild),
// the query is pmRun/pmList (AND across facets, OR within one, live per-value counts), the sheet is
// pmFilterPane (the very pane the map's Filter tab renders), and the removable chips are pmActiveChips. So a
// filter set here means exactly what it means on the map, and "See on the map" carries it over whole.
//
// What this file adds on top: the grid itself (pin()/masonry(), 60 at a time with "Show more" -- the bound the
// Design objects stuck-screen fix put on every big render), Sort (Featured / Date, either way / Color / Maker),
// a Keep heart on every tile (js/favs.js fvItem*, the same Kept shelf the map's card writes to), the empty and
// failed-load states, and the address (#/photography?y0=1939&y1=1943&sort=date) so a filtered grid can be
// shared and survives a reload. State is kept per collection for the session, so Back lands on the grid as you
// left it (filters, sort, how far you'd paged).
//
// Embedding: a room's own screen calls abMount(host, col, { path, fresh }) inside its show() markup --
// js/photography.js photographyGrid, js/pulp.js pulpGrid, js/ukiyoe.js ukGrid, js/botanicalplates.js bpGrid,
// js/designobjects.js doBrowseAll. router.js hands an address with a query to abRouteOpen().

const AB_PAGE = 60;
const AB_SORTS = [["featured", "Featured"], ["date", "Date"], ["color", "Color"], ["maker", "Maker"]];
const AB_STATE = new Map();   // col -> { s: { f, fav, col }, sort, desc, shown }
const AB_PATHS = { photography: "photography", pulp: "pulp", ukiyoe: "ukiyoe", botanical: "botanical", design: "design/browse" };
let AB_PENDING = null;        // { col, qs } -- an address's query, read by the next abMount for that collection

function abFresh(col) { return { s: { f: pmFilterFresh(), fav: 0, col }, sort: "featured", desc: false, shown: AB_PAGE }; }
function abState(col, fresh) {
  if (fresh || !AB_STATE.has(col)) AB_STATE.set(col, abFresh(col));
  return AB_STATE.get(col);
}
// the address's query: the map's own filter words (pmQS, minus the map-only arr/col) plus sort
function abQS(st, F) {
  const q = pmQS({ ...pmFresh(), ...st.s, col: "paintings" }, F).split("&").filter(kv => !/^(arr|col)=/.test(kv));
  if (st.sort !== "featured") q.push("sort=" + st.sort);
  if (st.desc) q.push("desc=1");
  return q.join("&");
}
function abParse(qs, col, F) {
  const st = abFresh(col), p = pmParse(qs, F);
  st.s.f = p.f; st.s.fav = p.fav;
  const u = new URLSearchParams(qs);
  if (AB_SORTS.some(x => x[0] === u.get("sort"))) st.sort = u.get("sort");
  st.desc = u.get("desc") === "1";
  return st;
}
// router.js: "#/<path>?<qs>" for a browse grid -- opens that collection's own room with the query applied
function abRouteOpen(pathq, base) {
  const at = pathq.indexOf("?"), path = at < 0 ? pathq : pathq.slice(0, at), qs = at < 0 ? "" : pathq.slice(at + 1);
  const col = Object.keys(AB_PATHS).find(c => AB_PATHS[c] === path);
  if (!col) return false;
  const fn = { photography: "photographyGrid", pulp: "pulpGrid", ukiyoe: "ukGrid", botanical: "bpGrid", design: "doBrowseAll" }[col];
  if (typeof window[fn] !== "function") return false;
  base(); XSTACK = [];
  AB_PENDING = { col, qs };
  window[fn](false);
  return true;
}

// which archive a node belongs to (its id prefix), for a Keep heart on its own page -- null for a painting or
// anything else that isn't one of these collections
function abColOf(n) {
  const id = String((n && n.id) || "");
  return id.startsWith("do-") ? "design" : id.startsWith("photod-") ? "photography" : id.startsWith("uk-") ? "ukiyoe"
    : id.startsWith("bp-") ? "botanical" : id.startsWith("pulp-") ? "pulp" : null;
}
// the Keep heart in an archive item's own top bar (js/explore.js paintingPage), the same store and the same
// heart as its tile in the grid and its card on the map -- keep it in one place, it shows kept in all three
function abPageHeart(el, n) {
  const col = abColOf(n), top = el.querySelector(".art-top");
  if (!col || !top || typeof fvItemHas !== "function" || top.querySelector("[data-fvi]")) return;
  const on = fvItemHas(n.id);
  top.insertAdjacentHTML("beforeend", `<button class="fva-heart${on ? " on" : ""}" data-fva data-fvi="${esc(n.id)}" data-fvi-kind="${col}" aria-pressed="${on}" aria-label="${on ? "Remove from Kept" : "Keep this"}">${on ? FVA_HEART_ON : FVA_HEART}</button>`);
  fvItemWireGrid(top, id => (id === n.id ? n : null));
}

// ---------- sorting: index lists in, index lists out (F.G arrays, no node lookups in the comparator) ----------
function abSorted(list, st, F) {
  const G = F.G, arr = Array.from(list);
  if (st.sort === "date") {
    const dir = st.desc ? -1 : 1;
    return arr.sort((a, b) => { const ya = G.year[a], yb = G.year[b], ua = ya === GL_UNDATED, ub = yb === GL_UNDATED; return ua !== ub ? (ua ? 1 : -1) : ua ? a - b : dir * (ya - yb) || a - b; });
  }
  if (st.sort === "color") {
    // the map's own "By color" reading, flattened to one line: each item by its main swatch (the color its tile
    // shows most of), hues red -> orange -> yellow -> green -> blue -> purple, lighter first inside a hue band,
    // and the near-greys gathered at the end, light to dark
    const key = new Float64Array(G.n);
    for (const i of arr) {
      const [L, a, b] = pmPlaceLab(i, "main", F), C = Math.hypot(a, b);
      key[i] = C < 5 ? 1e4 + (100 - L) : Math.floor(pmHueKey(a, b) / 12) * 200 + (100 - L);
    }
    return arr.sort((a, b) => key[a] - key[b] || a - b);
  }
  if (st.sort === "maker") {
    const name = i => F.artist[i] ? xbArtistName(F, F.artist[i]) : "";
    return arr.sort((a, b) => { const na = name(a), nb = name(b); return (!na) - (!nb) || na.localeCompare(nb) || pmYr(a, F) - pmYr(b, F) || a - b; });
  }
  return arr;
}

// ---------- the grid ----------
function abMount(host, col, o = {}) {
  host.classList.add("ab");
  host.innerHTML = `<p class="fine ab-wait">Loading…</p>`;
  pmColLoad(col).then(F => {
    if (!host.isConnected) return;
    let st;
    if (AB_PENDING && AB_PENDING.col === col) { st = abParse(AB_PENDING.qs, col, F); AB_STATE.set(col, st); }
    else st = abState(col, o.fresh);
    AB_PENDING = null;
    abWire(host, col, F, st, o);
  }).catch(err => {
    if (!host.isConnected) return;
    console.warn(err);
    const noun = (PM_COL_LABELS[col] || PM_COL_LABELS.paintings).nounP;
    host.innerHTML = `<p class="fine ab-wait">The ${esc(noun)} didn't load. <button class="wl" data-ab-retry>Try again</button></p>`;
    host.querySelector("[data-ab-retry]").onclick = () => { buzz(5); abMount(host, col, o); };
  });
}
function abWire(host, col, F, st, o) {
  const nounP = pmColLabel(F, "nounP"), noun = pmColLabel(F, "noun");
  host.innerHTML = `
    <div class="ab-tools">
      <button class="ab-btn" data-ab-filter aria-haspopup="dialog">${PM_ICON.filter}<span>Filter</span><em data-ab-nf hidden></em></button>
      <button class="ab-btn" data-ab-map aria-label="See these on the map">${icon("map", 20)}<span>On the map</span></button>
    </div>
    <div class="ab-sort" role="radiogroup" aria-label="Sort" data-ab-sort></div>
    <div class="ab-chips" data-ab-chips hidden></div>
    <p class="ab-count" data-ab-count aria-live="polite"></p>
    <div data-ab-extra></div>
    <div class="ab-feed" data-ab-feed></div>`;
  const $ = sel => host.querySelector(sel), feed = $("[data-ab-feed]");
  let rows = [], byId = new Map();
  const nodeOf = i => F.nodes[i];
  // the address follows every change (replace, not push: a filter change is the same screen, not a new page)
  const writeAddress = () => {
    const path = o.path || AB_PATHS[col]; if (!path) return;
    const q = abQS(st, F);
    try { ROUTE_NOW = "#/" + path + (q ? "?" + q : ""); history.replaceState(history.state, "", ROUTE_NOW); } catch (e) {}
  };
  function paintTools() {
    $("[data-ab-sort]").innerHTML = AB_SORTS.map(([k, t]) => {
      const on = st.sort === k, label = k === "date" && on ? (st.desc ? "Newest" : "Oldest") : k === "maker" ? pmColLabel(F, "painter") : t;
      return `<button class="${on ? "on" : ""}" data-ab-sortk="${k}" role="radio" aria-checked="${on}"${k === "date" && on ? ` aria-label="Date, ${st.desc ? "newest" : "oldest"} first: tap to flip"` : ""}>${esc(label)}</button>`;
    }).join("");
    const chips = pmActiveChips(st.s, F), bar = $("[data-ab-chips]");
    bar.hidden = !chips.length;
    bar.innerHTML = chips.map((c, k) => `<button class="pmx-xchip ab-xchip" data-ab-clear="${k}">${esc(c.text)}<i>${ICON.x}</i></button>`).join("")
      + (chips.length > 1 ? `<button class="ab-clearall" data-ab-clearall>Clear all</button>` : "");
    bar._chips = chips;
    const nf = $("[data-ab-nf]"); nf.hidden = !chips.length; nf.textContent = chips.length || "";
    $("[data-ab-filter]").setAttribute("aria-label", chips.length ? `Filter, ${chips.length} on` : "Filter");
    const ex = $("[data-ab-extra]"); if (ex) ex.innerHTML = o.extra ? o.extra(st, F) : "";
  }
  function paintFeed() {
    const total = rows.length, page = rows.slice(0, st.shown).map(nodeOf);
    $("[data-ab-count]").textContent = `${total.toLocaleString()} ${total === 1 ? noun : nounP}`;
    if (!total) {
      const any = pmActiveChips(st.s, F).length;
      feed.innerHTML = `<div class="ab-empty"><p>${any ? `No ${esc(nounP)} match all of that.` : `No ${esc(nounP)} here yet.`}</p>${any ? `<button class="wl" data-ab-clearall>Clear the filters</button>` : ""}</div>`;
      return;
    }
    byId = new Map(page.map(n => [n.id, n]));
    feed.innerHTML = masonry(page.map(n => pin(n))) + (total > st.shown
      ? `<button class="ab-more" data-ab-more>Show ${Math.min(AB_PAGE, total - st.shown).toLocaleString()} more <span>(${(total - st.shown).toLocaleString()} left)</span></button>` : "");
    if (typeof fvItemHeart === "function") feed.querySelectorAll("[data-pin]").forEach(b => { b.style.position = "relative"; b.insertAdjacentHTML("beforeend", fvItemHeart(col, b.dataset.pin)); });
  }
  // recompute (filters or sort changed): back to the first page, the address follows
  function redraw(keepShown) {
    rows = abSorted(pmList(st.s, F), st, F);
    if (!keepShown) st.shown = AB_PAGE;
    paintTools(); paintFeed(); writeAddress();
  }
  if (typeof fvItemWireGrid === "function") fvItemWireGrid(feed, id => byId.get(id));
  host.addEventListener("click", e => {
    const t = e.target;
    const p = t.closest("[data-pin]");
    if (p) { const n = byId.get(p.dataset.pin); if (n) { buzz(6); PM_COL_DEF[col].open(n); } return; }
    const sk = t.closest("[data-ab-sortk]");
    if (sk) {
      const k = sk.dataset.abSortk; buzz(5);
      if (st.sort === k) { if (k !== "date") return; st.desc = !st.desc; } else { st.sort = k; st.desc = false; }
      redraw(); return;
    }
    if (t.closest("[data-ab-more]")) { buzz(5); st.shown += AB_PAGE; paintFeed(); return; }
    if (t.closest("[data-ab-clearall]")) { buzz(6); st.s.f = pmFilterFresh(); st.s.fav = 0; redraw(); return; }
    const cl = t.closest("[data-ab-clear]");
    if (cl) {
      const c = ($("[data-ab-chips]")._chips || [])[+cl.dataset.abClear]; if (!c) return;
      buzz(5); if (c.dim === "fav") st.s.fav = 0; else pmChipClear(st.s.f, c.dim);
      redraw(); return;
    }
    if (t.closest("[data-ab-filter]")) { buzz(5); abFilterSheet(st, F, () => redraw()); return; }
    if (t.closest("[data-ab-map]")) {
      buzz(6);
      // the map gets this exact filter (the same f shape pmRun reads) -- a deep copy, so panning the map's own
      // filters around afterwards never edits this grid's state behind its back
      const f = JSON.parse(JSON.stringify(st.s.f));
      pmOpen({ col, arr: "color", f, fav: st.s.fav, seed: -1, place: "avg", upToYear: null, mag: null }, { fresh: true });
    }
  });
  redraw(true);
  if (o.onReady) o.onReady(st, F);
}
// the Filter sheet: the map's own pane (pmFilterPane), opened over the grid; every change redraws the grid
// underneath at once, and the pane's own line says how many are left
function abFilterSheet(st, F, onChange) {
  if (document.querySelector(".sheet")) return;
  const { sh, close } = sheet(`<button class="iconq ab-sh-x" data-sheet-close aria-label="Close">${ICON.x}</button><div data-pmbody></div>`);
  sh.classList.add("ab-filter-sheet");
  sh.setAttribute("aria-label", "Filter " + pmColLabel(F, "nounP"));
  sh.querySelectorAll("[data-sheet-close]").forEach(b => b.onclick = () => { buzz(4); close(); });
  pmFilterPane(sh, st.s, F, onChange).render();
}
