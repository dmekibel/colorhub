"use strict";
// Looks: visual styles (art movements, design eras, film looks, internet aesthetics). Data: data/looks.js (window.LOOKS).
// Each look has several named palettes, so a look is a family of palettes, not one strip.
//  - lkSections(): the Looks section at the top of Explore > Ideas (plus "Your closest looks" after the palette taste test)
//  - lkOpen(id): the look page
//  - lookMatch(hexes, shares?): "What look is this?" -> top 3 looks with a 0-100 similarity
//  - lkHook(el, colsNow, p): the one-line hook in the Studio palette view
//  - lkRowInto(box, color): the "In looks" row on a color page (js/passages.js archiveRows calls it)
// All top-level names start with lk (plain scripts share one global scope), except lookMatch.
// data/looks.js (91 KB) is lazy (js/loader.js loadData), never in index.html: every entry point waits for it with lkWhen().

DATA_SRC.looks = "data/looks.js";   // not part of WIKI_FILES (that list was fixed when loader.js ran)
const lkWhen = fn => window.LOOKS ? fn() : loadData("looks").then(ok => { if (ok) fn(); });

const LK_CATS = [["art", "Art movements"], ["design", "Design eras"], ["film", "Film and photo"], ["net", "Internet aesthetics"]];
const LK_CAT_ONE = { art: "Art movement", design: "Design era", film: "Film and photo look", net: "Internet aesthetic" };
const lkAll = () => window.LOOKS || [];
const lkGet = id => lkAll().find(l => l.id === id) || null;
const lkStripes = (cols, cls = "lkx-str") => `<span class="${cls}">${cols.map(c => `<i style="--c:${c[0]};flex:${Math.max(c[2], .05)}"></i>`).join("")}</span>`;

// ---------- palette distance ----------
// A palette is [{L: lab, w: weight}]. Distance from A to B = each color of A to its nearest in B (CIEDE2000),
// weighted by A's proportions; the symmetric distance averages both directions, so a palette missing half of
// a look's colors scores badly even if every color it has is in the look.
const lkLabs = new Map();
// a palette color is named from the ~1,000 learnable names (js/naming.js), never the library name stored with it (Japanese, Web, xkcd names)
const lkColName = c => (nameOf(c[0]).n) || c[1];
function lkPalLab(cols) {   // cols: [[hex, name, share]] or [{h, share}]
  const key = cols.map(c => (c[0] || c.h) + ":" + (c[2] != null ? c[2] : c.share)).join();
  if (lkLabs.has(key)) return lkLabs.get(key);
  const raw = cols.map(c => ({ L: lab(c[0] || c.h), w: +(c[2] != null ? c[2] : c.share != null ? c.share : 1) || 0 }));
  const tot = raw.reduce((t, x) => t + x.w, 0) || 1, out = raw.map(x => ({ L: x.L, w: tot ? x.w / tot : 1 / raw.length }));
  lkLabs.set(key, out); return out;
}
function lkDist(A, B) {
  const one = (X, Y) => X.reduce((t, x) => t + x.w * Math.min(...Y.map(y => de2000(x.L, y.L))), 0);
  return (one(A, B) + one(B, A)) / 2;
}
const lkScore = d => Math.round(100 * Math.exp(-d / 30));   // 0 -> 100, 10 -> 72, 25 -> 43

// "What look is this?" Best score over each look's palettes. shares are optional (even split when missing).
function lookMatch(colorsHex, shares) {
  const hexes = (colorsHex || []).filter(h => /^#[0-9A-Fa-f]{6}$/.test(h));
  if (!hexes.length) return [];
  const Q = lkPalLab(hexes.map((h, i) => [h.toUpperCase(), "", shares && shares[i] != null ? shares[i] : 1]));
  return lkAll().map(look => {
    let best = null;
    look.pals.forEach((p, pi) => { const d = lkDist(Q, lkPalLab(p.c)); if (!best || d < best.d) best = { d, pi }; });
    return { look, id: look.id, name: look.name, palette: look.pals[best.pi].n, pi: best.pi, score: lkScore(best.d) };
  }).sort((a, b) => b.score - a.score).slice(0, 3);
}

// ---------- "Your closest looks": the palette taste test's six dials (contrast, vividness, warmth, spread, count, proportions) ----------
function lkYours() {
  const rec = S.taste && S.taste.palette, dials = rec && rec.dials;
  if (!dials || dials.length !== 6 || typeof TASTE === "undefined" || !TASTE.palItem) return [];
  return lkAll().map(look => {
    let best = null;
    look.pals.forEach((p, pi) => {
      const z = TASTE.palItem(p.c.map(c => c[0]), p.c.map(c => c[2])).z;
      const d = Math.sqrt(z.reduce((t, v, k) => t + (clamp(v, -2.5, 2.5) - dials[k]) ** 2, 0) / 6);
      if (!best || d < best.d) best = { d, pi };
    });
    return { look, pi: best.pi, score: Math.round(100 * Math.exp(-best.d / 1.2)) };
  }).sort((a, b) => b.score - a.score).slice(0, 6);
}

// ---------- the Looks section in Explore > Ideas ----------
function lkPin(look, extra = {}) {
  const p = look.pals[extra.pi || 0];
  const why = extra.why ? `<p class="pin-why">${esc(extra.why)}</p>` : "";
  return { h: 158 + (why ? 44 : 0), html: `<button class="pin lkx-pin" data-lk="${esc(look.id)}" data-lkp="${extra.pi || 0}">${lkStripes(p.c)}<b>${esc(look.name)}</b><small>${esc(look.era)} · ${look.pals.length} palettes</small>${why}</button>` };
}
function lkSections() {
  const all = lkAll();
  if (!all.length) {   // not here yet: fetch, then redraw the Ideas feed in place (once; afterwards LOOKS exists)
    lkWhen(() => { if (S.lens === "ideas" && document.querySelector(".x-feed") && typeof exploreHome === "function") { const y = scrollY; exploreHome(); scrollTo(0, y); } });
    return [];
  }
  const secs = [];
  const yours = lkYours();
  if (yours.length) secs.push({ title: "Looks · Your closest", sub: "Matched to your dials from Find your palette.", pins: yours.map(y => lkPin(y.look, { pi: y.pi, why: `${y.score}% match · ${y.look.pals[y.pi].n}` })) });
  LK_CATS.forEach(([k, t], i) => {
    const list = all.filter(l => l.cat === k).sort((a, b) => a.y - b.y);
    if (list.length) secs.push({ title: "Looks · " + t, sub: i === 0 && !yours.length ? "Visual styles, from Baroque to Barbiecore. Each look is a family of palettes." : "", pins: list.map(l => lkPin(l)) });
  });
  return secs;
}

// ---------- the look page ----------
let LK_BACK = null, LK_CUR = null;   // LK_CUR: the look and palette on screen, so Back from a tapped swatch returns here
   // where the look page's back button goes
function lkOpen(id, opts = {}) {
  const look = lkGet(id); if (!look) return;
  if (opts.back) LK_BACK = opts.back;
  else if (!opts.keep) { const y = scrollY; LK_BACK = app.querySelector(".screen.explore") ? () => { go("explore"); scrollTo(0, y); } : () => go("explore"); }
  let pi = clamp(opts.pi || 0, 0, look.pals.length - 1);
  LK_CUR = { id: look.id, get pi() { return pi; } };
  const related = (look.related || []).map(lkGet).filter(Boolean);
  const imgs = look.img || [];
  const ptgs = lkPaintings(look);
  const extra = lkOtherArchives(look);
  const row = (k, v) => v ? `<div class="lkx-row"><dt>${k}</dt><dd>${v}</dd></div>` : "";
  const el = show(`
    <header class="art-top"><button class="icon-btn glass" data-back aria-label="Back">${ICON.back}</button><span class="eyebrow">${esc(LK_CAT_ONE[look.cat] || "Look")}</span><span style="width:44px"></span></header>
    <div class="lkx-hero" id="lkh"></div>
    <p class="eyebrow p-type">Look · ${esc(look.era)}</p>
    <h1 class="p-title">${esc(look.name)}</h1>
    <p class="p-dek">${esc(look.essence)}</p>
    <div class="lkx-tabs" role="tablist">${look.pals.map((p, i) => `<button role="tab" data-pi="${i}" class="${i === pi ? "on" : ""}">${lkStripes(p.c, "lkx-dot")}<span>${esc(p.n)}</span></button>`).join("")}</div>
    <div class="lkx-cols" id="lkc"></div>
    <div class="lkx-acts"><button class="btn" data-studio>Open in Studio ${ICON.arrow}</button></div>
    <dl class="lkx-rows">
      ${row("Light", esc(look.light))}
      ${row("Materials", esc((look.materials || []).join(", ")))}
      ${row("Motifs", esc((look.motifs || []).join(", ")))}
      ${row("Mood", (look.mood || []).map(m => `<span class="lkx-mood">${esc(m)}</span>`).join(""))}
    </dl>
    <section class="lkx-sec"><h3>Where the name comes from</h3><p>${esc(look.origin)}</p><p class="lkx-fuzzy"><b>How fuzzy is it?</b> ${esc(look.fuzzy)}</p></section>
    ${imgs.length || ptgs.length || extra.length ? `<section class="lkx-sec"><h3>Where to see it</h3>
      ${imgs.length ? `<div class="lkx-strip lkx-imgs">${imgs.map(f => `<figure class="lkx-fig"><img src="${esc(f.src)}" alt="${esc(f.alt || "")}" loading="lazy"${f.w ? ` width="${f.w}" height="${f.h}"` : ""}><figcaption>${esc(f.caption || "")}<span><a href="${esc(f.commons)}" target="_blank" rel="noopener">${esc(f.credit || "Wikimedia Commons")}</a></span></figcaption></figure>`).join("")}</div>` : ""}
      ${ptgs.length ? `<div class="eyebrow lkx-sub">Closest paintings in ColorHub, by palette</div><div class="lkx-strip">${ptgs.map(x => `<button class="lkx-ptg" data-node="${esc(x.n.id)}">${x.n.thumb || x.n.img ? `<img src="${esc(x.n.thumb || x.n.img)}" alt="" loading="lazy">` : ""}<span class="lkx-mini">${x.n.palette.map(c => `<i style="--c:${c.h};flex:${c.share}"></i>`).join("")}</span><b>${esc(x.n.title)}</b><small>${esc(x.n.artist || "")} · <span class="mono">${x.score}%</span> · ${esc(look.pals[x.pi].n)}</small></button>`).join("")}</div>` : ""}
      ${extra.length ? `<div class="eyebrow lkx-sub">Also in ColorHub</div><div class="chips-wrap">${extra.map(x => `<button class="pchip" data-node="${esc(x.id)}">${x.h ? `<i style="--c:${x.h}"></i>` : ""}${esc(x.title)}<em class="mono">${x.score}%</em></button>`).join("")}</div>` : ""}
    </section>` : ""}
    ${related.length ? `<section class="lkx-sec"><h3>Related looks</h3><div class="lkx-strip lkx-rel">${related.map(r => `<button class="lkx-relc" data-lk="${esc(r.id)}">${lkStripes(r.pals[0].c)}<b>${esc(r.name)}</b><small>${esc(r.era)}</small></button>`).join("")}</div></section>` : ""}
    <div class="lkx-acts"><button class="btn ghost" data-webfam="${esc(look.id)}">See its family tree ${ICON.arrow}</button></div>
    <p class="fine lkx-credit">${look.aw ? `See also: <a href="https://aesthetics.fandom.com/wiki/${esc(look.aw)}" target="_blank" rel="noopener">Aesthetics Wiki</a>. ` : ""}Descriptions are ColorHub's own. Palettes are chosen by ColorHub and named from the ColorHub library; hex values are screen approximations.${imgs.length ? " Photos: Wikimedia Commons, public domain or CC0." : ""}</p>
  `, "article lkx-page");
  const draw = () => {
    const p = look.pals[pi];
    el.querySelector("#lkh").innerHTML = p.c.map(c => `<i style="--c:${c[0]};flex:${Math.max(c[2], .06)}" data-ink="${ink(c[0])}" data-swatch="${c[0]}" role="button" aria-label="${esc(lkColName(c))}"><span class="mono">${Math.round(c[2] * 100)}%</span></i>`).join("");
    el.querySelector("#lkc").innerHTML = p.c.map((c, i) => { return `<button class="lkx-col" data-swatch="${c[0]}"><i style="--c:${c[0]}"></i><span><b>${esc(lkColName(c))}</b><em class="mono">${c[0]} · ${Math.round(c[2] * 100)}%</em></span>${ICON.arrow}</button>`; }).join("");
    el.querySelectorAll("[data-pi]").forEach(b => b.classList.toggle("on", +b.dataset.pi === pi));
  };
  draw();
  const back = () => (LK_BACK || xToOrigin)();
  el.querySelector("[data-back]").onclick = back;
  onKey = e => { if (e.key === "Escape") back(); };
  el.querySelectorAll("[data-pi]").forEach(b => b.onclick = () => { pi = +b.dataset.pi; draw(); buzz(4); });
  el.querySelector("[data-studio]").onclick = () => {
    const p = look.pals[pi];
    paletteView({ cols: p.c.map(c => ({ h: c[0], share: c[2] })), from: `${look.name} · ${p.n}` });
    lkRewire(() => lkOpen(look.id, { keep: true, pi }));
  };
  el.addEventListener("click", e => {
    const n = e.target.closest("[data-node]"); if (n) { e.preventDefault(); return lkNode(n.dataset.node, look.id, pi); }
    const fam = e.target.closest("[data-webfam]"); if (fam) { e.preventDefault(); buzz(6); return typeof agOpenRoute === "function" ? agOpenRoute("focus", "look:" + fam.dataset.webfam) : (location.hash = "#/web/focus/look:" + fam.dataset.webfam);
    }
  });
}
// a tapped swatch opens its color page (js/swatch.js, capture phase, runs first); once that screen is up, point its Back here
document.addEventListener("click", e => {
  if (!e.target.closest(".lkx-page [data-swatch]") || !LK_CUR) return;
  const keep = { id: LK_CUR.id, pi: LK_CUR.pi }; let n = 0;
  const t = setInterval(() => {
    const scr = app.querySelector(".screen");
    if (scr && !scr.classList.contains("lkx-page")) { clearInterval(t); lkRewire(() => lkOpen(keep.id, { keep: true, pi: keep.pi })); }
    else if (++n > 60) clearInterval(t);
  }, 50);
}, true);
// after leaving the look page for another screen, point that screen's back button (and Escape) at the look page
function lkRewire(to) {
  const s = app.firstElementChild, b = s && s.querySelector("[data-back]");
  if (b) b.onclick = to;
  onKey = e => { if (e.key === "Escape") to(); };
}
function lkNode(nodeId, lookId, pi) {
  const n = graph().nodes.get(nodeId); if (!n) return;
  openNode(n);   // onto the one trail: its ‹ comes back to this look (js/trail.js)
}
// closest public-domain paintings (data/paintings.js), each scored by the look's best palette
function lkPaintings(look) {
  const g = typeof graph === "function" ? graph() : null; if (!g) return [];
  return [...g.nodes.values()].filter(n => n.kind === "painting" && !n.stub && (n.palette || []).length).map(n => {
    const P = lkPalLab(n.palette); let best = null;
    look.pals.forEach((p, pi) => { const d = lkDist(lkPalLab(p.c), P); if (!best || d < best.d) best = { d, pi }; });
    return { n, pi: best.pi, score: lkScore(best.d) };
  }).sort((a, b) => b.score - a.score).slice(0, 6);
}
// films, poems or other archives, if they exist and carry palettes (guarded: none of them may be loaded)
function lkOtherArchives(look) {
  const g = typeof graph === "function" ? graph() : null, out = [];
  [typeof window.FILMS !== "undefined" ? window.FILMS : null, typeof window.POEMS !== "undefined" ? window.POEMS : null].forEach(list => {
    if (!Array.isArray(list)) return;
    list.forEach(it => {
      const pal = (it.palette || []).filter(c => c && /^#[0-9A-Fa-f]{6}$/.test(c.h || "")); if (pal.length < 3 || !it.id) return;
      if (g && !g.nodes.get(it.id)) return;
      const P = lkPalLab(pal); let best = 1e9;
      look.pals.forEach(p => { best = Math.min(best, lkDist(lkPalLab(p.c), P)); });
      out.push({ id: it.id, title: it.title || it.id, h: pal[0].h, score: lkScore(best) });
    });
  });
  return out.sort((a, b) => b.score - a.score).slice(0, 6);
}

// ---------- the Studio hook: "What look is this?" under a palette ----------
function lkHook(el, colsNow, p) { lkWhen(() => lkHookNow(el, colsNow, p)); }
function lkHookNow(el, colsNow, p) {
  if (!lkAll().length || !el || !el.isConnected) return;
  const box = document.createElement("section"); box.className = "lkx-match";
  const anchor = el.querySelector("#hlist"); if (!anchor) return;
  anchor.after(box);
  const render = () => {
    const cols = colsNow() || [], m = lookMatch(cols.map(c => c.h), cols.map(c => c.share != null ? c.share : 1));
    box.innerHTML = m.length ? `<div class="sec-head"><b>What look is this?</b><span>closest of ${lkAll().length}</span></div>${m.map(r => `<button class="lkx-mrow" data-lk="${esc(r.id)}" data-lkp="${r.pi}">${lkStripes(r.look.pals[r.pi].c)}<span class="lkx-mt"><b>${esc(r.name)}</b><em><span class="mono">${r.score}%</span> · like its ${esc(r.palette)} palette</em></span>${ICON.arrow}</button>`).join("")}` : "";
  };
  render();
  el.addEventListener("click", e => { if (e.target.closest("[data-n]")) setTimeout(render, 0); });
  box.addEventListener("click", e => {
    const b = e.target.closest("[data-lk]"); if (!b) return;
    e.preventDefault(); e.stopPropagation();
    lkOpen(b.dataset.lk, { pi: +b.dataset.lkp || 0, back: p ? () => paletteView(p) : () => go("studio") });
  });
}

// look cards anywhere (Explore feed, related looks) open the look page
document.addEventListener("click", e => {
  const b = e.target.closest("[data-lk]"); if (!b || e.defaultPrevented) return;
  e.preventDefault();
  const fromLook = !!app.querySelector(".screen.lkx-page"), id = b.dataset.lk, pi = +b.dataset.lkp || 0;
  lkWhen(() => lkOpen(id, { pi, keep: fromLook }));
});

// a typed or linked #/look/<id> address (js/router.js openRoute)
function lkOpenRoute(id) {
  lkWhen(() => { if (lkGet(id)) lkOpen(id, { back: xToOrigin }); else xToOrigin(); });
}

// ---------- "In looks" on a color page: the looks whose palettes hold a color close to this one ----------
function lkRowInto(box, c) {
  if (!box || !c || !c.h) return;
  lkWhen(() => {
    const hits = [];
    lkAll().forEach(look => {
      let best = null;
      look.pals.forEach((p, pi) => p.c.forEach(x => { const d = de2000(c.h, x[0]); if (!best || d < best.d) best = { d, pi, x }; }));
      if (best && best.d < 7) hits.push({ look, ...best });
    });
    if (!hits.length) return;
    hits.sort((a, b) => a.d - b.d);
    box.insertAdjacentHTML("beforeend", `<section class="arch-row lkx-in"><h3>In looks</h3>${hits.slice(0, 5).map(h => `<button class="lkx-inrow" data-lk="${esc(h.look.id)}" data-lkp="${h.pi}">${lkStripes(h.look.pals[h.pi].c, "lkx-str lkx-str-s")}<span><b>${esc(h.look.name)}</b><small>${esc(h.look.pals[h.pi].n)} · ${esc(h.look.era)}</small></span></button>`).join("")}</section>`);
  });
}

// screenshot hooks for tools/shots.sh (index.html#shot=look:<id>[:palette], looks, lookyours, lookmatch)
function lkShot(screen, arg, arg2) { lkWhen(() => lkShotNow(screen, arg, arg2)); }
function lkShotNow(screen, arg, arg2) {
  if (screen === "look") {   // look:<id>:<palette>
    const look = lkGet(arg || "dark-academia") || lkAll()[0], pi = parseInt(arg2) || 0;
    lkOpen(look.id, { pi });
    return;
  }
  if (screen === "lookyours") S.taste = { palette: { at: today(), mu: [], dials: [-.4, -.6, .5, -.2, .6, .3] } };
  if (screen === "looks" || screen === "lookyours") {
    S.lens = "ideas"; go("explore");
    setTimeout(() => { const t = [...document.querySelectorAll(".x-sec")].find(x => /^Looks/.test(x.textContent)); if (t) scrollTo(0, t.getBoundingClientRect().top + scrollY - 70); }, 250);
    return;
  }
  if (screen === "lookmatch") {
    const look = lkGet(arg || "frutiger-aero") || lkAll()[0], q = look.pals[+arg2 || 0].c.map(c => ({ h: lkNudge(c[0]), share: c[2] }));
    paletteView({ cols: q, from: "A palette" });
    setTimeout(() => { const m = document.querySelector(".lkx-match"); if (m) scrollTo(0, m.getBoundingClientRect().top + scrollY - 260); }, 200);
  }
}
const lkNudge = h => { const [L, C, H] = lch(h); return lchHex(clamp(L + 4, 0, 100), C * .9, H + 6); };   // a near-copy, so the match isn't trivially 100

// the look page shows paintings from the color web, so it waits for the wiki like the other article screens (js/loader.js)
needsWiki("lkOpen");
