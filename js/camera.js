"use strict";
// The color eye: point the camera at anything and it names the color in the middle of the frame, live,
// from the 2,700-name library, with the nearest word the app teaches underneath. Freeze to tap any spot,
// keep a find, or turn the whole frame into a palette. Cameras shift color, so the copy calls it a guess.
// Optional white balance: tap WB, then something white or grey; readings are then corrected by von Kries
// scaling (wbFrom in js/accuracy.js), so that reference comes out neutral.

function eye() {
  const el = show(`
    <div class="eye-stage" id="stage">
      <video id="vid" playsinline muted autoplay></video>
      <canvas id="still" hidden></canvas>
      <i class="eye-ret" id="ret"></i>
    </div>
    <header class="eye-top"><button class="icon-btn glass" data-back aria-label="Back">${ICON.back}</button><span class="eye-hint" id="hint">Point at anything</span><button class="icon-btn glass eye-wb" id="wb" aria-label="White balance: tap, then tap something white or grey" aria-pressed="false">WB</button></header>
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
  let stream = null, frozen = false, raf = 0, cur = null, smooth = null, last = 0, at = [.5, .5], wb = null, wbArm = false;
  const read = hex => wb ? wb(hex) : hex;
  const stop = () => { cancelAnimationFrame(raf); if (stream) stream.getTracks().forEach(t => t.stop()); stream = null; };
  cleanup.push(stop);
  $("[data-back]").onclick = () => { stop(); go(S.tab || "explore"); };
  loadCoreNames();

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
    const nm = nameOf(hex), [pair] = nearestColors(hex, 1), m = pair && pair[0];
    cur = { hex, nm, m };
    ret.style.setProperty("--c", hex); $("#chip").style.setProperty("--c", hex);
    $("#big").textContent = nm.text;
    $("#src").textContent = nm.met ? `A lesson word · ${lessonStatus(nm.n)}` : nm.de < VERY_CLOSE_DE ? "Nearest of about 1,000 names" : `Nearest of about 1,000 names · ${pctDiff(nm.de)}`;
    // second line: the nearest of the colors the lessons teach (hidden when the big name already is one)
    $("#mine").innerHTML = m && m.n.toLowerCase() !== nm.n.toLowerCase() ? `<i style="--c:${m.h}" data-swatch="${m.h}"></i><span>Nearest lesson word <b>${esc(m.n)}</b></span><em>${lessonStatus(m.n)}</em>` : "";
  };
  // live: sample about eight times a second and ease between readings so the name doesn't flicker
  const tick = t => {
    raf = requestAnimationFrame(tick);
    if (frozen || !vid.videoWidth || t - last < 120) return;
    last = t;
    const L = lab(read(sample(vid, vid.videoWidth, vid.videoHeight, .5, .5)));
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
    at = [.5, .5]; placeRet(); paint(read(sample(still, still.width, still.height, .5, .5)));
    buzz(10);
  };
  const live = () => {
    frozen = false; el.classList.remove("frozen"); still.hidden = true; vid.style.visibility = "";
    $("#hint").textContent = "Point at anything"; $("#shut").setAttribute("aria-label", "Freeze");
    at = [.5, .5]; placeRet();
  };
  const placeRet = () => { ret.style.left = at[0] * 100 + "%"; ret.style.top = at[1] * 100 + "%"; };
  // white balance: the next tap picks the reference (live: the middle circle; frozen: where you tap)
  const hintNow = () => $("#hint").textContent = wbArm ? (frozen ? "Tap something white or grey" : "Aim the circle at white or grey, tap") : frozen ? "Tap anywhere to name it" : "Point at anything";
  const wbBtn = $("#wb");
  const setWb = f => { wb = f; wbBtn.classList.toggle("on", !!f); wbBtn.setAttribute("aria-pressed", f ? "true" : "false"); smooth = null; };
  wbBtn.onclick = () => {
    if (wb) { setWb(null); wbArm = false; toast("White balance off"); }
    else { wbArm = !wbArm; wbBtn.classList.toggle("arm", wbArm); }
    hintNow();
  };
  stage.addEventListener("pointerdown", e => {
    if (wbArm) {
      const R = stage.getBoundingClientRect(), p = frozen ? [(e.clientX - R.left) / R.width, (e.clientY - R.top) / R.height] : [.5, .5];
      const ref = frozen ? sample(still, still.width, still.height, p[0], p[1]) : vid.videoWidth ? sample(vid, vid.videoWidth, vid.videoHeight, .5, .5) : null;
      const f = ref && wbFrom(ref);
      wbArm = false; wbBtn.classList.remove("arm");
      if (f) { setWb(f); toast("White set"); if (frozen) paint(read(sample(still, still.width, still.height, at[0], at[1]))); }
      else toast("Too dark or too colorful. Try white or grey");
      hintNow(); buzz(5); return;
    }
    if (!frozen) return;
    const R = stage.getBoundingClientRect(); at = [(e.clientX - R.left) / R.width, (e.clientY - R.top) / R.height];
    placeRet(); paint(read(sample(still, still.width, still.height, at[0], at[1]))); buzz(5);
  });
  $("#shut").onclick = () => {
    if (frozen) return stream ? live() : null;
    if (vid.videoWidth) freeze(vid, vid.videoWidth, vid.videoHeight);
  };
  $("#nm").onclick = () => cur && openTappedColor(cur.hex);   // David, 2026-10-07: one tap opens the page, not the sheet
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
    stop(); phCaptureAndOpen(c, "From the camera");
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

const ICON_PHOTO = sv('<rect x="3" y="5" width="18" height="14" rx="2.5"/><circle cx="9" cy="10" r="1.8"/><path d="M21 16l-5.5-5.5L6 19"/>', 22, 1.8);
const ICON_PAL = sv('<rect x="3" y="6" width="4" height="12" rx="1"/><rect x="8.5" y="6" width="4" height="12" rx="1"/><rect x="14" y="6" width="7" height="12" rx="1"/>', 22, 1.8);

LAB.eye = () => eye();

// where a lesson color stands for you: known, being learned, or still ahead
function lessonStatus(name) {
  const c = BYNAME.get(name.toLowerCase()); if (!c) return "";
  if (c.basic) return "a basic word";
  const st = S.cards[c.id];
  return st ? (isMine(st) ? "you know it" : "learning") : "not learned yet";
}
