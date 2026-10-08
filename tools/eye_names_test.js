// Tests for js/eye-names.js (every miss has names). Run: node tools/eye_names_test.js
// Over 300 seeded pairs, with the real nameOf (js/naming.js) and the ~1,000 core names: same-name pairs never
// claim different names; the lightness word matches the sign of ΔL*; "brighter", "warmer" and "cooler" never
// appear; hue words are skipped for near-greys; the output is deterministic.
const fs = require("fs"), path = require("path");
const rd = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const core = rd("js/core.js"), math = core.slice(core.indexOf("// ---------- color math"), core.indexOf("// ---------- percent display"));
const pctSrc = core.slice(core.indexOf("const pctFmt"), core.indexOf("// a closeness/match line"));
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const names = JSON.parse(rd("data/core-names.json"));
const api = new Function("clamp", "esc", "S", "BYNAME", "EVERY", "LIST",
  math + pctSrc + rd("js/naming.js") + "\n" + rd("js/eye-names.js") + "\nCORE_NAMES = LIST.map(e => ({ ...e, lab: lab(e.h) }));\nreturn { lab, lch, labHex, lchHex, inGamut, labRgb, de2000, nameOf, eyeDir, eyeNames, eyeNamesLine };")(
  clamp, esc, { cards: {} }, new Map(), () => [], names);
const E = require("../js/games/oo-engine.js");
let fails = 0, passes = 0;
const ok = (c, m) => { if (c) passes++; else { fails++; if (fails < 15) console.log("FAIL  " + m); } };
Object.assign(global, api);
const rnd = E.ooRnd(4242);
let same = 0, diff = 0;
for (let i = 0; i < 300; i++) {
  const base = names[Math.floor(rnd() * names.length)].h, d = .8 + rnd() * 9;
  const m = E.ooMoveDir(base, [rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1], d);
  if (!m) continue;
  const e = api.eyeNames(base, m.hex), line = api.eyeNamesLine(base, m.hex, { found: i % 2 === 0 });
  const nA = api.nameOf(base).n, nB = api.nameOf(m.hex).n;
  if (nA === nB) { same++; ok(e.same && /Both are/.test(line) && /no word/.test(line), `pair ${i}: same name (${nA}) must say so`); }
  else { diff++; ok(!e.same && line.includes(">" + esc(api.nameOf(m.hex).text) + "<"), `pair ${i}: different names must name both (${nA} / ${nB})`); }
  const dL = api.lab(m.hex)[0] - api.lab(base)[0];
  if (/\blighter\b/.test(e.dir)) ok(dL > 0, `pair ${i}: "lighter" needs a positive ΔL* (${dL.toFixed(2)})`);
  if (/\bdarker\b/.test(e.dir)) ok(dL < 0, `pair ${i}: "darker" needs a negative ΔL* (${dL.toFixed(2)})`);
  ok(!/brighter|warmer|cooler/.test(line), `pair ${i}: banned words`);
  if (api.lch(base)[1] < 8 && api.lch(m.hex)[1] < 8) ok(!/redder|greener|bluer|yellower/.test(e.dir), `pair ${i}: no hue word for near-greys`);
  ok(api.eyeNamesLine(base, m.hex, { found: i % 2 === 0 }) === line, `pair ${i}: deterministic`);
}
console.log(`Eye names: ${same} same-name and ${diff} different-name pairs`);
ok(same > 20 && diff > 20, "both kinds of pair are covered");
console.log(`${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
