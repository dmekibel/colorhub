"use strict";
// Where a color lives in paintings (lane L26): the two sliders, the "In paintings" section on a color page, the
// full screen #/paintings-of/<hex>[+<hex>...], and the arrival on a painting (the pinned color, how much of the
// canvas it covers, a map of where). The data and the query are js/colorindex.js; this file is only screens.
//
//   ptSliders(host, state, onChange, o)    the two sliders + presets; reusable (Explore's Art feed uses it too)
//   paintingsOfSection(hex, host, o)       one hook for a color page: the rail, the sliders, "Often paired with"
//   paintingsOfPage(hexes, o)              the full screen for one color or a set of up to five
//   ptArrival(el, o)                       the pinned color + coverage + map on a painting page (js/gallery.js glPage)
// state = { tol, minCover, maxCover?, mode, sort, source }; tol is "% different", minCover a % of the canvas.

const PT_TOL = [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 15];
const PT_MIN = [.05, .1, .25, .5, 1, 2, 3, 5, 8, 12, 20, 35, 50];
const PT_PRE_TOL = [["Exact", 0], ["Close", 3], ["Family", 10]];
const PT_PRE_MIN = [["Accent", .5, 5], ["Some", 5, null], ["Dominant", 20, null]];
const PT_SORTS = [["cover", "Most of it"], ["close", "Closest"], ["date", "Oldest first"]];
const PT_MODES = [["all", "All of them"], ["any", "Any"], ["palette", "As a palette"]];
const PT_ICON_PLUS = sv('<path d="M12 5v14M5 12h14"/>', 16, 1.8);
const PT_ICON_X = sv('<path d="M6 6l12 12M18 6L6 18"/>', 14, 1.8);
const PT_ICON_MAP = sv('<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/>', 18, 1.8);
let PT_PREF = { tol: 3, minCover: 5, maxCover: null, mode: "all", sort: "cover", source: "paintings" };
try { const s = JSON.parse(localStorage.getItem("colorhub-pt") || "null"); if (s && PT_TOL.includes(s.tol) && PT_MIN.includes(s.minCover)) Object.assign(PT_PREF, { tol: s.tol, minCover: s.minCover, maxCover: s.maxCover || null }); } catch (e) {}
const ptSave = st => { Object.assign(PT_PREF, { tol: st.tol, minCover: st.minCover, maxCover: st.maxCover || null }); try { localStorage.setItem("colorhub-pt", JSON.stringify({ tol: st.tol, minCover: st.minCover, maxCover: st.maxCover || null })); } catch (e) {} };

// a design piece's tile (data/design/colorindex/items.json): its own six colors, then what it is
CI_SOURCES.design.pin = (r, st) => {
  const it = (CI_SOURCES.design.items || [])[r.i];
  if (!it) return `<span class="pt-tile"><b>Design piece</b></span>`;
  return `<span class="pt-tile pt-design"><span class="pt-dstrip">${it[5].map(h => `<i style="--c:${h}"></i>`).join("")}</span><em>${ptPct(r.cover)} of the piece</em><b>${esc(it[1])}</b><small>${esc([it[2], it[3]].filter(Boolean).join(" · "))}${it[4] ? (it[2] || it[3] ? " · " : "") + esc(it[4]) : ""}</small></span>`;
};

// ---------- words ----------
const ptPct = c => c >= 10 ? Math.round(c) + "%" : c >= 1 ? (+c.toFixed(1)) + "%" : c >= .1 ? (+c.toFixed(2)) + "%" : "under 0.1%";
const ptNum = n => n.toLocaleString("en-US");
const ptNth = n => { const s = ["th", "st", "nd", "rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
const ptTolWord = t => t === 0 ? "exactly this color" : `within ${t}%`;
const ptCoverWord = (m, mx) => mx ? `between ${m}% and ${mx}% of the painting` : m <= .05 ? "even a single speck" : m >= 50 ? "half the painting or more" : `at least ${m}% of the painting`;
const ptTolShort = t => t === 0 ? "Exact" : t + "%";
function ptNear(hex) { const n = nameOf(hex); return n.de < VERY_CLOSE_DE ? n.n : n.text; }

// ---------- the edge of the range: the colors exactly `tol` away in six directions ----------
function ptEdge(hex, tol) {
  const [L, C, H] = lch(hex), at = (dL, dC, dH, s) => lchHex(clamp(L + dL * s, 0, 100), Math.max(0, C + dC * s), (H + dH * s + 360) % 360);
  const target = lab(hex), reach = (dL, dC, dH) => {
    let lo = 0, hi = 90;
    for (let k = 0; k < 18; k++) {
      const m = (lo + hi) / 2, d = de2000(target, lab(at(dL, dC, dH, m)));
      if (d < tol) lo = m; else hi = m;
    }
    return (lo + hi) / 2;
  };
  if (!tol) return [];
  const dirs = [["darker", -1, 0, 0], ["duller", 0, -1, 0]];
  if (C > 6) dirs.push(["hue one way", 0, 0, -1], ["hue the other way", 0, 0, 1]);
  dirs.push(["more vivid", 0, 1, 0], ["lighter", 1, 0, 0]);
  return dirs.map(([t, a, b, c]) => ({ t, h: at(a, b, c, reach(a, b, c)) }));
}

// ---------- the two sliders ----------
// host: an element to fill. state is read and written in place; onChange(state) fires as the finger moves.
// Returns { set(state), count(html), el }. o.compact hides the slider tracks behind a "Fine-tune" disclosure.
function ptSliders(host, state, onChange, o = {}) {
  const ti = () => Math.max(0, PT_TOL.indexOf(state.tol)), mi = () => Math.max(0, PT_MIN.indexOf(state.minCover));
  host.innerHTML = `<div class="pt-sl${o.compact ? " compact" : ""}">
    ${o.hex ? `<div class="pt-fan" data-fan></div>` : ""}
    <div class="pt-ctl" data-k="tol">
      <div class="pt-ctl-h"><b>How close</b><span data-v></span></div>
      <input class="pt-range" type="range" min="0" max="${PT_TOL.length - 1}" step="1" aria-label="How close a color must be">
      <div class="pt-chips">${PT_PRE_TOL.map(([t, v]) => `<button data-pre-tol="${v}">${t}</button>`).join("")}</div>
    </div>
    <div class="pt-ctl" data-k="min">
      <div class="pt-ctl-h"><b>How much of the painting</b><span data-v></span></div>
      <input class="pt-range" type="range" min="0" max="${PT_MIN.length - 1}" step="1" aria-label="How much of the painting">
      <div class="pt-chips">${PT_PRE_MIN.map(([t, v, mx]) => `<button data-pre-min="${v}" data-pre-max="${mx || ""}">${t}</button>`).join("")}</div>
    </div>
    ${o.noCount ? "" : `<p class="pt-count" data-count aria-live="polite"></p>`}
  </div>`;
  const [rt, rm] = host.querySelectorAll(".pt-range"), $ = q => host.querySelector(q);
  const paint = () => {
    rt.value = ti(); rm.value = mi();
    rt.style.setProperty("--p", (ti() / (PT_TOL.length - 1) * 100) + "%"); rm.style.setProperty("--p", (mi() / (PT_MIN.length - 1) * 100) + "%");
    $('[data-k="tol"] [data-v]').textContent = ptTolWord(state.tol);
    $('[data-k="min"] [data-v]').textContent = ptCoverWord(state.minCover, state.maxCover);
    host.querySelectorAll("[data-pre-tol]").forEach(b => b.classList.toggle("on", +b.dataset.preTol === state.tol));
    host.querySelectorAll("[data-pre-min]").forEach(b => b.classList.toggle("on", +b.dataset.preMin === state.minCover && (+b.dataset.preMax || null) === (state.maxCover || null)));
    const fan = $("[data-fan]");
    if (fan && o.hex) {
      const edge = ptEdge(o.hex, state.tol);
      fan.innerHTML = state.tol === 0 ? `<i class="c" style="--c:${o.hex}"></i><span>Only this color, as far as the photographs can tell.</span>`
        : `<div class="ring">${edge.slice(0, Math.ceil(edge.length / 2)).map(e => `<i style="--c:${e.h}" title="${e.t}"></i>`).join("")}<i class="c" style="--c:${o.hex}"></i>${edge.slice(Math.ceil(edge.length / 2)).map(e => `<i style="--c:${e.h}" title="${e.t}"></i>`).join("")}</div><span>The edge of “${ptTolWord(state.tol)}”: these colors just count.</span>`;
    }
  };
  const fire = () => { paint(); onChange(state); };
  rt.addEventListener("input", () => { const t = PT_TOL[+rt.value]; if (t !== state.tol) { state.tol = t; buzz(3); fire(); } });
  rm.addEventListener("input", () => { const m = PT_MIN[+rm.value]; if (m !== state.minCover || state.maxCover) { state.minCover = m; state.maxCover = null; buzz(3); fire(); } });
  host.addEventListener("click", e => {
    const a = e.target.closest("[data-pre-tol]"), b = e.target.closest("[data-pre-min]");
    if (a) { state.tol = +a.dataset.preTol; buzz(6); fire(); }
    if (b) { state.minCover = +b.dataset.preMin; state.maxCover = +b.dataset.preMax || null; buzz(6); fire(); }
  });
  paint();
  return { el: host, set(s) { Object.assign(state, s); paint(); }, count(html) { const c = $("[data-count]"); if (c) c.innerHTML = html; } };
}

// ---------- "Often paired with": the affinity table, each pair opens the live query ----------
function ptPairsHTML(name, aff, hex) {
  if (!aff || (!aff.c && !aff.a)) return "";
  const comp = (aff.c || []).slice(0, 8), avo = (aff.a || []).slice(0, 5);
  return `${comp.length ? `<h3>Often paired with</h3>
    <p class="gl-in-sub">Colors that turn up in the same paintings as ${esc(name.toLowerCase())} more often than chance would put them there.</p>
    <div class="pt-pairs">${comp.map(([n, h, k, l]) => `<button class="pt-pair" data-pt-pair="${h}" data-pt-pname="${esc(n)}"><i style="--c:${h}"></i><b>${esc(n)}</b><span>${l >= 10 ? Math.round(l) : l.toFixed(1)}× chance · ${ptNum(k)} paintings</span></button>`).join("")}</div>` : ""}
    ${avo.length ? `<h3>Seldom seen with</h3>
    <p class="gl-in-sub">Painters rarely put these next to ${esc(name.toLowerCase())}.</p>
    <div class="pt-pairs">${avo.map(([n, h, e, k, l]) => `<button class="pt-pair" data-pt-pair="${h}" data-pt-pname="${esc(n)}"><i style="--c:${h}"></i><b>${esc(n)}</b><span>${ptNum(k)} together, ${ptNum(Math.round(e))} expected</span></button>`).join("")}</div>` : ""}
    <p class="fine">Counted over ${ptNum(CI_SOURCES.paintings.n || 0)} paintings, as photographed: a painting has a color when something within 4% of it covers at least 1% of the canvas. “× chance” compares with the colors being scattered independently.</p>
    ${typeof chordsPage === "function" ? `<button class="btn ghost gl-all" data-pt-chords>Which pairs do painters favor overall? ${ICON.arrow}</button>` : ""}`;
}

// ---------- the "In paintings" section of a color page ----------
// hex: the color; host: the section's element; o: { name }. One hook, so the color page and the name page share it.
function paintingsOfSection(hex, host, o = {}) {
  if (!host) return;
  hex = hex.toUpperCase();
  const name = o.name || ptNear(hex), st = { ...PT_PREF, mode: "all", sort: "cover", source: "paintings" };
  let tuner = null, seq = 0;
  const shell = () => {
    host.innerHTML = `<h3>In paintings</h3>
      <p class="gl-in-sub" data-pt-lead>Where ${esc(name.toLowerCase())} lives in paintings, measured pixel by pixel in the museum photographs.</p>
      <div class="pt-quick" data-pt-quick></div>
      <div class="gl-rail" data-pt-rail><p class="fine">Finding paintings…</p></div>
      <div class="pt-foot"><button class="btn ghost gl-all" data-pt-all hidden></button><button class="pt-tune" data-pt-tune>Fine-tune</button></div>
      <div class="pt-tuner" data-pt-tuner hidden></div>
      <div class="pt-pairs-host" data-pt-pairs></div>`;
    host.querySelector("[data-pt-quick]").innerHTML = `<div class="pt-chips">${PT_PRE_TOL.map(([t, v]) => `<button data-pre-tol="${v}">${t}</button>`).join("")}</div>`;
  };
  const refresh = () => {
    const my = ++seq, rail = host.querySelector("[data-pt-rail]");
    if (!rail) return;
    host.querySelectorAll("[data-pre-tol]").forEach(b => b.classList.toggle("on", +b.dataset.preTol === st.tol));
    Promise.all([loadGallery(), paintingsFor(hex, st)]).then(([, res]) => {
      if (my !== seq || !host.isConnected) return;
      const lead = host.querySelector("[data-pt-lead]"), all = host.querySelector("[data-pt-all]");
      const words = `${ptTolWord(st.tol)}, ${ptCoverWord(st.minCover, st.maxCover)}`;
      if (tuner) tuner.count(res.count ? `<b>${ptNum(res.count)}</b> ${res.count === 1 ? "painting" : "paintings"} ${words}` : `Nothing at this setting.`);
      if (!res.count) {
        lead.innerHTML = `No painting has ${esc(name.toLowerCase())} ${esc(words)}.`;
        paintingsFor(hex, { ...st, tol: Math.max(st.tol, 6), minCover: Math.min(st.minCover, 1), maxCover: null }).then(loose => {
          if (my !== seq || !host.isConnected) return;
          rail.innerHTML = loose.count ? `<button class="btn ghost gl-all" data-pt-loosen>${ptNum(loose.count)} paintings are within ${Math.max(st.tol, 6)}% and cover 1% ${ICON.arrow}</button>` : `<p class="fine">Nothing in the gallery comes near this color.</p>`;
          host.querySelector("[data-pt-loosen]") && (host.querySelector("[data-pt-loosen]").onclick = () => { Object.assign(st, { tol: Math.max(st.tol, 6), minCover: Math.min(st.minCover, 1), maxCover: null }); ptSave(st); if (tuner) tuner.set(st); refresh(); });
        });
        all.hidden = true;
        return;
      }
      lead.innerHTML = `<b>${ptNum(res.count)}</b> ${res.count === 1 ? "painting" : "paintings"} ${esc(words)} (${res.count / res.n * 100 < 1 ? "under 1" : Math.round(res.count / res.n * 100)}% of ${ptNum(res.n)}).`;
      const top = res.rows.slice(0, 8);
      rail.innerHTML = top.map(r => glPinHTML(r.i, { badge: `${ptPct(r.cover)} of the canvas` })).join("");
      glFill(rail);
      rail._rows = top;
      all.hidden = false; all.innerHTML = `See all ${ptNum(res.count)} ${ICON.arrow}`;
    }).catch(() => { if (my === seq && host.isConnected) host.querySelector("[data-pt-rail]").innerHTML = `<p class="fine">The paintings didn't load. <button class="wl" data-pt-retry>Try again</button></p>`; });
  };
  const start = () => {
    shell(); refresh();
    // the facts that don't need the gallery: how many, stated in the one definition the field notes use
    ciAffinity(name).then(aff => {
      const sl = host.querySelector("[data-pt-pairs]"); if (!sl || !aff) return;
      sl.innerHTML = ptPairsHTML(name, aff, hex);
    });
  };
  host.onclick = e => {
    const p = e.target.closest("[data-gi]");
    if (p) { const r = (host.querySelector("[data-pt-rail]")._rows || []).find(x => x.i === +p.dataset.gi); return galleryPage(+p.dataset.gi, true, hex, st.tol); }
    if (e.target.closest("[data-pt-all]")) return paintingsOfPage([hex], { ...st, back: true });
    const a = e.target.closest("[data-pre-tol]");
    if (a && !a.closest("[data-pt-tuner]")) { st.tol = +a.dataset.preTol; ptSave(st); buzz(6); if (tuner) tuner.set(st); return refresh(); }
    if (e.target.closest("[data-pt-tune]")) {
      const box = host.querySelector("[data-pt-tuner]");
      box.hidden = !box.hidden;
      host.querySelector("[data-pt-tune]").textContent = box.hidden ? "Fine-tune" : "Done";
      if (!box.hidden && !tuner) { tuner = ptSliders(box, st, () => { ptSave(st); refresh(); }, { hex }); refresh(); }
      return;
    }
    const pair = e.target.closest("[data-pt-pair]");
    if (pair) return paintingsOfPage([hex, pair.dataset.ptPair], { tol: CI_STD.tol, minCover: CI_STD.minCover, maxCover: null, mode: "all", names: [name, pair.dataset.ptPname] });
    if (e.target.closest("[data-pt-chords]") && typeof chordsPage === "function") return chordsPage();
    if (e.target.closest("[data-pt-retry]")) return refresh();
  };
  // the gallery loads when the section scrolls near the screen
  host.innerHTML = `<h3>In paintings</h3><div class="pt-wait">Paintings with ${esc(name.toLowerCase())} load as you scroll.</div>`;
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(es => { if (es[0].isIntersecting) { io.disconnect(); start(); } }, { rootMargin: "500px 0px" });
    io.observe(host); cleanup.push(() => io.disconnect());
  } else start();
}

// ---------- the full screen: one color or a set ----------
const ptHexList = h => (Array.isArray(h) ? h : String(h || "").split(/[+,]/)).map(x => "#" + String(x).replace(/^#+/, "").toUpperCase()).filter(x => /^#[0-9A-F]{6}$/.test(x)).slice(0, 5);
function ptSpec(hexes, st) {
  const q = [`t=${st.tol}`, `m=${st.minCover}`];
  if (st.maxCover) q.push(`x=${st.maxCover}`);
  if (hexes.length > 1 && st.mode !== "all") q.push(`mode=${st.mode}`);
  if (st.sort && st.sort !== "cover") q.push(`s=${st.sort}`);
  if (st.source && st.source !== "paintings") q.push(`src=${st.source}`);
  return hexes.map(h => h.replace("#", "").toLowerCase()).join("+") + "?" + q.join("&");
}
function ptParse(spec) {
  const [h, qs] = String(spec).split("?"), q = new URLSearchParams(qs || ""), st = { ...PT_PREF };
  const num = (k, list) => { const v = parseFloat(q.get(k)); return list.includes(v) ? v : null; };
  const t = num("t", PT_TOL), m = num("m", PT_MIN), x = parseFloat(q.get("x"));
  if (t != null) st.tol = t; if (m != null) st.minCover = m; st.maxCover = x > 0 ? x : null;
  if (PT_MODES.some(a => a[0] === q.get("mode"))) st.mode = q.get("mode"); else st.mode = "all";
  st.sort = PT_SORTS.some(a => a[0] === q.get("s")) ? q.get("s") : "cover";
  st.source = ["paintings", "design", "both"].includes(q.get("src")) ? q.get("src") : "paintings";
  return { hexes: ptHexList(h), st };
}
// the address: a plain pair at the standard definition is #/pair/<a>+<b> (the chords page's numbers); anything else is #/paintings-of/...
const ptIsPair = (hexes, st) => hexes.length === 2 && st.tol === CI_STD.tol && st.minCover === CI_STD.minCover && !st.maxCover && st.mode === "all" && st.sort === "cover" && st.source === "paintings";
const ptPath = (hexes, st) => ptIsPair(hexes, st) ? "pair/" + hexes.map(h => h.replace("#", "").toLowerCase()).join("+") : "paintings-of/" + ptSpec(hexes, st);
function ptSyncURL(hexes, st) {
  const path = ptPath(hexes, st), url = "#/" + path;
  try { if (location.hash !== url) { history.replaceState(history.state, "", url); ROUTE_NOW = url; } } catch (e) {}
  document.title = `${hexes.map(ptNear).join(" + ")} in paintings · ColorHub`;
}
let PT_PAGE = null;
function paintingsOfPage(hexes, o = {}) {
  hexes = ptHexList(hexes);
  if (!hexes.length) return go(S.tab || "learn");
  const st = { ...PT_PREF, mode: "all", sort: "cover", source: "paintings" };
  ["tol", "minCover", "maxCover", "mode", "sort", "source"].forEach(k => { if (o[k] !== undefined) st[k] = o[k]; });
  const names = new Map(); (o.names || []).forEach((n, i) => { if (n && hexes[i]) names.set(hexes[i], n); });
  const nm = h => names.get(h) || ptNear(h);
  if (o.push !== false && XSTACK[XSTACK.length - 1] !== "pt:" + ptSpec(hexes, st)) XSTACK.push("pt:" + ptSpec(hexes, st));
  const set = () => colorSet({ kind: "paintings-of", id: hexes.join("+"), title: hexes.map(nm).join(" + "), colors: hexes.map(h => ({ h, n: nm(h) })), src: "paintings-of/" + ptSpec(hexes, st) });
  const el = show(`
    <header class="art-top"><button class="icon-btn glass" data-back aria-label="Back">${ICON.back}</button></header>
    <p class="eyebrow p-type">Color in paintings</p>
    <h1 class="p-title" data-title></h1>
    <div class="pt-chipsrow" data-colors></div>
    <div class="pt-seg-row" data-modes hidden></div>
    <div class="pt-seg-row" data-sources hidden></div>
    <p class="pt-finding" data-finding aria-live="polite"></p>
    <p class="pt-take" data-take hidden></p>
    <div data-sliders></div>
    <div class="pt-acts" data-acts></div>
    <details class="pt-stats" data-stats hidden><summary>What the numbers say</summary><div data-statsbody></div></details>
    <div class="pt-sortrow" data-sortrow><div class="pt-seg">${PT_SORTS.map(([k, t]) => `<button data-sort="${k}">${t}</button>`).join("")}</div></div>
    <div class="pt-results" data-results><p class="fine">Finding paintings…</p></div>
    <p class="fine">Measured pixel by pixel in the museums' own small photographs (about 200 px wide), so these are photographs of varnished paintings: colors as photographed, screen colors approximate. “Within 3%” means CIEDE2000 between two colors is at most 3% of the black-to-white difference.</p>
  `, "article pt-page");
  el.querySelector("[data-back]").onclick = xBack;
  onKey = e => { if (e.key === "Escape") xBack(); };
  let seq = 0, shown = 0, rows = [], tuner = null, lastRes = null;
  const PAGE = 36;
  const colorsRow = () => {
    el.querySelector("[data-colors]").innerHTML = hexes.map((h, i) => `<span class="pt-chip"><button class="pt-chip-c" data-open="${h}" aria-label="${esc(nm(h))}"><i style="--c:${h}"></i><b>${esc(nm(h))}</b></button>${hexes.length > 1 ? `<button class="pt-chip-x" data-drop="${i}" aria-label="Remove ${esc(nm(h))}">${PT_ICON_X}</button>` : ""}</span>`).join("")
      + (hexes.length < 5 ? `<button class="pt-add" data-add>${PT_ICON_PLUS}<span>${hexes.length === 1 ? "Add a color to see which paintings hold both" : "Add"}</span></button>` : "");
    el.querySelector("[data-title]").textContent = hexes.map(nm).join(" + ");
    const mr = el.querySelector("[data-modes]");
    mr.hidden = hexes.length < 2;
    mr.innerHTML = hexes.length < 2 ? "" : `<div class="pt-seg">${PT_MODES.map(([k, t]) => `<button data-mode="${k}" class="${st.mode === k ? "on" : ""}">${t}</button>`).join("")}</div>`;
    el.querySelector("[data-acts]").replaceChildren(typeof csActions === "function" ? csActions(set, { only: ["learn", "map"] }) : document.createElement("span"));
    el.querySelectorAll("[data-sort]").forEach(b => b.classList.toggle("on", b.dataset.sort === st.sort));
    el.querySelector("[data-sortrow]").hidden = st.mode === "palette";
  };
  const tile = (r) => {
    if (r.src === "paintings") return glPinHTML(r.i, { badge: st.mode === "palette" ? `${Math.round(r.score * 100)}% match` : st.mode === "all" && hexes.length > 1 ? `${ptPct(r.cover)} of the canvas, least of the set` : `${ptPct(r.cover)} of the canvas` });
    const def = CI_SOURCES[r.src]; return def && def.pin ? def.pin(r, st) : `<span class="pt-tile"><b>${esc(def ? def.label : "Item")} ${r.i + 1}</b></span>`;
  };
  const paint = (more) => {
    const host = el.querySelector("[data-results]");
    if (!more) { shown = 0; host.innerHTML = `<div class="masonry pt-masonry"><div></div><div></div></div><button class="btn ghost gl-all" data-more hidden></button>`; host._h = [0, 0]; }
    const cols = host.querySelectorAll(".masonry > div"), next = rows.slice(shown, shown + PAGE);
    next.forEach(r => {
      const k = host._h[0] <= host._h[1] ? 0 : 1; host._h[k] += (r.src === "paintings" ? glAR(r.i) : 1) + .3;
      cols[k].insertAdjacentHTML("beforeend", tile(r));
    });
    shown += next.length;
    glFill(host);
    const m = host.querySelector("[data-more]");
    m.hidden = shown >= rows.length; m.innerHTML = `Show ${Math.min(PAGE, rows.length - shown)} more of ${ptNum(rows.length)}`;
  };
  const stats = (res) => {
    const box = el.querySelector("[data-stats]"), body = el.querySelector("[data-statsbody]");
    if (!res.count || (res.sources || []).length !== 1) { box.hidden = true; el.querySelector("[data-take]").hidden = true; return; }
    ciSetStats(res, hexes).then(s => {
      if (res !== lastRes) return;
      const line = (label, items, f) => items.length ? `<div class="pt-st"><span>${label}</span><div>${items.map(f).join("")}</div></div>` : "";
      const rate = res.count / res.n, tk = el.querySelector("[data-take]");
      if (hexes.length === 2 && res.o.mode === "all") { tk.hidden = false; tk.textContent = ciTakeaway(nm(hexes[0]), nm(hexes[1]), { count: res.count, lift: res.lift, theory: ciTheory(hexes[0], hexes[1]), stats: s }); } else tk.hidden = true;
      body.innerHTML = `
        <p class="pt-st-lead">${esc(ciFinding(hexes.map(nm), res, s))}</p>
        ${line("When", s.decades, d => `<p><b>${d.g}s</b> ${d.hit} of ${ptNum(d.total)} paintings (${Math.round(d.hit / d.total * 100)}%, against ${Math.round(rate * 100) || "under 1"}% overall)</p>`)}
        ${line("Painters", s.painters, d => `<p><b>${esc(d.label)}</b> ${d.hit} of ${d.total} works</p>`)}
        ${line("Where", s.countries, d => `<p><b>${esc(d.label)}</b> ${d.hit} of ${ptNum(d.total)} paintings</p>`)}
        ${line("Movements", s.movements, d => `<p><b>${esc(d.label)}</b> ${d.hit} of ${ptNum(d.total)}</p>`)}
        ${s.earliest ? `<div class="pt-st"><span>Earliest</span><div><button class="pt-early" data-gi="${s.earliest.i}"><b>${s.earliest.year < 0 ? -s.earliest.year + " BCE" : s.earliest.year}</b> <span data-early></span></button></div></div>` : ""}
        <p class="fine">Groups need a few paintings before they count (decades 40, painters 8 works, countries 40). Dates are the museums' own. A lift above 1 is a tendency in these photographs, not a rule of painting.</p>`;
      box.hidden = false;
      if (s.earliest) glDetail(s.earliest.i).then(d => { const e = body.querySelector("[data-early]"); if (e) e.textContent = d.t + (d.a ? ", " + d.a : ""); }).catch(() => {});
    });
  };
  const run = () => {
    const my = ++seq;
    ptSync();
    el.querySelector("[data-finding]").textContent = "Measuring…";
    Promise.all([loadGallery().catch(() => null), paintingsWith(hexes, st)]).then(([, res]) => {
      if (my !== seq || !el.isConnected) return;
      lastRes = res; rows = res.rows;
      const names = hexes.map(nm);
      el.querySelector("[data-finding]").textContent = ciFinding(names, res, null);
      if (!res.count) {
        // an empty result teaches: what would find something
        paintingsWith(hexes, { ...st, tol: Math.max(st.tol, 6), minCover: Math.min(st.minCover, 1), maxCover: null }).then(loose => {
          if (my !== seq) return;
          const host = el.querySelector("[data-results]");
          host.innerHTML = loose.count ? `<p class="fine">Nothing at this setting.</p><button class="btn ghost gl-all" data-loosen>${ptNum(loose.count)} ${loose.count === 1 ? "painting is" : "paintings are"} within ${Math.max(st.tol, 6)}% and cover 1% ${ICON.arrow}</button>` : `<p class="fine">No painting in the gallery holds ${hexes.length > 1 ? "all of these" : "this color"}, even loosely. ${hexes.length > 1 ? "Try “Any”, or remove a color." : ""}</p>`;
        });
        el.querySelector("[data-stats]").hidden = true;
        return;
      }
      paint(false); stats(res);
    }).catch(() => { if (my === seq && el.isConnected) el.querySelector("[data-results]").innerHTML = `<p class="fine">The paintings didn't load. <button class="wl" data-retry>Try again</button></p>`; });
  };
  const ptSync = () => ptSyncURL(hexes, st);
  const sliderHost = el.querySelector("[data-sliders]");
  const tune = () => {
    tuner = ptSliders(sliderHost, st, () => { ptSave(st); run(); }, { hex: hexes.length === 1 ? hexes[0] : null, noCount: true });
  };
  // source switch: only the sources that exist
  ciAvailable().then(keys => {
    if (!el.isConnected || keys.length < 2) return;
    const row = el.querySelector("[data-sources]"), opts = [...keys.map(k => [k, CI_SOURCES[k].label]), ["both", "Both"]];
    row.hidden = false;
    row.innerHTML = `<div class="pt-seg">${opts.map(([k, t]) => `<button data-src="${k}" class="${st.source === k ? "on" : ""}">${t}</button>`).join("")}</div>`;
  });
  el.addEventListener("click", e => {
    const g = e.target.closest("[data-gi]");
    if (g && !g.closest("[data-statsbody]")) { const i = +g.dataset.gi, r = rows.find(x => x.i === i && x.src === "paintings"); const weakest = r && r.covers ? hexes[r.covers.indexOf(Math.min(...r.covers))] : hexes[0]; return galleryPage(i, true, weakest, st.tol); }
    if (g) return galleryPage(+g.dataset.gi, true, hexes[0], st.tol);
    if (e.target.closest("[data-more]")) return paint(true);
    if (e.target.closest("[data-retry]")) return run();
    const lo = e.target.closest("[data-loosen]");
    if (lo) { Object.assign(st, { tol: Math.max(st.tol, 6), minCover: Math.min(st.minCover, 1), maxCover: null }); if (tuner) tuner.set(st); ptSave(st); return run(); }
    const drop = e.target.closest("[data-drop]");
    if (drop) { hexes.splice(+drop.dataset.drop, 1); buzz(6); colorsRow(); if (tuner && hexes.length === 1) { tune(); } return run(); }
    const op = e.target.closest("[data-open]");
    if (op) return openTappedColor(op.dataset.open);
    if (e.target.closest("[data-add]")) return ptAddSheet(hexes, h => { hexes.push(h); colorsRow(); if (hexes.length === 2) tune(); run(); });
    const md = e.target.closest("[data-mode]");
    if (md) { st.mode = md.dataset.mode; buzz(5); colorsRow(); return run(); }
    const so = e.target.closest("[data-sort]");
    if (so) { st.sort = so.dataset.sort; buzz(4); colorsRow(); return run(); }
    const sr = e.target.closest("[data-src]");
    if (sr) { st.source = sr.dataset.src; el.querySelectorAll("[data-src]").forEach(b => b.classList.toggle("on", b === sr)); buzz(5); return run(); }
  });
  colorsRow(); tune(); run();
  return el;
}

// the sheet that adds a color: today's swatches or any color
function ptAddSheet(have, onPick) {
  const cols = glHueOrder([...BASICS, ...ALL]);
  const { sh, close } = sheet(`
    <div class="gl-sh-top"><b>Add a color</b><span>${have.length} of 5</span></div>
    <div class="pt-add-sw">${cols.map(c => `<button data-hex="${c.h}" style="--c:${c.h}" aria-label="${esc(c.n)}"></button>`).join("")}</div>
    <div class="gl-row"><span class="gl-lab">Any</span><div class="gl-sw"><button class="gl-any" data-any aria-label="Any color"></button></div></div>
    <div class="gl-picker" data-picker hidden></div>
    <button class="btn solid gl-go" data-use hidden>Add this color</button>`);
  let picker = null, cur = null;
  sh.onclick = e => {
    const b = e.target.closest("[data-hex]");
    if (b) { buzz(6); close(); return onPick(b.dataset.hex.toUpperCase()); }
    if (e.target.closest("[data-any]")) {
      const box = sh.querySelector("[data-picker]"); box.hidden = !box.hidden; sh.querySelector("[data-use]").hidden = box.hidden;
      if (!box.hidden && !picker) picker = colorPicker(box, { hex: have[0], onChange: hex => { cur = hex; } });
      if (!box.hidden) cur = picker.get();
      return;
    }
    if (e.target.closest("[data-use]") && cur) { close(); onPick(cur.toUpperCase()); }
  };
  sh.querySelector("[data-picker]").addEventListener("pointerdown", e => e.stopPropagation());
}

// ---------- arriving on a painting ----------
// o: { i, hex, tol, pool, heroSpan, getImg(), canRead() }. Draws the pinned color above the palette, measures its
// coverage from the index, and (when the museum lets the page read pixels) maps where it lives.
function ptArrival(el, o) {
  const host = el.querySelector("[data-glarrive]");
  if (!host || !o.hex) return null;
  const hex = o.hex.toUpperCase(), nm = ptNear(hex), st = { tol: o.tol != null ? o.tol : 3 };
  let res = null, mask = null, sel = -1, on = false, canvas = null, seq = 0, img = null, readable = false, known = false;
  host.hidden = false;
  const html = () => {
    const tolTxt = st.tol === 0 ? "exactly this color" : `within ${st.tol}%`;
    let line;
    if (!res) line = `<span class="pt-ar-line">Measuring ${esc(nm.toLowerCase())} in this painting…</span>`;
    else if (res.cover > 0) {
      const rk = res.rank && res.rank.of > 1 ? `, its ${ptNth(res.rank.rank)} most-used color` : "";
      line = `<span class="pt-ar-line">Your color covers <b>${ptPct(res.cover)}</b> of this canvas${rk}.</span>`;
    } else if (res.near) line = `<span class="pt-ar-line">Nothing in this painting is ${tolTxt} of your color. The closest it gets is <b>${pctFmt(res.near.de)} different</b>, over ${ptPct(res.near.cover)} of the canvas.</span>`;
    else line = `<span class="pt-ar-line">Nothing in this painting comes near your color.</span>`;
    const how = !res ? "" : res.coarse ? "Approximate: measured from a 24-color summary of the picture, not its pixels." : `${esc(nm)} · ${tolTxt} · measured pixel by pixel in the museum's photograph.`;
    host.innerHTML = `<i class="pt-ar-sw" style="--c:${hex}" data-swatch="${hex}"></i><div class="pt-ar-body">${line}<small>${how}</small>
      <div class="pt-ar-tools"><div class="pt-seg pt-ar-tol">${[0, 3, 10].map(t => `<button data-t="${t}" class="${st.tol === t ? "on" : ""}">${t ? t + "%" : "Exact"}</button>`).join("")}</div>
      ${readable && res && !res.coarse ? `<button class="pt-ar-map${on ? " on" : ""}" data-map aria-pressed="${on}">${PT_ICON_MAP}<span>${on ? "Hide map" : "Where it lives"}</span></button>` : ""}
      <button class="pt-ar-all" data-all>All paintings like this</button></div>
      ${on && mask ? `<div class="pt-ar-reg"><button data-prev aria-label="Previous place">‹</button><span>${mask.regions.length ? (sel < 0 ? `${mask.regions.length} ${mask.regions.length === 1 ? "place" : "places"}, tap one` : `Place ${sel + 1} of ${mask.regions.length} · ${ptPct(mask.regions[sel].share * 100)} of the canvas`) : "No place is large enough to map"}</span><button data-next aria-label="Next place">›</button></div>` : ""}
      ${known && !readable && res && res.cover > 0 && !res.coarse ? `<small class="pt-ar-why">${o.why ? esc(o.why) : ""}</small>` : ""}
    </div>`;
  };
  const measure = async () => {
    const my = ++seq;
    res = null; html();
    try {
      const a = await ciArrival(o.i, hex, st.tol);
      let near = null;
      if (!(a.cover > 0)) { const w = await ciArrival(o.i, hex, 15); if (w.cover > 0) near = { de: w.de, cover: w.cover }; }
      if (my !== seq) return;
      res = { ...a, near, rank: ciRank(o.pool, hex, st.tol, a.cover) };
    } catch (e) { if (my !== seq) return; res = { cover: 0, coarse: false, near: null }; }
    html(); if (on) buildMask();
  };
  // ---- the map ----
  const buildMask = () => {
    if (!img || !readable) return;
    try {
      const W = img.naturalWidth, H = img.naturalHeight, sc = Math.min(1, 240 / Math.max(W, H)), w = Math.max(1, Math.round(W * sc)), h = Math.max(1, Math.round(H * sc));
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      const cx = c.getContext("2d", { willReadFrequently: true }); cx.drawImage(img, 0, 0, w, h);
      const d = cx.getImageData(0, 0, w, h).data, src = CI_SOURCES.paintings, t0 = ciLab(hex), own = ciCellOf(src, t0);
      const m = new Uint8Array(w * h), memo = new Map(); let n = 0;
      for (let p = 0; p < w * h; p++) {
        const key = d[p * 4] << 16 | d[p * 4 + 1] << 8 | d[p * 4 + 2];
        let v = memo.get(key);
        if (v === undefined) {
          const l = ciLab("#" + (key | 1 << 24).toString(16).slice(1)), cell = ciCellOf(src, l);
          v = (cell[0] === own[0] && cell[1] === own[1] && cell[2] === own[2]) || ciDE(t0[0], t0[1], t0[2], l[0], l[1], l[2]) <= st.tol ? 1 : 0;
          memo.set(key, v);
        }
        m[p] = v; n += v;
      }
      // places: matching pixels joined after growing the mask one pixel, so a speckled brushstroke is one place
      const dil = new Uint8Array(w * h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (m[y * w + x]) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < w && Y < h) dil[Y * w + X] = 1; }
      const lab = new Int16Array(w * h).fill(-1), regs = [];
      for (let s = 0; s < w * h; s++) {
        if (!dil[s] || lab[s] >= 0) continue;
        const id = regs.length, q = [s]; lab[s] = id; let px = 0, x0 = w, x1 = 0, y0 = h, y1 = 0;
        for (let k = 0; k < q.length; k++) {
          const p = q[k], x = p % w, y = (p / w) | 0;
          if (m[p]) { px++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= w || Y >= h) continue; const r = Y * w + X; if (dil[r] && lab[r] < 0) { lab[r] = id; q.push(r); } }
        }
        regs.push({ id, px, x0, x1, y0, y1 });
      }
      const keep = regs.filter(r => r.px >= Math.max(3, w * h * .0004)).sort((a, b) => b.px - a.px).slice(0, 40);
      const remap = new Map(keep.map((r, i) => [r.id, i]));
      const rl = new Int16Array(w * h).fill(-1);
      for (let p = 0; p < w * h; p++) if (m[p] && remap.has(lab[p])) rl[p] = remap.get(lab[p]);
      mask = { w, h, m, rl, regions: keep.map(r => ({ ...r, share: r.px / (w * h) })), share: n / (w * h) };
      if (sel >= mask.regions.length) sel = -1;
      draw(); html();
    } catch (e) { readable = false; mask = null; on = false; html(); }
  };
  const draw = () => {
    if (!mask || !o.heroSpan) return;
    if (!canvas) { canvas = document.createElement("canvas"); canvas.className = "pt-mask"; o.heroSpan.appendChild(canvas); }
    const { w, h, m, rl } = mask; canvas.width = w; canvas.height = h;
    const cx = canvas.getContext("2d"), id = cx.createImageData(w, h), D = id.data;
    for (let p = 0; p < w * h; p++) {
      const x = p % w, y = (p / w) | 0, hit = m[p] === 1;
      let a = hit ? 0 : 170;
      if (sel >= 0) {
        const mine = rl[p] === sel;
        if (hit && !mine) a = 105;
        if (mine) {
          a = 0;
          const edge = (x === 0 || rl[p - 1] !== sel) || (x === w - 1 || rl[p + 1] !== sel) || (y === 0 || rl[p - w] !== sel) || (y === h - 1 || rl[p + w] !== sel);
          if (edge) { D[p * 4] = D[p * 4 + 1] = D[p * 4 + 2] = 255; D[p * 4 + 3] = 235; continue; }
        }
      }
      D[p * 4] = 14; D[p * 4 + 1] = 13; D[p * 4 + 2] = 11; D[p * 4 + 3] = a;
    }
    cx.putImageData(id, 0, 0);
    canvas.style.opacity = on ? 1 : 0;
  };
  const setOn = v => {
    on = v; if (on && !mask) buildMask(); else { if (canvas) canvas.style.opacity = on ? 1 : 0; html(); }
    if (!on) sel = -1;
  };
  host.onclick = e => {
    const t = e.target.closest("[data-t]");
    if (t) { st.tol = +t.dataset.t; mask = null; sel = -1; buzz(5); return measure(); }
    if (e.target.closest("[data-map]")) { buzz(6); return setOn(!on); }
    if (e.target.closest("[data-all]")) return paintingsOfPage([hex], { tol: st.tol, back: true });
    const step = e.target.closest("[data-next],[data-prev]");
    if (step && mask && mask.regions.length) { const k = mask.regions.length; sel = e.target.closest("[data-next]") ? (sel + 1) % k : (sel - 1 + k * 2) % k; buzz(4); draw(); html(); }
  };
  html(); measure();
  return {
    // js/gallery.js armSample() tells us the image and whether its pixels can be read
    image(im, ok) { img = im; readable = !!ok; known = true; mask = null; if (res) html(); if (on && readable) buildMask(); },
    // a tap on the painting while the map is on selects the place under the finger; true = handled
    tap(e) {
      if (!on || !mask || !o.heroSpan) return false;
      const im = o.getImg(), r = im.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      if (x < 0 || y < 0 || x > 1 || y > 1) return false;
      const px = Math.min(mask.w - 1, Math.floor(x * mask.w)), py = Math.min(mask.h - 1, Math.floor(y * mask.h));
      let best = -1, bd = 4;
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const X = px + dx, Y = py + dy; if (X < 0 || Y < 0 || X >= mask.w || Y >= mask.h) continue; const r2 = mask.rl[Y * mask.w + X]; const dd = Math.hypot(dx, dy); if (r2 >= 0 && dd < bd + 1) { best = r2; bd = dd; } }
      if (best < 0) return false;
      sel = best === sel ? -1 : best; buzz(6); draw(); html(); return true;
    },
    stop() { seq++; },
  };
}

// ---------- on a painter's page: the colors they used in at least a quarter of their works ----------
// data/colorindex/painters.json (tools/color_index.py): for painters with 12+ works in the archive, the named colors
// that turn up (something within 4% covering 1% of the canvas) in 25% or more of their works, and which of those they
// use far more than the archive does. One hook, called from js/artwiki.js awPainter().
let PT_PAINTERS = null;
function ptPainterColors(el, name) {
  if (!el || !name) return;
  if (!PT_PAINTERS) PT_PAINTERS = fetch("data/colorindex/painters.json").then(r => r.ok ? r.json() : {}).catch(() => { PT_PAINTERS = null; return {}; });
  PT_PAINTERS.then(all => {
    const p = all[name], slot = el.querySelector("[data-awbio]");
    if (!p || !p.c.length || !el.isConnected || !slot || el.querySelector("[data-pt-painter]")) return;
    const sig = new Set(p.s || []), sec = document.createElement("section");
    sec.setAttribute("data-pt-painter", "");
    sec.innerHTML = `<div class="sec-head"><b>Colors in most of the work</b><span>${p.n} paintings</span></div>
      <p class="aw-sub">Colors that show up in at least a quarter of ${esc(name)}'s paintings: something within 4% of it covering 1% or more of the canvas, as photographed.${sig.size ? " Marked ones are far more common here than across the archive." : ""}</p>
      <div class="pt-pairs">${p.c.map(([n, h, pc]) => `<button class="pt-pair" data-swatch="${h}"><i style="--c:${h}"></i><b>${esc(n)}</b><span>${pc}% of the works${sig.has(n) ? " · a signature" : ""}</span></button>`).join("")}</div>`;
    slot.before(sec);
  });
}
