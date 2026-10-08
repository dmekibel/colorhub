"use strict";
// Across the line: odd one out by name (design/IDEAS-10X/train-games.md §2 and §7 B). "Three of these are Teal.
// Which one isn't?" The in-name tiles vary inside Teal's region; one tile sits just across the boundary in a
// neighbor name, often closer to its nearest tile than the in-name tiles are to each other, so the odd one isn't
// the most different tile: it's the one on the other side of a word. A name is a lens; this trains the edges.
// The generator is ooLineRound (js/games/oo-engine.js, tested by tools/line_test.js); names come from nameOf().
// Honest: the boundaries are ColorHub's nearest-name regions (dictionaries draw them differently), and words
// only modestly change what we see (Winawer 2007), so the copy claims nothing more. The neighbor's name is
// revealed only after the tap (recall before reveal).
// Making it click (design/IMPROVE-2026-10-08/PLAN.md Lane H, train.md §5): the word's own color sits above the
// board as an anchor; rounds are drawn only where the edge is confident (the odd tile's name wins by 30%+); the
// words are your own Learn words once you have six; a miss says plainly that this is ColorHub's map; every
// reveal offers the neighbor word as a new review card; and each answer goes to the Learner Model with names.

// nameOf, remembered per hex while boards are searched (the generator asks about the same colors many times)
const OO_NAMER_MEMO = { src: null, m: new Map() };
const ooNamer = hex => {
  const src = typeof CORE_NAMES !== "undefined" ? CORE_NAMES : null;
  if (OO_NAMER_MEMO.src !== src || OO_NAMER_MEMO.m.size > 4000) { OO_NAMER_MEMO.src = src; OO_NAMER_MEMO.m = new Map(); }
  let r = OO_NAMER_MEMO.m.get(hex);
  if (!r) { const nm = nameOf(hex); r = { n: nm.n, de: nm.de, near: (nm.near || []).map(x => ({ n: x.n, h: x.h, de: x.de })) }; OO_NAMER_MEMO.m.set(hex, r); }
  return r;
};
// a name inside a sentence: "royal blue", but "Prussian blue" (js/learnmore.js)
const ooLow = n => /\s[A-Z]/.test(n) ? String(n) : typeof lxLower === "function" ? lxLower(n) : String(n).toLowerCase();   // "Mountbatten Pink" keeps its capitals
// Category words: your Learn words (every review card whose word is one of the ~1,000 core names) once you have
// six; before that, the first lesson colors as their core names. word: one word only ("Where does teal end?").
function ooLineCats(word) {
  const list = typeof CORE_NAMES !== "undefined" && CORE_NAMES ? CORE_NAMES : null, byN = list ? new Map(list.map(e => [e.n.toLowerCase(), e])) : null;
  if (word && byN) { const e = byN.get(String(word).toLowerCase()); if (e) return [{ n: e.n, h: e.h }]; }
  const mine = ooLineMine(byN);
  if (mine.length >= 6) return mine;
  const met = (typeof ALL !== "undefined" ? ALL : []).filter(c => S.cards && S.cards[c.id]);
  return (met.length >= 6 ? met : ALL).map(c => { const e = byN && byN.get(c.n.toLowerCase()); return e ? { n: e.n, h: e.h } : { n: c.n, h: c.h }; });
}
function ooLineMine(byN) {
  if (!byN || typeof cardColors !== "function") return [];
  const seen = new Set(), out = [];
  cardColors().forEach(c => { const e = c && c.n && byN.get(c.n.toLowerCase()); if (e && !seen.has(e.n)) { seen.add(e.n); out.push({ n: e.n, h: e.h }); } });
  return out;
}
// The neighbor word as a learnable color, and whether it already has a review card.
function ooLineWord(n) {
  const e = typeof CORE_NAMES !== "undefined" && CORE_NAMES ? CORE_NAMES.find(x => x.n === n) : null;
  const c = e && typeof lxLearnable === "function" ? lxLearnable(e) : null;
  return c && c.id ? { c, have: !!(S.cards && S.cards[c.id]) } : null;
}
// "Add petrol to your words": a review card due tomorrow, so the first gap crosses a night's sleep (cardNew,
// js/learnmore.js), tagged with where it came from.
function ooLineAdd(n) {
  const w = ooLineWord(n);
  if (!w || w.have || typeof cardNew !== "function") return false;
  S.cards[w.c.id] = { ...cardNew(w.c, today()), from: "across" };
  if (typeof learnerLog === "function") learnerLog({ type: "seen", color: { n: w.c.n, h: w.c.h }, src: "across" });
  save();
  return true;
}
const OO_NUM = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight"];
// the reveal strip: from the category's color to the neighbor's, a tick where the name changes, the tiles as dots
function ooLineStrip(rd) {
  const A = lab(rd.catHex), Bv = lab(rd.nbHex), d = Bv.map((x, i) => x - A[i]), dd = d.reduce((s, x) => s + x * x, 0) || 1;
  const t = h => clamp(lab(h).reduce((s, x, i) => s + (x - A[i]) * d[i], 0) / dd, 0, 1);
  const stops = Array.from({ length: 9 }, (_, i) => labHex(...A.map((x, j) => x + d[j] * i / 8)) + " " + (i * 12.5) + "%").join(",");
  const dots = rd.colors.map((h, i) => `<i class="${i === rd.at ? "odd" : ""}" style="left:${(t(h) * 100).toFixed(1)}%;--c:${h}"></i>`).join("");
  return `<div class="oo-lstrip"><div class="oo-lbar" style="background:linear-gradient(90deg,${stops})"><b style="left:${(t(rd.B) * 100).toFixed(1)}%"></b>${dots}</div>
    <div class="oo-lends"><span>${esc(rd.cat)}</span><span>${esc(rd.nb)}</span></div></div>`;
}
// the anchor: the category word's own color, as a small swatch right beside the word in the question (not a link
// mid-round: a tap there would leave the board; every name is a link once the round is answered)
const ooLineAnchor = rd => `<i class="oo-lanchor" role="img" aria-label="${esc(rd.cat)}'s own color" style="display:inline-block;width:.8em;height:.8em;margin:0 .06em 0 .2em;border-radius:.16em;vertical-align:-.05em;background:${rd.catHex};box-shadow:inset 0 0 0 1px rgba(255,255,255,.2),0 0 0 1px rgba(0,0,0,.12)"></i>`;
// after the reveal: the neighbor word, one tap from your review cards
function ooLineAddRow(rd) {
  const w = ooLineWord(rd.nb);
  if (!w || w.have) return "";
  return `<span data-laddhost style="display:flex;justify-content:center"><button class="oo-ladd" data-ladd style="display:inline-flex;align-items:center;gap:10px;min-height:44px;margin-top:6px;padding:0;background:none;border:0;color:var(--ink);font:400 17px/1.3 var(--serif);text-align:left;cursor:pointer">
    <i aria-hidden="true" style="flex:none;width:18px;height:18px;border-radius:50%;background:${rd.nbHex};box-shadow:0 0 0 1px rgba(255,255,255,.25)"></i><span style="text-decoration:underline;text-underline-offset:4px;text-decoration-thickness:1px">Add <em>${esc(ooLow(rd.nb))}</em> to your words</span></button></span>`;
}
OO_MIXPLAY.across = function (ui, it) {
  return new Promise(resolve => {
    const k = it.k || 4, cats = it.cats || ooLineCats(it.word), rnd = it.rnd || Math.random;
    // a confident edge isn't always there at the smallest pushes: ease the push a little rather than ask a near-tie
    let rd = null;
    for (let i = 0, p = it.p || OO_LINE_P0; i < 3 && !rd; i++, p = Math.min(8, p * 1.4)) rd = ooLineRound(rnd, { p, k, cats, namer: ooNamer });
    if (!rd) return resolve({ ok: 0, ms: 0, act: 0, noModel: true, line: "No clear word edge turned up for this round, so it's skipped." });
    OO_LAST = { v: "one", ans: [rd.at], colors: rd.colors };
    const cols = k === 6 ? 3 : 2, rows = k / cols, aspect = cols / rows;
    const cells = rd.colors.map((_, i) => ({ x: (i % cols) / cols, y: Math.floor(i / cols) / rows, w: 1 / cols, h: 1 / rows, shape: "sq" }));
    ui.q.innerHTML = `${OO_NUM[k - 1]} of these are <em>${esc(rd.cat)}</em>${ooLineAnchor(rd)}. Which one isn't?`;
    ui.stage.innerHTML = `<div class="oo-lwrap">${ooBoardHTML({ b: "grid", cells, aspect, colors: rd.colors, cols })}<div class="oo-lrev"></div></div>`;
    const board = ui.stage.querySelector(".oo-board");
    board.style.width = "min(100%, 32dvh)";   // a little smaller than Odd one out's, so the strip and the settle line fit at 375 x 812
    const tiles = [...board.querySelectorAll(".oo-t")], t0 = performance.now();
    tiles.forEach((t, i) => t.onclick = () => {
      tiles.forEach(x => x.disabled = true);
      t.classList.remove("tap"); void t.offsetWidth; t.classList.add("tap");
      const ok = i === rd.at, ms = performance.now() - t0;
      tiles[rd.at].classList.add("ring"); if (!ok) t.classList.add("miss");
      buzz(ok ? 10 : [10, 40, 10]); if (ok) ooRipple(board, t);
      // the Learner Model, with names: an answer on the category word; a miss is a word mix-up (the answer was the
      // neighbor, and you took it for the category word)
      if (typeof learnerLog === "function") {
        learnerLog({ type: "answer", color: { n: rd.cat, h: rd.catHex }, ok, by: "game", ms, src: "across" });
        if (!ok) learnerLog({ type: "confuse", a: { n: rd.nb, h: rd.nbHex }, b: { n: rd.cat, h: rd.catHex }, src: "across" });
      }
      // settle: every tile gets its name, then the strip shows where the word ends, then the neighbor word to keep
      tiles.forEach((x, j) => { const nm = nameOf(rd.colors[j]); x.innerHTML = `<span class="oo-tn" data-ink="${ink(rd.colors[j])}">${esc(nm.n)}</span>`; });
      later(() => {
        const rv = ui.stage.querySelector(".oo-lrev"); if (!rv) return;
        rv.innerHTML = ooLineStrip(rd); rv.classList.add("oo-in");
      }, 350);
      // the add row rides in the settle line (ooRun draws it right after this resolves), just above Next
      later(() => {
        const add = ui.foot.querySelector("[data-ladd]");
        if (add) add.onclick = () => {
          if (!ooLineAdd(rd.nb)) return;
          buzz(8);
          add.outerHTML = `<span class="oo-ladded" style="display:inline-flex;align-items:center;gap:10px;min-height:44px;margin-top:6px"><i aria-hidden="true" style="flex:none;width:18px;height:18px;border-radius:50%;background:${rd.nbHex}"></i><span><em>${esc(rd.nb)}</em> is in your words. First review tomorrow.</span></span>`;
        };
      }, 0);
      const lk = (h, n) => `<span class="wl wl-c eye-n" style="--c:${h}" data-swatch="${h}">${esc(n)}</span>`;
      const line = ok ? `Right: this one crossed into ${lk(rd.odd, ooLow(rd.nb))}. It sits only <b class="mono">${pctFmt(rd.act)}</b> from the nearest ${esc(ooLow(rd.cat))}, ${rd.trapOk ? "closer than some of the others are to each other." : "but over the line."}`
        : `In ColorHub's map, this side is ${lk(rd.odd, ooLow(rd.nb))}. Yours is still ${lk(rd.colors[i], ooLow(rd.cat))}, <b class="mono">${pctFmt(de2000(rd.colors[i], rd.odd))}</b> away. Dictionaries draw the line a little differently.`;
      // no hex pair goes to the eye's miss list: a word edge is a naming answer, logged above with names
      resolve({ ok: ok ? 1 : 0, ms, act: rd.act, picked: ok ? null : rd.colors[i], noModel: true, hold: true, line: line + ooLineAddRow(rd), cmp: null });
    });
  });
};
// the station: eight rounds; the push past the line follows a 2-down / 1-up staircase that carries over
// the setup: For you or Choose, then Start. opts.word: eight rounds of one word against its neighbors.
function ooAcross(opts = {}) {
  if (!S.scr && !ooShotMode() && typeof screenCheck === "function") return screenCheck(() => ooAcross(opts));
  const mine = ooLineMine(typeof CORE_NAMES !== "undefined" && CORE_NAMES ? new Map(CORE_NAMES.map(e => [e.n.toLowerCase(), e])) : null).length;
  const from = opts.word ? `Every round asks where ${esc(ooLow(opts.word))} ends.` : mine >= 6 ? `Every round uses one of the ${mine.toLocaleString()} words you're learning.` : "Until you're learning six words, the rounds use the first lesson colors.";
  const el = show(`
    <header class="deck-top"><button class="icon-btn" data-close aria-label="Back">${ICON.back}</button></header>
    <h1 class="title-1 oo-title">Across the line</h1>
    <p class="lede">Three of these are teal, and teal's own color sits beside the word. Which one isn't? Look for where the word ends, not for the biggest difference.</p>
    <p class="note">${from}</p>
    <div class="oo-pk-host" data-pk-host></div>
    <div class="stack" style="margin-top:28px"><button class="btn" data-go>Play eight rounds ${ICON.arrow}</button></div>`, "oo-eye");
  el.querySelector("[data-close]").onclick = () => go("gym");
  ooPickMount(el.querySelector("[data-pk-host]"), "line");
  el.querySelector("[data-go]").onclick = () => ooAcrossRun(opts);
}
function ooAcrossRun(opts = {}) {
  if (opts && opts.type) opts = {};   // called as a click handler
  const go2 = () => {
    const st = ooS(), ln = st.line && typeof st.line === "object" ? st.line : (st.line = {}), cats = ooLineCats(opts.word);
    const stair = ooStair(clamp(+ln.p || OO_LINE_P0, OO_LINE_MIN, 8), .35), pk = ooPickFor("line"), ps = [];
    const edge = ln.edge = ln.edge && typeof ln.edge === "object" ? ln.edge : { r: NaN, n: 0 };
    ooRun({ label: "Words", total: 8, combo: true, cls: "oo-line", onQuit: () => ooAcross(opts),
      gen: (k, run) => {
        if (run.prev) ooStairStep(stair, !!run.prev.res.ok, OO_LINE_MIN, 8);
        // Choose draws at your edge estimate times the tier; For you follows the staircase
        const p = pk ? ooEdgeD(edge, "line", pk) : stair.d;
        ps[k] = p;
        return { kind: "across", p, k: p < 3 ? 6 : 4, cats, word: opts.word, record: false, hold: true, note: k === 0 && !ln.n ? "Look for the word's edge, not the biggest difference" : null };
      },
      onEnd: s => {
        // every answer, in either mode, moves the edge estimate by the push actually drawn
        s.res.forEach((r, k) => { if (ps[k] != null) ooEdgeUpdate(edge, "line", ps[k], !!r.ok); });
        ln.p = +stair.d.toFixed(2); ln.n = (ln.n || 0) + 1; const pb = s.hits > (ln.best || 0); ln.best = Math.max(ln.best || 0, s.hits); save();
        const finish = s.hits >= 6;
        ooResults({ title: "Across the line", s, finish, stars: [finish, finish && s.med != null && s.med <= 4500, finish && s.hits === s.total].map(Number), got: [1, 1, 1], labels: ["Passed", "Quick", "Perfect"], lede: finish ? "You held the word's edge most of the way." : `You need 6 of ${s.total}. Look for where one word turns into the next, not for the biggest difference.`, pb, next: null,
          again: () => ooAcrossRun(opts), diff: ooPickLine("line"), score: `${s.hits} of ${s.total} right`, back: "Back to Train", onBack: () => go("gym") });
      } });
  };
  eyeNamesReady().then(go2, go2);
}
