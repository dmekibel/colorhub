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
function rcWireOpen(host, hex) {
  if (!host) return;
  host._rcHex = hex || host._rcHex;
  if (host._rcWired) return;
  host._rcWired = true;
  host.addEventListener("click", e => {
    const g = e.target.closest("[data-rc-gi]");
    if (g) return galleryPage(+g.dataset.rcGi, true, host._rcHex || null);
    const dl = e.target.closest("[data-rc-duel]"); if (dl && typeof lmDuel === "function") return lmDuel(dl.dataset.rcDuel);
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

// The nearest core name (by CIEDE2000) that actually has data in `has` (a function of a name), within `cap`. Most
// of the ~1,000 names are never any painter's signature, never top a decade, and never share a canvas often
// enough to be paired; rather than a quiet page, those sections show the nearest name that does, and say so
// plainly with how close it is. The whole core list is searched, never a special short list.
function rcNearestWith(hex, name, has, cap = 20) {
  const list = CORE_NAMES || coreFallback(), L = lab(hex);
  let best = null;
  for (const e of list) {
    if (e.n === name || !has(e.n)) continue;
    const d = de2000(L, e.lab || (e.lab = lab(e.h)));
    if (!best || d < best.d) best = { n: e.n, h: e.h, d };
  }
  return best && best.d <= cap ? best : null;
}
const rcNearNote = (name, near) => `<p class="fine">Nothing of ${esc(name.toLowerCase())}'s own; here is its nearest color with data, <b>${esc(near.n)}</b> (${pctMatch(near.d)}).</p>`;

// ======================================================================
// "You and this color" -- one quiet line under the hero, only when there is something true to say.
// Today that is when it became Yours (S.cards[..].ownAt, js/pickit.js). When the learner model lands
// (js/learner.js: lmStatus / lmPairs / lmSeen -- all optional here) it also shows the mix-up note with a
// duel button and any camera finds. Hidden entirely when there is nothing to show.
// ======================================================================
const RC_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function rcDayLabel(k) { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(k || ""); return m ? `${+m[3]} ${RC_MONTHS[+m[2] - 1]}` : ""; }
function rcYouHTML(name, hex) {
  const lines = [];
  const taught = BYNAME.get(String(name).toLowerCase()), st = taught && taught.id && S.cards[taught.id];
  if (st && isMine(st) && st.ownAt) lines.push(`Yours since ${esc(rcDayLabel(st.ownAt))}.`);
  else if (st && S.cards[taught.id]) lines.push("You're learning this one.");
  let duel = "";
  if (typeof lmPairs === "function") {
    try {
      (lmPairs(routeSlug(name)) || []).slice(0, 1).forEach(p => {
        lines.push(`You've mixed it up with ${esc(p.name || p.slug)} ${p.n} time${p.n === 1 ? "" : "s"}.`);
        if (typeof lmDuel === "function") duel = `<button class="btn ghost rc-duel" data-rc-duel="${esc(p.slug || "")}">Duel it ${ICON.arrow}</button>`;
      });
    } catch (e) {}
  }
  if (typeof lmSeen === "function") {
    try { const n = lmSeen(routeSlug(name)); if (n) lines.push(`Found ${n === 1 ? "once" : n + " times"} with the camera.`); } catch (e) {}
  }
  if (!lines.length) return "";
  return `<p class="rc-you">${lines.join(" ")}${duel}</p>`;
}

// ======================================================================
// "Its role in paintings" -- in the paintings that hold this color, is it the shadow, a mid-tone, the light,
// or a small accent? Read from the gallery index (js/gallery.js, six measured colors a painting): the color's
// lightness against the painting's own mean lightness, so it survives varnish and camera (it is relative).
// Each segment opens the painting where that role is strongest, with the color highlighted on arrival.
// As photographed; n is the number of paintings holding a close match (CIEDE2000 12, widened to 18 if few).
// ======================================================================
const RC_ROLES = [["shadow", "Shadow", "darker than the painting around it"], ["mid", "Mid-tone", "about as light as the painting around it"], ["light", "Light", "lighter than the painting around it"], ["accent", "Accent", "a small, strong touch"]];
function rcRoleStats(hex) {
  const G = GAL, N = G.n, [tL, ta, tb] = lab(hex);
  for (const R of [12, 18]) {
    const roles = { shadow: [], mid: [], light: [], accent: [] };
    let n = 0;
    for (let i = 0; i < N; i++) {
      let best = -1, bd = R;
      for (let j = 0; j < 6; j++) {
        const k = i * 6 + j, o = k * 3, dL = G.lab[o] - tL;
        if (dL > 30 || dL < -30) continue;
        const d = glDE(tL, ta, tb, G.lab[o], G.lab[o + 1], G.lab[o + 2]);
        if (d < bd) { bd = d; best = k; }
      }
      if (best < 0) continue;
      const share = G.sh[best], o = best * 3, dm = G.lab[o] - G.mean[i * 3];
      let role = dm < -8 ? "shadow" : dm > 8 ? "light" : "mid";
      if (share < .1 && G.ch[best] > 18 && glDE(G.lab[o], G.lab[o + 1], G.lab[o + 2], G.mean[i * 3], G.mean[i * 3 + 1], G.mean[i * 3 + 2]) > 22) role = "accent";
      roles[role].push([i, role === "accent" ? G.ch[best] * (1 - share) : share * (1 - bd / R)]);
      n++;
    }
    if (n >= 5 || R === 18) return { roles, n, R };
  }
}
function rcRoleSection(name, hex) {
  const id = "rc-role-" + Math.random().toString(36).slice(2, 8);
  const draw = () => {
    const box = document.getElementById(id); if (!box) return;
    const r = rcRoleStats(hex);
    if (!r || r.n < 3) { box.innerHTML = ""; return; }
    const tot = RC_ROLES.reduce((a, [k]) => a + r.roles[k].length, 0) || 1;
    const segs = RC_ROLES.filter(([k]) => r.roles[k].length).map(([k, label, what]) => {
      const list = r.roles[k], top = list.reduce((a, b) => b[1] > a[1] ? b : a);
      return `<button class="rc-role" data-role="${k}" data-rc-gi="${top[0]}" style="flex:${Math.max(list.length, tot * .06)}"><b>${label}</b><span>${list.length} of ${r.n}</span><small>${esc(what)}</small></button>`;
    }).join("");
    box.innerHTML = `<section class="rc-sec rc-roles"><h3>Its role in paintings</h3>
      <div class="rc-role-bar" style="--c:${hex}">${segs}</div>
      <p class="fine">Across ${r.n.toLocaleString()} paintings with a close match, as photographed: its lightness against the painting's own average. Tap a role to see where it is strongest.</p></section>`;
    glFill(box);
  };
  rcLazyGallery(id, draw);   // the gallery index is large: only loaded when this section nears the screen
  return `<div id="${id}"></div>`;
}

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
  // never mix a color from itself: ingredients within a hair of the target (the color's own name, usually) sit out
  const target = lab(hex), pool = EVERY().filter(c => de2000(target, c.lab || (c.lab = lab(c.h))) >= 3);
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
    <p class="rc-mix-note">${esc(recipe)}: a ${pctMatch(r.d)}.</p>
    <p class="fine">Approximate: a blend in a perceptual color space (Lab), not a real paint recipe — pigments mix by their own chemistry, which the app doesn't model yet.</p>
  </section>`;
}

// ======================================================================
// 2. Painters who use it -- data/analysis/color-artists.json, built offline by tools/build_richdata.py from
// each artist's own `signature` array (data/analysis/artists/*.json), inverted from "per artist" to "per
// color." Only ~15% of names turn out to be any painter's real signature color (most named colors are too
// rare to be anyone's "overused vs peers" color). So a name with none of its own shows the nearest name that
// does, labeled as such with its closeness (rcNearestWith), never presented as this color's own painters.
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
    <p class="fine">Lift vs. the same decade and country (or country, or the whole archive, when that group is too small), as photographed, from the gallery's 23,531 paintings (n per painter above). Artist pages aren't built yet, so names aren't links yet.</p>
  </section>`;
}
function rcPaintersSection(name, hex) {
  const id = "rc-painters-" + Math.random().toString(36).slice(2, 8);
  rcLoadArtists().then(() => {
    const box = document.getElementById(id); if (!box) return;
    let html = rcPaintersHTML(name);
    if (!html) { const near = rcNearestWith(hex, name, n => (RC_ARTISTS[n] || []).length); if (near) html = rcPaintersHTML(near.n).replace("<h3>Painters who use it</h3>", "<h3>Painters who use it</h3>" + rcNearNote(name, near)); }
    box.innerHTML = html;
  });
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
function rcWhenWhereSection(name, hex) {
  const id = "rc-ww-" + Math.random().toString(36).slice(2, 8);
  rcLoadGroups().then(() => {
    const box = document.getElementById(id); if (!box) return;
    let html = rcWhenWhereHTML(name);
    if (!html && RC_GROUPS) {
      const near = rcNearestWith(hex, name, n => !!rcWhenWhereHTML(n));
      if (near) html = rcWhenWhereHTML(near.n).replace("<h3>When and where</h3>", "<h3>When and where</h3>" + rcNearNote(name, near));
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
  return `<section class="rc-sec rc-paired"><h3>Often paired with</h3>${chips}<p class="fine">How much more often two colors share a painting's palette than chance would predict, as photographed, from the gallery's 23,531 paintings (n per pair above).</p></section>`;
}
function rcPairedSection(name, hex) {
  const id = "rc-pair-" + Math.random().toString(36).slice(2, 8);
  rcLoadPairs().then(() => {
    const box = document.getElementById(id); if (!box) return;
    let html = rcPairedHTML(name);
    if (!html) { const near = rcNearestWith(hex, name, n => (RC_PAIRS[n] || []).length); if (near) html = rcPairedHTML(near.n).replace("<h3>Often paired with</h3>", "<h3>Often paired with</h3>" + rcNearNote(name, near)); }
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
// ======================================================================
// The history band -- the closest color any painting in the archive actually reaches (data/analysis/reach.json,
// tools/archive_reach.py, from all 564,744 pool colors of the 23,531 paintings; a name outside the ~1,000
// core names is measured live against each painting's six main colors instead). When nothing comes close the
// headline says so: that is the honest fix for an empty page, and the caveat is built in (aged, varnished
// paintings, photographed, 24 colors each).
// ======================================================================
let RC_REACH = null, RC_REACH_LOADING = null;
function rcLoadReach() {
  if (RC_REACH) return Promise.resolve(RC_REACH);
  return RC_REACH_LOADING || (RC_REACH_LOADING = fetch("data/analysis/reach.json" + (typeof DATA_VER !== "undefined" && DATA_VER ? "?v=" + DATA_VER : ""))
    .then(r => r.ok ? r.json() : {}).catch(() => ({})).then(d => (RC_REACH = d)));
}
// live fallback for a name not in reach.json: closest of each painting's six main colors, and how many are within ΔE 6
function rcReachLive(hex) {
  const G = GAL, [tL, ta, tb] = lab(hex); let bd = 1e9, bi = -1, bk = -1, n = 0, y = null;
  for (let i = 0; i < G.n; i++) {
    let hit = false;
    for (let j = 0; j < 6; j++) {
      const k = i * 6 + j, o = k * 3, dL = G.lab[o] - tL;
      if (dL > 25 || dL < -25) continue;
      const d = glDE(tL, ta, tb, G.lab[o], G.lab[o + 1], G.lab[o + 2]);
      if (d < bd) { bd = d; bi = i; bk = k; }
      if (d <= 6) hit = true;
    }
    if (hit) { n++; if (G.year[i] !== GL_UNDATED) { const yy = G.year[i]; y = y == null || yy < y ? yy : y; } }
  }
  return bi < 0 ? null : [Math.round(bd * 10) / 10, bi, glHex(bi, bk % 6), n, y];
}
// run draw() once the gallery index is in (loaded only when the section nears the screen)
function rcLazyGallery(id, draw) {
  const go = () => { if (typeof GAL !== "undefined" && GAL) draw(); else loadGallery().then(draw).catch(() => {}); };
  // once the first screen has settled (the hero fills a viewport); the gallery index is about 1 MB, shared with the paintings row
  setTimeout(() => { if (document.getElementById(id)) go(); }, 700);
}
const rcYearLabel = y => y == null ? "" : y < 0 ? `${-y} BCE` : String(y);
function rcReachSection(name, hex) {
  const id = "rc-reach-" + Math.random().toString(36).slice(2, 8);
  const paint = (r, box) => {
    const [d, pi, ph, n, y] = r;
    const none = d > 8 && n === 0;
    const pin = () => (typeof GAL !== "undefined" && GAL) ? glPinHTML(pi, { badge: pctMatch(d) }) : "";
    const caveat = `<p class="fine">As photographed: aged, varnished paintings, each cut to a few dozen colors, so a very small vivid touch can be lost. This says what our archive shows, not what paint can do.</p>`;
    if (none) {
      box.innerHTML = `<section class="rc-sec rc-reach rc-reach-none"><p class="rc-reach-head">No painting in our 23,531 reaches this color. It's a modern color.</p>
        <div class="rc-reach-pair"><div style="--c:${hex}" data-ink="${ink(hex)}"><b>This color</b></div><button style="--c:${ph}" data-ink="${ink(ph)}" data-rc-gi="${pi}"><b>The closest any painting gets</b><small>${pctDiff(d)} · tap to see the painting</small></button></div>${caveat}</section>`;
    } else {
      const few = n <= 3;
      box.innerHTML = `<section class="rc-sec rc-reach"><h3>In the archive</h3>
        <div class="rc-reach-blocks"><div class="rc-reach-pin">${pin()}</div>
          <div class="rc-reach-stat"><b>${few ? (n ? `Only ${n} painting${n === 1 ? "" : "s"}` : "Barely any") : n.toLocaleString() + " paintings"}</b><span>${few ? "come close" : "come close to it"} (within ${pctFmt(6)}).</span>${y != null ? `<span>Earliest in our archive: <b>${esc(rcYearLabel(y))}</b>.</span>` : ""}<span>The closest, ${pctDiff(d)}, is the one at left.</span></div></div>${caveat}</section>`;
    }
    glFill(box);
  };
  Promise.all([rcLoadReach()]).then(() => {
    let r = RC_REACH && RC_REACH[name];
    if (r) {
      // the none-headline needs no gallery; the pin does
      const box = document.getElementById(id); if (!box) return;
      if (r[0] > 8 && r[3] === 0) return paint(r, box);
      box.innerHTML = "";
      return rcLazyGallery(id, () => { const b = document.getElementById(id); if (b) paint(r, b); });
    }
    rcLazyGallery(id, () => { const b = document.getElementById(id); r = b && rcReachLive(hex); if (b && r) paint(r, b); });
  });
  return `<div id="${id}"></div>`;
}

// ======================================================================
// The Compass -- nearest named color in six directions (js/naming.js compassOf), with how crowded this corner
// of color is. One tap on a cell walks there.
// ======================================================================
function rcCompassSection(name, hex) {
  const id = "rc-compass-" + Math.random().toString(36).slice(2, 8);
  const draw = () => {
    const box = document.getElementById(id); if (!box) return;
    const { cells, crowd } = compassOf(hex, name);
    const cell = c => c.hit
      ? `<button class="kin rc-cell" data-rc-open data-h="${c.hit.h}" data-n="${esc(c.hit.n)}"><i style="--c:${c.hit.h}"></i><small>${esc(c.label)}</small><b>${esc(c.hit.n)}</b><span>${pctDiff(c.hit.de)}</span></button>`
      : `<div class="rc-cell rc-cell-empty"><small>${esc(c.label)}</small><span>No named color this way within ${pctFmt(25)}.</span></div>`;
    const near = crowd.near, nm = crowd.nearest;
    const line = near >= 8 ? `Crowded corner: ${near} named colors within ${pctFmt(5)} of it.`
      : near >= 3 ? `A well-named corner: ${near} named colors within ${pctFmt(5)} of it.`
      : near >= 1 ? `A sparse corner: ${near === 1 ? "one other name" : near + " other names"} within ${pctFmt(5)}.`
      : `A lonely color: the nearest name${nm ? ` (${esc(nm.n)})` : ""} is ${nm ? pctDiff(nm.de) : "far"}.`;
    box.innerHTML = `<section class="rc-sec rc-compass"><h3>The Compass</h3><div class="rc-compass-grid">${cells.map(cell).join("")}</div>
      <p class="rc-crowd">${line}</p><p class="fine">Directions are lightness, chroma and hue in CIELAB, searched among about ${crowd.total.toLocaleString()} names in our archive of names.</p></section>`;
  };
  setTimeout(() => { draw(); if (!compassHasLibrary()) loadLongNames().then(draw).catch(() => {}); }, 0);
  return `<div id="${id}"></div>`;
}

// ======================================================================
// Passport stamps and the tier line -- each naming system that lists the color, dated by the system (never a
// first-use claim; X11 is "1980s"), and one honest line on where the name comes from, from `src` alone.
// ======================================================================
const RC_STAMPS = [["werner", "Werner", "1821"], ["ridgway", "Ridgway", "1912"], ["ral", "RAL", "1927 on"], ["iscc-nbs", "ISCC-NBS", "1955"], ["css", "X11 / CSS", "1980s"], ["xkcd", "xkcd survey", "2010"], ["jp", "Japanese traditional", ""], ["pigment", "Pigment lists", ""], ["wiki", "Wikipedia lists", ""]];
function rcTierLine(src) {
  const has = k => (src || []).includes(k);
  if (has("pigment")) return "A pigment name";
  if (has("werner") || has("ridgway")) return "A naturalist's name";
  if (has("css")) return "A web color name";
  if (has("ral")) return "An industrial color name";
  if (has("iscc-nbs")) return "A name from a descriptive color system";
  if (has("xkcd")) return "A crowd word";
  if (has("jp")) return "A traditional Japanese color name";
  return "Origin undocumented";
}
function rcPassportHTML(src) {
  const stamps = RC_STAMPS.filter(([k]) => (src || []).includes(k));
  if (!stamps.length) return "";
  return `<div class="rc-passport">${stamps.map(([, label, date]) => `<span class="rc-stamp"><b>${esc(label)}</b>${date ? `<em>${esc(date)}</em>` : ""}</span>`).join("")}</div><p class="fine rc-tier">${esc(rcTierLine(src))}.</p>`;
}

function rcSectionsBeforeWorld(name, hex, famC) {
  return `${rcRoleSection(name, hex)}${rcPaintersSection(name, hex)}${rcWhenWhereSection(name, hex)}${rcPairedSection(name, hex)}${rcHarmonyHTML(hex)}`;
}
function rcSectionsAfterWords(hex) {
  return `${rcMeasuredHTML(hex)}${rcMixHTML(hex)}`;
}

// ======================================================================
// The article slot. A separate article system is coming (written prose stored as data/articles/<slug>.json,
// slug = routeSlug(color name)). Both page types call articleSlot(slug) near the top, right under the hero;
// it renders nothing when no article file exists (a 404 is the normal case today), so pages stay clean.
// Expected shape (provisional, the article system may replace this renderer): { lead?: string, sections?: [{ title?, text }] }.
// ======================================================================
function articleSlot(slug) {
  const id = "rc-article-" + Math.random().toString(36).slice(2, 8);
  fetch("data/articles/" + encodeURIComponent(slug) + ".json" + (typeof DATA_VER !== "undefined" && DATA_VER ? "?v=" + DATA_VER : ""))
    .then(r => r.ok ? r.json() : null).catch(() => null).then(a => {
      const box = document.getElementById(id); if (!box || !a) return;
      const secs = (a.sections || []).map(x => `<section class="rc-article-sec">${x.title ? `<h3>${esc(x.title)}</h3>` : ""}<p>${esc(x.text || "")}</p></section>`).join("");
      box.innerHTML = `${a.lead ? `<p class="lead">${esc(a.lead)}</p>` : ""}${secs}`;
    });
  return `<div class="rc-article" id="${id}"></div>`;
}
