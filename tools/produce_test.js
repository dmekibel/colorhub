// Unit tests for the Say it name matcher and the Make it read-out in js/produce.js. Run: node tools/produce_test.js
const fs = require("fs"), path = require("path"), vm = require("vm");
const { lch, lab, de2000 } = require("./colormath.js");
const window = {};
new Function("window", fs.readFileSync(path.join(__dirname, "../data/colors.js"), "utf8"))(window);
const D = window.DATA;
const ALL = D.units.flatMap(u => u.colors.map(c => ({ ...c, unit: u })));
const BASICS = D.basics.map(([n, h]) => ({ n, h, basic: true }));
// produce.js only needs these globals at load time; the rest are used by the DOM parts, which are not tested here
const ctx = vm.createContext({ lch, lab, de2000, ALL, BASICS, sv: () => "", Math, String, Array, Object });
vm.runInContext(fs.readFileSync(path.join(__dirname, "../js/produce.js"), "utf8"), ctx);
const run = code => vm.runInContext(code, ctx);
const pool = [...BASICS, ...ALL];
ctx.__pool = pool;
const C = n => ALL.find(c => c.n === n);

let pass = 0, fail = 0;
const judge = (input, target, want, nb) => {
  ctx.__c = C(target); ctx.__in = input;
  const j = run("sayJudge(__in, __c, __pool)");
  const ok = j.r === want && (!nb || (j.nb && j.nb.n === nb) || (j.said && j.said.n === nb));
  ok ? pass++ : fail++;
  if (!ok) console.log(`FAIL  "${input}" for ${target}: got ${j.r}${j.nb ? " nb=" + j.nb.n : ""}${j.said ? " said=" + j.said.n : ""}, want ${want}${nb ? " " + nb : ""}`);
};

// exact, case, spaces, hyphens
judge("teal", "Teal", "right");
judge("  TEAL ", "Teal", "right");
judge("Royal Blue", "Royal blue", "right");
judge("royalblue", "Royal blue", "right");
judge("royal-blue", "Royal blue", "right");
judge("Kelly-Green", "Kelly green", "right");
// common spellings and accents
judge("Gunmetal gray", "Gunmetal", "wrong");          // not a real variant: an extra word
judge("ocher", "Ochre", "right");
judge("eggplant", "Aubergine", "right");
judge("Écru", "Ecru", "right");                       // accents stripped
// typos: one edit from 5 letters, none under 5, two from 10
judge("turqoise", "Turquoise", "right");
judge("turquiose", "Turquoise", "right");             // adjacent swap counts as one edit
judge("burgandy", "Burgundy", "right");
judge("vermillion", "Vermilion", "right");
judge("magneta", "Magenta", "right");
judge("teel", "Teal", "wrong");                       // 4 letters: no typo allowance
judge("nevy", "Navy", "wrong");
judge("teracota", "Terracotta", "right");             // two edits on a 10-letter name
judge("perriwinkel", "Periwinkle", "right");
judge("chartruse", "Chartreuse", "right");
// the distinctive word alone
judge("Kelly", "Kelly green", "right");
judge("royal", "Royal blue", "right");
judge("burnt", "Burnt orange", "wrong");
// spoken fillers
judge("it's teal", "Teal", "right");
judge("um the sage color", "Sage", "right");
// a near neighbor's exact name is close, not right
judge("Turquoise", "Teal", "close", "Turquoise");
judge("maroon", "Burgundy", "close", "Maroon");
judge("lavender", "Lilac", "close", "Lavender");
judge("blue", "Royal blue", "close", "Blue");
judge("lavendar", "Lilac", "close", "Lavender");      // a typo of the neighbor is still the neighbor
// another color far away is wrong
judge("Olive", "Teal", "wrong", "Olive");
judge("coral", "Navy", "wrong", "Coral");
judge("blorp", "Teal", "wrong");
judge("", "Teal", "empty");
judge("   ", "Teal", "empty");
// one-letter typos on five-letter names
judge("lilax", "Lilac", "right");
judge("mauv", "Mauve", "right");

// Make it read-out
const read = (a, b) => { ctx.__a = a; ctx.__b = b; return run("makeRead(__a, __b)"); };
const expect = (got, re, label) => { const ok = re.test(got); ok ? pass++ : fail++; if (!ok) console.log(`FAIL  ${label}: "${got}"`); };
expect(read("#008080", "#008080"), /spot on/, "same color");
expect(read("#3AA6A6", "#008080"), /too light/, "lighter teal");
expect(read("#006060", "#008080"), /too dark/, "darker teal");
expect(read("#0A6E9C", "#008080"), /too blue/, "bluer teal");
expect(read("#5E8C8C", "#008080"), /too grey/, "greyer teal");
expect(read("#8C9AB0", "#8C9096"), /too blue/, "tinted grey");
ctx.__c = C("Teal"); ctx.__nb = C("Turquoise");
expect(run("compareLine(__c, __nb)"), /^Teal is .*than turquoise\.$/, "compare line");

console.log(`${pass + fail} cases: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
