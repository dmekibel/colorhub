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
      return [...(typeof lkSections === "function" ? lkSections() : []),   // js/looks.js: visual styles, each a family of palettes
        { title: "Stories", sub: "Short reads, a few swipes each.", pins: stories.map(n => pin(n)) },
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
      return [{ title: "Saved", sub: list.length ? `${list.length} kept` : "Tap the heart on anything to keep it here.", pins: list.map(n => pin(n)) }];
    }
    default: {
      // For you: colors shuffled by day, with a painting, a story or a page every few pins, nudged toward the
      // strands you actually follow (interests(), js/learner.js: what you've seen, liked and found, plus any
      // strand you switched on in Journey) — a nudge like fvForYou's, never a filter: every kind still shows up,
      // just a little earlier or later in the mix.
      const day = today(), cs = typeof fvForYou === "function" ? fvForYou(seeded(colors, day)) : seeded(colors, day);
      let others = seeded([...paintings, ...stories, ...pages.filter(p => p.dek)], day);
      if (typeof interests === "function") {
        const STRAND_OF = { painting: "painting", story: "story", page: "article" };
        let w = {};
        try { interests().forEach(x => { w[x.strand] = x.w + (x.on ? 50 : 0); }); } catch (e) { w = {}; }
        const N = others.length || 1;
        others = others.map((n, i) => ({ n, k: i / N - .4 * Math.min(1, (w[STRAND_OF[n.kind]] || 0) / 20) })).sort((a, b) => a.k - b.k).map(x => x.n);
      }
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
// Explore's top level: a vertical pager of five full-screen covers (DESIGN-SYSTEM.md §12).
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
// (a part is inside the Museum room, so it carries the room's address even when a color page sent you here)
function openPart(part) { S.lens = part; S.tab = "explore"; save(); exploreHome(); }
// Back from a part: to the page that opened it, if a page did (js/trail.js tlBackUnder), else the Museum's covers
function backToPager() { if (typeof tlBackUnder === "function" && tlBackUnder()) return; openPart("all"); }

// ---------- tinting a cover or the Art header from its darkest dominant color (DESIGN-SYSTEM §3, §12) ----------
// L* <= 18, chroma <= 20: dark and quiet enough that --ink text over it still clears 7:1.
function tintFromHex(hex) {
  const [, , H] = lch(hex);
  return lchHex(Math.min(lch(hex)[0], 18), Math.min(lch(hex)[1], 20), H);
}
const darkestHex = list => list.reduce((a, b) => lch(b)[0] < lch(a)[0] ? b : a);
const tintFromHexList = list => list && list.length ? tintFromHex(darkestHex(list)) : null;
const tintFromPalette = pal => pal && pal.length ? tintFromHex(darkestHex(pal.map(p => p.h))) : null;
// pad or trim any list of colors to exactly six, for the palette band every cover shows
const cycleTo6 = list => list && list.length ? Array.from({ length: 6 }, (_, i) => list[i % list.length]) : [];
// the palette band (DESIGN-SYSTEM §12, redesigned 2026-10-08): the cover's real colors, sized by share, each one a
// button that opens its color page (js/swatch.js's [data-swatch] tap: the nearest name, with the exact color shown).
// A short palette isn't padded with repeats: fewer, wider chips.
// flex-grow by share, scaled so the shares fill the row (grow values summing under 1 leave a gap at the end)
const shareFlex = (shares, i) => shares && shares[i] != null ? (100 * Math.max(shares[i], .04)).toFixed(1) : 100;
const sixSwatchHTML = (hexes, shares) => {
  const seen = new Set();
  return (hexes || []).slice(0, 6).map((h, i) => {
    if (seen.has(h)) return "";
    seen.add(h);
    const nm = typeof nameOf === "function" ? nameOf(h).n : "";
    return `<button class="xp-chip" data-swatch="${esc(h)}" style="background:${h};flex:${shareFlex(shares, i)} 1 0" aria-label="${esc(nm || h)}"></button>`;
  }).join("");
};
// For you and World have no photo, so their "one great image" is the color itself, full bleed, with its own
// name set large in the corner (the same "color is the interface" move as a color page's hero) — plain flat
// color reads as empty space otherwise, especially when today's pick is very light or very dark.
const flatHeroHTML = (hex, label) => `<div class="xp-flat" style="background:${hex}"></div><div class="xp-flat-label" data-ink="${ink(hex)}">${esc(label)}</div>`;
// a painting: drawn over its own dominant color (the loading state), faded in when it lands (wireCoverImages)
const photoHeroHTML = (src, alt) => `<img class="xp-photo" src="${esc(src)}" alt="${esc(alt)}" decoding="async">`;
// the image didn't load: the painting's colors as stripes, sized by share, with its title, so the cover still reads
const brokenHeroHTML = (hexes, shares, title) => `<div class="xp-stripes">${hexes.map((h, i) => `<i style="background:${h};flex:${shareFlex(shares, i)} 1 0"></i>`).join("")}</div>
  <div class="xp-flat-label xp-broken" data-ink="light">${esc(title)}<small>The image didn't load. These are its colors.</small></div>`;

// what each cover shows today: a color (For you), a hand-built painting (Art), a story (Ideas), a Pantone
// Color of the Year (World), and what you've kept (Saved).
function coverData() {
  const day = today(), g = graph();
  const c = dailyColor(day);
  const paintings = [...g.nodes.values()].filter(x => x.kind === "painting" && !x.stub && x.img && (x.palette || []).length);
  // one Today (js/today.js): the painting that holds today's color, when the graph has it
  const tp = typeof todayPick === "function" ? todayPick(day) : null, tn = tp && tp.painting && g.nodes.get(tp.painting.node);
  const art = tn && tn.kind === "painting" && !tn.stub && tn.img && (tn.palette || []).length ? tn : tp ? null : paintings.length ? seeded(paintings, "artcover" + day)[0] : null;
  const story = g.stories.length ? seeded(g.stories, "ideacover" + day)[0] : null;
  const coty = window.FASHION && FASHION.coty && FASHION.coty[FASHION.coty.length - 1];
  const saved = (S.saved || []).map(id => g.nodes.get(id)).filter(Boolean);
  return { c, art, story, coty, tp, saved };
}
// a color you can see: black, white and the greys only name a painting when it holds nothing chromatic
const isChromaticName = (name, hex) => lch(hex)[1] >= 10 && !/\b(black|white|gr[ae]y|silver|charcoal|dark|gunmetal|slate)\b/i.test(name || "");
function artCoverNote(art) {
  const tp = typeof todayPick === "function" ? todayPick() : null;
  if (tp && tp.painting && tp.painting.node === art.id) return `Today, ${tp.color.n.toLowerCase()} in ${art.title}`;
  const byShare = art.palette.filter(p => p.name).sort((a, b) => (b.share || 0) - (a.share || 0));
  const vivid = byShare.filter(p => isChromaticName(p.name, p.h));
  const names = (vivid.length ? vivid : byShare).map(p => p.name.toLowerCase()).filter((n, i, arr) => arr.indexOf(n) === i).slice(0, vivid.length ? 2 : 1);
  return `Today, ${art.title}${names.length ? `, in ${names.join(" and ")}` : ""}`;
}
// the dominant color of a palette: the loading state's wash, so the cover is already its painting's color
const domHex = (hexes, shares) => hexes.length ? hexes[shares ? Math.max(0, shares.indexOf(Math.max(...shares))) : 0] : null;
// one cover. o: { part, name, lead, note, dot (today's color, a small chip before the note), tint, wash, hero, seam, go }
function coverHTML(o) {
  return `<section class="xp-cover" data-part="${esc(o.part)}" style="${o.tint ? `--tint:${o.tint};` : ""}${o.wash ? `--wash:${o.wash}` : ""}">
    <div class="xp-img">${o.hero || ""}</div>
    ${o.seam ? `<div class="xp-seam">${o.seam}</div>` : ""}
    <div class="xp-body">
      <h2 class="xp-name">${esc(o.name)}</h2>
      <p class="xp-lead">${esc(o.lead)}</p>
      ${o.note ? `<p class="xp-note">${o.dot ? `<i style="background:${o.dot}"></i>` : ""}${esc(o.note)}</p>` : ""}
    </div>
    <div class="xp-act"><button class="btn xp-go" data-go="${esc(o.goTo || o.part)}">${esc(o.go)}${ICON.arrow}</button>${o.alt ? `<button class="btn ghost xp-alt" data-pmap="${esc(o.alt.pmap)}">${esc(o.alt.t)}</button>` : ""}</div>
  </section>`;
}
const artLead = () => `${typeof GAL !== "undefined" && GAL ? GAL.n.toLocaleString("en-US") : "Over 23,000"} paintings and 11,440 poems, by color.`;
// the Art cover from today's painting, whichever way it arrived: a graph node, or dpLoad's daily-set entry
function artCoverHTML(p, note, dot) {
  if (!p) return coverHTML({ part: "art", name: "Art", lead: artLead(), note, dot, wash: dot ? tintFromHex(dot) : null, hero: `<div class="xp-wait"></div>`, go: "Enter Art", alt: { t: "See them all on a map", pmap: "arr=color" } });
  return coverHTML({ part: "art", name: "Art", lead: artLead(), note, dot, tint: tintFromHexList(p.hexes), wash: domHex(p.hexes, p.shares),
    hero: photoHeroHTML(p.img, p.title), seam: sixSwatchHTML(p.hexes, p.shares), go: "Enter Art", alt: { t: "See them all on a map", pmap: "arr=color" } });
}
// Saved: a mosaic of what you've kept (each thing by its first color), or a calm empty state that says how to keep
function savedCoverHTML(saved) {
  const hexOf = n => n.kind === "color" ? n.h : n.palette && n.palette.length ? n.palette[0].h : n.cover && n.cover.length ? n.cover[0] : n.swatches && n.swatches.length ? (n.swatches[0].h || n.swatches[0]) : null;
  const hexes = saved.map(hexOf).filter(h => typeof h === "string" && /^#/.test(h));
  const lead = "Everything you keep, in one place.";
  // empty: twelve empty frames waiting to be filled, a heart in the middle, and a way to go find something
  if (!hexes.length) return coverHTML({ part: "saved", name: "Saved", lead,
    note: saved.length ? `${saved.length} kept` : "Nothing kept yet. Tap the heart on any color or painting.",
    hero: `<div class="xp-mosaic xp-mosaic-empty" style="--cols:3">${"<i></i>".repeat(12)}</div><div class="xp-empty">${ICON_HEART}</div>`,
    go: saved.length ? "Open Saved" : "Find something to keep", goTo: saved.length ? "saved" : "all" });
  const kinds = [["color", "color", "colors"], ["painting", "painting", "paintings"]].map(([k, one, many]) => { const n = saved.filter(x => x.kind === k).length; return n ? `${n} ${n === 1 ? one : many}` : ""; }).filter(Boolean);
  const other = saved.filter(x => x.kind !== "color" && x.kind !== "painting").length;
  if (other) kinds.push(`${other} more`);
  const tiles = hexes.slice(0, 12), cols = tiles.length <= 4 ? tiles.length : tiles.length <= 9 ? 3 : 4;
  return coverHTML({ part: "saved", name: "Saved", lead, note: kinds.join(", "), tint: tintFromHexList(tiles), wash: tiles[0],
    hero: `<div class="xp-mosaic" style="--cols:${cols}">${tiles.map(h => `<i style="background:${h}"></i>`).join("")}</div>`, go: "Open Saved" });
}
// fade each painting in over its own color when it lands; on an error, draw its colors in its place
function wireCoverImages(root, fallback) {
  root.querySelectorAll("img.xp-photo").forEach(img => {
    const cv = img.closest(".xp-cover");
    const done = () => img.classList.add("in");
    const fail = () => { const f = fallback(cv && cv.dataset.part); if (f && img.parentNode) img.parentNode.innerHTML = f; };
    if (img.complete) { img.naturalWidth ? done() : fail(); return; }
    img.addEventListener("load", done, { once: true });
    img.addEventListener("error", fail, { once: true });
  });
}
function explorePager() {
  XSTACK = [];
  const { c, art, story, coty, tp, saved } = coverData();
  const artP = art ? { title: art.title, img: art.img, hexes: art.palette.map(p => p.h), shares: art.palette.map(p => p.share) } : null;
  const covers = [
    coverHTML({ part: "all", name: "For you", lead: "New colors, paintings and stories every day.", note: "Today's color and its five nearest names",
      tint: tintFromHex(c.h), wash: c.h, hero: flatHeroHTML(c.h, c.n), seam: sixSwatchHTML([c.h, ...nearestColors(c.h, 5, c.n).map(x => x[0].h)]), go: "See today's picks" }),
    artP ? artCoverHTML(artP, artCoverNote(art), tp && tp.painting && tp.painting.node === art.id ? tp.color.h : null)
      : artCoverHTML(null, tp ? `Today, ${tp.color.n.toLowerCase()}` : "", tp ? tp.color.h : null),
    story ? coverHTML({ part: "ideas", name: "Ideas", lead: "Stories, systems and history, read through color.", note: "Today's story, in its colors",
      tint: tintFromHexList(story.cover), wash: story.cover[0], hero: `<div class="xp-flat" style="background:linear-gradient(160deg,${story.cover.join(",")})"></div><div class="xp-flat-label" data-ink="${ink(story.cover[story.cover.length - 1])}">${esc(story.title)}</div>`, seam: sixSwatchHTML(story.cover), go: "Read Ideas" })
      : coverHTML({ part: "ideas", name: "Ideas", lead: "Stories, systems and history, read through color.", hero: `<div class="xp-wait"></div>`, go: "Read Ideas" }),
    coty ? coverHTML({ part: "world", name: "World", lead: "Fashion, gems and growing things, in color.", note: `${coty.name}, Color of the Year ${coty.year}`, dot: coty.hex,
      tint: tintFromHex(coty.hex), wash: coty.hex, hero: flatHeroHTML(coty.hex, coty.name), seam: sixSwatchHTML(FASHION.coty.slice(-6).map(y => y.hex)), go: "Enter World" })
      : coverHTML({ part: "world", name: "World", lead: "Fashion, gems and growing things, in color.", hero: `<div class="xp-wait"></div>`, go: "Enter World" }),
    savedCoverHTML(saved),
  ];
  const el = show(`
    <div class="xp-wrap">
      <div class="xp-pager" id="xpPager">${covers.join("")}</div>
      <div class="xp-dots" aria-hidden="true">${covers.map((_, i) => `<i class="${i === 0 ? "on" : ""}"></i>`).join("")}</div>
      <button class="xp-search" data-search aria-label="Search the ${NAV_MUSEUM}">${ICON.search}</button>
    </div>
  `, "explore xp-home", "explore");
  const wrap = el.querySelector(".xp-wrap"), pager = el.querySelector("#xpPager"), dotsEl = el.querySelector(".xp-dots"), dots = [...dotsEl.children], sections = [...pager.querySelectorAll(".xp-cover")];
  wireCoverImages(pager, part => part === "art" && artP ? brokenHeroHTML(artP.hexes, artP.shares, artP.title) : null);
  // the current page: whichever cover fills most of the pager (every cover is exactly one pager tall)
  let cur = -1;
  const onScroll = () => { const i = Math.max(0, Math.min(sections.length - 1, Math.round(pager.scrollTop / (pager.clientHeight || 1)))); if (i === cur) return; cur = i; dots.forEach((d, j) => d.classList.toggle("on", j === i)); };
  pager.addEventListener("scroll", onScroll, { passive: true }); onScroll();
  // the page dots sit on the right edge, level with the part's name (every cover has the same layout below its band)
  const placeDots = () => {
    const nm = el.isConnected && sections[0] && sections[0].querySelector(".xp-name"); if (!nm) return;
    const r = nm.getBoundingClientRect(), w = wrap.getBoundingClientRect();
    dotsEl.style.top = `${Math.round(r.top - w.top + r.height / 2 - dotsEl.offsetHeight / 2)}px`; dotsEl.classList.add("in");
  };
  requestAnimationFrame(placeDots); addEventListener("resize", placeDots); cleanup.push(() => removeEventListener("resize", placeDots));
  // a cover opens its part (the "For you" cover opens its feed directly: openPart("all") is the pager itself);
  // a palette chip opens its color page instead (js/swatch.js, capture phase), so a chip tap never reaches here
  pager.addEventListener("click", e => {
    const b = e.target.closest("[data-go]"), s = e.target.closest("[data-part]"), part = b ? b.dataset.go : s && s.dataset.part; if (!part) return;
    buzz(6); part === "all" ? exploreForYou() : openPart(part);
  });
  el.querySelector("[data-search]").onclick = () => exploreSearchSheet();
  // today's painting isn't a graph node (most of the daily set isn't): draw it onto the Art cover when it lands
  if (!art && tp && typeof dpLoad === "function") dpLoad().then(e => {
    const cv = e && el.isConnected && el.querySelector('.xp-cover[data-part="art"]'); if (!cv) return;
    const pool = e.pool.slice(0, 6), p = { title: e.t, img: e.img, hexes: pool.map(x => x[0]), shares: pool.map(x => x[1]) };
    const tmp = document.createElement("div"); tmp.innerHTML = artCoverHTML(p, `Today, ${tp.color.n.toLowerCase()} in ${e.t}`, tp.color.h);
    const nw = tmp.firstElementChild; cv.setAttribute("style", nw.getAttribute("style") || ""); cv.innerHTML = nw.innerHTML;
    wireCoverImages(cv, () => brokenHeroHTML(p.hexes, p.shares, p.title));
  }).catch(() => {
    // the daily set didn't load (offline): say so quietly on the cover; it still opens Art
    const im = el.isConnected && el.querySelector('.xp-cover[data-part="art"] .xp-img');
    if (im && im.querySelector(".xp-wait")) im.innerHTML = `<div class="xp-flat-label xp-broken" data-ink="light">Today's painting<small>It couldn't load just now. Art is still open.</small></div>`;
  });
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
function artOpenColor(hex, name) { if (typeof tlKeepUnder === "function") tlKeepUnder(); ART_UI = { hex, name: name || "" }; openPart("art"); }
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
  if (typeof xbHome === "function") return xbHome();   // Explore 2.0 (js/browse-ui.js, lane L16): facets, views, rooms; the feed below is the fallback
  XSTACK = [];
  const { hex, name } = ART_UI, tint = hex ? tintFromHex(hex) : null;
  const colors = glHueOrder([...BASICS, ...ALL]);
  const el = show(`
    <div class="art-band" style="${tint ? `--tint:${tint}` : ""}">
      <header class="art-top"><button class="icon-btn glass" data-back aria-label="Back">${ICON.back}</button><button class="icon-btn glass" data-search aria-label="Search">${ICON.search}</button></header>
      <h1 class="p-title">Art</h1>
      <p class="p-dek">${hex ? `In ${esc(name.toLowerCase())}, from 23,781 paintings and eleven thousand poems.` : "23,781 paintings and eleven thousand poems, found by their colors."} <button class="aw-link" data-awindex>Art history by color</button></p>
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
  if (typeof awLoad === "function") awLoad().catch(() => {});
  q.addEventListener("input", () => {
    const s = q.value.trim().toLowerCase();
    if (!s) { results.innerHTML = saved.length ? `<div class="sec-head"><b>Saved</b><span>${saved.length}</span></div>${masonry(saved.map(n => pin(n)))}` : `<p class="fine">Tap ${ICON_HEART} on anything to keep it here, or start typing to search.</p>`; return; }
    const hits = [...graph().nodes.values()].filter(n => (n.title || "").toLowerCase().includes(s)).slice(0, 40);
    const painters = typeof awSearchHTML === "function" ? awSearchHTML(s, () => q.dispatchEvent(new Event("input"))) : "";   // painters, from the art wiki (js/artwiki.js)
    results.innerHTML = painters + (hits.length ? masonry(hits.map(n => pin(n))) : painters ? "" : `<p class="fine">Nothing called that yet.</p>`);
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
      <div class="z-actions"><button class="icon-btn glass${saved ? " saved" : ""}" data-save aria-label="Save" aria-pressed="${saved}">${saved ? ICON.heartOn : ICON.heart}</button></div></header>
    ${hero}
    ${sum ? `<p class="z-sum">${linkText(sum)}</p>` : ""}
    <div class="row2 z-btns">${n.kind === "story" ? `<button class="btn" data-play>${ICON.play} Play story</button>` : `<button class="btn" data-read>Read the page ${ICON.arrow}</button>`}</div>
    ${conns.length ? `<div class="sec-head"><b>More like this</b><span>${conns.length} connections</span></div>
    <div class="lens-key in-page">${lensesHere.map(([k, t]) => `<button class="${k === pick ? "on" : ""}" data-zl="${k}">${t}</button>`).join("")}</div>
    ${masonry(shown.map(c => pin(c.to, { rel: c.rel, why: c.why, h: c.to.kind === "color" ? 120 + (hash(c.to.id) % 3) * 20 : undefined })))}` : ""}
    <div id="more"></div>
  `, "article closeup");
  el.querySelector("[data-back]").onclick = xBack;
  el.querySelector("[data-save]").onclick = e => { const on = toggleSave(n.id); e.currentTarget.innerHTML = on ? ICON.heartOn : ICON.heart; e.currentTarget.setAttribute("aria-pressed", on); e.currentTarget.classList.toggle("saved", on); };
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
  if (push && XSTACK[XSTACK.length - 1] !== "p:" + n.id) XSTACK.push("p:" + n.id);   // one entry, even when two handlers open the same link
  if (n.kind === "color") return colorPage(n, tapped);
  if (n.kind === "painting") return paintingPage(n);
  if (n.page) return n.page(n);   // archive pages (passages, films) bring their own renderer
  return wikiPage(n);
}
// Pinterest-style back (ROADMAP.md §17 job #2): XSTACK is the one shared crumb trail behind every screen this
// app can open from the honeycomb, Explore, the gallery or Studio's photo shelf — whichever of those opened
// the first screen in a chain, going back far enough always lands there, never on an unrelated tab.
// When the trail runs out it goes back to where it started (X_ROOT, set by js/trail.js whenever a room or the map
// shows, and by router.js for a page opened from an address): that room, or else the map. Never a guessed room
// (David, 2026-10-08: "sometimes the app takes you to the Explore page without you wanting to").
const xFallbackTab = () => ["learn", "gym", "explore", "studio"].includes(X_ROOT) ? X_ROOT : null;
function xToOrigin() {
  const r = xFallbackTab();
  if (r) return go(r);
  X_ROOT = null;
  return typeof hmHome === "function" ? hmHome() : go("learn");
}
// Where a chain of pages started when that wasn't a room: "home" when a bubble on the honeycomb opened it. Home is its
// own floor now (not a tab), so without this the trail ran out onto whatever room S.tab last pointed at, and a pull-down
// on a color opened from Home dropped you into Studio (David). go() clears it.
let X_ROOT = null;
function xStep(prev) {
  if (!prev) return xToOrigin();
  // Studio screens (ROADMAP.md §17 job #1): plain tokens (no ":"), since each reopens from its own remembered
  // state rather than an id. Checked before the generic node lookup at the bottom, which would otherwise treat
  // "harmony" etc. as a (nonexistent) graph node id and silently do nothing.
  if (prev === "chords") return chordsPage({ push: false });   // the masters' chords (js/chords.js)
  if (prev.startsWith("pt:")) { const q = ptParse(prev.slice(3)); return paintingsOfPage(q.hexes, { ...q.st, push: false }); }   // color in paintings (js/paintingsof.js)
  if (prev === "favs") return favShelf();   // your colors (js/favs.js)
  if (prev === "favs-taste") return favTaste();   // your taste (js/favprofile.js)
  if (prev.startsWith("aw:") && typeof awStep === "function") return awStep(prev);   // the art wiki (js/artwiki.js)
  if (prev === "wheel") return gamutWheel(GW_LAST && GW_LAST.preset, GW_LAST && GW_LAST.pts, false);
  if (prev === "wheelview") return gwReopenView();
  if (prev === "namer") return LAB.namer(NMR_LAST.hex, false);   // Name any color (js/namer.js), with the color you left it on
  if (prev === "harmony") return LAB.harmony(LAB_HARMONY_STATE && LAB_HARMONY_STATE.base, LAB_HARMONY_STATE && LAB_HARMONY_STATE.scheme, false);
  if (prev === "contrast") return LAB.contrast(LAB_CONTRAST_STATE && LAB_CONTRAST_STATE.set, LAB_CONTRAST_STATE && LAB_CONTRAST_STATE.slot, false);
  if (prev.startsWith("pal:")) return openSavedPalette(prev.slice(4), false);   // a saved palette (js/studio.js)
  if (prev.startsWith("g:")) return galleryPage(+prev.slice(2), false, ...(typeof tlTapped === "function" ? [tlTapped(prev), tlTol(prev)] : []));   // with the color that brought you (js/trail.js)   // a gallery painting (js/gallery.js)
  if (prev.startsWith("ar:") && typeof arStep === "function") return arStep(prev.slice(3));   // a hub or "which" page (js/article.js)
  if (prev.startsWith("ph:")) return photoPage(prev.slice(3), false);   // a saved photo (js/photos.js)
  if (prev.startsWith("poem:")) return poemPage(prev.slice(5), { back: true });   // a poem (js/poems.js)
  // a library color's own page, not one of the 101 (js/names.js): it isn't a graph node, so look it up by name
  if (prev.startsWith("n:")) {
    const nm = decodeURIComponent(prev.slice(2));
    return loadCoreNames().then(() => { const e = (CORE_NAMES || []).find(x => x.n === nm); e ? namePage(e, false, typeof tlTapped === "function" ? tlTapped(prev) : null) : xToOrigin(); });
  }
  if (prev.startsWith("r:") && typeof tlReplay === "function") return tlReplay(prev);   // any other addressed screen (js/trail.js)
  const node = graph().nodes.get(prev.replace(/^[zp]:/, ""));
  return prev.startsWith("z:") ? closeup(node, { back: true }) : openNode(node, false, typeof tlTapped === "function" ? tlTapped(prev) : null);   // the exact tapped color too (js/trail.js)
}
function xBack() { XSTACK.pop(); BACK_RENDER = true; xStep(XSTACK[XSTACK.length - 1]); }
// links inside any article
function wireLinks(el) {
  el.addEventListener("click", e => {
    const a = e.target.closest("[data-to],[data-node]");
    if (!a) return;
    // a node the graph doesn't hold yet (a gem or flower page registered by its own file, after the wiki rebuilt
    // the graph) is left for js/swatch.js's fallback, which waits for it: never a silent dead tap
    const node = graph().nodes.get(a.dataset.to || a.dataset.node);
    if (!node) return;
    e.preventDefault();
    openNode(node);
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

// The color page for one of the app's own colors. It draws through js/richpage.js colorDossier, the same page and
// order every other name gets (js/names.js namePage): the cover, the glance, one paper primary ("Learn it"/"Review
// it") with quiet save/share icons, its story (the written article as a door, else its wiki facets as its own short
// story: never a look-alike's), field notes, the Walk, and three things to read next. (The old accordion, the
// look-alike strip, Nearest names and the Connections dump are gone: their content lives in those sections.)
//
// `tapped`: an exact hex from a swatch that opened THIS page as its nearest name, but isn't quite it (David,
// 2026-10-07 — js/swatch.js openTappedColor). The cover splits: your color, with the name's own color in its corner,
// one sentence on how they differ, and Save your color.
// Three things to read next, from the color web: stories and idea pages (never more colors: the Walk has those)
function cpReadNextHTML(n) {
  const list = (typeof connections === "function" ? connections(n) : []).filter(x => x.to && x.to.kind !== "color" && x.to.kind !== "painting" && !x.to.stub).slice(0, 3);
  if (!list.length) return "";
  return `<section class="rp-next"><h2>Read next</h2>${list.map(x => `<button class="rp-next-row" data-node="${esc(x.to.id)}"><b>${esc(x.to.title)}</b><span>${esc(x.why || x.rel || "")}</span></button>`).join("")}</section>`;
}
// David, 2026-10-09: the old primary row (Learn it + Save + Share icons) is gone -- Learn it, Pair with… and
// the heart now live in the cover's own compact action row (js/richpage.js rpActionRowHTML), and the heart is
// the one "save" a color page offers (the older bookmark-style isSaved/toggleSave stays for Explore's pins,
// just not wired here any more). Share moves to the ID card.
function colorPage(n, tapped) {
  const c = n.c, w = n.wiki;
  tapped = tapped ? String(tapped).toUpperCase() : null;
  const coreSelf = (CORE_NAMES || (typeof coreFallback === "function" ? coreFallback() : [])).find(e => e.n.toLowerCase() === c.n.toLowerCase());
  const entry = { n: c.n, h: c.h, src: (coreSelf && coreSelf.src) || ["app"], also: (coreSelf && coreSelf.also) || [], notes: (coreSelf && coreSelf.notes) || [] };
  const el = colorDossier(entry, { tapped, node: n,
    facet: typeof arFacetArt === "function" ? arFacetArt(c) : null, codes: codeRows(tapped || c.h) });
  const li = el.querySelector("[data-learnit]"); if (li) li.onclick = () => typeof prQuick === "function" ? prQuick({ seed: c }) : hmLearnIt(c);   // js/practice.js: the instant-deck sheet
  if (typeof learnerLog === "function" && !tapped) learnerLog({ type: "seen", color: c, src: "page" });   // the Learner Model (js/learner.js)
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
      const secs = n.sections && n.sections.length ? n.sections.map((x, i) => ["p" + i, x.title, (Array.isArray(x.text) ? x.text : [x.text]).map(t => `<p>${linkText(t)}</p>`).join("") + figHTML(n.id, x.img != null ? x.img : i + 1)])
        : body.length > 1 ? [["story", "The full story", body.slice(1).map((t, i) => `<p>${linkText(t)}</p>` + figHTML(n.id, i + 1)).join("")]] : [];
      if (n.colors && n.colors.length) secs.push(["colors", "Colors", `<div class="chips-wrap">${n.colors.map(cn => { const x = graph().resolve(cn); return x ? `<button class="pchip" data-node="${esc(x.id)}"><i style="--c:${x.h}"></i>${esc(x.title)}</button>` : ""; }).join("")}</div>`]);
      return (body[0] && !(n.sections && n.sections.length) ? `<p class="lead">${linkText(body[0])}</p>` : "") + tocHTML(secs.map(x => [x[0], x[1]])) + secs.map((x, i) => secHTML(x[0], x[1], x[2], i === 0)).join("");
    })()}
    ${typeof wgWikiTail === "function" ? wgWikiTail(n) : ""}
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
    <p class="eyebrow p-type">${esc(n.typeLabel || "Painting")}${n.year ? " · " + esc(n.year) : ""}</p>
    <h1 class="p-title">${esc(n.title)}</h1>
    <p class="p-dek">${n.photographerSlug ? `<button class="aw-link" data-photographer="${esc(n.photographerSlug)}">${esc(n.artist || "")}</button>` : esc(n.artist || "")}${n.place ? ` · ${esc(n.place)}` : ""}</p>
    ${pal.length ? `<div class="palette">${pal.map((p, i) => `<button class="pal" data-pi="${i}" data-swatch="${p.h}" style="--c:${p.h};flex:${Math.max(p.share, .08)}" data-ink="${ink(p.h)}"><span>${Math.round(p.share * 100)}%</span></button>`).join("")}</div>
      <div class="pal-names">${pal.map((p, i) => { const fam = typeof familyOf === "function" && familyOf(p.h); return `<button class="pal-name" data-pi="${i}" data-swatch="${p.h}"><i style="--c:${p.h}"></i><b>${esc(p.name)}</b>${fam ? `<span>${esc(fam.head.n)} family</span>` : ""}<em class="mono">${p.h}</em></button>`; }).join("")}</div>
      <p class="fine">Tap a swatch to open its page.</p>${typeof prLearnBtn === "function" ? prLearnBtn(".palette", n.title) : ""}` : `<p class="fine">This painting's palette is being extracted.</p>`}
    ${n.note ? `<p class="p-body">${linkText(n.note)}</p>` : ""}
    ${connSection(n)}
    ${n.commons ? `<section class="srcs"><h3>Image</h3><ul><li><a href="${esc(n.commons)}" target="_blank" rel="noopener">${esc(n.imgSrcLabel || "Wikimedia Commons")}</a> · ${esc(n.license || "Public domain")}</li></ul></section>` : ""}
  `, "article");
  wireArticle(el, n);
  // Phase 2 (js/photography.js): a photograph's byline opens its photographer's page, same pattern as a painter link
  const phLink = el.querySelector("[data-photographer]"); if (phLink) phLink.onclick = e => { e.stopPropagation(); if (typeof photographerPage === "function") photographerPage(phLink.dataset.photographer); };
  // L18 H4: the ColorSet verbs for this painting, "On the map" first (js/home.js hmPaintingSet, js/colorset.js csActions)
  if (pal.length && typeof hmPaintingSet === "function" && typeof csActions === "function") { const fine = el.querySelector(".pal-names + .fine"); if (fine) fine.after(csActions(hmPaintingSet(n), { only: ["map", "learn", "play"], back: () => paintingPage(n) })); }
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

// (The color of the day, daily(), is now "Name today's color" in js/colordle.js; its share card is js/sharecard.js.)
