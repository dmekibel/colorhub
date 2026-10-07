"use strict";
// Learn tab: welcome, placement, meet the unit, swipe deck, spaced review, home with the color map.
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
      <p>English has eleven basic color words. Painters and designers use hundreds. Learn them one family at a time, a few minutes a day.</p>
    </div>
    <button class="btn" data-go>Find my level <small>· 60 sec</small></button>
  `, "welcome");
  el.querySelector("[data-go]").onclick = () => profileSetup(how);
  onKey = e => { if (e.key === "Enter") profileSetup(how); };
}

// Two questions at the start (and any time from the menu): color vision, and which colors you work with.
// The app adapts: paint people see value and chroma instead of hex, print people get CMYK,
// and drills lean on lightness and the axis you see best if you're color blind. Not a test or a diagnosis.
function profileSetup(next) {
  const p = Object.assign({ cvd: "typical", media: [] }, S.profile || {});
  const VISION = [["typical", "Typical, as far as I know", ""], ["red-green", "Red–green color blind", "The most common kind, about 1 in 12 men"], ["blue-yellow", "Blue–yellow color blind", "Rare"], ["unsure", "Not sure", "We'll keep drills fair either way"]];
  const MEDIA = [["screen", "Screens & digital", "Hex, RGB and HSL codes"], ["paint", "Paint & pigments", "Value and chroma, real pigments, mixing"], ["print", "Print", "CMYK, and where screen and paper differ"]];
  const el = show(`
    <header class="deck-top"><button class="icon-btn" data-close aria-label="Close">${ICON.x}</button><span class="eyebrow" style="flex:1">Two questions · ten seconds</span></header>
    <h1 class="t-title" style="font-size:clamp(48px,14vw,64px)">How do you <em>see</em>, and what do you <em>make</em>?</h1>
    <p class="sec-head" style="margin-top:28px"><b>Color vision</b></p>
    <div class="opt-list" data-q="cvd">${VISION.map(([k, t, d]) => `<button class="opt${p.cvd === k ? " on" : ""}" data-v="${k}"><i></i><span><b>${t}</b>${d ? `<small>${d}</small>` : ""}</span></button>`).join("")}</div>
    <p class="sec-head"><b>The colors you care about</b><span>pick any</span></p>
    <div class="opt-list" data-q="media">${MEDIA.map(([k, t, d]) => `<button class="opt multi${p.media.includes(k) ? " on" : ""}" data-v="${k}"><i></i><span><b>${t}</b><small>${d}</small></span></button>`).join("")}</div>
    <p class="fine">Not a test or a diagnosis. Change these any time from the menu.</p>
    <button class="btn" data-go style="margin-top:20px">Continue ${ICON.arrow}</button>
  `, "profile");
  el.querySelector("[data-close]").onclick = () => S.placed ? home() : welcome();
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
    <header class="bar"><button class="icon-btn" data-back aria-label="Back">${ICON.x}</button></header>
    <div>
      <p class="eyebrow">Placement · 60 seconds</p>
      <h1>How many colors can you name?</h1>
      <p class="sub">No typing. Just be honest with yourself.</p>
    </div>
    <div class="steps">
      <div class="step"><div class="demo" style="--c:#008080"></div><div><b>Name it in your head</b><span>A color fills the card.</span></div></div>
      <div class="step"><div class="demo" style="--c:#008080"><div class="tap"></div><div class="mini-label">Teal</div></div><div><b>Tap to check</b><span>The name appears.</span></div></div>
      <div class="step"><div class="demo swipe" style="--c:#008080"><div class="mini-label">Teal</div></div><div><b>Swipe right if you knew it</b><span>Left if you didn't.</span></div></div>
    </div>
    <button class="btn" data-go style="margin-top:22px">Start ${ICON.arrow}</button>
  `, "how");
  el.querySelector("[data-back]").onclick = () => S.placed ? home() : welcome();
  el.querySelector("[data-go]").onclick = () => deck("place");
  onKey = e => { if (e.key === "Enter") deck("place"); };
}

// ======================================================================
// The deck. mode: "place" (placement test), "learn" (a unit), "review" (spaced review)
// ======================================================================
function sampleTier(t, n) {
  const pools = shuffle(UNITS.filter(u => u.tier === t)).map(u => shuffle(u.colors));
  const out = [];
  for (let i = 0; out.length < n && i < 500; i++) { const p = pools[i % pools.length]; if (p.length) out.push(p.pop()); }
  return shuffle(out);
}

function deck(mode, opts = {}) {
  let queue = [];
  if (mode === "place") {
    // no basics: every English speaker knows red and blue, so the test starts on the in-betweens
    queue = sampleTier(2, 10).map(c => ({ c, dir: "f", stage: 2 }));
  } else if (mode === "learn") {
    queue = shuffle(opts.unit.colors).map(c => ({ c, dir: "f" }));
  } else {
    // Reverse cards (name to color) join once a color has been recalled at least once.
    queue = dueList().slice(0, 30).map(c => ({ c, dir: S.cards[c.id].b % 2 ? "r" : "f" }));
    // A few become production cards (type the name, or build the color): see produce.js
    if (typeof prodMix === "function") queue = prodMix(queue, opts.force);
  }
  if (!queue.length) return home();

  const uniq = [...new Map(queue.map(it => [it.c.id, it.c])).values()];
  const first = new Map();          // id -> right on first try?
  const log = [];                   // placement answers
  let cur = null, nxt = null, revealed = false, busy = false, ended = false, extended = false;
  let prod = null, lastProd = false;   // the live production card (Say it / Make it), and whether the last card was one

  const el = show(`
    <header class="deck-top">
      <button class="icon-btn" data-close aria-label="Close">${ICON.x}</button>
      ${mode === "place"
        ? `<div class="timer" id="timer"><i></i></div>`
        : `<div class="segs">${uniq.map(c => `<i data-id="${esc(c.id)}" style="--c:${c.h}"></i>`).join("")}</div>`}
      <span class="left mono" id="left"></span>
    </header>
    <div class="stage" id="stage"></div>
    <footer class="deck-foot" id="foot"></footer>
  `, "fixed deck");
  const stage = el.querySelector("#stage"), foot = el.querySelector("#foot"), left = el.querySelector("#left");
  el.querySelector("[data-close]").onclick = () => { ended = true; S.placed ? home() : welcome(); };

  if (mode === "place") later(() => { if (!ended) finish(); }, 60000);

  const keyOfItem = it => it.c.id + "|" + it.dir + (it.kind ? "|" + it.kind : "");
  const plain = it => ({ c: it.c, dir: it.dir });
  function cardEl(it, isNext) {
    if (it.kind) return prodCardEl(it, isNext, keyOfItem(it));
    const c = it.c, nb = mode === "place" ? null : neighbor(c);
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
        ${nb && c.d ? `<div class="vs"><span class="pair"><i style="--c:${c.h}"></i><i style="--c:${nb.h}"></i></span><p>${esc(c.d)}</p></div>` : ""}
        ${mode !== "place" ? peekBtn(c) : ""}
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
    if (queue[0].kind) prod = prodMount(cur, queue[0], foot, { el, done: ok => { revealed = true; fly(ok); } });
    else { bind(cur); setFoot(); }
    left.textContent = mode === "place" ? "" : String(queue.length);
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
    if (mode === "place") {
      log.push({ c: it.c, ok, stage: it.stage });
      // Strong on the in-betweens? Then test the designer's vocabulary too.
      if (!extended && it.stage === 2 && !queue.some(q => q.stage === 2)) {
        extended = true;
        const t2 = log.filter(x => x.stage === 2);
        if (t2.filter(x => x.ok).length / t2.length >= .7) queue.push(...sampleTier(3, 10).map(c => ({ c, dir: "f", stage: 3 })));
      }
    } else {
      if (mode === "review" && firstTry) schedule(it.c, ok);
      if (ok) { const seg = el.querySelector(`.segs i[data-id="${CSS.escape(id)}"]`); if (seg) seg.classList.add("on"); }
      else queue.splice(Math.min(2, queue.length), 0, it.kind ? plain(it) : it); // comes back after two other cards, as a swipe card
    }
    mount();
  }

  function finish() {
    if (ended && mode !== "place") return;
    ended = true;
    const firstRight = [...first.values()].filter(Boolean).length;
    if (mode === "place") return placed(log);
    if (mode === "learn") { learnUnit(opts.unit); return unitDone(opts.unit, firstRight, first.size); }
    return reviewDone(firstRight, first.size);
  }

  onKey = e => {
    if (e.key === "Escape") { ended = true; return S.placed ? home() : welcome(); }
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
function placed(log) {
  const t2 = log.filter(x => x.stage === 2), t3 = log.filter(x => x.stage === 3);
  const r2 = t2.length ? t2.filter(x => x.ok).length / t2.length : 0;
  const tier = t2.length >= 5 && r2 >= .7 ? 3 : 2;
  S.placed = { tier, at: today() };
  S.start = tier === 3 ? FIRST_T3 : 0;
  save();
  const k2 = t2.filter(x => x.ok).length, k3 = t3.filter(x => x.ok).length;
  const lede = !t2.length
    ? "Time ran out before the real test began, so you start at the beginning."
    : `You named ${k2} of ${t2.length} everyday in-betweens` + (t3.length ? ` and ${k3} of ${t3.length} designer's words.` : ".") +
      (tier === 3 ? " You skip ahead to the precise vocabulary." : " You start with the words between the basics.");
  const shown = [...t2, ...t3];
  const el = show(`
    <header class="bar"><div class="brand">${LOGO}<span>ColorHub</span></div></header>
    ${shown.length ? `<div class="chips${shown.length > 9 ? " compact" : ""}">${shown.map((x, k) => `<div class="chip ${x.ok ? "" : "miss"}" style="--c:${x.c.h};--k:${k}"><i><b class="mark ${x.ok ? "y" : "n"}">${x.ok ? ICON.checkS : ICON.xS}</b></i><span>${esc(x.c.n)}</span></div>`).join("")}</div>` : `<div style="flex:1"></div>`}
    <p class="eyebrow">Your starting point</p>
    <h1><em>${esc(D.tiers[tier].name)}</em></h1>
    <p class="lede">${esc(lede)}</p>
    <button class="btn" data-go>Start learning ${ICON.arrow}</button>
  `, "result");
  el.querySelector("[data-go]").onclick = home;
  onKey = e => { if (e.key === "Enter") home(); };
}

// ======================================================================
// Meet the unit: a vertical pager, one color per screen, each shown beside its neighbor.
// ======================================================================
function meet(u) {
  const n = u.colors.length;
  const page = (c, i) => {
    const nb = neighbor(c);
    return `<section class="page col">
      <div class="swatch" style="--c:${c.h}" data-ink="${ink(c.h)}">
        <h2>${esc(c.n)}</h2><span class="hex">${c.h}</span>
      </div>
      ${nb ? `<div class="compare">
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
    <div class="stack">
      ${nu ? `<button class="btn" data-next>Next: ${esc(nu.title)} ${ICON.arrow}</button>` : ""}
      <button class="btn ghost" data-home>Home</button>
    </div>
  `, "result");
  const nb = el.querySelector("[data-next]");
  if (nb) nb.onclick = () => meet(nu);
  el.querySelector("[data-home]").onclick = home;
  onKey = e => { if (e.key === "Enter") nu ? meet(nu) : home(); };
}

function reviewDone(right, total) {
  const nu = nextUnit();
  const el = show(`
    <div style="flex:1"></div>
    <p class="eyebrow">Daily review</p>
    <h1>Review <em>done.</em></h1>
    <div class="stat-row">
      <div class="stat"><b>${right}/${total}</b><span>right on the first try</span></div>
      <div class="stat"><b>${ownedCount()}</b><span>color names you own</span></div>
    </div>
    <p class="lede">The ones you knew come back in a few days, then in weeks. The misses come back tomorrow.</p>
    <div class="stack">
      ${nu ? `<button class="btn" data-next>Continue: ${esc(nu.title)} ${ICON.arrow}</button>` : ""}
      <button class="btn ghost" data-home>Home</button>
    </div>
  `, "result");
  const nb = el.querySelector("[data-next]");
  if (nb) nb.onclick = () => meet(nu);
  el.querySelector("[data-home]").onclick = home;
  onKey = e => { if (e.key === "Enter") nu ? meet(nu) : home(); };
}

// ======================================================================
// Home: the color map, the path, and one next step.
// ======================================================================
// Title with its last word in italic, the editorial way ("Reds & *pinks*")
const edTitle = t => { const m = esc(t).match(/^(.*?)(\s*(?:&amp;|and)\s*)(.+)$/); return m ? `${m[1]}${m[2]}<em>${m[3]}</em>` : esc(t); };
const pad2 = n => String(n).padStart(2, "0");
function home() {
  if (!S.placed) return welcome();
  const due = dueList(), nu = nextUnit(), owned = ownedCount(), dc = dailyColor(), dAns = S.daily[today()];
  const mine = ALL.filter(c => S.cards[c.id] && S.cards[c.id].own), lrn = ALL.filter(c => S.cards[c.id] && !S.cards[c.id].own);
  const hueKey = c => { const [L, C, H] = lch(c.h); return C < 12 ? 1000 + (100 - L) : (H + 330) % 360 + (100 - L) / 400; };
  mine.sort((a, b) => hueKey(a) - hueKey(b)); lrn.sort((a, b) => hueKey(a) - hueKey(b));
  // the collection: owned names fill a quilt from the top in hue order; names in review follow, faint
  const quilt = Array.from({ length: ALL.length }, (_, i) => mine[i] ? `<i class="o" style="--c:${mine[i].h};--k:${i}"></i>`
    : lrn[i - mine.length] ? `<i class="l" style="--c:${lrn[i - mine.length].h}"></i>` : "<i></i>").join("");
  let h;
  if (due.length) {
    const p = due.slice(0, 12);
    h = { kick: `Daily review — ${due.length} to recall`, title: due.length === 1 ? "One to <em>recall</em>" : `${due.length} to <em>recall</em>`, plates: p,
      meta: [`${due.length} names`, nu ? `then ${esc(nu.title)}` : "keep them yours"], cta: "Begin the review", act: "review" };
  } else if (nu) {
    const p = nu.colors.slice().sort((a, b) => lab(b.h)[0] - lab(a.h)[0]);
    h = { kick: `N° ${pad2(nu.i + 1)} of ${UNITS.length} — ${esc(D.tiers[nu.tier].name)}`, title: edTitle(nu.title), plates: p,
      meta: [`${nu.colors.length} new names`, `≈ ${Math.max(2, Math.round(nu.colors.length * 15 / 60))} min`], cta: UNITS.some(u => S.done[u.id]) ? "Continue the path" : "Begin the path", act: "learn" };
  } else {
    h = { kick: "All caught up", title: "The path is <em>complete</em>", plates: mine.slice(0, 12), meta: ["more tiers are coming"], cta: "", act: "" };
  }
  const el = show(`
    <header class="bar"><div class="brand">${LOGO}<span>ColorHub</span></div><span class="bar-r"><button class="icon-btn" data-eye aria-label="Color eye: name what the camera sees">${ICON_CAM}</button><button class="icon-btn" data-menu aria-label="Menu">${ICON.dots}</button></span></header>
    <p class="eyebrow kick">${h.kick}</p>
    <h1>${h.title}</h1>
    ${h.plates.length ? `<button class="plates" data-go aria-label="Start">${h.plates.map((c, k) => `<i style="--c:${c.h};--k:${k}"></i>`).join("")}</button>` : ""}
    <div class="meta-line">${h.meta.map(m => `<span>${m}</span>`).join("")}</div>
    ${h.cta ? `<button class="btn" data-${h.act}>${h.cta} ${ICON.arrow}</button>` : ""}
    <div class="sec-head today-head"><b>Today</b><span>${esc(new Date(Date.now() - 4 * 3600e3).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }))}</span></div>
    <div class="today">
      ${challengeCard()}
      <button class="daily-pin" data-daily style="--c:${dc.h}" data-ink="${ink(dc.h)}"><span class="eyebrow">Color of the day</span><b>${dAns ? esc(dc.n) : "What's this one called?"}</b><small>${dAns ? (dAns.ok ? "You named it · read its story" : "Read its story") : "Guess it, then read its story"}</small></button>
    </div>
    <button class="collection" data-palette aria-label="Your collection">
      <div class="coll-head"><span class="eyebrow">Your collection</span><span class="coll-n"><b data-count="${owned}">${owned}</b><small>/${ALL.length}</small></span></div>
      <div class="quilt">${quilt}</div>
      <div class="coll-foot"><span>${lrn.length ? `${lrn.length} in review` : "Recalled a day later"}</span><span>Spectrum →</span></div>
    </button>
    ${installHint()}
  `, "home", "learn");
  el.querySelector("[data-menu]").onclick = menu;
  el.querySelector("[data-eye]").onclick = () => eye();
  wireInstall(el);
  const go1 = () => due.length ? deck("review") : nu ? meet(nu) : null;
  el.querySelectorAll("[data-review],[data-learn],[data-go]").forEach(b => b.onclick = go1);
  el.querySelector("[data-palette]").onclick = () => { S.lens = "spectrum"; save(); go("explore"); };
  el.querySelector("[data-daily]").onclick = () => daily();
  const ch = el.querySelector("[data-challenge]"); if (ch) ch.onclick = () => chToday() ? challengeDone() : challenge();
  onKey = e => { if (e.key === "Enter") go1(); };
}

// The color sky: every name in the app placed by hue (angle) and strength (distance from the grey center),
// over a soft blurred color wheel. Unlearned names are faint stars; names in review glow; owned names are bright orbs.
function drawSky(host) {
  const stops = []; for (let t = 0; t <= 360; t += 12) stops.push(`${lchHex(62, 70, (450 - t) % 360)} ${t}deg`);
  const pts = mapPoints();
  const svg = pts.map(p => {
    const st = S.cards[p.c.id], x = p.x.toFixed(1), y = p.y.toFixed(1);
    if (st && st.own) return `<circle cx="${x}" cy="${y}" r="9" fill="${p.c.h}" opacity=".55" filter="url(#glow)"/><circle cx="${x}" cy="${y}" r="5.6" fill="${p.c.h}" stroke="#fff" stroke-opacity=".9" stroke-width="1.1"/>`;
    if (st) return `<circle cx="${x}" cy="${y}" r="7" fill="${p.c.h}" opacity=".45" filter="url(#glow)"/><circle cx="${x}" cy="${y}" r="3.4" fill="${p.c.h}"/>`;
    return `<circle class="star" cx="${x}" cy="${y}" r="1.25" fill="#fff" opacity=".34" style="--tw:${(3 + (p.x * 7 + p.y * 13) % 4).toFixed(1)}s"/>`;
  }).join("");
  host.innerHTML = `<div class="nebula" style="background:conic-gradient(${stops.join(",")})"></div>
    <svg viewBox="0 0 320 320" aria-hidden="true"><defs><filter id="glow" x="-1" y="-1" width="3" height="3"><feGaussianBlur stdDeviation="4"/></filter></defs>${svg}</svg>`;
}

// The color map: every name in the app on the CIELAB a*b* plane (hue = angle, strength = distance
// from the grey center). Owned names are solid, ones in progress are faint, the rest are outlines.
let MAP_PTS = null;
function mapPoints() {
  if (MAP_PTS) return MAP_PTS;
  const R = 132, cx = 160, cy = 160;
  const pts = ALL.map(c => {
    const [, C, H] = lch(c.h), r = R * Math.pow(Math.min(C, 110) / 110, .62), a = H * Math.PI / 180;
    const x = cx + r * Math.cos(a), y = cy - r * Math.sin(a);
    return { c, x, y, ox: x, oy: y };
  });
  // Nudge overlapping dots apart while a spring keeps each near its true hue and strength.
  for (let it = 0; it < 120; it++) {
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
      const p = pts[i], q = pts[j], dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy) || .01, min = 14.5;
      if (d < min) { const m = (min - d) / 2 / d; p.x -= dx * m; p.y -= dy * m; q.x += dx * m; q.y += dy * m; }
    }
    pts.forEach(p => { p.x += (p.ox - p.x) * .06; p.y += (p.oy - p.y) * .06; });
  }
  return (MAP_PTS = pts);
}
function drawMap(host) {
  const stops = []; for (let t = 0; t <= 360; t += 10) stops.push(`${lchHex(68, 48, (450 - t) % 360)} ${t}deg`);
  host.style.setProperty("--ring", `conic-gradient(${stops.join(",")})`);
  const dots = mapPoints().map(p => {
    const st = S.cards[p.c.id], cls = st && st.own ? "own" : st ? "learning" : "new";
    const attrs = cls === "own" ? `r="7" fill="${p.c.h}" stroke="#F3F3F1" stroke-width="1.6"`
      : cls === "learning" ? `r="6" fill="${p.c.h}" fill-opacity=".6"`
      : `r="5" fill="${p.c.h}" fill-opacity=".2"`;
    return `<circle class="dot ${cls}" data-id="${esc(p.c.id)}" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" ${attrs}/>`;
  }).join("");
  host.innerHTML = `<div class="ring"></div><svg viewBox="0 0 320 320" role="img" aria-label="Map of color names">
    <circle cx="160" cy="160" r="66" fill="none" stroke="rgba(255,255,255,.05)"/>
    <path d="M160 34V286M34 160H286" stroke="rgba(255,255,255,.035)"/>${dots}</svg>`;
  host.querySelector("svg").addEventListener("click", e => {
    const t = e.target.closest(".dot"); host.querySelectorAll(".tip").forEach(n => n.remove());
    if (!t) return;
    const c = ALL.find(x => x.id === t.dataset.id), st = S.cards[c.id];
    const tip = document.createElement("div"); tip.className = "tip";
    tip.textContent = st ? c.n : "Not learned yet";
    const s = host.clientWidth / 320; tip.style.left = t.getAttribute("cx") * s + "px"; tip.style.top = t.getAttribute("cy") * s + "px";
    host.appendChild(tip); setTimeout(() => tip.remove(), 1800);
  });
}

function menu() {
  const { sh, close } = sheet(`
    <button class="item" data-a="profile">Your eyes & tools ${ICON.chev}</button>
    <button class="item" data-a="place">Retake the placement test ${ICON.chev}</button>
    <button class="item" data-a="backup">Back up your progress ${ICON.chev}</button>
    <button class="item" data-a="restore">Restore a backup ${ICON.chev}</button>
    <button class="item" data-a="about">About the colors ${ICON.chev}</button>
    <button class="item" data-a="haptics">Haptics: ${S.haptics === false ? "off" : "on"} ${ICON.chev}</button>
    <button class="item" data-a="quick">Quick mode, swipe only: ${S.quick ? "on" : "off"} ${ICON.chev}</button>
    <button class="item danger" data-a="reset">Reset all progress</button>`);
  sh.onclick = e => {
    const a = e.target.closest("[data-a]"); if (!a) return;
    close();
    if (a.dataset.a === "profile") profileSetup(home);
    if (a.dataset.a === "backup") backupProgress();
    if (a.dataset.a === "restore") restoreProgress();
    if (a.dataset.a === "place") how();
    if (a.dataset.a === "about") about();
    if (a.dataset.a === "quick") { S.quick = !S.quick; save(); buzz(8); toast(`Quick mode ${S.quick ? "on" : "off"}`); }
    if (a.dataset.a === "haptics") { S.haptics = S.haptics === false; save(); buzz(12); toast(`Haptics ${S.haptics ? "on" : "off"}`); }
    if (a.dataset.a === "reset" && confirm("Erase all progress on this device?")) { S = fresh(); save(); MAP_PTS = null; welcome(); }
  };
}
function about() {
  sheet(`<h3>About the colors</h3>
    <p>Every swatch is a screen approximation. Hex values come from the CSS named colors, Wikipedia's list of colors and the xkcd color survey, where people named millions of colors. Where those disagree with what most people picture (CSS "khaki" is a pale yellow), we picked between them.</p>
    <p>Why names matter: Russian has separate words for light blue and dark blue, and Russian speakers tell those blues apart a little faster (Winawer et al., 2007). The effect is real but modest. Names give you handles; practice with feedback sharpens the eye.</p>
    <p>How the deck works: a color counts as yours once you recall it a day or more after learning it. Reviews space out from 1 day to 3, 7, 16, 35 and 90 days.</p>
    <p>Once you've recalled a name, some review cards ask you to type it (Say it) or build the color (Make it). Producing an answer from memory makes it stick better than recognizing it. Quick mode in the menu turns these off.</p>`);
}

// ---------- backup: progress lives on this device, so let people keep a copy ----------
function backupProgress() {
  const blob = new Blob([JSON.stringify(S, null, 1)], { type: "application/json" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `colorhub-backup-${today()}.json`; a.click();
  toast("Backup saved");
}
function restoreProgress() {
  const inp = document.createElement("input"); inp.type = "file"; inp.accept = "application/json,.json";
  inp.onchange = () => {
    const f = inp.files[0]; if (!f) return;
    f.text().then(t => {
      try { const d = JSON.parse(t); if (!d || d.v !== 1 || !d.cards) throw 0; S = Object.assign(fresh(), d); save(); toast("Progress restored"); go("learn"); }
      catch (e) { toast("That file isn't a ColorHub backup"); }
    });
  };
  inp.click();
}

// "Put it on your Home Screen": shown once you've finished a unit, until it's installed or dismissed
function installHint() {
  if (standalone() || S.installNo || !Object.keys(S.done).length || !(INSTALL_EVT || isIOS())) return "";
  return `<section class="inst"><div><b>Keep ColorHub on your Home Screen</b><span>${INSTALL_EVT ? "It opens full screen, like an app, and works offline." : "Tap Share, then “Add to Home Screen”. It opens full screen and works offline."}</span></div>
    <div class="inst-act">${INSTALL_EVT ? `<button class="btn ghost" data-install>Install ${ICON.arrow}</button>` : ""}<button class="btn ghost" data-inst-no>Not now</button></div></section>`;
}
function wireInstall(el) {
  const i = el.querySelector("[data-install]"), n = el.querySelector("[data-inst-no]");
  if (i) i.onclick = async () => { const e = INSTALL_EVT; INSTALL_EVT = null; e.prompt(); try { await e.userChoice; } catch (x) {} home(); };
  if (n) n.onclick = () => { S.installNo = true; save(); el.querySelector(".inst").remove(); };
}
const ICON_CAM = sv('<path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.8l1.4-2h4.6l1.4 2h1.8A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5z"/><circle cx="12" cy="12.5" r="3.4"/>', 22, 1.8);
