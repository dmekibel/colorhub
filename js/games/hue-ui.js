"use strict";
// Gradients (#/hue): the rearrange puzzle. Swap tiles until the gradient flows again. Five worlds of boards whose
// four corners come from real things (paintings, flowers, gems, decades of fashion, your own colors), a daily
// board with a spoiler-free share card, and GAME_STEPS.hue for the Journey. The engine is js/games/hue-engine.js.
// Hooks elsewhere are additive: gym.js (the Train shelf, gx:hue screenshot states), router.js (#/hue…), index.html.
// Every user-visible difference goes through pctFmt (js/core.js): a ΔE00 reads as % of black-to-white.

// ---------- state: S.games.hue (lazily created; unknown keys kept; malformed parts repaired) ----------
// { taught, k (running form), done: { "world:i": { s: [finish, few, noHint], m: best moves, c: corners } },
//   ax: { light|chroma|hue: { m moves, e wrong drops } }, daily: { day: { moves, par, hints, ms } }, att: { id: n }, last, plays }
const hgObj = x => x && typeof x === "object" && !Array.isArray(x);
function hgS() {
  if (!hgObj(S.games)) S.games = {};
  const o = hgObj(S.games.hue) ? S.games.hue : (S.games.hue = {});
  ["done", "daily", "att"].forEach(k => { if (!hgObj(o[k])) o[k] = {}; });
  if (!hgObj(o.ax)) o.ax = {};
  ["light", "chroma", "hue"].forEach(a => { if (!hgObj(o.ax[a])) o.ax[a] = { m: 0, e: 0 }; });
  o.k = isFinite(+o.k) && +o.k > 0 ? clamp(+o.k, .6, 1.6) : 1;
  o.plays = +o.plays || 0;
  if (o.mode !== "choose") o.mode = "you";
  if (!HG_DIFF[o.diff]) o.diff = "medium";
  return o;
}
// "For you" (adaptive, the default) or "Choose" (a fixed difficulty, every level open); remembered
const hgChoosing = () => hgS().mode === "choose";
const hgShotMode = () => typeof SHOT !== "undefined" && !!SHOT;
const hgDone = id => hgS().done[id] || null;
const hgStarsOf = id => { const d = hgDone(id); return d && Array.isArray(d.s) ? d.s : [0, 0, 0]; };
const hgStarTotal = () => Object.values(hgS().done).reduce((a, d) => a + (d && Array.isArray(d.s) ? d.s.filter(Boolean).length : 0), 0);
const hgCleared = w => { let n = 0; for (let i = 0; i < HG_WORLDS[w].n; i++) if (hgDone(HG_WORLDS[w].id + ":" + i)) n++; return n; };
const hgLevelCount = w => w === 4 ? Math.min(HG_WORLDS[4].n, hgYours().length) : HG_WORLDS[w].n;
// nothing is locked, in For you or Choose (David, 2026-10-08): every world and level is open. For you only RECOMMENDS:
// a world is recommended once five levels of the one before it are cleared; Your colors comes with Gems
const hgWorldOpen = w => w >= 0 && w < HG_WORLDS.length;
const hgLevelOpen = (w, i) => hgWorldOpen(w) && i < hgLevelCount(w);
function hgWorldRec(w) {
  if (w === 0) return true;
  if (w === 4) return hgWorldRec(2) || hgCleared(0) >= HG_OPEN_AT;
  return hgCleared(w - 1) >= Math.min(HG_OPEN_AT, hgLevelCount(w - 1));
}
const hgLevelRec = (w, i) => hgWorldRec(w) && i < hgLevelCount(w) && (i === 0 || !!hgDone(HG_WORLDS[w].id + ":" + (i - 1)));
// the level to offer next: the first uncleared open level, latest world first that still has one
function hgNext() {
  for (let w = 0; w < HG_WORLDS.length; w++) {
    if (!hgWorldRec(w)) continue;
    for (let i = 0; i < hgLevelCount(w); i++) if (!hgDone(HG_WORLDS[w].id + ":" + i)) { if (hgLevelRec(w, i)) return { w, i }; break; }
  }
  return { w: 0, i: 0 };
}
// the eye this board is drawn for: the Learner Model's threshold (Odd one out's estimate when it exists)
function hgEye() {
  try { const v = typeof eyeThreshold === "function" ? eyeThreshold(null, "hue") : null; return v > 0 ? v : null; } catch (e) { return null; }
}

// ======================================================================
// Sources: where each board's colors come from, and the page each one opens
// ======================================================================
const hgPctFmt = n => typeof pctFmt === "function" ? pctFmt(n) : n.toFixed(1) + "%";
function hgYours() {
  const out = [], seen = new Set(), add = (o) => { const k = o.pal.slice().sort().join(); if (o.pal.length >= 3 && !seen.has(k)) { seen.add(k); out.push(o); } };
  (Array.isArray(S.palettes) ? S.palettes : []).forEach(p => { if (p && Array.isArray(p.cols)) add({ kind: "palette", id: "pl-" + p.id, title: p.from || "Your palette", line: `Your palette${p.at ? ", kept " + fmtDay(p.at) : ""}`, pal: p.cols.slice(0, 8), open: () => typeof openSavedPalette === "function" ? openSavedPalette(p.id) : go("studio") }); });
  const favs = hgObj(S.favs) ? Object.keys(S.favs).filter(h => /^#[0-9A-F]{6}$/i.test(h)) : [];
  for (let k = 0; k + 4 <= favs.length && out.length < 15; k += 5) add({ kind: "favs", id: "fv-" + k, title: "Your favorites", line: `${Math.min(6, favs.length - k)} of your favorite colors`, pal: favs.slice(k, k + 6), open: () => typeof favShelf === "function" ? favShelf() : go("learn") });
  const mine = (typeof ALL !== "undefined" ? ALL : []).filter(c => S.cards && S.cards[c.id]).map(c => c.h);
  for (let k = 0; k + 4 <= mine.length && out.length < 15; k += 5) add({ kind: "learned", id: "ln-" + k, title: "Colors you've learned", line: "Colors from your reviews", pal: mine.slice(k, k + 6), open: () => go("learn") });
  return out.slice(0, 15);
}
// level i of world w -> { kind, id, title, line, pal, pal2?, open } (null: not there yet, e.g. gems still loading)
function hgSrc(w, i) {
  const W = HG_WORLDS[w];
  if (W.id === "painters") {
    const id = HG_PAINTINGS[i], p = (typeof PAINTINGS !== "undefined" ? PAINTINGS : []).find(x => x.id === "painting-" + id);
    return p ? { kind: "painting", id, title: p.title, line: `${p.artist}, ${p.year}`, pal: p.palette.map(c => c.h), open: () => hgOpenRoute2("#/painting/" + id) } : null;
  }
  if (W.id === "gardens") { const g = HG_GARDENS[i]; return g ? { kind: "flower", id: g.id, title: g.title, line: g.sci, pal: g.pal, open: () => hgOpenRoute2("#/botany/" + g.id) } : null; }
  if (W.id === "gems") {
    const id = HG_GEMS[i], g = window.GEMS && GEMS.gems.find(x => x.id === id);
    return g ? { kind: "gem", id, title: g.title, line: g.dek.split(/ [—-] |\. /)[0].replace(/\.$/, ""), pal: g.palette.map(p => p[0]), open: () => hgOpenRoute2("#/gem/" + id) } : null;
  }
  if (W.id === "decades") {
    const d = HG_DECADES[i], ids = Array.isArray(d) ? d : [d], F = window.FASHION, ds = F ? ids.map(x => F.decades.find(y => y.id === x)).filter(Boolean) : [];
    if (ds.length !== ids.length) return null;
    const both = ds.length > 1;
    return { kind: "fashion", id: ids.join("-"), title: both ? `${ds[0].label} meet the ${ds[1].label}` : `The ${ds[0].label}`, line: both ? "Two decades of fashion, corner to corner" : `Fashion, ${ds[0].years}`,
      pal: both ? ds.flatMap(x => x.swatches.slice(0, 3).map(s => s[0])) : ds[0].swatches.map(s => s[0]), open: () => typeof fashionPage === "function" ? fashionPage("decade-" + ids[0]) : go("explore") };
  }
  return hgYours()[i] || null;
}
const hgSrcName = (w, i) => { const s = hgSrc(w, i); return s ? s.title : HG_WORLDS[w].id === "gems" ? HG_GEMS[i].replace(/-/g, " ").replace(/^./, c => c.toUpperCase()) : ""; };
// open another screen by address (router.js), falling back to Explore
function hgOpenRoute2(hash) { if (typeof openRoute === "function" && openRoute(hash)) return; go("explore"); }
const hgSrcReady = w => HG_WORLDS[w].id !== "gems" || !!window.GEMS;
function hgWhenSrc(w, fn) { if (hgSrcReady(w)) return fn(); if (typeof gmWhen === "function") { hgWait(); gmWhen(fn); } else fn(); }
function hgWait() { show(`<div class="hg-wait"><p class="note">Opening the gem drawer…</p></div>`, "fixed drill station hg-play"); }
const hgDailySrcs = () => [...HG_PAINTINGS.map((_, i) => hgSrc(0, i)), ...HG_GARDENS.map((_, i) => hgSrc(1, i)), ...HG_DECADES.map((_, i) => hgSrc(3, i))].filter(Boolean);

// ======================================================================
// Drawing boards (the play board, minis on the map, the heat map)
// ======================================================================
const HG_CLIP = { dia: "polygon(50% 0,100% 50%,50% 100%,0 50%)", hex: "polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%)" };
const hgPct = x => (x * 100).toFixed(3) + "%";
const hgCellStyle = c => `left:${hgPct(c.x)};top:${hgPct(c.y)};width:${hgPct(c.w)};height:${hgPct(c.h)}${c.k === "poly" ? `;clip-path:polygon(${c.pts})` : HG_CLIP[c.k] ? `;clip-path:${HG_CLIP[c.k]}` : ""}`;
const hgInk = h => lab(h)[0] > 60 ? "d" : "l";
// a small picture of a board: its own shape, colored by the corners (no fitting: cheap enough for every level)
function hgMiniHTML(shape, corners, o = {}) {
  const size = { rect: 4, holes: 6, weave: 4, mirror: 4, diamond: 4, heart: 7, leaf: 7, hex: 2, ring: 12, arch: 8, spiral: 16 }[shape] || 4;
  const geo = hgGeo(shape, size, { K: shape === "ring" ? 2 : 3 }), C = corners && corners.length === 4 ? corners.map(hgOk) : null;
  const cells = geo.cells.map((c, k) => {
    const col = o.locked || !C ? "" : hgHex(hgFieldAt(geo.field === "loop" ? "loop" : geo.field === "path" ? "path" : "bi", c.f && C ? [C[1], C[3], C[0], C[2]] : C, c.u, c.v));
    return `<i class="hg-k-${c.k}" style="${hgCellStyle(c)}${col ? `;--c:${col}` : ""}"></i>`;
  }).join("");
  return `<span class="hg-mini${o.locked ? " locked" : ""}" style="--ar:${geo.aspect.toFixed(3)}" aria-hidden="true">${cells}</span>`;
}
// the corners a level's mini shows before it's played: the first corner set of its source
const HG_MINI_C = new Map();
function hgMiniCorners(w, i) {
  const d = hgDone(HG_WORLDS[w].id + ":" + i); if (d && Array.isArray(d.c) && d.c.length === 4) return d.c;
  const s = hgSrc(w, i); if (!s) return null;
  const key = w + ":" + i + ":" + s.id;
  if (!HG_MINI_C.has(key)) HG_MINI_C.set(key, hgCornerSets(s.pal, hgRnd(hgHash("hg:" + key)), 1)[0]);
  return HG_MINI_C.get(key);
}
function hgBoardHTML(board, at, o = {}) {
  const fixed = new Set(board.anchors);
  const slots = board.geo.cells.map((c, s) => {
    const h = board.hex[at[s]];
    return `<button class="hg-s hg-k-${c.k}${fixed.has(s) ? " fix" : ""}" data-s="${s}" data-ink="${hgInk(h)}" style="${hgCellStyle(c)};--c:${h}" aria-label="${fixed.has(s) ? "Fixed tile" : "Tile"} ${s + 1}"${fixed.has(s) ? ` aria-disabled="true"` : ""}></button>`;
  }).join("");
  return `<div class="hg-board hg-b-${board.geo.shape}${o.cls ? " " + o.cls : ""}" style="--ar:${board.geo.aspect.toFixed(4)}">${slots}</div>`;
}
// the heat map: the board's own shape, each slot shaded by how many wrong tiles were tried there
function hgHeatHTML(board, wrong) {
  const max = Math.max(1, ...wrong), fixed = new Set(board.anchors);
  const cells = board.geo.cells.map((c, s) => {
    const v = wrong[s] / max, col = fixed.has(s) ? "var(--surface-2)" : wrong[s] ? `color-mix(in oklab, #E8C66B ${Math.round(30 + v * 70)}%, #3A342A)` : "var(--surface-3)";
    return `<i class="hg-k-${c.k}${fixed.has(s) ? " fix" : ""}" style="${hgCellStyle(c)};--c:${col}"></i>`;
  }).join("");
  return `<span class="hg-heat" style="--ar:${board.geo.aspect.toFixed(4)}" role="img" aria-label="Where wrong tiles were tried">${cells}</span>`;
}
// the solved board as a still picture (results, share card)
function hgStillHTML(board, cls = "") {
  const fixed = new Set(board.anchors);
  return `<span class="hg-still ${cls}" style="--ar:${board.geo.aspect.toFixed(4)}">${board.geo.cells.map((c, s) => `<i class="hg-k-${c.k}" data-ink="${hgInk(board.hex[s])}" style="${hgCellStyle(c)};--c:${board.hex[s]}"></i>`).join("")}</span>`;
}

// ======================================================================
// The board you play. cfg: { box?, board, at, label, title, note, twist, teach, onSolved(res), onQuit, step }
// Swaps by tap (tile, then tile) or by drag. Each move lands in three beats: the tile lifts (anticipation), flies and
// snaps with a tick (impact), and the two settle. Solved: a ripple from the last tile, then the gaps close into one
// smooth gradient (the reveal), and the source's name comes up.
// ======================================================================
let HG_LIVE = null;   // the board on screen (screenshot states and the smoke test read it)
function hgPlayBoard(cfg) {
  const board = cfg.board, at = cfg.at.slice(), N = at.length, fixed = new Set(board.anchors), tw = cfg.twist;
  const par = hgPar(board, at), cap = tw === "moves" ? hgMoveCap(par) : 0, movable = N - fixed.size, clock = tw === "timer" ? hgClock(movable) : 0;
  const st = { moves: 0, hints: 0, wrong: new Array(N).fill(0), ax: { light: { m: 0, e: 0 }, chroma: { m: 0, e: 0 }, hue: { m: 0, e: 0 }, near: 0 }, t0: performance.now(), sel: null, done: false, over: false, lastS: null, conf: 0, peeks: 3 };
  const head = `
    <header class="deck-top">${cfg.box && !cfg.close ? "" : `<button class="icon-btn" data-close aria-label="Close">${ICON.x}</button>`}
      <div class="hg-track${cap || clock ? "" : " empty"}"><i></i></div>
      <span class="mono hg-moves" aria-live="polite">${cap ? `0 of ${cap}` : "0 moves"}</span></header>
    <div class="drill-head hg-head"><h2 id="hgq">${cfg.title}</h2><p class="note" id="hgnote">${cfg.note || ""}</p></div>
    <div class="drill-stage hg-stage" id="hgstage">${hgBoardHTML(board, at)}</div>
    <div class="drill-foot hg-foot" id="hgfoot"></div>`;
  let el;
  if (cfg.box) { cfg.box.innerHTML = `<div class="hg-inbox station">${head}</div>`; el = cfg.box; }
  else el = show(head, "fixed drill station hg-play" + (cfg.cls ? " " + cfg.cls : ""));
  const q = el.querySelector("#hgq"), note = el.querySelector("#hgnote"), foot = el.querySelector("#hgfoot"), bd = el.querySelector(".hg-board");
  const slots = [...bd.querySelectorAll(".hg-s")], movesEl = el.querySelector(".hg-moves"), track = el.querySelector(".hg-track i");
  const live = HG_LIVE = { board, at, st, par, el, solve: () => hgAutoSolve(live), swap: (a, b) => move(a, b, a) };
  const paint = s => { const h = board.hex[at[s]]; slots[s].style.setProperty("--c", h); slots[s].dataset.ink = hgInk(h); };
  const quit = () => { stopClock(); HG_LIVE = null; cfg.onQuit ? cfg.onQuit() : hgMap(); };
  const cb = el.querySelector("[data-close]"); if (cb) cb.onclick = quit;
  if (!cfg.box) onKey = e => { if (e.key === "Escape") quit(); };
  const showMoves = () => { movesEl.textContent = cap ? `${st.moves} of ${cap}` : `${st.moves} move${st.moves === 1 ? "" : "s"}`; if (cap) { track.style.width = (100 - st.moves / cap * 100).toFixed(1) + "%"; track.parentNode.classList.toggle("low", cap - st.moves <= 3); } };

  // ---------- the foot: hints, peeks, and the end states ----------
  const footIdle = () => {
    const b = [];
    if (!cfg.teach && !cfg.noHint) b.push(`<button class="oo-pill ghost" data-hint>${st.hints ? `Hint <span class="mono">${st.hints}</span>` : "Hint"}</button>`);
    if (tw === "blind") b.push(`<button class="oo-pill ghost" data-peek>Peek <span class="mono">${st.peeks}</span></button>`);
    foot.innerHTML = b.length ? `<div class="oo-extras">${b.join("")}</div>` : "";
    const hb = foot.querySelector("[data-hint]"); if (hb) hb.onclick = hint;
    const pb = foot.querySelector("[data-peek]"); if (pb) pb.onclick = peek;
  };
  footIdle();

  // ---------- the clock ----------
  let tick = 0, left = clock;
  const stopClock = () => { if (tick) { clearInterval(tick); tick = 0; } };
  if (clock) {
    track.style.width = "100%";
    tick = setInterval(() => {
      if (st.done || !bd.isConnected) return stopClock();
      left = Math.max(0, clock - (performance.now() - st.t0) / 1000);
      track.style.width = (left / clock * 100).toFixed(2) + "%";
      track.parentNode.classList.toggle("low", left <= 10);
      movesEl.textContent = `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, "0")}`;
      if (left <= 0) { stopClock(); overLimit("time"); }
    }, 250);
    cleanup.push(stopClock);
  }
  // past the clock or the move cap: the board stays as you left it. Keep going (no clear) or try again.
  function overLimit(why) {
    if (st.done || st.over) return;
    st.over = why; buzz([10, 40, 10]);
    q.textContent = why === "time" ? "Out of time." : "Out of moves.";
    note.textContent = why === "time" ? "Finish without the clock to see where the colors came from, or try again to clear the level." : "Finish anyway to see where the colors came from, or try again to clear the level.";
    foot.innerHTML = `<div class="hg-two"><button class="oo-pill ghost" data-keep>Keep going</button><button class="oo-pill" data-again>Try again</button></div>`;
    foot.querySelector("[data-keep]").onclick = () => { movesEl.textContent = `${st.moves} moves`; track.parentNode.classList.add("empty"); q.textContent = cfg.title; note.textContent = "No limit now. The level stays open for another try."; footIdle(); };
    foot.querySelector("[data-again]").onclick = () => { stopClock(); cfg.onRetry ? cfg.onRetry() : quit(); };
  }

  // ---------- blind: look first, then the tiles turn face down ----------
  const down = on => slots.forEach((t, s) => { if (!fixed.has(s)) t.classList.toggle("down", on); });
  if (tw === "blind") {
    bd.classList.add("hg-look");
    note.textContent = "Look closely. In a moment the tiles turn face down.";
    later(() => { if (st.done) return; bd.classList.remove("hg-look"); down(true); note.textContent = "Tap a tile to lift it and see its color, then tap where it goes."; buzz(6); }, hgShotMode() ? 400 : 3200);
  }
  function peek() {
    if (st.peeks <= 0 || st.done) return;
    st.peeks--; down(false); buzz(5);
    const pb = foot.querySelector("[data-peek] .mono"); if (pb) pb.textContent = st.peeks;
    if (!st.peeks) { const b = foot.querySelector("[data-peek]"); if (b) b.disabled = true; }
    later(() => { if (!st.done) down(true); }, 1400);
  }

  // ---------- a move ----------
  // a moves tile at[a] into slot b (and b's tile back to a). who = the slot the player picked up.
  function move(a, b, who, viaHint = false) {
    if (st.done || a === b || fixed.has(a) || fixed.has(b)) return;
    const tA = at[a], landing = who === a ? b : a, tile = who === a ? tA : at[b], target = landing;
    const ra = slots[a].getBoundingClientRect(), rb = slots[b].getBoundingClientRect();
    const changed = hgSwap(board, at, a, b);
    if (!viaHint) {
      st.moves++;
      // what this move asked of the eye, and, if the tile isn't home, which way it was off
      const ax = hgAxis(board.hex[who], board.hex[target]); st.ax[ax].m++;
      if (board.hex[tile] !== board.hex[target]) {
        st.wrong[target]++;
        const wax = hgAxis(board.hex[target], board.hex[tile]); st.ax[wax].e++;
        if (de2000(board.hex[target], board.hex[tile]) <= board.step.med * 2.2 && st.conf < 3) { st.conf++; st.ax.near++; try { if (typeof learnerLog === "function") learnerLog({ type: "confuse", color: board.hex[target], b: board.hex[tile], src: "train" }); } catch (e) {} }
      }
    }
    st.lastS = target;
    hgFly([[a, ra, rb], [b, rb, ra]], slots, board, at, () => {
      changed.forEach(paint);
      [a, b].forEach(s => { slots[s].classList.remove("snap"); void slots[s].offsetWidth; slots[s].classList.add("snap"); });
      if (tw === "blind" && !st.done) { [a, b].forEach(s => slots[s].classList.remove("down")); later(() => { if (!st.done) [a, b].forEach(s => { if (!fixed.has(s)) slots[s].classList.add("down"); }); }, 900); }
      if (hgSolved(board, at)) solved();
    });
    buzz(8);
    showMoves();
    if (cap && st.moves >= cap && !hgSolved(board, at)) later(() => overLimit("moves"), 320);
  }
  function hint() {
    if (st.done) return;
    // the misplaced tile whose home sits next to the most settled tiles: the most useful one to fix
    const wrong = at.map((t, s) => s).filter(s => !fixed.has(s) && !hgHome(board, at, s));
    if (!wrong.length) return;
    const score = s => (board.geo.cells[s].nb || []).filter(x => fixed.has(x) || hgHome(board, at, x)).length;
    const home = wrong.sort((x, y) => score(y) - score(x))[0], from = at.findIndex((t, s) => !hgHome(board, at, s) && board.hex[t] === board.hex[home]);
    if (from < 0) return;
    st.hints++;
    move(from, home, from, true);
    slots[home].classList.remove("hinted"); void slots[home].offsetWidth; slots[home].classList.add("hinted");
    const hb = foot.querySelector("[data-hint]"); if (hb) hb.innerHTML = `Hint <span class="mono">${st.hints}</span>`;
  }

  // ---------- input: tap a tile then another, or drag one onto another ----------
  const slotAt = (x, y) => { const e = document.elementFromPoint(x, y), t = e && e.closest && e.closest(".hg-s"); return t && bd.contains(t) ? +t.dataset.s : null; };
  const select = s => { if (st.sel != null) slots[st.sel].classList.remove("sel"); st.sel = s; if (s != null) { slots[s].classList.add("sel"); buzz(5); } };
  let drag = null;
  bd.addEventListener("pointerdown", e => {
    const t = e.target.closest(".hg-s"); if (!t || st.done) return;
    const s = +t.dataset.s;
    if (fixed.has(s)) { lastTap = performance.now(); t.classList.remove("nope"); void t.offsetWidth; t.classList.add("nope"); buzz(4); return; }
    drag = { s, x: e.clientX, y: e.clientY, id: e.pointerId, on: false, ghost: null, over: null };
    try { bd.setPointerCapture(e.pointerId); } catch (er) {}
  });
  bd.addEventListener("pointermove", e => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.on && Math.hypot(dx, dy) > 8) {
      drag.on = true; select(null);
      const r = slots[drag.s].getBoundingClientRect(), g = slots[drag.s].cloneNode(false);
      g.className = slots[drag.s].className.replace(/\b(sel|snap|down)\b/g, "") + " hg-fly hg-drag"; g.removeAttribute("data-s");
      Object.assign(g.style, { left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px" });
      g.style.setProperty("--c", board.hex[at[drag.s]]);
      document.body.appendChild(g); drag.ghost = g; drag.r = r;
      slots[drag.s].classList.add("lift"); buzz(5);
    }
    if (drag.on) {
      drag.ghost.style.transform = `translate(${dx}px,${dy}px) scale(1.12)`;
      const o = slotAt(e.clientX, e.clientY);
      if (o !== drag.over) { if (drag.over != null) slots[drag.over].classList.remove("over"); drag.over = o != null && !fixed.has(o) && o !== drag.s ? o : null; if (drag.over != null) slots[drag.over].classList.add("over"); }
    }
  });
  // a tap: pick a tile up, then tap where it goes (tap it again to put it down)
  let lastTap = 0;
  const tap = s => {
    if (st.done || fixed.has(s)) return;
    if (st.sel == null) { select(s); if (tw === "blind") slots[s].classList.remove("down"); return; }
    if (st.sel === s) { select(null); if (tw === "blind" && !hgHome(board, at, s)) slots[s].classList.add("down"); return; }
    const a = st.sel; select(null); move(a, s, a);
  };
  // keyboard (Enter / Space on a focused tile) and synthetic clicks arrive as a click with no pointer before it
  bd.addEventListener("click", e => {
    const t = e.target.closest(".hg-s"); if (!t || performance.now() - lastTap < 450) return;
    const s = +t.dataset.s;
    if (fixed.has(s)) { t.classList.remove("nope"); void t.offsetWidth; t.classList.add("nope"); return; }
    tap(s);
  });
  const endDrag = e => {
    if (!drag || (e && e.pointerId !== drag.id)) return;
    const d = drag; drag = null;
    if (!d.on) { if (e && e.type === "pointerup") { lastTap = performance.now(); tap(d.s); } return; }
    slots[d.s].classList.remove("lift");
    if (d.over != null) slots[d.over].classList.remove("over");
    const g = d.ghost;
    if (d.over != null && e && e.type === "pointerup") { g.remove(); move(d.s, d.over, d.s); return; }
    // dropped nowhere: it floats back home
    g.animate([{ transform: g.style.transform }, { transform: "none" }], { duration: reduceMotion ? 0 : 200, easing: "cubic-bezier(.2,.8,.2,1)" }).onfinish = () => g.remove();
    setTimeout(() => g.remove(), 400);
  };
  bd.addEventListener("pointerup", endDrag);
  bd.addEventListener("pointercancel", endDrag);
  cleanup.push(() => document.querySelectorAll(".hg-fly").forEach(g => g.remove()));

  // ---------- teach by doing: the two swapped tiles breathe if nothing happens for a while ----------
  if (cfg.teach) later(() => { if (!st.done && !st.moves) at.forEach((t, s) => { if (t !== s) slots[s].classList.add("nudge"); }); }, hgShotMode() ? 50 : 3500);

  // ---------- solved ----------
  function solved() {
    if (st.done) return;
    st.done = true; stopClock();
    const ms = performance.now() - st.t0;
    slots.forEach(t => { t.classList.remove("sel", "nudge", "down", "hinted"); t.disabled = true; });
    bd.classList.add("solved");
    buzz([12, 60, 12]);
    try { if (typeof sfx === "function") sfx("scale", { hexes: board.hex.slice() }); } catch (e) {}
    // the ripple runs out from the last tile placed, then the gaps close into one gradient
    const f = st.lastS != null ? slots[st.lastS].getBoundingClientRect() : bd.getBoundingClientRect();
    slots.forEach(t => { const r = t.getBoundingClientRect(), dd = Math.hypot(r.left - f.left, r.top - f.top); t.style.setProperty("--dl", Math.round(dd * 1.1) + "ms"); t.classList.add("rip"); });
    later(() => bd.classList.add("whole"), reduceMotion ? 0 : 520);
    const res = { solved: true, over: st.over || null, moves: st.moves, par, hints: st.hints, ms, wrong: st.wrong, ax: st.ax, cap, clock };
    live.res = res;
    cfg.onSolved(res, { q, note, foot, bd });
  }
  showMoves();
  return live;
}
// tiles fly between their slots (transform only), then the caller repaints. pairs: [slot, fromRect, toRect]
function hgFly(pairs, slots, board, at, done) {
  if (reduceMotion || hgShotMode()) return done();
  const fl = pairs.map(([s, from, to]) => {
    const g = slots[s].cloneNode(false);
    g.className = slots[s].className.replace(/\b(sel|snap|down|lift|over|nudge|hinted)\b/g, "") + " hg-fly"; g.removeAttribute("data-s");
    Object.assign(g.style, { left: from.left + "px", top: from.top + "px", width: from.width + "px", height: from.height + "px" });
    document.body.appendChild(g);
    slots[s].classList.add("lift");
    const sx = to.width / from.width, sy = to.height / from.height;
    const a = g.animate([{ transform: "none" }, { transform: `translate(${to.left - from.left}px,${to.top - from.top}px) scale(${sx},${sy})` }], { duration: 230, easing: "cubic-bezier(.2,.8,.2,1)", fill: "forwards" });
    return { g, a, s };
  });
  let n = fl.length;
  const fin = () => { if (--n > 0) return; fl.forEach(({ g, s }) => { g.remove(); slots[s].classList.remove("lift"); }); done(); };
  fl.forEach(({ a }) => { a.onfinish = fin; });
}
// screenshot states: put every tile home, one quick swap at a time (or instantly)
function hgAutoSolve(live, instant = true) {
  const { board, at } = live;
  for (let s = 0; s < at.length; s++) {
    if (hgHome(board, at, s) || (board.geo.twins && board.geo.cells[s].i >= board.geo.n / 2)) continue;
    const from = at.findIndex((t, k) => k !== s && board.hex[t] === board.hex[s] && !hgHome(board, at, k));
    if (from < 0) continue;
    if (!instant) return live.swap(from, s);
    live.swap(from, s);
    s = -1;
    if (live.st.done) return;
  }
}

// ======================================================================
// Levels
// ======================================================================
function hgPlay(w, i, o = {}) {
  if (!S.scr && !hgShotMode() && typeof screenCheck === "function") return screenCheck(() => hgPlay(w, i, o));
  if (!hgSrcReady(w)) return hgWhenSrc(w, () => hgPlay(w, i, o));
  const st = hgS();
  if (!st.taught && !o.skipTeach && w === 0 && i === 0) return hgTeach();
  const src = hgSrc(w, i);
  if (!src) return hgMap();
  const id = HG_WORLDS[w].id + ":" + i, att = (st.att[id] = (st.att[id] || 0) + 1);
  const diff = hgChoosing() ? st.diff : null;
  const spec = hgLevelSpec(w, i, src, hgEye(), st.k, att, diff), board = hgBuild(spec), at = hgDeal(board, hgRnd(hgHash(spec.deal)));
  const tw = spec.twist, novel = !!tw && !hgTwistSeen(tw);
  const twistLine = tw && HG_TWIST[tw] ? HG_TWIST[tw].line : "";
  const back = st.last && st.last !== today() && !o.again;
  const noteLine = tw === "blind" ? "" : o.testOut ? "Test out: solve this one and every level before it is cleared." : twistLine && (novel || i === 0) ? twistLine : back ? "Welcome back. Dotted tiles stay put; swap the rest." : i < 2 && w === 0 ? "Dotted tiles stay put. Swap the rest until every row and column flows." : twistLine;
  st.last = today(); save();
  hgPlayBoard({ board, at, twist: tw, title: HG_SHAPE_NAME[board.geo.shape] + (board.geo.shape === "rect" ? ` ${board.n} × ${board.geo.cells.length / board.n}` : ""), note: noteLine,
    label: diff ? HG_DIFF[diff].name : "", onRetry: () => hgPlay(w, i, { again: true, testOut: o.testOut }), onQuit: () => hgMap(w),
    onSolved: (res, ui) => hgReveal(res, ui, src, () => hgLevelDone(w, i, board, src, res, spec, o)) });
}
// the reveal on the play screen: the source's name comes up as the gaps close; one tap moves on
function hgReveal(res, ui, src, next) {
  later(() => {
    ui.q.innerHTML = `<span class="hg-reveal">${esc(src.title)}</span>`;
    ui.note.innerHTML = `<span class="hg-reveal">${esc(src.line)}</span>`;
    ui.foot.innerHTML = `<button class="btn hg-in" data-go>${res.over ? "See the colors" : "See how you did"} ${ICON.arrow}</button>`;
    ui.foot.querySelector("[data-go]").onclick = next;
    onKey = e => { if (e.key === "Enter") next(); };
  }, reduceMotion ? 100 : 900);
}
function hgLevelDone(w, i, board, src, res, spec, po = {}) {
  const st = hgS(), W = HG_WORLDS[w], id = W.id + ":" + i, old = hgDone(id), was = hgStarsOf(id);
  const finish = res.solved && !res.over, few = finish && res.moves <= hgFewMoves(res.par), noHint = finish && !res.hints;
  const stars = [finish || was[0], few || was[1], noHint || was[2]].map(x => x ? 1 : 0);
  const pb = finish && old && old.m && res.moves < old.m;
  const firstClear = finish && !old;
  if (finish || old) st.done[id] = { s: stars, m: finish ? Math.min(res.moves, (old && old.m) || Infinity) : old && old.m, c: board.corners, t: today() };
  hgLogRound(board, src, res);
  if (!spec.diff) st.k = hgForm(st.k, res);   // form only moves in For you; a chosen difficulty stays put
  st.plays++;
  // Test out: a clear here clears every level before it (no stars: those are earned by playing), and opens the world
  let tested = 0;
  if (po.testOut && finish) {
    const mark = (ww, k) => { const kid = HG_WORLDS[ww].id + ":" + k; if (!st.done[kid]) { st.done[kid] = { s: [0, 0, 0], m: null, t: today(), to: 1 }; tested++; } };
    for (let k = 0; k < i; k++) mark(w, k);
    if (w > 0 && w < 4 && !hgWorldOpen(w)) for (let k = 0; k < Math.min(HG_OPEN_AT, hgLevelCount(w - 1)); k++) mark(w - 1, k);
  }
  save();
  const worldDone = firstClear && hgCleared(w) === hgLevelCount(w);
  const opened = firstClear ? HG_WORLDS.map((_, k) => k).filter(k => k !== w && hgWorldRec(k) && !(st.seenOpen || []).includes(k)) : [];
  if (opened.length) st.seenOpen = [...new Set([...(st.seenOpen || []), ...opened, 0])];
  const nextOpen = i + 1 < hgLevelCount(w);
  hgResults({ w, i, board, src, res, stars, tested, diff: spec.diff, got: [finish, few, noHint], pb, firstClear, worldDone, opened, mastered: stars.every(Boolean) && !was.every(Boolean),
    title: `${W.name} · level ${i + 1}`, next: nextOpen ? () => hgPlay(w, i + 1) : null, nextLabel: nextOpen ? `Level ${i + 2}` : null,
    again: () => hgPlay(w, i, { again: true }), back: () => hgMap(w) });
}
// what a round tells the Learner Model: the set you saw, the corners, the per-axis tallies (mix-ups were logged live)
function hgLogRound(board, src, res) {
  const st = hgS();
  ["light", "chroma", "hue"].forEach(a => { st.ax[a].m += res.ax[a].m; st.ax[a].e += res.ax[a].e; });
  try {
    if (typeof learnerLog === "function") {
      if (typeof colorSet === "function" && src.pal) learnerLog({ type: "seen", set: colorSet({ kind: src.kind, id: src.id, title: src.title, colors: src.pal.map(h => ({ h })) }), src: src.kind === "flower" ? "flower" : src.kind });
      board.corners.forEach(h => learnerLog({ type: "seen", color: h, src: "game" }));
    }
  } catch (e) {}
}
const HG_AX_WORD = { light: "lightness", chroma: "strength (how vivid)", hue: "hue" };
function hgAxisLine(res) {
  const e = ["light", "chroma", "hue"].map(a => [a, res.ax[a].e]).sort((x, y) => y[1] - x[1]), tot = e.reduce((s, x) => s + x[1], 0);
  if (!tot) return res.moves <= res.par ? "A clean solve: every tile went straight home." : "No tile went to a wrong place; the extra moves were tiles parked on the way.";
  return `${tot === 1 ? "One tile was tried in a wrong place" : `${tot} tiles were tried in wrong places`}; ${e[0][1] === tot ? "every one" : `${e[0][1]} of them`} off mainly in ${HG_AX_WORD[e[0][0]]}.`;
}
// ---------- results: cleared, a best, mastered, world complete, over the limit; all designed ----------
function hgResults(o) {
  const { board, src, res, stars } = o, finish = o.got[0];
  const head = o.worldDone ? `${esc(HG_WORLDS[o.w].name)}, <em>complete.</em>` : o.tested ? "Tested <em>out.</em>" : o.mastered ? "Level <em>mastered.</em>" : o.firstClear ? "Level <em>cleared.</em>" : o.pb ? "A new <em>best.</em>" : finish ? "Well <em>seen.</em>" : "Over the <em>limit.</em>";
  const W = HG_WORLDS[o.w], nextR = o.next ? hgRung(o.w, o.i + 1) : null;
  const lede = o.tested ? `${o.tested === 1 ? "The level before it is" : `The ${o.tested} levels before it are`} cleared too. ${o.tested === 1 ? "Its stars are" : "Their stars are"} still there to earn.` : o.worldDone ? `All ${hgLevelCount(o.w)} boards, ${hgWorldStars(o.w)} of ${hgLevelCount(o.w) * 3} stars.${o.opened.length ? ` ${esc(HG_WORLDS[o.opened[0]].name)} is open.` : ""}`
    : !finish ? `Solved, but past the ${res.over === "time" ? "clock" : "move limit"}. Try again ${res.over === "time" ? `within ${Math.floor(res.clock / 60)}:${String(res.clock % 60).padStart(2, "0")}` : `in ${res.cap} moves or fewer`} to clear it.`
    : o.opened.length ? `${esc(HG_WORLDS[o.opened[0]].name)} is next up: ${esc(HG_WORLDS[o.opened[0]].line.charAt(0).toLowerCase() + HG_WORLDS[o.opened[0]].line.slice(1))}`
    : nextR && o.firstClear ? `Level ${o.i + 2} is open: ${esc((HG_SHAPE_NAME[nextR.s] || "").toLowerCase())}${nextR.t && HG_TWIST[nextR.t] ? `, ${esc(HG_TWIST[nextR.t].name.toLowerCase())}` : ""}.`
    : o.diff ? `${HG_DIFF[o.diff].name}: every step on this board was ${hgPctDiff(board.step.med)}.`
    : hgEye() ? `Every step was ${hgPctDiff(board.step.med)}, about ${(board.step.med / hgEye()).toFixed(1)} times the smallest difference you reliably see.`
    : `Every step was ${hgPctDiff(board.step.med)}. Play Odd one out and the boards learn your eye.`;
  const eye = hgEye(), steps = board.step.med;
  const corners = board.corners.map(h => { const nm = typeof nameOf === "function" ? nameOf(h).text : h; return `<button class="hg-corner" data-hex="${h}" aria-label="${esc(nm)}"><i style="--c:${h}"></i><span>${esc(nm)}</span></button>`; }).join("");
  const time = Math.round(res.ms / 1000), timeTxt = `${Math.floor(time / 60)}:${String(time % 60).padStart(2, "0")}`;
  const el = show(`
    <header class="deck-top"><button class="icon-btn" data-close aria-label="Back to the map">${ICON.back}</button><span style="flex:1"></span><span class="mono oo-tot">${hgStarTotal()} ★</span></header>
    <p class="note">${esc(o.title)}${o.diff ? ` · ${esc(HG_DIFF[o.diff].name)}` : ""}</p>
    <h1>${head}</h1>
    <button class="hg-art" data-src>${hgStillHTML(board, "big")}<span class="hg-srcline"><b>${esc(src.title)}</b><em>${esc(src.line)}</em></span>${ICON.chev}</button>
    <div class="oo-stars-row">${["Finished", "Few moves", "No hints"].map((w, k) => `<span class="oo-star${stars[k] ? " on" : ""}${o.got[k] && stars[k] ? " new" : ""}" style="--k:${k}"><i></i>${w}</span>`).join("")}</div>
    <p class="lede">${lede}</p>
    <div class="res-list">
      <div class="res"><span>Moves</span><b class="mono">${res.moves} · par ${res.par}</b>${o.pb ? "<em>best</em>" : "<span></span>"}</div>
      <div class="res"><span>Time</span><b class="mono">${timeTxt}</b><span></span></div>
      <div class="res"><span>Step between tiles</span><b class="mono">${hgPctFmt(steps)}</b><span></span></div>
      ${eye ? `<div class="res"><span>Your eye</span><b class="mono">${hgPctFmt(eye)}</b><span></span></div>` : ""}
    </div>
    <div class="sec-head"><b>The four corners</b><span>tap one to open it</span></div>
    <div class="hg-corners">${corners}</div>
    <div class="sec-head"><b>Where your eye hesitated</b></div>
    <div class="hg-heatrow">${hgHeatHTML(board, res.wrong)}<p class="note">${esc(hgAxisLine(res))}</p></div>
    <p class="fine">Steps are measured on the colors as your screen draws them (CIEDE2000: 100% is black against white; about 1% is the smallest difference most people see side by side). ${src.kind === "painting" ? "Painting colors are as photographed, through old varnish; the corners come from the painting's palette." : src.kind === "flower" ? "Flower colors are screen approximations." : src.kind === "gem" ? "Gem colors are illustrative screen colors; real stones vary." : src.kind === "fashion" ? "Decade palettes describe the fashionable end of dress, as screen approximations." : ""}</p>
    <div class="stack hg-acts">
      ${o.next && finish ? `<button class="btn" data-next>${esc(o.nextLabel)} ${ICON.arrow}</button>` : `<button class="btn" data-again>${finish ? "Play again" : "Try again"} ${ICON.arrow}</button>`}
      <button class="btn ghost" data-learn>Learn these colors</button>
      ${o.next && finish ? `<button class="btn ghost" data-again>Play again</button>` : ""}
      <button class="btn ghost" data-map>${o.backLabel || "Back to the map"}</button>
    </div>`, "result hg-res");
  el.querySelector("[data-close]").onclick = o.back;
  el.querySelector("[data-map]").onclick = o.back;
  el.querySelector("[data-src]").onclick = () => src.open();
  const nb = el.querySelector("[data-next]"); if (nb) nb.onclick = o.next;
  el.querySelectorAll("[data-again]").forEach(b => b.onclick = o.again);
  el.querySelector("[data-learn]").onclick = () => { if (typeof csLearn === "function" && typeof colorSet === "function") csLearn(colorSet({ kind: "gradient", id: board.spec.id || "board", title: src.title, colors: board.corners.map(h => ({ h })) })); };
  el.querySelectorAll(".hg-corner").forEach(b => b.onclick = e => { e.stopPropagation(); if (typeof openTappedColor === "function") openTappedColor(b.dataset.hex); });
  onKey = e => { const b = e.key === "Enter" && (el.querySelector("[data-next]") || el.querySelector(".hg-acts .btn:not(.ghost)")); if (b) b.click(); };
  if (o.firstClear || o.pb || o.mastered) later(() => buzz([12, 60, 12]), 450);
  if (o.extra) o.extra(el);
  return el;
}
const hgPctDiff = n => typeof pctDiff === "function" ? pctDiff(n) : hgPctFmt(n) + " different";
// has a level with this twist been cleared before? (a new twist is introduced, and drawn easier)
const hgTwistSeen = tw => Object.keys(hgS().done).some(k => { const [wid, i] = k.split(":"), w = HG_WORLDS.findIndex(x => x.id === wid); if (w < 0) return false; const R = hgRung(w, +i); return (R.t || (R.s === "weave" ? "weave" : R.s === "mirror" ? "mirror" : null)) === tw; });
const hgWorldStars = w => { let n = 0; for (let i = 0; i < HG_WORLDS[w].n; i++) n += hgStarsOf(HG_WORLDS[w].id + ":" + i).filter(Boolean).length; return n; };

// ---------- the first time: one swap, taught by doing ----------
function hgTeach() {
  // a vivid, friendly first board: a 4 × 4 of cornflowers with only the middle four free
  const src = hgSrc(1, 1), spec = hgLevelSpec(0, 0, src, hgEye(), 1, 0), board = hgBuild({ ...spec, seed: "teach", n: 4, nMin: 4, nMax: 4, T: Math.max(spec.T, 6) });
  const at = hgDeal(board, hgRnd(hgHash("teach")), 1);
  hgPlayBoard({ board, at, teach: true, title: "Two tiles have swapped.", note: "Tap one, then the other.", onQuit: () => go("gym"),
    onSolved: (res, ui) => {
      hgS().taught = 1; save();
      later(() => {
        ui.q.innerHTML = `<span class="hg-reveal">That's the <em>game.</em></span>`;
        ui.note.innerHTML = `<span class="hg-reveal">Dotted tiles never move. Swap the rest until every row and column flows.</span>`;
        ui.foot.innerHTML = `<button class="btn hg-in" data-go>Play level 1 ${ICON.arrow}</button>`;
        ui.foot.querySelector("[data-go]").onclick = () => hgPlay(0, 0, { skipTeach: true });
      }, reduceMotion ? 100 : 900);
    } });
}

// ======================================================================
// The map (#/hue)
// ======================================================================
function hgMap(focusW) {
  const st = hgS(), day = today(), dd = st.daily[day], back = st.last && st.last !== day, nx = hgNext();
  const dspec = hgDailySpec(day, hgDailySrcs());
  const worlds = HG_WORLDS.map((W, w) => {
    const open = true, n = hgLevelCount(w), cleared = hgCleared(w);
    if (W.id === "yours" && open && !n) return `<section class="hg-world" data-w="${w}"><div class="oo-world"><b>${esc(W.name)}</b><span>${esc(W.line)}</span></div>
      <p class="note hg-empty">Heart a few colors, or keep a palette from a painting or a photo, and they become boards here.</p></section>`;
    const tiles = Array.from({ length: n }, (_, i) => {
      const id = W.id + ":" + i, lv = true, d = hgDone(id), R = hgRung(w, i), s = hgStarsOf(id);
      const name = d ? hgSrcName(w, i) : HG_SHAPE_NAME[R.s] + (R.t && HG_TWIST[R.t] && !["weave", "mirror"].includes(R.t) ? " · " + HG_TWIST[R.t].name.toLowerCase() : "");
      const cur = nx.w === w && nx.i === i;
      return `<button class="hg-lv${lv ? "" : " locked"}${d ? " done" : ""}${cur ? " cur" : ""}" data-lv="${w}:${i}"${lv ? "" : ` data-locked="${open ? `Clear level ${i} to open this one` : `Clear ${HG_OPEN_AT} levels of ${HG_WORLDS[Math.max(0, w - 1)].name} to open ${W.name}`}"`}>
        <span class="hg-lvart">${hgMiniHTML(R.s, lv || d ? hgMiniCorners(w, i) : null, { locked: !lv && !d })}</span>
        <span class="hg-lvt"><b><span class="mono">${i + 1}</span>${esc(name)}</b>${d ? `<span class="oo-st">${s.map(x => `<i class="${x ? "on" : ""}"></i>`).join("")}</span>` : ""}</span></button>`;
    }).join("");
    return `<section class="hg-world${open ? "" : " locked"}" data-w="${w}"><div class="oo-world${open && cleared === n && n ? " lit" : ""}"><b>${esc(W.name)}</b><span>${open ? `${esc(W.line)} ${cleared ? `<span class="mono">${cleared}/${n}</span>` : ""}` : `Opens after ${HG_OPEN_AT} levels of ${esc(HG_WORLDS[w === 4 ? 0 : w - 1].name)}.`}</span></div>
      <div class="hg-grid">${tiles}</div></section>`;
  }).join("");
  const dline = dd ? `Solved in ${dd.moves} moves (par ${dd.par}). A new board tomorrow.` : `${HG_SHAPE_NAME[dspec.shape]}, the same board for everyone today.`;
  const el = show(`
    <header class="deck-top"><button class="icon-btn" data-close aria-label="Back to Train">${ICON.back}</button><span style="flex:1"></span><span class="mono oo-tot">${hgStarTotal()} ★</span></header>
    <h1 class="title-1 oo-title">Gradients</h1>
    <p class="note">${back ? "Welcome back. Today's board is new." : st.plays ? "Every board's corners come from something real. Finish one to see what." : "Swap tiles until the colors flow. Each board's four corners come from a painting, a flower, a gem or a decade."}</p>
    ${hgModeHTML()}
    <button class="hg-daily${dd ? " done" : ""}" data-daily>
      <span class="hg-lvart">${hgMiniHTML(dspec.shape, dd && dd.c ? dd.c : hgCornerSets(dspec.pal, hgRnd(hgHash("mini:" + day)), 1)[0])}</span>
      <span class="hg-dt"><b>Today's board <span class="mono">#${dspec.num}</span></b><em>${esc(dline)}</em></span>${ICON.chev}</button>
    ${worlds}
    <p class="fine">How it works: every board is a smooth gradient between four corner colors, mixed in a perceptual color space and spaced so each step looks the same size. Steps are drawn from your own eye (the estimate Odd one out keeps), so boards get finer as you get sharper; a clean, quick solve makes the next one finer, a hint or a long search makes it gentler. Stars: finish the level, use few moves, use no hints.</p>
    <div class="oo-go"><button class="btn" data-play>${st.plays ? `Play ${esc(HG_WORLDS[nx.w].name)} ${nx.i + 1}` : "Start"} ${ICON.arrow}</button></div>
  `, "oo-map hg-map");
  el.querySelector("[data-close]").onclick = () => go("gym");
  el.querySelector("[data-play]").onclick = () => hgPlay(nx.w, nx.i);
  el.querySelector("[data-daily]").onclick = () => hgDaily();
  el.querySelectorAll("[data-lv]").forEach(b => b.onclick = () => { const [w, i] = b.dataset.lv.split(":").map(Number); if (b.dataset.locked) return hgTestOut(w, i, b.dataset.locked); hgPlay(w, i); });
  hgModeWire(el);
  const target = focusW != null ? el.querySelector(`.hg-world[data-w="${focusW}"] .hg-lv.cur, .hg-world[data-w="${focusW}"]`) : el.querySelector(".hg-lv.cur");
  if (target && (focusW != null || st.plays > 3) && !hgShotMode()) later(() => target.scrollIntoView({ block: "center", behavior: reduceMotion ? "auto" : "smooth" }), 250);
}

// ---------- For you / Choose: the mode switch, remembered ----------
function hgModeHTML() {
  const st = hgS(), ch = st.mode === "choose";
  const line = ch ? `Every level is open. Each step stays at ${hgPctDiff(hgDiffT(st.diff))}, whatever your eye.` : `Steps follow your eye${hgEye() ? ` (about ${hgPctFmt(hgEye())} now)` : ""}, finer as you get sharper. Every level is open; this just suggests the next one.`;
  return `<div class="hg-modebox">
    <div class="hg-seg" role="radiogroup" aria-label="Difficulty"><button role="radio" aria-checked="${!ch}" class="${ch ? "" : "on"}" data-mode="you">For you</button><button role="radio" aria-checked="${ch}" class="${ch ? "on" : ""}" data-mode="choose">Choose</button></div>
    ${ch ? `<div class="hg-seg hg-diffs" role="radiogroup" aria-label="Pick a difficulty">${Object.entries(HG_DIFF).map(([k, d]) => `<button role="radio" aria-checked="${st.diff === k}" class="${st.diff === k ? "on" : ""}" data-diff="${k}">${d.name}</button>`).join("")}</div>` : ""}
    <p class="hg-modeline">${line}</p></div>`;
}
function hgModeWire(el) {
  el.querySelectorAll("[data-mode]").forEach(b => b.onclick = () => { const st = hgS(); if (st.mode === b.dataset.mode) return; st.mode = b.dataset.mode; save(); buzz(5); hgModeRedraw(el); });
  el.querySelectorAll("[data-diff]").forEach(b => b.onclick = () => { hgS().diff = b.dataset.diff; save(); buzz(5); hgModeRedraw(el); });
}
// the switch changes which levels are open, so the map redraws where it is
function hgModeRedraw() { const y = scrollY; hgMap(); scrollTo(0, y); }
// a locked level: test out of it (clear it and everything before it is cleared), or switch to Choose
function hgTestOut(w, i, why) {
  const W = HG_WORLDS[w];
  if (W.id === "yours" && i >= hgLevelCount(w)) return toast(why);
  const { sh, close } = sheet(`
    <h3>Test out?</h3>
    <p>${esc(why)}. Or play ${esc(W.name)} level ${i + 1} now: solve it within its limits and every level before it counts as cleared${w > 0 && !hgWorldOpen(w) ? `, and ${esc(W.name)} opens` : ""}. Their stars stay there to earn.</p>
    <div class="stack"><button class="btn" data-go>Test out ${ICON.arrow}</button><button class="btn ghost" data-choose>Or choose a difficulty and open every level</button></div>`);
  sh.querySelector("[data-go]").onclick = () => { close(); hgPlay(w, i, { testOut: true, skipTeach: true }); };
  sh.querySelector("[data-choose]").onclick = () => { close(); hgS().mode = "choose"; save(); hgMap(w); };
}

// ======================================================================
// The daily board (#/hue/daily): the same for everyone, no adaptive steps, a spoiler-free share card
// ======================================================================
function hgDaily() {
  if (!S.scr && !hgShotMode() && typeof screenCheck === "function") return screenCheck(hgDaily);
  const day = today(), spec = hgDailySpec(day, hgDailySrcs()), board = hgBuild(spec), at = hgDeal(board, hgRnd(hgHash(spec.deal)));
  const st = hgS(), prev = st.daily[day];
  hgPlayBoard({ board, at, title: `Today's board`, note: prev ? "You've solved today's board. This replay won't change your result." : `#${spec.num} · ${HG_SHAPE_NAME[board.geo.shape]}, the same for everyone today.`, onQuit: () => hgMap(),
    onSolved: (res, ui) => hgReveal(res, ui, spec.src, () => {
      if (!st.daily[day]) { st.daily[day] = { moves: res.moves, par: res.par, hints: res.hints, ms: Math.round(res.ms), c: board.corners, w: res.wrong.slice() }; hgLogRound(board, spec.src, res); }
      st.last = day; save();
      const mine = st.daily[day], text = hgShareText(spec.num, board.geo.shape, mine);
      hgResults({ w: 0, i: 0, board, src: spec.src, res, stars: [1, res.moves <= hgFewMoves(res.par) ? 1 : 0, res.hints ? 0 : 1], got: [1, res.moves <= hgFewMoves(res.par), !res.hints], firstClear: false, opened: [],
        title: `Today's board #${spec.num}`, again: () => hgDaily(), back: () => hgMap(), backLabel: "Back to Gradients",
        extra: el => {
          el.querySelector("h1").innerHTML = prev ? "Solved <em>again.</em>" : "Today's board, <em>solved.</em>";
          el.querySelector(".lede").textContent = prev ? `Your result stands: ${mine.moves} moves. A new board tomorrow.` : "Everyone gets this board today. Share how it went; the card shows only where you hesitated, never the answer.";
          const acts = el.querySelector(".hg-acts"), card = hgCard(board, spec.num, mine);
          const box = document.createElement("div"); box.className = "hg-share";
          box.innerHTML = `<img alt="Your share card: the board's shape shaded by where you hesitated" src="${card}"><p class="note">${esc(text)}</p>`;
          acts.parentNode.insertBefore(box, acts);
          const first = acts.querySelector(".btn:not(.ghost)");
          first.outerHTML = `<button class="btn" data-share>Share ${ICON.share}</button>`;
          el.querySelector("[data-share]").onclick = () => hgShare(card, text);
        } });
    }) });
}
// the share card: the board's silhouette in its own colors, shaded only by where you hesitated (never the solution)
function hgCard(board, num, r) {
  try {
    const W = 600, H = 750, cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const cx = cv.getContext("2d"), wrong = r.w || [], max = Math.max(1, ...wrong), byL = board.corners.slice().sort((a, b) => lab(b)[0] - lab(a)[0]);
    const byC = board.corners.slice().sort((a, b) => lch(b)[1] - lch(a)[1]);
    cx.fillStyle = "#0E0D0B"; cx.fillRect(0, 0, W, H);
    // the board's four corner colors as a band, light to dark (its palette, never its arrangement)
    byL.forEach((h, k) => { cx.fillStyle = h; cx.fillRect(60 + k * 120, 44, 120, 26); });
    // the silhouette: calm where you placed straight home, the most vivid corner where you hesitated
    const calm = byL[1], hot = byC[0] === calm ? byC[1] : byC[0];
    const bw = 400, bh = bw / board.geo.aspect, scale = Math.min(1, 400 / bh), w = bw * scale, h = bh * scale, x0 = (W - w) / 2, y0 = 100 + (400 - h) / 2, fixed = new Set(board.anchors);
    board.geo.cells.forEach((c, s) => {
      const k = fixed.has(s) ? null : wrong[s] / max;
      cx.fillStyle = k == null ? "#2A2822" : k === 0 ? calm : hot;
      cx.globalAlpha = k == null || k === 0 ? 1 : .45 + .55 * k;
      const X = x0 + c.x * w, Y = y0 + c.y * h, cw = c.w * w, ch = c.h * h, g = .06;
      cx.save(); cx.translate(X + cw / 2, Y + ch / 2); cx.scale(1 - g, 1 - g); cx.translate(-cw / 2, -ch / 2);
      cx.beginPath();
      if (c.k === "dot") cx.arc(cw / 2, ch / 2, cw / 2, 0, Math.PI * 2);
      else if (c.k === "hex") [[.5, 0], [1, .25], [1, .75], [.5, 1], [0, .75], [0, .25]].forEach(([px, py], j) => cx[j ? "lineTo" : "moveTo"](px * cw, py * ch));
      else if (c.k === "dia") [[.5, 0], [1, .5], [.5, 1], [0, .5]].forEach(([px, py], j) => cx[j ? "lineTo" : "moveTo"](px * cw, py * ch));
      else if (c.k === "poly") c.pts.split(",").forEach((p, j) => { const [px, py] = p.trim().split(" ").map(v => parseFloat(v) / 100); cx[j ? "lineTo" : "moveTo"](px * cw, py * ch); });
      else cx.rect(0, 0, cw, ch);
      cx.fill(); cx.restore(); cx.globalAlpha = 1;
    });
    cx.fillStyle = "#ECE8DF"; cx.font = "400 68px 'Instrument Serif', Georgia, serif"; cx.fillText(`Gradients #${num}`, 60, 590);
    cx.fillStyle = "#C9C4B8"; cx.font = "italic 400 34px 'Instrument Serif', Georgia, serif";
    cx.fillText(`${r.moves} moves · par ${r.par} · ${r.hints ? r.hints + " hint" + (r.hints > 1 ? "s" : "") : "no hints"}`, 60, 640);
    cx.fillStyle = "#A39E92"; cx.font = "400 28px 'Instrument Serif', Georgia, serif"; cx.fillText(`${HG_SHAPE_NAME[board.geo.shape]} · ColorHub`, 60, 696);
    return cv.toDataURL("image/png");
  } catch (e) { return ""; }
}
function hgShare(png, text) {
  const url = typeof shareURL === "function" ? shareURL("hue/daily") : location.href;
  const fallback = () => { try { navigator.clipboard.writeText(`${text}\n${url}`); toast("Copied"); } catch (e) { toast(text); } };
  if (navigator.share) {
    fetch(png).then(r => r.blob()).then(b => {
      const file = new File([b], "gradients.png", { type: "image/png" });
      return navigator.canShare && navigator.canShare({ files: [file] }) ? navigator.share({ files: [file], text: `${text}\n${url}` }) : navigator.share({ text, url });
    }).catch(() => {});
  } else fallback();
}

// ======================================================================
// The Journey step (GAME_STEPS.hue): a 10-second board. Same contract as js/games/steps.js.
// opts.colors: build the corners from these (today's words, a painting); opts.d: the step in ΔE00; opts.tier.
// Resolves { ok (solved in par + 1 or fewer, no hints), ms, answer: { kind: "order", moves, par }, d, act, kind, judg }.
// ======================================================================
if (typeof GAME_STEPS !== "undefined") GAME_STEPS.hue = { by: "order", name: "Gradients", render(box, opts = {}) {
  const tierX = { intro: 3.4, easy: 2.8, medium: 2, hard: 1.4 }[opts.tier || "easy"] || 2.8;
  const pal = opts.colors && opts.colors.length >= 2 ? opts.colors.map(c => typeof c === "string" ? c : c && (c.hex || c.h)).filter(Boolean) : (hgSrc(0, Math.floor(Math.random() * HG_PAINTINGS.length)) || { pal: HG_GARDENS[0].pal }).pal;
  const T = opts.d != null ? opts.d : hgTarget(hgEye(), tierX);
  const board = hgBuild({ shape: "rect", n: 4, m: 3, nMin: 4, nMax: 4, anchors: "corners", pal, T, seed: "step:" + pal.join() });
  const at = hgDeal(board, hgRnd(hgHash("step:" + Date.now())), 2);
  return new Promise(resolve => {
    const wrap = document.createElement("div"); wrap.className = "hg-step"; box.innerHTML = ""; box.appendChild(wrap);
    if (opts.note) { const p = document.createElement("p"); p.className = "note"; p.textContent = opts.note; box.insertBefore(p, wrap); }
    let gaveUp = false;
    const live = hgPlayBoard({ box: wrap, board, at, noHint: true, title: "Put the gradient back.", note: "Two pairs of tiles have swapped. Tap one, then where it goes.", onQuit: () => {},
      onSolved: (res, ui) => {
        const ok = res.moves <= res.par + 1 && !gaveUp;
        const out = { ok, ms: res.ms, answer: { kind: "order", moves: res.moves, par: res.par }, d: T, act: board.step.med, kind: "hue", judg: "hue" };
        if (opts.feedback === false) return resolve(out);
        later(() => {
          ui.note.textContent = gaveUp ? `Here it is, in order. Each step is ${hgPctDiff(board.step.med)}.` : ok ? `Right: ${res.moves} moves. Each step is ${hgPctDiff(board.step.med)}.` : `Solved in ${res.moves} moves; ${res.par} was enough. Each step is ${hgPctDiff(board.step.med)}.`;
          ui.foot.innerHTML = `<button class="btn" data-next>${esc(opts.next || "Next")} ${ICON.arrow}</button>`;
          ui.foot.querySelector("[data-next]").onclick = () => resolve(out);
        }, 700);
      } });
    // a quiet way out after a while, so a step never traps anyone
    later(() => {
      const f = live.el.querySelector("#hgfoot"); if (!f || live.st.done) return;
      f.innerHTML = `<div class="oo-extras"><button class="oo-pill ghost" data-showme>Show me</button></div>`;
      f.querySelector("[data-showme]").onclick = () => { gaveUp = true; hgAutoSolve(live); };
    }, 15000);
  });
} };

// ======================================================================
// The Train shelf (gym.js hook) and routes (router.js hook)
// ======================================================================
function hgShelf() {
  const st = hgS(), nx = hgNext(), R = hgRung(nx.w, nx.i), day = today(), dd = st.daily[day], dspec = hgDailySpec(day, hgDailySrcs());
  return `<div class="sec-head"><b>Gradients</b><span>put the colors back in order</span></div>
    <button class="oo-shelf hg-shelf" data-hg-map>
      <span class="hg-lvart">${hgMiniHTML(R.s, hgMiniCorners(nx.w, nx.i))}</span>
      <span class="oo-nt"><b>${st.plays ? `${esc(HG_WORLDS[nx.w].name)} · level ${nx.i + 1}` : "Swap tiles until the colors flow"}</b><em>${st.plays ? esc(HG_SHAPE_NAME[R.s]) + (R.t && HG_TWIST[R.t] ? ", " + esc(HG_TWIST[R.t].name.toLowerCase()) : "") : "Boards from paintings, flowers, gems and decades, from a 4 × 4 to a 12 × 12."}</em></span>
      <span class="mono oo-tot">${st.plays ? `${hgStarTotal()} ★` : ""}</span>
    </button>
    <button class="play-row" data-hg-daily><span><b>Today's gradient</b><span>${esc(HG_SHAPE_NAME[dspec.shape])} #${dspec.num}, the same board for everyone</span></span><em class="lt-best">${dd ? `<b>${dd.moves}</b>moves` : "new"}</em></button>`;
}
// the first tap goes straight into the teaching board; after that, the map
const hgEnter = () => hgS().taught ? hgMap() : hgPlay(0, 0);
function hgWire(el) {
  const m = el.querySelector("[data-hg-map]"); if (m) m.onclick = hgEnter;
  const d = el.querySelector("[data-hg-daily]"); if (d) d.onclick = () => hgDaily();
}
// Train room tiles (js/rooms2.js reads window.TRAIN_TILES when it draws; meta is read live through getters)
window.TRAIN_TILES = window.TRAIN_TILES || [];
window.TRAIN_TILES.push(
  { id: "hue", icon: "gradient", name: "Gradients", get meta() { const st = hgS(), nx = hgNext(); return st.plays ? `${HG_WORLDS[nx.w].name} ${nx.i + 1}${hgStarTotal() ? ` · ${hgStarTotal()} ★` : ""}` : "Put the colors back"; }, open: () => hgEnter() },
  { id: "hue-daily", icon: "gradient", name: "Today's gradient", get meta() { const d = hgS().daily[today()]; return d ? `${d.moves} moves` : "Same board for all"; }, open: () => hgDaily() });
function hgOpenRoute(id) {
  if (id === "daily") return hgDaily();
  return hgMap();
}
