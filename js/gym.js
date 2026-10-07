"use strict";
// Gym tab: train the judgments painters make, one station at a time (like an ear-training app).
// Two kinds of station:
//  - staircase: get it right and the next difference is smaller, miss and it grows, so each skill settles
//    near the smallest difference you can see (about 70% right);
//  - adjust: you slide a color until it looks right, and the score is how far off you were.
// Either way the score is a color difference (smaller = sharper), mapped onto levels 1-20.
// Practice sharpens the trained judgment; the copy promises nothing more
// (learning-kb anti-claim: brain-training gains stay in the trained task).
// Size rule: every drill swatch is at least a quarter of the screen wide (small patches look less colorful).

// start = the level-1 score, top = the level-20 score, floor = the smallest staircase step.
// Keys are kept stable so old history stays meaningful: "value" always measured lightness across hues.
// "temp" (warmer or cooler) was retired; its history stays in storage.
const SKILLS = {
  hue:     { name: "Odd one out", what: "Find the tile that's slightly off", unit: "ΔE", start: 12, top: .8, floor: .5, trials: 12,
    why: "Your eye splits yellows finely but deep blues and deep reds coarsely, so this score moves with the hue." },
  value:   { name: "Which is lighter?", what: "Two different hues: tap the lighter", unit: "ΔL*", start: 14, top: 1, floor: .5, trials: 12,
    why: "In Josef Albers's classes, students asked which of two colors was darker were wrong about 60% of the time." },
  neutral: { name: "Find neutral", what: "Slide until the square looks pure grey", unit: "ΔE", start: 12, top: 1, trials: 5, kind: "adjust", ok: 3,
    why: "A colored ground tints a grey toward its opposite (simultaneous contrast), so true grey rarely looks grey on it." },
  vanish:  { name: "Make it vanish", what: "Match the disc's lightness to the ground", unit: "ΔL*", start: 15, top: 1, trials: 5, kind: "adjust", ok: 3,
    why: "Monet's sun in Impression, Sunrise is about as light as the clouds around it, so it seems to glow; in a black-and-white copy it nearly disappears." },
  match:   { name: "One color, two looks", what: "Make the lower square match the upper", unit: "ΔE", start: 15, top: 1.5, trials: 4, kind: "adjust", ok: 4,
    why: "One color on two grounds can look like two colors: each ground pushes its square toward the ground's opposite." },
  memory:  { name: "Color memory", what: "See it, lose it, find it among five", unit: "ΔE", start: 16, top: 2, floor: 1.5, trials: 8,
    why: "Remembered colors tend to drift toward the typical example of their name, so close neighbors are hard to tell apart from memory." },
  order:   { name: "Sort the strip", what: "Put close colors in order", unit: "ΔE step", start: 9, top: .8, floor: .6, trials: 4,
    why: "A smooth strip means judging each step against both of its neighbors at once." },
  shade:   { name: "Lighter or darker, same hue", what: "One strong, one greyish: tap the lighter", unit: "ΔL*", start: 14, top: 1, floor: .5, trials: 12,
    why: "A strong color can look lighter than a greyer one of the same lightness, so judge the light, not the strength." },
};
const AFTER = { name: "Afterimage", what: "Stare for 20 seconds, then look at white" };
const skillState = k => S.gym.skills[k] || (S.gym.skills[k] = { level: SKILLS[k].start, best: null, hist: [], fam: {} });
const fmt = d => d >= 10 ? d.toFixed(0) : d.toFixed(1);
const lastScore = k => { const h = skillState(k).hist; return h.length ? h[h.length - 1][1] : null; };
// Level 1-20 on a log scale between the station's starting score and its top score; 0 = not tried.
function levelOf(k, v) {
  if (v == null) return 0;
  const sk = SKILLS[k];
  return clamp(Math.round(1 + 19 * Math.log(sk.start / v) / Math.log(sk.start / sk.top)), 1, 20);
}
const ladder = (lv, cls = "") => `<span class="ladder ${cls}" aria-label="Level ${lv} of 20">${Array.from({ length: 20 }, (_, i) => `<i${i < lv ? ' class="on"' : ""}></i>`).join("")}</span>`;

// Color family by perceptual hue (used to report the odd-one-out score per family).
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
// Colors the drills draw from: the ones you've met, so practice reinforces the path.
// For color-blind players, offsets lean on lightness and the axis they see (fair drills, honest scores).
const cvdW = base => { const v = S.profile && S.profile.cvd; return v === "red-green" ? [base[0] + .3, base[1] * .3, base[2]] : v === "blue-yellow" ? [base[0] + .3, base[1], base[2] * .3] : base; };
// A hue (LCh degrees) the player can see: red-green color blindness keeps to yellows and blues, blue-yellow to reds and greens.
function gyHue(rnd = Math.random) {
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
const metColors = () => { const m = ALL.filter(c => S.cards[c.id]); return m.length >= 6 ? m : ALL; };

// Move a color by roughly `d` CIEDE2000 in a random direction, staying on screen.
// dir weights let a drill choose lightness-only or chroma-only moves.
function offset(baseLab, d, w = [.6, 1, 1], rnd = Math.random) {
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
    step(ok) { this.log.push(this.d); this.d = clamp(ok ? this.d * .8 : this.d * 1.5, sk.floor, 40); },
    // Estimate = geometric mean of the last few levels you worked at.
    estimate() { const t = this.log.slice(-6); return t.length ? Math.exp(t.reduce((s, x) => s + Math.log(x), 0) / t.length) : this.d; },
  };
}
// Adjust stations: the score is the geometric mean of your errors (a perfect 0 counts as 0.3, below anyone's limit).
function makeAdjust(k) {
  return {
    d: null, log: [],
    step(err) { this.log.push(Math.max(err, .3)); },
    estimate() { const t = this.log; return t.length ? Math.exp(t.reduce((s, x) => s + Math.log(x), 0) / t.length) : SKILLS[k].start; },
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

// ======================================================================
// Gym home: today's challenge, one suggested station, then every station as a tile.
// ======================================================================
function spark(hist) {
  const v = hist.slice(-14).map(x => x[1]);
  if (v.length < 2) return "";
  const lo = Math.min(...v), hi = Math.max(...v), w = 84, h = 26;
  const pts = v.map((x, i) => `${(i / (v.length - 1) * w).toFixed(1)},${(hi === lo ? h / 2 : (x - lo) / (hi - lo) * (h - 4) + 2).toFixed(1)}`).join(" ");
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}
function gyDaysSince(k) {
  const h = skillState(k).hist, d = h.length && h[h.length - 1][0];
  if (!d || !/^\d{4}-\d\d-\d\d$/.test(d)) return 0;
  const t = x => { const [y, m, dd] = x.split("-").map(Number); return Date.UTC(y, m - 1, dd); };
  return Math.max(0, Math.round((t(today()) - t(d)) / 864e5));
}
// One station to do now: anything never tried first, then a mix of "longest since" and "lowest level".
function suggestStation() {
  const ks = Object.keys(SKILLS), fresh = ks.find(k => !skillState(k).hist.length);
  if (fresh) return { k: fresh, why: "Not tried yet" };
  const best = ks.map(k => ({ k, lv: levelOf(k, lastScore(k)), ds: gyDaysSince(k) }))
    .map(x => ({ ...x, s: x.ds * 1.5 + (20 - x.lv) * .5 })).sort((a, b) => b.s - a.s)[0];
  return { k: best.k, why: best.ds >= 2 ? `Last trained ${best.ds} days ago` : best.ds === 1 ? "Last trained yesterday" : "Your lowest level" };
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
  const sk = SKILLS[k], d = Math.max(skillState(k).level || sk.start, 5);
  if (k === "hue") { const [a, b] = limitPair("hue", d), odd = hash(today()) % 9; return `<span class="sa sa-grid">${Array.from({ length: 9 }, (_, j) => i(j === odd ? b : a, j === odd ? "odd" : "")).join("")}</span>`; }
  if (k === "value") { const [a, b] = limitPair("value", d * 1.5); return `<span class="sa sa-pair">${i(a)}${i(b)}</span>`; }
  if (k === "shade") { const H = gyHue(rnd); return `<span class="sa sa-pair">${i(gyFit(60, 60, H))}${i(gyFit(54, 9, H))}</span>`; }
  if (k === "order") {
    const A = tame(lab(gymBase("order").h)), B = offset(A, d * 5, [.5, 1, 1]) || A;
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
  const A = tame(lab(gymBase("memory").h)), nb = [0, 1, 2, 3].map(() => offset(A, d) || A);
  return `<span class="sa sa-mem">${i(labHex(...A), "big")}${shuffle([A, ...nb]).map(x => i(labHex(...x))).join("")}</span>`;
}
const stationSub = k => {
  const sk = SKILLS[k], st = skillState(k), lv = levelOf(k, lastScore(k));
  return { lv, best: st.best != null ? `best ${fmt(st.best)} ${sk.unit}` : "not tried yet" };
};

function gymHome() {
  const sg = suggestStation(), sk0 = SKILLS[sg.k], s0 = stationSub(sg.k);
  const tile = k => {
    const sk = SKILLS[k], s = stationSub(k);
    return `<button class="gs-tile" data-st="${k}">
      ${stationArt(k)}
      <span class="gs-name">${esc(sk.name)}</span>
      <span class="gs-meta"><span>${s.lv ? `Level ${s.lv}` : "New"}</span>${spark(skillState(k).hist)}</span>
      ${ladder(s.lv)}
      <span class="gs-best">${esc(s.best)}</span>
    </button>`;
  };
  const demos = S.gym.demos || {}, af = demos.after;
  const el = show(`
    <header class="bar"><div class="brand">${LOGO}<span>ColorHub</span></div><span class="eyebrow">Eye training</span></header>
    <h1 class="tab-title" style="margin-top:22px"><em>Train</em> your eye</h1>
    <button class="sg-card" data-st="${sg.k}">
      <span class="sg-top"><span class="eyebrow">Suggested</span><span class="eyebrow">${esc(sg.why)}</span></span>
      ${stationArt(sg.k)}
      <span class="sg-name">${esc(sk0.name)}</span>
      <span class="sg-what">${esc(sk0.what)}.</span>
      <span class="sg-lv">${ladder(s0.lv)}<span>${s0.lv ? `Level ${s0.lv} of 20` : "Level 1 of 20 to start"}</span></span>
      <span class="sg-go"><b>Start</b><span>${k0Trials(sg.k)} · about a minute</span>${ICON.arrow}</span>
    </button>
    <button class="sec-head sec-link" data-eye><b>Stations</b><span>your eye ${ICON.chev}</span></button>
    ${S.profile && ["red-green", "blue-yellow"].includes(S.profile.cvd) ? `<p class="x-sub" style="margin-top:12px">Stations are tuned for ${S.profile.cvd} color blindness: differences lean on lightness and the colors you see best.</p>` : ""}
    <div class="gs-grid">${Object.keys(SKILLS).map(tile).join("")}
      <button class="gs-tile" data-st="after">${stationArt("after")}<span class="gs-name">${AFTER.name}</span>
        <span class="gs-meta"><span>Demonstration</span></span><span class="ladder blank"></span><span class="gs-best">${af ? `${af.right} of ${af.n} named` : "20 seconds"}</span></button>
    </div>
    <div class="sec-head"><b>Play</b></div>
    <button class="play-row" data-taste="color"><span><b>Find your color</b><span>Sixteen colors, head to head, then an eye exam for your taste.</span></span><em>${S.fav ? esc(S.fav.n) + "-ish" : "new"}</em></button>
    <button class="play-row" data-taste="palette"><span><b>Find your palette</b><span>Paintings and harmonies, head to head.</span></span><em>${(S.palettes || []).length ? S.palettes.length + " saved" : "new"}</em></button>
    <button class="play-row" data-lightning><span><b>Lightning round</b><span>Forty-five seconds. Name as many as you can.</span></span><em class="lt-best">${S.best.lightning ? `<b>${S.best.lightning}</b>best` : "new"}</em></button>
    <p class="fine">Scores are color differences: ΔE (CIEDE2000), and ΔL* for lightness. About 1 is the smallest difference most people can see side by side. Every swatch is at least a quarter of the screen wide, because small patches look less colorful. Practice sharpens these judgments; it isn't a brain-training claim.</p>
  `, "gym", "gym");
  el.querySelectorAll("[data-st]").forEach(b => b.onclick = () => runDrill(b.dataset.st));
  el.querySelector("[data-lightning]").onclick = lightning;
  el.querySelector("[data-eye]").onclick = eyeReport;
  el.querySelectorAll("[data-taste]").forEach(b => b.onclick = () => tasteIntro(b.dataset.taste));
}
const k0Trials = k => k === "order" ? `${SKILLS[k].trials} strips` : `${SKILLS[k].trials} rounds`;

// Results for one set: level before and after, personal best, and the station's one-line lesson.
function stationDone(r) {
  const sk = SKILLS[r.k], lvA = levelOf(r.k, r.est), lvB = r.before != null ? levelOf(r.k, r.before) : null;
  const head = r.pb && r.before != null ? "New personal <em>best.</em>" : lvB != null && lvA > lvB ? "Level <em>up.</em>" : r.before == null ? "First <em>set.</em>" : "Eyes <em>trained.</em>";
  const el = show(`
    <div style="flex:1"></div>
    <p class="eyebrow">${esc(sk.name)} · set done</p>
    <h1>${head}</h1>
    <div class="gr-lv"><span class="mono">Level</span>${lvB != null ? `<s>${lvB}</s><i>→</i>` : ""}<b data-count="${lvA}">${lvA}</b><span class="mono">of 20</span></div>
    ${ladder(lvA, "big")}
    <div class="res-list">
      <div class="res"><span>This set</span><b class="mono">${r.before != null ? fmt(r.before) + " → " : ""}${fmt(r.est)} <small>${esc(sk.unit)}</small></b>${r.pb ? "<em>best</em>" : ""}</div>
      <div class="res"><span>Personal best</span><b class="mono">${r.best != null ? fmt(r.best) : "—"} <small>${esc(sk.unit)}</small></b><span></span></div>
    </div>
    <p class="lede">${esc(sk.why)}</p>
    <p class="fine gr-fine">Smaller numbers mean smaller differences. Scores move from day to day; the trend over weeks is what counts. Practice sharpens this judgment; it isn't a brain-training claim.</p>
    <div class="stack"><button class="btn" data-again>Another set ${ICON.arrow}</button><button class="btn ghost" data-home>Back to the Gym</button></div>
  `, "result gym-res");
  el.querySelector("[data-again]").onclick = () => runDrill(r.k);
  el.querySelector("[data-home]").onclick = () => go("gym");
  onKey = e => { if (e.key === "Enter") go("gym"); };
  if (r.pb || (lvB != null && lvA > lvB)) buzz([12, 60, 12]);
}

// ======================================================================
// Station runner: a top bar with progress, the question, the station's lesson, then the drill.
// ======================================================================
function runDrill(k, opts = {}) {
  if (k === "after") return afterimage();
  const sk = SKILLS[k];
  if (!sk) return gymHome();
  const adj = sk.kind === "adjust", ses = adj ? makeAdjust(k) : makeStair(k), total = opts.trials || sk.trials, famHits = {};
  let n = 0;
  const el = show(`
    <header class="deck-top">
      <button class="icon-btn" data-close aria-label="Close">${ICON.x}</button>
      <div class="segs">${Array.from({ length: total }, () => `<i style="--c:var(--ink)"></i>`).join("")}</div>
      <span class="left mono" id="lvl"></span>
    </header>
    <div class="drill-head"><p class="eyebrow">${esc(sk.name)}</p><h2 id="q"></h2><p class="dr-why">${esc(sk.why)}</p></div>
    <div class="drill-stage" id="dstage"></div>
    <div class="drill-foot" id="dfoot"></div>
  `, `fixed drill station drill-${k}`);
  el.querySelector("[data-close]").onclick = () => go("gym");
  onKey = e => { if (e.key === "Escape") go("gym"); };
  const stage = el.querySelector("#dstage"), foot = el.querySelector("#dfoot"), q = el.querySelector("#q"), lvl = el.querySelector("#lvl");
  const segs = el.querySelectorAll(".segs i");
  const mark = ok => { segs[n].classList.add("on"); segs[n].style.setProperty("--c", ok ? "var(--good)" : "var(--bad)"); buzz(ok ? 10 : [10, 40, 10]); n++; };
  const finish = () => { const r = record(k, ses, k === "hue" ? famHits : null); return opts.done ? opts.done(r) : stationDone(r); };
  // staircase stations call answer(right?); adjust stations call settle(error) and then show a Next button
  const answer = (ok, fam) => {
    if (fam) famHits[fam] = ses.d;
    ses.step(ok); mark(ok);
    later(trial, ok ? 420 : 1100);
  };
  const settle = err => { ses.step(err); mark(err <= sk.ok); return n >= total ? "See results" : "Next"; };
  const ctx = { stage, foot, q, el, settle, next: trial };
  function trial() {
    if (n >= total) return finish();
    lvl.textContent = adj ? `${n + 1}/${total}` : `${fmt(ses.d)} ${sk.unit}`;
    foot.innerHTML = "";
    DRILLS[k](ctx, ses.d, answer);
  }
  trial();
}

// A range slider (0..1) with a caption.
const gySlider = (id, v, label) => `<label class="gy-sl"><span>${esc(label)}</span><input type="range" id="${id}" min="0" max="1000" step="1" value="${Math.round(v * 1000)}"></label>`;
// Lock button for adjust stations, then the reveal note and a Next button.
function gyLock(ctx, label, onLock) {
  ctx.foot.innerHTML = `<button class="btn" data-lock>${esc(label)} ${ICON.arrow}</button>`;
  ctx.foot.querySelector("[data-lock]").onclick = () => {
    ctx.stage.querySelectorAll("input").forEach(i => i.disabled = true);
    const { err, note } = onLock(), nextLabel = ctx.settle(err);
    ctx.foot.innerHTML = `<div class="gy-rev"><p class="note">${note}</p><button class="btn" data-next>${nextLabel} ${ICON.arrow}</button></div>`;
    ctx.foot.querySelector("[data-next]").onclick = ctx.next;
  };
}
// a start position at least `gap` away from the answer
const gyStart = (s0, gap = .2) => { const dir = Math.random() < .5 ? -1 : 1, s = s0 + dir * (gap + Math.random() * .2); return s < 0 || s > 1 ? s0 - dir * (gap + Math.random() * .2) : s; };

const DRILLS = {
  // Odd one out: a 3 x 3 grid of one color with one tile shifted by d (three columns keeps tiles big).
  hue(ctx, d, answer) {
    const base = shuffle(metColors())[0], L0 = lab(base.h);
    const odd = offset(L0, d, cvdW([.6, 1, 1])) || offset(tame(L0.map((x, i) => i ? x * .8 : x)), d, cvdW([.6, 1, 1]));
    const baseHex = labHex(...L0), oddHex = odd ? labHex(...odd) : baseHex;
    const n = 3, cells = n * n, at = Math.random() * cells | 0;
    ctx.q.textContent = "Which tile is different?";
    ctx.stage.innerHTML = `<div class="grid" style="--n:${n}">${Array.from({ length: cells }, (_, i) =>
      `<button class="tile" data-i="${i}" style="--c:${i === at ? oddHex : baseHex}" aria-label="Tile ${i + 1}"></button>`).join("")}</div>`;
    let done = false;
    ctx.stage.querySelectorAll(".tile").forEach(t => t.onclick = () => {
      if (done) return; done = true;
      const ok = +t.dataset.i === at, target = ctx.stage.querySelector(`[data-i="${at}"]`);
      target.classList.add("ring");
      if (!ok) { t.classList.add("miss"); ctx.foot.innerHTML = `<p class="note">This one was off by <b>${fmt(de2000(baseHex, oddHex))}</b></p>`; }
      answer(ok, family(base.h));
    });
  },

  // Which is lighter? Two different hues, different lightness (L*). Judging value across hue is the painter's skill.
  value(ctx, d, answer) {
    const H1 = Math.random() * 360, H2 = (H1 + 90 + Math.random() * 180) % 360, Lm = 35 + Math.random() * 35;
    const mk = (L, H) => gyFit(L, 30 + Math.random() * 30, H);
    const a = mk(Lm + d / 2, H1), b = mk(Lm - d / 2, H2), lightTop = Math.random() < .5;
    ctx.q.textContent = "Which is lighter?";
    pairQuestion(ctx, lightTop ? [a, b] : [b, a], lightTop ? 0 : 1, answer, (x, y) => `Lightness ${lab(x)[0].toFixed(0)} vs ${lab(y)[0].toFixed(0)} (L*)`);
  },

  // Lighter or darker, same hue: one strong color and one greyish one of the same hue, d apart in L*.
  shade(ctx, d, answer) {
    const H = gyHue(), Lm = 38 + Math.random() * 30, vividLight = Math.random() < .5;
    const vivid = L => gyFit(L, 65, H), dull = L => gyFit(L, 8, H);
    const light = vividLight ? vivid(Lm + d / 2) : dull(Lm + d / 2), dark = vividLight ? dull(Lm - d / 2) : vivid(Lm - d / 2);
    const lightTop = Math.random() < .5;
    ctx.q.textContent = "Which is lighter?";
    pairQuestion(ctx, lightTop ? [light, dark] : [dark, light], lightTop ? 0 : 1, answer, (x, y) => `Lightness ${lab(x)[0].toFixed(0)} vs ${lab(y)[0].toFixed(0)} (L*)`);
  },

  // Color memory: see a color for 2 s, it's gone for 1.5 s, then find it among five close neighbors (d apart).
  memory(ctx, d, answer) {
    const base = tame(lab(shuffle(metColors())[0].h));
    let nb = [];
    for (let t = 0; t < 30; t++) {
      const o = [0, 1, 2, 3].map(() => offset(base, d, cvdW([.6, 1, 1]))).filter(Boolean);
      if (o.length > nb.length || (o.length === 4 && o.every((x, i) => o.every((y, j) => i === j || de2000(x, y) >= d * .7)))) nb = o;
      if (nb.length === 4 && nb.every((x, i) => nb.every((y, j) => i === j || de2000(x, y) >= d * .7))) break;
    }
    while (nb.length < 4) nb.push(tame([base[0] + (nb.length % 2 ? 1 : -1) * d * (1 + nb.length / 2), base[1], base[2]]));
    const hex = labHex(...base), opts = shuffle([base, ...nb].map(x => labHex(...x))), right = opts.indexOf(hex);
    ctx.q.textContent = "Remember this color";
    ctx.stage.innerHTML = `<div class="mem"><div class="mem-chip" id="chip" style="--c:${hex}"></div><i class="mem-bar" id="bar"></i></div>`;
    const chip = ctx.stage.querySelector("#chip"), bar = ctx.stage.querySelector("#bar");
    requestAnimationFrame(() => bar.classList.add("go"));
    later(() => { chip.classList.add("gone"); bar.classList.add("gone"); ctx.q.textContent = "Hold it in mind"; }, 2000);
    later(() => {
      ctx.q.textContent = "Which one was it?";
      ctx.stage.innerHTML = `<div class="mem-opts">${opts.map((h, i) => `<button class="tile" data-i="${i}" style="--c:${h}" aria-label="Option ${i + 1}"></button>`).join("")}</div>`;
      let done = false;
      ctx.stage.querySelectorAll(".tile").forEach(t => t.onclick = () => {
        if (done) return; done = true;
        const ok = +t.dataset.i === right;
        ctx.stage.querySelector(`[data-i="${right}"]`).classList.add("ring");
        if (!ok) { t.classList.add("miss"); ctx.foot.innerHTML = `<p class="note">The ringed one was it, <b>${fmt(de2000(hex, opts[+t.dataset.i]))}</b> ΔE from your pick</p>`; }
        answer(ok);
      });
    }, 3500);
  },

  // Sort the strip: ends fixed, middle shuffled, drag into order. Six rows keep each swatch big.
  order(ctx, d, answer) {
    const n = 6, base = shuffle(metColors())[0], A = tame(lab(base.h));
    const B = offset(A, d * (n - 1), cvdW([.5, 1, 1])) || offset(tame(A.map((x, i) => i ? x * .7 : x)), d * (n - 1), cvdW([.5, 1, 1])) || [A[0] > 50 ? A[0] - 25 : A[0] + 25, A[1], A[2]];
    const steps = Array.from({ length: n }, (_, i) => labHex(...A.map((x, j) => x + (B[j] - x) * i / (n - 1))));
    let order = [0, ...shuffle([1, 2, 3, 4]), 5];
    if (order.every((v, i) => v === i)) order = [0, 2, 1, 4, 3, 5];
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
    ctx.foot.querySelector("[data-check]").onclick = () => {
      if (checked) return; checked = true;
      const now = items.map(it => +it.dataset.s), wrong = now.filter((s, i) => s !== i).length;
      items.forEach((it, i) => it.classList.add(+it.dataset.s === i ? "good" : "bad"));
      ctx.foot.innerHTML = `<p class="note">${wrong ? `${wrong} out of place. Here's the strip in order.` : "Perfect strip."}</p>`;
      later(() => { items.sort((a, b) => a.dataset.s - b.dataset.s); layout(); }, wrong ? 700 : 0);
      later(() => answer(!wrong), wrong ? 1300 : 300);
    };
  },

  // Find neutral: a grey square on a colored ground. The slider moves the square toward or away from the
  // ground's hue; the score is how far your "grey" sits from true grey (a* = b* = 0).
  neutral(ctx) {
    const H = gyHue(), rad = H * Math.PI / 180, Lg = 45 + Math.random() * 20, ground = gyFit(Lg, 50, H);
    const Lp = clamp(Lg + Math.random() * 14 - 7, 42, 70), R = 24, sgn = Math.random() < .5 ? 1 : -1, s0 = .3 + Math.random() * .4;
    const tOf = s => (s - s0) * 2 * R * sgn;   // + = toward the ground's own hue
    const patch = s => { const t = tOf(s); return labHex(...tame([Lp, t * Math.cos(rad), t * Math.sin(rad)])); };
    const s1 = gyStart(s0, .2);
    ctx.q.textContent = "Make it pure grey";
    ctx.stage.innerHTML = `<div class="gy-col">
      <div class="gy-field" style="--g:${ground}"><div class="gy-patch"><i id="pa" style="--c:${patch(s1)}"></i><i id="pb" style="--c:${patch(s1)}"></i></div>
        <span class="gy-tags" id="tags" data-ink="${ink(ground)}"><span>yours</span><span>true grey</span></span></div>
      ${gySlider("sl", s1, "Slide until it is neither warm nor cool")}</div>`;
    const sl = ctx.stage.querySelector("#sl"), pa = ctx.stage.querySelector("#pa"), pb = ctx.stage.querySelector("#pb");
    sl.oninput = () => { const h = patch(sl.value / 1000); pa.style.setProperty("--c", h); pb.style.setProperty("--c", h); };
    gyLock(ctx, "Looks grey", () => {
      const s = sl.value / 1000, mine = patch(s), grey = labHex(Lp, 0, 0), err = de2000(mine, grey), t = tOf(s);
      pb.style.setProperty("--c", grey); ctx.stage.querySelector(".gy-field").classList.add("rev");
      const lean = err < 1.2 ? "Spot on." : t > 0 ? "You leaned toward the ground's own hue: the ground tints true grey the other way, so you pushed back." : "You leaned away from the ground's hue.";
      return { err, note: `Off by <b>${fmt(err)}</b> ΔE. ${lean} The right half is true grey.` };
    });
  },

  // Make it vanish: slide a disc's lightness until it matches the ground's (equal L*), so the edge softens.
  vanish(ctx) {
    const H = gyHue(), Lg = 42 + Math.random() * 26, ground = gyFit(Lg, 42, H), Lgm = lab(ground)[0];
    const Hd = H + 150 + Math.random() * 60, lo = Math.max(10, Lg - 28), hi = Math.min(94, Lg + 28);
    const disc = s => gyFit(lo + (hi - lo) * s, 40, Hd), s0 = (Lg - lo) / (hi - lo), s1 = gyStart(s0, .25);
    ctx.q.textContent = "Make the disc vanish";
    ctx.stage.innerHTML = `<div class="gy-col">
      <div class="gy-field" id="fld" style="--g:${ground}"><b class="gy-disc" id="disc" style="--c:${disc(s1)}"></b><span class="gy-tags one" id="tags"><span>in black and white</span></span></div>
      ${gySlider("sl", s1, "Lightness of the disc")}</div>`;
    const sl = ctx.stage.querySelector("#sl"), dEl = ctx.stage.querySelector("#disc"), fld = ctx.stage.querySelector("#fld");
    sl.oninput = () => dEl.style.setProperty("--c", disc(sl.value / 1000));
    gyLock(ctx, "It's vanishing", () => {
      const Ld = lab(disc(sl.value / 1000))[0], err = Math.abs(Ld - Lgm);
      // the reveal: both turn to their greys, which is what the lightness system sees
      fld.classList.add("rev"); fld.style.setProperty("--g", lchHex(Lgm, 0, 0)); dEl.style.setProperty("--c", lchHex(Ld, 0, 0));
      fld.querySelector("#tags").dataset.ink = ink(lchHex(Lgm, 0, 0));
      return { err, note: `Disc ${Ld.toFixed(0)}, ground ${Lgm.toFixed(0)} (L*): <b>${fmt(err)}</b> apart. ${err < 3 ? "In grey they nearly merge: that's equal lightness." : "In grey you can see which is lighter."} L* is a standard model; your own equal point can sit a little off it.` };
    });
  },

  // One color, two looks: match the lower square (on ground B) to the upper one (on ground A).
  match(ctx) {
    const cvd = !!(S.profile && ["red-green", "blue-yellow"].includes(S.profile.cvd));
    const H = gyHue(), Lr = 45 + Math.random() * 15, ref = gyFit(Lr, 30, H), [Lr2, Cr, Hr] = lch(ref);
    const flip = Math.random() < .5, up = flip ? 1 : -1;
    const gA = gyFit(clamp(Lr + up * 28, 14, 92), 38, H + up * 70), gB = gyFit(clamp(Lr - up * 28, 14, 92), 38, H - up * 70);
    // sliders: lightness ±20 L*, and hue ±45° (or strength, for color-blind players)
    const at = (sL, sH) => cvd ? gyFit(Lr2 - 20 + 40 * sL, Cr * (.2 + 1.6 * sH), Hr) : gyFit(Lr2 - 20 + 40 * sL, Cr, Hr - 45 + 90 * sH);
    let sL = gyStart(.5, .15), sH = gyStart(.5, .15);
    ctx.q.textContent = "Make them match";
    ctx.stage.innerHTML = `<div class="gy-col">
      <div class="gy-two"><div class="gy-field" style="--g:${gA}"><div class="gy-sq" style="--c:${ref}"></div></div>
        <div class="gy-field" id="fb" style="--g:${gB}"><div class="gy-sq gy-patch"><i id="pa" style="--c:${at(sL, sH)}"></i><i id="pb" style="--c:${at(sL, sH)}"></i></div>
          <span class="gy-tags" data-ink="${ink(gB)}"><span>yours</span><span>the real one</span></span></div></div>
      ${gySlider("sl", sL, "Lightness")}${gySlider("sh", sH, cvd ? "Strength" : "Hue")}</div>`;
    const l = ctx.stage.querySelector("#sl"), h = ctx.stage.querySelector("#sh"), pa = ctx.stage.querySelector("#pa"), pb = ctx.stage.querySelector("#pb");
    l.oninput = h.oninput = () => { const c = at(l.value / 1000, h.value / 1000); pa.style.setProperty("--c", c); pb.style.setProperty("--c", c); };
    gyLock(ctx, "They match", () => {
      const mine = at(l.value / 1000, h.value / 1000), err = de2000(mine, ref);
      pb.style.setProperty("--c", ref); ctx.stage.querySelector("#fb").classList.add("rev");
      return { err, note: `Off by <b>${fmt(err)}</b> ΔE. The right half is the real color: on this ground it looks wrong, which is the ground at work.` };
    });
  },
};

// Two stacked swatches; tap the one that answers the question.
function pairQuestion(ctx, hexes, right, answer, explain) {
  ctx.foot.innerHTML = "";
  ctx.stage.innerHTML = `<div class="pairq">${hexes.map((h, i) => `<button class="half" data-i="${i}" style="--c:${h}" aria-label="${i ? "Bottom" : "Top"} color"></button>`).join("")}</div>`;
  let done = false;
  ctx.stage.querySelectorAll(".half").forEach(b => b.onclick = () => {
    if (done) return; done = true;
    const ok = +b.dataset.i === right;
    ctx.stage.querySelector(`[data-i="${right}"]`).classList.add("ring");
    if (!ok) b.classList.add("miss");
    if (explain) ctx.foot.innerHTML = `<p class="note">${esc(explain(hexes[0], hexes[1]))}</p>`;
    answer(ok);
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
      foot.innerHTML = `<div class="stack af-end"><button class="btn" data-again>Try another color ${ICON.arrow}</button><button class="btn ghost" data-home>Back to the Gym</button></div>`;
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
      <div class="stack"><button class="btn" data-again>Again ${ICON.bolt}</button><button class="btn ghost" data-home>Back to the Gym</button></div>`, "result");
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
