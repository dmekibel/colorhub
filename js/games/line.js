"use strict";
// Across the line: odd one out by name (design/IDEAS-10X/train-games.md §2 and §7 B). "Three of these are Teal.
// Which one isn't?" The in-name tiles vary inside Teal's region; one tile sits just across the boundary in a
// neighbor name, often closer to its nearest tile than the in-name tiles are to each other, so the odd one isn't
// the most different tile: it's the one on the other side of a word. A name is a lens; this trains the edges.
// The generator is ooLineRound (js/games/oo-engine.js, tested by tools/line_test.js); names come from nameOf().
// Honest: the boundaries are ColorHub's nearest-name regions (dictionaries draw them differently), and words
// only modestly change what we see (Winawer 2007), so the copy claims nothing more. The neighbor's name is
// revealed only after the tap (recall before reveal).

const ooNamer = hex => { const nm = nameOf(hex); return { n: nm.n, de: nm.de, near: (nm.near || []).map(x => ({ n: x.n, h: x.h, de: x.de })) }; };
// category words: the ones you've met (as core names), else the app's lesson colors
function ooLineCats() {
  const list = typeof CORE_NAMES !== "undefined" && CORE_NAMES ? CORE_NAMES : null, byN = list ? new Map(list.map(e => [e.n.toLowerCase(), e])) : null;
  const met = (typeof ALL !== "undefined" ? ALL : []).filter(c => S.cards && S.cards[c.id]);
  const pick = (met.length >= 6 ? met : ALL).map(c => { const e = byN && byN.get(c.n.toLowerCase()); return e ? { n: e.n, h: e.h } : { n: c.n, h: c.h }; });
  return pick;
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
OO_MIXPLAY.across = function (ui, it) {
  return new Promise(resolve => {
    const k = it.k || 4, rd = ooLineRound(it.rnd || Math.random, { p: it.p || OO_LINE_P0, k, cats: it.cats || ooLineCats(), namer: ooNamer });
    if (!rd) return resolve({ ok: 0, ms: 0, act: 0, noModel: true, line: "Couldn't find a word edge for this round." });
    OO_LAST = { v: "one", ans: [rd.at], colors: rd.colors };
    const cols = k === 6 ? 3 : 2, rows = k / cols, aspect = cols / rows;
    const cells = rd.colors.map((_, i) => ({ x: (i % cols) / cols, y: Math.floor(i / cols) / rows, w: 1 / cols, h: 1 / rows, shape: "sq" }));
    ui.q.innerHTML = `${OO_NUM[k - 1]} of these are <em>${esc(rd.cat)}</em>. Which one isn't?`;
    ui.stage.innerHTML = `<div class="oo-lwrap">${ooBoardHTML({ b: "grid", cells, aspect, colors: rd.colors, cols })}<div class="oo-lrev"></div></div>`;
    const board = ui.stage.querySelector(".oo-board"), tiles = [...board.querySelectorAll(".oo-t")], t0 = performance.now();
    tiles.forEach((t, i) => t.onclick = () => {
      tiles.forEach(x => x.disabled = true);
      t.classList.remove("tap"); void t.offsetWidth; t.classList.add("tap");
      const ok = i === rd.at;
      tiles[rd.at].classList.add("ring"); if (!ok) t.classList.add("miss");
      buzz(ok ? 10 : [10, 40, 10]); if (ok) ooRipple(board, t);
      // settle: every tile gets its name, then the strip shows where the word ends
      tiles.forEach((x, j) => { const nm = nameOf(rd.colors[j]); x.innerHTML = `<span class="oo-tn" data-ink="${ink(rd.colors[j])}">${esc(nm.n)}</span>`; });
      later(() => { const rv = ui.stage.querySelector(".oo-lrev"); if (rv) { rv.innerHTML = ooLineStrip(rd); rv.classList.add("oo-in"); } }, 350);
      const lk = (h, n) => `<span class="wl wl-c eye-n" style="--c:${h}" data-swatch="${h}">${esc(n)}</span>`;
      const gap = `<b class="mono">${pctFmt(rd.act)}</b>`;
      const line = ok ? `Right: this one crossed into ${lk(rd.odd, rd.nb)}. It sits only ${gap} from the nearest ${esc(rd.cat)}, ${rd.trapOk ? "closer than some of the others are to each other." : "but over the line."}`
        : `This one crossed into ${lk(rd.odd, rd.nb)}. Yours is still ${lk(rd.colors[i], rd.cat)}; the two sit ${gap} apart, on either side of the word's edge.`;
      resolve({ ok: ok ? 1 : 0, ms: performance.now() - t0, act: rd.act, right: rd.odd, picked: ok ? null : rd.colors[i], noModel: true, hold: true, line,
        cmp: ok ? null : [[rd.colors[i], `Yours: ${rd.cat}`], [rd.odd, `Across: ${rd.nb}`]] });
    });
  });
};
// the station: eight rounds; the push past the line follows a 2-down / 1-up staircase that carries over
// the setup: For you or Choose, then Start
function ooAcross() {
  if (!S.scr && !ooShotMode() && typeof screenCheck === "function") return screenCheck(ooAcross);
  const el = show(`
    <header class="deck-top"><button class="icon-btn" data-close aria-label="Back">${ICON.back}</button></header>
    <h1 class="title-1 oo-title">Across the line</h1>
    <p class="lede">Three of these are Teal. Which one isn't? Look for the word's edge, not the biggest difference.</p>
    <div class="oo-pk-host" data-pk-host></div>
    <div class="stack" style="margin-top:28px"><button class="btn" data-go>Play eight rounds ${ICON.arrow}</button></div>`, "oo-eye");
  el.querySelector("[data-close]").onclick = () => go("gym");
  ooPickMount(el.querySelector("[data-pk-host]"), "line");
  el.querySelector("[data-go]").onclick = ooAcrossRun;
}
function ooAcrossRun() {
  const go2 = () => {
    const st = ooS(), ln = st.line && typeof st.line === "object" ? st.line : (st.line = {}), cats = ooLineCats();
    const stair = ooStair(clamp(+ln.p || OO_LINE_P0, OO_LINE_MIN, 8), .35), pk = ooPickFor("line"), ps = [];
    const edge = ln.edge = ln.edge && typeof ln.edge === "object" ? ln.edge : { r: NaN, n: 0 };
    ooRun({ label: "Words", total: 8, combo: true, cls: "oo-line", onQuit: () => ooAcross(),
      gen: (k, run) => {
        if (run.prev) ooStairStep(stair, !!run.prev.res.ok, OO_LINE_MIN, 8);
        // Choose draws at your edge estimate times the tier; For you follows the staircase
        const p = pk ? ooEdgeD(edge, "line", pk) : stair.d;
        ps[k] = p;
        return { kind: "across", p, k: p < 3 ? 6 : 4, cats, record: false, hold: true, note: k === 0 && !ln.n ? "Look for the word's edge, not the biggest difference" : null };
      },
      onEnd: s => {
        // every answer, in either mode, moves the edge estimate by the push actually drawn
        s.res.forEach((r, k) => { if (ps[k] != null) ooEdgeUpdate(edge, "line", ps[k], !!r.ok); });
        ln.p = +stair.d.toFixed(2); ln.n = (ln.n || 0) + 1; const pb = s.hits > (ln.best || 0); ln.best = Math.max(ln.best || 0, s.hits); save();
        const finish = s.hits >= 6;
        ooResults({ title: "Across the line", s, finish, stars: [finish, finish && s.med != null && s.med <= 4500, finish && s.hits === s.total].map(Number), got: [1, 1, 1], labels: ["Passed", "Quick", "Perfect"], lede: finish ? "You held the word's edge most of the way." : `You need 6 of ${s.total}. Look for where one word turns into the next, not for the biggest difference.`, pb, next: null,
          again: ooAcrossRun, diff: ooPickLine("line"), score: `${s.hits} of ${s.total} right`, back: "Back to Train", onBack: () => go("gym") });
      } });
  };
  eyeNamesReady().then(go2, go2);
}
