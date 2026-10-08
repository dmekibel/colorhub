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
      if (ok) return prAuto(() => resolve(res), 1300);
      prNextBtn(foot, () => resolve(res));
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
