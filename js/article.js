"use strict";
// The article reader (lane L8). Every color can have a long-form article at data/articles/<slug>.json (lane L7
// writes them; data/articles/SCHEMA.md is the schema once it lands). This file turns one into a page section:
//
//   articleRender(slug, host, ctx)  -> Promise<boolean>   lazy-loads the file, draws into `host`, and draws
//                                    NOTHING (host emptied and hidden, false returned) when the file is missing.
//                                    js/explore.js colorPage and js/names.js namePage call it from the slot
//                                    <div data-ar-slot> under their hero.
//   arHubPage(id) / arWhichPage(name)   #/hub/<id> collections and #/which/<name> disambiguation pages, read from
//                                    data/graph/hubs.json (lane L6). Tests can point at fixtures with
//                                    window.AR_CFG = { articles: "tools/fixtures/articles/", hubs: "tools/fixtures/hubs.json" }.
//
// Body text is plain paragraphs (blank-line separated) with: [n] note references (numbers that exist in `notes`),
// *italics*, **bold**, and [[slug]] / [[slug|label]] links to other colors (a swatch + the name; one tap opens the
// color). A paragraph can be a callout:
//     "Books disagree: ..."  or  "!books ..."          -> the "Books disagree" callout
//     "Myth: The story says ... The record shows ..."  or  "!myth ..."  or a paragraph that simply starts
//     "The story says ... The record shows ..."         -> the "Myth" callout (story vs record)
// Reference cards (js/article-refs.js draws them): [[gem:<id>]] [[flower:<id>]] [[painting:<id or gallery n>]] [[look:<id>]]
// [[garment:<id>]] [[film:<id>]] [[painter:<slug>]] (and the older [[art:<painting id>|label]]) are small inline chips; a
// paragraph that holds one also gets a figure card (image, name, "94% match to Fiery Rose") when the thing is close enough.
// A section can carry `actions` (["duel","painting","mix","map"]); without it, the actions are inferred from the
// section's id/title and offered only when the thing they open exists:
//     duel     always (an inline round, built here; logs to the Learner Model when it exists)
//     painting galleryPage + npGalleryHits (js/gallery.js, js/names.js): opens the painting that holds this color most
//     mix      a global mixLab(hex, name) (lane L14): link only
//     map      csOnMap(colorSet(...)) (js/colorset.js): "On the map", lit with the color and its family
// The Learner Model (js/learner.js) is feature-detected: knowState(color) lights the family tree (yours, met, unmet),
// confusions(color) feeds the mix-up card, learnerLog(evt) records duel and question answers. Without it the tree
// falls back to the 101's own cards (S.cards, isMine) and the mix-up card simply doesn't appear.
// All top-level names here start with "ar" (one shared global scope).

const AR_WPM = 220;
const AR_TIERS = { pigment: "Pigment or mineral", mineral: "Pigment or mineral", dye: "Pigment or mineral", japanese: "A traditional color", traditional: "A traditional color",
  nature: "Named from nature", place: "A place or institution", institution: "A place or institution", person: "Named for a person", people: "Named for a person",
  standard: "A standard or system", system: "A standard or system", commercial: "A commercial name", descriptive: "" };

// ---------- loading ----------
const arCfg = () => (typeof window !== "undefined" && window.AR_CFG) || {};
const arVer = () => (typeof DATA_VER !== "undefined" && DATA_VER ? "?v=" + DATA_VER : "");
const arFetchJSON = url => fetch(url + arVer()).then(r => r.ok ? r.json() : null).catch(() => null);
const AR_CACHE = new Map();
function arPretty(s) { return String(s || "").replace(/^[a-z]+:/, "").replace(/[-_]+/g, " ").replace(/\b[a-z]/g, m => m.toUpperCase()).trim(); }
// plain paragraphs -> blocks (see the callout markers in the header)
function arBlock(t) {
  let m;
  if ((m = t.match(/^(?:!books\s+|>\s*books disagree\s*[:.]?\s*|books disagree\s*[:.—–-]\s*)([\s\S]+)$/i))) return { t: "books", text: m[1].trim() };
  const mythHead = /^(?:!myth\s+|>\s*myth\s*[:.]?\s*|myth\s*[:.—–-]\s+)([\s\S]+)$/i;
  const natural = /^the story says\b/i.test(t) && /\bthe record (?:shows|says)\b/i.test(t);
  if ((m = t.match(mythHead)) || natural) {
    const body = m ? m[1].trim() : t;
    const parts = body.split(/\bthe record (?:shows|says)\b[:,]?\s*/i);
    const say = parts[0].replace(/^the story says\b[:,]?\s*/i, "").trim();
    return { t: "myth", say, rec: parts.slice(1).join(" ").trim() };
  }
  return { t: "p", text: t };
}
function arBlocks(body) {
  const raw = Array.isArray(body) ? body : String(body == null ? "" : body).split(/\n\s*\n/);
  return raw.map(t => String(t).replace(/\s*\n\s*/g, " ").trim()).filter(Boolean).map(arBlock);
}
const arList = v => v == null || v === "" ? [] : Array.isArray(v) ? v.filter(Boolean) : [v];
// A raw file -> the shape the renderer uses; null when it isn't an article at all.
function arNorm(a, slug) {
  if (!a || typeof a !== "object" || Array.isArray(a)) return null;
  const sections = (Array.isArray(a.sections) ? a.sections : []).filter(s => s && (s.body || s.title)).map((s, i) => ({
    id: String(s.id || "s" + (i + 1)).replace(/[^a-z0-9_-]/gi, "-"), title: String(s.title || ""), blocks: arBlocks(s.body), actions: s.actions, rawBody: s.body }));
  if (!a.lede && !sections.length) return null;
  const notes = new Map();
  (Array.isArray(a.notes) ? a.notes : []).forEach((n, i) => { if (n) notes.set(+n.n || i + 1, { ...n, n: +n.n || i + 1 }); });
  return { slug: a.slug || slug, name: a.name || arPretty(slug), names: arList(a.names), hex: a.hex || null, tier: a.tier || "", lede: String(a.lede || ""), sections,
    aside: a.aside && typeof a.aside === "object" ? a.aside : {}, notes, questions: (Array.isArray(a.questions) ? a.questions : []).filter(q => q && q.q && Array.isArray(q.choices) && q.choices.length > 1),
    words: +a.words || 0, status: a.status || "" };
}
function arLoad(slug) {
  if (!/^[a-z0-9-]+$/.test(String(slug || ""))) return Promise.resolve(null);
  const base = arCfg().articles || "data/articles/";
  if (!AR_CACHE.has(base + slug)) AR_CACHE.set(base + slug, arFetchJSON(base + slug + ".json").then(a => arNorm(a, slug)));
  return AR_CACHE.get(base + slug);
}

// ---------- resolving colors ----------
let AR_IDX = null, AR_IDX_N = -1;
function arIndex() {
  const list = typeof CORE_NAMES !== "undefined" && CORE_NAMES ? CORE_NAMES : [];
  if (AR_IDX && AR_IDX_N === list.length) return AR_IDX;
  AR_IDX = new Map(); AR_IDX_N = list.length;
  list.forEach(e => { const s = routeSlug(e.n); if (!AR_IDX.has(s)) AR_IDX.set(s, e); });
  return AR_IDX;
}
// slug | name | {slug, name, hex, gloss} -> { slug, n, h, gloss? } or null. The 101 first, then the ~1,000 core names.
let AR_GN = null;   // data/graph/names.json rows [slug, name, hex, ...]: every name in the graph, for slugs the ~1,000 core list lacks
// Alias-aware resolving (the data-quality merge renamed and merged many colors). AR_AL maps an alias slug to { to: canonical slug, via: original word }:
// data/graph/aliases.json { alias: {slug: canonical} } and data/aliases.json { slugs: {slug: canonical}, names: {Display name: Canonical name} }.
// AR_LM is data/articles/link-map.json { links: { slug: { to: slug | null, label, reason } } }: explicit overrides, consulted first; to:null = plain text.
let AR_AL = new Map(), AR_LM = new Map();
function arLoadNames() {
  if (AR_GN) return Promise.resolve(AR_GN);
  return Promise.all([arFetchJSON(arCfg().names || "data/graph/names.json"), arFetchJSON(arCfg().gaiases || "data/graph/aliases.json"),
    arFetchJSON(arCfg().aliases || "data/aliases.json"), arFetchJSON((arCfg().articles || "data/articles/") + "link-map.json")]).then(([rows, ga, da, lm]) => {
    const al = new Map();
    if (da && da.names) Object.keys(da.names).forEach(k => { const s = routeSlug(k); if (!al.has(s)) al.set(s, k); });   // slug -> the word as first written
    if (da && da.slugs) Object.keys(da.slugs).forEach(s => al.set(s, { to: da.slugs[s], via: typeof al.get(s) === "string" ? al.get(s) : "" }));
    if (ga && ga.alias) Object.keys(ga.alias).forEach(s => al.set(s, { to: ga.alias[s], via: "" }));
    AR_AL = new Map([...al].filter(([, v]) => typeof v === "object"));
    AR_LM = new Map(Object.entries((lm && lm.links) || {}));
    return (AR_GN = new Map((Array.isArray(rows) ? rows : []).map(r => [r[0], r])));
  });
}
function arDirect(slug) {
  const c = typeof routeColor === "function" ? routeColor(slug) : null;
  if (c) return { slug, n: c.n, h: c.h, c };
  const e = arIndex().get(slug);
  if (e) return { slug, n: e.n, h: e.h };
  const g = AR_GN && AR_GN.get(slug);
  return g ? { slug, n: g[1], h: g[2] } : null;
}
function arColor(ref) {
  if (!ref) return null;
  if (typeof ref === "object") {
    const base = ref.slug ? arColor(ref.slug) : ref.name || ref.n ? arColor(ref.name || ref.n) : null;
    const gloss = ref.gloss || ref.note || ref.why || "";
    if (base) return { ...base, gloss };
    const h = ref.hex || ref.h, n = ref.name || ref.n;
    return h && n ? { slug: ref.slug || routeSlug(n), n, h, gloss } : null;
  }
  const slug = routeSlug(ref);
  const lm = AR_LM.get(slug);
  if (lm) {   // an explicit override: to:null is plain text, otherwise the target color with the original word kept as the label
    if (!lm.to) return null;
    const t = arDirect(lm.to);
    return t ? { ...t, via: lm.label || arPretty(slug) } : null;
  }
  const d = arDirect(slug);
  if (d) return d;
  const a = AR_AL.get(slug);   // an alias: the canonical color, the word as first written kept as the label
  const t = a && arDirect(a.to);
  return t ? { ...t, via: a.via || arPretty(slug) } : null;
}
function arOpenColor(slug, srcEl) {
  const c = arColor(slug); if (!c) return;
  if (srcEl && typeof morphFrom === "function") { try { morphFrom(srcEl); } catch (e) {} }
  openCoreName(c.h, c.n);
}

// ---------- inline text ----------
// hl: a paragraph's highlight budget ({ n }); while it lasts, the link's words take their own color, legibly (arAccent)
function arLinkHTML(slug, label, hl, word) {
  const c = arColor(slug);
  if (!c) { const lm = AR_LM.get(slug); return `<span class="ar-link ar-x">${esc(label || (lm && lm.label) || arPretty(slug))}</span>`; }
  const a = hl && hl.n < AR_HL_MAX ? arAccent(c.h) : null;
  if (a && a.mode !== "none") hl.n++;
  const cls = a && a.mode !== "none" ? ` ${AR_HL_CLS[a.mode]}" style="--hl:${a.c || "transparent"}` : "";
  // word: a color word found in plain text ("then purple"): its color is the mark, so no swatch dot and no underline unless it is pale
  return `<button type="button" class="ar-link${word ? " ar-cw" : ""}${cls}" data-ar-open="${esc(c.slug)}">${word ? "" : `<i style="--c:${c.h}"></i>`}${esc(label || c.via || c.n)}</button>`;
}

// ---------- reading aids (David, 2026-10-08: "a lot of text and hard to read ... some words pink, not light pink") ----------
// Color in the text has to stay legible on the warm-black ground. arAccent(hex) decides how a color may mark words:
//   text  the color itself (WCAG contrast >= 4.5 on the ground, and far enough from the body text to read as a color)
//   tint  too dark for that: the same hue lifted until it passes 4.5 (Navy reads as a periwinkle of its own hue)
//   line  white text with an underline in the color: pale colors (Baby Pink would read as white text) and greys
//   none  a near-black grey: nothing to mark with (the link keeps its swatch dot)
// deco is the color for big decorative marks (drop cap, quote marks, the timeline): the color itself at 3:1, else the tint.
const AR_GROUND = "#0E0D0B", AR_BODY_HEX = "#D9D4C8", AR_HL_MAX = 3, AR_SPLIT_W = 90;
const AR_HL_CLS = { text: "hl-t", tint: "hl-t", line: "hl-l" };
function arLum(h) { return [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((s, v, i) => s + v * [.2126, .7152, .0722][i], 0); }
const arContrast = (a, b) => { const x = arLum(a) + .05, y = arLum(b) + .05; return x > y ? x / y : y / x; };
const AR_ACC = new Map();
function arAccent(hex) {
  hex = String(hex || "").toUpperCase();
  if (!/^#[0-9A-F]{6}$/.test(hex)) return { mode: "none", c: "", deco: "" };
  if (AR_ACC.has(hex)) return AR_ACC.get(hex);
  const k = arContrast(hex, AR_GROUND), far = h => typeof de2000 !== "function" || de2000(h, AR_BODY_HEX) >= 14;
  let r;
  if (typeof lch !== "function" || typeof lchHex !== "function") r = k >= 4.5 ? { mode: "text", c: hex } : k >= 1.6 ? { mode: "line", c: hex } : { mode: "none", c: "" };
  else {
    const [L, C, H] = lch(hex);
    if (C < 12) r = k >= 1.6 ? { mode: "line", c: hex } : { mode: "none", c: "" };
    else if (L >= 78 && C < 35) r = { mode: "line", c: hex };
    else if (k >= 4.5 && far(hex)) r = { mode: "text", c: hex };
    else {
      r = k >= 1.6 ? { mode: "line", c: hex } : { mode: "none", c: "" };
      for (let L2 = Math.max(L, 40); L2 <= 86; L2 += 2) {
        let C2 = C; while (C2 > 8 && typeof inGamut === "function" && !inGamut(L2, C2 * Math.cos(H * Math.PI / 180), C2 * Math.sin(H * Math.PI / 180))) C2 -= 2;
        const t = lchHex(L2, C2, H);
        if (arContrast(t, AR_GROUND) >= 4.6) { if (far(t)) r = { mode: "tint", c: t }; break; }
      }
    }
  }
  r.deco = k >= 3 ? hex : r.mode === "tint" ? r.c : r.c && arContrast(r.c, AR_GROUND) >= 3 ? r.c : "";
  AR_ACC.set(hex, r);
  return r;
}
// The color words worth marking in plain text: the eleven basic terms and violet, and every name of two or more words in the
// ~1,000 core names ("Paris blue", "sky blue"): unambiguous as words. Single-word names (Rose, Orange, Navy) stay plain.
const AR_HLW = new Map();
const AR_BEFORE_WORD = /^(?:a|an|the|of|in|into|to|and|or|nor|as|from|than|then|toward|towards|is|was|were|are|be|been|being|turn|turns|turned|turning|became|become|becomes|went|goes|go|dyed|painted|called|named|with|for|like|its|their|his|her|no|not|but|only|pure|plain|true|bright|any|every|each|between|over|under|on)$/i;
let AR_HLW_RE = null, AR_HLW_N = -1;
function arWordsRe() {
  const list = typeof CORE_NAMES !== "undefined" && Array.isArray(CORE_NAMES) ? CORE_NAMES : [];
  if (AR_HLW_RE && AR_HLW_N === list.length) return AR_HLW_RE;
  AR_HLW.clear(); AR_HLW_N = list.length;
  ["red", "orange", "yellow", "green", "blue", "purple", "pink", "brown", "violet"].forEach(w => AR_HLW.set(w, w));
  list.forEach(e => { const n = String(e.n || ""); if (/^[A-Za-z]+(?:[ -][A-Za-z]+)+$/.test(n) && n.length <= 28) AR_HLW.set(n.toLowerCase(), routeSlug(n)); });
  const alts = [...AR_HLW.keys()].sort((a, b) => b.length - a.length).map(k => k.replace(/[-]/g, "[- ]"));
  AR_HLW_RE = alts.length ? new RegExp("(^|[^\\p{L}\\u0001-])(" + alts.join("|") + ")(?![\\p{L}\\u0002-])", "giu") : null;
  return AR_HLW_RE;
}
// markup -> plain words (for quotes, dates and their captions)
function arPlain(t) {
  return String(t == null ? "" : t).replace(new RegExp(AR_REF_SRC, "gi"), (m, k, id, label) => label || arPretty(id))
    .replace(/\[\[([a-z0-9-]+)(?:\|([^\]]+))?\]\]/gi, (m, s, label) => { if (label) return label; const c = arColor(s.toLowerCase()); return c ? c.via || c.n : arPretty(s); })
    .replace(/\s*\[\d[\d,\s–-]*\]/g, "").replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*]+)\*/g, "$1").replace(/`([^`]+)`/g, "$1").replace(/\s+/g, " ").trim();
}
// sentences, keeping each one's note refs ([n]) with it; never splits after "St." "c." "ch." or an initial ("J. M. W.")
function arSentences(t) {
  const out = [], s = String(t || ""), re = /[.!?][”"’)]*((?:\s*\[\d[\d,\s–-]*\])*)\s+(?=[A-Z“"‘\[])/g;
  let last = 0, m;
  while ((m = re.exec(s))) {
    const before = s.slice(last, m.index), word = (before.match(/(\S+)$/) || ["", ""])[1];
    if (/^(?:St|Mr|Mrs|Dr|Mme|Jr|Sr|c|ca|ch|cf|fig|vol|no|nos|pp?|vs|e\.g|i\.e|[A-Z])$/i.test(word.replace(/^[(“"‘]+/, ""))) continue;
    if ((before.match(/\[\[/g) || []).length !== (before.match(/\]\]/g) || []).length) continue;   // inside a [[link|label]]
    if (((s.slice(0, m.index).match(/[“”]/g) || []).length % 2) || ((s.slice(0, m.index).match(/"/g) || []).length % 2)) continue;   // inside a quotation
    const end = m.index + m[0].length;
    out.push(s.slice(last, end).trim()); last = end;
  }
  if (last < s.length) out.push(s.slice(last).trim());
  return out.filter(Boolean);
}
// a paragraph of more than AR_SPLIT_W words -> 2-3 shorter ones, at sentence ends, as even as the sentences allow
function arSplit(t) {
  const words = x => arPlain(x).split(/\s+/).filter(Boolean).length, total = words(t);
  if (total <= AR_SPLIT_W) return [t];
  const ss = arSentences(t); if (ss.length < 2) return [t];
  const target = total / Math.ceil(total / 62), out = [];
  let cur = [], n = 0;
  ss.forEach(x => { cur.push(x); n += words(x); if (n >= target * .85) { out.push(cur); cur = []; n = 0; } });
  if (cur.length) { if (out.length && n < 22) out[out.length - 1].push(...cur); else out.push(cur); }
  return out.map(c => c.join(" "));
}
// the chapter's short attributed quotation: 4-15 words in quotation marks, with who said it in the same sentence
const AR_SAID = "called|wrote|said|described|declared|complained|remarked|praised|warned|recalled|observed|insisted|dubbed|named|proclaimed|announced|boasted|lamented";
function arQuoteOf(text) {
  for (const sent of arSentences(text)) {
    const q = sent.match(/[“"]([^”"]{8,140})[”"]/); if (!q) continue;
    const words = arPlain(q[1]).split(/\s+/).filter(Boolean);
    if (words.length < 4 || words.length > 15 || /^\[\[|^[a-z-]+$/.test(q[1].trim())) continue;
    const pre = sent.slice(0, q.index), post = sent.slice(q.index + q[0].length), NAME = "((?:[A-Z][\\p{L}'’.-]+)(?:\\s+(?:de|van|von|da|di|la|le|du)?\\s*[A-Z][\\p{L}'’.-]+){0,3})";
    let who = null, m;
    const reB = new RegExp(NAME + "\\s+(?:" + AR_SAID + ")\\b", "gu");
    while ((m = reB.exec(pre))) who = m[1];
    if (!who && (m = new RegExp("^[,]?\\s+(?:" + AR_SAID + ")\\s+" + NAME, "u").exec(post))) who = m[1];
    who = who && arPlain(who).replace(/^(?:The|A|An|In|His|Her|Its|Their|When|Then|But|And)\s+/, "");
    if (!who || /^(?:It|This|That|He|She|They|We|One|Some|Others|Many|The)$/.test(who)) continue;
    return { q: arPlain(q[1]).replace(/^[,.;:\s]+|[,;:\s]+$/g, ""), who };
  }
  return null;
}
// the chapter's dates, in its own words: [{ y, label, snip, p }] (2-4 of them, in time order; p = the text it came from), or []
// One date per sentence (a sentence with two years is a range or a doubt, "1704 or 1705", and is skipped unless its first is new).
const AR_YEAR = /\b(1[0-9]{3}|20[0-2][0-9])(s)?\b(?![,.]\d)(?!\s*(?:%|per\b|kg|tons?|tonnes?|pounds?|lbs?|km|kilo\w*|miles?|met(?:re|er)s?|feet|ft\b|insects|people|names|colou?rs|paintings|times|words|species|grams?|years))/g;
const AR_JOIN = /^(?:which|who|whose|whom|where|when|while|and|but|or|though|although|as|until|so|because|after|before)\b/i;
function arDatesOf(texts) {
  const seen = new Map();
  texts.forEach((t, p) => arSentences(t).forEach(sent => {
    const plain = arPlain(sent), ys = [...plain.matchAll(AR_YEAR)].filter(m => !/[£$€,.]\s*$/.test(plain.slice(0, m.index)));
    if (!ys.length) return;
    const m = ys[0], y = m[0];
    if (seen.has(y) || (ys.length > 1 && [...seen.keys()].some(k => ys.some(x => x[0] === k)))) return;
    const clauses = plain.split(/(?<=[,;:—–])\s+/);
    let i = 0, pos = 0; for (; i < clauses.length - 1; i++) { if (m.index < pos + clauses[i].length + 1) break; pos += clauses[i].length + 1; }
    let snip = clauses[i];
    if (AR_JOIN.test(snip) && i > 0) snip = clauses[i - 1] + " " + snip;
    if (snip.split(/\s+/).length <= 4 && clauses[i + 1]) snip += " " + clauses[i + 1];
    snip = snip.replace(new RegExp("^(?:In|By|From|Until|Around|After|Before|Since|About|Circa|c\\.)\\s+(?:the\\s+)?(?:early\\s+|late\\s+|mid-)?" + y + "(?:\\s*(?:or|and|to|–|-)\\s*\\d{2,4}s?)?\\s*,?\\s*", "i"), "").replace(/[,;:—–]\s*$/, "").replace(/\.$/, "");
    const w = snip.split(/\s+/), at = w.findIndex(x => x.includes(y));
    if (w.length > 13) snip = at >= 0 && at > 10 ? "…" + w.slice(-12).join(" ") : w.slice(0, 12).join(" ").replace(/[,;:]$/, "") + "…";
    snip = snip.replace(/^[a-z]/, c => c.toUpperCase());
    if (snip.replace(/…/g, "").split(/\s+/).length >= 3) seen.set(y, { y: +m[1] + (m[2] ? 5 : 0), label: y, snip, p });
  }));
  let list = [...seen.values()].sort((a, b) => a.y - b.y);
  if (list.length < 2) return [];
  if (list.length > 4) list = [0, 1, 2, 3].map(k => list[Math.round(k * (list.length - 1) / 3)]);
  return list;
}
function arDatesHTML(list) {
  const lo = list[0].y, hi = list[list.length - 1].y, span = Math.max(1, hi - lo);
  return `<figure class="ar-tl" aria-label="Key dates"><figcaption class="ar-tl-h">Key dates</figcaption>
    <div class="ar-tl-axis" aria-hidden="true"><i class="ar-tl-line"></i>${list.map(d => `<i class="ar-tl-dot" style="left:${(4 + 92 * (d.y - lo) / span).toFixed(1)}%"></i>`).join("")}<span class="ar-tl-lo">${esc(list[0].label)}</span><span class="ar-tl-hi">${esc(list[list.length - 1].label)}</span></div>
    <ol>${list.map(d => `<li><b>${esc(d.label)}</b><span>${esc(d.snip)}</span></li>`).join("")}</ol></figure>`;
}
function arQuoteHTML(q) { return `<figure class="ar-pq"><blockquote><p>${esc(q.q)}</p></blockquote><figcaption>${esc(q.who)}</figcaption></figure>`; }
// the colors a paragraph names, side by side with the page's own: big plates, one tap opens each
function arPlateHTML(self, cols) {
  const tile = (c, me) => `<${me ? "span" : "button type=\"button\""} class="ar-pl${me ? " me" : ""}"${me ? ` aria-current="true"` : ` data-ar-open="${esc(c.slug)}"`}><i style="--c:${c.h}"></i><b>${esc(c.via || c.n)}</b></${me ? "span" : "button"}>`;
  return `<div class="ar-plate2" role="group" aria-label="${esc([self, ...cols].map(c => c.via || c.n).join(", "))}, side by side">${tile(self, true)}${cols.map(c => tile(c, false)).join("")}</div>`;
}
function arRefsHTML(body, art) {
  const ids = [];
  body.split(/\s*,\s*/).forEach(p => { const r = p.match(/^(\d+)\s*[–-]\s*(\d+)$/); if (r) { for (let k = +r[1]; k <= +r[2] && k - +r[1] < 12; k++) ids.push(k); } else ids.push(+p); });
  if (!art || !ids.every(k => art.notes.has(k))) return null;
  return `<sup class="ar-fnw">${ids.map(k => `<button type="button" class="ar-fn" data-fn="${k}" aria-label="Note ${k}">${k}</button>`).join("")}</sup>`;
}
// ---------- reference chips: [[gem:spinel]], [[painting:nga-72328|Roses]] ... (the figure cards are js/article-refs.js) ----------
const AR_REF_KINDS = { gem: "Gem", flower: "Flower", painting: "Painting", look: "Look", garment: "Garment", film: "Film", painter: "Painter" };
const AR_REF_SRC = "\\[\\[(gem|flower|painting|art|look|garment|film|painter):([A-Za-z0-9._-]+)(?:\\|([^\\]]+))?\\]\\]";
const AR_REF_ICON = { gem: "gem", flower: "flower", painting: "painting", look: "look", garment: "garment", film: "film", painter: "painter" };   // js/core.js ICON_PATHS
const arRefKind = k => { k = String(k || "").toLowerCase(); return k === "art" ? "painting" : k; };
const arRefIcon = k => AR_REF_ICON[k] ? icon(AR_REF_ICON[k], 13) : "";
// a chip's text before its data lands: the writer's label, else a plain guess (the real name replaces a guess once the data is in)
const arRefGuess = (k, id) => k === "painting" ? "A painting" : k === "painter" ? arPretty(id) : arPretty(id);
function arRefChipHTML(kind, id, label) {
  const k = arRefKind(kind), key = k + ":" + id;
  return `<button type="button" class="ar-ref" data-kind="${k}" data-ar-ref="${esc(key)}"${label ? "" : " data-ar-guess"}>${arRefIcon(k)}<span>${esc(label || arRefGuess(k, id))}</span></button>`;
}
// every reference a text mentions, as [{ kind, id, label? }] in order, de-duplicated by kind:id
function arRefList(text) {
  const out = [], seen = new Set();
  String(text == null ? "" : text).replace(new RegExp(AR_REF_SRC, "gi"), (m, kind, id, label) => { const k = arRefKind(kind), key = k + ":" + id; if (!seen.has(key)) { seen.add(key); out.push({ kind: k, id, key, label: label || "" }); } return m; });
  return out;
}
// hl (optional): { n, self } a paragraph's highlight budget; self = { name, a, done } marks the page's own color name once a chapter
function arInline(text, art, hl) {
  const stash = [];
  let s = String(text == null ? "" : text);
  s = s.replace(new RegExp(AR_REF_SRC, "gi"), (m, kind, id, label) => { stash.push(arRefChipHTML(kind, id, label)); return "\u0001" + (stash.length - 1) + "\u0002"; });
  s = s.replace(/\[\[([a-z0-9-]+)(?:\|([^\]]+))?\]\]/gi, (m, slug, label) => { stash.push(arLinkHTML(slug.toLowerCase(), label, hl)); return "\u0001" + (stash.length - 1) + "\u0002"; });
  s = esc(s);
  const me = hl && hl.self;
  if (me && !me.done && me.name && me.a.mode !== "none" && hl.n < AR_HL_MAX) {
    const re = new RegExp("(^|[^\\p{L}])(" + me.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")(?![\\p{L}])", "iu");
    s = s.replace(re, (m, pre, w) => { me.done = true; hl.n++; stash.push(`<span class="ar-hl ${AR_HL_CLS[me.a.mode]}" style="--hl:${me.a.c}">${w}</span>`); return pre + "\u0001" + (stash.length - 1) + "\u0002"; });
  }
  // color words written as plain text ("then purple, then a deep blue", "Paris blue"): one-tap links in their own color, each once a chapter
  if (me && me.words && hl.n < AR_HL_MAX) {
    s = s.replace(me.words, (m, pre, w, at, all) => {
      const key = w.toLowerCase(), slug = AR_HLW.get(key);
      if (hl.n >= AR_HL_MAX || !slug || me.used.has(slug)) return m;
      // "Naples yellow", "Isabella yellow": a basic word after a proper name is part of another color's name, so it stays plain
      // and a lone basic word counts only where it stands as the color itself ("in blue", "then purple", "turns it red"), never as part
      // of a compound ("navy blue", "cadmium yellow") or a proper name ("the Blue Period")
      if (!/\s/.test(w)) {
        const before = all.slice(Math.max(0, at - 40), at + pre.length), prev = (before.match(/([\p{L}'’]+)[\s(“"‘]*$/u) || [])[1] || "";
        if (/^[A-Z]/.test(w) && !/(?:^|[.!?:]\s*)$/.test(before.trim() ? before : "")) return m;
        if (prev && !AR_BEFORE_WORD.test(prev) && !/[,;:(—–]\s*$/.test(before)) return m;
        if (/^(?:-|\s+(?:red|orange|yellow|green|blue|purple|pink|brown|violet|grey|gray|black|white|ochre|lake|earth|oxide)\b)/i.test(all.slice(at + m.length, at + m.length + 12))) return m;   // "red brown", "blue-green"
      }
      const c = arColor(slug), a = c && arAccent(c.h);
      if (!a || !(a.mode === "text" || a.mode === "tint" || (a.mode === "line" && typeof lch === "function" && lch(c.h)[1] >= 12))) return m;
      me.used.add(slug);
      stash.push(arLinkHTML(slug, w, hl, true));
      return pre + "\u0001" + (stash.length - 1) + "\u0002";
    });
  }
  s = s.replace(/\[(\d+(?:\s*(?:,|–|-)\s*\d+)*)\]/g, (m, body) => { const h = arRefsHTML(body, art); if (!h) return m; stash.push(h); return "\u0001" + (stash.length - 1) + "\u0002"; });
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/\*([^*\s](?:[^*]*[^*\s])?)\*/g, "<em>$1</em>");
  // a link or chip never leaves its comma or full stop alone at the start of the next line
  return s.replace(/\u0001(\d+)\u0002([,.;:!?)’”]+)/g, (m, i, p) => `<span class="ar-nw">\u0001${i}\u0002${p}</span>`).replace(/\u0001(\d+)\u0002/g, (m, i) => stash[+i]);
}
// every [[slug]] and [n] an article mentions, for the tests and the gate
function arRefs(art) {
  const texts = [art.lede, art.aside.origin && Object.values(art.aside.origin).join(" ")].filter(Boolean);
  art.sections.forEach(s => s.blocks.forEach(b => texts.push(b.text || [b.say, b.rec].join(" "))));
  const links = new Set(), fns = new Set(), refs = new Map();
  texts.forEach(t => {
    arRefList(t).forEach(r => { if (!refs.has(r.key)) refs.set(r.key, r); });
    String(t).replace(/\[\[([a-z0-9-]+)(?:\|[^\]]+)?\]\]/gi, (m, s) => links.add(s.toLowerCase()));
    String(t).replace(/\[\[[^\]]*\]\]/g, "").replace(/\[(\d+(?:\s*(?:,|–|-)\s*\d+)*)\]/g, (m, b) => { b.split(/\s*,\s*/).forEach(p => { const r = p.match(/^(\d+)\s*[–-]\s*(\d+)$/); if (r) for (let k = +r[1]; k <= +r[2]; k++) fns.add(k); else fns.add(+p); }); return m; });
  });
  return { links: [...links], fns: [...fns].sort((a, b) => a - b), refs: [...refs.values()] };
}
function arWords(art) {
  const t = [art.lede]; art.sections.forEach(s => s.blocks.forEach(b => t.push(b.text || [b.say, b.rec].join(" "))));
  return t.join(" ").replace(/\[\[(?:[^\]|]+\|)?([^\]]+)\]\]/g, "$1").replace(/\[\d[\d,\s–-]*\]/g, "").split(/\s+/).filter(Boolean).length;
}
const arMinutes = art => Math.max(1, Math.round((art.words || arWords(art)) / AR_WPM));

// ---------- knowing a color (family tree, hexes) ----------
// "yours" | "met" | "unmet". The Learner Model's readers when they exist, else the 101's own cards.
function arKnow(c) {
  if (!c) return "unmet";
  if (typeof knowState === "function") {
    try { const k = knowState({ n: c.n, h: c.h }); return k === "yours" ? "yours" : k === "met" || k === "learning" ? "met" : "unmet"; } catch (e) {}
  }
  const t = typeof BYNAME !== "undefined" ? BYNAME.get(String(c.n).toLowerCase()) : null;
  if (!t) return "unmet";
  if (t.basic) return typeof S !== "undefined" && S.placed ? "yours" : "unmet";
  const st = typeof S !== "undefined" && S.cards && S.cards[t.id];
  return st ? (typeof isMine === "function" && isMine(st) ? "yours" : "met") : "unmet";
}
const AR_KNOW_WORD = { yours: "yours", met: "met", unmet: "not met yet" };
// one write call into the Learner Model (js/learner.js learnerLog), never throws
function arLog(evt) { try { if (typeof learnerLog === "function") learnerLog({ src: "page", ...evt }); } catch (e) {} }
const arLogAnswer = (color, ok, other) => { arLog({ type: "answer", color: { n: color.n, h: color.h }, ok, by: "pick" }); if (!ok && other) arLog({ type: "confuse", color: { n: color.n, h: color.h }, b: { n: other.n, h: other.h } }); };

// ---------- the family tree: a small honeycomb ----------
function arHexHTML(c, o = {}) {
  const know = o.self ? "self" : arKnow(c);
  return `<button type="button" class="ar-hex${o.self ? " self" : ""}" style="--c:${c.h}" data-ink="${ink(c.h)}" data-know="${know}"${o.self ? ` aria-current="true"` : ` data-ar-open="${esc(c.slug)}"`} aria-label="${esc(c.n)}${o.self ? ", this color" : ", " + AR_KNOW_WORD[know]}"><span><b>${esc(c.n)}</b></span></button>`;
}
function arTreeHTML(self, aside) {
  const P = arList(aside.parent).map(arColor).filter(Boolean).slice(0, 4);
  const Sb = arList(aside.siblings).map(arColor).filter(c => c && c.slug !== self.slug).slice(0, 5);
  const Ch = arList(aside.children).map(arColor).filter(Boolean).slice(0, 4);
  if (!P.length && !Sb.length && !Ch.length) return "";
  const mid = Math.ceil(Sb.length / 2), midRow = [...Sb.slice(0, mid), "self", ...Sb.slice(mid)];
  const shift = (n, dir) => (n % 2) === (midRow.length % 2) ? " shift-" + dir : "";   // neighbouring honeycomb rows sit half a hex apart
  const row = (items, cls) => items.length ? `<div class="ar-trow${cls || ""}">${items.map(c => c === "self" ? arHexHTML(self, { self: true }) : arHexHTML(c)).join("")}</div>` : "";
  const say = [P.length && "above, where it comes from", Sb.length && "beside, the same color under other names", Ch.length && "below, its variations"].filter(Boolean);
  return `<div class="ar-tree" role="group" aria-label="Family tree">${row(P, shift(P.length, "l"))}${row(midRow)}${row(Ch, shift(Ch.length, "r"))}</div>
    <p class="ar-tnote">${esc(say.join("; ").replace(/^./, m => m.toUpperCase()))}. Filled means yours, outlined means you have met it, dim means not yet.</p>`;
}

// ---------- the pieces of a page ----------
function arFactsHTML(art) {
  const o = art.aside.origin || {}, rows = [["Named after", o.named_after], ["First recorded", o.first_recorded], ["Source", o.source]].filter(r => r[1]);
  const aka = arList(art.aside.aka);
  return (rows.length ? `<dl class="ar-facts">${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${arInline(v, art)}</dd></div>`).join("")}</dl>` : "")
    + (aka.length ? `<p class="ar-aka">Also called ${aka.map(esc).join(", ")}.</p>` : "");
}
const arCap = t => String(t || "").replace(/^\s*[a-z]/, m => m.toUpperCase());
// o (optional, inside a chapter): { hl, cls } the paragraph's highlight budget and an extra class (the drop cap)
function arBlockHTML(b, art, o) {
  if (b.t === "html") return b.html;   // a story built from the wiki's own facets (arFacetArt below): already linked HTML
  if (b.t === "books") return `<aside class="ar-call ar-books"><p class="ar-tag">Books disagree</p><p>${arInline(b.text, art)}</p></aside>`;
  if (b.t === "myth") return `<aside class="ar-call ar-myth"><p class="ar-tag">Myth</p><p class="ar-say"><em>The story says</em> ${arInline(arCap(b.say), art)}</p>${b.rec ? `<p class="ar-rec"><em>The record shows</em> ${arInline(arCap(b.rec), art)}</p>` : ""}</aside>`;
  const refs = arRefList(b.text);
  return `<p${o && o.cls ? ` class="${o.cls}"` : ""}${refs.length ? ` data-ar-refs="${esc(refs.map(r => r.key).join(" "))}"` : ""}>${arInline(b.text, art, o && o.hl)}</p>`;
}
const AR_INFER = [["duel", /look.?alike|confus|mistak|mix(?:ed)? up|apart|differ|neighbou?r|versus|\bvs\b/i], ["painting", /paint|artist|canvas|masters?\b|museum|studio/i],
  ["mix", /\bmix|recipe|blend|how (?:it|they) (?:is|are|was|were) made/i], ["map", /\bmap\b|trade route|geograph|where (?:it|they) (?:come|came|grew|grow)/i]];
const AR_ACT_LABEL = { duel: "Duel the look-alike", painting: "See it in this painting", mix: "Mix it", map: "On the map" };
function arActionAvailable(k) {
  return k === "duel" ? true : k === "painting" ? typeof galleryPage === "function" && typeof npGalleryHits === "function" && typeof loadGallery === "function"
    : k === "mix" ? typeof mixLab === "function" : k === "map" ? typeof csOnMap === "function" && typeof colorSet === "function" : false;
}
function arActionsFor(sec) {
  let kinds = Array.isArray(sec.actions) ? sec.actions.map(a => typeof a === "string" ? a : a && a.kind).filter(Boolean)
    : AR_INFER.filter(([, re]) => re.test(sec.id + " " + sec.title)).map(([k]) => k);
  kinds = [...new Set(kinds)].filter(k => AR_ACT_LABEL[k] && arActionAvailable(k));
  return kinds;
}
// A chapter, made easier to read: long paragraphs split at sentence ends, a drop cap, the page's own color name marked once,
// and between the paragraphs (never two in one gap, spread out): a plate of the colors a paragraph names, the chapter's
// short attributed quotation, and its key dates. js/article-refs.js later fills the remaining long runs with pictures.
function arSectionHTML(sec, art, self, ch) {
  const acts = arActionsFor(sec);
  const items = [];
  sec.blocks.forEach(b => { if (b.t === "p") arSplit(b.text).forEach(t => items.push({ t: "p", text: t })); else items.push(b); });
  const ps = items.map((b, i) => b.t === "p" ? i : -1).filter(i => i >= 0);
  const after = new Map(), busy = new Set(ps.filter(i => arRefList(items[i].text).length));   // a paragraph with a reference gets its own figure card
  const free = (i, near) => !after.has(i) && !busy.has(i) && (!near || ![...after.keys()].some(k => Math.abs(k - i) < 2));
  const place = (from, html) => {
    const order = ps.filter(i => i >= from);
    const at = order.find(i => free(i, true)) ?? order.find(i => free(i)) ?? null;
    if (at != null) after.set(at, html);
  };
  if (self && ps.length && sec.id !== "field") {
    const others = i => [...new Set((items[i].text.match(/\[\[([a-z0-9-]+)(?:\|[^\]]+)?\]\]/gi) || []).map(m => m.slice(2, -2).split("|")[0].toLowerCase()))].map(arColor).filter(c => c && c.h && c.slug !== self.slug && String(c.h).toUpperCase() !== String(self.h).toUpperCase());
    const pi = ps.find(i => others(i).length >= 2) ?? (ps.length >= 3 ? ps.find(i => others(i).length) : undefined);
    if (pi != null) place(pi, arPlateHTML(self, others(pi).filter((c, k, a) => a.findIndex(x => x.h === c.h) === k).slice(0, 3)));
    const qi = ps.find(i => arQuoteOf(items[i].text));
    if (qi != null) place(qi, arQuoteHTML(arQuoteOf(items[qi].text)));
    const dates = arDatesOf(ps.map(i => items[i].text));
    if (dates.length) place(ps[Math.max(...dates.map(d => d.p))], arDatesHTML(dates));   // after the text that tells them
  }
  const me = self ? { name: art.name || self.n, a: arAccent(self.h), done: false, used: new Set([self.slug]), words: arWordsRe() } : null;
  const first = ps[0], cap = first != null && /^[A-Z][A-Za-z]*[\s,]/.test(items[first].text) && arPlain(items[first].text).split(/\s+/).length >= 30 ? first : -1;   // a drop cap on a full first paragraph
  const body = items.map((b, i) => (b.t === "p" ? arBlockHTML(b, art, { hl: { n: 0, self: me }, cls: i === cap ? "ar-dc" : "" }) : arBlockHTML(b, art)) + (after.get(i) || "")).join("");
  const kick = ch && ch.n > 1 && sec.title ? `<p class="ar-chk">Chapter ${ch.i} of ${ch.n}</p>` : "";
  return `<section class="ar-sec" id="ar-s-${esc(sec.id)}" data-ar-sec="${esc(sec.id)}">${kick}${sec.title ? `<h2>${esc(sec.title)}</h2>` : ""}${body}`
    + (acts.length ? `<div class="ar-acts">${acts.map(k => `<button type="button" class="ar-act" data-ar-act="${k}" data-ar-sec="${esc(sec.id)}">${AR_ACT_LABEL[k]}<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>`).join("")}</div><div class="ar-slotpanel" data-ar-panel="${esc(sec.id)}" hidden></div>` : "")
    + `</section>`;
}
function arDisambHTML(self, aside) {
  const list = arList(aside.disambiguation).map(arColor).filter(Boolean).filter(c => c.slug !== self.slug);
  if (!list.length) return "";
  return `<h3 class="ar-h3">Not to be confused with</h3><div class="ar-rows">${list.map(c => `<button type="button" class="ar-row" data-ar-open="${esc(c.slug)}"><i style="--c:${c.h}"></i><b>${esc(c.n)}</b>${c.gloss ? `<span>${esc(c.gloss)}</span>` : ""}</button>`).join("")}</div>
    <p class="ar-more"><a href="#/which/${esc(self.slug)}" data-ar-which="${esc(self.slug)}">All the meanings of ${esc(self.n)}</a></p>`;
}
// "You and this color": the Learner Model's confusion pair for this color, with an inline duel.
function arPairFor(self) {
  if (typeof confusions !== "function") return null;
  let ps; try { ps = confusions({ n: self.n, h: self.h }, 3); } catch (e) { return null; }
  if (!Array.isArray(ps)) return null;
  for (const p of ps) {
    const o = arColor(p.b) || (p.hb ? { slug: routeSlug(p.b || ""), n: p.b, h: p.hb } : null);
    if (o && o.slug !== self.slug) return { o, n: p.n || 1 };
  }
  return null;
}
function arYouHTML(self) {
  const pr = arPairFor(self); if (!pr) return "";
  const diff = typeof lookDiff === "function" ? lookDiff(self, pr.o) : "";
  return `<section class="ar-you" data-ar-you="${esc(pr.o.slug)}"><p class="ar-you-line">You mix this up with ${arLinkHTML(pr.o.slug)}${pr.n > 1 ? `, ${pr.n} times` : ""}.${diff ? ` ${esc(pr.o.n)} is ${esc(diff)} than ${esc(self.n.toLowerCase())}.` : ""}</p>
    <button type="button" class="ar-act" data-ar-act="duel3">Settle it, 3 rounds<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>
    <div class="ar-slotpanel" data-ar-panel="you" hidden></div></section>`;
}
function arQuestionsHTML(art) {
  if (!art.questions.length) return "";
  return `<section class="ar-qs" id="ar-s-questions"><h2>Check yourself</h2>${art.questions.map((q, i) => `<div class="ar-q" data-qi="${i}"><p class="ar-qt">${arInline(q.q, null)}</p>
    <div class="ar-qc">${q.choices.map((c, j) => `<button type="button" class="ar-choice" data-ar-ch="${j}">${esc(typeof c === "string" ? c : c.text || c.label || "")}</button>`).join("")}</div><p class="ar-qf" aria-live="polite"></p></div>`).join("")}<p class="ar-qscore" aria-live="polite"></p></section>`;
}
const AR_KIND = { book: "Book", paper: "Paper", article: "Article", web: "Web page", archive: "Archive", standard: "Standard", dictionary: "Dictionary", museum: "Museum", data: "Our own data", computed: "Our own data" };
function arNotesHTML(art) {
  if (!art.notes.size) return "";
  return `<section class="ar-notes" id="ar-s-notes"><h2>Notes</h2><ol>${[...art.notes.values()].sort((a, b) => a.n - b.n).map(n => `<li id="ar-note-${n.n}"><span class="ar-nn">${n.n}</span><span class="ar-nc">${esc(n.cite || "")}${n.kind ? ` <em>${esc(AR_KIND[String(n.kind).toLowerCase()] || n.kind)}</em>` : ""}${/^https?:\/\//.test(n.url || "") ? ` <a href="${esc(n.url)}" target="_blank" rel="noopener">Open ↗</a>` : ""}</span></li>`).join("")}</ol></section>`;
}
// The whole article as one string (pure: the node test builds it too).
function arBuildHTML(art, self) {
  const tier = AR_TIERS[String(art.tier).toLowerCase()] != null ? AR_TIERS[String(art.tier).toLowerCase()] : arPretty(art.tier);
  const toc = art.sections.filter(s => s.title);
  const acc = self && self.h ? arAccent(self.h) : null, accStyle = acc && acc.deco ? ` style="--ar-acc:${acc.deco}"` : "";
  return `<article class="ar${acc && acc.deco ? " ar-has-acc" : ""}" data-ar="${esc(art.slug)}"${accStyle}>
    <p class="ar-kind">${[tier, arMinutes(art) + " min read"].filter(Boolean).map(esc).join(" · ")}</p>
    ${art.lede ? `<p class="ar-lede">${arInline(art.lede, art)}</p>` : ""}
    ${arFactsHTML(art)}
    ${art.status === "draft" ? `<p class="ar-draft">A draft: not yet fact-checked.</p>` : ""}
    ${toc.length > 1 ? `<button type="button" class="ar-bar" data-ar-bar aria-label="Contents"><span class="ar-bar-l">Contents</span><span class="ar-bar-c" data-ar-cur></span><span class="ar-bar-n mono" data-ar-pos></span><i class="ar-bar-p" data-ar-prog></i></button>` : ""}
    ${art.sections.map(s => arSectionHTML(s, art, self, s.title ? { i: toc.indexOf(s) + 1, n: toc.length } : null)).join("")}
    ${(() => { const tree = arTreeHTML(self, art.aside), dis = arDisambHTML(self, art.aside);
      return tree || dis ? `<section class="ar-fam" id="ar-s-family"><h2>Family</h2>${tree}${dis}</section>` : ""; })()}
    ${arYouHTML(self)}
    ${arQuestionsHTML(art)}
    ${arNotesHTML(art)}
  </article>`;
}

// ---------- the inline duel (a tiny two-swatch round; real Train games take over when they exist) ----------
function arDuel(host, A, B, rounds) {
  let r = 0, right = 0, locked = false, ask, flip;
  const diffLine = () => typeof lookDiff === "function" ? `${B.n} is ${lookDiff(A, B)} than ${A.n.toLowerCase()}.` : "";
  const round = () => {
    locked = false; flip = Math.random() < .5; ask = rounds === 1 ? (Math.random() < .5 ? A : B) : r % 2 === 0 ? A : B;
    const sides = flip ? [B, A] : [A, B];
    host.innerHTML = `<div class="ar-duel"><p class="ar-dq">Which one is <b>${esc(ask.n)}</b>?</p>
      <div class="ar-dt">${sides.map((c, i) => `<div class="ar-dtile"><button type="button" style="--c:${c.h}" data-ar-d="${i}" aria-label="Color ${i + 1}"></button><span class="ar-dn" aria-hidden="true">&nbsp;</span></div>`).join("")}</div>
      <p class="ar-df" aria-live="polite"></p><div class="ar-dfoot"><span class="ar-dcount mono">${r + 1} / ${rounds}</span></div></div>`;
    host.querySelectorAll("[data-ar-d]").forEach(b => b.onclick = () => {
      if (locked) return; locked = true;
      const pick = sides[+b.dataset.arD], ok = pick === ask; if (ok) right++;
      host.querySelectorAll("[data-ar-d]").forEach((x, i) => { const own = sides[i] === ask; x.classList.toggle("ok", own); x.classList.toggle("no", !own && x === b); x.disabled = true; x.parentNode.querySelector(".ar-dn").textContent = sides[i].n; });
      arLogAnswer(ask, ok, ask === A ? B : A);
      host.querySelector(".ar-df").textContent = (ok ? "Yes. " : "Not that one. ") + diffLine();
      const foot = host.querySelector(".ar-dfoot");
      r++;
      foot.insertAdjacentHTML("beforeend", r < rounds ? `<button type="button" class="ar-dnext" data-ar-dnext>Next</button>`
        : `<button type="button" class="ar-dnext" data-ar-dagain>${rounds > 1 ? `${right} of ${rounds}. ` : ""}Again</button>${typeof go === "function" ? `<button type="button" class="ar-dlink" data-ar-dtrain>More in Train</button>` : ""}`);
      const nx = foot.querySelector("[data-ar-dnext]"); if (nx) nx.onclick = round;
      const ag = foot.querySelector("[data-ar-dagain]"); if (ag) ag.onclick = () => { r = 0; right = 0; round(); };
      const tr = foot.querySelector("[data-ar-dtrain]"); if (tr) tr.onclick = () => go("gym");
    });
  };
  round();
}
// who a section's duel is against: a color the section links, else a sibling, else the nearest look-alike
function arRival(sec, art, self) {
  const found = arRefs({ lede: "", aside: {}, sections: [{ blocks: sec.blocks }] }).links.map(arColor).find(c => c && c.slug !== self.slug);
  if (found) return found;
  const sib = arList(art.aside.siblings).concat(arList(art.aside.disambiguation)).map(arColor).find(c => c && c.slug !== self.slug);
  if (sib) return sib;
  if (typeof lookalikes === "function") { const o = lookalikes(self, 1)[0]; if (o) return { slug: routeSlug(o.x.n), n: o.x.n, h: o.x.h }; }
  return null;
}

// ---------- wiring ----------
function arNoteSheet(art, n) {
  const note = art.notes.get(n); if (!note) return;
  const { sh } = sheet(`<div class="ar-ns"><p class="ar-ns-k"><span class="mono">${n}</span>${note.kind ? ` · ${esc(AR_KIND[String(note.kind).toLowerCase()] || note.kind)}` : ""}</p>
    <p class="ar-ns-c">${esc(note.cite || "No citation recorded.")}</p>
    ${/^https?:\/\//.test(note.url || "") ? `<a class="ar-ns-a" href="${esc(note.url)}" target="_blank" rel="noopener">Open the source ↗</a>` : ""}</div>`);
  sh.classList.add("ar-nsheet");
}
const arHeaded = root => [...root.querySelectorAll(".ar-sec[data-ar-sec], .ar-fam, .ar-qs, .ar-notes")].filter(s => s.querySelector("h2"));
function arTocSheet(root, art) {
  const rows = arHeaded(root).map((s, i) => [s.id, s.querySelector("h2").textContent, i + 1]);
  const { sh, close } = sheet(`<div class="ar-toc"><p class="ar-toc-h">${esc(art.name)}</p>${rows.map(([id, t, n]) => `<button type="button" class="ar-toc-row" data-ar-go="${esc(id)}"><span class="mono">${n}</span><b>${esc(t)}</b></button>`).join("")}</div>`);
  sh.classList.add("ar-tocsheet");
  sh.querySelectorAll("[data-ar-go]").forEach(b => b.onclick = () => { close(); const el = document.getElementById(b.dataset.arGo); if (el) arScrollTo(el); });
}
// The page scrolls on <body> (html and body are both height:100% with overflow-x:hidden), not on the window.
function arScroller() {
  const b = document.body;
  return b.scrollHeight > b.clientHeight + 4 && getComputedStyle(b).overflowY !== "visible" ? b : document.scrollingElement || b;
}
function arScrollTo(el) {
  const sc = arScroller(), y = el.getBoundingClientRect().top - (sc === document.body ? 0 : sc.getBoundingClientRect().top) + sc.scrollTop - 64;
  setTimeout(() => sc.scrollTo({ top: Math.max(0, y), behavior: typeof reduceMotion !== "undefined" && reduceMotion ? "auto" : "smooth" }), 20);
}
function arWire(root, art, self) {
  const secsEl = arHeaded(root);
  const bar = root.querySelector("[data-ar-bar]");
  if (bar) {
    const cur = bar.querySelector("[data-ar-cur]"), pos = bar.querySelector("[data-ar-pos]"), prog = bar.querySelector("[data-ar-prog]");
    let raf = 0, readLogged = false;
    const tick = () => {
      raf = 0;
      const r = root.getBoundingClientRect(), total = Math.max(1, r.height - innerHeight * .6), done = Math.min(1, Math.max(0, -r.top / total));
      let idx = -1; secsEl.forEach((s, i) => { if (s.getBoundingClientRect().top <= 90) idx = i; });
      // the line under the bar is how far through this chapter you are (the whole story's progress is the n/N beside it)
      const sr = idx >= 0 ? secsEl[idx].getBoundingClientRect() : null, inCh = sr ? Math.min(1, Math.max(0, (90 - sr.top) / Math.max(1, sr.height - innerHeight * .5))) : 0;
      prog.style.transform = `scaleX(${inCh.toFixed(3)})`;
      const started = bar.getBoundingClientRect().top <= 2;
      cur.textContent = idx >= 0 && started ? secsEl[idx].querySelector("h2").textContent : "";
      const chs = secsEl.filter(x => x.matches(".ar-sec")), ci = idx >= 0 ? chs.indexOf(secsEl[idx]) : -1;   // the same count as "Chapter 2 of 8"
      pos.textContent = ci >= 0 && started ? `${ci + 1}/${chs.length}` : "";
      bar.classList.toggle("on", idx >= 0 && started);
      if (!readLogged && done > .92) { readLogged = true; arLog({ type: "seen", color: { n: self.n, h: self.h } }); }
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(tick); };
    document.addEventListener("scroll", onScroll, { passive: true, capture: true }); addEventListener("resize", onScroll);   // capture: scroll does not bubble, and the scroller is <body>
    if (typeof cleanup !== "undefined") cleanup.push(() => { document.removeEventListener("scroll", onScroll, true); removeEventListener("resize", onScroll); });
    tick();
    bar.onclick = () => arTocSheet(root, art);
  }
  root.addEventListener("click", e => {
    const t = e.target;
    const fn = t.closest("[data-fn]"); if (fn) return arNoteSheet(art, +fn.dataset.fn);
    const rf = t.closest("[data-ar-ref]"); if (rf) return typeof arfOpen === "function" ? arfOpen(rf.dataset.arRef, self) : undefined;
    const op = t.closest("[data-ar-open]"); if (op) return arOpenColor(op.dataset.arOpen, op.querySelector("i"));
    const wh = t.closest("[data-ar-which]"); if (wh) { e.preventDefault(); return arWhichPage(wh.dataset.arWhich); }
    const act = t.closest("[data-ar-act]"); if (act) return arAct(root, art, self, act);
    const ch = t.closest("[data-ar-ch]"); if (ch) return arAnswer(root, art, self, ch);
  });
}
function arAct(root, art, self, btn) {
  const kind = btn.dataset.arAct;
  if (kind === "duel3") {
    const panel = root.querySelector('[data-ar-panel="you"]'), o = arColor(root.querySelector("[data-ar-you]").dataset.arYou);
    if (!panel || !o) return;
    panel.hidden = false; btn.hidden = true; return arDuel(panel, self, o, 3);
  }
  const sec = art.sections.find(s => s.id === btn.dataset.arSec); if (!sec) return;
  if (kind === "duel") {
    const panel = root.querySelector(`[data-ar-panel="${CSS.escape(sec.id)}"]`), o = arRival(sec, art, self);
    if (!panel) return;
    if (!o) return toast("No look-alike to duel yet");
    if (!panel.hidden && panel.dataset.rival === o.slug) { panel.hidden = true; return; }
    panel.hidden = false; panel.dataset.rival = o.slug; return arDuel(panel, self, o, 1);
  }
  if (kind === "painting") {
    return loadGallery().then(() => {
      const hit = npGalleryHits(self.h, 6)[0];
      if (hit) galleryPage(hit[0], true, self.h); else toast("No painting in the archive holds this color closely enough");
    }).catch(() => toast("The gallery didn't load"));
  }
  if (kind === "mix") return mixLab(self.h, self.n);
  if (kind === "map") {
    const kin = [self, ...arList(art.aside.siblings).map(arColor), ...arList(art.aside.children).map(arColor)].filter(Boolean);
    return csOnMap(colorSet({ kind: "color", id: self.slug, title: self.n, colors: kin.map(c => ({ h: c.h, n: c.n })) }));
  }
}
function arAnswer(root, art, self, btn) {
  const qEl = btn.closest("[data-qi]"), q = art.questions[+qEl.dataset.qi];
  if (qEl.dataset.done) return;
  qEl.dataset.done = "1";
  const j = +btn.dataset.arCh, ans = typeof q.answer === "number" ? q.answer : q.choices.findIndex(c => (typeof c === "string" ? c : c.text) === q.answer);
  qEl.querySelectorAll("[data-ar-ch]").forEach((b, i) => { b.disabled = true; b.classList.toggle("ok", i === ans); b.classList.toggle("no", i === j && j !== ans); });
  const ok = j === ans; qEl.dataset.ok = ok ? "1" : "0";
  qEl.querySelector(".ar-qf").innerHTML = (ok ? "Yes. " : "Not quite. ") + (q.why || q.explain ? arInline(q.why || q.explain, art) : (ans >= 0 ? `It is <b>${esc(typeof q.choices[ans] === "string" ? q.choices[ans] : q.choices[ans].text)}</b>.` : ""));
  arLogAnswer(self, ok, null);
  const all = [...root.querySelectorAll("[data-qi]")];
  if (all.every(x => x.dataset.done)) {
    const right = all.filter(x => x.dataset.ok === "1").length;
    root.querySelector(".ar-qscore").textContent = `${right} of ${all.length}. Try them again tomorrow: what you can recall after a night is what you actually know.`;
  }
}


// ---------- the story door and the book (design/IMPROVE-2026-10-08/color-page.md #1, COLOR-PAGE-DESIGN §2.5, §3) ----------
// A long story is a book you open on purpose, not 11,000 px inline on the color page: the page draws a door (dek, the
// first chapters, minutes, a resume line) and the book reads on its own screen at #/read/<slug>[/<chapter>], which
// remembers where you stopped. A short story (under AR_DOOR_MIN words) still reads inline as the page's lead.
const AR_DOOR_MIN = 600;
// One of the app's own colors without a written article still has its own story: its wiki facets (history,
// language, symbolism...) become the chapters, and its kin become the last one. Never a twin's story when it has one.
function arFacetArt(c) {
  const n = c && typeof colorNode === "function" ? colorNode(c) : null, w = n && n.wiki;
  if (!w || !w.facets || !w.facets.length) return null;
  const html = t => [{ t: "html", html: `<p>${linkText(t)}</p>` }];
  const sections = w.facets.map((f, i) => ({ id: routeSlug(f.k) + (i ? "-" + i : ""), title: (typeof FACET_LABEL !== "undefined" && FACET_LABEL[f.k]) || arPretty(f.k), blocks: html(f.text), words: String(f.text || "").split(/\s+/).length }));
  if (w.related && w.related.length) {
    const rows = w.related.map(r => { const x = graph().resolve(r.to); return x ? `<button class="kin" data-node="${esc(x.id)}"><i style="--c:${x.h}"></i><b>${esc(x.title)}</b><span>${esc(r.why)}</span></button>` : ""; }).join("");
    if (rows) sections.push({ id: "family", title: "Family", blocks: [{ t: "html", html: `<div class="ar-kin">${rows}</div>` }], words: 40 });
  }
  const slug = routeSlug(c.n), words = sections.reduce((s, x) => s + x.words, 0);
  return { slug, name: c.n, names: [c.n], hex: c.h, tier: "", lede: "", sections, aside: {}, notes: new Map(), questions: [], words, status: "", facet: true, dek: typeof plainText === "function" ? plainText(w.facets[0].text).split(/(?<=[.!?])\s/)[0] : "", sources: w.sources || [] };
}
const arChapters = art => art.sections.filter(s => s.title).map((s, i) => ({ id: s.id, title: s.title, i,
  min: ((m) => m < .75 ? "<1" : String(Math.max(1, Math.round(m))))(((s.words || s.blocks.reduce((t, b) => t + String(b.text || b.say || "").split(/\s+/).length + String(b.rec || "").split(/\s+/).length, 0)) / AR_WPM)) }));
// where you stopped, per story (inside S, so migrateState keeps it): { s: chapter id, i, n, p: 0..1, done }
const arReadStore = () => (S.arRead && typeof S.arRead === "object" ? S.arRead : (S.arRead = {}));
const arReadState = slug => arReadStore()[slug] || null;
function arDoorHTML(art, self, fig) {
  const ch = arChapters(art), st = arReadState(art.slug), mins = arMinutes(art);
  const started = st && st.p > .03 && !st.done, cur = started ? ch.find(c => c.id === st.s) || ch[0] : null;
  const left = started ? Math.max(1, Math.round(mins * (1 - st.p))) : 0;
  const dek = art.dek || (art.lede ? art.lede.split(/(?<=[.!?])\s/).slice(0, 1).join(" ") : "");
  const src = art.notes && art.notes.size ? art.notes.size : (art.sources || []).length;
  const meta = [`${mins} min`, `${ch.length} chapter${ch.length === 1 ? "" : "s"}`, src ? `${src} source${src === 1 ? "" : "s"}` : ""].filter(Boolean).join(" · ");
  const rows = started
    ? `<div class="ar-door-prog" style="--p:${Math.round(st.p * 100)}%"><i></i></div><button type="button" class="ar-door-row ar-door-cont" data-ar-chap="${esc(cur.id)}"><span class="mono">${cur.i + 1}</span><b>Continue · ${esc(cur.title)}</b><em>${left} min left</em></button>`
    : ch.slice(0, 3).map(c => `<button type="button" class="ar-door-row" data-ar-chap="${esc(c.id)}"><span class="mono">${c.i + 1}</span><b>${esc(c.title)}</b><em>${c.min} min</em></button>`).join("")
      + (ch.length > 3 ? `<button type="button" class="ar-door-row ar-door-more" data-ar-chap="${esc(ch[3].id)}"><span class="mono">+</span><b>${ch.length - 3} more: ${esc(ch.slice(3).map(c => c.title).join(", "))}</b></button>` : "");
  return `<section class="ar-door" data-ar-door="${esc(art.slug)}">${fig || ""}
    <p class="ar-door-k">The story${st && st.done ? " · read" : ""}</p>
    <h2 class="ar-door-t">${esc(art.name || self.n)}</h2>
    ${dek ? `<p class="ar-door-dek">${arInline(dek, art)}</p>` : ""}
    <p class="ar-door-meta">${esc(meta)}</p>
    <div class="ar-door-rows">${rows}</div>
    <button type="button" class="ar-door-go" data-ar-begin>${started ? `Continue reading · ${left} min` : st && st.done ? "Read it again" : `Begin reading · ${mins} min`}<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>
  </section>`;
}
function arDoorWire(host, art, self) {
  host.addEventListener("click", e => {
    const ch = e.target.closest("[data-ar-chap]"), go = e.target.closest("[data-ar-begin]");
    if (!ch && !go) return;
    const st = arReadState(art.slug);
    arReadPage(art.slug, ch ? ch.dataset.arChap : st && !st.done && st.p > .03 ? st.s : null, true, { art, self });
  });
}

// The book: its own screen, the article in full, a contents bar that follows you, a "Back to <color>" at the end.
const AR_READING = new Map();   // slug -> { art, self } once loaded (a facet story needs the wiki, which may be in by now)
function arReadLoad(slug) {
  if (AR_READING.has(slug)) return Promise.resolve(AR_READING.get(slug));
  const names = Promise.all([typeof loadCoreNames === "function" ? loadCoreNames() : null, arLoadNames()]);
  return Promise.all([arLoad(slug), names]).then(([art]) => {
    let a = art;
    const c = typeof routeColor === "function" ? routeColor(slug) : null;
    if (!a && c) return loadWiki().then(() => arFacetArt(c));
    return a;
  }).then(a => {
    if (!a) return null;
    const self = arColor(slug) || (a.hex ? { slug, n: a.name, h: a.hex } : null);
    if (!self) return null;
    const r = { art: a, self };
    AR_READING.set(slug, r);
    return r;
  });
}
function arReadPage(slug, chap, push = true, pre) {
  if (pre && pre.art) AR_READING.set(slug, pre);
  if (AR_READING.has(slug)) return arReadDraw(slug, chap, push);
  waitScreen(); const tok = SHOW_N;
  arReadLoad(slug).then(r => {
    if (SHOW_N !== tok) return;
    ROUTE_REPLACE = true; ROUTE_NEXT = routed(r ? r.art.name : arPretty(slug), "read/" + slug + (chap ? "/" + chap : ""));
    if (!r) return arMissing("This story");
    arReadDraw(slug, chap, push);
  });
}
function arReadDraw(slug, chap, push) {
  const { art, self } = AR_READING.get(slug);
  if (push) XSTACK.push("ar:read/" + slug);
  const el = show(`<header class="ar-rd-top"><button class="icon-btn glass" data-back aria-label="Back">${ICON.back}</button><span class="ar-rd-t"><i style="--c:${self.h}"></i>${esc(art.name || self.n)}</span><span class="ar-rd-sp"></span></header>
    <div class="ar-rd-band" style="--c:${self.h}" data-ink="${ink(self.h)}"><h1>${esc(art.name || self.n)}</h1></div>
    ${arBuildHTML(art, self)}
    ${art.facet && art.sources && art.sources.length ? `<section class="ar-notes"><h2>Sources</h2><ol>${art.sources.map((s, i) => `<li><span class="ar-nn">${i + 1}</span><span class="ar-nc">${/^https?:\/\//.test(s) ? `<a href="${esc(s)}" target="_blank" rel="noopener">${esc(s.replace(/^https?:\/\/(www\.)?/, "").slice(0, 60))}</a>` : esc(s)}</span></li>`).join("")}</ol></section>` : ""}
    <div class="ar-rd-end"><button type="button" class="cp-primary" data-ar-home>Back to ${esc(self.n)}${ICON.arrow}</button></div>`, "article ar-page ar-read");
  el.querySelector("[data-back]").onclick = xBack;
  // opened from its color's page: back to it; opened from a shared link: its color's page is the way on
  el.querySelector("[data-ar-home]").onclick = () => XSTACK.length > 1 ? xBack() : (XSTACK = [], openCoreName(self.h, self.n));
  onKey = e => { if (e.key === "Escape") xBack(); };
  const root = el.querySelector(".ar");
  arWire(root, art, self);
  if (typeof wireLinks === "function") wireLinks(el);
  if (typeof arfEnhance === "function") { try { arfEnhance(root, art, self); } catch (e) {} }
  // where you stopped: the chapter in view and how far through the whole story, saved as you read
  const secs = arHeaded(root), store = arReadStore();
  let saveT = 0;
  const tick = () => {
    const r = root.getBoundingClientRect(), p = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - innerHeight * .8)));
    let idx = 0; secs.forEach((s, i) => { if (s.getBoundingClientRect().top <= 120) idx = i; });
    if (p < .02) return;   // the top of the book is not a place to resume from
    const prev = store[slug] || {};
    store[slug] = { s: secs[idx] ? secs[idx].id.replace(/^ar-s-/, "") : "", i: idx, n: secs.length, p, done: prev.done || p > .94, at: today() };
    clearTimeout(saveT); saveT = setTimeout(save, 600);
  };
  const onScroll = () => tick();   // direct, not rAF: a background tab still records where you stopped
  document.addEventListener("scroll", onScroll, { passive: true, capture: true });
  cleanup.push(() => { document.removeEventListener("scroll", onScroll, true); clearTimeout(saveT); if (root.isConnected) tick(); clearTimeout(saveT); save(); });
  if (chap) { const t = el.querySelector("#ar-s-" + CSS.escape(chap)); if (t) setTimeout(() => arScrollTo(t), 60); }
  return el;
}

// ---------- entry point ----------
// Draws the story for `slug` into `host`: the door for a long one (AR_DOOR_MIN words or more), the text itself for a
// short one. ctx.facet is a story built from the wiki (arFacetArt), used when there's no written article; ctx.fig a
// cover figure. Resolves true if there is a story; otherwise draws nothing and resolves false.
function articleRender(slug, host, ctx) {
  const none = () => { if (host) { host.innerHTML = ""; host.hidden = true; } return false; };
  if (!host || !slug) return Promise.resolve(false);
  const names = Promise.all([typeof loadCoreNames === "function" ? loadCoreNames() : null, arLoadNames()]);
  return Promise.all([arLoad(slug), names]).then(([found]) => {
    const art = found || (ctx && ctx.facet) || null;
    if (!art || (host.isConnected === false)) return none();
    const self = arColor(slug) || (ctx && ctx.h ? { slug, n: ctx.n || art.name, h: ctx.h } : art.hex ? { slug, n: art.name, h: art.hex } : null);
    if (!self) return none();
    host.hidden = false;
    // a wiki-facet story is chapters by nature (history, language, symbolism...): a book from three of them
    if (!(ctx && ctx.door === false) && (art.facet ? art.sections.length >= 3 : (art.words || arWords(art)) >= AR_DOOR_MIN)) {
      AR_READING.set(art.slug, { art, self });
      host.innerHTML = arDoorHTML(art, self, ctx && ctx.fig);
      arDoorWire(host, art, self);
      return true;
    }
    host.innerHTML = (ctx && ctx.fig || "") + arBuildHTML(art, self);
    arWire(host.querySelector(".ar"), art, self);
    if (typeof arfEnhance === "function") { try { arfEnhance(host.querySelector(".ar"), art, self); } catch (e) { try { console.warn("article figures failed:", e); } catch (_) {} } }   // js/article-refs.js: the figure cards
    return true;
  }).catch(e => { try { console.warn("article render failed:", slug, e); } catch (_) {} return none(); });
}

// ---------- hubs (#/hub/<id>) and disambiguation (#/which/<id>) ----------
// data/graph/hubs.json: { hubs: { "<id>": { title, kind, n, blurb, members: [slug] } } } (the real file; an array of
// { id, title, dek, intro, members: [slug | {slug, note}] } works too). data/graph/disambig.json: { groups: [{ id, base,
// members: [{ s, n, h, kind, q, tier }] }] }. A "which" page with no group falls back to that article's aside.disambiguation.
let AR_HUBS = null, AR_WHICH = null;
function arLoadHubs() {
  if (AR_HUBS) return Promise.resolve(AR_HUBS);
  return Promise.all([arFetchJSON(arCfg().hubs || "data/graph/hubs.json"), arFetchJSON(arCfg().disambig || "data/graph/disambig.json"), arLoadNames(),
    typeof loadCoreNames === "function" ? loadCoreNames() : null]).then(([h, w]) => { AR_WHICH = w && typeof w === "object" ? w : {}; return (AR_HUBS = h && typeof h === "object" ? h : {}); });
}
function arHubEntry(data, id) {
  const h = data.hubs;
  if (Array.isArray(h)) return h.find(x => x && x.id === id) || null;
  if (h && typeof h === "object") return h[id] ? { id, ...h[id] } : null;
  return Array.isArray(data) ? data.find(x => x && x.id === id) || null : null;
}
const AR_KIND_WORD = { primary: "The main name", "family-word": "A related name" };
function arWhichEntry(data, name) {
  const g = data && Array.isArray(data.groups) ? data.groups.find(x => x && (x.id === name || routeSlug(x.base || "") === name)) : null;
  if (g) return { name, title: g.base, senses: arList(g.members).map(m => ({ slug: m.s, name: m.n, hex: m.h, gloss: m.q ? arPretty(m.q) + " version" : AR_KIND_WORD[m.kind] || (m.tier ? arPretty(m.tier) : "") })) };
  const w = data && (data.which || data.disambiguation);   // the fixture shape: { which: { "<name>": { title, dek, senses } } }
  return w && !Array.isArray(w) && w[name] ? { name, ...w[name] } : null;
}
const arBack = () => `<button class="cp-close ar-back" data-back aria-label="Back">${ICON.back}</button>`;
function arRowsHTML(list) {
  return `<div class="ar-rows">${list.map(c => `<button type="button" class="ar-row" data-ar-open="${esc(c.slug)}"><i style="--c:${c.h}"></i><b>${esc(c.n)}</b>${c.gloss ? `<span>${esc(c.gloss)}</span>` : ""}</button>`).join("")}</div>`;
}
function arShell(html, cls, id) {
  const el = show(html, "article cp-page ar-page " + (cls || ""));
  el.querySelector("[data-back]").onclick = xBack;
  onKey = e => { if (e.key === "Escape") xBack(); };
  el.addEventListener("click", e => { const op = e.target.closest("[data-ar-open]"); if (op) arOpenColor(op.dataset.arOpen, op.querySelector("i")); const w = e.target.closest("[data-ar-which]"); if (w) { e.preventDefault(); arWhichPage(w.dataset.arWhich); } });
  return el;
}
function arMissing(what) {
  arShell(`<div class="ar-hubband ar-flat">${arBack()}</div><h1 class="ar-hubt">Not written yet</h1><p class="ar-hubd">${esc(what)} isn't in the collection yet. Nothing is lost: colors keep their own pages.</p>`, "ar-missing");
}
const arSpread = (list, n) => list.length <= n ? list : Array.from({ length: n }, (_, i) => list[Math.floor(i * list.length / n)]);   // an even sample, so a long hub's band shows its range
function arHubDraw(id, push) {
  const hub = arHubEntry(AR_HUBS || {}, id);
  if (push) XSTACK.push("ar:hub/" + id);
  if (!hub) return arMissing("This collection");
  const members = arList(hub.members).map(arColor).filter(Boolean);
  const title = hub.title || arPretty(id), per = 60, shown = members.slice(0, per);
  const el = arShell(`<div class="ar-hubband" aria-hidden="true">${arBack()}${arSpread(members, 24).map(c => `<i style="--c:${c.h}"></i>`).join("")}</div>
    <h1 class="ar-hubt">${esc(title)}</h1>
    ${hub.dek || hub.blurb ? `<p class="ar-hubd">${arInline(hub.dek || hub.blurb, null)}</p>` : ""}
    <p class="ar-hubn">${members.length} color${members.length === 1 ? "" : "s"}</p>
    ${arList(hub.intro).length ? `<div class="ar-hubi">${arBlocks(hub.intro).map(b => arBlockHTML(b, null)).join("")}</div>` : ""}
    <div data-ar-list>${arRowsHTML(shown)}</div>
    ${members.length > per ? `<button type="button" class="ar-act ar-all" data-ar-all>Show all ${members.length}<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button>` : ""}`, "ar-hub");
  const all = el.querySelector("[data-ar-all]"); if (all) all.onclick = () => { el.querySelector("[data-ar-list]").innerHTML = arRowsHTML(members); all.remove(); };
  return el;
}
function arHubPage(id, push = true) {
  if (AR_HUBS) return arHubDraw(id, push);
  waitScreen(); const tok = SHOW_N;
  arLoadHubs().then(() => { if (SHOW_N !== tok) return; ROUTE_REPLACE = true; ROUTE_NEXT = routed(arPretty(id), "hub/" + id); arHubDraw(id, push); });
}
function arWhichDraw(name, push, art) {
  const ent = arWhichEntry(AR_WHICH || AR_HUBS || {}, name) || arWhichEntry(AR_HUBS || {}, name);
  const senses = ent ? arList(ent.senses) : art ? arList(art.aside.disambiguation).concat([name]) : [];
  const list = senses.map(arColor).filter(Boolean).filter((c, i, a) => a.findIndex(x => x.slug === c.slug) === i);
  if (push) XSTACK.push("ar:which/" + name);
  if (!list.length) return arMissing("This list of meanings");
  const title = (ent && ent.title) || arPretty(name);
  return arShell(`<div class="ar-hubband ar-flat">${arBack()}</div>
    <h1 class="ar-hubt">Which <em>${esc(title)}</em>?</h1>
    <p class="ar-hubd">${esc((ent && ent.dek) || "Several colors go by this name. Each one opens its own page.")}</p>
    <div class="ar-plates">${list.map((c, i) => `<button type="button" class="ar-plate" style="--c:${c.h}" data-ink="${ink(c.h)}" data-ar-open="${esc(c.slug)}"><i hidden></i><b>${esc(c.n)}</b>${c.gloss ? `<span>${esc(c.gloss)}</span>` : ""}${arWhichDiff(c, i ? list[0] : null)}</button>`).join("")}</div>`, "ar-which");
}
// every sense says how it differs from the main one (CLAUDE.md: "every color gets a line on how it differs"),
// measured, e.g. "Lighter and bluer than lavender."
function arWhichDiff(c, main) {
  if (!main || typeof colorDiff !== "function" || typeof MORE === "undefined") return "";
  try {
    const p = colorDiff(c.h, main.h).slice(0, 2).filter(x => MORE[x.w]);
    if (!p.length) return `<em>Almost the same as ${esc(main.n.toLowerCase())}.</em>`;
    const w = MORE[p[0].w] + (p[1] ? " and " + MORE[p[1].w] : "");
    return `<em>${esc(w.charAt(0).toUpperCase() + w.slice(1))} than ${esc(main.n.toLowerCase())}.</em>`;
  } catch (e) { return ""; }
}
function arWhichPage(name, push = true) {
  if (AR_HUBS && (arWhichEntry(AR_WHICH, name) || arWhichEntry(AR_HUBS, name))) { arWhichDraw(name, push, null); return; }
  waitScreen(); const tok = SHOW_N;
  Promise.all([arLoadHubs(), arLoad(name)]).then(([, art]) => { if (SHOW_N !== tok) return; ROUTE_REPLACE = true; ROUTE_NEXT = routed(arPretty(name), "which/" + name); arWhichDraw(name, push, art); });
}
// Back-trail entries ("ar:hub/<id>", "ar:which/<name>") reopen without pushing again (js/explore.js xStep).
function arStep(spec) {
  const [kind, ...rest] = spec.split("/"), id = rest.join("/");
  if (kind === "hub") return arHubPage(id, false);
  if (kind === "which") return arWhichPage(id, false);
  if (kind === "read") return arReadPage(rest[0], rest[1] || null, false);   // the book (arReadPage)
  return xToOrigin();
}
