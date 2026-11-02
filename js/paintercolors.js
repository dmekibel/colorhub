"use strict";
// Painter's color map (David, 2026-10-24): "I never liked the See colors on map feature... What I would like is to see a
// painter only through color: a color map of the painter where the size of a node is based on how much they use that
// color. And maybe other ways to organize."
//
// ONE painter's colors and nothing else, every node a real named color from their measured work. David, 2026-10-25: it is
// the app's STANDARD color map (js/palettehive.js: circles or honeycomb, same cells, labels, chrome, ⋯ sheet), not its own
// thing. Circles are all one size with the most-used color in the CENTER; "Size circles by how much they use it" is an
// option in the ⋯ sheet (circles only). This file only supplies the data and the arrangements.
//
//   pcOpen(slug)          open the sheet (the painter page's "Their colors", and a painting page's "All of <painter>'s colors")
//   pcOpenRoute(slug)     #/painter/<slug>/colors: the painter page first, the sheet over it
//   pcColorLine(hex, host)  a color page's "In paintings" section asks: "Van Gogh holds this in 212 of 1,233 paintings"
//
// How much they use a color = the number of their paintings that hold it among their three main colors (the barcode in
// data/analysis/artists/<slug>.json: every painting's top three by area). It is a count of paintings, never an
// estimate; "share" below is that count over their paintings. Arrangements:
//   By use         the most-used color in the centre, spiralling out
//   By hue         a ring: angle = hue, distance from the centre = lightness (neutrals sit in the middle)
//   By lightness   dark on the left to light on the right, hue stacked up the columns
//   By decade      a row per decade; each node = a colour's share of THAT decade's paintings (the palette changing)
//   Against peers  more (top) or less (below) than painters of the same country and decade, the app's own
//                  signature / avoided lift; only the colors that comparison measured
// "By painting count" is the same number as By use, so it is not a second chooser entry.

const PC_CAP = 400, PC_DEF = 60, PC_MIN_DECADE_N = 3;
const PC_CACHE = new Map();
let PC_CTX = null;   // the node just tapped, read once by the color page that opens next (pcColorLine)

const pcNum = n => Number(n).toLocaleString("en-US");
const pcFmtX = x => x >= 10 ? Math.round(x) + "" : x >= 2 ? (Math.round(x * 10) / 10).toString().replace(/\.0$/, "") : (Math.round(x * 10) / 10).toString();
const pcWord = n => n === 1 ? "painting" : "paintings";

// ---------- the data: one painter's named colors, counted honestly ----------
async function pcLoad(slug) {
  if (PC_CACHE.has(slug)) return PC_CACHE.get(slug);
  const p = (async () => {
    await Promise.all([loadCoreNames(), typeof loadLongNames === "function" ? loadLongNames() : null]);
    const A = await l18Get(`data/analysis/artists/${slug}.json`);
    if (!A || !(A.barcode || []).length) return null;
    const by = new Map(), decN = new Map(), N = A.barcode.length;
    A.barcode.forEach(([, year, names]) => {
      const dec = year != null && year > -20000 ? Math.floor(year / 10) * 10 : null, seen = new Set();
      if (dec != null) decN.set(dec, (decN.get(dec) || 0) + 1);
      (names || []).forEach(nm => {
        if (!nm || seen.has(nm)) return; seen.add(nm);
        let o = by.get(nm);
        if (!o) { const h = svNameHex(nm); if (!h) return; o = { n: nm, h, count: 0, dec: new Map() }; by.set(nm, o); }
        o.count++;
        if (dec != null) o.dec.set(dec, (o.dec.get(dec) || 0) + 1);
      });
    });
    const items = [...by.values()].sort((a, b) => b.count - a.count || a.n.localeCompare(b.n));
    const seenN = new Set(), peers = [];
    [...(A.signatureAll || []), ...(A.signature || []), ...(A.avoidedAll || []), ...(A.avoided || [])].forEach(x => {
      if (!x || !x.name || seenN.has(x.name) || !(x.lift > 0)) return;
      const h = svNameHex(x.name); if (!h) return;
      seenN.add(x.name);
      peers.push({ n: x.name, h, lift: x.lift, own: x.ownShare, base: x.baselineShare, support: x.support, count: (by.get(x.name) || {}).count || 0 });
    });
    return { slug, name: A.name || slug, N, items, decN, peers, few: N < 15 };
  })();
  PC_CACHE.set(slug, p);
  p.then(d => { if (!d) PC_CACHE.delete(slug); }, () => PC_CACHE.delete(slug));
  return p;
}

// ---------- the vivid reading: what the painter is KNOWN for ----------
// David's standing rule (painter colors are vivid, not average): the dark grounds, browns and greys every painter
// has swamp a plain count. So the default reads each of up to 60 of their paintings' own measured pools (the 24-color
// pools in data/gallery/d, the same ones the painting page's palettes come from), keeps each painting's most vivid
// distinct colors (chroma first, then how much of the canvas), and counts how many paintings hold each named color.
const PC_VIV_N = 60, PC_VIV_PER = 7, PC_VIV_CACHE = new Map();
function pcVividPick(pool) {
  const P = pool.map(p => { const c = lch(p.h); return { h: p.h, share: p.share, L: c[0], C: c[1], lab: lab(p.h) }; });
  let cand = P.filter(p => p.C >= 24 && p.L >= 14 && p.L <= 96);
  if (cand.length < 3) cand = P.filter(p => p.C >= 14 && p.L >= 12);   // a low-key painting: its most colorful, still never a plain neutral
  cand.sort((a, b) => Math.pow(b.share + .004, .28) * (b.C + 6) - Math.pow(a.share + .004, .28) * (a.C + 6));
  const out = [], bins = new Map();   // at most two per 30-degree hue bin, so a painting's blues and greens are not crowded out by its many browns
  for (const p of cand) {
    if (out.length >= PC_VIV_PER) break;
    const bin = Math.floor(lch(p.h)[2] / 30);
    if ((bins.get(bin) || 0) >= 2 || !out.every(q => de2000(q.lab, p.lab) >= 13)) continue;
    out.push(p); bins.set(bin, (bins.get(bin) || 0) + 1);
  }
  return out;
}
function pcLoadVivid(D, onProgress) {
  if (PC_VIV_CACHE.has(D.slug)) return PC_VIV_CACHE.get(D.slug);
  const p = (async () => {
    await Promise.all([awLoad(), loadGallery()]);
    const { P } = await awPainterLoad(D.slug);
    const all = (P.ix || []).filter(j => j >= 0), total = all.length;
    if (!total) return null;
    const pick = total <= PC_VIV_N ? all : Array.from({ length: PC_VIV_N }, (_, k) => all[Math.floor(k * total / PC_VIV_N)]);
    const by = new Map(), decN = new Map(); let done = 0, N = 0;
    const one = async i => {
      const d = await glDetail(i), pool = glPoolDecode(d.pl);
      done++; if (onProgress) onProgress(done, pick.length);
      if (!pool.length) return;
      N++;
      const y = GAL.year[i], dec = y !== GL_UNDATED && y > -20000 ? Math.floor(y / 10) * 10 : null, seen = new Set();
      if (dec != null) decN.set(dec, (decN.get(dec) || 0) + 1);
      pcVividPick(pool).forEach(c => {
        const nm = nameOf(c.h).text; if (!nm || seen.has(nm)) return; seen.add(nm);
        let o = by.get(nm); if (!o) { o = { n: nm, h: svNameHex(nm) || c.h, C: c.C, count: 0, dec: new Map() }; by.set(nm, o); }
        if (c.C > o.C) o.C = c.C;
        o.count++; if (dec != null) o.dec.set(dec, (o.dec.get(dec) || 0) + 1);
      });
    };
    for (let k = 0; k < pick.length; k += 6) await Promise.all(pick.slice(k, k + 6).map(one));
    const items = [...by.values()].sort((a, b) => b.count - a.count || b.C - a.C).slice(0, PC_CAP);
    return items.length >= 3 && N >= 1 ? { items, N, decN, total } : null;
  })();
  PC_VIV_CACHE.set(D.slug, p);
  p.then(v => { if (!v) PC_VIV_CACHE.delete(D.slug); }, () => PC_VIV_CACHE.delete(D.slug));
  return p;
}

// ---------- the five arrangements ----------
const PC_ARRS = [["share", "By use"], ["hue", "By hue"], ["light", "By lightness"], ["decade", "By decade"], ["peers", "Against peers"]];
const pcView = (D, mode) => mode === "vivid" && D.vivid ? D.vivid : { items: D.items, N: D.N, decN: D.decN };
const pcDecades = D => [...D.decN.entries()].filter(([, n]) => n >= PC_MIN_DECADE_N).map(([d]) => d).sort((a, b) => a - b);

// the items for an arrangement (the standard map in js/palettehive.js places them: by use, hue and lightness on its lattice,
// decade and peers as labelled rows built by pcRows below)
function pcItems(D0, arr, n, mode) {
  const D = { ...D0, ...pcView(D0, mode) };
  if (arr === "decade") {
    const decs = pcDecades(D), k = decs.length <= 2 ? 12 : decs.length <= 4 ? 9 : decs.length <= 7 ? 6 : 5, out = [];
    decs.forEach(d => {
      const tot = D.decN.get(d);
      D.items.map(o => ({ o, c: o.dec.get(d) || 0 })).filter(x => x.c > 0).sort((a, b) => b.c - a.c).slice(0, k)
        .forEach(({ o, c }) => out.push({ h: o.h, n: o.n, key: o.h + "@" + d, dec: d, share: c / tot, count: c, decTotal: tot }));
    });
    return out;
  }
  if (arr === "peers") {
    return D.peers.map(x => {
      const less = x.lift < 1, mag = Math.max(Math.abs(Math.log(x.lift)), .12);
      return { h: x.h, n: x.n, key: x.h, share: mag, hollow: less, lift: x.lift, count: x.count };
    });
  }
  return D.items.slice(0, Math.min(n, PC_CAP)).map(o => ({ h: o.h, n: o.n, key: o.h, share: o.count / D.N, count: o.count }));
}
// By decade: a labelled row per decade. Against peers: more than their peers, then less.
function pcRows(arr, items) {
  if (arr === "decade") {
    const by = new Map();
    items.forEach(it => { if (!by.has(it.dec)) by.set(it.dec, []); by.get(it.dec).push(it); });
    return [...by.keys()].sort((a, b) => a - b).map(d => ({ label: `${d}s`, sub: `${pcNum(by.get(d)[0].decTotal)} ${pcWord(by.get(d)[0].decTotal)}`, items: by.get(d) }));
  }
  if (arr === "peers") {
    const more = items.filter(i => !i.hollow), less = items.filter(i => i.hollow), groups = [];
    if (more.length) groups.push({ label: "More than peers", sub: `${more.length} ${more.length === 1 ? "color" : "colors"}`, items: more });
    if (less.length) groups.push({ label: "Less than peers", sub: `${less.length} ${less.length === 1 ? "color" : "colors"}`, items: less });
    return groups;
  }
  return null;
}

// ---------- the map: the standard color map (js/palettehive.js) driven with this painter's colors ----------
function pcOpen(slug) {
  if (!slug) return null;
  const say = typeof toast === "function" ? toast : () => {};
  let D = null;
  const hive = openPaletteHive({
    title: "Colors", source: "painter", waitText: "Reading their paintings…",
    defer: async (prog, h) => {
      D = await pcLoad(slug);
      if (!D) { say("This painter's colors aren't measured yet"); return null; }
      h.title(`${D.name}'s colors`); h.text(`Reading ${D.name}'s paintings…`);
      let viv = null;
      try { viv = await pcLoadVivid(D, prog); } catch (e) { viv = null; }   // a few seconds the first time (a calm progress bar), then cached
      D.vivid = viv;
      const arrs = PC_ARRS.filter(([k]) => k !== "decade" || pcDecades(D).length >= 2).filter(([k]) => k !== "peers" || D.peers.length >= 3);
      const total = Math.min(D.items.length, PC_CAP), V = mode => pcView(D, mode);
      const sub = (arr, mode) => {
        const nm = D.name, vivid = mode === "vivid" && !!D.vivid;
        if (D.few) return `Only ${D.N} ${pcWord(D.N)} here. Too few to say much; read this as a sketch, not a finding.`;
        if (arr === "share") return vivid ? "Their most used vivid colors are in the middle." : "Their most used colors are in the middle.";
        if (arr === "hue") return "Around the ring by hue, darker colors toward the middle.";
        if (arr === "light") return "Darkest on the left to lightest on the right.";
        if (arr === "decade") return `How the palette changed: each color's share of that decade's paintings${vivid ? " (vivid)" : ""}.`;
        const more = D.peers.filter(x => x.lift >= 1).length, less = D.peers.length - more;
        return !more ? `Nothing stands clearly above painters of the same country and decade; these are the colors ${nm} uses much less.` : !less ? `The colors ${nm} uses much more than painters of the same country and decade.` : "More, then less, than painters of the same country and decade.";
      };
      return {
        title: `${D.name}'s colors`, modes: viv ? [["vivid", "Vivid colors only"], ["all", "All colors"]] : null, mode0: viv ? "vivid" : "all", modesTitle: "Which colors",
        colors: pcItems(D, "share", PC_DEF, viv ? "vivid" : "all"), arrs, arr0: "share",
        itemsFn: (arr, n, mode) => pcItems(D, arr, n, mode), rowsFn: pcRows, max: total, maxCap: PC_CAP, count0: Math.min(PC_DEF, total),
        noCount: (arr, mode) => arr === "decade" || arr === "peers" || mode === "vivid",
        sub, sizeLabel: "Size circles by how much they use it",
        fine: "Read from each painting's measured palette, as photographed through varnish. Screen colors are approximate.",
        label2: (arr, nd) => arr === "decade" ? `${Math.round(nd.share * 100)}%` : arr === "peers" ? `${pcFmtX(nd.lift >= 1 ? nd.lift : 1 / nd.lift)}×` : `${pcNum(nd.count)}`,
        onTap: (nd, close, c) => {
          const mode = c && c.mode || "all", v = V(mode);
          const it = v.items.find(x => x.h === nd.h) || D.items.find(x => x.h === nd.h);
          PC_CTX = { hex: nd.h.toUpperCase(), name: nd.n, slug: D.slug, painter: D.name, count: it ? it.count : nd.count, N: it && v.items.includes(it) ? v.N : D.N, vivid: mode === "vivid" && !!D.vivid, t: performance.now() };
          close(); openTappedColor(nd.h);
        },
      };
    },
  });
  if (hive) pcAddress(slug);
  return hive;
}

// #/painter/<slug>/colors: the painter's page under, the color map over it (closing reveals the page, like any sheet)
function pcOpenRoute(slug) {
  // the painter page draws itself (it loads its own data); open the sheet once its screen is up
  let tries = 0;
  const go1 = () => { if (document.querySelector(".aw-page") || ++tries > 30) pcOpen(slug); else setTimeout(go1, 100); };
  go1();
}
// the address follows the sheet: #/painter/<slug>/colors while it is open, the painter's own address again after
function pcAddress(slug) {
  let before = null;
  try { before = location.hash; history.replaceState(history.state, "", "#/painter/" + slug + "/colors"); } catch (e) { return; }
  const iv = setInterval(() => {
    if (document.querySelector(".phx")) return;
    clearInterval(iv);
    try { if (location.hash === "#/painter/" + slug + "/colors") history.replaceState(history.state, "", before && before !== location.hash ? before : "#/painter/" + slug); } catch (e) {}
  }, 400);
}

// ---------- the color page: "Van Gogh holds this in 212 of 1,233 paintings" (one shot, only right after a node tap) ----------
function pcColorLine(hex, host, name) {
  const c = PC_CTX; PC_CTX = null;
  if (!c || !host || performance.now() - c.t > 20000) return;
  const same = String(hex).toUpperCase() === c.hex || (name && String(name).toLowerCase() === String(c.name).toLowerCase());
  if (!same) return;
  const el = document.createElement("div");
  el.className = "pc-use";
  el.innerHTML = `<p><b>${esc(c.painter)}</b> holds this in <b>${pcNum(c.count)} of ${pcNum(c.N)}</b> ${pcWord(c.N)}${c.vivid ? " we read, among their vivid colors" : ", as one of their three main colors"}.</p>
    <button type="button" class="pc-use-b" data-pmap="p=${esc(c.slug)}&c=${c.hex.replace("#", "")}&t=8&m=2">See ${esc(c.painter)}'s paintings with it ${ICON.arrow}</button>`;
  host.prepend(el);
}
