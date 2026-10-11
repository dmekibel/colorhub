"use strict";
// "Teach it your eye" (design/TASTE-ENGINE.md): the Stage A ladder trainer for the v2 taste engine
// (js/tastemodel.js). Four rungs -- colors, pairs ("two that go together"), threes ("adding a third"), whole
// palettes -- about 10 questions each, using the SAME growing model all the way through (every rung teaches
// every layer a little). Candidates are real colors and real palettes pulled from data/paintings.js. Door in:
// Studio's "Teach it your eye" row (js/studio.js) and #/taste/style (js/router.js).
//
// State: S.taste.ladder = { at, cur, m: {mu,S,n,acc}, steps: {<key>: {n, acc, done}}, stepAcc: {<key>: [...]},
// recent: [last ~20 shown item keys] }. Additive and never touches S.taste.color / S.taste.palette (the old
// engine keeps working for js/gallery.js's "Matches your taste").

const LDR_ORDER = ["colors", "pairs", "threes", "palettes"];
const LDR_STEPS = {
  colors: { label: "Colors you like", kind: "four", base: 0, n: 8, q: "Which color do you like most?" },
  pairs: { label: "Two that go together", kind: "four", base: 1, n: 8, q: "Which pair looks best?" },
  threes: { label: "Adding a third", kind: "four", base: 2, n: 8, q: "Which three look best together?" },
  palettes: { label: "Whole palettes", kind: "four", base: 0, n: 8, q: "Which palette do you like most?" },
};
const LDR_MIN = 6, LDR_MAX = 15;
// David, 2026-10-11: no finish line ("like Midjourney, the more you rate the better it gets"). Rounds come in blocks of 8
// that rotate colors -> pairs -> threes -> palettes forever; a running count, a check-in at each milestone, and
// closing shows what it has learned so far.
const LDR_BLOCK = 8, LDR_MILESTONES = [20, 50, 100, 200, 350, 500, 750, 1000, 1500, 2000];
const ldrMean = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0;

// ---------- real candidates, pulled once from data/paintings.js ----------
// The curated set (data/taste/pool.json, tools/taste_pool.py): 400 lively 5-color palettes picked from the archive's
// Diverse palettes, and their vivid colors. David, 2026-10-11: the 22 paintings' area palettes were ugly from the
// first question. PAINTINGS stays as a fallback if the file can't load.
let LDR_COLOR_POOL = null, LDR_PAIR_POOL = null, LDR_PAL_POOL = null, LDR_CURATED = null, LDR_CURATED_P = null;
function ldrLoadPool() {
  if (!LDR_CURATED_P) LDR_CURATED_P = fetch("data/taste/pool.json?v=1").then(r => r.ok ? r.json() : null).catch(() => null)
    .then(d => { if (d && d.palettes && d.palettes.length) { LDR_CURATED = d; LDR_COLOR_POOL = LDR_PAIR_POOL = LDR_PAL_POOL = null; } return d; });
  return LDR_CURATED_P;
}
const ldrFrom = (t, a) => { t = String(t || "").split(/[.;(]/)[0].trim(); if (t.length > 38) t = t.slice(0, 36).replace(/\s+\S*$/, "") + "…"; return a ? `${t}, ${a}` : t; };
function ldrColorPool() {
  if (LDR_COLOR_POOL) return LDR_COLOR_POOL;
  const seen = new Map();
  if (LDR_CURATED) LDR_CURATED.colors.forEach(([h, t, a]) => { if (!seen.has(h)) seen.set(h, { h, from: ldrFrom(t, a) }); });
  else (window.PAINTINGS || []).forEach(p => (p.palette || []).forEach(c => { if (!seen.has(c.h)) seen.set(c.h, { h: c.h, from: p.title }); }));
  LDR_COLOR_POOL = [...seen.values()].map(c => { const [L, C, H] = lch(c.h); return { ...c, L, C, H, x: TASTE.tasteFeat([c.h], null) }; });
  return LDR_COLOR_POOL;
}
function ldrPairPool() {   // two colors from the same painting, for step 3's base pair
  if (LDR_PAIR_POOL) return LDR_PAIR_POOL;
  const out = [];
  if (LDR_CURATED) LDR_CURATED.palettes.forEach(([cs, t, a]) => { for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) out.push({ cols: [cs[i], cs[j]], from: ldrFrom(t, a) }); });
  else (window.PAINTINGS || []).forEach(p => { const cs = p.palette || []; for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) out.push({ cols: [cs[i].h, cs[j].h], from: p.title }); });
  LDR_PAIR_POOL = out;
  return LDR_PAIR_POOL;
}
function ldrPalPool() {
  if (LDR_PAL_POOL) return LDR_PAL_POOL;
  if (LDR_CURATED) return LDR_PAL_POOL = LDR_CURATED.palettes.map(([cols, t, a]) => ({ cols, shares: cols.map(() => 1 / cols.length), from: ldrFrom(t, a), x: TASTE.tasteFeat(cols, null) }));
  LDR_PAL_POOL = (window.PAINTINGS || []).filter(p => p.palette && p.palette.length >= 3).map(p => {
    const cols = p.palette.map(c => c.h), shares = p.palette.map(c => c.share);
    return { cols, shares, from: p.title, x: TASTE.tasteFeat(cols, shares) };
  });
  return LDR_PAL_POOL;
}

// ---------- state ----------
function ldrFresh() {
  const m = (S.taste && (S.taste.color || S.taste.palette)) ? TASTE.migrateV1(S.taste.color, S.taste.palette) : TASTE.model2();
  const steps = {}; LDR_ORDER.forEach(k => steps[k] = { n: 0, acc: null, done: false });
  return { at: today(), cur: "colors", m: { mu: m.mu, S: m.S, n: 0, acc: [] }, steps, stepAcc: { colors: [], pairs: [], threes: [], palettes: [] }, recent: [] };
}
function ldrState() { S.taste = S.taste || {}; if (!S.taste.ladder) S.taste.ladder = ldrFresh(); return S.taste.ladder; }
function ldrLeastCertain(ld) {
  const next = LDR_ORDER.find(k => !ld.steps[k].done); if (next) return next;
  return LDR_ORDER.slice().sort((a, b) => (ld.steps[a].acc ?? 1) - (ld.steps[b].acc ?? 1))[0];
}
function ldrRemember(ld, key) { ld.recent.push(key); if (ld.recent.length > 60) ld.recent.shift(); }
function ldrStepPlateaued(hist) {
  if (hist.length < LDR_MIN + 2) return false;
  const half = hist.length >> 1, a1 = ldrMean(hist.slice(0, half).map(r => r.hit)), a2 = ldrMean(hist.slice(half).map(r => r.hit));
  return hist.length >= LDR_MIN && Math.abs(a2 - a1) < .05;
}

// ---------- start screen ----------
function tasteLadderIntro() {
  if (!LDR_CURATED_P) { ldrLoadPool().then(() => { if (document.querySelector(".ldr-intro")) tasteLadderIntro(); }); }
  const favN = Object.keys((S.favArt) || {}).length;
  // vivid real colors from the paintings, spread around the wheel, building up rung by rung (1, 2, 3, 5 equal chips)
  const demo = [];
  ldrColorPool().filter(c => c.C > 20 && c.L > 25 && c.L < 85).sort((a, b) => b.C - a.C).forEach(c => {
    if (demo.length < 5 && demo.every(d => Math.min(Math.abs(d.H - c.H), 360 - Math.abs(d.H - c.H)) > 40)) demo.push(c);
  });
  demo.sort((a, b) => a.H - b.H);
  const demoHex = demo.map(c => c.h);
  const steps = [["1", "Colors you like"], ["2", "Two that go together"], ["3", "Adding a third"], ["4", "Whole palettes"]];
  const el = show(`
    <header class="deck-top"><button class="icon-btn" data-close aria-label="Close">${ICON.x}</button><span class="eyebrow" style="flex:1">A taste test</span></header>
    <p class="eyebrow tz-kick">${favN ? `Starting from ${favN} painting${favN === 1 ? "" : "s"} you kept` : "Grows deeper with every choice"}</p>
    <h1 class="t-title">Teach it <em>your eye</em></h1>
    <p class="tab-sub">${(ldrState().total || 0) ? `${ldrState().total.toLocaleString()} rated so far. ` : ""}Rate as long as you like: the more you rate, the better it knows your taste. Real colors from real paintings.</p>
    <div class="ldr-steps">${steps.map(([n, t], i) => `<div class="ldr-step"><em>${n}</em><b>${esc(t)}</b><span class="ldr-chips" aria-hidden="true">${demoHex.slice(0, [1, 2, 3, 5][i]).map(h => `<i style="background:${h}"></i>`).join("")}</span></div>`).join("")}</div>
    <button class="btn" data-go>${(ldrState().total || 0) ? "Keep going" : "Begin"} ${ICON.arrow}</button>
  `, "taste ldr-intro");
  el.querySelector("[data-close]").onclick = () => go("studio");
  el.querySelector("[data-go]").onclick = async () => { await ldrLoadPool(); const ld = ldrState(); ld.cur = ldrLeastCertain(ld); save(); ldrRunStep(ld); };
}

// ---------- the duel rungs (colors, palettes): reuses tzDuel() from js/taste.js ----------
function ldrRunDuel(ld, stepKey) {
  const cfg = LDR_STEPS[stepKey], pool = stepKey === "colors" ? ldrColorPool() : ldrPalPool();
  if (pool.length < 2) return ldrEnd(ld);
  const ref = pool[0].x.map((_, i) => ldrMean(pool.map(p => p.x[i])));
  const total = LDR_MAX, D = tzDuel(total);
  const face = stepKey === "colors" ? c => `<span class="tz-plate" style="--c:${c.h}"></span>`
    : p => `<span class="tz-opt-col">${ldrStripEq(p)}<small>From ${esc(p.from)}</small></span>`;
  const step = () => {
    const st = ld.steps[stepKey], hist = ld.stepAcc[stepKey];
    if (st.n >= LDR_MAX || (st.n >= LDR_MIN && ldrStepPlateaued(hist))) { st.done = true; save(); return ldrAdvance(ld); }
    const skipSet = new Set(pool.filter(p => ld.recent.includes(p.h || p.cols.join())));
    const [a, b] = TASTE.nextDuelV2(ld.m, pool, { skip: skipSet, ok: stepKey === "palettes" ? (x, y) => x.cols.length === y.cols.length : () => true });
    const predicted = TASTE.utility(ld.m, a.x) >= TASTE.utility(ld.m, b.x) ? 0 : 1;
    const label = `${cfg.label} · ${st.n + 1}/${total}`;
    D.ask(face(a), face(b), label, cfg.q, [a.h || a.cols[0], b.h || b.cols[0]], pick => {
      TASTE.choose(ld.m, a.x, b.x, pick, ref);
      const hit = pick === 0 ? predicted === 0 : pick === 1 ? predicted === 1 : null;
      if (hit !== null) { TASTE.recordAcc(ld.m, hit, .5); hist.push({ hit: hit ? 1 : 0, chance: .5 }); }
      st.n++; st.acc = ldrMean(hist.map(r => r.hit));
      [a, b].forEach(x => ldrRemember(ld, x.h || x.cols.join()));
      save(); step();
    });
  };
  step();
}
// equal-size, equal-shape swatches for a palette comparison (David's rule): never weighted by share.
function ldrStripEq(p) {
  const order = p.shares ? p.shares.map((s, i) => i).sort((a, b) => p.shares[b] - p.shares[a]) : p.cols.map((_, i) => i);
  return `<span class="tz-strip tz-eq">${order.map(i => `<i style="--c:${p.cols[i]}"></i>`).join("")}</span>`;
}

const ldrShuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
// eight colors spread around: a random start, then each next one the farthest from those already picked (CIELAB)
function ldrSpread(pool, n) {
  if (pool.length <= n) return pool.slice();
  const out = [pool[Math.random() * pool.length | 0]];
  const d = (a, b) => Math.hypot(a.L - b.L, a.C * Math.cos(a.H * Math.PI / 180) - b.C * Math.cos(b.H * Math.PI / 180), a.C * Math.sin(a.H * Math.PI / 180) - b.C * Math.sin(b.H * Math.PI / 180));
  while (out.length < n) {
    let best = null, bd = -1;
    for (let k = 0; k < 40; k++) { const c = pool[Math.random() * pool.length | 0]; if (out.includes(c)) continue; const m = Math.min(...out.map(o => d(o, c))); if (m > bd) { bd = m; best = c; } }
    if (!best) break; out.push(best);
  }
  return out;
}

// ---------- the best-of-four rungs (pairs, threes) ----------
function ldrFourShell(total, onClose) {
  const el = show(`
    <header class="deck-top"><button class="icon-btn" data-close aria-label="Close">${ICON.x}</button><div class="segs" id="lsegs">${"<i></i>".repeat(total)}</div><span class="left mono" id="lleft"></span></header>
    <div class="tz-q"><p class="eyebrow" id="llabel"></p><h2 id="lq"></h2></div>
    <div class="ldr-base" id="lbase"></div>
    <div class="ldr-four" id="lfour"></div>
    <button class="btn ghost ldr-skip" id="lskip">None of these</button>
  `, "fixed ldr-run");
  el.querySelector("[data-close]").onclick = () => onClose ? onClose() : go("studio");
  const $ = s => el.querySelector(s), four = $("#lfour"), segs = $("#lsegs"), skipBtn = $("#lskip"), base = $("#lbase");
  let done = 0, locked = true, cb = null, items = null, baseNow = [], picks = [], autoT = 0;
  // each option is the whole combination (base colors + the candidate), drawn as equal swatches side by side
  function paintFour(list) {
    four.classList.toggle("ldr-grid", list.length > 4);
    four.innerHTML = list.map((c, k) => `<button class="ldr-cand ldr-combo" data-k="${k}" aria-label="Option ${k + 1}">${[...baseNow, ...(c.cols || [c.h])].map(h => `<i style="--c:${h}"></i>`).join("")}<b class="ldr-rank" aria-hidden="true"></b></button>`).join("");
  }
  // your top three, in order: tap 1st, 2nd, 3rd; tap a ranked one again to take it (and those after it) back
  function paintRanks() {
    four.querySelectorAll(".ldr-cand").forEach((b, j) => { const r = picks.indexOf(j); b.classList.toggle("win", r >= 0); b.querySelector(".ldr-rank").textContent = r >= 0 ? r + 1 : ""; b.setAttribute("aria-pressed", r >= 0); });
    skipBtn.textContent = picks.length ? "Done" : "None of these";
    base.querySelector("small.ldr-hint").textContent = picks.length === 0 ? "Tap your favorite, then your 2nd and 3rd" : picks.length < 3 ? `Now your ${picks.length === 1 ? "2nd" : "3rd"}, or Done` : "";
  }
  function finish() {
    if (locked) return; locked = true; clearTimeout(autoT);
    const seg = segs.children[done];
    if (seg && picks.length) { const w = items[picks[0]]; seg.style.setProperty("--c", w.h || w.cols[2]); seg.classList.add("on"); }
    later(() => cb(picks.slice()), reduceMotion ? 80 : 240);
  }
  function pick(k) {
    if (locked) return; buzz(6); clearTimeout(autoT);
    const r = picks.indexOf(k);
    if (r >= 0) picks = picks.slice(0, r); else if (picks.length < 3) picks.push(k);
    paintRanks();
    if (picks.length === 3) autoT = later(finish, reduceMotion ? 200 : 650);
  }
  four.addEventListener("click", e => { const b = e.target.closest(".ldr-cand"); if (b) pick(+b.dataset.k); });
  skipBtn.onclick = finish;
  onKey = e => { const k = { "1": 0, "2": 1, "3": 2, "4": 3, "5": 4, "6": 5, "7": 6, "8": 7 }[e.key]; if (k !== undefined) pick(k); if (e.key === "Enter" || e.key === "Escape") finish(); };
  return {
    ask(baseColors, baseLabel, label, q, list, onDone, right) {
      $("#llabel").textContent = label; $("#lq").textContent = q; $("#lleft").textContent = right || `${done + 1}/${total}`;
      baseNow = baseColors; picks = [];
      base.innerHTML = `${baseLabel ? `<small>${esc(baseLabel)}</small>` : ""}<small class="ldr-hint"></small>`;
      items = list; locked = false; skipBtn.hidden = false;
      paintFour(list); paintRanks();
      cb = onDone;
    },
    next() { done++; },
  };
}
function ldrRunFour(ld, stepKey) {
  const cfg = LDR_STEPS[stepKey], isPal = stepKey === "palettes", pool = isPal ? ldrPalPool() : ldrColorPool();
  if (pool.length < 6) return ldrEnd(ld);
  // the shared color(s) every option is built on: lively ones, so a round never starts from a flat grey
  const lively = h => { const [L, C] = lch(h); return C > 18 && L > 25 && L < 85; };
  const allBase = stepKey === "colors" || isPal ? [{ cols: [] }] : stepKey === "pairs" ? pool : ldrPairPool();
  const liveBase = stepKey === "colors" || isPal ? allBase : allBase.filter(b => stepKey === "pairs" ? lively(b.h) : b.cols.every(lively));
  const basePool = liveBase.length >= 8 ? liveBase : allBase;
  if (basePool.length < 1) return ldrEnd(ld);
  const total = LDR_BLOCK, Sh = ldrFourShell(total, () => ldrEnd(ld));
  let blockN = 0;
  const step = () => {
    const st = ld.steps[stepKey], hist = ld.stepAcc[stepKey];
    if (blockN >= LDR_BLOCK) { st.done = true; save(); return ldrAdvance(ld); }
    const baseItem = basePool[Math.random() * basePool.length | 0];
    const baseCols = stepKey === "pairs" ? [baseItem.h] : baseItem.cols;
    const keyOf = p => p.cols ? p.cols.join("") : p.h;
    const skipSet = new Set(pool.filter(p => ld.recent.includes(keyOf(p))));
    const fresh = pool.filter(p => !skipSet.has(p) && !baseCols.includes(p.h));
    let cands;
    if (isPal) cands = ldrShuffle(fresh).slice(0, cfg.n || 8);
    else if (stepKey === "colors") cands = ldrSpread(fresh, cfg.n || 8);
    else {   // four chosen by the model (informative + structured), the rest spread around the wheel
      cands = TASTE.pickCandidates4(ld.m, baseCols, pool, { skip: skipSet });
      const more = ldrSpread(fresh.filter(p => !cands.some(c => c.h === p.h)), (cfg.n || 8) - cands.length);
      cands = ldrShuffle(cands.concat(more));
    }
    if (cands.length < 4) { st.n++; return step(); }
    const chance = 1 / cands.length;   // too sparse a pool this round; count it and move on
    const items = isPal ? cands : cands.map(c => ({ h: c.h, from: c.from, x: TASTE.tasteFeat([...baseCols, c.h], null) }));
    const predicted = TASTE.predictBest(ld.m, items);
    const label = cfg.label, baseLabel = baseItem.from ? `From ${baseItem.from}` : "";
    Sh.ask(baseCols, baseLabel, label, cfg.q, items, picks => {
      blockN++; ld.total = (ld.total || 0) + 1;
      // Plackett-Luce, decomposed: 1st beats everything after it (weight 1), 2nd the rest (.5), 3rd the rest (.3);
      // "None of these" teaches nothing rather than guess at why
      if (picks.length) {
        const rest = items.map((_, i) => i).filter(i => !picks.includes(i));
        TASTE.updateRanking(ld.m, items, [...picks, ...rest], [1, .5, .3].slice(0, picks.length));
        const hit = predicted === picks[0]; TASTE.recordAcc(ld.m, hit, chance); hist.push({ hit: hit ? 1 : 0, chance });
      }
      items.forEach(it => ldrRemember(ld, keyOf(it)));
      st.n++; st.acc = hist.length ? ldrMean(hist.map(r => r.hit)) : null; save();
      if (LDR_MILESTONES.includes(ld.total)) ldrMilestone(ld);
      Sh.next(); step();
    }, `${(ld.total || 0).toLocaleString()} rated`);
  };
  step();
}

// ---------- the ladder's traffic controller ----------
function ldrRunStep(ld) {
  ld.cur = ldrLeastCertain(ld);
  const cfg = LDR_STEPS[ld.cur];
  if (cfg.kind === "duel") ldrRunDuel(ld, ld.cur); else ldrRunFour(ld, ld.cur);
}
function ldrAdvance(ld) {   // endless: the next kind of question in the rotation
  ld.cur = LDR_ORDER[(LDR_ORDER.indexOf(ld.cur) + 1) % LDR_ORDER.length]; save();
  const cfg = LDR_STEPS[ld.cur];
  if (cfg.kind === "duel") ldrRunDuel(ld, ld.cur); else ldrRunFour(ld, ld.cur);
}
function ldrMilestone(ld) {   // a quiet check-in, honest numbers only
  const a = TASTE.accuracy(ld.m);
  toast(a.n >= 10 && a.acc > a.chance + .05 ? `${ld.total} rated · it picks your favorite ${Math.round(a.acc * 100)}% of the time (chance ${Math.round(a.chance * 100)}%)` : `${ld.total} rated · still learning you`);
  buzz(12);
}

// ---------- end-of-session ----------
// up to 3 confident findings: a 90% interval (|z|>1.645) that excludes "no preference", largest |z| first.
const LDR_FINDING_DEFS = [
  ...Array.from({ length: 12 }, (_, k) => ({ idx: 34 + k, pos: `lean toward ${LDR_FAMILY_NAME(k)}`, neg: `steer clear of ${LDR_FAMILY_NAME(k)}` })),
  { idx: 10, pos: "choose colors close in hue over far ones", neg: "don't mind far-apart hues" },
  { idx: 13, pos: "like complementary pairs (opposite hues)", neg: "avoid strongly opposite hues" },
  { idx: 15, pos: "like a strong warm/cool contrast in a pair", neg: "prefer both colors to feel the same temperature" },
  { idx: 17, pos: "like pairing one vivid color with one muted one", neg: "prefer two colors of a similar strength" },
  { idx: 18, pos: "like strong contrast, not close values", neg: "like close values, not strong contrast" },
  { idx: 19, pos: "like vivid color over muted", neg: "like muted color over vivid" },
  { idx: 20, pos: "lean warm", neg: "lean cool" },
  { idx: 21, pos: "like a wide hue spread in a palette", neg: "like a palette built from one hue" },
  { idx: 22, pos: "like palettes with more colors", neg: "like palettes with fewer colors" },
  { idx: 23, pos: "like one dominant field with small accents", neg: "like an even split between colors" },
  { idx: 31, pos: "like one hue carried light to dark", neg: "don't go for a single-hue ramp" },
  { idx: 33, pos: "like many small accent colors", neg: "like few, bold accents" },
];
function LDR_FAMILY_NAME(k) { return ["reds", "oranges", "ambers", "yellows", "chartreuses", "greens", "teals", "cyans", "blues", "violets", "magentas", "pinks"][k] || "that hue"; }
function ldrFindings(m) {
  const out = [];
  LDR_FINDING_DEFS.forEach(d => {
    const sd = Math.sqrt(Math.max(m.S[d.idx][d.idx], 1e-9)), z = m.mu[d.idx] / sd;
    if (Math.abs(z) > 1.645) out.push({ text: z > 0 ? d.pos : d.neg, z: Math.abs(z), idx: d.idx, sign: z > 0 ? 1 : -1 });
  });
  return out.sort((a, b) => b.z - a.z).slice(0, 3);
}
// one small, real example for a finding: real swatches near the family it names, two real colors that show the
// relationship, or a quick generated palette tuned toward the learned direction of the dial it names.
const LDR_REL_TARGET = { 10: 15, 13: 180 };
function ldrFindingExample(finding, pool) {
  if (finding.idx >= 34) {
    const k = finding.idx - 34, center = k * 30 + 15;
    const cols = pool.slice().sort((a, b) => Math.abs(TASTE.hueDist(a.H, center)) - Math.abs(TASTE.hueDist(b.H, center))).slice(0, 4);
    return `<span class="ldr-ex">${cols.map(c => `<i style="--c:${c.h}"></i>`).join("")}</span>`;
  }
  if (LDR_REL_TARGET[finding.idx] != null) {
    const a = pool[0], target = LDR_REL_TARGET[finding.idx];
    const b = pool.slice(1).sort((x, y) => Math.abs(TASTE.hueDist(x.H, a.H) - target) - Math.abs(TASTE.hueDist(y.H, a.H) - target))[0];
    return `<span class="ldr-ex">${[a, b].map(c => `<i style="--c:${c.h}"></i>`).join("")}</span>`;
  }
  if (finding.idx >= 18 && finding.idx <= 23) {
    const target = [0, 0, 0, 0, 0, 0]; target[finding.idx - 18] = 1.2 * finding.sign;
    const pal = TASTE.genPalette(target, 7);
    return `<span class="ldr-ex">${pal.cols.map(h => `<i style="--c:${h}"></i>`).join("")}</span>`;
  }
  const two = pool.slice(0, 2);
  return `<span class="ldr-ex">${two.map(c => `<i style="--c:${c.h}"></i>`).join("")}</span>`;
}
function ldrEnd(ld) {
  const acc = TASTE.accuracy(ld.m), n = LDR_ORDER.reduce((s, k) => s + ld.steps[k].n, 0);
  const findings = ldrFindings(ld.m), pool = ldrColorPool();
  const pct = v => Math.round(v * 100);
  const headline = acc.n >= 4
    ? `It now predicts your picks ${pct(acc.acc)}% of the time, up from chance (${pct(acc.chance)}%).`
    : "It's just getting started.";
  const el = show(`
    <header class="art-top"><button class="icon-btn glass" data-close aria-label="Close">${ICON.x}</button></header>
    <p class="eyebrow tz-kick">Teach it your eye · ${n} choice${n === 1 ? "" : "s"}</p>
    <h1 class="t-title ldr-end-h">${esc(headline)}</h1>
    ${findings.length ? `<div class="sec-head"><b>What it's learned</b><span>confident only</span></div>
      <div class="ldr-findings">${findings.map(f => `<div class="ldr-finding">${ldrFindingExample(f, pool)}<p>You ${esc(f.text)}<small>${n} choices</small></p></div>`).join("")}</div>`
      : `<div class="ldr-notsure"><p class="eyebrow">Not sure yet</p><p class="tab-sub">A few more choices and it'll have something to say. Taste takes a little evidence before it speaks.</p></div>`}
    <div class="stack" style="margin-top:28px"><button class="btn" data-more>Keep going ${ICON.arrow}</button></div>
    <p class="fine">How it works: a Bradley-Terry/Plackett-Luce choice model, growing in four layers (colors, relationships, structure, families), updated after every tap. Deeper layers need more evidence before they move. Screens vary, and taste shifts with mood, so come back another day.</p>
  `, "article tz-res ldr-end");
  el.querySelector("[data-close]").onclick = () => go("studio");
  el.querySelector("[data-more]").onclick = () => { LDR_ORDER.forEach(k => ld.steps[k].done = false); save(); ldrRunStep(ld); };
}

// ---------- screenshot mode (#shot=ladder:...) ----------
function tasteLadderShot(arg = "intro") {
  if (!LDR_CURATED) return ldrLoadPool().then(() => tasteLadderShot2(arg));
  return tasteLadderShot2(arg);
}
function tasteLadderShot2(arg) {
  const [what, sub] = (arg || "intro").split("-");
  if (what === "intro") return tasteLadderIntro();
  if (what === "returning") { const ld = ldrState(); LDR_ORDER.forEach(k => { ld.steps[k].n = LDR_MIN; ld.steps[k].done = k !== "threes"; ld.steps[k].acc = .64; }); save(); return tasteLadderIntro(); }
  if (what === "end") {
    const ld = ldrState(); let seed = 11; const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let t = 0; t < 60; t++) { const pool = ldrColorPool(), ref = pool[0].x.map((_, i) => ldrMean(pool.map(p => p.x[i]))); const [a, b] = TASTE.nextDuelV2(ld.m, pool, { rand }); TASTE.choose(ld.m, a.x, b.x, rand() < .5 ? 0 : 1, ref); TASTE.recordAcc(ld.m, rand() < .7, .5); }
    LDR_ORDER.forEach(k => ld.steps[k].done = true); save();
    return ldrEnd(ld);
  }
  if (what === "run") { const ld = ldrState(), key = sub || "colors", cfg = LDR_STEPS[key]; ld.cur = key; return cfg.kind === "duel" ? ldrRunDuel(ld, key) : ldrRunFour(ld, key); }
}
