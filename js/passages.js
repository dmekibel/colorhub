"use strict";
// Passages: color in literature. Short public-domain passages (US, published before 1930) with every color word
// set in its own color, a strip of the colors named, and a line of our own on why the passage matters.
// Data: data/passages.json (built by tools/passages.py), fetched once in the background.
// Exports for Explore: passagesSection() (a section for a lens), passagePage(p), passagesIndexPage(),
// inBooksRow(color) (the "In books" row on a color page). Also the shared archive plumbing used by js/films.js:
// archOpen(node), archWhen(fn), archPaint(text, mentions).
// Pages are graph nodes added on first open, so Explore's back stack (XSTACK + xBack) works through them.

const ARCH_V = ((document.currentScript && document.currentScript.src.match(/[?&]v=([\w.-]+)/)) || [])[1] || "";
let PSG = null;                      // { list, byId, byAuthor }
const ARCH_WAIT = [];                // callbacks waiting for data
const archWhen = fn => { if (PSG && window.FILMS) fn(); else ARCH_WAIT.push(fn); };
let ARCH_STALE = false;              // an Explore feed was drawn before the data arrived
function archReady() {
  if (!PSG || !window.FILMS) return;
  ARCH_WAIT.splice(0).forEach(f => { try { f(); } catch (e) { console.error(e); } });
  // redraw that feed in place, now with the passages and films
  if (ARCH_STALE && document.getElementById("feed") && typeof exploreHome === "function") { const y = scrollY; exploreHome(); scrollTo(0, y); }
  ARCH_STALE = false;
}
fetch("data/passages.json" + (ARCH_V ? "?v=" + ARCH_V : "")).then(r => r.ok ? r.json() : { passages: [] }).catch(() => ({ passages: [] })).then(d => {
  // mentions come compact ([offset, length, color index]); expand them to {w, at, len, name, h, app, d}
  (d.passages || []).forEach(p => { p.mentions = p.mentions.map(([at, len, ci]) => ({ ...p.colors[ci], w: p.text.slice(at, at + len), at, len })); });
  const list = d.passages || [], byId = new Map(list.map(p => [p.id, p])), byAuthor = new Map();
  list.forEach(p => { if (!byAuthor.has(p.author)) byAuthor.set(p.author, []); byAuthor.get(p.author).push(p); });
  PSG = { list, byId, byAuthor };
  archReady();
});

// ---------- nodes: passages and films join the graph when first opened ----------
function archNode(kind, rec) {
  const id = (kind === "film" ? "film:" : "psg:") + rec.id;
  const g = graph();
  if (g.nodes.has(id)) return g.nodes.get(id);
  const n = kind === "film"
    ? { kind: "film", type: "film", id, title: rec.title, rec, year: rec.year, dek: rec.dek, swatches: rec.colors.map(c => ({ h: c.h, label: c.name })), page: () => filmPage(rec) }
    : { kind: "passage", type: "passage", id, title: rec.title, rec, dek: `${rec.author}, ${rec.work}`, swatches: rec.colors.slice(0, 6).map(c => ({ h: c.h, label: c.name })), page: () => passagePage(rec) };
  g.nodes.set(id, n);
  return n;
}
function archOpen(node) { if (node) openNode(node); }
const PSG_INDEX_NODE = () => { const g = graph(); if (!g.nodes.has("psg:index")) g.nodes.set("psg:index", { kind: "list", type: "list", id: "psg:index", title: "In books", page: () => passagesIndexPage() }); return g.nodes.get("psg:index"); };
// every [data-arch] in the app opens its passage, film or list
document.addEventListener("click", e => {
  const a = e.target.closest("[data-arch]"); if (!a) return;
  e.preventDefault();
  const [kind, id] = a.dataset.arch.split(/:(.*)/s);
  archWhen(() => {
    if (kind === "psg" && id === "index") return archOpen(PSG_INDEX_NODE());
    if (kind === "psg") { const p = PSG.byId.get(id); if (p) archOpen(archNode("passage", p)); }
    if (kind === "film") { const f = (window.FILMS || []).find(x => x.id === id); if (f) archOpen(archNode("film", f)); }
  });
});

// ---------- color words in their colors ----------
// Light colors are set in their own color. Middle ones are lifted to a readable lightness (same hue) and keep a
// true-color underline. Dark ones (black, navy, oxblood) stay ink and carry a true-color chip.
function archInk(h) {
  const [L, C, H] = lch(h);
  if (L >= 62) return { cls: C < 10 && L > 86 ? "cw cw-pale" : "cw", t: h };
  if (L >= 30) return { cls: "cw cw-mid", t: lchHex(70, Math.min(C, 70), H) };
  return { cls: "cw cw-dark", t: "" };
}
function archPaint(text, mentions, only) {
  let out = "", last = 0;
  (mentions || []).forEach(m => {
    if (m.at < last) return;
    const k = archInk(m.h), on = !only || m.app === only;
    out += esc(text.slice(last, m.at)) + `<span class="${k.cls}${on ? "" : " cw-off"}" style="--c:${m.h};--t:${k.t || "var(--ink)"}" title="${esc(m.name)}">${esc(text.slice(m.at, m.at + m.len))}</span>`;
    last = m.at + m.len;
  });
  return out + esc(text.slice(last));
}
const psgParas = p => { const out = []; let at = 0; p.text.split("\n\n").forEach(t => { out.push({ t, at }); at += t.length + 2; }); return out; };
function psgHTML(p) {
  return psgParas(p).map(({ t, at }) => `<p>${archPaint(t, p.mentions.filter(m => m.at >= at && m.at < at + t.length).map(m => ({ ...m, at: m.at - at })))}</p>`).join("");
}
// a short excerpt: the sentence around a chosen mention (default the first), trimmed to about n characters
function psgExcerpt(p, m, n = 170, hl = false) {
  m = m || p.mentions[0];
  const t = p.text;
  let a = m.at, b = m.at + m.len;
  const starts = [...t.slice(0, a).matchAll(/[.!?;:]["”’)]?\s+|\n\n/g)];
  a = starts.length ? starts[starts.length - 1].index + starts[starts.length - 1][0].length : 0;
  if (m.at - a > n * .6) { a = t.lastIndexOf(" ", m.at - Math.round(n * .35)) + 1; }
  const endRel = t.slice(b).search(/[.!?]["”’)]?(\s|$)/);
  b = endRel < 0 ? t.length : b + endRel + 1;
  if (b - a > n) { b = t.indexOf(" ", Math.max(m.at + m.len, a + n)); if (b < 0) b = t.length; }
  const pre = a > 0 ? "…" : "", post = b < t.length && !/[.!?]["”’)]?$/.test(t.slice(a, b)) ? "…" : "";
  const ms = p.mentions.filter(x => x.at >= a && x.at + x.len <= b).map(x => ({ ...x, at: x.at - a }));
  return { html: pre + archPaint(t.slice(a, b).replace(/\n\n/g, " "), ms, hl ? m.app : null) + post, len: b - a };
}
const psgCite = p => `${p.author} · ${p.year < 0 ? Math.abs(p.year) + " BCE" : p.year < 1500 ? "c. " + p.year : p.year}`;
const psgStrip = (p, cls = "psg-strip") => `<span class="${cls}">${p.colors.map(c => `<i style="--c:${c.h};flex:${Math.min(c.n, 6)}"></i>`).join("")}</span>`;

// a captioned, credited picture (public domain or CC; credit + license link always shown)
const archFig = f => `<figure class="fig arch-fig"><img src="${esc(f.src)}" alt="${esc(f.alt || "")}" loading="lazy"${f.w ? ` width="${f.w}" height="${f.h}"` : ""}><figcaption>${esc(f.caption || "")}<span>${f.commons ? `<a href="${esc(f.commons)}" target="_blank" rel="noopener">${esc(f.credit || "Wikimedia Commons")}</a>` : esc(f.credit || "")}${f.licenseUrl ? ` · <a href="${esc(f.licenseUrl)}" target="_blank" rel="noopener">License</a>` : ""}</span></figcaption></figure>`;

// ---------- pins ----------
function psgPin(p, withImg) {
  const ex = psgExcerpt(p);
  const lines = Math.ceil(ex.len / 21), im = withImg && (p.imgs || [])[0];
  const ar = im && im.w ? im.h / im.w : 0;
  return { h: 18 + lines * 21 + 70 + (im ? 167 * ar + 8 : 0), html: `<button class="pin pin-psg${im ? " has-img" : ""}" data-arch="psg:${esc(p.id)}">${im ? `<img src="${esc(im.src)}" alt="" loading="lazy" style="aspect-ratio:${(1 / ar).toFixed(3)}">` : ""}${psgStrip(p)}<span class="psg-ex">${ex.html}</span><b>${esc(p.title)}</b><small>${esc(psgCite(p))}</small></button>` };
}
function psgAllPin(n) {
  return { h: 150, html: `<button class="pin pin-arch-all" data-arch="psg:index"><span class="eyebrow">The archive</span><b>All ${n} passages</b><small>By writer, or by the color they name</small></button>` };
}

// A section for any Explore lens: a dozen passages that change each day, then the way into the full archive.
function passagesSection(count = 12) {
  if (!PSG) { ARCH_STALE = true; return { title: "In books", sub: "Loading the passages…", pins: [] }; }
  const day = today(), seen = new Set(), pick = [];
  // one passage per writer, shuffled by day
  seeded(PSG.list, "psg" + day).forEach(p => { if (pick.length < count && !seen.has(p.author)) { seen.add(p.author); pick.push(p); } });
  return { title: "In books", sub: "Color words from novels, stories and old color books, each set in the color it names.", pins: [...pick.map((p, i) => psgPin(p, i % 3 === 0)), psgAllPin(PSG.list.length)] };
}

// ---------- the passage page ----------
function passagePage(p) {
  const more = (PSG.byAuthor.get(p.author) || []).filter(x => x !== p);
  const top = p.colors.slice().sort((a, b) => b.n - a.n)[0];
  const alsoColor = top ? PSG.list.filter(x => x !== p && x.author !== p.author && x.colors.some(c => c.app === top.app)) : [];
  const tr = p.translator ? ` · translated by ${p.translator}${p.trYear ? ", " + p.trYear : ""}` : "";
  const el = show(`
    <header class="art-top"><button class="icon-btn glass" data-back aria-label="Back">${ICON.back}</button></header>
    <div class="psg-pal">${p.colors.map(c => `<button style="--c:${c.h};flex:${Math.min(c.n, 6)}" data-to="c:${esc(c.app)}" aria-label="${esc(c.name)}"></button>`).join("")}</div>
    <p class="eyebrow p-type">Passage · ${esc(psgCite(p).split(" · ")[1])}</p>
    <h1 class="p-title psg-title">${esc(p.title)}</h1>
    <p class="p-dek">${esc(p.author)}, <i>${esc(p.work)}</i>${p.loc ? ` · ${esc(p.loc)}` : ""}${esc(tr)}</p>
    ${(p.imgs || [])[0] ? archFig(p.imgs[0]) : ""}
    <blockquote class="psg-text">${psgHTML(p)}</blockquote>
    <section class="psg-why"><h3>Why it matters</h3><p>${linkText(p.context)}</p></section>
    ${(p.imgs || []).slice(1).map(archFig).join("")}
    <section class="psg-cols"><h3>Colors named</h3>${p.colors.map(c => {
      const words = [...new Set(p.mentions.filter(m => m.name === c.name).map(m => m.w.toLowerCase()))];
      return `<button class="pal-name" data-to="c:${esc(c.app)}"><i style="--c:${c.h}"></i><b>${esc(c.name)}</b><span>${words.map(w => `“${esc(w)}”`).join(", ")}${c.n > 1 ? ` · ${c.n} times` : ""}${c.app !== c.name ? ` · nearest app color: ${esc(c.app)}` : ""}</span><em class="mono">${c.h}</em></button>`;
    }).join("")}<p class="fine">Hex values are our screen approximations of what each word meant.</p></section>
    ${more.length ? `<div class="sec-head"><b>More from ${esc(p.author)}</b><span>${more.length}</span></div>${masonry(more.slice(0, 6).map(psgPin))}` : ""}
    ${alsoColor.length ? `<div class="sec-head"><b>Also ${esc(top.app.toLowerCase())}</b><span>${alsoColor.length}</span></div>${masonry(seeded(alsoColor, p.id).slice(0, 4).map(psgPin))}` : ""}
    <section class="srcs"><h3>Source</h3><ul><li><a href="${esc(p.source)}" target="_blank" rel="noopener">${esc(p.work)}${p.translator ? ` (${esc(p.translator)})` : ""} · Project Gutenberg</a></li>
      <li>Public domain in the US: ${p.translator ? (p.trYear ? `this translation was published in ${p.trYear}, before 1930` : "an older translation that Project Gutenberg cleared as US public domain") : `published in ${p.year < 0 ? Math.abs(p.year) + " BCE" : p.year}, before 1930`}.</li></ul>
      <p class="fine"><button class="lnk" data-arch="psg:index">All passages</button></p></section>
  `, "article psg-page");
  el.querySelector("[data-back]").onclick = xBack;
  onKey = e => { if (e.key === "Escape") xBack(); };
  wireLinks(el);
}

// ---------- the archive: every passage, by writer or by color ----------
const PSG_FAMS = [["all", "All"], ["Red", "Reds"], ["Orange", "Oranges"], ["Yellow", "Yellows"], ["Green", "Greens"], ["Blue", "Blues"], ["Purple", "Purples"], ["Pink", "Pinks"], ["Brown", "Browns"], ["White", "Whites"], ["Grey", "Greys"], ["Black", "Blacks"]];
const psgFam = h => { const L = lab(h); let best = null, bd = 1e9; BASICS.forEach(b => { const d = de2000(L, b.lab || (b.lab = lab(b.h))); if (d < bd) { bd = d; best = b.n; } }); return best; };
function passagesIndexPage(fam) {
  fam = fam || "all";
  const list = fam === "all" ? PSG.list : PSG.list.filter(p => p.colors.some(c => (c.fam || (c.fam = psgFam(c.h))) === fam));
  const groups = new Map();
  list.slice().sort((a, b) => a.author.split(" ").pop().localeCompare(b.author.split(" ").pop()) || a.year - b.year).forEach(p => { if (!groups.has(p.author)) groups.set(p.author, []); groups.get(p.author).push(p); });
  const el = show(`
    <header class="art-top"><button class="icon-btn glass" data-back aria-label="Back">${ICON.back}</button></header>
    <p class="eyebrow p-type">The archive · ${PSG.list.length} passages · ${PSG.byAuthor.size} writers</p>
    <h1 class="p-title">In books</h1>
    <p class="p-dek">Passages where color does real work, from Homer to Woolf. Every text here was published, or translated, before 1930, so it is free to read.</p>
    <div class="lens-key in-page psg-fams">${PSG_FAMS.map(([k, t]) => `<button class="${k === fam ? "on" : ""}" data-fam="${k}">${k !== "all" ? `<i style="--c:${BYNAME.get(k.toLowerCase()).h}"></i>` : ""}${t}</button>`).join("")}</div>
    <div class="psg-index">${[...groups].map(([a, ps]) => `<section><h3>${esc(a)}</h3>${ps.map(p => `<button class="psg-row" data-arch="psg:${esc(p.id)}">${psgStrip(p, "psg-row-strip")}<b>${esc(p.title)}</b><small>${esc(p.work)} · ${esc(psgCite(p).split(" · ")[1])}</small></button>`).join("")}</section>`).join("")}</div>
  `, "article psg-index-page");
  el.querySelector("[data-back]").onclick = xBack;
  onKey = e => { if (e.key === "Escape") xBack(); };
  el.querySelectorAll("[data-fam]").forEach(b => b.onclick = () => passagesIndexPage(b.dataset.fam));
}

// ---------- "In books" on a color page ----------
// Passages that name this color (or a word whose nearest app color it is), the strongest first, one per writer.
function psgForColor(name, n = 4) {
  if (!PSG) return [];
  const scored = PSG.list.map(p => {
    const ms = p.mentions.filter(m => m.app === name && (m.d == null || m.d < 5));
    return { p, ms, s: ms.length + (ms.some(m => m.name === name) ? 2 : 0) + p.colors.length * .05 };
  }).filter(x => x.ms.length).sort((a, b) => b.s - a.s);
  const seen = new Set(), out = [];
  scored.forEach(x => { if (out.length < n && !seen.has(x.p.author)) { seen.add(x.p.author); out.push(x); } });
  return out;
}
// A family fallback (David, 2026-10-08: no almost-empty pages): most passages are matched against one of the
// app's own taught colors, so an untaught library name usually has nothing of its own -- retry with its
// family head and say so, rather than quietly showing nothing.
function inBooksRow(c, famC) {
  let hits = psgForColor(c.n), matchName = c.n, note = "";
  if (!hits.length && famC && famC.n.toLowerCase() !== c.n.toLowerCase()) {
    const famHits = psgForColor(famC.n);
    if (famHits.length) { hits = famHits; matchName = famC.n; note = `<p class="fine">Nothing of ${esc(c.n.toLowerCase())}'s own; its nearest well-covered match, ${esc(famC.n)}, does.</p>`; }
  }
  if (!hits.length) return "";
  return `<section class="arch-row"><h3>In books</h3>${note}${hits.map(({ p, ms }) => {
    const ex = psgExcerpt(p, ms[0], 200, true);
    return `<button class="arch-quote" data-arch="psg:${esc(p.id)}"><span class="psg-ex">${ex.html}</span><small>${esc(p.author)}, <i>${esc(p.work)}</i></small></button>`;
  }).join("")}</section>`;
}
// One hook for color pages: draws "In books" (kind "books", the default and legacy combined call) or "In
// films" (kind "films", pulled out separately so js/richcolor.js can place it under "Found in the world"
// instead of "In words") once the data is in. famC: the color's family head, for the fallback above.
function archiveRows(c, kind, famC) {
  const id = "arch-" + Math.random().toString(36).slice(2, 8);
  archWhen(() => requestAnimationFrame(() => {
    const box = document.getElementById(id); if (!box) return;
    if (kind === "films") box.innerHTML = typeof inFilmsRow === "function" ? inFilmsRow(c, famC) : "";
    else if (kind === "books") box.innerHTML = inBooksRow(c, famC);
    else box.innerHTML = inBooksRow(c, famC) + (typeof inFilmsRow === "function" ? inFilmsRow(c, famC) : "");
    if (kind !== "books" && typeof lkRowInto === "function") lkRowInto(box, c);   // js/looks.js: "In looks"
  }));
  return `<div class="arch-rows" id="${id}"></div>`;
}
