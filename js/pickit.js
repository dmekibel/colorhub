"use strict";
// Pick it, and what "yours" means.
// Swipes are practice: the learner grades them, so they set when a color comes back but can't make it "yours".
// A name becomes yours only after a check the learner can't fudge, a day or more after learning it:
// Pick it (the name, four close shades, tap the right one), Say it or Make it (produce.js).
// Learning-kb §1 #3: "every progress signal must be a delayed, unassisted performance probe". §2 N6: multiple choice
// is a fine probe when the wrong options are the real confusions, so the three others are the nearest names by ΔE.
// Also here: the objective placement test, and an opt-in self-test (research/SELF-TEST.md).

// ---------- tunables ----------
const PICK_GAP = 6;                  // CIEDE2000: every option is at least this far from the answer and from each other
const PICK_CHECKS = ["pick", "say", "make"];   // checks that can make a name yours
const PICK_RIGHT_MS = 1100;          // a right answer stays up this long before moving on
const PLACE_PASS = 6, PLACE_FAIL = 3, PLACE_MAX = 8, PLACE_SECS = 60;
const PLACE_FIRST = [7, 14];         // skipped tiers: first check spread over days 7 to 13
const EXP_HOLD = 3, EXP_DAYS = [7, 30], EXP_SHADE = [4, 6];

// ======================================================================
// Ownership. Pure functions on a card's state; core.js (schedule, ownedCount) calls these.
// st.own: recalled right a day or more later. st.ownBy: "swipe" (self-graded) or a check ("pick" | "say" | "make").
// st.ownAt: the day of that check. st.placed: added by placement, not yet checked.
// ======================================================================
const isMine = st => !!(st && st.own && PICK_CHECKS.includes(st.ownBy));
// "mine" | "self" | "placed" | "learning" | null (not started)
function ownState(st) {
  if (!st) return null;
  if (isMine(st)) return "mine";
  if (st.own) return "self";
  if (st.placed) return "placed";
  return "learning";
}
// After a graded review card. by: "swipe" | "pick" | "say" | "make". t: today.
function pickOwn(st, ok, by, t) {
  delete st.placed;
  if (!ok) { st.own = false; delete st.ownBy; delete st.ownAt; return; }
  st.own = true;
  const old = !st.since || st.since < t;
  if (PICK_CHECKS.includes(by) && old) { st.ownBy = by; st.ownAt = t; }
  else if (!isMine(st)) st.ownBy = "swipe";   // a swipe never undoes an earlier check
}
// Old saves: every "own" came from a swipe. Keep it, and say so. Returns how many cards were marked.
function pickMigrate(s) {
  let n = 0;
  Object.values((s && s.cards) || {}).forEach(st => { if (st && st.own && !st.ownBy) { st.ownBy = "swipe"; n++; } });
  if (s) s.ownV = 2;
  return n;
}
const OWN_LINE = "Yours = you picked or named it right a day or more later.";
function ownCounts() {
  const n = { mine: 0, self: 0, placed: 0, learning: 0 };
  ALL.forEach(c => { const k = ownState(S.cards[c.id]); if (k) n[k]++; });
  return n;
}
// One line for the collection: "6 to confirm · 42 placed · 8 learning"
function ownFoot() {
  const n = ownCounts(), parts = [];
  if (n.self) parts.push(`${n.self} to confirm`);
  if (n.placed) parts.push(`${n.placed} placed`);
  if (n.learning) parts.push(`${n.learning} learning`);
  return parts.length ? parts.join(" · ") : "Picked or named a day later";
}

// ======================================================================
// The options: the answer and its three nearest names (ΔE), never too close to tell apart.
// ======================================================================
let PICK_POOL_ = null;
const PICK_NEAR = new Map();
const pickPool = () => PICK_POOL_ || (PICK_POOL_ = [...BASICS, ...ALL]);
function pickNear(c, pool) {
  const key = c.n + "|" + c.h;
  if (!pool && PICK_NEAR.has(key)) return PICK_NEAR.get(key);
  const near = (pool || pickPool()).filter(x => x.n.toLowerCase() !== c.n.toLowerCase() && x.h.toUpperCase() !== c.h.toUpperCase())
    .map(x => ({ x, d: de2000(c.h, x.h) })).sort((a, b) => a.d - b.d);
  const out = [];
  for (const o of near) {
    if (o.d < PICK_GAP) continue;
    if (out.every(p => de2000(p.h, o.x.h) >= PICK_GAP)) out.push(o.x);
    if (out.length === 3) break;
  }
  if (!pool) PICK_NEAR.set(key, out);
  return out;
}
// -> [{ c, h, ok }] x4 in random order. hex: show the answer as this shade instead (the self-test's new shade).
function pickOptions(c, hex) {
  return shuffle([{ c, h: hex || c.h, ok: true }, ...pickNear(c).map(x => ({ c: x, h: x.h, ok: false }))]);
}
// A new shade of c: CIEDE2000 4 to 6 away in a random direction, and clearly nearer c than any of the others
// (at least 3 nearer; 1 for colors at the edge of the screen's range with close neighbors, like azure).
function pickShade(c, others, rnd = Math.random) {
  const [L, a, b] = lab(c.h);
  for (let i = 0; i < 600; i++) {
    const margin = i < 300 ? 3 : i < 450 ? 2 : 1;
    const u = [rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1], m = Math.hypot(u[0], u[1], u[2]);
    if (m < .15 || m > 1) continue;
    const want = EXP_SHADE[0] + .2 + rnd() * (EXP_SHADE[1] - EXP_SHADE[0] - .4);
    const at = s => labHex(L + u[0] / m * s, a + u[1] / m * s, b + u[2] / m * s);
    let lo = 0, hi = 40;
    for (let k = 0; k < 22; k++) { const s = (lo + hi) / 2; if (de2000(c.h, at(s)) < want) lo = s; else hi = s; }
    const s = (lo + hi) / 2;
    if (!inGamut(L + u[0] / m * s, a + u[1] / m * s, b + u[2] / m * s)) continue;
    const hx = at(s), d = de2000(c.h, hx);
    if (d < EXP_SHADE[0] || d > EXP_SHADE[1]) continue;
    if (others.every(o => de2000(hx, o.h) >= d + margin)) return hx;
  }
  return null;
}

// ======================================================================
// Mixing Pick it into a review queue (after prodMix)
// ======================================================================
// Every card at box 1 or more that isn't confirmed yet, learned a day or more ago, becomes a Pick it card,
// unless it already got a Say it or Make it (those confirm too). Then: never two non-swipe cards in a row.
function pickMix(queue, force) {
  const t = today();
  const want = it => { const st = S.cards[it.c.id]; return !!st && st.b >= 1 && !isMine(st) && (!st.since || st.since < t); };
  const items = queue.map((it, i) => (it.kind || (force && i === 0)) ? it : want(it) ? { ...it, kind: "pick" } : it);
  return pickSpace(items);
}
// Keep the checks that can still make a name yours; drop the extra cards on names already yours back to swipes;
// then spread the special cards so no two touch.
function pickSpace(items) {
  let sp = items.map((it, k) => ({ it, k })).filter(x => x.it.kind);
  const pl = items.filter(it => !it.kind), room = pl.length + 1;
  if (sp.length > room) {
    const rank = x => (isMine(S.cards[x.it.c.id]) ? 2 : 0) + (x.it.kind === "pick" ? 0 : 1);
    const ranked = sp.slice().sort((p, q) => rank(p) - rank(q) || p.k - q.k);
    ranked.slice(room).forEach(x => pl.push({ c: x.it.c, dir: x.it.dir }));
    sp = ranked.slice(0, room).sort((p, q) => p.k - q.k);
  }
  const out = [], N = sp.length + pl.length;
  let s = 0, p = 0;
  for (let i = 0; i < N; i++) {
    const prevSp = out.length && out[out.length - 1].kind, remS = sp.length - s, remP = pl.length - p;
    const takeS = remS > 0 && !prevSp && (remS > remP || s * N <= i * sp.length);
    out.push(takeS ? sp[s++].it : pl[p++]);
  }
  return out;
}

// ======================================================================
// The board: a name, four swatches. Used by review cards, placement and the self-test.
// o: { hex, reveal (show names and the verdict after the tap), onPick(ok, opt) }
// ======================================================================
function pickBoard(card, c, o = {}) {
  const opts = o.opts || pickOptions(c, o.hex);
  card.className = "card prod pick";
  card.innerHTML = `<div class="pi-q"><span class="eyebrow pi-v">${esc(o.tag || "Pick it")}</span><b>${esc(c.n)}</b><p class="pi-line"></p></div>
    <div class="pi-grid">${opts.map((x, i) => `<button class="pi-sw" data-i="${i}" style="--c:${x.h}" aria-label="Option ${i + 1}"><span class="pi-tag">${esc(x.c.n)}</span><i class="pi-k mono">${i + 1}</i></button>`).join("")}</div>`;
  let done = false;
  const choose = i => {
    if (done || !opts[i]) return; done = true;
    const x = opts[i], btn = card.querySelector(`[data-i="${i}"]`);
    btn.classList.add("chosen");
    if (o.reveal !== false) {
      card.classList.add("picked", x.ok ? "is-right" : "is-miss");
      card.querySelectorAll(".pi-sw").forEach((b, k) => b.classList.toggle("ans", opts[k].ok));
      const v = card.querySelector(".pi-v");
      v.innerHTML = x.ok ? `${ICON.checkS} Right` : `${ICON.xS} That's ${esc(x.c.n)}`;
      v.classList.add("verdict", x.ok ? "ok" : "miss");
      if (!x.ok) card.querySelector(".pi-line").textContent = pickWhy(c, x.c);
      buzz(x.ok ? 12 : [10, 40, 10]);
    } else buzz(6);
    o.onPick && o.onPick(x.ok, x);
  };
  card.querySelectorAll(".pi-sw").forEach(b => b.onclick = e => { e.stopPropagation(); choose(+b.dataset.i); });
  return { choose, opts, done: () => done };
}
// How the answer differs from the one tapped: the written line if it is the named neighbor, else measured.
function pickWhy(c, x) {
  if (c.vs && c.vs.toLowerCase() === x.n.toLowerCase() && c.d) return c.d;
  if (x.vs && x.vs.toLowerCase() === c.n.toLowerCase() && x.d) return x.d;
  return typeof compareLine === "function" ? compareLine(c, x) : "";
}

// ---------- the review card ----------
// As the card waiting behind: plain paper (the swatches would give nothing away, but they'd distract).
function pickCardEl(it, isNext, key) {
  const d = document.createElement("div");
  d.className = "card prod pick" + (isNext ? " next" : "");
  d.dataset.key = key;
  return d;
}
// Mount as the current card. o.done(ok) hands the result back to the deck. Returns { key(e) }.
function pickMount(card, it, foot, o) {
  let next = null;
  const board = pickBoard(card, it.c, {
    onPick: ok => {
      next = prodNext(foot, ok, o);
      card.onclick = () => next();
      if (ok && !(typeof SHOT !== "undefined" && SHOT)) later(() => { if (!document.querySelector(".peek")) next(); }, PICK_RIGHT_MS);
    },
  });
  foot.className = "deck-foot pi-foot";
  foot.innerHTML = `<p class="pi-hint">Four close shades · one is ${esc(it.c.n.toLowerCase())}</p>`;
  return {
    key: e => {
      if (board.done()) { if (["Enter", " ", "ArrowRight"].includes(e.key) && next) { e.preventDefault(); next(); } return; }
      if (/^[1-4]$/.test(e.key)) board.choose(+e.key - 1);
    },
  };
}

// ======================================================================
// Placement: name -> four close shades, adaptive, about a minute
// ======================================================================
// A tier passes at 6 right before 3 misses (8 at most). Guessing (1 in 4) passes this about 0.4% of the time.
// -> true (passed) | false (not passed) | null (keep asking)
function placeVerdict(ans) {
  const k = ans.filter(x => x.ok).length, miss = ans.length - k;
  if (k >= PLACE_PASS) return true;
  if (miss >= PLACE_FAIL || ans.length >= PLACE_MAX) return false;
  return null;
}
// Colors in a skipped tier are not lost: they join reviews as "known (placed)", first checked a week later.
function placeSkip(tier, t = today()) {
  let i = 0;
  UNITS.filter(u => u.tier === tier).forEach(u => u.colors.forEach(c => {
    if (S.cards[c.id]) return;
    S.cards[c.id] = { b: 2, due: addDays(t, PLACE_FIRST[0] + (i++ % (PLACE_FIRST[1] - PLACE_FIRST[0]))), since: t, own: false, placed: t };
  }));
  return i;
}
function pickPlace() {
  const log = [];
  let tier = 2, queue = sampleTier(2, PLACE_MAX), ended = false, board = null;
  const el = show(`
    <header class="deck-top">
      <button class="icon-btn" data-close aria-label="Close">${ICON.x}</button>
      <div class="timer" style="--dur:${PLACE_SECS}s"><i></i></div>
      <span class="left mono" id="left"></span>
    </header>
    <div class="stage" id="stage"></div>
    <footer class="deck-foot pi-foot" id="foot"><p class="pi-hint">Tap the color that matches the name</p></footer>
  `, "fixed deck place");
  const stage = el.querySelector("#stage"), left = el.querySelector("#left");
  el.querySelector("[data-close]").onclick = () => { ended = true; S.placed ? home() : welcome(); };
  const finish = () => { if (ended) return; ended = true; placed(log); };
  later(finish, PLACE_SECS * 1000);
  function ask() {
    if (ended) return;
    const tierLog = log.filter(x => x.stage === tier), v = placeVerdict(tierLog);
    if (v === true && tier === 2) { tier = 3; queue = sampleTier(3, PLACE_MAX); }
    else if (v !== null) return finish();
    const c = queue.shift();
    if (!c) return finish();
    stage.innerHTML = "";
    const card = document.createElement("div"); stage.appendChild(card);
    left.textContent = String(log.length + 1);
    board = pickBoard(card, c, {
      tag: tier === 2 ? "Everyday names" : "Designer's names",
      onPick: ok => { log.push({ c, ok, stage: tier }); later(ask, ok ? 550 : 1300); },
    });
  }
  onKey = e => {
    if (e.key === "Escape") { ended = true; return S.placed ? home() : welcome(); }
    if (board && /^[1-4]$/.test(e.key)) board.choose(+e.key - 1);
  };
  ask();
}

// ======================================================================
// The self-test (off by default; research/SELF-TEST.md)
// Hold back 3 colors per unit from practice, then test all of the unit blind at day 7 and day 30:
// Pick it on the exact swatch and on a new shade of the same name.
// S.exp = { on, since, units: { [unit id]: { held: [color ids], tests: { 7: { at, gap, res: [{ id, held, exact, shade }] } }, out } } }
// ======================================================================
const expOn = () => !!(S.exp && S.exp.on);
const expRec = id => S.exp && S.exp.units && S.exp.units[id];
// The unit as it is taught: without its held-back colors while the experiment runs. Called by meet().
function expUnit(u) {
  let e = expRec(u.id);
  if (!e && expOn() && !S.done[u.id] && u.colors.length >= EXP_HOLD * 2) {
    e = S.exp.units[u.id] = { held: shuffle(u.colors).slice(0, EXP_HOLD).map(c => c.id), tests: {} };
    save();
  }
  if (!e || e.out) return u;
  return { ...u, colors: u.colors.filter(c => !e.held.includes(c.id)) };
}
// Tests waiting: [{ u, day }]. Late for day 30? Day 7 is skipped, since testing both on one day means nothing.
function expDue(t = today()) {
  if (!S.exp || !S.exp.units) return [];
  const out = [];
  Object.entries(S.exp.units).forEach(([id, e]) => {
    const u = UNITS.find(x => x.id === id), d0 = S.done[id];
    if (!u || !d0 || e.out) return;
    const day = EXP_DAYS.slice().reverse().find(d => addDays(d0, d) <= t);
    if (day && !e.tests[day]) out.push({ u, day });
  });
  return out;
}
// Held colors join the normal path after the last test (or when the experiment stops).
function expRelease(e, t = today()) {
  e.out = t;
  e.held.forEach(id => { if (!S.cards[id]) S.cards[id] = { b: 0, due: addDays(t, 1), since: t, own: false }; });
}
function expToggle() {
  if (expOn()) {
    S.exp.on = false;
    Object.values(S.exp.units).forEach(e => { if (!e.out) expRelease(e); });
  } else S.exp = Object.assign({ units: {} }, S.exp || {}, { on: true, since: today() });
  save();
}
// Sum the results: { [day]: { prac: { exact: [right, n], shade: [right, n] }, held: {...} } }
function expSummary(units = (S.exp && S.exp.units) || {}) {
  const out = {};
  Object.values(units).forEach(e => Object.entries(e.tests || {}).forEach(([day, r]) => {
    const s = out[day] || (out[day] = { units: 0, prac: { exact: [0, 0], shade: [0, 0] }, held: { exact: [0, 0], shade: [0, 0] } });
    s.units++;
    r.res.forEach(x => {
      const g = x.held ? s.held : s.prac;
      if (x.exact != null) { g.exact[1]++; if (x.exact) g.exact[0]++; }
      if (x.shade != null) { g.shade[1]++; if (x.shade) g.shade[0]++; }
    });
  }));
  return out;
}
function expTest(u, day) {
  const e = expRec(u.id); if (!e) return home();
  const items = [];
  u.colors.forEach(c => {
    const near = pickNear(c), sh = pickShade(c, near);
    items.push({ c, kind: "exact" });
    if (sh) items.push({ c, kind: "shade", hex: sh });
  });
  const queue = shuffle(items), total = queue.length, res = new Map();
  let board = null, ended = false;
  const el = show(`
    <header class="deck-top">
      <button class="icon-btn" data-close aria-label="Close">${ICON.x}</button>
      <div class="segs">${queue.map(() => "<i></i>").join("")}</div>
      <span class="left mono" id="left"></span>
    </header>
    <div class="stage" id="stage"></div>
    <footer class="deck-foot pi-foot"><p class="pi-hint">Blind test · no answers until the end</p></footer>
  `, "fixed deck place");
  const stage = el.querySelector("#stage"), left = el.querySelector("#left"), segs = el.querySelectorAll(".segs i");
  el.querySelector("[data-close]").onclick = () => { ended = true; home(); };
  function ask() {
    if (ended) return;
    const it = queue.shift();
    if (!it) return finish();
    left.textContent = String(queue.length + 1);
    stage.innerHTML = "";
    const card = document.createElement("div"); stage.appendChild(card);
    board = pickBoard(card, it.c, { hex: it.hex, reveal: false, tag: `Day ${day} · ${u.title}`, onPick: ok => {
      const r = res.get(it.c.id) || { id: it.c.id, held: e.held.includes(it.c.id), exact: null, shade: null };
      r[it.kind] = ok; res.set(it.c.id, r);
      segs[total - queue.length - 1].style.setProperty("--c", "var(--ink)"); segs[total - queue.length - 1].classList.add("on");
      later(ask, 220);
    } });
  }
  function finish() {
    ended = true;
    const t = today();
    e.tests[day] = { at: t, gap: Math.round((new Date(t) - new Date(S.done[u.id])) / 864e5), res: [...res.values()] };
    if (day === EXP_DAYS[EXP_DAYS.length - 1]) expRelease(e, t);
    save();
    expDone(u, day);
  }
  onKey = e2 => { if (e2.key === "Escape") { ended = true; return home(); } if (board && /^[1-4]$/.test(e2.key)) board.choose(+e2.key - 1); };
  ask();
}
const expPct = ([r, n]) => n ? `${r}/${n}` : "—";
function expTable(s) {
  return `<div class="exp-tab"><span></span><span>Same swatch</span><span>New shade</span>
    <b>Practiced</b><span>${expPct(s.prac.exact)}</span><span>${expPct(s.prac.shade)}</span>
    <b>Held back</b><span>${expPct(s.held.exact)}</span><span>${expPct(s.held.shade)}</span></div>`;
}
function expDone(u, day) {
  const s = expSummary({ [u.id]: { tests: { [day]: expRec(u.id).tests[day] } } })[day];
  const el = show(`
    <div style="flex:1"></div>
    <p class="eyebrow">Your own experiment · day ${day}</p>
    <h1>${esc(u.title)}, <em>tested.</em></h1>
    ${expTable(s)}
    <p class="lede">Practiced colors went through the deck and reviews; held-back ones were never taught. A blind guess gets 1 in 4.${day === EXP_DAYS[EXP_DAYS.length - 1] ? " The held-back colors now join your reviews." : ` The day-${EXP_DAYS[EXP_DAYS.length - 1]} test comes later.`}</p>
    <div class="stack"><button class="btn" data-home>Home ${ICON.arrow}</button></div>
  `, "result");
  el.querySelector("[data-home]").onclick = home;
  onKey = e => { if (e.key === "Enter") home(); };
}
// A button for the done screens when a test is waiting
function expNudge() {
  const d = expDue()[0];
  return d ? `<button class="btn ghost" data-exp>Your experiment: day-${d.day} test for ${esc(d.u.title)} ${ICON.arrow}</button>` : "";
}
function expWireNudge(el) {
  const b = el.querySelector("[data-exp]"); if (!b) return;
  const d = expDue()[0]; b.onclick = () => expTest(d.u, d.day);
}
// The About sheet's section: what yours means, the counts, and the experiment
function ownAboutHtml() {
  const n = ownCounts(), sum = expSummary(), days = Object.keys(sum).sort((a, b) => a - b), due = expDue();
  return `<p><b>${OWN_LINE}</b> Swipes are practice: you grade them yourself, so they decide when a color comes back, not whether it's yours. Pick it (tap the right one of four close shades), Say it and Make it are the checks.</p>
    <p class="own-n">${n.mine} yours${n.self ? ` · ${n.self} recalled, to confirm` : ""}${n.placed ? ` · ${n.placed} placed, checked within ${PLACE_FIRST[1] - 1} days` : ""}${n.learning ? ` · ${n.learning} learning` : ""}</p>
    <h3 class="exp-h">Your own experiment</h3>
    <p>Does practice here really work for you? With this on, 3 colors in each new unit are held back from practice. On day ${EXP_DAYS[0]} and day ${EXP_DAYS[1]} you take a blind test on the whole unit: the exact swatch, and a new shade of the same name. If practiced colors beat held-back ones, it's working.</p>
    ${days.length ? days.map(d => `<p class="eyebrow exp-day">Day ${d} · ${sum[d].units} unit${sum[d].units > 1 ? "s" : ""}</p>${expTable(sum[d])}`).join("") : expOn() ? `<p class="fine">No tests yet. The first comes ${EXP_DAYS[0]} days after your next unit.</p>` : ""}
    ${due.length ? `<button class="btn" data-exp>Day-${due[0].day} test: ${esc(due[0].u.title)} ${ICON.arrow}</button>` : ""}
    <button class="btn ghost" data-exp-toggle>${expOn() ? "Stop the experiment" : "Start the experiment"} ${ICON.arrow}</button>`;
}
function ownAboutWire(sh, close) {
  const t = sh.querySelector("[data-exp-toggle]");
  if (t) t.onclick = () => { expToggle(); buzz(8); toast(expOn() ? "Experiment on: it starts with your next unit" : "Experiment off"); close(); };
  const b = sh.querySelector("[data-exp]");
  if (b) b.onclick = () => { const d = expDue()[0]; close(); if (d) expTest(d.u, d.day); };
}

// ---------- old saves ----------
if (typeof S !== "undefined" && S && S.ownV !== 2) { pickMigrate(S); save(); }

// ---------- screenshot hooks: #shot=pick:ask|right|wrong, place:ask|result, exp:about|done|test ----------
function pickShot(kind, state) {
  const t = today(), c = ALL.find(x => x.n === "Teal") || ALL[0];
  document.documentElement.classList.add("prod-shot");
  if (kind === "pick" && (state === "home" || state === "done")) {   // honest counts: the collection, the review-done screen
    if (state === "done") return reviewDone(7, 9);
    home(); setTimeout(() => { const el = document.querySelector(".collection"); if (el) scrollTo(0, el.getBoundingClientRect().top + scrollY - 120); }, 500);
    return;
  }
  if (kind === "pick") {
    ALL.filter(x => x !== c).slice(0, 7).forEach(x => { S.cards[x.id] = { b: 1, due: t, since: addDays(t, -4), own: true, ownBy: "swipe" }; });
    S.cards[c.id] = { b: 1, due: addDays(t, -1), since: addDays(t, -5), own: true, ownBy: "swipe" };
    deck("review", { force: "pick" });
    if (state === "right" || state === "wrong") setTimeout(() => {
      const opts = [...document.querySelectorAll(".card.pick:not(.next) .pi-sw")];
      const i = opts.findIndex(b => (b.style.getPropertyValue("--c").trim().toUpperCase() === c.h.toUpperCase()) === (state === "right"));
      if (opts[i]) opts[i].click();
    }, 300);
    return;
  }
  if (kind === "place") {
    if (state === "how") return how();
    if (state === "result") {
      const log = [...sampleTier(2, 7).map((x, i) => ({ c: x, ok: i !== 2, stage: 2 })), ...sampleTier(3, 5).map((x, i) => ({ c: x, ok: i % 2 === 0, stage: 3 }))];
      S.placed = null; return placed(log);
    }
    return pickPlace();
  }
  if (kind === "exp") {
    const u = UNITS[0];
    S.exp = { on: true, since: addDays(t, -40), units: {} };
    const e = S.exp.units[u.id] = { held: u.colors.slice(0, 3).map(x => x.id), tests: {} };
    S.done[u.id] = addDays(t, -31);
    const res = (gap, k) => u.colors.map((x, i) => ({ id: x.id, held: i < 3, exact: i < 3 ? i === 0 : (i + k) % 5 !== 0, shade: i < 3 ? false : (i + k) % 3 !== 0 }));
    e.tests[7] = { at: addDays(t, -24), gap: 7, res: res(7, 1) };
    if (state === "test") { S.done[u.id] = addDays(t, -8); delete e.tests[7]; return expTest(u, 7); }
    if (state === "done") { e.tests[30] = { at: t, gap: 31, res: res(31, 2) }; return expDone(u, 30); }
    S.cards = {}; ALL.slice(0, 20).forEach((x, i) => { S.cards[x.id] = { b: 2, due: addDays(t, 3), since: addDays(t, -9), own: i < 14, ownBy: i < 6 ? "pick" : i < 14 ? "swipe" : undefined }; });
    home(); about();
    setTimeout(() => { const s = document.querySelector(".sheet"); if (s) s.scrollTop = s.scrollHeight; }, 500);
  }
}
