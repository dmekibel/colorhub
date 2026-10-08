"use strict";
// The masters' chords (lane L26): which colors painters actually put together, measured, set beside what color-wheel
// theory predicts. Data: data/colorindex/chords.json (tools/color_index.py), read through topChords() in
// js/colorindex.js. A tap on any pair opens its paintings (#/pair/<a>+<b>, js/paintingsof.js).
//   chordsPage({ era, kind })   the screen, #/chords
// kinds: pairs, triads, avoid (pairs painters keep apart).

let CHD = { era: "all", kind: "pairs" };
const CHD_KINDS = [["pairs", "Pairs"], ["triads", "Triads"], ["avoid", "Kept apart"]];
const CHD_REL_NOUN = ["two neutrals", "a color with a neutral", "neighbors on the wheel", "in between", "near-opposites"];
const chdTimes = l => (l >= 10 ? Math.round(l) : l.toFixed(1)) + "×";

// what the table says about wheel theory, in one honest paragraph
function chdTheory(sl, kind) {
  const names = ["neutrals", "neutral+color", "analogous", "between", "opposite"], r = sl.rel;
  const top = sl.pairs.length;
  if (!top) return "";
  const have = names.map((k, i) => ({ i, k, top: r[k].top, lift: r[k].lift, pairs: r[k].pairs })).filter(x => x.pairs);
  const parts = have.filter(x => x.top).sort((a, b) => b.top - a.top).map(x => `${x.top} ${x.top === 1 ? "is" : "are"} ${CHD_REL_NOUN[x.i]}`);
  const lifts = have.filter(x => x.lift != null && [1, 2, 4].includes(x.i)).map(x => `${CHD_REL_NOUN[x.i]} ${chdTimes(x.lift)}`);
  const opp = r.opposite, ana = r.analogous;
  let verdict = "";
  if (opp.lift != null && ana.lift != null && opp.pairs >= 20 && ana.pairs >= 20) {
    verdict = opp.lift < ana.lift * .85 ? "Theory's favorite, the near-opposite pairing, is not what shows up most here: painters lean on neighbors on the wheel and on quiet neutrals."
      : opp.lift > ana.lift * 1.15 ? "Near-opposites do come out ahead here, which is what theory predicts."
        : "Near-opposites and neighbors come out about level here: theory's ranking doesn't show.";
  }
  return `<p>Of the ${top} pairs that beat chance most, ${parts.join(", ")}.${lifts.length ? ` Across every pair we could measure, the typical lift is ${lifts.join(", ")}.` : ""} ${verdict}</p>
    <p class="fine">The wheel here is CIELAB hue, a perceptual one: painters' own wheels place complements differently, and a canvas holding two colors isn't the same as someone pairing them on purpose. Neutrals are colors with very little chroma.</p>`;
}

// a chord is two different colors: drop pairs where any two members are near-twins (k-means splitting one gradient, e.g. Maroon + Oxblood)
const CHD_MIN_DE = 15;
function chdSpread(x) {   // the smallest gap between any two members, on the 0-100 black-to-white scale
  const hx = x.length >= 8 ? [x[1], x[3], x[5]] : [x[1], x[3]];   // triads carry 3 names then counts, pairs 2
  let m = 100;
  for (let i = 0; i < hx.length; i++) for (let j = i + 1; j < hx.length; j++) m = Math.min(m, de2000(hx[i], hx[j]));
  return m;
}
// keep the chords whose members are really different; a thin slice keeps its 10 most different instead, still in the original order
function chdApart(L) {
  const ok = L.filter(x => chdSpread(x) >= CHD_MIN_DE);
  if (ok.length >= 10 || L.length <= 10) return ok.length ? ok : L;
  const keep = new Set(L.slice().sort((a, b) => chdSpread(b) - chdSpread(a)).slice(0, 10));
  return L.filter(x => keep.has(x));
}
function chordsPage(o = {}) {
  if (o.era) CHD.era = o.era;
  if (o.kind) CHD.kind = o.kind;
  if (o.push !== false && XSTACK[XSTACK.length - 1] !== "chords") XSTACK.push("chords");
  const el = show(`
    <header class="art-top"><button class="icon-btn glass" data-back aria-label="Back">${ICON.back}</button></header>
    <p class="eyebrow p-type">Color in paintings</p>
    <h1 class="p-title">Masters' chords</h1>
    <p class="p-dek">The colors painters put together more often than chance, measured in the museum photographs.</p>
    <div class="chd-eras" data-eras role="tablist" aria-label="Era or school"></div>
    <div class="pt-seg-row"><div class="pt-seg" data-kinds>${CHD_KINDS.map(([k, t]) => `<button data-kind="${k}">${t}</button>`).join("")}</div></div>
    <p class="chd-sub" data-sub></p>
    <div class="chd-list" data-list><p class="fine">Reading the paintings…</p></div>
    <section class="chd-theory" data-theory hidden><h3>Theory and practice</h3><div data-theorybody></div></section>
    <p class="fine" data-how></p>
  `, "article chd-page");
  el.querySelector("[data-back]").onclick = xBack;
  onKey = e => { if (e.key === "Escape") xBack(); };
  let data = null;
  const draw = () => {
    if (!data) return;
    el.querySelectorAll("[data-kind]").forEach(b => b.classList.toggle("on", b.dataset.kind === CHD.kind));
    const sl = data.slices.find(x => x.k === CHD.era) || data.slices[0];
    if (sl.k !== CHD.era) CHD.era = sl.k;
    el.querySelector("[data-eras]").innerHTML = data.slices.map(x => `<button data-era="${x.k}" class="${x.k === CHD.era ? "on" : ""}" role="tab" aria-selected="${x.k === CHD.era}">${esc(x.label)}</button>`).join("");
    const sub = { pairs: `The ${sl.pairs.length} pairs that beat chance most, among ${sl.n.toLocaleString("en-US")} paintings${sl.k === "all" ? "" : " from " + sl.label}.`,
      triads: `Three-color combinations that beat chance, each pair inside them also above chance.`,
      avoid: `Pairs that turn up together far less than their popularity predicts.` }[CHD.kind];
    el.querySelector("[data-sub]").textContent = sub;
    const L = chdApart(sl[CHD.kind === "avoid" ? "avoid" : CHD.kind]);
    const row = (cols, big, small, spec) => `<button class="chd-row" data-hexes="${cols.map(c => c[1]).join("+")}" data-names="${esc(cols.map(c => c[0]).join("|"))}"><span class="chd-sw">${cols.map(c => `<i style="--c:${c[1]}"></i>`).join("")}</span><span class="chd-t"><b>${esc(big)}</b><small>${small}</small></span>${ICON.arrow}</button>`;
    el.querySelector("[data-list]").innerHTML = !L.length ? `<p class="fine">Nothing in ${esc(sl.label)} is measurable enough to show.</p>`
      : L.map(x => {
        if (CHD.kind === "pairs") return row([[x[0], x[1]], [x[2], x[3]]], `${x[0]} + ${x[2]}`, `${chdTimes(x[5])} chance · ${x[4].toLocaleString("en-US")} paintings · ${CHD_REL_NOUN[x[6]]}`);
        if (CHD.kind === "triads") return row([[x[0], x[1]], [x[2], x[3]], [x[4], x[5]]], `${x[0]} + ${x[2]} + ${x[4]}`, `${chdTimes(x[7])} chance · ${x[6].toLocaleString("en-US")} paintings`);
        return row([[x[0], x[1]], [x[2], x[3]]], `${x[0]} + ${x[2]}`, `${x[5].toLocaleString("en-US")} together, ${Math.round(x[4]).toLocaleString("en-US")} expected · ${chdTimes(x[6])} chance`);
      }).join("");
    const th = el.querySelector("[data-theory]");
    th.hidden = CHD.kind !== "pairs" || !sl.pairs.length;
    if (!th.hidden) el.querySelector("[data-theorybody]").innerHTML = chdTheory(sl, CHD.kind);
    el.querySelector("[data-how]").textContent = data.how;
    try { history.replaceState(history.state, "", "#/chords"); } catch (e) {}
  };
  ciChords().then(d => { data = d; draw(); }).catch(() => { const l = el.querySelector("[data-list]"); if (l && l.isConnected) l.innerHTML = `<p class="fine">The chords didn't load. <button class="wl" data-retry>Try again</button></p>`; });
  el.addEventListener("click", e => {
    const era = e.target.closest("[data-era]"); if (era) { CHD.era = era.dataset.era; buzz(5); return draw(); }
    const kind = e.target.closest("[data-kind]"); if (kind) { CHD.kind = kind.dataset.kind; buzz(5); return draw(); }
    if (e.target.closest("[data-retry]")) return chordsPage({ push: false });
    const r = e.target.closest("[data-hexes]");
    if (r) { buzz(6); return paintingsOfPage(r.dataset.hexes.split("+").map(h => "#" + h), { tol: 4, minCover: 1, maxCover: null, mode: "all", names: r.dataset.names.split("|") }); }
  });
  return el;
}
