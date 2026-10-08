"use strict";
// Design round 2 (design/round2/): the Train and Studio room homes, rebuilt as one legible menu each.
// gymHome() (js/gym.js) and studio() (js/studio.js) hand over to r2TrainHome() / r2StudioHome() when this file
// is loaded; the games and tools themselves are untouched (every tile calls the same entry point as before).
// Styles: css/rooms2.css. Everything here is prefixed r2.
//
// Train (David, 2026-10-08: "in order of fun, nothing locked, a clear icon on everything, no super long list"):
// every game first, as an icon tile in a 3-column grid ordered by fun (Study the map first), then today (the
// painting as one compact paper card, a due check-in as a banner), your eye in one honest line, then the drier
// drills and the checks as a compact two-column list.
// Another lane can add a game without touching this file: push { id, name, meta, icon (a key of R2_IC, default
// "gradient"), more (true = the drills list), open () } onto window.TRAIN_TILES before the room is drawn.
//
// Studio: four verbs. Capture (the camera is the primary; pick a photo is the quiet second), Name, Make, Yours
// (photos, palettes, hearted colors, taste), then Export. Its pictures come from your own latest palette and
// photo when you have them, else from today's painting.

// ---------------------------------------------------------------- shared bits
const r2Day = () => today();
// a real palette for a tile: one of the famous paintings, picked by the day and the tile, so tiles differ
function r2Pal(salt = "") {
  const P = (window.PAINTINGS || []).filter(p => p.palette && p.palette.length >= 4);
  if (!P.length) return { p: null, cols: ["#3C6FC8", "#C8553D", "#E0A458", "#5B7F6E", "#7E4FB0", "#2A2620"] };
  const p = P[hash(r2Day() + "r2" + salt) % P.length];
  return { p, cols: p.palette.map(c => c.h) };
}
// the palette's most colorful mid-tone, refitted gently into a range where a small difference can be seen
function r2Mid(cols, i = 0) {
  const ok = cols.map(h => [h, ...lch(h)]).filter(([, L, C]) => L > 22 && L < 86 && C > 8).sort((a, b) => b[2] - a[2]);
  const [, L, C, H] = ok.length ? ok[i % ok.length] : [cols[i % cols.length], ...lch(cols[i % cols.length])];
  return gyFit(clamp(L, 42, 74), clamp(C, 16, 52), H);
}
const r2i = (h, cls = "") => `<i${cls ? ` class="${cls}"` : ""} style="--c:${h}"></i>`;
const r2Shift = (h, dL, dC = 0, dH = 0) => { const [L, C, H] = lch(h); return gyFit(clamp(L + dL, 4, 97), Math.max(0, C + dC), H + dH); };

// ---------------------------------------------------------------- Train: one icon set
// David (2026-10-08): order by fun, nothing locked, a clear icon on everything, no long list. Every entry has a
// custom line icon on a 32 grid (ink strokes, 1.6), with one or two shapes filled from a real painting's palette
// (--a, --b, --c on the tile, picked by the day), so the set is consistent and the room still changes color daily.
const R2_IC = {
  map: `<circle cx="12.3" cy="9.5" r="3.6"/><circle cx="19.7" cy="9.5" r="3.6" class="b"/><circle cx="8.5" cy="16" r="3.6"/><circle cx="16" cy="16" r="3.6" class="a"/><circle cx="23.5" cy="16" r="3.6"/><circle cx="12.3" cy="22.5" r="3.6" class="c"/><circle cx="19.7" cy="22.5" r="3.6"/>`,
  odd: [6, 13, 20].flatMap(y => [6, 13, 20].map(x => `<rect x="${x}" y="${y}" width="6" height="6" rx="1"${x === 20 && y === 13 ? ' class="a"' : ' class="b"'}/>`)).join(""),
  across: `<rect x="3.5" y="9" width="5" height="14" rx="1" class="a"/><rect x="9.5" y="9" width="5" height="14" rx="1" class="a"/><rect x="15.5" y="9" width="5" height="14" rx="1" class="a"/><path d="M23 6v20" stroke-dasharray="2 2.4"/><rect x="25" y="9" width="4" height="14" rx="1" class="b"/>`,
  pairs: `<circle cx="12" cy="16" r="7" class="a"/><circle cx="20" cy="16" r="7" class="b"/>`,
  whose: `<path d="M16 5C9.4 5 4 9.7 4 15.5 4 20.5 8 24 12 24c2 0 2.5-1.5 2.5-3s1-2.5 2.5-2.5h3c4.4 0 8-2.8 8-6.5C28 8.6 22.6 5 16 5z"/><circle cx="10" cy="14" r="2" class="a"/><circle cx="15.5" cy="10" r="2" class="b"/><circle cx="21.5" cy="11.5" r="2" class="c"/>`,
  colordle: [6.5, 13.5, 20.5].flatMap((y, r) => [5, 11, 17, 23].map(x => `<rect x="${x}" y="${y}" width="4.6" height="4.6" rx=".8"${r === 2 ? ' class="a"' : r === 1 && x === 11 ? ' class="b"' : ""}/>`)).join(""),
  lightning: `<path d="M18.5 3.5 7.5 18h7.5l-2 10.5L24.5 13H17l1.5-9.5z" class="a"/>`,
  squint: `<path d="M4.5 17.5c3.2-4 7.2-6 11.5-6s8.3 2 11.5 6"/><path d="M4.5 17.5c3.2 2.4 7.2 3.6 11.5 3.6s8.3-1.2 11.5-3.6"/><circle cx="16" cy="17" r="3" class="a"/><path d="M9.5 9.5 8.4 7M16 8.2V5.5M22.5 9.5 23.6 7"/>`,
  imposter: `<path d="M5 9h12.5l9 7-9 7H5z" class="a"/><circle cx="9" cy="16" r="1.6"/><path d="M14 13.5l4 5M18 13.5l-4 5"/>`,
  changed: `<rect x="3.5" y="9.5" width="5" height="5" rx=".8" class="b"/><rect x="9" y="9.5" width="5" height="5" rx=".8" class="b"/><rect x="3.5" y="15" width="5" height="5" rx=".8" class="b"/><rect x="9" y="15" width="5" height="5" rx=".8" class="b"/><rect x="18" y="9.5" width="5" height="5" rx=".8" class="b"/><rect x="23.5" y="9.5" width="5" height="5" rx=".8" class="b"/><rect x="18" y="15" width="5" height="5" rx=".8" class="b"/><rect x="23.5" y="15" width="5" height="5" rx=".8" class="a"/><path d="M8 25h16"/>`,
  wasthere: `<circle cx="10" cy="11" r="4.2" class="b"/><circle cx="21" cy="11" r="4.2" class="c"/><circle cx="10" cy="22" r="4.2" class="c"/><circle cx="21" cy="22" r="4.2" class="a"/><path d="M27.5 3.5v5M25 6h5"/>`,
  outoforder: `<rect x="4" y="11" width="4" height="15" rx="1" class="b"/><rect x="9.5" y="11" width="4" height="15" rx="1" class="b"/><rect x="15" y="11" width="4" height="15" rx="1" class="b"/><rect x="20.5" y="5" width="4" height="15" rx="1" class="a"/><rect x="26" y="11" width="2.5" height="15" rx="1" class="b"/>`,
  rebuild: `<path d="M8 13c2-5.5 14-5.5 16 0"/><path d="M24.5 13l.6-4M24.5 13l-4-.8"/><rect x="4" y="18" width="5" height="7" rx=".8" class="a"/><rect x="10.3" y="18" width="5" height="7" rx=".8" class="b"/><rect x="16.6" y="18" width="5" height="7" rx=".8"/><rect x="23" y="18" width="5" height="7" rx=".8"/>`,
  nback: `<path d="M25 14c-2-6.5-16-6.5-18 0"/><path d="M7 14l-1.4-3.6M7 14l3.4-1.8"/><circle cx="7" cy="20.5" r="4" class="a"/><circle cx="16" cy="20.5" r="4" class="b"/><circle cx="25" cy="20.5" r="4" class="a"/>`,
  gradient: `<rect x="4" y="8" width="5" height="16" rx="1" class="a"/><rect x="10" y="8" width="5" height="16" rx="1" class="ab"/><rect x="16" y="8" width="5" height="16" rx="1" class="bb"/><rect x="22" y="8" width="5" height="16" rx="1" class="b"/>`,
  value: `<rect x="5" y="8" width="11" height="16" rx="1.5" class="a"/><rect x="16" y="8" width="11" height="16" rx="1.5" class="b"/><path d="M21.5 4.5v2M10.5 4.5v2"/>`,
  shade: `<path d="M16 7a9 9 0 0 0 0 18z" class="a"/><path d="M16 7a9 9 0 0 1 0 18z" class="g"/>`,
  neutral: `<rect x="5" y="6" width="22" height="20" rx="1.5" class="a"/><rect x="11.5" y="12" width="9" height="8" rx="1" class="g"/>`,
  twolooks: `<rect x="5" y="5" width="22" height="11" rx="1.5" class="a"/><rect x="5" y="16" width="22" height="11" rx="1.5" class="b"/><rect x="13" y="7.5" width="6" height="6" rx=".8" class="c"/><rect x="13" y="18.5" width="6" height="6" rx=".8" class="c"/>`,
  vanish: `<rect x="5" y="6" width="22" height="20" rx="1.5" class="a"/><circle cx="16" cy="16" r="6" class="b" stroke-dasharray="2.2 2"/>`,
  after: `<circle cx="16" cy="16" r="10" stroke-dasharray="3 2.6"/><circle cx="16" cy="16" r="4" class="a"/>`,
  cast: `<rect x="5" y="7" width="22" height="18" rx="1.5"/><path d="M16 10.5c3 4 4.5 6.2 4.5 8.2a4.5 4.5 0 0 1-9 0c0-2 1.5-4.2 4.5-8.2z" class="a"/><path d="M8 28 24 4" />`,
  shot: `<rect x="3" y="10" width="11" height="12" rx="1.2" class="a"/><rect x="18" y="10" width="11" height="12" rx="1.2" class="b"/><path d="M14.5 16h3M16 14.5l1.5 1.5-1.5 1.5"/>`,
  kelvin: `<circle cx="16" cy="13" r="7.5" class="a"/><path d="M13 23.5h6M13.8 27h4.4"/>`,
  valuescale: [0, 1, 2, 3, 4].map(i => `<rect x="${4 + i * 5}" y="9" width="4.6" height="14" rx=".8" style="fill:${["#1E1E1E", "#4A4A4A", "#777", "#A6A6A6", "#D6D6D6"][i]}"/>`).join(""),
  masses: `<path d="M5 21c0-6 5-10 10-9s5 4 9 4 4 8-2 9.5S5 29 5 21z" class="a"/><circle cx="22" cy="9" r="3.5" class="b"/>`,
  zorn: ["#ECE6D8", "#C9973F", "#B23A2E", "#262422"].map((c, i) => `<circle cx="${6 + i * 6.7}" cy="16" r="3.2" style="fill:${c}"/>`).join(""),
  checkin: `<rect x="8" y="6" width="16" height="21" rx="1.5"/><path d="M12.5 6V4h7v2"/><path d="M12 16.5l3 3 5.5-6" class="ok"/>`,
  screen: `<rect x="4" y="6" width="24" height="16" rx="1.5"/><path d="M12 27h8M16 22v5"/>${[0, 1, 2, 3].map(i => `<rect x="${7 + i * 4.6}" y="9.5" width="4" height="9" style="fill:${["#222", "#555", "#999", "#DDD"][i]};stroke:none"/>`).join("")}`,
  // Train's two rows: Drills (three shelves of bars, light to dark) and Your eye (an eye whose iris is a color)
  drills: `<rect x="5" y="6.5" width="22" height="5" rx="1" class="a"/><rect x="5" y="13.5" width="16" height="5" rx="1" class="b"/><rect x="5" y="20.5" width="19" height="5" rx="1" class="c"/>`,
  eye: `<path d="M3.5 16c3.4-5 7.6-7.5 12.5-7.5S25.1 11 28.5 16c-3.4 5-7.6 7.5-12.5 7.5S6.9 21 3.5 16z"/><circle cx="16" cy="16" r="4.6" class="a"/><circle cx="16" cy="16" r="1.6" style="fill:var(--ink);stroke:none"/>`,
  history: `<path d="M5 26.5h22"/><path d="M6 21l6-5 5 3 9-9" class="ln"/><circle cx="12" cy="16" r="1.6" class="a"/><circle cx="26" cy="10" r="1.6" class="a"/>`,
};
const r2Icon = (k, sm = false) => `<span class="r2-ic${sm ? " sm" : ""}"><svg viewBox="0 0 32 32" aria-hidden="true">${R2_IC[k] || R2_IC.gradient}</svg></span>`;
// the tile's three accent colors: one real palette per tile, mid-toned so the shapes read on the dark icon well
// (lifted a little in lightness and strength: museum photographs are dim and brown, and an icon has to read at a glance)
const r2Acc = (cols, i) => { const [L, C, H] = lch(r2Mid(cols, i)); return gyFit(clamp(L, 56, 74), clamp(C * 1.35, 30, 64), H); };
function r2Accents(id) { const { cols } = r2Pal(id); return `--a:${r2Acc(cols, 0)};--b:${r2Acc(cols, 1)};--c:${r2Acc(cols, 2)}`; }

// ---------------------------------------------------------------- Train: the room, like the NYT Games home
// (design/REVIEW-2/learn-play.md top 10 #1, IMPROVE PLAN decision 4.) Today on top: one todayPick(), its three
// parts (the painting, the color, the board), each with a tick. Then six games in order of fun, each with a
// personal line. Then two rows: Drills (12 drills, grouped on their own page) and Your eye (one page: the eye
// profile, the check-in, history, your color vision). Cut from the grid, code kept: Lightning (Study's boss),
// Imposter, n-back, Out of order, Rebuild, the separate Today's gradient tile, Whose palette?, What changed?,
// Your screen, and the check-in/history tiles. "New" only on up to two games you haven't played while you've
// played others; a first visit gets one quiet "Start here" on Odd one out instead.
const r2Stars = s => Array.isArray(s) ? s.filter(Boolean).length : 0;
const r2PlayedToday = k => { const h = (S.gym.skills[k] || {}).hist || []; return !!(h.length && h[h.length - 1][0] === today()); };
function r2Station(k, ic, name) { const s = stationLevel(k); return { id: k, ic, name: name || SKILLS[k].name, meta: s.lv ? `Level ${s.lv}` : SKILLS[k].what, attr: `data-st="${k}"`, done: r2PlayedToday(k) }; }
function r2Match(id, ic) { const lv = typeof mtLevel === "function" ? mtLevel(id) : 0; return { id: "mt-" + id, ic, name: MATCH[id].name, meta: lv ? `Level ${lv}` : MATCH[id].what, attr: `data-mt="${id}"` }; }
const r2Extras = () => (Array.isArray(window.TRAIN_TILES) ? window.TRAIN_TILES : []).filter(t => t && t.name);
const r2Extra = t => ({ id: "x-" + t.id, ic: t.icon || "gradient", name: t.name, meta: t.meta || "", attr: `data-r2-extra="${esc(t.id)}"`, more: t.more, played: !!t.played });
function r2TrainGames() {
  const st = ooS(), ln = st.line && typeof st.line === "object" ? st.line : {}, pr = st.pairs && typeof st.pairs === "object" ? st.pairs : {};
  const ms = typeof msState === "function" ? msState() : null, msFound = ms ? (ms.found[msLevelKey(ms.spec.level)] || []).length : 0;
  const mem = st.mix.wasthere || {}, memN = r2Stars(mem.stars);
  const xs = r2Extras(), hue = xs.find(t => t.id === "hue"), eye = xs.find(t => /painter/i.test(String(t.id)) && !t.more);
  const hs = typeof hgS === "function" ? hgS() : {};
  const games = [
    ...(ms ? [{ id: "map", ic: "map", name: "Study the map", attr: "data-mapstudy", played: msFound > 0, meta: msFound ? `${msFound.toLocaleString("en-US")} found` : "Find and name", done: !!(ms.day && ms.day.d === today() && ms.day.done) }] : []),
    { id: "oo", ic: "odd", name: "Odd one out", attr: "data-oo-map", played: !!st.sets, done: st.last === today(), meta: st.sets ? `Level ${(Number.isFinite(st.lv) ? st.lv : ooYou()) + 1}${ooStarCount() ? ` · ${ooStarCount()} ★` : ""}` : "Spot the odd tile" },
    ...(hue ? [{ ...r2Extra(hue), id: "hue", played: !!hs.plays, done: hs.last === today() }] : []),
    { id: "line", ic: "across", name: "Across the line", attr: "data-oo-line", played: !!(ln.n || ln.best), meta: ln.best ? `Best ${ln.best} of 8` : "Where a name ends" },
    { id: "memory", ic: "wasthere", name: "Color memory", attr: "data-r2-mix=\"wasthere\"", played: !!(memN || mem.best), meta: memN ? `${memN} of 3 ★` : "Find the newcomer" },
    eye ? r2Extra(eye) : { id: "pairs", ic: "pairs", name: "Painters' pairs", attr: "data-oo-pairs", played: !!(pr.n || pr.best), meta: pr.best ? `Best ${pr.best} of 6` : "Guess the painter" },
    // another lane's game (window.TRAIN_TILES) still gets a door, after the six
    ...xs.filter(t => !t.more && t !== hue && t !== eye && t.id !== "hue-daily").map(r2Extra),
  ];
  // "New": only while you're already playing, and at most two
  const anyPlayed = games.some(g => g.played);
  let n = 0;
  games.forEach(g => { g.fresh = anyPlayed && !g.played && n < 2 && !!++n; });
  if (!anyPlayed) { const oo = games.find(g => g.id === "oo"); if (oo) oo.meta = "Start here"; }
  return games;
}
// the drills, in three shelves (IMPROVE train.md: Light and dark, Color in context, The painter's bench)
function r2Drills() {
  return [
    ["Light and dark", [r2Station("value", "value"), r2Station("shade", "shade"), r2Station("vanish", "vanish"), r2Match("value", "valuescale"), r2Station("squint", "squint")]],
    ["Color in context", [r2Station("neutral", "neutral"), r2Station("match", "twolooks"), r2Match("kelvin", "kelvin"),
      { id: "after", ic: "after", name: AFTER.name, attr: `data-st="after"`, meta: (S.gym.demos || {}).after ? `${S.gym.demos.after.right} of ${S.gym.demos.after.n} named` : "Twenty seconds" }]],
    ["The painter's bench", [r2Match("masses", "masses"), r2Match("zorn", "zorn"), r2Match("cast", "cast"), r2Match("shot", "shot"),
      ...r2Extras().filter(t => t.more).map(r2Extra)]],
  ];
}
const r2Game = (t, i) => `<button class="r2-g${t.done ? " done" : ""}" ${t.attr} style="--k:${i};${r2Accents(t.id)}">${r2Icon(t.ic)}${t.fresh ? `<span class="r2-new">New</span>` : ""}<b>${esc(t.name)}</b><em>${esc(t.meta || "")}</em></button>`;
const r2Li = t => `<button class="r2-li${t.done ? " done" : ""}" ${t.attr} style="${r2Accents(t.id)}">${r2Icon(t.ic, true)}<span><b>${esc(t.name)}</b><em>${esc(t.meta || "")}</em></span></button>`;
const r2Row = (attr, ic, name, meta, id) => `<button class="r2-row" ${attr} style="${r2Accents(id)}">${r2Icon(ic, true)}<span><b>${esc(name)}</b><em>${esc(meta)}</em></span>${ICON.chev}</button>`;
const R2_TICK = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7"/></svg>`;

// ---------------------------------------------------------------- Train: today (todayPick's three parts)
// The color card never shows the color before you've named it (recall before reveal); the board card shows the
// day's board shape in its source's colors, and your solved corners once it's done.
const R2_BOARD = new Map();
function r2DayBoard(day) {
  if (R2_BOARD.has(day)) return R2_BOARD.get(day);
  let b = null;
  try { const spec = hgDailySpec(day, hgDailySrcs()); b = { shape: spec.shape, num: spec.num, c: hgCornerSets(spec.pal, hgRnd(hgHash("r2-today:" + day)), 1)[0] }; } catch (e) {}
  R2_BOARD.set(day, b);
  return b;
}
function r2TrainToday() {
  const day = today(), tp = typeof todayPick === "function" ? todayPick(day) : null, n = typeof chStreak === "function" ? chStreak() : 0;
  const p = typeof chToday === "function" ? chToday() : null, pHits = p ? (p.hits || []).filter(Boolean).length : 0;
  const cDone = typeof dnDone === "function" && dnDone(), cRec = typeof dnRec === "function" ? dnRec() : null;
  const hd = typeof hgS === "function" ? hgS().daily[day] : null, bd = typeof hgDailySpec === "function" ? r2DayBoard(day) : null;
  const tick = on => on ? `<span class="r2-tick" aria-label="Done">${R2_TICK}</span>` : "";
  const cHex = cDone && tp && tp.color ? tp.color.h : null;
  const colorVis = cHex ? `<span class="r2-td-sw" style="--c:${cHex}"></span>`
    : `<span class="r2-td-q" aria-hidden="true">${"<i></i>".repeat(6)}</span>`;
  const boardVis = bd && typeof hgMiniHTML === "function" ? hgMiniHTML(bd.shape, hd && Array.isArray(hd.c) && hd.c.length === 4 ? hd.c : bd.c) : "";
  const cards = [
    { attr: "data-dpaint", vis: `<span class="r2-td-pic r2-loading" id="r2DpImg"></span>`, name: "Painting", meta: p ? `${pHits} of ${(p.hits || []).length || 5} right` : "Five ways to look", done: !!p },
    ...(typeof daily === "function" ? [{ attr: "data-r2-colordle", vis: colorVis, name: cHex && tp ? tp.color.n : "Color", meta: cDone ? (cRec && cRec.ok ? `Named in ${cRec.g.length}` : "See it again") : "Name it in six", done: cDone }] : []),
    ...(typeof hgDaily === "function" ? [{ attr: "data-r2-board", vis: `<span class="r2-td-board">${boardVis}</span>`, name: "Gradient", meta: hd ? `${hd.moves} moves` : "Same board for all", done: !!hd }] : []),
  ];
  const all = cards.every(c => c.done);
  const sub = all ? "All three done. New ones tomorrow" : n > 1 ? `${n} days in a row` : "";
  return `<section class="r2-tdy">
    <div class="r2-sh"><h2 class="title-3">Today</h2>${sub ? `<span class="note">${esc(sub)}</span>` : ""}</div>
    <div class="r2-td-row">${cards.map((c, i) => `<button class="r2-td${c.done ? " done" : ""}" ${c.attr} style="--k:${i}">
      <span class="r2-td-v">${c.vis}${tick(c.done)}</span><b>${esc(c.name)}</b><em>${esc(c.meta)}</em></button>`).join("")}</div></section>`;
}

// ---------------------------------------------------------------- Train: your eye, the summary
const R2_FAMS = ["Reds", "Oranges", "Yellows", "Greens", "Blues", "Purples", "Pinks", "Browns", "Greys"];
function r2EyeData() {
  let m = null, line = "", any = false;
  try { m = ooS().model; any = Object.keys(m.j || {}).some(j => m.j[j] && m.j[j].n); line = ooEyeLine(); } catch (e) {}
  const old = skillState("hue").fam || {};
  const fams = R2_FAMS.map(f => {
    let th = null, sure = false;
    if (any) { const e = ooEye(m, f, null); if (e.th && e.n >= 3) { th = e.th; sure = e.sure; } }
    if (th == null && old[f]) { th = old[f]; sure = true; }
    return { f, th, sure, hex: typeof ooFamHex === "function" ? ooFamHex(f) : (FAM_HEX[f] || "#888") };
  });
  const measured = any || Object.keys(old).length > 0;
  if (!any && Object.keys(old).length >= 2) { const b = Object.entries(old).sort((x, y) => x[1] - y[1]); line = `You see ${b[0][0].toLowerCase()} to ${pctFmt(b[0][1])} different, ${b[b.length - 1][0].toLowerCase()} to ${pctFmt(b[b.length - 1][1])}.`; }
  return { any, measured, line, fams };
}
// one short line for the Train row: your sharpest family, or how it fills in
function r2EyeMeta(d, ci) {
  if (ci.due) return "A check-in is ready";
  const got = d.fams.filter(x => x.th != null).sort((a, b) => a.th - b.th);
  if (got.length >= 2) return `Sharpest on ${got[0].f.toLowerCase()}, ${pctFmt(got[0].th)}`;
  return "Fills in as you play";
}

// ---------------------------------------------------------------- Train: the room
function r2TrainHome() {
  const g = gyState(), ci = checkinDue(g.checkins, triedKeys().length, gyDay()), games = r2TrainGames(), eye = r2EyeData();
  const nDrills = r2Drills().reduce((s, [, xs]) => s + xs.length, 0);
  const el = show(`
    ${tabHead()}
    <h1 class="tab-title">Train</h1>
    ${r2TrainToday()}
    <section class="r2-gm"><div class="r2-sh"><h2 class="title-3">Games</h2></div>
      <div class="r2-games">${games.map(r2Game).join("")}</div></section>
    <div class="r2-rows">
      ${r2Row("data-r2-drills", "drills", "Drills", `${nDrills} drills, one judgment each`, "drills")}
      ${r2Row("data-r2-eye", "eye", "Your eye", r2EyeMeta(eye, ci), "eye")}
    </div>
  `, "gym r2 r2-train", "gym");
  r2WireTrain(el);
  r2TrainAsync(el);
}
// the shared wiring: every Train door, on whichever page it sits
function r2WireTrain(el) {
  const on = (sel, f) => el.querySelectorAll(sel).forEach(b => b.onclick = e => { buzz(4); f(b, e); });
  on("[data-st]", b => runDrill(b.dataset.st));
  on("[data-checkin]", () => runCheckin());
  on("[data-oo-map]", () => ooEnter());
  on("[data-oo-line]", () => ooAcross());
  on("[data-oo-pairs]", () => ooPairs());
  on("[data-mapstudy]", () => msOpen({ from: "gym" }));
  on("[data-mt]", b => openMatch(b.dataset.mt));
  on("[data-r2-mix]", b => ooPlayMix(b.dataset.r2Mix, { title: b.dataset.r2Mix === "wasthere" ? "Color memory" : "Train", onQuit: () => go("gym") }));
  on("[data-r2-colordle]", () => daily());
  on("[data-dpaint]", () => challenge());
  on("[data-r2-board]", () => hgDaily());
  on("[data-r2-drills]", () => r2DrillsPage());
  on("[data-r2-eye]", () => r2EyePage());
  on("[data-r2-extra]", b => { const t = (window.TRAIN_TILES || []).find(x => x && String(x.id) === b.dataset.r2Extra); if (t && typeof t.open === "function") t.open(); });
}
function r2TrainAsync(el) {
  const img = el.querySelector("#r2DpImg");
  if (img && typeof dpLoad === "function") dpLoad().then(e => {
    if (!img.isConnected) return;
    if (!e) throw new Error("no painting today");
    img.innerHTML = `<img src="${esc(dpThumb(e))}" alt="" decoding="async">`;
    const im = img.querySelector("img"); im.onload = () => img.classList.remove("r2-loading");
  }).catch(() => { if (img.isConnected) { img.classList.remove("r2-loading"); img.innerHTML = `<span class="r2-today-band">${r2Pal("dp").cols.map(h => `<i style="--c:${h}"></i>`).join("")}</span>`; } });
}
const r2Back = label => `<header class="deck-top r2-top"><button class="icon-btn" data-close aria-label="${esc(label)}">${ICON.back}</button></header>`;

// ---------------------------------------------------------------- Train › Drills (#/train/drills)
function r2DrillsPage() {
  const el = show(`
    ${r2Back("Back to Train")}
    <h1 class="tab-title">Drills</h1>
    <p class="r2-lede">One judgment at a time, each on its own ladder.</p>
    ${r2Drills().map(([t, xs]) => `<section class="r2-shelf"><div class="r2-sh"><h2 class="title-3">${esc(t)}</h2></div>
      <div class="r2-list">${xs.map(r2Li).join("")}</div></section>`).join("")}
  `, "gym r2 r2-sub");
  r2WireTrain(el);
  el.querySelector("[data-close]").onclick = () => go("gym");
}

// ---------------------------------------------------------------- Train › Your eye (#/train/eye)
// One door for everything about your eye: the nine families, one sentence, then the check-in, the detail by
// family and judgment (Odd one out's profile), the history of levels and check-ins, and your color vision.
const R2_CVD = { typical: "Typical", "red-green": "Red–green color blind", "blue-yellow": "Blue–yellow color blind", unsure: "Not sure" };
function r2EyePage() {
  const g = gyState(), ci = checkinDue(g.checkins, triedKeys().length, gyDay()), d = r2EyeData();
  const ks = ci.due ? checkinPick(triedKeys(), g.checkins) : [];
  const fams = d.fams.map(x => `<span class="r2-fam${x.th == null ? " na" : x.sure ? "" : " thin"}"><i style="--c:${x.hex}"></i><b>${x.th == null ? "–" : pctFmt(x.th)}</b><small>${esc(x.f)}</small></span>`).join("");
  const el = show(`
    ${r2Back("Back to Train")}
    <h1 class="tab-title">Your <em>eye</em></h1>
    <p class="r2-lede">${esc(d.measured ? d.line : "Fills in as you play: the smallest difference you can see in each color family.")}</p>
    <div class="r2-fams big" role="img" aria-label="Smallest difference you see, by color family">${fams}</div>
    <div class="r2-rows">
      ${ci.due ? r2Row("data-checkin", "checkin", "Weekly check-in", `${ks.map(k => SKILLS[k].name).join(" · ")} · about 3 min, no feedback`, "ci")
        : r2Row("data-r2-ciwhy", "checkin", "Weekly check-in", ci.why.replace("Next check-in in", "In").replace("Try three stations to unlock the weekly check-in", "Opens after three drills"), "ci")}
      ${d.any ? r2Row("data-r2-eyedetail", "odd", "By family and judgment", "Lightness, vividness and hue, from Odd one out", "oo") : ""}
      ${r2Row("data-r2-history", "history", "History", g.checkins.length ? `${g.checkins.length} check-in${g.checkins.length > 1 ? "s" : ""}, levels, the daily painting` : "Levels, check-ins, the daily painting", "hist")}
      ${r2Row("data-r2-vision", "squint", "Your color vision", S.profile ? R2_CVD[S.profile.cvd] || "Set" : "Not set: drills stay fair either way", "cvd")}
    </div>
    <p class="r2-fine">${cvdOn() ? `A simple adjustment for ${esc(S.profile.cvd)} color blindness is on. ` : ""}Differences are a percent of the black-to-white range; about 1% is the smallest most people see side by side. Practice sharpens these judgments. It isn't brain training.</p>
  `, "gym r2 r2-sub");
  r2WireTrain(el);
  const on = (sel, f) => { const b = el.querySelector(sel); if (b) b.onclick = () => { buzz(4); f(); }; };
  on("[data-r2-ciwhy]", () => toast(checkinDue(gyState().checkins, triedKeys().length, gyDay()).why));
  on("[data-r2-eyedetail]", () => { ooEyePage(); const c = document.querySelector(".oo-eye [data-close]"); if (c) c.onclick = () => r2EyePage(); });
  on("[data-r2-history]", () => { eyeReport(); const c = document.querySelector(".gym-eye [data-back]"); if (c) c.onclick = () => r2EyePage(); });
  on("[data-r2-vision]", () => profileSetup(r2EyePage, { why: "Your color vision" }));
  el.querySelector("[data-close]").onclick = () => go("gym");
}

// ================================================================ Studio
// your own colors first (the latest kept palette, else your hearted colors), else today's painting
function r2StudioCols() {
  const p = (S.palettes || [])[0];
  if (p && p.cols && p.cols.length >= 3) return { cols: p.cols.slice(0, 8), mine: true };
  const fv = typeof fvOrder === "function" && typeof fvCount === "function" && fvCount() >= 3 ? fvOrder("all").slice(0, 8) : null;
  if (fv) return { cols: fv, mine: true };
  return { cols: r2Pal("studio").cols, mine: false };
}
const r2ByL = cols => cols.slice().sort((a, b) => lab(a)[0] - lab(b)[0]);
function r2Viewfinder(cols) {
  // an out-of-focus room made of the colors; the reticle's patch is the middle block, so its name is honest
  const c = cols.length >= 6 ? cols.slice(0, 6) : [...cols, ...cols].slice(0, 6), mid = c[4];
  return { mid, html: `<span class="r2-vf-blur">${c.map(h => r2i(h)).join("")}</span><span class="r2-vf-mid" style="--c:${mid}"></span>` };
}
function r2StudioHome() {
  XSTACK = [];
  const saved = S.palettes || [], fvN = typeof fvCount === "function" ? fvCount() : 0, { cols } = r2StudioCols();
  const vf = r2Viewfinder(cols), vfName = nameOf(vf.mid);
  const byL = r2ByL(cols), dark = byL[0], light = byL[byL.length - 1], mid = r2Mid(cols, 0), [, , Hm] = lch(mid);
  const tri = [0, 120, 240].map(d => gyFit(64, 48, Hm + d));
  const triPts = [90, 210, 330].map(a => [50 + 34 * Math.cos(a * Math.PI / 180), 50 - 34 * Math.sin(a * Math.PI / 180)]);
  const palRow = p => `<button class="r2-pal" data-id="${esc(p.id)}"><span class="r2-pal-s">${p.cols.map(h => r2i(h)).join("")}</span><span class="r2-pal-t"><b>${esc(p.name || p.from || "Palette")}</b><em>${esc(p.at ? fmtDay(p.at) : "")}</em></span></button>`;
  const favC = S.fav && S.fav.h;
  const el = show(`
    ${tabHead()}
    <h1 class="tab-title">Studio</h1>
    <section class="r2-hero r2-cap r2-k0">
      <button class="r2-hpic r2-vf" data-eye aria-label="Point the camera"><span class="r2-vf-img" id="r2VfImg">${vf.html}</span>
        <span class="r2-reticle" aria-hidden="true"></span><span class="r2-vf-tag" id="r2VfTag" data-ink="${ink(vf.mid)}" style="--c:${vf.mid}">${esc(vfName.text || vfName.n)}</span></button>
      <div class="r2-ht"><h2 class="title-2">Point at <em>anything</em></h2></div>
      <p class="r2-hn">The camera names the color in the middle as you move. Every photo you keep gets its palette, its names and its closest paintings.</p>
      <button class="btn" data-eye>Point the camera${ICON.arrow}</button>
      <label class="r2-text">or pick a photo<input type="file" accept="image/*" hidden id="file"></label>
    </section>

    <section class="r2-blk" style="--k:1">
      <div class="r2-sh"><h3 class="title-3">Name</h3><span class="note">any color, about 1,000 words</span></div>
      <button class="r2-wide" data-namer><span class="r2-namer" aria-hidden="true"><span class="ring" style="background:${ringStops()}"></span><i style="--c:${r2Acc(cols, 1)}"></i></span>
        <span class="r2-wide-t"><b>Name any color</b><em>Drag, type or eyedrop. The nearest names follow as you go; this one is ${esc(nameOf(r2Acc(cols, 1)).n)}.</em></span>${ICON.chev}</button>
    </section>

    <section class="r2-blk" style="--k:2">
      <div class="r2-sh"><h3 class="title-3">Make</h3><span class="note">palettes from scratch</span></div>
      <div class="r2-grid">
        <button class="r2-tile wide2" data-wheel><span class="r2-pic r2-wheelpic"><span class="r2-mini" id="r2Mini"></span><span class="r2-wheelpal">${tri.concat(cols.slice(0, 3)).slice(0, 5).map(h => r2i(h)).join("")}</span></span><b class="r2-tn">Gamut wheel</b><span class="r2-tm">Lay a shape on the wheel; what's inside is your palette</span></button>
        <button class="r2-tile" data-lab="harmony"><span class="r2-pic r2-harm"><span class="ring" style="background:${ringStops()}"></span><svg viewBox="0 0 100 100" aria-hidden="true"><polygon points="${triPts.map(p => p.map(v => v.toFixed(1)).join(",")).join(" ")}"/>${triPts.map((p, i) => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="7.5" fill="${tri[i]}"/>`).join("")}</svg></span><b class="r2-tn">Harmony</b><span class="r2-tm">Build on the wheel</span></button>
        <button class="r2-tile" data-lab="contrast"><span class="r2-pic r2-albers"><span style="--g:${light}"><b style="--c:${mid}"></b></span><span style="--g:${dark}"><b style="--c:${mid}"></b></span></span><b class="r2-tn">Albers</b><span class="r2-tm">One color, two looks</span></button>
      </div>
    </section>

    <section class="r2-blk r2-yours" style="--k:3">
      <div class="r2-sh"><h3 class="title-3">Yours</h3><span class="note" id="r2YoursN">${saved.length ? `${saved.length} palette${saved.length > 1 ? "s" : ""}` : ""}</span></div>
      <div class="r2-rail r2-phs" id="r2Ph" aria-busy="true">${[0, 1, 2].map(() => `<span class="r2-ph-wait"></span>`).join("")}</div>
      <div class="r2-empty" id="r2Empty" hidden><b class="title-3">Your photos and palettes land here</b><span>Point the camera or pick a photo, and its palette is waiting next time. Palettes you keep from the wheel come here too.</span></div>
      ${saved.length ? `<div class="r2-pals">${saved.slice(0, 4).map(palRow).join("")}${saved.length > 4 ? `<div class="r2-palmore" hidden>${saved.slice(4).map(palRow).join("")}</div><button class="r2-text" data-r2-more>All ${saved.length} palettes</button>` : ""}</div>` : ""}
      ${typeof fvStudioRow === "function" ? fvStudioRow() : ""}
      <div class="r2-grid r2-taste">
        <button class="r2-tile" data-taste="color"><span class="r2-pic r2-duel">${favC ? `<i class="one" style="--c:${favC}"></i>` : `<i style="--c:${r2Acc(cols, 0)}"></i><i style="--c:${r2Acc(cols, 1)}"></i>`}</span><b class="r2-tn">${favC ? "Your color" : "Find your color"}</b><span class="r2-tm">${favC ? `${esc(S.fav.n.charAt(0).toUpperCase() + S.fav.n.slice(1))}-ish. Take it again` : "About 20 taps"}</span></button>
        <button class="r2-tile" data-taste="palette"><span class="r2-pic r2-duel r2-duel-pal">${[cols.slice(0, 4), r2ByL(cols).slice(-4)].map(p => `<i>${p.map(h => `<b style="--c:${h}"></b>`).join("")}</i>`).join("")}</span><b class="r2-tn">Find your palette</b><span class="r2-tm">About 15 taps</span></button>
      </div>
    </section>

    ${saved.length || fvN ? `<section class="r2-blk" style="--k:4"><button class="qrow r2-export" data-r2-export><span class="r2-ex-t"><b>Export</b><em>CSS, Tailwind, Figma, Procreate, Adobe</em></span>${ICON.chev}</button></section>` : ""}
  `, "studio r2 r2-studio", "studio");
  r2WireStudio(el);
}
function r2WireStudio(el) {
  const on = (sel, f) => el.querySelectorAll(sel).forEach(b => b.onclick = e => { buzz(4); f(b, e); });
  on("[data-eye]", () => eye());
  on("[data-namer]", () => LAB.namer());
  on("[data-wheel]", () => gamutWheel());
  on("[data-lab]", b => LAB[b.dataset.lab]());
  on("[data-taste]", b => tasteIntro(b.dataset.taste));
  on("[data-id]", b => openSavedPalette(b.dataset.id));
  on("[data-fv-row]", () => favShelf(() => go("studio")));
  on("[data-r2-more]", b => { const m = el.querySelector(".r2-palmore"); if (m) { m.hidden = false; b.remove(); } });
  on("[data-r2-export]", () => r2ExportPick());
  el.querySelector("#file").onchange = e => { const f = e.target.files[0]; if (f) loadImage(f, c => phCaptureAndOpen(c, "From a photo")); };
  // the wheel tile's picture is the real wheel, drawn small
  const mini = el.querySelector("#r2Mini");
  requestAnimationFrame(() => {
    if (!mini || !mini.isConnected || typeof wheelCanvas !== "function") return;
    const pts = MASKS.Warm.map(polar).map(([x, y]) => `${(x + 1) * 60},${(1 - y) * 60}`).join(" ");
    mini.appendChild(wheelCanvas(120));
    mini.insertAdjacentHTML("beforeend", `<svg viewBox="0 0 120 120"><path d="M60 0A60 60 0 1 1 59.99 0Z M${pts.split(" ").join(" L")}Z" fill="rgba(22,21,15,.55)" fill-rule="evenodd"/><polygon points="${pts}" fill="none" stroke="#F3F3F1" stroke-width="1.2" stroke-linejoin="round"/></svg>`);
  });
  r2StudioPhotos(el);
}
// your photos, newest first; the newest also becomes the viewfinder (named honestly: the patch under the reticle)
function r2StudioPhotos(el) {
  const host = el.querySelector("#r2Ph"), empty = el.querySelector("#r2Empty"), hasPals = !!(S.palettes || []).length;
  const settle = rows => {
    if (!host.isConnected) return;
    host.removeAttribute("aria-busy");
    const n = el.querySelector("#r2YoursN"), np = (S.palettes || []).length;
    if (n) n.textContent = [rows.length ? `${rows.length} photo${rows.length > 1 ? "s" : ""}` : "", np ? `${np} palette${np > 1 ? "s" : ""}` : ""].filter(Boolean).join(" · ");
    if (!rows.length) { host.remove(); if (!hasPals) empty.hidden = false; return; }
    host.innerHTML = rows.map((r, i) => { const pal = r.pals[6] || r.pals[3] || []; return `<button class="r2-ph" data-ph="${esc(r.id)}" style="--k:${i}">
      <span class="r2-ph-img"><img src="${phURL(r)}" alt="" loading="lazy"></span><span class="r2-ph-band">${pal.map(c => `<i style="--c:${c.h};flex:${Math.max(.06, c.share || .16)}"></i>`).join("")}</span>
      <small>${esc(r.title || fmtDay(r.at) || "Photo")}</small></button>`; }).join("");
    host.querySelectorAll("[data-ph]").forEach(b => {
      let t = 0;
      b.addEventListener("pointerdown", () => { t = setTimeout(() => { buzz(8); phDeleteConfirm(b.dataset.ph, () => go("studio")); }, 550); });
      ["pointerup", "pointercancel", "pointerleave"].forEach(ev => b.addEventListener(ev, () => clearTimeout(t)));
      b.onclick = () => photoPage(b.dataset.ph);
    });
    r2VfFromPhoto(el, rows[0]);
  };
  if (typeof phList !== "function") return settle([]);
  phList().then(settle).catch(() => settle([]));
}
function r2VfFromPhoto(el, r) {
  const box = el.querySelector("#r2VfImg"), tag = el.querySelector("#r2VfTag"); if (!box || !r) return;
  const img = new Image();
  img.onload = () => {
    if (!box.isConnected) return;
    let hex = null;
    try {
      // the middle tenth of the photo, averaged in linear light (the camera's own way of reading a patch)
      const c = document.createElement("canvas"), s = 24; c.width = c.height = s;
      const w = img.naturalWidth, h = img.naturalHeight, side = Math.min(w, h) * .1;
      c.getContext("2d").drawImage(img, (w - side) / 2, (h - side) / 2, side, side, 0, 0, s, s);
      const d = c.getContext("2d").getImageData(0, 0, s, s).data, acc = [0, 0, 0], lin = v => { v /= 255; return v > .04045 ? ((v + .055) / 1.055) ** 2.4 : v / 12.92; };
      for (let i = 0; i < d.length; i += 4) for (let k = 0; k < 3; k++) acc[k] += lin(d[i + k]);
      const enc = v => Math.round(clamp(v > .0031308 ? 1.055 * v ** (1 / 2.4) - .055 : 12.92 * v, 0, 1) * 255);
      hex = "#" + acc.map(v => enc(v / (s * s)).toString(16).padStart(2, "0")).join("").toUpperCase();
    } catch (e) {}
    box.innerHTML = `<img src="${img.src}" alt="">`;
    box.classList.add("photo");
    if (hex && tag) { const nm = nameOf(hex); tag.textContent = nm.text || nm.n; tag.dataset.ink = ink(hex); tag.style.setProperty("--c", hex); }
  };
  img.src = phURL(r);
}
// Export: pick what to export, then the Export sheet (js/export.js) does the rest
function r2ExportPick() {
  const saved = S.palettes || [], fv = typeof fvOrder === "function" ? fvOrder("all") : [];
  const { sh, close } = sheet(`<h3>Export</h3><p>Pick a palette. Every file carries the color names; screen colors are approximate.</p>
    ${fv.length ? `<button class="item r2-ex-item" data-r2-ex="fav"><span class="r2-pal-s">${fv.slice(0, 10).map(h => r2i(h)).join("")}</span><b>Your hearted colors</b></button>` : ""}
    ${saved.map((p, i) => `<button class="item r2-ex-item" data-r2-ex="${i}"><span class="r2-pal-s">${p.cols.map(h => r2i(h)).join("")}</span><b>${esc(p.name || p.from || "Palette")}</b></button>`).join("")}`);
  sh.classList.add("r2-ex-sheet");
  sh.querySelectorAll("[data-r2-ex]").forEach(b => b.onclick = () => {
    const k = b.dataset.r2Ex, p = k === "fav" ? { cols: fv.slice(0, 24), name: "My colors" } : saved[+k];
    close(); buzz(6);
    setTimeout(() => exOpenSheet({ cols: p.cols.map(h => ({ h })), title: p.name || p.from || "Palette" }), 260);
  });
}
