"use strict";
// ROADMAP.md §13, "One naming system": nameOf() is the only function anywhere in the app that picks a color's
// display name. Everything that used to look names up itself (painting palettes, the camera, Studio, the
// honeycomb, look-alikes) should call nameOf() instead. tools/check.js's naming gate enforces this: only this
// file and js/graph.js (the 101 app colors + the old long-list helpers it still carries for peek.js) may
// reference LONG_NAMES or data/library.json.
//
// Built on data/core-names.json (tools/build_core_names.py; about 1,000 primary names, each with `also`
// synonyms and, sometimes, a Japanese cultural `notes` entry) and js/core.js's color math. loadCoreNames() is a
// lazy loader (js/loader.js's rule: never read data at script load time); until it resolves, nameOf() falls
// back to the app's own 101 colors, so a name is always available and never blocks a screen.

let CORE_NAMES = null, CORE_LOADING = null;
function loadCoreNames() {
  if (CORE_NAMES) return Promise.resolve(CORE_NAMES);
  return CORE_LOADING || (CORE_LOADING = fetch("data/core-names.json" + (typeof DATA_VER !== "undefined" && DATA_VER ? "?v=" + DATA_VER : ""))
    .then(r => r.ok ? r.json() : []).catch(() => [])
    .then(list => (CORE_NAMES = list.map(e => ({ ...e, lab: lab(e.h) })))));
}
// the fallback list, before data/core-names.json has landed: the 101 app colors always name something
const coreFallback = () => EVERY().map(c => ({ n: c.n, h: c.h, src: ["app"], lab: c.lab || (c.lab = lab(c.h)) }));

const VERY_CLOSE_DE = 3, NEAR_DE = 8;   // ROADMAP §13's thresholds

// The fixed modifier grammar (ROADMAP §13): light/pale, dark/deep, greyish/dusty, bright/vivid, and five hue
// leans. Exactly one modifier, picked from whichever of lightness/chroma/hue is the biggest difference between
// the target color and its nearest name — the same "biggest difference wins" weighting as lookDiff()
// (js/lookalikes.js), just producing one absolute word ("pale salmon") instead of a comparative sentence.
const hueLean = h => { h = (h + 360) % 360; return h < 40 || h >= 345 ? "reddish" : h < 100 ? "yellowish" : h < 170 ? "greenish" : h < 260 ? "bluish" : "purplish"; };
function pickModifier(nameLch, targetLch) {
  const [Ln, Cn] = nameLch, [Lt, Ct, Ht] = targetLch;
  const dL = Lt - Ln, dC = Ct - Cn;
  let dH = Ht - nameLch[2]; if (dH > 180) dH -= 360; if (dH < -180) dH += 360;
  const scores = [["L", Math.abs(dL), dL], ["C", Math.abs(dC) * .8, dC]];
  if (Cn > 8 && Ct > 8) scores.push(["H", Math.abs(dH) * Math.min(Cn, Ct) / 40, dH]);
  scores.sort((a, b) => b[1] - a[1]);
  const [axis, , v] = scores[0];
  if (axis === "L") return v > 0 ? (Ct < 20 ? "pale" : "light") : (Ct > 35 ? "deep" : "dark");
  if (axis === "C") return v < 0 ? (Ct < 15 ? "greyish" : "dusty") : (Lt > 55 ? "bright" : "vivid");
  return hueLean(Ht);
}

function nearestCore(hexOrLab, list, n = 5) {
  const L = Array.isArray(hexOrLab) && hexOrLab.length === 3 && typeof hexOrLab[0] === "number" && hexOrLab[0] <= 100 ? hexOrLab : lab(hexOrLab);
  return list.map(e => ({ n: e.n, h: e.h, de: de2000(L, e.lab), entry: e }))
    .sort((a, b) => a.de - b.de).slice(0, n);
}
// Has the learner met this word? Only the app's 101 are ever taught today (ROADMAP §13-14's vocabulary ladder
// is a later job): a core-list word beyond those 101 is always "new" until then.
function coreWordMet(entry) {
  const c = entry && BYNAME.get(entry.n.toLowerCase());
  return !!(c && S.cards[c.id]);
}

// The one naming function. `color`: a hex string, or [r,g,b] (0-255). Always returns a result, synchronously,
// even before data/core-names.json has loaded.
function nameOf(color, opts = {}) {
  const hex = Array.isArray(color) ? "#" + color.map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0")).join("").toUpperCase() : String(color).toUpperCase();
  const list = CORE_NAMES || coreFallback();
  const Lhex = lab(hex);
  const near = nearestCore(Lhex, list, opts.n || 5);
  const top = near[0];
  if (!top) return { n: "", h: hex, de: 0, mod: "", text: "", near: [], between: null, met: false };
  const Lt = lch(hex);
  let mod = "", text = top.n, between = null;
  if (top.de >= NEAR_DE) {
    const second = near.find(x => x.n !== top.n);
    if (second) { between = { a: top.n, b: second.n }; text = `between ${top.n.toLowerCase()} and ${second.n.toLowerCase()}`; }
  } else if (top.de >= VERY_CLOSE_DE) {
    mod = pickModifier(lch(top.h), Lt);
    text = `${mod} ${top.n.toLowerCase()}`;
  }
  return { n: top.n, h: top.h, de: Math.round(top.de * 10) / 10, mod, text, near, between, met: coreWordMet(top.entry) };
}

// started once the first screen is on, same pattern as prefetchWiki() (js/loader.js): usually loaded well
// before anyone taps a swatch, so nameOf() rarely has to fall back.
let CORE_PREFETCHED = false;
function prefetchCoreNames() {
  if (CORE_PREFETCHED) return; CORE_PREFETCHED = true;
  requestAnimationFrame(() => setTimeout(loadCoreNames, 300));
}

// Families (ROADMAP §13 / David's "ecru is that close to greyish white" note, 2026-10-09): every one of the
// ~1,000 core names belongs to exactly one family, headed by its nearest of the app's 101 (BASICS + ALL,
// CIEDE2000) — that's where the deep history, stories and culture live (CLAUDE.md: shared history lives at
// the family level). The 101 head their own families (de 0). `nameOrHex` is either a primary name from
// data/core-names.json or a hex string, so js/names.js can call this with either.
function familyOf(nameOrHex) {
  let hex = null;
  if (/^#[0-9a-f]{6}$/i.test(String(nameOrHex))) hex = String(nameOrHex).toUpperCase();
  else {
    const taught = BYNAME.get(String(nameOrHex).toLowerCase());
    if (taught) hex = taught.h;
    else {
      const entry = (CORE_NAMES || coreFallback()).find(e => e.n.toLowerCase() === String(nameOrHex).toLowerCase());
      hex = entry ? entry.h : null;
    }
  }
  if (!hex) return null;
  const every = EVERY(), exact = every.find(c => c.h.toUpperCase() === hex);
  if (exact) return { head: exact, de: 0 };
  const L = lab(hex);
  let best = null, bd = Infinity;
  for (const c of every) { const d = de2000(L, c.lab || (c.lab = lab(c.h))); if (d < bd) { bd = d; best = c; } }
  return best ? { head: best, de: bd } : null;
}
