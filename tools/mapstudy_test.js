// Unit tests for Study the map (js/mapstudy.js): level set sizes, same-family distractors, scoring (Practice's
// policy, stars, grading, the breathing difficulty), the map graph, and that the fog is never on by default.
// Run: node tools/mapstudy_test.js
const fs = require("fs"), path = require("path"), vm = require("vm");
const { lch, lab, de2000 } = require("./colormath.js");
const read = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const window = {};
new Function("window", read("data/colors.js"))(window);
const D = window.DATA;
const ALL = D.units.flatMap(u => u.colors.map(c => ({ ...c, id: u.id + ":" + c.n })));
const BASICS = D.basics.map(([n, h]) => ({ n, h, id: "basic:" + n, basic: true }));
const CORE = JSON.parse(read("data/core-names.json"));
// family() lives in js/gym.js, which needs the whole app to load; take just that function
const famSrc = read("js/gym.js").match(/function family\(h\) \{[\s\S]*?\n\}/)[0];

const calls = [];
const ctx = vm.createContext({
  lch, lab, de2000, ALL, BASICS, Math, String, Array, Object, Set, Map, JSON, Number, isFinite, console,
  sv: () => "", clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
  S: { cards: {} }, save: () => {}, today: () => "2026-10-08",
  addDays: (k, n) => { const [y, m, d] = k.split("-").map(Number), t = new Date(Date.UTC(y, m - 1, d + n)); return t.toISOString().slice(0, 10); },
  schedule: (c, ok, by) => calls.push(["schedule", c.id, ok, by]),
  BYNAME: new Map([...BASICS, ...ALL].map(c => [c.n.toLowerCase(), c])),
  window: { PAINTINGS: [] },
});
vm.runInContext(famSrc, ctx);
vm.runInContext(read("js/produce.js"), ctx);
vm.runInContext(read("js/mapstudy.js"), ctx);
const run = (code, vars = {}) => { Object.assign(ctx, vars); return vm.runInContext(code, ctx); };

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.log("FAIL  " + msg); } };

// ---------- 1. level set sizes ----------
const core = CORE.map(e => ({ n: e.n, h: e.h, rank: e.rank }));
const every = () => core.concat(core.slice(0, 50)).concat(Array.from({ length: 1700 }, (_, i) => ({ n: "Library " + i, h: "#" + (i * 2731 % 0xffffff).toString(16).padStart(6, "0") })));
for (const l of [10, 15, 25, 50, 75, 100, 250, 614]) {
  const items = run("msLevelItems(__l, { core: __core, every: __every })", { __l: l, __core: core, __every: every });
  ok(items.length === l, `level ${l} has ${items.length} colors`);
  ok(items.every((it, i) => i === 0 || it.rank >= items[i - 1].rank), `level ${l} is in stage order`);
}
const all = run("msLevelItems('all', { core: __core, every: __every })");
ok(all.length === core.length + 1700, `"all" is every name once (got ${all.length})`);
ok(run("MS_LEVELS.length") >= 15 && run("MS_LEVELS[0]") === 10 && run("MS_LEVELS[MS_LEVELS.length - 1]") === "all", "the field dial is gradual: 15+ stops from 10 to every name");
ok(run("MS_LEVELS.slice(0, -1).every((l, i, a) => i === 0 || (l > a[i - 1] && l / a[i - 1] <= 1.6))"), "no stop on the field dial is more than 1.6x the one before");
ok(run("MS_HELP.slice(0, 3).join(',')") === "3,4,6" && run("MS_HELP[MS_WHOLE]") === Infinity, "help starts at 3 to pick from and ends at the whole field");
ok(run("msBoardSize(5, 12)") === Infinity && run("msBoardSize(2, 100)") === 6, "a board never holds more bubbles than the field");
ok(run("msHelpStart(10)") === 0 && run("msHelpStart(50)") === 1 && run("msHelpStart('all')") === 3, "small fields start with the most help");
ok(run("msNextLevel(10)") === 15 && run("msNextLevel('all')") === null, "growing the field steps one stop");
ok(!/\["path"/.test(read("js/mapstudy.js")) && run("MS_MODES.map(m => m[0]).join(',')") === "find,name,hood,light,wander", "Path is gone; Wander is in");

// ---------- 2. distractors: same family, fair (never near-identical) ----------
const pool = core.slice(0, 614);
let fams = 0, checked = 0;
for (const t of core.slice(0, 120)) {
  for (const k of [3, 5, 9]) {
    const fam = run("msFam(__t.h)", { __t: t });
    const avail = pool.filter(x => x.n !== t.n && run("msFam(__x.h)", { __x: x }) === fam && de2000(t.h, x.h) >= 4).length;
    const ds = run("msDistractors(__t, __pool, __k, msRnd(7))", { __t: t, __pool: pool, __k: k });
    ok(ds.length === k, `${t.n}: ${k} distractors (got ${ds.length})`);
    ok(!ds.some(d => d.n === t.n), `${t.n}: the answer is never its own distractor`);
    ok(ds.every(d => de2000(d.h, t.h) >= 4), `${t.n}: every distractor is visibly different from the answer`);
    ok(ds.every((a, i) => ds.every((b, j) => i === j || de2000(a.h, b.h) >= 4)), `${t.n}: no two distractors are near-identical`);
    if (avail >= k * 2) {   // where the family has room, every distractor comes from it
      checked++;
      const same = ds.every(d => run("msFam(__d.h)", { __d: d }) === fam);
      if (same) fams++;
      ok(same, `${t.n} (${fam}, k=${k}): distractors from other families: ${ds.filter(d => run("msFam(__d.h)", { __d: d }) !== fam).map(d => d.n).join(", ")}`);
    }
  }
}
ok(checked > 200, `same-family check ran on enough rounds (${checked})`);

// ---------- 3. scoring ----------
// Practice's policy: due + objective -> review; not due + miss -> due tomorrow; not due + hit -> nothing; never for unlearned
const c = ALL[0];
ctx.S.cards = { [c.id]: { b: 1, due: "2026-10-08" } };
calls.length = 0;
ok(run("msApply({ n: __c.n, c: __c }, true, 'pick')", { __c: c }) === "review" && calls.length === 1 && calls[0][3] === "pick", "a right answer on a due learned card is its review");
ctx.S.cards[c.id].due = "2026-10-20"; calls.length = 0;
ok(run("msApply({ n: __c.n, c: __c }, true, 'pick')") === "none" && !calls.length, "a right answer on a card that isn't due changes nothing");
ok(run("msApply({ n: __c.n, c: __c }, false, 'pick')") === "tomorrow" && ctx.S.cards[c.id].due === "2026-10-09", "a miss on a learned card makes it due tomorrow");
ok(run("msApply({ n: 'Celadon', c: null }, false, 'pick')") === "none", "an unlearned color never touches scheduling");
ctx.S.cards[c.id].due = "2026-10-01";
ok(run("msApply({ n: __c.n, c: __c }, true, null)") === "none", "a non-objective answer (Show me) never counts as a review");
// stars
ok(run("msStars(10,10)") === 3 && run("msStars(9,10)") === 3 && run("msStars(8,10)") === 2 && run("msStars(5,10)") === 1 && run("msStars(2,10)") === 0 && run("msStars(0,0)") === 0, "stars: 90% three, 70% two, 40% one");
// grading
const teal = { n: "Teal", h: "#008080" }, tealNb = { n: "Dark cyan", h: "#008B8B" }, far = { n: "Lemon", h: "#FFF44F" };
ok(run("msGrade(__a, __a, null, 0)", { __a: teal }) === "right", "same color is right");
ok(run("msGrade(__b, __a, null, true)", { __a: teal, __b: tealNb }) === "close", "a near-identical color on a big board is next door");
ok(run("msGrade(__b, __a, null, false)", { __a: teal, __b: tealNb }) === "wrong", "on a small board there is no partial credit");
ok(run("msGrade(__b, __a, new Set(['lemon']), true)", { __a: teal, __b: far }) === "close", "a map neighbor on a big board is next door");
ok(run("msGrade(__b, __a, new Set(), true)", { __a: teal, __b: far }) === "wrong", "a far color is wrong");
// the help staircase (For you): two right in a row widen it, a miss narrows it; Choose never moves
ok(run("msHelpNext(2, false, 0)") === 1, "a miss gives more help next");
ok(run("msHelpNext(0, false, 0)") === 0, "never below the most help");
ok(run("msHelpNext(2, true, 1)") === 2 && run("msHelpNext(2, true, 2)") === 3, "two right in a row widen the board");
ok(run("msHelpNext(MS_WHOLE, true, 4)") === run("MS_WHOLE"), "never past the whole field");
ok(run("msHelpNext(2, false, 0, false)") === 2 && run("msHelpNext(2, true, 2, false)") === 2, "Choose stays where you put it");
// options come from the field when it's big enough, else topped up from the first core names
ok(run("msOptPool(__f, __c, 3)", { __f: core.slice(0, 30), __c: core }).length === 30, "a 30-color field gives its own wrong options");
ok(run("msOptPool(__f, __c, 5)", { __f: core.slice(0, 10), __c: core }).length > 10, "a 10-color field is topped up so six options stay fair");
// direction words
ok(/lighter/.test(run("msDir({h:'#9FD8D8'}, {h:'#008080'})")), "a paler teal reads as lighter");

// ---------- 4. fog: a view only, never a default ----------
ctx.S = { cards: {} };
const spec = run("msState().spec");
ok(spec.fog === false, "a fresh state has the fog off");
ok(spec.mode === "find" && spec.level === 10 && spec.diff === "you", "a fresh state starts at Find it, 10 colors, For you");
ctx.S = { cards: {}, mapstudy: { spec: { mode: "path", level: 250, diff: "edge" } } };
const old = run("msState().spec");
ok(old.mode === "find" && old.diff === "you" && old.level === 250 && old.help >= 0, "a v1 save (Path, Edge of my eye) migrates to Find it, For you, same field");
ctx.S = { cards: {} };
const known = new Set(["teal"]);
ok(run("msFogFor(__s, 'preview', __k)", { __s: spec, __k: known }) === null, "the default spec draws no fog");
ok(run("msFogFor({ fog: true }, 'play', __k)") === null, "the fog never shows during play, even when turned on");
const fog = run("msFogFor({ fog: true }, 'preview', __k)");
ok(typeof fog === "function" && fog({ n: "Teal" }) === true && fog({ n: "Celadon" }) === false, "turned on, the preview veils only unknown colors");
ok(/fog: false/.test(read("js/mapstudy.js").match(/const d = \{ mode[^}]*\}/)[0]), "the saved-state default is fog: false");
// the screen holds S.mapstudy.spec; a later msState() call must keep that same object (v1 swapped it for a copy)
ctx.S = { cards: {} };
const s1 = run("msState().spec"); s1.level = 25;
ok(run("msState().spec") === s1 && run("msState().spec.level") === 25, "msState keeps the same spec object, so the dials' changes stick");
ctx.S = { cards: {} };
ok(!/study\(\{[^}]*fog: *(true|msKnown|o =>)/.test(read("js/mapstudy.js").replace(/data-fog-end[\s\S]*?\}\);/, "")), "no study() call turns the fog on except the two opt-in switches");

// ---------- 5. the map graph ----------
// a 9x7 hex patch, finite: interior points have six neighbors
const SQ3 = Math.sqrt(3) / 2, pts = [];
for (let r = 0; r < 7; r++) for (let j = 0; j < 9; j++) pts.push({ n: `c${r}-${j}`, x: j + (r & 1 ? .5 : 0), y: r * SQ3 });
const g = run("msGraph({ pts: __p, finite: true })", { __p: pts });
ok(g.get("c3-4").size === 6, `an interior bubble has six neighbors (got ${g.get("c3-4").size})`);
ok(g.get("c0-0").size === 2 || g.get("c0-0").size === 3, "a corner bubble has two or three");
// wrapped: the same patch tiled, so the edge wraps to the far side
const gw = run("msGraph({ pts: __p, finite: false, A: [9, 0], B: [0, 7 * __s] })", { __s: SQ3 });
ok(gw.get("c3-0").has("c3-8"), "on a wrapping map, neighbors cross the seam");
const bw = run("msBetween(__g, 'c3-0', 'c3-6', 4)", { __g: g });
ok(bw.length === 4 && !bw.includes("c3-0") && !bw.includes("c3-6"), `the reveal path names up to four colors strictly between (got ${bw.join(",")})`);
ok(run("msBetween(__g, 'c3-3', 'c3-4', 4)").length === 0, "next-door colors have nothing between them");
const hood = run("msHood(__g, 'c3-4', 7)");
ok(hood.length === 7 && hood[0] === "c3-4" && hood.slice(1).every(n => g.get("c3-4").has(n)), "a 7-color neighborhood is the center and its ring");
// the queue: due cards come first
const q = run("msQueue(__t, 4, { due: new Set(['c']), miss: new Set(['b']), found: new Set(['a','b','c']) }, msRnd(1))",
  { __t: ["a", "b", "c", "d", "e"].map(n => ({ n, h: "#808080" })) });
ok(q[0].n === "c" && q[1].n === "b", `due first, then earlier misses, then never found (got ${q.map(x => x.n).join("")})`);

console.log(`mapstudy: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
