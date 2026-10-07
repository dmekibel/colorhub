"use strict";
// A quick look at a color from inside the learning loop: its story, where it shows up in paintings and
// other traditions, without leaving the deck. It slides over the cards; "Back to learning" (or a swipe
// down, or Escape) drops you exactly where you were. Only offered once the name is already showing,
// so it never gives an answer away (recall before reveal).

const peekPlain = s => esc(String(s).replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2").replace(/\[\[([^\]]+)\]\]/g, "$1"));

function peekPaintings(c, n = 6) {
  const list = (window.PAINTINGS || []).filter(p => p.palette && !p.stub).map(p => {
    let share = 0, best = 99;
    for (const x of p.palette) { const d = de2000(c.h, x.h); if (x.vocab === c.n || d < 10) share += x.share; best = Math.min(best, d); }
    return { p, share, best };
  });
  const hits = list.filter(x => x.share > 0).sort((a, b) => b.share - a.share);
  return (hits.length ? hits : list.sort((a, b) => a.best - b.best)).slice(0, n).map(x => ({ ...x, near: !x.share }));
}

function peek(c) {
  if (!c || document.querySelector(".peek")) return;
  const n = colorNode(c), w = n && n.wiki, nb = neighbor(c), st = c.id && S.cards[c.id];
  const pts = peekPaintings(c);
  const facets = (w ? w.facets : []).slice(0, 3);
  // other names nearly the same color (ROADMAP §13's one naming system: data/core-names.json via js/naming.js)
  const twins = (CORE_NAMES || []).filter(x => x.n.toLowerCase() !== c.n.toLowerCase()).map(x => ({ ...x, d: de2000(c.h, x.lab) })).filter(x => x.d < 6).sort((a, b) => a.d - b.d).slice(0, 4);
  const rel = (w && w.related || []).slice(0, 4).map(r => { const x = BYNAME.get(String(r.to).toLowerCase()); return x ? { x, why: r.why } : null; }).filter(Boolean);
  const box = document.createElement("div");
  box.className = "peek"; box.setAttribute("role", "dialog"); box.setAttribute("aria-label", "About " + c.n);
  box.innerHTML = `
    <div class="pk-grab"></div>
    <div class="pk-hero" style="--c:${c.h}" data-swatch="${c.h}" data-ink="${ink(c.h)}"><span class="mono">${c.h}</span><h2>${esc(c.n)}</h2>${st ? `<small>${isMine(st) ? "Yours" : "Learning"}</small>` : ""}</div>
    ${nb && c.d ? `<div class="pk-vs" data-nb="${esc(c.n)}"><span class="pair"><i style="--c:${c.h}"></i><i style="--c:${nb.h}"></i></span><p>${esc(c.d)}</p></div>` : ""}
    ${c.o ? `<p class="pk-lead">${esc(c.o)}</p>` : ""}
    ${typeof figHTML === "function" ? figHTML(c.n) : ""}
    ${facets.map(f => `<section class="pk-sec"><h3>${esc(FACET_LABEL[f.k] || f.k)}</h3><p>${peekPlain(f.text)}</p></section>`).join("")}
    ${pts.length ? `<section class="pk-sec"><h3>${pts[0].near ? "Closest in the paintings" : "In paintings"}</h3><div class="pk-ptgs">${pts.map(x => `<figure><img src="${esc(x.p.thumb || x.p.img)}" alt="" loading="lazy"><figcaption><b>${esc(x.p.title)}</b><span>${esc(x.p.artist || "")}${x.share ? ` · ${Math.round(x.share * 100)}% of the canvas` : ""}</span></figcaption></figure>`).join("")}</div></section>` : ""}
    ${twins.length ? `<section class="pk-sec"><h3>Nearly the same, other names</h3>${twins.map(x => `<div class="kin" data-swatch="${x.h}"><i style="--c:${x.h}"></i><b>${esc(x.n)}</b><span>${esc(srcLine(x))}</span></div>`).join("")}</section>` : ""}
    ${rel.length ? `<section class="pk-sec"><h3>Kin</h3>${rel.map(r => `<div class="kin"><i style="--c:${r.x.h}"></i><b>${esc(r.x.n)}</b><span>${esc(r.why)}</span></div>`).join("")}</section>` : ""}
    <div class="pk-foot"><button class="btn" data-back>Back to learning ${ICON.arrow}</button></div>`;
  document.body.appendChild(box);
  lockScroll();
  const keyWas = onKey;
  const close = () => {
    if (!box.isConnected) return;
    onKey = keyWas; unlockScroll();
    if (reduceMotion) return box.remove();
    box.animate([{ transform: getComputedStyle(box).transform }, { transform: "translateY(100%)" }], { duration: 260, easing: "cubic-bezier(.3,0,.8,.2)", fill: "forwards" }).onfinish = () => box.remove();
    setTimeout(() => box.remove(), 400);   // even if animations are paused (background tab)
  };
  onKey = e => { if (e.key === "Escape") close(); };
  cleanup.push(() => box.remove());   // a screen change never leaves it behind
  box.querySelector("[data-back]").onclick = close;
  // swipe down from the top of the sheet to close
  let y0 = null, dy = 0;
  box.addEventListener("pointerdown", e => { if (box.scrollTop <= 0) { y0 = e.clientY; dy = 0; } });
  box.addEventListener("pointermove", e => { if (y0 == null) return; dy = e.clientY - y0; if (dy > 6 && box.scrollTop <= 0) { box.style.transition = "none"; box.style.transform = `translateY(${dy}px)`; } });
  const end = () => { if (y0 == null) return; y0 = null; if (dy > 110) return close(); box.style.transition = "transform .3s var(--ease)"; box.style.transform = ""; };
  box.addEventListener("pointerup", end); box.addEventListener("pointercancel", end);
  if (!CORE_NAMES) loadCoreNames();   // the "other names" row fills in next time
  buzz(6);
}

// the small door on a card or a meet page
const peekBtn = c => `<button class="peek-btn" data-peek="${esc(c.n)}" aria-label="About ${esc(c.n)}">About ${esc(c.n.toLowerCase())} <span aria-hidden="true">↗</span></button>`;
document.addEventListener("click", e => {
  const b = e.target.closest("[data-peek]"); if (!b) return;
  e.stopPropagation(); e.preventDefault();
  peek(BYNAME.get(b.dataset.peek.toLowerCase()));
}, true);
// a press on the door must not start a card drag or a reveal
document.addEventListener("pointerdown", e => { if (e.target.closest("[data-peek]")) e.stopPropagation(); }, true);
document.addEventListener("pointerup", e => { if (e.target.closest("[data-peek]")) e.stopPropagation(); }, true);
