"use strict";
// The color eye: point the camera at anything and it names the exact pixel in the middle of the frame, live,
// from the ~1,000 core names, with the next-nearest name underneath. Freeze to tap any spot, keep a find, or
// turn the whole frame into a palette. Cameras shift color, so the copy says so plainly.
//
// David, 2026-10-09, exact pixel: isoSample's patch (js/isolate.js) is a touch-friendly average (about 5% of
// the short edge) built for the tap-to-guess games. The camera reads differently: eyeSample() below samples the
// reticle's exact pixel (or at most a 2x2 average) straight off the SOURCE's native resolution -- the <video>
// or <img> element itself, never a canvas that was resized to fit the screen. Live, that's ~12 times a second;
// only the NAME shown eases between readings (Lab-smoothed), never the sampled color or hex, so flicker can't
// quietly swap in a slightly-wrong swatch. Freezing pauses the <video> itself (it keeps its last decoded,
// full-resolution frame), and a tap on the frozen frame maps back through the exact cover-crop transform the
// screen drew it with (toNative), so a tap always samples where it looks like it's sampling.
//
// David, 2026-10-09, no quiz after a pick: freezing is an exposure, not a test. It's logged to the Learner
// Model as "seen" once, immediately -- never as an "answer". Naming it never interrupts with a guess-the-name
// step (that's the Isolator's job elsewhere: js/isolate.js, opened from a photo or a painting, not from here).
// After a freeze the card offers Keep (your colors), Add to a palette (the set tray) or Pick another.
//
// Optional white balance: tap WB, then something white or grey; readings are then corrected by von Kries
// scaling (wbFrom in js/accuracy.js), so that reference comes out neutral. That reference sampling deliberately
// keeps isoSample's bigger, noise-averaged patch -- a reliable reference benefits from it; the live read does
// not. Lock asks the camera hardware itself to hold exposure and white balance steady (MediaStreamTrack.
// applyConstraints), where the device allows it; it's hidden when the camera reports no such capability.

// ---------- exact-pixel sampling (at most a 2x2 average), always off the source's native resolution ----------
let EYE_PROBE = null;
function eyeSample(src, w, h, fx, fy, n = 2) {
  if (!src || !w || !h) return null;
  if (!EYE_PROBE) { const c = document.createElement("canvas"); c.width = c.height = n; EYE_PROBE = c.getContext("2d", { willReadFrequently: true }); }
  if (EYE_PROBE.canvas.width !== n) { EYE_PROBE.canvas.width = n; EYE_PROBE.canvas.height = n; }
  const x = clamp(Math.round(fx * w) - (n >> 1), 0, Math.max(0, w - n)), y = clamp(Math.round(fy * h) - (n >> 1), 0, Math.max(0, h - n));
  try { EYE_PROBE.clearRect(0, 0, n, n); EYE_PROBE.drawImage(src, x, y, n, n, 0, 0, n, n); }
  catch (e) { return null; }
  const d = EYE_PROBE.getImageData(0, 0, n, n).data;
  let r = 0, g = 0, b = 0; const m = d.length / 4;
  for (let p = 0; p < d.length; p += 4) { r += lin8(d[p]); g += lin8(d[p + 1]); b += lin8(d[p + 2]); }
  return ("#" + isoEncode(r / m) + isoEncode(g / m) + isoEncode(b / m)).toUpperCase();
}

const ICON_PHOTO = sv('<rect x="3" y="5" width="18" height="14" rx="2.5"/><circle cx="9" cy="10" r="1.8"/><path d="M21 16l-5.5-5.5L6 19"/>', 22, 1.8);
const ICON_PAL = sv('<rect x="3" y="6" width="4" height="12" rx="1"/><rect x="8.5" y="6" width="4" height="12" rx="1"/><rect x="14" y="6" width="7" height="12" rx="1"/>', 22, 1.8);
const ICON_LOCK = sv('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>', 20, 1.8);

function eye() {
  const el = show(`
    <div class="eye-stage" id="stage">
      <video id="vid" playsinline muted autoplay></video>
      <canvas id="still" hidden></canvas>
      <i class="eye-ret" id="ret"><b class="eye-ret-h"></b><b class="eye-ret-v"></b></i>
    </div>
    <header class="eye-top"><button class="icon-btn glass" data-back aria-label="Back">${ICON.back}</button><span class="eye-hint" id="hint">Point at anything</span><span class="eye-top-r"><button class="icon-btn glass eye-lock" id="lock" hidden aria-label="Lock exposure and white balance" aria-pressed="false">${ICON_LOCK}</button><button class="icon-btn glass eye-wb" id="wb" aria-label="White balance: tap, then tap something white or grey" aria-pressed="false">WB</button></span></header>
    <div class="eye-card" id="card">
      <button class="eye-name" id="nm"><i id="chip"></i><span><b id="big">Looking…</b><em id="src"></em></span></button>
      <p class="eye-hex mono" id="hexline"></p>
      <button class="eye-mine" id="mine"></button>
      <div class="eye-acts" id="acts" hidden>
        <button data-act="keep" id="keepBtn">Keep</button>
        <button data-act="tray">Add to a palette</button>
        <button data-act="again">Pick another</button>
      </div>
      <p class="eye-note">Phones auto-adjust color and exposure, so this is a close read, not a lab measurement.</p>
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
  let stream = null, track = null, frozen = false, raf = 0, cur = null, smooth = null, last = 0, at = [.5, .5], wb = null, wbArm = false, hwLocked = false, loggedThisFreeze = false;
  let capKind = "camera";   // "camera" | "photo": the live feed, or a chosen image (js/learner.js learnerLog "find"/"seen")
  // the transform from a stage-fraction tap to the source's own fraction: the same cover-crop scale + offset the
  // freeze canvas was drawn with, so a tap samples the exact pixel it looks like it's pointing at (toNative)
  let camSrc = null, camW = 0, camH = 0, camK = 1, camOx = 0, camOy = 0;
  const read = hex => wb ? wb(hex) : hex;
  const stop = () => { cancelAnimationFrame(raf); if (stream) stream.getTracks().forEach(t => t.stop()); stream = null; track = null; };
  cleanup.push(stop);
  $("[data-back]").onclick = () => { stop(); go(S.tab || "explore"); };
  loadCoreNames();

  const paint = (hex, nameHex) => {
    if (!hex) return;
    nameHex = nameHex || hex;
    const nm = nameOf(nameHex), nx = nm.near.find(x => x.n !== nm.n && x.de < 12);
    cur = { hex, nm, nx };
    ret.style.setProperty("--c", hex); $("#chip").style.setProperty("--c", hex);
    $("#big").textContent = nm.text;
    $("#src").textContent = nm.de < VERY_CLOSE_DE ? "Nearest of about 1,000 names" : `Nearest of about 1,000 names · ${pctDiff(nm.de)}`;
    $("#hexline").textContent = hex;
    // second line: the next-nearest name, one tap to its page (every name is equal)
    $("#mine").innerHTML = nx ? `<i style="--c:${nx.h}"></i><span>Also near <b>${esc(nx.n)}</b></span><em>${pctDiff(nx.de)}</em>` : "";
    syncKeepBtn();
  };
  const syncKeepBtn = () => { const b = $("#keepBtn"); if (b && cur) b.textContent = typeof fvHas === "function" && fvHas(cur.hex) ? "Kept" : "Keep"; };
  // live: sample about every 80ms (roughly 12 times a second). The swatch and hex always show the RAW exact
  // reading; only the name eases between readings (a Lab-smoothed point feeds nameOf), so sensor noise can't
  // flicker the name every frame without ever touching what's shown as the sampled color itself.
  const tick = t => {
    raf = requestAnimationFrame(tick);
    if (frozen || !vid.videoWidth || t - last < 80) return;
    last = t;
    const hex = read(eyeSample(vid, vid.videoWidth, vid.videoHeight, .5, .5));
    if (!hex) return;
    const L = lab(hex);
    smooth = smooth ? smooth.map((x, i) => x + (L[i] - x) * .45) : L;
    paint(hex, labHex(...smooth));
    if (typeof twLive === "function") twLive(vid, stage);   // the closest painting in the archive to what the camera sees (js/twins.js)
  };
  const toNative = (sfx, sfy) => {
    const R = stage.getBoundingClientRect();
    const sx = (sfx * R.width - camOx) / camK, sy = (sfy * R.height - camOy) / camK;
    return [clamp(sx / camW, 0, 1), clamp(sy / camH, 0, 1)];
  };
  const freeze = (src, w, h) => {
    frozen = true; el.classList.add("frozen"); loggedThisFreeze = false;
    if (src === vid) vid.pause();   // the <video> keeps its last decoded, full-resolution frame while paused
    camSrc = src; camW = w; camH = h;
    // draw what's on screen (cover-cropped) so a tap LOOKS like it lands where it samples; the sample itself
    // always comes from camSrc at full resolution through toNative(), never from this display-sized copy
    const R = stage.getBoundingClientRect(), k = Math.max(R.width / w, R.height / h), dpr = Math.min(devicePixelRatio || 1, 2);
    camK = k; camOx = (R.width - w * k) / 2; camOy = (R.height - h * k) / 2;
    still.width = R.width * dpr; still.height = R.height * dpr; still.hidden = false;
    const c = still.getContext("2d"); c.drawImage(src, camOx * dpr, camOy * dpr, w * k * dpr, h * k * dpr);
    vid.style.visibility = "hidden";
    $("#hint").textContent = "Tap anywhere to name it";
    $("#acts").hidden = false;
    $("#shut").setAttribute("aria-label", "Back to live");
    at = [.5, .5]; placeRet();
    paint(read(eyeSample(camSrc, camW, camH, .5, .5)));
    // a freeze is an exposure, not a quiz answer: log it once to the Learner Model as "seen" (js/learner.js)
    if (typeof learnerLog === "function" && cur && !loggedThisFreeze) { loggedThisFreeze = true; learnerLog({ type: "seen", color: { n: cur.nm.n, h: cur.hex }, src: capKind }); }
    buzz(10);
  };
  const live = () => {
    frozen = false; capKind = "camera"; el.classList.remove("frozen"); still.hidden = true; vid.style.visibility = ""; $("#acts").hidden = true;
    $("#hint").textContent = "Point at anything"; $("#shut").setAttribute("aria-label", "Freeze");
    if (stream) vid.play().catch(() => {});
    at = [.5, .5]; placeRet();
  };
  const placeRet = () => { ret.style.left = at[0] * 100 + "%"; ret.style.top = at[1] * 100 + "%"; };
  // white balance: the next tap picks the reference (live: the middle circle; frozen: where you tap). A
  // reliable reference benefits from isoSample's bigger, noise-averaged patch (js/isolate.js) -- unlike the
  // live read above, this one point is deliberately not the exact-pixel eyeSample.
  const hintNow = () => $("#hint").textContent = wbArm ? (frozen ? "Tap something white or grey" : "Aim the circle at white or grey, tap") : frozen ? "Tap anywhere to name it" : "Point at anything";
  const wbBtn = $("#wb");
  const setWb = f => { wb = f; wbBtn.classList.toggle("on", !!f); wbBtn.setAttribute("aria-pressed", f ? "true" : "false"); smooth = null; };
  wbBtn.onclick = () => {
    if (wb) { setWb(null); wbArm = false; toast("White balance off"); }
    else { wbArm = !wbArm; wbBtn.classList.toggle("arm", wbArm); }
    hintNow();
  };
  // Lock: ask the camera hardware itself to stop re-adjusting exposure and white balance, where it allows it
  const lockBtn = $("#lock");
  const lockMode = (modes, want) => modes && modes.includes(want) ? want : null;
  lockBtn.onclick = async () => {
    if (!track || typeof track.getCapabilities !== "function") return;
    const cap = track.getCapabilities(), next = !hwLocked, adv = [];
    const em = lockMode(cap.exposureMode, next ? "manual" : "continuous"), wm = lockMode(cap.whiteBalanceMode, next ? "manual" : "continuous");
    if (!em && !wm) { toast("This camera won't lock exposure or white balance"); return; }
    if (em) adv.push({ exposureMode: em });
    if (wm) adv.push({ whiteBalanceMode: wm });
    try {
      await track.applyConstraints({ advanced: adv });
      hwLocked = next; lockBtn.classList.toggle("on", hwLocked); lockBtn.setAttribute("aria-pressed", String(hwLocked));
      toast(hwLocked ? "Exposure and white balance locked" : "Back to auto"); buzz(8);
    } catch (e) { toast("Couldn't lock this camera"); }
  };
  stage.addEventListener("pointerdown", e => {
    if (wbArm) {
      const R = stage.getBoundingClientRect(), p = frozen ? [(e.clientX - R.left) / R.width, (e.clientY - R.top) / R.height] : [.5, .5];
      const ref = frozen ? isoSample(still, p[0], p[1]) : vid.videoWidth ? isoSample(vid, .5, .5) : null;
      const f = ref && wbFrom(ref);
      wbArm = false; wbBtn.classList.remove("arm");
      if (f) { setWb(f); toast("White set"); if (frozen) paint(read(eyeSample(camSrc, camW, camH, at[0], at[1]))); }
      else toast("Too dark or too colorful. Try white or grey");
      hintNow(); buzz(5); return;
    }
    if (!frozen) return;
    const R = stage.getBoundingClientRect(), sfx = (e.clientX - R.left) / R.width, sfy = (e.clientY - R.top) / R.height;
    at = [sfx, sfy]; placeRet();
    const [fx, fy] = toNative(sfx, sfy);
    paint(read(eyeSample(camSrc, camW, camH, fx, fy))); buzz(5);
  });
  $("#shut").onclick = () => {
    if (frozen) return stream ? live() : null;
    if (vid.videoWidth) freeze(vid, vid.videoWidth, vid.videoHeight);
  };
  // after a freeze: Keep (your colors), Add to a palette (the set tray) or Pick another -- never a name-it quiz
  $("#acts").onclick = e => {
    const b = e.target.closest("[data-act]"); if (!b || !cur) return;
    const act = b.dataset.act;
    if (act === "keep") { if (typeof fvSet === "function") fvSet(cur.hex, cur.nm.n, true, "camera"); toast("Kept"); syncKeepBtn(); buzz(8); }
    else if (act === "tray") { if (typeof sxAdd === "function") sxAdd(cur.hex); buzz(8); }
    else if (act === "again") { if (capKind === "photo") $("#file").click(); else live(); }
  };
  // a tap on either name is a kept find: you looked, the app named it, and you chose to open it (js/learner.js learnerLog "find")
  const logFind = (n, h) => { if (typeof learnerLog === "function") learnerLog({ type: "find", color: { n, h }, src: capKind }); };
  $("#nm").onclick = () => { if (!cur) return; logFind(cur.nm.n, cur.hex); openTappedColor(cur.hex); };   // David, 2026-10-07: one tap opens the page, not the sheet
  $("#mine").onclick = () => { if (cur && cur.nx) { logFind(cur.nx.n, cur.nx.h); openTappedColor(cur.nx.h); } };
  const fromFile = f => {
    if (!f) return;
    const img = new Image();
    img.onload = () => { stop(); capKind = "photo"; el.classList.remove("nocam"); $("#off").hidden = true; freeze(img, img.naturalWidth, img.naturalHeight); URL.revokeObjectURL(img.src); };
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
    track = stream.getVideoTracks()[0] || null;
    if (track && typeof track.getCapabilities === "function") {
      try {
        const cap = track.getCapabilities();
        if ((cap.exposureMode && cap.exposureMode.includes("manual")) || (cap.whiteBalanceMode && cap.whiteBalanceMode.includes("manual"))) lockBtn.hidden = false;
      } catch (e) {}
    }
    raf = requestAnimationFrame(tick);
  })();
}

LAB.eye = () => eye();
