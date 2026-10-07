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
// a day key ("2026-10-07") as a short human date, for a photo or palette's default title
const fmtDay = k => { if (!k) return ""; const [y, m, d] = k.split("-").map(Number); if (!y || !m || !d) return ""; return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "long", day: "numeric" }); };

// ---------- state ----------
const KEY = "colorhub-v1";
// tab: last tab · gym: drill scores and history · daily: color-of-the-day answers · lightning: best score
const fresh = () => ({ v: 1, placed: null, start: 0, cards: {}, done: {}, tab: "learn", gym: { skills: {}, workouts: {} }, daily: {}, best: {} });
// Progress is never thrown away. An older save is migrated step by step (bump STATE_V and add a step when the
// shape changes); a save from a newer version is kept as it is; unknown keys always survive. A save that
// can't be read is copied aside (KEY + "-unreadable") before anything is written over it.
const STATE_V = 1;
function migrateState(d) {
  if (!d || typeof d !== "object" || Array.isArray(d)) return null;
  const s = Object.assign(fresh(), d);
  ["cards", "done", "daily", "best"].forEach(k => { if (!s[k] || typeof s[k] !== "object") s[k] = {}; });
  if (!s.gym || typeof s.gym !== "object") s.gym = { skills: {}, workouts: {} };
  s.gym.skills = s.gym.skills || {}; s.gym.workouts = s.gym.workouts || {};
  // a saved palette from before it had a stable id (for its own address and the one-step Back chain): give it one
  if (Array.isArray(s.palettes)) s.palettes.forEach(p => { if (p && !p.id) p.id = "pl" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); });
  if (!(s.v >= 1)) s.v = 1;   // unversioned saves had the v1 shape
  // future steps go here: if (s.v < 2) { …; s.v = 2; }
  return s;
}
let S;
try {
  const raw = localStorage.getItem(KEY);
  if (raw) { try { S = migrateState(JSON.parse(raw)); } catch (e) { S = null; } if (!S) try { localStorage.setItem(KEY + "-unreadable", raw); } catch (e) {} }
} catch (e) {}
S = S || fresh();
// Saving can fail (storage full, or blocked in a private window). Say so once, with a way to keep a copy.
let SAVE_WARNED = false;
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { if (!SAVE_WARNED) { SAVE_WARNED = true; setTimeout(saveFailed, 0); } } };
function saveFailed() {
  const bar = document.createElement("div");
  bar.className = "keep-warn"; bar.setAttribute("role", "alert");
  bar.innerHTML = `<p><b>Your progress isn't saving.</b> This browser's storage is full or blocked (private windows do this). Save a backup file so you don't lose it.</p>
    <div><button class="btn" data-k="backup">Save a backup</button><button class="icon-btn" data-k="x" aria-label="Dismiss">${ICON.x}</button></div>`;
  bar.onclick = e => { const b = e.target.closest("[data-k]"); if (!b) return; if (b.dataset.k === "backup") backupProgress(); bar.remove(); };
  document.body.appendChild(bar);
}
// A gentle reminder every ~30 days, once there's real progress, to download a backup (one tap).
const daysSince = k => k ? Math.round((new Date(today()) - new Date(k)) / 864e5) : Infinity;
function keepCard() {
  if (!S.placed || !(Object.keys(S.done).length || Object.keys(S.cards).length >= 10)) return "";
  if (daysSince(S.backedUp || S.placed.at) < 30 || daysSince(S.keepLater) < 30) return "";
  return `<section class="inst keep-card"><div><b>Back up your progress</b><span>It lives only on this device. A backup file brings it back on a new phone, or after the browser clears its data.</span></div>
    <div class="inst-act"><button class="btn ghost" data-keep-save>Save a backup ${ICON.arrow}</button><button class="btn ghost" data-keep-later>Later</button></div></section>`;
}
function wireKeep(el) {
  const card = el.querySelector(".keep-card"); if (!card) return;
  card.querySelector("[data-keep-save]").onclick = () => { backupProgress(); card.remove(); };
  card.querySelector("[data-keep-later]").onclick = () => { S.keepLater = today(); save(); card.remove(); };
}

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
  camera: sv('<path d="M4 8.5a2 2 0 0 1 2-2h1.2l1-2h7.6l1 2H18a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><circle cx="12" cy="13" r="3.6"/>', 22, 1.7),
  dice: sv('<rect x="4" y="4" width="16" height="16" rx="3.5"/><circle cx="8.4" cy="8.4" r="1.3" fill="currentColor"/><circle cx="15.6" cy="8.4" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="8.4" cy="15.6" r="1.3" fill="currentColor"/><circle cx="15.6" cy="15.6" r="1.3" fill="currentColor"/>', 22, 1.6),
};
const LOGO = `<svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">${["#E34234", "#FFBF00", "#50C878", "#007FFF"].map((c, i) =>
  `<rect x="9" y="1.5" width="8" height="22" rx="2.2" fill="${c}" stroke="#121212" stroke-width="1.4" transform="rotate(${-33 + i * 22} 13 22)"/>`).join("")}</svg>`;

// ---------- screen plumbing ----------
let onKey = null, timers = [];
const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); return t; };
if ("scrollRestoration" in history) history.scrollRestoration = "manual";
let cleanup = [];   // functions to run when the screen changes (stop animation loops, cameras...)
// ---------- motion ----------
// Screens crossfade (the old screen lingers as a fading ghost), content rises into view as you scroll, and big
// numbers count up. The signature: wherever a color opens, its chip grows into the new page's swatch.
// Everything is skipped under Reduce Motion.
let PENDING_MORPH = null, LAST_TAB = null;
// Tapping any of these opens a color; the swatch inside is the chip that grows. [data-morph-src] marks one by hand.
const MORPH_TRIGGER = "[data-morph-src], .pin-color, .pin-pair, .kin, .pchip, .tday[data-daily]";
const MORPH_CHIP = "[data-morph-src], .pc, .pair2>span, .kin>i, .pchip>i";
// The swatch a color page opens on: a hand-marked [data-morph], or a known hero.
const MORPH_TARGET = "[data-morph], .z-color, .c-hero, .d-swatch";
function morphFrom(el) {
  if (reduceMotion || !el) return;
  const src = el.matches("[data-morph-src]") ? el : el.querySelector(MORPH_CHIP) || el, r = src.getBoundingClientRect(), cs = getComputedStyle(src);
  if (!r.width) return;
  const img = src.tagName === "IMG" ? src.currentSrc || src.src : null;
  PENDING_MORPH = { r, bg: cs.backgroundColor, radius: cs.borderRadius, img, at: performance.now() };
}
document.addEventListener("click", e => { const t = e.target.closest && e.target.closest(MORPH_TRIGGER); if (t && app.contains(t)) morphFrom(t); }, true);
// The brand button on every tab's header (tabHead, above) is the one consistent way back to the honeycomb
// home (js/home.js). Delegated here, not wired per screen, so it works from Train, Explore and Studio alike.
document.addEventListener("click", e => { const b = e.target.closest && e.target.closest("[data-hm-brand]"); if (b && app.contains(b) && typeof hmHome === "function") hmHome(); });
function runMorph(root) {
  const m = PENDING_MORPH; PENDING_MORPH = null;
  // only right after the tap that asked for it, so a stale chip never flies into an unrelated screen
  const t = m && performance.now() - m.at < 700 && root.querySelector(MORPH_TARGET);
  if (!t) return;
  const r = t.getBoundingClientRect();
  if (!r.width || r.top > innerHeight) return;
  const fly = document.createElement(m.img ? "img" : "div");
  fly.className = "flyer";
  if (m.img) fly.src = m.img; else fly.style.background = m.bg;
  Object.assign(fly.style, { left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px", borderRadius: getComputedStyle(t).borderRadius });
  document.body.appendChild(fly);
  // the page's own text waits under the chip, then fades in as the chip lands
  t.style.visibility = "hidden";
  const sx = m.r.width / r.width, sy = m.r.height / r.height;
  fly.animate([{ transform: `translate(${m.r.left - r.left}px,${m.r.top - r.top}px) scale(${sx},${sy})`, borderRadius: m.radius }, { transform: "none" }],
    { duration: 360, easing: "cubic-bezier(.2,.85,.2,1)" }).onfinish = () => {
      t.style.visibility = "";
      [...t.children].forEach(c => c.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: "ease-out" }));
      fly.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120 }).onfinish = () => fly.remove();
    };
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

// Pinterest-style back (ROADMAP.md §17 job #2): every screen's scroll position is remembered against its own
// address, so landing back on it (the Back button, the swipe-back gesture, or Escape) puts you where you were.
// BACK_RENDER is set by whichever function is about to re-render "the screen behind this one" — xBack() and
// closeup()'s own back handler (js/explore.js) are the two places that do this; show() reads it once and clears
// it, so a plain forward navigation always starts at the top, same as before.
let BACK_RENDER = false;
const SCROLL_BY_HASH = new Map();

function show(html, cls = "", tab = null) {
  const leavingHash = ROUTE_NOW, leavingY = scrollY;
  const backNav = BACK_RENDER; BACK_RENDER = false;
  timers.forEach(clearTimeout); timers = []; onKey = null;
  cleanup.forEach(f => { try { f(); } catch (e) {} }); cleanup = [];
  document.querySelectorAll(".scrim,.sheet,.toast,.fade-ghost").forEach(n => n.remove());
  // a new screen always scrolls: release any scroll lock a sheet or panel left behind (leaving a screen with a sheet
  // open used to keep the body pinned, so the next page couldn't scroll)
  if (LOCKS) { LOCKS = 0; document.documentElement.classList.remove("sheet-open"); document.body.style.top = ""; }
  // remember where we were, so a later Back to this same address can put the scroll back
  if (leavingHash) SCROLL_BY_HASH.set(leavingHash, leavingY);
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
  // history: a tab's home replaces the current entry; any screen inside adds one, so the phone's back gesture works.
  // The entry carries the screen's address (#/color/teal…) and the page title: router.js.
  routeCommit(tab);
  if (tab) wireTabbar(tab);
  // forward nav starts at the top, same as always; a Back puts the scroll back where this address left it
  const backY = backNav ? SCROLL_BY_HASH.get(ROUTE_NOW) : null;
  if (backY) { const n = 2; let left = n; const tick = () => { if (--left > 0) return requestAnimationFrame(tick); scrollTo(0, backY); }; requestAnimationFrame(tick); }
  else window.scrollTo(0, 0);
  document.body.classList.remove("scrolled");
  const el = app.firstElementChild;
  const mb = tab && el.querySelector("[data-menu]"); if (mb) mb.onclick = () => menu();
  el.querySelectorAll("img").forEach(i => { if (i.complete && i.naturalWidth) i.classList.add("ld"); });
  requestAnimationFrame(() => { runMorph(el); reveal(el); countUp(el); });
  return el;
}
// Every tab's home opens with the same line: the brand on the left, the tab's own actions and the menu (⋯) on the right.
// The brand itself is the one consistent way back to the honeycomb home from inside Train, Explore and Studio
// (ROADMAP.md §12: "a slim back-to-honeycomb button top-left" — the simplest option was to make the thing
// that's already top-left on every tab do it, rather than adding a second button next to it).
const tabHead = (acts = "") => `<header class="bar"><button class="brand" data-hm-brand aria-label="Back to the honeycomb">${LOGO}<span>ColorHub</span></button><span class="bar-r">${acts}<button class="icon-btn" data-menu aria-label="Settings and more">${ICON.dots}</button></span></header>`;
// Every inner screen: back (or close, for a task) on the left, the title in the middle, an optional action on the right.
const navTop = (title = "", o = {}) => `<header class="nav-top"><button class="icon-btn" ${o.close ? `data-close aria-label="Close">${ICON.x}` : `data-back aria-label="Back">${ICON.back}`}</button><span class="nav-title">${title}</span><span class="nav-r">${o.right || ""}</span></header>`;
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
addEventListener("popstate", e => {
  if (!e.state && /^#\/./.test(location.hash)) return;   // a typed or linked address, not Back: router.js opens it
  const over = document.querySelector(".peek [data-back], .sheet");
  if (over) { if (over.matches(".sheet")) document.querySelector(".scrim")?.dispatchEvent(new PointerEvent("pointerdown")); else over.click(); try { history.pushState({ ch: 1 }, "", ROUTE_NOW || undefined); } catch (e) {} return; }
  const btn = app.querySelector("[data-back], [data-close]");
  HIST_POP = true;
  try { if (btn) btn.click(); else if (!app.querySelector(".tabbar")) go(S.tab || "learn"); } finally { HIST_POP = false; }
});
function go(tab) {
  S.tab = tab; save();
  // The two profile questions wait until they matter: the first visit to Train, where color vision tunes the drills.
  if (tab === "gym" && S.placed && !S.profile && !S.profileAsked) return profileSetup(gymHome, { why: "Before you train" });
  if (tab === "gym") return gymHome();
  if (tab === "explore") return exploreHome();
  if (tab === "studio") return studio();
  // The Today tab renders the honeycomb home (ROADMAP.md §12); js/learn.js's own home() is the classic Today
  // screen and still runs the bottom sheet's "Today" panel and every deep "Home" button after a deck or review.
  return typeof hmHome === "function" ? hmHome() : home();
}
const dailyDone = () => !!(S.daily && S.daily[today()]);
addEventListener("keydown", e => { if (onKey && !e.metaKey && !e.ctrlKey) onKey(e); });
function toast(msg) { document.querySelectorAll(".toast").forEach(n => n.remove()); const t = document.createElement("div"); t.className = "toast"; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 2300); }
const fanVars = (n, k) => `--k:${k};--mid:${(n - 1) / 2}`;

// ---------- menu ----------
// Lock page scrolling under a sheet or panel without losing your place (overflow:hidden on a 100%-tall body
// would jump to the top): pin the body at its current offset, then put the scroll back on release.
// iOS Safari ignores user-scalable=no, so stop its pinch-zoom gesture on pages directly (the honeycomb and other
// canvases read raw pointers, which this doesn't touch)
document.addEventListener("gesturestart", e => e.preventDefault(), { passive: false });
let LOCKS = 0, LOCK_Y = 0;
function lockScroll() {
  if (LOCKS++) return;
  LOCK_Y = scrollY; document.body.style.top = -LOCK_Y + "px"; document.documentElement.classList.add("sheet-open");
}
function unlockScroll() {
  if (!LOCKS || --LOCKS) return;
  document.documentElement.classList.remove("sheet-open"); document.body.style.top = ""; scrollTo(0, LOCK_Y);
}
function sheet(html) {
  const scrim = document.createElement("div"), sh = document.createElement("div");
  scrim.className = "scrim"; sh.className = "sheet"; sh.setAttribute("role", "dialog");
  sh.innerHTML = `<div class="grab"></div>${html}`;
  let gone = false;
  const close = () => {
    if (gone) return; gone = true; unlockScroll();
    if (reduceMotion) { scrim.remove(); sh.remove(); return; }
    scrim.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: "forwards" }).onfinish = () => scrim.remove();
    sh.animate([{ transform: getComputedStyle(sh).transform === "none" ? "none" : getComputedStyle(sh).transform }, { transform: "translateY(105%)" }], { duration: 240, easing: "cubic-bezier(.3,0,.8,.2)", fill: "forwards" }).onfinish = () => sh.remove();
    setTimeout(() => { scrim.remove(); sh.remove(); }, 400);
  };
  // anything outside closes it: a tap or a swipe on the dimmed page
  scrim.addEventListener("pointerdown", e => { e.preventDefault(); close(); });
  // drag the sheet down (from the grab bar, or anywhere once it's scrolled to the top) to close. Touch uses touch events
  // and claims the gesture (preventDefault) only for a downward drag at the top: with pointer events alone, iOS starts
  // its own scrolling, cancels the pointer, and the sheet snaps back (David: "swiping down doesn't close it").
  let y0 = null, x0 = 0, dy = 0, t0 = 0, on = false, lastScroll = 0;
  sh.addEventListener("scroll", () => { lastScroll = performance.now(); }, { passive: true });
  const end = () => {
    if (y0 == null) return; y0 = null;
    const fast = dy > 60 && dy / Math.max(1, performance.now() - t0) > .7;
    if (on && (dy > 120 || fast)) return close();
    on = false; sh.style.transition = "transform .3s var(--ease)"; sh.style.transform = "";
  };
  // a drag that starts while the sheet is scrolled (or still gliding to the top) is scrolling, never a close
  const start = (x, y, target) => { if (target.closest("input,textarea,select,input[type=range]") || ((sh.scrollTop > 0 || performance.now() - lastScroll < 180) && !target.closest(".grab"))) return; y0 = y; x0 = x; dy = 0; on = false; t0 = performance.now(); };
  const move = (x, y, e) => {
    if (y0 == null) return;
    const d = y - y0;
    if (!on) { if (d > 12 && d > Math.abs(x - x0) * 1.5 && sh.scrollTop <= 0) on = true; else if (d < -6 || Math.abs(x - x0) > 10) { y0 = null; return; } else return; }
    if (e && e.cancelable) e.preventDefault();
    dy = Math.max(0, d); sh.style.transition = "none"; sh.style.transform = `translateY(${dy}px)`;
  };
  sh.addEventListener("touchstart", e => { if (e.touches.length === 1) start(e.touches[0].clientX, e.touches[0].clientY, e.target); }, { passive: true });
  sh.addEventListener("touchmove", e => move(e.touches[0].clientX, e.touches[0].clientY, e), { passive: false });
  sh.addEventListener("touchend", end); sh.addEventListener("touchcancel", end);
  sh.addEventListener("pointerdown", e => { if (e.pointerType === "mouse") start(e.clientX, e.clientY, e.target); });
  sh.addEventListener("pointermove", e => { if (e.pointerType === "mouse") move(e.clientX, e.clientY, null); });
  sh.addEventListener("pointerup", e => { if (e.pointerType === "mouse") end(); });
  lockScroll();
  document.body.append(scrim, sh);
  return { sh, close };
}
