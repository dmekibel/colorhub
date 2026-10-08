// Index-alignment gate. Run: node tools/check_ids.js  (also called from tools/check.js)
//
// Every file that stores a "gallery index" (data/artists/p/*.json ix, data/artists/ids.txt, data/gallery/ids.txt,
// metrics.bin, facets.json, the analysis shards) is keyed to ONE order: the corpus order tools/gallery.py writes
// (museum, then natural id order; data/corpus/*.json deduped by id, needing an image and six palette colors).
// When the corpus grows and gallery.py re-runs, every one of those has to be rebuilt, or index N opens the wrong
// painting. This gate fails on any count or order disagreement and names the tool that fixes it.
//   source of truth: data/corpus/*.json  ->  tools/gallery.py  ->  data/gallery/{index.json,index.bin,ids.txt,d/*.json}
//   then: tools/analyze.py (data/analysis), tools/metrics_build.py (metrics.bin), tools/facets.py (facets),
//         tools/artwiki_build.py (data/artists/ids.txt, stats.json, p/*.json, groups-extra.json)
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const has = (p) => fs.existsSync(path.join(ROOT, p));
const rd = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const rj = (p) => JSON.parse(rd(p));
const sz = (p) => fs.statSync(path.join(ROOT, p)).size;
const shardName = (k) => String(k).padStart(3, "0");

function checkIds() {
  const errors = [], warnings = [];
  const err = (m) => errors.push(m), warn = (m) => warnings.push(m);
  const FIX_GALLERY = "rebuild with tools/gallery.py", FIX_AN = "rebuild with tools/analyze.py", FIX_AW = "rebuild with tools/artwiki_build.py";

  // 1. corpus -> expected count (same filter and dedupe as tools/gallery.py load_corpus)
  const files = [];
  if (has("data/corpus.json")) files.push("data/corpus.json");
  if (has("data/corpus")) fs.readdirSync(path.join(ROOT, "data/corpus")).filter(f => f.endsWith(".json")).sort().forEach(f => files.push("data/corpus/" + f));
  const seen = new Set();
  for (const f of files) {
    let data = rj(f);
    if (!Array.isArray(data)) data = data.rows || [];
    for (const x of data) if (!seen.has(x.id) && x.img && (x.p || []).length === 6) seen.add(x.id);
  }
  const corpusN = seen.size;

  // 2. gallery
  const head = rj("data/gallery/index.json"), N = head.n;
  if (N !== corpusN) err(`data/gallery/index.json n=${N} but data/corpus has ${corpusN} paintings: ${FIX_GALLERY}, then analyze, metrics_build, facets, artwiki_build`);
  const gIds = rd("data/gallery/ids.txt").split("\n");
  if (gIds.length !== N) err(`data/gallery/ids.txt has ${gIds.length} ids, the gallery ${N}: ${FIX_GALLERY}`);
  if (new Set(gIds).size !== gIds.length) err("data/gallery/ids.txt has duplicate ids");
  const shardIds = [], names = [];
  for (let k = 0; k * head.shard < N; k++) for (const r of rj(`data/gallery/d/${shardName(k)}.json`)) { shardIds.push(r[0]); names.push(r[2]); }
  if (shardIds.length !== gIds.length || shardIds.some((id, i) => id !== gIds[i])) err(`data/gallery/ids.txt order differs from the detail shards d/*.json: ${FIX_GALLERY}`);
  if (sz("data/gallery/index.bin") !== N * head.rec) err(`data/gallery/index.bin is ${sz("data/gallery/index.bin")} bytes, ${N} x ${head.rec} = ${N * head.rec} expected: ${FIX_GALLERY}`);
  if (sz("data/gallery/metrics.bin") !== N * 27) err(`data/gallery/metrics.bin is ${sz("data/gallery/metrics.bin")} bytes, ${N} x 27 = ${N * 27} expected: rebuild with tools/metrics_build.py`);
  if (has("data/facets/facets.json")) { const fn = rj("data/facets/facets.json").n; if (fn !== N) err(`data/facets/facets.json n=${fn}, the gallery ${N}: rebuild with tools/facets.py`); }

  // 3. analysis shards (same order, id by id)
  let at = 0, anErr = 0;
  for (let k = 0; k * head.shard < N && !anErr; k++) {
    const p = `data/analysis/paintings-${shardName(k)}.json`;
    if (!has(p)) { err(`${p} missing: ${FIX_AN}`); anErr++; break; }
    for (const r of rj(p)) if (r.id !== gIds[at++] && !anErr++) err(`data/analysis shard ${k}: painting order differs from data/gallery/ids.txt (first at index ${at - 1}): ${FIX_AN}`);
  }
  if (!anErr && at !== N) err(`data/analysis has ${at} paintings, the gallery ${N}: ${FIX_AN}`);

  // 4. art wiki
  const aIds = rd("data/artists/ids.txt").split("\n");
  if (aIds.length !== gIds.length) err(`data/artists/ids.txt has ${aIds.length} ids, the gallery ${gIds.length}: ${FIX_AW}`);
  else { const i = aIds.findIndex((id, j) => id !== gIds[j]); if (i >= 0) err(`data/artists/ids.txt differs from data/gallery/ids.txt from index ${i} (${aIds[i]} vs ${gIds[i]}): ${FIX_AW}`); }
  // every painter's gallery indices must point at that painter's own paintings
  const meta = rj("data/artists/meta.json").a;
  let wrong = 0, oob = 0;
  const kOff = [];
  for (const [slug, m] of Object.entries(meta)) {
    const f = `data/artists/p/${slug}.json`;
    if (!has(f)) { err(`${f} missing: ${FIX_AW}`); continue; }
    const ix = rj(f).ix;
    for (const i of ix) { if (!(i >= 0 && i < N)) oob++; else if (names[i] !== m.n) wrong++; }
    if (ix.length !== m.k) kOff.push(`${slug} ${ix.length} vs ${m.k}`);
  }
  if (oob) err(`data/artists/p/*.json: ${oob} gallery indices outside 0..${N - 1}: ${FIX_AW}`);
  if (wrong) err(`data/artists/p/*.json: ${wrong} gallery indices point at another painter's painting: ${FIX_AW}`);
  if (kOff.length) warn(`data/artists/meta.json k (paintings per painter) is stale for ${kOff.length} painter(s): ${kOff.slice(0, 3).join("; ")}: rebuild with tools/wikidata_artists.py`);
  return { errors, warnings, N };
}

module.exports = { checkIds };
if (require.main === module) {
  const { errors, warnings, N } = checkIds();
  warnings.forEach(w => console.log("warn  " + w));
  errors.forEach(e => console.log("FAIL  " + e));
  console.log(`ids gate: ${N} paintings, ${errors.length} failures, ${warnings.length} warnings`);
  process.exit(errors.length ? 1 : 0);
}
