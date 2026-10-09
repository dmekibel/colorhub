// Alias-routing gate (2026-10-09 Opus article audit: data/aliases.json sent dark-seafoam -> jade,
// greenish-teal -> jade, light-navy-blue -> dusk-blue, while data/library.json files those names under
// Green (Crayola), Imperial Green and Newport -- so a [[slug]] article link opened a color that wasn't
// the one named). data/aliases.json's `slugs`/`names` must resolve to a core name (check_solvable.js's own
// rule), but nothing previously checked that the chosen core name was actually NEAR the aliased name's own
// color. This gate rebuilds a "true hex" for every name documented in a library.json `altn` or
// core-names.json `also` list (maerz-paul-1930-clean.json's own measured hex > an iscc-nbs block centroid >
// the altn/also primary's own hex as a last resort) and fails if the alias's current target is more than
// dE2000 3 away from it. Companion to tools/fix_alias_targets.py, which applies the fix this gate checks
// for. Run: node tools/check_aliases.js
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const { de2000 } = require("./colormath.js");

const DE_OK = 3;

const slug = s => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "color";
// matches tools/library.py's key(): same name ignoring case, accents, spaces, hyphens, slashes,
// apostrophes and gray/grey -- without this, an ISCC-NBS "...Gray" row never matches a library.json/
// core-names.json name spelled "...Grey" (or vice versa), and the lookup silently falls back to a worse
// proxy hex.
const keyOf = s => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/gray/g, "grey").replace(/colour/g, "color").replace(/[^a-z0-9()]/g, "");

const lib = JSON.parse(fs.readFileSync(path.join(ROOT, "data/library.json"), "utf8"));
const core = JSON.parse(fs.readFileSync(path.join(ROOT, "data/core-names.json"), "utf8"));
const aliases = JSON.parse(fs.readFileSync(path.join(ROOT, "data/aliases.json"), "utf8"));

function jsonlRows(name) {
  return fs.readFileSync(path.join(ROOT, "data/sources", name), "utf8").split("\n").slice(1).filter(l => l.trim()).map(l => JSON.parse(l));
}

const mpHex = new Map();
for (const r of jsonlRows("maerz-paul-1930-clean.json")) if (!mpHex.has(keyOf(r.n))) mpHex.set(keyOf(r.n), r.h);

const centroidHex = new Map();
for (const r of jsonlRows("iscc-nbs-centroids.json")) if (r.block != null && r.hex) centroidHex.set(r.block, r.hex);
const isccHex = new Map();
for (const r of jsonlRows("iscc-nbs-names.json")) {
  const h = centroidHex.get(r.block);
  if (h && !isccHex.has(keyOf(r.n))) isccHex.set(keyOf(r.n), h);
}

// truth: alias slug -> [trueHex, source]
const truth = new Map();
function record(name, primaryHex) {
  const s = slug(name), k = keyOf(name);
  if (truth.has(s)) return;
  if (mpHex.has(k)) truth.set(s, [mpHex.get(k), "maerz-paul exact"]);
  else if (isccHex.has(k)) truth.set(s, [isccHex.get(k), "iscc-nbs block centroid"]);
  else truth.set(s, [primaryHex, "altn/also primary (proxy)"]);
}
// a name that is still its own live library.json/core-names.json entry resolves to its own page before
// js/router.js ever consults data/aliases.json -- an also/altn note elsewhere doesn't make it an alias.
const liveSlugs = new Set([...lib.map(e => slug(e.n)), ...core.map(e => slug(e.n))]);

for (const e of lib) for (const a of e.altn || []) { const n = typeof a === "string" ? a : a.n; if (n && !liveSlugs.has(slug(n))) record(n, e.h); }
for (const e of core) for (const n of e.also || []) { if (!liveSlugs.has(slug(n))) record(n, e.h); }

const coreHexBySlug = new Map(core.map(e => [slug(e.n), e.h]));

const errors = [];
let checked = 0;
for (const [aliasSlug, [trueHex]] of truth) {
  const targetSlug = aliases.slugs[aliasSlug];
  if (!targetSlug) continue;
  const targetHex = coreHexBySlug.get(targetSlug);
  if (!targetHex) continue;   // data/aliases.json pointing at a non-core slug is check_solvable.js's job
  checked++;
  const d = de2000(trueHex, targetHex);
  if (d > DE_OK) errors.push(`alias "${aliasSlug}" -> "${targetSlug}" is ${d.toFixed(1)} dE2000 from its documented color (> ${DE_OK})`);
}

// same check against data/articles/link-map.json's explicit overrides
const lmPath = path.join(ROOT, "data/articles/link-map.json");
if (fs.existsSync(lmPath)) {
  const lm = JSON.parse(fs.readFileSync(lmPath, "utf8"));
  for (const [k, v] of Object.entries(lm.links || {})) {
    const t = truth.get(k);
    if (!t || !v.to) continue;
    const targetHex = coreHexBySlug.get(v.to);
    if (!targetHex) continue;
    checked++;
    const d = de2000(t[0], targetHex);
    if (d > DE_OK) errors.push(`link-map "${k}" -> "${v.to}" is ${d.toFixed(1)} dE2000 from its documented color (> ${DE_OK})`);
  }
}

errors.forEach(e => console.log("FAIL  " + e));
console.log(`alias-routing gate: ${truth.size} documented names, ${checked} aliases checked, ${errors.length} failures`);
process.exit(errors.length ? 1 : 0);
