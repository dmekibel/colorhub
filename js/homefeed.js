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
// the two reading axes (tools/audit_scene.py): abstraction and scale (close-up .. wide), two bytes per painting; the river changes them in small steps
let HF_SCENE = null;
const hfAx = i => (HF_SCENE ? [HF_SCENE[i * 2], HF_SCENE[i * 2 + 1]] : null);
const hfAxDist = (i, r) => { if (!HF_SCENE || !r) return 0; return Math.hypot(HF_SCENE[i * 2] - r[0], HF_SCENE[i * 2 + 1] - r[1]) * 100 / 255; };   // 0..~140
function hfBeautyReady() {
  if (HF_B) return Promise.resolve();
  return HF_BP || (HF_BP = hfBudget(loadGallery().then(async () => {
    try { const r = await fetch("data/gallery/aesthetic.bin"); if (r.ok) { const b = new Uint8Array(await r.arrayBuffer()); if (b.length === GAL.n) HF_AES = b; } } catch (e) {}
    try { const r = await fetch("data/gallery/scene.bin"); if (r.ok) { const b = new Uint8Array(await r.arrayBuffer()); if (b.length === GAL.n * 2) HF_SCENE = b; } } catch (e) {}
  }), 2500).then(() => {
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
const HF_KNOWN = /impression|baroque|rococo|romantic|realism|renaissance|neoclass|symbol|expression|cubis|surreal|nouveau|raphael|golden age|ukiyo|manner|fauv|point|luminis|hudson|orientalis|primitiv|futur|modern/i;   // movements people know
async function hfPresets(k) {
  const F = await hfFacets(), C = hfCounts(F); await hfBeautyReady();
  const pick = (arr, r) => arr[Math.floor(r() * arr.length)];
  const mvs = [], ars = [];
  // movements people know (the rest of the 400-painting movements only if none of those exist); painters with the biggest bodies of work
  F.meta.movements.forEach((n, j) => { if (n && C.mv[j + 1] >= 150 && HF_KNOWN.test(n)) mvs.push(n); });
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
// The first screen before the archive has arrived (David, 2026-10-26: "app still too slow"): the gallery index is 6 MB and the filters 2.7 MB, so on a phone the first
// list waited many seconds. data/home-seed.json is a small hand-picked set of about 170 very beautiful, varied paintings (their picture, title, painter, year, shape, main color:
// everything a tile needs); the first screen is a color-gradual walk through it, drawn at once, and when the page asks for more the real river carries on from its last painting.
// Rebuild it with the console script in tools/home_seed.js.
let HF_SEEDP = null;
const hfSeedLoad = () => HF_SEEDP || (HF_SEEDP = fetch("data/home-seed.json").then(r => (r.ok ? r.json() : null)).then(o => (o && o.items && o.items.length > 40 ? o : null)).catch(() => null));
function hfSeedRiver(seed, rnd, count) {
  const pool = seed.items.map(x => ({ x, L: lab(x.c) })), out = [];
  let cur = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
  out.push(cur.x);
  while (out.length < count && pool.length) {
    let bi = 0, bd = 1e9;
    for (let k = 0; k < pool.length; k++) { const a = pool[k].L, b = cur.L, d = Math.hypot((a[0] - b[0]) * .7, a[1] - b[1], a[2] - b[2]) + Math.abs(pool[k].x.y - cur.x.y) / 30 + rnd() * 4; if (d < bd) { bd = d; bi = k; } }
    cur = pool.splice(bi, 1)[0]; out.push(cur.x);
  }
  return out.map(x => ({ t: "sp", key: "g:" + x.g, gi: x.g, img: x.i, ar: x.a, c: x.c, ti: x.t, p: x.p, y: x.y }));
}
// after the seed: the real river, begun at the seed's last painting, with every painting already shown kept out
async function hfAfterSeed(hk, used) {
  await loadGallery(); await hfBeautyReady(); await hfFacets();
  const skip = new Set(hfSeen()); used.forEach(i => skip.add(i));
  return hfBudget(hfVibeRiver(hk, hfSeedOf(hk, "afterseed"), skip, null, used[used.length - 1]), 9000, []);
}
// ---------- moods, periods and the Boards (David, 2026-10-26: "smart folders: a mood, a look, a color, a painting, each with its own infinite scroll") ----------
// A board is a lens (a definition, never a stored list): "mo:serene" (data/gallery/mood.bin, tools/audit_mood.py: how much of a picture's reading is each of twelve moods,
// ranked across the archive 0..255), "e:1850-1900" (a span of years), "m:<movement>", "p:<painter>", "c:#hex" (near a color). Each opens as the same endless, gradual feed.
let HF_MOOD = null, HF_MOODP = null;
// mood.bin: 6 bytes a painting, its three strongest moods as (mood id, strength 0..255) pairs; 255 as the id = no reading. Indexed per mood once, on load.
const hfMoodReady = () => HF_MOODP || (HF_MOODP = loadGallery().then(async () => {
  try {
    const m = await (await fetch("data/gallery/mood.json")).json(), r = await fetch("data/gallery/mood.bin");
    if (!m || !r.ok || m.format !== "top3") return;
    const b = new Uint8Array(await r.arrayBuffer()), K = m.moods.length, n = GAL.n; if (b.length !== n * 6) return;
    const cnt = new Int32Array(K); for (let i = 0; i < n; i++) for (let j = 0; j < 3; j++) { const id = b[i * 6 + j * 2]; if (id < K) cnt[id]++; }
    const by = Array.from({ length: K }, (_, k) => ({ idx: new Int32Array(cnt[k]), s: new Uint8Array(cnt[k]), n: 0 }));
    for (let i = 0; i < n; i++) for (let j = 0; j < 3; j++) { const id = b[i * 6 + j * 2]; if (id < K) { const t = by[id]; t.idx[t.n] = i; t.s[t.n++] = b[i * 6 + j * 2 + 1]; } }
    HF_MOOD = { b, k: K, moods: m.moods, by };
  } catch (e) {}
}).catch(() => {}));
const hfMoodName = id => { const m = HF_MOOD && HF_MOOD.moods.find(x => x[0] === id); return m ? m[1] : id; };
const hfEraSpan = v => { const [a, b] = String(v).split("-").map(Number); return [a || 0, b || 3000]; };
const hfEraName = v => { const [a, b] = hfEraSpan(v); return b - a === 100 ? a + "s" : a + "\u2013" + b; };
// a board's candidate list: the paintings that have this mood among their strongest three and read strongly, that are also beautiful
function hfMoodCands(id, min) {
  const k = HF_MOOD ? HF_MOOD.moods.findIndex(x => x[0] === id) : -1; if (k < 0) return [];
  const t = HF_MOOD.by[k], out = [], bar = hfCut(.45), floor = min * 255;
  for (let q = 0; q < t.n; q++) { const i = t.idx[q]; if (t.s[q] >= floor && !hfHid(i) && hfBeauty(i) >= bar) out.push(i); }
  return out;
}
async function hfMoodList(id, k, roll) {
  await hfMoodReady(); await hfFacets();
  const cand = hfMoodCands(id, .85), rr = hfSeedOf(k + "|" + id + "|" + roll, "mood"), picked = hfPick(cand, rr, HF_KEEP);
  return { ids: hfRiverOn() ? hfChainList(picked, rr) : picked, total: cand.length };
}
async function hfEraList(v, k, roll) {
  const [a, b] = hfEraSpan(v), cand = []; for (let i = 0; i < GAL.n; i++) { const y = GAL.year[i]; if (y !== GL_UNDATED && y >= a && y < b && !hfHid(i)) cand.push(i); }
  const rr = hfSeedOf(k + "|e" + v + "|" + roll, "era"), picked = hfPick(cand, rr, HF_KEEP, null, hfCut(.5));
  return { ids: hfRiverOn() ? hfChainList(picked, rr) : picked, total: cand.length };
}
// genres: the 47 islands of the By look map (data/gallery/look.json names them, look-islands.bin says which island each painting is on)
let HF_ISL = null, HF_ISLP = null;
const hfIslands = () => HF_ISLP || (HF_ISLP = loadGallery().then(async () => {
  try {
    const m = await (await fetch("data/gallery/look.json")).json(), r = await fetch("data/gallery/look-islands.bin");
    if (!m || !m.islands || !r.ok) return;
    const b = await r.arrayBuffer(), dv = new DataView(b), K = m.islands.length;
    if (b.byteLength !== 20 + GAL.n * 3 || dv.getUint32(0, true) !== 0x4C53494C || dv.getUint32(8, true) !== GAL.n || dv.getUint32(12, true) !== K) return;
    HF_ISL = { isl: m.islands, id: new Uint8Array(b, 20, GAL.n) };
  } catch (e) {}
}).catch(() => {}));
const hfGenreName = k => { const o = HF_ISL && HF_ISL.isl[+k]; return o ? o.lab || ("Group " + k) : "Genre"; };
async function hfGenreList(k, key, roll) {
  await hfIslands(); await hfFacets();
  const cand = []; if (HF_ISL) for (let i = 0; i < GAL.n; i++) if (HF_ISL.id[i] === +k && !hfHid(i)) cand.push(i);
  const rr = hfSeedOf(key + "|g" + k + "|" + roll, "genre"), picked = hfPick(cand, rr, HF_KEEP, null, hfCut(.4));
  return { ids: hfRiverOn() ? hfChainList(picked, rr) : picked, total: cand.length };
}
// ---------- more kinds of board (David, 2026-10-26: "come up with more board categories"): subjects, stories, places, collections, palette character, composition, yours ----------
// Each is a lens id with a prefix; hfCandsOf(id) lists its paintings, the same list-maker (beauty, then the gradual order) as every other board does the rest.
const hfHueOfLab = i => { const M = GAL.mean, h = Math.atan2(M[i * 3 + 2], M[i * 3 + 1]) * 180 / Math.PI; return h < 0 ? h + 360 : h; };   // CIELAB hue: 0 red, 90 yellow, 180 green, 270 blue
const HF_PCS = [   // palette character, from the painting's mean lightness and chroma
  ["pastel", "Pastel", i => GAL.L[i] >= 66 && GAL.C[i] >= 9 && GAL.C[i] <= 32],
  ["airy", "Bright and airy", i => GAL.L[i] >= 76 && GAL.C[i] < 22],
  ["dark", "Dark and moody", i => GAL.L[i] <= 36],
  ["vivid", "Vivid", i => GAL.C[i] >= 40],
  ["earthy", "Earthy", i => { const L = GAL.L[i], c = GAL.C[i]; if (L < 35 || L > 70 || c < 12 || c > 42) return false; const h = hfHueOfLab(i); return h >= 35 && h <= 100; }],
  ["cool", "Cool blues and greens", i => { if (GAL.C[i] < 14) return false; const h = hfHueOfLab(i); return h >= 150 && h <= 300; }],
  ["warm", "Warm reds and oranges", i => { if (GAL.C[i] < 16) return false; const h = hfHueOfLab(i); return h < 65 || h > 330; }],
  ["grey", "Soft greys", i => GAL.C[i] < 8],
  // color worlds: one hue family each (mean CIELAB hue), clear enough to read as that color
  ["w-pink", "Pinks and roses", i => { if (GAL.C[i] < 12 || GAL.L[i] < 55) return false; const h = hfHueOfLab(i); return h < 25 || h > 335; }],
  ["w-red", "Reds", i => { if (GAL.C[i] < 24 || GAL.L[i] > 62) return false; const h = hfHueOfLab(i); return h < 35 || h > 345; }],
  ["w-orange", "Oranges and ambers", i => { if (GAL.C[i] < 22) return false; const h = hfHueOfLab(i); return h >= 40 && h < 75; }],
  ["w-gold", "Golds and yellows", i => { if (GAL.C[i] < 24 || GAL.L[i] < 55) return false; const h = hfHueOfLab(i); return h >= 75 && h < 105; }],
  ["w-green", "Greens", i => { if (GAL.C[i] < 14) return false; const h = hfHueOfLab(i); return h >= 112 && h < 165; }],
  ["w-teal", "Teals and turquoise", i => { if (GAL.C[i] < 12) return false; const h = hfHueOfLab(i); return h >= 165 && h < 235; }],
  ["w-blue", "Blues", i => { if (GAL.C[i] < 14) return false; const h = hfHueOfLab(i); return h >= 235 && h < 290; }],
  ["w-violet", "Purples and violets", i => { if (GAL.C[i] < 10) return false; const h = hfHueOfLab(i); return h >= 290 && h <= 335; }],
  // light: how bright or dark the whole picture is
  ["l-glow", "Glowing and light-filled", i => GAL.L[i] >= 70 && GAL.C[i] >= 18],
  ["l-night", "Night and deep shadow", i => GAL.L[i] <= 28],
  ["l-mono", "Near monochrome", i => GAL.C[i] < 14 && GAL.L[i] > 30 && GAL.L[i] < 75],
  ["l-bold", "Bold and saturated", i => GAL.C[i] >= 48],
  ["l-blue-dark", "Blue night", i => { if (GAL.C[i] < 14 || GAL.L[i] > 45) return false; const h = hfHueOfLab(i); return h >= 235 && h < 300; }],
  ["l-sun", "Sunlit warmth", i => { if (GAL.L[i] < 58 || GAL.C[i] < 22) return false; const h = hfHueOfLab(i); return h >= 45 && h < 100; }],
];
const HF_WORLDS = /^w-/, HF_LIGHT = /^l-/;
const HF_CPS = [   // composition: how abstract (tools/audit_scene.py), how close or wide, and the shape of the canvas
  ["close", "Close-ups and portraits", i => HF_SCENE && HF_SCENE[i * 2 + 1] <= 80 && HF_SCENE[i * 2] < 200],
  ["figures", "Figures", i => HF_SCENE && HF_SCENE[i * 2 + 1] > 80 && HF_SCENE[i * 2 + 1] <= 150 && HF_SCENE[i * 2] < 200],
  ["groups", "Groups and interiors", i => HF_SCENE && HF_SCENE[i * 2 + 1] > 150 && HF_SCENE[i * 2 + 1] <= 215 && HF_SCENE[i * 2] < 200],
  ["wide", "Wide views", i => HF_SCENE && HF_SCENE[i * 2 + 1] > 215 && HF_SCENE[i * 2] < 200],
  ["abstract", "Abstract", i => HF_SCENE && HF_SCENE[i * 2] >= 235],
  ["leaning", "Leaning abstract", i => HF_SCENE && HF_SCENE[i * 2] >= 205 && HF_SCENE[i * 2] < 235],
  ["tall", "Tall canvases", i => GAL.ar[i] > 1.3],
  ["square", "Square", i => GAL.ar[i] >= .9 && GAL.ar[i] <= 1.1],
  ["landscape", "Wide canvases", i => GAL.ar[i] < .8 && GAL.ar[i] >= .55],
  ["panorama", "Panoramas", i => GAL.ar[i] < .55],
];
let HF_KEPT_LABEL = "Kept"; const HF_CUSTOM_LABELS = new Map();   // lens id -> its name (filled by hfBoards and hfCustomLabel)
async function hfCandsOf(id) {
  await loadGallery(); await hfBeautyReady();
  const t = id.slice(0, 2), v = id.slice(3), out = [];
  const scan = test => { for (let i = 0; i < GAL.n; i++) if (!hfHid(i) && test(i)) out.push(i); return out; };
  if (t === "pc") { const d = HF_PCS.find(x => x[0] === v); return d ? scan(d[2]) : out; }
  if (t === "cp") { const d = HF_CPS.find(x => x[0] === v); return d ? scan(d[2]) : out; }
  if (t === "mu") return scan(i => GAL.mus[i] === +v);
  if (t === "co") { const F = await hfFacets(), pos = F.meta.countries.indexOf(v) + 1; return pos ? scan(i => F.country[i] === pos) : out; }
  if (t === "su") { const S = await loadSubjects(), k = S.idx.get(v); if (k == null) return out; return scan(i => { for (let q = S.off[i]; q < S.off[i + 1]; q++) if (S.tg[q] === k) return true; return false; }); }
  if (t === "yo") { const st = typeof fvArtStore === "function" ? Object.values(fvArtStore()) : []; return st.filter(x => x && x.i >= 0 && !hfHid(x.i)).sort((a, b) => (b.at || 0) - (a.at || 0)).map(x => x.i); }
  return out;
}
const hfCustomKind = t => t === "su" || t === "co" || t === "mu" || t === "pc" || t === "cp" || t === "yo";
async function hfCustomLabel(id) {
  const t = id.slice(0, 2), v = id.slice(3);
  if (t === "pc") return (HF_PCS.find(x => x[0] === v) || [0, v])[1];
  if (t === "cp") return (HF_CPS.find(x => x[0] === v) || [0, v])[1];
  if (t === "mu") { await loadGallery(); const s0 = GAL.src[+v]; return s0 ? s0.name : "Collection"; }
  if (t === "co") return v;
  if (t === "yo") return HF_KEPT_LABEL;
  if (t === "su") return typeof subjPlural === "function" ? subjPlural(v) : v;
  return v;
}
async function hfCustomList(id, k, roll) {
  const cand = await hfCandsOf(id);
  if (id.startsWith("yo:")) return { ids: cand, total: cand.length };
  const rr = hfSeedOf(k + "|" + id + "|" + roll, "custom"), picked = hfPick(cand, rr, HF_KEEP, null, hfCut(.45));
  return { ids: hfRiverOn() ? hfChainList(picked, rr) : picked, total: cand.length };
}
// the folders: sections of boards for the Boards page
async function hfBoards() {
  const F = await hfFacets(), C = hfCounts(F); await hfBeautyReady(); await hfMoodReady();
  const secs = []; await hfIslands();
  if (HF_ISL) secs.push({ tab: "genres", title: "Genres", boards: HF_ISL.isl.map((o, k) => ({ id: "g:" + k, label: o.lab || ("Group " + k), sub: (o.n || 0).toLocaleString("en-US") + " paintings", n: o.n || 0 })).sort((a, b) => b.n - a.n) });
  if (HF_MOOD) { const fam = new Map(); HF_MOOD.moods.forEach(([id, name, f]) => { if (!fam.has(f)) fam.set(f, []); fam.get(f).push({ id: "mo:" + id, label: name, sub: "Mood" }); }); fam.forEach((boards, f) => secs.push({ tab: "moods", title: f, boards })); }
  secs.push({ tab: "periods", title: "Periods", boards: [[1400, 1500], [1500, 1600], [1600, 1700], [1700, 1800], [1800, 1850], [1850, 1900], [1900, 1925], [1925, 1960]].map(([a, b]) => ({ id: "e:" + a + "-" + b, label: hfEraName(a + "-" + b), sub: "Period" })) });
  { const dec = []; for (let y = 1750; y < 1960; y += 10) dec.push([y, y + 10]); const half = []; for (let y = 1400; y < 1750; y += 50) half.push([y, y + 50]);
    secs.push({ tab: "periods", title: "Half centuries", boards: half.map(([a, b]) => ({ id: "e:" + a + "-" + b, label: hfEraName(a + "-" + b), sub: "Period" })) });
    secs.push({ tab: "periods", title: "By decade", boards: dec.map(([a, b]) => ({ id: "e:" + a + "-" + b, label: hfEraName(a + "-" + b), sub: "Decade" })) }); }
  const mvs = []; F.meta.movements.forEach((n, j) => { if (n && C.mv[j + 1] >= 250 && HF_KNOWN.test(n)) mvs.push({ n, c: C.mv[j + 1] }); });
  mvs.sort((x, y) => y.c - x.c); secs.push({ tab: "movements", title: "Movements", boards: mvs.slice(0, 48).map(x => ({ id: "m:" + x.n, label: x.n, sub: x.c.toLocaleString("en-US") + " paintings" })) });
  const nice = TODAY_TABLE.filter(r => { const c = lch(r[2]); return c[1] >= 12 && hfLiking(c[2], c[0], c[1]) >= .66; }), by = new Map();
  nice.forEach(r => { const h = Math.floor(lch(r[2])[2] / 15); if (!by.has(h)) by.set(h, r); });
  secs.push({ tab: "colors", title: "Colors", boards: [...by.values()].map(r => ({ id: "c:" + r[2], label: r[1], sub: "Color", hex: r[2] })) });
  // more kinds of board
  const cnt = test => { let n = 0; for (let i = 0; i < GAL.n; i++) if (!hfHid(i) && test(i)) n++; return n; };
  try {
    const S = await loadSubjects(), things = [], icons = [];
    S.tags.forEach((nm, t) => { if (S.hide[t] || S.fold[t] !== t) return; const n = S.n[t]; if (S.grp[t] === "t" && n >= 600) things.push({ nm, n }); else if (S.grp[t] === "i" && n >= 300) icons.push({ nm, n }); });
    const mk = l => l.sort((a, b) => b.n - a.n).slice(0, 44).map(x => { const id = "su:" + x.nm, lb = subjPlural(x.nm); HF_CUSTOM_LABELS.set(id, lb); return { id, label: lb, sub: x.n.toLocaleString("en-US") + " paintings" }; });
    if (things.length) secs.push({ tab: "subjects", title: "Subjects", boards: mk(things) });
    if (icons.length) secs.push({ tab: "stories", title: "Stories and iconography", boards: mk(icons) });
  } catch (e) {}
  const cc = new Int32Array(F.meta.countries.length + 1), mc = new Int32Array(GAL.src.length);
  for (let i = 0; i < GAL.n; i++) if (!hfHid(i)) { cc[F.country[i]]++; mc[GAL.mus[i]]++; }
  const places = []; F.meta.countries.forEach((nm, j) => { if (cc[j + 1] >= 300) places.push({ nm, n: cc[j + 1] }); });
  places.sort((a, b) => b.n - a.n); secs.push({ tab: "places", title: "Places", boards: places.slice(0, 70).map(x => { HF_CUSTOM_LABELS.set("co:" + x.nm, x.nm); return { id: "co:" + x.nm, label: x.nm, sub: x.n.toLocaleString("en-US") + " paintings" }; }) });
  const mus = []; GAL.src.forEach((s0, k) => { if (mc[k] >= 1500) mus.push({ k, n: mc[k], name: s0.name }); });
  mus.sort((a, b) => b.n - a.n); secs.push({ tab: "collections", title: "Collections", boards: mus.slice(0, 40).map(x => { HF_CUSTOM_LABELS.set("mu:" + x.k, x.name); return { id: "mu:" + x.k, label: x.name, sub: x.n.toLocaleString("en-US") + " paintings" }; }) });
  const pcb = test => HF_PCS.filter(d => test(d[0])).map(([id, label, t]) => { HF_CUSTOM_LABELS.set("pc:" + id, label); return { id: "pc:" + id, label, sub: cnt(t).toLocaleString("en-US") + " paintings" }; });
  secs.push({ tab: "palettes", title: "Palette character", boards: pcb(id => !HF_WORLDS.test(id) && !HF_LIGHT.test(id)) });
  secs.push({ tab: "palettes", title: "Color worlds", boards: pcb(id => HF_WORLDS.test(id)) });
  secs.push({ tab: "palettes", title: "Light", boards: pcb(id => HF_LIGHT.test(id)) });
  secs.push({ tab: "composition", title: "Composition", boards: HF_CPS.filter(d => HF_SCENE || !/^(close|figures|groups|wide|abstract|leaning)$/.test(d[0])).map(([id, label, test]) => { HF_CUSTOM_LABELS.set("cp:" + id, label); return { id: "cp:" + id, label, sub: cnt(test).toLocaleString("en-US") + " paintings" }; }) });
  { const yb = [], kept = typeof fvArtStore === "function" ? Object.values(fvArtStore()).filter(x => x && x.i >= 0).length : 0;
    if (kept) yb.push({ id: "yo:kept", label: HF_KEPT_LABEL, sub: kept.toLocaleString("en-US") + " paintings" });
    hfFollows().forEach(f => yb.push({ id: hfFollowId(f), label: f.kind === "p" ? fdShortName(f.name) : f.name, sub: f.kind === "p" ? "Painter you follow" : "Movement you follow" }));
    if (yb.length) secs.unshift({ tab: "yours", title: "Favorites", boards: yb }); }
  const ars = []; F.meta.artists.forEach((a, j) => { if (C.art[j + 1] >= 90) ars.push({ n: a[0], c: C.art[j + 1] }); });
  ars.sort((x, y) => y.c - x.c); secs.push({ tab: "painters", title: "Painters", boards: ars.slice(0, 90).map(x => ({ id: "p:" + x.n, label: fdShortName(x.n), sub: x.c.toLocaleString("en-US") + " paintings" })) });
  return secs;
}
// three paintings for a folder's cover (one large, two small): among the most beautiful of that board, never two by one painter
async function hfCoverIds(id) {
  const F = await hfFacets(); await hfBeautyReady(); await hfMoodReady();
  const t = id.slice(0, 2), v = id.slice(2); let cand = [];
  if (t === "mo") cand = hfMoodCands(id.slice(3), .95);
  else if (t === "g:") { await hfIslands(); if (HF_ISL) for (let i = 0; i < GAL.n; i++) if (HF_ISL.id[i] === +v && !hfHid(i)) cand.push(i); }
  else if (t === "e:") { const [a, b] = hfEraSpan(v); for (let i = 0; i < GAL.n; i++) { const y = GAL.year[i]; if (y !== GL_UNDATED && y >= a && y < b && !hfHid(i)) cand.push(i); } }
  else if (t === "m:" || t === "p:") { const pos = (t === "p:" ? F.meta.artists.findIndex(a => a[0] === v) : F.meta.movements.indexOf(v)) + 1; cand = pos ? hfIndexBy(F, t === "p:" ? F.artist : F.mv, pos).filter(i => !hfHid(i)) : []; }
  else if (t === "c:") cand = (await hfNearColor(v)).ids.slice(0, 80);
  else if (hfCustomKind(t)) { cand = await hfCandsOf(id); if (t === "yo") cand = cand.slice(0, 60); }
  cand = cand.filter(i => GAL.ar[i] > .6 && GAL.ar[i] < 1.7).sort((x, y) => hfBeauty(y) - hfBeauty(x)).slice(0, 40);
  const rnd = hfSeedOf(HF_SESSION + id, "cover"), out = [], ars = new Set();
  while (out.length < 3 && cand.length) { const j = Math.floor(rnd() * Math.min(cand.length, 14)), i = cand.splice(j, 1)[0], a = F.artist[i]; if (a && ars.has(a) && cand.length > 6) continue; if (a) ars.add(a); out.push(i); }
  return out;
}
// an endless row of lenses (David, 2026-10-26: "make that sideways list of tabs infinite, so there is always a new painting tab"): a handful of new
// movements, painters and colors the row does not have yet, in a random order for this visit
async function hfMoreLenses(have, n) {
  const F = await hfFacets(), C = hfCounts(F), rnd = hfSeedOf(HF_SESSION + "|more|" + have.size, "x"), out = [];
  const mvs = [], ars = [];
  F.meta.movements.forEach((nm, j) => { if (nm && C.mv[j + 1] >= 100 && (HF_KNOWN.test(nm) || C.mv[j + 1] >= 400) && !/^none$/i.test(nm)) mvs.push({ id: "m:" + nm, label: nm }); });
  F.meta.artists.forEach((a, j) => { if (C.art[j + 1] >= 60) ars.push({ id: "p:" + a[0], label: fdShortName(a[0]) }); });
  const cols = TODAY_TABLE.filter(r => { const c = lch(r[2]); return c[1] >= 12 && hfLiking(c[2], c[0], c[1]) >= .66; }).map(r => ({ id: "c:" + r[2], label: "Near " + r[1].toLowerCase() }));
  const pools = [mvs, ars, ars, cols];
  for (let t = 0; t < 200 && out.length < n; t++) {
    const pool = pools[Math.floor(rnd() * pools.length)]; if (!pool.length) continue;
    const c = pool[Math.floor(rnd() * pool.length)];
    if (!have.has(c.id) && !out.some(o => o.id === c.id)) out.push(c);
  }
  return out;
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
  if (t === "mo") return hfMoodName(id.slice(3)); if (t === "e:") return hfEraName(v); if (t === "g:") return hfGenreName(v);
  if (hfCustomKind(t)) { const c = HF_CUSTOM_LABELS.get(id); return c || (t === "yo" ? HF_KEPT_LABEL : id.slice(3)); }
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
async function hfVibeRiver(hk, rnd, skip, taste, start) {
  const ac = hfAlikeC(), av = hfAlikeV(), at = hfAlikeT(), ap = hfAlikeP(), cof = i => (HF_F && HF_F.country ? HF_F.country[i] : 0);
  const size = Math.round(3 + 15 * Math.pow(av, 1.2)), jump = Math.pow(1 - av, 2) * .55, simW = .5 + av;
  // COLOR: the river keeps a reference color (the mean color of the patch's first painting); a painting joins only when its WHOLE mean color is within `tolE` of it
  // (about 22 at the far right: the same color world; 57 at 30%; no limit at the left). The reference drifts round the color wheel a few degrees per patch.
  const stepBase = 60 - 56 * ac, tolE = ac > .25 ? 78 - 56 * Math.pow(ac, .8) : 999, M = GAL.mean;
  const meanOf = i => [M[i * 3], M[i * 3 + 1], M[i * 3 + 2]];
  const dE = (i, r) => Math.hypot((M[i * 3] - r[0]) * .7, M[i * 3 + 1] - r[1], M[i * 3 + 2] - r[2]);
  // LOOK: how many neighbor-steps one patch holds (each takes about `size` paintings, then moves to the closest new neighbor, with no color step)
  const patchSteps = 1 + Math.round(11 * Math.pow(av, 2.2));
  // TIME: how far (in years) the river may wander from where it is: a few years at one end, any time at the other (a hard limit only when it is tight)
  const win = 6 + 400 * Math.pow(1 - at, 2), yr = i => (GAL.year[i] === GL_UNDATED ? null : GAL.year[i]);
  const yGap = (i, y0) => { const y = yr(i); return y == null || y0 == null ? (at > .5 ? 400 : 0) : Math.abs(y - y0); };
  // a painting may join the stretch when it is close enough in color, time and place to where the river is; when too few are, time is let go first, then place, never color
  const tolX = av > .2 ? 90 - 65 * av : 999;   // LOOK also limits how far the kind of picture may be from the reference: how abstract it is, how close or wide
  const fits = (i, st, relax) => (relax > 0 || at <= .35 || yGap(i, st.year) <= win) && (relax > 1 || ap <= .35 || !st.co || cof(i) === st.co) && (relax > 2 || (dE(i, st.ref) <= tolE && hfAxDist(i, st.rx) <= tolX));
  const ladder = (list, st, want) => { for (const r of [0, 1, 2]) { const f = list.filter(i => fits(i, st, r)); if (f.length >= want) return f; } return list.filter(i => fits(i, st, 2)); };
  const fresh = st0 => {
    let an = hfPick(null, rnd, 160, skip, hfCut(.93)); if (!an.length) return null;
    let pool = an;
    if (st0) {
      // a new start that still belongs: first among a few hundred, then among a few thousand (color is let go only when nothing in them fits)
      let found = null;
      for (const n of [160, 1500]) { if (n > 160) an = hfPick(null, rnd, n, skip, hfCut(.85)); for (const r of [0, 1, 2]) { const f = an.filter(i => fits(i, st0, r)); if (f.length) { found = f; break; } } if (found) break; }
      if (!found) for (const r of [3]) found = an.filter(i => fits(i, st0, r));
      if (found && found.length) pool = found;
    }
    let A = pool[Math.floor(rnd() * Math.min(pool.length, 40))];
    // what you kept and follow: most starts are one of those paintings (or its neighbors), so the river is yours, not anyone's
    if (taste && taste.length && rnd() < .6) {
      let c = taste.filter(i => !skip.has(i) && !hfHid(i));
      if (st0) { const k2 = c.filter(i => fits(i, st0, 1)); c = k2; }   // a later start must still belong where the river is
      if (c.length) A = c[Math.floor(rnd() * c.length)];
    }
    return { A, ref: meanOf(A), rx: hfAx(A), year: yr(A), co: cof(A), left: patchSteps - 1 };
  };
  let st = HF_VR.get(hk);
  if (!st && start != null) {   // a river that begins AT a given painting (the settings changed while you were on it): everything unfolds from there
    st = { A: start, ref: meanOf(start), rx: hfAx(start), year: yr(start), co: cof(start), left: patchSteps - 1, dir: rnd() < .5 ? 1 : -1, step: stepBase * (.7 + rnd() * .6), used: new Set([start]) }; HF_VR.set(hk, st);
  }
  if (!st) {
    const f = fresh(null); if (!f) return [];
    st = { ...f, dir: rnd() < .5 ? 1 : -1, step: stepBase * (.7 + rnd() * .6), used: new Set() }; HF_VR.set(hk, st);
  }
  const out = [], bar = hfCut(.72), t0 = Date.now(), room = i => !st.used.has(i) && !skip.has(i) && !hfHid(i) && hfBeauty(i) >= bar;
  // One continuous walk (David, 2026-10-26: "a very gradual change from one subject matter to the next, and the same with colors"): every step takes a few paintings
  // around the anchor, ordered so each is as close in color to the one before as possible, then the anchor moves to the neighbor that is most alike in LOOK and closest to the
  // reference color; the reference color follows the anchor a quarter of the way each step and drifts round the wheel a hair. No patch ever ends in a jump unless nothing is left.
  const dEi = (a, b) => Math.hypot((M[a * 3] - M[b * 3]) * .7, M[a * 3 + 1] - M[b * 3 + 1], M[a * 3 + 2] - M[b * 3 + 2]);
  const chain = (list, prev) => {   // nearest-first order starting from the last painting shown
    const left = list.slice(), res = []; let cur = prev;
    while (left.length) { let bi = 0, bd = 1e9; for (let k = 0; k < left.length; k++) { const d = cur == null ? -hfBeauty(left[k]) : dEi(cur, left[k]) + yGap(left[k], yr(cur)) / 40 + hfAxDist(left[k], hfAx(cur)) * .6; if (d < bd) { bd = d; bi = k; } } cur = left.splice(bi, 1)[0]; res.push(cur); }
    return res;
  };
  for (let it = 0; it < 60 && out.length < 84; it++) {
    if (out.length >= 24 && Date.now() - t0 > 2200) break;   // never stuck: what is ready is shown, the next batch carries on from here
    const nb = await hfBudget(vibeNeighbors(st.A, 60), it ? 2500 : 7000, []);
    if (!nb.length) { if (!it && !st.used.size) { HF_VR.delete(hk); return []; } break; }
    const sim = new Map(nb.map(x => [x.i, x.sim])), pool = [st.A, ...nb.map(x => x.i)].filter(room);
    const cand = st.used.size ? pool.filter(i => fits(i, st, 0)) : ladder(pool, st, 1);   // once under way nothing is let in that breaks the limits
    const score = i => hfBeauty(i) + (sim.get(i) || 1) * simW - dE(i, st.ref) / (30 + 100 * (1 - ac)) - hfAxDist(i, st.rx) / (40 + 80 * (1 - av)) - yGap(i, st.year) / (win * 2 + 60) + (st.co && cof(i) === st.co ? ap * .5 : 0);
    const take = cand.sort((x, y) => score(y) - score(x)).slice(0, size);
    chain(take, out.length ? out[out.length - 1] : null).forEach(i => { st.used.add(i); out.push(i); });
    (st.trail = st.trail || []).push(st.A); if (st.trail.length > 12) st.trail.shift();
    if (!st.co) { const c1 = out.slice(-size).find(i => cof(i)); if (c1 != null) st.co = cof(c1); }   // an anchor with no known country takes the first known one, so the place limit can hold
    // a rare jump, only when Look is low
    if (av < .3 && rnd() < jump) { const f = fresh(st); if (f) { Object.assign(st, f); continue; } }
    // the next anchor: the unused neighbor most alike in look, nearest the reference color (the bridge: the neighbors of the last few anchors when these are used up)
    const pick = (ids, simOf) => ids.filter(i => room(i) && fits(i, st, 0)).sort((x, y) => (simOf(y) * 3 + hfBeauty(y) - dE(y, st.ref) / 25 - hfAxDist(y, st.rx) / 40) - (simOf(x) * 3 + hfBeauty(x) - dE(x, st.ref) / 25 - hfAxDist(x, st.rx) / 40))[0];
    let nx = pick(nb.map(x => x.i), i => sim.get(i) || 0);
    if (nx == null) {
      const recent = (st.trail || []).slice(-4), lists = await hfBudget(Promise.all(recent.map(a => vibeNeighbors(a, 60))), 2500, []), cnt = new Map();
      lists.forEach(l => l.forEach(x => cnt.set(x.i, (cnt.get(x.i) || 0) + x.sim + .2)));
      nx = pick([...cnt.keys()], i => cnt.get(i) || 0);
    }
    if (nx == null) { const f = fresh(st); if (!f) break; Object.assign(st, f); continue; }
    const ang = st.dir * (st.step / patchSteps) * (.6 + rnd() * .8) * Math.PI / 180, ca = Math.cos(ang), sa = Math.sin(ang), m1 = meanOf(nx);
    const rr = [st.ref[0], st.ref[1] * ca - st.ref[2] * sa, st.ref[1] * sa + st.ref[2] * ca];
    st.ref = [rr[0] * .75 + m1[0] * .25, rr[1] * .75 + m1[1] * .25, rr[2] * .75 + m1[2] * .25];
    const ax1 = hfAx(nx); if (ax1 && st.rx) st.rx = [st.rx[0] * .75 + ax1[0] * .25, st.rx[1] * .75 + ax1[1] * .25]; else if (ax1) st.rx = ax1;   // the reference kind of picture follows the anchor too
    st.A = nx; st.year = yr(nx) ?? st.year; if (ap > .35) st.co = cof(nx) || st.co;
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
  (typeof GAL !== "undefined" && GAL && GAL.n ? Promise.resolve() : loadGallery()).then(() => glShard(Math.floor(gi / GAL.shard))).then(() => {
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
// the settings changed while you were on a painting (David, 2026-10-26: "keep the painting I am on, those couple around it, and let everything else adjust from there"):
// the paintings on screen stay, a river under the NEW settings grows forward from the last of them (and goes on as the page asks for more, under key k),
// and another grows backward from the first, to sit above
async function hfAround(k, keep) {
  await hfBeautyReady(); await hfFacets();
  const skip = new Set(hfSeen()); keep.forEach(i => skip.add(i));
  const rnd = hfSeedOf(k, "around" + Date.now() % 1000);
  const fwd = await hfBudget(hfVibeRiver(k, rnd, skip, null, keep[keep.length - 1]), 6000, []);
  fwd.forEach(i => skip.add(i));
  const bwd = await hfBudget(hfVibeRiver(k + "|back", rnd, skip, null, keep[0]), 4000, []);
  return { before: bwd.slice(0, 36).reverse(), after: fwd };
}
async function hfForYou(k, salt) {
  // the facets give painter spacing and a better beauty weight; give them 1.5 s, never more
  const F = await hfBudget(hfFacets().then(f => { hfCounts(f); return f; }).catch(() => null), 1500);
  const seen = hfSeen(), skip = new Set(seen), rnd = hfSeedOf(k, "fy" + salt);
  const kept = Object.values(typeof fvArtStore === "function" ? fvArtStore() : {}).filter(x => x && x.i >= 0).sort((a, b) => (b.at || 0) - (a.at || 0));
  kept.forEach(x => skip.add(x.i));
  const fp = new Set(Object.keys(hfStore("favPainter"))), fm = new Set(Object.keys(hfStore("favMove")));
  const river = hfRiverOn(), wild = hfPick(null, rnd, river ? 360 : 240, skip, hfCut(.86)), spread = l => hfSpread(l, F, river);
  // the river first, whenever it is on: with likes it starts from them (David, 2026-10-26: all sliders to the right must look near-identical, not a mix)
  if (river) {
    const taste = kept.slice(0, 24).map(x => x.i);
    if (F && (fp.size || fm.size)) {
      const ai = new Set(), mi = new Set(); F.meta.artists.forEach((a, j) => { if (fp.has(a[0])) ai.add(j + 1); }); F.meta.movements.forEach((m, j) => { if (fm.has(m)) mi.add(j + 1); });
      const cand = []; for (let i = 0; i < F.N; i++) if (ai.has(F.artist[i]) || mi.has(F.mv[i])) cand.push(i);
      hfPick(cand, rnd, 60, skip).forEach(i => taste.push(i));
    }
    const v = await hfVibeRiver(k, rnd, skip, taste);
    if (v.length >= 24) return { ids: hfSpread(v, hfAlikeV() > .6 ? null : F, true), more: true };
  }
  if (!kept.length && !fp.size && !fm.size) {
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
  const rr = hfSeedOf(k + "|" + name + "|" + roll, kind);
  if (kind === "p") {   // every work of the painter (David, 2026-10-26); the feed then goes on with painters like them (hfPainterMore)
    const byB = cand.slice().sort((a, b) => hfBeauty(b) - hfBeauty(a)), head = byB.slice(0, 500), rest = byB.slice(500).sort((a, b) => GAL.year[a] - GAL.year[b]);
    return { ids: (hfRiverOn() ? hfChainList(head, rr) : head).concat(rest), total: cand.length, own: cand.length };
  }
  const picked = hfPick(cand, rr, HF_KEEP);
  return { ids: hfRiverOn() ? hfChainList(picked, rr) : picked, total: cand.length };
}
// after a painter's own work: paintings of other painters from about the same years with a similar look (the look river from their best work, their own skipped); each call
// gives the next batch, and it never ends
async function hfPainterMore(own, k, st) {
  await hfFacets(); st.round = (st.round || 0) + 1;
  const mine = new Set(own), ys = own.map(i => GAL.year[i]).filter(y => y !== GL_UNDATED).sort((a, b) => a - b), med = ys.length ? ys[ys.length >> 1] : null;
  if (!st.skip) st.skip = new Set(own);
  const best = own.slice().sort((a, b) => hfBeauty(b) - hfBeauty(a)), taste = best.slice(0, 12), rnd = hfSeedOf(k + "|pm" + st.round, "pm");
  let ids = await hfBudget(hfVibeRiver(k + "|pm", rnd, st.skip, taste, st.round === 1 ? best[0] : undefined), 6000, []);
  ids = (ids || []).filter(i => !st.skip.has(i) && !hfHid(i));
  if (med != null) { const near = ids.filter(i => GAL.year[i] === GL_UNDATED || Math.abs(GAL.year[i] - med) <= 90); if (near.length >= 18) ids = near; }
  if (ids.length < 12) {   // the river came up short: the best of the same years, nearest in color first
    const pool = []; for (let i = 0; i < GAL.n; i++) if (!st.skip.has(i) && !mine.has(i) && !hfHid(i) && (med == null || (GAL.year[i] !== GL_UNDATED && Math.abs(GAL.year[i] - med) <= 60))) pool.push(i);
    ids = ids.concat(hfPick(pool, rnd, 60, st.skip, hfCut(.5)));
  }
  try { const F = await hfFacets(); ids = hfSpread(ids, F, true); } catch (e) {}   // never a long run of one painter
  ids.forEach(i => st.skip.add(i));
  if (!ids.length) st.skip = new Set(own);   // everything has been shown once: start over rather than stop
  return ids;
}
// a lens list (a movement, a painter) in a gradual order: start from a beautiful one, then always a close one in color and years (Look and Color sliders set how strictly)
function hfChainList(ids, rnd) {
  const M = GAL.mean, ac = hfAlikeC(), at = hfAlikeT(), kk = 1 + Math.round((1 - ac) * 6), left = ids.slice(), out = [];
  const yv = i => (GAL.year[i] === GL_UNDATED ? null : GAL.year[i]);
  let cur = left.reduce((b, i) => (b == null || hfBeauty(i) > hfBeauty(b) ? i : b), null);
  while (left.length) {
    if (cur != null && out.length) { /* cur is the last one placed */ }
    const k0 = left.indexOf(cur); if (k0 >= 0) left.splice(k0, 1);
    out.push(cur);
    if (!left.length) break;
    const ds = left.map((j, n) => { const y1 = yv(cur), y2 = yv(j), yd = y1 == null || y2 == null ? 40 : Math.abs(y1 - y2); return [n, Math.hypot((M[cur * 3] - M[j * 3]) * .7, M[cur * 3 + 1] - M[j * 3 + 1], M[cur * 3 + 2] - M[j * 3 + 2]) + yd * (.1 + .4 * at) + hfAxDist(j, hfAx(cur)) * .6 - hfBeauty(j) * 6]; }).sort((a, b) => a[1] - b[1]);
    cur = left[ds[Math.floor(rnd() * Math.min(kk, ds.length))][0]];
  }
  return out;
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
  if (t === "g:") return { ...(await hfGenreList(v, k, hfRoll(id))), head: { kind: "g", name: hfGenreName(v) } };
  if (hfCustomKind(t)) { const nm = await hfCustomLabel(id); HF_CUSTOM_LABELS.set(id, nm); return { ...(await hfCustomList(id, k, hfRoll(id))), head: { kind: "x", name: nm } }; }
  if (t === "mo") return { ...(await hfMoodList(id.slice(3), k, hfRoll(id))), head: { kind: "mo", name: hfMoodName(id.slice(3)) } };
  if (t === "e:") return { ...(await hfEraList(v, k, hfRoll(id))), head: { kind: "e", name: hfEraName(v) } };
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
