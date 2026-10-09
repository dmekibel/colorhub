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
// wouldn't be honest), open() }.
const COLLECTIONS = [
  // ---------- Art ----------
  { id: "paintings", t: "Paintings", group: "Art", count: "23,778", pic: "#5E4A3A", img: "img/paintings/starry-night-thumb.jpg",
    open: () => { if (typeof tlKeepUnder === "function") tlKeepUnder(); if (typeof openPart === "function") openPart("art"); } },
  { id: "painters", t: "Painters", group: "Art", count: "840", pic: "#7A5C3E", img: "img/paintings/the-kiss-thumb.jpg",
    open: () => { if (typeof awPainters === "function") awPainters(); else if (typeof awIndex === "function") awIndex(); } },
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
  { id: "poems", t: "Poems", group: "Writing & film", count: "11,440", pic: "#4A6B7A",
    swatches: ["#4A6B7A", "#B5546B", "#C9A66B", "#4C6B4A"],
    open: () => { if (typeof poemsPage === "function") poemsPage(); else if (typeof musePoems === "function") musePoems(); } },
  { id: "literature", t: "Literature", group: "Writing & film", count: "225 passages", pic: "#2E4B3A",
    swatches: ["#2E4B3A", "#7A5C3E", "#6B4C7A", "#B5432E"],
    open: () => { if (typeof archWhen === "function" && typeof passagesIndexPage === "function") archWhen(() => passagesIndexPage()); } },
  { id: "films", t: "Films", group: "Writing & film", count: "32", pic: "#1A1A2E",
    swatches: ["#1A1A2E", "#B5432E", "#C9A66B", "#2E2E2E"],
    open: () => { if (typeof museFilms === "function") museFilms(); } },
  // ---------- Looks & ideas ----------
  { id: "aesthetics", t: "Aesthetics", group: "Looks & ideas", count: "159 looks", pic: "#5C4A2E",
    swatches: ["#5C4A2E", "#4A3A68", "#7A3E52", "#35492E"],
    open: () => { if (typeof museAesthetics === "function") museAesthetics(); } },
  { id: "stories", t: "Stories", group: "Looks & ideas", count: "", pic: "#6B5B95",
    swatches: ["#6B5B95", "#C9A66B", "#4A6B7A", "#8C4A2E"],
    open: () => { if (typeof museStories === "function") museStories(); } },
  { id: "pigments", t: "Pigments & ideas", group: "Looks & ideas", count: "", pic: "#8C4A2E",
    swatches: ["#8C4A2E", "#4A5B3E", "#1F5B8C", "#B5432E"],
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
