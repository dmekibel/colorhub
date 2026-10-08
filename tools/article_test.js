// node tools/article_test.js
// Lane L8's checks for js/article.js. It loads the file in a sandbox with a few stubs (no browser), then:
//   - parses every fixture in tools/fixtures/articles/ and, when present, every real article in data/articles/;
//   - checks every [[slug]] resolves to a name we know, every [n] has a note, every note is used, callouts are well formed,
//     question answers point at a real choice, and aside slugs resolve;
//   - checks that a missing article renders nothing (host emptied and hidden, promise resolves false);
//   - checks the built HTML has the pieces (lede, contents bar, footnote buttons, swatch links, myth + books callouts, tree, questions, notes);
//   - checks the hubs fixture (members resolve, "which" senses resolve);
//   - reference cards (js/article-refs.js): [[gem:id]] [[flower:id]] [[painting:id]] [[look:id]] [[garment:id]] [[film:id]] [[painter:slug]]
//     parse, resolve against the real datasets, respect the closeness threshold (CIEDE2000 15; 8 for looks; 2% of a canvas), the planner
//     keeps auto-figures within its limits (<= 5, one per kind, one per section, <= 3 in the closing strip), figures have fixed proportions.
const fs = require("fs"), path = require("path"), vm = require("vm");
const root = path.join(__dirname, "..");
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log("FAIL  " + m); } };
const norm = s => String(s).normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const core = JSON.parse(fs.readFileSync(path.join(root, "data/core-names.json"), "utf8"));
const known = new Map(core.map(e => [norm(e.n), e]));
const gnPath = path.join(root, "data/graph/names.json");
if (fs.existsSync(gnPath)) JSON.parse(fs.readFileSync(gnPath, "utf8")).forEach(r => { if (!known.has(r[0])) known.set(r[0], r); });   // every name in the graph

// alias-aware resolving (same order as the gate and js/article.js arColor): link-map override, canonical, alias
const readJSON = f => { try { return JSON.parse(fs.readFileSync(path.join(root, f), "utf8")); } catch (e) { return null; } };
const linkMap = (readJSON("data/articles/link-map.json") || {}).links || {};
const aliasOf = Object.assign({}, (readJSON("data/aliases.json") || {}).slugs, (readJSON("data/graph/aliases.json") || {}).alias);
const articleSlugs = new Set(fs.readdirSync(path.join(root, "data/articles")).filter(f => f.endsWith(".json") && f !== "link-map.json" && f !== "index.json").map(f => f.slice(0, -5)));
const resolves = (s, body) => { s = norm(s); if (s in linkMap) return linkMap[s].to ? known.has(linkMap[s].to) || articleSlugs.has(linkMap[s].to) : !!body; return known.has(s) || articleSlugs.has(s) || (s in aliasOf && (known.has(aliasOf[s]) || articleSlugs.has(aliasOf[s]))); };

// ---- sandbox ----
let fetchTable = { "data/graph/names.json": readJSON("data/graph/names.json"), "data/graph/aliases.json": readJSON("data/graph/aliases.json"),
  "data/aliases.json": readJSON("data/aliases.json"), "data/articles/link-map.json": readJSON("data/articles/link-map.json"), "data/articles/index.json": readJSON("data/articles/index.json") };
const cm = require("./colormath.js");
// the files the reference cards read from disk (the app fetches them over HTTP)
const diskFetch = k => /^data\/(graph\/(nodes|edges)-[a-z_]\.json|gallery\/ids\.txt|analysis\/artists\/[a-z0-9-]+\.json)$/.test(k) && fs.existsSync(path.join(root, k)) ? fs.readFileSync(path.join(root, k), "utf8") : null;
const sandbox = {
  console, Promise, setTimeout, Math, Date, JSON, Map, Set, Array, Object, String, Number, RegExp, Error,
  lab: cm.lab, de2000: cm.de2000, toast: () => {}, icon: () => "",
  pctMatch: (n, decimal) => { const m = Math.max(0, 100 - n); return m >= 100 ? "100% match" : `${decimal || m > 99 ? m.toFixed(1) : Math.round(m)}% match`; },
  esc: s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])),
  ink: () => "dark", routeSlug: norm, routeColor: () => null, CORE_NAMES: core, loadCoreNames: () => Promise.resolve(core),
  BYNAME: new Map(), lookDiff: () => "lighter and greener", lookalikes: () => [],
  fetch: url => {
    const k = String(url).split("?")[0], disk = k in fetchTable ? null : diskFetch(k);
    if (disk != null) return Promise.resolve({ ok: true, json: () => Promise.resolve(JSON.parse(disk)), text: () => Promise.resolve(disk) });
    return Promise.resolve(k in fetchTable ? { ok: true, json: () => Promise.resolve(fetchTable[k]) } : { ok: false, json: () => Promise.resolve(null), text: () => Promise.resolve(null) });
  },
};
sandbox.globalThis = sandbox; sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root, "js/article.js"), "utf8"), sandbox, { filename: "js/article.js" });
vm.runInContext(fs.readFileSync(path.join(root, "js/article-refs.js"), "utf8"), sandbox, { filename: "js/article-refs.js" });
["data/gems.js", "data/gem-images.js", "data/botany.js", "data/botany-images.js", "data/looks.js", "data/films.js"].forEach(f => vm.runInContext(fs.readFileSync(path.join(root, f), "utf8"), sandbox, { filename: f }));
const ar = vm.runInContext(`({ arLoadNames, arColor, arLinkHTML, arInline, arBlocks, arNorm, arList, arRefs, arBuildHTML, arMinutes, articleRender, arHubEntry, arWhichEntry, AR_CACHE,
  arRefList, arRefKind, arBlockHTML, arSplit, arSentences, arQuoteOf, arDatesOf, arAccent, arContrast, arfGaps, arfBest, arfScore, arfPlan, arfFor, arfAutoKeys, arfFigHTML, arfPicHTML, arfCreditHTML, ARF_DE, ARF_LIMIT, ARF_MAX_AUTO, ARF_MAX_END, ARF_MAX_PER_P, ARF_MIN_COVER, ARF_ORDER, ARF_CACHE })`, sandbox);

// ---- alias-aware reader (the resolvers load the same files the app does) ----
const namesLoaded = (async () => {
  await ar.arLoadNames();
  const lm = Object.keys(linkMap);
  ok(lm.length > 0 && lm.every(k => linkMap[k].reason), "link-map.json: every entry has a reason");
  lm.forEach(k => ok(!linkMap[k].to || known.has(linkMap[k].to), `link-map.json: ${k} -> ${linkMap[k].to} is not a canonical color`));
  const alias = ar.arColor("seashell");   // a data/aliases.json alias
  ok(alias && alias.slug === aliasOf["seashell"], "an alias slug resolves to its canonical color");
  ok(ar.arLinkHTML("seashell").includes(`data-ar-open="${aliasOf["seashell"]}"`) && ar.arLinkHTML("seashell").includes(">Seashell<"), "an alias link opens the canonical color and keeps the original word as its label");
  ok(ar.arLinkHTML("seashell", "shell").includes(">shell<"), "an explicit [[slug|label]] still wins over the alias word");
  ok(ar.arLinkHTML("konjo-iro").includes('data-ar-open="yale-blue"') && ar.arLinkHTML("konjo-iro").includes(">Konjō-iro<"), "a link-map entry opens its target with its label");
  ok(ar.arColor("yinmn-blue") === null && ar.arLinkHTML("yinmn-blue").includes("ar-x") && ar.arLinkHTML("yinmn-blue").includes("YInMn blue"), "a link-map to:null entry is plain text with its label");
  const bk = ar.arColor("madder");
  ok(bk && bk.book && ar.arLinkHTML("madder").includes('data-ar-open="madder"') && ar.arLinkHTML("madder").includes("ar-bk") && !ar.arLinkHTML("madder").includes("<i "), "an article-only slug (madder) links to its book with a book glyph, not a swatch");
  ok(ar.arColor("cobalt") && ar.arColor("cobalt").via === undefined, "a canonical name resolves unchanged");
})();

// ---- parsing helpers ----
ok(ar.arInline("a *b* **c** [[cobalt]] d", null).includes("<em>b</em>") && ar.arInline("**c**", null).includes("<strong>c</strong>"), "inline italics and bold");
ok(/data-ar-open="cobalt"/.test(ar.arInline("[[cobalt]]", null)), "[[slug]] becomes a one-tap link");
ok(ar.arInline("[[nosuchcolorxyz]]", null).includes("ar-x"), "an unknown [[slug]] degrades to plain text");
ok(ar.arInline("x [9]", { notes: new Map() }) === "x [9]", "[n] with no note is left alone");
ok((ar.arInline("x[1,2]", { notes: new Map([[1, {}], [2, {}]]) }).match(/data-fn=/g) || []).length === 2, "[1,2] makes two note buttons");
const b1 = ar.arBlocks("Plain.\n\nBooks disagree: a vs b.\n\n!myth The story says X. The record shows Y.\n\nThe story says A. The record shows B.");
ok(b1.map(b => b.t).join() === "p,books,myth,myth", "block kinds: " + b1.map(b => b.t));
ok(b1[2].say === "X." && b1[2].rec === "Y.", "myth split into story and record");
ok(b1[3].say === "A." && b1[3].rec === "B.", "natural myth form is detected");

// ---- every article file (after the alias tables are loaded, as the app does) ----
let count = 0;
const refsSeen = [];   // [label, {kind, id, key}] for every reference card an article mentions
const articlesDone = namesLoaded.then(() => {
function articleFiles() {
  const out = [];
  const add = (dir, tag) => { if (fs.existsSync(dir)) fs.readdirSync(dir).filter(f => f.endsWith(".json")).forEach(f => out.push([path.join(dir, f), tag])); };
  add(path.join(root, "tools/fixtures/articles"), "fixture"); add(path.join(root, "data/articles"), "data");
  return out;
}
articleFiles().forEach(([file, tag]) => {
  const slug = path.basename(file, ".json"), label = `${tag}/${slug}`;
  let raw; try { raw = JSON.parse(fs.readFileSync(file, "utf8")); } catch (e) { ok(false, label + " is not valid JSON"); return; }
  if (!raw || !Array.isArray(raw.sections)) return;   // SCHEMA.md, indexes and the like
  count++;
  const art = ar.arNorm(raw, slug);
  ok(!!art, label + " parses as an article"); if (!art) return;
  ok(art.lede.length > 20, label + " has a lede");
  ok(new Set(art.sections.map(s => s.id)).size === art.sections.length, label + " section ids are unique");
  const refs = ar.arRefs(art);
  refs.links.forEach(s => ok(resolves(s, true), `${label}: [[${s}]] does not resolve to a canonical color, an alias, a link-map entry or an article`));
  refs.links.forEach(s => ok(ar.arColor(s) !== null || (linkMap[norm(s)] && !linkMap[norm(s)].to), `${label}: [[${s}]] resolves in the checker but the reader draws no color for it`));
  refs.refs.forEach(r => refsSeen.push([label, r]));
  refs.fns.forEach(n => ok(art.notes.has(n), `${label}: note [${n}] is cited but missing`));
  [...art.notes.keys()].forEach(n => ok(refs.fns.includes(n), `${label}: note ${n} is never cited`));
  art.sections.forEach(s => s.blocks.forEach(b => { if (b.t === "myth") ok(b.say && b.rec, `${label}/${s.id}: a myth callout needs both "The story says" and "The record shows"`); }));
  art.questions.forEach((q, i) => { const a = typeof q.answer === "number" ? q.answer : q.choices.indexOf(q.answer); ok(a >= 0 && a < q.choices.length, `${label}: question ${i + 1} answer is not one of its choices`); });
  const as = art.aside;
  ["parent", "siblings", "children", "disambiguation"].forEach(k => ar.arList(as[k]).forEach(x => { const s = typeof x === "object" ? x.slug : x; ok(typeof s === "string" && /^[a-z0-9-]+$/.test(norm(s)) && norm(s) === s && resolves(s, false), `${label}: aside.${k} "${s}" is not a slug that resolves (disambiguation must be a slug or {slug, gloss}, not prose)`); }));
  // the built page
  const self = { slug, n: art.name, h: art.hex || "#808080" };
  const html = ar.arBuildHTML(art, self);
  ok(html.includes('class="ar-lede"'), label + " html: lede");
  ok(art.sections.filter(s => s.title).length < 2 || html.includes("data-ar-bar"), label + " html: contents bar");
  ok((html.match(/data-fn=/g) || []).length >= refs.fns.length, label + " html: footnote buttons");
  if (art.notes.size) ok(html.includes("ar-notes"), label + " html: notes list");
  if (art.questions.length) ok(html.includes("ar-qs"), label + " html: questions");
  if (art.sections.some(s => s.blocks.some(b => b.t === "myth"))) ok(html.includes("ar-myth") && html.includes("The record shows"), label + " html: myth callout");
  if (art.sections.some(s => s.blocks.some(b => b.t === "books"))) ok(html.includes("ar-books") && html.includes("Books disagree"), label + " html: books callout");
  if (ar.arList(as.siblings).length || ar.arList(as.parent).length) ok(html.includes("ar-hex"), label + " html: family tree");
  ok(!/<script|onerror=|javascript:/i.test(html), label + " html: no script injection");
  ok(ar.arMinutes(art) >= 1, label + " reading time");
});
ok(count >= 2, "at least 2 articles tested (found " + count + ")");
});


// ---- reference cards ----
// parsing: the seven kinds (and the older [[art:id]]) are chips, never colors; unknown kinds stay literal text
(() => {
  const L = ar.arRefList("A [[gem:spinel|spinel]] and [[art:nga-72328|Roses]] and [[painting:12]] and [[gem:spinel]] and [[film:vertigo]] [[flower:mauve|mallow]] [[look:art-nouveau]] [[garment:cma-163622]] [[painter:john-singer-sargent|Sargent]].");
  ok(L.map(r => r.key).join() === "gem:spinel,painting:nga-72328,painting:12,film:vertigo,flower:mauve,look:art-nouveau,garment:cma-163622,painter:john-singer-sargent", "arRefList: keys, art: folded into painting, duplicates dropped: " + L.map(r => r.key));
  const h = ar.arInline("see [[gem:spinel|spinel]], [[art:nga-72328|Roses]] and [[cobalt]]", null);
  ok(h.includes('data-ar-ref="gem:spinel"') && h.includes('data-ar-ref="painting:nga-72328"') && h.includes(">Roses<") && h.includes('data-ar-open="cobalt"'), "reference chips beside a color link");
  ok(!/ar-x/.test(ar.arInline("[[gem:spinel]]", null)) && ar.arInline("[[gem:spinel]]", null).includes("Spinel"), "an unlabeled reference shows a plain guess of its name");
  ok(ar.arInline("[[nokind:abc]]", null).includes("[[nokind:abc]]"), "an unknown kind is left as literal text");
  ok(!/<script|onerror=/i.test(ar.arInline("[[gem:a\"onmouseover=\"x|y]]", null)), "no injection through a reference id");
  const b = ar.arBlockHTML({ t: "p", text: "One [[gem:spinel|spinel]] and [[film:vertigo|Vertigo]]." }, null);
  ok(b.startsWith('<p data-ar-refs="gem:spinel film:vertigo">'), "a paragraph with references carries them for the figure pass: " + b.slice(0, 60));
  ok(ar.arBlockHTML({ t: "p", text: "Plain [[cobalt]]." }, null).startsWith("<p>"), "a paragraph without references is untouched");
  const art = ar.arNorm({ lede: "A lede that is long enough to count.", sections: [{ id: "a", title: "A", body: "x [[gem:spinel|s]]\n\ny [[painting:nga-72328|R]]" }], aside: {}, names: ["Fiery Rose"] }, "t");
  ok(ar.arRefs(art).refs.map(r => r.key).join() === "gem:spinel,painting:nga-72328" && art.names[0] === "Fiery Rose", "arRefs lists the references; arNorm keeps names");
})();

// reading aids (js/article.js): long paragraphs split at sentence ends, quotations need a speaker, key dates, legible color
(() => {
  const s = "In 1704 a Berlin color-maker named Diesbach set out to make a red [1]. He borrowed potash from J. K. Dippel, which was contaminated [2]. ";
  const long = (s + "The batch went pale, then purple, then a deep blue, and nobody in the shop could say why it had happened that way [3]. ").repeat(3).trim();
  const parts = ar.arSplit(long);
  ok(parts.length >= 2 && parts.join(" ") === long, "arSplit: a long paragraph becomes 2+ paragraphs and loses no words: " + parts.length);
  ok(parts.every(p => !/^\[\d/.test(p)) && ar.arSentences(s).length === 2, "arSplit: note refs stay with their sentence; 'J. K.' initials don't end a sentence");
  ok(ar.arSplit("Short paragraph [1].").length === 1, "arSplit: a short paragraph is untouched");
  ok(ar.arQuoteOf('The editor Diana Vreeland called pink "the navy blue of India" [5].').who === "Diana Vreeland", "arQuoteOf: a short quotation with its speaker");
  ok(ar.arQuoteOf('The ISCC-NBS name is "very light bluish green" [2].') === null, "arQuoteOf: no speaker, no pull quote");
  const d = ar.arDatesOf(["In 1842 John Herschel used iron salts to print white lines [1]. By 1750 it was made across Europe [2]."]);
  ok(d.length === 2 && d[0].label === "1750" && d[1].label === "1842" && d[1].snip.startsWith("John Herschel"), "arDatesOf: dates in time order, the 'In 1842' lead-in dropped: " + JSON.stringify(d));
  ok(ar.arDatesOf(["It weighed 1500 kg [1]. In 1900 it sold [2]."]).length === 0, "arDatesOf: a quantity is not a date, and one date is not a timeline");
  ["#FF0000", "#003153", "#000080", "#F4C2C2", "#808080"].forEach(h => { const a = ar.arAccent(h); ok(a.mode === "none" || (a.mode === "line" ? !!a.c : ar.arContrast(a.c, "#0E0D0B") >= 4.5), `arAccent ${h}: text highlights pass 4.5:1 or fall back to an underline (${a.mode} ${a.c})`); });
})();

// the threshold: a picture only when the closest palette color is within CIEDE2000 15 (an 85% match); looks 8; paintings need 2% of the canvas
(() => {
  ok(ar.ARF_DE === 15 && ar.ARF_LIMIT.look === 8 && ar.ARF_MIN_COVER === .02, "threshold constants");
  const self = "#CC3336", hx = v => "#" + [0xCC, Math.min(255, 0x33 + v), Math.min(255, 0x36 + v)].map(x => x.toString(16).padStart(2, "0")).join("");
  const edge = k => { let v = 0; while (v < 200 && cm.de2000(self, hx(v + 1)) <= k) v++; return [hx(v), hx(v + 1)]; };   // the last color inside k, the first outside
  const [inH, outH] = edge(15);
  ok(cm.de2000(self, inH) <= 15 && cm.de2000(self, outH) > 15, "test colors straddle ΔE 15");
  const g = (h, kind = "gem", extra = {}) => ar.arfScore({ kind, pal: ["#0000FF", h], ...extra }, self);
  ok(g(inH).ok && !g(outH).ok, "a gem inside ΔE 15 shows its picture, one outside does not");
  ok(g(self).pctText === "100% match" && /^\d+% match$/.test(g(inH).pctText), "match text comes from pctMatch: " + g(inH).pctText);
  ok(g(self).best.h === self && g(self).best.i === 1, "the closest palette color is the one named");
  const [lIn, lOut] = edge(8);
  ok(g(lIn, "look").ok && !g(lOut, "look").ok && g(lOut, "gem").ok, "a look needs ΔE 8, other kinds 15");
  ok(g(self, "painting", { cover: () => .01 }).ok === false && g(self, "painting", { cover: () => .03 }).ok === true, "a painting needs at least 2% of the canvas");
  ok(ar.arfScore({ kind: "gem", pal: [] }, self).ok === false && ar.arfBest(self, ["not-a-hex"]) === null, "no usable palette: no picture");
})();

// figure HTML: fixed picture box, lazy image, credit, one-tap target
(() => {
  const self = { slug: "madder", n: "Madder Lake", h: "#CC3336" };
  const t = ar.arfScore({ kind: "gem", id: "ruby", name: "Ruby", sub: "", pal: ["#9B111E", "#E0115F"], palNames: ["Burmese", "Bright commercial ruby"], img: { src: "https://upload.wikimedia.org/x.jpg" }, credit: { credit: "A. Person · CC BY 2.0", url: "https://commons.wikimedia.org/wiki/File:X.jpg", licenseUrl: "https://creativecommons.org/licenses/by/2.0" } }, self.h);
  t.key = "gem:ruby";
  const h = ar.arfFigHTML(t, self);
  ok(h.includes('data-ar-ref="gem:ruby"') && h.includes('<b class="ar-fig-n">Ruby</b>') && /\d+% match to Madder Lake/.test(h), "figure: name and % match to the article's color");
  ok(h.includes('loading="lazy"') && h.includes('class="ar-fig-im"') && h.includes("<figcaption") && h.includes("A. Person") && h.includes("License"), "figure: lazy image, credit and license from the data");
  const bad = ar.arfCreditHTML({ credit: "x", url: "javascript:alert(1)" });
  ok(!bad.includes("<a ") && !/javascript:/i.test(bad), "credit links accept only http(s)");
  const s2 = ar.arfFigHTML({ ...t, kind: "film", key: "film:x", img: null, shares: [1, 2], note: "n" }, self);
  ok(s2.includes("ar-fig-strip") && !s2.includes("<img"), "no picture: a strip of the palette instead");
  const css = fs.readFileSync(path.join(root, "css/article.css"), "utf8");
  ok(/\.ar-fig-im\{[^}]*width:112px;height:112px/.test(css) && /\.ar-fig-b\{[^}]*min-height:112px/.test(css), "css: the picture box has fixed proportions");
})();

// the planner: limits and placement
(() => {
  const mk = (kind, key, de, cover) => ({ kind, key, de, ok: true, cover });
  const secs = [{ id: "name", title: "The name" }, { id: "art", title: "In painting" }, { id: "gems", title: "Gems and stones" }, { id: "trade", title: "Trade" }, { id: "field", title: "Field notes" }];
  const c = [mk("gem", "gem:a", 3), mk("gem", "gem:b", 1), mk("painting", "painting:p1", 2, .1), mk("painting", "painting:p2", 1, .3), mk("flower", "flower:f", 5), mk("look", "look:l", 4), mk("film", "film:x", 2), mk("film", "film:y", 1), mk("painter", "painter:z", 6), mk("garment", "garment:g", 7), { kind: "gem", key: "gem:far", de: 40, ok: false }];
  const p = ar.arfPlan(secs, c, new Set(), new Set());
  const all = [...Object.values(p.place).flat(), ...p.end];
  ok(all.length === ar.ARF_MAX_AUTO, "planner: at most " + ar.ARF_MAX_AUTO + " figures: " + all.map(t => t.key));
  ok(new Set(all.map(t => t.kind)).size === all.length, "planner: one per kind");
  ok(Object.values(p.place).every(l => l.length === 1), "planner: one figure per section");
  ok(p.end.length <= ar.ARF_MAX_END, "planner: at most " + ar.ARF_MAX_END + " in the closing strip");
  ok(p.place.art && p.place.art[0].key === "painting:p2", "planner: the painting that covers most goes after the art section: " + JSON.stringify(Object.keys(p.place)));
  ok(p.place.gems && p.place.gems[0].key === "gem:b", "planner: the gem goes after the gems section, the closest one");
  ok(!p.place.field && !all.some(t => t.key === "gem:far"), "planner: never the field section, never a far thing");
  const q = ar.arfPlan(secs, c, new Set(["art"]), new Set(["gem:b"]));
  ok(!q.place.art && !Object.values(q.place).flat().concat(q.end).some(t => t.key === "gem:b"), "planner: skips sections that already hold a figure and things already shown");
  ok(ar.arfPlan(secs, [], new Set(), new Set()).end.length === 0, "planner: nothing in, nothing out");
})();

// ---- a missing file renders nothing ----
(async () => {
  await articlesDone;
  await namesLoaded;
  // every reference card an article mentions exists in its dataset
  const garments = readJSON("data/fashion/garments.json"), painters = (readJSON("data/artists/meta.json") || {}).a || {};
  const galleryIds = new Set(fs.readFileSync(path.join(root, "data/gallery/ids.txt"), "utf8").split("\n")), galleryN = readJSON("data/gallery/index.json").n;
  ok(galleryIds.size === galleryN, `data/gallery/ids.txt has ${galleryIds.size} ids, the gallery ${galleryN}: rebuild with tools/gallery.py`);
  let nrefs = 0;
  for (const [label, r] of refsSeen) {
    nrefs++;
    const found = r.kind === "painting" ? (/^\d+$/.test(r.id) ? +r.id < galleryN : galleryIds.has(r.id)) : r.kind === "garment" ? garments.rows.some(x => x.id === r.id)
      : r.kind === "painter" ? r.id in painters : !!(await ar.arfFor(r.key, "#808080", "light"));
    ok(found, `${label}: [[${r.key}]] is not in its dataset`);
    if (r.kind === "painting" || r.kind === "painter") ok(r.label, `${label}: [[${r.key}]] needs a |label`);
  }
  // the real twins: the auto-figures for the two pilot articles stay in their limits and inside the threshold
  const things = {};
  for (const slug of ["madder", "mauve"]) {
    const a = ar.arNorm(readJSON(`data/articles/${slug}.json`), slug), self = ar.arColor(slug) || { slug, n: a.name, h: a.hex };
    const keys = await ar.arfAutoKeys(a, self);
    ok(keys.length > 10 && keys.some(k => k.startsWith("gem:")) && keys.some(k => k.startsWith("film:")) && keys.some(k => k.startsWith("painting:")), `${slug}: the twins nominate gems, films and paintings (${keys.length} keys)`);
    keys.filter(k => k.startsWith("painting:")).forEach(k => ok(galleryIds.has(k.slice(9)), `${slug}: twin painting ${k} is in data/gallery/ids.txt`));
    const scored = (await Promise.all(keys.map(k => ar.arfFor(k, self.h, "light")))).filter(Boolean);
    scored.forEach(t => ok(t.ok === (t.de <= (t.kind === "look" ? 8 : 15) && (t.cover == null || t.cover >= .02)), `${slug}: ${t.key} ok flag follows the threshold (ΔE ${t.de.toFixed(1)})`));
    const plan = ar.arfPlan(a.sections.filter(s => s.title).map(s => ({ id: s.id, title: s.title })), scored, new Set(), new Set());
    const all = [...Object.values(plan.place).flat(), ...plan.end];
    ok(all.length >= 2 && all.length <= 5, `${slug}: ${all.length} auto-figures (${all.map(t => t.key)})`);
    ok(all.every(t => t.ok && t.de <= 15), `${slug}: every auto-figure is a ≥85% match`);
    ok(new Set(all.map(t => t.kind)).size === all.length && Object.values(plan.place).every(l => l.length === 1) && plan.end.length <= 3, `${slug}: auto-figures stay within limits`);
    things[slug] = all.length;
  }
  console.log(`article_test: ${nrefs} explicit reference cards checked; auto-figures (node, no gallery): madder ${things.madder}, mauve ${things.mauve}`);
  const host = { innerHTML: "stale", hidden: false, isConnected: true };
  const r = await ar.articleRender("no-such-color", host, {});
  ok(r === false && host.innerHTML === "" && host.hidden === true, "a missing article renders nothing");
  const bad = { innerHTML: "x", hidden: false, isConnected: true };
  ok((await ar.articleRender("../etc/passwd", bad, {})) === false, "a path-like slug is refused");
  // a present file renders into the host
  fetchTable["data/articles/cobalt.json"] = JSON.parse(fs.readFileSync(path.join(root, "tools/fixtures/articles/cobalt.json"), "utf8"));
  ar.AR_CACHE.clear();
  const host2 = { innerHTML: "", hidden: true, isConnected: true, querySelector: () => ({ querySelectorAll: () => [], querySelector: () => null, addEventListener() {}, getBoundingClientRect: () => ({ top: 0, height: 100 }) }) };
  sandbox.addEventListener = () => {}; sandbox.requestAnimationFrame = f => 0; sandbox.innerHeight = 800;
  const r2 = await ar.articleRender("cobalt", host2, { n: "Cobalt", h: "#0047AB" });
  ok(r2 === true && host2.hidden === false && host2.innerHTML.includes("ar-lede"), "a present article renders into the slot");
  // hubs fixture
  const hubs = JSON.parse(fs.readFileSync(path.join(root, "tools/fixtures/hubs.json"), "utf8"));
  hubs.hubs.forEach(h => ar.arList(h.members).forEach(m => { const s = typeof m === "object" ? m.slug : m; ok(known.has(norm(s)), `hubs fixture ${h.id}: member "${s}" does not resolve`); }));
  Object.entries(hubs.which).forEach(([k, w]) => w.senses.forEach(s => ok(known.has(norm(s.slug)), `hubs fixture which/${k}: sense "${s.slug}" does not resolve`)));
  ok(ar.arHubEntry(hubs, "purples-and-lilacs").title.startsWith("Purples"), "hub lookup by id");
  ok(ar.arWhichEntry(hubs, "blue").senses.length === 4, "which lookup by name");
  // the real graph files (lane L6), when present: every hub member and every "which" sense resolves, and lookups work
  const hp = path.join(root, "data/graph/hubs.json"), dp = path.join(root, "data/graph/disambig.json");
  if (fs.existsSync(hp)) {
    const real = JSON.parse(fs.readFileSync(hp, "utf8")); let n = 0, miss = 0;
    Object.entries(real.hubs).forEach(([id, h]) => { ok(ar.arHubEntry(real, id).title === h.title, "real hub lookup " + id); h.members.forEach(m => { n++; if (!known.has(m)) miss++; }); });
    ok(miss === 0, `real hubs: ${miss} of ${n} members do not resolve to a graph name`);
  }
  if (fs.existsSync(dp)) {
    const real = JSON.parse(fs.readFileSync(dp, "utf8")); let miss = 0;
    real.groups.forEach(g => { const e = ar.arWhichEntry(real, g.id); ok(e && e.senses.length === g.members.length, "real which lookup " + g.id); g.members.forEach(m => { if (!known.has(m.s)) miss++; }); });
    ok(miss === 0, `real disambig: ${miss} senses do not resolve`);
  }
  console.log(fails ? `article_test: ${fails} FAIL` : `article_test: ok (${count} articles)`);
  process.exit(fails ? 1 : 0);
})();
