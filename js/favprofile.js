"use strict";
// Your taste profile (lane L23): plain findings about the colors you love, each with its honest n, and the painter
// whose palette sits closest to them. "Your loves" are the top third of your order (at least three colors); once you
// have ranked, the bottom third is the comparison group, the same number of colors on each side (the equal-count rule
// js/tastemodel.js uses for palettes: compare like with like). Reference values (median chroma and lightness, how many
// named colors are warm) come from the named-color library, not from a made-up norm.
//   favTaste()      the screen (#/favorites/taste)
//   fpHeadline()    "You lean muted and cool."      fpCardLine()  the same for the share card

let FP_POP = null, FP_ARTISTS = null;
const fpMed = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 0; };
const fpPct = v => Math.round(v * 100);
// the named colors every finding is measured against
function fpPop() {
  const src = typeof CORE_NAMES !== "undefined" && CORE_NAMES && CORE_NAMES.length > 300 ? CORE_NAMES : EVERY();
  if (FP_POP && FP_POP.k === src.length) return FP_POP;
  const lc = src.map(c => lch(c.h)), col = lc.filter(x => x[1] >= 10);
  FP_POP = { k: src.length, n: src.length, medC: fpMed(lc.map(x => x[1])), medL: fpMed(lc.map(x => x[0])), maxC: Math.max(60, ...lc.map(x => x[1])), cool: col.filter(x => fpCool(x[2])).length / (col.length || 1), warm: col.filter(x => fpWarm(x[2])).length / (col.length || 1) };
  return FP_POP;
}
const fpWarm = H => H < 100 || H >= 340;
const fpCool = H => H >= 170 && H <= 300;
const fpWhy = () => { const n = fvCount(), ch = fvChoices("all"); return `${n} colors${ch ? ` and ${ch} choices` : ""}`; };

// everything the screen and the one-line headline need
function fpRead() {
  const order = fvOrder("all"), n = order.length, pop = fpPop(), ranked = fvChoices("all") > 0;
  const k = Math.max(3, Math.round(n / 3)), loves = order.slice(0, Math.min(k, n)), lows = ranked && n >= 9 ? order.slice(-loves.length) : [];
  const P = loves.map(h => ({ h, n: fvStore()[h].n, L: lch(h)[0], C: lch(h)[1], H: lch(h)[2] }));
  const share = f => P.filter(f).length / P.length;
  const quiet = share(p => p.C < pop.medC), dark = share(p => p.L < pop.medL);
  const colorful = P.filter(p => p.C >= 10), cool = colorful.length ? colorful.filter(p => fpCool(p.H)).length / colorful.length : 0, warm = colorful.length ? colorful.filter(p => fpWarm(p.H)).length / colorful.length : 0;
  const tend = [];   // what you lean toward, strongest first
  if (Math.abs(quiet - .5) >= .15) tend.push({ s: Math.abs(quiet - .5), w: quiet > .5 ? "muted" : "vivid" });
  if (Math.abs(dark - .5) >= .15) tend.push({ s: Math.abs(dark - .5), w: dark > .5 ? "deep" : "light" });
  if (colorful.length >= 3 && Math.max(cool, warm) >= .6) tend.push({ s: Math.max(cool, warm) - .5, w: cool > warm ? "cool" : "warm" });
  tend.sort((a, b) => b.s - a.s);
  return { order, n, ranked, loves, lows, P, pop, quiet, dark, cool, warm, colorful, tend: tend.slice(0, 2).map(t => t.w) };
}
function fpHeadline() {
  if (fvCount() < 3) return "";
  const r = fpRead();
  if (!r.tend.length) return "Your taste has no single lean: it spans quiet and strong, light and dark.";
  return `You lean ${r.tend.join(" and ")}.`;
}
function fpCardLine() {
  const h = fpHeadline(), p = FP_ARTISTS && FP_ARTISTS.best;
  return h ? (p ? `${h.replace(/\.$/, "")}, and a little ${p.n.split(" ").slice(-1)[0]}.` : h) : `${fvCount()} colors I love.`;
}

// ---------- the painters ----------
function fpArtists() {
  if (FP_ARTISTS && FP_ARTISTS.list) return Promise.resolve(FP_ARTISTS.list);
  return (FP_ARTISTS && FP_ARTISTS.p) || ((FP_ARTISTS = FP_ARTISTS || {}).p = fetch("data/analysis/artist-taste.json").then(r => { if (!r.ok) throw 0; return r.json(); }).then(l => (FP_ARTISTS.list = l)).catch(() => (FP_ARTISTS.p = null, [])));
}
// the painters nearest your loves: how far each of your top colors is from the nearest color in their palette, and the other
// way round (weighted by how much canvas each of theirs covers). Eight against eight.
function fpMatch(list, loves) {
  const mine = loves.slice(0, 8), K = mine.length;
  if (K < 3) return [];
  const pool = list.filter(a => a.cols && a.cols.length >= 4), big = pool.filter(a => a.k >= 12);   // a painter measured over 12+ paintings, if there are enough
  return (big.length >= 40 ? big : pool).map(a => {
    const theirs = a.cols.slice(0, 8), near = theirs.filter(c => c[1] >= .02);
    const d1 = mine.reduce((s, h) => s + Math.min(...near.map(c => de2000(h, c[0]))), 0) / K;
    const tot = near.reduce((s, c) => s + c[1], 0) || 1, d2 = near.reduce((s, c) => s + c[1] * Math.min(...mine.map(h => de2000(c[0], h))), 0) / tot;
    const twins = mine.filter(h => Math.min(...near.map(c => de2000(h, c[0]))) <= 10).length;
    return { a, d: (d1 + d2) / 2, twins, K };
  }).sort((x, y) => x.d - y.d).slice(0, 4);
}

// ---------- the pieces ----------
const fpStrip = (cols, cls = "") => `<span class="fp-strip ${cls}">${cols.map(h => `<i style="--c:${h}" data-swatch="${h}"></i>`).join("")}</span>`;
// a dot for each love along one measure, and a tick for the typical named color
function fpDots(vals, max, med, lo, hi) {
  return `<div class="fp-dots"><span class="fp-med" style="left:${(med / max * 100).toFixed(1)}%"><em>typical</em></span>${vals.map(([h, v], i) => `<i style="--c:${h};left:${Math.min(98, Math.max(2, v / max * 100)).toFixed(1)}%;--j:${(i % 3) - 1}" data-swatch="${h}"></i>`).join("")}</div>
    <div class="fp-ends"><span>${lo}</span><span>${hi}</span></div>`;
}
function fpFinds(r) {
  const n = r.P.length, cnt = f => r.P.filter(f).length, out = [];
  const nq = cnt(p => p.C < r.pop.medC), nd = cnt(p => p.L < r.pop.medL);
  out.push({ t: r.quiet >= .65 ? "Muted more than vivid" : r.quiet <= .35 ? "Vivid more than muted" : "Quiet and strong, both",
    p: `${nq} of your ${n} loves (${fpPct(r.quiet)}%) are quieter than the median named color. The typical named color has a chroma of ${r.pop.medC.toFixed(0)}.`,
    v: fpDots(r.P.map(p => [p.h, p.C]), Math.max(r.pop.medC * 2, 1.15 * Math.max(...r.P.map(p => p.C))), r.pop.medC, "Quieter", "Stronger") });
  out.push({ t: r.dark >= .65 ? "Deeper than most" : r.dark <= .35 ? "Lighter than most" : "A spread of light and deep",
    p: `${nd} of your ${n} loves (${fpPct(r.dark)}%) are darker than the median named color, which sits at a lightness of ${r.pop.medL.toFixed(0)} out of 100.`,
    v: fpDots(r.P.map(p => [p.h, p.L]), 100, r.pop.medL, "Darker", "Lighter") });
  if (r.colorful.length >= 3) {
    const c = r.colorful, nc = c.filter(p => fpCool(p.H)).length, nw = c.filter(p => fpWarm(p.H)).length, nb = c.length - nc - nw;
    const avg = f => { const l = c.filter(f); return l.length ? l[0].h : "#777"; };
    const seg = (cnt, f, label) => { if (!cnt) return ""; const col = avg(f); return `<i style="flex:${cnt};--c:${col}" data-ink="${ink(col)}"><b>${label}</b></i>`; };
    out.push({ t: r.cool >= .6 ? "Cool leaning" : r.warm >= .6 ? "Warm leaning" : "Warm and cool in balance",
      p: `Of your ${c.length} colorful loves, ${nc} are cool (blues, teals), ${nw} warm (reds, oranges, yellows)${nb ? ` and ${nb} in between` : ""}. Across all named colors, about ${fpPct(r.pop.cool)}% are cool and ${fpPct(r.pop.warm)}% warm.`,
      v: `<div class="fp-split">${seg(nc, p => fpCool(p.H), "Cool " + nc)}${seg(nb, p => !fpCool(p.H) && !fpWarm(p.H), nb)}${seg(nw, p => fpWarm(p.H), "Warm " + nw)}</div>` });
  }
  // families, among everything you hearted
  const fams = {}; r.order.forEach(h => { const f = setFamily(h); (fams[f] = fams[f] || []).push(h); });
  const fl = Object.entries(fams).sort((a, b) => b[1].length - a[1].length).slice(0, 4), tot = r.order.length;
  out.push({ t: `${fl[0][0]} come first`, p: `${fl.map(([f, l]) => `${f.toLowerCase()} ${l.length}`).join(", ")} of your ${tot} hearted colors.`,
    v: `<div class="fp-fams">${fl.map(([f, l]) => `<div><span>${f}</span><i style="--c:${l[0]};width:${(l.length / fl[0][1].length * 100).toFixed(0)}%"></i><b class="mono">${l.length}</b></div>`).join("")}</div>` });
  // your top third against your bottom third, the same number of colors each
  if (r.lows.length >= 3) {
    const m = (l, i) => l.reduce((s, h) => s + lch(h)[i], 0) / l.length, dL = m(r.loves, 0) - m(r.lows, 0), dC = m(r.loves, 1) - m(r.lows, 1);
    const big = Math.abs(dL) >= Math.abs(dC) * 1.2 ? ["lighter", "darker", Math.abs(dL), "points of lightness"] : ["stronger", "quieter", Math.abs(dC), "points of chroma"];
    const dir = (Math.abs(dL) >= Math.abs(dC) * 1.2 ? dL : dC) > 0 ? big[0] : big[1];
    if (big[2] >= 4) out.push({ t: `What separates your top from your bottom`, p: `Your top ${r.loves.length} are on average ${big[2].toFixed(0)} ${big[3]} ${dir} than your bottom ${r.lows.length}. Same number of colors on each side.`,
      v: `<div class="fp-vs">${fpStrip(r.loves.slice(0, 6))}<span>top</span>${fpStrip(r.lows.slice(0, 6))}<span>bottom</span></div>` });
  }
  return out;
}

// ======================================================================
// the screen
// ======================================================================
function favTaste() {
  XSTACK = ["favs-taste"];
  if (fvCount() < 3) { toast("Heart at least 3 colors for a reading"); return favShelf(); }
  const go2 = () => Promise.all([typeof loadCoreNames === "function" ? loadCoreNames() : 0, fpArtists()]).then(([, list]) => draw(list));
  show(`<div class="fv-wait"><i></i><i></i><i></i></div>`, "fv fv-prof");
  return go2();
  function draw(list) {
    const r = fpRead(), top5 = r.order.slice(0, 5), ranked = r.ranked, conf = fvConf("all");
    const finds = fpFinds(r), match = fpMatch(list, r.loves), best = match[0];
    if (best) { FP_ARTISTS = FP_ARTISTS || {}; FP_ARTISTS.best = best.a; }
    const small = r.n < 12 || (ranked && conf < .5);
    const used = fvCtxUsed();
    const ctxHTML = used.length ? `<section class="fp-find"><h3 class="title-3">It depends what it's for</h3>
      <p>Taste shifts with the job. Your first pick in each:</p>
      <div class="fp-ctx">${["all", ...used].map(c => { const k = fvOrder(c)[0]; return `<button data-swatch="${k}" data-ink="${ink(k)}" style="--c:${k}"><em>${FV_CTX.find(x => x[0] === c)[1]}</em><b>${esc(fvStore()[k].n)}</b></button>`; }).join("")}</div></section>` : "";
    const painter = best ? `
      <div class="sec-head"><b>Your painter</b><span>closest palette</span></div>
      <section class="fp-painter">
        <h2 class="title-2">${esc(best.a.n)}</h2>
        <div class="fp-pair"><div>${fpStrip(r.loves.slice(0, 8))}<span>You</span></div><div>${fpStrip(best.a.cols.slice(0, 8).map(c => c[0]))}<span>${esc(best.a.n.replace(/\s*\([^)]*\)\s*$/, "").split(" ").slice(-1)[0])}</span></div></div>
        <p>${best.twins} of your top ${best.K} have a near twin in this palette, measured over ${best.a.k} paintings. ${match.length > 1 ? `Also near: ${match.slice(1, 4).map(m => esc(m.a.n)).join(", ")}.` : ""}</p>
        ${best.a.typ ? `<button class="fp-ptg" data-gi="${best.a.typ.gi}"><img src="${esc(best.a.typ.img)}" alt="" loading="lazy"><span><b>${esc(best.a.typ.t)}</b><small>Their most typical painting</small></span>${ICON.chev}</button>` : ""}
      </section>` : "";
    const el = show(`
      <header class="art-top"><button class="icon-btn glass" data-back aria-label="Back">${ICON.back}</button><button class="glass-pill" data-share>${ICON.share}<span>Share</span></button></header>
      <h1 class="title-1 fp-title">Your <em>taste</em></h1>
      <p class="lead fp-lead">${esc(fpHeadline())}</p>
      <p class="note fp-n">From ${esc(fpWhy())}.${small ? " A small sample, so read it as a sketch. It firms up as you rank." : ""}</p>
      <div class="fv-top5 fp-top5" style="--n:${Math.max(1, top5.length - 1)}">${top5.map((k, i) => `<button class="fv-plate" data-swatch="${k}" data-ink="${ink(k)}" style="--c:${k}"><em>${i + 1}</em><b>${esc(fvStore()[k].n)}</b></button>`).join("")}</div>
      <button class="btn fp-pal" data-pal>Make a palette <small>your top ${top5.length}</small>${ICON.arrow}</button>
      ${finds.map(f => `<section class="fp-find"><h3 class="title-3">${esc(f.t)}</h3><p>${esc(f.p)}</p>${f.v}</section>`).join("")}
      ${ctxHTML}
      ${painter}
      <p class="fine fp-fine">Measured from the colors you hearted, against the library of about 1,000 named colors. Painters' palettes come from photographs of varnished paintings, so their colors are as photographed, and screen colors are approximate.</p>
    `, "fv fv-prof");
    el.querySelector("[data-back]").onclick = () => favShelf();
    onKey = e => { if (e.key === "Escape") favShelf(); };
    el.querySelector("[data-share]").onclick = () => fvShare();
    el.querySelector("[data-pal]").onclick = () => { buzz(8); fvMakePalette(r.order); };
    const g = el.querySelector("[data-gi]"); if (g) g.onclick = () => { XSTACK = ["favs-taste"]; galleryPage(+g.dataset.gi); };
    return el;
  }
}
