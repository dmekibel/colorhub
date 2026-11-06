// Palette strip order prototype (research/springfield-findings.md; NOT wired into the UI yet).
// palOrderGradient(hexes): the shortest path through the colors in OKLab with lightness weighted 0.5, so hue neighbors sit
// together and each hue run reads as a light-dark ramp; the path starts at its darker end. Exact DP (n <= 13); larger sets: nearest neighbour from the darkest + 2-opt + or-opt (palHeuristicPath), under 2 ms for 24.
function palOkHex(h) {
  const n = parseInt(h.slice(1), 16), f = v => { v /= 255; return v > .04045 ? ((v + .055) / 1.055) ** 2.4 : v / 12.92; };
  const r = f(n >> 16 & 255), g = f(n >> 8 & 255), b = f(n & 255);
  const l = Math.cbrt(.4122214708 * r + .5363325363 * g + .0514459929 * b), m = Math.cbrt(.2119034982 * r + .6806995451 * g + .1073969566 * b), s = Math.cbrt(.0883024619 * r + .2817188376 * g + .6299787005 * b);
  return [.2104542553 * l + .793617785 * m - .0040720468 * s, 1.9779984951 * l - 2.428592205 * m + .4505937099 * s, .0259040371 * l + .7827717662 * m - .808675766 * s];
}
// 14+ colors: nearest-neighbour from the darkest color, then 2-opt (reverse a stretch, either end free) and or-opt (move a run of
// 1-3 colors, either way round) until nothing shortens the open path. D is the weighted OKLab distance matrix.
function palHeuristicPath(o, D) {
  const n = o.length; let s0 = 0; for (let i = 1; i < n; i++) if (o[i][0] < o[s0][0]) s0 = i;
  const path = [s0], left = new Set(); for (let i = 0; i < n; i++) if (i !== s0) left.add(i);
  while (left.size) { const l = path[path.length - 1]; let b = -1; left.forEach(i => { if (b < 0 || D[l][i] < D[l][b]) b = i; }); path.push(b); left.delete(b); }
  const d = (x, y) => D[path[x]][path[y]];
  const cost = pp => { let c = 0; for (let k = 1; k < pp.length; k++) c += D[pp[k - 1]][pp[k]]; return c; };
  for (let pass = 0, imp = true; imp && pass < 30; pass++) {
    imp = false;
    for (let i = 0; i < n - 1; i++) for (let j = i + 1; j < n; j++) {   // 2-opt on the open path: reverse path[i..j]
      const before = (i > 0 ? d(i - 1, i) : 0) + (j < n - 1 ? d(j, j + 1) : 0), after = (i > 0 ? d(i - 1, j) : 0) + (j < n - 1 ? d(i, j + 1) : 0);
      if (after < before - 1e-9) { for (let a = i, b = j; a < b; a++, b--) { const t = path[a]; path[a] = path[b]; path[b] = t; } imp = true; }
    }
    for (let len = 1; len <= 3; len++) for (let i = 0; i + len <= n; i++) {   // or-opt: lift path[i..i+len-1] and drop it elsewhere
      const seg = path.slice(i, i + len), rest = path.slice(0, i).concat(path.slice(i + len));
      let best = null, bc = cost(path) - 1e-9;
      for (let at = 0; at <= rest.length; at++) for (const sg of [seg, seg.slice().reverse()]) {
        const cand = rest.slice(0, at).concat(sg, rest.slice(at)), c = cost(cand);
        if (c < bc) { bc = c; best = cand; }
      }
      if (best) { for (let k = 0; k < n; k++) path[k] = best[k]; imp = true; }
    }
  }
  return path;
}
function palOrderGradient(hexes) {
  const n = hexes.length; if (n < 3) return hexes.slice();
  const o = hexes.map(palOkHex), W = [.5, 1, 1];
  const D = o.map(p => o.map(q => Math.hypot(...p.map((v, i) => (v - q[i]) * W[i]))));
  let path;
  if (n <= 13) {
    const N = 1 << n, dp = new Float64Array(N * n).fill(Infinity), par = new Int8Array(N * n).fill(-1);
    for (let i = 0; i < n; i++) dp[(1 << i) * n + i] = 0;
    for (let m = 1; m < N; m++) for (let j = 0; j < n; j++) {
      const c = dp[m * n + j]; if (c === Infinity) continue;
      for (let t = 0; t < n; t++) { if (m >> t & 1) continue; const k = (m | 1 << t) * n + t, v = c + D[j][t]; if (v < dp[k]) { dp[k] = v; par[k] = j; } }
    }
    let j = 0, m = N - 1; for (let t = 1; t < n; t++) if (dp[m * n + t] < dp[m * n + j]) j = t;
    path = []; while (j >= 0) { path.push(j); const pj = par[m * n + j]; m ^= 1 << j; j = pj; }
  } else path = palHeuristicPath(o, D);
  if (o[path[0]][0] > o[path[path.length - 1]][0]) path.reverse();
  return path.map(i => hexes[i]);
}
// Stable across a changing count (a slider): `prev` is the order last shown for this strip. When the new set differs from it by a
// few colors only, the colors that stay keep their relative order, each new one goes in at its cheapest spot between neighbours
// (never appended at the end), and a color that left just closes the gap. Otherwise null (the caller orders from scratch).
function palOrderFromPrev(prev, hs) {
  if (!prev || prev.length < 3 || new Set(hs).size !== hs.length) return null;
  const want = new Set(hs), base = prev.filter(h => want.has(h)), have = new Set(base), add = hs.filter(h => !have.has(h));
  if (base.length < 3 || add.length > 3) return null;
  const ok = {}, D = (a, b) => { const x = ok[a] || (ok[a] = palOkHex(a)), y = ok[b] || (ok[b] = palOkHex(b)); return Math.hypot((x[0] - y[0]) * .5, x[1] - y[1], x[2] - y[2]); };
  const path = base.slice();
  add.forEach(h => {
    let bi = 0, bc = Infinity;
    for (let i = 0; i <= path.length; i++) {
      const c = i === 0 ? D(h, path[0]) : i === path.length ? D(path[i - 1], h) : D(path[i - 1], h) + D(h, path[i]) - D(path[i - 1], path[i]);
      if (c < bc) { bc = c; bi = i; }
    }
    path.splice(bi, 0, h);
  });
  return path;
}
const PAL_ORD_PREV = new Map();   // context key -> the order last returned for it
// memoized by the joined hexes; the one entry point the UI uses. Only for plain equal-swatch strips: never for strips whose
// widths show area, hand-ordered palettes (Studio editor, Picked colors) or an order that means something (timeline, wheel).
const PAL_ORD_CACHE = new Map();
function palDisplayOrder(hexes, ctx) {
  const hs = hexes.map(h => String(h).toUpperCase()); if (hs.length < 3 || hs.some(h => !/^#[0-9A-F]{6}$/.test(h))) return hexes.slice();
  if (ctx) {
    const prev = PAL_ORD_PREV.get(ctx), key0 = hs.join(""); let r = prev && prev.key === key0 ? prev.order : null;
    if (!r) { r = palOrderFromPrev(prev && prev.order, hs) || palOrderGradient(hs); if (PAL_ORD_PREV.size > 200) PAL_ORD_PREV.clear(); PAL_ORD_PREV.set(ctx, { key: key0, order: r }); }
    return r;
  }
  const key = hs.join(""); let r = PAL_ORD_CACHE.get(key);
  if (!r) { r = palOrderGradient(hs); if (PAL_ORD_CACHE.size > 400) PAL_ORD_CACHE.clear(); PAL_ORD_CACHE.set(key, r); }
  return r;
}
// same, for objects ({ h } / { hex }): returns the items in display order (stable for duplicate hexes)
function palOrderItems(items, hexOf, ctx) {
  const get = hexOf || (x => x.h || x.hex), left = items.slice(), out = [];
  palDisplayOrder(items.map(get), ctx).forEach(h => { const j = left.findIndex(x => String(get(x)).toUpperCase() === String(h).toUpperCase()); if (j >= 0) out.push(left.splice(j, 1)[0]); });
  return out.concat(left);
}
if (typeof module !== "undefined") module.exports = { palOrderGradient, palDisplayOrder, palOrderItems };
