"use strict";
// Taste tests: find your favorite color, or your favorite palette.
// Round 1 is a 16-way tournament of full-screen duels. Round 2 is an "eye exam for taste" (an optometrist's
// "better 1 or 2?"): a few A/B picks nudge the winner lighter or darker, softer or bolder, warmer or cooler.
// Every pick is kept, so the result can describe the taste behind it.

const WARM = [0, Math.cos(60 * Math.PI / 180), Math.sin(60 * Math.PI / 180)];   // the orange direction in CIELAB a*b*
const warmth = hex => { const [, a, b] = lab(hex); return a * WARM[1] + b * WARM[2]; };
const shiftLab = (hex, dL = 0, dC = 1, dW = 0) => { let [L, a, b] = lab(hex); a *= dC; b *= dC; return labHex(...tame([clamp(L + dL, 2, 98), a + WARM[1] * dW, b + WARM[2] * dW])); };
const avgOf = (list, f) => list.reduce((s, x) => s + f(x), 0) / Math.max(list.length, 1);

const FAV_SEEDS = ["Crimson", "Coral", "Tangerine", "Gold", "Lime", "Emerald", "Teal", "Sky blue", "Cobalt", "Indigo", "Violet", "Magenta", "Baby pink", "Rust", "Sage", "Charcoal"];
function palettePool() {
  const g = graph(), byId = id => g.nodes.get(id);
  const fromPainting = id => { const p = byId(id); return p && !p.stub ? { kind: "painting", title: p.title, by: p.artist, id, cols: p.palette.slice(0, 5).map(c => c.h) } : null; };
  const paintings = ["painting-starry-night", "painting-great-wave", "painting-water-lilies", "painting-the-kiss", "painting-mona-lisa", "painting-the-scream", "painting-pearl-earring", "painting-composition-vii"].map(fromPainting).filter(Boolean);
  const harm = (title, base, degs, dL = 0, dC = 1) => ({ kind: "harmony", title, cols: [base, ...degs.map(d => rotateHue(base, d))].map(h => shiftLab(h, dL, dC)) });
  const made = [
    harm("Pastel analogous", "#F4A6B8", [-25, 25, -50, 50], 6, .7), harm("Earth and clay", "#B5653A", [20, -15, 40, 180], -6, .7),
    harm("Neon triad", "#FF2E88", [120, 240, 60, 180], 0, 1), harm("Midnight monochrome", "#1C2B5A", [0, 0, 8, -8], 0, 1),
    harm("Sunset", "#F28500", [-20, -45, 20, 200], 0, .95), harm("Sage and stone", "#9CAF88", [30, -30, 160, 0], 0, .55),
    harm("Sea glass", "#5FB8A8", [-25, 25, 160, -50], 8, .7), harm("Royal jewel tones", "#5A2D8C", [120, 240, 60, 300], -8, 1),
  ];
  // monochrome entries need lightness steps, not hue steps
  made[3].cols = [-18, -8, 0, 14, 30].map(d => shiftLab("#1C2B5A", d + 12, 1));
  made.forEach(p => p.cols.sort((a, b) => lab(b)[0] - lab(a)[0]));
  return shuffle([...paintings, ...made]).slice(0, 16);
}

function tasteIntro(kind) {
  const isPal = kind === "palette";
  const prev = isPal ? palettePool().slice(0, 6) : FAV_SEEDS.map(n => BYNAME.get(n.toLowerCase())).filter(Boolean);
  const el = show(`
    <header class="deck-top"><button class="icon-btn" data-close aria-label="Close">${ICON.x}</button><span class="eyebrow" style="flex:1">A taste test · two minutes</span></header>
    <div class="t-prev">${isPal ? prev.map(p => `<span class="t-pal">${p.cols.map(c => `<i style="--c:${c}"></i>`).join("")}</span>`).join("") : prev.map((c, k) => `<i style="--c:${c.h};--k:${k}"></i>`).join("")}</div>
    <p class="eyebrow kick">${isPal ? "Sixteen palettes · nine paintings and harmonies" : "Sixteen colors · then an eye exam for your taste"}</p>
    <h1 class="t-title">Find your <em>${isPal ? "palette" : "color"}</em></h1>
    <p class="tab-sub">${isPal ? "Palettes go head to head. Pick the one you'd rather live with. Where each came from stays hidden until the end." : "Colors go head to head. Tap the one you like more. Then a few “better 1 or 2?” picks tune the winner to one exact shade."}</p>
    <button class="btn" data-go style="margin-top:26px">Begin ${ICON.arrow}</button>
  `, "taste");
  el.querySelector("[data-close]").onclick = () => history.length && S.tab ? go(S.tab) : go("explore");
  el.querySelector("[data-go]").onclick = () => tasteRun(kind);
}

// one engine for both: a bracket, then the eye exam, then the result
function tasteRun(kind) {
  const isPal = kind === "palette";
  let entrants = isPal ? palettePool() : shuffle(FAV_SEEDS.map(n => BYNAME.get(n.toLowerCase())).filter(Boolean).map(c => ({ title: c.n, cols: [c.h] })));
  const picks = [];                     // [winner, loser] pairs of entries
  let round = entrants, next = [], i = 0, examStep = 0, champ = null, current = null;
  const ROUND_NAME = n => n === 16 ? "Round of 16" : n === 8 ? "Quarter-finals" : n === 4 ? "Semi-finals" : "Final";
  // eye exam axes: label, two variants of the current entry
  const AXES = [["lightness", e => [-10, 10].map(d => mapCols(e, c => shiftLab(c, d)))], ["strength", e => [.72, 1.28].map(k => mapCols(e, c => shiftLab(c, 0, k)))],
    ["temperature", e => [-12, 12].map(w => mapCols(e, c => shiftLab(c, 0, 1, w)))], ["lightness, finer", e => [-5, 5].map(d => mapCols(e, c => shiftLab(c, d)))],
    ["strength, finer", e => [.86, 1.14].map(k => mapCols(e, c => shiftLab(c, 0, k)))], ["temperature, finer", e => [-6, 6].map(w => mapCols(e, c => shiftLab(c, 0, 1, w)))]];
  if (isPal) AXES.splice(3, 0, ["contrast", e => [.8, 1.25].map(k => { const m = avgOf(e.cols, c => lab(c)[0]); return mapCols(e, c => shiftLab(c, (lab(c)[0] - m) * (k - 1))); })]);
  function mapCols(e, f) { return { ...e, cols: e.cols.map(f), tuned: true }; }

  const el = show(`
    <header class="deck-top"><button class="icon-btn" data-close aria-label="Close">${ICON.x}</button><div class="segs" id="tsegs"></div><span class="left mono" id="tleft"></span></header>
    <div class="t-head"><p class="eyebrow" id="tround"></p><h2 id="tq"></h2></div>
    <div class="t-duel" id="tduel"></div>
  `, "fixed taste-run");
  el.querySelector("[data-close]").onclick = () => go(S.tab || "explore");
  const duel = el.querySelector("#tduel"), q = el.querySelector("#tq"), rnd = el.querySelector("#tround"), segs = el.querySelector("#tsegs");
  const total = 15 + AXES.length;
  segs.innerHTML = Array.from({ length: total }, () => `<i style="--c:var(--ink)"></i>`).join("");
  let done = 0;
  const face = (e, n) => isPal
    ? `<span class="t-stripes">${e.cols.map(c => `<i style="--c:${c}"></i>`).join("")}</span><em class="t-n">${n}</em>`
    : `<span class="t-plate" style="--c:${e.cols[0]}"></span><em class="t-n" data-ink="${ink(e.cols[0])}">${n}</em>`;
  function ask(a, b, label, question, onPick) {
    rnd.textContent = label; q.textContent = question;
    duel.innerHTML = `<button class="t-half" data-k="0">${face(a, 1)}</button><button class="t-half" data-k="1">${face(b, 2)}</button>`;
    let locked = false;
    duel.querySelectorAll(".t-half").forEach(btn => btn.onclick = () => {
      if (locked) return; locked = true; buzz(8);
      const k = +btn.dataset.k;
      btn.classList.add("win"); duel.querySelectorAll(".t-half")[1 - k].classList.add("lose");
      segs.children[done++].classList.add("on");
      later(() => onPick(k), 520);
    });
  }
  function bracket() {
    if (i >= round.length) { round = next; next = []; i = 0; }
    if (round.length === 1) { champ = round[0]; current = champ; return exam(); }
    const a = round[i], b = round[i + 1];
    ask(a, b, `${ROUND_NAME(round.length)} · ${i / 2 + 1} of ${round.length / 2}`, isPal ? "Which palette would you rather live with?" : "Which color do you like more?",
      k => { const w = k ? b : a, l = k ? a : b; picks.push([w, l]); next.push(w); i += 2; bracket(); });
  }
  function exam() {
    if (examStep >= AXES.length) return result();
    const [axis, make] = AXES[examStep], [a, b] = make(current);
    ask(a, b, `Eye exam · ${axis}`, "Better 1, or 2?", k => { current = k ? b : a; examStep++; exam(); });
  }
  function result() {
    // taste profile from every bracket pick: how winners differ from losers
    const d = f => avgOf(picks, ([w, l]) => avgOf(w.cols, f) - avgOf(l.cols, f));
    const prof = { warm: d(warmth), light: d(c => lab(c)[0]), bold: d(c => lch(c)[1]) };
    tasteResult(kind, champ, current, prof, picks);
  }
  bracket();
}

function tasteResult(kind, champ, final, prof, picks) {
  const isPal = kind === "palette";
  const named = final.cols.map(h => { const [c, dE] = nearestColors(h, 1)[0]; return { h, n: c.n, dE }; });
  const scale = (v, lo, hi, a, b) => { const t = clamp(.5 + v / (2 * Math.max(Math.abs(lo), Math.abs(hi))), .04, .96); return `<div class="t-scale"><span>${a}</span><i><b style="left:${(t * 100).toFixed(0)}%"></b></i><span>${b}</span></div>`; };
  if (isPal) { S.palettes = S.palettes || []; S.palettes.unshift({ cols: final.cols, from: champ.title, at: today() }); S.palettes = S.palettes.slice(0, 40); }
  else S.fav = { h: final.cols[0], n: named[0].n, at: today() };
  save();
  const hero = isPal ? `<div class="t-res-pal">${named.map(x => `<i style="--c:${x.h}"><span data-ink="${ink(x.h)}">${esc(x.n)}<em>${x.h}</em></span></i>`).join("")}</div>`
    : `<div class="t-res-col" style="--c:${final.cols[0]}" data-ink="${ink(final.cols[0])}"><span class="eyebrow">Your color</span><h1>${esc(named[0].n)}<em>-ish</em></h1><span class="mono">${final.cols[0]} · ${closeness(named[0].dE)} to ${esc(named[0].n)}</span></div>`;
  const el = show(`
    <header class="art-top"><button class="icon-btn glass" data-close aria-label="Close">${ICON.x}</button><button class="glass-pill" data-share>${ICON.share}<span>Share</span></button></header>
    ${hero}
    ${isPal ? `<p class="eyebrow kick">Your palette</p><h1 class="z-title">${champ.kind === "painting" ? `From <em>${esc(champ.title)}</em>` : esc(champ.title)}</h1><p class="z-meta">${champ.kind === "painting" ? `${esc(champ.by)} · tuned to your eye` : "A classic harmony, tuned to your eye"}</p>` : `<p class="z-meta" style="margin-top:14px">It beat fifteen others: last up was ${esc(picks[picks.length - 1][1].title)} in the final.</p>`}
    <div class="sec-head"><b>Your taste</b><span>from ${picks.length} duels</span></div>
    <div class="t-prof">${scale(prof.warm, -20, 20, "Cool", "Warm")}${scale(prof.light, -25, 25, "Dark", "Light")}${scale(prof.bold, -30, 30, "Muted", "Bold")}</div>
    ${isPal ? `<div class="sec-head"><b>Codes</b><span>tap to copy all</span></div><button class="t-codes mono" data-copy="${final.cols.join(" ")}">${final.cols.join("  ")}</button>` : ""}
    <p class="p-body">${linkText("Why we like what we like: one well-tested idea, the ecological valence theory (Palmer and Schloss, 2010), says we tend to like the colors of things we like, such as clear [[Sky blue|skies]] and ripe fruit, and dislike the colors of things we don't. Taste also shifts with mood and context, so try again another day.")}</p>
    <div class="stack" style="margin-top:22px">
      ${isPal ? "" : `<button class="btn" data-page>Read about ${esc(named[0].n)} ${ICON.arrow}</button>`}
      <button class="btn" data-again>${isPal ? "Find another palette" : "Try again"} ${ICON.arrow}</button>
    </div>
  `, "article taste-res");
  wireLinks(el);
  el.querySelector("[data-close]").onclick = () => go(S.tab || "explore");
  el.querySelector("[data-again]").onclick = () => tasteRun(kind);
  const pg = el.querySelector("[data-page]"); if (pg) pg.onclick = () => closeup(graph().resolve(named[0].n));
  const cp = el.querySelector("[data-copy]"); if (cp) cp.onclick = () => { try { navigator.clipboard.writeText(cp.dataset.copy); toast("Copied the codes"); } catch (e) {} };
  el.querySelector("[data-share]").onclick = () => shareTaste(isPal, named, isPal ? champ.title : named[0].n);
}

// a 1080x1350 share card for either result
function shareTaste(isPal, named, title) {
  const W = 1080, H = 1350, cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const x = cv.getContext("2d");
  x.fillStyle = "#0E0D0B"; x.fillRect(0, 0, W, H);
  const top = 70, plateH = 880, w = (W - 140) / named.length;
  named.forEach((c, i) => { x.fillStyle = c.h; x.fillRect(70 + i * w, top, Math.ceil(w) - (isPal ? 4 : 0), plateH); });
  x.fillStyle = "#9A958A"; x.font = "500 28px 'Geist Mono', monospace"; x.fillText(isPal ? "MY PALETTE · COLORHUB" : "MY COLOR · COLORHUB", 72, top + plateH + 70);
  x.fillStyle = "#ECE8DF"; x.font = "400 104px 'Instrument Serif', Georgia, serif"; x.fillText(isPal ? title : `${title}-ish`, 68, top + plateH + 190);
  x.fillStyle = "#9A958A"; x.font = "500 30px 'Geist Mono', monospace"; x.fillText(named.map(c => c.h).join("  "), 72, top + plateH + 260);
  cv.toBlob(async blob => {
    const file = new File([blob], "colorhub-taste.png", { type: "image/png" }), text = isPal ? `My palette: ${title}` : `My color: ${title}-ish`;
    try { if (navigator.canShare && navigator.canShare({ files: [file] })) return await navigator.share({ files: [file], text }); } catch (e) { if (e && e.name === "AbortError") return; }
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = file.name; a.click(); toast("Saved the card");
  }, "image/png");
}
