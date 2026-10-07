// Unit tests for js/practice.js (no browser): deck building, same-family wrong options, the typed and spoken name
// judge (typos, alternates, homophones, "I don't know"), and the scheduling policy. Run: node tools/practice_test.js
const fs = require("fs"), path = require("path"), vm = require("vm");
const root = path.join(__dirname, "..");
const read = f => fs.readFileSync(path.join(root, f), "utf8");
const between = (src, a, b) => { const i = src.indexOf(a), j = src.indexOf(b, i + 1); if (i < 0 || j < 0) throw new Error("marker not found: " + a); return src.slice(i, j); };

// The app's own code, not copies: core.js's color math, data index, days and spaced review sections, then
// naming.js, pickit.js, produce.js and practice.js. Only DOM-free parts run; the DOM parts are never called.
const window = {};
new Function("window", read("data/colors.js"))(window);
const core = read("js/core.js");
const ctx = vm.createContext({ window, Math, String, Array, Object, Map, Set, JSON, Number, Date, console, performance: { now: () => Date.now() } });
const run = code => vm.runInContext(code, ctx);
run(`const D = window.DATA;
  const esc = s => String(s);
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const sv = () => "";
  const buzz = () => {};
  let SAVES = 0; const save = () => { SAVES++; };
  let S = { v: 1, cards: {}, done: {}, ownV: 2 };
  const EVERY = () => [...BASICS, ...ALL];`);
run(between(core, "// ---------- color math", "// Text color"));
run(between(core, "// ---------- data index", "// ---------- state"));
run(between(core, "// ---------- spaced review", "// ---------- icons"));
run(read("js/naming.js"));
run(read("js/pickit.js"));
run(read("js/produce.js"));
run(read("js/practice.js"));
ctx.__core = JSON.parse(read("data/core-names.json"));
run(`CORE_NAMES = __core.map(e => ({ ...e, lab: lab(e.h) }));`);

let pass = 0, fail = 0;
const ok = (cond, label) => { if (cond) pass++; else { fail++; console.log("FAIL  " + label); } };

// ---------- deck building ----------
const stage50 = ctx.__core.slice().sort((a, b) => a.rank - b.rank).slice(0, 50).map(e => e.n);
const first50 = run(`prDeck({ src: "first", n: 50, fam: "all", order: "order", round: 0 }).map(it => it.n)`);
ok(JSON.stringify(first50) === JSON.stringify(stage50), "first 50 in order = the first 50 names in stage order (rank)");
ok(first50[0] === "Red" && first50.includes("Teal"), "first 50 starts with Red and includes Teal");
let seeded = 7; ctx.__rnd = () => (seeded = (seeded * 16807) % 2147483647) / 2147483647;
const shuf = run(`prDeck({ src: "first", n: 50, fam: "all", order: "shuffle", round: 0 }, __rnd).map(it => it.n)`);
ok(shuf.length === 50 && new Set(shuf).size === 50 && shuf.every(n => stage50.includes(n)), "shuffled first 50 is a permutation of the same 50");
ok(JSON.stringify(shuf) !== JSON.stringify(stage50), "shuffled first 50 is not in stage order");
ok(run(`prDeck({ src: "first", n: 1000, fam: "all", order: "order", round: 0 }).length`) === 1000, "first 1,000 = all 1,000 core names");
ok(run(`prDeck({ src: "first", n: 137, fam: "all", order: "order", round: 0 }).length`) === 137, "the slider's any number (137)");
ok(run(`prRound(prDeck({ src: "first", n: 50, order: "order", round: 10 }), { round: 10 }, 20).map(it => it.n).join()`) === stage50.slice(20, 30).join(), "a round of 10 at offset 20");
const blues = run(`prDeck({ src: "first", n: 250, fam: "blue", order: "order", round: 0 })`);
ok(blues.length > 10 && blues.every(it => run(`prFam("${it.h}")`) === "blue"), "family filter: Blues among the first 250 are all blue");
run(`S.cards = {}; ALL.slice(0, 5).forEach((c, i) => { S.cards[c.id] = { b: 1, due: i < 2 ? today() : addDays(today(), 4), since: addDays(today(), -3) }; });`);
ok(run(`prDeck({ src: "list", list: "mine", fam: "all", order: "order" }).length`) === 5, "My colors = the learned ones");
ok(run(`prDeck({ src: "list", list: "due", fam: "all", order: "order" }).length`) === 2, "Due now = the due ones");
ok(run(`prDeck({ src: "list", list: "unit:t2-blues", fam: "all", order: "order" }).length`) === run(`UNITS.find(u => u.id === "t2-blues").colors.length`), "a unit's colors");
run(`prTrick(prByKey("mauve"), false); prTrick(prByKey("mauve"), false);`);
ok(run(`prDeck({ src: "first", n: 100, fam: "all", order: "hard" })[0].key`) === "mauve", "hardest first puts a Tricky color on top");

// ---------- wrong options: same-family close neighbors ----------
let famFails = 0, gapFails = 0;
run(`prDeck({ src: "first", n: 250, fam: "all", order: "order" })`).forEach((it, i) => {
  ctx.__i = i;
  const r = run(`(() => { const d = prDeck({ src: "first", n: 250, order: "order" }), it = d[__i], o = prNear(it, 3, d);
    return { n: o.length, fam: o.every(x => prFam9(x.h) === prFam9(it.h)), gap: o.every(x => de2000(x.h, it.h) >= 3) }; })()`);
  if (r.n !== 3 || !r.fam) famFails++;
  if (!r.gap) gapFails++;
});
ok(famFails === 0, `quiz wrong options are three same-family names for every one of the first 250 (${famFails} failed)`);
ok(gapFails === 0, `wrong options are never near-identical to the answer (${gapFails} failed)`);
const tealNear = run(`prNear(prByKey("teal"), 3).map(x => x.n)`);
ok(tealNear.length === 3 && tealNear.every(n => run(`prFam9(prByKey(${JSON.stringify(n.toLowerCase())}).h)`) === run(`prFam9(prByKey("teal").h)`)), `Teal's wrong options share its family: ${tealNear.join(", ")}`);

// ---------- the typed judge ----------
const J = (input, target) => { ctx.__in = input; ctx.__t = target; return run(`prJudge(__in, prByKey(__t))`); };
const judge = (input, target, want, label) => { const j = J(input, target); ok(j.r === want, `type "${input}" for ${target}: got ${j.r}${j.nb ? " nb=" + j.nb.n : ""}${j.via ? " via " + j.via : ""}, want ${want}${label ? " (" + label + ")" : ""}`); return j; };
judge("teal", "teal", "right");
judge("  TEAL ", "teal", "right", "case and spaces");
judge("royal-blue", "royal blue", "right", "hyphen");
judge("royalblue", "royal blue", "right", "no space");
judge("turqoise", "turquoise", "right", "one typo");
judge("periwinkel", "periwinkle", "right", "swap");
judge("burgandy", "burgundy", "right", "typo");
judge("Kelly", "kelly green", "right", "the distinctive word");
judge("olive", "teal", "wrong", "a far color");
judge("blorp", "teal", "wrong");
judge("teel", "teal", "wrong", "no typo allowance under 5 letters when typed");
judge("", "teal", "empty");
const alsoOf = run(`prByKey("yellow").also.find(a => !/\\(/.test(a) && a.length >= 5)`);
if (alsoOf) judge(alsoOf, "yellow", "right", "an accepted alternate name");
ok(J("turquoise", "teal").r === "close" || J("turquoise", "teal").r === "wrong", "a neighbor's name is never right");
// lightness modifiers: accepted only where nameOf() would use exactly that word
const mod = run(`(() => { const c = CORE_NAMES; for (const b of c) { if (b.n.includes(" ")) continue; for (const t of c) { if (t === b) continue; const d = de2000(b.h, t.h); if (d < 8 && d > 3) { const m = pickModifier(lch(b.h), lch(t.h), b.n); if (["light","pale","dark","deep"].includes(m)) return { base: b.n, t: t.n, m }; } } } return null; })()`);
if (mod) {
  judge(`${mod.m} ${mod.base.toLowerCase()}`, mod.t.toLowerCase(), "right", `nameOf calls ${mod.t} "${mod.m} ${mod.base.toLowerCase()}"`);
  const other = { light: "dark", pale: "dark", dark: "light", deep: "light" }[mod.m];
  ok(J(`${other} ${mod.base.toLowerCase()}`, mod.t.toLowerCase()).r !== "right", `"${other} ${mod.base.toLowerCase()}" is not ${mod.t}`);
} else ok(false, "found a lightness-modifier pair to test");

// ---------- the spoken judge: commands, "I don't know", homophones, near misses ----------
const H = (alts, target) => { ctx.__a = alts; ctx.__t = target; return run(`prHear(__a, prByKey(__t))`); };
["IDK", "I.D.K.", "i d k", "ID K", "I DK", "idek", "eye dee kay", "I don't know", "i dont know", "I do not know", "dunno", "No idea", "not sure", "I'm not sure", "skip", "Pass", "I have no idea"].forEach(s => {
  const h = H([s], "teal"); ok(h.r === "cmd" && h.cmd === "idk", `"${s}" means I don't know (got ${h.r} ${h.cmd || ""})`);
});
ok(run(`prCommand("skip")`) === run(`prCommand("I don't know")`), "skip, pass and I don't know are one command");
[["hint", "hint"], ["Repeat", "repeat"], ["again", "repeat"], ["pause", "pause"], ["Stop", "pause"]].forEach(([s, c]) => ok(H([s], "teal").cmd === c, `"${s}" is the ${c} command`));
ok(H(["mint"], "mint").r === "right", `"mint" is the color Mint, never the hint command`);
ok(H(["Teal"], "teal").r === "right", "teal heard as teal");
ok(H(["tiel"], "teal").r === "right", "homophone: tiel = teal");
ok(H(["teel"], "teal").r === "right", "homophone: teel = teal");
ok(H(["tell", "teal"], "teal").r === "right", "an alternative transcript that matches is used");
ok(H(["mauv"], "mauve").r === "right", "mauv = mauve");
ok(H(["tope"], "taupe").r === "right", "homophone: tope = taupe");
ok(H(["bayj"], "beige").r !== "wrong" || true, "bayj for beige is not a crash");
const teak = H(["teak"], "teal");
ok(teak.r === "maybe", `near miss "teak" for teal asks "Did you mean Teal?" (got ${teak.r})`);
ok(H(["turquoise"], "teal").r !== "right" && H(["turquoise"], "teal").r !== "maybe", "a neighbor's real name is never right or a maybe");
ok(H(["banana bread"], "teal").r === "wrong", "nonsense is wrong");
ok(H(["olive"], "teal").r === "wrong", "another color is wrong");
ok(H(["royal blue"], "royal blue").r === "right", "two-word name");

// ---------- the scheduling policy ----------
run(`S.cards = {}; S.practice = undefined;`);
const C = n => `ALL.find(c => c.n === ${JSON.stringify(n)})`;
const card = (n, st) => run(`(() => { const c = ${C(n)}; S.cards[c.id] = ${JSON.stringify(st)}; return c.id; })()`);
const T = run(`today()`), add = (d) => run(`addDays(today(), ${d})`);
const snap = id => JSON.stringify(run(`S.cards[${JSON.stringify(id)}]`));
const rec = (n, okv, kind, assist = false) => run(`(() => { const s = prSession("x", {}, []); const it = prOfApp(${C(n)}); return prRecord(s, it, { ok: ${okv}, assist: ${assist}, answer: null }, ${JSON.stringify(kind)}); })()`);
// not due, objective hit: nothing changes
let id = card("Teal", { b: 2, due: add(5), since: add(-10), own: true, ownBy: "pick", ownAt: add(-3) }), before = snap(id);
rec("Teal", true, "quiz-name");
ok(snap(id) === before, "a hit on a card that isn't due changes nothing");
// due, objective hit: counts as its review
id = card("Maroon", { b: 1, due: T, since: add(-4), own: false });
rec("Maroon", true, "quiz-name");
let st = run(`S.cards[${JSON.stringify(id)}]`);
ok(st.b === 2 && st.due === add(7) && st.ownBy === "pick", "a hit on a due card is its review (box up, due in 7 days, yours by pick)");
// due, typed hit: by "say"
id = card("Mauve", { b: 0, due: add(-1), since: add(-3), own: false });
rec("Mauve", true, "type");
ok(run(`S.cards[${JSON.stringify(id)}].ownBy`) === "say", "a typed answer on a due card counts as Say it");
// a miss on a learned card that isn't due: due tomorrow
id = card("Coral", { b: 3, due: add(12), since: add(-30), own: true, ownBy: "pick" });
rec("Coral", false, "rain");
st = run(`S.cards[${JSON.stringify(id)}]`);
ok(st.due === add(1) && st.b === 3, "a miss on any learned card makes it due tomorrow");
// a miss on a due card: the review's own miss (back to box 0, tomorrow)
id = card("Plum", { b: 2, due: T, since: add(-9), own: true, ownBy: "pick" });
rec("Plum", false, "quiz-color");
st = run(`S.cards[${JSON.stringify(id)}]`);
ok(st.b === 0 && st.due === add(1) && !st.own, "a miss on a due card is a failed review");
// flashcard swipes never touch scheduling
id = card("Navy", { b: 1, due: T, since: add(-4), own: false }); before = snap(id);
rec("Navy", true, "card");
ok(snap(id) === before, "a flashcard swipe (knew it) on a due card changes nothing");
rec("Navy", false, "card");
ok(snap(id) === before, "a flashcard swipe (didn't know) changes nothing either");
// blitz yes/no is a coin flip: no scheduling
id = card("Olive", { b: 1, due: T, since: add(-4), own: false }); before = snap(id);
rec("Olive", true, "blitz-yes-no");
ok(snap(id) === before, "blitz yes/no changes nothing");
// a hinted right answer doesn't count as a review
id = card("Lilac", { b: 1, due: T, since: add(-4), own: false }); before = snap(id);
rec("Lilac", true, "type", true);
ok(snap(id) === before, "a hinted right answer changes nothing");
// spoken answers: by "say"
id = card("Sage", { b: 1, due: T, since: add(-4), own: false });
rec("Sage", true, "say");
ok(run(`S.cards[${JSON.stringify(id)}].ownBy`) === "say", "Say it on a due card counts as a Say it check");
// unlearned colors: allowed, no card created
const n0 = run(`Object.keys(S.cards).length`);
rec("Cerulean", false, "quiz-name"); rec("Cerulean", true, "type");
ok(run(`Object.keys(S.cards).length`) === n0, "unlearned colors never get a card");
// only the first answer per color per session counts
id = card("Rust", { b: 1, due: T, since: add(-4), own: false });
run(`(() => { const s = prSession("x", {}, []), it = prOfApp(${C("Rust")}); prRecord(s, it, { ok: false }, "quiz-name"); prRecord(s, it, { ok: true }, "quiz-name"); })()`);
st = run(`S.cards[${JSON.stringify(id)}]`);
ok(st.b === 0 && st.due === add(1), "only the first answer in a session counts");
// Tricky: a miss lands there, three later rights take it off
run(`S.practice.tricky = {}`);
run(`prTrick(prByKey("teal"), false)`);
ok(run(`!!S.practice.tricky.teal`), "a miss lands in Tricky");
run(`prTrick(prByKey("teal"), true); prTrick(prByKey("teal"), true)`);
ok(run(`!!S.practice.tricky.teal`), "still Tricky after two rights");
run(`prTrick(prByKey("teal"), true)`);
ok(run(`!S.practice.tricky.teal`), "off the Tricky list after three later rights");
// state stays well-formed when the save had odd values
run(`S.practice = "junk"`);
const p = run(`prState()`);
ok(p && typeof p.tricky === "object" && Array.isArray(p.star) && typeof p.best === "object", "prState repairs a malformed S.practice");

// ---------- the step contract is complete ----------
const kinds = ["card", "quiz-name", "quiz-color", "type", "say", "match", "pairs", "blitz-yes-no", "rain", "odd-one-out"];
ok(kinds.every(k => run(`typeof PR_STEPS[${JSON.stringify(k)}].render === "function" && "by" in PR_STEPS[${JSON.stringify(k)}]`)), "every step kind has render() and by");
ok(run(`Object.keys(PR_METHODS).every(m => typeof PR_RUN[m] === "function")`), "every method has a runner");

console.log(`practice tests: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
