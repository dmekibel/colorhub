"use strict";
// Color accuracy helpers: what the screen really shows, the one-time screen check, and camera white balance.
// Plain script; top-level names are shared with every js/*.js file (run node tools/check_names.js).

// ---------- score what's rendered ----------
// The drills build colors in Lab, but the screen shows 8-bit hex codes. Rounding moves a pair by up to about
// half a code step per channel, which is a large share of a 1 ΔE difference. So every drill measures the pair
// it actually drew, and redraws a pair that rounding collapsed below about one code step.
const SHOWN_MIN = .3;   // ΔE00 (or ΔL*): roughly one 8-bit code step in the most sensitive regions
const shownDE = (a, b) => de2000(a, b);
const shownDL = (light, dark) => lab(light)[0] - lab(dark)[0];
// A base (Lab) and an offset about d ΔE00 away, both as drawn: { a, b, act } with act measured between the
// two hex codes. Tries a few directions and keeps the one whose drawn difference lands closest to d.
function shownOffset(base, d, w, rnd = Math.random, tries = 8) {
  const a = labHex(...base);
  let best = null;
  for (let i = 0; i < tries; i++) {
    const o = offset(base, d, w, rnd) || offset(tame(base.map((x, j) => j ? x * .8 : x)), d, w, rnd);
    if (!o) continue;
    const b = labHex(...o), act = shownDE(a, b);
    if (b === a || act < SHOWN_MIN) continue;
    if (!best || Math.abs(Math.log(act / d)) < Math.abs(Math.log(best.act / d))) best = { a, b, act };
    if (Math.abs(act - d) <= d * .06) break;
  }
  return best;
}
// A lighter/darker pair from make(dd, shift) -> [light, dark], d apart in L* as drawn (at least SHOWN_MIN).
// Small lightness shifts change how the pair rounds; the closest drawn gap wins.
function shownLPair(make, d) {
  let best = null;
  for (const dd of [d, d * 1.25, d * 1.6, d + 1]) {
    for (const sh of [0, .12, -.12, .24, -.24, .36]) {
      const [l, k] = make(dd, sh), act = shownDL(l, k);
      if (act < SHOWN_MIN) continue;
      if (!best || Math.abs(act - d) < Math.abs(best.act - d)) best = { light: l, dark: k, act };
      if (Math.abs(act - d) <= Math.max(.05, d * .06)) return best;
    }
    if (best) return best;
  }
  return best || (() => { const [l, k] = make(d + 1, 0); return { light: l, dark: k, act: shownDL(l, k) }; })();
}
// A station's level as a continuous number (the check-in fits a curve to the drawn differences).
const lvExact = (sk, v) => 1 + 19 * Math.log(sk.start / v) / Math.log(sk.start / sk.top);

// ---------- the screen check (one time, before the first Train session and the first check-in) ----------
// S.scr = { ok: true if confirmed, t: day key, ci: 1 once shown before a check-in }
const scrOk = () => !!(S.scr && S.scr.ok);
const scrShot = () => typeof SHOT !== "undefined" && !!SHOT;
function screenCheck(next, forCheckin = false) {
  const greys = [20, 31, 54, 72, 90].map(L => lchHex(L, 0, 0));
  const darks = [3, 6, 9, 12, 15].map(L => lchHex(L, 0, 0));
  const el = show(`
    <header class="deck-top"><button class="icon-btn" data-close aria-label="Close">${ICON.x}</button><span class="eyebrow" style="flex:1;text-align:center">Before you train</span><span style="width:44px"></span></header>
    <h1 class="scr-h">Check your <em>screen.</em></h1>
    <p class="scr-lede">Train measures small differences, so your screen should show color as plainly as it can. This takes a minute, once.</p>
    <ol class="scr-steps">
      <li><b>Brightness most of the way up.</b><span>Swipe down from the top-right corner to open Control Center.</span></li>
      <li><b>Night Shift off.</b><span>Settings › Display &amp; Brightness › Night Shift. Or press and hold the brightness slider in Control Center.</span></li>
      <li><b>True Tone off.</b><span>Settings › Display &amp; Brightness › True Tone, or the same brightness slider. True Tone warms the screen to match the room.</span></li>
    </ol>
    <p class="scr-other">On Android, turn off Night Light, Eye Comfort or any blue-light filter.</p>
    <p class="eyebrow scr-cap">Test 1 · these should all look plain grey</p>
    <div class="scr-greys">${greys.map(h => `<i style="--c:${h}"></i>`).join("")}</div>
    <p class="scr-note">They are exact greys. If they look yellowish, a warm filter is still on; if they look blue, the screen runs cool.</p>
    <p class="eyebrow scr-cap">Test 2 · you should see five dark squares</p>
    <div class="scr-darks">${darks.map(h => `<i style="--c:${h}"></i>`).join("")}</div>
    <p class="scr-note">If the first squares disappear into the black, turn the brightness up.</p>
    <div class="stack scr-acts"><button class="btn" data-ok>Done: they look grey ${ICON.arrow}</button><button class="btn ghost" data-skip>Skip for now</button></div>
  `, "scr");
  document.documentElement.classList.add("booth");   // no film grain over the test patches
  const done = ok => {
    S.scr = Object.assign(S.scr || {}, { ok: ok || scrOk(), t: today() });
    if (forCheckin) S.scr.ci = 1;
    save(); next();
  };
  el.querySelector("[data-ok]").onclick = () => done(true);
  el.querySelector("[data-skip]").onclick = () => done(false);
  el.querySelector("[data-close]").onclick = () => done(false);
  onKey = e => { if (e.key === "Escape") done(false); if (e.key === "Enter") done(true); };
}
// a small reminder under the check-in card while the screen check hasn't been confirmed
const scrChip = () => scrOk() ? "" : `<button class="scr-chip" data-scr><i></i>Screen not checked · tap to check</button>`;

// ---------- camera white balance (von Kries) ----------
// Tap something white or grey: its color becomes the light's color. Each reading is then corrected by scaling
// the three cone responses (Bradford cone space) so that reference comes out neutral, keeping its lightness.
const WB_M = (() => {
  const toXYZ = [[.4124, .3576, .1805], [.2126, .7152, .0722], [.0193, .1192, .9505]];
  const brad = [[.8951, .2664, -.1614], [-.7502, 1.7135, .0367], [.0389, -.0685, 1.0296]];
  return brad.map(r => [0, 1, 2].map(j => r[0] * toXYZ[0][j] + r[1] * toXYZ[1][j] + r[2] * toXYZ[2][j]));
})();
const WB_MI = (() => {
  const [[a, b, c], [d, e, f], [g, h, i]] = WB_M, A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g, det = a * A + b * B + c * C;
  return [[A, -(b * i - c * h), b * f - c * e], [B, a * i - c * g, -(a * f - c * d)], [C, -(a * h - b * g), a * e - b * d]].map(r => r.map(v => v / det));
})();
const wbLin = h => rgb(h).map(v => { v /= 255; return v > .04045 ? ((v + .055) / 1.055) ** 2.4 : v / 12.92; });
const wbMul = (M, v) => M.map(r => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]);
const wbHex = lin => "#" + lin.map(v => { v = clamp(v, 0, 1); v = v > .0031308 ? 1.055 * v ** (1 / 2.4) - .055 : 12.92 * v; return Math.round(v * 255).toString(16).padStart(2, "0"); }).join("").toUpperCase();
// Returns a function hex -> corrected hex, or null when the reference is too dark or too colorful to be "white or grey".
function wbFrom(refHex) {
  const lin = wbLin(refHex), Y = .2126 * lin[0] + .7152 * lin[1] + .0722 * lin[2];
  if (Y < .02) return null;
  const ref = wbMul(WB_M, lin), white = wbMul(WB_M, [Y, Y, Y]), k = white.map((w, i) => w / Math.max(ref[i], 1e-6));
  if (k.some(x => x > 4 || x < .25)) return null;
  return hex => wbHex(wbMul(WB_MI, wbMul(WB_M, wbLin(hex)).map((v, i) => v * k[i])));
}
