"use strict";
// Ranking your colors without a tournament (lane L23). Six quick ways; each one only produces pairwise evidence that
// js/prefmodel.js folds into ONE preference score per color (per context: anything, a room, to wear, to paint with,
// a logo). The next question is always the one that teaches the most; the meter under the header is the chance each pair
// of your colors is the right way round, and a session ends when the order settles or you say so.
//   frStart(method, ctx)  method: bws | tiers | swipe | budget | order | context     ctx: all | room | wear | paint | logo
// All of these judge color, so they sit on the viewing-booth grey (css/favs.css, like the decks and drills).

const FR_RUN = () => ({ bws: frBws, tiers: frTiers, swipe: frSwipe, budget: frBudget, order: frOrder, context: frContext });
function frStart(method, ctx = "all") {
  if (fvCount() < 3) { toast("Heart at least 3 colors to rank them"); return favShelf(); }
  (FR_RUN()[method] || frBws)(ctx || "all");
}
const frNm = k => esc((fvStore()[k] || {}).n || k);
const frPlate = (k, cls = "") => `<button class="fv-p ${cls}" data-k="${k}" data-ink="${ink(k)}" style="--c:${k}"><span class="fv-heart">${FV_HEART_ON}</span><b>${frNm(k)}</b></button>`;
const frAsk = ctx => FV_CTX_ASK[ctx] ? `Thinking of colors ${FV_CTX_ASK[ctx]}.` : "";
const frPct = c => Math.round(c * 100);

// the frame every method shares: close, a title, Done, and the one progress element (how settled your order is)
function frShell(o) {
  const el = show(`
    <header class="fv-rh"><button class="icon-btn" data-close aria-label="Close">${ICON.x}</button><div class="fv-rt"><b>${esc(o.title)}</b>${FV_CTX_ASK[o.ctx] ? `<small>${esc(FV_CTX_ASK[o.ctx])}</small>` : ""}</div>
      ${o.noDone ? `<span style="width:44px"></span>` : `<button class="fv-done" data-done>Done</button>`}</header>
    <div class="fv-meter" aria-hidden="true"><i></i></div><p class="fv-meter-t" id="frMT"></p>
    ${o.body}`, "fixed fv-run " + (o.cls || ""));
  const leave = o.onDone || (() => favShelf());
  el.querySelector("[data-close]").onclick = () => favShelf();
  const d = el.querySelector("[data-done]"); if (d) d.onclick = leave;
  const keyFn = o.onKey;
  onKey = e => { if (e.key === "Escape") return favShelf(); if (keyFn) keyFn(e); };
  const meter = el.querySelector(".fv-meter i"), mt = el.querySelector("#frMT");
  const setConf = () => {
    const c = fvConf(o.ctx), seen = fvChoices(o.ctx);
    meter.style.width = frPct(c) + "%";
    mt.innerHTML = seen ? `Your order is <b class="mono">${frPct(c)}%</b> settled` : `Your order starts here`;
    return c;
  };
  setConf();
  return { el, setConf };
}

// ---------- the end of a session ----------
function frSettle(o) {
  const ctx = o.ctx, after = fvOrder(ctx), conf = fvConf(ctx), c0 = o.before.conf, keys = after, settled = conf >= .8;
  fvEmit("rank", { method: o.name, ctx, choices: fvChoices(ctx), confidence: Math.round(conf * 100) });
  let mover = null;
  if (o.before.ranked && keys.length >= 5) keys.forEach((k, i) => { const j = o.before.order.indexOf(k); if (j >= 0) { const d = j - i; if (!mover || Math.abs(d) > Math.abs(mover.d)) mover = { k, d }; } });
  const moved = mover && Math.abs(mover.d) >= 2 ? `${frNm(mover.k)} moved ${mover.d > 0 ? "up" : "down"} ${Math.abs(mover.d)} places.` : "";
  const top = after.slice(0, 3), topWas = o.before.order.slice(0, 3).join() === top.join();
  const el = show(`
    <header class="fv-rh"><button class="icon-btn" data-close aria-label="Close">${ICON.x}</button><div class="fv-rt"><b>${esc(o.name)}</b>${FV_CTX_ASK[ctx] ? `<small>${esc(FV_CTX_ASK[ctx])}</small>` : ""}</div><span style="width:44px"></span></header>
    <div class="fv-end">
      <h1 class="title-1">${settled ? "Your order has <em>settled</em>" : conf > c0 + .05 ? "Sharper <em>now</em>" : "Good <em>start</em>"}</h1>
      <p class="note">${top.length >= 3 && o.before.ranked ? (topWas ? "Your top three held." : "Your top three changed.") : "Here is your top three."}</p>
      <div class="fv-end-top">${top.map((k, i) => `<button class="fv-p" data-swatch="${k}" data-ink="${ink(k)}" style="--c:${k};--k:${i}"><em>${i + 1}</em><b>${frNm(k)}</b></button>`).join("")}</div>
      ${moved ? `<p class="fv-moved">${moved}</p>` : ""}
      <div class="fv-delta"><div class="fv-meter"><i style="width:${frPct(c0)}%"></i></div>
        <p>${c0 && frPct(c0) !== frPct(conf) ? `<span class="mono">${frPct(c0)}%</span> to ` : ""}<b class="mono">${frPct(conf)}%</b> settled · ${esc(PREFM.confLabel(conf).toLowerCase())}</p></div>
    </div>
    <div class="fv-end-acts">
      <button class="btn" data-again>${settled ? "See your colors" : "Keep going"} ${ICON.arrow}</button>
      <button class="btn ghost" data-other>${settled ? "Rank another way" : "Try another way"}</button>
    </div>`, "fixed fv-run fv-settle");
  requestAnimationFrame(() => requestAnimationFrame(() => el.querySelector(".fv-delta .fv-meter i").style.width = frPct(conf) + "%"));
  buzz([10, 30, 20]);
  el.querySelector("[data-close]").onclick = () => favShelf();
  el.querySelector("[data-again]").onclick = () => settled ? favShelf() : o.again();
  el.querySelector("[data-other]").onclick = () => favShelf();
  onKey = e => { if (e.key === "Escape") favShelf(); };
}
const frBefore = ctx => ({ order: fvOrder(ctx), conf: fvConf(ctx), ranked: fvChoices(ctx) > 0 });

// ======================================================================
// 1. Best of three
// ======================================================================
function frBws(ctx = "all") {
  const keys = Object.keys(fvStore()), st = fvCtxStore(ctx), maxSets = keys.length <= 4 ? 3 : 12, skip = new Set(), before = frBefore(ctx);
  let sets = 0, tri = null, step = 0, kept = null, busy = false, last = null;
  const { el, setConf } = frShell({ title: "Best of three", ctx, onDone: finish, body: `
    <div class="fv-q"><h2 id="frQ"></h2><p class="note" id="frN"></p></div>
    <div class="fv-tri" id="frTri"></div>
    <div class="fv-foot"><button class="btn ghost" data-undo>Undo</button><button class="btn ghost" data-skip>Skip this set</button></div>`,
    onKey: e => { const i = { "1": 0, "2": 1, "3": 2 }[e.key]; if (i !== undefined && tri) tap(tri[i]); } });
  const Q = el.querySelector("#frQ"), N = el.querySelector("#frN"), box = el.querySelector("#frTri"), undo = el.querySelector("[data-undo]");
  const say = () => {
    Q.textContent = step ? "Now drop one" : "Keep your favorite";
    N.textContent = step ? "The one you like least. Two taps order all three." : (frAsk(ctx) || "Go with your gut.");
  };
  function finish() { frSettle({ name: "Best of three", ctx, before, again: () => frBws(ctx) }); }
  function next(again) {
    if (!again && sets >= maxSets) return finish();
    if (!again) tri = sets % 3 === 2 && fvChoices(ctx) > 6 ? PREFM.easyTriple(st, keys, {}) : PREFM.nextTriple(st, keys, { skip });   // every third set is a breather
    step = 0; kept = null; busy = false; say();
    box.innerHTML = tri.map(k => frPlate(k)).join("");
    box.querySelectorAll(".fv-p").forEach((p, i) => { p.style.animationDelay = i * 55 + "ms"; p.classList.add("in"); });
    undo.disabled = !last;
  }
  function tap(k) {
    if (busy || !tri.includes(k)) return;
    const plates = [...box.children], by = kk => plates.find(p => p.dataset.k === kk);
    if (step === 0) {
      kept = k; step = 1; buzz(8);
      plates.forEach(p => p.classList.toggle("kept", p.dataset.k === k));
      box.classList.add("choosing"); say(); return;
    }
    if (k === kept) { step = 0; kept = null; box.classList.remove("choosing"); plates.forEach(p => p.classList.remove("kept")); buzz(4); say(); return; }
    busy = true; buzz(6);
    const snap = PREFM.snap(st, tri);
    PREFM.applyPairs(st, PREFM.bwsPairs(tri, kept, k)); fvCmp(ctx, 2); save();
    last = { snap, tri: tri.slice() }; sets++;
    by(k).classList.add("out");
    box.classList.remove("choosing");
    const c = setConf();
    later(() => { if (c >= .85 && sets >= 4) return finish(); next(); }, reduceMotion ? 80 : 420);
  }
  box.addEventListener("click", e => { const p = e.target.closest(".fv-p"); if (p) tap(p.dataset.k); });
  undo.onclick = () => { if (!last || busy) return; PREFM.restore(st, last.snap); fvCmp(ctx, -2); save(); tri = last.tri; last = null; sets--; setConf(); next(true); buzz(4); };
  el.querySelector("[data-skip]").onclick = () => { if (busy) return; for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) skip.add(PREFM.pairId(tri[i], tri[j])); buzz(4); next(); };
  next();
}

// ======================================================================
// 2. Tier board
// ======================================================================
const FR_TIERS = ["Love", "Like", "Fine"];
function frTiers(ctx = "all") {
  const keys = Object.keys(fvStore()), st = fvCtxStore(ctx), before = frBefore(ctx), BATCH = 12;
  // the least-known colors first
  let queue = keys.slice().sort((a, b) => (st[a] ? st[a][2] : 0) - (st[b] ? st[b][2] : 0) || Math.random() - .5);
  const placed = {}, snaps = {};
  let batch = [], batchNo = 0, sel = null, placedN = 0;
  const { el, setConf } = frShell({ title: "Tier board", ctx, onDone: finish, body: `
    <div class="fv-tb" id="frTB">${FR_TIERS.map((t, i) => `<section class="fv-tier" data-t="${i}"><div class="fv-tier-h"><b>${t}</b><span class="mono" data-n>0</span></div><div class="fv-tier-in"></div></section>`).join("")}</div>
    <div class="fv-tray"><p class="note" id="frTN"></p><div class="fv-chips" id="frChips"></div></div>
    <div class="fv-foot fv-foot-one"><button class="btn" data-next hidden>Next</button></div>` });
  const tiers = [...el.querySelectorAll(".fv-tier")], chips = el.querySelector("#frChips"), tn = el.querySelector("#frTN"), nextBtn = el.querySelector("[data-next]");
  function finish() { frSettle({ name: "Tier board", ctx, before, again: () => frTiers(ctx) }); }
  function loadBatch() {
    batch = queue.splice(0, BATCH); batchNo++; sel = null;
    chips.innerHTML = batch.map((k, i) => `<button class="fv-chip" data-k="${k}" style="--k:${i}"><i style="--c:${k}"></i><b>${frNm(k)}</b></button>`).join("");
    nextBtn.hidden = true; say();
  }
  const say = () => { const left = chips.querySelectorAll(".fv-chip").length; tn.textContent = left ? (sel ? "Now tap a tier." : "Drag each color to a tier, or tap it, then tap a tier.") : ""; };
  const count = () => tiers.forEach(t => t.querySelector("[data-n]").textContent = t.querySelectorAll(".fv-dot").length);
  function place(k, level) {
    const chip = chips.querySelector(`[data-k="${k}"]`); if (!chip) return;
    if (!snaps[k]) snaps[k] = PREFM.snap(st, [k]);
    PREFM.tierRate(st, k, level); placed[k] = level; fvCmp(ctx, 1); save(); placedN++;
    chip.classList.add("gone"); setTimeout(() => chip.remove(), reduceMotion ? 0 : 220);
    const dot = document.createElement("button"); dot.className = "fv-dot"; dot.dataset.k = k; dot.style.setProperty("--c", k); dot.setAttribute("aria-label", `${fvStore()[k].n}, ${FR_TIERS[level]}. Tap to take it back.`);
    tiers[level].querySelector(".fv-tier-in").appendChild(dot);
    sel = null; buzz(8); count(); setConf();
    later(() => { say(); if (!chips.querySelector(".fv-chip")) endBatch(); }, reduceMotion ? 10 : 240);
  }
  function endBatch() {
    nextBtn.hidden = false;
    nextBtn.firstChild.textContent = queue.length ? `Next ${Math.min(BATCH, queue.length)}` : "Done";
    nextBtn.dataset.mode = queue.length ? "next" : "done";
  }
  nextBtn.onclick = () => { if (nextBtn.dataset.mode === "done") return finish(); tiers.forEach(t => t.querySelector(".fv-tier-in").innerHTML = ""); count(); loadBatch(); };
  // a dot back to the tray
  tiers.forEach(t => t.addEventListener("click", e => {
    const d = e.target.closest(".fv-dot");
    if (d) {
      const k = d.dataset.k; PREFM.restore(st, snaps[k]); delete snaps[k]; delete placed[k]; fvCmp(ctx, -1); save(); d.remove(); count(); setConf(); buzz(4);
      chips.insertAdjacentHTML("beforeend", `<button class="fv-chip" data-k="${k}"><i style="--c:${k}"></i><b>${frNm(k)}</b></button>`); nextBtn.hidden = true; say(); return;
    }
    if (sel) place(sel, +t.dataset.t);
  }));
  // drag a chip, or tap it and then tap a tier
  let drag = null;
  chips.addEventListener("pointerdown", e => {
    const chip = e.target.closest(".fv-chip"); if (!chip) return;
    drag = { chip, x: e.clientX, y: e.clientY, moved: false, id: e.pointerId, ghost: null }; try { chip.setPointerCapture(e.pointerId); } catch (er) {}
  });
  chips.addEventListener("pointermove", e => {
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 7) {
      drag.moved = true; drag.chip.classList.add("lift"); buzz(4);
      const g = document.createElement("i"); g.className = "fv-ghost"; g.style.setProperty("--c", drag.chip.dataset.k); document.body.appendChild(g); drag.ghost = g;
    }
    if (!drag.moved) return;
    drag.ghost.style.transform = `translate(${e.clientX - 34}px,${e.clientY - 44}px) scale(1.1)`;
    const over = tiers.find(t => { const r = t.getBoundingClientRect(); return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom; });
    tiers.forEach(t => t.classList.toggle("over", t === over));
  });
  const endDrag = e => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag; drag = null; tiers.forEach(t => t.classList.remove("over"));
    if (d.ghost) d.ghost.remove(); d.chip.classList.remove("lift");
    const k = d.chip.dataset.k;
    if (d.moved) {
      const r = tiers.findIndex(t => { const b = t.getBoundingClientRect(); return e.clientX >= b.left && e.clientX <= b.right && e.clientY >= b.top && e.clientY <= b.bottom; });
      if (r >= 0 && e.type === "pointerup") place(k, r);
      return;
    }
    if (e.type !== "pointerup") return;
    chips.querySelectorAll(".fv-chip").forEach(c => c.classList.toggle("sel", c === d.chip && sel !== k));
    sel = sel === k ? null : k; buzz(4); say();
  };
  chips.addEventListener("pointerup", endDrag); chips.addEventListener("pointercancel", endDrag);
  loadBatch();
}

// ======================================================================
// 3. Swipe stack
// ======================================================================
function frSwipe(ctx = "all") {
  const keys = Object.keys(fvStore()), st = fvCtxStore(ctx), before = frBefore(ctx);
  // the colors you've said the least about come first
  let queue = keys.slice().sort((a, b) => (st[b] ? st[b][1] : PREFM.V0) - (st[a] ? st[a][1] : PREFM.V0) + (Math.random() - .5) * .4).slice(0, 16);
  const total = queue.length; let busy = false, liked = 0, done = 0;
  const { el, setConf } = frShell({ title: "Swipe stack", ctx, onDone: finish, body: `
    <div class="fv-stage" id="frSt"></div>
    <div class="fv-foot fv-acts"><div class="act-wrap"><button class="act no" data-no aria-label="Skip">${ICON.xBig}</button><span>Skip</span></div><div class="act-wrap"><button class="act yes" data-yes aria-label="Like">${FV_HEART_ON}</button><span>Like</span></div></div>`,
    onKey: e => { if (e.key === "ArrowRight") fly(true); if (e.key === "ArrowLeft") fly(false); } });
  const stage = el.querySelector("#frSt");
  function finish() { frSettle({ name: "Swipe stack", ctx, before, again: () => frSwipe(ctx) }); }
  const card = (k, back) => { const d = document.createElement("div"); d.className = "fv-card" + (back ? " back" : ""); d.dataset.k = k; d.dataset.ink = ink(k); d.style.setProperty("--c", k);
    d.innerHTML = `<div class="fv-card-n"><b>${frNm(k)}</b></div><span class="fv-stamp yes">${FV_HEART_ON}Like</span><span class="fv-stamp no">${ICON.xS}Skip</span>`; return d; };
  let cur = null, nxt = null;
  function mount() {
    if (!queue.length && !cur) return finish();
    cur = nxt || card(queue.shift()); cur.classList.remove("back"); stage.appendChild(cur);
    nxt = queue.length ? card(queue[0], true) : null; if (nxt) { queue.shift(); stage.insertBefore(nxt, cur); }
    bind(cur); busy = false;
  }
  function fly(like) {
    if (busy || !cur) return; busy = true;
    const c = cur; cur = null; const k = c.dataset.k;
    PREFM.swipeRate(st, k, like); fvCmp(ctx, 1); save(); done++; if (like) liked++;
    buzz(like ? 8 : 5); c.classList.add(like ? "yes" : "no");
    const dx = (like ? 1 : -1) * (innerWidth * 1.1);
    c.style.transition = reduceMotion ? "none" : "transform .34s cubic-bezier(.3,0,.8,.3), opacity .34s"; c.style.transform = `translate(${dx}px,${-30}px) rotate(${like ? 14 : -14}deg)`; c.style.opacity = "0";
    setConf();
    later(() => { c.remove(); if (!nxt) return finish(); mount(); }, reduceMotion ? 60 : 300);
  }
  function bind(c) {
    let sx = 0, sy = 0, dx = 0, id = null;
    c.addEventListener("pointerdown", e => { if (busy || id !== null) return; id = e.pointerId; c.setPointerCapture(id); sx = e.clientX; sy = e.clientY; dx = 0; c.style.transition = "none"; });
    c.addEventListener("pointermove", e => {
      if (e.pointerId !== id) return; dx = e.clientX - sx;
      c.style.transform = `translate(${dx}px,${(e.clientY - sy) * .25}px) rotate(${dx * .05}deg)`;
      const a = Math.min(1, Math.abs(dx) / 90); c.style.setProperty("--yes", dx > 0 ? a : 0); c.style.setProperty("--no", dx < 0 ? a : 0);
      if (nxt) nxt.style.transform = `scale(${.94 + .06 * a})`;
    });
    const end = e => {
      if (e.pointerId !== id) return; id = null;
      if (Math.abs(dx) > 90 && e.type === "pointerup") return fly(dx > 0);
      c.style.transition = "transform .3s var(--spring)"; c.style.transform = ""; c.style.setProperty("--yes", 0); c.style.setProperty("--no", 0); if (nxt) nxt.style.transform = "";
    };
    c.addEventListener("pointerup", end); c.addEventListener("pointercancel", end);
  }
  el.querySelector("[data-yes]").onclick = () => fly(true); el.querySelector("[data-no]").onclick = () => fly(false);
  mount();
}

// ======================================================================
// 4. Ten drops
// ======================================================================
function frBudget(ctx = "all") {
  const keys = Object.keys(fvStore()), st = fvCtxStore(ctx), before = frBefore(ctx), TOTAL = 10, SIZE = Math.min(8, keys.length);
  let group = PREFM.neighborhood(st, keys, SIZE), alloc = {}, left = TOTAL, rounds = 0;
  const { el, setConf } = frShell({ title: "Ten drops", ctx, onDone: finish, body: `
    <div class="fv-pot"><div class="fv-pot-n"><b class="display" id="frLeft">10</b><span class="note" id="frLN">drops left</span></div><p class="fv-pot-h" id="frPH">Tap a color to spend a drop on it.</p><div class="fv-drops" id="frPot"></div></div>
    <div class="fv-bgrid" id="frGrid"></div>
    <div class="fv-foot fv-foot-one"><button class="btn" data-go disabled>Spend 10 more</button></div>` });
  const grid = el.querySelector("#frGrid"), pot = el.querySelector("#frPot"), goBtn = el.querySelector("[data-go]"), leftEl = el.querySelector("#frLeft"), ln = el.querySelector("#frLN");
  function finish() { frSettle({ name: "Ten drops", ctx, before, again: () => frBudget(ctx) }); }
  function draw(fresh) {
    if (fresh) { grid.innerHTML = group.map(k => `<div class="fv-bp" data-k="${k}" data-ink="${ink(k)}" style="--c:${k}"><button class="fv-bp-main" data-add="${k}" aria-label="Add a drop to ${esc(fvStore()[k].n)}"><b>${frNm(k)}</b></button><div class="fv-bp-d"></div><button class="fv-bp-m" data-sub="${k}" aria-label="Take a drop off ${esc(fvStore()[k].n)}" hidden>−</button></div>`).join(""); }
    pot.innerHTML = Array.from({ length: TOTAL }, (_, i) => `<i class="${i < left ? "" : "spent"}"></i>`).join("");
    leftEl.textContent = left; ln.textContent = left === 1 ? "drop left" : "drops left";
    grid.querySelectorAll(".fv-bp").forEach(p => { const k = p.dataset.k, n = alloc[k] || 0; p.querySelector(".fv-bp-d").innerHTML = "<i></i>".repeat(n); p.querySelector(".fv-bp-m").hidden = !n; p.classList.toggle("has", n > 0); });
    goBtn.disabled = left > 0; goBtn.firstChild.textContent = left > 0 ? `Spend ${left} more` : "Done";
  }
  function add(k, from) {
    if (left <= 0) { buzz([6, 40, 6]); const p = grid.querySelector(`[data-k="${k}"]`); p.classList.remove("shake"); void p.offsetWidth; p.classList.add("shake"); return; }
    alloc[k] = (alloc[k] || 0) + 1; left--; buzz(left ? 4 : 8);
    // the drop flies from the pot to the color
    const pots = pot.querySelectorAll("i:not(.spent)"), src = pots[pots.length - 1] || pot, tgt = grid.querySelector(`[data-k="${k}"]`);
    if (!reduceMotion && src && tgt) {
      const a = src.getBoundingClientRect(), b = tgt.getBoundingClientRect(), f = document.createElement("i"); f.className = "fv-fly";
      f.style.cssText = `left:${a.left}px;top:${a.top}px`; document.body.appendChild(f);
      f.animate([{ transform: "translate(0,0) scale(1)" }, { transform: `translate(${b.left + b.width / 2 - a.left - 6}px,${b.top + b.height / 2 - a.top - 6}px) scale(1.7)`, opacity: .9 }], { duration: 260, easing: "cubic-bezier(.3,0,.2,1)" }).onfinish = () => { f.remove(); tgt.classList.remove("pulse"); void tgt.offsetWidth; tgt.classList.add("pulse"); };
    }
    draw();
  }
  grid.addEventListener("click", e => {
    const a = e.target.closest("[data-add]"), s = e.target.closest("[data-sub]");
    if (a) add(a.dataset.add);
    if (s && alloc[s.dataset.sub]) { alloc[s.dataset.sub]--; left++; buzz(4); draw(); }
  });
  goBtn.onclick = () => {
    if (left > 0) return;
    const snapKeys = group.slice();
    PREFM.applyPairs(st, PREFM.budgetPairs(group.reduce((o, k) => (o[k] = alloc[k] || 0, o), {}))); fvCmp(ctx, Math.max(2, group.length - 1)); save(); rounds++;
    setConf(); buzz([10, 30, 20]);
    finish();
  };
  draw(true);
}

// ======================================================================
// 5. Drag to order
// ======================================================================
function frOrder(ctx = "all") {
  const keys = Object.keys(fvStore()), st = fvCtxStore(ctx), before = frBefore(ctx);
  let list = PREFM.neighborhood(st, keys, Math.min(10, keys.length));
  if (!fvChoices(ctx)) list = list.slice().sort(() => Math.random() - .5);   // nothing known yet: a random order to fix
  const { el, setConf } = frShell({ title: "Drag to order", ctx, onDone: () => commit(), body: `
    <div class="fv-q fv-q-tight"><h2>Best on top</h2><p class="note">${esc(frAsk(ctx) || "Hold a color and drag it to where it belongs.")}</p></div>
    <div class="fv-ord" id="frOrd"></div>
    <div class="fv-foot fv-foot-one"><button class="btn" data-go>That's my order ${ICON.arrow}</button></div>` });
  const box = el.querySelector("#frOrd");
  const row = (k, i) => `<div class="fv-or" data-k="${k}" data-ink="${ink(k)}" style="--c:${k}"><span class="mono">${i + 1}</span><b>${frNm(k)}</b><i aria-hidden="true">${sv('<path d="M5 9h14M5 15h14"/>', 22, 1.8)}</i></div>`;
  box.innerHTML = list.map(row).join("");
  const rows = () => [...box.children];
  const renum = () => rows().forEach((r, i) => r.firstChild.textContent = i + 1);
  let drag = null;
  box.addEventListener("pointerdown", e => {
    const r = e.target.closest(".fv-or"); if (!r) return;
    const rs = rows(), h = r.offsetHeight, gap = parseFloat(getComputedStyle(box).rowGap) || 0;
    drag = { r, i: rs.indexOf(r), at: rs.indexOf(r), y: e.clientY, id: e.pointerId, step: h + gap, moved: false, n: rs.length };
    try { r.setPointerCapture(e.pointerId); } catch (er) {}
  });
  box.addEventListener("pointermove", e => {
    if (!drag || e.pointerId !== drag.id) return;
    const dy = e.clientY - drag.y;
    if (!drag.moved && Math.abs(dy) > 5) { drag.moved = true; drag.r.classList.add("drag"); buzz(6); }
    if (!drag.moved) return;
    const to = Math.max(0, Math.min(drag.n - 1, Math.round(drag.i + dy / drag.step)));
    drag.r.style.transform = `translateY(${dy}px) scale(1.02)`;
    if (to !== drag.at) { drag.at = to; buzz(4); }
    rows().forEach((r, idx) => { if (r === drag.r) return; let s = 0; if (drag.i < drag.at && idx > drag.i && idx <= drag.at) s = -drag.step; if (drag.i > drag.at && idx < drag.i && idx >= drag.at) s = drag.step; r.style.transform = s ? `translateY(${s}px)` : ""; });
  });
  const end = e => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag; drag = null;
    rows().forEach(r => { r.style.transform = ""; }); d.r.classList.remove("drag");
    if (d.moved && e.type === "pointerup" && d.at !== d.i) { const rs = rows(); box.insertBefore(d.r, d.at > d.i ? rs[d.at].nextSibling : rs[d.at]); renum(); }
  };
  box.addEventListener("pointerup", end); box.addEventListener("pointercancel", end);
  function commit() {
    const order = rows().map(r => r.dataset.k);
    PREFM.applyPairs(st, PREFM.orderPairs(order)); fvCmp(ctx, order.length - 1); save(); setConf();
    frSettle({ name: "Drag to order", ctx, before, again: () => frOrder(ctx) });
  }
  el.querySelector("[data-go]").onclick = commit;
}

// ======================================================================
// 6. What it's for
// ======================================================================
function frScene(id, c) {
  const k = i => c[i % c.length];
  const S_ = {
    room: `<rect width="120" height="84" fill="${k(0)}"/><rect y="58" width="120" height="26" fill="${k(1)}"/><rect x="14" y="34" width="52" height="26" rx="5" fill="${k(2)}"/><rect x="10" y="44" width="10" height="16" rx="3" fill="${k(2)}"/><rect x="60" y="44" width="10" height="16" rx="3" fill="${k(2)}"/><rect x="78" y="14" width="26" height="30" fill="${k(3)}"/><circle cx="106" cy="52" r="7" fill="${k(4)}"/>`,
    wear: `<rect width="120" height="84" fill="${k(1)}"/><path d="M36 14l16-5c3 6 13 6 16 0l16 5 14 16-13 8-5-7v44H40V31l-5 7-13-8z" fill="${k(0)}"/><path d="M40 52h40v8H40z" fill="${k(2)}"/><circle cx="60" cy="26" r="4" fill="${k(3)}"/>`,
    paint: `<rect width="120" height="84" fill="${k(4)}"/><path d="M12 62C30 20 56 78 78 36S104 24 110 18" fill="none" stroke="${k(0)}" stroke-width="13" stroke-linecap="round"/><path d="M16 74C40 52 62 82 100 56" fill="none" stroke="${k(2)}" stroke-width="9" stroke-linecap="round"/><circle cx="92" cy="20" r="7" fill="${k(1)}"/><circle cx="26" cy="22" r="6" fill="${k(3)}"/>`,
    logo: `<rect width="120" height="84" fill="${k(3)}"/><circle cx="48" cy="42" r="26" fill="${k(0)}"/><rect x="52" y="22" width="38" height="38" rx="4" fill="${k(1)}" opacity=".92"/><circle cx="76" cy="52" r="12" fill="${k(2)}"/>`,
  };
  return `<svg viewBox="0 0 120 84" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${S_[id]}</svg>`;
}
function frContext() {
  const top = fvOrder("all").slice(0, 5); const c = top.length ? top : ["#C8553D", "#E0A458", "#3F7C8C", "#5B7F6E", "#2A2620"];
  const el = show(`
    <header class="fv-rh"><button class="icon-btn" data-close aria-label="Close">${ICON.x}</button><div class="fv-rt"><b>What it's for</b></div><span style="width:44px"></span></header>
    <div class="fv-q"><h2>What are you choosing <em>for</em>?</h2><p class="note">The same color can be right for a wall and wrong for a shirt. Each one keeps its own order.</p></div>
    <div class="fv-scenes">${["room", "wear", "paint", "logo"].map(id => { const nme = FV_CTX.find(x => x[0] === id)[1], n = fvChoices(id);
      return `<button class="fv-scene" data-c="${id}">${frScene(id, c)}<b>${nme}</b><small>${n ? `${n} choices so far` : "New"}</small></button>`; }).join("")}</div>`, "fixed fv-run fv-ctx");
  el.querySelector("[data-close]").onclick = () => favShelf();
  onKey = e => { if (e.key === "Escape") favShelf(); };
  el.querySelectorAll("[data-c]").forEach(b => b.onclick = () => { buzz(6); FV_CTX_NOW = b.dataset.c; frBws(b.dataset.c); });
}

// ======================================================================
// screenshot mode: #shot=favs:rank:<bws|bws-kept|tiers|tiers-some|swipe|budget|budget-some|order|context|settle>
// ======================================================================
function frShot(arg = "bws") {
  const fire = (sel, i = 0) => { const els = document.querySelectorAll(sel); if (els[i]) els[i].click(); };
  const tap = (sel, t, i = 0) => later(() => fire(sel, i), t);
  switch (arg) {
    case "bws": return frBws("all");
    case "bws-kept": frBws("all"); return tap(".fv-tri .fv-p", 500, 1);
    case "bws-drop": frBws("all"); tap(".fv-tri .fv-p", 400, 1); return tap(".fv-tri .fv-p", 700, 0);
    case "tiers": return frTiers("all");
    case "tiers-some": frTiers("all"); [0, 1, 2, 3, 4].forEach((_, i) => later(() => { const k = document.querySelector(".fv-chip"); if (k) { const lvl = [0, 0, 1, 1, 2][i], t = document.querySelectorAll(".fv-tier")[lvl]; k.dispatchEvent(new PointerEvent("pointerdown", { pointerId: 3, bubbles: true, clientX: 10, clientY: 10 })); k.dispatchEvent(new PointerEvent("pointerup", { pointerId: 3, bubbles: true, clientX: 10, clientY: 10 })); t.click(); } }, 300 + i * 450)); return;
    case "swipe": return frSwipe("all");
    case "swipe-drag": frSwipe("all"); return later(() => { const c = document.querySelector(".fv-card:not(.back)"); if (c) { c.style.transform = "translate(110px,10px) rotate(6deg)"; c.style.setProperty("--yes", 1); } }, 500);
    case "budget": return frBudget("all");
    case "budget-some": frBudget("all"); return [0, 0, 0, 1, 1, 2, 4].forEach((i, n) => tap("[data-add]", 300 + n * 140, i));
    case "order": return frOrder("all");
    case "context": return frContext();
    case "settle": { const before = frBefore("all"); const st = fvCtxStore("all"), ks = Object.keys(fvStore()); PREFM.applyPairs(st, PREFM.orderPairs(ks.slice().reverse().slice(0, 8))); fvCmp("all", 8); return frSettle({ name: "Best of three", ctx: "all", before, again: () => {} }); }
  }
}
