// Tests for the two dailies: Today's painting (js/challenge.js, data/daily-paint*) and Name today's color
// (js/colordle.js). Run: node tools/daily_test.js
// Uses the app's own color math (js/core.js) and naming (js/naming.js), so the test and the app can't drift.
//   - seeds are deterministic (the same date always builds the same day)
//   - every daily is solvable (every painting day passes every round's gate; every color day has a page and 4 fair choices)
//   - the share text and the share card carry no spoilers (no name, title, painter or date)
//   - the direction words match the math, and the banned words never appear
const fs = require("fs"), path = require("path"), vm = require("vm");
const R = p => fs.readFileSync(path.join(__dirname, "..", p), "utf8");
const window = {};
new Function("window", R("data/colors.js"))(window);
const D = window.DATA;
const UNITS = D.units.map((u, i) => ({ ...u, i, colors: u.colors.map(c => ({ ...c, id: u.id + ":" + c.n })) }));
const ALL = UNITS.flatMap(u => u.colors);
const BASICS = D.basics.map(([n, h]) => ({ n, h, id: "basic:" + n, basic: true }));
const core = R("js/core.js");
const math = core.slice(core.indexOf("// ---------- color math"), core.indexOf("// ---------- data index"));
const pad = n => String(n).padStart(2, "0"), keyOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
let TODAY = "2026-10-08";
const ctx = vm.createContext({
  Math, String, Array, Object, Map, Set, JSON, Number, Uint8Array, Promise, console, D, UNITS, ALL, BASICS,
  BYNAME: new Map([...BASICS, ...ALL].map(c => [c.n.toLowerCase(), c])), EVERY: () => [...BASICS, ...ALL],
  clamp: (v, a, b) => Math.max(a, Math.min(b, v)), esc: s => String(s),
  today: () => TODAY, addDays: (k, n) => { const [y, m, d] = k.split("-").map(Number); return keyOf(new Date(y, m - 1, d + n)); },
  atob: s => Buffer.from(s, "base64").toString("binary"), S: { cards: {}, daily: {}, challenge: {} }, save: () => {},
});
vm.runInContext(math, ctx);
vm.runInContext(R("js/naming.js"), ctx);
vm.runInContext(R("js/lookalikes.js").split("function lookSheet")[0], ctx);
vm.runInContext(R("js/challenge.js").split("// Your eye over time")[0], ctx);
vm.runInContext(R("js/colordle.js"), ctx);
ctx.__core = JSON.parse(R("data/core-names.json"));
vm.runInContext("CORE_NAMES = __core.map(e => ({ ...e, lab: lab(e.h) }))", ctx);
const run = c => vm.runInContext(c, ctx);
const CORE = run("CORE_NAMES");
const de = (a, b) => ctx.de2000(a, b);

let pass = 0, fail = 0;
const ok = (cond, label) => { cond ? pass++ : fail++; if (!cond && fail < 60) console.log("FAIL  " + label); };
const BANNED = /\b(brighter|warmer|cooler|the 101)\b/i;
const day = n => run(`addDays("2026-10-07", ${n})`);

// ================================================================ Name today's color
// determinism and coverage: the same date gives the same word; a long run never repeats before the list is used up
{
  const seen = new Map(), N = run("dnOrder(CORE_NAMES).length");
  ok(N >= 600, `the word pool is the real words among the core names (${N})`);
  for (let i = 0; i < N; i++) {
    const k = day(i);
    const a = run(`dnTarget("${k}").n`), b = run(`dnTarget("${k}").n`), e = CORE.find(x => x.n === a);
    ok(a === b, `dnTarget ${k} is deterministic`);
    ok(!seen.has(a), `day ${i + 1} (${a}) repeats day ${seen.get(a)}`);
    ok(e && !e.compound && !/\bugly\b/i.test(a), `day ${i + 1} (${a}) is a real word, not a compound`);
    seen.set(a, i + 1);
  }
  ok(seen.size === N, `${N} days cover the whole pool (got ${seen.size})`);
  // every target can be named (the win is the same core name) and has a page (a slug for #/name/<slug> or a color page)
  const slugs = new Set();
  for (const e of CORE) {
    const slug = String(e.n).normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    // (data/core-names.json has one spelling pair, "Olive-Brown" / "Olive brown": the game treats them as one word)
    ok(slug.length > 0 && (!slugs.has(slug) || slug === "olive-brown"), `${e.n}: a unique page address`);
    slugs.add(slug);
    ctx.__e = e;
    ok(run("dnResolve(__e.n) && dnWin(dnResolve(__e.n), __e)"), `${e.n}: typing its name names it`);
    ok(run("dnWin(__e, __e)"), `${e.n}: naming it wins`);
  }
  // fair: no other name is within the win distance of any target (so only the right word, or a true synonym, wins)
  let tooClose = 0; const WIN = run("DN_WIN_DE");
  for (const e of CORE) for (const o of CORE) if (o !== e && de(e.lab, o.lab) < WIN) tooClose++;
  ok(tooClose === 0, `no two core names are within the win distance (${tooClose} pairs)`);
  // the 4-choice fallback: 4 distinct options, the answer among them, decoys from the same neighborhood and 4+ apart
  for (let i = 0; i < 400; i++) {
    const k = day(i);
    const r = run(`(() => { const t = dnTarget("${k}"), o = dnChoices(t, CORE_NAMES, [], seededRnd(dlHash("dn-choices${k}"))); return { t: t.n, h: t.h, o: o.map(x => ({ n: x.n, h: x.h })) }; })()`);
    ok(r.o.length === 4, `${k}: 4 choices (got ${r.o.length})`);
    ok(r.o.some(x => x.n === r.t), `${k}: the answer is a choice`);
    ok(new Set(r.o.map(x => x.n)).size === 4, `${k}: choices are distinct`);
    for (let a = 0; a < r.o.length; a++) for (let b = a + 1; b < r.o.length; b++) ok(de(r.o[a].h, r.o[b].h) >= 4, `${k}: ${r.o[a].n} and ${r.o[b].n} at least 4 apart`);
    ok(r.o.every(x => de(x.h, r.h) < 30), `${k}: every choice is a near neighbor of ${r.t}`);
  }
}
// the direction words: signs match ΔL*, ΔC* and the hue's turn; grey pairs never get a hue word; nothing banned
{
  const rnd = run("seededRnd(42)");
  const hex = () => "#" + Array.from({ length: 3 }, () => Math.floor(rnd() * 256).toString(16).padStart(2, "0")).join("").toUpperCase();
  for (let i = 0; i < 1000; i++) {
    const g = i % 7 ? hex() : CORE[i % CORE.length].h, t = hex();
    ctx.__g = g; ctx.__t = t;
    const a = run("dnAxes(__g, __t)"), [Lg, ag, bg] = run("lab(__g)"), [Lt, at, bt] = run("lab(__t)");
    const dL = Lt - Lg, dC = Math.hypot(at, bt) - Math.hypot(ag, bg);
    if (Math.abs(dL) >= 3) ok(a.L.word === (dL > 0 ? "lighter" : "darker"), `${g}->${t}: lightness word ${a.L.word} vs ΔL* ${dL.toFixed(1)}`);
    else ok(a.L.st === "same", `${g}->${t}: |ΔL*| < 3 reads as the same lightness`);
    if (Math.abs(dC) >= 3) ok(a.C.word === (dC > 0 ? "stronger" : "weaker"), `${g}->${t}: strength word vs ΔC* ${dC.toFixed(1)}`);
    if (Math.hypot(ag, bg) < 8 && Math.hypot(at, bt) < 8) ok(a.H.st === "grey" && !a.H.word, `${g}->${t}: two greys get no hue word`);
    else {
      ok(["redder", "yellower", "greener", "bluer", "purpler"].includes(a.H.word), `${g}->${t}: hue word "${a.H.word}"`);
      // the word names the hue zone (the same zones as lookDiff) the guess turns into, going the way today's hue
      // lies; for a turn over 60 degrees, the zone today's hue sits in
      const Z = [[55, "redder"], [130, "yellower"], [190, "greener"], [280, "bluer"], [345, "purpler"], [361, "redder"]];
      const zone = h => { h = ((h % 360) + 360) % 360; return Z.find(z => h < z[0])[1]; };
      const hg = Math.atan2(bg, ag) * 180 / Math.PI, ht = Math.atan2(bt, at) * 180 / Math.PI;
      let dh = ht - hg; if (dh > 180) dh -= 360; if (dh < -180) dh += 360;
      if (Math.abs(dh) > 60 && zone(ht) !== zone(hg)) ok(a.H.word === zone(ht), `${g}->${t}: "${a.H.word}" is where today's hue sits (${zone(ht)})`);
      else {
        // walking from the guess the way the hue turns, the word is the first other zone you reach (never the
        // zone you're leaving: a blue turning toward green is "greener", not "bluer")
        const sg = Math.sign(dh) || 1; let first = null;
        for (let d = 1; d < 360 && !first; d++) if (zone(hg + sg * d) !== zone(hg)) first = zone(hg + sg * d);
        ok(a.H.word === first, `${g}->${t}: "${a.H.word}" is the way the hue turns (${first})`);
      }
    }
    const words = ["L", "H", "C"].map(x => run(`dnCell(dnAxes(__g, __t).${x}, "${x}")`)).join(" ") + " " + run(`dnSentence(dnAxes(__g, __t), "Cerulean")`);
    ok(!BANNED.test(words), `${g}->${t}: no banned words in "${words}"`);
    ok(a.close >= 0 && a.close <= 100, `${g}->${t}: closeness in 0..100`);
  }
}
// the share: never the name, in the text or on the card
{
  for (let i = 0; i < 120; i++) {
    const k = day(i), t = run(`dnTarget("${k}")`);
    const near = run(`nearestCore(${JSON.stringify(t.h)}, CORE_NAMES, 8).map(x => x.n)`).filter(n => n !== t.n);
    const recs = [
      { t: t.n, g: [near[3], near[1], t.n], done: true, ok: true },
      { t: t.n, g: [near[5], near[4], near[3], t.n], done: true, ok: true, hint: true },
      { t: t.n, g: near.slice(0, 6), done: true, ok: false },
    ];
    recs.forEach((rec, j) => {
      ctx.__rec = rec; ctx.__t = t;
      const text = run(`dnShareText(__rec, ${i + 1})`), spec = JSON.stringify(run(`dnShareSpec(__rec, ${i + 1}, __t)`));
      const names = [t.n, ...rec.g].map(n => n.toLowerCase());
      ok(!names.some(n => text.toLowerCase().includes(n)), `${k} rec ${j}: share text "${text}" names a color`);
      ok(!names.some(n => spec.toLowerCase().includes(`"${n}"`) || spec.toLowerCase().includes(` ${n}`)), `${k} rec ${j}: share card names a color`);
      ok(!/[\u{1F7E5}-\u{1F7EB}⬛⬜]/u.test(text), `${k}: no emoji squares in the share text`);
    });
  }
}

// ================================================================ Today's painting
{
  const meta = JSON.parse(R("data/daily-paint.json"));
  const days = [];
  for (let s = 0; s * meta.per < meta.n; s++) days.push(...JSON.parse(R(`data/daily-paint/${s}.json`)));
  ok(days.length === meta.n, `the set has ${meta.n} days (read ${days.length})`);
  ok(days.length >= 250, `about 300 paintings (got ${days.length})`);
  ok(days[1] && days[1].id === "painting-milkmaid", "No. 2 (2026-10-08) is The Milkmaid");
  const ids = new Set();
  days.forEach((e, i) => {
    const k = day(i), tag = `${i + 1} ${e.id}`;
    ok(!ids.has(e.id), `${tag}: appears once`); ids.add(e.id);
    ok(e.t && e.a && e.y >= 1300 && e.y <= 1990, `${tag}: titled, attributed, dated`);
    ok(fs.existsSync(path.join(__dirname, "..", e.img)), `${tag}: its local image exists (${e.img})`);
    ok(e.k === "f" ? fs.existsSync(path.join(__dirname, "..", e.img.replace(/\.jpg$/, "-thumb.jpg"))) : true, `${tag}: thumbnail exists`);
    ok(e.k === "f" ? !!e.node : Number.isInteger(e.gi), `${tag}: opens a painting page`);
    ctx.__e = e;
    const grid = run("Array.from(dpGrid(__e))");
    ok(grid.length === e.gw * e.gh, `${tag}: grid is ${e.gw}x${e.gh}`);
    // round 1: the hidden color lives somewhere, and its own center is a hit
    ok(grid.includes(e.hid), `${tag}: the hidden color has cells`);
    ok(run(`dpHitHidden(__e, ${e.hc[0]}, ${e.hc[1]})`), `${tag}: tapping the hidden color's center is a hit`);
    const cells = grid.filter(v => v === e.hid).length;
    ok(cells / grid.length < .45, `${tag}: the hidden color isn't most of the painting (${cells}/${grid.length})`);
    ok(e.hid !== e.foc && e.hid > 1, `${tag}: the hidden color is neither the focal nor one of the two biggest`);
    // round 2: 4 names, the answer is the focal color's own nearest name, decoys clearly further
    const f = run(`dpFocalOptions(__e, CORE_NAMES, "${k}")`), f2 = run(`dpFocalOptions(__e, CORE_NAMES, "${k}")`);
    ok(f.opts.length === 4, `${tag}: 4 focal names (got ${f.opts.length})`);
    ok(JSON.stringify(f) === JSON.stringify(f2), `${tag}: focal options deterministic`);
    ok(f.ans === run(`nameOf(${JSON.stringify(f.hex)}).n`), `${tag}: the focal answer is nameOf's name`);
    ok(run(`nameOf(${JSON.stringify(f.hex)}).de`) < 8, `${tag}: the focal color has a close name`);
    for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) ok(de(f.opts[a].h, f.opts[b].h) >= 6, `${tag}: focal names ${f.opts[a].n} / ${f.opts[b].n} 6+ apart`);
    ok(f.opts.every(o => de(o.h, f.hex) < 30), `${tag}: focal decoys are neighbors`);
    // round 3: 4 swatches, the true one included, all 5%+ apart as drawn
    const sp = run(`dpSpotOptions(__e, "${k}")`);
    ok(!!sp, `${tag}: the spot round builds`);
    if (sp) {
      ok(sp.opts.length === 4 && sp.opts.includes(sp.ans), `${tag}: spot has 4 options with the truth`);
      for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) ok(de(sp.opts[a], sp.opts[b]) >= 5, `${tag}: spot options 5%+ apart`);
      ok(JSON.stringify(sp) === JSON.stringify(run(`dpSpotOptions(__e, "${k}")`)), `${tag}: spot options deterministic`);
      ok(e.spot.x > .1 && e.spot.x < .9 && e.spot.y > .1 && e.spot.y < .9, `${tag}: the spot is away from the edges`);
      ok(de(e.spot.h, e.spot.s) >= 8.5, `${tag}: the spot's surround really shifts it`);
    }
    // round 4: four colors whose shares step down clearly
    ok(e.ord.length === 4, `${tag}: 4 colors to order`);
    for (let j = 0; j < 3; j++) ok(e.ord[j][1] >= e.ord[j + 1][1] * 1.18, `${tag}: share ${j + 1} clearly above share ${j + 2}`);
    ok(e.ord[3][1] >= .039, `${tag}: the smallest share is big enough to see`);
    for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) ok(de(e.ord[a][0], e.ord[b][0]) >= 11.5, `${tag}: order colors 12+ apart`);
    // round 5: four decades, the true one included, all 20+ years apart
    const dc = run(`dpDecades(__e, "${k}")`);
    ok(dc.opts.length === 4 && dc.opts.includes(dc.ans) && dc.ans === Math.floor(e.y / 10) * 10, `${tag}: 4 decades with the true one`);
    for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) ok(Math.abs(dc.opts[a] - dc.opts[b]) >= 20, `${tag}: decades 20+ apart`);
    // the share: score and plates only
    const hits = [true, false, true, true, false];
    ctx.__h = hits;
    const text = run(`dpShareText(__h, ${i + 1})`), spec = JSON.stringify(run(`dpShareSpec(__e, __h, ${i + 1})`));
    const spoil = [e.t, e.a, String(e.y), `${Math.floor(e.y / 10) * 10}s`].filter(s => s && s.length > 2);
    ok(!spoil.some(s => text.includes(s) || spec.includes(s)), `${tag}: the share names the painting, painter or date`);
    ok(run(`dpPlates(__e).length`) === 5, `${tag}: 5 plates`);
  });
}

console.log(`daily tests: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
