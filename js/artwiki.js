"use strict";
// The art wiki (ROADMAP §21, David 2026-10-08: "art-wiki features like art movements and artist profiles ...
// not just a single palette ... as much info as possible"). Painters, movements, decades, countries, an
// "Art history by color" index, painter vs painter, and an Analysis section on every painting page.
//
// Addresses (router.js): #/painter/<slug>  #/movement/<slug>  #/decade/<1880>  #/country/<slug>
//   #/arthistory  #/painters  #/painters/<a>/<b>
// Data (all lazy; nothing here loads until one of these screens opens):
//   data/artists/meta.json         Wikidata (CC0): dates, nationality, movement, teachers, portrait; all 837 painters  (tools/wikidata_artists.py)
//   data/artists/stats.json        contrast / vivid / color count per painter, for percentiles               (tools/artwiki_build.py)
//   data/artists/p/<slug>.json     gallery indices of the painter's works, museum-baselined signature colors, within-painting roles
//   data/artists/groups-extra.json key painters, hue profile, palette over time, signature colors per decade / country / movement
//   data/artists/ids.txt           painting ids in gallery order (only to open "nearest painting in another century")
//   data/artists/context.json      per painting: lightness, chroma, warmth, country, movement; per group: its most
//                                  typical painting (tools/artwiki_context.py). Highlight cards and "In context".
//   data/analysis/                 the analysis engine's own files (tools/analyze.py, research/ANALYSIS.md)
// Honesty, said once and meant everywhere: every number is "as photographed" (aged varnish, museum cameras), carries
// its n, and a small sample says so or stays quiet. The archive reads brown, so a painter's signature is measured
// against the SAME museums' other paintings, and a second lens looks at roles inside one canvas (focal, accent,
// hidden, glue), which varnish cannot fake (design/GENIUS-PANEL-1.md §2.4).
//
// Hooks other lanes can fill (all optional; nothing renders if they're absent):
//   bioSlot(slug)            -> Promise<html>, reads data/artists/bios/<slug>.json (the article engine writes these)
//   prQuick(o)               -> "Learn this painting" (js/practice.js, the quick-deck sheet); the button appears when it exists
//   knowState(c)             -> the "You and this painter" line (js/learner.js)
//   whosePalette(slug)       -> the Train quiz, opened on this painter (L10)

const AW_DIR = "data/artists/", AW_AN = "data/analysis/";
const AW = { meta: null, stats: null, ge: null, grp: null, idx: null, ready: false, loading: null, P: new Map(), A: new Map(), SH: new Map(), pl: null, list: null, nh: null, ids: null, ctx: null, ctxP: null, base: null, port: null };
const awURL = p => p + (typeof DATA_VER !== "undefined" && DATA_VER ? "?v=" + DATA_VER : "");
const awGet = (p, kind = "json") => fetch(awURL(p)).then(r => { if (!r.ok) throw new Error(p + " " + r.status); return r[kind](); });
const awPad = n => String(n).padStart(3, "0");
const AW_BANDS = ["rose", "red", "orange", "yellow", "olive", "green", "teal", "sky", "blue", "indigo", "violet", "magenta"];
const AW_BAND_HEX = AW_BANDS.map((_, k) => lchHex(66, 46, k * 30 + 15));
const AW_KEYWORD = { high: "High-key (mostly light)", mid: "Mid-key", low: "Low-key (mostly dark)" };
const awCanon = n => String(n).toLowerCase().replace(/[^a-z]/g, "").replace(/grey/g, "gray").replace(/bister/g, "bistre");
const awDec = d => d + "s";
const awY = y => y < 0 ? -y + " BCE" : String(y);
const awPct = v => Math.round(v * 100);
const awPlural = (n, w) => n + " " + w + (n === 1 ? "" : "s");

// ---------- loading ----------
function awLoad() {
  if (AW.ready) return Promise.resolve(AW);
  return AW.loading || (AW.loading = Promise.all([awGet(AW_DIR + "meta.json"), awGet(AW_DIR + "stats.json"), awGet(AW_DIR + "groups-extra.json"), awGet(AW_AN + "groups.json"),
    typeof loadCoreNames === "function" ? loadCoreNames() : Promise.resolve(), loadGallery(),
    awGet(AW_DIR + "portraits.json").catch(() => null)]).then(([meta, stats, ge, grp, , , port]) => {
    AW.meta = meta; AW.stats = stats; AW.ge = ge; AW.grp = grp; AW.port = (port && port.a) || {};
    AW.list = Object.entries(meta.a).map(([slug, m]) => ({ slug, ...m })).sort((a, b) => b.k - a.k || a.n.localeCompare(b.n));
    AW.nh = new Map((CORE_NAMES || []).map(e => [e.n.toLowerCase(), e.h]));
    const col = k => AW.list.map(m => m[k]).filter(v => v != null).sort((a, b) => a - b);
    AW.pl = { L: col("L"), C: col("C"), W: col("W"), ct: Object.values(stats).map(s => s[0]).sort((a, b) => a - b), vv: Object.values(stats).map(s => s[1]).sort((a, b) => a - b) };
    AW.ready = true; AW.loading = null;
    return AW;
  }).catch(e => { AW.loading = null; throw e; }));
}
function awPainterLoad(slug) {
  if (AW.P.has(slug)) return Promise.resolve(AW.P.get(slug));
  return Promise.all([awGet(AW_AN + "artists/" + slug + ".json"), awGet(AW_DIR + "p/" + slug + ".json")]).then(([A, P]) => { AW.P.set(slug, { A, P }); return AW.P.get(slug); });
}
function awShard(i) {
  const k = Math.floor(i / 100);
  if (AW.SH.has(k)) return Promise.resolve(AW.SH.get(k));
  return awGet(AW_AN + "paintings-" + awPad(k) + ".json").then(rows => { AW.SH.set(k, rows); return rows; });
}
function awIdMap() {
  if (AW.ids) return Promise.resolve(AW.ids);
  return awGet(AW_DIR + "ids.txt", "text").then(t => { AW.ids = new Map(t.split("\n").map((id, i) => [id, i])); return AW.ids; });
}
// where every painting sits (tools/artwiki_context.py): one byte each for lightness, chroma, warm share (%),
// country and movement, plus each group's most typical painting
function awCtxLoad() {
  if (AW.ctx) return Promise.resolve(AW.ctx);
  const u = s => Uint8Array.from(atob(s), ch => ch.charCodeAt(0));
  return AW.ctxP || (AW.ctxP = awGet(AW_DIR + "context.json").then(c => (AW.ctx = { ...c, L: u(c.L), C: u(c.C), W: u(c.W), CO: u(c.CO), MV: u(c.MV) }))
    .catch(e => { AW.ctxP = null; throw e; }));
}
// gallery indices of a decade, movement or country, the same membership the group pages count
function awMembers(kind, key) {
  const out = [];
  if (kind === "decade") { for (let i = 0; i < GAL.n; i++) { const y = GAL.year[i]; if (y !== GL_UNDATED && Math.floor(y / 10) * 10 === +key) out.push(i); } return out; }
  const c = AW.ctx; if (!c) return out;
  const arr = kind === "movement" ? c.MV : c.CO, k = (kind === "movement" ? c.mv : c.co).indexOf(String(key)) + 1;
  if (k) for (let i = 0; i < arr.length; i++) if (arr[i] === k) out.push(i);
  return out;
}
// the archive's pooled color cells (js/browse.js), the baseline a set's distinctive colors are lifted against
const awGalF = () => ({ G: GAL, N: GAL.n });
function awBase() {
  if (!AW.base && typeof xbCellShares === "function") AW.base = xbCellShares(awGalF(), Array.from({ length: GAL.n }, (_, i) => i));
  return AW.base;
}
// Signature chips for a highlight card: the museum-baselined signature first (near-blacks out: varnish and cameras
// give those to everyone), then, when that's thin, the colors this set holds more of than the whole archive.
function awSigChips(sig, members) {
  const out = [], ok = h => lab(h)[0] >= 24 && out.every(x => de2000(x.h, h) > 7);
  (sig || []).forEach(([c, lift]) => { const [nm, hx] = awCol(c); if (out.length < 5 && lift >= 1.15 && ok(hx)) out.push({ h: hx, n: nm, lift, mus: true }); });
  if (out.length < 3 && members && members.length >= 10 && typeof xbSetColors === "function" && awBase()) {
    xbSetColors(awGalF(), members, 14, awBase()).forEach(r => { if (out.length < 5 && ok(r.h)) out.push({ h: r.h, n: nameOf(r.h).text, lift: Math.min(r.lift, 9.9), mus: false }); });
  }
  return out;
}
// The highlight card (design/ARCHIVE-PAGES.md #1): one real painting, the most typical; one measured sentence;
// the signature colors, each one tap from its page. It replaces the old hero of area colors (aged-varnish browns).
function awHighlight(gi, line, chips) {
  const ar = gi >= 0 ? glAR(gi) : 1, dom = gi >= 0 ? glPal(gi).reduce((a, b) => b.share > a.share ? b : a).h : "#222";
  const src = !chips.length ? "" : chips.every(c => c.mus) ? "against the same museums" : chips.some(c => c.mus) ? "against the same museums, then the archive" : "against the whole archive";
  return `<section class="aw-hl">
    ${gi >= 0 ? `<button class="aw-hl-img" data-gi="${gi}" data-awhl="${gi}" style="--c:${dom};aspect-ratio:${(1 / ar).toFixed(4)}" aria-label="Open the most typical painting"><img alt=""></button>
    <p class="aw-hl-cap"><em>Most typical</em><span data-awhlt></span></p>` : ""}
    ${line ? `<p class="aw-hl-line">${line}</p>` : ""}
    ${chips.length ? `<div class="aw-hl-h"><b>Signature colors</b><span>${src}</span></div>
    <div class="aw-hl-chips">${chips.map(c => `<button class="aw-hl-chip" data-swatch="${c.h}"><i style="--c:${c.h}"></i><b>${esc(c.n)}</b><em>×${c.lift.toFixed(1)}</em></button>`).join("")}</div>` : ""}
  </section>`;
}
function awFillHighlight(el) {
  const b = el.querySelector("[data-awhl]"); if (!b) return;
  const i = +b.dataset.awhl;
  glDetail(i).then(d => {
    if (!b.isConnected) return;
    const im = b.querySelector("img"); im.src = glSmall(d) ? d.img : glBig(d.img); im.alt = d.t;
    const t = el.querySelector("[data-awhlt]"), y = glYear(i);
    if (t) t.textContent = d.t + (y ? ", " + y : "");
    b.setAttribute("aria-label", "Open " + d.t);
  }).catch(() => {});
}
// "Lighter than 88% of the 60 decades here": the most extreme of a few measures, only when it's in the top or
// bottom quarter (a middling percentile is not a finding)
function awExtreme(cands) {
  const best = cands.filter(c => c && Math.abs(c.p - .5) >= .25).sort((a, b) => Math.abs(b.p - .5) - Math.abs(a.p - .5))[0];
  return best ? best.text : "";
}
function awLineJoin(a, b, tail) {
  const parts = [a, b].filter(Boolean);
  if (!parts.length) return tail ? tail.charAt(0).toUpperCase() + tail.slice(1) + "." : "";
  const s = parts.join("; ");
  return esc(s.charAt(0).toUpperCase() + s.slice(1) + (tail ? ". " + tail.charAt(0).toUpperCase() + tail.slice(1) : "") + ".");
}
const awReach = c => c ? `reaches for ${c.n.toLowerCase()} ${c.lift.toFixed(1)}× more than ${c.mus ? "the same museums" : "the whole archive"}` : "";

// run `fn(...args)` once the data is here. While it loads, a quiet placeholder carries the address; the real
// screen then replaces that history entry (same trick as whenWiki in js/loader.js).
function awWait(fn, args, need) {
  const tok = (waitScreen(), SHOW_N);
  Promise.all([awLoad(), need && need()]).then(() => {
    if (SHOW_N !== tok) return;
    ROUTE_REPLACE = true;
    fn(...args);
  }).catch(() => { toast("This page didn't load"); });
  return true;
}
const awHex = name => (AW.nh && AW.nh.get(String(name).toLowerCase())) || "#808080";
const awCol = c => AW.ge.colors[c] || ["?", "#808080"];

// ---------- small building blocks ----------
const awSw = (hex, name, cls = "") => `<button class="aw-sw ${cls}" data-swatch="${hex}" style="--c:${hex}" data-ink="${ink(hex)}" aria-label="${esc(name || hex)}"></button>`;
const awChipName = (name, hex, extra = "") => `<button class="aw-chip" data-swatch="${hex}"><i style="--c:${hex}"></i><b>${esc(name)}</b>${extra ? `<span>${extra}</span>` : ""}</button>`;
const awStrip = (hexes, h = 22) => `<span class="aw-strip" style="height:${h}px">${hexes.map(x => `<i style="--c:${x}" data-swatch="${x}"></i>`).join("")}</span>`;
const awPainterLink = (slug, label) => `<button class="aw-link" data-awpainter="${esc(slug)}">${esc(label)}</button>`;
const awHasPainter = slug => !!(AW.meta && AW.meta.a[slug]);
function awPctWords(key, v, lo, hi) {
  const arr = AW.pl[key], below = arr.filter(x => x < v).length / arr.length;
  return { p: below, text: below >= .5 ? `${hi} than ${awPct(below)}% of the ${arr.length} painters here` : `${lo} than ${awPct(1 - below)}% of the ${arr.length} painters here` };
}
function awBar(p, label, text, extra = "") {
  return `<div class="aw-pbar"><div class="aw-pb-h"><b>${esc(label)}</b><span>${text}</span></div><div class="aw-track"><i style="left:${(p * 100).toFixed(1)}%"></i>${extra}</div></div>`;
}
function awSpark(points, w = 300, h = 56) {
  // points: [[x, y, n]] -> svg
  if (points.length < 2) return "";
  const xs = points.map(p => p[0]), ys = points.map(p => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys, 0) , y1 = Math.max(...ys, 100);
  const sx = x => 8 + (x - x0) / ((x1 - x0) || 1) * (w - 16), sy = y => h - 8 - (y - 10) / (90 - 10) * (h - 16);
  const path = points.map((p, k) => (k ? "L" : "M") + sx(p[0]).toFixed(1) + " " + sy(p[1]).toFixed(1)).join("");
  return `<svg class="aw-spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><path d="${path}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>${points.map(p => `<circle cx="${sx(p[0]).toFixed(1)}" cy="${sy(p[1]).toFixed(1)}" r="${p[2] < 5 ? 2 : 3.2}" fill="${p[2] < 5 ? "none" : "currentColor"}" stroke="currentColor" stroke-width="1.2" vector-effect="non-scaling-stroke"/>`).join("")}</svg>`;
}
function awHueBars(hh, base) {
  // 12 bins: bars colored by hue; a hairline for the archive's profile
  const mx = Math.max(...hh, ...(base || []), .001);
  return `<div class="aw-hue" role="img" aria-label="Hue profile">${hh.map((v, k) => `<span style="--c:${AW_BAND_HEX[k]}"><i style="height:${Math.max(2, v / mx * 100).toFixed(0)}%"></i>${base ? `<u style="bottom:${(base[k] / mx * 100).toFixed(0)}%"></u>` : ""}</span>`).join("")}</div>`;
}
function awHueRing(hh) {
  const mx = Math.max(...hh, .001), R = 52, r0 = 22;
  const seg = hh.map((v, k) => {
    const a0 = (k * 30 - 90) * Math.PI / 180, a1 = ((k + 1) * 30 - 90) * Math.PI / 180, rr = r0 + (R - r0) * Math.max(.06, v / mx);
    const p = (r, a) => (60 + r * Math.cos(a)).toFixed(1) + " " + (60 + r * Math.sin(a)).toFixed(1);
    return `<path d="M${p(r0, a0)}L${p(rr, a0)}A${rr} ${rr} 0 0 1 ${p(rr, a1)}L${p(r0, a1)}A${r0} ${r0} 0 0 0 ${p(r0, a0)}Z" fill="${AW_BAND_HEX[k]}" opacity="${v / mx < .06 ? .35 : 1}"/>`;
  }).join("");
  return `<svg class="aw-ring" viewBox="0 0 120 120" role="img" aria-label="Hue wheel histogram">${seg}</svg>`;
}
const awBand = hh => AW_BANDS[hh.indexOf(Math.max(...hh))];

// ---------- the bio slot (the article engine writes data/artists/bios/<slug>.json) ----------
function bioSlot(slug) {
  return awGet(AW_DIR + "bios/" + slug + ".json").then(b => {
    if (!b) return "";
    const paras = b.paras || (b.text ? String(b.text).split(/\n\n+/) : []);
    if (!paras.length && !b.lead) return "";
    return `<section class="aw-bio">${b.lead ? `<p class="aw-lead">${esc(b.lead)}</p>` : ""}${paras.map(t => `<p>${esc(t)}</p>`).join("")}${(b.sources || []).length ? `<p class="fine">${b.sources.map(esc).join(" · ")}</p>` : ""}</section>`;
  }).catch(() => "");
}

// Findings gate (design/IDEAS-10X/explore-art.md): the raw findings in data/analysis include trivia ("Only 0% of this
// canvas is truly vivid" on most paintings), self-pairs ("Ink and Ink") and near-black "signatures" that are
// varnish, not style. Show only valid, surprising ones, at most `max`, never a number without its n.
const AW_BORING = [/^Only \d?\d% of this canvas is truly vivid/, /^Keeps \d+ distinct/, /^Spans the /, /^Uses /, /^Pairs /];
function awSelfPair(f) { const m = f.match(/^([A-Za-z][A-Za-z -]*?) and ([A-Za-z][A-Za-z -]*?) sit /); return !!m && awCanon(m[1]) === awCanon(m[2]); }
function awGateFinds(list, max = 3) {
  const seen = new Set(), out = [];
  (list || []).forEach(f => {
    if (AW_BORING.some(r => r.test(f)) || awSelfPair(f) || /\b0%/.test(f.replace(/\d0%/g, "")) || seen.has(f)) return;
    seen.add(f); out.push(f);
  });
  // percentile claims and shifts read as the most surprising; keep their order, cut the rest
  return out.slice(0, max);
}
const awNearBlack = hex => lab(hex)[0] < 24;

// painters in search (Explore's search sheet calls this): rows of painter pages; loads the list quietly the first time
function awSearchHTML(s, again) {
  if (!AW.ready) { awLoad().then(() => again && again()).catch(() => {}); return ""; }
  const norm = t => routeSlug(t).replace(/-/g, ""), q = norm(s);
  if (q.length < 2) return "";
  const hits = AW.list.filter(m => norm(m.n).includes(q)).slice(0, 6);
  return hits.length ? `<div class="sec-head"><b>Painters</b><span>${hits.length}${hits.length === 6 ? "+" : ""}</span></div>${hits.map(m => `<button class="aw-res" data-awpainter="${m.slug}"><b>${esc(m.n)}</b><span>${[m.b != null ? awY(m.b) + "–" + (m.d != null ? awY(m.d) : "") : m.y0 ? m.y0 + "–" + m.y1 : "", m.co].filter(Boolean).join(" · ")}</span><em>${m.k}</em></button>`).join("")}` : "";
}

// ======================================================================
// Portrait hero, famous works, and the life's-work browser (David, 2026-10-09: "the first thing you should see
// is their portrait, large... the second thing should be their most famous paintings... then, looking through
// their paintings, I should be able to choose different views"). Portraits and the famous-works ranking are
// resolved and cached at build time (data/artists/portraits.json, tools/artwiki_portraits.py); sort/filter/views
// over the life's work run live, client-side, from data the gallery already measured (js/gallery.js's GAL:
// lightness, chroma, museum, mean Lab per painting) -- never an invented field like canvas size or genre.
// ======================================================================
function awPainterHexes(A, P) {
  return [...new Set([...(A.clusters || []).flatMap(c => c.colors.slice(0, 3)), ...(P.sig || []).map(r => awCol(r[0])[0])])].map(awHex).filter(h => h !== "#808080");
}
function awPortraitHero(slug, A, P, hlChips) {
  const rec = (AW.port && AW.port[slug]) || {}, pt = rec.portrait || { src: "none" };
  const field = (hlChips[0] && hlChips[0].h) || awHex((A.clusters && A.clusters[0] && A.clusters[0].colors[0]) || "");
  if ((pt.src === "self" || pt.src === "other") && pt.gi != null) {
    return `<figure class="aw-pt-hero" data-pthero="${pt.gi}" style="--c:${field}">
      <button class="aw-pt-open" data-gi="${pt.gi}" aria-label="Open the painting"><img alt="" data-ptimg></button>
      <figcaption>${pt.src === "self" ? esc(pt.caption || "Self-portrait") + (pt.year ? ", " + awY(pt.year) : "") : `Portrait by ${esc(pt.by || "another painter")}`}</figcaption>
    </figure>`;
  }
  if (pt.src === "wikidata" && pt.url) {
    return `<figure class="aw-pt-hero" style="--c:${field}">
      <img class="aw-pt-open" src="${esc(pt.url)}" alt="" loading="lazy" crossorigin="anonymous" onerror="this.closest('figure').remove()">
      <figcaption>${esc(pt.caption || "Portrait")}<span> · Wikimedia Commons</span></figcaption>
    </figure>`;
  }
  // No recorded portrait (David, 2026-10-09): "put one of his paintings at the top instead — his most famous
  // painting". The same ranking awFamousRail reads (data/artists/portraits.json's own `famous`, built from
  // Wikidata-recorded fame where it exists, else closeness to his signature colors); if even that's empty,
  // his most-reached painting (P.typical, the one already used as the highlight card below) stands in instead.
  // awFamousRail skips this same gi from its own rail, so it isn't shown twice.
  const famousGi = (rec.famous || []).find(gi => gi != null && gi >= 0);
  const heroGi = famousGi != null ? famousGi : (P.typical != null && P.typical >= 0 ? P.typical : null);
  if (heroGi != null) {
    return `<figure class="aw-pt-hero" data-pthero="${heroGi}" style="--c:${field}">
      <button class="aw-pt-open" data-gi="${heroGi}" aria-label="Open the painting"><img alt="" data-ptimg></button>
      <figcaption data-ptnoport="${esc(A.name)}">Loading…</figcaption>
    </figure>`;
  }
  // the signature-color field: clusters, else sig, else the barcode's own most-used colors (always present,
  // even for a painter too small for clusters or a signature -- the barcode skips nothing)
  let barNames = (A.clusters || []).flatMap(c => c.colors);
  if (!barNames.length) barNames = (P.sig || []).map(r => awCol(r[0])[0]);
  if (!barNames.length) {
    const count = new Map();
    (A.barcode || []).forEach(b => (b[2] || []).forEach(nm => count.set(nm, (count.get(nm) || 0) + 1)));
    barNames = [...count.entries()].sort((a, b) => b[1] - a[1]).map(x => x[0]);
  }
  const bars = [...new Set(barNames.map(awCanon))].map(k => barNames.find(s => awCanon(s) === k)).map(awHex).slice(0, 6);
  return `<figure class="aw-pt-hero aw-pt-field" style="--c:${field}">
    <div class="aw-pt-bars">${bars.map(h => `<i style="--c:${h}"></i>`).join("")}</div>
    <figcaption>No portrait recorded<span> · his signature colors</span></figcaption>
  </figure>`;
}
function awFillPortrait(el) {
  const b = el.querySelector("[data-pthero]"); if (!b) return;
  const gi = +b.dataset.pthero, im = b.querySelector("[data-ptimg]"); if (!im) return;
  glDetail(gi).then(d => {
    if (!b.isConnected) return;
    im.src = glSmall(d) ? d.img : glBig(d.img); im.alt = d.t; b.setAttribute("aria-label", "Open " + d.t);
    // this hero is standing in for a missing portrait (awPortraitHero): caption it as what it actually is
    const cap = b.querySelector("[data-ptnoport]");
    if (cap) { const name = cap.dataset.ptnoport, yr = glYear(gi); cap.textContent = `${d.t}${yr ? ", " + yr : ""} — no portrait of ${name} in the archive`; }
  }).catch(() => {});
}
function awFamousRail(slug, n) {
  const rec = (AW.port && AW.port[slug]) || {}, pt = rec.portrait || { src: "none" };
  const hasPortrait = ((pt.src === "self" || pt.src === "other") && pt.gi != null) || (pt.src === "wikidata" && !!pt.url);
  let list = (rec.famous || []).filter(gi => gi != null && gi >= 0);
  // its first entry is already standing in for the portrait hero above (awPortraitHero) when there isn't one
  if (!hasPortrait && list.length) list = list.slice(1);
  if (list.length < 2) return "";
  const note = rec.famousBy === "wikidata" ? "most widely recorded" : "closest to his signature colors";
  return `<div class="sec-head"><b>Most famous</b><span>${esc(note)}</span></div>
    <div class="gl-rail" data-awfamous>${list.map(i => glPinHTML(i)).join("")}</div>`;
}
// ---- the life's work: sort, filter, three views ----
const AW_WORKS_SORT = [["year", "Year"], ["L", "Lightness"], ["C", "Vivid"], ["mus", "Museum"], ["fam", "Family"]];
function awWorksRows(P, A) {
  const clusters = A.clusters || [];
  const cent = clusters.length > 1 ? clusters.map(c => { const pts = c.colors.map(awHex).map(h => lab(h)), n = pts.length || 1;
    return pts.reduce((s, p) => [s[0] + p[0] / n, s[1] + p[1] / n, s[2] + p[2] / n], [0, 0, 0]); }) : null;
  return (P.ix || []).filter(gi => gi >= 0 && gi < GAL.n).map(gi => {
    const y = GAL.year[gi], src = GAL.src[GAL.mus[gi]];
    let fam = -1;
    if (cent) {
      const lv = [GAL.mean[gi * 3], GAL.mean[gi * 3 + 1], GAL.mean[gi * 3 + 2]];
      let bd = Infinity;
      cent.forEach((c, k) => { const d = Math.hypot(lv[0] - c[0], lv[1] - c[1], lv[2] - c[2]); if (d < bd) { bd = d; fam = k; } });
    }
    return { gi, y: y === GL_UNDATED ? null : y, mus: src ? src.short : "", L: GAL.L[gi], C: GAL.C[gi], fam };
  });
}
// how close a painting comes to one target color: the smallest Lab distance among its six measured swatches
// (same per-painting data the gallery search uses), always shown as an explicit number, never a silent "closest anyway"
function awColorNear(gi, hex) {
  const t = lab(hex); let best = Infinity;
  for (let j = 0; j < 6; j++) { const k = gi * 6 + j; if (!GAL.sh[k]) continue;
    const d = Math.hypot(GAL.lab[k * 3] - t[0], GAL.lab[k * 3 + 1] - t[1], GAL.lab[k * 3 + 2] - t[2]);
    if (d < best) best = d;
  }
  return best;
}
function awWorksSection(slug, m, A, P) {
  const rows = awWorksRows(P, A);
  if (rows.length < 2) return "";
  const decades = [...new Set(rows.filter(r => r.y != null).map(r => Math.floor(r.y / 10) * 10))].sort((a, b) => a - b);
  const museums = [...new Set(rows.map(r => r.mus).filter(Boolean))].sort();
  const famOK = rows.some(r => r.fam >= 0);
  const allNames = [...(A.clusters || []).flatMap(c => c.colors), ...(P.sig || []).map(r => awCol(r[0])[0])];
  const names = [...new Set(allNames.map(awCanon))].map(k => allNames.find(s => awCanon(s) === k)).slice(0, 8);
  return `<div class="sec-head" id="aw-works"><b>Life's work</b><span data-wkcount>${rows.length} paintings</span></div>
    <p class="aw-sub">Every painting here, his. Sort, filter, or look at them on the map.</p>
    <div class="aw-wk-views"><div class="seg" role="tablist" aria-label="View"><button class="on" data-wkview="grid">Grid</button><button data-wkview="timeline">Timeline</button></div>
      ${typeof mapSelect === "function" ? `<button class="aw-wk-map" data-wkmap>${GL_ICON_MAP}<span>Color map</span></button>` : ""}</div>
    <div class="aw-wk-sort">${AW_WORKS_SORT.filter(([k]) => (k !== "mus" || museums.length > 1) && (k !== "fam" || famOK)).map(([k, label], i) => `<button class="aw-chipbtn${i === 0 ? " on" : ""}" data-wksort="${k}">${esc(label)}</button>`).join("")}</div>
    ${(decades.length > 1 || museums.length > 1 || names.length) ? `<details class="aw-more" data-wkfilter><summary>Filter</summary>
      ${decades.length > 1 ? `<div class="aw-wk-filt"><label>From <b data-wkd0>${decades[0]}</b> to <b data-wkd1>${decades[decades.length - 1] + 9}</b></label>
        <div class="aw-wk-range"><input type="range" data-wkr="0" min="${decades[0]}" max="${decades[decades.length - 1]}" step="10" value="${decades[0]}"><input type="range" data-wkr="1" min="${decades[0]}" max="${decades[decades.length - 1]}" step="10" value="${decades[decades.length - 1]}"></div></div>` : ""}
      ${museums.length > 1 ? `<p class="aw-lbl">Museum</p><div class="aw-chips">${museums.map(ms => `<button class="aw-chipbtn" data-wkmus="${esc(ms)}">${esc(ms)}</button>`).join("")}</div>` : ""}
      ${names.length ? `<p class="aw-lbl">A lot of this color</p><div class="aw-chips">${names.map(nm => `<button class="aw-wk-csw" data-wkcolor="${awHex(nm)}" aria-label="Filter by ${esc(nm)}"><i style="--c:${awHex(nm)}"></i><span>${esc(nm)}</span></button>`).join("")}<button class="aw-chipbtn" data-wkcolorclear hidden>Clear</button></div><p class="fine" data-wkcolornote hidden></p>` : ""}
    </details>` : ""}
    <div class="aw-wk-mount gl-grid" data-wkmount></div>`;
}
function awWorksWire(el, slug, m, A, P) {
  const mount = el.querySelector("[data-wkmount]");
  if (!mount) return;
  const rows = awWorksRows(P, A);
  if (rows.length < 2) return;
  const byGi = new Map(rows.map(r => [r.gi, r]));
  const decades = [...new Set(rows.filter(r => r.y != null).map(r => Math.floor(r.y / 10) * 10))].sort((a, b) => a - b);
  const st = { sort: "year", view: "grid", d0: decades[0], d1: decades.length ? decades[decades.length - 1] + 9 : null, mus: new Set(), colorHex: null, colorTol: 14 };
  let gridCtl = null;
  const filtered = () => rows.filter(r =>
    (r.y == null || st.d0 == null || (r.y >= st.d0 && r.y <= st.d1)) &&
    (!st.mus.size || st.mus.has(r.mus)) &&
    (!st.colorHex || awColorNear(r.gi, st.colorHex) <= st.colorTol));
  const sorted = list => {
    const copy = list.slice();
    if (st.sort === "year") copy.sort((a, b) => (a.y == null) - (b.y == null) || (a.y || 0) - (b.y || 0));
    else if (st.sort === "L") copy.sort((a, b) => a.L - b.L);
    else if (st.sort === "C") copy.sort((a, b) => b.C - a.C);
    else if (st.sort === "mus") copy.sort((a, b) => a.mus.localeCompare(b.mus));
    else if (st.sort === "fam") copy.sort((a, b) => a.fam - b.fam);
    return copy;
  };
  const badge = r => !r ? "" : st.sort === "year" ? (r.y != null ? awY(r.y) : "undated") : st.sort === "mus" ? r.mus : st.sort === "fam" ? (r.fam >= 0 ? "Palette " + (r.fam + 1) : "") : "";
  const draw = () => {
    if (gridCtl) { gridCtl.destroy(); gridCtl = null; }
    const list = sorted(filtered());
    const count = el.querySelector("[data-wkcount]");
    if (count) count.textContent = list.length === rows.length ? awPlural(rows.length, "painting") : `${list.length} of ${awPlural(rows.length, "painting")}`;
    const note = el.querySelector("[data-wkcolornote]");
    if (note) {
      if (st.colorHex) {
        note.hidden = false;
        note.innerHTML = list.length ? `${list.length} of ${rows.length} come close.${st.colorTol < 30 ? ` <button class="wl" data-wkloosen>Loosen</button>` : ""}`
          : `None this close. <button class="wl" data-wkloosen>Loosen</button> or <button class="wl" data-wkcolorclear2>clear</button>.`;
      } else note.hidden = true;
    }
    if (!list.length) { mount.innerHTML = `<p class="fine">Nothing matches every filter at once.</p>`; return; }
    if (st.view === "timeline") {
      let last, html = "";
      list.forEach(r => {
        const dec = r.y != null ? Math.floor(r.y / 10) * 10 : null;
        if (dec !== last) { html += `<div class="aw-tl-div">${dec != null ? awDec(dec) : "Undated"}</div>`; last = dec; }
        html += glPinHTML(r.gi, { badge: badge(r) });
      });
      mount.innerHTML = `<div class="gl-rail aw-wk-rail">${html}</div>`;
      glFill(mount);
    } else {
      mount.innerHTML = "";
      gridCtl = glGrid(mount, { list: list.map(r => r.gi), badge: gi => badge(byGi.get(gi)) });
    }
  };
  el.querySelectorAll("[data-wkr]").forEach(inp => inp.oninput = () => {
    const a = el.querySelector('[data-wkr="0"]'), b = el.querySelector('[data-wkr="1"]');
    if (+a.value > +b.value) { if (inp === a) b.value = a.value; else a.value = b.value; }
    st.d0 = +a.value; st.d1 = +b.value + 9;
    const l0 = el.querySelector("[data-wkd0]"), l1 = el.querySelector("[data-wkd1]");
    if (l0) l0.textContent = a.value; if (l1) l1.textContent = +b.value + 9;
    draw();
  });
  el.addEventListener("click", e => {
    const v = e.target.closest("[data-wkview]"); if (v) { el.querySelectorAll("[data-wkview]").forEach(b => b.classList.toggle("on", b === v)); st.view = v.dataset.wkview; buzz(5); return draw(); }
    const s = e.target.closest("[data-wksort]"); if (s) { el.querySelectorAll("[data-wksort]").forEach(b => b.classList.toggle("on", b === s)); st.sort = s.dataset.wksort; buzz(5); return draw(); }
    const ms = e.target.closest("[data-wkmus]"); if (ms) { const on = ms.classList.toggle("on"); if (on) st.mus.add(ms.dataset.wkmus); else st.mus.delete(ms.dataset.wkmus); return draw(); }
    const cw = e.target.closest("[data-wkcolor]"); if (cw) { st.colorHex = cw.dataset.wkcolor; st.colorTol = 14; el.querySelectorAll("[data-wkcolor]").forEach(b => b.classList.toggle("on", b === cw)); const cl = el.querySelector("[data-wkcolorclear]"); if (cl) cl.hidden = false; return draw(); }
    if (e.target.closest("[data-wkcolorclear], [data-wkcolorclear2]")) { st.colorHex = null; el.querySelectorAll("[data-wkcolor]").forEach(b => b.classList.remove("on")); const cl = el.querySelector("[data-wkcolorclear]"); if (cl) cl.hidden = true; return draw(); }
    if (e.target.closest("[data-wkloosen]")) { st.colorTol += 8; return draw(); }
    if (e.target.closest("[data-wkmap]")) return mapSelect({ title: A.name, colors: awPainterHexes(A, P), source: "painter", id: slug });
  });
  draw();
}

// ======================================================================
// Painter pages
// ======================================================================
function awPainter(slug, push = true) {
  if (!AW.ready || !AW.P.has(slug)) return awWait(awPainter, [slug, push], () => awPainterLoad(slug));
  const m = AW.meta.a[slug], { A, P } = AW.P.get(slug);
  if (!m) { toast("No data for this painter"); return xToOrigin(); }
  if (push) XSTACK.push("aw:painter:" + slug);
  const n = A.n, small = n < 10;
  const dates = m.b != null ? `${awY(m.b)}–${m.d != null ? awY(m.d) : ""}` : (m.y0 ? `works dated ${m.y0}–${m.y1}` : "");
  const mvs = (m.mv || []).map(x => AW.grp.byMovement[x] ? `<button class="aw-link" data-awgroup="movement|${esc(x)}">${esc(x)}</button>` : esc(x));
  const co = m.co && AW.grp.byCountry[m.co] ? `<button class="aw-link" data-awgroup="country|${esc(m.co)}">${esc(m.co)}</button>` : esc(m.co || (m.nat && m.nat[m.nat.length - 1]) || "");
  const dek = [dates, co, mvs.join(", ")].filter(Boolean).join(" · ");
  const sections = [];

  // palettes: clusters, each named after its most typical painting
  const clusters = A.clusters || [];
  const palettes = clusters.length ? `<div class="sec-head" id="aw-pal"><b>Palettes</b><span>${clusters.length === 1 ? "1 family" : clusters.length + " families"}, from ${n} paintings</span></div>
    <p class="aw-sub">${clusters.length > 1 ? "He doesn't have one palette. Paintings were grouped by how light, vivid and warm they are, and each group is named after its most typical painting." : "One palette family holds all his work here."}</p>
    ${clusters.map((c, k) => `<div class="aw-cl">
      <button class="aw-thumb" data-gi="${P.ctyp[k]}" ${P.ctyp[k] >= 0 ? "" : "disabled"} aria-label="Open the most typical painting"><img alt="" data-glimg="${P.ctyp[k]}"></button>
      <div class="aw-cl-b"><p class="aw-cl-t" data-gltitle="${P.ctyp[k]}">Palette ${k + 1}</p>
        <p class="aw-cl-s">${awPct(c.pct / 100)}% of his paintings here · ${c.size} of ${n}</p>
        ${awStrip(c.colors.map(awHex), 26)}<p class="aw-cl-n">${c.colors.map(esc).join(", ")}</p></div></div>`).join("")}` : "";

  const finds = awPainterFindings(A, P, n);   // findings, in words, always with n (now a drawer in Colors)
  // colors: signature (museum-baselined), within-painting roles, avoided, pairs and chords
  let colors = "";
  if (!small && P.sig) {
    const sig = P.sig.filter(r => !awNearBlack(awCol(r[0])[1])).map(([c, lift, own, sup]) => { const [nm, hx] = awCol(c); return `<button class="aw-sig" data-swatch="${hx}"><i style="--c:${hx}" data-ink="${ink(hx)}"></i><b>${esc(nm)}</b><span>×${lift.toFixed(1)}</span><em>in ${sup} of ${n} paintings · ${awPct(own)}% of the canvas on average</em></button>`; }).join("");
    const av = (P.av || []).map(([c, lift, own, sup]) => { const [nm, hx] = awCol(c); return awChipName(nm, hx, `×${lift.toFixed(1)}`); }).join("");
    const roleLbl = { foc: "the focal color", acc: "an accent", hid: "a hidden color", glu: "the glue tone" };
    const roles = Object.entries(P.roles || {}).map(([r, rows]) => rows.map(([c, k, pres, p, q]) => { const [nm, hx] = awCol(c); return `<button class="aw-role" data-swatch="${hx}"><i style="--c:${hx}"></i><span><b>${esc(nm)}</b> is ${roleLbl[r]} in ${k} of the ${pres} paintings that contain it <em>(the archive: ${awPct(q)}%)</em></span></button>`; }).join("")).join("");
    const dk = (P.dk || []).map(([c, k, p]) => { const [nm, hx] = awCol(c); return awChipName(nm, hx, awPct(p) + "%"); }).join("");
    const lt = (P.lt || []).map(([c, k, p]) => { const [nm, hx] = awCol(c); return awChipName(nm, hx, awPct(p) + "%"); }).join("");
    const ch = awChords(A.pairs || []);
    colors = `<div class="sec-head"><b>Colors</b><span>${n} paintings</span></div>
      <p class="aw-sub">The colors used more than in other paintings from the same museums, as photographed. Near-blacks are left out: varnish and cameras make them common to everyone.</p>
      <div class="aw-sigs">${sig || `<p class="fine">Nothing stands clearly above the same museums' baseline.</p>`}</div>
      ${finds && !small ? `<details class="aw-more"><summary>Findings</summary>${finds}</details>` : ""}
      <details class="aw-more" data-awptcd hidden><summary>In most of the work</summary><div data-awptc><i data-awbio hidden></i></div></details>
      ${roles ? `<details class="aw-more"><summary>Inside the painting</summary><p class="aw-sub">Roles are relative within one canvas, so they hold up under varnish.</p><div class="aw-roles">${roles}</div></details>` : ""}
      ${dk ? `<details class="aw-more"><summary>His darks and his lights</summary><p class="aw-sub">The darkest, then the lightest, of the colors that cover at least 3% of a canvas (${P.dn} paintings).</p><p class="aw-lbl">Darkest</p><div class="aw-chips">${dk}</div><p class="aw-lbl">Lightest</p><div class="aw-chips">${lt}</div></details>` : ""}
      ${av ? `<details class="aw-more"><summary>Colors he avoids</summary><p class="aw-sub">Much less of these than the same museums' paintings have.</p><div class="aw-chips">${av}</div></details>` : ""}
      ${ch ? `<details class="aw-more"><summary>Favorite pairs and chords</summary><p class="aw-sub">Colors that share a canvas more than chance predicts. Pairs seen in fewer than 4 paintings are left out.</p>${ch}</details>` : ""}`;
  } else if (small) {
    colors = `<div class="sec-head"><b>Colors</b><span>${n} paintings</span></div><p class="aw-sub">Only ${n} paintings here, too few for a signature. Palettes and the barcode above are a sketch, not a finding.</p>`;
  }

  // over time
  const time = awTimeSection(A, P);

  // compared
  const compared = awComparedSection(slug, m, A, P);

  // the highlight card: his most typical painting, one measured sentence, his signature colors
  const hlChips = small ? [] : awSigChips(P.sig, P.ix);
  const hlExt = small ? "" : awExtreme([["L", "Darker", "Lighter"], ["C", "Less colorful", "More colorful"], ["W", "Cooler", "Warmer"]].map(([k, lo, hi]) => m[k] == null ? null : awPctWords(k, m[k], lo, hi)));
  const hlLine = small ? esc(`Only ${awPlural(n, "painting")} here: a sketch, not a finding.`) : awLineJoin(hlExt, awReach(hlChips[0]), `from ${n} paintings, as photographed`);
  const el = show(`
    <header class="art-top"><button class="icon-btn glass" data-back aria-label="Back">${ICON.back}</button><button class="glass-pill" data-awvs="${esc(slug)}">${ICON.search}<span>Compare</span></button></header>
    <div class="aw-head"><div><p class="eyebrow p-type">Painter</p><h1 class="p-title">${esc(A.name)}</h1><p class="p-dek">${dek}</p></div></div>
    ${awPortraitHero(slug, A, P, small ? [] : awSigChips(P.sig, P.ix))}
    ${awFamousRail(slug, n)}
    ${awWorksSection(slug, m, A, P)}
    <div data-awbio></div>
    <div class="aw-you" data-aw-you></div>
    ${awHighlight(P.typical != null ? P.typical : -1, hlLine, hlChips)}
    ${n >= 2 ? `<button class="gl-pmap aw-pmap" data-pmap="arr=color&p=${esc(slug)}">${GL_ICON_MAP}<span>Their work on the map</span>${ICON.chev}</button>` : ""}
    ${palettes}
    ${colors}
    ${time}
    ${compared}
    <div class="aw-acts" data-aw-acts></div>
    ${typeof linksHereHTML === "function" ? linksHereHTML({ id: "painter:" + slug, title: A.name }) : ""}
    <section class="srcs"><h3>Sources</h3><ul>
      <li>Colors measured by ColorHub from museum photographs (${A.n} paintings by ${esc(A.name)} in the archive); every figure is as photographed, screen color only.</li>
      ${m.q ? `<li>Dates, nationality, movement, teachers and portrait: <a href="https://www.wikidata.org/wiki/${m.q}" target="_blank" rel="noopener">Wikidata</a> (CC0)${m.wp ? ` · <a href="https://en.wikipedia.org/wiki/${encodeURIComponent(m.wp)}" target="_blank" rel="noopener">Wikipedia</a>` : ""}${m.img ? ` · portrait: <a href="https://commons.wikimedia.org/wiki/File:${encodeURIComponent(m.img)}" target="_blank" rel="noopener">Wikimedia Commons</a>` : ""}</li>` : `<li>No Wikidata match was found for this name, so dates come from the paintings themselves.</li>`}
    </ul></section>`, "article aw-page");
  awWire(el);
  if (typeof wireLinks === "function") wireLinks(el);
  awFillHighlight(el);
  awFillPortrait(el);
  awWorksWire(el, slug, m, A, P);
  glFill(el);   // hydrates the "Most famous" rail's pins once their shard lands
  // js/paintingsof.js (L26): colors used in a quarter of the works, inside the Colors drawer (it inserts before the
  // first [data-awbio] of the element it's handed, so it gets the drawer's own placeholder, not the bio slot)
  const ptc = el.querySelector("[data-awptc]");
  if (ptc && typeof ptPainterColors === "function") {
    const mo = new MutationObserver(() => { if (ptc.querySelector("[data-pt-painter]")) { ptc.closest("details").hidden = false; mo.disconnect(); } });
    mo.observe(ptc, { childList: true });
    ptPainterColors(ptc, A.name);
  }
  // titles and images of the clusters' typical paintings
  el.querySelectorAll("[data-awpal]").forEach(b => b.onclick = () => { const t = el.querySelector("#aw-pal"); if (t) t.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" }); });
  el.querySelectorAll("[data-gltitle]").forEach(t => { const i = +t.dataset.gltitle; if (i >= 0) glDetail(i).then(d => { if (t.isConnected) t.textContent = "The " + d.t.replace(/^(the|a|an)\s+/i, "") + " palette"; const im = el.querySelector(`[data-glimg="${i}"]`); if (im) { im.src = d.img; } }).catch(() => {}); });
  el.querySelectorAll("[data-glroom]").forEach(t => { const i = +t.dataset.glroom; if (i >= 0) glDetail(i).then(d => { if (t.isConnected) t.textContent = d.t.length > 26 ? d.t.slice(0, 25) + "…" : d.t; }).catch(() => {}); });
  el.querySelectorAll("[data-glimg]").forEach(im => { const i = +im.dataset.glimg; if (i >= 0) glDetail(i).then(d => { if (im.isConnected) im.src = d.img; }).catch(() => {}); });
  el.querySelectorAll("[data-gltypical]").forEach(w => { const i = +w.dataset.gltypical; if (i >= 0) glDetail(i).then(d => { if (!w.isConnected) return; const im = w.querySelector("img"); im.src = d.img; w.querySelector("b").textContent = d.t; }).catch(() => {}); });
  bioSlot(slug).then(h => { const s = el.querySelector("[data-awbio]"); if (s && h) s.innerHTML = h; });
  // "You and this painter" (js/learner.js knowState): how many of this painter's cluster and signature colors you've met or own
  const you = el.querySelector("[data-aw-you]");
  try {
    if (typeof knowState === "function") {
      const names = [...new Set([...(A.clusters || []).flatMap(c => c.colors), ...(P.sig || []).map(r => awCol(r[0])[0])].map(awCanon))];
      const hexes = names.map(k => { const e = (CORE_NAMES || []).find(x => awCanon(x.n) === k); return e && e.h; }).filter(Boolean);
      const st = hexes.map(h => knowState(h)), yours = st.filter(x => x === "yours").length, met = st.filter(x => x !== "none").length;
      if (hexes.length >= 4) you.innerHTML = `<p class="aw-find">${yours ? `${yours} of the ${hexes.length} colors in these palettes ${yours === 1 ? "is" : "are"} yours` : met ? `You've met ${met} of the ${hexes.length} colors in these palettes` : `None of the ${hexes.length} colors in these palettes are yours yet`}${met > yours ? `, ${met - yours} more met.` : "."}</p>`;
    }
  } catch (e) {}
  const acts = el.querySelector("[data-aw-acts]");
  if (typeof colorSet === "function" && typeof csActions === "function") {
    const hx = awPainterHexes(A, P);
    acts.appendChild(csActions(colorSet({ kind: "painter", id: slug, title: A.name, colors: hx.map(h => ({ h })), src: "painter/" + slug,
      ...(hx.length > 3 ? { pick: k => hx.slice(0, k).map(h => ({ h })), max: hx.length } : {}) }), { back: () => awPainter(slug, false) }));
  }
  if (typeof whosePalette === "function") acts.insertAdjacentHTML("beforeend", `<button class="btn ghost" data-awwhose="${esc(slug)}">Whose palette? Guess ${esc(A.name.split(" ").pop())} from five colors ${ICON.arrow}</button>`);
  acts.onclick = e => { const w = e.target.closest("[data-awwhose]"); if (w) whosePalette(w.dataset.awwhose); };
}

// favorite pairs and chords: pairs that share a color join into chords of three or four
function awChords(pairs) {
  const ok = pairs.filter(p => p.count >= 4 && awCanon(p.a) !== awCanon(p.b));
  if (!ok.length) return "";
  const parent = new Map(), find = x => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
  ok.forEach(p => { [p.a, p.b].forEach(x => { if (!parent.has(x)) parent.set(x, x); }); parent.set(find(p.a), find(p.b)); });
  const comp = new Map();
  ok.forEach(p => { const r = find(p.a); if (!comp.has(r)) comp.set(r, { names: new Set(), lift: 0, count: 0, maxCount: 0 }); const c = comp.get(r); c.names.add(p.a); c.names.add(p.b); c.lift = Math.max(c.lift, p.lift); c.count = Math.max(c.count, p.count); });
  return [...comp.values()].sort((a, b) => b.lift - a.lift).map(c => {
    const names = [...c.names].slice(0, 4);
    return `<div class="aw-chord"><span class="aw-chord-sw">${names.map(x => awSw(awHex(x), x)).join("")}</span><span class="aw-chord-t">${names.map(esc).join(" · ")}</span><em>${names.length > 2 ? "chord" : "pair"} · ×${c.lift.toFixed(1)} · up to ${c.count} paintings</em></div>`;
  }).join("");
}

// A painting's year counts on the timeline only inside the painter's working life: museum records carry
// placeholder years (1500 for "16th century") and blanks, which drew a "1500 … null" axis and a false trend.
function awYearOk(slug, y) {
  if (y == null || !isFinite(y)) return false;
  const m = (AW.meta && AW.meta.a[slug]) || {};
  return (m.b ? y >= m.b + 8 : y >= 1200) && (m.d ? y <= m.d + 2 : true);
}
// a decade counts when any year in it is a trusted year
const awDecOk = (slug, d) => awYearOk(slug, d + 9) || awYearOk(slug, d);
function awTimeSection(A, P) {
  const bc = A.barcode.filter(b => awYearOk(A.slug, b[1]));
  if (bc.length < 6) return "";
  const byDec = new Map();
  bc.forEach(b => { const d = Math.floor(b[1] / 10) * 10; if (!byDec.has(d)) byDec.set(d, new Map()); const mp = byDec.get(d); b[2].forEach(nm => mp.set(awCanon(nm), [(mp.get(awCanon(nm)) || [nm, 0])[0], (mp.get(awCanon(nm)) || [nm, 0])[1] + 1])); });
  const decs = (A.byDecade || []).filter(d => d.n >= 1 && awDecOk(A.slug, d.decade));
  if (decs.length < 2) return "";
  const cols = [...byDec.entries()].sort((a, b) => a[0] - b[0]).map(([d, mp]) => {
    const tops = [...mp.values()].sort((a, b) => b[1] - a[1]).slice(0, 4), tot = tops.reduce((s, t) => s + t[1], 0) || 1, n = (decs.find(x => x.decade === d) || {}).n || 0;
    return `<div class="aw-dcol${n < 3 ? " thin" : ""}"><span class="aw-dstack">${tops.map(t => `<i style="--c:${awHex(t[0])};flex:${t[1]}" data-swatch="${awHex(t[0])}" title="${esc(t[0])}"></i>`).join("")}</span><em>${awDec(d)}</em><u>${n}</u></div>`;
  }).join("");
  const cp = A.changePoint, dn = d => (decs.find(x => x.decade === d) || {}).n || 0;
  let cpText = "";
  // a change point that leans on undated or out-of-life decades is not a finding
  if (cp && !(A.byDecade || []).some(d => d.decade < cp.decade && !awDecOk(A.slug, d.decade))) {
    const lighter = cp.after > cp.before, prev = decs.filter(x => x.decade < cp.decade).pop(), pn = prev ? prev.n : 0, nn = dn(cp.decade);
    cpText = `<p class="aw-find">The palette ${lighter ? "lightens" : "darkens"} around the ${awDec(cp.decade)}: mean lightness ${Math.round(cp.before)} before, ${Math.round(cp.after)} after (${pn} and ${nn} paintings${Math.min(pn, nn) < 5 ? "; small groups, so a hint rather than a finding" : ""}).</p>`;
  }
  return `<div class="sec-head"><b>Over time</b><span>${decs.length} decades</span></div>
    <p class="aw-sub">The three biggest colors of every painting, grouped by decade. Taller means more paintings; the faint number is how many paintings the decade has.</p>
    <div class="aw-decades">${cols}</div>
    <div class="aw-spark-w"><span>Mean lightness by decade</span>${awSpark(decs.map(d => [d.decade, d.Lmean, d.n]))}<em>open dots: fewer than 5 paintings</em></div>
    ${cpText}`;
}

function awComparedSection(slug, m, A, P) {
  const st = AW.stats[slug] || [0, 0, 0], rows = [];
  const w = [["L", "Value key", m.L, "Darker", "lighter"], ["C", "Chroma", m.C, "Less colorful", "more colorful"], ["W", "Warmth", m.W, "Cooler", "warmer"]];
  w.forEach(([k, label, v, lo, hi]) => { if (v == null) return; const r = awPctWords(k, v, lo, hi[0].toUpperCase() + hi.slice(1)); rows.push(awBar(r.p, label, r.text.replace(/^Lighter/, "Lighter").replace(/^Darker/, "Darker"))); });
  const rc = awPctWords("ct", st[0], "Flatter", "Higher contrast"), rv = awPctWords("vv", st[1], "Fewer vivid colors", "More vivid color");
  rows.push(awBar(rc.p, "Contrast", rc.text.replace("Higher contrast than", "More contrast than")), awBar(rv.p, "Vividness", rv.text));
  const typ = (id, label) => id != null ? `<button class="aw-typ" data-gi="${id}" data-gltypical="${id}"><span><img alt=""></span><em>${label}</em><b></b></button>` : "";
  const near = (A.nearest || []).filter(x => AW.meta.a[x.slug]);
  const tt = (m.tt || []), inf = (m.in || []);
  const tie = t => { const sim = t.d == null ? "" : t.d < .8 ? "very close palettes" : t.d < 1.6 ? "similar palettes" : t.d < 2.6 ? "different palettes" : "far-apart palettes"; return t.s ? `<button class="aw-tie" data-awpainter="${t.s}"><b>${esc(t.n)}</b><span>${sim}</span></button>` : `<div class="aw-tie off"><b>${esc(t.n)}</b><span>not in this archive</span></div>`; };
  const students = AW.list.filter(x => x.slug !== slug && m.q && (x.tt || []).some(t => t.q === m.q)).slice(0, 8);
  const ties = (tt.length || inf.length || students.length) ? `<div class="aw-ties">
      ${tt.length ? `<p class="aw-lbl">Taught by</p>${tt.map(tie).join("")}` : ""}
      ${inf.length ? `<p class="aw-lbl">Influenced by</p>${inf.map(tie).join("")}` : ""}
      ${students.length ? `<p class="aw-lbl">Taught, in this archive</p>${students.map(s => `<button class="aw-tie" data-awpainter="${s.slug}"><b>${esc(s.n)}</b><span>${s.k} paintings</span></button>`).join("")}` : ""}
      <p class="fine">Palette closeness uses mean lightness, chroma and warmth only (a rough guide). Teacher and influence links are Wikidata's, not ours.</p></div>` : "";
  return `<div class="sec-head"><b>Compared</b><span>${AW.list.length} painters here</span></div>
    <div class="aw-pbars">${rows.join("")}</div>
    <div class="aw-typs">${typ(P.atypical, "Least typical")}</div>
    ${near.length ? `<p class="aw-lbl">Paints like</p><div class="aw-near">${near.map(x => `<button class="aw-tie" data-awpainter="${x.slug}"><b>${esc(x.name)}</b><span>palette distance ${x.d.toFixed(2)}</span></button>`).join("")}</div><p class="fine">Nearest painters by six numbers: lightness, chroma, warmth, vivid share, muted share and color variety, across all ${AW.list.length}.</p>` : ""}
    ${ties}`;
}

function awPainterFindings(A, P, n) {
  if (n < 10) return `<p class="aw-sub aw-quiet">${awPlural(n, "painting")} here. Findings stay quiet under 10.</p>`;
  const out = [], nm = c => awCol(c)[0].toLowerCase();
  // the within-painting lens leads: roles hold up under varnish
  if (P.roles) {
    const R = { acc: "an accent color", hid: "a hidden color", foc: "the focal color", glu: "the glue tone" };
    Object.entries(P.roles).slice(0, 2).forEach(([r, rows]) => { const [c, k, pres, p, q] = rows[0]; out.push(`Often makes ${nm(c)} ${R[r]}: in ${k} of the ${pres} paintings that have it, against ${awPct(q)}% across the archive.`); });
  }
  const sg = (P.sig || []).find(s => !awNearBlack(awCol(s[0])[1]));
  if (sg) out.push(`Uses ${nm(sg[0])} ${sg[1].toFixed(1)}x more than other paintings in the same museums (in ${sg[3]} of ${n} paintings here, as photographed).`);
  const shift = (A.findings || []).filter(f => /shifts around|Paints most like|largest palette family/.test(f)).map(f => f.replace(/\s*\(from \d+ paintings here\)\.?$/, ` (from ${n} paintings here).`));
  const gated = [...out, ...awGateFinds(shift, 3)].slice(0, 3);
  return gated.length ? `<ul class="aw-finds">${gated.map(f => `<li>${esc(f)}</li>`).join("")}</ul>` : "";
}

// "Why it matters" (design brief, David 2026-10-09: who/why shouldn't need a scroll): one or two lines right
// under the pinned image, above the palette strip. The corpus has no curated per-painting story yet, so this
// draws on the same gated findings the Analysis section further down uses (awGateFinds) -- genuinely computed,
// honest color facts, not filler. Quiet (hidden) when a painting has nothing worth saying (a thin sample).
function awPaintingWhy(host, r) {
  if (!host) return;
  const fin = awGateFinds(r.find, 3);
  if (!fin.length) { host.hidden = true; host.innerHTML = ""; return; }
  const [lead, ...rest] = fin;
  host.hidden = false;
  host.innerHTML = `<p class="gl-why-t">${esc(lead)}</p>` +
    (rest.length ? `<button class="gl-why-more" data-glwhymore aria-expanded="false">More</button><ul class="gl-why-ex" hidden>${rest.map(f => `<li>${esc(f)}</li>`).join("")}</ul>` : "");
  const more = host.querySelector("[data-glwhymore]"), ex = host.querySelector(".gl-why-ex");
  if (more) more.onclick = () => {
    const open = ex.hidden; ex.hidden = !open; more.setAttribute("aria-expanded", String(open));
    more.textContent = open ? "Less" : "More";
  };
}

// ======================================================================
// Painting pages: the Analysis section (called from js/gallery.js glPage)
// ======================================================================
function awPaintingHook(el, i, d, ctx) {
  // 1. the artist name is already a real, tappable link the moment the page draws (js/gallery.js's .p-dek
  // render, from the painting's own d.a field) -- David, 2026-10-09: "sometimes it doesn't let me tap the
  // painter". The old code waited for the painter list to finish loading before turning the name into a button
  // AT ALL, so a tap in that window (common on a fresh load, since js/loader.js's wiki data is lazy) landed on
  // inert text. This only confirms or corrects that optimistic render once the real data is in: an artist who
  // genuinely isn't in the archive downgrades to plain text instead of a dead-end button, and a defensive
  // elementFromPoint check catches the OTHER reported cause (something else sitting on top of it) by lifting
  // the link's stacking order if the point at its own center doesn't actually land on it.
  if (d.a) {
    const slug = routeSlug(d.a), dek = el.querySelector(".p-dek");
    awLoad().then(() => {
      if (!el.isConnected || !dek) return;
      const btn = dek.querySelector("[data-awpainter]");
      if (!btn) return;
      if (!awHasPainter(slug)) { btn.outerHTML = esc(d.a); return; }
      const r = btn.getBoundingClientRect();
      if (r.width && r.height) {
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        if (hit && hit !== btn && !btn.contains(hit)) { btn.style.position = "relative"; btn.style.zIndex = "1"; }
      }
    }).catch(() => {});
  }
  awContext(el.querySelector("[data-glctx]"), i, d);
  const whyHost = el.querySelector("[data-glwhy]");
  const host = el.querySelector("[data-awan]"); if (!host) return;
  awShard(i).then(rows => {
    const r = rows[i % 100];
    if (!r || r.id !== d.id) return;
    if (whyHost && whyHost.isConnected) awPaintingWhy(whyHost, r);
    if (host.isConnected) awAnalysis(host, el, i, d, r, ctx);
  }).catch(() => { host.innerHTML = ""; });
}
// "In context" (design/ARCHIVE-PAGES.md #8): Strava-style dot rows. Each row is one comparison set (the painter's
// works here, the decade, the movement), drawn as the spread of its paintings on one shared scale with this
// painting's dot on it. A switch picks the measure (lightness, chroma, warmth: the numbers the Analysis tiles
// print). A row opens that set's page; a row with fewer than 10 paintings is left out.
const AW_CX = [["L", "Lightness", "darker", "lighter", v => "lightness " + v], ["C", "Chroma", "quieter", "more colorful", v => "chroma " + v], ["W", "Warmth", "cooler", "warmer", v => v + "% warm"]];
let AW_CXM = 0;   // the chosen measure, kept while you move between paintings
function awContext(host, i, d) {
  if (!host) return;
  Promise.all([awLoad(), awCtxLoad()]).then(() => {
    const slug = d.a ? routeSlug(d.a) : "";
    return (slug && awHasPainter(slug) ? awPainterLoad(slug).then(x => x.P.ix, () => null) : Promise.resolve(null)).then(ix => {
      if (!host.isConnected) return;
      const C = AW.ctx, sets = [], y = GAL.year[i];
      if (ix && ix.length >= 10) sets.push({ label: AW.meta.a[slug].n, list: ix.filter(j => j >= 0), attr: `data-awpainter="${esc(slug)}"` });
      if (y !== GL_UNDATED) { const dk = Math.floor(y / 10) * 10; if (AW.grp.byDecade[dk]) sets.push({ label: "The " + awDec(dk), list: awMembers("decade", dk), attr: `data-awgroup="decade|${dk}"` }); }
      const mk = C.MV[i], mv = mk ? C.mv[mk - 1] : ""; if (mv && AW.grp.byMovement[mv]) sets.push({ label: mv, list: awMembers("movement", mv), attr: `data-awgroup="movement|${esc(mv)}"` });
      const rows = sets.filter(s => s.list.length >= 10);
      if (!rows.length) { host.innerHTML = ""; return; }
      const draw = () => {
        const [k, , lo, hi, show] = AW_CX[AW_CXM], arr = C[k], me = arr[i];
        // one scale for every row, so the rows compare: the 2nd to 98th percentile of all of them, always with this painting on it
        const vals = []; rows.forEach(s => s.list.forEach(j => vals.push(arr[j]))); vals.sort((a, b) => a - b);
        let d0 = Math.min(vals[Math.floor(vals.length * .02)], me), d1 = Math.max(vals[Math.min(vals.length - 1, Math.ceil(vals.length * .98))], me);
        if (d1 - d0 < 12) { const m = (d0 + d1) / 2; d0 = m - 6; d1 = m + 6; }
        const NB = 36, X = v => clamp((v - d0) / (d1 - d0), 0, 1);
        // this card only ever sits inside the painting page's "Findings" (js/gallery.js glPage, point 5 of
        // David's rebuild brief, 2026-10-09), which already carries the section header, so it leads with its
        // own lighter label instead of repeating a sec-head
        host.innerHTML = `<p class="gl-roles-h">Compared</p>
          <div class="aw-cx-top"><div class="seg aw-cx-seg" role="tablist" aria-label="Measure">${AW_CX.map((m, q) => `<button class="${q === AW_CXM ? "on" : ""}" data-cxm="${q}">${m[1]}</button>`).join("")}</div></div>
          <p class="aw-cx-me"><i></i>This painting: <b>${show(me)}</b></p>
          ${rows.map(s => {
            const others = s.list.filter(j => j !== i), below = others.filter(j => arr[j] < me).length / Math.max(1, others.length);
            const where = below >= .65 ? `${hi} than ${awPct(below)}%` : below <= .35 ? `${lo} than ${awPct(1 - below)}%` : "near the middle";
            const bins = new Array(NB).fill(0); s.list.forEach(j => bins[Math.min(NB - 1, Math.floor(X(arr[j]) * NB))]++);
            const mx = Math.max(...bins, 1);
            return `<button class="aw-cx-row" ${s.attr}><span class="aw-cx-h"><b>${esc(s.label)}</b><em>${where} · ${s.list.length.toLocaleString("en-US")} paintings</em></span>
              <span class="aw-cx-tr" aria-hidden="true">${bins.map(v => `<i style="height:${v ? Math.max(8, v / mx * 100).toFixed(0) : 0}%"></i>`).join("")}<u style="left:${(X(me) * 100).toFixed(1)}%"></u></span></button>`;
          }).join("")}
          <div class="aw-cx-ax"><span>${lo}</span><span>${hi}</span></div>`;
      };
      draw();
      host.onclick = e => { const b = e.target.closest("[data-cxm]"); if (!b || +b.dataset.cxm === AW_CXM) return; AW_CXM = +b.dataset.cxm; buzz(5); draw(); };
    });
  }).catch(() => { if (host.isConnected) host.innerHTML = ""; });
}
// This card only ever sits behind the painting page's "Findings" > "More" fold now (js/gallery.js glPage, David's
// polish pass, 2026-10-09: "Findings" and "Analysis" read as two data sections back to back) — the strongest
// 2-3 lines (the role crops, "In context") already lead outside the fold, so this never repeats them with its
// own header or its own "Findings" details; it's the deeper measurements and the painter/era links.
function awAnalysis(host, el, i, d, r, ctx) {
  const st = r.stat, pool = ctx.pool, curPal = ctx.curPal;
  const Lh = awUnb64(st.Lh), hh = awUnb64(st.hh);
  const warm = st.wf / 1000, ch = st.ch.map(v => v / 1000);
  const roles = ["foc", "hid", "glu"];
  const poolOK = pool.length >= 6;
  host.innerHTML = `
    <p class="aw-sub">Many readings of one painting, from the museum photo. Tap any color to open its page.</p>
    <div class="aw-tiles">
      <div><span>Value key</span><b>${AW_KEYWORD[st.key] || st.key}</b><em>mean lightness ${st.Lm}</em></div>
      <div><span>Contrast</span><b>${st.ct}</b><em>lightness range, 5th to 95th percentile (${st.p5}–${st.p95})</em></div>
      <div><span>Vivid</span><b>${awPct(ch[2])}%</b><em>${awPct(ch[0])}% muted · ${awPct(ch[1])}% moderate</em></div>
      <div><span>Warm / cool</span><b>${awPct(warm)}% warm</b><em>by chroma-weighted hue</em></div>
    </div>
    ${(typeof prQuick === "function") ? `<button class="btn" data-awlesson>Learn this painting${ICON.arrow}</button>` : ""}
    <div data-awreadings></div>
    <details class="aw-more"><summary>The measurements</summary>
      <div class="aw-meas">
        <div>${awHueRing(hh)}<em>hue wheel · strongest: ${awBand(hh)}</em></div>
        <div class="aw-meas-t">
          <p><b>Lightness</b></p><span class="aw-lhist">${Lh.map(v => `<i style="height:${Math.max(3, v * 100 / Math.max(...Lh, .01))}%"></i>`).join("")}</span><em>dark to light, share of canvas</em>
          <p><b>Chroma bands</b></p><span class="aw-seg"><i style="flex:${ch[0]};--c:#6a665c"></i><i style="flex:${ch[1]};--c:#a39a85"></i><i style="flex:${Math.max(ch[2], .004)};--c:#e0a13a"></i></span><em>muted · moderate · vivid</em>
        </div>
      </div>
      <p class="aw-kv"><span>Gamut area</span><b>${st.ga}</b><em>convex hull of the palette's a*b* spread</em></p>
      <p class="aw-kv"><span>Effective colors</span><b>${(st.ef / 10).toFixed(1)}</b><em>how many equal-sized colors the palette is worth</em></p>
      ${st.hf && st.hf !== "analogous" ? `<p class="aw-kv"><span>Harmony fit</span><b>${esc(st.hf)}</b><em>a rough heuristic (score ${(st.hs / 100).toFixed(2)}), not a measurement</em></p>` : ""}
      <p class="aw-kv"><span>Dominant family</span><b>${esc(st.df)}</b><em></em></p>
      <p class="fine">Palette-level proxies: they describe the ${r.n} extracted colors, not every pixel.</p>
    </details>
    <div data-awpig></div>
    <div data-awnn></div>
    <div data-awpainter-row></div>`;
  // readings that follow the 3/6/12/20 slider
  const read = host.querySelector("[data-awreadings]");
  const draw = pal => {
    if (!read.isConnected) return;
    const Lof = pal.map(p => lab(p.h)[0]), tot = pal.reduce((s, p) => s + p.share, 0) || 1;
    const band = (lo, hi) => pal.filter((p, k) => Lof[k] >= lo && Lof[k] < hi);
    const sh = band(-1, 35), mi = band(35, 65), li = band(65, 101);
    const sum = a => a.reduce((s, p) => s + p.share, 0) / tot;
    const row = (label, a) => `<div class="aw-vrow"><span>${label}<em>${awPct(sum(a))}%</em></span>${a.length ? `<span class="aw-vsw">${a.map(p => awSw(p.h, nameOf(p.h).text)).join("")}</span>` : `<span class="aw-none">none at this size</span>`}</div>`;
    const cls = pal.map(p => { const l = lch(p.h); return l[1] < 8 ? "n" : (l[2] >= 330 || l[2] < 100) ? "w" : "c"; });
    const wp = pal.filter((p, k) => cls[k] === "w"), cp = pal.filter((p, k) => cls[k] === "c"), np = pal.filter((p, k) => cls[k] === "n");
    const acc = (r.acc || []).map(k => pool[k]).filter(Boolean), hid = (r.hid || []).map(k => pool[k]).filter(Boolean);
    const foc = pool[r.foc], glu = pool[r.glu];
    const one = (label, p, why) => p ? `<div class="aw-one"><button class="aw-one-sw" data-swatch="${p.h}" style="--c:${p.h}" data-ink="${ink(p.h)}"><span>${awPct(p.share) || "<1"}%</span></button><div><b>${label}</b><span>${esc(nameOf(p.h).text)}</span><em>${why}</em></div></div>` : "";
    read.innerHTML = `
      <details class="aw-more" open><summary>Lights, mids and shadows <small>${pal.length} colors</small></summary>${row("Lights", li)}${row("Mid-tones", mi)}${row("Shadows", sh)}<p class="fine">By the lightness of each color in the palette above (below 35 shadow, above 65 light), so it follows the size you pick.</p></details>
      <details class="aw-more"><summary>Warm and cool <small>${pal.length} colors</small></summary>
        <span class="aw-seg tall"><i style="flex:${Math.max(sum(wp), .003)};--c:#c8744a"></i><i style="flex:${Math.max(sum(np), .003)};--c:#8b867a"></i><i style="flex:${Math.max(sum(cp), .003)};--c:#4f86b8"></i></span>
        <p class="aw-cap">${awPct(sum(wp))}% warm · ${awPct(sum(np))}% neutral · ${awPct(sum(cp))}% cool</p>
        <div class="aw-vrow"><span>Warm</span><span class="aw-vsw">${wp.map(p => awSw(p.h, "")).join("") || '<span class="aw-none">none</span>'}</span></div>
        <div class="aw-vrow"><span>Cool</span><span class="aw-vsw">${cp.map(p => awSw(p.h, "")).join("") || '<span class="aw-none">none</span>'}</span></div></details>
      ${poolOK ? `<details class="aw-more"><summary>Accents, hidden, focal, glue</summary>
        ${one("Focal color", foc, "strong color that stands apart from the painting's average lightness (a computed guess, not eye-tracking)")}
        ${one("Glue tone", glu, "the largest mid-tone, between the lights and the darks")}
        ${acc.map((p, k) => one(k ? "Accent" : "Accent", p, "small, vivid, and far from the two biggest colors")).join("")}
        ${hid.map(p => one("Hidden color", p, "muted, and from a different family than the rest")).join("")}</details>` : ""}`;
  };
  draw(curPal());
  el._awPal = draw;
  const les = host.querySelector("[data-awlesson]"); if (les) les.onclick = () => prQuick({ items: curPal().map(p => p.h), label: d.t, src: "painting", route: "#/gallery/" + i });
  // pigment hint (hedged)
  if (r.pig && CORE_NAMES && CORE_NAMES[r.pig.ci]) {
    host.querySelector("[data-awpig]").innerHTML = `<p class="aw-find">${esc(CORE_NAMES[r.pig.ci].n)} is the name of a pigment first made around ${r.pig.since}, close to when this was painted. A hint, from screen color only, not a claim about the paint used.</p>`;
  }
  // nearest painting in another century
  if (r.nn) awIdMap().then(map => {
    const j = map.get(r.nn.id), slot = host.querySelector("[data-awnn]"); if (j == null || !slot || !slot.isConnected) return;
    const y1 = GAL.year[i], y0 = GAL.year[j];
    slot.innerHTML = `<div class="sec-head"><b>A palette from another century</b><span>distance ${r.nn.d.toFixed(2)}</span></div>
      <p class="aw-sub">${y0 !== GL_UNDATED && y1 !== GL_UNDATED ? `Painted ${Math.abs(y0 - y1)} years ${y0 < y1 ? "earlier" : "later"}, and ` : ""}close in lightness, color and spread to this one. Smaller distance means closer.</p>
      <div class="gl-rail">${glPinHTML(j, { badge: r.nn.century + "s" })}</div>`;
    glFill(slot);
  }).catch(() => {});
  // painter row: links outward
  if (d.a) awLoad().then(() => {
    const slug = routeSlug(d.a), slot = host.querySelector("[data-awpainter-row]"); if (!slot || !slot.isConnected || !awHasPainter(slug)) return;
    slot.innerHTML = `<div class="sec-head"><b>${esc(d.a)}</b><span>${AW.meta.a[slug].k} paintings here</span></div><div class="aw-linkrow"><button class="btn ghost" data-awpainter="${slug}">The painter's page: every palette, signature colors, over time ${ICON.arrow}</button></div>`;
  }).catch(() => {});
}
const awUnb64 = s => Array.from(atob(s), c => c.charCodeAt(0) / 255);

// ======================================================================
// Movement, decade and country pages
// ======================================================================
function awGroupKeys(kind) { return Object.keys(kind === "movement" ? AW.grp.byMovement : kind === "decade" ? AW.grp.byDecade : AW.grp.byCountry); }
function awGroup(kind, key, push = true) {
  if (!AW.ready || !AW.ctx) return awWait(awGroup, [kind, key, push], awCtxLoad);
  const gs = kind === "movement" ? AW.grp.byMovement : kind === "decade" ? AW.grp.byDecade : AW.grp.byCountry, ges = kind === "movement" ? AW.ge.byMovement : kind === "decade" ? AW.ge.byDecade : AW.ge.byCountry;
  const g = gs[String(key)], x = ges[String(key)];
  if (!g || !x) { toast("No page for that"); return xToOrigin(); }
  if (push) XSTACK.push("aw:group:" + kind + ":" + key);
  const title = kind === "decade" ? awDec(key) : String(key), n = g.n;
  // the n line carries the honesty note in one line; the longer explanation lives in Sources
  const nn = n.toLocaleString("en-US"), t = g.tiers || [n, 0, 0];
  const dek = kind === "movement" ? `${nn} paintings; ${awPct(t[0] / Math.max(1, n))}% tagged by museums`
    : kind === "country" ? `${nn} paintings, mostly by the painter's nationality`
    : `${nn} paintings dated ${key}–${key + 9}`;
  const srcNote = kind === "movement" ? `<li>A sample of ${esc(title)}, not the whole of it. How these were tagged: ${t[0]} by the museum, ${t[1]} by Wikidata for the painting itself, ${t[2]} only because their painter is recorded with this movement (a looser link). Only ${Object.keys(AW.grp.byMovement).length} movements reach 20 paintings here; most paintings in the archive carry no movement at all.</li>`
    : kind === "country" ? `<li>Country is often the painter's nationality, not where the painting was made.</li>`
    : `<li>Dated ${key}–${key + 9}. Undated and approximately dated works are left out.</li>`;
  // the highlight card: the painting nearest the group's centroid, one measured sentence, the signature colors
  const members = awMembers(kind, key), all = Object.values(ges), noun = kind === "decade" ? "decades" : kind === "movement" ? "movements" : "countries";
  const gpct = (k, lo, hi) => { if (x[k] == null) return null; const p = all.filter(o => o[k] < x[k]).length / all.length; return { p, text: `${p >= .5 ? hi : lo} than ${awPct(p >= .5 ? p : 1 - p)}% of the ${all.length} ${noun} here` }; };
  const hlChips = awSigChips(x.sig, members);
  const hlLine = awLineJoin(awExtreme([gpct("L", "darker", "lighter"), gpct("vv", "quieter", "more vivid"), gpct("wf", "cooler", "warmer")]), awReach(hlChips[0]), "as photographed");
  const hlGi = ((AW.ctx.typ || {})[kind] || {})[String(key)];
  const top = g.top.slice(0, 8), dist = (g.distinctive || []).slice(0, 6), base = AW.ge.archive.hh;
  const timeCols = (x.time || []).map(t => { const tops = t[3]; return `<div class="aw-dcol${t[1] < 10 ? " thin" : ""}"><span class="aw-dstack">${tops.map((c, k) => `<i style="--c:${awCol(c)[1]};flex:${3 - k}" data-swatch="${awCol(c)[1]}" title="${esc(awCol(c)[0])}"></i>`).join("")}</span><em>${awDec(t[0])}</em><u>${t[1]}</u></div>`; }).join("");
  const sig = (x.sig || []).map(([c, lift, own, sup]) => { const [nm, hx] = awCol(c); return `<button class="aw-sig" data-swatch="${hx}"><i style="--c:${hx}" data-ink="${ink(hx)}"></i><b>${esc(nm)}</b><span>×${lift.toFixed(1)}</span><em>in ${sup} of ${n} paintings · ${awPct(own)}% of the canvas</em></button>`; }).join("");
  const arts = (x.art || []).map(([s, k]) => AW.meta.a[s] ? `<button class="aw-tie" data-awpainter="${s}"><b>${esc(AW.meta.a[s].n)}</b><span>${k} paintings here</span></button>` : "").join("");
  const decs = awGroupKeys("decade").map(Number).sort((a, b) => a - b), di = decs.indexOf(+key);
  const pn = kind === "decade" ? `<div class="aw-pn">${di > 0 ? `<button class="aw-link" data-awgroup="decade|${decs[di - 1]}">‹ ${awDec(decs[di - 1])}</button>` : "<span></span>"}${di < decs.length - 1 ? `<button class="aw-link" data-awgroup="decade|${decs[di + 1]}">${awDec(decs[di + 1])} ›</button>` : ""}</div>` : "";
  const anyHex = dist[0] ? awHex(dist[0].name) : awHex(top[0].name);
  const el = show(`
    <header class="art-top"><button class="icon-btn glass" data-back aria-label="Back">${ICON.back}</button><button class="glass-pill" data-awindex>${ICON.explore}<span>Art history</span></button></header>
    <p class="eyebrow p-type">${kind === "movement" ? "Movement" : kind === "decade" ? "Decade" : "Country"}</p><h1 class="p-title">${esc(title)}</h1><p class="p-dek">${dek}</p>
    ${awHighlight(hlGi != null ? hlGi : -1, hlLine, hlChips)}
    <div class="sec-head"><b>The hue mix</b><span>${awBand(x.hh)} leads</span></div>
    ${awHueBars(x.hh, base)}
    <p class="aw-cap">Bars: this group's chromatic content by hue. Hairlines: the whole archive. Color only counts when it is strong enough to have a hue.</p>
    ${timeCols ? `<div class="sec-head"><b>The palette over time</b><span>${x.time.length} decades</span></div><p class="aw-sub">The three biggest colors of each decade's paintings (faint number: how many paintings; thin columns have fewer than 10).</p><div class="aw-decades">${timeCols}</div>` : ""}
    ${sig ? `<div class="sec-head"><b>Signature colors</b><span>vs the same museums</span></div><p class="aw-sub">Used more here than in other paintings from the same museums, so the museums' cameras and varnish cancel out.</p><div class="aw-sigs">${sig}</div>` : ""}
    ${dist.length ? `<div class="sec-head"><b>Against the whole archive</b><span>raw, as photographed</span></div><div class="aw-chips">${dist.map(t => awChipName(t.name, awHex(t.name), "×" + t.lift.toFixed(1))).join("")}</div>` : ""}
    ${(g.findings || []).length ? `<ul class="aw-finds">${g.findings.map(f => `<li>${esc(f)}</li>`).join("")}</ul>` : ""}
    ${arts ? `<div class="sec-head"><b>Key painters</b><span>most paintings here</span></div><div class="aw-near">${arts}</div>` : ""}
    <button class="btn ghost" data-awcolor="${anyHex}">Everything painted in ${esc(nameOf(anyHex).n.toLowerCase())} ${ICON.arrow}</button>
    ${pn}
    ${typeof linksHereHTML === "function" ? linksHereHTML({ id: kind + ":" + key, title }) : ""}
    <section class="srcs"><h3>Sources</h3><ul><li>Computed by ColorHub from ${n} museum photographs; screen colors, as photographed. The most typical painting is the one nearest the group's average lightness, chroma, warmth and color spread.</li>${srcNote}${kind === "movement" ? `<li>Movement tags: museum records, and Wikidata (CC0).</li>` : ""}</ul></section>`, "article aw-page");
  awWire(el);
  if (typeof wireLinks === "function") wireLinks(el);
  awFillHighlight(el);
}

// ======================================================================
// Art history by color (the index) and the painter finder
// ======================================================================
function awIndex(push = true) {
  if (!AW.ready) return awWait(awIndex, [push]);
  if (push) XSTACK.push("aw:index");
  const mvs = Object.keys(AW.grp.byMovement).sort((a, b) => AW.grp.byMovement[b].n - AW.grp.byMovement[a].n);
  const tile = (kind, k, g) => `<button class="aw-tile" data-awgroup="${kind}|${esc(k)}"><span class="aw-tp">${g.top.slice(0, 5).map(t => `<i style="--c:${awHex(t.name)}"></i>`).join("")}</span><b>${esc(k)}</b><em>${g.n.toLocaleString()} paintings</em></button>`;
  const cos = Object.keys(AW.grp.byCountry).sort((a, b) => AW.grp.byCountry[b].n - AW.grp.byCountry[a].n);
  const bubbles = BASICS.filter(c => c.n !== "Black" && c.n !== "White" && c.n !== "Grey").map(c => `<button class="aw-bub" data-awcolor="${c.h}" data-name="${esc(c.n)}" style="--c:${c.h}" aria-label="${esc(c.n)}"></button>`).join("");
  const el = show(`
    <header class="art-top"><button class="icon-btn glass" data-back aria-label="Back">${ICON.back}</button><button class="glass-pill" data-awsurprise>${ICON.dice}<span>Surprise me</span></button></header>
    <p class="eyebrow p-type">Art</p><h1 class="p-title">Art history by color</h1>
    <p class="p-dek">Every painting in the archive, read for color: by decade, movement, country and painter. As photographed.</p>
    <div class="sec-head"><b>The river of color</b><span>drag through time</span></div>
    <div class="aw-river" data-awriver>${typeof xbSkeleton === "function" ? xbSkeleton() : ""}</div>
    <div class="sec-head"><b>Everything painted in…</b><span>pick a color</span></div>
    <div class="aw-bubs">${bubbles}</div>
    <div class="sec-head"><b>Movements</b><span>${mvs.length} with enough data</span></div>
    <p class="aw-note">Only ${mvs.length} movements reach 20 paintings here. Museums record movements for few paintings, so most of the archive has none; we added Wikidata's tags for the painting and for the painter, and each page says which is which.</p>
    <div class="aw-tiles2">${mvs.map(k => tile("movement", k, AW.grp.byMovement[k])).join("")}</div>
    <div class="sec-head"><b>Countries</b><span>${cos.length}</span></div>
    <p class="aw-sub">Often the painter's nationality, not where the painting was made.</p>
    <div class="aw-tiles2">${cos.map(k => tile("country", k, AW.grp.byCountry[k])).join("")}</div>
    <div class="sec-head"><b>Painters</b><span>${AW.list.length}</span></div>
    <div data-awfind></div>
    <button class="btn ghost" data-awvs="">Painter against painter ${ICON.arrow}</button>`, "article aw-page");
  awWire(el);
  awFinder(el.querySelector("[data-awfind]"), s => awPainter(s));
  // Surprise me: a painter with enough paintings to say something (20 or more), at random
  el.querySelector("[data-awsurprise]").onclick = () => { const pool = AW.list.filter(m => m.k >= 20); buzz(8); awPainter(pool[Math.floor(Math.random() * pool.length)].slug); };
  awIndexRiver(el.querySelector("[data-awriver]"));
}
// Browse's River (js/browse-ui.js), real paint colors decade by decade, in place of the old lift timeline. Its
// decade panel's button opens that decade's page here instead of Browse's grid.
function awIndexRiver(host) {
  if (!host || typeof xbLoad !== "function" || typeof xbRiver !== "function") { if (host) host.remove(); return; }
  xbLoad().then(F => {
    if (!host.isConnected) return;
    host.innerHTML = "";
    xbRiver(host, F, xbRun(F, xbFresh()), { set: false, decBtn: yr => AW.grp.byDecade[yr] ? `<button class="btn ghost" data-awgroup="decade|${yr}">The ${yr}s, decade page ${ICON.arrow}</button>` : "" });
  }).catch(() => { if (host.isConnected) host.innerHTML = `<p class="fine">The river didn't load. Check the connection and open this page again.</p>`; });
}
// a search box over the painters; calls pick(slug)
function awFinder(host, pick, opts = {}) {
  host.innerHTML = `<input class="aw-input" type="search" placeholder="${opts.ph || "Search 837 painters"}" autocomplete="off" aria-label="Search painters"><div class="aw-results"></div>`;
  const inp = host.querySelector("input"), res = host.querySelector(".aw-results");
  const norm = s => routeSlug(s).replace(/-/g, "");
  const draw = () => {
    const q = norm(inp.value), list = q ? AW.list.filter(m => norm(m.n).includes(q)).slice(0, 24) : AW.list.slice(0, opts.n || 10);
    res.innerHTML = list.map(m => `<button class="aw-res" data-pick="${m.slug}"><b>${esc(m.n)}</b><span>${[m.b != null ? awY(m.b) + "–" + (m.d != null ? awY(m.d) : "") : m.y0 ? m.y0 + "–" + m.y1 : "", m.co].filter(Boolean).join(" · ")}</span><em>${m.k}</em></button>`).join("") || `<p class="fine">No painter by that name.</p>`;
  };
  inp.oninput = draw; draw();
  res.onclick = e => { const b = e.target.closest("[data-pick]"); if (b) pick(b.dataset.pick); };
}

// ======================================================================
// Painter against painter
// ======================================================================
function awVs(a, b, push = true) {
  if (!AW.ready || (a && !AW.P.has(a)) || (b && !AW.P.has(b))) return awWait(awVs, [a, b, push], () => Promise.all([a && awPainterLoad(a), b && awPainterLoad(b)]));
  if (push) XSTACK.push("aw:vs:" + (a || "") + ":" + (b || ""));
  const pick = (which, slug) => which === 0 ? awVs(slug, b, true) : awVs(a, slug, true);
  const slot = (s, which) => s ? `<div class="aw-vs-c">${AW.meta.a[s].img ? `<img class="aw-portrait sm" src="https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(AW.meta.a[s].img)}?width=200" alt="" onerror="this.remove()">` : ""}<b>${esc(AW.meta.a[s].n)}</b><span>${awVsDates(AW.meta.a[s])}</span><button class="aw-link" data-awswap="${which}">change</button></div>` : `<div class="aw-vs-c empty"><b>Choose painter ${which + 1}</b><div data-awfind="${which}"></div></div>`;
  let body = "";
  if (a && b) body = awVsBody(a, b);
  else body = `<p class="aw-sub">Pick two painters to put their palettes side by side.</p>`;
  const el = show(`
    <header class="art-top"><button class="icon-btn glass" data-back aria-label="Back">${ICON.back}</button><button class="glass-pill" data-awindex>${ICON.explore}<span>Art history</span></button></header>
    <p class="eyebrow p-type">Compare</p><h1 class="p-title">Painter against painter</h1>
    <div class="aw-vs">${slot(a, 0)}${slot(b, 1)}</div>${body}`, "article aw-page");
  awWire(el);
  el.querySelectorAll("[data-awfind]").forEach(h => awFinder(h, s => pick(+h.dataset.awfind, s), { n: 6 }));
  el.querySelectorAll("[data-awswap]").forEach(btn => btn.onclick = () => (+btn.dataset.awswap === 0 ? awVs("", b, false) : awVs(a, "", false)));
}
const awVsDates = m => m.b != null ? `${awY(m.b)}–${m.d != null ? awY(m.d) : ""}` : (m.y0 ? m.y0 + "–" + m.y1 : "");
function awVsBody(a, b) {
  const X = AW.P.get(a), Y = AW.P.get(b), ma = AW.meta.a[a], mb = AW.meta.a[b], sa = AW.stats[a], sb = AW.stats[b];
  const two = (label, key, va, vb, lo, hi) => { const pa = AW.pl[key].filter(x => x < va).length / AW.pl[key].length, pb = AW.pl[key].filter(x => x < vb).length / AW.pl[key].length;
    return `<div class="aw-pbar"><div class="aw-pb-h"><b>${label}</b><span>${lo} ← → ${hi}</span></div><div class="aw-track"><i class="a" style="left:${(pa * 100).toFixed(1)}%"></i><i class="b" style="left:${(pb * 100).toFixed(1)}%"></i></div><p class="aw-cap">${awPct(pa)}th percentile vs ${awPct(pb)}th</p></div>`; };
  const cl = (A, m) => (A.A.clusters || []).map(c => `<div class="aw-vcl">${awStrip(c.colors.map(awHex), 22)}<em>${awPct(c.pct / 100)}%</em></div>`).join("") || `<p class="fine">No palette families (fewer than 12 paintings).</p>`;
  const sg = (A) => (A.P.sig || []).slice(0, 4).map(([c, lift]) => { const [nm, hx] = awCol(c); return awChipName(nm, hx, "×" + lift.toFixed(1)); }).join("") || `<p class="fine">None clear (fewer than 10 paintings, or nothing above the museums' baseline).</p>`;
  // shared: colors on both signature lists or both clusters
  const setOf = A => new Set([...(A.P.sig || []).map(s => awCol(s[0])[0]), ...(A.A.clusters || []).flatMap(c => c.colors)].map(awCanon));
  const sa2 = setOf(X), sb2 = setOf(Y), shared = [...new Set([...(X.A.clusters || []).flatMap(c => c.colors), ...(X.P.sig || []).map(s => awCol(s[0])[0])])].filter(n => sb2.has(awCanon(n))).slice(0, 8);
  const dist = (() => { const z = k => { const arr = AW.list.map(m => m[k]).filter(v => v != null), mu = arr.reduce((s, v) => s + v, 0) / arr.length, sd = Math.sqrt(arr.reduce((s, v) => s + (v - mu) ** 2, 0) / arr.length) || 1; return [mu, sd]; };
    const Z = ["L", "C", "W"].map(z); return Math.sqrt(["L", "C", "W"].reduce((s, k, j) => s + (((ma[k] - mb[k]) / Z[j][1]) ** 2), 0)); })();
  const rank = AW.list.filter(m => m.slug !== a && Math.sqrt(["L", "C", "W"].reduce((s, k) => s + (m[k] - ma[k]) ** 2, 0)) < Math.sqrt(["L", "C", "W"].reduce((s, k) => s + (mb[k] - ma[k]) ** 2, 0))).length + 1;
  const word = dist < .8 ? "very close" : dist < 1.6 ? "similar" : dist < 2.6 ? "different" : "far apart";
  return `<div class="sec-head"><b>Palette families</b><span>share of each painter's work</span></div>
    <div class="aw-vs2"><div>${cl(X, ma)}</div><div>${cl(Y, mb)}</div></div>
    <div class="sec-head"><b>Measured</b><span>percentile among ${AW.list.length} painters</span></div>
    <p class="aw-legend"><i class="a"></i>${esc(ma.n)} <i class="b"></i>${esc(mb.n)}</p>
    ${two("Value key", "L", ma.L, mb.L, "darker", "lighter")}${two("Chroma", "C", ma.C, mb.C, "quieter", "more colorful")}${two("Warmth", "W", ma.W, mb.W, "cooler", "warmer")}${two("Contrast", "ct", sa[0], sb[0], "flatter", "more contrast")}${two("Vividness", "vv", sa[1], sb[1], "less vivid", "more vivid")}
    <div class="sec-head"><b>Signature colors</b><span>vs the same museums</span></div>
    <div class="aw-vs2"><div class="aw-chips">${sg(X)}</div><div class="aw-chips">${sg(Y)}</div></div>
    ${shared.length ? `<p class="aw-lbl">Both reach for</p><div class="aw-chips">${shared.map(n => awChipName(n, awHex(n))).join("")}</div>` : `<p class="aw-sub">No color appears in both painters' palette families or signatures.</p>`}
    <p class="aw-find">By lightness, chroma and warmth their palettes are ${word} (${esc(mb.n)} is ${esc(ma.n)}'s ${rank}${rank % 10 === 1 && rank !== 11 ? "st" : rank % 10 === 2 && rank !== 12 ? "nd" : rank % 10 === 3 && rank !== 13 ? "rd" : "th"} nearest of ${AW.list.length - 1}). From ${ma.k} and ${mb.k} paintings, as photographed.</p>`;
}

// ======================================================================
// wiring, routes, back
// ======================================================================
function awWire(el) {
  el.querySelector("[data-back]").onclick = xBack;
  onKey = e => { if (e.key === "Escape") xBack(); };
  el.addEventListener("click", e => {
    const g = e.target.closest("[data-gi]");
    if (g && +g.dataset.gi >= 0) return galleryPage(+g.dataset.gi, true);
    const c = e.target.closest("[data-awcolor]");
    if (c) return artOpenColor(c.dataset.awcolor, c.dataset.name || nameOf(c.dataset.awcolor).n);
  });
}
// elements anywhere in the app (the painting page, Explore's Art) that open these screens
document.addEventListener("click", e => {
  const p = e.target.closest("[data-awpainter]"); if (p) { e.preventDefault(); e.stopPropagation(); return awPainter(p.dataset.awpainter); }
  const g = e.target.closest("[data-awgroup]"); if (g) { e.preventDefault(); const [k, v] = g.dataset.awgroup.split("|"); return awGroup(k, k === "decade" ? +v : v); }
  const ix = e.target.closest("[data-awindex]"); if (ix) { e.preventDefault(); return awIndex(); }
  const vs = e.target.closest("[data-awvs]"); if (vs) { e.preventDefault(); return awVs(vs.dataset.awvs || "", ""); }
});
function awStep(tok) {
  const [, kind, a, b] = tok.split(":");
  if (kind === "painter") return awPainter(a, false);
  if (kind === "group") return awGroup(a, a === "decade" ? +b : b, false);
  if (kind === "index") return awIndex(false);
  if (kind === "vs") return awVs(a, b, false);
}
function awOpenRoute(kind, id, more) {
  const run = () => {
    if (kind === "painter") return AW.meta.a[id] ? awPainter(id) : go(S.tab || "learn");
    if (kind === "arthistory") return awIndex();
    if (kind === "painters") return awVs(id && AW.meta.a[id] ? id : "", more && AW.meta.a[more] ? more : "");
    const key = awGroupKeys(kind).find(k => routeSlug(k) === routeSlug(id));
    if (key == null) return go(S.tab || "learn");
    return awGroup(kind, kind === "decade" ? +key : key);
  };
  if (AW.ready) return run();
  ROUTE_NEXT = routed("", kind + (id ? "/" + id : ""));
  waitScreen(); ROUTE_REPLACE = true;
  awLoad().then(run).catch(() => go(S.tab || "learn"));
}
// A painting photo that fails to load (offline, a museum link gone) leaves its quiet frame, never the browser's
// broken-image icon.
document.addEventListener("error", e => { const t = e.target; if (t && t.tagName === "IMG" && t.closest && t.closest(".aw-page")) t.style.visibility = "hidden"; }, true);
// titles for the router (js/router.js): the name once the list is here
const awTitle = (kind, key) => { try { return kind === "painter" ? AW.meta.a[key].n : kind === "decade" ? awDec(key) : String(key); } catch (e) { return String(key); } };
