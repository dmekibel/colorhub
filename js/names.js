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

// ---------- which stage a name belongs to (js/home.js HM_STAGES: 25/50/100/150/250/400/600/800/1,000) ----------
function npStage(rank) {
  if (rank == null || typeof HM_STAGES === "undefined") return null;
  for (let i = 0; i < HM_STAGES.length; i++) { if (rank < HM_STAGES[i]) return i + 1; }
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
      if (dL > R * 1.75 || dL < -R * 1.75) continue;   // ΔE00 is at least |ΔL| / 1.75, so this one can't be within R
      const d = glDE(tL, ta, tb, G.lab[o], G.lab[o + 1], G.lab[o + 2]);
      if (d < R) { const q = d / R; w += G.sh[k] * (1 - q * q); }
    }
    if (w > .01) out.push([i, w]);
  }
  return out.sort((a, b) => b[1] - a[1]).slice(0, 24);
}
function npPaintingsSection(host, hex, name) {
  if (!host) return;
  if (typeof paintingsOfSection === "function") return paintingsOfSection(hex, host, { name });   // js/paintingsof.js (L26): the finer index + sliders + pairs
  const render = () => {
    if (!host.isConnected) return;
    // a strip of (up to) 6 real thumbnails, the paintings that use this color most (David, 2026-10-07:
    // "the paintings that use it most, as a strip of 6 thumbnails") — no empty section when there are none.
    const hits = npGalleryHits(hex).slice(0, 6);
    host.innerHTML = hits.length
      ? `<h3>In paintings</h3><p class="gl-in-sub">Paintings with a color close to this one, by how much of the canvas it covers.</p>
         <div class="gl-rail">${hits.map(([i, w]) => glPinHTML(i, { badge: `${Math.max(1, Math.round(w * 100))}% of the canvas` })).join("")}</div>`
      : "";
    glFill(host);
  };
  host.onclick = e => { const p = e.target.closest("[data-gi]"); if (p) galleryPage(+p.dataset.gi, true, hex); };
  if (typeof GAL !== "undefined" && GAL) return render();
  host.innerHTML = `<h3>In paintings</h3><p class="fine">Loading the gallery…</p>`;
  loadGallery().then(render).catch(() => { if (host.isConnected) host.innerHTML = `<h3>In paintings</h3><p class="fine">The gallery didn't load.</p>`; });
}

// ---------- the page ----------
// Every name draws through js/richpage.js colorDossier, the same page and order as one of the app's own colors
// (js/explore.js colorPage): cover, glance, one primary (Learn it works on any learnable name), its story or its
// twin's, field notes (Names and codes last: also called, stamps, codes), the Walk (its only neighbor list).
//
// `tapped`: an exact hex that landed here as its nearest name but isn't quite it (js/swatch.js openTappedColor,
// David 2026-10-07): the cover splits (your color, the name's own in its corner) with one difference sentence.
function namePage(entry, push = true, tapped) {
  const name = entry.n, hex = entry.h;
  tapped = tapped ? String(tapped).toUpperCase() : null;
  const heroHex = tapped || hex;
  if (push) XSTACK.push("n:" + encodeURIComponent(name));   // the in-session back-trail; `tapped` only ever lives in the address bar (router.js)
  const taught = BYNAME.get(name.toLowerCase());   // true only if routing ever lands here for one of the 101 (see router.js)
  // Learn it works on any name, not only the first units (js/learnmore.js lxLearnable: its card id and look-alikes)
  const learnC = taught || (typeof lxLearnable === "function" ? lxLearnable(entry) : null);
  const mine = learnC && learnC.id && isMine(S.cards[learnC.id]);
  // a computed shade (js/home.js hmShadeItems): a description, not an established name (ROADMAP: never taught,
  // always says so) — its own base is one of the ~1,000 core names, looked up here for the "See <base>" link.
  const shade = entry.shade || null;
  const shadeBase = shade && (CORE_NAMES || coreFallback()).find(e => e.n.toLowerCase() === shade.base.toLowerCase());
  // codes: HEX/RGB/HSL from js/explore.js's codes(), plus Lab (the space every closeness number here is computed in)
  const Lab = lab(heroHex);
  const codeRows = (typeof codes === "function" ? codes(heroHex).slice(0, 3) : [["HEX", heroHex]]).concat([["LAB", `${Lab[0].toFixed(1)} ${Lab[1].toFixed(1)} ${Lab[2].toFixed(1)}`]]);
  const learnBtn = (learnC && typeof hmLearnIt === "function") || typeof prQuick === "function" ? `<button class="cp-primary" data-learnit>${mine ? "Review it" : "Learn it"}${mine ? "" : `<em>2 min</em>`}${ICON.arrow}</button>` : "";
  const primary = typeof fvHeartRow === "function" ? fvHeartRow(hex, name, learnBtn) : learnBtn ? `<div class="cp-primary-row">${learnBtn}</div>` : "";
  const el = colorDossier(entry, { tapped, primary, shadeBase, cls: "names", paintHost: `<section class="gl-in" data-npgal></section>`, codes: codeRows });
  const li = el.querySelector("[data-learnit]"); if (li) li.onclick = () => typeof prQuick === "function" ? prQuick({ seed: { n: name, h: hex } }) : hmLearnIt(learnC);   // js/practice.js (its sheet offers Learn it for any learnable name: js/learnmore.js)
  if (typeof fvWireHeart === "function") fvWireHeart(el, hex, name);   // js/favs.js
  const shBtn = el.querySelector("[data-shade-base]"); if (shBtn) shBtn.onclick = () => openCoreName(shadeBase.h, shadeBase.n);
  npPaintingsSection(el.querySelector("[data-npgal]"), hex, name);
  return el;   // so growFrom (js/core.js, js/home.js hmOpenName) can grow this page from the tapped honeycomb bubble
}

// ---------- screenshot hook: #shot=name:<slug>[@scrolldown] ----------
// Mirrors router.js's own redirect: an app color's slug opens its deep colorPage instead (same as a real
// #/name/<slug> visit), so this hook is an honest preview of production routing, not just namePage() in
// isolation.
// A library-only name (one of the ~2,716 in the big name library, but not in the ~1,000 core names) has no
// #/name/<slug> route in production — it only opens through the honeycomb tap (js/home.js hmOpenName ->
// npEntryFor), which builds its page entry live from the tapped item. This hook does the same thing, so
// design review (and the "every color page is rich" verification pass, 2026-10-08) can reach one directly.
function namesShot(arg) {
  const [slug, down] = String(arg || "greyish-white").split("@");
  const after = () => { if (down) document.body.style.marginTop = "-" + down + "px"; };
  const c = routeColor(slug);
  if (c) { XSTACK = []; openNode(colorNode(c)); return after(); }
  Promise.all([loadCoreNames(), loadLongNames()]).then(() => {
    const core = (CORE_NAMES || []).find(e => routeSlug(e.n) === slug) || (CORE_NAMES || []).find(e => e.n.toLowerCase() === slug.toLowerCase());
    const lib = !core && findLongName(slug);
    const entry = core || (lib && npEntryFor({ n: lib.n, h: lib.h, lib }));
    if (!entry) return toast("No core or library name called that");
    XSTACK = [];
    namePage(entry);
    after();
  });
}
