"use strict";
// Every miss has names (design/IDEAS-10X/train-games.md §7 A). After any eye-game answer, one line names both
// colors and says how they differ, so every round is also vocabulary, and it teaches that names are regions:
//   different names: "You found Deep teal among Teal: darker and a touch bluer."
//   same name:       "Both are Teal. This difference has no word; the odd one is 2.1% darker."
// Names come from nameOf() (js/naming.js, with its modifiers and its "between X and Y" for far matches); each name
// is one tap from its page ([data-swatch], js/swatch.js). Direction words follow COLORNERD §6.5: lighter/darker,
// more vivid/greyer, and hue words from where the color moves on the a*b* plane (redder, yellower, greener,
// bluer). Never "brighter", "warmer" or "cooler". An axis is named only when it carries at least 30% of the
// difference, with "a touch" when its share is under 50%; hue words are skipped when both colors are near grey.

// the share of a CIEDE2000 difference carried by lightness, chroma and hue (the formula's own weighted terms)
function eyeParts(aHex, bHex) {
  const [L1, a1, b1] = lab(aHex), [L2, a2, b2] = lab(bHex);
  const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2), Cb = (C1 + C2) / 2, Lb = (L1 + L2) / 2;
  const dL = L2 - L1, dC = C2 - C1, dE = Math.hypot(L2 - L1, a2 - a1, b2 - b1), dH = Math.sqrt(Math.max(0, dE * dE - dL * dL - dC * dC));
  const Sl = 1 + .015 * (Lb - 50) ** 2 / Math.sqrt(20 + (Lb - 50) ** 2), Sc = 1 + .045 * Cb, Sh = 1 + .015 * Cb;
  const tL = (dL / Sl) ** 2, tC = (dC / Sc) ** 2, tH = (dH / Sh) ** 2, sum = tL + tC + tH || 1;
  // the hue move as a direction on the a*b* plane: the displacement minus its radial (chroma) part
  const ux = C1 > 1e-6 ? a1 / C1 : 0, uy = C1 > 1e-6 ? b1 / C1 : 0, ra = (a2 - a1) * ux + (b2 - b1) * uy;
  const hx = (a2 - a1) - ra * ux, hy = (b2 - b1) - ra * uy;
  return { dL, dC, hx, hy, sL: tL / sum, sC: tC / sum, sH: tH / sum, grey: C1 < 8 && C2 < 8 };
}
// the strongest of the four pulls on the a*b* plane
const eyeHueWord = (x, y) => Math.abs(x) >= Math.abs(y) ? (x > 0 ? "redder" : "greener") : (y > 0 ? "yellower" : "bluer");
// "darker and a touch bluer" (from a to b)
function eyeDir(aHex, bHex) {
  const p = eyeParts(aHex, bHex), out = [];
  const add = (share, word) => { if (share >= .3) out.push([share, (share < .5 ? "a touch " : "") + word]); };
  add(p.sL, p.dL > 0 ? "lighter" : "darker");
  add(p.sC, p.dC > 0 ? "more vivid" : "greyer");
  if (!p.grey) add(p.sH, eyeHueWord(p.hx, p.hy));
  out.sort((a, b) => b[0] - a[0]);
  return out.map(x => x[1]).join(" and ") || "slightly different";
}
function eyeNames(baseHex, oddHex) {
  const a = nameOf(baseHex), b = nameOf(oddHex);
  return { same: a.n === b.n, a: { n: a.n, text: a.text || a.n, hex: baseHex }, b: { n: b.n, text: b.text || b.n, hex: oddHex }, dir: eyeDir(baseHex, oddHex) };
}
const eyeLink = x => `<span class="wl wl-c eye-n" style="--c:${x.hex}" data-swatch="${x.hex}">${esc(x.text)}</span>`;
// One line. opts.found: true when the player found it ("You found…"), false for a miss ("The odd one was…").
// opts.pct: show the size of the difference too. opts.what: "the odd one" (default) | "it" | "the new one" …
function eyeNamesLine(baseHex, oddHex, opts = {}) {
  if (!baseHex || !oddHex || baseHex === oddHex) return "";
  const e = eyeNames(baseHex, oddHex), d = de2000(baseHex, oddHex), what = opts.what || "the odd one";
  const pct = opts.pct === false ? "" : ` <b class="mono">${pctFmt(d)}</b>`;
  if (e.same) return `Both are ${eyeLink(e.a)}. This difference has no word; ${what} is${pct ? pct + " different," : ""} ${e.dir}.`;
  const lead = opts.found === false ? `${what.charAt(0).toUpperCase() + what.slice(1)} was ${eyeLink(e.b)} among ${eyeLink(e.a)}` : `You found ${eyeLink(e.b)} among ${eyeLink(e.a)}`;
  return `${lead}:${pct}${pct ? " different," : ""} ${e.dir}.`;
}
// prefetch the ~1,000 names once a game starts, so the first line already names precisely
function eyeNamesReady() { try { if (typeof CORE_NAMES !== "undefined" && !CORE_NAMES && typeof loadCoreNames === "function") return loadCoreNames(); } catch (e) {} return Promise.resolve(); }
