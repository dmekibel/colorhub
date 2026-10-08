"use strict";
// Name today's color (#/daily): one color a day, the same for everyone, drawn from all ~1,000 core names
// (data/core-names.json) in a seeded order, so no word repeats for years. You type names, never pick from a list:
// recall before reveal. Every guess paints its own swatch and says which way today's color lies from it, on the
// three axes painters use (Godlove's split): lighter or darker, which way the hue turns (bluer, greener, redder,
// yellower: never "warmer"), stronger or weaker. After three misses a gentle 4-choice fallback appears, so a
// beginner always finishes. It ends on the color itself, named, with its story and one tap to its page.
// The share is spoiler-free: an image of the guesses' real colors closing in (js/sharecard.js) and a text line
// with the number and the count. Never the name, never emoji squares.
// Replaces the old 4-option "Color of the day" (explore.js daily()); its saves ({n, ok}) still count as played.

const DN_MAX = 6, DN_HINT_AFTER = 3, DN_WIN_DE = 1.5;
const DN_SAME = 3, DN_NEAR = 8;          // an axis within 3 is "the same"; within 8 is "a touch"
const DN_GREY_C = 8;                     // both colors this grey: hue has no meaning, so it isn't judged

// ---------- pure (tools/colordle_test.js runs these) ----------
// FNV-1a, for the day's seed (explore.js has its own `hash`; this file keeps its own so it can be tested alone)
const dlHash = s => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
let DN_ORDER = null;
// every core name, in one fixed seeded order (rank first, so the order never depends on how the JSON is sorted)
function dnOrder(list) {
  if (DN_ORDER && DN_ORDER.src === list) return DN_ORDER.o;
  const o = list.slice().sort((a, b) => (a.rank == null ? 1e9 : a.rank) - (b.rank == null ? 1e9 : b.rank) || a.n.localeCompare(b.n));
  const rnd = seededRnd(dlHash("name-today-v1"));
  for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; }
  DN_ORDER = { src: list, o };
  return o;
}
// the day's word: day No. n takes the n-th name of the fixed order (the whole list passes before any repeats)
function dnTarget(k = today(), list = CORE_NAMES) {
  if (!list || !list.length) return null;
  const o = dnOrder(list), n = chNumber(k) - 1;
  return o[((n % o.length) + o.length) % o.length];
}
const dnZone = h => { h = (h + 360) % 360; return h < 55 || h >= 345 ? "redder" : h < 130 ? "yellower" : h < 190 ? "greener" : h < 280 ? "bluer" : "purpler"; };
// Which way today's color (t) lies from a guess (g), per axis. Each axis: { st: same|near|far, word, v }.
function dnAxes(g, t) {
  const [Lg, ag, bg] = lab(g), [Lt, at, bt] = lab(t), Cg = Math.hypot(ag, bg), Ct = Math.hypot(at, bt);
  const dL = Lt - Lg, dC = Ct - Cg;
  let hg = Math.atan2(bg, ag) * 180 / Math.PI, ht = Math.atan2(bt, at) * 180 / Math.PI, dh = ht - hg;
  if (dh > 180) dh -= 360; if (dh < -180) dh += 360;
  const dH = 2 * Math.sqrt(Cg * Ct) * Math.sin(dh * Math.PI / 360);   // the metric hue difference, ΔH*
  const st = v => Math.abs(v) < DN_SAME ? "same" : Math.abs(v) < DN_NEAR ? "near" : "far";
  const L = { st: st(dL), v: dL, word: dL > 0 ? "lighter" : "darker" };
  const C = { st: st(dC), v: dC, word: dC > 0 ? "stronger" : "weaker" };
  let H;
  if (Cg < DN_GREY_C && Ct < DN_GREY_C) H = { st: "grey", v: 0, word: "" };
  else {
    // the way the hue turns, in the app's one hue vocabulary (js/lookalikes.js lookDiff: redder, yellower, greener,
    // bluer, purpler; never "warmer"): the hue zone the guess moves into as it turns toward today's. For a big
    // turn (over 60°) there's no single "way", so it names the zone today's hue sits in.
    const word = Math.abs(dh) > 60 ? dnZone(ht) : dnZone(hg + Math.sign(dh || 1) * Math.min(25, Math.abs(dh) + 5));
    H = { st: st(dH), v: dH, word };
  }
  const de = de2000(g, t);
  return { L, H, C, de, close: Math.max(0, Math.round(100 - 4 * de)) };
}
// One axis in words, for a cell ("a touch darker", "same lightness") or a sentence ("darker")
const DN_AXIS_NAME = { L: "lightness", H: "hue", C: "strength" };
function dnCell(ax, key) {
  if (ax.st === "grey") return "no hue to judge";
  if (ax.st === "same") return `same ${DN_AXIS_NAME[key]}`;
  return (ax.st === "near" ? "a touch " : "") + ax.word;
}
// "Today's color is darker, a touch bluer and weaker than cerulean." (the newest row, said in full)
function dnSentence(a, gName) {
  const parts = ["L", "H", "C"].filter(k => a[k].st === "near" || a[k].st === "far").map(k => dnCell(a[k], k));
  if (!parts.length) return `Today's color is very close to ${gName.toLowerCase()}, but it has its own name.`;
  const list = parts.length === 1 ? parts[0] : parts.slice(0, -1).join(", ") + " and " + parts[parts.length - 1];
  return `Today's color is ${list} than ${gName.toLowerCase()}.`;
}
// a win: the same name (however it's spelled: "Olive-Brown" and "Olive brown" are both in the list), or a
// color so close it's the same color
const dnWin = (g, t) => !!g && !!t && (g.n === t.n || dnNorm(g.n) === dnNorm(t.n) || de2000(g.h, t.h) < DN_WIN_DE);
// The share line: the number and the count only, never the name
function dnShareText(rec, no) {
  const n = rec.g.length, got = rec.ok ? (rec.hint ? `${n}/${DN_MAX}, with 4 choices` : `${n}/${DN_MAX}`) : `X/${DN_MAX}`;
  return `ColorHub · Today's color No. ${no} · ${got}`;
}
// The decoys for the 4-choice fallback: the target's nearest core names (same neighborhood, so three blues, not a
// blue and a yellow), skipping words already guessed, each at least 4 apart from the others so every choice is
// a real choice.
function dnChoices(t, list, guessed = [], rnd = Math.random) {
  const near = nearestCore(t.h, list, 40).filter(x => x.n !== t.n && !guessed.includes(x.n));
  const out = [];
  for (const x of near) { if (out.every(o => de2000(o.h, x.h) >= 4) && de2000(t.h, x.h) >= 4) out.push(x.entry); if (out.length === 3) break; }
  const all = [t, ...out];
  for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
  return all;
}

// ---------- the typed name: core names and their "also called" names ----------
let DN_IDX = null;
const dnNorm = s => String(s).normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
function dnIndex() {
  if (DN_IDX && DN_IDX.src === CORE_NAMES) return DN_IDX.rows;
  const rows = [];
  (CORE_NAMES || []).forEach(e => { rows.push({ k: dnNorm(e.n), label: e.n, e }); (e.also || []).forEach(a => rows.push({ k: dnNorm(a), label: a, e, alias: true })); });
  DN_IDX = { src: CORE_NAMES, rows };
  return rows;
}
// up to 6 suggestions: names starting with what's typed, then names with a word starting with it (one row per color)
function dnSuggest(q) {
  q = dnNorm(q); if (q.length < 2) return [];
  const rows = dnIndex(), out = [], seen = new Set();
  const add = r => { if (out.length < 6 && !seen.has(r.e.n)) { seen.add(r.e.n); out.push(r); } };
  rows.filter(r => !r.alias && r.k.startsWith(q)).forEach(add);
  rows.filter(r => r.alias && r.k.startsWith(q)).forEach(add);
  rows.filter(r => !r.k.startsWith(q) && (" " + r.k).includes(" " + q)).forEach(add);
  return out;
}
// a typed name: a primary name first (an exact spelling before a loose one), then an "also called" name
const dnResolve = q => { const raw = String(q).trim().toLowerCase(), k = dnNorm(q), rows = dnIndex();
  const r = rows.find(x => !x.alias && x.label.toLowerCase() === raw) || rows.find(x => !x.alias && x.k === k) || rows.find(x => x.k === k); return r ? r.e : null; };

// ---------- state ----------
const dnRec = (k = today()) => { const r = S.daily[k]; return r && r.g ? r : null; };
const dnDone = (k = today()) => { const r = S.daily[k]; return !!(r && (r.g ? r.done : true)); };   // an old {n, ok} save counts as played
const dnLog = (ev) => { try { if (typeof learnerLog === "function") learnerLog(ev); } catch (e) {} };

// ---------- the screen ----------
function daily() {
  if (!CORE_NAMES) { const tok = SHOW_N; waitScreen(); return loadCoreNames().then(() => { if (SHOW_N === tok + 1) { ROUTE_REPLACE = true; daily(); } }); }
  const k = today(), no = chNumber(k), t = dnTarget(k);
  if (!t) return go(S.tab || "learn");
  const old = S.daily[k] && !S.daily[k].g ? S.daily[k] : null;
  const rec = dnRec(k) || { t: t.n, g: [], done: false, ok: false, hint: false };
  const save1 = () => { S.daily[k] = old ? { ...rec, old } : rec; save(); };
  const ent = n => (CORE_NAMES || []).find(e => e.n === n) || BYNAME.get(n.toLowerCase()) || { n, h: "#808080" };
  const el = show(`
    <header class="deck-top"><button class="icon-btn" data-close aria-label="Close">${ICON.x}</button>
      <div class="dn-dots" aria-hidden="true">${Array.from({ length: DN_MAX }, () => "<i></i>").join("")}</div><span class="left mono">No. ${no}</span></header>
    <div class="dn-hero" style="--c:${t.h}" data-ink="${ink(t.h)}"><div class="dn-hero-name" id="dnName"></div></div>
    <div class="dn-ask" id="dnAsk">
      <h2 class="dn-q" id="dnQ">What's today's color <em>called?</em></h2>
      <form class="dn-form" id="dnForm" autocomplete="off"><input id="dnIn" class="dn-in" type="text" inputmode="text" autocapitalize="words" autocorrect="off" spellcheck="false" placeholder="Type a color name" aria-label="Your guess" enterkeyhint="go">
        <button class="dn-go" type="submit" aria-label="Guess">${ICON.arrow}</button></form>
      <div class="dn-sug" id="dnSug" role="listbox"></div>
      <p class="dn-msg small" id="dnMsg" role="status"></p>
    </div>
    <div class="dn-rows" id="dnRows"></div>
    <div class="dn-end" id="dnEnd"></div>
  `, "daily dn");
  const $ = s => el.querySelector(s), inp = $("#dnIn"), sug = $("#dnSug"), msg = $("#dnMsg"), rows = $("#dnRows");
  const leave = () => go(S.tab || "learn");
  $("[data-close]").onclick = leave;
  let sel = -1, cur = [];
  const dots = () => el.querySelectorAll(".dn-dots i").forEach((d, i) => {
    const g = rec.g[i]; d.className = g ? (i === rec.g.length - 1 && rec.ok ? "win" : "on") : ""; d.style.setProperty("--c", g ? ent(g).h : "");
  });
  const rowHTML = (n, i, fresh) => {
    const e = ent(n), a = dnAxes(e.h, t.h), win = rec.ok && i === rec.g.length - 1;
    const cells = win ? `<span class="dn-cell same">today's color</span>` : ["L", "H", "C"].map(x => `<span class="dn-cell ${a[x].st}">${esc(dnCell(a[x], x))}</span>`).join("");
    return `<div class="dn-row${win ? " win" : ""}${fresh ? " fresh" : ""}">
      <i class="dn-chip" style="--c:${e.h}" data-swatch="${e.h}" role="button" aria-label="${esc(e.n)}: open its page"></i>
      <div class="dn-row-b"><div class="dn-row-top"><b>${esc(e.n)}</b><span class="code">${win ? "100" : a.close}%</span></div>
        <div class="dn-cells">${cells}</div><span class="dn-bar"><i style="--w:${win ? 100 : a.close}%;--c:${e.h}"></i></span></div></div>`;
  };
  const drawRows = (fresh = false) => {
    rows.innerHTML = rec.g.map((n, i) => ({ n, i })).reverse().map(({ n, i }) => rowHTML(n, i, fresh && i === rec.g.length - 1)).join("");
    const last = rec.g[rec.g.length - 1];
    if (last && !rec.done) { const a = dnAxes(ent(last).h, t.h); msg.innerHTML = esc(dnSentence(a, ent(last).n)); }
    dots();
  };
  const sugDraw = () => {
    cur = dnSuggest(inp.value); sel = -1;
    sug.innerHTML = cur.map((r, i) => `<button type="button" role="option" data-s="${i}">${esc(r.label)}${r.alias ? `<span class="note">· ${esc(r.e.n)}</span>` : ""}</button>`).join("");
    sug.classList.toggle("on", cur.length > 0);
  };
  const hintBtn = () => rec.g.length >= DN_HINT_AFTER && !rec.done && !rec.hint ? `<button class="btn ghost dn-hint" data-hint>Show 4 choices</button>` : "";
  const footer = () => {
    if (rec.done) return;
    const left = DN_MAX - rec.g.length;
    $("#dnEnd").innerHTML = `${hintBtn()}<p class="note dn-left">${rec.g.length ? `${left} ${left === 1 ? "guess" : "guesses"} left` : "Six guesses. Each one tells you which way to go."}</p>`;
    const h = el.querySelector("[data-hint]"); if (h) h.onclick = choices;
  };
  const guess = e => {
    if (rec.done) return;
    if (!e) { buzz([10, 40, 10]); msg.textContent = "Not a name we know yet. Try another spelling, or a simpler word."; inp.classList.remove("shake"); void inp.offsetWidth; inp.classList.add("shake"); return; }
    if (rec.g.includes(e.n)) { buzz(8); msg.textContent = `You already tried ${e.n.toLowerCase()}.`; return; }
    rec.g.push(e.n);
    const won = dnWin(e, t);
    if (won) { rec.ok = true; rec.done = true; }
    else {
      const d = de2000(e.h, t.h);
      if (d < 10) dnLog({ k: "confuse", c: t.n, with: e.n, surf: "daily", dir: dnSentence(dnAxes(e.h, t.h), e.n) });
      if (rec.g.length >= DN_MAX) rec.done = true;
    }
    save1();
    inp.value = ""; sugDraw();
    buzz(won ? 12 : 8);
    drawRows(true);
    if (rec.done) return finish(true);
    if (de2000(e.h, t.h) < VERY_CLOSE_DE) msg.innerHTML = `So close. ${esc(dnSentence(dnAxes(e.h, t.h), e.n))}`;
    footer();
  };
  const submit = () => {
    const v = inp.value.trim(); if (!v) return;
    const pick = sel >= 0 && cur[sel] ? cur[sel].e : dnResolve(v) || (cur.length === 1 ? cur[0].e : null);
    guess(pick);
  };
  $("#dnForm").onsubmit = ev => { ev.preventDefault(); submit(); };
  inp.oninput = () => { msg.textContent = ""; sugDraw(); };
  inp.onkeydown = ev => {
    if (ev.key === "ArrowDown" || ev.key === "ArrowUp") { ev.preventDefault(); sel = clamp(sel + (ev.key === "ArrowDown" ? 1 : -1), -1, cur.length - 1); sug.querySelectorAll("button").forEach((b, i) => b.classList.toggle("sel", i === sel)); }
    if (ev.key === "Escape") { inp.value = ""; sugDraw(); }
  };
  sug.onclick = ev => { const b = ev.target.closest("[data-s]"); if (b) { guess(cur[+b.dataset.s].e); inp.focus(); } };
  // the 4-choice fallback: one try, marked as "with 4 choices" in the result
  function choices() {
    rec.hint = true; save1();
    const opts = dnChoices(t, CORE_NAMES, rec.g, seededRnd(dlHash("dn-choices" + k)));
    $("#dnAsk").innerHTML = `<h2 class="dn-q">Which one is <em>it?</em></h2><div class="dn-opts">${opts.map((o, i) => `<button data-o="${i}">${esc(o.n)}</button>`).join("")}</div><p class="dn-msg small" id="dnMsg"></p>`;
    $("#dnEnd").innerHTML = "";
    el.querySelectorAll("[data-o]").forEach(b => b.onclick = () => {
      if (rec.done) return;
      const o = opts[+b.dataset.o], ok = o.n === t.n;
      b.classList.add(ok ? "right" : "wrong");
      if (!ok) el.querySelector(`[data-o="${opts.indexOf(t)}"]`).classList.add("right");
      rec.g.push(o.n); rec.ok = ok; rec.done = true; save1();
      if (!ok) dnLog({ k: "confuse", c: t.n, with: o.n, surf: "daily" });
      buzz(ok ? 12 : [10, 40, 10]);
      later(() => { drawRows(); finish(true); }, 750);
    });
  }
  // the end: the color named, its story, the rows kept as the record, and the share
  function finish(fresh) {
    const node = BYNAME.get(t.n.toLowerCase()), n = node && typeof colorNode === "function" ? colorNode(node) : null;
    const fam = typeof familyOf === "function" ? familyOf(t.n) : null;
    const story = n && n.wiki && n.wiki.facets && n.wiki.facets[0] ? linkText(n.wiki.facets[0].text)
      : node && (node.o || node.d) ? esc(node.o || node.d)
      : fam && fam.head && fam.head.n !== t.n ? `${esc(t.n)} belongs to the <a data-node="c:${esc(fam.head.n)}">${esc(fam.head.n.toLowerCase())}</a> family${(t.also || []).length ? `. It's also called ${esc(t.also.slice(0, 3).join(", "))}` : ""}.` : "";
    const near = rec.g.filter(x => x !== t.n).map(ent).sort((p, q) => de2000(p.h, t.h) - de2000(q.h, t.h))[0];
    // the closest guess, said the same way the rows say it: "Next to easter green, it's redder and weaker."
    const dnNextTo = g => { const a = dnAxes(g.h, t.h), ps = ["L", "H", "C"].filter(x => a[x].st === "near" || a[x].st === "far").map(x => dnCell(a[x], x));
      return ps.length ? `Next to ${g.n.toLowerCase()}, it's ${ps.length === 1 ? ps[0] : ps.slice(0, -1).join(", ") + " and " + ps[ps.length - 1]}.` : `It sits right beside ${g.n.toLowerCase()}.`; };
    const n1 = rec.g.length, verdict = rec.ok ? (rec.hint ? `Found with <em>choices.</em>` : n1 === 1 ? `First <em>try.</em>` : `Named in <em>${["", "one", "two", "three", "four", "five", "six"][n1]}.</em>`) : `It's <em>${esc(t.n.toLowerCase())}.</em>`;
    $("#dnName").innerHTML = `<b>${esc(t.n)}</b><span class="code">${t.h}</span>`;
    el.querySelector(".dn-hero").classList.add("named");
    $("#dnAsk").innerHTML = `<h2 class="dn-q dn-verdict">${verdict}</h2>${near ? `<p class="lead dn-diff">${esc(dnNextTo(near))}</p>` : ""}`;
    const misses = dlMisses(k);
    $("#dnEnd").innerHTML = `
      ${story ? `<p class="dn-story">${story}</p>` : ""}
      <button class="btn ghost" data-page>Read about ${esc(t.n.toLowerCase())}</button>
      <div class="dn-acts"><button class="btn" data-share>Share your rows ${ICON.share}</button>
      ${misses.length && typeof prInstantDeck === "function" ? `<button class="btn ghost" data-practice>Practice today's misses</button>` : ""}
      ${chToday() ? `<button class="btn ghost" data-home>Back to ${S.tab === "gym" ? "Train" : "Learn"}</button>` : `<button class="btn ghost" data-paint>Now today's painting</button>`}</div>
      <p class="fine">${dlStreakLine()}Screen colors are approximate. A new color tomorrow.</p>`;
    if (typeof wireLinks === "function") wireLinks($("#dnEnd"));
    $("[data-page]").onclick = () => openCoreName(t.h, t.n);
    $("[data-share]").onclick = () => dnShare(rec, no, t);
    const pr = el.querySelector("[data-practice]"); if (pr) pr.onclick = () => prInstantDeck({ title: "Today's misses", names: misses.map(m => m.n) });
    const hm = el.querySelector("[data-home]"); if (hm) hm.onclick = leave;
    const pa = el.querySelector("[data-paint]"); if (pa) pa.onclick = () => challenge();
    if (!rec.ok) dnLog({ k: "miss", c: t.n, surf: "daily" }); else dnLog({ k: rec.hint ? "recog_ok" : "recall_ok", c: t.n, surf: "daily" });
    if (fresh) buzz(rec.ok ? [10, 30, 20] : 10);
    dots();
  }
  drawRows();
  if (rec.done) return finish(false);
  if (rec.hint) return choices();
  footer();
}
// the share card: each guess as its own color and how close it came; never a name (pure, tested)
function dnShareSpec(rec, no, t, list = CORE_NAMES || []) {
  const rows = rec.g.map((n, i) => { const e = list.find(x => x.n === n) || { h: "#808080" }, win = rec.ok && i === rec.g.length - 1; return { h: e.h, close: win ? 100 : dnAxes(e.h, t.h).close, win }; });
  if (!rec.ok) rows.push({ h: t.h, close: 100, win: false });
  const n = rec.g.length;
  return { layout: "guesses", note: `Today's color, No. ${no}`, title: rec.ok ? (rec.hint ? `${n} of ${DN_MAX}, with choices` : `${n} of ${DN_MAX}`) : `Not today`,
    sub: rec.ok ? "Each row is one guess, in its own color." : "Six guesses, then the color itself.", rows };
}
const dnShare = (rec, no, t) => cardShare(dnShareSpec(rec, no, t), dnShareText(rec, no), routeURL("daily"), `colorhub-color-${no}.png`);
