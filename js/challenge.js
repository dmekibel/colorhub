"use strict";
// The daily challenge: six rounds of "which tile is different?", the same for everyone on a given day,
// each round harder than the last. One try a day, then a score grid you can share (Wordle-style).

const CH_LEVELS = [8, 5, 3.5, 2.5, 1.7, 1.2];
const CH_START = "2026-10-07";
const chNumber = (k = today()) => { const [a, b] = [CH_START, k].map(x => { const [y, m, d] = x.split("-").map(Number); return Date.UTC(y, m - 1, d); }); return Math.round((b - a) / 864e5) + 1; };
// a small seeded generator (mulberry32), so every phone builds the same six rounds
const seededRnd = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

function challengeRounds(k = today()) {
  const rnd = seededRnd(hash("challenge" + k));
  return CH_LEVELS.map(d => {
    const base = ALL[Math.floor(rnd() * ALL.length)], L0 = tame(lab(base.h));
    const odd = offset(L0, d, [.6, 1, 1], rnd) || offset(tame(L0.map((x, i) => i ? x * .8 : x)), d, [.6, 1, 1], rnd) || L0;
    const n = d > 6 ? 3 : d > 2.5 ? 4 : 5;
    return { d, base: labHex(...L0), odd: labHex(...odd), n, at: Math.floor(rnd() * n * n), fam: family(base.h) };
  });
}
const chState = () => (S.challenge = S.challenge || {});
const chToday = () => chState()[today()];
function chStreak() {
  let k = today(), n = 0;
  if (!chState()[k]) k = addDays(k, -1);
  while (chState()[k]) { n++; k = addDays(k, -1); }
  return n;
}
// the hardest round you got right, as a color difference
const chSharpest = hits => { let s = null; hits.forEach((h, i) => { if (h) s = CH_LEVELS[i]; }); return s; };

// the Gym's top card: today's six base colors, filled in once you've played
function challengeCard() {
  const r = challengeRounds(), done = chToday();
  return `<button class="ch-card${done ? " done" : ""}" data-challenge>
    <span class="ch-top"><span class="eyebrow">Daily · No. ${chNumber()}</span><span class="eyebrow">${chStreak() ? `${chStreak()}-day streak` : "Same for everyone"}</span></span>
    <span class="ch-row">${r.map((x, i) => `<i style="--c:${x.base}" class="${done ? (done.hits[i] ? "hit" : "miss") : ""}"></i>`).join("")}</span>
    <span class="ch-foot"><b>${done ? `${done.hits.filter(Boolean).length} of 6${chSharpest(done.hits) ? ` · you saw ${fmt(chSharpest(done.hits))} ΔE` : ""}` : "Six tiles, each one harder to spot"}</b>${done ? "<em>Share</em>" : ICON.arrow}</span>
  </button>`;
}

function challenge() {
  if (chToday()) return challengeDone();
  const rounds = challengeRounds(), hits = [];
  let i = 0;
  const el = show(`
    <header class="deck-top">
      <button class="icon-btn" data-close aria-label="Close">${ICON.x}</button>
      <div class="segs">${rounds.map(() => `<i style="--c:var(--ink)"></i>`).join("")}</div>
      <span class="left mono" id="lvl"></span>
    </header>
    <div class="drill-head"><p class="eyebrow" id="ey"></p><h2>Which tile is different?</h2></div>
    <div class="drill-stage" id="dstage"></div>
    <div class="drill-foot" id="dfoot"></div>
  `, "fixed drill drill-hue");
  // leaving early still counts as played (one try a day), with the rounds not reached as misses
  const quit = () => { if (hits.length) { while (hits.length < 6) hits.push(false); finish(); } else go("gym"); };
  el.querySelector("[data-close]").onclick = quit;
  onKey = e => { if (e.key === "Escape") quit(); };
  const stage = el.querySelector("#dstage"), foot = el.querySelector("#dfoot"), segs = el.querySelectorAll(".segs i");
  const finish = () => { chState()[today()] = { hits: hits.slice(0, 6) }; save(); challengeDone(true); };
  const round = () => {
    if (i >= rounds.length) return finish();
    const r = rounds[i], cells = r.n * r.n;
    el.querySelector("#ey").textContent = `Round ${i + 1} of 6 · ${fmt(r.d)} ΔE`;
    el.querySelector("#lvl").textContent = fmt(r.d);
    foot.innerHTML = "";
    stage.innerHTML = `<div class="grid" style="--n:${r.n}">${Array.from({ length: cells }, (_, j) => `<button class="tile" data-i="${j}" style="--c:${j === r.at ? r.odd : r.base}" aria-label="Tile ${j + 1}"></button>`).join("")}</div>`;
    let done = false;
    stage.querySelectorAll(".tile").forEach(t => t.onclick = () => {
      if (done) return; done = true;
      const ok = +t.dataset.i === r.at;
      stage.querySelector(`[data-i="${r.at}"]`).classList.add("ring");
      if (!ok) { t.classList.add("miss"); foot.innerHTML = `<p class="note">This one was off by <b>${fmt(de2000(r.base, r.odd))}</b></p>`; }
      hits.push(ok);
      segs[i].classList.add("on"); segs[i].style.setProperty("--c", ok ? "var(--good)" : "var(--bad)");
      buzz(ok ? 10 : [10, 40, 10]);
      i++; later(round, ok ? 520 : 1200);
    });
  };
  round();
}

function challengeDone(fresh) {
  const st = chToday(), rounds = challengeRounds(), got = st.hits.filter(Boolean).length, sharp = chSharpest(st.hits);
  const verdict = got === 6 ? "A perfect <em>eye.</em>" : got >= 4 ? "Sharp <em>eyes.</em>" : got >= 2 ? "Good <em>start.</em>" : "Tough <em>one.</em>";
  const el = show(`
    <div style="flex:1"></div>
    <p class="eyebrow">Daily challenge · No. ${chNumber()}</p>
    <h1>${verdict}</h1>
    <div class="ch-grid">${rounds.map((r, i) => `<span class="${st.hits[i] ? "hit" : "miss"}"><i style="--c:${r.base}"></i><em class="mono">${fmt(r.d)}</em></span>`).join("")}</div>
    <p class="lede">${got} of 6 right.${sharp ? ` The smallest difference you spotted was <b>${fmt(sharp)} ΔE</b>; about 1 is the limit for most people side by side.` : " Every round shrinks the difference, so the last ones are hard for anyone."} ${chStreak() > 1 ? `${chStreak()} days in a row.` : ""} A new set comes tomorrow.</p>
    <div class="stack"><button class="btn" data-share>Share your grid ${ICON.share}</button>
    <button class="btn ghost" data-home>Back to the Gym</button></div>
  `, "result");
  el.querySelector("[data-home]").onclick = () => go("gym");
  el.querySelector("[data-share]").onclick = () => shareChallenge(st.hits, sharp);
  if (fresh) buzz(got >= 4 ? [12, 60, 12] : 10);
}

function shareChallenge(hits, sharp) {
  const text = `ColorHub daily No. ${chNumber()}\n${hits.map(h => h ? "🟩" : "⬛").join("")} ${hits.filter(Boolean).length}/6${sharp ? ` · saw ${fmt(sharp)} ΔE` : ""}`;
  const url = location.origin + location.pathname;
  if (navigator.share) return navigator.share({ text, url }).catch(() => {});
  try { navigator.clipboard.writeText(text + "\n" + url); toast("Copied your grid"); } catch (e) {}
}

// ======================================================================
// Your eye over time: every drill's score history as a chart, plus the challenge record.
// Smaller differences = sharper. Scores bounce from day to day, so the copy points at the trend.
// ======================================================================
const FAM_HEX = { Reds: "#C8323C", Oranges: "#E07B39", Browns: "#8B5A3C", Yellows: "#E0C040", Greens: "#3E9A5C", Blues: "#3C6FC8", Purples: "#7E4FB0", Pinks: "#E58BB0", Greys: "#8C8C88" };
function eyeChart(hist, unit) {
  // one point per day (the day's last score), on a log scale so a drop from 4 to 2 looks like 2 to 1
  const byDay = new Map(); hist.forEach(([d, v]) => byDay.set(d, v));
  const pts = [...byDay.entries()];
  if (pts.length < 2) return `<p class="x-sub">Train on two different days to see a trend.</p>`;
  const W = 320, H = 120, P = 14, vs = pts.map(p => Math.log(p[1])), lo = Math.min(...vs), hi = Math.max(...vs), span = hi - lo || 1;
  const xy = pts.map((p, i) => [P + i / (pts.length - 1) * (W - 2 * P), P + (hi - Math.log(p[1])) / span * (H - 2 * P)]);
  // y is flipped: sharper (smaller) is higher
  const yy = xy.map(([x, y]) => [x, H - y]);
  const line = yy.map(p => p.map(v => v.toFixed(1)).join(",")).join(" ");
  const first = pts[0][1], last = pts[pts.length - 1][1], gain = Math.round((1 - last / first) * 100);
  return `<svg class="eye-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><polyline points="${line}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>${yy.map(([x, y], i) => i === 0 || i === yy.length - 1 ? `<circle cx="${x}" cy="${y}" r="3.2" fill="currentColor"/>` : "").join("")}</svg>
    <div class="eye-ends"><span>${pts[0][0] ? esc(String(pts[0][0]).slice(5)) + " · " : ""}<b>${fmt(first)}</b> ${esc(unit)}</span><span><b>${fmt(last)}</b> ${esc(unit)}${pts[pts.length - 1][0] ? " · " + esc(String(pts[pts.length - 1][0]).slice(5)) : ""}</span></div>
    <p class="eye-gain">${gain > 0 ? `You now see differences ${gain}% smaller than when you started` : gain < 0 ? "A little behind your start today. That's normal: watch the trend over weeks." : "About where you started"}</p>`;
}
function eyeReport() {
  const ch = Object.entries(chState()).sort((a, b) => a[0].localeCompare(b[0]));
  const fam = skillState("hue").fam, famE = Object.entries(fam);
  const famMax = Math.max(...famE.map(f => f[1]), 1);
  const el = show(`
    <header class="art-top"><button class="icon-btn glass" data-back aria-label="Back">${ICON.back}</button><span class="eyebrow">Gym · Your eye</span><span style="width:44px"></span></header>
    <p class="eyebrow kick">Progress</p>
    <h1 class="tab-title">Your <em>eye</em></h1>
    <p class="x-sub">Each chart is the smallest difference you could see, day by day. Higher on the chart means sharper.</p>
    ${Object.entries(SKILLS).map(([k, sk]) => { const st = skillState(k); return `<section class="eye-sec"><div class="sec-head"><b>${esc(sk.name)}</b><span>${st.best != null ? `best ${fmt(st.best)} ${esc(sk.unit)}` : "not tried yet"}</span></div>${st.hist.length ? eyeChart(st.hist, sk.unit) : `<p class="x-sub">Not tried yet.</p>`}</section>`; }).join("")}
    ${famE.length ? `<section class="eye-sec"><div class="sec-head"><b>By color family</b><span>odd one out · shorter is sharper</span></div>
      <div class="eye-fams">${famE.sort((a, b) => a[1] - b[1]).map(([f, v]) => `<div><span>${esc(f)}</span><i style="--c:${FAM_HEX[f] || "#888"};--w:${(v / famMax * 100).toFixed(0)}%"></i><b class="mono">${fmt(v)}</b></div>`).join("")}</div>
      <p class="x-sub">Most people see smaller differences in some families than others. Your weakest family is where practice pays most.</p></section>` : ""}
    <section class="eye-sec"><div class="sec-head"><b>Daily challenge</b><span>${ch.length ? `${ch.length} played · ${chStreak()}-day streak` : "not played yet"}</span></div>
      ${ch.length ? `<div class="eye-ch">${ch.slice(-28).map(([d, v]) => `<span title="${esc(d)}">${v.hits.map(h => `<i class="${h ? "hit" : ""}"></i>`).join("")}</span>`).join("")}</div>` : `<p class="x-sub">Six tiles a day, the same for everyone.</p>`}</section>
    <p class="fine">Practice sharpens these particular judgments. It isn't a claim about general brain training.</p>
  `, "article gym-eye");
  el.querySelector("[data-back]").onclick = () => go("gym");
}
