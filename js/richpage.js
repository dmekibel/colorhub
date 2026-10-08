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
function rpTierLine(node, entry) {
  if (!node) return entry && entry.src ? rcTierLine(entry.src) : "";
  const first = RP_TIER[node.tier] || "", fs = node.fs && RP_FS[node.fs], second = fs && node.fy && node.fy > 0 ? fs(node.fy) : "";   // a negative year is a prehistoric pigment, not a word
  return first ? (second ? `${first} · ${second}` : first) : "";
}
const rpCap = s => s.charAt(0).toUpperCase() + s.slice(1);
// definition: the article's own first sentence, else the ISCC-NBS descriptor, else a differential definition from the nearest named neighbor
function rpDefinition(name, hex, node, art) {
  if (art && art.lede) { const s = art.lede.split(/(?<=[.!?])\s/)[0]; if (s.length <= 150) return { t: s, src: "From its story" }; }
  const own = BYNAME.get(String(name).toLowerCase()), ownLine = own && (own.o || own.d);   // a basic word's authored line beats a measured one
  if (ownLine) { const s = String(ownLine).split(/(?<=[.!?])\s/)[0]; if (s.length <= 150) return { t: s, src: "ColorHub" }; }
  if (node && node.iscc && node.iscc.n && node.iscc.de <= 5) return { t: `${rpCap(node.iscc.n)}.`, src: "ISCC-NBS, 1955" };
  const near = (CORE_NAMES || coreFallback()).map(e => ({ e, d: de2000(hex, e.lab || (e.lab = lab(e.h))) })).filter(x => x.e.n.toLowerCase() !== name.toLowerCase() && x.d >= 1.5).sort((a, b) => a.d - b.d)[0];
  if (!near || (node && node.tier === "basic-term")) return null;
  const diff = lookDiff({ h: near.e.h, n: near.e.n }, { h: hex, n: name });
  return { t: diff === "almost the same" ? `Almost the same as ${near.e.n.toLowerCase()}.` : `${rpCap(diff)} than ${near.e.n.toLowerCase()}.`, src: "Measured" };
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
function rpCoverFoot(name, hex, tapped, entry) {
  const id = "rp-cov-" + Math.random().toString(36).slice(2, 8), rel = rpRelation(name, tapped, entry && entry.h || hex);
  return { id, html: `${rel ? `<span class="cp-chip">${esc(rel)}</span>` : ""}
        <h1 class="rp-name">${esc(name)}</h1>
        <p class="rp-tier" data-rp-tier></p>
        <p class="rp-def" data-rp-def></p><p class="rp-defsrc" data-rp-defsrc></p>
        <button class="mono cp-hex" data-copy="${tapped || hex}">${tapped || hex}${tapped ? `<em> · ${pctMatch(de2000(tapped, hex))} to ${esc(name)}</em>` : ""}</button>` };
}
function rpCoverFill(el, name, hex, heroHex, entry) {
  const h1 = el.querySelector(".rp-name"); if (h1) { rpFitName(h1); if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => h1.isConnected && rpFitName(h1)); }
  Promise.all([rpGraph(name), rpArticles()]).then(([g, arts]) => {
    if (!el.isConnected) return;
    const art = arts.find(a => a[0] === g.slug || (a[6] || []).some(n => n.toLowerCase() === name.toLowerCase()));
    const tier = rpTierLine(g.node, entry), def = rpDefinition(name, hex, g.node, art && art[0] === g.slug ? { lede: art[5] } : null);
    const q = s => el.querySelector(s);
    if (q("[data-rp-tier]")) q("[data-rp-tier]").textContent = tier;
    if (def && q("[data-rp-def]")) { q("[data-rp-def]").textContent = def.t; q("[data-rp-defsrc]").textContent = def.src; }
    el.querySelectorAll(".rp-cov-hold").forEach(x => x.classList.add("in"));
  });
}

// ---------- the glance strip (a peek of it sits under the cover) ----------
const RP_ROLE = ["shadow", "mid-tone", "light", "accent"];
function rpGlanceCards(name, hex, g, reach) {
  const out = [], ar = g.fn && g.fn.ar, fact = k => ((g.fn && g.fn.facts) || []).find(f => f.k === k);
  if (reach && reach[0] > 10 && reach[3] === 0) out.push({ s: 100, w: "the paintings", fig: pctFmt(reach[0]), text: `No painting in our archive reaches it; the closest is ${pctDiff(reach[0])}. It's a modern color.`, door: "paint", swatch: reach[2] });
  const fsn = fact("first-seen");
  if (fsn && fsn.before_record && ar && ar.fs) { const m = /That is ([\d,]+) years before/.exec(fsn.t); if (m) out.push({ s: 90, w: "the paintings", fig: String(ar.fs.y), text: `First seen in our archive ${m[1]} years before the name's earliest record: a look-alike hue in an aged photograph, not proof of the pigment.`, door: "paint" }); }
  if (ar && ar.pc && ar.pc.lift >= 2.5 && ar.pc.obs >= 8) out.push({ s: 65, w: "the paintings", fig: `${ar.pc.y}s`, text: `Peaks in the ${ar.pc.y}s, at ${ar.pc.lift}× the rate the same museums would predict.`, door: "paint" });
  if (ar && ar.role && ar.n >= 20) { const mx = Math.max(...ar.role.slice(0, 4)), i = ar.role.indexOf(mx); if (mx >= 55) out.push({ s: 70, w: "the paintings", fig: `${mx}%`, text: `Inside a painting it most often plays the ${RP_ROLE[i]}.`, door: "paint" }); }
  if (ar && ar.rp != null && (ar.rp >= 90 || ar.rp <= 10)) out.push({ s: 60, w: "measured", fig: `${ar.rp}%`, text: ar.rp >= 90 ? "of the named colors are rarer than it in the archive." : "of the named colors are more common than it in the archive.", door: "paint" });
  const co = fact("company"); if (co) { const m = /lift ([\d.]+)/.exec(co.t); if (m) out.push({ s: 55, w: "the paintings", fig: `${m[1]}×`, text: co.t.split(/(?<=\))\./)[0].replace(/\s*\(lift.*$/, "") + ".", door: "company" }); }
  if (g.node && g.node.since && g.node.since.y) out.push({ s: 50, w: "the words", fig: g.node.since.y < 0 ? (g.node.since.y <= -10000 ? `about ${Math.abs(g.node.since.y).toLocaleString()} years ago` : `${Math.abs(g.node.since.y)} BCE`) : String(g.node.since.y), text: `${g.node.since.what}.`, door: "words" });
  if (g.fn && g.fn.ng && g.fn.ng.adj && g.fn.ng.adj.pk) out.push({ s: 45, w: "the words", fig: `${g.fn.ng.adj.pk}s`, text: "In printed English the word peaks then (Google Books, the color sense).", door: "words" });
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
    box.innerHTML = cards.map(c => `<button class="rp-card" data-rp-door="${c.door}"><small>${esc(c.w)}</small><b>${esc(c.fig)}</b><span>${esc(c.text)}</span></button>`).join("");
  });
  return `<div class="rp-glance rp-wait" id="${id}"><i></i><i></i></div>`;
}

// ---------- five field-note drawers ----------
function rpDrawer(id, title, body, head) {
  return `<details class="rp-drawer" data-rp-drawer="${id}"><summary><span class="rp-d-name">${esc(title)}</span><span class="rp-d-head" data-rp-head="${id}">${head || ""}</span><i aria-hidden="true"></i></summary><div class="rp-d-body">${body}</div></details>`;
}
function rpDrawersHTML(entry, name, hex, famC, paintHost) {
  const call = (f, ...a) => typeof f === "function" ? f(...a) : "";
  const paint = `${paintHost}${call(rcReachSection, name, hex)}${call(rcRoleSection, name, hex)}${call(rcPaintersSection, name, hex)}${call(rcWhenWhereSection, name, hex)}`;
  const words = `<div class="c-poems"></div>${call(archiveRows, entry, "books", famC)}`;
  const world = `${call(btRow, entry, famC)}${call(gmRow, entry, famC)}<section class="fx-in" data-world-in></section>${call(archiveRows, entry, "films", famC)}`;
  const measured = `${rcMeasuredHTML(hex)}${rcMixHTML(hex)}${rcHarmonyHTML(hex, name)}`;
  const [L, C] = lch(hex);
  rcPercentileCaches();
  const lp = rcPercentile(RC_LSORT, L), cp = rcPercentile(RC_CSORT, C);
  const mhead = `${lp >= 50 ? "Lighter" : "Darker"} than ${lp >= 50 ? lp : 100 - lp}% of named colors, ${cp >= 50 ? "more vivid" : "duller"} than ${cp >= 50 ? cp : 100 - cp}%.`;
  return `<section class="rp-notes"><div class="rp-notes-head"><h2>Field notes</h2><small>measured, as photographed</small></div>
    ${rpDrawer("paint", "In paintings", paint)}${rpDrawer("company", "Its company", rcPairedSection(name, hex))}${rpDrawer("words", "In words", words)}${rpDrawer("world", "In the world", world)}${rpDrawer("measured", "Measured", measured, esc(mhead))}</section>`;
}
function rpDrawersWire(el, name, hex) {
  if (typeof rcWireYou === "function") rcWireYou(el, name, hex);
  const drawers = [...el.querySelectorAll(".rp-drawer")];
  const open = (id, scroll) => { drawers.forEach(d => { const on = d.dataset.rpDrawer === id; if (on) d.open = true; else if (d.open) d.open = false; if (on && scroll) setTimeout(() => d.scrollIntoView({ block: "start", behavior: reduceMotion ? "auto" : "smooth" }), 30); }); };
  drawers.forEach(d => d.querySelector("summary").addEventListener("click", () => { if (!d.open) drawers.forEach(o => { if (o !== d) o.open = false; }); }));
  el.addEventListener("click", e => { const b = e.target.closest("[data-rp-door]"); if (!b) return; open(b.dataset.rpDoor, true); });
  // headlines, and a drawer with nothing in it is not drawn
  const head = (id, t) => { const h = el.querySelector(`[data-rp-head="${id}"]`); if (h && t && !h.textContent) h.textContent = t; };
  rpGraph(name).then(g => {
    const f = k => ((g.fn && g.fn.facts) || []).find(x => x.k === k), ar = g.fn && g.fn.ar;
    const sent = t => t && t.split(/(?<=[.!?])\s/)[0];
    const cen = f("century"), pres = f("presence"), role = f("role"), co = f("company"), word = f("word");
    head("paint", cen ? sent(cen.t).replace(/:.*$/, ".") : pres ? sent(pres.t) : "");
    head("company", co ? sent(co.t) : "");
    head("words", word ? sent(word.t) : g.node && g.node.since ? `${g.node.since.what}.` : "");
  });
  const settle = () => {
    drawers.forEach(d => {
      const id = d.dataset.rpDrawer, body = d.querySelector(".rp-d-body");
      if (id === "measured") return;
      const has = body.textContent.replace(/\s+/g, "").length > 30 || body.querySelector("img,.gl-pin,.kin,.pm-q,.arch-quote,.film-row,.wd-in");
      d.hidden = !has;
      if (has && id === "world" && typeof csActions === "function" && typeof colorSet === "function" && !body.querySelector(".cs-acts")) {
        // the twins' colors as a set: Learn them, put them on the map (js/colorset.js); each twin row itself opens its page in one tap
        const hs = [...body.querySelectorAll(".kin i, .wd-in i, .film-strip i")].map(i => i.style.getPropertyValue("--c").trim()).filter(Boolean);
        if (hs.length >= 2) body.appendChild(csActions(colorSet({ kind: "twins", id: routeSlug(name), title: `${name} in the world`, colors: hs.map(h => ({ h })), src: "color/" + routeSlug(name) }), { only: ["learn", "map"], back: () => {} }));
      }
      if (has && id === "world") head("world", (() => { const t = [...body.querySelectorAll(".kin b,.wd-in b,.film-row b")].slice(0, 3).map(x => x.textContent.toLowerCase()); return t.length ? `Its twins: ${t.join(", ")}.` : ""; })());
      if (has && id === "paint") head("paint", (() => { const p = body.querySelector(".rc-reach-stat b"); return p ? `${p.textContent} come close.` : ""; })());
      if (has && id === "company") head("company", (() => { const k = body.querySelector(".kin b"); return k ? `Set beside ${k.textContent} more than chance.` : ""; })());
      if (has && id === "words") head("words", (() => { const q = body.querySelector(".pm-q-line,.psg-ex"); return q ? "Poets and writers use it." : ""; })());
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
    const c = arts.map(a => ({ a, d: de2000(hex, a[2]) })).filter(x => x.d <= 10 && x.a[3] >= 150).map(x => ({ ...x, sc: Math.sqrt(x.a[3]) * (1 - x.d / 10) })).sort((p, q) => q.sc - p.sc)[0];
    if (!c) { box.remove(); return; }
    const [slug, tname, thex, words, ttier, lede] = c.a, d = c.d, sentences = lede.split(/(?<=[.!?])\s/).slice(0, 2).join(" ");
    const diff = lookDiff({ h: thex, n: tname }, { h: hex, n: name }), dl = Math.abs(lab(hex)[0] - lab(thex)[0]);
    const mine = g.node && g.node.tier, kindMine = RP_TWINKIND[mine] || "a name", kindTheirs = RP_TWINKIND[({ pigment: "pigment-mineral-dye", traditional: "traditional-system", nature: "nature", place: "place-institution", person: "person", standard: "standard-system", commercial: "commercial" })[ttier]] || "a name";
    const how = `${esc(name)} is ${esc(diff)}${dl < 2 ? ", at the same depth" : ""}. It is ${kindMine}; ${esc(tname)} is ${kindTheirs}. The story is ${esc(tname)}'s, shown here because the two look alike.`;
    const full = words >= 600;
    box.innerHTML = `<section class="rp-twin${full ? "" : " rp-twin-compact"}"><div class="rp-twin-split"><i style="--c:${hex}"></i><i style="--c:${thex}"></i></div>
      <p class="rp-twin-label">${rpTwinLabel(d)} · ${pctMatch(d)}</p><h3>Its story lives with <em>${esc(tname)}</em></h3>
      ${full ? `<p class="rp-twin-lede">${esc(sentences)}</p><div class="rp-twin-how"><b>How they differ</b><p>${how}</p></div>` : `<p class="rp-twin-how-c">${how}</p>`}
      <button class="rp-twin-go" data-rp-twin="${esc(tname)}" data-h="${thex}">${full ? `Read its story · ${Math.max(2, Math.round(words / 220))} min` : `Read ${esc(tname.toLowerCase())}'s story`}${ICON.arrow}</button></section>`;
    box.querySelector("[data-rp-twin]").onclick = e => { openCoreName(e.currentTarget.dataset.h, e.currentTarget.dataset.rpTwin); };
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
const RP_HS = 46, RP_DIR = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
function rpHexXY(q, r) { return [1.5 * RP_HS * q, Math.sqrt(3) * RP_HS * (r + q / 2)]; }
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
    box.innerHTML = `<section class="rp-walk"><h2>Walk from here</h2><p class="rp-walk-sub">Drag to keep walking. Neighbors are close in color.</p>
      <div class="rp-hc" tabindex="0" aria-label="Neighborhood of ${esc(name)}"><div class="rp-hc-in"></div></div>
      <button class="rp-hc-map" type="button">Open on the map</button></section>`;
    const vp = box.querySelector(".rp-hc"), inn = box.querySelector(".rp-hc-in"), W = () => vp.clientWidth || 340, H = () => vp.clientHeight || 360;
    let ox = 0, oy = 0, sc = 1, drawn = new Set();
    const apply = () => { inn.style.transform = `translate(${W() / 2 + ox}px,${H() / 2 + oy}px) scale(${sc})`; };
    const paint = () => {
      const need = Math.min(14, Math.ceil(Math.max(Math.hypot(Math.abs(ox) + W() / 2 / sc, 0), Math.hypot(Math.abs(oy) + H() / 2 / sc, 0)) / (RP_HS * 1.5)) + 1);
      g.grow(Math.max(3, need));
      let html = "";
      g.cells.forEach(c => { const k = c.q + "," + c.r; if (drawn.has(k)) return; drawn.add(k); const [x, y] = rpHexXY(c.q, c.r);
        const st = `left:${(x - RP_HS).toFixed(1)}px;top:${(y - RP_HS * .866).toFixed(1)}px`;
        html += c.self ? `<div class="rp-hc-c rp-hc-self" style="${st};--c:${hex}" data-ink="${ink(hex)}"><b>${esc(name)}</b></div>`
          : `<button class="rp-hc-c" style="${st};--c:${c.h}" data-ink="${ink(c.h)}" data-rc-open data-h="${c.h}" data-n="${esc(c.n)}"><b>${esc(c.n)}</b><em>${Math.round(Math.max(0, 100 - c.de))}%</em></button>`; });
      inn.insertAdjacentHTML("beforeend", html);
    };
    paint(); apply();
    const ptrs = new Map(); let moved = 0, pd = 0, last = null;
    vp.addEventListener("pointerdown", e => { ptrs.set(e.pointerId, [e.clientX, e.clientY]); moved = 0; last = [e.clientX, e.clientY]; if (ptrs.size === 2) { const [a, b2] = [...ptrs.values()]; pd = Math.hypot(a[0] - b2[0], a[1] - b2[1]); } });
    vp.addEventListener("pointermove", e => {
      if (!ptrs.has(e.pointerId)) return;
      const prev = ptrs.get(e.pointerId); ptrs.set(e.pointerId, [e.clientX, e.clientY]);
      if (ptrs.size === 2) { const [a, b2] = [...ptrs.values()], d = Math.hypot(a[0] - b2[0], a[1] - b2[1]); if (pd) sc = Math.max(.6, Math.min(1.5, sc * d / pd)); pd = d; moved = 99; apply(); return; }
      const dx = e.clientX - prev[0], dy = e.clientY - prev[1]; moved += Math.abs(dx) + Math.abs(dy);
      if (moved > 8) { ox += dx / sc; oy += dy / sc; vp.classList.add("drag"); apply(); paint(); }
    });
    const up = e => { ptrs.delete(e.pointerId); pd = 0; if (!ptrs.size) setTimeout(() => vp.classList.remove("drag"), 0); };
    vp.addEventListener("pointerup", up); vp.addEventListener("pointercancel", up);
    vp.addEventListener("click", e => { if (moved > 8) { e.stopPropagation(); e.preventDefault(); } }, true);
    vp.addEventListener("wheel", e => { if (!e.ctrlKey) return; e.preventDefault(); sc = Math.max(.6, Math.min(1.5, sc * (e.deltaY < 0 ? 1.08 : .92))); apply(); }, { passive: false });
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

// ---------- the body, in design order ----------
// glance (a peek under the cover) is drawn by the page right after its hero; this is everything from the story door down
function rpPageBody(entry, name, hex, heroHex, famC, paintHost) {
  return `<div class="ar-slot" data-ar-slot hidden></div>
    ${rpTwinHTML(name, hex)}
    ${typeof rcYouHTML === "function" ? rcYouHTML(name, hex) : ""}
    ${rpDrawersHTML(entry, name, heroHex, famC, paintHost)}
    ${rpWalkSection(name, heroHex)}`;
}
