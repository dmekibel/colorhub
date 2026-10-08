"use strict";
// The set tray and the "Pair with…" picker (design/SET-PAGES.md). How two, three or more colors get together:
//   sxPairBtnHTML(hex, name)  the small "Pair with…" button under a color page's hex (js/richpage.js, one line)
//   sxPick(anchor, o)         the picker sheet: harmonies, painters' pairs, look-alikes, your colors, recent,
//                             search any name, or any color on the ring. One tap opens the pair (or set) page.
//   sxAdd(hex)                add a color to the set (long-press on any [data-swatch] anywhere does this)
//   sxOpen(hexes)             open the pair page (2 colors) or the set page (3+) for these colors
// The set lives in S.setTray (up to SX_MAX colors) and shows as a small pill at the foot of every screen, so you
// can keep browsing and add more. The pages themselves are js/setpage.js (spPage). Top-level names start with sx.

const SX_MAX = 8;
const SX_ICON_PAIR = sv('<circle cx="9" cy="12" r="5.5"/><circle cx="15" cy="12" r="5.5"/>', 18, 1.7);
const SX_ICON_X = sv('<path d="M6 6l12 12M18 6L6 18"/>', 16, 1.8);
const sxHex = h => /^#?[0-9a-f]{6}$/i.test(String(h || "")) ? "#" + String(h).replace("#", "").toUpperCase() : null;
const sxTray = () => (Array.isArray(S.setTray) ? S.setTray : (S.setTray = [])).filter(h => sxHex(h));
const sxNm = h => { const n = nameOf(h); return n.de < VERY_CLOSE_DE && !n.between ? n.n : n.text || h; };
// one color, already in the set? (within 1% different counts as the same color)
const sxHas = (list, h) => list.some(x => de2000(x, h) < 1);

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
  const { sh, close } = sheet(`
    <div class="sx-head"><i style="--c:${anchor}"></i><div><p class="eyebrow">${o.title ? "Add a color to" : "Pair with…"}</p><h2>${esc(o.title || name)}</h2></div></div>
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
    <button class="btn solid sx-use" data-sx-use hidden>Pair with this color</button>`);
  sh.classList.add("sx-sheet");
  const pick = h => {
    h = sxHex(h); if (!h) return;
    buzz(8); close();
    if (o.onPick) return o.onPick(h);
    const set = sxSetTray([anchor, h]);
    sxOpen(set);
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
      if (!box.hidden && !picker && typeof colorPicker === "function") picker = colorPicker(box, { hex: rotateHue(anchor, 180), onChange: h => { cur = h; use.textContent = `${o.title ? "Add" : "Pair with"} ${sxNm(h).toLowerCase()}`; } });
      if (!box.hidden && picker) { cur = picker.get(); use.textContent = `${o.title ? "Add" : "Pair with"} ${sxNm(cur).toLowerCase()}`; box.scrollIntoView({ block: "nearest", behavior: reduceMotion ? "auto" : "smooth" }); }
      buzz(5); return;
    }
    if (e.target.closest("[data-sx-use]") && cur) return pick(cur);
  });
  sh.querySelector("[data-sx-picker]").addEventListener("pointerdown", e => e.stopPropagation());
  return { sh, close };
}
