// Read-back gate for data/shades.json (NOTES-TRACKER.md item 0): every shade must read back its own name
// through a faithful port of js/naming.js's nameOf() — not "trust the generator", a real recomputation from
// the shade's hex and the real data/core-names.json list. Run: node tools/check_shades.js
//
// An empty or missing shades.json (David, 2026-10-09: paused before the real run, pending a library import)
// passes trivially — this gate only ever fails on a shade that's actually there and wrong.
const fs = require("fs"), path = require("path");
const { lch, lab, de2000 } = require("./colormath.js");   // colormath's de2000(h1, h2) takes hex strings, not lab triples

const ROOT = path.join(__dirname, "..");
const coreFile = path.join(ROOT, "data", "core-names.json");
const shadesFile = path.join(ROOT, "data", "shades.json");

const VERY_CLOSE_DE = 3, NEAR_DE = 8;   // js/naming.js
const MOD_AXIS_WORDS = { L: /\b(light|pale|dark|deep|dusky|bright)\b/i, C: /\b(grey|gray|greyish|grayish|dusty|dull|vivid|bright|neon|electric)\b/i,
  H: /\b(reddish|yellowish|greenish|bluish|purplish|orangish|pinkish)\b/i };
const hueLean = h => { h = (h + 360) % 360; return h < 40 || h >= 345 ? "reddish" : h < 100 ? "yellowish" : h < 170 ? "greenish" : h < 260 ? "bluish" : "purplish"; };

// pickModifier, ported 1:1 from js/naming.js
function pickModifier(nameLch, targetLch, name = "") {
  const [Ln, Cn] = nameLch, [Lt, Ct, Ht] = targetLch;
  const dL = Lt - Ln, dC = Ct - Cn;
  let dH = Ht - nameLch[2]; if (dH > 180) dH -= 360; if (dH < -180) dH += 360;
  const scores = [["L", Math.abs(dL), dL], ["C", Math.abs(dC) * .8, dC]];
  if (Cn > 8 && Ct > 8) scores.push(["H", Math.abs(dH) * Math.min(Cn, Ct) / 40, dH]);
  scores.sort((a, b) => b[1] - a[1]);
  const ok = scores.filter(sc => !MOD_AXIS_WORDS[sc[0]].test(name));
  if (!ok.length) return "";
  const [axis, , v] = ok[0];
  if (axis === "L") return v > 0 ? (Ct < 20 ? "pale" : "light") : (Ct > 35 ? "deep" : "dark");
  if (axis === "C") return v < 0 ? (Ct < 15 ? "greyish" : "dusty") : (Lt > 55 ? "bright" : "vivid");
  return hueLean(Ht);
}

// nameOf(), ported 1:1 (minus the app-only `met` field): the nearest of ALL core names, by CIEDE2000.
function nameOf(hex, list) {
  const near = list.map(e => ({ n: e.n, h: e.h, de: de2000(hex, e.h) })).sort((a, b) => a.de - b.de);
  const top = near[0];
  let mod = "", text = top.n;
  if (top.de >= NEAR_DE) {
    const second = near.find(x => x.n !== top.n);
    text = second ? `between ${top.n.toLowerCase()} and ${second.n.toLowerCase()}` : `No close name; nearest is ${top.n}`;
  } else if (top.de >= VERY_CLOSE_DE) {
    mod = pickModifier(lch(top.h), lch(hex), top.n);
    if (mod) text = `${mod} ${top.n.toLowerCase()}`;
  }
  text = text.charAt(0).toUpperCase() + text.slice(1);
  return { n: top.n, de: top.de, mod, text };
}

if (!fs.existsSync(shadesFile)) {
  console.log("check_shades: no data/shades.json yet (nothing to check)");
  process.exit(0);
}
const shades = JSON.parse(fs.readFileSync(shadesFile, "utf8"));
if (!shades.length) {
  console.log("check_shades: data/shades.json is empty (nothing to check)");
  process.exit(0);
}
const core = JSON.parse(fs.readFileSync(coreFile, "utf8"));

const errors = [];
for (const s of shades) {
  if (!/^#[0-9A-F]{6}$/.test(s.h || "")) { errors.push(`${s.n}: bad hex ${s.h}`); continue; }
  if (!s.base || !s.mod) { errors.push(`${s.n}: missing base/mod`); continue; }
  const got = nameOf(s.h, core);
  if (got.text.toLowerCase() !== String(s.n).toLowerCase()) {
    errors.push(`${s.n} (${s.h}): nameOf() reads back "${got.text}" (nearest ${got.n}, dE ${got.de.toFixed(1)}, mod "${got.mod}")`);
  }
  if (got.n.toLowerCase() !== String(s.base).toLowerCase()) {
    errors.push(`${s.n} (${s.h}): base says "${s.base}" but nameOf()'s nearest is "${got.n}"`);
  }
}
errors.forEach(e => console.log("FAIL  " + e));
console.log(`check_shades: ${shades.length} shades, ${errors.length} read-back failures`);
process.exit(errors.length ? 1 : 0);
