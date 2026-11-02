"use strict";
// Opt-in speed readout for a real device (David, 2026-10-25: "the color map is slow on iPad, when opening and then panning").
// Open the app as https://chromatlas.app/?perf=1 and screenshot the box in the corner after you have panned around for a few seconds.
// Off for everyone else: with no ?perf=1 this file does nothing and js/honey.js never calls it.
(function () {
  if (!/[?&]perf=1\b/.test(location.search)) return;
  const nav = () => performance.getEntriesByType("navigation")[0] || {};
  const P = window.__perf = { t0: performance.now(), first: 0, draws: [], moves: [], cells: 0, cw: 0, ch: 0, dpr: 0, down: false, last: 0 };
  P.frame = (ms, cells, cw, ch, dpr) => { if (!P.first) P.first = performance.now(); P.cells = cells; P.cw = cw; P.ch = ch; P.dpr = dpr; P.draws.push(ms); if (P.draws.length > 90) P.draws.shift(); };
  const box = document.createElement("pre");
  box.style.cssText = "position:fixed;left:8px;bottom:8px;z-index:99999;margin:0;padding:10px 12px;border-radius:10px;background:rgba(0,0,0,.82);color:#9FFFB0;font:12px/1.35 ui-monospace,Menlo,monospace;pointer-events:none;white-space:pre";
  const add = () => document.body && document.body.appendChild(box);
  if (document.body) add(); else addEventListener("DOMContentLoaded", add);
  addEventListener("pointerdown", () => { P.down = true; P.last = 0; }, true);
  addEventListener("pointerup", () => { P.down = false; }, true);
  addEventListener("pointercancel", () => { P.down = false; }, true);
  const raf = t => { if (P.down) { if (P.last) { P.moves.push(t - P.last); if (P.moves.length > 120) P.moves.shift(); } P.last = t; } else P.last = 0; requestAnimationFrame(raf); };
  requestAnimationFrame(raf);
  const q = (a, f) => { if (!a.length) return "-"; const s = a.slice().sort((x, y) => x - y); return s[Math.floor((s.length - 1) * f)].toFixed(0); };
  const fps = a => a.length ? Math.round(1000 / (a.reduce((p, c) => p + c, 0) / a.length)) : "-";
  setInterval(() => {
    const n = nav(), ps = performance.getEntriesByType("paint").find(e => e.name === "first-contentful-paint");
    box.textContent = [
      "perf  " + location.pathname + location.hash,
      "scripts parsed  " + Math.round(n.domContentLoadedEventEnd || 0) + " ms",
      "first paint     " + Math.round(ps ? ps.startTime : 0) + " ms",
      "map first draw  " + (P.first ? Math.round(P.first) + " ms" : "not yet"),
      "screen " + innerWidth + "x" + innerHeight + "  dpr " + devicePixelRatio,
      "canvas " + P.cw + "x" + P.ch + "  cells " + P.cells,
      "draw (JS) ms   p50 " + q(P.draws, .5) + "  p95 " + q(P.draws, .95) + "  max " + q(P.draws, 1),
      "while dragging  " + fps(P.moves) + " fps  (frame p50 " + q(P.moves, .5) + " ms, p95 " + q(P.moves, .95) + " ms)",
    ].join("\n");
  }, 500);
})();
