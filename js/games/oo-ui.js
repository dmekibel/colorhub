"use strict";
// Odd one out, its own station (#/odd): a journey map of 24 levels in four worlds, the Mix set after level 10,
// a daily shared board, an honest eye profile, and the round renderer that the Mix games and GAME_STEPS reuse.
// The engine (rounds, boards, the learner model, the staircase, the ladder) is js/games/oo-engine.js.
// Hooks elsewhere are additive: gym.js (the Train shelf and the gx:oo screenshot states), router.js (#/odd…).
// Every user-visible difference goes through pctFmt (js/core.js): a ΔE00 reads as % of black-to-white.

// ---------- state: S.games.oo (lazily created; unknown keys are kept; malformed parts are repaired) ----------
// { lv: highest unlocked level index, stars: { i: [finish, fast, noHint] }, best: { i: points }, model: {j, f},
//   seen: { kind: n }, daily: { day: [{ok, ms, act}] }, mix: { id: { stars, best } }, snaps: [[day, {axis: th}]], sets: n }
const ooObj = x => x && typeof x === "object" && !Array.isArray(x);
function ooS() {
  if (!ooObj(S.games)) S.games = {};
  const o = ooObj(S.games.oo) ? S.games.oo : (S.games.oo = {});
  o.lv = Number.isInteger(o.lv) ? clamp(o.lv, 0, OO_LEVELS.length - 1) : 0;
  ["stars", "best", "seen", "daily", "mix"].forEach(k => { if (!ooObj(o[k])) o[k] = {}; });
  o.model = ooModel(ooObj(o.model) ? o.model : {});
  if (!Array.isArray(o.snaps)) o.snaps = [];
  o.sets = +o.sets || 0;
  return o;
}
const ooStars = i => { const s = ooS().stars[i]; return Array.isArray(s) ? s : [0, 0, 0]; };
const ooStarCount = () => Object.values(ooS().stars).reduce((a, s) => a + (Array.isArray(s) ? s.filter(Boolean).length : 0), 0)
  + Object.values(ooS().mix).reduce((a, m) => a + (m && Array.isArray(m.stars) ? m.stars.filter(Boolean).length : 0), 0);
const ooMixOpen = () => ooS().lv > OO_MIX_AT - 1 || !!(ooStars(OO_MIX_AT - 1)[0]);
const ooShotMode = () => typeof SHOT !== "undefined" && !!SHOT;

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
  try { if (typeof learnerLog === "function" && learnerLog({ type: "confuse", a: right, b: picked, src: "train" })) return; } catch (e) {}
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
  const cols = ooCols(b, n), bf = (OO_BF[b] || 1) * (["grid", "busy", "gradient"].includes(b) ? (cols <= 4 ? 1 : cols === 5 ? 1.1 : cols === 6 ? 1.2 : 1.28) : 1);
  const d = clamp(o.d != null ? o.d : th * OO_TIER[tier] * (OO_VF[v] || 1) * bf * (tw === "breathe" ? 1.1 : 1), OO_MIN, OO_MAX);
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
const OO_Q = { one: "Which tile is different?", pair: "Two tiles are different. Find both.", group: "Find the hidden shape.",
  count: "How many tiles are different?", twins: "Find the two identical tiles.", which: "Which tile is different?" };
function ooBoardHTML(r, o = {}) {
  const gap = r.b === "strip" ? .008 : r.b === "honey" || r.b === "ring" ? 0 : r.b === "mosaic" ? 0 : .016;
  const g = r.ground, bg = !g ? "" : g.split === "v" ? `background:linear-gradient(90deg,${g.a} 50%,${g.c} 50%)` : g.split === "h" ? `background:linear-gradient(180deg,${g.a} 50%,${g.c} 50%)`
    : g.split === "d" ? `background:linear-gradient(135deg,${g.a} 50%,${g.c} 50%)` : `background:conic-gradient(${g.a} 0 25%,${g.c} 0 50%,${g.a} 0 75%,${g.c} 0)`;
  const pct = x => (x * 100).toFixed(3) + "%";
  const tiles = r.cells.map((c, i) => {
    const x = c.x + gap / 2, y = c.y + gap / 2, w = c.w - gap, h = c.h - gap;
    const img = r.paint ? `;background-image:url(${r.paint.url});background-size:${r.cols * 100}% ${r.cols * 100}%;background-position:${c.gx / (r.cols - 1) * 100}% ${c.gy / (r.cols - 1) * 100}%` : "";
    const st = `left:${pct(x)};top:${pct(y)};width:${pct(w)};height:${pct(h)};--c:${r.colors[i]}${c.rot ? `;--rot:${c.rot.toFixed(1)}deg` : ""}${o.breathe ? `;--bd:-${(Math.random() * 3.4).toFixed(2)}s;--bp:${(2.8 + Math.random() * 1.4).toFixed(2)}s` : ""}${img}`;
    return `<button class="oo-t oo-${c.shape}${r.paint ? " oo-pt" : ""}" data-i="${i}" style="${st}" aria-label="Tile ${i + 1}"></button>`;
  }).join("");
  return `<div class="oo-board oo-b-${r.b}${o.breathe ? " oo-breathe" : ""}${g ? " oo-ground" : ""}" style="--ar:${r.aspect};${bg}">${tiles}</div>`;
}
// a ripple across the board from the tapped tile (calm: a small dip and lift, in order of distance)
function ooRipple(board, from) {
  if (reduceMotion || !board) return;
  const tiles = [...board.querySelectorAll(".oo-t")], f = from && from.getBoundingClientRect();
  if (!f) return;
  tiles.forEach(t => { const b = t.getBoundingClientRect(), dd = Math.hypot(b.left - f.left, b.top - f.top); t.style.setProperty("--dl", Math.round(dd * .9) + "ms"); t.classList.remove("rip"); void t.offsetWidth; t.classList.add("rip"); });
}
let OO_LAST = null;   // the round on screen (screenshot mode taps its answer: js/games/oo-shot.js)
function ooAsk(ui, r, o = {}) {
  if (r.b === "painting" && !r.paint) return ooPaintPrep(r).then(ok => {
    // no readable pixels (a file:// page): the same round on a plain board, filed as context
    if (!ok) Object.assign(r, ooRound({ ...r.spec, b: "grid" }), { judg: "context", bf: 1, noPaint: 1 });
    return ooAsk(ui, r, o);
  });
  OO_LAST = r;
  return new Promise(resolve => {
    const { q, stage, foot } = ui, v = r.v, tap = ["one", "pair", "group", "twins", "which"].includes(v);
    q.textContent = o.teach ? o.teach : r.b === "painting" ? "Which patch was recolored?" : o.flash ? "Remember the board" : OO_Q[v] || OO_Q.one;
    stage.innerHTML = ooBoardHTML(r, o);
    const board = stage.querySelector(".oo-board"), tiles = [...board.querySelectorAll(".oo-t")];
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
      buzz(ok ? 10 : [10, 40, 10]);
      if (!ok || o.feedback === false) reveal(); else (r.ans || []).forEach(i => tiles[i] && tiles[i].classList.add("ring"));
      if (ok && extra.el) ooRipple(board, extra.el);
      resolve({ ok: ok ? 1 : 0, ms, hint, act: r.act, right: r.odd, dir: r.dir, ...extra });
    };
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
      if (v === "pair" || v === "twins") {
        if (sel.includes(i)) return;
        if (!inAns) { t.classList.add("miss"); return finish(false, { picked: r.colors[i] }); }
        sel.push(i); t.classList.add("sel"); buzz(6);
        if (sel.length === 2) finish(true, { el: t, picked: r.colors[i] });
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
        r.ans = [at]; r.act = de2000(before, after); r.base = labHex(...before); r.odd = labHex(...after); r.dir = ooDirWord(r.base, r.odd);
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
  const st = { i: 0, hits: 0, res: [], combo: 0, maxCombo: 0, pts: 0, lives: cfg.lives || 0, hint: false, prev: null, th0: ooThNow() };
  const segs = cfg.lives ? `<div class="oo-hearts" aria-label="${cfg.lives} lives">${Array.from({ length: cfg.lives }, () => `<i></i>`).join("")}</div>`
    : `<div class="segs">${Array.from({ length: cfg.total }, () => `<i style="--c:var(--ink)"></i>`).join("")}</div>`;
  const html = `
    <header class="deck-top">${cfg.box ? "" : `<button class="icon-btn" data-close aria-label="Close">${ICON.x}</button>`}${segs}<span class="left mono oo-lvl">${esc(cfg.label || "")}</span></header>
    <div class="drill-head oo-head"><h2 id="ooq"></h2><p class="oo-combo" id="oocombo"></p></div>
    <div class="drill-stage oo-stage" id="oostage"></div>
    <div class="drill-foot oo-foot" id="oofoot"></div>`;
  let el;
  if (cfg.box) { cfg.box.innerHTML = `<div class="oo-inbox station">${html}</div>`; el = cfg.box; }
  else el = show(html, "fixed drill station oo-play" + (cfg.cls ? " " + cfg.cls : ""));
  const ui = { q: el.querySelector("#ooq"), stage: el.querySelector("#oostage"), foot: el.querySelector("#oofoot"), el };
  const comboEl = el.querySelector("#oocombo");
  const quit = () => cfg.onQuit ? cfg.onQuit() : ooMap();
  const cb = el.querySelector("[data-close]"); if (cb) cb.onclick = quit;
  if (!cfg.box) onKey = e => { if (e.key === "Escape") quit(); };
  const segEls = el.querySelectorAll(".segs i"), hearts = el.querySelectorAll(".oo-hearts i");
  const showCombo = (moment) => {
    if (moment) { comboEl.innerHTML = `<em class="oo-streak">${moment}</em>`; return; }
    comboEl.innerHTML = cfg.combo && st.combo >= 2 ? `<span class="mono">×${Math.min(st.combo, 5)}</span><i style="--w:${Math.min(st.combo, 5) / 5 * 100}%"></i><span class="mono">${st.pts.toLocaleString()}</span>` : "";
  };
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
    st.res.push({ ...res, base: r.base || res.base, odd: r.odd || res.right, v: r.v || kind, b: r.b, none: r.none, count: r.count, dir: res.dir || r.dir, d: r.d });
    if (segEls[st.i]) { segEls[st.i].classList.add("on"); segEls[st.i].style.setProperty("--c", res.ok ? "var(--good)" : "var(--bad)"); }
    st.prev = { r, res };
    st.i++;
    showCombo(moment);
    save();
    const fb = kind === "board" ? ooLine(r, res) : { html: res.line || "", cmp: res.cmp || null };
    const last = (cfg.endOnMiss && !res.ok) || (cfg.lives && st.lives <= 0) || (!cfg.lives && !cfg.endOnMiss && st.i >= cfg.total) || st.i >= (cfg.max || 99);
    const cmp = fb.cmp ? `<div class="oo-cmp">${fb.cmp.map(([h, w]) => `<span><i style="--c:${h}"></i><em>${esc(w)}</em></span>`).join("")}</div>` : "";
    if (res.ok && !last && !it.hold) {
      ui.foot.innerHTML = `<p class="oo-fb ok oo-in">${fb.html}</p>`;
      return later(round, fb.html.length > 120 ? 1900 : 1300);
    }
    ui.foot.innerHTML = `<div class="oo-rev oo-in">${res.ok ? "" : cmp}<p class="oo-fb${res.ok ? " ok" : ""}">${fb.html}</p><button class="btn" data-next>${last ? (cfg.box ? "Done" : "See how you did") : "Next"} ${ICON.arrow}</button></div>`;
    ui.foot.querySelector("[data-next]").onclick = () => last ? end() : round();
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
// Levels
// ======================================================================
function ooPlayLevel(i) {
  if (!S.scr && !ooShotMode() && typeof screenCheck === "function") return screenCheck(() => ooPlayLevel(i));
  const L = OO_LEVELS[i];
  if (!L) return ooMap();
  const st = ooS(), tw = L.tw, survival = tw === "survival", grow = tw === "grow";
  const first = st.sets === 0 && i === 0, warm = !!st.last && st.last !== today();
  let stair = null, n = L.n, chainBase = null;
  const tierFor = (k, novel, run) => warm && k === 0 ? "easy" : ooAdjTier(ooTierAt(k, novel), run);
  const gen = (k, run) => {
    if (survival || grow) {
      // the board grows; in survival the difference also follows a 2-down / 1-up staircase
      if (!stair) { const sp0 = ooSpec(L, 0, { tier: "medium" }); stair = ooStair(sp0.d); }
      else if (run.prev) ooStairStep(stair, !!run.prev.res.ok);
      n = Math.min(7, 3 + (survival ? Math.floor(run.hits / 2) : run.hits));
      const sp = ooSpec(L, k, { n, tw: null, d: survival ? stair.d : null, tier: grow ? "medium" : null });
      const r = ooRound(sp); Object.assign(r, { tw, kindKey: ooKindKey(L.v, L.b, tw), fam: sp.fam || r.fam });
      return { r, o: { hint: true }, note: k > 0 && n > 3 && (survival ? run.hits % 2 === 0 : true) && run.prev && run.prev.res.ok ? `${n} × ${n}` : null };
    }
    if (L.v === "mixed") {
      const [v, b, nn, t] = ooPick(OO_KINDS, Math.random), sp0 = ooSpec(L, k, { v, b, n: nn, tw: t || null }), sp = { ...sp0, tier: tierFor(k, sp0.novel, run) };
      sp.d = ooSpec(L, k, { v, b, n: nn, tw: t || null, tier: sp.tier }).d;
      const r = ooRound({ ...sp, twist: t }); Object.assign(r, { tw: t, kindKey: sp.kind });
      return { r, o: { flash: t === "flash", none: b === "busy", hint: true, nudge: sp.novel && k === 0 ? 6000 : 0 } };
    }
    const novel = (st.seen[ooKindKey(L.v, L.b, tw)] || 0) < 2;
    const sp = ooSpec(L, k, { base: tw === "chain" ? chainBase : null, tier: tierFor(k, novel, run) });
    let r;
    if (L.b === "painting") { r = ooPaintRound(sp); r.v = L.v; }
    else r = ooRound({ ...sp, twist: tw });
    Object.assign(r, { tw, kindKey: sp.kind, fam: sp.fam || r.fam, rnd: sp.rnd });
    if (tw === "chain") chainBase = r.odd && !r.none ? r.odd : chainBase;
    return { r, o: { flash: tw === "flash", breathe: tw === "breathe", none: L.b === "busy", hint: !(first && k < 3),
      teach: first && k === 0 ? "One tile is a little different. Tap it." : null, nudge: first && k < 2 ? 3500 : novel && k === 0 ? 6000 : 0 },
      note: warm && k === 0 ? "Warm-up" : tw === "chain" && k > 0 ? "The odd color is the new base" : null };
  };
  ooRun({
    label: `Level ${i + 1}`, total: survival ? 0 : grow ? 8 : OO_ROUNDS, max: survival ? 30 : grow ? 8 : OO_ROUNDS, lives: survival ? 3 : 0, endOnMiss: grow,
    combo: i >= 5, gen, onEnd: s => ooLevelDone(i, s),
  });
}
function ooLevelDone(i, s) {
  const L = OO_LEVELS[i], st = ooS(), tw = L.tw;
  const finish = tw === "survival" ? s.total >= 10 : tw === "grow" ? s.hits >= 4 : s.hits >= OO_PASS;
  const fast = finish && s.med != null && s.med <= (tw === "flash" ? 3000 : OO_FAST_MS), nohint = finish && !s.hint;
  const old = ooStars(i), stars = [finish || old[0], fast || old[1], nohint || old[2]].map(x => x ? 1 : 0);
  st.stars[i] = stars;
  const pb = s.pts > (st.best[i] || 0) && s.pts > 0; if (pb) st.best[i] = s.pts;
  const unlocked = finish && st.lv === i && i < OO_LEVELS.length - 1;
  if (finish && st.lv <= i) { st.lv = Math.min(OO_LEVELS.length - 1, i + 1); st.fresh = st.lv; }
  const mastered = stars.every(Boolean) && !old.every(Boolean);
  save();
  ooResults({ title: `Level ${i + 1} · ${L.name}`, s, finish, stars, got: [finish, fast, nohint], pb, unlocked, mastered, world: L.w,
    next: finish && i < OO_LEVELS.length - 1 ? i + 1 : null, again: () => ooPlayLevel(i), mixNew: unlocked && i === OO_MIX_AT - 1,
    score: tw === "survival" ? `${s.total} rounds survived` : tw === "grow" ? `${s.hits} right · reached ${Math.min(7, 3 + s.hits)} × ${Math.min(7, 3 + s.hits)}` : `${s.hits} of ${s.total} right` });
}
// ---------- results: every end of a set is designed (cleared, mastered, a best, not yet) ----------
function ooResults(o) {
  const s = o.s, misses = s.res.filter(x => !x.ok && x.base && x.odd && x.base !== x.odd && !x.none).slice(0, 8);
  const starRow = ["Finished", "Quick", "No hints"].map((w, k) => `<span class="oo-star${o.stars[k] ? " on" : ""}${o.got[k] && o.stars[k] ? " new" : ""}" style="--k:${k}"><i></i>${w}</span>`).join("");
  const nx = o.next != null ? OO_LEVELS[o.next] : null;
  const head = o.mastered ? "Level <em>mastered.</em>" : o.unlocked ? "Level <em>cleared.</em>" : o.finish ? (o.pb ? "A new <em>best.</em>" : "Well <em>seen.</em>") : "Not <em>yet.</em>";
  // the honest eye line: the judgment that moved most during this set
  const moved = s.th0 && s.th1 ? Object.keys(s.th1).filter(j => s.th0[j] && Math.abs(Math.log(s.th1[j] / s.th0[j])) > .04).sort((a, b) => Math.abs(Math.log(s.th1[b] / s.th0[b])) - Math.abs(Math.log(s.th1[a] / s.th0[a])))[0] : null;
  const lede = o.mastered ? `All three stars. ${o.world != null ? esc(OO_WORLDS[o.world].mile) : ""}`
    : o.unlocked && nx ? `Level ${o.next + 1} is open: ${esc(nx.news.charAt(0).toLowerCase() + nx.news.slice(1))}.`
    : o.finish ? "Every round was drawn near your own limit, so this is your eye working at its edge."
    : `You need ${OO_PASS} of ${OO_ROUNDS}. Every round is drawn near your own limit, so misses mean you're at your edge; the next set starts from where you are now.`;
  const el = show(`
    <div style="flex:1"></div>
    <p class="eyebrow">${esc(o.title)}</p>
    <h1>${head}</h1>
    <div class="oo-stars-row">${starRow}</div>
    <p class="lede">${lede}</p>
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
      ${o.next != null && o.finish ? `<button class="btn" data-nextlv>Level ${o.next + 1} ${ICON.arrow}</button><button class="btn ghost" data-again>Play again</button>` : `<button class="btn" data-again>${o.finish ? "Play again" : "Try again"} ${ICON.arrow}</button>`}
      <button class="btn ghost" data-map>${o.back || "Back to the map"}</button>
    </div>`, "result oo-res");
  const nb = el.querySelector("[data-nextlv]"); if (nb) nb.onclick = () => ooPlayLevel(o.next);
  el.querySelector("[data-again]").onclick = o.again;
  el.querySelector("[data-map]").onclick = o.onBack || (() => ooMap());
  onKey = e => { if (e.key === "Enter") (nb || el.querySelector("[data-again]")).click(); };
  if (o.unlocked || o.pb || o.mastered) later(() => buzz([12, 60, 12]), 450);
}

// ======================================================================
// The journey map (#/odd)
// ======================================================================
// a tiny picture of a level's board: its own geometry, one tile off
function ooMini(L, i) {
  const rnd = ooRnd(ooHash("mini" + i)), b = L.v === "mixed" ? "honey" : L.b, geo = ooCells(b === "painting" ? "grid" : b, b === "honey" ? 7 : b === "grid" ? Math.min(L.n, 4) : L.n, rnd);
  const H = [215, 150, 30, 290][L.w], base = lchHex(60, 30, H), odd = lchHex(70, 30, H), at = Math.floor(rnd() * geo.cells.length);
  const pct = x => (x * 100).toFixed(1) + "%";
  return `<span class="oo-mini oo-b-${b}" style="--ar:${geo.aspect}">${geo.cells.map((c, k) => `<i class="oo-${c.shape}" style="left:${pct(c.x)};top:${pct(c.y)};width:${pct(c.w)};height:${pct(c.h)};--c:${k === at ? odd : base}"></i>`).join("")}</span>`;
}
const ooStarHTML = s => `<span class="oo-st" aria-label="${s.filter(Boolean).length} of 3 stars">${s.map(x => `<i class="${x ? "on" : ""}"></i>`).join("")}</span>`;
function ooEyeLine() {
  const m = ooS().model, fams = Object.keys(OO_FAMS).filter(f => f !== "Greys").map(f => [f, ooEye(m, f, null)]).filter(([, e]) => e.th && e.n >= 6).sort((a, b) => a[1].th - b[1].th);
  if (fams.length >= 2) return `You see ${fams[0][0].toLowerCase()} to ${pctFmt(fams[0][1].th)} different, ${fams[fams.length - 1][0].toLowerCase()} to ${pctFmt(fams[fams.length - 1][1].th)}.`;
  const any = ooEye(m, null, null);
  return any.th ? `About ${pctFmt(any.th)} so far. Your eye profile fills in as you play.` : "Your eye profile fills in as you play.";
}
function ooMap() {
  eyeNamesReady();
  const st = ooS(), cur = st.lv, fresh = st.fresh, back = st.last && st.last !== today();
  delete st.fresh;
  const worldDone = w => OO_LEVELS.every((L, i) => L.w !== w || ooStars(i).every(Boolean));
  const rows = OO_LEVELS.map((L, i) => {
    const locked = i > cur, s = ooStars(i), done = !!s[0], mast = s.every(Boolean);
    const row = `<button class="oo-node${locked ? " locked" : ""}${i === cur ? " cur" : ""}${done ? " done" : ""}${i === fresh ? " fresh" : ""}" data-lv="${i}"${locked ? ` data-locked="Clear level ${i} to unlock this one"` : ""}>
      ${ooMini(L, i)}<span class="oo-nt"><b><span class="mono">${i + 1}</span>${esc(L.name)}</b><em>${esc(mast ? "Mastered" : L.news)}</em></span>${ooStarHTML(s)}</button>`;
    const world = i === 0 || OO_LEVELS[i - 1].w !== L.w ? `<div class="oo-world${worldDone(L.w) ? " lit" : ""}"><b>${esc(OO_WORLDS[L.w].name)}</b><span>${esc(OO_WORLDS[L.w].mile)}</span></div>` : "";
    return world + row + (i === OO_MIX_AT - 1 ? ooMixBlock() : "");
  }).join("");
  const el = show(`
    <header class="deck-top"><button class="icon-btn" data-close aria-label="Back to Train">${ICON.back}</button><span style="flex:1"></span><span class="mono oo-tot">${ooStarCount()} ★</span></header>
    <h1 class="title-1 oo-title">Odd one out</h1>
    <p class="note">${back ? "Welcome back. Your first round today is a warm-up." : st.sets ? `Level ${cur + 1} of ${OO_LEVELS.length}. Every round is drawn near your own limit.` : "Find the tile that's different. Each level adds a new twist."}</p>
    <button class="oo-eyeline" data-eye><span>${esc(ooEyeLine())}</span><b>Your eye ${ICON.chev}</b></button>
    <div class="oo-path">${rows}</div>
    <p class="fine">How it works: every answer updates a hidden estimate of the smallest difference you can see, for hue, lightness, vividness, colors in context and colors from memory, and for each color family. Rounds are drawn from it, so a set breathes: easy, medium, hard, easy, harder, then a boss near your limit. A miss makes the next round gentler and a streak makes it harder; new kinds of rounds start easy. Stars: finish the level, answer quickly, use no hints.</p>
    <div class="oo-go"><button class="btn" data-play>${st.sets ? `Play level ${cur + 1}` : "Start"} ${ICON.arrow}</button></div>
  `, "oo-map");
  el.querySelector("[data-close]").onclick = () => go("gym");
  el.querySelector("[data-play]").onclick = () => ooPlayLevel(cur);
  el.querySelector("[data-eye]").onclick = ooEyePage;
  el.querySelectorAll("[data-lv]").forEach(b => b.onclick = () => b.dataset.locked ? toast(b.dataset.locked) : ooPlayLevel(+b.dataset.lv));
  el.querySelectorAll("[data-mix]").forEach(b => b.onclick = () => b.dataset.locked ? toast(b.dataset.locked) : ooPlayMix(b.dataset.mix));
  const cn = el.querySelector(".oo-node.fresh") || el.querySelector(".oo-node.cur");
  if (cn && cur > 2 && !ooShotMode()) later(() => cn.scrollIntoView({ block: "center", behavior: reduceMotion ? "auto" : "smooth" }), 250);
}
function ooMixBlock() {
  const open = ooMixOpen(), st = ooS();
  const tiles = [["set", "Mixed set", "One of each, shuffled"], ...OO_MIX.map(m => [m.id, m.name, m.what])].map(([id, name, what]) => {
    const ms = st.mix[id] || {}, s = Array.isArray(ms.stars) ? ms.stars : [0, 0, 0];
    return `<button class="oo-mx${open ? "" : " locked"}" data-mix="${id}"${open ? "" : ` data-locked="Clear level ${OO_MIX_AT} to unlock the Mix"`}><b>${esc(name)}</b><em>${esc(what)}</em>${ooStarHTML(s)}</button>`;
  }).join("");
  return `<div class="oo-mixblock${open ? "" : " locked"}"><div class="oo-world"><b>The Mix</b><span>${open ? "Odd one out crossed with memory and rearranging." : `Opens after level ${OO_MIX_AT}: odd one out crossed with memory and rearranging.`}</span></div><div class="oo-mxgrid">${tiles}</div></div>`;
}

// ======================================================================
// Eye profile (#/odd/eye): honest, with the caveats
// ======================================================================
function ooEyePage() {
  const m = ooS().model, cell = e => e.th == null ? `<td class="na">–</td>` : `<td class="${e.sure ? "" : "thin"}">${pctFmt(e.th)}</td>`;
  const rows = Object.keys(OO_FAMS).map(f => { const es = ["light", "chroma", "hue"].map(a => (m.f[f + ":" + a] || {}).n ? ooEye(m, f, a) : { th: null }); return es.some(e => e.th != null) ? `<tr><th><i style="--c:${ooFamHex(f)}"></i>${esc(f)}</th>${es.map(cell).join("")}</tr>` : ""; }).join("");
  const js = Object.keys(OO_JUDG).map(j => { const r = m.j[j]; return r && r.n ? `<div class="ey-row"><span>${esc(OO_JUDG[j])}</span><i style="--w:${clamp(100 - Math.log(Math.exp(r.r) / OO_MIN) / Math.log(OO_MAX / OO_MIN) * 100, 4, 100).toFixed(0)}%"></i><b>${pctFmt(Math.exp(r.r))}</b></div>` : ""; }).join("");
  const sn = ooS().snaps, first = sn.length >= 2 ? sn[0] : null, last = sn[sn.length - 1];
  const trend = first && last ? Object.keys(last[1]).filter(j => first[1][j]).map(j => `${OO_JUDG[j].toLowerCase()} ${pctFmt(first[1][j])} → ${pctFmt(last[1][j])}`).slice(0, 3).join(" · ") : "";
  const el = show(`
    <header class="deck-top"><button class="icon-btn" data-close aria-label="Back">${ICON.back}</button></header>
    <h1 class="title-1 oo-title">Your eye</h1>
    <p class="lede">${esc(ooEyeLine())}</p>
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
  const st = ooS(), L = OO_LEVELS[st.lv], ln = st.line || {};
  return `<div class="sec-head"><b>Odd one out</b><span>a game of its own</span></div>
    <button class="oo-shelf" data-oo-map>
      ${ooMini(L, st.lv)}
      <span class="oo-nt"><b>${st.sets ? `Level ${st.lv + 1} · ${esc(L.name)}` : "Find the different tile"}</b><em>${st.sets ? esc(L.news) : "Twenty-four levels, from a 3 × 3 grid to paintings cut into tiles."}</em></span>
      <span class="mono oo-tot">${st.sets ? `${ooStarCount()} ★` : ""}</span>
    </button>
    <button class="play-row" data-oo-line><span><b>Across the line</b><span>Three of these are Teal. Which one isn't?</span></span><em class="lt-best">${ln.best ? `<b>${ln.best}</b>best` : "new"}</em></button>
    <button class="play-row" data-oo-pairs><span><b>Painters' pairs</b><span>Which colors did painters put together?</span></span><em class="lt-best">${st.pairs && st.pairs.best ? `<b>${st.pairs.best}</b>best` : "new"}</em></button>
    <button class="play-row" data-oo-whose><span><b>Whose palette?</b><span>Five colors from a painter's work: whose are they?</span></span><em class="lt-best">${st.mix.whose && st.mix.whose.best ? `<b>${st.mix.whose.best}</b>best` : "new"}</em></button>`;
}
// the first tap on Odd one out goes straight into level 1 (taught by doing); after that, the map
const ooEnter = () => ooS().sets ? ooMap() : ooPlayLevel(0);
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
