"use strict";
// Orchestrator for tools/smoke.sh: node tools/smoke/run.js <port> [--group g] [--only a,b] [--json]
// One headless Chrome per scenario group, all in parallel, each against its own fresh profile.
const fs = require("fs"), path = require("path"), vm = require("vm");
const { runChrome, extractOut } = require("./run-chrome.js");

const port = +process.argv[2];
const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const wantGroup = arg("--group"), wantOnly = arg("--only"), asJson = process.argv.includes("--json");
if (!port) { console.error("usage: node run.js <port>"); process.exit(2); }

// Read the scenario list (group + name) without running any scenario: scenarios.js only calls scenario(...).
const registry = [];
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "scenarios.js"), "utf8"), { scenario: (group, name) => registry.push({ group, name }), window: {}, console });
const groups = {};
registry.filter(s => (!wantGroup || s.group === wantGroup) && (!wantOnly || wantOnly.split(",").includes(s.name))).forEach(s => (groups[s.group] = groups[s.group] || []).push(s.name));

const seed = process.env.SMOKE_SEED || new Date().toISOString().slice(0, 10);   // which "random" colors and names get checked today
const pad =(s, n) => (s + " ".repeat(n)).slice(0, n);
(async () => {
  const t0 = Date.now();
  const runs = Object.keys(groups).map(async g => {
    const url = `http://127.0.0.1:${port}/tools/smoke/wrapper.html?seed=${encodeURIComponent(seed)}&g=${encodeURIComponent(g)}${wantOnly ? "&only=" + encodeURIComponent(wantOnly) : ""}`;
    const r = await runChrome(url, { tag: g });
    const txt = extractOut(r.out);
    let data = null;
    try { data = JSON.parse(txt); } catch (e) {}
    if (!data || !data.done) {
      // Chrome died, hung or ran out of time: every scenario in the group that did not report is a failure
      const got = (data && data.results) || [], have = new Set(got.map(x => x.name));
      groups[g].filter(n => !have.has(n)).forEach(n => got.push({ group: g, name: n, status: "fail", msg: `no result (${r.reason}; page output: ${String(txt).slice(0, 80)})`, ms: 0 }));
      return { g, results: got, chromeMs: r.ms };
    }
    return { g, results: data.results, chromeMs: r.ms };
  });
  const all = await Promise.all(runs);
  const results = all.flatMap(x => x.results);
  if (asJson) console.log(JSON.stringify(results, null, 1));
  else {
    const clip = (x, n) => (x.length > n ? x.slice(0, n - 1) + "…" : x);
    console.log("");
    console.log(pad("SCENARIO", 66) + pad("", 0) + "RESULT  DETAIL");
    console.log("-".repeat(110));
    results.sort((a, b) => (a.group + a.name).localeCompare(b.group + b.name));
    for (const r of results) {
      const pass = r.status === "pass", detail = pass ? (r.notes || []).join("; ") : r.msg;
      console.log(pad(clip(r.group + " / " + r.name, 64), 66) + pad(pass ? "PASS" : "FAIL", 8) + clip(detail || "", 110 - 74));
    }
    console.log("-".repeat(110));
    const fails = results.filter(r => r.status !== "pass");
    if (fails.length) {
      console.log("FAILURES");
      for (const r of fails) console.log(`  ${r.group} / ${r.name}\n    ${r.msg}`);
    }
  }
  const bad = results.filter(r => r.status !== "pass");
  console.log(`${results.length - bad.length}/${results.length} scenarios passed in ${((Date.now() - t0) / 1000).toFixed(1)}s (${Object.keys(groups).length} Chrome runs in parallel)`);
  process.exit(bad.length ? 1 : 0);
})();
