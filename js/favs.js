"use strict";
// Your colors (lane L23, David 2026-10-08: "a better system to figure out your preferences").
//   1. Pick favorites on the honeycomb (a select mode on Home: tap to heart, hold then drag to sweep a run).
//   2. The shelf (#/favorites): your hearted colors on a honeycomb, ranked, with the verbs (map, learn, rank, palette, share).
//   3. Ranking without tournaments (js/favrank.js): six quick ways, one preference score per color (js/prefmodel.js).
//   4. Your taste profile (js/favprofile.js): plain findings with honest n, the painter nearest your loves, a share card.
//   5. Connections: Explore's For you, Studio, every color page's heart and rank, Learn my favorites.
// State: S.favs = { "#HEX": { n, at } } (the hearts); S.pref = { v, ctx: { all|room|wear|paint|logo: { "#HEX": [mean, var, n] } },
// cmp: { ctx: choices } } (js/prefmodel.js); S.fvHints counts how often the pick-mode hint has shown.
// Hooks for lanes that land later: fvEmit() calls learnerLog(type, data) when js/learner.js exists (events "like" and
// "unlike" on a heart, "rank" after a ranking round); fvShelfStrip() returns a small HTML card for the Cabinet.

const FV_CTX = [["all", "Anything"], ["room", "A room"], ["wear", "To wear"], ["paint", "To paint with"], ["logo", "A logo"]];
const FV_CTX_ASK = { all: "", room: "for a room", wear: "to wear", paint: "to paint with", logo: "for a logo" };
const FV_HEART = icon("heart", 24);
const FV_HEART_ON = icon("heartOn", 24);
let FV_FROM = null;            // where the shelf's Back goes (set by whoever opened it)
let FV_CTX_NOW = "all";        // which context's order the shelf shows
let FV_AUTOPICK = false;       // Home opens straight into pick mode (the shelf's "On the map")

// ---------- the hearts ----------
const fvKey = h => String(h).toUpperCase();
const fvStore = () => (S.favs && typeof S.favs === "object" && !Array.isArray(S.favs) ? S.favs : (S.favs = {}));
const fvHas = h => !!fvStore()[fvKey(h)];
const fvCount = () => Object.keys(fvStore()).length;
const fvName = h => (fvStore()[fvKey(h)] || {}).n || "";
// The Learner Model (js/learner.js) only knows "like" so far: a heart is a like. (unlike and rank stay local until it grows a type for them.)
function fvEmit(type, data) { try { if (type === "like" && data && data.h && typeof learnerLog === "function") learnerLog({ type: "like", color: { n: data.n, h: data.h }, src: "favorites" }); } catch (e) {} }
function fvCommit(adds, removes, why = "pick") {
  const s = fvStore();
  adds.forEach(([k, n]) => { k = fvKey(k); if (!s[k]) { s[k] = { n: n || nameOf(k).n || k, at: today() }; fvEmit("like", { h: k, n: s[k].n, why }); } });
  removes.forEach(k => { k = fvKey(k); if (s[k]) { fvEmit("unlike", { h: k, n: s[k].n, why }); delete s[k]; } });
  save();
}
const fvSet = (h, n, on, why) => on ? fvCommit([[h, n]], [], why) : fvCommit([], [h], why);

// ---------- the preference store (js/prefmodel.js) ----------
function fvPref() {
  const p = S.pref && typeof S.pref === "object" && !Array.isArray(S.pref) ? S.pref : (S.pref = {});
  if (!p.ctx || typeof p.ctx !== "object") p.ctx = {};
  if (!p.cmp || typeof p.cmp !== "object") p.cmp = {};
  p.v = 1; return p;
}
function fvCtxStore(ctx = "all") {
  const p = fvPref();
  if (!p.ctx[ctx]) p.ctx[ctx] = ctx === "all" ? {} : PREFM.fork(p.ctx.all || {}, Object.keys(fvStore()));
  return p.ctx[ctx];
}
const fvCmp = (ctx, n = 1) => { const p = fvPref(); p.cmp[ctx] = (p.cmp[ctx] || 0) + n; if (n > 0) p.last = today(); };
const fvChoices = ctx => (fvPref().cmp[ctx || "all"] || 0);
// contexts you have actually ranked for
const fvCtxUsed = () => FV_CTX.map(c => c[0]).filter(c => c !== "all" && fvChoices(c) > 0);
const fvRankedAny = ctx => fvChoices(ctx || "all") > 0;
// the hearted colors, best first. Before any ranking: newest first. A context you haven't ranked falls back to "Anything".
function fvOrder(ctx = "all") {
  const keys = Object.keys(fvStore());
  if (!keys.length) return keys;
  const use = ctx !== "all" && fvChoices(ctx) > 0 ? ctx : "all";
  if (!fvChoices(use)) return keys.reverse();
  return PREFM.order(fvCtxStore(use), keys);
}
const fvRank = (h, ctx) => { const i = fvOrder(ctx).indexOf(fvKey(h)); return i < 0 ? 0 : i + 1; };
const fvConf = ctx => { const keys = Object.keys(fvStore()); return keys.length < 2 ? 0 : fvChoices(ctx) ? PREFM.confidence(fvCtxStore(ctx || "all"), keys) : 0; };
const fvItems = ctx => fvOrder(ctx).map(k => ({ h: k, n: fvStore()[k].n }));

// How close a color is to what you love, 0 to 1 (the top of your order counts most). Explore's For you uses it.
function fvTasteScore(h) {
  const o = fvOrder("all").slice(0, 24), n = o.length;
  if (n < 3) return 0;
  let best = 0;
  o.forEach((k, i) => { const w = 1 - .55 * i / Math.max(1, n - 1); best = Math.max(best, w * Math.exp(-de2000(h, k) / 16)); });
  return best;
}
// For you: the day's shuffled colors, nudged so colors near your loves surface a little earlier. A nudge, not a filter.
function fvForYou(nodes) {
  if (fvCount() < 3 || !nodes || !nodes.length) return nodes;
  const N = nodes.length;
  return nodes.map((n, i) => ({ n, k: i / N - .55 * (n.c && n.c.h ? fvTasteScore(n.c.h) : 0) })).sort((a, b) => a.k - b.k).map(x => x.n);
}

// ======================================================================
// 1. Pick favorites (Home's select mode)
// ======================================================================
function fvHomeReady(el, ctrl) { if (FV_AUTOPICK && ctrl) { FV_AUTOPICK = false; fvPickStart(el, ctrl); } }
function fvPickStart(el, ctrl) {
  if (!ctrl || el.classList.contains("fv-picking")) return;
  const base = new Set(Object.keys(fvStore())), pick = new Set(base), names = new Map();
  el.classList.add("fv-picking");
  const bar = document.createElement("div"); bar.className = "fv-bar"; el.appendChild(bar);
  const first = (S.fvHints || 0) < 3;
  let hint = null;
  if (first) {
    S.fvHints = (S.fvHints || 0) + 1; save();
    hint = document.createElement("div"); hint.className = "fv-hint";
    hint.innerHTML = `<span>Tap to heart.</span> <em>Hold, then drag, to sweep a run.</em>`;
    el.appendChild(hint);
    later(() => hint && hint.classList.add("gone"), 6500);
  }
  const hideHint = () => { if (hint) { hint.classList.add("gone"); hint = null; } };
  const diff = () => { let add = 0, rem = 0; pick.forEach(k => { if (!base.has(k)) add++; }); base.forEach(k => { if (!pick.has(k)) rem++; }); return { add, rem }; };
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  function draw(state) {
    const n = pick.size, d = diff(), dirty = d.add + d.rem > 0;
    if (state === "pick") {
      bar.dataset.mode = "pick";
      bar.innerHTML = `<button class="fv-x" data-x aria-label="Cancel">${ICON.x}</button>
        <div class="fv-count" aria-live="polite">${FV_HEART_ON}<b>${n}</b><span>picked</span></div>
        <button class="fv-save" data-save>${dirty ? "Save" : "Done"}</button>`;
    } else if (state === "ask") {
      bar.dataset.mode = "ask";
      bar.innerHTML = `<p class="fv-ask">Throw away ${d.add ? plural(d.add, "new pick") : plural(d.rem, "change")}?</p>
        <button class="fv-x fv-keep" data-keep>Keep picking</button><button class="fv-save fv-drop" data-drop>Throw away</button>`;
    } else {
      bar.dataset.mode = "saved";
      bar.innerHTML = `<button class="fv-x" data-end aria-label="Close">${ICON.x}</button>
        <div class="fv-count">${FV_HEART_ON}<b>${n}</b><span>hearted</span></div>
        <button class="fv-save" data-shelf>Your colors ${ICON.arrow}</button>`;
    }
  }
  const bump = () => {
    const b = bar.querySelector(".fv-count b"), d = diff(), s = bar.querySelector("[data-save]");
    if (b) { b.textContent = pick.size; b.classList.remove("bump"); void b.offsetWidth; b.classList.add("bump"); }
    if (s) s.textContent = d.add + d.rem ? "Save" : "Done";
  };
  const end = () => { ctrl.selectMode(false); bar.remove(); hideHint(); el.classList.remove("fv-picking"); };
  ctrl.selectMode(true, {
    isOn: it => pick.has(fvKey(it.h)),
    onToggle: (it, on) => { const k = fvKey(it.h); names.set(k, it.n); on ? pick.add(k) : pick.delete(k); hideHint(); bump(); },
  });
  bar.addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.x != null) { buzz(4); return diff().add + diff().rem ? draw("ask") : end(); }
    if (b.dataset.keep != null) return draw("pick");
    if (b.dataset.drop != null) return end();
    if (b.dataset.end != null) return end();
    if (b.dataset.shelf != null) { end(); return favShelf(() => hmHome()); }
    if (b.dataset.save != null) {
      const d = diff();
      if (!d.add && !d.rem) return end();
      fvCommit([...pick].filter(k => !base.has(k)).map(k => [k, names.get(k)]), [...base].filter(k => !pick.has(k)), "pick");
      buzz([10, 30, 20]); ctrl.selectMode(false); hideHint(); draw("saved");
      base.clear(); pick.forEach(k => base.add(k));
    }
  });
  draw("pick");
}

// ======================================================================
// 2. The shelf
// ======================================================================
const FV_METHODS = [
  { id: "bws", title: "Best of three", note: "Keep one, drop one, from a set of three.", time: "1 min", min: 3 },
  { id: "tiers", title: "Tier board", note: "Sort them into Love, Like and Fine.", time: "1 min", min: 3 },
  { id: "swipe", title: "Swipe stack", note: "Like or skip, one at a time.", time: "1 min", min: 3 },
  { id: "budget", title: "Ten drops", note: "Spend ten drops of paint on your favorites.", time: "1 min", min: 3 },
  { id: "order", title: "Drag to order", note: "Put a handful in order, best on top.", time: "1 min", min: 3 },
  { id: "context", title: "What it's for", note: "A room, to wear, to paint with, a logo.", time: "2 min", min: 3 },
];
// the one worth doing next
function fvRecommend() {
  const n = fvCount(), c = fvChoices("all");
  if (n > 14 && c === 0) return "tiers";
  if (n <= 5 && c === 0) return "order";
  return "bws";
}
const fvMethod = id => FV_METHODS.find(m => m.id === id) || FV_METHODS[0];
const fvSwatchRow = (k, cls = "") => `<i class="${cls}" style="--c:${k}"></i>`;

function fvArt(id, cols) {
  const c = i => cols[i % cols.length];
  switch (id) {
    case "bws": return `<span class="fv-art fv-art-bws">${[0, 1, 2].map(i => `<i style="--c:${c(i)}"${i === 1 ? ' class="pick"' : ""}></i>`).join("")}</span>`;
    case "tiers": return `<span class="fv-art fv-art-tiers">${[0, 1, 2].map(i => `<b><i style="--c:${c(i)}"></i><i style="--c:${c(i + 3)}"></i></b>`).join("")}</span>`;
    case "swipe": return `<span class="fv-art fv-art-swipe"><i style="--c:${c(2)}"></i><i style="--c:${c(0)}"></i></span>`;
    case "budget": return `<span class="fv-art fv-art-budget">${[0, 1, 2, 3, 4].map(i => `<i style="--c:${c(i)};--k:${i}"></i>`).join("")}</span>`;
    case "order": return `<span class="fv-art fv-art-order">${[0, 1, 2, 3].map(i => `<i style="--c:${c(i)};--w:${100 - i * 18}%"></i>`).join("")}</span>`;
    default: return `<span class="fv-art fv-art-ctx">${[0, 1, 2, 3].map(i => `<i style="--c:${c(i)}"></i>`).join("")}</span>`;
  }
}
function fvToast(msg, undo) {
  document.querySelectorAll(".toast").forEach(n => n.remove());
  const t = document.createElement("div"); t.className = "toast fv-toast";
  t.innerHTML = `<span>${esc(msg)}</span>${undo ? `<button>Undo</button>` : ""}`;
  document.body.appendChild(t);
  const gone = setTimeout(() => t.remove(), 4200);
  if (undo) t.querySelector("button").onclick = () => { clearTimeout(gone); t.remove(); undo(); };
}

function favShelf(from) {
  if (typeof from === "function") FV_FROM = from;
  XSTACK = ["favs"];
  const n = fvCount(), ctx = FV_CTX_NOW, used = fvCtxUsed();
  if (ctx !== "all" && !used.includes(ctx)) FV_CTX_NOW = "all";
  const back = () => { const f = FV_FROM; FV_FROM = null; (f || (() => go("studio")))(); };
  if (!n) return fvEmptyShelf(back);

  const order = fvOrder(FV_CTX_NOW), conf = fvConf(FV_CTX_NOW), ranked = fvRankedAny(FV_CTX_NOW) || (FV_CTX_NOW !== "all" && fvRankedAny("all"));
  const top = order.slice(0, 5), rest = order.slice(5), cols = top.length ? top : ["#C8553D", "#E0A458", "#3F7C8C"];
  const rec = fvMethod(fvRecommend()), can = n >= 3;
  const ago = fvPref().last ? daysSince(fvPref().last) : 0, fresh = order.filter(k => !(fvCtxStore("all")[k] && fvCtxStore("all")[k][2])).length;
  const sub = !can ? `${n} hearted · heart ${3 - n} more to rank them`
    : !ranked ? `${n} hearted · not ranked yet`
    : `${n} hearted · order ${PREFM.confLabel(conf).toLowerCase()}${fresh && fresh < n ? `, ${fresh} new` : ""}${ago >= 7 ? `. Last ranked ${ago} days ago, and taste drifts.` : ""}`;
  const fam = h => (typeof setFamily === "function" ? setFamily(h) : "");
  const plate = (k, i) => `<button class="fv-plate" data-swatch="${k}" data-ink="${ink(k)}" style="--c:${k}"><em>${i + 1}</em><b>${esc(fvStore()[k].n)}</b></button>`;
  const row = (k, i) => `<div class="fv-row"><button class="fv-row-main" data-swatch="${k}"><span class="fv-rk mono">${i + 6}</span><i class="fv-sw" style="--c:${k}"></i>
      <span class="fv-nm"><b>${esc(fvStore()[k].n)}</b><small>${esc(fam(k))}</small></span></button>
      <button class="fv-un" data-un="${k}" aria-label="Remove ${esc(fvStore()[k].n)} from your colors">${FV_HEART_ON}</button></div>`;
  const SHOW = 8, hasCS = typeof csActions === "function" && typeof colorSet === "function";
  const el = show(`
    <header class="art-top"><button class="icon-btn glass" data-back aria-label="Back">${ICON.back}</button>${hasCS ? `<button class="glass-pill" data-share>${ICON.share}<span>My colors card</span></button>` : `<span style="width:44px"></span>`}</header>
    <h1 class="title-1 fv-title">Your <em>colors</em></h1>
    <p class="note fv-sub">${esc(sub)}</p>
    <div class="fv-hero" id="fvHero"></div>
    ${hasCS ? `<div id="fvVerbs"></div>` : `<nav class="fv-verbs" aria-label="What to do with your colors">
      <button data-v="map"><span>${ICON.compass}</span>Map</button><button data-v="learn"><span>${ICON.learn}</span>Learn</button><button data-v="rank"><span>${ICON.bolt}</span>Rank</button>
      <button data-v="palette"><span>${ICON.palette}</span>Palette</button><button data-v="share"><span>${ICON.share}</span>Share</button>
    </nav>`}
    ${can ? `<button class="btn fv-go" data-go="${rec.id}">${ranked ? "Keep ranking" : "Rank them"} <small>${esc(rec.title)}</small>${ICON.arrow}</button>`
      : `<button class="btn fv-go" data-pick>Heart a few more ${ICON.arrow}</button>`}
    ${used.length ? `<div class="fv-ctxs" role="tablist">${FV_CTX.filter(c => c[0] === "all" || used.includes(c[0])).map(c => `<button class="${c[0] === FV_CTX_NOW ? "on" : ""}" data-ctx="${c[0]}">${c[1]}</button>`).join("")}</div>` : ""}
    <div class="fv-top5" style="--n:${Math.max(1, top.length - 1)}" aria-label="Your top ${top.length}">${top.map(plate).join("")}</div>
    ${rest.length ? `<div class="sec-head"><b>The rest</b><span>${rest.length}</span></div>
      <div class="fv-rows">${rest.slice(0, SHOW).map(row).join("")}</div>
      ${rest.length > SHOW ? `<button class="btn ghost fv-more" data-more>Show all ${rest.length}</button>` : ""}` : ""}
    ${can ? `<div class="sec-head"><b>Ways to rank</b><span>each one sharpens the order</span></div>
      <div class="fv-ways">${FV_METHODS.map(m => `<button class="fv-way${m.id === rec.id ? " rec" : ""}" data-go="${m.id}">${fvArt(m.id, cols)}<b>${m.title}</b><small>${m.note}</small></button>`).join("")}</div>` : ""}
    ${n >= 3 && typeof fpHeadline === "function" ? `<div class="sec-head"><b>Your taste</b><span>from ${n} colors</span></div>
      <button class="qrow fv-taste" data-taste><span id="fvLine">${esc(fpHeadline())}</span>${ICON.chev}</button>` : ""}
    <p class="fine fv-fine">Everything here stays on this device.</p>
  `, "fv fv-shelf");
  el.querySelector("[data-back]").onclick = back;
  onKey = e => { if (e.key === "Escape") back(); };
  const pickBtn = el.querySelector("[data-pick]"); if (pickBtn) pickBtn.onclick = () => fvPickOnHome(false);
  // the honeycomb of your colors; a tap opens the color's page, Back lands here again
  const host = el.querySelector("#fvHero");
  const ctrl = honeycomb(host, { items: order.map(k => ({ n: fvStore()[k].n, h: k })), style: "original", zoom: 1, centerFirst: false,
    pick: o => openTappedColor(o.h) });
  const items = () => order;
  el.querySelectorAll("[data-v]").forEach(b => b.onclick = () => fvVerb(b.dataset.v, items()));
  // the shared verbs (js/colorset.js: on the map, learn, play, keep), live over whichever order is showing
  const vh = el.querySelector("#fvVerbs");
  if (vh) {
    const row = csActions(() => colorSet({ kind: "favorites", id: "mine", title: "My colors", colors: fvOrder(FV_CTX_NOW).slice(0, 24).map(k => ({ h: k, n: fvStore()[k].n })), src: "favorites" }),
      { only: ["map", "learn", "play", "keep"], back: () => favShelf() });
    // until the Practice lane's instant deck exists, "Learn" runs the favorites that are lesson colors as a swipe deck
    row.addEventListener("click", e => { if (e.target.closest('[data-cs="learn"]') && typeof prInstantDeck !== "function") { e.stopPropagation(); buzz(5); fvLearn(items()); } }, true);
    vh.replaceWith(row);
    const sh = el.querySelector("[data-share]"); if (sh) sh.onclick = () => fvShare();
  }
  el.querySelectorAll("[data-go]").forEach(b => b.onclick = () => { buzz(6); frStart(b.dataset.go, FV_CTX_NOW === "all" ? "all" : FV_CTX_NOW); });
  el.querySelectorAll("[data-ctx]").forEach(b => b.onclick = () => { FV_CTX_NOW = b.dataset.ctx; buzz(4); favShelf(); });
  function wireUn() {
    el.querySelectorAll("[data-un]").forEach(b => b.onclick = () => {
      const k = b.dataset.un, nm = fvStore()[k] && fvStore()[k].n, at = fvStore()[k] && fvStore()[k].at;
      fvCommit([], [k], "shelf"); b.closest(".fv-row").classList.add("gone"); buzz(4);
      // the row slides away, the shelf redraws with the new order, and then the toast offers Undo (a redraw clears toasts)
      later(() => { favShelf(); fvToast(`Removed ${nm}`, () => { fvStore()[k] = { n: nm, at }; save(); fvEmit("like", { h: k, n: nm, why: "undo" }); favShelf(); }); }, reduceMotion ? 20 : 280);
    });
  }
  wireUn();
  const more = el.querySelector("[data-more]");
  if (more) more.onclick = () => { el.querySelector(".fv-rows").innerHTML = rest.map((k, i) => row(k, i)).join(""); more.remove(); wireUn(); };
  const t = el.querySelector("[data-taste]"); if (t) t.onclick = () => favTaste();
  return el;
}
function fvEmptyShelf(back) {
  const el = show(`
    <header class="art-top"><button class="icon-btn glass" data-back aria-label="Back">${ICON.back}</button><span style="width:44px"></span></header>
    <div class="fv-empty">
      <div class="fv-bubbles" aria-hidden="true"><i style="--c:#C8553D"></i><i style="--c:#E0A458"></i><i style="--c:#3F7C8C"></i></div>
      <h1 class="title-1">Nothing hearted <em>yet</em></h1>
      <p class="lead">Heart the colors you love. ColorHub ranks them, learns your taste, and finds the painter whose palette is closest to yours.</p>
      <button class="btn" data-pick>Pick favorites ${ICON.arrow}</button>
      <button class="btn ghost" data-test>Or take the 20-tap taste test</button>
    </div>`, "fv fv-shelf");
  el.querySelector("[data-back]").onclick = back;
  onKey = e => { if (e.key === "Escape") back(); };
  el.querySelector("[data-pick]").onclick = () => fvPickOnHome(false);
  el.querySelector("[data-test]").onclick = () => tasteIntro("color");
  return el;
}
// Home, in pick mode. all = the whole map, so your hearts show among every name.
function fvPickOnHome(all) {
  FV_AUTOPICK = true;
  if (all) { S.hm = S.hm || {}; S.hm.src = "every-name"; S.hm.filter = "all"; S.hm.fam = ""; S.hm.tone = ""; save(); }
  hmHome();
}

// ---------- the verbs ----------
function fvVerb(v, keys) {
  buzz(6);
  if (v === "map") return fvPickOnHome(true);
  if (v === "rank") return frStart(fvRecommend(), "all");
  if (v === "share") return fvShare();
  if (v === "palette") return fvMakePalette(keys);
  if (v === "learn") return fvLearn(keys);
}
// A deck of the favorites that are taught colors (the rest open as pages). Joins spaced review at the end, like Learn it.
function fvLearn(keys) {
  const taught = keys.map(k => BYNAME.get(fvStore()[k].n.toLowerCase())).filter(c => c && c.id && !c.basic);
  const fresh = taught.filter(c => !isMine(S.cards[c.id])).slice(0, 12), list = fresh.length ? fresh : taught.slice(0, 12);
  if (!list.length) { toast("None of these are lesson colors yet. Tap one to read about it."); return; }
  deck("learn", { unit: { colors: list }, cls: "learnit lt-recall", onClose: () => favShelf(),
    onFinish: () => { learnUnit({ id: "favs-" + today(), colors: list }); fvEmit("learn", { why: "favorites", n: list.length }); toast(`${list.length} added to your reviews`); favShelf(); } });
}
// A palette from your top five, saved in Studio (the order is your order)
function fvMakePalette(keys, open = true) {
  const cols = keys.slice(0, 5);
  if (cols.length < 3) return toast("Heart at least 3 colors for a palette");
  const s = (S.palettes = S.palettes || []);
  let p = s.find(x => x.from === "Your colors" && x.cols.join() === cols.join());
  if (!p) { p = { id: plMakeId(), cols, from: "Your colors", name: "My top five", at: today() }; s.unshift(p); S.palettes = s.slice(0, 60); save(); }
  if (open) { XSTACK = ["favs"]; openSavedPalette(p.id); }
  return p;
}

// ---------- the card: "My colors" ----------
function fvShare() {
  const order = fvOrder("all"), top = order.slice(0, 5);
  if (top.length < 3) return toast("Heart at least 3 colors to share");
  const line = typeof fpCardLine === "function" ? fpCardLine() : `${fvCount()} colors I love`;
  tzShareCanvas(x => {
    const W = 1080, pad = 72, SER = "'Instrument Serif', Georgia, serif", inkOn = h => ink(h) === "dark" ? "#141311" : "#FFFFFF";
    x.fillStyle = "#ECE8DF"; x.font = `400 96px ${SER}`; x.textAlign = "left"; x.textBaseline = "alphabetic"; x.fillText("My ", pad, 168);
    const w0 = x.measureText("My ").width; x.font = `italic 400 96px ${SER}`; x.fillText("colors", pad + w0, 168);
    // the top color, wide; then four in a row
    x.fillStyle = top[0]; x.fillRect(pad, 224, W - 2 * pad, 470);
    x.fillStyle = inkOn(top[0]); x.font = `400 72px ${SER}`; x.fillText(fvStore()[top[0]].n, pad + 36, 224 + 470 - 40);
    const rest = top.slice(1), cw = (W - 2 * pad - 12 * (rest.length - 1)) / rest.length;
    rest.forEach((k, i) => {
      const xx = pad + i * (cw + 12); x.fillStyle = k; x.fillRect(xx, 710, cw, 330);
      x.fillStyle = inkOn(k); x.font = `400 38px ${SER}`;
      const words = fvStore()[k].n.split(" "), lines = []; let cur = "";
      words.forEach(w => { const t = cur ? cur + " " + w : w; if (x.measureText(t).width > cw - 36 && cur) { lines.push(cur); cur = w; } else cur = t; }); if (cur) lines.push(cur);
      lines.slice(0, 3).forEach((l, j) => x.fillText(l, xx + 18, 710 + 330 - 24 - (Math.min(lines.length, 3) - 1 - j) * 42));
    });
    x.fillStyle = "#CFC9BC"; x.font = `italic 400 44px ${SER}`;
    tzWrap(x, line, W - 2 * pad).slice(0, 2).forEach((l, i) => x.fillText(l, pad, 1118 + i * 56));
    x.fillStyle = "#837E73"; x.font = `400 36px ${SER}`; x.fillText("ColorHub", pad, 1270);
  }, "colorhub-my-colors.png", "My colors", routeURL("favorites"));
}

// ======================================================================
// 3. Color pages: the heart and your rank
// ======================================================================
// { on, rank, total } for a color page. A heart from a page lands in the same store the honeycomb fills.
const fvPageState = h => { const on = fvHas(h), total = fvCount(); return { on, rank: on && total >= 3 && fvRankedAny("all") ? fvRank(h, "all") : 0, total }; };
const fvPageChip = h => { const t = fvPageNote(h); return `<span class="cp-chip cp-fv" data-fv-chip${t ? "" : " hidden"}>${esc(t)}</span>`; };
function fvPageSync(el, h) { const c = el.querySelector("[data-fv-chip]"); if (c) { const t = fvPageNote(h); c.textContent = t; c.hidden = !t; } }
function fvPageSet(el, h, n, on) { fvSet(h, n, on, "page"); buzz(on ? 8 : 4); fvPageSync(el, h); }
// the heart on a library color's page (js/names.js): beside "Learn it" when there is one, else the page's one primary
function fvHeartRow(h, n, primary) {
  const on = fvHas(h);
  const icon = `<button class="icon-btn cp-icon fv-heart-btn${on ? " saved" : ""}" data-fvh aria-label="${on ? "Remove from your colors" : "Add to your colors"}" aria-pressed="${on}">${on ? ICON.heartOn : ICON.heart}</button>`;
  return `<div class="cp-primary-row">${primary ? primary + icon : `<button class="cp-primary fv-add${on ? " on" : ""}" data-fvh aria-pressed="${on}">${on ? FV_HEART_ON : FV_HEART}<span>${on ? "In your colors" : "Add to your colors"}</span></button>`}</div>`;
}
function fvWireHeart(el, h, n) {
  el.querySelectorAll("[data-fvh]").forEach(b => b.onclick = () => {
    const on = !fvHas(h); fvPageSet(el, h, n, on);
    el.querySelectorAll("[data-fvh]").forEach(x => {
      x.setAttribute("aria-pressed", on);
      if (x.classList.contains("fv-add")) { x.classList.toggle("on", on); x.innerHTML = `${on ? FV_HEART_ON : FV_HEART}<span>${on ? "In your colors" : "Add to your colors"}</span>`; }
      else { x.innerHTML = on ? ICON.heartOn : ICON.heart; x.classList.toggle("saved", on); }
    });
  });
}
// "Your #3 of 47" for the page's chip, or ""
function fvPageNote(h) { const s = fvPageState(h); return s.on ? (s.rank ? `Your #${s.rank} of ${s.total}` : "In your colors") : ""; }
// Studio's quiet row under the taste tests: your top colors as a strip, and the way in
function fvStudioRow() {
  const n = fvCount(), top = fvOrder("all").slice(0, 6);
  return `<button class="qrow fv-st-row" data-fv-row>${n ? `<span class="fv-st-strip">${top.map(k => `<i style="--c:${k}"></i>`).join("")}</span>` : `<span class="fv-st-heart">${FV_HEART}</span>`}
    <span class="fv-st-t"><b>Your colors</b><small>${n ? `${n} hearted${fvRankedAny("all") ? ", ranked" : ""}` : "Heart the colors you love, then rank them."}</small></span>${ICON.chev}</button>`;
}
// a small card for the Cabinet's favorites shelf (js/cabinet.js, when it lands): a strip of your top colors and the way in
function fvShelfStrip() {
  const top = fvOrder("all").slice(0, 8);
  if (!top.length) return "";
  return `<button class="fv-strip" data-fv-shelf><span class="fv-strip-c">${top.map(k => `<i style="--c:${k}"></i>`).join("")}</span><b>Your colors</b><small>${fvCount()} hearted</small></button>`;
}
document.addEventListener("click", e => { const b = e.target.closest && e.target.closest("[data-fv-shelf]"); if (b) favShelf(); });

// ======================================================================
// screenshot mode: boot.js  #shot=favs:<screen>  (a simulated person, in memory only)
// ======================================================================
function fvDemo(n = 28, rank = true) {
  let seed = 11; const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  // a person who loves muted, cool, deep colors, with a taste for one warm rust
  const all = EVERY().filter(c => !c.basic), score = c => { const [L, C, H] = lch(c.h); return -Math.abs(C - 26) / 30 - Math.abs(L - 42) / 40 + (H > 170 && H < 290 ? 1 : 0) + (c.n === "Rust" ? 1.4 : 0) + rand() * .6; };
  const pick = all.slice().sort((a, b) => score(b) - score(a)).slice(0, n);
  S.favs = {}; S.pref = { v: 1, ctx: {}, cmp: {} };
  pick.forEach(c => { S.favs[fvKey(c.h)] = { n: c.n, at: today() }; });
  if (rank) {
    const keys = Object.keys(S.favs), st = fvCtxStore("all"), u = {}; keys.forEach((k, i) => u[k] = (keys.length - i) * .22 + (rand() - .5) * .9);
    const skip = new Set();
    for (let t = 0; t < keys.length * 4; t++) { const [a, b] = PREFM.nextPair(st, keys, { skip }); const w = rand() < PREFM.sig(u[a] - u[b]) ? a : b; PREFM.compare(st, w, w === a ? b : a); skip.add(PREFM.pairId(a, b)); if (skip.size > 8) skip.delete(skip.values().next().value); }
    fvCmp("all", keys.length * 2);
    // one context, so the shelf can show them
    const rs = fvCtxStore("room"), r2 = {}; keys.forEach((k, i) => r2[k] = u[k] + (lch(k)[0] > 55 ? 1.2 : -.6) + (rand() - .5) * .6);
    for (let t = 0; t < keys.length * 3; t++) { const [a, b] = PREFM.nextPair(rs, keys, {}); const w = rand() < PREFM.sig(r2[a] - r2[b]) ? a : b; PREFM.compare(rs, w, w === a ? b : a); }
    fvCmp("room", keys.length * 2);
  }
}
function favShot(arg = "shelf") {
  const [what, sub] = arg.split(":");
  if (what === "empty") { S.favs = {}; return favShelf(); }
  if (what === "pick") {
    fvDemo(9, false); FV_AUTOPICK = true; S.hm = { src: "stage:100", filter: "all", zoom: .8 }; S.fvHints = 0;
    hmHome();
    // tap a few bubbles the way a thumb does
    later(() => {
      const cv = document.querySelector(".hm canvas"); if (!cv) return;
      const r = cv.getBoundingClientRect(), fire = (t, x, y) => cv.dispatchEvent(new PointerEvent(t, { pointerId: 7, bubbles: true, clientX: r.left + x, clientY: r.top + y, pointerType: "touch", isPrimary: true }));
      [[r.width * .5, r.height * .5], [r.width * .27, r.height * .5], [r.width * .73, r.height * .5], [r.width * .5, r.height * .36], [r.width * .5, r.height * .64], [r.width * .3, r.height * .64], [r.width * .7, r.height * .36]]
        .forEach(([x, y], i) => later(() => { fire("pointerdown", x, y); fire("pointerup", x, y); }, 250 + i * 160));
    }, 1200);
    return;
  }
  fvDemo(sub && /^\d+$/.test(sub) ? +sub : 28, what !== "unranked");
  if (what === "page") { XSTACK = []; const c = BYNAME.get((sub || "teal").toLowerCase()); return openNode(colorNode(c)); }
  if (what === "studio") { go("studio"); return later(() => { const r = document.querySelector(".fv-st-row"); if (r) r.scrollIntoView({ block: "center" }); }, 700); }
  if (what === "unranked") return favShelf();
  if (what === "scroll") { favShelf(); return later(() => { const e = document.querySelector({ top5: ".fv-top5", ways: ".fv-ways", taste: ".fv-taste" }[sub] || ".fv-top5"); if (e) e.scrollIntoView({ block: "start" }); }, 600); }
  if (what === "shelf") return favShelf();
  if (what === "taste" || what === "profile") return loadCoreNames().then(() => favTaste());
  if (what === "rank") return frShot(sub || "bws");
  return favShelf();
}
