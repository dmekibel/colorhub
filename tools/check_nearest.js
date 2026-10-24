// Nearest-name gate (David, 2026-10-24: the page opened for a tapped or in-between color must be TRULY the closest
// name, and the "It could also be called" list under its cover must agree with it). Every path that turns a color
// into a name page (map bubbles, palette chips, painting analysis, photo palettes, camera, eyedropper, search)
// goes through js/swatch.js openTappedColor -> nameOf() (js/naming.js); the runner-up list is nameCandidates() in
// the same file. This runs the real js/naming.js against data/core-names.json (the ~1,000 learnable names) and
// asserts, for a few thousand random colors plus every core name's own color:
//   1. nameOf(hex).n is the minimum-dE2000 name (checked by a brute-force scan with tools/colormath.js);
//   2. nameCandidates(hex)[0] is that same name (when within dE2000 12), and the list is sorted by closeness;
//   3. no name appears twice in the list, and the page's own name is never repeated in it.
// Run: node tools/check_nearest.js
const fs = require("fs"), path = require("path"), vm = require("vm");
const ROOT = path.join(__dirname, "..");
const cm = require("./colormath.js");
const core = JSON.parse(fs.readFileSync(path.join(ROOT, "data/core-names.json"), "utf8"));

const ctx = vm.createContext({ lab: cm.lab, lch: cm.lch, de2000: cm.de2000, clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
  EVERY: () => [], BYNAME: new Map(), S: { cards: {} }, fetch: () => Promise.reject(new Error("no fetch")), requestAnimationFrame: () => 0, setTimeout: () => 0 });
vm.runInContext(fs.readFileSync(path.join(ROOT, "js/naming.js"), "utf8"), ctx, { filename: "js/naming.js" });
ctx.__core = core.map(e => ({ ...e, lab: cm.lab(e.h) }));
vm.runInContext("CORE_NAMES = __core;", ctx);

let seed = 20261024;
const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
const hexOf = () => "#" + [0, 0, 0].map(() => Math.floor(rnd() * 256).toString(16).padStart(2, "0")).join("").toUpperCase();
const samples = [];
for (let i = 0; i < 3000; i++) samples.push(hexOf());
for (const e of core) samples.push(e.h.toUpperCase());
for (const e of core.slice(0, 400)) {   // near-name colors: a name's color nudged a little, the case a tap actually lands in
  const [r, g, b] = [1, 3, 5].map(i => parseInt(e.h.slice(i, i + 2), 16));
  const j = v => Math.max(0, Math.min(255, v + Math.round((rnd() - .5) * 24)));
  samples.push("#" + [j(r), j(g), j(b)].map(v => v.toString(16).padStart(2, "0")).join("").toUpperCase());
}
for (const h of ["#000000", "#FFFFFF", "#808080", "#FF0000", "#00FF00", "#0000FF", "#FDFDFD", "#030303"]) samples.push(h);

const labs = core.map(e => [e.n, cm.lab(e.h)]);
let bad = 0, checked = 0;
const fail = m => { if (bad++ < 15) console.log("FAIL " + m); };
for (const hex of samples) {
  const L = cm.lab(hex);
  let best = null;
  for (const [n, l] of labs) { const d = cm.de2000(L, l); if (!best || d < best.d - 1e-9) best = { n, d }; }
  const nm = ctx.nameOf(hex), cands = ctx.nameCandidates(hex, 6, 12, "");
  checked++;
  // a tie (two names the same distance) may go either way; anything farther than the true minimum is a wrong pick
  if (Math.abs(cm.de2000(L, cm.lab(core.find(e => e.n === nm.n).h)) - best.d) > 1e-6) fail(`${hex}: nameOf picked ${nm.n}, the minimum is ${best.n} (dE ${best.d.toFixed(2)})`);
  if (best.d <= 12) {
    if (!cands.length) fail(`${hex}: no candidates though ${best.n} is ${best.d.toFixed(2)} away`);
    else if (Math.abs(cands[0].de - best.d) > 1e-6) fail(`${hex}: list starts with ${cands[0].n}, the minimum is ${best.n}`);
  }
  for (let i = 1; i < cands.length; i++) if (cands[i].de < cands[i - 1].de - 1e-9) fail(`${hex}: list not sorted by closeness`);
  if (new Set(cands.map(c => c.n.toLowerCase())).size !== cands.length) fail(`${hex}: duplicate names in the list`);
  const skipped = ctx.nameCandidates(hex, 6, 12, nm.n);
  if (skipped.some(c => c.n.toLowerCase() === nm.n.toLowerCase())) fail(`${hex}: the page's own name repeated in the list`);
  if (skipped.some(c => c.de > 12)) fail(`${hex}: a name beyond dE2000 12 in the list`);
}
console.log(`nearest check: ${checked} colors, ${bad} wrong picks`);
process.exit(bad ? 1 : 0);
