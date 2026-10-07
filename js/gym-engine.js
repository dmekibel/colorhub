"use strict";
// Gym training engine: the pure parts (no DOM, no storage), so tools/gym_sim.js can load and test them.
// Grounded in the learning KB (../learning-kb/EXPORT-learning-kb-for-claude-project.md):
//  #7 work at the edge (staircase near 75% right) and target the weak spot;
//  #4 fade scaffolding: one difficulty dial turns at a time (single component -> combined -> whole task);
//  #6 one specific, behavioral fix, then a chance to use it; #5/#16 confidence + calibration;
//  #3 the honest progress number is a delayed, unassisted probe (the weekly check-in);
//  #2 spaced stations; #8 interleave once each is known; #13/N2 build on mastered skills.
// Plain script: top-level names are shared with js/gym.js. In node, module.exports exposes them.

// ---------- stations ----------
// start = the level-1 score, top = the level-20 score, floor = the smallest staircase step.
// Keys are kept stable so old history stays meaningful: "value" always measured lightness across hues.
// "temp" (warmer or cooler) was retired; its history stays in storage.
const SKILLS = {
  hue:     { name: "Odd one out", what: "Find the tile that's slightly off", unit: "ΔE", start: 12, top: .8, floor: .5, trials: 12,
    why: "Scores use CIEDE2000, which already allows for the eye seeing some hues more finely than others, so a 2% difference should be about as hard in yellows as in deep blues." },
  value:   { name: "Which is lighter?", what: "Two different hues: tap the lighter", unit: "ΔL*", start: 14, top: 1, floor: .5, trials: 12,
    why: "Josef Albers reported that his students, even advanced painters, picked wrong about 60% of the time when asked which of two colors was darker.",
    src: "Josef Albers, Interaction of Color (1963), from his own classes over several years; a teacher's report, not a controlled study" },
  neutral: { name: "Find neutral", what: "Make the square truly grey, even though the ground tints it", unit: "ΔE", start: 12, top: 1, trials: 5, kind: "adjust", ok: 3,
    why: "A colored ground tints a grey toward its opposite (simultaneous contrast), so true grey rarely looks grey on it. The skill is to see past that push." },
  vanish:  { name: "Make it vanish", what: "Match the disc's lightness to the ground", unit: "ΔL*", start: 15, top: 1, trials: 5, kind: "adjust", ok: 3,
    why: "Monet's sun in Impression, Sunrise is about as light as the clouds around it, so it seems to glow; in a black-and-white copy it nearly disappears." },
  match:   { name: "One color, two looks", what: "Make the lower square match the upper", unit: "ΔE", start: 15, top: 1.5, trials: 4, kind: "adjust", ok: 4,
    why: "One color on two grounds can look like two colors: each ground pushes its square toward the ground's opposite." },
  memory:  { name: "Color memory", what: "See it, lose it, find it again. It gets harder as you climb", unit: "ΔE", start: 16, top: 2, floor: 1.5, trials: 12,
    why: "Remembered colors tend to drift toward the typical example of their name, so close neighbors are hard to tell apart from memory." },
  order:   { name: "Sort the strip", what: "Put close colors in order", unit: "ΔE step", start: 9, top: .8, floor: .6, trials: 4,
    why: "A smooth strip means judging each step against both of its neighbors at once." },
  shade:   { name: "Lighter or darker, same hue", what: "One strong, one greyish: tap the lighter", unit: "ΔL*", start: 14, top: 1, floor: .5, trials: 12,
    why: "A strong color can look lighter than a greyer one of the same lightness, so judge the light, not the strength." },
  // Applied: uses Which is lighter + Lighter, same hue on real paintings.
  squint:  { name: "Squint", what: "Order the marked spots from light to dark", unit: "ΔL*", start: 20, top: 3, floor: 2, trials: 6, applied: true,
    why: "Painters squint to blur the detail, so the big shapes of light and dark show on their own." },
};
// The Train home's shelves (DESIGN.md: tools live inside their tab as quiet tiles, grouped).
const SHELVES = [
  ["Foundations", ["hue", "value", "shade", "memory", "order"]],
  ["In context", ["neutral", "match", "vanish", "after"]],
  ["Applied", ["squint", "mix:light", "mix:ctx"]],
];
// Mixed sets interleave stations you already know (KB #8: interleaving trains telling similar judgments apart,
// and hurts beginners, so they unlock only once two of the three stations reach level 5).
const MIXES = {
  light: { name: "Mixed: lightness", ks: ["value", "shade", "vanish"], what: "Three lightness stations, shuffled together", need: 5 },
  ctx:   { name: "Mixed: context", ks: ["neutral", "match", "hue"], what: "Three context stations, shuffled together", need: 5 },
};
// Squint unlocks from these two at level 8 (lower than the level-15 "mastered" bar, so people actually reach it).
const SQUINT_NEEDS = { ks: ["value", "shade"], lv: 8 };

// ---------- levels ----------
// Level 1-20 on a log scale between a station's starting score and its top score.
const levelFor = (sk, v) => v == null ? 0 : Math.max(1, Math.min(20, Math.round(1 + 19 * Math.log(sk.start / v) / Math.log(sk.start / sk.top))));
// the score that sits at a level (the inverse, unrounded)
const scoreAt = (sk, lv) => sk.start * Math.pow(sk.top / sk.start, (lv - 1) / 19);
const geoMean = a => a.length ? Math.exp(a.reduce((s, x) => s + Math.log(x), 0) / a.length) : null;

// ---------- the staircase (KB #7: keep the learner around 70-85% right) ----------
// Right: the difference shrinks by STAIR_DOWN. Wrong: it grows by STAIR_UP. The staircase settles where
// p * ln(DOWN) + (1 - p) * ln(UP) = 0, i.e. p = ln(UP) / (ln(UP) - ln(DOWN)) = about 76% right.
const STAIR_DOWN = .87, STAIR_UP = 1.55;
const stairTarget = () => Math.log(STAIR_UP) / (Math.log(STAIR_UP) - Math.log(STAIR_DOWN));
const stairNext = (d, ok, floor = .5, max = 40) => Math.max(floor, Math.min(max, ok ? d * STAIR_DOWN : d * STAIR_UP));

// ---------- dials (KB #4: fade the scaffolding one dial at a time) ----------
// Each station: a core difference (the staircase) plus 2-4 dials. A stage is [level, value, news].
// The rule: at any level, at most one dial turns. Level 1 is the single component; each new dial adds one more.
const GY_DIALS = {
  hue: [
    { id: "pole", name: "Pale and deep colors", stages: [[1, 0], [3, 1, "pale and deep colors join in"]] },
    { id: "time", name: "Time limit", stages: [[1, 0], [5, 8000, "a time limit: 8 seconds a grid"], [11, 5000, "5 seconds a grid"], [17, 3000, "3 seconds a grid"]] },
    { id: "mute", name: "Greyish colors", stages: [[1, 0], [8, 1, "greyish colors join in"], [14, 2, "near-greys too"]] },
  ],
  value: [
    { id: "hues", name: "Hue distance", stages: [[1, 0], [4, 1, "the two hues move far apart"]] },
    { id: "chroma", name: "Strength mismatch", stages: [[1, 0], [7, 1, "one color is stronger than the other"], [11, 2, "one vivid, one greyish"]] },
    { id: "time", name: "Time limit", stages: [[1, 0], [15, 4000, "4 seconds a pair"], [18, 2500, "2.5 seconds a pair"]] },
  ],
  shade: [
    { id: "gap", name: "Strength gap", stages: [[1, 0], [5, 1, "a bigger strength gap"], [10, 2, "vivid against near-grey"]] },
    { id: "deep", name: "Dark colors", stages: [[1, 0], [8, 1, "darker colors join in"]] },
    { id: "time", name: "Time limit", stages: [[1, 0], [14, 4000, "4 seconds a pair"]] },
  ],
  memory: [
    { id: "opts", name: "Choices", stages: [[1, 3], [4, 5, "five choices now"], [9, 7, "seven choices"], [15, 9, "nine choices"]] },
    { id: "flash", name: "Distractor", stages: [[1, 0], [7, 1, "a distractor flashes in the gap"]] },
    { id: "hold", name: "Colors to hold", stages: [[1, 1], [11, 2, "two colors to hold"]] },
  ],
  order: [
    { id: "dir", name: "What changes", stages: [[1, 0], [5, 1, "the steps change hue, not lightness"], [10, 2, "hue and lightness both change"]] },
    { id: "n", name: "Swatches", stages: [[1, 5], [7, 6, "six swatches"], [13, 7, "seven swatches"]] },
    { id: "time", name: "Time limit", stages: [[1, 0], [16, 25000, "25 seconds a strip"]] },
  ],
  neutral: [
    { id: "ground", name: "Ground strength", stages: [[1, 30], [4, 45, "stronger grounds"], [10, 62, "vivid grounds"]] },
    { id: "size", name: "Square size", stages: [[1, .46], [7, .36, "a smaller square"], [13, .28, "smaller still"]] },
    { id: "time", name: "Time limit", stages: [[1, 0], [16, 12000, "12 seconds to lock"]] },
  ],
  vanish: [
    { id: "gap", name: "Hue gap", stages: [[1, 0], [5, 1, "the disc turns to the opposite hue"]] },
    { id: "size", name: "Disc size", stages: [[1, .5], [7, .38, "a smaller disc"], [13, .3, "smaller still"]] },
    { id: "chroma", name: "Disc strength", stages: [[1, 34], [9, 56, "a more vivid disc"]] },
    { id: "time", name: "Time limit", stages: [[1, 0], [16, 12000, "12 seconds to lock"]] },
  ],
  match: [
    { id: "sliders", name: "Free sliders", stages: [[1, 1], [6, 2, "a hue slider joins in"], [12, 3, "a strength slider too"]] },
    { id: "ground", name: "Ground contrast", stages: [[1, 0], [4, 1, "stronger grounds"], [9, 2, "high-contrast grounds"]] },
    { id: "time", name: "Time limit", stages: [[1, 0], [16, 20000, "20 seconds to lock"]] },
  ],
  squint: [
    { id: "n", name: "Spots", stages: [[1, 3], [6, 4, "four spots"]] },
    { id: "hues", name: "Mixed strengths", stages: [[1, 0], [10, 1, "vivid and greyish spots together"]] },
    { id: "time", name: "Time limit", stages: [[1, 0], [15, 10000, "10 seconds a painting"]] },
  ],
};
// The dial settings at a level: each dial takes its last stage at or below the level.
function dialPlan(k, lv) {
  const out = {};
  (GY_DIALS[k] || []).forEach(d => { let v = d.stages[0][1]; d.stages.forEach(s => { if (s[0] <= lv) v = s[1]; }); out[d.id] = v; });
  return out;
}
// What turns on at exactly this level ("Level 7 · a distractor appears"), or null.
function dialNews(k, lv) {
  for (const d of GY_DIALS[k] || []) for (const s of d.stages) if (s[0] === lv && s[0] > 1 && s[2]) return s[2];
  return null;
}
// News for every level passed between two levels (a, b], newest last.
const dialNewsBetween = (k, a, b) => { const out = []; for (let l = a + 1; l <= b; l++) { const n = dialNews(k, l); if (n) out.push([l, n]); } return out; };
// Every unlock in order, for the station intro and the sim: [[level, news], ...]
const dialUnlocks = k => (GY_DIALS[k] || []).flatMap(d => d.stages.filter(s => s[0] > 1).map(s => [s[0], s[2]])).sort((a, b) => a[0] - b[0]);

// ---------- bands: where a trial sat (hue family, lightness, strength) ----------
const L_BANDS = ["dark", "mid", "light"], C_BANDS = ["muted", "mid", "vivid"];
const WEAK_Z = 2.3;
const lBand = L => L < 40 ? "dark" : L < 66 ? "mid" : "light";
const cBand = C => C < 18 ? "muted" : C < 42 ? "mid" : "vivid";
// LCh hue ranges for each family (matches family() in gym.js), used to aim trials at a weak family
const FAM_HUES = { Reds: [345, 40], Oranges: [40, 70], Yellows: [70, 100], Greens: [100, 195], Blues: [195, 290], Purples: [290, 345], Pinks: [345, 40], Browns: [40, 100], Greys: [0, 360] };
const BAND_WORDS = {
  l: { dark: "Dark colors", mid: "Mid-tones", light: "Light colors" },
  c: { muted: "Greyish colors", mid: "Medium-strength colors", vivid: "Vivid colors" },
};
const bandLabel = w => w.dim === "f" ? w.val : BAND_WORDS[w.dim][w.val];
// A trial record: { t: day number, ok, f: family, l: lightness band, c: strength band, cf: "s"|"g" (confidence), s: {signals} }

// The weakest band from recent trials: the band whose miss rate stands out from your overall rate.
// Uses this week's trials when there are enough, else the last 40. Returns null when nothing stands out.
function weakBand(trials, now, opts = {}) {
  let pool = trials.filter(t => t.t >= now - 7), week = true;
  if (pool.length < 24) { pool = trials.slice(-60); week = false; }
  if (pool.length < 16) return null;
  const N = pool.length, M = pool.filter(t => !t.ok).length, p0 = M / N;
  if (!M || M === N) return null;
  let best = null;
  for (const dim of opts.dims || ["f", "l", "c"]) {
    const groups = {};
    pool.forEach(t => { if (t[dim] == null) return; const g = groups[t[dim]] || (groups[t[dim]] = { n: 0, miss: 0 }); g.n++; if (!t.ok) g.miss++; });
    for (const [val, g] of Object.entries(groups)) {
      if (g.n < 5 || g.miss < 3 || g.n === N) continue;
      // this band's miss rate against the rest (a two-proportion z score); about a dozen bands are tested,
      // so the bar is high (z >= 2.3) to keep false alarms rare
      const rate = g.miss / g.n, rest = (M - g.miss) / (N - g.n), se = Math.sqrt(p0 * (1 - p0) * (1 / g.n + 1 / (N - g.n))), z = (rate - rest) / se;
      if (z < WEAK_Z || rate - rest < .2) continue;
      if (!best || z > best.score) best = { dim, val, n: g.n, miss: g.miss, rate, p0, score: z, week };
    }
  }
  return best;
}
const weakLine = w => w ? `${bandLabel(w)} are your weak zone ${w.week ? "this week" : "lately"}` : null;

// ---------- confidence and calibration (KB #5, #16) ----------
// conf = { s: [asked, right], g: [asked, right] } (s = "Sure", g = "Guessing")
function calib(conf) {
  const pct = ([n, h]) => n ? Math.round(h / n * 100) : null;
  return { sure: pct(conf.s), guess: pct(conf.g), nSure: conf.s[0], nGuess: conf.g[0] };
}
const calibLine = c => c.nSure >= 5 ? `When you're sure, you're right ${c.sure}% of the time${c.nGuess >= 3 ? `; when you're guessing, ${c.guess}%` : ""}.` : null;

// ---------- spaced stations (KB #2) ----------
// After a session: advance a stage when it ended at or above the level of the session before; else back to 1 day.
const GY_GAPS = [1, 3, 7, 16, 35], GY_GAPS_MAINT = [7, 16, 35, 60, 90];
function nextDue(st, lvNow, day) {
  const prev = st.prevLv;
  let stage = st.stage || 0;
  if (prev == null) stage = 0;
  else if (lvNow >= prev) stage = Math.min(stage + 1, GY_GAPS.length - 1);
  else stage = 0;
  const gaps = st.maint ? GY_GAPS_MAINT : GY_GAPS;
  return { stage, due: day + gaps[stage], prevLv: lvNow };
}

// ---------- weekly check-in (KB #3) ----------
// A fixed probe: staircase stations get 6 rounds on a fixed ladder of levels (easy to hard), adjust stations 3 rounds.
// No feedback, no confidence prompts, the same dial plan for everyone (CI_PLAN), colors seeded by the week.
// Two-choice stations get a longer ladder: a coin flip is right half the time, so they need more rounds
// to say the same amount (tools/gym_sim.js measures the week-to-week spread for a player who doesn't change).
const CI_LADDER = [4, 7, 10, 13, 16, 19], CI_LADDER_2 = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20], CI_PLAN = 4, CI_ADJUST = 3;
const CI_STATIONS = ["hue", "value", "shade", "neutral", "vanish", "match"];
const CI_CHANCE = { hue: 1 / 9, value: .5, shade: .5 };
const ciLadder = k => CI_CHANCE[k] === .5 ? CI_LADDER_2 : CI_LADDER;
// Level from a ladder of fixed levels: the best-fitting threshold (maximum likelihood) for a logistic curve with
// the station's guessing rate, reported at the staircase's own point (about 76% right), so levels match sessions.
// res = [{ lv, ok }]
function ciLevel(k, res, slope = 2.5) {
  const g = CI_CHANCE[k] || 0;
  let best = null;
  for (let T = -4; T <= 26; T += .25) {
    let ll = 0;
    res.forEach(r => { const p = g + (1 - g) / (1 + Math.exp((r.lv - T) / slope)); ll += Math.log(r.ok ? p : 1 - p); });
    if (!best || ll > best.ll + 1e-9) best = { T, ll };
  }
  const x = Math.log((1 - g) / (stairTarget() - g) - 1);
  return Math.max(1, Math.min(20, Math.round(best.T + slope * x)));
}
const weekOf = day => Math.floor(day / 7);
// Due: the first one as soon as three stations have been tried, then every 7 days.
function checkinDue(checkins, triedCount, day) {
  if (triedCount < 3) return { due: false, why: "Try three stations to unlock the weekly check-in" };
  const last = checkins.length ? checkins[checkins.length - 1].t : null;
  if (last == null) return { due: true, why: "Your first check-in" };
  const wait = last + 7 - day;
  return wait <= 0 ? { due: true, why: day - last > 7 ? `Last one ${day - last} days ago` : "A week since the last one" } : { due: false, why: `Next check-in in ${wait} day${wait > 1 ? "s" : ""}`, inDays: wait };
}
// Three stations for this check-in: tried ones, least recently checked first (ties in table order).
function checkinPick(tried, checkins) {
  const lastCi = k => { for (let i = checkins.length - 1; i >= 0; i--) if (checkins[i].res[k]) return checkins[i].t; return -1; };
  return CI_STATIONS.filter(k => tried.includes(k)).sort((a, b) => lastCi(a) - lastCi(b) || CI_STATIONS.indexOf(a) - CI_STATIONS.indexOf(b)).slice(0, 3);
}
// Maintenance (KB #13, N2): level 15 or more on two check-ins in a row for that station.
function inMaintenance(k, checkins) {
  const mine = checkins.filter(c => c.res[k]).slice(-2);
  return mine.length === 2 && mine.every(c => c.res[k].lv >= 15);
}

// ---------- what to train next (KB #2, #7) ----------
// info: [{ k, tried, lv, due (day or null), today (trained today) }]
// Overdue first (most overdue), then your weakest station not trained today, then one you haven't tried.
function suggestPick(info, day) {
  const due = info.filter(x => x.tried && x.due != null && x.due <= day).sort((a, b) => a.due - b.due || a.lv - b.lv)[0];
  if (due) return { k: due.k, why: due.due < day ? `Due ${day - due.due} day${day - due.due > 1 ? "s" : ""} ago` : "Due today", reason: "due" };
  const weak = info.filter(x => x.tried && !x.today).sort((a, b) => a.lv - b.lv)[0];
  if (weak) return { k: weak.k, why: "Your lowest level", reason: "weak" };
  const fresh = info.find(x => !x.tried);
  if (fresh) return { k: fresh.k, why: "Not tried yet", reason: "new" };
  const any = info.slice().sort((a, b) => (a.due || 0) - (b.due || 0))[0];
  return any ? { k: any.k, why: "Next on your schedule", reason: "next" } : null;
}

// ---------- one tip (KB #6): spot a systematic error in recent trials ----------
// Returns { id, tip, fix, fixWhat } or null. One prioritized, behavioral tip; never a verdict on the person.
const gyShare = (a, f) => a.length ? a.filter(f).length / a.length : 0;
function detectPattern(k, trials) {
  const recent = trials.slice(-24);
  if (recent.length < 4) return null;
  const miss = recent.filter(t => !t.ok), sig = recent.filter(t => t.s);
  if (k === "value" || k === "shade") {
    // misses where the two differed in strength: did you pick the more vivid one?
    const m = miss.filter(t => t.s && t.s.vd);
    if (m.length >= 3 && gyShare(m, t => t.s.pv) >= .6)
      return { id: "vivid", tip: "On most misses you picked the more vivid color. Strength can pass for light: before you tap, ask which one would be lighter in a black-and-white photo.", fix: { viv: 1 }, fixWhat: "3 rounds where the vivid one is darker" };
  }
  if (k === "memory") {
    const m = miss.filter(t => t.s && t.s.dC != null);
    if (m.length >= 3 && gyShare(m, t => t.s.dC > 1) >= .7)
      return { id: "vivid", tip: "Your wrong picks were more vivid than the color you saw. Memory drifts toward the typical version of a color, so when two look right, take the quieter one.", fix: { mute: 1 }, fixWhat: "3 rounds of quieter colors" };
    if (m.length >= 3 && gyShare(m, t => t.s.dL > 1) >= .7)
      return { id: "light", tip: "Your wrong picks were lighter than the color you saw. When two look right, take the darker one.", fix: {}, fixWhat: "3 more rounds" };
    if (m.length >= 3 && gyShare(m, t => t.s.dL < -1) >= .7)
      return { id: "dark", tip: "Your wrong picks were darker than the color you saw. When two look right, take the lighter one.", fix: {}, fixWhat: "3 more rounds" };
  }
  if (k === "neutral") {
    const a = sig.filter(t => t.s.err > 1.5).slice(-8);
    if (a.length >= 3) {
      const tw = gyShare(a, t => t.s.tw > 0);
      const grounds = a.map(t => t.s.gH);
      if (tw >= .75) return { id: "toward", tip: "Your greys lean toward the ground's own color: you add it back to cancel the cast the ground throws. On a colored ground true grey keeps a faint tint of the opposite color, so stop before the square looks perfectly neutral.", fix: { grounds }, fixWhat: "3 rounds on the same grounds" };
      if (tw <= .25) return { id: "away", tip: "Your greys lean away from the ground, into its opposite. Glance at the square, then at the black of the screen edge, and lock when it matches that neutrality.", fix: { grounds }, fixWhat: "3 rounds on the same grounds" };
      const warm = gyShare(a, t => t.s.warm > 0);
      if (warm >= .75) return { id: "warm", tip: "Your greys come out warm, a little yellow or red. Before you lock, slide toward cool until the square just tips blue, then come back halfway.", fix: { grounds }, fixWhat: "3 rounds on the same grounds" };
      if (warm <= .25) return { id: "cool", tip: "Your greys come out cool, a little blue or green. Before you lock, slide toward warm until the square just tips yellow, then come back halfway.", fix: { grounds }, fixWhat: "3 rounds on the same grounds" };
    }
  }
  if (k === "vanish") {
    const a = sig.filter(t => Math.abs(t.s.dL) > 2).slice(-8);
    if (a.length >= 3 && gyShare(a, t => t.s.dL > 0) >= .75) return { id: "light", tip: "Your discs land lighter than the ground. Squint until the colors blur, then slide darker until the edge is hardest to find.", fix: { hues: a.map(t => t.s.H) }, fixWhat: "3 rounds with the same colors" };
    if (a.length >= 3 && gyShare(a, t => t.s.dL < 0) >= .75) return { id: "dark", tip: "Your discs land darker than the ground. Squint until the colors blur, then slide lighter until the edge is hardest to find.", fix: { hues: a.map(t => t.s.H) }, fixWhat: "3 rounds with the same colors" };
  }
  if (k === "match") {
    const a = sig.filter(t => Math.abs(t.s.dL) > 1.5).slice(-8);
    if (a.length >= 3 && gyShare(a, t => t.s.dL * t.s.gd > 0) >= .75)
      return { id: "ground", tip: "Your square followed its ground: lighter on a light ground, darker on a dark one, because the ground pushes how the square looks the other way. Aim a step against the ground's pull.", fix: { ground: 2 }, fixWhat: "3 rounds on high-contrast grounds" };
  }
  if (k === "hue" || k === "order" || k === "squint" || k === "memory" || k === "value" || k === "shade") {
    const out = recent.filter(t => t.s && t.s.out);
    if (out.length >= 3) return { id: "time", tip: `You ran out of time on ${out.length} recent rounds. Sweep in a fixed order, row by row, instead of waiting for the odd one to jump out.`, fix: {}, fixWhat: "3 more rounds" };
  }
  // fallback: misses bunched in one band
  const w = weakBand(trials.slice(-30), Infinity, { dims: k === "squint" ? ["l", "c"] : ["f", "l", "c"] });
  if (w && w.miss >= 3) {
    const how = { hue: "compare tiles two at a time, row by row", order: "compare each swatch only with its two neighbors", squint: "squint harder and compare two spots at a time", memory: "name the color to yourself while you look", value: "squint so the hue fades and only light is left", shade: "squint so the strength fades and only light is left" }[k] || "slow down on those";
    return { id: "band", tip: `Most of your misses were ${bandLabel(w).toLowerCase()}. On those, ${how}.`, fix: { want: { dim: w.dim, val: w.val } }, fixWhat: `3 rounds of ${bandLabel(w).toLowerCase()}` };
  }
  return null;
}

// ---------- unlocks ----------
const mixUnlocked = (m, lvOf) => MIXES[m].ks.filter(k => lvOf(k) >= MIXES[m].need).length >= 2;
const squintUnlocked = lvOf => SQUINT_NEEDS.ks.every(k => lvOf(k) >= SQUINT_NEEDS.lv);

if (typeof module !== "undefined") module.exports = {
  SKILLS, SHELVES, MIXES, SQUINT_NEEDS, GY_DIALS, levelFor, scoreAt, geoMean, STAIR_DOWN, STAIR_UP, stairTarget, stairNext,
  dialPlan, dialNews, dialNewsBetween, dialUnlocks, lBand, cBand, FAM_HUES, bandLabel, weakBand, weakLine, calib, calibLine,
  GY_GAPS, GY_GAPS_MAINT, nextDue, CI_LADDER, CI_LADDER_2, ciLadder, CI_PLAN, ciLevel, WEAK_Z, weekOf, checkinDue, checkinPick, inMaintenance, suggestPick,
  detectPattern, mixUnlocked, squintUnlocked,
};
