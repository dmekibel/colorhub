"use strict";
// Learn a set (design/LEARN-SET.md): the one sheet every "Learn" opens (prQuick hands over to lsOpen), with two
// phases always there: Look (nothing hidden, six views) and Study (the mixed, adaptive session, like Quizlet Learn).
//   lsOpen({ seed, items, label, back })   the sheet: live preview, a size slider and a closeness slider (every
//     "Learn it" / "Study" from one color opens here first, seeded with it + its 3 nearest, so the settings are
//     always visible; LS_QUICK_N/LS_QUICK_GAP below are just that seeding default, one more tap from Start)
//   lsLook(items, { label, view, back })    the Look screen
//   lsStudy(items, { label, back, src, route }, resume)   the mixed session, then its results (lsKeep: cards + the set)
// Builds on js/practice.js (the PR_STEPS step contract, prRecord for the Learner Model and honest scheduling).

const LS_CLOSE = [["Twins", 2.5, "Very hard to tell apart"], ["Close", 5, "Easy to mix up"], ["Neighbors", 9, "Related, each its own"], ["Cousins", 14, "Same corner of the map"], ["Wide", 22, "A gentle tour"]];
const LS_VIEWS = [["grid", "Grid"], ["strip", "Strip"], ["pairs", "Pairs"], ["map", "Map"], ["art", "Paintings"], ["carousel", "Carousel"]];
const LS_COMBO = [3, 5, 10, 15, 20, 30];
// S.practice.ls (kept by migrateState as an unknown key; prState and this repair it, never wipe it). sets: the Study sets
// you worked on, with where they came from: { id: { t title, src kind, r route, hs hexes, at first day, last day, climbed keys } }
const lsState = () => {
  const p = prState(), ls = p.ls || (p.ls = { size: 10, close: 1, typing: false, view: "grid", best: {}, typingV: 2 });
  // typing is opt-in now (David, 2026-10-09: "typing the name really broke the flow"): an older save's default
  // (typing on, never chosen) turns off once; a choice made after this sticks
  if (ls.typingV !== 2) { ls.typing = false; ls.typingV = 2; }
  if (!ls.best || typeof ls.best !== "object") ls.best = {};
  if (!ls.sets || typeof ls.sets !== "object" || Array.isArray(ls.sets)) ls.sets = {};
  return ls;
};
const lsHexes = items => items.map(it => it.h).join("");
const lsSetKey = items => items.map(it => it.key).sort().join("|");
// a short stable id for a set (its sorted keys, hashed): a review card's "from" points here
const lsSetId = items => { let h = 5381; const k = lsSetKey(items); for (let i = 0; i < k.length; i++) h = (h * 33 + k.charCodeAt(i)) >>> 0; return "s" + h.toString(36); };
const LS_SETS_MAX = 60;
function lsExitTo(back) {
  return () => { if (typeof back === "function") back(); else if (back && /^#\/./.test(back)) { if (!openRoute(back)) go(S.tab || "learn"); } else go(S.tab || "learn"); };
}
// sound (js/sound.js): an explicit sfx in the same tick wins over the sound buzz() implies, so a moment keeps its haptic
const lsSfx = (fn, ...a) => { try { if (typeof window[fn] === "function") window[fn](...a); } catch (e) {} };
const lsOpenPage = it => { if (typeof openCoreName === "function") openCoreName(it.h, it.n); };
// a color and its look-alikes, every pair at least `gap` apart (ΔE2000), nearest first
function lsAlike(seed, n, gap) {
  const out = [seed], cand = prCore().filter(x => x.key !== seed.key && x.h !== seed.h).map(x => ({ x, d: de2000(seed.h, x.h) })).sort((a, b) => a.d - b.d);
  for (const o of cand) { if (out.length >= n) break; if (out.every(p => de2000(p.h, o.x.h) >= gap)) out.push(o.x); }
  return out;
}
// What you can name already (the Learner Model, js/learner.js): none | met | learning | yours
const LS_KNOW = { none: 0, met: 1, learning: 2, yours: 3 };
const lsKnow = it => { try { return typeof knowState === "function" ? knowState({ n: it.n, h: it.h }) : "none"; } catch (e) { return "none"; } };
// The sheet's pick from a big source (a painting, a palette, the map view): the colors you can't name yet first
// (yours are left out while at least 3 others remain), then nearest the seed (else the source's own order), spread
// so every pair is at least ΔE00 5 apart and each round is fair (falling back to 2.5, twins, for a tight source).
const LS_FAIR = [5, 2.5], LS_PICK_MAX = 60;
function lsPick(these, seed) {
  const st = these.map((it, i) => ({ it, i, k: lsKnow(it), d: seed ? de2000(seed.h, it.h) : 0 }));
  const open = st.filter(x => x.k !== "yours"), dropYours = open.length >= 3;
  const pool = (dropYours ? open : st).slice().sort((a, b) => LS_KNOW[a.k] - LS_KNOW[b.k] || a.d - b.d || a.i - b.i);
  const spread = gap => { const out = []; for (const x of pool) { if (out.length >= LS_PICK_MAX) break; if (out.every(y => de2000(y.it.h, x.it.h) >= gap)) out.push(x); } return out; };
  let got = spread(LS_FAIR[0]);
  if (got.length < Math.min(3, pool.length)) got = spread(LS_FAIR[1]);
  return { list: got.map(x => x.it), know: new Map(st.map(x => [x.it.key, x.k])), yoursOut: dropYours ? st.length - open.length : 0,
    twinsOut: got.length < LS_PICK_MAX ? Math.max(0, pool.length - got.length) : 0 };
}

// ----------------------------------------------------------------------
// Pinned sets (David, 2026-10-08): Study from a pair, a set or a palette keeps THOSE colors (pinned, always in, their
// identity) and offers look-alikes to study beside them. lsNeighbors gives each pinned color its nearest Learn-layer
// names, the ones you can't name yet first; lsGroups turns the picks into the session: items + groups for the pacer.
// ----------------------------------------------------------------------
const LS_NB_MAX = 4, LS_NB_GAP = 3, LS_NB_REACH = 24, LS_NB_POOL = 10;
// default neighbors per pinned color: 2 for a pair, 1 for 3-5 colors, 0 for more
const lsNbDefault = n => n <= 2 ? 2 : n <= 5 ? 1 : 0;
// -> [{ pin, nbs: [item…] }]  (up to LS_NB_MAX each, in the order they'd be added; a smaller "per" is just a prefix).
// Round-robin over the pins, so a close pair doesn't give all the good neighbors to the first; no neighbor is a pinned
// color or within LS_NB_GAP (ΔE00) of one, of another neighbor, or of itself twice.
function lsNeighbors(pins, o = {}) {
  const max = o.max || LS_NB_MAX, core = prCore(), taken = pins.slice();
  const ranked = pins.map(pin => core.filter(x => x.key !== pin.key && x.h !== pin.h).map(x => ({ x, d: de2000(pin.h, x.h) }))
    .filter(c => c.d <= LS_NB_REACH).sort((a, b) => a.d - b.d).slice(0, LS_NB_POOL * 3)
    .map(c => ({ ...c, k: LS_KNOW[lsKnow(c.x)] || 0 })));
  // the nearest ten, the ones you can't name yet first within them, then a little further if ten weren't enough
  const order = ranked.map(list => { const near = list.slice(0, LS_NB_POOL).sort((a, b) => (a.k === 3) - (b.k === 3) || a.k - b.k || a.d - b.d); return [...near, ...list.slice(LS_NB_POOL)].map(c => c.x); });
  const out = pins.map(pin => ({ pin, nbs: [] })), at = pins.map(() => 0);
  for (let r = 0; r < max; r++) pins.forEach((pin, i) => {
    while (at[i] < order[i].length) {
      const x = order[i][at[i]++];
      if (taken.some(t => t.key === x.key || t.h === x.h || de2000(t.h, x.h) < LS_NB_GAP)) continue;
      out[i].nbs.push(x); taken.push(x); break;
    }
  });
  return out;
}
// the picks (per neighbors each, minus the removed, plus the added) -> { groups: [{ pin, nbs }], items, keys: [[pinKey, nbKey…]] }
function lsGroups(auto, per, rm, extra) {
  const groups = auto.map(g => ({ pin: g.pin, nbs: g.nbs.slice(0, per).filter(x => !rm.has(x.key)) }));
  (extra || []).forEach(x => {
    if (groups.some(g => g.pin.key === x.key || g.nbs.some(n => n.key === x.key))) return;
    let b = groups[0], bd = Infinity; groups.forEach(g => { const d = de2000(g.pin.h, x.h); if (d < bd) { bd = d; b = g; } });
    b.nbs.push(x);
  });
  return { groups, items: prUnique(groups.flatMap(g => [g.pin, ...g.nbs])), keys: groups.map(g => [g.pin.key, ...g.nbs.map(n => n.key)]) };
}
// the line under the preview that says why these colors: "The 8 you can't name yet · 3 you know left out"
function lsWhy(items, pick, all) {
  const know = pick ? pick.know : new Map(items.map(it => [it.key, lsKnow(it)]));
  const nNew = items.filter(it => know.get(it.key) !== "yours").length, nKnow = items.length - nNew, parts = [];
  if (!nKnow) parts.push(nNew === 1 ? (all ? "The one you can't name yet" : "One you can't name yet") : `${all ? "The " : ""}${nNew} you can't name yet`);
  else if (nNew) parts.push(`${nNew} you can't name yet, ${nKnow} you know`);
  else parts.push(nKnow === 1 ? "One you can name already" : `All ${nKnow} you can name already`);
  if (pick && pick.yoursOut) parts.push(`${pick.yoursOut} you know left out`);
  if (pick && pick.twinsOut) parts.push(`${pick.twinsOut} near-twin${pick.twinsOut === 1 ? "" : "s"} left out`);
  return parts.join(" · ");
}
// where a set came from, kept with it for tomorrow's review: alike | painting | color | palette | photo | daily | set …
function lsSrcOf(o, from, route) {
  if (from === "alike") return "alike";
  if (o.src) return String(o.src);
  const m = typeof route === "string" && route.match(/^#\/(painting|gallery|color|page|story|palette|photo|today|daily|explore)\b/);
  return m ? (m[1] === "gallery" ? "painting" : m[1] === "page" ? "color" : m[1]) : "set";
}

// ======================================================================
// Learn it, straight away (Lane E): one tap on a single color opens the sheet below, seeded with it plus its 3
// closest Learn-layer neighbors (ΔE00 ≥ 4 apart) and today's settings already filled in (David, 2026-10-09: tapping
// "Learn it"/"Study" from a color used to start Study immediately; now it opens the settings first, one more tap
// from Start). LS_QUICK_N/LS_QUICK_GAP are just that seeded default's shape.
// ======================================================================
const LS_QUICK_N = 4, LS_QUICK_GAP = 4;

// ======================================================================
// The sheet
// ======================================================================
function lsOpen(o = {}) {
  if (typeof CORE_NAMES !== "undefined" && !CORE_NAMES && typeof loadCoreNames === "function") return void loadCoreNames().then(() => lsOpen(o));
  const ls = lsState(), backTo = o.back || (typeof ROUTE_NOW !== "undefined" ? ROUTE_NOW : "");
  const seed = prSeed(o.seed), app = seed && seed.c && seed.c.unit ? seed.c : null;
  const these = prUnique((o.items || []).map(x => typeof x === "string" ? prItemOf(x) : prSeed(x)).filter(Boolean));
  // o.size: a one-time seed default (Learn it hands in LS_QUICK_N, the color + 3 nearest) so the first sheet from a
  // single color matches the old quick mode; once you touch the slider it's remembered (ls.size) like any other sheet
  const st = { from: these.length && !(seed && o.source === "alike") ? "these" : seed ? "alike" : "these", size: o.size != null ? o.size : (ls.size || 10), close: ls.close != null ? ls.close : 1 };
  if (!seed && !these.length) return toast("Nothing here to learn yet");
  // pinned (a pair, a set, a palette): these colors are the set; look-alikes are offered beside each (lsNeighbors)
  const pinned = !!o.pin && these.length >= 1, auto = pinned ? lsNeighbors(these) : null;
  if (pinned) { st.from = "these"; st.per = lsNbDefault(these.length); st.rm = new Set(); st.extra = []; }
  let grp = null;
  const { sh, close } = sheet(`<div class="pr-quick ls-sheet">
    <div class="pr-qhead"><h2 class="pr-t2" data-qtitle></h2><span class="pr-note" data-qcount></span></div>
    <div class="ls-from" data-from></div>
    <div class="pr-plate ls-prev" data-prev></div>
    <div class="ls-groups" data-groups hidden></div>
    <div class="ls-say"><p class="ls-names" data-names></p><p class="ls-why" data-why></p></div>
    <label class="ls-slide" data-sizerow><span class="ls-sl-t">How many</span><input type="range" data-size aria-label="How many colors"><b class="ls-sl-v" data-sizev></b></label>
    <label class="ls-slide" data-closerow><span class="ls-sl-t">How close</span><input type="range" min="0" max="${LS_CLOSE.length - 1}" step="1" data-closeness aria-label="How close the look-alikes are"><b class="ls-sl-v" data-closev></b></label>
    <label class="ls-slide" data-perrow hidden><span class="ls-sl-t">Neighbors</span><input type="range" min="0" max="${LS_NB_MAX}" step="1" data-per aria-label="Look-alikes per color"><b class="ls-sl-v" data-perv></b></label>
    <p class="ls-closehint" data-closehint></p>
    <div class="ls-go" data-qgo><button class="ls-look" data-look>${LS_ICON.eye}<span>Look</span></button>${prPrimary("Study", "", "data-go")}</div>
    <div class="ls-pace"><div class="pr-rail" role="radiogroup" aria-label="Pace">${LS_PACES.map(([k, t]) => `<button class="pr-chip" role="radio" data-pace="${k}">${t}</button>`).join("")}</div><p class="ls-pace-say" data-pacesay></p></div>
    <label class="ls-typing"><input type="checkbox" data-typing${ls.typing === true ? " checked" : ""}><span>Ask me to type names near the end</span></label>
    <div class="ls-just"><span class="pr-note">Just one way</span><div class="pr-rail">${[["cards", "Flashcards"], ["quiz", "Quiz"], ["match", "Matching"], ["type", "Type it"], ["odd", "Odd one out"]].map(([m, t]) => `<button class="pr-chip" data-method="${m}">${t}</button>`).join("")}${app && typeof hmLearnIt === "function" ? `<button class="pr-chip" data-method="lesson">The full lesson</button>` : ""}</div></div>
  </div>`);
  sh.classList.add("pr-qsheet", "ls-qsheet");
  const $s = s => sh.querySelector(s), size = $s("[data-size]"), closeIn = $s("[data-closeness]");
  let items = [];
  // o.exact: the caller already chose and ordered these (the Learn room's For you puts due reviews first): keep them
  // as they are, yours included, so the How many slider trims from the end
  const pick = these.length ? (o.exact ? { list: these.slice(0, LS_PICK_MAX), know: new Map(these.map(it => [it.key, lsKnow(it)])), yoursOut: 0, twinsOut: 0 } : lsPick(these, seed)) : { list: [], know: new Map(), yoursOut: 0, twinsOut: 0 };
  const build = () => {
    if (pinned) { grp = lsGroups(auto, st.per, st.rm, st.extra); return grp.items; }
    if (st.from === "alike" && seed) return lsAlike(seed, st.size, LS_CLOSE[st.close][1]);
    return pick.list.slice(0, st.size);
  };
  const paintPinned = () => {
    items = build();
    const nPin = these.length, nNb = items.length - nPin, nm = o.label || "these colors", per = $s("[data-per]");
    per.value = st.per;
    $s("[data-qtitle]").innerHTML = `Study <em>${esc(nm)}</em>`;
    $s("[data-qcount]").textContent = nNb ? `plus ${nNb} look-alike${nNb === 1 ? "" : "s"}` : "";
    $s("[data-from]").innerHTML = "";
    $s("[data-prev]").hidden = true; $s("[data-sizerow]").hidden = true; $s("[data-closerow]").hidden = true;
    $s("[data-perrow]").hidden = false; $s("[data-closehint]").hidden = false;
    $s("[data-perv]").textContent = st.per ? `${st.per} each` : "None";
    $s("[data-closehint]").textContent = st.per ? "The closest names you can't say yet, beside each of yours. Tap one to leave it out." : "Only your colors. Add look-alikes to study them in relation to the rest.";
    const g = $s("[data-groups]"); g.hidden = false; g.classList.toggle("rows", grp.groups.some(x => x.nbs.length));
    g.innerHTML = grp.groups.map(x => `<div class="ls-grp"><span class="ls-chip pin" title="In your set"><i style="--c:${x.pin.h}"></i>${esc(prName(x.pin))}</span>${x.nbs.map(n => `<button class="ls-chip nb" data-rm="${esc(n.key)}" aria-label="Leave out ${esc(prName(n))}"><i style="--c:${n.h}"></i>${esc(prName(n))}<span class="ls-x" aria-hidden="true">×</span></button>`).join("")}</div>`).join("")
      + (typeof sxPick === "function" ? `<button class="ls-chip ls-add" data-add>+ Add a color</button>` : "");
    $s("[data-names]").textContent = items.slice(0, 6).map(prName).join(", ") + (items.length > 6 ? `, and ${items.length - 6} more` : "");
    $s("[data-why]").textContent = lsWhy(items, null, false);
    const pace = o.pace || ls.pace || "you", nNew = items.filter(it => { const k = lsKnow(it); return k === "none" || k === "met"; }).length;
    sh.querySelectorAll("[data-pace]").forEach(b => { const on = b.dataset.pace === pace; b.classList.toggle("on", on); b.setAttribute("aria-checked", on); });
    $s("[data-pacesay]").textContent = lsPaceSay(pace, nNew);
    const mins = Math.max(1, Math.round((items.length * 2.6 * 5 + (pace === "test" ? 0 : nNew * 6)) / 60));
    $s("[data-go]").querySelector("em") ? 0 : $s("[data-go] span").insertAdjacentHTML("afterend", "<em></em>");
    $s("[data-go] em").textContent = `about ${mins} min`;
  };
  const paint = () => {
    const max = st.from === "alike" ? 30 : Math.max(pick.list.length, 1);
    if (pinned) return paintPinned();
    const lo = Math.min(2, max);
    if (st.size > max) st.size = max; if (st.size < lo) st.size = lo;
    cnt.range(lo, max); cnt.set(st.size); size.disabled = max <= 2;
    items = build();
    const nm = seed ? prName(seed) : "";
    $s("[data-qtitle]").innerHTML = o.title && st.from === "these" ? o.title : st.from === "alike" ? `Learn <em>${esc(nm)}</em>` : `Learn <em>${esc(o.label || "these colors")}</em>`;
    $s("[data-qcount]").innerHTML = st.from === "alike" ? "and its look-alikes" : "";
    $s("[data-from]").innerHTML = seed && these.length ? [["alike", "Its look-alikes"], ["these", o.label || "These colors"]].map(([k, t]) => `<button class="pr-chip${k === st.from ? " on" : ""}" data-fromk="${k}">${esc(t)}</button>`).join("") : "";
    $s("[data-prev]").innerHTML = items.map((it, k) => `<i style="--c:${it.h};--k:${k}" title="${esc(prName(it))}"></i>`).join("");
    $s("[data-prev]").style.setProperty("--n", items.length);
    $s("[data-names]").textContent = items.slice(0, 6).map(prName).join(", ") + (items.length > 6 ? `, and ${items.length - 6} more` : "");
    $s("[data-sizev]").textContent = st.size >= max && st.from === "these" && max > 3 ? `All ${max}` : String(items.length);
    $s("[data-sizerow]").hidden = max <= 2;
    const fromThese = st.from === "these";
    $s("[data-why]").textContent = items.length ? (o.why && fromThese ? o.why(items) : lsWhy(items, fromThese ? pick : null, fromThese && items.length >= pick.list.length)) : "";
    const showClose = st.from === "alike";
    $s("[data-closerow]").hidden = !showClose; $s("[data-closehint]").hidden = !showClose;
    closeIn.value = st.close; $s("[data-closev]").textContent = LS_CLOSE[st.close][0]; $s("[data-closehint]").textContent = LS_CLOSE[st.close][2] + (items.length < st.size ? `. Only ${items.length} names are that far apart here.` : ".");
    const pace = o.pace || ls.pace || "you", nNew = items.filter(it => { const k = fromThese ? pick.know.get(it.key) || lsKnow(it) : lsKnow(it); return k === "none" || k === "met"; }).length;
    sh.querySelectorAll("[data-pace]").forEach(b => { const on = b.dataset.pace === pace; b.classList.toggle("on", on); b.setAttribute("aria-checked", on); });
    $s("[data-pacesay]").textContent = lsPaceSay(pace, nNew);
    const mins = Math.max(1, Math.round((items.length * 2.6 * 5 + (pace === "test" ? 0 : nNew * 6)) / 60));
    $s("[data-go]").querySelector("em") ? 0 : $s("[data-go] span").insertAdjacentHTML("afterend", "<em></em>");
    $s("[data-go] em").textContent = `about ${mins} min`;
  };
  const remember = () => { if (!pinned) { ls.size = st.size; if (st.from === "alike") ls.close = st.close; } ls.typing = $s("[data-typing]").checked; save(); };
  let lastTick = "";
  const onSlide = () => { st.close = +closeIn.value; paint(); const k = st.size + "|" + st.close; if (k !== lastTick) { lastTick = k; buzz(3); } };
  // How many: stops on the track (small sizes get most of it) and −/+ steppers for an exact count (countify, core.js)
  const cnt = countify(size, { min: 2, max: 30, value: st.size, out: $s("[data-sizev]"), onSet: (v, final) => { st.size = v; onSlide(); if (final) remember(); } });
  const perIn = $s("[data-per]");
  let lastPer = st.per;
  perIn.oninput = () => { st.per = +perIn.value; paint(); if (st.per !== lastPer) { lastPer = st.per; buzz(3); } };
  closeIn.oninput = onSlide; closeIn.onchange = remember;
  $s("[data-typing]").onchange = () => { remember(); buzz(4); };
  const exit = lsExitTo(backTo), again = () => setTimeout(() => lsOpen({ ...o, back: backTo }), 60);
  const label = () => pinned ? (o.label || "These colors") : st.from === "alike" && seed ? `${prName(seed)} and its look-alikes` : (o.label || "These colors");
  const setOpts = () => ({ label: label(), back: exit, reopen: again, route: typeof backTo === "string" ? backTo : "", src: lsSrcOf(o, st.from, backTo), ...(o.pace ? { pace: o.pace } : {}),
    ...(pinned ? { pin: these, groups: grp.keys, route: o.route || (typeof backTo === "string" ? backTo : "") } : {}) });
  sh.addEventListener("click", e => {
    const rmb = e.target.closest("[data-rm]"); if (rmb) { st.rm.add(rmb.dataset.rm); st.extra = st.extra.filter(x => x.key !== rmb.dataset.rm); buzz(5); paint(); return; }
    if (e.target.closest("[data-add]")) {
      buzz(5);
      return void sxPick(these[0].h, { title: o.label || "your colors", onPick: h => { const it = prItemOf(h); if (it) { st.rm.delete(it.key); if (!items.some(x => x.key === it.key)) st.extra.push(it); paint(); } } });
    }
    const f = e.target.closest("[data-fromk]"); if (f) { st.from = f.dataset.fromk; buzz(4); paint(); return; }
    const pc = e.target.closest("[data-pace]"); if (pc) { ls.pace = pc.dataset.pace; o.pace = null; save(); buzz(4); paint(); return; }
    const m = e.target.closest("[data-method]"); if (!m || !items.length) return;
    remember(); close(); buzz(8);
    if (m.dataset.method === "lesson") return hmLearnIt(app, { lesson: true });
    prPlay(m.dataset.method, { items: prShuffle(items), label: label(), exit, other: () => { exit(); again(); } });
  });
  $s("[data-look]").onclick = () => { if (!items.length) return; remember(); close(); buzz(8); lsLook(items, setOpts()); };
  $s("[data-go]").onclick = () => { if (!items.length) return; remember(); close(); buzz(8); lsStudy(items, setOpts()); };
  paint();
  return { sh, close };
}
// the line under the pace chips: what Study will do with these colors
function lsPaceSay(pace, nNew) {
  const meet = nNew ? `Meets the ${nNew === 1 ? "new one" : `${nNew} new ones`} first` : "Nothing new to meet";
  if (pace === "gentle") return `${meet}, two at a time, with easy questions to start.`;
  if (pace === "standard") return `${meet}, then a steady climb from picking to naming from memory.`;
  if (pace === "test") return "No looking first: straight to finding and naming.";
  return `${meet}, then questions that keep up with you.`;
}
// a hex's label: one line when it fits, else two balanced lines, sized so the longest line fits the hex (about 0.9 wide)
function lsHexLabel(name, x, y, fill) {
  const w = name.split(" ");
  let lines = [name];
  if (name.length > 9 && w.length > 1) {
    let best = null;
    for (let k = 1; k < w.length; k++) { const a = w.slice(0, k).join(" "), b = w.slice(k).join(" "), m = Math.max(a.length, b.length); if (!best || m < best.m) best = { m, l: [a, b] }; }
    lines = best.l;
  }
  const long = Math.max(...lines.map(l => l.length)), fs = Math.min(.22, .9 / (.5 * Math.max(4, long))), lh = fs * 1.05;
  const y0 = y + .04 - (lines.length - 1) * lh / 2;
  return `<text x="${x}" fill="${fill}" font-size="${fs.toFixed(3)}">${lines.map((l, i) => `<tspan x="${x}" y="${(y0 + i * lh).toFixed(3)}">${esc(l)}</tspan>`).join("")}</text>`;
}
const LS_ICON = { eye: icon("train", 22), map: icon("map", 18) };   // js/core.js ICON_PATHS

// ======================================================================
// Look: no hiding, many views
// ======================================================================
function lsLook(items, o = {}) {
  const ls = lsState();
  let view = o.view || ls.view || "grid", order = "light";
  const el = show(`<header class="pr-top"><button class="pr-x" data-close aria-label="Close">${prX()}</button><span class="pr-grow"></span><span class="pr-note">${items.length} colors</span></header>
    <h1 class="pr-t2 ls-look-t">${esc(o.label || "These colors")}</h1>
    <div class="ls-views" role="tablist">${LS_VIEWS.map(([k, t]) => `<button role="tab" class="ls-vb" data-view="${k}">${t}</button>`).join("")}</div>
    <div class="ls-body" data-body></div>
    <div class="ls-foot">${prPrimary("Test me", "the mixed session", "data-test")}</div>`, "pr-home pr-look ls-lookscr");
  const body = el.querySelector("[data-body]");
  const nameTag = it => `<b>${esc(prName(it))}</b>`;
  const nearest = it => { let b = null, bd = Infinity; items.forEach(x => { if (x !== it) { const d = de2000(it.h, x.h); if (d < bd) { bd = d; b = x; } } }); return b ? { x: b, d: bd } : null; };
  const closeWord = d => d < 5 ? "Very close" : d < 10 ? "Close" : d < 20 ? "Related" : "Far apart";
  const R = {
    grid: () => `<div class="ls-grid">${items.map((it, i) => `<button class="ls-tile" data-i="${i}" style="--c:${it.h};color:${ink(it.h) === "dark" ? "#141311" : "#fff"}">${nameTag(it)}<span class="pr-code">${it.h}</span></button>`).join("")}</div>`,
    strip: () => {
      const sorted = items.slice().sort(order === "light" ? (a, b) => lab(b.h)[0] - lab(a.h)[0] : (a, b) => { const A = lch(a.h), B = lch(b.h); return (A[1] < 8 ? 999 : A[2]) - (B[1] < 8 ? 999 : B[2]) || B[0] - A[0]; });
      return `<div class="ls-seg2"><button class="pr-chip${order === "light" ? " on" : ""}" data-order="light">Light to dark</button><button class="pr-chip${order === "hue" ? " on" : ""}" data-order="hue">By hue</button></div>
        <div class="ls-strip">${sorted.map(it => `<button class="ls-band" data-i="${items.indexOf(it)}" style="--c:${it.h};color:${ink(it.h) === "dark" ? "#141311" : "#fff"}">${nameTag(it)}<span class="pr-code">L ${Math.round(lab(it.h)[0])}</span></button>`).join("")}</div>`;
    },
    pairs: () => {
      if (items.length < 2) return `<p class="pr-notep">One color has no pair. Add a few look-alikes from the sheet.</p>`;
      const seen = new Set(), pairs = [];
      items.forEach(it => { const n = nearest(it); if (!n) return; const k = [it.key, n.x.key].sort().join("|"); if (seen.has(k)) return; seen.add(k); pairs.push({ a: it, b: n.x, d: n.d }); });
      pairs.sort((p, q) => p.d - q.d);
      return `<p class="pr-notep">Each color beside the one in this set it's easiest to mix up with. Closest pairs first.</p><div class="ls-pairs">${pairs.map(p => `<div class="ls-pair">
        <div class="ls-pair-sw"><button data-i="${items.indexOf(p.a)}" style="--c:${p.a.h}"></button><button data-i="${items.indexOf(p.b)}" style="--c:${p.b.h}"></button></div>
        <div class="ls-pair-t"><b>${esc(prName(p.a))}</b><span class="pr-note">and</span><b>${esc(prName(p.b))}</b></div>
        <p>${esc(prDiff(p.a, p.b))}</p><span class="pr-note ls-pair-d">${closeWord(p.d)} · <span class="pr-code">ΔE ${p.d.toFixed(1)}</span></span></div>`).join("")}</div>`;
    },
    map: () => {
      if (typeof honeyCluster !== "function" || typeof honeyNorm !== "function") return R.grid();
      const lay = honeyCluster(items.map(it => honeyNorm(it))), pts = lay.pts;
      const xs = pts.map(p => p.x), ys = pts.map(p => p.y), x0 = Math.min(...xs) - .6, y0 = Math.min(...ys) - .6, w = Math.max(...xs) - x0 + .6, h = Math.max(...ys) - y0 + .6;
      const hex = (cx, cy) => { const r = .56, p = []; for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + k * Math.PI / 3; p.push((cx + r * Math.cos(a)).toFixed(3) + "," + (cy + r * Math.sin(a)).toFixed(3)); } return p.join(" "); };
      return `<p class="pr-notep">Hue runs across, light to dark runs down: the same layout as Home's honeycomb.</p>
        <svg class="ls-map" viewBox="${x0} ${y0} ${w} ${h}" role="img" aria-label="These colors on the color map">${pts.map(p => { const it = p.it.o; return `<g data-i="${items.indexOf(it)}"><polygon points="${hex(p.x, p.y)}" fill="${it.h}"/>${lsHexLabel(prName(it), p.x, p.y, ink(it.h) === "dark" ? "#141311" : "#fff")}</g>`; }).join("")}</svg>
        ${typeof csOnMap === "function" ? `<button class="pr-text ls-bigmap" data-bigmap>${LS_ICON.map} See them on the big map</button>` : ""}`;
    },
    art: () => {
      const hits = (window.PAINTINGS || []).filter(p => p.palette && p.palette.length && !p.stub && (p.thumb || p.img)).map(p => {
        const got = items.filter(it => p.palette.some(x => de2000(it.h, x.h) < 10));
        const share = p.palette.reduce((s, x) => s + (items.some(it => de2000(it.h, x.h) < 10) ? (x.share || 0) : 0), 0);
        return { p, got, share };
      }).filter(x => x.got.length).sort((a, b) => b.got.length - a.got.length || b.share - a.share).slice(0, 10);
      if (!hits.length) return `<p class="pr-notep">None of the museum paintings here leans on these colors. Try a wider set, or look at each color's own page.</p>`;
      return `<p class="pr-notep">Paintings whose colors come within a close match of this set (photographs of varnished paintings, so the colors are as photographed).</p><div class="ls-art">${hits.map(x => `<button class="ls-pt" data-ptg="${esc(String(x.p.id).replace(/^painting-/, ""))}"><img src="${esc(x.p.thumb || x.p.img)}" alt="" loading="lazy"><span class="ls-pt-t"><b>${esc(x.p.title)}</b><span class="pr-note">${esc(x.p.artist || "")}</span><span class="ls-pt-c">${x.got.map(it => `<i style="--c:${it.h}" title="${esc(prName(it))}"></i>`).join("")}<em>${x.got.length} of ${items.length}</em></span></span></button>`).join("")}</div>`;
    },
    carousel: () => `<div class="ls-car">${items.map((it, i) => { const n = nearest(it); return `<div class="ls-card" style="--c:${it.h};color:${ink(it.h) === "dark" ? "#141311" : "#fff"}" data-i="${i}">
      <span class="pr-code">${i + 1} / ${items.length}</span><b style="${prFit(prName(it), 56)}">${esc(prName(it))}</b><span class="pr-code">${it.h}</span>
      ${n ? `<p><span class="pr-pair"><i style="--c:${it.h}"></i><i style="--c:${n.x.h}"></i></span>${esc(prDiff(it, n.x))}</p>` : ""}</div>`; }).join("")}</div>`,
  };
  const paint = () => {
    el.querySelectorAll("[data-view]").forEach(b => { const on = b.dataset.view === view; b.classList.toggle("on", on); b.setAttribute("aria-selected", on); });
    body.innerHTML = R[view](); body.dataset.view = view;
    const bm = body.querySelector("[data-bigmap]"); if (bm) bm.onclick = () => csOnMap(colorSet({ kind: "learn", id: lsHexes(items), title: o.label || "", colors: items.map(it => ({ h: it.h, n: it.n })) }));
  };
  el.querySelector(".ls-views").onclick = e => { const b = e.target.closest("[data-view]"); if (!b || b.dataset.view === view) return; view = b.dataset.view; ls.view = view; save(); buzz(4); paint(); };
  body.addEventListener("click", e => {
    const ob = e.target.closest("[data-order]"); if (ob) { order = ob.dataset.order; buzz(4); return paint(); }
    const pt = e.target.closest("[data-ptg]"); if (pt) { buzz(6); return void openRoute("#/painting/" + pt.dataset.ptg); }
    const t = e.target.closest("[data-i]"); if (t && items[+t.dataset.i]) { buzz(6); lsOpenPage(items[+t.dataset.i]); }
  });
  el.querySelector("[data-test]").onclick = () => { buzz(8); lsStudy(items, { ...o, looked: true }); };
  el.querySelector("[data-close]").onclick = () => (o.back || lsExitTo(""))();
  onKey = e => { if (e.key === "Escape") el.querySelector("[data-close]").click(); };
  paint();
  return el;
}

// ======================================================================
// Study: the mixed session
// ======================================================================
// Study keeps what you did. Every color you answered joins spaced review with the same new card as a path unit or
// Learn it (cardNew, js/learnmore.js: due tomorrow, so the first gap crosses a night's sleep), tagged with the set it
// came from; and the set itself is kept (lsState().sets) with its source, so a review can say where a name came from.
// A color that was already yours when the session began gets no card (a new one would read as "learning" again).
// Climbing in one session never makes a color yours: only tomorrow's unassisted recall does (isMine, js/pickit.js).
const lsUp = q => q.up != null ? !!q.up : q.lv >= 3;
function lsKeep(sess, items, o, lvOf) {
  const t = today(), ls = lsState(), id = lsSetId(items), made = [];
  sess.first.forEach(f => {
    const it = f.it, c = it && it.c, q = lvOf && lvOf.get(it.key);
    if (!c || !c.id || c.basic || S.cards[c.id] || (q && q.y)) return;
    S.cards[c.id] = { ...(typeof cardNew === "function" ? cardNew(c, t) : { b: 0, due: addDays(t, 1), since: t, own: false, n: c.n, h: c.h }), from: id };
    made.push(c.id);
  });
  const old = ls.sets[id] || {};
  ls.sets[id] = { t: String(o.label || old.t || "").slice(0, 80), src: o.src || old.src || "set", r: o.route || old.r || "", hs: items.map(it => it.h),
    ...(o.pin && o.pin.length ? { pin: o.pin.map(it => it.h) } : old.pin ? { pin: old.pin } : {}),
    at: old.at || t, last: t, climbed: lvOf ? [...lvOf.values()].filter(lsUp).map(q => q.it.key) : (old.climbed || []) };
  const ids = Object.keys(ls.sets);
  if (ids.length > LS_SETS_MAX) ids.sort((a, b) => String(ls.sets[a].last).localeCompare(String(ls.sets[b].last))).slice(0, ids.length - LS_SETS_MAX).forEach(k => { delete ls.sets[k]; });
  save();
  return made;
}
// The plan for one session (js/studypace.js): each color's rung from what you know (new 0 · learning 1 · yours 3,
// straight to recall), the pace you chose, your past mix-ups inside the set. y: yours already (it gets no new card).
// resume: Map(key -> rung) from a stopped session, so "Keep going" picks each one up there.
const LS_PACES = [["you", "For you"], ["gentle", "Gentle"], ["standard", "Standard"], ["test", "Test me"]];
function lsPlan(items, o = {}, resume = null) {
  const know = new Map(items.map(it => [it.key, lsKnow(it)])), keys = new Set(items.map(it => it.key));
  let mix = [];
  try { if (typeof confusions === "function") mix = confusions(null, 40).map(p => [String(p.a || "").toLowerCase(), String(p.b || "").toLowerCase()]).filter(([a, b]) => keys.has(a) && keys.has(b)).slice(0, 3); } catch (e) {}
  // due reviews in the set (spaced review): asked first, before anything new is met
  const t = today(), due = new Set(items.filter(it => { const st = it.c && it.c.id && S.cards && S.cards[it.c.id]; return st && st.due && st.due <= t; }).map(it => it.key));
  const P = spNew(items, { know, pace: o.pace || "you", typing: o.typing, quick: o.quick, looked: o.looked, mix, resume, de: de2000, groups: o.groups, due });
  P.qs.forEach(q => { q.y = q.k === "yours"; });
  return P;
}
function lsLevels(items, resume, o = {}) { return lsPlan(items, o, resume).qs; }
// A Meet card: the color big, its name, and how it differs from its nearest neighbor in the set. Learning, not a test.
function lsMeetHTML(it, nb, o = {}) {
  const dark = ink(it.h) === "dark" ? "#141311" : "#fff", nm = prName(it);
  return `<div class="pr-step ls-meet${o.again ? " again" : ""}">
    <div class="ls-meet-sw" style="--c:${it.h};color:${dark}">
      <span class="ls-meet-tag">${o.again ? "Look again" : o.tag || "New"}</span>
      <span class="ls-meet-name"><button class="ls-meet-n" data-swatch="${it.h}" style="${prFit(nm, 56)}">${esc(nm)}</button><span class="pr-code">${it.h}</span></span>
    </div>
    ${nb ? `<p class="ls-meet-line"><span class="pr-pair"><i style="--c:${it.h}"></i><i style="--c:${nb.h}"></i></span><span>${esc(prDiff(it, nb))}</span></p>` : `<p class="ls-meet-line"></p>`}
    <div class="pr-foot">${prPrimary(o.label || "Next", "", "data-meetnext")}</div></div>`;
}
function lsPairHTML(a, b, why) {
  const half = x => `<div class="ls-mp-half" style="--c:${x.h}" data-ink="${ink(x.h)}"><button class="ls-meet-n" data-swatch="${x.h}" style="${prFit(prName(x), 30)}">${esc(prName(x))}</button><span class="pr-code">${x.h}</span></div>`;
  return `<div class="pr-step ls-meet ls-mpair">
    <p class="ls-mp-t">${why === "mixup" ? "You've mixed these up before" : "The closest two"}</p>
    <div class="ls-mp">${half(a)}${half(b)}</div>
    <p class="ls-meet-line"><span>${esc(prDiff(a, b))}</span></p>
    <div class="pr-foot">${prPrimary("Next", "", "data-meetnext")}</div></div>`;
}
function lsStudy(items, o = {}, resume = null) {
  if (!items.length) return;
  const ls = lsState(), n = items.length;
  const sess = prSession("learn", { dir: "f" }, items, { deckAll: items, label: o.label || "" });
  const P = lsPlan(items, { pace: o.pace || ls.pace || "you", typing: ls.typing === true, quick: o.quick, looked: o.looked, groups: o.groups }, resume), lvOf = P.qs;
  let combo = 0, bestCombo = 0, climbed = [...lvOf.values()].filter(lsUp).length, boss = null, meeting = null, aside = 0;
  const keep = () => lsKeep(sess, items, o, lvOf);
  // screenshot states (#lsshot=study:…): start mid-session
  if (o.shot === "match") { lvOf.forEach(q => { q.lv = 1; q.met = true; }); P.newQ.length = 0; P.wave = []; P.fresh = [...lvOf.values()]; P.sinceMatch = 6; }
  if (o.shot === "boss") { lvOf.forEach(q => { q.lv = P.top; q.up = true; }); climbed = n; P.newQ.length = 0; P.fresh.length = 0; }
  if (o.shot === "grad") { combo = 4; bestCombo = 4; lvOf.forEach(q => { q.met = true; q.lv = 1; }); P.newQ.length = 0; P.wave = []; const q = lvOf.get(items[0].key); q.lv = P.top - 1; P.fresh = [q, ...[...lvOf.values()].filter(x => x !== q)]; }
  if (o.shot === "ask" || o.shot === "wrong") { lvOf.forEach(q => { q.met = true; }); P.fresh = [...P.newQ, ...P.fresh]; P.newQ.length = 0; }
  const el = show(`<header class="pr-top"><button class="pr-x" data-close aria-label="Close">${prX()}</button>
      <div class="ls-prog">${items.map(it => `<i data-k="${esc(it.key)}" style="--c:${it.h}"></i>`).join("")}</div>
      <span class="ls-combo" data-combo aria-live="polite"><b>0</b><span>in a row</span></span></header>
    <p class="ls-status"><span data-status></span><span class="ls-pop" data-pop></span></p>
    <p class="pr-coach"${prState().seen.learnset ? " hidden" : ""}>${[...lvOf.values()].some(q => q.due) ? "The ones due today come first, from memory. Then you meet the new ones." : `Meet each color first. Then ${o.quick ? "a few quick questions on each" : "each one climbs from picking to naming it from memory"}.`}</p>
    <div class="pr-stage"></div><div class="ls-grad" data-grad></div>`, "fixed pr-play pr-booth pr-m-learn ls-study");
  const stage = el.querySelector(".pr-stage"), comboEl = el.querySelector("[data-combo]");
  let stepKey = null;
  const setKey = fn => { stepKey = fn; };
  onKey = e => { if (e.key === "Escape") return el.querySelector("[data-close]").click(); if (stepKey) stepKey(e); };
  const status = () => {
    const met = [...lvOf.values()].filter(q => !lsUp(q) && !q.out && q.met && q.lv > 0).length;
    el.querySelector("[data-status]").innerHTML = boss ? `Final round`
      : meeting ? `Meet · <span class="pr-code">${meeting.i}</span> of <span class="pr-code">${meeting.of}</span>`
      : `<span class="pr-code">${climbed}</span> of <span class="pr-code">${n}</span> climbed${met ? ` · <span class="pr-code">${met}</span> getting there` : ""}${aside ? ` · <span class="pr-code">${aside}</span> for tomorrow` : ""}`;
    lvOf.forEach((q, k) => { const s = el.querySelector(`.ls-prog i[data-k="${CSS.escape(k)}"]`); if (!s) return; s.style.setProperty("--lv", Math.min(P.top, q.lv) / P.top); s.classList.toggle("done", lsUp(q)); s.classList.toggle("aside", !!q.out); });
  };
  const pop = (txt, cls = "") => { const p = el.querySelector("[data-pop]"); p.className = "ls-pop " + cls; p.textContent = txt; void p.offsetWidth; p.classList.add("go"); };
  const bump = ok => {
    combo = ok ? combo + 1 : 0; bestCombo = Math.max(bestCombo, combo);
    comboEl.querySelector("b").textContent = combo; comboEl.classList.toggle("on", combo >= 2); comboEl.classList.toggle("hot", combo >= 3); comboEl.classList.toggle("fire", combo >= 10);
    comboEl.classList.remove("tick"); void comboEl.offsetWidth; if (ok) comboEl.classList.add("tick");
    if (ok && LS_COMBO.includes(combo)) { pop(`${combo} in a row`, "streak"); buzz([8, 30, 8, 30, 16]); lsSfx("sfx", combo >= 10 ? "best" : "combo", items.map(it => it.h)); }
  };
  const graduate = it => {
    climbed++; buzz([10, 30, 20]); coachDone();
    lsSfx("sfxColor", it.h, { long: true }); setTimeout(() => lsSfx("sfx", "best", [it.h]), 200);
    const seg = el.querySelector(`.ls-prog i[data-k="${CSS.escape(it.key)}"]`); if (seg) { seg.classList.remove("pop"); void seg.offsetWidth; seg.classList.add("pop"); }
    const g = el.querySelector("[data-grad]");
    g.innerHTML = `<span class="ls-gchip"><i style="--c:${it.h}"></i><b>${esc(prName(it))}</b><span>climbed</span></span>`;
    g.classList.remove("go"); void g.offsetWidth; g.classList.add("go");
  };
  const answer = (q, ok) => {
    const r = spAnswer(P, q, ok);
    if (r.up) graduate(q.it);
    if (r.out) { aside++; pop(`${prName(q.it)} comes back tomorrow`, "round"); }
    return r;
  };
  el._lsFx = { bump, graduate };   // screenshot hook
  const ctx = extra => ({ deck: items, feedback: true, setKey, screen: el, ...extra });
  el.querySelector("[data-close]").onclick = () => { sess.ended = true; if (sess.first.size) lsResults(sess, { items, o, stopped: true, bestCombo, climbed, lvOf }); else (o.back || lsExitTo(""))(); };
  const coachDone = () => { const c = el.querySelector(".pr-coach"); if (c && !c.hidden) { c.hidden = true; const p = prState(); p.seen.learnset = today(); save(); } };
  // the nearest other color in the set (for a Meet card's one line)
  // a pinned set: each color sits with its group (the pinned color and its look-alikes), so Meet and the questions pair them
  const itemOf = new Map(items.map(it => [it.key, it])), mates = new Map(), pinKeys = new Set((o.pin || []).map(x => x.key));
  (o.groups || []).forEach(g => g.forEach(k => { if (!mates.has(k)) mates.set(k, g.filter(m => m !== k && itemOf.has(m)).map(m => itemOf.get(m))); }));
  const nearestIn = it => { let b = null, bd = Infinity; (mates.get(it.key) && mates.get(it.key).length ? mates.get(it.key) : items).forEach(x => { if (x !== it) { const d = de2000(it.h, x.h); if (d < bd) { bd = d; b = x; } } }); return b; };
  // The Meet/pair run as an Instagram-story pager (David, 2026-10-09): a wave of meet cards, then the closest-two
  // pair, all gathered up front (spNext is pure bookkeeping for these — no answer blocks it) and paged with thin
  // segments on top. Tap the right ~2/3 (or swipe left) to go on, the left ~1/3 (or swipe right) to go back; the
  // card's own controls (the name button, the Next/Start button) still work exactly where they're drawn. The same
  // beat-before-live guard as before stops a fast double tap from skipping a card unseen.
  const lsCardHTML = (a, isLast) => a.t === "pair" ? lsPairHTML(a.a.it, a.b.it, a.why)
    : lsMeetHTML(a.q.it, a.t === "relook" && a.q.pick && a.q.pick.h !== a.q.it.h ? a.q.pick : nearestIn(a.q.it),
        { again: a.t === "relook", tag: pinKeys.size ? (pinKeys.has(a.q.it.key) ? "In your set" : "Look-alike") : "", label: a.t === "relook" ? "Got it" : isLast ? "Start" : "Next" });
  const runStory = run => new Promise(resolve => {
    const total = run.length, shown = new Set();
    let i = 0, live = false, down = null;
    const finish = () => { stage.onpointerdown = stage.onpointerup = null; delete stage._lsStory; buzz(6); resolve(); };
    const renderAt = idx => {
      i = idx; live = false;
      const a = run[i], it = a.t === "pair" ? a.a.it : a.q.it;
      meeting = a.t !== "pair" ? { i: a.i, of: a.of } : null; status();
      if (!shown.has(i)) {
        shown.add(i);
        if (a.t === "meet" && a.i === 1 && a.wave > 0) pop(a.of === 1 ? "One more to meet" : `${a.of} more to meet`, "round");
        lsSfx("sfxColor", it.h);
      }
      stage.innerHTML = `<div class="ls-story-bars" data-bars>${run.map(() => "<i></i>").join("")}</div>` + lsCardHTML(a, i === total - 1);
      stage.querySelectorAll("[data-bars] i").forEach((seg, k) => { seg.classList.toggle("done", k < i); seg.classList.toggle("on", k === i); });
      const b = stage.querySelector("[data-meetnext]");
      // the button takes taps after a beat: the second tap of a quick double tap is dropped, not spent on this card
      later(() => { if (!b.isConnected) return; live = true; prNextBtn(b.parentElement, next, b.querySelector("span").textContent).setAttribute("data-meetnext", ""); }, 280);
      coachDone();
    };
    const next = () => { if (i < total - 1) renderAt(i + 1); else finish(); };
    const prev = () => { if (i > 0) renderAt(i - 1); };
    setKey(e => {
      if (!live) return;
      if (["Enter", " ", "ArrowRight"].includes(e.key)) { e.preventDefault(); next(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); prev(); }
    });
    const onDown = e => { const p = e.changedTouches ? e.changedTouches[0] : e; down = { x: p.clientX, y: p.clientY }; };
    const onUp = e => {
      if (!down || !live) { down = null; return; }
      if (e.target.closest("[data-swatch],[data-meetnext]")) { down = null; return; }   // the real controls behave normally
      const p = e.changedTouches ? e.changedTouches[0] : e, dx = p.clientX - down.x, dy = p.clientY - down.y;
      down = null;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) return void (dx < 0 ? next() : prev());   // a clean swipe
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) return;   // a drag that wasn't a clean swipe: not a tap either
      const r = stage.getBoundingClientRect();
      (p.clientX - r.left) / r.width < .33 ? prev() : next();
    };
    stage.onpointerdown = onDown; stage.onpointerup = onUp;
    stage._lsStory = { next, prev, at: () => i };   // smoke/test hook
    renderAt(0);
  });
  // options for an early rung: three far apart in the same family (spFar), so the first questions are winnable
  const farOpts = (it, k) => { const w = spFar(it, k, prUnique([...items, ...prCore().filter(x => x.rank <= 600)]), de2000, prFam9); return w.length >= k ? w : null; };
  // spot it among 6 to 10: its own family's neighbors first (never an obviously different color), then the set's
  // colors from that family, every tile at least ΔE00 5 from it and 4 from each other
  const spotOpts = (it, n) => {
    const fam = prFam9(it.h), out = [], fair = x => x && x.key !== it.key && x.h !== it.h && de2000(it.h, x.h) >= 5 && out.every(y => de2000(y.h, x.h) >= 4);
    [...prNear(it, Math.min(n, 9), items), ...items.filter(x => prFam9(x.h) === fam), ...prCore().filter(x => x.rank <= 800 && prFam9(x.h) === fam)].forEach(x => { if (out.length < n && fair(x)) out.push(x); });
    return out.length >= 3 ? out : null;
  };
  // recall among 6 to 8 names: close same-family neighbors only (prNear), so it's memory, not elimination
  const recallOpts = (it, n) => { const w = prNear(it, n, items); return w.length >= 3 ? w : null; };
  // same-group colors are the distractors first (the pinned color's look-alikes, and it for theirs), then the usual neighbors
  const groupOpts = (it, kind) => {
    const m = mates.get(it.key);
    if (!m || !m.length || (kind !== "quiz-name" && kind !== "quiz-color")) return null;
    const out = m.slice().sort((x, y) => de2000(it.h, x.h) - de2000(it.h, y.h)).slice(0, 3);
    if (out.length < 3) prNear(it, 6, items).forEach(x => { if (out.length < 3 && !out.includes(x) && x.key !== it.key) out.push(x); });
    return out.length === 3 ? out : null;
  };
  (async () => {
    status();
    let pendingSet = false, pendingVal = null;
    while (!sess.ended) {
      let a;
      if (pendingSet) { a = pendingVal; pendingSet = false; }
      else { try { a = spNext(P); } catch (err) { console.error("Study pacer failed", err); a = null; } }
      if (!a) break;
      if (a.t === "meet" || a.t === "relook" || a.t === "pair") {
        // gather the whole run (a wave of meets plus its closest-two pair) so it pages as one story, not one call per card
        const run = [a];
        while (true) {
          let b; try { b = spNext(P); } catch (err) { console.error("Study pacer failed", err); b = null; }
          if (b && (b.t === "meet" || b.t === "relook" || b.t === "pair")) run.push(b);
          else { pendingVal = b; pendingSet = true; break; }
        }
        await runStory(run);
        if (sess.ended || !stage.isConnected) return;
        meeting = null; status(); coachDone();
        continue;
      }
      if (a.t === "match") {
        const set = prShuffle(a.qs);
        pop("Matching round", "round"); buzz(8); lsSfx("sfx", "rooms", 4);
        const res = await PR_STEPS.match.render(stage, set.map(q => q.it), ctx({ note: "Pair each name with its color" }));
        if (sess.ended || !stage.isConnected) return;
        (res.per || []).forEach(p => { const q = lvOf.get(p.item.key); try { prRecord(sess, p.item, { ok: p.ok, answer: p.answer, ms: res.ms / set.length }, "match"); } catch (err) { console.error(err); } answer(q, p.ok); });
        try { keep(); } catch (err) { console.error("Study keep failed", err); }
        bump(res.ok); status(); coachDone();
        continue;
      }
      const q = a.q, kind = a.kind;
      stage._lsIt = q.it;   // test hook
      const wrong = kind === "echo" ? farOpts(q.it, 1) : kind === "spot" ? spotOpts(q.it, a.opts) : kind === "recall" ? recallOpts(q.it, a.opts) : kind === "edge" ? null
        : a.far ? farOpts(q.it, kind === "quiz-color" ? 3 : a.opts) : groupOpts(q.it, kind);
      // a step that throws, or bookkeeping that throws, must never leave the screen frozen on Next: log it, move on
      let res;
      try { res = await PR_STEPS[kind].render(stage, q.it, ctx({ dir: kind === "quiz-color" ? "r" : "f", wrong, other: a.other })); }
      catch (err) { console.error("Study step failed", kind, err); res = await PR_STEPS["quiz-name"].render(stage, q.it, ctx({})); }
      if (sess.ended || !stage.isConnected) return;
      try { prRecord(sess, q.it, res, kind); } catch (err) { console.error("Study record failed", err); }
      coachDone();
      if (!res.ok && res.answer && res.answer.h && res.answer.h !== q.it.h) { try { q.pick = prItemOf(res.answer.h); } catch (err) {} }   // a re-Look compares it with what you picked
      answer(q, !!res.ok);
      try { keep(); } catch (err) { console.error("Study keep failed", err); }
      bump(!!res.ok); status();
    }
    if (sess.ended) return;
    // the boss: a lightning Matching round of everything climbed (not for a quick session, or one set mostly aside)
    let bossMs = null;
    const won = items.filter(it => lsUp(lvOf.get(it.key)));
    if (won.length >= 3 && !o.quick) {
      boss = true; status(); coachDone();
      const set = prShuffle(won).slice(0, 6);
      stage.innerHTML = `<div class="ls-boss"><div class="ls-fan">${set.map((it, k) => `<i style="--c:${it.h};--k:${k}"></i>`).join("")}</div><span class="pr-note">${won.length === n ? "Every color climbed" : `${won.length} colors climbed`}</span><b class="pr-t1">Final round</b><p class="pr-notep">Lightning match: pair all ${set.length} as fast as you can.</p><div class="ls-boss-go"></div></div>`;
      buzz([10, 40, 10, 40, 20]); lsSfx("sfxChord", set.map(it => it.h));
      await new Promise(r => { prNextBtn(stage.querySelector(".ls-boss-go"), r, "Go").setAttribute("data-boss", ""); setKey(e => { if (e.key === "Enter") r(); }); });
      if (sess.ended) return;
      const clock = el.querySelector("[data-status]"); let pen = 0; const t0 = performance.now();
      const tick = setInterval(() => { if (!clock.isConnected) return clearInterval(tick); clock.innerHTML = `<span class="pr-code">${((performance.now() - t0) / 1000 + pen).toFixed(1)} s</span>${pen ? ` · <span class="pr-code">+${pen}</span>` : ""}`; }, 100);
      cleanup.push(() => clearInterval(tick));
      const res = await PR_STEPS.match.render(stage, set, ctx({ onMiss: () => { pen++; buzz([10, 40, 10]); } }));
      clearInterval(tick);
      if (sess.ended) return;
      bossMs = performance.now() - t0 + pen * 1000;
      lsSfx("sfx", "levelup", set.map(it => it.h));
    }
    lsResults(sess, { items, o, bestCombo, climbed, lvOf, bossMs, aside });
  })();
  return el;
}

// ======================================================================
// Results
// ======================================================================
// the short ending of Learn it: "4 climbed · back tomorrow", the colors fly to the map, then back to the page
function lsQuickEnd(o, climbedList) {
  const n = climbedList.length, exit = o.back || lsExitTo("");
  const el = show(`<div class="ls-qend"><div class="ls-qfan">${climbedList.map((it, k) => `<i style="--c:${it.h};--k:${k}"></i>`).join("")}</div>
    <h1 class="pr-t1 pr-res-t"><em>${n}</em> climbed</h1><p class="pr-notep">Back tomorrow, after a night's sleep. Name ${n === 1 ? "it" : "them"} then and ${n === 1 ? "it's" : "they're"} yours.</p>
    <button class="pr-text" data-skip>Skip</button></div>`, "pr-res pr-booth ls-res ls-qres");
  buzz([10, 30, 10, 30, 24]); lsSfx("sfxChord", climbedList.map(it => it.h));
  let done = false;
  const fin = () => { if (done) return; done = true; exit(); };
  const fly = () => { if (done || !el.isConnected) return; if (typeof flyToMap === "function") { try { flyToMap(climbedList.map(it => ({ n: it.n, h: it.h })), [...el.querySelectorAll(".ls-qfan i")]); } catch (e) { console.error("flyToMap failed", e); } setTimeout(fin, 2600); } else fin(); };
  el.querySelector("[data-skip]").onclick = fin;
  setTimeout(fly, reduceMotion ? 600 : 1500);
  onKey = e => { if (e.key === "Escape" || e.key === "Enter") fin(); };
  return el;
}
function lsResults(sess, r) {
  sess.ended = true;
  const { items, o } = r, firsts = [...sess.first.values()], right = firsts.filter(f => f.ok).length, total = firsts.length;
  const pct = total ? Math.round(right * 100 / total) : 0, ms = performance.now() - sess.t0, ls = lsState(), key = lsSetKey(items);
  let best = null, newBest = false;
  if (r.bossMs != null) { const old = ls.best[key]; newBest = !old || r.bossMs < old.v; if (newBest) ls.best[key] = { v: r.bossMs, at: today() }; best = old ? old.v : null; save(); }
  const climbedList = [...r.lvOf.values()].filter(lsUp).map(q => q.it);
  // everything answered is in spaced review now (lsKeep); the ring on each climbed color fills only when it's yours,
  // which takes a check a day or more later (isMine, js/pickit.js), never this session
  lsKeep(sess, items, o, r.lvOf);
  if (o.quick && !r.stopped && climbedList.length) return lsQuickEnd(o, climbedList);
  const t = today(), cardOf = it => it.c && it.c.id ? S.cards[it.c.id] : null;
  const isYours = it => lsKnow(it) === "yours";
  const back = firsts.map(f => f.it).filter(it => { const c = cardOf(it); return c && c.due === addDays(t, 1) && !isYours(it); });
  const betIds = back.map(it => it.c.id);
  // the mix-ups: every wrong pick in this session, as pairs (one row per pair)
  const seen = new Set(), mix = [];
  sess.log.forEach(l => { const a = l.answer; if (l.ok || !a || !a.h || !l.it) return; const other = prItemOf(a.h) || { n: a.n, h: a.h, key: a.n }; const k = [l.it.key, other.key].sort().join("|"); if (seen.has(k) || other.h === l.it.h) return; seen.add(k); mix.push({ a: l.it, b: other }); });
  const all = climbedList.length === items.length && !r.stopped;
  const title = all ? (items.length === 1 ? `<em>Climbed</em>` : `All ${items.length} <em>climbed</em>`) : `${climbedList.length} of ${items.length} <em>climbed</em>`;
  const mono = v => `<span class="pr-code">${v}</span>`;
  const tiles = [[pct + "%", "first try"], [r.bestCombo, "best streak"], [prTime(ms), "time"], ...(r.bossMs != null ? [[prTime(r.bossMs), newBest && best != null ? "a new best" : best != null ? `final round · best ${prTime(best)}` : "final round"]] : [])];
  const shareText = `ColorHub · ${o.label || "A color set"} · ${String(title).replace(/<[^>]+>/g, "")} · ${pct}% first try · best streak ${r.bestCombo}${r.bossMs != null ? ` · final round ${prTime(r.bossMs)}` : ""}`;
  const el = show(`<header class="pr-top"><button class="pr-x" data-close aria-label="Close">${prX()}</button><span class="pr-grow"></span><span class="pr-note">Study</span></header>
    ${prPlate(o.pin && o.pin.length ? o.pin : items, "pr-plate-res" + (all ? " win" : ""))}
    <h1 class="pr-t1 pr-res-t">${title}</h1>
    <p class="pr-notep">${esc(o.label || "")}${o.pin && o.pin.length && items.length > o.pin.length ? ` · with ${items.length - o.pin.length} look-alike${items.length - o.pin.length === 1 ? "" : "s"}` : ""}</p>
    <div class="ls-stats">${tiles.map(([v, t]) => `<div><b>${mono(v)}</b><span>${t}</span></div>`).join("")}</div>
    ${back.length ? `<p class="ls-tmrw">${back.length === 1 ? "It comes" : back.length === items.length ? `All ${back.length} come` : `${back.length} come`} back tomorrow, after a night's sleep. Name ${back.length === 1 ? "it" : "them"} then and ${back.length === 1 ? "it's" : "they're"} yours.</p>` : ""}
    ${climbedList.length ? `<p class="pr-note pr-sec-n">Climbed · each ring fills when you name it tomorrow</p><div class="ls-chips">${climbedList.map(it => { const y = isYours(it); return `<button class="ls-chip" data-h="${it.h}" data-n="${esc(it.n)}"><i style="--c:${it.h}"></i>${esc(prName(it))}<span class="ls-ring${y ? " on" : ""}" role="img" aria-label="${y ? "Yours" : "Fills when you name it tomorrow"}"></span></button>`; }).join("")}</div>` : ""}
    ${typeof lxBetHtml === "function" ? lxBetHtml(betIds) : ""}
    ${mix.length ? `<p class="pr-note pr-sec-n">${mix.length === 1 ? "The pair you mixed up" : `The ${mix.length} pairs you mixed up`}</p><div class="pr-rows">${mix.slice(0, 8).map((m, i) => `<button class="pr-row pr-miss" data-mix="${i}"><span class="pr-pair2"><i style="--c:${m.a.h}"></i><i style="--c:${m.b.h}"></i></span><span class="pr-rowt"><b>${esc(prName(m.a))} and ${esc(prName(m.b))}</b><small>${esc(prDiff(m.a, m.b))}</small></span>${PR_ICON.chev}</button>`).join("")}</div>
      <button class="pr-text ls-sbs" data-a="pairs">See them side by side</button>` : ""}
    <div class="pr-grow"></div>
    <div class="pr-acts">${prPrimary(all ? "Study again" : "Keep going", "", "data-a=again")}
      <span class="pr-textrow"><button class="pr-text" data-a="look">Look again</button><button class="pr-text" data-a="share">Share</button></span></div>`, "pr-res pr-booth ls-res");
  buzz(all ? [10, 30, 10, 30, 24] : 8); lsSfx("sfxChord", items.map(it => it.h));
  if (newBest && best != null) setTimeout(() => { if (el.isConnected) lsSfx("sfx", "best", items.map(it => it.h)); }, 1100);
  const exit = o.back || lsExitTo("");
  if (typeof lxBetWire === "function") lxBetWire(el, betIds);
  // "Keep going" picks each color up at its level; "Study again" (everything climbed) starts the climb over
  const again = () => all ? lsStudy(items, o) : lsStudy(items, o, new Map([...r.lvOf].map(([k, q]) => [k, q.lv])));
  el.querySelector("[data-close]").onclick = () => exit();
  el.querySelectorAll("[data-h]").forEach(b => b.onclick = () => lsOpenPage({ h: b.dataset.h, n: b.dataset.n }));
  el.querySelectorAll("[data-mix]").forEach(b => b.onclick = () => lsOpenPage(mix[+b.dataset.mix].a));
  el.querySelectorAll("[data-a]").forEach(b => b.onclick = () => {
    const a = b.dataset.a;
    if (a === "again") return again();
    if (a === "look") return lsLook(items, o);
    if (a === "pairs") { const inv = [...new Set(mix.flatMap(m => [m.a, m.b]))]; return lsLook(prUnique(inv.filter(x => x.key)).length >= 2 ? prUnique(inv.filter(x => x.key)) : items, { ...o, view: "pairs" }); }
    if (a === "share") { try { if (navigator.share) return void navigator.share({ text: shareText }).catch(() => {}); navigator.clipboard.writeText(shareText); toast("Copied"); } catch (e) {} }
  });
  onKey = e => { if (e.key === "Enter" && !e.target.closest?.("button")) again(); if (e.key === "Escape") exit(); };
  return el;
}

// ======================================================================
// Screenshots: #lsshot=sheet[:close] | look:<view> | study[:wrong|match|grad|boss] | results
// ======================================================================
function lsShot(arg) {
  PR_SHOT_ON = true;
  try { const set = localStorage.setItem.bind(localStorage); localStorage.setItem = (k, v) => { if (k !== KEY) set(k, v); }; } catch (e) {}
  document.documentElement.classList.add("pr-shot");
  const [w, st] = String(arg).split(":"), teal = prByKey("teal"), items = lsAlike(teal, 8, 5), label = "Teal and its look-alikes";
  const ls = lsState(); ls.typing = st === "type";
  if (w === "sheet") { openRoute("#/color/teal"); if (st) ls.close = +st; return setTimeout(() => lsOpen({ seed: teal }), 1200); }
  if (w === "look") return lsLook(items, { label, view: st || "grid" });
  if (w === "study") {
    const el = lsStudy(prShuffle(items), { label, shot: st });
    const stage = el.querySelector(".pr-stage");
    setTimeout(() => {
      if (st === "wrong" && stage._prChoose) { const i = [...stage.querySelectorAll(".pr-opt")].findIndex(b => b.textContent.trim() !== prName(stage._lsIt)); stage._prChoose(i); }
      if (st === "grad") { const nm = prName(stage._lsIt); setTimeout(() => { el._lsFx.bump(true); el._lsFx.graduate(stage._lsIt); }, 200); if (stage._prType && stage.querySelector(".pr-s-type")) stage._prType(nm); else if (stage.querySelector(".pr-s-card")) { stage._prReveal(); setTimeout(() => stage.querySelector("[data-yes]").click(), 100); } }
      if (st === "match" && stage._prMatch) { const { tiles } = stage._prMatch, b = [...stage.querySelectorAll(".pr-tile")], k = tiles.findIndex(t => !t.sw), j = tiles.findIndex(t => t.sw && t.i === tiles[k].i); b[k].click(); b[j].click(); const k2 = tiles.findIndex((t, x) => !t.sw && x !== k); b[k2].click(); }
    }, 700);
    return;
  }
  if (w === "results") {
    const sess = prSession("learn", { dir: "f" }, items, { deckAll: items });
    items.forEach((it, i) => { const nb = items[(i + 1) % items.length], ok = i % 3 !== 1; const r = { ok, answer: ok ? null : { kind: "pick", n: prName(nb), h: nb.h } }; sess.first.set(it.key, { it, ...r, kind: "quiz-name" }); sess.log.push({ it, kind: "quiz-name", ...r }); });
    sess.t0 = performance.now() - 192000;
    const lvOf = new Map(items.map(it => [it.key, { it, lv: 4, up: true }]));
    return lsResults(sess, { items, o: { label }, bestCombo: 9, climbed: items.length, lvOf, bossMs: 8400 });
  }
}
if (typeof location !== "undefined" && /^#lsshot=/.test(location.hash)) {
  const arg = decodeURIComponent(location.hash.slice(8));
  addEventListener("load", () => loadCoreNames().then(() => setTimeout(() => lsShot(arg), 50)));
}
