"use strict";
// Screenshot states for Odd one out (index.html#shot=gx:oo:<state>, through gymShot in js/gym.js). In memory only.
//   map · fresh · shelf · eye · daily (gameDailyBoard in a host box) · result · line · line-ans · line-miss · whose · wplay (Whose palette? playing)
//   first (the first 3 x 3 board) · grad1d / grad2d (a gradient round) · combo (a combined-axis round) ·
//   k2 (a 2-odd round) · k4 (a 4-odd round) · zen (Zen mode)
//   ans (tap the right tile) · miss (tap a wrong tile) · end (the end screen) · mix-<id>[-ans] · step-<kind>
function ooShotState() {
  const st = ooS(), day = today();
  st.sets = 1; st.last = day;
  return st;
}
// tap the answer of the round on screen (right, or a wrong tile)
function ooShotTap(right, then) {
  const r = OO_LAST, tiles = document.querySelectorAll(".oo-board .oo-t");
  if (!r || !tiles.length) return;
  if (r.v === "count") { const b = document.querySelector(`[data-k="${right ? r.count : (r.count + 1) % 5}"]`); if (b) b.click(); return then && then(); }
  if (r.none) { const b = document.querySelector("[data-none]"); if (b && right) b.click(); else tiles[0].click(); return then && then(); }
  const ans = r.ans || [];
  if (!right) { const w = [...tiles].find((t, i) => !ans.includes(i)); if (w) w.click(); return then && then(); }
  ans.slice(0, r.v === "pair" || r.v === "twins" ? 2 : r.k > 1 ? r.k : 1).forEach(i => tiles[i] && tiles[i].click());
  if (then) then();
}
function ooShot(arg) {
  document.documentElement.classList.add("oo-shotmode");   // headless screenshots don't run entrance animations
  const [what, a, b] = (arg || "map").split("-");
  const fresh = () => { if (S.games) delete S.games.oo; S.scr = { ok: true, t: today() }; };
  if (what === "fresh") { fresh(); return ooMap(); }
  // the very first tap: straight into a 3 x 3 board, taught by doing
  if (what === "first") { fresh(); return ooEnter(); }
  if (what === "map") { ooShotState(); return ooMap(); }
  if (what === "grad1d") { fresh(); return ooMap({ forceShape: "grad1d" }); }
  if (what === "grad2d") { fresh(); return ooMap({ forceShape: "grad2d" }); }
  if (what === "combo") { fresh(); return ooMap({ forceShape: "combo" }); }
  if (what === "k2") { fresh(); return ooMap({ forceShape: "k2" }); }
  if (what === "k4") { fresh(); return ooMap({ forceShape: "k4" }); }
  if (what === "zen") { fresh(); return ooMap({ zen: true }); }
  if (what === "ans") { fresh(); ooMap(); return setTimeout(() => ooShotTap(true), 900); }
  if (what === "miss") { fresh(); ooMap(); return setTimeout(() => ooShotTap(false), 900); }
  if (what === "end") {
    ooShotState();
    const model = ooS().model;
    const startTh = { hue: 3.4, light: 2.6, chroma: 3.9 };
    Object.assign(model.j, { hue: { r: Math.log(2.1), n: 46 }, light: { r: Math.log(2.3), n: 40 }, chroma: { r: Math.log(2.8), n: 34 } });
    return ooSimpleEnd(false, startTh, model, { round: 22, hits: 17, cols: 6 }, z => ooMap({ zen: z }));
  }
  if (what === "line") {
    ooAcross();
    if (a === "ans" || a === "miss") { const tap = (n = 0) => { const r = OO_LAST, t = document.querySelectorAll(".oo-line .oo-board .oo-t"); if (!r || !t.length) return n < 40 && setTimeout(() => tap(n + 1), 250); t[a === "ans" ? r.ans[0] : (r.ans[0] + 1) % t.length].click(); }; return setTimeout(tap, 900); }
    return;
  }
  if (what === "shelf") { go("gym"); return setTimeout(() => { const s = document.querySelector(".oo-shelf"); if (s) s.scrollIntoView({ block: "center" }); }, 300); }
  if (what === "eye") return ooEyePage();
  // the daily seed board as a step inside a host screen (L25 owns the daily screens)
  if (what === "daily") { const el = show(`<div class="oo-stepbox" style="flex:1;display:flex;flex-direction:column;min-height:0"></div>`, "fixed drill station oo-play"), box = el.querySelector(".oo-stepbox"); return gameDailyBoard(box).then(r => { box.innerHTML = `<p class="oo-fb ok" style="margin-top:40vh">${esc(r.text)}</p>`; }); }
  if (what === "result") {
    const res = [{ ok: 1, ms: 1800, act: 4.1 }, { ok: 1, ms: 2400, act: 2.9 }, { ok: 0, ms: 5200, act: 1.9, base: "#5B7FA6", odd: "#5E86AE" }, { ok: 1, ms: 2100, act: 3.8 }, { ok: 1, ms: 3300, act: 2.2 }, { ok: 0, ms: 6100, act: 1.6, base: "#7A9A62", odd: "#7FA065" }];
    return ooResults({ title: "A set of your colors", s: { res, hits: 4, total: 6, pts: 3120, min: 2.2, med: 2400, hint: false }, finish: true, stars: [1, 1, 1], got: [1, 1, 1], pb: true, next: null, again: () => ooMap(), score: "4 of 6 right" });
  }
  if (what === "whose") return ooWhose();
  // Painters' pairs: pairs (first round), pairs-ans (answered: lifts and three paintings)
  if (what === "pairs") return ooPairsLoad().then(() => { ooRun({ label: "Pairs", total: 6, combo: true, cls: "oo-pairsrun", gen: () => ({ kind: "pairs", variant: a === "ans" ? "love" : "group", tier: "easy", record: false, hold: true }), onEnd: () => ooMap() });
    if (a === "ans") setTimeout(() => { const b = document.querySelector(".oo-pc"); if (b) b.click(); }, 400); });
  if (what === "wplay") return ooWhoseLoad().then(() => ooRun({ label: "Painters", total: 6, combo: true, cls: "oo-whose", gen: () => ({ kind: "whose", record: false, hold: true }), onEnd: () => ooMap() }));
  if (what === "mix") {
    ooPlayMix(a || "changed");
    if (b === "ans") {
      const tapRight = () => {
        const id = a || "changed";
        if (id === "imposter") { const btns = document.querySelectorAll(".oo-ic"); if (btns[0]) btns[0].click(); }
        if (id === "wasthere") { const c = document.querySelectorAll(".oo-chips.five .oo-chip"); if (c[0]) c[0].click(); }
        if (id === "outoforder") { const c = document.querySelectorAll(".oo-oc"); if (c[0]) c[0].click(); }
        if (id === "changed") { const c = document.querySelectorAll(".oo-board .oo-t"); if (c[0]) c[0].click(); }
      };
      return setTimeout(tapRight, a === "wasthere" ? 3700 : a === "changed" ? 2600 : 700);
    }
    return;
  }
  if (what === "step") {
    const kind = [a, b].filter(Boolean).join("-") || "odd-one";
    const el = show(`<header class="deck-top"><button class="icon-btn" aria-label="Close">${ICON.x}</button><div class="segs"><i></i><i></i><i></i><i></i></div></header><div class="oo-stepbox" style="flex:1;display:flex;min-height:0;padding-top:12px"></div>`, "fixed drill station oo-play");
    const box = el.querySelector(".oo-stepbox");
    if (GAME_STEPS[kind]) GAME_STEPS[kind].render(box, { colors: kind === "odd-one" ? ["#2E8B57", "#3CB371", "#228B22", "#6B8E23"] : null }).then(r => { box.innerHTML = `<p class="oo-fb">Step resolved: ${r.ok ? "right" : "missed"}</p>`; });
    return;
  }
  return ooMap();
}
