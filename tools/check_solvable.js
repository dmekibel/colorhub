// Solvability gate (genius panel 2026-10-08: "solvability before fun"). Run: node tools/check_solvable.js
// A lesson pair, Pick it board or odd-one-out target that cannot be told apart on a screen is not a question, it is a coin flip.
// "% different" here is CIEDE2000 on its 0-100 scale (100 = black against white), the same number the app shows after a round.
//   1. Lesson pairs: every color in data/colors.js against the neighbor its "than <neighbor>" line compares it with.
//   2. Pick it boards: for every color (basics too), the four options are all at least PICK_GAP % from each other.
//   3. Core-name pairs the Journey/Train can ask about: no two of the ~1,000 names are closer than CORE_MIN % (so every
//      look-alike pair has a visible difference), no duplicate canonical identity, no alias that shadows another name.
//   4. Odd-one-out ladder: the easiest rung's difference is visibly large, the hardest rung is still above the screen's 8-bit step.
// Exits 1 on any failure.
const fs = require("fs"), path = require("path"), vm = require("vm");
const ROOT = path.join(__dirname, "..");
const { de2000 } = require("./colormath.js");

const PAIR_MIN = 5;     // lesson pair: at least 5% different (data/colors.js's own unit-mate floor is 6.5)
const CORE_MIN = 2.5;   // two core names: at least this % different (build_core_names merges anything closer)
const LADDER_EASY_MIN = 8, LADDER_HARD_MIN = 1;

const errors = [];
const fail = m => errors.push(m);

// ---- 1. lesson pairs
const window = {};
new Function("window", fs.readFileSync(path.join(ROOT, "data/colors.js"), "utf8"))(window);
const D = window.DATA;
const all = new Map(D.basics.map(([n, h]) => [n.toLowerCase(), h]));
D.units.forEach(u => u.colors.forEach(c => all.set(c.n.toLowerCase(), c.h)));
let pairs = 0, minPair = 1e9, minPairName = "";
for (const u of D.units) for (const c of u.colors) {
  const h = all.get((c.vs || "").toLowerCase());
  if (!h) continue;
  const d = de2000(c.h, h); pairs++;
  if (d < minPair) { minPair = d; minPairName = `${c.n} / ${c.vs}`; }
  if (d < PAIR_MIN) fail(`lesson pair ${c.n} / ${c.vs} is only ${d.toFixed(1)}% different (< ${PAIR_MIN})`);
}

// ---- 2. Pick it boards (js/pickit.js run in a sandbox with core.js's own color math)
const UNITS = D.units.map((u, i) => ({ ...u, i, colors: u.colors.map(c => ({ ...c, id: u.id + ":" + c.n })) }));
UNITS.forEach(u => u.colors.forEach(c => { c.unit = u; }));
const ALL = UNITS.flatMap(u => u.colors);
const BASICS = D.basics.map(([n, h]) => ({ n, h, id: "basic:" + n, basic: true }));
const core = fs.readFileSync(path.join(ROOT, "js/core.js"), "utf8");
const math = core.slice(core.indexOf("// ---------- color math"), core.indexOf("// ---------- data index"));
const ctx = vm.createContext({ Math, String, Array, Object, Map, JSON, Number, D, UNITS, ALL, BASICS,
  clamp: (v, a, b) => Math.max(a, Math.min(b, v)), shuffle: a => a.slice(), today: () => "2026-10-07", addDays: k => k, save: () => {}, S: undefined });
vm.runInContext(math, ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, "js/pickit.js"), "utf8"), ctx);
const GAP = vm.runInContext("PICK_GAP", ctx);
let boards = 0, minBoard = 1e9, minBoardName = "";
for (const c of [...ALL, ...BASICS]) {
  ctx.__c = c;
  let opts; try { opts = vm.runInContext("pickOptions(__c)", ctx); } catch (e) { continue; }   // basics are placement-only: no board
  boards++;
  for (let i = 0; i < opts.length; i++) for (let j = i + 1; j < opts.length; j++) {
    const d = de2000(opts[i].h, opts[j].h);
    if (d < minBoard) { minBoard = d; minBoardName = `${c.n}: ${opts[i].c.n} / ${opts[j].c.n}`; }
    if (d < GAP) fail(`Pick it board for ${c.n}: ${opts[i].c.n} and ${opts[j].c.n} are ${d.toFixed(1)}% apart (< ${GAP})`);
  }
}

// ---- 3. core names
const names = JSON.parse(fs.readFileSync(path.join(ROOT, "data/core-names.json"), "utf8"));
const slug = s => String(s).normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
let minCore = 1e9, minCoreName = "", closePairs = 0;
const seen = new Map();
for (const e of names) {
  const s = slug(e.n);
  if (seen.has(s)) fail(`two core names share the slug "${s}": ${seen.get(s)} and ${e.n}`);
  seen.set(s, e.n);
}
for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
  const d = de2000(names[i].h, names[j].h);
  if (d < minCore) { minCore = d; minCoreName = `${names[i].n} / ${names[j].n}`; }
  if (d < CORE_MIN) { closePairs++; fail(`core names ${names[i].n} and ${names[j].n} are ${d.toFixed(1)}% apart (< ${CORE_MIN}), so a look-alike question between them is a coin flip`); }
}
let aliasN = 0;
try {
  const al = JSON.parse(fs.readFileSync(path.join(ROOT, "data/aliases.json"), "utf8"));
  for (const [a, canon] of Object.entries(al.slugs)) {
    aliasN++;
    if (seen.has(a)) fail(`alias slug "${a}" shadows the core name "${seen.get(a)}"`);
    if (!seen.has(canon)) fail(`alias "${a}" points at "${canon}", which is not a core name`);
  }
} catch (e) { fail("data/aliases.json missing or unreadable: " + e.message); }

// ---- 4. odd-one-out ladders
const eng = fs.readFileSync(path.join(ROOT, "js/gym-engine.js"), "utf8");
const m1 = /CI_LADDER = \[([^\]]*)\]/.exec(eng), m2 = /CI_LADDER_2 = \[([^\]]*)\]/.exec(eng);
for (const [name, m] of [["CI_LADDER", m1], ["CI_LADDER_2", m2]]) {
  if (!m) { fail(`${name} not found in js/gym-engine.js`); continue; }
  const v = m[1].split(",").map(Number);
  if (Math.min(...v) < LADDER_HARD_MIN) fail(`${name}: hardest rung ${Math.min(...v)}% is below ${LADDER_HARD_MIN}%`);
  if (Math.max(...v) < LADDER_EASY_MIN) fail(`${name}: easiest rung ${Math.max(...v)}% is below ${LADDER_EASY_MIN}%`);
}

errors.forEach(e => console.log("FAIL  " + e));
console.log(`solvable: ${pairs} lesson pairs (min ${minPair.toFixed(1)}% ${minPairName}), ${boards} Pick it boards (min ${minBoard.toFixed(1)}% ${minBoardName}), ` +
  `${names.length} core names (closest ${minCore.toFixed(1)}% ${minCoreName}), ${aliasN} aliases checked: ${errors.length} failures`);
process.exit(errors.length ? 1 : 0);
