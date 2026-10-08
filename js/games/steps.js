"use strict";
// GAME_STEPS: every Train game as a 10-second single round, so the Journey and lessons can drop one in.
// Same contract as PR_STEPS in js/practice.js (L4):
//   GAME_STEPS[kind] = { by, name, render(container, opts) -> Promise<{ ok, ms, answer, d, act, kind, judg }> }
//   container  an empty element the step fills completely (a flex column: question, board, foot). The step owns
//              everything inside it, including its answer controls and its own "Next" button; it never touches
//              anything outside (progress bars, scores and results belong to the caller).
//   opts       all optional: { colors: [hex] (build the board from these: today's words, a painting, a photo),
//              d: the difference in ΔE00 (default: drawn near the learner's own threshold at an easy-medium tier),
//              tier: "intro" | "easy" | "medium" | "hard" (default "easy"), feedback: true (false = resolve straight
//              after the answer, no line and no Next), record: true (false = don't update the eye model),
//              next: "Next" (the button's label), note (one quiet line above the step) }
//   result     ok, ms (time to answer), answer ({ kind: "pick", h } with the picked color, or { kind: "count", n },
//              { kind: "word", w }), d (asked), act (the difference as drawn), kind, judg (the judgment it measured).
// Misses are logged as confusion events (learnerLog, else S.gymMiss) exactly as in the station.
const GAME_STEPS = {};
const OO_STEP_KINDS = {
  "odd-one": { v: "one", b: "grid", n: 3, name: "Odd one out" },
  "odd-pair": { v: "pair", b: "grid", n: 4, name: "Odd pair" },
  "odd-group": { v: "group", b: "grid", n: 5, name: "Hidden shape" },
  "how-many": { v: "count", b: "grid", n: 4, name: "How many?" },
  "twins": { v: "twins", b: "grid", n: 3, name: "Twins" },
  "which-way": { v: "which", b: "grid", n: 3, name: "Which way?" },
  "odd-ring": { v: "one", b: "ring", n: 8, name: "Odd one out (ring)" },
  "odd-strip": { v: "one", b: "strip", n: 6, name: "Paint strip" },
  "odd-ground": { v: "one", b: "busy", n: 3, name: "Odd one out on a colored ground" },
};
const OO_STEP_MIX = { "what-changed": "changed", "out-of-order": "outoforder", "rebuild": "rebuild", "was-it-there": "wasthere", "imposter": "imposter", "n-back": "nback", "whose-palette": "whose", "across-the-line": "across", "painters-pairs": "pairs" };
const OO_STEP_NAMES = { whose: "Whose palette?", across: "Across the line", pairs: "Painters' pairs" };
function ooStepFrame(box, opts) {
  box.innerHTML = `<div class="oo-step">${opts.note ? `<p class="note">${esc(opts.note)}</p>` : ""}<h2 class="oo-sq"></h2><div class="oo-sstage"></div><div class="oo-sfoot"></div></div>`;
  return { q: box.querySelector(".oo-sq"), stage: box.querySelector(".oo-sstage"), foot: box.querySelector(".oo-sfoot"), el: box };
}
function ooStepEnd(ui, res, line, opts, resolve) {
  if (opts.feedback === false) return resolve(res);
  ui.foot.innerHTML = `<div class="oo-rev"><p class="oo-fb${res.ok ? " ok" : ""}">${line}</p><button class="btn" data-next>${esc(opts.next || "Next")} ${ICON.arrow}</button></div>`;
  ui.foot.querySelector("[data-next]").onclick = () => resolve(res);
}
Object.entries(OO_STEP_KINDS).forEach(([kind, K]) => {
  GAME_STEPS[kind] = { by: "pick", name: K.name, render(box, opts = {}) {
    const ui = ooStepFrame(box, opts), set = opts.colors ? ooSetHexes(opts.colors) : null;
    const sp = ooSpec({ v: K.v, b: K.b, n: K.n }, 0, { set: set && set.length ? set : null, tier: opts.tier || "easy", d: opts.d != null ? opts.d : null });
    const r = ooRound(sp); r.kindKey = sp.kind;
    return ooAsk(ui, r, { none: K.b === "busy", feedback: opts.feedback }).then(res => new Promise(resolve => {
      if (opts.record !== false) { ooRecord(r, res); save(); }
      if (!res.ok && res.picked) ooLogMiss(res.right, res.picked, { game: "step:" + kind, judg: r.judg, d: res.act });
      const out = { ok: res.ok, ms: res.ms, d: r.d, act: res.act, kind, judg: r.judg,
        answer: res.said != null ? (typeof res.said === "number" ? { kind: "count", n: res.said } : { kind: "word", w: res.said }) : { kind: "pick", h: res.picked || (res.ok ? r.odd : null) } };
      ooStepEnd(ui, out, ooLine(r, res, "board"), opts, resolve);
    }));
  } };
});
Object.entries(OO_STEP_MIX).forEach(([kind, id]) => {
  const g = OO_MIX.find(m => m.id === id);
  GAME_STEPS[kind] = { by: id === "whose" || id === "imposter" || id === "across" || id === "pairs" ? null : "pick", name: g ? g.name : OO_STEP_NAMES[id], render(box, opts = {}) {
    const ui = ooStepFrame(box, opts), set = opts.colors ? ooSetHexes(opts.colors) : null;
    const it = ooMixIt(id, 0, { set: set && set.length ? set : null });
    if (opts.d != null) it.d = opts.d;
    // step-sized: a smaller board, a shorter sequence
    Object.assign(it, { n: 3, k: id === "rebuild" ? 4 : 6, len: 7, look: 1500 });
    if (id === "across") Object.assign(it, { p: opts.d != null ? opts.d : clamp(+((ooS().line || {}).p) || OO_LINE_P0, OO_LINE_MIN, 8), k: 4, record: false });
    if (id === "pairs") Object.assign(it, { variant: "love", tier: opts.tier || "easy", record: false });
    const go = id === "whose" ? ooWhoseLoad() : id === "pairs" ? ooPairsLoad() : id === "across" ? eyeNamesReady() : Promise.resolve(true);
    return go.then(() => OO_MIXPLAY[id](ui, it)).then(res => new Promise(resolve => {
      if (opts.record !== false && it.judg && res.act > 0 && !res.noModel) { ooUpdate(ooS().model, it.judg, ooFam(res.right || "#808080"), res.act / (it.vf || 1), !!res.ok, it.g || 0); save(); }
      if (!res.ok && res.picked && res.right) ooLogMiss(res.right, res.picked, { game: "step:" + kind, judg: it.judg, d: res.act });
      ooStepEnd(ui, { ok: res.ok, ms: res.ms, d: it.d, act: res.act, kind, judg: it.judg, answer: { kind: "pick", h: res.picked || null } }, res.line || "", opts, resolve);
    }));
  } };
});
