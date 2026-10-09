"use strict";
// Subject palette view (David, 2026-10-09): what the map's Search opens on any subject -- a painter, a decade, a
// movement, an aesthetic/design/film look, a country, a museum. Before this, a subject search only lit six-ish
// ad-hoc colors on the map with "Learn these"/"Find them" as the only two doors. Now: a real count slider (3 up
// to the subject's real distinct named colors, capped ~200, never fewer than its data actually holds), a measure
// to rank/filter by (only the ones the data supports), filters where the data supports them (period, museum,
// family), and an arrangement to preview the result in. Learn these / Find them stay, as secondary actions
// alongside On the map (js/colorset.js csActions), never the only two.
//
// One entry point:  svOpen({ kind, id, label })
//   kind "painter"            data/analysis/artists/<id>.json -- real per-painting dominant colors (barcode),
//                              signature/avoided lift vs the archive, decade+museum derived from each painting's id/year.
//   kind "decade"|"movement"|"country"|"museum"   data/analysis/groups.json, by<Kind>[id] -- "top" is real
//                              archive-wide area share, "distinctive" is lift vs the whole archive.
//   kind "look"                data/looks.js window.LOOKS -- a hand-measured aesthetic/design/film/net style,
//                              several named palettes merged (share summed, divided by how many palettes).
// Never invents a color or a count: every number here traces to one of those three files. Where the shipped
// data holds fewer than someone might expect, the count slider's ceiling is that smaller real number, said
// plainly in the subline, not padded out.

const SV_MAXN = 200, SV_DEFAULT_N = 20, SV_MIN_N = 3;
const SV_CACHE = new Map();
const SV_GROUP_KEY = { decade: "byDecade", movement: "byMovement", country: "byCountry", museum: "bySource" };
const SV_KIND_LABEL = { painter: "Painter", decade: "Decade", movement: "Movement", country: "Country", museum: "Museum", look: "Style" };

// ---------- resolving a subject's real ranked colors (never invented -- see file header for the source per kind) ----------
function svNameHex(n) {
  const c = typeof l18Color === "function" ? l18Color(n) : null;
  return c ? c.h : null;
}
async function svLoadPainter(id) {
  await Promise.all([loadCoreNames(), loadLongNames()]);
  const A = await l18Get(`data/analysis/artists/${id}.json`);
  if (!A || !(A.barcode || []).length) return null;
  const by = new Map();
  const W = [3, 2, 1];   // a painting's barcode entry is its top-3 colors by area, biggest first
  (A.barcode || []).forEach(row => {
    const [pid, year, names] = row, seen = new Set(), mus = String(pid || "").split("-")[0];
    (names || []).forEach((nm, i) => {
      if (!nm || seen.has(nm)) return; seen.add(nm);
      let o = by.get(nm); if (!o) { o = { n: nm, weight: 0, years: new Set(), mus: new Set() }; by.set(nm, o); }
      o.weight += W[i] || 1;
      if (year != null && year > -20000) o.years.add(Math.floor(year / 10) * 10);
      if (mus) o.mus.add(mus);
    });
  });
  const total = [...by.values()].reduce((a, o) => a + o.weight, 0) || 1;
  const items = [...by.values()].map(o => { const h = svNameHex(o.n); return h ? { n: o.n, h, share: o.weight / total, years: [...o.years], mus: [...o.mus] } : null; })
    .filter(Boolean).sort((a, b) => b.share - a.share).slice(0, SV_MAXN);
  const sigSrc = (A.signatureAll && A.signatureAll.length ? A.signatureAll : A.signature) || [];
  const signature = sigSrc.map(x => { const h = svNameHex(x.name); return h ? { n: x.name, h, lift: x.lift, share: x.ownShare } : null; }).filter(Boolean);
  const decades = [...new Set(items.flatMap(x => x.years))].sort((a, b) => a - b);
  const museums = [...new Set(items.flatMap(x => x.mus))].sort();
  return { kind: "painter", id, title: A.name || id, n: A.n, unit: "painting", photo: true, items, signature, decades, museums, few: A.n < 15 };
}
async function svLoadGroup(kind, id) {
  await Promise.all([loadCoreNames(), loadLongNames()]);
  const gk = SV_GROUP_KEY[kind], G = await l18Get("data/analysis/groups.json");
  const g = G && G[gk] && G[gk][id];
  if (!g) return null;
  const mk = (x, extra) => { const h = svNameHex(x.name); return h ? Object.assign({ n: x.name, h, share: x.share || 0 }, extra) : null; };
  const items = (g.top || []).map(x => mk(x)).filter(Boolean);
  const signature = (g.distinctive || []).map(x => mk(x, { lift: x.lift })).filter(Boolean);
  signature.forEach(s => { if (!items.some(x => x.n === s.n)) items.push({ n: s.n, h: s.h, share: s.share }); });
  items.sort((a, b) => b.share - a.share);
  const title = kind === "decade" ? `${id}s` : String(id);
  return { kind, id, title, n: g.n, unit: "painting", photo: true, items, signature, decades: [], museums: [], few: g.n < 15 };
}
async function svLoadLook(id) {
  if (!window.LOOKS) await loadData("looks");
  const L = (window.LOOKS || []).find(x => x.id === id);
  if (!L || !(L.pals || []).length) return null;
  const by = new Map();
  L.pals.forEach(p => (p.c || []).forEach(([h, nm, sh]) => { let o = by.get(nm); if (!o) { o = { n: nm, h, weight: 0 }; by.set(nm, o); } o.weight += sh || 0; }));
  const n = L.pals.length;
  const items = [...by.values()].map(o => ({ n: o.n, h: o.h, share: o.weight / n })).sort((a, b) => b.share - a.share).slice(0, SV_MAXN);
  return { kind: "look", id, title: L.name, n, unit: "palette", photo: false, items, signature: [], decades: [], museums: [], few: n < 3 };
}
// museum codes (barcode ids are "<code>-<id>") -> a human label, from the gallery's own small header (never the
// heavy index.bin -- data/gallery/index.json alone is a few KB)
let SV_MUS_LABELS = null;
function svMuseumLabels() {
  return SV_MUS_LABELS || (SV_MUS_LABELS = fetch("data/gallery/index.json").then(r => r.ok ? r.json() : null)
    .then(h => { const m = new Map(); (h && h.sources || []).forEach(s => m.set(s.k, s.short || s.name)); return m; }).catch(() => new Map()));
}
function svResolve(kind, id) {
  const key = kind + ":" + id;
  if (SV_CACHE.has(key)) return SV_CACHE.get(key);
  const p = kind === "painter" ? svLoadPainter(id) : kind === "look" ? svLoadLook(id) : svLoadGroup(kind, id);
  SV_CACHE.set(key, p);
  return p;
}

// ---------- filters (only applied where the resolved data actually supports them) ----------
function svFiltered(data, f) {
  let base = data.items;
  if (f.fam) base = base.filter(x => csFamilyHas(x, f.fam));
  if (f.y0 != null && data.decades.length) base = base.filter(x => !x.years || !x.years.length || x.years.some(y => y >= f.y0 && y <= f.y1));
  if (f.mus) base = base.filter(x => !x.mus || !x.mus.length || x.mus.includes(f.mus));
  return base;
}
// ---------- measures: only offered when the data behind them yields at least 3 colors ----------
const SV_WARM = H => H < 100 || H >= 330;
function svMeasureList(data, base) {
  const withLch = base.map(x => Object.assign({ lch: lch(x.h) }, x));
  const out = [["used", "Most used"]];
  if (data.signature.length >= 3 && data.signature.some(s => base.some(b => b.n === s.n))) out.push(["signature", "Signature"]);
  const shares = withLch.map(x => x.share).sort((a, b) => a - b), med = shares.length ? shares[Math.floor(shares.length / 2)] : 0;
  if (withLch.filter(x => x.lch[1] >= 40 && x.share <= med).length >= 3) out.push(["accent", "Accents"]);
  if (withLch.filter(x => x.lch[0] >= 68).length >= 3) out.push(["light", "Lights"]);
  if (withLch.filter(x => x.lch[0] < 38).length >= 3) out.push(["dark", "Darks"]);
  const warm = withLch.filter(x => x.lch[1] >= 8 && SV_WARM(x.lch[2])), cool = withLch.filter(x => x.lch[1] >= 8 && !SV_WARM(x.lch[2]));
  if (warm.length >= 3 && cool.length >= 3) { out.push(["warm", "Warm"]); out.push(["cool", "Cool"]); }
  return out;
}
function svPool(data, measure, base) {
  const withLch = x => Object.assign({ lch: lch(x.h) }, x);
  if (measure === "signature") {
    const names = new Set(base.map(x => x.n));
    return data.signature.filter(s => names.has(s.n)).map(withLch).sort((a, b) => b.lift - a.lift);
  }
  const all = base.map(withLch);
  if (measure === "accent") { const shares = all.map(x => x.share).sort((a, b) => a - b), med = shares.length ? shares[Math.floor(shares.length / 2)] : 0; return all.filter(x => x.lch[1] >= 40 && x.share <= med).sort((a, b) => b.lch[1] - a.lch[1]); }
  if (measure === "light") return all.filter(x => x.lch[0] >= 68).sort((a, b) => b.share - a.share);
  if (measure === "dark") return all.filter(x => x.lch[0] < 38).sort((a, b) => b.share - a.share);
  if (measure === "warm") return all.filter(x => x.lch[1] >= 8 && SV_WARM(x.lch[2])).sort((a, b) => b.share - a.share);
  if (measure === "cool") return all.filter(x => x.lch[1] >= 8 && !SV_WARM(x.lch[2])).sort((a, b) => b.share - a.share);
  return all.sort((a, b) => b.share - a.share);
}
const svPct = sh => sh >= .095 ? Math.round(sh * 100) + "%" : sh >= .0095 ? (sh * 100).toFixed(1).replace(/\.0$/, "") + "%" : "<1%";

// ---------- the sheet ----------
// "map" last and relabeled (David, 2026-10-09): csActions' own "See its colors" (js/colorset.js, wired below in
// wireActs) is the real door now -- every subject's measured colors in their own honeycomb, sized by share. The
// big shared map still has a use here (previewing where a subject's colors sit among every name while you keep
// browsing its filters), so it stays, just demoted to the one arrangement chip that still means it literally.
const SV_ARR = [["strip", "Strip"], ["gridhue", "Grid"], ["ramp", "Ramp"], ["wheel", "Wheel"], ["map", "On the big map"]];
const SV_POSSESSIVE = { painter: true, look: true };   // "Monet's 20…" reads right; "1890s's 8…" does not -- those get "1890s · 8…"
function svSubline(data, shown, f) {
  const parts = [];
  if (f.fam) parts.push(f.fam.toLowerCase());
  if (f.y0 != null) parts.push(`${f.y0}s–${f.y1}s`);
  const qualifier = parts.length ? ` (${parts.join(", ")})` : "";
  const unitLbl = data.unit === "palette" ? `measured palette${data.n === 1 ? "" : "s"}` : `painting${data.n === 1 ? "" : "s"} in the archive`;
  const count = `${shown.length} most-used color${shown.length === 1 ? "" : "s"} across ${data.n.toLocaleString()} ${unitLbl}`;
  let s = SV_POSSESSIVE[data.kind] ? `${data.title}${qualifier}'s ${count}` : `${data.title}${qualifier} · ${count}`;
  if (data.photo) s += " · as photographed";
  if (data.few) s += " · few sampled";
  return s;
}
function svChip(x) {
  return `<button class="sv-chip" data-sv-h="${esc(x.h)}" aria-label="${esc(x.n)} · ${svPct(x.share)}"><i style="background:${esc(x.h)}"></i><b>${esc(x.n)}</b><em>${svPct(x.share)}</em></button>`;
}
function svArrHTML(arr, shown) {
  if (!shown.length) return `<p class="fine sv-empty">Nothing matches this filter yet. Try fewer filters.</p>`;
  if (arr === "strip") return `<div class="sv-strip">${shown.map(x => `<button class="sv-strip-c" style="--c:${x.h};flex:${Math.max(x.share, .012).toFixed(4)}" data-sv-h="${esc(x.h)}" aria-label="${esc(x.n)} · ${svPct(x.share)}"></button>`).join("")}</div>
    <div class="sv-legend">${shown.slice(0, 10).map(svChip).join("")}${shown.length > 10 ? `<span class="sv-more">+${shown.length - 10} more</span>` : ""}</div>`;
  if (arr === "gridhue") { const s = shown.slice().sort((a, b) => lch(a.h)[2] - lch(b.h)[2]); return `<div class="sv-grid">${s.map(x => `<button class="sv-tile" style="--c:${x.h}" data-sv-h="${esc(x.h)}" aria-label="${esc(x.n)} · ${svPct(x.share)}"><span>${esc(x.n)}</span></button>`).join("")}</div>`; }
  if (arr === "ramp") { const s = shown.slice().sort((a, b) => lch(b.h)[0] - lch(a.h)[0]); return `<div class="sv-ramp">${s.map(x => `<button class="sv-ramp-c" style="--c:${x.h}" data-sv-h="${esc(x.h)}" aria-label="${esc(x.n)} · ${svPct(x.share)}"><b>${esc(x.n)}</b><em>${svPct(x.share)}</em></button>`).join("")}</div>`; }
  if (arr === "wheel") {
    const R = 120, dots = shown.map(x => { const [L, C, H] = lch(x.h), r = Math.min(R, 8 + C * 1.6), rad = H * Math.PI / 180;
      return `<button class="sv-dot" style="--c:${x.h};--x:${(Math.cos(rad) * r).toFixed(1)}px;--y:${(Math.sin(rad) * r).toFixed(1)}px;--s:${Math.max(16, Math.min(34, 14 + x.share * 90)).toFixed(0)}px" data-sv-h="${esc(x.h)}" aria-label="${esc(x.n)} · ${svPct(x.share)}"></button>`; }).join("");
    return `<div class="sv-wheel">${dots}<i class="sv-wheel-mid"></i></div>`;
  }
  return "";   // "map" hands off instead of rendering here (see svArrange)
}

// ---------- a real address, #/subject/<kind>/<id> (router.js ROUTED + openRoute; PAGES-AUDIT.md plan item 3,
// David 2026-10-09: "the richest new screen in the app... unlinkable and unshareable") ----------
// svOpen is a sheet (js/core.js sheet()), not a show()-based screen, so it has none of js/trail.js's usual
// free rides: no routeCommit() from show(), no auto "r:" trail join from tlNote(). Both are added here, in this
// file, instead of touching trail.js's own xBack/show logic: every open commits the address and title (its
// ROUTED entry in router.js sets ROUTE_NEXT the instant before this runs) and pushes one "sv:" trail token
// (same shape as galleryPage's "g:i"), and both undo themselves once the sheet is actually gone -- a
// MutationObserver, since every internal close path (scrim tap, swipe-down, Escape) calls sheet()'s own close
// directly, never the wrapped one returned to a caller.
function svResolveSlug(kind, slug) {
  if (kind === "decade") return Promise.resolve(/^\d+$/.test(slug) ? +slug : null);
  if (kind === "painter" || kind === "look") return Promise.resolve(slug);   // already slug-safe real ids
  return l18Get("data/analysis/groups.json").then(G => {
    const gk = SV_GROUP_KEY[kind], keys = G && G[gk] ? Object.keys(G[gk]) : [];
    return keys.find(k => routeSlug(k) === slug) || null;
  }).catch(() => null);
}
function svOpenRoute(kind, slug) {
  if (!SV_KIND_LABEL[kind]) return typeof xToOrigin === "function" ? xToOrigin() : go(S.tab || "learn");
  svResolveSlug(kind, slug).then(id => {
    if (id == null) return typeof xToOrigin === "function" ? xToOrigin() : go(S.tab || "learn");
    svOpen({ kind, id, label: kind === "decade" ? id + "s" : String(id) });
  }).catch(() => { if (typeof xToOrigin === "function") xToOrigin(); });
}
// tok -> { hash, title } from just BEFORE it first opened. Kept across a replay (js/explore.js xStep, "sv:"),
// so closing it after a detour (open the subject, tap a color, come back, then close) still lands on where the
// trail really started, not on the color page visited in between.
const SV_PREV = new Map();
function svOpen(subject, o = {}) {
  const kind = subject.kind, id = subject.id, label = subject.label || "";
  const tok = "sv:" + kind + ":" + encodeURIComponent(String(id));
  const isNew = typeof XSTACK === "undefined" || XSTACK[XSTACK.length - 1] !== tok;
  let navigated = false;
  try {
    if (typeof ROUTE_NEXT !== "undefined" && ROUTE_NEXT && typeof routeCommit === "function") {
      // ROUTE_NOW only ever gets set by routeCommit() itself, so on a cold direct load of #/subject/... (no
      // earlier screen ever committed a route this session) it's still "" -- location.hash is what router.js's
      // own base() already put in the address bar for the tab underneath, and the one honest fallback here
      if (isNew) SV_PREV.set(tok, { hash: (typeof ROUTE_NOW !== "undefined" && ROUTE_NOW) || location.hash || "", title: document.title });
      routeCommit();
      navigated = true;
    }
  } catch (e) {}
  if (navigated && isNew) {
    XSTACK.push(tok);
    if (typeof TL_META !== "undefined") TL_META.set(tok, { title: label || String(id), hash: ROUTE_NOW, c: "", img: "", sw: [] });
    if (typeof tlSave === "function") tlSave();
  }
  const { sh, close } = sheet(`<p class="eyebrow">${esc(SV_KIND_LABEL[kind] || "Subject")}</p>
    <h1 class="sv-title">${esc(label || id)}</h1>
    <p class="sv-sub" data-sv-sub>Looking up its measured colors…</p>
    <div class="sv-body" data-sv-body><p class="fine">Loading…</p></div>`);
  sh.classList.add("sv-sheet");
  if (navigated) {
    const obs = new MutationObserver(() => {
      if (document.body.contains(sh)) return;
      obs.disconnect();
      try {
        if (typeof XSTACK !== "undefined" && XSTACK[XSTACK.length - 1] === tok) XSTACK.pop();
        if (typeof TL_META !== "undefined") TL_META.delete(tok);
        const prev = SV_PREV.get(tok) || { hash: "", title: document.title };
        SV_PREV.delete(tok);
        history.replaceState({ ch: 1 }, "", prev.hash || undefined);
        if (typeof ROUTE_NOW !== "undefined") ROUTE_NOW = prev.hash;
        document.title = prev.title || document.title;
        if (typeof tlSave === "function") tlSave();
      } catch (e) {}
    });
    obs.observe(document.body, { childList: true });
  }
  svResolve(kind, id).then(data => {
    if (!data || !data.items.length) { sh.querySelector("[data-sv-sub]").textContent = "No measured colors for this yet."; sh.querySelector("[data-sv-body]").innerHTML = ""; return; }
    return (data.museums.length ? svMuseumLabels() : Promise.resolve(new Map())).then(labels => { data.museumLabels = labels; svRender(sh, data, o); });
  }).catch(() => { sh.querySelector("[data-sv-sub]").textContent = "Couldn't load its measured colors."; });
  return { close };
}
function svRender(sh, data, o) {
  const f = { fam: "", y0: null, y1: null, mus: "" };
  let measure = "used", arr = "strip", count = Math.min(SV_DEFAULT_N, data.items.length);
  const famOptions = CS_FAMS.filter(fam => data.items.some(x => csFamilyHas(x, fam)));
  const title = sh.querySelector(".sv-title"), sub = sh.querySelector("[data-sv-sub]"), body = sh.querySelector("[data-sv-body]");
  title.textContent = data.title;
  function currentShown() {
    const base = svFiltered(data, f), pool = svPool(data, measure, base);
    return pool.slice(0, Math.min(count, pool.length));
  }
  function paint(resetCount) {
    const base = svFiltered(data, f), measures = svMeasureList(data, base);
    if (!measures.some(m => m[0] === measure)) measure = "used";
    const pool = svPool(data, measure, base), max = Math.max(SV_MIN_N, Math.min(SV_MAXN, pool.length));
    if (resetCount || count > max) count = Math.min(resetCount ? SV_DEFAULT_N : count, max);
    if (count < SV_MIN_N) count = Math.min(SV_MIN_N, max);
    const shown = pool.slice(0, count);
    sub.textContent = svSubline(data, shown, f);
    const measureRow = `<div class="sv-row sv-measures" role="group" aria-label="Rank by">${measures.map(([k, t]) => `<button class="sv-chip-sm${measure === k ? " on" : ""}" data-sv-measure="${k}">${t}</button>`).join("")}</div>`;
    const famRow = famOptions.length ? `<div class="sv-row sv-filters" role="group" aria-label="Just one family">
        <button class="sv-chip-sm${!f.fam ? " on" : ""}" data-sv-fam="">All</button>
        ${famOptions.map(fam => `<button class="sv-chip-sm${f.fam === fam ? " on" : ""}" data-sv-fam="${esc(fam)}">${esc(fam)}</button>`).join("")}
      </div>` : "";
    const decRow = data.decades.length > 1 ? `<div class="sv-row sv-filters" role="group" aria-label="A period">
        <button class="sv-chip-sm${f.y0 == null ? " on" : ""}" data-sv-dec="">Every period</button>
        ${data.decades.map(d => `<button class="sv-chip-sm${f.y0 === d ? " on" : ""}" data-sv-dec="${d}">${d}s</button>`).join("")}
      </div>` : "";
    const musRow = data.museums.length > 1 ? `<div class="sv-row sv-filters" role="group" aria-label="A museum">
        <button class="sv-chip-sm${!f.mus ? " on" : ""}" data-sv-mus="">Every museum</button>
        ${data.museums.map(m => `<button class="sv-chip-sm${f.mus === m ? " on" : ""}" data-sv-mus="${esc(m)}">${esc((data.museumLabels && data.museumLabels.get(m)) || m.toUpperCase())}</button>`).join("")}
      </div>` : "";
    const arrRow = `<div class="sv-row sv-seg" role="group" aria-label="How to preview them">${SV_ARR.map(([k, t]) => `<button class="sv-seg-b${arr === k ? " on" : ""}" data-sv-arr="${k}">${t}</button>`).join("")}</div>`;
    body.innerHTML = `
      <div class="sv-count"><label class="sv-count-l"><span>How many</span><input type="range" aria-label="How many colors"><b data-sv-n></b></label></div>
      ${measureRow}${famRow}${decRow}${musRow}${arrRow}
      <div class="sv-canvas" data-sv-canvas>${svArrHTML(arr === "map" ? "strip" : arr, shown)}</div>
      <div class="sv-acts" data-sv-acts></div>
      <p class="fine sv-fine">Screen colors are approximate${count > 24 ? "; On the map, Learn and Find them use your top 24" : ""}.</p>`;
    const input = body.querySelector(".sv-count input"), kOut = body.querySelector("[data-sv-n]");
    kOut.textContent = count;
    countify(input, { min: SV_MIN_N, max, value: count, out: kOut, onSet: (v, final) => { count = v; kOut.textContent = v; paintCanvasOnly(); if (final) buzz(3); } });
    function wireCanvas() { body.querySelectorAll("[data-sv-canvas] [data-sv-h]").forEach(b => b.onclick = () => { buzz(5); openTappedColor(b.dataset.svH); }); }
    function wireActs(sh2) {
      const row = csActions(() => colorSet({ kind: data.kind, id: data.id, title: svSubline(data, sh2, f), colors: sh2.map(x => ({ h: x.h, n: x.n, share: x.share })), src: o.src || "" }), { only: ["map", "learn", "play"] });
      const host = body.querySelector("[data-sv-acts]"); host.innerHTML = ""; host.appendChild(row);
    }
    function paintCanvasOnly() {
      const sh2 = currentShown();
      sub.textContent = svSubline(data, sh2, f);
      body.querySelector("[data-sv-canvas]").innerHTML = svArrHTML(arr === "map" ? "strip" : arr, sh2);
      body.querySelector(".sv-fine").textContent = `Screen colors are approximate${count > 24 ? "; On the map, Learn and Find them use your top 24" : ""}.`;
      wireCanvas(); wireActs(sh2);
    }
    wireCanvas(); wireActs(shown);
    body.querySelectorAll("[data-sv-measure]").forEach(b => b.onclick = () => { buzz(4); measure = b.dataset.svMeasure; paint(true); });
    body.querySelectorAll("[data-sv-fam]").forEach(b => b.onclick = () => { buzz(4); f.fam = b.dataset.svFam; paint(true); });
    body.querySelectorAll("[data-sv-dec]").forEach(b => b.onclick = () => { buzz(4); const d = b.dataset.svDec; if (d === "") { f.y0 = f.y1 = null; } else { f.y0 = +d; f.y1 = +d + 9; } paint(true); });
    body.querySelectorAll("[data-sv-mus]").forEach(b => b.onclick = () => { buzz(4); f.mus = b.dataset.svMus; paint(true); });
    body.querySelectorAll("[data-sv-arr]").forEach(b => b.onclick = () => {
      buzz(4); arr = b.dataset.svArr;
      body.querySelectorAll("[data-sv-arr]").forEach(x => x.classList.toggle("on", x === b));
      if (arr === "map") { const sh3 = currentShown(); if (typeof mapSelect === "function") mapSelect({ title: data.title, colors: sh3.map(x => ({ h: x.h, n: x.n, share: x.share })), source: data.kind, id: data.id }); return; }
      body.querySelector("[data-sv-canvas]").innerHTML = svArrHTML(arr, currentShown());
      wireCanvas();
    });
  }
  paint(true);
}
