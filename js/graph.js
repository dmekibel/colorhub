"use strict";
// The color web behind Explore. Every color, wiki page, painting and story becomes a node; edges come from
// written [[links]], curated "related" pairs, palettes, and color math (look-alikes, opposites).
// Content files are optional and load late (data/wiki-*.js, stories.js, paintings.js), so the graph is built lazily.

const NAMED_LABEL = { flower: "named after a flower", plant: "named after a plant", fruit: "named after a fruit", food: "named after a food",
  drink: "named after a drink", gem: "named after a gem", mineral: "named after a mineral", metal: "named after a metal", animal: "named after an animal",
  place: "named after a place", person: "named after a person", material: "named after a material", nature: "named after nature", dye: "named after a dye" };
const FACET_LABEL = { language: "Language", history: "History", art: "Art", culture: "Culture", symbolism: "Symbolism", poetry: "Poetry",
  philosophy: "Philosophy", science: "Science", design: "Design" };
const TYPE_LABEL = { concept: "Idea", tradition: "Tradition", movement: "Movement", pigment: "Pigment", person: "Person", work: "Book", culture: "Culture", painting: "Painting", color: "Color", story: "Story" };

let G = null;
function graph() {
  if (G) return G;
  const W = window, nodes = new Map(), byName = new Map();
  // colors
  [...BASICS, ...ALL].forEach(c => {
    const n = { kind: "color", id: "c:" + c.n, title: c.n, h: c.h, c, wiki: (W.WIKI_COLORS || {})[c.n] || null };
    nodes.set(n.id, n); byName.set(c.n.toLowerCase(), n);
  });
  // wiki pages: written ones, then seed stubs for anything not written yet
  (W.WIKI_NODES || []).forEach(p => nodes.set(p.id, { kind: "page", ...p }));
  (W.WIKI_SEED ? W.WIKI_SEED.nodes : []).forEach(([id, type, title]) => { if (!nodes.has(id)) nodes.set(id, { kind: "page", id, type, title, stub: true, body: [] }); });
  // paintings
  (W.PAINTINGS || []).forEach(p => nodes.set(p.id, { kind: "painting", type: "painting", ...p }));
  (W.WIKI_SEED ? W.WIKI_SEED.paintings : []).forEach(([id, title, artist, year]) => { if (!nodes.has(id)) nodes.set(id, { kind: "painting", type: "painting", id, title, artist, year, stub: true, palette: [] }); });
  // stories
  const stories = (W.STORIES || []).map(s => ({ kind: "story", type: "story", ...s, id: "s:" + s.id, sid: s.id }));
  stories.forEach(s => nodes.set(s.id, s));

  const resolve = t => { if (!t) return null; t = t.trim(); return byName.get(t.toLowerCase()) || nodes.get(t) || nodes.get("s:" + t) || null; };

  // written links out of every node
  const out = new Map(), back = new Map();
  const add = (from, to, rel, why) => {
    if (!to || to === from) return;
    if (!out.has(from.id)) out.set(from.id, []);
    out.get(from.id).push({ to, rel, why });
    if (!back.has(to.id)) back.set(to.id, []);
    back.get(to.id).push({ to: from, rel, why });
  };
  // the sentence around a link is the best explanation of the connection
  const sentenceAround = (text, at) => {
    const starts = [...text.slice(0, at).matchAll(/[.!?]\s+(?=[A-Z\[“"])/g)];
    const a = starts.length ? starts[starts.length - 1].index + 1 : 0, b = text.slice(at).search(/[.!?](\s|$)/);
    return plainText(text.slice(a, b < 0 ? text.length : at + b + 1).trim());
  };
  const scan = (from, text, rel) => { if (typeof text === "string") for (const m of text.matchAll(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g)) add(from, resolve(m[1]), rel, sentenceAround(text, m.index)); };
  for (const n of nodes.values()) {
    if (n.kind === "color" && n.wiki) {
      n.wiki.facets.forEach(f => scan(n, f.text, FACET_LABEL[f.k] || f.k));
      (n.wiki.related || []).forEach(r => add(n, resolve(r.to), "kin", r.why));
    }
    if (n.kind === "page" && !n.stub) {
      (n.body || []).forEach(p => scan(n, p, TYPE_LABEL[n.type] || "page"));
      (n.colors || []).forEach(c => add(n, resolve(c), TYPE_LABEL[n.type] || "page"));
    }
    if (n.kind === "painting" && !n.stub) {
      scan(n, n.note, "painting");
      const seen = new Set();
      (n.palette || []).forEach(p => { if (p.vocab && !seen.has(p.vocab)) { seen.add(p.vocab); add(n, resolve(p.vocab), "in its palette", `${Math.round(p.share * 100)}% of the canvas, named ${p.name}`); } });
    }
    if (n.kind === "story") {
      n.slides.forEach(sl => { scan(n, sl.text, "story"); if (sl.v && sl.v.explain) scan(n, sl.v.explain, "story"); });
      (n.colors || []).forEach(c => add(n, resolve(c), "story"));
      (n.links || []).forEach(l => add(n, resolve(l), "story"));
    }
  }
  return (G = { nodes, byName, resolve, out, back, stories });
}
const colorNode = c => graph().byName.get(c.n.toLowerCase());

// ---------- color math edges ----------
const EVERY = () => [...BASICS, ...ALL];
function nearestColors(hex, n = 4, skip) {
  return EVERY().filter(x => x.h !== hex && x.n !== skip).map(x => [x, de2000(hex, x.h)]).sort((a, b) => a[1] - b[1]).slice(0, n);
}
// Hue rotated in LCh, keeping lightness and strength (pulled in if it would leave the screen gamut).
function rotateHue(hex, deg) {
  const [L, C, H] = lch(hex);
  let c = C;
  const h2 = (H + deg + 360) % 360;
  while (c > 2 && !inGamut(L, c * Math.cos(h2 * Math.PI / 180), c * Math.sin(h2 * Math.PI / 180))) c -= 1.5;
  return lchHex(L, c, h2);
}
const opposite = hex => rotateHue(hex, 180);

// Every connection of a node. Each item: { to, rel (short label), why (one sentence), lens }.
// lens says which key it belongs to: spectrum, harmony, origins, paintings, history, ideas, stories.
const plainText = s => String(s || "").replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, a, b) => b || a);
function connections(n) {
  const g = graph(), seen = new Set([n.id]), list = [];
  const push = (to, rel, why, lens) => { if (!to || seen.has(to.id)) return; seen.add(to.id); list.push({ to, rel, why: why || "", lens }); };
  const lensOf = (to, rel) => to.kind === "painting" ? "paintings" : to.kind === "story" ? "stories" : to.kind === "color" ? (rel === "kin" ? "ideas" : "ideas") : to.type === "pigment" ? "history" : "ideas";
  if (n.kind === "color") {
    if (n.c.vs) push(g.resolve(n.c.vs), "Often confused", n.c.d, "spectrum");
    const [opp] = nearestColors(opposite(n.h), 1, n.title);
    if (opp && lch(n.h)[1] > 10) push(colorNode(opp[0]), "Opposite", "Across the color wheel. Side by side, each makes the other look stronger.", "harmony");
    [120, 240].forEach(d => { const [t] = nearestColors(rotateHue(n.h, d), 1, n.title); if (t && lch(n.h)[1] > 10) push(colorNode(t[0]), "Triad", "A third of the way around the color wheel.", "harmony"); });
    [-30, 30].forEach(d => { const [t] = nearestColors(rotateHue(n.h, d), 1, n.title); if (t && lch(n.h)[1] > 10) push(colorNode(t[0]), "Analogous", "Its next-door neighbor on the color wheel.", "harmony"); });
    nearestColors(n.h, 4, n.title).forEach(([x, d]) => push(colorNode(x), "Looks like", `A close neighbor, ΔE ${d.toFixed(1)} away.`, "spectrum"));
  }
  const facetNames = new Set(Object.values(FACET_LABEL));
  (g.out.get(n.id) || []).forEach(e => push(e.to, e.rel === "kin" ? "Kin" : e.to.kind === "painting" ? "Painting" : e.to.kind === "story" ? "Story" : e.to.kind === "color" && facetNames.has(e.rel) ? e.rel : TYPE_LABEL[e.to.type] || e.rel || "Linked", e.why, e.to.kind === "color" ? (e.rel === "in its palette" ? "paintings" : "ideas") : lensOf(e.to, e.rel)));
  (g.back.get(n.id) || []).forEach(e => push(e.to, e.to.kind === "painting" ? "In this painting" : e.to.kind === "story" ? "Story" : e.to.kind === "color" ? "Kin" : TYPE_LABEL[e.to.type] || "Mentions it", e.why, e.to.kind === "painting" ? "paintings" : e.to.kind === "story" ? "stories" : e.to.kind === "color" ? "ideas" : lensOf(e.to)));
  // shared origin: other colors named after the same kind of thing
  if (n.kind === "color" && n.wiki && NAMED_LABEL[n.wiki.named]) {
    [...g.nodes.values()].filter(x => x.kind === "color" && x.wiki && x.wiki.named === n.wiki.named && x !== n)
      .forEach(x => push(x, "Same origin", "Also " + NAMED_LABEL[n.wiki.named] + ".", "origins"));
  }
  // painting-mates: colors that share a painting's palette
  if (n.kind === "color") {
    (g.back.get(n.id) || []).filter(e => e.to.kind === "painting").forEach(e =>
      (g.out.get(e.to.id) || []).filter(x => x.to.kind === "color").forEach(x => push(x.to, "Same painting", `Both in ${e.to.title}.`, "paintings")));
  }
  // history: the colors dated just before and after it
  if (n.kind === "color" && n.wiki && n.wiki.since) {
    const dated = [...g.nodes.values()].filter(x => x.kind === "color" && x.wiki && x.wiki.since).sort((a, b) => a.wiki.since.year - b.wiki.since.year);
    const i = dated.indexOf(n);
    [dated[i - 1], dated[i + 1]].forEach(x => { if (x) push(x, x.wiki.since.year < n.wiki.since.year ? "Came before" : "Came after", `${fmtYear(x.wiki.since)}: ${x.wiki.since.what}`, "history"); });
  }
  return list;
}
const fmtYear = s => { const y = s.year; const t = y < 0 ? `${Math.abs(y).toLocaleString()} BCE` : String(y); return (s.approx ? "c. " : "") + t; };
const nodeColor = n => n.kind === "color" ? n.h : (n.swatches && n.swatches[0] && n.swatches[0].h) || (n.palette && n.palette[0] && n.palette[0].h) || (n.cover && n.cover[0]) || null;
const nodeLabel = n => n.kind === "color" ? "Color" : TYPE_LABEL[n.type] || "Page";

// ---------- [[link]] rendering ----------
function linkText(s) {
  if (!s) return "";
  const g = graph();
  return esc(s).replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, t, l) => {
    const n = g.resolve(t.replace(/&amp;/g, "&")), label = l || t;
    if (!n) return label;
    if (n.kind === "color") return `<a class="wl wl-c" style="--c:${n.h}" data-to="${esc(n.id)}">${label}</a>`;
    return `<a class="wl" data-to="${esc(n.id)}">${label}</a>`;
  });
}

// ---------- names for any color (app names first, then the long list from data/color-names.json) ----------
let LONG_NAMES = null;
// The big name library (data/library.json, 2,700 names from 8 sources), loaded the first time something needs it.
// Each entry keeps its Lab value so live naming (the camera) stays fast. Names flagged crude are never shown.
let LONG_LOADING = null;
function loadLongNames() {
  if (LONG_NAMES) return Promise.resolve(LONG_NAMES);
  return LONG_LOADING || (LONG_LOADING = fetch("data/library.json").then(r => r.ok ? r.json() : []).catch(() => [])
    .then(list => (LONG_NAMES = list.filter(x => !x.crude && /^#[0-9A-Fa-f]{6}$/.test(x.h)).map(x => ({ ...x, lab: lab(x.h) })))));
}
function nameColor(hex, n = 5) {
  const L = lab(hex);
  const mine = EVERY().map(x => ({ n: x.n, h: x.h, mine: true, d: de2000(L, x.lab || (x.lab = lab(x.h))) }));
  const long = (LONG_NAMES || []).filter(x => !BYNAME.has(x.n.toLowerCase())).map(x => ({ ...x, d: de2000(L, x.lab) }));
  return { mine: mine.sort((a, b) => a.d - b.d).slice(0, n), long: long.sort((a, b) => a.d - b.d).slice(0, n) };
}
// Where a library name comes from, in a few words
const SRC_LABEL = { app: "ColorHub", css: "Web color", wiki: "Common name", xkcd: "xkcd survey", ridgway: "Ridgway, 1912", werner: "Werner, 1821", jp: "Japanese traditional", ral: "RAL paint" };
const srcLine = x => x.jp ? `${x.jp.kanji} · ${x.jp.meaning}` : (x.src || []).filter(s => s !== "app").slice(0, 2).map(s => SRC_LABEL[s] || s).join(" · ");
// ROADMAP §17 job #1: honest everywhere, and the same honest everywhere — these are js/naming.js's own
// VERY_CLOSE_DE/NEAR_DE thresholds (a ΔE of 3.7 used to read "very close" here because this had its own,
// looser scale; now it reads "close", matching what nameOf() itself would call that gap).
const closeness = d => d < VERY_CLOSE_DE ? "very close" : d < NEAR_DE ? "close" : "not close";

// ---------- daily color: the same color for everyone on a given day ----------
function dailyColor(k = today()) {
  let h = 2166136261; for (const ch of k) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  const pool = ALL;
  return pool[(h >>> 0) % pool.length];
}
