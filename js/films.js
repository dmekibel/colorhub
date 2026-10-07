"use strict";
// Films: how directors use color. Short original pieces, never stills or frame-sampled palettes for films under
// copyright: their palettes are a few named colors we chose to illustrate the text ("colors discussed").
// Public-domain early color films (before 1930) may show a small Commons image and a palette sampled from that scan.
// Data: data/films.js (window.FILMS), loaded in the background. Needs js/passages.js (archWhen, archNode, archReady).
// Exports: filmsSection(), filmPage(f), inFilmsRow(color).

(() => {
  const s = document.createElement("script");
  s.src = "data/films.js" + (ARCH_V ? "?v=" + ARCH_V : "");
  s.onload = s.onerror = () => { window.FILMS = window.FILMS || []; archReady(); };
  document.head.appendChild(s);
})();

const filmYear = f => String(f.year);
// a strip of film: the colors discussed as frames between two rows of sprocket holes
const filmStrip = (f, cls = "film-strip") => `<span class="${cls}"><span>${f.colors.map(c => `<i style="--c:${c.h}"></i>`).join("")}</span></span>`;
function filmPin(f) {
  if (f.early && f.img) {
    const ar = f.img.w && f.img.h ? f.img.h / f.img.w : .75;
    return { h: 167 * ar + 70, html: `<button class="pin pin-art pin-film" data-arch="film:${esc(f.id)}"><img src="${esc(f.img.thumb || f.img.src)}" alt="" loading="lazy" style="aspect-ratio:${(1 / ar).toFixed(3)}">${(f.palette || []).length ? `<span class="mini-pal">${f.palette.map(c => `<i style="--c:${c.h};flex:${c.share}"></i>`).join("")}</span>` : ""}<b>${esc(f.title)}</b><small>${esc(f.director)} · ${filmYear(f)}</small></button>` };
  }
  return { h: 150, html: `<button class="pin pin-film" data-arch="film:${esc(f.id)}">${filmStrip(f)}<b>${esc(f.title)}</b><small>${esc(f.director)} · ${filmYear(f)}</small></button>` };
}
// The Films section for Explore (in the Ideas lens for now): the first color films, then the rest by year.
function filmsSection() {
  if (!window.FILMS) { ARCH_STALE = true; return { title: "Films", sub: "Loading the films…", pins: [] }; }
  const all = window.FILMS.slice().sort((a, b) => a.year - b.year);
  return [{ title: "Films · Before 1930", sub: "Hand-painted, stenciled and two-color Technicolor films, now in the public domain.", pins: all.filter(f => f.early).map(filmPin) },
    { title: "Films · How directors use color", sub: "Short pieces of our own. No stills: the colors are chosen by name to match the text.", pins: all.filter(f => !f.early).map(filmPin) }].filter(x => x.pins.length);
}

function filmPage(f) {
  const links = f.links || [];
  const hero = f.early && f.img
    ? `${archFig(f.img)}
       ${(f.palette || []).length ? `<div class="palette film-sampled">${f.palette.map(c => `<button class="pal" style="--c:${c.h};flex:${Math.max(c.share, .08)}" data-ink="${ink(c.h)}" data-to="c:${esc(c.app)}"><span>${Math.round(c.share * 100)}%</span></button>`).join("")}</div><p class="fine film-note">Sampled from this scan. Old prints fade, so the colors are the scan's, not the premiere's.</p>` : ""}`
    : `<div class="film-hero">${f.colors.map(c => `<button style="--c:${c.h}" data-ink="${ink(c.h)}" data-to="c:${esc(c.app)}"><span>${esc(c.name)}</span></button>`).join("")}</div><p class="eyebrow film-cap">Colors discussed · chosen by name, not sampled</p>`;
  const el = show(`
    <header class="art-top"><button class="icon-btn glass" data-back aria-label="Back">${ICON.back}</button></header>
    ${hero}
    <p class="eyebrow p-type">Film · ${filmYear(f)}${f.country ? ` · ${esc(f.country)}` : ""}</p>
    <h1 class="p-title">${esc(f.title)}</h1>
    <p class="p-dek">${esc(f.director)}</p>
    ${f.dek ? `<p class="lead film-dek">${esc(f.dek)}</p>` : ""}
    <div class="film-body">${(f.body || []).map(t => `<p>${linkText(t)}</p>`).join("")}</div>
    ${(f.images || []).map(archFig).join("")}
    <section class="psg-cols"><h3>Colors discussed</h3>${f.colors.map(c => `<button class="pal-name" data-to="c:${esc(c.app)}"><i style="--c:${c.h}"></i><b>${esc(c.name)}</b><span>${esc(c.note || "")}${c.app !== c.name ? ` · nearest app color: ${esc(c.app)}` : ""}</span><em class="mono">${c.h}</em></button>`).join("")}</section>
    ${f.facts && f.facts.length ? `<dl class="facts">${f.facts.map(x => `<div><dt>${esc(x.label)}</dt><dd>${esc(x.value)}</dd></div>`).join("")}</dl>` : ""}
    ${links.length ? `<div class="film-links">${links.map(l => `<a class="btn ghost" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)} ${ICON.arrow}</a>`).join("")}</div>` : ""}
    <p class="fine">${f.early ? esc(f.pd || "Public domain in the US: released before 1930.") : "This film is under copyright, so there are no stills here. The colors above are named by us to illustrate the text; hex values are screen approximations."}</p>
    ${f.sources && f.sources.length ? secHTML("src", "Sources", sourcesHTML(f.sources), false) : ""}
  `, "article film-page");
  el.querySelector("[data-back]").onclick = xBack;
  onKey = e => { if (e.key === "Escape") xBack(); };
  wireLinks(el);
}

// ---------- "In films" on a color page ----------
function inFilmsRow(c) {
  const hits = (window.FILMS || []).filter(f => f.colors.some(x => x.app === c.n) || (f.palette || []).some(x => x.app === c.n && x.share > .12)).slice(0, 4);
  if (!hits.length) return "";
  return `<section class="arch-row"><h3>In films</h3>${hits.map(f => {
    const x = f.colors.find(k => k.app === c.n);
    return `<button class="film-row" data-arch="film:${esc(f.id)}">${filmStrip(f, "film-strip film-strip-s")}<span><b>${esc(f.title)}</b><small>${esc(f.director)} · ${filmYear(f)}</small>${x && x.note ? `<em>${esc(x.note)}</em>` : ""}</span></button>`;
  }).join("")}</section>`;
}
