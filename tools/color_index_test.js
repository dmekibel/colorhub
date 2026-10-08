// Tests for the finer color index (js/colorindex.js, data/colorindex/, tools/color_index.py).
// Run: node tools/color_index_test.js   (exits 1 on any failure)
const fs = require("fs"), path = require("path"), cp = require("child_process"), os = require("os");
const ROOT = path.join(__dirname, "..");
global.fetch = async url => {
  const f = path.isAbsolute(url) ? url : path.join(ROOT, url);
  if (!fs.existsSync(f)) return { ok: false, status: 404 };
  const buf = fs.readFileSync(f);
  return { ok: true, status: 200, json: async () => JSON.parse(buf.toString("utf8")), arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length) };
};
const CI = require("../js/colorindex.js");
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL:", m); } };
const near = (a, b, t, m) => ok(Math.abs(a - b) <= t, `${m} (got ${a}, want ${b} ± ${t})`);
let seed = 12345; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const hexOf = (r, g, b) => "#" + [r, g, b].map(v => v.toString(16).padStart(2, "0")).join("").toUpperCase();
const HEXES = ["#2A5E91", "#C2412D", "#D8B25A", "#4F6B3A", "#8A6B52", "#F1ECE0", "#1B1A17", "#7A8CA6"];

(async () => {
  const src = await CI.ciOpen("paintings");
  const N = src.n;
  ok(N > 20000, "index covers the whole gallery: " + N);
  ok(src.coarse.size === 0 || src.coarse.size < N * .02, `few coarse paintings (${src.coarse.size})`);
  const gal = JSON.parse(fs.readFileSync(path.join(ROOT, "data/gallery/index.json"), "utf8"));
  ok(gal.n === N, "same order and count as data/gallery/ (" + gal.n + " vs " + N + ")");

  // ---------- coverage never exceeds the canvas: sum every cell of every painting ----------
  const sums = new Float64Array(N);
  for (let li = 0; li < src.head.leaves.length; li++) { const lf = await CI.ciLeaf(src, li); for (let k = 0; k < lf.ids.length; k++) sums[lf.ids[k]] += lf.cov[k]; }
  let mx = 0, mean = 0; for (let i = 0; i < N; i++) { mx = Math.max(mx, sums[i]); mean += sums[i] / N; }
  ok(mx <= 1.04, `no painting's cells sum above 100% (max ${(mx * 100).toFixed(1)}%)`);
  ok(mean > .8, `cells kept hold most of each picture (mean ${(mean * 100).toFixed(1)}%; the rest is speckle under 0.05%)`);

  // ---------- the shard pruning loses nothing: compare with a scan of every shard ----------
  for (let t = 0; t < 14; t++) {
    const hex = t < HEXES.length ? HEXES[t] : hexOf(Math.floor(rnd() * 256), Math.floor(rnd() * 256), Math.floor(rnd() * 256)), tol = [0, 1, 3, 6, 10, 15][t % 6];
    const got = await CI.ciCoverage(src, hex, tol), lab = CI.ciLab(hex), own = CI.ciCellOf(src, lab), ref = new Float32Array(N);
    for (let li = 0; li < src.head.leaves.length; li++) {
      const lf = await CI.ciLeaf(src, li);
      for (let c = 0; c < lf.nc; c++) {
        const o = c * 3, isOwn = lf.cell[o] === own[0] && lf.cell[o + 1] === own[1] && lf.cell[o + 2] === own[2];
        if (isOwn || CI.ciDE(lab[0], lab[1], lab[2], lf.lab[o], lf.lab[o + 1], lf.lab[o + 2]) <= tol) for (let k = lf.start[c]; k < lf.start[c + 1]; k++) ref[lf.ids[k]] += lf.cov[k];
      }
    }
    let bad = 0; for (let i = 0; i < N; i++) if (Math.abs(ref[i] - got.cov[i]) > 1e-6) bad++;
    ok(bad === 0, `shard pruning exact for ${hex} at ${tol}% (${bad} paintings differ)`);
  }

  // ---------- monotone: looser tolerance never loses a painting; a higher bar never gains one ----------
  for (const hex of HEXES) {
    let prev = -1;
    for (const tol of [0, 1, 2, 3, 4, 6, 8, 10, 15]) {
      const r = await CI.paintingsFor(hex, { tol, minCover: 1 });
      ok(r.count >= prev, `${hex}: count rises with tolerance (${prev} -> ${r.count} at ${tol}%)`);
      prev = r.count;
    }
    prev = 1e9;
    for (const m of [.05, .1, .5, 1, 2, 5, 10, 25, 50]) {
      const r = await CI.paintingsFor(hex, { tol: 3, minCover: m });
      ok(r.count <= prev, `${hex}: count falls as the cover bar rises (${prev} -> ${r.count} at ${m}%)`);
      prev = r.count;
    }
    const a = await CI.paintingsFor(hex, { tol: 3, minCover: 1 }), b = await CI.paintingsFor(hex, { tol: 6, minCover: 1 });
    const bm = new Map(b.rows.map(r => [r.i, r.cover]));
    ok(a.rows.every(r => bm.has(r.i) && bm.get(r.i) >= r.cover - 1e-6), `${hex}: every painting at 3% is at 6% with at least as much cover`);
    ok(a.rows.every(r => r.cover <= 100.0001 && r.cover >= 1 - 1e-6), `${hex}: covers are within 1..100%`);
    ok(a.rows.every((r, j) => j === 0 || a.rows[j - 1].cover >= r.cover), `${hex}: sorted by cover`);
  }

  // ---------- a painting's own colors are found in it (the arriving color is always there to pin) ----------
  const bin = fs.readFileSync(path.join(ROOT, "data/gallery/index.bin")), R = gal.rec;
  let tried = 0, found = 0;
  for (let i = 0; i < N; i += 97) {
    const o = i * R + 6, j = 0, hex = hexOf(bin[o + j * 4], bin[o + j * 4 + 1], bin[o + j * 4 + 2]);
    const a = await CI.ciArrival(i, hex, 6); tried++; if (a.cover > 0) found++;
  }
  ok(found / tried > .97, `a painting's biggest palette color is within 6% of real pixels in it (${found}/${tried})`);

  // ---------- sets ----------
  const [A, B, Cc] = [HEXES[4], HEXES[2], HEXES[6]];   // brown, gold, near-black: all common enough for a pair to mean something
  const pa = await CI.paintingsFor(A, { tol: 6, minCover: 1 }), pb = await CI.paintingsFor(B, { tol: 6, minCover: 1 });
  const all = await CI.paintingsWith([A, B], { tol: 6, minCover: 1, mode: "all" }), any = await CI.paintingsWith([A, B], { tol: 6, minCover: 1, mode: "any" });
  const sa = new Set(pa.rows.map(r => r.i)), sb = new Set(pb.rows.map(r => r.i));
  ok(all.count === [...sa].filter(i => sb.has(i)).length, "all = the intersection");
  ok(any.count === new Set([...sa, ...sb]).size, "any = the union");
  near(all.expected, N * (sa.size / N) * (sb.size / N), 1e-6, "expected under independence");
  near(all.lift, all.count / all.expected, 1e-9, "lift = observed / expected");
  const three = await CI.paintingsWith([A, B, Cc], { tol: 6, minCover: 1, mode: "all" });
  ok(three.count <= all.count, "adding a color never adds paintings");
  const pal = await CI.paintingsWith([A, B, Cc], { tol: 6, minCover: 1, mode: "palette" });
  ok(pal.rows.every((r, j) => j === 0 || pal.rows[j - 1].score >= r.score) && pal.rows.length > 0 && pal.rows[0].score <= 1.0001, "palette mode is scored 0-1 and sorted");
  const dated = await CI.paintingsWith([A], { tol: 4, minCover: 5, sort: "date" }), meta = await CI.ciMeta(src);
  ok(dated.rows.every((r, j) => j === 0 || meta.year[dated.rows[j - 1].i] <= meta.year[r.i] || meta.year[r.i] === -32768), "date sort runs oldest first");
  const st = await CI.ciSetStats(all, [A, B]);
  ok(st.decades.length > 0 && st.earliest && st.earliest.year > 1000, "set statistics find decades and an earliest painting");
  const line = CI.ciFinding(["Blue", "Gold"], all, st);
  ok(/appear together in/.test(line) && /chance/.test(line), "the finding states the count and chance: " + line);

  // ---------- parity with the offline table (tools/color_index.py) ----------
  let checked = 0, off = 0;
  const aff = JSON.parse(fs.readFileSync(path.join(ROOT, "data/colorindex/affinity-b.json"), "utf8"));
  for (const [slug, e] of Object.entries(aff).slice(0, 40)) {
    const r = await CI.paintingsFor(e.h, { tol: 4, minCover: 1 });
    checked++; if (Math.abs(r.count - e.n) > Math.max(2, e.n * .01)) { off++; console.log("  parity off", slug, r.count, e.n); }
  }
  ok(off <= 2, `the browser query matches the offline counts (${off} of ${checked} differ)`);

  // ---------- never empty: the ranked fallback ----------
  for (const hex of ["#00FFFF", "#FF00FF", "#2A5E91", "#39FF14"]) {
    const strict = await CI.paintingsWith([hex], { tol: 0, minCover: 50 });
    const t0 = Date.now(), cl = await CI.ciClosest([hex], strict);
    const dt = Date.now() - t0;
    ok(cl.rows.length >= 12, `${hex}: the fallback lists paintings even at 0% / 50% (${cl.rows.length})`);
    ok(cl.rows.every((r, i) => i === 0 || r.score <= cl.rows[i - 1].score + 1e-9), `${hex}: fallback sorted best first`);
    ok(cl.rows.every(r => isFinite(r.de) && r.cover >= 0), `${hex}: fallback rows carry honest numbers`);
    console.log(`  ${hex} fallback: ${cl.rows.length} rows, R=${cl.R}, tc=${cl.tc}, ${dt} ms (cold), top ${CI.ciNearWords(cl.rows[0])}`);
    const t1 = Date.now(); await CI.ciClosest([hex], strict); console.log(`  ${hex} warm: ${Date.now() - t1} ms`);
  }
  const pairCl = await CI.ciClosest(["#00FFFF", "#FF00FF"], await CI.paintingsWith(["#00FFFF", "#FF00FF"], { tol: 0, minCover: 50 }));
  ok(pairCl.rows.length > 0, "a pair with no exact match still ranks paintings");
  const auto = await CI.ciAuto(["#2A5E91"], { mode: "all" }, [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 15], [.05, .1, .25, .5, 1, 2, 3, 5, 8, 12, 20, 35, 50]);
  const ar = await CI.paintingsFor("#2A5E91", { tol: auto.tol, minCover: auto.minCover });
  ok(ar.count >= 12, `Auto setting (${auto.tol}%, ${auto.minCover}%) shows at least 12 (${ar.count})`);

  // ---------- a second corpus plugs in with the same format ----------
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ci-design-"));
  const items = [
    { id: "d1", y: 1925, colors: [[A, .5], [B, .3], ["#FFFFFF", .2]] },
    { id: "d2", y: 1968, colors: [[A, .1], ["#E24B2A", .9]] },
    { id: "d3", y: 1999, colors: [[B, .6], [A, .4]] },
  ];
  fs.writeFileSync(path.join(tmp, "items.json"), JSON.stringify(items));
  cp.execFileSync("python3", [path.join(ROOT, "tools/color_index.py"), "--items", path.join(tmp, "items.json"), "--out", path.join(tmp, "design"), "--label", "Design", "--item-name", "design piece"], { stdio: "pipe" });
  CI.CI_SOURCES.design.dir = path.join(tmp, "design") + "/";
  const dres = await CI.paintingsWith([A, B], { tol: 6, minCover: 5, mode: "all", source: "design" });
  ok(dres.count === 2 && dres.rows.every(r => r.src === "design"), "a design-style corpus answers the same query (" + dres.count + ")");
  const both = await CI.paintingsWith([A, B], { tol: 6, minCover: 1, mode: "all", source: "both" });
  ok(both.rows.some(r => r.src === "paintings") && both.rows.some(r => r.src === "design") && both.count === both.rows.length, "Both merges the two corpora");
  ok((await CI.ciAvailable()).join() === "paintings,design", "available sources are listed");

  console.log(`${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
