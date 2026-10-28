"use strict";
// One search (design/SIMPLIFY/PLAN.md §3.7/§9): reachable from every ⋯ (places.js moreOpen) and the Places
// sheet. Finds colors (the ~101 taught plus the ~2,700-name archive), every collection by name, and anything a
// lane tucked away behind ⋯ (featureRegister). Lane 2/3/4 call featureRegister to make their own tucked
// controls findable by the words people use for them ("eyedropper", "slideshow", "haptics"); nothing here
// reads lazily loaded data at load time (the lazy-wiki rule).

const FEATURE_REGISTRY = new Map();
// featureRegister(id, { t, where, words, run }): t is the label shown, where is a short breadcrumb ("Map ·
// More · Map tools"), words is an array of synonyms to match against, run() performs the action.
function featureRegister(id, o) { if (id && o && typeof o.run === "function") FEATURE_REGISTRY.set(id, o); }

const SEARCH_SCOPES = [["all", "All"], ["colors", "Colors"], ["collections", "Collections"], ["tools", "Tools"]];
function searchColorMatches(q) {
  const ql = q.toLowerCase();
  const pool = [...BASICS, ...ALL];
  const seen = new Set();
  const hits = pool.filter(c => { const k = c.n.toLowerCase(); if (!k.includes(ql) || seen.has(k)) return false; seen.add(k); return true; })
    .sort((a, b) => a.n.toLowerCase().indexOf(ql) - b.n.toLowerCase().indexOf(ql) || a.n.length - b.n.length).slice(0, 10);
  return hits;
}
function searchCollectionMatches(q) {
  if (typeof COLLECTIONS === "undefined") return [];
  const ql = q.toLowerCase();
  return COLLECTIONS.filter(c => c.t.toLowerCase().includes(ql)).slice(0, 8);
}
// `words` is documented as an array, but a few registrations (js/home.js, js/paintmap.js) pass a plain
// space-separated string instead -- normalize either shape here rather than at each call site, so a real
// search (not just a lookup by exact id) never throws on one of them.
function searchFeatureMatches(q) {
  const ql = q.toLowerCase();
  return [...FEATURE_REGISTRY.entries()].filter(([, f]) => {
    const words = Array.isArray(f.words) ? f.words : typeof f.words === "string" ? f.words.split(/\s+/) : [];
    return f.t.toLowerCase().includes(ql) || words.some(w => w.toLowerCase().includes(ql));
  }).slice(0, 8);
}
// ---------- as-you-type suggestions (js/sqsuggest.js is the engine; this is the sheet) ----------
const SEARCH_RECENT_KEY = "colorhub-recent-searches";
function searchRecent() { try { const r = JSON.parse(localStorage.getItem(SEARCH_RECENT_KEY) || "[]"); return Array.isArray(r) ? r.filter(x => typeof x === "string").slice(0, 8) : []; } catch (e) { return []; } }
function searchRemember(q) {
  q = String(q || "").trim(); if (q.length < 2) return;
  try { localStorage.setItem(SEARCH_RECENT_KEY, JSON.stringify([q, ...searchRecent().filter(x => x.toLowerCase() !== q.toLowerCase())].slice(0, 8))); } catch (e) {}
}
// the typed words, bold, wherever they sit in a title (accents and case ignored)
function searchBold(text, q) {
  const toks = sqFold(q).split(" ").filter(t => t.length >= 2);
  if (!toks.length) return esc(text);
  const chars = [...text], flat = chars.map(ch => sqFold(ch)[0] || ch.toLowerCase()).join("");   // one folded letter per letter, so offsets line up
  const mark = new Array(chars.length).fill(false);
  toks.forEach(t => { let at = flat.indexOf(t); while (at >= 0) { for (let k = 0; k < t.length; k++) mark[at + k] = true; at = flat.indexOf(t, at + t.length); } });
  let out = "", open = false;
  chars.forEach((ch, i) => { if (mark[i] && !open) { out += "<mark>"; open = true; } else if (!mark[i] && open) { out += "</mark>"; open = false; } out += esc(ch); });
  return out + (open ? "</mark>" : "");
}
function searchIconHTML(ic) {
  if (!ic) return `<span class="sq-ic"></span>`;
  if (ic.t === "swatch" || ic.t === "dot") return `<span class="sq-ic sq-sw" style="background:${esc(ic.h || "#888")}"></span>`;
  if (ic.t === "flag") return `<span class="sq-ic sq-fl">${ic.html}</span>`;
  if (ic.t === "strip") return `<span class="sq-ic sq-st">${ic.hs.map(h => `<i style="background:${esc(h)}"></i>`).join("")}</span>`;
  if (ic.t === "portrait") return `<span class="sq-ic sq-th${ic.square ? " sq-sq" : ""}" style="background:${esc(ic.bg || "#3A3630")}">${ic.url ? `<img alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" src="${esc(ic.url)}" onload="this.classList.add('on')" onerror="this.remove()">` : ""}${ic.initial ? `<b>${esc(ic.initial)}</b>` : ""}</span>`;
  return `<span class="sq-ic sq-gl">${typeof icon === "function" ? icon(ic.name || "search", 20) : ""}</span>`;
}
// the other groups: collections, tools, pages (Explore's stories and pigments), each tagged with a best score
function searchExtraGroups(q) {
  return G => {
    if (typeof COLLECTIONS !== "undefined") {
      const r = sqFuzzyRank(COLLECTIONS, q, c => c.t, 4);
      G("collections", "Collections", r.top - 5, r.hits.map(c => ({ id: "co:" + c.id, icon: { t: "dot", h: c.pic }, title: c.t, sub: "Collection", act: () => { if (typeof collOpen === "function") collOpen(c.id); } })));
    }
    if (typeof TF_SEARCH_BOARDS !== "undefined" && TF_SEARCH_BOARDS) {   // js/todayfeed.js: the Boards page's folders (genres, moods, periods, movements, painters, places ...)
      const r = sqFuzzyRank(TF_SEARCH_BOARDS, q, b => b.label, 6);
      G("boards", "Boards", r.top + (/^#\/?feed/.test(location.hash) ? 12 : -2), r.hits.map(b => ({ id: "b:" + b.id, icon: { t: "glyph", name: "painting" }, title: b.label, sub: "Board" + (b.sub ? " · " + b.sub : ""), act: () => tfOpenBoardFromSearch(b) })));
    }
    // Subjects (David, 2026-10-28: "search by keyword, the CLIP descriptions"): the words the picture model found in the paintings ("boat", "dog", "snow"),
    // by whole word, start of a word, or the aliases the map's own search knows. A pick opens the painting map on just those paintings.
    if (typeof SUBJ !== "undefined" && SUBJ && sqFold(q).length >= 3) {
      const qk = sqFold(q), words = qk.split(" ").filter(Boolean), found = typeof subjFind === "function" ? subjFind(words.slice(0, 3)) : null, rows = [], seenT = new Set();
      const openSubj = (tags, label) => () => { buzz(8); if (typeof pmLoad === "function") pmLoad().then(() => pmOpen({ col: "paintings", arr: "color", f: { subjSet: tags.slice() } }, { fresh: true })).catch(() => toast("The painting map didn't load")); };
      if (found) { found.tags.forEach(t => seenT.add(t)); rows.push({ id: "sj:" + found.tags.join("."), icon: { t: "glyph", name: "painting" }, title: found.label, sub: "Subject · " + found.tags.reduce((n, t) => n + (SUBJ.n[t] || 0), 0).toLocaleString("en-US") + " paintings", act: openSubj(found.tags, found.label) }); }
      const part = [];
      SUBJ.tags.forEach((n, t) => { if (SUBJ.hide[t] || SUBJ.fold[t] !== t || seenT.has(t) || (SUBJ.n[t] || 0) < 20) return; const f = sqFold(n); if (f.split(" ").some(w => w.startsWith(qk)) || f.startsWith(qk)) part.push([t, SUBJ.n[t]]); });
      part.sort((x, y) => y[1] - x[1]).slice(0, 5 - rows.length).forEach(([t, c]) => rows.push({ id: "sj:" + t, icon: { t: "glyph", name: "painting" }, title: subjCap(SUBJ.tags[t]), sub: "Subject · " + c.toLocaleString("en-US") + " paintings", act: openSubj([t], subjCap(SUBJ.tags[t])) }));
      G("subjects", "In the paintings", found ? 60 : 30, rows);
    }
    const ql = sqFold(q), feats = searchFeatureMatches(q.toLowerCase());
    G("tools", "Tools & settings", ql.length >= 3 ? 30 : 10, feats.slice(0, 4).map(([id, f]) => ({ id: "f:" + id, icon: { t: "glyph", name: "pipette" }, title: f.t, sub: f.where || "", act: () => { buzz(8); f.run(); } })));
    if (typeof graph === "function" && ql.length >= 3) {
      try {
        const nodes = [...graph().nodes.values()].filter(n => n.kind !== "color" && n.kind !== "painting" && n.title);
        const r = sqFuzzyRank(nodes, q, n => n.title, 3);
        G("pages", "Stories & pages", r.top - 8, r.hits.map(n => ({ id: "n:" + n.id, icon: { t: "dot", h: (typeof nodeColor === "function" && nodeColor(n)) || "#3A3630" }, title: n.title, sub: n.kind === "story" ? "Story" : (typeof TYPE_LABEL !== "undefined" && TYPE_LABEL[n.type]) || "Page", act: () => { if (typeof closeup === "function") closeup(n); } })));
      } catch (e) {}
    }
  };
}
function searchSuggest(q) { return sqSuggest(q, searchExtraGroups(q)); }
function searchRowsHTML(res, q, rowsOut) {
  let html = "";
  if (res.didYouMean && sqFold(res.didYouMean) !== sqFold(q)) html += `<p class="sq-dym">Did you mean <button type="button" class="sq-dym-b" data-sq-dym="${esc(res.didYouMean)}">${esc(res.didYouMean)}</button>?</p>`;
  res.groups.forEach(g => {
    html += `<h3 class="title-3 sr-h">${esc(g.title)}</h3><ul class="sr-list" role="group" aria-label="${esc(g.title)}">`;
    g.rows.forEach(r => {
      const k = rowsOut.length; rowsOut.push(r);
      html += `<li><button type="button" class="sr-row sq-row" role="option" id="sq-r${k}" data-sq="${k}"${r.act ? "" : " disabled"}>${searchIconHTML(r.icon)}<span class="sq-t"><b>${r.combo ? esc(r.title) : searchBold(r.title, q)}</b>${r.sub ? `<small>${esc(r.sub)}</small>` : ""}</span></button></li>`;
    });
    html += `</ul>`;
  });
  if (res.loading) html += `<p class="fine sr-empty sq-loading">Loading paintings, painters and places…</p>`;
  else if (!res.groups.length) html += `<p class="fine sr-empty">Nothing by that name. Try a color, a painter, a country or years like 1870s.</p>`;
  return html;
}
function searchEmptyHTML(rowsOut) {
  const rec = searchRecent();
  let html = "";
  if (rec.length) {
    html += `<h3 class="title-3 sr-h">Recent</h3><ul class="sr-list">${rec.map(x => { const k = rowsOut.length; rowsOut.push({ fill: x }); return `<li><button type="button" class="sr-row sq-row" role="option" id="sq-r${k}" data-sq="${k}"><span class="sq-ic sq-gl">${typeof icon === "function" ? icon("search", 20) : ""}</span><span class="sq-t"><b>${esc(x)}</b></span></button></li>`; }).join("")}</ul>`;
  }
  html += `<p class="fine sr-empty">Search colors, painters, countries and years. Try “blue 1870s”, “dutch portraits”, “monet green” or “#3c7aa8”.</p>`;
  return html;
}
// searchOpen({ q, scope, from }): a full-screen search, opened over whatever's behind it. `from` is just a
// breadcrumb for callers/analytics -- it doesn't change what's searched (PLAN §3.7: scope chips sit on top,
// but the index itself is always the whole app).
// David, 2026-10-11 (a live screenshot of the map's ⋯ menu: "way too many settings"): Name any color and
// Surprise me moved off that menu into this one search -- "both are ways of finding a color", so they sit as
// two quiet, always-there chips right under the field (not query-dependent results, and not buried behind
// typing a word for them). They run the SAME featureRegister entries ("map-namer"/"map-surprise", js/home.js)
// the dynamic word-search already finds them by, so there's exactly one definition of each action, not two.
const SEARCH_QUICK = [["namer", "map-namer", "pipette", "Name any color"], ["surprise", "map-surprise", "dice", "Surprise me"]];
function searchQuickHTML() {
  return `<div class="sr-quick">${SEARCH_QUICK.map(([key, , glyph, t]) => `<button type="button" class="sr-chip" data-sr-quick="${key}">${icon(glyph, 18)}<span>${esc(t)}</span></button>`).join("")}</div>`;
}
function searchOpen(o = {}) {
  if (document.querySelector(".sheet,.rooms-stem")) return;
  if (typeof tfSearchBoardsLoad === "function") tfSearchBoardsLoad();
  if (typeof loadSubjects === "function" && typeof SUBJ !== "undefined" && !SUBJ) loadSubjects().catch(() => {});   // the paintings' subject words, ready by the time you type
  const html = `<div class="sr-sheet">
    <div class="sr-field sq-field"><span>${ICON.search}</span><div class="sq-inwrap"><span class="sq-ghost" aria-hidden="true"></span><input type="search" class="sr-input" placeholder="Search colors, painters, years…" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" role="combobox" aria-expanded="true" aria-controls="sq-list" aria-label="Search" value="${esc(o.q || "")}"></div></div>
    ${searchQuickHTML()}
    <div class="sr-body" id="sq-list" role="listbox"></div>
  </div>`;
  const { sh, close } = sheet(html);
  sh.classList.add("sr-sheet-wrap");
  const inp = sh.querySelector(".sr-input"), body = sh.querySelector(".sr-body"), ghost = sh.querySelector(".sq-ghost");
  let rows = [], sel = -1, timer = 0, seq = 0, completion = "";
  const mark = () => {
    body.querySelectorAll(".sq-row.on").forEach(b => b.classList.remove("on"));
    const b = sel >= 0 && body.querySelector(`[data-sq="${sel}"]`);
    if (b) { b.classList.add("on"); b.scrollIntoView({ block: "nearest" }); inp.setAttribute("aria-activedescendant", b.id); } else inp.removeAttribute("aria-activedescendant");
  };
  const setGhost = () => {
    const q = inp.value, top = rows.find(r => r.title && !r.combo && r.act);
    completion = "";
    if (q.trim().length >= 2 && top && top.title.toLowerCase().startsWith(q.toLowerCase()) && top.title.length > q.length) completion = q + top.title.slice(q.length);
    ghost.innerHTML = completion ? `<i>${esc(q)}</i>${esc(completion.slice(q.length))}` : "";
  };
  const run = () => {
    clearTimeout(timer);
    const q = inp.value.trim(), my = ++seq; rows = []; sel = -1;
    if (!q) { body.innerHTML = searchEmptyHTML(rows); ghost.innerHTML = ""; completion = ""; return; }
    const res = searchSuggest(q);
    body.innerHTML = searchRowsHTML(res, q, rows);
    if (rows.length) { sel = 0; mark(); }
    setGhost();
    // rows that finish after they are drawn (the paintings count is a pass over the whole archive), one per task
    const todo = rows.map((r, k) => r.resolve ? k : -1).filter(k => k >= 0);
    const step = () => {
      if (my !== seq || !todo.length) return;
      const k = todo.shift(), r = rows[k], b = body.querySelector(`[data-sq="${k}"]`);
      try {
        const p = r.resolve(); r.resolve = null;
        if (p && b) {
          if (p.hide) { r.act = null; const li = b.closest("li"); if (li) li.remove(); }
          else {
            if (p.title) b.querySelector(".sq-t b").textContent = r.title = p.title;
            if (p.sub != null) { let sm = b.querySelector("small"); if (!sm) { sm = document.createElement("small"); b.querySelector(".sq-t").appendChild(sm); } sm.textContent = p.sub; }
            if (p.icon) b.firstElementChild.outerHTML = searchIconHTML(p.icon);
            if ("act" in p) { r.act = p.act; b.disabled = !p.act; }
          }
        }
      } catch (e) { console.warn(e); }
      setTimeout(step, 0);
    };
    setTimeout(step, 0);
    if (res.loading) sqWarm().then(() => { if (my === seq && inp.isConnected) run(); });
  };
  const later = () => { clearTimeout(timer); timer = setTimeout(run, 60); };
  const fire = k => {
    const r = rows[k]; if (!r) return;
    if (r.fill) { inp.value = r.fill; run(); inp.focus(); return; }
    if (!r.act) return;
    searchRemember(inp.value); close(); buzz(8); r.act();
  };
  inp.addEventListener("input", later);
  inp.addEventListener("keydown", e => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { if (!rows.length) return; e.preventDefault(); sel = (sel + (e.key === "ArrowDown" ? 1 : -1) + rows.length) % rows.length; mark(); return; }
    if ((e.key === "Tab" || e.key === "ArrowRight") && completion && inp.selectionStart === inp.value.length && !e.shiftKey) { e.preventDefault(); inp.value = completion; run(); return; }
    if (e.key === "Enter") { e.preventDefault(); run(); fire(sel >= 0 ? sel : 0); return; }
    if (e.key === "Escape") { e.preventDefault(); close(); }
  });
  if (typeof sqLoad === "function") sqLoad().then(() => { if (inp.isConnected && inp.value.trim()) run(); });
  sqWarm();
  run();
  setTimeout(() => { try { inp.focus({ preventScroll: true }); } catch (e) {} }, 60);
  sh.addEventListener("click", e => {
    const q = e.target.closest("[data-sr-quick]");
    if (q) { const reg = SEARCH_QUICK.find(x => x[0] === q.dataset.srQuick); const feat = reg && FEATURE_REGISTRY.get(reg[1]); close(); if (feat) { buzz(8); feat.run(); } return; }
    const dy = e.target.closest("[data-sq-dym]");
    if (dy) { inp.value = dy.dataset.sqDym; run(); inp.focus(); return; }
    const row = e.target.closest("[data-sq]");
    if (row) fire(+row.dataset.sq);
  });
}
