"use strict";
// Wiki photographs beyond the text: a "Gallery" strip of thumbnails (each with its caption and credit),
// an "In paintings" strip of the paintings that use a color most, and a full-size viewer. Tap any
// photograph on an article (inline figure or gallery thumbnail) to see it large with caption and credit;
// swipe sideways for the next one, tap or swipe down to close. Data: data/images.js, data/paintings.js.

// figures placed in the text by explore.js: color pages put figure 0 on top and figure i+1 after facet i;
// wiki pages put figure 0 on top, then figure x.img (default i+1) in section i, or figure i after body paragraph i
function wgPlaced(n) {
  if (n.kind === "color" || n.c) { const w = n.wiki; return new Set(Array.from({ length: 1 + (w && w.facets ? w.facets.length : 0) }, (_, i) => i)); }
  const s = new Set([0]);
  if (n.stub) return s;
  if (n.sections && n.sections.length) n.sections.forEach((x, i) => s.add(x.img != null ? x.img : i + 1));
  else (n.body || []).forEach((_, i) => s.add(i));
  return s;
}

const wgCredit = f => `${f.commons ? `<a href="${esc(f.commons)}" target="_blank" rel="noopener">${esc(f.credit || "Wikimedia Commons")}</a>` : esc(f.credit || "")}${f.licenseUrl ? ` · <a href="${esc(f.licenseUrl)}" target="_blank" rel="noopener">License</a>` : ""}`;

// leftover photographs as a horizontal strip
function wgGallery(key, placed) {
  const imgs = ((window.WIKI_IMAGES || {})[key] || []).filter((_, i) => !placed.has(i));
  if (!imgs.length) return "";
  return `<section class="wg"><h3>Gallery</h3><div class="wg-row">${imgs.map(f => `<figure class="wg-it"><button class="wg-th" aria-label="${esc("View: " + (f.alt || f.caption || "photo"))}"><img src="${esc(f.src)}" alt="${esc(f.alt || "")}" loading="lazy"${f.w ? ` width="${f.w}" height="${f.h}"` : ""}></button><figcaption><i class="wg-c">${esc(f.caption || "")}</i><span>${wgCredit(f)}</span></figcaption></figure>`).join("")}</div></section>`;
}

// paintings whose extracted palette holds a color: its own word (vocab) or within dE 10
function wgPaintingHits(hexes, names, n = 8) {
  const nm = new Set(names);
  return (window.PAINTINGS || []).filter(p => p.palette && !p.stub && (p.thumb || p.img)).map(p => {
    let share = 0;
    for (const x of p.palette) if (nm.has(x.vocab) || hexes.some(h => de2000(h, x.h) < 10)) share += x.share;
    return { p, share };
  }).filter(x => x.share > 0.02).sort((a, b) => b.share - a.share).slice(0, n);
}
function wgPaintings(hits, title) {
  if (!hits.length) return "";
  return `<section class="wg"><h3>${esc(title)}</h3><div class="wg-row wg-ptg">${hits.map(x => `<button class="wg-pt" data-node="${esc(x.p.id)}"><img src="${esc(x.p.thumb || x.p.img)}" alt="${esc(x.p.title)}" loading="lazy"><b>${esc(x.p.title)}</b><span>${esc(x.p.artist || "")} · ${Math.max(1, Math.round(x.share * 100))}% of the canvas</span></button>`).join("")}</div></section>`;
}

// the tail of a color page: leftover photos. (The paintings that use the color already have their own row on a color
// page, galleryColorRow in js/gallery.js, so no second paintings strip here.)
function wgColorTail(c, w) {
  return wgGallery(c.n, wgPlaced({ c, wiki: w }));
}
// the tail of a wiki page; pigment pages also get the paintings with the most of the pigment's main color
// (its first swatch; later swatches are variants like darkened or ore colors). This is color, not proof of the pigment.
function wgWikiTail(n) {
  let out = wgGallery(n.id, wgPlaced(n));
  const sw = (n.swatches || [])[0];
  if (n.type === "pigment" && sw) out += wgPaintings(wgPaintingHits([sw.h], []), "Its color in paintings");
  return out;
}

// ---------------------------------------------------------------- full-size viewer
function wgItems(root) {
  return [...root.querySelectorAll(".fig, .wg-it")].map(fg => {
    const im = fg.querySelector("img"), cap = fg.querySelector("figcaption"), cr = cap && cap.querySelector("span");
    const text = cap ? [...cap.childNodes].filter(x => x !== cr).map(x => x.textContent).join("").trim() : "";
    return { img: im, src: im.getAttribute("src"), alt: im.alt, text, credit: cr ? cr.innerHTML : "" };
  }).filter(x => x.src);
}
function wgOpen(items, at) {
  if (!items.length || document.querySelector(".wgv")) return;
  let i = at;
  const box = document.createElement("div");
  box.className = "wgv"; box.setAttribute("role", "dialog"); box.setAttribute("aria-label", "Photograph");
  box.innerHTML = `<div class="wgv-stage"><img alt=""></div><div class="wgv-cap"><p></p><span class="wgv-cr"></span><em class="mono"></em></div><button class="wgv-x" aria-label="Close">×</button>`;
  const im = box.querySelector("img"), p = box.querySelector("p"), cr = box.querySelector(".wgv-cr"), ct = box.querySelector("em");
  const draw = () => { const it = items[i]; im.src = it.src; im.alt = it.alt; p.textContent = it.text; cr.innerHTML = it.credit; ct.textContent = items.length > 1 ? `${i + 1} / ${items.length}` : ""; };
  draw();
  document.body.appendChild(box);
  document.documentElement.classList.add("sheet-open");
  const keyWas = onKey;
  const close = () => {
    if (!box.isConnected) return;
    onKey = keyWas; document.documentElement.classList.remove("sheet-open");
    if (reduceMotion) return box.remove();
    box.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, easing: "ease-out", fill: "forwards" }).onfinish = () => box.remove();
  };
  const step = d => { if (items.length < 2) return; i = (i + d + items.length) % items.length; draw(); };
  onKey = e => { if (e.key === "Escape") close(); else if (e.key === "ArrowRight") step(1); else if (e.key === "ArrowLeft") step(-1); };
  cleanup.push(() => box.remove());
  // tap closes (links in the credit still work); swipe sideways steps, swipe down closes
  let x0 = null, y0 = 0, dx = 0, dy = 0;
  box.addEventListener("pointerdown", e => { x0 = e.clientX; y0 = e.clientY; dx = dy = 0; });
  box.addEventListener("pointermove", e => { if (x0 == null) return; dx = e.clientX - x0; dy = e.clientY - y0; if (dy > 0 && Math.abs(dy) > Math.abs(dx)) im.style.transform = `translateY(${dy}px)`; else if (Math.abs(dx) > 8) im.style.transform = `translateX(${dx}px)`; });
  const end = e => {
    if (x0 == null) return; x0 = null; im.style.transform = "";
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) return step(dx < 0 ? 1 : -1);
    if (dy > 80) return close();
    if (Math.abs(dx) < 8 && Math.abs(dy) < 8 && !(e.target.closest && e.target.closest("a"))) close();
  };
  box.addEventListener("pointerup", end);
  box.addEventListener("pointercancel", () => { x0 = null; im.style.transform = ""; });
  buzz(6);
}
document.addEventListener("click", e => {
  const t = e.target.closest(".fig img, .wg-th"); if (!t) return;
  const root = t.closest(".peek, .screen"); if (!root) return;
  e.preventDefault();
  const items = wgItems(root), fg = t.closest(".fig, .wg-it");
  wgOpen(items, Math.max(0, items.findIndex(x => x.img.closest(".fig, .wg-it") === fg)));
});
