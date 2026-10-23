// Direction words must match where a color really moves on the hue circle. Run: node tools/naming_hue_test.js
// David, 2026-10-23: #C09DA4 (a dusty rose) was named "Reddish old pink" / "redder than old pink". In CIELAB, pinks sit
// at hue 0-25, red at 25-40, magenta near 328, so a pink moving to a lower hue gets rosier and more purple, not redder.
const fs = require("fs"), path = require("path"), vm = require("vm");
const R = p => fs.readFileSync(path.join(__dirname, "..", p), "utf8");
const core = R("js/core.js"), math = core.slice(core.indexOf("// ---------- color math"), core.indexOf("// ---------- data index"));
const ctx = vm.createContext({ Math, String, Array, Object, Map, Set, JSON, Number, console, clamp: (v, a, b) => Math.max(a, Math.min(b, v)), esc: s => String(s) });
vm.runInContext(math, ctx);
vm.runInContext(R("js/naming.js").split("// started once the first screen")[0].replace(/^const VERY_CLOSE_DE[^\n]*\n/m, "const VERY_CLOSE_DE = 3, NEAR_DE = 8;\n"), ctx, { filename: "naming.js" });
vm.runInContext(R("js/lookalikes.js").split("function lookSheet")[0], ctx);
const diff = (name, yours) => vm.runInContext(`lookDiff({ h: "${name}", n: "x" }, { h: "${yours}", n: "y" })`, ctx);
let fail = 0; const eq = (got, want, label) => { if (got !== want) { fail++; console.log(`FAIL ${label}: got "${got}", want "${want}"`); } };
eq(diff("#CB9C9D", "#C09DA4"), "purpler", "dusty rose vs old pink");              // the reported case: cooler, not redder
eq(diff("#C09DA4", "#CB9C9D"), "redder", "old pink vs dusty rose (the way back)");
eq(vm.runInContext("hueZoneWord(5)", ctx), "purpler", "hue 5 (rose) is toward magenta");
eq(vm.runInContext("hueZoneWord(25)", ctx), "redder", "hue 25 (crimson) is red");
eq(vm.runInContext("hueZoneWord(40)", ctx), "redder", "hue 40 (red) is red");
eq(vm.runInContext("hueLean(5)", ctx), "purplish", "a rose is not 'reddish'");
eq(vm.runInContext("hueLean(33)", ctx), "reddish", "salmon is reddish");
console.log(fail ? `naming hue: ${fail} failures` : "naming hue: 0 failures");
process.exit(fail ? 1 : 0);
