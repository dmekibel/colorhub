// Tests for js/export.js (the Export sheet's writers). Run: node tools/export_test.js
// No DOM: export.js is loaded in a vm context with a small nameOf() built from data/core-names.json.
// Round-trips the binary formats (ASE parsed back byte by byte, the .swatches ZIP parsed back with its CRCs and
// JSON) and checks that no file ever carries a trademarked swatch name.
const fs = require("fs"), path = require("path"), vm = require("vm");
const { lab, de2000 } = require("./colormath.js");

const names = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/core-names.json"), "utf8")).map(e => ({ ...e, L: lab(e.h) }));
const nameOf = hex => {
  const L = lab(hex), near = names.map(e => ({ n: e.n, h: e.h, de: de2000(L, e.L) })).sort((a, b) => a.de - b.de).slice(0, 5), top = near[0];
  return { n: top.n, h: top.h, de: top.de, text: top.n, near, between: top.de >= 8 ? { a: top.n, b: near[1].n } : null };
};
const ctx = { nameOf, NEAR_DE: 8, window: { addEventListener() {} }, performance, TextEncoder, console, toast() {}, buzz() {}, sheet() {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, "../js/export.js"), "utf8") + "\nthis.EXP = { exCSS, exTailwind, exGPL, exSVG, exASE, exProcreate, exName, exRoles, exTints, exCrc32, exFmtOk, exRgb, EX_DENY };", ctx);
const X = ctx.EXP;

let fails = 0, checks = 0;
const ok = (c, msg) => { checks++; if (!c) { fails++; console.log("FAIL " + msg); } };
const eq = (a, b, msg) => ok(JSON.stringify(a) === JSON.stringify(b), `${msg}: got ${JSON.stringify(a)} want ${JSON.stringify(b)}`);
const hexOf = rgb => "#" + rgb.map(v => v.toString(16).padStart(2, "0")).join("").toUpperCase();

const pal = [{ h: "#5F8C8A", share: .42 }, { h: "#E8D5B5", share: .27 }, { h: "#2B3A42", share: .17 }, { h: "#C8553D", share: .09 }, { h: "#F2C81F", share: .03 }];
const opts = { title: "Kitchen window", note: "from a photo" };

// ---- known vectors ----
eq(X.exCrc32(Buffer.from("123456789")), 0xCBF43926, "crc32 of 123456789");

// ---- roles ----
eq(X.exRoles(pal), ["dominant", "secondary", "supporting", "supporting", "accent"], "roles by share");
eq(X.exRoles([{ h: "#000000" }, { h: "#FFFFFF" }]), [null, null], "no shares, no roles");

// ---- tints ----
const tints = X.exTints("#C8553D");
ok(tints.length === 5 && tints.every(t => /^#[0-9A-F]{6}$/.test(t.h)), "five valid tints");
ok(lab(tints[0].h)[0] > lab(tints[4].h)[0] + 40, "tints run light to dark");

// ---- CSS ----
const css = X.exCSS(pal, opts);
const vars = [...css.matchAll(/--([a-z0-9-]+): (#[0-9A-F]{6}); \/\* (oklch\([^)]*\))(?: · (\w+))?(?: · ([<\d]+%))? \*\//g)];
ok(vars.length === 5, "css has five variables");
eq(vars.map(v => v[2]), pal.map(p => p.h), "css hexes in order");
ok(vars.every(v => /^oklch\(0\.\d{3} 0\.\d{3} \d+\.\d\)$/.test(v[3])), "css oklch format");
eq(vars.map(v => v[4]), ["dominant", "secondary", "supporting", "supporting", "accent"], "css roles");
ok(new Set(vars.map(v => v[1])).size === 5, "css variable names are unique");
ok(css.includes("Kitchen window") && css.includes("approximate"), "css header carries the title and the caveat");
const cssT = X.exCSS(pal, { ...opts, tints: true });
ok((cssT.match(/--[a-z0-9-]+-(100|300|500|700|900): /g) || []).length === 25, "css tints: 5 per color");

// ---- Tailwind ----
{
  const m = { exports: {} }; new Function("module", X.exTailwind(pal, opts))(m);
  const cols = m.exports.theme.extend.colors;
  eq(Object.values(cols), pal.map(p => p.h), "tailwind colors evaluate and match");
  const mt = { exports: {} }; new Function("module", X.exTailwind(pal, { ...opts, tints: true }))(mt);
  ok(Object.values(mt.exports.theme.extend.colors).every(o => o.DEFAULT && Object.keys(o).length === 6), "tailwind tints: DEFAULT plus five");
}

// ---- GIMP palette ----
{
  const g = X.exGPL(pal, opts).split("\n");
  eq(g[0], "GIMP Palette", "gpl magic"); ok(g[1] === "Name: Kitchen window", "gpl name");
  const rows = g.filter(l => /^\s*\d+\s+\d+\s+\d+\t/.test(l));
  eq(rows.map(l => hexOf(l.split("\t")[0].trim().split(/\s+/).map(Number))), pal.map(p => p.h), "gpl rgb round-trips");
  ok(rows.every(l => l.split("\t")[1].length > 2), "gpl rows are named");
}

// ---- SVG ----
{
  const svg = X.exSVG(pal, opts);
  ok(svg.startsWith("<svg xmlns=") && svg.trim().endsWith("</svg>"), "svg envelope");
  const open = (svg.match(/<(g|text|rect|title|desc)[ >]/g) || []).length, close = (svg.match(/<\/(g|text|title|desc)>|\/>/g) || []).length;
  ok(open === close, `svg tags balance (${open} vs ${close})`);
  ok(!/&(?!amp;|lt;|gt;|quot;|apos;)/.test(svg), "svg has no bare ampersands");
  ok((svg.match(/<g id=/g) || []).length === 5, "svg has a plate per color");
  const hexes = [...svg.matchAll(/<rect x="[\d.]+" y="[\d.]+" width="168" height="\d+" rx="4" fill="(#[0-9A-F]{6})"/g)].map(m => m[1]);
  eq(hexes, pal.map(p => p.h), "svg plates carry the hexes");
}

// ---- Adobe .ase: parse the bytes back ----
function parseASE(buf) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength), out = { groups: [], colors: [], ends: 0 };
  ok(String.fromCharCode(...buf.slice(0, 4)) === "ASEF", "ase magic");
  eq([dv.getUint16(4), dv.getUint16(6)], [1, 0], "ase version 1.0");
  const n = dv.getUint32(8); let o = 12;
  const name = at => { const len = dv.getUint16(at); let s = ""; for (let i = 0; i < len - 1; i++) s += String.fromCharCode(dv.getUint16(at + 2 + i * 2)); ok(dv.getUint16(at + 2 + (len - 1) * 2) === 0, "ase name is null-terminated"); return [s, at + 2 + len * 2]; };
  for (let b = 0; b < n; b++) {
    const type = dv.getUint16(o), len = dv.getUint32(o + 2), body = o + 6;
    if (type === 0xC001) out.groups.push(name(body)[0]);
    else if (type === 0xC002) { out.ends++; ok(len === 0, "ase group end is empty"); }
    else if (type === 0x0001) {
      const [nm, p] = name(body), model = String.fromCharCode(...buf.slice(p, p + 4));
      const rgb = [0, 1, 2].map(i => Math.round(dv.getFloat32(p + 4 + i * 4) * 255)), kind = dv.getUint16(p + 16);
      ok(p + 18 === body + len, "ase color block length matches"); out.colors.push({ nm, model, rgb, kind });
    } else ok(false, "unknown ase block " + type.toString(16));
    o = body + len;
  }
  ok(o === buf.length, "ase blocks consume the whole file");
  return out;
}
{
  const a = parseASE(X.exASE(pal, opts));
  eq(a.groups, ["Kitchen window"], "ase group is the title"); eq(a.ends, 1, "ase one group end");
  eq(a.colors.map(c => hexOf(c.rgb)), pal.map(p => p.h), "ase colors round-trip");
  ok(a.colors.every(c => c.model === "RGB " && c.kind === 2), "ase model RGB, type normal");
  eq(a.colors.map(c => c.nm), pal.map(p => X.exName(p.h)), "ase names are the exName() names");
  const at = parseASE(X.exASE(pal, { ...opts, tints: true })); eq(at.colors.length, 30, "ase tints add 25 colors");
}

// ---- Procreate .swatches: a ZIP ----
function parseZip(buf) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let e = buf.length - 22; ok(dv.getUint32(e, true) === 0x06054b50, "zip end record");
  const n = dv.getUint16(e + 10, true), cdSize = dv.getUint32(e + 12, true), cdOff = dv.getUint32(e + 16, true), files = [];
  ok(cdOff + cdSize === e, "zip central directory sits right before the end record");
  let o = cdOff;
  for (let i = 0; i < n; i++) {
    ok(dv.getUint32(o, true) === 0x02014b50, "zip central header");
    const method = dv.getUint16(o + 10, true), crc = dv.getUint32(o + 16, true), csize = dv.getUint32(o + 20, true), usize = dv.getUint32(o + 24, true), nl = dv.getUint16(o + 28, true), loc = dv.getUint32(o + 42, true);
    const name = Buffer.from(buf.slice(o + 46, o + 46 + nl)).toString("utf8");
    ok(dv.getUint32(loc, true) === 0x04034b50, "zip local header"); const lnl = dv.getUint16(loc + 26, true), lel = dv.getUint16(loc + 28, true);
    const data = buf.slice(loc + 30 + lnl + lel, loc + 30 + lnl + lel + csize);
    ok(method === 0 && csize === usize, "zip entry is stored"); ok(X.exCrc32(data) === crc, "zip crc matches the data");
    files.push({ name, data }); o += 46 + nl;
  }
  return files;
}
{
  const files = parseZip(X.exProcreate(pal, opts));
  eq(files.map(f => f.name), ["Swatches.json"], "swatches zip holds Swatches.json");
  const j = JSON.parse(Buffer.from(files[0].data).toString("utf8"));
  ok(Array.isArray(j) && j.length === 1 && j[0].name === "Kitchen window", "swatches json shape");
  ok(j[0].swatches.length === 5 && j[0].swatches.every(s => ["hue", "saturation", "brightness", "alpha", "colorSpace"].every(k => typeof s[k] === "number") && s.alpha === 1 && s.colorSpace === 0), "swatches have HSB, alpha 1, colorSpace 0");
  // HSB back to RGB must land within one step of the source
  const back = s => { const h = s.hue * 6, c = s.brightness * s.saturation, x = c * (1 - Math.abs(h % 2 - 1)), m = s.brightness - c; const t = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][Math.floor(h) % 6]; return t.map(v => Math.round((v + m) * 255)); };
  j[0].swatches.forEach((s, i) => { const want = X.exRgb(pal[i].h), got = back(s); ok(want.every((v, k) => Math.abs(v - got[k]) <= 1), `swatch ${i} HSB round-trips (${want} vs ${got})`); });
  eq(parseZip(X.exProcreate(pal, { ...opts, tints: true }).slice()).length, 1, "tinted swatches still one entry");
  // determinism: the same palette gives the same bytes
  eq(Buffer.from(X.exProcreate(pal, opts)).equals(Buffer.from(X.exProcreate(pal, opts))), true, "zip output is deterministic");
}

// ---- trademarked names never reach a file ----
{
  const deny = /pantone|tiffany|crayola|facebook|ikea|barbie|starbucks|coca[- ]?cola|herm[eè]s|benjamin moore|sherwin|farrow|\bral\s?\d/i;
  let tested = 0, hits = 0;
  names.forEach(e => { tested++; if (deny.test(X.exName(e.h))) { hits++; console.log("  leaked: " + e.n + " -> " + X.exName(e.h)); } });
  ok(hits === 0, `no core name leaks a trademark (${tested} colors checked)`);
  const barbie = names.find(e => /barbie/i.test(e.n));
  if (barbie) ok(!/barbie/i.test(X.exCSS([{ h: barbie.h }], {})) && !/barbie/i.test(Buffer.from(X.exASE([{ h: barbie.h }], {})).toString("latin1") + Buffer.from(X.exASE([{ h: barbie.h }], {})).toString("utf16le")), "Barbie Pink never appears in CSS or ASE");
}

console.log(fails ? `\n${fails} of ${checks} checks FAILED` : `export_test: all ${checks} checks passed`);
process.exit(fails ? 1 : 0);
