// Cache gate. Run: node tools/check_fetch_versions.js  (also called from tools/check.js)
// Every fetch of a file under data/ must carry the page's ?v= tag, or a phone can pair a cached OLD data file with NEW ones
// (2026-10-20: a cached gallery index under new painter data showed the wrong paintings). js/loader.js adds the tag to every
// data/ fetch in one place; this gate fails if that wrapper is removed, if loader.js is not the first script that defines it
// before any other script, or if a script builds an absolute data URL the wrapper cannot see.
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..");
const bad = [];
const loader = fs.readFileSync(path.join(root, "js", "loader.js"), "utf8");
if (!/FETCH_VERSIONING/.test(loader) || !/__versioned/.test(loader)) bad.push("js/loader.js: the FETCH_VERSIONING wrapper around window.fetch is missing");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const scripts = [...html.matchAll(/<script[^>]*src="([^"?]+)/g)].map(m => m[1]);
if (scripts.indexOf("js/loader.js") < 0) bad.push("index.html: js/loader.js is not loaded");
for (const f of fs.readdirSync(path.join(root, "js")).filter(f => f.endsWith(".js") && f !== "loader.js")) {
  fs.readFileSync(path.join(root, "js", f), "utf8").split("\n").forEach((line, i) => {
    if (/^\s*\/\//.test(line)) return;
    if (/\b(fetch|XMLHttpRequest)\b.*(https?:\/\/[^"'`]*\/data\/)/.test(line)) bad.push(`js/${f}:${i + 1}  absolute data URL bypasses the version wrapper`);
  });
}
module.exports = { bad };
if (require.main === module) { bad.forEach(b => console.log("FAIL  " + b)); console.log(`fetch-version gate: ${bad.length} problems`); process.exit(bad.length ? 1 : 0); }
