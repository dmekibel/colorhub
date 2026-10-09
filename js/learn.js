"use strict";
// Learn tab (Today): welcome, placement, meet the unit, swipe deck, spaced review, and the Today screen.
// ======================================================================
// Welcome: a paint-store wall of every color in the app, sorted into strips by hue.
// ======================================================================
function welcome() {
  const pool = [...BASICS, ...ALL].map(c => { const [L, C, H] = lch(c.h); return { c, L, C, H }; });
  const neutrals = pool.filter(p => p.C < 12).sort((a, b) => b.L - a.L);
  const chroma = pool.filter(p => p.C >= 12).sort((a, b) => ((a.H + 330) % 360) - ((b.H + 330) % 360));
  const cols = 9, per = Math.ceil(chroma.length / cols), strips = [];
  for (let i = 0; i < cols; i++) strips.push(chroma.slice(i * per, (i + 1) * per).sort((a, b) => b.L - a.L));
  strips.push(neutrals);
  const el = show(`
    <header class="bar"><div class="brand">${LOGO}<span>ColorHub</span></div></header>
    <div class="wall" aria-hidden="true">${strips.map((s, k) => `<div class="strip" style="--k:${k}">${s.map(p => `<i style="--c:${p.c.h}"></i>`).join("")}</div>`).join("")}</div>
    <div class="copy">
      <h1>Name the colors <em>you see.</em></h1>
      <p>Painters and designers use hundreds of color names. Learn a few at a time, each beside the look-alike it's easiest to confuse, a few minutes a day.</p>
    </div>
    <button class="btn" data-go>Find my level <small>· 60 sec</small></button>
  `, "welcome");
  // show before asking: the first color is on screen two taps from here; the profile questions wait until Train
  el.querySelector("[data-go]").onclick = how;
  onKey = e => { if (e.key === "Enter") how(); };
}

// Two questions, asked the first time they matter (the first visit to Train) and any time from the menu:
// color vision, and which colors you work with. The app adapts: paint people see value and chroma instead of hex,
// print people get CMYK, and drills lean on lightness and the axis you see best if you're color blind.
// Not a test or a diagnosis. Skipping is fine: everything works with the defaults.
function profileSetup(next, o = {}) {
  const p = Object.assign({ cvd: "typical", media: [] }, S.profile || {});
  const VISION = [["typical", "Typical, as far as I know", ""], ["red-green", "Red–green color blind", "The most common kind, about 1 in 12 men"], ["blue-yellow", "Blue–yellow color blind", "Rare"], ["unsure", "Not sure", "We'll keep drills fair either way"]];
  const MEDIA = [["screen", "Screens & digital", "Hex, RGB and HSL codes"], ["paint", "Paint & pigments", "Value and chroma, real pigments, mixing"], ["print", "Print", "CMYK, and where screen and paper differ"]];
  const first = !S.profile;
  S.profileAsked = true; save();
  const el = show(`
    ${navTop(o.why ? esc(o.why) : "Two questions", { close: true })}
    <h1 class="t-title" style="font-size:clamp(48px,14vw,64px)">How do you <em>see</em>, and what do you <em>make</em>?</h1>
    <p class="sec-head" style="margin-top:28px"><b>Color vision</b></p>
    <div class="opt-list" data-q="cvd">${VISION.map(([k, t, d]) => `<button class="opt${p.cvd === k ? " on" : ""}" data-v="${k}"><i></i><span><b>${t}</b>${d ? `<small>${d}</small>` : ""}</span></button>`).join("")}</div>
    <p class="sec-head"><b>The colors you care about</b><span>pick any</span></p>
    <div class="opt-list" data-q="media">${MEDIA.map(([k, t, d]) => `<button class="opt multi${p.media.includes(k) ? " on" : ""}" data-v="${k}"><i></i><span><b>${t}</b><small>${d}</small></span></button>`).join("")}</div>
    <p class="fine">Not a test or a diagnosis. Change these any time in Settings, on You.</p>
    <button class="btn" data-go style="margin-top:20px">Continue ${ICON.arrow}</button>
    ${first ? `<button class="btn ghost" data-skip>Not now</button>` : ""}
  `, "profile");
  el.querySelector("[data-close]").onclick = () => next();
  const sk = el.querySelector("[data-skip]"); if (sk) sk.onclick = () => next();
  el.querySelectorAll(".opt-list").forEach(list => list.addEventListener("click", e => {
    const b = e.target.closest(".opt"); if (!b) return;
    if (list.dataset.q === "cvd") { p.cvd = b.dataset.v; list.querySelectorAll(".opt").forEach(x => x.classList.toggle("on", x === b)); }
    else { b.classList.toggle("on"); p.media = [...list.querySelectorAll(".opt.on")].map(x => x.dataset.v); }
    buzz(5);
  }));
  el.querySelector("[data-go]").onclick = () => { S.profile = p; save(); next(); };
}

// How the deck works (shown once, before placement)
function how() {
  const el = show(`
    ${navTop("Placement · about 60 seconds", { close: true })}
    <div>
      <h1>How many colors can you name?</h1>
      <p class="sub">No typing, no honor system: you pick, the app checks.</p>
    </div>
    <div class="steps">
      <div class="step"><div class="demo pi-demo-name"><b>Teal</b></div><div><b>A name appears</b><span>Everyday names first, then the designer's.</span></div></div>
      <div class="step"><div class="demo pi-demo">${["#008080", "#40826D", "#1F5F7A", "#00555A"].map(h => `<i style="--c:${h}"></i>`).join("")}</div><div><b>Tap its color</b><span>Four close shades. One is right.</span></div></div>
      <div class="step"><div class="demo pi-demo done">${["#008080", "#40826D", "#1F5F7A", "#00555A"].map((h, i) => `<i style="--c:${h}">${i ? "" : `<em>${ICON.checkS}</em>`}</i>`).join("")}</div><div><b>Pass a level, skip it</b><span>Skipped colors still get checked in a week.</span></div></div>
    </div>
    <button class="btn" data-go style="margin-top:22px">Start ${ICON.arrow}</button>
  `, "how");
  el.querySelector("[data-close]").onclick = () => S.placed ? home() : welcome();
  el.querySelector("[data-go]").onclick = () => pickPlace();
  onKey = e => { if (e.key === "Enter") pickPlace(); };
}

// ======================================================================
// The deck. mode: "learn" (a unit), "review" (spaced review). Placement is pickPlace() in pickit.js.
// ======================================================================
function sampleTier(t, n) {
  const pools = shuffle(UNITS.filter(u => u.tier === t)).map(u => shuffle(u.colors));
  const out = [];
  for (let i = 0; out.length < n && i < 500; i++) { const p = pools[i % pools.length]; if (p.length) out.push(p.pop()); }
  return shuffle(out);
}

function deck(mode, opts = {}) {
  let queue = [];
  if (mode === "learn") {
    queue = shuffle(opts.unit.colors).map(c => ({ c, dir: "f" }));
  } else {
    // Reverse cards (name to color) join once a color has been recalled at least once.
    queue = dueList().slice(0, 30).map(c => ({ c, dir: S.cards[c.id].b % 2 ? "r" : "f" }));
    // A few become production cards (type the name, or build the color): see produce.js
    if (typeof prodMix === "function") queue = prodMix(queue, opts.force);
    // Names not confirmed yet get a one-tap Pick it check (pickit.js); swipes alone never make a name yours
    if (typeof pickMix === "function") queue = pickMix(queue, opts.force);
  }
  if (!queue.length) return home();

  const uniq = [...new Map(queue.map(it => [it.c.id, it.c])).values()];
  const first = new Map();          // id -> right on first try?
  let cur = null, nxt = null, revealed = false, busy = false, ended = false;
  let prod = null, lastProd = false;   // the live production card (Say it / Make it), and whether the last card was one

  const el = show(`
    <header class="deck-top">
      <button class="icon-btn" data-close aria-label="Close">${ICON.x}</button>
      <div class="segs">${uniq.map(c => `<i data-id="${esc(c.id)}" style="--c:${c.h}"></i>`).join("")}</div>
      <span class="left mono" id="left"></span>
    </header>
    <div class="stage" id="stage"></div>
    <footer class="deck-foot" id="foot"></footer>
  `, "fixed deck" + (opts.cls ? " " + opts.cls : ""));
  const stage = el.querySelector("#stage"), foot = el.querySelector("#foot"), left = el.querySelector("#left");
  // opts.onClose: a caller outside the path (Learn it's instant lesson) can send ✕/Escape somewhere other
  // than home — a small, additive hook, never used by the real path or daily review.
  const closeTo = opts.onClose || (() => S.placed ? home() : welcome());
  el.querySelector("[data-close]").onclick = () => { ended = true; closeTo(); };

  const keyOfItem = it => it.c.id + "|" + it.dir + (it.kind ? "|" + it.kind : "");
  const plain = it => ({ c: it.c, dir: it.dir });
  function cardEl(it, isNext) {
    if (it.kind) return (it.kind === "pick" ? pickCardEl : prodCardEl)(it, isNext, keyOfItem(it));
    const c = it.c, nb = neighbor(c);
    const d = document.createElement("div");
    d.className = "card" + (it.dir === "r" ? " rev" : "") + (isNext ? " next" : "");
    d.dataset.key = keyOfItem(it);
    d.style.setProperty("--c", c.h);
    const meta = c.basic ? "Basic" : c.unit.title;
    d.innerHTML = `
      <div class="fill"></div>
      ${it.dir === "r" ? `<div class="prompt"><span class="eyebrow">Picture this color</span><b>${esc(c.n)}</b></div>` : ""}
      <div class="label">
        <div class="meta"><span>${esc(meta)}</span><span>${c.h}</span></div>
        <h2>${esc(c.n)}</h2>
        ${nb && c.d ? `<div class="vs" data-nb="${esc(c.n)}"><span class="pair"><i style="--c:${c.h}"></i><i style="--c:${nb.h}"></i></span><p>${esc(c.d)}</p></div>` : ""}
        ${peekBtn(c)}
      </div>
      <div class="stamp yes">${ICON.checkS}Got it</div><div class="stamp no">${ICON.xS}Again</div>`;
    return d;
  }

  function mount() {
    if (!queue.length || ended) return finish();
    // never two production cards in a row
    if (queue[0].kind && lastProd) queue[0] = plain(queue[0]);
    if (queue[0].kind && queue[1] && queue[1].kind) queue[1] = plain(queue[1]);
    prod = null; foot.className = "deck-foot";
    if (nxt && nxt.dataset.key === keyOfItem(queue[0])) { cur = nxt; cur.style.transition = cur.style.transform = cur.style.opacity = ""; cur.classList.remove("next"); }
    else { if (nxt) nxt.remove(); cur = cardEl(queue[0]); stage.appendChild(cur); }
    nxt = queue[1] ? cardEl(queue[1], true) : null;
    if (nxt) stage.insertBefore(nxt, cur);
    revealed = false;
    if (queue[0].kind) prod = (queue[0].kind === "pick" ? pickMount : prodMount)(cur, queue[0], foot, { el, done: ok => { revealed = true; fly(ok); } });
    else { bind(cur); setFoot(); }
    left.textContent = String(queue.length);
  }

  function setFoot() {
    if (!revealed) {
      foot.innerHTML = `<button class="check-btn" data-reveal>${queue[0].dir === "r" ? "Tap to see it" : "Tap to check"} <span class="k">space</span></button>`;
      foot.querySelector("[data-reveal]").onclick = () => reveal();
    } else {
      foot.innerHTML = `
        <div class="act-wrap"><button class="act no" data-no aria-label="Didn't know it">${ICON.xBig}</button>Again</div>
        <div class="act-wrap"><button class="act yes" data-yes aria-label="Knew it">${ICON.check}</button>Got it</div>`;
      foot.querySelector("[data-no]").onclick = () => fly(false);
      foot.querySelector("[data-yes]").onclick = () => fly(true);
    }
    // keyboard shortcut hint only makes sense with a keyboard
    if (matchMedia("(pointer: coarse)").matches) foot.querySelectorAll(".k").forEach(k => k.remove());
  }

  function reveal(e) {
    if (revealed || busy || !cur) return;
    revealed = true;
    const r = cur.getBoundingClientRect();
    const x = e ? e.clientX - r.left : r.width / 2, y = e ? e.clientY - r.top : r.height / 2;
    cur.style.setProperty("--x", x + "px"); cur.style.setProperty("--y", y + "px");
    cur.classList.add("revealed");
    buzz(8);
    setFoot();
  }

  function nudge() {
    if (!cur) return;
    cur.animate([{ transform: "translateX(0)" }, { transform: "translateX(-10px)" }, { transform: "translateX(9px)" }, { transform: "translateX(-5px)" }, { transform: "translateX(0)" }], { duration: 360, easing: "ease-out" });
    toast("Name it first, then tap to check");
  }

  function bind(card) {
    let sx = 0, sy = 0, dx = 0, dy = 0, t0 = 0, pid = null;
    const set = (k) => { card.style.transform = `translate(${dx * k}px, ${dy * k * .3}px) rotate(${dx * k * .055}deg)`; };
    card.addEventListener("pointerdown", e => {
      if (busy || pid !== null) return;
      pid = e.pointerId; card.setPointerCapture(pid);
      sx = e.clientX; sy = e.clientY; dx = dy = 0; t0 = performance.now();
      card.style.transition = "none";
    });
    card.addEventListener("pointermove", e => {
      if (e.pointerId !== pid) return;
      dx = e.clientX - sx; dy = e.clientY - sy;
      if (revealed) {
        set(1);
        const p = clamp(Math.abs(dx) / 110, 0, 1);
        card.style.setProperty("--yes", dx > 0 ? p : 0);
        card.style.setProperty("--no", dx < 0 ? p : 0);
        if (nxt) { nxt.style.transition = "none"; nxt.style.transform = `translateY(${30 - 30 * p}px) scale(${.94 + .06 * p})`; nxt.style.opacity = .55 + .45 * p; }
      } else set(.12); // resists: recall before reveal
    });
    const end = e => {
      if (e.pointerId !== pid) return;
      pid = null;
      const dt = performance.now() - t0, dist = Math.hypot(dx, dy), v = Math.abs(dx) / Math.max(dt, 1);
      card.style.transition = "";
      if (e.type === "pointerup" && dist < 8 && !revealed) { card.style.transform = ""; return reveal(e); }
      if (revealed && (Math.abs(dx) > 100 || (v > .55 && Math.abs(dx) > 36))) return fly(dx > 0, dy);
      card.style.transform = ""; card.style.setProperty("--yes", 0); card.style.setProperty("--no", 0);
      if (nxt) { nxt.style.transition = ""; nxt.style.transform = ""; nxt.style.opacity = ""; }
      if (!revealed && dist >= 30) nudge();
    };
    card.addEventListener("pointerup", end);
    card.addEventListener("pointercancel", end);
  }

  function fly(ok, dy = 0) {
    if (busy || !revealed || !cur) return;
    busy = true;
    const card = cur, w = Math.max(innerWidth, 420);
    card.style.setProperty(ok ? "--yes" : "--no", 1);
    card.style.transition = "transform .34s cubic-bezier(.35,.6,.4,1), opacity .34s";
    card.style.transform = `translate(${(ok ? 1 : -1) * (w + 120)}px, ${dy * .3 + 30}px) rotate(${ok ? 22 : -22}deg)`;
    buzz(ok ? 12 : [10, 40, 10]);
    later(() => { card.remove(); busy = false; grade(ok); }, reduceMotion ? 30 : 230);
  }

  function grade(ok) {
    const it = queue.shift();
    const id = it.c.id, firstTry = !first.has(id);
    lastProd = !!it.kind;
    if (firstTry) first.set(id, ok);
    // a swipe is practice (self-graded); Pick it / Say it / Make it are checks that can make the name yours
    if (mode === "review" && firstTry) schedule(it.c, ok, it.kind || "swipe");
    if (firstTry && !it.kind && typeof learnerLog === "function") learnerLog({ type: "answer", color: it.c, ok, by: "swipe", src: mode });   // js/learner.js
    if (ok) { const seg = el.querySelector(`.segs i[data-id="${CSS.escape(id)}"]`); if (seg) seg.classList.add("on"); }
    else queue.splice(Math.min(2, queue.length), 0, it.kind ? plain(it) : it); // comes back after two other cards, as a swipe card
    mount();
  }

  function finish() {
    if (ended) return;
    ended = true;
    const firstRight = [...first.values()].filter(Boolean).length;
    // opts.onFinish: a lesson that isn't a real path unit (Learn it) ends here instead of learnUnit()'s own
    // S.done bookkeeping and the full unitDone() screen — minimal and additive, the real path is untouched.
    if (opts.onFinish) return opts.onFinish(firstRight, first.size);
    if (mode === "learn") { learnUnit(opts.unit); return unitDone(opts.unit, firstRight, first.size); }
    return reviewDone(firstRight, first.size);
  }

  onKey = e => {
    if (e.key === "Escape") { ended = true; return closeTo(); }
    if (prod) return prod.key(e);
    if (!revealed && (e.key === " " || e.key === "Enter")) { e.preventDefault(); reveal(); }
    else if (revealed && (e.key === "ArrowRight" || e.key === "l")) fly(true);
    else if (revealed && (e.key === "ArrowLeft" || e.key === "h")) fly(false);
  };
  mount();
}

// ======================================================================
// Placement result
// ======================================================================
// A tier is skipped only when it was passed objectively (placeVerdict in pickit.js). Its colors join reviews as
// "known (placed)" and are checked a week later. The last tier is never skipped: the path needs somewhere to start.
function placed(log) {
  const t2 = log.filter(x => x.stage === 2), t3 = log.filter(x => x.stage === 3);
  const pass2 = placeVerdict(t2) === true, pass3 = pass2 && placeVerdict(t3) === true;
  const tier = pass2 ? 3 : 2;
  S.placed = { tier, at: today() };
  S.start = tier === 3 ? FIRST_T3 : 0;
  const skipped = pass2 ? placeSkip(2) : 0;
  save();
  const k2 = t2.filter(x => x.ok).length, k3 = t3.filter(x => x.ok).length;
  const lede = !t2.length
    ? "Time ran out before the test began, so you start at the beginning."
    : `You picked ${k2} of ${t2.length} everyday in-betweens` + (t3.length ? ` and ${k3} of ${t3.length} designer's words.` : ".") +
      (tier === 3 ? ` You skip ahead to the precise vocabulary.${skipped ? ` The ${skipped} in-betweens you skipped come back for a quick check in a week, so none slip through.` : ""}`
        : " You start with the words between the basics.") +
      (pass3 ? " You know many designer's words already, so those units will go quickly." : "");
  const shown = [...t2, ...t3];
  const el = show(`
    <header class="bar"><div class="brand">${LOGO}<span>ColorHub</span></div></header>
    ${shown.length ? `<div class="chips${shown.length > 9 ? " compact" : ""}">${shown.map((x, k) => `<div class="chip ${x.ok ? "" : "miss"}" style="--c:${x.c.h};--k:${k}"><i><b class="mark ${x.ok ? "y" : "n"}">${x.ok ? ICON.checkS : ICON.xS}</b></i><span>${esc(x.c.n)}</span></div>`).join("")}</div>` : `<div style="flex:1"></div>`}
    <p class="eyebrow">Your starting point</p>
    <h1><em>${esc(D.tiers[tier].name)}</em></h1>
    <p class="lede">${esc(lede)}</p>
    <button class="btn" data-go>Open the map ${ICON.arrow}</button>
  `, "result");
  // Straight to the map (PLAN.md lane C; ROADMAP.md §12), with a one-line first-run hint: "Tap any color".
  // S.tab stays "learn", so the Rooms corner's quick-resume still opens the Learn room with your first unit.
  const goHome = () => { S.tab = "learn"; S.mapHint = 1; save(); hmHome(); lrMapHint(); };
  el.querySelector("[data-go]").onclick = goHome;
  onKey = e => { if (e.key === "Enter") goHome(); };
}
// The map's first-run hint, once, right after placement: one quiet line that leaves at the first touch.
// S.mapHint marks it pending (a later Home lane can show it again if the app closed before that first touch).
function lrMapHint() {
  const scr = S.mapHint && app.querySelector(".hm"); if (!scr) return;
  const tip = document.createElement("div");
  tip.className = "lr-maphint"; tip.setAttribute("role", "status");
  tip.innerHTML = `<i aria-hidden="true"></i><span>Tap any color to open it</span>`;
  scr.appendChild(tip);
  const done = () => {
    document.removeEventListener("pointerdown", done, true);
    delete S.mapHint; save();
    tip.classList.add("out"); later(() => tip.remove(), reduceMotion ? 0 : 320);
  };
  document.addEventListener("pointerdown", done, true);
}

// ======================================================================
// Meet the unit: a vertical pager, one color per screen, each shown beside its neighbor.
// ======================================================================
function meet(u) {
  u = expUnit(u);   // the self-test (off by default) holds 3 colors back from practice: pickit.js
  const n = u.colors.length;
  const page = (c, i) => {
    const nb = neighbor(c);
    return `<section class="page col">
      <div class="swatch" style="--c:${c.h}" data-ink="${ink(c.h)}">
        <h2>${esc(c.n)}</h2><span class="hex">${c.h}</span>
      </div>
      ${nb ? `<div class="compare" data-nb="${esc(c.n)}">
        <div style="--c:${c.h}" data-ink="${ink(c.h)}">${esc(c.n)}</div>
        <div style="--c:${nb.h}" data-ink="${ink(nb.h)}">${esc(nb.n)}</div>
      </div>` : ""}
      <p class="diff">${esc(c.d)}</p>
      ${c.o ? `<p class="origin">${esc(c.o)}</p>` : ""}
      ${peekBtn(c)}
    </section>`;
  };
  const el = show(`
    <div class="meet-top"><button class="icon-btn" data-close aria-label="Close">${ICON.x}</button><span class="mono" id="pg">${esc(u.title)}</span></div>
    <div class="pager" id="pager">
      <section class="page cover">
        <div class="fan">${[...u.colors].sort((a, b) => lab(b.h)[0] - lab(a.h)[0]).map((c, k) => `<i style="--c:${c.h};${fanVars(n, k)};--spread:${Math.min(11, 70 / n)}deg"></i>`).join("")}</div>
        <p class="eyebrow">${esc(unitLabel(u))}</p>
        <h1>${esc(u.title)}</h1>
        <p>${n} new color names. Each one comes with the neighbor it's easiest to confuse it with.</p>
        <div class="hint-up">${ICON.up} Swipe up to meet them</div>
      </section>
      ${u.colors.map(page).join("")}
      <section class="page ready">
        <div class="tiles">${shuffle(u.colors).map(c => `<i style="--c:${c.h}"></i>`).join("")}</div>
        <h2>Now name them.</h2>
        <p>Each color appears without its name. Say it in your head, tap to check, then swipe.</p>
        <button class="btn" data-go>Start the deck ${ICON.arrow}</button>
      </section>
    </div>
  `, "meet");
  const pager = el.querySelector("#pager"), pg = el.querySelector("#pg");
  el.querySelector("[data-close]").onclick = home;
  el.querySelector("[data-go]").onclick = () => deck("learn", { unit: u });
  const pages = [...pager.children];
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    const i = pages.indexOf(e.target);
    pg.textContent = i === 0 || i === pages.length - 1 ? u.title : `${i} / ${n}`;
  }), { root: pager, threshold: .6 });
  pages.forEach(p => io.observe(p));
  const go = d => { const i = Math.round(pager.scrollTop / pager.clientHeight); pager.scrollTo({ top: clamp(i + d, 0, pages.length - 1) * pager.clientHeight, behavior: reduceMotion ? "auto" : "smooth" }); };
  onKey = e => {
    if (e.key === "Escape") return home();
    if (["ArrowDown", "PageDown", " "].includes(e.key)) { e.preventDefault(); go(1); }
    if (["ArrowUp", "PageUp"].includes(e.key)) { e.preventDefault(); go(-1); }
    if (e.key === "Enter" && pager.scrollTop + pager.clientHeight >= pager.scrollHeight - 4) deck("learn", { unit: u });
  };
}

// ======================================================================
// Unit done / review done
// ======================================================================
function unitDone(u, right, total) {
  const nu = nextUnit();
  const el = show(`
    <div class="chips">${u.colors.map((c, k) => `<div class="chip" style="--c:${c.h};--k:${k}"><i></i><span>${esc(c.n)}</span></div>`).join("")}</div>
    <p class="eyebrow">${esc(unitLabel(u))}</p>
    <h1>${esc(u.title)}, <em>named.</em></h1>
    <p class="lede">${right} of ${total} on the first try. They come back tomorrow for a quick review: recalling them after a night's sleep is what makes them stick.</p>
    <p class="fine own-line">${OWN_LINE}</p>
    ${typeof lxBetHtml === "function" ? lxBetHtml(u.colors.map(c => c.id)) : ""}
    <div class="stack">
      ${nu ? `<button class="btn" data-next>Next: ${esc(nu.title)} ${ICON.arrow}</button>` : ""}
      ${expNudge()}
      <button class="btn ghost" data-home>Back to Learn</button>
    </div>
  `, "result");
  expWireNudge(el);
  if (typeof lxBetWire === "function") lxBetWire(el, u.colors.map(c => c.id));
  const nb = el.querySelector("[data-next]");
  if (nb) nb.onclick = () => meet(nu);
  el.querySelector("[data-home]").onclick = home;
  onKey = e => { if (e.key === "Enter") nu ? meet(nu) : home(); };
}

function reviewDone(right, total) {
  const nu = nextUnit(), selfN = ownCounts().self, bet = typeof lxBetSettle === "function" ? lxBetSettle() : "";
  const el = show(`
    <div style="flex:1"></div>
    <p class="eyebrow">Daily review</p>
    <h1>Review <em>done.</em></h1>
    <div class="stat-row">
      <div class="stat"><b>${right}/${total}</b><span>right on the first try</span></div>
      <div class="stat"><b>${ownedCount()}</b><span>yours${selfN ? ` · ${selfN} to confirm` : ""}</span></div>
    </div>
    <p class="lede">The ones you knew come back in a few days, then in weeks. The misses come back tomorrow.</p>
    ${bet ? `<p class="lede lx-bet-line">${esc(bet)}</p>` : ""}
    <p class="fine own-line">${OWN_LINE} Swipes are practice.</p>
    <div class="stack">
      ${nu ? `<button class="btn" data-next>Continue: ${esc(nu.title)} ${ICON.arrow}</button>` : ""}
      ${expNudge()}
      <button class="btn ghost" data-home>Back to Learn</button>
    </div>
  `, "result");
  expWireNudge(el);
  const nb = el.querySelector("[data-next]");
  if (nb) nb.onclick = () => meet(nu);
  el.querySelector("[data-home]").onclick = home;
  onKey = e => { if (e.key === "Enter") nu ? meet(nu) : home(); };
}

// ======================================================================
// Today: one primary card (review or the next unit, with the screen's only filled button),
// then "Today's three" as equal quiet tiles, then the collection.
// ======================================================================
// Title with its last word in italic, the editorial way ("Reds & *pinks*")
const edTitle = t => { const m = esc(t).match(/^(.*?)(\s*(?:&amp;|and)\s*)(.+)$/); return m ? `${m[1]}${m[2]}<em>${m[3]}</em>` : esc(t); };
const pad2 = n => String(n).padStart(2, "0");
// The Train tile on Today: the weekly check-in when it's due, else the station Train suggests. Done once you've trained today.
function todayTrain() {
  try {
    const done = TRAIN_KEYS.some(k => { const h = (S.gym.skills[k] || {}).hist || []; return h.length && h[h.length - 1][0] === today(); });
    const ci = checkinDue(gyState().checkins, triedKeys().length, gyDay());
    if (ci.due) return { done, art: stationArt(checkinPick(triedKeys(), gyState().checkins)[0] || "hue"), what: "Check-in", open: runCheckin };
    const sg = suggestStation();
    return { done, art: stationArt(sg.k), what: SKILLS[sg.k].name, open: () => runDrill(sg.k) };
  } catch (e) { return { done: false, art: "", what: "Eye training", open: () => go("gym") }; }
}
// The weekday, for the Learn room's header note ("Wednesday") — a day starts at 4am (today(), core.js), so a
// late-night session still shows the day it feels like.
const weekdayName = () => new Date(Date.now() - 4 * 3600e3).toLocaleDateString(undefined, { weekday: "long" });
// Today folds into Learn (DESIGN-SYSTEM.md §2, §12): this is the Learn room, entered by the signature motion
// from the Rooms stem or a swipe up from Home. Version 2 (design/LEARN-ROOM-2.md, js/learnhub.js): a hub you choose
// from, not a linear path. For you (due reviews first), your color wheel by family, a short list of other choices,
// and Today; every one of them opens the same Study sheet as the map.
function home() {
  if (!S.placed) return welcome();
  return lhRoom();
}

// ---------- Today: one card (PLAN.md decision 5) ----------
// One color and one painting that holds it: todayPick() (js/today.js, lane B) when it's in. Until then the card
// falls back to the two dailies as they are (Today's painting, and the color behind Name it in six), which aren't
// linked, so the title doesn't pretend they are. The color's name never shows before it's named (it's the answer
// to Name it in six). Two parts, each with its own tick: Look (Today's painting) and Name it in six.
function lrPick() {
  try { if (typeof todayPick === "function") { const p = todayPick(today()); if (p && p.color && p.color.h) return p; } } catch (e) {}
  return null;
}
const lrName = n => { const s = typeof lxLower === "function" ? lxLower(n) : String(n); return s.charAt(0).toUpperCase() + s.slice(1); };
function lrTodayHtml() {
  const k = today(), p = typeof chToday === "function" ? chToday() : null, now = S.dpNow && S.dpNow.k === k ? S.dpNow : null;
  const d = S.daily && S.daily[k], dr = d && d.g ? d : null, n = typeof chStreak === "function" ? chStreak() : 0;
  const pDone = !!p, dDone = typeof dnDone === "function" && dnDone(k);
  const pSt = p ? `${(p.hits || []).filter(Boolean).length} of ${(p.hits || []).length || 5} seen` : now ? `Round ${now.i + 1} of 5` : "Five ways to look";
  const dSt = dr ? (dr.done ? (dr.ok ? (dr.hint ? "Named, with choices" : `Named in ${dr.g.length}`) : "Missed today") : `${dr.g.length} ${dr.g.length === 1 ? "guess" : "guesses"} so far`) : d ? "Named" : "Six guesses";
  // Night Gallery row lead (css/ng.css): a 32 px disc with the part's own icon; done, it turns --good with a tick
  const tick = (on, ic) => `<span class="lr-tick${on ? " on" : ""}" aria-hidden="true">${icon(on ? "check" : ic, on ? 16 : 18)}</span>`;
  return `<section class="lr-today">
    <div class="dl-head"><h3 class="title-3">Today</h3><span class="note">${n > 1 ? `${n}-day streak` : ""}</span>${typeof ssOpen === "function" ? `<button class="icon-btn" data-slideshow="today" aria-label="Slideshow, starting with today's color">${icon("play", 18)}</button>` : ""}</div>
    <div class="lr-tcard${pDone && dDone ? " done" : ""}">
      <button class="lr-tc-art" data-dpaint aria-label="Today's painting"><span class="dl-art dl-ph lr-tc-img" id="dlPaintArt"></span><span class="lr-tc-chip" id="dlColorArt"></span></button>
      <div class="lr-tc-text"><p class="lr-tc-title" id="lrTcTitle">Today's painting <em>and color</em></p><p class="note lr-tc-sub" id="lrTcSub">&nbsp;</p></div>
      <div class="lr-tc-acts">
        <button class="lr-tc-act${pDone ? " done" : ""}" data-dpaint>${tick(pDone, "museum")}<b>Look</b><span class="lr-tc-st">${esc(pSt)}</span>${ICON.chev}</button>
        <button class="lr-tc-act${dDone ? " done" : ""}" data-daily>${tick(dDone, "colors")}<b>Name it in six</b><i class="lr-tc-sw" id="lrTcSw" aria-hidden="true"></i><span class="lr-tc-st" id="dlColorSt">${esc(dSt)}</span>${ICON.chev}</button>
      </div>
    </div></section>`;
}
function lrTodayWire(el) {
  el.querySelectorAll("[data-dpaint]").forEach(b => b.onclick = () => challenge());
  el.querySelectorAll("[data-daily]").forEach(b => b.onclick = () => daily());
  const tok = SHOW_N, k = today(), $ = s => el.querySelector(s);
  const paint = (e, c, linked) => {
    if (SHOW_N !== tok || !el.isConnected) return;
    const named = typeof dnDone === "function" && dnDone(k);
    const t = $("#lrTcTitle"), sub = $("#lrTcSub"), art = $("#dlPaintArt"), chip = $("#dlColorArt");
    if (e && art) { art.classList.remove("dl-ph"); art.innerHTML = `<img src="${esc(dpThumb(e))}" alt="">`; }
    const sw = $("#lrTcSw"); if (c && sw) { sw.style.background = c.h; sw.classList.add("on"); }
    // the chip sits on the painting only when the color really is in it (todayPick); the fallback pair isn't linked
    if (c && chip && linked) {
      chip.style.setProperty("--c", c.h); chip.classList.add("on");
      chip.innerHTML = named ? `<span data-ink="${ink(c.h)}">${esc(lrName(c.n))}</span>` : "";
    }
    if (!t || !e) return;
    const pt = `<em>${esc(e.t)}</em>`;
    t.innerHTML = linked
      ? (named && c ? `${esc(lrName(c.n))}, in ${pt}` : `Today's color hides in ${pt}`)
      : (named && c ? `${pt}, and ${esc(lrName(c.n))}` : `${pt}, and a color to name`);
    if (sub) sub.textContent = [e.a, e.yr].filter(Boolean).join(", ");
  };
  const pk = lrPick();
  const color = pk ? Promise.resolve(pk.color) : loadCoreNames().then(() => typeof dnTarget === "function" ? dnTarget() : null).catch(() => null);
  Promise.all([dpLoad().catch(() => null), color]).then(([e, c]) => {
    // linked only when todayPick() named this very painting (its painting may be an id or an object)
    const pid = pk && pk.painting && (pk.painting.id || pk.painting.node || pk.painting);
    paint(e, c, !!(pk && e && (!pid || pid === e.id || pid === e.node)));
  });
}

function menu() {
  // design round 2: the Settings sheet in the menu family (js/you.js); the old list below stays as a fallback
  if (typeof ymSettingsSheet === "function") return ymSettingsSheet();
  const { sh, close } = sheet(`
    <button class="item" data-a="profile">Your eyes & tools ${ICON.chev}</button>
    <button class="item" data-a="place">Retake the placement test ${ICON.chev}</button>
    <button class="item" data-a="backup">Back up your progress ${ICON.chev}</button>
    <button class="item" data-a="restore">Restore a backup ${ICON.chev}</button>
    <button class="item" data-a="about">About the colors ${ICON.chev}</button>
    <button class="item" data-a="haptics">Haptics: ${S.haptics === false ? "off" : "on"} ${ICON.chev}</button>
    ${typeof sndMenuRows === "function" ? sndMenuRows() : ""}
    <button class="item" data-a="quick">Quick mode, no typing: ${S.quick ? "on" : "off"} ${ICON.chev}</button>
    <button class="item danger" data-a="reset">Reset all progress</button>`);
  sh.onclick = e => {
    const a = e.target.closest("[data-a]"); if (!a) return;
    close();
    if (typeof sndMenuAct === "function" && sndMenuAct(a.dataset.a)) return;
    if (a.dataset.a === "profile") profileSetup(() => go(S.tab || "learn"));
    if (a.dataset.a === "backup") backupProgress();
    if (a.dataset.a === "restore") restoreProgress();
    if (a.dataset.a === "place") how();
    if (a.dataset.a === "about") about();
    if (a.dataset.a === "quick") { S.quick = !S.quick; save(); buzz(8); toast(`Quick mode ${S.quick ? "on" : "off"}`); }
    if (a.dataset.a === "haptics") { S.haptics = S.haptics === false; save(); buzz(12); toast(`Haptics ${S.haptics ? "on" : "off"}`); }
    if (a.dataset.a === "reset" && confirm("Erase all progress on this device?")) { S = fresh(); save(); welcome(); }
  };
}
function about() {
  const { sh, close } = sheet(`<h3>About the colors</h3>
    <p>Every swatch is a screen approximation. Hex values come from the CSS named colors, Wikipedia's list of colors and the xkcd color survey, where people named millions of colors. Where those disagree with what most people picture (CSS "khaki" is a pale yellow), we picked between them.</p>
    <p>Why names matter: Russian has separate words for light blue and dark blue, and Russian speakers tell those blues apart a little faster (Winawer et al., 2007). The effect is real but modest. Names give you handles; practice with feedback sharpens the eye.</p>
    <p>How the deck works: reviews space out from 1 day to 3, 7, 16, 35 and 90 days.</p>
    <p>Once you've recalled a name, some review cards ask you to type it (Say it) or build the color (Make it). Producing an answer from memory makes it stick better than recognizing it. Quick mode in the menu turns these two off; the one-tap Pick it check stays.</p>
    ${ownAboutHtml()}`);
  ownAboutWire(sh, close);
}

// ---------- backup: progress lives on this device, so let people keep a copy ----------
function backupProgress() {
  S.backedUp = today(); save();
  const blob = new Blob([JSON.stringify(S, null, 1)], { type: "application/json" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `colorhub-backup-${today()}.json`; a.click();
  toast("Backup saved");
}
function restoreProgress() {
  const inp = document.createElement("input"); inp.type = "file"; inp.accept = "application/json,.json";
  inp.onchange = () => {
    const f = inp.files[0]; if (!f) return;
    f.text().then(t => {
      try { const d = migrateState(JSON.parse(t)); if (!d || !d.cards) throw 0; S = d; pickMigrate(S); save(); toast("Progress restored"); go("learn"); }
      catch (e) { toast("That file isn't a ColorHub backup"); }
    });
  };
  inp.click();
}

// "Put it on your Home Screen": shown once you've finished a unit, until it's installed; "Not now" waits 30 days.
// On iPhone it also protects progress: Safari can clear a website's data after about a week without a visit,
// but not a Home Screen app's. The backup reminder (core.js keepCard) rides along in the same spot.
function installHint() {
  const keep = keepCard(), snoozed = S.installNo && (S.installNo === true || daysSince(S.installNo) < 30);
  if (standalone() || snoozed || !Object.keys(S.done).length || !(INSTALL_EVT || isIOS())) return keep;
  return `<section class="inst"><div><b>Keep ColorHub on your Home Screen</b><span>${INSTALL_EVT ? "It opens full screen, like an app, and works offline." : "Tap Share, then “Add to Home Screen”. It opens full screen, works offline, and keeps your progress safe: Safari can clear a website's data after a week away."}</span></div>
    <div class="inst-act">${INSTALL_EVT ? `<button class="btn ghost" data-install>Install ${ICON.arrow}</button>` : ""}<button class="btn ghost" data-inst-no>Not now</button></div></section>${keep}`;
}
function wireInstall(el) {
  const i = el.querySelector("[data-install]"), n = el.querySelector("[data-inst-no]");
  if (i) i.onclick = async () => { const e = INSTALL_EVT; INSTALL_EVT = null; e.prompt(); try { await e.userChoice; } catch (x) {} home(); };
  if (n) n.onclick = () => { S.installNo = today(); save(); el.querySelector(".inst").remove(); };
  wireKeep(el);
}
