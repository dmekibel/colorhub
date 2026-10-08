"use strict";
// Rich color pages (David, 2026-10-08): "opening a random color... sometimes it gives an almost empty page."
// Every section here is computed, not written, so it exists for any of the ~2,716 library colors, the ~1,000
// core names, or an in-between tapped hex -- not just the 101 taught colors. Called from js/explore.js's
// colorPage() and js/names.js's namePage(), in this order: Painters (data), When and where (data), Often
// paired with (data), Harmonies (math, always there), The color measured (math, always there), Mix it (math,
// always there). "In paintings" stays in js/gallery.js; "Found in the world" (botany/gems/fashion/films) and
// "In words" (poems/books) stay in their own files, widened there to fall back to the family word instead of
// going quiet -- see rcFamC() below, which every one of those fallbacks now takes.
// All top-level names here are prefixed rc, per tools/check_names.js's one-global-scope rule.

// ---------- naming a harmony/pair swatch from the whole ~1,000, never just the 101 (David, 2026-10-08: "I
// don't view the 101 as some special list") ----------
function rcName(hex) {
  const list = CORE_NAMES || coreFallback();
  return nearestCore(hex, list, 1)[0];
}
// This color's family head (one of the 101 that owns the deep story) -- used only as a *fallback* for rows
// that would otherwise be empty, never shown as "the 101" or linked as a list (CLAUDE.md, 2026-10-08).
function rcFamC(hex) {
  const fam = typeof familyOf === "function" && familyOf(hex);
  return fam ? { n: fam.head.n, h: fam.head.h } : null;
}
// A tap on any [data-rc-open] swatch opens that color's page, with the little morph-grow every other swatch
// in the app gets (js/core.js morphFrom + MORPH_TRIGGER already matches .kin). Delegated (not querySelectorAll
// + forEach), because several of these sections (Painters, When and where, Often paired with) fill in async,
// after this is wired.
function rcWireOpen(host) {
  if (!host || host._rcWired) return;
  host._rcWired = true;
  host.addEventListener("click", e => {
    const b = e.target.closest("[data-rc-open]"); if (!b) return;
    morphFrom(b.querySelector("i") || b); openCoreName(b.dataset.h, b.dataset.n);
  });
}
// Has this name got a full written article (one of the 101)? Used only to decide whether a nearby-name row
// can offer "Related reading" -- never surfaced as "closest of the 101" (David, 2026-10-08).
const rcHasArticle = name => !!BYNAME.get(String(name).toLowerCase());
// data/core-names.json's `src` codes (tools/build_core_names.py), in plain words, for the "Also called" block.
const RC_SRC_LABEL = { app: "ColorHub", css: "a CSS color keyword", wiki: "Wikipedia", xkcd: "the xkcd color survey", "iscc-nbs": "ISCC-NBS, 1955", ridgway: "Ridgway, 1912" };
const rcSrcLabels = list => (list || []).map(s => RC_SRC_LABEL[s] || s).filter((v, i, a) => a.indexOf(v) === i).join(", ");

// ======================================================================
// 5. Harmonies -- pure color math, so every page gets this, even with zero written content.
// ======================================================================
function rcHarmonyHTML(hex) {
  const complement = rotateHue(hex, 180), an1 = rotateHue(hex, -30), an2 = rotateHue(hex, 30);
  const tri1 = rotateHue(hex, 120), tri2 = rotateHue(hex, 240), sp1 = rotateHue(hex, 150), sp2 = rotateHue(hex, 210);
  const row = (title, sub, hexes) => {
    const chips = hexes.map(h => { const nm = rcName(h); return `<button class="kin rc-harm" data-rc-open data-h="${nm.h}" data-n="${esc(nm.n)}"><i style="--c:${h}"></i><b>${esc(nm.n)}</b></button>`; }).join("");
    return `<div class="rc-harm-row"><p class="rc-harm-sub"><b>${esc(title)}</b> · ${esc(sub)}</p><div class="rc-harm-chips">${chips}</div></div>`;
  };
  const strip = [an1, hex, an2, sp1, sp2];
  return `<section class="rc-sec rc-harmony"><h3>Harmonies</h3>
    ${row("Complement", "opposite on the CIELAB wheel", [complement])}
    ${row("Analogous", "either side of it", [an1, an2])}
    ${row("Triad", "a third of the way around, each way", [tri1, tri2])}
    ${row("Split-complement", "either side of its opposite", [sp1, sp2])}
    <p class="rc-harm-sub"><b>A palette</b> · five colors built around it</p>
    <div class="palette rc-harm-pal">${strip.map(h => `<button class="pal" data-rc-open data-h="${h}" style="--c:${h};flex:1" data-ink="${ink(h)}"></button>`).join("")}</div>
    <p class="fine">Rotates CIELAB hue (LCh h) at the same lightness and strength; names are the nearest of about 1,000.</p>
  </section>`;
}

// ======================================================================
// 8. The color measured -- lightness/chroma/hue in plain words, a hue-plane slice, contrast, color-blind sims.
// ======================================================================
let RC_LSORT = null, RC_CSORT = null;   // cached sorted L*/C* across every core name, for percentiles
function rcPercentileCaches() {
  const list = CORE_NAMES || coreFallback();
  if (RC_LSORT && RC_LSORT.length === list.length) return;
  RC_LSORT = list.map(e => (e.lab || lab(e.h))[0]).sort((a, b) => a - b);
  RC_CSORT = list.map(e => { const l = e.lab || lab(e.h); return Math.hypot(l[1], l[2]); }).sort((a, b) => a - b);
}
function rcPercentile(sorted, v) {
  let lo = 0, hi = sorted.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (sorted[m] < v) lo = m + 1; else hi = m; }
  return Math.round(lo / sorted.length * 100);
}
function rcChromaWord(C) { return C < 15 ? "quite muted" : C < 35 ? "moderately saturated" : "quite vivid"; }
// WCAG relative luminance + contrast ratio
function rcLum(hex) {
  const [r, g, b] = rgb(hex).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; });
  return .2126 * r + .7152 * g + .0722 * b;
}
const rcContrast = (h1, h2) => { const a = rcLum(h1) + .05, b = rcLum(h2) + .05; return a > b ? a / b : b / a; };
function rcContrastWord(ratio) {
  if (ratio >= 7) return "AAA (every text size)";
  if (ratio >= 4.5) return "AA (every text size)";
  if (ratio >= 3) return "AA large text only";
  return "below AA";
}
// simplified Brettel/Viénot-style dichromat matrices, applied in linear sRGB (labeled as simulations, never a claim about any one person's vision)
const RC_CVD = {
  Protanopia: [[.567, .433, 0], [.558, .442, 0], [0, .242, .758]],
  Deuteranopia: [[.625, .375, 0], [.7, .3, 0], [0, .3, .7]],
  Tritanopia: [[.95, .05, 0], [0, .433, .567], [0, .475, .525]],
};
function rcSimulate(hex, m) {
  const lin = v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; };
  const unlin = v => (v <= .0031308 ? 12.92 * v : 1.055 * Math.max(v, 0) ** (1 / 2.4) - .055);
  const [r, g, b] = rgb(hex).map(lin);
  const out = m.map(row => row[0] * r + row[1] * g + row[2] * b).map(v => Math.round(clamp(unlin(v), 0, 1) * 255));
  return "#" + out.map(v => v.toString(16).padStart(2, "0")).join("").toUpperCase();
}
// a small hue-plane slice: this color's family (±45° hue), placed by lightness (y) x chroma (x), tappable
function rcHuePlaneSVG(hex) {
  const [L, C, H] = lch(hex), list = CORE_NAMES || coreFallback();
  const near = list.map(e => { const l = e.lab || lab(e.h); const cc = Math.hypot(l[1], l[2]); let h2 = Math.atan2(l[2], l[1]) * 180 / Math.PI; if (h2 < 0) h2 += 360; let dh = Math.abs(h2 - H); if (dh > 180) dh = 360 - dh; return { n: e.n, h: e.h, L: l[0], C: cc, dh }; })
    .filter(e => e.C > 4 && e.dh < 45).sort((a, b) => a.dh - b.dh).slice(0, 26);
  const W = 260, H2 = 150, pad = 14, maxC = Math.max(60, ...near.map(e => e.C), C);
  const x = c => pad + (c / maxC) * (W - pad * 2), y = l => pad + (1 - l / 100) * (H2 - pad * 2);
  const dots = near.map(e => `<circle cx="${x(e.C).toFixed(1)}" cy="${y(e.L).toFixed(1)}" r="7" fill="${e.h}" stroke="#F3F3F1" stroke-width="1" data-rc-open data-h="${e.h}" data-n="${esc(e.n)}"><title>${esc(e.n)}</title></circle>`).join("");
  return `<svg class="rc-plane" viewBox="0 0 ${W} ${H2}" role="img" aria-label="This color's family by lightness and chroma">
    <rect x="0" y="0" width="${W}" height="${H2}" fill="none"/>
    <line x1="${pad}" y1="${H2 - pad}" x2="${W - pad}" y2="${H2 - pad}" stroke="currentColor" stroke-opacity=".2"/>
    <line x1="${pad}" y1="${pad}" x2="${pad}" y2="${H2 - pad}" stroke="currentColor" stroke-opacity=".2"/>
    ${dots}
    <circle cx="${x(C).toFixed(1)}" cy="${y(L).toFixed(1)}" r="9" fill="${hex}" stroke="#F3F3F1" stroke-width="2.4"/>
  </svg>`;
}
function rcMeasuredHTML(hex) {
  rcPercentileCaches();
  const [L, C] = lch(hex);
  const Lpct = rcPercentile(RC_LSORT, L), Cpct = rcPercentile(RC_CSORT, C);
  const words = `${Lpct >= 50 ? "Lighter" : "Darker"} than ${Lpct >= 50 ? Lpct : 100 - Lpct}% of named colors, and ${esc(rcChromaWord(C))}.`;
  const cw = rcContrast(hex, "#FFFFFF"), cb = rcContrast(hex, "#000000");
  const cvd = Object.entries(RC_CVD).map(([label, m]) => { const sim = rcSimulate(hex, m); return `<button class="rc-cvd" data-rc-open data-h="${sim}" data-n="${esc((rcName(sim) || { n: label }).n)}"><i style="--c:${sim}"></i><b>${label}</b></button>`; }).join("");
  return `<section class="rc-sec rc-measured"><h3>The color measured</h3>
    <p class="rc-measured-words">${words}</p>
    <div class="rc-plane-wrap">${rcHuePlaneSVG(hex)}<p class="fine">Its family, placed by lightness (up) and chroma (right). Tap any dot.</p></div>
    <div class="rc-contrast">
      <div class="rc-contrast-row" style="--c:${hex};--bg:#FFFFFF"><span>On white</span><b>${cw.toFixed(1)}:1</b><em>${rcContrastWord(cw)}</em></div>
      <div class="rc-contrast-row" style="--c:${hex};--bg:#000000"><span>On black</span><b>${cb.toFixed(1)}:1</b><em>${rcContrastWord(cb)}</em></div>
    </div>
    <p class="rc-harm-sub"><b>Color-blind preview</b> · simulations, not a claim about any one person's eyes</p>
    <div class="rc-cvd-row">${cvd}</div>
  </section>`;
}

// ======================================================================
// 9. Mix it -- an approximate blend toward this color from two (sometimes three) colors in the course. There
// is no real paint-mixing (Kubelka-Munk/pigment) math in the app yet, so this is honestly a perceptual (Lab)
// blend, not a pigment recipe -- marked approximate throughout, never oversold as "how paint actually mixes."
// ======================================================================
function rcMixBest(hex) {
  const target = lab(hex), pool = EVERY();
  let best = null;
  for (let i = 0; i < pool.length; i++) {
    const A = pool[i].lab || (pool[i].lab = lab(pool[i].h));
    for (let j = i + 1; j < pool.length; j++) {
      const B = pool[j].lab || (pool[j].lab = lab(pool[j].h));
      for (let w = 0; w <= 1.0001; w += .1) {
        const mix = [A[0] + (B[0] - A[0]) * w, A[1] + (B[1] - A[1]) * w, A[2] + (B[2] - A[2]) * w];
        const d = de2000(target, mix);
        if (!best || d < best.d) best = { i, j, w, d };
      }
    }
  }
  // refine the weight around the coarse best, 2% steps
  const A = pool[best.i].lab, B = pool[best.j].lab;
  for (let w = Math.max(0, best.w - .1); w <= Math.min(1, best.w + .1) + .0001; w += .02) {
    const mix = [A[0] + (B[0] - A[0]) * w, A[1] + (B[1] - A[1]) * w, A[2] + (B[2] - A[2]) * w];
    const d = de2000(target, mix);
    if (d < best.d) best = { ...best, w, d };
  }
  let mix = [A[0] + (B[0] - A[0]) * best.w, A[1] + (B[1] - A[1]) * best.w, A[2] + (B[2] - A[2]) * best.w];
  const result = { parts: [{ c: pool[best.i], pct: Math.round((1 - best.w) * 100) }, { c: pool[best.j], pct: Math.round(best.w * 100) }], d: de2000(target, mix) };
  // a third color, only if it meaningfully tightens the match
  let bestThird = null;
  pool.forEach(c => {
    if (c === pool[best.i] || c === pool[best.j]) return;
    const Cl = c.lab || (c.lab = lab(c.h));
    for (let s = .1; s <= .3001; s += .1) {
      const mix3 = mix.map((v, k) => v * (1 - s) + Cl[k] * s);
      const d = de2000(target, mix3);
      if (!bestThird || d < bestThird.d) bestThird = { c, s, d };
    }
  });
  if (bestThird && bestThird.d < result.d - 1.5) {
    const keep = 1 - bestThird.s;
    result.parts = [{ c: pool[best.i], pct: Math.round((1 - best.w) * keep * 100) }, { c: pool[best.j], pct: Math.round(best.w * keep * 100) }, { c: bestThird.c, pct: Math.round(bestThird.s * 100) }];
    result.d = bestThird.d;
  }
  // round to a tidy 100 (biggest part absorbs the rounding slack)
  const tot = result.parts.reduce((a, p) => a + p.pct, 0);
  if (tot !== 100 && result.parts.length) result.parts.slice().sort((a, b) => b.pct - a.pct)[0].pct += 100 - tot;
  return result;
}
function rcMixHTML(hex) {
  const r = rcMixBest(hex);
  const parts = r.parts.filter(p => p.pct > 0);
  const recipe = parts.map(p => `${p.pct}% ${esc(p.c.n)}`).join(" + ");
  return `<section class="rc-sec rc-mix"><h3>Mix it</h3>
    <div class="rc-mix-row">
      <div class="rc-mix-parts">${parts.map(p => `<button class="kin rc-harm" data-rc-open data-h="${p.c.h}" data-n="${esc(p.c.n)}"><i style="--c:${p.c.h}"></i><b>${p.pct}%</b><span>${esc(p.c.n)}</span></button>`).join("")}</div>
      <div class="rc-mix-eq">≈</div>
      <div class="rc-mix-target" style="--c:${hex}"></div>
    </div>
    <p class="rc-mix-note">${esc(recipe)} ${pctMatch(r.d)}.</p>
    <p class="fine">Approximate: a blend in a perceptual color space (Lab), not a real paint recipe — pigments mix by their own chemistry, which the app doesn't model yet.</p>
  </section>`;
}

// ======================================================================
// 2. Painters who use it -- data/analysis/color-artists.json, built offline by tools/build_richdata.py from
// each artist's own `signature` array (data/analysis/artists/*.json), inverted from "per artist" to "per
// color." Only ~15% of names turn out to be any painter's real signature color (most named colors are too
// rare to be anyone's "overused vs peers" color) -- that's the data being honest, not a bug, so this section
// simply doesn't try a family fallback: a fallback here would misattribute a painter's real signature to a
// color they never actually favored.
// ======================================================================
let RC_ARTISTS = null, RC_ARTISTS_LOADING = null;
function rcLoadArtists() {
  if (RC_ARTISTS) return Promise.resolve(RC_ARTISTS);
  return RC_ARTISTS_LOADING || (RC_ARTISTS_LOADING = fetch("data/analysis/color-artists.json" + (typeof DATA_VER !== "undefined" && DATA_VER ? "?v=" + DATA_VER : ""))
    .then(r => r.ok ? r.json() : {}).catch(() => ({})).then(d => (RC_ARTISTS = d)));
}
function rcPaintersHTML(name) {
  const rows = (RC_ARTISTS || {})[name];
  if (!rows || !rows.length) return "";
  return `<section class="rc-sec rc-painters"><h3>Painters who use it</h3>
    ${rows.slice(0, 5).map(r => `<div class="kin rc-plain"><i style="--c:#8a8a82"></i><b>${esc(r.a)}</b><span>${r.l.toFixed(1)}× more than his or her peers, from ${r.n} painting${r.n === 1 ? "" : "s"} here</span></div>`).join("")}
    <p class="fine">Lift vs. the same decade and country (or country, or the whole archive, when that group is too small). From the gallery's 23,531 paintings; artist pages aren't built yet, so names aren't links yet.</p>
  </section>`;
}
function rcPaintersSection(name) {
  const id = "rc-painters-" + Math.random().toString(36).slice(2, 8);
  rcLoadArtists().then(() => { const box = document.getElementById(id); if (box) box.innerHTML = rcPaintersHTML(name); });
  return `<div id="${id}"></div>`;
}

// ======================================================================
// 3. When and where -- data/analysis/groups.json (byDecade/byCountry/byMovement), loaded whole (64 KB) and
// scanned live: small enough that a reverse index isn't worth shipping separately.
// ======================================================================
let RC_GROUPS = null, RC_GROUPS_LOADING = null;
function rcLoadGroups() {
  if (RC_GROUPS) return Promise.resolve(RC_GROUPS);
  return RC_GROUPS_LOADING || (RC_GROUPS_LOADING = fetch("data/analysis/groups.json" + (typeof DATA_VER !== "undefined" && DATA_VER ? "?v=" + DATA_VER : ""))
    .then(r => r.ok ? r.json() : null).catch(() => null).then(d => (RC_GROUPS = d)));
}
// every {key, n, share, lift} where `name` shows up in that group's top or distinctive list
function rcGroupHits(groups, kind, name) {
  const out = [];
  Object.entries(groups[kind] || {}).forEach(([key, rec]) => {
    const t = (rec.top || []).find(x => x.name === name), d = (rec.distinctive || []).find(x => x.name === name);
    if (t || d) out.push({ key, share: t ? t.share : (d ? d.share : 0), lift: d ? d.lift : 1, n: rec.n });
  });
  return out;
}
function rcSparkline(hits, peakKey) {
  const keys = hits.map(h => h.key).sort((a, b) => (+a) - (+b));
  const max = Math.max(...hits.map(h => h.share)) || 1;
  return `<div class="rc-spark">${keys.map(k => { const h = hits.find(x => x.key === k); const pct = Math.max(6, Math.round(h.share / max * 100)); return `<i style="height:${pct}%" class="${k === peakKey ? "on" : ""}"><em>${esc(String(k).slice(2))}</em></i>`; }).join("")}</div>`;
}
function rcWhenWhereHTML(name) {
  if (!RC_GROUPS) return "";
  const decades = rcGroupHits(RC_GROUPS, "byDecade", name);
  const countries = rcGroupHits(RC_GROUPS, "byCountry", name);
  const movements = rcGroupHits(RC_GROUPS, "byMovement", name);
  if (!decades.length && !countries.length && !movements.length) return "";
  const peakDecade = decades.length ? decades.reduce((a, b) => b.share > a.share ? b : a) : null;
  const peakCountry = countries.length ? countries.reduce((a, b) => b.share > a.share ? b : a) : null;
  const peakMovement = movements.length ? movements.reduce((a, b) => b.lift > a.lift ? b : a) : null;
  const sentences = [];
  if (peakDecade) sentences.push(`Most common in the ${esc(peakDecade.key)}s, from ${peakDecade.n.toLocaleString()} paintings that decade.`);
  if (peakCountry) sentences.push(`Most often in paintings made in ${esc(peakCountry.key)}.`);
  if (peakMovement) sentences.push(`${peakMovement.lift >= 1.3 ? "Characteristic of" : "Seen in"} ${esc(peakMovement.key)}${peakMovement.lift >= 1.3 ? `, ${peakMovement.lift.toFixed(1)}× its usual share` : ""}.`);
  return `<section class="rc-sec rc-whenwhere"><h3>When and where</h3>
    ${decades.length > 1 ? rcSparkline(decades, peakDecade.key) : ""}
    <p>${sentences.join(" ")}</p>
    <p class="fine">From the gallery's 23,531 paintings, as photographed; country is often the painter's nationality, and movement data covers only part of the corpus.</p>
  </section>`;
}
function rcWhenWhereSection(name, famC) {
  const id = "rc-ww-" + Math.random().toString(36).slice(2, 8);
  rcLoadGroups().then(() => {
    const box = document.getElementById(id); if (!box) return;
    let html = rcWhenWhereHTML(name);
    if (!html && famC && famC.n !== name) {
      const h2 = rcWhenWhereHTML(famC.n);
      if (h2) html = h2.replace("<h3>When and where</h3>", `<h3>When and where</h3><p class="fine">Nothing of ${esc(name.toLowerCase())}'s own; its nearest well-covered match, ${esc(famC.n)}:</p>`);
    }
    box.innerHTML = html;
  });
  return `<div id="${id}"></div>`;
}

// ======================================================================
// 4. Often paired with -- data/analysis/color-pairs.json, built offline by tools/build_richdata.py from the
// per-painting named pool (true corpus-wide co-occurrence, not a per-artist proxy): how much more often two
// named colors share a painting's pool than chance (count-based lift), support >= 12 paintings, lift >= 1.2.
// ======================================================================
let RC_PAIRS = null, RC_PAIRS_LOADING = null;
function rcLoadPairs() {
  if (RC_PAIRS) return Promise.resolve(RC_PAIRS);
  return RC_PAIRS_LOADING || (RC_PAIRS_LOADING = fetch("data/analysis/color-pairs.json" + (typeof DATA_VER !== "undefined" && DATA_VER ? "?v=" + DATA_VER : ""))
    .then(r => r.ok ? r.json() : {}).catch(() => ({})).then(d => (RC_PAIRS = d)));
}
function rcPairedHTML(name) {
  const rows = (RC_PAIRS || {})[name];
  if (!rows || !rows.length) return "";
  const list = CORE_NAMES || coreFallback();
  const chips = rows.slice(0, 6).map(r => {
    const e = list.find(x => x.n === r.b); if (!e) return "";
    return `<button class="kin rc-harm" data-rc-open data-h="${e.h}" data-n="${esc(e.n)}"><i style="--c:${e.h}"></i><b>${esc(e.n)}</b><span>${r.l.toFixed(1)}× more than chance, ${r.n} paintings</span></button>`;
  }).filter(Boolean).join("");
  if (!chips) return "";
  return `<section class="rc-sec rc-paired"><h3>Often paired with</h3>${chips}<p class="fine">How much more often two colors share a painting's palette than chance would predict, from the gallery's 23,531 paintings.</p></section>`;
}
function rcPairedSection(name, famC) {
  const id = "rc-pair-" + Math.random().toString(36).slice(2, 8);
  rcLoadPairs().then(() => {
    const box = document.getElementById(id); if (!box) return;
    let html = rcPairedHTML(name);
    if (!html && famC && famC.n !== name) {
      const h2 = rcPairedHTML(famC.n);
      if (h2) html = h2.replace("<h3>Often paired with</h3>", `<h3>Often paired with</h3><p class="fine">Nothing of ${esc(name.toLowerCase())}'s own; its nearest well-covered match, ${esc(famC.n)}:</p>`);
    }
    box.innerHTML = html;
  });
  return `<div id="${id}"></div>`;
}

// ======================================================================
// Two calls for a color/name page, bracketing "Found in the world" and "In words" (which stay in their own
// files): sections 2-5 (Painters, When and where, Often paired with, Harmonies) go before; 8-9 (The color
// measured, Mix it) go after. 1 (In paintings, js/gallery.js), 6/7 (js/botany.js/js/gems.js/js/world.js/
// js/films.js/js/poems.js/js/passages.js) and 10-11 (Nearest names/Codes) stay exactly where they already are.
// ======================================================================
function rcSectionsBeforeWorld(name, hex, famC) {
  return `${rcPaintersSection(name)}${rcWhenWhereSection(name, famC)}${rcPairedSection(name, famC)}${rcHarmonyHTML(hex)}`;
}
function rcSectionsAfterWords(hex) {
  return `${rcMeasuredHTML(hex)}${rcMixHTML(hex)}`;
}
