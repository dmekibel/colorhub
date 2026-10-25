"use strict";
// Smooth, continuous zoom for a masonry of tiles (David, 2026-10-24: "make both smoother like iPhone, where you see it zooming
// as you do it instead of snapping"). ONE module for the painter page's life's-work grid (js/gallery.js glGrid) and both Keep
// exploring feeds (js/feed.js), so they can never diverge.
//
//   gzAttach(host, o) -> { destroy, step(delta) }
//     host   the element whose children are the absolutely placed tiles (it is the thing that gets scaled)
//     o.cols()           the column count now
//     o.min, o.max       () => the fewest / most columns allowed right now
//     o.colW()           the tile width in px now (read again after setCols, for the settle animation)
//     o.setCols(c, fx, fy, toY) -> bool   relayout at c columns, keeping the tile under the viewport point (fx, fy) at toY (default fy)
//
// While two fingers are down (or a trackpad pinch / ctrl+wheel is going) the whole grid is scaled live with a transform on the
// host, anchored at the pinch midpoint, in a requestAnimationFrame: composited by the GPU, no relayout, no image loads. On
// release it settles to the nearest column count: the grid is laid out at that count and a short eased FLIP animation runs
// from where the fingers left it to the new layout. Past the fewest / most columns it rubber-bands back. + / - keys (and a
// ctrl+mouse-wheel notch) step one column with the same settle. Reduced motion: no live scale, the step is instant.
const GZ_SETTLE_MS = 280, GZ_IDLE_MS = 150, GZ_EASE = "cubic-bezier(.2,.8,.2,1)";
const GZ_SET = new Set();
const GZ_DBG = { frames: 0, scales: [], commits: 0, last: 1 };   // for the smoke test and for measuring: every live scale written, the settles
const gzBand = (s, lo, hi) => s > hi ? hi * Math.pow(s / hi, .3) : s < lo ? lo * Math.pow(s / lo, .3) : s;   // rubber band: resistance beyond the limits

function gzAttach(host, o) {
  const st = { on: false, c0: 1, d0: 0, fx: 0, fy: 0, ty: 0, raw: 1, wheel: false, raf: 0, idle: 0, fin: 0, rx: 0, ry: 0, touch: false };
  const limits = () => { const mn = o.min(), mx = o.max(), c = o.cols(); return { lo: c / mx, hi: c / mn }; };   // scale limits: all the way to max columns / min columns
  const clearStyle = () => {
    clearTimeout(st.fin); host.style.transition = ""; host.style.transform = ""; host.style.transformOrigin = ""; host.style.willChange = "";
    document.documentElement.style.overflowX = "";
  };
  const write = () => {
    st.raf = 0; if (!st.on) return;
    const { lo, hi } = limits(), s = gzBand(st.raw, lo, hi);
    host.style.transform = `translate3d(0,${st.ty}px,0) scale(${s})`;
    GZ_DBG.frames++; GZ_DBG.last = s; if (GZ_DBG.scales.length < 600) GZ_DBG.scales.push(+s.toFixed(4));
  };
  const begin = (fx, fy) => {
    clearStyle();
    const r = host.getBoundingClientRect();
    Object.assign(st, { on: true, c0: o.cols(), fx, fy, ty: 0, raw: 1, rx: fx - r.left, ry: fy - r.top });
    host.style.transition = "none"; host.style.transformOrigin = `${st.rx}px ${st.ry}px`; host.style.willChange = "transform";
    document.documentElement.style.overflowX = "clip";   // a scaled grid must not grow the page sideways
  };
  // settle: the layout goes to c columns now; the picture animates from the scale the fingers left (s) to rest
  const settle = (c, s) => {
    const c0 = o.cols(), wOld = o.colW(), toY = st.fy + st.ty;
    clearStyle();
    let from = s;
    if (c !== c0) {
      if (!o.setCols(c, st.fx, st.fy, toY)) { from = s; } else { const wNew = o.colW(); from = wOld > 0 && wNew > 0 ? s / (wNew / wOld) : 1; }
    }
    GZ_DBG.commits++;
    if (reduceMotion || Math.abs(from - 1) < .004) { st.on = false; return; }
    const same = c === c0, r = host.getBoundingClientRect();
    const ox = same ? st.rx : st.fx - r.left, oy = same ? st.ry : toY - r.top;   // no relayout: the live transform (translate, then scale about the pinch point) is picked up exactly
    host.style.willChange = "transform"; host.style.transition = "none"; host.style.transformOrigin = `${ox}px ${oy}px`;
    host.style.transform = same ? `translate3d(0,${st.ty}px,0) scale(${from})` : `scale(${from})`;
    host.getBoundingClientRect();   // commit the start frame
    host.style.transition = `transform ${GZ_SETTLE_MS}ms ${GZ_EASE}`; host.style.transform = "translate3d(0,0,0) scale(1)";
    st.fin = setTimeout(() => { clearStyle(); st.on = false; }, GZ_SETTLE_MS + 60);
  };
  const end = () => {
    if (!st.on) return;
    cancelAnimationFrame(st.raf); st.raf = 0; clearTimeout(st.idle);
    const { lo, hi } = limits(), mn = o.min(), mx = o.max();
    const c = Math.max(mn, Math.min(mx, Math.round(st.c0 / Math.max(.05, st.raw))));
    const s = gzBand(st.raw, lo, hi);
    if (c !== st.c0 && typeof buzz === "function") buzz(6);
    settle(c, reduceMotion ? 1 : s);
  };

  // ----- two fingers -----
  const dist = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  const midY = t => (t[0].clientY + t[1].clientY) / 2;
  const onTS = e => {
    if (e.touches.length === 2) {
      e.stopPropagation(); clearTimeout(st.fin);
      begin((e.touches[0].clientX + e.touches[1].clientX) / 2, midY(e.touches)); st.d0 = dist(e.touches); st.touch = true; st.wheel = false;
    } else if (st.on && st.touch) end();
  };
  const onTM = e => {
    if (!st.on || !st.touch || e.touches.length !== 2) return;
    e.preventDefault(); e.stopPropagation();
    st.raw = dist(e.touches) / (st.d0 || 1); st.ty = midY(e.touches) - st.fy;
    if (!reduceMotion && !st.raf) st.raf = requestAnimationFrame(write);
  };
  const onTE = e => { if (st.on && st.touch && e.touches.length < 2) { st.touch = false; end(); } };
  host.style.touchAction = "pan-y"; host.setAttribute("data-nopull", "");
  host.addEventListener("touchstart", onTS, { passive: false });
  host.addEventListener("touchmove", onTM, { passive: false });
  host.addEventListener("touchend", onTE, { passive: true }); host.addEventListener("touchcancel", onTE, { passive: true });

  // ----- trackpad pinch / ctrl+wheel -----
  const onWheel = e => {
    if (!e.ctrlKey) return;
    e.preventDefault(); e.stopPropagation();
    const dy = e.deltaMode === 0 ? e.deltaY : e.deltaY * 33;
    if (Math.abs(dy) >= 40 && Number.isInteger(dy) && !st.on) { step(dy < 0 ? -1 : 1, e.clientX, e.clientY); return; }   // a mouse-wheel notch: one column
    if (!st.on || st.touch) { if (st.on) return; begin(e.clientX, e.clientY); st.wheel = true; }
    st.raw = Math.max(.05, Math.min(20, st.raw * Math.exp(-dy * .012)));
    if (!reduceMotion && !st.raf) st.raf = requestAnimationFrame(write);
    clearTimeout(st.idle); st.idle = setTimeout(() => { st.wheel = false; end(); }, GZ_IDLE_MS);
  };
  // A wheel listener that can preventDefault makes the browser hand EVERY wheel over the grid to the main thread first (Safari: the whole
  // grid becomes a non-fast-scrollable region), so while pictures decode or a page of tiles is laid out, the mouse wheel / trackpad scroll
  // over a painting stalls and "refuses to scroll" while it works over the gutter (David, 2026-10-25, desktop). Chromium needs the
  // listener for a trackpad pinch (a ctrl+wheel with no key down) and blocks only the first event of a sequence; Safari pinches with
  // gesture events (no wheel), so there the listener exists only while Control / Command is actually held (a mouse ctrl+wheel).
  const SAFARI = /^((?!chrome|android|crios|fxios|edg).)*safari/i.test(navigator.userAgent);
  let armed = false;
  const arm = on => { if (on === armed) return; armed = on; if (on) host.addEventListener("wheel", onWheel, { passive: false }); else host.removeEventListener("wheel", onWheel); };
  const onKey = e => { if (e.key === "Control" || e.key === "Meta") arm(e.type === "keydown"); };
  const onBlur = () => arm(false);
  if (!SAFARI) arm(true);
  else { addEventListener("keydown", onKey); addEventListener("keyup", onKey); addEventListener("blur", onBlur); }

  // ----- keys: + / = bigger tiles (fewer across), - / _ smaller -----
  function step(delta, fx, fy) {   // delta -1 = one column fewer (bigger tiles), +1 = one more
    if (st.on) return false;
    const c0 = o.cols(), c = Math.max(o.min(), Math.min(o.max(), c0 + delta));
    if (c === c0) return false;
    const r = host.getBoundingClientRect(), vy = fy == null ? Math.max(r.top, Math.min(r.bottom, innerHeight / 2)) : fy, vx = fx == null ? r.left + r.width / 2 : fx;
    Object.assign(st, { on: true, c0, fx: vx, fy: vy, ty: 0, raw: 1, touch: false, wheel: false });
    buzz && buzz(5);
    settle(c, 1);   // the picture starts as the OLD layout (scale 1/sF in the new one) and eases to the new
    return true;
  }
  const api = { destroy() { clearStyle(); cancelAnimationFrame(st.raf); clearTimeout(st.idle); GZ_SET.delete(api); host.removeEventListener("touchstart", onTS); host.removeEventListener("touchmove", onTM); host.removeEventListener("touchend", onTE); host.removeEventListener("touchcancel", onTE); arm(false); removeEventListener("keydown", onKey); removeEventListener("keyup", onKey); removeEventListener("blur", onBlur); }, step, host, get busy() { return st.on; } };
  GZ_SET.add(api);
  return api;
}
// + / - on a desktop keyboard: the grid most on screen takes it
addEventListener("keydown", e => {
  if (e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented || !GZ_SET.size) return;
  const k = e.key === "+" || e.key === "=" ? -1 : e.key === "-" || e.key === "_" ? 1 : 0; if (!k) return;
  const t = e.target; if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
  let best = null, bv = 0;
  GZ_SET.forEach(g => { if (!g.host.isConnected) return; const r = g.host.getBoundingClientRect(), v = Math.min(r.bottom, innerHeight) - Math.max(r.top, 0); if (v > bv && v > 120) { bv = v; best = g; } });
  if (best && best.step(k)) e.preventDefault();
});
