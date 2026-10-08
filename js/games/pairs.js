"use strict";
// Painters' pairs: which colors did painters put together? (David: "learn which colors pair more often in
// paintings".) Two pairs of colors; pick the pair that turns up together more often in the archive's 23,781
// paintings, measured by lift (how much more often than chance). The reveal gives both lifts, the number of
// paintings, three paintings that hold the winning pair, and their era. Variants unlock as you play:
//   love     which pair turns up together more often (all paintings)
//   group    which pair did Dutch / Italian / 17th-century painters favor (lift inside that group)
//   avoided  painters kept one pair apart: which? (seen together at most half as often as chance)
// The rounds come from ooPairsRound (js/games/oo-engine.js): only pairs whose lifts are clearly apart
// (3 standard errors and a tier ratio) are played. Data: data/games/pairs.js (tools/pairs_build.js), lazy.
// Honest caveat on the intro: photographs of varnished paintings, each color named to the nearest lesson word.

const OO_PAIR_VARIANTS = [
  { id: "love", at: 0, news: "Which pair turns up together more often?" },
  { id: "group", at: 1, news: "Now inside one school or century" },
  { id: "avoided", at: 2, news: "Painters kept one pair apart" },
];
let OO_PAIRS_LOADING = null;
function ooPairsLoad() {
  if (window.OO_PAIRS) return Promise.resolve(true);
  if (!OO_PAIRS_LOADING) OO_PAIRS_LOADING = new Promise(res => { const s = document.createElement("script"); s.src = "data/games/pairs.js"; s.onload = () => res(true); s.onerror = () => { OO_PAIRS_LOADING = null; res(false); }; document.head.appendChild(s); });
  return OO_PAIRS_LOADING;
}
const ooGroupWords = g => g === "all" ? "in paintings" : /century/.test(g) ? `in ${g} paintings` : `by ${g} painters`;
const ooLiftWords = l => l >= 1.05 ? `${l >= 10 ? l.toFixed(0) : l.toFixed(1)}× as often as chance` : l <= .95 ? `${Math.round(l * 100)}% of what chance predicts` : "about as often as chance";
OO_MIXPLAY.pairs = function (ui, it) {
  return new Promise(resolve => {
    const P = window.OO_PAIRS, rd = P && ooPairsRound(P, it.rnd || Math.random, { variant: it.variant || "love", tier: it.tier || "medium" });
    if (!rd) return resolve({ ok: 0, ms: 0, act: 0, noModel: true, hold: true, line: "Couldn't draw a clear pair this time." });
    const nm = i => P.names[i][0], hx = i => P.names[i][1];
    const card = (p, k) => `<button class="oo-pc" data-k="${k}"><span class="oo-pcs"><i style="--c:${hx(p[0])}"></i><i style="--c:${hx(p[1])}"></i></span><b>${esc(nm(p[0]))} <em>with</em> ${esc(nm(p[1]))}</b><span class="oo-pcl"></span></button>`;
    ui.q.textContent = rd.variant === "avoided" ? "Painters kept one of these pairs apart. Which?" : rd.variant === "group" ? `Which pair did ${/century/.test(rd.group) ? `${rd.group} painters` : `${rd.group} painters`} favor?` : "Which pair turns up together more often in paintings?";
    ui.stage.innerHTML = `<div class="oo-pairs">${card(rd.a, 0)}${card(rd.b, 1)}<div class="oo-pex"></div></div>`;
    const btns = [...ui.stage.querySelectorAll(".oo-pc")], t0 = performance.now();
    btns.forEach((b, k) => b.onclick = () => {
      btns.forEach(x => x.disabled = true);
      const ok = k === rd.win, w = rd.win ? rd.b : rd.a, l = rd.win ? rd.a : rd.b;
      btns[rd.win].classList.add("ring"); if (!ok) b.classList.add("miss");
      buzz(ok ? 10 : [10, 40, 10]);
      // settle: each card's lift and count, then three paintings that hold the winner, and their era
      [rd.a, rd.b].forEach((p, j) => { const el = btns[j].querySelector(".oo-pcl"); el.textContent = `${ooLiftWords(p[4])} · ${p[2].toLocaleString()} painting${p[2] === 1 ? "" : "s"}`; el.classList.add("oo-in"); });
      const show3 = (rd.variant === "avoided" ? l : w)[5].slice(0, 3).map(i => P.ex[i]).filter(Boolean);
      const years = show3.map(e => e[2]).filter(y => y != null).sort((x, y) => x - y);
      const era = years.length ? (years[0] === years[years.length - 1] ? String(years[0]) : `${years[0]}–${years[years.length - 1]}`) : "";
      later(() => {
        const ex = ui.stage.querySelector(".oo-pex");
        if (!ex) return;
        ex.innerHTML = `<p class="oo-pexh">${rd.variant === "avoided" ? `Where ${esc(nm(l[0]).toLowerCase())} and ${esc(nm(l[1]).toLowerCase())} do meet` : `${esc(nm(w[0]))} with ${esc(nm(w[1]).toLowerCase())}`}${era ? `, ${esc(era)}` : ""}</p>
          <div class="oo-pexr">${show3.map(e => `<button class="oo-pp" data-gi="${e[5]}"><img src="${esc(e[3])}" alt="" loading="lazy"><span>${esc(e[0])}</span><em>${esc(e[1] || "")}${e[2] != null ? `, ${e[2]}` : ""}</em></button>`).join("")}</div>`;
        ex.classList.add("oo-in");
        ex.querySelectorAll("[data-gi]").forEach(x => x.onclick = () => { if (typeof galleryPage === "function") galleryPage(+x.dataset.gi); });
      }, 300);
      const where = ooGroupWords(rd.group);
      const line = rd.variant === "avoided"
        ? `${ok ? "Right: " : ""}${esc(nm(w[0]))} and ${esc(nm(w[1]).toLowerCase())} meet ${ooLiftWords(w[4])} ${where}: ${w[2]} paintings where chance predicts ${Math.round(w[3])}.`
        : `${ok ? "Right: " : ""}${esc(nm(w[0]))} with ${esc(nm(w[1]).toLowerCase())} turns up ${ooLiftWords(w[4])} ${where}; the other pair ${ooLiftWords(l[4]).replace(" as chance", "")}.`;
      resolve({ ok: ok ? 1 : 0, ms: performance.now() - t0, act: 0, noModel: true, hold: true, line });
    });
  });
};
function ooPairs() {
  ooPairsLoad().then(ok => {
    if (!ok) return toast("Couldn't load the painting pairs");
    const st = ooS(), pr = st.pairs && typeof st.pairs === "object" ? st.pairs : (st.pairs = { n: 0, best: 0 });
    const open = OO_PAIR_VARIANTS.filter(v => (pr.n || 0) >= v.at), fresh = OO_PAIR_VARIANTS.find(v => v.at === (pr.n || 0) && v.at > 0);
    const el = show(`
      <header class="deck-top"><button class="icon-btn" data-close aria-label="Back">${ICON.back}</button></header>
      <h1 class="title-1 oo-title">Painters' pairs</h1>
      <p class="lede">Some colors keep company. Two pairs at a time: which pair did painters put together more often?</p>
      ${fresh ? `<p class="gy-news"><b>New</b> ${esc(fresh.news)}.</p>` : ""}
      <p class="fine">Measured over ${OO_PAIRS.groups.all.m.toLocaleString()} paintings in the archive, six colors each, named to the nearest lesson color. "Lift" compares how often a pair shares a canvas with what chance predicts from how common each color is. Only pairs whose lifts are clearly apart are played, and near-identical colors are left out. These are photographs of varnished paintings, so they lean brown.</p>
      <div class="stack" style="margin-top:28px"><button class="btn" data-go>${pr.n ? "Play six rounds" : "Start"} ${ICON.arrow}</button></div>`, "oo-eye");
    el.querySelector("[data-close]").onclick = () => go("gym");
    el.querySelector("[data-go]").onclick = () => ooRun({ label: "Pairs", total: OO_ROUNDS, combo: true, cls: "oo-pairsrun", onQuit: () => go("gym"),
      gen: k => {
        // a newly opened variant arrives first, at an easy ratio; the rest mix the open ones as the set breathes
        const v = fresh && k === 0 ? fresh : ooPick(open, Math.random);
        return { kind: "pairs", variant: v.id, tier: fresh && k === 0 ? "easy" : OO_BREATH[k % OO_BREATH.length], record: false, hold: true };
      },
      onEnd: s => {
        pr.n = (pr.n || 0) + 1; const pb = s.hits > (pr.best || 0); pr.best = Math.max(pr.best || 0, s.hits); save();
        const nx = OO_PAIR_VARIANTS.find(v => v.at === pr.n);
        ooResults({ title: "Painters' pairs", s, finish: s.hits >= OO_PASS, stars: [s.hits >= OO_PASS, s.hits >= 5, s.hits === 6].map(Number), got: [1, 1, 1], pb, next: null,
          again: ooPairs, score: `${s.hits} of ${s.total} right`, back: "Back to Train", onBack: () => go("gym"), unlockLine: nx ? nx.news : null });
      } });
  });
}
