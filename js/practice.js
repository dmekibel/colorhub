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
  match: { t: "Match", d: "Pair six colors with their names, fast." },
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
  const key = e.n.toLowerCase(), c = typeof BYNAME !== "undefined" ? BYNAME.get(key) || null : null;
  return { n: e.n, h: String(e.h).toUpperCase(), key, rank: e.rank == null ? 9999 : e.rank, also: e.also || [], c: c && c.id ? c : null, vs: c && c.vs || "", d: c && c.d || "" };
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
  if (list === "mine") return ALL.filter(c => S.cards[c.id]).map(prOfApp);
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
  if (it.c && it.c.vs && it.c.d && it.c.vs.toLowerCase() === nb.n.toLowerCase()) return it.c.d;
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
  prApply(it, !!res.ok, by, !!res.assist);
  prTrick(it, !!res.ok);
  return true;
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
const PR_ICON = {
  star: sv('<path d="M12 3.6l2.5 5.3 5.8.7-4.3 4 1.1 5.7L12 16.5l-5.1 2.8 1.1-5.7-4.3-4 5.8-.7z"/>', 22, 1.6),
  starOn: sv('<path d="M12 3.6l2.5 5.3 5.8.7-4.3 4 1.1 5.7L12 16.5l-5.1 2.8 1.1-5.7-4.3-4 5.8-.7z" fill="currentColor"/>', 22, 1.6),
  shuffle: sv('<path d="M4 7h3.5c4 0 5 10 9 10H20M4 17h3.5c1.6 0 2.7-1.6 3.6-3.4M14 9.6C14.9 8 15.9 7 17.5 7H20M17.5 4.5 20 7l-2.5 2.5M17.5 14.5 20 17l-2.5 2.5"/>', 22, 1.6),
  mic: sv('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>', 22, 1.6),
  back: sv('<path d="M15 6l-6 6 6 6"/>', 22, 1.8),
  chev: sv('<path d="M9 6l6 6-6 6"/>', 16, 1.8),
  arrow: sv('<path d="M5 12h14M13 6l6 6-6 6"/>', 20, 1.6),
};
const prX = () => sv('<path d="M6 6l12 12M18 6L6 18"/>', 22, 1.8);
const prCheck = () => sv('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 24, 2);
// Names are long ("Purple Mountain Majesty"): a display size that still fits two lines on a 320 px phone
function prFit(name, big = 72) {
  const n = String(name).length, s = n <= 7 ? big : n <= 10 ? big * .84 : n <= 14 ? big * .7 : n <= 18 ? big * .6 : big * .54;
  return `font-size:${Math.round(s)}px`;
}
const prPlate = (items, cls = "") => `<div class="pr-plate ${cls}" aria-hidden="true">${items.slice(0, 160).map(it => `<i style="--c:${it.h}"></i>`).join("")}</div>`;
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
  fb.innerHTML = `<span class="pr-pair"><i style="--c:${it.h}"></i><i style="--c:${pick.h}"></i></span><p>That's ${esc(prName(pick))}. ${esc(prDiff(it, pick))}</p>`;
}
function prNextBtn(foot, go, label = "Next") {
  foot.innerHTML = prPrimary(label, "", "data-next");
  const b = foot.querySelector("[data-next]");
  b.onclick = go;
  return b;
}
PR_STEPS["quiz-name"] = { by: "pick", render(box, it, ctx = {}) {
  return new Promise(resolve => {
    const t0 = performance.now(), opts = prShuffle([it, ...prNear(it, 3, ctx.deck)]);
    box.innerHTML = `<div class="pr-step pr-s-quiz">
      ${ctx.note ? `<p class="pr-stepnote">${esc(ctx.note)}</p>` : ""}
      <div class="pr-sw" style="--c:${it.h}"></div>
      <div class="pr-fb" aria-live="polite"></div>
      <div class="pr-opts">${opts.map((o, i) => `<button class="pr-opt" data-i="${i}"><span>${esc(prName(o))}</span></button>`).join("")}</div>
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
    const t0 = performance.now(), opts = prShuffle([it, ...prNear(it, 3, ctx.deck)]), nm = prName(it);
    box.innerHTML = `<div class="pr-step pr-s-qc">
      ${ctx.note ? `<p class="pr-stepnote">${esc(ctx.note)}</p>` : ""}
      <div class="pr-q"><span class="pr-note">Which one is</span><b class="pr-t1" style="${prFit(nm, 44)}">${esc(nm)}?</b></div>
      <div class="pr-grid4">${opts.map((o, i) => `<button class="pr-cell" data-i="${i}" aria-label="Option ${i + 1}"><i class="pr-swc" style="--c:${o.h}"></i><span class="pr-tag">${esc(prName(o))}</span></button>`).join("")}</div>
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
      if (ok) { foot.innerHTML = `<p class="pr-hint pr-good">Right</p>`; return prAuto(() => resolve(res), 800); }
      prFeedback(fb, it, o);
      prNextBtn(foot, () => resolve(res));
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
      fb.innerHTML = `${v.nb ? `<span class="pr-pair"><i style="--c:${it.h}"></i><i style="--c:${v.nb.h}"></i></span>` : ""}<p><span class="pr-v ${v.cls}">${v.html}</span>${v.nb ? ` ${esc(prDiff(it, v.nb))}` : ""}</p>`;
      buzz(ok ? 12 : [10, 40, 10]);
      if (ok && !j.typo && !j.via) return prAuto(() => resolve(res), 750);
      prNextBtn(foot, () => resolve(res));
      prKeyer(ctx)(e => { if (e.key === "Enter" || e.key === " " || e.key === "ArrowRight") { e.preventDefault(); resolve(res); } });
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
      if (nb) label.insertAdjacentHTML("beforeend", `<div class="pr-vs"><span class="pr-pair"><i style="--c:${it.h}"></i><i style="--c:${nb.h}"></i></span><p>${esc(prDiff(it, nb))}</p></div>`);
      card.classList.add("revealed", ok ? "is-ok" : "is-bad");
      foot.innerHTML = ""; cmds.textContent = "";
      status(ok ? "Right" : "", ok ? "pr-good" : "");
      buzz(ok ? 12 : [10, 40, 10]);
      const speakIt = !ok && ctx.speak !== false ? prSpeak(nm) : Promise.resolve();
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
    const t0 = performance.now(), tiles = prShuffle([...items.map((it, i) => ({ i, sw: true })), ...items.map((it, i) => ({ i, sw: false }))]);
    const cols = tiles.length > 8 ? 3 : 2;
    box.innerHTML = `<div class="pr-step pr-s-match"><div class="pr-board" style="--cols:${cols};--rows:${Math.ceil(tiles.length / cols)}">${tiles.map((t, k) => {
      const it = items[t.i];
      return t.sw ? `<button class="pr-tile sw" data-k="${k}" style="--c:${it.h}" aria-label="A color"></button>`
        : `<button class="pr-tile nm" data-k="${k}"><span>${esc(prName(it))}</span></button>`;
    }).join("")}</div></div>`;
    const missed = new Map();
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
    const t0 = performance.now(), opts = prShuffle([it, ...prNear(it, 2, ctx.deck)]), fall = ctx.fall || 6500;
    box.innerHTML = `<div class="pr-step pr-s-rain">
      <div class="pr-sky"><i class="pr-drop" style="--c:${it.h}"></i><span class="pr-ground"></span></div>
      <div class="pr-opts pr-opts3">${opts.map((o, i) => `<button class="pr-opt" data-i="${i}"><span>${esc(prName(o))}</span></button>`).join("")}</div></div>`;
    const sky = box.querySelector(".pr-sky"), drop = box.querySelector(".pr-drop");
    let done = false, anim = null;
    const finish = (ok, answer, cls) => {
      if (done) return; done = true;
      if (anim) anim.pause();
      box.querySelectorAll(".pr-opt").forEach((b, k) => { b.classList.toggle("ok", opts[k] === it); b.disabled = true; });
      drop.classList.add(cls);
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
      <div class="pr-grid4">${opts.map((o, i) => `<button class="pr-cell" data-i="${i}" aria-label="Option ${i + 1}"><i class="pr-swc" style="--c:${o.h}"></i><span class="pr-tag">${esc(o.same ? nameOf(o.h).text : prName(o.it))}</span></button>`).join("")}</div>
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
      fb.innerHTML = `<span class="pr-pair"><i style="--c:${it.h}"></i><i style="--c:${odd.h}"></i></span><p>${esc(prDiff(odd, it))}</p>`;
      if (ok) return prAuto(() => resolve(res), 1100);
      prNextBtn(foot, () => resolve(res));
    };
    box.querySelectorAll(".pr-cell").forEach(b => b.onclick = () => choose(+b.dataset.i));
    prKeyer(ctx)(e => { if (/^[1-4]$/.test(e.key)) choose(+e.key - 1); });
    box._prChoose = choose; box._prOpts = opts;
  });
} };

// ======================================================================
// The play shell: the lesson archetype on booth grey. ✕ on the left, then one progress bar, then one small readout.
// ======================================================================
function prShell(sess, o = {}) {
  const n = sess.items.length, segs = n <= 30;
  const prog = o.timer ? `<div class="pr-timer"><i></i></div>` : segs ? `<div class="pr-segs">${sess.items.map(it => `<i data-k="${esc(it.key)}" style="--c:${it.h}"></i>`).join("")}</div>`
    : `<div class="pr-bar"><i></i></div>`;
  const el = show(`<header class="pr-top"><button class="pr-x" data-close aria-label="Close">${prX()}</button>${prog}<span class="pr-right">${o.right || ""}</span></header>
    <div class="pr-stage"></div>`, "fixed pr-play pr-booth pr-m-" + sess.method);
  const stage = el.querySelector(".pr-stage"), right = el.querySelector(".pr-right");
  let known = 0;
  el.querySelector("[data-close]").onclick = () => { sess.ended = true; if (sess.first.size || sess.score) prResults(sess, { stopped: true }); else prHome(); };
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
PR_RUN.match = async sess => {
  let pen = 0;
  const sh = prShell(sess, { right: `<span class="pr-code" data-clock>0.0 s</span>` }), clock = sh.right.querySelector("[data-clock]");
  const tick = () => { if (!clock.isConnected) return; clock.textContent = prTime(performance.now() - sess.t0 + pen * 1000); later(tick, 100); };
  tick();
  for (let i = 0; i < sess.items.length && !sess.ended; i += PR_SET) {
    const set = sess.items.slice(i, i + PR_SET);
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
    const res = await PR_STEPS["blitz-yes-no"].render(sh.stage, it, prCtx(sess, sh));
    if (over || !sh.stage.isConnected) return;
    prRecord(sess, it, res, "blitz-yes-no");
    sess.score.n++;
    if (res.ok) { combo++; sess.score.right++; const m = Math.min(4, 1 + Math.floor(combo / 5)); sess.score.pts += m; sess.score.best = Math.max(sess.score.best, combo); }
    else combo = 0;
    const m = Math.min(4, 1 + Math.floor(combo / 5));
    score.textContent = sess.score.pts; mult.textContent = m > 1 ? `×${m}` : "";
  }
};
// Color rain: three lives; it falls a little faster after every catch.
PR_RUN.rain = async sess => {
  const life = n => `<span class="pr-lives"><span class="pr-code">${n}</span> <em>${n === 1 ? "life" : "lives"}</em></span>`;
  const sh = prShell(sess, { right: life(PR_RAIN_LIVES) });
  let lives = PR_RAIN_LIVES, fall = 7000, caught = 0;
  for (let i = 0; i < sess.items.length && lives > 0 && !sess.ended; i++) {
    const it = sess.items[i];
    const res = await PR_STEPS.rain.render(sh.stage, it, prCtx(sess, sh, { fall }));
    if (sess.ended || !sh.stage.isConnected) return;
    prRecord(sess, it, res, "rain");
    sh.seg(it, res.ok ? "on" : "met");
    if (res.ok) { caught++; fall = Math.max(2600, fall * .95); } else { lives--; sh.right.innerHTML = life(lives); }
  }
  sess.score = { caught, lives };
  if (!sess.ended) prResults(sess);
};

// ======================================================================
// Starting a method
// ======================================================================
// opts: { items (play exactly these, e.g. your misses), label, offset }
function prPlay(method, opts = {}) {
  if (!PR_METHODS[method]) method = "cards";
  if (typeof CORE_NAMES !== "undefined" && !CORE_NAMES && typeof loadCoreNames === "function") return void loadCoreNames().then(() => prPlay(method, opts));
  const spec = { ...prSpec(), method };
  if (!opts.items) prSaveSpec(spec);
  const deck = opts.deck || prDeck(spec), offset = opts.offset || 0;
  const items = opts.items || prRound(deck, spec, offset);
  if (!items.length) { toast("No colors in this deck yet"); return prHome(); }
  const sess = prSession(method, spec, items, { deckAll: deck, offset, label: opts.label || "", misses: !!opts.items });
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
  el.querySelector("[data-close]").onclick = () => prHome();
  const sw = el.querySelector("[data-speak]");
  if (sw) sw.onchange = () => { p.speak = sw.checked; save(); buzz(4); };
  const go1 = () => { if (!can) return PR_RUN.type(sess); sess.ear = prEar(); PR_RUN.say(sess); };
  el.querySelector("[data-go]").onclick = go1;
  onKey = e => { if (e.key === "Enter") go1(); if (e.key === "Escape") prHome(); };
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
  line = line.replace(/ · /g, "&ensp;·&ensp;");
  const rows = misses.map(f => {
    const a = f.answer || {}, yours = a.h && (a.kind !== "claim" || a.yes) ? `<i style="--c:${a.h}"></i>` : `<i class="none"></i>`;
    return `<div class="pr-row pr-miss"><span class="pr-pair2"><i style="--c:${f.it.h}"></i>${yours}</span><span class="pr-rowt"><b>${esc(prName(f.it))}</b><small>${prAnswerLine(f)}</small></span></div>`;
  }).join("");
  const el = show(`<header class="pr-top"><button class="pr-x" data-close aria-label="Close">${prX()}</button><span class="pr-grow"></span><span class="pr-note">${esc(M.t)}</span></header>
    ${prPlate(sess.items, "pr-plate-res")}
    <h1 class="pr-t1 pr-res-t">${title}</h1>
    <p class="pr-notep">${line}</p>
    ${misses.length ? `<p class="pr-note pr-sec-n">${misses.length === 1 ? "The one to look at again" : `The ${misses.length} to look at again`}</p><div class="pr-rows">${rows}</div>` : ""}
    <div class="pr-grow"></div>
    <div class="pr-acts">
      ${misses.length ? prPrimary("Practice my misses", String(misses.length), "data-a=misses") : more ? prPrimary(`Next ${Math.min(sess.spec.round, deck.length - nextOff)}`, "", "data-a=next") : prPrimary("Again", "", "data-a=again")}
      ${misses.length && more ? `<button class="pr-text" data-a="next">Go on to the next ${Math.min(sess.spec.round, deck.length - nextOff)}</button>` : ""}
      <button class="pr-text" data-a="other">Same deck, another way</button>
    </div>`, "pr-res pr-booth");
  buzz(misses.length ? 8 : [10, 30, 20]);
  const act = a => {
    if (a === "misses") return prPlay(m, { items: prShuffle(misses.map(f => f.it)), deck, label: "Your misses" });
    if (a === "next") return prPlay(m, { deck, offset: nextOff });
    if (a === "again") return prPlay(m, sess.misses ? { items: prShuffle(sess.items), deck } : { deck: sess.spec.order === "shuffle" ? null : deck, offset: sess.offset || 0 });
    return prHome();
  };
  el.querySelectorAll("[data-a]").forEach(b => b.onclick = () => act(b.dataset.a));
  el.querySelector("[data-close]").onclick = () => prHome();
  onKey = e => { if (e.key === "Enter") act(misses.length ? "misses" : more ? "next" : "again"); if (e.key === "Escape") prHome(); };
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
    blitz: `<i class="a-sw" style="--c:${c(1)}"></i><span class="a-yn"><b>✓</b><b>✕</b></span>`,
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
  add("mine", ALL.filter(c => S.cards[c.id]).length);
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
