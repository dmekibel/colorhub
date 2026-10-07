"use strict";
// The honeycomb (watchOS app grid): every color as a bubble in a hex grid that is also a color wheel
// (greys in the middle, hue around, strength outward). Bubbles are full size near the center and shrink
// toward the edges like a lens. Drag to browse; tap a bubble to open it. Used as Explore's Spectrum view.

let HONEY = null, HONEY_PAN = null;
function honeyLayout() {
  if (HONEY) return HONEY;
  const cols = EVERY(), rings = new Map();
  for (let q = -9; q <= 9; q++) for (let r = -9; r <= 9; r++) {
    const d = Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r));
    if (d > 8) continue;
    const cell = { x: q + r / 2, y: r * Math.sqrt(3) / 2 };
    cell.a = Math.atan2(cell.y, cell.x);
    if (!rings.has(d)) rings.set(d, []);
    rings.get(d).push(cell);
  }
  const pool = [];
  for (let d = 0; pool.length < cols.length; d++) {
    const ring = rings.get(d).sort((a, b) => a.a - b.a), need = cols.length - pool.length;
    if (ring.length <= need) pool.push(...ring);
    else for (let i = 0; i < need; i++) pool.push(ring[Math.floor(i * ring.length / need)]);
  }
  const R = Math.max(...pool.map(c => Math.hypot(c.x, c.y)));
  const targets = cols.map(c => { const [, C, H] = lch(c.h), r = R * Math.pow(Math.min(C, 110) / 110, .7), a = H * Math.PI / 180; return { c, x: r * Math.cos(a), y: -r * Math.sin(a) }; });
  const pairs = [];
  targets.forEach((t, i) => pool.forEach((cell, j) => pairs.push([(t.x - cell.x) ** 2 + (t.y - cell.y) ** 2, i, j])));
  pairs.sort((a, b) => a[0] - b[0]);
  const ti = new Set(), cj = new Set(), out = [];
  for (const [, i, j] of pairs) {
    if (ti.has(i) || cj.has(j)) continue;
    ti.add(i); cj.add(j); out.push({ c: targets[i].c, x: pool[j].x, y: pool[j].y });
    if (out.length === targets.length) break;
  }
  return (HONEY = { items: out, R });
}

function honeycomb(host, opts) {
  const { items, R } = honeyLayout(), SP = 72, BUB = 64;
  host.innerHTML = items.map((it, i) => {
    const st = it.c.id && S.cards[it.c.id];
    return `<button class="bub${st && st.own ? " own" : ""}" data-i="${i}" data-ink="${ink(it.c.h)}" style="--c:${it.c.h}" aria-label="${esc(it.c.n)}"><span>${esc(it.c.n)}</span></button>`;
  }).join("");
  const els = [...host.children];
  let px = 0, py = 0, vx = 0, vy = 0, raf = 0;
  const maxPan = R * SP * .9;
  function frame() {
    const w = host.clientWidth, h = host.clientHeight, cx = w / 2, cy = h / 2;
    px = clamp(px, -maxPan, maxPan); py = clamp(py, -maxPan, maxPan);
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      let x = cx + it.x * SP + px, y = cy + it.y * SP + py;
      // the lens fills the panel: full size in the middle, shrinking and pulled inward toward the edges
      const dx = x - cx, dy = y - cy, d = Math.hypot(dx / (w / 2 - 6), dy / (h / 2 - 6));
      const s = d < .6 ? 1 : Math.max(0, 1 - (d - .6) * 1.7), pull = d < .6 ? 1 : 1 - Math.min(.22, (d - .6) * .3);
      x = cx + dx * pull; y = cy + dy * pull;
      const el = els[i];
      el.style.transform = `translate3d(${(x - BUB / 2).toFixed(1)}px,${(y - BUB / 2).toFixed(1)}px,0) scale(${s.toFixed(3)})`;
      const lbl = s > .86 ? "1" : "";
      if (el.dataset.l !== lbl) el.dataset.l = lbl;
      el.style.visibility = s < .08 ? "hidden" : "";
    }
  }
  const glide = () => { vx *= .93; vy *= .93; px += vx; py += vy; frame(); raf = Math.hypot(vx, vy) > .3 ? requestAnimationFrame(glide) : 0; };
  let down = null;
  host.addEventListener("pointerdown", e => {
    cancelAnimationFrame(raf); raf = 0;
    down = { x: e.clientX, y: e.clientY, px, py, moved: false, last: [e.clientX, e.clientY, performance.now()], target: e.target.closest(".bub") };
    host.setPointerCapture(e.pointerId);
  });
  host.addEventListener("pointermove", e => {
    if (!down) return;
    const dx = e.clientX - down.x, dy = e.clientY - down.y;
    if (!down.moved && Math.hypot(dx, dy) > 7) down.moved = true;
    if (!down.moved) return;
    const now = performance.now(), [lx, ly, lt] = down.last, dt = Math.max(now - lt, 1);
    vx = (e.clientX - lx) / dt * 16; vy = (e.clientY - ly) / dt * 16; down.last = [e.clientX, e.clientY, now];
    px = down.px + dx; py = down.py + dy; frame();
  });
  const end = () => {
    if (!down) return;
    const d = down; down = null;
    if (!d.moved) { if (d.target) { morphFrom(d.target); opts.pick(items[+d.target.dataset.i]); } return; }
    if (performance.now() - d.last[2] > 80) vx = vy = 0;
    HONEY_PAN = [px, py];
    raf = requestAnimationFrame(glide);
  };
  host.addEventListener("pointerup", end);
  host.addEventListener("pointercancel", end);
  addEventListener("resize", frame);
  cleanup.push(() => { cancelAnimationFrame(raf); removeEventListener("resize", frame); HONEY_PAN = [px, py]; });
  if (HONEY_PAN) [px, py] = HONEY_PAN;
  else { const f = items.find(it => it.c === opts.focus) || items[0]; px = -f.x * SP; py = -f.y * SP; }
  requestAnimationFrame(frame);
}
