// node tools/article_leads.js [--list] [--slug <slug>]
// Reports how many of the articles in data/articles/ get a lead picture (js/article-refs.js arfLeadPick), and which kind:
//   own image (data/images.js) -> the painting that holds the color most -> the closest gem or flower, each inside the same honesty
//   rule as every other figure (CIEDE2000 <= 15; a painting needs >= 2% of the canvas). Then lists, by tier and by color family,
//   the articles that still get none. Runs the real functions in a sandbox, reading the datasets from disk.
// --list prints every article's pick; --slug <slug> prints one.
const fs = require("fs"), path = require("path"), vm = require("vm");
const root = path.join(__dirname, "..");
const args = process.argv.slice(2), listAll = args.includes("--list"), only = args.includes("--slug") ? args[args.indexOf("--slug") + 1] : null;
const readJSON = f => { try { return JSON.parse(fs.readFileSync(path.join(root, f), "utf8")); } catch (e) { return null; } };
const readTxt = f => fs.readFileSync(path.join(root, f), "utf8");
const norm = s => String(s).normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const cm = require("./colormath.js");

const core = readJSON("data/core-names.json");
const diskOK = k => /^data\/(graph\/(nodes|edges)-[a-z_]\.json|gallery\/ids\.txt|gallery\/d\/\d+\.json|analysis\/artists\/[a-z0-9-]+\.json)$/.test(k) && fs.existsSync(path.join(root, k));
const table = { "data/graph/names.json": readJSON("data/graph/names.json"), "data/graph/aliases.json": readJSON("data/graph/aliases.json"),
  "data/aliases.json": readJSON("data/aliases.json"), "data/articles/link-map.json": readJSON("data/articles/link-map.json"), "data/articles/index.json": readJSON("data/articles/index.json") };
const sandbox = {
  console, Promise, setTimeout, Math, Date, JSON, Map, Set, Array, Object, String, Number, RegExp, Error, Float32Array, Uint8Array, Int16Array,
  lab: cm.lab, de2000: cm.de2000, toast: () => {}, icon: () => "",
  pctMatch: (n, decimal) => { const m = Math.max(0, 100 - n); return m >= 100 ? "100% match" : `${decimal || m > 99 ? m.toFixed(1) : Math.round(m)}% match`; },
  esc: s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])),
  ink: () => "dark", routeSlug: norm, routeColor: () => null, CORE_NAMES: core, loadCoreNames: () => Promise.resolve(core), BYNAME: new Map(), lookDiff: () => "", lookalikes: () => [],
  loadWiki: () => Promise.resolve(true),
  fetch: url => {
    const k = String(url).split("?")[0];
    if (k in table) return Promise.resolve({ ok: true, json: () => Promise.resolve(table[k]) });
    if (diskOK(k)) { const t = readTxt(k); return Promise.resolve({ ok: true, json: () => Promise.resolve(JSON.parse(t)), text: () => Promise.resolve(t) }); }
    return Promise.resolve({ ok: false, json: () => Promise.resolve(null), text: () => Promise.resolve(null) });
  },
};
sandbox.globalThis = sandbox; sandbox.window = sandbox;
vm.createContext(sandbox);
const run = (code, f) => vm.runInContext(code, sandbox, { filename: f });
run(readTxt("js/article.js"), "js/article.js");
run(readTxt("js/article-refs.js"), "js/article-refs.js");
["data/gems.js", "data/gem-images.js", "data/botany.js", "data/botany-images.js", "data/images.js"].forEach(f => run(readTxt(f), f));

// the gallery: the real glBuild / glDE / npGalleryHits, cut out of js/gallery.js and js/names.js
const between = (src, a, b) => { const i = src.indexOf(a), j = src.indexOf(b, i + 1); if (i < 0 || j < 0) throw new Error("marker not found: " + a); return src.slice(i, j); };
const gal = readTxt("js/gallery.js"), nm = readTxt("js/names.js"), head = readJSON("data/gallery/index.json");
run(`let GAL = null; const GL_UNDATED = -32768; const GAL_DIR = "data/gallery/";
${between(gal, "// sRGB -> linear", "function glShard")}
${between(gal, "// CIEDE2000 on plain numbers", "// ---------- scoring")}
const glHex = (i, j) => { const k = (i * 6 + j) * 3, c = GAL.rgb; return "#" + ((1 << 24) | c[k] << 16 | c[k + 1] << 8 | c[k + 2]).toString(16).slice(1).toUpperCase(); };
const glPal = i => Array.from({ length: 6 }, (_, j) => ({ h: glHex(i, j), share: GAL.sh[i * 6 + j] }));
const glYear = i => { const y = GAL.year[i]; return y === GL_UNDATED ? "" : y < 0 ? \`\${-y} BCE\` : String(y); };
${between(gal, "// The painting inside its frame", "const glYear")}
${gal.split("\n").find(l => l.startsWith("const glBig"))}
${between(nm, "function npGalleryHits", "function npPaintingsSection")}
const SHARDS = new Map();
const glDetail = i => { const k = Math.floor(i / GAL.shard); if (!SHARDS.has(k)) SHARDS.set(k, JSON.parse(__shard(k))); const r = SHARDS.get(k)[i % GAL.shard];
  return Promise.resolve(r && { id: r[0], t: r[1] || "Untitled", a: r[2], co: r[3], mv: r[4], img: r[5], rec: r[6], li: r[7], wi: r[8], hi: r[9] || "", pl: r[10] || "", crop: r[11] || null }); };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
`, "gallery pieces");
sandbox.__shard = k => readTxt("data/gallery/d/" + String(k).padStart(3, "0") + ".json");
sandbox.__head = head; sandbox.__buf = new Uint8Array(fs.readFileSync(path.join(root, "data/gallery/index.bin")));
run(`GAL = glBuild(__head, __buf); const loadGallery = () => Promise.resolve(GAL);`, "gallery build");

const ar = run(`({ arLoadNames, arColor, arfLeadPick, arfLeadHTML })`, "api");
const fam = new Map();
for (const s of "abcdefghijklmnopqrstuvwxyz_") { (readJSON(`data/graph/nodes-${s}.json`) || []).forEach(n => fam.set(n.s, n.fam)); }

(async () => {
  await ar.arLoadNames();
  const files = fs.readdirSync(path.join(root, "data/articles")).filter(f => f.endsWith(".json") && f !== "link-map.json" && f !== "index.json").map(f => f.slice(0, -5)).filter(s => !only || s === only);
  const rows = [], t0 = Date.now();
  for (const slug of files) {
    const art = readJSON(`data/articles/${slug}.json`); if (!art) continue;
    art.slug = art.slug || slug; art.names = art.names || [art.name];
    const self = ar.arColor(slug) || (art.hex ? { slug, n: art.name, h: art.hex } : null);
    if (!self) { rows.push({ slug, tier: art.tier || "?", fam: "?", kind: "nocolor" }); continue; }
    const t = await ar.arfLeadPick(art, self).catch(() => null);
    rows.push({ slug, tier: art.tier || "(none)", fam: fam.get(slug) || fam.get(self.slug) || "(no family)", kind: t ? t.kind : "none", name: t && t.name, pct: t && t.pctText, cover: t && t.cover });
  }
  const by = (arr, f) => arr.reduce((m, r) => (m[f(r)] = (m[f(r)] || 0) + 1, m), {});
  const got = rows.filter(r => r.kind !== "none" && r.kind !== "nocolor"), none = rows.filter(r => r.kind === "none" || r.kind === "nocolor");
  const kinds = by(got, r => r.kind);
  if (listAll || only) rows.forEach(r => console.log(`${r.slug.padEnd(34)} ${r.tier.padEnd(14)} ${r.kind.padEnd(9)} ${r.name || ""} ${r.pct || ""}`));
  console.log(`\n${got.length} of ${rows.length} articles get a lead picture (${(100 * got.length / rows.length).toFixed(1)}%), ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  console.log("by kind:", Object.entries(kinds).map(([k, n]) => `${k} ${n}`).join(", ") + `, none ${none.length}`);
  const tab = (f, label) => {
    const all = by(rows, f), no = by(none, f);
    console.log(`\nstill without one, by ${label} (none / all):`);
    Object.keys(no).sort((a, b) => no[b] - no[a]).forEach(k => console.log(`  ${String(k).padEnd(24)} ${String(no[k]).padStart(4)} / ${all[k]}`));
  };
  tab(r => r.tier, "tier"); tab(r => r.fam, "color family");
  if (args.includes("--none")) console.log("\n" + none.map(r => r.slug).join("\n"));
})();
