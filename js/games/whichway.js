"use strict";
// Which way? (David, 2026-10-10): "A color in the middle, colors all around it... the app gives you a name and
// asks: which one is the MUDDY version of it? Or the brighter one? Or the redder?" A honeycomb (6 around, later
// a square of 8) where every surrounding tile moves the center color along its OWN named direction, and you tap
// the one that matches the word asked. Teaches the modifier vocabulary (CLAUDE.md's naming grammar) by doing,
// not by definition -- the same "many varied examples of one invariant" rule as every other eye-training game
// here (design/DESIGN-CANON.md E3).
//
// Reuses js/games/oo-engine.js's own machinery (never edited -- another lane is reworking Odd one out):
// ooBase, ooMoveDir, ooGapDE, ooCells, ooShuf, ooP, OO_TIER, OO_BREATH, ooTierAt, ooAdjTier, OO_MIN/MAX, lab/lch.
// Rendering reuses js/games/oo-ui.js's ooBoardHTML/ooRipple/ooRun/ooResults/ooPickMount/ooPref/ooPickFor/ooPickLine
// and registers its own station in js/games/oo-mix.js's OO_MIXPLAY map (the same pattern js/games/line.js uses
// for OO_MIXPLAY.across) -- a new key on an existing shared object, never a line of either file rewritten.
//
// The modifier table. js/naming.js's own grammar (pickModifier) has exactly two axes: lightness (light/pale vs
// dark/deep) and chroma (greyish/dusty vs vivid/bright), plus five hue leans. The words below are that same
// grammar, recombined into directions in Lab space (dL, da, db), built from the ANCHOR's own hue (ua, ub = its
// unit a*/b*) so "pale" or "deep" always move toward or away from THIS color's own saturation, never a fixed hue:
//   lighter    dL+                               darker     dL-
//   vivid      dC+ (toward the anchor's own hue)  greyer     dC- (toward grey)
//   pale       dL+ and dC-  (naming.js "pale": light, and the target reads as low-chroma)
//   deep       dL- and dC+  (naming.js "deep": dark, and the target still reads as carrying chroma -- "richer")
//   dusty      dL+ (slight) and dC-  (the duller cousin of pale: not as light, just less saturated)
//   muddy      dL- and dC- and a small pull toward the warm (orange) quadrant of a*/b* -- the one word that isn't
//              a pure L/C move; never shown or spoken as "warmer" (CLAUDE.md bans that word as a label, oo-engine
//              ooDirWord does the same) -- it's internal composition only, the LABEL stays "muddy"
//   brighter   dL+ and dC+ (lighter AND more vivid at once -- never "warmer")
//   redder / yellower / greener / bluer   the four fixed a*/b* axis directions (same four as ooPull in
//              oo-engine.js's ooDirWord): +a, +b, -a, -b
// 13 words, one vector table, documented here and nowhere else.

const WW_WARM = [0.62, 0.78];   // the small warm (orange) lean "muddy" borrows; not itself a word
function wwVec(word, L0, a0, b0) {
  const C0 = Math.hypot(a0, b0) || 1e-6, ua = a0 / C0, ub = b0 / C0;
  switch (word) {
    case "lighter": return [1, 0, 0];
    case "darker": return [-1, 0, 0];
    case "vivid": return [0, ua, ub];
    case "greyer": return [0, -ua, -ub];
    case "redder": return [0, 1, 0];
    case "greener": return [0, -1, 0];
    case "yellower": return [0, 0, 1];
    case "bluer": return [0, 0, -1];
    case "pale": return [0.85, -ua * 0.8, -ub * 0.8];
    case "deep": return [-0.8, ua * 0.65, ub * 0.65];
    case "dusty": return [0.35, -ua, -ub];
    case "muddy": return [-0.55, -ua * 0.7 + WW_WARM[0] * 0.55, -ub * 0.7 + WW_WARM[1] * 0.55];
    case "brighter": return [0.55, ua * 0.9, ub * 0.9];
    default: return null;
  }
}
const WW_ALL = ["lighter", "darker", "pale", "deep", "dusty", "muddy", "brighter", "vivid", "greyer", "redder", "yellower", "greener", "bluer"];
const WW_LABEL = { lighter: "lighter", darker: "darker", pale: "paler", deep: "deeper", dusty: "dustier", muddy: "muddier", brighter: "brighter", vivid: "more vivid", greyer: "greyer", redder: "redder", yellower: "yellower", greener: "greener", bluer: "bluer" };
// the one-line explanation on reveal (David: "a one-line explanation")
const WW_WHY = {
  lighter: "lighter, nothing else moved", darker: "darker, nothing else moved",
  pale: "lighter and much less saturated", deep: "darker and a little more saturated -- richer",
  dusty: "a touch lighter and quite a bit less saturated", muddy: "darker, greyer, and a touch warmer",
  brighter: "lighter and more saturated at once", vivid: "more saturated, same lightness",
  greyer: "less saturated, same lightness", redder: "pulled toward red", yellower: "pulled toward yellow",
  greener: "pulled toward green", bluer: "pulled toward blue",
};
const wwUnitVec = (word, lab0) => { const v = wwVec(word, ...lab0), n = Math.hypot(...v) || 1; return v.map(x => x / n); };
const wwCos = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];

// ---------- the ladder of boards: 6 around (honeycomb), later 8 around (a square) ----------
const WW_FLOOR = 2;   // ΔE00 (as ooGapDE measures it): a visibility floor, never drawn smaller than this
const WW_TIER_CFG = {
  intro: { b: "honey", n: 7, maxSim: .5 }, easy: { b: "honey", n: 7, maxSim: .62 }, medium: { b: "honey", n: 7, maxSim: .8 },
  hard: { b: "grid", n: 3, maxSim: .9 }, harder: { b: "grid", n: 3, maxSim: .95 }, boss: { b: "grid", n: 3, maxSim: .97 },
};
// distractor words: the target plus `need` others, no two closer (cosine, in THIS anchor's own geometry) than
// maxSim -- "distractors are other directions, never two tiles satisfying the same word" (David's spec). A low
// maxSim keeps easy rounds maximally distinct; a high one lets hard rounds sit real confusables side by side
// ("muddier" vs "dustier" vs "greyer"), which is the difficulty, not a bug.
function wwPickSet(lab0, target, need, maxSim, rnd) {
  const chosen = [target], vecs = [wwUnitVec(target, lab0)];
  const pool = ooShuf(WW_ALL.filter(w => w !== target), rnd);
  for (const w of pool) {
    if (chosen.length >= need + 1) break;
    const uv = wwUnitVec(w, lab0);
    if (vecs.every(c => wwCos(c, uv) <= maxSim)) { chosen.push(w); vecs.push(uv); }
  }
  for (const w of pool) { if (chosen.length >= need + 1) break; if (!chosen.includes(w)) chosen.push(w); }   // relax if the strict pass came up short
  return chosen.length === need + 1 ? chosen : null;
}
// the center cell of a board's geometry (honey's center isn't index 0; grid's is always the middle)
function wwCenterIdx(cells, b) {
  if (b === "grid") return Math.floor(cells.length / 2);
  let best = 0, bd = Infinity;
  cells.forEach((c, i) => { const d = Math.hypot(c.x + c.w / 2 - .5, c.y + c.h / 2 - .5); if (d < bd) { bd = d; best = i; } });
  return best;
}
// one round: the anchor, the board, and which surrounding tile is the asked-for word
function wwBuildRound(rnd, { word, d, cfg }) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const anchor = ooBase(rnd, {});
    const lab0 = lab(anchor);
    const geo = ooCells(cfg.b, cfg.n, rnd), cells = geo.cells, centerIdx = wwCenterIdx(cells, cfg.b);
    const need = cells.length - 1;
    const words = wwPickSet(lab0, word, need, cfg.maxSim, rnd);
    if (!words) continue;
    const surround = ooShuf(cells.map((_, i) => i).filter(i => i !== centerIdx), rnd);
    const colors = cells.map(() => anchor), tileWords = {};
    let targetIdx = -1, targetAct = d, ok = true;
    for (let k = 0; k < words.length; k++) {
      const w = words[k], v = wwVec(w, ...lab0);
      const m = ooMoveDir(anchor, v, d, ooGapDE) || ooMoveDir(anchor, v, d * .7, ooGapDE);
      if (!m) { ok = false; break; }
      const idx = surround[k];
      colors[idx] = m.hex; tileWords[idx] = w;
      if (w === word) { targetIdx = idx; targetAct = m.act; }
    }
    if (!ok || targetIdx < 0) continue;
    return { b: cfg.b, n: cfg.n, cells, cols: geo.cols, aspect: geo.aspect, colors, centerIdx, anchor, lab0, tileWords, targetIdx, word, d, act: targetAct, g: 1 / need };
  }
  return null;
}

// ---------- per-word mastery (David: "per-word mastery tracked -- some words are harder") ----------
// The same item-response update as oo-engine's ooUpdate (ooP is reused directly), keyed by word instead of by
// hue/light/chroma -- a separate small model, S.games.ww, so it never touches the Odd one out eye profile.
const WW_START = 6, WW_MIN = .6, WW_MAX = 20;
function wwModel(m) { m = m && typeof m === "object" ? m : {}; m.w = m.w && typeof m.w === "object" ? m.w : {}; return m; }
const wwTheta = (m, w) => { const r = wwModel(m).w[w]; return r && isFinite(r.r) ? Math.exp(r.r) : WW_START; };
function wwUpdate(m, w, dEff, ok, g = .15) {
  wwModel(m);
  const r = m.w[w] || (m.w[w] = { r: Math.log(WW_START), n: 0 });
  const p = ooP(dEff, Math.exp(r.r), g), e = (ok ? 1 : 0) - p, K = Math.max(.07, .55 / Math.sqrt(1 + r.n / 3));
  r.r = Math.log(Math.max(WW_MIN, Math.min(WW_MAX, Math.exp(r.r - K * e))));
  r.n++;
  return { p };
}
// the next word to ask: weighted toward whichever has the least evidence so far (interleaved, spaced over a session)
function wwPickWord(m, rnd = Math.random) {
  wwModel(m);
  const ws = WW_ALL.map(w => 1 / (1 + ((m.w[w] && m.w[w].n) || 0))), sum = ws.reduce((a, b) => a + b, 0);
  let r = rnd() * sum;
  for (let i = 0; i < WW_ALL.length; i++) { r -= ws[i]; if (r <= 1e-9) return WW_ALL[i]; }
  return WW_ALL[WW_ALL.length - 1];
}
// words you can already pick out at a glance, for Learn to borrow later ("words you know: muddy, dusty...");
// kept here as a standalone reader so this stays additive -- no other screen is edited to call it yet.
function wwWordsKnown(m) {
  wwModel(m);
  return WW_ALL.filter(w => m.w[w] && m.w[w].n >= 6 && Math.exp(m.w[w].r) <= 4.5);
}

// ---------- state: S.games.ww ----------
function wwS() {
  if (!(S.games && typeof S.games === "object")) S.games = {};
  const o = (S.games.ww && typeof S.games.ww === "object") ? S.games.ww : (S.games.ww = {});
  if (!(o.model && typeof o.model === "object")) o.model = {};
  wwModel(o.model);
  o.n = +o.n || 0; o.best = +o.best || 0;
  if (!Array.isArray(o.stars)) o.stars = [0, 0, 0];
  return o;
}

// ---------- the station (OO_MIXPLAY.whichway): board, tap, label, explain, link the real name ----------
const wwSwatch = hex => `<i role="img" aria-hidden="true" style="display:inline-block;width:.8em;height:.8em;margin:0 .06em 0 .2em;border-radius:.16em;vertical-align:-.05em;background:${hex};box-shadow:inset 0 0 0 1px rgba(255,255,255,.2),0 0 0 1px rgba(0,0,0,.12)"></i>`;
const wwLink = (h, n) => `<span class="wl wl-c eye-n" data-swatch="${h}" style="--c:${h}">${esc(n)}</span>`;
// a word, in the upper third of its tile (never bottom-anchored like .oo-tn's default: a hexagon tapers at the
// bottom, so that clips; dead center is taken too, by the ring/miss dot games.css draws there on a hex -- see
// ".oo-hex.ring::after" -- so the label sits just above it, clear of both)
const wwTileLabel = (hex, text) => `<span class="oo-tn" data-ink="${ink(hex)}" style="position:absolute;left:8%;right:8%;top:20%;bottom:auto;text-align:center">${esc(text)}</span>`;
OO_MIXPLAY.whichway = function (ui, it) {
  return new Promise(resolve => {
    const rnd = it.rnd || Math.random;
    let rd = null;
    for (let i = 0, d = it.d; i < 3 && !rd; i++, d *= 1.3) rd = wwBuildRound(rnd, { word: it.word, d, cfg: it.cfg });
    if (!rd) return resolve({ ok: 0, ms: 0, act: 0, noModel: true, line: "No clear round turned up this time, so it's skipped." });
    OO_LAST = { v: "one", ans: [rd.targetIdx], colors: rd.colors };
    const nm = (typeof nameOf === "function" ? nameOf(rd.anchor) : null) || { n: "" };
    const wlabel = WW_LABEL[rd.word] || rd.word;
    ui.q.innerHTML = `Which is the <em>${esc(wlabel)}</em> <span style="white-space:nowrap">${esc(nm.n || "color")}${wwSwatch(rd.anchor)}?</span>`;
    ui.stage.innerHTML = `<div class="oo-lwrap">${ooBoardHTML(rd)}</div>`;
    const board = ui.stage.querySelector(".oo-board"), tiles = [...board.querySelectorAll(".oo-t")];
    const anchorTile = tiles[rd.centerIdx];
    anchorTile.disabled = true; anchorTile.classList.add("same");   // the anchor is shown (dashed ring), not asked about -- its name is already in the question above
    const t0 = performance.now();
    tiles.forEach((t, i) => {
      if (i === rd.centerIdx) return;
      t.onclick = () => {
        tiles.forEach(x => x.disabled = true);
        t.classList.remove("tap"); void t.offsetWidth; t.classList.add("tap");
        const ok = i === rd.targetIdx, ms = performance.now() - t0, youWord = rd.tileWords[i];
        tiles[rd.targetIdx].classList.add("ring"); if (!ok) t.classList.add("miss");
        buzz(ok ? 10 : [10, 40, 10]); if (ok) ooRipple(board, t);
        // every surrounding tile learns its own word (David: "the chosen tile and the right tile are labeled with their words")
        tiles.forEach((x, j) => {
          if (j === rd.centerIdx) return;
          const w = tileWordsOf(rd, j);
          if (w && (j === i || j === rd.targetIdx) && x.getBoundingClientRect().width >= 60) x.insertAdjacentHTML("beforeend", wwTileLabel(rd.colors[j], WW_LABEL[w] || w));
        });
        const rightName = (typeof nameOf === "function" ? nameOf(rd.colors[rd.targetIdx]) : null) || { n: "" };
        const why = WW_WHY[rd.word] || "";
        const wlabelCap = wlabel.charAt(0).toUpperCase() + wlabel.slice(1);
        const youLine = ok ? "" : ` You picked <em>${esc(WW_LABEL[youWord] || youWord || "a different direction")}</em>.`;
        const line = `${ok ? "Right: " : ""}<em>${esc(wlabelCap)}</em> means ${esc(why)}.${youLine}${rightName.n ? ` Nearest name: ${wwLink(rd.colors[rd.targetIdx], rightName.n)}.` : ""}`;
        // the full-screen miss compare (js/misscompare.js) gets its own plain sentence: its default auto-generates
        // a "lighter/greener than" line built for two real colors, which reads oddly for two modifier-word labels
        const mcLine = ok ? "" : `You picked ${WW_LABEL[youWord] || youWord || "a different one"}. The word asked for was ${wlabel}: ${why}.`;
        if (typeof learnerLog === "function" && rightName.n) {
          learnerLog({ type: "answer", color: { n: rightName.n, h: rd.colors[rd.targetIdx] }, ok, by: "game", ms, src: "whichway" });
          if (!ok) { const picked = (typeof nameOf === "function" ? nameOf(rd.colors[i]) : null) || {}; if (picked.n && picked.n !== rightName.n) learnerLog({ type: "confuse", a: { n: rightName.n, h: rd.colors[rd.targetIdx] }, b: { n: picked.n, h: rd.colors[i] }, src: "whichway" }); }
        }
        resolve({ ok: ok ? 1 : 0, ms, act: rd.act, picked: ok ? null : rd.colors[i], right: rd.colors[rd.targetIdx], word: rd.word, g: rd.g, noModel: true, hold: true, line,
          mc: ok ? null : { you: { n: WW_LABEL[youWord] || youWord, h: rd.colors[i] }, was: { n: wlabel, h: rd.colors[rd.targetIdx] }, line: mcLine } });
      };
    });
  });
};
const tileWordsOf = (rd, i) => rd.tileWords[i];

// ---------- the session: tap in, no setup menu, "For you" / "Choose" like every other game here ----------
function wwPlay(opts = {}) {
  if (!S.scr && typeof ooShotMode === "function" && !ooShotMode() && typeof screenCheck === "function") return screenCheck(() => wwPlay(opts));
  const el = show(`
    <header class="deck-top"><button class="icon-btn" data-close aria-label="Back">${ICON.back}</button></header>
    <h1 class="title-1 oo-title">Which way?</h1>
    <p class="lede">A color in the middle, six around it in a honeycomb (eight, in a square, once you're quick). Each one moved a different way -- lighter, muddier, more vivid, redder... Tap the one that matches the word.</p>
    <div class="oo-pk-host" data-pk-host></div>
    <div class="stack" style="margin-top:28px"><button class="btn" data-go>Play 12 rounds ${ICON.arrow}</button></div>`, "oo-eye");
  el.querySelector("[data-close]").onclick = () => go("gym");
  ooPickMount(el.querySelector("[data-pk-host]"), "whichway");
  el.querySelector("[data-go]").onclick = () => wwRun(opts);
}
function wwRun(opts = {}) {
  if (opts && opts.type) opts = {};   // called as a click handler
  const st = wwS(), model = st.model, pk = ooPickFor("whichway");
  ooRun({ label: "Which way?", total: 12, combo: true, cls: "ww-run", onQuit: () => go("gym"),
    gen: (k, run) => {
      const novel = st.n < 2, tier = pk || ooAdjTier(ooTierAt(k, novel), run), cfg = WW_TIER_CFG[tier] || WW_TIER_CFG.medium;
      const word = wwPickWord(model, Math.random), d = Math.max(WW_FLOOR, Math.min(OO_MAX, wwTheta(model, word) * (OO_TIER[tier] || 1)));
      return { kind: "whichway", word, d, cfg, rnd: Math.random, record: false, hold: true };
    },
    onAnswer: (res) => { if (res.word) wwUpdate(model, res.word, res.act || WW_FLOOR, !!res.ok, res.g || .15); return null; },
    onEnd: s => {
      st.n = (st.n || 0) + 1; const pb = s.hits > (st.best || 0); st.best = Math.max(st.best || 0, s.hits);
      const finish = s.hits >= 8, old = st.stars || [0, 0, 0];
      const got = [finish, finish && s.med != null && s.med <= 4500, finish && s.hits === s.total];
      st.stars = got.map((x, i) => x || old[i] ? 1 : 0); save();
      ooResults({ title: "Which way?", s, finish, stars: got.map(Number), got: [1, 1, 1], labels: ["Passed", "Quick", "Perfect"],
        lede: finish ? "You're reading these modifier words at a glance." : "You need 8 of 12. Every round is one real direction in color, and the reveal names it every time.",
        pb, next: null, again: () => wwRun(opts), diff: typeof ooPickLine === "function" ? ooPickLine("whichway") : null,
        score: `${s.hits} of ${s.total} right`, back: "Back to Train", onBack: () => go("gym") });
    } });
}

// ---------- the Train shelf and the search drawer ----------
(function () {
  if (typeof R2_IC === "object" && R2_IC && !R2_IC.whichway) {
    // a honeycomb glyph: the board's own look, center + six around -- the same grammar as R2_IC.map
    R2_IC.whichway = `<circle cx="16" cy="16" r="4.2" class="a"/><circle cx="16" cy="6.8" r="3" class="b"/><circle cx="24.4" cy="11.4" r="3"/><circle cx="24.4" cy="20.6" r="3" class="b"/><circle cx="16" cy="25.2" r="3" class="a"/><circle cx="7.6" cy="20.6" r="3"/><circle cx="7.6" cy="11.4" r="3" class="b"/>`;
  }
  if (typeof window !== "undefined") {
    window.TRAIN_TILES = window.TRAIN_TILES || [];
    window.TRAIN_TILES.push({
      id: "whichway", name: "Which way?", icon: "whichway",
      get meta() { const st = wwS(); return st.n ? (st.best ? `Best ${st.best} of 12` : "Played") : "Which one is muddier?"; },
      get played() { return !!wwS().n; },
      open: () => wwPlay(),
    });
  }
  if (typeof featureRegister === "function") featureRegister("which-way", { t: "Which way?", where: "Train · Which way?", words: ["modifier", "muddy", "dusty", "pale", "deep", "brighter", "direction", "hue", "which way"], run: () => wwPlay() });
})();
