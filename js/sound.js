"use strict";
// ColorHub sound (js/sound.js). Every sound is synthesized here with the Web Audio API: no audio files, no libraries.
// The feel: soft, warm, rounded and a little bubbly (marimba, kalimba, glass and music-box plucks, gentle pops, airy
// whooshes), quiet and tactile, never arcade-y. The ambient bed is a slow, sparse felt piano. Design note: design/SOUND.md.
//
// Public API (safe to call any time; silent until the first real tap, when Sound is off, in #shot= screenshot mode,
// and in the smoke harness, whose synthetic taps are never trusted so the audio never starts):
//   sfx(name)              a named sound: tap tick select next back open close rooms right wrong near combo flip knew
//                          again complete settle best levelup done
//   sfxColor(hex, o)       the color's own note (one mapping for the whole app: colorTone)
//   sfxChord(hexes, o)     a palette as a rolled chord (o.shares: louder for the bigger areas)
//   colorTone(hex)         { f, deg, inst, bright, pan }: lightness -> pitch, chroma -> brightness, hue family -> instrument
//   sndBuzz(ms)            js/core.js buzz() calls this, so the haptic vocabulary (DESIGN-SYSTEM.md §9) is also the
//                          sound vocabulary: 4 tick, 8 select, 12 right, 10·40·10 wrong, 10·30·20 done, 12·60·12 best
//   sndMenuRows(), sndMenuAct(key)   the settings rows (js/learn.js menu)
//   sndLab()               #/lab/sounds: every sound with a play button, plus a color-to-note toy
// Central hooks (so the games need no call-site edits): buzz(); one delegated click listener (a soft tap on every
// selection, a color's own note on a color, a forward pluck on Next, a reverse pluck on Back/Close); a MutationObserver
// for sheets (whoosh up/down), the rooms fan-out (an arpeggio) and end-of-session result screens (a small flourish).

const SND = { ctx: null, master: null, bus: null, verbIn: null, ambDuck: null, amb: null, ambVerbIn: null, noise: null,
  q: [], qt: 0, last: 0, lastPri: -1, streak: 0, streakT: 0, tally: [0, 0], flourishT: 0, press: null, pressT: 0, appT: 0 };
const SND_PENT = [0, 2, 4, 7, 9];          // the major pentatonic: anything played together sounds friendly
const SND_MAJ = [0, 2, 4, 5, 7, 9, 11];
const SND_C4 = 261.63;
const sndOn = () => !(typeof S !== "undefined" && S && S.sound === false);
const sndMusicOn = () => !!(typeof S !== "undefined" && S && S.music === true);
const sndVol = () => (typeof S !== "undefined" && S && S.vol != null && isFinite(+S.vol)) ? clamp(+S.vol, 0, 1) : .7;
const sndShot = () => location.hash.startsWith("#shot=");
// pentatonic degree -> frequency (degree 0 = C5 unless a base is given)
const sndDeg = (d, base = 523.25) => base * 2 ** ((12 * Math.floor(d / 5) + SND_PENT[((d % 5) + 5) % 5]) / 12);

// ---------- the one color -> sound mapping ----------
// Lightness is pitch (dark colors sit low, pale ones high), on the pentatonic scale from C4 to A6, so any palette is
// in tune with itself. Chroma is timbre: a grey is a soft felt sine, a vivid color gets bright partials. The hue
// family picks the instrument: warm reds, oranges and yellows a marimba, greens and teals a kalimba, blues glass,
// violets and magentas a music box.
function colorTone(hex) {
  const [L, C, H] = lch(hex);
  const deg = Math.round(clamp(L, 0, 100) / 100 * 13);
  const semi = 12 * Math.floor(deg / 5) + SND_PENT[deg % 5];
  const inst = C < 9 ? "felt" : (H >= 345 || H < 110) ? "marimba" : H < 220 ? "kalimba" : H < 315 ? "glass" : "musicbox";
  return { f: SND_C4 * 2 ** (semi / 12), deg, semi, inst, bright: clamp(C / 80, 0, 1), pan: C < 9 ? 0 : Math.round(Math.sin(H * Math.PI / 180) * 25) / 100, L, C, H };
}
const SND_INST = {
  marimba: { ratio: 4, index: 1.1, idec: .03, dur: .5, lp: 3800 },
  kalimba: { ratio: 5.4, index: .9, idec: .025, dur: .62, lp: 4200 },
  glass: { ratio: 3.5, index: 1.3, idec: .16, dur: .85, lp: 6500 },
  musicbox: { ratio: 7.1, index: .7, idec: .06, dur: .75, lp: 7000 },
  felt: { ratio: 2, index: .22, idec: .1, dur: .55, lp: 1800 },
};
const SND_INST_WORD = { marimba: "marimba", kalimba: "kalimba", glass: "glass bell", musicbox: "music box", felt: "felt" };

// ---------- the audio graph (built on the first trusted gesture) ----------
function sndIR(sec, decay, bright) {
  const c = SND.ctx, n = Math.floor(c.sampleRate * sec), b = c.createBuffer(2, n, c.sampleRate), pre = Math.floor(c.sampleRate * .012);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch); let lp = 0;
    for (let i = pre; i < n; i++) { const t = i / n; lp += ((Math.random() * 2 - 1) - lp) * bright * (1 - t * .75); d[i] = lp * (1 - t) ** decay; }
  }
  return b;
}
function sndBuild() {
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
  try { if (navigator.audioSession) navigator.audioSession.type = "ambient"; } catch (e) {}   // mix with the user's music; obey the silent switch
  try { SND.ctx = new AC({ latencyHint: "interactive" }); } catch (e) { try { SND.ctx = new AC(); } catch (e2) { return false; } }
  const c = SND.ctx, g = v => { const n = c.createGain(); n.gain.value = v; return n; };
  SND.master = g(sndLevel());
  const comp = c.createDynamicsCompressor();
  comp.threshold.value = -20; comp.knee.value = 18; comp.ratio.value = 3; comp.attack.value = .004; comp.release.value = .2;
  SND.master.connect(comp); comp.connect(c.destination);
  SND.bus = g(1); SND.bus.connect(SND.master);
  // a small room for the UI (air, not echo)
  const v = c.createConvolver(); v.buffer = sndIR(1.3, 3.2, .55);
  SND.verbIn = g(1); const vo = g(.55); SND.verbIn.connect(v); v.connect(vo); vo.connect(SND.master);
  // the ambient bed: its own duck (quieter inside games) and a long, dark hall
  SND.ambDuck = g(1); SND.ambDuck.connect(SND.master);
  const av = c.createConvolver(); av.buffer = sndIR(4.6, 2.4, .32);
  SND.ambVerbIn = g(1); const avo = g(.8); SND.ambVerbIn.connect(av); av.connect(avo); avo.connect(SND.ambDuck);
  const nb = c.createBuffer(1, c.sampleRate, c.sampleRate), nd = nb.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  SND.noise = nb;
  return true;
}
const sndLevel = () => .62 * sndVol() ** 1.6;
function sndUnlock() {
  if (sndShot() || (!sndOn() && !sndMusicOn())) return;
  if (!SND.ctx && !sndBuild()) return;
  if (SND.ctx.state !== "running") { try { const p = SND.ctx.resume(); if (p && p.catch) p.catch(() => {}); } catch (e) {} }
  if (sndMusicOn() && !SNDA.on) sndAmbient(true);
}
// iPhone only lets audio start inside a real gesture; synthetic (untrusted) events never start it
["pointerdown", "touchend", "click", "keydown"].forEach(t => addEventListener(t, e => { if (e.isTrusted) sndUnlock(); }, { capture: true, passive: true }));
document.addEventListener("visibilitychange", () => {
  if (!SND.ctx) return;
  try { if (document.hidden) SND.ctx.suspend(); else if (sndOn() || sndMusicOn()) SND.ctx.resume().catch(() => {}); } catch (e) {}
});

// ---------- voices ----------
// every envelope: a linear attack from 0 (no click), then an exponential-style fall to silence before the stop
function sndEnv(gain, t, a, peak, d) {
  gain.setValueAtTime(0, t); gain.linearRampToValueAtTime(peak, t + a); gain.setTargetAtTime(0, t + a, d / 6);
  return t + a + d + .04;
}
function sndOut(node, o) {
  const c = SND.ctx; let n = node;
  if (o.pan && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = o.pan; n.connect(p); n = p; }
  n.connect(o.bus || SND.bus);
  if (o.verb) { const s = c.createGain(); s.gain.value = o.verb; n.connect(s); s.connect(o.verbIn || SND.verbIn); }
}
function sndLP(input, f, q = .3) { const lp = SND.ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = f; lp.Q.value = q; input.connect(lp); return lp; }
// a two-operator FM pluck: the modulator's index falls fast, so the attack is bright and the tail is a pure tone
function sndFM(f, t, o) {
  const c = SND.ctx, car = c.createOscillator(), mod = c.createOscillator(), mg = c.createGain(), vca = c.createGain();
  car.frequency.setValueAtTime(f, t);
  if (o.glide) car.frequency.exponentialRampToValueAtTime(f * o.glide, t + (o.gt || .06));
  mod.frequency.value = f * o.ratio;
  mg.gain.setValueAtTime(f * o.index, t); mg.gain.setTargetAtTime(f * o.index * .03, t, o.idec);
  mod.connect(mg); mg.connect(car.frequency); car.connect(vca);
  const end = sndEnv(vca.gain, t, o.att || .004, o.vel, o.dur);
  car.start(t); mod.start(t); car.stop(end); mod.stop(end);
  sndOut(o.lp ? sndLP(vca, o.lp) : vca, o);
}
function sndInst(name, f, t, o = {}) { const P = SND_INST[name] || SND_INST.marimba; sndFM(f, t, { ...P, ...o, vel: o.vel != null ? o.vel : .14 }); }
// a plain sine with an optional glide: pops, bloops, thuds
function sndSine(f, t, o) {
  const c = SND.ctx, osc = c.createOscillator(), vca = c.createGain();
  osc.type = o.type || "sine"; osc.frequency.setValueAtTime(f, t);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + (o.gt || .05));
  osc.connect(vca);
  const end = sndEnv(vca.gain, t, o.att || .003, o.vel, o.dur);
  osc.start(t); osc.stop(end);
  sndOut(o.lp ? sndLP(vca, o.lp) : vca, o);
}
// filtered noise: whooshes, paper, the felt of a hammer
function sndNoise(t, o) {
  const c = SND.ctx, src = c.createBufferSource(), bp = c.createBiquadFilter(), vca = c.createGain();
  src.buffer = SND.noise; src.loop = true;
  bp.type = o.hp ? "highpass" : "bandpass"; bp.Q.value = o.q || .9;
  bp.frequency.setValueAtTime(o.f0, t); if (o.f1) bp.frequency.exponentialRampToValueAtTime(o.f1, t + o.dur);
  src.connect(bp); bp.connect(vca);
  vca.gain.setValueAtTime(0, t); vca.gain.linearRampToValueAtTime(o.vel, t + (o.att || o.dur * .45)); vca.gain.linearRampToValueAtTime(0, t + o.dur);
  src.start(t, Math.random() * .5); src.stop(t + o.dur + .02);
  sndOut(vca, o);
}
// a soft, warm horn: two detuned saws and a triangle through a lowpass that swells open (the flourish)
function sndBrass(f, t, dur, vel, o = {}) {
  const c = SND.ctx, vca = c.createGain(), lp = c.createBiquadFilter();
  lp.type = "lowpass"; lp.Q.value = .8;
  lp.frequency.setValueAtTime(220, t); lp.frequency.linearRampToValueAtTime(700 + f * 2.2, t + .09); lp.frequency.setTargetAtTime(500 + f, t + .1, dur * .5);
  const oscs = [["sawtooth", -7], ["sawtooth", 6], ["triangle", 0]].map(([type, cents]) => { const x = c.createOscillator(); x.type = type; x.frequency.value = f; x.detune.value = cents; x.connect(lp); return x; });
  lp.connect(vca);
  vca.gain.setValueAtTime(0, t); vca.gain.linearRampToValueAtTime(vel, t + (o.att || .06)); vca.gain.setTargetAtTime(vel * .65, t + .08, dur * .4);
  vca.gain.setTargetAtTime(0, t + dur, .07);
  const end = t + dur + .5; oscs.forEach(x => { x.start(t); x.stop(end); });
  sndOut(vca, { verb: .22, ...o });
}
// the felt piano of the ambient bed: a few slightly stretched partials, a soft hammer, a lowpass that closes as it rings
function sndPiano(f, t, vel, bus, verbIn) {
  const c = SND.ctx, vca = c.createGain(), lp = c.createBiquadFilter();
  lp.type = "lowpass"; lp.Q.value = .2;
  lp.frequency.setValueAtTime(Math.min(4200, 700 + f * 2), t); lp.frequency.setTargetAtTime(380 + f * .5, t + .02, .7);
  [[1, 1], [2, .38], [3, .14], [4, .06]].forEach(([n, a]) => {
    const o = c.createOscillator(), g = c.createGain(); o.frequency.value = f * n * (1 + .0004 * n * n); g.gain.value = a; o.connect(g); g.connect(lp); o.start(t); o.stop(t + 7);
  });
  lp.connect(vca);
  vca.gain.setValueAtTime(0, t); vca.gain.linearRampToValueAtTime(vel, t + .014); vca.gain.setTargetAtTime(0, t + .014, 1.15);
  // the felt: a tiny low thump under the note
  const src = c.createBufferSource(), th = c.createBiquadFilter(), tg = c.createGain();
  src.buffer = SND.noise; th.type = "lowpass"; th.frequency.value = 320; src.connect(th); th.connect(tg);
  tg.gain.setValueAtTime(0, t); tg.gain.linearRampToValueAtTime(vel * .35, t + .006); tg.gain.linearRampToValueAtTime(0, t + .05);
  src.start(t, Math.random() * .5); src.stop(t + .07); tg.connect(bus);
  const dry = c.createGain(); dry.gain.value = .6; vca.connect(dry); dry.connect(bus);
  const wet = c.createGain(); wet.gain.value = .85; vca.connect(wet); wet.connect(verbIn);
}
function sndPad(freqs, t, len, bus, verbIn) {
  const c = SND.ctx, vca = c.createGain(), lp = c.createBiquadFilter(), lfo = c.createOscillator(), lg = c.createGain();
  lp.type = "lowpass"; lp.frequency.value = 620; lp.Q.value = .15;
  lfo.frequency.value = .05 + Math.random() * .04; lg.gain.value = 160; lfo.connect(lg); lg.connect(lp.frequency);
  const end = t + len + 7;
  freqs.forEach(f => [-5, 5].forEach(cents => { const o = c.createOscillator(); o.type = "triangle"; o.frequency.value = f; o.detune.value = cents; o.connect(lp); o.start(t); o.stop(end); }));
  lp.connect(vca);
  const peak = .05 / Math.sqrt(freqs.length);
  vca.gain.setValueAtTime(0, t); vca.gain.linearRampToValueAtTime(peak, t + 4.5); vca.gain.setValueAtTime(peak, t + len); vca.gain.linearRampToValueAtTime(0, t + len + 6);
  lfo.start(t); lfo.stop(end);
  vca.connect(bus); const wet = c.createGain(); wet.gain.value = .5; vca.connect(wet); wet.connect(verbIn);
}

// ---------- the sound palette ----------
function sndRightDeg() { return 2 + Math.min(SND.streak - 1, 9); }
// the sparkle: notes taken from the colors on screen when there are some (a result screen's swatches), else a bright run
function sndSparkle(t, hexes, o = {}) {
  let degs = (hexes || []).map(h => { try { return colorTone(h).deg; } catch (e) { return null; } }).filter(d => d != null);
  degs = [...new Set(degs)].sort((a, b) => a - b).slice(-5).map(d => d + 5);   // an octave above, in the colors' own order of lightness
  if (degs.length < 3) degs = o.high ? [7, 9, 10, 12, 14] : [5, 7, 8, 10, 12];
  degs.forEach((d, i) => sndInst("glass", sndDeg(d, SND_C4), t + i * .055, { vel: (o.vel || .05) * (1 - i * .08), verb: .4, dur: .9 }));
}
const SND_FX = {
  // a soft "pok": the touch of a rounded button
  tap: t => { sndSine(560, t, { to: 820, gt: .018, vel: .085, dur: .07, lp: 2600 }); sndNoise(t, { f0: 3200, q: 1.4, vel: .012, dur: .012 }); },
  // lighter still: a bubble crossing the lens, a slider stop
  tick: t => sndSine(1250, t, { to: 1480, gt: .012, vel: .04, dur: .035 }),
  // the bubbly select: a pop that rises
  select: t => { sndSine(330, t, { to: 680, gt: .07, vel: .11, dur: .14, verb: .12 }); sndSine(660, t + .01, { to: 1360, gt: .07, vel: .025, dur: .1 }); },
  // forward: two soft marimba notes stepping up
  next: t => { sndInst("marimba", sndDeg(2), t, { vel: .09, dur: .3 }); sndInst("marimba", sndDeg(4), t + .06, { vel: .11, dur: .4, verb: .12 }); },
  // back / close: a tiny reverse pluck, swelling in and stepping down
  back: t => sndSine(sndDeg(4), t, { to: sndDeg(2), gt: .08, att: .045, vel: .075, dur: .07, lp: 2200 }),
  open: t => { sndNoise(t, { f0: 480, f1: 2600, q: .8, vel: .04, dur: .22 }); sndSine(420, t + .12, { to: 780, gt: .06, vel: .06, dur: .12, verb: .15 }); },
  close: t => { sndNoise(t, { f0: 2400, f1: 520, q: .8, vel: .032, dur: .2 }); sndInst("marimba", sndDeg(0), t + .1, { vel: .05, dur: .3 }); },
  // the rooms fan out: one note per bubble, rising with their 30 ms stagger
  rooms: (t, n = 4) => { for (let i = 0; i < Math.min(n, 6); i++) sndInst("kalimba", sndDeg([0, 2, 3, 4, 5, 7][i]), t + .04 + i * .035, { vel: .06, dur: .45, verb: .15 }); },
  // right: a rising pair that climbs the scale with the streak
  right: t => { const d = sndRightDeg(); sndInst("marimba", sndDeg(d), t, { vel: .13, dur: .45 }); sndInst("marimba", sndDeg(d + 2), t + .075, { vel: .14, dur: .55, verb: .18 }); sndInst("glass", sndDeg(d + 7), t + .075, { vel: .03, dur: .7, verb: .2 }); },
  // wrong: a soft, low, muted thud; never a buzzer
  wrong: t => { sndSine(210, t, { to: 140, gt: .12, att: .006, vel: .14, dur: .24, lp: 650 }); sndInst("felt", 196, t + .01, { vel: .05, dur: .3, index: .3 }); },
  // close but not it: the same note twice, the second softer
  near: t => { sndInst("marimba", sndDeg(1), t, { vel: .09, dur: .3 }); sndInst("marimba", sndDeg(1), t + .1, { vel: .06, dur: .35 }); },
  // a streak moment: the right pair plus a little rising sparkle
  combo: t => { SND_FX.right(t); [0, 2, 4].forEach((k, i) => sndInst("glass", sndDeg(sndRightDeg() + 5 + k), t + .16 + i * .045, { vel: .04, dur: .6, verb: .3 })); },
  // the swipe deck: a card turning over is a paper whisper (plus the color's own note, quietly, once it shows)
  flip: (t, hex) => { sndNoise(t, { f0: 2400, f1: 5200, q: 1.1, vel: .05, dur: .09 }); sndNoise(t + .035, { f0: 4200, f1: 3000, q: 1.4, vel: .025, dur: .06 }); if (hex) sndColorAt(hex, t + .06, { vel: .07 }); },
  knew: t => { sndNoise(t, { f0: 900, f1: 3200, q: .7, vel: .03, dur: .16 }); const d = sndRightDeg(); sndInst("marimba", sndDeg(d), t + .05, { vel: .11, dur: .4 }); sndInst("marimba", sndDeg(d + 2), t + .12, { vel: .12, dur: .5, verb: .15 }); },
  again: t => { sndNoise(t, { f0: 2600, f1: 800, q: .7, vel: .028, dur: .16 }); sndInst("felt", sndDeg(1, SND_C4), t + .05, { vel: .08, dur: .35 }); sndInst("felt", sndDeg(0, SND_C4), t + .13, { vel: .07, dur: .45 }); },
  // end of a session that went well: a warm horn "ba-daah" (a short G chord resolving to a swelling C) and a sparkle
  complete: (t, hexes) => {
    [196, 246.94, 293.66].forEach(f => sndBrass(f, t, .1, .032));
    [261.63, 329.63, 392, 523.25].forEach((f, i) => sndBrass(f, t + .15 + i * .012, .5, .036));
    sndSparkle(t + .32, hexes);
  },
  // end of a session that was mostly misses: a gentle, open chord, no fanfare (kind, not celebratory)
  settle: t => [261.63, 329.63, 392].forEach((f, i) => sndInst("felt", f, t + i * .05, { vel: .07, dur: .9, verb: .3 })),
  // a new best on top of the flourish: a higher sparkle
  best: (t, hexes) => sndSparkle(t, hexes, { high: 1, vel: .045 }),
  // level up: three quick horn steps, a swelling chord and the sparkle (original; built on C major)
  levelup: (t, hexes) => {
    [329.63, 392, 523.25].forEach((f, i) => sndBrass(f, t + i * .11, .08, .04));
    [523.25, 659.25, 783.99].forEach(f => sndBrass(f, t + .34, .55, .03));
    sndSparkle(t + .5, hexes, { high: 1 });
  },
  // a set or a lesson done (without a result screen): three notes up and a soft chord
  done: t => { [0, 2, 4].forEach((d, i) => sndInst("marimba", sndDeg(d), t + i * .07, { vel: .1, dur: .45, verb: .15 })); [261.63, 392].forEach(f => sndInst("felt", f, t + .22, { vel: .05, dur: .8, verb: .25 })); },
  color: (t, a) => sndColorAt(a.hex, t, a),
  // a solved gradient played as a rising scale: its colors' own notes, low to high
  scale: (t, a) => { const l = [], seen = new Set(); (a.hexes || []).forEach(h => { if (!/^#[0-9a-f]{6}$/i.test(h || "")) return; const tn = colorTone(h); if (!seen.has(tn.semi)) { seen.add(tn.semi); l.push({ h, f: tn.f }); } }); l.sort((x, y) => x.f - y.f); const n = Math.min(l.length, 10), step = n > 1 ? l.length / n : 1; for (let i = 0; i < n; i++) sndColorAt(l[Math.min(l.length - 1, Math.floor(i * step))].h, t + i * .075, { vel: .09, long: i === n - 1, verb: .2 }); },
  chord: (t, a) => sndChordAt(a.hexes, t, a),
};
const SND_PRI = { scale: 7, tick: 1, tap: 1, select: 2, color: 2, flip: 3, next: 3, back: 3, open: 3, close: 3, rooms: 3, chord: 4, near: 4, right: 5, wrong: 5, knew: 5, again: 5, combo: 6, done: 7, settle: 8, complete: 8, levelup: 9, best: 9 };
function sndColorAt(hex, t, o = {}) {
  const tn = colorTone(hex), P = SND_INST[tn.inst];
  sndFM(tn.f, t, { ...P, index: P.index * (.3 + .9 * tn.bright), lp: P.lp * (.45 + .55 * tn.bright), vel: o.vel != null ? o.vel : .12, pan: tn.pan, verb: o.verb != null ? o.verb : .16, dur: P.dur * (o.long ? 1.6 : 1) });
}
function sndChordAt(hexes, t, o = {}) {
  const seen = new Set(), list = [];
  (hexes || []).forEach((h, i) => { if (!/^#[0-9a-f]{6}$/i.test(h || "")) return; const tn = colorTone(h); if (seen.has(tn.semi)) return; seen.add(tn.semi); list.push({ h, tn, w: o.shares ? o.shares[i] || .1 : 1 }); });
  list.sort((a, b) => a.tn.f - b.tn.f).slice(0, 8).forEach((x, i, all) => {
    const vel = o.shares ? .05 + .12 * Math.sqrt(clamp(x.w, 0, 1)) : .1;
    sndColorAt(x.h, t + i * (o.gap != null ? o.gap : .07), { vel, long: i === all.length - 1, verb: .22 });
  });
}

// ---------- the queue: one sound per gesture, the most meaningful one wins ----------
// A tap, a buzz() and an explicit sfx() in the same task are collected, then one plays: explicit calls beat sounds
// implied by buzz()/clicks, and a higher priority beats a lower one. Never more than one sound per 60 ms unless the
// newer one matters more (a "right" right after a tap).
function sndQ(name, arg, explicit) {
  if (!SND.ctx || !sndOn() || sndShot()) return;
  SND.q.push({ name, arg, explicit: !!explicit, pri: SND_PRI[name] || 1 });
  if (!SND.qt) SND.qt = setTimeout(sndFlush, 0);
}
function sndFlush() {
  SND.qt = 0; const q = SND.q; SND.q = []; if (!q.length) return;
  const pool = q.some(x => x.explicit) ? q.filter(x => x.explicit) : q;
  const best = pool.reduce((a, x) => x.pri >= a.pri ? x : a);
  const now = performance.now();
  if (now - SND.last < 60 && best.pri <= SND.lastPri) return;
  SND.last = now; SND.lastPri = best.pri;
  sndPlay(best.name, best.arg);
}
function sndPlay(name, arg) {
  if (!SND.ctx || !SND_FX[name]) return;
  try { SND_FX[name](SND.ctx.currentTime + .006, arg); } catch (e) {}
}
function sfx(name, arg) { sndQ(name, arg, true); }
function sfxColor(hex, o = {}) { if (/^#[0-9a-f]{6}$/i.test(hex || "")) sndQ("color", { ...o, hex }, true); }
function sfxChord(hexes, o = {}) { sndQ("chord", { ...o, hexes }, true); }

// ---------- buzz() -> sound: the haptic vocabulary is the sound vocabulary ----------
function sndCtxDeck() { return typeof app !== "undefined" && app && app.querySelector(".screen.deck .card.revealed, .pr-card.revealed:not(.pr-blitzcard)"); }
function sndBuzz(ms) {
  if (!SND.ctx) return;
  const now = performance.now();
  if (now - SND.streakT > 25000) SND.streak = 0;
  const arr = Array.isArray(ms) ? ms : null, n = arr ? arr[0] : +ms || 0;
  let name;
  if (!arr) name = n <= 6 ? "tick" : n < 10 ? "select" : "right";
  else if (arr.length >= 5) name = "levelup";
  else if (arr[1] === 40) name = "wrong";
  else if (arr[1] === 50) name = "combo";
  else if (arr[0] === 12 && arr[1] === 60) name = "best";
  else if (arr[1] === 30 && arr[2] === arr[0]) name = "near";
  else name = "done";
  const deck = (name === "select" || name === "right" || name === "wrong") && sndCtxDeck();
  if (name === "right" || name === "combo") { if (name === "right") SND.streak++; SND.streakT = now; SND.tally[0]++; }
  if (name === "wrong") { SND.streak = 0; SND.tally[1]++; }
  if (deck) {
    if (name === "select") { const c = deck.style.getPropertyValue("--c").trim(); return sndQ("flip", /^#[0-9a-f]{6}$/i.test(c) ? c : null); }
    return sndQ(name === "right" ? "knew" : "again");
  }
  // a best or a level-up that lands on a result screen's flourish adds its sparkle on top instead of replacing it
  if ((name === "best" || name === "done") && now - SND.flourishT < 2500) { if (name === "best" && sndOn() && !sndShot()) sndPlay("best", sndScreenHexes()); return; }
  // the result screen's flourish is already on its way: no tick under it
  if ((name === "tick" || name === "select") && now - SND.flourishT < 400) return;
  // a tick or a select on a color answers with that color's own note
  if ((name === "tick" || name === "select") && SND.press && now - SND.pressT < 600 && !(SND.press.closest && SND.press.closest(SND_QUIET))) { const h = sndHexOf(SND.press); if (h) return sndQ("color", { hex: h, vel: name === "tick" ? .08 : .11 }); }
  sndQ(name, name === "levelup" || name === "best" ? sndScreenHexes() : undefined);
}

// ---------- reading colors off the page ----------
const SND_HEXRE = /^#?[0-9a-f]{6}$/i;
const sndNormHex = v => v ? (v[0] === "#" ? v : "#" + v).toUpperCase() : null;
// tiles whose own note would give the answer away (lightness is pitch): an unsolved Gradients board, Odd one out's tiles
const SND_QUIET = ".hg-board:not(.solved) .hg-s, .oo-t, [data-nosnd]";
const SND_CLICKABLE = "button, a[href], [role=button], [data-swatch], [data-to], label, summary, .oo-t, .pchip, .kin";
function sndHexOf(el) {
  const stop = el && el.closest ? el.closest(SND_CLICKABLE) : null;
  for (let n = el, i = 0; n && n.nodeType === 1 && i < 4; n = n.parentElement, i++) {
    const d = n.dataset || {};
    for (const k of ["swatch", "hex", "h", "c", "color"]) { const v = d[k]; if (v && SND_HEXRE.test(v.trim())) return sndNormHex(v.trim()); }
    const s = n.style && n.style.getPropertyValue("--c").trim(); if (s && SND_HEXRE.test(s)) return sndNormHex(s);
    if (n === stop) {
      // a chip whose color sits on its first child (.kin > i, .pchip > i)
      const i0 = n.querySelector(":scope > i[style*='--c']"); const s2 = i0 && i0.style.getPropertyValue("--c").trim();
      return s2 && SND_HEXRE.test(s2) && !(n.textContent || "").trim().length ? sndNormHex(s2) : null;
    }
  }
  return null;
}
function sndScreenHexes() {
  if (typeof app === "undefined" || !app) return [];
  const out = [];
  app.querySelectorAll(".screen [style*='--c'], .screen [data-swatch]").forEach(n => {
    if (out.length >= 12) return;
    const v = (n.dataset.swatch || n.style.getPropertyValue("--c") || "").trim(); if (SND_HEXRE.test(v)) out.push(sndNormHex(v));
  });
  return out;
}

// ---------- the central hooks ----------
// one delegated click listener: Next steps forward, Back/Close steps back, a color plays its note, anything else taps
document.addEventListener("pointerdown", e => { if (e.isTrusted) { SND.press = e.target; SND.pressT = performance.now(); } }, { capture: true, passive: true });
document.addEventListener("click", e => {
  if (!e.isTrusted || !SND.ctx) return;
  const t = e.target && e.target.closest ? e.target : null; if (!t) return;
  SND.press = t; SND.pressT = performance.now();
  if (t.closest(".snd-lab [data-snd], .snd-lab [data-play], .snd-lab [data-paint], .snd-lab [data-tg]")) return;   // the lab plays its own
  if (t.closest("[data-next], [data-nextlv], [data-a='next']")) return sndQ("next");
  if (t.closest("[data-back], [data-close], .pr-x")) return sndQ("back");
  if (t.closest("input, textarea, select, .scrim")) return;
  const hit = t.closest(SND_CLICKABLE) || (getComputedStyle(t).cursor === "pointer" ? t : null);
  if (!hit) return;
  const h = t.closest(SND_QUIET) ? null : sndHexOf(t);
  if (h) return sndQ("color", { hex: h, vel: .11 });
  sndQ("tap");
}, { capture: true, passive: true });
// sheets whoosh, the rooms fan out, and an end-of-session screen gets its flourish
const SND_RESULT = ".screen.result, .screen.pr-res, .screen.dp-end";
function sndOnResult(el) {
  const [r, w] = SND.tally; SND.tally = [0, 0];
  SND.flourishT = performance.now();
  if (!SND.ctx || !sndOn() || sndShot()) return;
  const good = r + w === 0 || r / (r + w) >= .5;
  // after the screen's own rise-in has started, so the sound lands with the headline
  setTimeout(() => { if (el.isConnected) sndQ(good ? "complete" : "settle", sndScreenHexes(), true); }, 160);
}
function sndWatch() {
  if (typeof app === "undefined" || !app || typeof MutationObserver === "undefined") return;
  new MutationObserver(() => {
    SND.appT = performance.now();
    const res = app.querySelector(SND_RESULT);
    if (res && !res.sndSeen) { res.sndSeen = 1; sndOnResult(res); }
    sndAmbDuck();
  }).observe(app, { childList: true });
  new MutationObserver(muts => {
    if (!SND.ctx) return;
    muts.forEach(m => {
      m.addedNodes.forEach(n => {
        if (n.nodeType !== 1) return;
        if (n.classList.contains("sheet")) sndQ("open");
        else if (n.classList.contains("rooms-stem")) sndQ("rooms", n.querySelectorAll("[data-room]").length);
      });
      m.removedNodes.forEach(n => {
        // a sheet closing on its own (not swept away by a new screen, which already tapped)
        if (n.nodeType === 1 && n.classList.contains("sheet") && performance.now() - SND.appT > 120) sndQ("close");
      });
    });
  }).observe(document.body, { childList: true });
}
sndWatch();

// ---------- the ambient bed: a calm, generative felt piano ----------
// Sparse, slow and mostly silence. Each section picks the next chord by a small chain (I, ii, iii, IV, vi), maybe lays a
// pad under it, plays zero to two short phrases (two to six notes drawn from the chord, rubato), then rests. The key
// (C, F or G major, which all share the UI's C pentatonic) and every choice are random, so it never repeats exactly.
// Off by default (Settings, or #/lab/sounds). Inside games (the booth screens) it ducks to a whisper.
const SNDA = { on: false, timer: 0, t: 0, key: 0, chord: 0, bus: null, verbIn: null };
const SNDA_NEXT = { 0: [3, 5, 3, 1, 2], 1: [3, 0, 5], 2: [5, 3], 3: [0, 5, 1, 0], 5: [3, 1, 0, 3] };
const sndRand = (a, b) => a + Math.random() * (b - a);
const sndPick = a => a[Math.random() * a.length | 0];
const sndScaleF = d => SND_C4 * 2 ** ((SNDA.key + 12 * Math.floor(d / 7) + SND_MAJ[((d % 7) + 7) % 7]) / 12);
function sndAmbient(on) {
  if (!SND.ctx) { if (on) sndUnlock(); return; }
  const c = SND.ctx, t = c.currentTime;
  if (on) {
    if (SNDA.on) return;
    SNDA.on = true;
    // a fresh bus each time: anything still scheduled on an old one fades with it
    const bus = c.createGain(); bus.gain.setValueAtTime(0, t); bus.gain.linearRampToValueAtTime(.9, t + 3); bus.connect(SND.ambDuck);
    const vin = c.createGain(); vin.connect(SND.ambVerbIn); vin.gain.setValueAtTime(0, t); vin.gain.linearRampToValueAtTime(1, t + 3);
    SNDA.bus = bus; SNDA.verbIn = vin;
    SNDA.key = sndPick([0, 5, 7]); SNDA.chord = 0; SNDA.t = t + .8;
    sndAmbDuck(); sndAmbTick();
  } else {
    SNDA.on = false; clearTimeout(SNDA.timer);
    [SNDA.bus, SNDA.verbIn].forEach(g => { if (!g) return; g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0, t + 2.5); setTimeout(() => { try { g.disconnect(); } catch (e) {} }, 3000); });
    SNDA.bus = SNDA.verbIn = null;
  }
}
function sndAmbDuck() {
  if (!SND.ctx || !SND.ambDuck) return;
  const booth = document.documentElement.classList.contains("booth") || !!document.querySelector(".screen.deck, .screen.pr-booth, .oo-board");
  SND.ambDuck.gain.setTargetAtTime(booth ? .35 : 1, SND.ctx.currentTime, .8);
}
function sndAmbTick() {
  if (!SNDA.on || !SND.ctx) return;
  const now = SND.ctx.currentTime;
  if (SNDA.t < now) SNDA.t = now + .3;
  while (SNDA.t < now + 6) SNDA.t += sndAmbSection(SNDA.t);
  SNDA.timer = setTimeout(sndAmbTick, 1500);
}
function sndAmbSection(t0) {
  const bus = SNDA.bus, vin = SNDA.verbIn;
  SNDA.chord = sndPick(SNDA_NEXT[SNDA.chord] || [0]);
  const r = SNDA.chord, tones = [r, r + 2, r + 4, r + 6];
  const kind = Math.random();
  let t = t0 + sndRand(.5, 2.5);
  const phrases = kind < .2 ? 0 : kind < .75 ? 1 : 2;
  for (let p = 0; p < phrases; p++) {
    // a low root under the first note, sometimes
    if (Math.random() < .5) sndPiano(sndScaleF(r - 7), t, sndRand(.07, .1), bus, vin);
    let d = 7 + sndPick(tones.map(x => x % 7)) + (Math.random() < .3 ? 7 : 0);
    const n = 2 + (Math.random() * 5 | 0);
    for (let i = 0; i < n; i++) {
      const last = i === n - 1;
      sndPiano(sndScaleF(d), t, sndRand(.1, .16) * (last ? .8 : 1), bus, vin);
      if (Math.random() < .22) sndPiano(sndScaleF(d - 2), t + sndRand(0, .04), sndRand(.06, .09), bus, vin);
      t += sndPick([.55, .7, .9, 1.1, 1.4, 1.8]) * (last ? 1.6 : 1);
      // a gentle walk that leans toward the chord tones and stays in a two-octave window
      const step = sndPick([-2, -1, -1, 1, 1, 2, 3, -3]);
      d = clamp(d + step, 5, 18);
      if (Math.random() < .5) { const ct = tones.map(x => x % 7); const m = ((d % 7) + 7) % 7; if (!ct.includes(m)) d += ct.includes((m + 1) % 7) ? 1 : -1; }
    }
    t += sndRand(2, 5);
  }
  const rest = sndRand(5, 13);
  const len = t + rest - t0;
  if (Math.random() < .55 || phrases === 0) sndPad([sndScaleF(r - 7), sndScaleF(r - 3), sndScaleF(r + 2)], t0, Math.max(6, len - 3), bus, vin);
  return len;
}

// ---------- settings ----------
function sndSet(k, v) {
  S[k] = v; if (typeof save === "function") save();
  if (k === "vol" && SND.master) SND.master.gain.setTargetAtTime(sndLevel(), SND.ctx.currentTime, .05);
  if (k === "sound" && v) sndUnlock();
  if (k === "music") { if (v) sndUnlock(); sndAmbient(!!v); }
}
// two rows for the settings menu (js/learn.js menu()): easy to move when that menu is redesigned
function sndMenuRows() {
  return `<button class="item" data-a="snd-sound">Sound: ${sndOn() ? "on" : "off"} ${ICON.chev}</button>
    <button class="item" data-a="snd-music">Calm music: ${sndMusicOn() ? "on" : "off"} ${ICON.chev}</button>
    <button class="item" data-a="snd-lab">Hear every sound ${ICON.chev}</button>`;
}
function sndMenuAct(a) {
  if (a === "snd-sound") { sndSet("sound", !sndOn()); if (sndOn()) sfx("select"); toast(`Sound ${sndOn() ? "on" : "off"}`); return true; }
  if (a === "snd-music") { sndSet("music", !sndMusicOn()); toast(sndMusicOn() ? "Calm music on" : "Calm music off"); return true; }
  if (a === "snd-lab") { sndLab(); return true; }
  return false;
}

// ---------- #/lab/sounds: hear every sound, and play with colors ----------
const SND_LAB_GROUPS = [
  ["Taps and moves", [["tap", "Tap", "every button"], ["tick", "Tick", "a bubble passing, a slider stop"], ["select", "Select", "a choice"], ["next", "Next", "moving on"], ["back", "Back", "back or close"], ["open", "Sheet up", "a sheet opens"], ["close", "Sheet down", "a sheet closes"], ["rooms", "Rooms", "the rooms fan out"]]],
  ["Answers", [["right", "Right", "climbs with your streak"], ["streak", "A streak", "six right in a row"], ["near", "Close", "almost"], ["wrong", "Not quite", "soft and low"], ["combo", "In a row", "a streak moment"]]],
  ["Cards", [["flip", "Turn over", "then the color's note"], ["knew", "Knew it", "swipe right"], ["again", "Again", "swipe left"]]],
  ["Endings", [["complete", "Well done", "a session that went well"], ["settle", "Not yet", "a kind ending"], ["best", "A new best", "the sparkle on top"], ["levelup", "Level up", "a short fanfare"], ["done", "Set done", "a lesson or a set"]]],
];
function sndLabColors() {
  // twelve hues across four lightnesses, plus a grey ramp: the pitch climbs with lightness, the instrument changes with hue
  const rows = [];
  [80, 65, 50, 35].forEach(L => rows.push([0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(H => lchHex(L, L > 70 ? 45 : 55, H + 20))));
  rows.push([95, 82, 70, 58, 46, 34, 22, 12].map(L => lchHex(L, 0, 0)));
  return rows;
}
function sndLab() {
  const P = (window.PAINTINGS || []).slice(0, 8);
  const toggles = `<div class="snd-tg">
      <button class="snd-sw${sndOn() ? " on" : ""}" data-tg="sound"><b>Sound</b><span>${sndOn() ? "On" : "Off"}</span></button>
      <button class="snd-sw${sndMusicOn() ? " on" : ""}" data-tg="music"><b>Calm music</b><span>${sndMusicOn() ? "On" : "Off"}</span></button>
    </div>
    <label class="snd-vol"><span>Volume</span><input type="range" min="0" max="100" step="5" value="${Math.round(sndVol() * 100)}" data-vol></label>`;
  const groups = SND_LAB_GROUPS.map(([title, list]) => `<div class="sec-head"><b>${title}</b></div>
    <div class="snd-grid">${list.map(([k, t, d]) => `<button class="snd-b" data-snd="${k}"><b>${t}</b><small>${d}</small></button>`).join("")}</div>`).join("");
  const colors = sndLabColors().map(r => `<div class="snd-row">${r.map(h => `<button class="snd-c" data-play="${h}" style="--c:${h}" aria-label="${h}"></button>`).join("")}</div>`).join("");
  const paints = P.map((p, i) => `<button class="snd-p" data-paint="${i}"><span class="snd-pal">${p.palette.map(c => `<i style="--c:${c.h};flex:${Math.max(.15, c.share)}"></i>`).join("")}</span><span class="snd-pt"><b>${esc(p.title)}</b><small>${esc(p.artist)}</small></span></button>`).join("");
  const el = show(`${navTop("Sounds")}
    <h1 class="t-title">Every color has a <em>note.</em></h1>
    <p class="lede">Lightness sets the pitch, from low darks to high pales. Vividness sets the brightness: a grey is a soft felt tone, a vivid color rings. The hue picks the instrument: warm colors a marimba, greens a kalimba, blues a glass bell, violets a music box. Everything sits on one friendly scale, so any palette is in tune with itself.</p>
    ${toggles}
    <div class="sec-head"><b>Tap a color</b><span>pitch rises with lightness</span></div>
    <div class="snd-colors">${colors}</div>
    <p class="note snd-now" aria-live="polite">&nbsp;</p>
    ${paints ? `<div class="sec-head"><b>Play a painting</b><span>louder for bigger areas</span></div><div class="snd-paints">${paints}</div>` : ""}
    ${groups}
    <div class="sec-head"><b>Calm music</b></div>
    <p class="note">A slow, generative felt piano with long silences. It never plays the same way twice, and it goes quiet inside games. Off unless you turn it on.</p>
    <p class="fine">All sounds are made on your phone as they play, so they cost no data. They mix with your own music and follow the silent switch.</p>
  `, "snd-lab");
  const now = el.querySelector(".snd-now");
  el.querySelector("[data-back]").onclick = () => go(S.tab || "learn");
  el.querySelectorAll("[data-tg]").forEach(b => b.onclick = () => {
    const k = b.dataset.tg, v = k === "sound" ? !sndOn() : !sndMusicOn();
    sndSet(k, v); b.classList.toggle("on", v); b.querySelector("span").textContent = v ? "On" : "Off";
    if (k === "sound" && v) sfx("select");
  });
  const vol = el.querySelector("[data-vol]");
  vol.oninput = () => sndSet("vol", vol.value / 100);
  vol.onchange = () => sfx("select");
  el.querySelectorAll("[data-snd]").forEach(b => b.onclick = () => {
    const k = b.dataset.snd;
    if (k === "streak") { SND.streak = 0; for (let i = 0; i < 6; i++) setTimeout(() => { SND.streak++; SND.streakT = performance.now(); sndPlay("right"); }, i * 380); return; }
    if (k === "right" || k === "knew" || k === "combo") { SND.streak = Math.max(1, SND.streak); SND.streakT = performance.now(); }
    if (k === "rooms") return sndPlay("rooms", 4);
    if (k === "flip") return sndPlay("flip", "#3F8F8A");
    sndPlay(k, k === "complete" || k === "best" || k === "levelup" ? ["#C0392B", "#E8A33D", "#F4D35E", "#4A7C59", "#2E5C8A"] : undefined);
  });
  el.querySelectorAll("[data-play]").forEach(b => b.onclick = () => {
    const h = b.dataset.play, tn = colorTone(h);
    if (!sndOn()) return;
    sndPlay("color", { hex: h, vel: .14 });
    const names = ["C", "D", "E", "G", "A"];
    now.textContent = `${h} · ${names[tn.deg % 5]}${4 + Math.floor(tn.deg / 5)} · ${SND_INST_WORD[tn.inst]}${tn.C >= 9 ? `, ${tn.bright > .6 ? "bright" : tn.bright > .3 ? "warm" : "soft"}` : ""}`;
  });
  el.querySelectorAll("[data-paint]").forEach(b => b.onclick = () => {
    const p = P[+b.dataset.paint]; if (!p || !sndOn()) return;
    sndPlay("chord", { hexes: p.palette.map(c => c.h), shares: p.palette.map(c => c.share), gap: .11 });
  });
  return el;
}
