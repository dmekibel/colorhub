"use strict";
// Production cards for the spaced review: "Say it" (a color fills the card, you type its name) and "Make it"
// (a name appears, you build the color on the picker). Producing an answer from memory beats recognizing it
// (learning-kb §1 #1, §2 N6: production beats recognition; vary the phrasing across repeats).
// The swipe deck stays the default and the first exposure. These cards only appear in REVIEW sessions, for names
// already recalled at least once, a day or more after learning. Never two in a row. Menu > Quick mode turns them off.

// ---------- tunables ----------
const PROD_RATE = { say: 1 / 3, make: 1 / 6 };   // share of eligible review cards that become Say it / Make it
const MAKE_OK = 10, MAKE_CLOSE = 18;              // CIEDE2000: right at or under 10, close at or under 18
const SAY_NEAR = 18;                              // a typed name this close (or linked by "vs") is "close", not wrong

// ======================================================================
// The name matcher. Pure functions (no DOM), unit-tested by tools/produce_test.js.
// ======================================================================
const SAY_ALIAS = { eggplant: "aubergine" };
// spoken fillers ("it's teal", "um, the teal color")
const SAY_FILLER = /^(?:(?:it'?s|its|that'?s|thats|this is|the|a|an|um+|uh+|er+|erm)[\s,]+)+/;
function sayNorm(s) {
  let t = String(s == null ? "" : s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[\u2019`]/g, "'").trim();
  t = t.replace(SAY_FILLER, "").replace(/[\s,]+colou?r\.?$/, "").replace(/&/g, "and").replace(/gray/g, "grey").replace(/ocher/g, "ochre");
  t = t.replace(/[^a-z]/g, "");
  return SAY_ALIAS[t] || t;
}
// Edit distance with adjacent swaps counting as one edit (optimal string alignment)
function sayDist(a, b) {
  const m = a.length, n = b.length;
  if (Math.abs(m - n) > 3) return 9;
  const d = Array.from({ length: m + 1 }, (_, i) => { const r = new Array(n + 1).fill(0); r[0] = i; return r; });
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
    const cost = a[i - 1] === b[j - 1] ? 0 : 1;
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
  }
  return d[m][n];
}
// Typos allowed: none under 5 letters, one from 5, two from 10 ("teracota")
const sayTol = t => t.length >= 10 ? 2 : t.length >= 5 ? 1 : 0;
// "Kelly" for Kelly green, "Royal" for Royal blue: the distinctive word alone, when the rest is a basic word
function sayHead(n) {
  const m = n.toLowerCase().match(/^(.+?)\s+(green|blue|orange|pink)$/);
  if (!m || m[1] === "burnt") return null;
  const h = sayNorm(m[1]);
  return h.length >= 5 ? h : null;
}
function sayNear(c, x) {
  const lo = s => String(s || "").toLowerCase();
  return lo(c.vs) === lo(x.n) || lo(x.vs) === lo(c.n) || de2000(c.h, x.h) <= SAY_NEAR;
}
// -> { r: "empty" | "right" | "close" | "wrong", typo?, nb? (the near neighbor typed), said? (another color typed) }
function sayJudge(input, c, pool) {
  const t = sayNorm(input);
  if (!t) return { r: "empty" };
  const me = sayNorm(c.n);
  if (t === me || t === sayHead(c.n)) return { r: "right", typo: false };
  const others = pool.filter(x => x.n !== c.n);
  const exact = others.find(x => sayNorm(x.n) === t || t === sayHead(x.n));
  if (exact) return sayNear(c, exact) ? { r: "close", nb: exact } : { r: "wrong", said: exact };
  // a typo counts when it sits at least as close to this name as to any other name
  const d = sayDist(t, me);
  let best = null, bd = 9;
  others.forEach(x => { const dx = sayDist(t, sayNorm(x.n)); if (dx < bd) { bd = dx; best = x; } });
  if (d <= sayTol(me) && d <= bd) return { r: "right", typo: true };
  if (best && bd <= sayTol(sayNorm(best.n))) return sayNear(c, best) ? { r: "close", nb: best } : { r: "wrong", said: best };
  return { r: "wrong" };
}

// ---------- how one color differs from another, in plain words ----------
// Same hue landmarks as tools/check.js uses for the "than <neighbor>" lines.
const HUE_MARKS = [[0, "pink"], [30, "red"], [55, "orange"], [95, "yellow"], [140, "green"], [285, "blue"], [310, "violet"]];
const MORE = { light: "lighter", dark: "darker", vivid: "more vivid", grey: "greyer", pink: "pinker", red: "redder", orange: "more orange",
  yellow: "yellower", green: "greener", blue: "bluer", violet: "more violet" };
const hueGap = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
// How color a differs from color b, biggest difference first: [{ w: "light" | "dark" | "vivid" | "grey" | hue word, m: size }]
function colorDiff(a, b) {
  const [L1, C1, H1] = lch(a), [L2, C2, H2] = lch(b), out = [];
  const dL = L1 - L2, dC = C1 - C2;
  if (Math.abs(dL) >= 3) out.push({ w: dL > 0 ? "light" : "dark", m: Math.abs(dL) });
  if (C2 < 8 && C1 >= 8) {
    // a neutral target: the extra strength reads as a tint ("too blue")
    const [, w] = HUE_MARKS.slice().sort((p, q) => hueGap(H1, p[0]) - hueGap(H1, q[0]))[0];
    out.push({ w, m: dC });
  } else {
    if (Math.abs(dC) >= 4) out.push({ w: dC > 0 ? "vivid" : "grey", m: Math.abs(dC) * .8 });
    const dh = Math.abs(((H1 - H2 + 540) % 360) - 180), dH = 2 * Math.sqrt(C1 * C2) * Math.sin(dh * Math.PI / 360);
    if (dH >= 3) {
      const toward = HUE_MARKS.filter(([h]) => hueGap(H1, h) < hueGap(H2, h)).sort((p, q) => hueGap(H1, p[0]) - hueGap(H1, q[0]))[0];
      if (toward) out.push({ w: toward[1], m: dH });
    }
  }
  return out.sort((p, q) => q.m - p.m);
}
// "a little too light and too green" (yours against the real one)
function makeRead(user, target) {
  const p = colorDiff(user, target).slice(0, 2);
  if (!p.length) return "Yours is spot on.";
  const q = m => m < 7 ? "a little " : m > 20 ? "much " : "";
  const a = q(p[0].m) + "too " + p[0].w, b = p[1] ? " and " + (q(p[1].m) === q(p[0].m) ? "" : q(p[1].m)) + "too " + p[1].w : "";
  return `Yours is ${a}${b}.`;
}
// "Teal is darker and greener than turquoise." (measured, for neighbors without a written line)
function compareLine(c, nb) {
  const p = colorDiff(c.h, nb.h).slice(0, 2);
  if (!p.length) return `${c.n} and ${nb.n.toLowerCase()} are almost the same color.`;
  return `${c.n} is ${MORE[p[0].w]}${p[1] ? " and " + MORE[p[1].w] : ""} than ${nb.n.toLowerCase()}.`;
}

// ======================================================================
// Mixing into a review queue
// ======================================================================
// Say it for names at box 1 and up, Make it from box 2, only for names learned a day or more ago, never two in a row.
// force (screenshots): the first card becomes that kind.
function prodMix(queue, force) {
  if (S.quick && !force) return queue;
  const t = today();
  let prev = false;
  return queue.map((it, i) => {
    const st = S.cards[it.c.id] || { b: 0 }, old = !st.since || st.since < t;
    let kind = null;
    if (force && i === 0) kind = force;
    else if (!prev && old && !force) {
      const r = Math.random();
      if (st.b >= 2 && r < PROD_RATE.make) kind = "make";
      else if (st.b >= 1 && r < (st.b >= 2 ? PROD_RATE.make : 0) + PROD_RATE.say) kind = "say";
    }
    prev = !!kind;
    return kind ? { ...it, kind } : it;
  });
}

// ======================================================================
// The cards
// ======================================================================
let PROD_POOL = null, PROD_PICKER = null;
const prodPool = () => PROD_POOL || (PROD_POOL = [...BASICS, ...ALL]);
const speechCtor = () => typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition) || null;
const ICON_MIC = sv('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>', 22, 1.8);
const shotMode = () => typeof SHOT !== "undefined" && !!SHOT;

// The card as it waits behind the current one. A Make it card shows only paper: its color is the answer.
function prodCardEl(it, isNext, key) {
  const d = document.createElement("div");
  d.className = "card prod " + it.kind + (isNext ? " next" : "");
  d.dataset.key = key;
  if (it.kind === "say") { d.style.setProperty("--c", it.c.h); d.innerHTML = `<div class="fill"></div>`; }
  return d;
}

const PROD_INTRO = {
  say: { t: "Say it", lines: ["A color fills the card. Type its name and press Enter.", "Small typos count. A neighbor's name doesn't, but you'll see how the two differ.",
    "Producing a name from memory makes it stick better than just recognizing it."] },
  make: { t: "Make it", lines: ["A name appears. Build its color on the wheel.", "Press Done to see yours beside the real one.",
    "Within 10 counts as right, on a scale where 1 is about the smallest difference most people can see."] },
};

// Mount a production card as the current card. o.done(ok) hands the result back to the deck.
// Returns { key(e) } for the deck's keyboard handler.
function prodMount(card, it, foot, o) {
  S.prodSeen = S.prodSeen || {};
  const api = { key: () => {} };
  const run = () => { const a = it.kind === "say" ? sayCard(card, it.c, foot, o) : makeCard(card, it.c, foot, o); api.key = a.key; };
  if (S.prodSeen[it.kind]) run();
  else {
    prodIntro(card, it.kind, foot, () => { S.prodSeen[it.kind] = today(); save(); buzz(8); run(); });
    api.key = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); const b = foot.querySelector("[data-try]"); if (b) b.click(); } };
  }
  return { key: e => api.key(e) };
}

function prodIntro(card, kind, foot, go) {
  // the example is a basic color, so it never gives away the card that follows
  const x = PROD_INTRO[kind], ex = BYNAME.get("blue"), [L, C, H] = lch(ex.h);
  card.className = "card prod intro " + kind;
  card.style.setProperty("--c", ex.h);
  card.innerHTML = `<div class="intro-in">
      <div class="intro-art" aria-hidden="true">${kind === "say"
        ? `<div class="ia-say"><i></i><span>${esc(ex.n.slice(0, 2))}<b></b></span></div>`
        : `<div class="ia-make"><i style="--c:${lchHex(L + 6, C * .85, H - 8)}"><em>Yours</em></i><i><em>${esc(ex.n)}</em></i></div>`}</div>
      <span class="eyebrow">New in reviews</span>
      <h2>${x.t}</h2>
      <ol>${x.lines.map(l => `<li>${esc(l)}</li>`).join("")}</ol>
    </div>`;
  foot.className = "deck-foot";
  foot.innerHTML = `<button class="check-btn" data-try>Try it ${ICON.arrow}</button>`;
  foot.querySelector("[data-try]").onclick = go;
}

// The paper label that slides up with the answer. vs: the neighbor to show beside it, line: how they differ.
function prodLabel(c, verdict, cls, vs, line, meta) {
  return `<div class="label">
    <div class="meta"><span>${esc(meta || c.unit.title)}</span><span>${c.h}</span></div>
    <p class="verdict ${cls}">${verdict}</p>
    <h2>${esc(c.n)}</h2>
    ${line ? `<div class="vs">${vs ? `<span class="pair"><i style="--c:${c.h}"></i><i style="--c:${vs.h}"></i></span>` : ""}<p>${esc(line)}</p></div>` : ""}
  </div>`;
}
const prodShow = card => { void card.offsetWidth; requestAnimationFrame(() => card.classList.add("revealed")); };
function prodNext(foot, ok, o) {
  let gone = false;
  const next = () => { if (gone) return; gone = true; o.done(ok); };
  foot.className = "deck-foot";
  foot.innerHTML = `<button class="check-btn" data-next>Next ${ICON.arrow}</button>`;
  foot.querySelector("[data-next]").onclick = next;
  return next;
}

// ---------- the keyboard must never cover the field (iPhone) ----------
// While the keyboard is up, the deck screen shrinks to the visible area, so the field sits right above the keys.
function kbFit(scr) {
  const vv = typeof visualViewport !== "undefined" ? visualViewport : null;
  if (!vv || !scr) return () => {};
  const fit = () => {
    const kb = innerHeight - vv.height > 90;
    scr.classList.toggle("kb", kb);
    scr.style.height = kb ? vv.height + "px" : "";
    scr.style.marginTop = kb && vv.offsetTop ? vv.offsetTop + "px" : "";
    if (kb && scrollY) scrollTo(0, 0);
  };
  vv.addEventListener("resize", fit); vv.addEventListener("scroll", fit);
  const off = () => { vv.removeEventListener("resize", fit); vv.removeEventListener("scroll", fit); scr.classList.remove("kb"); scr.style.height = scr.style.marginTop = ""; };
  cleanup.push(off);
  return off;
}

// ---------- Say it ----------
function sayCard(card, c, foot, o) {
  card.className = "card prod say";
  card.style.setProperty("--c", c.h);
  card.innerHTML = `<div class="fill"></div><span class="p-tag">Say it</span>`;
  const SR = speechCtor();
  foot.className = "deck-foot prod-foot say";
  foot.innerHTML = `
    <form class="say-form" autocomplete="off">
      <input class="say-in" data-say type="text" enterkeyhint="done" autocapitalize="off" autocorrect="off" autocomplete="off" spellcheck="false" placeholder="Name this color" aria-label="Color name">
      ${SR ? `<button class="say-mic" type="button" data-mic aria-label="Say it out loud">${ICON_MIC}</button>` : ""}
      <button class="say-go" type="submit" aria-label="Check">${ICON.arrow}</button>
    </form>
    <div class="say-sub"><button type="button" class="say-give" data-give>Show me</button><span class="say-hint">Enter to check</span></div>`;
  const form = foot.querySelector("form"), inp = foot.querySelector("[data-say]"), unfit = kbFit(o.el);
  let done = false, next = null, rec = null;
  card.onclick = () => { if (!done) inp.focus(); };
  if (matchMedia("(pointer: fine)").matches) setTimeout(() => { if (!done) inp.focus({ preventScroll: true }); }, 60);

  function resolve(j, said) {
    if (done) return; done = true;
    if (rec) try { rec.abort(); } catch (e) {}
    inp.blur(); unfit();
    const ok = j.r === "right", nb0 = neighbor(c);
    let verdict, cls, vs = nb0, line = c.d;
    if (ok) { verdict = `${ICON.checkS} Right${j.typo ? " · check the spelling" : ""}`; cls = "ok"; }
    else if (j.r === "close") {
      verdict = `Close: that's ${esc(j.nb.n)}, this is ${esc(c.n)}`; cls = "close"; vs = j.nb;
      line = nb0 && nb0.n === j.nb.n ? c.d : j.nb.vs && j.nb.vs.toLowerCase() === c.n.toLowerCase() && j.nb.d ? j.nb.d : compareLine(c, j.nb);
    }
    else if (j.r === "gave") { verdict = "Here it is"; cls = "miss"; }
    else { verdict = `${ICON.xS} Not quite${said ? ` · you typed “${esc(said.trim().slice(0, 28))}”` : ""}`; cls = "miss"; }
    card.insertAdjacentHTML("beforeend", prodLabel(c, verdict, cls, vs, line));
    card.classList.add(ok ? "is-right" : "is-miss");
    prodShow(card);
    buzz(ok ? 12 : [10, 40, 10]);
    next = prodNext(foot, ok, o);
    card.onclick = () => next();
    if (ok && !j.typo && !shotMode()) later(next, 1400);   // a clean right answer moves on by itself
  }
  form.onsubmit = e => {
    e.preventDefault();
    const v = inp.value, j = sayJudge(v, c, prodPool());
    if (j.r === "empty") { form.classList.remove("shake"); void form.offsetWidth; form.classList.add("shake"); inp.focus(); return; }
    resolve(j, v);
  };
  foot.querySelector("[data-give]").onclick = () => resolve({ r: "gave" }, "");
  // voice: pick the best of the recognizer's guesses
  const mic = foot.querySelector("[data-mic]");
  if (mic) mic.onclick = () => {
    if (done) return;
    if (rec) { try { rec.stop(); } catch (e) {} return; }
    try {
      rec = new SR(); rec.lang = "en-US"; rec.interimResults = false; rec.maxAlternatives = 5;
      rec.onresult = ev => {
        const alts = [...ev.results[0]].map(a => a.transcript), rank = { right: 3, close: 2, wrong: 1, empty: 0 };
        const best = alts.map(a => ({ a, j: sayJudge(a, c, prodPool()) })).sort((p, q) => rank[q.j.r] - rank[p.j.r])[0];
        if (best && best.j.r !== "empty") { inp.value = best.a; resolve(best.j, best.a); }
      };
      rec.onerror = ev => { if (ev.error !== "aborted") toast(ev.error === "not-allowed" ? "Microphone is off" : "Didn't catch that"); };
      rec.onend = () => { rec = null; mic.classList.remove("on"); };
      rec.start(); mic.classList.add("on"); buzz(6);
      cleanup.push(() => { if (rec) try { rec.abort(); } catch (e) {} });
    } catch (e) { rec = null; mic.remove(); }
  };
  return {
    key: e => {
      if (e.target && e.target.tagName === "INPUT") return;
      if (done) { if (["Enter", " ", "ArrowRight"].includes(e.key)) { e.preventDefault(); next(); } return; }
      if (e.key.length === 1 && !e.altKey) inp.focus();   // start typing anywhere
    },
  };
}

// ---------- Make it ----------
// Start from a wrong but same-family color (a hue, lightness and strength offset), never already within "close".
function makeStart(c) {
  const [L, C, H] = lch(c.h), sg = () => Math.random() < .5 ? -1 : 1;
  let best = null, bd = 0;
  for (let i = 0; i < 120; i++) {
    const k = 1 + i / 60;   // widen the offsets if nothing fits (very dark or very light targets)
    const L2 = clamp(L + sg() * (8 + Math.random() * 14) * k, 8, 95), C2 = C < 10 ? (10 + Math.random() * 16) * k : C * (.45 + Math.random() * .4);
    const H2 = (H + sg() * (18 + Math.random() * 32) + 360) % 360, a = C2 * Math.cos(H2 * Math.PI / 180), b = C2 * Math.sin(H2 * Math.PI / 180);
    if (!inGamut(L2, a, b)) continue;
    const hx = labHex(L2, a, b), d = de2000(hx, c.h);
    if (d >= MAKE_CLOSE + 4 && d <= 40) return hx;
    if (d > bd) { bd = d; best = hx; }
  }
  return best && bd > MAKE_CLOSE + 2 ? best : lchHex(L > 50 ? L - 35 : L + 35, 0, 0);
}
function makeCard(card, c, foot, o) {
  const start = makeStart(c);
  card.className = "card prod make";
  card.style.setProperty("--c", start);
  card.innerHTML = `<div class="fill"></div><div class="mk-q"><span class="eyebrow">Make it</span><b>${esc(c.n)}</b></div>`;
  foot.className = "deck-foot prod-foot make";
  foot.innerHTML = `<div class="mk-pick" data-pick></div>
    <div class="mk-side"><p>Ring for hue. Square for light and strength.</p><button class="mk-done" data-done>Done ${ICON.arrow}</button></div>`;
  PROD_PICKER = colorPicker(foot.querySelector("[data-pick]"), { hex: start, onChange: hx => card.style.setProperty("--c", hx) });
  let done = false, next = null;
  function finish() {
    if (done) return; done = true;
    const user = PROD_PICKER.get(), d = de2000(user, c.h), res = d <= MAKE_OK ? "right" : d <= MAKE_CLOSE ? "close" : "wrong", ok = res === "right";
    const verdict = ok ? `${ICON.checkS} Right` : res === "close" ? "Close" : `${ICON.xS} Not quite`;
    card.innerHTML = `<div class="mk-split"><div style="--c:${user}"><span class="p-tag">Yours</span></div><div style="--c:${c.h}"><span class="p-tag">${esc(c.n)}</span></div></div>
      ${prodLabel(c, verdict, ok ? "ok" : res === "close" ? "close" : "miss", null, makeRead(user, c.h), `ΔE ${d.toFixed(1)} apart`)}`;
    card.classList.add(ok ? "is-right" : "is-miss");
    prodShow(card);
    buzz(ok ? 12 : [10, 40, 10]);
    next = prodNext(foot, ok, o);
    card.onclick = () => next();
  }
  foot.querySelector("[data-done]").onclick = finish;
  return {
    key: e => {
      if (e.target && e.target.tagName === "INPUT") return;
      if (["Enter", " "].includes(e.key) || (done && e.key === "ArrowRight")) { e.preventDefault(); done ? next() : finish(); }
    },
  };
}

// ---------- screenshot hooks (index.html#shot=say:right, make:result, intro:say ...), used by boot.js ----------
function prodShot(kind, state) {
  const t = today(), c = ALL.find(x => x.n === "Teal") || ALL[0];
  const real = kind === "intro" ? (state || "say") : kind;
  S.prodSeen = kind === "intro" ? {} : { say: t, make: t };
  ALL.filter(x => x !== c).slice(0, 7).forEach(x => { S.cards[x.id] = { b: 0, due: t, since: addDays(t, -4), own: false }; });
  S.cards[c.id] = { b: 2, due: addDays(t, -2), since: addDays(t, -10), own: true };
  document.documentElement.classList.add("prod-shot");   // no transitions: the screenshot shows the settled state
  deck("review", { force: real });
  if (kind === "intro") return;
  setTimeout(() => {
    if (kind === "say") {
      const inp = document.querySelector("[data-say]"), give = document.querySelector("[data-give]");
      const v = { typed: "Tea", right: "teal", close: c.vs || "Turquoise", wrong: "Olive", typo: "Turqoise" }[state];
      if (state === "gave") return give.click();
      if (!v || !inp) return;
      inp.value = v;
      if (state !== "typed") inp.form.requestSubmit();
    }
    if (kind === "make" && state === "result" && PROD_PICKER) {
      const [L, C, H] = lch(c.h);
      PROD_PICKER.set(lchHex(L + 7, C * .85, H - 14));
      document.querySelector("[data-done]").click();
    }
  }, 300);
}
