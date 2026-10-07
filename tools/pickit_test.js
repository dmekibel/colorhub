// Tests for js/pickit.js: Pick it distractors, new shades, ownership rules, migration of old saves, placement verdicts
// and the review mixing. Run: node tools/pickit_test.js
// Uses the app's own color math (the "color math" section of js/core.js) so the test and the app can't drift apart.
const fs = require("fs"), path = require("path"), vm = require("vm");
const window = {};
new Function("window", fs.readFileSync(path.join(__dirname, "../data/colors.js"), "utf8"))(window);
const D = window.DATA;
const UNITS = D.units.map((u, i) => ({ ...u, i, colors: u.colors.map(c => ({ ...c, id: u.id + ":" + c.n })) }));
UNITS.forEach(u => u.colors.forEach(c => { c.unit = u; }));
const ALL = UNITS.flatMap(u => u.colors);
const BASICS = D.basics.map(([n, h]) => ({ n, h, id: "basic:" + n, basic: true }));

const core = fs.readFileSync(path.join(__dirname, "../js/core.js"), "utf8");
const math = core.slice(core.indexOf("// ---------- color math"), core.indexOf("// ---------- data index"));
const T0 = "2026-10-07";
const pad = n => String(n).padStart(2, "0");
const keyOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const ctx = vm.createContext({
  Math, String, Array, Object, Map, JSON, Number, D, UNITS, ALL, BASICS,
  clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
  shuffle: a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; },
  today: () => T0,
  addDays: (k, n) => { const [y, m, d] = k.split("-").map(Number); return keyOf(new Date(y, m - 1, d + n)); },
  save: () => {}, S: undefined,
});
vm.runInContext(math, ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, "../js/pickit.js"), "utf8"), ctx);
const run = code => vm.runInContext(code, ctx);
const de = (a, b) => { ctx.__a = a; ctx.__b = b; return run("de2000(__a, __b)"); };

let pass = 0, fail = 0;
const ok = (cond, label) => { cond ? pass++ : fail++; if (!cond) console.log("FAIL  " + label); };

// ---------- distractors: same family, distinct, never the answer twice ----------
const GAP = run("PICK_GAP"), FAMILY = 22;   // nearest names: every option within FAMILY of the answer (three blues, not a blue and a yellow)
let worst = 0, worstName = "";
for (const c of ALL) {
  ctx.__c = c;
  const opts = run("pickOptions(__c)");
  ok(opts.length === 4, `${c.n}: 4 options (got ${opts.length})`);
  ok(opts.filter(o => o.ok).length === 1, `${c.n}: exactly one right answer`);
  ok(opts.find(o => o.ok).c === c && opts.find(o => o.ok).h === c.h, `${c.n}: the right option is the color itself`);
  const names = opts.map(o => o.c.n.toLowerCase()), hexes = opts.map(o => o.h.toUpperCase());
  ok(new Set(names).size === 4, `${c.n}: four different names (${names})`);
  ok(new Set(hexes).size === 4, `${c.n}: four different swatches`);
  ok(names.filter(n => n === c.n.toLowerCase()).length === 1, `${c.n}: the answer appears once`);
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
    const d = de(opts[i].h, opts[j].h);
    ok(d >= GAP, `${c.n}: ${opts[i].c.n} and ${opts[j].c.n} are too close to tell apart (ΔE ${d.toFixed(1)})`);
  }
  opts.filter(o => !o.ok).forEach(o => {
    const d = de(c.h, o.h);
    if (d > worst) { worst = d; worstName = `${c.n} / ${o.c.n}`; }
    ok(d <= FAMILY, `${c.n}: ${o.c.n} is obviously different (ΔE ${d.toFixed(1)} > ${FAMILY})`);
  });
  // the three are the nearest qualifying names: nothing skipped that was nearer and fair
  const near = run("pickNear(__c)"), far = Math.max(...near.map(x => de(c.h, x.h)));
  const pool = [...BASICS, ...ALL].filter(x => x.n !== c.n && !near.includes(x) && de(c.h, x.h) < far && de(c.h, x.h) >= GAP);
  ok(pool.every(x => near.some(y => de(x.h, y.h) < GAP)), `${c.n}: a nearer fair name was skipped`);
}
console.log(`distractors: farthest wrong option is ΔE ${worst.toFixed(1)} (${worstName})`);

// ---------- new shades for the self-test ----------
let noShade = 0;
for (const c of ALL) {
  ctx.__c = c;
  const sh = run("pickShade(__c, pickNear(__c))");
  if (!sh) { noShade++; console.log(`no shade for ${c.n}`); continue; }
  const d = de(c.h, sh);
  ok(d >= 4 && d <= 6, `${c.n}: shade ΔE ${d.toFixed(2)} outside 4-6`);
  ctx.__sh = sh;
  const near = run("pickNear(__c)");
  ok(near.every(x => de(sh, x.h) >= d + 1), `${c.n}: shade ${sh} drifted toward another name`);
}
ok(noShade === 0, `${noShade} colors without a new shade`);

// ---------- ownership: a swipe can't make a name yours; a check a day later can ----------
const own = (st, okk, by) => { ctx.__st = st; ctx.__ok = okk; ctx.__by = by; run("pickOwn(__st, __ok, __by, today())"); return st; };
const mine = st => { ctx.__st = st; return run("isMine(__st)"); };
let st = own({ b: 1, since: "2026-10-01" }, true, "swipe");
ok(st.own && st.ownBy === "swipe" && !mine(st), "a right swipe is self-graded, not yours");
own(st, true, "pick");
ok(mine(st) && st.ownAt === T0, "a right Pick it a day later makes it yours");
own(st, true, "swipe");
ok(mine(st) && st.ownBy === "pick", "a later swipe doesn't downgrade a check");
own(st, false, "swipe");
ok(!st.own && !st.ownBy && !mine(st), "a miss clears it");
st = own({ b: 1, since: T0 }, true, "say");
ok(st.own && !mine(st), "a check on the day of learning doesn't count");
st = own({ b: 2, since: "2026-09-30", own: false, placed: "2026-09-30" }, true, "make");
ok(mine(st) && !st.placed, "a placed color confirmed by Make it");

// ---------- migration of old saves ----------
const old = { v: 1, cards: {
  "a": { b: 2, due: "2026-10-09", since: "2026-09-20", own: true },
  "b": { b: 0, due: "2026-10-08", since: "2026-10-06", own: false },
  "c": { b: 3, due: "2026-10-20", since: "2026-09-01", own: true, ownBy: "pick", ownAt: "2026-09-25" },
  "d": { b: 1, due: "2026-10-10", since: "2026-10-01", own: true, last: "2026-10-07" },
} };
const before = JSON.stringify(old.cards.b);
ctx.__s = old;
const marked = run("pickMigrate(__s)");
ok(marked === 2, `migration marks the two swipe-owned cards (got ${marked})`);
ok(old.cards.a.own === true && old.cards.a.ownBy === "swipe" && old.cards.a.b === 2 && old.cards.a.due === "2026-10-09", "old own kept, marked self-graded, schedule untouched");
ok(!mine(old.cards.a) && !mine(old.cards.d), "migrated cards are not counted as yours");
ok(mine(old.cards.c) && old.cards.c.ownBy === "pick", "an already confirmed card is untouched");
ok(JSON.stringify(old.cards.b) === before, "a card still learning is untouched");
ok(old.ownV === 2, "save marked as migrated");
ok(run("pickMigrate(__s)") === 0, "migration is idempotent");
// a save with no ownBy at all still reads honestly without migrating
ok(!mine({ own: true }), "own without ownBy is never counted as yours");

// ---------- placement verdicts ----------
const V = arr => { ctx.__a = arr.map(x => ({ ok: !!x })); return run("placeVerdict(__a)"); };
ok(V([1, 1, 1, 1, 1, 1]) === true, "six right in a row passes");
ok(V([0, 0, 0]) === false, "three misses fails early");
ok(V([1, 1, 1, 1, 1]) === null, "five right: keep asking");
ok(V([1, 0, 1, 0, 1, 1, 1, 1]) === true, "6 of 8 passes");
ok(V([1, 0, 1, 0, 1, 1, 1, 0]) === false, "5 of 8 fails");
ok(V([]) === null, "nothing yet: keep asking");
// chance of passing by guessing (1 in 4), by simulation
let lucky = 0;
for (let i = 0; i < 20000; i++) { const a = []; let v = null; while (v === null) { a.push(Math.random() < .25); v = V(a); } if (v) lucky++; }
ok(lucky / 20000 < .01, `guessing passes a tier ${(lucky / 200).toFixed(2)}% of the time`);

// ---------- placed tier: every color added, checked in a week, spread out ----------
ctx.S = { cards: { [ALL[0].id]: { b: 1, due: T0, since: "2026-10-01", own: false } } };
const added = run("placeSkip(2)"), t2 = ALL.filter(c => c.unit.tier === 2);
ok(added === t2.length - 1, `placeSkip adds every tier-2 color it doesn't already have (${added})`);
ok(ctx.S.cards[ALL[0].id].b === 1, "placeSkip leaves a card already in progress alone");
const dues = t2.slice(1).map(c => ctx.S.cards[c.id].due);
ok(dues.every(d => d >= "2026-10-14" && d <= "2026-10-20"), "placed colors are first checked on days 7 to 13");
ok(Math.max(...Object.values(dues.reduce((m, d) => (m[d] = (m[d] || 0) + 1, m), {}))) <= Math.ceil(t2.length / 7), "placed checks are spread over the week");

// ---------- review mixing: Pick it for unconfirmed names, never two non-swipe cards in a row ----------
for (let trial = 0; trial < 400; trial++) {
  const cards = {}, q = [];
  ALL.slice(0, 3 + (trial % 28)).forEach((c, i) => {
    const r = Math.random(), b = r < .25 ? 0 : 1 + (i % 4);
    cards[c.id] = { b, due: T0, since: r < .1 ? T0 : "2026-10-01", own: r > .5, ownBy: r > .8 ? "pick" : r > .5 ? "swipe" : undefined };
    q.push({ c, dir: "f", kind: Math.random() < .2 ? (b >= 2 ? "make" : "say") : undefined });
  });
  ctx.S = { cards }; ctx.__q = q;
  const out = run("pickMix(__q)");
  ok(out.length === q.length && new Set(out.map(x => x.c.id)).size === q.length, `trial ${trial}: every card kept once`);
  let adj = false; for (let i = 1; i < out.length; i++) if (out[i].kind && out[i - 1].kind) adj = true;
  ok(!adj, `trial ${trial}: two non-swipe cards in a row`);
  out.filter(x => x.kind === "pick").forEach(x => {
    const s = cards[x.c.id];
    ok(s.b >= 1 && !mine(s) && s.since < T0, `trial ${trial}: Pick it on a card that shouldn't get one`);
  });
  // with room, every eligible card gets a check
  const elig = q.filter(x => { const s = cards[x.c.id]; return s.b >= 1 && !mine(s) && s.since < T0; });
  const plainN = q.length - q.filter(x => x.kind).length - elig.filter(x => !x.kind).length;
  if (plainN + 1 >= elig.length + q.filter(x => x.kind && !elig.includes(x)).length)
    ok(elig.every(x => out.find(y => y.c === x.c).kind), `trial ${trial}: an eligible card missed its check despite room`);
}

console.log(`${pass + fail} cases: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
