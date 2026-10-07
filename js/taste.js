"use strict";
// Taste tests: "Find your color" and "Find your palette". About twenty "which do you prefer?" taps train the taste
// engine in js/tastemodel.js, which also picks each next pair. Results: a taste map, your color and your least
// favorite (named), dials, a palette maker tuned to you, and the painters closest to your taste. Gym calls tasteIntro(kind).

const FAV_SEEDS = ["Crimson", "Coral", "Tangerine", "Gold", "Lime", "Emerald", "Teal", "Sky blue", "Cobalt", "Indigo", "Violet", "Magenta", "Baby pink", "Rust", "Sage", "Charcoal"];   // Explore's tile uses these too
const TZ_N = 20;
const tzMean = a => a.reduce((s, v) => s + v, 0) / Math.max(a.length, 1);
function tzCorr(x, y) { const mx = tzMean(x), my = tzMean(y); let a = 0, b = 0, c = 0; x.forEach((v, i) => { a += (v - mx) * (y[i] - my); b += (v - mx) ** 2; c += (y[i] - my) ** 2; }); return b && c ? a / Math.sqrt(b * c) : 0; }
const tzPct = (sorted, v) => { let lo = 0, hi = sorted.length; while (lo < hi) { const m = (lo + hi) >> 1; if (sorted[m] < v) lo = m + 1; else hi = m; } return lo / sorted.length; };
const tzRound = (a, d = 3) => a.map(v => Array.isArray(v) ? tzRound(v, d) : +v.toFixed(d));
// the most precise name for a color (nameOf(), ROADMAP §13's one naming system), plus the nearest taught word
function tzNamed(h) {
  const nm = nameOf(h), [pair] = nearestColors(h, 1), isApp = !!BYNAME.get(nm.n.toLowerCase());
  return { h, n: nm.text, src: isApp ? "ColorHub" : (nm.near[0] && srcLine(nm.near[0].entry)) || "Nearest name", d: nm.de, word: pair ? pair[0].n : nm.n, wordD: pair ? pair[1] : 0 };
}
const tzOrder = p => p.shares.map((s, i) => i).sort((a, b) => p.shares[b] - p.shares[a]);
const tzStrip = (p, cls = "tz-strip") => `<span class="${cls}">${tzOrder(p).map(i => `<i style="--c:${p.cols[i]};flex:${Math.max(p.shares[i], .012).toFixed(3)}"></i>`).join("")}</span>`;
const TZ_MOVE = { contrast: ["less contrast", "more contrast"], vivid: ["more muted color", "more vivid color"], warm: ["cooler hues", "warmer hues"], spread: ["fewer hues", "a wider hue spread"], count: ["fewer colors", "more colors"], dom: ["an even split", "one dominant field"] };
const TZ_ASK = { contrast: "contrast", vivid: "vividness", warm: "warmth", spread: "hue spread", count: "number of colors", dom: "proportions" };

function tasteIntro(kind) {
  const isPal = kind === "palette", T = TASTE, last = S.taste && S.taste[kind];
  const prev = isPal ? Array.from({ length: 6 }, (_, i) => T.genPalette(T.DIALS.map(() => (Math.random() - .5) * 3), (Math.random() * 1e9) | 0))
    : FAV_SEEDS.map(n => BYNAME.get(n.toLowerCase())).filter(Boolean);
  const el = show(`
    <header class="deck-top"><button class="icon-btn" data-close aria-label="Close">${ICON.x}</button><span class="eyebrow" style="flex:1">A taste test · about ${TZ_N} taps</span></header>
    <div class="tz-prev${isPal ? " tz-pals" : ""}">${isPal ? prev.map(p => tzStrip(p)).join("") : prev.map((c, k) => `<i style="--c:${c.h};--k:${k}"></i>`).join("")}</div>
    <p class="eyebrow tz-kick">${TZ_N} quick choices</p>
    <h1 class="t-title">Find your <em>${isPal ? "palette" : "color"}</em></h1>
    <p class="tab-sub">${isPal ? "Tap the palette you'd rather live with. Most pairs change just one thing, so your taps add up to six dials, a palette maker tuned to you, and the painters nearest your taste."
      : "Tap the color you like more. Each tap teaches a small model of your taste, and it picks the next pair to learn the most. You get a map of your taste, your color, and your least favorite."}</p>
    <button class="btn" data-go>Begin ${ICON.arrow}</button>
    ${last ? `<button class="btn ghost" data-last>See your last result · ${esc(last.at)}</button>` : ""}
  `, "taste tz-intro");
  el.querySelector("[data-close]").onclick = () => go("studio");
  el.querySelector("[data-go]").onclick = () => tasteRun(kind);
  const lb = el.querySelector("[data-last]"); if (lb) lb.onclick = () => tzReopen(kind);
}
function tzReopen(kind) {
  const r = S.taste[kind], m = { mu: r.mu, S: r.S, n: TZ_N };
  loadCoreNames().then(() => kind === "palette" ? tzPalResult(m, true) : tzColorResult(m, true));
}
const tasteRun = kind => kind === "palette" ? tzPalRun() : tzColorRun();

// ---------- the duel screen (shared) ----------
function tzDuel(total) {
  const el = show(`
    <header class="deck-top"><button class="icon-btn" data-close aria-label="Close">${ICON.x}</button><div class="segs" id="tsegs">${"<i></i>".repeat(total)}</div><span class="left mono" id="tleft"></span></header>
    <div class="tz-q"><p class="eyebrow" id="tlabel"></p><h2 id="tq"></h2></div>
    <div class="tz-duel" id="tduel"></div>
    <div class="tz-alt"><button data-alt="both">Both</button><i></i><button data-alt="neither">Neither</button></div>
  `, "fixed tz-run");
  el.querySelector("[data-close]").onclick = () => go("studio");
  const $ = s => el.querySelector(s), duel = $("#tduel"), segs = $("#tsegs");
  let done = 0, locked = true, cb = null, cols = null;
  const answer = k => {
    if (locked) return; locked = true; buzz(k === 0 || k === 1 ? 8 : [6, 40, 6]);
    const opts = duel.querySelectorAll(".tz-opt");
    if (k === 0 || k === 1) { opts[k].classList.add("win"); opts[1 - k].classList.add("lose"); }
    else opts.forEach(o => o.classList.add(k === "both" ? "both" : "none"));
    const seg = segs.children[done++]; if (seg) { seg.style.setProperty("--c", k === 0 || k === 1 ? cols[k] : "var(--soft)"); seg.classList.add("on"); }
    later(() => cb(k), reduceMotion ? 120 : 380);
  };
  duel.addEventListener("click", e => { const b = e.target.closest(".tz-opt"); if (b) answer(+b.dataset.k); });
  el.querySelectorAll("[data-alt]").forEach(b => b.onclick = () => answer(b.dataset.alt));
  onKey = e => { const k = { ArrowUp: 0, "1": 0, ArrowDown: 1, "2": 1, b: "both", n: "neither" }[e.key]; if (k !== undefined) answer(k); };
  return {
    ask(a, b, label, q, ab, onPick) {
      $("#tlabel").textContent = label; $("#tq").textContent = q; $("#tleft").textContent = `${done + 1}/${total}`;
      duel.innerHTML = `<button class="tz-opt" data-k="0" aria-label="The first">${a}</button><button class="tz-opt" data-k="1" aria-label="The second">${b}</button>`;
      cols = ab; cb = onPick; locked = false;
    },
  };
}

// ======================================================================
// Find your color
// ======================================================================
function tzColorRun() {
  const T = TASTE, pool = T.colorPool(), m = T.model(T.COLOR_PRIOR), recent = [];
  const ref = pool[0].x.map((_, i) => tzMean(pool.map(p => p.x[i])));
  const D = tzDuel(TZ_N);
  let t = 0;
  const step = () => {
    if (t >= TZ_N) return loadCoreNames().then(() => tzColorResult(m));
    const [a, b] = T.nextPair(m, pool, { skip: new Set(recent), ok: (a, b) => de2000(a.h, b.h) > (t < 8 ? 18 : 10) });
    const face = c => `<span class="tz-plate" style="--c:${c.h}"></span>`;
    D.ask(face(a), face(b), t < 6 ? "Sketching your taste" : t < 14 ? "Testing the edges" : "Fine-tuning", "Which color do you like more?", [a.h, b.h], k => {
      T.choose(m, a.x, b.x, k, ref); t++;
      recent.push(a, b); if (recent.length > 6) recent.splice(0, 2);
      step();
    });
  };
  step();
}

// Hue regions in CIE LCh degrees, for the plain-words reading of the map
const TZ_REGIONS = [["reds", 20, 50], ["oranges", 50, 80], ["yellows", 80, 108], ["yellow-greens", 108, 130], ["greens", 130, 170], ["teals", 170, 215], ["blues", 215, 300], ["violets", 300, 318], ["purples", 318, 340], ["pinks", 340, 380]];
const TZ_LABELS = [["red", 35], ["orange", 65], ["yellow", 95], ["green", 145], ["teal", 192], ["blue", 260], ["violet", 310], ["pink", 355]];
// everything the color results need from a model
function tzColorRead(m) {
  const T = TASTE, grid = T.colorGrid(), us = grid.map(g => T.utility(m, g.x));
  const lo = Math.min(...us), hi = Math.max(...us), norm = u => hi > lo ? (u - lo) / (hi - lo) : .5;
  const { top, low } = T.extremes(m, grid);
  const bins = [];
  for (let H = 0; H < 360; H += 5) bins.push({ H, best: null, u: -Infinity });
  // each hue is scored by its best clearly-colored version (60% of full strength or more), so greys don't flatten the wheel
  grid.forEach((g, i) => { if (g.f < .6) return; const b = bins[g.gH / 5]; if (us[i] > b.u) { b.u = us[i]; b.best = g; } });
  const blo = Math.min(...bins.map(b => b.u)), bhi = Math.max(...bins.map(b => b.u));
  bins.forEach(b => { b.n = bhi > blo ? (b.u - blo) / (bhi - blo) : .5; });
  const regions = TZ_REGIONS.map(([name, a, z]) => { const bs = bins.filter(b => (b.H >= a && b.H < z) || (b.H + 360 >= a && b.H + 360 < z)); return { name, a, z, s: tzMean(bs.map(b => b.n)) }; });
  return { grid, us, sorted: us.slice().sort((a, b) => a - b), lo, hi, norm, top, low, bins, regions };
}
// "You lean toward deep blues to teals, and steer clear of yellow-greens."
function tzReading(R) {
  const span = R.hi - R.lo, top = R.top;
  if (span < 1.2) return "Your choices came out close to even: no part of the wheel stood out strongly. Read the map below as a light sketch.";
  if (top.C < 8) return `You lean toward greys and quiet neutrals${top.L < 45 ? ", on the dark side" : top.L > 75 ? ", on the light side" : ""}, over strong hues.`;
  const rs = R.regions, bi = rs.reduce((b, r, i) => r.s > rs[b].s ? i : b, 0), best = rs[bi].s, n = rs.length;
  // grow the favorite region into neighbors that score almost as high (at most three regions)
  const picked = [bi]; let a = bi, z = bi;
  for (let k = 0; k < 2; k++) {
    const c = [[(a - 1 + n) % n, "a"], [(z + 1) % n, "z"]].filter(([i]) => !picked.includes(i) && rs[i].s >= best - .07).sort((p, q) => rs[q[0]].s - rs[p[0]].s)[0];
    if (!c) break; picked.push(c[0]); if (c[1] === "a") a = c[0]; else z = c[0];
  }
  const range = a === z ? rs[a].name : `${rs[a].name} to ${rs[z].name}`;
  const adj = [top.L < 42 ? "deep" : top.L > 76 ? "pale" : "", top.f <= .4 ? "soft" : top.f >= .8 ? "vivid" : ""].filter(Boolean).join(", ");
  const worst = rs.reduce((w, r) => r.s < w.s ? r : w, rs[0]);
  const verb = span > 4 ? "You love" : "You lean toward";
  return `${verb} ${adj ? adj + " " : ""}${range}${worst.s > .62 ? ", and like most hues well enough" : `, and steer clear of ${worst.name}`}.`;
}
// the hue rose: one petal per 5 degrees of hue, as long as you like that hue, painted with your best color there
function tzDrawRose(x, R, cx, cy, rad, labels = true) {
  const r0 = rad * .2, k = Math.PI / 180;
  x.strokeStyle = "rgba(236,232,223,.13)"; x.lineWidth = Math.max(1, rad / 260);
  [r0, rad * .6, rad].forEach(r => { x.beginPath(); x.arc(cx, cy, r, 0, 2 * Math.PI); x.stroke(); });
  R.bins.forEach(b => {
    if (!b.best) return;
    const r = r0 + (rad - r0) * (.06 + .94 * b.n), a0 = -(b.H + 2.6) * k, a1 = -(b.H - 2.6) * k;
    x.fillStyle = b.best.h; x.beginPath(); x.moveTo(cx + r0 * Math.cos(a0), cy + r0 * Math.sin(a0)); x.arc(cx, cy, r, a0, a1); x.arc(cx, cy, r0, a1, a0, true); x.closePath(); x.fill();
  });
  if (!labels) return;
  x.fillStyle = "#9A958A"; x.font = `500 ${Math.round(rad / 15)}px 'Geist Mono', monospace`; x.textAlign = "center"; x.textBaseline = "middle";
  TZ_LABELS.forEach(([t, H]) => { const r = rad * 1.15; x.fillText(t.toUpperCase(), cx + r * Math.cos(-H * k), cy + r * Math.sin(-H * k)); });
}
function tzRoseCanvas(R, size) {
  const dpr = Math.min(devicePixelRatio || 1, 2), cv = document.createElement("canvas");
  cv.width = cv.height = size * dpr; cv.style.width = cv.style.height = size + "px"; cv.className = "tz-rose";
  tzDrawRose(cv.getContext("2d"), R, size * dpr / 2, size * dpr / 2, size * dpr * .37);
  return cv;
}
// lightness x strength at one hue: each cell as big as you like it
function tzLC(R, H) {
  const cells = R.grid.map((g, i) => [g, R.us[i]]).filter(([g]) => g.f && g.gH === H && (g.gL - 26) % 8 === 0);
  const Ls = [...new Set(cells.map(([g]) => g.gL))].sort((a, b) => b - a), us = cells.map(c => c[1]), lo = Math.min(...us), hi = Math.max(...us);
  const at = (L, f) => cells.find(([g]) => g.gL === L && g.f === f);
  return `<div class="tz-lc"><span class="tz-ax-y">Lighter</span><div class="tz-lc-grid">${Ls.map(L => [.2, .4, .6, .8, 1].map(f => {
    const c = at(L, f); if (!c) return "<i></i>";
    const s = hi > lo ? (c[1] - lo) / (hi - lo) : .5;
    return `<i style="--c:${c[0].h};--s:${(.28 + .72 * s).toFixed(2)}"${c[0] === R.top ? ' class="me"' : ""}></i>`;
  }).join("")).join("")}</div><span class="tz-ax-x">Stronger →</span></div>`;
}

// Associations for the "why" step (Palmer & Schloss 2010, ecological valence theory). v: how most people feel about the thing.
const TZ_WHY = [["sky", "Sky", 1], ["sea", "Sea or water", 1], ["plants", "Plants", 1], ["food", "Fruit or food", 1], ["flowers", "Flowers", 1], ["mud", "Dirt or mud", -1], ["rot", "Rot or mold", -1], ["skin", "Skin", 0], ["metal", "Metal or stone", 0], ["brand", "A brand or team", 0], ["nothing", "Nothing much", 0]];
function tzWhyLine(which, key, name) {
  const [, label, v] = TZ_WHY.find(w => w[0] === key), thing = label.toLowerCase(), top = which === "top";
  if (key === "nothing") return { fit: null, t: `${name} doesn't call anything up for you. The theory explains a good share of average taste, not all of anyone's.` };
  if (key === "brand") return { fit: null, t: `${name} makes you think of a brand or team. Loyalties move taste: in one study, Berkeley and Stanford students each liked their own school's colors more (Schloss and colleagues, 2011).` };
  if (!v) return { fit: null, t: `${name} reminds you of ${thing}, which people feel mixed about, so it's down to how ${thing} strikes you.` };
  const fit = top ? v > 0 : v < 0;
  if (fit) return { fit, t: `${name} reminds you of ${thing}, which most people ${v > 0 ? "like" : "dislike"}. That's the pattern the theory predicts: we tend to ${top ? "like" : "dislike"} the colors of things we ${top ? "like" : "dislike"}.` };
  return { fit, t: `${name} reminds you of ${thing}, yet you ${top ? "like" : "dislike"} it. The theory runs on how you feel about the things, not how most people do: if ${thing} ${top ? "means something good to you, it still fits" : "isn't a favorite of yours, it still fits"}.` };
}

function tzColorResult(m, reopen) {
  const T = TASTE, R = tzColorRead(m), top = tzNamed(R.top.h), low = tzNamed(R.low.h);
  S.taste = S.taste || {};
  const prevRec = S.taste.color;
  if (!reopen) {
    const hist = prevRec ? [{ at: prevRec.at, mu: prevRec.mu, top: prevRec.top }, ...(prevRec.hist || [])].slice(0, 8) : [];
    S.taste.color = { at: today(), mu: tzRound(m.mu), S: tzRound(m.S, 4), top: { h: top.h, n: top.n }, low: { h: low.h, n: low.n }, why: {}, hist };
    S.fav = { h: top.h, n: top.word, name: top.n, at: today() };
    save();
  }
  const rec = S.taste.color, why = rec.why || (rec.why = {});
  const reading = tzReading(R);
  const plate = (x, label, cls) => `<div class="tz-pick ${cls}"><span class="tz-pick-c" style="--c:${x.h}" data-swatch="${x.h}" data-ink="${ink(x.h)}"><span class="eyebrow">${label}</span></span>
    <b>${esc(x.n)}</b><small>${esc(x.src)}</small><span class="mono">${x.h}</span>${x.n !== x.word ? `<button class="tz-word" data-word="${esc(x.word)}">your word: ${esc(x.word)}</button>` : `<button class="tz-word" data-word="${esc(x.word)}">read about it</button>`}</div>`;
  // you vs most people: two well-studied reference colors, placed on this person's own map
  const blue = T.hexItem("#2A5DB0"), olive = T.hexItem("#4A412A");
  const pb = tzPct(R.sorted, T.utility(m, blue.x)), po = tzPct(R.sorted, T.utility(m, olive.x)), P = v => Math.round(v * 100);
  const blueLine = pb >= .7 ? `Like most people, you rank it high: above ${P(pb)}% of the colors on your map.` : pb <= .4 ? `Unlike most people, you rank it low: above only ${P(pb)}% of the colors on your map.` : `You're lukewarm on it: it sits above ${P(pb)}% of the colors on your map.`;
  const oliveLine = po <= .3 ? `Like most people, you put it near the bottom: below ${100 - P(po)}% of the colors on your map.` : po >= .6 ? `Unlike most people, you rather like it: above ${P(po)}% of the colors on your map.` : `You're neutral on it: it sits above ${P(po)}% of the colors on your map.`;
  // how your taste moved since last time
  const before = (rec.hist || [])[0];
  let moved = "";
  if (before && before.mu && before.mu.length === m.mu.length) {
    const r = tzCorr(R.us, R.grid.map(g => T.dot(before.mu, g.x)));
    moved = `<div class="sec-head"><b>How your taste moved</b><span>since ${esc(before.at)}</span></div>
      <div class="tz-moved"><i style="--c:${before.top.h}"></i><span>${ICON.arrow}</span><i style="--c:${top.h}"></i></div>
      <p class="p-body">Last time your color was ${esc(before.top.n)}; now it's ${esc(top.n)}. Your two maps are ${r > .8 ? "very alike" : r > .5 ? "alike" : r > .2 ? "somewhat alike" : "quite different"} (correlation ${r.toFixed(2).replace("-", "−")}, where 1 is the same taste and 0 unrelated). Taste moves with mood, season and what you've been looking at.</p>`;
  }
  const whyBlock = (which, x) => `<div class="tz-why" data-which="${which}"><p><i style="--c:${x.h}"></i>What does <b>${esc(x.n)}</b> remind you of?</p>
    <div class="tz-opts">${TZ_WHY.map(([k, l]) => `<button data-k="${k}" class="${why[which] === k ? "on" : ""}">${l}</button>`).join("")}</div></div>`;
  const el = show(`
    <header class="art-top"><button class="icon-btn glass" data-close aria-label="Close">${ICON.x}</button><button class="glass-pill" data-share>${ICON.share}<span>Share</span></button></header>
    <p class="eyebrow tz-kick">Your taste map · ${m.n || TZ_N} choices</p>
    <h1 class="tz-reading">${esc(reading)}</h1>
    <div class="tz-map" id="map"></div>
    <p class="fine tz-cap">Each petal is one hue on a perceptual wheel (CIE LCh): the longer it is, the more you like that hue, painted in your favorite strong shade of it.</p>
    <div class="tz-picks">${plate(top, "Your color", "top")}${plate(low, "Least favorite", "low")}</div>
    <div class="sec-head"><b>Around your color</b><span>lightness × strength</span></div>
    ${tzLC(R, R.top.f ? R.top.gH : R.bins.reduce((b, x) => x.n > b.n ? x : b).H)}
    <p class="fine">The bigger the square, the more you like it. Your color is ringed.</p>
    <div class="sec-head"><b>Why these two?</b><span>optional</span></div>
    <p class="p-body">${linkText("One well-tested idea, the ecological valence theory (Palmer and Schloss, 2010), says we tend to like the colors of things we like, such as clear skies and clean water, and dislike the colors of things we don't, such as rot. In their study it explained about 80% of the differences in average preference across 32 colors.")}</p>
    ${whyBlock("top", top)}${whyBlock("low", low)}
    <div id="whyout"></div>
    <div class="sec-head"><b>You and most people</b><span>on your map</span></div>
    <div class="tz-vs"><i style="--c:${blue.h}"></i><p><b>A strong blue.</b> In studies across many countries, blue comes out the most liked hue on average (Palmer and Schloss, 2010, among others). ${blueLine}</p></div>
    <div class="tz-vs"><i style="--c:${olive.h}"></i><p><b>Pantone 448 C</b>, a dark olive brown. Australia picked it for plain cigarette packs in 2012 after market research found it the least appealing, and dark yellows and olives sit near the bottom in preference studies too. ${oliveLine}</p></div>
    <p class="fine">Percentiles are against the ${R.grid.length.toLocaleString()} colors on your own map, not a population survey. Pantone and hex values are screen approximations.</p>
    ${moved}
    <div class="stack" style="margin-top:28px">
      <button class="btn" data-again>Take it again ${ICON.arrow}</button>
      <button class="btn" data-pal>Find your palette ${ICON.arrow}</button>
    </div>
    <p class="fine">How it works: a Bradley-Terry choice model over hue, lightness and strength, updated after each tap; each next pair is the one it was least sure about. Your color is the one it's most confident you like. Screens vary, and taste shifts with mood and context, so try again another day.</p>
  `, "article tz-res");
  wireLinks(el);
  const map = el.querySelector("#map"); map.appendChild(tzRoseCanvas(R, Math.min(map.clientWidth || 346, 380)));
  el.querySelector("[data-close]").onclick = () => go("studio");
  el.querySelector("[data-again]").onclick = () => tasteRun("color");
  el.querySelector("[data-pal]").onclick = () => tasteIntro("palette");
  el.querySelectorAll("[data-word]").forEach(b => b.onclick = () => { const n = graph().resolve(b.dataset.word); if (n) closeup(n); });
  el.querySelector("[data-share]").onclick = () => tzShareColor(R, top, low, reading);
  const out = el.querySelector("#whyout");
  const explain = () => {
    const lines = [["top", top], ["low", low]].filter(([w]) => why[w]).map(([w, x]) => tzWhyLine(w, why[w], x.n));
    if (!lines.length) { out.innerHTML = ""; return; }
    const fits = lines.filter(l => l.fit === true).length, misses = lines.filter(l => l.fit === false).length;
    const verdict = lines.length < 2 ? "" : fits === 2 ? "Both fit the theory." : misses === 2 ? "Neither fits the theory neatly, which is fine: associations are one part of taste, not all of it." : fits === 1 && !misses ? "One fits the theory; the other is down to something else." : "";
    out.innerHTML = `<div class="tz-whyout">${lines.map(l => `<p>${esc(l.t)}</p>`).join("")}${verdict ? `<p class="tz-verdict">${verdict}</p>` : ""}</div>`;
  };
  el.querySelectorAll(".tz-why").forEach(box => box.addEventListener("click", e => {
    const b = e.target.closest("[data-k]"); if (!b) return;
    why[box.dataset.which] = b.dataset.k; save(); buzz(6);
    box.querySelectorAll("[data-k]").forEach(x => x.classList.toggle("on", x === b));
    explain();
  }));
  explain();
}

// ======================================================================
// Find your palette
// ======================================================================
function tzPalRun() {
  const T = TASTE, m = T.model(T.PAL_PRIOR), asked = [], zero = T.palFeat(T.DIALS.map(() => 0));
  const D = tzDuel(TZ_N);
  const step = () => {
    if (asked.length >= TZ_N) return loadCoreNames().then(() => tzPalResult(m));
    const { k, pair: [a, b] } = T.nextPalPair(m, asked), dial = T.DIALS[k].k, prop = dial === "dom";
    D.ask(tzStrip(a), tzStrip(b), prop ? "Proportion round · same colors" : `What changes: ${TZ_ASK[dial]}`,
      prop ? "Which mix would you rather live with?" : "Which palette would you rather live with?", [a.cols[0], b.cols[0]], pick => {
        asked.push(k); T.choose(m, a.x, b.x, pick, zero); step();
      });
  };
  step();
}
// load the art-history statistics only when needed (data/stats.js, ~180 KB)
let TZ_STATS = null;
function tasteStats() {
  if (window.STATS) return Promise.resolve(window.STATS);
  return TZ_STATS || (TZ_STATS = new Promise(done => { const s = document.createElement("script"); s.src = "data/stats.js"; s.onload = s.onerror = () => done(window.STATS || null); document.head.appendChild(s); }));
}
// painting pages and museum painters, ranked by distance from your dials (weighted by how much each dial matters to you)
function tzPainters(read, stats) {
  const T = TASTE, w = read.map(r => clamp(r.strength, .15, 3)), g = graph();
  const dist = (z, dims) => Math.sqrt(dims.reduce((s, k) => s + w[k] * (clamp(z[k], -2.5, 2.5) - read[k].z) ** 2, 0) / dims.reduce((s, k) => s + w[k], 0));
  const paintings = [...g.nodes.values()].filter(n => n.kind === "painting" && !n.stub && n.palette && n.palette.length > 2).map(n => {
    const p = T.palItem(n.palette.map(c => c.h), n.palette.map(c => c.share));
    return { n, p, d: dist(p.z, [0, 1, 2, 3, 5]) };
  }).sort((a, b) => a.d - b.d);
  const artists = ((stats && stats.byArtist) || []).filter(a => a.top && a.top.length > 2).map(a => {
    const p = T.palItem(a.top.map(c => c.h), a.top.map(c => c.share));
    return { a, p, d: dist(p.z, [0, 1, 2, 3]) };
  }).sort((x, y) => x.d - y.d);
  return { paintings: paintings.slice(0, 3), artists: artists.slice(0, 3) };
}
const tzDialText = r => {
  if (r.strength < .45) return "no strong pull";
  if (r.k === "count") return `${clamp(Math.round(TASTE.fromZ(4, r.z)), 3, 8)} colors`;
  return r.z < -.6 ? r.lo : r.z > .6 ? r.hi : "in between";
};
function tzPalResult(m, reopen) {
  const T = TASTE, read = T.dialRead(m), ideal = read.map(r => r.z);
  S.taste = S.taste || {};
  const prevRec = S.taste.palette;
  let pal = T.genPalette(ideal, (Math.random() * 1e9) | 0);
  if (!reopen) {
    const hist = prevRec ? [{ at: prevRec.at, mu: prevRec.mu, dials: prevRec.dials }, ...(prevRec.hist || [])].slice(0, 8) : [];
    S.taste.palette = { at: today(), mu: tzRound(m.mu), S: tzRound(m.S, 4), dials: tzRound(ideal, 2), hist };
    S.palettes = S.palettes || [];
    if (!S.palettes.some(p => p.cols.join() === pal.cols.join())) { S.palettes.unshift({ cols: tzOrder(pal).map(i => pal.cols[i]), from: "Find your palette", at: today() }); S.palettes = S.palettes.slice(0, 60); }
    save();
  }
  const rec = S.taste.palette, before = (rec.hist || [])[0];
  const dialRow = (r, k) => {
    const x = clamp((r.z + 2) / 4, 0, 1) * 100, was = before && before.dials ? clamp((before.dials[k] + 2) / 4, 0, 1) * 100 : null;
    return `<div class="tz-dial ${r.strength < .45 ? "weak" : ""}"><div class="tz-dial-top"><b>${r.name}</b><em>${esc(tzDialText(r))}</em></div>
      <div class="tz-track">${was != null ? `<s style="left:${was.toFixed(1)}%"></s>` : ""}<i style="left:${x.toFixed(1)}%"></i></div><div class="tz-ends"><span>${r.lo}</span><span>${r.hi}</span></div></div>`;
  };
  const names = () => tzOrder(pal).map(i => { const x = tzNamed(pal.cols[i]); return `<button class="tz-name" data-copy="${x.h}"><i style="--c:${x.h}" data-swatch="${x.h}"></i><b>${esc(x.n)}</b><small>${Math.round(pal.shares[i] * 100)}% · ${esc(x.src)}</small><em class="mono">${x.h}</em></button>`; }).join("");
  const movedWords = before && before.dials ? read.map((r, k) => { const d = r.z - before.dials[k]; if (Math.abs(d) < .5) return null; return TZ_MOVE[r.k][d > 0 ? 1 : 0]; }).filter(Boolean) : null;
  const el = show(`
    <header class="art-top"><button class="icon-btn glass" data-close aria-label="Close">${ICON.x}</button><button class="glass-pill" data-share>${ICON.share}<span>Share</span></button></header>
    <p class="eyebrow tz-kick">Your palette · ${m.n || TZ_N} choices</p>
    <h1 class="t-title tz-ptitle">Made to <em>your</em> dials</h1>
    <div id="hero">${tzStrip(pal, "tz-hero")}</div>
    <div class="tz-names" id="names">${names()}</div>
    <div class="tz-row"><button class="btn" data-shuffle>Shuffle ${ICON.arrow}</button><button class="btn" data-keep>Keep</button></div>
    <div class="sec-head"><b>Your six dials</b><span>${before ? "ring = last time" : "from your choices"}</span></div>
    <div class="tz-dials">${read.map(dialRow).join("")}</div>
    ${movedWords ? `<p class="p-body">${movedWords.length ? `Since ${esc(before.at)} you've moved toward ${movedWords.join(", ")}.` : `Since ${esc(before.at)} your dials have held steady.`}</p>` : ""}
    <div class="sec-head"><b>Your painters</b><span>closest on your dials</span></div>
    <div id="painters"><p class="fine">Measuring the paintings…</p></div>
    <div class="stack" style="margin-top:28px">
      <button class="btn" data-master>Spot the master <small>bonus</small></button>
      <button class="btn" data-again>Take it again ${ICON.arrow}</button>
    </div>
    <p class="fine">How it works: each pair mostly changed one thing (contrast, vividness, warmth, hue spread, number of colors or proportions). A choice model learns how much of each you like best; the dot is that ideal, and a faded dial means your choices didn't lean either way. Tap a color to copy its code.</p>
  `, "article tz-res");
  wireLinks(el);
  el.querySelector("[data-close]").onclick = () => go("studio");
  el.querySelector("[data-again]").onclick = () => tasteRun("palette");
  el.querySelector("[data-master]").onclick = () => tzMaster();
  el.querySelector("[data-shuffle]").onclick = () => {
    pal = T.genPalette(ideal, (Math.random() * 1e9) | 0); buzz(6);
    el.querySelector("#hero").innerHTML = tzStrip(pal, "tz-hero"); el.querySelector("#names").innerHTML = names();
  };
  el.querySelector("[data-keep]").onclick = () => keepPalette(tzOrder(pal).map(i => pal.cols[i]), "Find your palette");
  el.querySelector("#names").addEventListener("click", e => { const b = e.target.closest("[data-copy]"); if (b) { try { navigator.clipboard.writeText(b.dataset.copy); toast("Copied " + b.dataset.copy); } catch (x) {} } });
  let best = null;
  el.querySelector("[data-share]").onclick = () => tzSharePal(pal, read, best);
  tasteStats().then(stats => {
    const box = el.querySelector("#painters"); if (!box) return;
    const { paintings, artists } = tzPainters(read, stats);
    best = paintings[0] ? `${paintings[0].n.artist}, ${paintings[0].n.title}` : null;
    box.innerHTML = paintings.map(({ n, p }) => `<button class="tz-ptg" data-node="${esc(n.id)}">${tzStrip(p)}<span><b>${esc(n.title)}</b><small>${esc(n.artist)}${n.year ? " · " + esc(n.year) : ""}</small></span>${ICON.chev}</button>`).join("")
      + (artists.length ? `<p class="eyebrow tz-sub">In two museums' collections</p>${artists.map(({ a, p }) => `<div class="tz-ptg"><span class="tz-strip">${tzOrder(p).map(i => `<i style="--c:${p.cols[i]};flex:${p.shares[i].toFixed(3)}"></i>`).join("")}</span><span><b>${esc(a.key)}</b><small>average of ${a.n} paintings${a.years ? ` · ${a.years[0] === a.years[1] ? a.years[0] : a.years.join("–")}` : ""}</small></span></div>`).join("")}
        <p class="fine">Painter averages come from ${stats.meta.count.toLocaleString()} public-domain paintings at the Art Institute of Chicago and the Cleveland Museum of Art, measured from photos. Old varnish yellows and darkens pictures, so older painters read browner than they painted.</p>` : "");
  });
}

// ---------- Spot the master: a real painting's palette or a look-alike? ----------
// The look-alike keeps the painting's lightnesses and proportions but turns every hue the same way and nudges strength.
function tzMaster() {
  const T = TASTE, ptgs = shuffle([...graph().nodes.values()].filter(n => n.kind === "painting" && !n.stub && n.palette && n.palette.length > 2)).slice(0, 5);
  if (!ptgs.length) return toast("Paintings are still loading");
  let i = 0, score = 0;
  const fake = n => {
    const turn = (Math.random() < .5 ? -1 : 1) * (40 + Math.random() * 50), k = .8 + Math.random() * .45;
    return T.palItem(n.palette.map(c => { const [L, C, H] = lch(c.h), h2 = (H + turn + 360) % 360; return T.lchToHex(L, Math.min(C * k, T.maxC(L, h2)), h2); }), n.palette.map(c => c.share));
  };
  const round = () => {
    if (i >= ptgs.length) return done();
    const n = ptgs[i], real = T.palItem(n.palette.map(c => c.h), n.palette.map(c => c.share)), alt = fake(n), realFirst = Math.random() < .5;
    const [a, b] = realFirst ? [real, alt] : [alt, real];
    const el = show(`
      <header class="deck-top"><button class="icon-btn" data-close aria-label="Close">${ICON.x}</button><div class="segs">${ptgs.map((_, j) => `<i class="${j < i ? "on" : ""}" style="--c:var(--ink)"></i>`).join("")}</div><span class="left mono">${i + 1}/${ptgs.length}</span></header>
      <div class="tz-q"><p class="eyebrow">Spot the master</p><h2>Which palette is the real painting?</h2></div>
      <div class="tz-duel"><button class="tz-opt" data-k="0">${tzStrip(a)}</button><button class="tz-opt" data-k="1">${tzStrip(b)}</button></div>
      <div class="tz-reveal" id="rev"></div>
    `, "fixed tz-run");
    el.querySelector("[data-close]").onclick = () => tasteIntro("palette");
    let locked = false;
    el.querySelectorAll(".tz-opt").forEach(btn => btn.onclick = () => {
      if (locked) return; locked = true;
      const k = +btn.dataset.k, right = (k === 0) === realFirst; if (right) score++;
      buzz(right ? 10 : [8, 60, 8]);
      el.querySelectorAll(".tz-opt").forEach((o, j) => { o.classList.add((j === 0) === realFirst ? "real" : "lose"); });
      el.querySelector("#rev").innerHTML = `<p><b>${right ? "Right." : "Not quite."}</b> The real one is ${esc(n.title)}, ${esc(n.artist)}${n.year ? `, ${esc(n.year)}` : ""}. The other keeps its lights, darks and proportions but turns every hue.</p><button class="btn" data-next>${i + 1 < ptgs.length ? "Next" : "See your score"} ${ICON.arrow}</button>`;
      el.querySelector("[data-next]").onclick = () => { i++; round(); };
    });
  };
  const done = () => {
    const el = show(`
      <header class="art-top"><button class="icon-btn glass" data-close aria-label="Close">${ICON.x}</button><span class="eyebrow">Spot the master</span><span style="width:44px"></span></header>
      <p class="eyebrow tz-kick">Your score</p>
      <h1 class="t-title">${score} <em>of</em> ${ptgs.length}</h1>
      <p class="tab-sub">${score >= 4 ? "A good eye for how painters put color together." : score >= 2 ? "Harder than it looks: the fakes share every lightness and proportion." : "The fakes are sly: same lights, darks and proportions, only the hues turned."}</p>
      <div class="sec-head"><b>The paintings</b><span>tap to read</span></div>
      ${ptgs.map(n => `<button class="tz-ptg" data-node="${esc(n.id)}">${tzStrip(T.palItem(n.palette.map(c => c.h), n.palette.map(c => c.share)))}<span><b>${esc(n.title)}</b><small>${esc(n.artist)}</small></span>${ICON.chev}</button>`).join("")}
      <div class="stack" style="margin-top:26px"><button class="btn" data-again>Play again ${ICON.arrow}</button></div>
    `, "article tz-res");
    wireLinks(el);
    el.querySelector("[data-close]").onclick = () => go("studio");
    el.querySelector("[data-again]").onclick = () => tzMaster();
  };
  round();
}

// ---------- share cards (1080 x 1350) ----------
function tzShareCanvas(draw, file, text, url) {
  const cv = document.createElement("canvas"); cv.width = 1080; cv.height = 1350;
  const x = cv.getContext("2d"); x.fillStyle = "#0E0D0B"; x.fillRect(0, 0, 1080, 1350);
  // the card's fonts may not be on the page yet (the italic serif especially)
  const fonts = document.fonts ? Promise.all(["400 40px 'Instrument Serif'", "italic 400 40px 'Instrument Serif'", "500 24px 'Geist Mono'"].map(f => document.fonts.load(f))).catch(() => {}) : Promise.resolve();
  fonts.then(() => { draw(x); cv.toBlob(async blob => {
    const f = new File([blob], file, { type: "image/png" });
    try { if (navigator.canShare && navigator.canShare({ files: [f] })) return await navigator.share({ files: [f], text, url }); } catch (e) { if (e && e.name === "AbortError") return; }
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = file; a.click(); toast("Saved the card");
  }, "image/png"); });
}
function tzWrap(x, text, maxW) { const words = text.split(" "), lines = []; let cur = ""; words.forEach(w => { const t = cur ? cur + " " + w : w; if (x.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }); if (cur) lines.push(cur); return lines; }
function tzShareColor(R, top, low, reading) {
  tzShareCanvas(x => {
    tzDrawRose(x, R, 540, 400, 300);
    x.fillStyle = "#9A958A"; x.font = "500 26px 'Geist Mono', monospace"; x.textAlign = "left"; x.textBaseline = "alphabetic"; x.fillText("MY TASTE IN COLOR · COLORHUB", 72, 800);
    x.fillStyle = top.h; x.fillRect(72, 840, 150, 150); x.fillStyle = low.h; x.fillRect(72, 1010, 150, 150);
    x.fillStyle = "#ECE8DF"; x.font = "400 76px 'Instrument Serif', Georgia, serif"; x.fillText(top.n, 252, 930);
    x.fillStyle = "#9A958A"; x.font = "500 24px 'Geist Mono', monospace"; x.fillText(`MY COLOR · ${top.h}`, 256, 975);
    x.fillStyle = "#CFC9BC"; x.font = "400 52px 'Instrument Serif', Georgia, serif"; x.fillText(low.n, 252, 1090);
    x.fillStyle = "#9A958A"; x.font = "500 24px 'Geist Mono', monospace"; x.fillText(`LEAST FAVORITE · ${low.h}`, 256, 1135);
    x.fillStyle = "#CFC9BC"; x.font = "italic 400 40px 'Instrument Serif', Georgia, serif";
    tzWrap(x, reading, 936).slice(0, 2).forEach((l, i) => x.fillText(l, 72, 1225 + i * 48));
  }, "colorhub-my-color.png", `My color: ${top.n}`, routeURL("taste/color"));
}
function tzSharePal(pal, read, painter) {
  tzShareCanvas(x => {
    let at = 72; tzOrder(pal).forEach(i => { const w = pal.shares[i] * 936; x.fillStyle = pal.cols[i]; x.fillRect(at, 72, Math.ceil(w), 560); at += w; });
    x.fillStyle = "#9A958A"; x.font = "500 26px 'Geist Mono', monospace"; x.fillText("MY PALETTE · COLORHUB", 72, 700);
    read.forEach((r, k) => {
      const y = 770 + k * 74; x.fillStyle = "#ECE8DF"; x.font = "500 22px 'Geist Mono', monospace"; x.fillText(r.name.toUpperCase(), 72, y);
      x.fillStyle = "#9A958A"; x.textAlign = "right"; x.fillText(tzDialText(r).toUpperCase(), 1008, y); x.textAlign = "left";
      x.fillStyle = "rgba(236,232,223,.35)"; x.fillRect(72, y + 22, 936, 2);
      x.fillStyle = r.strength < .45 ? "#5F5B53" : "#ECE8DF"; x.beginPath(); x.arc(72 + clamp((r.z + 2) / 4, 0, 1) * 936, y + 23, 11, 0, 2 * Math.PI); x.fill();
    });
    if (painter) { x.fillStyle = "#CFC9BC"; x.font = "italic 400 42px 'Instrument Serif', Georgia, serif"; tzWrap(x, `Closest painting: ${painter}`, 936).slice(0, 2).forEach((l, i) => x.fillText(l, 72, 1250 + i * 50)); }
  }, "colorhub-my-palette.png", "My palette", routeURL("taste/palette"));
}

// ---------- screenshot mode (boot.js #shot=taste:...): a simulated person answers, in memory only ----------
function tasteShot(arg = "intro-color") {
  const [what, kind = "color"] = arg.split("-"), T = TASTE;
  if (what === "intro") return tasteIntro(kind);
  if (what === "run") return tasteRun(kind);
  if (what === "master") return tzMaster();
  let seed = 3; const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  if (kind === "color") {
    const pool = T.colorPool(), m = T.model(T.COLOR_PRIOR), ref = pool[0].x.map((_, i) => tzMean(pool.map(p => p.x[i])));
    const u = c => { const s = Math.min(1, c.C / 30), b = (H, at, w) => Math.exp(-((T.hueDist(H, at) / w) ** 2)); return 3.4 * b(c.H, 225, 45) * s - 2.2 * b(c.H, 105, 30) * s - ((c.L - 42) / 22) ** 2; };
    for (let t = 0; t < TZ_N; t++) { const [a, b] = T.nextPair(m, pool, { rand, ok: (a, b) => de2000(a.h, b.h) > 12 }); T.choose(m, a.x, b.x, rand() < T.sig(u(a) - u(b)) ? 0 : 1, ref); }
    if (what === "moved") S.taste = { color: { at: "2026-09-30", mu: T.COLOR_PRIOR.map((_, i) => [.8, .2, 0, .3, .1, -.2, .5, 0, 0, 0][i]), top: { h: "#C8553D", n: "Terra cotta" } } };
    if (what === "why") { S.taste = { color: { at: today(), mu: m.mu, S: m.S, top: {}, low: {}, why: { top: "sea", low: "mud" }, hist: [] } }; return loadCoreNames().then(() => tzColorResult(m, true)); }
    return loadCoreNames().then(() => tzColorResult(m));
  }
  const m = T.model(T.PAL_PRIOR), asked = [], zero = T.palFeat(T.DIALS.map(() => 0)), ideal = [1.1, -.9, .8, -.6, 0, 1.2];
  const u = p => -p.z.reduce((s, z, k) => s + (clamp(z, -2.5, 2.5) - ideal[k]) ** 2, 0) / 2;
  if (what === "moved") S.taste = { palette: { at: "2026-09-30", mu: [], dials: [-.6, .9, -.4, .5, 1, -.3] } };
  for (let t = 0; t < TZ_N; t++) { const { k, pair: [a, b] } = T.nextPalPair(m, asked, rand); asked.push(k); T.choose(m, a.x, b.x, rand() < T.sig(u(a) - u(b)) ? 0 : 1, zero); }
  return loadCoreNames().then(() => tzPalResult(m));
}
