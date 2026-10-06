// Data gate for data/colors.js. Run: node tools/check.js
// 1. Every "vs" neighbor exists in the same unit or an earlier one.
// 2. No two colors in a unit are too close to tell apart (CIEDE2000 >= MIN_DE).
// 3. Every comparative word in the "than <neighbor>" sentence matches the measured difference
//    (darker, lighter, greyer, bluer, pinker...). A wrong line fails the build.
const fs = require("fs"), path = require("path");
const { lch, de2000 } = require("./colormath.js");
const window = {};
new Function("window", fs.readFileSync(path.join(__dirname, "../data/colors.js"), "utf8"))(window);
const D = window.DATA;
const MIN_DE = 6.5;

const seen = new Map(D.basics.map(([n, h]) => [n.toLowerCase(), { n, h }]));
const errors = [], warnings = [];
const hueDist = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
// LCh hue targets for hue words
const HUE = { greener: 140, bluer: 285, yellower: 95, redder: 30, pinker: 0, "more orange": 55, "more violet": 310 };
// Each check gets the color's [L,C,H] and the neighbor's; returns true when the claim holds.
const M = 2; // minimum difference (L or C units) to count as a real difference
const RULES = {
  darker: (a, b) => a[0] < b[0] - M,
  lighter: (a, b) => a[0] > b[0] + M,
  paler: (a, b) => a[0] > b[0] + M || a[1] < b[1] - M,
  greyer: (a, b) => a[1] < b[1] - M,
  duller: (a, b) => a[1] < b[1] - M,
  softer: (a, b) => a[1] < b[1] - M,
  calmer: (a, b) => a[1] < b[1] - M,
  quieter: (a, b) => a[1] < b[1] - M,
  stronger: (a, b) => a[1] > b[1] + M,
  brighter: (a, b) => a[1] > b[1] + M || a[0] > b[0] + M,
  "more vivid": (a, b) => a[1] > b[1] + M,
  "more intense": (a, b) => a[1] > b[1] + M,
  richer: (a, b) => a[1] > b[1] + M,
  deeper: (a, b) => a[0] < b[0] - M || a[1] > b[1] + M,
};
for (const [w, t] of Object.entries(HUE)) RULES[w] = (a, b) => hueDist(a[2], t) < hueDist(b[2], t) - 2;

let total = 0;
for (const u of D.units) {
  const inUnit = new Map(u.colors.map(c => [c.n.toLowerCase(), c]));
  for (const c of u.colors) {
    total++;
    const tag = `${u.id} ${c.n}`;
    if (!/^#[0-9A-F]{6}$/.test(c.h)) errors.push(`${tag}: bad hex ${c.h}`);
    if (!c.d) errors.push(`${tag}: missing d`);
    const nb = inUnit.get((c.vs || "").toLowerCase()) || seen.get((c.vs || "").toLowerCase());
    if (!nb) { errors.push(`${tag}: neighbor "${c.vs}" not in this unit or earlier`); continue; }
    // closeness inside the unit
    for (const o of u.colors) if (o !== c && o.n < c.n) {
      const d = de2000(c.h, o.h);
      if (d < MIN_DE) errors.push(`${u.id}: ${c.n} and ${o.n} are too close (dE ${d.toFixed(1)})`);
    }
    // comparative claims
    const sentence = (c.d.split(/(?<=\.)\s+/).find(s => s.toLowerCase().includes("than " + c.vs.toLowerCase())) || "").toLowerCase();
    if (!sentence) { warnings.push(`${tag}: d never says "than ${c.vs}"`); continue; }
    const a = lch(c.h), b = lch(nb.h);
    for (const [w, ok] of Object.entries(RULES)) {
      if (!new RegExp(`\\b${w}\\b`).test(sentence)) continue;
      if (!ok(a, b)) errors.push(`${tag}: says "${w}" than ${c.vs} but measured L${(a[0]-b[0]).toFixed(0)} C${(a[1]-b[1]).toFixed(0)} h${a[2].toFixed(0)} vs ${b[2].toFixed(0)}`);
    }
  }
  for (const c of u.colors) seen.set(c.n.toLowerCase(), c);
}
warnings.forEach(w => console.log("warn  " + w));
errors.forEach(e => console.log("FAIL  " + e));
console.log(`${total} colors, ${D.units.length} units: ${errors.length} failures, ${warnings.length} warnings`);
process.exit(errors.length ? 1 : 0);
