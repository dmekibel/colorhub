// Legibility gate (David, 2026-10-09: "text has to be super legible"). Crawls a set of real app screens in
// headless Chrome at phone widths and checks every visible text node's contrast against its real resolved
// background (tools/legibility-audit.js does the DOM walk + contrast math inside the page).
//
// Usage:
//   node tools/check_legibility.js                 the fast "key screens" subset, one Chrome run, exits 1 on any hard failure
//   node tools/check_legibility.js --port 8791      use an already-running server (tools/smoke.sh's "legibility" group does this)
//   node tools/check_legibility.js --full           every screen in tools/legibility-routes.js, both phone sizes, writes
//                                                    design/LEGIBILITY-AUDIT.md with every finding (not just hard failures)
//
// The hard gate (what fails the exit code): reading text under 13px (too small to read, regardless of contrast),
// or any text under 24px with contrast below 4.5:1 against its real background. Large text (>=24px, or >=19px
// bold) only needing 3:1, italic-serif-too-small, tight line-height and "text sits on an unscrimmed photo" are
// still computed and listed, but are reported rather than gated -- they need a human look (or another lane's
// JS) more often than a token tweak. See the report tools/check_legibility.js prints for the current split.
"use strict";
const fs = require("fs"), path = require("path"), http = require("http"), { spawn, spawnSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
const { runChrome, extractOut } = require("./smoke/run-chrome.js");
const ROUTES = require("./legibility-routes.js");

const args = process.argv.slice(2);
const flag = n => args.includes(n);
const argVal = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const FULL = flag("--full");
let PORT = +(argVal("--port") || 0) || (/^\d+$/.test(args[0]) ? +args[0] : 0);

function waitForServer(port, tries = 50) {
  return new Promise((resolve, reject) => {
    const tryOnce = n => {
      http.get(`http://127.0.0.1:${port}/index.html`, res => { res.resume(); resolve(); })
        .on("error", () => n > 0 ? setTimeout(() => tryOnce(n - 1), 100) : reject(new Error("server never came up")));
    };
    tryOnce(tries);
  });
}

async function ensureServer() {
  if (PORT) return { port: PORT, stop: () => {} };
  const port = 18000 + Math.floor(Math.random() * 2000);
  const dir = fs.mkdtempSync(path.join(require("os").tmpdir(), "colorhub-legibility-"));
  const ov = spawnSync("bash", [path.join(ROOT, "tools/smoke/overlay.sh"), ROOT, dir]);
  if (ov.status !== 0) throw new Error("overlay.sh failed: " + ov.stderr);
  const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", dir], { stdio: "ignore" });
  await waitForServer(port);
  return { port, stop: () => { try { server.kill(); } catch (e) {} try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {} } };
}

// A "large" text node (>=24px, or >=19px bold) only needs 3:1, and text sitting on its own color swatch
// (inkHex()-picked black/white, tools/legibility-audit.js's `onSwatch`) follows this app's own documented
// 3:1 standard (tools/check_contrast.js) regardless of size. Both are reported as "low-contrast-large" by the
// audit itself, which already knows which case it's in -- the hard gate just reads that back: "too-small" or
// plain "low-contrast" (under 24px, not on a swatch) fails; "low-contrast-large" is reported, not gated.
function classify(f) {
  const hard = f.flags.includes("too-small") || f.flags.includes("low-contrast");
  return { ...f, hard };
}

async function runGroup(port, { w, h, keyOnly }) {
  const url = `http://127.0.0.1:${port}/tools/legibility-wrapper.html?g=legibility&w=${w}&h=${h}${keyOnly ? "&keyOnly=1" : ""}`;
  const r = await runChrome(url, { tag: `legibility-${w}x${h}`, alarm: 170, budget: 600000 });
  const txt = extractOut(r.out);
  let data = null;
  try { data = JSON.parse(txt); } catch (e) {}
  if (!data) return { w, h, screens: [], chromeIssue: `no result (${r.reason}; page said: ${String(txt).slice(0, 200)})` };
  const screens = data.results.map(res => {
    let report = null;
    try { report = res.notes && res.notes[0] ? JSON.parse(res.notes[0]) : null; } catch (e) {}
    return { name: res.name, status: res.status, msg: res.msg, w, h, checked: report ? report.checked : 0, findings: report ? report.findings.map(classify) : [] };
  });
  return { w, h, screens };
}

(async () => {
  const { port, stop } = await ensureServer();
  try {
    const sizes = FULL ? [[375, 812], [440, 956]] : [[440, 956]];
    const runs = [];
    for (const [w, h] of sizes) runs.push(await runGroup(port, { w, h, keyOnly: !FULL }));

    const allScreens = runs.flatMap(r => r.screens);
    const chromeIssues = runs.filter(r => r.chromeIssue);
    const crashed = allScreens.filter(s => s.status !== "pass" && !s.findings.length);
    const totalChecked = allScreens.reduce((n, s) => n + (s.checked || 0), 0);
    const allFindings = allScreens.flatMap(s => s.findings.map(f => ({ ...f, screen: s.name, size: `${s.w}x${s.h}` })));
    const hardFails = allFindings.filter(f => f.hard);
    const softFindings = allFindings.filter(f => !f.hard);

    const line = f => `  [${f.screen} @ ${f.size}] ${f.sel} "${f.text}" — ${f.fontSize}px/${f.weight}${f.italic ? " italic" : ""}, contrast ${f.ratio == null ? "n/a (background: " + f.bg + ")" : f.ratio + ":1"} — ${f.flags.join(", ")}`;

    console.log(`legibility: ${allScreens.length} screen${allScreens.length === 1 ? "" : "s"} crawled (${sizes.map(s => s.join("x")).join(", ")}), ${totalChecked} text nodes checked, ${allFindings.length} flagged (${hardFails.length} hard, ${softFindings.length} reported-only)`);
    if (chromeIssues.length) chromeIssues.forEach(c => console.log("  chrome issue: " + c.chromeIssue));
    if (crashed.length) crashed.forEach(s => console.log(`  SCENARIO FAILED: ${s.name} — ${s.msg}`));
    if (hardFails.length) { console.log("HARD FAILURES (contrast < 4.5:1 under 24px, or reading text < 13px):"); hardFails.slice(0, 60).forEach(f => console.log(line(f))); if (hardFails.length > 60) console.log(`  … and ${hardFails.length - 60} more`); }
    if (softFindings.length) { console.log(`reported-only findings (large-text 3:1, italic-serif size, line-height, unscrimmed image text): ${softFindings.length} -- see design/LEGIBILITY-AUDIT.md for the full list`); }

    if (FULL) {
      const byScreen = {};
      allFindings.forEach(f => { (byScreen[f.screen] = byScreen[f.screen] || []).push(f); });
      const rows = Object.keys(byScreen).sort().map(name => {
        const fs_ = byScreen[name];
        return `### ${name}\n\n` + fs_.map(f => `- \`${f.sel}\` “${f.text}” — ${f.size}, ${f.fontSize}px/${f.weight}${f.italic ? " italic" : ""}, contrast ${f.ratio == null ? "n/a (bg: " + f.bg + ")" : f.ratio + ":1"} — **${f.flags.join(", ")}**${f.hard ? " (hard fail)" : ""}`).join("\n");
      }).join("\n\n");
      const md = `# ColorHub legibility audit (${new Date().toISOString().slice(0, 10)})\n\n` +
        `Crawled with \`node tools/check_legibility.js --full\` (tools/legibility-audit.js + tools/legibility-routes.js) at 375x812 and 440x956.\n` +
        `${allScreens.length} screens, ${totalChecked} visible text nodes checked, ${allFindings.length} findings (${hardFails.length} hard failures, ${softFindings.length} reported-only).\n\n` +
        `Rules: reading text (>2 chars) under 13px always fails. Text under 24px needs >=4.5:1. "Large" text (>=24px, or >=19px bold) needs >=3:1 (reported, not gated). ` +
        `Italic Instrument Serif under 17px is flagged as hard to read. Paragraphs (>40 chars) with line-height/font-size < 1.4 are flagged. Text sitting directly on an ` +
        `\`<img>\`/\`<canvas>\` with no scrim layer found over it is reported as \`text-over-image-no-scrim\` with \`bg: uncertain\` (contrast can't be computed honestly without a real screenshot; these need a human look).\n\n` +
        (chromeIssues.length ? chromeIssues.map(c => "Chrome issue: " + c.chromeIssue).join("\n") + "\n\n" : "") +
        (crashed.length ? "Scenarios that didn't complete: " + crashed.map(s => `${s.name} (${s.msg})`).join("; ") + "\n\n" : "") +
        (rows || "No findings.") + "\n";
      fs.writeFileSync(path.join(ROOT, "design/LEGIBILITY-AUDIT.md"), md);
      console.log("wrote design/LEGIBILITY-AUDIT.md");
    }

    process.exit(hardFails.length || crashed.length ? 1 : 0);
  } finally {
    stop();
  }
})().catch(e => { console.error(e); process.exit(2); });
