"use strict";
// A page for every pair, trio and palette (design/SET-PAGES.md). spPage(hexes) draws one of two shapes:
//   a pair  #/pair/<a>+<b>          the two side by side, how they relate, their history together
//   a set   #/set/<a>-<b>-<c>…      3 to 8 colors: harmony, the pairs inside, history, complete it, improve it
// History comes from the finer color index (js/colorindex.js: paintingsWith, pairStats, ciSetStats, ciAffinity) over
// the museum photographs and the design-history index, and the looks (js/looks.js lookMatch). The improve
// suggestions are plain LCh arithmetic on measured reasons. Getting here: js/settray.js. Top-level names start with sp.

const SP_STRENGTH = [["subtle", "Subtle", .4], ["clear", "Clear", .7], ["bold", "Bold", 1]];
const SP_MIN_N = 5;        // fewer paintings than this and we don't talk about painters' habits
const SP_Q = 5;            // the index takes up to five colors at once
let SP_STR = "clear", SP_SEQ = 0;

// ---------- small color math ----------
const spLin = v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; };
const spLum = h => { const [r, g, b] = rgb(h).map(spLin); return .2126 * r + .7152 * g + .0722 * b; };
const spRatio = (a, b) => { const x = spLum(a), y = spLum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
const spHueGap = (a, b) => { let d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
const spTemp = h => { const [, C, H] = lch(h); return C < 8 ? "neutral" : H < 100 || H >= 330 ? "warm" : "cool"; };
// a point in LCh, pulled toward grey until it fits on a screen
function spMake(L, C, H) {
  L = clamp(L, 2, 98); H = ((H % 360) + 360) % 360;
  let c = Math.max(0, C), g = 0;
  while (c > .5 && !inGamut(L, c * Math.cos(H * Math.PI / 180), c * Math.sin(H * Math.PI / 180)) && g++ < 80) c *= .96;
  return lchHex(L, c, H);
}
const spHex = h => /^#?[0-9a-f]{6}$/i.test(String(h || "")) ? "#" + String(h).replace("#", "").toUpperCase() : null;
// the canonical order (dark to light, then hex), one entry per color: the same set is always one address
function spCanon(hexes) {
  const out = [];
  (Array.isArray(hexes) ? hexes : String(hexes || "").split(/[+,\-]/)).map(spHex).filter(Boolean).forEach(h => { if (!out.some(x => de2000(x, h) < 1) && out.length < 8) out.push(h); });
  return out.sort((a, b) => lab(a)[0] - lab(b)[0] || a.localeCompare(b));
}
const spPath = hexes => (hexes.length === 2 ? "pair/" + hexes.map(h => h.slice(1).toLowerCase()).join("+") : "set/" + hexes.map(h => h.slice(1).toLowerCase()).join("-"));
const spNm = h => { const n = nameOf(h); return n.de < VERY_CLOSE_DE && !n.between ? n.n : n.text || h; };
const spList = a => a.length <= 1 ? a.join("") : a.length === 2 ? a.join(" and ") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1];
const spTimes = l => (l >= 10 ? Math.round(l) : l.toFixed(1)) + "×";
const spNum = n => Math.round(n).toLocaleString("en-US");
const spTitle = hexes => hexes.map(spNm).join(" + ");
// the five most distinct colors (farthest-point, from the most vivid), for queries the index caps at five
function spPickQ(hexes) {
  if (hexes.length <= SP_Q) return hexes.slice();
  const left = hexes.slice().sort((a, b) => lch(b)[1] - lch(a)[1]), out = [left.shift()];
  while (out.length < SP_Q) {
    let bi = 0, bd = -1;
    left.forEach((h, i) => { const d = Math.min(...out.map(o => de2000(o, h))); if (d > bd) { bd = d; bi = i; } });
    out.push(left.splice(bi, 1)[0]);
  }
  return hexes.filter(h => out.includes(h));
}

// ---------- harmony: the nearest textbook scheme on the perceptual (CIELAB) wheel ----------
const SP_SCHEMES = [["complementary pair", [0, 180]], ["split complement", [0, 150, 210]], ["triad", [0, 120, 240]], ["square", [0, 90, 180, 270]]];
function spScheme(hexes) {
  const ch = hexes.map((h, i) => ({ i, h, lc: lch(h) })).filter(x => x.lc[1] >= 12);
  const out = { chromatic: ch.length, neutrals: hexes.length - ch.length, name: "", off: 0, span: 0, targets: null, fit: "" };
  if (!ch.length) { out.fit = "all neutrals"; out.name = "neutrals"; return out; }
  if (ch.length === 1) { out.fit = "one hue with neutrals"; out.name = "one hue"; return out; }
  // the smallest arc that holds every hue
  const hs = ch.map(x => x.lc[2]).sort((a, b) => a - b);
  let gap = 0; hs.forEach((h, i) => { const g = (i ? h - hs[i - 1] : h + 360 - hs[hs.length - 1]); if (g > gap) gap = g; });
  out.span = 360 - gap;
  if (out.span <= 30) { out.name = "monochromatic"; out.fit = "one hue family, in different lightness and strength"; return out; }
  if (out.span <= 70) { out.name = "analogous"; out.fit = "neighbors on the wheel"; return out; }
  let best = null;
  SP_SCHEMES.forEach(([name, T]) => {
    if (T.length > ch.length) return;
    for (let r = 0; r < 360; r += 2) {
      const used = new Set(); let cost = 0;
      const tg = ch.map(x => { let bi = 0, bd = 999; T.forEach((t, k) => { const d = spHueGap(x.lc[2], t + r); if (d < bd) { bd = d; bi = k; } }); used.add(bi); cost += bd; return (T[bi] + r) % 360; });
      if (used.size < T.length) continue;
      cost /= ch.length;
      if (!best || cost < best.cost - .01) best = { name, cost, tg, r };
    }
  });
  if (!best) { out.name = ""; out.fit = "no textbook scheme"; return out; }
  out.off = best.cost; out.targets = new Map(ch.map((x, k) => [x.i, best.tg[k]]));
  out.name = best.name;
  out.fit = best.cost <= 10 ? `a ${best.name}` : best.cost <= 25 ? `close to a ${best.name} (${Math.round(best.cost)}° off on average)` : "no textbook scheme";
  return out;
}

// ---------- the facts about two colors ----------
function spPairFacts(a, b) {
  const [La, Ca, Ha] = lch(a), [Lb, Cb, Hb] = lch(b), A = spNm(a), B = spNm(b), d = de2000(a, b), out = [];
  const apart = d < 3 ? "near twins: most people can't tell them apart side by side" : d < 8 ? "close: easy to mix up apart, easy to tell together" : d < 20 ? "clearly different" : d < 40 ? "far apart" : "about as far apart as colors get";
  out.push(["Apart", `${pctDiff(d)}: ${apart}.`]);
  const dL = Math.abs(La - Lb), dk = La < Lb ? A : B, lt = La < Lb ? B : A;
  out.push(["Lightness", dL < 5 ? `About as light as each other (${Math.round(La)} and ${Math.round(Lb)} of 100), so in black and white they'd merge.` : `${dk} is ${dL >= 30 ? "much " : dL < 12 ? "a little " : ""}darker: ${Math.round(Math.min(La, Lb))} against ${Math.round(Math.max(La, Lb))} of 100.`]);
  const th = ciTheory(a, b);
  if (Ca >= 12 && Cb >= 12) { const g = spHueGap(Ha, Hb); out.push(["Hue", `${Math.round(g)}° apart on the perceptual wheel: ${th.text}. A painter's wheel puts opposites elsewhere.`]); }
  else if (Ca < 12 && Cb < 12) out.push(["Hue", "Both are neutrals: the pair is all lightness, almost no hue."]);
  else out.push(["Hue", `${Ca < 12 ? A : B} is a neutral, so ${Ca < 12 ? B : A} carries all the hue.`]);
  const dC = Math.abs(Ca - Cb);
  out.push(["Vividness", dC < 8 ? `About as vivid as each other (chroma ${Math.round(Ca)} and ${Math.round(Cb)}).` : `${Ca > Cb ? A : B} is ${dC >= 30 ? "far " : ""}more vivid: chroma ${Math.round(Math.max(Ca, Cb))} against ${Math.round(Math.min(Ca, Cb))}.`]);
  const ta = spTemp(a), tb = spTemp(b);
  out.push(["Temperature", ta === tb ? (ta === "neutral" ? "Neither leans warm or cool." : `Both ${ta}.`) : `${A} ${ta}, ${B} ${tb}.`]);
  const r = spRatio(a, b);
  out.push(["As text", `${r.toFixed(1)}:1 contrast, ${r >= 7 ? "readable as small text either way round" : r >= 4.5 ? "fine for body text either way round" : r >= 3 ? "for large text only" : "too close for text: decoration only"} (WCAG).`]);
  return out;
}

// ---------- the facts about a set ----------
function spSetFacts(hexes, sch) {
  const cs = hexes.map(h => ({ h, n: spNm(h), lc: lch(h) })), out = [];
  out.push(["Harmony", sch.chromatic >= 2 ? `${spCap(sch.fit)}, on the perceptual wheel. Painters rarely work to a scheme; it's a lens, not a grade.` : `${spCap(sch.fit)}.`]);
  const byL = cs.slice().sort((a, b) => a.lc[0] - b.lc[0]), lo = byL[0], hi = byL[byL.length - 1], range = hi.lc[0] - lo.lc[0];
  out.push(["Lightness", `From ${Math.round(lo.lc[0])} (${lo.n.toLowerCase()}) to ${Math.round(hi.lc[0])} (${hi.n.toLowerCase()}) of 100: ${range >= 60 ? "a strong dark-to-light structure" : range >= 35 ? "a moderate range" : "a narrow range, so it reads flat in black and white"}.`]);
  const byC = cs.slice().sort((a, b) => b.lc[1] - a.lc[1]), neutral = cs.filter(c => c.lc[1] < 12).length;
  out.push(["Vividness", neutral === cs.length ? "All neutrals: the palette is lightness and warmth, almost no hue." : `${byC[0].n} is the most vivid (chroma ${Math.round(byC[0].lc[1])}), ${byC[byC.length - 1].n.toLowerCase()} the quietest (${Math.round(byC[byC.length - 1].lc[1])}).${neutral ? ` ${neutral} of ${cs.length} ${neutral === 1 ? "is a neutral" : "are neutrals"}.` : ""}`]);
  const t = { warm: 0, cool: 0, neutral: 0 }; hexes.forEach(h => t[spTemp(h)]++);
  out.push(["Temperature", [["warm", t.warm], ["cool", t.cool], ["neutral", t.neutral]].filter(x => x[1]).map(([k, v]) => `${v} ${k}`).join(", ") + "."]);
  let close = null, best = null;
  for (let i = 0; i < hexes.length; i++) for (let j = i + 1; j < hexes.length; j++) {
    const d = de2000(hexes[i], hexes[j]), r = spRatio(hexes[i], hexes[j]);
    if (!close || d < close.d) close = { i, j, d };
    if (!best || r > best.r) best = { i, j, r };
  }
  out.push(["Closest pair", `${cs[close.i].n} and ${cs[close.j].n.toLowerCase()}, ${pctDiff(close.d)}${close.d < 8 ? ": they may blur into one at a distance" : ""}.`]);
  out.push(["As text", `The best pair for text is ${cs[best.j].n.toLowerCase()} on ${cs[best.i].n.toLowerCase()}, ${best.r.toFixed(1)}:1 (${best.r >= 4.5 ? "fine for body text" : best.r >= 3 ? "large text only" : "too close for text"}, WCAG).`]);
  return out;
}
const spCap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

// ---------- improve: suggestions the numbers call for ----------
// Each: { id, title, why, after: [hex] } with after in the same order as hexes. s = strength 0.4 / 0.7 / 1.
// locks: { id: Set(index) } colors the person keeps as they are, per suggestion. With none, each suggestion moves the
// fewest colors that reach its goal (a pair usually changes ONE color), so the palette stays recognizable.
function spImprove(hexes, s, ctx = {}, locks = {}) {
  const cs = hexes.map(h => { const [L, C, H] = lch(h); return { h, L, C, H }; }), k = cs.length, out = [];
  const nm = h => spNm(h);
  const lk = id => locks[id] || new Set(), changed = (a, b) => de2000(a, b) >= .8;
  // a suggestion with the locked colors put back; none left to move -> a "blocked" card (so the locks can be undone)
  const put = (id, o, after) => {
    const a = after.map((h, i) => lk(id).has(i) ? hexes[i] : h);
    if (a.some((h, i) => changed(h, hexes[i]))) out.push({ id, ...o, after: a });
    else if (lk(id).size) out.push({ id, need: o.need, title: o.title, after: hexes.slice(), blocked: true, why: "With those colors kept as they are, there's nothing left to move for this. Unlock one to see it." });
  };
  // 1. a pair too close to tell apart: part their lightness
  let close = null;
  for (let i = 0; i < k; i++) for (let j = i + 1; j < k; j++) { const d = de2000(cs[i].h, cs[j].h); if (!close || d < close.d) close = { i, j, d }; }
  if (close && close.d < 10) {
    const a = cs[close.i], b = cs[close.j], up = a.L >= b.L ? a : b, dn = up === a ? b : a, push = (6 + 10 * s) / 2 + Math.max(0, 8 - close.d) * s;
    const both = cs.map(c => c === up ? spMake(c.L + push, c.C, c.H) : c === dn ? spMake(c.L - push, c.C, c.H) : c.h);
    const ref = de2000(both[close.i], both[close.j]), free = i => !lk("part").has(i);
    // the fewest moves: just one of the two, twice as far, the one that moves least (and has room to move)
    const singles = [[up, 1], [dn, -1]].map(([c, sg]) => {
      const i = cs.indexOf(c), L = c.L + sg * 2 * push;
      if (!free(i) || L < 4 || L > 97) return null;
      const after = cs.map((x, j) => j === i ? spMake(L, c.C, c.H) : x.h);
      return de2000(after[close.i], after[close.j]) >= .9 * ref ? { after, cost: de2000(c.h, after[i]) } : null;
    }).filter(Boolean).sort((x, y) => x.cost - y.cost);
    const after = singles.length ? singles[0].after : free(close.i) && free(close.j) ? both : null;
    const moved = after ? after.map((h, i) => changed(h, hexes[i]) ? i : -1).filter(i => i >= 0) : [];
    const o = { need: 12 - close.d, title: "Part the closest pair" };
    if (after) { const nd = de2000(after[close.i], after[close.j]); put("part", { ...o, why: `${nm(a.h)} and ${nm(b.h).toLowerCase()} are only ${pctDiff(close.d)}. ${moved.length === 1 ? `Moving just ${nm(hexes[moved[0]]).toLowerCase()} ${after[moved[0]] && lab(after[moved[0]])[0] > lab(hexes[moved[0]])[0] ? "lighter" : "darker"}` : "Moving one lighter and one darker"} makes them read as two colors (${pctDiff(nd)}).` }, after); }
    else put("part", o, hexes);
  }
  // 2. lightness range: spread it around its middle
  const Ls = cs.map(c => c.L), lo = Math.min(...Ls), hi = Math.max(...Ls), range = hi - lo;
  if (range < 50) {
    const target = range + (72 - range) * s, mid = (lo + hi) / 2, order = cs.map((c, i) => i).sort((x, y) => cs[x].L - cs[y].L), delta = target - range;
    const both = cs.map((c, i) => {
      const t = range < 3 ? (order.indexOf(i) / Math.max(1, k - 1) - .5) : (c.L - mid) / range;
      return spMake(clamp(mid + t * target, 6, 96), c.C, c.H);
    });
    const spanOf = arr => { const l = arr.map(h => lab(h)[0]); return Math.max(...l) - Math.min(...l); };
    // the fewest moves: only the lightest lighter, or only the darkest darker, whichever moves less
    const iHi = order[k - 1], iLo = order[0];
    const singles = [[iHi, 1], [iLo, -1]].map(([i, sg]) => {
      const L = cs[i].L + sg * delta;
      if (lk("value").has(i) || L < 6 || L > 96) return null;
      const after = cs.map((x, j) => j === i ? spMake(L, x.C, x.H) : x.h);
      return spanOf(after) >= range + .85 * delta ? { after, cost: de2000(cs[i].h, after[i]) } : null;
    }).filter(Boolean).sort((x, y) => x.cost - y.cost);
    const after = singles.length ? singles[0].after : both.map((h, i) => lk("value").has(i) ? hexes[i] : h);
    const span = spanOf(after);
    if (span >= range + .4 * delta) put("value", { need: (50 - range) / 2, title: "More dark and light",
      why: `Lightness spans only ${Math.round(range)} of 100, so the palette reads flat in black and white. ${after.filter((h, i) => changed(h, hexes[i])).length === 1 ? "Moving one color" : "Spreading it"} to ${Math.round(span)} gives it a clear dark and light.` }, after);
    else put("value", { need: (50 - range) / 2, title: "More dark and light" }, hexes);
  }
  // 3. calm all but one: several colors at full strength compete
  const loud = cs.filter(c => c.C > 45);
  if (k >= 3 && loud.length >= 2) {
    const lead = cs.reduce((a, b) => b.C > a.C ? b : a), after = cs.map(c => c === lead || c.C < 20 ? c.h : spMake(c.L, c.C * (1 - .5 * s), c.H));
    put("accent", { need: loud.length * 4, title: `Let ${nm(lead.h).toLowerCase()} lead`,
      why: `${loud.length} colors compete at full strength (chroma over 45). Calming the others lets one accent carry the palette.` }, after);
  }
  // 4. hues near a textbook scheme: nudge them onto it
  const sch = spScheme(hexes);
  if (sch.targets && sch.off > 4 && sch.off <= 30 && [...sch.targets.keys()].every(i => cs[i].C >= 18)) {
    const after = cs.map((c, i) => { if (!sch.targets.has(i)) return c.h; let d = sch.targets.get(i) - c.H; if (d > 180) d -= 360; if (d < -180) d += 360; return spMake(c.L, c.C, c.H + d * s); });
    put("scheme", { need: sch.off / 2, title: `Toward a ${sch.name}`,
      why: `The hues sit ${Math.round(sch.off)}° off a ${sch.name} on average (perceptual wheel). Rotating them ${s < 1 ? "partway " : ""}onto it makes the scheme exact.` }, after);
  }
  // 5. warm and cool pulling against each other: lean the minority toward the majority
  const warm = cs.filter(c => c.C >= 8 && spTemp(c.h) === "warm"), cool = cs.filter(c => c.C >= 8 && spTemp(c.h) === "cool");
  if (warm.length && cool.length && k >= 3 && warm.length !== cool.length) {
    const few = warm.length < cool.length ? warm : cool, pole = few === warm ? 250 : 45, word = few === warm ? "cool" : "warm";
    const after = cs.map(c => { if (!few.includes(c)) return c.h; let d = pole - c.H; if (d > 180) d -= 360; if (d < -180) d += 360; return spMake(c.L, c.C * (1 - .35 * s), c.H + Math.sign(d) * Math.min(Math.abs(d), 40 * s)); });
    put("temp", { need: 3, title: `One temperature: ${word}`,
      why: `${warm.length} warm and ${cool.length} cool. Leaning ${spList(few.map(c => nm(c.h).toLowerCase()))} toward ${word} and calming ${few.length === 1 ? "it" : "them"} lets the palette read as one temperature.` }, after);
  }
  // 6. the weakest color in painters' eyes: swap toward a color painters do pair with the rest
  if (ctx.swap) {
    const { i, lift, cand } = ctx.swap, c = cs[i], [L, A, B] = lab(c.h), [L2, A2, B2] = lab(cand.h), m = Math.min(1, .45 + .55 * s);
    const after = cs.map((x, j) => j === i ? labHex(L + (L2 - L) * m, A + (A2 - A) * m, B + (B2 - B) * m) : x.h);
    put("swap", { need: 5, title: `Swap ${nm(c.h).toLowerCase()}`,
      why: `${nm(c.h)} turns up with the rest less often than chance (${spTimes(lift)} in paintings, as photographed). Painters put ${cand.n.toLowerCase()} beside them ${spTimes(cand.l)} more often than chance.` }, after);
  }
  // 7. as a painter would: each color toward that painter's nearest habitual color
  if (ctx.painter && ctx.painter.cols && ctx.painter.cols.length) {
    const P = ctx.painter, moved = [];
    const after = cs.map(c => {
      let best = null, bd = 99; P.cols.forEach(([n, h]) => { const d = de2000(c.h, h); if (d < bd) { bd = d; best = h; } });
      if (!best || bd < 2 || bd > 25) return c.h;
      const [L, A, B] = lab(c.h), [L2, A2, B2] = lab(best), m = .3 + .6 * s; moved.push(c.h);
      return labHex(L + (L2 - L) * m, A + (A2 - A) * m, B + (B2 - B) * m);
    });
    if (moved.length) put("painter", { need: 2, title: `As ${P.name} would`,
      why: `${P.name} is the painter who uses this combination most here. Each color moves toward the nearest of the colors in most of ${P.name}'s ${P.n} paintings (as photographed).` }, after);
  }
  // recognizable: unless Bold, never rebuild the whole palette (every color moved, by about 15% on average or more)
  const remake = x => { const d = x.after.map((h, i) => de2000(h, hexes[i])); return s < 1 && !x.blocked && d.every(v => v >= .8) && d.reduce((a, b) => a + b, 0) / k > 15; };
  return out.filter(x => !remake(x)).sort((a, b) => b.need - a.need).slice(0, 4);
}

// ---------- the page ----------
function spPage(hexes, o = {}) {
  hexes = spCanon(hexes);
  if (hexes.length < 2) { if (typeof sxPick === "function") return sxPick(hexes[0] || "#5F8C8A"); return; }
  const k = hexes.length, pair = k === 2, path = spPath(hexes), key = "sp:" + path, names = hexes.map(spNm);
  if (o.push !== false && XSTACK[XSTACK.length - 1] !== key) XSTACK.push(key);
  // the set page does not keep the tray alive: opening it consumed the tray (js/settray.js sxOpen)
  const set = () => colorSet({ kind: "set", id: hexes.join("+"), title: spTitle(hexes), colors: hexes.map(h => ({ h, n: spNm(h) })), src: path });
  const plate = (h, other) => `<button class="sp-plate" data-swatch="${h}" style="--c:${h}" data-ink="${ink(h)}" aria-label="Open ${esc(spNm(h))}"><span class="sp-sample" style="color:${other}">Aa</span><b>${esc(spNm(h))}</b><em class="mono">${h}</em></button>`;
  // double-tap the swatches at the top to keep the palette (David, 2026-10-08): a single tap still opens that
  // color's page (js/swatch.js data-dbltap delays it ~280ms to listen for a second tap first). A heart burst at
  // the tap point, a haptic and a sound; no middle step, no toggle to miss.
  const heartBurst = (host, x, y) => {
    const r = host.getBoundingClientRect(), b = document.createElement("span");
    b.className = "sp-heart"; b.innerHTML = icon("heartOn", 72);
    b.style.left = (x - r.left) + "px"; b.style.top = (y - r.top) + "px";
    host.appendChild(b);
    b.addEventListener("animationend", () => b.remove());
    setTimeout(() => b.isConnected && b.remove(), 1200);
  };
  const el = show(`
    <header class="art-top"><button class="icon-btn glass" data-back aria-label="Back">${ICON.back}</button></header>
    <p class="eyebrow p-type">${pair ? "A pair" : k === 3 ? "A trio" : `A palette of ${k}`}</p>
    <h1 class="p-title sp-title${names.join("").length > 44 ? " longer" : names.join("").length > 24 ? " long" : ""}">${names.map((n, i) => `<button data-swatch="${hexes[i]}">${esc(n)}</button>`).join(`<span class="sp-plus">+</span>`)}</h1>
    ${o.undo ? `<div class="sp-undo" data-undo-bar><span>${esc(o.applied || "Changed")}.</span><button data-undo>Undo</button></div>` : ""}
    ${pair ? `<div class="sp-pair" data-dbltap>${plate(hexes[0], hexes[1])}${plate(hexes[1], hexes[0])}</div>`
      : `<div class="sp-strip" data-strip data-dbltap>${hexes.map(h => `<button data-swatch="${h}" style="--c:${h};flex:1" aria-label="${esc(spNm(h))}"></button>`).join("")}</div>
         <p class="sp-strip-cap" data-stripcap>Equal shares.</p>
         <div class="sp-names">${hexes.map((h, i) => `<span class="sp-name"><button data-swatch="${h}"><i style="--c:${h}"></i><b>${esc(names[i])}</b><em class="mono">${h}</em></button><button class="sp-drop" data-drop="${i}" aria-label="Remove ${esc(names[i])}">${SX_ICON_X}</button></span>`).join("")}</div>`}
    <p class="sp-lead" data-lead aria-live="polite">Reading the paintings…</p>
    <div class="sp-acts" data-acts></div>
    <section class="sp-sec"><h3>${pair ? "How they relate" : "How they work together"}</h3><div class="sp-facts">${(pair ? spPairFacts(hexes[0], hexes[1]) : spSetFacts(hexes, spScheme(hexes))).map(([t, s]) => `<div class="sp-fact"><b>${t}</b><p>${esc(s)}</p></div>`).join("")}</div></section>
    <section class="sp-sec" data-ptg><h3>Together in paintings</h3><p class="fine">Measuring…</p></section>
    ${pair ? "" : `<section class="sp-sec" data-pairs><h3>The pairs inside</h3><p class="fine">Measuring…</p></section>`}
    <section class="sp-sec" data-design hidden></section>
    <section class="sp-sec" data-looks hidden></section>
    ${k < 8 ? `<section class="sp-sec" data-complete><h3>${pair ? "Make it a trio" : "Complete the palette"}</h3><p class="fine">Looking…</p></section>` : ""}
    <section class="sp-sec" data-improve><div class="sp-imp-head"><h3>Improve</h3><div class="pt-seg" data-strength>${SP_STRENGTH.map(([key, t]) => `<button data-str="${key}" class="${key === SP_STR ? "on" : ""}">${t}</button>`).join("")}</div></div><div data-impbody></div></section>
    <p class="fine sp-fine">Paintings are measured pixel by pixel in the museums' own photographs of varnished paintings, so colors are as photographed and screen colors are approximate. A painting “holds” a color when something within 4% of it covers at least 1% of the canvas. “× chance” compares with the colors being scattered independently: a tendency in these photographs, not a rule of painting.</p>
  `, "article sp-page");
  el.querySelector("[data-back]").onclick = xBack;
  el.addEventListener("swatch-dbltap", e => {
    const was = (S.palettes || []).some(p => p.cols.join() === hexes.join());
    heartBurst(el, e.detail.x, e.detail.y);
    buzz(was ? 8 : [10, 30, 20]); if (typeof sfxChord === "function") sfxChord(hexes, { gap: .07 });
    keepPalette(hexes, pair ? "A pair" : `A palette of ${k}`);
    const kb = $("[data-acts] [data-cs=\"keep\"]"); if (kb) kb.querySelector("span").textContent = "Kept";
  });
  onKey = e => { if (e.key === "Escape") xBack(); };
  const $ = s => el.querySelector(s), my = ++SP_SEQ, live = () => my === SP_SEQ && el.isConnected;
  const acts = typeof csActions === "function" ? csActions(set, { only: ["learn", "keep", "share"] }) : document.createElement("div");
  if (k < 8) { const add = document.createElement("button"); add.className = "cs-act"; add.dataset.spAdd = ""; add.innerHTML = `${sv('<path d="M12 5v14M5 12h14"/>', 20, 1.8)}<span>Add a color</span>`; acts.appendChild(add); acts.style.setProperty("--n", (+acts.dataset.n || 3) + 1); }
  $("[data-acts]").replaceChildren(acts);
  try { document.title = `${spTitle(hexes)} · ColorHub`; } catch (e) {}

  const ctx = { swap: null, painter: null };
  const q = spPickQ(hexes), qNote = q.length < k ? ` Measured on its ${q.length} most distinct colors (${spList(q.map(spNm).map(s => s.toLowerCase()))}); the index takes five at a time.` : "";
  const facts = (label, items, f) => items && items.length ? `<div class="sp-fact"><b>${label}</b><p>${items.map(f).join(" · ")}</p></div>` : "";

  // ---- paintings: the pair (or set) together, the rail, who and when ----
  Promise.all([loadGallery().catch(() => null), spQuery(q, "paintings")]).then(async ([, res]) => {
    if (!live()) return;
    const looseNote = res.loose ? ` At the standard measure (within 4%, covering 1% of the canvas) ${res.strict ? `only ${res.strict} ${res.strict === 1 ? "painting holds" : "paintings hold"}` : "nothing holds"} ${pair ? "both" : "all of them"}, so this is measured loosely.` : "";
    const st = res.count ? await ciSetStats(res, q) : null;
    if (!live()) return;
    const box = $("[data-ptg]"), n = res.count, N = res.n, lift = res.lift;
    let lead;
    if (pair) lead = ciTakeaway(names[0], names[1], { count: n, lift, theory: ciTheory(hexes[0], hexes[1]), stats: st });
    else lead = ciFinding(q.map(spNm), res, st);
    $("[data-lead]").textContent = lead + looseNote + qNote;
    let big = n && lift != null && n >= SP_MIN_N && res.expected >= 1
      ? `<div class="sp-big"><b>${spTimes(lift)}</b><span>${lift >= 1.25 ? "more often than chance" : lift <= .8 ? "of what chance predicts: painters keep these apart" : "about as often as chance"}</span><em>${spNum(n)} of ${spNum(N)} paintings hold ${pair ? "both" : "all of them"}, about ${ciFmt(res.expected)} expected</em></div>`
      : `<p class="sp-say">${n ? `${n === 1 ? "One painting holds" : spNum(n) + " paintings hold"} ${pair ? "both" : "all of them"} out of ${spNum(N)}: too few to say anything about painters' habits.` : `Not one of ${spNum(N)} paintings holds ${pair ? "both" : "all of them"}, even measured loosely, so there is nothing to say about painters' habits.`}</p>`;
    if (res.loose && n) big += `<p class="sp-sub">Measured loosely: each within ${SP_LOOSE.tol}%, covering at least ${SP_LOOSE.minCover}% of the canvas.</p>`;
    let body = big;
    if (st && n >= 12) {
      body += `<div class="sp-facts">
        ${st.span ? `<div class="sp-fact"><b>Peak</b><p>${st.span[0] === st.span[1] - 9 ? "the " + st.span[0] + "s" : st.span[0] + " to " + st.span[1]}</p></div>` : ""}
        ${facts("Painters", st.painters.slice(0, 3), d => `<button class="sp-link" data-painter="${esc(d.label)}">${esc(d.label)}</button> ${d.hit} of ${d.total}`)}
        ${facts("Movements", st.movements.slice(0, 3), d => `${esc(d.label)} (${d.hit} of ${spNum(d.total)})`)}
        ${facts("Where", st.countries.slice(0, 2), d => `${esc(d.label)} (${d.hit} of ${spNum(d.total)})`)}
      </div>`;
    }
    if (n) body += `<div class="gl-rail sp-rail" data-rail>${res.rows.slice(0, 10).map(r => glPinHTML(r.i, { badge: `${ptPct(r.cover)} of the canvas${pair ? ", the lesser" : ", least of them"}` })).join("")}</div>
      <button class="btn ghost gl-all" data-all>See all ${spNum(n)} ${ICON.arrow}</button>`;
    if (n < 10) {
      const cl = await ciClosest(q, res, { max: 10 - n }).catch(() => null);
      if (!live()) return;
      if (cl && cl.rows.length) body += `<h4 class="sp-h4">Closest in the archive</h4><p class="sp-sub">${n ? "The nearest others" : "Nothing holds " + (pair ? "both" : "all of them") + " at this measure, so these come nearest"}, best first: how much of the canvas each holds, as photographed.</p>
      <div class="gl-rail sp-rail" data-rail3>${cl.rows.map(r => glPinHTML(r.i, { badge: ciNearWords(r) })).join("")}</div>${n ? "" : `<button class="btn ghost gl-all" data-all>See the closest ${ICON.arrow}</button>`}`;
    }
    // a set: the closest paintings as a palette, and the proportions painters used
    if (!pair) {
      const pal = await paintingsWith(q, { ...CI_STD, mode: "palette" }).catch(() => null);
      if (!live()) return;
      const good = pal ? pal.rows.filter(r => r.score >= .5) : [];
      if (good.length) body += `<h4 class="sp-h4">Closest as a palette</h4><p class="sp-sub">Paintings whose colors come nearest this palette as a whole, scored on how well every color is met.</p>
        <div class="gl-rail sp-rail" data-rail2>${good.slice(0, 10).map(r => glPinHTML(r.i, { badge: `${Math.round(r.score * 100)}% match` })).join("")}</div>`;
      const src = n >= SP_MIN_N ? res.rows.slice(0, 60) : good.slice(0, 30), shares = q.map((h, j) => src.length ? src.reduce((a, r) => a + r.covers[j], 0) / src.length : 0);
      if (src.length >= SP_MIN_N && q.length === k && shares.every(x => x > 0)) {
        const tot = shares.reduce((a, b) => a + b, 0);
        $("[data-strip]").innerHTML = hexes.map((h, j) => { const f = shares[j] / tot; return `<button data-swatch="${h}" style="--c:${h};flex:${Math.max(f, .08).toFixed(3)}" aria-label="${esc(spNm(h))}: ${Math.round(f * 100)}%"><span data-ink="${ink(h)}">${f < .01 ? "<1" : Math.round(f * 100)}%</span></button>`; }).join("");
        $("[data-stripcap]").textContent = `At the proportions painters used: the average share of each in the ${src.length} ${n >= SP_MIN_N ? "paintings that hold all of them" : "closest paintings"}, as photographed.`;
      }
    }
    box.innerHTML = `<h3>Together in paintings</h3>${body}`;
    box.querySelectorAll("[data-rail],[data-rail2],[data-rail3]").forEach(glFill);
    box._rows = res.rows; box._res = res;
    // the top painter, for "as they would"
    const P = st && st.painters[0];
    if (P && P.hit >= 4) { if (!PT_PAINTERS) PT_PAINTERS = fetch("data/colorindex/painters.json").then(r => r.ok ? r.json() : {}).catch(() => ({})); const all = await PT_PAINTERS; const pp = all && all[P.label]; if (pp && pp.c && pp.c.length) { ctx.painter = { name: P.label, n: pp.n, cols: pp.c }; if (live()) improve(); } }
  }).catch(() => { if (live()) { $("[data-ptg]").innerHTML = `<h3>Together in paintings</h3><p class="fine">The paintings didn't load. <button class="wl" data-retry>Try again</button></p>`; $("[data-lead]").textContent = ""; } });

  // ---- a set: every pair inside, strongest and weakest ----
  if (!pair) {
    const pairs = []; for (let i = 0; i < q.length; i++) for (let j = i + 1; j < q.length; j++) pairs.push([q[i], q[j]]);
    Promise.all(pairs.map(([a, b]) => spQuery([a, b], "paintings").then(r => ({ a, b, n: r.count, lift: r.lift, e: r.expected, loose: !!r.loose })))).then(list => {
      if (!live()) return;
      const ok = list.filter(x => x.lift != null && x.n >= SP_MIN_N && x.e >= 1).sort((x, y) => y.lift - x.lift);
      const strong = ok[0], weak = ok.length > 1 ? ok[ok.length - 1] : null;
      const row = x => `<button class="sp-prow" data-pair="${x.a}+${x.b}"><span class="sp-psw"><i style="--c:${x.a}"></i><i style="--c:${x.b}"></i></span><span class="sp-pt"><b>${esc(spNm(x.a))} + ${esc(spNm(x.b).toLowerCase())}</b><small>${x.lift != null && x.n >= SP_MIN_N && x.e >= 1 ? `${spTimes(x.lift)} chance · ${spNum(x.n)} paintings` : x.n ? `${x.n} ${x.n === 1 ? "painting" : "paintings"}, too few to say` : "no painting holds both"}${x.loose ? " (measured loosely)" : ""}${x === strong ? " · the strongest" : x === weak ? " · the weakest" : ""}</small></span>${ICON.arrow}</button>`;
      const sorted = [...ok, ...list.filter(x => !ok.includes(x))];
      $("[data-pairs]").innerHTML = `<h3>The pairs inside</h3><p class="sp-sub">${strong && weak ? `${esc(spNm(strong.a))} with ${esc(spNm(strong.b).toLowerCase())} holds this palette together in paintings; ${esc(spNm(weak.a).toLowerCase())} with ${esc(spNm(weak.b).toLowerCase())} is the loosest link.` : "How often painters put each two of them together."}</p><div class="sp-plist">${sorted.map(row).join("")}</div>`;
      // the weakest member: lowest average lift with the others, below chance
      const mean = q.map(h => { const m = ok.filter(x => x.a === h || x.b === h); return m.length ? m.reduce((t, x) => t + x.lift, 0) / m.length : null; });
      let wi = -1; mean.forEach((v, i) => { if (v != null && v < .9 && (wi < 0 || v < mean[wi])) wi = i; });
      if (wi >= 0 && q.length >= 3) {
        const rest = q.filter((_, i) => i !== wi);
        spAffinityCands(rest, hexes).then(c => { if (!live() || !c.length) return; ctx.swap = { i: hexes.indexOf(q[wi]), lift: mean[wi], cand: c[0] }; improve(); });
      }
    }).catch(() => { if (live()) $("[data-pairs]").innerHTML = `<h3>The pairs inside</h3><p class="fine">Couldn't measure the pairs just now.</p>`; });
  }

  // ---- design history ----
  spQuery(q, "design").then(async res => {
    if (!live() || !res.n) return;
    const box = $("[data-design]"), n = res.count, item = n === 1 ? "design piece" : "design pieces";
    const st = n >= 12 ? await ciSetStats(res, q).catch(() => null) : null;
    if (!live()) return;
    const pin = CI_SOURCES.design.pin;
    box.hidden = false;
    box.innerHTML = `<h3>In design</h3><p class="sp-say">${n ? `${spNum(n)} of ${spNum(res.n)} ${item} in the design-history archive (posters, textiles, ceramics, product design…) hold ${pair ? "both" : "all of them"}${res.loose ? ` (measured loosely, within ${SP_LOOSE.tol}%)` : ""}${res.lift != null && n >= SP_MIN_N && res.expected >= 1 ? `, ${spTimes(res.lift)} what chance predicts` : n < SP_MIN_N ? ": too few to call a habit" : ""}.` : `None of the ${spNum(res.n)} pieces in the design-history archive hold ${pair ? "both" : "all of them"}, even measured loosely.`}${st && st.span ? ` Most at home ${st.span[0] === st.span[1] - 9 ? "in the " + st.span[0] + "s" : "between " + st.span[0] + " and " + st.span[1]}.` : ""}</p>
      ${n && pin ? `<div class="gl-rail sp-rail sp-drail">${res.rows.slice(0, 8).map(r => `<div class="sp-dtile">${pin(r)}</div>`).join("")}</div>` : ""}`;
  }).catch(() => {});

  // ---- closest looks (art movements, design eras, film, fashion and internet looks) ----
  if (typeof lkWhen === "function") lkWhen(() => {
    if (!live()) return;
    const m = lookMatch(hexes).filter(x => x.score >= 45);
    if (!m.length) return;
    const box = $("[data-looks]"); box.hidden = false;
    box.innerHTML = `<h3>Closest looks</h3><p class="sp-sub">Styles whose palettes come nearest, from art movements to film and fashion looks.</p>
      <div class="sp-plist">${m.map(x => `<button class="sp-prow" data-lk="${esc(x.id)}" data-lkp="${x.pi}">${lkStripes(x.look.pals[x.pi].c, "sp-lkstr")}<span class="sp-pt"><b>${esc(x.name)}</b><small>${esc(x.palette)} · ${x.score}% match</small></span>${ICON.arrow}</button>`).join("")}</div>`;
  });

  // ---- complete the palette ----
  if (k < 8) spComplete(hexes, q).then(sug => {
    if (!live()) return;
    const box = $("[data-complete]"); if (!box) return;
    const card = s => `<button class="sp-prow" data-addhex="${s.h}"><span class="sp-psw sp-psw-n">${hexes.map(h => `<i style="--c:${h}"></i>`).join("")}<i class="new" style="--c:${s.h}"></i></span><span class="sp-pt"><b>+ ${esc(s.n)}</b><small>${esc(s.why)}</small></span>${ICON.arrow}</button>`;
    box.innerHTML = `<h3>${pair ? "Make it a trio" : "Complete the palette"}</h3>${sug.length ? `<div class="sp-plist">${sug.map(card).join("")}</div>` : `<p class="fine">Nothing measurable to suggest. Add any color you like.</p>`}`;
  });

  // ---- improve ----
  let shown = [], LOCKS = {};
  // how one color changed, in words: "Teal → slightly lighter teal (+8% lightness)"
  const chgLine = (a, b) => {
    const [L1, A1, B1] = lab(a), [L2, A2, B2] = lab(b), c1 = Math.hypot(A1, B1), c2 = Math.hypot(A2, B2);
    const [, , h1] = lch(a), [, , h2] = lch(b);
    let dh = h2 - h1; if (dh > 180) dh -= 360; if (dh < -180) dh += 360;
    const dL = L2 - L1, dC = c1 > 4 ? (c2 - c1) / c1 * 100 : 0, dH = c1 > 8 ? dh : 0;
    const axes = [[Math.abs(dL), dL > 0 ? "lighter" : "darker", `${dL > 0 ? "+" : "\u2212"}${Math.abs(Math.round(dL))}% lightness`],
      [Math.abs(dC) * .5, dC > 0 ? "more vivid" : "softer", `${dC > 0 ? "+" : "\u2212"}${Math.abs(Math.round(dC))}% vividness`],
      [Math.abs(dH) * .4, dH > 0 ? "warmer" : "cooler", `${Math.abs(Math.round(dH))}\u00B0 of hue`]].sort((x, y) => y[0] - x[0]);
    const top = axes[0], n1 = spNm(a), n2 = spNm(b);
    return `${esc(n1)} \u2192 ${n1 === n2 ? `slightly ${top[1]} ${esc(n1.toLowerCase())}` : `${esc(n2.toLowerCase())}`} <em>${top[2]}</em>`;
  };
  const LOCK_ON = sv('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>', 16, 1.8), LOCK_OFF = sv('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 017.6-1.7"/>', 16, 1.8);
  function improve() {
    if (!live()) return;
    const s = SP_STRENGTH.find(x => x[0] === SP_STR)[2];
    shown = spImprove(hexes, s, ctx, LOCKS);
    // the After strip: the changed colors lit, the rest stepped back
    const strip = (cols, was) => `<span class="sp-istrip${was ? " after" : ""}">${cols.map((h, i) => `<i style="--c:${h}"${was && de2000(h, was[i]) >= .8 ? ` class="moved"` : ""}></i>`).join("")}</span>`;
    $("[data-impbody]").innerHTML = shown.length ? shown.map((x, j) => {
      const ch = x.after.map((h, i) => [hexes[i], h]).filter(([a, b]) => de2000(a, b) >= .8), lock = LOCKS[x.id] || new Set();
      const sel = `<div class="sp-sel" role="group" aria-label="Which colors may change">${hexes.map((h, i) => `<button class="sp-lk${lock.has(i) ? " on" : ""}" data-lock="${x.id}:${i}" aria-pressed="${lock.has(i)}" aria-label="${lock.has(i) ? "Unlock" : "Keep"} ${esc(spNm(h))}"><i style="--c:${h}"></i>${esc(spNm(h))}${lock.has(i) ? LOCK_ON : LOCK_OFF}</button>`).join("")}</div>
        <p class="sp-selnote">${lock.size ? "Locked colors stay as they are." : ch.length === 1 ? `Changes just one color. Tap a color to keep it.` : "Changes as few colors as it can. Tap a color to keep it."}</p>`;
      return `<div class="sp-imp${x.blocked ? " blocked" : ""}">
        <div class="sp-imp-t"><b>${esc(x.title)}</b>${x.blocked ? "" : `<button class="sp-apply" data-apply="${j}">Apply</button>`}</div>
        <p>${esc(x.why)}</p>
        ${x.blocked ? "" : `<div class="sp-ba"><span>Now</span>${strip(hexes)}<span>After</span>${strip(x.after, hexes)}</div>
        <ul class="sp-chg">${ch.map(([a, b]) => `<li><button data-swatch="${a}"><i style="--c:${a}"></i></button><button data-swatch="${b}"><i style="--c:${b}"></i></button> ${chgLine(a, b)}</li>`).join("")}</ul>`}
        ${sel}
      </div>`;
    }).join("") : `<p class="sp-say">Nothing the numbers call for: the colors are distinct, the lightness range is wide, and nothing competes. It's a sound palette as it stands.</p>`;
  }
  improve();

  // ---- taps ----
  el.addEventListener("click", e => {
    const g = e.target.closest("[data-gi]");
    if (g) { const r = ($("[data-ptg]")._rows || []).find(x => x.i === +g.dataset.gi), weakest = r && r.covers ? q[r.covers.indexOf(Math.min(...r.covers))] : q[0]; return galleryPage(+g.dataset.gi, true, weakest, CI_STD.tol); }
    if (e.target.closest("[data-all]")) { const o2 = ($("[data-ptg]")._res || {}).o || CI_STD; return paintingsOfPage(q, { tol: o2.tol, minCover: o2.minCover, mode: "all", sort: "cover", source: "paintings", maxCover: null, names: q.map(spNm) }); }
    const pr = e.target.closest("[data-pair]"); if (pr) { buzz(6); return spPage(pr.dataset.pair.split("+")); }
    const pa = e.target.closest("[data-painter]"); if (pa && typeof awPainter === "function") { buzz(5); return awPainter(routeSlug(pa.dataset.painter)); }
    const lk = e.target.closest("[data-lk]"); if (lk && typeof lkOpen === "function") { buzz(5); return lkOpen(lk.dataset.lk, { pi: +lk.dataset.lkp, back: () => spPage(hexes, { push: false }) }); }
    const ad = e.target.closest("[data-addhex]"); if (ad) { buzz(8); return spPage([...hexes, ad.dataset.addhex]); }
    if (e.target.closest("[data-sp-add]")) { e.stopPropagation(); buzz(5); return sxPick(hexes[hexes.length - 1], { title: spTitle(hexes), onPick: h => spPage([...hexes, h]) }); }
    const dr = e.target.closest("[data-drop]"); if (dr) { buzz(6); const left = hexes.filter((_, i) => i !== +dr.dataset.drop); ROUTE_REPLACE = true; return spPage(left, { push: false, undo: hexes, applied: `Removed ${spNm(hexes[+dr.dataset.drop]).toLowerCase()}` }); }
    const lkb = e.target.closest("[data-lock]");
    if (lkb) { const [id, i] = lkb.dataset.lock.split(":"), set = LOCKS[id] || (LOCKS[id] = new Set()); set.has(+i) ? set.delete(+i) : set.add(+i); buzz(5); const y = scrollY; improve(); scrollTo(0, y); return; }
    const sb = e.target.closest("[data-str]"); if (sb) { SP_STR = sb.dataset.str; el.querySelectorAll("[data-str]").forEach(b => b.classList.toggle("on", b === sb)); buzz(4); return improve(); }
    const ap = e.target.closest("[data-apply]"); if (ap) { const x = shown[+ap.dataset.apply]; if (!x) return; buzz(10); ROUTE_REPLACE = true; scrollTo(0, 0); return spPage(x.after, { push: false, undo: hexes, applied: `Applied: ${x.title.charAt(0).toLowerCase() + x.title.slice(1)}` }); }
    if (e.target.closest("[data-undo]")) { buzz(6); ROUTE_REPLACE = true; return spPage(o.undo, { push: false }); }
    if (e.target.closest("[data-retry]")) { ROUTE_REPLACE = true; return spPage(hexes, { push: false }); }
  });
  return el;
}

// the standard measure first (CI_STD: within 4%, 1% of the canvas); under SP_MIN_N matches, a looser one, said so
const SP_LOOSE = { tol: 8, minCover: .5 };
async function spQuery(q, source) {
  const res = await paintingsWith(q, { ...CI_STD, source });
  if (res.count >= SP_MIN_N || !res.n) return res;
  const lo = await paintingsWith(q, { ...CI_STD, ...SP_LOOSE, source }).catch(() => null);
  if (!lo || lo.count <= res.count) return res;
  lo.loose = true; lo.strict = res.count;
  return lo;
}

// painters' companions for a group of colors (the affinity table), not already in the set: [{ h, n, l, k, m }]
// m = how many of the group list it; ranked by m, then the mean lift
function spAffinityCands(group, have) {
  return Promise.all(group.map(h => ciAffinity(nameOf(h).n).catch(() => null))).then(affs => {
    const m = new Map();
    affs.forEach(a => (a && a.c || []).forEach(([n, h, k, l]) => {
      if (k < 5 || have.some(x => de2000(x, h) < 8)) return;
      const e = m.get(n) || { n, h, m: 0, l: 0, k: 0 }; e.m++; e.l += l; e.k += k; m.set(n, e);
    }));
    return [...m.values()].map(e => ({ ...e, l: e.l / e.m })).sort((a, b) => b.m - a.m || b.l - a.l).slice(0, 6);
  });
}
// "complete the palette": painters' choice (checked live against the index) and theory's choice (the biggest gap)
async function spComplete(hexes, q) {
  const out = [];
  try {
    const cands = await spAffinityCands(q, hexes);
    const base = q.slice(0, SP_Q - 1);
    const checked = await Promise.all(cands.slice(0, 4).map(c => paintingsWith([...base, c.h], { ...CI_STD }).then(r => ({ ...c, n: c.n, cnt: r.count, lift: r.lift, e: r.expected })).catch(() => null)));
    checked.filter(c => c && c.cnt >= SP_MIN_N && c.lift != null && c.lift > 1 && c.e >= 1).sort((a, b) => b.lift - a.lift).slice(0, 2)
      .forEach(c => out.push({ h: c.h, n: c.n, why: `Painters' choice: ${spNum(c.cnt)} paintings hold it with ${base.length === hexes.length ? "all of these" : "the others"}, ${spTimes(c.lift)} chance.` }));
  } catch (e) {}
  // theory: the middle of the biggest empty arc of hue, at the lightness the set lacks most
  const lc = hexes.map(h => lch(h)), ch = lc.filter(x => x[1] >= 12);
  const Ls = lc.map(x => x[0]).sort((a, b) => a - b), gaps = [[Ls[0] - 8, 8 + Ls[0] / 2], ...Ls.slice(1).map((L, i) => [L - Ls[i], (L + Ls[i]) / 2]), [96 - Ls[Ls.length - 1], (96 + Ls[Ls.length - 1]) / 2]];
  const Lnew = clamp(gaps.sort((a, b) => b[0] - a[0])[0][1], 12, 90);
  let Hnew, Cnew;
  if (ch.length) {
    const hs = ch.map(x => x[2]).sort((a, b) => a - b); let gap = -1, mid = 0;
    hs.forEach((h, i) => { const prev = i ? hs[i - 1] : hs[hs.length - 1] - 360, g = h - prev; if (g > gap) { gap = g; mid = prev + g / 2; } });
    Hnew = mid; Cnew = ch.map(x => x[1]).sort((a, b) => a - b)[Math.floor(ch.length / 2)];
  } else { Hnew = 60; Cnew = 40; }
  const th = spMake(Lnew, Cnew, Hnew);
  if (!hexes.some(h => de2000(h, th) < 8) && !out.some(x => de2000(x.h, th) < 8)) out.push({ h: th, n: spNm(th), why: ch.length ? `Theory's choice: fills the biggest gap on the wheel and in lightness (${Math.round(Lnew)} of 100).` : "Theory's choice: one color to lift a palette of neutrals." });
  return out;
}
