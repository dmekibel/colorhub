"use strict";
// The Family section (David, 2026-10-09): the old 3-row honeycomb ("usually one hex above a line of siblings, no
// visible structure") becomes a small segmented switch with four legible views, remembered per viewer.
// Called from js/article.js arBuildHTML in place of the old arTreeHTML; same data (aside.parent/siblings/children),
// plus an optional pinned relative (the cover's "Almost the same as X" line routes here). Top-level names start
// with fam, per tools/check_names.js's one-global-scope rule.

const FAM_VIEW_KEY = "colorhub-fam-view";
const FAM_VIEWS = [["tree", "Tree"], ["spectrum", "Spectrum"], ["compare", "Compare"], ["map", "Map"]];
function famGetView() { try { const v = localStorage.getItem(FAM_VIEW_KEY); return FAM_VIEWS.some(x => x[0] === v) ? v : "tree"; } catch (e) { return "tree"; } }
function famSetView(v) { try { localStorage.setItem(FAM_VIEW_KEY, v); } catch (e) {} }

// one row's label, dropped when empty
const FAM_ROW_LABEL = { parent: "Comes from", mid: "Same color, other names", child: "Variations" };
function famTreeHTML(self, P, Sb, Ch) {
  if (!P.length && !Sb.length && !Ch.length) return `<p class="fine fam-empty">No recorded relatives yet.</p>`;
  const row = (items, cls, label) => items.length ? `<div class="fam-trow">
      <p class="fam-trow-l">${esc(label)}</p>
      <div class="fam-trow-hex${cls ? " " + cls : ""}">${items.map(c => arHexHTML(c)).join("")}</div>
    </div>` : "";
  const mid = `<div class="fam-trow fam-trow-mid"><p class="fam-trow-l">${esc(FAM_ROW_LABEL.mid)}</p><div class="fam-trow-hex">${Sb.slice(0, Math.ceil(Sb.length / 2)).map(c => arHexHTML(c)).join("")}${arHexHTML(self, { self: true })}${Sb.slice(Math.ceil(Sb.length / 2)).map(c => arHexHTML(c)).join("")}</div></div>`;
  return `<div class="fam-tree" role="group" aria-label="Family tree">
    ${row(P, "", FAM_ROW_LABEL.parent)}
    ${(P.length && (Sb.length || Ch.length)) ? `<i class="fam-line" aria-hidden="true"></i>` : ""}
    ${mid}
    ${(Ch.length && (P.length || Sb.length)) ? `<i class="fam-line" aria-hidden="true"></i>` : ""}
    ${row(Ch, "", FAM_ROW_LABEL.child)}
  </div>
  <p class="fine fam-note">Filled means yours, outlined means you've met it, dim means not yet.</p>`;
}
function famSpectrumHTML(self, all) {
  if (!all.length) return `<p class="fine fam-empty">No recorded relatives yet.</p>`;
  return `<div class="fam-spec-head"><p class="fam-spec-h">Sorted</p>
      <div class="fam-seg fam-seg-sm" role="group" aria-label="Sort by"><button type="button" class="fam-seg-b on" data-fam-sort="light">Lightness</button><button type="button" class="fam-seg-b" data-fam-sort="hue">Hue</button></div></div>
    <div class="fam-spec-strip" data-fam-strip></div>`;
}
function famSpecRow(self, all, sort) {
  const list = [{ ...self, self: true }, ...all];
  const key = c => { const [L, , H] = lch(c.h); return sort === "hue" ? H : -L; };
  list.sort((a, b) => key(a) - key(b));
  return list.map(c => c.self ? `<div class="fam-spec-c self" aria-current="true" style="--c:${c.h}" data-ink="${ink(c.h)}"><i></i><b>${esc(c.n)}</b></div>`
    : `<button type="button" class="fam-spec-c" data-know="${arKnow(c)}" data-ar-open="${esc(c.slug)}" style="--c:${c.h}" data-ink="${ink(c.h)}"><i></i><b>${esc(c.n)}</b></button>`).join("");
}
// Compare: self beside its closest 2-4 relatives (the family set, plus an optional pinned look-alike from the
// cover), nearest first; the first pair is a draggable split, the rest plain rows with the measured sentence.
function famCompareHTML(self, all, pin) {
  const pool = [...all]; if (pin && !pool.some(c => c.slug === pin.slug)) pool.unshift(pin);
  const list = pool.map(c => ({ c, d: de2000(self.h, c.h) })).sort((a, b) => a.d - b.d).slice(0, 4);
  if (!list.length) return `<p class="fine fam-empty">No close relative to compare yet.</p>`;
  const [first, ...rest] = list;
  const diffLine = (c, d) => `${esc(rpCapWord(lookDiff(self, c)))} than ${esc(self.n.toLowerCase())}, ${esc(pctDiff(d))}.`;
  return `<div class="fam-cmp-split" data-fam-split data-a="${self.h}" data-b="${first.c.h}">
      <div class="fam-cmp-half fam-cmp-a" style="--c:${self.h}" data-ink="${ink(self.h)}"><b>${esc(self.n)}</b></div>
      <div class="fam-cmp-half fam-cmp-b" style="--c:${first.c.h}" data-ink="${ink(first.c.h)}"><b>${esc(first.c.n)}</b></div>
      <button type="button" class="fam-cmp-handle" aria-label="Drag to compare" style="left:50%"><i></i></button>
    </div>
    <p class="fam-cmp-line">${diffLine(first.c, first.d)}</p>
    <button type="button" class="fam-cmp-open" data-ar-open="${esc(first.c.slug)}">See ${esc(first.c.n)}${typeof ICON !== "undefined" ? ICON.arrow : ""}</button>
    ${rest.length ? `<div class="fam-cmp-rows">${rest.map(({ c, d }) => `<button type="button" class="fam-cmp-row" data-ar-open="${esc(c.slug)}">
        <span class="fam-cmp-row-sw"><i style="--c:${self.h}"></i><i style="--c:${c.h}"></i></span>
        <span class="fam-cmp-row-tx"><b>${esc(c.n)}</b><span>${diffLine(c, d)}</span></span></button>`).join("")}</div>` : ""}`;
}
function famMapHTML() { return `<button type="button" class="fam-map-btn" data-fam-map>See them on the map${typeof ICON !== "undefined" ? ICON.arrow : ""}</button>`; }
const rpCapWord = s => s.charAt(0).toUpperCase() + s.slice(1);

// self: {n,h,slug}. aside: art.aside. pin: an optional {n,h,slug} (the cover's near-neighbor) to feature in Compare.
// disambHTML: "Not to be confused with" (js/article.js arDisambHTML), folded in here rather than its own section.
function famHTML(self, aside, pin, disambHTML) {
  const P = arList(aside.parent).map(arColor).filter(Boolean).slice(0, 4);
  const Sb = arList(aside.siblings).map(arColor).filter(c => c && c.slug !== self.slug).slice(0, 6);
  const Ch = arList(aside.children).map(arColor).filter(Boolean).slice(0, 4);
  const all = [...P, ...Sb, ...Ch].filter((c, i, a) => a.findIndex(x => x.slug === c.slug) === i);
  if (!all.length && !pin && !disambHTML) return "";
  const v0 = famGetView();
  const id = "fam-" + Math.random().toString(36).slice(2, 8);
  return `<section class="ar-fam" id="ar-s-family" data-fam="${id}">
    <h2>Family</h2>
    ${all.length || pin ? `<div class="fam-seg" role="tablist" aria-label="Family view">${FAM_VIEWS.map(([k, t]) => `<button type="button" class="fam-seg-b${k === v0 ? " on" : ""}" role="tab" aria-selected="${k === v0}" data-fam-view="${k}">${t}</button>`).join("")}</div>
    <div class="fam-panel" data-fam-panel></div>` : ""}
    ${disambHTML || ""}
  </section>`;
}
function famWire(root, self, aside, pin) {
  const sec = root.querySelector(".ar-fam[data-fam]"); if (!sec) return;
  const panel = sec.querySelector("[data-fam-panel]"); if (!panel) return;
  const P = arList(aside.parent).map(arColor).filter(Boolean).slice(0, 4);
  const Sb = arList(aside.siblings).map(arColor).filter(c => c && c.slug !== self.slug).slice(0, 6);
  const Ch = arList(aside.children).map(arColor).filter(Boolean).slice(0, 4);
  const all = [...P, ...Sb, ...Ch].filter((c, i, a) => a.findIndex(x => x.slug === c.slug) === i);
  let sort = "light";
  const drawSplit = (box) => {
    const split = box.querySelector("[data-fam-split]"); if (!split) return;
    const handle = split.querySelector(".fam-cmp-handle"), b = split.querySelector(".fam-cmp-b"); if (!handle || !b) return;
    const set = pct => { pct = Math.max(2, Math.min(98, pct)); handle.style.left = pct + "%"; b.style.clipPath = `inset(0 0 0 ${pct}%)`; };
    let dragging = false;
    const move = x => { const r = split.getBoundingClientRect(); set((x - r.left) / r.width * 100); };
    handle.addEventListener("pointerdown", e => { dragging = true; try { handle.setPointerCapture(e.pointerId); } catch (er) {} });
    handle.addEventListener("pointermove", e => { if (dragging) move(e.clientX); });
    ["pointerup", "pointercancel"].forEach(ev => handle.addEventListener(ev, () => dragging = false));
    split.addEventListener("click", e => { if (e.target === handle || handle.contains(e.target)) return; move(e.clientX); });
  };
  const draw = view => {
    if (view === "tree") panel.innerHTML = famTreeHTML(self, P, Sb, Ch);
    else if (view === "spectrum") { panel.innerHTML = famSpectrumHTML(self, all); const strip = panel.querySelector("[data-fam-strip]"); if (strip) strip.innerHTML = famSpecRow(self, all, sort); }
    else if (view === "compare") { panel.innerHTML = famCompareHTML(self, all, pin); drawSplit(panel); }
    else panel.innerHTML = famMapHTML();
  };
  draw(famGetView());
  sec.querySelectorAll("[data-fam-view]").forEach(b => b.onclick = () => {
    sec.querySelectorAll("[data-fam-view]").forEach(x => { x.classList.toggle("on", x === b); x.setAttribute("aria-selected", x === b); });
    famSetView(b.dataset.famView); draw(b.dataset.famView);
  });
  if (!panel.__famWired) {
    panel.__famWired = true;
    panel.addEventListener("click", e => {
      const s = e.target.closest("[data-fam-sort]"); if (s) { sort = s.dataset.famSort; panel.querySelectorAll("[data-fam-sort]").forEach(x => x.classList.toggle("on", x === s)); const strip = panel.querySelector("[data-fam-strip]"); if (strip) strip.innerHTML = famSpecRow(self, all, sort); return; }
      const m = e.target.closest("[data-fam-map]"); if (m && typeof csOnMap === "function" && typeof colorSet === "function") csOnMap(colorSet({ kind: "color", id: self.slug, title: self.n, colors: [self, ...all].map(c => ({ h: c.h, n: c.n })) }));
    });
  }
}
// a page can ask Family to open straight to Compare, pinned on a given relative (the cover's near-neighbor line)
function famOpenCompare(root, self, aside, relSlug, relHex) {
  famSetView("compare");
  const sec = root.querySelector(".ar-fam[data-fam]"); if (!sec) return;
  sec.querySelectorAll("[data-fam-view]").forEach(x => { const on = x.dataset.famView === "compare"; x.classList.toggle("on", on); x.setAttribute("aria-selected", on); });
  famWire(root, self, aside, relSlug ? { slug: relSlug, h: relHex, n: arColor(relSlug) ? arColor(relSlug).n : relSlug } : null);
  sec.scrollIntoView({ block: "start", behavior: typeof reduceMotion !== "undefined" && reduceMotion ? "auto" : "smooth" });
}
