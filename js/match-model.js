"use strict";
// Match engine, the model half: pure functions with no DOM, so tools/match_test.js can run them in node.
// Pixels are ImageData-shaped objects ({ width, height, data: RGBA bytes }). Every grade is a per-channel
// function, so it is baked into three 256-entry lookup tables and applied in one pass (fast while dragging).
// Names start with "mt" because top-level names are shared across js/*.js.

const mtClamp = (v, a, b) => v < a ? a : v > b ? b : v;
const mtLerp = (a, b, t) => a + (b - a) * t;
const mtImg = (w, h) => typeof ImageData !== "undefined" ? new ImageData(w, h) : { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) };

// ---------- sRGB <-> linear, Lab, CIEDE2000 ----------
const mtDec = v => v > .04045 ? ((v + .055) / 1.055) ** 2.4 : v / 12.92;
const mtEnc = v => { v = mtClamp(v, 0, 1); return v > .0031308 ? 1.055 * v ** (1 / 2.4) - .055 : 12.92 * v; };
const MT_LIN = Float64Array.from({ length: 256 }, (_, i) => mtDec(i / 255));
const mtF = t => t > .008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
// linear sRGB (0..1) -> CIELAB (D65)
function mtLab(r, g, b) {
  const x = mtF((r * .4124 + g * .3576 + b * .1805) / .95047), y = mtF(r * .2126 + g * .7152 + b * .0722), z = mtF((r * .0193 + g * .1192 + b * .9505) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
// XYZ (Y = 1 for white) -> Lab
function mtXyzLab(X, Y, Z) { const x = mtF(X / .95047), y = mtF(Y), z = mtF(Z / 1.08883); return [116 * y - 16, 500 * (x - y), 200 * (y - z)]; }
const mtXyzLin = (X, Y, Z) => [X * 3.2406 - Y * 1.5372 - Z * .4986, -X * .9689 + Y * 1.8758 + Z * .0415, X * .0557 - Y * .204 + Z * 1.057];
const mtHex = lin => "#" + lin.map(v => Math.round(mtEnc(v) * 255).toString(16).padStart(2, "0")).join("").toUpperCase();
const mtHexLin = h => [1, 3, 5].map(i => MT_LIN[parseInt(h.slice(i, i + 2), 16)]);
const mtHexLab = h => mtLab(...mtHexLin(h));
// Lab -> linear sRGB (unclamped)
function mtLabLin(L, a, b) {
  const fy = (L + 16) / 116, fx = a / 500 + fy, fz = fy - b / 200;
  const inv = t => t ** 3 > .008856 ? t ** 3 : (t - 16 / 116) / 7.787;
  return mtXyzLin(inv(fx) * .95047, inv(fy), inv(fz) * 1.08883);
}
const mtLabHex = (L, a, b) => mtHex(mtLabLin(L, a, b));
// CIEDE2000 on plain numbers (the same formula as core.js de2000, without array allocations)
function mtDE(L1, a1, b1, L2, a2, b2) {
  const rad = Math.PI / 180, Cb = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2, Cb7 = Cb ** 7;
  const G = .5 * (1 - Math.sqrt(Cb7 / (Cb7 + 6103515625))), a1p = a1 * (1 + G), a2p = a2 * (1 + G);
  const C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2);
  const hp = (b, a) => { if (!b && !a) return 0; const t = Math.atan2(b, a) / rad; return t < 0 ? t + 360 : t; };
  const h1p = hp(b1, a1p), h2p = hp(b2, a2p), dL = L2 - L1, dC = C2p - C1p;
  let dh = 0; if (C1p * C2p) { dh = h2p - h1p; if (dh > 180) dh -= 360; else if (dh < -180) dh += 360; }
  const dH = 2 * Math.sqrt(C1p * C2p) * Math.sin(dh * rad / 2), Lb = (L1 + L2) / 2, Cbp = (C1p + C2p) / 2;
  let hb = h1p + h2p; if (C1p * C2p) { if (Math.abs(h1p - h2p) > 180) hb += h1p + h2p < 360 ? 360 : -360; hb /= 2; }
  const T = 1 - .17 * Math.cos((hb - 30) * rad) + .24 * Math.cos(2 * hb * rad) + .32 * Math.cos((3 * hb + 6) * rad) - .2 * Math.cos((4 * hb - 63) * rad);
  const Cbp7 = Cbp ** 7, Rc = 2 * Math.sqrt(Cbp7 / (Cbp7 + 6103515625)), dTh = 30 * Math.exp(-(((hb - 275) / 25) ** 2));
  const Sl = 1 + .015 * (Lb - 50) ** 2 / Math.sqrt(20 + (Lb - 50) ** 2), Sc = 1 + .045 * Cbp, Sh = 1 + .015 * Cbp * T, Rt = -Math.sin(2 * dTh * rad) * Rc;
  return Math.sqrt((dL / Sl) ** 2 + (dC / Sc) ** 2 + (dH / Sh) ** 2 + Rt * (dC / Sc) * (dH / Sh));
}
const mtDELab = (A, B) => mtDE(A[0], A[1], A[2], B[0], B[1], B[2]);

// ---------- levels (same formula as gym.js levelOf) ----------
// Level 1-20 on a log scale between the level-1 score (start) and the level-20 score (top); 0 = not tried.
const mtLevelOf = (def, v) => v == null ? 0 : mtClamp(Math.round(1 + 19 * Math.log(def.start / v) / Math.log(def.start / def.top)), 1, 20);
// Set score = geometric mean of the round errors (a perfect 0 counts as 0.3, below anyone's limit).
const mtSetScore = errs => errs.length ? Math.exp(errs.reduce((s, e) => s + Math.log(Math.max(e, .3)), 0) / errs.length) : null;

// ---------- color wheels (lift / gamma / gain) ----------
// A wheel is { x, y, m }: (x, y) is the puck in the unit disc, m the luminance ring (-1..1).
// Channel directions on the wheel, like a vectorscope: red up-left, green down-left, blue down-right.
const MT_PHI = [100, 220, 340].map(d => d * Math.PI / 180);
const mtOff = (w, c) => w ? w.x * Math.cos(MT_PHI[c]) + w.y * Math.sin(MT_PHI[c]) : 0;   // sums to 0 over r, g, b
const mtWheel0 = () => ({ x: 0, y: 0, m: 0 });
// One channel of a lift/gamma/gain grade on an encoded value v (0..1).
function mtGradeCh(g, c, v) {
  const lift = .12 * mtOff(g.lift, c) + .15 * (g.lift ? g.lift.m : 0);
  const ex = 2 ** -(.35 * mtOff(g.gamma, c) + .7 * (g.gamma ? g.gamma.m : 0));
  const gain = 2 ** (.5 * mtOff(g.gain, c) + .8 * (g.gain ? g.gain.m : 0));
  let y = v + lift * (1 - v);
  y = mtClamp(y, 0, 1) ** ex;
  return mtClamp(y * gain, 0, 1);
}
// The color a wheel shows at a point (x, y) of its disc: grey pushed toward that direction.
const mtWheelRGB = (x, y, k = .32) => [0, 1, 2].map(c => mtClamp(.5 + k * (x * Math.cos(MT_PHI[c]) + y * Math.sin(MT_PHI[c])), 0, 1));

// ---------- curves: monotone cubic (Fritsch-Carlson) through 2-5 points -> 256-entry table ----------
function mtSpline(pts) {
  const p = pts.slice().sort((a, b) => a[0] - b[0]), n = p.length;
  if (n < 2) return x => x;
  const dx = [], m = [];
  for (let i = 0; i < n - 1; i++) { dx[i] = Math.max(p[i + 1][0] - p[i][0], 1e-6); m[i] = (p[i + 1][1] - p[i][1]) / dx[i]; }
  const t = new Array(n);
  t[0] = m[0]; t[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
    const a = t[i] / m[i], b = t[i + 1] / m[i], s = a * a + b * b;
    if (s > 9) { const tau = 3 / Math.sqrt(s); t[i] = tau * a * m[i]; t[i + 1] = tau * b * m[i]; }
  }
  return x => {
    if (x <= p[0][0]) return p[0][1];
    if (x >= p[n - 1][0]) return p[n - 1][1];
    let i = 0; while (x > p[i + 1][0]) i++;
    const h = dx[i], s = (x - p[i][0]) / h, s2 = s * s, s3 = s2 * s;
    return (2 * s3 - 3 * s2 + 1) * p[i][1] + (s3 - 2 * s2 + s) * h * t[i] + (-2 * s3 + 3 * s2) * p[i + 1][1] + (s3 - s2) * h * t[i + 1];
  };
}
function mtCurveLut(pts) { const f = mtSpline(pts), out = new Float64Array(256); for (let i = 0; i < 256; i++) out[i] = mtClamp(f(i / 255), 0, 1); return out; }
const mtCurve0 = () => [[0, 0], [1, 1]];
const mtCurves0 = () => ({ m: mtCurve0(), r: mtCurve0(), g: mtCurve0(), b: mtCurve0() });
// Read a curve table at a float input (linear interpolation between entries).
const mtLutAt = (lut, v) => { const x = mtClamp(v, 0, 1) * 255, i = Math.min(254, x | 0), f = x - i; return lut[i] + (lut[i + 1] - lut[i]) * f; };

// ---------- light: the Planckian (blackbody) locus, with a green-magenta tint ----------
// Krystek (1985) fit of the Planckian locus in CIE 1960 uv, good from 1000 to 15000 K.
function mtPlanckUV(T) {
  return [(.860117757 + 1.54118254e-4 * T + 1.28641212e-7 * T * T) / (1 + 8.42420235e-4 * T + 7.08145163e-7 * T * T),
    (.317398726 + 4.22806245e-5 * T + 4.20481691e-8 * T * T) / (1 - 2.89741816e-5 * T + 1.61456053e-7 * T * T)];
}
// The white of a light at T kelvin, moved off the locus by duv (positive = greener), as linear sRGB with Y = 1.
function mtWhite(T, duv = 0) {
  let [u, v] = mtPlanckUV(T); const [u2, v2] = mtPlanckUV(T + 1);
  let nu = -(v2 - v), nv = u2 - u; if (nv < 0) { nu = -nu; nv = -nv; }
  const n = Math.hypot(nu, nv) || 1; u += duv * nu / n; v += duv * nv / n;
  const d = 2 * u - 8 * v + 4, x = 3 * u / d, y = 2 * v / d;
  return mtXyzLin(x / y, 1, (1 - x - y) / y);
}
// Tint in slider points: 1 point = 0.001 Duv; positive = magenta (like a camera's tint slider).
const mtTintDuv = t => -t * .001;
// Per-channel linear gains that turn a 6504 K light into a T / tint light, at the same brightness.
function mtLightGains(T, tint = 0) {
  const w = mtWhite(T, mtTintDuv(tint)), w0 = mtWhite(6504, 0), g = w.map((x, i) => x / w0[i]);
  const Y = .2126 * g[0] + .7152 * g[1] + .0722 * g[2];
  return g.map(x => x / Y);
}
const mtMired = K => 1e6 / K;
// Kelvin eye score: mired error plus tint error at equal distance on the CIE 1960 uv chart
// (near daylight, 1 tint point = 0.001 uv is about as far as 4 mireds).
const MT_TINT_MIRED = 4;
function mtKelvinScore(guess, truth) {
  const dm = mtMired(guess.K) - mtMired(truth.K), dt = (guess.t || 0) - (truth.t || 0);
  return { err: Math.hypot(dm, MT_TINT_MIRED * dt), dm, dt };
}
function mtKelvinTip(guess, truth) {
  const { dm, dt } = mtKelvinScore(guess, truth), am = Math.abs(dm);
  if (Math.hypot(dm, MT_TINT_MIRED * dt) < 6) return "Spot on: within a few mireds, about as close as a light meter's rounding.";
  if (Math.abs(MT_TINT_MIRED * dt) > am) return `The temperature was close, but you read the light as too ${dt > 0 ? "magenta" : "green"}: it was ${Math.abs(dt) < 1.5 ? "nearly on" : dt > 0 ? "greener than" : "pinker than"} the blackbody line.`;
  return `You read the light as ${dm > 0 ? "warmer" : "cooler"} than it was, by ${Math.round(am)} mireds (you said ${Math.round(guess.K / 50) * 50} K; it was ${Math.round(truth.K / 50) * 50} K).`;
}

// ---------- lookup tables for a whole pipeline ----------
// fn(c, v) maps an encoded channel value (0..1) to the output (0..1). Returns 3 x 256 output bytes.
function mtLuts(fn) {
  const L = [new Uint8ClampedArray(256), new Uint8ClampedArray(256), new Uint8ClampedArray(256)];
  for (let c = 0; c < 3; c++) for (let i = 0; i < 256; i++) L[c][i] = Math.round(mtClamp(fn(c, i / 255), 0, 1) * 255);
  return L;
}
function mtApplyLuts(src, L, dst = mtImg(src.width, src.height)) {
  const s = src.data, d = dst.data, [R, G, B] = L;
  for (let i = 0; i < s.length; i += 4) { d[i] = R[s[i]]; d[i + 1] = G[s[i + 1]]; d[i + 2] = B[s[i + 2]]; d[i + 3] = 255; }
  return dst;
}
// A linear-light gain on an encoded value
const mtLinGain = (v, g) => mtEnc(mtDec(v) * g);

// ---------- pixel statistics ----------
// Lab of every `step`-th pixel on a grid (Float32Array of L, a, b triples)
function mtLabBuf(img, step = 2) {
  const { width: w, height: h, data: d } = img, o = step >> 1, nx = Math.ceil((w - o) / step), ny = Math.ceil((h - o) / step), out = new Float32Array(nx * ny * 3);
  let k = 0;
  for (let y = o; y < h; y += step) for (let x = o; x < w; x += step) {
    const i = (y * w + x) * 4, L = mtLab(MT_LIN[d[i]], MT_LIN[d[i + 1]], MT_LIN[d[i + 2]]);
    out[k++] = L[0]; out[k++] = L[1]; out[k++] = L[2];
  }
  return out;
}
const mtMeanDE = (A, B) => { let s = 0; const n = A.length / 3; for (let i = 0; i < A.length; i += 3) s += mtDE(A[i], A[i + 1], A[i + 2], B[i], B[i + 1], B[i + 2]); return n ? s / n : 0; };
// Signed mean error (yours - truth) in L, a, b for shadows, midtones and highlights (zones by the truth's L*).
const MT_ZONES = [["shadows", 0, 33], ["midtones", 33, 66], ["highlights", 66, 101]];
function mtZoneErr(truth, yours) {
  const z = MT_ZONES.map(([name]) => ({ name, n: 0, dL: 0, da: 0, db: 0, de: 0 }));
  for (let i = 0; i < truth.length; i += 3) {
    const L = truth[i], k = L < 33 ? 0 : L < 66 ? 1 : 2, o = z[k];
    o.n++; o.dL += yours[i] - L; o.da += yours[i + 1] - truth[i + 1]; o.db += yours[i + 2] - truth[i + 2];
    o.de += mtDE(truth[i], truth[i + 1], truth[i + 2], yours[i], yours[i + 1], yours[i + 2]);
  }
  z.forEach(o => { if (o.n) { o.dL /= o.n; o.da /= o.n; o.db /= o.n; o.de /= o.n; } });
  return z;
}
// A direction in the a*b* plane as a grader's word.
function mtHueWord(da, db) {
  let h = Math.atan2(db, da) * 180 / Math.PI; if (h < 0) h += 360;
  return h < 25 || h >= 345 ? "magenta" : h < 55 ? "red" : h < 80 ? "warm" : h < 115 ? "yellow" : h < 170 ? "green" : h < 230 ? "cyan" : h < 290 ? "cool" : "violet";
}
const mtWordPhrase = w => w === "warm" ? "warm (orange)" : w === "cool" ? "cool (blue)" : w;
// ONE tip from signed zone errors. start = the zone errors before you touched anything (to catch over-correction).
// Lightness counts a little less than color here because the eye forgives a small exposure shift more readily.
function mtGradeTip(zones, start, opts = {}) {
  const live = zones.filter(z => z.n > (opts.minN || 20));
  if (!live.length) return "No pixels to compare.";
  const mag = z => Math.hypot(.8 * z.dL, z.da, z.db), worst = live.slice().sort((a, b) => mag(b) - mag(a))[0];
  const total = live.reduce((s, z) => s + z.de * z.n, 0) / live.reduce((s, z) => s + z.n, 0);
  if (total < (opts.spot || 1.6) || mag(worst) < 1.2) return "Spot on: what's left is at the edge of what most people can see side by side.";
  const where = opts.whole ? "The image is" : `Your ${worst.name} are`;
  const chroma = Math.hypot(worst.da, worst.db);
  if (.8 * Math.abs(worst.dL) > chroma) return `${where} too ${worst.dL < 0 ? "dark" : "light"}${opts.whole ? "" : ""}: ${worst.dL < 0 ? "lift" : "lower"} ${opts.whole ? "it" : "them"} by about ${Math.round(Math.abs(worst.dL))} L*.`;
  const word = mtHueWord(worst.da, worst.db);
  const s0 = start && start.find(z => z.name === worst.name);
  if (s0 && Math.hypot(s0.da, s0.db) > 1.5 && s0.da * worst.da + s0.db * worst.db < 0)
    return `You over-corrected: ${opts.whole ? "the image" : "your " + worst.name} went past neutral toward ${mtWordPhrase(word)}. Back off by about half.`;
  return `${where} still too ${mtWordPhrase(word)}: push ${opts.whole ? "it" : "them"} toward ${mtWordPhrase(mtHueWord(-worst.da, -worst.db))}.`;
}

// ---------- procedural scenes (so the true answer is exactly known) ----------
// A tiny seeded random generator
const mtRnd = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
// kind: "studio" (white wall, 18% grey card, three lit spheres on a floor) or "sky" (gradient sky, field, grey stones).
// Returns linear light per pixel under daylight; mtLit() then colors it with a light and encodes it, so a new
// light costs one pass. A simplified model: Lambert shading, one key light, soft contact shadows, no camera white balance.
function mtSceneLin(kind, w, h, seed = 1) {
  const lin = new Float32Array(w * h * 3), rnd = mtRnd(seed), hz = Math.round(h * (kind === "sky" ? .58 : .62));
  const Ld = (() => { const v = [-.55, .65, .55], n = Math.hypot(...v); return v.map(x => x / n); })();
  const sph = kind === "sky"
    ? [{ x: .28, r: .1, c: [.3, .3, .3] }, { x: .62, r: .14, c: [.42, .4, .37] }, { x: .85, r: .07, c: [.2, .2, .21] }]
    : [{ x: .27, r: .11, c: [.56, .06, .05] }, { x: .54, r: .13, c: [.05, .13, .48] }, { x: .81, r: .09, c: [.46, .5, .08] }];
  sph.forEach((s, i) => { s.x += (rnd() - .5) * .03; s.cy = hz / h + .12 + i % 2 * .05; s.R = s.r * Math.min(w, h * 1.5); s.cx = s.x * w; s.cyp = s.cy * h - s.R * .9; });
  const card = kind === "studio" ? [.07 + rnd() * .05, .12, .29 + rnd() * .03, .44] : null, sunX = .7 + rnd() * .15, ex = kind === "sky" ? .95 : .9;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let alb, I;
    const u = x / w, v = y / h;
    if (y < hz) {
      if (kind === "sky") {
        const t = y / hz; alb = [mtLerp(.07, .62, t ** 1.4), mtLerp(.16, .7, t ** 1.3), mtLerp(.45, .8, t)];
        const sun = Math.exp(-(((u - sunX) / .12) ** 2 + ((v - .18) / .1) ** 2)); alb = alb.map((a, i) => a + sun * [.6, .5, .3][i]);
        I = 1;
      } else {
        alb = [.8, .8, .8]; I = .7 + .35 * Math.exp(-(((u - .25) / .7) ** 2 + ((v - .1) / .8) ** 2));
        if (card && u > card[0] && u < card[2] && v > card[1] && v < card[3]) alb = [.18, .18, .18];
      }
    } else {
      const t = (y - hz) / (h - hz);
      alb = kind === "sky" ? [mtLerp(.09, .16, t), mtLerp(.14, .2, t), mtLerp(.05, .07, t)] : [mtLerp(.3, .38, t), mtLerp(.25, .31, t), mtLerp(.2, .24, t)];
      I = .75 + .35 * t;
      // soft contact shadows to the lower right of each sphere
      sph.forEach(s => { const sx = (x - s.cx - s.R * .5) / (s.R * 1.5), sy = (y - s.cy * h - s.R * .05) / (s.R * .35); I *= 1 - .55 * Math.exp(-(sx * sx + sy * sy)); });
    }
    const col = alb.map(a => a * I);
    for (const s of sph) {
      const dx = (x - s.cx) / s.R, dy = (y - s.cyp) / s.R, rr = dx * dx + dy * dy, edge = 1 + 1 / s.R;
      if (rr < edge * edge) {
        const r1 = Math.min(rr, 1), nz = Math.sqrt(1 - r1), ndl = Math.max(0, dx * Ld[0] - dy * Ld[1] + nz * Ld[2]);
        const Is = .16 + .95 * ndl, spec = ndl ** 40 * .35, cov = mtClamp((1 - Math.sqrt(rr)) * s.R + .5, 0, 1);   // antialiased rim
        for (let c = 0; c < 3; c++) col[c] = col[c] * (1 - cov) + (s.c[c] * Is + spec) * cov;
        break;
      }
    }
    const i = (y * w + x) * 3;
    for (let c = 0; c < 3; c++) lin[i + c] = col[c] * ex;
  }
  return { width: w, height: h, lin };
}
const MT_ENC = Uint8Array.from({ length: 4097 }, (_, i) => Math.round(mtEnc(i / 4096) * 255));
// Light a scene: linear * per-channel light gains, then encode to sRGB bytes.
function mtLit(sc, light = [1, 1, 1], dst = mtImg(sc.width, sc.height)) {
  const s = sc.lin, d = dst.data;
  for (let i = 0, j = 0; i < s.length; i += 3, j += 4) {
    d[j] = MT_ENC[Math.min(4096, s[i] * light[0] * 4096 | 0)]; d[j + 1] = MT_ENC[Math.min(4096, s[i + 1] * light[1] * 4096 | 0)];
    d[j + 2] = MT_ENC[Math.min(4096, s[i + 2] * light[2] * 4096 | 0)]; d[j + 3] = 255;
  }
  return dst;
}
const mtScene = (kind, w, h, light, seed) => mtLit(mtSceneLin(kind, w, h, seed), light);
// A close neighbor: a color about `d` CIEDE2000 away in a random direction (lightness moves a little less), on screen.
function mtNear(Lab, d, rnd = Math.random, w = [.7, 1, 1]) {
  for (let t = 0; t < 40; t++) {
    let v = w.map(k => k * (rnd() * 2 - 1)); const n = Math.hypot(...v) || 1; v = v.map(x => x / n);
    let k = d;
    for (let i = 0; i < 6; i++) { const c = Lab.map((x, j) => x + v[j] * k), got = mtDELab(Lab, c); if (!got) break; k *= d / got; }
    const out = Lab.map((x, j) => x + v[j] * k);
    if (mtLabLin(...out).every(x => x >= -.001 && x <= 1.001)) return out;
  }
  return [mtClamp(Lab[0] + (rnd() < .5 ? -d : d), 2, 98), Lab[1], Lab[2]];
}
// Copy a rectangle out of an image.
function mtCrop(img, x0, y0, w, h) {
  const out = mtImg(w, h), s = img.data, d = out.data;
  for (let y = 0; y < h; y++) d.set(s.subarray(((y + y0) * img.width + x0) * 4, ((y + y0) * img.width + x0 + w) * 4), y * w * 4);
  return out;
}

// ---------- value: L* of an image, greyscale ----------
function mtGrey(img) {
  const out = mtImg(img.width, img.height), s = img.data, d = out.data;
  for (let i = 0; i < s.length; i += 4) {
    const Y = .2126 * MT_LIN[s[i]] + .7152 * MT_LIN[s[i + 1]] + .0722 * MT_LIN[s[i + 2]], g = Math.round(mtEnc(Y) * 255);
    d[i] = d[i + 1] = d[i + 2] = g; d[i + 3] = 255;
  }
  return out;
}
const mtLstar = Y => 116 * mtF(Y) - 16;
const mtLGrey = L => mtLabHex(L, 0, 0);
// Spots for the painting value variant: flat patches (low local spread), far apart, spread across the value range.
function mtFlatSpots(img, n = 3, rnd = Math.random, r = 5) {
  const { width: w, height: h, data: d } = img, L = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) L[i] = mtLstar(.2126 * MT_LIN[d[i * 4]] + .7152 * MT_LIN[d[i * 4 + 1]] + .0722 * MT_LIN[d[i * 4 + 2]]);
  const cand = [];
  // keep clear of the edges (room for the ring and its number badge)
  for (let y = Math.max(r * 2, h * .1 | 0); y < h - Math.max(r * 2, h * .06); y += 4) for (let x = Math.max(r * 2, w * .06 | 0); x < w - Math.max(r * 2, w * .14); x += 4) {
    let s = 0, s2 = 0, k = 0;
    for (let j = -r; j <= r; j += 2) for (let i = -r; i <= r; i += 2) { const v = L[(y + j) * w + x + i]; s += v; s2 += v * v; k++; }
    const m = s / k, sd = Math.sqrt(Math.max(0, s2 / k - m * m));
    if (sd < 2.2) cand.push({ x, y, L: m, sd });
  }
  const out = [];
  for (let t = 0; t < 400 && out.length < n; t++) {
    const c = cand[rnd() * cand.length | 0]; if (!c) break;
    if (out.every(o => Math.hypot(o.x - c.x, o.y - c.y) > w * .2 && Math.abs(o.L - c.L) > 9)) out.push(c);
  }
  // the surround: mean L* in a ring around each spot (for the simultaneous-contrast tip)
  out.forEach(o => {
    let s = 0, k = 0;
    for (let a = 0; a < 16; a++) { const R = r * 3.2, x = Math.round(o.x + R * Math.cos(a / 16 * 2 * Math.PI)), y = Math.round(o.y + R * Math.sin(a / 16 * 2 * Math.PI)); if (x >= 0 && y >= 0 && x < w && y < h) { s += L[y * w + x]; k++; } }
    o.sur = k ? s / k : o.L;
  });
  return out;
}
// ONE tip for a value task. items = [{ label, yours, truth, sur? }] in L*.
function mtValueTip(items, o = {}) {
  const worst = items.slice().sort((a, b) => Math.abs(b.yours - b.truth) - Math.abs(a.yours - a.truth))[0], e = worst.yours - worst.truth;
  if (Math.abs(e) < 2) return "Spot on: every value within 2 L*, about the smallest lightness step most people can see.";
  const by = `${Math.round(Math.abs(e))} L*`;
  if (worst.sur != null && Math.abs(worst.sur - worst.truth) > 8 && (worst.sur < worst.truth) === (e > 0))
    return `${worst.label} is ${by} too ${e > 0 ? "light" : "dark"}. Its ${worst.sur < worst.truth ? "darker" : "lighter"} surround made it look ${e > 0 ? "lighter" : "darker"} than it is (simultaneous contrast).`;
  return o.spot ? `${worst.label} is ${by} too ${e > 0 ? "light" : "dark"}. Find the lightest light and darkest dark first, then place the spot between them.`
    : `${worst.label} is ${by} too ${e > 0 ? "light" : "dark"}. Judge each step against both of its neighbors, not on its own.`;
}

// ---------- big masses: smooth a palette map into a few big shapes ----------
// map = Uint8Array of class indices (w x h). A majority filter, run `passes` times.
function mtMajority(map, w, h, k, r = 2, passes = 2) {
  let src = map;
  for (let p = 0; p < passes; p++) {
    const out = new Uint8Array(w * h), cnt = new Int32Array(k);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      cnt.fill(0);
      for (let j = Math.max(0, y - r); j <= Math.min(h - 1, y + r); j++) for (let i = Math.max(0, x - r); i <= Math.min(w - 1, x + r); i++) cnt[src[j * w + i]]++;
      let best = src[y * w + x]; for (let c = 0; c < k; c++) if (cnt[c] > cnt[best]) best = c;
      out[y * w + x] = best;
    }
    src = out;
  }
  return src;
}
// A label point deep inside each class: the pixel with the most same-class pixels in a window.
function mtMassLabels(map, w, h, k, r = 9) {
  const best = Array.from({ length: k }, () => ({ s: -1, x: 0, y: 0, n: 0 }));
  for (let i = 0; i < w * h; i++) best[map[i]].n++;
  for (let y = r; y < h - r; y += 3) for (let x = r; x < w - r; x += 3) {
    const c = map[y * w + x]; let s = 0;
    for (let j = -r; j <= r; j += 3) for (let i = -r; i <= r; i += 3) if (map[(y + j) * w + x + i] === c) s++;
    if (s > best[c].s) Object.assign(best[c], { s, x, y });
  }
  return best;
}
// ONE tip for masses. items = [{ name, yours (Lab), truth (Lab), share }]
function mtMassTip(items) {
  const scored = items.map(it => ({ ...it, de: mtDELab(it.yours, it.truth) })).sort((a, b) => b.de * Math.sqrt(b.share) - a.de * Math.sqrt(a.share));
  const w = scored[0];
  if (w.de < 2) return "Spot on: every mass within about 2 ΔE of the painting.";
  const dL = w.yours[0] - w.truth[0], da = w.yours[1] - w.truth[1], db = w.yours[2] - w.truth[2], dC = Math.hypot(w.yours[1], w.yours[2]) - Math.hypot(w.truth[1], w.truth[2]);
  const what = Math.abs(dL) * .8 >= Math.hypot(da, db) ? (dL > 0 ? "too light" : "too dark")
    : Math.abs(dC) > Math.hypot(da, db) * .7 ? (dC > 0 ? "too strong: it needs to be greyer" : "too grey: it needs more color")
    : "too " + mtWordPhrase(mtHueWord(da, db));
  return `Your ${w.name.toLowerCase()} mass is ${what}.`;
}

// ---------- Zorn palette: a small spectral mixing model ----------
// Simplified on purpose: 10 bands (400-670 nm, 30 nm wide); D65 light; CIE 1931 2° observer from the
// Wyman-Sloan-Shirley (2013) analytic fit, integrated over each band; pigment reflectance curves are
// hand-drawn approximations of typical published shapes, not measurements of any brand.
// Mixing = weighted geometric mean of reflectance (Burns), with a rough tinting strength per paint.
const MT_WL = [400, 430, 460, 490, 520, 550, 580, 610, 640, 670];
const MT_D65 = [49.9755, 54.6482, 82.7549, 91.486, 93.4318, 86.6823, 104.865, 117.008, 117.812, 114.861, 115.923, 108.811, 109.354, 107.802, 104.79, 107.689,
  104.405, 104.046, 100, 96.3342, 95.788, 88.6856, 90.0062, 89.5991, 87.6987, 83.2886, 83.6992, 80.0268, 80.2146, 82.2778, 78.2842, 69.7213, 71.6091]; // 380..700 step 10
const mtD65At = l => { const x = (l - 380) / 10, i = mtClamp(Math.floor(x), 0, MT_D65.length - 2), f = x - i; return MT_D65[i] + (MT_D65[i + 1] - MT_D65[i]) * f; };
const mtGl = (x, mu, s1, s2) => { const t = (x - mu) / (x < mu ? s1 : s2); return Math.exp(-.5 * t * t); };
const mtCMF = l => [1.056 * mtGl(l, 599.8, 37.9, 31) + .362 * mtGl(l, 442, 16, 26.7) - .065 * mtGl(l, 501.1, 20.4, 26.2),
  .821 * mtGl(l, 568.8, 46.9, 40.5) + .286 * mtGl(l, 530.9, 16.3, 31.1), 1.217 * mtGl(l, 437, 11.8, 36) + .681 * mtGl(l, 459, 26, 13.8)];
// Per-band weights W[band] = [X, Y, Z] of light reflected by a perfect white in that band, normalized to Y = 1,
// then X and Z scaled so a perfect white lands exactly on D65 white (fixes the coarse sampling).
const MT_W = (() => {
  const W = MT_WL.map(c => { const s = [0, 0, 0]; for (let l = c - 15; l < c + 15; l++) { const e = mtD65At(l + .5), m = mtCMF(l + .5); s[0] += e * m[0]; s[1] += e * m[1]; s[2] += e * m[2]; } return s; });
  const t = W.reduce((a, s) => [a[0] + s[0], a[1] + s[1], a[2] + s[2]], [0, 0, 0]);
  return W.map(s => [s[0] / t[0] * .95047, s[1] / t[1], s[2] / t[2] * 1.08883]);
})();
const MT_PAINTS = [
  { id: "white", name: "Titanium white", k: 1, R: [.8, .88, .9, .91, .91, .91, .91, .91, .91, .91] },
  { id: "ochre", name: "Yellow ochre", k: 1, R: [.07, .08, .09, .12, .2, .31, .41, .47, .5, .52] },
  { id: "vermilion", name: "Vermilion", k: 1.6, R: [.05, .045, .04, .04, .04, .045, .1, .42, .6, .65] },
  // ivory black is set slightly cool (its tints read bluish grey), which is what turns ochre olive
  { id: "black", name: "Ivory black", k: 3, R: [.04, .046, .05, .052, .052, .048, .042, .037, .034, .033] },
];
const mtReflXYZ = R => R.reduce((a, r, i) => [a[0] + r * MT_W[i][0], a[1] + r * MT_W[i][1], a[2] + r * MT_W[i][2]], [0, 0, 0]);
// amounts = parts of each paint (same order as MT_PAINTS). Returns { R, lab, lin, hex } or null for no paint.
function mtMix(amounts) {
  const eff = amounts.map((a, i) => Math.max(0, a) * MT_PAINTS[i].k), tot = eff.reduce((s, x) => s + x, 0);
  if (tot <= 0) return null;
  const R = MT_WL.map((_, b) => Math.exp(eff.reduce((s, e, i) => s + (e / tot) * Math.log(MT_PAINTS[i].R[b]), 0)));
  const [X, Y, Z] = mtReflXYZ(R), lin = mtXyzLin(X, Y, Z);
  return { R, lab: mtXyzLab(X, Y, Z), lin, hex: mtHex(lin) };
}
// The closest mix to a target (grid search over the simplex, then a local polish). Returns { amounts, de }.
function mtZornBest(target) {
  let best = { de: Infinity, amounts: null };
  const N = 16;
  for (let a = 0; a <= N; a++) for (let b = 0; a + b <= N; b++) for (let c = 0; a + b + c <= N; c++) {
    const am = [a, b, c, N - a - b - c], m = mtMix(am); if (!m) continue;
    const de = mtDELab(m.lab, target); if (de < best.de) best = { de, amounts: am };
  }
  let am = best.amounts.slice(), step = .5;
  for (let it = 0; it < 60 && step > .02; it++) {
    let moved = false;
    for (let i = 0; i < 4; i++) for (const s of [step, -step]) {
      const t = am.slice(); t[i] = Math.max(0, t[i] + s); const m = mtMix(t); if (!m) continue;
      const de = mtDELab(m.lab, target); if (de < best.de - 1e-4) { best = { de, amounts: t }; am = t; moved = true; }
    }
    if (!moved) step /= 2;
  }
  return best;
}
// ONE tip: the single change (a bit more or a bit less of one paint) that helps most.
function mtZornTip(amounts, target, best) {
  const now = mtMix(amounts), de0 = now ? mtDELab(now.lab, target) : 99;
  if (best && best.de > 6) return `Out of range: no mix of these four paints reaches this color (the closest possible is ΔE ${best.de.toFixed(1)}). The Zorn palette has no true blue or green; its cool notes are greys of black and white, which can read as blue beside the warm colors.`;
  if (de0 < 2) return "Spot on: about as close as two dabs of real paint ever match.";
  const tot = amounts.reduce((s, x) => s + x, 0) || 1, step = Math.max(.25, tot * .12);
  let pick = null;
  MT_PAINTS.forEach((p, i) => [1, -1].forEach(sg => {
    if (sg < 0 && amounts[i] <= 0) return;
    const t = amounts.slice(); t[i] = Math.max(0, t[i] + sg * step); const m = mtMix(t); if (!m) return;
    const de = mtDELab(m.lab, target); if (!pick || de < pick.de) pick = { de, i, sg };
  }));
  if (!pick || pick.de >= de0) return "Close: tiny amounts now. Nudge one paint at a time and watch the swatch.";
  const nm = MT_PAINTS[pick.i].name.toLowerCase();
  return pick.sg > 0 ? `Add a little more ${nm}.` : `Use less ${nm}.`;
}

if (typeof module !== "undefined") module.exports = {
  mtClamp, mtImg, mtEnc, mtDec, mtLab, mtHexLab, mtLabHex, mtDE, mtDELab, mtLevelOf, mtSetScore, mtOff, mtGradeCh, mtWheelRGB,
  mtSpline, mtCurveLut, mtLutAt, mtPlanckUV, mtWhite, mtLightGains, mtMired, mtKelvinScore, mtKelvinTip, mtLuts, mtApplyLuts, mtLinGain,
  mtLabBuf, mtMeanDE, mtZoneErr, mtHueWord, mtGradeTip, mtScene, mtSceneLin, mtLit, mtNear, mtLabLin, mtCrop, mtGrey, mtLstar, mtFlatSpots, mtValueTip,
  mtMajority, mtMassLabels, mtMassTip, MT_PAINTS, mtMix, mtZornBest, mtZornTip, mtRnd, MT_W,
};
