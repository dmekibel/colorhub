"use strict";
// Screenshot states for Odd one out (index.html#shot=gx:oo:<state>, through gymShot in js/gym.js). In memory only.
//   map · fresh · shelf · eye · daily (gameDailyBoard in a host box) · result · line · line-ans · line-miss · whose · wplay (Whose palette? playing)
//   lv-<n> (level n, first round) · lv-<n>-ans (answered right) · lv-<n>-miss (answered wrong) · lv-<n>-dir (which way)
//   mix-<id>[-ans] · step-<kind>
function ooShotState() {
  const st = ooS(), day = today();
  st.lv = 12; st.sets = 31; st.last = today();
  for (let i = 0; i < 12; i++) st.stars[i] = [1, i % 3 !== 1 ? 1 : 0, i % 4 !== 2 ? 1 : 0];
  st.best = { 0: 2140, 5: 3900 };
  const m = st.model;
  Object.assign(m.j, { hue: { r: Math.log(1.9), n: 64 }, light: { r: Math.log(1.4), n: 58 }, chroma: { r: Math.log(2.8), n: 51 }, context: { r: Math.log(3.6), n: 40 }, memory: { r: Math.log(4.9), n: 22 } });
  Object.assign(m.f, { Blues: { o: -.25, n: 40 }, Greens: { o: .18, n: 36 }, Reds: { o: -.05, n: 30 }, Yellows: { o: .32, n: 24 }, Purples: { o: .05, n: 20 }, Browns: { o: .1, n: 14 },
    "Blues:hue": { o: -.2, n: 16 }, "Blues:light": { o: .1, n: 14 }, "Blues:chroma": { o: 0, n: 10 }, "Greens:hue": { o: .2, n: 14 }, "Greens:light": { o: -.1, n: 13 }, "Greens:chroma": { o: .15, n: 9 },
    "Reds:hue": { o: 0, n: 12 }, "Reds:light": { o: -.15, n: 12 }, "Yellows:light": { o: .3, n: 8 }, "Yellows:chroma": { o: .2, n: 7 }, "Purples:hue": { o: .1, n: 6 } });
  st.snaps = [[addDays(day, -14), { hue: 3.1, light: 2.2, chroma: 4.2 }], [day, { hue: 1.9, light: 1.4, chroma: 2.8 }]];
  OO_KINDS.forEach(k => { st.seen[ooKindKey(k[0], k[1], k[3] || "")] = 3; });
  OO_LEVELS.forEach(L => { st.seen[ooKindKey(L.v, L.b, L.tw)] = 3; });
  S.scr = { ok: true, t: day };
}
// tap the answer of the round on screen (right, or a wrong tile)
function ooShotTap(right, then) {
  const r = OO_LAST, tiles = document.querySelectorAll(".oo-board .oo-t");
  if (!r || !tiles.length) return;
  if (r.v === "count") { const b = document.querySelector(`[data-k="${right ? r.count : (r.count + 1) % 5}"]`); if (b) b.click(); return then && then(); }
  if (r.none) { const b = document.querySelector("[data-none]"); if (b && right) b.click(); else tiles[0].click(); return then && then(); }
  const ans = r.ans || [];
  if (!right) { const w = [...tiles].find((t, i) => !ans.includes(i)); if (w) w.click(); return then && then(); }
  ans.slice(0, r.v === "pair" || r.v === "twins" ? 2 : 1).forEach(i => tiles[i] && tiles[i].click());
  if (then) then();
}
function ooShot(arg) {
  document.documentElement.classList.add("oo-shotmode");   // headless screenshots don't run entrance animations
  const [what, a, b] = (arg || "map").split("-");
  if (what === "fresh") { if (S.games) delete S.games.oo; S.scr = { ok: true, t: today() }; return ooMap(); }
  // the very first tap: straight into level 1, taught by doing (first-nudge waits for the nudge)
  if (what === "first") { if (S.games) delete S.games.oo; S.scr = { ok: true, t: today() }; return ooEnter(); }
  ooShotState();
  if (what === "map") return ooMap();
  if (what === "back") { ooS().last = addDays(today(), -1); ooS().fresh = 12; return ooMap(); }
  if (what === "line") {
    ooAcross();
    if (a === "ans" || a === "miss") return setTimeout(() => { const r = OO_LAST, t = document.querySelectorAll(".oo-board .oo-t"); if (!r || !t.length) return; t[a === "ans" ? r.ans[0] : (r.ans[0] + 1) % t.length].click(); }, 2600);
    return;
  }
  if (what === "shelf") { go("gym"); return setTimeout(() => { const s = document.querySelector(".oo-shelf"); if (s) s.scrollIntoView({ block: "center" }); }, 300); }
  if (what === "eye") return ooEyePage();
  // the daily seed board as a step inside a host screen (L25 owns the daily screens)
  if (what === "daily") { const el = show(`<div class="oo-stepbox" style="flex:1;display:flex;flex-direction:column;min-height:0"></div>`, "fixed drill station oo-play"), box = el.querySelector(".oo-stepbox"); return gameDailyBoard(box).then(r => { box.innerHTML = `<p class="oo-fb ok" style="margin-top:40vh">${esc(r.text)}</p>`; }); }
  if (what === "result") {
    const res = [{ ok: 1, ms: 1800, act: 4.1 }, { ok: 1, ms: 2400, act: 2.9 }, { ok: 0, ms: 5200, act: 1.9, base: "#5B7FA6", odd: "#5E86AE" }, { ok: 1, ms: 2100, act: 3.8 }, { ok: 1, ms: 3300, act: 2.2 }, { ok: 0, ms: 6100, act: 1.6, base: "#7A9A62", odd: "#7FA065" }];
    return ooResults({ title: "Level 7 · Paint strip", s: { res, hits: 4, total: 6, pts: 3120, min: 2.2, med: 2400, hint: false }, finish: true, stars: [1, 1, 1], got: [1, 1, 1], pb: true, unlocked: true, next: 7, again: () => ooPlayLevel(6), score: "4 of 6 right" });
  }
  if (what === "whose") return ooWhose();
  if (what === "wplay") return ooWhoseLoad().then(() => ooRun({ label: "Painters", total: 6, combo: true, cls: "oo-whose", gen: () => ({ kind: "whose", record: false, hold: true }), onEnd: () => ooMap() }));
  if (what === "lv") {
    const i = clamp((+a || 1) - 1, 0, OO_LEVELS.length - 1), L = OO_LEVELS[i];
    ooPlayLevel(i);
    const wait = L.tw === "flash" ? 1400 : L.b === "painting" ? 1800 : 500;
    if (b === "ans") return setTimeout(() => ooShotTap(true), wait);
    if (b === "miss") return setTimeout(() => ooShotTap(false), wait);
    if (b === "dir") return setTimeout(() => { const r = OO_LAST, t = document.querySelectorAll(".oo-board .oo-t")[r.ans[0]]; if (t) t.click(); }, wait);
    if (b === "hint") return setTimeout(() => { const h = document.querySelector("[data-hint]"); if (h) h.click(); }, wait);
    return;
  }
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
