"use strict";
// The one search engine (sq*). Phase 1: typo-tolerant name matching shared by every search surface.
//  - sqFold(s): lowercase, accents off, "&" -> "and", punctuation -> spaces.
//  - sqDL(a, b, max): Damerau-Levenshtein (transpositions count one), early exit past `max`.
//  - sqTol(len): the edits allowed for a word of that length (none under 4 letters, 1 for 4-7, 2 for 8+).
//  - sqFuzzyRank(items, q, textOf): rank any list by exact > prefix > word-prefix > contains > fuzzy.
//  - sqLoad(): the color-name index (~7,000 names: the 101, ~1,000 core, ~2,700 archive and every alternate
//    name, plus data/aliases.json spellings); sqColorSearch(q) ranks it and says when only fuzzy matches exist.
// Nothing here reads lazily loaded data at load time (the lazy-wiki rule).

const sqFold = s => String(s == null ? "" : s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/&/g, " and ").replace(/[^a-z0-9#]+/g, " ").trim();
const sqTol = n => n >= 7 ? 2 : n >= 4 ? 1 : 0;   // 4-6 letters: one edit; 7+: two ("fuschia")
function sqDL(a, b, max) {
  const la = a.length, lb = b.length;
  if (Math.abs(la - lb) > max) return max + 1;
  let p2 = null, p1 = Array.from({ length: lb + 1 }, (_, j) => j);
  for (let i = 1; i <= la; i++) {
    const cur = [i]; let lo = i;
    for (let j = 1; j <= lb; j++) {
      const c = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      let v = Math.min(p1[j] + 1, cur[j - 1] + 1, p1[j - 1] + c);
      if (i > 1 && j > 1 && a.charCodeAt(i - 1) === b.charCodeAt(j - 2) && a.charCodeAt(i - 2) === b.charCodeAt(j - 1)) v = Math.min(v, p2[j - 2] + 1);
      cur[j] = v; if (v < lo) lo = v;
    }
    if (lo > max) return max + 1;
    p2 = p1; p1 = cur;
  }
  return p1[lb];
}
// A pre-folded record: { k: "faded purple", kn: "fadedpurple", w: ["faded","purple"] }
const sqRec = text => { const k = sqFold(text); return { k, kn: k.replace(/ /g, ""), w: k ? k.split(" ") : [] }; };
// Score of one record against a query (0 = no match). `fuzzy` switches the typo pass on.
function sqScore(Q, r, fuzzy) {
  const { k, kn, w } = r;
  if (!k) return 0;
  if (k === Q.k) return 100;
  if (kn === Q.kn) return 97;
  if (k.startsWith(Q.k)) return 90 - Math.min(10, (k.length - Q.k.length) / 4);
  // every query word starts a different word of the name, in any order ("purple faded")
  if ((Q.w.length > 1 || w.length > 1) && Q.w.every(t => kn.includes(t))) {
    const used = new Set(); let ok = Q.w.length <= w.length;
    for (const t of Q.w) { if (!ok) break; const j = w.findIndex((x, i) => !used.has(i) && x.startsWith(t)); if (j < 0) ok = false; else used.add(j); }
    if (ok) return 80 - Math.min(8, w.length - Q.w.length);
  }
  if (kn.startsWith(Q.kn)) return 74;
  if (w.some(x => x.startsWith(Q.k))) return 68;
  if (k.includes(Q.k)) return 55;
  if (kn.includes(Q.kn) && Q.kn.length >= 4) return 48;
  if (!fuzzy) return 0;
  // typos: the whole name run together ("dustyviolet", "vermillion"), or each query word against a different word
  const t = sqTol(Q.kn.length);
  if (t) { const d = sqDL(Q.kn, kn, t); if (d <= t) return 44 - d * 6; if (kn.length > Q.kn.length + 1 && kn.charCodeAt(0) === Q.kn.charCodeAt(0)) { const d2 = sqDL(Q.kn, kn.slice(0, Q.kn.length), t); if (d2 <= t) return 36 - d2 * 6; } }
  if (Q.w.length >= 1 && w.length >= 1) {
    const used = new Set(); let cost = 0;
    for (const q of Q.w) {
      const tq = sqTol(q.length) || (Q.w.length > 1 && q.length === 3 ? 1 : 0); let best = -1, bd = 9;
      for (let i = 0; i < w.length; i++) {
        if (used.has(i)) continue;
        const x = w[i]; let d = x.startsWith(q) ? 0 : tq && x.charCodeAt(0) === q.charCodeAt(0) && Math.abs(x.length - q.length) <= tq ? sqDL(q, x, tq) : (x === q ? 0 : 9);
        if (d < bd) { bd = d; best = i; if (!d) break; }
      }
      if (best < 0 || bd > tq) return 0;
      used.add(best); cost += bd;
    }
    return 40 - cost * 6;
  }
  return 0;
}
const sqQuery = q => { const r = sqRec(q); return r; };
// Rank any list. Returns the items (best first) and whether only typo matches were found.
function sqFuzzyRank(items, q, textOf, limit = 20) {
  const Q = sqQuery(q); if (!Q.k) return { hits: [], fuzzy: false };
  const recs = items.map(it => it._sq || (typeof it === "object" ? (it._sq = sqRec(textOf(it))) : sqRec(textOf(it))));
  const run = fz => { const out = []; items.forEach((it, i) => { const s = sqScore(Q, recs[i], fz); if (s) out.push([s, i]); }); return out; };
  let out = run(false), fuzzy = false;
  if (out.length < 3) { out = run(true); fuzzy = out.length > 0 && !out.some(x => x[0] >= 48); }
  out.sort((a, b) => b[0] - a[0] || recs[a[1]].k.length - recs[b[1]].k.length);
  return { hits: out.slice(0, limit).map(x => items[x[1]]), fuzzy, top: out.length ? out[0][0] : 0 };
}

// ---------- the color-name index ----------
let SQ_NAMES = null, SQ_NAMES_KEY = "", SQ_LOADING = null, SQ_ALIASES = null;
function sqLoad() {
  if (SQ_LOADING) return SQ_LOADING;
  const get = typeof l18Get === "function" ? l18Get : p => fetch(p).then(r => r.ok ? r.json() : null).catch(() => null);
  return (SQ_LOADING = Promise.all([typeof loadCoreNames === "function" ? loadCoreNames() : null, typeof loadLongNames === "function" ? loadLongNames() : null, get("data/aliases.json")])
    .then(([, , al]) => { SQ_ALIASES = al || {}; SQ_NAMES = null; return true; }).catch(() => { SQ_LOADING = null; return false; }));
}
const sqReady = () => !!(SQ_ALIASES && typeof CORE_NAMES !== "undefined" && CORE_NAMES && typeof LONG_NAMES !== "undefined" && LONG_NAMES);
function sqNames() {
  const key = [(typeof CORE_NAMES !== "undefined" && CORE_NAMES || []).length, (typeof LONG_NAMES !== "undefined" && LONG_NAMES || []).length, SQ_ALIASES ? 1 : 0].join("|");
  if (SQ_NAMES && SQ_NAMES_KEY === key) return SQ_NAMES;
  const out = [], seen = new Map();
  const add = (n, h, to, alt, of) => {
    const rec = sqRec(n); if (!rec.k) return;
    const id = rec.k; const have = seen.get(id);
    if (have) { if (!alt && have.alt) { Object.assign(have, { n, h, to, alt: false, of: "" }); } return; }
    const e = { n, h, to, alt: !!alt, of: of || "", ...rec }; seen.set(id, e); out.push(e);
  };
  const slug = typeof routeSlug === "function" ? routeSlug : s => sqFold(s).replace(/ /g, "-");
  [...(typeof BASICS !== "undefined" ? BASICS : []), ...(typeof ALL !== "undefined" ? ALL : [])].forEach(c => add(c.n, c.h, slug(c.n), false));
  (CORE_NAMES || []).forEach(e => add(e.n, e.h, slug(e.n), false));
  (LONG_NAMES || []).forEach(e => add(e.n, e.h, slug(e.n), false));
  (CORE_NAMES || []).forEach(e => (e.also || []).forEach(a => add(String(a), e.h, slug(e.n), true, e.n)));
  (LONG_NAMES || []).forEach(e => (e.altn || []).forEach(a => add(a.n, e.h, slug(e.n), true, e.n)));
  const byName = new Map(out.filter(e => !e.alt).map(e => [e.k, e]));
  Object.entries((SQ_ALIASES && SQ_ALIASES.names) || {}).forEach(([a, t]) => { const tg = byName.get(sqFold(t)); if (tg) add(a, tg.h, tg.to, true, tg.n); });
  SQ_NAMES = out; SQ_NAMES_KEY = key;
  return out;
}
// -> { hits: [{ n, h, to, alt, of }], fuzzy, didYouMean }   (hits dedupe by destination page: the best-scoring name wins)
function sqColorSearch(q, limit = 10) {
  const Q = sqQuery(q); if (!Q.k || Q.k === "#") return { hits: [], fuzzy: false, didYouMean: "" };
  const list = sqNames(), run = fz => { const o = []; for (let i = 0; i < list.length; i++) { const e = list[i]; const s = sqScore(Q, e, fz); if (s) o.push([s - (e.alt ? 3 : 0), e]); } return o; };
  let out = run(false), fuzzy = false;
  if (out.length < 4) { const f = run(true); if (f.length > out.length) { out = f; fuzzy = !f.some(x => x[0] >= 48); } }
  out.sort((a, b) => b[0] - a[0] || a[1].k.length - b[1].k.length);
  // an exact hit that is only somebody's alternate name ("Vermillion", listed under Scarlet) yields to a real name
  // one letter away ("Vermilion"): the spelling variant of a name beats a synonym of another color
  if (out.length && out[0][1].alt && out[0][1].kn === Q.kn && Q.kn.length >= 6) {
    const near = list.find(e => !e.alt && e.kn !== Q.kn && Math.abs(e.kn.length - Q.kn.length) <= 1 && sqDL(Q.kn, e.kn, 1) <= 1);
    if (near) out.unshift([101, near]);
  }
  const seen = new Set(), hits = [];
  for (const [, e] of out) { const key = e.to + (e.alt ? "|" + e.k : ""); if (seen.has(key)) continue; seen.add(key); hits.push(e); if (hits.length >= limit) break; }
  return { hits, fuzzy, didYouMean: fuzzy && hits[0] ? hits[0].n : "", top: out.length ? out[0][0] : 0 };
}
// open one result's color page: always by its own name's address (never the nearest core name's)
function sqOpenColor(e) { location.hash = "#/color/" + (typeof routeSlug === "function" ? routeSlug(e.alt ? e.n : e.to) : e.to); }

// an exact name (or its run-together spelling) -> its entry, preferring a real name over somebody's alternate
let SQ_EXACT = null, SQ_EXACT_FOR = null;
function sqColorExact(text) {
  const list = sqNames();
  if (SQ_EXACT_FOR !== list) {
    SQ_EXACT = new Map(); SQ_EXACT_FOR = list;
    list.forEach(e => { if (!SQ_EXACT.has(e.k) || (SQ_EXACT.get(e.k).alt && !e.alt)) SQ_EXACT.set(e.k, e); });
  }
  const r = sqRec(text); return SQ_EXACT.get(r.k) || null;
}
