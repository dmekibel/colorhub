"use strict";
// The taste engine behind "Find your color" and "Find your palette". No DOM here, so tools/taste_sim.js can test it in node.
// Preference is a utility over a few color features. Each "which do you prefer?" tap updates a Bradley-Terry
// (logistic) model online: a Gaussian belief over the weights, refined after every choice (a Laplace / Kalman-style
// step, as in Spiegelhalter & Lauritzen 1990). The next pair is the one the model is least sure about
// (largest expected information), so about 20 taps go much further than a fixed bracket.
// Uses the global color math from core.js (lab, lch, labHex, inGamut).
const TASTE = (() => {
  const sig = z => 1 / (1 + Math.exp(-z));
  const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
  const mv = (M, v) => M.map(r => dot(r, v));
  const sub = (a, b) => a.map((v, i) => v - b[i]);
  const rad = Math.PI / 180;
  // a small seeded random generator (mulberry32), so a palette can be rebuilt from its seed
  const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

  // ---------- the model: mean and covariance of the weights ----------
  function model(prior) { return { mu: prior.map(() => 0), S: prior.map((v, i) => prior.map((_, j) => i === j ? v : 0)), n: 0 }; }
  function predict(m, d) {
    const Sd = mv(m.S, d), v = dot(d, Sd), mean = dot(m.mu, d);
    return { mean, v, Sd, p: sig(mean / Math.sqrt(1 + Math.PI * v / 8)) };
  }
  // y = 1: the first option won; 0: the second; .5: a tie. wt < 1 for softer evidence.
  function update(m, d, y, wt = 1) {
    const { mean, v, Sd } = predict(m, d), p = sig(mean), h = wt * p * (1 - p), k = h / (1 + h * v);
    m.S = m.S.map((r, i) => r.map((x, j) => x - k * Sd[i] * Sd[j]));
    const Sd2 = mv(m.S, d);
    m.mu = m.mu.map((x, i) => x + wt * (y - p) * Sd2[i]);
    m.n++;
  }
  // a choice between features xa and xb. pick: 0 = a, 1 = b, "both", "neither". ref = features of an average option.
  function choose(m, xa, xb, pick, ref) {
    if (pick === 0 || pick === 1) return update(m, sub(xa, xb), pick === 0 ? 1 : 0);
    update(m, sub(xa, xb), .5, .6);
    const y = pick === "both" ? .75 : .25;   // both liked: each beats an average option; neither: each loses to it
    update(m, sub(xa, ref), y, .5); update(m, sub(xb, ref), y, .5);
  }
  const utility = (m, x) => dot(m.mu, x);
  const spread = (m, x) => Math.sqrt(Math.max(0, dot(x, mv(m.S, x))));
  // expected information from asking a vs b (log(1 + p(1-p) v), the drop in uncertainty along d)
  function info(m, xa, xb) { const { v, p } = predict(m, sub(xa, xb)); return Math.log(1 + p * (1 - p) * v); }

  // ---------- color features ----------
  // Hue as two harmonics (so the model can like blue AND red but not the middle), lightness and chroma with a
  // curve (an ideal point), and hue x lightness (dark yellow reads as olive, light yellow as butter).
  // Hue counts in proportion to how colorful the color is: a grey has no hue to like.
  const COLOR_PRIOR = [2, 2, 1, 1, 1.5, .6, 1.5, .6, .4, .4];
  function colorFeat(L, C, H) {
    const s = Math.min(1, C / 30), c1 = Math.cos(H * rad), s1 = Math.sin(H * rad), Lz = (L - 60) / 25, Cz = (C - 35) / 25;
    return [s * c1, s * s1, s * Math.cos(2 * H * rad), s * Math.sin(2 * H * rad), Lz, Lz * Lz - .5, Cz, Cz * Cz - .5, s * c1 * Lz, s * s1 * Lz];
  }
  // strongest on-screen chroma at a lightness and hue
  const MAXC = new Map();
  function maxC(L, H) {
    const k = Math.round(L) * 1000 + Math.round(H);
    if (MAXC.has(k)) return MAXC.get(k);
    let lo = 0, hi = 150;
    for (let i = 0; i < 16; i++) { const mid = (lo + hi) / 2; if (inGamut(L, mid * Math.cos(H * rad), mid * Math.sin(H * rad))) lo = mid; else hi = mid; }
    MAXC.set(k, lo); return lo;
  }
  const lchToHex = (L, C, H) => labHex(L, C * Math.cos(H * rad), C * Math.sin(H * rad));
  function colorItem(L, C, H, f) { const h = lchToHex(L, C, H); const [L2, C2, H2] = lch(h); return { h, L: L2, C: C2, H: H2, f, gL: L, gH: H, x: colorFeat(L2, C2, H2) }; }
  const hexItem = h => { const [L, C, H] = lch(h); return { h, L, C, H, x: colorFeat(L, C, H) }; };
  // colors to show in duels: 24 hues x 5 lightnesses x 4 strengths, plus greys
  function colorPool() {
    const out = [];
    for (let H = 0; H < 360; H += 15) for (const L of [30, 44, 58, 72, 86]) {
      const mc = Math.min(maxC(L, H), 95);
      for (const f of [.15, .4, .7, 1]) if (mc * f > 5) out.push(colorItem(L, mc * f, H, f));
    }
    for (const L of [24, 38, 52, 66, 80, 92]) out.push(colorItem(L, 0, 0, 0));
    return out;
  }
  // a finer grid for the results: every 5 degrees of hue
  function colorGrid() {
    const out = [];
    for (let H = 0; H < 360; H += 5) for (let L = 26; L <= 90; L += 4) {
      const mc = Math.min(maxC(L, H), 100);
      for (const f of [.2, .4, .6, .8, 1]) if (mc * f > 6) out.push(colorItem(L, mc * f, H, f));
    }
    for (let L = 22; L <= 94; L += 4) out.push(colorItem(L, 0, 0, 0));
    return out;
  }
  // the most informative next pair, from a random sample of pairs. ok(a, b) can veto a pair; skip = items shown lately.
  function nextPair(m, pool, opt = {}) {
    const { tries = 400, ok = () => true, skip = new Set(), rand = Math.random } = opt;
    const cands = [];
    for (let t = 0; t < tries; t++) {
      const a = pool[rand() * pool.length | 0], b = pool[rand() * pool.length | 0];
      if (a === b || skip.has(a) || skip.has(b) || !ok(a, b)) continue;
      cands.push([info(m, a.x, b.x), a, b]);
    }
    cands.sort((p, q) => q[0] - p[0]);
    const top = cands.slice(0, 3); if (!top.length) return [pool[0], pool[1]];
    const [, a, b] = top[rand() * top.length | 0];
    return [a, b];
  }

  // ---------- palette features: six dials ----------
  // Each dial is a number on a common scale (z, about -2 to 2). The model is utility = sum of w*z + v*z^2 per dial,
  // so each dial has an ideal point: the amount you like best.
  const DIALS = [
    { k: "contrast", name: "Contrast", lo: "Close values", hi: "Strong lights and darks", mid: 45, sd: 20 },
    { k: "vivid", name: "Vividness", lo: "Muted", hi: "Vivid", mid: 30, sd: 17 },
    { k: "warm", name: "Warmth", lo: "Cool", hi: "Warm", mid: 0, sd: .45 },
    { k: "spread", name: "Hue spread", lo: "One hue", hi: "Opposite hues", mid: .3, sd: .2 },
    { k: "count", name: "Colors", lo: "Few", hi: "Many", mid: 5, sd: 1.5 },
    { k: "dom", name: "Proportions", lo: "Even split", hi: "One field, small accents", mid: .3, sd: .22 },
  ];
  const PAL_PRIOR = [...DIALS.map(() => 1.5), ...DIALS.map(() => .5)];
  const hueDist = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
  // raw measurements of a palette: cols = hex list, shares = area fractions (any scale)
  function palRaw(cols, shares) {
    const tot = shares.reduce((a, b) => a + b, 0) || 1, w = shares.map(s => s / tot), P = cols.map(h => { const [L, a, b] = lab(h), C = Math.hypot(a, b); return { L, a, b, C, H: (Math.atan2(b, a) / rad + 360) % 360 }; });
    const seen = P.filter((p, i) => w[i] >= .012), Ls = seen.map(p => p.L);
    const contrast = Math.max(...Ls) - Math.min(...Ls);
    const vivid = P.reduce((s, p, i) => s + p.C * w[i], 0);
    // warmth: how close the hues sit to orange (+1) or to blue (-1), whatever their strength, so it doesn't double as vividness
    let wn = 0, wd = 0; P.forEach((p, i) => { const q = w[i] * Math.min(1, p.C / 15); wn += q * Math.cos((p.H - 60) * rad); wd += q; });
    const warm = wd > 1e-6 ? wn / wd : 0;
    // mean hue distance over pairs of colorful colors (a grey has no hue), 0 = one hue, 1 = opposite
    let num = 0, den = 0;
    for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
      const q = Math.min(1, P[i].C / 20) * Math.min(1, P[j].C / 20) * Math.sqrt(w[i] * w[j]);
      num += q * hueDist(P[i].H, P[j].H) / 180; den += q;
    }
    const n = cols.length, maxS = Math.max(...w);
    return { contrast, vivid, warm, spread: den > 1e-6 ? num / den : 0, count: n, dom: n > 1 ? (maxS - 1 / n) / (1 - 1 / n) : 1 };
  }
  const toZ = raw => DIALS.map(d => (raw[d.k] - d.mid) / d.sd);
  const fromZ = (k, z) => { const d = DIALS[k]; return d.mid + z * d.sd; };
  const palFeat = z => [...z, ...z.map(v => v * v - 1)];
  function palItem(cols, shares, extra = {}) { const raw = palRaw(cols, shares), z = toZ(raw); return { cols, shares, raw, z, x: palFeat(z), ...extra }; }

  // ---------- a palette generator that follows the dials ----------
  // target = six z values. seed fixes the random parts (hue path, lightness order, chroma jitter), so two
  // palettes from one seed differ only in the dial that changed.
  function genPalette(target, seed) {
    const R = rng(seed), [zc, zv, zw, zs, zn, zd] = target;
    const n = clamp(Math.round(fromZ(4, zn)), 3, 8);
    const range = clamp(fromZ(0, zc), 6, 86), Cw = clamp(fromZ(1, zv), 3, 80), sp = clamp(fromZ(3, zs), 0, .95), dom = clamp(fromZ(5, zd), 0, .92);
    // hue center from warmth: warm = orange (60), cool = blue (240); neutral goes through green or through violet
    const t = clamp(fromZ(2, zw), -1, 1), path = R() < .5 ? 1 : -1, jitter = (R() - .5) * 40;
    const Hc = (240 - path * (t + 1) / 2 * 180 + jitter + 720) % 360;
    // hue offsets: one group around the center, or two groups facing each other, whichever matches the spread
    let best = null;
    for (const two of [0, 1]) for (let A = 0; A <= 150; A += 6) {
      const offs = Array.from({ length: n }, (_, i) => {
        const g = two && i % 2 ? 180 : 0, idx = two ? Math.floor(i / 2) : i, cnt = two ? Math.ceil(n / 2) : n;
        return g + (cnt > 1 ? (idx / (cnt - 1) - .5) * 2 * A : 0);
      });
      let s = 0, c = 0; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { s += hueDist(offs[i], offs[j]) / 180; c++; }
      const err = Math.abs(s / Math.max(c, 1) - sp);
      if (!best || err < best[0] - 1e-9) best = [err, offs];
    }
    const order = Array.from({ length: n }, (_, i) => i).sort(() => R() - .5);
    const Lmid = clamp(52 + (R() - .5) * 22, 8 + range / 2, 96 - range / 2);
    const cols = best[1].map((o, i) => {
      const L = n > 1 ? Lmid + (order[i] / (n - 1) - .5) * range : Lmid, H = (Hc + o + 360) % 360;
      const C = Math.min(Cw * (.7 + R() * .6), maxC(L, H));
      return lchToHex(L, C, H);
    });
    // shares: the dominant color takes its share from the dial; the rest split what's left, tapering a little
    const want = dom * (1 - 1 / n) + 1 / n, rest = cols.slice(1).map((_, j) => Math.exp(-.45 * dom * j)), rt = rest.reduce((a, b) => a + b, 0) || 1;
    const ws = [want, ...rest.map(v => (1 - want) * v / rt)], tot = 1;
    return palItem(cols, ws.map(v => v / tot), { seed, target: target.slice() });
  }
  // The ideal point and strength of each dial under the model. The ideal is averaged over plausible weights
  // (samples from the belief), so a dial the answers barely touched stays near the middle instead of jumping to an end.
  const NORMALS = (() => { const R = rng(7), out = []; for (let i = 0; i < 80; i++) { const u = R() + 1e-9, v = R(); out.push([Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v), Math.sqrt(-2 * Math.log(u)) * Math.sin(2 * Math.PI * v)]); } return out; })();
  const ZS = Array.from({ length: 41 }, (_, i) => -2 + i * .1);
  function dialRead(m) {
    const D = DIALS.length;
    return DIALS.map((d, k) => {
      const a = m.mu[k], b = m.mu[D + k], f = (A, B, z) => A * z + B * (z * z - 1);
      // 2x2 Cholesky of the belief over (a, b)
      const saa = m.S[k][k], sab = m.S[k][D + k], sbb = m.S[D + k][D + k], l11 = Math.sqrt(Math.max(saa, 1e-9)), l21 = sab / l11, l22 = Math.sqrt(Math.max(sbb - l21 * l21, 1e-9));
      let zsum = 0;
      for (const [n1, n2] of NORMALS) {
        const A = a + l11 * n1, B = b + l21 * n1 + l22 * n2;
        let bz = 0, bu = -Infinity; for (const z of ZS) { const u = f(A, B, z); if (u > bu) { bu = u; bz = z; } }
        zsum += bz;
      }
      const us = ZS.map(z => f(a, b, z));
      return { ...d, z: zsum / NORMALS.length, strength: Math.max(...us) - Math.min(...us), sd: Math.sqrt(saa + sbb) };
    });
  }
  // the best and worst color on a grid: the most confidently liked (mean - sd) and disliked (mean + sd)
  function extremes(m, grid) {
    let top = null, low = null, tv = -Infinity, lv = Infinity;
    for (const g of grid) { const u = utility(m, g.x), s = spread(m, g.x); if (u - s > tv) { tv = u - s; top = g; } if (u + s < lv) { lv = u + s; low = g; } }
    return { top, low };
  }
  // the next palette pair: mostly vary ONE dial (conjoint style), the rest held near your current ideal
  function nextPalPair(m, asked, rand = Math.random) {
    const read = dialRead(m), base = read.map(r => clamp(r.z * .7 + (rand() - .5) * 1.2, -1.6, 1.6));
    const LV = [-1.8, -.9, 0, .9, 1.8], cands = [];
    for (let k = 0; k < DIALS.length; k++) {
      if (asked.length >= 2 && asked[asked.length - 1] === k && asked[asked.length - 2] === k) continue;
      const seed = (rand() * 1e9) | 0, times = asked.filter(x => x === k).length;
      for (let i = 0; i < LV.length; i++) for (let j = i + 1; j < LV.length; j++) {
        if (rand() < .55) continue;
        const ta = base.slice(), tb = base.slice(); ta[k] = LV[i]; tb[k] = LV[j];
        const a = genPalette(ta, seed), b = genPalette(tb, seed);
        // every dial but "count" must compare like with like: same number of colors in both options, so a tap
        // never has to wonder whether it's answering about the colors or about how many there are. The "count"
        // dial is the one exception (that's the question it's asking), and there it must actually differ.
        if (k === 4 ? a.cols.length === b.cols.length : a.cols.length !== b.cols.length) continue;
        cands.push([info(m, a.x, b.x) + .15 / (1 + times), k, rand() < .5 ? [a, b] : [b, a]]);
      }
    }
    cands.sort((p, q) => q[0] - p[0]);
    const [, k, pair] = cands[rand() * Math.min(2, cands.length) | 0];
    return { k, pair };
  }

  return { sig, dot, rng, model, predict, update, choose, utility, spread, info, COLOR_PRIOR, colorFeat, maxC, lchToHex, colorItem, hexItem, colorPool, colorGrid, nextPair, extremes,
    DIALS, PAL_PRIOR, palRaw, toZ, fromZ, palFeat, palItem, genPalette, dialRead, nextPalPair, hueDist };
})();
if (typeof module !== "undefined") module.exports = TASTE;
