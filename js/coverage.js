"use strict";
// Coverage (Wave 1a, Lane D): "how much of this thing can you name?" for any list of colors.
// setCoverage(hexes) -> { yours, learning, none, total } by the Learner Model's knowState (js/learner.js):
//   yours = recalled on a later day, learning = met or in your reviews, none = not yet.
// coverageRing(cov, o) -> an SVG ring (css/coverage.css): yours as a solid arc, learning as a lighter one.
// Pages mount it as "You can name 4 of 6" (covLabel). Everything is feature-detected, so it ships alone.
function setCoverage(hexes) {
  const out = { yours: 0, learning: 0, none: 0, total: 0 };
  const seen = new Set();
  (hexes || []).forEach(x => {
    const h = typeof x === "string" ? x : x && x.h; if (!h) return;
    const k = String(h).toLowerCase(); if (seen.has(k)) return; seen.add(k);
    let s = "none"; try { if (typeof knowState === "function") s = knowState(typeof x === "string" ? x : { n: x.n, h }); } catch (e) {}
    out.total++;
    if (s === "yours") out.yours++; else if (s === "learning" || s === "met") out.learning++; else out.none++;
  });
  return out;
}
const covLabel = cov => cov.total ? `You can name ${cov.yours} of ${cov.total}` : "";
function coverageRing(cov, o = {}) {
  const size = o.size || 44, sw = o.stroke || 5, r = (size - sw) / 2, C = 2 * Math.PI * r, T = Math.max(1, cov.total);
  const a = cov.yours / T * C, b = cov.learning / T * C;
  const arc = (len, off, cls) => len > 0 ? `<circle class="${cls}" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-dasharray="${len.toFixed(2)} ${(C - len).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>` : "";
  return `<svg class="cov-ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="${esc(covLabel(cov) || "Nothing to name")}" style="--sw:${sw}">
    <circle class="cov-track" cx="${size / 2}" cy="${size / 2}" r="${r}"/>${arc(b, a, "cov-learn")}${arc(a, 0, "cov-yours")}
    <text x="50%" y="50%" class="cov-n" text-anchor="middle" dominant-baseline="central">${cov.yours}</text></svg>`;
}
