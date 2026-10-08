"use strict";
// ColorSet: one shape for any group of colors (a painting, a painter, a decade, a photo, a poem, a lesson, a
// palette, a family, a search result, a color and its look-alikes), and one set of verbs that work on any of them
// (design/GENIUS-PANEL-1.md §2.2, lane L20). A new screen gets every connection by building one colorSet().
// (Not to be confused with js/colorsets.js, the color explorer's filter presets.)
//
//   colorSet({ kind, id, title, colors: [{ h, n?, share? }], src }) -> { kind, id, key, title, colors, src }
//   csOnMap(set)        Home, with the set lit up as a constellation (honeyHighlight in js/honey.js)
//   csLearn(set)        an instant deck of the set (prInstantDeck, the Practice lane) or Learn it on its top color
//   csPlay(set, o)      a game board from the set (playSet, the Train lane) or Odd one out seeded with its colors
//   csCompare(a, b)     a side-by-side sheet: both palettes, close matches, lighter / stronger / warmer
//   csPalette(set)      keep it in Studio · csShare(set) a share card
//   csActions(set, o)   one action row (an element, already wired) any page can drop in.
//                       o: { only: ["map","learn","play","compare","keep","share"], back: fn, compareWith: set }
// Every verb also takes a function that returns a set, so a page whose palette changes (a 3/6/12 slider) stays live.

let CS_PLAY_POOL = null;   // js/gym.js metColors() draws from this while a set's Odd one out is running
const CS_MAXN = 24;
const csHex = h => /^#?[0-9a-f]{6}$/i.test(String(h || "")) ? "#" + String(h).replace("#", "").toUpperCase() : null;
const csGet = s => typeof s === "function" ? s() : s;
function colorSet(o = {}) {
  const kind = String(o.kind || "set"), id = String(o.id != null ? o.id : ""), got = new Set(), colors = [];
  (o.colors || []).forEach(x => {
    const c = typeof x === "string" ? { h: x } : x || {}, h = csHex(c.h || c.hex);
    if (!h || got.has(h) || colors.length >= CS_MAXN) return;
    got.add(h);
    const out = { h };
    if (c.n) out.n = String(c.n);
    if (c.share != null && isFinite(c.share)) out.share = +c.share;
    colors.push(out);
  });
  return { kind, id, key: kind + ":" + id, title: String(o.title || ""), colors, src: o.src || "" };
}
const csName = c => c.n || (typeof nameOf === "function" ? nameOf(c.h).text : "") || c.h;   // honest: "Between black and gunmetal", never a far name

// ---------- the verbs ----------
function csOnMap(set) {
  set = csGet(set); if (!set || !set.colors.length) return;
  if (typeof honeyHighlight === "function") honeyHighlight(set.colors.map(c => c.h), { title: set.title });
  // the page that lit it stays on the trail behind the map (js/trail.js tlNote), so the lit set can return to its source
  if (typeof XSTACK !== "undefined" && XSTACK.length && !document.querySelector(".screen.hm")) TL_MAPKEEP = { stack: XSTACK.slice(), root: X_ROOT, t: performance.now() };
  if (typeof hmHome === "function") hmHome(); else go("learn");
}
// the set's colors, biggest share first, each as its nearest taught color; the first that isn't yours yet
function csTeachable(set) {
  const near = set.colors.slice().sort((a, b) => (b.share || 0) - (a.share || 0)).map(c => {
    const named = c.n && BYNAME.get(c.n.toLowerCase());
    if (named && !named.basic) return named;
    const L = lab(c.h); let best = null, bd = Infinity;
    ALL.forEach(x => { const d = de2000(L, x.lab || (x.lab = lab(x.h))); if (d < bd) { bd = d; best = x; } });
    return best;
  }).filter(Boolean);
  return near.find(x => typeof knowState !== "function" || knowState(x) !== "yours") || near[0] || null;
}
function csLearn(set, o = {}) {
  set = csGet(set); if (!set || !set.colors.length) return;
  if (typeof prInstantDeck === "function") return prInstantDeck({ source: "set", set, back: o.back });
  const c = csTeachable(set);
  if (c && typeof hmLearnIt === "function") return hmLearnIt(c);
  toast("Nothing here to learn yet");
}
function csPlay(set, o = {}) {
  set = csGet(set); if (!set || !set.colors.length) return;
  if (typeof playSet === "function") return playSet(set, o.task || "odd");
  if (typeof runDrill !== "function") return;
  if (!S.scr) return runDrill("hue");   // the one-time screen check comes first; the seeded board needs a drill screen to end with
  CS_PLAY_POOL = set.colors.map(c => ({ n: csName(c), h: c.h }));
  const back = o.back || (() => go("gym"));
  runDrill("hue", { noIntro: true, trials: 8, done: res => {
    CS_PLAY_POOL = null;
    const s = res && res.ses && res.ses.hue, est = s && s.log && s.log.length ? s.estimate() : null;
    back();
    if (est != null) toast(`Odd one out${set.title ? " in " + set.title : ""}: you saw ${pctDiff(est)}`);
  } });
  cleanup.push(() => { CS_PLAY_POOL = null; });   // closing the drill (or any screen change) ends the seeding
}
function csPalette(set) {
  set = csGet(set); if (!set || !set.colors.length || typeof keepPalette !== "function") return;
  keepPalette(set.colors.map(c => c.h), set.title || "Palette");
  if (typeof learnerLog === "function") learnerLog({ type: "like", set, src: set.kind });
}
function csShare(set) {
  set = csGet(set); if (!set || !set.colors.length) return;
  if (typeof sharePalette === "function") return sharePalette(set.colors, set.title || "A palette", h => ({ nm: nameOf(h) }));
  const url = set.src && typeof shareURL === "function" ? shareURL(set.src) : location.href;
  if (navigator.share) navigator.share({ text: `${set.title || "Colors"} · ColorHub`, url }).catch(() => {});
  else { try { navigator.clipboard.writeText(url); toast("Copied the link"); } catch (e) {} }
}
// what to compare with when nothing is given: the last other set you looked at (the Learner Model's trail)
function csPartner(set) {
  if (typeof trail !== "function") return null;
  const t = trail(8).find(x => x.key !== set.key && x.kind !== "color" && x.colors.length >= 2);
  return t ? colorSet(t) : null;
}
// share-weighted lightness and chroma; the warm share (hues from magenta through red to yellow)
function csStats(set) {
  const cs = set.colors, w = cs.map(c => c.share != null ? c.share : 1 / cs.length), tw = w.reduce((a, b) => a + b, 0) || 1;
  let L = 0, C = 0, warm = 0;
  cs.forEach((c, i) => { const [l, ch, H] = lch(c.h), k = w[i] / tw; L += l * k; C += ch * k; if (ch >= 8 && (H < 100 || H >= 330)) warm += k; });
  return { L, C, warm };
}
function csCompare(a, b) {
  a = csGet(a); b = csGet(b);
  if (!a || !a.colors.length) return;
  if (!b || !b.colors.length) { toast("Open another painting or photo first, then compare"); return; }
  const sa = csStats(a), sb = csStats(b), A = a.title || "This set", B = b.title || "That set";
  // one plain sentence: what's measurably different (lightness and strength in L*/C* units of 4+, warm share 15%+)
  const diffs = [];
  if (Math.abs(sa.L - sb.L) >= 4) diffs.push(sa.L > sb.L ? "lighter" : "darker");
  if (Math.abs(sa.C - sb.C) >= 4) diffs.push(sa.C > sb.C ? "more vivid" : "more muted");
  if (Math.abs(sa.warm - sb.warm) >= .15) diffs.push(`${sa.warm > sb.warm ? "warmer" : "cooler"} (${Math.round(sa.warm * 100)}% warm colors against ${Math.round(sb.warm * 100)}%)`);
  const lines = [diffs.length ? `<b>${esc(A)}</b> is ${diffs.length > 1 ? diffs.slice(0, -1).join(", ") + " and " + diffs[diffs.length - 1] : diffs[0]}.` : "About as light, as strong and as warm as each other."];
  const match = [];
  a.colors.forEach(x => { let best = null, bd = Infinity; b.colors.forEach(y => { const d = de2000(x.h, y.h); if (d < bd) { bd = d; best = y; } }); if (best && bd <= 6) match.push([x, best, bd]); });
  const chip = c => `<button class="cs-chip" data-cs-hex="${c.h}"><i style="--c:${c.h}"></i><span>${esc(csName(c))}</span>${typeof relMarkHTML === "function" ? relMarkHTML(c.n ? { n: c.n, h: c.h } : c.h) : ""}</button>`;
  const strip = s => `<div class="cs-strip">${s.colors.map(c => `<button style="--c:${c.h};flex:${Math.max(c.share != null ? c.share : 1 / s.colors.length, .06).toFixed(3)}" data-cs-hex="${c.h}" aria-label="${esc(csName(c))}"></button>`).join("")}</div>`;
  const { sh, close } = sheet(`
    <p class="eyebrow">Compare</p>
    <div class="cs-cmp">
      <section><h3>${esc(A)}</h3>${strip(a)}<div class="cs-chips">${a.colors.slice(0, 8).map(chip).join("")}</div></section>
      <section><h3>${esc(B)}</h3>${strip(b)}<div class="cs-chips">${b.colors.slice(0, 8).map(chip).join("")}</div></section>
    </div>
    <div class="cs-cmp-read">${lines.map(l => `<p>${l}</p>`).join("")}
      ${match.length ? `<p>${match.length} close match${match.length === 1 ? "" : "es"}: ${match.slice(0, 4).map(([x, y, d]) => `${esc(csName(x))} ≈ ${esc(csName(y))} (${pctDiff(d)})`).join(" · ")}.</p>` : `<p>No color in one is a close match for a color in the other.</p>`}
    </div>
    <p class="fine">Measured on screen colors (CIEDE2000, share-weighted). Paintings are as photographed, through old varnish.</p>`);
  sh.classList.add("cs-cmp-sheet");
  sh.addEventListener("click", e => { const t = e.target.closest("[data-cs-hex]"); if (!t) return; close(); openTappedColor(t.dataset.csHex); });
}

// ---------- the action row ----------
const CS_ICON = {
  map: sv('<circle cx="7" cy="8" r="3"/><circle cx="17" cy="7" r="3"/><circle cx="12" cy="16.5" r="3"/>', 20, 1.8),
  learn: sv('<rect x="7" y="3" width="12" height="15" rx="2.5"/><path d="M4 7.5V18a3 3 0 0 0 3 3h8.5"/>', 20, 1.8),
  play: sv('<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5" fill="currentColor"/>', 20, 1.8),
  compare: sv('<rect x="3" y="5" width="8" height="14" rx="2"/><rect x="13" y="5" width="8" height="14" rx="2"/>', 20, 1.8),
  keep: sv('<path d="M7 4h10v16l-5-4-5 4z"/>', 20, 1.8),
  share: sv('<path d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>', 20, 1.8),
};
const CS_ACTS = [["map", "On the map"], ["learn", "Learn"], ["play", "Play"], ["compare", "Compare"], ["keep", "Keep"], ["share", "Share"]];
function csActions(set, o = {}) {
  const row = document.createElement("div");
  row.className = "cs-acts"; row.setAttribute("role", "group"); row.setAttribute("aria-label", "Do more with these colors");
  const first = csGet(set);
  if (!first || !first.colors.length) return row;
  const partner = () => o.compareWith ? csGet(o.compareWith) : csPartner(csGet(set));
  const want = CS_ACTS.filter(([k]) => (!o.only || o.only.includes(k)) && (k !== "compare" || partner()));
  row.innerHTML = want.map(([k, t]) => `<button class="cs-act" data-cs="${k}">${CS_ICON[k]}<span>${t}</span></button>`).join("");
  row.style.setProperty("--n", want.length); row.dataset.n = want.length;
  row.onclick = e => {
    const b = e.target.closest("[data-cs]"); if (!b) return;
    e.stopPropagation(); buzz(5);
    const s = csGet(set), k = b.dataset.cs;
    if (k === "map") csOnMap(s);
    else if (k === "learn") csLearn(s, { back: o.back });
    else if (k === "play") csPlay(s, { back: o.back });
    else if (k === "compare") csCompare(s, partner());
    else if (k === "keep") { csPalette(s); b.querySelector("span").textContent = "Kept"; }
    else if (k === "share") csShare(s);
  };
  return row;
}
