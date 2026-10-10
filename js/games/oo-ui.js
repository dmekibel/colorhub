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
  // Board: Full screen (edge to edge, default) or Square (centered, margined -- David, 2026-10-11, "keep a 9x9
  // square... available alongside Full screen"). r.full is set by ooSimpleRound in oo-engine.js; Square rounds
  // fall back to the ordinary centered/aspect-ratio-boxed .oo-board rule every other board type already uses.
  const full = r.rows != null && r.full !== false, longSide = Math.max(r.rows || r.cols, r.cols);
  // big grids (up to ~20 a side) keep about a 2 px seam and small corners, so the tiles stay big enough to see.
  // The simple game's full-bleed board is completely gapless instead (David, 2026-10-11: "no space between
  // tiles -- completely adjacent, edge to edge"), tile squares with no inner rounding.
  const dense = longSide > 6 && (r.b === "grid" || r.b === "busy");
  const gap = full ? 0 : r.b === "strip" ? .008 : r.b === "honey" || r.b === "ring" ? 0 : r.b === "mosaic" ? 0 : dense ? Math.min(.016, .09 / longSide) : .016;
  const g = r.ground, bg = !g ? "" : g.split === "v" ? `background:linear-gradient(90deg,${g.a} 50%,${g.c} 50%)` : g.split === "h" ? `background:linear-gradient(180deg,${g.a} 50%,${g.c} 50%)`
    : g.split === "d" ? `background:linear-gradient(135deg,${g.a} 50%,${g.c} 50%)` : `background:conic-gradient(${g.a} 0 25%,${g.c} 0 50%,${g.a} 0 75%,${g.c} 0)`;
  const pct = x => (x * 100).toFixed(3) + "%";
  const tiles = r.cells.map((c, i) => {
    const x = c.x + gap / 2, y = c.y + gap / 2, w = c.w - gap, h = c.h - gap;
    const img = r.paint ? `;background-image:url(${r.paint.url});background-size:${r.cols * 100}% ${r.cols * 100}%;background-position:${c.gx / (r.cols - 1) * 100}% ${c.gy / (r.cols - 1) * 100}%` : "";
    const st = `left:${pct(x)};top:${pct(y)};width:${pct(w)};height:${pct(h)};--c:${r.colors[i]}${c.rot ? `;--rot:${c.rot.toFixed(1)}deg` : ""}${o.breathe ? `;--bd:-${(Math.random() * 3.4).toFixed(2)}s;--bp:${(2.8 + Math.random() * 1.4).toFixed(2)}s` : ""}${img}`;
    return `<button class="oo-t oo-${c.shape}${r.paint ? " oo-pt" : ""}" data-i="${i}" style="${st}" aria-label="Tile ${i + 1}"></button>`;
  }).join("");
  // TRUE full-bleed (David, 2026-10-11: "remove the blurry background layer... full width, no side margins...
  // full height too -- into the curved corners"): one board, edge to edge, no inset/bleed split. Reachability
  // under the notch/home indicator/corners is handled at the ROUND level instead -- the odd tile(s) are never
  // placed there (ooSafeIdx in oo-engine.js, fed a safe-zone box computed from the real device geometry) -- so
  // every tile stays visually full-bleed and every CORRECT answer stays genuinely reachable.
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
// center while the real board underneath renders and settles in, so advancing never waits on this to finish.
// Only one ghost is ever alive at a time (David, 2026-10-11: "rapid taps must not stack ghosts") -- a rapid
// retap cancels and removes the previous clone's timer and node immediately before starting the new one, and a
// backgrounded tab (visibilitychange) sweeps up any ghost left mid-fade instead of leaving a stuck half-faded
// board when the player comes back.
let OO_GHOST = null;   // { clone, timer } for the one ghost currently fading, or null
function ooGhostCleanup() {
  if (!OO_GHOST) return;
  clearTimeout(OO_GHOST.timer);
  OO_GHOST.clone.remove();
  OO_GHOST = null;
}
// the row x col aspect fed into ooSimpleDims has to match the REAL on-screen box the grid will render into, not
// the stage's (viewport) box -- the tappable board is inset from the stage by the safe-area block below. Using
// the stage's own aspect here produced tiles built for one shape and rendered into a measurably different one,
// which read as "the transition leads to a different arrangement and then snaps" (David, 2026-10-11): the
// entrance animation's per-tile stagger plays out against percentage positions that don't match the tile's real
// rendered shape until the mismatch resolves, which looks like a snap to a different layout. Mirrors the CSS
// inset rule in css/games.css (.oo-boardouter .oo-board.oo-full) exactly, so there is nothing left to reconcile
// after the animation starts.
// the board is true full-bleed again (David, 2026-10-11: "remove the blurry background layer... full width...
// full height too"), so its aspect is simply the stage's own -- no inset box to mirror any more. Reachability
// is handled separately, at the ROUND level (ooSafeBox below feeds oo-engine.js's ooSafeIdx, which never places
// the odd tile under the notch, the home indicator or the rounded corners).
function ooStageAspect(stage) {
  const r = stage.getBoundingClientRect();
  if (!r.width || !r.height) return null;
  return r.height / r.width;
}
// normalized (0-1 of the board) safe box for the odd tile(s): the real device's safe-area insets plus a small
// buffer, with an approximate iPhone corner radius (~55pt) carved out of each corner so a tile tucked exactly
// into a rounded corner isn't picked either. Mirrors oo-engine.js's ooCellSafe/ooSafeIdx exactly.
function ooSafeBox(stage) {
  const r = stage.getBoundingClientRect();
  if (!r.width || !r.height) return null;
  const cs = getComputedStyle(document.documentElement);
  const num = v => parseFloat(cs.getPropertyValue(v)) || 0;
  const topPx = num("--top") + 26, bottomPx = num("--bottom") + 22, leftPx = num("--left") + 4, rightPx = num("--right") + 4, corner = 55;
  return {
    xMin: leftPx / r.width, xMax: 1 - rightPx / r.width, yMin: topPx / r.height, yMax: 1 - bottomPx / r.height,
    cornerX: corner / r.width, cornerY: corner / r.height,
  };
}
// the round transition, rebuilt from scratch (David, 2026-10-11, "one simple, robust model" -- stop patching
// around it): by the time this runs, the NEXT board is not drawn yet -- ooAsk draws it right after, synchronously,
// fully computed (colors, rows x cols, safe zone) at its real final position, same as always. This only handles
// the OLD board: one static snapshot (not per-tile), sized from the STAGE's own rect (not the board's own, which
// could be mid-transform from the just-finished reveal's ".oo-settle" -- using a scaled rect was the real bug
// behind "the transition goes to the wrong size, then snaps": the snapshot itself was captured already shrunk).
// Same-size rounds (the overwhelming common case, since the grid no longer varies round to round) get a ripple
// reveal: a radial mask grows from the tapped tile, uncovering the new board underneath -- nothing here ever
// moves, resizes or re-lays-out a tile, so there is no "wrong arrangement" to snap away from. A level-step
// (st.grew) gets a plain cross-fade instead (ink-bloom): the size is genuinely different, so a localized reveal
// would have to cross a layout seam; a flat fade across the whole field reads as one clean moment instead.
function ooMeltGhost(ui) {
  ooGhostCleanup();
  if (reduceMotion) return;
  const board = ui.stage.querySelector(".oo-board");
  if (!board) return;
  const elRect = ui.el.getBoundingClientRect(), sRect = ui.stage.getBoundingClientRect();
  const clone = board.cloneNode(true);
  clone.className = "oo-ghost";   // never ".oo-settle" or any other leftover state class from the board just answered
  clone.removeAttribute("style");
  Object.assign(clone.style, { position: "absolute", left: (sRect.left - elRect.left) + "px", top: (sRect.top - elRect.top) + "px",
    width: sRect.width + "px", height: sRect.height + "px", margin: "0", zIndex: "5", pointerEvents: "none" });
  ui.el.style.position = ui.el.style.position || "relative";
  ui.el.appendChild(clone);
  requestAnimationFrame(() => clone.classList.add("oo-ghost-out"));
  const timer = later(() => { if (OO_GHOST && OO_GHOST.clone === clone) OO_GHOST = null; clone.remove(); }, 340);
  OO_GHOST = { clone, timer };
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
// the Albers inset square grows out of the odd tile it came from (a FLIP), instead of appearing fully formed
function ooRevealFlip(ui, originOdd) {
  if (reduceMotion) return;
  const h = ui.foot.querySelector(".oo-rv2-inset");
  const o = originOdd;
  if (!h || !o || !o.isConnected) return;
  const hr = h.getBoundingClientRect(), or = o.getBoundingClientRect();
  if (!hr.width || !hr.height) return;
  const sx = or.width / hr.width, sy = or.height / hr.height;
  const dx = (or.left + or.width / 2) - (hr.left + hr.width / 2), dy = (or.top + or.height / 2) - (hr.top + hr.height / 2);
  h.style.transition = "none";
  h.style.transform = `translate(${dx}px,${dy}px) scale(${sx},${sy})`;
  requestAnimationFrame(() => { h.style.transition = "transform .42s var(--spring)"; h.style.transform = "none"; });
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
    // a per-round timer bar (the simple game): running out is a miss, same as a wrong tap. Exposed via
    // o.pauseCtl so the pause menu can genuinely stop the clock (not just hide it) while it's open.
    let tlTimer = null, tlStart = 0, tlRemain = null;
    if (o.timeLimit && !o.flash) {
      stage.insertAdjacentHTML("afterbegin", `<i class="oo-tlimit" style="--t:${o.timeLimit}ms"></i>`);
      requestAnimationFrame(() => { const b = stage.querySelector(".oo-tlimit"); if (b) b.classList.add("go"); });
      tlStart = performance.now();
      tlTimer = later(() => { if (!done) finish(false, { picked: null, timeout: true }); }, o.timeLimit);
    }
    if (o.pauseCtl) {
      o.pauseCtl.pause = () => {
        if (done) return;
        tiles.forEach(t => t.disabled = true);
        const tb = stage.querySelector(".oo-tlimit");
        if (tb) { const cs = getComputedStyle(tb).transform; tb.style.transition = "none"; tb.style.transform = cs === "none" ? "" : cs; }
        if (tlTimer) { clearTimeout(tlTimer); tlTimer = null; tlRemain = Math.max(0, o.timeLimit - (performance.now() - tlStart)); }
      };
      o.pauseCtl.resume = () => {
        if (done) return;
        tiles.forEach(t => t.disabled = false);
        const tb = stage.querySelector(".oo-tlimit");
        if (tb && tlRemain != null) {
          tb.style.transition = "none"; tb.style.setProperty("--t", tlRemain + "ms"); void tb.offsetWidth;
          requestAnimationFrame(() => { tb.style.transition = ""; tb.classList.add("go"); });
          tlStart = performance.now();
          tlTimer = later(() => { if (!done) finish(false, { picked: null, timeout: true }); }, tlRemain);
        }
      };
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
// "Extremely beautiful colors" (David, 2026-10-11) means curated, not just real: a dim, muddy canvas (a lot of
// Whistler's Mother is near-black greys) makes a boring, near-invisible board even though it's honest data. A
// source has to clear a bar first: at least one properly vivid color, a decent average chroma, and enough
// lightness range that a sweep actually reads as a sweep, not a shade of one grey.
function ooBeautyGood(colors) {
  if (!colors || colors.length < 2) return false;
  let Ls = [], Cs = [];
  for (const h of colors) { try { const [L, C] = lch(h); Ls.push(L); Cs.push(C); } catch (e) {} }
  if (Ls.length < 2) return false;
  const meanC = Cs.reduce((a, b) => a + b, 0) / Cs.length, maxC = Math.max(...Cs), maxL = Math.max(...Ls), Lrange = maxL - Math.min(...Ls);
  // a wide ΔE spread or real chroma alone isn't enough: a painting can hold all of its contrast inside near-black
  // shadow (Flemish oil varnish, a dim Whistler) and still pass a chroma/range check while reading as a muddy,
  // nearly invisible board (David, 2026-10-11, caught exactly this -- a van Eyck still slipped through the first
  // version of this gate). At least one stop has to be genuinely light, not just "lighter than the others" --
  // but a narrow lightness range is fine on its own when the colors are simply, uniformly vivid (a kept set of
  // saturated favorites, all mid-tone, needs no highlight-to-shadow spread to read as beautiful).
  return maxC >= 28 && meanC >= 15 && maxL >= 48 && (Lrange >= 8 || meanC >= 22);
}
function ooBeautyPool() {
  const out = [];
  (window.PAINTINGS || []).forEach(p => {
    if (!p.palette || p.palette.length < 3) return;
    const cs = p.palette.slice().sort((a, b) => b.share - a.share).slice(0, 5).map(x => x.h);
    if (ooBeautyGood(cs)) out.push({ colors: cs, label: `${p.artist}, ${p.title}${p.year ? ", " + p.year : ""}`, link: { kind: "painting", id: p.id } });
  });
  if (Array.isArray(window.LOOKS)) {
    window.LOOKS.forEach(l => (l.pals || []).forEach(p => {
      if (!p.c || p.c.length < 3) return;
      const cs = p.c.map(x => x[0]).slice(0, 5);
      if (ooBeautyGood(cs)) out.push({ colors: cs, label: `${l.name} · ${p.n}`, link: { kind: "look", id: l.id } });
    }));
  }
  const P = window.OO_PAIRS;
  if (P && P.names && P.groups && P.groups.all) {
    P.groups.all.pairs.filter(pr => pr[4] >= 1.6).forEach(pr => {
      const a = P.names[pr[0]], b = P.names[pr[1]];
      if (a && b && ooBeautyGood([a[1], b[1]])) out.push({ colors: [a[1], b[1]], label: `${a[0]} and ${b[0]}, painted together often`, link: null });
    });
  }
  return out;
}
// the player's own kept colors and kept paintings, as gradient sources (David, 2026-10-11) -- held to the same
// beauty bar, so a round of muted favorites just quietly doesn't get drawn rather than making a dull board
function ooFavPool() {
  const out = [];
  try {
    const favs = Object.keys(S.favs || {}).filter(k => /^#[0-9a-f]{6}$/i.test(k));
    if (favs.length >= 2) {
      const n = Math.min(4, Math.max(2, Math.floor(favs.length / 2))), picked = ooShuf(favs, Math.random).slice(0, n);
      if (ooBeautyGood(picked)) { const names = picked.map(h => (typeof nameOf === "function" ? nameOf(h).n : h)); out.push({ colors: picked, label: `Your colors: ${names.join(" → ")}`, link: null, fromFav: true }); }
    }
  } catch (e) {}
  try {
    const arts = Object.values(S.favArt || {}).filter(a => a && a.h);
    arts.slice(0, 6).forEach(a => {
      const m = ooMove(a.h, "hue", 1, 14) || ooMove(a.h, "light", 1, 14);   // a gentle neighbor, so it's a real 2-stop sweep
      const colors = [a.h, m ? m.hex : a.h];
      if (ooBeautyGood(colors)) out.push({ colors, label: `From your favorite: ${a.a ? a.a + ", " : ""}${a.t || "a painting you kept"}`, link: null, fromFav: true });
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
// The reveal (David, 2026-10-11, redesigned around how differences are actually seen and learned): the field
// color fills the screen; the odd color sits as a centered Albers-style inset square, since a small inset
// against a surrounding field is where a subtle difference is most visible -- far more than across a split with
// the two names in opposite corners (an earlier version of this screen, which David called out as "not the
// perfect UI to learn color differences and names"). The names sit together, right under the inset -- the odd
// one large, the field one small and subordinate ("in <field>") -- both tappable to their pages. The direction
// word gets a tiny "see it" strip: field, odd, and the same move exaggerated 3x, so "bluer" is something you can
// actually see, not just read. The source is one small, truncated line at the very bottom, never overlapping
// anything. Tap anywhere else moves on (the melt transition); a one-time hint teaches that for the first rounds.
// ======================================================================
const ooNm = h => { try { return typeof nameOf === "function" ? nameOf(h).n : h; } catch (e) { return h; } };
function ooSeenLog(hex) {
  try { if (typeof learnerLog === "function") learnerLog({ type: "seen", color: hex, src: "game" }); } catch (e) {}
}
// the same move, pushed 3x further in the same Lab direction (clamped into gamut), so the reveal can show the
// axis word as something visible, not just a word -- "bluer" next to a swatch that is unmistakably bluer
function ooExaggerate(fieldHex, oddHex, mult = 3) {
  try {
    const F = lab(fieldHex), O = lab(oddHex), d = O.map((x, i) => x - F[i]);
    for (const k of [mult, 2.2, 1.6, 1.15]) {
      const P = F.map((x, i) => x + d[i] * k);
      if (P[0] >= 2 && P[0] <= 98 && inGamut(...P)) return labHex(...P);
    }
  } catch (e) {}
  return oddHex;
}
function ooRevealHTML(r, res, showNames = true) {
  const odd = r.odd, field = r.base, pair = odd && field && odd !== field;
  const no = pair && showNames ? ooNm(odd) : null, nf = pair && showNames ? ooNm(field) : null;
  if (pair) { ooSeenLog(odd); ooSeenLog(field); }   // the exposure is logged for Learn either way; only the on-screen label is optional
  const fieldC = field || odd || "#5F5F5F", fi = ink(fieldC);
  // a multi-odd round (2 or 4 tiles, the opt-in Settings toggle) shows EVERY odd color, each its own inset with
  // its own name -- not just the first one (David, 2026-10-11)
  const multi = pair && r.odds && r.odds.length > 1;
  let inset, names;
  if (multi) {
    const insets = r.odds.map((o, i) => `<button class="oo-rv2-inset oo-rv2-inset-m" data-swatch="${o.hex}" data-ink="${ink(o.hex)}" style="--c:${o.hex}" aria-label="Odd color ${i + 1}"></button>`).join("");
    inset = `<div class="oo-rv2-insets">${insets}</div>`;
    names = showNames ? `<div class="oo-rv2-namesm">${r.odds.map(o => `<button class="oo-rv2-oddname" data-swatch="${o.hex}" style="--c:${o.hex}"><b>${esc(ooNm(o.hex))}</b><em class="mono">${esc(o.hex)}</em></button>`).join("")}</div>
      <button class="oo-rv2-fieldname" data-swatch="${field}">in ${esc(nf)}</button>` : "";
  } else {
    inset = `<button class="oo-rv2-inset" data-swatch="${odd || field}" data-ink="${ink(odd || field)}" style="--c:${odd || field}" aria-label="${esc(no || "The odd color")}"></button>`;
    names = pair && showNames ? `
      <button class="oo-rv2-oddname" data-swatch="${odd}"><b>${esc(no)}</b><em class="mono">${esc(odd)}</em></button>
      <button class="oo-rv2-fieldname" data-swatch="${field}">in ${esc(nf)}</button>` : "";
  }
  const diff = multi ? `${r.odds.length} tiles were different.` : pair && r.dir ? `A touch ${esc(r.dir)}.` : r.none ? "Every tile was the same color." : res.ok ? "Right." : "The ringed tile was different.";
  const exag = pair && !multi ? ooExaggerate(field, odd) : null;
  const seeIt = exag ? `<div class="oo-rv2-see" aria-hidden="true"><i style="--c:${field}"></i><i style="--c:${odd}"></i><i style="--c:${exag}"></i></div>` : "";
  const src = r.paletteSource;
  const srcHTML = src ? `<button class="oo-rv2-src"${src.link ? "" : " disabled"}>${src.fromFav ? "" : "From "}${esc(src.label)}</button>` : "";
  return { fieldC, fi, inset, names, diff, seeIt, srcHTML, link: src && src.link };
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
// the board size, picked before a run starts and held fixed through it (David, 2026-10-11, final word after
// round-to-round variance and then a ramp both read as "overwhelming... less zen"): a handful of presets (size
// scalars for ooSimpleDims -- the board's longer side), shown as chips ("3x4", "4x6"...) in the pre-game picker
// and the pause menu. Index 1 (~4x6) is the first-timer default.
// columns across (David, 2026-10-11: "too small makes it less fun... cap the densest option at ~8 columns on a
// phone... 4-6 the sweet spot" -- 10+ dropped; a tablet/landscape session gets more room by the same min-tile-
// size rule, via ooGrowCap, but the chip list itself stays this phone-sized set everywhere for one consistent
// picker). Rows are derived to stay near-square (ooSimpleDims).
const OO_SIZE_PRESETS = [4, 5, 6, 8];
const OO_SIZE_DEFAULT_IDX = 1;   // 5 columns -- "4x6" was David's own first-timer example
// the real floor under "too small to be fun": no board ever grows (or starts, from the picker -- see below)
// denser than one tile per ~50 CSS px of the stage's own width. On a 440-wide phone that's ~8 columns, matching
// the explicit cap; a wider viewport (tablet, landscape) earns a little more room by the same rule.
function ooGrowCap(ui) {
  const w = ui.stage.getBoundingClientRect().width || 400;
  return clamp(Math.floor(w / 50), 4, 14);
}
// a chip's own label, from what ooSimpleDims actually renders at a typical portrait aspect -- never a hand-typed
// number that could quietly drift out of sync with the real geometry.
function ooSizeLabel(size) { const d = ooSimpleDims(size, 1.6); return `${d.cols}×${d.rows}`; }
// Square (Board setting or Classic, which implies it) starts from its own default (9, David 2026-10-11: "9x9
// as Square's default size"), independent of the Full-screen chip picker.
const ooStartCols = sim => (sim.board === "square" || sim.style === "classic") ? sim.squareCols : OO_SIZE_PRESETS[sim.sizeIdx];
// the size picker (David, 2026-10-11: "a light pre-game choice... a row of 4-5 size chips... plus a 'Grows as
// you play' toggle"), shared by the pre-game overlay and the pause menu so there's exactly one picker, not two.
function ooSizePickerHTML(sim, zen) {
  const growKey = zen ? "growZen" : "growArcade", grows = !!sim[growKey];
  const chips = OO_SIZE_PRESETS.map((size, i) => {
    const d = ooSimpleDims(size, 1.6), gr = Math.min(d.rows, 5), gc = Math.min(d.cols, 5);
    return `<button class="oo-sizechip${i === sim.sizeIdx ? " on" : ""}" data-size="${i}">
      <span class="oo-sizeicon" style="--gc:${gc}">${Array.from({ length: gr * gc }, () => "<i></i>").join("")}</span>
      <em>${ooSizeLabel(size)}</em>
    </button>`;
  }).join("");
  return `<div class="oo-sizepicker">
    <div class="oo-sizechips">${chips}</div>
    <button class="item oo-sizegrow" data-growkey="${growKey}">Grows as you play: ${grows ? "on" : "off"} ${ICON.chev}</button>
  </div>`;
}
function ooWireSizePicker(root, sim, onChange) {
  root.querySelectorAll("[data-size]").forEach(b => b.onclick = () => { sim.sizeIdx = +b.dataset.size; save(); buzz(4); onChange(); });
  const gb = root.querySelector("[data-growkey]");
  if (gb) gb.onclick = () => { const k = gb.dataset.growkey; sim[k] = !sim[k]; save(); buzz(4); onChange(); };
}
// a throwaway, non-scored round at the chosen size, just to show behind the pre-game sheet -- no click handlers
// are wired (ooBoardHTML alone, not ooAsk), so it's naturally inert until the real first round (nextRound) draws
function ooPreviewBoard(ui, st, sim) {
  const aspect = ooStageAspect(ui.stage) || 1.6;
  const palette = sim.style === "classic" ? null : ooPickPalette();
  const r = ooSimpleRound({ model: ooS().model, cols: st.cols, round: 0, aspect, palette, richMode: sim.richMode, multiOdd: false, style: sim.style, board: sim.board }, false, Math.random);
  if (r) ui.stage.innerHTML = ooBoardHTML(r, { feedback: true, tileNames: false });
}
// the state behind the simple game: the grid you're on, your rolling accuracy at that size, and Arcade or Zen
function ooSimpleState() {
  const st = ooS();
  if (!ooObj(st.simple)) st.simple = {};
  const o = st.simple;
  if (!Array.isArray(o.acc)) o.acc = [];
  if (o.mode !== "zen") o.mode = "arcade";
  if (o.names !== false) o.names = true;      // teach names after each round (pause menu toggle)
  if (o.timer !== false) o.timer = true;      // the per-round Arcade timer (pause menu toggle; Zen has none regardless)
  if (o.pauseHint == null) o.pauseHint = true; // the one-time "tap to pause" hint, shown once then cleared
  // Settings (David, 2026-10-11: "best of both worlds + modular") -- all remembered per player.
  if (o.style !== "classic") o.style = "gradient";   // Palette: Gradient (default) / Classic (one solid color, no palette)
  if (o.board !== "square") o.board = "full";        // Board shape (its own axis from Palette, 2026-10-11): Full screen (default) / Square (centered, margined, 9x9 default)
  if (!Number.isInteger(o.squareCols) || o.squareCols < OO_S_MIN_COLS) o.squareCols = 9;
  if (o.richMode !== "rich") o.richMode = "subtle";  // Palette intensity: Subtle (default, 1-2 close harmonious stops) / Rich (the old skill-ladder up to 4 stops)
  if (o.multiOdd == null) o.multiOdd = false;        // multiple odd tiles: opt-in only ("selecting one is better than multiple")
  if (o.reveal !== false) o.reveal = true;           // "Show colors between rounds" -- off skips the reveal on a hit (a miss still gets its brief marks)
  // the chosen starting size (an index into OO_SIZE_PRESETS) and whether it's allowed to grow during a run --
  // on by default in Arcade (a slow, occasional milestone), off by default in Zen (David: "the grid NEVER
  // changes on its own" there -- the player's own choice is the whole story).
  if (!Number.isInteger(o.sizeIdx) || o.sizeIdx < 0 || o.sizeIdx >= OO_SIZE_PRESETS.length) o.sizeIdx = OO_SIZE_DEFAULT_IDX;
  if (o.growArcade == null) o.growArcade = true;
  if (o.growZen == null) o.growZen = false;
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
// TRUE full screen (David, 2026-10-11): only colors, edge to edge, under the status bar and home indicator too.
// No title, no counter, no always-visible buttons during play -- ONE subtle control (David, refinement:
// "instead of separate exit/edit/settings buttons, use ONE"): a small translucent pause mark, top-left, that
// opens a centered pause menu (Resume, Zen/Arcade, Settings, Exit) over a dimmed/blurred board. A swipe down
// from the top edge opens the same menu. The player is never trapped: the OS/browser back gesture exits
// directly (no listener needed -- `go("gym")` is simply what's already behind this screen in history), and a
// one-time hint teaches the pause mark the very first time someone plays.
function ooMap(opt = {}) {
  if (!S.scr && !ooShotMode() && typeof screenCheck === "function") return screenCheck(() => ooMap(opt));
  eyeNamesReady();
  ooBeautyKick();
  const sim = ooSimpleState(), zen = opt.zen != null ? opt.zen : sim.mode === "zen";
  sim.mode = zen ? "zen" : "arcade"; save();
  const model = ooS().model;
  const startTh = { hue: ooTheta(model, "hue", null), light: ooTheta(model, "light", null), chroma: ooTheta(model, "chroma", null) };
  const lives0 = zen ? 0 : 3;
  const st = { cols: ooStartCols(sim), acc: sim.acc.slice(), round: 0, hits: 0, lives: lives0, streak: 0, grew: false, paused: false, hitsAtGrow: 0, growAt: 0 };
  // a light pre-game choice, not a setup screen (David, 2026-10-11): the real board (at the last-used size)
  // renders and sits right there under a minimal picker -- chips, the grow toggle, a big Play. Tapping Play, or
  // tapping the board itself, starts; a returning player (nothing to change) can just tap Play immediately.
  const showPicker = !opt.forceShape && !opt.skipPicker;
  const el = show(`
    <div class="drill-head oo-head"><h2 id="ooq"></h2></div>
    <div class="drill-stage oo-stage" id="oostage"></div>
    <div class="drill-foot oo-foot" id="oofoot" hidden></div>
    <button class="oo-pause-mark" data-pause aria-label="Pause"><i></i><i></i></button>
    <span class="oo-pause-hint" data-hint>Tap to pause or leave</span>
    <div class="oo-pausefield" id="oopausefield"></div>
    <div class="oo-pausecard" id="oopausecard"></div>
    ${showPicker ? `<div class="oo-pregame" id="oopregame">
      <div class="oo-pregame-sheet">
        ${ooSizePickerHTML(sim, zen)}
        <button class="btn oo-pregame-play" data-play>Play ${ICON.arrow}</button>
      </div>
    </div>` : ""}`, "fixed drill station oo-play oo-simple");
  const ui = { q: el.querySelector("#ooq"), stage: el.querySelector("#oostage"), foot: el.querySelector("#oofoot"), el };
  const quit = () => { save(); go("gym"); };
  const pregame = el.querySelector("#oopregame");
  if (pregame) {
    const startPlay = () => { pregame.remove(); nextRound(); };
    const rewirePicker = () => { ooWireSizePicker(pregame, sim, onChipChange); pregame.querySelector("[data-play]").onclick = startPlay; };
    function onChipChange() {
      // a new size choice redraws the (non-scored) preview board behind the sheet -- the real first round is
      // only ever generated once, by startPlay/nextRound, so changing your mind here never costs a round
      st.cols = ooStartCols(sim);
      pregame.querySelector(".oo-sizepicker").outerHTML = ooSizePickerHTML(sim, zen);
      rewirePicker();
      ooPreviewBoard(ui, st, sim);
    }
    rewirePicker();
    pregame.addEventListener("click", e => { if (e.target === pregame) startPlay(); });   // "or tapping the board"
    ooPreviewBoard(ui, st, sim);
  }
  // the first time: a quiet hint by the mark, gone after 3s or at first touch, never again
  if (sim.pauseHint) {
    const hintEl = el.querySelector("[data-hint]");
    later(() => hintEl.classList.add("on"), 400);
    later(() => hintEl.classList.remove("on"), 3400);
    sim.pauseHint = false; save();
  }
  // the pause menu: an opaque Night Gallery card over a dimmed, lightly blurred field -- Resume, the Zen/Arcade
  // toggle, Settings (sound, haptics, names after each round, the timer), Exit. One place for everything that
  // isn't play itself, so nothing else needs to live on the board.
  const field = el.querySelector("#oopausefield"), card = el.querySelector("#oopausecard");
  function paintPause() {
    const avg = Math.exp(OO_AXES.reduce((a, j) => a + Math.log(ooTheta(model, j, null)), 0) / 3);
    card.innerHTML = `
      <p class="eyebrow">Paused</p>
      <h2>${st.hits} of ${st.round} · ${pctFmt(avg)}</h2>
      ${!zen ? `<div class="oo-hearts" aria-label="${st.lives} lives" style="justify-content:center;margin:0 0 18px">${Array.from({ length: lives0 }, (_, i) => `<i${i >= st.lives ? ` class="gone"` : ""}></i>`).join("")}</div>` : ""}
      <button class="btn" data-resume>Resume</button>
      <button class="oo-zenpill${zen ? " on" : ""}" data-zen aria-pressed="${zen}">${zen ? "Zen" : "Arcade"}</button>
      ${ooSizePickerHTML(sim, zen)}
      <div class="oo-pset">
        <button class="item" data-set="style">Palette: ${sim.style === "classic" ? "Classic" : "Gradient"} ${ICON.chev}</button>
        ${sim.style !== "classic" ? `<button class="item" data-set="board">Board: ${sim.board === "square" ? "Square" : "Full screen"} ${ICON.chev}</button>` : ""}
        ${sim.style !== "classic" ? `<button class="item" data-set="richMode">Palette intensity: ${sim.richMode === "rich" ? "Rich" : "Subtle"} ${ICON.chev}</button>` : ""}
        <button class="item" data-set="multiOdd">Multiple odd tiles: ${sim.multiOdd ? "on" : "off"} ${ICON.chev}</button>
        <button class="item" data-set="reveal">Show colors between rounds: ${sim.reveal ? "on" : "off"} ${ICON.chev}</button>
        <button class="item" data-set="names">Names after each round: ${sim.names ? "on" : "off"} ${ICON.chev}</button>
        <button class="item" data-set="timer">Timer: ${!zen && sim.timer ? "on" : "off"} ${ICON.chev}</button>
        <button class="item" data-set="sound">Sound: ${S.sound === false ? "off" : "on"} ${ICON.chev}</button>
        <button class="item" data-set="haptics">Haptics: ${S.haptics === false ? "off" : "on"} ${ICON.chev}</button>
      </div>
      <button class="btn ghost" data-exit>Exit</button>`;
    card.querySelector("[data-resume]").onclick = () => closePause();
    card.querySelector("[data-zen]").onclick = () => { sim.mode = zen ? "arcade" : "zen"; save(); buzz(4); closePause(true); ooMap({ zen: !zen }); };
    card.querySelector("[data-exit]").onclick = quit;
    card.querySelectorAll("[data-set]").forEach(b => b.onclick = () => {
      const k = b.dataset.set;
      if (k === "sound") { sndSet("sound", S.sound === false); if (S.sound) buzz(4); }
      else if (k === "haptics") { S.haptics = S.haptics === false; save(); if (S.haptics) buzz(4); }
      else if (k === "names") { sim.names = !sim.names; save(); buzz(4); }
      else if (k === "timer") { sim.timer = !sim.timer; save(); buzz(4); }
      else if (k === "multiOdd") { sim.multiOdd = !sim.multiOdd; save(); buzz(4); }
      else if (k === "reveal") { sim.reveal = !sim.reveal; save(); buzz(4); }
      else if (k === "richMode") { sim.richMode = sim.richMode === "rich" ? "subtle" : "rich"; save(); buzz(4); }
      else if (k === "style") { sim.style = sim.style === "classic" ? "gradient" : "classic"; save(); buzz(4); closePause(true); ooMap({ zen }); return; }
      else if (k === "board") { sim.board = sim.board === "square" ? "full" : "square"; save(); buzz(4); closePause(true); ooMap({ zen }); return; }
      paintPause();
    });
    // the same size-chip picker as the pre-game overlay (David, 2026-10-11: "the pause menu keeps the same
    // picker") -- mid-run it only re-paints the pause card itself; the live board only picks up a new chosen
    // size at the start of the player's NEXT run (changing it mid-round would be exactly the "tile count
    // changing" jolt this whole redesign is about removing).
    ooWireSizePicker(card, sim, () => { paintPause(); });
  }
  function openPause() {
    if (st.paused) return;
    st.paused = true; clearTimeout(pauseAutoT);
    paintPause();
    field.classList.add("on"); card.classList.add("on");
    if (curPauseCtl.pause) curPauseCtl.pause();
  }
  function closePause(silent) {
    if (!st.paused) return;
    st.paused = false;
    field.classList.remove("on"); card.classList.remove("on");
    if (!silent && curPauseCtl.resume) curPauseCtl.resume();
  }
  el.querySelector("[data-pause]").onclick = () => { el.querySelector("[data-hint]").classList.remove("on"); openPause(); };
  field.onclick = () => closePause();
  onKey = e => { if (e.key === "Escape") { if (st.paused) closePause(); else quit(); } };
  // a swipe down from the top edge opens the same menu, same as the pause mark
  let pressXY = null;
  ui.stage.addEventListener("pointerdown", e => { pressXY = { x: e.clientX, y: e.clientY }; }, { passive: true });
  ui.stage.addEventListener("pointermove", e => {
    if (!pressXY || st.paused) return;
    if (pressXY.y < 32 && e.clientY - pressXY.y > 44) { openPause(); pressXY = null; }
  }, { passive: true });
  ["pointerup", "pointercancel", "pointerleave"].forEach(ev => ui.stage.addEventListener(ev, () => { pressXY = null; }, { passive: true }));
  // one transition at a time (David, 2026-10-11: "rapid taps must not stack ghosts"); ooMeltGhost itself also
  // guards this, but the timers below need a single reference to cancel cleanly on quit/backgrounding too
  document.addEventListener("visibilitychange", ooGhostCleanup);
  let pauseAutoT = 0, curPauseCtl = {};
  function nextRound() {
    // the grid is fixed for the whole run now (David, 2026-10-11, final word): no band, no ramp, no hold-timer
    // -- st.cols only ever changes at a deliberate growth step (onAnswer, Arcade only, off by default in Zen),
    // which is the one moment that gets the bigger "divide"/ink-bloom transition; every other round is a same-
    // size ripple reveal (ooMeltGhost), which never has a layout change to cross-fade through in the first place.
    const enter = st.round === 0 ? null : st.grew ? "divide" : null; st.grew = false;
    const breather = st.round > 0 && st.round % 5 === 4;
    const aspect = ooStageAspect(ui.stage) || 1.6;
    const safeBox = ooSafeBox(ui.stage);
    let r = null;
    if (st.round === 0 && opt.forceShape) {
      const axis = ooSimpleAxis(model), skill = ooSimpleSkill(st.cols), fs = opt.forceShape;
      const d = Math.min(ooSimpleD(model, axis, false), 6);   // a screenshot/forced round never needs an extreme gap
      const richness = ["grad1", "grad2", "grad3"].includes(fs) ? fs : "flat";
      const mix = fs === "combo" ? { [axis]: .6, [OO_AXES.find(a => a !== axis)]: .4 } : { [axis]: 1 };
      const k = fs === "k4" ? 4 : fs === "k2" ? 2 : 1, bf = OO_S_GRAD_F[richness] || 1;
      const { rows, cols } = ooSimpleDims(st.cols, aspect), palette = opt.palette || ooPickPalette();
      for (let tries = 0; tries < 8 && !r; tries++) r = ooSimpleGradRound(rows, cols, richness, palette && palette.colors, skill, mix, d * bf, k, Math.random, safeBox, sim.richMode);
      if (r) Object.assign(r, { axis, judg: axis, mix, bf: r.gridType && r.gridType !== "flat" ? bf : 1, paletteSource: palette });
    }
    if (!r) r = ooSimpleRound({ model, cols: st.cols, round: st.round, aspect, palette: ooPickPalette(), safeBox, richMode: sim.richMode, multiOdd: sim.multiOdd, style: sim.style, board: sim.board }, breather);
    const o = { feedback: true, tileNames: false, resolveOdd: true, enter, pauseCtl: {} };   // names live in the reveal now, never crowding gapless tiles
    if (!zen && sim.timer) o.timeLimit = ooSimpleTime(st.cols);
    curPauseCtl = o.pauseCtl;
    ooMeltGhost(ui);
    ooAsk(ui, r, o).then(res => onAnswer(r, res));
  }
  function onAnswer(r, res) {
    if (!ui.stage.isConnected) return;
    // captured before the reveal replaces the whole screen, for the reveal halves' FLIP
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
    // the grid only ever grows, never shrinks, never jumps, and only in Arcade by default (David, 2026-10-11,
    // final word: "a slow, gradual increase mid-run... Zen never changes on its own"). One row/col at a time,
    // roughly every 10-12 correct (not necessarily consecutive -- a miss costs a life, not a step back), each
    // a small, calm milestone (the "divide"/ink-bloom transition) rather than anything that reads as a ratchet.
    const grows = zen ? sim.growZen : sim.growArcade;
    if (res.ok && grows && st.cols < ooGrowCap(ui)) {
      if (!st.growAt) st.growAt = 10 + Math.floor(Math.random() * 3);
      if (st.hits - st.hitsAtGrow >= st.growAt) { st.cols++; st.grew = true; st.hitsAtGrow = st.hits; st.growAt = 10 + Math.floor(Math.random() * 3); }
    }
    sim.last = today(); save();
    const over = !zen && st.lives <= 0;
    const board = ui.stage.querySelector(".oo-board");
    // a streak moment: a luminous sweep every 5 in a row, a slower bloom every 10
    if (res.ok && st.streak > 0 && st.streak % 5 === 0 && board) { const big = st.streak % 10 === 0; ooShimmer(board, big); buzz(big ? [12, 60, 12] : [8, 50, 8]); }
    const proceed = () => { if (over) end(); else nextRound(); };
    const showReveal = () => {
      if (board) board.classList.add("oo-settle");
      // the reveal: its own full-screen overlay, not a card over the board -- "remove the tiles entirely"
      const rv = ooRevealHTML(r, res, sim.names);
      const rvEl = document.createElement("div");
      rvEl.className = "oo-reveal2" + (reduceMotion ? "" : " oo-in");
      rvEl.dataset.ink = rv.fi;
      rvEl.style.setProperty("--c", rv.fieldC);
      // "Tap to continue" teaches the gesture for a player's first few reveals only (David, 2026-10-11)
      const hintN = sim.revealHintN || 0, showHint = hintN < 3;
      if (showHint) { sim.revealHintN = hintN + 1; save(); }
      rvEl.innerHTML = `${rv.inset}
        <div class="oo-rv2-names">${rv.names}</div>
        <div class="oo-rv2-diffrow"><p class="oo-rv2-diff">${rv.diff}</p>${rv.seeIt}</div>
        ${over ? `<p class="oo-rv2-end">See how you did ${ICON.arrow}</p>` : showHint ? `<p class="oo-rv2-hint">Tap to continue</p>` : ""}
        ${rv.srcHTML}`;
      el.appendChild(rvEl);
      // the inset grows out of the odd tile it came from
      ooRevealFlip({ foot: rvEl }, originOdd);
      let gone = false;
      const g2 = () => { if (gone) return; gone = true; rvEl.remove(); proceed(); };
      const srcBtn = rvEl.querySelector(".oo-rv2-src"); if (srcBtn && rv.link) srcBtn.onclick = e => { e.stopPropagation(); if (rv.link.kind === "painting") location.hash = "#/painting/" + String(rv.link.id).replace(/^painting-/, ""); else if (rv.link.kind === "look") location.hash = "#/look/" + rv.link.id; };
      // tap anywhere advances -- only the inset, the two names and the source are [data-swatch]/explicit links
      // (and those are a small fraction of the screen now, not most of it), so this always fires on an open tap
      rvEl.addEventListener("click", e => { if (!e.target.closest("[data-swatch],.oo-rv2-src,a")) g2(); });
      if (!zen) later(() => { if (!gone) g2(); }, 2500);
    };
    buzz(res.ok ? (zen ? 8 : 10) : [10, 40, 10]);
    if (res.ok) {
      // "Show colors between rounds" off (David, 2026-10-11): a correct tap already got its ripple + resolve
      // animation when it was tapped (ooAsk's finish()); skip the reveal card and melt straight into the next
      // board instead of stopping to show it again.
      if (!sim.reveal) { if (board) board.classList.add("oo-settle"); later(() => proceed(), reduceMotion ? 0 : 420); return; }
      showReveal();
    } else {
      // a miss: hold the marked board for a beat before moving on -- the tapped tile already has its ".miss"
      // outline and the correct tile(s) their ".ring" pulse (ooAsk's finish()/reveal()), so this is the window
      // to actually see them (David, 2026-10-11: "it should show you where you failed and what the correct
      // answer would be"). With the reveal off, the marks ARE the whole lesson, so they still get their beat
      // even though no reveal card follows.
      later(() => { if (sim.reveal) showReveal(); else proceed(); }, 1200);
    }
  }
  function end() { document.removeEventListener("visibilitychange", ooGhostCleanup); ooSimpleEnd(zen, startTh, model, st, z => ooMap({ zen: z })); }
  if (!pregame) nextRound();   // with the picker up, the real first round only starts on Play (or a board tap)
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
      <span class="oo-nt"><b>${st.sets ? `${ooSizeLabel(ooStartCols(sim))}${acc != null ? ` · ${acc}% right` : ""}` : "Find the different tile"}</b><em>${st.sets ? "One tap back in. Zen mode plays with no timer, no lives." : "One tap in, pick a size, play. It can grow with you."}</em></span>
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
