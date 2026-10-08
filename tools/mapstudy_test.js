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
for (const l of [10, 25, 50, 100, 250, 614]) {
  const items = run("msLevelItems(__l, { core: __core, every: __every })", { __l: l, __core: core, __every: every });
  ok(items.length === l, `level ${l} has ${items.length} colors`);
  ok(items.every((it, i) => i === 0 || it.rank >= items[i - 1].rank), `level ${l} is in stage order`);
}
const all = run("msLevelItems('all', { core: __core, every: __every })");
ok(all.length === core.length + 1700, `"all" is every name once (got ${all.length})`);
ok(run("MS_LEVELS.join(',')") === "10,25,50,100,250,614,all", "the level ladder is 10, 25, 50, 100, 250, 614, all");
ok(run("msDefaultDiff(10)") === "easy" && run("msDefaultDiff(50)") === "medium" && run("msDefaultDiff('all')") === "hard", "early levels start easy, big ones hard");
ok(run("MS_BOARD.slice(0,3).join(',')") === "4,6,10", "early boards are 4 to 10 bubbles");

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
ok(run("msGrade(__b, __a, null, 3)", { __a: teal, __b: tealNb }) === "close", "a near-identical color on the whole map is next door");
ok(run("msGrade(__b, __a, null, 1)", { __a: teal, __b: tealNb }) === "wrong", "on a small board there is no partial credit");
ok(run("msGrade(__b, __a, new Set(['lemon']), 3)", { __a: teal, __b: far }) === "close", "a map neighbor on the whole map is next door");
ok(run("msGrade(__b, __a, new Set(), 3)", { __a: teal, __b: far }) === "wrong", "a far color is wrong");
// breathing difficulty
ok(run("msBreathNext(1, false, 0, 'easy')") === 0, "a miss eases the next round");
ok(run("msBreathNext(0, false, 0, 'easy')") === 0, "never below the band");
ok(run("msBreathNext(0, true, 2, 'easy')") === 0 && run("msBreathNext(0, true, 3, 'easy')") === 1, "three right in a row opens the board");
ok(run("msBreathNext(1, true, 6, 'easy')") === 1, "never above the band");
ok(run("msBreathNext(2, true, 3, 'hard')") === 3, "hard opens to the whole map");
// direction words
ok(/lighter/.test(run("msDir({h:'#9FD8D8'}, {h:'#008080'})")), "a paler teal reads as lighter");

// ---------- 4. fog: a view only, never a default ----------
ctx.S = { cards: {} };
const spec = run("msState().spec");
ok(spec.fog === false, "a fresh state has the fog off");
ok(spec.mode === "find" && spec.level === 10 && spec.diff === "easy", "a fresh state starts at Find it, 10 colors, easy");
const known = new Set(["teal"]);
ok(run("msFogFor(__s, 'preview', __k)", { __s: spec, __k: known }) === null, "the default spec draws no fog");
ok(run("msFogFor({ fog: true }, 'play', __k)") === null, "the fog never shows during play, even when turned on");
const fog = run("msFogFor({ fog: true }, 'preview', __k)");
ok(typeof fog === "function" && fog({ n: "Teal" }) === true && fog({ n: "Celadon" }) === false, "turned on, the preview veils only unknown colors");
ok(/fog: false/.test(read("js/mapstudy.js").match(/m\.spec = Object\.assign\(\{[^}]*\}/)[0]), "the saved-state default is fog: false");
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
const pp = run("msPathPick(__g, 'c3-1', 4, null, msRnd(3))", { __g: g });
ok(pp && pp.len === 4 && run("msBfs(__g, 'c3-1')").get(pp.goal) === 4, "a path's goal is exactly the asked number of steps away");
const hood = run("msHood(__g, 'c3-4', 7)");
ok(hood.length === 7 && hood[0] === "c3-4" && hood.slice(1).every(n => g.get("c3-4").has(n)), "a 7-color neighborhood is the center and its ring");
// the queue: due cards come first
const q = run("msQueue(__t, 4, { due: new Set(['c']), miss: new Set(['b']), found: new Set(['a','b','c']) }, msRnd(1))",
  { __t: ["a", "b", "c", "d", "e"].map(n => ({ n, h: "#808080" })) });
ok(q[0].n === "c" && q[1].n === "b", `due first, then earlier misses, then never found (got ${q.map(x => x.n).join("")})`);

console.log(`mapstudy: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
