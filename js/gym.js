"use strict";
// Gym tab: train the judgments painters make. Every drill is a staircase: get it right and the next
// difference is smaller, miss and it grows, so each skill settles near the smallest difference you
// can see (about 70% right). Practice sharpens the trained judgment; the copy promises nothing more
// (learning-kb anti-claim: brain-training gains stay in the trained task).

const SKILLS = {
  hue:   { name: "Odd one out", what: "Find the tile that's slightly off", unit: "ΔE", start: 12, floor: .5, trials: 10 },
  order: { name: "Sort the strip", what: "Put close colors in order", unit: "ΔE step", start: 9, floor: .6, trials: 3 },
  temp:  { name: "Warmer or cooler", what: "Which of two colors is warmer?", unit: "ΔE", start: 14, floor: .6, trials: 10 },
  value: { name: "Lighter or darker", what: "Which of two colors is lighter?", unit: "ΔL*", start: 14, floor: .5, trials: 10 },
};
const skillState = k => S.gym.skills[k] || (S.gym.skills[k] = { level: SKILLS[k].start, best: null, hist: [], fam: {} });
const fmt = d => d >= 10 ? d.toFixed(0) : d.toFixed(1);

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
const metColors = () => { const m = ALL.filter(c => S.cards[c.id]); return m.length >= 6 ? m : ALL; };

// Move a color by roughly `d` CIEDE2000 in a random direction, staying on screen.
// dir weights let a drill choose lightness-only or chroma-only moves.
function offset(baseLab, d, w = [.6, 1, 1]) {
  for (let tries = 0; tries < 24; tries++) {
    let v = [w[0] * (Math.random() * 2 - 1), w[1] * (Math.random() * 2 - 1), w[2] * (Math.random() * 2 - 1)];
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

// ---------- staircase bookkeeping ----------
function makeStair(k) {
  const st = skillState(k), sk = SKILLS[k];
  return {
    d: st.level || sk.start, log: [],
    step(ok) { this.log.push(this.d); this.d = clamp(ok ? this.d * .8 : this.d * 1.5, sk.floor, 40); },
    // Estimate = geometric mean of the last few levels you worked at.
    estimate() { const t = this.log.slice(-6); return t.length ? Math.exp(t.reduce((s, x) => s + Math.log(x), 0) / t.length) : this.d; },
  };
}
function record(k, stair, famHits) {
  const st = skillState(k), est = stair.estimate(), before = st.hist.length ? st.hist[st.hist.length - 1][1] : null;
  st.level = stair.d;
  st.hist.push([today(), +est.toFixed(2)]); st.hist = st.hist.slice(-60);
  const pb = st.best == null || est < st.best;
  if (pb) st.best = +est.toFixed(2);
  if (famHits) for (const [f, v] of Object.entries(famHits)) st.fam[f] = +v.toFixed(2);
  save();
  return { k, est, before, pb };
}

// ======================================================================
// Gym home
// ======================================================================
const WORKOUTS = [["hue", "temp", "order"], ["hue", "value", "order"], ["hue", "temp", "value"]];
const todaysWorkout = () => { const [y, m, d] = today().split("-").map(Number); return WORKOUTS[Math.floor(Date.UTC(y, m - 1, d) / 864e5) % WORKOUTS.length]; };

function spark(hist) {
  const v = hist.slice(-14).map(x => x[1]);
  if (v.length < 2) return "";
  const lo = Math.min(...v), hi = Math.max(...v), w = 84, h = 26;
  const pts = v.map((x, i) => `${(i / (v.length - 1) * w).toFixed(1)},${(hi === lo ? h / 2 : (x - lo) / (hi - lo) * (h - 4) + 2).toFixed(1)}`).join(" ");
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}

// ---------- previews: every drill and every score is shown in color, not just as a number ----------
function gymBase(k) { const pool = metColors(); return pool[hash(today() + k) % pool.length]; }
// two colors exactly d apart, the way the drill tests them (the seam between them is your limit)
function limitPair(k, d) {
  if (k === "value") { const H = lch(gymBase(k).h)[2]; return [lchHex(58 + d / 2, 28, H), lchHex(58 - d / 2, 28, (H + 140) % 360)]; }
  if (k === "temp") {
    const L0 = [62, 2, 4], w = [0, .5, .866]; let kk = d / 2;
    for (let i = 0; i < 6; i++) { const got = de2000(L0.map((x, j) => x + w[j] * kk), L0.map((x, j) => x - w[j] * kk)); if (got) kk *= d / got; }
    return [labHex(...L0.map((x, j) => x + w[j] * kk)), labHex(...L0.map((x, j) => x - w[j] * kk))];
  }
  const A = tame(lab(gymBase(k).h)), B = offset(A, d) || A;
  return [labHex(...A), labHex(...B)];
}
function drillPreview(k) {
  const d = Math.max(skillState(k).level || SKILLS[k].start, 5);
  if (k === "hue") { const [a, b] = limitPair("hue", d), odd = hash(today()) % 9; return `<span class="pv pv-hue">${Array.from({ length: 9 }, (_, i) => `<i style="--c:${i === odd ? b : a}"${i === odd ? ' class="odd"' : ""}></i>`).join("")}</span>`; }
  if (k === "temp") { const [a, b] = limitPair("temp", d * 1.6); return `<span class="pv pv-temp"><i style="--c:${a}"></i><i style="--c:${b}"></i></span>`; }
  if (k === "value") { const [a, b] = limitPair("value", d * 2); return `<span class="pv pv-value"><i style="--c:${a}"></i><i style="--c:${b}"></i></span>`; }
  const A = tame(lab(gymBase("order").h)), B = offset(A, d * 6, [.5, 1, 1]) || A;
  const steps = Array.from({ length: 7 }, (_, i) => labHex(...A.map((x, j) => x + (B[j] - x) * i / 6)));
  [steps[3], steps[4]] = [steps[4], steps[3]];
  return `<span class="pv pv-order">${steps.map((h, i) => `<i style="--c:${h}"${i === 3 || i === 4 ? ' class="odd"' : ""}></i>`).join("")}</span>`;
}

function gymHome() {
  const wk = todaysWorkout(), done = !!S.gym.workouts[today()];
  const limits = Object.entries(SKILLS).map(([k, sk]) => {
    const st = skillState(k), last = st.hist.length ? st.hist[st.hist.length - 1][1] : null, d = last == null ? sk.start : last;
    const [a, b] = limitPair(k, d);
    return `<button class="limit" data-drill="${k}">
      <span class="lp"><i style="--c:${a}"></i><i style="--c:${b}"></i><em data-ink="${ink(a)}">${last == null ? `Starting gap · ${fmt(d)} ${esc(sk.unit)}` : `Your limit · ${fmt(d)} ${esc(sk.unit)}`}</em></span>
      <span class="lrow"><span class="nm"><b>${esc(sk.name)}</b><span>${st.best != null ? `best ${fmt(st.best)} ${esc(sk.unit)}` : "not tried yet"}</span></span>
        <span class="val">${last == null ? "—" : `<b data-count="${fmt(last)}">${fmt(last)}</b>`}</span>${spark(st.hist) || "<span></span>"}</span>
    </button>`;
  }).join("");
  const fam = skillState("hue").fam, famRow = Object.keys(fam).length
    ? `<div class="fams">${Object.entries(fam).sort((a, b) => a[1] - b[1]).map(([f, v]) => `<span><b>${fmt(v)}</b> ${esc(f)}</span>`).join("")}</div>` : "";
  const el = show(`
    <header class="bar"><div class="brand">${LOGO}<span>ColorHub</span></div><span class="eyebrow">Eye training</span></header>
    <p class="eyebrow kick">${done ? "Done today — again if you like" : "Today's workout — three drills, two minutes"}</p>
    <h1 class="tab-title">The <em>Gym</em></h1>
    <div class="workout ${done ? "done" : ""}">
      <ol class="wk-list">${wk.map((k, i) => `<li>${drillPreview(k)}<span class="wk-txt"><span>${pad2(i + 1)} — ${k === "order" ? "3 strips" : "10 rounds"}</span><b>${esc(SKILLS[k].name)}</b><small>${esc(SKILLS[k].what)}</small></span></li>`).join("")}</ol>
      <button class="btn" data-workout>${done ? "Train again" : "Begin the workout"} ${ICON.arrow}</button>
    </div>
    <div class="sec-head"><b>Your eye</b><span>smaller is sharper</span></div>
    ${S.profile && ["red-green", "blue-yellow"].includes(S.profile.cvd) ? `<p class="x-sub" style="margin-top:12px">Drills are tuned for ${S.profile.cvd} color blindness: differences lean on lightness and the colors you see best.</p>` : ""}
    <p class="x-sub limit-note">Each plate is split at your current limit: the smallest difference you can still see. Can you find the seam?</p>
    <div class="limits">${limits}</div>
    ${famRow ? `<div class="sec-head"><b>Odd one out, by family</b><span>ΔE</span></div>${famRow}` : ""}
    <div class="sec-head"><b>Play</b></div>
    <button class="play-row" data-taste="color"><span><b>Find your color</b><span>Sixteen colors, head to head, then an eye exam for your taste.</span></span><em>${S.fav ? esc(S.fav.n) + "-ish" : "new"}</em></button>
    <button class="play-row" data-taste="palette"><span><b>Find your palette</b><span>Paintings and harmonies, head to head.</span></span><em>${(S.palettes || []).length ? S.palettes.length + " saved" : "new"}</em></button>
    <button class="play-row" data-lightning><span><b>Lightning round</b><span>Forty-five seconds. Name as many as you can.</span></span><em class="lt-best">${S.best.lightning ? `<b>${S.best.lightning}</b>best` : "new"}</em></button>
    <p class="fine">Scores are color differences: ΔE (CIEDE2000), and ΔL* for lightness. About 1 is the smallest difference most people can see side by side. Practice sharpens these judgments; it isn't a brain-training claim.</p>
  `, "gym", "gym");
  el.querySelector("[data-workout]").onclick = () => workout(wk);
  el.querySelectorAll("[data-drill]").forEach(b => b.onclick = () => runDrill(b.dataset.drill, { trials: SKILLS[b.dataset.drill].trials + 4, done: r => drillDone([r]) }));
  el.querySelector("[data-lightning]").onclick = lightning;
  el.querySelectorAll("[data-taste]").forEach(b => b.onclick = () => tasteIntro(b.dataset.taste));
}

function workout(list) {
  const results = [];
  const next = i => {
    if (i >= list.length) { S.gym.workouts[today()] = true; save(); return drillDone(results, true); }
    runDrill(list[i], { trials: SKILLS[list[i]].trials, step: [i + 1, list.length], done: r => { results.push(r); next(i + 1); } });
  };
  next(0);
}

function drillDone(results, isWorkout) {
  const el = show(`
    <div style="flex:1"></div>
    <p class="eyebrow">${isWorkout ? "Workout done" : "Drill done"}</p>
    <h1>${results.some(r => r.pb) ? "New personal <em>best.</em>" : "Eyes <em>trained.</em>"}</h1>
    <div class="res-list">${results.map(r => `<div class="res">
      <span>${esc(SKILLS[r.k].name)}</span>
      <b class="mono">${r.before != null ? fmt(r.before) + " → " : ""}${fmt(r.est)} <small>${esc(SKILLS[r.k].unit)}</small></b>
      ${r.pb ? '<em>best</em>' : ""}</div>`).join("")}</div>
    <p class="lede">Smaller numbers mean you saw smaller differences. Scores move around from day to day; the trend over weeks is what counts.</p>
    <button class="btn" data-home>Back to the Gym</button>
  `, "result");
  el.querySelector("[data-home]").onclick = () => go("gym");
  onKey = e => { if (e.key === "Enter") go("gym"); };
}

// ======================================================================
// Drill runner: a top bar with progress, then one of the four drills.
// ======================================================================
function runDrill(k, opts) {
  const stair = makeStair(k), total = opts.trials, famHits = {};
  let n = 0;
  const el = show(`
    <header class="deck-top">
      <button class="icon-btn" data-close aria-label="Close">${ICON.x}</button>
      <div class="segs">${Array.from({ length: total }, () => `<i style="--c:var(--ink)"></i>`).join("")}</div>
      <span class="left mono" id="lvl"></span>
    </header>
    <div class="drill-head"><p class="eyebrow">${opts.step ? `Drill ${opts.step[0]} of ${opts.step[1]} · ` : ""}${esc(SKILLS[k].name)}</p><h2 id="q"></h2></div>
    <div class="drill-stage" id="dstage"></div>
    <div class="drill-foot" id="dfoot"></div>
  `, `fixed drill drill-${k}`);
  el.querySelector("[data-close]").onclick = () => go("gym");
  onKey = e => { if (e.key === "Escape") go("gym"); };
  const stage = el.querySelector("#dstage"), foot = el.querySelector("#dfoot"), q = el.querySelector("#q"), lvl = el.querySelector("#lvl");
  const segs = el.querySelectorAll(".segs i");
  const ctx = { stage, foot, q, el };
  const answer = (ok, fam) => {
    if (fam) famHits[fam] = stair.d;
    stair.step(ok);
    segs[n].classList.add("on"); segs[n].style.setProperty("--c", ok ? "var(--yes)" : "var(--no)");
    buzz(ok ? 10 : [10, 40, 10]);
    n++;
    later(trial, ok ? 420 : 1100);
  };
  function trial() {
    if (n >= total) return opts.done(record(k, stair, k === "hue" ? famHits : null));
    lvl.textContent = fmt(stair.d);
    DRILLS[k](ctx, stair.d, answer);
  }
  trial();
}

const DRILLS = {
  // Odd one out: a grid of one color with one tile shifted by d.
  hue(ctx, d, answer) {
    const base = shuffle(metColors())[0], L0 = lab(base.h);
    const odd = offset(L0, d, cvdW([.6, 1, 1])) || offset(tame(L0.map((x, i) => i ? x * .8 : x)), d, cvdW([.6, 1, 1]));
    const baseHex = labHex(...L0), oddHex = odd ? labHex(...odd) : baseHex;
    const n = d > 6 ? 3 : d > 2.5 ? 4 : 5, cells = n * n, at = Math.random() * cells | 0;
    ctx.q.textContent = "Which tile is different?";
    ctx.foot.innerHTML = "";
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

  // Warmer or cooler: two near-identical colors split along the warm (orange) to cool (blue) axis.
  temp(ctx, d, answer) {
    const fromMet = Math.random() < .4;
    let L0 = fromMet ? lab(shuffle(metColors())[0].h) : [30 + Math.random() * 55, (Math.random() - .5) * 14, (Math.random() - .5) * 14];
    L0 = tame(L0);
    const w = [0, Math.cos(60 * Math.PI / 180), Math.sin(60 * Math.PI / 180)];
    let k = d / 2;
    for (let i = 0; i < 6; i++) { const got = de2000(L0.map((x, j) => x + w[j] * k), L0.map((x, j) => x - w[j] * k)); if (got) k *= d / got; }
    const warm = labHex(...tame(L0.map((x, j) => x + w[j] * k))), cool = labHex(...tame(L0.map((x, j) => x - w[j] * k)));
    const askWarm = Math.random() < .5, warmTop = Math.random() < .5;
    ctx.q.textContent = askWarm ? "Which is warmer?" : "Which is cooler?";
    pairQuestion(ctx, warmTop ? [warm, cool] : [cool, warm], (askWarm === warmTop) ? 0 : 1, answer, null);
  },

  // Lighter or darker: two different hues, different lightness (L*). Judging value across hue is the painter's skill.
  value(ctx, d, answer) {
    const H1 = Math.random() * 360, H2 = (H1 + 90 + Math.random() * 180) % 360, Lm = 35 + Math.random() * 35;
    const mk = (L, H) => { let C = 30 + Math.random() * 30; while (C > 4 && !inGamut(L, C * Math.cos(H * Math.PI / 180), C * Math.sin(H * Math.PI / 180))) C -= 2; return lchHex(L, C, H); };
    const a = mk(Lm + d / 2, H1), b = mk(Lm - d / 2, H2), lightTop = Math.random() < .5;
    ctx.q.textContent = "Which is lighter?";
    pairQuestion(ctx, lightTop ? [a, b] : [b, a], lightTop ? 0 : 1, answer, (x, y) => `Lightness ${lab(x)[0].toFixed(0)} vs ${lab(y)[0].toFixed(0)} (L*)`);
  },

  // Sort the strip: ends fixed, middle shuffled, drag into order.
  order(ctx, d, answer) {
    const n = 7, base = shuffle(metColors())[0], A = tame(lab(base.h));
    const B = offset(A, d * (n - 1), cvdW([.5, 1, 1])) || offset(tame(A.map((x, i) => i ? x * .7 : x)), d * (n - 1), cvdW([.5, 1, 1])) || [A[0] > 50 ? A[0] - 25 : A[0] + 25, A[1], A[2]];
    const steps = Array.from({ length: n }, (_, i) => labHex(...A.map((x, j) => x + (B[j] - x) * i / (n - 1))));
    let order = [0, ...shuffle([1, 2, 3, 4, 5]), 6];
    if (order.every((v, i) => v === i)) order = [0, 2, 1, 3, 5, 4, 6];
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
