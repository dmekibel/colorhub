"use strict";
// Palette view (David, 2026-10-11): a full-screen, scrollable feed of palettes derived LIVE on the phone from one
// source (a painting's measured color pool, a painter's swatch book, or a photo's k-means pool) — sorted into
// categories, generated lazily as you scroll, pinned per source, saved into Studio's real saved palettes, and fed
// back into the taste model (js/tastemodel.js) the same way the taste trainer is. Nothing here is pre-generated
// per painting: every palette is built on the fly from colors the source already has.
//
// Entry: plvOpen(kind, id, extra) — kind is "painting" (id = the gallery index, js/gallery.js), "painter" (id =
// its slug) or "photo" (id is null; extra carries {pool, img, from} straight from Studio, since an in-session
// photo has no stable address). Route: #/pv/<kind>/<id> (js/router.js ROUTED + its "pv" openRoute branch) —
// a photo never gets a route (there's nothing stable to point it at; see router.js's comment there).
//
// Uses js/core.js's color math (lab, lch, de2000, labHex, clamp, countify, sheet, toast, buzz, show, esc, ICON),
// js/gallery.js's pool helpers (glPoolDecode, glpOk — the OKLab transform) and js/studio.js's inverse transform
// (oklabToLin, enc8) for gradients, js/naming.js/js/names.js (nameOf, openCoreName) for names, js/picker.js
// (colorPicker) and js/eyedrop.js (eyedropAttach) for the swap sheet, and js/tastemodel.js + js/tasteladder.js
// (TASTE, ldrState) for ranking and training. State: S.plv = { "<kind>:<id>": [{cols, cat, at}] } (migrateState
// v5, js/core.js).

// ---------- categories ----------
const PLV_FAMS = ["pink", "red", "orange", "yellow", "green", "teal", "blue", "purple", "brown"];
const PLV_FAM_LABEL = { pink: "Pinks", red: "Reds", orange: "Oranges", yellow: "Yellows", green: "Greens", teal: "Teals", blue: "Blues", purple: "Purples", brown: "Browns" };
const plvHueDist = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
function plvFamily(L, C, H) {
  if (C < 8) return null;
  if (H >= 300 || H < 20) return L > 58 ? "pink" : "red";
  if (H < 45) return (L < 58 && C < 42) ? "brown" : "orange";
  if (H < 70) return "yellow";
  if (H < 170) return "green";
  if (H < 195) return "teal";
  if (H < 255) return "blue";
  if (H < 300) return "purple";
  return null;
}
// prep a raw pool ({h, share}) with Lab/LCh/OKLab once, reused by every category this source draws from
function plvPrep(pool) {
  return pool.filter(p => /^#[0-9A-F]{6}$/i.test(p.h)).map(p => {
    const [L, a, b] = lab(p.h), C = Math.hypot(a, b); let H = Math.atan2(b, a) * 180 / Math.PI; if (H < 0) H += 360;
    return { h: p.h.toUpperCase(), share: p.share || .02, L, C, H, ok: glpOk(p.h) };
  });
}
const plvOkDist = (a, b) => Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);

// ---------- weighted sampling without replacement, mutually distinct in OKLab ----------
function plvPickDistinct(cands, k, rng, minD) {
  if (!cands.length) return null;
  const n = Math.min(k, cands.length);
  let tries = 0, d = minD == null ? .04 : minD;
  while (tries < 50) {
    tries++;
    const left = cands.slice(), picked = [];
    while (picked.length < n && left.length) {
      const w = left.map(c => Math.pow(Math.max(c.share, .01), .5) + .05), tot = w.reduce((a, b) => a + b, 0);
      let r = rng() * tot, idx = 0; while (idx < w.length - 1 && r > w[idx]) { r -= w[idx]; idx++; }
      const c = left[idx];
      if (!picked.length || picked.every(p => plvOkDist(p.ok, c.ok) >= d)) picked.push(c);
      left.splice(idx, 1);
    }
    if (picked.length === n) return picked;
    d *= .65;   // the pool is small for this slot count — loosen and try again
  }
  // last resort: whatever greedy fill got furthest, better than failing the category outright
  return cands.length >= n ? cands.slice(0, n) : null;
}
const plvSortL = cols => cols.slice().sort((a, b) => lab(a)[0] - lab(b)[0]);
const plvSortH = cols => cols.slice().sort((a, b) => lch(a)[2] - lch(b)[2]);

// ---------- gradients: interpolate in OKLab between two source colors, then back to sRGB ----------
function plvOkToHex(ok) { return "#" + oklabToLin(ok[0], ok[1], ok[2]).map(v => enc8(v).toString(16).padStart(2, "0")).join("").toUpperCase(); }
function plvGradient(prepped, k, rng) {
  if (prepped.length < 2) return null;
  // a handful of candidate endpoint pairs, the farthest-apart ones in OKLab, pick among the top few for variety
  const pairs = [];
  for (let t = 0; t < 30; t++) {
    const a = prepped[Math.floor(rng() * prepped.length)], b = prepped[Math.floor(rng() * prepped.length)];
    if (a === b) continue;
    pairs.push([plvOkDist(a.ok, b.ok), a, b]);
  }
  pairs.sort((p, q) => q[0] - p[0]);
  const top = pairs.slice(0, 5); if (!top.length || top[0][0] < .1) return null;
  const [, A, B] = top[Math.floor(rng() * top.length)];
  const n = Math.max(2, k);
  return Array.from({ length: n }, (_, i) => { const t = i / (n - 1); return plvOkToHex([A.ok[0] + (B.ok[0] - A.ok[0]) * t, A.ok[1] + (B.ok[1] - A.ok[1]) * t, A.ok[2] + (B.ok[2] - A.ok[2]) * t]); });
}

// ---------- per-category candidate pools + generators ----------
function plvCands(prepped) {
  return {
    vivid: prepped.filter(p => p.C > 14).sort((a, b) => b.C - a.C),
    pastel: prepped.filter(p => p.L > 60 && p.C >= 6 && p.C <= 42),
    dark: prepped.filter(p => p.L < 48),
    lightAccent: prepped.filter(p => p.L > 58),
    neutral: prepped.filter(p => p.C < 14),
    accent: prepped.filter(p => p.C >= 26),
    byFam: fam => prepped.filter(p => plvFamily(p.L, p.C, p.H) === fam),
  };
}
function plvGenGeneric(list, fallback, k, rng, sort) {
  const src = list.length >= 2 ? list : fallback;
  const picked = plvPickDistinct(src, k, rng); if (!picked) return null;
  return sort(picked.map(p => p.h));
}
function plvGenNeutral(C, prepped, k, rng) {
  const accN = Math.min(1, C.accent.length), baseN = k - accN;
  const base = plvPickDistinct(C.neutral.length >= baseN ? C.neutral : prepped, baseN, rng); if (!base) return null;
  const acc = C.accent.length ? [C.accent[Math.floor(rng() * C.accent.length)]] : [];
  return plvSortL(base.concat(acc).map(p => p.h));
}
function plvGenDark(C, prepped, k, rng) {
  const accN = C.lightAccent.length ? 1 : 0, baseN = k - accN;
  const base = plvPickDistinct(C.dark.length >= baseN ? C.dark : prepped, baseN, rng); if (!base) return null;
  const acc = accN ? [C.lightAccent[Math.floor(rng() * C.lightAccent.length)]] : [];
  return plvSortL(base.concat(acc).map(p => p.h));
}
function plvGenOpposites(prepped, k, rng) {
  if (prepped.length < 2) return null;
  const colorful = prepped.filter(p => p.C > 10); if (colorful.length < 2) return null;
  const anchor = colorful[Math.floor(rng() * colorful.length)];
  const A = colorful.filter(p => plvHueDist(p.H, anchor.H) < 35);
  const B = colorful.filter(p => { const d = plvHueDist(p.H, anchor.H); return d >= 150 && d <= 210; });
  if (!A.length || !B.length) return null;
  const nA = Math.ceil(k / 2), nB = k - nA;
  const pA = plvPickDistinct(A, Math.min(nA, A.length), rng) || A.slice(0, 1);
  const pB = plvPickDistinct(B, Math.min(nB, B.length), rng) || B.slice(0, 1);
  const all = pA.concat(pB); if (all.length < 2) return null;
  return plvSortH(all.map(p => p.h));
}
function plvGenFamily(fam, C, prepped, k, rng) {
  let list = C.byFam(fam);
  if (list.length < k && k >= 5) {   // one neighbor family may fill in (David's spec: allow one neighbor past 5)
    const idx = PLV_FAMS.indexOf(fam), neighbors = [PLV_FAMS[(idx + 1) % PLV_FAMS.length], PLV_FAMS[(idx + 8) % PLV_FAMS.length]];
    neighbors.forEach(n => { if (list.length < k) list = list.concat(C.byFam(n).slice(0, 1)); });
  }
  if (list.length < 2) return null;
  return plvGenGeneric(list, prepped, k, rng, plvSortL);
}
// "For you": sample broadly across every other live category; final ranking happens in the shared scorer below
function plvGenForYou(gens, k, rng) {
  const keys = Object.keys(gens).filter(x => x !== "foryou");
  if (!keys.length) return null;
  const pick = keys[Math.floor(rng() * keys.length)];
  return gens[pick](k, rng);
}

// which chips this source's pool actually supports (only families/categories with enough real colors)
function plvAvailable(prepped) {
  const C = plvCands(prepped), out = [{ id: "foryou", label: "For you" }];
  if (C.vivid.length >= 3) out.push({ id: "vivid", label: "Vivid" });
  if (prepped.length >= 2) {
    const pairs = []; for (let i = 0; i < prepped.length; i++) for (let j = i + 1; j < prepped.length; j++) pairs.push(plvOkDist(prepped[i].ok, prepped[j].ok));
    if (Math.max(...pairs, 0) > .1) out.push({ id: "gradients", label: "Gradients" });
  }
  if (C.pastel.length >= 3) out.push({ id: "pastels", label: "Pastels" });
  if (C.dark.length >= 3) out.push({ id: "darks", label: "Darks" });
  if (C.neutral.length >= 2 && C.accent.length >= 1) out.push({ id: "neutrals", label: "Neutrals + accent" });
  const colorful = prepped.filter(p => p.C > 10);
  if (colorful.some(a => colorful.some(b => { const d = plvHueDist(a.H, b.H); return d >= 150 && d <= 210; }))) out.push({ id: "opposites", label: "Opposites" });
  PLV_FAMS.forEach(fam => { if (C.byFam(fam).length >= 3) out.push({ id: fam, label: PLV_FAM_LABEL[fam] }); });
  return out;
}
// build the generator table for one source (closures over its prepped pool)
function plvGenerators(prepped) {
  const C = plvCands(prepped), gens = {
    vivid: (k, rng) => plvGenGeneric(C.vivid, prepped, k, rng, plvSortH),
    gradients: (k, rng) => plvGradient(prepped, k, rng),
    pastels: (k, rng) => plvGenGeneric(C.pastel, prepped, k, rng, plvSortL),
    darks: (k, rng) => plvGenDark(C, prepped, k, rng),
    neutrals: (k, rng) => plvGenNeutral(C, prepped, k, rng),
    opposites: (k, rng) => plvGenOpposites(prepped, k, rng),
  };
  PLV_FAMS.forEach(fam => { gens[fam] = (k, rng) => plvGenFamily(fam, C, prepped, k, rng); });
  gens.foryou = (k, rng) => plvGenForYou(gens, k, rng);
  return gens;
}

// ---------- beauty prior + taste scoring ----------
function plvBeauty(cols) {
  const items = cols.map(h => { const [L, C, H] = lch(h); return { L, C, H }; });
  const Ls = items.map(i => i.L), contrast = Math.max(...Ls) - Math.min(...Ls);
  const vivid = items.reduce((a, i) => a + i.C, 0) / items.length;
  let harm = 0, n = 0;
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    const d = plvHueDist(items[i].H, items[j].H);
    harm += Math.max(Math.cos(d / 180 * Math.PI), Math.cos((d - 180) / 180 * Math.PI)); n++;
  }
  return contrast * .012 + vivid * .018 + (n ? harm / n : 0) * .4;
}
function plvModel() { try { return typeof ldrState === "function" ? ldrState().m : null; } catch (e) { return null; } }
function plvScore(cols, m) {
  let s = plvBeauty(cols);
  if (m && m.n >= 3) { try { s += 1.1 * TASTE.utility(m, TASTE.tasteFeat(cols, null)); } catch (e) {} }
  return s;
}
function plvRefFeat(colsList) {
  if (!colsList.length) return null;
  const n = colsList.length, acc = TASTE.tasteFeat(colsList[0], null).map(() => 0);
  colsList.forEach(cols => { const f = TASTE.tasteFeat(cols, null); f.forEach((v, i) => acc[i] += v / n); });
  return acc;
}

// ---------- feed generation, paged, deterministic, de-duplicated within a source+category+count ----------
let PLV_FEEDS = new Map();
function plvFeedState(key) { let st = PLV_FEEDS.get(key); if (!st) PLV_FEEDS.set(key, st = { allShown: [], pages: {} }); return st; }
function plvHash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function plvTooSimilar(cols, shownList) {
  const okA = cols.map(h => glpOk(h));
  return shownList.some(other => {
    if (other.length !== cols.length) return false;
    const okB = other.map(h => glpOk(h));
    const as = okA.slice().sort((a, b) => a[0] - b[0]), bs = okB.slice().sort((a, b) => a[0] - b[0]);
    let sum = 0; for (let i = 0; i < as.length; i++) sum += plvOkDist(as[i], bs[i]);
    return sum / as.length < .05;
  });
}
function plvGenPage(key, gen, count, pageIdx) {
  const st = plvFeedState(key);
  if (st.pages[pageIdx]) return st.pages[pageIdx];
  const rng = glRng(plvHash(key + ":" + pageIdx) || 1), m = plvModel(), collected = [];
  let tries = 0;
  while (collected.length < 24 && tries < 500) {
    tries++;
    const cols = gen(count, rng); if (!cols || cols.length < Math.min(count, 2)) continue;
    const sig = cols.slice().sort().join("|");
    if (collected.some(c => c.sig === sig)) continue;
    if (plvTooSimilar(cols, st.allShown)) continue;
    collected.push({ cols, sig, score: plvScore(cols, m) });
  }
  collected.sort((a, b) => b.score - a.score);
  const page = collected.slice(0, 24).map(c => c.cols);
  page.forEach(p => st.allShown.push(p));
  st.pages[pageIdx] = page;
  return page;
}

// ---------- pool loading per source ----------
function plvLoadPool(kind, id, extra) {
  if (kind === "photo") {
    return Promise.resolve({ pool: (extra && extra.pool) || [], img: extra && extra.img, title: (extra && extra.from) || "Your photo", canRead: true });
  }
  if (kind === "painting") {
    return loadGallery().then(() => glDetail(+id)).then(d => ({
      pool: glPoolDecode(d.pl), img: glSmall(d) ? d.img : glBig(d.img),
      title: (d.a ? d.a + " · " : "") + (d.t || "Painting"), canRead: true, idx: +id, rec: d,
    }));
  }
  if (kind === "painter") {
    const v = typeof DATA_VER !== "undefined" && DATA_VER ? "?v=" + DATA_VER : "";
    return fetch("data/games/oo/painter/" + id + ".json" + v).then(r => r.ok ? r.json() : null).then(j => {
      if (!j || !Array.isArray(j.sw) || !j.sw.length) return { pool: [], img: null, title: id, canRead: false };
      const tot = j.sw.reduce((a, r) => a + r[1], 0) || 1;
      return { pool: j.sw.map(([h, w]) => ({ h, share: w / tot })), img: null, title: j.name || id, canRead: false };
    }).catch(() => ({ pool: [], img: null, title: id, canRead: false }));
  }
  return Promise.resolve({ pool: [], img: null, title: "", canRead: false });
}

// ---------- pixel dots: where each shown color sits on the source image (best-effort; skipped on CORS taint) ----------
function plvDots(imgEl, cols) {
  try {
    const w = imgEl.naturalWidth || imgEl.width, h = imgEl.naturalHeight || imgEl.height;
    if (!w || !h) return null;
    const sc = Math.min(1, 110 / Math.max(w, h)), cw = Math.max(1, Math.round(w * sc)), ch = Math.max(1, Math.round(h * sc));
    const c = document.createElement("canvas"); c.width = cw; c.height = ch;
    const x = c.getContext("2d"); x.drawImage(imgEl, 0, 0, cw, ch);
    const d = x.getImageData(0, 0, cw, ch).data;   // throws if the canvas is CORS-tainted
    return cols.map(hex => {
      const [L, a, b] = lab(hex); let best = null, bd = Infinity;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] < 128) continue;
        const r = d[i] / 255, g = d[i + 1] / 255, bl = d[i + 2] / 255;
        const lin = v => v > .04045 ? ((v + .055) / 1.055) ** 2.4 : v / 12.92, R = lin(r), G = lin(g), B = lin(bl);
        const f = t => t > .008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
        const X = f((R * .4124 + G * .3576 + B * .1805) / .95047), Y = f(R * .2126 + G * .7152 + B * .0722), Z = f((R * .0193 + G * .1192 + B * .9505) / 1.08883);
        const L2 = 116 * Y - 16, a2 = 500 * (X - Y), b2 = 200 * (Y - Z), dd = (L - L2) ** 2 + (a - a2) ** 2 + (b - b2) ** 2;
        if (dd < bd) { bd = dd; const px = i / 4; best = { x: (px % cw) / cw, y: Math.floor(px / cw) / ch }; }
      }
      return best;
    });
  } catch (e) { return null; }
}

// ---------- the screen ----------
function plvSrcKey(kind, id) { return kind + ":" + (id == null ? "_" : id); }
function plvPins(srcKey) { S.plv = S.plv || {}; return S.plv[srcKey] || (S.plv[srcKey] = []); }
function plvIsPinned(srcKey, cols) { const sig = cols.join("|"); return plvPins(srcKey).some(p => p.cols.join("|") === sig); }
function plvSwatchRow(cols, cls) { return `<div class="plv-sw-row ${cls || ""}">${cols.map(h => `<i style="--c:${h}"></i>`).join("")}</div>`; }

function plvOpen(kind, id, extra) {
  const key0 = "plv:" + kind + ":" + (id == null ? "new" : id);
  if (XSTACK[XSTACK.length - 1] !== key0) XSTACK.push(key0);
  const el = show(`<header class="art-top"><button class="icon-btn glass" data-back aria-label="Back">${ICON.back}</button><span class="eyebrow">Palette view</span><button class="icon-btn" data-plvpins aria-label="Pinned here">${ICON.heart}</button></header>
    <div class="plv-loading"><p class="fine">Reading the colors…</p></div>`, "article plv-screen");
  el.querySelector("[data-back]").onclick = xBack;
  plvLoadPool(kind, id, extra).then(src => plvRender(el, kind, id, src)).catch(() => {
    el.querySelector(".plv-loading").innerHTML = `<p class="fine">Couldn't read this source's colors.</p>`;
  });
}

function plvRender(el, kind, id, src) {
  const srcKey = plvSrcKey(kind, id);
  const prepped = plvPrep(src.pool || []);
  if (prepped.length < 2) { el.querySelector(".plv-loading").innerHTML = `<p class="fine">Not enough measured colors here yet.</p>`; return; }
  const gens = plvGenerators(prepped), avail = plvAvailable(prepped);
  const m = plvModel(), untrained = !m || m.n < 20;
  let cat = "foryou", count = 5, ITEMS = [], page = 0, feedRef = null, scrollBuf = [], rendered = 0;

  const feedKey = () => srcKey + "|" + cat + "|" + count;
  const genForCat = () => gens[cat] || gens.foryou;
  const loadMore = () => {
    const batch = plvGenPage(feedKey(), genForCat(), count, page++);
    batch.forEach(cols => ITEMS.push({ cols, edited: null }));
    feedRef = plvRefFeat(ITEMS.slice(0, 40).map(it => it.edited || it.cols));
    return batch.length;
  };

  const head = el.querySelector(".art-top");
  head.insertAdjacentHTML("afterend", `
    <p class="plv-src">${esc(src.title || "")}</p>
    <div class="plv-chips" data-plvchips role="group" aria-label="Category">${avail.map(c => `<button class="${c.id === cat ? "on" : ""}" data-plvcat="${c.id}">${esc(c.label)}</button>`).join("")}</div>
    <div class="plv-count-row"><span>Colors</span><input type="range" data-plvcnt aria-label="Colors per palette"><b class="plv-count-n" data-plvcntn></b></div>
    <p class="plv-foryou-note" data-plvforyou hidden>Rate a few in <button data-plvladder>Teach it your eye</button> to tune this.</p>
    <div class="plv-feed" data-plvfeed></div>
    <div class="plv-end" data-plvend hidden><p class="fine">That's every palette in this category for now.</p></div>`);
  el.querySelector(".plv-loading").remove();

  const cnt = countify(el.querySelector("[data-plvcnt]"), {
    min: 2, max: 10, value: count, out: el.querySelector("[data-plvcntn]"),
    onSet: (v, final) => { if (final && v !== count) { count = v; resetFeed(); } },
  });

  function paintForYouNote() { const n = el.querySelector("[data-plvforyou]"); if (n) n.hidden = cat !== "foryou" || !untrained; }
  function paintChips() { el.querySelectorAll("[data-plvcat]").forEach(b => b.classList.toggle("on", b.dataset.plvcat === cat)); }

  function resetFeed() {
    ITEMS = []; page = 0; rendered = 0;
    const feedEl = el.querySelector("[data-plvfeed]"); feedEl.innerHTML = ""; feedEl.scrollTop = 0;
    const got = loadMore();
    renderBatch(ITEMS);
    el.querySelector("[data-plvend]").hidden = !!got;
    paintForYouNote();
  }

  function renderBatch(items) {
    const feedEl = el.querySelector("[data-plvfeed]");
    items.slice(rendered).forEach(item => { feedEl.insertBefore(plvRowEl(item), feedEl.querySelector(".plv-sentinel")); rendered++; });
    wireRows(feedEl);
    plvArmLazy(feedEl, () => {
      const got = loadMore();
      if (got) { renderBatch(ITEMS); el.querySelector("[data-plvend]").hidden = true; }
      else el.querySelector("[data-plvend]").hidden = false;
    }, scrollBuf, () => feedRef, cols => plvIsPinned(srcKey, cols));
  }

  function plvRowEl(item) {
    const row = document.createElement("div");
    row.className = "plv-row-wrap";
    row.innerHTML = `<button type="button" class="plv-row" data-plvrow>${plvSwatchRow(item.edited || item.cols)}${item.edited ? `<span class="plv-edited">Edited</span>` : ""}</button>
      <button type="button" class="plv-heart ${plvIsPinned(srcKey, item.edited || item.cols) ? "on" : ""}" data-plvheart aria-label="Pin">${plvIsPinned(srcKey, item.edited || item.cols) ? ICON.heartOn : ICON.heart}</button>`;
    row._item = item;
    return row;
  }

  function doPin(row, item) {
    const cols = item.edited || item.cols, was = plvIsPinned(srcKey, cols);
    if (was) { S.plv[srcKey] = plvPins(srcKey).filter(p => p.cols.join("|") !== cols.join("|")); }
    else {
      plvPins(srcKey).unshift({ cols: cols.slice(), cat, at: today() });
      const m2 = plvModel();
      if (m2 && feedRef) try { TASTE.update(m2, TASTE.sub(TASTE.tasteFeat(cols, null), feedRef), .75, .6); } catch (e) {}
    }
    save(); buzz(was ? 6 : 10);
    const h = row.querySelector("[data-plvheart]"); h.classList.toggle("on", !was); h.innerHTML = !was ? ICON.heartOn : ICON.heart;
    paintPinsCount();
  }

  function paintPinsCount() { /* the heart in the header just reopens the list; count lives inside the sheet */ }

  function wireRows(feedEl) {
    feedEl.querySelectorAll(".plv-row-wrap").forEach(row => {
      if (row._wired) return; row._wired = true;
      const item = row._item;
      const onPinChange = () => {
        const h = row.querySelector("[data-plvheart]"), on = plvIsPinned(srcKey, item.edited || item.cols);
        h.classList.toggle("on", on); h.innerHTML = on ? ICON.heartOn : ICON.heart;
        row.querySelector(".plv-sw-row").outerHTML = plvSwatchRow(item.edited || item.cols);
        const ed = row.querySelector(".plv-edited"); if (item.edited && !ed) row.querySelector("[data-plvrow]").insertAdjacentHTML("beforeend", `<span class="plv-edited">Edited</span>`);
      };
      // one tap opens the palette right away (no delay); a genuine fast double-tap (the browser's own click-
      // count, not a timer) ALSO pins it, same motion as swatch.js's Instagram-style like elsewhere in the app
      row.querySelector("[data-plvrow]").onclick = e => {
        if (e.detail >= 2) doPin(row, item);
        plvExpand(item, { srcKey, cat, src, prepped, gens, m: plvModel(), feedRef, onPinChange });
      };
      row.querySelector("[data-plvheart]").onclick = () => doPin(row, item);
    });
  }

  el.querySelector("[data-plvchips]").onclick = e => {
    const b = e.target.closest("[data-plvcat]"); if (!b || b.dataset.plvcat === cat) return;
    buzz(5); cat = b.dataset.plvcat; paintChips(); resetFeed();
  };
  const ladderBtn = el.querySelector("[data-plvladder]"); if (ladderBtn) ladderBtn.onclick = () => { if (typeof tasteLadderIntro === "function") tasteLadderIntro(); };
  el.querySelector("[data-plvpins]").onclick = () => plvPinnedSheet(srcKey, src);

  resetFeed();
}

// a row scrolled fully past, unpinned: a soft, rare negative signal (David's spec: ~0.05 total, once per screenful)
function plvArmLazy(feedEl, onNearEnd, scrollBuf, getRef, isPinned) {
  const rows = [...feedEl.querySelectorAll(".plv-row-wrap")].filter(r => !r._lazyObs);
  const io = new IntersectionObserver(entries => entries.forEach(en => {
    if (en.isIntersecting) { en.target._wasSeen = true; return; }
    if (!en.target._wasSeen || en.target._scored) return;
    en.target._scored = true;
    const item = en.target._item, cols = item.edited || item.cols;
    if (isPinned && isPinned(cols)) return;
    scrollBuf.push(cols);
    if (scrollBuf.length >= 6) {
      const ref = getRef && getRef(); const m2 = plvModel();
      if (m2 && ref) { try { const mean = plvRefFeat(scrollBuf); TASTE.update(m2, TASTE.sub(mean, ref), .25, .05); save(); } catch (e) {} }
      scrollBuf.length = 0;
    }
  }), { threshold: 0 });
  rows.forEach(r => { r._lazyObs = true; io.observe(r); });
  const sentinel = feedEl.querySelector(".plv-sentinel") || (() => { const s = document.createElement("div"); s.className = "plv-sentinel"; feedEl.appendChild(s); return s; })();
  feedEl.appendChild(sentinel);
  if (sentinel._io) sentinel._io.disconnect();
  sentinel._io = new IntersectionObserver(entries => { if (entries[0].isIntersecting) onNearEnd(); }, { rootMargin: "800px" });
  sentinel._io.observe(sentinel);
}

// ---------- expand (a sheet): names, nearest-color link, a thumbnail with dots, swap-by-tap, pin ----------
function plvExpand(item, ctx) {
  const cols = () => item.edited || item.cols;
  const names = () => cols().map(h => nameOf(h));
  const render = () => `<div class="plv-x">${mnHead("Palette")}
    <div class="plv-x-sw">${cols().map((h, i) => `<button type="button" class="plv-x-c" data-plvslot="${i}" style="--c:${h}" data-ink="${ink(h)}" aria-label="Swap this color"></button>`).join("")}</div>
    <div class="plv-x-names">${names().map((n, i) => `<button type="button" class="plv-x-name" data-swatch="${cols()[i]}">${esc(n.text || n.n || cols()[i])}</button>`).join("")}</div>
    ${item.edited ? `<button type="button" class="plv-x-reset" data-plvreset>Reset to original</button>` : ""}
    <div class="plv-x-thumb" data-plvthumb hidden><img alt="${esc(ctx.src.title || "")}"><div class="plv-x-dots" data-plvdots></div></div>
    <button type="button" class="btn ${plvIsPinned(ctx.srcKey, cols()) ? "ghost" : ""}" data-plvxpin>${plvIsPinned(ctx.srcKey, cols()) ? "Pinned · remove" : "Pin this palette"}</button>
  </div>`;
  const { sh, close } = sheet(render());
  function wireSwatches() {
    sh.querySelectorAll("[data-plvslot]").forEach(b => b.onclick = () => plvSwapSheet(item, +b.dataset.plvslot, ctx, () => { refreshAll(); ctx.onPinChange && ctx.onPinChange(); }));
  }
  function refreshAll() {
    sh.querySelector(".plv-x-sw").innerHTML = cols().map((h, i) => `<button type="button" class="plv-x-c" data-plvslot="${i}" style="--c:${h}" data-ink="${ink(h)}" aria-label="Swap this color"></button>`).join("");
    sh.querySelector(".plv-x-names").innerHTML = names().map((n, i) => `<button type="button" class="plv-x-name" data-swatch="${cols()[i]}">${esc(n.text || n.n || cols()[i])}</button>`).join("");
    wireSwatches();
    let resetBtn = sh.querySelector("[data-plvreset]");
    if (item.edited && !resetBtn) sh.querySelector(".plv-x-names").insertAdjacentHTML("afterend", `<button type="button" class="plv-x-reset" data-plvreset>Reset to original</button>`);
    if (!item.edited && resetBtn) resetBtn.remove();
    resetBtn = sh.querySelector("[data-plvreset]"); if (resetBtn) resetBtn.onclick = () => { item.edited = null; refreshAll(); ctx.onPinChange && ctx.onPinChange(); };
    const pinBtn = sh.querySelector("[data-plvxpin]"), on = plvIsPinned(ctx.srcKey, cols());
    pinBtn.textContent = on ? "Pinned · remove" : "Pin this palette"; pinBtn.classList.toggle("ghost", on);
  }
  wireSwatches();
  sh.querySelector("[data-plvxpin]").onclick = () => {
    const on = plvIsPinned(ctx.srcKey, cols());
    if (on) S.plv[ctx.srcKey] = plvPins(ctx.srcKey).filter(p => p.cols.join("|") !== cols().join("|"));
    else { plvPins(ctx.srcKey).unshift({ cols: cols().slice(), cat: ctx.cat, at: today() }); const m2 = ctx.m; if (m2 && ctx.feedRef) try { TASTE.update(m2, TASTE.sub(TASTE.tasteFeat(cols(), null), ctx.feedRef), .75, .6); } catch (e) {} }
    save(); buzz(on ? 6 : 10); refreshAll(); ctx.onPinChange && ctx.onPinChange();
  };
  let resetBtn0 = sh.querySelector("[data-plvreset]"); if (resetBtn0) resetBtn0.onclick = () => { item.edited = null; refreshAll(); ctx.onPinChange && ctx.onPinChange(); };
  // the thumbnail with dots: only for a readable source image (gracefully absent otherwise)
  if (ctx.src.img && ctx.src.canRead) {
    const thumb = sh.querySelector("[data-plvthumb]"), img = thumb.querySelector("img");
    img.onload = () => { const dots = plvDots(img, cols()); thumb.hidden = false; thumb.querySelector("[data-plvdots]").innerHTML = dots ? dots.map((d, i) => d ? `<i style="--c:${cols()[i]};left:${(d.x * 100).toFixed(2)}%;top:${(d.y * 100).toFixed(2)}%"></i>` : "").join("") : ""; };
    img.src = ctx.src.img;
  }
}

// ---------- swap sheet: Suggested / From source / Adjust ----------
function plvSwapSheet(item, slot, ctx, onDone) {
  const original = (item.edited || item.cols).slice();
  const working = original.slice();
  const before = working[slot];
  let mode = "sug", altsTried = [];
  const prepped = ctx.prepped;
  const excludeSig = new Set(working.filter((_, i) => i !== slot));
  const suggestions = () => {
    const cands = prepped.filter(p => !excludeSig.has(p.h) && p.h !== working[slot]);
    const scored = cands.map(p => { const trial = working.slice(); trial[slot] = p.h; return { h: p.h, s: plvScore(trial, ctx.m) }; });
    scored.sort((a, b) => b.s - a.s);
    return scored.slice(0, 8).map(s => s.h);
  };
  const sugList = suggestions();
  const { sh, close } = sheet(`<div class="plv-swap">${mnHead("Swap color " + (slot + 1), { close: true })}
    <div class="plv-swap-preview">${plvSwatchRow(working, "")}</div>
    <div class="seg plv-swap-tabs"><button data-plvtab="sug" class="on">Suggested</button><button data-plvtab="src">From source</button><button data-plvtab="adj">Adjust</button></div>
    <div class="plv-swap-body" data-plvswapbody></div>
    <button type="button" class="btn ghost" data-plvundo style="margin-top:12px">Undo</button>
  </div>`, { z: 70 });
  const preview = () => { sh.querySelector(".plv-swap-preview").innerHTML = plvSwatchRow(working); };
  const apply = hex => { working[slot] = hex; preview(); };
  function paintBody() {
    const body = sh.querySelector("[data-plvswapbody]");
    if (mode === "sug") {
      body.innerHTML = `<div class="plv-swap-grid">${sugList.map(h => `<button type="button" class="plv-swap-opt" data-plvpick="${h}" style="--c:${h}"></button>`).join("")}</div>`;
      body.querySelectorAll("[data-plvpick]").forEach(b => b.onclick = () => { if (!altsTried.includes(b.dataset.plvpick) && b.dataset.plvpick !== working[slot]) altsTried.push(b.dataset.plvpick); apply(b.dataset.plvpick); buzz(5); });
    } else if (mode === "src") {
      if (ctx.src.img && ctx.src.canRead) {
        body.innerHTML = `<div class="plv-swap-img"><img alt=""></div><p class="fine">Drag over the picture to pick a color.</p>`;
        const img = body.querySelector("img");
        img.onload = () => { try { eyedropAttach(img, { onMove: hex => apply(hex), onPick: hex => apply(hex) }); } catch (e) { body.insertAdjacentHTML("beforeend", `<div class="plv-swap-grid">${prepped.map(p => `<button type="button" class="plv-swap-opt" data-plvpick2="${p.h}" style="--c:${p.h}"></button>`).join("")}</div>`); body.querySelectorAll("[data-plvpick2]").forEach(b => b.onclick = () => apply(b.dataset.plvpick2)); } };
        img.src = ctx.src.img;
      } else {
        body.innerHTML = `<p class="fine">This source's picture isn't readable here — pick from its colors instead.</p><div class="plv-swap-grid">${prepped.map(p => `<button type="button" class="plv-swap-opt" data-plvpick2="${p.h}" style="--c:${p.h}"></button>`).join("")}</div>`;
        body.querySelectorAll("[data-plvpick2]").forEach(b => b.onclick = () => apply(b.dataset.plvpick2));
      }
    } else {
      body.innerHTML = `<div data-plvcp></div>`;
      colorPicker(body.querySelector("[data-plvcp]"), { hex: working[slot], onChange: hex => apply(hex) });
    }
  }
  sh.querySelectorAll("[data-plvtab]").forEach(b => b.onclick = () => { mode = b.dataset.plvtab; sh.querySelectorAll("[data-plvtab]").forEach(x => x.classList.toggle("on", x === b)); paintBody(); });
  sh.querySelector("[data-plvundo]").onclick = () => { apply(before); };
  paintBody();
  let finished = false;
  const finish = () => {
    if (finished) return; finished = true;
    if (working[slot] !== before) {
      item.edited = working.slice();
      try {
        const m2 = ctx.m;
        if (m2) {
          TASTE.update(m2, TASTE.sub(TASTE.tasteFeat(working, null), TASTE.tasteFeat(original, null)), 1, 1);
          altsTried.filter(h => h !== working[slot]).slice(0, 5).forEach(alt => { const altPal = working.slice(); altPal[slot] = alt; try { TASTE.update(m2, TASTE.sub(TASTE.tasteFeat(working, null), TASTE.tasteFeat(altPal, null)), 1, .3); } catch (e) {} });
          save();
        }
      } catch (e) {}
    }
    onDone && onDone();
  };
  const closeIcon = sh.querySelector("[data-mn-close]"); if (closeIcon) closeIcon.onclick = () => { close(); finish(); };
  new MutationObserver((_, ob) => { if (!sh.isConnected) { ob.disconnect(); finish(); } }).observe(document.body, { childList: true });
}

// ---------- pinned-here sheet ----------
function plvPinnedSheet(srcKey, src) {
  const pins = plvPins(srcKey);
  const { sh, close } = sheet(`<div class="plv-pins">${mnHead("Pinned here · " + pins.length, { close: true })}
    ${pins.length ? pins.map((p, i) => `<div class="plv-pin-row">${plvSwatchRow(p.cols)}<button type="button" class="plv-pin-save" data-plvsave="${i}">Save</button></div>`).join("")
      : `<p class="fine">Nothing pinned yet. Tap the heart on a palette you like, or double-tap its row.</p>`}
  </div>`);
  sh.querySelectorAll("[data-plvsave]").forEach(b => b.onclick = () => { const p = pins[+b.dataset.plvsave]; if (p && typeof keepPalette === "function") keepPalette(p.cols, src.title || "Palette view"); });
}
