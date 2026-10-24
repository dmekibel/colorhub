"use strict";
// Keep exploring (David, 2026-10-24): "when you click on a painting, when you scroll all the way down, it should show all the
// similar paintings, and you can pick filters like similar by color, and the first one you see is the most similar by color;
// keep scrolling to find paintings related, so you can quickly go from one to the next. Or filter by similar in terms of
// painter, location, time, subject maybe."
//
// The feed sits at the very bottom of every painting page (js/gallery.js glPage mounts it): a sticky row of chips (Color,
// Painter, Era, Place) over a masonry of paintings, closest first, 24 more each time you near the end.
//  - One ranking per painting + chip (+ metric), cached (FD_CACHE, 12 at a time); the feed pages through the top ~300.
//    Color reuses js/twins.js exactly (glSimilarPal and the tw*Score scorers behind the "More like this, by…" switch);
//    Painter, Era and Place are plain passes over the index (year) and the facets (js/browse.js: painter, country, movement).
//  - The chosen chip is remembered for the session (FD_ST), so opening any tile lands on the next painting with the same
//    chip still on. Back puts the feed exactly where it was (FD_MEMO + js/trail.js tlHoldScroll), anchored on a tile.
//  - Every tile's box is fixed from the index's aspect byte before any image or title arrives (no layout jumps). Only the
//    tiles near the screen exist (and never more than FD_LIVE_MAX); a tile that scrolls far away loses its <img> entirely.
//    The images asked for are the smallest copy a host serves that is still sharp at that width (fdSrc).
//  - THE SEAM for Subject and Vibe: add ["subject", "Subject"] to FD_CHIPS, one function to FD_RANK (same shape as the
//    others: (ctx, st) => { items: [{ j, cap }] } or { empty: "plain reason" }, maybe a Promise), and one line to
//    FD_OFF if it can be unavailable for a painting. Nothing else in this file knows which chips exist.

const FD_PAGE = 24, FD_LIVE_MAX = 40, FD_KEEP = 300;
const FD_CHIPS = [["color", "Color"], ["painter", "Painter"], ["era", "Era"], ["place", "Place"]];
const FD_SHORT = { overall: "Overall", dominant: "Dominant", accents: "Accents", mood: "Mood", light: "Light", color: "One color", layout: "Layout" };
const FD_METRIC_HELP = { overall: "The whole palette, matched by area", dominant: "Only the three biggest colors", accents: "The small vivid colors", mood: "Key, color, contrast and warmth together",
  light: "Where the darks and lights sit", color: "The most canvas near one of its colors", layout: "Where the colors sit in the picture" };
const FD_LEAD = { color: m => ({ overall: "Closest palette first", dominant: "Closest big colors first", accents: "Closest accents first", mood: "Closest mood first", light: "Closest light first", color: "Most of that color first", layout: "Closest layout first" })[m],
  painter: () => "Same painter first, then painters kindred in place and era", era: () => "Nearest in year first", place: () => "Same country first, then the region, nearest in time" };
let FD_ST = (() => { try { const s = JSON.parse(sessionStorage.getItem("colorhub-feed") || "null"); if (s && s.chip) return { chip: s.chip, metric: s.metric || "overall", color: s.color | 0 }; } catch (e) {} return { chip: "color", metric: "overall", color: 0 }; })();
const fdSaveState = () => { try { sessionStorage.setItem("colorhub-feed", JSON.stringify(FD_ST)); } catch (e) {} };
const FD_CACHE = new Map();      // "i|chip|metric|color" -> { items } (oldest dropped past 12)
const FD_MEMO = new Map();       // painting -> { shown, ak, ay }: how far the feed was opened, and the tile at the top of the screen when you left
const fdHasMemo = i => FD_MEMO.has(i);
let FD_SHARDS = [];              // the detail shards the feed pulled in, oldest first: trimmed so a long browse never holds them all (fdTrim)
let FD_LAST = null;              // { chip, metric, ms, n }: how long the last ranking took (for the smoke test and for measuring)

// ---------- words ----------
const fdPct = d => Math.min(99, Math.max(0, Math.round(100 - d)));
function fdShortName(n) {
  n = String(n || "").replace(/\(.*?\)/g, "").trim();
  if (n.length <= 14) return n;
  const t = n.split(/\s+/); let k = t.length - 1;
  while (k > 0 && /^(van|von|de|der|den|da|di|del|della|le|la|du|dos|ter|ten|el|al)$/i.test(t[k - 1])) k--;
  return t.slice(k).join(" ");
}
const fdRel = (dy, later) => dy === 0 ? "same year" : `${dy} yr${dy === 1 ? "" : "s"} ${later ? "later" : "earlier"}`;
const fdCap1 = s => s.charAt(0).toUpperCase() + s.slice(1);

// ---------- the rankers: each returns { items: [{ j, cap }] } or { empty: reason }, now or as a Promise ----------
function fdCapColor(m, ctx, d, hex) {
  switch (m) {
    case "overall": return `Close palette · ${fdPct(d)}%`;
    case "dominant": return `Big colors · ${fdPct(d)}%`;
    case "accents": return `Close accents · ${fdPct(d)}%`;
    case "mood": return d < .6 ? "Very close mood" : d < 1.2 ? "Close mood" : "Loose mood";
    case "light": return `Lit alike · ${fdPct(d)}%`;
    case "color": return `${Math.max(1, Math.round((1 - d) * 100))}% near ${nameOf(hex).n.toLowerCase()}`;
    case "layout": return `Same layout · ${fdPct(d)}%`;
  }
  return "";
}
async function fdRankColor(ctx, st) {
  const q = ctx.q(), m = st.metric;
  let ranked, hex = null;
  if (m === "mood" || m === "light") { await twLoadMetrics(); ranked = (m === "mood" ? twScoreMood(q) : twScoreLight(q)).ranked; }
  else if (m === "layout") {
    const im = ctx.o.img && ctx.o.img();
    if (!im || !twReadable(im)) return { empty: "Layout needs a picture this page can read. Try another way of matching.", alt: true };
    const res = await twScoreLayout(q, twGridOf(im), null);
    if (!res.ranked.length) return { empty: "None of the closest palettes has a picture this page can read, so their layout can't be compared.", alt: true };
    ranked = res.ranked;
  }
  else if (m === "color") { hex = q.pool[Math.min(st.color, q.pool.length - 1)].h; ranked = twScoreColor(q, hex).ranked; }
  else if (m === "dominant") ranked = twScoreDominant(q).ranked;
  else if (m === "accents") { ranked = twScoreAccents(q).ranked; if (!ranked.length) return { empty: "This painting has no small vivid colors to match. Try Overall palette.", alt: true }; }
  else ranked = glSimilarPal(twPal(q), 300, { exclude: ctx.i, pairs: false, noEra: true, cands: 300 }).list.map(x => [x.i, x.d]);
  return { items: ranked.map(([j, d]) => ({ j, cap: fdCapColor(m, ctx, d, hex) })) };
}
// the squared distance between two paintings' average colors: a cheap tie-break so the nearest in time are also the nearest in color
const fdMeanD = (G, i, j) => { const m = G.mean, a = m[j * 3] - m[i * 3], b = m[j * 3 + 1] - m[i * 3 + 1], c = m[j * 3 + 2] - m[i * 3 + 2]; return Math.min(99, Math.sqrt(a * a + b * b + c * c)) / 1000; };
function fdRankEra(ctx) {
  const G = GAL, i = ctx.i, y0 = G.year[i];
  if (y0 === GL_UNDATED) return { empty: "This painting has no year, so there is no time to be near." };
  const sc = new Float32Array(G.n), est0 = glYearEst(i);
  for (let j = 0; j < G.n; j++) { const y = G.year[j]; sc[j] = j === i || y === GL_UNDATED ? Infinity : Math.abs(y - y0) + fdMeanD(G, i, j); }
  const items = Array.from(twTopK(sc, FD_KEEP), j => {
    const dy = Math.floor(sc[j]), est = est0 || glYearEst(j), r = fdRel(dy, G.year[j] > y0);
    return { j, cap: fdCap1(est && dy ? "about " + r : r) };
  });
  return { items };
}
// painter, country and movement come from the facets (js/browse.js xbLoad): loaded on first use
async function fdFacets() { const F = await xbLoad(); if (!F || F.G !== GAL) throw new Error("facets out of step"); return F; }
function fdRegions(F, co) {   // the tightest, then the widest, of paintmap.js's regions that hold this country (as country indices)
  if (typeof PM_REGIONS === "undefined") return [];
  const name = F.meta.countries[co - 1], hit = PM_REGIONS.filter(r => r[2].includes(name)).sort((a, b) => a[2].length - b[2].length);
  return [...new Set([hit[0], hit[hit.length - 1]].filter(Boolean))].map(r => new Set(pmRegionCountries(r[0], F)));
}
async function fdRankPlace(ctx) {
  const F = await fdFacets(), G = GAL, i = ctx.i, co = F.country[i], y0 = G.year[i], dated0 = y0 !== GL_UNDATED;
  if (!co) return { empty: "There is no country on record for this painting." };
  const tiers = fdRegions(F, co), sc = new Float32Array(G.n);   // tier 0 = the same country, 1 = the tightest region, 2 = the widest
  for (let j = 0; j < G.n; j++) {
    const c = F.country[j]; if (j === i || !c) { sc[j] = Infinity; continue; }
    let tier = 0;
    if (c !== co) { tier = -1; for (let k = 0; k < tiers.length; k++) if (tiers[k].has(c)) { tier = k + 1; break; } if (tier < 0) { sc[j] = Infinity; continue; } }
    const y = G.year[j], dy = !dated0 ? 0 : y === GL_UNDATED ? 400 : Math.abs(y - y0);
    sc[j] = tier * 1000 + Math.min(dy, 900) + fdMeanD(G, i, j);
  }
  const items = Array.from(twTopK(sc, FD_KEEP), j => {
    const y = G.year[j], place = F.meta.countries[F.country[j] - 1];
    return { j, cap: dated0 && y !== GL_UNDATED ? `${place} · ${fdRel(Math.abs(y - y0), y > y0)}` : place };
  });
  return { items };
}
async function fdRankPainter(ctx) {
  const F = await fdFacets(), G = GAL, i = ctx.i, a0 = F.artist[i], co0 = F.country[i], mv0 = F.mv[i], y0 = G.year[i], dated0 = y0 !== GL_UNDATED;
  if (!a0) return { empty: "There is no painter on record for this painting." };
  const so = new Float32Array(G.n), sk = new Float32Array(G.n);   // the same painter's other works; painters kindred in movement, country and era
  for (let j = 0; j < G.n; j++) {
    so[j] = sk[j] = Infinity; if (j === i) continue;
    const y = G.year[j], dy = dated0 && y !== GL_UNDATED ? Math.abs(y - y0) : 300, tie = fdMeanD(G, i, j);
    if (F.artist[j] === a0) { so[j] = Math.min(dy, 300) + tie; continue; }
    const cm = mv0 && F.mv[j] === mv0, cc = co0 && F.country[j] === co0;
    if (cm || cc) sk[j] = (cm ? 0 : 60) + (cc ? 0 : 120) + Math.min(dy, 300) / 2 + tie;
  }
  const name = F.meta.artists[a0 - 1][0], short = fdShortName(name), per = new Map(), kin = [];
  const own = Array.from(twTopK(so, 150), j => ({ j, cap: "Also " + short, byTitle: 1 }));
  for (const j of twTopK(sk, 700)) {   // at most 3 from any one painter, so the kindred are many hands, not one
    const a = F.artist[j], n = per.get(a) || 0; if (n >= 3) continue; per.set(a, n + 1);
    const y = G.year[j], cm = mv0 && F.mv[j] === mv0, cc = co0 && F.country[j] === co0, place = F.meta.countries[F.country[j] - 1] || "";
    kin.push({ j, cap: cm ? (cc ? "Same movement · " + place : F.meta.movements[mv0 - 1]) : `${place}${y !== GL_UNDATED ? " · " + Math.floor(y / 10) * 10 + "s" : ""}` });
  }
  return { items: own.concat(kin).slice(0, 400) };
}
const FD_RANK = { color: fdRankColor, painter: fdRankPainter, era: fdRankEra, place: fdRankPlace };
// can this chip work for this painting? [reason when it can't]. Year is in the index; country and painter are known from the detail row
// at once (d.co, d.a) and checked against the facets when those load.
const FD_OFF = {
  era: ctx => GAL.year[ctx.i] === GL_UNDATED ? "No year is known for this painting, so Era has nothing to measure from." : "",
  place: ctx => ctx.F && !ctx.F.country[ctx.i] || (!ctx.F && !ctx.d.co) ? "No country is known for this painting, so Place has nothing to measure from." : "",
  painter: ctx => ctx.F && !ctx.F.artist[ctx.i] || (!ctx.F && !ctx.d.a) ? "No painter is known for this painting." : "",
};

// ---------- images: the smallest sufficient copy ----------
// px = the width the tile needs on this screen. Hosts that serve any width get exactly it (rounded up to 100); Commons only serves its
// standard steps; the Art Institute only 400 / 600 / 843. Anything unknown gets the page's own "mid" copy. If a small copy fails the
// tile asks for the mid copy once before giving up.
function fdSrc(d, w) {
  const u = String(d.img || ""), mid = glSized(u, "mid");
  if (d.crop || glSmall(d)) return mid;   // a cropped frame needs the whole photo; our own copies are 200 px already
  const px = Math.ceil(w * Math.min(2.5, window.devicePixelRatio || 1) / 100) * 100;
  if (/commons\.wikimedia\.org\/wiki\/Special:FilePath\//.test(u)) { const st = [330, 500, 960, 1280].find(s => s >= px) || 1280; return u.replace(/\?width=\d+$/, "") + "?width=" + st; }
  const m = u.match(/^(https?:\/\/([^/]+)\/.*)\/full\/[^/]*\/0\/default\.jpg$/);
  if (m) {
    if (m[2] === "iiif.micr.io" || m[2] === "api.nga.gov") return px >= 843 ? mid : m[1] + `/full/${Math.max(300, px)},/0/default.jpg`;
    if (m[2] === "www.artic.edu") return m[1] + `/full/${px <= 400 ? 400 : px <= 600 ? 600 : 843},/0/default.jpg`;
    return mid;
  }
  if (/^https:\/\/ids\.si\.edu\/ids\/deliveryService\?/.test(u)) return mid.replace(/([?&]max=)\d+/, "$1" + Math.min(800, Math.max(400, px)));
  return mid;
}
// the detail shards the feed has pulled in: drop the oldest ones nothing on screen needs, so a long browse keeps memory flat
function fdTrim(keep) {
  while (FD_SHARDS.length > 60) {
    const k = FD_SHARDS.shift();
    if (keep.has(k)) { FD_SHARDS.push(k); if (FD_SHARDS.every(x => keep.has(x))) return; continue; }
    if (Array.isArray(GL_SHARDS.get(k))) GL_SHARDS.delete(k);
  }
}

// ---------- the feed ----------
function fdMount(host, o) {
  if (!host || !GAL) return;
  const i = o.i, d = o.d, G = GAL, memo = o.backNav ? FD_MEMO.get(i) : null;
  const st = { ...(memo && memo.chip ? { chip: memo.chip, metric: memo.metric, color: memo.color | 0 } : FD_ST) };   // re-read from FD_ST when the feed is built (start)   // this page's chip; a Back brings back the chip the feed was left on
  const save = () => { Object.assign(FD_ST, st); fdSaveState(); };
  const ctx = { i, d, o, F: typeof XBF !== "undefined" && XBF && XBF.G === GAL ? XBF : null, _q: null, q() { return this._q || (this._q = twQuery(o.cols, { self: i })); } };
  let eff = st.chip, items = [], shown = 0, tok = 0, built = false, gone = false, fk = 0;
  let W = 0, cols = 2, colW = 0, gap = 12, vgap = 18, txt = 52, top = null, col = null, hh = null, ends = [], pinSkew = null;
  const live = new Map(), wantShard = new Map();
  const off = k => (FD_OFF[k] ? FD_OFF[k](ctx) : "");
  const abOf = it => it.sk ? it.ab : Math.min(2.3, Math.max(.4, G.ar[it.j]));
  host.innerHTML = `<div class="sec-head"><b>Keep exploring</b><span>closest first</span></div>
    <div class="fd-bar"><div class="fd-chips" role="tablist" aria-label="What counts as related"></div></div>
    <p class="fd-lead" aria-live="polite"></p>
    <div class="fd-grid" role="group" aria-label="Related paintings, closest first"></div>
    <div class="fd-state"></div>`;
  const bar = host.querySelector(".fd-bar"), chipsEl = host.querySelector(".fd-chips"), lead = host.querySelector(".fd-lead"), grid = host.querySelector(".fd-grid"), state = host.querySelector(".fd-state");
  const artTop = () => document.querySelector(".gl-page > .art-top");
  const setBarTop = () => { if (glDesk()) { bar.style.top = ""; return; }   // on a wide window the fixed top bar is the one to sit under (css)
    const a = artTop(); bar.style.top = (a ? Math.round(a.getBoundingClientRect().height) - 1 : 0) + "px"; };

  // ----- chips -----
  const effective = () => { const k = st.chip; return !off(k) ? k : "color"; };
  const chipsDraw = () => {
    eff = effective();
    chipsEl.innerHTML = FD_CHIPS.map(([k, t]) => {
      const dis = !!off(k), on = k === eff, lab = k === "color" && on ? `Color${st.metric === "overall" ? "" : " · " + FD_SHORT[st.metric]}<span class="fd-car">${ICON.chev}</span>` : t;   // the by… switch: Overall is the default, so it needs no word
      return `<button class="fd-chip${on ? " on" : ""}${dis ? " dis" : ""}" role="tab" data-fc="${k}" aria-selected="${on}"${dis ? ` aria-disabled="true"` : ""}${k === "color" && on ? ` aria-haspopup="dialog"` : ""}>${lab}</button>`;
    }).join("");
  };
  const leadDraw = (reason) => {
    const miss = st.chip !== eff ? off(st.chip) : "";   // the chip you chose can't work for this painting: say why, and what you are seeing instead
    const t = reason || (miss ? miss + " Showing color instead." : FD_LEAD[eff] ? FD_LEAD[eff](st.metric) : "");
    lead.textContent = t; lead.classList.toggle("why", !!(reason || miss));
  };
  chipsEl.onclick = e => {
    const b = e.target.closest("[data-fc]"); if (!b) return;
    const k = b.dataset.fc, why = off(k);
    if (why) { buzz(4); leadDraw(why); return; }
    if (k === "color" && eff === "color") return bySheet();
    if (k === st.chip && k === eff) return;
    st.chip = k; save(); buzz(4); rerank(true);
  };

  // ----- the "by…" sheet (Color's metric switch, js/twins.js) -----
  function bySheet() {
    if (document.querySelector(".fd-sheet")) return;
    const q = ctx.q(), canLayout = !!(o.img && o.img() && twReadable(o.img()));
    const rows = TW_METRICS.filter(([k]) => k !== "layout" || canLayout).map(([k, t]) => {
      const nope = k === "accents" && !q.accents.length;
      return `<button class="fd-opt${k === st.metric ? " on" : ""}" data-m="${k}"${nope ? " disabled" : ""} role="radio" aria-checked="${k === st.metric}"><b>${t}</b><span>${nope ? "This painting has no small vivid colors" : FD_METRIC_HELP[k]}</span></button>`;
    }).join("");
    const { sh, close } = sheet(`<div class="fd-sh"><b class="fd-sh-t">Match color by…</b><div class="fd-opts" role="radiogroup" aria-label="How colors are matched">${rows}</div>
      <div class="fd-pick" ${st.metric === "color" ? "" : "hidden"}><span>Which color?</span>${q.pool.slice(0, 6).map((p, k) => `<button data-pick="${k}" class="${k === st.color ? "on" : ""}" style="--c:${p.h}" aria-label="${esc(nameOf(p.h).n)}" aria-pressed="${k === st.color}"></button>`).join("")}</div></div>`);
    sh.classList.add("fd-sheet"); sh.setAttribute("aria-label", "Match color by");
    sh.onclick = e => {
      const p = e.target.closest("[data-pick]"), b = e.target.closest("[data-m]");
      if (p) { st.metric = "color"; st.color = +p.dataset.pick; }
      else if (b && !b.disabled) { st.metric = b.dataset.m; if (b.dataset.m === "color") { sh.querySelector(".fd-pick").hidden = false; sh.querySelectorAll("[data-m]").forEach(x => { x.classList.toggle("on", x === b); x.setAttribute("aria-checked", x === b); }); st.chip = "color"; save(); chipsDraw(); rerank(true); return; } }
      else return;
      st.chip = "color"; save(); buzz(4); close(); chipsDraw(); rerank(true);
    };
  }

  // ----- layout (a masonry whose boxes are known from the index before anything loads) -----
  const colsFor = w => w < 560 ? 2 : w < 860 ? 3 : Math.max(3, Math.min(5, Math.floor((w + 14) / 254)));
  const relayout = () => {
    W = grid.clientWidth || Math.min(innerWidth, 540) - 40;
    cols = colsFor(W); [gap, vgap] = cols === 2 ? [12, 18] : [16, 22];
    colW = (W - gap * (cols - 1)) / cols;
    txt = colW < 146 ? 72 : 50; grid.classList.toggle("narrow", colW < 146);   // a 320 px screen: the caption may take two lines, so the number is never cut off
    top = new Float32Array(items.length); col = new Uint8Array(items.length); hh = new Float32Array(items.length);
    ends = new Array(cols).fill(0);
    place(0);
  };
  const place = k0 => {
    for (let k = k0; k < shown; k++) {
      const h = Math.round(colW * abOf(items[k])) + txt; hh[k] = h;
      let c = 0; for (let j = 1; j < cols; j++) if (ends[j] < ends[c]) c = j;
      top[k] = ends[c]; col[k] = c; ends[c] += h + vgap;
    }
    grid.style.height = (shown ? Math.max(...ends) - vgap : 0) + "px";
  };
  const gridTop = () => grid.getBoundingClientRect().top + scrollY;

  // ----- tiles -----
  const domOf = j => { let b = 0; for (let y = 1; y < 6; y++) if (G.sh[j * 6 + y] > G.sh[j * 6 + b]) b = y; return glHex(j, b); };
  function tileHTML(k) {
    const it = items[k], pos = `left:${col[k] * (colW + gap)}px;top:${top[k]}px;width:${colW}px;height:${hh[k]}px`;
    if (it.sk) return `<div class="fd-tile sk" style="${pos}" aria-hidden="true"><span class="fd-im" style="height:${hh[k] - txt}px"></span><span class="fd-cap"></span><span class="fd-by"></span></div>`;
    return `<button class="fd-tile wait" data-fk="${k}" tabindex="${k === fk ? 0 : -1}" style="${pos}"><span class="fd-im" style="--c:${domOf(it.j)};height:${hh[k] - txt}px"><span class="fd-ov"></span></span><span class="fd-cap">${esc(it.cap)}</span><span class="fd-by"></span></button>`;
  }
  function fill(el, k) {   // title, byline and picture, once this painting's shard is in
    const it = items[k], dd = glDetailNow(it.j); if (!dd || !el.isConnected || !el.classList.contains("wait")) return;
    el.classList.remove("wait");
    const title = dd.t, who = dd.a || dd.co || "";
    el.setAttribute("aria-label", `${title}${who ? ", " + who : ""}. ${it.cap}`);
    el.querySelector(".fd-by").innerHTML = it.byTitle ? `<span>${esc(title)}</span>${glYear(it.j) ? `<em> · ${esc(glYear(it.j))}</em>` : ""}` : glByline(it.j, dd);   // "Also Monet" already names the painter: the line below gives the picture's title instead
    el.querySelector(".fd-ov").innerHTML = `<b>${esc(title)}</b><small>${esc(who)}${glYear(it.j) ? " · " + esc(glYear(it.j)) : ""}</small>`;
    const im = el.querySelector(".fd-im"), img = document.createElement("img"), mid = glSized(dd.img, "mid");
    img.alt = ""; img.decoding = "async"; img.draggable = false;
    const crop = glCropStyle(it.j, dd, abOf(it)), mm = /style="([^"]*)"/.exec(crop); if (mm) img.style.cssText = mm[1];
    if (k < 8) img.fetchPriority = "high";
    img.onload = () => img.classList.add("ld");
    img.onerror = () => {
      if (img.src !== mid && !img.dataset.retry) { img.dataset.retry = 1; img.src = mid; return; }
      img.remove(); im.classList.add("err"); if (!im.querySelector(".fd-err")) im.insertAdjacentHTML("beforeend", `<span class="fd-err">Picture unavailable</span>`);
    };
    img.src = fdSrc(dd, colW);
    im.insertBefore(img, im.firstChild);
  }
  function want(k) { const s = Math.floor(items[k].j / G.shard); if (!wantShard.has(s)) wantShard.set(s, []); wantShard.get(s).push(k); }
  function shards(ks) {
    ks.forEach(want);
    wantShard.forEach((list, s) => {
      wantShard.delete(s);
      if (!FD_SHARDS.includes(s)) FD_SHARDS.push(s);
      glShard(s).then(() => list.forEach(k => { const el = live.get(k); if (el) fill(el, k); }), () => { list.forEach(k => { const el = live.get(k); if (el && !el.querySelector(".fd-err")) { el.classList.remove("wait"); el.querySelector(".fd-im").classList.add("err"); el.querySelector(".fd-im").insertAdjacentHTML("beforeend", `<span class="fd-err">Didn't load</span>`); } }); });
    });
  }
  const liveShards = () => new Set([...live.keys()].filter(k => items[k] && !items[k].sk).map(k => Math.floor(items[k].j / G.shard)).concat([Math.floor(i / G.shard)]));
  function draw() {
    if (gone || !grid.isConnected || !shown || !top) return;
    const cw = grid.clientWidth; if (cw > 40 && Math.abs(cw - W) > 1) { relayoutAll(); return; }
    const r = grid.getBoundingClientRect(), y0 = -r.top - innerHeight * .7, y1 = -r.top + innerHeight * 1.7;
    let lo = 0, hi = shown;
    while (lo < hi) { const m = (lo + hi) >> 1; if (top[m] < y0 - 900) lo = m + 1; else hi = m; }
    let wantSet = [], last = lo;
    for (let k = lo; k < shown && top[k] <= y1; k++) { if (top[k] + hh[k] >= y0) wantSet.push(k); last = k; }
    if (wantSet.length > FD_LIVE_MAX) {   // never more than FD_LIVE_MAX live pictures: keep the ones nearest the middle of the screen
      const mid = -r.top + innerHeight / 2; wantSet.sort((a, b) => Math.abs(top[a] + hh[a] / 2 - mid) - Math.abs(top[b] + hh[b] / 2 - mid)); wantSet = wantSet.slice(0, FD_LIVE_MAX);
    }
    const ws = new Set(wantSet);
    live.forEach((el, k) => { if (!ws.has(k)) { const im = el.querySelector("img"); if (im) im.removeAttribute("src"); el.remove(); live.delete(k); } });
    const add = wantSet.filter(k => !live.has(k)).sort((a, b) => a - b);
    if (add.length) {
      const tmp = document.createElement("div"); tmp.innerHTML = add.map(tileHTML).join("");
      const waiting = [];
      [...tmp.children].forEach((el, n) => { const k = add[n]; live.set(k, el); grid.appendChild(el); if (!items[k].sk) { if (glDetailNow(items[k].j)) fill(el, k); else waiting.push(k); } });
      if (waiting.length) shards(waiting);
    }
    // the roving tab stop: the tile that last had focus, else the first one on screen
    if (!live.has(fk)) { const f = Math.min(...live.keys()); live.forEach((el, k) => el.tabIndex = k === f ? 0 : -1); } else live.forEach((el, k) => { if (!items[k].sk) el.tabIndex = k === fk ? 0 : -1; });
    // the next few tiles' details, so they are ready before they arrive
    const nx = []; for (let k = last + 1; k < Math.min(shown, last + 13); k++) if (!items[k].sk) { const s = Math.floor(items[k].j / G.shard); if (!Array.isArray(GL_SHARDS.get(s))) nx.push(k); }
    if (nx.length) { nx.forEach(k => { const s = Math.floor(items[k].j / G.shard); if (!FD_SHARDS.includes(s)) FD_SHARDS.push(s); glShard(s).catch(() => {}); }); }
    fdTrim(liveShards());
    // near the end of what is shown: 24 more (the boxes are known from the index, so nothing moves)
    if (shown < items.length && r.bottom - innerHeight < innerHeight * 1.6) grow();
  }
  function more() { const k0 = shown; shown = Math.min(items.length, shown + FD_PAGE); place(k0); stateDraw(); }   // 24 more tiles: only their boxes, appended below
  function grow() { more(); requestAnimationFrame(draw); }
  function relayoutAll() { const keep = shown; live.forEach(el => el.remove()); live.clear(); relayout(); shown = keep; draw(); }
  function stateDraw() {
    if (!items.length || items[0].sk) { state.innerHTML = ""; return; }
    state.innerHTML = shown >= items.length ? `<p class="fd-end">That is everything close to this one.</p><button class="fd-up" data-fdup>Back to this painting</button>` : "";
  }
  state.onclick = e => {
    if (e.target.closest("[data-fdup]")) { buzz(4); scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" }); return; }
    if (e.target.closest("[data-fdalt]")) { st.metric = "overall"; save(); buzz(4); chipsDraw(); rerank(true); return; }
    if (e.target.closest("[data-fdretry]")) { buzz(4); rerank(false); }
  };

  // ----- ranking -----
  const SK = [1.3, .78, 1.0, 1.45, .9, 1.2, .85, 1.1];
  function skeleton() {
    items = SK.map(ab => ({ sk: 1, ab })); shown = items.length; fk = 0; live.forEach(el => el.remove()); live.clear(); relayout(); state.innerHTML = ""; draw();
  }
  const key = () => `${i}|${eff}|${st.metric}|${st.color}`;
  function apply(res, ms) {
    if (res.empty) {
      items = []; shown = 0; live.forEach(el => el.remove()); live.clear(); grid.style.height = "0px";
      state.innerHTML = `<p class="fd-empty">${esc(res.empty)}</p>${res.alt ? `<button class="fd-up" data-fdalt>Match by overall palette</button>` : ""}`;
      leadDraw(""); return;
    }
    items = res.items; if (!items.length) { apply({ empty: "Nothing else in the archive is close to this one in that way." }); return; }
    live.forEach(el => el.remove()); live.clear();
    const want0 = memo ? memo.shown : FD_PAGE;
    shown = Math.min(items.length, Math.max(FD_PAGE, want0)); fk = 0;
    relayout(); stateDraw(); leadDraw(""); draw();
    FD_LAST = { chip: eff, metric: st.metric, ms: Math.round(ms), n: items.length };
  }
  function rerank(scrollUp) {
    const mine = ++tok, was = scrollUp && built && gridTop() < scrollY + 80;   // you were down in the old list: land at the new first tile, just under the chips
    chipsDraw(); leadDraw("");
    const k = key(), hit = FD_CACHE.get(k), t0 = performance.now();
    const done = res => {
      if (mine !== tok || gone) return;
      if (res.items) { FD_CACHE.set(k, res); if (FD_CACHE.size > 12) FD_CACHE.delete(FD_CACHE.keys().next().value); }
      apply(res, performance.now() - t0);
      if (was) scrollTo(0, Math.max(0, gridTop() - bar.getBoundingClientRect().height - (artTop() ? artTop().getBoundingClientRect().height : 0) - 8));
      afterBuild();
    };
    if (hit) return done(hit);
    skeleton(); state.innerHTML = "";
    const run = () => Promise.resolve().then(() => FD_RANK[eff](ctx, { metric: st.metric, color: st.color })).then(done, e => {
      if (mine !== tok || gone) return;
      items = []; shown = 0; live.forEach(el => el.remove()); live.clear(); grid.style.height = "0px";
      state.innerHTML = `<p class="fd-empty">That didn't load. Check your connection and try again.</p><button class="fd-up" data-fdretry>Try again</button>`;
    });
    if (memo) run(); else setTimeout(run, 24);   // let the skeleton paint first (a Back builds it at once)
  }
  // once the feed is up: the facets, loaded quietly, decide whether Painter and Place apply to this painting
  let facetsAsked = false;
  function afterBuild() {
    if (facetsAsked || ctx.F) return; facetsAsked = true;
    setTimeout(() => xbLoad().then(F => { if (gone || F.G !== GAL) return; ctx.F = F; const was = eff; chipsDraw(); if (was !== eff) rerank(false); }).catch(() => {}), 700);
  }

  // ----- keys, taps, position -----
  grid.onclick = e => {
    const t = e.target.closest(".fd-tile[data-fk]"); if (!t) return;
    buzz(6); leave(); galleryPage(items[+t.dataset.fk].j, true, null);
  };
  grid.addEventListener("focusin", e => { const t = e.target.closest(".fd-tile[data-fk]"); if (t) fk = +t.dataset.fk; });
  function focusK(n) {
    if (n < 0 || n >= items.length) return;
    while (n >= shown && shown < items.length) more();
    const y = gridTop() + top[n], vh = innerHeight, bh = bar.getBoundingClientRect().height + (artTop() ? artTop().getBoundingClientRect().height : 0);
    if (y < scrollY + bh + 8 || y + hh[n] > scrollY + vh - 8) scrollTo(0, Math.max(0, y - vh / 2 + hh[n] / 2));
    fk = n; draw(); const el = live.get(n); if (el) el.focus({ preventScroll: true });
  }
  grid.addEventListener("keydown", e => {
    const t = e.target.closest(".fd-tile[data-fk]"); if (!t) return;
    const k = +t.dataset.fk; let n = -1;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { const s = e.key === "ArrowDown" ? 1 : -1; for (let m = k + s; m >= 0 && m < items.length && Math.abs(m - k) <= cols * 6; m += s) { while (m >= shown && shown < items.length) more(); if (col[m] === col[k]) { n = m; break; } } }
    else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      const c = col[k] + (e.key === "ArrowRight" ? 1 : -1); if (c < 0 || c >= cols) return;
      const mid = top[k] + hh[k] / 2; let best = 1e9;
      for (let m = Math.max(0, k - cols * 4); m < Math.min(shown, k + cols * 4); m++) if (col[m] === c) { const dd = Math.abs(top[m] + hh[m] / 2 - mid); if (dd < best) { best = dd; n = m; } }
    } else if (e.key === "Home") n = 0;
    if (n < 0) return;
    e.preventDefault(); focusK(n);
  });
  // leaving for a tile: remember how far the feed was opened and which tile was at the top of the screen, so Back can put it back exactly
  function leave() {
    const bh = bar.getBoundingClientRect().bottom; let ak = -1, ay = 0;
    live.forEach((el, k) => { const r = el.getBoundingClientRect(); if (r.bottom > bh && (ak < 0 || k < ak)) { ak = k; ay = r.top; } });
    FD_MEMO.set(i, { shown, ak, ay, chip: st.chip, metric: st.metric, color: st.color });
  }
  // coming Back: the tile that was at ay is put at ay again, whatever above it has grown or shrunk since (the page above loads for a moment)
  function pin() {
    if (!memo || memo.ak < 0) return;
    let n = 0, stop = false, ro = null; const quit = () => { stop = true; if (ro) ro.disconnect(); };
    addEventListener("touchstart", quit, { once: true, passive: true }); addEventListener("wheel", quit, { once: true, passive: true }); addEventListener("keydown", quit, { once: true });
    const set = () => {
      if (stop || gone || !items.length || items[0].sk || memo.ak >= shown) return;   // (the ranking may not have landed yet: a cache miss)
      const y = gridTop() + top[memo.ak] - memo.ay;
      if (y > 0) { try { SCROLL_BY_HASH.set(ROUTE_NOW, y); } catch (e) {} if (Math.abs(scrollY - y) > 2) scrollTo(0, y); draw(); }
    };
    const tick = () => { if (stop || gone || ++n > 60) return quit(); set(); setTimeout(tick, 100); };
    // anything above the feed that grows or shrinks while the page settles moves the tile: re-pin on every height change
    try { ro = new ResizeObserver(set); ro.observe(document.documentElement); } catch (e) {}
    tick();
  }

  // ----- go -----
  const onScroll = (() => { let raf = 0; return () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; draw(); }); }; })();
  const onResize = () => { setBarTop(); if (Math.abs((grid.clientWidth || W) - W) > 1) relayoutAll(); };
  function start() {
    if (built || gone) return; built = true;
    if (!memo) Object.assign(st, FD_ST);
    setBarTop(); chipsDraw();
    addEventListener("scroll", onScroll, { passive: true }); addEventListener("resize", onResize);
    rerank(false);
    if (memo) pin();
  }
  // built once the bottom is near (within ~1.6 screens): a scroll listener, not an IntersectionObserver, which a hidden tab may never run
  const near = () => { if (!built && host.getBoundingClientRect().top < innerHeight * 2.6) { removeEventListener("scroll", near); start(); } };
  const destroy = () => { gone = true; tok++; removeEventListener("scroll", near); removeEventListener("scroll", onScroll); removeEventListener("resize", onResize); live.clear(); };
  cleanup.push(destroy);
  host.style.minHeight = "1px";
  if (memo) start(); else { addEventListener("scroll", near, { passive: true }); near(); }
  return { start, destroy };
}
