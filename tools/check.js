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
  // "brighter" is banned (David/L15 2026-10-08): it means lighter to some readers and more vivid to others. Say lighter/darker or
  // more vivid/duller, whichever the Lab difference actually is.
  brighter: () => false,
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

// ROADMAP.md §13's naming gate: nameOf() (js/naming.js) is the only function that names a color for display,
// built on data/core-names.json; nothing else picks names straight out of the old 2,700-name library.
// Simple allowlist, not a parser: a file on it may reference LONG_NAMES, nameColor( or library.json; everything
// else fails the build if it does. js/naming.js and js/graph.js are the naming system itself. js/colorsets.js
// and js/home.js are a different feature, not a display path: the honeycomb's "every name" view browses the
// raw library as a set of items (each bubble is one exact library entry), not the nearest name of a color.
// js/honey.js only mentions "library.json" in a comment about that same view's item shape.
const NAMING_ALLOW = new Set(["naming.js", "graph.js", "colorsets.js", "home.js", "honey.js"]);
const nameErrors = [];
for (const f of fs.readdirSync(path.join(__dirname, "../js")).filter(f => f.endsWith(".js"))) {
  if (NAMING_ALLOW.has(f)) continue;
  const text = fs.readFileSync(path.join(__dirname, "../js", f), "utf8");
  if (/LONG_NAMES|\bnameColor\(|library\.json/.test(text)) nameErrors.push(f);
}
nameErrors.forEach(f => console.log(`FAIL  js/${f}: names a color outside js/naming.js's nameOf() (LONG_NAMES, nameColor(, or library.json)`));
console.log(`naming gate: ${nameErrors.length} files name colors outside the one naming system`);

// Index-alignment gate (tools/check_ids.js): every file keyed by a gallery index must agree with the corpus.
const idsGate = require("./check_ids.js").checkIds();
idsGate.warnings.forEach(w => console.log("warn  " + w));
idsGate.errors.forEach(e => console.log("FAIL  " + e));
console.log(`ids gate: ${idsGate.N} paintings, ${idsGate.errors.length} files out of step with the corpus`);
process.exit(errors.length || nameErrors.length || idsGate.errors.length ? 1 : 0);
