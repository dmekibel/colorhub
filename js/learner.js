"use strict";
// The Learner Model: the one owner of "what this person knows, confuses, sees and loves" (design/GENIUS-PANEL-1.md
// §2.1, lane L20). Every screen writes here with one call and reads with a handful of readers, so a color page can
// say "you mixed this up with teal", a deck can drill your real mix-ups and Explore can show the edge of your map.
//
// Storage: S.learn (inside colorhub-v1, migrated by migrateState in js/core.js; never wiped).
//   ev    the recent events, oldest first, at most LN_CAP. Each is compact: { t: ms, e: type, c?: name, h?: hex,
//         b?: other name, hb?: other hex, ok?: 1|0, by?, ms?, src?, set?: set key }.
//   agg   what older events added up to once compacted: per color { n, h, s seen, a answers, r right, f finds,
//         l likes, t0 first, t1 last, ok last right, no last wrong, cf last mix-up, ck last check { ok, t } } and
//         per pair (unordered) { ka, kb, a, ha, b, hb, ab, ba, t }. Readers always combine agg + ev, so nothing
//         is lost when the log is trimmed.
//   sets  the color sets you looked at or kept (paintings, photos, palettes): { k kind, id, title, hs hexes,
//         sh shares, src, t, s seen count, l liked count }, at most LN_SETS, newest kept.
//   bf    1 once older progress (cards, palettes, daily answers) has been folded in, so old users aren't empty.
//
// Write:  learnerLog({ type, color, ok, by, ms, b, set, src })   -> true if logged. Never throws.
//   type "seen"    color or set, src: page | painting | photo | poem | flower | gem | fashion | film | lesson
//        "answer"  color, ok, by: swipe | pick | say | type | make | game, ms (optional)
//        "confuse" color = the right answer, b = what was answered instead, src
//        "find"    color, src: camera | photo
//        "like"    color or set
// Read:   knowState(c) · confusions(c?, n) · eyeThreshold(family, axis) · interests() · trail(n) · seenIn(c, n)
//         · edgeOfMap(n) · relMark(c) / relMarkHTML(c).  Aliases from the panel: lmLog, lmStatus, lmPairs, lmSeen, lmEdge.
// A color can be a name ("Teal"), a hex ("#008080") or an object with n and/or h.

const LN_CAP = 5000, LN_KEEP = 4000, LN_SETS = 200;
const LN_TYPES = ["seen", "answer", "confuse", "find", "like"];
const LN_CHECKS = ["pick", "say", "type", "make", "game"];   // graded by the app (a swipe is self-graded practice)
let LN_REV = 0, LN_IX = null, LN_IX_REV = -1, LN_SAVE_T = 0;

const lnSlug = s => String(s).normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const lnHex = h => /^#?[0-9a-f]{6}$/i.test(String(h || "")) ? "#" + String(h).replace("#", "").toUpperCase() : null;
const lnDay = t => keyOf(new Date(t - 4 * 3600e3));   // a day starts at 4am, like today() in core.js
const lnFresh = () => ({ v: 1, ev: [], agg: { c: {}, p: {} }, sets: {}, bf: 0 });

// any color shape -> { n?, h? } | null. A plain name is looked up so its hex rides along.
function lnColor(x) {
  if (!x) return null;
  if (typeof x === "string") {
    const h = lnHex(x); if (h) return { h };
    const lo = x.trim().toLowerCase(); if (!lo) return null;
    const c = BYNAME.get(lo) || (typeof CORE_NAMES !== "undefined" && CORE_NAMES ? CORE_NAMES.find(e => e.n.toLowerCase() === lo) : null);
    return c ? { n: c.n, h: lnHex(c.h) } : { n: x.trim() };
  }
  if (typeof x === "object") {
    const n = x.n || x.name || null, h = lnHex(x.h || x.hex);
    return n || h ? { n: n ? String(n) : undefined, h } : null;
  }
  return null;
}
const lnKeyOf = c => c ? (c.n ? lnSlug(c.n) : c.h ? c.h.toLowerCase() : null) : null;
const lnKey = x => lnKeyOf(lnColor(x));

// S.learn, repaired in place if a field is missing or the wrong shape (never thrown away)
function lnS() {
  let L = S.learn;
  if (!L || typeof L !== "object" || Array.isArray(L)) { if (L != null) S.learnUnreadable = L; L = S.learn = lnFresh(); }
  if (!Array.isArray(L.ev)) L.ev = [];
  if (!L.agg || typeof L.agg !== "object") L.agg = { c: {}, p: {} };
  if (!L.agg.c || typeof L.agg.c !== "object") L.agg.c = {};
  if (!L.agg.p || typeof L.agg.p !== "object") L.agg.p = {};
  if (!L.sets || typeof L.sets !== "object" || Array.isArray(L.sets)) L.sets = {};
  return L;
}
function lnSaveSoon() {
  if (LN_SAVE_T) return;
  LN_SAVE_T = setTimeout(() => { LN_SAVE_T = 0; save(); }, 900);
}
function lnFlush() { if (LN_SAVE_T) { clearTimeout(LN_SAVE_T); LN_SAVE_T = 0; save(); } }

// a set (anything with kind/id/colors, e.g. colorSet() in js/colorset.js) -> its key in S.learn.sets
function lnSetKeep(set, t, how = "s") {
  const L = lnS();
  if (typeof set === "string") return L.sets[set] ? set : null;
  if (!set || typeof set !== "object") return null;
  const kind = String(set.kind || "set"), id = String(set.id != null ? set.id : ""), key = set.key || kind + ":" + id;
  const cols = (set.colors || []).map(c => typeof c === "string" ? { h: c } : c || {}).filter(c => lnHex(c.h)).slice(0, 12);
  if (!cols.length) return null;
  const old = L.sets[key] || {};
  L.sets[key] = { k: kind, id, title: String(set.title || old.title || "").slice(0, 80), hs: cols.map(c => lnHex(c.h)),
    sh: cols.some(c => c.share != null) ? cols.map(c => c.share != null ? Math.round(c.share * 1000) / 1000 : null) : undefined,
    src: set.src ? String(set.src).slice(0, 80) : old.src, t: Math.max(t, old.t || 0), s: (old.s || 0) + (how === "s" ? 1 : 0), l: (old.l || 0) + (how === "l" ? 1 : 0) };
  const keys = Object.keys(L.sets);
  if (keys.length > LN_SETS) keys.sort((a, b) => L.sets[a].t - L.sets[b].t).slice(0, keys.length - LN_SETS).forEach(k => { delete L.sets[k]; });
  return key;
}

// ---------- the one write call ----------
function learnerLog(evt) {
  try {
    if (!evt || typeof S === "undefined" || !S) return false;
    const e = evt.type || evt.e;
    if (!LN_TYPES.includes(e)) return false;
    const r = { t: +evt.at > 0 ? +evt.at : Date.now(), e };
    const a = lnColor(evt.color || evt.c || evt.a), b = lnColor(evt.b || evt.as);
    if (a) { if (a.n) r.c = a.n; if (a.h) r.h = a.h; }
    if (b) { if (b.n) r.b = b.n; if (b.h) r.hb = b.h; }
    if (e === "answer") { r.ok = evt.ok ? 1 : 0; r.by = String(evt.by || "swipe"); if (+evt.ms > 0) r.ms = Math.round(+evt.ms); }
    if (evt.src) r.src = String(evt.src).slice(0, 24);
    if (e === "confuse" && (!a || !b || lnKeyOf(a) === lnKeyOf(b))) return false;
    if (evt.set && (e === "seen" || e === "like")) { const k = lnSetKeep(evt.set, r.t, e === "like" ? "l" : "s"); if (k) r.set = k; }
    if (!r.c && !r.h && !r.set) return false;
    const L = lnS();
    L.ev.push(r);
    if (L.ev.length > LN_CAP) lnCompact(L);
    LN_REV++;
    lnSaveSoon();
    return true;
  } catch (err) { return false; }
}

// fold one event into running totals (used for compaction and for the read index)
function lnFold(acc, r) {
  const k = r.c ? lnSlug(r.c) : r.h ? r.h.toLowerCase() : null;
  const entry = (key, n, h, t) => {
    const x = acc.c[key] || (acc.c[key] = { n, h, s: 0, a: 0, r: 0, f: 0, l: 0, t0: t, t1: t });
    if (!x.n && n) x.n = n; if (!x.h && h) x.h = h;
    if (t < x.t0) x.t0 = t; if (t > x.t1) x.t1 = t;
    return x;
  };
  if (k) {
    const x = entry(k, r.c, r.h, r.t);
    if (r.e === "seen") x.s++;
    else if (r.e === "find") x.f++;
    else if (r.e === "like") x.l++;
    else if (r.e === "answer") {
      x.a++;
      if (r.ok) { x.r++; x.ok = Math.max(x.ok || 0, r.t); } else x.no = Math.max(x.no || 0, r.t);
      if (LN_CHECKS.includes(r.by) && (!x.ck || r.t >= x.ck.t)) x.ck = { ok: r.ok ? 1 : 0, t: r.t };
    } else if (r.e === "confuse") x.cf = Math.max(x.cf || 0, r.t);
  }
  if (r.e === "confuse" && k) {
    const kb = r.b ? lnSlug(r.b) : r.hb ? r.hb.toLowerCase() : null;
    if (!kb || kb === k) return;
    const y = entry(kb, r.b, r.hb, r.t); y.cf = Math.max(y.cf || 0, r.t);
    const first = k < kb, pk = first ? k + "|" + kb : kb + "|" + k;
    const p = acc.p[pk] || (acc.p[pk] = first ? { ka: k, kb, a: r.c, ha: r.h, b: r.b, hb: r.hb, ab: 0, ba: 0, t: 0 } : { ka: kb, kb: k, a: r.b, ha: r.hb, b: r.c, hb: r.h, ab: 0, ba: 0, t: 0 });
    if (first) p.ab++; else p.ba++;   // ab: the answer was a and you said b
    if (r.t > p.t) p.t = r.t;
  }
}
// the oldest events beyond LN_KEEP are folded into agg, then dropped
function lnCompact(L) {
  const drop = L.ev.length - LN_KEEP;
  if (drop <= 0) return;
  L.ev.splice(0, drop).forEach(r => lnFold(L.agg, r));
  L.cn = (L.cn || 0) + drop;
  LN_REV++;
}
// agg + the live log, cached until the next write
function lnIndex() {
  const L = lnS();
  if (LN_IX && LN_IX_REV === LN_REV && LN_IX.L === L && LN_IX.n === L.ev.length) return LN_IX;
  const acc = { c: {}, p: {} };
  for (const k in L.agg.c) { const x = L.agg.c[k]; acc.c[k] = { ...x, ck: x.ck ? { ...x.ck } : undefined }; }
  for (const k in L.agg.p) acc.p[k] = { ...L.agg.p[k] };
  L.ev.forEach(r => lnFold(acc, r));
  LN_IX = { L, n: L.ev.length, c: acc.c, p: acc.p }; LN_IX_REV = LN_REV;
  return LN_IX;
}

// ---------- readers ----------
// "none" | "met" | "learning" | "yours". The app's taught colors go by their review card (S.cards, isMine in
// pickit.js: picked or named right a day or more after learning). Any other color goes by the log, with the same
// rule: an app-graded check right, on a later day than you first met it, and not missed since.
function knowState(color) {
  try {
    let c = lnColor(color); if (!c) return "none";
    if (!c.n && c.h && typeof nameOf === "function" && typeof VERY_CLOSE_DE !== "undefined") { const nm = nameOf(c.h); if (nm.n && nm.de < VERY_CLOSE_DE) c = { n: nm.n, h: c.h }; }
    const app = c.n ? BYNAME.get(c.n.toLowerCase()) : null;
    if (app && app.basic && S.placed) return "yours";   // basics are placement-only: passing placement covers them
    if (app && app.id && !app.basic) {
      const st = S.cards && S.cards[app.id];
      if (st && typeof isMine === "function" && isMine(st)) return "yours";
      if (st) return "learning";
    }
    // any other learnable color can have a review card too (core:<slug> / lib:<slug>, js/learnmore.js)
    if (!app && c.n && typeof cardIdFor === "function") {
      const st = S.cards && S.cards[cardIdFor(c)];
      if (st && typeof isMine === "function" && isMine(st)) return "yours";
      if (st) return "learning";
    }
    const x = lnIndex().c[lnKeyOf(c)];
    if (!x) return "none";
    if (x.ck && x.ck.ok && lnDay(x.ck.t) > lnDay(x.t0)) return "yours";
    if (x.a) return "learning";
    return "met";
  } catch (e) { return "none"; }
}
// the top mix-up pairs, most frequent first: [{ a, ha, b, hb, n, ab, ba, last }]. ab = times the answer was a and
// you said b, ba = the reverse. With a color, only its pairs, with that color as a.
function confusions(color, n = 5) {
  try {
    const ix = lnIndex(), k = color ? lnKey(color) : null;
    let list = Object.values(ix.p).filter(p => p.ab + p.ba > 0);
    if (k) list = list.filter(p => p.ka === k || p.kb === k).map(p => p.ka === k ? p : { ...p, a: p.b, ha: p.hb, b: p.a, hb: p.ha, ab: p.ba, ba: p.ab });
    return list.map(p => ({ a: p.a || p.ha, ha: p.ha || null, b: p.b || p.hb, hb: p.hb || null, n: p.ab + p.ba, ab: p.ab, ba: p.ba, last: p.t }))
      .sort((x, y) => y.n - x.n || y.last - x.last).slice(0, n);
  } catch (e) { return []; }
}
// family: "blues" | "Blues" | "blue" | a hex. axis: "hue" (ΔE00, the odd-one-out station, per family when known)
// | "light" (ΔL*, Which is lighter). The smallest difference you reliably see, or null before you've trained it.
// The Train lane's own estimator wins when it exists: trEyeThreshold(family, axis).
const LN_FAMS = ["Reds", "Pinks", "Oranges", "Browns", "Yellows", "Greens", "Blues", "Purples", "Greys"];
function lnFam(f) {
  if (!f) return null;
  if (lnHex(f)) return typeof setFamily === "function" ? setFamily(lnHex(f)) : null;
  let s = String(f).trim().toLowerCase().replace(/^gray/, "grey"); if (!s.endsWith("s")) s += "s";
  return LN_FAMS.find(x => x.toLowerCase() === s) || null;
}
function eyeThreshold(family, axis = "hue") {
  try {
    if (typeof trEyeThreshold === "function") { const v = trEyeThreshold(family, axis); if (v != null) return v; }
    const sk = (S.gym && S.gym.skills) || {}, fam = lnFam(family);
    const last = k => { const h = (sk[k] && sk[k].hist) || []; return h.length ? +h[h.length - 1][1] : null; };
    if (axis === "light" || axis === "L" || axis === "lightness") { const v = last("value"); return v != null ? v : last("shade"); }
    if (!axis || axis === "hue" || axis === "de") { const f = sk.hue && sk.hue.fam; if (fam && f && f[fam] != null) return +f[fam]; return last("hue"); }
    return null;   // chroma: no station measures it on its own yet
  } catch (e) { return null; }
}
// interests as strands (design/JOURNEY.md §8): what you look at, find and keep, recent weighted most
// (half-life 30 days, a like counts 3). [{ strand, w, n, on? }], strongest first. S.interests (Journey's
// "What do you love?") marks strands switched on.
const LN_STRAND = { painting: "painting", gallery: "painting", museum: "painting", painter: "painting", poem: "poem", passage: "prose", prose: "prose",
  flower: "flower", botany: "flower", plant: "flower", gem: "gem", fashion: "fashion", film: "film", page: "article", article: "article", story: "story",
  photo: "photo", camera: "photo", palette: "palette" };
function interests() {
  try {
    const L = lnS(), now = Date.now(), w = {}, n = {};
    const add = (k, v) => { if (!k) return; w[k] = (w[k] || 0) + v; n[k] = (n[k] || 0) + 1; };
    L.ev.forEach(r => {
      if (r.e !== "seen" && r.e !== "like" && r.e !== "find") return;
      const kind = r.src || (r.set ? r.set.split(":")[0] : "");
      add(LN_STRAND[kind], Math.pow(.5, (now - r.t) / (30 * 864e5)) * (r.e === "like" ? 3 : 1));
    });
    const on = S.interests && typeof S.interests === "object" ? S.interests : {};
    const out = Object.keys(w).map(k => ({ strand: k, w: Math.round(w[k] * 100) / 100, n: n[k] }));
    Object.keys(on).forEach(k => { if (!on[k]) return; const x = out.find(o => o.strand === k); if (x) x.on = true; else out.push({ strand: k, w: 0, n: 0, on: true }); });
    return out.sort((a, b) => (b.on ? 1 : 0) - (a.on ? 1 : 0) || b.w - a.w);
  } catch (e) { return []; }
}
const lnSetOut = (key, s, t) => ({ key, kind: s.k, id: s.id, title: s.title, colors: (s.hs || []).map((h, i) => s.sh && s.sh[i] != null ? { h, share: s.sh[i] } : { h }), src: s.src || "", t });
// what you looked at most recently, newest first, one entry each: sets (paintings, photos, palettes) and color
// pages ({ kind: "color" }). Same shape as colorSet() plus t.
function trail(n = 8) {
  try {
    const L = lnS(), out = [], got = new Set();
    for (let i = L.ev.length - 1; i >= 0 && out.length < n; i--) {
      const r = L.ev[i]; if (r.e !== "seen") continue;
      if (r.set) { if (got.has(r.set) || !L.sets[r.set]) continue; got.add(r.set); out.push(lnSetOut(r.set, L.sets[r.set], r.t)); }
      else if (r.c) { const k = "color:" + lnSlug(r.c); if (got.has(k)) continue; got.add(k); out.push({ key: k, kind: "color", id: lnSlug(r.c), title: r.c, colors: r.h ? [{ h: r.h, n: r.c }] : [], src: "", t: r.t }); }
    }
    if (out.length < n) Object.keys(L.sets).filter(k => !got.has(k) && L.sets[k].s > 0).sort((a, b) => L.sets[b].t - L.sets[a].t)
      .slice(0, n - out.length).forEach(k => out.push(lnSetOut(k, L.sets[k], L.sets[k].t)));
    return out;
  } catch (e) { return []; }
}
// the sets you've seen or kept that hold this color (a swatch within ΔE00 5), newest first
function seenIn(color, n = 6) {
  try {
    const c = lnColor(color); if (!c || !c.h) return [];
    const L = lnS(), Lc = lab(c.h);
    return Object.keys(L.sets).sort((a, b) => L.sets[b].t - L.sets[a].t)
      .filter(k => (L.sets[k].hs || []).some(h => de2000(Lc, lab(h)) <= 5)).slice(0, n).map(k => lnSetOut(k, L.sets[k], L.sets[k].t));
  } catch (e) { return []; }
}
// the edge of your map: names you haven't met that sit right next to colors that are yours (their look-alikes
// among the taught names and, once loaded, the ~1,000 core names). [{ n, h, de, from: [your neighbors] }]
function edgeOfMap(n = 12) {
  try {
    let base = ALL.filter(c => S.cards[c.id] && typeof isMine === "function" && isMine(S.cards[c.id]));
    if (!base.length) base = ALL.filter(c => S.cards[c.id]);
    const ix = lnIndex();
    Object.values(ix.c).forEach(x => { if (x.n && x.h && !BYNAME.has(x.n.toLowerCase()) && knowState(x) === "yours") base.push({ n: x.n, h: x.h }); });
    base = base.slice(-80);
    const cand = new Map(), lib = typeof CORE_NAMES !== "undefined" && CORE_NAMES && typeof nearestCore === "function" ? CORE_NAMES : null;
    base.forEach(y => {
      const near = typeof lookalikes === "function" ? lookalikes(y, 6).map(o => ({ x: o.x, d: o.d })) : [];
      if (lib) nearestCore(y.h, lib, 7).forEach(e => { if (e.n.toLowerCase() !== y.n.toLowerCase()) near.push({ x: { n: e.n, h: e.h }, d: e.de }); });
      near.forEach(({ x, d }) => {
        if (d > 15 || x.basic || knowState(x) !== "none") return;
        const k = x.n.toLowerCase(), cur = cand.get(k) || { n: x.n, h: x.h, de: d, from: [], score: 0 };
        if (!cur.from.includes(y.n)) cur.from.push(y.n);
        cur.de = Math.min(cur.de, d); cur.score += 1 / (1 + d);
        cand.set(k, cur);
      });
    });
    return [...cand.values()].sort((a, b) => b.score - a.score || a.de - b.de).slice(0, n)
      .map(x => ({ n: x.n, h: x.h, de: Math.round(x.de * 10) / 10, from: x.from.slice(0, 3) }));
  } catch (e) { return []; }
}

// ---------- the relation mark: one mark on every chip (design/GENIUS-PANEL-1.md, the Apple row) ----------
// "" (unmet: no mark) | "met" (an outline ring; also while learning) | "yours" (a solid disc) | "confused" (you mixed
// it up with a neighbor, and haven't got it right since). css/learner.css has a minimal style; L12 owns the look.
function relMark(color) {
  try {
    const s = knowState(color);
    const x = lnIndex().c[lnKey(color)];
    if (x && x.cf && x.cf > (x.ok || 0)) return "confused";
    return s === "yours" ? "yours" : s === "none" ? "" : "met";
  } catch (e) { return ""; }
}
const LN_REL_LABEL = { met: "You've met this color", yours: "Yours", confused: "You've mixed this one up" };
function relMarkHTML(color) {
  const s = relMark(color);
  return s ? `<i class="rel-mark" data-s="${s}" role="img" aria-label="${LN_REL_LABEL[s]}" title="${LN_REL_LABEL[s]}"></i>` : "";
}

// ---------- backfill: older saves fold in once, so nobody starts empty ----------
function lnBackfill(L) {
  const dayT = k => { const [y, m, d] = String(k || "").split("-").map(Number); return y && m && d ? new Date(y, m - 1, d, 12).getTime() : 0; };
  const byId = new Map(ALL.map(c => [c.id, c]));
  Object.keys(S.cards || {}).forEach(id => {
    const st = S.cards[id], c = byId.get(id); if (!st || !c) return;
    const t0 = dayT(st.since) || Date.now(), k = lnSlug(c.n);
    const x = L.agg.c[k] || (L.agg.c[k] = { n: c.n, h: c.h, s: 0, a: 0, r: 0, f: 0, l: 0, t0, t1: t0 });
    x.t0 = Math.min(x.t0, t0); x.t1 = Math.max(x.t1, dayT(st.last) || t0);
    if (typeof isMine === "function" && isMine(st)) x.ck = { ok: 1, t: dayT(st.ownAt) || x.t1 };
  });
  // the color of the day: a named guess, right or wrong
  Object.keys(S.daily || {}).forEach(day => {
    const d = S.daily[day]; if (!d || !d.n) return;
    const c = lnColor(d.n), t = dayT(day); if (!c || !t) return;
    const k = lnKeyOf(c), x = L.agg.c[k] || (L.agg.c[k] = { n: c.n, h: c.h, s: 0, a: 0, r: 0, f: 0, l: 0, t0: t, t1: t });
    x.a++; if (d.ok) { x.r++; x.ok = Math.max(x.ok || 0, t); } else x.no = Math.max(x.no || 0, t);
    x.t0 = Math.min(x.t0, t); x.t1 = Math.max(x.t1, t);
  });
  // kept palettes are liked sets
  (Array.isArray(S.palettes) ? S.palettes : []).forEach(p => {
    if (p && Array.isArray(p.cols)) lnSetKeep({ kind: "palette", id: p.id || "", title: p.name || p.from || "Palette", colors: p.cols.map(h => ({ h })), src: p.id ? "studio/palette/" + p.id : "" }, dayT(p.at) || Date.now(), "l");
  });
  L.bf = 1;
}
function lnInit() {
  try {
    const L = lnS();
    if (!L.bf) { lnBackfill(L); LN_REV++; lnSaveSoon(); }
  } catch (e) {}
}
lnInit();
if (typeof addEventListener === "function") { addEventListener("pagehide", lnFlush); addEventListener("visibilitychange", () => { if (typeof document !== "undefined" && document.hidden) lnFlush(); }); }

// the names design/GENIUS-PANEL-1.md §2.1 uses, so either spelling works
const lmLog = learnerLog, lmStatus = knowState, lmPairs = confusions, lmSeen = seenIn, lmEdge = edgeOfMap;
