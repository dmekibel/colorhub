"use strict";
// The Study pacer (design/STUDY-FLOW.md): what comes next in a Study session, so it's always at your level.
// DOM-free (tools/practice_test.js drives it with simulated learners); js/learnset.js lsStudy only draws its actions.
//
//   spNew(items, { know, pace, typing, quick, mix, resume, de })   -> P (the session's plan)
//     know    Map key -> "none" | "met" | "learning" | "yours" (the Learner Model's knowState)
//     pace    "you" (default, adaptive) | "gentle" | "standard" | "test"
//     mix     [[keyA, keyB], …] pairs you've mixed up before (confusions()), both in the set
//     resume  Map key -> rung from a stopped session ("Keep going")
//     de      (hexA, hexB) -> ΔE2000 (de2000)
//     groups  [[keyPin, keyNeighbor…], …] a pinned color with its look-alikes: they're met together (one wave per group) and
//             practiced beside each other (js/learnset.js lsGroups); omitted = no grouping
//     looked  true when you come from Look ("Test me"): you've just seen them all, so no Meet
//   spNext(P) -> { t: "meet", q, i, of, wave } | { t: "pair", a, b, why } | { t: "relook", q }
//             |  { t: "ask", q, kind, far, opts } | { t: "match", qs } | null (every color climbed or set aside)
//   spAnswer(P, q, ok) -> { up, out, ease }   after each answer (a Matching round: once per pair)
//
// Rungs: 0 pick its name from 3 far options · 1 pick its name from 4 neighbors · 2 find the color / odd one out ·
// 3 recall (type it, or a recall flashcard) · top (4, or 3 in a quick session) climbed.
const SP_WAVE = 3, SP_WAVE_EASY = 2, SP_INPLAY = 4, SP_MATCH_EVERY = 6, SP_WINDOW = 8, SP_SET_ASIDE = 3;
const SP_EASE_LO = .7, SP_EASE_HI = .92;
const SP_START = { none: 0, met: 0, learning: 1, yours: 3 };

function spNew(items, o = {}) {
  const know = o.know || new Map(), pace = o.pace || "you", test = pace === "test", top = o.quick ? 3 : 4;
  const de = o.de || (() => 99);
  const P = { top, pace, typing: o.typing !== false, quick: !!o.quick, de, qs: new Map(), queue: [], fresh: [], newQ: [], wave: [], acts: [],
    hist: [], ease: pace === "gentle" ? -1 : test ? 1 : 0, asked: 0, sinceMatch: 0, lastKind: "", mix: [], pairsShown: new Set(), meetDone: 0, cap: Math.max(24, items.length * 10) };
  // a pinned color and its look-alikes stay together: the order they're met and queued in, and one wave per group
  const grouped = Array.isArray(o.groups) && o.groups.some(g => g.length > 1);
  if (grouped) { P.gof = new Map(); o.groups.forEach((g, i) => g.forEach((k, j) => { if (!P.gof.has(k)) P.gof.set(k, i + j / 100); })); }
  items = grouped ? items.slice().sort((a, b) => (P.gof.has(a.key) ? P.gof.get(a.key) : 1e6) - (P.gof.has(b.key) ? P.gof.get(b.key) : 1e6)) : items;
  items.forEach(it => {
    const k = know.get(it.key) || "none", r = o.resume && o.resume.get(it.key);
    const fresh = k === "none" || k === "met";
    let lv = test ? Math.max(2, SP_START[k] || 0) : SP_START[k] || 0;
    if (r != null) lv = Math.max(0, Math.min(top, +r || 0));
    const q = { it, k, lv, up: lv >= top, miss: 0, missRun: 0, relook: false, out: false, n: 0, met: !fresh || test || !!o.looked || r != null };
    P.qs.set(it.key, q);
    if (q.up) return;
    if (q.met) P.fresh.push(q); else P.newQ.push(q);
  });
  // you mixed these up before: both get a side-by-side look before either is asked
  (o.mix || []).forEach(([a, b]) => { const qa = P.qs.get(a), qb = P.qs.get(b); if (qa && qb && qa !== qb && !qa.up && !qb.up) P.mix.push([qa, qb]); });
  // learning pace from the start: gentle when nothing in the set is known yet and it's a big set of new names
  if (pace === "you" && P.newQ.length >= 6 && !P.fresh.length) P.ease = -1;
  return P;
}
const spAcc = P => { const h = P.hist.slice(-SP_WINDOW); return h.length ? h.filter(Boolean).length / h.length : null; };
function spEase(P) {
  if (P.pace === "gentle") return P.ease = Math.min(0, spLevel(P));
  if (P.pace === "test") return P.ease = Math.max(0, spLevel(P));
  return P.ease = spLevel(P);
}
function spLevel(P) {
  const a = spAcc(P), n = Math.min(P.hist.length, SP_WINDOW);
  if (n < 4) return P.pace === "gentle" ? -1 : P.pace === "test" ? 1 : P.ease;
  return a < SP_EASE_LO ? -1 : a > SP_EASE_HI ? 1 : 0;
}
// the next wave of new colors: 2 or 3, smaller when they're near-twins or you're struggling
function spWaveSize(P) {
  if (P.ease < 0 || P.pace === "gentle") return SP_WAVE_EASY;
  const cand = P.newQ.slice(0, SP_WAVE);
  let tight = false;
  cand.forEach((a, i) => cand.forEach((b, j) => { if (i < j && P.de(a.it.h, b.it.h) < 5) tight = true; }));
  return tight ? SP_WAVE_EASY : SP_WAVE;
}
const spLive = P => [...P.qs.values()].filter(q => !q.up && !q.out);
// a wave is settled when each of its colors is past plain recognition (or set aside)
const spSettled = P => P.wave.every(q => q.up || q.out || q.lv >= 2);
function spStartWave(P) {
  const n = Math.min(spWaveSize(P), P.newQ.length);
  let wave;
  if (P.gof) {
    // one group at a time (its pinned color first); a lone color borrows the next one so a wave is never a single card
    const gi = k => Math.floor(P.gof.has(k) ? P.gof.get(k) : -1), g0 = gi(P.newQ[0].it.key);
    wave = P.newQ.filter(q => gi(q.it.key) === g0).slice(0, n);
    if (wave.length < 2) P.newQ.filter(q => !wave.includes(q)).slice(0, 2 - wave.length).forEach(q => wave.push(q));
    P.newQ = P.newQ.filter(q => !wave.includes(q));
  } else wave = P.newQ.splice(0, n);
  P.wave = wave;
  wave.forEach((q, i) => { P.acts.push({ t: "meet", q, i: i + 1, of: wave.length, wave: P.meetDone }); });
  P.meetDone++;
  // then the two closest of the wave side by side, or a pair you've mixed up before, once both are met
  wave.forEach(q => { q.met = true; });
  const mixNow = P.mix.filter(([a, b]) => a.met && b.met && !P.pairsShown.has(a.it.key + "|" + b.it.key));
  if (mixNow.length) mixNow.forEach(([a, b]) => { P.pairsShown.add(a.it.key + "|" + b.it.key); P.acts.push({ t: "pair", a, b, why: "mixup" }); });
  else if (wave.length >= 2) {
    let best = null;
    wave.forEach((a, i) => wave.forEach((b, j) => { if (i < j) { const d = P.de(a.it.h, b.it.h); if (!best || d < best.d) best = { a, b, d }; } }));
    P.acts.push({ t: "pair", a: best.a, b: best.b, why: "closest" });
  }
  // the wave joins the front of practice, its first color last (a beat between meeting it and being asked)
  P.queue.unshift(...wave.slice(1), wave[0]);
}
function spKind(P, q) {
  const last = P.lastKind, lv = q.lv;
  let opts;
  if (lv <= 1) opts = ["quiz-name", "quiz-color"];
  else if (lv === 2) opts = P.ease < 0 ? ["quiz-color", "quiz-name"] : q.n % 2 ? ["odd-one-out", "quiz-color"] : ["quiz-color", "odd-one-out"];
  else opts = P.typing && !P.quick ? ["type", "quiz-color"] : ["card", "quiz-color"];
  if (P.quick && lv >= 3) opts = ["card", "quiz-color"];
  return opts.find(k => k !== last) || opts[0];
}
function spNext(P) {
  if (P.acts.length) return P.acts.shift();
  spEase(P);
  // known pairs you've mixed up: before either is first asked
  const mixKnown = P.mix.find(([a, b]) => a.met && b.met && !P.pairsShown.has(a.it.key + "|" + b.it.key));
  if (mixKnown) { P.pairsShown.add(mixKnown[0].it.key + "|" + mixKnown[1].it.key); return { t: "pair", a: mixKnown[0], b: mixKnown[1], why: "mixup" }; }
  if (P.asked >= P.cap) return null;
  // a new wave: at the start, or once the last one has settled and you're not struggling (or there's little else to do)
  const live = P.queue.filter(q => !q.up && !q.out).length;
  if (P.newQ.length && (!P.wave.length || (spSettled(P) && (P.ease >= 0 || live < 2)) || live === 0)) { spStartWave(P); return P.acts.shift(); }
  while (P.queue.length < SP_INPLAY && P.fresh.length) P.queue.push(P.fresh.shift());
  // a Matching round of the colors in play now and then
  const inPlay = spLive(P).filter(q => q.met && q.lv >= 1 && P.queue.includes(q));
  if (P.sinceMatch >= SP_MATCH_EVERY && inPlay.length >= 3) { P.sinceMatch = 0; P.lastKind = "match"; return { t: "match", qs: inPlay.slice(0, 5) }; }
  let q = P.queue.shift();
  while (q && (q.up || q.out)) q = P.queue.shift();
  if (!q) return P.newQ.length ? (spStartWave(P), P.acts.shift()) : null;
  if (q.relook) { q.relook = false; P.queue.unshift(q); return { t: "relook", q }; }
  // far options on the first rung, and on the first three while you're struggling
  const kind = spKind(P, q), far = q.lv === 0 || (q.lv <= 2 && P.ease < 0);
  P.lastKind = kind; P.asked++; P.sinceMatch++;
  return { t: "ask", q, kind, far: far && (kind === "quiz-name" || kind === "quiz-color"), opts: far ? 2 : 3 };
}
function spAnswer(P, q, ok) {
  P.hist.push(!!ok); q.n++;
  const was = q.lv, r = { up: false, out: false };
  if (ok) {
    q.missRun = 0;
    q.lv = Math.min(P.top, q.lv + (P.ease > 0 && q.lv === 0 ? 2 : 1));
    if (q.lv >= P.top && was < P.top) { q.up = true; r.up = true; }
  } else {
    q.lv = Math.max(0, q.lv - 1); q.miss++; q.missRun++;
    if (q.miss >= SP_SET_ASIDE) { q.out = true; r.out = true; }
  }
  r.ease = spEase(P);
  if (!q.up && !q.out && !P.queue.includes(q)) {
    if (ok) P.queue.splice(Math.min(P.queue.length, 2 + q.lv), 0, q);
    else {
      // re-Look before it comes back: always while you're struggling, after a second miss in a row otherwise
      q.relook = P.ease < 0 || (P.ease === 0 && q.missRun >= 2);
      P.queue.splice(Math.min(1, P.queue.length), 0, q);
    }
  }
  return r;
}
// far options for the early rungs: the same family (never an obviously different color) but well apart,
// ΔE ≥ 14 from the answer and ≥ 10 from each other; nearer ones only when the family is too small
function spFar(it, n, pool, de, fam) {
  const same = pool.filter(x => x.key !== it.key && x.h !== it.h && (!fam || fam(x.h) === fam(it.h)));
  const out = [];
  for (const gap of [14, 10, 7]) {
    const cand = same.filter(x => !out.includes(x)).map(x => ({ x, d: de(it.h, x.h) })).filter(c => c.d >= gap && c.d <= 45).sort((a, b) => a.d - b.d);
    for (const c of cand) { if (out.length >= n) break; if (out.every(y => de(y.h, c.x.h) >= 10)) out.push(c.x); }
    if (out.length >= n) break;
  }
  return out.slice(0, n);
}
