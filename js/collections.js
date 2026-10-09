"use strict";
// The collections registry (design/SIMPLIFY/PLAN.md §3.1/§9): "every collection as a picture tile, recent
// first: any collection is two taps from any place." Widened by Lane 3 (the four places) to the full list in
// PLAN §3.1 -- every collection David named now has a real, working door (DAVID-MODEL P1/P3): nothing here is
// a dead end. `group` matches the Museum screen's plain-noun headings exactly (js/explore.js museumHome()).
//
// David, 2026-10-09, on the flat gradient squares: "Add a picture to each one of these squares." Each tile
// now shows a real cover (`img`, object-fit:cover, a bottom scrim keeps the label legible) or, where a photo
// would be dishonest (Brands: no logos, trademark), a small swatch mosaic (`swatches`) built from real data.
// `pic` stays as the color shown while the image loads and the fallback if it 404s (placesCollTile, js/places.js).
// Every img/swatch value below is either a LOCAL asset already shipped for the curated painting pages
// (img/paintings/*, eager in data/paintings.js) or a specific, already-in-the-repo data record's own hotlinked
// Commons/museum URL (data/gem-images.js, data/botany-images.js, data/fashion.js -- all eager; or, for the
// collections whose own corpus is its own lazy fetch (pulp/photography/design objects/ukiyo-e/botanical
// plates), one hand-picked record read directly out of that corpus's JSON file, so nothing here forces an
// early fetch of a multi-MB archive just to draw a tile.
//
// Shape: { id, t (title), count (a short note, or ""), group (a label, not a door -- PLAN §3.1's group
// headings), pic (fallback/loading color), img? (a cover photo URL), swatches? (a mosaic when a photo
// wouldn't be honest), cover? (a function returning { img } or { svg } for the bottom 6 -- see below), open() }.
//
// David, 2026-10-10, on the bottom 6 (which only had swatch mosaics): "come up with clever ones... drawn from
// its own content." Each is "type as image" or a real public-domain scan -- never a generic photo -- built
// from one real record read directly out of that collection's own data file (poems-index.json, passages.json,
// films.js, looks.js) or a verified Wikimedia Commons file (checked reachable with curl before use, same as
// `img` above). An inline SVG cover has no real loading gap (unlike `img`, it isn't a network round trip) and
// no onerror path, so its `pic` is effectively never seen -- pick one dark enough that white tile-label text
// still passes contrast on its own (tools/check_legibility.js reads `pic`, not the drawn cover, as the
// worst-case background), rather than one that visually matches the cover (Literature's cream book page).
// every other cover here). `cover()` picks one of a small set, seeded by the day, so it's cheap and varies.
const COLL_DAY = () => (typeof today === "function" ? today() : 0);
const collPick = list => list[Math.abs((typeof hash === "function" ? hash("coll" + COLL_DAY()) : COLL_DAY())) % list.length];
// a tiny SVG helper: wraps text/color fragments as tspans on one line (poemCoverSVG, literatureCoverSVG)
const svgSpans = line => line.map(f => `<tspan${f.c ? ` fill="${f.c}"` : ""}${f.w ? ` font-weight="${f.w}"` : ""}>${esc(f.t)}</tspan>`).join("");

// ---------- Poems: a real line, typeset, its color word in its color (David: "type as image") ----------
const POEM_COVERS = [
  { poet: "Robert Frost", work: "The Road Not Taken", year: 1916,
    lines: [[{ t: "Two roads diverged" }], [{ t: "in a " }, { t: "yellow", c: "#F2C81F", w: 700 }, { t: " wood," }]] },
  { poet: "Robert Burns", work: "A Red, Red Rose", year: 1794,
    lines: [[{ t: "O my Luve's like a" }], [{ t: "red", c: "#D62F2F", w: 700 }, { t: ", " }, { t: "red", c: "#D62F2F", w: 700 }, { t: " rose," }]] },
];
function poemCoverSVG(p) {
  const lineH = 25, y0 = 100 - (p.lines.length - 1) * lineH / 2 + 5;
  const rows = p.lines.map((line, i) => `<text x="100" y="${y0 + i * lineH}" text-anchor="middle" font-family="Georgia,'Times New Roman',serif" font-style="italic" font-size="16" fill="#EDE8DC">${svgSpans(line)}</text>`).join("");
  return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"><rect width="200" height="200" fill="#211D16"/>${rows}
    <text x="100" y="168" text-anchor="middle" font-family="Georgia,serif" font-size="11" fill="#B8AFA0">${esc(p.poet)}, ${p.year}</text></svg>`;
}

// ---------- Literature: a book-page passage, drop cap, its color word in its color ----------
const LIT_COVERS = [
  { author: "Dante Alighieri", work: "Purgatory", year: 1320, drop: "A",
    lines: [[{ t: "sweet color of" }], [{ t: "oriental " }, { t: "sapphire", c: "#0F52BA", w: 700 }]] },
  { author: "Goethe", work: "Faust", year: 1808, drop: "G",
    lines: [[{ t: "ray are all theories," }], [{ t: "green", c: "#2E9A4F", w: 700 }, { t: " alone Life's" }], [{ t: "golden", c: "#C9A227", w: 700 }, { t: " tree." }]] },
];
function literatureCoverSVG(p) {
  const rows = p.lines.map((line, i) => `<text x="58" y="${62 + i * 24}" font-family="Georgia,serif" font-size="15" fill="#2A2420">${svgSpans(line)}</text>`).join("");
  return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"><rect width="200" height="200" fill="#EDE4D3"/>
    <text x="16" y="96" font-family="Georgia,serif" font-size="78" font-weight="700" fill="#2A2420">${esc(p.drop)}</text>
    ${rows}
    <text x="58" y="${62 + p.lines.length * 24 + 16}" font-family="Georgia,serif" font-style="italic" font-size="11" fill="#6B5F4E">${esc(p.author)}, ${p.work}</text></svg>`;
}

// ---------- Films: a barcode -- one film's own named colors, as vertical bars, in story order ----------
const FILM_COVERS = [
  { title: "The Wizard of Oz", year: 1939, cols: ["#8A6A4F", "#9B111E", "#F2C81F", "#50C878"] },
  { title: "The Umbrellas of Cherbourg", year: 1964, cols: ["#F2A0B8", "#A8EBC4", "#F7E15A", "#A8778F", "#F7F6F2"] },
  { title: "Blade Runner", year: 1982, cols: ["#FFB000", "#E0306A", "#DCE3E8", "#111316"] },
];
function filmBarcodeSVG(f) {
  const n = f.cols.length, w = 200 / n;
  const bars = f.cols.map((c, i) => `<rect x="${(i * w).toFixed(1)}" y="0" width="${w.toFixed(1)}" height="200" fill="${c}"/>`).join("");
  const holes = Array.from({ length: 9 }, (_, i) => 12 + i * 22);
  const sprockets = holes.map(x => `<circle cx="${x}" cy="10" r="4" fill="#00000055"/><circle cx="${x}" cy="190" r="4" fill="#00000055"/>`).join("");
  return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">${bars}${sprockets}</svg>`;
}

// ---------- Aesthetics: a moodboard, 4 looks' own palettes in a grid, named small ----------
const AESTH_SETS = [
  [{ n: "Cottagecore", c: ["#8FAF6A", "#D9E4B5", "#F3E6C4", "#E8B4B8"] }, { n: "Vaporwave", c: ["#FF71CE", "#01CDFE", "#05FFA1", "#B967FF"] },
   { n: "Dark academia", c: ["#2B1D14", "#4A3222", "#6F4E37", "#C9B79C"] }, { n: "Y2K", c: ["#C9D1D9", "#4F7CAC", "#9BE7FF", "#2B2F36"] }],
  [{ n: "Grunge", c: ["#7A2A24", "#2B2B2A", "#5C6B4A", "#8C7B66"] }, { n: "Cottagecore", c: ["#6C5B3E", "#F7F4EA", "#B5A1D3", "#8FAF6A"] },
   { n: "Y2K", c: ["#E9EEF3", "#8A96A3", "#2B2F36", "#9BE7FF"] }, { n: "Vaporwave", c: ["#2A1B3D", "#FFFB96", "#FF71CE", "#05FFA1"] }],
];
function aestheticsMoodboardSVG(set) {
  const pos = [[0, 0], [100, 0], [0, 100], [100, 100]];
  const cells = set.map((look, i) => {
    const [cx, cy] = pos[i], sw = look.c.slice(0, 4);
    const swatches = sw.map((h, j) => `<rect x="${cx + j * (100 / sw.length)}" y="${cy}" width="${100 / sw.length}" height="76" fill="${h}"/>`).join("");
    return `<g>${swatches}<rect x="${cx}" y="${cy + 76}" width="100" height="24" fill="#000000B0"/>
      <text x="${cx + 50}" y="${cy + 92}" text-anchor="middle" font-family="-apple-system,sans-serif" font-size="11" font-weight="600" fill="#F3F3F1">${esc(look.n)}</text></g>`;
  }).join("");
  return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">${cells}<rect x="97" width="6" height="200" fill="#17160F"/><rect y="97" width="200" height="6" fill="#17160F"/></svg>`;
}

// ---------- Stories: a painting tied to one color's story, or a big initial in that color ----------
const STORY_COVERS = [
  { img: "img/paintings/pearl-earring-thumb.jpg", title: "Girl with a Pearl Earring", note: "Ultramarine" },
  { letter: "T", hex: "#66023C", note: "Tyrian purple" },
];
function storyInitialSVG(s) {
  return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"><rect width="200" height="200" fill="#1C1A14"/>
    <text x="100" y="148" text-anchor="middle" font-family="Georgia,serif" font-size="155" font-weight="700" fill="${s.hex}">${esc(s.letter)}</text></svg>`;
}

// ---------- Pigments & ideas: real 1700s-1800s color-science plates (Newton 1704, Werner/Syme 1821) ----------
const PIGMENT_COVERS = [
  { img: "https://upload.wikimedia.org/wikipedia/commons/0/0a/Newton%27s_colour_circle.png", note: "Newton's colour circle, 1704" },
  { img: "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/0e/Purples_werner-nomenclature.jpg/330px-Purples_werner-nomenclature.jpg", note: "Werner's nomenclature, 1821" },
  { img: "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/07/Werners_yellows.jpg/330px-Werners_yellows.jpg", note: "Werner's nomenclature, 1821" },
];

const COLLECTIONS = [
  // ---------- Art ----------
  { id: "paintings", t: "Paintings", group: "Art", count: "23,778", pic: "#5E4A3A", img: "img/paintings/starry-night-thumb.jpg",
    open: () => { if (typeof tlKeepUnder === "function") tlKeepUnder(); if (typeof openPart === "function") openPart("art"); } },
  { id: "painters", t: "Painters", group: "Art", count: "840", pic: "#7A5C3E", img: "img/paintings/the-kiss-thumb.jpg",
    open: () => { if (typeof awIndex === "function") awIndex(); } },
  { id: "movements", t: "Movements & decades", group: "Art", count: "", pic: "#4A5B3E", img: "img/paintings/composition-vii-thumb.jpg",
    open: () => { if (typeof awIndex === "function") awIndex(); } },
  // ---------- Design ----------
  // Thayaht's 1920s fashion plate for Madeleine Vionnet, from data/fashion.js's own (eager) thumb field.
  { id: "fashion", t: "Fashion", group: "Design", count: "991 garments", pic: "#7A3E4E",
    img: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/25/Thayaht_-_Gazette_du_bon_ton_-_Un_manteau_de_Madeleine_Vionnet.jpg/500px-Thayaht_-_Gazette_du_bon_ton_-_Un_manteau_de_Madeleine_Vionnet.jpg",
    open: () => { if (typeof fashionList === "function") fashionList("decade"); else { S.lens = "world"; save(); go("explore"); } } },
  // "Amazing Stories", March 1930 -- the single most reproduced pulp sci-fi cover there is; read straight out
  // of data/design/objects-pulp.json (that record's own "i" field).
  { id: "pulp", t: "Pulp covers", group: "Design", count: "832", pic: "#B5432E",
    img: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Amazing_stories_193003.jpg/330px-Amazing_stories_193003.jpg",
    open: () => { if (typeof pulpGrid === "function") pulpGrid(); } },
  // Prokudin-Gorsky's 1911 portrait of Alim Khan, Emir of Bukhara -- the best-known early color photograph in
  // the archive; read out of data/photography/photos.json.
  { id: "photography", t: "Photography", group: "Design", count: "3,465", pic: "#2E2E2E",
    img: "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7d/Alim_Khan_%281880%E2%80%931944%29%2C_Emir_of_Bukhara%2C_photographed_by_S.M._Prokudin-Gorskiy_in_1911.jpg/960px-Alim_Khan_%281880%E2%80%931944%29%2C_Emir_of_Bukhara%2C_photographed_by_S.M._Prokudin-Gorskiy_in_1911.jpg",
    open: () => { if (typeof photographyGrid === "function") photographyGrid(); } },
  // No logos (trademark; design/LEGAL-COLOR-DATA.md R1-R4) -- a small mosaic of real, sourced brand colors instead.
  { id: "brands", t: "Brands", group: "Design", count: "129", pic: "#1F5B8C",
    swatches: ["#0ABAB5", "#E4002B", "#351C15", "#367C2B", "#FFC72C"],
    open: () => { if (typeof bdBrowser === "function") bdBrowser(); } },
  // "Fly By Clipper To Guatemala", a vintage travel poster -- data/design/objects-poster.json.
  { id: "design", t: "Design objects", group: "Design", count: "10,577", pic: "#4A3F28",
    img: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Fly_By_Clipper_To_Guatemala.jpg/330px-Fly_By_Clipper_To_Guatemala.jpg",
    open: () => { if (typeof doGrid === "function") doGrid(); } },
  // Hokusai's "Thirty-Six Views of Mount Fuji" print at the Cleveland Museum of Art (a direct museum hotlink,
  // same source js/ukiyoe.js's own "cmau" case already uses for display) -- data/ukiyoe/prints.json.
  { id: "ukiyoe", t: "Ukiyo-e prints", group: "Design", count: "1,711", pic: "#2E4A5B",
    img: "https://openaccess-cdn.clevelandart.org/1924.964/1924.964_web.jpg",
    open: () => { if (typeof ukGrid === "function") ukGrid(); } },
  // ---------- Nature ----------
  // An emerald in its matrix -- data/gem-images.js (eager; GEM_IMAGES["gm:gem:emerald"]).
  { id: "gems", t: "Gems", group: "Nature", count: "29", pic: "#6B4C7A",
    img: "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/dd/%28Muzo%29_Emerald_crystal_in_its_matrix.jpg/960px-%28Muzo%29_Emerald_crystal_in_its_matrix.jpg",
    open: () => { if (typeof gmListPage === "function") gmListPage("gems"); } },
  // A Dianthus (pink) illustration -- data/botany-images.js (eager; BOTANY_IMAGES["bt:plant:pink"]).
  { id: "flowers", t: "Flowers & dyes", group: "Nature", count: "37 plants", pic: "#4C6B4A",
    img: "https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3e/Illustration_Dianthus_deltoides1.jpg/960px-Illustration_Dianthus_deltoides1.jpg",
    open: () => { if (typeof btListPage === "function") btListPage("plants"); } },
  // A Curtis's Botanical Magazine lily plate -- data/botanical/plates.json.
  { id: "botanical", t: "Botanical & bird plates", group: "Nature", count: "889 plates", pic: "#3A5A3E",
    img: "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/56/Curtis%27s_botanical_magazine_%28No._858%29_%288471016342%29.jpg/500px-Curtis%27s_botanical_magazine_%28No._858%29_%288471016342%29.jpg",
    open: () => { if (typeof bpGrid === "function") bpGrid(); } },
  // ---------- Writing & film ----------
  { id: "poems", t: "Poems", group: "Writing & film", count: "11,440", pic: "#211D16",
    cover: () => ({ svg: poemCoverSVG(collPick(POEM_COVERS)) }),
    open: () => { if (typeof musePoems === "function") musePoems(); } },
  { id: "literature", t: "Literature", group: "Writing & film", count: "225 passages", pic: "#3A2F1E",
    cover: () => ({ svg: literatureCoverSVG(collPick(LIT_COVERS)) }),
    open: () => { if (typeof archWhen === "function" && typeof passagesIndexPage === "function") archWhen(() => passagesIndexPage()); } },
  { id: "films", t: "Films", group: "Writing & film", count: "32", pic: "#1A1A2E",
    cover: () => ({ svg: filmBarcodeSVG(collPick(FILM_COVERS)) }),
    open: () => { if (typeof museFilms === "function") museFilms(); } },
  // ---------- Looks & ideas ----------
  { id: "aesthetics", t: "Aesthetics", group: "Looks & ideas", count: "159 looks", pic: "#17160F",
    cover: () => ({ svg: aestheticsMoodboardSVG(collPick(AESTH_SETS)) }),
    open: () => { if (typeof museAesthetics === "function") museAesthetics(); } },
  { id: "stories", t: "Stories", group: "Looks & ideas", count: "", pic: "#6B5B95",
    cover: () => { const s = collPick(STORY_COVERS); return s.img ? { img: s.img } : { svg: storyInitialSVG(s) }; },
    open: () => { if (typeof museStories === "function") museStories(); } },
  { id: "pigments", t: "Pigments & ideas", group: "Looks & ideas", count: "", pic: "#8C4A2E",
    cover: () => ({ img: collPick(PIGMENT_COVERS).img }),
    open: () => { if (typeof musePigments === "function") musePigments(); } },
];
// recent-first (PLAN §3.1 "Recent... leads both the Museum screen and the Places menu's grid"), in S.recentColl
function collRecent() {
  const order = Array.isArray(S.recentColl) ? S.recentColl : [];
  const byId = new Map(COLLECTIONS.map(c => [c.id, c]));
  const seen = new Set(), out = [];
  order.forEach(id => { const c = byId.get(id); if (c && !seen.has(id)) { seen.add(id); out.push(c); } });
  COLLECTIONS.forEach(c => { if (!seen.has(c.id)) { seen.add(c.id); out.push(c); } });
  return out;
}
function collOpen(id) {
  const c = COLLECTIONS.find(x => x.id === id);
  if (!c) return;
  S.recentColl = [id, ...((Array.isArray(S.recentColl) ? S.recentColl : []).filter(x => x !== id))].slice(0, 12);
  save();
  try { c.open(); } catch (e) { console.warn("collOpen", id, e); toast("That collection didn't open"); }
}
