"use strict";
// Picked colors (David, 2026-10-10): "This app should have a simple place to save colors, like copy-paste but
// multiple — like Photoshop, it saves every color you select". Every eyedropper pick (js/eyedrop.js
// eyedropAttach — the painting page, Look closer, the camera, a photo, Studio's Name any color) lands here
// automatically on release: no separate "add" step. One small module, top-level names start with pk.
//   pkAdd(hex, meta)       commit a pick (called from js/eyedrop.js's own release handler)
//   pkList() / pkRemove(hex) / pkClear()
//   pkButtonHTML(cls)      a small swatch-stack button with a count, for any screen to drop in
//   pkSheet()              the compact sheet: Browse (tap opens the page), Select (multi-select: copy hexes,
//                           make a palette, Keep, Remove), Build a palette (tap to add in order, drag to
//                           reorder, name it, Save -> the real set page, js/setpage.js)
// State: S.picked = [{ h, n, at }], newest first, deduped within ΔE<1, capped at 60. A new, unversioned save
// key, same pattern as design/SIMPLIFY/CONTRACT.md's S.recentColl: migrateState() isn't touched, every read
// guards with Array.isArray, so an older save just gets an empty list the first time it's read.

const PK_MAX = 60;
const pkHex = h => /^#?[0-9a-f]{6}$/i.test(String(h || "")) ? "#" + String(h).replace("#", "").toUpperCase() : null;
const pkStore = () => Array.isArray(S.picked) ? S.picked : (S.picked = []);
const pkList = () => pkStore().slice();
const pkNm = h => { const n = typeof nameOf === "function" ? nameOf(h) : null; return n && (n.n || n.text) || String(h); };

function pkAdd(hex, meta = {}) {
  hex = pkHex(hex); if (!hex) return null;
  const s = pkStore();
  const i = s.findIndex(p => de2000(p.h, hex) < 1);
  if (i >= 0) s.splice(i, 1);
  const entry = { h: hex, n: pkNm(hex), at: Date.now(), src: meta.src || "" };
  s.unshift(entry);
  if (s.length > PK_MAX) s.length = PK_MAX;
  save();
  pkSyncBadges();
  return entry;
}
function pkRemove(hex) {
  hex = pkHex(hex); if (!hex) return;
  const s = pkStore(), i = s.findIndex(p => p.h === hex);
  if (i >= 0) { s.splice(i, 1); save(); pkSyncBadges(); }
}
function pkClear() { S.picked = []; save(); pkSyncBadges(); }

// ---------- the small stack button, droppable into any screen's own markup ----------
const PK_ICON_STACK = sv('<rect x="4" y="8.5" width="12" height="12" rx="3"/><rect x="8" y="4.5" width="12" height="12" rx="3" fill="var(--ground)"/>', 20, 1.6);
function pkButtonHTML(cls = "", label = "Picked colors") {
  const n = pkStore().length;
  if (!n) return "";
  return `<button type="button" class="pk-stackbtn ${cls}" data-pk-open aria-label="${esc(label)}, ${n} saved">
    <span class="pk-stackbtn-sw">${pkStore().slice(0, 3).map(p => `<i style="--c:${p.h}"></i>`).join("")}</span><b>${n}</b></button>`;
}
function pkSyncBadges() {
  document.querySelectorAll("[data-pk-open]").forEach(b => {
    const n = pkStore().length;
    if (!n) { b.remove(); return; }
    const sw = b.querySelector(".pk-stackbtn-sw"), ct = b.querySelector("b");
    if (sw) sw.innerHTML = pkStore().slice(0, 3).map(p => `<i style="--c:${p.h}"></i>`).join("");
    if (ct) ct.textContent = n;
  });
}
document.addEventListener("click", e => {
  const b = e.target.closest("[data-pk-open]");
  if (!b) return;
  e.preventDefault(); e.stopPropagation(); buzz(5);
  pkSheet();
});

// ---------- saving a build as a real palette/set (js/setpage.js spPage, js/studio.js plMakeId) ----------
function pkSaveAsPalette(hexes, name) {
  hexes = (hexes || []).map(pkHex).filter(Boolean);
  if (hexes.length < 2) return null;
  S.palettes = Array.isArray(S.palettes) ? S.palettes : [];
  const id = typeof plMakeId === "function" ? plMakeId() : "pl" + Date.now().toString(36);
  const p = { id, cols: hexes.slice(), from: "Picked colors", name: (name || "").trim(), at: today() };
  S.palettes.unshift(p);
  S.palettes = S.palettes.slice(0, 60);
  save();
  buzz([10, 30, 20]);
  if (typeof sfxChord === "function") try { sfxChord(hexes, { gap: .07 }); } catch (e) {}
  if (typeof spPage === "function") spPage(hexes, { push: true });
  return p;
}

// ---------- the sheet ----------
function pkSheet() {
  let mode = "browse";          // "browse" | "select" | "build"
  let selected = new Set();     // select mode
  let building = [];            // build mode, in tap order
  const { sh, close } = sheet(`<div data-pk-body></div>`, { z: 95 });
  sh.classList.add("pk-sheet");
  const body = sh.querySelector("[data-pk-body]");

  const chipHTML = p => {
    const name = esc(p.n || pkNm(p.h));
    if (mode === "browse") return `<button class="pk-chip" data-swatch="${p.h}" style="--c:${p.h}" data-ink="${ink(p.h)}" aria-label="${name}"><b>${name}</b></button>`;
    const on = mode === "select" ? selected.has(p.h) : building.includes(p.h);
    return `<button type="button" class="pk-chip${on ? " on" : ""}" data-pk-hex="${p.h}" style="--c:${p.h}" data-ink="${ink(p.h)}" aria-label="${name}${on ? ", selected" : ""}">
      ${on ? `<i class="pk-chip-check">${ICON.check}</i>` : ""}<b>${name}</b></button>`;
  };
  const buildChipHTML = (h, i) => `<span class="pk-bchip" data-pk-chip="${i}" style="--c:${h}" data-ink="${ink(h)}"><b>${esc(pkNm(h))}</b><i class="pk-bchip-n">${i + 1}</i></span>`;

  function render() {
    const items = pkList();
    const n = items.length;
    body.innerHTML = `
      <div class="pk-head"><div><p class="eyebrow">Picked colors</p><h2>${n ? `${n} saved` : "Nothing yet"}</h2></div>
        <button type="button" class="icon-btn" data-pk-close aria-label="Close">${ICON.x}</button></div>
      ${n ? `<div class="seg pk-modebar" role="group" aria-label="View">
        <button type="button" data-pk-mode="browse" class="${mode === "browse" ? "on" : ""}">Browse</button>
        <button type="button" data-pk-mode="select" class="${mode === "select" ? "on" : ""}">Select</button>
        <button type="button" data-pk-mode="build" class="${mode === "build" ? "on" : ""}">Build</button>
      </div>` : `<p class="pk-sub">Press and drag on any picture — a painting, a photo, the camera — and release to save the color here.</p>`}
      ${mode === "build" && n ? `
        <div class="pk-build-strip${building.length ? "" : " empty"}" data-pk-strip>${building.length ? building.map(buildChipHTML).join("") : `<span class="pk-build-empty">Tap colors below to add them, in order</span>`}</div>
        ${building.length >= 2 ? `<label class="pk-namefield"><span>Name this palette</span><input type="text" maxlength="40" placeholder="${esc(building.map(pkNm).slice(0, 3).join(", "))}" data-pk-name autocomplete="off"></label>
          <button type="button" class="btn solid pk-save" data-pk-save>Save · ${building.length} colors</button>`
          : `<p class="pk-sub">Pick at least 2 colors for a palette.</p>`}` : ""}
      ${n ? `<div class="pk-grid" data-pk-grid>${items.map(chipHTML).join("")}</div>` : ""}
      ${mode === "select" ? `<div class="pk-selbar">
        <p class="pk-sub">${selected.size ? `${selected.size} selected` : "Tap colors to select them"}</p>
        <div class="pk-selacts">
          <button type="button" data-pk-copyall>Copy ${selected.size ? selected.size + " hexes" : `all ${n} hexes`}</button>
          <button type="button" data-pk-makeset>Make a palette</button>
          <button type="button" data-pk-keep>${ICON.heart} Keep</button>
          <button type="button" class="danger" data-pk-removesel ${selected.size ? "" : "disabled"}>Remove</button>
        </div></div>` : ""}
      ${n ? `<button type="button" class="pk-clearall" data-pk-clearall>Clear all</button>` : ""}`;
    if (mode === "build") wireBuildDrag();
  }

  function wireBuildDrag() {
    const strip = sh.querySelector("[data-pk-strip]"); if (!strip) return;
    let sd = null;
    const chips = () => [...strip.querySelectorAll("[data-pk-chip]")];
    strip.addEventListener("pointerdown", e => {
      const b = e.target.closest("[data-pk-chip]"); if (!b) return;
      const bs = chips();
      sd = { b, i: bs.indexOf(b), at: bs.indexOf(b), x: e.clientX, id: e.pointerId, step: b.offsetWidth + 6, n: bs.length, moved: false };
    });
    strip.addEventListener("pointermove", e => {
      if (!sd || e.pointerId !== sd.id) return;
      const dx = e.clientX - sd.x;
      if (!sd.moved && Math.abs(dx) > 6) { sd.moved = true; sd.b.classList.add("dragging"); try { sd.b.setPointerCapture(sd.id); } catch (er) {} buzz(5); }
      if (!sd.moved) return;
      if (e.cancelable) e.preventDefault();
      sd.at = Math.max(0, Math.min(sd.n - 1, Math.round(sd.i + dx / sd.step)));
      sd.b.style.transform = `translateX(${dx}px) scale(1.05)`;
      chips().forEach((bEl, idx) => {
        if (bEl === sd.b) return;
        let s = 0;
        if (sd.i < sd.at && idx > sd.i && idx <= sd.at) s = -sd.step;
        if (sd.i > sd.at && idx < sd.i && idx >= sd.at) s = sd.step;
        bEl.style.transform = s ? `translateX(${s}px)` : "";
      });
    });
    const end = e => {
      if (!sd || e.pointerId !== sd.id) return;
      const d = sd; sd = null;
      chips().forEach(b => b.style.transform = ""); d.b.classList.remove("dragging");
      if (d.moved && d.at !== d.i) { const [mv] = building.splice(d.i, 1); building.splice(d.at, 0, mv); buzz(8); render(); }
    };
    strip.addEventListener("pointerup", end); strip.addEventListener("pointercancel", end);
  }

  sh.addEventListener("click", e => {
    if (e.target.closest("[data-pk-close]")) return close();
    const modeBtn = e.target.closest("[data-pk-mode]");
    if (modeBtn) {
      buzz(5);
      mode = modeBtn.dataset.pkMode;
      if (mode !== "select") selected = new Set();
      render(); return;
    }
    const chip = e.target.closest("[data-pk-hex]");
    if (chip) {
      const h = chip.dataset.pkHex;
      if (mode === "select") { if (selected.has(h)) selected.delete(h); else selected.add(h); buzz(4); render(); return; }
      if (mode === "build") { const i = building.indexOf(h); if (i >= 0) building.splice(i, 1); else building.push(h); buzz(5); render(); return; }
    }
    const copyBtn = e.target.closest("[data-pk-copyall]");
    if (copyBtn) {
      const items = pkList(), hexes = selected.size ? [...selected] : items.map(p => p.h);
      const text = hexes.join(", ");
      try { navigator.clipboard && navigator.clipboard.writeText(text).catch(() => {}); } catch (er) {}
      copyBtn.setAttribute("data-pk-copied", text);   // not shown; lets a test confirm what actually got copied
      buzz(8);
      const was = copyBtn.textContent; copyBtn.textContent = "Copied";
      setTimeout(() => { if (copyBtn.isConnected) copyBtn.textContent = was; }, 1400);
      return;
    }
    if (e.target.closest("[data-pk-makeset]")) {
      if (!selected.size) { toast("Select at least 2 colors first"); return; }
      building = [...selected]; mode = "build"; selected = new Set(); buzz(6); render(); return;
    }
    if (e.target.closest("[data-pk-keep]")) {
      const items = pkList(), hexes = selected.size ? [...selected] : items.map(p => p.h);
      if (typeof fvCommit === "function") fvCommit(hexes.map(h => [h, pkNm(h)]), [], "picked-colors");
      buzz(10); toast(`${hexes.length} color${hexes.length === 1 ? "" : "s"} kept`);
      return;
    }
    if (e.target.closest("[data-pk-removesel]")) {
      if (!selected.size) return;
      [...selected].forEach(h => pkRemove(h));
      selected = new Set(); buzz(8); render(); return;
    }
    if (e.target.closest("[data-pk-save]")) {
      if (building.length < 2) return;
      const input = sh.querySelector("[data-pk-name]"), name = input ? input.value.trim() : "";
      close();
      pkSaveAsPalette(building, name);
      return;
    }
    if (e.target.closest("[data-pk-clearall]")) {
      mnConfirm({ title: "Clear all picked colors?", body: "This removes every color from your Picked colors history. Anything you've already kept or saved as a palette stays.", yes: "Clear all", no: "Keep them", danger: true })
        .then(ok => { if (!ok) return; pkClear(); render(); });
      return;
    }
  });
  render();
  return { sh, close };
}

// a quiet row for Studio, next to Kept (js/rooms2.js r2StudioHome inserts this one line)
function pkStudioRow() {
  const n = pkStore().length;
  if (!n) return "";
  return `<button type="button" class="qrow pk-studiorow" data-pk-open><span class="pk-stackbtn-sw">${pkStore().slice(0, 4).map(p => `<i style="--c:${p.h}"></i>`).join("")}</span>
    <span class="pk-studiorow-t"><b>Picked colors</b><em>${n} saved from the eyedropper</em></span>${ICON.chev}</button>`;
}

if (typeof featureRegister === "function") {
  featureRegister("picked-colors", { t: "Picked colors", where: "Studio · Picked colors", words: ["picked colors", "swatches", "eyedropper history", "saved colors", "palette from picks"], run: () => pkSheet() });
}
