"use strict";
// The preference model behind "Your colors" (js/favs.js, js/favrank.js). No DOM here, so tools/prefmodel_test.js can
// run it in node.
//
// Every favorite has ONE preference score: a Gaussian belief [mean, variance, evidence count] on a logit scale
// (0 = an average favorite). Every way of ranking (best of three, tiers, swipes, a budget of paint drops, dragging
// into order) is turned into pairwise evidence, and one update rule absorbs all of it: Bradley-Terry with a Laplace
// step on the pair's difference (the same family as js/tastemodel.js, Spiegelhalter & Lauritzen 1990). The next
// question is always the pair we are least sure about (largest expected information, as in tastemodel's info()).
// "Confidence" is how sure we are of the ORDER: the average chance that each neighbor in the ranking really sits
// where it does.
//
// A store is a plain object { "#HEX": [mean, variance, count] }, so it saves straight into S.pref.ctx[context].
const PREFM = (() => {
  const sig = z => 1 / (1 + Math.exp(-z));
  const V0 = 2.25;                                  // prior variance (sd 1.5 logits)
  const get = (st, k) => st[k] || (st[k] = [0, V0, 0]);
  const peek = (st, k) => st[k] || [0, V0, 0];

  // a beat b (y = 1), lost (y = 0), or tied (.5); w < 1 is softer evidence
  function compare(st, a, b, y = 1, w = 1) {
    if (a === b) return;
    const A = get(st, a), B = get(st, b), v = A[1] + B[1], p = sig(A[0] - B[0]), h = w * p * (1 - p), den = 1 + h * v, d = w * (y - p) / den;
    const a2 = A[1], b2 = B[1];
    A[0] += a2 * d; B[0] -= b2 * d;
    A[1] = a2 - a2 * a2 * h / den; B[1] = b2 - b2 * b2 * h / den;
    A[2]++; B[2]++;
  }
  // one color against "an average favorite" (a fixed opponent at 0): y is how often it would win
  function rate(st, k, y, w = 1) {
    const A = get(st, k), p = sig(A[0]), h = w * p * (1 - p), den = 1 + h * A[1], a2 = A[1];
    A[0] += a2 * w * (y - p) / den; A[1] = a2 - a2 * a2 * h / den; A[2]++;
  }
  const applyPairs = (st, pairs) => pairs.forEach(([a, b, w]) => compare(st, a, b, 1, w == null ? 1 : w));

  // ---------- evidence from each way of ranking ----------
  // Best of three: keep one (best), drop one (worst); the third sits between. Two taps order all three: best>mid,
  // best>worst, mid>worst.
  function bwsPairs(triple, best, worst) {
    const mid = triple.find(k => k !== best && k !== worst);
    return mid === undefined || best === worst ? [] : [[best, mid], [best, worst], [mid, worst]];
  }
  // a full order of k colors, best first: neighbors count fully, farther pairs count less
  function orderPairs(keys) {
    const out = [];
    for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) out.push([keys[i], keys[j], j - i === 1 ? 1 : j - i === 2 ? .6 : .3]);
    return out;
  }
  // a budget of paint drops: more drops beats fewer, harder the bigger the gap
  function budgetPairs(alloc) {
    const ks = Object.keys(alloc), out = [];
    for (const a of ks) for (const b of ks) if (alloc[a] > alloc[b]) out.push([a, b, Math.min(1, (alloc[a] - alloc[b]) / 3)]);
    return out;
  }
  // tiers and swipes: a rating against an average favorite
  const TIER_Y = [.9, .62, .3];                     // Love, Like, Fine
  const tierRate = (st, k, level) => rate(st, k, TIER_Y[level], 3);
  const swipeRate = (st, k, liked) => rate(st, k, liked ? .8 : .3, 1.5);

  // ---------- reading the store ----------
  const mean = (st, k) => peek(st, k)[0];
  const order = (st, keys) => keys.slice().sort((a, b) => peek(st, b)[0] - peek(st, a)[0] || peek(st, a)[1] - peek(st, b)[1]);
  const rankOf = (st, keys, k) => order(st, keys).indexOf(k) + 1;
  const evidence = (st, keys) => keys.reduce((s, k) => s + peek(st, k)[2], 0) / 2;
  // chance that a is truly above b (normal approximation, probit ~ logistic(1.702 x))
  const above = (st, a, b) => { const A = peek(st, a), B = peek(st, b); return sig(1.702 * (A[0] - B[0]) / Math.sqrt(A[1] + B[1])); };
  // how sure we are of the order: the expected Kendall tau between the order we show and your true taste, i.e. 2 x
  // (the average chance that each pair of colors is the right way round) - 1. 0 = no idea, 1 = every pair surely right.
  // (Two colors you rate almost the same will always be a coin flip, so this climbs fast and then flattens.)
  function confidence(st, keys) {
    const n = keys.length;
    if (n < 2) return 0;
    const o = order(st, keys);
    let s = 0, c = 0;
    if (n <= 150) { for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { s += above(st, o[i], o[j]); c++; } }
    else { for (let t = 0; t < 12000; t++) { const i = (Math.random() * n) | 0, j = (Math.random() * n) | 0; if (i === j) continue; s += above(st, o[Math.min(i, j)], o[Math.max(i, j)]); c++; } }
    return clamp01(2 * (s / c) - 1);
  }
  const clamp01 = v => Math.max(0, Math.min(1, v));
  const confLabel = c => c < .3 ? "A rough sketch" : c < .6 ? "Taking shape" : c < .8 ? "Mostly settled" : "Settled";

  // ---------- choosing the next question ----------
  function info(st, a, b) {
    const A = peek(st, a), B = peek(st, b), p = sig(A[0] - B[0]);
    return Math.log(1 + p * (1 - p) * (A[1] + B[1]));
  }
  const pairId = (a, b) => a < b ? a + "|" + b : b + "|" + a;
  // the most informative pair. o.skip: a Set of pair ids shown lately; o.rand: a 0..1 generator
  function nextPair(st, keys, o = {}) {
    const rand = o.rand || Math.random, skip = o.skip || new Set(), n = keys.length;
    if (n < 2) return null;
    let cands = [];
    if (n <= 36) { for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) cands.push([keys[i], keys[j]]); }
    else {
      for (let t = 0; t < 700; t++) { const i = (rand() * n) | 0; let j = (rand() * n) | 0; if (i !== j) cands.push([keys[i], keys[j]]); }
      const od = order(st, keys); for (let i = 0; i + 1 < n; i++) cands.push([od[i], od[i + 1]]);
    }
    let best = null, bs = -1;
    for (const [a, b] of cands) {
      const s = info(st, a, b) * (skip.has(pairId(a, b)) ? .15 : 1) * (.9 + .2 * rand());
      if (s > bs) { bs = s; best = [a, b]; }
    }
    return best;
  }
  // a set of three: the best pair plus whichever third adds the most about both
  function nextTriple(st, keys, o = {}) {
    if (keys.length < 3) return null;
    const rand = o.rand || Math.random, skip = o.skip || new Set(), p = nextPair(st, keys, o);
    let best = null, bs = -1;
    for (const c of keys) {
      if (c === p[0] || c === p[1]) continue;
      const s = (info(st, p[0], c) + info(st, p[1], c)) * (skip.has(pairId(p[0], c)) || skip.has(pairId(p[1], c)) ? .3 : 1) * (.9 + .2 * rand());
      if (s > bs) { bs = s; best = c; }
    }
    return [p[0], p[1], best];
  }
  // a breather: one clearly-liked, one in the middle, one clearly-less-liked (by what we know so far). Easy to answer,
  // and a quiet check that the model matches you.
  function easyTriple(st, keys, o = {}) {
    const n = keys.length, rand = o.rand || Math.random;
    if (n < 3) return null;
    if (n === 3) return order(st, keys);
    const od = order(st, keys), q = Math.max(1, Math.floor(n / 4)), third = Math.floor(n / 3);
    const at = (a, b) => od[Math.min(n - 1, a + Math.floor(rand() * Math.max(1, b - a)))];
    const t = [at(0, q), at(third, Math.max(third + 1, n - third)), at(n - q, n)];   // top quarter, the middle third, bottom quarter
    return new Set(t).size === 3 ? t.sort(() => rand() - .5) : nextTriple(st, keys, o);
  }
  // a handful of colors whose order is still unsettled: a random anchor and the colors nearest it in score
  function neighborhood(st, keys, size, o = {}) {
    const rand = o.rand || Math.random, od = order(st, keys);
    if (od.length <= size) return od;
    // start where neighbors are least sure of their order
    let at = 0, worst = 2;
    for (let i = 0; i + size <= od.length; i += Math.max(1, size >> 2)) {
      let s = 0; for (let j = i; j < i + size - 1; j++) s += above(st, od[j], od[j + 1]);
      s = s / (size - 1) + .05 * rand(); if (s < worst) { worst = s; at = i; }
    }
    return od.slice(at, at + size);
  }

  // ---------- keeping the store honest ----------
  const snap = (st, keys) => { const o = {}; keys.forEach(k => { if (st[k]) o[k] = st[k].slice(); else o[k] = null; }); return o; };
  const restore = (st, sn) => Object.keys(sn).forEach(k => { if (sn[k]) st[k] = sn[k].slice(); else delete st[k]; });
  // a context starts from what you said in general, a little less sure
  function fork(general, keys) {
    const st = {};
    keys.forEach(k => { const g = general[k]; if (g) st[k] = [g[0], Math.max(g[1], 1.2), 0]; });
    return st;
  }
  return { sig, V0, compare, rate, applyPairs, bwsPairs, orderPairs, budgetPairs, tierRate, swipeRate, TIER_Y, mean, order, rankOf, evidence, above, confidence, confLabel,
    info, pairId, nextPair, nextTriple, easyTriple, neighborhood, snap, restore, fork };
})();
if (typeof module !== "undefined" && module.exports) module.exports = PREFM;
