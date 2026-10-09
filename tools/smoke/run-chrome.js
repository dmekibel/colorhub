"use strict";
// Runs one headless Chrome against one URL and resolves with the dumped DOM.
// Headless Chrome on this Mac does not exit after --dump-dom, so we kill its process group as soon as the
// document has been printed (or after the alarm). Every run gets a fresh --user-data-dir.
const { spawn } = require("child_process"), fs = require("fs"), os = require("os"), path = require("path");
const CHROME = process.env.SMOKE_CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

// David, 2026-10-09 (Lane 2, design/SIMPLIFY/PLAN.md): the "home" group's scenario count grew past what the old
// 240000ms virtual-time budget / 45s alarm covers -- Chrome's own --virtual-time-budget expiring mid-run makes
// it dump the DOM (and exit) early, which reads as a crash ("no result (dumped...)") for every scenario still to
// come, not a real failure in any of them (confirmed: the exact same run passes in full with more headroom).
// Raised both ceilings with real margin for the largest group to keep growing a while longer; a normal run still
// finishes in its own real time either way (CLAUDE.md's "about 10 seconds" is unaffected by a higher ceiling that
// never gets hit on a healthy run -- only a run that was silently truncated before gets to actually finish now).
function runChrome(url, { budget = 480000, alarm = 90, tag = "run" } = {}) {
  return new Promise(resolve => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), `colorhub-smoke-${tag}-`));
    const args = ["-e", `alarm ${alarm}; exec @ARGV`, CHROME, "--headless", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
      "--disable-background-networking", "--disable-component-update", "--disable-extensions", "--mute-audio", "--hide-scrollbars", "--deny-permission-prompts",
      "--window-size=500,900", `--user-data-dir=${dir}`,
      // only the local server exists: external hosts (fonts, Wikimedia, CDNs) fail at once instead of stalling
      "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost",
      `--virtual-time-budget=${budget}`, "--dump-dom", url];
    const t0 = Date.now();
    let guard = null;
    const child = spawn("perl", args, { detached: true, stdio: ["ignore", "pipe", "pipe"] });
    let out = "", done = false;
    const finish = reason => {
      if (done) return; done = true; clearTimeout(guard);
      try { process.kill(-child.pid, "SIGKILL"); } catch (e) {}
      try { child.stdout.destroy(); child.stderr.destroy(); child.unref(); } catch (e) {}
      setTimeout(() => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {} }, 300);
      resolve({ out, reason, ms: Date.now() - t0 });
    };
    child.stdout.on("data", d => { out += d; if (/<\/html>\s*$/.test(out)) finish("dumped"); });
    child.stderr.on("data", () => {});
    child.on("exit", () => finish(/<\/html>\s*$/.test(out) ? "dumped" : "exited"));
    guard = setTimeout(() => finish("timeout"), (alarm + 5) * 1000);
  });
}
// <pre id="out">…</pre> -> text (HTML-unescaped)
function extractOut(html) {
  const m = /<pre id="out"[^>]*>([\s\S]*?)<\/pre>/.exec(html);
  if (!m) return null;
  return m[1].replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
}
module.exports = { runChrome, extractOut };
