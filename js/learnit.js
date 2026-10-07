"use strict";
// Learn it: an instant ~2-minute lesson for one color and its 3-4 closest look-alikes (ROADMAP.md §12), opened
// from a color page or the honeycomb home. Five short steps, reusing what already exists wherever it fit:
// Meet (a small card sequence, like meet() in js/learn.js but only for names not yet known) -> Tell apart
// (odd one out, restricted to this group — a simplified standalone version of js/gym.js's "hue" drill, since
// the real drill's staircase/dial engine is built for its own session bookkeeping, not a 5-color one-off) ->
// Sort (tap the group light to dark — a simplified stand-in for js/gym-engine.js's "order" drill, same reason) ->
// Pick it (js/pickit.js's pickBoard(), given this lesson's own group as its four options instead of the
// nearest-by-ΔE pool) -> one Memory round (see it, lose it, find it among the group).
// Every color in the lesson joins spaced review at the end (due tomorrow, like learnUnit() in core.js, but
// without learnUnit's own S.done bookkeeping, which belongs to real path units, not an ad-hoc lesson). Nothing
// here marks a name "yours": that still only happens the honest way, a day or more later (js/pickit.js).

// The group: the color plus its closest taught look-alikes (lookalikes(), js/lookalikes.js), excluding basics
// (placement-only words, never part of a lesson or spaced review — CLAUDE.md's product rules).
function hmLearnGroup(c, n = 4) {
  return lookalikes(c, 8).map(o => o.x).filter(x => x.id && !x.basic && x.n.toLowerCase() !== c.n.toLowerCase()).slice(0, n);
}

function hmLearnIt(c) {
  const near = hmLearnGroup(c);
  if (!near.length) { toast("No close look-alikes to compare yet"); return hmOpenColor(c); }
  const group = [c, ...near];
  const steps = [hmLtMeet, hmLtTell, hmLtSort, hmLtPick, hmLtMemory];
  let i = 0;
  const advance = () => { i++; i < steps.length ? steps[i](group, c, advance) : hmLtDone(group, c); };
  steps[0](group, c, advance);
}

const hmLtTop = i => `<header class="deck-top"><button class="icon-btn" data-close aria-label="Back to the honeycomb">${ICON.x}</button>
  <span class="lt-steps">${Array.from({ length: 5 }, (_, k) => `<i class="${k < i ? "on" : k === i ? "now" : ""}"></i>`).join("")}</span>
  <span style="width:44px"></span></header>`;
const hmLtClose = el => { el.querySelector("[data-close]").onclick = () => hmHome(); };

// ---------- 1. Meet: the ones not yet known, one at a time (like meet() in js/learn.js, without the full pager) ----------
function hmLtMeet(group, c, next) {
  const todo = group.filter(x => !isMine(S.cards[x.id]));
  const list = todo.length ? todo : group;
  let i = 0;
  function render() {
    const x = list[i], diff = x.n === c.n ? "" : lookDiff(c, x);
    const el = show(`
      ${hmLtTop(0)}
      <div class="lt-card">
        <div class="lt-sw" style="--c:${x.h}"></div>
        <h1>${esc(x.n)}</h1><span class="mono">${x.h}</span>
        <p>${x.n === c.n ? "The color you're learning now." : `${esc(diff.charAt(0).toUpperCase() + diff.slice(1))} than ${esc(c.n.toLowerCase())}.`}</p>
      </div>
      <button class="btn" data-next>${i < list.length - 1 ? "Next" : "Start"} ${ICON.arrow}</button>
    `, "fixed meet learnit");
    hmLtClose(el);
    el.querySelector("[data-next]").onclick = () => { i++; i < list.length ? render() : next(); };
    onKey = e => { if (e.key === "Escape") hmHome(); else if (e.key === "Enter" || e.key === " ") el.querySelector("[data-next]").click(); };
  }
  render();
}

// ---------- 2. Tell apart: odd one out, restricted to this group (c vs. each look-alike in turn) ----------
function hmLtTell(group, c, next) {
  const pairs = group.slice(1).map(x => [c, x]);
  const rounds = shuffle(pairs).slice(0, Math.min(3, pairs.length));
  let i = 0;
  function render() {
    const flip = Math.random() < .5, [base, odd] = flip ? [rounds[i][1], rounds[i][0]] : rounds[i];
    const n = 6, oddPos = Math.floor(Math.random() * n);
    let answered = false;
    const el = show(`
      ${hmLtTop(1)}
      <div class="lt-card">
        <p class="eyebrow">Tell them apart</p>
        <h1>Which one is <em>${esc(odd.n.toLowerCase())}</em>?</h1>
        <div class="lt-grid">${Array.from({ length: n }, (_, k) => `<button data-i="${k}" style="--c:${k === oddPos ? odd.h : base.h}" aria-label="Option ${k + 1}"></button>`).join("")}</div>
        <p class="pi-hint" id="ltline"></p>
      </div>
    `, "fixed drill learnit");
    hmLtClose(el);
    el.querySelectorAll("[data-i]").forEach(b => b.onclick = () => {
      if (answered) return; answered = true;
      const ok = +b.dataset.i === oddPos;
      buzz(ok ? 12 : [10, 40, 10]);
      el.querySelectorAll("[data-i]").forEach(x => x.classList.add(+x.dataset.i === oddPos ? "right" : "wrong"));
      el.querySelector("#ltline").textContent = ok ? `Right — ${odd.n} is ${lookDiff(base, odd)} than ${base.n}.` : `That's ${base.n}. ${odd.n} is ${lookDiff(base, odd)}.`;
      later(() => { i++; i < rounds.length ? render() : next(); }, 1200);
    });
  }
  render();
}

// ---------- 3. Sort: tap the group light to dark (a short, standalone stand-in for js/gym.js's "order" drill) ----------
function hmLtSort(group, c, next) {
  const list = shuffle(group), order = list.slice().sort((a, b) => lab(b.h)[0] - lab(a.h)[0]);
  const picks = [];
  const el = show(`
    ${hmLtTop(2)}
    <div class="lt-card">
      <p class="eyebrow">Sort the strip</p>
      <h1>Tap them <em>light to dark.</em></h1>
      <div class="lt-strip" id="ltstrip">${list.map(x => `<button data-n="${esc(x.n)}"><i style="--c:${x.h}"></i><span>${esc(x.n)}</span><b></b></button>`).join("")}</div>
      <p class="pi-hint" id="ltres"></p>
    </div>
  `, "fixed drill learnit");
  hmLtClose(el);
  const strip = el.querySelector("#ltstrip");
  strip.querySelectorAll("button").forEach(b => b.onclick = () => {
    if (b.classList.contains("set") || picks.length >= list.length) return;
    picks.push(b.dataset.n); b.classList.add("set"); b.querySelector("b").textContent = picks.length; buzz(5);
    if (picks.length !== list.length) return;
    strip.classList.add("done");
    let right = 0;
    strip.querySelectorAll("button").forEach(x => {
      const ok = picks.indexOf(x.dataset.n) === order.findIndex(o => o.n === x.dataset.n);
      if (ok) right++;
      x.classList.add(ok ? "ok" : "off");
    });
    el.querySelector("#ltres").textContent = `${right} of ${list.length} in the right spot`;
    later(next, 1500);
  });
}

// ---------- 4. Pick it: the name, choose its color among this group's own swatches (js/pickit.js's pickBoard) ----------
function hmLtPick(group, c, next) {
  const rounds = shuffle(group).slice(0, Math.min(3, group.length));
  let i = 0;
  function render() {
    // pickBoard's board is a fixed 2x2 (pi-grid, css/pickit.css): at most 4 options, whatever the group's size
    const target = rounds[i], others = shuffle(group.filter(x => x.n !== target.n)).slice(0, 3);
    const opts = shuffle([{ c: target, h: target.h, ok: true }, ...others.map(x => ({ c: x, h: x.h, ok: false }))]);
    const el = show(`
      ${hmLtTop(3)}
      <div class="stage" id="stage"></div>
      <footer class="deck-foot pi-foot"><p class="pi-hint">Tap its color, among this group</p></footer>
    `, "fixed deck learnit");
    hmLtClose(el);
    const card = document.createElement("div"); el.querySelector("#stage").appendChild(card);
    pickBoard(card, target, { opts, onPick: () => later(() => { i++; i < rounds.length ? render() : next(); }, 1200) });
  }
  render();
}

// ---------- 5. Memory: see it, lose it, find it among the group ----------
function hmLtMemory(group, c, next) {
  const target = group[Math.floor(Math.random() * group.length)];
  const el = show(`
    ${hmLtTop(4)}
    <div class="lt-card" id="ltmem">
      <p class="eyebrow">Memory</p>
      <h1>Remember this <em>color.</em></h1>
      <div class="lt-sw" style="--c:${target.h}"></div>
    </div>
  `, "fixed drill learnit");
  hmLtClose(el);
  later(() => {
    if (!el.isConnected) return;
    el.querySelector("#ltmem").innerHTML = `<p class="eyebrow">Memory</p><h1>Which one was it?</h1>
      <div class="lt-grid">${shuffle(group).map(x => `<button data-n="${esc(x.n)}" style="--c:${x.h}"></button>`).join("")}</div>`;
    let answered = false;
    el.querySelectorAll("[data-n]").forEach(b => b.onclick = () => {
      if (answered) return; answered = true;
      const ok = b.dataset.n === target.n;
      buzz(ok ? 12 : [10, 40, 10]);
      el.querySelectorAll("[data-n]").forEach(x => x.classList.add(x.dataset.n === target.n ? "right" : x === b ? "wrong" : ""));
      later(next, 1200);
    });
  }, 1400);
}

// ---------- end screen: "You learned teal, and how it differs from turquoise, petrol and cerulean." ----------
// Every color in the lesson joins spaced review here, due tomorrow — learnUnit()'s own rule (core.js), just
// without learnUnit's S.done bookkeeping, which is for real path units. Nothing here marks a name "yours":
// that only ever happens the honest way, a check a day or more later (js/pickit.js's own rule, untouched).
function hmSchedule(group) {
  const t = today();
  group.forEach(x => { if (x.basic || S.cards[x.id]) return; S.cards[x.id] = { b: 0, due: addDays(t, 1), since: t, own: false }; });
  save();
}
function hmLtDone(group, c) {
  hmSchedule(group);
  const names = group.slice(1).map(x => x.n);
  const list = names.length > 1 ? names.slice(0, -1).join(", ") + " and " + names[names.length - 1] : names[0] || "";
  const el = show(`
    <div style="flex:1"></div>
    <div class="lt-done">
      <div class="fan">${group.map(x => `<i style="--c:${x.h}"></i>`).join("")}</div>
      <p class="eyebrow">Learn it · done</p>
      <h1>You learned ${esc(c.n.toLowerCase())},<em>${list ? ` and how it differs from ${esc(list.toLowerCase())}.` : " a little better."}</em></h1>
      <p>Every color here joins your reviews, due tomorrow — recalling them after a night's sleep is what makes them stick.</p>
    </div>
    <div class="stack">
      <button class="btn" data-see>See its page ${ICON.arrow}</button>
      <button class="btn ghost" data-home>Back to the honeycomb</button>
    </div>
  `, "result learnit");
  el.querySelector("[data-see]").onclick = () => hmOpenColor(c);
  el.querySelector("[data-home]").onclick = () => hmHome();
  onKey = e => { if (e.key === "Enter") hmHome(); };
}

// ---------- screenshot hook: #shot=learnit:<meet|tell|sort|pick|memory|done> ----------
function hmLearnitShot(arg) {
  const c = BYNAME.get("teal") || ALL[0], group = [c, ...hmLearnGroup(c)];
  const steps = { meet: hmLtMeet, tell: hmLtTell, sort: hmLtSort, pick: hmLtPick, memory: hmLtMemory };
  if (arg === "done") return hmLtDone(group, c);
  (steps[arg] || hmLtMeet)(group, c, () => {});
}
