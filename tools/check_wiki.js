// Gate for the ColorHub wiki content. Run: node tools/check_wiki.js
// Checks every [[link]] resolves, every file follows its schema, and quotes stay short.
// Files it reads (each optional except colors + seed):
//   data/colors.js        window.DATA          the 101 color names (units + basics)
//   data/wiki-seed.js     window.WIKI_SEED     shared page ids
//   data/wiki-nodes.js    window.WIKI_NODES    concept / pigment / person / work pages
//   data/wiki-colors.js   window.WIKI_COLORS   facets for each color
//   data/stories.js       window.STORIES       guided slide stories
//   data/paintings.js     window.PAINTINGS     painting pages with palettes
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..");
const W = {};
const load = f => { const p = path.join(root, "data", f); if (!fs.existsSync(p)) return false; new Function("window", fs.readFileSync(p, "utf8"))(W); return true; };
load("colors.js"); load("wiki-seed.js");
const has = { nodes: load("wiki-nodes.js"), colors: load("wiki-colors.js"), stories: load("stories.js"), paintings: load("paintings.js") };

const errors = [], warns = [];
const err = m => errors.push(m), warn = m => warns.push(m);
const HEX = /^#[0-9A-F]{6}$/;

const colorNames = new Map();
W.DATA.basics.forEach(([n]) => colorNames.set(n.toLowerCase(), n));
W.DATA.units.forEach(u => u.colors.forEach(c => colorNames.set(c.n.toLowerCase(), c.n)));
const ids = new Set();
W.WIKI_SEED.nodes.forEach(([id]) => ids.add(id));
W.WIKI_SEED.paintings.forEach(([id]) => ids.add(id));
(W.WIKI_NODES || []).forEach(n => ids.add(n.id));
(W.PAINTINGS || []).forEach(p => ids.add(p.id));

const resolves = t => colorNames.has(t.toLowerCase()) || ids.has(t);
function links(where, text) {
  if (typeof text !== "string") return err(`${where}: text is not a string`);
  if (/\[\[[^\]]*$|^[^\[]*\]\]/.test(text)) err(`${where}: broken [[ ]] brackets`);
  for (const m of text.matchAll(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g)) {
    if (!resolves(m[1].trim())) err(`${where}: link [[${m[1]}]] goes nowhere`);
  }
}
const words = s => s.trim().split(/\s+/).length;
const plain = s => s.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, a, b) => b || a);
const maxLen = (where, s, n) => { if (plain(s).length > n) err(`${where}: ${plain(s).length} chars (max ${n})`); };

// ---------- nodes ----------
if (has.nodes) {
  const TYPES = new Set(["concept", "tradition", "movement", "pigment", "person", "work", "culture"]);
  const seen = new Set();
  for (const n of W.WIKI_NODES) {
    const w = `node ${n.id}`;
    if (seen.has(n.id)) err(`${w}: duplicate id`); seen.add(n.id);
    if (!/^[a-z0-9-]+$/.test(n.id || "")) err(`${w}: id must be kebab-case`);
    if (!TYPES.has(n.type)) err(`${w}: bad type ${n.type}`);
    if (!n.title) err(`${w}: missing title`);
    if (!n.dek) err(`${w}: missing dek`); else maxLen(w + " dek", n.dek, 110);
    if (!Array.isArray(n.body) || n.body.length < 1 || n.body.length > 7) err(`${w}: body must have 1-7 paragraphs`);
    (n.body || []).forEach((p, i) => { links(`${w} body[${i}]`, p); maxLen(`${w} body[${i}]`, p, 700); });
    (n.colors || []).forEach(c => { if (!colorNames.has(c.toLowerCase())) err(`${w}: color "${c}" not in colors.js`); });
    if (!Array.isArray(n.sources) || !n.sources.length) err(`${w}: needs sources`);
    if (n.swatches) n.swatches.forEach((s, i) => { if (!HEX.test(s.h)) err(`${w} swatches[${i}]: bad hex ${s.h}`); });
  }
  W.WIKI_SEED.nodes.forEach(([id]) => { if (!seen.has(id)) warn(`seed node ${id} has no page yet`); });
} else warn("data/wiki-nodes.js not written yet");

// ---------- color facets ----------
if (has.colors) {
  const KEYS = new Set(["language", "history", "art", "culture", "symbolism", "poetry", "philosophy", "science", "design"]);
  const NAMED = new Set(["flower", "plant", "fruit", "food", "drink", "gem", "mineral", "metal", "animal", "place", "person", "material", "nature", "dye", "abstract", "unknown"]);
  for (const [name, c] of Object.entries(W.WIKI_COLORS)) {
    const w = `color ${name}`;
    if (!colorNames.has(name.toLowerCase())) err(`${w}: not a color in colors.js`);
    if (!NAMED.has(c.named)) err(`${w}: bad named "${c.named}"`);
    if (!Array.isArray(c.facets) || !c.facets.length || c.facets.length > 6) err(`${w}: needs 1-6 facets`);
    (c.facets || []).forEach((f, i) => { if (!KEYS.has(f.k)) err(`${w} facet ${i}: bad key ${f.k}`); links(`${w} ${f.k}`, f.text); maxLen(`${w} ${f.k}`, f.text, 480); });
    (c.related || []).forEach((r, i) => { if (!colorNames.has((r.to || "").toLowerCase())) err(`${w} related[${i}]: "${r.to}" not a color`); if (!r.why) err(`${w} related[${i}]: needs why`); else maxLen(`${w} related[${i}]`, r.why, 90); });
    if (!Array.isArray(c.sources) || !c.sources.length) err(`${w}: needs sources`);
  }
  for (const n of colorNames.values()) if (!W.WIKI_COLORS[n]) warn(`color ${n} has no wiki entry yet`);
} else warn("data/wiki-colors.js not written yet");

// ---------- stories ----------
if (has.stories) {
  const SHELVES = new Set(["words", "history", "philosophy", "mind", "culture", "harmony", "design", "poetry"]);
  const V = {
    swatch: v => HEX.test(v.h),
    pair: v => HEX.test(v.a && v.a.h) && HEX.test(v.b && v.b.h),
    row: v => Array.isArray(v.items) && v.items.length >= 2 && v.items.length <= 10 && v.items.every(x => HEX.test(x.h)),
    strip: v => HEX.test(v.from) && HEX.test(v.to) && (!v.steps || (v.steps >= 3 && v.steps <= 12)),
    contrast: v => HEX.test(v.inner) && Array.isArray(v.grounds) && v.grounds.length === 2 && v.grounds.every(g => HEX.test(g)),
    wheel: v => HEX.test(v.base) && ["complementary", "analogous", "triadic", "split"].includes(v.scheme),
    quote: v => typeof v.q === "string" && words(v.q) <= 15 && !!v.by,
    type: v => typeof v.word === "string" && v.word.length <= 24,
    big: v => typeof v.n === "string" && v.n.length <= 14,
    quiz: v => typeof v.q === "string" && Array.isArray(v.options) && v.options.length >= 2 && v.options.length <= 4 &&
      v.options.every(o => o.label && (!o.h || HEX.test(o.h))) && Number.isInteger(v.answer) && v.answer >= 0 && v.answer < v.options.length && !!v.explain,
  };
  const seen = new Set();
  for (const s of W.STORIES) {
    const w = `story ${s.id}`;
    if (seen.has(s.id)) err(`${w}: duplicate id`); seen.add(s.id);
    if (!SHELVES.has(s.shelf)) err(`${w}: bad shelf ${s.shelf}`);
    if (!s.title || s.title.length > 40) err(`${w}: title missing or over 40 chars`);
    if (!s.dek) err(`${w}: missing dek`); else maxLen(w + " dek", s.dek, 100);
    if (!Array.isArray(s.cover) || s.cover.length < 2 || s.cover.length > 5 || !s.cover.every(h => HEX.test(h))) err(`${w}: cover needs 2-5 hex`);
    if (!Array.isArray(s.slides) || s.slides.length < 4 || s.slides.length > 9) err(`${w}: needs 4-9 slides`);
    (s.slides || []).forEach((sl, i) => {
      const v = sl.v || {};
      if (!V[v.t]) err(`${w} slide ${i}: unknown visual ${v.t}`);
      else if (!V[v.t](v)) err(`${w} slide ${i}: ${v.t} visual is malformed`);
      if (v.t === "quiz") { links(`${w} slide ${i} explain`, v.explain); maxLen(`${w} slide ${i} explain`, v.explain, 240); }
      if (sl.text != null) { links(`${w} slide ${i}`, sl.text); maxLen(`${w} slide ${i}`, sl.text, 240); }
      else if (v.t !== "quiz") err(`${w} slide ${i}: needs text`);
      if (v.label) maxLen(`${w} slide ${i} label`, v.label, 30);
    });
    (s.colors || []).forEach(c => { if (!colorNames.has(c.toLowerCase())) err(`${w}: color "${c}" not in colors.js`); });
    (s.links || []).forEach(id => { if (!resolves(id)) err(`${w}: link ${id} goes nowhere`); });
    if (!Array.isArray(s.sources) || !s.sources.length) err(`${w}: needs sources`);
  }
} else warn("data/stories.js not written yet");

// ---------- paintings ----------
if (has.paintings) {
  const seedIds = new Set(W.WIKI_SEED.paintings.map(p => p[0]));
  for (const p of W.PAINTINGS) {
    const w = `painting ${p.id}`;
    if (!seedIds.has(p.id)) warn(`${w}: not in the seed list (fine if it is a deliberate addition)`);
    ["title", "artist", "year", "img", "commons", "license"].forEach(k => { if (!p[k]) err(`${w}: missing ${k}`); });
    if (p.img && !fs.existsSync(path.join(root, p.img))) err(`${w}: image ${p.img} missing`);
    if (p.map && !fs.existsSync(path.join(root, p.map))) err(`${w}: map ${p.map} missing`);
    if (!Array.isArray(p.palette) || p.palette.length < 4 || p.palette.length > 8) err(`${w}: palette needs 4-8 colors`);
    const sum = (p.palette || []).reduce((a, c) => a + (c.share || 0), 0);
    if (Math.abs(sum - 1) > .02) err(`${w}: palette shares sum to ${sum.toFixed(3)}`);
    (p.palette || []).forEach((c, i) => {
      if (!HEX.test(c.h)) err(`${w} palette[${i}]: bad hex`);
      if (!c.name) err(`${w} palette[${i}]: needs a precise name`);
      if (c.vocab && !colorNames.has(c.vocab.toLowerCase())) err(`${w} palette[${i}]: vocab "${c.vocab}" not in colors.js`);
    });
    if (p.note) { links(`${w} note`, p.note); maxLen(`${w} note`, p.note, 600); }
  }
} else warn("data/paintings.js not written yet");

const short = process.argv.includes("--quiet");
if (!short) warns.forEach(m => console.log("warn  " + m));
errors.forEach(m => console.log("FAIL  " + m));
console.log(`wiki check: ${errors.length} failures, ${warns.length} warnings` +
  ` (nodes ${has.nodes ? W.WIKI_NODES.length : 0}, color entries ${has.colors ? Object.keys(W.WIKI_COLORS).length : 0}, stories ${has.stories ? W.STORIES.length : 0}, paintings ${has.paintings ? W.PAINTINGS.length : 0})`);
process.exit(errors.length ? 1 : 0);
