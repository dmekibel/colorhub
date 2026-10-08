"use strict";
// Shared design components (lane L12, DESIGN-SYSTEM.md + design/GENIUS-PANEL-1.md "L12 · Design lead").
// The organizing idea: ColorHub is one map of all color, which you light up by learning to name and see it.
// Four small pieces every screen gets for free, with no per-screen wiring:
//   1. The relation mark: one tiny mark for your relation to a color, the same everywhere (like a checkmark).
//   2. The squint key: one value-only toggle on every image and palette, so seeing value becomes a habit.
//   3. The lesson-complete moment: plates settle in, one "done" haptic.
//   4. Fly to the map: at lesson complete, each new color flies to its spot on the honeycomb and lights it.
// All four read the DOM after it renders (one debounced MutationObserver), so other lanes' screens pick them up
// by markup alone: [data-swatch] / [data-rel-hex] chips get the mark, [data-squint] containers get the key.

// ---------------------------------------------------------------- 1. the relation mark
// States:
//   "" unmet (no mark) · "met" an outline ring · "yours" a solid corner disc (confirmed by a check, never a
//   self-graded swipe alone) · "confused" a half disc (you mixed it up with a neighbor). Pairs you confuse get a
//   hairline thread drawn between their chips by .rel-thread (CSS), wherever a screen shows the two together.
let REL_BYHEX = null;
function relColorOf(hex) {
  if (!hex) return null;
  if (!REL_BYHEX) { REL_BYHEX = new Map(); (typeof ALL !== "undefined" ? ALL : []).forEach(c => REL_BYHEX.set(c.h.toUpperCase(), c)); }
  return REL_BYHEX.get(String(hex).trim().toUpperCase()) || null;
}
// js/learner.js owns the state (relMark(color) -> "" | "met" | "yours" | "confused"); this only draws it.
// Without the Learner Model, S.cards decides: Yours only once confirmed by a check.
function relState(cOrHex) {
  const c = typeof cOrHex === "string" ? (relColorOf(cOrHex) || { h: cOrHex }) : cOrHex;
  if (!c) return "";
  if (typeof relMark === "function") { try { return relMark(c) || ""; } catch (e) {} }
  const app = c.id ? c : relColorOf(c.h), st = app && S && S.cards && S.cards[app.id];
  if (!st) return "";
  return typeof isMine === "function" && isMine(st) ? "yours" : "met";
}
const REL_SEL = "[data-swatch], [data-rel-hex], .lk-row > i, .cp-near > i, .hc-cap > i";
function relHexOf(el) {
  return el.dataset.relHex || el.dataset.swatch || (el.parentElement && el.parentElement.dataset.h) || el.style.getPropertyValue("--c") || "";
}
function relDecorate(root) {
  if (document.documentElement.classList.contains("booth")) return;   // judged screens: nothing on or near a swatch
  root.querySelectorAll(REL_SEL).forEach(row => {
    if (row.closest(".deck,.drill,.station,.meet,.daily,.pk-board")) return;
    // a whole list row that carries data-swatch: the mark goes on the row's own chip, not floating at its corner
    const el = row.offsetWidth > 160 && row.querySelector(":scope > i, :scope > span > i") || row;
    const s = relState(relHexOf(row));
    if ((el.dataset.rel || "") === s) return;
    if (!s) { delete el.dataset.rel; return; }
    if (el.dataset.rel == null) {   // first time: never take over an ::after the chip already draws
      const a = getComputedStyle(el, "::after").content;
      if (a && a !== "none" && a !== "normal") return;
    }
    if (getComputedStyle(el).position === "static") el.style.position = "relative";
    el.dataset.rel = s;
  });
}

// ---------------------------------------------------------------- 2. the squint key
// One toggle, app-wide and remembered for the session: the whole page goes value-only (images through a
// per-pixel L* pass, since CSS grayscale() isn't perceptual; swatches to the neutral grey of the same L*).
// Turning it off restores every original. Images that can't be read (no CORS) fall back to CSS grayscale.
let SQUINT = false;
const SQ_GLYPH = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M3 12c2.6-4 5.6-6 9-6s6.4 2 9 6c-2.6 4-5.6 6-9 6s-6.4-2-9-6z"/><path d="M12 9a3 3 0 0 0 0 6z" fill="currentColor"/><circle cx="12" cy="12" r="3"/></svg>`;
const SQ_SEL = "[data-squint], .gl-hero > span, .pv-img, .z-art";
const sqGrey = css => {
  const m = String(css).match(/^#([0-9a-f]{6})$/i) ? css : (() => { const r = String(css).match(/rgba?\((\d+)[, ]+(\d+)[, ]+(\d+)/); return r ? "#" + [r[1], r[2], r[3]].map(v => (+v).toString(16).padStart(2, "0")).join("") : null; })();
  return m ? lchHex(lch(m)[0], 0, 0) : null;
};
let SQ_LUT = null;
function sqImage(img) {
  if (img.dataset.sqSrc) return;
  try {
    if (!img.complete || !img.naturalWidth) { img.addEventListener("load", () => SQUINT && sqImage(img), { once: true }); return; }
    const w = Math.min(img.naturalWidth, 900), h = Math.round(img.naturalHeight * w / img.naturalWidth);
    const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
    const x = cv.getContext("2d"); x.drawImage(img, 0, 0, w, h);
    const d = x.getImageData(0, 0, w, h), p = d.data;   // throws on a tainted (cross-origin, no CORS) image
    if (!SQ_LUT) SQ_LUT = Float32Array.from({ length: 256 }, (_, i) => { const v = i / 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; });
    for (let i = 0; i < p.length; i += 4) {
      const Y = .2126 * SQ_LUT[p[i]] + .7152 * SQ_LUT[p[i + 1]] + .0722 * SQ_LUT[p[i + 2]];
      // L* of Y, back to the sRGB grey with that same L* (so equal L* reads as equal grey)
      const L = Y > .008856 ? 116 * Math.cbrt(Y) - 16 : 903.3 * Y, Yg = L > 8 ? ((L + 16) / 116) ** 3 : L / 903.3;
      const g = Math.round(255 * (Yg <= .0031308 ? 12.92 * Yg : 1.055 * Yg ** (1 / 2.4) - .055));
      p[i] = p[i + 1] = p[i + 2] = g;
    }
    x.putImageData(d, 0, 0);
    img.dataset.sqSrc = img.currentSrc || img.src;
    if (img.srcset) { img.dataset.sqSet = img.srcset; img.removeAttribute("srcset"); }
    img.src = cv.toDataURL("image/jpeg", .9);
  } catch (e) { img.classList.add("sq-css"); }
}
function sqApply(root) {
  const scr = root.querySelector ? root : document;
  scr.querySelectorAll(SQ_SEL).forEach(c => c.querySelectorAll("img").forEach(sqImage));
  scr.querySelectorAll('[style*="--c"],[style*="background"]').forEach(el => {
    if (el.dataset.sqC != null || el.dataset.sqBg != null || el.closest(".sq-key,.corner,.rooms-stem")) return;
    const c = el.style.getPropertyValue("--c").trim();
    if (c) { const g = sqGrey(c); if (g) { el.dataset.sqC = c; el.style.setProperty("--c", g); } }
    const bg = el.style.background || el.style.backgroundColor;
    if (bg && !/gradient|url|var\(/.test(bg)) { const g = sqGrey(bg); if (g) { el.dataset.sqBg = bg; el.style.background = g; } }
    else if (bg && /gradient/.test(bg)) el.classList.add("sq-css");
  });
}
function sqRestore() {
  document.querySelectorAll("[data-sq-src]").forEach(img => { img.src = img.dataset.sqSrc; if (img.dataset.sqSet) img.srcset = img.dataset.sqSet; delete img.dataset.sqSrc; delete img.dataset.sqSet; });
  document.querySelectorAll("[data-sq-c]").forEach(el => { el.style.setProperty("--c", el.dataset.sqC); delete el.dataset.sqC; });
  document.querySelectorAll("[data-sq-bg]").forEach(el => { el.style.background = el.dataset.sqBg; delete el.dataset.sqBg; });
  document.querySelectorAll(".sq-css").forEach(el => el.classList.remove("sq-css"));
}
function setSquint(on) {
  SQUINT = !!on; buzz(4);
  document.documentElement.classList.toggle("squint", SQUINT);
  document.querySelectorAll(".sq-key").forEach(b => { b.classList.toggle("on", SQUINT); b.setAttribute("aria-pressed", SQUINT); });
  if (SQUINT) { sqApply(document); toast("Value only"); } else sqRestore();
}
// the key itself: a solid 44px level-2 circle, bottom-right on its image (DESIGN-SYSTEM §10 "Floating icon")
const squintKey = () => `<button class="iconq sq-key${SQUINT ? " on" : ""}" aria-pressed="${SQUINT}" aria-label="Squint: show value only" data-sq-key>${SQ_GLYPH}</button>`;
document.addEventListener("click", e => { const k = e.target.closest && e.target.closest("[data-sq-key]"); if (k) { e.preventDefault(); e.stopPropagation(); setSquint(!SQUINT); } }, true);
function sqDecorate(root) {
  root.querySelectorAll(SQ_SEL).forEach(c => {
    if (c.querySelector(":scope > .sq-key") || c.closest(".deck,.drill,.station")) return;
    if (getComputedStyle(c).position === "static") c.style.position = "relative";
    c.insertAdjacentHTML("beforeend", squintKey());
  });
  if (SQUINT) sqApply(root);
}

// ---------------------------------------------------------------- 3. the lesson-complete moment
// The done screens (Learn it's .lt-done-pal, a unit's .result chips, and anything marked [data-done-moment])
// settle in with the CSS cascade in css/polish.css; this adds the one "done" haptic (DESIGN-SYSTEM §9: 10·30·20).
function doneMoment(root) {
  const d = root.querySelector(".lt-done-pal, .result .chips, [data-done-moment]");
  if (!d || d.dataset.doneBuzzed) return;
  d.dataset.doneBuzzed = "1";
  setTimeout(() => buzz([10, 30, 20]), reduceMotion ? 0 : 520);
}

// ---------------------------------------------------------------- 4. fly to the map
// flyToMap(colors, sources?): the Journey (and any lesson) calls this at lesson complete. Home (the map) takes
// over; each new color leaves its source chip (or the bottom of the screen) and flies, one after another, to its
// own bubble on the honeycomb, which lights with a soft ring. Over weeks the map visibly fills.
// colors: [{h, n}] (taught colors or any hex); sources: optional matching elements (fan cards, plates) to fly from.
function flyToMap(colors, sources = []) {
  colors = (colors || []).filter(c => c && c.h);
  const from = colors.map((c, i) => { const s = sources[i]; const r = s && s.isConnected ? s.getBoundingClientRect() : null; return r && r.width ? r : null; });
  const n = colors.length;
  if (typeof hmHome !== "function") return;
  hmHome();
  const note = () => n && toast(`${n} new on your map`);
  if (reduceMotion || !n) return setTimeout(note, 200);
  const W = innerWidth, H = innerHeight;
  const flyers = colors.map((c, i) => {
    const r = from[i] || { left: W / 2 - 22 + (i - (n - 1) / 2) * 52, top: H - 140, width: 44, height: 44 };
    const f = document.createElement("i");
    f.className = "map-flyer"; f.style.background = c.h;
    Object.assign(f.style, { left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px" });
    document.body.appendChild(f);
    return { f, r };
  });
  // let the honeycomb draw and settle (its own open animation) before reading where each bubble sits
  setTimeout(() => {
    const ctrl = window.HM_CTRL;
    flyers.forEach(({ f, r }, i) => {
      const at = ctrl && ctrl.locate ? ctrl.locate(colors[i].h) : null;
      const tx = at ? at.x : W / 2, ty = at ? at.y : H / 2, d = at ? at.d : 24;
      const sx = d / r.width, sy = d / r.height;
      const dx = tx - (r.left + r.width / 2), dy = ty - (r.top + r.height / 2);
      const a = f.animate([
        { transform: "none", borderRadius: "4px", opacity: 1 },
        { transform: `translate(${dx * .5}px,${dy * .5 - 40}px) scale(${(1 + sx) / 2},${(1 + sy) / 2})`, borderRadius: "40%", opacity: 1, offset: .55 },
        { transform: `translate(${dx}px,${dy}px) scale(${sx},${sy})`, borderRadius: "50%", opacity: at ? 1 : 0 },
      ], { duration: 620, delay: i * 90, easing: "cubic-bezier(.32,.72,0,1)", fill: "forwards" });
      a.onfinish = () => {
        if (at) {
          const ring = document.createElement("i");
          ring.className = "map-light";
          Object.assign(ring.style, { left: tx - d / 2 + "px", top: ty - d / 2 + "px", width: d + "px", height: d + "px", "--c": colors[i].h });
          document.body.appendChild(ring);
          setTimeout(() => ring.remove(), 900);
          buzz(4);
        }
        f.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, fill: "forwards" }).onfinish = () => f.remove();
      };
    });
    setTimeout(note, 620 + n * 90);
  }, 520);
}

// ---------------------------------------------------------------- one observer for all of the above
let POLISH_RAF = 0;
function polishPass() {
  POLISH_RAF = 0;
  const root = document.body;
  try { relDecorate(root); } catch (e) {}
  try { sqDecorate(root); } catch (e) {}
  try { doneMoment(root); } catch (e) {}
}
if (!/^#shot=honey/.test(location.hash)) {
  // only when elements are added (a new screen, a sheet, a lazy shelf): live text updates (the honeycomb's
  // caption, counters, timers) never trigger a pass
  new MutationObserver(ms => {
    if (POLISH_RAF || !ms.some(m => [...m.addedNodes].some(n => n.nodeType === 1 && !n.matches(".map-flyer,.map-light,.toast,.flyer,.fade-ghost")))) return;
    POLISH_RAF = requestAnimationFrame(polishPass);
  })
    .observe(document.body, { childList: true, subtree: true });
}
