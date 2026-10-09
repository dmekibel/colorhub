"use strict";
// Study's format library, the new pieces (design/LEARN-ROOM-2.md §Formats). The pacer (js/studypace.js spKind) picks
// a format per question from the color's rung; js/learnset.js lsStudy draws it. Each is a PR_STEPS step (the
// js/practice.js contract: render(box, item, ctx) -> Promise<{ ok, answer, ms }>), so prRecord logs every answer to
// the Learner Model and counts a due card's review the same way as any other.
//   echo   just met: "Which one is teal?", two to pick from, far apart (Duolingo's new-word check)
//   flash  a reminder: the color and its name for a moment, then find it among four close neighbors (color memory)
//   spot   find it among 6, 8 or 10 tiles: the set's own colors and their neighbors
//   edge   where does it end? Nine steps from it to its nearest mate: tap the last one you'd still call it
//   recall the top rung: the color alone, its name among 6 to 8 close same-family names, no hint (tap, not type)
// The kinds the pacer already used stay as they were: quiz-name, quiz-color, odd-one-out, match, type, card.

PR_STEPS.echo = { by: "pick", render(box, it, ctx = {}) {
  return PR_STEPS["quiz-color"].render(box, it, { ...ctx, anyN: true, cls: "pr-s-echo", ask: "You just met it. Which one is", hint: "Tap it" });
} };

PR_STEPS.flash = { by: "pick", render(box, it, ctx = {}) {
  return new Promise(resolve => {
    const nm = prName(it), dark = ink(it.h) === "dark" ? "#141311" : "#fff";
    box.innerHTML = `<div class="pr-step pr-s-flash"><p class="pr-stepnote">Remember this one</p>
      <div class="sf-flash" style="--c:${it.h};color:${dark}"><b style="${prFit(nm, 52)}">${esc(nm)}</b></div>
      <div class="pr-foot"><p class="pr-hint">Look closely</p></div></div>`;
    buzz(6);
    const ms = typeof reduceMotion !== "undefined" && reduceMotion ? 1600 : 1400;
    later(() => {
      if (!box.isConnected || (ctx.screen && !ctx.screen.isConnected)) return;
      PR_STEPS["quiz-color"].render(box, it, { ...ctx, anyN: true, cls: "pr-s-flashq", ask: "Which one was", hint: "Tap the one you just saw" }).then(resolve);
    }, ms);
  });
} };

PR_STEPS.spot = { by: "pick", render(box, it, ctx = {}) {
  const n = (ctx.wrong || []).length + 1;
  return PR_STEPS["quiz-color"].render(box, it, { ...ctx, anyN: true, cls: "pr-s-spot", ask: `Spot it among ${n}:`, hint: "Tap it" });
} };

PR_STEPS.recall = { by: "pick", render(box, it, ctx = {}) {
  return PR_STEPS["quiz-name"].render(box, it, { ...ctx, note: ctx.note || "From memory: which name is it?" });
} };

// where does it end: graded against the measured border (the last step nearer to it than to its mate), within one step
PR_STEPS.edge = { by: null, render(box, it, ctx = {}) {
  const b = ctx.other;
  if (!b || typeof edgeStrip !== "function") return PR_STEPS["quiz-color"].render(box, it, ctx);
  return new Promise(resolve => {
    const t0 = performance.now(), { hexes, mid } = edgeStrip(it.h, b.h, 9), last = mid - 1;
    const na = prName(it), nb = prName(b), low = s => typeof lxLower === "function" ? lxLower(s) : s.toLowerCase();
    box.innerHTML = `<div class="pr-step pr-s-edge">
      <div class="pr-q"><span class="pr-note">Where does it end?</span><b class="pr-t1" style="${prFit(na, 40)}">${esc(na)}</b></div>
      <p class="sf-edge-ask">Tap the last one you'd still call ${esc(low(na))}.</p>
      <div class="sf-edge" role="group" aria-label="Nine steps from ${esc(na)} to ${esc(nb)}">${hexes.map((h, i) => `<button class="sf-edge-b" data-i="${i}" style="--c:${h}" aria-label="Step ${i + 1}"></button>`).join("")}</div>
      <div class="sf-edge-ends"><span>${esc(na)}</span><span>${esc(nb)}</span></div>
      <div class="pr-fb" aria-live="polite"></div>
      <div class="pr-foot"><p class="pr-hint">Tap a step</p></div></div>`;
    const fb = box.querySelector(".pr-fb"), foot = box.querySelector(".pr-foot"), strip = box.querySelector(".sf-edge");
    let done = false;
    const choose = i => {
      if (done || i < 0 || i > 8) return; done = true;
      const k = i - last, ok = Math.abs(k) <= 1;
      // no hex in the answer: a step isn't a name you confused it with (no mix-up pair, no re-Look against it)
      const res = { ok, answer: { kind: "edge", step: i, border: last }, ms: performance.now() - t0 };
      sfEdgeKeep(na, nb, i, last);
      strip.classList.add("revealed");
      box.querySelectorAll(".sf-edge-b").forEach((x, j) => { x.disabled = true; x.classList.toggle("mine", j <= last); x.classList.toggle("on", j === i); if (j === last) x.classList.add("border"); });
      buzz(ok ? 12 : [10, 40, 10]);
      const steps = n => `${Math.abs(n)} step${Math.abs(n) === 1 ? "" : "s"}`;
      fb.innerHTML = `<p>${k === 0 ? `Right on the border: ${esc(low(na))} gives way to ${esc(low(nb))} just after it.`
        : ok ? `Close: the border is one step ${k > 0 ? "sooner" : "further"}.`
        : k > 0 ? `${esc(na)} ends ${steps(k)} sooner. Past it the color is nearer ${esc(low(nb))}.` : `${esc(na)} reaches ${steps(k)} further than that.`}</p>`;
      // the same hold as every other step: read the line, then Next (or a tap anywhere)
      if (typeof prHold === "function") prHold(box, foot, () => resolve(res));
      else if (ok) return prAuto(() => resolve(res), 1300);
      else prNextBtn(foot, () => resolve(res));
      prKeyer(ctx)(e => { if (e.key === "Enter" || e.key === " " || e.key === "ArrowRight") { e.preventDefault(); resolve(res); } });
    };
    box.querySelectorAll(".sf-edge-b").forEach(x => x.onclick = () => choose(+x.dataset.i));
    prKeyer(ctx)(e => { if (/^[1-9]$/.test(e.key)) choose(+e.key - 1); });
    box._prChoose = choose; box._prEdge = { last };
  });
} };
// the eye side of the edge: each border you set is kept with the others (learnit.js keeps S.edges the same way)
function sfEdgeKeep(a, b, step, border) {
  try { S.edges = S.edges || {}; const k = a + "|" + b; (S.edges[k] = S.edges[k] || []).push([today(), step, border + 1]); if (S.edges[k].length > 12) S.edges[k].splice(0, S.edges[k].length - 12); } catch (e) {}
}
// Perceptual-skill evidence from Study's own formats (design/LEARN-ROOM-2.md §55: "the edge and odd-one-out
// results feeding the eye profile in Train"). A Sort or Gradient result says something about how finely you see
// light-to-dark or where one color gives way to another — never that you "know" a name, so it's kept apart from
// the Learner Model's naming log (learnerLog) in its own bounded list. Train's own gym engine owns the dials it
// runs (S.gym.skills); this is a second, independent source eyeThreshold() can draw on, not a write into that.
const SF_EYE_CAP = 300;
function sfEyeLog(kind, fam, err) {
  try {
    S.eye = Array.isArray(S.eye) ? S.eye : [];
    S.eye.push({ t: Date.now(), k: String(kind), f: String(fam || ""), e: +err });
    if (S.eye.length > SF_EYE_CAP) S.eye.splice(0, S.eye.length - SF_EYE_CAP);
    if (typeof lnSaveSoon === "function") lnSaveSoon(); else save();
  } catch (e) {}
}

// ---------- sort: a set-level round (studypace.js spNext), light to dark, drag into order ----------
PR_STEPS.sort = { by: null, render(box, items, ctx = {}) {
  items = [].concat(items).slice(0, 6);
  if (items.length < 4) return PR_STEPS.match.render(box, items, ctx);
  return new Promise(resolve => {
    const t0 = performance.now();
    const correct = items.slice().sort((a, b) => lab(b.h)[0] - lab(a.h)[0]);   // lightest first
    const shown = prShuffle(items);
    box.innerHTML = `<div class="pr-step pr-s-sort">${ctx.note ? `<p class="pr-stepnote">${esc(ctx.note)}</p>` : `<p class="pr-stepnote">Light to dark: drag into order</p>`}
      <div class="pr-sort-list" data-sort>${shown.map(it => `<div class="pr-sort-row" data-k="${esc(it.key)}" style="--c:${it.h}"><span class="pr-sort-n">${esc(prName(it))}</span></div>`).join("")}</div>
      <div class="pr-foot"><button class="btn" data-check>Check</button></div></div>`;
    const list = box.querySelector("[data-sort]");
    let rows = [...list.children], rowH = 0, checked = false;
    const layout = skip => rows.forEach((r, i) => { if (r !== skip) r.style.transform = `translateY(${i * rowH}px)`; });
    const measure = () => { rowH = list.clientHeight / rows.length; rows.forEach(r => r.style.height = (rowH - 6) + "px"); layout(); };
    requestAnimationFrame(measure);
    rows.forEach(r => r.addEventListener("pointerdown", e => {
      if (checked) return;
      r.setPointerCapture(e.pointerId); r.classList.add("lift");
      const y0 = e.clientY, i0 = rows.indexOf(r), top0 = i0 * rowH;
      const move = ev => {
        const y = clamp(top0 + ev.clientY - y0, 0, (rows.length - 1) * rowH);
        r.style.transform = `translateY(${y}px) scale(1.02)`;
        const want = clamp(Math.round(y / rowH), 0, rows.length - 1), cur = rows.indexOf(r);
        if (want !== cur) { rows.splice(cur, 1); rows.splice(want, 0, r); layout(r); buzz(4); }
      };
      const up = () => { r.removeEventListener("pointermove", move); r.classList.remove("lift"); layout(); };
      r.addEventListener("pointermove", move);
      r.addEventListener("pointerup", up, { once: true });
      r.addEventListener("pointercancel", up, { once: true });
    }));
    box.querySelector("[data-check]").onclick = () => {
      if (checked) return; checked = true;
      const finalOrder = rows.map(r => items.find(it => it.key === r.dataset.k));
      const per = items.map(it => ({ item: it, ok: finalOrder.indexOf(it) === correct.indexOf(it), answer: null }));
      const wrong = per.filter(p => !p.ok).length;
      rows.forEach((r, i) => r.classList.add(finalOrder[i] === correct[i] ? "good" : "bad"));
      buzz(wrong ? [10, 40, 10] : [10, 30, 20]);
      box.querySelector(".pr-foot").innerHTML = `<p class="pr-hint">${wrong ? `${wrong} out of place` : "Perfect order"}</p>`;
      const fam = typeof prFam9 === "function" ? prFam9(items[0].h) : "";
      sfEyeLog("sort", fam, wrong / items.length);
      later(() => resolve({ ok: wrong === 0, ms: performance.now() - t0, per, answer: null }), wrong ? 900 : 500);
    };
  });
} };

// ---------- gradient: place a color in its spot on a strip between two neighbors (studypace.js spBracket) ----------
PR_STEPS.gradient = { by: null, render(box, it, ctx = {}) {
  const ends = ctx.other;
  if (!ends || !ends.a || !ends.b) return PR_STEPS["quiz-color"].render(box, it, ctx);
  return new Promise(resolve => {
    const t0 = performance.now(), A = lab(ends.a.h), B = lab(ends.b.h), M = lab(it.h);
    const d = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], v = [M[0] - A[0], M[1] - A[1], M[2] - A[2]];
    const len2 = d[0] * d[0] + d[1] * d[1] + d[2] * d[2], dot = d[0] * v[0] + d[1] * v[1] + d[2] * v[2];
    const trueT = clamp(len2 ? dot / len2 : .5, 0, 1), nm = prName(it), na = prName(ends.a), nb = prName(ends.b);
    box.innerHTML = `<div class="pr-step pr-s-gradient">
      <div class="pr-q"><span class="pr-note">Place it on the gradient</span><b class="pr-t1" style="${prFit(nm, 40)}">${esc(nm)}</b></div>
      <div class="sf-grad-bar" data-bar style="background:linear-gradient(to right, ${ends.a.h}, ${ends.b.h})"><i class="sf-grad-mark" data-mark style="left:50%"></i></div>
      <div class="sf-grad-ends"><span>${esc(na)}</span><span>${esc(nb)}</span></div>
      <div class="pr-fb" aria-live="polite"></div>
      <div class="pr-foot"><button class="btn" data-set>Set it there</button></div></div>`;
    const bar = box.querySelector("[data-bar]"), mark = box.querySelector("[data-mark]"), fb = box.querySelector(".pr-fb"), foot = box.querySelector(".pr-foot");
    let pos = .5, done = false, dragging = false;
    const setPos = x => { pos = clamp(x, 0, 1); mark.style.left = (pos * 100) + "%"; };
    const fromEvent = e => { const r = bar.getBoundingClientRect(), p = e.changedTouches ? e.changedTouches[0] : e; return (p.clientX - r.left) / r.width; };
    bar.addEventListener("pointerdown", e => { if (done) return; dragging = true; bar.setPointerCapture(e.pointerId); setPos(fromEvent(e)); buzz(3); });
    bar.addEventListener("pointermove", e => { if (!dragging || done) return; setPos(fromEvent(e)); });
    bar.addEventListener("pointerup", () => { dragging = false; });
    const commit = () => {
      if (done) return; done = true;
      const err = Math.abs(pos - trueT), ok = err <= .12;
      mark.classList.add("set");
      const tm = document.createElement("i"); tm.className = "sf-grad-mark true"; tm.style.left = (trueT * 100) + "%"; bar.appendChild(tm);
      buzz(ok ? 12 : [10, 40, 10]);
      fb.innerHTML = `<p>${ok ? "Right where it sits." : pos < trueT ? `${esc(nm)} sits further toward ${esc(nb)} than that.` : `${esc(nm)} sits further toward ${esc(na)} than that.`}</p>`;
      const fam = typeof prFam9 === "function" ? prFam9(it.h) : "";
      sfEyeLog("gradient", fam, err);
      const res = { ok, answer: { kind: "gradient", t: pos, trueT }, ms: performance.now() - t0 };
      if (typeof prHold === "function") prHold(box, foot, () => resolve(res));
      else if (ok) prAuto(() => resolve(res), 1200);
      else prNextBtn(foot, () => resolve(res));
      prKeyer(ctx)(e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); resolve(res); } });
    };
    foot.querySelector("[data-set]").onclick = commit;
    box._prChoose = t => { setPos(t); commit(); };   // smoke/test hook
  });
} };
