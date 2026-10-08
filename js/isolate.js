"use strict";
// The Isolator (design/IDEAS-10X/studio.md §6 B): tap any spot on any image, guess its name first, then the
// rest of the picture falls away to a neutral grey and the patch stands alone. One of the four options is always
// the name its surroundings suggest, the classic error: a shadow on a white wall reads "white" until you
// punch it out of the wall. Hold the picture to bring the surroundings back.
//
// One shared patch sampler lives here too. isoSample() averages a small square in LINEAR light (what the eye
// blends), and js/camera.js and js/namer.js call it, so every part of the app reads a spot the same way.
// Hooks: the photo page (paletteView in js/studio.js), the frozen camera (js/camera.js) and the museum painting
// hero (glPage in js/gallery.js), all through isoOpen().

// ---------- the sampler ----------
const isoDims = src => [src.videoWidth || src.naturalWidth || src.width, src.videoHeight || src.naturalHeight || src.height];
const isoEncode = v => Math.round(clamp(v > .0031308 ? 1.055 * v ** (1 / 2.4) - .055 : 12.92 * v, 0, 1) * 255).toString(16).padStart(2, "0");
let ISO_PROBE = null;
// the patch's centre, kept inside the picture exactly the way isoSample keeps its square inside it
function isoCenter(w, h, fx, fy, frac = .05) {
  const side = Math.max(6, Math.min(w, h) * frac);
  return { side, cx: clamp(fx * w, side / 2, w - side / 2), cy: clamp(fy * h, side / 2, h - side / 2) };
}
// src: a canvas, video or loaded image; (fx, fy): 0..1 across the picture; o.frac: the square's side as a share of the short edge
function isoSample(src, fx, fy, o = {}) {
  const [w, h] = isoDims(src), { side, cx, cy } = isoCenter(w, h, fx, fy, o.frac || .05);
  if (!ISO_PROBE) { const c = document.createElement("canvas"); c.width = c.height = 12; ISO_PROBE = c.getContext("2d", { willReadFrequently: true }); }
  ISO_PROBE.drawImage(src, cx - side / 2, cy - side / 2, side, side, 0, 0, 12, 12);
  const d = ISO_PROBE.getImageData(0, 0, 12, 12).data;
  let r = 0, g = 0, b = 0;
  for (let p = 0; p < d.length; p += 4) { r += lin8(d[p]); g += lin8(d[p + 1]); b += lin8(d[p + 2]); }
  const n = d.length / 4;
  return ("#" + isoEncode(r / n) + isoEncode(g / n) + isoEncode(b / n)).toUpperCase();
}
// the colour of what surrounds the patch: eight patches on a ring, averaged in linear light; null if the ring falls off the picture
function isoRing(src, fx, fy, mult, frac = .05) {
  const [w, h] = isoDims(src), { side, cx, cy } = isoCenter(w, h, fx, fy, frac), R = side * mult, hexes = [];
  for (let k = 0; k < 8; k++) {
    const a = k * Math.PI / 4, x = cx + R * Math.cos(a), y = cy + R * Math.sin(a);
    if (x < side / 2 || y < side / 2 || x > w - side / 2 || y > h - side / 2) continue;
    hexes.push(isoSample(src, x / w, y / h, { frac }));
  }
  if (hexes.length < 4) return null;
  const lin = hexes.map(hx => rgb(hx).map(lin8)), avg = [0, 1, 2].map(i => lin.reduce((s, c) => s + c[i], 0) / lin.length);
  return ("#" + avg.map(isoEncode).join("")).toUpperCase();
}

// ---------- the four options ----------
// truth + the surroundings' name (when it differs) + two same-family neighbours (4 to 15 ΔE from the patch,
// at least 3 ΔE from each other), shuffled.
function isoOptions(hex, ctxHex) {
  const nm = nameOf(hex, { n: 18 }), truth = nm.n;
  const out = [{ n: truth, h: nm.near[0] ? nm.near[0].h : hex, kind: "true" }];
  if (ctxHex) { const cn = nameOf(ctxHex); if (cn.n && cn.n !== truth) out.push({ n: cn.n, h: cn.h, kind: "ctx" }); }
  const taken = () => out.map(o => o.n), apart = x => out.every(o => de2000(x.h, o.h) >= 3);
  const pools = [nm.near.filter(x => x.de >= 4 && x.de <= 15), nm.near.filter(x => x.de >= 2.5 && x.de <= 24)];
  for (const pool of pools) for (const x of pool) { if (out.length >= 4) break; if (!taken().includes(x.n) && apart(x)) out.push({ n: x.n, h: x.h, kind: "near" }); }
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}

// ---------- the overlay ----------
// opts: { src, fx, fy, from: "photo" | "camera" | "painting", ref }
function isoOpen(opts) {
  const src = opts.src, [sw, sh] = isoDims(src);
  if (!sw || !sh) return toast("That picture isn't ready yet");
  const k = Math.min(1, 1000 / Math.max(sw, sh)), base = document.createElement("canvas");
  base.width = Math.max(1, Math.round(sw * k)); base.height = Math.max(1, Math.round(sh * k));
  const bx = base.getContext("2d", { willReadFrequently: true });
  try { bx.drawImage(src, 0, 0, base.width, base.height); bx.getImageData(0, 0, 1, 1); }
  catch (e) { return toast("This museum's picture can't be read here"); }
  const from = opts.from || "photo";
  let fx = opts.fx == null ? .5 : opts.fx, fy = opts.fy == null ? .5 : opts.fy, state = "guess", peeking = false, cur = null, FW = 0, FH = 0, D = 34, closed = false;
  const root = document.createElement("div");
  root.className = "iso"; root.setAttribute("role", "dialog"); root.setAttribute("aria-label", "Name a spot, then see it alone");
  root.innerHTML = `
    <div class="iso-top"><button class="icon-btn" data-iso-close aria-label="Close">${ICON.x}</button><span class="iso-hint" id="isoHint"></span><span style="width:44px"></span></div>
    <div class="iso-stage" id="isoStage"><div class="iso-frame" id="isoFrame">
      <canvas class="iso-img" id="isoImg"></canvas><div class="iso-veil" id="isoVeil"></div><i class="iso-ring" id="isoRing"></i>
    </div></div>
    <div class="iso-card" id="isoCard" aria-live="polite"></div>`;
  document.body.appendChild(root);
  lockScroll();
  const $ = s => root.querySelector(s), frame = $("#isoFrame"), img = $("#isoImg"), veil = $("#isoVeil"), ring = $("#isoRing"), stage = $("#isoStage"), card = $("#isoCard");
  img.width = base.width; img.height = base.height; img.getContext("2d").drawImage(base, 0, 0);
  const close = () => { if (closed) return; closed = true; removeEventListener("resize", fit); if (ro) ro.disconnect(); document.removeEventListener("keydown", onKey); root.remove(); unlockScroll(); };
  cleanup.push(close);
  const onKey = e => { if (e.key === "Escape") close(); };
  document.addEventListener("keydown", onKey);
  $("[data-iso-close]").onclick = close;

  // fit the picture inside the stage (contain), then place the ring and the veil's window on the patch
  function fit() {
    const W = stage.clientWidth, H = stage.clientHeight; if (!W || !H) return;
    const s = Math.min(W / base.width, H / base.height); FW = Math.round(base.width * s); FH = Math.round(base.height * s);
    frame.style.width = FW + "px"; frame.style.height = FH + "px";
    place();
  }
  const frac = () => Math.max(.06, 34 / (Math.min(FW, FH) || 340));   // the patch is at least 34 px across on screen
  function place() {
    const f = frac(), { side, cx, cy } = isoCenter(base.width, base.height, fx, fy, f);
    D = side / base.width * FW;
    const px = cx / base.width * FW, py = cy / base.height * FH;
    ring.style.left = px + "px"; ring.style.top = py + "px"; ring.style.width = ring.style.height = D + 16 + "px";
    const m = `radial-gradient(circle at ${px}px ${py}px, transparent ${D / 2}px, #000 ${D / 2 + .75}px)`;
    veil.style.webkitMaskImage = veil.style.maskImage = m;
  }
  const ro = typeof ResizeObserver === "function" ? new ResizeObserver(fit) : null;
  if (ro) ro.observe(stage); else addEventListener("resize", fit);

  // ---------- the guess ----------
  function ask() {
    state = "guess"; root.classList.remove("isolated"); veil.style.opacity = 0; ring.style.opacity = 1;
    $("#isoHint").textContent = opts.fx == null && !cur ? "Tap a spot" : "Tap another spot to move the ring";
    place();
    const f = frac(), hex = isoSample(base, fx, fy, { frac: f });
    let ctxHex = null; for (const m of [4.5, 3, 6]) { const c = isoRing(base, fx, fy, m, f); if (c && nameOf(c).n !== nameOf(hex).n) { ctxHex = c; break; } }
    cur = { hex, ctxHex, options: isoOptions(hex, ctxHex), f };
    card.innerHTML = `<h2 class="iso-q">What would you call it?</h2>
      <div class="iso-opts">${cur.options.map((o, i) => `<button data-opt="${i}">${esc(o.n)}</button>`).join("")}</div>
      <button class="iso-skip" data-skip>Skip the guess and open its page</button>`;
    card.querySelectorAll("[data-opt]").forEach(b => b.onclick = () => pick(+b.dataset.opt));
    card.querySelector("[data-skip]").onclick = () => openTappedColor(cur.hex);
  }
  function pick(i) {
    const o = cur.options[i], truth = cur.options.find(x => x.kind === "true"), nm = nameOf(cur.hex);
    state = "alone"; buzz(o.kind === "true" ? [8, 30, 8] : 14);
    // what the guess says about the eye (the Learner Model, js/learner.js): an answer for the true name, and,
    // when you named something else, a mix-up (S.iso also counts how often the surroundings fooled you)
    if (typeof learnerLog === "function") {
      const ok = o.kind === "true";
      learnerLog({ type: "answer", color: truth.n, ok, by: "pick", src: from });
      if (!ok) learnerLog({ type: "confuse", color: truth.n, b: o.n, src: from });
    }
    S.iso = S.iso || { n: 0, ok: 0, ctx: 0 }; S.iso.n++; if (o.kind === "true") S.iso.ok++; if (o.kind === "ctx") S.iso.ctx++; save();
    root.classList.add("isolated"); veil.style.opacity = 1; ring.style.opacity = 0;
    $("#isoHint").textContent = "Hold the picture to see it back";
    const line = o.kind === "true" ? "You read it as it is." : o.kind === "ctx" ? `You named its surroundings. Your eye pulled it toward ${esc(o.n.toLowerCase())}, the color around it.` : (() => { const d = lookDiff(o, { h: cur.hex }); return d === "almost the same" ? `${esc(o.n)} and this are almost the same color.` : `Not ${esc(o.n.toLowerCase())}: next to it, this one is ${esc(d)}.`; })();
    card.innerHTML = `<button class="iso-patch" data-swatch="${cur.hex}" style="--c:${cur.hex}" aria-label="Open ${esc(nm.text)}"></button>
      <div class="iso-res"><p class="iso-alone">Alone, it's</p><button class="iso-name" data-swatch="${cur.hex}">${esc(nm.text)}</button><p class="iso-line">${line}</p></div>
      <div class="iso-arch" id="isoArch"></div>
      <div class="iso-acts"><button data-again>Try another spot</button><button data-done>Done</button></div>`;
    card.querySelector("[data-again]").onclick = () => { opts.fx = fx; ask(); };
    card.querySelector("[data-done]").onclick = close;
    archive(cur.hex, nm);
  }
  // the painting in the archive where this color covers the most canvas
  function archive(hex, nm) {
    if (typeof loadGallery !== "function" || typeof glNear !== "function") return;
    loadGallery().then(() => {
      if (closed || state !== "alone" || cur.hex !== hex) return;
      const s = glNear(hex); let bi = -1, bs = 0; for (let i = 0; i < s.length; i++) if (s[i] > bs) { bs = s[i]; bi = i; }
      if (bi < 0 || bs < .06) return;
      return glDetail(bi).then(d => {
        const host = $("#isoArch"); if (!host || closed || state !== "alone" || cur.hex !== hex) return;
        host.innerHTML = `<button data-gi="${bi}"><img src="${esc(d.img)}" alt=""><span>The painting with the most of it<b>${esc(d.t)}</b><em>${Math.round(bs * 100)}% of the canvas is near ${esc(nm.n.toLowerCase())}</em></span></button>`;
        host.querySelector("[data-gi]").onclick = () => galleryPage(bi, true, hex);
      });
    }).catch(() => {});
  }

  // ---------- touch: tap moves the ring; hold shows the surroundings again ----------
  let holdT = 0, held = false;
  const peek = on => { if (state !== "alone" || peeking === on) return; peeking = on; veil.style.opacity = on ? 0 : 1; root.classList.toggle("peek", on); if (on) buzz(4); };
  frame.addEventListener("pointerdown", e => {
    frame.setPointerCapture(e.pointerId); held = false;
    if (state === "alone") holdT = setTimeout(() => { held = true; peek(true); }, 220);
  });
  const up = e => {
    clearTimeout(holdT);
    if (held) { peek(false); return; }
    if (e.type === "pointercancel") return;
    const r = frame.getBoundingClientRect(); fx = clamp((e.clientX - r.left) / r.width, 0, 1); fy = clamp((e.clientY - r.top) / r.height, 0, 1); opts.fx = fx;
    buzz(5); ask();
  };
  frame.addEventListener("pointerup", up); frame.addEventListener("pointercancel", up);
  fit(); ask();
  if (!ro) setTimeout(fit, 60);
  requestAnimationFrame(fit);
  return { close };
}
