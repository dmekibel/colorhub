// All js/*.js files share one global scope (plain scripts), so a top-level name defined twice breaks the
// whole app at load. This lists any top-level const/let/function/class name declared in more than one file.
const fs = require("fs"), path = require("path");
const dir = path.join(__dirname, "..", "js"), seen = new Map();
for (const f of fs.readdirSync(dir).filter(f => f.endsWith(".js"))) {
  for (const line of fs.readFileSync(path.join(dir, f), "utf8").split("\n")) {
    const m = line.match(/^(?:const|let|var|function\*?|class|async function)\s+([A-Za-z_$][\w$]*)/);
    if (m) (seen.get(m[1]) || seen.set(m[1], []).get(m[1])).push(f);
  }
}
const dup = [...seen].filter(([, fs]) => fs.length > 1);
dup.forEach(([n, fs]) => console.log(`dup  ${n}: ${fs.join(", ")}`));
console.log(`names check: ${dup.length} duplicate top-level names`);
process.exit(dup.length ? 1 : 0);
