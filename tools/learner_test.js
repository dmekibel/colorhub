// Tests for js/learner.js (the Learner Model) and the migrateState step that adds it (js/core.js).
// Covers: the event cap and compaction (nothing lost), the readers, the backfill from an old save, and that
// migrateState keeps unknown keys. Run: node tools/learner_test.js
const fs = require("fs"), path = require("path"), vm = require("vm");
const read = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const core = read("js/core.js");
const slice = (a, b) => core.slice(core.indexOf(a), core.indexOf(b));

let pass = 0, fail = 0;
const ok = (cond, label) => { cond ? pass++ : fail++; if (!cond) console.log("FAIL  " + label); };

// a fresh app context: color math, the data index, days, state helpers, pickit (isMine), look-alikes, learner
function makeCtx(S) {
  const window = {};
  const timers = [];
  const ctx = vm.createContext({ window, Math, String, Array, Object, Map, Set, JSON, Number, Date, isFinite,
    setTimeout: fn => { timers.push(fn); return timers.length; }, clearTimeout: () => {}, saves: 0, document: { addEventListener: () => {} } });
  vm.runInContext(read("data/colors.js"), ctx);
  vm.runInContext("const D = window.DATA; const clamp = (v, a, b) => Math.max(a, Math.min(b, v));", ctx);
  vm.runInContext(slice("// ---------- color math", "// ---------- percent display"), ctx);
  vm.runInContext(slice("// ---------- data index", "// ---------- days"), ctx);
  vm.runInContext(slice("// ---------- days", "// a day key"), ctx);
  ctx.__S = S;
  vm.runInContext("var S = __S; const save = () => { saves++; };", ctx);
  vm.runInContext(read("js/pickit.js"), ctx);
  vm.runInContext(read("js/lookalikes.js"), ctx);
  vm.runInContext(read("js/learner.js"), ctx);
  ctx.flush = () => { while (timers.length) timers.shift()(); };
  return ctx;
}
const run = (ctx, code) => vm.runInContext(code, ctx);
const DAY = 864e5, NOW = Date.now();

// ---------- 1. migrateState keeps every unknown key, adds S.learn, never downgrades a newer save ----------
{
  const ctx = vm.createContext({ Math, Object, Array, JSON, Date, String, Number, Map });
  vm.runInContext("const ALL = [{ id: 'u1:Teal', n: 'Teal', h: '#008080' }];", ctx);   // the v3 step backfills unit cards from ALL
  vm.runInContext(slice("const KEY = ", "let S;"), ctx);
  const old = { v: 1, placed: { at: "2026-09-01" }, cards: { "u1:Teal": { b: 2, due: "2026-10-09" } }, someFutureKey: { keep: [1, 2] }, hm: { zoom: 1.4 }, palettes: [{ cols: ["#112233"] }] };
  ctx.__d = JSON.parse(JSON.stringify(old));
  const s = run(ctx, "migrateState(__d)");
  ok(s.v === 3, "migrate: v1 -> current");
  ok(s.cards["u1:Teal"].n === "Teal" && s.cards["u1:Teal"].h === "#008080", "migrate: v3 backfills a unit card's name and hex");
  ok(s.someFutureKey && s.someFutureKey.keep.length === 2, "migrate: an unknown key survives");
  ok(s.hm && s.hm.zoom === 1.4, "migrate: other lanes' keys survive");
  ok(s.cards["u1:Teal"].b === 2, "migrate: cards untouched");
  ok(s.learn && Array.isArray(s.learn.ev) && s.learn.bf === 0, "migrate: empty learner log added, backfill pending");
  ok(s.palettes[0].id, "migrate: older steps still run");
  ctx.__d = { v: 1, learn: "garbage" };
  const g = run(ctx, "migrateState(__d)");
  ok(g.learnUnreadable === "garbage" && Array.isArray(g.learn.ev), "migrate: an unreadable learn field is kept aside, not dropped");
  ctx.__d = { v: 2, learn: { ev: [{ t: 1, e: "seen", c: "Teal" }], agg: { c: {}, p: {} }, sets: {}, bf: 1 }, x: 1 };
  const k = run(ctx, "migrateState(__d)");
  ok(k.learn.ev.length === 1 && k.x === 1, "migrate: a v2 save keeps its log");
  ctx.__d = { v: 9, learn: { odd: true }, y: 2 };
  const f = run(ctx, "migrateState(__d)");
  ok(f.v === 9 && f.learn.odd === true && f.y === 2, "migrate: a newer save is kept as it is");
  // Study (js/learnset.js) adds only optional keys: a card's "from" and S.practice.ls.sets. No step, nothing dropped.
  ctx.__d = { v: 3, cards: { "u1:Teal": { b: 0, due: "2026-10-09", since: "2026-10-08", n: "Teal", h: "#008080", from: "s1abc" } },
    practice: { ls: { size: 8, best: {}, sets: { s1abc: { t: "The Milkmaid", src: "painting", r: "#/painting/milkmaid", hs: ["#008080"], at: "2026-10-08", last: "2026-10-08", climbed: ["teal"] } } } } };
  const st = run(ctx, "migrateState(__d)");
  ok(st.v === 3 && st.cards["u1:Teal"].from === "s1abc" && st.cards["u1:Teal"].b === 0, "migrate: a Study card keeps the set it came from");
  ok(st.practice.ls.sets.s1abc.src === "painting" && st.practice.ls.size === 8, "migrate: kept Study sets survive with their source");
}

// ---------- 2. backfill from a sample old save ----------
{
  const t = keyOfNow(0), t5 = keyOfNow(-5), t9 = keyOfNow(-9);
  const S = { v: 2, placed: { at: t9 }, cards: {}, daily: {}, palettes: [{ id: "pl1", cols: ["#AA3322", "#3355AA"], from: "Photo", at: t5 }] };
  const ctx0 = makeCtx({ v: 2, cards: {}, learn: { ev: [], agg: { c: {}, p: {} }, sets: {}, bf: 1 } });
  const all = run(ctx0, "ALL.map(c => ({ id: c.id, n: c.n }))");
  S.cards[all[0].id] = { b: 3, due: t, since: t9, own: true, ownBy: "pick", ownAt: t5, last: t5 };   // yours
  S.cards[all[1].id] = { b: 1, due: t, since: t5, own: true, ownBy: "swipe" };                      // self-graded only
  S.cards[all[2].id] = { b: 0, due: t, since: t5 };                                                  // learning
  S.daily[t5] = { n: all[5].n, ok: true };
  S.learn = { v: 1, ev: [], agg: { c: {}, p: {} }, sets: {}, bf: 0 };
  const ctx = makeCtx(S);
  ok(S.learn.bf === 1, "backfill: runs once at load");
  ctx.__n = all;
  ok(run(ctx, "knowState(__n[0].n)") === "yours", "backfill: a checked card is yours");
  ok(run(ctx, "knowState(__n[1].n)") === "learning", "backfill: a swipe-only card is learning, not yours");
  ok(run(ctx, "knowState(__n[2].n)") === "learning", "backfill: a new card is learning");
  ok(run(ctx, "knowState(__n[5].n)") !== "none", "backfill: a color-of-the-day answer counts as met");
  ok(S.learn.agg.c[run(ctx, "lnSlug(__n[0].n)")].t0 < NOW - 8 * DAY, "backfill: first-met date comes from the card");
  ok(S.learn.sets["palette:pl1"] && S.learn.sets["palette:pl1"].l === 1, "backfill: kept palettes become liked sets");
  ok(run(ctx, "knowState('Some Unknown Name')") === "none", "knowState: an unseen color is none");
  ok(run(ctx, "relMark(__n[0].n)") === "yours" && run(ctx, "relMark(__n[2].n)") === "met" && run(ctx, "relMark('Nothing Here')") === "", "relMark: yours / met / none");
  const html = run(ctx, "relMarkHTML(__n[0].n)");
  ok(/class="rel-mark" data-s="yours"/.test(html), "relMarkHTML: markup");
  // a second load doesn't backfill twice
  const before = JSON.stringify(S.learn.agg);
  makeCtx(S);
  ok(JSON.stringify(S.learn.agg) === before, "backfill: idempotent");
}

// ---------- 3. logging, readers ----------
{
  const S = { v: 2, placed: { at: "2026-09-01" }, cards: {}, learn: { ev: [], agg: { c: {}, p: {} }, sets: {}, bf: 1 } };
  const ctx = makeCtx(S);
  ok(run(ctx, "learnerLog(null)") === false && run(ctx, "learnerLog({ type: 'nonsense', color: 'Teal' })") === false, "learnerLog: rejects junk without throwing");
  ok(run(ctx, "learnerLog({ type: 'confuse', color: 'Teal', b: 'Teal' })") === false, "learnerLog: a color isn't confused with itself");
  ok(run(ctx, "learnerLog({ type: 'seen', color: { n: 'Teal', h: '#008080' }, src: 'page' })") === true, "learnerLog: seen");
  ok(S.learn.ev[0].h === "#008080" && S.learn.ev[0].c === "Teal", "learnerLog: stores name and hex");
  ctx.flush();
  ok(ctx.saves >= 1, "learnerLog: debounced into save()");
  // confusions: Teal answered as Turquoise 3x, Turquoise as Teal 1x, Teal as Aqua 1x
  run(ctx, `[1,2,3].forEach(() => learnerLog({ type: 'confuse', color: 'Teal', b: 'Turquoise', src: 'pick' }));
    learnerLog({ type: 'confuse', color: 'Turquoise', b: 'Teal', src: 'pick' });
    learnerLog({ type: 'confuse', color: { n: 'Teal', h: '#008080' }, b: { n: 'Aqua', h: '#00FFFF' }, src: 'say' });`);
  const top = run(ctx, "confusions(null, 5)");
  ok(top.length === 2 && top[0].n === 4, "confusions: pairs merged both ways, most frequent first");
  const mine = run(ctx, "confusions('Turquoise', 5)");
  ok(mine.length === 1 && mine[0].a === "Turquoise" && mine[0].b === "Teal" && mine[0].ab === 1 && mine[0].ba === 3, "confusions: per color, that color first, with direction");
  ok(run(ctx, "relMark('Teal')") === "confused", "relMark: a recent mix-up shows as confused");
  run(ctx, "learnerLog({ type: 'answer', color: 'Teal', ok: true, by: 'pick', at: Date.now() + 1000 })");
  ok(run(ctx, "relMark('Teal')") !== "confused", "relMark: a right answer after the mix-up clears it");
  // yours from the log: a check right on a later day than first met
  run(ctx, `learnerLog({ type: 'seen', color: { n: 'Zzlibrary Blue', h: '#2244AA' }, at: ${NOW - 3 * DAY} });
    learnerLog({ type: 'answer', color: { n: 'Zzlibrary Blue', h: '#2244AA' }, ok: true, by: 'swipe', at: ${NOW - DAY} });`);
  ok(run(ctx, "knowState('Zzlibrary Blue')") === "learning", "knowState: a self-graded swipe never makes a name yours");
  run(ctx, `learnerLog({ type: 'answer', color: { n: 'Zzlibrary Blue', h: '#2244AA' }, ok: true, by: 'type', at: ${NOW} })`);
  ok(run(ctx, "knowState('Zzlibrary Blue')") === "yours", "knowState: a typed check on a later day makes it yours");
  run(ctx, `learnerLog({ type: 'answer', color: { n: 'Zzlibrary Blue', h: '#2244AA' }, ok: false, by: 'pick', at: ${NOW + 10} })`);
  ok(run(ctx, "knowState('Zzlibrary Blue')") === "learning", "knowState: a later missed check takes it back");
  // sets and the trail
  run(ctx, `learnerLog({ type: 'seen', set: { kind: 'painting', id: 'g1', title: 'Venice', colors: [{ h: '#335577', share: .5 }, { h: '#E0C090', share: .3 }] }, src: 'painting', at: ${NOW + 20} });
    learnerLog({ type: 'seen', set: { kind: 'photo', id: 'ph1', title: 'Garden', colors: [{ h: '#336633' }, { h: '#AA4455' }] }, src: 'photo', at: ${NOW + 30} });
    learnerLog({ type: 'seen', set: { kind: 'painting', id: 'g1', title: 'Venice', colors: [{ h: '#335577' }] }, src: 'painting', at: ${NOW + 40} });`);
  const tr = run(ctx, "trail(3)");
  ok(tr.length === 3 && tr[0].key === "painting:g1" && tr[1].key === "photo:ph1" && tr[2].kind === "color", "trail: newest first, one entry per set, color pages too");
  ok(tr[0].colors[0].h === "#335577", "trail: sets carry their colors");
  ok(S.learn.sets["painting:g1"].s === 2, "sets: a re-opened set counts twice, stored once");
  const si = run(ctx, "seenIn('#345678')");
  ok(si.length === 1 && si[0].key === "painting:g1", "seenIn: finds the painting holding a close color");
  const it = run(ctx, "interests()");
  ok(it.length && it[0].strand === "painting", "interests: the strand you look at most comes first");
  // eye thresholds: fallback from S.gym
  S.gym = { skills: { hue: { hist: [["2026-10-01", 3.2], ["2026-10-02", 2.4]], fam: { Blues: 1.8 } }, value: { hist: [["2026-10-02", 4.1]] } } };
  ok(run(ctx, "eyeThreshold('blue')") === 1.8 && run(ctx, "eyeThreshold('Blues', 'hue')") === 1.8, "eyeThreshold: per family from the odd-one-out station");
  ok(run(ctx, "eyeThreshold('greens')") === 2.4, "eyeThreshold: falls back to the station's last score");
  ok(run(ctx, "eyeThreshold('greens', 'light')") === 4.1, "eyeThreshold: lightness axis");
  ok(run(ctx, "eyeThreshold('greens', 'chroma')") === null, "eyeThreshold: unmeasured axis is null");
  run(ctx, "var trEyeThreshold = (f, a) => 0.9;");
  ok(run(ctx, "eyeThreshold('blue')") === 0.9, "eyeThreshold: the Train lane's estimator wins when it exists");
  // edge of the map: unmet look-alikes of yours
  const first = run(ctx, "ALL[3]");
  S.cards[first.id] = { b: 3, own: true, ownBy: "pick", since: "2026-09-01", ownAt: "2026-09-05" };
  run(ctx, "LN_REV++");
  const edge = run(ctx, "edgeOfMap(5)");
  ok(edge.length > 0 && edge.every(e => run(ctx, `knowState(${JSON.stringify(e.n)})`) === "none") && edge[0].from.includes(first.n), "edgeOfMap: unmet neighbors of a color that's yours");
  // aliases
  ok(run(ctx, "lmLog === learnerLog && lmStatus === knowState && lmPairs === confusions && lmSeen === seenIn && lmEdge === edgeOfMap"), "aliases from the panel");
}

// ---------- 4. the cap and compaction: the log stays bounded and nothing is lost ----------
{
  const S = { v: 2, placed: null, cards: {}, learn: { ev: [], agg: { c: {}, p: {} }, sets: {}, bf: 1 } };
  const ctx = makeCtx(S);
  const CAP = run(ctx, "LN_CAP"), KEEP = run(ctx, "LN_KEEP"), N = CAP + 1700;
  run(ctx, `for (let i = 0; i < ${N}; i++) learnerLog({ type: 'answer', color: i % 2 ? 'Teal' : 'Coral', ok: i % 3 !== 0, by: 'pick', at: ${NOW - 5 * DAY} + i });
    for (let i = 0; i < 40; i++) learnerLog({ type: 'confuse', color: 'Coral', b: 'Salmon', at: ${NOW - 4 * DAY} + i });`);
  ok(S.learn.ev.length <= CAP && S.learn.ev.length >= KEEP, `cap: log stays between ${KEEP} and ${CAP} (got ${S.learn.ev.length})`);
  ok(S.learn.cn > 0, "cap: older events were compacted");
  const ix = run(ctx, "lnIndex()");
  const teal = ix.c[run(ctx, "lnSlug('Teal')")], coral = ix.c[run(ctx, "lnSlug('Coral')")];
  ok(teal.a + coral.a === N, `compaction: every answer still counted (${teal.a + coral.a} of ${N})`);
  let right = 0; for (let i = 0; i < N; i++) if (i % 3 !== 0) right++;
  ok(teal.r + coral.r === right, "compaction: right answers still counted");
  ok(run(ctx, "confusions('Coral', 1)")[0].n === 40, "compaction: pairs survive");
  ok(teal.t0 === NOW - 5 * DAY + 1, "compaction: first-met time survives");
  ok(JSON.stringify(S.learn).length < 600e3, `size: the log stays small (${Math.round(JSON.stringify(S.learn).length / 1024)} KB)`);
  // sets are capped too
  run(ctx, `for (let i = 0; i < 260; i++) learnerLog({ type: 'seen', set: { kind: 'painting', id: 'p' + i, title: 'P', colors: ['#112233'] }, at: ${NOW} + i });`);
  ok(Object.keys(S.learn.sets).length === run(ctx, "LN_SETS") && S.learn.sets["painting:p259"] && !S.learn.sets["painting:p0"], "sets: capped, newest kept");
  // a broken learn field is repaired, never thrown
  S.learn.ev = "oops";
  ok(run(ctx, "learnerLog({ type: 'seen', color: 'Teal' })") === true && Array.isArray(S.learn.ev), "repair: a damaged log field is rebuilt without throwing");
}

function keyOfNow(days) { const d = new Date(Date.now() - 4 * 3600e3 + days * DAY); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }

console.log(`learner test: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
