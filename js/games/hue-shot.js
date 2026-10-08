"use strict";
// Screenshot states for Gradients (index.html#shot=gx:hue:<state>, through gymShot in js/gym.js). In memory only.
//   map · fresh · back · shelf · first (the teaching board) · taught (it, solved) · empty (Your colors, no colors yet)
//   lv-<world>-<level> (playing) · lv-<w>-<n>-sel (a tile picked up) · lv-<w>-<n>-solved (the reveal) · lv-<w>-<n>-res (results)
//   lv-<w>-<n>-over (out of moves / time) · daily · daily-res (share card) · step (GAME_STEPS.hue in a host)
function hgShotState() {
  const st = hgS(), day = today();
  st.taught = 1; st.plays = 23; st.last = day; st.k = .92; st.seenOpen = [0, 1, 4];
  const corners = (w, i) => hgMiniCorners(w, i);
  for (let i = 0; i < 12; i++) st.done["painters:" + i] = { s: [1, i % 3 !== 1 ? 1 : 0, i % 4 !== 2 ? 1 : 0], m: 20 + i * 3, c: corners(0, i), t: day };
  for (let i = 0; i < 6; i++) st.done["gardens:" + i] = { s: [1, i % 2, 1], m: 30 + i * 2, c: corners(1, i), t: day };
  Object.assign(st.ax, { light: { m: 140, e: 31 }, chroma: { m: 96, e: 12 }, hue: { m: 120, e: 18 } });
  if (!S.favs || !Object.keys(S.favs).length) S.favs = Object.fromEntries(["#E8A0B4", "#3A5BB8", "#F4A261", "#2E8B57", "#8E4585", "#F2D24B", "#5F9EA0", "#C2456B", "#9AAF7E", "#D8BFD8"].map(h => [h, { n: "", at: day }]));
  S.scr = { ok: true, t: day };
}
function hgShot(arg) {
  document.documentElement.classList.add("oo-shotmode");
  const [what, a, b, c] = (arg || "map").split("-");
  if (what === "fresh" || what === "first" || what === "taught") {
    if (S.games) delete S.games.hue; S.scr = { ok: true, t: today() };
    if (what === "fresh") return hgMap();
    hgEnter();
    if (what === "taught") setTimeout(() => HG_LIVE && hgAutoSolve(HG_LIVE), 600);
    return;
  }
  hgShotState();
  if (what === "map") return hgMap(a != null ? +a : undefined);
  if (what === "back") { hgS().last = addDays(today(), -1); return hgMap(); }
  if (what === "empty") { S.favs = {}; S.palettes = []; S.cards = {}; return hgMap(4); }
  if (what === "shelf") { go("gym"); return setTimeout(() => { const s = document.querySelector(".hg-shelf"); if (s) s.scrollIntoView({ block: "center" }); }, 300); }
  const after = (state, ms = 500) => setTimeout(() => {
    const live = HG_LIVE; if (!live) return;
    if (state === "sel") { const s = live.at.findIndex((t, k) => !live.board.anchors.includes(k) && !hgHome(live.board, live.at, k)); const el = live.el.querySelector(`.hg-s[data-s="${s}"]`); if (el) el.click(); }
    if (state === "solved" || state === "res") { hgAutoSolve(live); if (state === "res") setTimeout(() => { const g = document.querySelector("[data-go]"); if (g) g.click(); }, 1400); }
    if (state === "over") { live.st.moves = 0; const s = live.at.findIndex((t, k) => !live.board.anchors.includes(k)); const o = live.at.findIndex((t, k) => k !== s && !live.board.anchors.includes(k)); for (let n = 0; n < 60 && !live.st.over && !live.st.done; n++) live.swap(s, o); }
  }, ms);
  if (what === "lv") {
    const w = clamp(+a || 0, 0, HG_WORLDS.length - 1), i = clamp((+b || 1) - 1, 0, HG_WORLDS[w].n - 1);
    hgWhenSrc(w, () => { hgPlay(w, i); if (c) after(c, hgRung(w, i).t === "blind" ? 900 : 500); });
    return;
  }
  if (what === "daily") { hgDaily(); if (a === "res") after("res"); return; }
  if (what === "step") {
    const el = show(`<header class="deck-top"><button class="icon-btn" aria-label="Close">${ICON.x}</button><div class="segs"><i></i><i></i><i></i><i></i></div></header><div class="hg-stepbox" style="flex:1;display:flex;flex-direction:column;min-height:0;padding-top:12px"></div>`, "fixed drill station hg-play");
    const box = el.querySelector(".hg-stepbox");
    GAME_STEPS.hue.render(box, { colors: ["#2E8B57", "#E8C25A", "#3D7DB8", "#C2456B"] }).then(r => { box.innerHTML = `<p class="oo-fb">Step resolved: ${r.ok ? "right" : "missed"}</p>`; });
    if (a === "solved") after("solved", 700);
    return;
  }
  return hgMap();
}
