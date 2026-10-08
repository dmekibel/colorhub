"use strict";
// Today's painting (#/challenge): one painting a day, the same for everyone, looked at five ways in about
// ninety seconds. It replaces the old grey-tile daily (its saves and streak carry over). Each round is a
// different way of seeing that one picture, judged only inside that one photograph, so varnish and museum
// cameras can't decide an answer:
//   1. the hidden color: a quiet color you'd overlook; tap where it lives
//   2. the focal color: name the color that pulls the eye (four nearby names, recall before reveal)
//   3. the true color of a spot: a ringed patch looks shifted by what surrounds it; pick its real color
//   4. its palette in order: four of its colors, ranked by how much canvas each covers
//   5. the decade
// Every round was measured offline from the painting's own pixels and had to pass a solvability gate
// (tools/daily_paint.py -> data/daily-paint.json + data/daily-paint/<shard>.json, ~300 days). The finish shows
// the painting whole, its palette as your grid (a ring for each round you got), one measured finding, and a
// spoiler-free share card (js/sharecard.js). Name today's color (#/daily, js/colordle.js) is its twin; both
// live in one "Today" row on Learn (dlTodayRow) and share one streak.

const CH_START = "2026-10-07";   // No. 1, for both dailies (the old grey-tile challenge's numbering, kept)
const chNumber = (k = today()) => { const [a, b] = [CH_START, k].map(x => { const [y, m, d] = x.split("-").map(Number); return Date.UTC(y, m - 1, d); }); return Math.round((b - a) / 864e5) + 1; };
// a small seeded generator (mulberry32), so every phone builds the same rounds (js/gym.js uses it too)
const seededRnd = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const chState = () => (S.challenge = S.challenge || {});
const chToday = () => chState()[today()];
// One streak for the daily ritual: a day counts when either daily was finished (old saves count too).
const dlPlayed = k => !!(chState()[k] || (S.daily && S.daily[k] && (S.daily[k].g ? S.daily[k].done : true)));
function chStreak() {
  let k = today(), n = 0;
  if (!dlPlayed(k)) k = addDays(k, -1);
  while (dlPlayed(k)) { n++; k = addDays(k, -1); }
  return n;
}
const dlStreakLine = () => { const n = chStreak(); return n > 1 ? `${n} days in a row. ` : ""; };
// The words you missed today, for a "Today's misses" Practice deck (prInstantDeck, when Practice has it):
// today's color if you didn't name it unaided, and the painting's focal color if you misnamed it.
function dlMisses(k = today()) {
  const out = [], d = S.daily && S.daily[k], p = chState()[k];
  if (d && d.g && d.done && (!d.ok || d.hint) && d.t) { const e = (CORE_NAMES || []).find(x => x.n === d.t); if (e) out.push({ n: e.n, h: e.h }); }
  if (p && p.focal && p.hits && p.hits[1] === false) out.push(p.focal);
  return out;
}

// ---------- the game set ----------
let DP_META = null;
const DP_SHARDS = new Map();
const dpGet = f => fetch(f + (typeof DATA_VER !== "undefined" && DATA_VER ? "?v=" + DATA_VER : "")).then(r => { if (!r.ok) throw new Error(f + " " + r.status); return r.json(); });
// today's painting (or any day's): the day number picks a place in the fixed schedule, which wraps around
function dpLoad(k = today()) {
  return (DP_META ? Promise.resolve(DP_META) : dpGet("data/daily-paint.json").then(m => (DP_META = m))).then(m => {
    const i = (((chNumber(k) - 1) % m.n) + m.n) % m.n, s = Math.floor(i / m.per);
    let p = DP_SHARDS.get(s);
    if (!p) { p = dpGet(`data/daily-paint/${s}.json`).catch(e => { DP_SHARDS.delete(s); throw e; }); DP_SHARDS.set(s, p); }
    return p.then(rows => rows[i % m.per]);
  });
}
const dpThumb = e => e.k === "f" ? e.img.replace(/\.jpg$/, "-thumb.jpg") : e.img;

// ---------- the rounds (pure; tools/daily_test.js runs them over every day in the set) ----------
const DP_ROUND_NAMES = ["Hidden", "Focal", "Spot", "Most canvas", "Decade"];
function dpGrid(e) { const b = atob(e.g), g = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) g[i] = b.charCodeAt(i); return g; }
// a tap (x, y in 0..1) finds the hidden color when it lands on, or one cell from, a cell where it's the main color
function dpHitHidden(e, x, y, grid = dpGrid(e)) {
  const cx = clamp(Math.floor(x * e.gw), 0, e.gw - 1), cy = clamp(Math.floor(y * e.gh), 0, e.gh - 1);
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const X = cx + dx, Y = cy + dy;
    if (X >= 0 && Y >= 0 && X < e.gw && Y < e.gh && grid[Y * e.gw + X] === e.hid) return true;
  }
  return false;
}
const dpShuffle = (a, rnd) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
// round 2: the focal color's own nearest name, and three neighbors from the same corner of the map (each at least
// 6 apart from the others, and each clearly further from the color than the answer is)
function dpFocalOptions(e, list, k) {
  const fh = e.pool[e.foc][0], near = nearestCore(fh, list, 50), ans = near[0];
  const out = [ans];
  for (const x of near.slice(1)) { if (x.de >= ans.de + 2 && out.every(o => de2000(o.h, x.h) >= 6)) out.push(x); if (out.length === 4) break; }
  return { hex: fh, ans: ans.n, opts: dpShuffle(out.map(o => ({ n: o.n, h: o.h })), seededRnd(dlHash("dp-focal" + k))) };
}
// round 3: the spot's true color, and three that are what an eye might see instead: pushed away from its
// surroundings (how simultaneous contrast usually misleads), pulled toward them, and one step on the other axis.
// Each about 8% different from the truth as drawn, and at least 5% from each other.
function dpSpotOptions(e, k) {
  const T = lab(e.spot.h), Su = lab(e.spot.s);
  let v = T.map((x, i) => x - Su[i]); const nv = Math.hypot(...v) || 1; v = v.map(x => x / nv);
  const C = Math.hypot(T[1], T[2]), cdir = C > 3 ? [0, T[1] / C, T[2] / C] : [0, .7071, .7071];
  const w = Math.abs(v[0]) > .6 ? cdir : [1, 0, 0];
  const along = (dir, want) => {
    let lo = 0, hi = 45, hex = e.spot.h;
    for (let it = 0; it < 24; it++) { const m = (lo + hi) / 2, h = labHex(T[0] + dir[0] * m, T[1] + dir[1] * m, T[2] + dir[2] * m); if (de2000(h, e.spot.h) < want) lo = m; else { hi = m; hex = h; } }
    return de2000(hex, e.spot.h) >= want - .5 ? hex : null;
  };
  const neg = d => d.map(x => -x);
  // the hue turned a little either way (for very dark or very pale spots, where light and strength run out of gamut)
  const hd = C > 3 ? [0, -T[2] / C, T[1] / C] : [0, 0, 1];
  const dirs = [v, neg(v), w, neg(w), [1, 0, 0], [-1, 0, 0], cdir, neg(cdir), hd, neg(hd)];
  for (const want of [8, 10, 13]) {
    const all = [e.spot.h];
    for (const d of dirs) {
      const h = along(d, want);
      if (h && all.every(x => de2000(x, h) >= 5)) all.push(h);
      if (all.length === 4) break;
    }
    if (all.length === 4) return { ans: e.spot.h, opts: dpShuffle(all, seededRnd(dlHash("dp-spot" + k))) };
  }
  return null;
}
// round 4: the four colors, shown in a seeded order; the answer is most -> least canvas
const dpOrderShown = (e, k) => dpShuffle([0, 1, 2, 3], seededRnd(dlHash("dp-order" + k)));
// round 5: the true decade and three others, each at least 20 years from every other option
function dpDecades(e, k) {
  const d = Math.floor(e.y / 10) * 10, rnd = seededRnd(dlHash("dp-dec" + k)), out = [d];
  for (const o of dpShuffle([-90, -70, -60, -50, -40, -30, -20, 20, 30, 40, 50, 60, 70, 90], rnd)) {
    const x = d + o;
    if (x >= 1300 && x <= 1990 && out.every(y => Math.abs(y - x) >= 20)) out.push(x);
    if (out.length === 4) break;
  }
  return { ans: d, opts: out.sort((a, b) => a - b) };
}
// the five plates of the grid: the color each round was about (the 5th: the painting's most distinct other color)
function dpPlates(e) {
  const p = [e.pool[e.hid][0], e.pool[e.foc][0], e.spot.h, e.ord[0][0]];
  const fifth = e.pool.map(x => x[0]).find(h => p.every(q => de2000(q, h) >= 10)) || e.pool[0][0];
  return [...p, fifth];
}
// the share: the score and the painting's palette as plates (ringed for each round you got); never its title,
// painter or date, so a friend can still play it
const dpShareText = (hits, no) => `ColorHub · Today's painting No. ${no} · ${hits.filter(Boolean).length} of 5`;
const dpShareSpec = (e, hits, no) => ({ layout: "palette", note: `Today's painting, No. ${no}`, title: `${hits.filter(Boolean).length} of 5`,
  sub: "Five ways of looking at one painting.", plates: dpPlates(e).map((h, i) => ({ h, hit: !!hits[i] })) });
const DP_WORDS = ["None", "One", "Two", "Three", "Four", "Five"];

// ---------- the screen ----------
// A screen drawn after the data lands takes over the placeholder's address (#/challenge) instead of adding one.
const dpRoute = () => { ROUTE_REPLACE = true; ROUTE_NEXT = { path: "challenge", title: "Today's painting" }; };
// Opening it: today's painting, picking up at the round you left (S.dpNow), or the result if it's played.
function challenge() {
  const k = today(), el = dpWait(), tok = SHOW_N;
  dpLoad(k).then(e => {
    if (SHOW_N !== tok || !e) return;
    if (chToday()) { dpRoute(); return challengeDone(false, e); }
    return loadCoreNames().then(() => { if (SHOW_N === tok) { dpRoute(); dpPlay(e, k); } });
  }).catch(() => { if (SHOW_N === tok) dpError(el); });
}
// loading: the screen's own shape in quiet blocks, so nothing jumps when the painting lands
function dpWait() {
  const el = show(`<header class="deck-top"><button class="icon-btn" data-close aria-label="Close">${ICON.x}</button><div class="segs">${"<i></i>".repeat(5)}</div><span class="left mono"></span></header>
    <div class="dp-head"><span class="dp-ph dp-ph-q"></span></div><div class="dp-stage"><span class="dp-ph dp-ph-img"></span></div><div class="dp-foot"><p class="wait-note" role="status">Hanging today's painting…</p></div>`, "fixed daily dp");
  el.querySelector("[data-close]").onclick = () => go(S.tab || "learn");
  return el;
}
function dpError(el) {
  el.querySelector(".dp-stage").innerHTML = `<div class="dp-err"><p class="title-3">Today's painting didn't arrive.</p><p class="small">It comes from this site, so you may be offline. Your streak is safe; it waits until tonight.</p><button class="btn" data-retry>Try again</button></div>`;
  el.querySelector(".dp-foot").innerHTML = "";
  el.querySelector("[data-retry]").onclick = () => challenge();
}

function dpPlay(e, k) {
  const no = chNumber(k);
  if (!S.dpNow || S.dpNow.k !== k || S.dpNow.p !== e.id) S.dpNow = { k, p: e.id, i: 0, hits: [], picks: [] };
  const st = S.dpNow, grid = dpGrid(e), focal = dpFocalOptions(e, CORE_NAMES || coreFallback(), k), spot = dpSpotOptions(e, k);
  const dec = dpDecades(e, k), shown = dpOrderShown(e, k);
  const src = e.k === "g" && e.hi ? e.hi : e.img;
  const el = show(`
    <header class="deck-top"><button class="icon-btn" data-close aria-label="Close">${ICON.x}</button>
      <div class="segs">${"<i></i>".repeat(5)}</div><span class="left mono" id="dpN"></span></header>
    <div class="dp-head" id="dpHead"></div>
    <div class="dp-stage" id="dpStage"><div class="dp-frame" id="dpFrame" style="aspect-ratio:${e.w}/${e.h}">
      <img src="${esc(src)}" alt="${esc(e.t)}, ${esc(e.a)}" draggable="false">
      <canvas class="dp-veil" id="dpVeil"></canvas><div class="dp-marks" id="dpMarks"></div></div></div>
    <p class="dp-credit"><span>${esc(e.t)}</span> · ${esc(e.a)} · <em>as photographed</em></p>
    <div class="dp-foot" id="dpFoot"></div>
  `, "fixed daily dp");
  const $ = s => el.querySelector(s), head = $("#dpHead"), foot = $("#dpFoot"), frame = $("#dpFrame"), marks = $("#dpMarks"), img = frame.querySelector("img");
  const segs = el.querySelectorAll(".segs i");
  // the sharp museum copy is only for looking; if it can't load, the local copy everything was measured on stands in
  img.onerror = () => { if (img.src.indexOf(e.img) < 0) img.src = e.img; };
  // keep the painting as large as the stage allows, at its own proportions
  const fit = () => {
    const s = $("#dpStage"); if (!s) return;
    const W = s.clientWidth, H = s.clientHeight, r = e.w / e.h;
    const w = Math.min(W, H * r);
    frame.style.width = Math.floor(w) + "px"; frame.style.height = Math.floor(w / r) + "px";
  };
  fit(); requestAnimationFrame(fit);
  addEventListener("resize", fit); cleanup.push(() => removeEventListener("resize", fit));
  const leave = () => go(S.tab || "learn");
  $("[data-close]").onclick = leave;
  onKey = ev => { if (ev.key === "Escape") leave(); };
  segs.forEach((s, i) => { if (st.hits[i] != null) { s.classList.add("on"); s.style.setProperty("--c", st.hits[i] ? "var(--good)" : "var(--bad)"); } });

  // the veil: everything but one pool color dimmed, drawn from the local copy's own pixels
  let labels = null;
  const labelsReady = new Promise(res => {
    const im = new Image();
    im.onload = () => {
      try {
        const s = Math.min(1, 320 / Math.max(im.naturalWidth, im.naturalHeight)), w = Math.max(1, Math.round(im.naturalWidth * s)), h = Math.max(1, Math.round(im.naturalHeight * s));
        const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
        const x = cv.getContext("2d", { willReadFrequently: true }); x.drawImage(im, 0, 0, w, h);
        const px = x.getImageData(0, 0, w, h).data, P = e.pool.map(p => lab(p[0])), L = new Uint8Array(w * h);
        for (let i = 0, j = 0; i < px.length; i += 4, j++) {
          const q = lab("#" + ((1 << 24) | px[i] << 16 | px[i + 1] << 8 | px[i + 2]).toString(16).slice(1));
          let b = 0, bd = 1e9;
          for (let c = 0; c < P.length; c++) { const d = (q[0] - P[c][0]) ** 2 + (q[1] - P[c][1]) ** 2 + (q[2] - P[c][2]) ** 2; if (d < bd) { bd = d; b = c; } }
          L[j] = b;
        }
        labels = { w, h, L };
      } catch (err) { labels = null; }
      res();
    };
    im.onerror = () => res();
    im.src = e.img;
  });
  const veil = (idx, on = true) => labelsReady.then(() => {
    const cv = $("#dpVeil"); if (!cv) return;
    if (!on) { cv.classList.remove("on"); return; }
    const g = cv.getContext("2d");
    if (labels) {
      cv.width = labels.w; cv.height = labels.h;
      const out = g.createImageData(labels.w, labels.h);
      for (let j = 0; j < labels.L.length; j++) { const p = j * 4; out.data[p] = out.data[p + 1] = out.data[p + 2] = 12; out.data[p + 3] = labels.L[j] === idx ? 0 : 196; }
      g.putImageData(out, 0, 0);
    } else {   // no pixels: the measured grid stands in
      cv.width = e.gw; cv.height = e.gh; g.fillStyle = "rgba(12,12,12,.77)";
      for (let y = 0; y < e.gh; y++) for (let x = 0; x < e.gw; x++) if (grid[y * e.gw + x] !== idx) g.fillRect(x, y, 1, 1);
    }
    cv.classList.add("on");
  });
  const ring = (x, y, cls = "", size = 46) => { marks.insertAdjacentHTML("beforeend", `<i class="dp-ring ${cls}" style="left:${(x * 100).toFixed(2)}%;top:${(y * 100).toFixed(2)}%;--d:${size}px"></i>`); };
  const spotSize = () => Math.max(30, Math.round(e.spot.r * 2 * Math.min(frame.clientWidth, frame.clientHeight) * 1.5));
  const nameLink = (hex, cls = "") => { const nm = nameOf(hex); return `<button class="dp-name ${cls}" data-swatch="${hex}">${esc(nm.text || nm.n)}</button>`; };
  const pctOf = s => `${Math.round(s * 100)}%`;
  const next = (txt) => {
    foot.innerHTML = `<p class="dp-line small">${txt}</p><button class="btn" data-next>${st.i >= 4 ? "See your painting" : "Next"} ${ICON.arrow}</button>`;
    foot.querySelector("[data-next]").onclick = () => { st.i++; save(); round(); };
  };
  const answer = (ok, pick, txt) => {
    st.hits[st.i] = ok; st.picks[st.i] = pick; save();
    segs[st.i].classList.add("on"); segs[st.i].style.setProperty("--c", ok ? "var(--good)" : "var(--bad)");
    buzz(ok ? 12 : [10, 40, 10]);
    later(() => next(txt), ok ? 260 : 420);
  };
  const ask = (q, chip = "") => { head.innerHTML = `${chip ? `<i class="dp-chip" style="--c:${chip}"></i>` : ""}<h2 class="dp-q">${q}</h2>`; };

  const ROUNDS = [
    // 1. the hidden color
    () => {
      const hex = e.pool[e.hid][0];
      ask(`Where does this color <em>hide?</em>`, hex);
      foot.innerHTML = `<p class="dp-line small">Tap the painting where you see it.</p>`;
      frame.classList.add("tappable");
      frame.onclick = ev => {
        const r = frame.getBoundingClientRect(), x = (ev.clientX - r.left) / r.width, y = (ev.clientY - r.top) / r.height;
        if (x < 0 || y < 0 || x > 1 || y > 1) return;
        frame.onclick = null; frame.classList.remove("tappable");
        const ok = dpHitHidden(e, x, y, grid);
        ring(x, y, ok ? "good" : "bad", 34);
        veil(e.hid);
        const share = pctOf(e.pool[e.hid][1]);
        answer(ok, [x, y], ok ? `Found it. ${nameLink(hex)} hides here, in about ${share} of the canvas.`
          : `It hides in the bright parts of the veil: ${nameLink(hex)}, about ${share} of the canvas.`);
      };
    },
    // 2. the focal color
    () => {
      veil(0, false);
      ask(`Name the color that pulls the <em>eye.</em>`, focal.hex);
      ring(e.fc[0], e.fc[1], "paper", 52);
      foot.innerHTML = `<div class="dp-opts">${focal.opts.map((o, i) => `<button data-o="${i}">${esc(o.n)}</button>`).join("")}</div>`;
      foot.querySelectorAll("[data-o]").forEach(b => b.onclick = () => {
        if (foot.dataset.done) return; foot.dataset.done = 1;
        const o = focal.opts[+b.dataset.o], ok = o.n === focal.ans, nm = nameOf(focal.hex);
        b.classList.add(ok ? "right" : "wrong");
        if (!ok) foot.querySelector(`[data-o="${focal.opts.findIndex(x => x.n === focal.ans)}"]`).classList.add("right");
        st.focal = { n: focal.ans, h: (CORE_NAMES || []).find(x => x.n === focal.ans)?.h || focal.hex };
        if (!ok) { try { if (typeof learnerLog === "function") learnerLog({ k: "confuse", c: focal.ans, with: o.n, surf: "painting" }); } catch (err) {} }
        const exact = nm.mod ? ` (the nearest name is ${esc(nm.n.toLowerCase())})` : "";
        later(() => { foot.dataset.done = ""; answer(ok, o.n, ok ? `Yes: ${nameLink(focal.hex)}${exact}.` : `It's ${nameLink(focal.hex)}${exact}. ${esc(o.n)} would be ${esc(lookDiff({ h: focal.hex }, o))}.`); }, 450);
      });
    },
    // 3. the true color of a spot
    () => {
      ask(`What color is the ringed spot, <em>really?</em>`);
      ring(e.spot.x, e.spot.y, "paper", spotSize());
      if (!spot) { answer(true, null, "This painting's spot is too even to ask about today."); return; }
      foot.innerHTML = `<div class="dp-sw">${spot.opts.map((h, i) => `<button data-o="${i}" style="--c:${h}" aria-label="Option ${i + 1}"></button>`).join("")}</div>`;
      foot.querySelectorAll("[data-o]").forEach(b => b.onclick = () => {
        if (foot.dataset.done) return; foot.dataset.done = 1;
        const h = spot.opts[+b.dataset.o], ok = h === spot.ans;
        b.classList.add(ok ? "right" : "wrong");
        if (!ok) foot.querySelector(`[data-o="${spot.opts.indexOf(spot.ans)}"]`).classList.add("right");
        const [Lt] = lab(e.spot.h), [Ls] = lab(e.spot.s), around = Ls < Lt - 6 ? "darker" : Ls > Lt + 6 ? "lighter" : "";
        const look = around ? `It sits among ${around} colors, so it can look ${around === "darker" ? "lighter" : "darker"} than it is.` : `What surrounds it changes how it reads.`;
        const why = ok ? `Yes. ${look} Cut out, it's ${nameLink(spot.ans)}.` : `Cut out, it's ${nameLink(spot.ans)}. ${look}`;
        // the patch, cut out: the true color fills the ring for a moment, on its own
        const rr = marks.querySelector(".dp-ring:last-child"); if (rr) { rr.style.setProperty("--fill", spot.ans); rr.classList.add("cut"); }
        later(() => { foot.dataset.done = ""; answer(ok, h, why); }, 520);
      });
    },
    // 4. its palette in order
    () => {
      marks.innerHTML = "";
      ask(`Which covers the most <em>canvas?</em>`);
      const picked = [];
      foot.innerHTML = `<p class="dp-line small">Tap all four, from most to least.</p><div class="dp-sw dp-ord">${shown.map(j => `<button data-o="${j}" style="--c:${e.ord[j][0]}" aria-label="Color ${j + 1}"><span class="code"></span></button>`).join("")}</div>`;
      const draw = () => foot.querySelectorAll("[data-o]").forEach(b => { const at = picked.indexOf(+b.dataset.o); b.classList.toggle("on", at >= 0); b.querySelector("span").textContent = at >= 0 ? at + 1 : ""; });
      foot.querySelectorAll("[data-o]").forEach(b => b.onclick = () => {
        if (foot.dataset.done) return;
        const j = +b.dataset.o, at = picked.indexOf(j);
        if (at >= 0) picked.splice(at); else picked.push(j);   // tapping a numbered one takes it (and the ones after it) back
        buzz(6); draw();
        if (picked.length < 4) return;
        foot.dataset.done = 1;
        const inPlace = picked.filter((x, i) => x === i).length, ok = inPlace === 4;
        later(() => {
          foot.dataset.done = "";
          foot.innerHTML = `<div class="dp-bar">${e.ord.map((o, i) => `<span style="--c:${o[0]};flex:${o[1]}" class="${picked[i] === i ? "hit" : ""}" data-swatch="${o[0]}"><b class="code">${pctOf(o[1])}</b></span>`).join("")}</div>`;
          answer(ok, picked.slice(), ok ? `Right order. ${nameLink(e.ord[0][0])} and its near relatives cover about ${pctOf(e.ord[0][1])} of the canvas.`
            : `${DP_WORDS[inPlace]} of four in place. The most is ${nameLink(e.ord[0][0])} and its near relatives, about ${pctOf(e.ord[0][1])}.`);
        }, 380);
      });
    },
    // 5. the decade
    () => {
      ask(`When was it <em>painted?</em>`);
      foot.innerHTML = `<div class="dp-opts">${dec.opts.map(d => `<button data-o="${d}">${d}s</button>`).join("")}</div>`;
      foot.querySelectorAll("[data-o]").forEach(b => b.onclick = () => {
        if (foot.dataset.done) return; foot.dataset.done = 1;
        const d = +b.dataset.o, ok = d === dec.ans;
        b.classList.add(ok ? "right" : "wrong");
        if (!ok) foot.querySelector(`[data-o="${dec.ans}"]`).classList.add("right");
        later(() => { foot.dataset.done = ""; answer(ok, d, `${esc(e.a)} painted it in ${esc(e.yr)}.${dpFinding(e) ? " " + dpFinding(e) : ""}`); }, 450);
      });
    },
  ];
  function round() {
    while (st.i < 5 && st.hits[st.i] != null) st.i++;   // an answered round never comes back
    if (st.i >= 5) return dpFinish(e, k);
    el.querySelector("#dpN").textContent = `${st.i + 1}/5`;
    marks.innerHTML = ""; frame.onclick = null; frame.classList.remove("tappable");
    if (st.i !== 0) veil(0, false);
    ROUNDS[st.i]();
  }
  round();
}
// one measured line about the painting: its lightness against its century in the archive
function dpFinding(e) {
  if (e.lp == null || !e.cn) return "";
  const c = `${e.cn}s`;
  return e.lp >= 50 ? `As photographed, it's lighter than ${e.lp}% of the archive's ${c} paintings.` : `As photographed, it's darker than ${100 - e.lp}% of the archive's ${c} paintings.`;
}
function dpFinish(e, k) {
  const st = S.dpNow || { hits: [] };
  chState()[k] = { hits: st.hits.slice(0, 5).map(Boolean), p: e.id, focal: st.focal || null, v: 2 };
  delete S.dpNow; save();
  try { if (typeof learnerLog === "function") learnerLog({ k: "seen", c: e.id, surf: "painting-of-the-day" }); } catch (err) {}
  challengeDone(true, e);
}
// the finish (also what a played day reopens to): the painting whole, your grid in its own colors, one finding
function challengeDone(fresh, e) {
  if (!e) { dpWait(); const tok = SHOW_N; return dpLoad().then(x => { if (SHOW_N === tok && x) { dpRoute(); challengeDone(fresh, x); } }).catch(() => go(S.tab || "learn")); }
  const k = today(), no = chNumber(k), rec = chState()[k] || { hits: [] }, hits = rec.hits || [], got = hits.filter(Boolean).length;
  const plates = dpPlates(e), src = e.k === "g" && e.hi ? e.hi : e.img;
  const verdict = got === 5 ? `Five for <em>five.</em>` : `${DP_WORDS[got]} of <em>five.</em>`;
  const el = show(`
    <header class="deck-top"><button class="icon-btn" data-close aria-label="Close">${ICON.x}</button><span class="note dp-no">Today's painting, No. ${no}</span><span style="width:44px"></span></header>
    <button class="dp-whole" data-open aria-label="Open ${esc(e.t)}"><img src="${esc(src)}" alt="${esc(e.t)}" style="aspect-ratio:${e.w}/${e.h}"></button>
    <h1 class="title-1 dp-verdict">${verdict}</h1>
    <p class="note dp-cap"><b>${esc(e.t)}</b> · ${esc(e.a)}, ${esc(e.yr)} · ${esc(e.pl)}</p>
    <div class="dp-plates">${plates.map((h, i) => `<button class="${hits[i] ? "hit" : "miss"}" data-swatch="${h}" style="--c:${h}" aria-label="${esc(DP_ROUND_NAMES[i])}: ${hits[i] ? "got it" : "missed"}"><i></i><span>${esc(DP_ROUND_NAMES[i])}</span></button>`).join("")}</div>
    ${dpFinding(e) ? `<p class="lead dp-find">${dpFinding(e)}</p>` : ""}
    <div class="dp-acts">
      <button class="btn" data-share>Share your grid ${ICON.share}</button>
      ${dnDone(k) ? "" : `<button class="btn ghost" data-name>Now name today's color</button>`}
      <button class="btn ghost" data-open>Open the painting</button>
    </div>
    <p class="fine">${dlStreakLine()}A new painting tomorrow. Every color here comes from a museum photograph, read on your screen.</p>
  `, "daily dp-end");
  const img = el.querySelector(".dp-whole img"); img.onerror = () => { if (img.src.indexOf(e.img) < 0) img.src = e.img; };
  el.querySelector("[data-close]").onclick = () => go(S.tab || "learn");
  el.querySelectorAll("[data-open]").forEach(b => b.onclick = () => dpOpenPainting(e));
  el.querySelector("[data-share]").onclick = () => cardShare(dpShareSpec(e, hits, no), dpShareText(hits, no), routeURL("challenge"), `colorhub-painting-${no}.png`);
  const nm = el.querySelector("[data-name]"); if (nm) nm.onclick = () => daily();
  if (fresh) buzz(got >= 4 ? [10, 30, 20] : 10);
}
function dpOpenPainting(e) {
  XSTACK = [];
  if (e.k === "f") return whenWiki(() => { const n = graph().nodes.get(e.node); if (n) openNode(n); });
  return galleryPage(e.gi);
}

// ---------- the Today row on Learn: two calm tiles and the streak ----------
function dlTodayRow() {
  const k = today(), p = chToday(), now = S.dpNow && S.dpNow.k === k ? S.dpNow : null, d = S.daily[k], dr = d && d.g ? d : null, n = chStreak();
  const pSt = p ? `${(p.hits || []).filter(Boolean).length} of ${(p.hits || []).length || 5}` : now ? `Round ${now.i + 1} of 5` : "Five ways to look";
  const dSt = dr ? (dr.done ? (dr.ok ? (dr.hint ? "Named, with choices" : `Named in ${dr.g.length}`) : "Missed today") : `${dr.g.length} ${dr.g.length === 1 ? "guess" : "guesses"} so far`) : d ? "Named" : "Name it in six";
  return `<section class="dl-row">
    <div class="dl-head"><h3 class="title-3">Today</h3><span class="note">${n > 1 ? `${n}-day streak` : ""}</span></div>
    <div class="dl-tiles">
      <button class="tday dl-tile${p ? " done" : ""}" data-dpaint><span class="tday-art dl-art dl-ph" id="dlPaintArt"></span><b>Today's painting</b><span class="tday-st">${pSt}</span></button>
      <button class="tday dl-tile${dnDone(k) ? " done" : ""}" data-daily><span class="tday-art dl-art dl-ph" id="dlColorArt" data-morph-src></span><b>Today's color</b><span class="tday-st" id="dlColorSt">${dSt}</span></button>
    </div></section>`;
}
function dlWireToday(el) {
  const pa = el.querySelector("[data-dpaint]"), da = el.querySelector("[data-daily]");
  if (pa) pa.onclick = () => challenge();
  if (da) da.onclick = () => daily();
  const tok = SHOW_N;
  dpLoad().then(e => {
    const a = el.querySelector("#dlPaintArt"); if (!a || SHOW_N !== tok || !e) return;
    a.classList.remove("dl-ph"); a.innerHTML = `<img src="${esc(dpThumb(e))}" alt="">`;
  }).catch(() => {});
  loadCoreNames().then(() => {
    const a = el.querySelector("#dlColorArt"), t = dnTarget(); if (!a || SHOW_N !== tok || !t) return;
    a.classList.remove("dl-ph"); a.style.background = t.h;
    const d = S.daily[today()];
    if (d && d.g && d.done) a.innerHTML = `<span class="dl-art-name" data-ink="${ink(t.h)}">${esc(t.n)}</span>`;
  });
}

// ---------- screenshot states (boot.js #shot=dl:<state>) ----------
// dl:row · dl:paint[:<round 0-4>|:end] · dl:name[:empty|:three|:hint|:won|:lost]
function dlShot(arg = "") {
  const [what, sub = ""] = arg.split(":"), k = today();
  if (what === "row") { S.challenge = { [addDays(k, -1)]: { hits: [1, 1, 0, 1, 1] }, [addDays(k, -2)]: { hits: [1, 0, 0, 1, 1] } }; return go("learn"); }
  if (what === "paint") {
    if (sub === "end") { S.challenge = { [k]: { hits: [true, true, false, true, true], v: 2 }, [addDays(k, -1)]: { hits: [1, 1, 1, 1, 1] } }; return challenge(); }
    if (sub) S.dpNow = { k, p: null, i: +sub, hits: Array.from({ length: +sub }, (_, i) => i !== 1), picks: [] };
    return dpLoad(k).then(e => { if (S.dpNow) S.dpNow.p = e.id; challenge(); });
  }
  return loadCoreNames().then(() => {
    const t = dnTarget(k), near = nearestCore(t.h, CORE_NAMES, 30).map(x => x.n).filter(n => n !== t.n);
    const far = dnOrder(CORE_NAMES).filter(e => de2000(e.h, t.h) > 25).map(e => e.n);
    if (sub === "three") S.daily = { [k]: { t: t.n, g: [far[0], near[8], near[3]], done: false } };
    else if (sub === "hint") S.daily = { [k]: { t: t.n, g: [far[0], near[8], near[3]], done: false, hint: true } };
    else if (sub === "won") S.daily = { [k]: { t: t.n, g: [far[0], near[8], near[3], t.n], done: true, ok: true } };
    else if (sub === "lost") S.daily = { [k]: { t: t.n, g: [far[0], far[1], near[8], near[5], near[3], near[1]], done: true, ok: false } };
    else S.daily = {};
    return daily();
  });
}
// ======================================================================
// Your eye over time: every drill's score history as a chart, plus the challenge record.
// Smaller differences = sharper. Scores bounce from day to day, so the copy points at the trend.
// ======================================================================
const FAM_HEX = { Reds: "#C8323C", Oranges: "#E07B39", Browns: "#8B5A3C", Yellows: "#E0C040", Greens: "#3E9A5C", Blues: "#3C6FC8", Purples: "#7E4FB0", Pinks: "#E58BB0", Greys: "#8C8C88" };
function eyeChart(hist, unit, compact = false) {
  // one point per day (the day's last score), on a log scale so a drop from 4 to 2 looks like 2 to 1
  const byDay = new Map(); hist.forEach(([d, v]) => byDay.set(d, v));
  const pts = [...byDay.entries()];
  if (pts.length < 2) return `<p class="x-sub">Train on two different days to see a trend.</p>`;
  const W = 320, H = 120, P = 14, vs = pts.map(p => Math.log(p[1])), lo = Math.min(...vs), hi = Math.max(...vs), span = hi - lo || 1;
  const xy = pts.map((p, i) => [P + i / (pts.length - 1) * (W - 2 * P), P + (hi - Math.log(p[1])) / span * (H - 2 * P)]);
  // y is flipped: sharper (smaller) is higher
  const yy = xy.map(([x, y]) => [x, H - y]);
  const line = yy.map(p => p.map(v => v.toFixed(1)).join(",")).join(" ");
  const first = pts[0][1], last = pts[pts.length - 1][1], gain = Math.round((1 - last / first) * 100);
  return `<svg class="eye-chart${compact ? " compact" : ""}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><polyline points="${line}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>${yy.map(([x, y], i) => !compact && (i === 0 || i === yy.length - 1) ? `<circle cx="${x}" cy="${y}" r="3.2" fill="currentColor"/>` : "").join("")}</svg>
    <div class="eye-ends"><span>${pts[0][0] ? esc(String(pts[0][0]).slice(5)) + " · " : ""}<b>${pctFmt(first)}</b> ${esc(unitWord(unit))}</span><span><b>${pctFmt(last)}</b> ${esc(unitWord(unit))}${pts[pts.length - 1][0] ? " · " + esc(String(pts[pts.length - 1][0]).slice(5)) : ""}</span></div>
    ${compact ? "" : `<p class="eye-gain">${gain > 0 ? `You now see differences ${gain}% smaller than when you started` : gain < 0 ? "A little behind your start today. That's normal: watch the trend over weeks." : "About where you started"}</p>`}`;
}
// Check-in levels over time (1-20, higher is better): one point per check-in that included the station.
function ciChart(pts) {
  if (pts.length < 2) return "";
  const W = 320, H = 96, P = 10, x = i => P + i / (pts.length - 1) * (W - 2 * P), y = lv => H - P - (lv - 1) / 19 * (H - 2 * P);
  const line = pts.map((p, i) => `${x(i).toFixed(1)},${y(p.lv).toFixed(1)}`).join(" ");
  return `<div class="ci-wrap"><svg class="eye-chart ci-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
    ${[5, 10, 15].map(l => `<line x1="0" x2="${W}" y1="${y(l)}" y2="${y(l)}" class="ci-grid" vector-effect="non-scaling-stroke"/>`).join("")}
    <polyline points="${line}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>
    <div class="ci-dots">${pts.map((p, i) => `<span style="left:${(x(i) / W * 100).toFixed(1)}%;top:${(y(p.lv) / H * 100).toFixed(1)}%"><b>${p.lv}</b></span>`).join("")}</div></div>`;
}
function eyeReport() {
  const ch = Object.entries(chState()).sort((a, b) => a[0].localeCompare(b[0]));
  const fam = skillState("hue").fam, famE = Object.entries(fam);
  const famMax = Math.max(...famE.map(f => f[1]), 1);
  const g = gyState(), day = gyDay(), cl = calib(g.conf), clLine = calibLine(cl);
  const all = TRAIN_KEYS.flatMap(k => (g.st[k] ? g.st[k].trials : [])).sort((a, b) => a.t - b.t), wl = weakLine(weakBand(all, day));
  const due = checkinDue(g.checkins, triedKeys().length, day);
  const station = k => {
    const sk = SKILLS[k], st = S.gym.skills[k] || { hist: [] }, lv = stationLevel(k);
    const pts = g.checkins.filter(c => c.res[k]).map(c => ({ t: c.t, lv: c.res[k].lv }));
    if (!lv.tried) return `<section class="eye-sec"><div class="sec-head"><b>${esc(sk.name)}</b><span>not tried yet</span></div></section>`;
    return `<section class="eye-sec"><div class="sec-head"><b>${esc(sk.name)}</b><span>${lv.ci != null ? `level ${lv.ci} · check-in` : `level ${lv.sess} · sessions`}${(g.st[k] || {}).maint ? " · maintenance" : ""}</span></div>
      ${pts.length >= 2 ? `<p class="eye-cap">Check-ins</p>${ciChart(pts)}`
        : pts.length === 1 ? `<p class="x-sub">One check-in so far: level ${pts[0].lv}. Your trend starts with the next one.</p>` : ""}
      ${st.hist.length ? `<p class="eye-cap">Sessions${pts.length ? " · these move around day to day" : ""}</p>${eyeChart(st.hist, sk.unit, pts.length > 0)}` : ""}</section>`;
  };
  const el = show(`
    <header class="art-top"><button class="icon-btn glass" data-back aria-label="Back">${ICON.back}</button><span class="eyebrow">Train · Your eye</span><span style="width:44px"></span></header>
    <p class="eyebrow kick">Progress</p>
    <h1 class="tab-title">Your <em>eye</em></h1>
    <p class="x-sub">Your levels come from the weekly check-in: a short fixed test with no feedback. Session scores move around day to day; check-ins are the real trend. ${esc(due.due ? "A check-in is ready on the Train tab." : due.why + ".")}</p>
    ${clLine || wl ? `<section class="eye-sec"><div class="sec-head"><b>How you judge</b><span>recent rounds</span></div>
      ${clLine ? `<p class="eye-gain">${esc(clLine)}</p><div class="eye-cal"><div><span>Sure</span><i style="--w:${cl.sure}%"></i><b class="mono">${cl.sure}%</b></div>${cl.nGuess ? `<div><span>Guessing</span><i style="--w:${cl.guess}%"></i><b class="mono">${cl.guess}%</b></div>` : ""}</div>
        <p class="x-sub">From the rounds where you said how sure you were. A good eye also knows when it's guessing.</p>` : ""}
      ${wl ? `<p class="eye-gain">${esc(wl)}.</p>` : ""}</section>` : ""}
    ${TRAIN_KEYS.map(station).join("")}
    ${famE.length ? `<section class="eye-sec"><div class="sec-head"><b>By color family</b><span>odd one out · shorter is sharper</span></div>
      <div class="eye-fams">${famE.sort((a, b) => a[1] - b[1]).map(([f, v]) => `<div><span>${esc(f)}</span><i style="--c:${FAM_HEX[f] || "#888"};--w:${(v / famMax * 100).toFixed(0)}%"></i><b class="mono">${pctFmt(v)}</b></div>`).join("")}</div>
      <p class="x-sub">Scores are CIEDE2000, which already evens out most of the eye's differences between hues, so a family that stands out is worth extra practice.</p></section>` : ""}
    <section class="eye-sec"><div class="sec-head"><b>Daily painting</b><span>${ch.length ? `${ch.length} played · ${chStreak()}-day streak` : "not played yet"}</span></div>
      ${ch.length ? `<div class="eye-ch">${ch.slice(-28).map(([d, v]) => `<span title="${esc(d)}">${v.hits.map(h => `<i class="${h ? "hit" : ""}"></i>`).join("")}</span>`).join("")}</div>` : `<p class="x-sub">One painting a day, five ways of looking at it, the same for everyone.</p>`}</section>
    <p class="fine">Practice sharpens these particular judgments. It isn't a claim about general brain training.</p>
  `, "article gym-eye");
  el.querySelector("[data-back]").onclick = () => go(S.tab || "gym");
}
