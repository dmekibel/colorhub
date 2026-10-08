"use strict";
// Learn it: an instant ~2-minute lesson for one color and its 3-4 closest look-alikes, opened from a color
// page or the honeycomb home (DESIGN-SYSTEM.md §12). Rebuilt on the patterns David already likes, reusing the
// real components: Meet (the meet-pager pattern from meet(), js/learn.js) -> Recall (the real swipe deck,
// deck(), with a small additive opt-out of its unit-completion side effects, added there) -> Tell apart
// (pickBoard(), js/pickit.js, given this lesson's own group as its four options) -> a calm Done. Sort and
// Memory are gone: thinky exercises belong in the eye-training gym, never the flashcard loop (CLAUDE.md).
// One segmented bar runs the whole lesson (no step word): a segment is grey until its color is met, faint in
// its own color once met, solid once it's been recalled. The whole flow stays on the booth grey (css/booth.css
// has "learnit" in its list), and ✕ / the final primary always return to the color's own page — never the
// honeycomb — matching the signature motion (the paper "Learn it" button grew into this; closing shrinks it
// back). Every color in the lesson joins spaced review at the end, due tomorrow, honestly: nothing here ever
// marks a name "yours" (that only happens the honest way, a check a day or more later: js/pickit.js).

// The group: the color plus its closest taught look-alikes (lookalikes(), js/lookalikes.js), excluding basics
// (placement-only words, never part of a lesson or spaced review — CLAUDE.md's product rules).
// With the ~1,000-name list loaded, the group comes from all of it, same family, every pair solvable (lxGroup,
// js/learnmore.js), so Learn it works on ANY color, not only the first units.
function hmLearnGroup(c, n = 4) {
  if (typeof lxGroup === "function" && typeof lxCore === "function" && lxCore()) return lxGroup(c, n).filter(x => x.n.toLowerCase() !== c.n.toLowerCase());
  return lookalikes(c, 8).map(o => o.x).filter(x => x.id && !x.basic && x.n.toLowerCase() !== c.n.toLowerCase()).slice(0, n);
}
// Where ✕ and the last button go: the color's own page (a deep page for the first units, else its name page)
function hmLtHome(c) {
  if (c && c.kind && typeof openCoreName === "function") return openCoreName(c.h, c.n);
  return hmOpenColor(c);
}

function hmLearnIt(c, o = {}) {
  if (!c) return;
  // Learn it opens the Learn sheet (js/learnset.js lsOpen), seeded with this color + its 3 nearest and the settings
  // showing (David, 2026-10-09); the full lesson stays for the sheet's own "Learn it" method ({ lesson: true })
  if (!o.lesson && typeof lsOpen === "function") return lsOpen({ seed: c, size: typeof LS_QUICK_N !== "undefined" ? LS_QUICK_N : 4, back: typeof ROUTE_NOW === "string" && ROUTE_NOW && !/^#\/learnit\//.test(ROUTE_NOW) ? ROUTE_NOW : () => hmLtHome(c) });
  // the group draws on the ~1,000-name list: wait for it the first time (it's usually prefetched already)
  if (typeof CORE_NAMES !== "undefined" && !CORE_NAMES && typeof loadCoreNames === "function") return loadCoreNames().then(() => hmLearnIt(c, o));
  const near = hmLearnGroup(c);
  if (!near.length) { toast("No close look-alikes to compare yet"); return hmLtHome(c); }
  const group = [c, ...near];
  hmLtMeet(group, c, () => hmLtRecall(group, c, () => hmLtEdge(group, c, () => hmLtTell(group, c, () => hmLtDone(group, c)))));
}

// ---------- 2b. Edges: where a name ends (design/IDEAS-10X/learning.md B3) ----------
// Nine steps from c to a look-alike, mixed in Lab; "tap the last one you'd still call teal". The reveal labels
// every step with its nearest name (of about 1,000), marks where the two colors meet halfway (by perceived
// difference, CIEDE2000), and says where your border sits. It's a judgment, not a recall: it never counts toward
// Yours. Every tap is kept in S.edges["a|b"] = [[day, tap, mid]] for a later border map.
// The pure strip: n colors from a to b (both ends included), and mid = the first step nearer b than a.
function edgeStrip(aHex, bHex, n = 9) {
  const A = lab(aHex), B = lab(bHex), hexes = [];
  for (let i = 0; i < n; i++) { const t = i / (n - 1); hexes.push(labHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t)); }
  hexes[0] = aHex.toUpperCase(); hexes[n - 1] = bHex.toUpperCase();
  let mid = hexes.findIndex(h => de2000(h, bHex) < de2000(h, aHex));
  if (mid < 1) mid = Math.ceil(n / 2);
  return { hexes, mid };
}
function hmLtEdge(group, c, next) {
  const rounds = group.slice(1, 3);
  if (!rounds.length) return next();
  const onClose = () => hmLtHome(c);
  let r = 0;
  function render() {
    const b = rounds[r], { hexes, mid } = edgeStrip(c.h, b.h, 9);
    const name = x => esc(typeof lxLower === "function" ? lxLower(x.n) : x.n.toLowerCase());
    const el = show(`
      ${hmLtHead(group, () => "known")}
      <h2 class="lt-edge-q">Tap the last one you'd still call <em>${name(c)}</em>.</h2>
      <div class="lt-edge" role="group" aria-label="Nine steps from ${esc(c.n)} to ${esc(b.n)}">
        ${hexes.map((h, i) => `<button class="lt-edge-b" data-i="${i}" style="--c:${h}" data-ink="${ink(h)}" aria-label="Step ${i + 1}"><span class="lt-edge-lab"></span></button>`).join("")}
      </div>
      <div class="lt-edge-ends"><span>${esc(c.n)}</span><span>${esc(b.n)}</span></div>
      <p class="lt-edge-line note" aria-live="polite">${r === 0 ? "Names are fuzzy. There's no wrong answer here, only your border." : "One more border."}</p>
      <div style="flex:1"></div>
      <button class="lt-primary lt-edge-next" data-next hidden>${r + 1 < rounds.length ? "Next border" : "Next"} ${ICON.arrow}</button>
    `, "fixed learnit lt-edge-screen");
    hmLtClose(el, onClose);
    let tapped = -1;
    el.querySelectorAll(".lt-edge-b").forEach(btn => btn.onclick = () => {
      if (tapped >= 0) {   // after the reveal a step opens the name it's labeled with: one tap, its page
        const nm = btn.dataset.nm; if (nm && typeof openCoreName === "function") openCoreName(btn.dataset.nh, nm);
        return;
      }
      tapped = +btn.dataset.i; buzz(10);
      btn.classList.add("on");
      el.querySelector(".lt-edge").classList.add("revealed");
      // the reveal: each step's nearest name, the halfway mark, and one line about your border
      const nms = hexes.map(h => typeof nameOf === "function" ? nameOf(h) : { n: "", h });
      el.querySelectorAll(".lt-edge-b").forEach((x, i) => {
        const nm = nms[i]; x.querySelector(".lt-edge-lab").textContent = nm.n || "";
        if (nm.n) { x.dataset.nm = nm.n; x.dataset.nh = nm.h; x.setAttribute("aria-label", `Step ${i + 1}: ${nm.n}`); }
        if (i === mid) x.classList.add("mid");
      });
      const yours = tapped, ref = mid - 1, k = yours - ref;
      const steps = n => `${Math.abs(n)} step${Math.abs(n) === 1 ? "" : "s"}`;
      let line = `The two meet halfway between steps ${mid} and ${mid + 1}. `;
      line += k === 0 ? `You stopped right there: your ${name(c)} ends where most eyes would split it.`
        : k > 0 ? `You stopped at step ${yours + 1}: your ${name(c)} reaches ${steps(k)} further toward ${name(b)}.`
        : `You stopped at step ${yours + 1}: your ${name(c)} gives way ${steps(k)} sooner, before ${name(b)}'s half.`;
      const inner = nms.map((nm, i) => ({ nm, i })).find(o => o.i > 0 && o.i < 8 && o.nm.n && ![c.n, b.n].some(n => n.toLowerCase() === o.nm.n.toLowerCase()));
      el.querySelector(".lt-edge-line").innerHTML = esc(line) + (inner ? ` <button class="lt-edge-name" data-nm="${esc(inner.nm.n)}" data-nh="${inner.nm.h}">Step ${inner.i + 1} has a name of its own: <em>${esc(inner.nm.n)}</em></button>` : "");
      const nb = el.querySelector(".lt-edge-name"); if (nb) nb.onclick = () => openCoreName(nb.dataset.nh, nb.dataset.nm);
      S.edges = S.edges || {};
      const key = c.n + "|" + b.n; (S.edges[key] = S.edges[key] || []).push([today(), yours, mid]); save();
      const go = el.querySelector("[data-next]"); go.hidden = false;
      go.onclick = () => { r++; r < rounds.length ? render() : next(); };
    });
    onKey = e => {
      if (e.key === "Escape") return onClose();
      if (/^[1-9]$/.test(e.key) && tapped < 0) el.querySelectorAll(".lt-edge-b")[+e.key - 1].click();
      else if (e.key === "Enter" && tapped >= 0) el.querySelector("[data-next]").click();
    };
  }
  render();
}

// ---------- shared chrome: one segmented bar for the whole lesson, no step word (css/learnit.css) ----------
// clsFor(x) -> "" (not met yet, grey) | "met" (shown, faint in its own color) | "known" (recalled, solid).
function hmLtHead(group, clsFor) {
  return `<header class="lt-head"><button class="icon-btn" data-lt-x aria-label="Back to ${esc(group[0].n)}">${ICON.x}</button>
    <div class="segs">${group.map(x => `<i style="--c:${x.h}" class="${clsFor(x)}"></i>`).join("")}</div></header>`;
}
function hmLtClose(el, onClose) { const b = el.querySelector("[data-lt-x]"); if (b) b.onclick = onClose; }
// How x differs from base, one honest sentence (the color's own fact-checked line when it actually applies,
// else the measured LCh difference, js/lookalikes.js's lookDiff — same source either way).
function hmLtLine(base, x) {
  if (x.vs && x.vs.toLowerCase() === base.n.toLowerCase() && x.d) return x.d;
  const w = lookDiff(base, x);
  return w.charAt(0).toUpperCase() + w.slice(1) + ` than ${base.n.toLowerCase()}.`;
}

// ---------- 1. Meet: the meet-pager pattern (meet(), js/learn.js), scoped to the group ----------
// Colors already yours are skipped (no page of their own) but always shown on the cover.
function hmLtMeet(group, c, next) {
  const todo = group.filter(x => !isMine(S.cards[x.id]));
  const list = todo.length ? todo : group;
  const near = group.slice(1);
  const plates = group.slice().sort((a, b) => lab(b.h)[0] - lab(a.h)[0]);
  const known = new Set(group.filter(x => isMine(S.cards[x.id])).map(x => x.id));
  const met = new Set();
  const onClose = () => hmLtHome(c);
  const clsFor = x => known.has(x.id) ? "known" : met.has(x.id) ? "met" : "";
  const pageHtml = (x, i) => {
    const partner = x.n === c.n ? (near[0] || c) : c;
    return `<section class="lt-page">
      <div class="lt-swatch" style="--c:${x.h}" data-ink="${ink(x.h)}"><h2 class="lt-display">${esc(x.n)}</h2><span class="lt-code">${x.h}</span></div>
      <div class="compare lt-cmp"><div style="--c:${x.h}" data-ink="${ink(x.h)}">${esc(x.n)}</div><div style="--c:${partner.h}" data-ink="${ink(partner.h)}">${esc(partner.n)}</div></div>
      <p class="lt-diff">${esc(hmLtLine(partner, x))}</p>
      <div class="lt-page-foot">${peekBtn(x)}<span class="lt-up" aria-hidden="true">${ICON.up}<span class="lt-code">${i + 1}/${list.length}</span></span></div>
    </section>`;
  };
  const el = show(`
    ${hmLtHead(group, clsFor)}
    <div class="lt-pager" id="ltPager">
      <section class="lt-page lt-cover">
        <div class="lt-plates">${plates.map(x => `<i style="--c:${x.h}"></i>`).join("")}</div>
        <h1 class="lt-display">${esc(c.n)} and its look-alikes</h1>
        <p class="note">${list.length} color${list.length === 1 ? "" : "s"} that ${list.length === 1 ? "is" : "are"} easy to mix up.</p>
      </section>
      ${list.map(pageHtml).join("")}
    </div>
  `, "fixed learnit");
  hmLtClose(el, onClose);
  const pager = el.querySelector("#ltPager"), pages = [...pager.children], segs = el.querySelectorAll(".segs i");
  const markMet = x => {
    if (met.has(x.id) || known.has(x.id)) return;
    met.add(x.id);
    const s = segs[group.indexOf(x)]; if (s) s.classList.add("met");
  };
  // the page you're looking at counts as "met" — the same idea as meet()'s own page counter, trimmed to this group
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    const i = pages.indexOf(e.target) - 1;   // -1 for the cover page
    if (i >= 0) markMet(list[i]);
  }), { root: pager, threshold: .6 });
  pages.forEach(p => io.observe(p));
  cleanup.push(() => io.disconnect());
  const go = d => {
    const i = Math.round(pager.scrollTop / pager.clientHeight), ni = i + d;
    if (ni < 0) return;
    if (ni >= pages.length) { list.forEach(markMet); return next(); }
    pager.scrollTo({ top: ni * pager.clientHeight, behavior: reduceMotion ? "auto" : "smooth" });
  };
  pager.addEventListener("click", e => { if (!e.target.closest("[data-peek]")) go(1); });
  onKey = e => {
    if (e.key === "Escape") return onClose();
    if (["ArrowDown", "PageDown", " ", "Enter"].includes(e.key)) { e.preventDefault(); go(1); }
    if (["ArrowUp", "PageUp"].includes(e.key)) { e.preventDefault(); go(-1); }
  };
}

// ---------- 2. Recall: the real swipe deck (deck("learn"), js/learn.js), forward cards only ----------
function hmLtRecall(group, c, next) {
  deck("learn", { unit: { colors: group }, cls: "learnit lt-recall", onClose: () => hmLtHome(c), onFinish: next });
}

// ---------- 3. Tell apart: Pick it (pickBoard(), js/pickit.js), the group's own swatches as the options ----------
function hmLtTell(group, c, next) {
  const rounds = shuffle(group).slice(0, Math.min(3, group.length));
  const onClose = () => hmLtHome(c);
  let i = 0;
  function render() {
    const target = rounds[i], others = shuffle(group.filter(x => x.n !== target.n)).slice(0, 3);
    const opts = shuffle([{ c: target, h: target.h, ok: true }, ...others.map(x => ({ c: x, h: x.h, ok: false }))]);
    const el = show(`
      ${hmLtHead(group, () => "known")}
      <div class="stage" id="stage"></div>
      <footer class="deck-foot pi-foot"><p class="pi-hint">Tap its color</p></footer>
    `, "fixed learnit");
    hmLtClose(el, onClose);
    const card = document.createElement("div"); el.querySelector("#stage").appendChild(card);
    pickBoard(card, target, { opts, tag: "Which one is", onPick: () => later(() => { i++; i < rounds.length ? render() : next(); }, 1200) });
    onKey = e => { if (e.key === "Escape") onClose(); };
  }
  render();
}

// ---------- 4. Done: a calm finish, still on grey ----------
// Every color in the lesson joins spaced review here, due tomorrow (the same rule as learnUnit(), core.js, just
// without its S.done bookkeeping, which is for real path units, not an ad-hoc lesson). Nothing here marks a
// name "yours": that only ever happens the honest way, a check a day or more later (js/pickit.js's own rule).
function hmSchedule(group) {
  const t = today();
  group.forEach(x => { if (x.basic || S.cards[x.id]) return; S.cards[x.id] = { b: 0, due: addDays(t, 1), since: t, own: false, n: x.n, h: x.h }; });
  save();
}
function hmLtDone(group, c) {
  hmSchedule(group);
  const near = group.slice(1);
  const plates = group.slice().sort((a, b) => lab(b.h)[0] - lab(a.h)[0]);
  const el = show(`
    <div class="lt-done-pal">${plates.map(x => `<i style="--c:${x.h}"></i>`).join("")}</div>
    <h1 class="lt-t1">You met <em>${esc(c.n.toLowerCase())}</em>${near.length ? `, and ${near.length} look-alike${near.length === 1 ? "" : "s"}.` : "."}</h1>
    ${near.length ? `<div class="lt-rows">${near.map(x => `<div class="lt-row"><span class="pair"><i style="--c:${c.h}"></i><i style="--c:${x.h}"></i></span><span class="lt-row-n">${esc(x.n)}</span><span class="note">${esc(lookDiff(c, x))}</span></div>`).join("")}</div>` : ""}
    <p class="note lt-done-note">All ${group.length} come back tomorrow, after a night's sleep.</p>
    ${typeof lxBetHtml === "function" ? lxBetHtml(group.map(x => x.id)) : ""}
    <div style="flex:1"></div>
    <button class="lt-primary" data-lt-back>Back to ${esc(c.n)} ${ICON.arrow}</button>
  `, "fixed learnit");
  if (typeof lxBetWire === "function") lxBetWire(el, group.map(x => x.id));
  el.querySelector("[data-lt-back]").onclick = () => hmLtHome(c);
  onKey = e => { if (e.key === "Enter" || e.key === "Escape") hmLtHome(c); };
}

// ---------- screenshot hook: #shot=learnit:<meet|meetpage|recall|tell|done> ----------
function hmLearnitShot(arg) {
  const c = BYNAME.get("teal") || ALL[0], group = [c, ...hmLearnGroup(c)];
  if (arg === "recall") return hmLtRecall(group, c, () => {});
  if (arg === "tell") return hmLtTell(group, c, () => {});
  if (arg === "done") return hmLtDone(group, c);
  hmLtMeet(group, c, () => {});
  if (arg === "meetpage") setTimeout(() => { const p = document.querySelector("#ltPager"); if (p) p.scrollTop = p.clientHeight; }, 60);
}
