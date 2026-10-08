"use strict";
// Explore tab (redesigned 2026-10-11, DESIGN-SYSTEM.md §12 "Explore: a pager of covers"):
//  - The top level is a vertical pager of four full-bleed covers, one per part: For you, Art, Ideas, World.
//    "Colors" is dropped (the home honeycomb is the colors). Tapping a cover opens that part full screen.
//  - Art merges the old Paintings and Poems lenses: pick a color from a row of bubbles, the header takes its
//    tint, and paintings (two-column, palette bars) and poems (lines of verse) share one feed.
//  - For you / Ideas / World reuse the Pinterest-style sections built by lensSections() below; World still
//    delegates to worldMount() (js/world.js). S.lens remembers which part is open, exactly as it remembered
//    which lens chip was on before (router.js maps its value to #/explore/<art|ideas|world|saved>).
//  - Tap any pin for its closeup: the pin big, then "More like this" (its connections, each saying why).
//  - Pages: every color, idea, pigment, person, book and painting has an article full of [[links]].

let XSTACK = [];       // back stack inside Explore (closeups and pages)

// ======================================================================
// Below the pager, Explore is still a Pinterest-style feed. lensSections() recomposes it: For you (mixed),
// Harmony, Origins, Paintings (the hand-built "Featured" rail), History, Symbols, Ideas, World, Saved.
// Tap any pin for its closeup and "More like this": its connections as pins, each labeled with why, then
// connections of connections.
// ======================================================================
const ORIGIN_GROUPS = [["Flowers & plants", ["flower", "plant"]], ["Fruit, food & drink", ["fruit", "food", "drink"]], ["Gems, stones & metals", ["gem", "mineral", "metal"]], ["Animals", ["animal"]], ["Places & people", ["place", "person"]], ["Materials & dyes", ["material", "dye"]], ["Sky & nature", ["nature"]], ["Plain color words", ["abstract"]]];
const ERAS = [["Prehistory", -1e9, -3000], ["The ancient world", -3000, 500], ["The Middle Ages", 500, 1400], ["The Renaissance", 1400, 1600], ["The 1600s", 1600, 1700], ["The 1700s", 1700, 1800], ["The 1800s", 1800, 1900], ["The 1900s and after", 1900, 1e9]];
const hash = s => { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const seeded = (arr, seed) => arr.map(x => [hash(seed + (x.id || x.title)), x]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
const ICON_HEART = sv('<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>', 20, 1.8);
const isSaved = id => (S.saved || []).includes(id);
function toggleSave(id) {
  S.saved = S.saved || [];
  const i = S.saved.indexOf(id);
  if (i >= 0) S.saved.splice(i, 1); else S.saved.unshift(id);
  save(); buzz(8);
  toast(i >= 0 ? "Removed from Saved" : "Saved");
  return i < 0;
}

// ---------- pins: every node kind has one, with an estimated height for the masonry ----------
function pin(n, extra = {}) {
  const badge = extra.rel ? `<span class="pin-badge">${esc(extra.rel)}</span>` : "";
  const why = extra.why ? `<p class="pin-why">${esc(extra.why)}</p>` : "";
  const id = esc(n.id);
  if (n.kind === "color") {
    const h = extra.h || 150 + (hash(n.id) % 4) * 26, st = n.c.id && S.cards[n.c.id];
    const cap = extra.cap != null ? extra.cap : n.wiki && n.wiki.since ? fmtYear(n.wiki.since) : n.wiki && NAMED_LABEL[n.wiki.named] ? NAMED_LABEL[n.wiki.named] : "";
    return { h: h + (why ? 44 : 0), html: `<button class="pin pin-color" data-pin="${id}"><span class="pc" style="--c:${n.h};height:${h}px" data-ink="${ink(n.h)}">${badge}${isMine(st) ? '<i class="own-dot" title="Yours"></i>' : ""}<b>${esc(n.title)}</b>${cap ? `<small>${esc(cap)}</small>` : ""}</span>${why}</button>` };
  }
  if (n.kind === "painting") {
    const ar = n.w && n.h ? n.h / n.w : .78, src = n.thumb || n.img;
    return { h: 167 * ar + 64 + (why ? 44 : 0), html: `<button class="pin pin-art" data-pin="${id}">${badge}${src ? `<img src="${esc(src)}" alt="" loading="lazy" style="aspect-ratio:${(1 / ar).toFixed(3)}">` : `<span class="noimg"></span>`}
      ${(n.palette || []).length ? `<span class="mini-pal">${n.palette.map(c => `<i style="--c:${c.h};flex:${c.share}"></i>`).join("")}</span>` : ""}<b>${esc(n.title)}</b><small>${esc(n.artist || "")}${n.year ? " · " + esc(n.year) : ""}</small>${why}</button>` };
  }
  if (n.kind === "story") {
    return { h: 236 + (why ? 44 : 0), html: `<button class="pin pin-story" data-pin="${id}" style="--g:linear-gradient(150deg,${n.cover.join(",")})">${badge}<span class="ps"><span class="eyebrow">Story · ${n.slides.length} slides</span><b>${esc(n.title)}</b><small>${esc(n.dek)}</small></span>${why}</button>` };
  }
  // pages: ideas, pigments, people, books, traditions
  const sw = (n.swatches || []).slice(0, 6), col = nodeColor(n);
  const system = extra.system && sw.length >= 3;
  if (system) {
    return { h: 64 + sw.length * 34, html: `<button class="pin pin-sys" data-pin="${id}">${badge}<span class="eyebrow">${esc(TYPE_LABEL[n.type] || "System")}</span><b>${esc(n.title)}</b>${sw.map(x => `<span class="sys-row"><i style="--c:${x.h}"></i>${esc(x.label || "")}</span>`).join("")}</button>` };
  }
  const dek = n.stub ? "" : plainText(n.dek || (n.body && n.body[0]) || "");
  return { h: 70 + 92 + (dek ? 40 : 0) + (why ? 44 : 0), html: `<button class="pin pin-page" data-pin="${id}">${badge}<span class="pp-head">${sw.length ? sw.map(x => `<i style="--c:${x.h}"></i>`).join("") : `<i style="--c:${col || "#3a3a3a"}"></i>`}</span>
    <span class="pp-body"><span class="eyebrow">${esc(TYPE_LABEL[n.type] || "Page")}${n.year != null ? ` · ${esc(fmtYear({ year: n.year }))}` : ""}</span><b>${esc(n.title)}</b>${dek ? `<small>${esc(dek.length > 110 ? dek.slice(0, 108) + "…" : dek)}</small>` : ""}</span>${why}</button>` };
}
function pairPin(a, b, label) {
  return { h: 190, html: `<button class="pin pin-pair" data-pin="${esc(a.id)}"><span class="pair2"><span style="--c:${a.h}" data-ink="${ink(a.h)}"><b>${esc(a.title)}</b></span><span style="--c:${b.h}" data-ink="${ink(b.h)}"><b>${esc(b.title)}</b></span></span><small>${esc(label)}</small></button>` };
}
// two columns, each pin placed in the shorter one
function masonry(pins) {
  const cols = [[], []], hgt = [0, 0];
  pins.forEach(p => { const k = hgt[0] <= hgt[1] ? 0 : 1; cols[k].push(p.html); hgt[k] += p.h + 10; });
  return `<div class="masonry"><div>${cols[0].join("")}</div><div>${cols[1].join("")}</div></div>`;
}

// ---------- what each lens shows ----------
function lensSections(lens) {
  const g = graph(), nodes = [...g.nodes.values()];
  const colors = nodes.filter(n => n.kind === "color"), paintings = nodes.filter(n => n.kind === "painting" && !n.stub);
  const pages = nodes.filter(n => n.kind === "page" && !n.stub), stories = g.stories;
  const hueKey = n => { const [L, C, H] = lch(n.h); return C < 12 ? 1000 + (100 - L) : (H + 330) % 360 + (100 - L) / 400; };
  switch (lens) {
    case "spectrum":
      return [{ honey: true }, ...lensSections("origins").map(sec => ({ ...sec, title: sec.title === "Still being traced" ? sec.title : "Named after · " + sec.title }))];
    case "ideas": {
      const sys = pages.filter(p => (p.swatches || []).length >= 3), ideas = pages.filter(p => !sys.includes(p) && ["concept", "person", "work", "tradition", "culture"].includes(p.type));
      return [{ title: "Stories", sub: "Short reads, a few swipes each.", pins: stories.map(n => pin(n)) },
        { title: "Color systems", sub: "Traditions that gave each color a meaning.", pins: sys.map(n => pin(n, { system: true })) },
        { title: "Ideas and people", pins: seeded(ideas, today()).map(n => pin(n)) },
        ...[window.passagesSection, window.filmsSection].filter(f => typeof f === "function").flatMap(f => f()),   // js/passages.js, js/films.js
        ...lensSections("history").map(sec => ({ ...sec, title: "Through history · " + sec.title }))];
    }
    case "harmony": {
      const vivid = colors.filter(n => lch(n.h)[1] > 28).sort((a, b) => hueKey(a) - hueKey(b));
      const pairs = vivid.map(n => { const [o] = nearestColors(opposite(n.h), 1, n.title); return o ? pairPin(n, colorNode(o[0]), "Opposites") : null; }).filter(Boolean);
      return [{ title: "Opposites", sub: "Across the wheel from each other. Side by side, each looks stronger.", pins: pairs }];
    }
    case "origins":
      return ORIGIN_GROUPS.map(([title, keys]) => ({ title, pins: colors.filter(n => n.wiki && keys.includes(n.wiki.named)).map(n => pin(n)) })).filter(s => s.pins.length)
        .concat([{ title: "Still being traced", sub: "Their stories are being written.", pins: colors.filter(n => !n.wiki || !n.wiki.named || n.wiki.named === "unknown").map(n => pin(n, { cap: "" })) }].filter(s => s.pins.length));
    case "poems":
      return [{ poems: true }];   // js/poems.js draws this lens
    case "world":
      return [{ world: true }];   // js/world.js draws this lens (Fashion, plus Botany/Gems pushed in later)
    case "paintings":
      // the hand-built pages first, in a row; then the full gallery (js/gallery.js), loaded when this lens opens
      return [{ title: "Featured · with stories", sub: "Hand-built pages with the story of the paint.", rail: true, pins: paintings.slice().sort((a, b) => (parseInt(String(a.year).replace(/\D+/g, "")) || 0) - (parseInt(String(b.year).replace(/\D+/g, "")) || 0)).map(n => pin(n)) },
        { gallery: true }];
    case "history": {
      const dated = [...colors.filter(n => n.wiki && n.wiki.since).map(n => ({ n, y: n.wiki.since.year })), ...pages.filter(p => p.year != null).map(n => ({ n, y: n.year }))].sort((a, b) => a.y - b.y);
      const secs = ERAS.map(([title, a, b]) => ({ title, pins: dated.filter(d => d.y >= a && d.y < b).map(d => pin(d.n, d.n.kind === "color" ? { cap: `${fmtYear(d.n.wiki.since)} · ${d.n.wiki.since.what}` } : {})) })).filter(s => s.pins.length);
      return secs.length ? secs : [{ title: "History", sub: "Dates are being researched. The timeline fills in as they're verified.", pins: [] }];
    }
    case "symbols": {
      const sys = pages.filter(p => (p.swatches || []).length >= 3);
      return [{ title: "Color systems", sub: "Traditions that gave each color a meaning.", pins: sys.map(n => pin(n, { system: true })) }];
    }
    case "saved": {
      const list = (S.saved || []).map(id => g.nodes.get(id)).filter(Boolean);
      return [{ title: "Saved", sub: list.length ? `${list.length} kept` : "Tap ♡ on anything to keep it here.", pins: list.map(n => pin(n)) }];
    }
    default: {
      // For you: colors shuffled by day, with a painting, a story or a page every few pins
      const day = today(), cs = seeded(colors, day), others = seeded([...paintings, ...stories, ...pages.filter(p => p.dek)], day);
      const out = [];
      cs.forEach((c, i) => { out.push(pin(c)); if (i % 3 === 2 && others.length) out.push(pin(others.shift())); });
      others.forEach(o => out.push(pin(o)));
      return [{ pins: out }];
    }
  }
}

function LAB_TILES(keys = ["harmony", "contrast", "eye", "studio"]) {
  const ring = ringStops(), tri = [30, 150, 270].map(a => { const r = 30, x = 40 + r * Math.cos(a * Math.PI / 180), y = 40 - r * Math.sin(a * Math.PI / 180); return [x.toFixed(1), y.toFixed(1)]; });
  const triCols = [30, 150, 270].map(a => lchHex(62, 52, (90 - (90 - a) + 0) % 360));
  const tiles = {
  harmony: `<button class="lab lab-x" data-lab="harmony"><span class="lv lv-wheel"><span class="lv-ring" style="background:${ring}"></span>
      <svg viewBox="0 0 80 80"><polygon points="${tri.map(p => p.join(",")).join(" ")}" fill="none" stroke="#F3F3F1" stroke-width="1.4" stroke-linejoin="round"/>${tri.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="6" fill="${triCols[i]}" stroke="#F3F3F1" stroke-width="1.6"/>`).join("")}</svg></span>
    <b>Harmony</b><small>Build palettes on the wheel</small></button>`,
  contrast: `<button class="lab lab-x" data-lab="contrast"><span class="lv lv-albers"><i style="--g:#BFA2E8"></i><i style="--g:#CC7722"></i></span>
    <b>Albers</b><small>One color, two looks</small></button>`,
  eye: `<button class="lab lab-x" data-lab="eye"><span class="lv lv-namer"><span class="lv-loupe"></span><span class="lv-tag">Coral</span></span>
    <b>Color eye</b><small>Point the camera, get the name</small></button>`,
  studio: `<button class="lab lab-x" data-lab="studio"><span class="lv lv-studio">${["#EFE6D2", "#C8553D", "#E0A458", "#5B7F6E", "#2A2620"].map(h => `<i style="--c:${h}"></i>`).join("")}</span>
    <b>Studio</b><small>Make, keep and share palettes</small></button>` };
  return keys.map(k => tiles[k]).join("");
}
// ======================================================================
// Explore's top level: a vertical pager of four full-bleed covers (DESIGN-SYSTEM.md §12).
// S.lens remembers which part is open ("all" = the pager itself, i.e. For you's own address is plain
// #/explore); exploreHome() is the one entry point router.js and go() call, same as before.
// ======================================================================
function exploreHome() {
  const lens = ["art", "ideas", "world", "saved"].includes(S.lens) ? S.lens : "all";
  if (lens === "art") return artHome();
  if (lens === "ideas") return exploreIdeas();
  if (lens === "world") return exploreWorld();
  if (lens === "saved") return exploreSaved();
  return explorePager();
}
// a part's cover opens the same way a honeycomb bubble or a painting thumbnail would (DESIGN-SYSTEM §8):
// here, a plain lens switch, re-using the pattern every lens chip used before this redesign.
function openPart(part) { S.lens = part; save(); exploreHome(); }
function backToPager() { openPart("all"); }

// ---------- tinting a cover or the Art header from its darkest dominant color (DESIGN-SYSTEM §3, §12) ----------
// L* <= 18, chroma <= 20: dark and quiet enough that --ink text over it still clears 7:1.
function tintFromHex(hex) {
  const [, , H] = lch(hex);
  return lchHex(Math.min(lch(hex)[0], 18), Math.min(lch(hex)[1], 20), H);
}
const darkestHex = list => list.reduce((a, b) => lch(b)[0] < lch(a)[0] ? b : a);
const tintFromHexList = list => list && list.length ? tintFromHex(darkestHex(list)) : null;
const tintFromPalette = pal => pal && pal.length ? tintFromHex(darkestHex(pal.map(p => p.h))) : null;
// pad or trim any list of colors to exactly six, for the seam band every cover shows
const cycleTo6 = list => list && list.length ? Array.from({ length: 6 }, (_, i) => list[i % list.length]) : [];
const sixSwatchHTML = (hexes, shares) => cycleTo6(hexes).map((h, i) => `<i style="background:${h};flex:${shares && shares[i] != null ? shares[i] : 1}"></i>`).join("");
// For you and World have no photo, so their "one great image" is the color itself, full bleed, with its own
// name set large in the corner (the same "color is the interface" move as a color page's hero) — plain flat
// color reads as empty space otherwise, especially when today's pick is very light or very dark.
const flatHeroHTML = (hex, label) => `<div class="xp-flat" style="background:${hex}"></div><div class="xp-flat-label" data-ink="${ink(hex)}">${esc(label)}</div>`;

// what each cover shows today: a color (For you), a hand-built painting (Art), a story (Ideas), a Pantone
// Color of the Year (World) — the only four things in the data that come with a ready "today" pick.
function coverData() {
  const day = today(), g = graph();
  const c = dailyColor(day);
  const paintings = [...g.nodes.values()].filter(x => x.kind === "painting" && !x.stub && x.img && (x.palette || []).length);
  const art = paintings.length ? seeded(paintings, "artcover" + day)[0] : null;
  const story = g.stories.length ? seeded(g.stories, "ideacover" + day)[0] : null;
  const coty = window.FASHION && FASHION.coty && FASHION.coty[FASHION.coty.length - 1];
  return { c, art, story, coty };
}
function artCoverNote(art) {
  const pal = art.palette, dom = pal.reduce((a, b) => b.share > a.share ? b : a), dark = pal.reduce((a, b) => lch(b.h)[0] < lch(a.h)[0] ? b : a);
  const names = [dom.name, dark.name].filter((n, i, arr) => n && arr.indexOf(n) === i);
  return `Today, ${art.title}${names.length ? `, in ${names.map(n => n.toLowerCase()).join(" and ")}` : ""}`;
}
function coverHTML(part, name, lead, note, tint, heroHTML, seamHTML) {
  return `<section class="xp-cover" data-part="${esc(part)}" style="${tint ? `--tint:${tint}` : ""}">
    <div class="xp-img">${heroHTML}</div>
    ${seamHTML ? `<div class="xp-seam">${seamHTML}</div>` : ""}
    <div class="xp-body">
      <h2 class="xp-name">${esc(name)}</h2>
      <p class="xp-lead">${esc(lead)}</p>
      ${note ? `<p class="xp-note">${esc(note)}</p>` : ""}
    </div>
  </section>`;
}
function explorePager() {
  XSTACK = [];
  const { c, art, story, coty } = coverData();
  const forYouSeam = sixSwatchHTML([c.h, ...nearestColors(c.h, 5, c.n).map(x => x[0].h)]);
  const covers = [
    coverHTML("all", "For you", "A new pick of colors, paintings and stories every day.", `Today, ${c.n}`,
      tintFromHex(c.h), flatHeroHTML(c.h, c.n), forYouSeam),
    art ? coverHTML("art", "Art", "Fourteen thousand paintings and eleven thousand poems, found by their colors.", artCoverNote(art),
      tintFromPalette(art.palette), `<img src="${esc(art.img)}" alt="${esc(art.title)}">`, sixSwatchHTML(art.palette.map(p => p.h), art.palette.map(p => p.share)))
      : coverHTML("art", "Art", "Fourteen thousand paintings and eleven thousand poems, found by their colors.", "", null, `<div class="xp-flat" style="background:var(--lift-2)"></div>`, ""),
    story ? coverHTML("ideas", "Ideas", "Short stories, systems and history, read through color.", `Today, ${story.title}`,
      tintFromHexList(story.cover), `<div class="xp-flat" style="background:linear-gradient(135deg,${story.cover.join(",")})"></div>`, sixSwatchHTML(story.cover))
      : coverHTML("ideas", "Ideas", "Short stories, systems and history, read through color.", "", null, `<div class="xp-flat" style="background:var(--lift-2)"></div>`, ""),
    coty ? coverHTML("world", "World", "Fashion, gems and growing things, in color.", `Today, ${coty.name} · ${coty.year}`,
      tintFromHex(coty.hex), flatHeroHTML(coty.hex, coty.name), sixSwatchHTML(FASHION.coty.slice(-6).map(y => y.hex)))
      : coverHTML("world", "World", "Fashion, gems and growing things, in color.", "", null, `<div class="xp-flat" style="background:var(--lift-2)"></div>`, ""),
  ];
  const el = show(`
    <div class="xp-wrap">
      <div class="xp-pager" id="xpPager">${covers.join("")}</div>
      <div class="xp-dots">${covers.map((_, i) => `<i class="${i === 0 ? "on" : ""}"></i>`).join("")}</div>
      <button class="xp-search" data-search aria-label="Search Explore">${ICON.search}</button>
    </div>
  `, "explore", "explore");
  const pager = el.querySelector("#xpPager"), dots = [...el.querySelectorAll(".xp-dots i")], sections = [...pager.querySelectorAll(".xp-cover")];
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.intersectionRatio > .5) { const i = sections.indexOf(e.target); dots.forEach((d, j) => d.classList.toggle("on", j === i)); } }),
      { root: pager, threshold: [.5] });
    sections.forEach(s => io.observe(s));
    cleanup.push(() => io.disconnect());
  }
  pager.addEventListener("click", e => { const s = e.target.closest("[data-part]"); if (s) openPart(s.dataset.part); });
  el.querySelector("[data-search]").onclick = () => exploreSearchSheet();
}

// ---------- the generic feed: For you, Ideas and Saved share this (plain {title, sub, pins} sections) ----------
const partHeader = title => `<header class="art-top"><button class="icon-btn glass" data-back aria-label="Back">${ICON.back}</button><span style="width:44px"></span></header><h1 class="p-title">${esc(title)}</h1>`;
function feedSectionsHTML(SECS) {
  const seen = new Set(), toc = [];
  SECS.forEach((x, i) => { if (!x.title) return; const g = x.title.split(" · ")[0]; if (!seen.has(g)) { seen.add(g); toc.push([i, g]); } });
  return (toc.length > 2 ? `<nav class="toc x-toc" aria-label="Contents"><span class="eyebrow">Contents</span>${toc.map(([i, g]) => `<a data-jump="${i}">${esc(g)}</a>`).join("")}</nav>` : "")
    + SECS.map((sec, i) => `${sec.title ? `<div class="sec-head x-sec" id="xs-${i}"><b>${esc(sec.title)}</b>${sec.pins && sec.pins.length ? `<span>${sec.pins.length}</span>` : ""}</div>` : ""}${sec.sub ? `<p class="x-sub">${esc(sec.sub)}</p>` : ""}${masonry(sec.pins || [])}`).join("")
    + `<p class="fine">Hex values are screen approximations. Every page lists its sources.</p>`;
}
function wireFeedSections(el) {
  el.querySelectorAll("[data-jump]").forEach(a => a.onclick = () => { const t = el.querySelector("#xs-" + a.dataset.jump); if (t) t.scrollIntoView({ block: "start", behavior: reduceMotion ? "auto" : "smooth" }); });
  el.addEventListener("click", e => {
    const p = e.target.closest("[data-pin]"); if (p) return closeup(graph().nodes.get(p.dataset.pin));
    if (e.target.closest("[data-daily]")) return daily();
    const l = e.target.closest("[data-lab]"); if (l) return LAB[l.dataset.lab]();
    const t = e.target.closest("[data-taste]"); if (t) return tasteIntro(t.dataset.taste);
  });
}
function wirePartBack(el) { el.querySelector("[data-back]").onclick = backToPager; onKey = e => { if (e.key === "Escape") backToPager(); }; }
function exploreForYou() {
  XSTACK = [];
  const SECS = lensSections("all").filter(x => !x.title || (x.pins && x.pins.length) || x.sub);
  const el = show(`${partHeader("For you")}<div class="x-feed">${feedSectionsHTML(SECS)}</div>`, "article");
  wirePartBack(el); wireFeedSections(el);
}
function exploreIdeas() {
  XSTACK = [];
  const SECS = lensSections("ideas").filter(x => !x.title || (x.pins && x.pins.length) || x.sub);
  const el = show(`${partHeader("Ideas")}<div class="x-feed">${feedSectionsHTML(SECS)}</div>`, "article");
  wirePartBack(el); wireFeedSections(el);
}
function exploreWorld() {
  XSTACK = [];
  const el = show(`${partHeader("World")}<div class="wd-wrap" id="world"></div>`, "article");
  wirePartBack(el);
  const wd = el.querySelector("#world"); if (wd && typeof worldMount === "function") worldMount(wd);
}
function exploreSaved() {
  XSTACK = [];
  const SECS = lensSections("saved");
  const el = show(`${partHeader("Saved")}<div class="x-feed">${feedSectionsHTML(SECS)}</div>`, "article");
  wirePartBack(el); wireFeedSections(el);
}

// ======================================================================
// Art: Paintings + Poems merged (DESIGN-SYSTEM §12 "Inside a part"). A row of color bubbles picks the color;
// the header takes its tint; paintings (js/gallery.js's corpus, searched by color) and poems (js/poems.js's
// archive) share one two-column feed, each sized and placed by the existing masonry() above.
// ======================================================================
let ART_UI = { hex: null, name: "" };   // the picked color, or none for "a new mix every day"
// the shared entry point: "Paintings/poems with this color", from a color page, the color link sheet, or
// anywhere else that used to send people to the old Paintings lens (js/gallery.js, js/swatch.js, js/poems.js).
function artOpenColor(hex, name) { ART_UI = { hex, name: name || "" }; openPart("art"); }
// a plain gallery pin, built straight from the GAL corpus index (js/gallery.js) rather than a graph node, so
// Art can show any of the ~40,000 paintings, not only the hand-written "Featured" ones pin() above knows.
function artGalPinHTML(i) {
  const d = glDetailNow(i), pal = glPal(i), ar = glAR(i);
  return { h: 167 * ar + 64, html: `<button class="pin pin-art" data-gi="${i}">${d && d.img ? `<img src="${esc(d.img)}" alt="" loading="lazy" style="aspect-ratio:${(1 / ar).toFixed(3)}">` : `<span class="noimg"></span>`}
    <span class="mini-pal">${pal.map(x => `<i style="--c:${x.h};flex:${x.share}"></i>`).join("")}</span><b>${d ? esc(d.t) : ""}</b><small>${d ? glByline(i, d) : ""}</small></button>` };
}
// a poem pin: the same look as "In poems" on a color page (css/poems.css .pm-q), a line of verse with its
// color word in color, then the poet and title.
function artPoemPinHTML(p, lineHTML) {
  return { h: 172, html: `<button class="pm-q" data-poem="${esc(p.id)}"><span class="pm-q-line">${lineHTML}</span><small>${esc(p.poet)} · ${esc(p.title)}</small></button>` };
}
async function artPoemPins(name) {
  const ix = await loadPoemIndex(); if (!ix) return [];
  let rows;
  if (name) {
    const ci = ix.colorByName.get(name.toLowerCase());
    if (ci == null) return [];
    rows = ix.list.filter(x => x.pal.some(([c]) => c === ci)).sort((a, b) => {
      const sa = a.pal.find(([c]) => c === ci)[1], sb = b.pal.find(([c]) => c === ci)[1];
      return sb - sa || a.lines - b.lines;
    }).slice(0, 8);
  } else rows = seeded(ix.list.filter(p => p.pal.length), "artpoems" + today()).slice(0, 6);
  const poems = await Promise.all(rows.map(p => loadPoem(p.id)));
  const pins = [];
  rows.forEach((p, i) => { const poem = poems[i]; if (poem) pins.push(artPoemPinHTML(p, poemLineHTML(poem, poemKeyLine(poem)))); });
  return pins;
}
// paintings near the picked color (or a daily mix with none picked), interleaved with poems naming it
async function artFeedPins(hex, name) {
  await loadGallery();
  const res = glRun({ ...glFresh(), hex: hex || null, name: name || "" });
  const list = [...res.list].slice(0, 48);
  await Promise.all([...new Set(list.map(i => Math.floor(i / GAL.shard)))].map(k => glShard(k).catch(() => {})));
  const paintingPins = list.map(artGalPinHTML);
  const poemPins = await artPoemPins(name);
  const out = []; let pi = 0;
  paintingPins.forEach((p, i) => { out.push(p); if ((i + 1) % 5 === 0 && pi < poemPins.length) out.push(poemPins[pi++]); });
  while (pi < poemPins.length) out.push(poemPins[pi++]);
  return out;
}
function artHome() {
  XSTACK = [];
  const { hex, name } = ART_UI, tint = hex ? tintFromHex(hex) : null;
  const colors = glHueOrder([...BASICS, ...ALL]);
  const el = show(`
    <div class="art-band" style="${tint ? `--tint:${tint}` : ""}">
      <header class="art-top"><button class="icon-btn glass" data-back aria-label="Back">${ICON.back}</button><button class="icon-btn glass" data-search aria-label="Search">${ICON.search}</button></header>
      <h1 class="p-title">Art</h1>
      <p class="p-dek">${hex ? `In ${esc(name.toLowerCase())}, from fourteen thousand paintings and eleven thousand poems.` : "Fourteen thousand paintings and eleven thousand poems, found by their colors."}</p>
      <div class="art-bubbles" role="tablist">${colors.map(c => `<button class="art-bubble${c.n === name ? " on" : ""}" data-hex="${c.h}" data-name="${esc(c.n)}" style="--c:${c.h}" aria-label="${esc(c.n)}"></button>`).join("")}</div>
    </div>
    <div class="art-feed" id="artFeed"><p class="fine">Loading the gallery…</p></div>
  `, "article");
  wirePartBack(el);
  el.querySelector("[data-search]").onclick = () => exploreSearchSheet();
  el.querySelectorAll("[data-hex]").forEach(b => b.onclick = () => {
    const same = ART_UI.name === b.dataset.name;
    ART_UI = same ? { hex: null, name: "" } : { hex: b.dataset.hex, name: b.dataset.name };
    buzz(6); artHome();
  });
  const feed = el.querySelector("#artFeed");
  artFeedPins(hex, name).then(pins => {
    if (!feed.isConnected) return;
    feed.innerHTML = pins.length ? masonry(pins) : `<p class="fine">Nothing matches yet. Try another color.</p>`;
    glFill(feed);
  }).catch(() => { if (feed.isConnected) feed.innerHTML = `<p class="fine">The gallery didn't load. <button class="wl" data-retry>Try again</button></p>`; });
  feed.addEventListener("click", e => {
    const g = e.target.closest("[data-gi]"); if (g) return galleryPage(+g.dataset.gi, true, hex);
    const pm = e.target.closest("[data-poem]"); if (pm) { POEM_ORIGIN = "explore"; return poemPage(pm.dataset.poem); }
    if (e.target.closest("[data-retry]")) return artHome();
  });
}

// ---------- search, over everything, from the pager's or Art's floating search button ----------
function exploreSearchSheet() {
  const saved = (S.saved || []).map(id => graph().nodes.get(id)).filter(Boolean);
  const { sh, close } = sheet(`
    <label class="search"><span>${ICON.search}</span><input id="xq" type="search" placeholder="Search colors, paintings, people, pigments" autocomplete="off"></label>
    <div id="xresults">${saved.length ? `<div class="sec-head"><b>Saved</b><span>${saved.length}</span></div>${masonry(saved.map(n => pin(n)))}` : `<p class="fine">Tap ${ICON_HEART} on anything to keep it here, or start typing to search.</p>`}</div>
  `);
  const q = sh.querySelector("#xq"), results = sh.querySelector("#xresults");
  q.addEventListener("input", () => {
    const s = q.value.trim().toLowerCase();
    if (!s) { results.innerHTML = saved.length ? `<div class="sec-head"><b>Saved</b><span>${saved.length}</span></div>${masonry(saved.map(n => pin(n)))}` : `<p class="fine">Tap ${ICON_HEART} on anything to keep it here, or start typing to search.</p>`; return; }
    const hits = [...graph().nodes.values()].filter(n => (n.title || "").toLowerCase().includes(s)).slice(0, 40);
    results.innerHTML = hits.length ? masonry(hits.map(n => pin(n))) : `<p class="fine">Nothing called that yet.</p>`;
  });
  results.addEventListener("click", e => { const p = e.target.closest("[data-pin]"); if (p) { close(); closeup(graph().nodes.get(p.dataset.pin)); } });
  setTimeout(() => q.focus(), 260);
}

// ======================================================================
// Closeup: the pin big, then "More like this" (its connections, each saying why), then connections of connections
// ======================================================================
const CONN_LENSES = [["all", "All"], ["spectrum", "Looks"], ["harmony", "Harmony"], ["origins", "Origins"], ["paintings", "Paintings"], ["history", "History"], ["ideas", "Ideas"], ["stories", "Stories"]];
function closeup(n, opts = {}) {
  if (!n) return exploreHome();
  if (!opts.back) { if (XSTACK[XSTACK.length - 1] !== "z:" + n.id) XSTACK.push("z:" + n.id); }
  const conns = connections(n);
  const lensesHere = CONN_LENSES.filter(([k]) => k === "all" || conns.some(c => c.lens === k));
  const pick = opts.lens && lensesHere.some(l => l[0] === opts.lens) ? opts.lens : "all";
  const shown = pick === "all" ? conns : conns.filter(c => c.lens === pick);
  const saved = isSaved(n.id);
  const sum = n.kind === "color" ? (n.wiki && n.wiki.facets[0] ? n.wiki.facets[0].text : n.c.d || n.c.o || "")
    : n.kind === "painting" ? n.note || "" : n.kind === "story" ? n.dek : n.stub ? "" : n.dek || (n.body && n.body[0]) || "";
  const st = n.kind === "color" && n.c.id && S.cards[n.c.id];
  const hero = n.kind === "color"
    ? `<div class="z-hero z-color" style="--c:${n.h}" data-ink="${ink(n.h)}"><span class="eyebrow">${n.c.basic ? "Basic color word" : st ? (isMine(st) ? "Yours" : "Learning") : n.c.unit ? esc(unitLabel(n.c.unit)) : ""}</span><h1>${esc(n.title)}</h1><span class="mono">${n.h}</span></div>`
    : n.kind === "painting" ? `<div class="z-hero z-art">${n.img ? `<img src="${esc(n.img)}" alt="${esc(n.title)}">` : ""}${(n.palette || []).length ? `<span class="z-pal">${n.palette.map(c => `<i style="--c:${c.h};flex:${c.share}"></i>`).join("")}</span>` : ""}</div><h1 class="z-title">${esc(n.title)}</h1><p class="z-meta">${esc(n.artist || "")}${n.year ? " · " + esc(n.year) : ""}</p>`
    : n.kind === "story" ? `<div class="z-hero z-story" style="--g:linear-gradient(150deg,${n.cover.join(",")})"><span class="eyebrow">Story · ${n.slides.length} slides</span><h1>${esc(n.title)}</h1></div>`
    : `<div class="z-hero z-page">${(n.swatches || []).length ? n.swatches.slice(0, 7).map(x => `<i style="--c:${x.h}"><span data-ink="${ink(x.h)}">${esc(x.label || "")}</span></i>`).join("") : `<i style="--c:${nodeColor(n) || "#2c2c2c"}"></i>`}</div><p class="eyebrow z-type">${esc(TYPE_LABEL[n.type] || "Page")}</p><h1 class="z-title">${esc(n.title)}</h1>`;
  const el = show(`
    <header class="art-top"><button class="icon-btn glass" data-back aria-label="Back">${ICON.back}</button>
      <div class="z-actions"><button class="icon-btn glass${saved ? " saved" : ""}" data-save aria-label="Save">${saved ? "♥" : "♡"}</button></div></header>
    ${hero}
    ${sum ? `<p class="z-sum">${linkText(sum)}</p>` : ""}
    <div class="row2 z-btns">${n.kind === "story" ? `<button class="btn" data-play>${ICON.play} Play story</button>` : `<button class="btn" data-read>Read the page ${ICON.arrow}</button>`}</div>
    ${conns.length ? `<div class="sec-head"><b>More like this</b><span>${conns.length} connections</span></div>
    <div class="lens-key in-page">${lensesHere.map(([k, t]) => `<button class="${k === pick ? "on" : ""}" data-zl="${k}">${t}</button>`).join("")}</div>
    ${masonry(shown.map(c => pin(c.to, { rel: c.rel, why: c.why, h: c.to.kind === "color" ? 120 + (hash(c.to.id) % 3) * 20 : undefined })))}` : ""}
    <div id="more"></div>
  `, "article closeup");
  el.querySelector("[data-back]").onclick = xBack;
  el.querySelector("[data-save]").onclick = e => { const on = toggleSave(n.id); e.currentTarget.textContent = on ? "♥" : "♡"; e.currentTarget.classList.toggle("saved", on); };
  const rd = el.querySelector("[data-read]"); if (rd) rd.onclick = () => openNode(n);
  const pl = el.querySelector("[data-play]"); if (pl) pl.onclick = () => storyPlayer(n);
  el.querySelectorAll("[data-zl]").forEach(b => b.onclick = () => closeup(n, { back: true, lens: b.dataset.zl }));
  el.addEventListener("click", e => {
    const p = e.target.closest("[data-pin]"); if (p) { e.preventDefault(); return closeup(graph().nodes.get(p.dataset.pin)); }
    const a = e.target.closest("[data-to]"); if (a) { e.preventDefault(); return closeup(graph().nodes.get(a.dataset.to)); }
  });
  // connections of connections, loaded when you scroll near the end
  const more = el.querySelector("#more");
  const io = new IntersectionObserver(es => {
    if (!es[0].isIntersecting) return;
    io.disconnect();
    const seen = new Set([n.id, ...conns.map(c => c.to.id)]), second = [];
    conns.slice(0, 8).forEach(c => connections(c.to).forEach(x => { if (!seen.has(x.to.id)) { seen.add(x.to.id); second.push(x.to); } }));
    if (second.length) more.innerHTML = `<div class="sec-head"><b>Keep exploring</b><span>two steps away</span></div>${masonry(seeded(second, n.id).slice(0, 40).map(x => pin(x)))}`;
  }, { rootMargin: "400px" });
  io.observe(more);
  cleanup.push(() => io.disconnect());
  onKey = e => { if (e.key === "Escape") el.querySelector("[data-back]").click(); };
}
// older entry points
const orbit = id => closeup(graph().nodes.get(id));
// ======================================================================
// Opening any node
// ======================================================================
// `tapped`: an exact hex that led here but isn't quite this color (js/swatch.js openTappedColor) — only
// colorPage uses it (namePage takes the same argument directly, since a library name has no graph node).
function openNode(n, push = true, tapped) {
  if (!n) return;
  if (n.kind === "story") return storyPlayer(n);
  if (push) XSTACK.push("p:" + n.id);
  if (n.kind === "color") return colorPage(n, tapped);
  if (n.kind === "painting") return paintingPage(n);
  if (n.page) return n.page(n);   // archive pages (passages, films) bring their own renderer
  return wikiPage(n);
}
// Pinterest-style back (ROADMAP.md §17 job #2): XSTACK is the one shared crumb trail behind every screen this
// app can open from the honeycomb, Explore, the gallery or Studio's photo shelf — whichever of those opened
// the first screen in a chain, going back far enough always lands there, never on an unrelated tab.
// The fallback when the trail runs out: whatever tab we're logically in (S.tab keeps whatever it was set to by
// go()/hmHome() and never changes just from opening a page), so a chain rooted in the honeycomb or Studio
// returns there instead of always landing on Explore.
const xFallbackTab = () => ["learn", "gym", "studio"].includes(S.tab) ? S.tab : "explore";
// Where a chain of pages started when that wasn't a room: "home" when a bubble on the honeycomb opened it. Home is its
// own floor now (not a tab), so without this the trail ran out onto whatever room S.tab last pointed at, and a pull-down
// on a color opened from Home dropped you into Studio (David). go() clears it.
let X_ROOT = null;
function xStep(prev) {
  if (!prev) return X_ROOT === "home" && typeof hmHome === "function" ? (X_ROOT = null, hmHome()) : go(xFallbackTab());
  // Studio screens (ROADMAP.md §17 job #1): plain tokens (no ":"), since each reopens from its own remembered
  // state rather than an id. Checked before the generic node lookup at the bottom, which would otherwise treat
  // "harmony" etc. as a (nonexistent) graph node id and silently do nothing.
  if (prev === "wheel") return gamutWheel(GW_LAST && GW_LAST.preset, GW_LAST && GW_LAST.pts, false);
  if (prev === "wheelview") return gwReopenView();
  if (prev === "harmony") return LAB.harmony(LAB_HARMONY_STATE && LAB_HARMONY_STATE.base, LAB_HARMONY_STATE && LAB_HARMONY_STATE.scheme, false);
  if (prev === "contrast") return LAB.contrast(LAB_CONTRAST_STATE && LAB_CONTRAST_STATE.set, LAB_CONTRAST_STATE && LAB_CONTRAST_STATE.slot, false);
  if (prev.startsWith("pal:")) return openSavedPalette(prev.slice(4), false);   // a saved palette (js/studio.js)
  if (prev.startsWith("g:")) return galleryPage(+prev.slice(2), false);   // a gallery painting (js/gallery.js)
  if (prev.startsWith("ph:")) return photoPage(prev.slice(3), false);   // a saved photo (js/photos.js)
  if (prev.startsWith("poem:")) return poemPage(prev.slice(5), { back: true });   // a poem (js/poems.js)
  // a library color's own page, not one of the 101 (js/names.js): it isn't a graph node, so look it up by name
  if (prev.startsWith("n:")) {
    const nm = decodeURIComponent(prev.slice(2));
    return loadCoreNames().then(() => { const e = (CORE_NAMES || []).find(x => x.n === nm); e ? namePage(e, false) : go(xFallbackTab()); });
  }
  const node = graph().nodes.get(prev.replace(/^[zp]:/, ""));
  return prev.startsWith("z:") ? closeup(node, { back: true }) : openNode(node, false);
}
function xBack() { XSTACK.pop(); BACK_RENDER = true; xStep(XSTACK[XSTACK.length - 1]); }
// links inside any article
function wireLinks(el) {
  el.addEventListener("click", e => {
    const a = e.target.closest("[data-to],[data-node]");
    if (!a) return;
    e.preventDefault();
    openNode(graph().nodes.get(a.dataset.to || a.dataset.node));
  });
}

// ======================================================================
// Article pages
// ======================================================================
function connSection(n) {
  const conns = connections(n);
  if (!conns.length) return "";
  return `<section class="conns"><h3>Connections</h3>${CONN_LENSES.filter(([g]) => g !== "all").map(([g, name]) => {
    const list = conns.filter(c => c.lens === g);
    if (!list.length) return "";
    return `<div class="cg"><p class="eyebrow">${name}</p><div class="chips-wrap">${list.slice(0, 14).map(c => {
      const col = nodeColor(c.to);
      return `<button class="pchip" data-node="${esc(c.to.id)}">${col ? `<i style="--c:${col}"></i>` : ""}${esc(c.to.title)}<em>${esc(c.rel)}</em></button>`;
    }).join("")}</div></div>`;
  }).join("")}</section>`;
}
const sourcesHTML = list => list && list.length ? `<section class="srcs"><h3>Sources</h3><ul>${list.map(s => `<li>${/^https?:\/\//.test(s) ? `<a href="${esc(s)}" target="_blank" rel="noopener">${esc(s.replace(/^https?:\/\/(www\.)?/, "").slice(0, 60))}</a>` : esc(s)}</li>`).join("")}</ul></section>` : "";
const artTop = n => `<header class="art-top"><button class="icon-btn glass" data-back aria-label="Back">${ICON.back}</button><button class="glass-pill" data-web>${ICON.explore}<span>More like this</span></button></header>`;
function wireArticle(el, n) {
  el.querySelector("[data-back]").onclick = xBack;
  el.querySelector("[data-web]").onclick = () => closeup(n);
  wireLinks(el);
  onKey = e => { if (e.key === "Escape") xBack(); };
}
// screen codes, plus a rough CMYK. The CMYK is the naive formula (no ICC profile, no paper, no ink limits), so it
// is labeled rough: real print values come from a print profile (e.g. an uncoated or coated press profile) and a proof.
function codes(hex) {
  const [r, g, b] = rgb(hex), k = 1 - Math.max(r, g, b) / 255;
  const cmy = [r, g, b].map(v => k >= 1 ? 0 : Math.round((1 - v / 255 - k) / (1 - k) * 100));
  const mx = Math.max(r, g, b) / 255, mn = Math.min(r, g, b) / 255, l = (mx + mn) / 2, d = mx - mn;
  let h = 0; if (d) { h = mx === r / 255 ? ((g - b) / 255 / d) % 6 : mx === g / 255 ? (b - r) / 255 / d + 2 : (r - g) / 255 / d + 4; h = Math.round(h * 60 + 360) % 360; }
  const s = d ? d / (1 - Math.abs(2 * l - 1)) : 0;
  return [["HEX", hex], ["RGB", `${r} ${g} ${b}`], ["HSL", `${h}° ${Math.round(s * 100)}% ${Math.round(l * 100)}%`], ["CMYK, ROUGH", `${cmy.join(" ")} ${Math.round(k * 100)}`]];
}

// Wikipedia-style pieces: sections that fold open and shut, a contents row, and photographs with credits.
const secHTML = (id, title, inner, open) => `<details class="sec" id="s-${id}"${open ? " open" : ""}><summary><span>${esc(title)}</span><i aria-hidden="true"></i></summary><div class="sec-body">${inner}</div></details>`;
const tocHTML = list => list.length > 2 ? `<nav class="toc" aria-label="Contents"><span class="eyebrow">Contents</span>${list.map(([id, t]) => `<a data-sec="${id}">${esc(t)}</a>`).join("")}</nav>` : "";
function figHTML(key, i = 0) {
  const imgs = (window.WIKI_IMAGES || {})[key]; if (!imgs || !imgs[i]) return "";
  const f = imgs[i];
  return `<figure class="fig"><img src="${esc(f.src)}" alt="${esc(f.alt || "")}" loading="lazy"${f.w ? ` width="${f.w}" height="${f.h}"` : ""}><figcaption>${esc(f.caption || "")}<span>${f.commons ? `<a href="${esc(f.commons)}" target="_blank" rel="noopener">${esc(f.credit || "Wikimedia Commons")}</a>` : esc(f.credit || "")}${f.licenseUrl ? ` · <a href="${esc(f.licenseUrl)}" target="_blank" rel="noopener">License</a>` : ""}</span></figcaption></figure>`;
}
function wireSections(el) {
  el.querySelectorAll("[data-sec]").forEach(a => a.onclick = () => { const d = el.querySelector("#s-" + a.dataset.sec); if (d) { d.open = true; d.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" }); } });
}
// codes shown depend on what the person works with (asked at the start): screens, paint or print
function codeRows(hex) {
  const all = codes(hex), media = (S.profile && S.profile.media) || [], [L, C] = lch(hex);
  if (!media.length) return all;
  const rows = [];
  if (media.includes("screen")) rows.push(...all.slice(0, 3));
  if (media.includes("print")) rows.push(all[3]);
  // CIELAB lightness, chroma and hue, labeled as what they are (not Munsell value and chroma, which need a real conversion)
  if (media.includes("paint")) { const H = lch(hex)[2]; rows.push(["LCH", `L ${Math.round(L)} · C ${Math.round(C)} · h ${Math.round(H)}`]); }
  return rows.length ? rows : all;
}

// The color page (DESIGN-SYSTEM.md §12 "Color page"): a full-bleed hero (solid ‹ and ⋯, a state chip, the
// name and hex), one paper primary ("Learn it"/"Review it") with quiet save/share icons, a compare strip
// with its diff line, the lead and photo, the picture shelves (paintings/poems/nature/gems/fashion — each
// hides itself when it has nothing, css/colorpage.css), and Language/History/Nearest names/Codes/Sources
// collapsed at the end. No "More like this" box competing with Back: ⋯ opens it instead.
//
// `tapped`: an exact hex from a swatch that opened THIS page as its nearest name, but isn't quite it (David,
// 2026-10-07 — js/swatch.js openTappedColor). The hero shows that exact color, not the page's own, with a
// "Your color" note and a your-color-vs-named-color strip in place of the usual look-alike one.
function colorPage(n, tapped) {
  const c = n.c, w = n.wiki, nb = neighbor(c), st = c.id && S.cards[c.id], mine = isMine(st);
  tapped = tapped ? String(tapped).toUpperCase() : null;
  const heroHex = tapped || c.h;
  const status = tapped ? `Your color · ${pctMatch(de2000(tapped, c.h))} to ${c.n}`
    : c.basic ? "A basic color word" : st ? (mine ? "Yours" : st.own || st.placed ? "In your reviews" : "Learning") : `New to you${c.unit ? ", from " + unitLabel(c.unit) : ""}`;
  const saved = isSaved(n.id);
  // the strip: a tapped color compares against the page it landed on; otherwise this color, its authored
  // neighbor (c.vs) if it has one, then its nearest taught look-alikes, deduped — up to 3 swatches, the first
  // (this color, or your color) wider
  const likes = typeof lookalikes === "function" ? lookalikes(c, 4).map(o => o.x) : [];
  const seenN = new Set([c.n]);
  const stripOthers = tapped ? [c] : [nb, ...likes].filter(x => x && !seenN.has(x.n) && (seenN.add(x.n), true)).slice(0, 2);
  const stripDiff = tapped ? lookDiff({ h: tapped, n: "Your color" }, c) : c.d;
  // every color page is rich (ROADMAP, David 2026-10-08): famC is a fallback family head for the shelves
  // below that would otherwise go quiet on a thin name — a no-op for one of the 101 themselves (their own
  // family head is always themselves, de 0).
  const famC = typeof rcFamC === "function" ? rcFamC(tapped || c.h) : null;
  const el = show(`
    <div class="c-hero cp-hero cp-hero-full" style="--c:${heroHex}" data-ink="${ink(heroHex)}">
      <button class="cp-close" data-back aria-label="Back">${ICON.back}</button>
      <div class="cp-hero-foot">
        <span class="cp-chip">${esc(status)}</span>
        <h1>${esc(c.n)}</h1>
        <button class="mono cp-hex" data-copy="${heroHex}">${heroHex}</button>
      </div>
      <span class="cp-scroll-hint" aria-hidden="true">${ICON.up}</span>
    </div>
    <div class="cp-primary-row">
      ${typeof hmLearnIt === "function" ? `<button class="cp-primary" data-learnit>${mine ? "Review it" : "Learn it"}${mine ? "" : `<em>2 min</em>`}${ICON.arrow}</button>` : ""}
      <button class="icon-btn cp-icon${saved ? " saved" : ""}" data-save aria-label="Save">${saved ? "♥" : "♡"}</button>
      <button class="icon-btn cp-icon" data-share aria-label="Share">${ICON.share}</button>
    </div>
    ${stripOthers.length && stripDiff ? `<section class="cp-strip-sec">
      <div class="cp-strip"${tapped ? "" : ` data-nb="${esc(c.n)}"`}>
        <div style="--c:${heroHex}" data-ink="${ink(heroHex)}"><b>${tapped ? "Your color" : esc(c.n)}</b></div>
        ${stripOthers.map(x => `<div style="--c:${x.h}" data-ink="${ink(x.h)}"><b>${esc(x.n)}</b></div>`).join("")}
      </div>
      <p class="cp-diff">${esc(stripDiff)}</p>
    </section>` : ""}
    ${typeof rcYouHTML === "function" ? rcYouHTML(c.n, c.h) : ""}
    ${typeof articleSlot === "function" ? articleSlot(routeSlug(c.n)) : ""}
    ${typeof rcReachSection === "function" ? rcReachSection(c.n, heroHex) : ""}
    ${c.o && !(w && w.facets.some(f => f.k === "language")) ? `<p class="lead">${esc(c.o)}</p>` : ""}
    ${figHTML(c.n)}
    <section class="gl-in" data-glin></section>
    ${typeof rcSectionsBeforeWorld === "function" ? rcSectionsBeforeWorld(c.n, c.h, famC) : ""}
    ${typeof btRow === "function" ? btRow(c, famC) : ""}
    ${typeof gmRow === "function" ? gmRow(c, famC) : ""}
    <section class="fx-in" data-world-in></section>
    ${typeof archiveRows === "function" ? archiveRows(c, "films", famC) : ""}
    <div class="c-poems"></div>
    ${typeof archiveRows === "function" ? archiveRows(c, "books", famC) : ""}
    ${typeof rcSectionsAfterWords === "function" ? rcSectionsAfterWords(c.h) : ""}
    ${typeof rcCompassSection === "function" ? rcCompassSection(c.n, heroHex) : ""}
    ${(() => {
      const secs = (w ? w.facets : []).map((f, i) => [f.k + i, FACET_LABEL[f.k] || f.k, `<p>${linkText(f.text)}</p>` + (i === 0 ? figHTML(c.n, 1) : "")]);
      if (w && w.related && w.related.length) secs.push(["kin", "Kin", w.related.map(r => { const x = graph().resolve(r.to); return x ? `<button class="kin" data-node="${esc(x.id)}"><i style="--c:${x.h}"></i><b>${esc(x.title)}</b><span>${esc(r.why)}</span></button>` : ""; }).join("")]);
      // the sheet used to be the only place these lived (David, 2026-10-07: "everything the sheet had moves
      // onto the page") — the nearest of the ~1,000 core names, same list js/names.js's own pages show. A
      // nearby name that already has a full written article reads naturally here (never "closest of the
      // 101", David 2026-10-08) rather than as a separate list.
      if (typeof nearestCore === "function") {
        const list = CORE_NAMES || (typeof coreFallback === "function" ? coreFallback() : []);
        const near = nearestCore(tapped || c.h, list, 7).filter(x => x.n.toLowerCase() !== c.n.toLowerCase()).slice(0, 6);
        if (near.length) secs.push(["nearnames", "Nearest names", `<div class="lk-list">${near.map(x => `<button class="lk-row" data-cp-near="${esc(x.n)}" data-h="${x.h}"><i style="--c:${x.h}"></i><b>${esc(x.n)}</b><span>${closeness(x.de)} · ${pctDiff(x.de)}${rcHasArticle(x.n) ? " · has its own story" : ""}</span></button>`).join("")}</div>`]);
      }
      const coreSelf = (CORE_NAMES || (typeof coreFallback === "function" ? coreFallback() : [])).find(e => e.n.toLowerCase() === c.n.toLowerCase());
      if (coreSelf && ((coreSelf.also || []).length || (coreSelf.src || []).length)) {
        secs.push(["names", "Also called", `${(coreSelf.also || []).length ? `<p>${(coreSelf.also || []).map(esc).join(", ")}.</p>` : ""}${rcPassportHTML(coreSelf.src || [])}`]);
      }
      secs.push(["codes", "Codes", `<div class="cp-codes">${codeRows(c.h).map(([k, v]) => `<button class="cp-code-row" data-copy="${esc(v)}"><span>${esc(k)}</span><b class="mono">${esc(v)}</b></button>`).join("")}</div>${codeRows(c.h).some(r => r[0].startsWith("CMYK")) ? `<p class="fine cp-codes-fine">CMYK here is a rough formula, not a print profile: real values depend on the paper and press, so check them in a print workflow with a proof.</p>` : ""}`]);
      return (w ? "" : `<p class="fine">The full page for ${esc(c.n)} is being written. Its connections below are already live.</p>`) + tocHTML(secs.map(x => [x[0], x[1]])) + secs.map(x => secHTML(x[0], x[1], x[2], false)).join("");
    })()}
    ${connSection(n)}
    ${w && w.sources ? secHTML("src", "Sources", sourcesHTML(w.sources), false) : ""}
  `, "article cp-page");
  el.querySelector("[data-back]").onclick = xBack;
  wireLinks(el); wireSections(el);
  onKey = e => { if (e.key === "Escape") xBack(); };
  const li = el.querySelector("[data-learnit]"); if (li) li.onclick = () => hmLearnIt(c);
  el.querySelector("[data-save]").onclick = e => { const on = toggleSave(n.id); e.currentTarget.textContent = on ? "♥" : "♡"; e.currentTarget.classList.toggle("saved", on); };
  el.querySelector("[data-share]").onclick = () => {
    const url = shareURL("color/" + routeSlug(c.n)), text = `${c.n} · ColorHub`;
    if (navigator.share) navigator.share({ text, url }).catch(() => {});
    else { try { navigator.clipboard.writeText(url); toast("Copied the link"); } catch (e) {} }
  };
  // a tap anywhere on a near-name row grows its chip into the next page (js/core.js's morphFrom/runMorph)
  el.querySelectorAll("[data-cp-near]").forEach(b => b.onclick = () => { morphFrom(b.querySelector("i")); openCoreName(b.dataset.h, b.dataset.cpNear); });
  const gi = el.querySelector("[data-glin]"); if (gi) galleryColorRow(gi, c);
  colorPoems(el.querySelector(".c-poems"), c, famC);
  if (typeof worldColorRow === "function") worldColorRow(el, n, famC);
  if (typeof rcWireOpen === "function") rcWireOpen(el, tapped || c.h);
  el.querySelectorAll("[data-copy]").forEach(b => b.onclick = () => { try { navigator.clipboard.writeText(b.dataset.copy); toast("Copied " + b.dataset.copy); } catch (e) {} });
  return el;   // so growFrom (js/core.js, js/home.js hmOpenColor) can grow this page from the tapped honeycomb bubble
}

function wikiPage(n) {
  const sw = n.swatches || [];
  const el = show(`
    ${artTop(n)}
    ${sw.length ? `<div class="p-hero">${sw.map(s => `<div style="--c:${s.h}" data-swatch="${s.h}" data-ink="${ink(s.h)}" title="${esc(s.label || "")}"><span>${esc(sw.length > 3 ? (s.label || "").split(/ · |: |, /)[0] : s.label || "")}</span></div>`).join("")}</div>` : ""}
    <p class="eyebrow p-type">${esc(TYPE_LABEL[n.type] || "Page")}</p>
    <h1 class="p-title">${esc(n.title)}</h1>
    ${n.dek ? `<p class="p-dek">${linkText(n.dek)}</p>` : ""}
    ${figHTML(n.id)}
    ${n.facts && n.facts.length ? `<dl class="facts">${n.facts.map(f => `<div><dt>${esc(f.label)}</dt><dd>${linkText(f.value)}</dd></div>`).join("")}</dl>` : ""}
    ${(() => {
      if (n.stub) return `<p class="fine">This page is being written. Its connections are already live.</p>`;
      const body = n.body || [];
      // pages written with sections use them; older pages get a lead paragraph and a folding "full story"
      const secs = n.sections && n.sections.length ? n.sections.map((x, i) => ["p" + i, x.title, (Array.isArray(x.text) ? x.text : [x.text]).map(t => `<p>${linkText(t)}</p>`).join("") + (x.img != null ? figHTML(n.id, x.img) : "")])
        : body.length > 1 ? [["story", "The full story", body.slice(1).map(t => `<p>${linkText(t)}</p>`).join("") + figHTML(n.id, 1)]] : [];
      if (n.colors && n.colors.length) secs.push(["colors", "Colors", `<div class="chips-wrap">${n.colors.map(cn => { const x = graph().resolve(cn); return x ? `<button class="pchip" data-node="${esc(x.id)}"><i style="--c:${x.h}"></i>${esc(x.title)}</button>` : ""; }).join("")}</div>`]);
      return (body[0] && !(n.sections && n.sections.length) ? `<p class="lead">${linkText(body[0])}</p>` : "") + tocHTML(secs.map(x => [x[0], x[1]])) + secs.map((x, i) => secHTML(x[0], x[1], x[2], i === 0)).join("");
    })()}
    ${connSection(n)}
    ${n.sources ? secHTML("src", "Sources", sourcesHTML(n.sources), false) : ""}
  `, "article");
  wireArticle(el, n); wireSections(el);
}

function paintingPage(n) {
  const pal = n.palette || [];
  const el = show(`
    ${artTop(n)}
    ${n.img ? `<div class="ptg"><img id="pimg" src="${esc(n.img)}" alt="${esc(n.title)} by ${esc(n.artist)}"><canvas id="pmask"></canvas></div>` : ""}
    <p class="eyebrow p-type">Painting · ${esc(n.year || "")}</p>
    <h1 class="p-title">${esc(n.title)}</h1>
    <p class="p-dek">${esc(n.artist || "")}${n.place ? ` · ${esc(n.place)}` : ""}</p>
    ${pal.length ? `<div class="palette">${pal.map((p, i) => `<button class="pal" data-pi="${i}" data-swatch="${p.h}" style="--c:${p.h};flex:${Math.max(p.share, .08)}" data-ink="${ink(p.h)}"><span>${Math.round(p.share * 100)}%</span></button>`).join("")}</div>
      <div class="pal-names">${pal.map((p, i) => { const fam = typeof familyOf === "function" && familyOf(p.h); return `<button class="pal-name" data-pi="${i}" data-swatch="${p.h}"><i style="--c:${p.h}"></i><b>${esc(p.name)}</b>${fam ? `<span>${esc(fam.head.n)} family</span>` : ""}<em class="mono">${p.h}</em></button>`; }).join("")}</div>
      <p class="fine">Tap a swatch to open its page.</p>` : `<p class="fine">This painting's palette is being extracted.</p>`}
    ${n.note ? `<p class="p-body">${linkText(n.note)}</p>` : ""}
    ${connSection(n)}
    ${n.commons ? `<section class="srcs"><h3>Image</h3><ul><li><a href="${esc(n.commons)}" target="_blank" rel="noopener">Wikimedia Commons</a> · ${esc(n.license || "Public domain")}</li></ul></section>` : ""}
  `, "article");
  wireArticle(el, n);
  // highlight where a palette color sits, using the index map
  const img = el.querySelector("#pimg"), cv = el.querySelector("#pmask");
  let mapData = null;
  if (img && n.map) {
    const m = new Image();
    m.onload = () => { const c = document.createElement("canvas"); c.width = m.width; c.height = m.height; const x = c.getContext("2d"); x.drawImage(m, 0, 0); mapData = x.getImageData(0, 0, m.width, m.height); };
    m.src = n.map;
  }
  let on = -1;
  el.querySelectorAll("[data-pi]").forEach(b => b.addEventListener("click", e => {
    if (e.target.closest("[data-to]")) return;
    const i = +b.dataset.pi;
    on = on === i ? -1 : i;
    el.querySelectorAll("[data-pi]").forEach(x => x.classList.toggle("on", +x.dataset.pi === on));
    if (!mapData || !cv) return;
    cv.width = mapData.width; cv.height = mapData.height;
    const ctx = cv.getContext("2d"), out = ctx.createImageData(mapData.width, mapData.height);
    for (let p = 0; p < mapData.data.length; p += 4) {
      const idx = Math.round(mapData.data[p] / 40), dim = on >= 0 && idx !== on;
      out.data[p] = out.data[p + 1] = out.data[p + 2] = 10; out.data[p + 3] = dim ? 200 : 0;
    }
    ctx.putImageData(out, 0, 0);
    cv.classList.toggle("on", on >= 0);
  }));
}

// ======================================================================
// Color of the day: guess its name from four close ones, then read about it
// ======================================================================
function daily() {
  const c = dailyColor(), k = today(), ans = S.daily[k];
  const decoys = nearestColors(c.h, 3, c.n).map(x => x[0]);
  const opts = ans ? null : shuffle([c, ...decoys]);
  const n = colorNode(c), w = n.wiki;
  const dateStr = new Date(Date.now() - 4 * 3600e3).toLocaleDateString(undefined, { month: "long", day: "numeric" });
  const el = show(`
    <header class="deck-top"><button class="icon-btn" data-close aria-label="Close">${ICON.x}</button><span class="eyebrow" style="flex:1;text-align:center">Color of the day · ${esc(dateStr)}</span><span style="width:44px"></span></header>
    <div class="d-swatch" style="--c:${c.h}" data-ink="${ink(c.h)}"><span class="mono">${c.h}</span>${ans ? `<h1>${esc(c.n)}</h1>` : ""}</div>
    <div class="d-body" id="dbody"></div>
  `, "fixed daily");
  const body = el.querySelector("#dbody");
  el.querySelector("[data-close]").onclick = () => go(S.tab || "learn");
  const reveal = ok => {
    const sw = el.querySelector(".d-swatch");
    if (!sw.querySelector("h1")) sw.insertAdjacentHTML("beforeend", `<h1>${esc(c.n)}</h1>`);
    body.innerHTML = `
      <p class="d-verdict ${ok ? "y" : "n"}">${ok ? "You named it." : `It's ${esc(c.n)}.`}</p>
      <p class="d-text">${w && w.facets[0] ? linkText(w.facets[0].text) : esc(c.o || c.d || "")}</p>
      <div class="stack">
        <button class="btn" data-share>${ICON.share} Share today's color</button>
        <div class="row2"><button class="btn ghost" data-page>Its page</button><button class="btn ghost" data-web>More like this</button></div>
      </div>`;
    wireLinks(body);
    body.querySelector("[data-share]").onclick = () => shareCard(c, ok, dateStr);
    body.querySelector("[data-page]").onclick = () => { XSTACK = []; openNode(n); };
    body.querySelector("[data-web]").onclick = () => closeup(n);
  };
  if (ans) return reveal(ans.ok);
  body.innerHTML = `<p class="d-q">What's this color called?</p><div class="d-opts">${opts.map((o, i) => `<button data-i="${i}">${esc(o.n)}</button>`).join("")}</div>`;
  body.querySelectorAll("[data-i]").forEach(b => b.onclick = () => {
    const ok = opts[+b.dataset.i] === c;
    S.daily[k] = { n: c.n, ok }; save();
    buzz(ok ? 12 : [10, 40, 10]);
    b.classList.add(ok ? "right" : "wrong");
    body.querySelector(`[data-i="${opts.indexOf(c)}"]`).classList.add("right");
    later(() => reveal(ok), 650);
  });
}

// A 1080x1350 card: the color, its name and the date. Shared as an image where the browser allows it.
function shareCard(c, ok, dateStr) {
  const W = 1080, H = 1350, cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const x = cv.getContext("2d");
  x.fillStyle = "#121212"; x.fillRect(0, 0, W, H);
  x.fillStyle = c.h; x.beginPath(); x.roundRect(60, 60, W - 120, 900, 48); x.fill();
  x.fillStyle = "#F5F4F0"; x.beginPath(); x.roundRect(60, 920, W - 120, 370, [0, 0, 48, 48]); x.fill();
  x.fillRect(60, 920, W - 120, 60);
  x.fillStyle = "#66665F"; x.font = "600 30px Geist, system-ui, sans-serif"; x.fillText(`COLOR OF THE DAY · ${dateStr.toUpperCase()}`, 110, 1000);
  x.fillStyle = "#141414"; x.font = "400 130px 'Instrument Serif', Georgia, serif"; x.fillText(c.n, 104, 1150);
  x.fillStyle = "#66665F"; x.font = "500 32px 'Geist Mono', monospace"; x.fillText(`${c.h}   ·   ${ok ? "named it" : "learned it"} on ColorHub`, 110, 1230);
  const text = `Today's color: ${c.n} ${ok ? "(I named it)" : ""} · ColorHub`;
  const url = shareURL("color/" + routeSlug(c.n));   // the color's own page, with a preview card
  cv.toBlob(async blob => {
    const file = new File([blob], `colorhub-${c.n.toLowerCase().replace(/\s+/g, "-")}.png`, { type: "image/png" });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) return await navigator.share({ files: [file], text, url });
      if (navigator.share) return await navigator.share({ text, url });
    } catch (e) { if (e && e.name === "AbortError") return; }
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = file.name; a.click();
    toast("Saved the card");
  }, "image/png");
}
