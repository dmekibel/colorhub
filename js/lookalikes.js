"use strict";
// Look-alikes: tap a color's comparison pair (on a flashcard, a meet page, a color page or the peek panel) and the color
// sits in the middle of its closest look-alikes among the names the app teaches, each with an automatic one-line
// difference ("lighter and greener"). Learning a word at its borders, against several neighbors at once, is faster than
// one pair at a time. Tap a look-alike to see the two side by side.

// The nearest taught names to a color (CIEDE2000), never itself.
function lookalikes(c, n = 6) {
  const L = lab(c.h);
  return [...BASICS, ...ALL].filter(x => x.n !== c.n).map(x => ({ x, d: de2000(L, x.lab || (x.lab = lab(x.h))) }))
    .sort((a, b) => a.d - b.d).slice(0, n);
}
// How b differs from a, in plain words, from the biggest LCh differences.
function lookDiff(a, b) {
  const [La, Ca, Ha] = lch(a.h), [Lb, Cb, Hb] = lch(b.h), out = [];
  const dL = Lb - La, dC = Cb - Ca;
  let dH = Hb - Ha; if (dH > 180) dH -= 360; if (dH < -180) dH += 360;
  // one fixed hue vocabulary, the way Webster's Third / Godlove defined colors: redder, yellower, greener, bluer, purpler
  // (never "more teal": a direction word must not be a color name, or "teal is more teal than viridian" happens)
  const hueWord = h => { h = (h + 360) % 360; return h < 55 || h >= 345 ? "redder" : h < 130 ? "yellower" : h < 190 ? "greener" : h < 280 ? "bluer" : "purpler"; };
  const parts = [];
  if (Math.abs(dL) >= 4) parts.push([Math.abs(dL), dL > 0 ? "lighter" : "darker"]);
  if (Math.abs(dC) >= 5) parts.push([Math.abs(dC) * .8, dC > 0 ? "more vivid" : "duller"]);
  if (Ca > 8 && Cb > 8 && Math.abs(dH) >= 8) parts.push([Math.abs(dH) * Math.min(Ca, Cb) / 40, hueWord(Ha + Math.sign(dH) * 25)]);   // the way the hue moved
  parts.sort((p, q) => q[0] - p[0]).slice(0, 2).forEach(p => out.push(p[1]));
  return out.length ? out.join(" and ") : "almost the same";
}
function lookSheet(c) {
  if (!c) return;
  const near = lookalikes(c), ring = near.map((o, i) => {
    const a = (i / near.length) * Math.PI * 2 - Math.PI / 2;
    return `<button class="lk-dot" data-lk="${i}" style="--c:${o.x.h};left:${50 + 38 * Math.cos(a)}%;top:${50 + 38 * Math.sin(a)}%" aria-label="${esc(o.x.n)}"></button>`;
  }).join("");
  const { sh } = sheet(`
    <p class="eyebrow">Look-alikes</p>
    <div class="lk-ring"><div class="lk-mid" style="--c:${c.h}" data-ink="${ink(c.h)}"><b>${esc(c.n)}</b></div>${ring}</div>
    <div class="lk-cmp" id="lkcmp"></div>
    <div class="lk-list">${near.map((o, i) => `<button class="lk-row" data-lk="${i}"><i style="--c:${o.x.h}"></i><b>${esc(o.x.n)}</b><span>${esc(lookDiff(c, o.x))}</span>${typeof isMine === "function" && o.x.id && isMine(o.x) ? "<em>yours</em>" : ""}</button>`).join("")}</div>
    <p class="fine">The closest names the lessons teach, by perceived difference (CIEDE2000). Hex values are screen approximations.</p>`);
  sh.classList.add("lk-sheet");
  const cmp = sh.querySelector("#lkcmp");
  const pick = i => {
    const o = near[i]; buzz(5);
    sh.querySelectorAll("[data-lk]").forEach(b => b.classList.toggle("on", +b.dataset.lk === i));
    cmp.innerHTML = `<div class="lk-pair"><div style="--c:${c.h}" data-ink="${ink(c.h)}"><span>${esc(c.n)}</span></div><div style="--c:${o.x.h}" data-ink="${ink(o.x.h)}"><span>${esc(o.x.n)}</span></div></div>
      <p class="lk-line"><b>${esc(o.x.n)}</b> is ${esc(lookDiff(c, o.x))} than ${esc(c.n.toLowerCase())}.${o.x.vs === c.n && o.x.d ? ` ${esc(o.x.n)}: ${esc(o.x.d)}` : c.vs === o.x.n && c.d ? ` ${esc(c.n)}: ${esc(c.d)}` : ""}</p>`;
  };
  sh.querySelectorAll("[data-lk]").forEach(b => b.onclick = () => pick(+b.dataset.lk));
  pick(0);
}
// Any comparison pair marked data-nb opens the sheet (a tap on a linked neighbor still follows its link).
document.addEventListener("click", e => {
  const box = e.target.closest("[data-nb]"); if (!box || e.target.closest("[data-node],[data-peek],a")) return;
  // on a flashcard, only after the name is showing (recall before reveal)
  const card = box.closest(".card"); if (card && !card.classList.contains("revealed")) return;
  e.stopPropagation(); e.preventDefault();
  lookSheet(BYNAME.get(box.dataset.nb.toLowerCase()));
}, true);
