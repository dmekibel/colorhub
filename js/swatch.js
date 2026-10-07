"use strict";
// ROADMAP.md §13: every color swatch in the app is tappable. One delegated handler opens the color link sheet
// for any element carrying data-swatch="#rrggbb" — a painting palette chip, a fashion tile, a camera reading,
// a Studio photo palette, a taste result... wherever a swatch is drawn, adding that one attribute makes it
// tappable; nothing else to wire up per screen.
//
// Priority: an existing [data-node] or [data-nb] tap (open a color page, compare a pair) and any plain link
// keep first refusal, and a swatch living inside one of those never double-fires (capture phase + stopPropagation,
// the same pattern js/lookalikes.js already uses for [data-nb]).
document.addEventListener("click", e => {
  const sw = e.target.closest("[data-swatch]");
  if (!sw || e.target.closest("[data-node],[data-nb],a")) return;
  e.stopPropagation(); e.preventDefault();
  // wait for the ~1,000-word list (a moment, once) so the first tap already names the color precisely
  const hex = sw.dataset.swatch;
  if (typeof CORE_NAMES !== "undefined" && !CORE_NAMES) loadCoreNames().then(() => nameSheet(hex), () => nameSheet(hex));
  else nameSheet(hex);
}, true);

const swCloseness = de => de < VERY_CLOSE_DE ? "very close" : de < NEAR_DE ? "close" : "near";

// The color link sheet: nameOf()'s reading of the color, the nearest 3-5 core words (each tappable, so you can
// walk from one name to a neighbor), its synonyms, the look-alike ring among the taught 101 (js/lookalikes.js),
// and whatever actions make sense for this particular color.
function nameSheet(hex) {
  hex = String(hex).toUpperCase();
  const nm = nameOf(hex);
  if (!nm.n) return;
  const taught = BYNAME.get(nm.n.toLowerCase());
  const exact = !!taught && nm.de < VERY_CLOSE_DE;
  const also = (nm.near[0] && nm.near[0].entry && nm.near[0].entry.also) || [];
  const likes = typeof lookalikes === "function" ? lookalikes({ n: nm.n, h: hex }, 5) : [];
  // every one of the ~1,000 colors should lead to a deep article: the nearest 1-2 of the 101 taught colors
  // (the ones with full pages) get one quiet line, even when the sheet's own name isn't among them.
  const nearApp = nearestColors(hex, 2).map(([c]) => c);
  const { sh, close } = sheet(`
    <div class="pk-hero" style="--c:${hex}" data-ink="${ink(hex)}"><span class="mono">${hex}</span><h2>${esc(nm.text || nm.n)}</h2>${!nm.met ? `<small>New word</small>` : ""}</div>
    ${nearApp.length ? `<p class="fine sw-close-app">Close to ${nearApp.map(c => `<button class="wl" data-sw-app="${esc(c.n)}">${esc(c.n)}</button>`).join(nearApp.length > 1 ? " and " : "")} · read ${nearApp.length > 1 ? "their stories" : "its story"}</p>` : ""}
    <div class="lk-list" data-sw-near>${nm.near.map((x, i) => `<button class="lk-row" data-sw-i="${i}"><i style="--c:${x.h}"></i><b>${esc(x.n)}</b><span>${swCloseness(x.de)} · ΔE ${x.de.toFixed(1)}</span></button>`).join("")}</div>
    ${also.length ? `<p class="fine">Also called ${also.map(esc).join(", ")}.</p>` : ""}
    ${likes.length ? `<div class="sec-head"><b>Look-alikes</b><span>among the 101 taught colors</span></div>
      <div class="lk-list">${likes.map(o => `<button class="lk-row" data-sw-hex="${o.x.h}" data-sw-name="${esc(o.x.n)}"><i style="--c:${o.x.h}"></i><b>${esc(o.x.n)}</b><span>${esc(lookDiff({ h: hex, n: nm.n }, o.x))}</span></button>`).join("")}</div>` : ""}
    <div class="sw-acts">
      <button class="item" data-sw-open>Open page ${ICON.arrow}</button>
      ${exact && typeof hmLearnIt === "function" ? `<button class="item" data-sw-learn>Learn it ${ICON.arrow}</button>` : ""}
      ${typeof galleryOpenColor === "function" ? `<button class="item" data-sw-ptgs>More paintings with this color ${ICON.arrow}</button>` : ""}
    </div>
    <button class="btn ghost" data-sw-copy>Copy ${hex}</button>
    <p class="fine">Nearest of about 1,000 primary names (CIEDE2000). Hex values are screen approximations.</p>`);
  sh.classList.add("sw-sheet");
  sh.querySelectorAll("[data-sw-app]").forEach(b => b.onclick = () => { const c = BYNAME.get(b.dataset.swApp.toLowerCase()); if (c) { close(); openNode(colorNode(c)); } });
  sh.querySelectorAll("[data-sw-i]").forEach(b => b.onclick = () => { const x = nm.near[+b.dataset.swI]; close(); openCoreName(x.h, x.n); });
  sh.querySelectorAll("[data-sw-hex]").forEach(b => b.onclick = () => { close(); openCoreName(b.dataset.swHex, b.dataset.swName); });
  const openBtn = sh.querySelector("[data-sw-open]"); if (openBtn) openBtn.onclick = () => { close(); openCoreName(nm.h, nm.n); };
  const learnBtn = sh.querySelector("[data-sw-learn]"); if (learnBtn) learnBtn.onclick = () => { close(); hmLearnIt(taught); };
  const ptgBtn = sh.querySelector("[data-sw-ptgs]"); if (ptgBtn) ptgBtn.onclick = () => { close(); galleryOpenColor(hex, nm.text || nm.n); };
  sh.querySelector("[data-sw-copy]").onclick = () => { try { navigator.clipboard.writeText(hex); toast("Copied " + hex); } catch (e) {} };
  buzz(6);
  if (!CORE_NAMES) loadCoreNames();   // the next sheet shows the real ~1,000-word nearest list, not just the 101
}
