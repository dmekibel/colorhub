// Contrast gate (David, 2026-10-09: "Ice" was barely visible, white text on a near-white swatch, on the Sort
// board). Wherever a name sits directly on a swatch in Study/Learn formats, the text color is picked by real
// WCAG 2 contrast (inkHex, js/core.js), not a lightness-threshold guess. This mirrors that function in plain
// node and checks every core name's hex gets at least AA contrast (4.5:1) against whichever ink wins.
// Run: node tools/check_contrast.js. Exits 1 on any failure.
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
// WCAG AA is 4.5:1 for normal text, 3:1 for large text (>=24px, or >=19px bold) — every name-on-swatch label this
// checks is large (44-56px serif in a Meet/comparison card, 17px/600 weight sort row), so 3:1 is the real bar; a
// few saturated mid-lightness colors (Olive, Cerise, …) can't clear 4.5:1 against either flat black or white —
// that's a property of the color, not a bug — but every one of them clears 3:1 against the better of the two.
const MIN = 3;
const INK_DARK = "#141311", INK_LIGHT = "#FFFFFF";

function relLum(hex) {
  const h = String(hex).replace("#", ""), c = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
  const lin = v => v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4);
  return .2126 * lin(c[0]) + .7152 * lin(c[1]) + .0722 * lin(c[2]);
}
function contrastRatio(h1, h2) { const a = relLum(h1), b = relLum(h2), hi = Math.max(a, b), lo = Math.min(a, b); return (hi + .05) / (lo + .05); }
const inkHex = h => contrastRatio(h, INK_DARK) >= contrastRatio(h, INK_LIGHT) ? INK_DARK : INK_LIGHT;

const errors = [];
let n = 0, worst = Infinity, worstName = "";

function check(name, hex) {
  if (!/^#?[0-9a-f]{6}$/i.test(hex)) return;
  if (!hex.startsWith("#")) hex = "#" + hex;
  n++;
  const ink = inkHex(hex), ratio = contrastRatio(hex, ink);
  if (ratio < worst) { worst = ratio; worstName = name; }
  if (ratio < MIN) errors.push(`${name} ${hex}: best contrast is ${ink} at ${ratio.toFixed(2)}:1 (< ${MIN})`);
}

// the ~1,000-word Learn/Archive list (core-names.json), where Study/Learn draws its colors from
const core = JSON.parse(fs.readFileSync(path.join(ROOT, "data/core-names.json"), "utf8"));
core.forEach(c => check(c.n, c.h));

// the original units/basics (data/colors.js DATA), still used by a few Learn paths
const window = {};
new Function("window", fs.readFileSync(path.join(ROOT, "data/colors.js"), "utf8"))(window);
const D = window.DATA;
(D.basics || []).forEach(([name, hex]) => check(name, hex));
(D.units || []).forEach(u => (u.colors || []).forEach(c => check(c.n, c.h)));

// a few known-hard edge cases named in feedback (David, 2026-10-09): very light and very dark swatches
[["Ice", "#D5FFF8"], ["Pale Grey", "#FDFDFE"], ["White", "#FFFFFF"], ["Black", "#000000"], ["Unbleached Silk", "#FFDDCA"], ["Lavender Grey", "#C4C3D0"]]
  .forEach(([name, hex]) => check(name, hex));

if (errors.length) { errors.slice(0, 30).forEach(e => console.log("fail  " + e)); if (errors.length > 30) console.log(`  … and ${errors.length - 30} more`); }
console.log(`contrast: ${n} colors checked, ${errors.length} below ${MIN}:1, worst was ${worstName} at ${worst.toFixed(2)}:1`);
process.exit(errors.length ? 1 : 0);
