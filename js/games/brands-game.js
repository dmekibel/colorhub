"use strict";
// Brand colors, a Train station. David, 2026-10-09: "A mini game where you guess the company from just the
// color, or they name the company and you pick between four colors." Two round kinds, mixed in one session:
//   A: a swatch is shown, pick the brand from 4 (same-category distractors; closer colors at higher tiers)
//   B: a brand name is shown, pick its color from 4 (a ΔE ladder of decoys around the real color)
// Data comes from js/brands.js (BD, loaded from data/design/brands.json). Every answer, right or wrong, links
// back to the nearest named color ("Coca-Cola red is closest to Carmine") and logs to the Learner Model on a
// miss, the same confusion-event hook the other Train games use (learnerLog / S.gymMiss).
// For you / Choose (CLAUDE.md craft bar): a plain two-way control, same shape as js/games/oo-ui.js's but with
// its own fixed four-tier ladder (no measured eye model exists for brand recall, so "For you" adapts by a
// simple streak staircase instead of a threshold).
// All top-level names here start with bg (tools/check_names.js: one shared global scope).

const BG_N = 15;
const BG_DIFFS = [["easy", "Easy"], ["medium", "Medium"], ["hard", "Hard"], ["expert", "Expert"]];
const BG_DE_BAND = { easy: [32, 55], medium: [18, 32], hard: [8, 18], expert: [3, 8] };   // mode B decoy ΔE ranges
const BG_WINDOW = { easy: 0.55, medium: 0.3, hard: 0.12, expert: 0 };   // mode A: fraction of closest brands to skip before picking distractors

function bgObj(x) { return x && typeof x === "object" && !Array.isArray(x); }
function bgS() {
  if (!bgObj(S.games)) S.games = {};
  const o = bgObj(S.games.bg) ? S.games.bg : (S.games.bg = {});
  if (!bgObj(o.pref)) o.pref = { m: "you", d: "medium" };
  if (!Number.isInteger(o.you)) o.you = 1;
  o.you = clamp(o.you, 0, BG_DIFFS.length - 1);
  o.best = o.best || 0;
  o.plays = o.plays || 0;
  o.streak = o.streak || 0;   // current-session streak, not persisted meaningfully across reloads but harmless
  return o;
}
const bgTierIdx = d => Math.max(0, BG_DIFFS.findIndex(x => x[0] === d));
const bgTierId = i => BG_DIFFS[clamp(i, 0, BG_DIFFS.length - 1)][0];
const bgPickTier = () => bgS().pref.m === "pick" ? bgS().pref.d : bgTierId(bgS().you);

// ---------- rounds ----------
const bgRand = arr => arr[Math.floor(Math.random() * arr.length)];
function bgShuffle(arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// mode A distractors: other brands sorted by color closeness to the target, a window per tier (closer window = harder)
function bgDistractorsA(d, target, tier) {
  const sameCat = d.brands.filter(b => b.id !== target.id && b.category === target.category);
  const pool = (sameCat.length >= 6 ? sameCat : d.brands.filter(b => b.id !== target.id))
    .map(b => ({ b, de: de2000(bdMainColor(target), bdMainColor(b)) }))
    .sort((a, b) => a.de - b.de);
  const skip = Math.floor(pool.length * BG_WINDOW[tier]);
  const window = pool.slice(skip);
  return bgShuffle(window.length >= 3 ? window : pool).slice(0, 3).map(x => x.b);
}
// mode B decoys: 3 hexes around the real one, each a random hue/lightness nudge landing inside the tier's ΔE band
function bgDecoyHex(hex, tier) {
  const [lo, hi] = BG_DE_BAND[tier];
  for (let tries = 0; tries < 24; tries++) {
    const [L, C, H] = lch(hex);
    const dL = (Math.random() * 2 - 1) * (hi * 0.6), dH = (Math.random() * 2 - 1) * 60;
    const cand = lchHex(clamp(L + dL, 6, 96), clamp(C + (Math.random() * 2 - 1) * (hi * 0.5), 4, 90), (H + dH + 360) % 360);
    const de = de2000(hex, cand);
    if (de >= lo && de <= hi) return cand;
  }
  return lchHex(...lch(hex).map((v, i) => i === 2 ? (v + hi * 3) % 360 : v));   // a safe fallback, still a valid LCh color
}
function bgRound(d, tier) {
  const mode = Math.random() < 0.6 ? "a" : "b";
  const target = bgRand(d.brands);
  const hex = bdMainColor(target);
  if (mode === "a") {
    const opts = bgShuffle([target, ...bgDistractorsA(d, target, tier)]);
    return { mode, target, hex, opts };
  }
  const decoys = [bgDecoyHex(hex, tier), bgDecoyHex(hex, tier), bgDecoyHex(hex, tier)];
  const opts = bgShuffle([hex, ...decoys]);
  return { mode, target, hex, opts };
}

// ---------- the For you / Choose control (same shape as js/games/oo-ui.js's ooPickMount, its own small state) ----------
function bgPickHTML() {
  const st = bgS(), p = st.pref, pick = p.m === "pick";
  const note = pick ? `Played at ${BG_DIFFS.find(x => x[0] === p.d)[1]}.` : `Adapts to you. Next: ${BG_DIFFS[st.you][1]}.`;
  return `<div class="oo-pk">
    <div class="oo-pk-seg" role="radiogroup" aria-label="Difficulty">${[["you", "For you"], ["pick", "Choose"]].map(([m, l]) => `<button class="${p.m === m ? "on" : ""}" role="radio" aria-checked="${p.m === m}" data-bg-m="${m}">${l}</button>`).join("")}</div>
    ${pick ? `<div class="oo-pk-ch" role="radiogroup" aria-label="Pick a difficulty">${BG_DIFFS.map(([id, name]) => `<button class="${p.d === id ? "on" : ""}" role="radio" aria-checked="${p.d === id}" data-bg-d="${id}">${name}</button>`).join("")}</div>` : ""}
    <p class="oo-pk-note">${esc(note)}</p></div>`;
}
function bgPickMount(host, onChange) {
  const draw = () => {
    host.innerHTML = bgPickHTML();
    host.querySelectorAll("[data-bg-m]").forEach(b => b.onclick = () => { bgS().pref.m = b.dataset.bgM; save(); buzz(4); draw(); if (onChange) onChange(); });
    host.querySelectorAll("[data-bg-d]").forEach(b => b.onclick = () => { bgS().pref.d = b.dataset.bgD; save(); buzz(4); draw(); if (onChange) onChange(); });
  };
  draw();
}

// ---------- the session ----------
let BG_LIVE = null;
function bgLogMiss(rightHex, pickedHex) {
  const nr = bdNearest(rightHex), np = bdNearest(pickedHex);
  if (!nr || !np || nr.n === np.n) return;
  if (typeof learnerLog === "function" && learnerLog({ type: "confuse", a: nr.n, b: np.n, src: "brands" })) return;
  if (!Array.isArray(S.gymMiss)) S.gymMiss = [];
  S.gymMiss.push({ type: "confuse", a: nr.n, b: np.n, src: "brands", game: "brands", t: Date.now() });
}
function bgEnter() {
  bdWhen(d => {
    if (!d.brands || d.brands.length < 8) { bgError(); return; }
    const st = bgS();
    BG_LIVE = { d, i: 0, score: 0, misses: [], tier: bgPickTier(), rounds: Array.from({ length: BG_N }, () => bgRound(d, bgPickTier())) };
    bgPlay();
  });
}
function bgError() {
  show(`<header class="art-top"><button class="icon-btn glass" data-back aria-label="Back">${ICON.back}</button><span class="eyebrow">Brand colors</span><span style="width:44px"></span></header>
    <p class="fine" style="margin:40px 16px">The brand archive didn't load. Check your connection and try again.</p>`, "article bg-page")
    .querySelector("[data-back]").onclick = xBack;
}
function bgRoundHTML(rd, i) {
  const head = `<div class="bg-top"><button class="icon-btn glass" data-bg-quit aria-label="Close">${ICON.x}</button><div class="bg-dots">${Array.from({ length: BG_N }, (_, j) => `<i class="${j < i ? "on" : j === i ? "now" : ""}"></i>`).join("")}</div><span style="width:44px"></span></div>`;
  if (rd.mode === "a") {
    return `${head}<p class="bg-q">Which brand is this?</p>
      <div class="bg-hero"><i style="--c:${rd.hex}"></i></div>
      <div class="bg-opts">${rd.opts.map(b => `<button class="bg-opt" data-bg-pick="${esc(b.id)}">${esc(b.name)}</button>`).join("")}</div>`;
  }
  return `${head}<p class="bg-q">Which color is ${esc(rd.target.name)}?</p>
    <div class="bg-opts bg-opts-sw">${rd.opts.map(h => `<button class="bg-opt bg-opt-sw" data-bg-pick="${esc(h)}"><i style="--c:${h}"></i></button>`).join("")}</div>`;
}
function bgPlay() {
  const live = BG_LIVE, rd = live.rounds[live.i];
  const el = show(bgRoundHTML(rd, live.i), "article bg-page");
  el.querySelector("[data-bg-quit]").onclick = () => bgQuit();
  let answered = false;
  el.querySelectorAll("[data-bg-pick]").forEach(b => b.onclick = () => {
    if (answered) return; answered = true;
    const val = b.dataset.bgPick;
    const right = rd.mode === "a" ? val === rd.target.id : val.toUpperCase() === rd.hex.toUpperCase();
    buzz(right ? 8 : 14);
    el.querySelectorAll("[data-bg-pick]").forEach(x => x.disabled = true);
    b.classList.add(right ? "right" : "wrong");
    if (!right) {
      const pickedHex = rd.mode === "a" ? bdMainColor(live.d.byId.get(val)) : val;
      el.querySelectorAll("[data-bg-pick]").forEach(x => { if (rd.mode === "a" ? x.dataset.bgPick === rd.target.id : x.dataset.bgPick.toUpperCase() === rd.hex.toUpperCase()) x.classList.add("right"); });
      live.misses.push({ rd, pickedHex });
      bgLogMiss(rd.hex, pickedHex);
      const st = bgS(); st.streak = 0; if (st.pref.m === "you") st.you = clamp(st.you - (live.misses.length > 1 ? 1 : 0), 0, BG_DIFFS.length - 1);
    } else {
      live.score++;
      const st = bgS(); st.streak = (st.streak || 0) + 1;
      if (st.pref.m === "you" && st.streak >= 3) { st.you = clamp(st.you + 1, 0, BG_DIFFS.length - 1); st.streak = 0; }
    }
    save();
    const near = bdNearest(right ? rd.hex : (rd.mode === "a" ? bdMainColor(live.d.byId.get(val)) : val));
    later(() => {
      const foot = document.createElement("div"); foot.className = "bg-foot";
      foot.innerHTML = `<p class="bg-fb">${right ? "Right." : "Not quite."} ${esc(rd.target.name)}'s nearest named color is <b>${near ? esc(bdNearest(rd.hex).n) : ""}</b>.</p>
        <button class="btn" data-bg-next>${live.i + 1 < BG_N ? "Next" : "See results"}</button>`;
      el.appendChild(foot);
      foot.querySelector("[data-bg-next]").onclick = () => { live.i++; live.i < BG_N ? bgPlay() : bgResults(); };
    }, 260);
  });
}
function bgQuit() { if (BG_LIVE && BG_LIVE.i > 0) bgResults(true); else xBack(); }
function bgResults(early) {
  const live = BG_LIVE, st = bgS();
  st.plays++; st.best = Math.max(st.best, live.score); save();
  const el = show(`<header class="art-top"><span style="width:44px"></span><span class="eyebrow">Brand colors</span><button class="icon-btn glass" data-done aria-label="Done">${ICON.check}</button></header>
    <h1 class="p-title">${live.score}/${live.i + (early ? 0 : 1) || BG_N}</h1>
    <p class="p-dek">${live.misses.length ? "Here's every one you missed." : "Clean round."}</p>
    ${live.misses.length ? `<div class="sec-head"><b>Your misses</b><span>tap a color to open it</span></div>
      <div class="bg-miss">${live.misses.map(m => `<div class="bg-miss-row"><span><i style="--c:${m.rd.hex}" data-swatch="${m.rd.hex}"></i><b>${esc(m.rd.mode === "a" ? m.rd.target.name : m.rd.target.name)}</b></span><span><i style="--c:${m.pickedHex}" data-swatch="${m.pickedHex}"></i><b>${esc(bdNearest(m.pickedHex) ? bdNearest(m.pickedHex).n : m.pickedHex)}</b></span></div>`).join("")}</div>` : ""}
    <div class="bg-pk-host"></div>
    <button class="btn" data-bg-again style="margin-top:20px">Play again</button>
    <button class="btn ghost" data-bg-brand style="margin-top:10px">Browse brand colors</button>`, "article bg-page");
  bgPickMount(el.querySelector(".bg-pk-host"));
  el.querySelector("[data-done]").onclick = xBack;
  el.querySelector("[data-bg-again]").onclick = () => bgEnter();
  el.querySelector("[data-bg-brand]").onclick = () => (typeof bdBrowser === "function" ? bdBrowser() : null);
}

// ---------- Train shelf tile ----------
window.TRAIN_TILES = window.TRAIN_TILES || [];
window.TRAIN_TILES.push({ id: "brands", icon: "brands", name: "Brand colors", get meta() { const st = bgS(); return st.plays ? `Best ${st.best}/${BG_N}` : "Guess the brand, or its color"; }, open: () => bgEnter() });
function bgOpenRoute() { XSTACK = []; bgEnter(); }
