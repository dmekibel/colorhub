"use strict";
// The color eye: point the camera at anything and it names the color in the middle of the frame, live,
// from the 2,700-name library, with the nearest word the app teaches underneath. Freeze to tap any spot,
// keep a find, or turn the whole frame into a palette. Cameras shift color, so the copy calls it a guess.

function eye() {
  const el = show(`
    <div class="eye-stage" id="stage">
      <video id="vid" playsinline muted autoplay></video>
      <canvas id="still" hidden></canvas>
      <i class="eye-ret" id="ret"></i>
    </div>
    <header class="eye-top"><button class="icon-btn glass" data-back aria-label="Back">${ICON.back}</button><span class="eye-hint" id="hint">Point at anything</span><span style="width:44px"></span></header>
    <div class="eye-card" id="card">
      <button class="eye-name" id="nm"><i id="chip"></i><span><b id="big">Looking…</b><em id="src"></em></span></button>
      <button class="eye-mine" id="mine"></button>
      <div class="eye-bar">
        <label class="eye-side" aria-label="Choose a photo">${ICON_PHOTO}<input type="file" accept="image/*" id="file" hidden></label>
        <button class="eye-shut" id="shut" aria-label="Freeze"><i></i></button>
        <button class="eye-side" id="pal" aria-label="Palette from this frame">${ICON_PAL}</button>
      </div>
    </div>
    <div class="eye-off" id="off" hidden>
      <p class="eyebrow">No camera here</p>
      <h2>Name the colors in a <em>photo</em> instead.</h2>
      <label class="btn">Choose a photo<input type="file" accept="image/*" id="file2" hidden></label>
    </div>
  `, "fixed eye");
  const $ = s => el.querySelector(s);
  const vid = $("#vid"), still = $("#still"), ret = $("#ret"), stage = $("#stage");
  const probe = document.createElement("canvas"), pctx = probe.getContext("2d", { willReadFrequently: true });
  let stream = null, frozen = false, raf = 0, cur = null, smooth = null, last = 0, at = [.5, .5];
  const stop = () => { cancelAnimationFrame(raf); if (stream) stream.getTracks().forEach(t => t.stop()); stream = null; };
  cleanup.push(stop);
  $("[data-back]").onclick = () => { stop(); go(S.tab || "explore"); };
  loadLongNames();

  // average a small patch (in linear light, so it matches what the eye blends) at a point of the source
  const sample = (src, w, h, fx, fy) => {
    const side = Math.max(6, Math.min(w, h) * .05), sx = clamp(fx * w - side / 2, 0, w - side), sy = clamp(fy * h - side / 2, 0, h - side);
    probe.width = probe.height = 12;
    pctx.drawImage(src, sx, sy, side, side, 0, 0, 12, 12);
    const d = pctx.getImageData(0, 0, 12, 12).data, lin = v => { v /= 255; return v > .04045 ? ((v + .055) / 1.055) ** 2.4 : v / 12.92; };
    let r = 0, g = 0, b = 0;
    for (let p = 0; p < d.length; p += 4) { r += lin(d[p]); g += lin(d[p + 1]); b += lin(d[p + 2]); }
    const n = d.length / 4, enc = v => { v /= n; v = v > .0031308 ? 1.055 * v ** (1 / 2.4) - .055 : 12.92 * v; return Math.round(clamp(v, 0, 1) * 255).toString(16).padStart(2, "0"); };
    return ("#" + enc(r) + enc(g) + enc(b)).toUpperCase();
  };
  const paint = hex => {
    if (!hex) return;
    const { mine, long } = nameColor(hex, 1), best = long[0] && (!mine[0] || long[0].d <= mine[0].d + 1.5) ? long[0] : mine[0], m = mine[0];
    if (!best) return;
    cur = { hex, best, m };
    ret.style.setProperty("--c", hex); $("#chip").style.setProperty("--c", hex);
    $("#big").textContent = best.n;
    $("#src").textContent = best.mine ? `A lesson word · ${lessonStatus(best.n)}` : `${srcLine(best)}${best.d > 6 ? " · nearest name" : ""}`;
    // second line: the nearest of the colors the lessons teach (hidden when the big name already is one)
    $("#mine").innerHTML = m && !(best.mine && best.n === m.n) ? `<i style="--c:${m.h}"></i><span>Closest lesson word <b>${esc(m.n)}</b></span><em>${lessonStatus(m.n)}</em>` : "";
  };
  // live: sample about eight times a second and ease between readings so the name doesn't flicker
  const tick = t => {
    raf = requestAnimationFrame(tick);
    if (frozen || !vid.videoWidth || t - last < 120) return;
    last = t;
    const L = lab(sample(vid, vid.videoWidth, vid.videoHeight, .5, .5));
    smooth = smooth ? smooth.map((x, i) => x + (L[i] - x) * .45) : L;
    paint(labHex(...smooth));
  };
  const freeze = (src, w, h) => {
    frozen = true; el.classList.add("frozen");
    // draw what's on screen (cover-cropped) so a tap lands where it looks like it lands
    const R = stage.getBoundingClientRect(), k = Math.max(R.width / w, R.height / h), dpr = Math.min(devicePixelRatio || 1, 2);
    still.width = R.width * dpr; still.height = R.height * dpr; still.hidden = false;
    const c = still.getContext("2d"); c.drawImage(src, (R.width - w * k) / 2 * dpr, (R.height - h * k) / 2 * dpr, w * k * dpr, h * k * dpr);
    vid.style.visibility = "hidden";
    $("#hint").textContent = "Tap anywhere to name it";
    $("#shut").setAttribute("aria-label", "Back to live");
    at = [.5, .5]; placeRet(); paint(sample(still, still.width, still.height, .5, .5));
    buzz(10);
  };
  const live = () => {
    frozen = false; el.classList.remove("frozen"); still.hidden = true; vid.style.visibility = "";
    $("#hint").textContent = "Point at anything"; $("#shut").setAttribute("aria-label", "Freeze");
    at = [.5, .5]; placeRet();
  };
  const placeRet = () => { ret.style.left = at[0] * 100 + "%"; ret.style.top = at[1] * 100 + "%"; };
  stage.addEventListener("pointerdown", e => {
    if (!frozen) return;
    const R = stage.getBoundingClientRect(); at = [(e.clientX - R.left) / R.width, (e.clientY - R.top) / R.height];
    placeRet(); paint(sample(still, still.width, still.height, at[0], at[1])); buzz(5);
  });
  $("#shut").onclick = () => {
    if (frozen) return stream ? live() : null;
    if (vid.videoWidth) freeze(vid, vid.videoWidth, vid.videoHeight);
  };
  $("#nm").onclick = () => cur && eyeSheet(cur.hex);
  $("#mine").onclick = () => { if (cur && cur.m) { stop(); XSTACK = []; openNode(graph().nodes.get("c:" + cur.m.n)); } };
  const fromFile = f => {
    if (!f) return;
    const img = new Image();
    img.onload = () => { stop(); el.classList.remove("nocam"); $("#off").hidden = true; freeze(img, img.naturalWidth, img.naturalHeight); URL.revokeObjectURL(img.src); };
    img.src = URL.createObjectURL(f);
  };
  $("#file").onchange = e => fromFile(e.target.files[0]);
  $("#file2").onchange = e => fromFile(e.target.files[0]);
  $("#pal").onclick = () => {
    const src = frozen ? still : vid;
    if (!src.width && !src.videoWidth) return;
    const c = document.createElement("canvas"), w = frozen ? still.width : vid.videoWidth, h = frozen ? still.height : vid.videoHeight, k = Math.min(1, 900 / Math.max(w, h));
    c.width = w * k; c.height = h * k; c.getContext("2d").drawImage(src, 0, 0, c.width, c.height);
    stop(); studioFromImage(c, "From the camera");
  };

  (async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 1280 } }, audio: false });
    } catch (e) { el.classList.add("nocam"); $("#off").hidden = false; return; }
    // a refused play() (power saving, autoplay rules) is not a missing camera: the muted video starts on its own
    vid.srcObject = stream; vid.play().catch(() => {});
    raf = requestAnimationFrame(tick);
  })();
}

// tap the name: the closest names from every source, and the closest words the app teaches
function eyeSheet(hex) {
  const { mine, long } = nameColor(hex, 5);
  const row = x => `<${x.mine ? `button data-node="c:${esc(x.n)}"` : "div"} class="kin"><i style="--c:${x.h}"></i><b>${esc(x.n)}</b><span>${x.mine ? lessonStatus(x.n) : esc(srcLine(x))} · ${closeness(x.d)}</span></${x.mine ? "button" : "div"}>`;
  const { sh, close } = sheet(`
    <div class="eye-sw" style="--c:${hex}" data-ink="${ink(hex)}"><span class="mono">${hex}</span></div>
    <p class="eyebrow" style="margin:18px 0 6px">Precise names · from 2,700</p>${long.map(row).join("")}
    <p class="eyebrow" style="margin:18px 0 6px">Closest lesson words · the colors you learn here</p>${mine.slice(0, 3).map(row).join("")}
    <p class="fine">Phone cameras adjust white balance and exposure, so treat a camera reading as a good guess, not a measurement.</p>
    <button class="btn ghost" data-copy>Copy ${hex}</button>`);
  sh.querySelector("[data-copy]").onclick = () => { try { navigator.clipboard.writeText(hex); toast("Copied " + hex); } catch (e) {} };
  sh.querySelectorAll("[data-node]").forEach(b => b.onclick = () => { close(); XSTACK = []; openNode(graph().nodes.get(b.dataset.node)); });
}

const ICON_PHOTO = sv('<rect x="3" y="5" width="18" height="14" rx="2.5"/><circle cx="9" cy="10" r="1.8"/><path d="M21 16l-5.5-5.5L6 19"/>', 22, 1.8);
const ICON_PAL = sv('<rect x="3" y="6" width="4" height="12" rx="1"/><rect x="8.5" y="6" width="4" height="12" rx="1"/><rect x="14" y="6" width="7" height="12" rx="1"/>', 22, 1.8);

LAB.eye = () => eye();

// where a lesson color stands for you: known, being learned, or still ahead
function lessonStatus(name) {
  const c = BYNAME.get(name.toLowerCase()); if (!c) return "";
  if (c.basic) return "a basic word";
  const st = S.cards[c.id];
  return st ? (st.own ? "you know it" : "learning") : "not learned yet";
}
