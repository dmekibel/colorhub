"use strict";
// ColorHub v1: placement test -> meet the unit -> swipe deck -> spaced review.
// No build step. Data lives in data/colors.js, progress in localStorage.
(() => {
const D = window.DATA;
const app = document.getElementById("app");
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const buzz = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} };

// ---------- color math (CIELAB, D65) ----------
const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
function lab(h) {
  let [r, g, b] = rgb(h).map(v => { v /= 255; return v > .04045 ? ((v + .055) / 1.055) ** 2.4 : v / 12.92; });
  let x = (r * .4124 + g * .3576 + b * .1805) / .95047, y = r * .2126 + g * .7152 + b * .0722, z = (r * .0193 + g * .1192 + b * .9505) / 1.08883;
  const f = t => t > .008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
  x = f(x); y = f(y); z = f(z);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
const lch = h => { const [L, a, b] = lab(h); let H = Math.atan2(b, a) * 180 / Math.PI; if (H < 0) H += 360; return [L, Math.hypot(a, b), H]; };
function lchHex(L, C, H) {
  const a = C * Math.cos(H * Math.PI / 180), b = C * Math.sin(H * Math.PI / 180);
  const fy = (L + 16) / 116, fx = a / 500 + fy, fz = fy - b / 200;
  const inv = t => t ** 3 > .008856 ? t ** 3 : (t - 16 / 116) / 7.787;
  const X = inv(fx) * .95047, Y = inv(fy), Z = inv(fz) * 1.08883;
  const lin = [X * 3.2406 - Y * 1.5372 - Z * .4986, -X * .9689 + Y * 1.8758 + Z * .0415, X * .0557 - Y * .204 + Z * 1.057];
  return "#" + lin.map(v => { v = v > .0031308 ? 1.055 * v ** (1 / 2.4) - .055 : 12.92 * v; return Math.round(clamp(v, 0, 1) * 255).toString(16).padStart(2, "0"); }).join("");
}
// Text color that stays readable on a swatch
const ink = h => lab(h)[0] > 64 ? "dark" : "light";

// ---------- data index ----------
const UNITS = D.units.map((u, i) => ({ ...u, i, colors: u.colors.map(c => ({ ...c, id: u.id + ":" + c.n })) }));
UNITS.forEach(u => u.colors.forEach(c => { c.unit = u; }));
const ALL = UNITS.flatMap(u => u.colors);
const BASICS = D.basics.map(([n, h]) => ({ n, h, id: "basic:" + n, basic: true }));
const BYNAME = new Map([...BASICS, ...ALL].map(c => [c.n.toLowerCase(), c]));
const neighbor = c => (c.vs && BYNAME.get(c.vs.toLowerCase())) || null;
const FIRST_T3 = UNITS.findIndex(u => u.tier === 3);

// ---------- days (a new day starts at 4am, so a late session still counts as tonight) ----------
const pad = n => String(n).padStart(2, "0");
const keyOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => keyOf(new Date(Date.now() - 4 * 3600e3));
const addDays = (k, n) => { const [y, m, d] = k.split("-").map(Number); return keyOf(new Date(y, m - 1, d + n)); };

// ---------- state ----------
const KEY = "colorhub-v1";
const fresh = () => ({ v: 1, placed: null, start: 0, cards: {}, done: {} });
let S;
try { S = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
if (!S || S.v !== 1) S = fresh();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };

// ---------- spaced review ----------
// After a unit, every color is due the next day, so the first gap crosses a night of sleep.
// Right on the first try in a review: the gap grows (3, 7, 16, 35, 90 days). Wrong: back to tomorrow.
const INTERVALS = [1, 3, 7, 16, 35, 90];
function learnUnit(u) {
  const t = today();
  u.colors.forEach(c => { if (!S.cards[c.id]) S.cards[c.id] = { b: 0, due: addDays(t, 1), since: t, own: false }; });
  S.done[u.id] = t;
  save();
}
function schedule(c, ok) {
  const st = S.cards[c.id]; if (!st) return;
  const t = today();
  if (ok) { st.b = Math.min(st.b + 1, INTERVALS.length - 1); st.due = addDays(t, INTERVALS[st.b]); st.own = true; }
  else { st.b = 0; st.due = addDays(t, 1); st.own = false; }
  st.last = t;
  save();
}
const dueList = () => { const t = today(); return ALL.filter(c => S.cards[c.id] && S.cards[c.id].due <= t).sort((a, b) => S.cards[a.id].due.localeCompare(S.cards[b.id].due)); };
// "Owned" = recalled right, unassisted, a day or more after learning. That is the only progress number.
const ownedCount = () => ALL.filter(c => S.cards[c.id] && S.cards[c.id].own).length;
const nextUnit = () => UNITS.find(u => u.i >= S.start && !S.done[u.id]) || null;
const unitLabel = u => `Unit ${u.i + 1} · ${D.tiers[u.tier].short}`;

// ---------- icons ----------
const sv = (d, s = 22, w = 2) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICON = {
  x: sv('<path d="M6 6l12 12M18 6L6 18"/>'),
  xBig: sv('<path d="M6 6l12 12M18 6L6 18"/>', 30, 2.4),
  check: sv('<path d="M4.5 12.5l5 5L19.5 7"/>', 30, 2.4),
  checkS: sv('<path d="M4.5 12.5l5 5L19.5 7"/>', 13, 3.2),
  xS: sv('<path d="M6 6l12 12M18 6L6 18"/>', 13, 3.2),
  dots: sv('<circle cx="5" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="19" cy="12" r="1.3" fill="currentColor"/>'),
  arrow: sv('<path d="M5 12h14M13 6l6 6-6 6"/>', 20),
  up: sv('<path d="M6 15l6-6 6 6"/>', 18),
  chev: sv('<path d="M9 6l6 6-6 6"/>', 18),
};
const LOGO = `<svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">${["#E34234", "#FFBF00", "#50C878", "#007FFF"].map((c, i) =>
  `<rect x="9" y="1.5" width="8" height="22" rx="2.2" fill="${c}" stroke="#121212" stroke-width="1.4" transform="rotate(${-33 + i * 22} 13 22)"/>`).join("")}</svg>`;

// ---------- screen plumbing ----------
let onKey = null, timers = [];
const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); return t; };
function show(html, cls = "") {
  timers.forEach(clearTimeout); timers = []; onKey = null;
  document.querySelectorAll(".scrim,.sheet,.toast").forEach(n => n.remove());
  app.innerHTML = `<div class="screen ${cls}">${html}</div>`;
  window.scrollTo(0, 0);
  return app.firstElementChild;
}
addEventListener("keydown", e => { if (onKey && !e.metaKey && !e.ctrlKey) onKey(e); });
function toast(msg) { document.querySelectorAll(".toast").forEach(n => n.remove()); const t = document.createElement("div"); t.className = "toast"; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 2300); }
const fanVars = (n, k) => `--k:${k};--mid:${(n - 1) / 2}`;

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
  el.querySelector("[data-go]").onclick = how;
  onKey = e => { if (e.key === "Enter") how(); };
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
    queue = [
      ...shuffle(BASICS.filter(b => b.n !== "Black" && b.n !== "White")).slice(0, 3).map(c => ({ c, dir: "f", stage: 1 })),
      ...sampleTier(2, 10).map(c => ({ c, dir: "f", stage: 2 })),
    ];
  } else if (mode === "learn") {
    queue = shuffle(opts.unit.colors).map(c => ({ c, dir: "f" }));
  } else {
    // Reverse cards (name to color) join once a color has been recalled at least once.
    queue = dueList().slice(0, 30).map(c => ({ c, dir: S.cards[c.id].b % 2 ? "r" : "f" }));
  }
  if (!queue.length) return home();

  const uniq = [...new Map(queue.map(it => [it.c.id, it.c])).values()];
  const first = new Map();          // id -> right on first try?
  const log = [];                   // placement answers
  let cur = null, nxt = null, revealed = false, busy = false, ended = false, extended = false;

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

  const keyOfItem = it => it.c.id + "|" + it.dir;
  function cardEl(it, isNext) {
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
      </div>
      <div class="stamp yes">${ICON.checkS}Got it</div><div class="stamp no">${ICON.xS}Again</div>`;
    return d;
  }

  function mount() {
    if (!queue.length || ended) return finish();
    if (nxt && nxt.dataset.key === keyOfItem(queue[0])) { cur = nxt; cur.style.transition = cur.style.transform = cur.style.opacity = ""; cur.classList.remove("next"); }
    else { if (nxt) nxt.remove(); cur = cardEl(queue[0]); stage.appendChild(cur); }
    nxt = queue[1] ? cardEl(queue[1], true) : null;
    if (nxt) stage.insertBefore(nxt, cur);
    revealed = false;
    bind(cur);
    setFoot();
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
      else queue.splice(Math.min(2, queue.length), 0, it); // comes back after two other cards
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
function home() {
  if (!S.placed) return welcome();
  const due = dueList(), nu = nextUnit(), owned = ownedCount();
  const t2n = UNITS.filter(u => u.tier === 2).length, t3n = UNITS.length - t2n;
  const doneN = UNITS.filter(u => S.done[u.id]).length;
  const track = UNITS.map(u => {
    const cls = S.done[u.id] ? "done" : u === nu ? "cur" : u.i < S.start ? "skip" : "";
    const g = `linear-gradient(90deg,${u.colors.map(c => c.h).join(",")})`;
    return `<i class="${cls}" style="--g:${g}" title="${esc(u.title)}"></i>`;
  }).join("");

  let dock;
  if (due.length) {
    dock = `<div class="next-card">
      <div class="row"><div class="chipfan">${due.slice(0, 7).map((c, k, a) => `<i style="--c:${c.h};${fanVars(a.length, k)}"></i>`).join("")}</div>
        <div><p class="eyebrow">Daily review</p><h3>${due.length} color${due.length > 1 ? "s" : ""} due</h3><p class="sub">${nu ? `Then: ${esc(nu.title)}` : "Keep them yours"}</p></div></div>
      <button class="btn" data-review>Review ${ICON.arrow}</button></div>`;
  } else if (nu) {
    dock = `<div class="next-card">
      <div class="row"><div class="chipfan">${nu.colors.map((c, k) => `<i style="--c:${c.h};${fanVars(nu.colors.length, k)}"></i>`).join("")}</div>
        <div><p class="eyebrow">Unit ${nu.i + 1} of ${UNITS.length}</p><h3>${esc(nu.title)}</h3><p class="sub">${nu.colors.length} colors · about ${Math.max(2, Math.round(nu.colors.length * 15 / 60))} min</p></div></div>
      <button class="btn" data-learn>${doneN ? "Continue" : "Start"} ${ICON.arrow}</button></div>`;
  } else {
    dock = `<div class="next-card"><div class="row"><div><p class="eyebrow">All caught up</p><h3>Path complete</h3><p class="sub">More tiers are coming. Your reviews keep the names you have.</p></div></div></div>`;
  }

  const el = show(`
    <header class="bar"><div class="brand">${LOGO}<span>ColorHub</span></div><button class="icon-btn" data-menu aria-label="Menu">${ICON.dots}</button></header>
    <section class="map-wrap">
      <div class="map" id="map"></div>
      <div class="owned"><b>${owned}</b><span>of ${ALL.length} color names you own</span></div>
      <p class="caption">Every color name in the app, placed by hue. A dot lights up once you recall its name a day after learning it.</p>
    </section>
    <section class="path">
      <div class="head"><b>The path</b><span>${doneN} of ${UNITS.length} units</span></div>
      <div class="track">${track}</div>
      <div class="tierlbl"><span style="--n:${t2n}">In-betweens</span><span style="--n:${t3n}">Designer's vocabulary</span></div>
    </section>
    <div class="dock">${dock}</div>
  `, "home");
  drawMap(el.querySelector("#map"));
  el.querySelector("[data-menu]").onclick = menu;
  const rv = el.querySelector("[data-review]"), ln = el.querySelector("[data-learn]");
  if (rv) rv.onclick = () => deck("review");
  if (ln) ln.onclick = () => meet(nu);
  onKey = e => { if (e.key === "Enter") rv ? deck("review") : ln ? meet(nu) : null; };
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

// ---------- menu ----------
function sheet(html) {
  const scrim = document.createElement("div"), sh = document.createElement("div");
  scrim.className = "scrim"; sh.className = "sheet"; sh.setAttribute("role", "dialog");
  sh.innerHTML = `<div class="grab"></div>${html}`;
  const close = () => { scrim.remove(); sh.remove(); };
  scrim.onclick = close;
  document.body.append(scrim, sh);
  return { sh, close };
}
function menu() {
  const { sh, close } = sheet(`
    <button class="item" data-a="place">Retake the placement test ${ICON.chev}</button>
    <button class="item" data-a="about">About the colors ${ICON.chev}</button>
    <button class="item danger" data-a="reset">Reset all progress</button>`);
  sh.onclick = e => {
    const a = e.target.closest("[data-a]"); if (!a) return;
    close();
    if (a.dataset.a === "place") how();
    if (a.dataset.a === "about") about();
    if (a.dataset.a === "reset" && confirm("Erase all progress on this device?")) { S = fresh(); save(); MAP_PTS = null; welcome(); }
  };
}
function about() {
  sheet(`<h3>About the colors</h3>
    <p>Every swatch is a screen approximation. Hex values come from the CSS named colors, Wikipedia's list of colors and the xkcd color survey, where people named millions of colors. Where those disagree with what most people picture (CSS "khaki" is a pale yellow), we picked between them.</p>
    <p>Why names matter: Russian has separate words for light blue and dark blue, and Russian speakers tell those blues apart a little faster (Winawer et al., 2007). The effect is real but modest. Names give you handles; practice with feedback sharpens the eye.</p>
    <p>How the deck works: a color counts as yours once you recall it a day or more after learning it. Reviews space out from 1 day to 3, 7, 16, 35 and 90 days.</p>`);
}

// ---------- boot ----------
S.placed ? home() : welcome();
})();
