"use strict";
// ColorHub core: utilities, color math, data index, progress state, screen plumbing, tab bar.
// Plain scripts (no modules, no build). Top-level names are shared across js/*.js, so keep them unique.
const D = window.DATA;
const app = document.getElementById("app");
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
// Haptics: Android vibrates; iPhone Safari has no vibrate(), but toggling a hidden switch control
// (<input type=checkbox switch>, Safari 17.4+) gives a light system tap. A wrong answer taps twice.
let HAPTIC = null, lastTap = 0;
function iosTap() {
  const now = performance.now(); if (now - lastTap < 35) return; lastTap = now;
  if (!HAPTIC) { HAPTIC = document.createElement("label"); HAPTIC.setAttribute("aria-hidden", "true"); HAPTIC.style.cssText = "position:fixed;left:-99px;top:0;opacity:0;pointer-events:none"; HAPTIC.innerHTML = '<input type="checkbox" switch tabindex="-1">'; document.body.appendChild(HAPTIC); }
  HAPTIC.click();
}
const buzz = ms => {
  if (typeof S !== "undefined" && S && S.haptics === false) return;
  try { if (navigator.vibrate) { navigator.vibrate(ms); return; } } catch (e) {}
  iosTap(); if (Array.isArray(ms) && ms.length > 2) setTimeout(iosTap, 90);
};
// Install: Android/desktop Chrome hands us a prompt; iPhone needs Share > Add to Home Screen.
let INSTALL_EVT = null;
addEventListener("beforeinstallprompt", e => { e.preventDefault(); INSTALL_EVT = e; });
const standalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const isIOS = () => /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

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
// Lab -> sRGB channels (0..1, unclamped, so callers can test whether a color is on screen)
function labRgb(L, a, b) {
  const fy = (L + 16) / 116, fx = a / 500 + fy, fz = fy - b / 200;
  const inv = t => t ** 3 > .008856 ? t ** 3 : (t - 16 / 116) / 7.787;
  const X = inv(fx) * .95047, Y = inv(fy), Z = inv(fz) * 1.08883;
  return [X * 3.2406 - Y * 1.5372 - Z * .4986, -X * .9689 + Y * 1.8758 + Z * .0415, X * .0557 - Y * .204 + Z * 1.057]
    .map(v => v > .0031308 ? 1.055 * v ** (1 / 2.4) - .055 : 12.92 * v);
}
const inGamut = (L, a, b) => labRgb(L, a, b).every(v => v >= -.002 && v <= 1.002);
const labHex = (L, a, b) => "#" + labRgb(L, a, b).map(v => Math.round(clamp(v, 0, 1) * 255).toString(16).padStart(2, "0")).join("").toUpperCase();
const lchHex = (L, C, H) => labHex(L, C * Math.cos(H * Math.PI / 180), C * Math.sin(H * Math.PI / 180));
// CIEDE2000: perceived difference between two colors (about 1 = the smallest difference most people see side by side)
function de2000(h1, h2) {
  const [L1, a1, b1] = Array.isArray(h1) ? h1 : lab(h1), [L2, a2, b2] = Array.isArray(h2) ? h2 : lab(h2), rad = Math.PI / 180;
  const Cb = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2, G = .5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)));
  const a1p = a1 * (1 + G), a2p = a2 * (1 + G), C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2);
  const hp = (b, a) => { if (!b && !a) return 0; const t = Math.atan2(b, a) / rad; return t < 0 ? t + 360 : t; };
  const h1p = hp(b1, a1p), h2p = hp(b2, a2p), dL = L2 - L1, dC = C2p - C1p;
  let dh = 0; if (C1p * C2p) { dh = h2p - h1p; if (dh > 180) dh -= 360; else if (dh < -180) dh += 360; }
  const dH = 2 * Math.sqrt(C1p * C2p) * Math.sin(dh * rad / 2), Lb = (L1 + L2) / 2, Cbp = (C1p + C2p) / 2;
  let hb = h1p + h2p; if (C1p * C2p) { if (Math.abs(h1p - h2p) > 180) hb += h1p + h2p < 360 ? 360 : -360; hb /= 2; }
  const T = 1 - .17 * Math.cos((hb - 30) * rad) + .24 * Math.cos(2 * hb * rad) + .32 * Math.cos((3 * hb + 6) * rad) - .2 * Math.cos((4 * hb - 63) * rad);
  const Rc = 2 * Math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7)), dTh = 30 * Math.exp(-(((hb - 275) / 25) ** 2));
  const Sl = 1 + .015 * (Lb - 50) ** 2 / Math.sqrt(20 + (Lb - 50) ** 2), Sc = 1 + .045 * Cbp, Sh = 1 + .015 * Cbp * T, Rt = -Math.sin(2 * dTh * rad) * Rc;
  return Math.sqrt((dL / Sl) ** 2 + (dC / Sc) ** 2 + (dH / Sh) ** 2 + Rt * (dC / Sc) * (dH / Sh));
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
// tab: last tab · gym: drill scores and history · daily: color-of-the-day answers · lightning: best score
const fresh = () => ({ v: 1, placed: null, start: 0, cards: {}, done: {}, tab: "learn", gym: { skills: {}, workouts: {} }, daily: {}, best: {} });
let S;
try { S = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
S = S && S.v === 1 ? Object.assign(fresh(), S) : fresh();
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
// by: what graded it. "swipe" (self-graded practice) or a check ("pick" | "say" | "make"); only a check, a day or more
// after learning, makes a name yours (pickOwn in pickit.js).
function schedule(c, ok, by = "swipe") {
  const st = S.cards[c.id]; if (!st) return;
  const t = today();
  if (ok) { st.b = Math.min(st.b + 1, INTERVALS.length - 1); st.due = addDays(t, INTERVALS[st.b]); }
  else { st.b = 0; st.due = addDays(t, 1); }
  pickOwn(st, ok, by, t);
  st.last = t;
  save();
}
const dueList = () => { const t = today(); return ALL.filter(c => S.cards[c.id] && S.cards[c.id].due <= t).sort((a, b) => S.cards[a.id].due.localeCompare(S.cards[b.id].due)); };
// "Yours" = picked or named right (an objective check), a day or more after learning. That is the only progress number.
// Self-graded swipes don't count (isMine in pickit.js).
const ownedCount = () => ALL.filter(c => isMine(S.cards[c.id])).length;
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
  back: sv('<path d="M15 6l-6 6 6 6"/>'),
  share: sv('<path d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>', 20),
  learn: sv('<rect x="7" y="3" width="12" height="15" rx="2.5"/><path d="M4 7.5V18a3 3 0 0 0 3 3h8.5"/>', 24, 1.8),
  gym: sv('<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3.2"/>', 24, 1.8),
  explore: sv('<circle cx="6" cy="7" r="2.6"/><circle cx="18" cy="6" r="2.6"/><circle cx="13" cy="18" r="2.6"/><path d="M8.5 6.7l6.9-.5M7.3 9.3l4.4 6.4M17 8.5l-2.9 7"/>', 24, 1.8),
  search: sv('<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.3-4.3"/>', 20),
  play: sv('<path d="M8 5.5v13l10-6.5z" fill="currentColor"/>', 18),
  today: sv('<rect x="6.5" y="3.5" width="11" height="17" rx="2"/><path d="M6.5 14.5h11"/><path d="M9.5 17.5h5"/>', 24, 1.7),
  compass: sv('<circle cx="12" cy="12" r="8.5"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>', 24, 1.7),
  palette: sv('<path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.3 0 1.9-.9 1.6-2-.4-1.4.4-2.6 1.9-2.6H17a3.5 3.5 0 0 0 3.5-3.5c0-4.9-3.8-8.9-8.5-8.9z"/><circle cx="7.8" cy="11.2" r="1.1" fill="currentColor"/><circle cx="10.5" cy="7.6" r="1.1" fill="currentColor"/><circle cx="14.8" cy="7.9" r="1.1" fill="currentColor"/>', 24, 1.7),
  bolt: sv('<path d="M13 2.5L4.5 13.5H11l-1 8 8.5-11H12z"/>', 20),
};
const LOGO = `<svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">${["#E34234", "#FFBF00", "#50C878", "#007FFF"].map((c, i) =>
  `<rect x="9" y="1.5" width="8" height="22" rx="2.2" fill="${c}" stroke="#121212" stroke-width="1.4" transform="rotate(${-33 + i * 22} 13 22)"/>`).join("")}</svg>`;

// ---------- screen plumbing ----------
let onKey = null, timers = [];
const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); return t; };
if ("scrollRestoration" in history) history.scrollRestoration = "manual";
let cleanup = [];   // functions to run when the screen changes (stop animation loops, cameras...)
// ---------- motion ----------
// Screens crossfade (the old screen lingers as a fading ghost), a tapped pin can fly into the next screen's hero,
// content rises into view as you scroll, and big numbers count up. Everything is skipped under Reduce Motion.
let PENDING_MORPH = null, LAST_TAB = null;
function morphFrom(el) {
  if (reduceMotion || !el) return;
  const src = el.querySelector("[data-morph-src]") || el, r = src.getBoundingClientRect(), cs = getComputedStyle(src);
  const img = src.tagName === "IMG" ? src.currentSrc || src.src : null;
  PENDING_MORPH = { r, bg: cs.backgroundColor, radius: cs.borderRadius, img };
}
function runMorph(root) {
  const m = PENDING_MORPH; PENDING_MORPH = null;
  const t = m && root.querySelector("[data-morph]");
  if (!t) return;
  const r = t.getBoundingClientRect();
  if (!r.width) return;
  const fly = document.createElement(m.img ? "img" : "div");
  fly.className = "flyer";
  if (m.img) fly.src = m.img; else fly.style.background = m.bg;
  Object.assign(fly.style, { left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px", borderRadius: getComputedStyle(t).borderRadius });
  document.body.appendChild(fly);
  t.style.visibility = "hidden";
  const sx = m.r.width / r.width, sy = m.r.height / r.height;
  fly.animate([{ transform: `translate(${m.r.left - r.left}px,${m.r.top - r.top}px) scale(${sx},${sy})`, borderRadius: m.radius }, { transform: "none" }],
    { duration: 520, easing: "cubic-bezier(.2,.85,.2,1)" }).onfinish = () => { t.style.visibility = ""; fly.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 140 }).onfinish = () => fly.remove(); };
}
// content rises in as it scrolls into view, in a short cascade
const REVEAL = ".pin,.skill,.next-card,.facet,.kin,.res,.chip,.pal-name,.cg,.story-card,.ptg-card,.lab,.workout,.play-row,.palette,.codes,.compare,.z-sum,.p-body,.h-item,.az button,.sky-count";
function reveal(root) {
  if (reduceMotion || !("IntersectionObserver" in window)) return;
  const els = [...root.querySelectorAll(REVEAL)];
  els.forEach(e => e.classList.add("rv"));
  let batch = 0, raf = 0;
  const io = new IntersectionObserver(es => {
    es.forEach(e => { if (!e.isIntersecting) return; io.unobserve(e.target); e.target.style.transitionDelay = Math.min(batch++, 10) * 45 + "ms"; e.target.classList.add("in"); });
    cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { batch = 0; });
  }, { rootMargin: "0px 0px -6% 0px" });
  els.forEach(e => io.observe(e));
  cleanup.push(() => io.disconnect());
}
// odometer-style numbers: <b data-count="68">
function countUp(root) {
  root.querySelectorAll("[data-count]").forEach(el => {
    const to = parseFloat(el.dataset.count), dec = (el.dataset.count.split(".")[1] || "").length;
    if (reduceMotion || !isFinite(to)) { el.textContent = el.dataset.count; return; }
    const t0 = performance.now(), dur = 900 + Math.min(600, to * 6);
    const step = t => { const k = Math.min(1, (t - t0) / dur), e = 1 - (1 - k) ** 4; el.textContent = (to * e).toFixed(dec); if (k < 1) requestAnimationFrame(step); };
    el.textContent = (0).toFixed(dec); requestAnimationFrame(step);
    setTimeout(() => { el.textContent = to.toFixed(dec); }, dur + 150);   // lands even if animation frames are paused
  });
}
document.addEventListener("load", e => { if (e.target.tagName === "IMG") e.target.classList.add("ld"); }, true);
addEventListener("scroll", () => document.body.classList.toggle("scrolled", scrollY > 24), { passive: true });

function show(html, cls = "", tab = null) {
  timers.forEach(clearTimeout); timers = []; onKey = null;
  cleanup.forEach(f => { try { f(); } catch (e) {} }); cleanup = [];
  document.querySelectorAll(".scrim,.sheet,.toast,.fade-ghost").forEach(n => n.remove());
  // the old screen fades out underneath the new one
  const old = app.firstElementChild;
  if (old && !reduceMotion) {
    const ghost = document.createElement("div"), y = scrollY;
    ghost.className = "fade-ghost"; ghost.style.top = -y + "px";
    ghost.appendChild(old);
    document.body.appendChild(ghost);
    ghost.animate([{ opacity: 1, transform: "scale(1)" }, { opacity: 0, transform: "scale(.985)" }], { duration: 260, easing: "ease-out", fill: "forwards" }).onfinish = () => ghost.remove();
  }
  app.innerHTML = `<div class="screen ${cls}${tab ? " has-tabs" : ""}">${html}</div>${tab ? tabbar(tab) : ""}`;
  document.documentElement.classList.toggle("booth", /\b(deck|drill|station|meet|daily|fixed|eye|cx)\b/.test(cls));
  // history: a tab's home replaces the current entry; any screen inside adds one, so the phone's back gesture works
  try {
    if (tab) history.replaceState({ ch: 1, tab }, "");
    else if (HIST_POP) history.replaceState({ ch: 1 }, "");
    else history.pushState({ ch: 1 }, "");
  } catch (e) {}
  if (tab) wireTabbar(tab);
  window.scrollTo(0, 0); document.body.classList.remove("scrolled");
  const el = app.firstElementChild;
  el.querySelectorAll("img").forEach(i => { if (i.complete && i.naturalWidth) i.classList.add("ld"); });
  requestAnimationFrame(() => { runMorph(el); reveal(el); countUp(el); });
  return el;
}
// Four tabs, one job each: Today (the path and the daily things), Train (the eye), Explore (read), Studio (make).
const TABS = [["learn", "Today", "today"], ["gym", "Train", "gym"], ["explore", "Explore", "compass"], ["studio", "Studio", "palette"]];
// The tab bar: three mono words on a blurred strip with a hairline marker under the current one.
// It slides away while you scroll down and comes back when you scroll up.
const tabbar = active => `<nav class="tabbar" aria-label="Sections"><div class="tabs">${TABS.map(([id, label, icon]) =>
  `<button class="tab${id === active ? " on" : ""}" data-tab="${id}" aria-current="${id === active}">${ICON[icon]}<span>${label}</span>${id === "learn" && !dailyDone() && active !== "learn" ? '<i class="badge"></i>' : ""}</button>`).join("")}</div></nav>`;
function wireTabbar(active) {
  const nav = app.querySelector(".tabbar"); if (!nav) return;
  const wrap = nav.querySelector(".tabs"), tabs = [...nav.querySelectorAll(".tab")], ind = document.createElement("i");
  ind.className = "tab-ind"; wrap.prepend(ind);
  const place = (id, anim) => {
    const b = tabs.find(t => t.dataset.tab === id); if (!b) return;
    const r = b.getBoundingClientRect(), w = wrap.getBoundingClientRect();
    ind.style.transition = anim ? "" : "none"; ind.style.transform = `translateX(${r.left - w.left}px)`; ind.style.width = r.width + "px";
  };
  place(LAST_TAB || active, false);
  requestAnimationFrame(() => requestAnimationFrame(() => place(active, true)));
  LAST_TAB = active;
  const setMin = v => nav.classList.toggle("min", v);
  tabs.forEach(b => b.onclick = () => go(b.dataset.tab));
  let lastY = scrollY;
  const onScroll = () => {
    const y = scrollY, dy = y - lastY;
    if (y < 40 || dy < -6) setMin(false); else if (dy > 6) setMin(true);
    lastY = y;
  };
  addEventListener("scroll", onScroll, { passive: true });
  cleanup.push(() => removeEventListener("scroll", onScroll));
}
// Back gesture / browser back: close a sheet or panel first; otherwise press the screen's own back or close
// button (so each screen keeps its own idea of "back"); with none, return to the current tab's home.
let HIST_POP = false;
addEventListener("popstate", () => {
  const over = document.querySelector(".peek [data-back], .sheet");
  if (over) { if (over.matches(".sheet")) document.querySelector(".scrim")?.dispatchEvent(new PointerEvent("pointerdown")); else over.click(); try { history.pushState({ ch: 1 }, ""); } catch (e) {} return; }
  const btn = app.querySelector("[data-back], [data-close]");
  HIST_POP = true;
  try { if (btn) btn.click(); else if (!app.querySelector(".tabbar")) go(S.tab || "learn"); } finally { HIST_POP = false; }
});
function go(tab) {
  S.tab = tab; save();
  if (tab === "gym") return gymHome();
  if (tab === "explore") return exploreHome();
  if (tab === "studio") return studio();
  return home();
}
const dailyDone = () => !!(S.daily && S.daily[today()]);
addEventListener("keydown", e => { if (onKey && !e.metaKey && !e.ctrlKey) onKey(e); });
function toast(msg) { document.querySelectorAll(".toast").forEach(n => n.remove()); const t = document.createElement("div"); t.className = "toast"; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 2300); }
const fanVars = (n, k) => `--k:${k};--mid:${(n - 1) / 2}`;

// ---------- menu ----------
function sheet(html) {
  const scrim = document.createElement("div"), sh = document.createElement("div");
  scrim.className = "scrim"; sh.className = "sheet"; sh.setAttribute("role", "dialog");
  sh.innerHTML = `<div class="grab"></div>${html}`;
  let gone = false;
  const close = () => {
    if (gone) return; gone = true; document.documentElement.classList.remove("sheet-open");
    if (reduceMotion) { scrim.remove(); sh.remove(); return; }
    scrim.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: "forwards" }).onfinish = () => scrim.remove();
    sh.animate([{ transform: getComputedStyle(sh).transform === "none" ? "none" : getComputedStyle(sh).transform }, { transform: "translateY(105%)" }], { duration: 240, easing: "cubic-bezier(.3,0,.8,.2)", fill: "forwards" }).onfinish = () => sh.remove();
    setTimeout(() => { scrim.remove(); sh.remove(); }, 400);
  };
  // anything outside closes it: a tap or a swipe on the dimmed page
  scrim.addEventListener("pointerdown", e => { e.preventDefault(); close(); });
  // drag the sheet down (from the grab bar, or anywhere once it's scrolled to the top) to close
  let y0 = null, dy = 0;
  sh.addEventListener("pointerdown", e => { if (e.target.closest("input,textarea,select") || (sh.scrollTop > 0 && !e.target.closest(".grab"))) return; y0 = e.clientY; dy = 0; });
  sh.addEventListener("pointermove", e => { if (y0 == null) return; dy = Math.max(0, e.clientY - y0); if (dy > 6) { sh.style.transition = "none"; sh.style.transform = `translateY(${dy}px)`; } });
  const end = () => { if (y0 == null) return; y0 = null; if (dy > 90) return close(); sh.style.transition = "transform .3s var(--ease)"; sh.style.transform = ""; };
  sh.addEventListener("pointerup", end); sh.addEventListener("pointercancel", end);
  document.documentElement.classList.add("sheet-open");
  document.body.append(scrim, sh);
  return { sh, close };
}
