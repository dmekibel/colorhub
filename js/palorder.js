// Palette strip order prototype (research/springfield-findings.md; NOT wired into the UI yet).
// palOrderGradient(hexes): the shortest path through the colors in OKLab with lightness weighted 0.5, so hue neighbors sit
// together and each hue run reads as a light-dark ramp; the path starts at its darker end. Exact DP (n <= 13), else greedy.
function palOkHex(h) {
  const n = parseInt(h.slice(1), 16), f = v => { v /= 255; return v > .04045 ? ((v + .055) / 1.055) ** 2.4 : v / 12.92; };
  const r = f(n >> 16 & 255), g = f(n >> 8 & 255), b = f(n & 255);
  const l = Math.cbrt(.4122214708 * r + .5363325363 * g + .0514459929 * b), m = Math.cbrt(.2119034982 * r + .6806995451 * g + .1073969566 * b), s = Math.cbrt(.0883024619 * r + .2817188376 * g + .6299787005 * b);
  return [.2104542553 * l + .793617785 * m - .0040720468 * s, 1.9779984951 * l - 2.428592205 * m + .4505937099 * s, .0259040371 * l + .7827717662 * m - .808675766 * s];
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
  } else {
    let best = null;
    for (let s = 0; s < n; s++) { const p = [s], left = new Set([...Array(n).keys()].filter(i => i !== s)); let len = 0;
      while (left.size) { let b = -1; left.forEach(i => { if (b < 0 || D[p[p.length - 1]][i] < D[p[p.length - 1]][b]) b = i; }); len += D[p[p.length - 1]][b]; p.push(b); left.delete(b); }
      if (!best || len < best.len) best = { len, p }; }
    path = best.p;
  }
  if (o[path[0]][0] > o[path[path.length - 1]][0]) path.reverse();
  return path.map(i => hexes[i]);
}
if (typeof module !== "undefined") module.exports = { palOrderGradient };
