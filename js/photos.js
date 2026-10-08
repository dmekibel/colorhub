"use strict";
// Saved photos (ROADMAP.md §17 job #2): every picture captured in Studio (the camera's "palette from this
// frame", or a photo picked from the library) is downscaled, its 3/6/10-color palettes computed once, and kept
// in IndexedDB on this device. Accounts come later, so the record shape stays sync-ready: { id, blob, pals,
// at, title }. "Your photos" is a calm shelf on the Studio home (studio(), js/studio.js); every photo gets its
// own address, #/photo/<id> (js/router.js), and reopens from the shelf, from Back, or from a reload — the
// view itself is studio.js's own paletteView(), passed a photoId so it knows to route, to offer deleting the
// photo, and to use xStep() for Back instead of jumping straight to the Studio tab (ROADMAP.md §17 job #2,
// "Pinterest-style Back").
// IndexedDB can be unavailable (Safari private windows throw the moment anything is written): every call
// here rejects cleanly in that case, phWarn() says so once, and the caller still shows the palette in memory.

const PH_DB_NAME = "colorhub-photos", PH_STORE = "photos", PH_MAX_SIDE = 1200;
let phDBP = null, phBroken = false, phWarnedOnce = false;

function phDB() {
  if (phBroken) return Promise.reject(new Error("photos: unavailable"));
  if (phDBP) return phDBP;
  if (!("indexedDB" in window)) { phBroken = true; return phDBP = Promise.reject(new Error("photos: no indexedDB")); }
  return phDBP = new Promise((resolve, reject) => {
    let req;
    try { req = indexedDB.open(PH_DB_NAME, 1); } catch (e) { reject(e); return; }
    req.onupgradeneeded = () => { const db = req.result; if (!db.objectStoreNames.contains(PH_STORE)) db.createObjectStore(PH_STORE, { keyPath: "id" }); };
    req.onsuccess = () => { const db = req.result; db.onversionchange = () => { try { db.close(); } catch (e) {} phDBP = null; }; resolve(db); };
    req.onerror = () => reject(req.error || new Error("photos: open failed"));
    req.onblocked = () => reject(new Error("photos: blocked"));
  }).catch(e => { phBroken = true; throw e; });
}
const phReq = req => new Promise((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
const phSave = rec => phDB().then(db => phReq(db.transaction(PH_STORE, "readwrite").objectStore(PH_STORE).put(rec))).then(() => rec);
const phGet = id => phDB().then(db => phReq(db.transaction(PH_STORE, "readonly").objectStore(PH_STORE).get(id)));
const phDelete = id => phDB().then(db => phReq(db.transaction(PH_STORE, "readwrite").objectStore(PH_STORE).delete(id)));
const phList = () => phDB().then(db => phReq(db.transaction(PH_STORE, "readonly").objectStore(PH_STORE).getAll()))
  .then(rows => rows.slice().sort((a, b) => (b.at || "").localeCompare(a.at || "") || (b.id || "").localeCompare(a.id || "")));
function phWarn() {
  if (phWarnedOnce) return; phWarnedOnce = true;
  toast("This browser can't save photos here (a private window?). This one will still show its palette, just not next time.");
}

// a short-lived cache of blob -> object URL, so re-rendering a shelf doesn't leak a new URL every time
const PH_URLS = new Map();
function phURL(rec) {
  let u = PH_URLS.get(rec.id);
  if (!u) { u = URL.createObjectURL(rec.blob); PH_URLS.set(rec.id, u); }
  return u;
}
function phForgetURL(id) { const u = PH_URLS.get(id); if (u) { URL.revokeObjectURL(u); PH_URLS.delete(id); } }

const phMakeId = () => "ph" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const phBlobFromCanvas = (canvas, q = .85) => new Promise(resolve => canvas.toBlob(b => resolve(b), "image/jpeg", q));
function phDownscale(canvas, maxSide = PH_MAX_SIDE) {
  const m = Math.max(canvas.width, canvas.height);
  if (m <= maxSide) return canvas;
  const k = maxSide / m, c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(canvas.width * k)); c.height = Math.max(1, Math.round(canvas.height * k));
  c.getContext("2d").drawImage(canvas, 0, 0, c.width, c.height);
  return c;
}
// Studio's two real capture points (a file picked in studio.js, "palette from this frame" in camera.js) call
// this instead of studioFromImage() directly: it saves the photo (downscaled, palettes already computed) and
// opens its own page. If saving fails, it falls back to the old in-memory paletteView (not addressed, not kept).
function phCaptureAndOpen(canvas, from) {
  const small = phDownscale(canvas), pals = {}; [3, 6, 10].forEach(k => pals[k] = extractPalette(small, k));
  const id = phMakeId();
  phBlobFromCanvas(small).then(blob => phSave({ id, blob, pals, at: today(), title: "", from: from || "" }))
    .then(rec => { XSTACK.push("ph:" + id); phOpenRecord(id, rec); })
    .catch(() => { paletteView({ img: small.toDataURL("image/jpeg", .85), pals, from }); phWarn(); });
}

// ---------- the photo page: an address, Back one step at a time, delete with a confirm ----------
// photoPage(id, push) is the entry point (router.js wraps phOpenRecord for the address); it looks the record
// up and hands it to studio.js's paletteView(), which already draws the count/look/% controls, the hex list
// (every swatch carries data-swatch, so js/swatch.js's color sheet opens from here for free) and the "Keep
// this palette" / CSS / hex actions — paletteView just needs a photoId to know to route here, offer deleting
// the photo, and use xStep() for its own Back instead of always landing on the Studio tab.
function photoPage(id, push = true) {
  phGet(id).then(rec => {
    if (!rec) { toast("That photo isn't here anymore"); return xToOrigin(); }
    if (push) XSTACK.push("ph:" + id);
    phOpenRecord(id, rec);
  }).catch(() => { toast("Photos aren't available here"); xToOrigin(); });
}
// the actual renderer (what router.js gives an address): kept separate from photoPage so going back to an
// already-fetched record (xStep's "ph:" case) doesn't need to touch IndexedDB again.
function phOpenRecord(id, rec) {
  paletteView({ img: phURL(rec), pals: rec.pals, from: rec.from || "Your photo", title: rec.title || "", at: rec.at, photoId: id });
}
// renaming (ROADMAP.md §17 job #2): the title is tappable on the photo's own page (js/studio.js's paletteView)
// and saves straight to IndexedDB, same record, so it shows on the shelf next time too.
function phRename(id, title) {
  return phGet(id).then(rec => { if (!rec) return; rec.title = (title || "").trim(); return phSave(rec); }).catch(() => {});
}
function phDeleteConfirm(id, after) {
  const { sh, close } = sheet(`<div class="pk-hero" data-ink="light" style="--c:#3A3732"><h2>Delete this photo?</h2><small>Its palettes go with it. This can't be undone.</small></div>
    <div class="sw-acts"><button class="item" data-yes style="color:#D9664F">Delete photo</button><button class="item" data-no>Keep it</button></div>`);
  sh.querySelector("[data-no]").onclick = close;
  sh.querySelector("[data-yes]").onclick = () => { close(); phDelete(id).then(() => { phForgetURL(id); buzz(10); toast("Deleted"); after(); }).catch(() => toast("Couldn't delete it")); };
}

// ---------- the shelf on Studio's home ----------
function phShelfHTML() {
  return `<div class="sec-head"><b>Your photos</b><span></span></div><div class="st-phrail" id="phShelf"><p class="fine">Loading…</p></div>`;
}
function phWireShelf(host) {
  phList().then(rows => {
    if (!host.isConnected) return;
    if (!rows.length) { host.innerHTML = `<p class="x-sub">A photo you upload or shoot with the camera lands here, with its palette ready next time.</p>`; return; }
    host.innerHTML = rows.map(r => `<button class="st-ph" data-ph="${r.id}" style="--c:${(r.pals[6] || r.pals[3] || [{ h: "#3A3732" }])[0].h}">
      <img src="${phURL(r)}" alt="" loading="lazy"><small>${esc(r.title || fmtDay(r.at) || "")}</small></button>`).join("");
    host.querySelectorAll("[data-ph]").forEach(b => {
      let t = 0;
      b.addEventListener("pointerdown", () => { t = setTimeout(() => { buzz(8); phDeleteConfirm(b.dataset.ph, () => phWireShelf(host)); }, 550); });
      ["pointerup", "pointercancel", "pointerleave"].forEach(ev => b.addEventListener(ev, () => clearTimeout(t)));
      b.onclick = () => photoPage(b.dataset.ph);
    });
  }).catch(() => { if (host.isConnected) host.innerHTML = `<p class="x-sub">Photos aren't available in this browser (a private window?).</p>`; });
}
