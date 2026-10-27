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
// NOTES-TRACKER.md item 0, "Honeycomb up to ~9,000": computed, described shades (tools/build_shades.py) that
// fill the gaps between the ~1,000 core names and the ~2,700 library names with the app's own fixed modifier
// grammar ("Pale salmon", "Deep teal"), each guaranteed to read back through nameOf() exactly as its own `n`.
// Paused (David, 2026-10-09) pending a library import of more real names, so data/shades.json ships empty for
// now; loadShades() and everything built on it (the home honeycomb's "Every shade" stop, search, name pages)
// stays wired and ready, and simply has nothing to show until the real build runs.
let SHADES = null, SHADES_LOADING = null;
function loadShades() {
  if (SHADES) return Promise.resolve(SHADES);
  return SHADES_LOADING || (SHADES_LOADING = fetch("data/shades.json" + (typeof DATA_VER !== "undefined" && DATA_VER ? "?v=" + DATA_VER : ""))
    .then(r => r.ok ? r.json() : []).catch(() => [])
    .then(list => (SHADES = list.map(e => ({ ...e, lab: lab(e.h) })))));
}
// the fallback list, before data/core-names.json has landed: the 101 app colors always name something
const coreFallback = () => EVERY().map(c => ({ n: c.n, h: c.h, src: ["app"], lab: c.lab || (c.lab = lab(c.h)) }));

const VERY_CLOSE_DE = 3, NEAR_DE = 8;   // ROADMAP §13's thresholds

// The fixed modifier grammar (ROADMAP §13): light/pale, dark/deep, greyish/dusty, bright/vivid, and five hue
// leans. Exactly one modifier, picked from whichever of lightness/chroma/hue is the biggest difference between
// the target color and its nearest name — the same "biggest difference wins" weighting as lookDiff()
// (js/lookalikes.js), just producing one absolute word ("pale salmon") instead of a comparative sentence.
// David, 2026-10-23: "Reddish old pink" for #C09DA4 was wrong. In CIELAB, red sits at hue ~25-40 degrees; pinks, roses and
// raspberries sit at 0-25, and hot pink / magenta wrap past 340 and on to ~330. Moving a pink toward a LOWER hue
// moves it toward magenta (rosier, more purple), never toward red. So "red" begins at hue 15, and below that (through
// the wrap down to 280) the direction word is purpler. One shared vocabulary for every comparison sentence.
const hueZoneWord = h => { h = (h + 360) % 360; return h >= 15 && h < 55 ? "redder" : h >= 55 && h < 130 ? "yellower" : h >= 130 && h < 190 ? "greener" : h >= 190 && h < 280 ? "bluer" : "purpler"; };
const hueLean = h => { h = (h + 360) % 360; return h >= 15 && h < 40 ? "reddish" : h >= 40 && h < 100 ? "yellowish" : h >= 100 && h < 170 ? "greenish" : h >= 170 && h < 260 ? "bluish" : "purplish"; };
// Words a name may already carry, by axis: a modifier never doubles up on its own axis ("pale dark jungle green").
const MOD_AXIS_WORDS = { L: /\b(light|pale|dark|deep|dusky|bright)\b/i, C: /\b(grey|gray|greyish|grayish|dusty|dull|vivid|bright|neon|electric)\b/i,
  H: /\b(reddish|yellowish|greenish|bluish|purplish|orangish|pinkish)\b/i };
function pickModifier(nameLch, targetLch, name = "", skip = "") {
  const [Ln, Cn] = nameLch, [Lt, Ct, Ht] = targetLch;
  const dL = Lt - Ln, dC = Ct - Cn;
  let dH = Ht - nameLch[2]; if (dH > 180) dH -= 360; if (dH < -180) dH += 360;
  const scores = [["L", Math.abs(dL), dL], ["C", Math.abs(dC) * .8, dC]];
  if (Cn > 8 && Ct > 8) scores.push(["H", Math.abs(dH) * Math.min(Cn, Ct) / 40, dH]);
  scores.sort((a, b) => b[1] - a[1]);
  const ok = scores.filter(sc => !skip.includes(sc[0]) && !MOD_AXIS_WORDS[sc[0]].test(name));
  if (!ok.length) return "";
  const [axis, , v] = ok[0];
  if (axis === "L") return v > 0 ? (Ct < 20 ? "pale" : "light") : (Ct > 35 ? "deep" : "dark");
  if (axis === "C") return v < 0 ? (Ct < 15 ? "greyish" : "dusty") : (Lt > 55 ? "bright" : "vivid");
  return hueLean(Ht);
}

function nearestCore(hexOrLab, list, n = 5) {
  const L = Array.isArray(hexOrLab) && hexOrLab.length === 3 && typeof hexOrLab[0] === "number" && hexOrLab[0] <= 100 ? hexOrLab : lab(hexOrLab);
  return list.map(e => ({ n: e.n, h: e.h, de: de2000(L, e.lab), entry: e }))
    .sort((a, b) => a.de - b.de).slice(0, n);
}
// The runner-up list for an in-between color's page (js/richpage.js rpAlsoHTML): the SAME list and the SAME distance
// nameOf() ranks with, so its first entry is always nameOf()'s winner (tools/check_nearest.js asserts it). `skip` drops
// one name (the page's own); only names within `maxDe` dE2000 (rpYoursName's own limit) are kept.
function nameCandidates(hex, n = 6, maxDe = 12, skip = "") {
  const list = CORE_NAMES || coreFallback(), seen = new Set(), sk = String(skip).toLowerCase();
  return nearestCore(lab(hex), list, 40).filter(x => { const k = x.n.toLowerCase(); if (k === sk || seen.has(k) || x.de > maxDe) return false; seen.add(k); return true; }).slice(0, n);
}
// The same runner-up list widened to the whole archive (David, 2026-10-24: "yes widen it"): the ~900 learnable names
// plus every archive color (data/library.json, js/graph.js loadLongNames), so a rarer real name (a Ridgway, a pigment, a
// Crayola) can show up for an in-between color. Opt-in on purpose: nameOf() and the page title keep the learnable set,
// and tools/check_nearest.js keeps asserting nameCandidates() (the narrow list) against nameOf(). Each row says
// whether it is a learnable name (`learn`) and, for an archive-only one, where the name comes from (`src`).
function nameCandidatesWide(hex, n = 6, maxDe = 12, skip = "") {
  const core = CORE_NAMES || coreFallback(), learn = new Set(core.map(e => e.n.toLowerCase()));
  const pool = core.concat((LONG_NAMES || []).filter(e => !learn.has(e.n.toLowerCase())));
  const seen = new Set(), sk = String(skip).toLowerCase();
  pool.forEach(e => { if (!e.lab) e.lab = lab(e.h); });
  return nearestCore(lab(hex), pool, Math.max(60, n * 3 + 30)).filter(x => { const k = x.n.toLowerCase(); if (k === sk || seen.has(k) || x.de > maxDe) return false; seen.add(k); return true; })
    .slice(0, n).map(x => ({ ...x, learn: learn.has(x.n.toLowerCase()), src: learn.has(x.n.toLowerCase()) ? "" : (typeof srcLine === "function" ? srcLine(x.entry) : "") }));
}
// Has the learner met this word? Only the app's 101 are ever taught today (ROADMAP §13-14's vocabulary ladder
// is a later job): a core-list word beyond those 101 is always "new" until then.
function coreWordMet(entry) {
  const c = entry && BYNAME.get(entry.n.toLowerCase());
  if (!c && entry && typeof cardIdFor === "function") { const id = cardIdFor(entry); return !!(id && S.cards[id]); }   // any core name can be learned now (js/learnmore.js)
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
    // honest even when there's no second candidate to compare against (ROADMAP §17 job #1): never let a far
    // match read as a confident name, and never "closest to X" — say plainly that nothing close exists
    if (second) { between = { a: top.n, b: second.n }; text = `between ${top.n.toLowerCase()} and ${second.n.toLowerCase()}`; }
    else text = `No close name; nearest is ${top.n}`;
  } else if (top.de >= VERY_CLOSE_DE) {
    mod = pickModifier(lch(top.h), Lt, top.n);
    // never let the word contradict the color (a vivid red is not "dusty pink red", a near-white is not "dark linen"):
    // a word only stands when the target's own chroma / lightness agrees; otherwise the next-biggest difference speaks
    let skip = "";
    for (let k = 0; k < 2 && mod; k++) {
      const bad = (/^(dusty|greyish)$/.test(mod) && Lt[1] >= 40) || (/^(vivid|bright)$/.test(mod) && Lt[1] < 45) ? "C"
        : (/^(dark|deep)$/.test(mod) && Lt[0] >= 75) || (/^(light|pale)$/.test(mod) && Lt[0] < 30) ? "L" : "";
      if (!bad) break;
      skip += bad; mod = pickModifier(lch(top.h), Lt, top.n, skip);
    }
    if (mod) text = `${mod} ${top.n.toLowerCase()}`;
  }
  text = text.charAt(0).toUpperCase() + text.slice(1);   // "Pale salmon", "Between teal and slate"
  return { n: top.n, h: top.h, de: Math.round(top.de * 10) / 10, mod, text, near, between, met: coreWordMet(top.entry) };
}
// David, 2026-10-12: "extend descriptive in-between naming to every place a user picks an arbitrary color" --
// the color picker, Look closer's eyedropper (and its shared loupe), Studio's photo palette, a painting's
// palette chips, the swap sheet's eyedropper. One shared helper, reusing js/richpage.js's own rpYoursName()
// (the same wording an in-between color or a tapped photo color already gets: "Muddy pink orchid", up to two
// modifier words by biggest-difference, never a new name) instead of nameOf()'s own single-word modifier
// grammar -- that system stays exactly as it was for every OTHER caller of nameOf(), this only changes what a
// PICKED (arbitrary, off-palette) color shows. `hex` is the picked color; `nm` is its nameOf() result (pass
// one in if the caller already has it, to skip a redundant nearest-name search).
function nameOfTapped(hex, nm) {
  nm = nm || nameOf(hex);
  if (!nm.n) return nm.text || hex;
  if (nm.de > 12) return nm.text;   // too far for a sensible modifier -- nameOf's own "between X and Y"/"no close name" stands
  return typeof rpYoursName === "function" ? rpYoursName(nm.n, nm.h, hex) : nm.n;
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

// ---------- the Japanese cultural note (ROADMAP §17 job #1) ----------
// A quiet line, never a name and never a heading: data/core-names.json's `notes` (tools/build_core_names.py's
// jp-only pass) keeps the romaji, kanji and English meaning of any Japanese traditional color this one merged
// into, even though the primary name is always English now. "In Japanese: 葡萄染 · Ebizome, 'vine grape'".
function jpNoteLine(notes) {
  if (!notes || !notes.length) return "";
  const one = j => `${esc(j.kanji || "")}${j.kanji && j.jp ? " · " : ""}${esc(j.jp || "")}${j.meaning ? `, '${esc(j.meaning.toLowerCase())}'` : ""}`;
  return `In Japanese: ${notes.map(one).join("; ")}`;
}

// ---------- The Compass (color-archive panel, 2026-10-08): walk color space by name ----------
// For one color: the nearest *named* color in each of six directions -- lighter, darker, more vivid, greyer,
// and one step each way along the hue -- searched in all ~2,700 names once the big name library has loaded
// (the ~1,000 core names until then). Directions are CIELAB axes (lightness, chroma, hue), never "brighter".
// Also how crowded this corner of color is: the names within a small ΔE. A direction with nothing in reach
// (cap 25 ΔE) comes back null: a gap in our names, not in English.
const COMPASS_CAP = 25, COMPASS_CROWD_DE = 5;
const compassHueWord = hueZoneWord;
const compassHasLibrary = () => typeof LONG_NAMES !== "undefined" && !!LONG_NAMES;
function compassOf(hex, selfName) {
  hex = String(hex).toUpperCase();
  const list = (typeof LONG_NAMES !== "undefined" && LONG_NAMES) || CORE_NAMES || coreFallback();
  const L0 = lab(hex), [l0, c0, h0] = lch(hex), self = String(selfName || "").toLowerCase();
  const cands = [];
  for (const e of list) {
    if (e.n.toLowerCase() === self || (e.src && e.src.length === 1 && e.src[0] === "jp")) continue;   // Japanese-primary names are "also called" doors, not titles
    const el = e.lab || (e.lab = lab(e.h)), de = de2000(L0, el);
    if (de < 2) continue;   // under 2 they are twins, not directions
    const c = Math.hypot(el[1], el[2]); let h = Math.atan2(el[2], el[1]) * 180 / Math.PI; if (h < 0) h += 360;
    let dh = h - h0; if (dh > 180) dh -= 360; if (dh < -180) dh += 360;
    cands.push({ n: e.n, h: e.h, de, dL: el[0] - l0, dC: c - c0, arc: 2 * Math.sqrt(Math.max(c * c0, 0)) * Math.sin(dh * Math.PI / 360) });
  }
  // each direction ranks its qualifying names by ΔE; then one name fills one hex only, lowest ΔE first across all
  // six, so a name that qualifies twice (lighter AND yellower) takes its closest cell and the other takes its next
  const rank = (primary, off, min) => cands.filter(x => primary(x) >= min && off(x) <= primary(x) && x.de <= COMPASS_CAP).sort((p, q) => p.de - q.de).slice(0, 6);
  const offLC = x => Math.max(Math.abs(x.dC), Math.abs(x.arc)), offCL = x => Math.max(Math.abs(x.dL), Math.abs(x.arc)), offH = x => Math.max(Math.abs(x.dL), Math.abs(x.dC));
  const hasHue = c0 > 8;
  const cells = [
    { key: "lighter", pos: "n", label: "Lighter", list: rank(x => x.dL, offLC, 3) },
    { key: "darker", pos: "s", label: "Darker", list: rank(x => -x.dL, offLC, 3) },
    { key: "vivid", pos: "ne", label: "More vivid", list: rank(x => x.dC, offCL, 3) },
    { key: "greyer", pos: "sw", label: "Duller", list: rank(x => -x.dC, offCL, 3) },
    { key: "huem", pos: "nw", label: hasHue ? compassHueWord(h0 - 45) : "No hue to turn", nohue: !hasHue, list: hasHue ? rank(x => -x.arc, offH, 3) : [] },
    { key: "huep", pos: "se", label: hasHue ? compassHueWord(h0 + 45) : "No hue to turn", nohue: !hasHue, list: hasHue ? rank(x => x.arc, offH, 3) : [] },
  ];
  const taken = new Set();
  cells.forEach(c => { c.hit = null; });
  for (let round = 0; round < 6; round++) {
    let best = null;
    cells.forEach(c => { if (c.hit) return; const x = c.list.find(y => !taken.has(y.n)); if (x && (!best || x.de < best.x.de)) best = { c, x }; });
    if (!best) break;
    best.c.hit = best.x; taken.add(best.x.n);
  }
  const nearest = cands.reduce((a, b) => !a || b.de < a.de ? b : a, null);
  return { cells, crowd: { near: cands.filter(x => x.de <= COMPASS_CROWD_DE).length, nearest, total: list.length } };
}

// The widest name list loaded so far (every library name once it lands, the ~1,000 core names before), for features that
// lay names out by closeness, like the color page's walk (js/richpage.js); naming itself still goes through nameOf()
function walkNameList() { return (typeof LONG_NAMES !== "undefined" && LONG_NAMES) || CORE_NAMES || null; }
