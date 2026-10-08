"use strict";
// The Learn room, version 2 (design/LEARN-ROOM-2.md; David, 2026-10-09: "I feel stuck on blue forever").
// The mixed Study session (js/learnset.js lsStudy: meet, then the games, climbing) is the room's spine. Everything
// here only chooses WHAT goes into it, and every door opens the same Study sheet (lsOpen) as the map does:
//   For you        due reviews first (asked, never shown first), then mix-ups, colors you looked at, the edge of
//                  your map, then new names at your level (the learning order; placement sets where it starts)
//   Your wheel     the nine families around the hue circle, each wedge filling as names become yours; a tap studies
//                  that family's next colors at your level
//   Or choose      colors you looked at, favorites, mix-ups, a painting's colors, surprise me, your own deck
// Nothing is locked and no unit has to be finished first. Progress is the Learner Model's (knowState), so the cards
// the old path wrote show up in the wheel as they are: nothing in the save changes.

// the nine families, around the hue circle (prFam9's bands), each with a plain color for its wedge
const LH_FAMS = [["Reds", "#C0392F"], ["Oranges", "#E2803A"], ["Browns", "#8E5B36"], ["Yellows", "#E4C040"], ["Greens", "#4E9A5E"],
  ["Blues", "#3F70B8"], ["Purples", "#7C51A0"], ["Pinks", "#E48DAD"], ["Greys", "#93908A"]];
const LH_FY_N = 12, LH_FY_MAX = 24, LH_FAM_N = 20, LH_GAP = 4;

// ---------- the pool: the Learn layer (~1,000 names), no basics, each with its family and place in the learning order ----------
let LH_POOL = null, LH_POOL_SRC = null;
function lhPool() {
  const core = prCore();
  if (LH_POOL && LH_POOL_SRC === core) return LH_POOL;
  const order = new Map();
  try { learnUnitsAll().forEach(u => u.colors.forEach(c => { const k = String(c.n).toLowerCase(); if (!order.has(k)) order.set(k, order.size); })); } catch (e) {}
  const ready = order.size > 200;   // the plan has its generated units (the core list is in)
  const list = core.filter(it => { const a = BYNAME.get(it.key); return !(a && a.basic) && (!ready || order.has(it.key)); })
    .map(it => ({ it, fam: prFam9(it.h), ord: order.has(it.key) ? order.get(it.key) : 1e5 + (it.useRank != null ? it.useRank : it.rank) }))
    .sort((a, b) => a.ord - b.ord);
  LH_POOL_SRC = core; LH_POOL = list;
  return list;
}
const lhBasic = it => { const a = it && BYNAME.get(String(it.n || it.key || "").toLowerCase()); return !!(a && a.basic); };
const lhNew = k => k === "none" || k === "met";   // met = seen on a page, not learned yet
const lhItem = x => { try { return x ? prSeed(typeof x === "string" ? x : { n: x.n, h: x.h }) : null; } catch (e) { return null; } };

// ---------- where you stand: every name's state, per family and in all ----------
function lhStats() {
  const pool = lhPool(), know = new Map(), fams = {};
  LH_FAMS.forEach(([f]) => { fams[f] = { yours: 0, learning: 0, none: 0, total: 0 }; });
  let yours = 0, learning = 0;
  pool.forEach(p => {
    const k = lsKnow(p.it); know.set(p.it.key, k);
    const f = fams[p.fam]; if (!f) return;
    f.total++;
    if (k === "yours") { f.yours++; yours++; } else if (k === "learning") { f.learning++; learning++; } else f.none++;
  });
  return { pool, know, fams, yours, learning, total: pool.length };
}
// due reviews, oldest first, as Study items
const lhDue = () => { try { return prUnique(dueList().map(c => lhItem({ n: c.n, h: c.h })).filter(it => it && !lhBasic(it))); } catch (e) { return []; } };
// a list builder that keeps every pair at least LH_GAP apart (ΔE00), unless the color is due (a due review always goes in)
function lhPicker(max) {
  const out = [], why = new Map();
  const add = (it, r, force) => {
    if (!it || out.length >= max || why.has(it.key) || lhBasic(it)) return false;
    if (!force && out.some(x => de2000(x.h, it.h) < LH_GAP)) return false;
    out.push(it); why.set(it.key, r); return true;
  };
  return { out, why, add };
}

// ---------- For you ----------
function lhForYou(st) {
  const P = lhPicker(LH_FY_MAX), open = it => st.know.get(it.key) !== "yours";
  lhDue().slice(0, 16).forEach(it => P.add(it, "due", true));
  const nDue = P.out.length;
  let n = 0;
  try { confusions(null, 6).forEach(p => [p.a, p.b].forEach(x => { const it = lhItem({ n: x, h: x === p.a ? p.ha : p.hb }); if (it && n < 4 && open(it) && P.add(it, "mix")) n++; })); } catch (e) {}
  n = 0;
  try { trail(16).filter(s => s.kind === "color").forEach(s => { const it = lhItem({ n: s.title, h: s.colors[0] && s.colors[0].h }); if (it && n < 3 && st.know.get(it.key) !== "yours" && P.add(it, "looked")) n++; }); } catch (e) {}
  n = 0;
  let edgeFrom = "";
  try { edgeOfMap(10).forEach(x => { const it = lhItem(x); if (it && n < 3 && P.add(it, "edge")) { n++; if (!edgeFrom && x.from && x.from[0]) edgeFrom = x.from[0]; } }); } catch (e) {}
  // one with a story (an iconic name, or a color from today's painting), clearly marked, for the fun of it
  const fun = lhFun(st); if (fun) P.add(fun.it, "fun");
  // then new names at your level: the current stage of the learning order (common words first), roaming across
  // every family so you're never stuck on one (round-robin, the families you're into first, two each at most)
  const want = Math.max(LH_FY_N, nDue + 4), stage = lhStage(st), byFam = new Map();
  stage.open.forEach(p => { if (!byFam.has(p.fam)) byFam.set(p.fam, []); byFam.get(p.fam).push(p); });
  const w = lhFamWeights(st), fams = [...byFam.keys()].sort((a, b) => w[b] - w[a] || a.localeCompare(b));
  for (let round = 0; round < 2 && P.out.length < want; round++) fams.forEach(f => { if (P.out.length >= want) return; const list = byFam.get(f); while (list.length) { if (P.add(list.shift().it, "new")) break; } });
  // the stage nearly done: the next names in order fill in
  for (const p of st.pool) { if (P.out.length >= want) break; if (lhNew(st.know.get(p.it.key))) P.add(p.it, "new"); }
  // everything met already: keep the ones you're still learning sharp
  if (P.out.length < 3) for (const p of st.pool) { if (P.out.length >= LH_FY_N) break; if (!lhNew(st.know.get(p.it.key))) P.add(p.it, "keep"); }
  return { items: P.out, why: P.why, nDue, edgeFrom, stage, fun };
}
// The outer progression is the learning order's stages (150 · 250 · 400 · every real word · every variation …): the
// current stage is the first one with less than 80% of its names met. Inside it nothing is ordered by family.
const LH_STAGE_MET = .8;
function lhStage(st) {
  let plan = null; try { plan = lxPlan(); } catch (e) {}
  const stages = plan && plan.stages ? plan.stages.filter(s => s.units && s.units.length) : [];
  const byKey = new Map(st.pool.map(p => [p.it.key, p]));
  for (let i = 0; i < stages.length; i++) {
    const ps = prUnique(stages[i].units.flatMap(u => u.colors).map(c => byKey.get(String(c.n).toLowerCase())).filter(Boolean).map(p => p.it)).map(it => byKey.get(it.key));
    const met = ps.filter(p => !lhNew(st.know.get(p.it.key))).length;
    if (ps.length && met / ps.length < LH_STAGE_MET) return { k: i, st: stages[i], all: ps, met, open: ps.filter(p => lhNew(st.know.get(p.it.key))) };
  }
  return { k: stages.length, st: null, all: [], met: 0, open: [] };
}
// a stage in plain words: "The first 150 words", "Fluent, about 625 words"
const lhStageName = s => s.name ? `${s.name}, ${s.approx ? "about " : ""}${s.n.toLocaleString("en-US")} words` : `The first ${s.n.toLocaleString("en-US")} words`;
// how much you're into each family: your favorites, what you looked at, and the families you tapped on the wheel
function lhFamWeights(st) {
  const w = {}; LH_FAMS.forEach(([f]) => { w[f] = 1; });
  try { Object.keys(S.favs || {}).forEach(h => { const f = prFam9(h); if (w[f] != null) w[f] += .6; }); } catch (e) {}
  try { trail(30).forEach(s => (s.colors || []).slice(0, 3).forEach(c => { const f = c.h && prFam9(c.h); if (w[f] != null) w[f] += .25; })); } catch (e) {}
  const taps = (S.lh && S.lh.fam) || {}; Object.keys(taps).forEach(f => { if (w[f] != null) w[f] += Math.min(2, .4 * taps[f]); });
  // a little daily jitter so the same family doesn't always lead
  const day = Math.floor((Date.now() - 4 * 3600e3) / 864e5);
  LH_FAMS.forEach(([f], i) => { w[f] += ((day * 7 + i * 13) % 10) / 40; });
  return w;
}
// A name with a story: iconic colors whose history is worth a detour, or one from today's painting
const LH_FUN = ["Tiffany blue", "Mountbatten pink", "Prussian blue", "Vermilion", "Celadon", "Mauve", "Indigo", "Tyrian purple", "Falu red", "Hooker's green",
  "Scheele's green", "Carmine", "Sepia", "Indian yellow", "Bistre", "Majorelle blue", "Pompeian red", "Venetian red", "Kelly green", "Byzantium", "Heliotrope", "Viridian", "Cerulean", "Puce"];
function lhFun(st) {
  const day = Math.floor((Date.now() - 4 * 3600e3) / 864e5);
  const open = LH_FUN.map(n => prByKey(n)).filter(it => it && lhNew(st.know.get(it.key)));
  if (open.length && day % 3 !== 2) return { it: open[day % open.length], why: "story" };
  // every third day: a color from today's painting you can't name yet
  const ptg = lhPainting();
  if (ptg && !ptg.mine) { const it = ptg.hs.map(h => lhItem(h)).find(x => x && !lhBasic(x) && lhNew(st.know.get(x.key))); if (it) return { it, why: "painting", title: ptg.title }; }
  return open.length ? { it: open[day % open.length], why: "story" } : null;
}
const lhWord = n => ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve"][n] || n.toLocaleString("en-US");
// the line under a set: what's in it, in a few words ("4 to recall · 2 mix-ups · 6 new at your level")
function lhWhyLine(items, why, edgeFrom) {
  const c = {}; items.forEach(it => { const r = why.get(it.key) || "new"; c[r] = (c[r] || 0) + 1; });
  const parts = [];
  if (c.due) parts.push(`${c.due} to recall`);
  if (c.mix) parts.push(c.mix === 1 ? "a mix-up" : `${c.mix} from your mix-ups`);
  if (c.looked) parts.push(`${c.looked} you looked at`);
  if (c.edge) parts.push(edgeFrom ? `${c.edge} next door to ${typeof lxLower === "function" ? lxLower(edgeFrom) : edgeFrom.toLowerCase()}` : `${c.edge} next door to yours`);
  if (c.learn) parts.push(`${c.learn} you're learning`);
  if (c.new) parts.push(`${c.new} new at your level`);
  if (c.fun) parts.push("one with a story");
  if (c.keep) parts.push(`${c.keep} to keep sharp`);
  return parts.join(" · ");
}

// ---------- one family, at your level ----------
function lhFamily(st, fam) {
  const P = lhPicker(LH_FAM_N), mine = st.pool.filter(p => p.fam === fam);
  lhDue().filter(it => prFam9(it.h) === fam).slice(0, 8).forEach(it => P.add(it, "due", true));
  mine.filter(p => st.know.get(p.it.key) === "learning").slice(0, 5).forEach(p => P.add(p.it, "learn"));
  for (const p of mine) { if (P.out.length >= LH_FAM_N) break; if (lhNew(st.know.get(p.it.key))) P.add(p.it, "new"); }
  // a family you've finished: the whole family, to keep it sharp
  if (P.out.length < 3) for (const p of mine) { if (P.out.length >= LH_FAM_N) break; P.add(p.it, "keep"); }
  return P;
}

// ---------- opening Study: the same sheet as the map ----------
function lhStudy(items, o) {
  if (!items.length) return toast("Nothing here to study yet");
  const ls = lsState(), nDue = o.nDue || 0;
  buzz(8);
  return lsOpen({ items, exact: o.exact !== false, label: o.label, title: o.title, why: o.why, src: o.src || "learn", pace: o.pace,
    size: Math.min(items.length, Math.max(nDue, Math.min(ls.size || 10, items.length))) });
}
function lhOpenFamily(fam) {
  // the families you choose lean For you toward them next time (lhFamWeights)
  S.lh = S.lh && typeof S.lh === "object" ? S.lh : {}; S.lh.fam = S.lh.fam || {}; S.lh.fam[fam] = (S.lh.fam[fam] || 0) + 1; save();
  const st = lhStats(), P = lhFamily(st, fam), w = fam.toLowerCase(), f = st.fams[fam];
  lhStudy(P.out, { label: `Your ${w}`, title: `Study <em>${esc(w)}</em>`, src: "family", nDue: P.out.filter(it => P.why.get(it.key) === "due").length,
    why: its => lhWhyLine(its, P.why) + (f && !f.none && !f.learning ? " · every one is yours" : "") });
}

// ---------- the stage test: once a stage is mostly met, a mixed recall across all of it (optional: nothing waits on it) ----------
function lhStageTest(st, stage) {
  let plan = null; try { plan = lxPlan(); } catch (e) {}
  const stages = plan && plan.stages ? plan.stages.filter(s => s.units && s.units.length) : [];
  const prev = stages[stage.k - 1]; if (!prev) return null;
  const key = String(prev.n), done = S.lh && S.lh.tested && S.lh.tested[key];
  if (done) return null;
  const byKey = new Map(st.pool.map(p => [p.it.key, p]));
  const met = prUnique(prev.units.flatMap(u => u.colors).map(c => byKey.get(String(c.n).toLowerCase())).filter(Boolean).map(p => p.it)).filter(it => !lhNew(st.know.get(it.key)));
  return met.length >= 6 ? { key, label: typeof lxStageWord === "function" ? lxStageWord(prev) : `${prev.n} words`, items: prShuffle(met).slice(0, 20) } : null;
}

// ---------- the choices ----------
function lhLooked(st) {
  const out = [];
  try { trail(40).filter(s => s.kind === "color").forEach(s => { const it = lhItem({ n: s.title, h: s.colors[0] && s.colors[0].h }); if (it && !lhBasic(it)) out.push(it); }); } catch (e) {}
  const u = prUnique(out);
  return u.filter(it => st.know.get(it.key) !== "yours").concat(u.filter(it => st.know.get(it.key) === "yours"));
}
function lhFavs() {
  const f = S.favs && typeof S.favs === "object" ? S.favs : {};
  return prUnique(Object.entries(f).sort((a, b) => String(b[1] && b[1].at || "").localeCompare(String(a[1] && a[1].at || ""))).map(([h, v]) => lhItem({ n: v && v.n, h })).filter(it => it && !lhBasic(it)));
}
function lhMix() {
  const out = [];
  try { confusions(null, 12).forEach(p => { out.push(lhItem({ n: p.a, h: p.ha })); out.push(lhItem({ n: p.b, h: p.hb })); }); } catch (e) {}
  return prUnique(out.filter(it => it && !lhBasic(it)));
}
// the last painting you looked at, else the day's painting from the museum
function lhPainting() {
  try {
    const s = trail(30).find(x => (x.kind === "painting" || x.kind === "gallery") && x.colors && x.colors.length >= 3);
    if (s) return { title: String(s.title || "A painting").split(" · ")[0], hs: s.colors.map(c => c.h), mine: true };
  } catch (e) {}
  const ps = (window.PAINTINGS || []).filter(p => p.palette && p.palette.length >= 3 && !p.stub);
  if (!ps.length) return null;
  const day = Math.floor((Date.now() - 4 * 3600e3) / 864e5), p = ps[day % ps.length];
  return { title: p.title, hs: p.palette.map(x => x.h), mine: false, thumb: p.thumb };
}
function lhSurprise(st) {
  // an open family at random, then names at your level from it, a little shuffled so it isn't the family tap again
  const open = LH_FAMS.map(([f]) => f).filter(f => st.fams[f] && st.fams[f].none > 0);
  const fam = open.length ? open[Math.floor(Math.random() * open.length)] : LH_FAMS[Math.floor(Math.random() * LH_FAMS.length)][0];
  const cand = st.pool.filter(p => p.fam === fam && st.know.get(p.it.key) !== "yours").slice(0, 30);
  const P = lhPicker(8);
  prShuffle(cand.length >= 3 ? cand : st.pool.filter(p => p.fam === fam)).forEach(p => P.add(p.it, "new"));
  return { fam, items: P.out };
}

// ---------- the wheel: a rose of the nine families, each wedge filling outward as its names become yours ----------
const lhMixHex = (a, b, t) => { const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)), A = p(a), B = p(b); return "#" + A.map((x, i) => Math.round(x + (B[i] - x) * t).toString(16).padStart(2, "0")).join(""); };
function lhWedge(r0, r1, a0, a1) {
  const rad = a => (a - 90) * Math.PI / 180, pt = (r, a) => `${(r * Math.cos(rad(a))).toFixed(2)},${(r * Math.sin(rad(a))).toFixed(2)}`, big = a1 - a0 > 180 ? 1 : 0;
  return `M${pt(r0, a0)}L${pt(r1, a0)}A${r1},${r1} 0 ${big} 1 ${pt(r1, a1)}L${pt(r0, a1)}A${r0},${r0} 0 ${big} 0 ${pt(r0, a0)}Z`;
}
function lhWheelHTML(st) {
  const R = 104, r0 = 40, n = LH_FAMS.length, step = 360 / n, gap = 1.6, ground = "#17160F";
  const rOf = share => r0 + (R - r0) * Math.sqrt(Math.max(0, Math.min(1, share)));
  const wedges = LH_FAMS.map(([fam, hex], i) => {
    const f = st.fams[fam], a0 = i * step - step / 2 + gap, a1 = (i + 1) * step - step / 2 - gap, mid = (a0 + a1) / 2;
    const T = Math.max(1, f.total), rY = f.yours ? Math.max(r0 + 3, rOf(f.yours / T)) : r0, rL = f.learning ? Math.max(rY + 2, rOf((f.yours + f.learning) / T)) : rY;
    const la = (mid - 90) * Math.PI / 180, lr = R + 17, lx = (lr * Math.cos(la)).toFixed(1), ly = (lr * Math.sin(la)).toFixed(1);
    const anchor = Math.abs(Math.cos(la)) < .25 ? "middle" : Math.cos(la) > 0 ? "start" : "end";
    const said = `${fam}: ${f.yours} yours, ${f.learning} on the way, ${f.none} new`;
    return `<g class="lh-w" data-fam="${fam}" role="button" tabindex="0" aria-label="${esc(said)}" style="--k:${i}">
      <path class="lh-w-hit" d="${lhWedge(r0 - 4, R + 30, a0 - gap, a1 + gap)}"/>
      <path class="lh-w-track" d="${lhWedge(r0, R, a0, a1)}" fill="${lhMixHex(ground, hex, .22)}"/>
      ${rL > rY ? `<path class="lh-w-learn" d="${lhWedge(r0, rL, a0, a1)}" fill="${lhMixHex(ground, hex, .55)}"/>` : ""}
      ${rY > r0 ? `<path class="lh-w-yours" d="${lhWedge(r0, rY, a0, a1)}" fill="${hex}"/>` : ""}
      <text class="lh-w-t" x="${lx}" y="${ly}" text-anchor="${anchor}" dominant-baseline="central">${fam}</text></g>`;
  }).join("");
  return `<svg class="lh-wheel" viewBox="-160 -138 320 276" role="group" aria-label="Your colors by family">${wedges}
    <circle r="${r0 - 6}" class="lh-hub"/>
    <text class="lh-hub-n" y="-5" text-anchor="middle" dominant-baseline="central">${st.yours.toLocaleString("en-US")}</text>
    <text class="lh-hub-t" y="17" text-anchor="middle" dominant-baseline="central">yours</text></svg>`;
}

// ---------- the room ----------
function lhRoom() {
  if (typeof CORE_NAMES !== "undefined" && !CORE_NAMES && typeof loadCoreNames === "function") {
    show(`<header class="room-head"><h1 class="title-1">Learn</h1><span class="note">${esc(weekdayName())}</span></header><p class="note lh-wait">Gathering your colors</p>`, "home room-learn", "learn");
    return void loadCoreNames().then(() => { if (app.querySelector(".room-learn")) lhRoom(); });
  }
  // the hero names exactly what the sheet starts with (its How many default), due reviews always in
  const st = lhStats(), fy = lhForYou(st), nDue = fy.nDue, shown = fy.items.slice(0, Math.max(nDue, Math.min(lsState().size || 10, fy.items.length)));
  const nNew = shown.length - nDue, plates = shown.slice(0, 12);
  const title = nDue ? `${nDue === 1 ? "One" : nDue} to <em>recall</em>` : st.yours || st.learning ? `${lhWord(shown.length)} for <em>you</em>` : `Your first <em>${lhWord(shown.length).toLowerCase()}</em>`;
  const note = nDue ? (nNew ? `Due today, after a night's sleep. Then ${nNew} more for you.` : "Due today, after a night's sleep.") : esc(lhWhyLine(shown, fy.why, fy.edgeFrom));
  const on = st.learning, ck = typeof lxCheckpoint === "function" ? lxCheckpoint(st.yours) : null;
  // the choices, each only when it has something
  const looked = lhLooked(st), favs = lhFavs(), mix = lhMix(), ptg = lhPainting(), test = lhStageTest(st, fy.stage);
  const open = list => list.filter(it => st.know.get(it.key) !== "yours").length;
  const art = hs => `<span class="lh-row-art" aria-hidden="true">${hs.slice(0, 4).map(h => `<i style="--c:${h}"></i>`).join("")}</span>`;
  const row = (k, hs, t, sub) => `<button class="lh-row" data-ch="${k}">${art(hs)}<span class="lh-row-t"><b>${t}</b><small>${sub}</small></span>${ICON.chev}</button>`;
  const cnt = (list, word) => { const o = open(list); return `${list.length.toLocaleString("en-US")} ${word}${o && o < list.length ? ` · ${o} you can't name yet` : ""}`; };
  const rows = [
    test ? row("test", test.items.map(x => x.h), `Stage test · ${esc(test.label)}`, "A mixed recall across the whole stage. Optional") : "",
    looked.length ? row("looked", looked.map(x => x.h), "Colors you looked at", esc(cnt(looked, looked.length === 1 ? "color" : "colors"))) : "",
    favs.length ? row("favs", favs.map(x => x.h), "Your favorites", esc(cnt(favs, favs.length === 1 ? "favorite" : "favorites"))) : "",
    mix.length ? row("mix", mix.map(x => x.h), "Mix-ups", `${Math.round(mix.length / 2)} ${mix.length > 2 ? "pairs" : "pair"} you've confused`) : "",
    ptg ? row("ptg", ptg.hs, `<em>${esc(ptg.title)}</em>`, ptg.mine ? "The last painting you looked at" : "Today's painting, its colors") : "",
    row("surprise", ["#C9A227", "#3F8F8A", "#B5546B", "#5C4E9C"], "Surprise me", "A few names from somewhere new"),
    row("deck", ["#008080", "#E2725B", "#CC7722", "#6082B6"], "Make your own deck", "Pick the colors, the order and the game"),
  ].join("");
  const fresh = !st.yours && !st.learning;
  const el = show(`
    <header class="room-head"><h1 class="title-1">Learn</h1><span class="note">${esc(weekdayName())}</span></header>
    <section class="lh-hero">
      ${plates.length ? `<button class="plates" data-fy aria-label="Study these">${plates.map((c, k) => `<i style="--c:${c.h};--k:${k}"></i>`).join("")}</button>` : ""}
      <h2 class="title-1 lh-hero-t">${title}</h2>
      <p class="note lh-hero-n">${note}</p>
      <button class="btn" data-study>Study ${ICON.arrow}</button>
    </section>
    <section class="lh-wheel-sec" aria-label="Your colors by family">
      <div class="dl-head"><h3 class="title-3">Your colors</h3><span class="note">${on ? `${on.toLocaleString("en-US")} on the way` : fresh ? "Pick any family" : ""}</span></div>
      ${lhWheelHTML(st)}
      <p class="note lh-wheel-n">${fresh ? "Every family is open. Tap one to study it." : fy.stage.st ? `<span>${esc(lhStageName(fy.stage.st))} · ${fy.stage.met.toLocaleString("en-US")} of ${fy.stage.all.length.toLocaleString("en-US")} met</span>` : ck ? `Next milestone · <b>${esc(lxStageWord(ck))}</b>` : ""}${st.yours + on && typeof lxWordsView === "function" ? ` <button class="lh-map" data-lh-map>See them on the map ${ICON.arrow}</button>` : ""}</p>
    </section>
    <section class="lh-choose"><div class="dl-head"><h3 class="title-3">Or choose</h3></div><div class="lh-rows">${rows}</div></section>
    ${lrTodayHtml()}
    ${installHint()}
  `, "home room-learn lh-room", "learn");
  wireInstall(el);
  lrTodayWire(el);
  const fyGo = () => lhStudy(fy.items, { label: "For you", title: "Study <em>for you</em>", src: "foryou", nDue, why: its => lhWhyLine(its, fy.why, fy.edgeFrom) });
  el.querySelectorAll("[data-study],[data-fy]").forEach(b => b.onclick = fyGo);
  const wheel = el.querySelector(".lh-wheel");
  const famTap = g => { if (!g) return; g.classList.remove("tap"); void g.getBoundingClientRect(); g.classList.add("tap"); lhOpenFamily(g.dataset.fam); };
  wheel.addEventListener("click", e => famTap(e.target.closest(".lh-w")));
  wheel.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); famTap(e.target.closest(".lh-w")); } });
  const mb = el.querySelector("[data-lh-map]");
  if (mb) mb.onclick = () => {
    const v = { src: "every-name", filter: st.yours ? "learned" : "learning" };
    S.hm = S.hm || {}; S.hm.src = v.src; S.hm.filter = v.filter; S.hm.fam = ""; S.hm.tone = ""; save(); buzz(6); hmHome();
  };
  el.querySelector(".lh-rows").addEventListener("click", e => {
    const b = e.target.closest("[data-ch]"); if (!b) return;
    const k = b.dataset.ch;
    if (k === "looked") return lhStudy(looked, { label: "Colors you looked at", title: "Study <em>what you looked at</em>", src: "looked" });
    if (k === "favs") return lhStudy(favs, { label: "Your favorites", title: "Study <em>your favorites</em>", src: "favs" });
    if (k === "mix") return lhStudy(mix, { label: "Your mix-ups", title: "Untangle <em>your mix-ups</em>", src: "mixups" });
    if (k === "ptg") { buzz(8); return lsOpen({ items: ptg.hs, label: ptg.title, src: "painting" }); }
    if (k === "surprise") { const s = lhSurprise(lhStats()); return lhStudy(s.items, { label: `A surprise: ${s.fam.toLowerCase()}`, title: `A surprise: <em>${esc(s.fam.toLowerCase())}</em>`, src: "surprise" }); }
    if (k === "deck") { buzz(6); return prHome(); }
    if (k === "test") {
      S.lh = S.lh && typeof S.lh === "object" ? S.lh : {}; S.lh.tested = S.lh.tested || {}; S.lh.tested[test.key] = today(); save();
      return lhStudy(test.items, { label: `Stage test: ${test.label}`, title: `Stage test · <em>${esc(test.label)}</em>`, src: "stagetest", pace: "test" });
    }
  });
  onKey = e => { if (e.key === "Enter" && !(e.target && e.target.closest && e.target.closest("button, input, [role=button]"))) fyGo(); };
  return el;
}
