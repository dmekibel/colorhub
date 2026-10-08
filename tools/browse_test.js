// Tests for js/browse.js (Explore 2.0, lane L16) against the real shipped data (data/gallery + data/facets).
// Covers: facet counts are consistent (a value's count equals the size of the result with that value picked),
// combined filters intersect, looser color tolerance never loses paintings, the jump bar maps to sections, and
// the facet index is in step with the gallery. Run: node tools/browse_test.js
const fs = require("fs"), path = require("path"), vm = require("vm");
const ROOT = path.join(__dirname, "..");
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8");
const core = read("js/core.js");
const slice = (a, b) => core.slice(core.indexOf(a), core.indexOf(b));

let pass = 0, fail = 0;
const ok = (cond, label) => { cond ? pass++ : fail++; if (!cond) console.log("FAIL  " + label); };

const ctx = vm.createContext({ window: {}, Math, String, Array, Object, Map, Set, JSON, Number, Date, isFinite, Float32Array, Int32Array, Int16Array, Uint8Array, Uint16Array, Error, console });
vm.runInContext("const clamp = (v, a, b) => Math.max(a, Math.min(b, v)); const sv = () => ''; const nameOf = h => ({ text: h });", ctx);
vm.runInContext(slice("// ---------- color math", "// ---------- percent display"), ctx);
vm.runInContext(read("js/gallery.js"), ctx);
vm.runInContext(read("js/browse.js"), ctx);
const run = code => vm.runInContext(code, ctx);

const head = JSON.parse(read("data/gallery/index.json"));
ctx.__head = head; ctx.__bin = new Uint8Array(fs.readFileSync(path.join(ROOT, "data/gallery/index.bin")));
ctx.__meta = JSON.parse(read("data/facets/facets.json")); ctx.__fb = new Uint8Array(fs.readFileSync(path.join(ROOT, "data/facets/facets.bin")));
run("var G = glBuild(__head, __bin); var F = xbBuild(G, __meta, __fb);");
const N = run("F.N");
const q = f => run(`xbRun(F, Object.assign(xbFresh(), ${JSON.stringify(f)}))`);
const n = f => q(f).list.length;
const sum = a => Array.from(a).reduce((x, y) => x + y, 0);

// ---------- 0. the index is in step ----------
ok(N === head.n && run("F.meta.n") === N, `facets cover the whole gallery (${N})`);
ok(n({}) === N, "no filter returns every painting");
ok(run("F.meta.artists.length") > 5000 && run("F.meta.artists.filter(a => a[3]).length") === 837, "artists listed, 837 with painter pages");

// ---------- 1. facet counts are consistent ----------
{
  const r = q({});
  for (const dim of ["key", "chroma", "temp", "contrast", "size", "mus"]) ok(sum(r.counts[dim]) === N, `${dim} counts add up to the whole archive`);
  ok(sum(r.counts.when) === N, "decade counts (with undated) add up");
  // each value's count = the size of the result with that value chosen
  const checks = [["key", 0], ["key", 2], ["chroma", 2], ["temp", 0], ["contrast", 1], ["size", 0], ["mus", 3]];
  checks.forEach(([dim, v]) => ok(r.counts[dim][v] === n({ [dim]: v }), `count for ${dim}=${v} matches its result (${r.counts[dim][v]})`));
  const co = run("F.meta.countries.indexOf('Netherlands') + 1");
  ok(r.counts.co[co] === n({ co }) && n({ co }) > 4000, "country count matches its result");
  // a facet's own counts ignore its own filter but honor the others
  const r2 = q({ key: 0, mus: 3 });
  ok(r2.counts.key[0] === r2.list.length && r2.counts.key[1] === n({ key: 1, mus: 3 }), "key counts under a museum filter");
  ok(r2.counts.mus[3] === r2.list.length && r2.counts.mus[0] === n({ key: 0, mus: 0 }), "museum counts under a key filter");
  const rc = q({ hexes: ["#2E5A9E"], tol: 8, cover: 5 });
  ok(rc.counts.color === N, "color count with only the color active = everything that passes the rest");
  const rc2 = q({ hexes: ["#2E5A9E"], tol: 8, cover: 5, key: 0 });
  ok(rc2.counts.key[0] === rc2.list.length && rc2.counts.key[2] === n({ hexes: ["#2E5A9E"], tol: 8, cover: 5, key: 2 }), "key counts under a color filter");
  ok(rc2.counts.color === n({ key: 0 }), "the color facet's count = the result without the color");
}

// ---------- 2. combined filters intersect ----------
{
  const set = f => new Set(Array.from(q(f).list));
  const pairs = [[{ key: 0 }, { temp: 2 }], [{ y0: 1600, y1: 1699 }, { co: run("F.meta.countries.indexOf('Netherlands') + 1") }],
    [{ hexes: ["#B22222"], tol: 10, cover: 10 }, { chroma: 2 }], [{ size: 0 }, { mus: 1 }]];
  pairs.forEach(([a, b]) => {
    const A = set(a), B = set(b), AB = set({ ...a, ...b });
    const inter = [...A].filter(i => B.has(i));
    ok(AB.size === inter.length && inter.every(i => AB.has(i)), `${JSON.stringify(a)} AND ${JSON.stringify(b)} = the intersection (${AB.size})`);
  });
}

// ---------- 3. color: looser is never smaller; coverage stays a share ----------
{
  let prev = -1, monotone = true;
  for (const tol of [1, 2, 3, 5, 8, 10, 12, 15]) { const k = n({ hexes: ["#6F8FAF"], tol, cover: 0 }); if (k < prev) monotone = false; prev = k; }
  ok(monotone, "a looser 'how close' never finds fewer paintings");
  let prevC = 1e9, mono2 = true;
  for (const cover of [0, 1, 2, 5, 10, 20, 35, 50]) { const k = n({ hexes: ["#6F8FAF"], tol: 8, cover }); if (k > prevC) mono2 = false; prevC = k; }
  ok(mono2, "asking for more of the painting never finds more");
  const c = run("xbCoverage(F, Object.assign(xbFresh(), { hexes: ['#6F8FAF'], tol: 15 }))");
  ok(Array.from(c.cov).every(v => v >= 0 && v <= 1.0001), "coverage is between 0 and 100% of the canvas");
}

// ---------- 4. the jump bar maps to sections ----------
{
  run("var R = xbRun(F, xbFresh());");
  const date = run("xbSections(F, R, 'date')"), dj = run("xbJumpTargets(xbSections(F, R, 'date'))");
  ok(date.length > 40, `date sort makes decade sections (${date.length})`);
  ok(dj.every(t => { const s = date[t.sec]; return s && s.short === t.label; }), "every date jump target lands on a section with its label");
  ok(dj.every((t, k) => k === 0 || t.sec > dj[k - 1].sec), "jump targets run in section order");
  ok(date.every((s, k) => dj.some(t => t.sec <= k)), "every section is at or after some jump target");
  ok(sum(date.map(s => s.items.length)) === N, "date sections hold every painting once");
  const pa = run("xbSections(F, R, 'painter')"), pj = run("xbJumpTargets(xbSections(F, R, 'painter'))");
  ok(pj.length >= 20 && pj.every(t => /^[A-Z#?]$/.test(t.label)), `painter jump bar is letters (${pj.map(t => t.label).join("")})`);
  ok(pj.every(t => pa[t.sec].short === t.label && (t.label === "?" || pa[t.sec].label === "Artist unknown" || run(`xbLetter(${JSON.stringify(pa[t.sec].label)})`) === t.label)), "each letter opens the first painter under it");
  run("var RC = xbRun(F, Object.assign(xbFresh(), { hexes: ['#2E5A9E'], tol: 8, cover: 0 }));");
  const most = run("xbSections(F, RC, 'most')");
  ok(most.length >= 2 && most.every((s, k) => k === 0 || s.key > most[k - 1].key), "coverage bands run from most to least");
  const shuffled = run("xbSort(F, R, 'shuffle', 7)"), shuffled2 = run("xbSort(F, R, 'shuffle', 7)");
  ok(shuffled.length === N && shuffled.slice(0, 50).join() === shuffled2.slice(0, 50).join(), "shuffle is a stable permutation for one seed");
}

// ---------- 5. rooms and loosening ----------
{
  const k = run("xbLoosen(F, Object.assign(xbFresh(), { key: 2, y0: 1400, y1: 1409, hexes: ['#FF00FF'], tol: 1, cover: 50 }))");
  ok(k.length > 0 && k.every(t => t.n > 0), `zero results suggests loosenings (${k.map(t => t.label + " " + t.n).join(" · ")})`);
  ok(run("F.twins.length") >= 50 && run("F.twins.every(t => G.year[t[0]] <= G.year[t[1]] && G.year[t[1]] - G.year[t[0]] >= 100)"), "twins are a century or more apart, older first");
  ok(run("F.unpainted.length") > 10 && run("F.unpainted.every(u => u[2] >= 8)"), "the unpainted are all at least 8% from any painting color");
}

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
