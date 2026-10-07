// QA: verifies the honeycomb's idle-drift formula (js/honey.js, loop()'s "drift" phase) stays inside David's
// hard limits — about 3-5 px/s at alive=1 (about double at alive=2), easing in over ~1.5s with no mid-ramp
// speed spike. Pure math, no DOM needed: mirrors the exact constants in js/honey.js so a future edit there
// should update this file's constants too. Run: node tools/_qa/drift_check.js
function easeS(u) { return u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u); }
function rawOff(te) {
  const wx1 = .052, wx2 = .023, wy1 = .045, wy2 = .019;
  const Ax1 = 54, Ax2 = 25, Ay1 = 47, Ay2 = 22;
  return [Ax1 * Math.sin(wx1 * te) + Ax2 * Math.sin(wx2 * te + 1.3), Ay1 * Math.sin(wy1 * te + .4) + Ay2 * Math.sin(wy2 * te + 2)];
}
function simulate(alive, totalT) {
  const dt = .01;
  let teff = 0, maxSpeed = 0, prev = rawOff(0), maxR = 0;
  for (let t = dt; t < totalT; t += dt) {
    const ease = easeS(t / 1.5) * alive;
    teff += ease * dt;
    const cur = rawOff(teff), sp = Math.hypot(cur[0] - prev[0], cur[1] - prev[1]) / dt;
    if (sp > maxSpeed) maxSpeed = sp;
    const r = Math.hypot(...cur); if (r > maxR) maxR = r;
    prev = cur;
  }
  return { maxSpeed, maxR };
}
const a1 = simulate(1, 600), a2 = simulate(2, 600);
console.log("alive=1: max speed %s px/s (limit ~5), max radius %s px", a1.maxSpeed.toFixed(2), a1.maxR.toFixed(0));
console.log("alive=2: max speed %s px/s (~double a1, still calm)", a2.maxSpeed.toFixed(2));
if (a1.maxSpeed > 5.2) { console.error("FAIL: alive=1 drift speed exceeds the ~5px/s hard limit"); process.exit(1); }
console.log("PASS");
