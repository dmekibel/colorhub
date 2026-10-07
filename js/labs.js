"use strict";
// Story player (Instagram-style slides that lead into the wiki) and the Explore labs.

// ---------- shared visuals ----------
function stripSteps(from, to, n = 7) { const a = lab(from), b = lab(to); return Array.from({ length: n }, (_, i) => labHex(...a.map((x, j) => x + (b[j] - x) * i / (n - 1)))); }
const SCHEMES = { complementary: [180], analogous: [-30, 30], triadic: [120, 240], split: [150, 210], square: [90, 180, 270] };
const schemeColors = (base, scheme) => [base, ...SCHEMES[scheme].map(d => rotateHue(base, d))];
function wheelSVG(base, scheme, size = 260) {
  const cols = schemeColors(base, scheme), c = size / 2, r = size / 2 - 22;
  const pos = h => { const H = lch(h)[2] * Math.PI / 180; return [c + r * Math.cos(H), c - r * Math.sin(H)]; };
  const pts = cols.map(pos);
  return `<div class="wheel" style="width:${size}px;height:${size}px"><div class="wheel-ring"></div>
    <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true">
      <polygon points="${pts.map(p => p.join(",")).join(" ")}" fill="rgba(255,255,255,.06)" stroke="rgba(255,255,255,.5)" stroke-width="1.2"/>
      ${pts.map(([x, y], i) => `<line x1="${c}" y1="${c}" x2="${x}" y2="${y}" stroke="rgba(255,255,255,.18)"/><circle cx="${x}" cy="${y}" r="${i ? 13 : 17}" fill="${cols[i]}" stroke="#F3F3F1" stroke-width="${i ? 2 : 3}"/>`).join("")}
    </svg></div>`;
}
const ringStops = () => { const s = []; for (let t = 0; t <= 360; t += 10) s.push(`${lchHex(66, 46, (450 - t) % 360)} ${t}deg`); return `conic-gradient(${s.join(",")})`; };

function renderVisual(v) {
  const lbl = (h, l) => l ? `<span class="v-lbl" data-ink="${ink(h)}">${esc(l)}</span>` : "";
  switch (v.t) {
    case "swatch": return `<div class="v v-swatch" style="--c:${v.h}">${lbl(v.h, v.label)}</div>`;
    case "pair": return `<div class="v v-pair"><div style="--c:${v.a.h}">${lbl(v.a.h, v.a.label)}</div><div style="--c:${v.b.h}">${lbl(v.b.h, v.b.label)}</div></div>`;
    case "row": return `<div class="v v-row${v.items.length > 5 ? " many" : ""}">${v.items.map(x => `<div><i style="--c:${x.h}"></i>${x.label ? `<span>${esc(x.label)}</span>` : ""}</div>`).join("")}</div>`;
    case "strip": return `<div class="v v-strip">${stripSteps(v.from, v.to, v.steps || 7).map(h => `<i style="--c:${h}"></i>`).join("")}</div>`;
    case "contrast": return `<button class="v v-contrast" data-contrast><div class="g" style="--c:${v.grounds[0]}"><i style="--c:${v.inner}"></i></div><div class="g" style="--c:${v.grounds[1]}"><i style="--c:${v.inner}"></i></div><span class="v-hint">Tap to lift the grounds</span></button>`;
    case "wheel": return `<div class="v v-wheel">${wheelSVG(v.base, v.scheme, 240)}<span class="v-hint">${esc(v.scheme)}</span></div>`;
    case "quote": return `<div class="v v-quote"><blockquote>“${esc(v.q)}”</blockquote><cite>${esc(v.by)}</cite></div>`;
    case "type": return `<div class="v v-type"><b>${esc(v.word)}</b>${v.sub ? `<span>${esc(v.sub)}</span>` : ""}</div>`;
    case "big": return `<div class="v v-big"><b>${esc(v.n)}</b>${v.sub ? `<span>${esc(v.sub)}</span>` : ""}</div>`;
    case "quiz": return `<div class="v v-quiz"><p class="qz-q">${esc(v.q)}</p><div class="qz-opts">${v.options.map((o, i) => `<button data-qz="${i}">${o.h ? `<i style="--c:${o.h}"></i>` : ""}<span>${esc(o.label)}</span></button>`).join("")}</div><p class="qz-ex" hidden></p></div>`;
  }
  return `<div class="v"></div>`;
}
// make contrast + quiz visuals interactive inside any container
function wireVisuals(root) {
  root.querySelectorAll("[data-contrast]").forEach(b => b.onclick = e => { e.stopPropagation(); b.classList.toggle("lifted"); const h = b.querySelector(".v-hint"); if (h) h.textContent = b.classList.contains("lifted") ? "Same color. Tap to put the grounds back." : "Tap to lift the grounds"; });
}

// ======================================================================
// Story player
// ======================================================================
function storyPlayer(s) {
  const slides = s.slides, N = slides.length + 1;   // + the "go deeper" end card
  let i = 0, dir = 1;
  const el = show(`
    <header class="st-top"><div class="segs">${Array.from({ length: N }, () => `<i style="--c:var(--ink)"></i>`).join("")}</div><button class="icon-btn" data-close aria-label="Close">${ICON.x}</button></header>
    <div class="st-stage" id="st"></div>
  `, "fixed story");
  const stage = el.querySelector("#st"), segs = el.querySelectorAll(".segs i");
  const close = () => { XSTACK.length ? xBack() : go("explore"); };
  el.querySelector("[data-close]").onclick = close;
  const g = graph();
  function draw() {
    segs.forEach((sg, k) => sg.classList.toggle("on", k <= i));
    if (i >= slides.length) {
      const cols = (s.colors || []).map(c => g.resolve(c)).filter(Boolean), links = (s.links || []).map(l => g.resolve(l)).filter(Boolean);
      const more = g.stories.filter(x => x.shelf === s.shelf && x !== s), next = more[0] || g.stories.find(x => x !== s);
      stage.innerHTML = `<div class="st-end">
        <p class="eyebrow">${esc(s.title)}</p><h2>Go deeper</h2>
        ${links.length ? `<div class="chips-wrap">${links.map(n => `<button class="pchip" data-node="${esc(n.id)}">${nodeColor(n) ? `<i style="--c:${nodeColor(n)}"></i>` : ""}${esc(n.title)}<em>${esc(nodeLabel(n))}</em></button>`).join("")}</div>` : ""}
        ${cols.length ? `<p class="eyebrow" style="margin-top:18px">Colors in this story</p><div class="chips-wrap">${cols.map(n => `<button class="pchip" data-node="${esc(n.id)}"><i style="--c:${n.h}"></i>${esc(n.title)}</button>`).join("")}</div>` : ""}
        ${s.sources && s.sources.length ? `<p class="fine st-src">Sources: ${s.sources.map(esc).join(" · ")}</p>` : ""}
        <div class="stack">${next ? `<button class="btn" data-next-story="${esc(next.id)}">Next: ${esc(next.title)} ${ICON.arrow}</button>` : ""}<button class="btn ghost" data-close2>Done</button></div>
      </div>`;
      return;
    }
    const sl = slides[i];
    stage.innerHTML = `<div class="st-slide ${dir < 0 ? "back" : "fwd"}">${renderVisual(sl.v)}${sl.text ? `<p class="st-text">${linkText(sl.text)}</p>` : ""}</div>`;
    wireVisuals(stage);
    stage.querySelectorAll("[data-qz]").forEach(b => b.onclick = e => {
      e.stopPropagation();
      const v = sl.v, box = b.closest(".v-quiz");
      if (box.dataset.done) return; box.dataset.done = 1;
      const ok = +b.dataset.qz === v.answer;
      b.classList.add(ok ? "right" : "wrong");
      box.querySelector(`[data-qz="${v.answer}"]`).classList.add("right");
      const ex = box.querySelector(".qz-ex"); ex.hidden = false; ex.innerHTML = (ok ? "<b>Yes.</b> " : "<b>Not quite.</b> ") + linkText(v.explain);
      buzz(ok ? 10 : [10, 40, 10]);
    });
  }
  stage.addEventListener("click", e => {
    const node = e.target.closest("[data-node],[data-to]");
    if (node) { XSTACK = []; return openNode(g.nodes.get(node.dataset.node || node.dataset.to)); }
    const ns = e.target.closest("[data-next-story]"); if (ns) return storyPlayer(g.nodes.get(ns.dataset.nextStory));
    if (e.target.closest("[data-close2]")) return close();
    if (e.target.closest("button")) return;
    const x = e.clientX / innerWidth;
    if (x < .3) { if (i > 0) { i--; dir = -1; draw(); } } else if (i < slides.length) { i++; dir = 1; draw(); }
  });
  onKey = e => { if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); if (i < slides.length) { i++; draw(); } } if (e.key === "ArrowLeft" && i > 0) { i--; draw(); } if (e.key === "Escape") close(); };
  draw();
}

// ======================================================================
// Labs
// ======================================================================
const LAB = {};
const pickerRow = (sel) => `<div class="pick-row">${EVERY().slice().sort((a, b) => { const A = lch(a.h), B = lch(b.h); return (A[1] < 12) - (B[1] < 12) || ((A[2] + 330) % 360) - ((B[2] + 330) % 360); }).map(c => `<button data-pick="${c.h}" title="${esc(c.n)}" style="--c:${c.h}" class="${c.h === sel ? "on" : ""}"></button>`).join("")}</div>`;
const appName = hex => { const [x] = nearestColors(hex, 1); return x ? x : null; };

// Harmony: drag the base around the picker's ring and the harmony colors swing with it, live.
LAB.harmony = (base = lch(dailyColor().h)[1] > 30 ? dailyColor().h : "#C8553D", scheme = "triadic") => {
  const el = show(`
    <header class="art-top"><button class="icon-btn glass" data-back aria-label="Back">${ICON.back}</button><span class="eyebrow">Lab · Harmony</span><span style="width:44px"></span></header>
    <div class="poster" id="poster" aria-hidden="true"></div>
    <div class="schemes">${Object.keys(SCHEMES).map(k => `<button class="${k === scheme ? "on" : ""}" data-scheme="${k}">${k}</button>`).join("")}</div>
    <div class="h-list" id="hlist"></div>
    <p class="eyebrow" style="margin:26px 0 10px">Base color · drag the ring</p>
    <div id="pick"></div>
    <p class="p-body">${linkText("Why these work: [[complementary-colors|complements]] sit opposite on the [[color-wheel]] and make each other look stronger, the effect [[chevreul|Chevreul]] described for tapestry dyes. Analogous colors sit side by side and feel calm. Triads were a [[bauhaus|Bauhaus]] favorite.")}</p>
    <p class="fine">Harmonies rotate hue on the CIELAB wheel at the same lightness and strength. Names are the nearest of the app's ${EVERY().length}. Tap a color to copy it.</p>
  `, "article lab");
  el.querySelector("[data-back]").onclick = () => go("explore");
  wireLinks(el);
  const draw = hex => {
    base = hex;
    const cols = schemeColors(hex, scheme), [p0, p1, p2 = p1, p3 = p0] = cols, light = cols.slice().sort((a, b) => lab(b)[0] - lab(a)[0]);
    el.querySelector("#poster").innerHTML = `<svg viewBox="0 0 320 300"><rect width="320" height="300" fill="${light[0]}"/><rect x="0" y="196" width="320" height="104" fill="${p1}"/>
      <circle cx="204" cy="122" r="80" fill="${p0}"/><rect x="30" y="44" width="58" height="176" fill="${p2}"/><rect x="238" y="222" width="50" height="50" fill="${p3}"/><rect x="30" y="238" width="140" height="10" fill="${light[light.length - 1]}"/></svg>`;
    el.querySelector("#hlist").innerHTML = cols.map((h, i) => { const [c, d] = appName(h); return `<button class="h-item" data-copy="${h}"><i style="--c:${h}"></i><span><b>${i ? "" : "Base · "}≈ ${esc(c.n)}</b><em class="mono">${h} · ${closeness(d)}</em></span></button>`; }).join("");
  };
  const picker = colorPicker(el.querySelector("#pick"), { hex: base, onChange: draw, marks: hex => schemeColors(hex, scheme) });
  draw(base);
  el.querySelectorAll("[data-scheme]").forEach(b => b.onclick = () => { scheme = b.dataset.scheme; el.querySelectorAll("[data-scheme]").forEach(x => x.classList.toggle("on", x === b)); draw(base); picker.set(base); });
  el.querySelector("#hlist").addEventListener("click", e => { const b = e.target.closest("[data-copy]"); if (b) { try { navigator.clipboard.writeText(b.dataset.copy); toast("Copied " + b.dataset.copy); } catch (x) {} } });
};

// One color, two looks (Albers): the same inner color on two grounds, then lift the grounds.
const CONTRAST_PRESETS = [["#8E7F71", "#BFA2E8", "#CC7722"], ["#8C9096", "#FFD700", "#3D2B8E"], ["#C19A6B", "#36454F", "#F0E6D2"], ["#9CAF88", "#E34234", "#4682B4"], ["#A8778F", "#00A86B", "#FFCBA4"]];
LAB.contrast = (set = CONTRAST_PRESETS[0].slice(), slot = 0) => {
  const el = show(`
    <header class="art-top"><button class="icon-btn glass" data-back aria-label="Back">${ICON.back}</button><span class="eyebrow">Lab · Albers</span><span style="width:44px"></span></header>
    <button class="v v-contrast big" data-contrast id="ctr"><div class="g"><i></i></div><div class="g"><i></i></div><span class="v-hint">Tap to lift the grounds</span></button>
    <p class="p-body" id="ctxt"></p>
    <div class="schemes">${["Square", "Left ground", "Right ground"].map((t, i) => `<button class="${i === slot ? "on" : ""}" data-slot="${i}">${t}</button>`).join("")}</div>
    <div id="pick" style="margin-top:18px"></div>
    <p class="eyebrow" style="margin:22px 0 10px">Try a classic</p>
    <div class="presets">${CONTRAST_PRESETS.map((p, i) => `<button data-preset="${i}">${p.map(h => `<i style="--c:${h}"></i>`).join("")}</button>`).join("")}</div>
  `, "article lab");
  el.querySelector("[data-back]").onclick = () => go("explore");
  wireVisuals(el);
  const ctr = el.querySelector("#ctr"), txt = el.querySelector("#ctxt");
  const draw = () => {
    const [inner, g1, g2] = set, names = set.map(h => appName(h)[0].n);
    const gs = ctr.querySelectorAll(".g");
    gs[0].style.setProperty("--c", g1); gs[1].style.setProperty("--c", g2);
    ctr.querySelectorAll(".g i").forEach(i => i.style.setProperty("--c", inner));
    txt.innerHTML = linkText(`Both small squares are the same ≈ [[${names[0]}]]. Each ground pushes the square toward its own [[complementary-colors|opposite]]: on ≈ [[${names[1]}]] it drifts one way, on ≈ [[${names[2]}]] the other. [[josef-albers|Josef Albers]] built a whole course on this ([[interaction-of-color]]).`);
  };
  wireLinks(txt);
  const picker = colorPicker(el.querySelector("#pick"), { hex: set[slot], onChange: h => { set[slot] = h; draw(); } });
  draw();
  el.querySelectorAll("[data-slot]").forEach(b => b.onclick = () => { slot = +b.dataset.slot; el.querySelectorAll("[data-slot]").forEach(x => x.classList.toggle("on", x === b)); picker.set(set[slot]); });
  el.querySelectorAll("[data-preset]").forEach(b => b.onclick = () => { set = CONTRAST_PRESETS[+b.dataset.preset].slice(); picker.set(set[slot]); draw(); });
};

// Name any color: pick it, or point the camera and sample the middle of the frame.
LAB.namer = (hex = "#5F8C8A") => {
  const el = show(`
    <header class="art-top"><button class="icon-btn glass" data-back aria-label="Back">${ICON.back}</button><span class="eyebrow">Lab · Name it</span><span style="width:44px"></span></header>
    <div class="cam" id="cam" hidden><video id="vid" playsinline muted></video><i class="reticle"></i><button class="btn" data-snap>Use this color ${ICON.arrow}</button></div>
    <div id="pick"></div>
    <button class="btn ghost" data-camera>${ICON.search} Use the camera instead</button>
    <div id="nout"></div>
    <p class="fine">Cameras and light shift colors, so a camera reading is a hint, not a measurement.</p>
  `, "article lab");
  el.querySelector("[data-back]").onclick = () => go("explore");
  const out = el.querySelector("#nout");
  const render = h => {
    const { mine, long } = nameColor(h, 4);
    out.innerHTML = `<section class="facet"><h3>In the app's words</h3>${mine.map(x => `<button class="kin" data-node="c:${esc(x.n)}"><i style="--c:${x.h}"></i><b>${esc(x.n)}</b><span>${closeness(x.d)} · ΔE ${x.d.toFixed(1)}</span></button>`).join("")}</section>
      ${long.length ? `<section class="facet"><h3>Precise names</h3>${long.map(x => `<div class="kin"><i style="--c:${x.h}"></i><b>${esc(x.n)}</b><span>${closeness(x.d)} · ΔE ${x.d.toFixed(1)}</span></div>`).join("")}</section>` : ""}`;
  };
  wireLinks(out);
  const picker = colorPicker(el.querySelector("#pick"), { hex, onChange: render });
  loadLongNames().then(() => render(picker.get()));
  render(hex);
  let stream = null;
  const stop = () => { if (stream) stream.getTracks().forEach(t => t.stop()); stream = null; };
  cleanup.push(stop);
  el.querySelector("[data-camera]").onclick = async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      const v = el.querySelector("#vid"); v.srcObject = stream; await v.play();
      el.querySelector("#cam").hidden = false;
    } catch (e) { toast("The camera isn't available here"); }
  };
  el.querySelector("[data-snap]").onclick = () => {
    const v = el.querySelector("#vid"), c = document.createElement("canvas"), sz = 24;
    c.width = sz; c.height = sz;
    const ctx = c.getContext("2d"), side = Math.min(v.videoWidth, v.videoHeight) * .12;
    ctx.drawImage(v, (v.videoWidth - side) / 2, (v.videoHeight - side) / 2, side, side, 0, 0, sz, sz);
    const d = ctx.getImageData(0, 0, sz, sz).data; let r = 0, g = 0, b = 0;
    for (let p = 0; p < d.length; p += 4) { r += d[p]; g += d[p + 1]; b += d[p + 2]; }
    const n = d.length / 4, h = "#" + [r, g, b].map(x => Math.round(x / n).toString(16).padStart(2, "0")).join("").toUpperCase();
    stop(); el.querySelector("#cam").hidden = true; picker.set(h); render(h);
  };
};
