"use strict";
// The miss compare (David, 2026-10-08): when you guess a color and get it wrong, the color you picked and the color
// it was fill the screen side by side, large, so the difference is easy to memorize. One shared component; every
// game calls mcShow() on a miss instead of drawing two tiny squares.
//
//   mcShow({ you: {n?, h} | {hs:[…], ns?:[…]}, was: {…}, line?, from?, go?, label?, auto?, youLabel?, wasLabel? }) -> close()
//     you / was  the color picked and the right one (n = its name; defaults to nameOf(h).n). hs = several colors
//                (Painters' pairs): each half splits into stripes, one per color.
//     line       one plain sentence; default is the measured one ("Teal is greener and darker than petrol, 6% apart.")
//     from       the tapped tile (Element or rect): the small tile grows into the screen
//     go         called once when the player moves on (Got it / Next, tap anywhere after a short beat, Enter, Esc)
//     auto       ms: move on by itself (timed games, where the clock keeps running)
// Tapping a name opens that color's page (one-tap rule, js/swatch.js) and closes this without calling go, so the
// game's own Next stays reachable underneath. Needs no markup in index.html; css/misscompare.css.
let MC_OPEN = null;
const MC_BEAT = 650;   // taps this soon after it opens are the tap that caused the miss, not "go on"
const mcName = x => x.n || (typeof nameOf === "function" ? nameOf(x.h).n : "") || x.h;
const mcHexes = x => x.hs && x.hs.length ? x.hs : [x.h];
// plain-English difference between the two single colors: "Teal is greener and darker than petrol."
// When both get the same name, the sentence says so honestly instead of "Butterscotch and Butterscotch are almost
// the same color": "Both are butterscotch; this difference has no word. Yours is lighter." (REVIEW-2 #14)
const mcSame = (you, was) => !you.hs && !was.hs && String(mcName(you)).toLowerCase() === String(mcName(was)).toLowerCase();
// which way the one you picked leans from the right one, even when the gap is small: lighter/darker, more
// vivid/greyer, or a hue word. Biggest first, at most two.
function mcLean(you, was) {
  if (typeof lch !== "function") return "";
  const [L1, C1, H1] = lch(you.h), [L2, C2, H2] = lch(was.h), dh = Math.abs(((H1 - H2 + 540) % 360) - 180);
  const out = [{ w: L1 > L2 ? "lighter" : "darker", m: Math.abs(L1 - L2) }, { w: C1 > C2 ? "more vivid" : "greyer", m: Math.abs(C1 - C2) * .8 }];
  if (typeof colorDiff === "function" && typeof MORE !== "undefined") {
    const hue = colorDiff(you.h, was.h).find(x => !["light", "dark", "vivid", "grey"].includes(x.w));
    if (hue && MORE[hue.w]) out.push({ w: MORE[hue.w], m: 2 * Math.sqrt(C1 * C2) * Math.sin(dh * Math.PI / 360) });
  }
  const p = out.filter(x => x.m >= .4).sort((a, b) => b.m - a.m).slice(0, 2);
  return p.length ? p.map(x => x.w).join(" and ") : "";
}
function mcLine(you, was) {
  if (!you.h || !was.h || you.hs || was.hs) return "";
  const lean = mcLean(you, was);
  if (mcSame(you, was)) return `Both are ${String(mcName(was)).toLowerCase()}; this difference has no word.${lean ? ` Yours is ${lean}.` : ""}`;
  if (typeof compareLine !== "function") return "";
  const ln = compareLine({ n: mcName(was), h: was.h }, { n: mcName(you), h: you.h });
  return / are almost the same color\.$/.test(ln) && lean ? ln.replace(/\.$/, `; yours is ${lean}.`) : ln;
}
function mcPct(you, was) {
  if (you.hs || was.hs || !you.h || !was.h) return null;   // a pair against a pair has no single distance
  return de2000(you.h, was.h);
}
// big names that still fit half a phone: shrink the long ones
const mcFit = s => { const n = String(s).length; return n <= 7 ? 40 : n <= 11 ? 32 : n <= 16 ? 26 : 22; };
function mcSide(x, role, label) {
  const hs = mcHexes(x), names = hs.length > 1 ? (x.ns || hs.map(h => nameOf(h).n)) : [mcName(x)];
  return `<section class="mc-side mc-${role}">${hs.map((h, i) => `<div class="mc-cell" style="--c:${h}" data-ink="${ink(h)}">
      ${i === 0 ? `<small class="mc-lab">${esc(label)}</small>` : ""}
      <button class="mc-n" data-swatch="${h}" style="font-size:${mcFit(names[i])}px">${esc(names[i])}</button>
      <span class="mc-hex">${h}</span></div>`).join("")}</section>`;
}
function mcClose(quick) {
  const m = MC_OPEN; if (!m) return;
  MC_OPEN = null;
  window.removeEventListener("click", m.tap, true); window.removeEventListener("keydown", m.key, true);
  clearTimeout(m.t);
  if (quick || (typeof reduceMotion !== "undefined" && reduceMotion)) return m.el.remove();
  m.el.classList.add("out"); setTimeout(() => m.el.remove(), 220);
}
function mcShow(o) {
  if (!o || !o.you || !o.was) return () => {};
  mcClose(true);
  const you = o.you, was = o.was, d = mcPct(you, was);
  // a caller's own sentence, unless both colors carry the same name (then only the honest "no word" line is true)
  const line = o.line != null && !(mcSame(you, was) && you.h && was.h) ? o.line : mcLine(you, was);
  const el = document.createElement("div");
  el.className = "mc";
  el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true");
  el.setAttribute("aria-label", `You picked ${mcHexes(you).map(h => nameOf(h).n).join(" with ")}. It was ${mcHexes(was).map(h => nameOf(h).n).join(" with ")}.`);
  el.innerHTML = `<div class="mc-halves">${mcSide(you, "you", o.youLabel || "You picked")}${mcSide(was, "was", o.wasLabel || "It was")}</div>
    <div class="mc-panel">${d != null ? `<b class="mc-pct">${pctFmt(d)}<em>apart</em></b>` : ""}${line ? `<p class="mc-line">${esc(line)}</p>` : ""}
      <button class="mc-go" type="button">${esc(o.label || "Got it")}</button></div>`;
  let done = false, ready = false;
  const m = { el, t: 0 };
  const cont = () => {
    if (done) return; done = true;
    if (typeof buzz === "function") buzz(6);
    mcClose();
    if (o.go) o.go();
  };
  m.tap = e => {
    if (!el.contains(e.target)) return;
    if (e.target.closest(".mc-n")) { setTimeout(() => mcClose(true), 0); return; }   // the color's page opens (swatch.js); no go
    e.stopPropagation(); e.preventDefault();
    if (e.target.closest(".mc-go") || ready) cont();
  };
  m.key = e => {
    if (!["Enter", " ", "Escape", "ArrowRight"].includes(e.key)) return;
    e.preventDefault(); e.stopImmediatePropagation(); cont();
  };
  window.addEventListener("click", m.tap, true); window.addEventListener("keydown", m.key, true);
  document.body.appendChild(el);
  MC_OPEN = m;
  if (typeof cleanup !== "undefined" && Array.isArray(cleanup)) cleanup.push(() => { if (MC_OPEN === m) mcClose(true); });
  // the small tile grows into the screen
  const src = o.from && (o.from.getBoundingClientRect ? o.from.getBoundingClientRect() : o.from);
  const still = typeof reduceMotion !== "undefined" && reduceMotion;
  if (src && src.width && !still) {
    el.style.clipPath = `inset(${src.top}px ${innerWidth - src.right}px ${innerHeight - src.bottom}px ${src.left}px round 10px)`;
    void el.offsetWidth;
    el.classList.add("grow"); el.style.clipPath = "";
  } else el.classList.add(still ? "still" : "fade");
  if (typeof buzz === "function") buzz(4);
  setTimeout(() => { ready = true; el.classList.add("ready"); }, MC_BEAT);
  if (o.auto) m.t = setTimeout(cont, o.auto);
  return () => { if (MC_OPEN === m) mcClose(true); };
}
