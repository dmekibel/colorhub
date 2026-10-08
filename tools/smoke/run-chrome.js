"use strict";
// Runs one headless Chrome against one URL and resolves with the dumped DOM.
// Headless Chrome on this Mac does not exit after --dump-dom, so we kill its process group as soon as the
// document has been printed (or after the alarm). Every run gets a fresh --user-data-dir.
const { spawn } = require("child_process"), fs = require("fs"), os = require("os"), path = require("path");
const CHROME = process.env.SMOKE_CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

function runChrome(url, { budget = 120000, alarm = 30, tag = "run" } = {}) {
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
