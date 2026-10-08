#!/usr/bin/env node
// How many paintings hold each named color, as one small file for Home's "Painted" order (js/honey.js
// honeyLoadPainted). Read from the affinity table (data/colorindex/affinity-*.json, tools/color_index.py): n = the
// paintings of the corpus that hold the color within 4% different over at least 1% of the picture (the standard
// definition). Writes data/colorindex/painted.json: { n: corpus size, c: [[name, hex, count], ...] } by count, most first.
// Run after tools/color_index.py rebuilds the affinity table:  node tools/painted_counts.js
"use strict";
const fs = require("fs"), path = require("path");
const dir = path.join(__dirname, "..", "data", "colorindex");
const head = JSON.parse(fs.readFileSync(path.join(dir, "index.json"), "utf8"));
const rows = [];
for (const f of fs.readdirSync(dir).filter(f => /^affinity-.+\.json$/.test(f)).sort()) {
  const d = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
  for (const e of Object.values(d)) if (e && e.n_ && e.h) rows.push([e.n_, e.h, e.n | 0]);
}
rows.sort((a, b) => b[2] - a[2] || a[0].localeCompare(b[0]));
fs.writeFileSync(path.join(dir, "painted.json"), JSON.stringify({ n: head.n, c: rows }) + "\n");
console.log(`painted.json: ${rows.length} names, corpus ${head.n}, top ${rows.slice(0, 5).map(r => r[0] + " " + r[2]).join(", ")}`);
