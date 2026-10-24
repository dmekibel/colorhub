"use strict";
// Painter's color map (David, 2026-10-24): "I never liked the See colors on map feature... What I would like is to see a
// painter only through color: a color map of the painter where the size of a node is based on how much they use that
// color. And maybe other ways to organize."
//
// ONE painter's colors and nothing else, every node a real named color from their measured work, node AREA = how much
// they use it. It is the palette honeycomb's own sheet (js/palettehive.js: same cells, labels, pinch/pan, one-tap-opens
// rule) driven with this file's data, arrangements and layouts, so there is no second renderer.
//
//   pcOpen(slug)          open the sheet (the painter page's "Their colors", and a painting page's "All of <painter>'s colors")
//   pcOpenRoute(slug)     #/painter/<slug>/colors: the painter page first, the sheet over it
//   pcColorLine(hex, host)  a color page's "In paintings" section asks: "Van Gogh holds this in 212 of 1,233 paintings"
//
// How much they use a color = the number of their paintings that hold it among their three main colors (the barcode in
// data/analysis/artists/<slug>.json: every painting's top three by area). It is a count of paintings, never an
// estimate; "share" below is that count over their paintings. Arrangements:
//   By use         biggest at the centre, spiralling out
//   By hue         a ring: angle = hue, distance from the centre = lightness (neutrals sit in the middle)
//   By lightness   dark on the left to light on the right, hue stacked up the columns
//   By decade      a row per decade; each node = a colour's share of THAT decade's paintings (the palette changing)
//   Against peers  more (discs, top) or less (rings, below) than painters of the same country and decade, the app's own
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
        let o = by.get(nm); if (!o) { o = { n: nm, h: c.h, C: c.C, count: 0, dec: new Map() }; by.set(nm, o); }
        if (c.C > o.C) { o.C = c.C; o.h = c.h; }
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

// ---------- layout (phLayout does the packing; these only say where each node wants to be) ----------
// lightness is read against THIS painter's own range (their darkest to their lightest), so the ring and the columns
// use the whole room even for a painter who never goes light
function pcRange(items) {
  const Ls = items.map(i => lch(i.h)[0]);
  const lo = Math.min(...Ls), hi = Math.max(...Ls);
  return v => hi - lo < 6 ? .5 : (v - lo) / (hi - lo);
}
const pcRingAt = f => (it, i, n, W, H) => {
  const R = Math.min(W, H) * .42;
  if (it.C < 10) { const a = i * PH_GA, r = R * .1 * Math.sqrt(f(it.L) * 3 + .3); return [Math.cos(a) * r, Math.sin(a) * r]; }
  const ang = (it.H - 90) * Math.PI / 180, rad = R * (.24 + .76 * f(it.L));
  return [Math.cos(ang) * rad, Math.sin(ang) * rad];
};
// By lightness: real columns. Dark on the left to light on the right (the painter's own range cut into columns), each
// column a stack of their colors in hue order (neutrals at the bottom), lightest-in-the-column nowhere special.
function pcColumnLayout(items) {
  const f = pcRange(items), n = items.length, nb = clamp(Math.round(Math.sqrt(n) * .95), 4, 12), mx = Math.max(...items.map(i => i.share), .001), R0 = 40;
  const cols = Array.from({ length: nb }, () => []);
  items.forEach(it => { const [L, C, H] = lch(it.h); cols[Math.min(nb - 1, Math.floor(f(L) * nb))].push({ ...it, L, C, H, r: Math.max(12, R0 * Math.sqrt(it.share / mx)) }); });
  const nodes = []; let x = 0, yMax = 0;
  const laid = cols.filter(c => c.length).map(c => {
    c.sort((a, b) => (b.C < 10 ? 1 : 0) - (a.C < 10 ? 1 : 0) || a.H - b.H);   // chromatic by hue on top, neutrals at the bottom
    const w = Math.max(...c.map(q => q.r)) * 2, h = c.reduce((t, q) => t + q.r * 2 + 4, -4);
    yMax = Math.max(yMax, h);
    return { c, w, h };
  });
  laid.forEach(({ c, w, h }) => {
    let y = -h / 2;
    c.forEach(q => { q.x = x + w / 2; q.y = y + q.r; y += q.r * 2 + 4; nodes.push(q); });
    x += w + 6;
  });
  const half = x / 2; nodes.forEach(q => { q.x -= half; });
  const bottom = yMax / 2 + 26;
  nodes.push({ h: "#000000", key: "ghost", ghost: true, r: 1, x: -half, y: bottom + 10, L: 0, C: 0, H: 0, share: 0, n: "" });
  return { nodes, ends: { l: -half, r: half - 6, y: bottom } };
}
// Row layouts (By decade, Against peers): a labelled block per group, its colors biggest first, wrapped six to a line,
// every circle's area on one scale across the whole view so rows compare at a glance.
const PC_ROW_R = 46, PC_LINE = 6;
function pcRowsLayout(groups, mx) {
  const rows = [], nodes = [], pitch = PC_ROW_R * 2 + 10;
  let y = 0;
  groups.forEach(g => {
    const row = g.items.map(it => { const [L, C, H] = lch(it.h); return { ...it, L, C, H, r: Math.max(16, PC_ROW_R * Math.sqrt(it.share / mx)) }; }).sort((a, b) => b.share - a.share);
    const y0 = y;
    for (let k = 0; k < row.length; k += PC_LINE) {
      let x = 0;
      row.slice(k, k + PC_LINE).forEach(nd => { nd.x = x + nd.r; nd.y = y; x += nd.r * 2 + 8; nodes.push(nd); });
      y += pitch;
    }
    rows.push({ label: g.label, sub: g.sub, y: y0 + (y - pitch - y0) / 2 });
    y += 22;
  });
  // a ghost at the left so the fit view leaves room for the row labels
  nodes.push({ h: "#000000", key: "ghost", ghost: true, r: 1, x: -160, y: 0, L: 0, C: 0, H: 0, share: 0, n: "" });
  return { nodes, rows };
}
function pcDecadeLayout(items) {
  const by = new Map();
  items.forEach(it => { if (!by.has(it.dec)) by.set(it.dec, []); by.get(it.dec).push(it); });
  const groups = [...by.keys()].sort((a, b) => a - b).map(d => ({ label: `${d}s`, sub: `${pcNum(by.get(d)[0].decTotal)} ${pcWord(by.get(d)[0].decTotal)}`, items: by.get(d) }));
  return pcRowsLayout(groups, Math.max(...items.map(i => i.share), .001));
}
// By use: the most-used color is the single disc at the center, the next ones ring it, and size falls off outward.
// Deterministic greedy packing: biggest first, each new circle goes to the free spot (tangent to a placed circle)
// nearest the center.
function pcPackLayout(items) {
  const list = items.slice().sort((a, b) => b.share - a.share || String(a.n).localeCompare(String(b.n))), mx = Math.max(list[0] ? list[0].share : 0, .001), R0 = 60, GAP = 3;
  const nodes = [];
  list.forEach(it => {
    const [L, C, H] = lch(it.h), r = Math.max(11, R0 * Math.sqrt(it.share / mx)), nd = { ...it, L, C, H, r, x: 0, y: 0 };
    if (nodes.length) {
      let best = null, bd = Infinity;
      const from = nodes.slice(-40).concat(nodes.slice(0, 6));
      for (const q of from) for (let k = 0; k < 20; k++) {
        const a = k / 20 * 6.2832 + (nodes.length % 7) * .13, d = q.r + r + GAP, x = q.x + Math.cos(a) * d, y = q.y + Math.sin(a) * d, dc = Math.hypot(x, y);
        if (dc >= bd) continue;
        let ok = true;
        for (const o of nodes) if (Math.hypot(o.x - x, o.y - y) < o.r + r + GAP - .01) { ok = false; break; }
        if (ok) { bd = dc; best = [x, y]; }
      }
      if (best) { nd.x = best[0]; nd.y = best[1]; } else { nd.x = bd === Infinity ? nodes[nodes.length - 1].x + 400 : 0; }
    }
    nodes.push(nd);
  });
  return nodes;
}
function pcPeersLayout(items) {
  const more = items.filter(i => !i.hollow), less = items.filter(i => i.hollow), groups = [];
  if (more.length) groups.push({ label: "More than peers", sub: `${more.length} ${more.length === 1 ? "color" : "colors"}`, items: more });
  if (less.length) groups.push({ label: "Less than peers", sub: `${less.length} ${less.length === 1 ? "color" : "colors"}`, items: less });
  return pcRowsLayout(groups, Math.max(...items.map(i => i.share), .001));
}

// ---------- the sheet ----------
function pcOpen(slug, o = {}) {
  if (!slug) return null;
  let dead = false, rowsNow = [], colsNow = null, hive = null, wait = null;
  const say = typeof toast === "function" ? toast : () => {};
  pcLoad(slug).then(async D => {
    if (dead) return;
    if (!D) { say("This painter's colors aren't measured yet"); return; }
    // the vivid reading (a few seconds the first time: a calm progress sheet, then cached)
    let viv = null;
    if (!PC_VIV_CACHE.has(slug)) {
      const nm = D.name, { sh, close } = sheet(`<p class="eyebrow">Painter</p><h1 class="ph-title">${esc(nm)}'s colors</h1>
        <p class="ph-sub" data-pcp>Reading ${esc(nm)}'s paintings…</p><div class="pc-bar"><i data-pcbar></i></div>`);
      wait = close;
      const txt = sh.querySelector("[data-pcp]"), bar = sh.querySelector("[data-pcbar]");
      try { viv = await pcLoadVivid(D, (k, n) => { if (txt.isConnected) { txt.textContent = `Reading ${nm}'s paintings… ${k} of ${n}`; bar.style.width = Math.round(k / n * 100) + "%"; } }); } catch (e) { viv = null; }
      if (!sh.isConnected) { dead = true; return; }   // closed while reading
      wait = null; close();
    } else { try { viv = await pcLoadVivid(D); } catch (e) { viv = null; } }
    if (dead) return;
    D.vivid = viv;
    const modes = viv ? [["vivid", "Vivid colors"], ["all", "All colors"]] : null;
    const arrs = PC_ARRS.filter(([k]) => k !== "decade" || pcDecades(D).length >= 2).filter(([k]) => k !== "peers" || D.peers.length >= 3);
    const total = Math.min(D.items.length, PC_CAP);
    const V = mode => pcView(D, mode);
    const sub = (arr, mode) => {
      const nm = D.name, v = V(mode), vivid = mode === "vivid" && !!D.vivid;
      if (D.few) return `Only ${D.N} ${pcWord(D.N)} here. Too few to say much; read this as a sketch, not a finding.`;
      if (arr === "share") return vivid ? `What gives ${nm} their character: the vivid colors, sized by how many of the ${pcNum(v.N)} paintings we read hold them. Blacks, browns and greys every painter has are left out.`
        : `All the colors ${nm} uses, including the dark grounds, sized by how many of their ${pcNum(D.N)} paintings hold each among their three main colors.`;
      if (arr === "hue") return "Around the ring by hue, darker colors toward the middle and lighter ones outside.";
      if (arr === "light") return "Darkest on the left to lightest on the right.";
      if (arr === "decade") return `How the palette changed: each color's share of that decade's paintings${vivid ? ", among their vivid colors" : ""}.`;
      const more = D.peers.filter(x => x.lift >= 1).length, less = D.peers.length - more;
      return !more ? `Nothing stands clearly above painters of the same country and decade; these are the colors ${nm} uses much less (rings).` : !less ? `The colors ${nm} uses much more than painters of the same country and decade.` : "Discs: used more than painters of the same country and decade. Rings: used less.";
    };
    hive = openPaletteHive({
      title: `${D.name}'s colors`, source: "painter", modes, mode0: viv ? "vivid" : "all",
      colors: pcItems(D, "share", PC_DEF, viv ? "vivid" : "all"), arrs, arr0: o.arr && arrs.some(a => a[0] === o.arr) ? o.arr : "share",
      itemsFn: (arr, n, mode) => pcItems(D, arr, n, mode), max: total, maxCap: PC_CAP, count0: Math.min(PC_DEF, total),
      noCount: (arr, mode) => arr === "decade" || arr === "peers" || mode === "vivid",
      sub, fine: "Read from each painting's measured palette, as photographed through varnish. Screen colors are approximate.",
      layoutFn: (arr, items, W, Ht) => {
        rowsNow = []; colsNow = null;
        if (arr === "decade") { const r = pcDecadeLayout(items); rowsNow = r.rows; return r.nodes; }
        if (arr === "share") return pcPackLayout(items);
        if (arr === "hue") return phLayout(items, "hue", W, Ht, { anchor: pcRingAt(pcRange(items)), spring: .08, fill: .3 });
        if (arr === "light") { const r = pcColumnLayout(items); colsNow = r.ends; return r.nodes; }
        if (arr === "peers") { const r = pcPeersLayout(items); rowsNow = r.rows; return r.nodes; }
        return null;
      },
      label2: (arr, nd) => arr === "decade" ? `${Math.round(nd.share * 100)}%` : arr === "peers" ? `${pcFmtX(nd.lift >= 1 ? nd.lift : 1 / nd.lift)}×` : `${pcNum(nd.count)}`,
      under: (ctx, ws, zoom, arr) => {
        const fs = Math.max(13, Math.min(17, 14 * zoom));
        ctx.save(); ctx.fillStyle = "rgba(236,232,223,.82)"; ctx.textBaseline = "middle";
        if (arr === "decade" || arr === "peers") {
          ctx.textAlign = "right";
          rowsNow.forEach(r => {
            const [sx, sy] = ws(-12, r.y);
            ctx.font = `400 ${fs * 1.25}px "Instrument Serif",Georgia,serif`; ctx.fillText(r.label, sx, sy - fs * .4);
            ctx.font = `400 ${fs * .8}px "Geist",system-ui,sans-serif`; ctx.globalAlpha = .6; ctx.fillText(r.sub, sx, sy + fs * .75); ctx.globalAlpha = 1;
          });
        } else if (arr === "light" && colsNow) {
          ctx.font = `400 ${fs}px "Geist",system-ui,sans-serif`; ctx.globalAlpha = .7;
          ctx.textAlign = "left"; const [lx, ly] = ws(colsNow.l, colsNow.y); ctx.fillText("Darker", lx, ly);
          ctx.textAlign = "right"; const [rx, ry] = ws(colsNow.r, colsNow.y); ctx.fillText("Lighter", rx, ry);
        }
        ctx.restore();
      },
      onTap: (nd, close) => {
        const mode = window.PH_DEBUG && PH_DEBUG.mode ? PH_DEBUG.mode() : "all", v = V(mode);
        const it = v.items.find(x => x.h === nd.h) || D.items.find(x => x.h === nd.h);
        PC_CTX = { hex: nd.h.toUpperCase(), name: nd.n, slug: D.slug, painter: D.name, count: it ? it.count : nd.count, N: it && v.items.includes(it) ? v.N : D.N, vivid: mode === "vivid" && !!D.vivid, t: performance.now() };
        close(); openTappedColor(nd.h);
      },
    });
    pcAddress(slug);
    if (hive && hive.close) { const c0 = hive.close; hive.close = () => { dead = true; c0(); }; }
  }).catch(() => { if (!dead) say("The painter's colors didn't load"); });
  return { close: () => { dead = true; if (wait) wait(); if (hive && hive.close) hive.close(); } };
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
    if (document.querySelector(".ph-sheet")) return;
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
