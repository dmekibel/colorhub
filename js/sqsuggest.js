"use strict";
// The suggestion engine (sq*): one query in, grouped rows out. It understands time ("1870s to 80s", "before 1500",
// "late 1800s"), colors (every archive and alternate name, hex, rgb), painters (typo-tolerant), countries and
// nationalities, movements, subjects, and combinations of them ("blue 1870s", "dutch portraits", "monet green"),
// which become one typed "Show N paintings" row that opens the painting map already filtered. Rows carry what
// js/search.js needs to draw them (a 40px leading visual, a title, a sub line) and an act(). Nothing here reads lazily
// loaded data at load time: sqWarm() fetches it, and until it lands sqSuggest says `loading`.

let SQ_WARM = null, SQ_GROUPS = null, SQ_PAINT = null, SQ_PLACES = null;
function sqWarm() {
  if (SQ_WARM) return SQ_WARM;
  const grp = typeof l18Get === "function" ? l18Get("data/analysis/groups.json") : fetch("data/analysis/groups.json").then(r => r.ok ? r.json() : null).catch(() => null);
  SQ_WARM = Promise.all([sqLoad(), typeof awLoad === "function" ? awLoad().catch(() => null) : null, pmLoad(), xbLoad(), typeof loadSubjects === "function" ? loadSubjects().catch(() => null) : null, grp])
    .then(([, , , , , g]) => { SQ_GROUPS = g || {}; return pmThumbsLoad().catch(() => null); }).then(() => true)
    .catch(e => { SQ_WARM = null; console.warn("search warm-up", e); return false; });
  return SQ_WARM;
}
const sqWarmed = () => !!(SQ_GROUPS && typeof XBF !== "undefined" && XBF && typeof pmqParse === "function" && typeof AW !== "undefined" && AW.ready && sqReady());

// ---------- time ----------
function sqTime(t) {
  let m;
  const R = (y0, y1, label, from) => ({ y0, y1, label, rest: t.replace(from, " ") });
  if ((m = t.match(/\b(?:before|until|up to|pre|earlier than)\s+(1\d{3}|20\d{2})\b/))) return R(1200, +m[1] - 1, "before " + m[1], m[0]);
  if ((m = t.match(/\b(?:after|since|from)\s+(1\d{3}|20\d{2})\b(?!\s*(?:-|to|until|through))/))) return R(+m[1] + 1, 2030, "after " + m[1], m[0]);
  if ((m = t.match(/\b(?:around|circa|ca|c)\.?\s*(1\d{3}|20\d{2})\b/))) return R(+m[1] - 25, +m[1] + 25, "around " + m[1], m[0]);
  const y = pmqYears(t);
  if (y) return { y0: y.y0, y1: y.y1, label: y.label, rest: y.rest };
  if ((m = t.match(/(?:^|\s)'?([3-9]0)s\b/))) { const a = 1800 + +m[1]; return R(a, a + 9, a + "s", m[0]); }   // "70s" -> the 1870s
  return null;
}

// ---------- the lists the parser and the rows draw from ----------
function sqPainters(F) {
  if (SQ_PAINT && SQ_PAINT.F === F) return SQ_PAINT.list;
  const cnt = new Int32Array(F.meta.artists.length + 1); for (let i = 0; i < F.N; i++) cnt[F.artist[i]]++;
  const list = F.meta.artists.map((a, j) => ({ v: j + 1, n: a[0], slug: a[1], k: cnt[j + 1] })).filter(x => x.k);
  SQ_PAINT = { F, list }; return list;
}
function sqPlaces(F) {
  if (SQ_PLACES && SQ_PLACES.F === F) return SQ_PLACES.list;
  const list = [];
  F.meta.countries.forEach((n, j) => {
    const piece = { kind: "co", vals: [j + 1], label: n, adj: n };
    list.push({ t: n, piece });
    (PMQ_DEMONYMS[n] || []).forEach(d => list.push({ t: d, piece }));
  });
  F.meta.movements.forEach((n, j) => list.push({ t: n, piece: { kind: "mv", val: j + 1, label: n } }));
  Object.values(PMQ_ERAS).forEach(e => list.push({ t: e[2], piece: { kind: "when", y0: e[0], y1: e[1], label: e[2] } }));
  SQ_PLACES = { F, list }; return list;
}

// ---------- understanding ----------
const sqHexParse = t => {
  let m = t.match(/(?:^|\s)#([0-9a-f]{6}|[0-9a-f]{3})(?=\s|$)/i);
  if (m) { const h = m[1].length === 3 ? m[1].replace(/./g, c => c + c) : m[1]; return { h: "#" + h.toUpperCase(), rest: t.replace(m[0], " ") }; }
  m = t.match(/(?:^|\s)([0-9a-f]{6})(?=\s|$)/i);
  if (m && /\d/.test(m[1]) && /[a-f]/i.test(m[1])) return { h: "#" + m[1].toUpperCase(), rest: t.replace(m[0], " ") };
  m = t.match(/rgb\(?\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})\s*\)?/);
  if (m && [m[1], m[2], m[3]].every(v => +v <= 255)) return { h: "#" + [m[1], m[2], m[3]].map(v => (+v).toString(16).padStart(2, "0")).join("").toUpperCase(), rest: t.replace(m[0], " ") };
  return null;
};
const SQ_NOISE = new Set(["paintings", "painting", "art", "artwork", "artworks", "works", "by", "from", "in", "of", "the", "and", "painters", "painter", "color", "colors", "colour", "colours", "show", "me", "with", "a", "an", "at", "to"]);
// -> { pieces, painter, hex, colorName, left, any, parts } for the whole query read as a combination
function sqUnderstand(q, F) {
  let t = " " + q.toLowerCase().replace(/[‐-―−]/g, "-").replace(/[,;:!?()"“”]/g, " ") + " ";
  const out = { pieces: [], painter: null, hex: null, colorName: "", left: [], parts: [] };
  const hx = sqHexParse(t); if (hx) { out.hex = hx.h; t = hx.rest; }
  const tm = sqTime(t); if (tm) { t = tm.rest; out.pieces.push({ kind: "when", y0: tm.y0, y1: tm.y1, label: tm.label }); }
  const P = pmqParse(t, F);
  P.pieces.forEach(p => { if (!out.pieces.some(x => x.kind === p.kind)) out.pieces.push(p); });
  let words = P.rest.split(/\s+/).filter(w => w && !SQ_NOISE.has(w));
  // exact color names first (the longest run of words), then painters, then a typo'd color
  const take = (fn, maxLen) => {
    for (let i = 0; i < words.length; i++) {
      for (let len = Math.min(maxLen, words.length - i); len >= 1; len--) {
        const seg = words.slice(i, i + len).join(" "), r = fn(seg, len); if (r) { words.splice(i, len); return r; }
      }
    }
    return null;
  };
  if (!out.hex) {
    const c = take(seg => { const e = sqColorExact(seg); return e && e.k.length >= 3 ? e : null; }, 3);
    if (c) { out.hex = c.h; out.colorName = c.n; out.colorRef = c; }
  }
  if (words.length && !out.painter) {
    const list = sqPainters(F);
    const p = take((seg, len) => {
      if (seg.length < 4) return null;
      const r = sqFuzzyRank(list, seg, x => x.n, 1);
      return r.hits[0] && r.top >= 40 ? r.hits[0] : null;
    }, 3);
    if (p) out.painter = p;
  }
  if (!out.hex && words.length) {
    const c = take(seg => { if (seg.length < 4) return null; const r = sqColorSearch(seg, 1); return r.hits[0] && r.top >= 40 ? r.hits[0] : null; }, 3);
    if (c) { out.hex = c.h; out.colorName = c.n; out.colorRef = c; }
  }
  out.left = words;
  out.any = out.pieces.length + (out.painter ? 1 : 0) + (out.hex ? 1 : 0);
  return out;
}
// one combination -> its map spec (cheap), and its count (the map's own filter pass; cached, run after the rows are drawn)
const SQ_COUNTS = new Map();
const sqPaintingsN = n => `${n.toLocaleString()} painting${n === 1 ? "" : "s"}`;
function sqSpecOf(u, F) {
  const s = pmParse("arr=color", F), f = s.f;
  u.pieces.forEach(p => pmqApply(f, p.kind === "mv" && !p.val && p.era ? { kind: "when", y0: p.era[0], y1: p.era[1] } : p));
  if (u.painter) pmqApply(f, { kind: "painter", val: u.painter.v });
  if (u.hex) { f.hexes = [u.hex]; f.name = u.colorName || ""; f.tol = 8; f.cover = 2; f.colorMode = "any"; }
  const spec = pmQS(s, F);
  return { spec, count() { const hit = SQ_COUNTS.get(spec); if (hit) return hit; const list = pmRun(s, F).list; const r = { n: list.length, first: list.length ? list[0] : -1 }; SQ_COUNTS.set(spec, r); return r; } };
}
function sqComboLabel(u) {
  const bits = [];
  if (u.hex) bits.push(u.colorName || nameOf(u.hex).text);
  const co = u.pieces.find(p => p.kind === "co"), mv = u.pieces.find(p => p.kind === "mv"), sj = u.pieces.find(p => p.kind === "subj"), wh = u.pieces.find(p => p.kind === "when");
  if (co) bits.push(co.adj || co.label);
  if (mv) bits.push(mv.label);
  if (sj) bits.push(sj.label.toLowerCase());
  if (u.painter) bits.push("by " + u.painter.n);
  if (wh) bits.push(wh.label);
  return bits.join(" · ");
}

// ---------- row visuals ----------
function sqStrip(names, F) {
  const hs = (names || []).map(x => { const e = sqColorExact(x.name || x); return e && e.h; }).filter(Boolean);
  return [...new Set(hs)].slice(0, 5);
}
function sqStripFor(piece) {
  const g = SQ_GROUPS || {};
  let rec = null;
  if (piece.kind === "co") rec = g.byCountry && g.byCountry[piece.label];
  else if (piece.kind === "mv") rec = g.byMovement && g.byMovement[piece.label];
  else if (piece.kind === "when") rec = g.byDecade && g.byDecade[String(Math.floor(((piece.y0 + piece.y1) / 2) / 10) * 10)];
  return rec ? sqStrip(rec.top) : [];
}
function sqPlaceIcon(piece) {
  if (piece.kind === "co") { const f = sqFlagHTML(piece.label); if (f) return { t: "flag", html: f }; }
  const hs = sqStripFor(piece); return hs.length ? { t: "strip", hs } : { t: "glyph", name: "search" };
}
function sqPainterIcon(m, F) {
  const rec = (AW.port && AW.port[m.slug]) || {}, pt = rec.portrait || {};
  let url = "";
  if (pt.src === "wikidata" && pt.url) url = pt.url;
  else if ((pt.src === "self" || pt.src === "other") && pt.gi != null) { const th = pmThumb(pt.gi, F); url = th ? th.url : ""; }
  const gi = rec.famous && rec.famous[0];
  return { t: "portrait", url, initial: m.n.replace(/[^A-Za-zÀ-ÿ ]/g, "").trim().charAt(0).toUpperCase(), bg: gi != null && gi >= 0 ? pmHex(gi, F) : "#3A3630" };
}
function sqPainterSub(m) {
  const a = AW.meta && AW.meta.a && AW.meta.a[m.slug];
  const life = a && a.b != null ? `${a.b}–${a.d != null ? a.d : ""}` : a && a.y0 ? `${a.y0}–${a.y1}` : "";
  return [a && a.co, life, `${m.k.toLocaleString()} painting${m.k === 1 ? "" : "s"}`].filter(Boolean).join(" · ");
}

// ---------- the suggestions ----------
// -> { loading, groups: [{ id, title, best, rows: [{ id, icon, title, sub, act, combo?, resolve? }] }], didYouMean }
// A row with resolve() is finished after it is drawn (the count is a pass over 200,000 paintings): resolve returns
// { title?, sub?, icon?, hide?, act? } for js/search.js to patch in.
function sqSuggest(q, extra) {
  q = String(q || "").trim();
  const res = { loading: !sqWarmed(), groups: [], didYouMean: "" };
  if (!q) return res;
  const groups = [], G = (id, title, best, rows) => { if (rows.length) groups.push({ id, title, best, rows }); };
  const finish = () => {
    // a typo suggestion only when the best group is itself a typo match, and nothing was understood as a combination
    const top = groups.slice().sort((a, b) => b.best - a.best)[0];
    if (top && top.best < 48 && (top.id === "colors" || top.id === "painters") && !groups.some(g => g.id === "paintings")) res.didYouMean = top.rows[0].title;
    // typo-only matches stay out of the way when something matched for real
    const strong = groups.some(g => g.best >= 90);
    res.groups = groups.filter(g => !(strong && g.best < 48 && (g.id === "painters" || g.id === "places"))).sort((a, b) => b.best - a.best);
    return res;
  };
  // colors work as soon as the names are in
  if (sqReady()) {
    const cm = sqColorSearch(q, 6);
    G("colors", "Colors", cm.top, cm.hits.map(e => ({ id: "c:" + e.k, icon: { t: "swatch", h: e.h }, title: e.n, sub: e.alt ? "also called · " + e.of : e.h, hex: e.h, act: () => sqOpenColor(e) })));
  }
  if (res.loading) { if (extra) extra(G); return finish(); }
  const F = XBF;
  // the direct hex
  const hx = sqHexParse(" " + q.toLowerCase() + " ");
  if (hx && !hx.rest.trim()) {
    const nm = nameOf(hx.h);
    G("hex", "Color", 150, [{ id: "hex", icon: { t: "swatch", h: hx.h }, title: hx.h, sub: "Closest: " + (nm.n || nm.text), act: () => openTappedColor(hx.h) }]);
  }
  // a combination
  const u = sqUnderstand(q, F);
  const parts = (u.hex ? 1 : 0) + (u.painter ? 1 : 0) + u.pieces.length;
  const combo = parts >= 2 || (parts === 1 && u.pieces.length === 1 && u.pieces[0].kind === "subj");
  const thumbIcon = r => { const th = r.first >= 0 ? pmThumb(r.first, F) : null; return { t: "portrait", url: th ? th.url : "", initial: "", bg: r.first >= 0 ? pmHex(r.first, F) : "#3A3630", square: true }; };
  if (combo) {
    const sp = sqSpecOf(u, F), label = sqComboLabel(u) + (u.left.length ? ` · left out “${u.left.join(" ")}”` : "");
    G("paintings", "Paintings", 200, [{ id: "combo", icon: { t: "portrait", url: "", initial: "", bg: "#3A3630", square: true }, title: "Show paintings", sub: label, combo: true, act: () => pmGo(sp.spec),
      resolve() { const r = sp.count(); return r.n ? { title: "Show " + sqPaintingsN(r.n), icon: thumbIcon(r) } : { title: "No paintings match", sub: label + ". Try fewer words.", icon: { t: "glyph", name: "search" }, act: null, none: true }; } }]);
  }
  // painters, whole-query
  if (!/\d{3}/.test(q)) {
    const pr = sqFuzzyRank(sqPainters(F).filter(x => !/^artist:/i.test(x.n)), q, x => x.n, 4);
    G("painters", "Painters", pr.top, pr.hits.map(m => ({ id: "p:" + m.slug, icon: sqPainterIcon(m, F), title: m.n, sub: sqPainterSub(m), act: () => { location.hash = "#/painter/" + m.slug; } })));
  }
  // places, movements, eras (a single piece also gets its own list row)
  const rows = [], seen = new Set();
  const addPiece = piece => {
    const key = piece.kind + (piece.val || piece.vals || piece.label); if (seen.has(key)) return; seen.add(key);
    const sp = sqSpecOf({ pieces: [piece], painter: null, hex: null }, F);
    rows.push({ id: "pl:" + key, icon: sqPlaceIcon(piece), title: piece.kind === "co" || piece.kind === "when" ? "Paintings from " + piece.label : piece.label, sub: "Paintings", act: () => pmGo(sp.spec),
      resolve() { const r = sp.count(); return r.n ? { sub: sqPaintingsN(r.n) } : { hide: true }; } });
  };
  let plBest = 0;
  if (u.pieces.length === 1 && !u.hex && !u.painter && !u.left.length && u.pieces[0].kind !== "subj") { addPiece(u.pieces[0]); plBest = 120; }
  const pl = sqFuzzyRank(sqPlaces(F), q, x => x.t, 3);
  pl.hits.forEach(x => addPiece(x.piece)); plBest = Math.max(plBest, pl.top);
  G("places", "Places & eras", plBest, rows.slice(0, 4));
  if (extra) extra(G);
  return finish();
}
