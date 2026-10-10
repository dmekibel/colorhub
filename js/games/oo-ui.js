"use strict";
// Odd one out, its own station (#/odd): a journey map of 24 levels in four worlds, the Mix set after level 10,
// a daily shared board, an honest eye profile, and the round renderer that the Mix games and GAME_STEPS reuse.
// The engine (rounds, boards, the learner model, the staircase, the ladder) is js/games/oo-engine.js.
// Hooks elsewhere are additive: gym.js (the Train shelf and the gx:oo screenshot states), router.js (#/odd…).
// Every user-visible difference goes through pctFmt (js/core.js): a ΔE00 reads as % of black-to-white.

// ---------- state: S.games.oo (lazily created; unknown keys are kept; malformed parts are repaired) ----------
// { lv: highest unlocked level index, stars: { i: [finish, fast, noHint] }, best: { i: points }, model: {j, f},
//   seen: { kind: n }, daily: { day: [{ok, ms, act}] }, mix: { id: { stars, best } }, snaps: [[day, {axis: th}]], sets: n,
//   cleared: { i: 1 } (levels a test-out cleared), pref: { game: { m: "you" | "pick", d } } (For you or Choose, per game),
//   line / pairs / whose: { edge: { r, n } } (the edge estimate of the games without an eye model) }
// you: the level For you plays now (starts near your measured threshold, moves with every set you pass or miss);
// stars[i] / cleared[i] are per ladder level (design/ODD-ONE-OUT.md); old: the stars of the old 24-kind levels, kept.
// Every level is open to jump into.
const ooObj = x => x && typeof x === "object" && !Array.isArray(x);
function ooS() {
  if (!ooObj(S.games)) S.games = {};
  const o = ooObj(S.games.oo) ? S.games.oo : (S.games.oo = {});
  ["stars", "best", "seen", "daily", "mix", "cleared", "pref"].forEach(k => { if (!ooObj(o[k])) o[k] = {}; });
  // levels used to be 24 different kinds of board; they are now a ladder of gaps. The old stars are kept, not reused.
  if (!o.v3) { if (Object.keys(o.stars).length || o.lv) o.old = { stars: o.stars, best: o.best, lv: o.lv }; o.stars = {}; o.best = {}; o.cleared = {}; o.v3 = 1; delete o.lv; }
  if (Number.isInteger(o.you)) o.you = clamp(o.you, 0, OO_LEVEL_N - 1);
  o.model = ooModel(ooObj(o.model) ? o.model : {});
  if (!Array.isArray(o.snaps)) o.snaps = [];
  o.sets = +o.sets || 0;
  return o;
}
const ooStars = i => { const s = ooS().stars[i]; return Array.isArray(s) ? s : [0, 0, 0]; };
const ooStarCount = () => Object.values(ooS().stars).reduce((a, s) => a + (Array.isArray(s) ? s.filter(Boolean).length : 0), 0)
  + Object.values(ooS().mix).reduce((a, m) => a + (m && Array.isArray(m.stars) ? m.stars.filter(Boolean).length : 0), 0);
const ooMixOpen = () => { const st = ooS(); return ooDoneAt(st.stars, st.cleared, OO_MIX_AT - 1); };
// where For you starts a session: a little below your last edge (ooSessStart), else below your measured threshold,
// else level 1 for a new eye. st.you keeps it between visits.
function ooYou() {
  const st = ooS();
  if (!Number.isInteger(st.you)) { const e = ooEye(st.model, null, null); st.you = st.edge && isFinite(st.edge.x) ? ooSessStart({ edge: st.edge.x }) : e.th && e.n >= 6 ? ooSessStart({ th: e.th }) : 0; }
  return st.you;
}
// the level of your edge (the last session's, else the level your measured threshold sits at), or null before you have been measured
function ooEdgeLevel() { const st = ooS(); if (st.edge && isFinite(st.edge.x)) return Math.round(st.edge.x); const e = ooEye(st.model, null, null); return e.th && e.n >= 6 ? ooLevelForTh(e.th, 1) : null; }
// the level a Choose pick plays
const ooPickLv = () => { const e = ooEye(ooS().model, null, null); return ooPickLevel(ooPref("oo"), e.th); };
const ooDone = i => { const st = ooS(); return ooDoneAt(st.stars, st.cleared, i); };
const ooShotMode = () => typeof SHOT !== "undefined" && !!SHOT;

// ======================================================================
// For you or Choose: one compact control, the same on every game, remembered per game (S.games.oo.pref[game]).
// For you adapts, as it always did. Choose pins the game at a difficulty (Easy to Expert, or the Edge of my eye,
// which sits right at your measured threshold). Chosen rounds are still drawn from your own estimate, and every
// answer updates it by the difference actually drawn, so a chosen difficulty never skews the eye profile.
// Games: "oo" (Odd one out and its Mix), "line" (Across the line), "pairs" (Painters' pairs), "whose" (Whose palette?).
// ======================================================================
const ooPref = game => { const p = ooS().pref; return (p[game] = ooPrefNorm(p[game])); };
const ooPickFor = game => ooPickTier(ooPref(game));   // the tier to draw at, or null for For you
const ooTierLabel = t => (OO_DIFFS.find(d => d[2] === t) || OO_DIFFS[2])[1];
const OO_PK_ABOUT = {
  easy: "Wide gaps: a calm warm-up.", medium: "A fair gap: a quick look finds it.",
  hard: "A narrow gap: you'll miss some.", expert: "Narrower still, close to your limit.",
};
const OO_PK_YOU = {
  oo: "Adapts to your eye, and starts gently on anything new.", line: "Adapts: the push past the line shrinks as you improve.",
  pairs: "Adapts: the two pairs sit closer together as you improve.", whose: "Adapts: the other painters get closer to the right one as you improve.",
};
function ooPickNote(game, p) {
  if (p.m !== "pick") return game === "oo" ? `Next for you: level ${ooYou() + 1}, a ${pctFmt(ooLevelGap(ooYou()))} gap. It moves with your results.` : OO_PK_YOU[game] || "";
  if (game === "oo") {
    const lv = ooPickLv(), e = ooEye(ooS().model, null, null), at = `Level ${lv + 1}, a ${pctFmt(ooLevelGap(lv))} gap.`;
    if (p.d === "edge") return e.th && e.n >= 6 ? `${at} Right at your limit, from ${e.n} answers.` : `${at} Not measured yet, so this is a first guess; it sharpens as you play.`;
    return p.d === "level" ? at : `${at} ${OO_PK_ABOUT[p.d]}`;
  }
  if (p.d !== "edge") return OO_PK_ABOUT[p.d] || "";
  const e = (ooS()[game] || {}).edge;
  return e && e.n ? `Right at your limit, from ${e.n} answers.` : "Right at your limit. Not measured yet: it sharpens as you play.";
}
function ooPickHTML(game) {
  const p = ooPref(game), pick = p.m === "pick";
  return `<div class="oo-pk">
    <div class="oo-pk-seg" role="radiogroup" aria-label="Difficulty">${[["you", "For you"], ["pick", "Choose"]].map(([m, l]) => `<button class="${p.m === m ? "on" : ""}" role="radio" aria-checked="${p.m === m}" data-pk-m="${m}">${l}</button>`).join("")}</div>
    ${pick ? `<div class="oo-pk-ch" role="radiogroup" aria-label="Pick a difficulty">${OO_DIFFS.map(([id, name]) => `<button class="${p.d === id ? "on" : ""}" role="radio" aria-checked="${p.d === id}" data-pk-d="${id}">${name}</button>`).join("")}</div>` : ""}
    <p class="oo-pk-note">${esc(ooPickNote(game, p))}</p></div>`;
}
// fills host with the control and keeps it in step with the saved choice; onChange runs after a tap
function ooPickMount(host, game, onChange) {
  const draw = () => {
    host.innerHTML = ooPickHTML(game);
    host.querySelectorAll("[data-pk-m]").forEach(b => b.onclick = () => { ooPref(game).m = b.dataset.pkM; save(); buzz(4); draw(); if (onChange) onChange(); });
    host.querySelectorAll("[data-pk-d]").forEach(b => b.onclick = () => { ooPref(game).d = b.dataset.pkD; save(); buzz(4); draw(); if (onChange) onChange(); });
  };
  draw();
}
// a line for the results: what the set was drawn at (null in For you)
const ooPickLine = game => { const p = ooPref(game); return p.m === "pick" ? `Played at ${ooDiffName(p.d)}, your choice.` : null; };

// ---------- the reader other screens use: can this person see a difference? ----------
// ooEyeInfo(family, axis): family like "Blues" (or "blue"), axis "light" | "chroma" | "hue" (or "lightness",
// "vividness", "context", "memory"), either may be null (null axis = any difference, the three axes together).
// Returns { th (ΔE00), pct ("2.2%"), n (answers behind it), sure } or null before it's been measured.
// trEyeThreshold(family, axis) is the number alone, the hook js/learner.js's eyeThreshold() reads first; there
// "hue" / "de" mean any difference (the odd-one-out sense), so they map to the combined estimate here.
const OO_AXIS_ALIAS = { lightness: "light", value: "light", l: "light", vividness: "chroma", saturation: "chroma", c: "chroma", h: "hue" };
const ooFamName = family => { if (!family) return null; if (/^#?[0-9a-f]{6}$/i.test(family)) return ooFam("#" + String(family).replace("#", "")); let f = String(family).replace(/^gray/i, "grey"); f = f.charAt(0).toUpperCase() + f.slice(1).toLowerCase(); if (!f.endsWith("s")) f += "s"; return OO_FAMS[f] ? f : null; };
function ooEyeInfo(family, axis) {
  const fam = ooFamName(family), ax = axis ? (OO_AXIS_ALIAS[String(axis).toLowerCase()] || String(axis).toLowerCase()) : null;
  if (ax && !OO_AXES.includes(ax) && !OO_JUDG[ax]) return null;
  const m = ooS().model;
  if (ax && !OO_AXES.includes(ax)) { const r = m.j[ax]; return r && r.n ? { th: Math.exp(r.r), pct: pctFmt(Math.exp(r.r)), n: r.n, sure: r.n >= 12 } : null; }
  const e = ooEye(m, fam, ax);
  return e.th == null ? null : { th: e.th, pct: pctFmt(e.th), n: e.n, sure: e.sure };
}
function trEyeThreshold(family, axis) {
  const a = String(axis || "").toLowerCase(), e = ooEyeInfo(family, a === "hue" || a === "de" || !a ? null : a);
  return e ? e.th : null;
}

// ---------- every miss is a confusion event (Genius panel #4) ----------
// learnerLog (js/learner.js, another lane) when it exists; otherwise S.gymMiss, a capped list the learner lane reads.
function ooLogMiss(right, picked, meta = {}) {
  if (!right || !picked || right === picked) return;
  // a word mix-up only when both colors have real names; a perceptual miss between two hexes is eye data, not a naming confusion
  try {
    const nm = x => { const c = BYNAME.get(String(x).toLowerCase()); if (c) return c.n; const u = String(x).toUpperCase(); const e = (typeof ALL !== "undefined" ? ALL : []).find(c => c.h.toUpperCase() === u); return e ? e.n : null; };
    const na = nm(right), nb = nm(picked);
    if (na && nb && na !== nb && typeof learnerLog === "function" && learnerLog({ type: "confuse", a: na, b: nb, src: "train" })) return;
  } catch (e) {}
  // no learner (yet): a capped list the learner lane reads, with the direction of the miss (dL, dC, dH)
  const [L1, C1, H1] = lch(right), [L2, C2, H2] = lch(picked);
  let dH = H2 - H1; if (dH > 180) dH -= 360; if (dH < -180) dH += 360;
  if (!Array.isArray(S.gymMiss)) S.gymMiss = [];
  S.gymMiss.push({ type: "confuse", a: right, b: picked, src: "train", game: meta.game || "odd", judg: meta.judg || null, d: meta.d != null ? +(+meta.d).toFixed(2) : null,
    dL: +(L2 - L1).toFixed(1), dC: +(C2 - C1).toFixed(1), dH: +dH.toFixed(1), t: Date.now() });
  if (S.gymMiss.length > 400) S.gymMiss.splice(0, S.gymMiss.length - 400);
}

// ---------- the model: which difference to draw, and what an answer teaches ----------
// A weak family is aimed at about a third of the time (from the family offsets), the rest is spread.
function ooWeakFam(m) {
  const fams = Object.keys(OO_FAMS).filter(f => f !== "Greys" && m.f[f] && m.f[f].n >= 6).sort((a, b) => m.f[b].o - m.f[a].o);
  return fams.length && m.f[fams[0]].o > .12 ? fams[0] : null;
}
// one round's spec for a level: variant, board, size, axis, base family, and d from your threshold at the tier
function ooSpec(L, i, o = {}) {
  const st = ooS(), m = st.model, rnd = o.rnd || Math.random;
  const v = o.v || L.v, b = o.b || L.b, n = o.n || L.n, tw = o.tw !== undefined ? o.tw : L.tw;
  const kind = ooKindKey(v, b, tw), novel = (st.seen[kind] || 0) < 2;
  const tier = o.tier || ooTierAt(i, novel);
  const axis = v === "twins" ? null : ooPick(OO_AXES, rnd);
  const weak = ooWeakFam(m), fam = o.set ? null : weak && rnd() < .35 ? weak : null;
  const judg = tw === "flash" ? "memory" : ["busy", "sizes", "mosaic", "gradient", "painting"].includes(b) ? "context" : axis || "any";
  const th = judg === "any" ? Math.exp(OO_AXES.reduce((a, j) => a + Math.log(ooTheta(m, j, fam)), 0) / 3) : ooTheta(m, judg, fam);
  const cols = ooCols(b, n), bf = (OO_BF[b] || 1) * (["grid", "busy", "gradient"].includes(b) ? ooSizeF(cols) : 1);
  // o.gap: a ladder level's gap, drawn through the layout's modifier so every layout sits at the same perceptual level
  const jit = o.gap != null ? .94 + (o.rnd || Math.random)() * .12 : 1, ease = o.gap != null && novel && !o.noEase ? 1.6 : 1;
  const d = clamp(o.d != null ? o.d : o.gap != null ? o.gap * jit * ease * (OO_VF[v] || 1) * bf * (tw === "breathe" ? 1.1 : 1) : th * OO_TIER[tier] * (OO_VF[v] || 1) * bf * (tw === "breathe" ? 1.1 : 1), OO_MIN, OO_MAX);
  const illusion = tw === "illusion" && !novel && rnd() < .25;
  return { v, b, n, tw, d, axis, fam, rnd, tier, novel, kind, illusion, base: o.base || null, set: o.set || null, pool: o.set ? null : ooPool() };
}
// colors you've met, so practice reinforces the path (as the gym does); used for about half the bases
const ooPool = () => { const m = (typeof ALL !== "undefined" ? ALL : []).filter(c => S.cards && S.cards[c.id]).map(c => c.h); return m.length >= 6 ? m : null; };
// file an answer under its judgment and family; returns nothing
function ooRecord(r, res) {
  const st = ooS();
  st.seen[r.kindKey || ooKindKey(r.v, r.b, r.tw)] = (st.seen[r.kindKey || ooKindKey(r.v, r.b, r.tw)] || 0) + 1;
  if (r.noRecord || !(res.act > 0) || !r.judg || r.judg === "any") return;
  if (!OO_JUDG[r.judg]) return;
  const dEff = res.act / ((r.vf || 1) * (r.bf || 1));
  ooUpdate(st.model, r.judg, r.fam || ooFam(r.base || r.odd), dEff, !!res.ok, r.g || 0);
}
function ooSnap() {
  const st = ooS(), day = today(), th = {};
  [...OO_AXES, "context", "memory"].forEach(j => { const r = st.model.j[j]; if (r && r.n) th[j] = +Math.exp(r.r).toFixed(2); });
  if (!Object.keys(th).length) return;
  const last = st.snaps[st.snaps.length - 1];
  if (last && last[0] === day) last[1] = th; else st.snaps.push([day, th]);
  if (st.snaps.length > 90) st.snaps.splice(0, st.snaps.length - 90);
}

// ======================================================================
// The round renderer. ui = { q, stage, foot }. r = a round from ooRound (or a painting spec). o = { flash,
// breathe, hint, none (show a "None" answer), feedback }. Resolves with { ok, ms, picked, right, act, hint, dir }.
// ======================================================================
const OO_NUM_W = ["", "One", "Two", "Three", "Four"];
const OO_Q = { one: "Which tile is different?", pair: "Two tiles are different. Find both.", group: "Find the hidden shape.",
  count: "How many tiles are different?", twins: "Find the two identical tiles.", which: "Which tile is different?" };
function ooBoardHTML(r, o = {}) {
  // the simple game's boards are rows x cols (not always square: David, 2026-10-11, "the board doesn't have to
  // be square") and fill their stage edge to edge (oo-full), instead of the fixed aspect-ratio box every other
  // board type still uses.
  const full = r.rows != null, longSide = Math.max(r.rows || r.cols, r.cols);
  // big grids (up to ~20 a side) keep about a 2 px seam and small corners, so the tiles stay big enough to see
  const dense = longSide > 6 && (r.b === "grid" || r.b === "busy");
  const gap = r.b === "strip" ? .008 : r.b === "honey" || r.b === "ring" ? 0 : r.b === "mosaic" ? 0 : dense ? Math.min(.016, .09 / longSide) : .016;
  const g = r.ground, bg = !g ? "" : g.split === "v" ? `background:linear-gradient(90deg,${g.a} 50%,${g.c} 50%)` : g.split === "h" ? `background:linear-gradient(180deg,${g.a} 50%,${g.c} 50%)`
    : g.split === "d" ? `background:linear-gradient(135deg,${g.a} 50%,${g.c} 50%)` : `background:conic-gradient(${g.a} 0 25%,${g.c} 0 50%,${g.a} 0 75%,${g.c} 0)`;
  const pct = x => (x * 100).toFixed(3) + "%";
  const tiles = r.cells.map((c, i) => {
    const x = c.x + gap / 2, y = c.y + gap / 2, w = c.w - gap, h = c.h - gap;
    const img = r.paint ? `;background-image:url(${r.paint.url});background-size:${r.cols * 100}% ${r.cols * 100}%;background-position:${c.gx / (r.cols - 1) * 100}% ${c.gy / (r.cols - 1) * 100}%` : "";
    const st = `left:${pct(x)};top:${pct(y)};width:${pct(w)};height:${pct(h)};--c:${r.colors[i]}${c.rot ? `;--rot:${c.rot.toFixed(1)}deg` : ""}${o.breathe ? `;--bd:-${(Math.random() * 3.4).toFixed(2)}s;--bp:${(2.8 + Math.random() * 1.4).toFixed(2)}s` : ""}${img}`;
    return `<button class="oo-t oo-${c.shape}${r.paint ? " oo-pt" : ""}" data-i="${i}" style="${st}" aria-label="Tile ${i + 1}"></button>`;
  }).join("");
  return `<div class="oo-board oo-b-${r.b}${full ? " oo-full" : ""}${o.breathe ? " oo-breathe" : ""}${g ? " oo-ground" : ""}${dense ? " oo-dense" : ""}" style="--ar:${r.aspect || 1};${bg}">${tiles}</div>`;
}
// a ripple across the board from the tapped tile (calm: a small dip and lift, in order of distance)
function ooRipple(board, from) {
  if (reduceMotion || !board) return;
  const tiles = [...board.querySelectorAll(".oo-t")], f = from && from.getBoundingClientRect();
  if (!f) return;
  tiles.forEach(t => { const b = t.getBoundingClientRect(), dd = Math.hypot(b.left - f.left, b.top - f.top); t.style.setProperty("--dl", Math.round(dd * .9) + "ms"); t.classList.remove("rip"); void t.offsetWidth; t.classList.add("rip"); });
}
// ======================================================================
// The simple game's motion language (David, 2026-10-11: "more beautiful dynamics like [the ripple]"), built
// around the ripple above rather than beside it. Every piece here is quality over quantity, all on
// transform/opacity/filter (no layout thrash, 60fps), and every one checks `reduceMotion` first. Idle breathing
// was considered and deliberately left out -- see the note by ooShimmer below.
// ======================================================================
// a solved board melts away as the next one arrives: a short-lived clone fades/blurs out in a wave from its own
// center while the real board underneath renders and settles in, so advancing never waits on this to finish
function ooMeltGhost(ui) {
  if (reduceMotion) return;
  const board = ui.stage.querySelector(".oo-board");
  if (!board) return;
  const elRect = ui.el.getBoundingClientRect(), bRect = board.getBoundingClientRect();
  const clone = board.cloneNode(true);
  clone.classList.add("oo-ghost");
  Object.assign(clone.style, { position: "absolute", left: (bRect.left - elRect.left) + "px", top: (bRect.top - elRect.top) + "px",
    width: bRect.width + "px", height: bRect.height + "px", margin: "0", zIndex: "5", pointerEvents: "none" });
  ui.el.style.position = ui.el.style.position || "relative";
  ui.el.appendChild(clone);
  const cx = bRect.width / 2, cy = bRect.height / 2;
  clone.querySelectorAll(".oo-t").forEach(t => {
    const x = parseFloat(t.style.left) / 100 * bRect.width, y = parseFloat(t.style.top) / 100 * bRect.height;
    t.style.setProperty("--dl", Math.round(Math.hypot(x - cx, y - cy) * .55) + "ms");
    t.classList.add("oo-melt");
  });
  later(() => clone.remove(), 500);
}
// the new board settles in (a gentle scale+fade, staggered from the center) or, right after the grid grows,
// divides in (a livelier overshoot, the same stagger) -- "tiles split like cells dividing"
function ooEnterBoard(board, tiles, kind) {
  if (reduceMotion || !kind) return;
  const br = board.getBoundingClientRect(), cx = br.width / 2, cy = br.height / 2;
  tiles.forEach(t => {
    const x = parseFloat(t.style.left) / 100 * br.width, y = parseFloat(t.style.top) / 100 * br.height;
    t.style.setProperty("--dl", Math.round(Math.hypot(x - cx, y - cy) * .35) + "ms");
    t.classList.add(kind === "divide" ? "oo-divide-in" : "oo-settle-in");
  });
}
// a streak moment: a luminous sweep across the field, diagonally (an approximation of "along the gradient" that
// doesn't need to know which way any given gradient actually runs); every 10 is the slower, bigger bloom
function ooShimmer(board, big) {
  if (reduceMotion || !board) return;
  board.querySelectorAll(".oo-t").forEach(t => {
    const x = parseFloat(t.style.left) || 0, y = parseFloat(t.style.top) || 0;
    t.style.setProperty("--sdl", Math.round((x + y) * 2.4) + "ms");
    t.classList.remove("oo-shimmer-t"); void t.offsetWidth; t.classList.add("oo-shimmer-t");
  });
  if (big) { board.classList.remove("oo-bloom"); void board.offsetWidth; board.classList.add("oo-bloom"); later(() => board.classList.remove("oo-bloom"), 1500); }
}
// IDLE BREATHING, decided against (David asked for it to be a deliberate call): this game's whole point is
// judging a color against its neighbors. Any motion of a tile's own color or brightness while you're still
// looking -- even a "brightness-neutral" one is hard to guarantee truly neutral across every hue and a phone's
// own display curve -- risks nudging the exact perception being measured and taught (the same reasoning as
// "judge on booth grey" elsewhere in this app: the surround must stay honest). So the board is perfectly still
// from the moment it's dealt until you answer; everything above happens only at the transitions around that
// moment, which is also where every one of David's own examples lives (the ripple, the reveal, round changes,
// streaks, level-ups) -- none of them are mid-search.
// the reveal card's two halves grow out of the tiles they came from (a FLIP: the half starts the size and
// position of its origin tile, then relaxes to its real size), instead of appearing fully formed
function ooRevealFlip(ui, originOdd, originField) {
  if (reduceMotion) return;
  const halves = ui.foot.querySelectorAll(".oo-rv-half");
  if (halves.length !== 2) return;
  const origins = [originField, originOdd];
  halves.forEach((h, i) => {
    const o = origins[i]; if (!o || !o.isConnected) return;
    const hr = h.getBoundingClientRect(), or = o.getBoundingClientRect();
    if (!hr.width || !hr.height) return;
    const sx = or.width / hr.width, sy = or.height / hr.height;
    const dx = (or.left + or.width / 2) - (hr.left + hr.width / 2), dy = (or.top + or.height / 2) - (hr.top + hr.height / 2);
    h.style.transition = "none";
    h.style.transform = `translate(${dx}px,${dy}px) scale(${sx},${sy})`;
    requestAnimationFrame(() => { h.style.transition = "transform .42s var(--spring)"; h.style.transform = "none"; });
  });
}
let OO_LAST = null;   // the round on screen (screenshot mode taps its answer: js/games/oo-shot.js)
function ooAsk(ui, r, o = {}) {
  if (r.b === "painting" && !r.paint) return ooPaintPrep(r).then(ok => {
    // no readable pixels (a file:// page): the same round on a plain board, filed as context
    if (!ok) Object.assign(r, ooRound({ ...r.spec, b: "grid", d: r.spec.d / OO_BF.painting }), { judg: "context", bf: 1, noPaint: 1 });
    return ooAsk(ui, r, o);
  });
  OO_LAST = r;
  return new Promise(resolve => {
    const { q, stage, foot } = ui, v = r.v, tap = ["one", "pair", "group", "twins", "which"].includes(v);
    q.textContent = o.teach ? o.teach : r.b === "painting" ? "Which patch was recolored?" : o.flash ? "Remember the board" : v === "one" && r.k > 1 ? `${OO_NUM_W[r.k] || r.k} tiles are different. Find them all.` : OO_Q[v] || OO_Q.one;
    stage.innerHTML = ooBoardHTML(r, o);
    const board = stage.querySelector(".oo-board"), tiles = [...board.querySelectorAll(".oo-t")];
    ooEnterBoard(board, tiles, o.enter);
    let t0 = performance.now(), done = false, hint = false, sel = [];
    const btns = [];
    if (v === "count") btns.push(`<div class="oo-count">${[0, 1, 2, 3, 4].map(k => `<button class="oo-k" data-k="${k}">${k}</button>`).join("")}</div>`);
    const extras = [];
    if (o.none) extras.push(`<button class="oo-pill" data-none>None of them</button>`);
    if (o.hint && tap && !o.flash) extras.push(`<button class="oo-pill ghost" data-hint>Hint</button>`);
    if (extras.length) btns.push(`<div class="oo-extras">${extras.join("")}</div>`);
    foot.innerHTML = btns.join("");
    const reveal = () => {
      board.classList.remove("oo-hide");
      if (r.none) tiles.forEach(t => t.classList.add("same"));
      (v === "twins" ? r.ans : r.ans || []).forEach(i => tiles[i] && tiles[i].classList.add("ring"));
    };
    const finish = (ok, extra = {}) => {
      if (done) return; done = true;
      const ms = performance.now() - t0;
      tiles.forEach(t => t.disabled = true);
      foot.querySelectorAll("button").forEach(b => b.disabled = true);
      // freeze the timer bar exactly where it was (David, 2026-10-11: the reveal pauses it) instead of letting its
      // CSS transition keep running, invisibly, behind the settled board
      const tb = stage.querySelector(".oo-tlimit"); if (tb) { const cs = getComputedStyle(tb).transform; tb.style.transition = "none"; tb.style.transform = cs === "none" ? "" : cs; }
      buzz(ok ? 10 : [10, 40, 10]);
      if (!ok || o.feedback === false) reveal(); else (r.ans || []).forEach(i => tiles[i] && tiles[i].classList.add("ring"));
      if (ok && extra.el) ooRipple(board, extra.el);
      // the odd tile resolves into the color it should have been, timed to the ripple wave reaching it (David,
      // 2026-10-11: "the odd tile resolving into its true neighbor color as the wave passes")
      if (ok && o.resolveOdd && r.base && !reduceMotion) (r.ans || []).forEach(i => {
        const tt = tiles[i]; if (!tt) return;
        tt.classList.add("oo-resolve");
        const dl = parseFloat(tt.style.getPropertyValue("--dl")) || 0;
        later(() => { if (tt.isConnected) tt.style.setProperty("--c", r.base); }, dl + 90);
      });
      if (r.k > 1 && v === "one") q.textContent = ok ? `Found all ${OO_NUM_W[r.k].toLowerCase()}.` : `${OO_NUM_W[r.k]} tiles were different.`;
      if (o.feedback !== false && o.tileNames !== false) ooTileNames(board, tiles, r, extra.picked);
      resolve({ ok: ok ? 1 : 0, ms, hint, act: r.act, right: r.odd, dir: r.dir, ...extra });
    };
    // a per-round timer bar (the simple game): running out is a miss, same as a wrong tap
    if (o.timeLimit && !o.flash) {
      stage.insertAdjacentHTML("afterbegin", `<i class="oo-tlimit" style="--t:${o.timeLimit}ms"></i>`);
      requestAnimationFrame(() => { const b = stage.querySelector(".oo-tlimit"); if (b) b.classList.add("go"); });
      later(() => { if (!done) finish(false, { picked: null, timeout: true }); }, o.timeLimit);
    }
    // which way: after the right tile, the six words (one gesture: a tap)
    const askDir = (el) => {
      q.textContent = "How is it different?";
      el.classList.add("ring");
      const words = ooDirChoices(r.base).map(p => `<div class="oo-dirrow">${p.map(w => `<button class="oo-k oo-w" data-w="${w}">${w.charAt(0).toUpperCase() + w.slice(1)}</button>`).join("")}</div>`).join("");
      foot.innerHTML = `<div class="oo-dirs">${words}</div>`;
      foot.querySelectorAll("[data-w]").forEach(b => b.onclick = () => { b.classList.add("on"); const ok = b.dataset.w === r.dir; finish(ok, { el, picked: ok ? r.odd : null, said: b.dataset.w }); });
    };
    tiles.forEach(t => t.onclick = () => {
      if (done || t.classList.contains("off")) return;
      const i = +t.dataset.i, inAns = (r.ans || []).includes(i);
      t.classList.remove("tap"); void t.offsetWidth; t.classList.add("tap");
      if (v === "count") return;
      if (v === "pair" || v === "twins" || (r.ans || []).length > 1 && v === "one") {
        if (sel.includes(i)) return;
        if (!inAns) { t.classList.add("miss"); return finish(false, { picked: r.colors[i] }); }
        sel.push(i); t.classList.add("sel"); buzz(6);
        if (sel.length === r.ans.length) finish(true, { el: t, picked: r.colors[i] });
        else if (r.k > 1) q.textContent = `${r.ans.length - sel.length} more to find.`;
        return;
      }
      if (v === "which" && inAns) { done = false; tiles.forEach(x => x.disabled = true); foot.querySelectorAll("[data-hint],[data-none]").forEach(b => b.remove()); return askDir(t); }
      if (!inAns) t.classList.add("miss");
      finish(inAns, { el: t, picked: r.colors[i] });
    });
    foot.querySelectorAll("[data-k]").forEach(b => b.onclick = () => { b.classList.add("on"); const k = +b.dataset.k; finish(k === r.count, { said: k }); });
    const nb = foot.querySelector("[data-none]"); if (nb) nb.onclick = () => { nb.classList.add("on"); finish(!!r.none, { said: "none" }); };
    const hb = foot.querySelector("[data-hint]");
    if (hb) hb.onclick = () => {
      hint = true; hb.remove();
      const keep = new Set(r.ans || []), others = tiles.map((_, i) => i).filter(i => !keep.has(i));
      ooShuf(others, Math.random).slice(0, Math.floor(others.length / 2)).forEach(i => { tiles[i].classList.add("off"); tiles[i].disabled = true; });
    };
    // teach by doing: a new kind of round nudges the answer after a quiet wait (no wall of text)
    if (o.nudge && v !== "count" && !r.none) later(() => { if (!done) (r.ans || []).slice(0, v === "group" ? 1 : 2).forEach(i => tiles[i] && tiles[i].classList.add("nudge")); }, o.nudge + (o.flash ? (o.flashMs || 1000) : 0));
    if (o.flash) {
      tiles.forEach(t => t.disabled = true);
      later(() => { board.classList.add("oo-hide"); q.textContent = v === "count" ? "How many were different?" : "Where was the different one?"; tiles.forEach(t => t.disabled = false); t0 = performance.now(); }, o.flashMs || 1000);
    }
  });
}

// The names go ON the tiles (David, 2026-10-09: "maybe it should be on the colors themselves so the eye doesn't move
// far"): the odd tile carries its name and the way it differs ("Jade · lighter"), one plain tile beside it carries the
// rest's name. Only when a tile is wide enough for a body-size word (about 84 px); tiny tiles keep the line below.
function ooTileNames(board, tiles, r, picked) {
  if (!ooPref("oo").names) return;
  if (typeof nameOf !== "function" || !r.base || !r.odd || r.base === r.odd || r.none || r.b === "painting" || !(r.ans || []).length) return;
  const odd = r.v === "twins" ? null : tiles[r.ans[0]];
  if (!odd || odd.getBoundingClientRect().width < 84) return;
  const nb = nameOf(r.base).n, no = nameOf(r.odd).n;
  const put = (t, html, hex) => { if (t && !t.querySelector(".oo-tn")) t.insertAdjacentHTML("beforeend", `<span class="oo-tn" data-ink="${ink(hex)}">${html}</span>`); };
  put(odd, `${esc(no)}${r.dir ? `<em>${esc(r.dir)}</em>` : ""}`, r.odd);
  // the nearest plain tile, so the two names sit side by side
  const oc = r.cells[r.ans[0]], plain = tiles.map((t, i) => [t, i]).filter(([, i]) => !r.ans.includes(i) && r.colors[i] === r.base)
    .sort((a, b) => Math.hypot(r.cells[a[1]].x - oc.x, r.cells[a[1]].y - oc.y) - Math.hypot(r.cells[b[1]].x - oc.x, r.cells[b[1]].y - oc.y))[0];
  if (plain) put(plain[0], esc(nb), r.base);
}

// ---------- painting tiles: a painting cut into tiles, one patch recolored by d ----------
// The painting's own pixels, shifted in Lab so the patch's mean color moves by d (measured again after the shift:
// that measured difference is the round's score). Local images only (same origin), so the pixels can be read.
const ooPxLab = (r, g, b) => {
  const f = v => { v /= 255; return v > .04045 ? ((v + .055) / 1.055) ** 2.4 : v / 12.92; };
  r = f(r); g = f(g); b = f(b);
  let x = (r * .4124 + g * .3576 + b * .1805) / .95047, y = r * .2126 + g * .7152 + b * .0722, z = (r * .0193 + g * .1192 + b * .9505) / 1.08883;
  const t = v => v > .008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116; x = t(x); y = t(y); z = t(z);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
};
function ooPaintPrep(r) {
  const list = (typeof PAINTINGS !== "undefined" ? PAINTINGS : []).filter(p => p.img);
  if (!list.length) return Promise.resolve(false);
  const rnd = r.rnd || Math.random, p = list[Math.floor(rnd() * list.length)];
  return new Promise(res => {
    const img = new Image();
    img.onload = () => {
      try {
        const n = r.cols, S0 = 480, side = Math.min(img.naturalWidth, img.naturalHeight) * (.6 + rnd() * .3);
        const sx = rnd() * (img.naturalWidth - side), sy = rnd() * (img.naturalHeight - side);
        const cv = document.createElement("canvas"); cv.width = cv.height = S0;
        const cx = cv.getContext("2d", { willReadFrequently: true });
        cx.drawImage(img, sx, sy, side, side, 0, 0, S0, S0);
        const T = S0 / n, mean = (x0, y0) => { const d = cx.getImageData(x0, y0, T, T).data; let L = 0, a = 0, b = 0, k = 0; for (let i = 0; i < d.length; i += 12) { const q = ooPxLab(d[i], d[i + 1], d[i + 2]); L += q[0]; a += q[1]; b += q[2]; k++; } return [L / k, a / k, b / k]; };
        let at = null, sh = null;
        for (const i of ooShuf([...Array(n * n).keys()], rnd)) {
          const c = r.cells[i], m = mean(c.gx * T, c.gy * T);
          if (m[0] < 12 || m[0] > 92) continue;
          sh = ooPaintShift(m, r.axis, r.sign || 1, r.d);
          if (sh) { at = i; break; }
        }
        if (at == null) return res(false);
        const c = r.cells[at], before = mean(c.gx * T, c.gy * T), id = cx.getImageData(c.gx * T, c.gy * T, T, T), d = id.data;
        for (let i = 0; i < d.length; i += 4) {
          const q = ooPxLab(d[i], d[i + 1], d[i + 2]), rgbv = labRgb(q[0] + sh.delta[0], q[1] + sh.delta[1], q[2] + sh.delta[2]);
          d[i] = Math.round(clamp(rgbv[0], 0, 1) * 255); d[i + 1] = Math.round(clamp(rgbv[1], 0, 1) * 255); d[i + 2] = Math.round(clamp(rgbv[2], 0, 1) * 255);
        }
        cx.putImageData(id, c.gx * T, c.gy * T);
        const after = mean(c.gx * T, c.gy * T);
        r.paint = { url: cv.toDataURL("image/jpeg", .92), title: p.title, artist: p.artist };
        r.ans = [at]; r.act = ooGapDE(before, after); r.base = labHex(...before); r.odd = labHex(...after); r.dir = ooDirWord(r.base, r.odd);
        r.colors = r.cells.map(() => "#5F5F5F"); r.fam = ooFam(r.base);
        res(true);
      } catch (e) { res(false); }   // file:// pages can't read pixels: fall back to a plain board
    };
    img.onerror = () => res(false);
    img.src = p.img;
  });
}
// a painting round's spec (the engine draws the board geometry; the pixels come from ooPaintPrep)
function ooPaintRound(sp) {
  const geo = ooCells("painting", sp.n, sp.rnd || Math.random);
  return { v: sp.v, b: "painting", n: sp.n, d: sp.d, axis: sp.axis || ooPick(OO_AXES, sp.rnd || Math.random), sign: Math.random() < .5 ? -1 : 1, cells: geo.cells, cols: geo.cols, aspect: 1,
    colors: geo.cells.map(() => "#5F5F5F"), ans: [0], act: 0, judg: "context", vf: OO_VF[sp.v] || 1, bf: OO_BF.painting, g: 1 / (sp.n * sp.n), rnd: sp.rnd, spec: sp };
}

// ======================================================================
// The set runner: rounds one after another. Each answer lands in three beats (anticipation: the tile presses;
// impact: ring, ripple and a haptic; settle: one line that names both colors). A right answer moves on by
// itself; a miss stays until Next, with the two colors side by side and the direction words, so it teaches.
// cfg: { label, total, gen(i, run) -> { r, o, kind? } | null, lives?, endOnMiss?, max?, combo?, onEnd(stats),
//        onQuit?, cls?, box? (render inside this element, for a step or another lane's screen, instead of a screen) }
// ======================================================================
const OO_TIERS = ["intro", "easy", "medium", "hard", "harder", "boss"];
// a miss eases the next round; three right in a row lift it one step (ROADMAP §4: streak-sensitive)
function ooAdjTier(tier, run) {
  let i = OO_TIERS.indexOf(tier);
  if (run && run.prev && !run.prev.res.ok) i = Math.min(i, 2);
  else if (run && run.combo >= 3 && i > 0 && i < 5) i++;
  return OO_TIERS[i];
}
const ooThNow = () => { const m = ooS().model, o = {}; Object.keys(OO_JUDG).forEach(j => { if (m.j[j] && m.j[j].n) o[j] = Math.exp(m.j[j].r); }); return o; };
function ooRun(cfg) {
  eyeNamesReady();
  // i0: rounds already played in this session (Keep going continues a session: the bar picks up where it was)
  const st = { i: cfg.i0 || 0, hits: 0, res: [], combo: 0, maxCombo: 0, pts: 0, lives: cfg.lives || 0, hint: false, prev: null, th0: ooThNow() };
  // a long session gets one thin bar instead of 30 segments
  const bar = !cfg.lives && cfg.total > 12;
  const segs = cfg.lives ? `<div class="oo-hearts" aria-label="${cfg.lives} lives">${Array.from({ length: cfg.lives }, () => `<i></i>`).join("")}</div>`
    : bar ? `<div class="oo-prog" role="progressbar" aria-valuemin="0" aria-valuemax="${cfg.total}"><i style="--w:${(st.i / cfg.total * 100).toFixed(1)}%"></i></div>`
    : `<div class="segs">${Array.from({ length: cfg.total }, () => `<i style="--c:var(--ink)"></i>`).join("")}</div>`;
  // Play itself shows only the board, one short instruction and this quiet indicator -- nothing else (David,
  // 2026-10-09: "spot the difference seems too complex"). Level, streak and points move to the end-of-session
  // Details and the eye profile; a small Customize icon (grid size, Shuffle, names on tiles, session length)
  // replaces the setup screen that used to sit before round one.
  const html = `
    <header class="deck-top">${cfg.box ? "" : `<button class="icon-btn" data-close aria-label="Close">${ICON.x}</button>`}${segs}${cfg.customize && !cfg.box ? `<button class="icon-btn${cfg.tuneLabel ? " oo-tunelab" : ""}" data-tune aria-label="Customize">${ICON.tune}${cfg.tuneLabel ? "<small>Customize</small>" : ""}</button>` : ""}</header>
    <div class="drill-head oo-head"><h2 id="ooq"></h2></div>
    <div class="drill-stage oo-stage" id="oostage"></div>
    <div class="drill-foot oo-foot" id="oofoot"></div>`;
  let el;
  if (cfg.box) { cfg.box.innerHTML = `<div class="oo-inbox station">${html}</div>`; el = cfg.box; }
  else el = show(html, "fixed drill station oo-play" + (cfg.cls ? " " + cfg.cls : ""));
  const ui = { q: el.querySelector("#ooq"), stage: el.querySelector("#oostage"), foot: el.querySelector("#oofoot"), el };
  const quit = () => cfg.onQuit ? cfg.onQuit() : ooMap();
  const cb = el.querySelector("[data-close]"); if (cb) cb.onclick = quit;
  if (!cfg.box) onKey = e => { if (e.key === "Escape") quit(); };
  const segEls = el.querySelectorAll(".segs i"), hearts = el.querySelectorAll(".oo-hearts i"), progEl = el.querySelector(".oo-prog i"), lvlEl = null, meterEl = null;
  // the streak and level-up moment stay as sound and a haptic (buzz calls below); no running HUD text during play
  const showCombo = () => {};
  async function round() {
    const it = cfg.gen(st.i, st);
    if (!it) return end();
    ui.foot.innerHTML = ""; showCombo(it.note || null);
    const kind = it.kind || "board";
    const res = await (kind === "board" ? ooAsk(ui, it.r, it.o || {}) : OO_MIXPLAY[kind](ui, it));
    if (!ui.stage.isConnected) return;
    const r = it.r || {};
    if (it.record !== false && kind === "board") ooRecord(r, res);
    if (it.record !== false && kind !== "board" && it.judg && res.act > 0 && !res.noModel && OO_JUDG[it.judg]) ooUpdate(ooS().model, it.judg, ooFam(res.right || "#808080"), res.act / (it.vf || 1), !!res.ok, it.g || 0);
    if (!res.ok && res.picked && res.right) ooLogMiss(res.right, res.picked, { game: kind === "board" ? "odd:" + r.v : kind, judg: r.judg || it.judg, d: res.act });
    if (res.hint) st.hint = true;
    // points: 100 for right, up to 100 more for speed, times the streak (to ×5); slow and right never costs
    let moment = null;
    if (res.ok) {
      st.hits++; st.combo = res.ms < 5000 ? st.combo + 1 : 1; st.maxCombo = Math.max(st.maxCombo, st.combo);
      st.pts += Math.round((100 + clamp((6000 - res.ms) / 50, 0, 100)) * Math.min(Math.max(st.combo, 1), 5));
      if (cfg.combo && [3, 5, 8, 12].includes(st.combo)) { moment = `${st.combo} in a row`; buzz([8, 50, 8]); }
    } else { st.combo = 0; if (cfg.lives) { st.lives--; if (hearts[st.lives]) hearts[st.lives].classList.add("gone"); } }
    // a session's own beat (the staircase): a level-up is the bigger moment, with its own sound
    if (cfg.onAnswer) { const m = cfg.onAnswer(res, st); if (m) { moment = m; if (lvlEl) { lvlEl.classList.remove("up"); void lvlEl.offsetWidth; lvlEl.classList.add("up"); } } }
    if (lvlEl && cfg.labelOf) lvlEl.textContent = cfg.labelOf();
    if (meterEl && cfg.meter) meterEl.innerHTML = cfg.meter();
    st.res.push({ ...res, base: r.base || res.base, odd: r.odd || res.right, v: r.v || kind, b: r.b, none: r.none, count: r.count, dir: res.dir || r.dir, d: r.d });
    if (segEls[st.i]) { segEls[st.i].classList.add("on"); segEls[st.i].style.setProperty("--c", res.ok ? "var(--good)" : "var(--bad)"); }
    st.prev = { r, res };
    st.i++;
    if (progEl) progEl.style.setProperty("--w", (Math.min(1, st.i / cfg.total) * 100).toFixed(1) + "%");
    showCombo(moment);
    save();
    const fb = kind === "board" ? ooLine(r, res) : { html: res.line || "", cmp: res.cmp || null };
    const last = (cfg.endOnMiss && !res.ok) || (cfg.lives && st.lives <= 0) || (!cfg.lives && !cfg.endOnMiss && st.i >= cfg.total) || st.i >= (cfg.max || 99) || (cfg.endWhen && cfg.endWhen(st));
    // a miss on a color: the one you tapped and the right one fill the screen (js/misscompare.js), not two small squares
    const big = !res.ok && typeof mcShow === "function" && (res.mc || (kind === "board" && fb.cmp && res.picked && res.right && res.picked !== res.right ? { you: { h: res.picked }, was: { h: res.right } } : null));
    if (big) fb.cmp = null;
    const cmp = fb.cmp ? `<div class="oo-cmp">${fb.cmp.map(([h, w]) => `<span><i style="--c:${h}"></i><em>${esc(w)}</em></span>`).join("")}</div>` : "";
    if (res.ok && !last) {
      // right: the names stay on the tiles and the line stays put until you go on (David, 2026-10-09: no flash).
      // Next, or a tap anywhere on the board, goes on.
      ui.foot.innerHTML = `<div class="oo-rev oo-in"><p class="oo-fb ok">${fb.html}</p><button class="btn ghost" data-next>Next ${ICON.arrow}</button></div>`;
      let gone = false;
      const go1 = () => { if (gone) return; gone = true; round(); };
      ui.foot.querySelector("[data-next]").onclick = go1;
      later(() => { if (!gone && ui.stage.isConnected) ui.stage.addEventListener("click", e => { if (!e.target.closest("[data-swatch],.oo-ladd,[data-ladd],a")) go1(); }); }, 300);
      if (!cfg.box) onKey = e => { if (e.key === "Escape") quit(); else if (e.key === "Enter" || e.key === " " || e.key === "ArrowRight") { e.preventDefault(); go1(); } };
      return;
    }
    ui.foot.innerHTML = `<div class="oo-rev oo-in">${res.ok ? "" : cmp}<p class="oo-fb${res.ok ? " ok" : ""}">${fb.html}</p><button class="btn" data-next>${last ? (cfg.box ? "Done" : "See how you did") : "Next"} ${ICON.arrow}</button></div>`;
    ui.foot.querySelector("[data-next]").onclick = () => last ? end() : round();
    if (big) later(() => ui.foot.querySelector("[data-next]") && mcShow({ ...big, from: ui.stage.querySelector(".miss"), label: last ? "See how you did" : "Next", go: () => last ? end() : round() }), 450);
  }
  function end() {
    const o = ooS(); o.sets++; o.last = today(); ooSnap(); save();
    const rights = st.res.filter(x => x.ok).map(x => x.ms).sort((a, b) => a - b);
    const med = rights.length ? rights[Math.floor(rights.length / 2)] : null;
    const seen = st.res.filter(x => x.ok && x.act > 0 && x.base && x.odd);
    const best = seen.length ? seen.reduce((a, x) => x.act < a.act ? x : a) : null;
    cfg.onEnd({ ...st, med, min: best ? best.act : null, minPair: best ? [best.base, best.odd] : null, total: st.res.length, th1: ooThNow() });
  }
  round();
}
// the settle line after an answer: both colors named (js/eye-names.js), the size, the direction words; on a miss,
// the two colors side by side (cmp). Returns { html, cmp }.
const ooNames = (a, b, found) => typeof eyeNamesLine === "function" ? eyeNamesLine(a, b, { found }) : `${found ? "Right" : "The odd one"}: <b class="mono">${pctFmt(de2000(a, b))}</b> different, ${ooDirWord(a, b)}.`;
function ooLine(r, res) {
  const base = r.base, odd = r.odd, pair = base && odd && base !== odd;
  if (r.none) return { html: res.ok ? (r.v === "count" ? "Right: none. Every tile was the same color." : "Right: none. Every tile was the same color; the two grounds pushed them apart.")
    : r.v === "count" ? "None were different: every tile was the same color." : "None was different: every tile was the same color. The two grounds pushed some of them apart, which is the illusion this round tests." };
  if (r.v === "count") return { html: res.ok ? `Right: ${r.count}. ${pair ? ooNames(base, odd, true) : ""}` : `There ${r.count === 1 ? "was" : "were"} ${r.count}. ${pair ? ooNames(base, odd, false) : ""}`, cmp: !res.ok && pair ? [[base, "The rest"], [odd, "Different"]] : null };
  if (r.v === "which" && res.said) return { html: res.ok ? `Right: ${esc(res.said)}. ${ooNames(base, odd, true)}` : `It was ${esc(r.dir)}, not ${esc(res.said)}. ${ooNames(base, odd, false)}`, cmp: res.ok ? null : [[base, "The rest"], [odd, `The odd one: ${r.dir}`]] };
  if (r.v === "twins") return { html: res.ok ? "Right: the twins. Every other tile differs from them by at least " + `<b class="mono">${pctFmt(r.act)}</b>.` : `The ringed pair were the identical twins; the nearest other tile was <b class="mono">${pctFmt(r.act)}</b> away.` };
  const src = r.b === "painting" && r.paint ? ` <span class="oo-src">${esc(r.paint.title)}, ${esc(r.paint.artist)}</span>` : "";
  if (!pair) return { html: res.ok ? "Right." : "The ringed one was different." };
  return { html: ooNames(base, odd, !!res.ok) + src, cmp: res.ok ? null : [[base, r.b === "painting" ? "The patch before" : "The rest"], [odd, r.b === "painting" ? "After" : "The odd one"]] };
}

// ======================================================================
// The simple game's palette pool (David, 2026-10-10/11): a gradient's colors come from somewhere real -- a
// painting's own measured palette, a Look's named one, two colors painters reach for together far more than
// chance (Painters' pairs' own data), or the player's own favorites -- never a random hue. oo-engine.js only
// ever sees a plain { colors, label, link } object; it has no idea any of this data exists.
// ======================================================================
function ooBeautyKick() {
  try { if (typeof loadData === "function" && !window.LOOKS) loadData("looks"); } catch (e) {}
  try { if (typeof ooPairsLoad === "function") ooPairsLoad(); } catch (e) {}
}
function ooBeautyPool() {
  const out = [];
  (window.PAINTINGS || []).forEach(p => {
    if (!p.palette || p.palette.length < 3) return;
    const cs = p.palette.slice().sort((a, b) => b.share - a.share).slice(0, 5).map(x => x.h);
    out.push({ colors: cs, label: `${p.artist}, ${p.title}${p.year ? ", " + p.year : ""}`, link: { kind: "painting", id: p.id } });
  });
  if (Array.isArray(window.LOOKS)) {
    window.LOOKS.forEach(l => (l.pals || []).forEach(p => {
      if (!p.c || p.c.length < 3) return;
      out.push({ colors: p.c.map(x => x[0]).slice(0, 5), label: `${l.name} · ${p.n}`, link: { kind: "look", id: l.id } });
    }));
  }
  const P = window.OO_PAIRS;
  if (P && P.names && P.groups && P.groups.all) {
    P.groups.all.pairs.filter(pr => pr[4] >= 1.6).forEach(pr => {
      const a = P.names[pr[0]], b = P.names[pr[1]];
      if (a && b) out.push({ colors: [a[1], b[1]], label: `${a[0]} and ${b[0]}, painted together often`, link: null });
    });
  }
  return out;
}
// the player's own kept colors and kept paintings, as gradient sources (David, 2026-10-11)
function ooFavPool() {
  const out = [];
  try {
    const favs = Object.keys(S.favs || {}).filter(k => /^#[0-9a-f]{6}$/i.test(k));
    if (favs.length >= 2) {
      const n = Math.min(4, Math.max(2, Math.floor(favs.length / 2))), picked = ooShuf(favs, Math.random).slice(0, n);
      const names = picked.map(h => (typeof nameOf === "function" ? nameOf(h).n : h));
      out.push({ colors: picked, label: `Your colors: ${names.join(" → ")}`, link: null, fromFav: true });
    }
  } catch (e) {}
  try {
    const arts = Object.values(S.favArt || {}).filter(a => a && a.h);
    arts.slice(0, 6).forEach(a => {
      const m = ooMove(a.h, "hue", 1, 14) || ooMove(a.h, "light", 1, 14);   // a gentle neighbor, so it's a real 2-stop sweep
      out.push({ colors: [a.h, m ? m.hex : a.h], label: `From your favorite: ${a.a ? a.a + ", " : ""}${a.t || "a painting you kept"}`, link: null, fromFav: true });
    });
  } catch (e) {}
  return out;
}
// the pool a round draws from: curated, with favorites mixed in about 1 in 3 once there are enough to matter
function ooPalettePool() {
  const fav = ooFavPool(), beauty = ooBeautyPool();
  // eligible once there are 3+ favorites to draw from (kept colors and kept paintings together), not 3+ pool
  // entries -- a few kept colors already fold into one "Your colors" entry, so the pool itself can be small
  let favCount = 0;
  try { favCount = Object.keys(S.favs || {}).length + Object.keys(S.favArt || {}).length; } catch (e) {}
  if (fav.length && favCount >= 3 && Math.random() < 1 / 3) return fav;
  return beauty.length ? beauty : fav;
}
function ooPickPalette() {
  const pool = ooPalettePool();
  return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
}

// ======================================================================
// The reveal card (David, 2026-10-11): its own moment after every round, not a line of text. The board settles
// back; a card of what you just saw slides up -- the odd color and its field color as two big named halves, one
// line on how they differ, a gradient round's own key stops, and where the palette came from (tappable). Names
// are tappable too ([data-swatch] morphs into that color's page app-wide) and logged as a sighting so Learn
// benefits from every round, not just the ones that were about learning names.
// ======================================================================
const ooNm = h => { try { return typeof nameOf === "function" ? nameOf(h).n : h; } catch (e) { return h; } };
function ooSeenLog(hex) {
  try { if (typeof learnerLog === "function") learnerLog({ type: "seen", color: hex, src: "game" }); } catch (e) {}
}
function ooGradStops(r) {
  const src = r.paletteSource && r.paletteSource.colors;
  if (!src || src.length < 2) return null;
  if (src.length <= 3) return src;
  return [src[0], src[Math.floor(src.length / 2)], src[src.length - 1]];
}
function ooRevealHTML(r, res) {
  const odd = r.odd, field = r.base, pair = odd && field && odd !== field;
  const no = pair ? ooNm(odd) : null, nf = pair ? ooNm(field) : null;
  if (pair) { ooSeenLog(odd); ooSeenLog(field); }
  const halves = pair ? `<div class="oo-rv-halves">
      <button class="oo-rv-half" data-swatch="${field}" data-ink="${ink(field)}" style="--c:${field}"><b>${esc(nf)}</b><span class="mono">${esc(field)}</span></button>
      <button class="oo-rv-half" data-swatch="${odd}" data-ink="${ink(odd)}" style="--c:${odd}"><b>${esc(no)}</b><span class="mono">${esc(odd)}</span></button>
    </div>` : "";
  const diff = pair && r.dir ? `A touch ${esc(r.dir)}.` : r.none ? "Every tile was the same color." : res.ok ? "Right." : "The ringed tile was different.";
  const stops = r.gridType && r.gridType !== "flat" ? ooGradStops(r) : null;
  if (stops) stops.forEach(ooSeenLog);
  const stripHTML = stops ? `<div class="oo-rv-strip">${stops.map(h => `<button class="oo-rv-stop" data-swatch="${h}" data-ink="${ink(h)}" style="--c:${h}"><em>${esc(ooNm(h))}</em></button>`).join("")}</div>` : "";
  const src = r.paletteSource;
  const srcHTML = src ? `<button class="oo-rv-src"${src.link ? "" : " disabled"}>${src.fromFav ? "" : "Gradient from "}${esc(src.label)}</button>` : "";
  return { halves, diff, stripHTML, srcHTML, link: src && src.link };
}

// Survival and the Growing board: two stand-alone games beside the ladder (the Mix lists them). Their difference follows
// your own estimate and a staircase, not a level.
function ooPlayExtra(id) {
  if (!S.scr && !ooShotMode() && typeof screenCheck === "function") return screenCheck(() => ooPlayExtra(id));
  const survival = id === "survival", lay = ooLayout("grid3");
  let stair = null;
  const gen = (k, run) => {
    if (!stair) { const sp0 = ooSpec(lay, 0, { tier: "medium" }); stair = ooStair(sp0.d); }
    else if (run.prev) ooStairStep(stair, !!run.prev.res.ok);
    const n = Math.min(7, 3 + (survival ? Math.floor(run.hits / 2) : run.hits));
    const sp = ooSpec(lay, k, { n, tw: null, d: survival ? stair.d : null, tier: survival ? null : "medium" });
    const r = ooRound(sp); Object.assign(r, { tw: survival ? "survival" : "grow", kindKey: ooKindKey("one", "grid", id), fam: sp.fam || r.fam });
    return { r, o: { hint: true }, note: k > 0 && n > 3 && (survival ? run.hits % 2 === 0 : true) && run.prev && run.prev.res.ok ? `${n} × ${n}` : null };
  };
  ooRun({ label: survival ? "Survival" : "Growing board", total: survival ? 0 : 8, max: survival ? 30 : 8, lives: survival ? 3 : 0, endOnMiss: !survival, combo: true, gen,
    onEnd: s => {
      const st = ooS(), finish = survival ? s.total >= 10 : s.hits >= 4, old = (st.mix[id] || {}).stars || [0, 0, 0];
      const got = [finish, finish && s.med != null && s.med <= OO_FAST_MS, finish && !s.hint], stars = got.map((x, i) => x || old[i] ? 1 : 0), pb = s.pts > ((st.mix[id] || {}).best || 0);
      st.mix[id] = { stars, best: Math.max(s.pts, (st.mix[id] || {}).best || 0) }; save();
      ooResults({ title: survival ? "Survival" : "Growing board", s, finish, stars, got, pb, next: null, again: () => ooPlayExtra(id),
        score: survival ? `${s.total} rounds survived` : `${s.hits} right · reached ${Math.min(7, 3 + s.hits)} × ${Math.min(7, 3 + s.hits)}` });
    } });
}
// ---------- results: every end of a set is designed (cleared, mastered, a best, not yet) ----------
function ooResults(o) {
  const s = o.s, misses = s.res.filter(x => !x.ok && x.base && x.odd && x.base !== x.odd && !x.none).slice(0, 8);
  const starRow = (o.labels || ["Passed", "Quick", "No hints"]).map((w, k) => `<span class="oo-star${o.stars[k] ? " on" : ""}${o.got[k] && o.stars[k] ? " new" : ""}" style="--k:${k}"><i></i>${w}</span>`).join("");
  const nx = o.next != null ? OO_LEVELS[o.next] : null;
  const head = o.head ? o.head : o.mastered ? "Level <em>mastered.</em>" : o.unlocked ? "Level <em>cleared.</em>" : o.finish ? (o.pb ? "A new <em>best.</em>" : "Well <em>seen.</em>") : "Not <em>yet.</em>";
  // the honest eye line: the judgment that moved most during this set
  const moved = s.th0 && s.th1 ? Object.keys(s.th1).filter(j => s.th0[j] && Math.abs(Math.log(s.th1[j] / s.th0[j])) > .04).sort((a, b) => Math.abs(Math.log(s.th1[b] / s.th0[b])) - Math.abs(Math.log(s.th1[a] / s.th0[a])))[0] : null;
  const lede = o.lede ? o.lede : o.mastered ? `All three stars. ${o.world != null ? esc(OO_WORLDS[o.world].mile) : ""}`
    : o.finish ? "Every round was drawn near your own limit, so this is your eye working at its edge."
    : `You need ${OO_PASS} of ${OO_ROUNDS}. Every round is drawn near your own limit, so misses mean you're at your edge; the next set starts from where you are now.`;
  const el = show(`
    <div style="flex:1"></div>
    <p class="eyebrow">${esc(o.title)}</p>
    <h1>${head}</h1>
    ${o.test ? "" : `<div class="oo-stars-row">${starRow}</div>`}
    <p class="lede">${lede}</p>
    ${o.diff ? `<p class="note oo-dline">${esc(o.diff)}</p>` : ""}
    <div class="res-list">
      <div class="res"><span>This set</span><b class="mono">${esc(o.score)}</b><span></span></div>
      ${s.pts ? `<div class="res"><span>Points</span><b class="mono">${s.pts.toLocaleString()}</b>${o.pb ? "<em>best</em>" : "<span></span>"}</div>` : ""}
      ${s.maxCombo >= 3 ? `<div class="res"><span>Longest streak</span><b class="mono">${s.maxCombo} in a row</b><span></span></div>` : ""}
      ${s.minPair ? `<div class="res"><span>Smallest you spotted</span><b class="mono">${pctFmt(s.min)}</b><span class="oo-pair"><i style="--c:${s.minPair[0]}"></i><i style="--c:${s.minPair[1]}"></i></span></div>` : ""}
      ${moved ? `<div class="res"><span>Your ${esc(OO_JUDG[moved].toLowerCase())}</span><b class="mono">${pctFmt(s.th0[moved])} → ${pctFmt(s.th1[moved])}</b><span></span></div>` : ""}
    </div>
    ${o.unlockLine ? `<p class="gy-news"><b>Next time</b> ${esc(o.unlockLine)}.</p>` : ""}
    ${o.mixNew ? `<p class="gy-news"><b>Unlocked</b> The Mix: What changed?, Out of order, Rebuild, Was it there?, Imposter and n-back.</p>` : ""}
    ${misses.length ? `<div class="sec-head"><b>Your misses</b><span>tap a color to open it</span></div><div class="oo-miss">${misses.map(m => `<span><i style="--c:${m.base}" data-swatch="${m.base}"></i><i style="--c:${m.odd}" data-swatch="${m.odd}"></i><em class="mono">${pctFmt(m.act || 0)}</em></span>`).join("")}</div>` : ""}
    <p class="fine">Differences are measured on the colors as your screen drew them (CIEDE2000: 100% is black against white, and about 1% is the smallest difference most people see side by side). Phone screens and room light vary.</p>
    <div class="stack">
      ${o.next != null && o.finish ? `<button class="btn" data-nextlv>Level ${o.next + 1} ${ICON.arrow}</button><button class="btn ghost" data-again>${esc(o.againText || "Play again")}</button>` : `<button class="btn" data-again>${esc(o.againText || (o.finish ? "Play again" : "Try again"))} ${ICON.arrow}</button>`}
      <button class="btn ghost" data-map>${o.back || "Back to the map"}</button>
    </div>`, "result oo-res");
  el.querySelector("[data-again]").onclick = o.again;
  el.querySelector("[data-map]").onclick = o.onBack || (() => ooMap());
  onKey = e => { if (e.key === "Enter") el.querySelector("[data-again]").click(); };
  if (o.unlocked || o.pb || o.mastered) later(() => buzz([12, 60, 12]), 450);
}

// ======================================================================
// The game itself (#/odd; David, 2026-10-10): one screen. Tapping in lands on a 3 x 3 board immediately -- no
// setup, no journey map, no level picker, no customize sheet. Arcade (a thin per-round timer, three lives) is the
// default; Zen (no timer, no lives, endless) is one small pill in the header, not a menu. The grid grows from
// 3 x 3 to 9 x 9 as accuracy holds (ooSimpleGrid in js/games/oo-engine.js); three axes -- hue, saturation, value --
// are tracked and drawn separately (ooSimpleAxis/ooSimpleD), so the end screen can show your edge on each.
// ======================================================================
function ooEyeLine() {
  const m = ooS().model, fams = Object.keys(OO_FAMS).filter(f => f !== "Greys").map(f => [f, ooEye(m, f, null)]).filter(([, e]) => e.th && e.n >= 6).sort((a, b) => a[1].th - b[1].th);
  if (fams.length >= 2) return `You see ${fams[0][0].toLowerCase()} to ${pctFmt(fams[0][1].th)} different, ${fams[fams.length - 1][0].toLowerCase()} to ${pctFmt(fams[fams.length - 1][1].th)}.`;
  const any = ooEye(m, null, null);
  return any.th ? `About ${pctFmt(any.th)} so far. Your eye profile fills in as you play.` : "Your eye profile fills in as you play.";
}
const OO_S_AXIS_WORD = { hue: "Hue", light: "Value", chroma: "Saturation" };
// the state behind the simple game: the grid you're on, your rolling accuracy at that size, and Arcade or Zen
function ooSimpleState() {
  const st = ooS();
  if (!ooObj(st.simple)) st.simple = {};
  const o = st.simple;
  if (!Number.isInteger(o.cols) || o.cols < OO_S_MIN_COLS || o.cols > OO_S_MAX_COLS) o.cols = OO_S_MIN_COLS;
  if (!Array.isArray(o.acc)) o.acc = [];
  if (o.mode !== "zen") o.mode = "arcade";
  return o;
}
// the per-round timer: a little tighter as the grid grows (Arcade only)
const ooSimpleTime = cols => Math.round(7000 - clamp((cols - OO_S_MIN_COLS) / (OO_S_MAX_COLS - OO_S_MIN_COLS), 0, 1) * 3800);
// the end screen: one headline, three small bars (hue, saturation, value) against where you started this run
function ooSimpleEnd(zen, startTh, model, stats, again) {
  const nowTh = { hue: ooTheta(model, "hue", null), light: ooTheta(model, "light", null), chroma: ooTheta(model, "chroma", null) };
  const rows = OO_AXES.map(a => ({ a, before: startTh[a], now: nowTh[a], d: Math.log(startTh[a] / nowTh[a]) }));
  const best = rows.reduce((x, y) => y.d > x.d ? y : x, rows[0]);
  const sharpest = rows.slice().sort((x, y) => x.now - y.now)[0];
  const headline = best.d > .04 ? `Your ${OO_S_AXIS_WORD[best.a].toLowerCase()} edge sharpened to ${pctFmt(best.now)} today.`
    : `Sharpest today: ${OO_S_AXIS_WORD[sharpest.a].toLowerCase()}, ${pctFmt(sharpest.now)}.`;
  const bar = row => { const w = clamp(100 - Math.log(row.now / OO_S_FLOOR[row.a]) / Math.log(OO_MAX / OO_S_FLOOR[row.a]) * 100, 6, 100);
    const moved = Math.abs(row.d) > .03;
    return `<div class="oo-ebar"><span>${OO_S_AXIS_WORD[row.a]}</span><i style="--w:${w.toFixed(0)}%"></i><b class="mono">${pctFmt(row.now)}</b>${moved ? `<em>${row.now < row.before ? "↓" : "↑"} from ${pctFmt(row.before)}</em>` : ""}</div>`; };
  const el = show(`
    <div style="flex:1"></div>
    <p class="eyebrow">${zen ? "Zen" : "Arcade"} · ${stats.round} round${stats.round === 1 ? "" : "s"}</p>
    <h1>${esc(headline)}</h1>
    <p class="lede">${stats.hits} of ${stats.round} right · reached ${stats.cols} × ${stats.cols}${zen ? " · untimed" : ""}.</p>
    <div class="oo-ebars">${rows.map(bar).join("")}</div>
    <div class="stack">
      <button class="btn" data-again>Play again ${ICON.arrow}</button>
      <button class="btn ghost" data-keep>Keep going</button>
    </div>
    <p class="fine">Your edge is the smallest difference you spot about four times in five, measured on this screen. Phone screens and room light move it from day to day.</p>
  `, "result oo-res oo-sres");
  el.querySelector("[data-again]").onclick = () => again(zen);
  el.querySelector("[data-keep]").onclick = () => again(zen);
  onKey = e => { if (e.key === "Enter") el.querySelector("[data-again]").click(); };
  later(() => buzz(best.d > .04 ? [12, 60, 12] : 10), 400);
  return el;
}
// the game itself: one tap in, straight to the board. opt.zen forces Zen; opt.forceShape ("flat" | "grad1d" |
// "grad2d" | "combo" | "k2" | "k4") is a screenshot hook that pins the first round's shape.
function ooMap(opt = {}) {
  if (!S.scr && !ooShotMode() && typeof screenCheck === "function") return screenCheck(() => ooMap(opt));
  eyeNamesReady();
  ooBeautyKick();
  const sim = ooSimpleState(), zen = opt.zen != null ? opt.zen : sim.mode === "zen";
  sim.mode = zen ? "zen" : "arcade"; save();
  const model = ooS().model;
  const startTh = { hue: ooTheta(model, "hue", null), light: ooTheta(model, "light", null), chroma: ooTheta(model, "chroma", null) };
  const lives0 = zen ? 0 : 3;
  const st = { cols: sim.cols, acc: sim.acc.slice(), round: 0, hits: 0, lives: lives0, streak: 0, grew: false };
  const el = show(`
    <header class="deck-top">
      <button class="icon-btn" data-close aria-label="Close">${ICON.x}</button>
      ${zen ? `<span class="oo-ztally" data-tally></span>` : `<div class="oo-hearts" aria-label="${lives0} lives">${Array.from({ length: lives0 }, () => `<i></i>`).join("")}</div>`}
      <button class="oo-zenpill${zen ? " on" : ""}" data-zen aria-pressed="${zen}">${zen ? "Zen" : "Arcade"}</button>
    </header>
    <div class="drill-head oo-head"><h2 id="ooq"></h2></div>
    <div class="drill-stage oo-stage" id="oostage"></div>
    <div class="drill-foot oo-foot" id="oofoot"></div>`, "fixed drill station oo-play oo-simple");
  const ui = { q: el.querySelector("#ooq"), stage: el.querySelector("#oostage"), foot: el.querySelector("#oofoot"), el };
  const quit = () => { save(); go("gym"); };
  el.querySelector("[data-close]").onclick = quit;
  onKey = e => { if (e.key === "Escape") quit(); };
  el.querySelector("[data-zen]").onclick = () => { sim.mode = zen ? "arcade" : "zen"; save(); buzz(4); ooMap(); };
  const tallyEl = el.querySelector("[data-tally]");
  const paintTally = () => {
    if (!tallyEl) return;
    const avg = Math.exp(OO_AXES.reduce((a, j) => a + Math.log(ooTheta(model, j, null)), 0) / 3);
    tallyEl.textContent = `${st.hits} of ${st.round} · ${pctFmt(avg)}`;
  };
  paintTally();
  function nextRound() {
    ooMeltGhost(ui);
    const enter = st.round === 0 ? null : st.grew ? "divide" : "settle"; st.grew = false;
    const breather = st.round > 0 && st.round % 5 === 4;
    const aspect = (ui.stage.clientHeight / ui.stage.clientWidth) || 1.6;
    let r = null;
    if (st.round === 0 && opt.forceShape) {
      const axis = ooSimpleAxis(model), skill = ooSimpleSkill(st.cols), fs = opt.forceShape;
      const d = Math.min(ooSimpleD(model, axis, false), 6);   // a screenshot/forced round never needs an extreme gap
      const richness = ["grad1", "grad2", "grad3"].includes(fs) ? fs : "flat";
      const mix = fs === "combo" ? { [axis]: .6, [OO_AXES.find(a => a !== axis)]: .4 } : { [axis]: 1 };
      const k = fs === "k4" ? 4 : fs === "k2" ? 2 : 1, bf = OO_S_GRAD_F[richness] || 1;
      const { rows, cols } = ooSimpleDims(st.cols, aspect), palette = opt.palette || ooPickPalette();
      for (let tries = 0; tries < 8 && !r; tries++) r = ooSimpleGradRound(rows, cols, richness, palette && palette.colors, skill, mix, d * bf, k, Math.random);
      if (r) Object.assign(r, { axis, judg: axis, mix, bf: r.gridType && r.gridType !== "flat" ? bf : 1, paletteSource: palette });
    }
    if (!r) r = ooSimpleRound({ model, cols: st.cols, round: st.round, aspect, palette: ooPickPalette() }, breather);
    ui.foot.innerHTML = "";
    const o = { feedback: true, tileNames: false, resolveOdd: true, enter };   // names live in the reveal card now, never crowding small tiles
    if (!zen) o.timeLimit = ooSimpleTime(st.cols);
    ooAsk(ui, r, o).then(res => onAnswer(r, res));
  }
  function onAnswer(r, res) {
    if (!ui.stage.isConnected) return;
    // captured before the reveal card replaces the foot and the board settles back, for the reveal halves' FLIP
    const tilesNow = [...ui.stage.querySelectorAll(".oo-t")];
    const originOdd = r.ans && r.ans.length ? tilesNow[r.ans[0]] : null;
    const originField = tilesNow.find((t, i) => r.ans && !r.ans.includes(i)) || null;
    st.round++;
    if (res.ok) { st.hits++; st.streak++; } else { if (!zen) st.lives--; st.streak = 0; }
    st.acc.push(res.ok ? 1 : 0); if (st.acc.length > OO_S_WINDOW) st.acc.shift();
    // a combined-axis round still only teaches the judgment it mainly tested: crediting every axis with its own
    // slice of one shared outcome reads as "a tiny hue nudge alone was spotted" even when a much bigger chroma
    // or lightness move did the real work, which quietly dragged every axis's estimate down (confirmed with
    // tools/oo_simple_sim.js). The dominant axis in the mix gets the full drawn gap, as if the round were pure.
    if (res.act > 0) {
      const mix = r.mix || (r.judg ? { [r.judg]: 1 } : null);
      if (mix) {
        const dom = Object.keys(mix).reduce((best, a) => mix[a] > mix[best] ? a : best, Object.keys(mix)[0]);
        if (OO_AXES.includes(dom)) ooUpdate(model, dom, r.fam || ooFam(r.base || r.odd), res.act / ((r.vf || 1) * (r.bf || 1)), !!res.ok, r.g || 0);
      }
    }
    if (!res.ok && res.picked && res.right) ooLogMiss(res.right, res.picked, { game: "odd:simple", judg: r.judg, d: res.act });
    const newCols = ooSimpleGrid(st.cols, st.acc);
    if (newCols !== st.cols) { st.grew = newCols > st.cols; st.cols = newCols; st.acc = []; }
    sim.cols = st.cols; sim.acc = st.acc.slice(); sim.last = today(); save();
    if (!zen) { const hearts = el.querySelectorAll(".oo-hearts i"); if (hearts[st.lives]) hearts[st.lives].classList.add("gone"); }
    paintTally();
    const over = !zen && st.lives <= 0;
    const board = ui.stage.querySelector(".oo-board");
    // a streak moment: a luminous sweep every 5 in a row, a slower bloom every 10 -- before the board settles
    // back, so the sweep plays on the full field
    if (res.ok && st.streak > 0 && st.streak % 5 === 0 && board) { const big = st.streak % 10 === 0; ooShimmer(board, big); buzz(big ? [12, 60, 12] : [8, 50, 8]); }
    // the board settles back (David, 2026-10-11: "its own moment"); a reveal card slides up over it with what
    // you just saw -- two big named halves, how they differ, a gradient's own key stops, and the palette's source
    if (board) board.classList.add("oo-settle");
    const rv = ooRevealHTML(r, res);
    ui.foot.innerHTML = `<div class="oo-reveal${reduceMotion ? "" : " oo-in"}">
      ${rv.halves}
      <p class="oo-rv-diff">${rv.diff}</p>
      ${rv.stripHTML}
      ${rv.srcHTML}
      <button class="btn${res.ok && !over ? " ghost" : ""}" data-next>${over ? "See how you did" : "Next"} ${ICON.arrow}</button>
    </div>`;
    // the two halves grow out of the tiles they came from (David, 2026-10-11)
    ooRevealFlip(ui, originOdd, originField);
    // tap anywhere on the reveal (not a name or the source line) moves on, once -- the "Next" button sits INSIDE
    // the reveal card, so its own click also bubbles to the card's tap-anywhere listener below; both must share
    // one guard or a single tap fires two rounds (David 2026-10-11's reveal card surfaced this).
    let gone = false;
    const g2 = () => { if (gone) return; gone = true; if (over) end(); else nextRound(); };
    ui.foot.querySelector("[data-next]").onclick = g2;
    const srcBtn = ui.foot.querySelector(".oo-rv-src"); if (srcBtn && rv.link) srcBtn.onclick = e => { e.stopPropagation(); if (rv.link.kind === "painting") location.hash = "#/painting/" + String(rv.link.id).replace(/^painting-/, ""); else if (rv.link.kind === "look") location.hash = "#/look/" + rv.link.id; };
    ui.foot.querySelector(".oo-reveal").addEventListener("click", e => { if (!e.target.closest("[data-swatch],.oo-rv-src,a")) g2(); });
    if (!zen) later(() => { if (!gone) g2(); }, 2500);
    buzz(res.ok ? (zen ? 8 : 10) : [10, 40, 10]);
  }
  function end() { ooSimpleEnd(zen, startTh, model, st, z => ooMap({ zen: z })); }
  nextRound();
}
const ooEnter = () => ooMap();

// ======================================================================
// Eye profile (#/odd/eye): honest, with the caveats
// ======================================================================
// where a threshold sits on the ladder: "level 17"
const ooLvOf = th => `level ${ooLevelOfGap(th) + 1}`;
const OO_AXIS_WORD = { light: "lightness", chroma: "vividness", hue: "hue" };
// the sharpest and the softest spot in the profile, on the ladder: "Sharpest: lightness in blues, level 17. Softest: hue in yellows, level 11."
function ooEyeLevels() {
  const m = ooS().model, found = [];
  OO_AXES.forEach(a => { const e = ooEye(m, null, a); if (e.th && e.n >= 8) found.push({ th: e.th, t: `${OO_AXIS_WORD[a]} differences` }); });
  Object.keys(OO_FAMS).filter(f => f !== "Greys").forEach(f => OO_AXES.forEach(a => { if ((m.f[f + ":" + a] || {}).n >= 6) { const e = ooEye(m, f, a); if (e.th) found.push({ th: e.th, t: `${OO_AXIS_WORD[a]} in ${f.toLowerCase()}` }); } }));
  if (found.length < 2) return "";
  found.sort((x, y) => x.th - y.th);
  const b = found[0], w = found[found.length - 1];
  return `Sharpest: ${b.t}, ${ooLvOf(b.th)}. Softest: ${w.t}, ${ooLvOf(w.th)}.`;
}
function ooEyePage() {
  const m = ooS().model, cell = e => e.th == null ? `<td class="na">–</td>` : `<td class="${e.sure ? "" : "thin"}">${pctFmt(e.th)}<small>${ooLvOf(e.th).replace("level ", "level ")}</small></td>`;
  const rows = Object.keys(OO_FAMS).map(f => { const es = ["light", "chroma", "hue"].map(a => (m.f[f + ":" + a] || {}).n ? ooEye(m, f, a) : { th: null }); return es.some(e => e.th != null) ? `<tr><th><i style="--c:${ooFamHex(f)}"></i>${esc(f)}</th>${es.map(cell).join("")}</tr>` : ""; }).join("");
  const js = Object.keys(OO_JUDG).map(j => { const r = m.j[j]; return r && r.n ? `<div class="ey-row"><span>${esc(OO_JUDG[j])}</span><i style="--w:${clamp(100 - Math.log(Math.exp(r.r) / OO_MIN) / Math.log(OO_MAX / OO_MIN) * 100, 4, 100).toFixed(0)}%"></i><b>${pctFmt(Math.exp(r.r))}<small>${ooLvOf(Math.exp(r.r))}</small></b></div>` : ""; }).join("");
  const sn = ooS().snaps, first = sn.length >= 2 ? sn[0] : null, last = sn[sn.length - 1];
  const trend = first && last ? Object.keys(last[1]).filter(j => first[1][j]).map(j => `${OO_JUDG[j].toLowerCase()} ${pctFmt(first[1][j])} → ${pctFmt(last[1][j])}`).slice(0, 3).join(" · ") : "";
  const el = show(`
    <header class="deck-top"><button class="icon-btn" data-close aria-label="Back">${ICON.back}</button></header>
    <h1 class="title-1 oo-title">Your eye</h1>
    <p class="lede">${esc(ooEyeLine())}</p>
    ${ooEyeLevels() ? `<p class="note oo-lvs">${esc(ooEyeLevels())}</p>` : ""}
    ${js ? `<div class="sec-head"><b>By judgment</b><span>smaller is sharper</span></div><div class="ey-rows oo-ey">${js}</div>` : `<p class="note oo-empty">Play a level of Odd one out and your profile starts here: one number for hue, lightness and vividness, then one for each color family.</p>`}
    ${rows ? `<div class="sec-head"><b>By family and axis</b><span>lightness · vividness · hue</span></div>
      <table class="oo-eyet"><thead><tr><th></th><th>Lightness</th><th>Vividness</th><th>Hue</th></tr></thead><tbody>${rows}</tbody></table>
      <p class="fine">Faded numbers rest on fewer than 12 answers. A dash means not measured yet.</p>` : ""}
    ${trend ? `<div class="sec-head"><b>Since ${esc(fmtDay(first[0]))}</b></div><p class="note">${esc(trend)}</p>` : ""}
    <p class="fine">Each number is the difference you'd spot about half the time (on top of lucky guesses), estimated from every round you've played: hard rounds you get right bring it down, easy ones you miss push it up. It's measured on this screen, in this light, so it moves from day to day; about 1% is the smallest difference most people see side by side. These games sharpen this judgment; they make no wider brain-training claim.</p>
  `, "oo-eye");
  el.querySelector("[data-close]").onclick = () => ooMap();
}
const ooFamHex = f => { const F = OO_FAMS[f]; const h = F.h[0] <= F.h[1] ? (F.h[0] + F.h[1]) / 2 : ((F.h[0] + F.h[1] + 360) / 2) % 360; return ooFit((F.L[0] + F.L[1]) / 2, (F.C[0] + F.C[1]) / 2, h); };

// ======================================================================
// The daily seed board, as a step another screen calls (the dailies belong to L25: challenge.js and daily()).
// gameDailyBoard(container, day = today(), opts) plays six rounds at fixed differences, the same for everyone on
// that day, inside the container, and resolves { day, num, res: [{ ok, ms, act, base, odd }], hits, min, text }.
// text is a plain share line (no emoji grid): "ColorHub · Odd one out #1: 5 of 6, down to 1.8% different".
// ======================================================================
function gameDailyBoard(box, day = today(), opts = {}) {
  const rounds = ooDaily(day);
  return new Promise(resolve => ooRun({ box, label: opts.label || `#${ooDayNum(day)}`, total: 6, combo: true,
    gen: k => { const r = rounds[k]; if (!r) return null; r.kindKey = ooKindKey(r.v, r.b, ""); return { r, o: {} }; },
    onEnd: s => { const res = s.res.map(x => ({ ok: x.ok, ms: Math.round(x.ms), act: +(x.act || 0).toFixed(2), base: x.base, odd: x.odd }));
      resolve({ day, num: ooDayNum(day), res, hits: s.hits, min: s.min, text: ooShareText(day, res) }); } }));
}

// ======================================================================
// Play a set of colors (Genius panel #1): today's words, your mix-ups, a painting, a photo
// ooPlaySet({ title, colors: [hex | {hex|h}] }, task) where task is a variant ("one", "pair", "count", "twins",
// "which", "group") or a Mix game id ("changed", "outoforder", "rebuild", "wasthere", "imposter", "nback").
// ======================================================================
const ooSetHexes = set => (Array.isArray(set) ? set : set && set.colors || []).map(c => typeof c === "string" ? c : c && (c.hex || c.h)).filter(h => /^#[0-9a-f]{6}$/i.test(h || "")).map(h => h.toUpperCase());
function ooPlaySet(set, task = "one", opts = {}) {
  const hexes = ooSetHexes(set), title = set && set.title || "Your colors";
  if (!hexes.length) return toast("No colors to play with");
  if (OO_MIXPLAY[task]) return ooPlayMix(task, { set: hexes, title, onQuit: opts.onQuit });
  const v = OO_VF[task] ? task : "one", L = { v, b: "grid", n: v === "group" ? 6 : v === "twins" ? 3 : 4 };
  ooRun({ label: title.length > 14 ? title.slice(0, 13) + "…" : title, total: OO_ROUNDS, combo: true, onQuit: opts.onQuit || (() => go("gym")),
    gen: (k, run) => { const sp = ooSpec(L, k, { set: hexes, tier: ooAdjTier(ooTierAt(k, false), run) }); const r = ooRound(sp); r.kindKey = sp.kind; return { r, o: { hint: true } }; },
    onEnd: s => ooResults({ title, s, finish: s.hits >= OO_PASS, stars: [s.hits >= OO_PASS, s.med != null && s.med <= OO_FAST_MS && s.hits >= OO_PASS, s.hits >= OO_PASS && !s.hint].map(Number), got: [1, 1, 1], pb: false, next: null,
      again: () => ooPlaySet(set, task, opts), score: `${s.hits} of ${s.total} right`, back: "Done", onBack: opts.onQuit || (() => go("gym")) }) });
}

// js/colorset.js csPlay(set) calls this: a ColorSet ({ title, colors: [{ h }] }) and a task ("odd" = odd one out)
function playSet(set, task = "odd") { return ooPlaySet(set, task === "odd" ? "one" : task, { onQuit: () => go("gym") }); }

// ======================================================================
// The Train shelf (gym.js hook), the old stations it replaces, and routes (router.js hook)
// ======================================================================
function ooShelf() {
  const st = ooS(), sim = ooSimpleState(), ln = st.line || {};
  const acc = sim.acc.length ? Math.round(sim.acc.reduce((a, b) => a + b, 0) / sim.acc.length * 100) : null;
  return `<div class="sec-head"><b>Odd one out</b><span>a game of its own</span></div>
    <button class="oo-shelf" data-oo-map>
      <span class="oo-nt"><b>${st.sets ? `${sim.cols} × ${sim.cols}${acc != null ? ` · ${acc}% right` : ""}` : "Find the different tile"}</b><em>${st.sets ? "One tap back in. Zen mode plays with no timer, no lives." : "One tap in: a 3 × 3 board, no setup. It grows with you."}</em></span>
    </button>
    <button class="play-row" data-oo-line><span><b>Across the line</b><span>Three of these are Teal. Which one isn't?</span></span><em class="lt-best">${ln.best ? `<b>${ln.best}</b>best` : "new"}</em></button>
    <button class="play-row" data-oo-pairs><span><b>Painters' pairs</b><span>Which colors did painters put together?</span></span><em class="lt-best">${st.pairs && st.pairs.best ? `<b>${st.pairs.best}</b>best` : "new"}</em></button>
    <button class="play-row" data-oo-whose><span><b>Whose palette?</b><span>Five colors from a painter's work: whose are they?</span></span><em class="lt-best">${st.mix.whose && st.mix.whose.best ? `<b>${st.mix.whose.best}</b>best` : "new"}</em></button>`;
}
// Every tap on Odd one out goes straight to the board (David, 2026-10-10: "very simple, always adapting") -- one
// tap in, no setup, no map. ooMap (#/odd) is the game itself now; ooEnter is the same door from the Train shelf.
function ooWire(el) {
  const m = el.querySelector("[data-oo-map]"); if (m) m.onclick = ooEnter;
  const l = el.querySelector("[data-oo-line]"); if (l) l.onclick = () => ooAcross();
  const w = el.querySelector("[data-oo-whose]"); if (w) w.onclick = () => ooWhose();
  const pp = el.querySelector("[data-oo-pairs]"); if (pp) pp.onclick = () => ooPairs();
}
// The old stations this replaces (design/IDEAS-10X/train-games.md §5): Odd one out, Color memory and Sort the
// strip open their new homes. Their history stays in S.gym (the old Odd one out's family scores seed
// js/learner.js's eyeThreshold until the new model has answers), and check-ins still use the old drills underneath.
function ooRetired(k) {
  if (k === "hue") return ooEnter();
  if (k === "memory") return ooPlayMix("wasthere", { title: "Color memory", onQuit: () => go("gym") });
  if (k === "order") return ooPlayMix("outoforder", { title: "Sort the strip", onQuit: () => go("gym") });
  return null;
}
function ooOpenRoute(id) {
  if (id === "eye") return ooEyePage();
  if (id === "whose") return ooWhose();
  if (id === "line") return ooAcross();
  if (id === "pairs") return ooPairs();
  return ooMap();
}
