"use strict";
// Library color pages (ROADMAP.md §13 "Library color pages", David 2026-10-08/09: "if ecru is that close to
// greyish white, why is it not the same article?"). Every one of the ~1,000 core names (data/core-names.json,
// js/naming.js's nameOf()/familyOf()) gets its own page at #/name/<slug> (js/router.js) — not just the app's
// 101 "deep" colors (js/explore.js colorPage). One of the 101 still opens colorPage instead (router.js,
// openCoreName() below): this file is only for the ~900 names that used to dead-end in js/swatch.js's small
// sheet. Reuses nearly everything a color page already draws on — books/films (js/passages.js), nature
// (js/botany.js), gems (js/gems.js), fashion (js/world.js) and poems (js/poems.js) all take a plain {n, h}
// color and don't care that this one isn't one of the 101. New here: the family link (familyOf()), the stage
// badge, and a focused "In paintings" search (tighter than a color page's, since a name page has nothing
// else of its own to fall back on).

// ---------- resolving any name to its page ----------
// A honeycomb bubble or a library item (js/colorsets.js) isn't necessarily a core-names.json entry itself
// (the honeycomb can show the bigger 2,700-name library too) — find its real entry so the page gets real
// rank/also/notes, falling back to a minimal one (its own hex) when the name isn't in the ~1,000.
function npEntryFor(o) {
  const list = CORE_NAMES || coreFallback(), hit = list.find(e => e.n.toLowerCase() === String(o.n).toLowerCase());
  if (hit) return hit;
  // a computed shade (js/home.js hmShadeItems, tools/build_shades.py): not a name, a description of its base
  // made lighter/darker/greyer/etc — js/naming.js's own fixed grammar, so its page says so plainly.
  if (o.shade) return { n: o.n, h: o.h, src: ["shade"], rank: null, shade: o.shade };
  const lib = o.lib || null;
  return { n: o.n, h: o.h, src: (lib && lib.src) || o.src || ["app"], rank: null, also: lib && lib.also };
}
// Open the right page for any name: the app's own deep page for one of the 101, else its name page. Used
// everywhere a name is just a string + a hex (the color sheet, a name page's own nearest/look-alike rows).
function openCoreName(hex, name) {
  const taught = BYNAME.get(String(name).toLowerCase());
  if (taught) return openNode(colorNode(taught));
  const list = CORE_NAMES || coreFallback();
  const entry = list.find(e => e.n.toLowerCase() === String(name).toLowerCase()) || { n: name, h: hex, src: ["app"], rank: null };
  return namePage(entry);
}

// ---------- which stage a name belongs to (js/home.js HM_STAGES: 25/50/101/150/250/400/600/800/1,000) ----------
function npStage(rank) {
  if (rank == null || typeof HM_STAGES === "undefined") return null;
  for (let i = 0; i < HM_STAGES.length; i++) { if (rank < (HM_STAGES[i] === 100 ? 101 : HM_STAGES[i])) return i + 1; }
  return HM_STAGES.length;
}

// ---------- "Part of the <Family> family" ----------
function npFamilyHTML(fam) {
  const head = fam.head, n = typeof colorNode === "function" && colorNode(head);
  const raw = (n && n.wiki && n.wiki.facets[0] && n.wiki.facets[0].text) || head.d || head.o || "";
  const plain = plainText(raw).trim();
  const excerpt = plain.length > 170 ? plain.slice(0, 168).replace(/\s+\S*$/, "") + "…" : plain;
  return `<div class="sec-head"><b>Family</b><span>shared history lives here</span></div>
    <button class="kin np-fam" data-fam-open><i style="--c:${head.h}"></i><b>Read the ${esc(head.n)} story</b><span>${esc(excerpt || `Part of the ${head.n} family.`)}</span></button>`;
}

// ---------- "In paintings": a tighter search than a color page's (ΔE00 ~6), reusing js/gallery.js's pieces ----------
function npGalleryHits(hex, R = 6) {
  if (typeof GAL === "undefined" || !GAL) return [];
  const G = GAL, N = G.n, [tL, ta, tb] = lab(hex), out = [];
  for (let i = 0; i < N; i++) {
    let w = 0;
    for (let j = 0; j < 6; j++) {
      const k = i * 6 + j, o = k * 3, dL = G.lab[o] - tL;
      if (dL > 21 || dL < -21) continue;   // ΔE00 is at least |ΔL| / 1.75, so this one can't be within R
      const d = glDE(tL, ta, tb, G.lab[o], G.lab[o + 1], G.lab[o + 2]);
      if (d < R) { const q = d / R; w += G.sh[k] * (1 - q * q); }
    }
    if (w > .01) out.push([i, w]);
  }
  return out.sort((a, b) => b[1] - a[1]).slice(0, 24);
}
function npPaintingsSection(host, hex) {
  if (!host) return;
  const render = () => {
    if (!host.isConnected) return;
    const hits = npGalleryHits(hex);
    host.innerHTML = `<h3>In paintings</h3>` + (hits.length
      ? `<p class="gl-in-sub">Paintings with a color close to this one, by how much of the canvas it covers.</p>
         <div class="gl-rail">${hits.map(([i, w]) => glPinHTML(i, { badge: `${Math.max(1, Math.round(w * 100))}% of the canvas` })).join("")}</div>`
      : `<p class="fine">No painting in the gallery has much of this color.</p>`);
    glFill(host);
  };
  host.onclick = e => { const p = e.target.closest("[data-gi]"); if (p) galleryPage(+p.dataset.gi, true, hex); };
  if (typeof GAL !== "undefined" && GAL) return render();
  host.innerHTML = `<h3>In paintings</h3><p class="fine">Loading the gallery…</p>`;
  loadGallery().then(render).catch(() => { if (host.isConnected) host.innerHTML = `<h3>In paintings</h3><p class="fine">The gallery didn't load.</p>`; });
}

// ---------- the page ----------
// Same archetype as js/explore.js's colorPage: a full-bleed hero (solid ‹, a state chip), one primary when
// there's a real task (Learn it, for one of the 101), then its family link and the picture shelves, then the
// nearest-names/look-alikes depth at the end (DESIGN-SYSTEM.md §12 lists these name-page specifics: "the
// same archetype, with their family link and paintings").
//
// `tapped`: an exact hex that landed here as its nearest name but isn't quite it (js/swatch.js
// openTappedColor, David 2026-10-07) — the hero shows that exact color with a "Your color" note, and a
// your-color-vs-this-name strip stands in for the usual "between/pale X" description line.
function namePage(entry, push = true, tapped) {
  const name = entry.n, hex = entry.h;
  tapped = tapped ? String(tapped).toUpperCase() : null;
  const heroHex = tapped || hex;
  if (push) XSTACK.push("n:" + encodeURIComponent(name));   // the in-session back-trail; `tapped` only ever lives in the address bar (router.js)
  const fam = familyOf(hex);
  const stage = npStage(entry.rank);
  const taught = BYNAME.get(name.toLowerCase());   // true only if routing ever lands here for one of the 101 (see router.js)
  const mine = taught && taught.id && isMine(S.cards[taught.id]);
  const also = entry.also || [];
  const notes = entry.notes || [];
  // a computed shade (js/home.js hmShadeItems): a description, not an established name (ROADMAP: never taught,
  // always says so) — its own base is one of the ~1,000 core names, looked up here for the "See <base>" link.
  const shade = entry.shade || null;
  const shadeBase = shade && (CORE_NAMES || coreFallback()).find(e => e.n.toLowerCase() === shade.base.toLowerCase());
  const nearCore = nearestCore(tapped || hex, CORE_NAMES || coreFallback(), 7).filter(x => x.n.toLowerCase() !== name.toLowerCase()).slice(0, 6);
  const likes = typeof lookalikes === "function" ? lookalikes({ n: name, h: hex }, 6) : [];
  const status = tapped ? `Your color · ${pctMatch(de2000(tapped, hex))} to ${name}` : stage ? `Stage ${stage} of 9` : shade ? "A described shade" : "Library color";
  const el = show(`
    <div class="c-hero cp-hero cp-hero-full" style="--c:${heroHex}" data-ink="${ink(heroHex)}">
      <button class="cp-close" data-back aria-label="Back">${ICON.back}</button>
      <div class="cp-hero-foot">
        <span class="cp-chip">${esc(status)}</span>
        <h1>${esc(name)}</h1>
        <button class="mono cp-hex" data-copy="${heroHex}">${heroHex}</button>
      </div>
      <span class="cp-scroll-hint" aria-hidden="true">${ICON.up}</span>
    </div>
    ${taught && typeof hmLearnIt === "function" ? `<div class="cp-primary-row"><button class="cp-primary" data-learnit>${mine ? "Review it" : "Learn it"}${mine ? "" : `<em>2 min</em>`}${ICON.arrow}</button></div>` : ""}
    ${tapped ? `<section class="cp-strip-sec">
      <div class="cp-strip"><div style="--c:${tapped}" data-ink="${ink(tapped)}"><b>Your color</b></div><div style="--c:${hex}" data-ink="${ink(hex)}"><b>${esc(name)}</b></div></div>
      <p class="cp-diff">${esc(lookDiff({ h: tapped, n: "Your color" }, { h: hex, n: name }))}</p>
    </section>` : ""}
    ${shade ? `<p class="fine np-shade">A described shade: ${esc(shade.base)} made ${esc(shade.mod)}${shadeBase ? `. <button class="link" data-shade-base>See ${esc(shade.base)}</button>` : "."}</p>` : ""}
    ${also.length ? `<p class="fine np-also">Also called ${also.map(esc).join(", ")}.</p>` : ""}
    ${notes.length ? `<p class="fine np-jp">${jpNoteLine(notes)}</p>` : ""}
    ${fam ? npFamilyHTML(fam) : ""}
    <section class="gl-in" data-npgal></section>
    <div class="c-poems"></div>
    ${typeof archiveRows === "function" ? archiveRows(entry) : ""}
    ${typeof btRow === "function" ? btRow(entry) : ""}
    ${typeof gmRow === "function" ? gmRow(entry) : ""}
    <section class="fx-in" data-world-in></section>
    ${nearCore.length ? `<div class="sec-head"><b>Nearest names</b><span>of about 1,000</span></div>
      <div class="lk-list">${nearCore.map(x => `<button class="lk-row" data-np-near="${esc(x.n)}" data-h="${x.h}"><i style="--c:${x.h}" data-morph-src></i><b>${esc(x.n)}</b><span>${closeness(x.de)} · ${pctDiff(x.de)}</span></button>`).join("")}</div>` : ""}
    ${likes.length ? `<div class="sec-head"><b>Look-alikes</b><span>among the 101 taught colors</span></div>
      <div class="lk-list">${likes.map(o => `<button class="lk-row" data-np-near="${esc(o.x.n)}" data-h="${o.x.h}"><i style="--c:${o.x.h}" data-morph-src></i><b>${esc(o.x.n)}</b><span>${esc(lookDiff({ n: name, h: hex }, o.x))}</span></button>`).join("")}</div>` : ""}
    <p class="fine">Nearest of about 1,000 primary names (CIEDE2000). Hex values are screen approximations.</p>
  `, "article cp-page names");
  el.querySelector("[data-back]").onclick = xBack;
  onKey = e => { if (e.key === "Escape") xBack(); };
  wireLinks(el);
  const li = el.querySelector("[data-learnit]"); if (li) li.onclick = () => hmLearnIt(taught);
  const famBtn = el.querySelector("[data-fam-open]"); if (famBtn) famBtn.onclick = () => openNode(colorNode(fam.head));
  const shBtn = el.querySelector("[data-shade-base]"); if (shBtn) shBtn.onclick = () => openCoreName(shadeBase.h, shadeBase.n);
  // a tap anywhere on the row grows its little swatch into the next page's hero (the whole row is the hit
  // target, not just the 28px chip, so this calls morphFrom itself rather than relying on the generic
  // [data-morph-src] delegated listener, which only catches a tap exactly on the marked element).
  el.querySelectorAll("[data-np-near]").forEach(b => b.onclick = () => { morphFrom(b.querySelector("i")); openCoreName(b.dataset.h, b.dataset.npNear); });
  npPaintingsSection(el.querySelector("[data-npgal]"), hex);
  colorPoems(el.querySelector(".c-poems"), entry);
  if (typeof worldColorRow === "function") worldColorRow(el, { kind: "color", h: hex, title: name });
  el.querySelectorAll("[data-copy]").forEach(b => b.onclick = () => { try { navigator.clipboard.writeText(b.dataset.copy); toast("Copied " + b.dataset.copy); } catch (e) {} });
  return el;   // so growFrom (js/core.js, js/home.js hmOpenName) can grow this page from the tapped honeycomb bubble
}

// ---------- screenshot hook: #shot=name:<slug>[@scrolldown] ----------
// Mirrors router.js's own redirect: an app color's slug opens its deep colorPage instead (same as a real
// #/name/<slug> visit), so this hook is an honest preview of production routing, not just namePage() in
// isolation.
function namesShot(arg) {
  const [slug, down] = String(arg || "greyish-white").split("@");
  const after = () => { if (down) document.body.style.marginTop = "-" + down + "px"; };
  const c = routeColor(slug);
  if (c) { XSTACK = []; openNode(colorNode(c)); return after(); }
  loadCoreNames().then(() => {
    const entry = (CORE_NAMES || []).find(e => routeSlug(e.n) === slug) || (CORE_NAMES || []).find(e => e.n.toLowerCase() === slug.toLowerCase());
    if (!entry) return toast("No core name called that");
    XSTACK = [];
    namePage(entry);
    after();
  });
}
