// Tests for js/swatch.js's tap-to-page rewire (David, 2026-10-07: "I hate that if you press on a color, you
// have to press a second time 'open page'" -- one tap must open the color's own page directly, and the old
// middle step (nameSheet, the color link sheet) must never fire from a plain tap).
// There's no DOM here (this repo has no jsdom/test framework): js/swatch.js is loaded with node's `vm` module
// in a sandboxed context that mocks the few globals its delegated click listener and openTappedColor() touch
// (document, BYNAME, nameOf, colorNode, openNode, namePage, coreFallback, buzz), so the real file runs
// unmodified and this proves what it actually does, not a rewritten copy of it.
// Run: node tools/swatch_test.js   (exits 1 on any failure)
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm");
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.log("FAIL:", msg); } };

const src = fs.readFileSync(path.join(__dirname, "../js/swatch.js"), "utf8");

function loadSandbox(extra = {}) {
  const calls = { nameSheet: [], openNode: [], namePage: [] };
  let clickHandler = null;
  const sandbox = {
    document: { addEventListener: (type, fn) => { if (type === "click") clickHandler = fn; } },
    BYNAME: new Map(),
    CORE_NAMES: [],   // truthy: the delegated listener calls openTappedColor() synchronously, not through loadCoreNames()'s promise
    VERY_CLOSE_DE: 3,
    coreFallback: () => [],
    nameOf: () => ({ n: "", h: "", de: 0, between: null, met: false }),
    colorNode: c => ({ kind: "color", id: "c:" + c.n, c }),
    openNode: (...a) => calls.openNode.push(a),
    namePage: (...a) => calls.namePage.push(a),
    nameSheet: (...a) => calls.nameSheet.push(a),   // the function this test proves a tap never reaches
    buzz: () => {}, loadCoreNames: () => Promise.resolve(), morphFrom: () => {},
    ink: () => "dark", esc: x => x, sheet: () => ({ sh: { classList: { add() {} }, querySelectorAll: () => [], querySelector: () => null }, close: () => {} }),
    toast: () => {}, jpNoteLine: () => "", closeness: () => "close", nearestColors: () => [],
    galleryOpenColor: () => {}, hmLearnIt: () => {}, ICON: { arrow: "" },
    ...extra,
  };
  sandbox.window = sandbox; sandbox.global = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: "swatch.js" });
  return { sandbox, calls, handler: () => clickHandler };
}
const tap = (handler, hex) => handler({ target: { closest: sel => sel === "[data-swatch]" ? { dataset: { swatch: hex } } : null }, stopPropagation() {}, preventDefault() {} });

// ---------- the delegated [data-swatch] listener opens the page, never the sheet ----------
{
  const teal = { n: "Teal", h: "#008080", id: "c1" };
  const { calls, handler } = loadSandbox({
    BYNAME: new Map([["teal", teal]]),
    nameOf: () => ({ n: "Teal", h: "#008080", de: 0, between: null, met: true }),
  });
  ok(typeof handler() === "function", "a click listener was registered for [data-swatch]");
  tap(handler(), "#008080");
  ok(calls.nameSheet.length === 0, "a swatch tap never calls nameSheet");
  ok(calls.openNode.length === 1, "an exact, taught match opens the page via openNode");
  ok(calls.openNode[0][0].c.n === "Teal", "...the right color's page");
  ok(calls.openNode[0][2] == null, "...carrying no tapped hex (it already IS that color, so no 'Your color' view)");
}

// ---------- openTappedColor() directly: an in-between color opens the nearest name's page, with the hex ----------
{
  const { calls, sandbox } = loadSandbox({
    BYNAME: new Map(),   // "Slate blue" isn't one of the 101 -> namePage, not a colorPage via openNode
    nameOf: () => ({ n: "Slate blue", h: "#6A5ACD", de: 9.2, between: null, met: false }),
    coreFallback: () => [{ n: "Slate blue", h: "#6A5ACD" }],
  });
  ok(typeof sandbox.openTappedColor === "function", "openTappedColor is exposed for direct calls (and other files to reuse)");
  sandbox.openTappedColor("#7A6ADD");
  ok(calls.nameSheet.length === 0, "an in-between tap never calls nameSheet either");
  ok(calls.namePage.length === 1 && calls.namePage[0][0].n === "Slate blue", "it opens the nearest name's page");
  ok(calls.namePage[0][2] === "#7A6ADD", "...carrying the exact tapped hex, since de >= VERY_CLOSE_DE");
}

// ---------- a "between two names" color also carries the tapped hex (no single real name to call it) ----------
{
  const { calls, sandbox } = loadSandbox({
    BYNAME: new Map(),
    nameOf: () => ({ n: "Teal", h: "#008080", de: 11, between: { a: "Teal", b: "Petrol" }, met: true }),
    coreFallback: () => [{ n: "Teal", h: "#008080" }],
  });
  sandbox.openTappedColor("#117799");
  ok(calls.namePage.length === 1 && calls.namePage[0][2] === "#117799", "a 'between' match carries the tapped hex too, even when nm.met is true");
}

// ---------- a tap inside an existing [data-node]/[data-nb]/<a> still defers to that, not the swatch ----------
{
  const { calls, handler } = loadSandbox();
  const target = { closest: sel => sel === "[data-swatch]" ? { dataset: { swatch: "#000000" } } : sel === "[data-node],[data-nb],a" ? {} : null };
  handler()({ target, stopPropagation() {}, preventDefault() {} });
  ok(calls.openNode.length === 0 && calls.namePage.length === 0 && calls.nameSheet.length === 0, "a swatch nested in a real link/compare keeps first refusal");
}

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
