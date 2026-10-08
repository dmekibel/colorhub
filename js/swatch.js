"use strict";
// ROADMAP.md §13: every color swatch in the app is tappable. One delegated handler opens the swatch's own
// color PAGE for any element carrying data-swatch="#rrggbb" — a painting palette chip, a fashion tile, a
// camera reading, a Studio photo palette, a taste result... wherever a swatch is drawn, adding that one
// attribute makes it tappable; nothing else to wire up per screen.
//
// David, 2026-10-07 ("I hate that if you press on a color, you have to press a second time 'open page'"):
// one tap goes straight to the page. There's no middle sheet step any more (nameSheet() below still exists —
// boot.js's swsheet shot keeps it reachable for design review — but nothing wires a plain tap to it).
//
// Priority: an existing [data-node] or [data-nb] tap (open a color page, compare a pair) and any plain link
// keep first refusal, and a swatch living inside one of those never double-fires (capture phase + stopPropagation,
// the same pattern js/lookalikes.js already uses for [data-nb]).
//
// A tapped hex rarely lands on a taught/named color exactly (a painting pixel, a photo swatch, a camera
// reading): openTappedColor opens the nearest name's page either way, but when the match isn't close enough
// to call it that name outright, it carries the exact tapped color along (colorPage/namePage's optional
// `tapped` argument, and `?c=<hex>` in the address — js/router.js — so Back and a shared link reproduce the
// same "Your color" view, not just the named color on its own).
function openTappedColor(hex) {
  hex = String(hex).toUpperCase();
  const nm = nameOf(hex);
  if (!nm.n) return;
  const exact = nm.de < VERY_CLOSE_DE && !nm.between;
  const tapped = exact ? null : hex;
  const taught = BYNAME.get(nm.n.toLowerCase());
  buzz(6);
  if (taught) return openNode(colorNode(taught), true, tapped);
  const entry = (CORE_NAMES || coreFallback()).find(e => e.n.toLowerCase() === nm.n.toLowerCase()) || { n: nm.n, h: nm.h, src: ["app"], rank: null };
  namePage(entry, true, tapped);
}
document.addEventListener("click", e => {
  const sw = e.target.closest("[data-swatch]");
  if (!sw || e.target.closest("[data-node],[data-nb],a")) return;
  e.stopPropagation(); e.preventDefault();
  // wait for the ~1,000-word list (a moment, once) so the first tap already names the color precisely
  const hex = sw.dataset.swatch;
  if (typeof CORE_NAMES !== "undefined" && !CORE_NAMES) loadCoreNames().then(() => openTappedColor(hex), () => openTappedColor(hex));
  else openTappedColor(hex);
}, true);

// The color link sheet (DESIGN-SYSTEM.md §12 "The color sheet"): a hero, the name, a row of near-name
// bubbles (tap one and the sheet becomes that color — js/core.js's morphFrom/runMorph do the growing, since
// this is the one place in the app that already has a hand-marked [data-morph-src] convention to build on;
// there's no separate "growFrom" in core.js, so this reuses that existing chip-flies-into-place system
// rather than inventing a parallel one), one primary action, and ΔE/"Also called" behind Details. Only one
// near-name list now (no second "look-alikes among the 101" list duplicating it — research/DESIGN-AUDIT.md
// problem #9): the nearest 1-2 of the 101 still get a quiet line, since those are the ones with a full story.
function nameSheet(hex) {
  hex = String(hex).toUpperCase();
  const nm = nameOf(hex);
  if (!nm.n) return;
  const taught = BYNAME.get(nm.n.toLowerCase());
  const exact = !!taught && nm.de < VERY_CLOSE_DE;
  const also = (nm.near[0] && nm.near[0].entry && nm.near[0].entry.also) || [];
  const notes = (nm.near[0] && nm.near[0].entry && nm.near[0].entry.notes) || [];
  const newWord = !nm.met && !nm.between;
  // "Between X and Y" (or a modifier like "Pale salmon") is a description, never the title: the title is
  // always the one real name (nm.n); the fuller reading sits underneath as a note.
  const descLine = nm.between ? `Between ${esc(nm.between.a.toLowerCase())} and ${esc(nm.between.b.toLowerCase())}` : nm.mod ? esc(nm.text) : "";
  // every one of the ~1,000 colors should still lead to a deep article: the nearest 1-2 of the 101 taught
  // colors (the ones with full pages) get one quiet line, even when the sheet's own name isn't among them.
  const noteLine = "";   // no "closest of the 101" line (David: the 101 aren't a special list)
  const hasName = !nm.between;
  const { sh, close } = sheet(`
    <div class="pk-hero" style="--c:${hex}" data-ink="${ink(hex)}" data-morph-src></div>
    <div class="cp-sheet-title"><h2>${esc(nm.n)}</h2><span class="mono">${hex}</span>${newWord ? `<span class="cp-sheet-tag">New word</span>` : ""}</div>
    ${descLine ? `<p class="cp-sheet-desc">${descLine}</p>` : ""}
    ${noteLine ? `<p class="cp-sheet-note">${noteLine}</p>` : ""}
    <div class="cp-near-row" data-sw-near>${nm.near.slice(0, 4).map((x, i) => `<button class="cp-near" data-sw-i="${i}"><i style="--c:${x.h}"></i><span>${esc(x.n)}</span></button>`).join("")}</div>
    <button class="cp-primary cp-sheet-primary" data-sw-open>${hasName ? `Open ${esc(nm.n)}` : "Paintings with this color"}${ICON.arrow}</button>
    <div class="cp-sheet-links">
      ${exact && typeof hmLearnIt === "function" ? `<button class="cp-link" data-sw-learn>Learn it</button>` : ""}
      ${hasName && typeof galleryOpenColor === "function" ? `<button class="cp-link" data-sw-ptgs>Paintings in ${esc(nm.n.toLowerCase())}</button>` : ""}
      <button class="cp-link" data-sw-copy>Copy hex</button>
    </div>
    ${also.length || notes.length ? `<details class="cp-details"><summary><span>Details</span><i></i></summary><div class="cp-details-body">
        <p>${closeness(nm.de)} to ${esc(nm.n)} · ${pctDiff(nm.de)}</p>
        ${also.length ? `<p>Also called ${also.map(esc).join(", ")}.</p>` : ""}
        ${notes.length ? `<p>${jpNoteLine(notes)}</p>` : ""}
      </div></details>` : ""}
    <p class="fine">Nearest of about 1,000 primary names (CIEDE2000). Hex values are screen approximations.</p>`);
  sh.classList.add("sw-sheet");
  // the near-name bubbles reopen this same sheet for the tapped color (walking from one name to a neighbor),
  // not a full page: morphFrom()/runMorph() (js/core.js) only fly a chip into a page rendered by show(), so a
  // sheet-to-sheet hop here just closes and reopens — the sheet's own slide animates it instead.
  sh.querySelectorAll("[data-sw-i]").forEach(b => b.onclick = () => { const x = nm.near[+b.dataset.swI]; close(); nameSheet(x.h); });
  const openBtn = sh.querySelector("[data-sw-open]");
  if (openBtn) openBtn.onclick = () => {
    morphFrom(sh.querySelector(".pk-hero"));
    close();
    if (hasName) openCoreName(nm.h, nm.n); else if (typeof galleryOpenColor === "function") galleryOpenColor(hex, nm.text || nm.n);
  };
  const learnBtn = sh.querySelector("[data-sw-learn]"); if (learnBtn) learnBtn.onclick = () => { morphFrom(sh.querySelector(".pk-hero")); close(); hmLearnIt(taught); };
  const ptgBtn = sh.querySelector("[data-sw-ptgs]"); if (ptgBtn) ptgBtn.onclick = () => { close(); galleryOpenColor(hex, nm.text || nm.n); };
  sh.querySelector("[data-sw-copy]").onclick = () => { try { navigator.clipboard.writeText(hex); toast("Copied " + hex); } catch (e) {} };
  buzz(6);
  if (!CORE_NAMES) loadCoreNames();   // the next sheet shows the real ~1,000-word nearest list, not just the 101
}

// Graph links ([data-to]) on pages that don't wire their own (name pages: "In gems", "In flowers"…). Pages that do
// handle [data-to] call preventDefault first, so this bubble-phase fallback only fires where nothing else did
// (David: tapping Spinel under "In gems" on Fiery Rose did nothing).
document.addEventListener("click", e => {
  if (e.defaultPrevented) return;
  const a = e.target.closest("[data-to]");
  if (!a || a.closest("[data-swatch]") && e.target.closest("[data-swatch]") !== a) return;
  const id = a.dataset.to || "";
  e.preventDefault();
  // keep the trail (no XSTACK reset), so Back returns to the color page you came from
  if (id.startsWith("gm:") && typeof gmWhen === "function") return gmWhen(() => { const n = gmNode(id); if (n) openNode(n); });
  const go = () => { const n = typeof graph === "function" && graph().nodes.get(id); if (n && typeof openNode === "function") openNode(n); };
  if (typeof loadWiki === "function") loadWiki().then(go, go); else go();
});
