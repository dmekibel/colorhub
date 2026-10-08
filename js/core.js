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
  if (typeof sndBuzz === "function") try { sndBuzz(ms); } catch (e) {}   // js/sound.js: the haptic vocabulary is also the sound vocabulary
  if (typeof S !== "undefined" && S && S.haptics === false) return;
  try { if (navigator.vibrate) { navigator.vibrate(ms); return; } } catch (e) {}
  iosTap(); if (Array.isArray(ms) && ms.length > 2) setTimeout(iosTap, 90);
};
// Install: Android/desktop Chrome hands us a prompt; iPhone needs Share > Add to Home Screen.
let INSTALL_EVT = null;
addEventListener("beforeinstallprompt", e => { e.preventDefault(); INSTALL_EVT = e; });
const standalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const isIOS = () => /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
// A Home Screen app on iPhone with the translucent status bar gets a layout viewport that's short by the status
// bar's height, so everything pinned to bottom:0 stopped above a black band and the Rooms corner sat too high
// (David's iPhone 16 Pro Max screenshot, 2026-10-08). --vb is that missing strip (0 everywhere else); the shell
// in css/menus2.css reaches through it.
function vbFix() {
  let gap = 0, full = 0;
  try {
    if (standalone() && isIOS()) {
      full = innerHeight > innerWidth ? Math.max(screen.width, screen.height) : Math.min(screen.width, screen.height);
      // measure where bottom:0 really lands, not just innerHeight: on iOS 26 a Home Screen app can report innerHeight
      // as the whole screen while fixed layers still stop a status bar short (David's Arrange-sheet screenshot,
      // 2026-10-08: --vb came out 0 and the sheet ended 61 px above the edge). The larger of the two is the strip.
      const pr = document.createElement("div");
      pr.style.cssText = "position:fixed;left:0;bottom:0;width:1px;height:1px;visibility:hidden;pointer-events:none";
      document.documentElement.appendChild(pr);
      const pb = pr.getBoundingClientRect().bottom; pr.remove();
      gap = Math.round(Math.max(full - innerHeight, full - pb));
      if (gap < 1 || gap > 120) gap = 0;
    }
  } catch (e) {}
  // (re-enabled 2026-10-08. It once "pushed Home into a black bar": .fixed screens are 100dvh with overflow:hidden, so
  // the stage reached into the strip but was clipped there. The map screens now size to the whole screen themselves
  // (--app-full, css/menus2.css), whichever of innerHeight or 100dvh is the short one. David's 16 Pro Max screenshot:
  // the strip is the status bar, 62 px.)
  const de = document.documentElement;
  de.style.setProperty("--vb", gap + "px");
  if (full) de.style.setProperty("--app-full", full + "px"); else de.style.removeProperty("--app-full");
  de.classList.toggle("ios-app", !!full);
}

vbFix(); addEventListener("resize", vbFix); addEventListener("load", vbFix); setTimeout(vbFix, 600);
try { visualViewport && visualViewport.addEventListener("resize", vbFix); } catch (e) {}
 addEventListener("orientationchange", () => setTimeout(vbFix, 300));

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

// ---------- percent display (David, 2026-10-10: "a delta number doesn't feel like anything") ----------
// CIEDE2000 between pure black and pure white is 100, and L* also runs 0-100, so a ΔE00 or ΔL* value already
// reads as "percent of the black-to-white difference". Every user-visible ΔE/ΔL* number goes through one of
// these; the math underneath (de2000, lab, every comparison and threshold) is untouched.
const pctFmt = n => `${(n = Math.max(0, n)) >= 10 ? n.toFixed(0) : n.toFixed(1)}%`;
// a gap between two colors, or an unsigned ΔL*: "3.0% different" / "1.5% different"
const pctDiff = n => `${pctFmt(n)} different`;
// a closeness/match line: "97% match"; one decimal once it's above 99 ("99.2% match")
function pctMatch(n) {
  const m = Math.max(0, 100 - n);
  if (m >= 100) return "100% match";
  return `${m > 99 ? m.toFixed(1) : Math.round(m)}% match`;
}
// ΔE, ΔL* and "ΔE step" (js/gym-engine.js SKILLS, js/match.js MATCH) all sit on that 0-100 scale, so each is
// shown as a percent; "mired" (Kelvin eye, js/match.js) isn't on it and keeps its own unit word.
const isDeUnit = u => u === "ΔE" || u === "ΔL*" || u === "ΔE step";
const unitWord = u => u === "ΔL*" ? "different in lightness" : isDeUnit(u) ? "different" : u;

// ---------- data index ----------
const UNITS = D.units.map((u, i) => ({ ...u, i, colors: u.colors.map(c => ({ ...c, id: u.id + ":" + c.n })) }));
UNITS.forEach(u => u.colors.forEach(c => { c.unit = u; }));
const ALL = UNITS.flatMap(u => u.colors);
const BASICS = D.basics.map(([n, h]) => ({ n, h, id: "basic:" + n, basic: true }));
const BYNAME = new Map([...BASICS, ...ALL].map(c => [c.n.toLowerCase(), c]));
const neighbor = c => c.vsC || (c.vs && BYNAME.get(c.vs.toLowerCase())) || null;   // vsC: a color past the first units (js/learnmore.js)
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
const STATE_V = 3;   // 2: S.learn, the Learner Model's event log (js/learner.js) · 3: cards for any color (js/learnmore.js)
function migrateState(d) {
  if (!d || typeof d !== "object" || Array.isArray(d)) return null;
  const s = Object.assign(fresh(), d);
  ["cards", "done", "daily", "best"].forEach(k => { if (!s[k] || typeof s[k] !== "object") s[k] = {}; });
  if (!s.gym || typeof s.gym !== "object") s.gym = { skills: {}, workouts: {} };
  s.gym.skills = s.gym.skills || {}; s.gym.workouts = s.gym.workouts || {};
  // a saved palette from before it had a stable id (for its own address and the one-step Back chain): give it one
  if (Array.isArray(s.palettes)) s.palettes.forEach(p => { if (p && !p.id) p.id = "pl" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); });
  // L23 favorites: S.favs { "#HEX": {n, at} } and S.pref { v, ctx, cmp } (js/favs.js); repaired here, never wiped
  if (!s.favs || typeof s.favs !== "object" || Array.isArray(s.favs)) s.favs = {};
  if (!s.pref || typeof s.pref !== "object" || Array.isArray(s.pref)) s.pref = { v: 1, ctx: {}, cmp: {} };
  if (!(s.v >= 1)) s.v = 1;   // unversioned saves had the v1 shape
  // v2 (js/learner.js): an empty Learner Model log; learner.js folds older progress into it once (S.learn.bf).
  // A learn field that isn't an object is kept aside, never dropped.
  if (s.v < 2) { if (s.learn != null && (typeof s.learn !== "object" || Array.isArray(s.learn))) { s.learnUnreadable = s.learn; delete s.learn; } if (!s.learn) s.learn = { v: 1, ev: [], agg: { c: {}, p: {} }, sets: {}, bf: 0 }; s.v = 2; }
  // v3 (js/learnmore.js): a card can be any learnable color ("core:<slug>", "lib:<slug>") beside the unit ids, and
  // carries its own name and hex so it resolves before the name lists load. Old unit cards are kept and backfilled.
  if (s.v < 3) {
    const byId = new Map(ALL.map(c => [c.id, c]));
    Object.entries(s.cards).forEach(([id, st]) => { const c = byId.get(id); if (c && st && typeof st === "object" && !st.n) { st.n = c.n; st.h = c.h; } });
    s.v = 3;
  }
  // future steps go here: if (s.v < 4) { …; s.v = 4; }
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
  u.colors.forEach(c => { if (!S.cards[c.id]) S.cards[c.id] = { b: 0, due: addDays(t, 1), since: t, own: false, n: c.n, h: c.h }; });
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
// every card counts, the first units' and any other color's (cardColors, js/learnmore.js)
const cardsAll = () => typeof cardColors === "function" ? cardColors() : ALL.filter(c => S.cards[c.id]);
const dueList = () => { const t = today(); return cardsAll().filter(c => S.cards[c.id] && S.cards[c.id].due <= t).sort((a, b) => S.cards[a.id].due.localeCompare(S.cards[b.id].due)); };
// "Yours" = picked or named right (an objective check), a day or more after learning. That is the only progress number.
// Self-graded swipes don't count (isMine in pickit.js).
const ownedCount = () => cardsAll().filter(c => isMine(S.cards[c.id])).length;
// past the units in data/colors.js the path goes on through generated units (js/learnmore.js lxNextUnit)
const nextUnit = () => typeof lxNextUnit === "function" ? lxNextUnit() : UNITS.find(u => u.i >= S.start && !S.done[u.id]) || null;
const unitLabel = u => u.label || `Unit ${u.i + 1} · ${D.tiers[u.tier].short}`;

// ---------- icons ----------
// ---------- the one icon system (2026-10-08; DESIGN-SYSTEM.md §14) ----------
// Hand-tuned line icons on a 24 px grid: a 2 px keyline, round caps and joins, one metaphor per concept, used
// everywhere (no emoji, no unicode stand-ins). Optical sizing: the stroke is drawn so it lands at ~1.75 px on screen
// at any size (heavier in grid units when small, lighter when large). icon(name, size) is the one door; ICON keeps
// the old keys and sizes so every caller still fits. A `w` passed to sv() is ignored in favour of the optical stroke
// unless `exact` is set (some drawings need their own weight).
const ICON_STROKE = 1.75;
const sv = (d, s = 22, w, exact) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="${exact && w ? w : Math.max(1.3, Math.min(3.2, ICON_STROKE * 24 / s)).toFixed(2)}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${d}</svg>`;
const ICON_PATHS = {
  // actions
  x: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  back: '<path d="M14.5 5.5L8 12l6.5 6.5"/>',
  chev: '<path d="M9.5 5.5L16 12l-6.5 6.5"/>',
  up: '<path d="M5.5 14.5L12 8l6.5 6.5"/>',
  down: '<path d="M5.5 9.5L12 16l6.5-6.5"/>',
  arrow: '<path d="M4.5 12h15M13.5 6l6 6-6 6"/>',
  more: '<circle cx="5.5" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="18.5" cy="12" r="1.5" fill="currentColor" stroke="none"/>',
  share: '<path d="M12 3.5v11M8 7.5l4-4 4 4"/><path d="M8.5 10.5H7a2 2 0 0 0-2 2V19a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6.5a2 2 0 0 0-2-2h-1.5"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.3 15.3L20 20"/>',
  play: '<path d="M8 5.8v12.4a1 1 0 0 0 1.5.86l9.7-6.2a1 1 0 0 0 0-1.72L9.5 4.94A1 1 0 0 0 8 5.8z" fill="currentColor"/>',
  shuffle: '<path d="M4 7h3c4.5 0 5.5 10 10 10h3M4 17h3c1.6 0 2.7-1.3 3.6-3M13.4 10C14.3 8.3 15.4 7 17 7h3M17.5 4.5L20 7l-2.5 2.5M17.5 14.5L20 17l-2.5 2.5"/>',
  dice: '<rect x="4" y="4" width="16" height="16" rx="4"/><circle cx="8.6" cy="8.6" r="1.25" fill="currentColor" stroke="none"/><circle cx="15.4" cy="8.6" r="1.25" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.25" fill="currentColor" stroke="none"/><circle cx="8.6" cy="15.4" r="1.25" fill="currentColor" stroke="none"/><circle cx="15.4" cy="15.4" r="1.25" fill="currentColor" stroke="none"/>',
  tune: '<path d="M4 7h9M17.5 7H20M4 17h2.5M11 17h9"/><circle cx="15.2" cy="7" r="2.3"/><circle cx="8.8" cy="17" r="2.3"/>',
  heart: '<path d="M12 19.5S4.5 15 4.5 9.6A4.1 4.1 0 0 1 12 7.4a4.1 4.1 0 0 1 7.5 2.2c0 5.4-7.5 9.9-7.5 9.9z"/>',
  heartOn: '<path d="M12 19.5S4.5 15 4.5 9.6A4.1 4.1 0 0 1 12 7.4a4.1 4.1 0 0 1 7.5 2.2c0 5.4-7.5 9.9-7.5 9.9z" fill="currentColor"/>',
  star: '<path d="M12 3.8l2.45 5.1 5.6.75-4.1 3.9 1.03 5.55L12 16.4l-4.98 2.7 1.03-5.55-4.1-3.9 5.6-.75z"/>',
  starOn: '<path d="M12 3.8l2.45 5.1 5.6.75-4.1 3.9 1.03 5.55L12 16.4l-4.98 2.7 1.03-5.55-4.1-3.9 5.6-.75z" fill="currentColor"/>',
  compare: '<rect x="3.5" y="5" width="7.5" height="14" rx="2"/><rect x="13" y="5" width="7.5" height="14" rx="2"/>',
  sound: '<path d="M4.5 9.5h3l4.5-4v13l-4.5-4h-3z"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a7.8 7.8 0 0 1 0 11"/>',
  mic: '<rect x="9" y="3.5" width="6" height="10.5" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V20.5"/>',
  camera: '<path d="M4 8.5a2 2 0 0 1 2-2h1.3l1.2-2h7l1.2 2H18a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><circle cx="12" cy="13" r="3.5"/>',
  pipette: '<path d="M14.5 5.5l4 4M16.6 3.4a2.1 2.1 0 0 1 3 0l1 1a2.1 2.1 0 0 1 0 3L18 10l-4-4zM13 8l-8 8v3h3l8-8"/>',
  bolt: '<path d="M13 3L5 13.5h6.5L10.5 21 19 10.5h-6.5z"/>',
  // places (the rooms and the map)
  map: '<path d="M12 3.2l7.6 4.4v8.8L12 20.8l-7.6-4.4V7.6z"/><circle cx="12" cy="12" r="2.2"/>',
  learn: '<rect x="7.5" y="3.5" width="12" height="15" rx="2.5"/><path d="M4.5 7.5V18a3 3 0 0 0 3 3h8"/>',
  train: '<path d="M2.8 12S6.2 5.8 12 5.8 21.2 12 21.2 12 17.8 18.2 12 18.2 2.8 12 2.8 12z"/><circle cx="12" cy="12" r="3"/>',
  museum: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M3.5 15.5l4.5-4.5 4 4 3-3 5.5 5.5"/><circle cx="15.5" cy="8.8" r="1.4"/>',
  studio: '<path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.3 0 1.9-.9 1.6-2-.4-1.4.4-2.6 1.9-2.6H17a3.5 3.5 0 0 0 3.5-3.5c0-4.9-3.8-8.9-8.5-8.9z"/><circle cx="7.8" cy="11.2" r="1.1" fill="currentColor" stroke="none"/><circle cx="10.5" cy="7.6" r="1.1" fill="currentColor" stroke="none"/><circle cx="14.8" cy="7.9" r="1.1" fill="currentColor" stroke="none"/>',
  you: '<circle cx="12" cy="8.5" r="3.7"/><path d="M5 20c.8-3.8 3.6-5.6 7-5.6s6.2 1.8 7 5.6"/>',
  rooms: '<circle cx="6" cy="6" r="2"/><circle cx="6" cy="12" r="2"/><circle cx="6" cy="18" r="2"/><path d="M11 6h8M11 12h8M11 18h8"/>',
  colors: '<circle cx="12" cy="8.7" r="4.7"/><circle cx="8.7" cy="14.6" r="4.7"/><circle cx="15.3" cy="14.6" r="4.7"/>',
  arrange: '<path d="M4 7h9M17.5 7H20M4 17h2.5M11 17h9"/><circle cx="15.2" cy="7" r="2.3"/><circle cx="8.8" cy="17" r="2.3"/>',
  grid: '<circle cx="8" cy="8" r="2" fill="currentColor" stroke="none"/><circle cx="16" cy="8" r="2" fill="currentColor" stroke="none"/><circle cx="8" cy="16" r="2" fill="currentColor" stroke="none"/><circle cx="16" cy="16" r="2" fill="currentColor" stroke="none"/>',
  today: '<rect x="4.5" y="5" width="15" height="15" rx="2.5"/><path d="M4.5 10h15M8.5 3v4M15.5 3v4"/>',
  compass: '<circle cx="12" cy="12" r="8.5"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
  wheel: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="2.4"/><path d="M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3"/>',
  // kinds of things (article references, cards)
  gem: '<path d="M3.5 9l3-4.5h11l3 4.5L12 20z"/><path d="M3.5 9h17M9 4.5L12 9l3-4.5M12 9v11"/>',
  flower: '<circle cx="12" cy="10" r="2.2"/><path d="M12 7.8C10 5.6 10.4 3.5 12 3.5s2 2.1 0 4.3zM14.2 10c2.2-2 4.3-1.6 4.3 0s-2.1 2-4.3 0zM12 12.2c2 2.2 1.6 4.3 0 4.3s-2-2.1 0-4.3zM9.8 10c-2.2 2-4.3 1.6-4.3 0s2.1-2 4.3 0zM12 16.5v4"/>',
  painting: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M3.5 15.5l4.5-4.5 4 4 3-3 5.5 5.5"/><circle cx="15.5" cy="8.8" r="1.4"/>',
  film: '<rect x="3.5" y="5" width="17" height="14" rx="2"/><path d="M7.5 5v14M16.5 5v14M3.5 9.5h4M3.5 14.5h4M16.5 9.5h4M16.5 14.5h4"/>',
  garment: '<path d="M9 4L3.5 6.8l2 4 1.9-.9V20h9.2V9.9l1.9.9 2-4L15 4c-.5 1.4-1.5 2.4-3 2.4S9.5 5.4 9 4z"/>',
  painter: '<path d="M14.5 4.5l5 5L10 19H5v-5z"/><path d="M12.5 6.5l5 5"/>',
  look: '<path d="M4 6h16M4 12h16M4 18h16"/><path d="M9 4v4M15 10v4M8 16v4"/>',
};
const icon = (name, size = 22) => sv(ICON_PATHS[name] || "", size);
const ICON = {
  x: icon("x"), xBig: icon("x", 30), check: icon("check", 30), checkS: icon("check", 13), xS: icon("x", 13),
  dots: icon("more"), more: icon("more"), arrow: icon("arrow", 20), up: icon("up", 18), down: icon("down", 18), chev: icon("chev", 18), back: icon("back"),
  share: icon("share", 20), learn: icon("learn", 24), gym: icon("train", 24), train: icon("train", 24), explore: icon("museum", 24), museum: icon("museum", 24),
  search: icon("search", 20), play: icon("play", 18), today: icon("today", 24), compass: icon("compass", 24), palette: icon("studio", 24),
  bolt: icon("bolt", 20), camera: icon("camera", 22), dice: icon("dice", 22), heart: icon("heart", 22), heartOn: icon("heartOn", 22),
  star: icon("star", 22), starOn: icon("starOn", 22), map: icon("map", 22), colors: icon("colors", 22), arrange: icon("arrange", 22),
  sound: icon("sound", 22), compare: icon("compare", 22), you: icon("you", 24),
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
// [data-swatch] too (lane L12): every tappable swatch in the app grows into the color page it opens (js/swatch.js).
const MORPH_TRIGGER = "[data-morph-src], [data-swatch], .pin-color, .pin-pair, .kin, .pchip, .tday[data-daily]";
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
  if (!t || !root.isConnected) return;   // the screen already left (a quick Back): nothing to fly into
  const r = t.getBoundingClientRect();
  if (!r.width || r.top > innerHeight) return;
  const fly = document.createElement(m.img ? "img" : "div");
  // never outlives its flight: if onfinish doesn't come (the page was swapped mid-flight), it still goes
  setTimeout(() => { fly.remove(); t.style.visibility = ""; }, 900);
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
    // a frame's timestamp can be a little earlier than t0, and a negative k overshoots below zero ("-1 colors yours")
    const step = t => { const k = Math.max(0, Math.min(1, (t - t0) / dur)), e = 1 - (1 - k) ** 4; el.textContent = (to * e).toFixed(dec); if (k < 1) requestAnimationFrame(step); };
    el.textContent = (0).toFixed(dec); requestAnimationFrame(step);
    setTimeout(() => { el.textContent = to.toFixed(dec); }, dur + 150);   // lands even if animation frames are paused
  });
}
document.addEventListener("load", e => { if (e.target.tagName === "IMG") e.target.classList.add("ld"); }, true);
// The page's real scroll position. In this app <body> is the scroller (html and body both clip overflow-x, body is 100%
// tall), so window.scrollY stays 0 and every "am I at the top?" check passed while you were mid-article: a scroll-up
// read as pull-to-close (David). Read whichever element is actually scrolled.
function pageScrollTop() { return Math.max(window.scrollY || 0, document.body ? document.body.scrollTop : 0, document.documentElement ? document.documentElement.scrollTop : 0); }
addEventListener("scroll", () => document.body.classList.toggle("scrolled", pageScrollTop() > 24), { passive: true, capture: true });

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
  // (.flyer / .hc-morph: a bubble-to-page shape belongs to the screen that asked for it; one left mid-flight or
  // orphaned by an error must never float over the next screen as a stuck, unlabeled circle)
  document.querySelectorAll(".scrim,.sheet,.toast,.fade-ghost,.rooms-stem,.rm-scrim,.flyer,.hc-morph").forEach(n => n.remove());
  document.body.classList.remove("stem-open"); STEM_OPEN = false;
  // a new screen always scrolls: release any scroll lock a sheet or panel left behind (leaving a screen with a sheet
  // open used to keep the body pinned, so the next page couldn't scroll)
  if (LOCKS) { LOCKS = 0; document.documentElement.classList.remove("sheet-open"); document.body.style.top = ""; }
  // remember where we were, so a later Back to this same address can put the scroll back
  if (leavingHash) SCROLL_BY_HASH.set(leavingHash, leavingY);
  // the old screen fades out underneath the new one (and, combined with growFrom's clip-path on the new
  // content below, is also what stands in for "the honeycomb dims" during a Room's grow-in: DESIGN-SYSTEM §8)
  const old = app.firstElementChild;
  if (old && !reduceMotion) {
    const ghost = document.createElement("div"), y = scrollY;
    ghost.className = "fade-ghost"; ghost.style.top = -y + "px";
    ghost.appendChild(old);
    document.body.appendChild(ghost);
    ghost.animate([{ opacity: 1, transform: "scale(1)" }, { opacity: 0, transform: "scale(.985)" }], { duration: 260, easing: "ease-out", fill: "forwards" }).onfinish = () => ghost.remove();
  }
  // Navigation model (DESIGN-SYSTEM.md §2): a tab's home is now a Room — a full-height sheet over the honeycomb,
  // with the Rooms corner floating over it — instead of the old bottom tab bar. roomChrome() wraps whatever the
  // room's own show(html, cls, tab) call already renders, so no other screen's JS had to change.
  const inner = `<div class="screen ${cls}${tab ? " has-tabs" : ""}">${html}</div>`;
  app.innerHTML = tab ? roomChrome(inner, tab) : inner;
  document.documentElement.classList.toggle("booth", /\b(deck|drill|station|meet|daily|fixed|eye|cx)\b/.test(cls));
  // history: a tab's home replaces the current entry; any screen inside adds one, so the phone's back gesture works.
  // The entry carries the screen's address (#/color/teal…) and the page title: router.js.
  routeCommit(tab);
  // forward nav starts at the top, same as always; a Back puts the scroll back where this address left it
  const backY = backNav ? SCROLL_BY_HASH.get(ROUTE_NOW) : null;
  if (backY) { const n = 2; let left = n; const tick = () => { if (--left > 0) return requestAnimationFrame(tick); scrollTo(0, backY); }; requestAnimationFrame(tick); }
  else window.scrollTo(0, 0);
  document.body.classList.remove("scrolled");
  const el = app.querySelector(".screen");
  const mb = tab && el.querySelector("[data-menu]"); if (mb) mb.onclick = () => menu();
  if (typeof tlNote === "function") tlNote(el, tab, backNav);   // the one trail, the map glyph, the pull-down (js/trail.js)
  el.querySelectorAll("img").forEach(i => { if (i.complete && i.naturalWidth) i.classList.add("ld"); });
  requestAnimationFrame(() => { runMorph(el); reveal(el); countUp(el); });
  return el;
}
// Every tab's home opens with the same line: the brand on the left, the tab's own actions and the menu (⋯) on the right.
// Kept for the rooms that still build their own header this way (Train, Explore, Studio); Learn builds the new
// Room header (.room-head) directly. The brand is still a quick way home, same as the Rooms corner's Home bubble.
const tabHead = (acts = "") => `<header class="bar"><button class="brand" data-hm-brand aria-label="Back to the map">${LOGO}<span>ColorHub</span></button><span class="bar-r">${acts}<button class="icon-btn" data-menu aria-label="Settings and more">${ICON.dots}</button></span></header>`;
// Every inner screen: back (or close, for a task) on the left, the title in the middle, an optional action on the right.
const navTop = (title = "", o = {}) => `<header class="nav-top"><button class="icon-btn" ${o.close ? `data-close aria-label="Close">${ICON.x}` : `data-back aria-label="Back">${ICON.back}`}</button><span class="nav-title">${title}</span><span class="nav-r">${o.right || ""}</span></header>`;

// ================================================================
// Navigation model (DESIGN-SYSTEM.md §2): one floor (the honeycomb, js/home.js hmHome()), four rooms that rise
// over it. No tab bar anywhere. The left corner — present on the honeycomb and inside every room, always the
// same 56px spot — raises "the stem": Learn / Train / Explore / Studio (plus Home, at the foot, inside a room).
// ================================================================
// The names of places (David, 2026-10-08: "Explore and Home ... should be kind of the same thing"). The honeycomb floor
// is the explorable map of every color, so it carries the name Explore; the room of paintings, poems, ideas and the
// world is the Museum (its internal id stays "explore", so saves and old #/explore links keep working). One constant
// each, so a rename is one line.
const NAV_MAP = "Explore", NAV_MAP_NOTE = "Every color", NAV_MUSEUM = "Museum";
const ROOMS_LIST = [["learn", "Learn"], ["gym", "Train"], ["explore", NAV_MUSEUM], ["studio", "Studio"], ["you", "You"]];   // You: js/you.js
const ROOMS_GLYPH = icon("rooms", 24);   // a little stack: the rooms rise from it in a straight column
const HOME_GLYPH = icon("map", 24);
// a cheap, decorative stand-in for "a strip of the dimmed honeycomb" above a room (the real canvas doesn't
// survive a screen swap, since #app is fully re-rendered each time — see show() above)
// spread across the strip (each bar needs its own left; without it all 16 stacked into one bright slash at the left edge)
const ROOM_PEEK_BARS = Array.from({ length: 16 }, (_, i) => `<i style="left:${(i * 6.4 - 2).toFixed(1)}%;background:${lchHex(50 + (i % 3) * 9, 46, (i * 23) % 360)}"></i>`).join("");
// The Room header (DESIGN-SYSTEM §11): the room's name in title-1 on the left, one note on the right. Rooms that
// still render the old brand row (tabHead() + <h1 class="tab-title">) are converted here, so Train and Studio get
// the new header without their own JS changing. The notes say what each room does to your map (GENIUS-PANEL-1).
const ROOM_NOTES = { gym: "Sharpen your eye", studio: "Make your own", explore: "The world in color" };
const LEGACY_HEAD = /<header class="bar"><button class="brand" data-hm-brand[\s\S]*?<\/header>\s*<h1 class="tab-title">([\s\S]*?)<\/h1>/;
function roomChrome(inner, tab) {
  inner = inner.replace(LEGACY_HEAD, (_, t) => `<header class="room-head rh-auto"><h1 class="title-1">${t}</h1>${ROOM_NOTES[tab] ? `<span class="note">${ROOM_NOTES[tab]}</span>` : ""}</header>`);
  // L18 B2: the real floor (js/home.js hmSnapFloor), dimmed by a solid scrim; the decorative bars only until one exists
  const floor = typeof ROOM_FLOOR_IMG === "string" && ROOM_FLOOR_IMG ? `<div class="room-floor-peek room-floor-snap" data-floor-peek style="background-image:url('${ROOM_FLOOR_IMG}')"><i></i></div>` : `<div class="room-floor-peek" data-floor-peek>${ROOM_PEEK_BARS}</div>`;
  return `${floor}<div class="room-sheet" data-room="${tab}">${inner}</div><button class="corner l" data-rooms-corner aria-label="Rooms">${ROOMS_GLYPH}</button>`;
}
let STEM_OPEN = false;
function roomsBubbleArt(id) {
  if (id === "learn") {
    const due = (typeof dueList === "function" ? dueList() : []).slice(0, 8);
    const cols = (due.length ? due : ALL.slice(0, 8)).map(c => c.h);
    return `<span class="rm-art rm-art-strip">${cols.map(h => `<i style="background:${h}"></i>`).join("")}</span>`;
  }
  if (typeof hmStemToday === "function") { const t = hmStemToday()[id]; if (t && t.art) return t.art; }   // L18 B2: what's inside today
  // Train: an odd-one-out board in miniature, one tile a shade off (DESIGN-SYSTEM §2: "today's station tile")
  if (id === "gym") { const hu = (new Date().getDate() * 37) % 360, h = lchHex(56, 28, hu), o = lchHex(63, 28, hu);
    return `<span class="rm-art rm-art-grid">${Array.from({ length: 9 }, (_, i) => `<i style="background:${i === 5 ? o : h}"></i>`).join("")}</span>`; }
  if (id === "explore") return `<span class="rm-art" style="background:linear-gradient(135deg,#2C4F6F,#8E9C8A 60%,#F0DFBC)"></span>`;
  if (id === "you" && typeof ymBubbleArt === "function") return ymBubbleArt();   // js/you.js
  // Home: the honeycomb in miniature, seven bubbles
  if (id === "home") return `<span class="rm-art rm-art-home">${["#3E7F8C", "#C8553D", "#E0A458", "#7A6CA8", "#5E8C4A", "#B8577A", "#2F4E73"].map((h, i) => `<i style="background:${h};--k:${i}"></i>`).join("")}</span>`;
  return `<span class="rm-art" style="background:radial-gradient(circle,#8a8a8a 0,rgba(138,138,138,0) 68%),conic-gradient(#ff3b30,#ffcc00,#4cd964,#34c8e0,#3b5bff,#c644fc,#ff3b30)"></span>`;
}
function roomsNote(id) {
  try {
    if (id === "learn") { const n = dueList().length, nu = !n && typeof nextUnit === "function" && nextUnit(); return n ? `${n} to recall` : nu ? `${nu.colors.length} new names` : "All caught up"; }
    if (id !== "learn" && typeof hmStemToday === "function") { const t = hmStemToday()[id]; if (t && t.note) return t.note; }   // L18 B2
    if (id === "gym" && typeof todayTrain === "function") return todayTrain().what;
    if (id === "explore") return "Paintings, poems, the world";
    if (id === "studio") return "Wheel, camera, palettes";
    if (id === "home") return NAV_MAP_NOTE;
    if (id === "you" && typeof ymNote === "function") return ymNote();   // js/you.js
  } catch (e) {}
  return "";
}
// The stem (David, 2026-10-08: "everything could fade, but it shouldn't disappear"). The page stays exactly where
// it was under a solid dimming scrim; the rooms rise as opaque capsules in a low arc from the corner, under the
// thumb. A tap anywhere outside (or the ✕, Escape, Back) sinks them back into the corner and nothing else moves.
let STEM_KEY = null;
function closeStem(instant) {
  const s = document.querySelector(".rooms-stem"), sc = document.querySelector(".rm-scrim");
  STEM_OPEN = false;
  document.body.classList.remove("stem-open");
  if (STEM_KEY) { removeEventListener("keydown", STEM_KEY, true); STEM_KEY = null; }
  document.querySelectorAll("[data-rooms-corner]").forEach(b => { b.classList.remove("on"); b.innerHTML = ROOMS_GLYPH; b.setAttribute("aria-expanded", "false"); });
  // Home's right-corner menu (js/home.js doMenu) rides the same stem: its button gets its own face back
  document.querySelectorAll("[data-do-corner]").forEach(b => { b.classList.remove("on"); b.setAttribute("aria-expanded", "false"); if (b._html) b.innerHTML = b._html; });
  const gone = () => { if (s) s.remove(); if (sc) sc.remove(); };
  if (instant === true || (!s && !sc)) return gone();
  if (s) s.classList.remove("on");
  if (sc) sc.classList.remove("on");
  setTimeout(gone, reduceMotion ? 160 : 320);
}
function toggleStem(cornerEl) {
  if (STEM_OPEN) { buzz(4); return closeStem(); }
  if (document.querySelector(".sheet,.scrim")) return;   // a sheet is already up; don't stack chrome on chrome
  document.querySelectorAll(".rooms-stem,.rm-scrim").forEach(n => n.remove());   // one still sinking from a fast double tap
  buzz(4);
  STEM_OPEN = true;
  document.body.classList.add("stem-open");
  const roomEl = document.querySelector(".room-sheet"), here = roomEl && roomEl.dataset.room;
  if (!roomEl && typeof hmSnapFloor === "function") hmSnapFloor();   // L18 B2: the floor as you leave it
  const items = (roomEl ? [["home", NAV_MAP]] : []).concat(ROOMS_LIST);
  const scrim = document.createElement("div");
  scrim.className = "rm-scrim";
  // a tap outside only closes: it never reaches the page underneath, and the page never scrolls or re-renders
  scrim.addEventListener("pointerdown", e => { e.preventDefault(); e.stopPropagation(); buzz(4); closeStem(); });
  scrim.addEventListener("click", e => { e.preventDefault(); e.stopPropagation(); });
  scrim.addEventListener("touchmove", e => e.preventDefault(), { passive: false });
  const stem = document.createElement("div");
  stem.className = "rooms-stem mn-panel mn-panel-l";
  stem.setAttribute("role", "menu"); stem.setAttribute("aria-label", "Rooms");
  const n = items.length;
  stem.style.setProperty("--n", n);   // short screens tighten the step so the top capsule stays low (css/menus2.css)
  // the menu panel (design/VISUAL-DIRECTION.md component 2): a floating tile grid above the corner, not a pill cascade
  stem.innerHTML = `<div class="mn-ph"><h3>Rooms</h3><p>Where to next</p></div>` + items.map(([id, label], i) => {
    const cur = id === here;
    return `<button class="rm-bubble${cur ? " cur" : ""}" role="menuitem" data-room="${id}" style="--i:${i}">
      ${roomsBubbleArt(id)}<span class="rm-label"><b>${esc(label)}</b><em>${esc(cur ? "You're here" : roomsNote(id))}</em></span>
    </button>`;
  }).join("");
  document.body.append(scrim, stem);
  document.querySelectorAll("[data-rooms-corner]").forEach(b => { b.classList.add("on"); b.innerHTML = ICON.x; b.setAttribute("aria-expanded", "true"); });
  requestAnimationFrame(() => requestAnimationFrame(() => { scrim.classList.add("on"); stem.classList.add("on"); }));
  STEM_KEY = e => { if (e.key === "Escape") { e.stopPropagation(); closeStem(); } };
  addEventListener("keydown", STEM_KEY, true);
  stem.querySelectorAll("[data-room]").forEach(b => b.onclick = () => {
    const id = b.dataset.room, art = b.querySelector(".rm-art");
    buzz(8);
    if (id === here) return closeStem();   // the room you're in: just put the stem away
    b.classList.add("go");
    closeStem();
    if (id === "home") return roomToFloor(art);
    growFrom(art, () => go(id));
  });
}
document.addEventListener("click", e => { const b = e.target.closest && e.target.closest("[data-rooms-corner]"); if (b) toggleStem(b); });
// tapping the dimmed strip at the top of a room is the same as Rooms → Home
document.addEventListener("click", e => { const b = e.target.closest && e.target.closest("[data-floor-peek]"); if (b) roomToFloor(b.querySelector("i")); });

// ---------- the signature motion (DESIGN-SYSTEM.md §8): "a bubble becomes its page" ----------
// growFrom(sourceEl, renderFn): sourceEl is the tapped shape (a circle bubble or a square chip/swatch).
// renderFn() renders the destination (typically a show() call) and must return its root element; that element
// (or its nearest .room-sheet) grows from sourceEl's rect to fill the screen via an animated clip-path, so the
// tapped shape visually becomes the page. Reusable anywhere a bubble/chip/swatch opens a new screen — not just
// the four rooms. Reduced Motion gets the plain cross-fade show() already does, with no extra growth.
function growFrom(sourceEl, renderFn) {
  if (!sourceEl || reduceMotion) return renderFn();
  const r = sourceEl.getBoundingClientRect();
  if (!r.width || !r.height) return renderFn();
  const rad0 = Math.abs(r.width - r.height) < 2 ? r.width / 2 : 4;
  const el = renderFn();
  if (!el) return el;
  const root = el.closest(".room-sheet") || el;
  const W = innerWidth, H = innerHeight;
  const clip = (t, ri, b, l, rad) => `inset(${t}px ${ri}px ${b}px ${l}px round ${rad}px)`;
  root.style.clipPath = clip(r.top, W - r.right, H - r.bottom, r.left, rad0);
  root.style.willChange = "clip-path";
  requestAnimationFrame(() => requestAnimationFrame(() => {
    root.style.transition = "clip-path var(--grow) var(--ease-grow)";
    root.style.clipPath = clip(0, 0, 0, 0, 0);
  }));
  setTimeout(() => { root.style.transition = ""; root.style.clipPath = ""; root.style.willChange = ""; }, 460);
  return el;
}
// shrinkTo: the reverse (340ms), into targetEl's current rect — a room sinking back into its bubble, or into
// the Rooms corner for "Home". after() runs once the shrink finishes (usually the call that swaps the screen).
function shrinkTo(root, targetEl, after) {
  if (!root || reduceMotion || !targetEl || !targetEl.isConnected) { if (after) after(); return; }
  const r = targetEl.getBoundingClientRect(), W = innerWidth, H = innerHeight;
  const rad0 = Math.abs(r.width - r.height) < 2 ? r.width / 2 : 4;
  root.style.transition = "clip-path var(--shrink) var(--ease-shrink)";
  root.style.clipPath = `inset(${Math.max(0, r.top)}px ${Math.max(0, W - r.right)}px ${Math.max(0, H - r.bottom)}px ${Math.max(0, r.left)}px round ${rad0}px)`;
  setTimeout(() => { if (after) after(); }, 340);
}
// Room → Home: the current room shrinks into the Rooms corner (its "bubble" when there's no stem bubble to
// target — e.g. a swipe-down or a tap on the floor-peek strip), then the floor takes over.
function roomToFloor(targetEl) {
  const cur = document.querySelector(".room-sheet"), corner = document.querySelector("[data-rooms-corner]");
  if (cur) shrinkTo(cur, targetEl && targetEl.isConnected ? targetEl : corner, () => hmHome());
  else hmHome();
}
// Back gesture / browser back: close a sheet or panel first; otherwise press the screen's own back or close
// button (so each screen keeps its own idea of "back"); with none, return to the current tab's home.
let HIST_POP = false;
addEventListener("popstate", e => {
  if (!e.state && /^#\/./.test(location.hash)) return;   // a typed or linked address, not Back: router.js opens it
  if (STEM_OPEN) { closeStem(); try { history.pushState({ ch: 1 }, "", ROUTE_NOW || undefined); } catch (e) {} return; }
  const over = document.querySelector(".peek [data-back], .sheet");
  if (over) { if (over.matches(".sheet")) document.querySelector(".scrim")?.dispatchEvent(new PointerEvent("pointerdown")); else over.click(); try { history.pushState({ ch: 1 }, "", ROUTE_NOW || undefined); } catch (e) {} return; }
  const btn = app.querySelector("[data-back], [data-close]");
  HIST_POP = true;
  // a Room is the new "base" screen (replaces the old tab-bar check): with no back/close button and no room
  // showing, we're already as deep as the browser's own history can take us, so let it do its default thing.
  try { if (btn) btn.click(); else if (!app.querySelector(".room-sheet")) go(S.tab || "learn"); } finally { HIST_POP = false; }
});
function go(tab) {
  S.tab = tab; save();
  if (typeof X_ROOT !== "undefined") X_ROOT = null;
  // (no questionnaire wall before Train: color vision is one row on Train > Your eye, js/rooms2.js)
  if (tab === "gym") return gymHome();
  if (tab === "explore") return exploreHome();
  if (tab === "studio") return studio();
  if (tab === "you" && typeof youPage === "function") return youPage();   // js/you.js
  // Learn is the first Room (DESIGN-SYSTEM.md §2): Today folds into it (js/learn.js home()). The honeycomb
  // floor itself is a separate place now — reached via hmHome(), the Rooms corner's Home bubble, or "#/home" —
  // not a tab, so go() never lands there.
  return home();
}
const dailyDone = () => !!(S.daily && S.daily[today()]);
addEventListener("keydown", e => { if (onKey && !e.metaKey && !e.ctrlKey) onKey(e); });
// One toast for the whole app (css/menus2.css): a solid capsule that drops in under the status bar, clear of the
// corners and every primary, says one thing and leaves. o.undo (or o.action + o.onAction) adds one text action;
// o.dot shows the color it's about; o.ms sets how long it stays. toast(msg) alone works as it always did.
function toast(msg, o = {}) {
  document.querySelectorAll(".toast").forEach(n => n.remove());
  const t = document.createElement("div"), act = o.undo ? "Undo" : o.action, run = o.undo || o.onAction;
  t.className = "toast"; t.setAttribute("role", "status"); t.setAttribute("aria-live", "polite");
  t.innerHTML = `${o.dot ? `<i class="toast-dot" style="--c:${esc(o.dot)}"></i>` : ""}<span>${esc(msg)}</span>${act && run ? `<button type="button">${esc(act)}</button>` : ""}`;
  document.body.appendChild(t);
  const leave = () => { if (!t.isConnected) return; t.classList.add("out"); setTimeout(() => t.remove(), 220); };
  const timer = setTimeout(leave, o.ms || (act ? 4200 : 2300));
  if (act && run) t.querySelector("button").onclick = e => { e.stopPropagation(); clearTimeout(timer); t.remove(); buzz(8); run(); };
  return t;
}
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
    if (gone) return; gone = true; unlockScroll(); if (sh._esc) removeEventListener("keydown", sh._esc, true);
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
  // Same rule as hmPullClose (js/home.js): from the body of the sheet it arms only after resting at the top for 700 ms and
  // needs a long pull, so scrolling back up through a long sheet never closes it; the grab bar closes with any quick drag.
  let y0 = null, x0 = 0, dy = 0, t0 = 0, on = false, lastScroll = 0, grab = false;
  sh.addEventListener("scroll", () => { lastScroll = performance.now(); }, { passive: true });
  const end = () => {
    if (y0 == null) return; y0 = null;
    const fast = grab && dy > 60 && dy / Math.max(1, performance.now() - t0) > .7;
    if (on && (dy > (grab ? 120 : 180) || fast)) return close();
    on = false; sh.style.transition = "transform .3s var(--ease)"; sh.style.transform = "";
  };
  // a drag that starts while the sheet is scrolled (or still gliding to the top) is scrolling, never a close
  // a sheet with its own inner scroller ([data-sheet-scroll]) closes from there only at that scroller's top; a
  // [data-sheet-grab] header closes with any quick drag, like the grab bar (js/home.js View sheet)
  const start = (x, y, target) => {
    const isc = target.closest("[data-sheet-scroll]"), g = !!target.closest(".grab,[data-sheet-grab]");
    if (target.closest("input,textarea,select,input[type=range]") || (isc && isc.scrollTop > 0) || ((sh.scrollTop > 0 || performance.now() - lastScroll < 700) && !g)) return;
    grab = g; y0 = y; x0 = x; dy = 0; on = false; t0 = performance.now();
  };
  sh.addEventListener("scroll", () => { lastScroll = performance.now(); }, { passive: true, capture: true });   // an inner scroller counts too
  const move = (x, y, e) => {
    if (y0 == null) return;
    const d = y - y0;
    if (!on) { if (d > (grab ? 12 : 24) && d > Math.abs(x - x0) * 1.5 && (grab || sh.scrollTop <= 0)) on = true; else if (d < -6 || Math.abs(x - x0) > 10) { y0 = null; return; } else return; }
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
  // the menu family (css/menus2.css): a modal for assistive tech, Escape closes, focus comes back where it was
  const back = document.activeElement, esc0 = e => { if (e.key === "Escape" && sh.isConnected && !gone) { e.stopPropagation(); close(); } };
  sh.setAttribute("aria-modal", "true"); sh.tabIndex = -1;
  sh._esc = esc0; addEventListener("keydown", esc0, true);
  const close0 = close;
  const closeAll = () => { close0(); try { if (back && back.isConnected) back.focus({ preventScroll: true }); } catch (e) {} };
  document.body.append(scrim, sh);
  try { sh.focus({ preventScroll: true }); } catch (e) {}
  return { sh, close: closeAll };
}
