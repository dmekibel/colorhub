"use strict";
// Name it / Find it (design/IMPROVE-2026-10-08/PLAN.md, Wave 1a Lane A): guess the colors of any thing before
// you're told. One reusable component, built first for the painting page (js/gallery.js), later for Today's
// painting, garments, looks and photos. Three rounds:
//   Name it (x2): a place in the picture is lit and you pick its name from three same-family names.
//   Find it (x1): a name is shown and you tap where it lives in the picture (the color mask below, 1 cell of slack).
// Recall before reveal: no name shows until you've answered. Every answer goes to the Learner Model (learnerLog,
// js/learner.js) with the names, a miss as a mix-up too. The end offers "Learn this painting's colors" (prQuick).
//
// thingQuiz(host, o) draws one quiet "Name its colors" button into host (never forced) and returns { open }.
// thingQuizOpen(o) opens the quiz directly. o:
//   img     an <img>/<canvas> (or a function returning one); its pixels are read when the host allows it
//   crop    [left, top, right, bottom] in thousandths of the photo (tools/crop_paintings.py), or null
//   colors  [{ h, share }] the colors to ask about, best first (the painting page's "stands out" palette)
//   pool    [{ h, share }] every color of the thing (labels the picture's cells); defaults to colors
//   regions optional precomputed { [hex]: { cx, cy } } (0..1) when the picture can't be read
//   title   the thing's name ("Helena Tromper Du Bois"); kind: "painting" | "garment" | …; src: its address
//   learn   optional { items, label, src, route } for the end's Learn button (defaults from colors + title)
// When the picture can't be read (a museum without CORS), Find it is skipped and Name it shows the swatch alone.

const TQ_GRID = 40;        // cells on the picture's long side for the color mask
const TQ_ROUNDS = 3;
const TQ_FIND_MIN = .02;   // a Find it color must cover 2%+ of the picture, in one confident place

function thingQuiz(host, o = {}) {
  if (!host) return null;
  const b = document.createElement("button");
  b.className = "tq-open"; b.type = "button";
  b.innerHTML = `<span class="tq-open-dots">${(o.colors || []).slice(0, 3).map(c => `<i style="--c:${c.h}"></i>`).join("")}</span><span>${esc(o.label || "Name its colors")}</span>`;
  b.onclick = () => { buzz(5); thingQuizOpen(o); };
  host.appendChild(b);
  return { open: () => thingQuizOpen(o), el: b };
}

// ---------- the picture: a readable canvas of the (cropped) thing, and its color mask ----------
function tqBase(o) {
  const src = typeof o.img === "function" ? o.img() : o.img;
  const sw = src && (src.naturalWidth || src.width), sh = src && (src.naturalHeight || src.height);
  if (!sw || !sh) return null;
  const c = o.crop && o.crop.length === 4 ? o.crop.map(v => v / 1000) : [0, 0, 1, 1];
  const cw = c[2] - c[0], ch = c[3] - c[1], use = cw > .05 && ch > .05;
  const sx = use ? c[0] * sw : 0, sy = use ? c[1] * sh : 0, w0 = use ? cw * sw : sw, h0 = use ? ch * sh : sh;
  const k = Math.min(1, 1000 / Math.max(w0, h0)), base = document.createElement("canvas");
  base.width = Math.max(1, Math.round(w0 * k)); base.height = Math.max(1, Math.round(h0 * k));
  const bx = base.getContext("2d", { willReadFrequently: true });
  try { bx.drawImage(src, sx, sy, w0, h0, 0, 0, base.width, base.height); } catch (e) { return null; }
  let readable = true; try { bx.getImageData(0, 0, 1, 1); } catch (e) { readable = false; }
  return { base, readable };
}
// The mask: the picture as a TQ_GRID-cell grid (each cell averaged in linear light), every cell labelled with the
// nearest color of the thing's pool. A color "lives" in the cells labelled with it, or within 6% of it.
function tqMask(base, pool) {
  const W = base.width, H = base.height, s = TQ_GRID / Math.max(W, H), gw = Math.max(2, Math.round(W * s)), gh = Math.max(2, Math.round(H * s));
  const k = 4, c = document.createElement("canvas"); c.width = gw * k; c.height = gh * k;
  const cx = c.getContext("2d", { willReadFrequently: true }); cx.imageSmoothingQuality = "high"; cx.drawImage(base, 0, 0, c.width, c.height);
  const d = cx.getImageData(0, 0, c.width, c.height).data, L8 = v => { v /= 255; return v > .04045 ? ((v + .055) / 1.055) ** 2.4 : v / 12.92; };
  const enc = v => Math.round(clamp(v > .0031308 ? 1.055 * v ** (1 / 2.4) - .055 : 12.92 * v, 0, 1) * 255);
  const cells = [], P = pool.map(p => ({ h: p.h, lab: lab(p.h) }));
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
    let r = 0, g = 0, b = 0;
    for (let yy = 0; yy < k; yy++) for (let xx = 0; xx < k; xx++) { const p = ((y * k + yy) * c.width + x * k + xx) * 4; r += L8(d[p]); g += L8(d[p + 1]); b += L8(d[p + 2]); }
    const n = k * k, hex = "#" + [r, g, b].map(v => enc(v / n).toString(16).padStart(2, "0")).join("").toUpperCase(), L = lab(hex);
    let best = -1, bd = Infinity; P.forEach((p, j) => { const dd = de2000(L, p.lab); if (dd < bd) { bd = dd; best = j; } });
    cells.push({ hex, lab: L, near: best, de: bd });
  }
  return { gw, gh, cells, P };
}
// where one color lives: its cells, its biggest connected place, and a calm point inside that place for the ring
function tqWhere(mask, hex) {
  const { gw, gh, cells, P } = mask, t = lab(hex), j = P.findIndex(p => p.h === hex);
  const on = cells.map(c => (c.near === j && c.de < 14) || de2000(c.lab, t) < 6 ? 1 : 0);
  const n = on.reduce((a, v) => a + v, 0);
  const seen = new Int16Array(on.length).fill(-1); let best = null;
  for (let s = 0; s < on.length; s++) {
    if (!on[s] || seen[s] >= 0) continue;
    const q = [s]; seen[s] = s;
    for (let i = 0; i < q.length; i++) { const p = q[i], x = p % gw, y = (p / gw) | 0; [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => { const X = x + dx, Y = y + dy, r = Y * gw + X; if (X >= 0 && Y >= 0 && X < gw && Y < gh && on[r] && seen[r] < 0) { seen[r] = s; q.push(r); } }); }
    if (!best || q.length > best.length) best = q;
  }
  let spot = null;
  if (best) {   // the cell of the biggest place with the most of the color around it (so the ring sits inside, not on an edge)
    let bs = -1;
    best.forEach(p => { const x = p % gw, y = (p / gw) | 0; let s = 0; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < gw && Y < gh && on[Y * gw + X]) s++; } if (s > bs) { bs = s; spot = { cx: (x + .5) / gw, cy: (y + .5) / gh }; } });
  }
  return { on, share: n / on.length, place: best ? best.length / on.length : 0, spot };
}
// is the cell under (fx, fy), or one next to it, where this color lives? (the plan's 1-cell tolerance)
function tqHit(mask, where, fx, fy) {
  const { gw, gh } = mask, x = Math.min(gw - 1, Math.max(0, Math.floor(fx * gw))), y = Math.min(gh - 1, Math.max(0, Math.floor(fy * gh)));
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < gw && Y < gh && where.on[Y * gw + X]) return { ok: true, cell: mask.cells[y * gw + x] }; }
  return { ok: false, cell: mask.cells[y * gw + x] };
}

// ---------- the questions ----------
// three names for one color: the truth and two same-family neighbours you could mistake it for (5 to 16 apart,
// at least 4 apart from each other), never an obviously different color.
function tqOptions(truth) {
  const list = (typeof CORE_NAMES !== "undefined" && CORE_NAMES) || coreFallback(), near = nearestCore(truth.h, list, 40);
  const fam = h => { const f = typeof familyOf === "function" ? familyOf(h) : null; return f && f.head ? f.head.n : ""; }, tf = fam(truth.h);
  const out = [{ n: truth.n, h: truth.h, ok: true }];
  const apart = x => out.every(o => de2000(lab(x.h), lab(o.h)) >= 4);
  const tiers = [near.filter(x => x.de >= 5 && x.de <= 16 && fam(x.h) === tf), near.filter(x => x.de >= 5 && x.de <= 16), near.filter(x => x.de >= 3 && x.de <= 24)];
  for (const tier of tiers) for (const x of tier) { if (out.length >= 3) break; if (!out.some(o => o.n === x.n) && apart(x)) out.push({ n: x.n, h: x.h, ok: false }); }
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}
// the rounds: two Name it and one Find it (last, as the payoff), from the best colors that have an honest name
function tqPlan(o, mask, skip = new Set()) {
  const seen = new Set(), cand = [];
  (o.colors || []).forEach(c => {
    const nm = nameOf(c.h);
    if (!nm.n || nm.de >= NEAR_DE || seen.has(nm.n) || skip.has(nm.n)) return;
    seen.add(nm.n);
    const where = mask ? tqWhere(mask, c.h) : null;
    if (mask && (!where.spot || where.place < .004)) return;   // nowhere confident to point at
    cand.push({ h: c.h, share: c.share, n: nm.n, nh: nm.h, where });
  });
  const rounds = [];
  const find = mask ? cand.find(c => c.where.share >= TQ_FIND_MIN && c.where.place >= TQ_FIND_MIN * .5) : null;
  cand.filter(c => c !== find).slice(0, find ? TQ_ROUNDS - 1 : TQ_ROUNDS).forEach(c => rounds.push({ kind: "name", c }));
  if (find) rounds.push({ kind: "find", c: find });
  return { rounds, left: cand.filter(c => !rounds.some(r => r.c === c)).length };
}

// ---------- the overlay ----------
function thingQuizOpen(o = {}) {
  if (typeof CORE_NAMES !== "undefined" && !CORE_NAMES && typeof loadCoreNames === "function") return void loadCoreNames().then(() => thingQuizOpen(o), () => thingQuizOpen(o));
  const pic = tqBase(o);
  if (!pic) return toast("The picture isn't ready yet");
  const pool = (o.pool && o.pool.length ? o.pool : o.colors || []).filter(p => p && p.h).map(p => ({ h: p.h.toUpperCase(), share: p.share }));
  o = { ...o, colors: (o.colors || []).map(c => ({ ...c, h: c.h.toUpperCase() })) };
  o.colors.forEach(c => { if (!pool.some(p => p.h === c.h)) pool.push({ h: c.h, share: c.share }); });
  let mask = null;
  if (pic.readable) { try { mask = tqMask(pic.base, pool); } catch (e) { mask = null; } }
  let plan = tqPlan(o, mask);
  if (!plan.rounds.length) return toast("Nothing here is clear enough to ask about");
  const kind = o.kind || "painting", from = String(kind).slice(0, 24);
  const asked = new Set(plan.rounds.map(r => r.c.n));
  let k = 0, results = [], t0 = 0, state = "ask", closed = false, FW = 0, FH = 0;
  const root = document.createElement("div");
  root.className = "tq"; root.setAttribute("role", "dialog"); root.setAttribute("aria-label", "Name its colors");
  root.innerHTML = `
    <div class="tq-top"><button class="icon-btn" data-tq-close aria-label="Close">${ICON.x}</button><span class="tq-dots" aria-hidden="true"></span><span class="tq-count" data-tq-count></span></div>
    <div class="tq-stage"><div class="tq-frame"><canvas class="tq-img"></canvas><canvas class="tq-veil"></canvas><i class="tq-ring"></i><i class="tq-tap"></i></div></div>
    <div class="tq-card" aria-live="polite"></div>`;
  document.body.appendChild(root);
  lockScroll();
  const $ = s => root.querySelector(s), stage = $(".tq-stage"), frame = $(".tq-frame"), img = $(".tq-img"), veil = $(".tq-veil"), ring = $(".tq-ring"), tapDot = $(".tq-tap"), card = $(".tq-card");
  img.width = pic.base.width; img.height = pic.base.height; img.getContext("2d").drawImage(pic.base, 0, 0);
  const onKey = e => { if (e.key === "Escape") close(); };
  const close = () => { if (closed) return; closed = true; removeEventListener("resize", fit); if (ro) ro.disconnect(); document.removeEventListener("keydown", onKey); root.remove(); unlockScroll(); };
  if (typeof cleanup !== "undefined") cleanup.push(close);
  document.addEventListener("keydown", onKey);
  $("[data-tq-close]").onclick = close;
  function fit() {
    const cs = getComputedStyle(stage), W = stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight), H = stage.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    if (!(W > 0 && H > 0)) return;
    const s = Math.min(W / img.width, H / img.height); FW = Math.round(img.width * s); FH = Math.round(img.height * s);
    frame.style.width = FW + "px"; frame.style.height = FH + "px";
    placeRing();
  }
  const ro = typeof ResizeObserver === "function" ? new ResizeObserver(fit) : null;
  if (ro) ro.observe(stage); else addEventListener("resize", fit);
  // the veil: everything that isn't this color dims, so every place it lives glows at once (soft-edged: the grid is scaled up smoothly)
  const showVeil = where => {
    if (!mask || !where) { veil.classList.remove("on"); return; }
    veil.width = mask.gw; veil.height = mask.gh;
    const vx = veil.getContext("2d"), id = vx.createImageData(mask.gw, mask.gh);
    where.on.forEach((v, p) => { id.data[p * 4] = 10; id.data[p * 4 + 1] = 9; id.data[p * 4 + 2] = 8; id.data[p * 4 + 3] = v ? 0 : 175; });
    vx.putImageData(id, 0, 0); veil.classList.add("on");
  };
  let ringAt = null;
  function placeRing() {
    if (!ringAt) { ring.classList.remove("on"); return; }
    const D = Math.max(40, Math.min(FW, FH) * .14);
    ring.style.left = ringAt.cx * FW + "px"; ring.style.top = ringAt.cy * FH + "px"; ring.style.width = ring.style.height = D + "px";
    ring.classList.add("on");
  }
  const dots = () => { $(".tq-dots").innerHTML = plan.rounds.map((r, i) => `<i class="${i < results.length ? (results[i].ok ? "ok" : "no") : i === k ? "cur" : ""}"></i>`).join(""); $("[data-tq-count]").textContent = k < plan.rounds.length ? `${k + 1} of ${plan.rounds.length}` : ""; };
  const pct = s => s >= .01 ? Math.round(s * 100) + "%" : "under 1%";

  function ask() {
    state = "ask"; const r = plan.rounds[k]; t0 = performance.now();
    root.classList.toggle("finding", r.kind === "find"); root.classList.remove("ended");
    tapDot.classList.remove("on", "ok", "no"); dots();
    const first = !(S.thingQuiz && S.thingQuiz.n) && k === 0;
    if (r.kind === "name") {
      ringAt = r.c.where ? r.c.where.spot : null; placeRing(); showVeil(r.c.where);
      r.opts = tqOptions({ n: r.c.n, h: r.c.nh });
      card.innerHTML = `${first ? `<p class="tq-first">Guess first, then see. Three questions.</p>` : ""}
        <div class="tq-qrow">${mask ? "" : `<i class="tq-sw" style="--c:${r.c.h}"></i>`}<h2 class="tq-q">${mask ? "What would you call the lit color?" : "What would you call this color?"}</h2></div>
        <div class="tq-opts">${r.opts.map((x, i) => `<button data-opt="${i}">${esc(x.n)}</button>`).join("")}</div>
        <button class="tq-skip" data-skip>Show me</button>`;
      card.querySelectorAll("[data-opt]").forEach(b => b.onclick = () => answer(+b.dataset.opt));
    } else {
      ringAt = null; placeRing(); showVeil(null);
      card.innerHTML = `${first ? `<p class="tq-first">Guess first, then see. Three questions.</p>` : ""}
        <h2 class="tq-q">Tap where you see <em>${esc(r.c.n.toLowerCase())}</em></h2>
        <p class="tq-hint">Anywhere it lives in the picture counts.</p>
        <button class="tq-skip" data-skip>Show me</button>`;
    }
    card.querySelector("[data-skip]").onclick = () => answer(-1);
  }
  frame.addEventListener("click", e => {
    if (state !== "ask" || plan.rounds[k].kind !== "find" || !mask) return;
    const r = frame.getBoundingClientRect(), fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
    if (fx < 0 || fy < 0 || fx > 1 || fy > 1) return;
    tapDot.style.left = fx * FW + "px"; tapDot.style.top = fy * FH + "px";
    answer(-2, tqHit(mask, plan.rounds[k].c.where, fx, fy));
  });
  // i: the option tapped (-1 = "Show me", -2 = a tap on the picture with its hit)
  function answer(i, hit) {
    if (state !== "ask") return;
    state = "shown";
    const r = plan.rounds[k], c = r.c, ms = Math.round(performance.now() - t0), truth = { n: c.n, h: c.nh };
    let ok = false, said = null;
    if (r.kind === "name" && i >= 0) { ok = !!r.opts[i].ok; said = ok ? null : r.opts[i]; }
    if (r.kind === "find" && hit) { ok = hit.ok; if (!ok) { const tn = nameOf(hit.cell.hex); if (tn.n && tn.n !== c.n) said = { n: tn.n, h: tn.h, tapped: hit.cell.hex }; } }
    const skipped = i === -1;
    results.push({ c, ok, skipped, said, kind: r.kind });
    // the Learner Model (js/learner.js): an answer for the true name, and a mix-up when you named or pointed at something else
    if (typeof learnerLog === "function" && !skipped) {
      learnerLog({ type: "answer", color: truth, ok, by: r.kind === "find" ? "find-it" : "name-it", ms, src: from });
      if (!ok && said) learnerLog({ type: "confuse", color: truth, b: { n: said.n, h: said.h }, src: from });
    }
    buzz(ok ? [8, 30, 8] : skipped ? 5 : 14);
    showVeil(c.where); ringAt = r.kind === "name" && c.where ? c.where.spot : null; placeRing();
    if (r.kind === "find" && hit) tapDot.classList.add("on", ok ? "ok" : "no");
    if (r.kind === "name" && r.opts) card.querySelectorAll("[data-opt]").forEach((b, j) => { b.disabled = true; b.classList.toggle("ok", !!r.opts[j].ok); b.classList.toggle("no", j === i && !r.opts[j].ok); });
    dots();
    const share = c.where ? c.where.share : c.share;
    const diff = said && typeof lookDiff === "function" ? lookDiff({ h: said.h }, { h: c.h }) : "";
    const line = skipped ? `Now you know it.` : ok ? (r.kind === "find" ? "Right where it lives." : "You read it right.")
      : r.kind === "find" ? (said ? `That spot reads closer to ${esc(said.n.toLowerCase())}. It lives where the picture is lit.` : "It lives where the picture is lit.")
      : said ? (diff && diff !== "almost the same" ? `Not ${esc(said.n.toLowerCase())}: next to it, this one is ${esc(diff)}.` : `${esc(said.n)} is almost the same color, but the closer name is ${esc(c.n.toLowerCase())}.`) : "";
    const last = k === plan.rounds.length - 1;
    card.innerHTML = `<div class="tq-res${ok ? " ok" : ""}">
        <button class="tq-big" data-tqsw="${c.h}" style="--c:${c.h}" aria-label="Open ${esc(c.n)}"></button>
        <div><p class="tq-verdict">${skipped ? "It's" : ok ? "Yes, it's" : "It's"}</p><button class="tq-name" data-tqsw="${c.h}">${esc(c.n)}</button>
        <p class="tq-line">${line}</p><p class="tq-meta">About ${pct(share)} of the picture, as photographed</p></div></div>
      <button class="tq-next" data-next>${last ? "See how you did" : "Next"}${ICON.arrow}</button>`;
    card.querySelector("[data-next]").onclick = () => { buzz(4); k++; if (k < plan.rounds.length) ask(); else end(); };
  }
  function end() {
    state = "end"; root.classList.add("ended"); root.classList.remove("finding");
    ringAt = null; placeRing(); showVeil(null); tapDot.classList.remove("on"); dots();
    const right = results.filter(x => x.ok).length, n = results.length;
    S.thingQuiz = S.thingQuiz || { n: 0, ok: 0, q: 0 }; S.thingQuiz.n++; S.thingQuiz.q += n; S.thingQuiz.ok += right;
    try { save(); } catch (e) {}
    const title = right === n ? `All ${n}, first try` : right ? `${right} of ${n} on the first try` : `None this time`;
    const sub = right === n ? "You see this picture's colors clearly." : right ? "The ones you missed are the ones worth learning." : "That's the point of guessing first: now they'll stick.";
    const learnItems = (o.learn && o.learn.items) || (() => { const seen = new Set(), out = []; results.map(x => x.c).concat(o.colors.map(c => ({ h: c.h, n: nameOf(c.h).n }))).forEach(c => { const nm = c.n || nameOf(c.h).n; if (nm && !seen.has(nm) && nameOf(c.h).de < NEAR_DE) { seen.add(nm); out.push(c.h); } }); return out.slice(0, 8); })();
    const more = tqPlan(o, mask, asked);
    card.innerHTML = `<h2 class="tq-q tq-end-t">${esc(title)}</h2><p class="tq-hint">${esc(sub)}</p>
      <div class="tq-sum">${results.map(x => `<button class="tq-row" data-tqsw="${x.c.h}"><i style="--c:${x.c.h}"></i><b>${esc(x.c.n)}</b><span class="${x.ok ? "ok" : "no"}">${x.ok ? ICON.checkS : x.skipped ? "shown" : ICON.xS}</span></button>`).join("")}</div>
      ${typeof prQuick === "function" && learnItems.length ? `<button class="tq-learn" data-learn>${esc(o.learnLabel || `Learn this ${kind}'s colors`)}${ICON.arrow}</button>` : ""}
      <div class="tq-acts">${more.rounds.length >= 2 ? `<button data-again>Three more</button>` : `<span></span>`}<button data-done>Done</button></div>`;
    const lb = card.querySelector("[data-learn]");
    if (lb) lb.onclick = () => { close(); prQuick({ items: learnItems, label: (o.learn && o.learn.label) || o.title || "These colors", src: (o.learn && o.learn.src) || kind, route: (o.learn && o.learn.route) || o.src || "" }); };
    card.querySelector("[data-done]").onclick = close;
    const ag = card.querySelector("[data-again]");
    if (ag) ag.onclick = () => { buzz(5); plan = more; plan.rounds.forEach(r => asked.add(r.c.n)); k = 0; results = []; ask(); };
  }
  // a color in the quiz opens its page, like every swatch in the app; the quiz steps aside first
  card.addEventListener("click", e => { const b = e.target.closest("[data-tqsw]"); if (!b) return; const h = b.dataset.tqsw; close(); openTappedColor(h); });
  requestAnimationFrame(() => { fit(); ask(); });
  return { close };
}
