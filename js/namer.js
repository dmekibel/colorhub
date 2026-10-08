"use strict";
// Name any color (#/studio/namer). Pick a color any way you like and the app names it while you drag: the
// nearest of about 1,000 names, big, with its % match; the next four, each with how yours differs from it; or
// "between X and Y" when it sits between two. Five ways to pick, switchable as tabs:
//   Ring        the Gamut wheel's OKLab disc (js/studio.js) plus a Lightness slider; harmonies live on the Gamut wheel
//   Perceptual  OKLCH: a lightness x chroma plane and a hue slider, so equal steps look equal
//   Names       a hue x lightness field with the names' own positions marked; the pick snaps softly to a name as you pass
//   Type        hex or RGB typed in, plus the same color written five ways
//   Eyedrop     a photo or the live camera: tap a spot and the patch is averaged in linear light (isoSample)
// One tap on any name opens its page. Save puts it in a small tray you can keep as a palette or export.
// Everything here is prefixed nmr; the naming is nameOf() only, so no word is special.

const NMR_TABS = [["ring", "Ring"], ["plane", "Perceptual"], ["field", "Names"], ["type", "Type"], ["eye", "Eyedrop"]];
const NMR_ICON = sv('<path d="M14.5 5.5l4 4M17 3l4 4-3 3-4-4zM13 8l-8 8v3h3l8-8"/>', 22, 1.8);   // a pipette
const NMR_CMAX = .34;   // the strongest chroma any sRGB color reaches in OKLCH is a little over .32
let NMR_LAST = { hex: null, tab: "ring" };

const nmrHsl = hex => {
  const [r, g, b] = rgb(hex).map(v => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  let h = 0; if (d) h = mx === r ? ((g - b) / d + (g < b ? 6 : 0)) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [Math.round(h * 60), Math.round((d ? d / (1 - Math.abs(2 * l - 1)) : 0) * 100), Math.round(l * 100)];
};
const nmrOk = hex => { const [L, a, b] = hexOk(hex); let h = Math.atan2(b, a) * 180 / Math.PI; if (h < 0) h += 360; return [L, Math.hypot(a, b), h]; };
// a point in OKLCH, pulled in toward grey until it fits on a screen
function nmrHexAt(L, C, hDeg) {
  const h = hDeg * Math.PI / 180; L = clamp(L, 0, 1); C = Math.max(0, C);
  let guard = 0; while (C > 0 && !okIn(L, C, h) && guard++ < 60) C *= .96;
  return okHex(L, C, h);
}
const nmrMaxC = (L, hDeg) => { let lo = 0, hi = NMR_CMAX; const h = hDeg * Math.PI / 180; for (let i = 0; i < 12; i++) { const m = (lo + hi) / 2; if (okIn(L, m, h)) lo = m; else hi = m; } return lo; };
const nmrTray = () => (S.namerTray = Array.isArray(S.namerTray) ? S.namerTray : []);
const nmrPaste = t => {   // "#abc", "#aabbcc", "rgb(12, 99, 180)", "12 99 180"
  t = String(t || "").trim();
  let m = t.match(/^#?([0-9a-f]{3})$/i); if (m) return "#" + m[1].split("").map(c => c + c).join("").toUpperCase();
  m = t.match(/^#?([0-9a-f]{6})$/i); if (m) return "#" + m[1].toUpperCase();
  m = t.match(/^(?:rgb\()?\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})\s*\)?$/i);
  if (m && [1, 2, 3].every(i => +m[i] <= 255)) return "#" + [1, 2, 3].map(i => (+m[i]).toString(16).padStart(2, "0")).join("").toUpperCase();
  return null;
};

LAB.namer = (hex, push = true) => {
  hex = (hex && /^#[0-9a-f]{6}$/i.test(hex) ? hex : NMR_LAST.hex || "#5F8C8A").toUpperCase();
  if (push && XSTACK[XSTACK.length - 1] !== "namer") XSTACK.push("namer");
  let cur = hex, tab = NMR_LAST.tab, raf = 0, urlT = 0, stream = null;
  // One screen, no scrolling for the thing the page is for (David, 2026-10-08: "doesn't fit on the screen"): a
  // 100dvh stage holds the name (on its own color), the four next names as a swipeable row, the actions, the
  // tabs and the picker, which takes whatever height is left. Every band above the picker has a fixed height,
  // so the picker never resizes under the finger. The tray and the fine print sit below the fold.
  const el = show(`
    <div class="nmr-stage">
      <div class="nmr-top" id="top">
        <header class="art-top"><button class="icon-btn glass" data-back aria-label="Back">${ICON.back}</button><span class="eyebrow">Studio · Name any color</span><span style="width:44px"></span></header>
        <button class="nmr-hero" id="hero" aria-label="Open this color's page"><span class="nmr-name" id="name"></span><span class="nmr-sub" id="sub"></span></button>
      </div>
      <div class="nmr-near" id="near"></div>
      <div class="nmr-acts" id="acts"></div>
      <div class="nmr-tabs" role="tablist" id="tabs">${NMR_TABS.map(([k, t]) => `<button role="tab" data-tab="${k}" aria-selected="${k === tab}" class="${k === tab ? "on" : ""}">${t}</button>`).join("")}</div>
      <div class="nmr-pane" id="pane"></div>
    </div>
    <div class="nmr-below">
      <div class="nmr-tray" id="tray"></div>
      <p class="fine">Names are the nearest of about 1,000, measured with CIEDE2000, and the match is how close your color is to the name's. The perceptual picker is OKLCH (Björn Ottosson, 2020). Screens, cameras and light shift colors, so a camera reading is a good guess, not a measurement.</p>
    </div>
  `, "article lab namer");
  const $ = s => el.querySelector(s);
  // one step Back, like every Studio screen: pop this screen's place in the shared trail (the phone's Back gesture presses this button)
  el.querySelector("[data-back]").onclick = () => { stopCam(); xBack(); };
  loadCoreNames().then(() => { if (!el.isConnected) return; render(); if (tab === "field") openTab("field", true); });
  const stopCam = () => { if (stream) stream.getTracks().forEach(t => t.stop()); stream = null; };
  cleanup.push(stopCam, () => { NMR_LAST.hex = cur; clearTimeout(urlT); cancelAnimationFrame(raf); });

  // ---------- the live readout: one pass per frame, however fast the finger moves ----------
  let paneApi = null;
  const setColor = (h, from) => {
    cur = h.toUpperCase();
    if (!raf) raf = requestAnimationFrame(() => { raf = 0; render(from); });
  };
  function render() {
    const nm = nameOf(cur, { n: 6 }), taught = BYNAME.get(nm.n.toLowerCase());
    const hero = $("#hero"), top = $("#top"); top.style.setProperty("--c", cur); top.dataset.ink = ink(cur); hero.dataset.swatch = cur;
    nmrFit($("#name"), nm.text);
    $("#sub").innerHTML = nm.between ? `Between two names <span class="mono">${cur}</span>` : `${pctMatch(nm.de)} <span class="mono">${cur}</span>`;
    const list = nm.between ? nm.near.slice(0, 4) : nm.near.slice(1, 5);
    $("#near").innerHTML = list.map(x => { const d = lookDiff({ h: x.h }, { h: cur });
      return `<button class="nmr-row" data-swatch="${x.h}"><i style="--c:${x.h}"></i><span><b>${esc(x.n)}</b><em>${d === "almost the same" ? "Almost identical" : "Yours is " + esc(d)}</em></span><span class="mono">${pctMatch(x.de).replace(" match", "")}</span></button>`; }).join("");
    const saved = nmrTray().includes(cur);
    $("#acts").innerHTML = `<button data-save>${saved ? "Saved" : "Save"}</button>`
      + (typeof galleryOpenColor === "function" ? `<button data-pt>Paintings</button>` : "")
      + (taught && nm.de < VERY_CLOSE_DE && typeof hmLearnIt === "function" ? `<button data-learn>Learn it</button>` : "")
      + (typeof hmHome === "function" ? `<button data-map>On the map</button>` : "");
    $("#acts [data-save]").onclick = () => { const t = nmrTray(); if (t.includes(cur)) { S.namerTray = t.filter(x => x !== cur); } else { t.unshift(cur); S.namerTray = t.slice(0, 12); buzz(8); } save(); render(); drawTray(); };
    const pt = $("#acts [data-pt]"); if (pt) pt.onclick = () => galleryOpenColor(cur, nm.text);
    const lr = $("#acts [data-learn]"); if (lr) lr.onclick = () => typeof prQuick === "function" ? prQuick({ seed: { n: taught.n, h: taught.h } }) : hmLearnIt(taught);   // the one Learn door (js/learnset.js)
    const mp = $("#acts [data-map]"); if (mp) mp.onclick = () => nmrOnMap(nm.n);
    if (paneApi && paneApi.render) paneApi.render();
    // the address follows the color, so a copied link reopens this exact pick (Back is untouched)
    clearTimeout(urlT); urlT = setTimeout(() => { try { history.replaceState(history.state, "", "#/studio/namer?c=" + cur.slice(1)); } catch (e) {} }, 500);
  }

  // ---------- tray ----------
  function drawTray() {
    const t = nmrTray();
    $("#tray").innerHTML = t.length ? `<div class="sec-head"><b>Your colors</b><span>${t.length}</span></div>
      <div class="nmr-chips">${t.map(h => `<button data-swatch="${h}" style="--c:${h}" aria-label="${esc(nameOf(h).text)}"></button>`).join("")}</div>
      <div class="nmr-trayacts"><button data-keep>Keep as a palette</button><button data-ex>Export</button><button data-clear>Clear</button></div>` : "";
    const k = $("#tray [data-keep]"); if (k) k.onclick = () => keepPalette(nmrTray().slice(), "Name any color");
    const x = $("#tray [data-ex]"); if (x) x.onclick = () => exOpenSheet({ cols: nmrTray().map(h => ({ h })), title: "My colors" });
    const c = $("#tray [data-clear]"); if (c) c.onclick = () => { S.namerTray = []; save(); drawTray(); render(); };
  }

  // ---------- the five pickers ----------
  const panes = {
    ring() {
      // the Gamut wheel's own OKLab disc (js/studio.js: wheelCanvas / diskColor), so there is one wheel in the app.
      // The disc sets hue and strength; the Lightness slider moves the pick up and down the disc's colors.
      $("#pane").innerHTML = `<div class="nmr-disc" id="disc"><div class="nmr-disc-in" id="discIn"><i class="nmr-knob" id="dk"></i></div></div>
        <label class="nmr-slide"><span>Lightness</span><input type="range" id="dl" min="4" max="97" step="1" aria-label="Lightness"></label>`;
      const host = $("#disc"), inner = $("#discIn"), knob = $("#dk"), sl = $("#dl");
      let [L0, C0, h0] = nmrOk(cur), size = 0, kx = 0, ky = 0;
      const cuspC = hDeg => { const cs = cusps(), f = (((hDeg % 360) + 360) % 360) / 2, i = Math.floor(f), t = f - i; return cs[i % 180][1] + (cs[(i + 1) % 180][1] - cs[i % 180][1]) * t; };
      const sync = (L, C, hh) => { const r = clamp(C / Math.max(.02, cuspC(hh)), 0, 1); kx = r * Math.cos(hh * Math.PI / 180); ky = r * Math.sin(hh * Math.PI / 180); sl.value = Math.round(L * 100); place(); };
      const place = () => { knob.style.left = (kx + 1) / 2 * 100 + "%"; knob.style.top = (1 - ky) / 2 * 100 + "%"; knob.style.background = cur; };
      const build = () => {
        const w = Math.floor(Math.min(host.clientWidth, host.clientHeight, 400)); if (w < 60 || w === size) return;
        size = w; inner.style.width = inner.style.height = w + "px";
        inner.querySelector("canvas")?.remove(); const cv = wheelCanvas(w); cv.className = "nmr-disc-cv"; inner.prepend(cv);
      };
      const apply = () => {   // the pick = the disc's hue and strength at the knob, at the slider's lightness
        const [, Cb, hb] = nmrOk(diskColor(kx, ky));
        const hex = nmrHexAt(+sl.value / 100, Cb, hb); cur = hex.toUpperCase(); place(); setColor(hex, "ring");
      };
      const mv = e => { const r = inner.getBoundingClientRect(); let x = ((e.clientX - r.left) / r.width) * 2 - 1, y = 1 - ((e.clientY - r.top) / r.height) * 2; const m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m; } kx = x; ky = y; apply(); };
      inner.addEventListener("pointerdown", e => { inner.setPointerCapture(e.pointerId); mv(e); inner.onpointermove = mv; inner.onpointerup = inner.onpointercancel = () => { inner.onpointermove = null; buzz(4); }; });
      sl.oninput = apply;
      requestAnimationFrame(() => { if (!host.isConnected) return; build(); sync(L0, C0, h0); });
      return { render() {}, set: h => { [L0, C0, h0] = nmrOk(h); sync(L0, C0, h0); } };
    },
    plane() {
      $("#pane").innerHTML = `<div class="nmr-plane"><canvas id="pl" aria-label="Lightness and chroma"></canvas><i class="nmr-knob" id="plk"></i></div>
        <div class="nmr-hue" id="hue"><i class="nmr-hknob" id="hk"></i></div>
        <p class="nmr-read" id="plr"></p>`;
      const cv = $("#pl"), ctx = cv.getContext("2d"), W = 150, H = 110;
      cv.width = W; cv.height = H;
      let [L, C, hh] = nmrOk(cur), drawnH = -1;
      const drawPlane = () => {
        const img = ctx.createImageData(W, H), h = hh * Math.PI / 180;
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          const l = 1 - (y + .5) / H, c = (x + .5) / W * NMR_CMAX, p = (y * W + x) * 4;
          const lin = oklabToLin(l, c * Math.cos(h), c * Math.sin(h));
          if (lin.every(v => v >= -1e-4 && v <= 1.0001)) { img.data[p] = enc8(lin[0]); img.data[p + 1] = enc8(lin[1]); img.data[p + 2] = enc8(lin[2]); img.data[p + 3] = 255; }
        }
        ctx.putImageData(img, 0, 0); drawnH = Math.round(hh);
      };
      $("#hue").style.background = `linear-gradient(90deg,${Array.from({ length: 13 }, (_, i) => nmrHexAt(.72, .13, i * 30)).join(",")})`;
      const place = () => {
        $("#plk").style.left = clamp(C / NMR_CMAX, 0, 1) * 100 + "%"; $("#plk").style.top = (1 - L) * 100 + "%"; $("#plk").style.background = cur;
        $("#hk").style.left = hh / 360 * 100 + "%"; $("#hk").style.background = nmrHexAt(.72, .13, hh);
        $("#plr").innerHTML = `Lightness <b class="mono">${Math.round(L * 100)}</b> · chroma <b class="mono">${(C * 100).toFixed(0)}</b> · hue <b class="mono">${Math.round(hh)}°</b>`;
      };
      const apply = () => { if (Math.round(hh) !== drawnH) drawPlane(); const hex = nmrHexAt(L, C, hh); cur = hex.toUpperCase(); place(); setColor(hex, "plane"); };
      const drag = (node, fn) => node.addEventListener("pointerdown", e => {
        node.setPointerCapture(e.pointerId); fn(e);
        node.onpointermove = fn; node.onpointerup = node.onpointercancel = () => { node.onpointermove = null; buzz(4); };
      });
      drag($(".nmr-plane"), e => { const r = $(".nmr-plane").getBoundingClientRect(); L = 1 - clamp((e.clientY - r.top) / r.height, 0, 1); C = clamp((e.clientX - r.left) / r.width, 0, 1) * NMR_CMAX; const m = nmrMaxC(L, hh); if (C > m) C = m; apply(); });
      drag($("#hue"), e => { const r = $("#hue").getBoundingClientRect(); hh = clamp((e.clientX - r.left) / r.width, 0, 1) * 360; const m = nmrMaxC(L, hh); if (C > m) C = m; apply(); });
      drawPlane(); place();
      return { render() {}, set: h => { [L, C, hh] = nmrOk(h); if (Math.round(hh) !== drawnH) drawPlane(); place(); } };
    },
    field() {
      $("#pane").innerHTML = `<div class="nmr-field"><canvas id="fd"></canvas><i class="nmr-knob" id="fk"></i></div>
        <label class="nmr-slide"><span>Vividness</span><input type="range" id="fc" min="0" max="${NMR_CMAX * 1000 | 0}" step="1" aria-label="Vividness"></label>
        <p class="nmr-read" id="fr">Drag across: the pick settles onto a name as you pass. Dots are names at this vividness.</p>`;
      const cv = $("#fd"), W = 180, H = 120; cv.width = W; cv.height = H;
      const names = (CORE_NAMES || coreFallback()).map(e => ({ n: e.n, h: e.h, lab: e.lab || lab(e.h), ok: nmrOk(e.h) }));
      let [L0, C0, h0] = nmrOk(cur), sliceC = clamp(C0, .02, .26), fx = h0 / 360, fy = 1 - L0, lastName = "";
      $("#fc").value = Math.round(sliceC * 1000);
      const draw = () => {
        const ctx = cv.getContext("2d"), img = ctx.createImageData(W, H);
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          const l = .02 + (1 - (y + .5) / H) * .96, hx = (x + .5) / W * 360, hex = nmrHexAt(l, sliceC, hx), p = (y * W + x) * 4;
          const c = rgb(hex); img.data[p] = c[0]; img.data[p + 1] = c[1]; img.data[p + 2] = c[2]; img.data[p + 3] = 255;
        }
        ctx.putImageData(img, 0, 0);
        names.forEach(n => { if (Math.abs(n.ok[1] - sliceC) > .02) return; const x = n.ok[2] / 360 * W, y = (1 - (n.ok[0] - .02) / .96) * H; ctx.fillStyle = "rgba(255,255,255,.9)"; ctx.strokeStyle = "rgba(0,0,0,.55)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, 1.9, 0, 7); ctx.fill(); ctx.stroke(); });
      };
      const at = () => {
        const cand = nmrHexAt(.02 + (1 - fy) * .96, sliceC, fx * 360), cl = lab(cand);
        let best = null, bd = 1e9; for (const n of names) { const d = Math.hypot(n.lab[0] - cl[0], n.lab[1] - cl[1], n.lab[2] - cl[2]); if (d < bd) { bd = d; best = n; } }
        const pull = best ? 1 - clamp((bd - 2.5) / 7, 0, 1) : 0, k = pull * pull * (3 - 2 * pull) * .92;
        const out = best && k > 0 ? labHex(...cl.map((v, i) => v + (best.lab[i] - v) * k)) : cand;
        if (best && pull > .5 && best.n !== lastName) { lastName = best.n; buzz(3); } else if (!best || pull < .2) lastName = "";
        return out;
      };
      const place = () => { $("#fk").style.left = fx * 100 + "%"; $("#fk").style.top = fy * 100 + "%"; $("#fk").style.background = cur; };
      const mv = e => { const r = cv.getBoundingClientRect(); fx = clamp((e.clientX - r.left) / r.width, 0, 1); fy = clamp((e.clientY - r.top) / r.height, 0, 1); const h = at(); setColor(h, "field"); cur = h; place(); };
      cv.addEventListener("pointerdown", e => { cv.setPointerCapture(e.pointerId); mv(e); cv.onpointermove = mv; cv.onpointerup = cv.onpointercancel = () => { cv.onpointermove = null; buzz(4); }; });
      let fr = 0;
      $("#fc").oninput = e => { sliceC = e.target.value / 1000; if (!fr) fr = requestAnimationFrame(() => { fr = 0; draw(); }); };
      draw(); place();
      return { render: place, set: h => { const [l, c, hd] = nmrOk(h); fx = hd / 360; fy = 1 - (l - .02) / .96; sliceC = clamp(c, .02, .26); $("#fc").value = Math.round(sliceC * 1000); draw(); place(); } };
    },
    type() {
      $("#pane").innerHTML = `<div class="nmr-type"><label class="nmr-hexin"><span>Hex</span><input id="hx" maxlength="30" spellcheck="false" autocomplete="off" autocapitalize="off" inputmode="text" aria-label="Hex or RGB"></label>
        <div class="nmr-rgbs">${["R", "G", "B"].map((c, i) => `<label><span>${c}</span><input data-ch="${i}" type="number" min="0" max="255" inputmode="numeric" aria-label="${c}"></label>`).join("")}</div>
        <p class="nmr-read" id="tr">Type a hex like #3A7CA5, or paste rgb(58, 124, 165).</p></div>
        <div class="nmr-codes" id="codes"></div>`;
      const hx = $("#hx"), chs = el.querySelectorAll("[data-ch]");
      const fill = () => {
        if (document.activeElement !== hx) hx.value = cur;
        const c = rgb(cur); chs.forEach((i, k) => { if (document.activeElement !== i) i.value = c[k]; });
        const [h, s, l] = nmrHsl(cur), [L, a, b] = lab(cur);
        const rows = [["Hex", cur], ["RGB", `rgb(${c.join(" ")})`], ["HSL", `hsl(${h} ${s}% ${l}%)`], ["OKLCH", exFmtOk(cur)], ["Lab", `lab(${L.toFixed(1)} ${a.toFixed(1)} ${b.toFixed(1)})`]];
        $("#codes").innerHTML = rows.map(([k, v]) => `<button data-code="${esc(v)}"><span>${k}</span><b class="mono">${esc(v)}</b></button>`).join("");
      };
      $("#codes").onclick = e => { const b = e.target.closest("[data-code]"); if (b) { exCopy(b.dataset.code, "Copied " + b.dataset.code); buzz(5); } };
      hx.oninput = () => { const v = nmrPaste(hx.value); $("#tr").textContent = v || !hx.value ? "Type a hex like #3A7CA5, or paste rgb(58, 124, 165)." : "Keep typing: six hex digits, or three numbers."; if (v) setColor(v, "type"); };
      chs.forEach((i, k) => i.oninput = () => { const c = rgb(cur); c[k] = clamp(Math.round(+i.value || 0), 0, 255); setColor("#" + c.map(x => x.toString(16).padStart(2, "0")).join(""), "type"); });
      fill();
      return { render: fill, set: fill };
    },
    eye() {
      $("#pane").innerHTML = `<div class="nmr-eye" id="eyeBox"><p class="nmr-read" id="er">Pick a spot in a photo, or point the camera, and the patch under your finger is named.</p>
        <div class="nmr-eyebtns"><label class="nmr-pill">Choose a photo<input type="file" accept="image/*" hidden id="ef"></label><button class="nmr-pill" id="ec">Use the camera</button></div>
        <div class="nmr-shot" id="shot" hidden><canvas id="ecv"></canvas><video id="evid" playsinline muted hidden></video><i class="nmr-ret" id="ret"></i></div>
        <button class="nmr-snap" id="snap" hidden>Freeze this frame</button></div>`;
      const cv = $("#ecv"), vid = $("#evid"), box = $("#shot"), ret = $("#ret");
      let live = false, pos = [.5, .5];
      const mark = () => { ret.style.left = pos[0] * 100 + "%"; ret.style.top = pos[1] * 100 + "%"; };
      const pick = () => { if (cv.width) setColor(isoSample(cv, pos[0], pos[1], { frac: .03 }), "eye"); };
      const showImg = src => {
        const w = src.naturalWidth || src.videoWidth, h = src.naturalHeight || src.videoHeight, k = Math.min(1, 900 / Math.max(w, h));
        cv.width = Math.round(w * k); cv.height = Math.round(h * k); cv.getContext("2d").drawImage(src, 0, 0, cv.width, cv.height);
        cv.hidden = false; vid.hidden = true; live = false; stopCam(); box.hidden = false; $("#snap").hidden = true; $("#er").textContent = "Tap or drag across the picture."; mark(); pick();
      };
      $("#ef").onchange = e => { const f = e.target.files[0]; if (!f) return; const img = new Image(); img.onload = () => { showImg(img); URL.revokeObjectURL(img.src); }; img.onerror = () => toast("Couldn't open that image"); img.src = URL.createObjectURL(f); };
      $("#ec").onclick = async () => {
        try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 1280 } }, audio: false }); }
        catch (e) { toast("The camera isn't available here"); return; }
        vid.srcObject = stream; vid.hidden = false; cv.hidden = true; box.hidden = false; live = true; pos = [.5, .5]; mark(); $("#snap").hidden = false; $("#er").textContent = "Aim the circle, then freeze the frame.";
        try { await vid.play(); } catch (e) {}
        const tick = () => { if (!live || !el.isConnected) return; if (vid.videoWidth) setColor(isoSample(vid, .5, .5, { frac: .03 }), "eye"); setTimeout(() => requestAnimationFrame(tick), 140); };
        tick();
      };
      $("#snap").onclick = () => { if (vid.videoWidth) showImg(vid); };
      const mv = e => { if (live) return; const r = cv.getBoundingClientRect(); pos = [clamp((e.clientX - r.left) / r.width, 0, 1), clamp((e.clientY - r.top) / r.height, 0, 1)]; mark(); pick(); };
      box.addEventListener("pointerdown", e => { if (live) return; box.setPointerCapture(e.pointerId); mv(e); box.onpointermove = mv; box.onpointerup = box.onpointercancel = () => { box.onpointermove = null; buzz(4); }; });
      return { render() {}, set() {} };
    },
  };
  function openTab(k, quiet) {
    stopCam();
    tab = NMR_LAST.tab = k;
    el.querySelectorAll("#tabs button").forEach(b => { const on = b.dataset.tab === k; b.classList.toggle("on", on); b.setAttribute("aria-selected", on); });
    paneApi = panes[k]();
    if (!quiet) buzz(4);
  }
  $("#tabs").onclick = e => { const b = e.target.closest("[data-tab]"); if (b && b.dataset.tab !== tab) openTab(b.dataset.tab); };
  openTab(tab, true); drawTray(); render();
};

// the name on one line: shrink the type for a long name instead of wrapping, so the band never changes height
function nmrFit(node, text) {
  node.textContent = text; node.style.fontSize = "";
  const w = node.clientWidth, sw = node.scrollWidth;
  if (w && sw > w) node.style.fontSize = Math.max(20, parseFloat(getComputedStyle(node).fontSize) * w / sw - .5) + "px";
}

// "On the map": open the honeycomb with this name typed into its search, so the name's neighbors light up
function nmrOnMap(name) {
  if (typeof hmHome !== "function") return;
  hmHome();
  setTimeout(() => {
    const box = document.getElementById("hmSearch"), inp = document.getElementById("hmq");
    if (!box || !inp) return;
    box.hidden = false; inp.value = name; inp.dispatchEvent(new Event("input", { bubbles: true }));
  }, 700);
}
