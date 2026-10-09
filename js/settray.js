"use strict";
// The set tray and the "Pair with…" picker (design/SET-PAGES.md). How two, three or more colors get together:
//   sxPairBtnHTML(hex, name)  the small "Pair with…" button under a color page's hex (js/richpage.js, one line)
//   sxPick(anchor, o)         the picker sheet: a live try-on strip (the set so far, large, plus a dashed trying
//                             slot), then harmonies, painters' pairs, look-alikes, your colors, recent, search any
//                             name, or any color on the ring. Tapping a candidate drops it into the trying slot
//                             (no commit, swap freely); Add commits it, Cancel clears the trial. One tap on a
//                             candidate's own page (search's "open" state) still opens it directly.
//   sxAdd(hex)                add a color to the set (long-press on any [data-swatch] anywhere does this)
//   sxOpen(hexes)             open the pair page (2 colors) or the set page (3+) for these colors
// The set lives in S.setTray (up to SX_MAX colors) and shows as a small pill at the foot of every screen, so you
// can keep browsing and add more. The pages themselves are js/setpage.js (spPage). Top-level names start with sx.

const SX_MAX = 8;
const SX_ICON_PAIR = sv('<circle cx="9" cy="12" r="5.5"/><circle cx="15" cy="12" r="5.5"/>', 18, 1.7);
const SX_ICON_X = sv('<path d="M6 6l12 12M18 6L6 18"/>', 16, 1.8);
const SX_ICON_CAM = sv('<path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 011 1v9a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1z"/><circle cx="12" cy="13" r="3.5"/>', 22, 1.7);
const SX_ICON_PHOTO = sv('<rect x="3" y="5" width="18" height="14" rx="2.5"/><circle cx="9" cy="10" r="1.8"/><path d="M21 16l-5.5-5.5L6 19"/>', 22, 1.7);
const sxHex = h => /^#?[0-9a-f]{6}$/i.test(String(h || "")) ? "#" + String(h).replace("#", "").toUpperCase() : null;
const sxTray = () => (Array.isArray(S.setTray) ? S.setTray : (S.setTray = [])).filter(h => sxHex(h));
const sxNm = h => { const n = nameOf(h); return n.de < VERY_CLOSE_DE && !n.between ? n.n : n.text || h; };
// one color, already in the set? (within 1% different counts as the same color)
const sxHas = (list, h) => list.some(x => de2000(x, h) < 1);
// the try-on relation line: "Complement · 12.4% apart · contrast 4.8:1" (nearest textbook hue relation, plus the
// measured gap and WCAG contrast). de2000/lch/rgb are js/core.js color math.
const SX_REL_LIN = v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; };
const SX_REL_LUM = h => { const [r, g, b] = rgb(h).map(SX_REL_LIN); return .2126 * r + .7152 * g + .0722 * b; };
const sxContrast = (a, b) => { const x = SX_REL_LUM(a), y = SX_REL_LUM(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
function sxRelName(a, b) {
  const [, Ca] = lch(a), [, Cb] = lch(b);
  if (Ca < 8 && Cb < 8) return "Both neutral";
  if (Ca < 8 || Cb < 8) return "Neutral pairing";
  const [, , Ha] = lch(a), [, , Hb] = lch(b), gap = Math.abs(Ha - Hb) % 360, d = gap > 180 ? 360 - gap : gap;
  if (d < 12) return "Twins";
  const targets = [["Neighbor", 30], ["Triad", 120], ["Split complement", 150], ["Complement", 180]];
  return targets.reduce((best, t) => Math.abs(d - t[1]) < Math.abs(d - best[1]) ? t : best, targets[0])[0];
}
function sxRelLine(a, b) {
  const r = sxContrast(a, b);
  return `${sxRelName(a, b)} · ${pctFmt(de2000(a, b))} apart · contrast ${r.toFixed(1)}:1`;
}

// The tray is only for building a set: opening the set page consumes it, two screens without adding clears it, ✕ clears it.
// (The pair/set lives on at its own address, in the trail and in You → Kept.)
let SX_NAV = 0;
const SX_STALE = 2;
addEventListener("hashchange", () => { if (sxTray().length && ++SX_NAV >= SX_STALE) { S.setTray = []; save(); sxSync(); } });
function sxSetTray(list) {
  SX_NAV = 0;
  const out = [];
  list.map(sxHex).filter(Boolean).forEach(h => { if (!sxHas(out, h) && out.length < SX_MAX) out.push(h); });
  S.setTray = out; save(); sxSync(true);
  return out;
}
function sxAdd(hex, o = {}) {
  hex = sxHex(hex); if (!hex) return;
  const t = sxTray();
  if (sxHas(t, hex)) { if (!o.quiet) toast(`${sxNm(hex)} is already in your set`); return; }
  if (t.length >= SX_MAX) { toast(`A set holds up to ${SX_MAX} colors`); return; }
  sxSetTray([...t, hex]);
  buzz(12);
  if (!o.quiet) toast(t.length ? `Added ${sxNm(hex)} · ${t.length + 1} colors in your set` : `${sxNm(hex)} is in your set. Long-press another color to pair it`);
}
function sxOpen(hexes) {
  const list = (hexes || []).map(sxHex).filter(Boolean);
  if (list.length < 2) return sxPick(list[0] || sxTray()[0]);
  S.setTray = []; save(); SX_NAV = 0;   // opening the set page consumes the tray
  if (typeof spPage === "function") spPage(list);
  sxSync();
}

// ---------- the "Pair with…" button on a color page ----------
const sxPairBtnHTML = (hex, name) => `<button class="sx-pairbtn" data-sx-pair="${esc(String(hex).toUpperCase())}" data-sx-name="${esc(name || "")}">${SX_ICON_PAIR}<span>Pair with…</span></button>`;
document.addEventListener("click", e => {
  const b = e.target.closest("[data-sx-pair]");
  if (!b) return;
  e.preventDefault(); e.stopPropagation(); buzz(6);
  sxPick(b.dataset.sxPair, { name: b.dataset.sxName || "" });
});

// ---------- long-press any swatch: add it to the set ----------
// A plain tap still opens the color's page (js/swatch.js); a press held for SX_HOLD ms adds it here instead and the
// click that follows is swallowed. Window capture runs before swatch.js's document capture handler.
const SX_HOLD = 480;
let SX_PRESS = null, SX_SWALLOW = 0;
addEventListener("pointerdown", e => {
  if (e.button > 0) return;
  const sw = e.target.closest && e.target.closest("[data-swatch]");
  // the color page's cover has its own hold (the "Walk from here" flower, js/richpage.js rpHoldWalk)
  if (!sw || e.target.closest(".sheet, .cp-hero, [data-no-hold]") || !sxHex(sw.dataset.swatch)) return;
  clearTimeout(SX_PRESS && SX_PRESS.t);
  const p = { x: e.clientX, y: e.clientY, sw };
  p.t = setTimeout(() => {
    if (SX_PRESS !== p || !sw.isConnected) return;
    SX_PRESS = null; SX_SWALLOW = performance.now();
    sw.classList.add("sx-held"); setTimeout(() => sw.classList.remove("sx-held"), 420);
    sxAdd(sw.dataset.swatch);
  }, SX_HOLD);
  SX_PRESS = p;
}, true);
const sxCancel = () => { if (SX_PRESS) { clearTimeout(SX_PRESS.t); SX_PRESS = null; } };
addEventListener("pointermove", e => { if (SX_PRESS && Math.hypot(e.clientX - SX_PRESS.x, e.clientY - SX_PRESS.y) > 10) sxCancel(); }, true);
["pointerup", "pointercancel", "scroll"].forEach(k => addEventListener(k, sxCancel, true));
addEventListener("click", e => {
  if (SX_SWALLOW && performance.now() - SX_SWALLOW < 1500) { SX_SWALLOW = 0; e.stopPropagation(); e.preventDefault(); }
}, true);
addEventListener("contextmenu", e => { if (e.target.closest && e.target.closest("[data-swatch]")) e.preventDefault(); }, true);

// ---------- the tray pill ----------
let SX_EL = null;
function sxSync(bump) {
  const t = sxTray();
  if (!SX_EL) {
    if (!t.length) return;
    SX_EL = document.createElement("div");
    SX_EL.className = "sx-tray"; SX_EL.setAttribute("role", "region"); SX_EL.setAttribute("aria-label", "Your set of colors");
    document.body.appendChild(SX_EL);
    SX_EL.addEventListener("click", e => {
      e.stopPropagation();
      if (e.target.closest("[data-sx-clear]")) { buzz(6); sxSetTray([]); return; }
      buzz(6); sxOpen(sxTray());
    });
  }
  const onPage = !!document.querySelector(".screen.sp-page, .sp-page");
  SX_EL.hidden = !t.length || onPage || (typeof SHOT !== "undefined" && SHOT);
  if (SX_EL.hidden) return;
  const word = t.length === 1 ? "Pair it" : t.length === 2 ? "Open the pair" : `Open ${t.length} colors`;
  SX_EL.innerHTML = `<button class="sx-tray-main" aria-label="${esc(word)}"><span class="sx-tray-sw">${t.map(h => `<i style="--c:${h}"></i>`).join("")}</span><b>${word}</b></button><button class="sx-tray-x" data-sx-clear aria-label="Clear the set">${SX_ICON_X}</button>`;
  if (bump && !reduceMotion) SX_EL.animate([{ transform: "translateX(-50%) scale(1)" }, { transform: "translateX(-50%) scale(1.06)" }, { transform: "translateX(-50%) scale(1)" }], { duration: 320, easing: "cubic-bezier(.3,1.35,.5,1)" });
}
// screens come and go inside #app: keep the pill in step (hidden on the set page itself)
(() => {
  const host = document.getElementById("app");
  if (host && "MutationObserver" in window) new MutationObserver(() => sxSync()).observe(host, { childList: true });
  setTimeout(() => sxSync(), 0);
})();

// ---------- the picker sheet ----------
// anchor: the color you're pairing. o: { name, onPick(hex) } (without onPick, one tap opens the page).
function sxPick(anchor, o = {}) {
  anchor = sxHex(anchor);
  if (!anchor) return;
  if (typeof CORE_NAMES !== "undefined" && !CORE_NAMES) return void loadCoreNames().then(() => sxPick(anchor, o), () => sxPick(anchor, o));
  const name = o.name || sxNm(anchor), others = sxTray().filter(h => de2000(h, anchor) >= 1);
  const opt = (h, sub, n) => `<button class="sx-opt" data-sx-hex="${h}"><i style="--c:${h}"></i><b>${esc(n || sxNm(h))}</b>${sub ? `<span>${esc(sub)}</span>` : ""}</button>`;
  const row = (title, html, more = "") => html ? `<section class="sx-sec"><h3>${title}</h3>${more}<div class="sx-rail">${html}</div></section>` : "";
  const harm = [[180, "Opposite"], [120, "Triad"], [240, "Triad"], [30, "Neighbor"], [-30, "Neighbor"], [150, "Split"], [210, "Split"]];
  const chroma = lch(anchor)[1];
  const harmHTML = chroma < 8 ? "" : harm.map(([d, t]) => { const h = rotateHue(anchor, d); return de2000(h, anchor) < 4 ? "" : opt(h, t); }).join("");
  const alike = (typeof lookalikes === "function" ? lookalikes({ n: nameOf(anchor).n, h: anchor }, 8) : []).map(x => x.x || x).filter(x => x && x.h);
  const favs = typeof fvStore === "function" ? Object.keys(fvStore()).slice(-12).reverse().map(sxHex).filter(h => h && de2000(h, anchor) >= 1) : [];
  const recent = typeof trail === "function" ? trail(14).filter(x => x.kind === "color" && x.colors[0]).map(x => x.colors[0].h).map(sxHex).filter(h => h && de2000(h, anchor) >= 1) : [];
  // David, 2026-10-09: "the visualization [is] too small" and "I scroll past the preview so I can't see it
  // anymore" — the preview (sx-head + the big try-on swatch) sits outside the scrolling area entirely, sheet()'s
  // own supported pattern for a sheet with a non-scrolling top and a scrolled body ([data-sheet-scroll], already
  // used by js/home.js's chooser sheet): simpler and more reliably "stays put" than position:sticky inside a
  // position:fixed sheet, which some engines get wrong.
  const { sh, close } = sheet(`
    <div class="sx-head"><i style="--c:${anchor}"></i><div><p class="eyebrow">${o.title ? "Add a color to" : "Pair with…"}</p><h2>${esc(o.title || name)}</h2></div></div>
    <div class="sx-try" data-sx-try></div>
    <div class="sx-scroll" data-sheet-scroll>
    ${others.length && !o.onPick ? `<button class="sx-addset" data-sx-addset><span class="sx-tray-sw">${others.map(h => `<i style="--c:${h}"></i>`).join("")}<i style="--c:${anchor}"></i></span><span><b>Add to your set</b><small>${others.length + 1} colors: ${esc(others.map(sxNm).slice(0, 3).join(", "))}${others.length > 3 ? "…" : ""} and ${esc(name.toLowerCase())}</small></span>${ICON.arrow}</button>` : ""}
    <label class="sx-search"><input type="search" placeholder="Search any color name" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Search any color name" data-sx-q></label>
    <div class="sx-results" data-sx-results hidden></div>
    <div data-sx-sugs>
      ${row("In harmony", harmHTML, `<p class="sx-sub">On the perceptual wheel. A painter's wheel puts opposites elsewhere.</p>`)}
      <div data-sx-aff></div>
      ${row("Look-alikes", alike.slice(0, 8).map(x => opt(x.h, "", x.n)).join(""))}
      ${row("Your colors", favs.slice(0, 10).map(h => opt(h)).join(""))}
      ${row("Recently seen", [...new Set(recent)].slice(0, 10).map(h => opt(h)).join(""))}
    </div>
    <button class="sx-any" data-sx-any><span class="sx-any-ring"></span><span><b>Any color</b><small>Pick it on the ring</small></span></button>
    <div class="sx-picker" data-sx-picker hidden></div>
    <button class="btn solid sx-use" data-sx-use hidden>Try this color</button>
    <button class="sx-any" data-sx-cam>${SX_ICON_CAM}<span><b>Point your camera</b><small>Add colors one after another, from what's in front of you</small></span></button>
    <button class="sx-any" data-sx-photo>${SX_ICON_PHOTO}<span><b>From a photo</b><small>Tap any spot for its exact color</small></span></button>
    </div>`);
  sh.classList.add("sx-sheet", "sx-pick-sheet");
  // the set as it stands (the anchor, plus anything already in the tray): what the try-on strip shows beside the
  // dashed trying slot. A candidate never commits on its own tap; Add does (sxTryAdd), Cancel clears the trial.
  const buildSet = others.length ? [...others, anchor] : [anchor];
  let trying = null;
  const tryBox = sh.querySelector("[data-sx-try]");
  // David, 2026-10-09: "too small; make the visualization bigger" and "keep the preview on top while scrolling" —
  // a real split swatch (not a row of small chips), sticky to the top of the sheet (its own opaque background,
  // so the candidate list never shows through) while you keep browsing suggestions underneath. It shrinks a
  // little once you've scrolled a bit, so it never eats the whole screen, but the color and the actions stay put.
  const paintTry = () => {
    const full = trying ? [...buildSet, trying] : buildSet, against = buildSet[buildSet.length - 1];
    const seg = (h, cls) => `<div class="sx-try-seg${cls ? " " + cls : ""}" style="--c:${h}"${cls === "trying" ? ' data-sx-trying' : ""}><b>${esc(sxNm(h))}</b></div>`;
    tryBox.innerHTML = `<div class="sx-try-big">${buildSet.map(h => seg(h)).join("")}${
      trying ? seg(trying, "trying") : `<div class="sx-try-seg empty" data-sx-trying aria-label="Trying nothing yet"><span>+</span></div>`}</div>
      ${trying ? `<p class="sx-try-rel">${esc(sxRelLine(against, trying))}</p>
      <div class="sx-try-acts"><button class="btn ghost" data-try-cancel>Cancel</button><button class="btn solid" data-try-add ${full.length > SX_MAX ? "disabled" : ""}>Add</button></div>` : ""}`;
  };
  const setTrying = h => { h = sxHex(h); if (!h || buildSet.some(x => de2000(x, h) < 1)) return; trying = h; buzz(6); paintTry(); };
  const cancelTrying = () => { trying = null; paintTry(); };
  const addTrying = () => {
    if (!trying) return;
    buzz(10); lsSfx2("sfxChord", [...buildSet, trying]);
    const h = trying; close();
    if (o.onPick) return o.onPick(h);
    sxOpen(sxSetTray([...buildSet, h]));
  };
  // sfxChord lives in js/sound.js, loaded after this file in some screens; guard the same way js/learnset.js does
  const lsSfx2 = (fn, ...a) => { try { if (typeof window[fn] === "function") window[fn](...a); } catch (e) {} };
  paintTry();
  const scrollBox = sh.querySelector("[data-sheet-scroll]");
  scrollBox.addEventListener("scroll", () => tryBox.classList.toggle("collapsed", scrollBox.scrollTop > 36), { passive: true });
  const pick = h => {
    h = sxHex(h); if (!h) return;
    setTrying(h);
  };
  // painters' pairs: the affinity table (counted over the museum photographs)
  if (typeof ciAffinity === "function") ciAffinity(nameOf(anchor).n).then(aff => {
    const box = sh.querySelector("[data-sx-aff]"); if (!box || !aff || !aff.c || !aff.c.length) return;
    const list = aff.c.filter(([, h, k]) => k >= 5 && de2000(h, anchor) >= 4).slice(0, 8);
    box.innerHTML = row("Painters pair it with", list.map(([n, h, k, l]) => opt(h, `${l >= 10 ? Math.round(l) : l.toFixed(1)}× chance`, n)).join(""), `<p class="sx-sub">Together in paintings more often than chance, as photographed.</p>`);
  }).catch(() => {});
  // search any of the ~1,000 names (and their "also called")
  const q = sh.querySelector("[data-sx-q]"), res = sh.querySelector("[data-sx-results]"), sugs = sh.querySelector("[data-sx-sugs]");
  q.addEventListener("input", () => {
    const t = q.value.trim().toLowerCase();
    res.hidden = !t; sugs.hidden = !!t;
    if (!t) return;
    const list = CORE_NAMES || coreFallback(), hit = [];
    for (const e of list) {
      const n = e.n.toLowerCase(), al = (e.also || []).find(a => a.toLowerCase().includes(t));
      const rank = n.startsWith(t) ? 0 : n.includes(" " + t) ? 1 : n.includes(t) ? 2 : al ? 3 : -1;
      if (rank >= 0) hit.push({ e, rank, al });
    }
    hit.sort((a, b) => a.rank - b.rank || a.e.n.length - b.e.n.length);
    res.innerHTML = hit.length ? `<div class="sx-list">${hit.slice(0, 14).map(({ e, al }) => `<button class="sx-li" data-sx-hex="${e.h}"><i style="--c:${e.h}"></i><b>${esc(e.n)}</b>${al ? `<span>also ${esc(al)}</span>` : ""}</button>`).join("")}</div>`
      : `<p class="sx-none">No name has “${esc(q.value.trim())}” in it. Try a shorter word, or pick any color below.</p>`;
  });
  let picker = null, cur = null;
  sh.addEventListener("click", e => {
    const b = e.target.closest("[data-sx-hex]");
    if (b) return pick(b.dataset.sxHex);
    if (e.target.closest("[data-sx-addset]")) { buzz(8); close(); const set = sxSetTray([...others, anchor]); return sxOpen(set); }
    if (e.target.closest("[data-sx-any]")) {
      const box = sh.querySelector("[data-sx-picker]"), use = sh.querySelector("[data-sx-use]");
      box.hidden = !box.hidden; use.hidden = box.hidden;
      if (!box.hidden && !picker && typeof colorPicker === "function") picker = colorPicker(box, { hex: rotateHue(anchor, 180), onChange: h => { cur = h; use.textContent = `Try ${sxNm(h).toLowerCase()}`; } });
      if (!box.hidden && picker) { cur = picker.get(); use.textContent = `Try ${sxNm(cur).toLowerCase()}`; box.scrollIntoView({ block: "nearest", behavior: reduceMotion ? "auto" : "smooth" }); }
      buzz(5); return;
    }
    if (e.target.closest("[data-sx-use]") && cur) return setTrying(cur);
    if (e.target.closest("[data-try-cancel]")) { buzz(5); return cancelTrying(); }
    if (e.target.closest("[data-try-add]")) return addTrying();
    if (e.target.closest("[data-sx-cam]")) { buzz(6); close(); return sxCameraFlow(buildSet, o); }
    if (e.target.closest("[data-sx-photo]")) { buzz(6); close(); return sxPhotoFlow(buildSet, o); }
  });
  sh.querySelector("[data-sx-picker]").addEventListener("pointerdown", e => e.stopPropagation());
  return { sh, close };
}

// ---------- building a set from the camera or a photo (David, 2026-10-09) ----------
// Point your camera: pick a color, it's added, you're back at the camera for the next one, the growing set shows
// as a strip; Done opens the set page. The camera picker itself (exact-pixel sampling, multi-pick, the strip, the
// Done button) is a separate lane's build — this just feature-detects what it exposes, `cameraPick({onPick,
// multi:true})`, resolving to the final hexes once Done is tapped. Until that ships, the honest fallback is the
// camera screen the app already has, one color at a time.
function sxCameraFlow(start, o = {}) {
  const addOne = h => { h = sxHex(h); if (!h) return; if (o.onPick) return o.onPick(h); sxAdd(h, { quiet: true }); };
  const finish = hexes => {
    if (Array.isArray(hexes)) hexes.forEach(addOne);
    if (o.onPick) return;
    const set = sxTray().length ? sxTray() : start;
    if (set.length >= 2) sxOpen(set);
  };
  if (typeof window.cameraPick === "function") {
    if (!o.onPick) { S.setTray = start.slice(); save(); sxSync(); }
    const r = window.cameraPick({ multi: true, anchor: start[start.length - 1], onPick: addOne, onDone: finish });
    if (r && typeof r.then === "function") r.then(finish).catch(() => {});
    return;
  }
  toast("Camera picking for a whole set is coming soon — opening the camera for one color.");
  if (typeof eye === "function") eye();
}
// From a photo: tap any spot on an uploaded photo for its exact pixel color (up to a 2×2 patch, never a wider
// averaged area — this is "what's really there", not a guess), added straight to the set; tap more spots, then
// Done. Self-contained here rather than routed through "Name any color" (js/namer.js), which doesn't return a
// pick today — David's note said to reuse that flow only if it can hand colors back; it can't yet.
function sxPhotoFlow(start, o = {}) {
  const input = document.createElement("input");
  input.type = "file"; input.accept = "image/*"; input.hidden = true;
  document.body.appendChild(input);
  input.onchange = () => {
    const f = input.files[0]; input.remove();
    if (!f) return;
    const img = new Image();
    img.onload = () => { const src = img.src; sxPhotoSheet(img, start, o); URL.revokeObjectURL(src); };
    img.onerror = () => toast("That photo didn't load");
    img.src = URL.createObjectURL(f);
  };
  input.click();
}
// Press, drag and release (the shared eyedropper, js/eyedrop.js): the loupe does the magnified, finger-clear
// reading, Point/3x3/5x5/11x11/31x31 is whatever Settings has it set to, and a pick is only committed on
// release — the old version only ever read a fixed 2x2 patch on a plain tap, with no loupe and no drag.
function sxPhotoSheet(img, start, o = {}) {
  const picked = start.slice();
  const { sh, close } = sheet(`
    <div class="sx-head"><div><p class="eyebrow">From a photo</p><h2>Press a spot for its color</h2></div></div>
    <div class="sx-photo-wrap" data-sx-photo-wrap><img class="sx-photo-img" src="${img.src}" alt="" data-sx-photo-img><i class="sx-photo-pin" data-sx-photo-pin hidden></i></div>
    <p class="sx-sub" data-sx-photo-cap>Press and drag to find the exact spot — tap again for another.</p>
    <div class="sx-try-row" data-sx-photo-strip></div>
    <button class="btn solid sx-use" data-sx-photo-done>Done${picked.length ? ` · ${picked.length}` : ""}</button>`);
  sh.classList.add("sx-sheet");
  const paintStrip = () => {
    sh.querySelector("[data-sx-photo-strip]").innerHTML = picked.map(h => `<div class="sx-try-sw" style="--c:${h}"><b>${esc(sxNm(h))}</b></div>`).join("");
    sh.querySelector("[data-sx-photo-done]").textContent = picked.length >= 2 ? `Done · ${picked.length} colors` : "Done";
  };
  paintStrip();
  const im = sh.querySelector("[data-sx-photo-img]"), pin = sh.querySelector("[data-sx-photo-pin]");
  const place = (hex, p) => { pin.hidden = false; pin.style.left = (p.x / im.naturalWidth * 100) + "%"; pin.style.top = (p.y / im.naturalHeight * 100) + "%"; pin.style.setProperty("--c", hex); };
  eyedropAttach(im, {
    onMove: place,
    onPick: (hex, p) => {
      place(hex, p); buzz(8);
      if (o.onPick) { o.onPick(hex); toast(`${sxNm(hex)} picked`); return; }
      if (sxHas(picked, hex)) { toast(`${sxNm(hex)} is already in your set`); return; }
      if (picked.length >= SX_MAX) { toast(`A set holds up to ${SX_MAX} colors`); return; }
      picked.push(hex); paintStrip();
      toast(`${sxNm(hex)} added · ${picked.length} in your set`);
    },
  });
  sh.querySelector("[data-sx-photo-done]").onclick = () => {
    buzz(10); close();
    if (o.onPick) return;
    if (picked.length < 2) return toast("Tap at least one more spot to make a pair");
    sxOpen(sxSetTray(picked));
  };
}

// Findable by search (design/SIMPLIFY/PLAN.md §9's feature index): these already live one tap from a color
// page's own "Pair with…" button, which carries the anchor color sxPick needs -- without one, the honest
// answer is to send the visitor there rather than guess a color for them.
if (typeof featureRegister === "function") {
  featureRegister("pair-with", { t: "Pair with…", where: "A color · Pair with…", words: ["pair", "combine", "match", "harmony", "set"], run: () => toast("Open a color, then tap Pair with…") });
  featureRegister("pair-camera", { t: "Point your camera", where: "Pair with… · Point your camera", words: ["camera", "live color", "eyedropper"], run: () => toast("Open a color, then Pair with… · Point your camera") });
  featureRegister("pair-photo", { t: "From a photo", where: "Pair with… · From a photo", words: ["photo", "picture", "eyedropper"], run: () => toast("Open a color, then Pair with… · From a photo") });
}
