"use strict";
// First-run orientation, 3 steps max (design/SIMPLIFY/PLAN.md §5/§9), replacing the old boot-time welcome()
// screen for the one case that's Lane 1's to change: boot.js now goes straight to the live map once placed,
// and this plays over it. Any tap dismisses a step; it never comes back once all three have shown
// (S.orient, bumped step by step: 0/undefined -> 1 -> 2 -> 3 "done"). welcome() itself (js/learn.js) is
// untouched -- it's still how an unplaced visitor sees Learn; this only covers the live map/page steps PLAN
// §5 describes, which nothing before this contract showed at all.
function orientDone() { return (S.orient || 0) >= 3; }
function orientToast(el, text, cls) {
  if (!el || !el.isConnected) return;
  const t = document.createElement("div");
  t.className = "orient-tip" + (cls ? " " + cls : "");
  t.innerHTML = `<span>${text}</span>`;
  el.appendChild(t);
  requestAnimationFrame(() => t.classList.add("in"));
  const gone = () => { if (!t.isConnected) return; t.classList.remove("in"); setTimeout(() => t.remove(), 200); };
  setTimeout(gone, 4200);
  t.addEventListener("pointerdown", gone, { once: true });
}
// Step 1: the live map, first time it's ever shown after placement. Step 3: back on the map a second time,
// the Places pill glows once. Both fire from here (js/trail.js tlNote's "hm" branch calls this).
function orientMapStep(el) {
  if (orientDone() || !S.placed) return;
  if (!S.orient) {
    S.orient = 1; save();
    orientToast(el, "Tap any color.");
    return;
  }
  if (S.orient === 2) {
    S.orient = 3; save();
    const pill = el.querySelector("[data-rooms-corner]");
    if (pill) { pill.classList.add("orient-glow"); setTimeout(() => pill.classList.remove("orient-glow"), 1600); }
    orientToast(el, "Learn, Train, Museum and Studio are in here, and every collection.");
  }
}
// Step 2: the first page opened off the map, once step 1 has shown. js/trail.js tlDecorate calls this for
// every page with a back button.
function orientPageStep(el) {
  if (orientDone() || S.orient !== 1) return;
  S.orient = 2; save();
  orientToast(el, "‹ goes back a step. The name on the right takes you back to where you started.");
}
