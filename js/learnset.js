"use strict";
// Learn a set (design/LEARN-SET.md): the one sheet every "Learn" opens (prQuick hands over to lsOpen), with two
// phases always there: Look (nothing hidden, six views) and Study (the mixed, adaptive session, like Quizlet Learn).
//   lsOpen({ seed, items, label, back })   the sheet: live preview, a size slider and a closeness slider
//   lsLook(items, { label, view, back })    the Look screen
//   lsStudy(items, { label, back })         the mixed session, then its results
// Builds on js/practice.js (the PR_STEPS step contract, prRecord for the Learner Model and honest scheduling).

const LS_CLOSE = [["Twins", 2.5, "Very hard to tell apart"], ["Close", 5, "Easy to mix up"], ["Neighbors", 9, "Related, each its own"], ["Cousins", 14, "Same corner of the map"], ["Wide", 22, "A gentle tour"]];
const LS_VIEWS = [["grid", "Grid"], ["strip", "Strip"], ["pairs", "Pairs"], ["map", "Map"], ["art", "Paintings"], ["carousel", "Carousel"]];
const LS_INPLAY = 4;          // colors being worked on at once
const LS_MATCH_EVERY = 6;     // a Matching round after this many single questions
const LS_COMBO = [3, 5, 10, 15, 20, 30];
const lsState = () => { const p = prState(); return p.ls || (p.ls = { size: 10, close: 1, typing: true, view: "grid", best: {} }); };
const lsHexes = items => items.map(it => it.h).join("");
const lsSetKey = items => items.map(it => it.key).sort().join("|");
function lsExitTo(back) {
  return () => { if (typeof back === "function") back(); else if (back && /^#\/./.test(back)) { if (!openRoute(back)) go(S.tab || "learn"); } else go(S.tab || "learn"); };
}
// sound (js/sound.js): an explicit sfx in the same tick wins over the sound buzz() implies, so a moment keeps its haptic
const lsSfx = (fn, ...a) => { try { if (typeof window[fn] === "function") window[fn](...a); } catch (e) {} };
const lsOpenPage = it => { if (typeof openCoreName === "function") openCoreName(it.h, it.n); };
// a color and its look-alikes, every pair at least `gap` apart (ΔE2000), nearest first
function lsAlike(seed, n, gap) {
  const out = [seed], cand = prCore().filter(x => x.key !== seed.key && x.h !== seed.h).map(x => ({ x, d: de2000(seed.h, x.h) })).sort((a, b) => a.d - b.d);
  for (const o of cand) { if (out.length >= n) break; if (out.every(p => de2000(p.h, o.x.h) >= gap)) out.push(o.x); }
  return out;
}

// ======================================================================
// The sheet
// ======================================================================
function lsOpen(o = {}) {
  if (typeof CORE_NAMES !== "undefined" && !CORE_NAMES && typeof loadCoreNames === "function") return void loadCoreNames().then(() => lsOpen(o));
  const ls = lsState(), backTo = o.back || (typeof ROUTE_NOW !== "undefined" ? ROUTE_NOW : "");
  const seed = prSeed(o.seed), app = seed && seed.c && seed.c.unit ? seed.c : null;
  const these = prUnique((o.items || []).map(x => typeof x === "string" ? prItemOf(x) : prSeed(x)).filter(Boolean));
  const st = { from: these.length && !(seed && o.source === "alike") ? "these" : seed ? "alike" : "these", size: ls.size || 10, close: ls.close != null ? ls.close : 1 };
  if (!seed && !these.length) return toast("Nothing here to learn yet");
  const { sh, close } = sheet(`<div class="pr-quick ls-sheet">
    <div class="pr-qhead"><h2 class="pr-t2" data-qtitle></h2><span class="pr-note" data-qcount></span></div>
    <div class="ls-from" data-from></div>
    <div class="pr-plate ls-prev" data-prev></div>
    <p class="ls-names" data-names></p>
    <label class="ls-slide" data-sizerow><span class="ls-sl-t">How many</span><input type="range" min="3" step="1" data-size aria-label="How many colors"><b class="ls-sl-v" data-sizev></b></label>
    <label class="ls-slide" data-closerow><span class="ls-sl-t">How close</span><input type="range" min="0" max="${LS_CLOSE.length - 1}" step="1" data-closeness aria-label="How close the look-alikes are"><b class="ls-sl-v" data-closev></b></label>
    <p class="ls-closehint" data-closehint></p>
    <div class="ls-go" data-qgo><button class="ls-look" data-look>${LS_ICON.eye}<span>Look</span></button>${prPrimary("Study", "", "data-go")}</div>
    <label class="ls-typing"><input type="checkbox" data-typing${ls.typing !== false ? " checked" : ""}><span>Ask me to type names near the end</span></label>
    <div class="ls-just"><span class="pr-note">Just one way</span><div class="pr-rail">${[["cards", "Flashcards"], ["quiz", "Quiz"], ["match", "Matching"], ["type", "Type it"], ["odd", "Odd one out"]].map(([m, t]) => `<button class="pr-chip" data-method="${m}">${t}</button>`).join("")}${app && typeof hmLearnIt === "function" ? `<button class="pr-chip" data-method="lesson">The full lesson</button>` : ""}</div></div>
  </div>`);
  sh.classList.add("pr-qsheet", "ls-qsheet");
  const $s = s => sh.querySelector(s), size = $s("[data-size]"), closeIn = $s("[data-closeness]");
  let items = [];
  const build = () => {
    if (st.from === "alike" && seed) return lsAlike(seed, st.size, LS_CLOSE[st.close][1]);
    return these.slice(0, st.size);
  };
  const paint = () => {
    const max = st.from === "alike" ? 30 : Math.max(these.length, 1);
    size.max = max; size.disabled = max <= 3; if (st.size > max) st.size = max; if (st.size < Math.min(3, max)) st.size = Math.min(3, max);
    size.value = st.size;
    items = build();
    const nm = seed ? prName(seed) : "";
    $s("[data-qtitle]").innerHTML = st.from === "alike" ? `Learn <em>${esc(nm)}</em>` : `Learn <em>${esc(o.label || "these colors")}</em>`;
    $s("[data-qcount]").innerHTML = st.from === "alike" ? "and its look-alikes" : "";
    $s("[data-from]").innerHTML = seed && these.length ? [["alike", "Its look-alikes"], ["these", o.label || "These colors"]].map(([k, t]) => `<button class="pr-chip${k === st.from ? " on" : ""}" data-fromk="${k}">${esc(t)}</button>`).join("") : "";
    $s("[data-prev]").innerHTML = items.map((it, k) => `<i style="--c:${it.h};--k:${k}" title="${esc(prName(it))}"></i>`).join("");
    $s("[data-prev]").style.setProperty("--n", items.length);
    $s("[data-names]").textContent = items.slice(0, 6).map(prName).join(", ") + (items.length > 6 ? `, and ${items.length - 6} more` : "");
    $s("[data-sizev]").textContent = st.size >= max && st.from === "these" && max > 3 ? `All ${max}` : String(items.length);
    $s("[data-sizerow]").hidden = max <= 3;
    const showClose = st.from === "alike";
    $s("[data-closerow]").hidden = !showClose; $s("[data-closehint]").hidden = !showClose;
    closeIn.value = st.close; $s("[data-closev]").textContent = LS_CLOSE[st.close][0]; $s("[data-closehint]").textContent = LS_CLOSE[st.close][2] + (items.length < st.size ? `. Only ${items.length} names are that far apart here.` : ".");
    const mins = Math.max(1, Math.round(items.length * 2.6 * 5 / 60));
    $s("[data-go]").querySelector("em") ? 0 : $s("[data-go] span").insertAdjacentHTML("afterend", "<em></em>");
    $s("[data-go] em").textContent = `about ${mins} min`;
  };
  const remember = () => { ls.size = st.size; if (st.from === "alike") ls.close = st.close; ls.typing = $s("[data-typing]").checked; save(); };
  let lastTick = "";
  const onSlide = () => { st.size = +size.value; st.close = +closeIn.value; paint(); const k = st.size + "|" + st.close; if (k !== lastTick) { lastTick = k; buzz(3); } };
  size.oninput = onSlide; closeIn.oninput = onSlide; size.onchange = remember; closeIn.onchange = remember;
  $s("[data-typing]").onchange = () => { remember(); buzz(4); };
  const exit = lsExitTo(backTo), again = () => setTimeout(() => lsOpen({ ...o, back: backTo }), 60);
  const label = () => st.from === "alike" && seed ? `${prName(seed)} and its look-alikes` : (o.label || "These colors");
  sh.addEventListener("click", e => {
    const f = e.target.closest("[data-fromk]"); if (f) { st.from = f.dataset.fromk; buzz(4); paint(); return; }
    const m = e.target.closest("[data-method]"); if (!m || !items.length) return;
    remember(); close(); buzz(8);
    if (m.dataset.method === "lesson") return hmLearnIt(app);
    prPlay(m.dataset.method, { items: prShuffle(items), label: label(), exit, other: () => { exit(); again(); } });
  });
  $s("[data-look]").onclick = () => { if (!items.length) return; remember(); close(); buzz(8); lsLook(items, { label: label(), back: exit, reopen: again }); };
  $s("[data-go]").onclick = () => { if (!items.length) return; remember(); close(); buzz(8); lsStudy(items, { label: label(), back: exit, reopen: again }); };
  paint();
  return { sh, close };
}
// a hex's label: one line when it fits, else two balanced lines, sized so the longest line fits the hex (about 0.9 wide)
function lsHexLabel(name, x, y, fill) {
  const w = name.split(" ");
  let lines = [name];
  if (name.length > 9 && w.length > 1) {
    let best = null;
    for (let k = 1; k < w.length; k++) { const a = w.slice(0, k).join(" "), b = w.slice(k).join(" "), m = Math.max(a.length, b.length); if (!best || m < best.m) best = { m, l: [a, b] }; }
    lines = best.l;
  }
  const long = Math.max(...lines.map(l => l.length)), fs = Math.min(.22, .9 / (.5 * Math.max(4, long))), lh = fs * 1.05;
  const y0 = y + .04 - (lines.length - 1) * lh / 2;
  return `<text x="${x}" fill="${fill}" font-size="${fs.toFixed(3)}">${lines.map((l, i) => `<tspan x="${x}" y="${(y0 + i * lh).toFixed(3)}">${esc(l)}</tspan>`).join("")}</text>`;
}
const LS_ICON = {
  eye: sv('<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>', 22, 1.6),
  map: sv('<path d="M12 3l7.8 4.5v9L12 21l-7.8-4.5v-9z"/>', 18, 1.6),
};

// ======================================================================
// Look: no hiding, many views
// ======================================================================
function lsLook(items, o = {}) {
  const ls = lsState();
  let view = o.view || ls.view || "grid", order = "light";
  const el = show(`<header class="pr-top"><button class="pr-x" data-close aria-label="Close">${prX()}</button><span class="pr-grow"></span><span class="pr-note">${items.length} colors</span></header>
    <h1 class="pr-t2 ls-look-t">${esc(o.label || "These colors")}</h1>
    <div class="ls-views" role="tablist">${LS_VIEWS.map(([k, t]) => `<button role="tab" class="ls-vb" data-view="${k}">${t}</button>`).join("")}</div>
    <div class="ls-body" data-body></div>
    <div class="ls-foot">${prPrimary("Test me", "the mixed session", "data-test")}</div>`, "pr-home pr-look ls-lookscr");
  const body = el.querySelector("[data-body]");
  const nameTag = it => `<b>${esc(prName(it))}</b>`;
  const nearest = it => { let b = null, bd = Infinity; items.forEach(x => { if (x !== it) { const d = de2000(it.h, x.h); if (d < bd) { bd = d; b = x; } } }); return b ? { x: b, d: bd } : null; };
  const closeWord = d => d < 5 ? "Very close" : d < 10 ? "Close" : d < 20 ? "Related" : "Far apart";
  const R = {
    grid: () => `<div class="ls-grid">${items.map((it, i) => `<button class="ls-tile" data-i="${i}" style="--c:${it.h};color:${ink(it.h) === "dark" ? "#141311" : "#fff"}">${nameTag(it)}<span class="pr-code">${it.h}</span></button>`).join("")}</div>`,
    strip: () => {
      const sorted = items.slice().sort(order === "light" ? (a, b) => lab(b.h)[0] - lab(a.h)[0] : (a, b) => { const A = lch(a.h), B = lch(b.h); return (A[1] < 8 ? 999 : A[2]) - (B[1] < 8 ? 999 : B[2]) || B[0] - A[0]; });
      return `<div class="ls-seg2"><button class="pr-chip${order === "light" ? " on" : ""}" data-order="light">Light to dark</button><button class="pr-chip${order === "hue" ? " on" : ""}" data-order="hue">By hue</button></div>
        <div class="ls-strip">${sorted.map(it => `<button class="ls-band" data-i="${items.indexOf(it)}" style="--c:${it.h};color:${ink(it.h) === "dark" ? "#141311" : "#fff"}">${nameTag(it)}<span class="pr-code">L ${Math.round(lab(it.h)[0])}</span></button>`).join("")}</div>`;
    },
    pairs: () => {
      if (items.length < 2) return `<p class="pr-notep">One color has no pair. Add a few look-alikes from the sheet.</p>`;
      const seen = new Set(), pairs = [];
      items.forEach(it => { const n = nearest(it); if (!n) return; const k = [it.key, n.x.key].sort().join("|"); if (seen.has(k)) return; seen.add(k); pairs.push({ a: it, b: n.x, d: n.d }); });
      pairs.sort((p, q) => p.d - q.d);
      return `<p class="pr-notep">Each color beside the one in this set it's easiest to mix up with. Closest pairs first.</p><div class="ls-pairs">${pairs.map(p => `<div class="ls-pair">
        <div class="ls-pair-sw"><button data-i="${items.indexOf(p.a)}" style="--c:${p.a.h}"></button><button data-i="${items.indexOf(p.b)}" style="--c:${p.b.h}"></button></div>
        <div class="ls-pair-t"><b>${esc(prName(p.a))}</b><span class="pr-note">and</span><b>${esc(prName(p.b))}</b></div>
        <p>${esc(prDiff(p.a, p.b))}</p><span class="pr-note ls-pair-d">${closeWord(p.d)} · <span class="pr-code">ΔE ${p.d.toFixed(1)}</span></span></div>`).join("")}</div>`;
    },
    map: () => {
      if (typeof honeyCluster !== "function" || typeof honeyNorm !== "function") return R.grid();
      const lay = honeyCluster(items.map(it => honeyNorm(it))), pts = lay.pts;
      const xs = pts.map(p => p.x), ys = pts.map(p => p.y), x0 = Math.min(...xs) - .6, y0 = Math.min(...ys) - .6, w = Math.max(...xs) - x0 + .6, h = Math.max(...ys) - y0 + .6;
      const hex = (cx, cy) => { const r = .56, p = []; for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + k * Math.PI / 3; p.push((cx + r * Math.cos(a)).toFixed(3) + "," + (cy + r * Math.sin(a)).toFixed(3)); } return p.join(" "); };
      return `<p class="pr-notep">Hue runs across, light to dark runs down: the same layout as Home's honeycomb.</p>
        <svg class="ls-map" viewBox="${x0} ${y0} ${w} ${h}" role="img" aria-label="These colors on the color map">${pts.map(p => { const it = p.it.o; return `<g data-i="${items.indexOf(it)}"><polygon points="${hex(p.x, p.y)}" fill="${it.h}"/>${lsHexLabel(prName(it), p.x, p.y, ink(it.h) === "dark" ? "#141311" : "#fff")}</g>`; }).join("")}</svg>
        ${typeof csOnMap === "function" ? `<button class="pr-text ls-bigmap" data-bigmap>${LS_ICON.map} See them on the big map</button>` : ""}`;
    },
    art: () => {
      const hits = (window.PAINTINGS || []).filter(p => p.palette && p.palette.length && !p.stub && (p.thumb || p.img)).map(p => {
        const got = items.filter(it => p.palette.some(x => de2000(it.h, x.h) < 10));
        const share = p.palette.reduce((s, x) => s + (items.some(it => de2000(it.h, x.h) < 10) ? (x.share || 0) : 0), 0);
        return { p, got, share };
      }).filter(x => x.got.length).sort((a, b) => b.got.length - a.got.length || b.share - a.share).slice(0, 10);
      if (!hits.length) return `<p class="pr-notep">None of the museum paintings here leans on these colors. Try a wider set, or look at each color's own page.</p>`;
      return `<p class="pr-notep">Paintings whose colors come within a close match of this set (photographs of varnished paintings, so the colors are as photographed).</p><div class="ls-art">${hits.map(x => `<button class="ls-pt" data-ptg="${esc(String(x.p.id).replace(/^painting-/, ""))}"><img src="${esc(x.p.thumb || x.p.img)}" alt="" loading="lazy"><span class="ls-pt-t"><b>${esc(x.p.title)}</b><span class="pr-note">${esc(x.p.artist || "")}</span><span class="ls-pt-c">${x.got.map(it => `<i style="--c:${it.h}" title="${esc(prName(it))}"></i>`).join("")}<em>${x.got.length} of ${items.length}</em></span></span></button>`).join("")}</div>`;
    },
    carousel: () => `<div class="ls-car">${items.map((it, i) => { const n = nearest(it); return `<div class="ls-card" style="--c:${it.h};color:${ink(it.h) === "dark" ? "#141311" : "#fff"}" data-i="${i}">
      <span class="pr-code">${i + 1} / ${items.length}</span><b style="${prFit(prName(it), 56)}">${esc(prName(it))}</b><span class="pr-code">${it.h}</span>
      ${n ? `<p><span class="pr-pair"><i style="--c:${it.h}"></i><i style="--c:${n.x.h}"></i></span>${esc(prDiff(it, n.x))}</p>` : ""}</div>`; }).join("")}</div>`,
  };
  const paint = () => {
    el.querySelectorAll("[data-view]").forEach(b => { const on = b.dataset.view === view; b.classList.toggle("on", on); b.setAttribute("aria-selected", on); });
    body.innerHTML = R[view](); body.dataset.view = view;
    const bm = body.querySelector("[data-bigmap]"); if (bm) bm.onclick = () => csOnMap(colorSet({ kind: "learn", id: lsHexes(items), title: o.label || "", colors: items.map(it => ({ h: it.h, n: it.n })) }));
  };
  el.querySelector(".ls-views").onclick = e => { const b = e.target.closest("[data-view]"); if (!b || b.dataset.view === view) return; view = b.dataset.view; ls.view = view; save(); buzz(4); paint(); };
  body.addEventListener("click", e => {
    const ob = e.target.closest("[data-order]"); if (ob) { order = ob.dataset.order; buzz(4); return paint(); }
    const pt = e.target.closest("[data-ptg]"); if (pt) { buzz(6); return void openRoute("#/painting/" + pt.dataset.ptg); }
    const t = e.target.closest("[data-i]"); if (t && items[+t.dataset.i]) { buzz(6); lsOpenPage(items[+t.dataset.i]); }
  });
  el.querySelector("[data-test]").onclick = () => { buzz(8); lsStudy(items, o); };
  el.querySelector("[data-close]").onclick = () => (o.back || lsExitTo(""))();
  onKey = e => { if (e.key === "Escape") el.querySelector("[data-close]").click(); };
  paint();
  return el;
}

// ======================================================================
// Study: the mixed session
// ======================================================================
function lsKindFor(q, typing, last) {
  const lv = q.lv;
  let opts = lv <= 0 ? ["quiz-name"] : lv === 1 ? ["quiz-color", "odd-one-out"] : typing ? ["type"] : ["card"];
  if (lv === 1 && q.n1 % 2) opts = opts.reverse();
  let k = opts.find(x => x !== last) || opts[0];
  if (k === last) k = lv <= 0 ? "quiz-color" : lv === 1 ? "quiz-name" : "quiz-color";   // never the same kind twice in a row
  return k;
}
function lsStudy(items, o = {}) {
  if (!items.length) return;
  const ls = lsState(), typing = ls.typing !== false, n = items.length;
  const sess = prSession("learn", { dir: "f" }, items, { deckAll: items, label: o.label || "" });
  const lvOf = new Map(items.map(it => [it.key, { it, lv: typeof knowState === "function" && it.c && knowState(it.c) === "yours" ? 1 : 0, n1: 0 }]));
  const fresh = items.slice(), queue = [];
  let asked = 0, sinceMatch = 0, combo = 0, bestCombo = 0, lastKind = "", mastered = 0, boss = null, stopped = false;
  // screenshot states (#lsshot=study:…): start mid-session
  if (o.shot === "match") { lvOf.forEach(q => { q.lv = 1; }); sinceMatch = LS_MATCH_EVERY; fresh.length = 0; items.forEach(it => queue.push(lvOf.get(it.key))); }
  if (o.shot === "boss") { lvOf.forEach(q => { q.lv = 3; }); mastered = n; fresh.length = 0; }
  if (o.shot === "grad") { combo = 4; bestCombo = 4; const q = lvOf.get(items[0].key); q.lv = 2; fresh.splice(fresh.indexOf(items[0]), 1); queue.push(q); lvOf.forEach(x => { if (x !== q && x.lv === 0 && Math.random() < .5) x.lv = 1; }); }
  const el = show(`<header class="pr-top"><button class="pr-x" data-close aria-label="Close">${prX()}</button>
      <div class="ls-prog">${items.map(it => `<i data-k="${esc(it.key)}" style="--c:${it.h}"></i>`).join("")}</div>
      <span class="ls-combo" data-combo aria-live="polite"><b>0</b><span>in a row</span></span></header>
    <p class="ls-status"><span data-status></span><span class="ls-pop" data-pop></span></p>
    <p class="pr-coach"${prState().seen.learnset ? " hidden" : ""}>Each color climbs from picking to typing. Misses come back.</p>
    <div class="pr-stage"></div><div class="ls-grad" data-grad></div>`, "fixed pr-play pr-booth pr-m-learn ls-study");
  const stage = el.querySelector(".pr-stage"), comboEl = el.querySelector("[data-combo]");
  let stepKey = null;
  const setKey = fn => { stepKey = fn; };
  onKey = e => { if (e.key === "Escape") return el.querySelector("[data-close]").click(); if (stepKey) stepKey(e); };
  const status = () => {
    const met = [...lvOf.values()].filter(q => q.lv > 0 && q.lv < 3).length;
    el.querySelector("[data-status]").innerHTML = boss ? `Final round` : `<span class="pr-code">${mastered}</span> of <span class="pr-code">${n}</span> mastered${met ? ` · <span class="pr-code">${met}</span> getting there` : ""}`;
    lvOf.forEach((q, k) => { const s = el.querySelector(`.ls-prog i[data-k="${CSS.escape(k)}"]`); if (s) s.style.setProperty("--lv", Math.min(3, q.lv) / 3); s && s.classList.toggle("done", q.lv >= 3); });
  };
  const pop = (txt, cls = "") => { const p = el.querySelector("[data-pop]"); p.className = "ls-pop " + cls; p.textContent = txt; void p.offsetWidth; p.classList.add("go"); };
  const bump = ok => {
    combo = ok ? combo + 1 : 0; bestCombo = Math.max(bestCombo, combo);
    comboEl.querySelector("b").textContent = combo; comboEl.classList.toggle("on", combo >= 2); comboEl.classList.toggle("hot", combo >= 3); comboEl.classList.toggle("fire", combo >= 10);
    comboEl.classList.remove("tick"); void comboEl.offsetWidth; if (ok) comboEl.classList.add("tick");
    if (ok && LS_COMBO.includes(combo)) { pop(`${combo} in a row`, "streak"); buzz([8, 30, 8, 30, 16]); lsSfx("sfx", combo >= 10 ? "best" : "combo", items.map(it => it.h)); }
  };
  const graduate = it => {
    mastered++; buzz([10, 30, 20]); coachDone();
    lsSfx("sfxColor", it.h, { long: true }); setTimeout(() => lsSfx("sfx", "best", [it.h]), 200);
    const seg = el.querySelector(`.ls-prog i[data-k="${CSS.escape(it.key)}"]`); if (seg) { seg.classList.remove("pop"); void seg.offsetWidth; seg.classList.add("pop"); }
    const g = el.querySelector("[data-grad]");
    g.innerHTML = `<span class="ls-gchip"><i style="--c:${it.h}"></i><b>${esc(prName(it))}</b><span>mastered</span></span>`;
    g.classList.remove("go"); void g.offsetWidth; g.classList.add("go");
  };
  const climb = (q, ok) => {
    if (ok) { const was = q.lv; q.lv = Math.min(3, q.lv + 1); if (q.lv === 1) q.n1++; if (q.lv === 3 && was < 3) graduate(q.it); }
    else q.lv = Math.max(0, q.lv - 1);
  };
  const next = () => {
    while (queue.length < LS_INPLAY && fresh.length) queue.push(lvOf.get(fresh.shift().key));
    return queue.shift() || null;
  };
  el._lsFx = { bump, graduate };   // screenshot hook
  const ctx = extra => ({ deck: items, feedback: true, setKey, screen: el, ...extra });
  el.querySelector("[data-close]").onclick = () => { stopped = true; sess.ended = true; if (sess.first.size) lsResults(sess, { items, o, stopped: true, bestCombo, mastered, lvOf }); else (o.back || lsExitTo(""))(); };
  const coachDone = () => { const c = el.querySelector(".pr-coach"); if (c && !c.hidden) { c.hidden = true; const p = prState(); p.seen.learnset = today(); save(); } };
  (async () => {
    status();
    while (!sess.ended) {
      // a Matching round now and then, with the colors in play
      const inPlay = [...lvOf.values()].filter(q => q.lv >= 1 && q.lv < 3);
      if (sinceMatch >= LS_MATCH_EVERY && inPlay.length >= 3) {
        sinceMatch = 0;
        const set = prShuffle(inPlay).slice(0, 5);
        pop("Matching round", "round"); buzz(8); lsSfx("sfx", "rooms", 4);
        const res = await PR_STEPS.match.render(stage, set.map(q => q.it), ctx({ note: "Pair each name with its color" }));
        if (sess.ended || !stage.isConnected) return;
        (res.per || []).forEach(p => { const q = lvOf.get(p.item.key); prRecord(sess, p.item, { ok: p.ok, answer: p.answer, ms: res.ms / set.length }, "match"); climb(q, p.ok); if (!p.ok) { const i = queue.indexOf(q); if (i > 1) { queue.splice(i, 1); queue.splice(1, 0, q); } } });
        bump(res.ok); lastKind = "match"; status(); coachDone();
        continue;
      }
      const q = next();
      if (!q) break;
      const kind = lsKindFor(q, typing, lastKind);
      stage._lsIt = q.it;   // test hook
      const res = await PR_STEPS[kind].render(stage, q.it, ctx({ dir: kind === "quiz-color" ? "r" : "f" }));
      if (sess.ended || !stage.isConnected) return;
      prRecord(sess, q.it, res, kind);
      asked++; sinceMatch++; lastKind = kind; coachDone();
      climb(q, !!res.ok); bump(!!res.ok);
      if (q.lv < 3) queue.splice(res.ok ? Math.min(queue.length, 2 + q.lv) : Math.min(1, queue.length), 0, q);
      status();
    }
    if (sess.ended) return;
    // the boss: a lightning Matching round of everything
    let bossMs = null;
    if (n >= 3) {
      boss = true; status(); coachDone();
      const set = prShuffle(items).slice(0, 6);
      stage.innerHTML = `<div class="ls-boss"><div class="ls-fan">${set.map((it, k) => `<i style="--c:${it.h};--k:${k}"></i>`).join("")}</div><span class="pr-note">Every color mastered</span><b class="pr-t1">Final round</b><p class="pr-notep">Lightning match: pair all ${set.length} as fast as you can.</p>${prPrimary("Go", "", "data-boss")}</div>`;
      buzz([10, 40, 10, 40, 20]); lsSfx("sfxChord", set.map(it => it.h));
      await new Promise(r => { const b = stage.querySelector("[data-boss]"); b.onclick = r; setKey(e => { if (e.key === "Enter") r(); }); });
      if (sess.ended) return;
      const clock = el.querySelector("[data-status]"); let pen = 0; const t0 = performance.now();
      const tick = setInterval(() => { if (!clock.isConnected) return clearInterval(tick); clock.innerHTML = `<span class="pr-code">${((performance.now() - t0) / 1000 + pen).toFixed(1)} s</span>${pen ? ` · <span class="pr-code">+${pen}</span>` : ""}`; }, 100);
      cleanup.push(() => clearInterval(tick));
      const res = await PR_STEPS.match.render(stage, set, ctx({ onMiss: () => { pen++; buzz([10, 40, 10]); } }));
      clearInterval(tick);
      if (sess.ended) return;
      bossMs = performance.now() - t0 + pen * 1000;
      lsSfx("sfx", "levelup", set.map(it => it.h));
    }
    lsResults(sess, { items, o, bestCombo, mastered, lvOf, bossMs });
  })();
  return el;
}

// ======================================================================
// Results
// ======================================================================
function lsResults(sess, r) {
  sess.ended = true;
  const { items, o } = r, firsts = [...sess.first.values()], right = firsts.filter(f => f.ok).length, total = firsts.length;
  const pct = total ? Math.round(right * 100 / total) : 0, ms = performance.now() - sess.t0, ls = lsState(), key = lsSetKey(items);
  let best = null, newBest = false;
  if (r.bossMs != null) { const old = ls.best[key]; newBest = !old || r.bossMs < old.v; if (newBest) ls.best[key] = { v: r.bossMs, at: today() }; best = old ? old.v : null; save(); }
  const masteredList = [...r.lvOf.values()].filter(q => q.lv >= 3).map(q => q.it);
  // the mix-ups: every wrong pick in this session, as pairs (one row per pair)
  const seen = new Set(), mix = [];
  sess.log.forEach(l => { const a = l.answer; if (l.ok || !a || !a.h || !l.it) return; const other = prItemOf(a.h) || { n: a.n, h: a.h, key: a.n }; const k = [l.it.key, other.key].sort().join("|"); if (seen.has(k) || other.h === l.it.h) return; seen.add(k); mix.push({ a: l.it, b: other }); });
  const all = masteredList.length === items.length && !r.stopped;
  const title = all ? (items.length === 1 ? `<em>Mastered</em>` : `All ${items.length} <em>mastered</em>`) : `${masteredList.length} of ${items.length} <em>mastered</em>`;
  const mono = v => `<span class="pr-code">${v}</span>`;
  const tiles = [[pct + "%", "first try"], [r.bestCombo, "best streak"], [prTime(ms), "time"], ...(r.bossMs != null ? [[prTime(r.bossMs), newBest && best != null ? "a new best" : best != null ? `final round · best ${prTime(best)}` : "final round"]] : [])];
  const shareText = `ColorHub · ${o.label || "A color set"} · ${String(title).replace(/<[^>]+>/g, "")} · ${pct}% first try · best streak ${r.bestCombo}${r.bossMs != null ? ` · final round ${prTime(r.bossMs)}` : ""}`;
  const el = show(`<header class="pr-top"><button class="pr-x" data-close aria-label="Close">${prX()}</button><span class="pr-grow"></span><span class="pr-note">Study</span></header>
    ${prPlate(items, "pr-plate-res" + (all ? " win" : ""))}
    <h1 class="pr-t1 pr-res-t">${title}</h1>
    <p class="pr-notep">${esc(o.label || "")}</p>
    <div class="ls-stats">${tiles.map(([v, t]) => `<div><b>${mono(v)}</b><span>${t}</span></div>`).join("")}</div>
    ${masteredList.length ? `<p class="pr-note pr-sec-n">Mastered</p><div class="ls-chips">${masteredList.map(it => `<button class="ls-chip" data-h="${it.h}" data-n="${esc(it.n)}"><i style="--c:${it.h}"></i>${esc(prName(it))}</button>`).join("")}</div>` : ""}
    ${mix.length ? `<p class="pr-note pr-sec-n">${mix.length === 1 ? "The pair you mixed up" : `The ${mix.length} pairs you mixed up`}</p><div class="pr-rows">${mix.slice(0, 8).map((m, i) => `<button class="pr-row pr-miss" data-mix="${i}"><span class="pr-pair2"><i style="--c:${m.a.h}"></i><i style="--c:${m.b.h}"></i></span><span class="pr-rowt"><b>${esc(prName(m.a))} and ${esc(prName(m.b))}</b><small>${esc(prDiff(m.a, m.b))}</small></span>${PR_ICON.chev}</button>`).join("")}</div>
      <button class="pr-text ls-sbs" data-a="pairs">See them side by side</button>` : ""}
    <div class="pr-grow"></div>
    <div class="pr-acts">${prPrimary(all ? "Study again" : "Keep going", "", "data-a=again")}
      <span class="pr-textrow"><button class="pr-text" data-a="look">Look again</button><button class="pr-text" data-a="share">Share</button></span></div>`, "pr-res pr-booth ls-res");
  buzz(all ? [10, 30, 10, 30, 24] : 8); lsSfx("sfxChord", items.map(it => it.h));
  if (newBest && best != null) setTimeout(() => { if (el.isConnected) lsSfx("sfx", "best", items.map(it => it.h)); }, 1100);
  const exit = o.back || lsExitTo("");
  el.querySelector("[data-close]").onclick = () => exit();
  el.querySelectorAll("[data-h]").forEach(b => b.onclick = () => lsOpenPage({ h: b.dataset.h, n: b.dataset.n }));
  el.querySelectorAll("[data-mix]").forEach(b => b.onclick = () => lsOpenPage(mix[+b.dataset.mix].a));
  el.querySelectorAll("[data-a]").forEach(b => b.onclick = () => {
    const a = b.dataset.a;
    if (a === "again") return lsStudy(items, o);
    if (a === "look") return lsLook(items, o);
    if (a === "pairs") { const inv = [...new Set(mix.flatMap(m => [m.a, m.b]))]; return lsLook(prUnique(inv.filter(x => x.key)).length >= 2 ? prUnique(inv.filter(x => x.key)) : items, { ...o, view: "pairs" }); }
    if (a === "share") { try { if (navigator.share) return void navigator.share({ text: shareText }).catch(() => {}); navigator.clipboard.writeText(shareText); toast("Copied"); } catch (e) {} }
  });
  onKey = e => { if (e.key === "Enter") lsStudy(items, o); if (e.key === "Escape") exit(); };
  return el;
}

// ======================================================================
// Screenshots: #lsshot=sheet[:close] | look:<view> | study[:wrong|match|grad|boss] | results
// ======================================================================
function lsShot(arg) {
  PR_SHOT_ON = true;
  try { const set = localStorage.setItem.bind(localStorage); localStorage.setItem = (k, v) => { if (k !== KEY) set(k, v); }; } catch (e) {}
  document.documentElement.classList.add("pr-shot");
  const [w, st] = String(arg).split(":"), teal = prByKey("teal"), items = lsAlike(teal, 8, 5), label = "Teal and its look-alikes";
  const ls = lsState(); ls.typing = st !== "card";
  if (w === "sheet") { openRoute("#/color/teal"); if (st) ls.close = +st; return setTimeout(() => lsOpen({ seed: teal }), 1200); }
  if (w === "look") return lsLook(items, { label, view: st || "grid" });
  if (w === "study") {
    const el = lsStudy(prShuffle(items), { label, shot: st });
    const stage = el.querySelector(".pr-stage");
    setTimeout(() => {
      if (st === "wrong" && stage._prChoose) { const i = [...stage.querySelectorAll(".pr-opt")].findIndex(b => b.textContent.trim() !== prName(stage._lsIt)); stage._prChoose(i); }
      if (st === "grad") { const nm = prName(stage._lsIt); setTimeout(() => { el._lsFx.bump(true); el._lsFx.graduate(stage._lsIt); }, 200); if (stage._prType && stage.querySelector(".pr-s-type")) stage._prType(nm); else if (stage.querySelector(".pr-s-card")) { stage._prReveal(); setTimeout(() => stage.querySelector("[data-yes]").click(), 100); } }
      if (st === "match" && stage._prMatch) { const { tiles } = stage._prMatch, b = [...stage.querySelectorAll(".pr-tile")], k = tiles.findIndex(t => !t.sw), j = tiles.findIndex(t => t.sw && t.i === tiles[k].i); b[k].click(); b[j].click(); const k2 = tiles.findIndex((t, x) => !t.sw && x !== k); b[k2].click(); }
    }, 700);
    return;
  }
  if (w === "results") {
    const sess = prSession("learn", { dir: "f" }, items, { deckAll: items });
    items.forEach((it, i) => { const nb = items[(i + 1) % items.length], ok = i % 3 !== 1; const r = { ok, answer: ok ? null : { kind: "pick", n: prName(nb), h: nb.h } }; sess.first.set(it.key, { it, ...r, kind: "quiz-name" }); sess.log.push({ it, kind: "quiz-name", ...r }); });
    sess.t0 = performance.now() - 192000;
    const lvOf = new Map(items.map(it => [it.key, { it, lv: 3 }]));
    return lsResults(sess, { items, o: { label }, bestCombo: 9, mastered: items.length, lvOf, bossMs: 8400 });
  }
}
if (typeof location !== "undefined" && /^#lsshot=/.test(location.hash)) {
  const arg = decodeURIComponent(location.hash.slice(8));
  addEventListener("load", () => loadCoreNames().then(() => setTimeout(() => lsShot(arg), 50)));
}
