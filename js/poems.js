"use strict";
// Poems: a public-domain poetry archive read through its colors.
//  - data/poems-index.json (small, loaded the first time it's needed): every poem's title, poet, year, tradition and palette,
//    the color table, notes on color words in the original languages, and the best lines for each color.
//  - data/poems/s<N>.json shards (loaded per poem): the text, where each color word sits, translator, source and original.
// Built by tools/poetry.py. Every text is in the US public domain (sources: research/POETRY.md).
// Entry points: poemsPanel(el) for the Explore lens, poemPage(id), colorPoems(el, color) for color pages,
// poemOfTheDayCard() for Today.

let POEM_IX = null, POEM_IX_LOADING = null;
const POEM_SHARDS = new Map();
const POEM_UI = { color: null, fam: null, era: "all", trad: "all", q: "", shown: 40 };
let POEM_ORIGIN = "explore";   // the tab a poem page returns to when there's nothing behind it
const POEM_ERAS = [["all", "All eras"], ["ancient", "Ancient", -3000, 500], ["medieval", "Medieval", 500, 1400], ["early", "1400–1699", 1400, 1700],
  ["c18", "1700s", 1700, 1800], ["c19", "1800s", 1800, 1900], ["c20", "1900–1929", 1900, 1930]];
const POEM_FAMS = ["Reds", "Pinks", "Oranges", "Yellows", "Greens", "Blues", "Purples", "Browns", "Neutrals"];
const POEM_LANG_NAME = { ja: "Japanese", zh: "Chinese", el: "Ancient Greek", la: "Latin", fa: "Persian", fr: "French", it: "Italian", de: "German" };

function loadPoemIndex() {
  if (POEM_IX) return Promise.resolve(POEM_IX);
  return POEM_IX_LOADING || (POEM_IX_LOADING = fetch("data/poems-index.json").then(r => r.ok ? r.json() : null).catch(() => null).then(ix => {
    if (!ix) { POEM_IX_LOADING = null; return null; }
    const c = ix.cols.reduce((m, k, i) => (m[k] = i, m), {});
    ix.list = ix.poems.map(r => ({ id: r[c.id], title: r[c.title], poet: ix.poets[r[c.poet]], year: r[c.year], trad: ix.trads[r[c.trad]],
      pal: r[c.palette] ? String(r[c.palette]).split(",").map(x => { const [ci, n] = x.split(":"); return [+ci, +(n || 1)]; }) : [],
      lines: r[c.lines], shard: r[c.shard], orig: !!r[c.orig], approx: !!r[c.approx] }));
    ix.byId = new Map(ix.list.map(p => [p.id, p]));
    ix.colorByName = new Map(ix.colors.map((x, i) => [x[0].toLowerCase(), i]));
    return (POEM_IX = ix);
  }));
}
function loadPoemShard(n) {
  if (POEM_SHARDS.has(n)) return POEM_SHARDS.get(n);
  const p = fetch(`data/poems/s${n}.json`).then(r => r.ok ? r.json() : {}).catch(() => ({}));
  POEM_SHARDS.set(n, p);
  return p;
}
async function loadPoem(id) {
  const ix = await loadPoemIndex(); if (!ix) return null;
  const row = ix.byId.get(id); if (!row) return null;
  const sh = await loadPoemShard(row.shard);
  return sh[id] ? { ...sh[id], row } : null;
}

// ---------- small pieces ----------
const poemColor = ci => { const x = POEM_IX.colors[ci]; return { n: x[0], h: x[1], app: !!x[2], fam: x[3], near: x[4] }; };
const poemEra = y => y == null ? null : (POEM_ERAS.slice(1).find(e => y >= e[2] && y < e[3]) || [])[0] || null;
const poemYear = (y, approx) => y == null ? "" : (approx ? "c. " : "") + (y < 0 ? `${-y} BCE` : String(y));
const poemStrip = (pal, cls = "pm-strip") => pal.length ? `<span class="${cls}">${pal.map(([ci, n]) => `<i style="--c:${poemColor(ci).h};flex:${n}"></i>`).join("")}</span>` : "";
// A color word shown in its color. Light colors tint the word itself; dark ones keep the ink and get a small swatch,
// so every word stays readable on the dark ground.
// Inside another button (a card, a quote) the word is a plain span: pass attrs = "" for that.
function poemWord(text, hex, attrs = "") {
  const L = lab(hex)[0], tag = attrs ? "button" : "span";
  return L >= 42 ? `<${tag} class="pw lit" style="--c:${hex}" ${attrs}>${esc(text)}</${tag}>`
    : `<${tag} class="pw dim" style="--c:${hex}" ${attrs}><i></i>${esc(text)}</${tag}>`;
}
// One line with its marks: marks are [start, end, html-for-the-word]
function markLine(line, marks) {
  let out = "", at = 0;
  marks.slice().sort((a, b) => a[0] - b[0]).forEach(([s, e, html]) => { if (s < at) return; out += esc(line.slice(at, s)) + html; at = e; });
  return out + esc(line.slice(at));
}
function poemTextHTML(lines, mentions, wordFor) {
  const by = new Map();
  (mentions || []).forEach(m => { if (!by.has(m[0])) by.set(m[0], []); by.get(m[0]).push(m); });
  return lines.map((l, i) => l.trim() === "" ? `<span class="pm-gap"></span>`
    : `<span class="pm-l">${markLine(l, (by.get(i) || []).map(m => [m[1], m[2], wordFor(l.slice(m[1], m[2]), m[3])]))}</span>`).join("");
}
function poemRowHTML(p) {
  return `<button class="pm-row" data-poem="${esc(p.id)}"><span class="pm-row-t"><b>${esc(p.title)}</b><small>${esc(p.poet)}${p.year != null ? " · " + esc(poemYear(p.year, p.approx)) : ""}${p.orig ? ` · <em>${esc(p.trad)} original</em>` : ""}</small></span>${poemStrip(p.pal)}</button>`;
}

// ---------- poem of the day: the same poem for everyone on a given day ----------
function poemOfDay(ix) {
  const pool = ix.list.filter(p => p.pal.length >= 2 && p.lines >= 3 && p.lines <= 24 && !p.title.endsWith("…"));
  let h = 2166136261; for (const ch of "poem" + today()) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return pool[(h >>> 0) % pool.length];
}
// The line that best shows a poem's colors: the one with the most color words (ties: the earliest)
function poemKeyLine(poem) {
  const count = new Map(); (poem.m || []).forEach(m => count.set(m[0], (count.get(m[0]) || 0) + 1));
  let best = null; count.forEach((n, li) => { if (!best || n > best[1]) best = [li, n]; });
  return best ? best[0] : 0;
}
function poemLineHTML(poem, li) {
  const ms = (poem.m || []).filter(m => m[0] === li), line = poem.l[li] || "";
  const ind = line.length - line.trimStart().length;
  return markLine(line.trim(), ms.map(m => [m[1] - ind, m[2] - ind, poemWord(line.slice(m[1], m[2]), poemColor(m[3]).h)]));
}
// For Today (placed by learn.js): `${poemOfTheDayCard()}`. It fills itself in once the index arrives; it opens the poem.
function poemOfTheDayCard() {
  const id = "potd" + Math.random().toString(36).slice(2, 8);
  requestAnimationFrame(async () => {
    const el = document.getElementById(id); if (!el) return;
    const ix = await loadPoemIndex(); if (!ix || !document.getElementById(id)) return;
    const p = poemOfDay(ix), poem = await loadPoem(p.id);
    if (!poem || !document.getElementById(id)) return;
    el.innerHTML = `<span class="eyebrow">Poem of the day</span>${poemStrip(p.pal, "pm-strip big")}<span class="pm-potd-line">${poemLineHTML(poem, poemKeyLine(poem))}</span><b>${esc(p.title)}</b><small>${esc(p.poet)}${p.year != null ? " · " + esc(poemYear(p.year, p.approx)) : ""}</small>`;
    el.classList.add("on");
    el.onclick = () => { POEM_ORIGIN = S.tab || "learn"; XSTACK = []; poemPage(p.id); };
  });
  return `<button class="pm-potd" id="${id}" aria-label="Poem of the day"><span class="eyebrow">Poem of the day</span></button>`;
}

// ======================================================================
// The Poems lens in Explore
// ======================================================================
function poemsPanel(el) {
  el.innerHTML = `<p class="x-sub">Public-domain poems from Homer to Langston Hughes, every color word shown in its color.</p><div class="pm-loading fine">Opening the archive…</div>`;
  loadPoemIndex().then(ix => {
    if (!ix) { el.innerHTML = `<p class="fine">The poetry archive couldn't load. Check the connection and try again.</p>`; return; }
    const p = poemOfDay(ix);
    const used = new Map();   // color index -> how many poems name it
    ix.list.forEach(x => x.pal.forEach(([ci]) => used.set(ci, (used.get(ci) || 0) + 1)));
    const tradCount = new Map(); ix.list.forEach(x => tradCount.set(x.trad, (tradCount.get(x.trad) || 0) + 1));
    const trads = [...tradCount.keys()].sort((a, b) => a === "English" ? -1 : b === "English" ? 1 : tradCount.get(b) - tradCount.get(a));
    const dots = fam => [...used.keys()].filter(ci => poemColor(ci).fam === fam && used.get(ci) >= 2).sort((a, b) => used.get(b) - used.get(a));
    el.innerHTML = `
      <p class="x-sub">${ix.list.length.toLocaleString()} public-domain poems from Homer to Langston Hughes. Every color word is shown in its color; world poems sit beside their originals.</p>
      <button class="pm-potd big" data-poem="${esc(p.id)}"><span class="eyebrow">Poem of the day</span>${poemStrip(p.pal, "pm-strip big")}<span class="pm-potd-line" id="pm-potd-line"></span><b>${esc(p.title)}</b><small>${esc(p.poet)}${p.year != null ? " · " + esc(poemYear(p.year, p.approx)) : ""}</small></button>
      <div class="sec-head"><b>Find poems by color</b><span>${used.size} colors</span></div>
      <div class="pm-fams">${POEM_FAMS.map(f => `<button data-fam="${f}" class="${POEM_UI.fam === f ? "on" : ""}">${f}</button>`).join("")}</div>
      <div class="pm-dots" id="pm-dots"></div>
      <div class="sec-head"><b>World poetry</b><span>${trads.length} traditions</span></div>
      <div class="pm-chips" data-group="trad"><button data-v="all" class="${POEM_UI.trad === "all" ? "on" : ""}">All</button>${trads.map(t => `<button data-v="${esc(t)}" class="${POEM_UI.trad === t ? "on" : ""}">${esc(t)} <em>${tradCount.get(t).toLocaleString()}</em></button>`).join("")}</div>
      <div class="pm-chips" data-group="era">${POEM_ERAS.map(([k, t]) => `<button data-v="${k}" class="${POEM_UI.era === k ? "on" : ""}">${t}</button>`).join("")}</div>
      <label class="search pm-search"><span>${ICON.search}</span><input id="pm-q" type="search" placeholder="Title or poet" autocomplete="off" value="${esc(POEM_UI.q)}"></label>
      <div class="sec-head" id="pm-list-head"><b>Poems</b><span></span></div>
      <div id="pm-list"></div>`;
    loadPoem(p.id).then(poem => { const s = el.querySelector("#pm-potd-line"); if (poem && s) s.innerHTML = poemLineHTML(poem, poemKeyLine(poem)); });
    const dotsEl = el.querySelector("#pm-dots"), list = el.querySelector("#pm-list"), head = el.querySelector("#pm-list-head");
    const drawDots = () => {
      const f = POEM_UI.fam || (POEM_UI.color != null ? poemColor(POEM_UI.color).fam : null);
      if (!f) { dotsEl.innerHTML = `<p class="fine" style="margin-top:10px">Pick a family, then a color.</p>`; return; }
      dotsEl.innerHTML = dots(f).slice(0, 40).map(ci => { const c = poemColor(ci); return `<button class="pm-dot${POEM_UI.color === ci ? " on" : ""}" data-ci="${ci}" title="${esc(c.n)}"><i style="--c:${c.h}"></i><span>${esc(c.n)}</span><em>${used.get(ci)}</em></button>`; }).join("");
    };
    const filtered = () => {
      const q = POEM_UI.q.trim().toLowerCase();
      let rows = ix.list.filter(x => (POEM_UI.trad === "all" || x.trad === POEM_UI.trad) && (POEM_UI.era === "all" || poemEra(x.year) === POEM_UI.era)
        && (!q || x.title.toLowerCase().includes(q) || x.poet.toLowerCase().includes(q)));
      if (POEM_UI.color != null) {
        const score = x => { const hit = x.pal.find(([ci]) => ci === POEM_UI.color); return hit ? hit[1] * 10 - Math.min(x.lines, 400) / 60 : 0; };
        rows = rows.filter(x => x.pal.some(([ci]) => ci === POEM_UI.color)).sort((a, b) => score(b) - score(a));
      } else if (POEM_UI.fam) {
        const score = x => x.pal.reduce((s, [ci, n]) => s + (poemColor(ci).fam === POEM_UI.fam ? n : 0), 0);
        rows = rows.filter(x => score(x) > 0).sort((a, b) => score(b) - score(a) || a.lines - b.lines);
      } else {
        // default order: world originals and color-rich short poems first, shuffled by day
        rows = seeded(rows, today()).sort((a, b) => (b.orig - a.orig) || (Math.min(b.pal.length, 4) - Math.min(a.pal.length, 4)));
      }
      return rows;
    };
    const drawList = () => {
      const rows = filtered();
      const what = POEM_UI.color != null ? `naming ${poemColor(POEM_UI.color).n.toLowerCase()}` : POEM_UI.fam ? `naming ${POEM_UI.fam.toLowerCase()}` : "";
      head.innerHTML = `<b>Poems${what ? " " + esc(what) : ""}</b><span>${rows.length.toLocaleString()}</span>`;
      list.innerHTML = rows.length ? rows.slice(0, POEM_UI.shown).map(poemRowHTML).join("") + (rows.length > POEM_UI.shown ? `<button class="btn ghost pm-more" data-more>Show more ${ICON.arrow}</button>` : "")
        : `<p class="fine">No poems match. Try another era or tradition.</p>`;
    };
    drawDots(); drawList();
    el.addEventListener("click", e => {
      const pm = e.target.closest("[data-poem]"); if (pm) { POEM_ORIGIN = "explore"; return poemPage(pm.dataset.poem); }
      const f = e.target.closest("[data-fam]");
      if (f) { POEM_UI.fam = POEM_UI.fam === f.dataset.fam && POEM_UI.color == null ? null : f.dataset.fam; POEM_UI.color = null; POEM_UI.shown = 40;
        el.querySelectorAll("[data-fam]").forEach(b => b.classList.toggle("on", b.dataset.fam === POEM_UI.fam)); drawDots(); drawList(); return; }
      const d = e.target.closest("[data-ci]");
      if (d) { const ci = +d.dataset.ci; POEM_UI.color = POEM_UI.color === ci ? null : ci; POEM_UI.shown = 40; drawDots(); drawList(); buzz(6); return; }
      const ch = e.target.closest(".pm-chips button");
      if (ch) { const g = ch.parentElement.dataset.group; POEM_UI[g] = ch.dataset.v; POEM_UI.shown = 40;
        ch.parentElement.querySelectorAll("button").forEach(b => b.classList.toggle("on", b === ch)); drawList(); return; }
      if (e.target.closest("[data-more]")) { POEM_UI.shown += 60; drawList(); }
    });
    const q = el.querySelector("#pm-q");
    q.addEventListener("input", () => { POEM_UI.q = q.value; POEM_UI.shown = 40; drawList(); });
  });
}

// ======================================================================
// A poem page
// ======================================================================
async function poemPage(id, opts = {}) {
  if (!opts.back && XSTACK[XSTACK.length - 1] !== "poem:" + id) XSTACK.push("poem:" + id);
  const poem = await loadPoem(id);
  if (!poem) { toast("That poem couldn't load"); return; }
  const r = poem.row, ix = POEM_IX;
  const hasOrig = !!(poem.o && poem.o.length);
  const view = hasOrig ? (S.poemView || "both") : "en";
  const word = (text, ci) => { const c = poemColor(ci); return poemWord(text, c.h, `data-ci="${ci}"`); };
  const oword = (text, key) => {
    if (typeof key === "number") return word(text, key);
    const g = ix.gloss[key]; if (!g) return esc(text);
    if (g.c == null) return `<button class="pw note" data-g="${esc(key)}">${esc(text)}</button>`;
    return poemWord(text, poemColor(g.c).h, `data-g="${esc(key)}"`);
  };
  const tr = poem.tr ? (poem.tr === "ColorHub's plain translation" ? `ColorHub's plain translation` : `Translated by ${esc(poem.tr)}`) : "";
  const src = poem.src ? `${poem.url ? `<a href="${esc(poem.url)}" target="_blank" rel="noopener">${esc(poem.src)}</a>` : esc(poem.src)}${poem.pub ? `, ${poem.pub}` : ""}` : "";
  const origText = hasOrig ? `<div class="pm-text pm-orig lang-${esc(r.trad === "Japanese" ? "ja" : r.trad === "Chinese" ? "zh" : r.trad === "Persian" ? "fa" : "x")}" ${r.trad === "Persian" ? 'dir="rtl"' : ""}>
      <p class="eyebrow">${esc(r.trad)}</p>${poemTextHTML(poem.o, poem.om, oword)}
      ${poem.ro && poem.ro.length ? `<p class="pm-read">${poem.ro.map(esc).join("<br>")}</p>` : ""}</div>` : "";
  const enText = `<div class="pm-text pm-en">${hasOrig ? `<p class="eyebrow">English</p>` : ""}${poemTextHTML(poem.l, poem.m, word)}</div>`;
  const el = show(`
    <header class="art-top"><button class="icon-btn glass" data-back aria-label="Back">${ICON.back}</button>
      ${hasOrig ? `<div class="pm-view" role="tablist">${[["both", "Both"], ["orig", "Original"], ["en", "English"]].map(([k, t]) => `<button class="${view === k ? "on" : ""}" data-view="${k}">${t}</button>`).join("")}</div>` : ""}</header>
    ${r.pal.length ? `<div class="pm-palette">${r.pal.map(([ci, n]) => { const c = poemColor(ci); return `<button style="--c:${c.h};flex:${n}" data-ci="${ci}" data-ink="${ink(c.h)}" aria-label="${esc(c.n)}"><span>${esc(c.n)}</span></button>`; }).join("")}</div>
      <p class="fine pm-pal-cap">The colors in this poem, in the order they appear</p>` : ""}
    <p class="eyebrow p-type">${esc(r.trad === "English" ? "Poem" : r.trad)}${r.year != null ? " · " + esc(poemYear(r.year, r.approx)) : ""}</p>
    <h1 class="p-title pm-title">${esc(poem.t)}</h1>
    <p class="p-dek">${esc(r.poet)}${poem.po && poem.po !== r.poet ? ` <span class="pm-po">${esc(poem.po)}</span>` : ""}${poem.dated ? `<br><span class="pm-dated">${esc(poem.dated)}</span>` : ""}</p>
    <div class="pm-body view-${view}">${origText}${enText}</div>
    ${poem.tnote ? `<p class="fine">${esc(poem.tnote)}</p>` : ""}
    <section class="srcs"><h3>Source</h3><ul>
      ${tr || src ? `<li>${tr}${tr && src ? " · " : ""}${src}</li>` : ""}
      ${hasOrig && poem.ourl ? `<li>Original: <a href="${esc(poem.ourl)}" target="_blank" rel="noopener">${esc((() => { try { return decodeURIComponent(poem.ourl); } catch (e) { return poem.ourl; } })().replace(/^https?:\/\/(www\.)?/, "").replace(/_/g, " "))}</a></li>` : ""}
      <li>Public domain in the United States. Hex values are screen approximations of the words, not measurements.</li></ul></section>
  `, "article poem");
  const back = () => { if (XSTACK.length <= 1) { XSTACK = []; return go(POEM_ORIGIN || "explore"); } xBack(); };
  el.querySelector("[data-back]").onclick = back;
  onKey = e => { if (e.key === "Escape") back(); };
  el.querySelectorAll("[data-view]").forEach(b => b.onclick = () => {
    S.poemView = b.dataset.view; save();
    el.querySelectorAll("[data-view]").forEach(x => x.classList.toggle("on", x === b));
    const body = el.querySelector(".pm-body"); body.className = "pm-body view-" + b.dataset.view;
  });
  el.addEventListener("click", e => {
    const w = e.target.closest("[data-ci]"); if (w) return poemColorTap(+w.dataset.ci);
    const g = e.target.closest("[data-g]"); if (g) return poemGlossSheet(g.dataset.g, g.textContent);
  });
}
// A color word: app colors open their page; library names open a small sheet
function poemColorTap(ci) {
  const c = poemColor(ci);
  const n = c.app && graph().nodes.get("c:" + c.n);
  if (n) return openNode(n);
  const near = c.near && graph().nodes.get("c:" + c.near);
  const { sh, close } = sheet(`<div class="pm-sw" style="--c:${c.h}" data-ink="${ink(c.h)}"><span class="mono">${c.h}</span></div>
    <h3>${esc(c.n)}</h3><p>A name from the color library, the closest match for this word in the poem. Screen approximation.</p>
    ${near ? `<button class="item" data-near>${esc(near.title)}, the nearest color in the course ${ICON.arrow}</button>` : ""}`);
  const b = sh.querySelector("[data-near]"); if (b) b.onclick = () => { close(); openNode(near); };
}
function poemGlossSheet(key, text) {
  const g = POEM_IX.gloss[key]; if (!g) return;
  const c = g.c != null ? poemColor(g.c) : null;
  const { sh, close } = sheet(`${c ? `<div class="pm-sw" style="--c:${c.h}" data-ink="${ink(c.h)}"><span class="mono">${c.h}</span></div>` : ""}
    <p class="eyebrow">${esc(text)}${g.r ? " · " + esc(g.r) : ""}</p><h3>${esc(g.w)}</h3><p>${esc(g.note)}</p>
    ${c ? `<button class="item" data-open>${c.app ? esc(c.n) : "Closest named color: " + esc(c.n)} ${ICON.arrow}</button>` : ""}
    <p class="fine">Old color words rarely match one modern hue. The swatch is a guide, not a claim.</p>`);
  const b = sh.querySelector("[data-open]"); if (b) b.onclick = () => { close(); poemColorTap(g.c); };
}

// ======================================================================
// "In poems" on a color page
// ======================================================================
async function colorPoems(el, c) {
  if (!el) return;
  const ix = await loadPoemIndex(); if (!ix || !el.isConnected) return;
  const ci = ix.colorByName.get(c.n.toLowerCase());
  const best = ci != null && ix.best[ci];
  if (!best || !best.length) { el.remove(); return; }
  // lines that carry their text in the index come first; fetch the rest only if there are too few
  let items = best.filter(b => b.length > 2).slice(0, 6);
  if (items.length < 3) {
    for (const b of best.filter(b => b.length === 2).slice(0, 3 - items.length)) {
      const p = await loadPoem(b[0]); if (!p) continue;
      const line = p.l[b[1]], m = p.m.find(m => m[0] === b[1] && m[3] === ci); if (!m) continue;
      const ind = line.length - line.trimStart().length;
      items.push([b[0], b[1], line.trim(), m[1] - ind, m[2] - ind]);
    }
  }
  if (!el.isConnected) return;
  const count = ix.list.filter(p => p.pal.some(([x]) => x === ci)).length;
  el.innerHTML = `<section class="pm-in"><h3>In poems</h3>${items.map(([id, li, text, s, e]) => {
    const p = ix.byId.get(id); if (!p) return "";
    return `<button class="pm-q" data-poem="${esc(id)}"><span class="pm-q-line">${markLine(text, [[s, e, poemWord(text.slice(s, e), c.h)]])}</span><small>${esc(p.poet)} · ${esc(p.title)}</small></button>`;
  }).join("")}${count > items.length ? `<button class="btn ghost" data-allpoems>All ${count.toLocaleString()} poems naming ${esc(c.n.toLowerCase())} ${ICON.arrow}</button>` : ""}</section>`;
  el.addEventListener("click", e => {
    const p = e.target.closest("[data-poem]"); if (p) { POEM_ORIGIN = "explore"; return poemPage(p.dataset.poem); }
    if (e.target.closest("[data-allpoems]")) { Object.assign(POEM_UI, { color: ci, fam: null, era: "all", trad: "all", q: "", shown: 40 }); S.lens = "poems"; save(); go("explore"); }
  });
}
