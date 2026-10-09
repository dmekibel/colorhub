"use strict";
// Shared "What links here" (PAGES-AUDIT.md plan item 1, David 2026-10-09): "This app needs respect for
// information: like Wikipedia, but on steroids." Connections OUT already exist (js/graph.js connections(),
// connSection() in js/explore.js) for anything the graph scans [[links]] out of. Connections IN never existed
// anywhere except the one ad hoc "appears in" list on a color page. This file is the one generic component:
// for any node/subject, the pages that already reference it, grouped by kind, collapsed to a summary line
// with counts, expandable, every item one tap -- called near the end of any page kind's builder.
//
// Two sources, merged and deduped by id (never invents a connection, only surfaces ones already on file):
//  1. graph().back -- the color web's own real back-index: written [[links]], palette-color references and
//     "kin" pairs, already scanned once when graph() builds, for any node actually IN graph().nodes (colors,
//     wiki pages, curated/stub paintings, stories, and gems/botany once their own files register -- js/gems.js
//     gmBuildNodes, js/botany.js btBuildNodes). Free: no new scanning, just reading the map the other direction.
//  2. lhMentionScan(title) -- a plain-text mention scan over that same already-loaded content, for the
//     subject's own title as a whole word. Catches a name mentioned in running prose with no [[link]] syntax
//     around it (a painter, a movement, a decade, a gem, a plant -- anything with a title, including kinds
//     that aren't graph nodes at all, like painter/movement/decade/country, which otherwise could never show
//     a single incoming connection). Cached per title; capped, so a common word can't make this slow.
// Neither source touches js/graph.js's own build/cache (G) or js/trail.js's xBack/show logic -- purely additive.

const LH_KIND_LABEL = { color: "Colors", painting: "Paintings", page: "Wiki pages", story: "Stories", gems: "Gems", botany: "Botany" };
const LH_CAP_PER_KIND = 10, LH_SCAN_CAP = 24;

// plain-text version of a node's own content, for the mention scanner (never its [[link]] markup)
function lhNodeText(n) {
  if (n.kind === "color" && n.wiki) return (n.wiki.facets || []).map(f => f.text).join(" ");
  if ((n.kind === "page" || n.kind === "gems" || n.kind === "botany") && !n.stub) {
    const secBody = (n.sections || []).flatMap(s => Array.isArray(s.text) ? s.text : [s.text]);
    return [n.dek || "", ...(n.body || []), ...secBody].join(" ");
  }
  if (n.kind === "painting" && !n.stub) return n.note || "";
  if (n.kind === "story") return n.slides.map(s => (s.text || "") + " " + (s.v && s.v.explain || "")).join(" ");
  return "";
}
const lhEscRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
let LH_MENTION_CACHE = new Map();
function lhMentionScan(title, excludeId) {
  if (!title || title.trim().length < 3) return [];
  const key = title.trim().toLowerCase();
  if (LH_MENTION_CACHE.has(key)) return LH_MENTION_CACHE.get(key).filter(n => n.id !== excludeId);
  let re; try { re = new RegExp("\\b" + lhEscRe(title.trim()) + "\\b", "i"); } catch (e) { return []; }
  const hits = [];
  try {
    for (const n of graph().nodes.values()) {
      if (hits.length >= LH_SCAN_CAP) break;
      if (n.id === excludeId) continue;
      const t = lhNodeText(n);
      if (t && re.test(plainText(t))) hits.push(n);
    }
  } catch (e) {}
  LH_MENTION_CACHE.set(key, hits);
  return hits;
}

// the merged, deduped list for one subject: { id, title } (id needn't be a real graph id -- painter/movement/
// decade/country/source/brand/photographer/fashion/film/look pass their own page id and title; a graph hit
// only ever comes from the mention scan for those, since they're never in graph().back)
function linksHere(id, title) {
  const out = [], seen = new Set([id]);
  try {
    const g = graph();
    (g.back.get(id) || []).forEach(e => {
      if (seen.has(e.to.id)) return; seen.add(e.to.id);
      out.push({ id: e.to.id, title: e.to.title, kind: e.to.kind, rel: e.why || (e.rel === "kin" ? "Related" : e.rel) || "Links here", color: nodeColor(e.to) });
    });
  } catch (e) {}
  lhMentionScan(title, id).forEach(n => {
    if (seen.has(n.id)) return; seen.add(n.id);
    out.push({ id: n.id, title: n.title, kind: n.kind, rel: "Mentions it", color: nodeColor(n) });
  });
  return out;
}

// the ready HTML for a page's "What links here" section. subject: { id, title } -- id is the graph node id
// when there is one (so graph().back resolves), otherwise any stable string unique to this page (the mention
// scan alone still works; there's just nothing for graph().back to find). Call wireLinks(el) on the page (most
// builders already do, via wireArticle) so the chips here open like any other link in the app.
function linksHereHTML(subject) {
  if (!subject || subject.id == null || !subject.title) return "";
  let items = [];
  try { items = linksHere(String(subject.id), String(subject.title)); } catch (e) {}
  if (!items.length) return `<section class="conns lh-empty"><h3>What links here</h3><p class="fine">No pages link here yet.</p></section>`;
  const groups = new Map();
  items.forEach(it => { const k = LH_KIND_LABEL[it.kind] || "Pages"; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(it); });
  const inner = [...groups.entries()].map(([k, list]) => `<div class="cg"><p class="eyebrow">${esc(k)}</p><div class="chips-wrap">${list.slice(0, LH_CAP_PER_KIND).map(it =>
    `<button class="pchip" data-node="${esc(it.id)}">${it.color ? `<i style="--c:${esc(it.color)}"></i>` : ""}${esc(it.title)}<em>${esc(it.rel)}</em></button>`).join("")}</div></div>`).join("");
  return secHTML("lh-" + hash(String(subject.id)), `What links here · ${items.length}`, `<div class="conns">${inner}</div>`, false);
}
