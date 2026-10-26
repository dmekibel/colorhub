"use strict";
// The paintings home (David, 2026-10-26: "a Pinterest for paintings"). The Today page's Paintings tab is a list of paintings and nothing else;
// a second row of "lenses" holds ready-made lists: For you, a movement, a painter, "Like this one", "Near a color", and whatever you follow.
// Everything here is prefixed hf / HF_. js/todayfeed.js draws the screen; this file decides WHICH paintings, in which order.
//
// Lens ids (S.tf.lens):  "foryou"   "m:<movement name>"   "p:<painter name>"   "l:<gallery index>" (like this one)   "c:#HEX" (near a color)
// State, all on the device (S is migrated, never wiped; unknown keys are kept):
//   S.favPainter = { "<painter name>": { at } }   S.favMove = { "<movement name>": { at } }   (a like is a follow: it becomes a chip)
//   S.tf = { filter: kind, lens, roll: { like, color }, likeBy: "vibe"|"color", pOrder: "shuffle"|"old", seen: [gallery indexes] }
// Paintings come from the gallery (js/gallery.js) and its facets (js/browse.js xbLoad: painter and movement per painting). A hidden painting
// (GAL.hid: blank scans, photos of rooms, data/gallery/hidden.json) is never in any list.
// Order: a weighted shuffle seeded by the date, so every list is the same all day for everyone and new tomorrow; the weight favors colorful
// paintings (GAL.C) and never extreme panoramas. "For you" also learns (see hfForYou).

const HF_SEEN_MAX = 2000;
const HF_CHIP_MAX = 6;       // followed lenses shown in row two
const HF_KEEP = 420;         // a lens list is this long; For you asks for more when it runs out
const hfS = () => (S.tf && typeof S.tf === "object" ? S.tf : (S.tf = {}));
const hfStore = k => (S[k] && typeof S[k] === "object" && !Array.isArray(S[k]) ? S[k] : (S[k] = {}));
const hfHas = (kind, name) => !!hfStore(kind === "p" ? "favPainter" : "favMove")[name];
function hfSetFollow(kind, name, on) {
  const st = hfStore(kind === "p" ? "favPainter" : "favMove");
  if (on) st[name] = { at: Date.now() }; else delete st[name];
  save();
  if (typeof learnerLog === "function") { try { learnerLog({ type: on ? "like" : "unlike", kind: kind === "p" ? "painter" : "movement", name }); } catch (e) {} }
}
const hfFollows = () => [
  ...Object.entries(hfStore("favPainter")).map(([n, v]) => ({ kind: "p", name: n, at: (v && v.at) || 0 })),
  ...Object.entries(hfStore("favMove")).map(([n, v]) => ({ kind: "m", name: n, at: (v && v.at) || 0 })),
].sort((a, b) => b.at - a.at);
const hfHid = i => !!(GAL && GAL.hid && GAL.hid[i]);

// ---------- the pools ----------
let HF_F = null, HF_COUNTS = null;
const hfFacets = () => (HF_F ? Promise.resolve(HF_F) : xbLoad().then(F => (HF_F = F)));
// how many visible paintings each painter and movement has (once)
function hfCounts(F) {
  if (HF_COUNTS && HF_COUNTS.F === F) return HF_COUNTS;
  const art = new Int32Array(F.meta.artists.length + 2), mv = new Int32Array(F.meta.movements.length + 2);
  for (let i = 0; i < F.N; i++) { if (hfHid(i)) continue; art[F.artist[i]]++; mv[F.mv[i]]++; }
  return (HF_COUNTS = { F, art, mv });
}
// ---------- beauty (David, 2026-10-26: "the app can make honest aesthetic judgments; some work is simply prettier; the home should give people a
// beautiful palette for their eyes") ----------
// A painting's beauty is 0..1, from two readings:
//   the palette itself (computed here from its six measured colors): HARMONY (the hues sit in one family, or two opposed ones, or three evenly
//     spread), VIVIDNESS (a rich chroma, not gray and not garish), BRIGHTNESS and CONTRAST (light that opens up, a real value range), minus MUDDINESS
//     (the share of dull brown-olive mid-tones that old varnish and age leave);
//   the picture's appeal, from data/gallery/aesthetic.bin (tools/audit_beauty.py: an image model's "beautiful, luminous" reading, ranked against
//     paintings of its own movement and country so one tradition cannot take over the home). A painting without one gets the middle value.
// The home leans on it hard (hfW cubes it); lists you asked for by name (a painter, a movement) lean on it too, so the prettiest come first.
let HF_B = null, HF_BP = null, HF_AES = null;
// How much people like a color on its own (Palmer and Schloss's color-preference studies, and every "favorite color" survey): clear blues first, then
// teals, greens and violets, soft pinks and pastels; dull olive, mustard and brown last. By LCh hue, scaled by how clear and light the color is.
const HF_HUE = [[0, .72], [25, .62], [55, .52], [80, .4], [98, .34], [120, .6], [150, .82], [190, .92], [235, .96], [270, 1], [310, .95], [338, .86], [360, .72]];
function hfLiking(h, L, C) {   // 0..1
  if (C < 7) return L > 82 ? .62 : L < 22 ? .35 : .5;   // whites and soft grays are calm, near-black is heavy
  h = ((h % 360) + 360) % 360; let k = 1; while (k < HF_HUE.length - 1 && HF_HUE[k][0] < h) k++;
  const a = HF_HUE[k - 1], b = HF_HUE[k], t = (h - a[0]) / (b[0] - a[0] || 1); let v = a[1] + (b[1] - a[1]) * t;
  const pastel = L >= 66 && C >= 10 && C <= 46;   // a pale, soft color: the pinks, lavenders, sky blues and mints people reach for
  if (pastel) v = Math.min(1, v + .12 + (v < .7 ? .12 : 0));
  if (L < 38) v *= .55 + L / 100;            // dark colors lose
  if (h > 55 && h < 125 && L < 60) v *= .6;   // dark yellows and olives lose most
  if (C > 62) v *= .88;                       // garish loses a little
  return v;
}
function hfPaletteScore(i) {
  const G = GAL; let wc = 0, cx = 0, cy = 0, c2x = 0, c2y = 0, c3x = 0, c3y = 0, Cw = 0, Lm = 0, muddy = 0, pleasure = 0;
  for (let j = 0; j < 6; j++) {
    const k = i * 6 + j, sh = G.sh[k], ch = G.ch[k], L = G.lab[k * 3], h = G.hu[k], hu = h * Math.PI / 180;
    Lm += sh * L; Cw += sh * ch; pleasure += sh * hfLiking(h, L, ch);
    const w = sh * Math.min(1, ch / 28);
    if (ch >= 10) { wc += w; cx += w * Math.cos(hu); cy += w * Math.sin(hu); c2x += w * Math.cos(2 * hu); c2y += w * Math.sin(2 * hu); c3x += w * Math.cos(3 * hu); c3y += w * Math.sin(3 * hu); }
    if (L > 22 && L < 62 && ch > 6 && ch < 32 && h > 40 && h < 105) muddy += sh;
  }
  let Ls = 0; for (let j = 0; j < 6; j++) { const k = i * 6 + j, d = G.lab[k * 3] - Lm; Ls += G.sh[k] * d * d; }
  Ls = Math.sqrt(Ls);
  const harmony = wc < .1 ? .55 : Math.max(Math.hypot(cx, cy), .93 * Math.hypot(c2x, c2y), .82 * Math.hypot(c3x, c3y)) / wc;
  const vivid = Math.max(0, 1 - Math.abs(Cw - 30) / 42), contrast = Math.min(1, Ls / 22), bright = Math.max(0, 1 - Math.abs(Lm - 68) / 50);
  return Math.max(0, Math.min(1, .26 * harmony + .26 * pleasure + .16 * vivid + .14 * bright + .1 * contrast + .08 - .5 * muddy));
}
// ready once (the aesthetic file is 200 KB; it gets 2 s, then the palette reading stands alone)
function hfBeautyReady() {
  if (HF_B) return Promise.resolve();
  return HF_BP || (HF_BP = hfBudget(loadGallery().then(async () => {
    try { const r = await fetch("data/gallery/aesthetic.bin"); if (r.ok) { const b = new Uint8Array(await r.arrayBuffer()); if (b.length === GAL.n) HF_AES = b; } } catch (e) {}
  }), 2000).then(() => {
    const n = GAL.n, B = new Float32Array(n);
    for (let i = 0; i < n; i++) { const p = hfPaletteScore(i); B[i] = HF_AES ? .55 * p + .45 * HF_AES[i] / 255 : p; }
    HF_B = B;
  }));
}
const hfBeauty = i => (HF_B ? HF_B[i] : GAL.C[i] / 60);
// the beauty a painting needs to be on the HOME without being asked for: the top slice (`q` of the archive sits below it)
let HF_CUT = null;
const hfCut = q => { if (!HF_B) return 0; if (!HF_CUT) HF_CUT = Float32Array.from(HF_B).sort(); return HF_CUT[Math.min(HF_CUT.length - 1, Math.floor(HF_CUT.length * q))]; };
// the weight of a painting in a shuffle: beauty cubed (the prettiest come first but the order is still a shuffle), a body-of-work boost for a
// painter with real depth, extreme panoramas hardly at all
const hfW = i => {
  let w = Math.pow(.08 + hfBeauty(i), 3) * (GAL.ar[i] > .45 && GAL.ar[i] < 2.4 ? 1 : .25);
  if (HF_COUNTS) { const a = HF_COUNTS.F.artist[i]; if (!a || HF_COUNTS.art[a] < 40) w *= .4; }
  if (GAL.year[i] === GL_UNDATED) w *= .6;
  return w;
};
// a weighted shuffle of `cand` (an array of indexes, or null for the whole archive), seeded: the first `k`
function hfPick(cand, rnd, k, skip, minB) {
  const G = GAL, sc = new Float32Array(G.n).fill(Infinity);
  const put = i => { if (!hfHid(i) && !(skip && skip.has(i)) && !(minB && hfBeauty(i) < minB)) sc[i] = -Math.log(rnd() + 1e-9) / hfW(i); };
  if (cand) for (let n = 0; n < cand.length; n++) put(cand[n]); else for (let i = 0; i < G.n; i++) put(i);
  return Array.from(twTopK(sc, k)).sort((a, b) => sc[a] - sc[b]);
}
const hfIndexBy = (F, arr, v) => { const out = []; for (let i = 0; i < F.N; i++) if (arr[i] === v) out.push(i); return out; };
// a promise that gives up: whatever is slow never holds the screen (the home must never hang)
const hfBudget = (p, ms, fallback = null) => Promise.race([p, new Promise(r => setTimeout(() => r(fallback), ms))]);
const hfSeedOf = (k, extra) => seededRnd(hash("hf" + k + extra));

// ---------- the daily presets ----------
// Row two before you have followed anything: a movement, a painter, a painting to be "like", a color, picked by date from good pools.
const hfRoll = id => (hfS().roll && hfS().roll[id]) | 0;
async function hfPresets(k) {
  const F = await hfFacets(), C = hfCounts(F); await hfBeautyReady();
  const pick = (arr, r) => arr[Math.floor(r() * arr.length)];
  const mvs = [], ars = [];
  // movements people know (the rest of the 400-painting movements only if none of those exist); painters with the biggest bodies of work
  const KNOWN = /impression|baroque|rococo|romantic|realism|renaissance|neoclass|symbol|expression|cubis|surreal|nouveau|raphael|golden age|ukiyo|manner|fauv|point|luminis|hudson|orientalis|primitiv|futur|modern/i;
  F.meta.movements.forEach((n, j) => { if (n && C.mv[j + 1] >= 150 && KNOWN.test(n)) mvs.push(n); });
  if (!mvs.length) F.meta.movements.forEach((n, j) => { if (n && C.mv[j + 1] >= 400 && !/^none$/i.test(n)) mvs.push(n); });
  F.meta.artists.forEach((a, j) => { if (C.art[j + 1] >= 80) ars.push({ n: a[0], c: C.art[j + 1] }); });
  ars.sort((a, b) => b.c - a.c); const topArs = ars.slice(0, 90);
  const rm = hfSeedOf(k, "m"), rp = hfSeedOf(k, "p"), rl = hfSeedOf(k + "|" + hfRoll("like"), "l"), rc = hfSeedOf(k + "|" + hfRoll("color"), "c");
  const mv = mvs.length ? pick(mvs, rm) : "", pa = topArs.length ? pick(topArs, rp).n : "";
  // like this one: the most colorful of a dozen random paintings by painters that have a body of work
  // (painters from the best-represented ninety only, dated 1450 or later: a seed people would be glad to be shown)
  const top = new Set(topArs.map(a => a.n)); let li = -1, lb = -1;
  for (let t = 0; t < 400; t++) {
    const i = Math.floor(rl() * GAL.n), y = GAL.year[i];
    if (hfHid(i) || !F.artist[i] || !top.has(F.meta.artists[F.artist[i] - 1][0]) || !(GAL.ar[i] > .6 && GAL.ar[i] < 1.7) || y === GL_UNDATED || y < 1450) continue;
    if (hfBeauty(i) > lb) { lb = hfBeauty(i); li = i; }
  }
  // the color: only ones people tend to like (a clear blue, a soft pink, a fresh green), never a dull brown
  const nice = TODAY_TABLE.filter(r => { const c = lch(r[2]); return c[1] >= 12 && hfLiking(c[2], c[0], c[1]) >= .66; });
  const row = nice.length ? pick(nice, rc) : TODAY_TABLE.length ? pick(TODAY_TABLE, rc) : null;
  return { k, mv, pa, li, color: row ? { n: row[1], h: row[2] } : null };
}
const hfFollowId = f => f.kind + ":" + f.name;
// a painting's title short enough for a chip
function hfShortTitle(t) { t = String(t || "").replace(/\s*[\(\[].*?[\)\]]/g, "").trim(); return t.length <= 20 ? t : t.slice(0, 19).replace(/[\s,.;:-]+$/, "") + "\u2026"; }
// the chips of row two, in order: For you, what you follow, then the day's presets (a follow is never shown twice)
function hfChips(pre, activeId) {
  const out = [{ id: "foryou", label: "For you" }];
  const seen = new Set(["foryou"]), add = (id, label) => { if (!seen.has(id) && id) { seen.add(id); out.push({ id, label }); } };
  hfFollows().slice(0, HF_CHIP_MAX).forEach(f => add(hfFollowId(f), f.kind === "p" ? fdShortName(f.name) : f.name));
  if (pre) {
    add(pre.mv && "m:" + pre.mv, pre.mv);
    add(pre.pa && "p:" + pre.pa, fdShortName(pre.pa));
    add(pre.li >= 0 && "l:" + pre.li, pre.likeTitle ? "Like " + pre.likeTitle : "Like this one");
    add(pre.color && "c:" + pre.color.h, pre.color && "Near " + pre.color.n.toLowerCase());
  }
  if (activeId && !seen.has(activeId)) out.splice(1, 0, { id: activeId, label: hfLabelOf(activeId, pre) });
  return out;
}
function hfLabelOf(id, pre) {
  const t = id.slice(0, 2), v = id.slice(2);
  if (t === "m:") return v; if (t === "p:") return fdShortName(v);
  if (t === "l:") return pre && pre.likeTitle && "l:" + pre.li === id ? "Like " + pre.likeTitle : "Like this one"; if (t === "c:") { const r = TODAY_TABLE.find(x => x[2] === v); return "Near " + (r ? r[1].toLowerCase() : v); }
  return "For you";
}

// ---------- the river (David, 2026-10-26: "patches of things that are related, 5-10 greens, then they slowly fade into blues and then yellows... a river of
// art that is kind of related but gradually going from one to the next") ----------
// A batch of paintings is walked around the color wheel: thirty hue bins of 12 degrees, a few paintings from each, one after the other, so the page
// drifts green, blue, violet, rose, orange, yellow, green. Inside a bin the paintings are ordered by lightness, up in one bin and down in the next, so
// neighbors are close in light as well as in hue. Soft grays and creams are laid in at an even pace. The next batch starts at the hue the last ended on.
const HF_BINS = 30, HF_ENDS = new Map();
function hfDom(i) {   // the main chromatic color of a painting: [hue degrees, lightness], or null for a nearly neutral one
  const G = GAL; let best = -1, bw = 0;
  for (let j = 0; j < 6; j++) { const k = i * 6 + j; if (G.ch[k] >= 12 && G.sh[k] >= .05) { const w = G.sh[k] * G.ch[k]; if (w > bw) { bw = w; best = k; } } }
  return best < 0 ? null : [G.hu[best], G.lab[best * 3]];
}
function hfRiverOrder(ids, startBin, quota) {
  const bins = Array.from({ length: HF_BINS }, () => []), neu = [];
  for (const i of ids) { const d = hfDom(i); if (!d) neu.push(i); else bins[Math.floor(d[0] / 360 * HF_BINS) % HF_BINS].push([i, d[1]]); }
  const out = [], every = neu.length ? Math.max(6, Math.round(ids.length / (neu.length + 1))) : 0, nq = neu.slice(); let since = 0, last = startBin, n = 0;
  for (let b = 0; b < HF_BINS; b++) {
    const bi = (startBin + b) % HF_BINS; let g = bins[bi]; if (!g.length) continue;
    last = bi; if (quota) g = g.slice(0, quota);
    g.sort((a, c) => (n % 2 ? 1 : -1) * (a[1] - c[1])); n++;
    for (const [i] of g) { out.push(i); if (every && ++since >= every && nq.length) { out.push(nq.shift()); since = 0; } }
  }
  while (nq.length) out.push(nq.shift());
  return { ids: out, endBin: last };
}
const hfRiverOn = () => hfS().river !== false;
// how alike the river stays (the Home settings sliders, 0..100, 60 by default). Two knobs, which one slider moves together and "separately" splits:
//   COLOR: high = each patch holds to its color and the drift to the next color is very slow; low = looser patches and a quicker drift
//   VIBE:  high = long patches of paintings that feel alike; low = short patches and now and then a jump to somewhere new, so more of the archive comes by
const hfAlikeOf = k => { const v = hfS()[k]; return Math.max(0, Math.min(1, (v == null ? (hfS().alike == null ? 60 : hfS().alike) : v) / 100)); };
const hfAlikeC = () => hfAlikeOf("alikeC"), hfAlikeV = () => hfAlikeOf("alikeV");
//   TIME:  high = the river stays within the same few years; low (the default is mostly low) = any time. It is its own slider, in the split view.
const hfAlikeP = () => { const v = hfS().alikeP; return Math.max(0, Math.min(1, (v == null ? 15 : v) / 100)); };   // PLACE: high = the river stays in one country
const hfAlikeT = () => { const v = hfS().alikeT; return Math.max(0, Math.min(1, (v == null ? 15 : v) / 100)); };
// one batch of the river: `pool` is already the beautiful, weighted-shuffled candidates
function hfRiverBatch(hk, pool, rnd) {
  const start = HF_ENDS.has(hk) ? HF_ENDS.get(hk) : Math.floor(rnd() * HF_BINS), r = hfRiverOrder(pool, start, Math.max(1, Math.round(1 + 7 * hfAlikeC())));
  if (r.ids.length) HF_ENDS.set(hk, r.endBin);
  return r.ids;
}
// ---------- the vibe river (David, 2026-10-26: "one time the home is dark pale turquoise, moody landscapes like Aivazovsky; reload and it is green impressionism;
// emotions and vibes change with every open") ----------
// Every open starts from a different, very beautiful painting. Its patch is its closest paintings by VIBE (the model's neighbors) that sit in the
// same color family; then the river steps to a painting a little further around the color wheel, in a direction picked for this open, and takes
// that one's patch. So a patch holds together by feeling and color, and the page drifts rather than jumps. Needs the vibe files; without them it
// returns nothing and the hue-bin river stands in. The state is kept per list so the next batch carries on from where the last one stopped.
const HF_SESSION = Math.random().toString(36).slice(2, 8);   // new on every open and reload (a Back inside a visit keeps the same list)
const HF_VR = new Map();
const hfHueGap = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
async function hfVibeRiver(hk, rnd, skip) {
  const ac = hfAlikeC(), av = hfAlikeV(), at = hfAlikeT(), ap = hfAlikeP(), cof = i => (HF_F && HF_F.country ? HF_F.country[i] : 0), size = Math.round(3 + 15 * Math.pow(av, 1.2)), stepBase = 60 - 52 * ac, jump = Math.pow(1 - av, 2) * .55, den = 150 - 110 * ac, simW = .5 + av;
  // TIME: how far (in years) the river may wander from where it is: a few years at one end, any time at the other (a hard limit only when it is tight)
  const win = 6 + 400 * Math.pow(1 - at, 2), yr = i => (GAL.year[i] === GL_UNDATED ? null : GAL.year[i]);
  const yGap = (i, y0) => { const y = yr(i); return y == null || y0 == null ? (at > .5 ? 400 : 0) : Math.abs(y - y0); };
  const fresh = y0 => {
    const an = hfPick(null, rnd, 120, skip, hfCut(.93)); if (!an.length) return null;
    const ok = at > .35 && y0 != null ? an.filter(i => yGap(i, y0) <= win) : an, pool = ok.length ? ok : an, A = pool[Math.floor(rnd() * Math.min(pool.length, 40))], d = hfDom(A);
    return { A, hue: d ? d[0] : rnd() * 360, year: yr(A), co: cof(A) };
  };
  let st = HF_VR.get(hk);
  if (!st) {
    const f = fresh(null); if (!f) return [];
    st = { ...f, dir: rnd() < .5 ? 1 : -1, step: stepBase * (.7 + rnd() * .6), used: new Set() }; HF_VR.set(hk, st);
  }
  const out = [], bar = hfCut(.72), t0 = Date.now();
  for (let patch = 0; patch < 40 && out.length < 84; patch++) {
    if (out.length >= 24 && Date.now() - t0 > 2200) break;   // never stuck: what is ready is shown, the next batch carries on from here
    const nb = await hfBudget(vibeNeighbors(st.A, 60), patch ? 1500 : 2500, []);
    if (!nb.length) { if (!patch && !st.used.size) { HF_VR.delete(hk); return []; } break; }
    const sim = new Map(nb.map(x => [x.i, x.sim])), near = i => (at <= .35 || yGap(i, st.year) <= win) && (ap <= .35 || !st.co || cof(i) === st.co);
    const cand = [st.A, ...nb.map(x => x.i)].filter(i => !st.used.has(i) && !skip.has(i) && !hfHid(i) && hfBeauty(i) >= bar && near(i));
    const score = i => { const d = hfDom(i), g = d ? hfHueGap(d[0], st.hue) : 40; return hfBeauty(i) + (sim.get(i) || 1) * simW - g / den - yGap(i, st.year) / (win * 2 + 60) + (st.co && cof(i) === st.co ? ap * .5 : 0); };
    cand.sort((x, y) => score(y) - score(x)).slice(0, size).forEach(i => { st.used.add(i); out.push(i); });
    // a jump to somewhere new (the more exploring, the more often), else the next anchor near where the hue is heading
    if (rnd() < jump) { const f = fresh(st.year); if (f) { Object.assign(st, f); continue; } }
    st.hue = (st.hue + st.dir * st.step * (.6 + rnd() * .8) + 360) % 360;
    const next = nb.map(x => x.i).filter(i => !st.used.has(i) && !skip.has(i) && !hfHid(i) && hfBeauty(i) >= bar && near(i));
    next.sort((x, y) => { const dx = hfDom(x), dy = hfDom(y), gx = dx ? hfHueGap(dx[0], st.hue) : 70, gy = dy ? hfHueGap(dy[0], st.hue) : 70; return (gx - hfBeauty(x) * 40) - (gy - hfBeauty(y) * 40); });
    if (!next.length) { const f = fresh(st.year); if (!f) break; Object.assign(st, f); continue; }
    st.A = next[0]; st.year = yr(next[0]) ?? st.year; if (ap > .35) st.co = cof(next[0]) || st.co;
  }
  return out;
}
// ---------- double-tap to like (David, 2026-10-26: "double tapping is a like, anywhere") ----------
// A tile opens on a tap after a short beat; a second tap inside that beat likes it instead (and never opens it). One shared state for the whole app.
let HF_TAP = { key: null, t: 0, timer: 0 };
function hfTap(key, open, like, x, y) {
  const now = Date.now();
  if (HF_TAP.key === key && now - HF_TAP.t < 340) { clearTimeout(HF_TAP.timer); HF_TAP.key = null; like(x, y); return; }
  clearTimeout(HF_TAP.timer); HF_TAP.key = key; HF_TAP.t = now;
  HF_TAP.timer = setTimeout(() => { HF_TAP.key = null; open(); }, 240);
}
// a heart blooms where you tapped, inside the tile
function hfBloom(el, x, y) {
  const r = el.getBoundingClientRect(), b = document.createElement("i");
  b.className = "fva-bloom"; b.innerHTML = typeof FVA_HEART_ON !== "undefined" ? FVA_HEART_ON : "";
  b.style.left = (x - r.left) + "px"; b.style.top = (y - r.top) + "px";
  if (getComputedStyle(el).position === "static") el.style.position = "relative";
  el.appendChild(b); setTimeout(() => b.remove(), 900);
}
// like a painting from a tile: the heart blooms, it is kept (never un-kept by a double-tap), the tile's own heart lights
function hfLikeTile(el, gi, x, y) {
  hfBloom(el, x, y);
  glShard(Math.floor(gi / GAL.shard)).then(() => {
    const d = glDetailNow(gi); if (!d || typeof fvArtSet !== "function") return;
    if (!fvArtHas(d.id)) { fvArtSet(gi, d, true); buzz(10); } else buzz(6);
    el.querySelectorAll("[data-tf-heart]").forEach(hb => { hb.classList.add("on"); hb.setAttribute("aria-pressed", "true"); hb.innerHTML = typeof TF_HEART_ON !== "undefined" ? TF_HEART_ON : ""; });
  }).catch(() => {});
}
function hfLikeColor(el, hex, name, x, y) {
  hfBloom(el, x, y);
  if (typeof fvSet === "function") { if (!fvHas(hex)) { fvSet(hex, name, true, "tap"); buzz(10); } else buzz(6); }
}

// ---------- the lists ----------
const hfSeen = () => new Set(hfS().seen || []);
function hfMarkSeen(i) {
  const s = hfS(); s.seen = s.seen || [];
  if (s.seen[s.seen.length - 1] === i) return;
  s.seen.push(i); if (s.seen.length > HF_SEEN_MAX) s.seen.splice(0, s.seen.length - HF_SEEN_MAX);
}
// a painting's identity for duplicates: the same work from several museums carries the same measured palette and shape
const hfSig = i => { const G = GAL, k = i * 6; return Math.round(G.lab[k * 3]) + "|" + Math.round(G.ch[k]) + "|" + Math.round(G.hu[k] / 4) + "|" + Math.round(G.sh[k] * 100) + "|" + Math.round(G.ar[i] * 50); };
// the hue family of a painting's main color (six families, and neutral), for pacing the page
const hfHueOf = i => { const k = i * 6; return GAL.ch[k] < 12 ? 6 : Math.floor(((GAL.hu[k] + 30) % 360) / 60); };
// pace the list: no duplicates, never three in a row by one painter (when the facets are in), never three in a row of one hue family
function hfSpread(list, F, noHue) {
  const out = [], later = [], sig = new Set();
  const bad = i => {
    const n = out.length; if (n < 2) return false;
    const p = out[n - 1], q = out[n - 2], a = F && F.artist[i], h = hfHueOf(i);
    return !!(a && F.artist[p] === a && F.artist[q] === a) || (!noHue && h === hfHueOf(p) && h === hfHueOf(q));
  };
  for (const i of list) {
    const g = hfSig(i); if (sig.has(g)) continue; sig.add(g);
    if (bad(i)) later.push(i);
    else { out.push(i); for (let t = 0; t < later.length; t++) if (!bad(later[t])) { out.push(later.splice(t, 1)[0]); break; } }
  }
  return out.concat(later);
}
// For you. No likes yet: the day's most beautiful paintings. With likes: about 60% close to what you like (the vibe neighbors of what you kept,
// plus the work of painters and movements you follow), 25% one step away (neighbors of the closest), 15% surprises from the beautiful pool;
// never anything shown to you recently, never a hidden painting. `salt` asks for the next batch.
async function hfForYou(k, salt) {
  // the facets give painter spacing and a better beauty weight; give them 1.5 s, never more
  const F = await hfBudget(hfFacets().then(f => { hfCounts(f); return f; }).catch(() => null), 1500);
  const seen = hfSeen(), skip = new Set(seen), rnd = hfSeedOf(k, "fy" + salt);
  const kept = Object.values(typeof fvArtStore === "function" ? fvArtStore() : {}).filter(x => x && x.i >= 0).sort((a, b) => (b.at || 0) - (a.at || 0));
  kept.forEach(x => skip.add(x.i));
  const fp = new Set(Object.keys(hfStore("favPainter"))), fm = new Set(Object.keys(hfStore("favMove")));
  const river = hfRiverOn(), wild = hfPick(null, rnd, river ? 360 : 240, skip, hfCut(.86)), spread = l => hfSpread(l, F, river);
  if (!kept.length && !fp.size && !fm.size) {
    if (river) { const v = await hfVibeRiver(k, rnd, skip); if (v.length >= 24) return { ids: hfSpread(v, F, true), more: true }; }
    return { ids: river ? spread(hfRiverBatch(k, wild, rnd)) : spread(wild), more: true };
  }
  // close: vibe neighbors of what you kept (several of your paintings agreeing counts more), then your painters' and movements' work.
  // The neighbor files are small but there can be several: they get 2.5 s together, and whatever has not arrived is left out this time.
  const score = new Map();
  if (typeof vibeNeighbors === "function" && kept.length) {
    const seeds = kept.slice(0, 8);
    const ns = await hfBudget(Promise.all(seeds.map(s => vibeNeighbors(s.i, 40))), 2500, []);
    ns.forEach((list, n) => list.forEach(x => { if (!skip.has(x.i) && !hfHid(x.i)) score.set(x.i, (score.get(x.i) || 0) + x.sim * (1 - n * .05)); }));
  }
  const near = [...score.entries()].sort((a, b) => b[1] - a[1]).map(e => e[0]);
  const own = [];
  if (F && (fp.size || fm.size)) {
    const ai = new Set(), mi = new Set(); F.meta.artists.forEach((a, j) => { if (fp.has(a[0])) ai.add(j + 1); }); F.meta.movements.forEach((m, j) => { if (fm.has(m)) mi.add(j + 1); });
    const cand = []; for (let i = 0; i < F.N; i++) if (ai.has(F.artist[i]) || mi.has(F.mv[i])) cand.push(i);
    hfPick(cand, rnd, 200, skip).forEach(i => own.push(i));
  }
  // one step away: the neighbors of the closest few, not already close
  let adj = [];
  if (typeof vibeNeighbors === "function" && near.length) {
    const lists = await hfBudget(Promise.all(near.slice(0, 4).map(i => vibeNeighbors(i, 20))), 1500, []);
    const have = new Set(near.slice(0, 200)), cnt = new Map();
    lists.forEach(l => l.forEach(x => { if (!have.has(x.i) && !skip.has(x.i) && !hfHid(x.i)) cnt.set(x.i, (cnt.get(x.i) || 0) + 1); }));
    adj = [...cnt.entries()].sort((a, b) => b[1] - a[1] || rnd() - .5).map(e => e[0]);
  }
  // 20 slots: 12 close (6 from vibe, 6 from your painters and movements, whichever exist), 5 one step away, 3 surprises
  const take = (arr, n, used) => { const r = []; while (r.length < n && arr.length) { const i = arr.shift(); if (!used.has(i)) { used.add(i); r.push(i); } } return r; };
  const used = new Set(), A = near.slice(), B = own.slice(), Cc = adj.slice(), W = wild.slice(), out = [];
  for (let r = 0; r < 14; r++) {
    const a = take(A, B.length ? 6 : 12, used), b = take(B, A.length || a.length ? 6 : 12, used), c = take(Cc, 5, used), w = take(W, 3, used);
    if (!a.length && !b.length && !c.length && !w.length) break;
    out.push(...a, ...b, ...c, ...w);
  }
  const mix = out.length ? out : wild;
  if (!river) return { ids: spread(mix), more: true };
  // with taste: each run of 90 (in the order of how close they are to you) is walked around the color wheel, and the next run carries on from there
  const rv = []; for (let a = 0; a < mix.length; a += 90) rv.push(...hfRiverBatch(k, mix.slice(a, a + 90), rnd));
  return { ids: spread(rv), more: true };
}
async function hfByFacet(kind, name, k, roll) {
  const F = await hfFacets(), pos = (kind === "p" ? F.meta.artists.findIndex(a => a[0] === name) : F.meta.movements.indexOf(name)) + 1;
  if (!pos) return { ids: [], empty: "That isn't in the archive." };
  const cand = hfIndexBy(F, kind === "p" ? F.artist : F.mv, pos).filter(i => !hfHid(i));
  if (kind === "p" && hfS().pOrder === "old") {
    cand.sort((a, b) => { const ya = GAL.year[a], yb = GAL.year[b]; return (ya === GL_UNDATED ? 1e6 : ya) - (yb === GL_UNDATED ? 1e6 : yb); });
    return { ids: cand, total: cand.length };
  }
  const rr = hfSeedOf(k + "|" + name + "|" + roll, kind), picked = hfPick(cand, rr, HF_KEEP);
  return { ids: hfRiverOn() ? hfRiverOrder(picked, Math.floor(rr() * HF_BINS), 0).ids : picked, total: cand.length };
}
// like this one: by vibe (the model's nearest neighbors, then their neighbors) or by color (the nearest palettes)
async function hfLike(seed, by) {
  const out = [], have = new Set([seed]);
  const push = i => { if (!have.has(i) && !hfHid(i)) { have.add(i); out.push(i); } };
  if (by === "color") {
    const q = twQuery(glPal(seed), { self: seed });
    glSimilarPal(twPal(q), 320, { exclude: seed, pairs: false, noEra: true, cands: 320 }).list.forEach(x => push(x.i));
  } else if (typeof vibeNeighbors === "function") {
    const first = await vibeNeighbors(seed, 60); first.forEach(x => push(x.i));
    const lists = await Promise.all(first.slice(0, 10).map(x => vibeNeighbors(x.i, 40))), cnt = new Map();
    lists.forEach(l => l.forEach(x => { if (!have.has(x.i) && !hfHid(x.i)) cnt.set(x.i, (cnt.get(x.i) || 0) + x.sim); }));
    [...cnt.entries()].sort((a, b) => b[1] - a[1]).slice(0, 260).forEach(e => push(e[0]));
  }
  return { ids: out.slice(0, HF_KEEP) };
}
// near a color: the paintings that hold it best (the fine color index)
async function hfNearColor(hex) {
  const r = await paintingsFor(hex, { sort: "cover" }), out = [], have = new Set();
  (r.items || r.rows || []).forEach(x => { if (x.src === "paintings" && x.i >= 0 && !have.has(x.i) && !hfHid(x.i)) { have.add(x.i); out.push(x.i); } });
  return { ids: out.slice(0, HF_KEEP) };
}
// a lens id -> { ids, more, head, empty }
async function hfLens(id, k, salt, fast) {
  await loadGallery(); await hfBeautyReady();
  if (fast) { const rnd = hfSeedOf(k, "fast"); return { ids: hfSpread(hfPick(null, rnd, 240, hfSeen(), hfCut(.86))), more: true, head: { kind: "f" } }; }
  const t = id.slice(0, 2), v = id.slice(2);
  if (t === "m:" || t === "p:") return { ...(await hfByFacet(t[0], v, k, hfRoll(id))), head: { kind: t[0], name: v } };
  if (t === "l:") { const seed = +v, by = hfS().likeBy === "color" ? "color" : "vibe"; return { ...(await hfLike(seed, by)), head: { kind: "l", seed, by } }; }
  if (t === "c:") return { ...(await hfNearColor(v)), head: { kind: "c", hex: v } };
  return { ...(await hfForYou(k, salt | 0)), head: { kind: "f" } };
}
// "Because you kept X and follow Y": one plain line, or "" before you have anything
function hfBecause() {
  const kept = Object.values(typeof fvArtStore === "function" ? fvArtStore() : {}).filter(x => x && x.t).sort((a, b) => (b.at || 0) - (a.at || 0));
  const f = hfFollows(), bits = [];
  if (kept.length) bits.push("kept " + kept[0].t);
  if (f.length) bits.push("follow " + (f[0].kind === "p" ? f[0].name : f[0].name));
  return bits.length ? "Because you " + bits.join(" and ") : "";
}
