"use strict";
// The map's signature move (David, 2026-10-08: "when you click a color on the map, it should fully expand until it
// transitions into the color page"; "when you exit the color page back to the map, it should return to the exact
// spot where you were").
//
// Forward (mxGrow, from js/home.js pick): one fixed overlay holds the tapped bubble's exact outline (circle, hexagon
// or the blend, from honey.js geoOf) in its color, and that shape swells from the bubble until it covers the screen;
// the bubble's label flies to the cover title's place and becomes the title; the map behind leans in toward the bubble
// and dims. The page is built underneath once the motion is running (so building it never stalls the first frames)
// and held invisible, so when the color lands the overlay lifts and the page's own cover (the same color) is already
// there: only its words fade in. A page that loads later (a name page waiting on the name list, a wiki placeholder)
// keeps the color on screen until it's ready, never a flash of black.
//
// Back (mxLeave + mxLand, from js/home.js hmHome): the page's color covers the screen, the map is drawn exactly where
// you left it (honey.js HONEY_PAN / HONEY_RET), and the color shrinks back into that same bubble, the title flying home
// to its label while the map un-dims around it. With no bubble of that color on screen it dissolves into the map.
//
// Everything that moves is transform or opacity on one fixed overlay (the compositor runs it at 60fps even while the
// page or the map is being built). Reduced Motion: none of this, show()'s crossfade only.

const MX_GROW = 420, MX_SHRINK = 380, MX_FADE = 200, MX_IN = 110, MX_SETTLE = 350;
const MX_EASE = "cubic-bezier(.32,.72,0,1)", MX_EASE_BACK = "cubic-bezier(.4,0,.2,1)";
let MX = null;        // the transition in flight: { dir: "in" | "out", ov, ... }
let MX_LAST = null;   // the bubble a page last grew from: { h, x, y }
const mxOn = () => !reduceMotion && typeof Element !== "undefined" && !!Element.prototype.animate;
const mxFrames = f => requestAnimationFrame(() => requestAnimationFrame(f));   // once this frame's motion is on the compositor

function mxOverlay() {
  const ov = document.createElement("div");
  ov.className = "mx"; ov.setAttribute("aria-hidden", "true");
  document.body.appendChild(ov);
  return ov;
}
// The bubble's outline as one big layer, drawn at the size where it covers the whole screen (crisp when it lands) and
// scaled down to the bubble: { el, s } with s the scale at which it is exactly the bubble.
function mxShape(ov, geo, h) {
  const rays = geo.rays, maxR = Math.max(...rays), q = Math.min(...rays) / maxR, W = innerWidth, H = innerHeight;
  const far = Math.max(...[[0, 0], [W, 0], [0, H], [W, H]].map(([x, y]) => Math.hypot(x - geo.x, y - geo.y)));
  const R = far / q + 2, el = document.createElement("i");
  el.className = "mx-shape";
  Object.assign(el.style, { left: geo.x - R + "px", top: geo.y - R + "px", width: 2 * R + "px", height: 2 * R + "px", background: h });
  if (q > .995) el.style.borderRadius = "50%";
  else el.style.clipPath = "polygon(" + rays.map((r, i) => { const t = i / rays.length * 6.283185307, k = 50 * r / maxR; return `${(50 + k * Math.cos(t)).toFixed(3)}% ${(50 + k * Math.sin(t)).toFixed(3)}%`; }).join(",") + ")";
  ov.appendChild(el);
  return { el, s: maxR / R };
}
// the bubble's own label, as the canvas draws it, centered on the bubble
function mxLabel(ov, geo) {
  if (!geo.label) return null;
  const L = geo.label, el = document.createElement("div");
  el.className = "mx-lbl";
  el.textContent = L.lines.join("\n");
  Object.assign(el.style, { left: geo.x + "px", top: geo.y + L.fs * .06 + "px", font: `${L.fs}px "Instrument Serif",Georgia,serif`, lineHeight: L.lh + "px", color: L.ink });
  ov.appendChild(el);
  return el;
}
// the cover title, cloned where it sits on the page (the page is laid out, just held invisible)
function mxTitleRect(page) {
  const t = page && page.querySelector(".cp-hero h1"); if (!t) return null;
  const r = t.getBoundingClientRect();
  return r.width && r.bottom > 0 && r.top < innerHeight ? { t, r, fs: parseFloat(getComputedStyle(t).fontSize) || 48 } : null;
}
function mxTitle(ov, page) {
  const T = mxTitleRect(page); if (!T) return null;
  const cs = getComputedStyle(T.t), el = document.createElement("div");
  el.className = "mx-title";
  el.textContent = T.t.textContent;
  Object.assign(el.style, { left: T.r.left + "px", top: T.r.top + "px", width: Math.ceil(T.r.width) + 1 + "px", font: cs.font, letterSpacing: cs.letterSpacing, lineHeight: cs.lineHeight, color: cs.color });
  ov.appendChild(el);
  return { el, r: T.r, fs: T.fs };
}
// where a title of size T sits when it is the bubble's label: [translate x, translate y, scale] (origin top left)
function mxAtBubble(T, geo) {
  const L = geo.label, s = (L ? L.fs : Math.max(6, geo.d * .2)) / T.fs, cy = geo.y + (L ? L.fs * .06 : 0);
  return [geo.x - T.r.width * s / 2 - T.r.left, cy - T.r.height * s / 2 - T.r.top, s];
}
function mxKill() {
  const m = MX; MX = null;
  if (!m) return;
  m.timers.forEach(clearTimeout);
  m.anims.forEach(a => { try { a.cancel(); } catch (e) {} });
  [m.ov, m.floor, m.pageGhost].forEach(n => n && n.remove());
  if (m.page) m.page.classList.remove("mx-hold");
  if (m.mapEl) m.mapEl.style.transformOrigin = "";
  if (typeof cornersBack === "function") cornersBack();   // the corners are back, whichever way it ended
}
const mxAnim = (m, el, frames, o) => { const a = el.animate(frames, { fill: "forwards", ...o }); m.anims.push(a); return a; };

// ---------- forward: the bubble becomes its page ----------
function mxGrow(geo, open) {
  if (!mxOn() || !geo || !(geo.d > 2)) return open();
  mxKill();
  MX_LAST = { h: geo.h, x: geo.x, y: geo.y };
  const ov = mxOverlay(), mapEl = app.querySelector(".screen.hm");
  ov.classList.add("mx-block");   // the map under the growing color takes no more taps
  const m = MX = { dir: "in", ov, geo, mapEl, page: null, floor: null, pageGhost: null, landed: false, flying: 0, timers: [], anims: [], t0: performance.now() };
  const S = mxShape(ov, geo, geo.h);
  m.lbl = mxLabel(ov, geo);
  mxAnim(m, S.el, [{ transform: `scale(${S.s})` }, { transform: "scale(1)" }], { duration: MX_GROW, easing: MX_EASE })
    .onfinish = () => { if (MX === m) { m.landed = true; m.landT = performance.now(); mxReveal(m); } };
  if (mapEl) {
    // the map leans in toward the bubble and dims behind the color
    mapEl.style.transformOrigin = `${geo.x}px ${geo.y}px`;
    mxAnim(m, mapEl, [{ transform: "scale(1)", opacity: 1 }, { transform: "scale(1.12)", opacity: .3 }], { duration: MX_GROW, easing: MX_EASE });
  }
  // never stuck: if the page never comes, the map comes back
  m.timers.push(setTimeout(() => { if (MX === m) mxKill(); }, 8000));
  // build the page once the motion is running on its own
  mxFrames(() => { if (MX !== m) return; try { open(); } catch (e) { if (MX === m) mxKill(); throw e; } });
}
// show() (js/core.js) calls this with every new screen, right after it's in the page
function mxOnShow(el) {
  const m = MX; if (!m) return;
  if (m.dir === "in") {
    if (el.classList.contains("hm")) return mxKill();   // back on the map before the page landed (mxLeave runs first)
    // the map: keep it from show()'s fade-out, so it goes on leaning in and dimming under the color
    const g = m.mapEl && m.mapEl.parentElement;
    if (g && g.classList.contains("fade-ghost")) { g.getAnimations().forEach(a => a.cancel()); g.classList.replace("fade-ghost", "mx-floor"); m.floor = g; }
    el.classList.add("mx-hold");
    if (el.classList.contains("waiting")) return;   // a loading placeholder: the real page is still coming
    if (m.page && m.page !== el) m.page.classList.remove("mx-hold");
    m.page = el;
    // the builder (colorDossier) is still filling the page in: aim at the title once it has
    queueMicrotask(() => { if (MX === m && m.page === el) { mxAim(m); mxReveal(m); } });
  } else if (m.dir === "out") {
    if (!el.classList.contains("hm")) return mxKill();
    // the page we're leaving stays on top, under the color, until the color is solid
    const g = [...document.querySelectorAll(".fade-ghost")].find(x => x.contains(m.src));
    if (g) { g.getAnimations().forEach(a => a.cancel()); g.classList.replace("fade-ghost", "mx-floor"); g.style.zIndex = "2"; m.pageGhost = g; }
    m.mapEl = el;
  }
}
// the label flies to the cover title and becomes it
function mxAim(m) {
  const T = m.T = mxTitle(m.ov, m.page);
  if (!T) { if (m.lbl) mxAnim(m, m.lbl, [{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: "ease-out" }); return; }
  const since = performance.now() - m.t0, dur = m.landed ? 340 : Math.max(280, MX_GROW - since + 40), g = m.geo;
  const [dx, dy, s] = mxAtBubble(T, g);   // the title starts as the label: same place, same size
  m.flying++;
  T.el.style.transformOrigin = "0 0";
  mxAnim(m, T.el, [{ transform: `translate(${dx}px,${dy}px) scale(${s})`, opacity: 0 }, { opacity: 0, offset: .12 }, { opacity: 1, offset: .45 }, { transform: "none", opacity: 1 }], { duration: dur, easing: MX_EASE })
    .onfinish = () => { if (MX === m) { m.flying--; mxReveal(m); } };
  if (m.lbl) {
    const cur = getComputedStyle(m.lbl).transform, cy = g.y + (g.label ? g.label.fs * .06 : 0);
    const tx = T.r.left + T.r.width / 2 - g.x, ty = T.r.top + T.r.height / 2 - cy;
    mxAnim(m, m.lbl, [{ transform: cur === "none" ? "translate(-50%,-50%)" : cur, opacity: 1 }, { opacity: 0, offset: .3 }, { transform: `translate(${tx}px,${ty}px) translate(-50%,-50%) scale(${T.fs / g.label.fs})`, opacity: 0 }], { duration: dur, easing: MX_EASE });
  }
}
// The color has landed and the page is ready: the page shows under the color, and the color lifts off it. The cover's
// own words (its definition, its tier) arrive a moment after the page is built and move the title up; wait for them
// briefly, so the title the label became is exactly where the page will keep it.
function mxReveal(m) {
  if (MX !== m || !m.landed || !m.page || m.flying > 0 || m.revealing) return;
  const ready = !m.page.querySelector(".cp-hero") || m.page.dataset.coverReady || performance.now() - m.landT > MX_SETTLE;
  if (!ready) { requestAnimationFrame(() => mxReveal(m)); return; }
  const T = m.T, now = T && mxTitleRect(m.page);
  if (T && now && (Math.abs(now.r.left - T.r.left) > .5 || Math.abs(now.r.top - T.r.top) > .5 || Math.abs(now.fs - T.fs) > .2)) {
    // the title moved while the page finished: the flown title glides onto it
    const k = now.fs / T.fs;
    m.flying++;
    mxAnim(m, T.el, [{ transform: "none" }, { transform: `translate(${now.r.left - T.r.left}px,${now.r.top - T.r.top}px) scale(${k})` }], { duration: 200, easing: MX_EASE })
      .onfinish = () => { if (MX === m) { m.flying--; m.T = { ...T, r: now.r, fs: now.fs, moved: true }; mxReveal(m); } };
    return;
  }
  m.revealing = true;
  m.page.classList.remove("mx-hold");
  if (m.floor) { m.floor.remove(); m.floor = null; }
  mxAnim(m, m.ov, [{ opacity: 1 }, { opacity: 0 }], { duration: MX_FADE, easing: "ease-out" }).onfinish = () => { if (MX === m) mxKill(); };
}

// ---------- back: the page shrinks into its bubble ----------
// hmHome() asks first: leaving a color's page, the color takes over now and hmHome builds the map a frame later
// (go = the build), so the color is already moving while the map is drawn underneath.
function mxLeave(go) {
  if (MX && MX.dir === "out" && MX.building) return MX;   // the deferred build itself
  if (MX) mxKill();
  // the exit was already animated -- a native iOS/browser back swipe (HIST_POP, core.js) or js/trail.js's own
  // gesture-following pull-down/edge-swipe (TLG_SKIP) -- so the bubble shrink would just be a second, conflicting
  // animation on top of one the user already watched finish. Build the map straight away instead.
  if ((typeof HIST_POP !== "undefined" && HIST_POP) || (typeof TLG_SKIP !== "undefined" && TLG_SKIP)) return null;
  const cur = app.querySelector(".screen");
  if (!mxOn() || !cur || cur.classList.contains("hm")) return null;
  const hero = cur.querySelector(".cp-hero"), h = hero && (hero.style.getPropertyValue("--c") || "").trim();
  if (!/^#[0-9a-f]{6}$/i.test(h || "")) return null;   // only a color's page goes back into a bubble
  const ov = mxOverlay();
  const m = MX = { dir: "out", ov, h, src: cur, mapEl: null, pageGhost: null, timers: [], anims: [], t0: performance.now() };
  m.fill = document.createElement("i"); m.fill.className = "mx-fill"; m.fill.style.background = h; ov.appendChild(m.fill);
  m.T = mxTitle(ov, cur);
  mxAnim(m, ov, [{ opacity: 0 }, { opacity: 1 }], { duration: MX_IN, easing: "ease-out" });
  m.timers.push(setTimeout(() => { if (MX === m) mxKill(); }, 4000));
  if (go) mxFrames(() => {
    if (MX !== m) return;
    if (app.querySelector(".screen") !== cur) return mxKill();   // something else opened meanwhile
    m.building = true; try { go(); } finally { m.building = false; }
  });
  return m;
}
// Called once the map is drawn (exactly where you left it): shrink into the bubble of that color.
function mxLand(m) {
  if (!m || MX !== m) return;
  const cv = m.mapEl && m.mapEl.querySelector("canvas"), ctrl = typeof HM_CTRL !== "undefined" ? HM_CTRL : null;
  const near = MX_LAST && MX_LAST.h === m.h ? MX_LAST : null;   // the copy you tapped, on an endless map
  const geo = cv && cv.isConnected && ctrl && ctrl.geoOf ? ctrl.geoOf(m.h, near) : null;
  // the color is solid by now (or shortly): the page under it can go, and the shrink starts
  const delay = Math.max(0, MX_IN - (performance.now() - m.t0));
  m.timers.push(setTimeout(() => { if (MX === m && m.pageGhost) { m.pageGhost.remove(); m.pageGhost = null; } }, delay));
  if (m.mapEl) {
    m.mapEl.style.transformOrigin = geo ? `${geo.x}px ${geo.y}px` : "50% 50%";
    // David: a corner button (position:fixed) went missing or landed off-screen after Back from a color page.
    // This animation's own fill:"both" keeps its transform "in effect" on m.mapEl (the Home screen) even once
    // it visually settles at scale(1) -- an element with a transform animation still filling is a new containing
    // block for any position:fixed descendant, so every corner (fixed to what it thinks is the viewport) was
    // really fixed to m.mapEl's own box for as long as this lingered. mxKill() cancels every m.anims entry and
    // calls cornersBack() eventually, but only once the whole sequence (overlay fade, title flight…) finishes --
    // this cancels THIS animation's effect the moment it finishes, so the mispositioning window is as short as
    // the shrink itself, not the whole transition.
    mxAnim(m, m.mapEl, [{ transform: "scale(1.12)", opacity: .3 }, { transform: "scale(1)", opacity: 1 }], { duration: MX_SHRINK, delay, easing: MX_EASE_BACK, fill: "both" })
      .onfinish = function () { if (MX === m) m.mapEl.style.transformOrigin = ""; try { this.cancel(); } catch (e) {} };
  }
  if (!geo) {
    // no bubble of this color on screen: the color dissolves into the map
    mxAnim(m, m.ov, [{ opacity: 1 }, { opacity: 0 }], { duration: MX_SHRINK, delay, easing: "ease-out" }).onfinish = () => { if (MX === m) mxKill(); };
    return;
  }
  const S = mxShape(m.ov, geo, m.h);
  S.el.style.transform = "scale(1)";
  m.ov.insertBefore(S.el, m.fill.nextSibling);
  m.timers.push(setTimeout(() => { if (MX === m) m.fill.remove(); }, delay));   // the full-screen color hands over to the shape
  mxAnim(m, S.el, [{ transform: "scale(1)" }, { transform: `scale(${S.s})` }], { duration: MX_SHRINK, delay, easing: MX_EASE_BACK, fill: "both" })
    .onfinish = () => { if (MX !== m) return; mxAnim(m, m.ov, [{ opacity: 1 }, { opacity: 0 }], { duration: 90, easing: "linear" }).onfinish = () => { if (MX === m) mxKill(); }; };
  // the title flies home to the bubble's label (and becomes it)
  if (m.T) {
    const [dx, dy, s] = mxAtBubble(m.T, geo);
    m.T.el.style.transformOrigin = "0 0";
    m.ov.appendChild(m.T.el);
    mxAnim(m, m.T.el, [{ transform: "none", opacity: 1 }, { opacity: 1, offset: .5 }, { transform: `translate(${dx}px,${dy}px) scale(${s})`, opacity: 0 }], { duration: MX_SHRINK, delay, easing: MX_EASE_BACK, fill: "both" });
  }
  const lbl = mxLabel(m.ov, geo);
  if (lbl) mxAnim(m, lbl, [{ opacity: 0 }, { opacity: 0, offset: .55 }, { opacity: 1 }], { duration: MX_SHRINK, delay, easing: "linear", fill: "both" });
}
