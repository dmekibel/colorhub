#!/usr/bin/env node
"use strict";
// Builds data/aesthetics/graph.json: the node/edge web behind #/web (the honeycomb-style "family tree" browser,
// js/aesthetics-graph.js). Sources (no invented facts):
//   - data/looks.js (104 looks: art movements, design eras, film looks, internet aesthetics) -- window.LOOKS
//   - data/artists/meta.json (840 painters, Wikidata CC0: dates, nationality, movement, teacher P1066/P802,
//     influenced-by P737 -- already fetched by tools/wikidata_artists.py, so this script reads it rather than
//     re-querying Wikidata)
//   - data/artists/context.json (the 23 movements with real pages via js/artwiki.js awGroup("movement", ...))
//   - a short hand-curated list below, for subcultures and design movements with no Wikidata painter corpus
//     (punk, mod, rave, hip-hop...). Each curated edge carries a one-line, factual reason.
// Run: node tools/build_aesthetics_graph.js   (writes data/aesthetics/graph.json)

const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const read = p => fs.readFileSync(path.join(ROOT, p), "utf8");
const readJSON = p => JSON.parse(read(p));

const routeSlug = s => String(s).normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

// ---------- load looks.js (a plain <script>, not a module: eval it with window.LOOKS rewritten to module.exports) ----------
let LOOKS;
{
  const src = read("data/looks.js").replace("window.LOOKS", "module.exports");
  const m = { exports: null };
  // eslint-disable-next-line no-new-func
  new Function("module", src)(m);
  LOOKS = m.exports;
}
if (!Array.isArray(LOOKS)) throw new Error("couldn't load data/looks.js");

const META = readJSON("data/artists/meta.json");
const CTX = readJSON("data/artists/context.json");
const ARTISTS = META.a;
const CANON_MOVEMENTS = new Set(CTX.mv);

// ---------- rough sRGB -> CIE Lab (for approximate "shared colors" distance only; the app's own de2000/lab
// live in js/colormath.js and aren't reused here since this is an offline, one-off build step) ----------
function hexToLab(hex) {
  const n = parseInt(hex.slice(1), 16), r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
  const lin = c => c > 0.04045 ? Math.pow((c + 0.055) / 1.055, 2.4) : c / 12.92;
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047, Y = (R * 0.2126 + G * 0.7152 + B * 0.0722) / 1, Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = t => t > 0.008856 ? Math.pow(t, 1 / 3) : (7.787 * t + 16 / 116);
  const [fx, fy, fz] = [f(X), f(Y), f(Z)];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
const labDist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
// inverse, for giving every node ONE representative swatch hex to color its bubble (the real per-node palette,
// when there is one, still lives in `palette`; this is just the single-color fill)
function labToHex(lab) {
  const [L, A, B] = lab;
  const fy = (L + 16) / 116, fx = fy + A / 500, fz = fy - B / 200;
  const fi = t => t * t * t > 0.008856 ? t * t * t : (t - 16 / 116) / 7.787;
  const X = fi(fx) * 0.95047, Y = fi(fy), Z = fi(fz) * 1.08883;
  const R = X * 3.2406 + Y * -1.5372 + Z * -0.4986, G = X * -0.9689 + Y * 1.8758 + Z * 0.0415, Bb = X * 0.0557 + Y * -0.2040 + Z * 1.0570;
  const gam = c => { c = Math.max(0, Math.min(1, c)); return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; };
  const toHex = c => Math.round(gam(c) * 255).toString(16).padStart(2, "0");
  return "#" + toHex(R) + toHex(G) + toHex(Bb);
}
// a crude 0 (cool) .. 1 (warm) score from Lab's a/b, used only to place nodes near like-colored neighbors
function warmth(lab) { const [, a, b] = lab; const h = Math.atan2(b, a) * 180 / Math.PI; const d = Math.cos((h - 50) * Math.PI / 180); return (d + 1) / 2; }

// ---------- nodes ----------
const nodes = new Map();   // id -> node
const addNode = n => { nodes.set(n.id, n); return n; };

// look nodes: every entry in data/looks.js
for (const l of LOOKS) {
  const avgLab = (() => {
    const pal = l.pals[0].c;
    let L = 0, A = 0, B = 0, tot = 0;
    for (const [hex, , share] of pal) { const lab = hexToLab(hex); L += lab[0] * share; A += lab[1] * share; B += lab[2] * share; tot += share; }
    return tot ? [L / tot, A / tot, B / tot] : [50, 0, 0];
  })();
  addNode({ id: "look:" + l.id, type: "look", slug: l.id, title: l.name, cat: l.cat, era: l.era, y: l.y,
    essence: l.essence, place: null, palette: l.pals[0].c.slice(0, 6).map(c => c[0]), lab: avgLab, hasPage: true,
    source: "data/looks.js" });
}

// movement nodes: the union of the 23 canonical (real-page) movements and every movement tag on a painter
const movementMembers = new Map();   // name -> [artist slug...]
for (const slug of Object.keys(ARTISTS)) for (const mv of ARTISTS[slug].mv || []) {
  if (!movementMembers.has(mv)) movementMembers.set(mv, []);
  movementMembers.get(mv).push(slug);
}
const allMovementNames = new Set([...CANON_MOVEMENTS, ...movementMembers.keys()]);
for (const name of allMovementNames) {
  const members = movementMembers.get(name) || [];
  let y0 = null, y1 = null, L = 0, C = 0, W = 0, n = 0;
  for (const slug of members) {
    const a = ARTISTS[slug]; if (!a) continue;
    if (a.y0 != null) y0 = y0 == null ? a.y0 : Math.min(y0, a.y0);
    if (a.y1 != null) y1 = y1 == null ? a.y1 : Math.max(y1, a.y1);
    if (a.L != null) { L += a.L; C += a.C; W += a.W; n++; }
  }
  const nat = {}; members.forEach(s => (ARTISTS[s] && ARTISTS[s].nat || []).forEach(c => nat[c] = (nat[c] || 0) + 1));
  const place = Object.entries(nat).sort((a, b) => b[1] - a[1])[0];
  addNode({ id: "movement:" + routeSlug(name), type: "movement", slug: routeSlug(name), title: name,
    era: y0 != null && y1 != null ? `c. ${y0}–${y1}` : null, y: y0,
    essence: null, place: place ? place[0] : null, memberCount: members.length,
    lab: n ? [L / n * 1.6, (W / n - 0.5) * 40, (W / n - 0.5) * 60] : null,   // rough Lab stand-in from mean L/C/W, for shared-colors only
    hasPage: CANON_MOVEMENTS.has(name), source: CANON_MOVEMENTS.has(name) ? "data/artists/context.json + js/artwiki.js" : "data/artists/meta.json (painter-level Wikidata movement tags)" });
}

// artist nodes: all 840 painters
for (const slug of Object.keys(ARTISTS)) {
  const a = ARTISTS[slug];
  addNode({ id: "artist:" + slug, type: "artist", slug, title: a.n, era: a.y0 != null && a.y1 != null ? `${a.y0}–${a.y1}` : (a.b ? String(a.b) : null),
    y: a.y0 != null ? a.y0 : a.b, essence: null, place: (a.nat || [])[0] || null, movements: a.mv || [],
    lab: a.L != null ? [a.L, (a.W - 0.5) * 40, (a.W - 0.5) * 60] : null, img: a.img || null, q: a.q || null,
    hasPage: true, source: "data/artists/meta.json (Wikidata, CC0)" });
}

// ---------- hand-curated subculture / extra-movement nodes (no Wikidata painter corpus; dates and places are
// documented social history, not invented) ----------
const CURATED = [
  { id: "subculture:punk", title: "Punk", era: "1974–early 1980s", y: 1974, place: "United Kingdom / United States",
    essence: "DIY music and street style built from torn clothes, safety pins and anti-establishment graphics.",
    palette: ["#15120F", "#8A8A8A", "#C0122B", "#F2E9DC"] },
  { id: "subculture:mod", title: "Mod", era: "early-mid 1960s", y: 1962, place: "United Kingdom",
    essence: "Sharp Italian-cut suits, parka coats and scooters, built around soul and R&B records.",
    palette: ["#0B2E6B", "#C8102E", "#F4F1EA", "#1A1A1A"] },
  { id: "subculture:rave-acid-house", title: "Rave / acid house", era: "late 1980s–1990s", y: 1988, place: "United Kingdom",
    essence: "Warehouse parties built around acid house music, smiley-face graphics and neon rave-wear.",
    palette: ["#FFE600", "#FF2FB0", "#0F0F23", "#2BFF88"] },
  { id: "subculture:hip-hop", title: "Hip-hop", era: "1973–1980s", y: 1973, place: "United States (New York City)",
    essence: "South Bronx DJ and street culture; its visual identity grew through graffiti, breakdance crews and gold jewelry.",
    palette: ["#111111", "#D4AF37", "#C0122B", "#F4F1EA"] },
  { id: "subculture:hippie-counterculture", title: "Hippie counterculture", era: "1960s", y: 1965, place: "United States",
    essence: "Anti-war, communal youth culture: tie-dye, long hair and Eastern-influenced dress.",
    palette: ["#E8622C", "#4C7A3B", "#F2C94C", "#6B4C9A"] },
  { id: "subculture:disco", title: "Disco", era: "1970s", y: 1973, place: "United States",
    essence: "Nightclub culture built around four-on-the-floor dance music, mirror balls and metallic fabric.",
    palette: ["#2B1B4B", "#D4AF37", "#C0122B", "#111111"] },
  { id: "subculture:new-wave", title: "New wave", era: "late 1970s–1980s", y: 1978, place: "United Kingdom / United States",
    essence: "Angular, synth-driven pop culture that followed punk, with sharper, more graphic-design-literate style.",
    palette: ["#111111", "#FF2FB0", "#00C2C7", "#F4F1EA"] },
  { id: "subculture:skinhead", title: "Skinhead", era: "late 1960s–1970s", y: 1968, place: "United Kingdom",
    essence: "Working-class London youth culture, originally close to mod and Jamaican rocksteady/ska, defined by cropped hair and work boots.",
    palette: ["#111111", "#C0122B", "#1C2B5A", "#F4F1EA"] },
  { id: "subculture:rockabilly", title: "Rockabilly", era: "1950s", y: 1954, place: "United States",
    essence: "Early rock 'n' roll youth style: pompadours, leather jackets and pin-up print dresses.",
    palette: ["#111111", "#C0122B", "#F4F1EA", "#1C2B5A"] },
  { id: "subculture:beatnik", title: "Beatnik", era: "1950s", y: 1950, place: "United States",
    essence: "Beat Generation bohemia: black turtlenecks, berets and coffeehouse poetry readings.",
    palette: ["#111111", "#3A3A3A", "#8A8A8A", "#F4F1EA"] },
  { id: "subculture:northern-soul", title: "Northern soul", era: "1970s", y: 1970, place: "United Kingdom",
    essence: "English dance-club scene built on American soul 45s, close to mod in dress and footwork.",
    palette: ["#0B2E6B", "#D4AF37", "#111111", "#F4F1EA"] },
  { id: "subculture:glam-rock", title: "Glam rock", era: "early-mid 1970s", y: 1971, place: "United Kingdom",
    essence: "Theatrical androgyny: glitter, platform boots and metallic fabric, built around Bowie and T. Rex.",
    palette: ["#D4AF37", "#FF2FB0", "#111111", "#4C7A3B"] },
  { id: "subculture:goth", title: "Goth", era: "early 1980s–present", y: 1980, place: "United Kingdom",
    essence: "Post-punk subculture built on dark romanticism: black clothing, pale makeup and Victorian-mourning references.",
    palette: ["#0A0A0A", "#4B0036", "#8A8A8A", "#F4F1EA"] },
  { id: "movement:arts-and-crafts", title: "Arts and Crafts movement", era: "c. 1880–1910", y: 1880, place: "United Kingdom",
    essence: "A reform movement against industrial manufacture: handmade furniture, textiles and botanical pattern design (William Morris).", moveType: true },
  { id: "movement:op-art", title: "Op Art", era: "1960s", y: 1964, place: "international",
    essence: "Optical-abstraction painting (Bridget Riley, Victor Vasarely) using high-contrast geometric pattern to trick the eye into perceived movement.", moveType: true },
];
for (const c of CURATED) addNode({ ...c, type: c.id.split(":")[0], slug: c.id.split(":")[1], hasPage: false, memberCount: 0,
  lab: c.palette ? (() => { const labs = c.palette.map(hexToLab); return labs.reduce((s, l) => [s[0] + l[0] / labs.length, s[1] + l[1] / labs.length, s[2] + l[2] / labs.length], [0, 0, 0]); })() : null,
  source: "curated: documented social/design history (no painter corpus; see essence for the claim)" });

// ---------- edges ----------
const edges = [];
const edgeKey = new Set();
function addEdge(from, to, type, o = {}) {
  if (!from || !to || from === to || !nodes.has(from) || !nodes.has(to)) return;
  const k = type + "|" + [from, to].sort().join("|");
  if (o.dedupe !== false && edgeKey.has(k)) return;
  edgeKey.add(k);
  edges.push({ from, to, type, label: o.label || type, why: o.why || null, source: o.source || null });
}

// 1) lineage: teacher -> student (Wikidata P1066/P802), via artist.tt
for (const slug of Object.keys(ARTISTS)) {
  const a = ARTISTS[slug];
  for (const t of a.tt || []) if (t.s && ARTISTS[t.s]) addEdge("artist:" + slug, "artist:" + t.s, "lineage", { label: "studied under", why: `${a.n} studied under ${t.n}.`, source: "Wikidata P1066/P802", dedupe: false });
}
// 2) influence: influenced-by (Wikidata P737), via artist.in
for (const slug of Object.keys(ARTISTS)) {
  const a = ARTISTS[slug];
  for (const t of a.in || []) if (t.s && ARTISTS[t.s]) addEdge("artist:" + slug, "artist:" + t.s, "influence", { label: "influenced by", why: `${a.n} was influenced by ${t.n}.`, source: "Wikidata P737", dedupe: false });
}
// 3) member_of: artist -> movement (P135, carried on the painter record as mv[])
for (const slug of Object.keys(ARTISTS)) {
  const a = ARTISTS[slug];
  for (const mv of a.mv || []) addEdge("artist:" + slug, "movement:" + routeSlug(mv), "member_of", { label: "member of", why: `${a.n} is tagged with ${mv} on Wikidata.`, source: "Wikidata P135", dedupe: false });
}
// 4) look "related" field -> influence/kinship edges (data/looks.js's own curation)
for (const l of LOOKS) for (const r of l.related || []) addEdge("look:" + l.id, "look:" + r, "influence", { label: "related look", why: `ColorHub's own "Related looks" pairing.`, source: "data/looks.js" });
// 5) motifs: looks that share a named motif (capped: each look links to at most 5 nearest by shared-motif count)
{
  const byLook = LOOKS.map(l => ({ id: "look:" + l.id, motifs: new Set(l.motifs || []) }));
  for (let i = 0; i < byLook.length; i++) {
    const scored = [];
    for (let j = 0; j < byLook.length; j++) {
      if (i === j) continue;
      let shared = 0; for (const m of byLook[i].motifs) if (byLook[j].motifs.has(m)) shared++;
      if (shared) scored.push([byLook[j].id, shared, [...byLook[i].motifs].filter(m => byLook[j].motifs.has(m))]);
    }
    scored.sort((a, b) => b[1] - a[1]).slice(0, 5).forEach(([to, shared, which]) => addEdge(byLook[i].id, to, "motifs", { label: "shares motifs", why: `Both feature ${which.slice(0, 2).join(" and ")}.`, source: "data/looks.js motifs" }));
  }
}
// 6) same_era: nodes with a year, within 20 years, capped to the 6 nearest per node (looks + movements + subcultures only -- artists would be thousands of edges for little insight)
{
  const dated = [...nodes.values()].filter(n => n.type !== "artist" && n.y != null);
  for (const n of dated) {
    const near = dated.filter(o => o !== n && Math.abs(o.y - n.y) <= 20).sort((a, b) => Math.abs(a.y - n.y) - Math.abs(b.y - n.y)).slice(0, 6);
    for (const o of near) addEdge(n.id, o.id, "same_era", { label: "same era", why: `Both place to around the same years (${n.y} / ${o.y}).`, source: "computed from era/y fields" });
  }
}
// 7) same_place: movements and subcultures that share a dominant place (capped)
{
  const placed = [...nodes.values()].filter(n => (n.type === "movement" || n.type === "subculture") && n.place);
  for (const n of placed) {
    const near = placed.filter(o => o !== n && o.place === n.place).slice(0, 6);
    for (const o of near) addEdge(n.id, o.id, "same_place", { label: "same place", why: `Both centered in ${n.place}.`, source: "computed from nationality/place fields" });
  }
}
// 8) shared_artists: movements that share member painters (co-membership), threshold >= 3, capped
{
  const movs = [...nodes.values()].filter(n => n.type === "movement");
  for (let i = 0; i < movs.length; i++) {
    const mi = new Set(movementMembers.get(movs[i].title) || []);
    if (!mi.size) continue;
    const scored = [];
    for (let j = 0; j < movs.length; j++) {
      if (i === j) continue;
      const mj = movementMembers.get(movs[j].title) || [];
      let shared = 0; for (const s of mj) if (mi.has(s)) shared++;
      if (shared >= 3) scored.push([movs[j].id, shared]);
    }
    scored.sort((a, b) => b[1] - a[1]).slice(0, 5).forEach(([to, shared]) => addEdge(movs[i].id, to, "shared_artists", { label: "shared painters", why: `${shared} painters are tagged with both movements on Wikidata.`, source: "computed from data/artists/meta.json" }));
  }
}
// 9) shared_colors: approximate palette (Lab) nearest neighbors, within and across look/movement nodes that have a lab value, capped to 5 per node
{
  const colored = [...nodes.values()].filter(n => n.lab && (n.type === "look" || n.type === "movement" || n.type === "subculture"));
  for (const n of colored) {
    const scored = colored.filter(o => o !== n).map(o => [o.id, labDist(n.lab, o.lab)]).sort((a, b) => a[1] - b[1]).slice(0, 5);
    for (const [to, d] of scored) if (d < 28) {
      // a word, not a raw number with no reference (DESIGN-CANON law 5) -- same move as js/artwiki.js's own
      // tie(), with thresholds calibrated to this metric's own range (most pairs land under 10)
      const closeness = d < 3 ? "very close palettes" : d < 7 ? "close palettes" : d < 14 ? "somewhat different palettes" : "different palettes";
      addEdge(n.id, to, "shared_colors", { label: "similar palette", why: `${closeness.charAt(0).toUpperCase()}${closeness.slice(1)} (approximate, for browsing only).`, source: "computed, approximate Lab from each node's palette/mean L-C-W" });
    }
  }
}
// 10) curated influence / revival / lineage edges for subcultures and internet aesthetics (each with a one-line, factual reason; no invented facts)
const CURATED_EDGES = [
  ["look:cottagecore", "movement:arts-and-crafts", "influence", "Revives the Arts and Crafts movement's return to pastoral handwork and botanical pattern."],
  ["look:vaporwave", "look:corporate-memphis", "influence", "Borrows 1980s/90s corporate branding gloss and gradients."],
  ["look:vaporwave", "look:memphis", "influence", "Borrows the Memphis Group's geometric shapes and color blocking."],
  ["look:vaporwave", "look:seapunk", "influence", "Shares seapunk's aquatic, glitched source imagery."],
  ["subculture:punk", "look:grunge", "revival", "1990s grunge inherited punk's DIY ethic and thrift-store palette."],
  ["subculture:punk", "subculture:skinhead", "same_era", "Overlapping working-class London youth scenes of the late 1970s."],
  ["subculture:punk", "look:riot-grrrl", "lineage", "Riot grrrl (early 1990s) applied punk's DIY aesthetic and zine culture to feminist punk bands."],
  ["subculture:mod", "subculture:northern-soul", "lineage", "Northern soul's 1970s dance-club scene grew directly out of mod's soul and R&B record culture."],
  ["subculture:mod", "subculture:skinhead", "lineage", "Early skinhead style (1968) split off from mod, trading sharp suits for a harder, working-class look."],
  ["subculture:hip-hop", "look:hypebeast", "lineage", "Streetwear and sneaker culture descend from hip-hop fashion's logos and sportswear."],
  ["subculture:hippie-counterculture", "look:psychedelic", "lineage", "The psychedelic look visualized the counterculture's drug culture and anti-establishment politics."],
  ["subculture:beatnik", "subculture:hippie-counterculture", "lineage", "Beat Generation bohemia of the 1950s fed directly into 1960s hippie counterculture."],
  ["subculture:new-wave", "look:synthwave", "revival", "Synthwave is a 2010s retrofuturist revival of new wave's synth-pop visual identity."],
  ["subculture:rave-acid-house", "look:synthwave", "influence", "Synthwave's neon grid look echoes rave flyers and acid-house visuals."],
  ["subculture:disco", "subculture:new-wave", "same_era", "Both were dominant nightclub/pop youth cultures of the late 1970s."],
  ["subculture:glam-rock", "subculture:new-wave", "influence", "New wave inherited glam rock's theatrical, androgynous styling."],
  ["subculture:goth", "look:nu-goth", "revival", "Nu-goth (2010s) is a minimalist internet-era revival of 1980s goth style."],
  ["subculture:goth", "look:cybergoth", "revival", "Cybergoth (1990s-2000s) fused goth's dark romanticism with rave and industrial futurism."],
  ["subculture:goth", "look:pastel-goth", "revival", "Pastel goth (2010s) kept goth's iconography but swapped black for pastel color."],
  ["subculture:goth", "look:witch-house", "revival", "Witch house (2010s internet micro-genre) reused goth's occult imagery with digital glitch."],
  ["subculture:rockabilly", "subculture:beatnik", "same_era", "Both are 1950s American youth subcultures."],
  // design and art movement lineage (David, next pass: "many more curated, sourced edges for internet
  // aesthetics and fashion/design movements... each with a one-line factual reason")
  ["look:bauhaus", "look:swiss-style", "influence", "Bauhaus's functionalist grid teaching fed directly into the Swiss/International Typographic Style of the 1950s."],
  ["look:de-stijl", "look:bauhaus", "influence", "De Stijl's primary-color geometric abstraction (Theo van Doesburg taught at the Bauhaus in 1922) directly shaped early Bauhaus design."],
  ["look:art-nouveau", "look:art-deco", "influence", "Art Deco emerged in the 1920s partly as a reaction against Art Nouveau's organic curves, favoring geometric streamlined form instead."],
  ["look:art-deco", "look:streamline-moderne", "lineage", "Streamline Moderne (1930s) grew directly out of Art Deco, trading ornament for aerodynamic curves."],
  ["look:streamline-moderne", "look:space-age", "influence", "Streamline Moderne's aerodynamic curves anticipated Space Age design's chrome, curved forms."],
  ["look:space-age", "look:y2k", "revival", "Y2K design revived 1960s Space Age futurism's chrome and curved forms for the turn of the millennium."],
  ["look:y2k", "look:frutiger-aero", "lineage", "Frutiger Aero (2004–2013) extended Y2K's optimistic tech gloss into glossy, nature-tinged UI design."],
  ["look:memphis", "look:postmodern", "influence", "The Memphis Group's clashing color and pattern (founded by Ettore Sottsass, 1981) became a signature look of 1980s postmodern design."],
  ["look:memphis", "look:corporate-memphis", "lineage", "Corporate Memphis (2010s illustration style) takes its name and flat geometric figures from the Memphis Group."],
  ["look:pop-art", "look:psychedelic", "influence", "Pop art's bold flat color blocks of the early 1960s fed directly into psychedelic poster art later in the decade."],
  ["look:psychedelic", "look:art-nouveau", "revival", "1960s psychedelic poster artists (Wes Wilson and others, for the Fillmore shows) deliberately revived Art Nouveau's sinuous lines and lettering."],
  ["movement:op-art", "look:pop-art", "same_era", "Op Art and Pop Art both rose to prominence in the early-to-mid 1960s, pursuing optical abstraction and commercial imagery respectively."],
  ["look:vienna-secession", "look:art-nouveau", "member_of", "The Vienna Secession (1897) was the Austrian branch of the wider Art Nouveau movement."],
  ["look:constructivism", "look:de-stijl", "same_era", "Constructivism and De Stijl developed in parallel after WWI, both reducing form to geometric abstraction."],
  ["look:brutalism", "look:postmodern", "influence", "1970s–80s postmodern architecture developed largely as a direct reaction against Brutalism's bare concrete forms."],
  ["look:eighties-neon", "look:synthwave", "revival", "Synthwave (2010s) is a deliberate nostalgic revival of 1980s neon design and typography."],
  ["look:ukiyo-e", "look:art-nouveau", "influence", "Japanese ukiyo-e woodblock prints, popularized in Europe as Japonisme, directly shaped Art Nouveau's flat color fields and flowing line."],
  ["look:fauvism", "look:expressionism", "influence", "Fauvism's raw, unmixed color (from 1905) directly influenced German Expressionism in the years that followed."],
  ["look:wabi-sabi", "look:japandi", "lineage", "Japandi (2010s) blends wabi-sabi's imperfect, natural aesthetic with Scandinavian minimalism."],
  ["look:scandinavian", "look:japandi", "lineage", "Japandi fuses Scandinavian design's pale minimalism with Japanese wabi-sabi."],
  ["look:dark-academia", "look:light-academia", "revival", "Light academia (2020s) is a direct palette-inverted variant of dark academia, keeping its scholarly motifs."],
  ["look:dark-academia", "look:chaotic-academia", "revival", "Chaotic academia (2020s) keeps dark academia's scholarly obsession but drops its curated, muted palette discipline."],
  ["look:dark-academia", "look:science-academia", "revival", "Science academia (2020s) applies dark academia's scholarly-aesthetic template to STEM instead of the humanities."],
  ["subculture:goth", "look:cyberpunk", "same_era", "Goth and early cyberpunk fiction both took shape in the UK/US post-punk scene of the early-to-mid 1980s."],
  ["look:cyberpunk", "look:cybergoth", "influence", "Cybergoth (1990s) fused cyberpunk's techno-dystopian imagery with goth fashion."],
  ["look:steampunk", "look:dieselpunk", "same_era", "Dieselpunk applies steampunk's retro-technology conceit to the interwar era instead of the Victorian one."],
  ["look:dieselpunk", "look:raygun-gothic", "influence", "Raygun Gothic (1930s–50s sci-fi serials like Flash Gordon) is closely related to dieselpunk's interwar retro-futurism."],
  ["look:raygun-gothic", "look:atompunk", "influence", "Atompunk extends raygun gothic's retro-futurism into the atomic-age optimism of the 1950s–60s."],
  ["look:barbiecore", "look:millennial-pink", "influence", "Barbiecore (2023, tied to the Barbie film) intensified millennial pink into a louder, fully saturated hot pink."],
  ["look:emo", "look:e-girl-e-boy", "revival", "E-girl/e-boy style (2019–, via TikTok) draws directly on emo and scene's dark eyeliner and dyed hair."],
  ["look:visual-kei", "look:gothic-lolita", "same_place", "Both grew out of Tokyo's Harajuku street-fashion and Japanese rock (visual kei) scenes."],
  ["look:decora", "look:gothic-lolita", "same_place", "Decora and gothic lolita both grew out of Harajuku street fashion, at opposite ends of its color range."],
  ["subculture:goth", "look:health-goth", "influence", "Health goth (2013–) applies goth's black-on-black palette to techwear and athletic gear."],
];
for (const [from, to, type, why] of CURATED_EDGES) addEdge(from, to, type, { label: type.replace("_", " "), why, source: "curated (documented cultural/design history)" });

// 11) the aesthetics KB (data/aesthetics/kb/<id>.json, another lane's in-progress per-look lineage write-up --
// this script is re-runnable as more files land). Each file's lineage.influenced_by / lineage.influences are
// free-text strings; only the ones that resolve to a real node here (by slug, or the same string with a
// trailing "movement"/"style"/"group"/"aesthetic"/"subculture" word stripped) become edges, so nothing invented
// gets added just because the KB prose mentions it in passing.
{
  const KB_DIR = path.join(ROOT, "data/aesthetics/kb");
  const stripSuffix = s => s.replace(/\s+(movement|style|group|aesthetic|subculture|art|era)$/i, "").trim();
  const resolveKbRef = ref => {
    const tries = [ref, stripSuffix(ref)];
    for (const t of tries) {
      const slug = routeSlug(t);
      if (nodes.has("look:" + slug)) return "look:" + slug;
      if (nodes.has("subculture:" + slug)) return "subculture:" + slug;
      if (nodes.has("movement:" + slug)) return "movement:" + slug;
    }
    return null;
  };
  let kbFiles = [];
  try { kbFiles = fs.readdirSync(KB_DIR).filter(f => f.endsWith(".json")); } catch (e) { /* not written yet */ }
  let kbEdgeCount = 0;
  for (const f of kbFiles) {
    let kb; try { kb = JSON.parse(fs.readFileSync(path.join(KB_DIR, f), "utf8")); } catch (e) { continue; }
    const selfId = "look:" + (kb.id || f.replace(/\.json$/, ""));
    if (!nodes.has(selfId) || !kb.lineage) continue;
    const name = nodes.get(selfId).title;
    for (const ref of kb.lineage.influenced_by || []) {
      const m = resolveKbRef(ref); if (!m) continue;
      addEdge(m, selfId, "influence", { label: "influenced by", why: `${name}'s own ColorHub knowledge-base entry lists this as an influence.`, source: `data/aesthetics/kb/${f}` });
      kbEdgeCount++;
    }
    for (const ref of kb.lineage.influences || []) {
      const m = resolveKbRef(ref); if (!m) continue;
      addEdge(selfId, m, "influence", { label: "influences", why: `${name}'s own ColorHub knowledge-base entry lists this among what it influenced.`, source: `data/aesthetics/kb/${f}` });
      kbEdgeCount++;
    }
  }
  console.log(`aesthetics KB: ${kbFiles.length} files read, ${kbEdgeCount} edges resolved`);
}

// ---------- a deterministic force-directed layout, precomputed so the browser never runs a simulation ----------
function layout(nodeList, edgeList, iters = 240) {
  const idx = new Map(nodeList.map((n, i) => [n.id, i]));
  let seed = 7; const rnd = () => { seed = (seed * 48271) % 2147483647; return seed / 2147483647; };
  const pos = nodeList.map((n, i) => { const a = rnd() * Math.PI * 2, r = 6 + rnd() * 30; return [Math.cos(a) * r, Math.sin(a) * r]; });
  const deg = new Array(nodeList.length).fill(0);
  const eIdx = edgeList.map(e => [idx.get(e.from), idx.get(e.to)]).filter(([a, b]) => a != null && b != null);
  for (const [a, b] of eIdx) { deg[a]++; deg[b]++; }
  const N = nodeList.length, area = N * 140, k = Math.sqrt(area / Math.max(1, N));
  // a third of this archive's painters carry no teacher/influence/movement tag at all (no edges), so pure
  // repulsion would fling them out into empty space forever; a weak pull toward the centroid (same idea as
  // d3-force's forceCenter) keeps every node, connected or not, somewhere inside one readable constellation
  const GRAVITY = 0.012;
  for (let it = 0; it < iters; it++) {
    const disp = pos.map(() => [0, 0]);
    // repulsion (all pairs -- N ~= 1050, fine for a one-off offline build)
    for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
      let dx = pos[i][0] - pos[j][0], dy = pos[i][1] - pos[j][1];
      let d2 = dx * dx + dy * dy || 0.01, d = Math.sqrt(d2);
      const f = (k * k) / d2;
      dx /= d; dy /= d;
      disp[i][0] += dx * f; disp[i][1] += dy * f; disp[j][0] -= dx * f; disp[j][1] -= dy * f;
    }
    // attraction along edges
    for (const [a, b] of eIdx) {
      let dx = pos[a][0] - pos[b][0], dy = pos[a][1] - pos[b][1];
      let d = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const f = (d * d) / k;
      dx /= d; dy /= d;
      disp[a][0] -= dx * f; disp[a][1] -= dy * f; disp[b][0] += dx * f; disp[b][1] += dy * f;
    }
    // gravity toward the centroid, stronger on nodes with no edges to pull them in any other way
    for (let i = 0; i < N; i++) { const g = GRAVITY * (deg[i] ? 1 : 2.2); disp[i][0] -= pos[i][0] * g; disp[i][1] -= pos[i][1] * g; }
    const temp = Math.max(0.5, k * (1 - it / iters));
    for (let i = 0; i < N; i++) {
      const dl = Math.sqrt(disp[i][0] ** 2 + disp[i][1] ** 2) || 0.01;
      pos[i][0] += (disp[i][0] / dl) * Math.min(dl, temp);
      pos[i][1] += (disp[i][1] / dl) * Math.min(dl, temp);
    }
  }
  // normalize to roughly -1000..1000
  const xs = pos.map(p => p[0]), ys = pos.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const scale = 2000 / Math.max(1, Math.max(maxX - minX, maxY - minY));
  return nodeList.map((n, i) => ({ x: Math.round((pos[i][0] - (minX + maxX) / 2) * scale) / 1000, y: Math.round((pos[i][1] - (minY + maxY) / 2) * scale) / 1000, r: Math.round((2 + Math.sqrt(deg[i])) * 10) / 10 }));
}

const nodeList = [...nodes.values()];
const laid = layout(nodeList, edges);
nodeList.forEach((n, i) => {
  n.px = laid[i].x; n.py = laid[i].y; n.r = laid[i].r;   // layout position (px/py) -- kept separate from `y` (year)
  n.swatch = n.palette && n.palette[0] ? n.palette[0] : (n.lab ? labToHex(n.lab) : "#8C9096");
  delete n.lab;
});

// ---------- one more layout per edge type, so the Show sheet's edge-type switch can rearrange the whole
// screen instead of just toggling which lines draw (David: "different connections should show differently").
// Stored as parallel arrays (out.layouts[type][i] = [x,y] for out.nodes[i]), not per-node objects, since
// repeating 9 key names on every one of ~1,026 nodes would cost far more than one flat array per type.
// js/aesthetics-graph.js animates each node from its current position to the new type's (or, with several
// edge types on at once, their average) whenever the filter changes; the default px/py above (the one layout
// that used every edge at once) is the resting position with no type singled out.
console.log("computing one layout per edge type...");
const edgeTypesPresent = [...new Set(edges.map(e => e.type))];
const layouts = {};
for (const t of edgeTypesPresent) {
  const subset = edges.filter(e => e.type === t);
  const laidT = layout(nodeList, subset, 160);
  layouts[t] = laidT.map(l => [l.x, l.y]);
}

const byType = {};
for (const n of nodeList) byType[n.type] = (byType[n.type] || 0) + 1;
const byEdgeType = {};
for (const e of edges) byEdgeType[e.type] = (byEdgeType[e.type] || 0) + 1;

const out = { v: 2, built: new Date().toISOString().slice(0, 10),
  source: "data/looks.js, data/artists/meta.json + context.json (Wikidata, CC0), data/aesthetics/kb/*.json, and a short hand-curated subculture/design-movement list (see each node/edge's own `source`).",
  counts: { nodes: nodeList.length, edges: edges.length, byType, byEdgeType },
  nodes: nodeList, edges, layouts };
fs.writeFileSync(path.join(ROOT, "data/aesthetics/graph.json"), JSON.stringify(out));
console.log("wrote data/aesthetics/graph.json:", JSON.stringify(out.counts, null, 2));
