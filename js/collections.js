"use strict";
// The collections registry (design/SIMPLIFY/PLAN.md §3.1/§9): "every collection as a picture tile, recent
// first: any collection is two taps from any place." Stubbed by Lane 1 (the day-0 contract) with every
// collection that already has a real, working door today -- nothing here is a dead end (DAVID-MODEL P1/P3).
// Lane 3 owns this file from here: it should widen COLLECTIONS to the full list in PLAN §3.1 (Poems, Painters
// and Movements & decades as their own pages, not sharing awIndex(); Fashion with a real landing, not the
// World lens fallback) as those pages are built, and give each tile a real picture (`pic`) once it can do so
// without reading lazily loaded data at load time (the lazy-wiki rule, CLAUDE.md "Lazy wiki").
//
// Shape: { id, t (title), count (a short note, or ""), group (a label, not a door -- PLAN §3.1's group
// headings), pic (a css color/gradient standing in for a real picture), open() }.
const COLLECTIONS = [
  { id: "paintings", t: "Paintings", group: "Art", count: "23,778", pic: "#5E4A3A",
    open: () => { if (typeof tlKeepUnder === "function") tlKeepUnder(); if (typeof openPart === "function") openPart("art"); } },
  { id: "arthistory", t: "Art history by color", group: "Art", count: "Movements, countries, painters", pic: "#3E5B4E",
    open: () => { if (typeof awIndex === "function") awIndex(); } },
  // Lane 4 built these two real pages where PLAN §3.1/CONTRACT.md flagged "no door at all" (a painter search
  // buried at the bottom of Art history, and a poems browser that only ever mounted inside the old Explore
  // lens). Widening the registry here so they're not built-but-unreachable -- see js/artwiki.js awPainters()
  // and js/poems.js poemsPage().
  { id: "painters", t: "Painters", group: "Art", count: "840", pic: "#5A4A3E",
    open: () => { if (typeof awPainters === "function") awPainters(); } },
  { id: "poems", t: "Poems", group: "Writing & film", count: "11,440", pic: "#4A3E5A",
    open: () => { if (typeof poemsPage === "function") poemsPage(); } },
  { id: "gems", t: "Gems", group: "Nature", count: "29", pic: "#6B4C7A",
    open: () => { if (typeof gmListPage === "function") gmListPage("gems"); } },
  { id: "flowers", t: "Flowers & dyes", group: "Nature", count: "37 plants", pic: "#4C6B4A",
    open: () => { if (typeof btListPage === "function") btListPage("plants"); } },
  { id: "pulp", t: "Pulp covers", group: "Design", count: "832", pic: "#B5432E",
    open: () => { if (typeof pulpGrid === "function") pulpGrid(); } },
  { id: "photography", t: "Photography", group: "Design", count: "3,465", pic: "#2E2E2E",
    open: () => { if (typeof photographyGrid === "function") photographyGrid(); } },
  { id: "brands", t: "Brands", group: "Design", count: "129", pic: "#1F5B8C",
    open: () => { if (typeof bdBrowser === "function") bdBrowser(); } },
  { id: "design", t: "Design objects", group: "Design", count: "Posters, textiles, ceramics…", pic: "#8C7A4C",
    open: () => { if (typeof doGrid === "function") doGrid(); } },
  { id: "ukiyoe", t: "Ukiyo-e prints", group: "Design", count: "", pic: "#2E4A5B",
    open: () => { if (typeof ukGrid === "function") ukGrid(); } },
  { id: "botanical", t: "Botanical & bird plates", group: "Nature", count: "", pic: "#3A5A3E",
    open: () => { if (typeof bpGrid === "function") bpGrid(); } },
  // Fashion has no zero-argument landing yet (js/world.js fashionPage(slug,...) needs a decade/house slug);
  // the World lens's own tiles are a safe, non-dead-end stand-in until Lane 3 gives it one.
  { id: "fashion", t: "Fashion", group: "Design", count: "", pic: "#7A3E4E",
    open: () => { S.lens = "world"; save(); go("explore"); } },
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
