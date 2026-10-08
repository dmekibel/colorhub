"use strict";
// Practice: a free-play room beside the learning path (#/practice, #/practice/<method>). You build your own deck
// (the first 50 names in stage order, a family, your due cards, your misses, a unit, a saved palette…) and pick a
// way to study it: Flashcards, Quiz, Type it, Match, Learn, Test, Blitz, Pairs, Color rain, Say it, Odd one out.
// The path itself stays one unit at a time (CLAUDE.md); nothing here changes what the path teaches next.
//
// ======================================================================================================
// THE STEP CONTRACT (for Practice's own runners and for anything else that wants a short exercise, e.g. lessons)
// ======================================================================================================
//   PR_STEPS[kind] = { by, render(container, item, ctx) -> Promise<{ ok, answer, ms, assist?, per? }> }
//
//   kind       item                 what it asks                                         by (scheduling)
//   card       one item             flashcard: tap to flip, swipe right knew / left not   null (self-graded)
//   quiz-name  one item             a swatch, four same-family names                      "pick"
//   quiz-color one item             a name, four same-family swatches                     "pick"
//   type       one item             a swatch, type its name (typos and alternates ok)     "say"
//   say        one item             a swatch, say its name (hands-free; falls back to type) "say"
//   match      array of 2-6 items   tap a swatch, then its name, until the board is clear  "pick"
//   pairs      array of 2-6 items   memory: flip two face-down tiles to find a pair        "pick"
//   blitz-yes-no one item           "Is this Teal?" yes / no (swipe or tap)               null (a coin flip gets half)
//   rain       one item             a swatch falls; tap its name before it lands          "pick"
//   odd-one-out one item            three shades share a name; tap the one that doesn't   "pick"
//
//   container  an empty element that the step fills completely (flex column; give it the whole stage). The step
//              owns everything inside it, including its own answer controls and its "Next" button. It never
//              touches anything outside: progress bars, timers, scores and the results screen belong to the caller.
//   item       { n, h, key, rank, also: [alternate names], c: the app color (js/core.js ALL) or null }.
//              Make one with prItemOf(nameOrHex) or prDeck(spec). Displayed names always come from prName(item),
//              which goes through nameOf() (js/naming.js).
//   ctx        all optional: { dir: "f" (color -> name) | "r" (name -> color), feedback: true (false = Test mode:
//              resolve straight after the answer, show nothing), deck: [items] (distractors prefer these),
//              setKey(fn) (keyboard handler; default sets core.js onKey), onMiss(info) (match: a wrong pair, for a
//              time penalty), claim: { n, h, truth } (blitz), fall: ms (rain), ear: prEar() (say: one shared
//              microphone across cards), speak: true (say: read the answer aloud after a miss), screen (the .screen
//              element, for keyboard fitting), note (one quiet line shown above the step) }.
//   result     ok: right or not. ms: time taken. assist: a hint was used. answer: what was given, one of
//              { kind: "pick", n, h } | { kind: "typed" | "heard", text } | { kind: "skip" } | { kind: "self" } |
//              { kind: "claim", n, h, yes } | { kind: "landed" }. Set steps (match, pairs) add per: [{ item, ok, answer }].
//              A step may resolve with { stop: true } (say: the learner said "stop" and asked to end).
//
//   After a step resolves, call prRecord(session, item, result, kind): it applies the scheduling policy below,
//   keeps the Tricky list, and remembers the first answer per item for the results screen.
//
// Honest progress (pickit.js decides what "yours" means; Practice must not inflate it):
//   - Objective steps (by != null) on a learned color (S.cards) that is due count as its review: schedule(c, ok, by).
//   - A miss on any learned color makes it due tomorrow. A hit on a color that isn't due changes nothing.
//   - Self-graded flashcards and the yes/no blitz never touch scheduling. Unlearned colors never do either.
//   - Only the first answer per color per session counts, and a hinted answer only counts when it's a miss.
//   - Every miss also lands in Tricky (S.practice.tricky), which forgets a color after 3 later right answers.

// ---------- tunables ----------
const PR_RANGES = [25, 50, 100, 250, 500, 1000];
const PR_FAMS = [["all", "All"], ["red", "Reds & pinks"], ["orange", "Oranges & browns"], ["yellow", "Yellows"], ["green", "Greens"], ["blue", "Blues"], ["purple", "Purples"], ["neutral", "Whites & greys"]];
const PR_ROUNDS = [[0, "All at once"], [10, "10 at a time"], [20, "20 at a time"]];
const PR_ORDERS = [["shuffle", "Shuffled"], ["order", "In order"], ["hard", "Hardest first"]];
const PR_DIRS = [["f", "Color → name"], ["r", "Name → color"], ["b", "Both"]];
const PR_TRICKY_RIGHTS = 3;          // a Tricky color is forgotten after this many later right answers
const PR_BLITZ_SECS = 60;
const PR_RAIN_LIVES = 3;
const PR_SET = 6;                    // tiles per Match / Pairs board
const PR_NEXT_MS = 1200;             // Say it: the next card comes up this long after a result
const PR_METHODS = {
  cards: { t: "Flashcards", d: "Flip, then swipe right if you knew it." },
  quiz: { t: "Quiz", d: "Four close neighbors. Pick the one." },
  type: { t: "Type it", d: "Spell the name. Small typos are fine." },
  match: { t: "Match", d: "Names on the left, colors on the right. Pair them, fast." },
  learn: { t: "Learn", d: "Pick it, then type it, until it sticks." },
  test: { t: "Test", d: "Twenty mixed questions, answers at the end." },
  say: { t: "Say it", d: "Hands-free. Say each name out loud." },
  blitz: { t: "Blitz", d: "Sixty seconds of yes or no." },
  pairs: { t: "Pairs", d: "A memory game of colors and names." },
  rain: { t: "Color rain", d: "Name each color before it lands." },
  odd: { t: "Odd one out", d: "Three share a name. Find the one that doesn't." },
};
const PR_FIRST4 = ["cards", "quiz", "type", "match"];

// ======================================================================
// State: S.practice = { last: spec, tricky: { key: { n, h, m, r, at } }, star: [keys], best: { key: { v, at } }, speak }
// A new optional key, created on first use like S.hm or S.palettes: old saves need no migration step, and
// migrateState() (core.js) keeps it as an unknown key on older versions.
// ======================================================================
function prState() {
  let p = S.practice;
  if (!p || typeof p !== "object" || Array.isArray(p)) p = S.practice = {};
  if (!p.tricky || typeof p.tricky !== "object") p.tricky = {};
  if (!Array.isArray(p.star)) p.star = [];
  if (!p.best || typeof p.best !== "object") p.best = {};
  if (p.speak == null) p.speak = true;
  if (!p.mix || typeof p.mix !== "object" || Array.isArray(p.mix)) p.mix = {};
  if (!p.seen || typeof p.seen !== "object" || Array.isArray(p.seen)) p.seen = {};
  return p;
}
const PR_DEFAULT = () => ({ src: "first", n: 50, fam: "all", list: "", order: "shuffle", dir: "f", round: 0, method: "cards" });
function prSpec() {
  const s = Object.assign(PR_DEFAULT(), prState().last || {});
  if (!PR_METHODS[s.method]) s.method = "cards";
  s.n = clamp(Math.round(+s.n || 50), 1, 1000);
  return s;
}
function prSaveSpec(spec) { prState().last = { ...spec }; save(); }

// ======================================================================
// Items: the ~1,000 core names (data/core-names.json), in the honeycomb's stage order (rank)
// ======================================================================
let PR_CORE = null, PR_CORE_SRC = null, PR_BYKEY = null;
function prItem(e) {
  const key = e.n.toLowerCase(), app = typeof BYNAME !== "undefined" ? BYNAME.get(key) || null : null;
  // any learnable color has a card id now (js/learnmore.js): Practice answers on a learned, due card count as its review
  const c = app || (typeof lxByName === "function" ? lxByName(e.n) : null);
  return { n: e.n, h: String(e.h).toUpperCase(), key, rank: e.rank == null ? 9999 : e.rank, useRank: e.useRank == null ? null : e.useRank, also: e.also || [], c: c && c.id && !c.basic ? c : app && app.id ? app : null, vs: app && app.vs || "", d: app && app.d || "" };
}
function prCore() {
  const src = (typeof CORE_NAMES !== "undefined" && CORE_NAMES) || null;
  if (PR_CORE && PR_CORE_SRC === src) return PR_CORE;
  const list = src || (typeof EVERY === "function" ? EVERY().map((c, i) => ({ n: c.n, h: c.h, rank: i })) : []);
  PR_CORE_SRC = src;
  PR_CORE = list.map(prItem).sort((a, b) => a.rank - b.rank);
  PR_BYKEY = new Map(PR_CORE.map(it => [it.key, it]));
  return PR_CORE;
}
const prByKey = k => { prCore(); return PR_BYKEY.get(String(k).toLowerCase()) || null; };
const prOfApp = c => prByKey(c.n) || prItem({ n: c.n, h: c.h });
// any name or hex -> the core item it is (a hex is named by nameOf(), and practiced as that name's own color)
function prItemOf(x) {
  if (x && typeof x === "object") return x.key ? x : prOfApp(x);
  if (/^#[0-9a-f]{6}$/i.test(String(x))) { const r = nameOf(x); return prByKey(r.n) || prItem({ n: r.n, h: r.h }); }
  return prByKey(x);
}
// The one display name: nameOf() for the item's own swatch (a core name at its own hex reads back as itself)
const PR_NAMES = new Map();
function prName(it) {
  if (PR_NAMES.has(it.key)) return PR_NAMES.get(it.key);
  let n = it.n;
  try { const r = nameOf(it.h); if (r && r.n && r.de < .5) n = r.n; } catch (e) {}
  if (typeof CORE_NAMES !== "undefined" && CORE_NAMES) PR_NAMES.set(it.key, n);
  return n;
}
const prLow = it => prName(it).toLowerCase();

// ---------- families: the gym's nine (same rule as family() in gym.js), grouped into seven for the chooser ----------
function prFam9(h) {
  const [L, C, H] = lch(h);
  if (C < 12) return "Greys";
  if (H >= 345 || H < 40) return L > 70 ? "Pinks" : "Reds";
  if (H < 70) return L < 48 ? "Browns" : "Oranges";
  if (H < 100) return L < 55 ? "Browns" : "Yellows";
  if (H < 195) return "Greens";
  if (H < 290) return "Blues";
  return L > 72 ? "Pinks" : "Purples";
}
const PR_FAM_OF = { Reds: "red", Pinks: "red", Oranges: "orange", Browns: "orange", Yellows: "yellow", Greens: "green", Blues: "blue", Purples: "purple", Greys: "neutral" };
const prFam = h => PR_FAM_OF[prFam9(h)];

// ======================================================================
// Building a deck. spec: { src: "first" | "list", n, fam, list, order, dir, round }
// list: "mine" | "due" | "tricky" | "star" | "unit:<id>" | "pal:<id>" | "ptg:<painting id>"
// ======================================================================
const prFirst = n => prCore().slice(0, n);
function prUnique(items) { const seen = new Set(); return items.filter(it => it && !seen.has(it.key) && seen.add(it.key)); }
function prList(list) {
  const p = prState();
  if (list === "mine") return (typeof cardsAll === "function" ? cardsAll() : ALL.filter(c => S.cards[c.id])).map(prOfApp);
  if (list === "due") return dueList().map(prOfApp);
  if (list === "tricky") return Object.entries(p.tricky).sort((a, b) => (b[1].m || 0) - (a[1].m || 0)).map(([k, e]) => prByKey(k) || prItem({ n: e.n, h: e.h }));
  if (list === "star") return p.star.map(prByKey).filter(Boolean);
  const [kind, id] = String(list).split(/:(.*)/);
  if (kind === "unit") { const u = UNITS.find(x => x.id === id); return u ? u.colors.map(prOfApp) : []; }
  if (kind === "pal") { const pl = (S.palettes || []).find(x => x.id === id); return pl ? pl.cols.map(prItemOf) : []; }
  if (kind === "ptg") { const pt = (window.PAINTINGS || []).find(x => x.id === id); return pt ? (pt.palette || []).map(x => prItemOf(x.h)) : []; }
  return [];
}
function prSource(spec) {
  let items = spec.src === "list" && spec.list ? prList(spec.list) : prFirst(spec.n);
  items = prUnique(items);
  if (spec.fam && spec.fam !== "all") items = items.filter(it => prFam(it.h) === spec.fam);
  return items;
}
// How hard a color has been for you: misses in practice first, then cards that keep resetting, then new ones
function prHard(it) {
  const t = prState().tricky[it.key], st = it.c && S.cards[it.c.id];
  let s = t ? 100 + (t.m || 1) * 10 - (t.r || 0) * 5 : st ? (st.b === 0 ? 20 : 10 - st.b) : 5;
  return s + Math.min(it.rank, 9999) / 1e4;
}
function prShuffle(a, rnd = Math.random) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rnd() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; }
// The whole deck, ordered. offset/round pick one round of it (round 0 = all at once).
function prDeck(spec, rnd = Math.random) {
  let items = prSource(spec);
  if (spec.order === "shuffle") items = prShuffle(items, rnd);
  else if (spec.order === "hard") items = items.slice().sort((a, b) => prHard(b) - prHard(a));
  return items;
}
function prRound(deck, spec, offset = 0) { return spec.round > 0 ? deck.slice(offset, offset + spec.round) : deck.slice(offset); }
function prSpecKey(spec) { return (spec.src === "list" ? spec.list : "first:" + spec.n) + "|" + (spec.fam || "all"); }
function prListLabel(list) {
  if (list === "mine") return "My colors";
  if (list === "due") return "Due now";
  if (list === "tricky") return "Tricky";
  if (list === "star") return "Starred";
  const [kind, id] = String(list).split(/:(.*)/);
  if (kind === "unit") { const u = UNITS.find(x => x.id === id); return u ? `${u.title} (${u.tier === 2 ? "everyday" : "designer"})` : "A unit"; }
  if (kind === "pal") { const pl = (S.palettes || []).find(x => x.id === id); return pl ? pl.name || pl.from || "Your palette" : "A palette"; }
  if (kind === "ptg") { const pt = (window.PAINTINGS || []).find(x => x.id === id); return pt ? pt.title : "A painting"; }
  return "A list";
}
function prDeckLine(spec) {
  const what = spec.src === "list" ? prListLabel(spec.list) : `The first ${spec.n.toLocaleString()}`;
  const fam = spec.fam !== "all" ? `, ${PR_FAMS.find(f => f[0] === spec.fam)[1].toLowerCase()} only` : "";
  return `${what}${fam}, ${PR_ORDERS.find(o => o[0] === spec.order)[1].toLowerCase()}`;
}

// ======================================================================
// Wrong options: always same-family close neighbors (CLAUDE.md), clearly different from the answer and each other
// (pickit.js pickNear: CIEDE2000 6 apart). Names you're likely to have met first: the deck, then the top of the list.
// ======================================================================
const PR_NEAR = new Map();
function prNear(it, k = 3, deck = null) {
  let maxRank = 300;
  (deck || []).forEach(x => { if (x.rank < 9999 && x.rank * 2 > maxRank) maxRank = x.rank * 2; });
  const ck = it.key + "|" + it.h + "|" + maxRank + "|" + k + "|" + (deck ? deck.length + (deck[0] ? deck[0].key : "") : "");
  if (PR_NEAR.has(ck)) return PR_NEAR.get(ck);
  const fam = prFam9(it.h), core = prCore(), inDeck = new Set((deck || []).map(x => x.key));
  const ok = x => x.key !== it.key && x.h !== it.h && prFam9(x.h) === fam;
  // greedy: nearest first, with a soft preference for nearby names in the deck (6 ΔE), every option 6 apart (pickit.js PICK_GAP)
  const pick = (list, gap, out) => {
    const cand = prUnique(list).filter(x => ok(x) && !out.includes(x)).map(x => ({ x, d: de2000(it.h, x.h) })).filter(o => o.d >= gap)
      .map(o => ({ ...o, s: o.d - (inDeck.has(o.x.key) && o.d <= 20 ? 6 : 0) })).sort((a, b) => a.s - b.s);
    for (const o of cand) { if (out.length >= k) break; if (out.every(p => de2000(p.h, o.x.h) >= gap)) out.push(o.x); }
    return out;
  };
  let out = pick([...(deck || []), ...core.filter(x => x.rank <= maxRank)], PICK_GAP, []);
  if (out.length < k) pick(core, PICK_GAP, out);
  if (out.length < k) pick(core, 3, out);   // a sparse family: a smaller gap, still the same family
  if (out.length < k) out = out.concat(pickNear(it, core.filter(x => x.key !== it.key && !out.includes(x))).slice(0, k - out.length));
  out = out.slice(0, k);
  PR_NEAR.set(ck, out);
  return out;
}
// How two colors differ, in words: the written line for an app color's own neighbor, else measured (produce.js)
function prDiff(it, nb) {
  if (it.c && it.c.vs && it.c.d && it.c.vs.toLowerCase() === nb.n.toLowerCase()) {
    // the written line often has no subject ("Lighter than teal."): name it, so it reads on its own
    const d = it.c.d, nm = prName(it);
    return /^([A-Z][a-z]+er|Much|More|Less|Slightly) [^.]*\bthan\b/.test(d) && !d.startsWith(nm) ? `${nm} is ${d[0].toLowerCase()}${d.slice(1)}` : d;
  }
  return compareLine({ n: prName(it), h: it.h }, { n: prName(nb), h: nb.h });
}

// ======================================================================
// Judging a typed or spoken name. Reuses produce.js (sayNorm, sayDist, sayTol, sayJudge); adds alternate names,
// lightness-modifier variants nameOf() would also use, homophones for speech, and the spoken commands.
// ======================================================================
let PR_JPOOL = null, PR_JPOOL_SRC = null;
function prJudgePool() {
  const core = prCore();
  if (PR_JPOOL && PR_JPOOL_SRC === core) return PR_JPOOL;
  PR_JPOOL_SRC = core;
  return (PR_JPOOL = core.map(it => ({ n: it.n, h: it.h, vs: it.vs, d: it.d, key: it.key })));
}
const PR_LMODS = ["light", "pale", "dark", "deep"];
// "pale pink" for a color nameOf() itself would describe as pale pink: within 8 ΔE of Pink, and pickModifier()
// (naming.js) picks exactly that word. Lightness words only.
function prModMatch(input, it, pool = prJudgePool()) {
  const words = String(input || "").toLowerCase().replace(/[^a-z\s-]/g, " ").trim().split(/[\s-]+/).filter(Boolean);
  if (words.length < 2 || !PR_LMODS.includes(words[0])) return null;
  const rest = sayNorm(words.slice(1).join(" ")), base = pool.find(x => sayNorm(x.n) === rest);
  if (!base || base.n.toLowerCase() === it.n.toLowerCase()) return null;
  if (de2000(base.h, it.h) >= (typeof NEAR_DE !== "undefined" ? NEAR_DE : 8)) return null;
  return pickModifier(lch(base.h), lch(it.h), base.n) === words[0] ? `${words[0]} ${base.n.toLowerCase()}` : null;
}
// -> { r: "empty" | "right" | "close" | "wrong", typo?, via?: "also" | "mod", nb?, said? }
function prJudge(input, it, pool = prJudgePool()) {
  const t = sayNorm(input);
  if (!t) return { r: "empty" };
  const me = sayNorm(it.n);
  if (t === me) return { r: "right", typo: false };
  const alts = (it.also || []).map(a => ({ a, s: sayNorm(String(a).replace(/\(.*?\)/g, "")) })).filter(x => x.s.length >= 3);
  const exactAlt = alts.find(x => x.s === t);
  if (exactAlt) return { r: "right", typo: false, via: "also", alt: exactAlt.a };
  const mod = prModMatch(input, it, pool);
  if (mod) return { r: "right", typo: false, via: "mod", alt: mod };
  const j = sayJudge(input, { n: it.n, h: it.h, vs: it.vs, d: it.d }, pool);
  if (j.r === "wrong" && !j.said) {
    const typoAlt = alts.find(x => x.s.length >= 5 && sayDist(t, x.s) <= sayTol(x.s));
    if (typoAlt) return { r: "right", typo: true, via: "also", alt: typoAlt.a };
  }
  return j;
}
// ---------- speech ----------
// Spoken commands, matched on the transcript lowercased with dots, spaces and dashes removed ("I.D.K.", "i d k",
// "ID K" all become "idk"). "I don't know", "skip" and "pass" are one command: show the answer, count a miss.
const PR_IDK = new Set(["idk", "idek", "idc", "eyedeekay", "eyedeekaye", "ideekay", "idkay", "idontknow", "idonotknow", "dontknow", "donotknow", "ireallydontknow",
  "dunno", "idunno", "noidea", "ihavenoidea", "notsure", "imnotsure", "iamnotsure", "noclue", "ihavenoclue", "skip", "skipit", "skipthis", "skipthisone", "pass", "ipass", "passit"]);
const PR_CMDS = { repeat: "repeat", again: "repeat", sayagain: "repeat", listenagain: "repeat", hint: "hint", giveahint: "hint", givemeahint: "hint", clue: "hint",
  pause: "pause", stop: "pause", wait: "pause", holdon: "pause" };
const prCompact = s => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[’']/g, "").replace(/[^a-z]/g, "");
function prCommand(text) {
  const c = prCompact(text);
  if (!c) return null;
  if (PR_IDK.has(c) || /^(i|eye)(d|dee)(k|kay|kaye)$/.test(c) || /^i(really|just)?(dont|donot)know/.test(c)) return "idk";
  return PR_CMDS[c] || null;
}
const PR_YES = /^(yes|yeah|yep|yup|ya|yah|correct|right|exactly|sure|thatsright|thatsit|yesplease)$/, PR_NO = /^(no|nope|nah|wrong|notquite|noitsnot)$/;
// A sound-alike key for speech: vowels collapse, so "tiel", "teel" and "teal" agree. Only used when what was heard
// isn't itself another color's name.
const PR_SOUND = new Map();
function prSound(s) {
  if (PR_SOUND.has(s)) return PR_SOUND.get(s);
  const k = prSoundKey(s);
  if (PR_SOUND.size < 5000) PR_SOUND.set(s, k);
  return k;
}
function prSoundKey(s) {
  let t = sayNorm(s);
  if (!t) return "";
  t = t.replace(/ph/g, "f").replace(/ck/g, "k").replace(/q/g, "k").replace(/x/g, "ks").replace(/c(?=[eiy])/g, "s").replace(/c/g, "k").replace(/z/g, "s")
    .replace(/dge/g, "j").replace(/ge$/, "j").replace(/^kn/, "n").replace(/^wr/, "r").replace(/gh/g, "g").replace(/(.)\1+/g, "$1");
  return t[0] + t.slice(1).replace(/[aeiouyhw]/g, "");
}
// Judge the recognizer's alternatives (best first). -> { r: "cmd", cmd } | { r: "right"|"maybe"|"close"|"wrong", heard, ... }
function prHear(alts, it, pool = prJudgePool()) {
  alts = (alts || []).map(a => String(a || "").trim()).filter(Boolean);
  if (!alts.length) return { r: "wrong", heard: "" };
  const top = prCommand(alts[0]);
  if (top) return { r: "cmd", cmd: top, heard: alts[0] };
  const rank = { right: 4, maybe: 3, close: 2, wrong: 1, empty: 0 };
  let best = null;
  for (const a of alts) {
    let j = prJudge(a, it, pool);
    if (j.r === "wrong" && !j.said) {
      const t = sayNorm(a), me = sayNorm(it.n), others = pool.filter(x => x.n !== it.n);
      const isOther = others.some(x => sayNorm(x.n) === t);
      if (!isOther && t.length >= 3 && prSound(t) === prSound(me) && !others.some(x => prSound(x.n) === prSound(t) && sayDist(t, sayNorm(x.n)) < sayDist(t, me))) j = { r: "right", typo: true, via: "sound" };
      else if (!isOther && t.length >= 3 && sayDist(t, me) <= sayTol(me) + 2) {
        let bd = 9; others.forEach(x => { const d = sayDist(t, sayNorm(x.n)); if (d < bd) bd = d; });
        if (sayDist(t, me) <= bd) j = { r: "maybe" };
      }
    }
    j.heard = a;
    if (!best || rank[j.r] > rank[best.r]) best = j;
    if (j.r === "right") break;
  }
  if (best.r !== "right" && best.r !== "maybe") { const idk = alts.find(a => prCommand(a) === "idk"); if (idk) return { r: "cmd", cmd: "idk", heard: idk }; }
  return best;
}

// ======================================================================
// The policy (see the top of this file) and the Tricky list
// ======================================================================
function prApply(it, ok, by, assist = false) {
  if (!by || !it || !it.c) return "none";
  const st = S.cards[it.c.id];
  if (!st) return "none";
  if (ok && assist) return "none";
  const t = today();
  if (st.due <= t) { schedule(it.c, ok, by); return "review"; }
  if (!ok) { st.due = addDays(t, 1); save(); return "tomorrow"; }
  return "none";
}
function prTrick(it, ok) {
  const tr = prState().tricky;
  if (!ok) { const e = tr[it.key] || { n: it.n, h: it.h, m: 0, r: 0 }; e.m = (e.m || 0) + 1; e.r = 0; e.at = today(); tr[it.key] = e; }
  else if (tr[it.key] && ++tr[it.key].r >= PR_TRICKY_RIGHTS) delete tr[it.key];
  save();
}
// A session: { method, spec, items, t0, first: Map(key -> { it, ok, answer, kind }), log: [] }
function prSession(method, spec, items, extra = {}) {
  return { method, spec, items, t0: performance.now(), first: new Map(), log: [], ...extra };
}
function prRecord(sess, it, res, kind) {
  sess.log.push({ it, kind, ...res });
  if (sess.first.has(it.key)) return false;
  sess.first.set(it.key, { it, ok: !!res.ok, answer: res.answer || null, kind, assist: !!res.assist });
  const by = PR_STEPS[kind] ? PR_STEPS[kind].by : null;
  const eff = prApply(it, !!res.ok, by, !!res.assist);
  sess.applied = sess.applied || { review: 0, tomorrow: 0 };
  if (eff === "review") sess.applied.review++; if (eff === "tomorrow" || (eff === "review" && !res.ok)) sess.applied.tomorrow++;
  prTrick(it, !!res.ok);
  if (sess.el) prCoach(sess, sess.el);
  if (!res.ok && res.answer && res.answer.n) prMixNote(it, res.answer.n);
  // the Learner Model (js/learner.js): what you answered, and what you mixed it up with
  try {
    if (typeof learnerLog === "function") {
      learnerLog({ type: "answer", color: { n: it.n, h: it.h }, ok: !!res.ok, by: by || "swipe", ms: res.ms, src: "practice" });
      if (!res.ok && res.answer && res.answer.n && res.answer.h) learnerLog({ type: "confuse", color: { n: it.n, h: it.h }, b: { n: res.answer.n, h: res.answer.h }, src: "practice" });
    }
  } catch (e) {}
  return true;
}
// Mix-ups: which name you gave instead (a real confusion pair), kept for the "Mix-ups" deck. S.practice.mix[key] = [names]
function prMixNote(it, other) {
  const ok = String(other || "").toLowerCase();
  if (!ok || ok === it.key) return;
  const mix = prState().mix, list = mix[it.key] || (mix[it.key] = []);
  if (!list.includes(ok)) { list.unshift(ok); list.length = Math.min(list.length, 6); }
  save();
}
function prStar(it, on) {
  const p = prState(), i = p.star.indexOf(it.key);
  if (on == null) on = i < 0;
  if (on && i < 0) p.star.unshift(it.key); else if (!on && i >= 0) p.star.splice(i, 1);
  save();
  return on;
}
const prStarred = it => prState().star.includes(it.key);

// ======================================================================
// Small view helpers
// ======================================================================
const PR_ICON = {   // js/core.js ICON_PATHS
  star: icon("star", 22), starOn: icon("starOn", 22), shuffle: icon("shuffle", 22), mic: icon("mic", 22),
  back: icon("back", 22), chev: icon("chev", 16), arrow: icon("arrow", 20), cards: icon("learn", 24),
};
const prX = () => icon("x", 22);
const prCheck = () => icon("check", 24);
// Names are long ("Purple Mountain Majesty"): a display size that still fits two lines on a 320 px phone
function prFit(name, big = 72) {
  const n = String(name).length, s = n <= 7 ? big : n <= 10 ? big * .84 : n <= 14 ? big * .7 : n <= 18 ? big * .6 : big * .54;
  return `font-size:${Math.round(s)}px`;
}
const prPlate = (items, cls = "") => `<div class="pr-plate ${cls}" aria-hidden="true">${items.slice(0, 160).map((it, k) => `<i style="--c:${it.h};--k:${k}"></i>`).join("")}</div>`;
const prTime = ms => { const s = ms / 1000; if (s < 60) return `${s.toFixed(1)} s`; const m = Math.floor(s / 60); return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`; };
const prPrimary = (label, note = "", attr = "") => `<button class="pr-primary" ${attr}><span>${label}</span>${note ? `<em>${note}</em>` : ""}${PR_ICON.arrow}</button>`;
const prShotMode = () => typeof SHOT !== "undefined" && !!SHOT || (typeof PR_SHOT_ON !== "undefined" && PR_SHOT_ON);
// Move on by itself after a result (held still in screenshot mode, so a shot shows the result)
const prAuto = (fn, ms) => { if (!prShotMode()) later(fn, ms); };
function prKeyer(ctx) { return fn => { if (ctx && ctx.setKey) ctx.setKey(fn); else onKey = fn; }; }
const prDirOf = d => d === "b" ? (Math.random() < .5 ? "f" : "r") : d === "r" ? "r" : "f";
// After a right answer, wait this long before moving on (instant in Test mode)
const prPause = (ctx, ms) => ctx && ctx.feedback === false ? 160 : ms;

// The paper label that slides up over a card (deck card, DESIGN-SYSTEM §10)
function prLabel(it, nb, opts = {}) {
  const nm = prName(it);
  return `<div class="pr-label">
    <div class="pr-lmeta"><span class="pr-note">${esc(opts.note || `From the ${PR_FAMS.find(f => f[0] === prFam(it.h))[1].toLowerCase()}`)}</span><span class="pr-code">${it.h}</span></div>
    <b class="pr-name" style="${prFit(nm, 64)}">${esc(nm)}</b>
    ${nb ? `<div class="pr-vs"><span class="pr-pair"><i style="--c:${it.h}"></i><i style="--c:${nb.h}"></i></span><p>${esc(prDiff(it, nb))}</p></div>` : ""}
  </div>`;
}

// ======================================================================
// THE STEPS
// ======================================================================
const PR_STEPS = {};

// ---------- card: a flashcard. Tap to flip, swipe right if you knew it, left if not. Self-graded. ----------
PR_STEPS.card = { by: null, render(box, it, ctx = {}) {
  return new Promise(resolve => {
    const t0 = performance.now(), dir = ctx.dir === "r" ? "r" : "f", nm = prName(it), nb = prNear(it, 1, ctx.deck)[0] || null;
    box.innerHTML = `<div class="pr-step pr-s-card">
      ${ctx.note ? `<p class="pr-stepnote">${esc(ctx.note)}</p>` : ""}
      <div class="pr-cardbox"><div class="pr-card${dir === "r" ? " rev" : ""}" style="--c:${it.h}">
        <div class="pr-fill"></div>
        ${dir === "r" ? `<div class="pr-front"><span class="pr-note">Picture this color</span><b class="pr-name" style="${prFit(nm, 64)}">${esc(nm)}</b></div>` : ""}
        ${prLabel(it, nb)}
        <span class="pr-stamp yes">Knew it</span><span class="pr-stamp no">Again</span>
      </div></div>
      <div class="pr-foot pr-foot-card"><p class="pr-hint">Tap the card to check</p></div></div>`;
    const card = box.querySelector(".pr-card"), foot = box.querySelector(".pr-foot");
    let revealed = false, busy = false, done = false;
    const reveal = (x, y) => {
      if (revealed) return; revealed = true;
      const r = card.getBoundingClientRect();
      card.style.setProperty("--x", (x == null ? r.width / 2 : x - r.left) + "px"); card.style.setProperty("--y", (y == null ? r.height / 2 : y - r.top) + "px");
      card.classList.add("revealed"); buzz(8);
      foot.innerHTML = `<button class="pr-ans no" data-no aria-label="Didn't know it">${prX()}</button><button class="pr-ans yes" data-yes aria-label="Knew it">${prCheck()}</button>`;
      foot.querySelector("[data-no]").onclick = () => fly(false);
      foot.querySelector("[data-yes]").onclick = () => fly(true);
    };
    const fly = (ok, dy = 0) => {
      if (busy || !revealed || done) return; busy = true; done = true;
      const w = Math.max(innerWidth, 420);
      card.style.setProperty(ok ? "--yes" : "--no", 1);
      card.style.transition = "transform .34s cubic-bezier(.35,.6,.4,1), opacity .34s";
      card.style.transform = `translate(${(ok ? 1 : -1) * (w + 120)}px, ${dy * .3 + 30}px) rotate(${ok ? 22 : -22}deg)`;
      buzz(ok ? 12 : [10, 40, 10]);
      later(() => resolve({ ok, answer: { kind: "self" }, ms: performance.now() - t0 }), reduceMotion ? 30 : 240);
    };
    let sx = 0, sy = 0, dx = 0, dy = 0, tt = 0, pid = null;
    card.addEventListener("pointerdown", e => { if (busy || pid !== null) return; pid = e.pointerId; try { card.setPointerCapture(pid); } catch (x) {} sx = e.clientX; sy = e.clientY; dx = dy = 0; tt = performance.now(); card.style.transition = "none"; });
    card.addEventListener("pointermove", e => {
      if (e.pointerId !== pid) return;
      dx = e.clientX - sx; dy = e.clientY - sy;
      const k = revealed ? 1 : .12;   // resists until revealed: recall before reveal
      card.style.transform = `translate(${dx * k}px, ${dy * k * .3}px) rotate(${dx * k * .055}deg)`;
      if (revealed) { const p = clamp(Math.abs(dx) / 110, 0, 1); card.style.setProperty("--yes", dx > 0 ? p : 0); card.style.setProperty("--no", dx < 0 ? p : 0); }
    });
    const end = e => {
      if (e.pointerId !== pid) return; pid = null;
      const dist = Math.hypot(dx, dy), v = Math.abs(dx) / Math.max(performance.now() - tt, 1);
      card.style.transition = "";
      if (e.type === "pointerup" && dist < 8 && !revealed) { card.style.transform = ""; return reveal(e.clientX, e.clientY); }
      if (revealed && (Math.abs(dx) > 100 || (v > .55 && Math.abs(dx) > 36))) return fly(dx > 0, dy);
      card.style.transform = ""; card.style.setProperty("--yes", 0); card.style.setProperty("--no", 0);
    };
    card.addEventListener("pointerup", end); card.addEventListener("pointercancel", end);
    prKeyer(ctx)(e => {
      if (!revealed && (e.key === " " || e.key === "Enter")) { e.preventDefault(); reveal(); }
      else if (revealed && (e.key === "ArrowRight" || e.key === "l")) fly(true);
      else if (revealed && (e.key === "ArrowLeft" || e.key === "h")) fly(false);
    });
    box._prReveal = reveal;   // screenshot hook
  });
} };

// ---------- quiz-name: a swatch, four same-family names ----------
function prFeedback(fb, it, pick) {
  if (!fb) return;
  if (!pick) { fb.innerHTML = ""; return; }
  fb.innerHTML = `${typeof mcShow === "function" ? "" : `<span class="pr-pair"><i style="--c:${it.h}"></i><i style="--c:${pick.h}"></i></span>`}<p>That's ${esc(prName(pick))}. ${esc(prDiff(it, pick))}</p>`;
}
// The big color card itself splits on a miss: what you picked | what it was, names on each half (the large area is the comparison)
function prSplit(box, it, pick) {
  const sw = box.querySelector(".pr-sw");
  if (!sw || !pick || !pick.h || pick.h === it.h) return false;
  const half = (x, lab) => `<div class="pr-half" style="--c:${x.h}" data-ink="${ink(x.h)}"><small>${lab}</small><button data-swatch="${x.h}">${esc(prName(x))}</button></div>`;
  sw.classList.add("pr-split");
  sw.innerHTML = half(pick, "You picked") + half(it, "It was");
  if (typeof reduceMotion === "undefined" || !reduceMotion) { sw.classList.add("pr-splitting"); requestAnimationFrame(() => requestAnimationFrame(() => sw.classList.remove("pr-splitting"))); }
  return true;
}
// A miss on a color: the one you picked and the one it was fill the screen (js/misscompare.js). go moves on.
function prMiss(it, pick, from, go, delay = 380) {
  if (typeof mcShow !== "function" || !pick || !pick.h || !it || pick.h === it.h) return false;
  later(() => { if (from && !from.isConnected) return; mcShow({ you: { n: prName(pick), h: pick.h }, was: { n: prName(it), h: it.h }, line: prDiff(it, pick), from, go }); }, delay);
  return true;
}
// Next after a miss (David, 2026-10-08, iPhone: "I'm clicking Next and it's stuck"). A touch moves on at pointerup,
// not only at the click iOS may or may not synthesize afterwards (it drops the click after some DOM changes under
// the finger), and the click that does follow is swallowed so it can't land on the next question. Fires once.
let PR_SWALLOW = null;   // { t, x, y }: the click iOS may still send for a touch already acted on at pointerup
const prSwallow = e => { PR_SWALLOW = { t: performance.now() + 450, x: e.clientX, y: e.clientY }; };
if (typeof document !== "undefined") document.addEventListener("click", e => {
  const s = PR_SWALLOW; if (!s) return;
  if (performance.now() > s.t) { PR_SWALLOW = null; return; }
  if (Math.hypot(e.clientX - s.x, e.clientY - s.y) > 40) return;
  PR_SWALLOW = null; e.stopPropagation(); e.preventDefault();
}, true);
// Names sit ON the tiles (David, 2026-10-09: "maybe it should be on the colors themselves so the eye doesn't move
// far"): bottom-left, in the tile's own readable ink, body size. prTag is the label; prTagLine adds the one-line
// difference to a tile (the odd one, or the right one) instead of a small line under the board.
const prTag = (h, n) => `<span class="pr-tag" style="--tag-ink:${ink(h) === "dark" ? "#141210" : "#FFFFFF"}"><b>${esc(n)}</b><em class="pr-tagfb"></em></span>`;
function prTagLine(btn, line, name) {
  const em = btn && btn.querySelector(".pr-tagfb"); if (!em || !line) return;
  // "Jade is bluer and lighter than Green." reads on the Jade tile as "bluer and lighter than Green"
  let t = String(line).replace(/\.$/, "");
  if (name && t.toLowerCase().startsWith(name.toLowerCase() + " is ")) t = t.slice(name.length + 4);
  em.textContent = t;
}
// after a named answer: Next, or a tap anywhere on the step; nothing advances by itself (no flash)
function prHold(box, foot, go) {
  let gone = false;
  const once = () => { if (gone) return; gone = true; go(); };
  prNextBtn(foot, once);
  later(() => { if (box.isConnected) box.addEventListener("click", e => { if (!e.target.closest("[data-next]")) once(); }); }, 250);
}
function prNextBtn(foot, go, label = "Next") {
  foot.innerHTML = prPrimary(label, "", "data-next");
  const b = foot.querySelector("[data-next]");
  let fired = false, down = null;
  const fire = () => { if (fired) return; fired = true; b.classList.add("pr-fired"); go(); };
  b.onclick = fire;
  b.addEventListener("pointerdown", e => { down = e.pointerType !== "mouse" && e.isPrimary ? { id: e.pointerId, x: e.clientX, y: e.clientY } : null; });
  b.addEventListener("pointerup", e => {
    if (!down || e.pointerId !== down.id || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 14) return;
    down = null; if (fired) return;
    prSwallow(e); fire();
  });
  b.addEventListener("pointercancel", () => { down = null; });
  return b;
}
PR_STEPS["quiz-name"] = { by: "pick", render(box, it, ctx = {}) {
  return new Promise(resolve => {
    // ctx.wrong: the wrong options chosen by the caller (Study's early rungs: fewer and farther apart, js/studypace.js)
    const t0 = performance.now(), opts = prShuffle([it, ...(ctx.wrong && ctx.wrong.length ? ctx.wrong : prNear(it, 3, ctx.deck))]);
    box.innerHTML = `<div class="pr-step pr-s-quiz">
      ${ctx.note ? `<p class="pr-stepnote">${esc(ctx.note)}</p>` : ""}
      <div class="pr-sw" style="--c:${it.h}"></div>
      <div class="pr-fb" aria-live="polite"></div>
      <div class="pr-opts${opts.length === 3 ? " pr-opts-3" : ""}">${opts.map((o, i) => `<button class="pr-opt" data-i="${i}"><span>${esc(prName(o))}</span></button>`).join("")}</div>
      <div class="pr-foot"><p class="pr-hint">Tap its name</p></div></div>`;
    const fb = box.querySelector(".pr-fb"), foot = box.querySelector(".pr-foot");
    let done = false;
    const choose = i => {
      if (done || !opts[i]) return; done = true;
      const o = opts[i], ok = o === it, btn = box.querySelector(`[data-i="${i}"]`);
      const res = { ok, answer: { kind: "pick", n: prName(o), h: o.h }, ms: performance.now() - t0 };
      btn.classList.add("chosen");
      if (ctx.feedback === false) { buzz(8); return later(() => resolve(res), prPause(ctx)); }
      box.querySelectorAll(".pr-opt").forEach((b, k) => { b.classList.toggle("ok", opts[k] === it); b.disabled = true; });
      if (!ok) btn.classList.add("bad");
      buzz(ok ? 12 : [10, 40, 10]);
      if (ok) { foot.innerHTML = `<p class="pr-hint pr-good">Right</p>`; return prAuto(() => resolve(res), 650); }
      prFeedback(fb, it, o);
      prNextBtn(foot, () => resolve(res));
      if (!prSplit(box, it, o)) prMiss(it, o, btn, () => resolve(res));
      prKeyer(ctx)(e => { if (e.key === "Enter" || e.key === " " || e.key === "ArrowRight") { e.preventDefault(); resolve(res); } });
    };
    box.querySelectorAll(".pr-opt").forEach(b => b.onclick = () => choose(+b.dataset.i));
    prKeyer(ctx)(e => { if (/^[1-4]$/.test(e.key)) choose(+e.key - 1); });
    box._prChoose = choose;
  });
} };

// ---------- quiz-color: a name, four same-family swatches ----------
PR_STEPS["quiz-color"] = { by: "pick", render(box, it, ctx = {}) {
  return new Promise(resolve => {
    const t0 = performance.now(), opts = prShuffle([it, ...(ctx.wrong && ctx.wrong.length === 3 ? ctx.wrong : prNear(it, 3, ctx.deck))]), nm = prName(it);
    box.innerHTML = `<div class="pr-step pr-s-qc">
      ${ctx.note ? `<p class="pr-stepnote">${esc(ctx.note)}</p>` : ""}
      <div class="pr-q"><span class="pr-note">Which one is</span><b class="pr-t1" style="${prFit(nm, 44)}">${esc(nm)}?</b></div>
      <div class="pr-grid4">${opts.map((o, i) => `<button class="pr-cell" data-i="${i}" aria-label="Option ${i + 1}"><i class="pr-swc" style="--c:${o.h}"></i>${prTag(o.h, prName(o))}</button>`).join("")}</div>
      <div class="pr-fb" aria-live="polite"></div>
      <div class="pr-foot"><p class="pr-hint">Tap its color</p></div></div>`;
    const fb = box.querySelector(".pr-fb"), foot = box.querySelector(".pr-foot");
    let done = false;
    const choose = i => {
      if (done || !opts[i]) return; done = true;
      const o = opts[i], ok = o === it, btn = box.querySelector(`[data-i="${i}"]`);
      const res = { ok, answer: { kind: "pick", n: prName(o), h: o.h }, ms: performance.now() - t0 };
      btn.classList.add("chosen");
      if (ctx.feedback === false) { buzz(8); return later(() => resolve(res), prPause(ctx)); }
      box.querySelector(".pr-grid4").classList.add("named");
      box.querySelectorAll(".pr-cell").forEach((b, k) => { b.classList.toggle("ok", opts[k] === it); b.disabled = true; });
      if (!ok) btn.classList.add("bad");
      buzz(ok ? 12 : [10, 40, 10]);
      if (ok) { prHold(box, foot, () => resolve(res)); prKeyer(ctx)(e => { if (e.key === "Enter" || e.key === " " || e.key === "ArrowRight") { e.preventDefault(); resolve(res); } }); return; }
      // the difference sits on the right tile, next to its name (not in a small line under the board)
      prTagLine(box.querySelector(`[data-i="${opts.indexOf(it)}"]`), prDiff(it, o), prName(it));
      prHold(box, foot, () => resolve(res));
      prMiss(it, o, btn, () => resolve(res));
      prKeyer(ctx)(e => { if (e.key === "Enter" || e.key === " " || e.key === "ArrowRight") { e.preventDefault(); resolve(res); } });
    };
    box.querySelectorAll(".pr-cell").forEach(b => b.onclick = () => choose(+b.dataset.i));
    prKeyer(ctx)(e => { if (/^[1-4]$/.test(e.key)) choose(+e.key - 1); });
    box._prChoose = choose;
  });
} };

// ---------- type: a swatch, type its name. Forgiving; a hint reveals one more letter. ----------
function prVerdict(it, j, typed) {
  const nm = prName(it);
  if (j.r === "right") return { cls: "ok", html: j.via === "also" ? `Right. It's best known as <em>${esc(nm)}</em>.` : j.via === "mod" ? `Fair: ${esc(j.alt)}. Its own name is <em>${esc(nm)}</em>.` : j.typo ? `Right, it's spelled <em>${esc(nm)}</em>.` : "Right" };
  if (j.r === "close" && j.nb) return { cls: "close", html: `Close: that's ${esc(j.nb.n)}. This is <em>${esc(nm)}</em>.`, nb: prByKey(j.nb.n) || j.nb };
  if (j.r === "skip") return { cls: "bad", html: `It's <em>${esc(nm)}</em>.` };
  return { cls: "bad", html: `${typed ? `Not “${esc(String(typed).trim().slice(0, 28))}”. ` : ""}It's <em>${esc(nm)}</em>.`, nb: j.said ? prByKey(j.said.n) : null };
}
PR_STEPS.type = { by: "say", render(box, it, ctx = {}) {
  return new Promise(resolve => {
    const t0 = performance.now(), nm = prName(it);
    let hint = 0, done = false;
    box.innerHTML = `<div class="pr-step pr-s-type">
      ${ctx.note ? `<p class="pr-stepnote">${esc(ctx.note)}</p>` : ""}
      <div class="pr-sw" style="--c:${it.h}"></div>
      <div class="pr-fb" aria-live="polite"></div>
      <form class="pr-typef" autocomplete="off">
        <input class="pr-in" type="text" enterkeyhint="done" autocapitalize="off" autocorrect="off" autocomplete="off" spellcheck="false" placeholder="Name this color" aria-label="Color name">
        <button class="pr-go" type="submit" aria-label="Check">${PR_ICON.arrow}</button>
      </form>
      <div class="pr-sub"><button type="button" class="pr-link" data-hint>Hint</button><span class="pr-hintline"></span><button type="button" class="pr-link" data-give>Show me</button></div>
      <div class="pr-foot pr-foot-type"></div></div>`;
    const form = box.querySelector("form"), inp = box.querySelector(".pr-in"), fb = box.querySelector(".pr-fb"), foot = box.querySelector(".pr-foot"), hl = box.querySelector(".pr-hintline");
    const unfit = typeof kbFit === "function" ? kbFit(ctx.screen || box.closest(".screen")) : () => {};
    if (matchMedia("(pointer: fine)").matches && !prShotMode()) setTimeout(() => { if (!done) inp.focus({ preventScroll: true }); }, 60);
    const finish = (j, typed) => {
      if (done) return; done = true;
      inp.blur(); unfit();
      const ok = j.r === "right";
      const res = { ok, assist: hint > 0, answer: j.r === "skip" ? { kind: "skip" } : { kind: "typed", text: typed }, ms: performance.now() - t0 };
      if (ctx.feedback === false) { buzz(8); return later(() => resolve(res), prPause(ctx)); }
      const v = prVerdict(it, j, typed);
      form.classList.add("done"); box.querySelector(".pr-sub").classList.add("done");
      const bigMiss = !ok && v.nb && typeof mcShow === "function";
      fb.innerHTML = `${v.nb && !bigMiss ? `<span class="pr-pair"><i style="--c:${it.h}"></i><i style="--c:${v.nb.h}"></i></span>` : ""}<p><span class="pr-v ${v.cls}">${v.html}</span>${v.nb ? ` ${esc(prDiff(it, v.nb))}` : ""}</p>`;
      buzz(ok ? 12 : [10, 40, 10]);
      if (ok && !j.typo && !j.via) return prAuto(() => resolve(res), 750);
      prNextBtn(foot, () => resolve(res));
      prKeyer(ctx)(e => { if (e.key === "Enter" || e.key === " " || e.key === "ArrowRight") { e.preventDefault(); resolve(res); } });
      if (bigMiss) prMiss(it, v.nb, form, () => resolve(res), 450);
    };
    form.onsubmit = e => {
      e.preventDefault();
      const v = inp.value, j = prJudge(v, it);
      if (j.r === "empty") { form.classList.remove("shake"); void form.offsetWidth; form.classList.add("shake"); inp.focus(); return; }
      finish(j, v);
    };
    box.querySelector("[data-hint]").onclick = () => {
      if (done) return;
      hint = Math.min(hint + 1, Math.max(1, nm.length - 1));
      hl.innerHTML = `Starts with <em>${esc(nm.slice(0, hint))}</em>…`;
      buzz(4); inp.focus();
    };
    box.querySelector("[data-give]").onclick = () => finish({ r: "skip" }, "");
    prKeyer(ctx)(e => { if (e.target && e.target.tagName === "INPUT") return; if (e.key.length === 1 && !e.altKey && !e.metaKey) inp.focus(); });
    box._prType = v => { inp.value = v; form.requestSubmit(); };
  });
} };

// ---------- say: hands-free. The microphone listens on its own; a result moves on by itself. ----------
// prEar(): one recognizer shared across cards (produce.js speechCtor). It re-arms itself after every result, a
// silence or an iOS session end, until stop(). States reported: "listening", "denied" (no permission yet, or no
// microphone: fall back to typing), "blocked" (it worked before but won't restart without a tap).
function prEar() {
  const SR = typeof speechCtor === "function" ? speechCtor() : null;
  if (!SR) return null;
  const ear = { dead: false, worked: false };
  let rec = null, want = false, onAlts = null, onState = null, errs = 0, restartT = 0;
  const say = s => { if (onState) onState(s); };
  function start() {
    if (rec || !want) return;
    let me;
    try {
      me = new SR(); rec = me;
      me.lang = "en-US"; me.interimResults = false; me.maxAlternatives = 5; me.continuous = false;
      me.onaudiostart = () => { if (rec !== me) return; ear.worked = true; errs = 0; say("listening"); };
      me.onresult = ev => { if (rec !== me || !want) return; const r = ev.results[ev.results.length - 1]; if (r && onAlts) onAlts([...r].map(a => a.transcript)); };
      me.onerror = ev => {
        if (rec !== me) return;
        const e = ev.error;
        if (e === "not-allowed" || e === "service-not-allowed" || e === "audio-capture") { want = false; if (!ear.worked) { ear.dead = true; say("denied"); } else say("blocked"); }
        else if (e !== "no-speech" && e !== "aborted" && ++errs >= 4) { want = false; say("blocked"); }
      };
      me.onend = () => { if (rec !== me) return; rec = null; if (want) { clearTimeout(restartT); restartT = setTimeout(start, 250); } };
      me.start();
      say("listening");
    } catch (e) {
      if (rec === me) rec = null;
      want = false;
      if (!ear.worked) { ear.dead = true; say("denied"); } else say("blocked");
    }
  }
  ear.listen = (fa, fs) => { onAlts = fa; onState = fs; want = true; errs = 0; start(); };
  ear.stop = () => { want = false; clearTimeout(restartT); const r = rec; rec = null; if (r) try { r.abort(); } catch (e) {} };
  return ear;
}
// Read a name aloud (after a miss). Resolves when it's done, or after a few seconds if the voice never starts.
function prSpeak(text) {
  return new Promise(res => {
    try {
      if (!("speechSynthesis" in window) || !text) return res();
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text); u.lang = "en-US"; u.rate = .95;
      let done = false; const fin = () => { if (!done) { done = true; res(); } };
      u.onend = fin; u.onerror = fin; setTimeout(fin, 3500);
      speechSynthesis.speak(u);
    } catch (e) { res(); }
  });
}
PR_STEPS.say = { by: "say", render(box, it, ctx = {}) {
  const ear = ctx.ear;
  if (!ear || ear.dead) return PR_STEPS.type.render(box, it, { ...ctx, note: ctx.typeNote || "This browser can't listen here, so type the names instead." });
  return new Promise(resolve => {
    const t0 = performance.now(), nm = prName(it);
    let hint = 0, done = false, paused = false, maybe = false, heardLast = "";
    box.innerHTML = `<div class="pr-step pr-s-say">
      <button class="pr-saycard" style="--c:${it.h}" aria-label="Pause or go on">
        <span class="pr-fill"></span>
        ${prLabel(it, null, { note: "" })}
        <span class="pr-paused"><b>Paused</b><span>Tap anywhere to go on</span></span>
      </button>
      <div class="pr-saystat" aria-live="polite"><p class="pr-status">Listening…</p><p class="pr-cmds">Say its name, or “I don't know”, “hint”, “pause”</p></div>
      <div class="pr-foot pr-foot-say"></div></div>`;
    const card = box.querySelector(".pr-saycard"), stat = box.querySelector(".pr-status"), cmds = box.querySelector(".pr-cmds"), foot = box.querySelector(".pr-foot");
    const label = card.querySelector(".pr-label"), lnote = label.querySelector(".pr-note");
    const status = (html, cls = "") => { stat.innerHTML = html; stat.className = "pr-status " + cls; };
    const listen = () => { if (done || paused) return; card.classList.add("listen"); ear.listen(onAlts, onState); };
    const quiet = () => { card.classList.remove("listen"); ear.stop(); };
    function onState(s) {
      if (done) return;
      if (s === "listening") { if (!paused) { card.classList.add("listen"); if (!maybe) status(hint ? `Starts with <em>${esc(nm.slice(0, hint))}</em>…` : "Listening…"); } }
      else if (s === "denied") {   // the card turns into Type it, for this card and the rest
        quiet(); done = true;
        PR_STEPS.type.render(box, it, { ...ctx, note: "The microphone is off, so type the names instead." }).then(resolve);
      } else if (s === "blocked") { pause(true); status("Tap anywhere to keep listening"); }
    }
    function result(ok, answer, verdictHtml, cls, opts = {}) {
      if (done) return; done = true; quiet();
      const res = { ok, answer, assist: hint > 0, ms: performance.now() - t0 };
      lnote.innerHTML = verdictHtml; lnote.className = "pr-note pr-v " + cls;
      // the difference from the color heard (or its nearest neighbor), so the label teaches something
      const nb = (opts.nb && opts.nb.h !== it.h ? opts.nb : null) || prNear(it, 1, ctx.deck)[0];
      const heard = !ok && opts.nb && opts.nb.h !== it.h && typeof mcShow === "function";   // you said another color: it fills the screen
      if (nb) label.insertAdjacentHTML("beforeend", `<div class="pr-vs">${heard ? "" : `<span class="pr-pair"><i style="--c:${it.h}"></i><i style="--c:${nb.h}"></i></span>`}<p>${esc(prDiff(it, nb))}</p></div>`);
      card.classList.add("revealed", ok ? "is-ok" : "is-bad");
      foot.innerHTML = ""; cmds.textContent = "";
      status(ok ? "Right" : "", ok ? "pr-good" : "");
      buzz(ok ? 12 : [10, 40, 10]);
      const speakIt = !ok && ctx.speak !== false ? prSpeak(nm) : Promise.resolve();
      if (heard) { prMiss(it, nb, card, () => resolve(res), 300); return; }   // tap anywhere on the compare goes on
      speakIt.then(() => prAuto(() => resolve(res), opts.fast ? 500 : PR_NEXT_MS));
    }
    const miss = (answer, why, nb) => result(false, answer, why, "bad", { nb });
    function onAlts(alts) {
      if (done || paused) return;
      const j0 = maybe ? null : prHear(alts, it);
      if (maybe) {   // "Did you mean Teal?": yes, no, or the name itself
        const c = prCompact(alts[0]);
        if (PR_YES.test(c)) return result(true, { kind: "heard", text: heardLast }, "Right", "ok");
        if (PR_NO.test(c)) return miss({ kind: "heard", text: heardLast }, `Heard “${esc(heardLast)}”`);
        const j = prHear(alts, it);
        if (j.r === "right") return result(true, { kind: "heard", text: j.heard }, "Right", "ok");
        if (j.r === "cmd" && j.cmd === "idk") return miss({ kind: "skip" }, "Here it is");
        return listen();
      }
      const j = j0;
      if (j.r === "cmd") {
        if (j.cmd === "idk") return miss({ kind: "skip" }, "Here it is");
        if (j.cmd === "repeat") { status("Listening again…"); return listen(); }
        if (j.cmd === "hint") { hint = Math.min(hint + 1, nm.length - 1); status(`Starts with <em>${esc(nm.slice(0, hint))}</em>…`); quiet(); (ctx.speak !== false ? prSpeak(`Starts with ${nm.slice(0, hint).split("").join(" ")}`) : Promise.resolve()).then(() => listen()); return; }
        if (j.cmd === "pause") return pause();
      }
      if (j.r === "right") return result(true, { kind: "heard", text: j.heard }, j.via === "mod" ? `Fair: ${esc(j.alt)}` : j.via === "also" ? `Also called ${esc(j.alt)}` : "Right", "ok");
      if (j.r === "maybe") {
        maybe = true; heardLast = j.heard;
        status(`Did you mean <em>${esc(nm)}</em>?`);
        cmds.textContent = "Say yes or no";
        foot.innerHTML = `<button class="pr-ans no" data-no aria-label="No">${prX()}</button><button class="pr-ans yes" data-yes aria-label="Yes">${prCheck()}</button>`;
        foot.querySelector("[data-yes]").onclick = e => { e.stopPropagation(); result(true, { kind: "heard", text: heardLast }, "Right", "ok"); };
        foot.querySelector("[data-no]").onclick = e => { e.stopPropagation(); miss({ kind: "heard", text: heardLast }, `Heard “${esc(heardLast)}”`); };
        return listen();
      }
      const heard = j.heard || alts[0] || "";
      const what = j.r === "close" && j.nb ? `That's ${esc(j.nb.n.toLowerCase())}` : `Heard “${esc(heard.slice(0, 28))}”`;
      const nbHeard = (j.nb || j.said) ? prByKey((j.nb || j.said).n) : null;
      miss({ kind: "heard", text: heard }, what, nbHeard);
    }
    function pause(blocked) {
      if (done) return;
      paused = true; quiet();
      card.classList.add("paused");
      status(blocked ? "Tap anywhere to keep listening" : "");
    }
    function resume() { if (done) return; paused = false; card.classList.remove("paused"); status(hint ? `Starts with <em>${esc(nm.slice(0, hint))}</em>…` : "Listening…"); listen(); }
    card.onclick = () => { if (done) return; buzz(8); paused ? resume() : pause(); };
    prKeyer(ctx)(e => { if (e.key === " ") { e.preventDefault(); card.click(); } });
    box._prSay = { onAlts, onState, pause, status, setMaybe: () => onAlts(["tiel"]) };
    // no sound reaching the recognizer after a while (no microphone, or a browser that never answers): offer typing
    later(() => {
      if (done || ear.worked) return;
      cmds.innerHTML = `Can't hear you? <button class="pr-link" data-totype>Type instead</button>`;
      cmds.querySelector("[data-totype]").onclick = e => { e.stopPropagation(); ear.dead = true; quiet(); done = true; PR_STEPS.type.render(box, it, { ...ctx, note: "Typing instead. Say it comes back next time." }).then(resolve); };
    }, 7000);
    if (ctx.paused) pause(); else listen();
  });
} };

// ---------- match: a board of swatches and names. Tap one, then its partner. A wrong pair costs a second. ----------
PR_STEPS.match = { by: "pick", render(box, items, ctx = {}) {
  items = [].concat(items).slice(0, 6);
  return new Promise(resolve => {
    // names in the left column, colors in the right (David: pairing is not a memory game); each column shuffled
    const t0 = performance.now(), nmO = prShuffle(items.map((it, i) => i)), swO = prShuffle(items.map((it, i) => i)), tiles = [];
    nmO.forEach((i, r) => { tiles.push({ i, sw: false }); tiles.push({ i: swO[r], sw: true }); });
    box.innerHTML = `<div class="pr-step pr-s-match">${ctx.note ? `<p class="pr-stepnote">${esc(ctx.note)}</p>` : ""}<div class="pr-board pr-board2" style="--cols:2;--rows:${items.length}">${tiles.map((t, k) => {
      const it = items[t.i];
      return t.sw ? `<button class="pr-tile sw" data-k="${k}" style="--c:${it.h}" aria-label="A color"></button>`
        : `<button class="pr-tile nm" data-k="${k}"><span>${esc(prName(it))}</span></button>`;
    }).join("")}</div><p class="pr-matchnote" aria-live="polite"><span class="pr-hint">Tap a name, then its color</span></p></div>`;
    box._prMatch = { tiles, items };   // test hook
    const missed = new Map(), note = box.querySelector(".pr-matchnote");
    let sel = null, left = items.length;
    box.querySelectorAll(".pr-tile").forEach(b => b.onclick = () => {
      const k = +b.dataset.k, t = tiles[k];
      if (b.classList.contains("gone")) return;
      if (!sel || sel.t.sw === t.sw) { if (sel) sel.b.classList.remove("on"); if (sel && sel.b === b) { sel = null; return; } sel = { b, t }; b.classList.add("on"); buzz(4); return; }
      const a = sel; sel = null; a.b.classList.remove("on");
      if (a.t.i === t.i) {
        [a.b, b].forEach(x => x.classList.add("gone")); buzz(12);
        if (--left === 0) {
          const per = items.map((it, i) => ({ item: it, ok: !missed.has(i), answer: missed.get(i) || null }));
          later(() => resolve({ ok: missed.size === 0, ms: performance.now() - t0, per, answer: null }), 260);
        }
      } else {
        const swT = a.t.sw ? a.t : t, nmT = a.t.sw ? t : a.t, it = items[swT.i], picked = items[nmT.i];
        if (!missed.has(swT.i)) missed.set(swT.i, { kind: "pick", n: prName(picked), h: picked.h });
        [a.b, b].forEach(x => { x.classList.remove("bad"); void x.offsetWidth; x.classList.add("bad"); });
        buzz([10, 40, 10]);
        // a wrong pair teaches: which way the two differ
        note.innerHTML = `<span class="pr-pair"><i style="--c:${it.h}"></i><i style="--c:${picked.h}"></i></span><span>Not ${esc(prName(picked))}. ${esc(prDiff(it, picked))}</span>`;
        if (ctx.onMiss) ctx.onMiss({ item: it, picked });
      }
    });
  });
} };

// ---------- pairs: a memory game. Face down: half swatches, half names; flip two to find a color and its name. ----------
// A mismatch only counts as a miss for a color whose partner you'd already seen face up (a real confusion, not memory).
PR_STEPS.pairs = { by: "pick", render(box, items, ctx = {}) {
  items = [].concat(items).slice(0, 6);
  return new Promise(resolve => {
    const t0 = performance.now(), tiles = prShuffle([...items.map((it, i) => ({ i, sw: true })), ...items.map((it, i) => ({ i, sw: false }))]);
    const cols = tiles.length > 8 ? 3 : 2;
    box.innerHTML = `<div class="pr-step pr-s-pairs"><div class="pr-board" style="--cols:${cols};--rows:${Math.ceil(tiles.length / cols)}">${tiles.map((t, k) => {
      const it = items[t.i];
      return `<button class="pr-tile flip ${t.sw ? "sw" : "nm"}" data-k="${k}" style="--c:${it.h}" aria-label="A face-down tile"><span class="pr-back"></span><span class="pr-face">${t.sw ? "" : `<span>${esc(prName(it))}</span>`}</span></button>`;
    }).join("")}</div><p class="pr-hint pr-flips"></p></div>`;
    const seen = new Set(), missed = new Map(), btns = [...box.querySelectorAll(".pr-tile")], flipsEl = box.querySelector(".pr-flips");
    let up = [], left = items.length, flips = 0, lock = false;
    const tag = t => (t.sw ? "s" : "n") + t.i;
    btns.forEach(b => b.onclick = () => {
      const k = +b.dataset.k, t = tiles[k];
      if (lock || b.classList.contains("up") || b.classList.contains("found")) return;
      b.classList.add("up"); buzz(4); up.push({ b, t });
      if (up.length < 2) { seen.add(tag(t)); return; }
      flips++; flipsEl.innerHTML = `<span class="pr-code">${flips}</span> ${flips === 1 ? "try" : "tries"}`;
      const [p, q] = up; up = [];
      if (p.t.i === q.t.i && p.t.sw !== q.t.sw) {
        [p.b, q.b].forEach(x => { x.classList.add("found"); }); buzz(12); seen.add(tag(t));
        if (--left === 0) {
          const per = items.map((it, i) => ({ item: it, ok: !missed.has(i), answer: missed.get(i) || null }));
          later(() => resolve({ ok: missed.size === 0, ms: performance.now() - t0, per, flips, answer: null }), 500);
        }
        return;
      }
      if (p.t.sw !== q.t.sw) {
        const sw = p.t.sw ? p.t : q.t, nmT = p.t.sw ? q.t : p.t;
        if (seen.has("n" + sw.i) && !missed.has(sw.i)) { const x = items[nmT.i]; missed.set(sw.i, { kind: "pick", n: prName(x), h: x.h }); }
        if (seen.has("s" + nmT.i) && !missed.has(nmT.i)) { const x = items[sw.i]; missed.set(nmT.i, { kind: "pick", n: prName(x), h: x.h }); }
      }
      seen.add(tag(t));
      lock = true; buzz([10, 40, 10]);
      later(() => { [p.b, q.b].forEach(x => x.classList.remove("up")); lock = false; }, prShotMode() ? 60000 : 900);
    });
    box._prFlip = k => btns[k] && btns[k].click();
    box._prTiles = tiles;
  });
} };

// ---------- blitz-yes-no: "Is this Teal?" Swipe right for yes, left for no. ----------
PR_STEPS["blitz-yes-no"] = { by: null, render(box, it, ctx = {}) {
  return new Promise(resolve => {
    const t0 = performance.now();
    const claim = ctx.claim || (Math.random() < .5 ? { n: prName(it), h: it.h, truth: true } : (() => { const o = prNear(it, 1, ctx.deck)[0] || it; return { n: prName(o), h: o.h, truth: o === it }; })());
    box.innerHTML = `<div class="pr-step pr-s-blitz">
      <p class="pr-t1 pr-blitzq" style="font-size:${claim.n.length <= 8 ? 40 : claim.n.length <= 12 ? 36 : claim.n.length <= 16 ? 32 : 28}px"><span>Is this <em>${esc(claim.n)}</em>?</span></p>
      <div class="pr-cardbox"><div class="pr-card pr-blitzcard" style="--c:${it.h}"><div class="pr-fill"></div>
        <span class="pr-stamp yes">Yes</span><span class="pr-stamp no">No</span></div></div>
      <div class="pr-fb pr-fb-blitz" aria-live="polite"></div>
      <div class="pr-foot"><button class="pr-ans no" data-no aria-label="No">${prX()}</button><button class="pr-ans yes" data-yes aria-label="Yes">${prCheck()}</button></div></div>`;
    const card = box.querySelector(".pr-card"), fb = box.querySelector(".pr-fb");
    box._prClaim = claim;
    let done = false;
    const answer = yes => {
      if (done) return; done = true;
      const ok = yes === claim.truth, res = { ok, answer: { kind: "claim", n: claim.n, h: claim.h, yes }, ms: performance.now() - t0 };
      card.style.setProperty(yes ? "--yes" : "--no", 1);
      if (ctx.feedback === false) { buzz(8); return later(() => resolve(res), prPause(ctx)); }
      card.classList.add(ok ? "is-ok" : "is-bad");
      buzz(ok ? 12 : [10, 40, 10]);
      if (!ok) fb.innerHTML = `<p class="pr-v bad">It's ${esc(prName(it))}</p>`;
      prAuto(() => resolve(res), ok ? 260 : 900);
    };
    box.querySelector("[data-yes]").onclick = () => answer(true);
    box.querySelector("[data-no]").onclick = () => answer(false);
    let sx = 0, dx = 0, pid = null;
    card.addEventListener("pointerdown", e => { if (done || pid !== null) return; pid = e.pointerId; try { card.setPointerCapture(pid); } catch (x) {} sx = e.clientX; dx = 0; card.style.transition = "none"; });
    card.addEventListener("pointermove", e => { if (e.pointerId !== pid) return; dx = e.clientX - sx; card.style.transform = `translateX(${dx}px) rotate(${dx * .05}deg)`; const p = clamp(Math.abs(dx) / 90, 0, 1); card.style.setProperty("--yes", dx > 0 ? p : 0); card.style.setProperty("--no", dx < 0 ? p : 0); });
    const end = e => { if (e.pointerId !== pid) return; pid = null; card.style.transition = ""; card.style.transform = ""; if (Math.abs(dx) > 70) answer(dx > 0); else { card.style.setProperty("--yes", 0); card.style.setProperty("--no", 0); } };
    card.addEventListener("pointerup", end); card.addEventListener("pointercancel", end);
    prKeyer(ctx)(e => { if (e.key === "ArrowRight" || e.key === "y") answer(true); if (e.key === "ArrowLeft" || e.key === "n") answer(false); });
  });
} };

// ---------- rain: a color drifts down; tap its name (of three neighbors) before it lands ----------
PR_STEPS.rain = { by: "pick", render(box, it, ctx = {}) {
  return new Promise(resolve => {
    const t0 = performance.now(), opts = prShuffle([it, ...(ctx.ease ? prNear(it, 3, ctx.deck).slice(1) : prNear(it, 2, ctx.deck))]), fall = ctx.fall || 6500;
    box.innerHTML = `<div class="pr-step pr-s-rain">
      <div class="pr-sky"><i class="pr-drop" style="--c:${it.h}"></i><span class="pr-ground"></span><p class="pr-rainnote" aria-live="polite"></p></div>
      <div class="pr-opts pr-opts3">${opts.map((o, i) => `<button class="pr-opt" data-i="${i}"><span>${esc(prName(o))}</span></button>`).join("")}</div></div>`;
    const sky = box.querySelector(".pr-sky"), drop = box.querySelector(".pr-drop");
    let done = false, anim = null;
    const finish = (ok, answer, cls) => {
      if (done) return; done = true;
      if (anim) anim.pause();
      box.querySelectorAll(".pr-opt").forEach((b, k) => { b.classList.toggle("ok", opts[k] === it); b.disabled = true; });
      drop.classList.add(cls);
      if (!ok) box.querySelector(".pr-rainnote").innerHTML = `It was <em>${esc(prName(it))}</em>`;
      buzz(ok ? 12 : [10, 40, 10]);
      prAuto(() => resolve({ ok, answer, ms: performance.now() - t0 }), ok ? 380 : 1000);
    };
    box.querySelectorAll(".pr-opt").forEach(b => b.onclick = () => {
      const o = opts[+b.dataset.i], ok = o === it;
      if (!ok) b.classList.add("bad");
      finish(ok, { kind: "pick", n: prName(o), h: o.h }, ok ? "pop" : "miss");
    });
    requestAnimationFrame(() => {
      if (!box.isConnected || done) return;
      const H = sky.clientHeight - drop.offsetHeight;
      if (prShotMode()) { drop.style.transform = `translateY(${H * .42}px)`; return; }
      anim = drop.animate([{ transform: "translateY(0)" }, { transform: `translateY(${H}px)` }], { duration: fall, easing: "linear", fill: "forwards" });
      anim.onfinish = () => { if (box.isConnected) finish(false, { kind: "landed" }, "landed"); };
      cleanup.push(() => { try { anim.cancel(); } catch (e) {} });
    });
    prKeyer(ctx)(e => { if (/^[1-3]$/.test(e.key)) { const b = box.querySelector(`[data-i="${+e.key - 1}"]`); if (b) b.click(); } });
  });
} };

// ---------- odd-one-out: three shades that all read as one name, and one same-family neighbor ----------
// The two extra shades sit 2.5 to 4.5 ΔE from the color, in random directions, and stay nearer to it than to any
// other name (so nameOf() still names them after it: "Teal", or "Light teal").
function prShades(it, n = 2, rnd = Math.random) {
  const others = prCore().filter(x => x.key !== it.key && de2000(x.h, it.h) < 16), [L, a, b] = lab(it.h), out = [];
  for (let i = 0; i < 400 && out.length < n; i++) {
    const u = [rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1], m = Math.hypot(u[0], u[1], u[2]);
    if (m < .2 || m > 1) continue;
    const want = 2.5 + rnd() * 2, at = s => [L + u[0] / m * s, a + u[1] / m * s, b + u[2] / m * s];
    let lo = 0, hi = 30;
    for (let j = 0; j < 20; j++) { const s = (lo + hi) / 2; if (de2000(it.h, labHex(...at(s))) < want) lo = s; else hi = s; }
    const p = at((lo + hi) / 2);
    if (!inGamut(...p)) continue;
    const hx = labHex(...p), d = de2000(it.h, hx);
    if (d < 2 || d > 5 || hx === it.h) continue;
    if (others.every(o => de2000(hx, o.h) > d + .5) && out.every(o => de2000(o, hx) >= 2.5)) out.push(hx);
  }
  return out.length === n ? out : null;
}
PR_STEPS["odd-one-out"] = { by: "pick", render(box, it, ctx = {}) {
  const shades = prShades(it), odd = prNear(it, 1, ctx.deck)[0];
  if (!shades || !odd) return PR_STEPS["quiz-color"].render(box, it, ctx);
  return new Promise(resolve => {
    const t0 = performance.now(), nm = prName(it);
    const opts = prShuffle([{ h: it.h, same: true }, ...shades.map(h => ({ h, same: true })), { h: odd.h, same: false, it: odd }]);
    box.innerHTML = `<div class="pr-step pr-s-qc pr-s-odd">
      <div class="pr-q"><span class="pr-note">Three of these are</span><b class="pr-t1" style="${prFit(nm, 44)}">${esc(nm)}</b></div>
      <div class="pr-grid4">${opts.map((o, i) => `<button class="pr-cell" data-i="${i}" aria-label="Option ${i + 1}"><i class="pr-swc" style="--c:${o.h}"></i>${prTag(o.h, o.same ? nameOf(o.h).text : prName(o.it))}</button>`).join("")}</div>
      <div class="pr-fb" aria-live="polite"></div>
      <div class="pr-foot"><p class="pr-hint">Tap the one that isn't</p></div></div>`;
    const fb = box.querySelector(".pr-fb"), foot = box.querySelector(".pr-foot");
    let done = false;
    const choose = i => {
      if (done || !opts[i]) return; done = true;
      const o = opts[i], ok = !o.same, btn = box.querySelector(`[data-i="${i}"]`);
      const res = { ok, answer: { kind: "pick", n: o.same ? nameOf(o.h).text : prName(o.it), h: o.h }, ms: performance.now() - t0 };
      btn.classList.add("chosen");
      if (ctx.feedback === false) { buzz(8); return later(() => resolve(res), prPause(ctx)); }
      box.querySelector(".pr-grid4").classList.add("named");
      box.querySelectorAll(".pr-cell").forEach((b, k) => { b.classList.toggle("ok", !opts[k].same); b.disabled = true; });
      if (!ok) btn.classList.add("bad");
      buzz(ok ? 12 : [10, 40, 10]);
      const bigMiss = !ok && typeof mcShow === "function";
      // the difference rides on the odd tile itself: "Jade · bluer and lighter than Green"
      prTagLine(box.querySelector(`[data-i="${opts.findIndex(x => !x.same)}"]`), prDiff(odd, it), prName(odd));
      prHold(box, foot, () => resolve(res));
      if (bigMiss) {   // you took one of the three; the odd one was the answer
        const pk = { n: nameOf(o.h).n, h: o.h };
        later(() => { if (btn.isConnected) mcShow({ you: pk, was: { n: prName(odd), h: odd.h }, line: prDiff(odd, pk), from: btn, go: () => resolve(res), wasLabel: "The odd one" }); }, 380);
      }
    };
    box.querySelectorAll(".pr-cell").forEach(b => b.onclick = () => choose(+b.dataset.i));
    prKeyer(ctx)(e => { if (/^[1-4]$/.test(e.key)) choose(+e.key - 1); });
    box._prChoose = choose; box._prOpts = opts;
  });
} };

// ======================================================================
// The play shell: the lesson archetype on booth grey. ✕ on the left, then one progress bar, then one small readout.
// ======================================================================
// The first time you play a method: one line above the stage, gone after your first answer (taught by doing)
const PR_COACH = { cards: "Name it in your head, tap to check, then swipe.", quiz: "Tap the name that fits.", type: "Type its name. Small typos are fine.",
  match: "Tap a name, then its color.", learn: "Each color climbs from picking to typing.", test: "No answers until the end.", say: "Say its name out loud.",
  blitz: "Swipe right for yes, left for no.", pairs: "Flip two tiles to find a color and its name.", rain: "Tap its name before it lands.",
  odd: "Tap the one that isn't the named color." };
function prCoach(sess, el, text) {
  const c = el && el.querySelector(".pr-coach"); if (!c) return;
  if (text) { c.textContent = text; c.hidden = false; return; }
  c.hidden = true;
  if (!sess.coached) { sess.coached = true; const p = prState(); if (!p.seen[sess.method]) { p.seen[sess.method] = today(); save(); } }
}
function prShell(sess, o = {}) {
  const n = sess.items.length, segs = n <= 30;
  const prog = o.timer ? `<div class="pr-timer"><i></i></div>` : segs ? `<div class="pr-segs">${sess.items.map(it => `<i data-k="${esc(it.key)}" style="--c:${it.h}"></i>`).join("")}</div>`
    : `<div class="pr-bar"><i></i></div>`;
  const el = show(`<header class="pr-top"><button class="pr-x" data-close aria-label="Close">${prX()}</button>${prog}<span class="pr-right">${o.right || ""}</span></header>
    <p class="pr-coach"${prState().seen[sess.method] ? " hidden" : ""}>${PR_COACH[sess.method] || ""}</p>
    <div class="pr-stage"></div>`, "fixed pr-play pr-booth pr-m-" + sess.method);
  sess.el = el;
  const stage = el.querySelector(".pr-stage"), right = el.querySelector(".pr-right");
  let known = 0;
  el.querySelector("[data-close]").onclick = () => { sess.ended = true; if (sess.first.size || sess.score) prResults(sess, { stopped: true }); else prExit(sess); };
  let stepKey = null;
  onKey = e => { if (e.key === "Escape") return el.querySelector("[data-close]").click(); if (stepKey) stepKey(e); };
  return {
    el, stage, right,
    setKey: fn => { stepKey = fn; },
    seg(it, state) {
      if (segs) { const s = el.querySelector(`.pr-segs i[data-k="${CSS.escape(it.key)}"]`); if (s) { if (state === "on" && !s.classList.contains("on")) known++; s.classList.toggle("met", state === "met"); s.classList.toggle("on", state === "on"); } }
      else if (state === "on") known++;
      const b = el.querySelector(".pr-bar i"); if (b) b.style.transform = `scaleX(${known / n})`;
    },
    timer(secs) { const t = el.querySelector(".pr-timer i"); if (t) { t.style.animationDuration = secs + "s"; t.classList.add("run"); } },
  };
}
function prCtx(sess, sh, extra = {}) {
  return { deck: sess.deckAll || sess.items, feedback: true, setKey: sh.setKey, screen: sh.el, ...extra };
}

// ======================================================================
// Runners: one per method. Each loops over steps and ends on the results screen.
// ======================================================================
const PR_RUN = {};
// The queue: every color once; with `repeat`, a miss comes back (after two other cards, or at the end) until known.
async function prQueue(sess, kindOf, o = {}) {
  const sh = prShell(sess, o);
  if (o.onShell) o.onShell(sh);
  let queue = sess.items.map(it => ({ it, dir: prDirOf(sess.spec.dir) }));
  sess.queue = () => queue;
  while (queue.length && !sess.ended) {
    const q = queue[0], kind = typeof kindOf === "function" ? kindOf(q) : kindOf;
    if (o.onCard) o.onCard(q.it, sh);
    const res = await PR_STEPS[kind].render(sh.stage, q.it, prCtx(sess, sh, { dir: q.dir, ...(o.ctx || {}) }));
    if (sess.ended || !sh.stage.isConnected) return;
    prRecord(sess, q.it, res, kind);
    queue.shift();
    sh.seg(q.it, res.ok ? "on" : "met");
    if (res.stop) break;
    if (!res.ok && o.repeat) queue.splice(o.repeat === "end" ? queue.length : Math.min(2, queue.length), 0, { ...q, dir: prDirOf(sess.spec.dir) });
  }
  if (!sess.ended) prResults(sess);
}
// Flashcards: misses come back until every card is known. Star a card, or reshuffle what's left.
PR_RUN.cards = sess => {
  let cur = null;
  const paint = sh => { const b = sh.right.querySelector("[data-star]"); if (b && cur) { const on = prStarred(cur); b.innerHTML = on ? PR_ICON.starOn : PR_ICON.star; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); } };
  return prQueue(sess, "card", {
    repeat: 2,
    right: `<button class="pr-ib" data-shuffle aria-label="Shuffle what's left">${PR_ICON.shuffle}</button><button class="pr-ib" data-star aria-label="Star this color">${PR_ICON.star}</button>`,
    onShell: sh => {
      sh.right.querySelector("[data-star]").onclick = () => { if (!cur) return; prStar(cur); buzz(8); paint(sh); };
      sh.right.querySelector("[data-shuffle]").onclick = () => { const q = sess.queue(); if (q.length > 2) { const head = q.shift(); const rest = prShuffle(q); q.length = 0; q.push(head, ...rest); } buzz(8); toast("Shuffled"); };
    },
    onCard: (it, sh) => { cur = it; paint(sh); },
  });
};
PR_RUN.quiz = sess => prQueue(sess, q => q.dir === "r" ? "quiz-color" : "quiz-name");
PR_RUN.type = sess => prQueue(sess, "type");
PR_RUN.odd = sess => prQueue(sess, "odd-one-out");
// Say it: one microphone for the whole run, misses at the end, the screen kept awake.
PR_RUN.say = sess => {
  const ear = sess.ear || prEar();
  let lock = null;
  const wake = async () => { try { if (navigator.wakeLock && document.visibilityState === "visible") lock = await navigator.wakeLock.request("screen"); } catch (e) {} };
  const vis = () => { if (document.visibilityState === "visible") wake(); };
  const run = prQueue(sess, "say", { repeat: "end", ctx: { ear, speak: prState().speak !== false } });
  // after prQueue's show(): these belong to the play screen and go when it does
  if (ear) cleanup.push(() => ear.stop());
  wake(); document.addEventListener("visibilitychange", vis);
  cleanup.push(() => { document.removeEventListener("visibilitychange", vis); try { if (lock) lock.release(); } catch (e) {} try { speechSynthesis.cancel(); } catch (e) {} });
  return run;
};
// Match: boards of six against the clock; a wrong pair adds a second.
// Boards after the first group neighbors by hue, so the matching gets harder: telling look-alikes apart
function prBoards(items) {
  if (items.length <= PR_SET * 1.5) return items;
  const key = it => { const [L, C, H] = lch(it.h); return C < 12 ? 400 + (100 - L) : H; };
  return [...items.slice(0, PR_SET), ...items.slice(PR_SET).sort((a, b) => key(a) - key(b))];
}
PR_RUN.match = async sess => {
  let pen = 0;
  sess.items = prBoards(sess.items);
  const sh = prShell(sess, { right: `<span class="pr-code" data-clock>0.0 s</span>` }), clock = sh.right.querySelector("[data-clock]");
  const tick = () => { if (!clock.isConnected) return; clock.textContent = prTime(performance.now() - sess.t0 + pen * 1000); later(tick, 100); };
  tick();
  for (let i = 0; i < sess.items.length && !sess.ended; i += PR_SET) {
    const set = sess.items.slice(i, i + PR_SET);
    if (i === PR_SET) prCoach(sess, sh.el, "Now look-alikes, side by side.");
    const res = await PR_STEPS.match.render(sh.stage, set, prCtx(sess, sh, { onMiss: () => { pen++; clock.classList.remove("pen"); void clock.offsetWidth; clock.classList.add("pen"); } }));
    if (sess.ended || !sh.stage.isConnected) return;
    res.per.forEach(p => { prRecord(sess, p.item, { ok: p.ok, answer: p.answer, ms: res.ms / set.length }, "match"); sh.seg(p.item, p.ok ? "on" : "met"); });
  }
  sess.score = { ms: performance.now() - sess.t0 + pen * 1000, pen, lower: true };
  prResults(sess);
};
// Pairs: boards of six pairs; the score is the time.
PR_RUN.pairs = async sess => {
  let flips = 0;
  sess.items = prBoards(sess.items);
  const sh = prShell(sess, { right: `<span class="pr-code" data-clock>0.0 s</span>` }), clock = sh.right.querySelector("[data-clock]");
  const tick = () => { if (!clock.isConnected) return; clock.textContent = prTime(performance.now() - sess.t0); later(tick, 100); };
  tick();
  for (let i = 0; i < sess.items.length && !sess.ended; i += PR_SET) {
    const set = sess.items.slice(i, i + PR_SET);
    const res = await PR_STEPS.pairs.render(sh.stage, set, prCtx(sess, sh));
    if (sess.ended || !sh.stage.isConnected) return;
    flips += res.flips || 0;
    res.per.forEach(p => { prRecord(sess, p.item, { ok: p.ok, answer: p.answer, ms: res.ms / set.length }, "pairs"); sh.seg(p.item, p.ok ? "on" : "met"); });
  }
  sess.score = { ms: performance.now() - sess.t0, flips, lower: true };
  prResults(sess);
};
// Learn (adaptive, like Quizlet Learn): rounds of about seven; each color climbs pick -> type and is mastered
// after two right in a row. A miss drops it back to pick and brings it back sooner.
PR_RUN.learn = async sess => {
  const sh = prShell(sess), lv = new Map(sess.items.map(it => [it.key, { pick: true, streak: 0, done: false }]));
  let pending = sess.items.slice(), active = [], round = 0;
  const refill = () => { while (active.length < 7 && pending.length) { const it = pending.shift(); active.push(it); sh.seg(it, "met"); } };
  refill();
  while (active.length && !sess.ended) {
    round++;
    let qs = prShuffle(active.filter(it => !lv.get(it.key).done)), asked = 0;
    while (qs.length && !sess.ended) {
      const it = qs.shift(), s = lv.get(it.key), dir = prDirOf(sess.spec.dir);
      const kind = s.pick ? (dir === "r" ? "quiz-color" : "quiz-name") : "type";
      const res = await PR_STEPS[kind].render(sh.stage, it, prCtx(sess, sh, { dir }));
      if (sess.ended || !sh.stage.isConnected) return;
      prRecord(sess, it, res, kind); asked++;
      if (res.ok && !res.assist) { s.streak++; s.pick = false; if (s.streak >= 2) { s.done = true; sh.seg(it, "on"); } }
      else { s.streak = 0; s.pick = true; if (!qs.includes(it) && asked < 14) qs.splice(Math.min(2, qs.length), 0, it); }
    }
    active = active.filter(it => !lv.get(it.key).done);
    refill();
    if (!active.length || sess.ended) break;
    // a short checkpoint between rounds
    const mastered = sess.items.filter(it => lv.get(it.key).done);
    await new Promise(res => {
      sh.stage.innerHTML = `<div class="pr-step pr-s-check">
        ${prPlate(mastered.length ? mastered : active, "pr-plate-check")}
        <h2 class="pr-t1">Round ${round} <em>done</em></h2>
        <p class="pr-notep"><span class="pr-code">${mastered.length}</span> of <span class="pr-code">${sess.items.length}</span> mastered. Next: ${active.length} to go over, harder this time.</p>
        <div class="pr-grow"></div>${prPrimary("Keep going", "", "data-go")}</div>`;
      sh.stage.querySelector("[data-go]").onclick = res;
      sh.setKey(e => { if (e.key === "Enter") res(); });
    });
  }
  if (!sess.ended) prResults(sess);
};
// Test: about twenty mixed questions, no feedback until the end.
PR_RUN.test = async sess => {
  const kinds = ["quiz-name", "type", "quiz-color", "blitz-yes-no"], items = prShuffle(sess.items).slice(0, 20);
  sess.items = items;
  const sh = prShell(sess);
  sh.el.classList.add("pr-blind");
  for (let i = 0; i < items.length && !sess.ended; i++) {
    const it = items[i], kind = kinds[i % kinds.length];
    const res = await PR_STEPS[kind].render(sh.stage, it, prCtx(sess, sh, { feedback: false, dir: kind === "quiz-color" ? "r" : "f" }));
    if (sess.ended || !sh.stage.isConnected) return;
    prRecord(sess, it, res, kind);
    sh.seg(it, "on");
  }
  if (!sess.ended) prResults(sess);
};
// Blitz: sixty seconds of yes or no. A combo multiplier grows every five in a row.
PR_RUN.blitz = async sess => {
  const sh = prShell(sess, { timer: true, right: `<span class="pr-code" data-score>0</span><span class="pr-mult" data-mult></span>` });
  const score = sh.right.querySelector("[data-score]"), mult = sh.right.querySelector("[data-mult]");
  sess.score = { pts: 0, n: 0, right: 0, best: 0 };
  let combo = 0, last = null, over = false;
  sh.timer(PR_BLITZ_SECS);
  later(() => { over = true; sess.ended = true; prResults(sess); }, PR_BLITZ_SECS * 1000);
  while (!over && !sess.ended) {
    let it; do { it = sess.items[Math.random() * sess.items.length | 0]; } while (sess.items.length > 1 && it === last);
    last = it;
    // a breathing curve: early false claims are a farther neighbor, a long run brings the nearest; a miss resets it
    const near = prNear(it, 3, sess.deckAll || sess.items), o = near[Math.min(near.length - 1, combo < 4 ? 2 : combo < 9 ? 1 : 0)];
    const claim = Math.random() < .5 || !o ? { n: prName(it), h: it.h, truth: true } : { n: prName(o), h: o.h, truth: false };
    const res = await PR_STEPS["blitz-yes-no"].render(sh.stage, it, prCtx(sess, sh, { claim }));
    if (over || !sh.stage.isConnected) return;
    prRecord(sess, it, res, "blitz-yes-no");
    sess.score.n++;
    const m0 = Math.min(4, 1 + Math.floor(combo / 5));
    if (res.ok) { combo++; sess.score.right++; const m = Math.min(4, 1 + Math.floor(combo / 5)); sess.score.pts += m; sess.score.best = Math.max(sess.score.best, combo); }
    else combo = 0;
    const m = Math.min(4, 1 + Math.floor(combo / 5));
    score.textContent = sess.score.pts; mult.textContent = m > 1 ? `×${m}` : "";
    if (m > m0) { mult.classList.remove("up"); void mult.offsetWidth; mult.classList.add("up"); buzz([10, 30, 20]); prCoach(sess, sh.el, m === 2 ? "Five in a row: every right answer counts double." : `×${m}. The look-alikes get closer.`); }
    else if (m < m0) prCoach(sess, sh.el, "Run over. Easier ones again.");
  }
};
// Color rain: three lives; it falls a little faster after every catch.
PR_RUN.rain = async sess => {
  const life = n => `<span class="pr-lives"><span class="pr-code">${n}</span> <em>${n === 1 ? "life" : "lives"}</em></span>`;
  const sh = prShell(sess, { right: life(PR_RAIN_LIVES) });
  let lives = PR_RAIN_LIVES, fall = 7000, caught = 0;
  for (let i = 0; i < sess.items.length && lives > 0 && !sess.ended; i++) {
    const it = sess.items[i];
    const res = await PR_STEPS.rain.render(sh.stage, it, prCtx(sess, sh, { fall, ease: caught < 4 }));
    if (sess.ended || !sh.stage.isConnected) return;
    prRecord(sess, it, res, "rain");
    sh.seg(it, res.ok ? "on" : "met");
    if (res.ok) { caught++; fall = Math.max(2600, fall * .95); if (caught === 4) prCoach(sess, sh.el, "Now the closest look-alikes."); }
    else { lives--; fall = Math.min(7000, fall * 1.12); sh.right.innerHTML = life(lives); }
  }
  sess.score = { caught, lives };
  if (!sess.ended) prResults(sess);
};

// ======================================================================
// Starting a method
// ======================================================================
// opts: { items (play exactly these, e.g. your misses or an instant deck), label, offset,
//         exit (where ✕ goes; default the builder), other ("Same deck, another way"; default the builder) }
const prExit = sess => (sess && sess.exit ? sess.exit() : prHome());
function prPlay(method, opts = {}) {
  if (!PR_METHODS[method]) method = "cards";
  if (typeof CORE_NAMES !== "undefined" && !CORE_NAMES && typeof loadCoreNames === "function") return void loadCoreNames().then(() => prPlay(method, opts));
  const spec = { ...prSpec(), method };
  if (!opts.items) prSaveSpec(spec);
  const deck = opts.deck || prDeck(spec), offset = opts.offset || 0;
  const items = opts.items || prRound(deck, spec, offset);
  if (!items.length) { toast("No colors in this deck yet"); return prHome(); }
  const sess = prSession(method, spec, items, { deckAll: deck, offset, label: opts.label || "", misses: !!opts.items, exit: opts.exit || null, other: opts.other || null });
  if (method === "say" && !opts.started) return prSayIntro(sess);
  if (method === "blitz" || method === "pairs" || method === "match") buzz(8);
  return PR_RUN[method](sess);
}
// Say it needs a tap to start (the microphone asks permission), and a choice: read the answers aloud.
function prSayIntro(sess) {
  const can = typeof speechCtor === "function" && !!speechCtor(), p = prState();
  const el = show(`<header class="pr-top"><button class="pr-x" data-close aria-label="Close">${prX()}</button><span class="pr-grow"></span></header>
    <div class="pr-intro">
      ${prPlate(sess.items, "pr-plate-intro")}
      <h1 class="pr-t1">Say it, <em>hands-free</em></h1>
      <p class="pr-lead">${can ? "A color fills the screen. Say its name out loud; the next one comes up by itself." : "This browser can't listen, so Say it runs as Type it here."}</p>
      ${can ? `<div class="pr-rows pr-cmdrows">
        <div class="pr-row"><b>“I don't know”</b><span>or “skip”: see the answer, it comes back later</span></div>
        <div class="pr-row"><b>“Hint”</b><span>the first letter</span></div>
        <div class="pr-row"><b>“Pause”</b><span>or tap anywhere</span></div>
      </div>
      <label class="pr-switch"><span>Read the answers aloud</span><input type="checkbox" ${p.speak !== false ? "checked" : ""} data-speak><i></i></label>` : ""}
    </div>
    <div class="pr-grow"></div>
    ${prPrimary(can ? "Start listening" : "Start", `${sess.items.length} colors`, "data-go")}`, "pr-say-intro pr-booth fixed");
  el.querySelector("[data-close]").onclick = () => prExit(sess);
  const sw = el.querySelector("[data-speak]");
  if (sw) sw.onchange = () => { p.speak = sw.checked; save(); buzz(4); };
  const go1 = () => { if (!can) return PR_RUN.type(sess); sess.ear = prEar(); PR_RUN.say(sess); };
  el.querySelector("[data-go]").onclick = go1;
  onKey = e => { if (e.key === "Enter") go1(); if (e.key === "Escape") prExit(sess); };
}

// ======================================================================
// Results: % right, time, every miss beside what you gave, then "Practice my misses" and "Same deck, another way"
// ======================================================================
function prAnswerLine(f) {
  const a = f.answer || {};
  if (f.kind === "card") return "You didn't know it yet";
  if (a.kind === "skip") return "Skipped";
  if (a.kind === "landed") return "It landed";
  if (a.kind === "typed") return a.text ? `You typed “${esc(String(a.text).trim().slice(0, 28))}”` : "No answer";
  if (a.kind === "heard") return a.text ? `Heard “${esc(String(a.text).trim().slice(0, 28))}”` : "No answer";
  if (a.kind === "claim") return a.yes ? `You said it was ${esc(a.n)}` : `You said it wasn't ${esc(a.n)}`;
  if (a.kind === "pick") return f.kind === "odd-one-out" ? `You picked ${esc(a.n)}` : `You picked ${esc(a.n)}`;
  return "Missed";
}
function prBestFor(sess) {
  const s = sess.score, m = sess.method;
  if (sess.misses || !s) return null;
  const key = `${m}|${prSpecKey(sess.spec)}|${sess.items.length}`, best = prState().best;
  const v = m === "match" || m === "pairs" ? s.ms : m === "blitz" ? s.pts : m === "rain" ? s.caught : null;
  if (v == null) return null;
  const lower = m === "match" || m === "pairs", old = best[key];
  const better = !old || (lower ? v < old.v : v > old.v);
  if (better && (lower ? true : v > 0)) { best[key] = { v, at: today() }; save(); }
  return { v, old: old ? old.v : null, better: better && (lower || v > 0), first: !old, lower };
}
function prResults(sess, o = {}) {
  sess.ended = true;
  const ms = performance.now() - sess.t0, firsts = [...sess.first.values()], right = firsts.filter(f => f.ok).length, total = firsts.length;
  const misses = firsts.filter(f => !f.ok), pct = total ? Math.round(right * 100 / total) : 0, m = sess.method, M = PR_METHODS[m];
  const best = prBestFor(sess), s = sess.score || {};
  const deck = sess.deckAll || sess.items, nextOff = (sess.offset || 0) + sess.items.length, more = !sess.misses && sess.spec.round > 0 && nextOff < deck.length;
  let title, line;
  const mono = v => `<span class="pr-code">${v}</span>`;
  if (m === "cards" || m === "say") {
    title = !o.stopped && sess.items.length === firsts.length ? (sess.items.length === 1 ? "You know <em>it</em>" : `All ${sess.items.length} <em>known</em>`) : `${right} of ${total} <em>first time</em>`;
    line = `${right} of ${total} on the first go · ${mono(prTime(ms))}`;
    if (m === "cards") line += " · You graded these yourself, so they don't count as yours.";
  } else if (m === "blitz") {
    title = `${s.pts || 0} <em>points</em>`;
    line = `${mono(s.right || 0)} of ${mono(s.n || 0)} right · best run ${mono(s.best || 0)}`;
  } else if (m === "match" || m === "pairs") {
    title = `${prTime(s.ms || ms)} <em>flat</em>`;
    line = m === "match" ? `${s.pen ? `${mono(s.pen)} wrong ${s.pen === 1 ? "pair" : "pairs"}, a second each` : "No wrong pairs"} · ${mono(pct + "%")}` : `${mono(s.flips || 0)} tries · ${mono(pct + "%")}`;
  } else if (m === "rain") {
    title = `${s.caught || 0} <em>caught</em>`;
    line = `${mono(pct + "%")} · ${s.lives > 0 ? "Every color named" : `It ended at ${mono(total)} of ${mono(sess.items.length)}`}`;
  } else {
    title = right === total && total ? `All ${total} <em>right</em>` : `${right} of ${total} <em>right</em>`;
    line = `${mono(pct + "%")} · ${mono(prTime(ms))}`;
  }
  if (best && best.better && !best.first) line += " · A new best";
  else if (best && !best.better && best.old != null) line += ` · Best ${mono(best.lower ? prTime(best.old) : best.old)}`;
  // Test: how each kind of question went
  if (m === "test") {
    const kinds = [["quiz-name", "naming"], ["quiz-color", "finding"], ["type", "typing"], ["blitz-yes-no", "true or false"]];
    const parts = kinds.map(([k, t]) => { const f = firsts.filter(x => x.kind === k); return f.length ? `${t} ${mono(f.filter(x => x.ok).length + "/" + f.length)}` : ""; }).filter(Boolean);
    if (parts.length) line += " · " + parts.join(", ");
  }
  line = line.replace(/ · /g, "&ensp;·&ensp;");
  // what it did to your reviews, honestly (only learned colors are ever touched)
  const ap = sess.applied || {};
  const sched = [ap.review ? `Counted as today's review for ${ap.review} ${ap.review === 1 ? "color" : "colors"}` : "", ap.tomorrow ? `${ap.tomorrow} come${ap.tomorrow === 1 ? "s" : ""} back tomorrow` : ""].filter(Boolean).join(". ");
  const win = (total > 0 && !misses.length && !o.stopped) || (best && best.better && !best.first);
  const rows = misses.map((f, i) => {
    const a = f.answer || {}, yours = a.h && (a.kind !== "claim" || a.yes) ? `<i style="--c:${a.h}"></i>` : `<i class="none"></i>`;
    return `<button class="pr-row pr-miss" data-open="${i}"><span class="pr-pair2"><i style="--c:${f.it.h}"></i>${yours}</span><span class="pr-rowt"><b>${esc(prName(f.it))}</b><small>${prAnswerLine(f)}</small></span>${PR_ICON.chev}</button>`;
  }).join("");
  const shareText = `ColorHub · ${M.t} · ${sess.items.length} colors · ${String(title).replace(/<[^>]+>/g, "")}`;
  const el = show(`<header class="pr-top"><button class="pr-x" data-close aria-label="Close">${prX()}</button><span class="pr-grow"></span><span class="pr-note">${esc(M.t)}</span></header>
    ${prPlate(sess.items, "pr-plate-res" + (win ? " win" : ""))}
    <h1 class="pr-t1 pr-res-t">${title}</h1>
    <p class="pr-notep">${line}</p>
    ${sched ? `<p class="pr-notep pr-sched">${sched}.</p>` : ""}
    ${misses.length ? `<p class="pr-note pr-sec-n">${misses.length === 1 ? "The one to look at again" : `The ${misses.length} to look at again`}</p><div class="pr-rows">${rows}</div>` : ""}
    <div class="pr-grow"></div>
    <div class="pr-acts">
      ${misses.length ? prPrimary("Practice my misses", String(misses.length), "data-a=misses") : more ? prPrimary(`Next ${Math.min(sess.spec.round, deck.length - nextOff)}`, "", "data-a=next") : prPrimary("Again", "", "data-a=again")}
      ${misses.length && more ? `<button class="pr-text" data-a="next">Go on to the next ${Math.min(sess.spec.round, deck.length - nextOff)}</button>` : ""}
      <span class="pr-textrow"><button class="pr-text" data-a="other">Same deck, another way</button><button class="pr-text" data-a="share">Share</button></span>
    </div>`, "pr-res pr-booth");
  buzz(misses.length ? 8 : [10, 30, 20]);
  const act = a => {
    const keep = { exit: sess.exit, other: sess.other };
    if (a === "misses") return prPlay(m, { items: prShuffle(misses.map(f => f.it)), deck, label: "Your misses", ...keep });
    if (a === "next") return prPlay(m, { deck, offset: nextOff, ...keep });
    if (a === "again") return prPlay(m, sess.misses ? { items: prShuffle(sess.items), deck, ...keep } : { deck: sess.spec.order === "shuffle" ? null : deck, offset: sess.offset || 0, ...keep });
    if (a === "share") {
      try { if (navigator.share) return void navigator.share({ text: shareText }).catch(() => {}); navigator.clipboard.writeText(shareText); toast("Copied"); } catch (e) {}
      return;
    }
    return sess.other ? sess.other() : prHome();
  };
  // a miss opens its color's page (any of the ~1,000 names)
  el.querySelectorAll("[data-open]").forEach(b => b.onclick = () => { const f = misses[+b.dataset.open]; if (f && typeof openCoreName === "function") openCoreName(f.it.h, f.it.n); });
  el.querySelectorAll("[data-a]").forEach(b => b.onclick = () => act(b.dataset.a));
  el.querySelector("[data-close]").onclick = () => prExit(sess);
  onKey = e => { if (e.key === "Enter") act(misses.length ? "misses" : more ? "next" : "again"); if (e.key === "Escape") prExit(sess); };
}

// ======================================================================
// The builder (#/practice): one calm screen. Which colors, how they're asked, then the ways to study them.
// ======================================================================
function prArt(m, cols) {
  const c = i => cols[i % cols.length] || "#808080";
  const art = {
    cards: `<i class="a-card a2" style="--c:${c(1)}"></i><i class="a-card" style="--c:${c(0)}"><b></b></i>`,
    quiz: `<i class="a-sw" style="--c:${c(0)}"></i><span class="a-lines"><b></b><b class="on"></b><b></b><b></b></span>`,
    type: `<i class="a-sw" style="--c:${c(2)}"></i><span class="a-type">Te<b></b></span>`,
    match: `<span class="a-grid">${[0, 1, 2, 3, 4, 5].map(i => i % 2 ? `<b></b>` : `<i style="--c:${c(i)}"></i>`).join("")}</span>`,
    learn: `<span class="a-steps">${[0, 1, 2].map(i => `<i style="--c:${c(i)};height:${30 + i * 12}%"></i>`).join("")}</span>`,
    test: `<span class="a-test">${[0, 1, 2].map(i => `<b><i style="--c:${c(i)}"></i><em></em></b>`).join("")}</span>`,
    say: `<i class="a-sw a-round" style="--c:${c(3)}"></i><span class="a-say">${PR_ICON.mic}</span>`,
    blitz: `<i class="a-sw" style="--c:${c(1)}"></i><span class="a-yn"><b>${icon("check", 18)}</b><b>${icon("x", 18)}</b></span>`,
    pairs: `<span class="a-grid">${[0, 1, 2, 3, 4, 5].map(i => i === 1 ? `<i style="--c:${c(0)}"></i>` : i === 4 ? `<b class="p"></b>` : `<b class="d"></b>`).join("")}</span>`,
    rain: `<span class="a-rain"><i style="--c:${c(2)}"></i><b></b><b></b><b></b></span>`,
    odd: `<span class="a-odd"><i style="--c:${c(0)}"></i><i style="--c:${c(0)}"></i><i style="--c:${c(0)}"></i><i style="--c:${c(1)}"></i></span>`,
  };
  return `<span class="pr-art" aria-hidden="true">${art[m] || ""}</span>`;
}
function prLists() {
  const p = prState(), out = [];
  const add = (id, n) => { if (n) out.push([id, prListLabel(id), n]); };
  add("due", dueList().length);
  add("mine", (typeof cardsAll === "function" ? cardsAll() : ALL.filter(c => S.cards[c.id])).length);
  add("tricky", Object.keys(p.tricky).length);
  add("star", p.star.length);
  UNITS.forEach(u => add("unit:" + u.id, u.colors.length));
  (S.palettes || []).forEach(pl => add("pal:" + pl.id, pl.cols.length));
  (S.saved || []).filter(id => /^painting-/.test(id)).forEach(id => { const pt = (window.PAINTINGS || []).find(x => x.id === id); if (pt && pt.palette) add("ptg:" + id, pt.palette.length); });
  return out;
}
function prHome(o = {}) {
  if (typeof CORE_NAMES !== "undefined" && !CORE_NAMES && typeof loadCoreNames === "function") return void loadCoreNames().then(() => prHome(o));
  const spec = prSpec(), lists = prLists();
  if (spec.src === "list" && !lists.some(l => l[0] === spec.list)) { spec.src = "first"; spec.list = ""; }
  const chip = (attr, label, on, n) => `<button class="pr-chip${on ? " on" : ""}" ${attr} aria-pressed="${on}">${label}${n != null ? ` <span class="pr-code">${n}</span>` : ""}</button>`;
  const el = show(`<header class="pr-top pr-top-home"><button class="pr-fbtn" data-back aria-label="Back">${PR_ICON.back}</button></header>
    <div class="pr-hrow"><h1 class="pr-t1">Practice</h1><span class="pr-note">Your own deck</span></div>
    <div class="pr-sum" data-sum></div>
    <section class="pr-sec"><p class="pr-note">Which colors</p>
      <div class="pr-rail" data-row="range">${PR_RANGES.map(n => chip(`data-n="${n}"`, `First ${n.toLocaleString()}`, spec.src === "first" && spec.n === n)).join("")}</div>
      <div class="pr-slide"><input type="range" min="5" max="1000" step="1" value="${spec.n}" data-slider aria-label="Any number of colors"><span class="pr-code" data-slider-n>${spec.n}</span></div>
    </section>
    <section class="pr-sec"><p class="pr-note">Only</p>
      <div class="pr-rail" data-row="fam">${PR_FAMS.map(([id, t]) => chip(`data-fam="${id}"`, t, spec.fam === id)).join("")}</div>
    </section>
    ${lists.length ? `<section class="pr-sec"><p class="pr-note">Or a list</p>
      <div class="pr-rail" data-row="list">${lists.map(([id, t, n]) => chip(`data-list="${esc(id)}"`, esc(t), spec.src === "list" && spec.list === id, n)).join("")}</div></section>` : ""}
    <section class="pr-sec pr-sec-3">
      <div><p class="pr-note">Order</p><div class="pr-seg" data-row="order">${PR_ORDERS.map(([id, t]) => chip(`data-order="${id}"`, t, spec.order === id)).join("")}</div></div>
      <div><p class="pr-note">Ask</p><div class="pr-seg" data-row="dir">${PR_DIRS.map(([id, t]) => chip(`data-dir="${id}"`, t, spec.dir === id)).join("")}</div></div>
      <div><p class="pr-note">Round</p><div class="pr-seg" data-row="round">${PR_ROUNDS.map(([n, t]) => chip(`data-round="${n}"`, t, spec.round === n)).join("")}</div></div>
    </section>
    <section class="pr-sec"><p class="pr-note">Ways to practice</p><div class="pr-tiles" data-tiles></div>
      <button class="pr-text pr-more" data-more>More ways</button></section>
    <div class="pr-dock"><div data-start></div></div>`, "pr-home");
  const sum = el.querySelector("[data-sum]"), tiles = el.querySelector("[data-tiles]"), start = el.querySelector("[data-start]"), slider = el.querySelector("[data-slider]"), sliderN = el.querySelector("[data-slider-n]");
  let showAll = !!o.more || !PR_FIRST4.includes(spec.method);
  const paint = () => {
    const items = prSource(spec), cols = items.slice(0, 8).map(it => it.h);
    const n = items.length, per = spec.round > 0 ? Math.min(spec.round, n) : n;
    sum.innerHTML = `${prPlate(items.length ? items : [], "pr-plate-home")}
      <div class="pr-count"><b class="pr-t2">${n ? `${n.toLocaleString()} ${n === 1 ? "color" : "colors"}` : "No colors"}</b><span class="pr-note">${n ? esc(prDeckLine(spec)) + (per < n ? `, ${per} at a time` : "") : "Nothing matches. Try a wider range."}</span></div>`;
    const order = showAll ? Object.keys(PR_METHODS) : PR_FIRST4;
    tiles.innerHTML = order.map(m => `<button class="pr-tile-m${spec.method === m ? " last" : ""}" data-m="${m}">${prArt(m, cols.length ? cols : ["#808080"])}<b>${PR_METHODS[m].t}</b><span>${PR_METHODS[m].d}</span></button>`).join("");
    el.querySelector("[data-more]").style.display = showAll ? "none" : "";
    start.innerHTML = prPrimary("Start", PR_METHODS[spec.method].t, `data-go${n ? "" : " disabled"}`);
    start.querySelector("[data-go]").onclick = () => { if (n) prPlay(spec.method); };
    tiles.querySelectorAll("[data-m]").forEach(b => b.onclick = () => { if (!n) return; spec.method = b.dataset.m; prSaveSpec(spec); buzz(8); prPlay(spec.method); });
    el.querySelectorAll(".pr-chip").forEach(b => {
      const d = b.dataset, on = d.n ? spec.src === "first" && spec.n === +d.n : d.fam ? spec.fam === d.fam : d.list ? spec.src === "list" && spec.list === d.list
        : d.order ? spec.order === d.order : d.dir ? spec.dir === d.dir : d.round != null ? spec.round === +d.round : false;
      b.classList.toggle("on", on); b.setAttribute("aria-pressed", on);
    });
    el.classList.toggle("pr-listmode", spec.src === "list");
    slider.value = spec.n; sliderN.textContent = spec.n.toLocaleString();
  };
  el.addEventListener("click", e => {
    const b = e.target.closest(".pr-chip"); if (!b) return;
    const d = b.dataset;
    if (d.n) { spec.src = "first"; spec.n = +d.n; spec.list = ""; }
    else if (d.fam) spec.fam = d.fam;
    else if (d.list) { if (spec.src === "list" && spec.list === d.list) { spec.src = "first"; spec.list = ""; } else { spec.src = "list"; spec.list = d.list; } }
    else if (d.order) spec.order = d.order;
    else if (d.dir) spec.dir = d.dir;
    else if (d.round != null) spec.round = +d.round;
    buzz(4); prSaveSpec(spec); paint();
  });
  slider.addEventListener("input", () => { spec.src = "first"; spec.list = ""; spec.n = +slider.value; sliderN.textContent = spec.n.toLocaleString(); paint(); });
  slider.addEventListener("change", () => { buzz(4); prSaveSpec(spec); });
  el.querySelector("[data-more]").onclick = () => { showAll = true; buzz(4); paint(); };
  el.querySelector("[data-back]").onclick = () => (typeof home === "function" ? home() : go("learn"));
  onKey = e => { if (e.key === "Enter" && !(e.target && e.target.tagName === "INPUT")) prPlay(spec.method); };
  paint();
  // the chosen chip in each rail is in view
  requestAnimationFrame(() => el.querySelectorAll(".pr-rail").forEach(r => { const on = r.querySelector(".on"); if (on && on.offsetLeft + on.offsetWidth > r.clientWidth - 8) r.scrollLeft = Math.max(0, on.offsetLeft - 24); }));
  return el;
}

// ======================================================================
// Instant decks: start learning any color (or any set of colors) in one tap, outside the path.
//   prInstantDeck({ seed, source, size, items }) -> { items, label, source, seed, counts }   (pure: builds the deck)
//   prInstantDeck({ set })   a ColorSet from js/colorset.js (csLearn): opens the quick sheet on the set's colors
//   prQuick({ seed, items, label, source, size, method })                         (the quick sheet; one tap on Start)
//   prLearnSet(hexes, label)                                                      (a painting, photo, palette or poem's colors)
// seed: a hex, a name (any of the core names or a library name given as { n, h }), or an item. items: hexes or items.
// The path never changes: these are free-play decks under the same honest scheduling policy as every Practice deck.
// ======================================================================
const PR_SOURCES = {
  alike: "Look-alikes", family: "Its family", level: "Same level", these: "These colors", mixups: "Mix-ups",
  first: "First 50", due: "Due now", tricky: "Tricky", star: "Starred",
};
const PR_SIZES = [[5, "5"], [10, "10"], [20, "20"], [0, "All"]];
const PR_BANDS = [0, 25, 50, 100, 150, 250, 400, 600, 800, 1000];   // the honeycomb's nine stages (js/home.js HM_STAGES)
// the stage a rank sits in: 1..9 (a name past the core list is stage 10)
const prBand = rank => { for (let i = 1; i < PR_BANDS.length; i++) if (rank < PR_BANDS[i]) return i; return PR_BANDS.length; };
// The seed as an item. A core name is itself; a library name keeps its own name and swatch; any other hex is
// practiced as its nearest name (nameOf), since a name is what's being learned.
function prSeed(seed) {
  if (!seed) return null;
  if (typeof seed === "object") {
    if (seed.key) return seed;
    const core = seed.n && prByKey(seed.n);
    if (core) return core;
    if (seed.n && seed.h) return prItem({ n: seed.n, h: seed.h });
    if (seed.h) return prItemOf(seed.h);
    return null;
  }
  return prItemOf(seed) || null;
}
// For a library name the difficulty band is its nearest core name's
// difficulty = how common the word is (useRank in data/core-names.json), else its place in the stage order
const prLevelRank = it => it.useRank != null ? it.useRank : it.rank;
const prSeedRank = it => it.rank < 9999 ? prLevelRank(it) : (prItemOf(it.h) ? prLevelRank(prItemOf(it.h)) : 9999);
function prInstantDeck(o = {}) {
  // csLearn (js/colorset.js) hands over a ColorSet: open the quick sheet with its colors as "These colors"
  if (o.set && !o.build) { const set = typeof o.set === "function" ? o.set() : o.set; return prQuick({ items: ((set && set.colors) || []).map(c => c.h), label: (set && set.title) || "", src: set && set.kind, seed: o.seed, back: o.back, pin: o.pin, route: o.route }); }
  if (o.source === "set") o = { ...o, source: "these" };
  const seed = prSeed(o.seed), size = o.size == null ? 10 : +o.size, core = prCore(), p = prState();
  const these = prUnique((o.items || []).map(x => typeof x === "string" ? prItemOf(x) : prSeed(x)).filter(Boolean));
  const cap = (list, n) => n > 0 ? list.slice(0, n) : list;
  const byDist = list => list.map(x => ({ x, d: de2000(seed.h, x.h) })).sort((a, b) => a.d - b.d).map(o => o.x);
  const build = {
    // this color and the names nearest it, from all the core names (the ones easiest to mix it up with)
    alike: () => seed ? [seed, ...byDist(core.filter(x => x.key !== seed.key && x.h !== seed.h))] : [],
    // its family (the nine hue families), nearest first
    family: () => seed ? [seed, ...byDist(core.filter(x => x.key !== seed.key && prFam9(x.h) === prFam9(seed.h)))] : [],
    // names of the same difficulty: the same stage of the path's order
    level: () => { if (!seed) return []; const b = prBand(prSeedRank(seed)); return [seed, ...prShuffle(core.filter(x => x.key !== seed.key && prBand(prLevelRank(x)) === b))]; },
    these: () => these,
    // names you've confused: this color and what you said instead, then your other mix-ups
    mixups: () => {
      const out = [], add = k => { const it = prByKey(k); if (it) out.push(it); };
      const lm = typeof confusions === "function" ? (seed ? confusions({ n: seed.n, h: seed.h }, 8) : confusions(null, 12)) : [];
      if (seed && (lm.length || p.mix[seed.key])) out.push(seed);
      lm.forEach(x => { add(String(x.a || "").toLowerCase()); add(String(x.b || "").toLowerCase()); });
      if (seed && p.mix[seed.key]) p.mix[seed.key].forEach(add);
      Object.entries(p.mix).forEach(([k, list]) => { add(k); list.forEach(add); });
      return out;
    },
    first: () => prFirst(50),
    due: () => prList("due"), tricky: () => prList("tricky"), star: () => prList("star"),
  };
  const counts = {};
  Object.keys(build).forEach(k => { counts[k] = k === "these" ? these.length : k === "first" ? 50 : k === "mixups" ? Object.keys(p.mix).length + (typeof confusions === "function" ? confusions(null, 12).length : 0) : k === "due" ? dueList().length
    : k === "tricky" ? Object.keys(p.tricky).length : k === "star" ? p.star.length : seed ? 1 : 0; });
  let source = o.source && build[o.source] && counts[o.source] ? o.source : these.length ? "these" : seed ? "alike" : "first";
  let items = prUnique(build[source]());
  // keep the seed in, then shuffle so it isn't always the first card
  items = cap(items, size);
  if (o.shuffle !== false) items = prShuffle(items);
  const nm = seed ? prName(seed) : "";
  const label = source === "these" ? (o.label || "These colors") : source === "alike" ? `${nm} and its look-alikes` : source === "family" ? `${nm}'s family`
    : source === "level" ? `Names as hard as ${nm.toLowerCase()}` : PR_SOURCES[source];
  return { items, label, source, seed, counts };
}
// The quick sheet. Smart defaults are already chosen, so one tap on Start begins; chips change them; it remembers.
function prQuick(o = {}) {
  // every "Learn"/"Study" with a color or a set opens the Learn sheet (js/learnset.js): Look and Study, always both,
  // the settings visible before Study begins. A single seeded color (no items) gets the old quick mode's shape as
  // its starting size (the color + 3 nearest) so it's still one tap away; LS_QUICK_N lives in js/learnset.js.
  if (typeof lsOpen === "function" && !o.legacy && ((o.items && o.items.length) || o.seed)) {
    const seedOnly = o.seed && !(o.items && o.items.length);
    return lsOpen(seedOnly && o.size == null && typeof LS_QUICK_N !== "undefined" ? { ...o, size: LS_QUICK_N } : o);
  }
  if (typeof CORE_NAMES !== "undefined" && !CORE_NAMES && typeof loadCoreNames === "function") return void loadCoreNames().then(() => prQuick(o));
  const p = prState(), last = p.quick || {};
  const backTo = o.back || (typeof ROUTE_NOW !== "undefined" ? ROUTE_NOW : "");
  const seed = prSeed(o.seed), app = seed && seed.c && seed.c.unit ? seed.c : null;
  const st = { source: o.source || (o.items && o.items.length ? "these" : seed ? (last.seedSource || "alike") : (last.source || "first")),
    size: o.size != null ? o.size : last.size != null ? last.size : 10, method: o.method || last.method || "cards" };
  if (st.method === "lesson" && !app) st.method = "cards";
  const methods = [...(app && typeof hmLearnIt === "function" ? [["lesson", "Learn it"]] : []), ...Object.keys(PR_METHODS).map(m => [m, PR_METHODS[m].t])];
  const { sh, close } = sheet(`<div class="pr-quick">
    <div class="pr-qhead"><h2 class="pr-t2" data-qtitle></h2><span class="pr-note" data-qcount></span></div>
    <div data-qplate></div>
    <div class="pr-note pr-qsec">From</div><div class="pr-rail" data-qrow="source"></div>
    <div class="pr-note pr-qsec">How many</div><div class="pr-seg" data-qrow="size">${PR_SIZES.map(([n, t]) => `<button class="pr-chip" data-size="${n}">${t}</button>`).join("")}</div>
    <div class="pr-note pr-qsec">How</div><div class="pr-rail" data-qrow="method">${methods.map(([m, t]) => `<button class="pr-chip" data-method="${m}">${t}</button>`).join("")}</div>
    <div class="pr-qgo" data-qgo></div></div>`);
  sh.classList.add("pr-qsheet");
  let deck = null;
  const paint = () => {
    deck = prInstantDeck({ seed, items: o.items, label: o.label, source: st.source, size: st.size });
    st.source = deck.source;
    const srcs = Object.keys(PR_SOURCES).filter(k => deck.counts[k] && (k !== "these" || (o.items && o.items.length)));
    sh.querySelector('[data-qrow="source"]').innerHTML = srcs.map(k => `<button class="pr-chip${k === st.source ? " on" : ""}" data-source="${k}">${k === "these" && o.label ? esc(o.label) : PR_SOURCES[k]}${["mixups", "due", "tricky", "star"].includes(k) ? ` <span class="pr-code">${deck.counts[k]}</span>` : ""}</button>`).join("");
    sh.querySelectorAll("[data-size]").forEach(b => b.classList.toggle("on", +b.dataset.size === +st.size));
    sh.querySelectorAll("[data-method]").forEach(b => b.classList.toggle("on", b.dataset.method === st.method));
    const title = seed && st.source !== "these" ? `Learn <em>${esc(prName(seed))}</em>` : `Learn <em>${esc(st.source === "these" ? "these colors" : PR_SOURCES[st.source].toLowerCase())}</em>`;
    sh.querySelector("[data-qtitle]").innerHTML = title;
    sh.querySelector("[data-qcount]").innerHTML = st.method === "lesson" ? "about 2 minutes" : `<span class="pr-code">${deck.items.length}</span> ${deck.items.length === 1 ? "color" : "colors"}`;
    sh.querySelector("[data-qplate]").innerHTML = prPlate(st.method === "lesson" ? [seed] : deck.items, "pr-plate-quick");
    const mt = st.method === "lesson" ? "Learn it" : PR_METHODS[st.method].t;
    sh.querySelector("[data-qgo]").innerHTML = prPrimary("Start", esc(mt), `data-go${deck.items.length ? "" : " disabled"}`);
    sh.querySelector("[data-go]").onclick = start;
  };
  const remember = () => { p.quick = { ...p.quick, size: st.size, method: st.method, ...(seed && !o.items ? { seedSource: st.source } : { source: st.source }) }; save(); };
  function start() {
    if (!deck || !deck.items.length) return;
    remember(); close(); buzz(8);
    if (st.method === "lesson") return hmLearnIt(app, { lesson: true });
    const exit = () => { if (typeof backTo === "function") backTo(); else if (backTo && /^#\/./.test(backTo)) { if (!openRoute(backTo)) go(S.tab || "learn"); } else prHome(); };
    prPlay(st.method, { items: deck.items, label: deck.label, exit, other: () => { exit(); setTimeout(() => prQuick({ ...o, back: backTo }), 60); } });
  }
  sh.addEventListener("click", e => {
    const b = e.target.closest(".pr-chip"); if (!b) return;
    if (b.dataset.source) st.source = b.dataset.source;
    if (b.dataset.size != null) st.size = +b.dataset.size;
    if (b.dataset.method) st.method = b.dataset.method;
    buzz(4); paint(); remember();
  });
  paint();
  requestAnimationFrame(() => sh.querySelectorAll(".pr-rail").forEach(r => { const on = r.querySelector(".on"); if (on && on.offsetLeft + on.offsetWidth > r.clientWidth - 8) r.scrollLeft = Math.max(0, on.offsetLeft - 24); }));
  return { sh, close, start };
}
const prLearnSet = (hexes, label) => prQuick({ items: hexes, label });
// "Learn these colors" under a painting's or a palette's colors: reads the swatches inside `scope` at tap time,
// so a palette whose size changed (3/6/12/20) gives the colors you're looking at.
const prLearnBtn = (scope, label = "") => `<button class="pr-learn-these" data-pr-scope="${esc(scope)}" data-pr-label="${esc(label)}">Learn these colors ${PR_ICON.chev}</button>`;
if (typeof document !== "undefined") document.addEventListener("click", e => {
  const b = e.target.closest && e.target.closest("[data-pr-scope]"); if (!b) return;
  const scr = b.closest(".screen") || document, box = scr.querySelector(b.dataset.prScope);
  const hexes = box ? [...new Set([...box.querySelectorAll("[data-swatch]")].map(x => x.dataset.swatch))] : [];
  if (hexes.length) prLearnSet(hexes, b.dataset.prLabel ? `${b.dataset.prLabel}'s colors` : "These colors");
});

// ======================================================================
// The entry point on the Learn home (js/learn.js home()): one quiet row. Wired here, so moving it is one line.
// ======================================================================
function prEntry() {
  const cols = (prState().last && prSource(prSpec()).slice(0, 7).map(it => it.h)) || ["#008080", "#E2725B", "#CC7722", "#6B8E23", "#6082B6", "#8E4585", "#C2B280"];
  return `<button class="pr-entry" data-pr-open><span class="pr-entry-art">${cols.map(h => `<i style="--c:${h}"></i>`).join("")}</span>
    <span class="pr-entry-t"><b>Practice</b><span>Make your own deck</span></span>${PR_ICON.chev}</button>`;
}
if (typeof document !== "undefined") document.addEventListener("click", e => { const b = e.target.closest && e.target.closest("[data-pr-open]"); if (b) prHome(); });
// #/practice and #/practice/<method> (router.js)
function prOpenRoute(id) { if (id && PR_METHODS[id]) prPlay(id); else prHome(); }

// ---------- screenshot hook: index.html#prshot=<method>[:<state>] for design review (headless Chrome). Sample progress; a throwaway profile. ----------
let PR_SHOT_ON = false;
function prShot(arg) {
  PR_SHOT_ON = true;
  // sample progress only: never write it over real progress on this device
  try { const set = localStorage.setItem.bind(localStorage); localStorage.setItem = (k, v) => { if (k !== KEY) set(k, v); }; } catch (e) {}
  document.documentElement.classList.add("pr-shot");
  const t = today(), [what, st] = String(arg).split(":");
  S = Object.assign(fresh(), { placed: { tier: 2, at: t }, done: { "t2-blues": t }, profileAsked: true });
  ALL.slice(0, 14).forEach((c, i) => { S.cards[c.id] = { b: i % 3, due: i < 6 ? t : addDays(t, 3), since: addDays(t, -5), own: i < 9, ownBy: i < 9 ? "pick" : undefined }; });
  S.practice = { last: { src: "first", n: 50, fam: "all", order: "shuffle", dir: "f", round: 0, method: what === "home" ? "cards" : what }, tricky: {}, star: [], best: {}, speak: true };
  ["teal", "mauve", "taupe", "periwinkle", "ochre"].forEach(k => { const it = prByKey(k); if (it) S.practice.tricky[k] = { n: it.n, h: it.h, m: 2, r: 0 }; });
  const grab = () => document.querySelector(".pr-stage") || document.querySelector(".pr-step");
  const box = () => document.querySelector(".pr-stage");
  const fakeRes = sess => {   // a finished session with a few misses, for the results screen
    sess.items.slice(0, 12).forEach((it, i) => {
      const nb = prNear(it, 1)[0] || it, kind = { cards: "card", type: "type", say: "say", blitz: "blitz-yes-no", match: "match", pairs: "pairs", rain: "rain", odd: "odd-one-out", test: "quiz-name", learn: "quiz-name", quiz: "quiz-name" }[sess.method];
      const ok = i % 4 !== 1;
      const answer = ok ? null : kind === "card" ? { kind: "self" } : kind === "type" ? { kind: "typed", text: prName(it).slice(0, 3) + "e" } : kind === "say" ? { kind: "heard", text: prName(nb).toLowerCase() } : kind === "blitz-yes-no" ? { kind: "claim", n: prName(nb), h: nb.h, yes: true } : kind === "rain" && i === 5 ? { kind: "landed" } : { kind: "pick", n: prName(nb), h: nb.h };
      sess.first.set(it.key, { it, ok, answer, kind });
    });
    sess.score = { blitz: { pts: 31, n: 24, right: 20, best: 9 }, match: { ms: 48300, pen: 2, lower: true }, pairs: { ms: 71200, flips: 14, lower: true }, rain: { caught: 9, lives: 0 } }[sess.method];
    sess.t0 = performance.now() - 134000;
    prResults(sess);
  };
  if (what === "quick") {   // the instant-deck sheet, opened from a color page, a name page, Home or a painting
    const tap = (sel, ms = 900) => { let n = 0; const t = () => { const b = document.querySelector(sel); if (b) return setTimeout(() => { b.scrollIntoView({ block: "center" }); b.click(); }, 500); if (++n < 60) setTimeout(t, 200); }; setTimeout(t, ms); };
    if (st === "home" || st === "homebtn") { hmHome(); if (st === "home") { tap("#hmDo", 1500); tap("[data-pr-study]", 2400); } return; }
    if (st === "name") { openRoute("#/name/harbor-blue"); return tap("[data-learnit]", 1500); }
    if (st === "painting") { openRoute("#/painting/starry-night"); return tap("[data-pr-scope]"); }
    openRoute("#/color/teal");
    if (st !== "page") tap("[data-learnit]", 1500);
    return;
  }
  if (what === "entry") { home(); setTimeout(() => { const e = document.querySelector(".pr-entry"); if (e) e.scrollIntoView({ block: "center" }); }, 400); return; }
  if (what === "home") { const el = prHome({ more: st === "more" }); if (st === "more" || st === "scroll") setTimeout(() => { const t = document.querySelector(st === "scroll" ? "[data-row=round]" : "[data-tiles]"); if (t) t.scrollIntoView({ block: "start" }); }, 400); return el; }
  if (st === "results") { const spec = prSpec(), deck = prDeck(spec); return fakeRes(prSession(what, spec, deck.slice(0, 12), { deckAll: deck })); }
  if (what === "say") {
    if (st === "intro") { const spec = prSpec(); return prSayIntro(prSession("say", spec, prDeck(spec))); }
    const fake = { dead: false, worked: true, listen() {}, stop() {} };
    const spec = prSpec(), deck = prDeck({ ...spec, order: "order" }), teal = prByKey("teal");
    const sess = prSession("say", spec, prUnique([teal, ...deck.slice(15, 29)]), { deckAll: deck, ear: fake, started: true });
    PR_RUN.say(sess);
    setTimeout(() => {
      const s = box() && box()._prSay; if (!s) return;
      if (st === "right") s.onAlts(["teal"]);
      if (st === "wrong") s.onAlts(["olive green", "olive"]);
      if (st === "neighbor") s.onAlts(["turquoise"]);
      if (st === "close") s.onAlts(["teak"]);
      if (st === "idk") s.onAlts(["I.D.K."]);
      if (st === "paused") s.pause();
      if (st === "fallback") s.onState("denied");
    }, 120);
    return;
  }
  prPlay(what);
  setTimeout(() => {
    const b = box(); if (!b) return;
    if (what === "cards" && st === "revealed" && b._prReveal) b._prReveal();
    if ((what === "quiz" || what === "learn" || what === "odd") && (st === "right" || st === "wrong") && b._prChoose) {
      const opts = [...b.querySelectorAll(".pr-opt, .pr-cell")];
      if (what === "odd") { const i = b._prOpts.findIndex(o => o.same === (st === "wrong")); return b._prChoose(i); }
      // the right option is the one whose name equals the swatch's own name
      const sw = b.querySelector(".pr-sw"), hex = sw && sw.style.getPropertyValue("--c").trim().toUpperCase();
      const i = opts.findIndex(o => (prName(prItemOf(hex)) === o.textContent.trim()) === (st === "right"));
      b._prChoose(i < 0 ? 0 : i);
    }
    if (what === "type" && st) { const it = prItemOf(b.querySelector(".pr-sw").style.getPropertyValue("--c").trim()); if (st === "hint") { b.querySelector("[data-hint]").click(); b.querySelector("[data-hint]").click(); } else b._prType(st === "right" ? prName(it) : st === "typo" ? prName(it).slice(0, -1) + "x" + (prName(it).length > 9 ? "" : "") : "banana"); }
    if (what === "pairs" && st === "mid" && b._prFlip) { const tl = b._prTiles, a = tl.findIndex(t => t.sw), c = tl.findIndex(t => !t.sw && t.i === tl[a].i); b._prFlip(a); b._prFlip(c); const d = tl.findIndex((t, k) => k !== a && t.sw); b._prFlip(d); }
    if (what === "match" && st === "mid") { const tiles = [...b.querySelectorAll(".pr-tile")]; if (tiles[0]) tiles[0].click(); }
    if (what === "blitz" && st === "wrong" && b._prClaim) { const y = b.querySelector(b._prClaim.truth ? "[data-no]" : "[data-yes]"); if (y) y.click(); }
  }, 150);
}
if (typeof location !== "undefined" && /^#prshot=/.test(location.hash)) {
  const arg = decodeURIComponent(location.hash.slice(8));
  addEventListener("load", () => loadCoreNames().then(() => setTimeout(() => prShot(arg), 50)));
}
