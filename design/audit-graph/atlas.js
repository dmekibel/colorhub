"use strict";
// The atlas (design/audit-graph/PLAN.md, stage 1): measures ColorHub as a graph and lists what is silently broken,
// unused, unconnected or missing. Read-only. Usage: node design/audit-graph/atlas.js [ROOT] [--json out.json]
// ROOT defaults to the repo this file sits in. Every finding carries evidence (file:line, a count, examples).
const fs = require("fs"), path = require("path"), cp = require("child_process");
const ROOT = path.resolve(process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : path.join(__dirname, "..", ".."));
const outArg = (() => { const i = process.argv.indexOf("--json"); return i > 0 ? process.argv[i + 1] : null; })();
const acorn = require(path.join(ROOT, "tools", "node_modules", "acorn"));
const R = p => path.join(ROOT, p), ex = p => fs.existsSync(R(p)), rd = p => fs.readFileSync(R(p), "utf8");
const J = p => { try { return JSON.parse(rd(p)); } catch (e) { return null; } };
const ls = d => ex(d) ? fs.readdirSync(R(d)) : [];
const JS = [...ls("js").filter(f => f.endsWith(".js")).map(f => "js/" + f), ...ls("js/games").filter(f => f.endsWith(".js")).map(f => "js/games/" + f)];
const SRC = Object.fromEntries(JS.map(f => [f, rd(f)]));
const lineOf = (src, idx) => src.slice(0, idx).split("\n").length;
const F = [];   // findings: { cls, sev (1-3), title, n, evidence: [..], note }
const add = (cls, sev, title, n, evidence, note) => F.push({ cls, sev, title, n, evidence: (evidence || []).slice(0, 12), note: note || "" });

// ---------- 1. silently disabled features: typeof-guarded names that no file defines (tools/undef_scan.js WARN) ----------
try {
  const r = cp.spawnSync("node", ["tools/undef_scan.js"], { cwd: ROOT, encoding: "utf8" });
  const warns = (r.stdout + r.stderr).split("\n").filter(l => /WARN/.test(l));
  if (warns.length) add("dead-feature", 3, "Features hidden behind a typeof guard for a function that no longer exists", warns.length, warns.map(s => s.trim()), "The guard stops a crash and hides that the feature is gone.");
} catch (e) {}

// ---------- 2. data the code asks for that isn't there (the articles-lite.json class) ----------
{
  const miss = [], seen = new Set();
  for (const [f, s] of Object.entries(SRC)) {
    const re = /["'`]((?:data|art|og|img|c|p)\/[A-Za-z0-9_\-\/.${}]*?\.(?:json|js|png|jpg|webp|svg))["'`]/g;
    let m;
    while ((m = re.exec(s))) {
      const p = m[1]; if (seen.has(p)) continue; seen.add(p);
      if (!p.includes("${")) { if (!ex(p)) miss.push(`${p}  (${f}:${lineOf(s, m.index)})`); continue; }
      const dir = path.dirname(p.split("${")[0] + "x"), pat = new RegExp("^" + path.basename(p).replace(/[.]/g, "\\.").replace(/\$\{[^}]*\}/g, ".+") + "$");
      if (!ex(dir) || (!p.slice(dir.length + 1).includes("/") && !ls(dir).some(x => pat.test(x)))) miss.push(`${p}  (${f}:${lineOf(s, m.index)}; no matching file in ${dir}/)`);
    }
  }
  // index.html script and link tags
  const html = rd("index.html");
  for (const m of html.matchAll(/(?:src|href)="([^"?#]+\.(?:js|css))/g)) if (!/^https?:/.test(m[1]) && !ex(m[1])) miss.push(`${m[1]}  (index.html)`);
  if (miss.length) add("dead-feature", 3, "Files the app fetches that do not exist (the feature shows nothing, silently)", miss.length, miss);
}

// ---------- 3. the code graph: top-level names nobody uses ----------
const AST = {}, DECL = new Map(), REFS = new Map(), STRS = new Map();
const bump = (m, k, f) => { const e = m.get(k) || {}; e[f] = (e[f] || 0) + 1; m.set(k, e); };
const isN = v => v && typeof v === "object" && typeof v.type === "string";
function walk(n, f, parent, key) {
  if (!isN(n)) return;
  if (n.type === "Identifier") {
    const skip = (parent && parent.type === "MemberExpression" && key === "property" && !parent.computed) ||
      (parent && (parent.type === "Property" || parent.type === "MethodDefinition" || parent.type === "PropertyDefinition") && key === "key" && !parent.computed && !parent.shorthand);
    if (!skip) bump(REFS, n.name, f);
  }
  if (n.type === "Literal" && typeof n.value === "string" && /^[A-Za-z_$][\w$]*$/.test(n.value)) bump(STRS, n.value, f);
  if (n.type === "TemplateElement" && n.value && n.value.cooked) for (const w of n.value.cooked.match(/[A-Za-z_$][\w$]*/g) || []) bump(STRS, w, f);
  for (const k of Object.keys(n)) { if (k === "loc") continue; const v = n[k]; if (Array.isArray(v)) v.forEach(x => walk(x, f, n, k)); else if (isN(v)) walk(v, f, n, k); }
}
for (const f of JS) {
  try { AST[f] = acorn.parse(SRC[f], { ecmaVersion: "latest", sourceType: "script", locations: true, allowReturnOutsideFunction: true }); } catch (e) { add("parse", 3, `Cannot parse ${f}`, 1, [e.message]); continue; }
  for (const st of AST[f].body) {
    if (st.type === "FunctionDeclaration" && st.id) DECL.set(st.id.name, { f, line: st.loc.start.line, kind: "function", size: st.loc.end.line - st.loc.start.line + 1 });
    if (st.type === "VariableDeclaration") st.declarations.forEach(d => d.id.type === "Identifier" && DECL.set(d.id.name, { f, line: d.loc.start.line, kind: d.init && /Function/.test(d.init.type) ? "function" : "value", size: d.loc.end.line - d.loc.start.line + 1 }));
  }
  walk(AST[f], f);
}
{
  const html = rd("index.html"), dataTxt = ls("data").filter(x => x.endsWith(".js")).map(x => rd("data/" + x).slice(0, 400000)).join("\n");
  const dead = [];
  for (const [name, d] of DECL) {
    const refs = Object.values(REFS.get(name) || {}).reduce((a, b) => a + b, 0) - 1;   // minus the declaration itself
    const strs = Object.values(STRS.get(name) || {}).reduce((a, b) => a + b, 0);
    if (refs <= 0 && !strs && !html.includes(name) && !dataTxt.includes(name)) dead.push({ name, ...d });
  }
  dead.sort((a, b) => b.size - a.size);
  const fns = dead.filter(d => d.kind === "function"), lines = fns.reduce((a, d) => a + d.size, 0);
  add("dead-code", 2, "Top-level functions that nothing calls (by name, string or HTML)", fns.length, fns.map(d => `${d.name}  ${d.f}:${d.line}  (${d.size} lines)`), `${lines} lines in all. Big ones are usually a feature that lost its door, not junk.`);
  const vals = dead.filter(d => d.kind !== "function");
  if (vals.length) add("dead-code", 1, "Top-level constants that nothing reads", vals.length, vals.map(d => `${d.name}  ${d.f}:${d.line}`));
  // whole files whose top-level names are used by no other file
  const lonely = JS.filter(f => {
    const mine = [...DECL].filter(([, d]) => d.f === f).map(([n]) => n);
    return mine.length && !mine.some(n => Object.keys(REFS.get(n) || {}).some(g => g !== f) || Object.keys(STRS.get(n) || {}).some(g => g !== f) || html.includes(n + "("));
  });
  if (lonely.length) add("dead-code", 2, "Script files that no other file calls into (an island, or wired only by its own listeners)", lonely.length, lonely);
}

// ---------- 4. the Learner Model loop: which signals are written, which readers anyone uses ----------
{
  const L = SRC["js/learner.js"] || "";
  const types = (/LN_TYPES\s*=\s*\[([^\]]*)\]/.exec(L) || [, ""])[1].match(/"[^"]+"/g)?.map(s => s.slice(1, -1)) || [];
  const writes = {};
  for (const [f, s] of Object.entries(SRC)) for (const m of s.matchAll(/type:\s*"([a-z]+)"/g)) if (types.includes(m[1]) && /learnerLog|arLog|lnLog|Log\(/.test(s.slice(Math.max(0, m.index - 200), m.index))) (writes[m[1]] = writes[m[1]] || new Set()).add(f);
  const readers = ["knowState", "confusions", "eyeThreshold", "interests", "trail", "seenIn", "edgeOfMap", "relMark", "relMarkHTML"];
  const use = readers.map(r => [r, Object.keys(REFS.get(r) || {}).filter(f => f !== "js/learner.js")]);
  const ev = [...types.map(t => `signal "${t}": written by ${writes[t] ? [...writes[t]].map(x => path.basename(x)).join(", ") : "NOBODY"}`), ...use.map(([r, fs_]) => `reader ${r}(): used by ${fs_.length ? fs_.map(x => path.basename(x)).join(", ") : "NOBODY"}`)];
  const holes = types.filter(t => !writes[t]).length + use.filter(([, u]) => !u.length).length;
  add("open-loop", holes ? 3 : 1, "The Learner Model loop (what the app records about you, and who reads it back)", holes, ev, "A signal nobody writes, or a reader nobody calls, is a loop that never closes.");
  // which screens log nothing at all: files that show UI (call show() or build HTML) but never write a signal
  const quiet = JS.filter(f => /\bshow\(/.test(SRC[f]) && !/learnerLog|arLog\(|lnLog/.test(SRC[f]));
  add("open-loop", 2, "Screens that teach you nothing about the person: they build a screen but never write a Learner Model signal", quiet.length, quiet.map(f => path.basename(f)));
}

// ---------- 5. saved state: keys written and never read, read and never written ----------
{
  const w = {}, r = {};
  for (const [f, s] of Object.entries(SRC)) for (const m of s.matchAll(/\bS\.([A-Za-z_]\w*)(\s*(?:=(?![=>])|\+\+|--|[-+*/|&?]{1,2}=)|\.push\(|\[[^\]]*\]\s*=(?!=))?/g)) ((m[2] ? w : r)[m[1]] = (m[2] ? w : r)[m[1]] || new Set()).add(f);
  const wo = Object.keys(w).filter(k => !r[k]), ro = Object.keys(r).filter(k => !w[k] && !/^(v|cards|gym|taste|palettes)$/.test(k));
  if (wo.length) add("dead-state", 2, "Saved keys the app writes but never reads back", wo.length, wo.map(k => `S.${k}  (${[...w[k]].map(x => path.basename(x)).join(", ")})`));
  if (ro.length) add("dead-state", 1, "Saved keys the app reads but nothing ever writes (always the default)", ro.length, ro.map(k => `S.${k}  (${[...r[k]].map(x => path.basename(x)).join(", ")})`), "Some are written by migrateState or a spread; check before acting.");
}

// ---------- 6. dark data: fields we compute and ship but no screen reads ----------
{
  const allJs = Object.values(SRC).join("\n");
  const used = k => new RegExp(`(?:\\.${k}\\b|["'\`]${k}["'\`]|\\b${k}\\s*[:,}]|\\[\\s*"${k}"\\s*\\])`).test(allJs);
  const keysOf = (o, pre, out, depth) => { if (!o || typeof o !== "object" || Array.isArray(o) || depth > 2) return out; for (const [k, v] of Object.entries(o)) { if (/^\d/.test(k)) continue; out.set(pre + k, v); keysOf(v, pre + k + ".", out, depth + 1); } return out; };
  const probes = [["data/graph/nodes-c.json", d => (Array.isArray(d) ? d : Object.values(d.nodes || d)).slice(0, 80)], ["data/graph/fieldnotes/c.json", d => d.slice(0, 80)], ["data/analysis/index.json", d => [d]], ["data/analysis/artists/" + (ls("data/analysis/artists")[0] || "x"), d => [d]], ["data/analysis/paintings-000.json", d => (Array.isArray(d) ? d : Object.values(d)).slice(0, 40)]];
  for (const [p, pick] of probes) {
    const d = J(p); if (!d) continue;
    const keys = new Map(); pick(d).forEach(o => keysOf(o, "", keys, 0));
    const dark = [...keys].filter(([k]) => !used(k.split(".").pop()) && k.split(".").pop().length > 1);
    if (dark.length) add("dark-data", 2, `Fields shipped in ${p.replace(/-c\.json|\/c\.json|-000\.json/, "*")} that no js file reads`, dark.length, dark.map(([k, v]) => `${k} = ${JSON.stringify(v).slice(0, 70)}`), "Computed, downloaded, never shown: either show it or stop shipping it.");
  }
  // whole data files no js mentions
  const dataFiles = ls("data").filter(x => /\.(js|json)$/.test(x));
  const unused = dataFiles.filter(x => !allJs.includes(x.replace(/\.(js|json)$/, "")) && !rd("index.html").includes(x));
  if (unused.length) add("dark-data", 2, "Data files in data/ that no script or page mentions", unused.length, unused.map(x => `data/${x} (${Math.round(fs.statSync(R("data/" + x)).size / 1024)} KB)`));
}

// ---------- 7. coverage: every named color, and what it has ----------
const COV = {};
{
  const names = J("data/graph/names.json") || [];
  const nodes = {}; ls("data/graph").filter(x => /^nodes-/.test(x)).forEach(x => { let d = J("data/graph/" + x); d = d && (d.nodes || d); (Array.isArray(d) ? d : Object.values(d || {})).forEach(n => n && n.s && (nodes[n.s] = n)); });
  const fn = {}; ls("data/graph/fieldnotes").forEach(x => (J("data/graph/fieldnotes/" + x) || []).forEach(r => r && r.s && (fn[r.s] = r)));
  const arts = new Set(), artPic = {}; const AFILES = ls("data/articles").filter(x => x.endsWith(".json") && !/^(index|link-map)\.json$/.test(x));
  const slug = s => String(s).normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const imgTxt = ex("data/images.js") ? rd("data/images.js") : "";
  const imgKeys = new Set([...imgTxt.matchAll(/^\s*"([^"]+)"\s*:\s*\{/gm)].map(m => slug(m[1])));
  for (const a of AFILES) {
    const art = J("data/articles/" + a); if (!art) continue;
    const s = art.slug || a.slice(0, -5); arts.add(s); (art.names || []).forEach(n => arts.add(slug(n)));
    const body = JSON.stringify(art);
    artPic[s] = { own: imgKeys.has(s), refs: (body.match(/\[\[(painting|art|gem|flower|look|film):/g) || []).length, words: art.words || 0 };
  }
  const core = new Set((J("data/core-names.json") || []).map(e => slug(e.n)));
  const poems = J("data/poems-index.json"), poemSet = new Set(((poems && poems.colors) || []).map(c => slug(c[0])));
  const pages = new Set(ls("c"));
  let n = 0; const c = { article: 0, image: 0, paintings: 0, poems: 0, page: 0, learn: 0, deadEnd: 0, learnNoArticle: 0 }, deadEx = [], learnEx = [];
  for (const r of names) {
    const s = r[0], nd = nodes[s] || {}, f = fn[s] || {}; n++;
    const has = { article: arts.has(s), image: imgKeys.has(s), paintings: !!(f.ar && f.ar.nph > 0), poems: poemSet.has(s), page: pages.has(s), learn: core.has(s) };
    Object.keys(has).forEach(k => has[k] && c[k]++);
    if (!has.article && !has.paintings) { c.deadEnd++; if (deadEx.length < 12) deadEx.push(`${r[1]} (${nd.tier || "?"})`); }
    if (has.learn && !has.article) { c.learnNoArticle++; if (learnEx.length < 12) learnEx.push(r[1]); }
  }
  COV.colors = { n, ...c };
  add("coverage", 3, "Color pages with nothing to read and no painting that holds it (only field notes and look-alikes)", c.deadEnd, deadEx, `${c.deadEnd} of ${n} color pages are dead ends apart from the field notes and look-alikes.`);
  add("coverage", 3, "Learn-layer words (the ones the app teaches) that have no article", c.learnNoArticle, learnEx, `${c.learnNoArticle} of ${c.learn} words a learner is taught have no story to read.`);
  const picless = Object.entries(artPic).filter(([, p]) => !p.own && !p.refs);
  COV.articles = { n: AFILES.length, ownImage: Object.values(artPic).filter(p => p.own).length, withRefs: Object.values(artPic).filter(p => p.refs).length, noPictureSource: picless.length };
  add("coverage", 2, "Articles with no painting, gem, flower, look or film reference in the text (no picture to open with unless an auto-figure is close enough)", picless.length, picless.slice(0, 12).map(([s, p]) => `${s} (${p.words} words)`), `${picless.length} of ${AFILES.length}: these depend entirely on auto-figures from the archive, if any are close enough.`);
  const wern = Object.values(nodes).filter(x => x.werner && (x.werner.animal || x.werner.vegetable || x.werner.mineral));
  if (!/\.werner\b/.test(Object.values(SRC).join("\n"))) add("dark-data", 3, "Werner's 1821 animal / plant / mineral examples for a color, shipped and never shown", wern.length, wern.slice(0, 8).map(x => `${x.n}: ${["animal", "vegetable", "mineral"].map(k => x.werner[k]).filter(Boolean).join(" · ")}`), "The naturalists' color book (Werner, 1821) gave each color a real example in nature.");
  const rp = Object.entries(fn).filter(([, r]) => r.ar && r.ar.rp_ && Object.keys(r.ar.rp_).length);
  if (!/\brp_\b/.test(Object.values(SRC).join("\n"))) add("dark-data", 3, "Example paintings where a color plays the shadow, mid-tone, light, accent or a hidden note: computed for each color, never shown", rp.length, rp.slice(0, 6).map(([s, r]) => `${s}: ${Object.entries(r.ar.rp_).map(([k, v]) => k + " " + v).join(", ")}`), "One color, five roles, five real paintings: the 'never one palette' rule, already computed.");
  add("coverage", 1, "Crawlable static pages (c/<slug>/) for named colors", n - c.page, [], `${c.page} of ${n} named colors have a static page for search engines.`);
}

// ---------- report ----------
F.sort((a, b) => b.sev - a.sev || b.n - a.n);
const md = [`# Atlas: ColorHub measured as a graph`, ``, `Snapshot: ${cp.spawnSync("git", ["log", "--oneline", "-1"], { cwd: ROOT, encoding: "utf8" }).stdout.trim()}. ${JS.length} script files, ${Object.values(SRC).reduce((a, s) => a + s.split("\n").length, 0).toLocaleString()} lines. Generated by design/audit-graph/atlas.js; severity 3 = something a person can see is broken or missing.`, ``,
  `| Sev | Class | Finding | Count |`, `|---|---|---|---|`, ...F.map(x => `| ${x.sev} | ${x.cls} | ${x.title} | ${x.n} |`), ``,
  ...F.map(x => [`## ${x.title}`, `*${x.cls}, severity ${x.sev}, count ${x.n}.* ${x.note}`, ``, ...x.evidence.map(e => `- ${e}`), ``].join("\n"))].join("\n");
fs.writeFileSync(path.join(__dirname, "ATLAS.md"), md);
if (outArg) fs.writeFileSync(outArg, JSON.stringify({ findings: F, coverage: COV }, null, 1));
console.log(F.map(x => `${x.sev}  ${x.cls.padEnd(13)} ${String(x.n).padStart(5)}  ${x.title}`).join("\n"));
console.log("\ncoverage:", JSON.stringify(COV));
