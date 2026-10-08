"use strict";
// The Mix (ROADMAP §20 "Combinations"), unlocked after level 10 of Odd one out, plus "Whose palette?".
//   What changed?  (odd + memory: change blindness)      Out of order (odd + rearrange: find it, drag it home)
//   Rebuild        (memory + rearrange)                  Was it there? (memory + odd)
//   Imposter       (names + odd: one label is wrong)     Color n-back (memory)
//   Whose palette? (five colors from a painter's work; provably solvable rounds from tools/whose_build.js)
// Each game is one renderer, OO_MIXPLAY[id](ui, it) -> Promise<{ ok, ms, act, right, picked, line }>, used by the
// Mix sets here, by ooPlaySet (any set of colors) and by GAME_STEPS (js/games/steps.js).

const OO_MIXF = { changed: 1.5, outoforder: .8, rebuild: 1.3, wasthere: 1.3, nback: 1.3, imposter: 1 };
const ooPct = x => `<b class="mono">${pctFmt(x)}</b>`;
// a board of plain tiles from colors (for What changed?)
const ooGridRound = (n, colors) => { const g = ooCells("grid", n, Math.random); return { b: "grid", v: "one", cells: g.cells, cols: n, aspect: 1, colors, ans: [] }; };
const ooChips = (hexes, cls = "") => `<div class="oo-chips ${cls}">${hexes.map((h, i) => `<button class="oo-chip" data-i="${i}" style="--c:${h}" aria-label="Color ${i + 1}"></button>`).join("")}</div>`;

const OO_MIXPLAY = {
  // ---------- What changed? See the board, a blink, one tile changed ----------
  changed(ui, it) {
    return new Promise(resolve => {
      const n = it.n || 4, rd = ooChangedRound(n, it.d, it.rnd || Math.random, it.set);
      if (!rd) return resolve({ ok: 0, ms: 0, act: 0, line: "Couldn't draw this one." });
      const look = it.look || 1800, gap = 450;
      ui.q.textContent = "Look at the board";
      ui.stage.innerHTML = ooBoardHTML(ooGridRound(n, rd.before));
      const board = ui.stage.querySelector(".oo-board"), tiles = [...board.querySelectorAll(".oo-t")];
      tiles.forEach(t => t.disabled = true);
      ui.foot.innerHTML = `<i class="oo-bar" style="--t:${look}ms"></i>`;
      requestAnimationFrame(() => { const b = ui.foot.querySelector(".oo-bar"); if (b) b.classList.add("go"); });
      let t0 = 0, done = false;
      later(() => { board.classList.add("oo-blank"); }, look);
      later(() => {
        tiles.forEach((t, i) => { t.style.setProperty("--c", rd.after[i]); t.disabled = false; });
        board.classList.remove("oo-blank"); ui.q.textContent = "Which tile changed?"; ui.foot.innerHTML = ""; t0 = performance.now();
      }, look + gap);
      tiles.forEach((t, i) => t.onclick = () => {
        if (done) return; done = true;
        const ok = i === rd.at; tiles.forEach(x => x.disabled = true);
        tiles[rd.at].classList.add("ring"); if (!ok) t.classList.add("miss");
        buzz(ok ? 10 : [10, 40, 10]); if (ok) ooRipple(board, t);
        const dir = ooDirWord(rd.before[rd.at], rd.after[rd.at]);
        resolve({ ok: ok ? 1 : 0, ms: performance.now() - t0, act: rd.act, right: rd.after[rd.at], picked: ok ? null : rd.before[rd.at], base: rd.before[rd.at], dir,
          line: ok ? `Right: it turned ${dir}, ${ooPct(rd.act)} different.` : `The ringed tile turned ${dir}, ${ooPct(rd.act)} different.` });
      });
    });
  },

  // ---------- Out of order: a gradient with one misplaced tile. Find it, then drag it home ----------
  outoforder(ui, it) {
    return new Promise(resolve => {
      const k = it.k || 7, rd = ooOrderRound(k, it.d, it.rnd || Math.random, it.set);
      let order = rd.strip.slice(), t0 = performance.now(), phase = 1, found = false, foundMs = 0;
      ui.q.textContent = "Which tile is out of place?";
      ui.stage.innerHTML = `<div class="oo-ostrip" style="--k:${k}">${order.map((h, i) => `<button class="oo-oc" data-h="${h}" style="--c:${h};--y:${i}"></button>`).join("")}</div>`;
      const box = ui.stage.querySelector(".oo-ostrip"), chips = [...box.querySelectorAll(".oo-oc")];
      const place = () => chips.forEach(c => c.style.setProperty("--y", order.indexOf(c.dataset.h)));
      const moved = chips.find(c => c.dataset.h === rd.right[rd.from]);
      const done = ok => {
        chips.forEach(c => c.disabled = true); box.classList.add("done");
        const home = order.every((h, i) => h === rd.right[i]);
        if (!home) { order = rd.right.slice(); place(); }
        moved.classList.add(found && home ? "ring" : "miss");
        buzz(ok ? 10 : [10, 40, 10]); if (ok) ooRipple(box, moved);
        resolve({ ok: ok ? 1 : 0, ms: foundMs || performance.now() - t0, act: rd.step, right: rd.right[rd.from], picked: null,
          line: ok ? `Home. Neighbors here are ${ooPct(rd.step)} apart.` : found ? `Found it; its home is shown. Neighbors are ${ooPct(rd.step)} apart.` : `The ringed tile was out of place. Neighbors are ${ooPct(rd.step)} apart.` });
      };
      chips.forEach(c => c.onclick = () => {
        if (phase !== 1) return;
        if (c !== moved) { c.classList.add("miss"); return done(false); }
        found = true; foundMs = performance.now() - t0; phase = 2; buzz(8);
        c.classList.add("sel"); ui.q.textContent = "Now drag it home";
        ui.foot.innerHTML = `<p class="oo-fb">Drag the tile up or down to where it belongs.</p>`;
        // drag (pointer events; the other chips make room as it moves)
        let startY = 0, startIdx = 0, h = 0;
        c.onpointerdown = e => { e.preventDefault(); c.setPointerCapture(e.pointerId); startY = e.clientY; startIdx = order.indexOf(c.dataset.h); h = c.getBoundingClientRect().height; c.classList.add("drag"); };
        c.onpointermove = e => {
          if (!c.classList.contains("drag")) return;
          const dy = e.clientY - startY, to = clamp(Math.round(startIdx + dy / h), 0, k - 1);
          c.style.setProperty("--dy", dy + "px");
          const rest = order.filter(x => x !== c.dataset.h); rest.splice(to, 0, c.dataset.h);
          chips.forEach(o => { if (o !== c) o.style.setProperty("--y", rest.indexOf(o.dataset.h)); });
          c.dataset.to = to;
        };
        c.onpointerup = () => {
          if (!c.classList.contains("drag")) return;
          c.classList.remove("drag"); c.style.removeProperty("--dy");
          const to = +(c.dataset.to != null ? c.dataset.to : startIdx);
          order = order.filter(x => x !== c.dataset.h); order.splice(to, 0, c.dataset.h); place(); buzz(6);
          if (to !== startIdx || c.dataset.to != null) later(() => done(order.every((x, i) => x === rd.right[i])), 260);
        };
      });
    });
  },

  // ---------- Rebuild: see a gradient for 2 s, it scrambles, rebuild it from memory ----------
  rebuild(ui, it) {
    return new Promise(resolve => {
      const k = it.k || 5, rnd = it.rnd || Math.random, right = ooGradStrip(k, it.d, rnd, it.set && it.set.length ? ooPick(it.set, rnd) : null);
      let tray = ooShuf(right, rnd); while (k > 2 && tray.every((h, i) => h === right[i])) tray = ooShuf(right, rnd);
      const slots = Array(k).fill(null);
      ui.q.textContent = "Remember the order";
      ui.stage.innerHTML = `<div class="oo-rb"><div class="oo-slots">${right.map(h => `<i class="oo-slot" style="--c:${h}"></i>`).join("")}</div><div class="oo-tray"></div></div>`;
      const slotEls = [...ui.stage.querySelectorAll(".oo-slot")], trayEl = ui.stage.querySelector(".oo-tray");
      ui.foot.innerHTML = `<i class="oo-bar" style="--t:2000ms"></i>`;
      requestAnimationFrame(() => { const b = ui.foot.querySelector(".oo-bar"); if (b) b.classList.add("go"); });
      let t0 = 0;
      const draw = () => {
        slotEls.forEach((s, i) => { s.style.setProperty("--c", slots[i] || "transparent"); s.classList.toggle("empty", !slots[i]); s.onclick = () => { if (!slots[i]) return; tray.push(slots[i]); slots[i] = null; buzz(6); draw(); }; });
        trayEl.innerHTML = tray.map((h, i) => `<button class="oo-chip" data-i="${i}" style="--c:${h}"></button>`).join("");
        trayEl.querySelectorAll(".oo-chip").forEach(b => b.onclick = () => {
          const at = slots.indexOf(null); if (at < 0) return;
          slots[at] = tray[+b.dataset.i]; tray.splice(+b.dataset.i, 1); buzz(6); draw();
          if (!slots.includes(null)) {
            const okN = slots.filter((h, i) => h === right[i]).length, ok = okN === k;
            slotEls.forEach((s, i) => { s.classList.add(slots[i] === right[i] ? "ring" : "miss"); s.onclick = null; });
            buzz(ok ? 10 : [10, 40, 10]); if (ok) ooRipple(ui.stage.querySelector(".oo-rb"), slotEls[k - 1]);
            const wrong = slots.findIndex((h, i) => h !== right[i]);
            resolve({ ok: ok ? 1 : 0, ms: performance.now() - t0, act: it.d, right: wrong >= 0 ? right[wrong] : null, picked: wrong >= 0 ? slots[wrong] : null,
              line: ok ? `All ${k} in place. Each step was ${ooPct(it.d)}.` : `${okN} of ${k} in place. Each step was ${ooPct(it.d)}.` });
          }
        });
      };
      later(() => { slotEls.forEach(s => s.classList.add("empty")); ui.q.textContent = "Put them back in order"; ui.foot.innerHTML = ""; t0 = performance.now(); draw(); }, 2000);
    });
  },

  // ---------- Was it there? Four colors, then five: tap the newcomer ----------
  wasthere(ui, it) {
    return new Promise(resolve => {
      const rd = ooWasRound(it.d, it.rnd || Math.random, it.set);
      if (!rd) return resolve({ ok: 0, ms: 0, act: 0, line: "Couldn't draw this one." });
      ui.q.textContent = "Remember these four";
      ui.stage.innerHTML = ooChips(rd.set, "four");
      ui.foot.innerHTML = `<i class="oo-bar" style="--t:2200ms"></i>`;
      requestAnimationFrame(() => { const b = ui.foot.querySelector(".oo-bar"); if (b) b.classList.add("go"); });
      let t0 = 0;
      later(() => { ui.stage.innerHTML = `<div class="oo-chips four oo-gone">${rd.set.map(() => `<i class="oo-chip"></i>`).join("")}</div>`; ui.q.textContent = "Hold them in mind"; ui.foot.innerHTML = ""; }, 2200);
      later(() => {
        ui.q.textContent = "Which one is new?";
        ui.stage.innerHTML = ooChips(rd.opts, "five"); t0 = performance.now();
        const chips = [...ui.stage.querySelectorAll(".oo-chip")];
        chips.forEach((c, i) => c.onclick = () => {
          chips.forEach(x => x.disabled = true);
          const ok = i === rd.fresh; chips[rd.fresh].classList.add("ring"); if (!ok) c.classList.add("miss");
          buzz(ok ? 10 : [10, 40, 10]); if (ok) ooRipple(ui.stage.querySelector(".oo-chips"), c);
          resolve({ ok: ok ? 1 : 0, ms: performance.now() - t0, act: rd.act, right: rd.opts[rd.fresh], picked: ok ? null : rd.opts[i],
            line: ok ? `Right. It was ${ooPct(rd.act)} from one you'd seen.` : `The ringed one was new, ${ooPct(rd.act)} from one you'd seen.` });
        });
      }, 3400);
    });
  },

  // ---------- Imposter: four swatches with names, one name is on the wrong color ----------
  imposter(ui, it) {
    return new Promise(resolve => {
      const rnd = it.rnd || Math.random, all = (typeof ALL !== "undefined" ? ALL : []).filter(c => c.h && c.n);
      const near = h => all.reduce((b, c) => { const d = de2000(h, c.h); return !b || d < b.d ? { c, d } : b; }, null);
      let pool = it.set && it.set.length ? [...new Set(it.set.map(h => near(h)).filter(Boolean).map(x => x.c))] : null;
      if (!pool || pool.length < 4) pool = all;
      // four colors far enough apart to tell, then one wrong label from a nearby name
      let four = [];
      for (let t = 0; t < 200 && four.length < 4; t++) { const c = ooPick(pool, rnd); if (four.every(x => x !== c && de2000(x.h, c.h) > 12)) four.push(c); }
      if (four.length < 4) four = ooShuf(all, rnd).slice(0, 4);
      const at = Math.floor(rnd() * 4), target = clamp(it.d * 3, 6, 24);
      const cand = all.filter(c => !four.includes(c)).map(c => ({ c, d: de2000(c.h, four[at].h) })).filter(x => x.d >= 5).sort((a, b) => Math.abs(a.d - target) - Math.abs(b.d - target));
      const wrong = cand[0];
      const labels = four.map((c, i) => i === at ? wrong.c.n : c.n);
      ui.q.textContent = "Which name is on the wrong color?";
      ui.stage.innerHTML = `<div class="oo-imp">${four.map((c, i) => `<button class="oo-ic" data-i="${i}"><i style="--c:${c.h}"></i><b>${esc(labels[i])}</b></button>`).join("")}</div>`;
      const t0 = performance.now(), btns = [...ui.stage.querySelectorAll(".oo-ic")];
      btns.forEach((b, i) => b.onclick = () => {
        btns.forEach(x => x.disabled = true);
        const ok = i === at; btns[at].classList.add("ring"); if (!ok) b.classList.add("miss");
        buzz(ok ? 10 : [10, 40, 10]);
        resolve({ ok: ok ? 1 : 0, ms: performance.now() - t0, act: wrong.d, right: four[at].h, picked: ok ? null : four[i].h, noModel: true,
          line: `${ok ? "Right: t" : "T"}hat swatch is <b>${esc(four[at].n)}</b>, not ${esc(wrong.c.n)} (${ooPct(wrong.d)} apart).` });
      });
    });
  },

  // ---------- Color n-back: tap when a color matches the one two back ----------
  nback(ui, it) {
    return new Promise(resolve => {
      const len = it.len || 12, nb = ooNbackSeq(len, it.d, it.rnd || Math.random, it.set), on = it.on || 1100, off = 350;
      ui.q.textContent = "Same as two back?";
      ui.stage.innerHTML = `<div class="oo-nb"><i class="oo-nbc"></i><p class="mono oo-nbn"></p></div>`;
      ui.foot.innerHTML = `<button class="oo-pill big" data-same disabled>Same as two back</button>`;
      const chip = ui.stage.querySelector(".oo-nbc"), num = ui.stage.querySelector(".oo-nbn"), btn = ui.foot.querySelector("[data-same]");
      const said = Array(len).fill(false);
      let i = -1, t0 = performance.now();
      btn.onclick = () => { if (i >= 2 && !said[i]) { said[i] = true; btn.classList.add("on"); buzz(6); } };
      const step = () => {
        i++;
        if (i >= len) return score();
        chip.style.setProperty("--c", nb.seq[i]); chip.classList.remove("gone"); num.textContent = `${i + 1} / ${len}`;
        btn.disabled = i < 2; btn.classList.remove("on");
        later(() => chip.classList.add("gone"), on);
        later(step, on + off);
      };
      const score = () => {
        btn.disabled = true;
        let hit = 0, tgt = 0, fa = 0, lureFA = null, missT = null;
        for (let k = 2; k < len; k++) {
          if (nb.kind[k] === "same") { tgt++; if (said[k]) hit++; else if (!missT) missT = k; }
          else if (said[k]) { fa++; if (nb.kind[k] === "lure" && !lureFA) lureFA = k; }
        }
        const right = len - 2 - (tgt - hit) - fa, ok = right / (len - 2) >= .8;
        buzz(ok ? 10 : [10, 40, 10]);
        ui.stage.innerHTML = `<div class="oo-nbsum">${nb.seq.map((h, k) => `<span class="${k < 2 ? "" : nb.kind[k] === "same" ? (said[k] ? "hit" : "miss") : said[k] ? "fa" : ""}"><i style="--c:${h}"></i></span>`).join("")}</div>`;
        resolve({ ok: ok ? 1 : 0, ms: performance.now() - t0, act: it.d, right: lureFA ? nb.seq[lureFA - 2] : null, picked: lureFA ? nb.seq[lureFA] : null,
          line: `${hit} of ${tgt} matches caught${fa ? `, ${fa} false alarm${fa > 1 ? "s" : ""}` : ""}. Look-alikes were ${ooPct(it.d)} away.` });
      };
      later(step, 400);
    });
  },

  // ---------- Whose palette? Five colors from one painter's work; three painters, each with a strip ----------
  whose(ui, it) {
    return new Promise(resolve => {
      const W = window.OO_WHOSE, rnd = it.rnd || Math.random;
      if (!W) return resolve({ ok: 0, ms: 0, act: 0, line: "The painter data didn't load." });
      const rd = W.rounds[Math.floor(rnd() * W.rounds.length)], P = i => W.painters[i];
      const hexes = s => (s.match(/.{6}/g) || []).map(x => "#" + x);
      const alts = ooShuf(rd[3], rnd).slice(0, 2);
      const opts = ooShuf([{ i: rd[0], strip: hexes(rd[2]), right: 1 }, ...alts.map(a => ({ i: a, strip: hexes(P(a)[5]) }))], rnd);
      ui.q.textContent = "Whose palette is this?";
      ui.stage.innerHTML = `<div class="oo-wh"><div class="oo-whp">${hexes(rd[1]).map(h => `<i style="--c:${h}"></i>`).join("")}</div>
        <div class="oo-who">${opts.map((o, k) => `<button class="oo-wo" data-k="${k}"><b>${esc(P(o.i)[1])}</b><span class="oo-ws">${o.strip.slice(0, 12).map(h => `<i style="--c:${h}"></i>`).join("")}</span></button>`).join("")}</div></div>`;
      const t0 = performance.now(), btns = [...ui.stage.querySelectorAll(".oo-wo")];
      btns.forEach((b, k) => b.onclick = () => {
        btns.forEach(x => x.disabled = true);
        const ok = !!opts[k].right, ri = opts.findIndex(o => o.right); btns[ri].classList.add("ring"); if (!ok) b.classList.add("miss");
        buzz(ok ? 10 : [10, 40, 10]);
        const p = P(rd[0]);
        resolve({ ok: ok ? 1 : 0, ms: performance.now() - t0, act: 0, noModel: true, hold: true,
          line: `${ok ? "Right: " : ""}<b>${esc(p[1])}</b>, from ${p[2]} paintings here. ${esc(p[4])}` });
      });
    });
  },
};

// ---------- a Mix set: six rounds of one game, or one of each ("set") ----------
function ooMixIt(id, k, o = {}) {
  const m = ooS().model, g = OO_MIX.find(x => x.id === id) || {}, judg = g.judg;
  const novel = (ooS().seen["mix/" + id] || 0) < 2, tier = ooTierAt(k, novel);
  const th = judg ? ooTheta(m, judg, null) : ooTheta(m, "hue", null);
  const d = clamp(th * OO_TIER[tier] * (OO_MIXF[id] || 1), OO_MIN, OO_MAX);
  return { kind: id, d, judg, vf: OO_MIXF[id] || 1, set: o.set || null, rnd: Math.random, record: !!judg, g: id === "changed" ? 1 / 16 : id === "wasthere" ? .2 : 0, n: tier === "intro" ? 3 : 4 };
}
function ooPlayMix(id, opts = {}) {
  if (!S.scr && !ooShotMode() && typeof screenCheck === "function") return screenCheck(() => ooPlayMix(id, opts));
  const order = id === "set" ? ooShuf(OO_MIX.map(m => m.id), Math.random) : null, name = id === "set" ? "Mixed set" : (OO_MIX.find(m => m.id === id) || {}).name || "Mix";
  ooRun({ label: opts.title ? (opts.title.length > 14 ? opts.title.slice(0, 13) + "…" : opts.title) : "Mix", total: OO_ROUNDS, combo: true, onQuit: opts.onQuit || (() => ooMap()),
    gen: k => { const g = order ? order[k % order.length] : id, it = ooMixIt(g, k, opts); ooS().seen["mix/" + g] = (ooS().seen["mix/" + g] || 0) + 1; if (g === "nback") it.hold = true; return it; },
    onEnd: s => {
      const st = ooS(), old = (st.mix[id] || {}).stars || [0, 0, 0], finish = s.hits >= OO_PASS;
      const got = [finish, finish && s.med != null && s.med <= OO_FAST_MS * 1.6, finish && !s.hint];
      const stars = got.map((x, i) => x || old[i] ? 1 : 0), pb = s.pts > ((st.mix[id] || {}).best || 0);
      if (!opts.set) st.mix[id] = { stars, best: Math.max(s.pts, (st.mix[id] || {}).best || 0) };
      save();
      ooResults({ title: opts.title ? `${opts.title} · ${name}` : `The Mix · ${name}`, s, finish, stars, got, pb, next: null, again: () => ooPlayMix(id, opts), score: `${s.hits} of ${s.total} right`,
        back: opts.onQuit ? "Done" : null, onBack: opts.onQuit || null });
    } });
}
// ---------- Whose palette? (its own little station; the data loads on first use) ----------
let OO_WHOSE_LOADING = null;
function ooWhoseLoad() {
  if (window.OO_WHOSE) return Promise.resolve(true);
  if (!OO_WHOSE_LOADING) OO_WHOSE_LOADING = new Promise(res => { const s = document.createElement("script"); s.src = "data/games/whose.js"; s.onload = () => res(true); s.onerror = () => { OO_WHOSE_LOADING = null; res(false); }; document.head.appendChild(s); });
  return OO_WHOSE_LOADING;
}
function ooWhose() {
  ooWhoseLoad().then(ok => {
    if (!ok) return toast("Couldn't load the painters");
    const el = show(`
      <header class="deck-top"><button class="icon-btn" data-close aria-label="Back">${ICON.back}</button></header>
      <h1 class="title-1 oo-title">Whose palette?</h1>
      <p class="lede">Five colors from one group of a painter's works. Pick the painter: each choice shows a strip of colors from their paintings.</p>
      <p class="fine">Every round is checked to be solvable: the five colors sit clearly nearer the right painter's strip than either other painter's, and the right strip never repeats a shown color. These are photographs of varnished paintings, so the colors are as photographed and lean brown. From ${OO_WHOSE.painters.length} painters with at least 12 paintings in the archive.</p>
      <div class="stack" style="margin-top:28px"><button class="btn" data-go>Play six rounds ${ICON.arrow}</button></div>`, "oo-eye");
    el.querySelector("[data-close]").onclick = () => go("gym");
    el.querySelector("[data-go]").onclick = () => ooRun({ label: "Painters", total: OO_ROUNDS, combo: true, cls: "oo-whose", onQuit: () => go("gym"),
      gen: () => ({ kind: "whose", record: false, hold: true }),
      onEnd: s => { const st = ooS(), best = Math.max(s.hits, (st.mix.whose || {}).best || 0); st.mix.whose = { best, stars: [s.hits >= OO_PASS, 0, 0].map(Number) }; save();
        ooResults({ title: "Whose palette?", s, finish: s.hits >= OO_PASS, stars: [s.hits >= OO_PASS ? 1 : 0, 0, 0], got: [1, 0, 0], pb: false, next: null, again: () => ooWhose(), score: `${s.hits} of ${s.total} painters` }); } });
  });
}
