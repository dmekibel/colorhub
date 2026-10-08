// Tests for js/learnmore.js (lane L9a, learning past the first units) and the core.js pieces it plugs into:
// migration keeps old cards, dueList over mixed card ids, card id round trips, solvable same-family look-alikes,
// and the unit generator's order, family mixing, compounds-after-base and skips.
// Run: node tools/learn_test.js   (uses the app's own code, sliced out of js/core.js, so the test can't drift)
const fs = require("fs"), path = require("path"), vm = require("vm");
const R = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const window = {};
new Function("window", R("data/colors.js"))(window);
const core = R("js/core.js");
const cut = (a, b) => { const i = core.indexOf(a), j = core.indexOf(b, i); if (i < 0 || j < 0) throw new Error("core.js section moved: " + a); return core.slice(i, j); };
const T0 = "2026-10-08";
const ctx = vm.createContext({
  Math, String, Array, Object, Map, Set, JSON, Number, Date, Promise, RegExp, Infinity, isFinite, console,
  window, matchMedia: () => ({ matches: false }), addEventListener: () => {}, document: { addEventListener: () => {} },
  esc: s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])),
  shuffle: a => a.slice(), clamp: (v, a, b) => Math.max(a, Math.min(b, v)), save: () => {}, fetch: () => Promise.reject(new Error("no network")),
});
const run = code => vm.runInContext(code, ctx);
run(cut("// ---------- color math", "// ---------- percent display"));
run("const D = window.DATA;");
run(cut("// ---------- data index", "// ---------- days"));
run(cut("// ---------- days", "// ---------- state").replace(/const today = [^\n]+/, `const today = () => "${T0}";`));
run(cut("const KEY = ", "let S;"));
run("var S = fresh();");
run(cut("// ---------- spaced review", "// ---------- icons"));
run(R("js/pickit.js"));
run(R("js/lookalikes.js"));
run(R("js/learnmore.js"));
run(R("js/learnit.js"));
// the name lists, as the app's loaders would hand them over
ctx.__core = JSON.parse(R("data/core-names.json"));
ctx.__lib = JSON.parse(R("data/library.json")).filter(x => !x.crude && /^#[0-9A-Fa-f]{6}$/.test(x.h));
run(`var CORE_NAMES = null; var loadCoreNames = () => { CORE_NAMES = CORE_NAMES || __core.map(e => ({ ...e, lab: lab(e.h) })); return Promise.resolve(CORE_NAMES); };
     var __long = null; var loadLongNames = () => { __long = __long || __lib.map(x => ({ ...x, lab: lab(x.h) })); return Promise.resolve(__long); };`);

let pass = 0, fail = 0;
const ok = (cond, label) => { cond ? pass++ : fail++; if (!cond) console.log("FAIL  " + label); };
const de = (a, b) => { ctx.__a = a; ctx.__b = b; return run("de2000(__a, __b)"); };

(async () => {
  // ---------- 1. migration keeps every old card ----------
  const old = { v: 1, placed: { tier: 2, at: "2026-09-01" }, cards: { "t2-blues:Teal": { b: 2, due: "2026-10-09", since: "2026-09-01", own: true, ownBy: "pick" }, "t2-reds:Gone": { b: 1, due: "2026-10-01" } }, done: { "t2-blues": "2026-09-01" }, mystery: 7 };
  ctx.__old = JSON.parse(JSON.stringify(old));
  const m = run("migrateState(__old)");
  ok(m.v === run("STATE_V") && m.v >= 3, `migrated to the current version (v${m.v})`);
  ok(Object.keys(m.cards).length === 2 && m.cards["t2-blues:Teal"].b === 2 && m.cards["t2-blues:Teal"].ownBy === "pick", "old unit cards kept as they were");
  ok(m.cards["t2-blues:Teal"].n === "Teal" && /^#/.test(m.cards["t2-blues:Teal"].h), "old unit cards backfilled with their name and hex");
  ok(!m.cards["t2-reds:Gone"].n && m.cards["t2-reds:Gone"].b === 1, "a card for a color no longer in the data is kept untouched");
  ok(m.mystery === 7 && m.done["t2-blues"] === "2026-09-01" && m.learn && typeof m.learn === "object", "unknown keys kept, earlier steps still run");
  ctx.__new = { v: 99, cards: { "core:chestnut": { b: 1 } }, odd: true };
  const n2 = run("migrateState(__new)");
  ok(n2.v === 99 && n2.odd && n2.cards["core:chestnut"].b === 1, "a newer save is kept as it is");
  ok(run("migrateState(migrateState(__old)).v") === m.v, "migration is idempotent");

  // ---------- 2. card ids and dueList over mixed ids (before the lists load: cards resolve from their own n/h) ----------
  run(`S = fresh(); S.placed = { tier: 2, at: "2026-09-01" };
    S.cards["t2-blues:Teal"] = { b: 1, due: "2026-10-07", since: "2026-09-01", own: true, ownBy: "pick" };
    S.cards["core:chestnut"] = { b: 0, due: "2026-10-06", since: "2026-10-05", own: false, n: "Chestnut", h: "#954535" };
    S.cards["lib:pig-pink"] = { b: 2, due: "2026-10-08", since: "2026-09-20", own: true, ownBy: "say", n: "Pig Pink", h: "#E78EA5" };
    S.cards["core:not-due"] = { b: 1, due: "2026-11-01", since: "2026-09-01", own: false, n: "Not due", h: "#336699" };
    S.cards["basic:Red"] = { b: 1, due: "2026-10-01" };`);
  let due = run("dueList().map(c => c.id)");
  ok(JSON.stringify(due) === JSON.stringify(["core:chestnut", "t2-blues:Teal", "lib:pig-pink"]), `dueList covers every kind of card, oldest due first, never a basic (${due})`);
  ok(run("ownedCount()") === 2, "ownedCount counts yours across unit, core and library cards");
  ok(run("ownCounts().mine") === 2 && run("ownCounts().learning") === 2, "ownCounts runs over every card");
  ok(run(`colorForCard("core:chestnut").n`) === "Chestnut", "a core card resolves from its own name before the list loads");
  ok(run(`cardIdFor({ n: "Teal" })`) === "t2-blues:Teal" && run(`cardIdFor("Red")`) === null, "first-unit names keep their unit id; basics are never a card");

  await run("loadCoreNames()");
  await run("lxLibLoad()");
  ok(run(`colorForCard("core:chestnut") === lxCore().bySlug.get("chestnut")`) || !run(`lxCore().bySlug.has("chestnut")`), "after loading, a core card resolves to the shared list object");
  due = run("dueList().map(c => c.id)");
  if (due.length !== 3) console.log("due after load:", due);
  ok(due.length === 3 && due.includes("core:chestnut") && due.includes("lib:pig-pink"), "dueList still covers the same cards after the lists load");
  // round trip for every core name and every learnable library color
  const rt = run(`lxCore().list.filter(c => !c.basic).every(c => colorForCard(cardIdFor(c)) === c)`);
  ok(rt, "every core name: colorForCard(cardIdFor(c)) is c");
  ok(run(`lxLib().list.every(c => colorForCard(cardIdFor(c)) === c)`), "every library color: colorForCard(cardIdFor(c)) is c");
  ok(run(`lxCore().list.filter(c => c.basic).every(c => cardIdFor(c) === null)`), "no basic ever gets a card id");
  ok(run(`new Set(lxCore().list.map(cardIdFor).filter(Boolean)).size === lxCore().list.filter(c => !c.basic).length`), "card ids are unique across the core list");
  // the deck reads c.unit.title, neighbor(c) and c.d for any card
  ok(run(`[colorForCard("core:chestnut") || lxCore().list[200]].every(c => c.unit && c.unit.title)`), "a color past the first units has a unit title for the deck");

  // ---------- 3. look-alikes: same family, solvable ----------
  const MIN = run("LX_LOOK_MIN"), MAX = run("LX_LOOK_MAX");
  const coreN = run("lxCore().list.length");
  let famMiss = 0, groups = 0, lonely = 0;
  for (let i = 0; i < coreN; i++) {
    ctx.__i = i;
    const r = run(`(() => { const c = lxCore().list[__i]; const L = lookalikes(c, 6); return { n: c.n, h: c.h, L: L.map(o => ({ n: o.x.n, h: o.x.h, d: o.d, fam: lxSameFam(c, o.x), id: o.x.id, basic: !!o.x.basic })), G: lxGroup(c).map(x => ({ n: x.n, h: x.h, basic: !!x.basic, id: x.id })) }; })()`);
    r.L.forEach(o => { ok(o.d >= MIN - 1e-9 && o.d <= MAX + 1e-9, `${r.n}: look-alike ${o.n} is ${o.d.toFixed(1)}% (outside ${MIN}-${MAX})`); ok(o.n.toLowerCase() !== r.n.toLowerCase(), `${r.n}: never itself`); if (!o.fam) famMiss++; });
    if (r.L.length < 2) lonely++;
    const g = [{ n: r.n, h: r.h }, ...r.G];
    r.G.forEach(x => ok(!x.basic && x.id, `${r.n}: group member ${x.n} is learnable (has a card id, not a basic)`));
    for (let a = 0; a < g.length; a++) for (let b = a + 1; b < g.length; b++) ok(de(g[a].h, g[b].h) >= MIN, `${r.n}: group pair ${g[a].n} / ${g[b].n} too close to tell apart (${de(g[a].h, g[b].h).toFixed(1)}%)`);
    if (r.G.length) groups++;
  }
  ok(famMiss / (coreN * 6) < .05, `look-alikes stay in their family (${famMiss} cross-family fill-ins)`);
  ok(groups / coreN > .97, `Learn it has a group for almost every core name (${groups} of ${coreN})`);
  // Pick it boards for names past the first units: 4 options, all apart, same family first
  let pickFam = 0, picks = 0;
  run("PICK_NEAR.clear()");
  for (let i = 0; i < coreN; i += 3) {
    ctx.__i = i;
    const o = run(`(() => { const c = lxCore().list[__i]; return pickOptions(c).map(x => ({ n: x.c.n, h: x.h, ok: x.ok, fam: lxSameFam(c, x.c) })); })()`);
    picks++;
    ok(o.length === 4 && o.filter(x => x.ok).length === 1, `pick board for #${i}: four options, one right`);
    for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) ok(de(o[a].h, o[b].h) >= 6, `pick board #${i}: ${o[a].n} / ${o[b].n} too close`);
    if (o.every(x => x.fam)) pickFam++;
  }
  ok(pickFam / picks > .9, `Pick it options are same-family (${pickFam} of ${picks} boards)`);

  // ---------- 4. the unit generator ----------
  const P = run(`(() => { const p = lxPlan(); return { ready: p.ready, total: p.total, words: p.words, vars: p.vars,
    stages: p.stages.map(s => ({ k: s.k, n: s.n, name: s.name, gen: s.gen, units: s.units.length, approx: !!s.approx })),
    units: p.units.filter(u => u.gen).map(u => ({ id: u.id, stage: u.stage, field: u.field, title: u.title, label: u.label,
      cs: u.colors.map(c => ({ n: c.n, h: c.h, id: c.id, kind: c.kind, fam: c.fam, ur: c.useRank, ord: c.ord, base: c.base ? c.base.n : "", baseOrd: c.base ? (c.base.ord === Infinity ? -2 : c.base.ord ?? -1) : null, field: c.field, teach: c.teach, d: c.d, vs: c.vs })) })) }; })()`);
  ok(P.ready, "the plan is ready once the lists are in");
  const allGen = P.units.flatMap(u => u.cs);
  const ids = allGen.map(c => c.id);
  ok(new Set(ids).size === ids.length, "no color appears twice on the path");
  const firstNames = new Set(run("[...BASICS, ...ALL].map(c => c.n.toLowerCase())"));
  ok(allGen.every(c => !firstNames.has(c.n.toLowerCase())), "the generated units never repeat a first-unit name or a basic");
  const coreRest = run(`lxCore().list.filter(c => !c.basic && !BYNAME.has(c.n.toLowerCase()) && c.teach !== false).length`);
  ok(allGen.filter(c => c.kind === "core").length === coreRest, `every learnable core name past the first units is on the path (${coreRest})`);
  ok(allGen.filter(c => c.kind === "lib").every(c => c.teach !== false), "teach:false library colors are skipped");
  ok(allGen.length === P.total - 101, `stage counts add up (${P.total} = 101 + ${allGen.length})`);
  // order: real words by useRank, displaced by at most the look-ahead window
  const words = allGen.filter(c => c.kind === "core" && !c.base);
  let worst = 0;
  const sorted = words.slice().sort((a, b) => a.ur - b.ur);
  words.forEach((c, i) => { worst = Math.max(worst, Math.abs(sorted.indexOf(c) - i)); });
  ok(worst <= 3 * run("LX_UNIT_N"), `real words follow useRank, never more than three units out of place (worst ${worst})`);
  ok(words.length && allGen.indexOf(words[words.length - 1]) < allGen.findIndex(c => c.base), "every real word comes before the first variation (Fluent before Expert)");
  // compounds after their base
  const vars = allGen.filter(c => c.base);
  ok(vars.length > 200, `compounds are taught as variations (${vars.length})`);
  ok(vars.every(c => c.baseOrd < c.ord), "every variation comes after its base word");
  ok(vars.every(c => /^You know .+\. This .+ one is .+\.$|^Nearly .+ itself/.test(c.d)), "a variation's line teaches it from its base word");
  ok(words.slice(0, 200).every(c => !c.d || / than .+\.$|^Almost the same as/.test(c.d)), "a real word's line compares it with a name met before it");
  // family mixing
  const MAXF = run("LX_FAM_MAX");
  const crowded = P.units.filter(u => { const f = {}; u.cs.forEach(c => { f[c.fam] = (f[c.fam] || 0) + 1; }); return Math.max(...Object.values(f)) > MAXF; });
  ok(crowded.length / P.units.length < .2, `families mix inside units (${crowded.length} of ${P.units.length} units over ${MAXF} of one family)`);
  const blocky = P.units.filter(u => new Set(u.cs.map(c => c.fam)).size === 1 && u.cs.length > 3);
  ok(blocky.length === 0, `no unit is a single-family block (${blocky.map(u => u.title)})`);
  // unit sizes and spread
  ok(P.units.every(u => u.cs.length >= 4 && u.cs.length <= 12), "every unit holds 4 to 12 names");
  const tight = P.units.filter(u => u.cs.some((a, i) => u.cs.some((b, j) => j > i && de(a.h, b.h) < 5)));
  ok(tight.length / P.units.length < .05, `names in one unit are apart (${tight.length} units hold a pair under 5%)`);
  // library: fields never mix inside a unit, no near-duplicate cards
  const libUnits = P.units.filter(u => u.cs[0].kind === "lib");
  ok(libUnits.every(u => u.cs.every(c => c.kind === "lib") && u.field), "library units are library-only and carry their field");
  ok(libUnits.every(u => new Set(u.cs.map(c => c.field || u.field)).size === 1), "a library unit never mixes fields");
  // stages
  const gs = P.stages.filter(s => s.gen);
  ok(P.stages.every((s, i) => !i || s.n > P.stages[i - 1].n), `stage counts rise (${P.stages.map(s => s.n)})`);
  ok(P.stages[1].n === 101 && P.stages[2].n === 150 && P.stages[3].n === 250 && P.stages[4].n === 400, "the first stages end at 101, 150, 250 and 400 names");
  const fl = gs.find(s => s.name === "Fluent"), ex = gs.find(s => s.name === "Expert"), last = gs[gs.length - 1];
  ok(fl && fl.n === 101 + words.length, `Fluent = every real color word (${fl && fl.n})`);
  ok(ex && ex.n === fl.n + vars.length, `Expert = Fluent plus every variation (${ex && ex.n})`);
  ok(last.name === "Every learnable color" && last.n === P.total && !last.approx, `the last checkpoint is every learnable color, sized from the data (${last.n})`);
  ok(P.units.every(u => u.title && !/the 101|\/101|of 101/i.test(u.title + " " + u.label)), "unit titles and labels never mention the 101");
  // ---------- 5. Edges (B3): the strip ----------
  for (const [a, b] of [["#008080", "#007BA7"], ["#954535", "#CD7F32"], ["#F7F6F2", "#16171A"], ["#FF00FF", "#FF69B4"]]) {
    ctx.__a = a; ctx.__b = b;
    const s1 = run("edgeStrip(__a, __b, 9)"), s2 = run("edgeStrip(__b, __a, 9)");
    ok(s1.hexes.length === 9 && s1.hexes[0] === a.toUpperCase() && s1.hexes[8] === b.toUpperCase(), `edge strip ${a}→${b}: nine steps, the two names at the ends`);
    ok(s1.mid >= 1 && s1.mid <= 8, `edge strip ${a}→${b}: the halfway mark sits inside the strip (${s1.mid})`);
    ok(JSON.stringify(s1.hexes.slice().reverse()) === JSON.stringify(s2.hexes), `edge strip ${a}→${b}: the same strip read backwards`);
    ok(Math.abs((s1.mid - 1) - (8 - s2.mid)) <= 1, `edge strip ${a}→${b}: halfway is symmetric (${s1.mid} vs ${s2.mid})`);
    ok(run("edgeStrip(__a, __b, 5).hexes.length") === 5, `edge strip ${a}→${b}: n steps`);
  }
  console.log(`path: 101 → ${P.stages.slice(2).map(s => (s.name ? s.name + " " : "") + s.n).join(" → ")} · ${P.units.length} generated units`);
  console.log(`${pass + fail} cases: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log("FAIL  " + (e.stack || e)); process.exit(1); });
