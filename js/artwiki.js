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
//   data/analysis/                 the analysis engine's own files (tools/analyze.py, research/ANALYSIS.md)
// Honesty, said once and meant everywhere: every number is "as photographed" (aged varnish, museum cameras), carries
// its n, and a small sample says so or stays quiet. The archive reads brown, so a painter's signature is measured
// against the SAME museums' other paintings, and a second lens looks at roles inside one canvas (focal, accent,
// hidden, glue), which varnish cannot fake (design/GENIUS-PANEL-1.md §2.4).
//
// Hooks other lanes can fill (all optional; nothing renders if they're absent):
//   bioSlot(slug)            -> Promise<html>, reads data/artists/bios/<slug>.json (the article engine writes these)
//   paintingLesson(gi)       -> "Learn this painting" (js/practice.js PR_STEPS); the button appears when it exists
//   lmYouAndPainter(slug)    -> html for the "You and this painter" line (js/learner.js)
//   whosePalette(slug)       -> the Train quiz, opened on this painter (L10)

const AW_DIR = "data/artists/", AW_AN = "data/analysis/";
const AW = { meta: null, stats: null, ge: null, grp: null, idx: null, ready: false, loading: null, P: new Map(), A: new Map(), SH: new Map(), pl: null, list: null, nh: null, ids: null };
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
    typeof loadCoreNames === "function" ? loadCoreNames() : Promise.resolve(), loadGallery()]).then(([meta, stats, ge, grp]) => {
    AW.meta = meta; AW.stats = stats; AW.ge = ge; AW.grp = grp;
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
// Painter pages
// ======================================================================
function awPainter(slug, push = true) {
  if (!AW.ready || !AW.P.has(slug)) return awWait(awPainter, [slug, push], () => awPainterLoad(slug));
  const m = AW.meta.a[slug], { A, P } = AW.P.get(slug);
  if (!m) { toast("No data for this painter"); return go(xFallbackTab()); }
  if (push) XSTACK.push("aw:painter:" + slug);
  const n = A.n, small = n < 10, fileUrl = m.img ? "https://commons.wikimedia.org/wiki/Special:FilePath/" + encodeURIComponent(m.img) + "?width=320" : "";
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

  // findings, in words, always with n
  const finds = awPainterFindings(A, P, n);
  const el = show(`
    <header class="art-top"><button class="icon-btn glass" data-back aria-label="Back">${ICON.back}</button><button class="glass-pill" data-awvs="${esc(slug)}">${ICON.search}<span>Compare</span></button></header>
    <div class="aw-head"><div><p class="eyebrow p-type">Painter</p><h1 class="p-title">${esc(A.name)}</h1><p class="p-dek">${dek}</p></div>${fileUrl ? `<img class="aw-portrait" src="${esc(fileUrl)}" alt="" loading="lazy" onerror="this.remove()">` : ""}</div>
    ${A.barcode.length ? `<div class="aw-bcwrap"><div class="aw-bc ${A.barcode.length > 90 ? "tight" : ""}" role="img" aria-label="Every painting, oldest to newest, three main colors each">${A.barcode.map((b, k) => `<button data-gi="${P.ix.length === A.barcode.length ? P.ix[k] : -1}" title="${esc(b[1])}">${b[2].map(nm => `<i style="--c:${awHex(nm)}"></i>`).join("")}</button>`).join("")}</div>
      <div class="aw-bcax"><span>${A.barcode[0][1]}</span><em>${n} paintings · as photographed</em><span>${A.barcode[A.barcode.length - 1][1]}</span></div>
      ${clusters.length > 1 ? `<div class="aw-rooms">${clusters.map((c, k) => `<a class="aw-room" href="#aw-pal">${awStrip(c.colors.slice(0, 3).map(awHex), 8)}<b data-glroom="${P.ctyp[k]}">Room ${k + 1}</b><em>${awPct(c.pct / 100)}%</em></a>`).join("")}</div>` : ""}</div>` : ""}
    ${finds}
    <div data-awbio></div>
    <div class="aw-you" data-aw-you></div>
    ${palettes}
    ${colors}
    ${time}
    ${compared}
    <div class="aw-acts" data-aw-acts></div>
    <section class="srcs"><h3>Sources</h3><ul>
      <li>Colors measured by ColorHub from museum photographs (${A.n} paintings by ${esc(A.name)} in the archive); every figure is as photographed, screen color only.</li>
      ${m.q ? `<li>Dates, nationality, movement, teachers and portrait: <a href="https://www.wikidata.org/wiki/${m.q}" target="_blank" rel="noopener">Wikidata</a> (CC0)${m.wp ? ` · <a href="https://en.wikipedia.org/wiki/${encodeURIComponent(m.wp)}" target="_blank" rel="noopener">Wikipedia</a>` : ""}${m.img ? ` · portrait: <a href="https://commons.wikimedia.org/wiki/File:${encodeURIComponent(m.img)}" target="_blank" rel="noopener">Wikimedia Commons</a>` : ""}</li>` : `<li>No Wikidata match was found for this name, so dates come from the paintings themselves.</li>`}
    </ul></section>`, "article aw-page");
  awWire(el);
  if (typeof ptPainterColors === "function") ptPainterColors(el, A.name);   // js/paintingsof.js (L26): colors used in a quarter of the works
  // titles and images of the clusters' typical paintings
  el.querySelectorAll("[data-gltitle]").forEach(t => { const i = +t.dataset.gltitle; if (i >= 0) glDetail(i).then(d => { if (t.isConnected) t.textContent = "The " + d.t.replace(/^(the|a|an)\s+/i, "") + " palette"; const im = el.querySelector(`[data-glimg="${i}"]`); if (im) { im.src = d.img; } }).catch(() => {}); });
  el.querySelectorAll("[data-glroom]").forEach(t => { const i = +t.dataset.glroom; if (i >= 0) glDetail(i).then(d => { if (t.isConnected) t.textContent = d.t.length > 26 ? d.t.slice(0, 25) + "…" : d.t; }).catch(() => {}); });
  el.querySelectorAll("[data-glimg]").forEach(im => { const i = +im.dataset.glimg; if (i >= 0) glDetail(i).then(d => { if (im.isConnected) im.src = d.img; }).catch(() => {}); });
  el.querySelectorAll("[data-gltypical]").forEach(w => { const i = +w.dataset.gltypical; if (i >= 0) glDetail(i).then(d => { if (!w.isConnected) return; const im = w.querySelector("img"); im.src = d.img; w.querySelector("b").textContent = d.t; }).catch(() => {}); });
  bioSlot(slug).then(h => { const s = el.querySelector("[data-awbio]"); if (s && h) s.innerHTML = h; });
  // "You and this painter" (js/learner.js knowState): how many of this painter's cluster and signature colors you've met or own
  const you = el.querySelector("[data-aw-you]");
  try {
    if (typeof lmYouAndPainter === "function") { const h = lmYouAndPainter(slug); if (h) you.innerHTML = h; }
    else if (typeof knowState === "function") {
      const names = [...new Set([...(A.clusters || []).flatMap(c => c.colors), ...(P.sig || []).map(r => awCol(r[0])[0])].map(awCanon))];
      const hexes = names.map(k => { const e = (CORE_NAMES || []).find(x => awCanon(x.n) === k); return e && e.h; }).filter(Boolean);
      const st = hexes.map(h => knowState(h)), yours = st.filter(x => x === "yours").length, met = st.filter(x => x !== "none").length;
      if (hexes.length >= 4) you.innerHTML = `<p class="aw-find">${yours ? `${yours} of the ${hexes.length} colors in these palettes are Yours` : met ? `You've met ${met} of the ${hexes.length} colors in these palettes` : `None of the ${hexes.length} colors in these palettes are Yours yet`}${met > yours ? `, ${met - yours} more met.` : "."}</p>`;
    }
  } catch (e) {}
  const acts = el.querySelector("[data-aw-acts]");
  if (typeof colorSet === "function" && typeof csActions === "function") {
    const hx = [...new Set([...(A.clusters || []).flatMap(c => c.colors.slice(0, 3)), ...(P.sig || []).map(r => awCol(r[0])[0])])].map(awHex).filter(h => h !== "#808080");
    acts.appendChild(csActions(colorSet({ kind: "painter", id: slug, title: A.name, colors: hx.map(h => ({ h })), src: "painter/" + slug }), { back: () => awPainter(slug, false) }));
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

function awTimeSection(A, P) {
  const bc = A.barcode;
  if (bc.length < 6) return "";
  const byDec = new Map();
  bc.forEach(b => { const d = Math.floor(b[1] / 10) * 10; if (!byDec.has(d)) byDec.set(d, new Map()); const mp = byDec.get(d); b[2].forEach(nm => mp.set(awCanon(nm), [(mp.get(awCanon(nm)) || [nm, 0])[0], (mp.get(awCanon(nm)) || [nm, 0])[1] + 1])); });
  const decs = (A.byDecade || []).filter(d => d.n >= 1);
  if (decs.length < 2) return "";
  const cols = [...byDec.entries()].sort((a, b) => a[0] - b[0]).map(([d, mp]) => {
    const tops = [...mp.values()].sort((a, b) => b[1] - a[1]).slice(0, 4), tot = tops.reduce((s, t) => s + t[1], 0) || 1, n = (decs.find(x => x.decade === d) || {}).n || 0;
    return `<div class="aw-dcol${n < 3 ? " thin" : ""}"><span class="aw-dstack">${tops.map(t => `<i style="--c:${awHex(t[0])};flex:${t[1]}" data-swatch="${awHex(t[0])}" title="${esc(t[0])}"></i>`).join("")}</span><em>${String(d).slice(2)}s</em><u>${n}</u></div>`;
  }).join("");
  const cp = A.changePoint, dn = d => (decs.find(x => x.decade === d) || {}).n || 0;
  let cpText = "";
  if (cp) {
    const lighter = cp.after > cp.before, prev = decs.filter(x => x.decade < cp.decade).pop(), pn = prev ? prev.n : 0, nn = dn(cp.decade);
    cpText = `<p class="aw-find">The palette ${lighter ? "lightens" : "darkens"} around the ${awDec(cp.decade)}: mean lightness ${cp.before} before, ${cp.after} after (${pn} and ${nn} paintings${Math.min(pn, nn) < 5 ? "; small groups, so a hint rather than a finding" : ""}).</p>`;
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
    <div class="aw-typs">${typ(P.typical, "Most typical")}${typ(P.atypical, "Least typical")}</div>
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

// ======================================================================
// Painting pages: the Analysis section (called from js/gallery.js glPage)
// ======================================================================
function awPaintingHook(el, i, d, ctx) {
  // 1. the artist's name becomes a link once the painter list is here (it loads quietly, once)
  if (d.a) {
    const slug = routeSlug(d.a), dek = el.querySelector(".p-dek");
    awLoad().then(() => {
      if (!el.isConnected || !dek || !awHasPainter(slug)) return;
      const parts = [`<button class="aw-link" data-awpainter="${slug}">${esc(d.a)}</button>`, d.co, d.mv].filter(Boolean).map((x, k) => k ? esc(x) : x);
      dek.innerHTML = parts.join(" · ");
    }).catch(() => {});
  }
  const host = el.querySelector("[data-awan]"); if (!host) return;
  awShard(i).then(rows => {
    const r = rows[i % 100];
    if (!r || r.id !== d.id || !host.isConnected) return;
    awAnalysis(host, el, i, d, r, ctx);
  }).catch(() => { host.innerHTML = ""; });
}
function awAnalysis(host, el, i, d, r, ctx) {
  const st = r.stat, pool = ctx.pool, curPal = ctx.curPal;
  const Lh = awUnb64(st.Lh), hh = awUnb64(st.hh);
  const pf = r.pct || {}, fin = awGateFinds(r.find, 3);
  const warm = st.wf / 1000, ch = st.ch.map(v => v / 1000);
  const pc = (v, base, lo, hi, nTxt) => v == null || (v > 35 && v < 65) ? "" : `${v >= 50 ? hi : lo} than ${v >= 50 ? Math.round(v) : Math.round(100 - v)}% of ${nTxt}`;
  const lightTxt = [pc(pf.a, 0, "Darker", "Lighter", "the 23,531 paintings here"), pf.p != null && pf.pn ? pc(pf.p, 0, "darker", "lighter", `this painter's other ${pf.pn - 1}`) : ""].filter(Boolean).join(" · ");
  const roles = ["foc", "hid", "glu"];
  const poolOK = pool.length >= 6;
  host.innerHTML = `
    <div class="sec-head"><b>Analysis</b><span>as photographed</span></div>
    <p class="aw-sub">Many readings of one painting, from the museum photo. Tap any color to open its page.</p>
    <div class="aw-tiles">
      <div><span>Value key</span><b>${AW_KEYWORD[st.key] || st.key}</b><em>mean lightness ${st.Lm}</em></div>
      <div><span>Contrast</span><b>${st.ct}</b><em>lightness range, 5th to 95th percentile (${st.p5}–${st.p95})</em></div>
      <div><span>Vivid</span><b>${awPct(ch[2])}%</b><em>${awPct(ch[0])}% muted · ${awPct(ch[1])}% moderate</em></div>
      <div><span>Warm / cool</span><b>${awPct(warm)}% warm</b><em>by chroma-weighted hue</em></div>
    </div>
    ${lightTxt ? `<p class="aw-find">${esc(lightTxt)}.</p>` : ""}
    ${poolOK ? `<div class="aw-look" data-awlook></div>` : ""}
    ${(typeof paintingLesson === "function") ? `<button class="btn" data-awlesson>Learn this painting${ICON.arrow}</button>` : ""}
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
    ${fin.length ? `<details class="aw-more" open><summary>Findings</summary><ul class="aw-finds">${fin.map(f => `<li>${esc(f)}</li>`).join("")}</ul></details>` : ""}
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
  // the guided look
  if (poolOK) awGuided(host.querySelector("[data-awlook]"), i, d, r, pool);
  const les = host.querySelector("[data-awlesson]"); if (les) les.onclick = () => paintingLesson(i);
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

// the guided look: three stops, each one a guess first, then the reveal
function awGuided(host, i, d, r, pool) {
  const hash2 = (a, b) => Math.imul(a * 2654435761 ^ b * 40503, 2246822519) >>> 0;
  const stops = [
    { k: "foc", pos: r.foc, q: "Where does your eye land first?", sub: "Pick the color that pulls hardest.", why: "The focal color: strong, and set apart from the painting's average lightness. A computed guess, not eye-tracking." },
    { k: "hid", pos: (r.hid || [])[0], q: "One color hides here. Which?", sub: "Muted, from a different family than the rest.", why: "A hidden color is quiet and sits outside the painting's main family, like the greens that shade skin." },
    { k: "glu", pos: r.glu, q: "Which color holds the painting together?", sub: "The tone everything rests on.", why: "The glue: the biggest mid-tone, between the lights and the darks." },
  ].filter(s => s.pos != null && pool[s.pos]);
  if (stops.length < 2) { host.remove(); return; }
  let at = 0, done = 0;
  const optsFor = (s, n) => {
    const ans = pool[s.pos], others = pool.map((p, k) => ({ p, k })).filter(o => o.k !== s.pos && de2000(o.p.h, ans.h) > 9 && o.p.share > .004);
    others.sort((a, b) => hash2(i + s.pos, a.k) - hash2(i + s.pos, b.k));
    const pick = []; for (const o of others) { if (pick.every(q => de2000(q.p.h, o.p.h) > 7)) pick.push(o); if (pick.length >= 3) break; }
    const all = [{ p: ans, k: s.pos, ok: true }, ...pick.map(o => ({ ...o, ok: false }))];
    return all.sort((a, b) => hash2(i * 7 + s.pos, a.k) - hash2(i * 7 + s.pos, b.k));
  };
  const paint = () => {
    if (!host.isConnected) return;
    if (at >= stops.length) { host.innerHTML = `<div class="aw-lookdone"><b>You looked three ways.</b><span>${done} of ${stops.length} first guesses right. Tap any swatch in the readings below to open it.</span><button class="aw-link" data-awagain>Look again</button></div>`; host.querySelector("[data-awagain]").onclick = () => { at = 0; done = 0; paint(); }; return; }
    const s = stops[at], opts = optsFor(s);
    host.innerHTML = `<div class="aw-look-h"><span>A guided look · ${at + 1} of ${stops.length}</span></div><p class="aw-look-q">${s.q}</p><p class="aw-look-s">${s.sub}</p>
      <div class="aw-opts">${opts.map((o, k) => `<button class="aw-opt" data-k="${k}" style="--c:${o.p.h}" data-ink="${ink(o.p.h)}" aria-label="Option ${k + 1}"></button>`).join("")}</div><div class="aw-reveal" data-reveal></div>`;
    host.querySelector(".aw-opts").onclick = e => {
      const b = e.target.closest(".aw-opt"); if (!b || host.classList.contains("shown" + at)) return;
      host.classList.add("shown" + at);
      const o = opts[+b.dataset.k], nmOf = p => nameOf(p.h);
      if (o.ok) done++;
      if (typeof lmLog === "function") { try { const nm = nmOf(pool[s.pos]); lmLog({ t: Date.now(), k: o.ok ? "recall_ok" : "recall_miss", c: routeSlug(nm.n), surf: "painting", ref: d.id }); } catch (e) {} }
      host.querySelectorAll(".aw-opt").forEach((x, k) => { const oo = opts[k]; x.setAttribute("data-swatch", oo.p.h); x.classList.toggle("right", oo.ok); x.classList.toggle("miss", x === b && !oo.ok); x.innerHTML = `<span>${esc(nmOf(oo.p).text)}</span>`; });
      const nm = nmOf(pool[s.pos]), near = (typeof BYNAME !== "undefined") ? BYNAME.get(nm.n.toLowerCase()) : null;
      host.querySelector("[data-reveal]").innerHTML = `<p><b>${o.ok ? "Yes. " : "Not quite. "}${esc(nm.text)}</b>, ${awPct(pool[s.pos].share) || "under 1"}% of the canvas.${near ? " One of the words you can learn." : ""}</p><p class="fine">${s.why}</p><button class="btn ghost" data-next>${at + 1 < stops.length ? "Next stop" : "Finish"} ${ICON.arrow}</button>`;
      host.querySelector("[data-next]").onclick = () => { at++; paint(); };
      buzz(o.ok ? 8 : 4);
    };
  };
  paint();
}

// ======================================================================
// Movement, decade and country pages
// ======================================================================
function awGroupKeys(kind) { return Object.keys(kind === "movement" ? AW.grp.byMovement : kind === "decade" ? AW.grp.byDecade : AW.grp.byCountry); }
function awGroup(kind, key, push = true) {
  if (!AW.ready) return awWait(awGroup, [kind, key, push]);
  const gs = kind === "movement" ? AW.grp.byMovement : kind === "decade" ? AW.grp.byDecade : AW.grp.byCountry, ges = kind === "movement" ? AW.ge.byMovement : kind === "decade" ? AW.ge.byDecade : AW.ge.byCountry;
  const g = gs[String(key)], x = ges[String(key)];
  if (!g || !x) { toast("No page for that"); return go(xFallbackTab()); }
  if (push) XSTACK.push("aw:group:" + kind + ":" + key);
  const title = kind === "decade" ? awDec(key) : String(key), n = g.n;
  let dek = `${n.toLocaleString()} paintings, as photographed`;
  let note = "";
  if (kind === "movement") {
    const t = g.tiers || [n, 0, 0];
    dek = `${n.toLocaleString()} paintings tagged ${title}`;
    note = `<p class="aw-note">How these were tagged: ${t[0]} by the museum, ${t[1]} by Wikidata for the painting itself, ${t[2]} only because their painter is recorded with this movement (a looser link). Only ${Object.keys(AW.grp.byMovement).length} movements reach 20 paintings here; most paintings in the archive carry no movement at all, so this is a sample of ${title}, not the whole of it.</p>`;
  } else if (kind === "country") note = `<p class="aw-note">Country is often the painter's nationality, not where the painting was made.</p>`;
  else note = `<p class="aw-note">Dated ${key}–${key + 9}. Undated and approximately dated works are left out.</p>`;
  const top = g.top.slice(0, 8), dist = (g.distinctive || []).slice(0, 6), base = AW.ge.archive.hh;
  const timeCols = (x.time || []).map(t => { const tops = t[3]; return `<div class="aw-dcol${t[1] < 10 ? " thin" : ""}"><span class="aw-dstack">${tops.map((c, k) => `<i style="--c:${awCol(c)[1]};flex:${3 - k}" data-swatch="${awCol(c)[1]}" title="${esc(awCol(c)[0])}"></i>`).join("")}</span><em>${String(t[0]).slice(2)}s</em><u>${t[1]}</u></div>`; }).join("");
  const sig = (x.sig || []).map(([c, lift, own, sup]) => { const [nm, hx] = awCol(c); return `<button class="aw-sig" data-swatch="${hx}"><i style="--c:${hx}" data-ink="${ink(hx)}"></i><b>${esc(nm)}</b><span>×${lift.toFixed(1)}</span><em>in ${sup} of ${n} paintings · ${awPct(own)}% of the canvas</em></button>`; }).join("");
  const arts = (x.art || []).map(([s, k]) => AW.meta.a[s] ? `<button class="aw-tie" data-awpainter="${s}"><b>${esc(AW.meta.a[s].n)}</b><span>${k} paintings here</span></button>` : "").join("");
  const decs = awGroupKeys("decade").map(Number).sort((a, b) => a - b), di = decs.indexOf(+key);
  const pn = kind === "decade" ? `<div class="aw-pn">${di > 0 ? `<button class="aw-link" data-awgroup="decade|${decs[di - 1]}">‹ ${awDec(decs[di - 1])}</button>` : "<span></span>"}${di < decs.length - 1 ? `<button class="aw-link" data-awgroup="decade|${decs[di + 1]}">${awDec(decs[di + 1])} ›</button>` : ""}</div>` : "";
  const anyHex = dist[0] ? awHex(dist[0].name) : awHex(top[0].name);
  const el = show(`
    <header class="art-top"><button class="icon-btn glass" data-back aria-label="Back">${ICON.back}</button><button class="glass-pill" data-awindex>${ICON.explore}<span>Art history</span></button></header>
    <p class="eyebrow p-type">${kind === "movement" ? "Movement" : kind === "decade" ? "Decade" : "Country"}</p><h1 class="p-title">${esc(title)}</h1><p class="p-dek">${dek}</p>
    ${note}
    <div class="palette aw-gpal">${top.map(t => `<button class="pal" data-swatch="${awHex(t.name)}" style="--c:${awHex(t.name)};flex:${Math.max(t.share, .004) / Math.max(.01, top.reduce((a, b) => a + b.share, 0)) * 100}" data-ink="${ink(awHex(t.name))}"></button>`).join("")}</div>
    <div class="pal-names">${top.map(t => `<button class="pal-name" data-swatch="${awHex(t.name)}"><i style="--c:${awHex(t.name)}"></i><b>${esc(t.name)}</b><span>${(t.share * 100).toFixed(1)}% of the average canvas</span><em class="mono">${awHex(t.name)}</em></button>`).join("")}</div>
    <p class="fine">The biggest colors by area, as photographed. These are mostly the dark browns of aged varnish; the sections below correct for that.</p>
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
    <section class="srcs"><h3>Sources</h3><ul><li>Computed by ColorHub from ${n} museum photographs; screen colors, as photographed.</li>${kind === "movement" ? `<li>Movement tags: museum records, and Wikidata (CC0).</li>` : ""}</ul></section>`, "article aw-page");
  awWire(el);
}

// ======================================================================
// Art history by color (the index) and the painter finder
// ======================================================================
function awIndex(push = true) {
  if (!AW.ready) return awWait(awIndex, [push]);
  if (push) XSTACK.push("aw:index");
  const base = AW.ge.archive.hh;
  const decs = awGroupKeys("decade").map(Number).sort((a, b) => a - b).filter(d => d >= 1250);
  const rows = decs.map((d, k) => {
    const g = AW.grp.byDecade[d], x = AW.ge.byDecade[d], tot = x.hh.reduce((s, v) => s + v, 0) || 1, Lg = Math.round(x.L * 2.55), cen = d % 100 === 0 || k === 0;
    return `${cen ? `<p class="aw-century">${Math.floor(d / 100) * 100}s</p>` : ""}<button class="aw-trow" data-awgroup="decade|${d}"><span class="aw-td">${awDec(d)}</span><i class="aw-tl" style="background:rgb(${Lg},${Lg},${Lg})" title="mean lightness ${x.L}"></i><span class="aw-tbar" title="${awBand(x.hh.map((v, b) => v / Math.max(base[b], .004)))} stands out">${x.hh.map((v, b) => `<u style="flex:${Math.min(4, Math.max(.12, v / Math.max(base[b], .004))).toFixed(2)};--c:${AW_BAND_HEX[b]}"></u>`).join("")}</span><em>${g.n}</em></button>`;
  }).join("");
  const mvs = Object.keys(AW.grp.byMovement).sort((a, b) => AW.grp.byMovement[b].n - AW.grp.byMovement[a].n);
  const tile = (kind, k, g) => `<button class="aw-tile" data-awgroup="${kind}|${esc(k)}"><span class="aw-tp">${g.top.slice(0, 5).map(t => `<i style="--c:${awHex(t.name)}"></i>`).join("")}</span><b>${esc(k)}</b><em>${g.n.toLocaleString()} paintings</em></button>`;
  const cos = Object.keys(AW.grp.byCountry).sort((a, b) => AW.grp.byCountry[b].n - AW.grp.byCountry[a].n);
  const bubbles = BASICS.filter(c => c.n !== "Black" && c.n !== "White" && c.n !== "Grey").map(c => `<button class="aw-bub" data-awcolor="${c.h}" data-name="${esc(c.n)}" style="--c:${c.h}" aria-label="${esc(c.n)}"></button>`).join("");
  const el = show(`
    <header class="art-top"><button class="icon-btn glass" data-back aria-label="Back">${ICON.back}</button></header>
    <p class="eyebrow p-type">Art</p><h1 class="p-title">Art history by color</h1>
    <p class="p-dek">Every painting in the archive, read for color: by decade, movement, country and painter. All figures are as photographed; the browns of aged varnish are in every row.</p>
    <div class="sec-head"><b>Everything painted in…</b><span>pick a color</span></div>
    <div class="aw-bubs">${bubbles}</div>
    <div class="sec-head"><b>A timeline of hue</b><span>decade by decade</span></div>
    <p class="aw-sub">Each bar shows which hues a decade has more of than the archive as a whole: a wide band means more than usual, a sliver means less. The grey chip is mean lightness; the number is how many paintings. Tap a decade.</p>
    <div class="aw-timeline">${rows}</div>
    <div class="aw-hueleg">${AW_BANDS.map((b, k) => `<span style="--c:${AW_BAND_HEX[k]}"><i></i>${b}</span>`).join("")}</div>
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
// titles for the router (js/router.js): the name once the list is here
const awTitle = (kind, key) => { try { return kind === "painter" ? AW.meta.a[key].n : kind === "decade" ? awDec(key) : String(key); } catch (e) { return String(key); } };
