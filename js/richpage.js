"use strict";
// The color page's shell, built to design/COLOR-PAGE-DESIGN.md (2026-10-08): the cover (relation line, name, tier
// line, a one-sentence definition with its source, hex) with a peek of the glance strip under it, five field-note
// drawers (each one a headline finding, the existing computed sections inside), the "Its story lives with ..."
// twin block for a color with no article of its own, and the "Walk from here" flower with hold-to-walk. Shared by
// js/explore.js colorPage and js/names.js namePage; the sections themselves live in js/richcolor.js.
// Data: data/graph/nodes-<a-z>.json + fieldnotes/<a-z>.json (lane L6, lazy, one shard per page, read-only) and
// data/analysis/articles-lite.json (tools/build_articles_lite.py). Top-level names here start with rp.

// ---------- the graph (L6's data): one node + its field notes for a name ----------
const RP_SHARDS = new Map(), RP_ALIAS = { v: null };
const rpJSON = url => fetch(url + (typeof DATA_VER !== "undefined" && DATA_VER ? "?v=" + DATA_VER : "")).then(r => r.ok ? r.json() : null).catch(() => null);
function rpShard(kind, ch) {
  const k = kind + ch;
  if (!RP_SHARDS.has(k)) RP_SHARDS.set(k, rpJSON(kind === "n" ? `data/graph/nodes-${ch}.json` : `data/graph/fieldnotes/${ch}.json`));
  return RP_SHARDS.get(k);
}
function rpGraph(name) {
  let slug = routeSlug(name);
  return (RP_ALIAS.v ? Promise.resolve(RP_ALIAS.v) : rpJSON("data/graph/aliases.json").then(a => (RP_ALIAS.v = (a && a.alias) || {}))).then(al => {
    slug = al[slug] || slug;
    const ch = /^[a-z]/.test(slug) ? slug[0] : "_";
    return Promise.all([rpShard("n", ch), rpShard("f", ch)]).then(([ns, fs]) => ({ slug, node: (ns || []).find(x => x.s === slug) || null, fn: (fs || []).find(x => x.s === slug) || null }));
  });
}
let RP_ART = null;
const rpArticles = () => RP_ART || (RP_ART = rpJSON("data/analysis/articles-lite.json").then(l => l || []));

// ---------- the cover ----------
const RP_TIER = { "pigment-mineral-dye": "A pigment, dye or mineral name", "traditional-system": "A traditional color name", nature: "Named from nature", "place-institution": "Named after a place or an institution",
  person: "Named after a person", "standard-system": "A standard's name", commercial: "A brand name", "descriptive-modifier": "A described shade", "basic-term": "A basic color word", undocumented: "Origin undocumented" };
const RP_FS = { since: y => `first recorded as a color word, ${y}`, ral: y => `RAL, ${y}`, "maerz-paul": y => `Maerz & Paul, ${y}`, ridgway: y => `Ridgway, ${y}`, "ridgway-1886": y => `Ridgway, ${y}`,
  "iscc-nbs": y => `ISCC-NBS, ${y}`, xkcd: y => `the crowd survey, ${y}`, werner: y => `Werner, ${y}`, pigment: y => `${y}` };
// the source-system id (js/sources.js) behind each "fs" code, when we have a page for it -- so the cover's
// second tier clause ("Named from nature · Ridgway, 1912") is tappable straight to that page (David, 2026-10-09).
const RP_FS_SRC = { ral: "ral", "maerz-paul": "maerz-paul", ridgway: "ridgway", "ridgway-1886": "ridgway", "iscc-nbs": "iscc-nbs", xkcd: "xkcd", werner: "werner", pigment: "pigment" };
function rpTierLine(node, entry) {
  if (!node) return entry && entry.src ? esc(rcTierLine(entry.src)) : "";
  const first = RP_TIER[node.tier] || ""; if (!first) return "";
  const fs = node.fs && RP_FS[node.fs], secondTxt = fs && node.fy && node.fy > 0 ? fs(node.fy) : "";   // a negative year is a prehistoric pigment, not a word
  if (!secondTxt) return esc(first);
  const sysId = RP_FS_SRC[node.fs];
  let secondHTML;
  if (sysId && typeof srcLinkHTML === "function") {
    const m = /^([^,]+)(,.*)?$/.exec(secondTxt);
    secondHTML = m ? srcLinkHTML(sysId, m[1]) + esc(m[2] || "") : esc(secondTxt);
  } else secondHTML = esc(secondTxt);
  return `${esc(first)} · ${secondHTML}`;
}
const rpCap = s => s.charAt(0).toUpperCase() + s.slice(1);
// definition (truth pass, 2026-10-08): the story's own first sentence (cut at its colon when long), else the color's
// authored line, else the ISCC-NBS descriptor when it doesn't contradict the name's own modifier ("Light Rosolane
// Purple" is never "Deep purplish pink"), else a differential definition from the nearest named neighbor. A
// sentence of three words or fewer ("Dark blue.") never wins over a real one, and the source is never "ColorHub".
const RP_LIGHT_W = /\b(light|pale|bright|brilliant|pastel|baby|powder|pallid)\b/i, RP_DARK_W = /\b(dark|deep|blackish|dusky)\b/i;
const rpContradicts = (name, desc) => (RP_LIGHT_W.test(name) && RP_DARK_W.test(desc)) || (RP_DARK_W.test(name) && /\b(light|pale|brilliant|pallid)\b/i.test(desc));
function rpFirstSentence(t) {
  let s = String(t || "").split(/(?<=[.!?])\s/)[0].trim();
  if (s.length > 150) s = s.split(/[:;\u2014]\s?/)[0].replace(/[,\s]+$/, "") + ".";
  return s.length <= 150 && s.split(/\s+/).length >= 4 ? s : "";
}
function rpDefinition(name, hex, node, art) {
  if (art && art.lede) { const s = rpFirstSentence(art.lede); if (s) return { t: s, src: art.n ? `From its story · ${art.n} source${art.n === 1 ? "" : "s"}` : "From its story" }; }
  const own = BYNAME.get(String(name).toLowerCase()), ownLine = own && (own.o || own.d);   // a basic word's authored line beats a measured one
  if (ownLine) {
    const s = rpFirstSentence(ownLine);
    const w = s && typeof colorNode === "function" && typeof WIKI_OK !== "undefined" && WIKI_OK ? (colorNode(own) || {}).wiki : null, ns = w && w.sources ? w.sources.length : 0;
    if (s) return { t: s, src: ns ? `From its story · ${ns} source${ns === 1 ? "" : "s"}` : "" };
  }
  if (node && node.iscc && node.iscc.n && node.iscc.de <= 5 && !rpContradicts(name, node.iscc.n)) return { t: `${rpCap(node.iscc.n)}.`, src: "ISCC-NBS, 1955" };
  const near = (CORE_NAMES || coreFallback()).map(e => ({ e, d: de2000(hex, e.lab || (e.lab = lab(e.h))) })).filter(x => x.e.n.toLowerCase() !== name.toLowerCase() && x.d >= 1.5).sort((a, b) => a.d - b.d)[0];
  if (!near || (node && node.tier === "basic-term")) return null;
  const diff = lookDiff({ h: near.e.h, n: near.e.n }, { h: hex, n: name });
  return { t: diff === "almost the same" ? `Almost the same as ${near.e.n.toLowerCase()}.` : `${rpCap(diff)} than ${near.e.n.toLowerCase()}.`, src: "Measured",
    near: { n: near.e.n, h: near.e.h, slug: routeSlug(near.e.n) } };   // David, 2026-10-09: this neighbor's name opens Family's Compare view, pinned on it
}
// the def line, with its neighbor's name tappable when there is one (js/family.js famOpenCompare)
function rpDefLineHTML(def) {
  if (!def) return "";
  if (!def.near) return esc(def.t);
  const label = def.near.n.toLowerCase(), i = def.t.toLowerCase().lastIndexOf(label);
  if (i < 0) return esc(def.t);
  return `${esc(def.t.slice(0, i))}<button type="button" class="rp-def-link" data-rp-cmp="${esc(def.near.slug)}" data-h="${def.near.h}">${esc(def.t.slice(i, i + label.length))}</button>${esc(def.t.slice(i + label.length))}`;
}
// Learn it's label follows the Learner Model (David, 2026-10-09): "Learn it" -> "Review" while in progress ->
// "Known" (a quiet check) once it's yours.
function rpLearnLabel(name, hex) {
  if (typeof knowState !== "function") return { t: "Learn it", known: false };
  let st = "none"; try { st = knowState({ n: name, h: hex }); } catch (e) {}
  return st === "yours" ? { t: "Known", known: true } : (st === "learning" || st === "met") ? { t: "Review", known: false } : { t: "Learn it", known: false };
}
function rpRelation(name, tapped, hex) {
  if (tapped) return "Your color";   // the match % is said once, on the hex line below
  const t = BYNAME.get(String(name).toLowerCase()), st = t && t.id && S.cards[t.id];
  if (st && isMine(st)) return st.ownAt && typeof rcDayLabel === "function" ? `Yours since ${rcDayLabel(st.ownAt)}` : "Yours";
  if (st) return "Learning";
  return "New to you";
}
// the foot stack's name fits one line at 96px, else two lines at the largest of 80/72/64, else 56
function rpFitName(h1) {
  const hero = h1.closest(".cp-hero"); if (!hero || !hero.clientWidth) return;
  const avail = hero.clientWidth - 40, cs = getComputedStyle(h1), cv = rpFitName.cv || (rpFitName.cv = document.createElement("canvas").getContext("2d"));
  const lines = (txt, px) => { cv.font = `${cs.fontStyle} ${cs.fontWeight} ${px}px ${cs.fontFamily}`; let n = 1, w = 0; txt.split(/\s+/).forEach(word => { const ww = cv.measureText(word + " ").width; if (w + ww > avail && w > 0) { n++; w = 0; } w += ww; }); return n; };
  const txt = h1.textContent;
  for (const [px, max] of [[96, 1], [80, 2], [72, 2], [64, 2]]) if (lines(txt, px) <= max) return void (h1.style.fontSize = px + "px");
  h1.style.fontSize = "56px";
}
// the tapped color's one sentence (#7): "Yours is greener and a bit lighter than teal · 96% match"
function rpYoursLine(name, hex, tapped) {
  const d = lookDiff({ h: tapped, n: "Your color" }, { h: hex, n: name }), m = pctMatch(de2000(tapped, hex));
  return d === "almost the same" ? `Yours is almost the same as ${name.toLowerCase()} · ${m}` : `Yours is ${d} than ${name.toLowerCase()} · ${m}`;
}
// One compact action row on the cover (David, 2026-10-09: "Learn it could be a small button next to the Pair
// with… button, and the heart somewhere there as well"): Learn it (small pill, the row's primary), Pair with…,
// the heart -- sized and styled to stay legible sitting right on the color itself. Below it, the quiet hex row.
function rpActionRowHTML(name, hex, tapped) {
  const learnHex = tapped || hex, label = rpLearnLabel(name, learnHex);
  const liked = typeof fvHas === "function" && fvHas(learnHex);
  return `<div class="rp-actrow">
    <button type="button" class="rp-learnpill${label.known ? " rp-learnpill-known" : ""}" data-learnit>${label.known ? ICON.check || "" : ""}<span>${esc(label.t)}</span>${!label.known ? `<em>2 min</em>` : ""}</button>
    ${typeof sxPairBtnHTML === "function" ? sxPairBtnHTML(learnHex, name) : ""}
    <button type="button" class="icon-btn rp-heart${liked ? " saved" : ""}" data-fvh data-rp-heart aria-label="${liked ? "Remove from your colors" : "Add to your colors"}" aria-pressed="${liked}">${liked ? ICON.heartOn : ICON.heart}</button>
  </div>`;
}
function rpCoverFoot(name, hex, tapped, entry) {
  const id = "rp-cov-" + Math.random().toString(36).slice(2, 8), rel = rpRelation(name, tapped, entry && entry.h || hex);
  return { id, html: `${rel ? `<span class="cp-chip">${esc(rel)}</span>` : ""}
        <h1 class="rp-name">${esc(name)}</h1>
        ${tapped ? `<p class="rp-yours">${esc(rpYoursLine(name, hex, tapped))}</p>` : `<p class="rp-tier" data-rp-tier></p>
        <p class="rp-def" data-rp-def></p><p class="rp-defsrc" data-rp-defsrc></p>`}
        ${!tapped ? rpActionRowHTML(name, hex, tapped) : ""}
        <span class="rp-hexrow"><button class="mono cp-hex" data-copy="${tapped || hex}">${tapped || hex}</button>${tapped && typeof fvSet === "function" ? `<button class="rp-saveyours" data-rp-saveyours>${typeof fvHas === "function" && fvHas(tapped) ? "Saved to your colors" : "Save your color"}</button>` : ""}</span>${tapped && typeof sxPairBtnHTML === "function" ? sxPairBtnHTML(tapped || hex, name) : ""}` };
}
// a quick, good-enough legibility lift for the liking-moment fill: blend the page's color toward white or black
// until it reads against the heart's own dark surface, without a full perceptual model (it's a decoration, not a swatch)
function rpBlendHex(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const mix = (sh) => Math.round(((pa >> sh & 255)) + (((pb >> sh & 255)) - ((pa >> sh & 255))) * t);
  return "#" + [mix(16), mix(8), mix(0)].map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0")).join("");
}
function rpLegibleFill(hex) {
  if (typeof rcContrast !== "function") return hex;
  let h = hex, i = 0; const toward = ink(hex) === "dark" ? "#FFFFFF" : "#000000";
  while (rcContrast(h, "#1F1D18") < 1.5 && i < 6) { h = rpBlendHex(h, toward, .14); i++; }
  return h;
}
// the liking moment (David, 2026-10-09): the heart fills with the page's own color (lifted if it would be
// illegible), anticipation -> impact -> settle, a haptic, and a quiet toast to the You page.
function rpLikeMoment(btn, hex, on) {
  if (!btn) return;
  const fill = rpLegibleFill(hex);
  btn.style.setProperty("--rp-heart-c", fill);
  btn.classList.remove("rp-like-go"); void btn.offsetWidth; if (on) btn.classList.add("rp-like-go");
  buzz(on ? 8 : 4);
  if (on) toast("Added to your palette", { dot: fill, ms: 1800, action: typeof go === "function" ? "You" : null, onAction: typeof go === "function" ? () => go("you") : null });
}
// Double-tap the cover's color to keep it in your colors, or let it go (David, 2026-10-08), like a photo you love: a heart
// blooms where you tapped, with a haptic and the color's own note. A single tap, once ~250ms pass with no second tap,
// opens the full-screen focus view (David, 2026-10-09) instead -- so the two gestures never race each other. A tap on
// the hex, a button or a link is always theirs alone, immediately, with no wait for either gesture.
function rpCoverLike(el, name, hex) {
  const hero = el.querySelector(".cp-hero"); if (!hero || typeof fvSet !== "function") return;
  let last = null, singleT = 0;
  hero.addEventListener("pointerup", e => {
    if (!e.isPrimary || e.button > 0 || e.target.closest("button, a, input, [data-copy], [data-back], [data-tl-exit]")) { last = null; if (singleT) { clearTimeout(singleT); singleT = 0; } return; }
    const now = performance.now();
    if (last && now - last.t <= 320 && Math.hypot(e.clientX - last.x, e.clientY - last.y) <= 32) {
      if (singleT) { clearTimeout(singleT); singleT = 0; }
      last = null;
      const on = !fvHas(hex), btn = el.querySelector("[data-rp-heart]");
      if (btn) { rpLikeMoment(btn, hex, on); btn.innerHTML = on ? ICON.heartOn : ICON.heart; btn.classList.toggle("saved", on); btn.setAttribute("aria-pressed", on); fvPageSet(el, hex, name, on); }
      else fvPageSet(el, hex, name, on);
      if (on && typeof sfxColor === "function") sfxColor(hex);
      const r = hero.getBoundingClientRect(), b = document.createElement("i");
      b.className = "fva-bloom rp-like" + (on ? "" : " off"); b.innerHTML = on ? FVA_HEART_ON : FV_HEART;
      b.style.left = e.clientX - r.left + "px"; b.style.top = e.clientY - r.top + "px"; b.style.color = ink(hex) === "dark" ? "#1A1814" : "#F2EEE6";
      hero.appendChild(b); setTimeout(() => b.remove(), 900);
      if (!btn) toast(on ? "In your colors" : "Taken out of your colors", { dot: hex, ms: 1600 });
      return;
    }
    last = { t: now, x: e.clientX, y: e.clientY };
    if (singleT) clearTimeout(singleT);
    const cx = e.clientX, cy = e.clientY;
    singleT = setTimeout(() => { singleT = 0; if (typeof rpOpenFocus === "function") rpOpenFocus(name, hex, cx, cy); }, 260);
  });
}
// ---------- the focus view (David, 2026-10-09): a tap on the cover's bare fill takes the color full screen, so you
// can look at it alone. The name sits small and quiet, fading after ~2s; a tap while it's dim brings it back; a tap
// while it's lit, or a swipe down, returns exactly to the page. Grows from where you tapped; a reduced-motion visitor
// gets a plain fade instead. Keeps the screen awake while open, when Wake Lock exists.
// David, 2026-10-09: "same full-screen preview for a pair or more." One shared view: colorFocus(colors) takes 1 or
// more { name, hex } and shows them full screen -- a single color exactly as before, 2-3 as full-height side-by-side
// bands, 4+ (or a narrow viewport, where side-by-side would squeeze each band to a sliver) stacked instead. Used by
// both the color page's cover (rpOpenFocus, the 1-color case below) and the set page (js/setpage.js).
let RP_FOCUS = null;
function colorFocus(colors, opts = {}) {
  if (RP_FOCUS || !colors || !colors.length) return;
  // 4+ always stacks (full-width, so each band stays a real band, not a sliver); a pair or trio stays side by
  // side down to a real phone width (375-440px: David's own device and the smoke harness both live there) and
  // only falls back to stacked below that -- "pick what reads best" (David, 2026-10-09), not a fixed rule
  const { cx, cy } = opts, multi = colors.length > 1, stacked = colors.length >= 4 || innerWidth < 340;
  const reduce = typeof reduceMotion !== "undefined" && reduceMotion;
  const ov = document.createElement("div");
  ov.className = "rp-focus" + (multi ? " cf-multi" + (stacked ? " cf-stack" : "") : "");
  // David, 2026-10-09: "tapping the color to go full screen shouldn't let me scroll down in the full screen --
  // right now it does." lockScroll() (js/core.js) is the one iOS-safe body lock every sheet already uses (pins
  // the body at its own scroll offset instead of overflow:hidden, which would jump it to the top); touch-action
  // plus a direct touchmove preventDefault stop the rubber-band itself on the layer's own full-viewport touches,
  // which the body lock alone doesn't reach (iOS can still rubber-band a fixed element under a live touch).
  ov.style.touchAction = "none";
  ov.addEventListener("touchmove", e => e.preventDefault(), { passive: false });
  if (!multi) {
    // the single-color case: one full fill, with only the quiet corner tag -- no centered name (David, 2026-10-10:
    // "full-screen color shouldn't show the name in the middle, keep it only in the corner" -- the color field
    // itself should read clean, the corner tag is the one label, same as the multi/band case always was below)
    const { name, hex } = colors[0];
    ov.setAttribute("data-ink", ink(hex));
    ov.style.setProperty("--c", hex);
    ov.style.setProperty("--ox", (cx != null ? cx / innerWidth * 100 : 50) + "%");
    ov.style.setProperty("--oy", (cy != null ? cy / innerHeight * 100 : 50) + "%");
    // the color's own name and hex, quietly in a corner -- a museum label, not part of "alone with the color".
    // David, 2026-10-09: "the color's name is in a small, ugly font -- not as pretty as before going full screen"
    // -- the app's own display type (the serif display face at a generous size), the hex quietly beneath it in
    // the sans, same contrast-aware ink (data-ink, already set above) either way.
    ov.innerHTML = `<div class="rp-focus-tag"><p class="rp-focus-tag-name">${esc(name)}</p><p class="rp-focus-tag-hex">${esc(String(hex).toUpperCase())}</p></div>`;
  } else {
    // 2+ colors: full-height (or, stacked, full-width) bands, each with its own name + hex in its own corner,
    // by its own contrast -- no single big name makes sense once there's more than one color to look at alone
    ov.innerHTML = colors.map(({ name, hex }) =>
      `<div class="cf-band" style="--c:${hex}" data-ink="${ink(hex)}"><div class="rp-focus-tag"><p class="rp-focus-tag-name">${esc(name)}</p><p class="rp-focus-tag-hex">${esc(String(hex).toUpperCase())}</p></div></div>`).join("");
  }
  document.body.appendChild(ov);
  RP_FOCUS = ov;
  lockScroll();
  let wakeLock = null;
  try { if (navigator.wakeLock && navigator.wakeLock.request) navigator.wakeLock.request("screen").then(w => wakeLock = w).catch(() => {}); } catch (e) {}
  requestAnimationFrame(() => ov.classList.add("on"));
  let closed = false;
  const close = () => {
    if (closed) return; closed = true;
    if (wakeLock) { try { wakeLock.release(); } catch (e) {} }
    document.removeEventListener("keydown", onKey2);
    unlockScroll();
    ov.classList.remove("on"); ov.classList.add("closing"); buzz(4);
    RP_FOCUS = null;
    if (reduce) ov.remove(); else setTimeout(() => ov.remove(), 280);
  };
  const onKey2 = e => { if (e.key === "Escape") close(); };
  document.addEventListener("keydown", onKey2);
  // lives on <body>, same reason js/richpage.js's own rp-bar and js/paintzoom.js's "Look closer" scrim do (escaping
  // the screen's own entrance-animation transform to stay viewport-fixed) -- so, same as those, it needs its own
  // cleanup: without this, swiping back (or any navigation) while the focus view was open left this full-viewport
  // color fill stuck over whatever page came next (David's "the screen goes black" report, 2026-10-09, was this
  // same leak class in js/paintzoom.js; this is the sibling overlay that opens from the cover itself). close()
  // also restores the scroll lock (unlockScroll), so a navigation that skips the swipe-down/tap close still
  // leaves the next screen free to scroll.
  cleanup.push(close);
  // a tap anywhere, or a swipe down, always returns to the page -- there's no big name to dim/bring back any
  // more (David, 2026-10-10), so the single-color case now behaves exactly like the multi/band case always did.
  let dragging = false;
  ov.addEventListener("pointerdown", () => { dragging = true; });
  ov.addEventListener("pointerup", () => { if (dragging) { dragging = false; close(); } });
}
// the single-color entry point (the cover's own tap): rpCoverLike above, and the design-review shot hook
// (js/boot.js #shot=rpfocus:<name>@<hex>), both still call this directly
function rpOpenFocus(name, hex, cx, cy) { colorFocus([{ name, hex }], { cx, cy }); }
function rpCoverFill(el, name, hex, heroHex, entry) {
  const h1 = el.querySelector(".rp-name"); if (h1) { rpFitName(h1); if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => h1.isConnected && rpFitName(h1)); }
  // the story itself (js/article.js arLoad, cached: the story slot reads the same file), not the small lite index
  const own = rpGraph(name).then(g => typeof arLoad === "function" ? Promise.all([g, arLoad(g.slug).then(a => a || arLoad(routeSlug(name)))]) : [g, null]);
  own.then(([g, a]) => {
    if (!el.isConnected) return;
    const tier = rpTierLine(g.node, entry), def = rpDefinition(name, hex, g.node, a ? { lede: a.lede, n: a.notes ? a.notes.size : 0 } : null);
    const q = s => el.querySelector(s);
    el.querySelectorAll("[data-rp-tier]").forEach(t => t.innerHTML = tier);   // the cover and the ID card say the same thing
    if (def && q("[data-rp-def]")) {
      q("[data-rp-def]").innerHTML = rpDefLineHTML(def); q("[data-rp-defsrc]").textContent = def.src;
      const cmp = q("[data-rp-cmp]"); if (cmp) cmp.onclick = () => rpOpenFamilyCompare(el, cmp.dataset.rpCmp, cmp.dataset.h);
    }
    el.querySelectorAll(".rp-cov-hold").forEach(x => x.classList.add("in"));
    el.dataset.coverReady = "1";   // the cover's words are in: the title won't move again (js/mapxfer.js waits for this)
  });
}
// the cover's near-neighbor line opens Family in Compare, pinned on it (js/family.js famOpenCompare); waits for
// the article/Family host to have loaded if the tap lands before it has.
function rpOpenFamilyCompare(el, slug, hex) {
  const go = () => { if (el.__artData && el.__famHost && typeof famOpenCompare === "function") famOpenCompare(el.__famHost, el.__artData.self, (el.__artData.art && el.__artData.art.aside) || {}, slug, hex); else toast("Loading its family…"); };
  if (el.__artPromise) el.__artPromise.then(go); else go();
}

// ---------- the glance strip (a peek of it sits under the cover) ----------
const RP_ROLE = ["shadow", "mid-tone", "light", "accent"];
function rpGlanceCards(name, hex, g, reach) {
  const out = [], ar = g.fn && g.fn.ar, fact = k => ((g.fn && g.fn.facts) || []).find(f => f.k === k);
  if (reach && reach[0] > 10 && reach[3] === 0) out.push({ s: 100, w: "the paintings", fig: pctFmt(reach[0]), text: `No painting in our archive reaches it; the closest is ${pctDiff(reach[0])}. It's a modern color.`, door: "paint", swatch: reach[2] });
  const fsn = fact("first-seen");
  if (fsn && fsn.before_record && ar && ar.fs && g.node && g.node.tier === "pigment-mineral-dye") { const m = /That is ([\d,]+) years before/.exec(fsn.t); if (m) out.push({ s: 20, w: "the paintings", fig: String(ar.fs.y), text: `First seen in our archive ${m[1]} years before the name's earliest record: a look-alike hue in an aged photograph, not proof of the pigment.`, door: "paint" }); }
  if (ar && ar.pc && ar.pc.lift >= 2.5 && ar.pc.obs >= 8) out.push({ s: 65, w: "the paintings", fig: `${ar.pc.y}s`, text: `Its peak in paintings: the ${ar.pc.y}s, at ${ar.pc.lift}× the rate the same museums would predict.`, door: "paint" });
  if (ar && ar.role && ar.n >= 20) { const mx = Math.max(...ar.role.slice(0, 4)), i = ar.role.indexOf(mx); if (mx >= 55) out.push({ s: 70, w: "the paintings", fig: `${mx}%`, text: `of its matches in paintings play the ${RP_ROLE[i]}${i === 3 ? ": a small, strong touch" : ""}.`, door: "paint" }); }
  if (ar && ar.rp != null && (ar.rp >= 90 || ar.rp <= 10)) out.push({ s: 60, w: "measured", fig: `${ar.rp}%`, text: ar.rp >= 90 ? "of the named colors are rarer than it in the archive." : "of the named colors are more common than it in the archive.", door: "paint" });
  const co = fact("company"); if (co) { const m = /lift ([\d.]+)/.exec(co.t); if (m) out.push({ s: 55, w: "the paintings", fig: `${m[1]}× chance`, text: co.t.split(/(?<=\))\./)[0].replace(/\s*\(lift.*$/, "") + ".", door: "company" }); }
  if (g.node && g.node.since && g.node.since.y) out.push({ s: 50, w: "the words", fig: g.node.since.y < 0 ? (g.node.since.y <= -10000 ? `about ${Math.abs(g.node.since.y).toLocaleString()} years ago` : `${Math.abs(g.node.since.y)} BCE`) : String(g.node.since.y), text: `${g.node.since.what}.`, door: "words" });
  if (g.fn && g.fn.ng && g.fn.ng.adj && g.fn.ng.adj.pk) out.push({ s: 45, w: "the words", fig: `${g.fn.ng.adj.pk}s`, text: "The color word's peak in printed English (Google Books, the color sense).", door: "words" });
  if (ar && ar.nph) out.push({ s: 40, w: "the paintings", fig: String(ar.nph), text: "paintings in our archive hold a color close to it, as photographed.", door: "paint" });
  out.sort((a, b) => b.s - a.s);
  const pick = [], per = {};
  for (const c of out) { if (pick.length >= 4) break; if ((per[c.w] || 0) >= 2) continue; per[c.w] = (per[c.w] || 0) + 1; pick.push(c); }
  return pick;
}
function rpGlanceHTML(name, hex) {
  const id = "rp-glance-" + Math.random().toString(36).slice(2, 8);
  Promise.all([rpGraph(name), rcLoadReach()]).then(([g, rr]) => {
    const box = document.getElementById(id); if (!box) return;
    const cards = rpGlanceCards(name, hex, g, rr && rr[name]);
    if (cards.length < 2) { box.remove(); return; }
    box.classList.remove("rp-wait");
    box.innerHTML = cards.map(c => `<button class="rp-card" data-rp-door="${c.door}"><small>${esc(c.w.charAt(0).toUpperCase() + c.w.slice(1))}</small><b>${esc(c.fig)}</b><span>${esc(c.text)}</span></button>`).join("");
  });
  return `<div class="rp-glance rp-wait" id="${id}"><i></i><i></i></div>`;
}

// ---------- five field-note drawers ----------
function rpDrawer(id, title, body, head) {
  return `<details class="rp-drawer" data-rp-drawer="${id}"><summary><span class="rp-d-name">${esc(title)}</span><span class="rp-d-head" data-rp-head="${id}">${head || ""}</span><i aria-hidden="true"></i></summary><div class="rp-d-body">${body}</div></details>`;
}
function rpDrawersHTML(entry, name, hex, famC, paintHost, o = {}) {
  const call = (f, ...a) => typeof f === "function" ? f(...a) : "";
  const paint = `${paintHost}${call(rcRolePaintingsHTML, name, hex)}${call(rcReachSection, name, hex)}${call(rcRoleSection, name, hex)}${call(rcPaintersSection, name, hex)}${call(rcWhenWhereSection, name, hex)}`;
  const words = `<div class="c-poems"></div>${call(archiveRows, entry, "books", famC)}`;
  const world = `${call(rcWernerLine, name, hex)}${call(btRow, entry, famC)}${call(gmRow, entry, famC)}${call(bdRow, entry, famC)}${call(doRow, entry, famC)}<section class="fx-in" data-world-in></section>${call(archiveRows, entry, "films", famC)}`;
  const measured = `${rcMeasuredHTML(hex)}${rcMixHTML(hex)}${rcHarmonyHTML(hex, name)}`;
  const [L, C] = lch(hex);
  rcPercentileCaches();
  const lp = rcPercentile(RC_LSORT, L), cp = rcPercentile(RC_CSORT, C);
  const mhead = `${lp >= 50 ? "Lighter" : "Darker"} than ${lp >= 50 ? lp : 100 - lp}% of named colors, ${cp >= 50 ? "more vivid" : "duller"} than ${cp >= 50 ? cp : 100 - cp}%.`;
  return `<section class="rp-notes"><div class="rp-notes-head"><h2>Field notes</h2><small>measured, as photographed</small></div>
    ${rpDrawer("paint", "In paintings", paint)}${rpDrawer("company", "Its company", rcPairedSection(name, hex))}${rpDrawer("words", "In words", words)}${rpDrawer("world", "In the world", world)}${rpDrawer("measured", "Measured", measured, esc(mhead))}${rpNamesDrawer(entry, name, hex, o)}</section>`;
}
function rpDrawersWire(el, name, hex) {
  if (typeof rcWireYou === "function") rcWireYou(el, name, hex);
  const drawers = [...el.querySelectorAll(".rp-drawer")];
  const open = (id, scroll) => { drawers.forEach(d => { const on = d.dataset.rpDrawer === id; if (on) d.open = true; else if (d.open) d.open = false; if (on && scroll) setTimeout(() => d.scrollIntoView({ block: "start", behavior: reduceMotion ? "auto" : "smooth" }), 30); }); };
  drawers.forEach(d => d.querySelector("summary").addEventListener("click", () => { if (!d.open) drawers.forEach(o => { if (o !== d) o.open = false; }); }));
  // a paintings figure is a door to its evidence: the color's own In paintings page (js/paintingsof.js); other cards open their drawer
  el.addEventListener("click", e => { const b = e.target.closest("[data-rp-door]"); if (!b) return; if (b.dataset.rpDoor === "paint" && typeof paintingsOfPage === "function") return paintingsOfPage([hex], { back: true }); open(b.dataset.rpDoor, true); });
  // headlines, and a drawer with nothing in it is not drawn
  const head = (id, t) => { const h = el.querySelector(`[data-rp-head="${id}"]`); if (h && t && !h.textContent) h.textContent = t; };
  rpGraph(name).then(g => {
    const f = k => ((g.fn && g.fn.facts) || []).find(x => x.k === k), ar = g.fn && g.fn.ar;
    const sent = t => t && t.split(/(?<=[.!?])\s/)[0];
    const cen = f("century"), pres = f("presence"), role = f("role"), co = f("company"), word = f("word");
    head("paint", role ? sent(role.t) : pres ? sent(pres.t) : cen ? sent(cen.t).replace(/:.*$/, ".") : "");
    head("company", co ? sent(co.t) : "");
    head("words", word ? sent(word.t) : g.node && g.node.since ? `${g.node.since.what}.` : "");
  });
  const settle = () => {
    drawers.forEach(d => {
      const id = d.dataset.rpDrawer, body = d.querySelector(".rp-d-body");
      if (id === "measured" || id === "names") return;
      const has = body.textContent.replace(/\s+/g, "").length > 30 || body.querySelector("img,.gl-pin,.kin,.pm-q,.arch-quote,.film-row,.wd-in");
      d.hidden = !has;
      if (has && id === "world" && typeof csActions === "function" && typeof colorSet === "function" && !body.querySelector(".cs-acts")) {
        // the twins' colors as a set: Learn them, put them on the map (js/colorset.js); each twin row itself opens its page in one tap
        const hs = [...body.querySelectorAll(".kin i, .wd-in i, .film-strip i")].map(i => i.style.getPropertyValue("--c").trim()).filter(Boolean);
        if (hs.length >= 2) body.appendChild(csActions(colorSet({ kind: "twins", id: routeSlug(name), title: `${name} in the world`, colors: hs.map(h => ({ h })), src: "color/" + routeSlug(name) }), { only: ["learn", "map"], back: () => {} }));
      }
      // real twins only (gems, flowers, films, as they're titled), never fashion decades
      if (has && id === "world") head("world", (() => { const t = [...body.querySelectorAll(".kin b,.film-row b")].map(x => x.textContent.trim()).filter(x => x && !/^\d{4}s$/.test(x)).slice(0, 3); return t.length ? `Its twins: ${t.join(", ")}.` : ""; })());
      if (has && id === "paint") head("paint", (() => { const p = body.querySelector(".rc-reach-stat b"); return p ? `${p.textContent} in the archive come close, as photographed.` : ""; })());
      if (has && id === "company") head("company", (() => { const k = body.querySelector(".kin b"); return k ? `Set beside ${k.textContent} more than chance.` : ""; })());
      // the best line, quoted and attributed when it's short enough (15 words), else nothing
      if (has && id === "words") head("words", (() => { const q = body.querySelector(".pm-q"); if (!q) return ""; const line = q.querySelector(".pm-q-line").textContent.trim(), by = (q.querySelector("small") || {}).textContent || "";
        return line.split(/\s+/).length <= 15 && by ? `\u201c${line.replace(/[,;:]$/, "")}\u201d \u2014 ${by.split(" · ")[0]}` : ""; })());
    });
  };
  const mo = new MutationObserver(() => requestAnimationFrame(settle));
  drawers.forEach(d => mo.observe(d.querySelector(".rp-d-body"), { childList: true, subtree: true, characterData: true }));
  cleanup.push(() => mo.disconnect());
  setTimeout(settle, 60);
}

// ---------- "Its story lives with ...": the twin block for a color with no article of its own ----------
function rpTwinLabel(d) { return d < 1 ? "Identical on screen" : d < 2.5 ? "Almost identical" : d < 6 ? "A near twin" : "Its nearest story"; }
function rpTwinHTML(name, hex) {
  const id = "rp-twin-" + Math.random().toString(36).slice(2, 8);
  Promise.all([rpArticles(), rpGraph(name)]).then(([arts, g]) => {
    const box = document.getElementById(id); if (!box) return;
    if (arts.some(a => a[0] === g.slug || (a[6] || []).some(n => n.toLowerCase() === name.toLowerCase()))) { box.remove(); return; }   // it has a story of its own (the article slot)
    const near = arts.map(a => ({ a, d: de2000(hex, a[2]) })).filter(x => x.d <= 20 && x.a[3] >= 150).sort((p, q) => p.d - q.d).slice(0, 3);
    if (!near.length) { box.remove(); return; }
    const c = near[0], rich = c.d < 2.5, rows = rich ? near.slice(1) : near;
    const [slug, tname, thex, words, ttier, lede] = c.a, d = c.d, sentences = lede.split(/(?<=[.!?])\s/).slice(0, 2).join(" ");
    const decDigits = pctMatchDecimal(near.map(x => x.d));   // more than one match shown on this page: never a false tie
    const diff = lookDiff({ h: thex, n: tname }, { h: hex, n: name }), dl = Math.abs(lab(hex)[0] - lab(thex)[0]);
    const mine = g.node && g.node.tier, kindMine = RP_TWINKIND[mine] || "a name", kindTheirs = RP_TWINKIND[({ pigment: "pigment-mineral-dye", traditional: "traditional-system", nature: "nature", place: "place-institution", person: "person", standard: "standard-system", commercial: "commercial" })[ttier]] || "a name";
    const how = `${esc(name)} is ${esc(diff)}${dl < 2 ? ", at the same depth" : ""}. It is ${kindMine}; ${esc(tname)} is ${kindTheirs}. The story is ${esc(tname)}'s, shown here because the two look alike.`;
    const full = words >= 600;
    const rowsHTML = rows.map(x => { const [, rn, rh, rw, , rl] = x.a, first = (rl.split(/(?<=[.!?])\s/)[0] || "").trim();
      return `<button class="rp-ns-row" data-rp-twin="${esc(rn)}" data-h="${rh}"><span class="rp-ns-sw"><i style="--c:${hex}"></i><i style="--c:${rh}"></i></span>
        <span class="rp-ns-t"><b>${esc(rn)}</b><em>${pctMatch(x.d, decDigits)}</em><span class="rp-ns-l">${esc(first)}</span><span class="rp-ns-m">${Math.max(1, Math.round(rw / 220))} min read</span></span>${ICON.arrow}</button>`; }).join("");
    const list = rows.length ? `<div class="rp-ns">${rich ? `<p class="rp-ns-h">More stories nearby</p>` : `<p class="rp-ns-h">Nearest stories</p><p class="rp-ns-sub">${esc(name)} has no story of its own yet. These colors do, and they look closest.</p>`}${rowsHTML}</div>` : "";
    const card = rich ? `<section class="rp-twin${full ? "" : " rp-twin-compact"}"><div class="rp-twin-split"><i style="--c:${hex}"></i><i style="--c:${thex}"></i></div>
      <p class="rp-twin-label">${rpTwinLabel(d)} · ${pctMatch(d, decDigits)}</p><h3>Its story lives with <em>${esc(tname)}</em></h3>
      ${full ? `<p class="rp-twin-lede">${esc(sentences)}</p><div class="rp-twin-how"><b>How they differ</b><p>${how}</p></div>` : `<p class="rp-twin-how-c">${how}</p>`}
      <button class="rp-twin-go" data-rp-twin="${esc(tname)}" data-h="${thex}">${full ? `Read its story · ${Math.max(2, Math.round(words / 220))} min` : `Read ${esc(tname.toLowerCase())}'s story`}${ICON.arrow}</button></section>` : "";
    box.innerHTML = card + list;
    box.querySelectorAll("[data-rp-twin]").forEach(b => { b.onclick = e => { openCoreName(e.currentTarget.dataset.h, e.currentTarget.dataset.rpTwin); }; });
  });
  return `<div id="${id}"></div>`;
}
const RP_TWINKIND = { "pigment-mineral-dye": "a pigment or dye name with a history", "traditional-system": "a traditional color name", nature: "a name taken from nature", "place-institution": "a name from a place or institution", person: "a name from a person",
  "standard-system": "a name in a standard", commercial: "a brand name", "descriptive-modifier": "a described shade", "basic-term": "a basic color word", undocumented: "a name with no documented origin" };

// ---------- Walk from here: the flower ----------
const RP_POS = { n: [0, -1], s: [0, 1], ne: [1, -.5], nw: [-1, -.5], se: [1, .5], sw: [-1, .5] };
function rpHexHTML(pos, c, extra = "") {
  const cls = `rp-hex rp-${pos}${c && c.hit ? "" : " rp-hex-empty"}`;
  if (!c.hit) return `<div class="${cls}"></div>`;
  return `<button class="${cls}" data-rc-open data-h="${c.hit.h}" data-n="${esc(c.hit.n)}" style="--c:${c.hit.h}" data-ink="${ink(c.hit.h)}"${extra}><b>${esc(c.hit.n)}</b><em>${Math.round(Math.max(0, 100 - c.hit.de))}%</em></button>`;
}
function rpFlowerHTML(cells, name, hex) {
  return `<div class="rp-flower">${cells.map(c => rpHexHTML(c.pos, c)).join("")}<div class="rp-hex rp-c" style="--c:${hex}" data-ink="${ink(hex)}"><b>${esc(name)}</b><em class="mono">${hex}</em></div></div>`;
}
// ---------- Walk from here: a honeycomb you can drag outward (David, 2026-10-08) ----------
// Axial hex grid centred on this color. Rings are filled lazily as you pan: each new cell takes the unplaced name
// closest (CIELAB) to the cells already around it, so neighbors on screen are neighbors in color.
const RP_HS = 56, RP_GAP = 1.025, RP_DIR = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
function rpHexXY(q, r) { return [1.5 * RP_HS * q * RP_GAP, Math.sqrt(3) * RP_HS * (r + q / 2) * RP_GAP]; }
function rpPos(q, r) { return rpHexXY(q, r); }
function rpRingOf(c) { return Math.max(Math.abs(c.q), Math.abs(c.r), Math.abs(c.q + c.r)); }
function rpRing(n) {
  if (n === 0) return [[0, 0]];
  const out = []; let q = -n, r = n;
  for (let d = 0; d < 6; d++) for (let i = 0; i < n; i++) { out.push([q, r]); q += RP_DIR[d][0]; r += RP_DIR[d][1]; }
  return out;
}
function rpWalkGrid(name, hex) {
  const list = (walkNameList() || coreFallback()).filter(e => !(e.src && e.src.length === 1 && e.src[0] === "jp") && e.n.toLowerCase() !== name.toLowerCase());
  list.forEach(e => { if (!e.lab) e.lab = lab(e.h); });
  const used = new Set(), cells = new Map(), L0 = lab(hex), key = (q, r) => q + "," + r;
  cells.set(key(0, 0), { q: 0, r: 0, lab: L0, self: true });
  let rings = 0;
  const d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
  const grow = n => {
    while (rings < n) {
      rings++;
      rpRing(rings).forEach(([q, r]) => {
        const nb = RP_DIR.map(([dq, dr]) => cells.get(key(q + dq, r + dr))).filter(Boolean);
        let best = null, bd = 1e12;
        for (const e of list) { if (used.has(e.n)) continue; let t = 0; for (const c of nb) t += d2(e.lab, c.lab); if (t < bd) { bd = t; best = e; } }
        if (!best) return;
        used.add(best.n);
        cells.set(key(q, r), { q, r, n: best.n, h: best.h, lab: best.lab, de: de2000(L0, best.lab) });
      });
    }
  };
  return { cells, grow, get rings() { return rings; } };
}
function rpWalkSection(name, hex) {
  const id = "rp-walk-" + Math.random().toString(36).slice(2, 8);
  const draw = () => {
    const box = document.getElementById(id); if (!box) return;
    const g = rpWalkGrid(name, hex);
    box.innerHTML = `<section class="rp-walk"><h2>Walk from here</h2><p class="rp-walk-sub">The closest colors to ${esc(name)}.</p>
      <div class="rp-hc-wrap"><div class="rp-hc" tabindex="0" aria-label="Neighborhood of ${esc(name)}"><div class="rp-hc-in"></div></div><p class="rp-hc-hint">Tap a color to walk to it</p><button class="rp-hc-back" type="button" hidden>Back to ${esc(name)}</button></div>
      <button class="rp-hc-map" type="button">Open on the map</button></section>`;
    const vp = box.querySelector(".rp-hc"), inn = box.querySelector(".rp-hc-in"), W = () => vp.clientWidth || 340, H = () => vp.clientHeight || 360;
    let ox = 0, oy = 0, sc = 1, drawn = new Set();
    const back = box.querySelector(".rp-hc-back");
    // one ring at rest; every ~70px of walking (or each step of zooming out) reveals exactly one more, never all at once
    // Walking: tap a neighbor and it becomes the center (its own closest colors appear around it); tap the centered one to open it.
    // Each step reveals one more ring, never everything. The widget only pans sideways, so vertical swipes always scroll the page.
    let travel = 0, lvl = 1, focus = { q: 0, r: 0 }; const foci = [focus];
    const hd = (a, b) => { const dq = a.q - b.q, dr = a.r - b.r; return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr)); };
    const lay = () => {
      paint();
      inn.querySelectorAll(".rp-hc-c").forEach(e => { const c = { q: +e.dataset.q, r: +e.dataset.r }; if (!e.classList.contains("rp-hc-on") && foci.some(f => hd(f, c) <= lvl)) { e.classList.add("rp-hc-on"); e.tabIndex = 0; } e.classList.toggle("rp-hc-focus", c.q === focus.q && c.r === focus.r); });
      box.querySelector(".rp-hc-hint").style.opacity = lvl > 1 || foci.length > 1 ? 0 : 1;
    };
    const reveal = () => {
      const want = Math.min(6, Math.max(1 + Math.floor(travel / 90), 1 + Math.floor((1 - sc) / .12)));
      if (want > lvl) { lvl = want; lay(); }
    };
    const apply = () => {
      inn.style.transform = `translate(${W() / 2 + ox}px,${H() / 2 + oy}px) scale(${sc})`;
      back.hidden = !(Math.hypot(ox, oy) > Math.min(W(), H()) * .6);
    };
    const goTo = (c) => {
      focus = c; if (!foci.some(f => f.q === c.q && f.r === c.r)) foci.push(c);
      const [x, y] = rpPos(c.q, c.r); vp.classList.add("glide"); ox = -x * sc; oy = -y * sc; lay(); apply(); setTimeout(() => vp.classList.remove("glide"), 450);
    };
    back.onclick = () => { sc = 1; goTo({ q: 0, r: 0 }); };
    const paint = () => {
      g.grow(Math.max(...foci.map(f => rpRingOf(f))) + lvl + 1);
      let html = "";
      g.cells.forEach(c => { const k = c.q + "," + c.r; if (drawn.has(k)) return; drawn.add(k); const [x, y] = rpPos(c.q, c.r);
        const st = `left:${(x - RP_HS).toFixed(1)}px;top:${(y - RP_HS * .866).toFixed(1)}px`;
        const rg = rpRingOf(c), on = rg <= lvl ? " rp-hc-on" : "";
        html += c.self ? `<div class="rp-hc-c rp-hc-self rp-hc-on rp-hc-focus" data-q="0" data-r="0" style="${st};--c:${hex}" data-ink="${ink(hex)}"><b>${esc(name)}</b><em>${hex}</em></div>`
          : `<button class="rp-hc-c${on}" data-q="${c.q}" data-r="${c.r}" style="${st};--c:${c.h}" data-ink="${ink(c.h)}"${on ? "" : " tabindex=-1"} data-rc-open data-h="${c.h}" data-n="${esc(c.n)}"><b>${esc(c.n)}</b><em>${Math.round(Math.max(0, 100 - c.de))}%</em></button>`; });
      inn.insertAdjacentHTML("beforeend", html);
    };
    paint(); apply();
    const ptrs = new Map(); let moved = 0, pd = 0, last = null;
    vp.addEventListener("pointerdown", e => { ptrs.set(e.pointerId, [e.clientX, e.clientY]); moved = 0; last = [e.clientX, e.clientY]; if (ptrs.size === 2) { const [a, b2] = [...ptrs.values()]; pd = Math.hypot(a[0] - b2[0], a[1] - b2[1]); } });
    vp.addEventListener("pointermove", e => {
      if (!ptrs.has(e.pointerId)) return;
      const prev = ptrs.get(e.pointerId); ptrs.set(e.pointerId, [e.clientX, e.clientY]);
      if (ptrs.size === 2) { const [a, b2] = [...ptrs.values()], d = Math.hypot(a[0] - b2[0], a[1] - b2[1]); if (pd) sc = Math.max(.4, Math.min(1.5, sc * d / pd)); pd = d; moved = 99; apply(); reveal(); return; }
      const dx = e.clientX - prev[0], dy = e.clientY - prev[1]; moved += Math.abs(dx) + Math.abs(dy);
      if (moved > 8) { ox += dx; oy += dy; vp.classList.add("drag"); travel += Math.hypot(dx, dy); apply(); reveal(); }
    });
    const up = e => { ptrs.delete(e.pointerId); pd = 0; if (!ptrs.size) setTimeout(() => vp.classList.remove("drag"), 0); };
    vp.addEventListener("pointerup", up); vp.addEventListener("pointercancel", up);
    vp.addEventListener("click", e => {
      const cell = e.target.closest(".rp-hc-c"), still = moved <= 8;
      if (!still || !cell) { if (!still) { e.stopPropagation(); e.preventDefault(); } return; }
      const c = { q: +cell.dataset.q, r: +cell.dataset.r };
      if (cell.classList.contains("rp-hc-self")) { e.stopPropagation(); e.preventDefault(); if (!(c.q === focus.q && c.r === focus.r)) goTo(c); return; }
      if (c.q === focus.q && c.r === focus.r) return;   // the centered color: the click opens its page
      e.stopPropagation(); e.preventDefault(); goTo(c);
    }, true);
    vp.addEventListener("wheel", e => { if (!e.ctrlKey) return; e.preventDefault(); sc = Math.max(.4, Math.min(1.5, sc * (e.deltaY < 0 ? 1.08 : .92))); apply(); reveal(); }, { passive: false });
    box.querySelector(".rp-hc-map").onclick = () => {
      const near = [...g.cells.values()].filter(c => !c.self).sort((p, q) => p.de - q.de).slice(0, 23);
      if (typeof colorSet === "function" && typeof csOnMap === "function") csOnMap(colorSet({ kind: "walk", id: routeSlug(name), title: `Around ${name}`, colors: [{ h: hex, n: name }, ...near.map(c => ({ h: c.h, n: c.n }))], src: "color/" + routeSlug(name) }));
    };
  };
  setTimeout(() => { draw(); if (!compassHasLibrary()) loadLongNames().then(draw).catch(() => {}); }, 0);
  return `<div id="${id}"></div>`;
}
// hold the cover: after 350 ms the flower rises under the thumb; drag to a hex, let go to open it
function rpHoldWalk(el, name, hex) {
  const hero = el.querySelector(".cp-hero"); if (!hero) return;
  let timer = 0, ov = null, sx = 0, sy = 0, hot = null;
  const end = (open) => { clearTimeout(timer); timer = 0; if (!ov) return; const t = hot && hot.classList.contains("rp-hex") ? hot : null; ov.remove(); ov = null; hero.classList.remove("rp-holding"); if (open && t && t.dataset.h) { buzz(8); openCoreName(t.dataset.h, t.dataset.n); } hot = null; };
  hero.addEventListener("pointerdown", e => {
    if (e.target.closest("button,a")) return;
    sx = e.clientX; sy = e.clientY;
    timer = setTimeout(() => {
      const { cells } = compassOf(hex, name);
      ov = document.createElement("div"); ov.className = "rp-hold";
      ov.innerHTML = `<div class="rp-hold-say"><b data-say-dir></b><span data-say-name></span></div>${rpFlowerHTML(cells, name, hex)}`;
      const fl = ov.querySelector(".rp-flower"), W = innerWidth, x = Math.min(Math.max(sx, 175), W - 175), y = Math.min(Math.max(sy, 190), innerHeight - 190);
      fl.style.left = x + "px"; fl.style.top = y + "px";
      document.body.appendChild(ov); hero.classList.add("rp-holding"); buzz(8);
      [...fl.children].forEach((c, i) => { c.style.animationDelay = i * 30 + "ms"; c.removeAttribute("data-rc-open"); });
    }, 350);
  });
  hero.addEventListener("pointermove", e => {
    if (!ov) { if (timer && Math.hypot(e.clientX - sx, e.clientY - sy) > 12) { clearTimeout(timer); timer = 0; } return; }
    const t = document.elementFromPoint(e.clientX, e.clientY), h = t && t.closest(".rp-hold .rp-hex");
    if (h !== hot) { if (hot) hot.classList.remove("hot"); hot = h; if (hot) { hot.classList.add("hot"); buzz(4); const say = ov.querySelector(".rp-hold-say"); say.querySelector("[data-say-dir]").textContent = hot.dataset.n || ""; say.querySelector("[data-say-name]").textContent = hot.querySelector("em") ? hot.querySelector("em").textContent : ""; } }
  });
  hero.addEventListener("pointerup", () => end(true));
  hero.addEventListener("pointercancel", () => end(false));
  hero.addEventListener("contextmenu", e => { if (ov) e.preventDefault(); });
}

// ---------- the sixth drawer: Names and codes (replaces the old Also called, Codes, Passport and tier footer) ----------
// "Also called" is only what a source says the color is also called (the story's own aka, or the alias you arrived
// by); the names other lists give to about this color (paint charts, crayon boxes) fold away under their own count.
function rpNamesDrawer(entry, name, hex, o) {
  const aka = (o.aka || []).filter((v, i, a) => v && v.toLowerCase() !== name.toLowerCase() && a.findIndex(x => x.toLowerCase() === v.toLowerCase()) === i);
  const other = (entry.also || []).filter(a => !aka.some(x => x.toLowerCase() === a.toLowerCase()) && a.toLowerCase() !== name.toLowerCase());
  const codes = o.codes || [];
  const stamps = entry.src && entry.src.length && typeof rcPassportHTML === "function" ? rcPassportHTML(entry.src, true) : "";
  const body = `<p class="rp-aka" data-rp-aka${aka.length ? "" : " hidden"}>${aka.length ? `Also called ${aka.map(esc).join(", ")}.` : ""}</p>
    ${entry.notes && entry.notes.length && typeof jpNoteLine === "function" ? `<p class="fine np-jp">${jpNoteLine(entry.notes)}</p>` : ""}
    ${stamps ? `<p class="rp-n-h">Listed by</p>${stamps}` : ""}<p class="fine rp-n-tier" data-rp-tier></p>
    ${other.length ? `<details class="rc-more rp-other"><summary>Other lists' names for about this color (${other.length})</summary><p class="fine">${other.map(esc).join(", ")}. Paint charts, crayon boxes and color lists, merged here because they name nearly the same color.</p></details>` : ""}
    <p class="rp-n-h">Codes</p>
    <div class="cp-codes">${codes.map(([k, v]) => `<button class="cp-code-row" data-copy="${esc(v)}"><span>${esc(k)}</span><b class="mono">${esc(v)}</b></button>`).join("")}</div>
    ${codes.some(r => r[0].startsWith("CMYK")) ? `<p class="fine cp-codes-fine">CMYK here is a rough formula, not a print profile: real values depend on the paper and press, so check them in a print workflow with a proof.</p>` : ""}
    ${(o.sources || []).length && typeof sourcesHTML === "function" ? sourcesHTML(o.sources) : ""}`;
  const n = (entry.src || []).filter(k => typeof RC_STAMPS !== "undefined" && RC_STAMPS.some(s => s[0] === k)).length;
  return rpDrawer("names", "Names and codes", body, esc(`${hex}${n ? ` · listed by ${n} naming system${n === 1 ? "" : "s"}` : ""}${aka.length ? ` · also ${aka[0]}` : ""}`));
}

// ---------- the story: head (lede) then body (chapters) sit together, straight after the cover, ahead of
// Paintings/Family/the ID card ----------
// David, 2026-10-09 restructure; 2026-10-10 reorder: articleRenderSplit (js/article.js) draws the intro into
// headHost and the chapters onward into bodyHost; js/richpage.js colorDossier places both hosts one after the
// other, with the data sections (Paintings, Family, the ID card) below them, not in between. A color with no
// article gets the twin fallback in headHost instead.
function rpStoryFill(el, name, hex, o) {
  const headHost = el.querySelector("[data-ar-head]"), bodyHost = el.querySelector("[data-ar-body]");
  if (!headHost || !bodyHost) return Promise.resolve(null);
  const twin = () => { headHost.hidden = false; if (!headHost.querySelector(".rp-twin-host")) headHost.innerHTML = `<div class="rp-twin-host">${rpTwinHTML(name, hex)}</div>`; return { has: false }; };
  if (typeof articleRenderSplit !== "function") { el.__artPromise = Promise.resolve(twin()); return el.__artPromise; }
  el.__artPromise = articleRenderSplit(routeSlug(name), headHost, bodyHost, { n: name, h: hex, facet: o.facet || null, tapped: o.tapped || null }).then(r => {
    if (!r || !r.has) return twin();
    el.__artData = { art: r.art, self: r.self }; el.__bodyHost = bodyHost;
    rpBarSync(el);
    return r;
  });
  rpFamilyFill(el);   // its own always-present slot: a long article's door never used to carry Family at all
  return el.__artPromise;
}
// Family (js/family.js) renders in its own slot between the chapters and the ID card, independent of whether
// the article above it is short (inline), long (a door card) or missing -- a door never included the chapters/
// Family/Notes that follow it (those live behind "Begin reading"), so without this Family was silently absent
// on every long article's color page (David, 2026-10-09, caught on Olive while craft-reviewing a color with
// children: Scarlet, Olive and ~260 of the richest articles are all door-length).
function rpFamilyFill(el) {
  const host = el.querySelector("[data-ar-fam-host]"); if (!host || !el.__artPromise) return;
  el.__artPromise.then(r => {
    if (!r || !r.has || !host.isConnected || typeof arFamilyHTML !== "function") return;
    const html = arFamilyHTML(r.art, r.self);
    if (!html) return;   // no parent/siblings/children/disambiguation: nothing to show, same as any other empty section
    host.innerHTML = html; host.hidden = false; el.__famHost = host;
    if (typeof famWire === "function") famWire(host, r.self, r.art.aside || {});
    // Family's own slot (outside head/body) never got the [data-ar-open]/[data-ar-which] click delegation that
    // arWire/arWireClicks normally give an article root -- a swatch in the tree/compare/spectrum views looked
    // tappable but did nothing (caught by tools/smoke.sh: "timed out waiting for .ar-hex[data-ar-open]...").
    if (typeof arWireClicks === "function") arWireClicks(host, r.art, r.self);
    rpBarSync(el);
  });
}

// ---------- the color header: stays when the cover scrolls away, with jump chips to the new sections ----------
function rpBarHTML(name, hex) {
  const hair = typeof rcContrast === "function" && rcContrast(hex, "#0E0D0B") < 1.6 ? " rp-bar-hair" : "";
  return `<div class="rp-bar${hair}" style="--c:${hex}" data-ink="${ink(hex)}" aria-hidden="true">
    <button class="rp-bar-back" data-rp-back aria-label="Back">${ICON.back}</button><button class="rp-bar-name" data-rp-top>${esc(name)}</button>
    <nav class="rp-bar-chips">${[["story", "Story"], ["paint", "Paintings"], ["family", "Family"], ["id", "ID"]].map(([k, t]) => `<button data-rp-jump="${k}" hidden>${t}</button>`).join("")}</nav></div>`;
}
function rpBarSync(el) {
  const has = { story: !!el.querySelector(".ar-door,.ar-head,.rp-twin"), paint: !!el.querySelector(".rp-paint"), family: !!el.querySelector(".ar-fam"), id: !!el.querySelector(".rp-idcard") };
  const bar = el.querySelector(".rp-bar") || document.querySelector("body > .rp-bar"); if (!bar) return;
  bar.querySelectorAll("[data-rp-jump]").forEach(b => { b.hidden = !has[b.dataset.rpJump]; });
}
function rpBarWire(el) {
  const bar = el.querySelector(".rp-bar"), hero = el.querySelector(".cp-hero"); if (!bar || !hero) return;
  const scrollTo = t => { if (!t) return; const y = t.getBoundingClientRect().top + scrollY - bar.offsetHeight - 8; window.scrollTo({ top: Math.max(0, y), behavior: reduceMotion ? "auto" : "smooth" }); };
  bar.addEventListener("click", e => {
    if (e.target.closest("[data-rp-back]")) return xBack();
    if (e.target.closest("[data-rp-top]")) return window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    const j = e.target.closest("[data-rp-jump]"); if (!j) return;
    const k = j.dataset.rpJump;
    if (k === "story") return scrollTo(el.querySelector(".ar-door,.ar-head,.rp-twin"));
    if (k === "paint") return scrollTo(el.querySelector(".rp-paint"));
    if (k === "family") return scrollTo(el.querySelector(".ar-fam"));
    if (k === "id") return scrollTo(el.querySelector(".rp-idcard"));
  });
  // it lives on <body>, not in the screen: the screen's entrance animation leaves a transform that would pin a fixed bar to the page.
  // Defensive: a fast Back-then-forward can call this again before the last page's own cleanup has run (David,
  // 2026-10-09: "the header disappears" -- two stale .rp-bar nodes fighting over the "on" class reads as a flicker
  // that looks like the bar vanishing), so never leave more than the one this call owns.
  document.querySelectorAll("body > .rp-bar").forEach(b => b.remove());
  document.body.appendChild(bar);
  // David, 2026-10-09: "header feels too big -- harder to read the article" -> while actively reading down, the
  // bar slims further (name + back only, the jump tabs fade out); scrolling up a little brings the tabs straight
  // back. A small threshold and a short settle avoid flicker on tiny scroll jitter; reduced motion skips the fade.
  // David, 2026-10-09 on Aero: "the collapsed sticky header overlaps the iOS status bar" / "sometimes disappears
  // while scrolling". Root cause, confirmed with a fast scripted scroll (many scroll events with no real time
  // between them, same shape as a real fast flick): bar.getAnimations() can report its own transform transition
  // stuck at playState "running" long after its declared duration has elapsed, which keeps the element pinned to
  // whatever Y it was mid-interpolation through -- the full hidden preset (reads as "disappeared"), or a small
  // residual offset (the bar IS on screen, just a few px too high, reading as "overlaps the status bar") -- the
  // bar's own padding-top (calc(var(--top) + 4px)) was never the bug (verified separately, see tools/smoke/
  // scenarios.js's "pinned header's padding clears a simulated status-bar inset" scenario). A stuck CSSTransition
  // never resolves on its own; finish() snaps it straight to its own declared end value -- exactly .on's resting
  // transform -- the moment the bar is meant to be on screen, so nothing is ever left part-way there.
  const settleOn = () => { if (bar.getAnimations) bar.getAnimations().forEach(a => { try { a.finish(); } catch (e) {} }); };
  let lastY = scrollY, dirAccum = 0;
  const check = () => {
    if (!bar.isConnected) return;
    const on = hero.getBoundingClientRect().bottom < 64;
    if (on !== bar.classList.contains("on")) { bar.classList.toggle("on", on); bar.setAttribute("aria-hidden", on ? "false" : "true"); if (on) rpBarSync(el); }
    if (on) settleOn();
    const y = scrollY, dy = y - lastY; lastY = y;
    if (!on || Math.abs(dy) < 1) { dirAccum = 0; }
    else {
      dirAccum = Math.sign(dy) === Math.sign(dirAccum || dy) ? dirAccum + dy : dy;   // keep a running total while the direction holds
      if (dirAccum > 16) { bar.classList.add("collapsed"); dirAccum = 16; }
      else if (dirAccum < -10 || y < 80) { bar.classList.remove("collapsed"); dirAccum = -10; }
    }
  };
  const onScroll = () => check();   // direct, not rAF: still updates in a background tab
  document.addEventListener("scroll", onScroll, { passive: true, capture: true });
  cleanup.push(() => { document.removeEventListener("scroll", onScroll, true); bar.remove(); });
  setTimeout(() => { rpBarSync(el); check(); }, 400);   // a Back that lands mid-page shows it at once
}

// ---------- Paintings (David, 2026-10-09: "one of the most important sections... hidden at the bottom") ----------
// First-class, high up: the lead painting as a museum label, the gallery strip + sliders + source tabs + its own
// pairing lines (js/paintingsof.js paintingsOfSection, unchanged), the painter who used it most, the decade line,
// then the remaining archive findings as plain one-liners (the old stat-card carousel, reworded). "In words" and
// "In the world" (poems, gems, botany, fashion, films) tuck in quietly at the end: real depth, no new headline.
// David, 2026-10-10: "the most informative and interesting things should be at the top" and "random statistics
// are less interesting than that" -- inside this section (the article itself now comes before it, see
// colorDossier above), the human/visual content leads: the paintings that hold the color, then who painted
// with it, when and where, what it's paired with -- poems/literature/design/fashion/brand appearances are
// secondary, after that. The numeric readings (the role bar's percentages, the archive's "N paintings come
// close" stat, the bullet findings) move into one collapsed "By the numbers" at the end, closed by default, so
// a stray statistic never outranks a painting or a painter on the way down the page. Each call is still exactly
// the function another lane owns (richcolor.js, botany.js, gems.js, brands.js, designobjects.js, world.js,
// poems.js, passages.js) -- only the order they're composed in here changed.
function rpPaintSectionHTML(name, hex, entry, famC) {
  const call = (f, ...a) => typeof f === "function" ? f(...a) : "";
  return `<section class="rp-paint" id="rp-s-paint">
    <h2>Paintings</h2>
    <div class="rp-paint-lead" data-rp-lead></div>
    <div class="gl-in" data-glin></div>
    ${call(rcRolePaintingsHTML, name, hex)}
    ${call(rcPaintersSection, name, hex)}
    ${call(rcWhenWhereSection, name, hex)}
    ${call(rcPairedSection, name, hex)}
    ${call(rcYouHTML, name, hex)}
    <div class="rp-elsewhere">
      <div class="c-poems"></div>
      ${call(archiveRows, entry, "books", famC)}
      ${call(rcWernerLine, name, hex)}
      ${call(btRow, entry, famC)}
      ${call(gmRow, entry, famC)}
      ${call(bdRow, entry, famC)}
      ${call(doRow, entry, famC)}
      <section class="fx-in" data-world-in></section>
      ${call(archiveRows, entry, "films", famC)}
    </div>
    <details class="rc-more rp-bynumbers"><summary>By the numbers</summary>
      ${call(rcRoleSection, name, hex)}
      ${call(rcReachSection, name, hex)}
      <div class="rp-findings-box" data-rp-findings></div>
    </details>
  </section>`;
}
function rpPaintFill(el, name, hex, entry, famC) {
  const sec = el.querySelector(".rp-paint"); if (!sec) return;
  const artPromise = el.__artPromise || Promise.resolve(null);
  const leadHost = sec.querySelector("[data-rp-lead]");
  artPromise.then(r => {
    const art = (r && r.art) || {}, self = (r && r.self) || { slug: routeSlug(name), n: name, h: hex };
    // articleRenderSplit (js/article.js) now shows the lead picture at the top of the article itself, in the
    // same slot every other story opens with -- a real contextual photo first, the painting that covers the
    // most of this color otherwise (David, 2026-10-09: "so all articles and pages feel equal in value"). This
    // slot only still needs to fill in when that didn't happen: a color with no article at all, where
    // rpStoryFill's twin fallback (rpTwinHTML) runs instead and has no picture of its own. r.has (not a DOM
    // check) is the right signal -- articleRenderSplit always attempts its own lead as soon as it finds an
    // article, well before that lead's own async picture-pick resolves, so a DOM check here could race it.
    if (leadHost && leadHost.isConnected && typeof arfLead === "function" && !(r && r.has)) arfLead(f => { leadHost.appendChild(f); return true; }, art, self).catch(() => {});
  });
  const gi = sec.querySelector("[data-glin]"); if (gi) galleryColorRow(gi, { n: name, h: hex });
  if (typeof rcWireYou === "function") rcWireYou(sec, name, hex);
  Promise.all([rpGraph(name), typeof rcLoadReach === "function" ? rcLoadReach() : Promise.resolve(null)]).then(([g, rr]) => {
    const box = sec.querySelector("[data-rp-findings]"); if (!box) return;
    const cards = rpGlanceCards(name, hex, g, rr && rr[name]);
    if (!cards.length) { box.remove(); return; }
    box.innerHTML = `<p class="rp-findings-h">In the archive</p><ul class="rp-findings">${cards.map(c => `<li><button type="button" data-rp-door="${c.door}"><b>${esc(c.fig)}</b> ${esc(c.text)}</button></li>`).join("")}</ul>`;
    box.addEventListener("click", e => { const b = e.target.closest("[data-rp-door]"); if (b && b.dataset.rpDoor === "paint" && typeof paintingsOfPage === "function") paintingsOfPage([hex], { back: true }); });
  });
  colorPoems(sec.querySelector(".c-poems"), entry);
  if (typeof worldColorRow === "function") worldColorRow(sec, { kind: "color", h: hex, title: name }, famC);
  // quiet: the two extra blocks collapse to nothing if they turn out empty, and so does "By the numbers" itself
  // if every one of its three readings came back empty (a color with no reach/role/findings data at all)
  setTimeout(() => {
    [".c-poems", "[data-world-in]"].forEach(s => { const x = sec.querySelector(s); if (x && !x.textContent.trim() && !x.querySelector("img,button,i")) x.remove(); });
    const nums = sec.querySelector(".rp-bynumbers");
    if (nums && !nums.querySelector("section,[data-rp-findings]")) nums.remove();
  }, 900);
}

// ---------- the ID card (David, 2026-10-09): facts, codes and sources merged into one specimen card ----------
function rpIdCardHTML() {
  return `<section class="rp-idcard" id="rp-s-id">
    <h2>ID card</h2>
    <div class="rp-id-swatch" data-rp-id-swatch></div>
    <dl class="ar-facts rp-id-facts" data-rp-id-facts></dl>
    <p class="rp-n-h">Codes</p>
    <div class="cp-codes" data-rp-id-codes></div>
    <p class="fine cp-codes-fine">CMYK here is a rough formula, not a print profile: real values depend on the paper and press.</p>
    <div class="rc-passport" data-rp-id-stamps hidden></div>
  </section>`;
}
function rpSourceValueHTML(text) {
  if (!text || typeof SOURCE_SYSTEMS === "undefined") return esc(text || "");
  for (const [id, sys] of Object.entries(SOURCE_SYSTEMS)) {
    const label = sys.short.split(",")[0];
    // match the escaped label inside the escaped text (both need the same "&" -> "&amp;" etc), but hand srcLinkHTML
    // the plain label -- it escapes its own text, so escaping twice turned "&" into the literal "&amp;" on screen
    if (new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(text)) return esc(text).replace(new RegExp(esc(label), "i"), () => srcLinkHTML(id, label));
  }
  return esc(text);
}
function rpIdCardFill(el, entry, name, hex, codes) {
  const sec = el.querySelector(".rp-idcard"); if (!sec) return;
  const sw = sec.querySelector("[data-rp-id-swatch]"); if (sw) { sw.style.setProperty("--c", hex); sw.setAttribute("data-ink", ink(hex)); }
  const codesBox = sec.querySelector("[data-rp-id-codes]");
  if (codesBox) codesBox.innerHTML = codes.map(([k, v]) => `<button class="cp-code-row" data-copy="${esc(v)}"><span>${esc(k)}</span><b class="mono">${esc(v)}</b></button>`).join("");
  const famC = typeof rcFamC === "function" ? rcFamC(hex) : null;
  (el.__artPromise || Promise.resolve(null)).then(r => {
    const art = r && r.art, o = (art && art.aside && art.aside.origin) || {};
    const rows = [];
    if (famC && famC.n && famC.n.toLowerCase() !== name.toLowerCase()) rows.push(["Family", `<button type="button" class="link" data-ar-open-fam="${esc(routeSlug(famC.n))}" data-h="${famC.h}">${esc(famC.n)}</button>`]);
    if (o.named_after) rows.push(["Named after", esc(o.named_after)]);
    if (o.first_recorded) rows.push(["First recorded", rpSourceValueHTML(o.first_recorded)]);
    const factsBox = sec.querySelector("[data-rp-id-facts]");
    if (factsBox) { factsBox.innerHTML = rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join(""); const fo = factsBox.querySelector("[data-ar-open-fam]"); if (fo) fo.onclick = () => openCoreName(fo.dataset.h, fo.textContent); }
    const stampsBox = sec.querySelector("[data-rp-id-stamps]");
    if (stampsBox && typeof RC_STAMPS !== "undefined") {
      const stamps = RC_STAMPS.filter(([k]) => (entry.src || []).includes(k));
      if (stamps.length) { stampsBox.hidden = false; stampsBox.innerHTML = stamps.map(([k, label, date]) => `<button type="button" class="rc-stamp" data-src-open="${esc(k)}"><b>${esc(label)}</b>${date ? `<em>${esc(date)}</em>` : ""}</button>`).join(""); }
    }
  });
}

// ---------- "Next: <name> ›" (David, 2026-10-09): walks the family by nearest ΔE, a tap or a swipe ----------
function rpNextHTML() { return `<div class="rp-next-rel" data-rp-next-rel hidden></div>`; }
function rpNextFill(el, name, hex) {
  const box = el.querySelector("[data-rp-next-rel]"); if (!box) return;
  (el.__artPromise || Promise.resolve(null)).then(r => {
    const aside = (r && r.art && r.art.aside) || {};
    const fam = [...arList(aside.siblings || []), ...arList(aside.children || []), ...arList(aside.parent || [])].map(s => typeof arColor === "function" ? arColor(s) : null).filter(c => c && c.n.toLowerCase() !== name.toLowerCase());
    let best = fam.map(c => ({ c, d: de2000(hex, c.h) })).sort((a, b) => a.d - b.d)[0];
    if (!best) { const list = CORE_NAMES || coreFallback(); const e = list.map(x => ({ x, d: de2000(hex, x.lab || (x.lab = lab(x.h))) })).filter(x => x.x.n.toLowerCase() !== name.toLowerCase()).sort((a, b) => a.d - b.d)[0]; if (e) best = { c: { n: e.x.n, h: e.x.h }, d: e.d }; }
    if (!best) { box.remove(); return; }
    box.hidden = false;
    box.innerHTML = `<button type="button" class="rp-next-btn" data-h="${best.c.h}" data-n="${esc(best.c.n)}"><span>Next</span><b>${esc(best.c.n)}</b>${ICON.arrow}</button>`;
    const open = () => openCoreName(best.c.h, best.c.n);
    box.querySelector("button").onclick = open;
    let tsx = 0, tsy = 0, moved = false;
    box.addEventListener("touchstart", e => { const t = e.touches[0]; if (!t) return; tsx = t.clientX; tsy = t.clientY; moved = false; }, { passive: true });
    box.addEventListener("touchmove", () => { moved = true; }, { passive: true });
    box.addEventListener("touchend", e => { const t = e.changedTouches[0]; if (!t) return; if (moved && Math.abs(t.clientX - tsx) > 60 && Math.abs(t.clientY - tsy) < 40) open(); }, { passive: true });
  });
}

// ---------- the tapped color's split cover (#7): save your exact color ----------
function rpSplitWire(el, name, hex, tapped) {
  const b = el.querySelector("[data-rp-saveyours]"); if (!b) return;
  b.onclick = () => {
    const on = !fvHas(tapped);
    fvSet(tapped, on ? `Your ${name.toLowerCase()}` : "", on, "page"); buzz(on ? 8 : 4);
    b.textContent = on ? "Saved to your colors" : "Save your color";
    toast(on ? "Saved to your colors" : "Removed from your colors");
  };
}

// ---------- one page for every color (David, 2026-10-09 restructure, replacing the Field notes grab-bag;
// 2026-10-10: the article moved up ahead of the data sections -- "articles should be way more up top... you
// read multiple paragraphs") ----------
// js/explore.js colorPage (the app's own colors) and js/names.js namePage (every other name) both draw through this,
// so every color reads in one order: cover (name, origin, action row) · the whole article, lede and chapters
// together (the first 2-3 chapters, or ~350 words, open; the rest one tap down) · Paintings and the other data
// sections · Family (Tree/Spectrum/Compare/Map) · the ID card · a quiet "Next: <relative>" row · the last line.
// Test yourself lives collapsed at the end of the chapters themselves.
// entry {n, h, src?, also?, notes?, shade?}; o: { tapped, cls, facet (a story built from the wiki, js/article.js
// arFacetArt), codes [[k, v]], node }. Returns the screen; the caller wires its own save/share icons, if any.
function colorDossier(entry, o = {}) {
  const name = entry.n, hex = entry.h, tapped = o.tapped ? String(o.tapped).toUpperCase() : null, heroHex = tapped || hex;
  const famC = typeof rcFamC === "function" ? rcFamC(heroHex) : null;
  const cover = rpCoverFoot(name, hex, tapped, entry);
  const el = show(`
    <div class="c-hero cp-hero cp-hero-full${tapped ? " rp-split" : ""}" style="--c:${heroHex};--c2:${hex}" data-ink="${ink(heroHex)}">
      <button class="cp-close" data-back aria-label="Back">${ICON.back}</button>
      <div class="cp-hero-foot">
        ${tapped ? `<div class="rp-split-band"><div class="rp-split-half rp-split-half-a" data-ink="${ink(heroHex)}"><b>Your color</b><span class="mono">${heroHex}</span></div><div class="rp-split-half rp-split-half-b" data-ink="${ink(hex)}"><b>${esc(name)}</b><span class="mono">${hex}</span></div></div>` : ""}
        ${cover.html}
        ${typeof fvPageChip === "function" ? fvPageChip(hex) : ""}
      </div>
    </div>
    ${rpBarHTML(name, heroHex)}
    ${entry.shade ? `<p class="fine np-shade">A described shade: ${esc(entry.shade.base)} made ${esc(entry.shade.mod)}${o.shadeBase ? `. <button class="link" data-shade-base>See ${esc(entry.shade.base)}</button>` : "."}</p>` : ""}
    <div class="ar-head" data-ar-head hidden></div>
    <div class="ar-body" data-ar-body hidden></div>
    ${rpPaintSectionHTML(name, heroHex, entry, famC)}
    <div class="ar-fam-host" data-ar-fam-host hidden></div>
    ${rpIdCardHTML()}
    ${rpNextHTML()}
    ${typeof linksHereHTML === "function" ? linksHereHTML({ id: "c:" + name, title: name }) : ""}
    <p class="fine rp-last">Screen colors are approximate. Painting figures are measured from museum photographs of aged, varnished paintings.</p>
  `, "article cp-page" + (o.cls ? " " + o.cls : ""));
  el.style.setProperty("--c", heroHex);   // the page's own faint tint (css/colorpage.css .screen.cp-page)
  el.querySelector("[data-back]").onclick = xBack;
  onKey = e => { if (e.key === "Escape") xBack(); };
  wireLinks(el);
  el.addEventListener("click", e => { const s = e.target.closest("[data-src-open]"); if (s) { e.preventDefault(); if (typeof sourcePage === "function") sourcePage(s.dataset.srcOpen); } });
  rpStoryFill(el, name, hex, o);
  rpCoverFill(el, name, hex, heroHex, entry);
  rpCoverLike(el, name, hex);
  // a direct tap on the heart itself, the same liking moment as the cover's double-tap (js/favs.js fvWireHeart
  // only swaps the icon; this adds the fill + toast). Guarded: namePage() also calls fvWireHeart on this page,
  // so the plain swap stays a harmless no-op fallback if this one is ever skipped.
  const heartBtn = el.querySelector("[data-rp-heart]");
  if (heartBtn && typeof fvSet === "function") heartBtn.onclick = () => {
    const on = !fvHas(hex);
    rpLikeMoment(heartBtn, hex, on); heartBtn.innerHTML = on ? ICON.heartOn : ICON.heart; heartBtn.classList.toggle("saved", on); heartBtn.setAttribute("aria-pressed", on);
    fvPageSet(el, hex, name, on);
    if (!on) toast("Removed from your colors");
  };
  rpPaintFill(el, name, heroHex, entry, famC);
  rpIdCardFill(el, entry, name, heroHex, o.codes || []);
  rpNextFill(el, name, heroHex);
  rpHoldWalk(el, name, heroHex);
  rpBarWire(el);
  if (tapped) rpSplitWire(el, name, hex, tapped);
  if (typeof rcWireOpen === "function") rcWireOpen(el, heroHex);
  el.querySelectorAll("[data-copy]").forEach(b => b.onclick = () => { try { navigator.clipboard.writeText(b.dataset.copy); toast("Copied " + b.dataset.copy); } catch (e) {} });
  // ⋯ (design/SIMPLIFY/PLAN.md §3.6/§9: "Color page: register ⋯ (Find it in paintings, See it on the map, Test
  // yourself, Codes, Share). The action row stays."). The top bar (both the floating .cp-close and the pinned
  // .rp-bar) already gets ⋯ and the place pill for free from js/trail.js tlDecorate -- this just gives ⋯
  // something to show. Codes and Test yourself already live one scroll down (the ID card, the chapters' own
  // disclosure); these entries just take you straight there instead of making you find them twice.
  // colorDossier is shared by js/explore.js colorPage() (route #/color/<slug>, ctx "color") and js/names.js
  // namePage() (route #/page/<id>, ctx "page") -- both need the same ⋯ groups for the page actually on screen.
  const rpMoreGroups = () => [
    { title: "This color", items: [
      { t: "Find it in paintings", run: () => { if (typeof paintingsOfPage === "function") paintingsOfPage([heroHex], { back: true }); } },
      { t: "See it on the map", run: () => { if (typeof mapSelect === "function") mapSelect({ title: name, colors: [{ h: heroHex, n: name }], source: "color", id: routeSlug(name), src: "color/" + routeSlug(name) }); } },
      { t: "Test yourself", run: () => {
        const sec = el.querySelector("#ar-s-questions"); if (!sec) { toast("No questions for this color yet"); return; }
        const btn = sec.querySelector("[data-ar-disc-btn]");
        if (btn && btn.getAttribute("aria-expanded") !== "true") btn.click();
        sec.scrollIntoView({ block: "start", behavior: reduceMotion ? "auto" : "smooth" });
      } },
      { t: "Codes", n: "Hex, RGB, Pantone, RAL and more", run: () => { const sec = el.querySelector(".rp-idcard"); if (sec) sec.scrollIntoView({ block: "start", behavior: reduceMotion ? "auto" : "smooth" }); } },
    ] },
    { title: "Share", items: [
      { t: "Share", run: () => {
        if (typeof sharePalette === "function") return sharePalette([{ h: heroHex }], name, h => ({ nm: nameOf(h) }));
        const url = typeof shareURL === "function" ? shareURL("color/" + routeSlug(name)) : location.href;
        if (navigator.share) navigator.share({ text: name + " · ColorHub", url }).catch(() => {});
        else { try { navigator.clipboard.writeText(url); toast("Copied the link"); } catch (e) {} }
      } },
    ] },
  ];
  // ctx "page" (#/page/<id>) is shared with js/explore.js wikiPage() -- a different, generic renderer for
  // concept/idea pages (no hex, no palette). Guard on .cp-page (only colorDossier's own screen class) so a
  // wiki page's own ⋯ stays empty (Search + Settings) instead of showing color-only actions that don't apply.
  if (typeof moreRegister === "function") { moreRegister("color", rpMoreGroups); moreRegister("page", () => document.querySelector(".cp-page") ? rpMoreGroups() : []); }
  if (typeof featureRegister === "function") featureRegister("color-test", { t: "Test yourself on a color", where: "A color · ⋯", words: ["quiz", "test", "questions"], run: () => toast("Open a color, then ⋯ · Test yourself") });
  return el;
}
