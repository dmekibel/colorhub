"use strict";
// A real color picker (Photoshop / Procreate): drag the hue ring, drag inside the saturation-brightness square,
// or use sliders in HSB, RGB or LCh, each track painted with where it will take the color. Optional marks
// (e.g. harmony colors) ride on the ring. Usage: const p = colorPicker(host, { hex, onChange, marks: hex => [hexes] }).

const hsv2rgb = (h, s, v) => { const f = n => { const k = (n + h / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); }; return [f(5), f(3), f(1)].map(x => Math.round(x * 255)); };
const rgb2hsv = ([r, g, b]) => { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0; if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h = (h * 60 + 360) % 360; return [h, mx ? d / mx : 0, mx]; };
const rgbHex = rgb => "#" + rgb.map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0")).join("").toUpperCase();

function colorPicker(host, opts) {
  let [h, s, v] = rgb2hsv(rgb(opts.hex || "#3A7CA5")), mode = opts.mode || "hsb", raf = 0;
  host.innerHTML = `<div class="cp">
    <div class="cp-wheel" data-w>
      <div class="cp-ring"></div>
      <svg class="cp-marks" viewBox="0 0 100 100" aria-hidden="true"></svg>
      <div class="cp-sv" data-sv><i class="cp-sv-knob"></i></div>
      <i class="cp-ring-knob"></i>
    </div>
    <div class="cp-read"><i class="cp-swatch"></i><span><b class="cp-name"></b><em class="cp-near"></em></span><label class="cp-hex"><input data-hex maxlength="7" spellcheck="false" autocomplete="off" aria-label="Hex code"></label></div>
    <div class="cp-modes">${["hsb", "rgb", "lch"].map(m => `<button data-mode="${m}" class="${m === mode ? "on" : ""}">${m.toUpperCase()}</button>`).join("")}</div>
    <div class="cp-sliders" data-sl></div>
  </div>`;
  const $ = q => host.querySelector(q), wheel = $("[data-w]"), sv = $("[data-sv]");
  const hex = () => rgbHex(hsv2rgb(h, s, v));
  // ---------- sliders for the current mode ----------
  const SL = {
    hsb: [["H", 0, 360, () => h, x => { h = x; }, () => Array.from({ length: 7 }, (_, i) => rgbHex(hsv2rgb(i * 60 % 360, 1, 1)))],
          ["S", 0, 100, () => s * 100, x => { s = x / 100; }, () => [rgbHex(hsv2rgb(h, 0, v)), rgbHex(hsv2rgb(h, 1, v))]],
          ["B", 0, 100, () => v * 100, x => { v = x / 100; }, () => ["#000000", rgbHex(hsv2rgb(h, s, 1))]]],
    rgb: [0, 1, 2].map(i => ["RGB"[i], 0, 255, () => hsv2rgb(h, s, v)[i], x => { const c = hsv2rgb(h, s, v); c[i] = x; [h, s, v] = rgb2hsv(c); },
          () => { const c = hsv2rgb(h, s, v), a = c.slice(), b = c.slice(); a[i] = 0; b[i] = 255; return [rgbHex(a), rgbHex(b)]; }]),
    lch: [["L", 0, 100, () => lch(hex())[0], x => setLch(0, x), () => Array.from({ length: 6 }, (_, i) => { const [, C, H] = lch(hex()); return lchHex(i * 20, C, H); })],
          ["C", 0, 130, () => lch(hex())[1], x => setLch(1, x), () => Array.from({ length: 6 }, (_, i) => { const [L, , H] = lch(hex()); return lchHex(L, i * 26, H); })],
          ["H", 0, 360, () => lch(hex())[2], x => setLch(2, x), () => Array.from({ length: 9 }, (_, i) => { const [L, C] = lch(hex()); return lchHex(L, Math.min(C, 60), i * 45); })]],
  };
  function setLch(i, x) { const c = lch(hex()); c[i] = x; [h, s, v] = rgb2hsv(rgb(lchHex(...c))); }
  function drawSliders() {
    $("[data-sl]").innerHTML = SL[mode].map(([lbl], i) => `<div class="cp-sl" data-i="${i}"><span>${lbl}</span><div class="cp-track"><i class="cp-knob"></i></div><b class="mono"></b></div>`).join("");
    host.querySelectorAll(".cp-sl").forEach(row => {
      const track = row.querySelector(".cp-track"), [, lo, hi, , set] = SL[mode][+row.dataset.i];
      track.addEventListener("pointerdown", e => {
        track.setPointerCapture(e.pointerId);
        const move = ev => { const r = track.getBoundingClientRect(); set(lo + clamp((ev.clientX - r.left) / r.width, 0, 1) * (hi - lo)); update(); };
        move(e);
        track.onpointermove = move;
        track.onpointerup = track.onpointercancel = () => { track.onpointermove = null; };
      });
    });
  }
  // ---------- draw everything from h, s, v ----------
  function update(silent) {
    const x = hex();
    host.style.setProperty("--cp-h", rgbHex(hsv2rgb(h, 1, 1)));
    host.style.setProperty("--cp-c", x);
    const r = wheel.clientWidth / 2, ringR = r - 13, a = (h - 90) * Math.PI / 180;
    $(".cp-ring-knob").style.transform = `translate(${r + ringR * Math.cos(a) - 12}px,${r + ringR * Math.sin(a) - 12}px)`;
    $(".cp-sv-knob").style.left = s * 100 + "%"; $(".cp-sv-knob").style.top = (1 - v) * 100 + "%";
    SL[mode].forEach(([, lo, hi, get, , grad], i) => {
      const row = host.querySelector(`.cp-sl[data-i="${i}"]`); if (!row) return;
      const val = get(), t = row.querySelector(".cp-track");
      t.style.background = `linear-gradient(90deg,${grad().join(",")})`;
      row.querySelector(".cp-knob").style.left = clamp((val - lo) / (hi - lo), 0, 1) * 100 + "%";
      row.querySelector("b").textContent = Math.round(val);
    });
    const inp = $("[data-hex]"); if (document.activeElement !== inp) inp.value = x;
    const [near] = nearestColors(x, 1);
    $(".cp-name").textContent = near ? "≈ " + near[0].n : x;
    $(".cp-near").textContent = near ? `${closeness(near[1])} · ΔE ${near[1].toFixed(1)}` : "";
    if (opts.marks) {
      $(".cp-marks").innerHTML = opts.marks(x).map((m, i) => { const mh = rgb2hsv(rgb(m))[0], ma = (mh - 90) * Math.PI / 180, mr = 50 - 13 / wheel.clientWidth * 100;
        return `<circle cx="${(50 + mr * Math.cos(ma)).toFixed(2)}" cy="${(50 + mr * Math.sin(ma)).toFixed(2)}" r="${i ? 3.6 : 0}" fill="${m}" stroke="#F3F3F1" stroke-width=".9"/>`; }).join("");
    }
    if (!silent && opts.onChange) { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => opts.onChange(x)); }
  }
  // ---------- dragging the ring and the square ----------
  wheel.addEventListener("pointerdown", e => {
    const r = wheel.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const onSv = sv.contains(e.target) || e.target === sv;
    wheel.setPointerCapture(e.pointerId);
    const move = ev => {
      if (onSv) { const q = sv.getBoundingClientRect(); s = clamp((ev.clientX - q.left) / q.width, 0, 1); v = 1 - clamp((ev.clientY - q.top) / q.height, 0, 1); }
      else { h = (Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180 / Math.PI + 90 + 360) % 360; }
      update();
    };
    move(e);
    wheel.onpointermove = move;
    wheel.onpointerup = wheel.onpointercancel = () => { wheel.onpointermove = null; buzz(4); };
  });
  host.querySelectorAll("[data-mode]").forEach(b => b.onclick = () => { mode = b.dataset.mode; host.querySelectorAll("[data-mode]").forEach(x => x.classList.toggle("on", x === b)); drawSliders(); update(true); });
  $("[data-hex]").addEventListener("input", e => { const t = e.target.value.trim(); if (/^#?[0-9a-f]{6}$/i.test(t)) { [h, s, v] = rgb2hsv(rgb("#" + t.replace("#", ""))); update(); } });
  drawSliders();
  requestAnimationFrame(() => update(true));
  const onResize = () => { if (!host.isConnected) return removeEventListener("resize", onResize); update(true); };
  addEventListener("resize", onResize);
  cleanup.push(() => removeEventListener("resize", onResize));
  return { set: x => { [h, s, v] = rgb2hsv(rgb(x)); update(true); }, get: hex };
}
