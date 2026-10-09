"use strict";
// The slideshow (David, 2026-10-09): "a screensaver meets museum label". A color fills the screen, its name
// appears in serif, one honest one-line fact follows if we actually have one, then it crossfades on. Passive
// entertainment — never a lesson, never graded. Four modes:
//   shuffle     random names, weighted toward ones you haven't met yet (the Learner Model, js/learner.js)
//   family      one family (Blues, Pinks…), walking light to dark and back
//   lookalikes  two close names side by side with their one-line difference (js/lookalikes.js)
//   today       starts on today's color (js/graph.js dailyColor()), then falls back to shuffle
// Entry points: a manual button (Learn's "Or choose" row, the map's Colors sheet), and an idle trigger (60s of
// no input on a calm screen: the map, or Learn's own Today home — never mid-deck, mid-drill or while typing).
// Reached at #/slideshow (and #/slideshow/<mode>); it is an overlay (js/core.js sheet()), not a new screen, so
// leaving it — the ✕, a tap (idle sessions), Escape, the grab-bar swipe, or the phone's Back — always returns to
// exactly the screen underneath, never a page of its own in the trail. Tapping a name is the one exception: it
// opens that color's real page (ROADMAP §13's one-tap rule), and leaving THAT page returns to where the
// slideshow was opened from, as if the slideshow had never been there (ssGoToColor collapses its own history
// entry first).
// Every slide shown is logged to the Learner Model as passive exposure (learnerLog "seen"), never "answer": it
// never marks a name learned, only met (js/learner.js knowState).

const SS_FAM_CYCLE = typeof LN_FAMS !== "undefined" ? LN_FAMS : ["Reds", "Pinks", "Oranges", "Browns", "Yellows", "Greens", "Blues", "Purples", "Greys"];
const SS_MODES = [
  ["shuffle", "Shuffle", icon("shuffle", 16)],
  ["family", "Family", icon("colors", 16)],
  ["lookalikes", "Look-alikes", icon("compare", 16)],
  ["today", "Today", icon("today", 16)],
];
const SS_ICON = {
  pause: sv('<rect x="6" y="5" width="4" height="14" rx="1.2"/><rect x="14" y="5" width="4" height="14" rx="1.2"/>', 20, 1.6),
  play: icon("play", 20),
};
const SS_DWELL = 9000;   // ms per slide, auto-advance
const SS_MIN_DE = 1.4, SS_MAX_DE = 13;   // a look-alike pair close enough to compare, far enough to tell apart

let SS = null;   // the live session, or null when closed

// ---------- the pool ----------
const ssPool = () => (typeof CORE_NAMES !== "undefined" && CORE_NAMES && CORE_NAMES.length) ? CORE_NAMES : coreFallback();
// weighted toward names you haven't met: "none" counts for most, "yours" for least, so the shuffle keeps
// surfacing the edge of what you know without ever excluding what you already do
function ssWeight(c) {
  try {
    const s = typeof knowState === "function" ? knowState(c) : "none";
    return s === "none" ? 3 : s === "met" ? 1.7 : s === "learning" ? 1.1 : 0.6;
  } catch (e) { return 1; }
}
function ssPickWeighted(excludeSet) {
  const all = ssPool();
  const fresh = excludeSet && excludeSet.size ? all.filter(c => !excludeSet.has(c.n)) : all;
  const list = fresh.length ? fresh : all;
  const weights = list.map(ssWeight);
  let total = weights.reduce((a, b) => a + b, 0), r = Math.random() * total;
  for (let i = 0; i < list.length; i++) { r -= weights[i]; if (r <= 0) return list[i]; }
  return list[list.length - 1];
}
function ssFamilyList(fam) {
  return ssPool().filter(c => { try { return setFamily(c.h) === fam; } catch (e) { return false; } }).sort((a, b) => lch(b.h)[0] - lch(a.h)[0]);
}
// a short, honest fact: the article's own lede, else the app color's origin line, else a loaded wiki facet —
// never invented, and skipped entirely when there's nothing on file
function ssFirstSentence(s) { return String(s || "").replace(/\s+/g, " ").trim().split(/(?<=[.!?])\s/)[0] || ""; }
function ssFactFor(c) {
  const app = typeof BYNAME !== "undefined" ? BYNAME.get(String(c.n).toLowerCase()) : null;
  const fromWiki = () => {
    try {
      if (typeof wikiReady !== "function" || !wikiReady() || typeof colorNode !== "function") return "";
      const node = colorNode(app || c);
      const f = node && node.wiki && node.wiki.facets && node.wiki.facets[0];
      return f ? ssFirstSentence(typeof plainText === "function" ? plainText(f.text) : f.text) : "";
    } catch (e) { return ""; }
  };
  if (typeof arLoad !== "function" || typeof routeSlug !== "function") return Promise.resolve(fromWiki());
  return arLoad(routeSlug(c.n)).then(art => {
    if (art && art.lede) return ssFirstSentence(art.lede);
    if (app && app.o) return ssFirstSentence(app.o);
    return fromWiki();
  }).catch(() => (app && app.o ? ssFirstSentence(app.o) : fromWiki()));
}

// ---------- building slides ----------
function ssNextSpec() {
  const mode = SS.mode;
  if (mode === "today" && !SS.usedToday) {
    SS.usedToday = true;
    try { const c = dailyColor(); if (c && c.h) return { type: "single", c: { n: c.n, h: c.h } }; } catch (e) {}
  }
  if (mode === "family") {
    if (!SS.famList || !SS.famList.length) { SS.famList = ssFamilyList(SS.fam); SS.famIdx = 0; SS.famDir = 1; }
    if (!SS.famList.length) return { type: "single", c: ssPickWeighted(SS.recentSet) };
    const c = SS.famList[SS.famIdx];
    if (SS.famList.length > 1) {
      SS.famIdx += SS.famDir;
      if (SS.famIdx >= SS.famList.length) { SS.famIdx = SS.famList.length - 2; SS.famDir = -1; }
      else if (SS.famIdx < 0) { SS.famIdx = Math.min(1, SS.famList.length - 1); SS.famDir = 1; }
    }
    return { type: "single", c };
  }
  if (mode === "lookalikes") {
    const a = ssPickWeighted(SS.recentSet);
    const cands = (typeof lookalikes === "function" ? lookalikes(a, 8) : []).filter(o => o.d >= SS_MIN_DE && o.d <= SS_MAX_DE);
    const pick = cands[0] || (typeof lookalikes === "function" ? lookalikes(a, 1)[0] : null);
    if (pick) return { type: "pair", a, b: pick.x, diff: lookDiff(a, pick.x) };
    return { type: "single", c: a };
  }
  return { type: "single", c: ssPickWeighted(SS.recentSet) };
}
function ssRemember(spec) {
  const names = spec.type === "pair" ? [spec.a.n, spec.b.n] : [spec.c.n];
  names.forEach(n => { SS.recentSet.add(n); SS.recentOrder.push(n); });
  while (SS.recentOrder.length > 16) SS.recentSet.delete(SS.recentOrder.shift());
}

// ---------- rendering ----------
function ssLog(c, src) { try { learnerLog({ type: "seen", color: { n: c.n, h: c.h }, src: src || "page" }); } catch (e) {} }
function ssLayerHTML(spec) {
  if (spec.type === "pair") {
    const { a, b, diff } = spec;
    return `<div class="ss-layer ss-pair">
      <button class="ss-half" style="--c:${a.h}" data-ink="${ink(a.h)}" data-ss-open="a" aria-label="Open ${esc(a.n)}"><span class="ss-name ss-name-sm">${esc(a.n)}</span></button>
      <button class="ss-half" style="--c:${b.h}" data-ink="${ink(b.h)}" data-ss-open="b" aria-label="Open ${esc(b.n)}"><span class="ss-name ss-name-sm">${esc(b.n)}</span></button>
      <p class="ss-diff">${esc(b.n)} is ${esc(diff)} than ${esc(a.n.toLowerCase())}.</p>
    </div>`;
  }
  const c = spec.c;
  return `<div class="ss-layer" style="--c:${c.h}" data-ink="${ink(c.h)}">
    <button class="ss-name-btn" data-ss-open="c" aria-label="Open ${esc(c.n)}">${esc(c.n)}</button>
    <p class="ss-line" data-ss-line></p>
  </div>`;
}
function ssWireLayer(layer, spec) {
  const open = key => ssGoToColor(key === "b" ? spec.b : key === "a" ? spec.a : spec.c);
  layer.querySelectorAll("[data-ss-open]").forEach(b => {
    b.addEventListener("pointerdown", e => e.stopPropagation());
    b.addEventListener("click", e => { e.stopPropagation(); open(b.dataset.ssOpen); });
  });
  (spec.type === "pair" ? [spec.a, spec.b] : [spec.c]).forEach(c => ssLog(c, "page"));
  const line = layer.querySelector("[data-ss-line]");
  if (line) ssFactFor(spec.c || spec.a).then(text => { if (line.isConnected) { if (text) line.textContent = text; else line.remove(); } });
}
// renders `spec` as the new top layer, fading the old one(s) out underneath
function ssRenderLayer(spec) {
  const stage = SS.sh.querySelector("[data-ss-stage]"); if (!stage) return;
  const wrap = document.createElement("div");
  wrap.innerHTML = ssLayerHTML(spec);
  const el = wrap.firstElementChild;
  stage.appendChild(el);
  ssWireLayer(el, spec);
  const old = [...stage.children].filter(x => x !== el);
  requestAnimationFrame(() => { el.classList.add("in"); old.forEach(o => o.classList.remove("in")); });
  old.forEach(o => setTimeout(() => { if (o.isConnected) o.remove(); }, 650));
  const hint = SS.sh.querySelector("[data-ss-hint]");
  if (hint) hint.textContent = String(SS.pos + 1);
}
function ssShowNew() {
  const alreadyHandedOff = SS.mode === "today" && SS.usedToday;   // true only once today's own slide has already gone by
  const spec = ssNextSpec();
  if (alreadyHandedOff) ssPaintModeBtn();   // the pill must never keep claiming "Today" once it's handed off to Shuffle
  ssRemember(spec);
  SS.history = SS.history.slice(0, SS.pos + 1);
  SS.history.push(spec);
  SS.pos = SS.history.length - 1;
  ssRenderLayer(spec);
}
function ssGoToColor(c) {
  buzz(10);
  const sh = SS && SS.sh;
  ssTeardown();
  if (sh) sh.remove();
  try { history.replaceState({ ch: 1 }, "", ROUTE_NOW || undefined); } catch (e) {}
  SS = null;
  openCoreName(c.h, c.n);
}

// ---------- the timer and pause ----------
function ssScheduleNext() {
  if (!SS || SS.paused) return;
  clearTimeout(SS.timer);
  SS.timer = setTimeout(() => ssStep(1), SS_DWELL);
}
function ssStep(dir) {
  if (!SS) return;
  if (dir > 0 && SS.pos < SS.history.length - 1) { SS.pos++; ssRenderLayer(SS.history[SS.pos]); }
  else if (dir > 0) { ssShowNew(); }
  else if (SS.pos > 0) { SS.pos--; ssRenderLayer(SS.history[SS.pos]); }
  ssScheduleNext();
}
function ssSetPaused(p) {
  if (!SS) return;
  SS.paused = p;
  const btn = SS.sh.querySelector("[data-ss-pause]");
  if (btn) { btn.innerHTML = p ? SS_ICON.play : SS_ICON.pause; btn.setAttribute("aria-label", p ? "Resume" : "Pause"); }
  if (p) clearTimeout(SS.timer); else ssScheduleNext();
}

// ---------- wake lock (keep the screen on while it plays) ----------
function ssWakeAcquire() { try { if ("wakeLock" in navigator) navigator.wakeLock.request("screen").then(w => { if (SS) SS.wake = w; else try { w.release(); } catch (e) {} }).catch(() => {}); } catch (e) {} }
function ssWakeRelease() { try { SS && SS.wake && SS.wake.release(); } catch (e) {} if (SS) SS.wake = null; }

function ssTeardown() {
  if (!SS) return;
  clearTimeout(SS.timer);
  ssWakeRelease();
  if (SS.observer) { try { SS.observer.disconnect(); } catch (e) {} }
  if (SS.onPop) removeEventListener("popstate", SS.onPop);
}

// ---------- mode switch ----------
// which mode's label/icon the Mode button shows right now ("today" reads as "Shuffle" once it has handed off —
// David-critic fix: the pill must never keep claiming a mode that isn't actually running, honestly per P19)
function ssModeShown() { return SS.mode === "today" && SS.usedToday ? "shuffle" : SS.mode; }
function ssPaintModeBtn() {
  const id = ssModeShown(), m = SS_MODES.find(x => x[0] === id) || SS_MODES[0];
  const btn = SS.sh.querySelector("[data-ss-mode-btn]"); if (!btn) return;
  btn.querySelector(".lbl").textContent = m[1];
  const ic = btn.querySelector("svg:first-child"); if (ic) ic.outerHTML = m[2];
}
function ssClosePicker() {
  const p = SS.sh.querySelector("[data-ss-picker]"), b = SS.sh.querySelector("[data-ss-mode-btn]");
  if (p) p.hidden = true; if (b) b.setAttribute("aria-expanded", "false");
}
function ssRebuild(mode) {
  SS.mode = mode; S.ssMode = mode; save();
  SS.recentSet = new Set(); SS.recentOrder = [];
  SS.famList = null; SS.famIdx = 0; SS.famDir = 1; SS.usedToday = false;
  SS.history = []; SS.pos = -1;
  SS.sh.querySelectorAll("[data-ss-mode]").forEach(b => { const on = b.dataset.ssMode === mode; b.classList.toggle("on", on); b.setAttribute("aria-selected", on ? "true" : "false"); });
  const strip = SS.sh.querySelector("[data-ss-famstrip]"); if (strip) strip.hidden = mode !== "family";
  ssPaintModeBtn();
  ssStep(1);
}
// one Mode button (David-critic fix: four pills plus a family row stacked over the hero color broke Law 1 —
// "the color is the interface" — so only ✕, Mode and Pause sit over it at rest now; the four choices and,
// in Family mode, the family row live in a compact picker the Mode button opens)
function ssShellHTML(mode) {
  const m = SS_MODES.find(x => x[0] === mode) || SS_MODES[0];
  return `<div class="ss-ov" data-ss>
    <div class="ss-stage" data-ss-stage></div>
    <div class="ss-top">
      <button class="ss-x" data-ss-close aria-label="Close slideshow">${ICON.x}</button>
      <button class="ss-mode-btn" data-ss-mode-btn aria-haspopup="true" aria-expanded="false" aria-label="Slideshow mode">${m[2]}<span class="lbl">${esc(m[1])}</span><span class="chev">${icon("chev", 14)}</span></button>
      <button class="ss-pause" data-ss-pause aria-label="Pause">${SS_ICON.pause}</button>
    </div>
    <div class="ss-picker" data-ss-picker hidden role="menu" aria-label="Slideshow mode">
      ${SS_MODES.map(([id, label, ic]) => `<button class="ss-mode${mode === id ? " on" : ""}" data-ss-mode="${id}" role="menuitemradio" aria-checked="${mode === id}">${ic}<span>${esc(label)}</span></button>`).join("")}
      <div class="ss-fam-strip"${mode === "family" ? "" : " hidden"} data-ss-famstrip>${SS_FAM_CYCLE.map(f =>
        `<button class="ss-fam-chip${(S.ssFamily || "Blues") === f ? " on" : ""}" data-ss-fam="${esc(f)}">${esc(f)}</button>`).join("")}</div>
    </div>
    <p class="ss-hint" data-ss-hint aria-hidden="true"></p>
  </div>`;
}

// ---------- open / close ----------
function ssOpenRoute(mode) { ssOpen(mode || null); }
function ssOpen(mode, opts = {}) {
  if (document.querySelector(".ss-ov")) return;
  mode = mode && SS_MODES.some(m => m[0] === mode) ? mode : (S.ssMode && SS_MODES.some(m => m[0] === S.ssMode) ? S.ssMode : "shuffle");
  S.ssFamily = S.ssFamily || "Blues";
  const fromIdle = !!opts.idle;
  // the tap that opens the slideshow must never go quiet while CORE_NAMES loads (David-critic fix: every
  // touch answers within 100ms) — the trigger itself shows a brief pressed/loading state
  const trigger = document.activeElement && document.activeElement.closest && document.activeElement.closest("button");
  if (trigger && !(typeof CORE_NAMES !== "undefined" && CORE_NAMES)) { trigger.classList.add("ss-loading"); trigger.disabled = true; }
  const open = () => {
    if (trigger) { trigger.classList.remove("ss-loading"); trigger.disabled = false; }
    const { sh, close } = sheet(ssShellHTML(mode));
    sh.classList.add("ss-full");
    SS = { mode, fam: S.ssFamily, recentSet: new Set(), recentOrder: [], famList: null, famIdx: 0, famDir: 1, usedToday: false,
      history: [], pos: -1, sh, close, fromIdle, timer: 0, paused: false, wake: null, _myPop: false };
    try { history.pushState({ ch: 1 }, "", "#/slideshow" + (mode ? "/" + mode : "")); } catch (e) {}
    document.title = "Slideshow · ColorHub";
    ssWakeAcquire();
    sh.querySelector("[data-ss-close]").onclick = () => close();
    const modeBtn = sh.querySelector("[data-ss-mode-btn]"), picker = sh.querySelector("[data-ss-picker]");
    modeBtn.onclick = () => {
      buzz(4);
      const open2 = picker.hidden;
      picker.hidden = !open2; modeBtn.setAttribute("aria-expanded", open2 ? "true" : "false");
    };
    sh.querySelectorAll("[data-ss-mode]").forEach(b => b.onclick = () => {
      buzz(4);
      if (b.dataset.ssMode === SS.mode) { if (SS.mode !== "family") ssClosePicker(); return; }
      ssRebuild(b.dataset.ssMode);
      if (b.dataset.ssMode !== "family") ssClosePicker();
    });
    sh.querySelectorAll("[data-ss-fam]").forEach(b => b.onclick = () => {
      S.ssFamily = b.dataset.ssFam; save(); SS.fam = S.ssFamily; SS.famList = null;
      sh.querySelectorAll("[data-ss-fam]").forEach(x => x.classList.toggle("on", x.dataset.ssFam === S.ssFamily));
      buzz(4); ssStep(1); ssClosePicker();
    });
    sh.querySelector("[data-ss-pause]").onclick = () => { buzz(6); ssSetPaused(!SS.paused); };
    // tap to pause/resume (manual sessions) or dismiss (idle sessions, "easy to dismiss with any tap");
    // swipe left/right to step. Both skip the controls, the family strip and the name buttons.
    const stage = sh.querySelector("[data-ss-stage]");
    let x0 = 0, y0 = 0, t0 = 0, moved = false;
    const isChrome = t => t.closest(".ss-top,.ss-picker,.ss-name-btn,.ss-half,.grab");
    stage.addEventListener("pointerdown", e => { if (isChrome(e.target)) return; x0 = e.clientX; y0 = e.clientY; t0 = performance.now(); moved = false; });
    stage.addEventListener("pointermove", e => { if (Math.abs(e.clientX - x0) > 8 || Math.abs(e.clientY - y0) > 8) moved = true; });
    stage.addEventListener("pointerup", e => {
      if (isChrome(e.target)) return;
      if (!picker.hidden) { ssClosePicker(); return; }   // a tap outside the open picker just closes it
      const dx = e.clientX - x0, dt = performance.now() - t0;
      if (Math.abs(dx) > 48 && dt < 700) { buzz(4); ssStep(dx < 0 ? 1 : -1); return; }
      if (!moved && dt < 450) { if (SS.fromIdle) close(); else { buzz(4); ssSetPaused(!SS.paused); } }
    });
    const onPop = () => { if (SS) SS._myPop = true; };
    addEventListener("popstate", onPop);
    SS.onPop = onPop;
    SS.observer = new MutationObserver(() => {
      if (sh.isConnected) return;
      const myPop = SS && SS._myPop;
      ssTeardown();
      SS = null;
      if (!myPop) { try { history.back(); } catch (e) {} }
    });
    SS.observer.observe(document.body, { childList: true });
    ssStep(1);
  };
  if (typeof CORE_NAMES !== "undefined" && CORE_NAMES) open();
  else loadCoreNames().then(open);
}

// ---------- entry points ----------
document.addEventListener("click", e => { const b = e.target.closest && e.target.closest("[data-slideshow]"); if (b) { buzz(6); ssOpen(b.dataset.slideshow || null); } });

// ---------- the idle trigger ----------
let SS_LAST_ACTIVE = Date.now();
["pointerdown", "keydown", "touchstart", "wheel"].forEach(evt => addEventListener(evt, () => { SS_LAST_ACTIVE = Date.now(); }, { passive: true, capture: true }));
function ssIdleEligible() {
  if (typeof SHOT !== "undefined" && SHOT) return false;
  if (S.ssIdle === false) return false;
  if (document.querySelector(".ss-ov,.sheet,.scrim,.peek,.rooms-stem")) return false;
  const ae = document.activeElement;
  if (ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)) return false;
  return !!document.querySelector(".hm") || !!document.querySelector(".room-learn");
}
setInterval(() => {
  if (!S.placed) return;
  if (Date.now() - SS_LAST_ACTIVE < 60000) return;
  if (!ssIdleEligible()) return;
  SS_LAST_ACTIVE = Date.now();
  ssOpen(null, { idle: true });
}, 5000);
