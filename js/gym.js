"use strict";
// Train tab: train the judgments painters make, one station at a time (like an ear-training app).
// Two kinds of station:
//  - staircase: get it right and the next difference is smaller, miss and it grows, so each skill settles
//    near the smallest difference you can see (about 3 in 4 right; see js/gym-engine.js);
//  - adjust: you slide a color until it looks right, and the score is how far off you were.
// Either way the score is a color difference (smaller = sharper), mapped onto levels 1-20.
// The engine (dials, weak spots, tips, confidence, check-ins, spacing, unlocks) lives in js/gym-engine.js.
// Practice sharpens the trained judgment; the copy promises nothing more
// (learning-kb anti-claim: brain-training gains stay in the trained task).
// Size rule: every drill swatch is at least a quarter of the screen wide (small patches look less colorful).

const AFTER = { name: "Afterimage", what: "Stare for 20 seconds, then look at white" };
const AIM_LINE = "Aim for about 7 in 10. Misses mean you're at your edge.";
const skillState = k => S.gym.skills[k] || (S.gym.skills[k] = { level: SKILLS[k].start, best: null, hist: [], fam: {} });
const lastScore = k => { const h = (S.gym.skills[k] || {}).hist || []; return h.length ? h[h.length - 1][1] : null; };
const levelOf = (k, v) => levelFor(SKILLS[k], v);
const ladder = (lv, cls = "") => `<span class="ladder ${cls}" aria-label="Level ${lv} of 20">${Array.from({ length: 20 }, (_, i) => `<i${i < lv ? ' class="on"' : ""}></i>`).join("")}</span>`;
const gyDayOf = key => { if (!/^\d{4}-\d\d-\d\d$/.test(key || "")) return null; const [y, m, d] = key.split("-").map(Number); return Math.round(Date.UTC(y, m - 1, d) / 864e5); };
const gyDay = () => gyDayOf(today());

// Random numbers for drills: Math.random, except during a check-in, where each round is seeded by the week
// (so everyone's check-in that week has the same colors) and drills draw from the full color list.
let GY_R = Math.random, GY_FIXED = false;
const gR = () => GY_R();
const gShuf = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = gR() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };

// ---------- engine state (all under S.gym; old fields kept as they were) ----------
// S.gym.st[k] = { due, stage, prevLv, plv (highest dial level reached), told, maint, trials: [...], cb: [callbacks] }
// S.gym.checkins = [{ t: day, date, res: { k: { lv, hits?, n?, est? } } }], S.gym.seen[k] = 1 after the intro,
// S.gym.conf = { s: [asked, right], g: [asked, right] }, S.gym.mixed[m] = { n, last, hits, of }
function gyState() {
  const g = S.gym;
  g.st = g.st || {}; g.checkins = g.checkins || []; g.seen = g.seen || {}; g.mixed = g.mixed || {};
  g.conf = g.conf || { s: [0, 0], g: [0, 0] };
  return g;
}
function stOf(k) {
  const g = gyState();
  if (!g.st[k]) {
    // stations trained before the engine existed: schedule them from their last session
    const h = (S.gym.skills[k] || {}).hist || [], last = h.length ? h[h.length - 1] : null, ld = last && gyDayOf(last[0]);
    g.st[k] = { stage: 0, due: ld != null ? ld + 1 : null, prevLv: last ? levelOf(k, last[1]) : null, plv: last ? levelOf(k, last[1]) : 0, trials: [], cb: [] };
  }
  return g.st[k];
}
function lastCheckin(k) { const c = gyState().checkins; for (let i = c.length - 1; i >= 0; i--) if (c[i].res[k]) return c[i]; return null; }
// A station's level: from the latest check-in when there is one (the honest number), else from sessions.
function stationLevel(k) {
  const sess = levelOf(k, lastScore(k)), ci = lastCheckin(k);
  return { lv: ci ? ci.res[k].lv : sess, sess, ci: ci ? ci.res[k].lv : null, tried: sess > 0 || !!ci };
}
const lvOf = k => stationLevel(k).lv;
// The dial plan follows the highest level a station has reached, so a dial never switches back off.
const planLevel = k => Math.max(1, stOf(k).plv || 0, levelOf(k, lastScore(k)));
const squintOpen = () => squintUnlocked(lvOf) || !!(S.gym.skills.squint && S.gym.skills.squint.hist.length);
const mixOpen = m => mixUnlocked(m, lvOf);
const TRAIN_KEYS = ["hue", "value", "shade", "memory", "order", "neutral", "match", "vanish", "squint"];
const triedKeys = () => TRAIN_KEYS.filter(k => stationLevel(k).tried);

// Color family by perceptual hue (used to report the odd-one-out score per family, and for weak spots).
function family(h) {
  const [L, C, H] = lch(h);
  if (C < 12) return "Greys";
  if (H >= 345 || H < 40) return L > 70 ? "Pinks" : "Reds";
  if (H < 70) return L < 48 ? "Browns" : "Oranges";
  if (H < 100) return L < 55 ? "Browns" : "Yellows";
  if (H < 195) return "Greens";
  if (H < 290) return "Blues";
  return L > 72 ? "Pinks" : "Purples";
}
// Where a trial sat: family, lightness band, strength band.
const bandsOf = h => { const [L, C] = lch(h); return { f: family(h), l: lBand(L), c: cBand(C) }; };
// Colors the drills draw from: the ones you've met, so practice reinforces the path.
// For color-blind players: a simple adjustment, not a simulation of color blindness. Offsets lean on lightness and
// shrink along the axis that's hard to tell apart, so the drills stay fair; scores are still plain CIEDE2000.
const cvdOn = () => !!(S.profile && ["red-green", "blue-yellow"].includes(S.profile.cvd));
const cvdW = base => { const v = S.profile && S.profile.cvd; return v === "red-green" ? [base[0] + .3, base[1] * .3, base[2]] : v === "blue-yellow" ? [base[0] + .3, base[1], base[2] * .3] : base; };
// A hue (LCh degrees) the player can see: red-green color blindness keeps to yellows and blues, blue-yellow to reds and greens.
function gyHue(rnd = gR) {
  const v = S.profile && S.profile.cvd, r = rnd();
  if (v === "red-green") return (r < .5 ? 75 : 255) + rnd() * 40;
  if (v === "blue-yellow") return (r < .5 ? 10 : 140) + rnd() * 35;
  return r * 360;
}
// LCh color pulled in to the screen gamut by lowering chroma.
function gyFit(L, C, H) {
  const r = ((H % 360) + 360) % 360 * Math.PI / 180;
  while (C > 0 && !inGamut(L, C * Math.cos(r), C * Math.sin(r))) C -= 1;
  return lchHex(L, Math.max(C, 0), H);
}
const metColors = () => { if (GY_FIXED) return ALL; if (typeof CS_PLAY_POOL !== "undefined" && CS_PLAY_POOL && CS_PLAY_POOL.length) return CS_PLAY_POOL; const m = ALL.filter(c => S.cards[c.id]); return m.length >= 6 ? m : ALL; };
const gyBtw = (a, b) => a + gR() * (b - a);
// Aim a trial at a weak band (or anywhere when want is null). Families aren't targeted for color-blind players.
function wantHue(want) {
  if (want && want.dim === "f" && FAM_HUES[want.val] && want.val !== "Greys" && !cvdOn()) { const [a, b] = FAM_HUES[want.val]; return (a + gR() * ((b - a + 360) % 360)) % 360; }
  return gyHue();
}
const wantL = (want, lo, hi) => want && want.dim === "l" ? ({ dark: gyBtw(24, 38), mid: gyBtw(44, 62), light: gyBtw(68, 84) })[want.val] : gyBtw(lo, hi);
const wantC = (want, c) => want && want.dim === "c" ? ({ muted: gyBtw(8, 16), mid: gyBtw(24, 38), vivid: gyBtw(48, 66) })[want.val] : c;
// A base color for the swatch drills: a color you've met, matching the band when asked, shaped by the dials.
function pickBase(want, P = {}) {
  let pool = metColors();
  if (want) { const m = pool.filter(c => bandsOf(c.h)[want.dim] === want.val); pool = m.length ? m : ALL.filter(c => bandsOf(c.h)[want.dim] === want.val); if (!pool.length) pool = metColors(); }
  else if (P.pole && gR() < .4) { const m = pool.filter(c => { const L = lab(c.h)[0]; return L < 35 || L > 80; }); if (m.length) pool = m; }
  let h = gShuf(pool)[0].h;
  if (!want && P.mute && gR() < .35) { const [L, C, H] = lch(h); h = lchHex(L, Math.min(C, P.mute > 1 ? 7 : 16), H); }
  if (want && want.dim === "c" && want.val === "muted") { const [L, C, H] = lch(h); h = lchHex(L, Math.min(C, 14), H); }
  return h;
}

// Move a color by roughly `d` CIEDE2000 in a random direction, staying on screen.
// dir weights let a drill choose lightness-only or chroma-only moves.
function offset(baseLab, d, w = [.6, 1, 1], rnd = gR) {
  for (let tries = 0; tries < 24; tries++) {
    let v = [w[0] * (rnd() * 2 - 1), w[1] * (rnd() * 2 - 1), w[2] * (rnd() * 2 - 1)];
    const n = Math.hypot(...v) || 1; v = v.map(x => x / n);
    let k = d;
    for (let i = 0; i < 6; i++) {
      const cand = baseLab.map((x, j) => x + v[j] * k), got = de2000(baseLab, cand);
      if (!got) break;
      k *= d / got;
    }
    const out = baseLab.map((x, j) => x + v[j] * k);
    if (inGamut(...out)) return out;
  }
  return null;
}
// Nudge a Lab color inside the screen gamut by pulling chroma in.
function tame(Lab) {
  let [L, a, b] = Lab;
  for (let i = 0; i < 30 && !inGamut(L, a, b); i++) { a *= .93; b *= .93; }
  return [clamp(L, 3, 97), a, b];
}

// ---------- session bookkeeping ----------
function makeStair(k) {
  const st = skillState(k), sk = SKILLS[k];
  return {
    d: st.level || sk.start, log: [],
    // act = the difference actually drawn (8-bit hex codes), logged instead of the intended d (js/accuracy.js)
    step(ok, act) { this.log.push(act != null ? act : this.d); this.d = stairNext(this.d, ok, sk.floor); },
    // Estimate = geometric mean of the last few differences you worked at, as drawn.
    estimate() { return geoMean(this.log.slice(-6)) || this.d; },
  };
}
// Adjust stations: the score is the geometric mean of your errors (a perfect 0 counts as 0.3, below anyone's limit).
function makeAdjust(k) {
  return {
    d: null, log: [],
    step(err) { this.log.push(Math.max(err, .3)); },
    estimate() { return geoMean(this.log) || SKILLS[k].start; },
  };
}
function record(k, ses, famHits) {
  const st = skillState(k), est = ses.estimate(), before = lastScore(k);
  st.level = SKILLS[k].kind === "adjust" ? +est.toFixed(2) : ses.d;
  st.hist.push([today(), +est.toFixed(2)]); st.hist = st.hist.slice(-60);
  const pb = st.best == null || est < st.best;
  if (pb) st.best = +est.toFixed(2);
  if (famHits) for (const [f, v] of Object.entries(famHits)) st.fam[f] = +v.toFixed(2);
  save();
  return { k, est, before, pb, best: st.best };
}
// Keep each station's recent trials (for weak spots and tips), confidence counts, and confident misses to call back.
function storeTrials(trials) {
  const g = gyState(), day = gyDay();
  trials.forEach(t => {
    const st = stOf(t.k);
    st.trials.push({ t: day, ok: t.ok, f: t.f, l: t.l, c: t.c, cf: t.cf || undefined, s: t.s || undefined });
    if (st.trials.length > 80) st.trials = st.trials.slice(-80);
    if (t.cf) { const c = g.conf[t.cf]; c[0]++; if (t.ok) c[1]++; }
    // KB #5 (hypercorrection): a miss you were sure about comes back in a later session
    if (t.cf === "s" && !t.ok && t.rp && !t.cb) { st.cb = st.cb || []; st.cb.push({ t: day, rp: t.rp }); st.cb = st.cb.slice(-6); }
  });
}

// ======================================================================
// Train home: the check-in (when due) or one suggested station, your eye at a glance, then three shelves.
// ======================================================================
function suggestStation() {
  const day = gyDay();
  const info = TRAIN_KEYS.filter(k => k !== "squint" || squintOpen()).map(k => {
    const s = stationLevel(k), st = stOf(k), h = (S.gym.skills[k] || {}).hist || [];
    return { k, tried: s.tried, lv: s.lv, due: s.tried ? st.due : null, today: h.length && h[h.length - 1][0] === today() };
  });
  return suggestPick(info, day) || { k: "hue", why: "Not tried yet" };
}

// ---------- previews: every station is shown in color, at your current difference ----------
function gymBase(k) { const pool = metColors(); return pool[hash(today() + k) % pool.length]; }
// two colors exactly d apart, the way the drill tests them (the seam between them is your limit)
function limitPair(k, d) {
  if (k === "value") { const H = lch(gymBase(k).h)[2]; return [lchHex(58 + d / 2, 28, H), lchHex(58 - d / 2, 28, (H + 140) % 360)]; }
  const A = tame(lab(gymBase(k).h)), B = offset(A, d) || A;
  return [labHex(...A), labHex(...B)];
}
function stationArt(k) {
  const rnd = seededRnd(hash(today() + "art" + k)), i = (h, cls = "") => `<i style="--c:${h}"${cls ? ` class="${cls}"` : ""}></i>`;
  if (k === "after") {
    const dot = ["#E3262E", "#14A84B", "#2457E6", "#F2CC00"][hash(today()) % 4];
    return `<span class="sa sa-after"><b style="--c:${dot}"></b><svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="46" pathLength="100"/></svg></span>`;
  }
  if (k === "squint") {
    const pool = (window.SQUINT || []).filter(p => p.pts.length >= 12), p = pool.length ? pool[hash(today() + "sq") % pool.length] : null;
    if (!p) return `<span class="sa sa-sq"></span>`;
    const mid = p.pts.filter(q => q[0] > 200 && q[0] < 800 && q[1] > 200 && q[1] < 800), pts = [mid[Math.floor(mid.length * .1)], mid[Math.floor(mid.length * .5)], mid[Math.floor(mid.length * .9)]].filter(Boolean);
    return `<span class="sa sa-sq"><img src="${esc(p.img.replace(".jpg", "-thumb.jpg"))}" alt="" loading="lazy">${pts.map(q => `<b style="left:${q[0] / 10}%;top:${q[1] / 10}%"></b>`).join("")}</span>`;
  }
  if (k.startsWith("mix:")) {
    const H = gyHue(rnd), a = gyFit(64, 34, H), b = gyFit(56, 34, H + 150), c = gyFit(58, 60, H + 40), dd = gyFit(52, 8, H + 40), g = gyFit(56, 44, H + 200);
    const cols = k === "mix:light"
      ? [`<span class="mx-pair">${i(a)}${i(b)}</span>`, `<span class="mx-pair">${i(c)}${i(dd)}</span>`, `<span class="mx-ground" style="--g:${g}"><b class="disc" style="--c:${gyFit(56, 40, H + 20)}"></b></span>`]
      : [`<span class="mx-ground" style="--g:${gyFit(56, 48, H)}"><b style="--c:${lchHex(58, 0, 0)}"></b></span>`, `<span class="mx-two"><i style="--c:${gyFit(80, 38, H + 70)}"></i><i style="--c:${gyFit(26, 38, H - 70)}"></i></span>`, `<span class="mx-grid">${Array.from({ length: 9 }, (_, j) => i(j === 4 ? gyFit(60, 34, H + 104) : gyFit(60, 34, H + 100))).join("")}</span>`];
    return `<span class="sa sa-mix">${cols.join("")}</span>`;
  }
  const sk = SKILLS[k], d = Math.max(skillState(k).level || sk.start, 5);
  if (k === "hue") { const [a, b] = limitPair("hue", d), odd = hash(today()) % 9; return `<span class="sa sa-grid">${Array.from({ length: 9 }, (_, j) => i(j === odd ? b : a, j === odd ? "odd" : "")).join("")}</span>`; }
  if (k === "value") { const [a, b] = limitPair("value", d * 1.5); return `<span class="sa sa-pair">${i(a)}${i(b)}</span>`; }
  if (k === "shade") { const H = gyHue(rnd); return `<span class="sa sa-pair">${i(gyFit(60, 60, H))}${i(gyFit(54, 9, H))}</span>`; }
  if (k === "order") {
    const A = tame(lab(gymBase("order").h)), B = offset(A, d * 5, [.5, 1, 1], rnd) || A;
    const steps = Array.from({ length: 6 }, (_, j) => labHex(...A.map((x, m) => x + (B[m] - x) * j / 5)));
    [steps[2], steps[3]] = [steps[3], steps[2]];
    return `<span class="sa sa-strip">${steps.map((h, j) => i(h, j === 2 ? "odd l" : j === 3 ? "odd r" : "")).join("")}</span>`;
  }
  if (k === "neutral") { const H = gyHue(rnd); return `<span class="sa sa-ground" style="--g:${gyFit(56, 48, H)}"><b style="--c:${lchHex(58, 0, 0)}"></b></span>`; }
  if (k === "vanish") { const H = gyHue(rnd), L = 58; return `<span class="sa sa-ground" style="--g:${gyFit(L, 42, H)}"><b class="disc" style="--c:${gyFit(L, 40, H + 180)}"></b></span>`; }
  if (k === "match") {
    const H = gyHue(rnd), mid = gyFit(52, 30, H);
    return `<span class="sa sa-two"><span style="--g:${gyFit(80, 38, H + 70)}"><b style="--c:${mid}"></b></span><span style="--g:${gyFit(26, 38, H - 70)}"><b style="--c:${mid}"></b></span></span>`;
  }
  // memory: one color, then its close neighbors
  const A = tame(lab(gymBase("memory").h)), nb = [0, 1, 2, 3].map(() => offset(A, d, [.6, 1, 1], rnd) || A);
  return `<span class="sa sa-mem">${i(labHex(...A), "big")}${[A, ...nb].map(x => i(labHex(...x))).join("")}</span>`;
}
const unlockText = k => k === "squint" ? `Unlocks at level ${SQUINT_NEEDS.lv} in Which is lighter? and Lighter or darker`
  : `Unlocks when two of ${MIXES[k.slice(4)].ks.map(x => SKILLS[x].name.replace("?", "")).join(", ")} reach level ${MIXES[k.slice(4)].need}`;

function stationTile(k) {
  if (k === "after") {
    const af = (S.gym.demos || {}).after;
    return `<button class="gs-tile" data-st="after">${stationArt("after")}<span class="gs-name">${AFTER.name}</span>
      <span class="gs-meta"><span>Demonstration</span></span><span class="ladder blank"></span><span class="gs-best">${af ? `${af.right} of ${af.n} named` : "20 seconds"}</span></button>`;
  }
  const g = gyState();
  if (k.startsWith("mix:")) {
    const m = k.slice(4), open = mixOpen(m), mx = g.mixed[m];
    return `<button class="gs-tile${open ? "" : " locked"}" data-st="${k}" ${open ? "" : `data-locked="${esc(unlockText(k))}"`}>${stationArt(k)}<span class="gs-name">${esc(MIXES[m].name)}</span>
      <span class="gs-meta"><span>${open ? (mx ? `${mx.n} set${mx.n > 1 ? "s" : ""}` : "New") : "Locked"}</span></span><span class="ladder blank"></span>
      <span class="gs-best">${open ? (mx ? `last: ${mx.hits} of ${mx.of}` : "9 rounds, shuffled") : esc(unlockText(k))}</span></button>`;
  }
  if (k === "squint" && !squintOpen()) {
    return `<button class="gs-tile locked" data-st="squint" data-locked="${esc(unlockText(k))}">${stationArt(k)}<span class="gs-name">${SKILLS.squint.name}</span>
      <span class="gs-meta"><span>Locked</span></span><span class="ladder blank"></span><span class="gs-best">${esc(unlockText(k))}</span></button>`;
  }
  const s = stationLevel(k);
  return `<button class="gs-tile" data-st="${k}">
    ${stationArt(k)}
    <span class="gs-name">${esc(SKILLS[k].name)}</span>
    <span class="gs-meta"><span>${s.lv ? `Level ${s.lv}` : "New"}</span>${s.lv && stOf(k).maint ? `<em>maintenance</em>` : ""}</span>
    ${ladder(s.lv)}
  </button>`;
}

// "Your eye": one bar per station you've tried, from the check-in level when there is one. Tap for the progress page.
function eyeProfile() {
  const ks = triedKeys(), g = gyState(), day = gyDay();
  const all = TRAIN_KEYS.flatMap(k => (g.st[k] ? g.st[k].trials : [])).sort((a, b) => a.t - b.t);
  const wl = weakLine(weakBand(all, day)), cl = calibLine(calib(g.conf)), ci = checkinDue(g.checkins, ks.length, day);
  return `<button class="ey-prof" data-eye>
    <span class="sec-head"><b>Your eye</b><span>progress ${ICON.chev}</span></span>
    ${ks.length ? `<span class="ey-rows">${ks.map(k => { const s = stationLevel(k); return `<span class="ey-row"><span>${esc(SKILLS[k].name.replace("?", ""))}</span><i style="--w:${(s.lv / 20 * 100).toFixed(0)}%"></i><b>${s.lv}</b></span>`; }).join("")}</span>`
      : `<span class="ey-empty">Your levels show here once you've tried a station.</span>`}
    ${wl ? `<span class="ey-line">${esc(wl)}.</span>` : ""}
    ${cl ? `<span class="ey-line">${esc(cl)}</span>` : ""}
    <span class="ey-foot">${esc(ci.due ? "Check-in ready" : ci.why)}${g.checkins.length ? " · levels from your last check-in" : ""}</span>
  </button>`;
}

function gymHome() {
  const g = gyState(), day = gyDay(), ci = checkinDue(g.checkins, triedKeys().length, day);
  let top;
  if (ci.due) {
    const ks = checkinPick(triedKeys(), g.checkins), rounds = ks.reduce((s, k) => s + (SKILLS[k].kind === "adjust" ? CI_ADJUST : ciLadder(k).length), 0);
    top = `<button class="sg-card ci-card" data-checkin>
      <span class="sg-top"><span class="eyebrow">Weekly check-in</span><span class="eyebrow">${esc(ci.why)}</span></span>
      <span class="ci-strip">${ks.map(k => stationArt(k)).join("")}</span>
      <span class="sg-name">Check-in</span>
      <span class="sg-what">${ks.map(k => esc(SKILLS[k].name)).join(" · ")}. A short fixed test with no feedback: the honest number behind your levels.</span>
      <span class="sg-go"><b>Start</b><span>${rounds} rounds · about 3 minutes</span>${ICON.arrow}</span>
    </button>${scrChip()}`;
  } else {
    const sg = suggestStation(), sk0 = SKILLS[sg.k], s0 = stationLevel(sg.k);
    top = `<button class="sg-card" data-st="${sg.k}">
      <span class="sg-top"><span class="eyebrow">Suggested</span><span class="eyebrow">${esc(sg.why)}</span></span>
      ${stationArt(sg.k)}
      <span class="sg-name">${esc(sk0.name)}</span>
      <span class="sg-what">${esc(sk0.what)}.</span>
      <span class="sg-lv">${ladder(s0.lv)}<span>${s0.lv ? `Level ${s0.lv} of 20${s0.ci != null && s0.sess && s0.sess !== s0.ci ? ` · today ${s0.sess}` : ""}` : "Level 1 of 20 to start"}</span></span>
      <span class="sg-go"><b>Start</b><span>${k0Trials(sg.k)} · about a minute</span>${ICON.arrow}</span>
    </button>`;
  }
  const el = show(`
    ${tabHead()}
    <h1 class="tab-title">Train</h1>
    ${top}
    ${eyeProfile()}
    ${cvdOn() ? `<p class="x-sub" style="margin-top:12px">A simple adjustment for ${S.profile.cvd} color blindness, not a simulation of it: differences lean on lightness and on the colors you see best.</p>` : ""}
    ${SHELVES.map(([name, ks]) => `<div class="sec-head"><b>${name}</b><span>${name === "Applied" ? "built on the basics" : name === "In context" ? "color next to color" : "one judgment at a time"}</span></div>
      <div class="gs-grid">${ks.map(stationTile).join("")}</div>`).join("")}
    ${typeof matchShelves === "function" ? matchShelves() : ""}
    <div class="sec-head"><b>Game</b><span>for fun</span></div>
    <button class="play-row" data-lightning><span><b>Lightning round</b><span>Forty-five seconds. Name as many colors as you can.</span></span><em class="lt-best">${S.best.lightning ? `<b>${S.best.lightning}</b>best` : "new"}</em></button>
    <p class="fine">Scores are shown as a percent of the full black-to-white range: 100% is the difference between black and white, and about 1% is the smallest difference most people can see side by side. Every swatch is at least a quarter of the screen wide, because small patches look less colorful. Practice sharpens these judgments; it isn't a brain-training claim.</p>
  `, "gym", "gym");
  el.querySelectorAll("[data-st]").forEach(b => b.onclick = () => b.dataset.locked ? toast(b.dataset.locked) : runDrill(b.dataset.st));
  const ck = el.querySelector("[data-checkin]"); if (ck) ck.onclick = runCheckin;
  const sc = el.querySelector("[data-scr]"); if (sc) sc.onclick = () => screenCheck(() => go("gym"));
  el.querySelector("[data-lightning]").onclick = lightning;
  el.querySelector("[data-eye]").onclick = eyeReport;
  if (typeof wireMatch === "function") wireMatch(el);
}
const k0Trials = k => k === "order" ? `${SKILLS[k].trials} strips` : k === "squint" ? `${SKILLS[k].trials} paintings` : `${SKILLS[k].trials} rounds`;
const dueWords = n => n <= 0 ? "today" : n === 1 ? "tomorrow" : `in ${n} days`;

// ---------- results: the score in plain words, every miss side by side, replay, and your trend ----------
// A reference value, not a claim about this player: under good light and a well-calibrated screen, about 1
// (ΔE00, or ΔL* for lightness) is the smallest difference most people can see side by side. Phone screens vary,
// so it's shown as a reference, never as a world comparison (that needs the opt-in scores service: NOTES-TRACKER #13).
const JND_REF = 1;
function plainMeaning(k, est) {
  const sk = SKILLS[k], noun = sk.unit === "ΔL*" ? "lightness" : sk.unit === "ΔE step" ? "steps" : "colors";
  const cmp = est <= JND_REF * 1.6 ? "close to the limit of human vision under good conditions"
    : est <= JND_REF * 4 ? "a small, trained difference" : "a difference most people would also notice";
  return `You can tell ${noun} apart about ${pctFmt(est)} different, ${cmp}.`;
}
// The hex you picked and the hex that was right, for the station kinds that log both (hue, value, shade, memory).
// Adjust stations (neutral, vanish, match) and order don't log a clean pair, so they're left out of the strip.
function missPick(k, t) {
  const rp = t.rp;
  if (!rp) return null;
  if (rp.a != null && rp.b != null) return k === "value" || k === "shade" ? { picked: rp.b, correct: rp.a } : { picked: rp.a, correct: rp.b };
  if (rp.h != null && rp.pk != null) return { picked: rp.pk, correct: rp.h };
  return null;
}
// One short "why it was hard" line, only when the trial's own bands say so.
function missWhy(t) {
  const bits = [];
  if (t.l === "dark") bits.push("both dark"); else if (t.l === "light") bits.push("both light");
  if (t.c === "muted") bits.push("low chroma"); else if (t.c === "vivid") bits.push("both vivid");
  return bits.length ? bits.join(", ") : null;
}
function missCard(k, t) {
  const sk = SKILLS[k], pr = missPick(k, t);
  if (!pr) return "";
  const dist = sk.unit === "ΔL*" ? Math.abs(lab(pr.picked)[0] - lab(pr.correct)[0]) : de2000(pr.picked, pr.correct), why = missWhy(t);
  return `<div class="gy-miss">
    <div class="gy-miss-pair">
      <span class="gy-miss-sw bad" style="--c:${pr.picked}"><b>Picked</b></span>
      <span class="gy-miss-sw good" style="--c:${pr.correct}"><b>${k === "memory" ? "It was" : "Odd one"}</b></span>
    </div>
    <div class="gy-miss-meta"><b class="mono">${pctFmt(dist)}</b> <small>${unitWord(sk.unit)}</small>${why ? `<span>${esc(why)}</span>` : ""}</div>
  </div>`;
}
// A short set built from exactly the missed pairs, at the same difference each was drawn at.
function runReplay(k, misses) {
  const items = misses.filter(t => t.rp).map(t => ({ k, P: dialPlan(k, planLevel(k)), rp: t.rp, d: t.rp.d }));
  if (!items.length) return runDrill(k);
  runSession({ kind: "replay", items, onEnd: res => replayDone(k, res) });
}
function replayDone(k, res) {
  storeTrials(res.trials); save();
  const hits = res.trials.filter(t => t.ok).length, total = res.trials.length;
  const el = show(`
    <div style="flex:1"></div>
    <p class="eyebrow">${esc(SKILLS[k].name)} · replay</p>
    <h1>${hits} of <em>${total}.</em></h1>
    <p class="lede">${hits === total ? "Every miss from that set, solved." : "Same pairs, another look. The ones you still miss are worth another pass."}</p>
    <div class="stack"><button class="btn" data-again>Another set ${ICON.arrow}</button><button class="btn ghost" data-home>Back to Train</button></div>
  `, "result gym-res");
  el.querySelector("[data-again]").onclick = () => runDrill(k);
  el.querySelector("[data-home]").onclick = () => go("gym");
  if (hits === total) buzz([12, 60, 12]);
}

// Results for one set: the score, what it means, every miss side by side, your trend, level and what unlocked,
// the weak zone, and one tip with a 3-round fix.
function stationDone(r) {
  const sk = SKILLS[r.k], lvA = levelOf(r.k, r.est), lvB = r.before != null ? levelOf(r.k, r.before) : null;
  const head = r.pb && r.before != null ? "New personal <em>best.</em>" : lvB != null && lvA > lvB ? "Level <em>up.</em>" : r.before == null ? "First <em>set.</em>" : "Eyes <em>trained.</em>";
  const tip = r.tip, pct = r.total ? Math.round(r.hits / r.total * 100) : null;
  const cards = (r.misses || []).map(t => missCard(r.k, t)).filter(Boolean);
  const hist = skillState(r.k).hist;
  const el = show(`
    <div style="flex:1"></div>
    <p class="eyebrow">${esc(sk.name)} · set done</p>
    <h1>${head}</h1>
    ${pct != null ? `<div class="gy-score"><b>${r.hits} of ${r.total}</b><span>right · ${pct}%</span></div>` : ""}
    <p class="gy-weak">${esc(plainMeaning(r.k, r.est))}</p>
    <p class="fine">Reference value for human color discrimination under good viewing conditions; phone screens vary, and this isn't a comparison with other players.</p>
    <div class="gr-lv"><span class="mono">Level</span>${lvB != null ? `<s>${lvB}</s><i>→</i>` : ""}<b data-count="${lvA}">${lvA}</b><span class="mono">of 20</span></div>
    ${ladder(lvA, "big")}
    ${(r.news || []).map(([l, n]) => `<p class="gy-news"><b>New at level ${l}</b> ${esc(n)}</p>`).join("")}
    <div class="res-list">
      <div class="res"><span>This set</span><b class="mono">${r.before != null ? pctFmt(r.before) + " → " : ""}${pctFmt(r.est)} <small>${unitWord(sk.unit)}</small></b>${r.pb ? "<em>best</em>" : ""}</div>
      ${r.due != null ? `<div class="res"><span>Next session</span><b class="mono">${dueWords(r.due)}</b><span></span></div>` : ""}
    </div>
    ${r.weak ? `<p class="gy-weak">${esc(r.weak)}.</p>` : ""}
    ${tip ? `<div class="gy-tip"><p class="eyebrow">One thing to try</p><p>${esc(tip.tip)}</p><p class="gy-fixwhat">The fix: ${esc(tip.fixWhat)}</p></div>` : `<p class="lede">${esc(sk.why)}</p>`}
    ${cards.length ? `<div class="sec-head"><b>Every miss</b><span>${cards.length} of ${r.total}</span></div><div class="gy-miss-strip">${cards.join("")}</div>` : ""}
    ${hist.length >= 2 ? `<div class="sec-head"><b>Your trend</b><span>this station, past sessions</span></div>${eyeChart(hist, sk.unit, true)}` : ""}
    <p class="fine gr-fine">Smaller numbers mean smaller differences, measured on the colors as your screen drew them. Session scores move from day to day; your weekly check-in is the real trend.${!tip && sk.src ? ` Source: ${esc(sk.src)}.` : ""}</p>
    <div class="stack">${tip ? `<button class="btn" data-fix>Fix it: 3 rounds ${ICON.arrow}</button><button class="btn ghost" data-again>Another set</button>` : `<button class="btn" data-again>Another set ${ICON.arrow}</button>`}${cards.length ? `<button class="btn ghost" data-replay>Replay my misses (${cards.length})</button>` : ""}<button class="btn ghost" data-home>Back to Train</button></div>
  `, "result gym-res");
  el.querySelector("[data-again]").onclick = () => runDrill(r.k);
  el.querySelector("[data-home]").onclick = () => go("gym");
  const fx = el.querySelector("[data-fix]"); if (fx) fx.onclick = () => runDrill(r.k, { fix: tip });
  const rp = el.querySelector("[data-replay]"); if (rp) rp.onclick = () => runReplay(r.k, r.misses);
  onKey = e => { if (e.key === "Enter") go("gym"); };
  if (r.pb || (lvB != null && lvA > lvB)) buzz([12, 60, 12]);
}

// ======================================================================
// The session runner: one engine for station sets, intros, fixes, mixed sets and check-ins.
// items: [{ k, P (dial plan), d? (fixed difference), rp? (a callback to replay), fix?, want?, news?, lv?, seed? }]
// Staircase drills call ctx.pick(ok, reveal, meta); adjust drills call ctx.settle(err, meta, note).
// ======================================================================
function runSession(o) {
  const items = o.items, total = items.length, trials = [], ses = {}, kind = o.kind;
  const sesOf = k => ses[k] || (ses[k] = SKILLS[k].kind === "adjust" ? makeAdjust(k) : makeStair(k));
  let n = 0, cur = null, it = null, lastCls = "";
  const el = show(`
    <header class="deck-top">
      <button class="icon-btn" data-close aria-label="Close">${ICON.x}</button>
      ${kind === "intro" ? `<span style="flex:1"></span><button class="gy-skip" data-skip>Skip intro</button>`
        : `<div class="segs">${items.map(() => `<i style="--c:var(--ink)"></i>`).join("")}</div><span class="left mono" id="lvl"></span>`}
    </header>
    <div class="drill-head"><p class="eyebrow" id="ey"></p><h2 id="q"></h2><p class="dr-why" id="why"></p><div class="gy-clock" id="clk"><i></i></div></div>
    <div class="drill-stage" id="dstage"></div>
    <div class="drill-foot" id="dfoot"></div>
  `, `fixed drill station gy-${kind}`);
  const quit = () => { GY_R = Math.random; GY_FIXED = false; go("gym"); };
  el.querySelector("[data-close]").onclick = quit;
  onKey = e => { if (e.key === "Escape") quit(); };
  const skip = el.querySelector("[data-skip]");
  if (skip) skip.onclick = () => { gyState().seen[items[0].k] = 1; save(); runDrill(items[0].k, { noIntro: true }); };
  const stage = el.querySelector("#dstage"), foot = el.querySelector("#dfoot"), q = el.querySelector("#q"), lvl = el.querySelector("#lvl");
  const ey = el.querySelector("#ey"), why = el.querySelector("#why"), clk = el.querySelector("#clk");
  const segs = el.querySelectorAll(".segs i");
  const mark = ok => {
    if (segs[n]) { segs[n].classList.add("on"); segs[n].style.setProperty("--c", kind === "checkin" ? "var(--soft)" : ok ? "var(--good)" : "var(--bad)"); }
    buzz(kind === "checkin" ? 8 : ok ? 10 : [10, 40, 10]); n++;
  };
  const stopClock = () => clk.classList.remove("on");
  const clock = (ms, onOut) => {
    const id = cur.id;
    clk.style.setProperty("--t", ms + "ms"); clk.classList.remove("on"); void clk.offsetWidth; clk.classList.add("on");
    later(() => { if (cur.id === id && !cur.done) onOut(); }, ms);
  };
  const log = (ok, meta = {}) => trials.push({ k: it.k, ok: ok ? 1 : 0, f: meta.f, l: meta.l, c: meta.c, s: meta.s, cf: meta.cf, rp: meta.rp ? { ...meta.rp, d: it.d != null ? it.d : sesOf(it.k).d } : null, cb: !!it.rp, d: meta.act != null ? meta.act : sesOf(it.k).d, a: meta.act });
  // after the one intro round: the why, the aim line, then practice
  const introPanel = (extra = null) => {
    const prev = extra != null ? extra : (foot.querySelector(".note") || {}).innerHTML;
    why.textContent = SKILLS[it.k].why; why.classList.add("show");
    foot.innerHTML = `<div class="gy-ipanel">${prev ? `<p class="note">${prev}</p>` : ""}<p class="note gy-aim">${esc(AIM_LINE)}</p>${SKILLS[it.k].src ? `<p class="fine gy-src">Source: ${esc(SKILLS[it.k].src)}.</p>` : ""}<button class="btn" data-start>Start practice ${ICON.arrow}</button></div>`;
    foot.querySelector("[data-start]").onclick = () => { gyState().seen[it.k] = 1; save(); runDrill(it.k, { noIntro: true }); };
  };
  function pick(ok, reveal, meta = {}) {
    if (cur.done) return; cur.done = true; stopClock();
    if (meta.act == null && cur.act != null) meta = { ...meta, act: cur.act };
    const go2 = cf => {
      if (kind !== "checkin") reveal();
      log(ok, { ...meta, cf });
      if (SKILLS[it.k].kind !== "adjust" && it.d == null && !it.rp) sesOf(it.k).step(ok, meta.act);
      mark(ok);
      if (kind === "intro") return later(() => introPanel(), ok ? 500 : 900);
      // drills with a lot to read in the reveal (Squint's L* values) wait for a Next tap
      if ((meta.hold || !ok) && kind !== "checkin") {
        foot.innerHTML = `<div class="gy-rev">${foot.innerHTML}<button class="btn" data-next>${n >= total ? "See results" : "Next"} ${ICON.arrow}</button></div>`;
        foot.querySelector("[data-next]").onclick = trial;
        return;
      }
      later(trial, kind === "checkin" ? 280 : 1400);
    };
    if (cur.conf && !meta.noConf) {
      // KB #5/#16: on about 1 round in 4, say how sure you are before you see the answer
      foot.innerHTML = `<div class="gy-conf"><span>How sure?</span><button data-cf="s">Sure</button><button data-cf="g">Guessing</button></div>`;
      foot.querySelectorAll("[data-cf]").forEach(b => b.onclick = () => { foot.innerHTML = ""; go2(b.dataset.cf); });
    } else go2(null);
  }
  function settle(err, meta = {}, note = "") {
    if (cur.done) return; cur.done = true; stopClock();
    const sk = SKILLS[it.k], ok = err <= sk.ok;
    if (kind !== "intro") sesOf(it.k).step(err);
    log(ok, meta); mark(ok);
    if (kind === "checkin") return later(trial, 200);
    if (kind === "intro") return introPanel(note);
    foot.innerHTML = `<div class="gy-rev"><p class="note">${note}</p><button class="btn" data-next>${n >= total ? "See results" : "Next"} ${ICON.arrow}</button></div>`;
    foot.querySelector("[data-next]").onclick = trial;
  }
  function trial() {
    if (n >= total) { GY_R = Math.random; GY_FIXED = false; return o.onEnd({ ses, trials }); }
    it = items[n];
    const k = it.k, sk = SKILLS[k], adj = sk.kind === "adjust", s = sesOf(k);
    if (lastCls) el.classList.remove(lastCls); lastCls = "drill-" + k; el.classList.add(lastCls);
    GY_R = it.seed != null ? seededRnd(it.seed) : Math.random;
    const d = it.rp && it.rp.d ? it.rp.d : it.d != null ? it.d : s.d;
    ey.textContent = kind === "checkin" ? `Check-in · ${sk.name}` : kind === "intro" ? `${sk.name} · first look` : kind === "replay" ? `${sk.name} · replay a miss`
      : it.rp ? `${sk.name} · one you were sure about` : it.news ? `${sk.name} · Level ${it.lv} · ${it.news}` : kind === "fix" ? `${sk.name} · fix it` : sk.name;
    why.classList.remove("show");
    why.textContent = kind === "intro" ? "First look: just guess, quickly. The why comes after." : kind === "checkin" ? "No feedback during the check-in. Answer and move on." : sk.why;
    if (lvl) lvl.textContent = adj || kind === "checkin" ? `${n + 1}/${total}` : pctFmt(d);
    foot.innerHTML = ""; stopClock();
    const want = it.want !== undefined ? it.want : o.want && o.want[k] && Math.random() < .4 ? o.want[k] : null;
    cur = { id: n, done: false, conf: !adj && (kind === "station" || kind === "mixed") && !it.rp && (n > 0 || o.confAll) && Math.random() < (o.confAll ? 1 : .25) };
    const P = k === "memory" ? memParams(MEM.lv) : it.P || dialPlan(k, 1);
    const shown = act => { if (!(act > 0)) return; cur.act = act; if (lvl && !adj && kind !== "checkin") lvl.textContent = pctFmt(act); };
    DRILLS[k]({ stage, foot, q, el, k, d, P, want, fix: it.fix || {}, rp: it.rp || null, check: kind === "checkin", intro: kind === "intro", pick, settle, clock, shown });
  }
  trial();
}

// A station set (or its first-look intro, or a 3-round fix).
function runDrill(k, opts = {}) {
  if (!S.scr && !scrShot()) return screenCheck(() => runDrill(k, opts));
  if (k === "after") return afterimage();
  if (k && k.startsWith("mix:")) return runMixed(k.slice(4));
  const sk = SKILLS[k];
  if (!sk) return gymHome();
  const g = gyState(), st = stOf(k), day = gyDay();
  if (k === "memory") MEM = { lv: Math.max(1, S.gym.memLv || levelOf("memory", lastScore("memory")) || 1), run: 0 };
  // KB X1: the first time, one example to guess at (seconds), then the why, then practice
  if (!g.seen[k] && !opts.noIntro && !opts.fix && !stationLevel(k).tried) {
    if (k === "memory") MEM.lv = 1;
    return runSession({ kind: "intro", items: [{ k, P: dialPlan(k, 1), d: sk.kind === "adjust" ? null : sk.start * .9 }], onEnd: () => runDrill(k, { noIntro: true }) });
  }
  const plv0 = k === "memory" ? MEM.lv : planLevel(k), P = dialPlan(k, plv0);
  let items;
  if (opts.fix) {
    const f = opts.fix.fix || {};
    items = [0, 1, 2].map(i => ({ k, P: f.ground ? { ...P, ground: f.ground } : P, d: sk.kind === "adjust" ? null : (skillState(k).level || sk.start), fix: { ...f, i }, want: f.want || (f.mute ? { dim: "c", val: "muted" } : null) }));
  } else {
    items = Array.from({ length: opts.trials || sk.trials }, () => ({ k, P }));
    // confident misses from earlier days come back (at most two a set)
    const cbs = (st.cb || []).filter(c => c.t < day).slice(0, 2);
    if (cbs.length && !opts.trials) { st.cb = st.cb.filter(c => !cbs.includes(c)); cbs.forEach((c, i) => items.splice(Math.min(items.length, 2 + i * 4), 0, { k, P, rp: c.rp })); }
    // announce a dial the first time its level is reached
    const news = k === "memory" ? null : dialNews(k, plv0);
    if (news && (st.told || 0) < plv0) { items[0].news = news; items[0].lv = plv0; st.told = plv0; }
  }
  const w = opts.fix ? null : weakBand(st.trials, day);
  runSession({
    kind: opts.fix ? "fix" : "station", items, confAll: opts.confAll, want: w ? { [k]: { dim: w.dim, val: w.val } } : null,
    onEnd: res => opts.done ? opts.done(res) : opts.fix ? fixDone(k, opts.fix, res) : finishStation(k, res, plv0),
  });
}
function finishStation(k, res, plv0) {
  const s = res.ses[k];
  if (!s || !s.log.length) return gymHome();
  const famHits = {};
  if (k === "hue") res.trials.forEach(t => { if (t.f && !t.cb) famHits[t.f] = t.d; });
  const r = record(k, s, k === "hue" ? famHits : null), st = stOf(k), day = gyDay(), lvNow = levelOf(k, r.est);
  Object.assign(st, nextDue(st, lvNow, day));
  if (k === "memory") { S.gym.memLv = MEM.lv; st.plv = MEM.lv; }
  else st.plv = Math.max(st.plv || 0, lvNow);
  storeTrials(res.trials);
  r.news = k === "memory" ? [] : dialNewsBetween(k, plv0, st.plv);
  if (r.news.length) st.told = st.plv;
  r.tip = detectPattern(k, st.trials);
  r.weak = weakLine(weakBand(st.trials, day));
  r.due = st.due - day;
  r.hits = res.trials.filter(t => t.ok).length;
  r.total = res.trials.length;
  r.misses = res.trials.filter(t => !t.ok && missPick(k, t));
  save();
  stationDone(r);
}
function fixDone(k, tip, res) {
  storeTrials(res.trials); save();
  const hits = res.trials.filter(t => t.ok).length;
  const el = show(`
    <div style="flex:1"></div>
    <p class="eyebrow">${esc(SKILLS[k].name)} · fix it</p>
    <h1>${hits} of <em>3.</em></h1>
    <div class="gy-tip"><p class="eyebrow">What you practiced</p><p>${esc(tip.tip)}</p></div>
    <p class="lede">${hits === 3 ? "All three. Carry the same habit into your next set." : "Keep the habit for the next set: one change at a time is how it sticks."}</p>
    <div class="stack"><button class="btn" data-again>Another set ${ICON.arrow}</button><button class="btn ghost" data-home>Back to Train</button></div>
  `, "result gym-res");
  el.querySelector("[data-again]").onclick = () => runDrill(k);
  el.querySelector("[data-home]").onclick = () => go("gym");
}

// ---------- mixed sets (KB #8): three known stations, shuffled round by round ----------
function runMixed(m) {
  const mx = MIXES[m];
  if (!mx || !mixOpen(m)) return gymHome();
  const ks = mx.ks, per = 3;
  let items = [];
  for (let i = 0; i < per; i++) items.push(...shuffle(ks).map(k => ({ k, P: dialPlan(k, planLevel(k)) })));
  // no station twice in a row
  for (let i = 1; i < items.length; i++) if (items[i].k === items[i - 1].k) { const j = items.findIndex((x, jj) => jj > i && x.k !== items[i].k && (jj + 1 >= items.length || items[jj + 1].k !== items[i - 1].k)); if (j > 0) [items[i], items[j]] = [items[j], items[i]]; }
  if (ks.includes("memory")) MEM = { lv: Math.max(1, S.gym.memLv || 1), run: 0 };
  runSession({ kind: "mixed", items, onEnd: res => {
    storeTrials(res.trials);
    for (const [k, s] of Object.entries(res.ses)) if (SKILLS[k].kind !== "adjust" && s.log.length) skillState(k).level = s.d;
    const hits = res.trials.filter(t => t.ok).length, g = gyState();
    g.mixed[m] = { n: ((g.mixed[m] || {}).n || 0) + 1, last: today(), hits, of: res.trials.length };
    save();
    const el = show(`
      <div style="flex:1"></div>
      <p class="eyebrow">${esc(mx.name)} · set done</p>
      <h1>${hits} of <em>${res.trials.length}.</em></h1>
      <div class="res-list">${ks.map(k => { const t = res.trials.filter(x => x.k === k); return `<div class="res"><span>${esc(SKILLS[k].name)}</span><b class="mono">${t.filter(x => x.ok).length} of ${t.length}</b><span></span></div>`; }).join("")}</div>
      <p class="lede">Shuffled rounds make you notice which judgment each one needs, before you make it. That is harder than a block of one kind, and it's the point.</p>
      <div class="stack"><button class="btn" data-again>Another mixed set ${ICON.arrow}</button><button class="btn ghost" data-home>Back to Train</button></div>
    `, "result gym-res");
    el.querySelector("[data-again]").onclick = () => runMixed(m);
    el.querySelector("[data-home]").onclick = () => go("gym");
  } });
}

// ---------- weekly check-in (KB #3): the honest progress number ----------
function runCheckin() {
  const g = gyState(), day = gyDay(), week = weekOf(day), ks = checkinPick(triedKeys(), g.checkins);
  if (ks.length < 3) return gymHome();
  if (!g.checkins.length && !(S.scr && S.scr.ci) && !scrShot()) return screenCheck(runCheckin, true);
  const items = [];
  ks.forEach(k => {
    const sk = SKILLS[k], P = dialPlan(k, CI_PLAN);
    if (sk.kind === "adjust") for (let i = 0; i < CI_ADJUST; i++) items.push({ k, P, d: null, seed: hash(`ci${week}${k}${i}`) });
    else ciLadder(k).forEach((lv, i) => items.push({ k, P, lv, d: scoreAt(sk, lv), seed: hash(`ci${week}${k}${i}`) }));
  });
  GY_FIXED = true;
  runSession({ kind: "checkin", items, onEnd: res => {
    const out = {};
    ks.forEach(k => {
      const t = res.trials.filter(x => x.k === k);
      if (SKILLS[k].kind === "adjust") { const est = res.ses[k].estimate(); out[k] = { lv: levelOf(k, est), est: +est.toFixed(2) }; }
      else { const lad = ciLadder(k), hits = t.filter(x => x.ok).length; out[k] = { lv: ciLevel(k, t.map((x, i) => ({ lv: x.a > 0 ? lvExact(SKILLS[k], x.a) : lad[i], ok: x.ok }))), hits, n: t.length }; }
    });
    const prev = Object.fromEntries(ks.map(k => [k, lastCheckin(k)]));
    g.checkins.push({ t: day, date: today(), res: out });
    g.checkins = g.checkins.slice(-60);
    ks.forEach(k => { stOf(k).maint = inMaintenance(k, g.checkins); });
    save();
    checkinDone(out, prev);
  } });
}
function checkinDone(out, prev) {
  const ks = Object.keys(out);
  const el = show(`
    <div style="flex:1"></div>
    <p class="eyebrow">Weekly check-in · done</p>
    <h1>Your honest <em>levels.</em></h1>
    <div class="res-list">${ks.map(k => { const p = prev[k] ? prev[k].res[k].lv : null, lv = out[k].lv; return `<div class="res"><span>${esc(SKILLS[k].name)}</span><b class="mono">${p != null ? `${p} → ` : ""}${lv}</b>${p != null && lv >= p + 3 ? "<em>up</em>" : "<span></span>"}</div>`; }).join("")}</div>
    <p class="lede">Session scores move around day to day; check-ins are the real trend. Same kind of test every week, no feedback, so the number means the same thing each time. The next one opens in 7 days.</p>
    <div class="stack"><button class="btn" data-home>Back to Train ${ICON.arrow}</button><button class="btn ghost" data-eye>See your eye over time</button></div>
  `, "result gym-res");
  el.querySelector("[data-home]").onclick = () => go("gym");
  el.querySelector("[data-eye]").onclick = eyeReport;
  buzz([12, 60, 12]);
}

// A range slider (0..1) with a caption.
const gySlider = (id, v, label) => `<label class="gy-sl"><span>${esc(label)}</span><input type="range" id="${id}" min="0" max="1000" step="1" value="${Math.round(v * 1000)}"></label>`;
// Lock button for adjust stations; onLock returns { err, note, meta } and the runner shows the reveal.
function gyLock(ctx, label, onLock) {
  ctx.foot.innerHTML = `<button class="btn" data-lock>${esc(label)} ${ICON.arrow}</button>`;
  const lock = () => {
    ctx.stage.querySelectorAll("input").forEach(i => i.disabled = true);
    const { err, note, meta } = onLock();
    ctx.settle(err, meta, note);
  };
  ctx.foot.querySelector("[data-lock]").onclick = lock;
  if (ctx.P.time && !ctx.intro) ctx.clock(ctx.P.time, lock);
}
// a start position at least `gap` away from the answer
const gyStart = (s0, gap = .2) => { const dir = gR() < .5 ? -1 : 1, s = s0 + dir * (gap + gR() * .2); return s < 0 || s > 1 ? s0 - dir * (gap + gR() * .2) : s; };

// Color memory levels: every two right in a row moves you up a level, two misses in a row move you down.
// A session starts at the level your last set reached. Its dials come from GY_DIALS.memory (choices, a distractor,
// two colors to hold); the look gets shorter and the wait longer at every level.
let MEM = { lv: 1, run: 0 };
function memParams(lv) {
  const P = dialPlan("memory", lv);
  return {
    look: Math.round(2200 - Math.min(lv - 1, 15) * 90),              // 2.2 s down to 0.85 s
    gap: Math.round(1500 + Math.min(lv - 1, 15) * 170),              // 1.5 s up to 4 s
    opts: P.opts, flash: !!P.flash, hold: P.hold,
    news: dialNews("memory", lv) || "a shorter look, a longer wait",
  };
}
function memStep(ok) {
  if (ok) { MEM.run = MEM.run > 0 ? MEM.run + 1 : 1; if (MEM.run >= 2 && MEM.lv < 20) { MEM.lv++; MEM.run = 0; return true; } }
  else { MEM.run = MEM.run < 0 ? MEM.run - 1 : -1; if (MEM.run <= -2 && MEM.lv > 1) { MEM.lv--; MEM.run = 0; } }
  return false;
}

// Tiles in a grid; tap the one that answers. A timeout counts as a miss.
function tilePick(ctx, ring, right, meta, note) {
  const out = () => ctx.pick(false, () => { ring(); ctx.foot.innerHTML = `<p class="note">Time's up. ${note || ""}</p>`; }, { ...meta, s: { ...(meta.s || {}), out: 1 }, noConf: 1 });
  if (ctx.P.time && !ctx.check && !ctx.intro) ctx.clock(ctx.P.time, out);
  ctx.stage.querySelectorAll(".tile").forEach(t => t.onclick = () => {
    t.classList.add("picked");
    const ok = +t.dataset.i === right;
    ctx.pick(ok, () => { t.classList.remove("picked"); ring(); if (!ok) { t.classList.add("miss"); if (note) ctx.foot.innerHTML = `<p class="note">${note}</p>`; } }, meta);
  });
}

const DRILLS = {
  // Odd one out: a 3 x 3 grid of one color with one tile shifted by d (three columns keeps tiles at a quarter
  // of the screen; the grid stays 3 x 3 and the dials add pale/deep colors, greyish colors and a time limit).
  hue(ctx) {
    const { d, P } = ctx;
    let baseHex, oddHex;
    if (ctx.rp) { baseHex = ctx.rp.a; oddHex = ctx.rp.b; }
    else {
      // the pair as drawn: a few directions are tried and the drawn difference closest to d wins
      let L0 = null, got = null;
      for (let t = 0; t < 4 && !got; t++) { L0 = tame(lab(pickBase(ctx.want, P))); got = shownOffset(L0, d, cvdW([.6, 1, 1]), gR); }
      baseHex = got ? got.a : labHex(...L0); oddHex = got ? got.b : baseHex;
    }
    ctx.shown(shownDE(baseHex, oddHex));
    const n = 3, cells = n * n, at = gR() * cells | 0;
    ctx.q.textContent = "Which tile is different?";
    ctx.stage.innerHTML = `<div class="grid" style="--n:${n}">${Array.from({ length: cells }, (_, i) =>
      `<button class="tile" data-i="${i}" style="--c:${i === at ? oddHex : baseHex}" aria-label="Tile ${i + 1}"></button>`).join("")}</div>`;
    tilePick(ctx, () => ctx.stage.querySelector(`[data-i="${at}"]`).classList.add("ring"), at,
      { ...bandsOf(baseHex), rp: { a: baseHex, b: oddHex } }, `The ringed one was off by <b>${pctFmt(de2000(baseHex, oddHex))}</b>`);
  },

  // Which is lighter? Two hues, different lightness (L*). Dials: the hues move apart, then their strength differs.
  value(ctx) {
    const { d, P } = ctx, f = ctx.fix;
    let light, dark;
    if (ctx.rp) [light, dark] = [ctx.rp.a, ctx.rp.b];
    else {
      const H1 = wantHue(ctx.want), gap = P.hues ? gyBtw(100, 180) : gyBtw(25, 55), H2 = (H1 + (gR() < .5 ? gap : -gap) + 360) % 360;
      const Lm = wantL(ctx.want, 38, 66);
      const cc = P.chroma === 2 || f.viv ? [62, 10] : P.chroma === 1 ? [52, 26] : [38, 38];
      const vividLight = f.viv ? false : gR() < .5, C0 = wantC(ctx.want, cc[0]), C1 = wantC(ctx.want, cc[1]);
      ({ light, dark } = shownLPair((dd, sh) => [gyFit(Lm + sh + dd / 2, vividLight ? C0 : C1, H1), gyFit(Lm + sh - dd / 2, vividLight ? C1 : C0, H2)], d));
    }
    ctx.shown(shownDL(light, dark));
    ctx.q.textContent = "Which is lighter?";
    pairPick(ctx, light, dark);
  },

  // Lighter or darker, same hue: one strong color and one greyish one of the same hue, d apart in L*.
  shade(ctx) {
    const { d, P } = ctx, f = ctx.fix;
    let light, dark;
    if (ctx.rp) [light, dark] = [ctx.rp.a, ctx.rp.b];
    else {
      const H = wantHue(ctx.want), Lm = wantL(ctx.want, P.deep ? 28 : 44, 68), vividLight = f.viv ? false : gR() < .5;
      const [cv, cd] = P.gap === 2 || f.viv ? [72, 5] : P.gap === 1 ? [58, 10] : [42, 20];
      const vivid = L => gyFit(L, cv, H), dull = L => gyFit(L, cd, H);
      ({ light, dark } = shownLPair((dd, sh) => vividLight ? [vivid(Lm + sh + dd / 2), dull(Lm + sh - dd / 2)] : [dull(Lm + sh + dd / 2), vivid(Lm + sh - dd / 2)], d));
    }
    ctx.shown(shownDL(light, dark));
    ctx.q.textContent = "Which is lighter?";
    pairPick(ctx, light, dark);
  },

  // Color memory as a level game: the staircase still tightens the neighbors (d), and the level adds pressure:
  // shorter looks, longer waits, more choices, a distractor flash in the gap, then two colors to hold at once.
  memory(ctx) {
    const { d } = ctx, lv = MEM.lv, P = ctx.P;
    const pick = () => tame(lab(pickBase(ctx.want)));
    const bases = ctx.rp ? [tame(lab(ctx.rp.h))] : P.hold === 2 ? [pick(), pick()] : [pick()];
    const ask = bases.length === 2 ? (gR() < .5 ? 0 : 1) : 0, base = bases[ask];
    const want = P.opts - 1;
    let nb = [];
    for (let t = 0; t < 30; t++) {
      const o = Array.from({ length: want }, () => offset(base, d, cvdW([.6, 1, 1]))).filter(x => x && shownDE(labHex(...base), labHex(...x)) >= SHOWN_MIN);
      const spread = o.every((x, i) => o.every((y, j) => i === j || de2000(x, y) >= d * .6));
      if (o.length > nb.length || (o.length === want && spread)) nb = o;
      if (nb.length === want && spread) break;
    }
    while (nb.length < want) nb.push(tame([base[0] + (nb.length % 2 ? 1 : -1) * d * (1 + nb.length / 2), base[1], base[2]]));
    const hexes = bases.map(x => labHex(...x)), hex = hexes[ask], opts = gShuf([base, ...nb].map(x => labHex(...x))), right = opts.indexOf(hex);
    if (!ctx.intro && !ctx.rp) ctx.el.querySelector("#ey").textContent = `Color memory · Level ${lv}`;
    ctx.stage.innerHTML = `<div class="mem"><div class="mem-chip" id="chip"></div><i class="mem-bar" id="bar" style="--t:${P.look}ms"></i></div>`;
    const chip = ctx.stage.querySelector("#chip"), bar = ctx.stage.querySelector("#bar");
    // show each color in turn, then the gap (with a distractor flash at higher levels), then the choices
    let t = 0;
    hexes.forEach((h, i) => {
      later(() => { chip.classList.remove("gone"); chip.style.setProperty("--c", h); ctx.q.textContent = hexes.length === 2 ? (i ? "…and this one" : "Remember this one…") : "Remember this color";
        bar.classList.remove("go", "gone"); void bar.offsetWidth; bar.classList.add("go"); }, t);
      t += P.look;
      if (i < hexes.length - 1) { later(() => chip.classList.add("gone"), t); t += 350; }
    });
    later(() => { chip.classList.add("gone"); bar.classList.add("gone"); ctx.q.textContent = "Hold it in mind"; }, t);
    if (P.flash) {
      const [L0, , H0] = lch(hex), fl = lchHex(clamp(100 - L0, 25, 80), 55, (H0 + 120 + gR() * 120) % 360);
      later(() => { chip.style.setProperty("--c", fl); chip.classList.remove("gone"); ctx.q.textContent = "Ignore this one"; }, t + P.gap * .35);
      later(() => { chip.classList.add("gone"); ctx.q.textContent = "Hold it in mind"; }, t + P.gap * .35 + 500);
    }
    later(() => {
      ctx.q.textContent = hexes.length === 2 ? (ask ? "Which was the second?" : "Which was the first?") : "Which one was it?";
      ctx.stage.innerHTML = `<div class="mem-opts n${opts.length}">${opts.map((h, i) => `<button class="tile" data-i="${i}" style="--c:${h}" aria-label="Option ${i + 1}"></button>`).join("")}</div>`;
      const [Lt, Ct] = lch(hex);
      ctx.shown(geoMean(opts.filter(h => h !== hex).map(h => shownDE(hex, h))));
      ctx.stage.querySelectorAll(".tile").forEach(b => b.onclick = () => {
        b.classList.add("picked");
        const ok = +b.dataset.i === right, [Lp, Cp] = lch(opts[+b.dataset.i]);
        ctx.pick(ok, () => {
          b.classList.remove("picked");
          const up = ctx.intro ? false : memStep(ok);
          ctx.stage.querySelector(`[data-i="${right}"]`).classList.add("ring");
          if (!ok) { b.classList.add("miss"); ctx.foot.innerHTML = `<p class="note">The ringed one was it, <b>${pctFmt(de2000(hex, opts[+b.dataset.i]))}</b> different from your pick</p>`; }
          else if (up) { ctx.foot.innerHTML = `<p class="note mem-up">Level ${MEM.lv} · ${esc(memParams(MEM.lv).news || "")}</p>`; buzz([8, 30, 8, 30, 14]); }
        }, { ...bandsOf(hex), s: ok ? undefined : { dC: +(Cp - Ct).toFixed(1), dL: +(Lp - Lt).toFixed(1) }, rp: { h: hex, pk: opts[+b.dataset.i] } });
      });
    }, t + P.gap);
  },

  // Sort the strip: ends fixed, middle shuffled, drag into order. Dials: what changes (lightness, then hue,
  // then both), how many swatches, then a time limit.
  order(ctx) {
    const { d, P } = ctx, n = P.n || 5;
    const w = P.dir === 2 ? [.6, 1, 1] : P.dir === 1 ? [.04, 1, 1] : [1, .12, .12];
    let steps;
    if (ctx.rp) steps = ctx.rp.steps;
    else {
      // redraw when rounding makes two neighbors (nearly) the same code
      for (let t = 0; t < 6; t++) {
        const A = tame(lab(pickBase(ctx.want)));
        const B = offset(A, d * (n - 1), cvdW(w)) || offset(tame(A.map((x, i) => i ? x * .7 : x)), d * (n - 1), cvdW(w)) || [A[0] > 50 ? A[0] - 25 : A[0] + 25, A[1], A[2]];
        steps = Array.from({ length: n }, (_, i) => labHex(...A.map((x, j) => x + (B[j] - x) * i / (n - 1))));
        if (steps.every((h, i) => !i || shownDE(steps[i - 1], h) >= SHOWN_MIN)) break;
      }
    }
    ctx.shown(geoMean(steps.slice(1).map((h, i) => Math.max(shownDE(steps[i], h), .05))));
    const mid = Array.from({ length: n - 2 }, (_, i) => i + 1);
    let order = [0, ...gShuf(mid), n - 1];
    if (order.every((v, i) => v === i)) order = [0, ...mid.slice().reverse(), n - 1];
    ctx.q.textContent = "Drag into a smooth strip";
    ctx.stage.innerHTML = `<div class="sorter" id="sorter">${order.map((s, i) => `<div class="srt${i === 0 || i === n - 1 ? " fixed" : ""}" data-s="${s}" style="--c:${steps[s]}">${i === 0 || i === n - 1 ? "<i></i>" : ""}</div>`).join("")}</div>`;
    ctx.foot.innerHTML = `<button class="btn" data-check>Check</button>`;
    const box = ctx.stage.querySelector("#sorter"), items = [...box.children];
    let rowH = 0;
    const layout = skip => items.forEach((it, i) => { if (it !== skip) it.style.transform = `translateY(${i * rowH}px)`; });
    const measure = () => { rowH = box.clientHeight / n; items.forEach(it => it.style.height = (rowH - 6) + "px"); layout(); };
    requestAnimationFrame(measure);
    let checked = false;
    items.forEach(it => {
      if (it.classList.contains("fixed")) return;
      it.addEventListener("pointerdown", e => {
        if (checked) return;
        it.setPointerCapture(e.pointerId); it.classList.add("lift");
        const y0 = e.clientY, i0 = items.indexOf(it), top0 = i0 * rowH;
        const move = ev => {
          const y = clamp(top0 + ev.clientY - y0, rowH, (n - 2) * rowH);
          it.style.transform = `translateY(${y}px) scale(1.03)`;
          const want = clamp(Math.round(y / rowH), 1, n - 2), cur = items.indexOf(it);
          if (want !== cur) { items.splice(cur, 1); items.splice(want, 0, it); layout(it); buzz(4); }
        };
        const up = () => { it.removeEventListener("pointermove", move); it.classList.remove("lift"); layout(); };
        it.addEventListener("pointermove", move);
        it.addEventListener("pointerup", up, { once: true });
        it.addEventListener("pointercancel", up, { once: true });
      });
    });
    const check = timeout => {
      if (checked) return; checked = true;
      const now = items.map(it => +it.dataset.s), wrong = now.filter((s, i) => steps[s] !== steps[i]).length;
      ctx.foot.innerHTML = "";
      ctx.pick(!wrong, () => {
        items.forEach((it, i) => it.classList.add(steps[+it.dataset.s] === steps[i] ? "good" : "bad"));
        ctx.foot.innerHTML = `<p class="note">${timeout ? "Time's up. " : ""}${wrong ? `${wrong} out of place. Here's the strip in order.` : "Perfect strip."}</p>`;
        later(() => { items.sort((a, b) => a.dataset.s - b.dataset.s); layout(); }, wrong ? 700 : 0);
      }, { ...bandsOf(steps[Math.floor(n / 2)]), s: timeout ? { out: 1 } : undefined, rp: { steps }, noConf: timeout ? 1 : 0 });
    };
    ctx.foot.querySelector("[data-check]").onclick = () => check(false);
    if (P.time && !ctx.check && !ctx.intro) ctx.clock(P.time, () => check(true));
  },

  // Find neutral: a grey square on a colored ground. The slider moves the square toward or away from the
  // ground's hue; the score is how far your "grey" sits from true grey (a* = b* = 0). The ground tints true grey
  // toward its opposite, so the task is to make it truly grey anyway: score and copy both mean physical grey.
  // Dials: the ground gets stronger, the square smaller, then a time limit.
  neutral(ctx) {
    const P = ctx.P, f = ctx.fix;
    const H = f.grounds && f.grounds.length ? f.grounds[f.i % f.grounds.length] : wantHue(ctx.want);
    const rad = H * Math.PI / 180, Lg = wantL(ctx.want, 45, 65), ground = gyFit(Lg, P.ground || 30, H);
    const Lp = clamp(Lg + gR() * 14 - 7, 42, 70), R = 24, sgn = gR() < .5 ? 1 : -1, s0 = .3 + gR() * .4;
    const tOf = s => (s - s0) * 2 * R * sgn;   // + = toward the ground's own hue
    const patch = s => { const t = tOf(s); return labHex(...tame([Lp, t * Math.cos(rad), t * Math.sin(rad)])); };
    const s1 = gyStart(s0, .2);
    ctx.q.textContent = "Make it truly grey";
    ctx.stage.innerHTML = `<div class="gy-col">
      <div class="gy-field" style="--g:${ground}"><div class="gy-patch" style="--sz:${(P.size || .46) * 100}%"><i id="pa" style="--c:${patch(s1)}"></i><i id="pb" style="--c:${patch(s1)}"></i></div>
        <span class="gy-tags" id="tags" data-ink="${ink(ground)}"><span>yours</span><span>true grey</span></span></div>
      ${gySlider("sl", s1, "Truly grey, not just grey-looking")}</div>`;
    const sl = ctx.stage.querySelector("#sl"), pa = ctx.stage.querySelector("#pa"), pb = ctx.stage.querySelector("#pb");
    sl.oninput = () => { const h = patch(sl.value / 1000); pa.style.setProperty("--c", h); pb.style.setProperty("--c", h); };
    gyLock(ctx, "It's grey", () => {
      const s = sl.value / 1000, mine = patch(s), grey = labHex(Lp, 0, 0), err = de2000(mine, grey), t = tOf(s);
      pb.style.setProperty("--c", grey); ctx.stage.querySelector(".gy-field").classList.add("rev");
      // which way the miss leaned: toward the ground's hue, and warm (reds to yellows) or cool (greens to blues)
      const rh = ((t >= 0 ? H : H + 180) % 360 + 360) % 360, warm = Math.abs(t) < 1 ? 0 : (rh >= 330 || rh < 100) ? 1 : (rh >= 150 && rh < 300) ? -1 : 0;
      const lean = err < 1.2 ? "Spot on: you corrected for the ground." : t > 0 ? "You leaned toward the ground's own hue: the ground tints true grey the other way, and you pushed back against it." : "You leaned away from the ground's hue.";
      return { err, note: `Off by <b>${pctFmt(err)}</b>. ${lean} The right half is true grey; on this ground it looks faintly tinted.`, meta: { ...bandsOf(ground), s: { err: +err.toFixed(2), tw: Math.sign(t), warm, gH: Math.round(H) } } };
    });
  },

  // Make it vanish: slide a disc's lightness until it matches the ground's (equal L*), so the edge softens.
  // Dials: the disc turns to the opposite hue, gets smaller, then more vivid; then a time limit.
  vanish(ctx) {
    const P = ctx.P, f = ctx.fix;
    const H = f.hues && f.hues.length ? f.hues[f.i % f.hues.length] : wantHue(ctx.want);
    const Lg = wantL(ctx.want, 42, 68), ground = gyFit(Lg, 42, H), Lgm = lab(ground)[0];
    const Hd = P.gap ? H + gyBtw(150, 210) : H + (gR() < .5 ? 1 : -1) * gyBtw(60, 100), lo = Math.max(10, Lg - 28), hi = Math.min(94, Lg + 28);
    const disc = s => gyFit(lo + (hi - lo) * s, P.chroma || 34, Hd), s0 = (Lg - lo) / (hi - lo), s1 = gyStart(s0, .25);
    ctx.q.textContent = "Make the disc vanish";
    ctx.stage.innerHTML = `<div class="gy-col">
      <div class="gy-field" id="fld" style="--g:${ground}"><b class="gy-disc" id="disc" style="--c:${disc(s1)};--sz:${(P.size || .5) * 100}%"></b><span class="gy-tags one" id="tags"><span>in black and white</span></span></div>
      ${gySlider("sl", s1, "Lightness of the disc")}</div>`;
    const sl = ctx.stage.querySelector("#sl"), dEl = ctx.stage.querySelector("#disc"), fld = ctx.stage.querySelector("#fld");
    sl.oninput = () => dEl.style.setProperty("--c", disc(sl.value / 1000));
    gyLock(ctx, "It's vanishing", () => {
      const Ld = lab(disc(sl.value / 1000))[0], err = Math.abs(Ld - Lgm);
      // the reveal: both turn to their greys, which is what the lightness system sees
      fld.classList.add("rev"); fld.style.setProperty("--g", lchHex(Lgm, 0, 0)); dEl.style.setProperty("--c", lchHex(Ld, 0, 0));
      fld.querySelector("#tags").dataset.ink = ink(lchHex(Lgm, 0, 0));
      return { err, note: `Disc ${Ld.toFixed(0)}, ground ${Lgm.toFixed(0)} (L*): <b>${pctFmt(err)}</b> different in lightness. ${err < 3 ? "In grey they nearly merge: that's equal lightness." : "In grey you can see which is lighter."} L* is a standard model; your own equal point can sit a little off it.`,
        meta: { ...bandsOf(ground), s: { dL: +(Ld - Lgm).toFixed(1), H: Math.round(H) } } };
    });
  },

  // One color, two looks: match the lower square (on ground B) to the upper one (on ground A).
  // Dials: one slider (lightness), then hue, then strength; grounds get more contrast; then a time limit.
  match(ctx) {
    const P = ctx.P, cvd = cvdOn();
    const H = wantHue(ctx.want), Lr = 45 + gR() * 15, ref = gyFit(Lr, wantC(ctx.want, 30), H), [Lr2, Cr, Hr] = lch(ref);
    const flip = gR() < .5, up = flip ? 1 : -1, gc = [[16, 26], [26, 38], [34, 50]][P.ground || 0];
    const gA = gyFit(clamp(Lr + up * gc[0], 14, 92), gc[1], H + up * 70), gB = gyFit(clamp(Lr - up * gc[0], 14, 92), gc[1], H - up * 70);
    // sliders: lightness ±20 L*; then hue ±45° (strength for color-blind players); then strength
    const nS = Math.min(P.sliders || 1, cvd ? 2 : 3), useH = nS >= 2 && !cvd, useC = (nS >= 2 && cvd) || nS >= 3;
    const at = (sL, sH, sC) => gyFit(Lr2 - 20 + 40 * sL, useC ? Cr * (.2 + 1.6 * sC) : Cr, useH ? Hr - 45 + 90 * sH : Hr);
    const sL = gyStart(.5, .15), sH = useH ? gyStart(.5, .15) : .5, sC = useC ? gyStart(.5, .15) : .5;
    ctx.q.textContent = "Make them match";
    ctx.stage.innerHTML = `<div class="gy-col">
      <div class="gy-two"><div class="gy-field" style="--g:${gA}"><div class="gy-sq" style="--c:${ref}"></div></div>
        <div class="gy-field" id="fb" style="--g:${gB}"><div class="gy-sq gy-patch"><i id="pa" style="--c:${at(sL, sH, sC)}"></i><i id="pb" style="--c:${at(sL, sH, sC)}"></i></div>
          <span class="gy-tags" data-ink="${ink(gB)}"><span>yours</span><span>the real one</span></span></div></div>
      ${gySlider("sl", sL, "Lightness")}${useH ? gySlider("sh", sH, "Hue") : ""}${useC ? gySlider("sc", sC, "Strength") : ""}</div>`;
    const v = id => { const e = ctx.stage.querySelector("#" + id); return e ? e.value / 1000 : .5; };
    const pa = ctx.stage.querySelector("#pa"), pb = ctx.stage.querySelector("#pb");
    ctx.stage.querySelectorAll("input").forEach(i => i.oninput = () => { const c = at(v("sl"), v("sh"), v("sc")); pa.style.setProperty("--c", c); pb.style.setProperty("--c", c); });
    gyLock(ctx, "They match", () => {
      const mine = at(v("sl"), v("sh"), v("sc")), err = de2000(mine, ref);
      pb.style.setProperty("--c", ref); ctx.stage.querySelector("#fb").classList.add("rev");
      return { err, note: `Off by <b>${pctFmt(err)}</b>. The right half is the real color: on this ground it looks wrong, which is the ground at work.`,
        meta: { ...bandsOf(ref), s: { dL: +(lab(mine)[0] - lab(ref)[0]).toFixed(1), gd: Math.sign(lab(gB)[0] - lab(gA)[0]) } } };
    });
  },

  // Squint (applied): a real painting with marked spots; tap them from lightest to darkest.
  // Truth = L* measured from the same image file (data/squint.js, made by tools/squint.py).
  // The staircase sets the smallest L* step between neighboring spots. Dials: 4 spots, mixed strengths, time.
  squint(ctx) {
    const { d, P } = ctx, pool = (window.SQUINT || []).filter(p => p.pts.length >= 12), nn = P.n || 3;
    let paint = null, idx = null;
    if (ctx.rp) { paint = pool.find(p => p.id === ctx.rp.p) || null; idx = paint ? ctx.rp.i : null; }
    for (let tries = 0; !idx && pool.length && tries < 120; tries++) {
      paint = pool[gR() * pool.length | 0];
      const dd = tries > 60 ? d * 1.4 : d, pts = paint.pts.map((p, i) => [...p, i]).filter(p => p[2] > 6 && p[2] < 96);
      const start = pts[gR() * pts.length | 0], dir = start[2] > 50 ? -1 : 1, got = [start];
      for (let j = 1; j < nn; j++) {
        const target = got[j - 1][2] + dir * dd * gyBtw(1, 1.6);
        const c = gShuf(pts).find(p => Math.abs(p[2] - target) < dd * .35 && got.every(g => Math.hypot(g[0] - p[0], (g[1] - p[1]) * paint.h / paint.w) > 150));
        if (!c) break; got.push(c);
      }
      if (got.length < nn) continue;
      if (P.hues && Math.max(...got.map(p => p[3])) - Math.min(...got.map(p => p[3])) < 22) continue;
      idx = gShuf(got).map(p => p[4]);
    }
    if (!idx) { ctx.q.textContent = "No painting to show"; return; }
    const spots = idx.map(i => paint.pts[i]), truth = spots.map((p, i) => [p[2], i]).sort((a, b) => b[0] - a[0]).map(x => x[1]);
    ctx.q.textContent = "Tap from lightest to darkest";
    ctx.stage.innerHTML = `<div class="sq-box"><div class="sq-img" id="sqi"><img src="${esc(paint.img)}" alt="${esc(paint.title)}, ${esc(paint.artist)}" draggable="false">
      ${spots.map((p, i) => `<button class="sq-dot" data-i="${i}" style="left:${p[0] / 10}%;top:${p[1] / 10}%" aria-label="Spot ${i + 1}"><b></b></button>`).join("")}</div></div>`;
    ctx.foot.innerHTML = `<button class="gy-hold" data-hold>Hold to squint</button>`;
    const box = ctx.stage.querySelector(".sq-box"), im = ctx.stage.querySelector("#sqi");
    const fit = () => { const s = Math.min(box.clientWidth / paint.w, box.clientHeight / paint.h); im.style.width = paint.w * s + "px"; im.style.height = paint.h * s + "px"; };
    requestAnimationFrame(fit);
    const hold = ctx.foot.querySelector("[data-hold]");
    hold.onpointerdown = () => im.classList.add("blur"); hold.onpointerup = hold.onpointerleave = hold.onpointercancel = () => im.classList.remove("blur");
    const chosen = [], dots = [...ctx.stage.querySelectorAll(".sq-dot")];
    const paintRanks = () => dots.forEach((b, i) => { const r = chosen.indexOf(i); b.classList.toggle("on", r >= 0); b.querySelector("b").textContent = r >= 0 ? r + 1 : ""; });
    const closePair = Math.min(...truth.slice(1).map((x, j) => spots[truth[j]][2] - spots[x][2]));
    ctx.shown(closePair);
    const meta = { l: lBand(spots.reduce((s, p) => s + p[2], 0) / spots.length), c: cBand(Math.max(...spots.map(p => p[3]))), rp: { p: paint.id, i: idx } };
    const reveal = () => {
      im.classList.remove("blur");
      dots.forEach((b, i) => { const r = truth.indexOf(i); b.querySelector("b").textContent = r + 1; b.classList.add("rev", chosen[r] === i ? "good" : "bad"); });
      ctx.foot.innerHTML = `<p class="note">Light to dark: ${truth.map(i => `<b>${spots[i][2].toFixed(0)}</b>`).join(" · ")} L*. ${esc(paint.title)}, ${esc(paint.artist)}.</p>`;
    };
    const finish = out => {
      const ok = !out && chosen.every((c, r) => c === truth[r]);
      ctx.pick(ok, reveal, { ...meta, s: out ? { out: 1 } : { gap: +closePair.toFixed(1) }, noConf: out ? 1 : 0, hold: 1 });
    };
    dots.forEach((b, i) => b.onclick = () => {
      const r = chosen.indexOf(i);
      if (r >= 0) chosen.splice(r); else chosen.push(i);
      buzz(4); paintRanks();
      if (chosen.length === nn - 1) { chosen.push(dots.findIndex((_, j) => !chosen.includes(j))); paintRanks(); later(() => finish(false), 260); }
    });
    if (P.time && !ctx.check && !ctx.intro) ctx.clock(P.time, () => finish(true));
  },
};

// Two stacked swatches; tap the lighter one. Records whether a wrong pick went for the more vivid color.
function pairPick(ctx, light, dark) {
  const top = gR() < .5, hexes = top ? [light, dark] : [dark, light], right = top ? 0 : 1;
  const [Ll, Cl] = lch(light), [Ld, Cd] = lch(dark), vd = Math.abs(Cl - Cd) >= 15 ? 1 : 0;
  ctx.foot.innerHTML = "";
  ctx.stage.innerHTML = `<div class="pairq">${hexes.map((h, i) => `<button class="half" data-i="${i}" style="--c:${h}" aria-label="${i ? "Bottom" : "Top"} color"></button>`).join("")}</div>`;
  const meta = { ...bandsOf(Cl > Cd ? light : dark), rp: { a: light, b: dark } };
  const explain = `Lightness ${Ll.toFixed(0)} vs ${Ld.toFixed(0)} (L*)`;
  const ring = () => ctx.stage.querySelector(`[data-i="${right}"]`).classList.add("ring");
  if (ctx.P.time && !ctx.check && !ctx.intro) ctx.clock(ctx.P.time, () => ctx.pick(false, () => { ring(); ctx.foot.innerHTML = `<p class="note">Time's up. ${explain}</p>`; }, { ...meta, s: { out: 1, vd }, noConf: 1 }));
  ctx.stage.querySelectorAll(".half").forEach(b => b.onclick = () => {
    b.classList.add("picked");
    const ok = +b.dataset.i === right, pickedHex = hexes[+b.dataset.i], pv = lch(pickedHex)[1] > lch(hexes[1 - b.dataset.i])[1] ? 1 : 0;
    ctx.pick(ok, () => {
      b.classList.remove("picked"); ring(); if (!ok) b.classList.add("miss");
      // label both halves with what they really are, so the answer is readable on the colors themselves
      ctx.stage.querySelectorAll(".half").forEach((h, i) => { const L = lch(hexes[i])[0]; h.insertAdjacentHTML("beforeend", `<span class="pq-lab" data-ink="${ink(hexes[i])}"><b>${i === right ? "Lighter" : "Darker"}</b><em>L* ${L.toFixed(0)}</em></span>`); });
      const grey = h => labHex(lch(h)[0], 0, 0), gap = Math.abs(Ll - Ld);
      const why = ok ? `Right: ${gap.toFixed(0)} points apart on a 0 to 100 lightness scale.`
        : pv ? "The one you picked is more vivid. Strong color can pass for light; judge the light, not the strength."
        : (lch(pickedHex)[2] > 60 && lch(pickedHex)[2] < 110) ? "Yellows tend to read lighter than they are next to other hues; squint and compare the grey."
        : "Squint, or picture both in black and white: the grey strip below is what each one really is.";
      ctx.foot.innerHTML = `<div class="pq-rev"><div class="pq-grey"><span>In grey</span>${hexes.map((h, i) => `<i style="--c:${grey(h)}"><em>${i ? "bottom" : "top"} · ${lch(h)[0].toFixed(0)}</em></i>`).join("")}</div><p class="note">${esc(why)}</p></div>`;
    }, { ...meta, s: { vd, pv } });
  });
}

// ======================================================================
// Afterimage: a one-off demonstration. Stare at a vivid dot for 20 seconds, look at white, name what you saw.
// ======================================================================
const AFTER_DOTS = { red: "#E3262E", green: "#14A84B", blue: "#2457E6", yellow: "#F2CC00", magenta: "#D1239A", cyan: "#00A9C8" };
function afterimage() {
  const v = S.profile && S.profile.cvd;
  const names = v === "red-green" ? ["blue", "yellow"] : v === "blue-yellow" ? ["red", "green"] : Object.keys(AFTER_DOTS);
  const nm = shuffle(names)[0], dot = AFTER_DOTS[nm], H = lch(dot)[2];
  // four pale choices: the opponent (right), the dot's own hue, and the two in between
  const opts = shuffle([0, 90, 180, 270].map(o => ({ o, h: gyFit(84, 22, H + 180 + o) })));
  const el = show(`
    <header class="deck-top">
      <button class="icon-btn" data-close aria-label="Close">${ICON.x}</button>
      <div class="timer af-timer"><i></i></div>
      <span class="left mono" id="lvl">20 s</span>
    </header>
    <div class="drill-head"><p class="eyebrow">${AFTER.name} · demonstration</p><h2 id="q">Stare at the cross</h2>
      <p class="dr-why" id="why">Keep your eyes on the cross in the middle of the dot for 20 seconds, then a white field appears. Hold still.</p></div>
    <div class="drill-stage"><div class="af-field" id="af"><div class="af-dot" style="--c:${dot}"><svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="48" pathLength="100"/></svg></div><i class="af-x"></i></div></div>
    <div class="drill-foot" id="dfoot"><button class="btn" data-go>Start the 20 seconds ${ICON.arrow}</button></div>
  `, "fixed drill drill-after");
  el.querySelector("[data-close]").onclick = () => go("gym");
  onKey = e => { if (e.key === "Escape") go("gym"); };
  const af = el.querySelector("#af"), q = el.querySelector("#q"), why = el.querySelector("#why"), foot = el.querySelector("#dfoot"), lvl = el.querySelector("#lvl");
  const go20 = () => {
    foot.innerHTML = `<p class="note">Don't look away</p>`;
    af.classList.add("go"); el.querySelector(".af-timer").classList.add("go");
    for (let s = 1; s <= 20; s++) later(() => { lvl.textContent = `${20 - s} s`; }, s * 1000);
    later(white, 20000);
  };
  const white = () => {
    buzz(10);
    af.classList.add("white"); q.textContent = "Keep looking at the cross"; foot.innerHTML = "";
    later(ask, 3500);
  };
  const ask = () => {
    q.textContent = "Which color did you see?"; af.classList.add("asked");
    af.insertAdjacentHTML("beforeend", `<div class="af-opts">${opts.map((x, i) => `<button class="tile" data-i="${i}" style="--c:${x.h}" aria-label="Option ${i + 1}"></button>`).join("")}</div>`);
    let done = false;
    af.querySelectorAll(".af-opts .tile").forEach(b => b.onclick = () => {
      if (done) return; done = true;
      const ok = opts[+b.dataset.i].o === 0, right = af.querySelector(`[data-i="${opts.findIndex(x => x.o === 0)}"]`);
      right.classList.add("ring"); if (!ok) b.classList.add("miss");
      buzz(ok ? 10 : [10, 40, 10]);
      const st = (S.gym.demos = S.gym.demos || {}).after || (S.gym.demos.after = { n: 0, right: 0 });
      st.n++; if (ok) st.right++; st.last = today(); save();
      q.textContent = ok ? "That's the one" : "It was the ringed one";
      why.textContent = `Staring tires the cone cells that respond most to the ${nm} dot. On white the rested ones win for a moment, and the eye's opponent pairs (red against green, blue against yellow) turn that into the opposite color.`;
      foot.innerHTML = `<div class="stack af-end"><button class="btn" data-again>Try another color ${ICON.arrow}</button><button class="btn ghost" data-home>Back to Train</button></div>`;
      foot.querySelector("[data-again]").onclick = afterimage;
      foot.querySelector("[data-home]").onclick = () => go("gym");
    });
  };
  foot.querySelector("[data-go]").onclick = go20;
}

// ======================================================================
// Lightning round: 45 seconds, four close names (or four close swatches) per question.
// ======================================================================
function lightning() {
  const met = ALL.filter(c => S.cards[c.id]), nu = nextUnit();
  const pool = met.length >= 8 ? met : [...met, ...(nu ? nu.colors : []), ...UNITS.filter(u => S.done[u.id]).flatMap(u => u.colors)];
  const qpool = pool.length >= 4 ? pool : ALL;
  const everyone = [...BASICS, ...ALL];
  let score = 0, combo = 0, end = Date.now() + 45000, over = false;
  const el = show(`
    <header class="deck-top">
      <button class="icon-btn" data-close aria-label="Close">${ICON.x}</button>
      <div class="timer"><i style="--dur:45s"></i></div>
      <span class="left mono" id="score">0</span>
    </header>
    <div class="lt-stage" id="lt"></div>
  `, "fixed drill lightning");
  el.querySelector("[data-close]").onclick = () => { over = true; go("gym"); };
  const box = el.querySelector("#lt"), scoreEl = el.querySelector("#score");
  later(() => finish(), 45000);
  function finish() {
    if (over) return; over = true;
    const best = S.best.lightning || 0, pb = score > best;
    if (pb) { S.best.lightning = score; save(); }
    const r = show(`
      <div style="flex:1"></div><p class="eyebrow">Lightning round</p>
      <h1>${score} <em>named.</em></h1>
      <p class="lede">${pb ? "A new best." : `Your best is ${best}.`} Questions come from colors you've met, with the three closest names as decoys.</p>
      <div class="stack"><button class="btn" data-again>Again ${ICON.bolt}</button><button class="btn ghost" data-home>Back to Train</button></div>`, "result");
    r.querySelector("[data-again]").onclick = lightning;
    r.querySelector("[data-home]").onclick = () => go("gym");
  }
  function ask() {
    if (over) return;
    const c = shuffle(qpool)[0];
    const decoys = everyone.filter(x => x.n !== c.n).map(x => [x, de2000(c.h, x.h)]).sort((a, b) => a[1] - b[1]).slice(0, 3).map(x => x[0]);
    const opts = shuffle([c, ...decoys]), reverse = Math.random() < .35;
    box.innerHTML = reverse
      ? `<div class="lt-name serif">${esc(c.n)}</div><div class="lt-swatches">${opts.map((o, i) => `<button data-i="${i}" style="--c:${o.h}" aria-label="Option ${i + 1}"></button>`).join("")}</div>`
      : `<div class="lt-swatch" style="--c:${c.h}"></div><div class="lt-opts">${opts.map((o, i) => `<button data-i="${i}">${esc(o.n)}</button>`).join("")}</div>`;
    box.querySelectorAll("[data-i]").forEach(b => b.onclick = () => {
      if (over || box.dataset.lock) return;
      const ok = opts[+b.dataset.i] === c;
      if (ok) { combo++; score += combo >= 5 ? 2 : 1; scoreEl.textContent = score; buzz(8); b.classList.add("right"); later(ask, 160); }
      else {
        combo = 0; buzz([10, 40, 10]); b.classList.add("wrong");
        box.querySelector(`[data-i="${opts.indexOf(c)}"]`).classList.add("right");
        box.dataset.lock = 1; later(() => { delete box.dataset.lock; ask(); }, 900);
      }
    });
  }
  ask();
}

// ======================================================================
// Screenshot states (index.html#shot=gx:<what>, wired in js/boot.js). In memory only; nothing is saved.
// ======================================================================
function gymShotState() {
  const day = gyDay(), dk = n => addDays(today(), -n);
  const H = (k, vals) => vals.map((v, i) => [dk((vals.length - 1 - i) * 3), v]);
  S.gym.skills = {
    hue: { level: 2.2, best: 2.1, hist: H("hue", [6.5, 4.8, 3.6, 2.9, 2.4, 2.2]), fam: { Blues: 3.1, Reds: 2.4, Greens: 2.2, Greys: 1.9, Yellows: 1.6 } },
    value: { level: 3, best: 2.8, hist: H("value", [9, 6.2, 4.4, 3.4, 3]), fam: {} },
    shade: { level: 3.6, best: 3.4, hist: H("shade", [10, 7, 5, 3.6]), fam: {} },
    memory: { level: 6, best: 5.5, hist: H("memory", [12, 9, 7, 6]), fam: {} },
    neutral: { level: 3.2, best: 3, hist: H("neutral", [7.5, 5.1, 4, 3.2]), fam: {} },
    vanish: { level: 4.5, best: 4, hist: H("vanish", [9, 6, 4.5]), fam: {} },
  };
  S.gym.memLv = 6;
  const g = gyState(), fams = ["Blues", "Reds", "Greens", "Yellows", "Purples"];
  // planted weak spot: blues missed far more often
  const mk = (n, f) => Array.from({ length: n }, (_, i) => { const fam = fams[i % 5], miss = fam === "Blues" ? i % 10 < 7 : i % 7 === 0; return { t: day - (i % 6), ok: miss ? 0 : 1, f: fam, l: L_BANDS[i % 3], c: C_BANDS[(i >> 1) % 3], ...(f ? f(i, miss) : {}) }; });
  ["hue", "value", "shade", "memory", "neutral", "vanish"].forEach((k, j) => {
    const st = stOf(k); st.trials = mk(30, k === "value" ? (i, miss) => ({ s: { vd: 1, pv: miss ? 1 : 0 } }) : null);
    st.stage = 1; st.due = day + (j % 3) - 1; st.prevLv = levelOf(k, lastScore(k)); st.plv = st.prevLv;
  });
  g.conf = { s: [34, 31], g: [21, 12] };
  g.seen = Object.fromEntries(TRAIN_KEYS.map(k => [k, 1]));
  g.checkins = [
    { t: day - 15, date: dk(15), res: { hue: { lv: 7 }, value: { lv: 6 }, shade: { lv: 5 } } },
    { t: day - 8, date: dk(8), res: { hue: { lv: 9 }, value: { lv: 8 }, neutral: { lv: 9 } } },
    { t: day - 1, date: dk(1), res: { value: { lv: 10 }, shade: { lv: 8 }, vanish: { lv: 9 } } },
  ];
}
function gymShot(arg) {
  const [what, k] = (arg || "home").split("-");
  if (what === "fresh") { S.gym.skills = {}; S.best = {}; return go("gym"); }
  if (what === "first") return go("gym");
  if (what === "intro") { delete S.gym.skills[k || "value"]; return runDrill(k || "value"); }
  gymShotState();
  if (what === "home") return go("gym");
  if (what === "due") { gyState().checkins.pop(); gyState().checkins.pop(); gyState().checkins[0].t -= 3; return go("gym"); }
  if (what === "introdone") { gyState().seen[k || "value"] = 0; delete S.gym.skills[k || "value"]; runDrill(k || "value"); return setTimeout(() => { const b = document.querySelector(".half,.tile"); if (b) b.click(); }, 700); }
  if (what === "conf") { runDrill(k || "value", { confAll: true }); return setTimeout(() => { const b = document.querySelectorAll(".half,.tile"); if (b[0]) b[0].click(); setTimeout(() => { const c = document.querySelectorAll(".half,.tile"); if (document.querySelector("[data-cf]")) return; if (c[1]) c[1].click(); }, 900); }, 700); }
  if (what === "tip") { const st = stOf("value"); return stationDone({ k: "value", est: 3.1, before: 3.4, pb: false, best: 2.8, news: [[7, dialNews("value", 7)]], tip: detectPattern("value", st.trials), weak: weakLine(weakBand(st.trials, gyDay())), due: 3 }); }
  // the results screen with real misses, for design review (NOTES-TRACKER #12): gx:miss or gx:missreplay (taps "Replay my misses" right away)
  if (what === "miss" || what === "missreplay") {
    const pairs = [["#3C6FC8", "#5A96EC"], ["#2E8A4C", "#3EA85C"], ["#C8323C", "#B21E2C"], ["#7E4FB0", "#8E5FC0"]];
    const trials = pairs.map(([a, b]) => ({ k: "hue", ok: 0, ...bandsOf(a), rp: { a, b, d: de2000(a, b) }, d: de2000(a, b) }));
    ["#8C8C88", "#B0763C", "#6B8E9E", "#A85C7C", "#E0C040", "#C86BA0", "#4C8C6C", "#9C5C3C"].forEach((h, i) => trials.push({ k: "hue", ok: 1, ...bandsOf(h), d: 1 + i * .15 }));
    const log = trials.map(t => t.d), ses = { d: log[log.length - 1], log, estimate() { return geoMean(this.log); } };
    finishStation("hue", { ses: { hue: ses }, trials }, 1);
    if (what === "missreplay") { const b = document.querySelector("[data-replay]"); if (b) b.click(); }
    return;
  }
  if (what === "checkin") { gyState().checkins = []; return runCheckin(); }
  if (what === "squint") { gyState().seen.squint = 1; return runDrill("squint", { noIntro: true }); }
  if (what === "squintrev") { runDrill("squint", { noIntro: true }); return setTimeout(() => { const d = document.querySelectorAll(".sq-dot"); d[0] && d[0].click(); setTimeout(() => d[1] && d[1].click(), 200); }, 900); }
  if (what === "mixed") { Object.assign(S.gym.skills.shade, { hist: [[today(), 2.2]] }); return go("gym"); }
  if (what === "eye") return eyeReport();
  if (what === "cidone") { const c = gyState().checkins; return checkinDone({ value: { lv: 11 }, shade: { lv: 8 }, vanish: { lv: 10 } }, { value: c[1], shade: c[0], vanish: null }); }
  // auto-play: taps through a whole set (any answer) to exercise the flow end to end, then stops on the result
  if (what === "auto" || what === "autofix" || what === "autoci" || what === "automix") {
    if (what === "autoci") { gyState().checkins = []; runCheckin(); }
    else if (what === "automix") runMixed(k || "light");
    else if (what === "autofix") runDrill(k || "value", { fix: detectPattern(k || "value", stOf(k || "value").trials) || { tip: "Practice", fix: {}, fixWhat: "3 more rounds" } });
    else runDrill(k || "hue", { noIntro: true, confAll: true });
    const tick = () => {
      const q = s => document.querySelector(s);
      const b = q("[data-cf]") || q("[data-lock]") || q("[data-next]") || q("[data-check]") || q(".sq-dot:not(.on):not(.rev)") || q(".drill .tile:not(.ring):not(.miss):not(.picked)") || q(".drill .half:not(.ring):not(.miss):not(.picked)");
      if (b && !q(".result")) b.click();
      if (!q(".result")) setTimeout(tick, 350);
    };
    return setTimeout(tick, 600);
  }
  // auto-play to the first result, then tap "Replay my misses" once and stop there (for screenshotting the replay set itself).
  if (what === "autoreplay") {
    runDrill(k || "hue", { noIntro: true });
    const tick = () => {
      const q = s => document.querySelector(s);
      const rp = q("[data-replay]");
      if (rp) return rp.click();
      const b = q("[data-cf]") || q("[data-lock]") || q("[data-next]") || q("[data-check]") || q(".sq-dot:not(.on):not(.rev)") || q(".drill .tile:not(.ring):not(.miss):not(.picked)") || q(".drill .half:not(.ring):not(.miss):not(.picked)");
      if (b && !q(".result")) b.click();
      setTimeout(tick, 350);
    };
    return setTimeout(tick, 600);
  }
  if (what === "drill") return runDrill(k || "hue", { noIntro: true });
  return go("gym");
}
