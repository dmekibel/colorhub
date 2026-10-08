// node tools/article_test.js
// Lane L8's checks for js/article.js. It loads the file in a sandbox with a few stubs (no browser), then:
//   - parses every fixture in tools/fixtures/articles/ and, when present, every real article in data/articles/;
//   - checks every [[slug]] resolves to a name we know, every [n] has a note, every note is used, callouts are well formed,
//     question answers point at a real choice, and aside slugs resolve;
//   - checks that a missing article renders nothing (host emptied and hidden, promise resolves false);
//   - checks the built HTML has the pieces (lede, contents bar, footnote buttons, swatch links, myth + books callouts, tree, questions, notes);
//   - checks the hubs fixture (members resolve, "which" senses resolve).
const fs = require("fs"), path = require("path"), vm = require("vm");
const root = path.join(__dirname, "..");
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log("FAIL  " + m); } };
const norm = s => String(s).normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const core = JSON.parse(fs.readFileSync(path.join(root, "data/core-names.json"), "utf8"));
const known = new Map(core.map(e => [norm(e.n), e]));
const gnPath = path.join(root, "data/graph/names.json");
if (fs.existsSync(gnPath)) JSON.parse(fs.readFileSync(gnPath, "utf8")).forEach(r => { if (!known.has(r[0])) known.set(r[0], r); });   // every name in the graph

// ---- sandbox ----
let fetchTable = {};
const sandbox = {
  console, Promise, setTimeout, Math, Date, JSON, Map, Set, Array, Object, String, Number, RegExp, Error,
  esc: s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])),
  ink: () => "dark", routeSlug: norm, routeColor: () => null, CORE_NAMES: core, loadCoreNames: () => Promise.resolve(core),
  BYNAME: new Map(), lookDiff: () => "lighter and greener", lookalikes: () => [],
  fetch: url => { const k = String(url).split("?")[0]; return Promise.resolve(k in fetchTable ? { ok: true, json: () => Promise.resolve(fetchTable[k]) } : { ok: false, json: () => Promise.resolve(null) }); },
};
sandbox.globalThis = sandbox; sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root, "js/article.js"), "utf8"), sandbox, { filename: "js/article.js" });
const ar = vm.runInContext("({ arInline, arBlocks, arNorm, arList, arRefs, arBuildHTML, arMinutes, articleRender, arHubEntry, arWhichEntry, AR_CACHE })", sandbox);

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

// ---- every article file ----
function articleFiles() {
  const out = [];
  const add = (dir, tag) => { if (fs.existsSync(dir)) fs.readdirSync(dir).filter(f => f.endsWith(".json")).forEach(f => out.push([path.join(dir, f), tag])); };
  add(path.join(root, "tools/fixtures/articles"), "fixture"); add(path.join(root, "data/articles"), "data");
  return out;
}
let count = 0;
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
  refs.links.forEach(s => ok(known.has(s), `${label}: [[${s}]] does not resolve to a known color`));
  refs.fns.forEach(n => ok(art.notes.has(n), `${label}: note [${n}] is cited but missing`));
  [...art.notes.keys()].forEach(n => ok(refs.fns.includes(n), `${label}: note ${n} is never cited`));
  art.sections.forEach(s => s.blocks.forEach(b => { if (b.t === "myth") ok(b.say && b.rec, `${label}/${s.id}: a myth callout needs both "The story says" and "The record shows"`); }));
  art.questions.forEach((q, i) => { const a = typeof q.answer === "number" ? q.answer : q.choices.indexOf(q.answer); ok(a >= 0 && a < q.choices.length, `${label}: question ${i + 1} answer is not one of its choices`); });
  const as = art.aside;
  ["parent", "siblings", "children", "disambiguation"].forEach(k => ar.arList(as[k]).forEach(x => { const s = typeof x === "object" ? x.slug : x; ok(known.has(norm(s)), `${label}: aside.${k} "${s}" does not resolve`); }));
  // the built page
  const self = { slug, n: art.name, h: art.hex || "#808080" };
  const html = ar.arBuildHTML(art, self);
  ok(html.includes('class="ar-lede"'), label + " html: lede");
  ok(art.sections.filter(s => s.title).length < 2 || html.includes("data-ar-bar"), label + " html: contents bar");
  ok((html.match(/data-fn=/g) || []).length >= refs.fns.length, label + " html: footnote buttons");
  ok(html.includes("ar-notes"), label + " html: notes list");
  if (art.questions.length) ok(html.includes("ar-qs"), label + " html: questions");
  if (art.sections.some(s => s.blocks.some(b => b.t === "myth"))) ok(html.includes("ar-myth") && html.includes("The record shows"), label + " html: myth callout");
  if (art.sections.some(s => s.blocks.some(b => b.t === "books"))) ok(html.includes("ar-books") && html.includes("Books disagree"), label + " html: books callout");
  if (ar.arList(as.siblings).length || ar.arList(as.parent).length) ok(html.includes("ar-hex"), label + " html: family tree");
  ok(!/<script|onerror=|javascript:/i.test(html), label + " html: no script injection");
  ok(ar.arMinutes(art) >= 1, label + " reading time");
});
ok(count >= 2, "at least 2 articles tested (found " + count + ")");

// ---- a missing file renders nothing ----
(async () => {
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
