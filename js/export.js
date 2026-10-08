"use strict";
// The Export sheet (design/IDEAS-10X/studio.md §6 C): one place that turns a palette into files designers use.
// CSS variables (hex plus oklch() and a role comment), a Tailwind config snippet, an SVG swatch card that pastes
// into Figma, a GIMP .gpl, an Adobe .ase and a Procreate .swatches. Every file carries the precise names (nameOf)
// and, when the palette has areas, the role of each color: dominant, secondary, supporting or accent.
//
// The writers (exCSS ... exProcreate) are pure functions with no DOM, so tools/export_test.js can run them in
// node. They expect a palette as [{ h: "#RRGGBB", share?: 0..1, accent?: bool }] and an opts object
// { title, note, tints }. Screen colors are approximate and the files say so. Names that are trademarks never
// reach a file: exName() steps to the nearest neutral name instead (EX_DENY).
//
// The .ase and .swatches writers follow community-documented formats, not vendor specs. They are round-trip
// tested here and still need one import on a real device before anyone relies on them.

const EX_DENY = /pantone|tiffany|crayola|facebook|ikea|barbie|starbucks|coca[- ]?cola|herm[eè]s|benjamin moore|sherwin|farrow|\bral\s?\d/i;

// ---------- color math, self-contained (OKLab: Björn Ottosson, 2020) ----------
const exClamp = (v, a, b) => Math.max(a, Math.min(b, v));
const exRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const exLin = v => { v /= 255; return v > .04045 ? ((v + .055) / 1.055) ** 2.4 : v / 12.92; };
const exEnc = v => Math.round(exClamp(v > .0031308 ? 1.055 * v ** (1 / 2.4) - .055 : 12.92 * v, 0, 1) * 255);
const exHex2 = n => n.toString(16).padStart(2, "0");
function exOklab(hex) {
  const [r, g, b] = exRgb(hex).map(exLin);
  const l = Math.cbrt(.4122214708 * r + .5363325363 * g + .0514459929 * b), m = Math.cbrt(.2119034982 * r + .6806995451 * g + .1073969566 * b), s = Math.cbrt(.0883024619 * r + .2817188376 * g + .6299787005 * b);
  return [.2104542553 * l + .793617785 * m - .0040720468 * s, 1.9779984951 * l - 2.428592205 * m + .4505937099 * s, .0259040371 * l + .7827717662 * m - .808675766 * s];
}
function exLinFromOk(L, a, b) {
  const l = (L + .3963377774 * a + .2158037573 * b) ** 3, m = (L - .1055613458 * a - .0638541728 * b) ** 3, s = (L - .0894841775 * a - 1.291485548 * b) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + .2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - .3413193965 * s, -.0041960863 * l - .7034186147 * m + 1.707614701 * s];
}
const exOkLch = hex => { const [L, a, b] = exOklab(hex); let h = Math.atan2(b, a) * 180 / Math.PI; if (h < 0) h += 360; return [L, Math.hypot(a, b), h]; };
function exHexFromOkLch(L, C, h) {
  const t = h * Math.PI / 180;
  return "#" + exLinFromOk(L, C * Math.cos(t), C * Math.sin(t)).map(v => exHex2(exEnc(v))).join("").toUpperCase();
}
const exInGamut = (L, C, h) => { const t = h * Math.PI / 180; return exLinFromOk(L, C * Math.cos(t), C * Math.sin(t)).every(v => v >= -1e-4 && v <= 1.0001); };
// the strongest chroma this lightness and hue can have on a screen
function exMaxChroma(L, h) { let lo = 0, hi = .4; for (let i = 0; i < 16; i++) { const mid = (lo + hi) / 2; if (exInGamut(L, mid, h)) lo = mid; else hi = mid; } return lo; }
const exFmtOk = hex => { const [L, C, h] = exOkLch(hex); return `oklch(${L.toFixed(3)} ${C.toFixed(3)} ${(C < .004 ? 0 : h).toFixed(1)})`; };

// five tints per color at fixed OKLCH lightness steps, hue kept, chroma eased into the screen's reach
const EX_TINT_STEPS = [["100", .94], ["300", .82], ["500", .66], ["700", .46], ["900", .28]];
function exTints(hex) {
  const [, C, h] = exOkLch(hex);
  return EX_TINT_STEPS.map(([k, L]) => ({ key: k, h: exHexFromOkLch(L, Math.min(C, exMaxChroma(L, h) * .92), h) }));
}

// ---------- names and roles ----------
const exSlug = s => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "color";
const exCap = s => s.charAt(0).toUpperCase() + s.slice(1);
function exName(hex) {
  const nm = typeof nameOf === "function" ? nameOf(hex) : { n: hex, text: hex, de: 0, near: [], between: null };
  const nearDE = typeof NEAR_DE !== "undefined" ? NEAR_DE : 8;
  let text = nm.between || nm.de >= nearDE ? "Near " + nm.n.toLowerCase() : nm.text;
  if (EX_DENY.test(text)) {
    const safe = (nm.near || []).find(x => !EX_DENY.test(x.n));
    text = safe ? "Near " + safe.n.toLowerCase() : "Color " + hex.slice(1);
  }
  return exCap(text);
}
// dominant = the largest area; secondary = the next if it covers 15% or more; accent = under 5%; else supporting
function exRoles(cols) {
  if (!cols.some(c => c.share != null)) return cols.map(() => null);
  const order = cols.map((c, i) => i).sort((a, b) => (cols[b].share || 0) - (cols[a].share || 0)), out = new Array(cols.length);
  let second = false;
  order.forEach((i, rank) => {
    const s = cols[i].share || 0;
    if (rank === 0) out[i] = "dominant";
    else if (s < .05) out[i] = "accent";
    else if (!second && s >= .15) { out[i] = "secondary"; second = true; }
    else out[i] = "supporting";
  });
  return out;
}
const exPct = s => s == null ? "" : s < .01 ? "<1%" : Math.round(s * 100) + "%";
// one row per color: name, slug, role, tints; the writers all start from this so the files agree with each other
function exRows(cols, opts = {}) {
  const roles = exRoles(cols), used = new Map();
  return cols.map((c, i) => {
    const name = exName(c.h);
    let slug = exSlug(name); const n = (used.get(slug) || 0) + 1; used.set(slug, n); if (n > 1) slug += "-" + n;
    return { h: c.h.toUpperCase(), share: c.share, role: roles[i], name, slug, ok: exFmtOk(c.h), tints: opts.tints ? exTints(c.h) : [] };
  });
}
const exHeadNote = "Names: nearest of about 1,000. Screen colors are approximate.";
const exTitle = o => (o && o.title) || "Palette";

// ---------- text formats ----------
function exCSS(cols, opts = {}) {
  const rows = exRows(cols, opts);
  const lines = rows.flatMap(r => [`  --${r.slug}: ${r.h}; /* ${r.ok}${r.role ? " · " + r.role : ""}${r.share != null ? " · " + exPct(r.share) : ""} */`,
    ...r.tints.map(t => `  --${r.slug}-${t.key}: ${t.h}; /* ${exFmtOk(t.h)} */`)]);
  return `/* ColorHub · ${exTitle(opts)} · ${cols.length} color${cols.length === 1 ? "" : "s"}${opts.note ? "\n   " + opts.note : ""}\n   ${exHeadNote} */\n:root {\n${lines.join("\n")}\n}\n`;
}
function exTailwind(cols, opts = {}) {
  const rows = exRows(cols, opts);
  const body = rows.map(r => r.tints.length
    ? `        "${r.slug}": {\n          DEFAULT: "${r.h}",\n${r.tints.map(t => `          ${t.key}: "${t.h}",`).join("\n")}\n        },`
    : `        "${r.slug}": "${r.h}",`).join("\n");
  return `// ColorHub · ${exTitle(opts)}${opts.note ? " · " + opts.note : ""}\n// ${exHeadNote}\n// Paste inside tailwind.config.js, in theme.extend.\nmodule.exports = {\n  theme: {\n    extend: {\n      colors: {\n${body}\n      },\n    },\n  },\n};\n`;
}
function exGPL(cols, opts = {}) {
  const rows = exRows(cols, opts), pad = n => String(n).padStart(3, " ");
  const lines = rows.flatMap(r => [[r.h, r.name], ...r.tints.map(t => [t.h, `${r.name} ${t.key}`])]).map(([h, n]) => `${exRgb(h).map(pad).join(" ")}\t${n}`);
  return `GIMP Palette\nName: ${exTitle(opts).replace(/[\r\n]+/g, " ")}\nColumns: ${Math.min(8, lines.length)}\n# ColorHub · ${exHeadNote}\n${lines.join("\n")}\n`;
}
const exXml = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]));
function exSVG(cols, opts = {}) {
  const rows = exRows(cols, opts), n = rows.length, per = Math.min(n, 6), nr = Math.ceil(n / per);
  const pw = 168, ph = opts.tints ? 300 : 236, gap = 12, pad = 28, headH = 70;
  const W = pad * 2 + per * pw + (per - 1) * gap, H = headH + nr * ph + (nr - 1) * gap + pad + 20;
  const lum = hex => { const [r, g, b] = exRgb(hex).map(exLin); return .2126 * r + .7152 * g + .0722 * b; };
  const plates = rows.map((r, i) => {
    const x = pad + (i % per) * (pw + gap), y = headH + Math.floor(i / per) * (ph + gap), fg = lum(r.h) > .4 ? "#141311" : "#FFFFFF";
    const tint = r.tints.map((t, k) => `<rect x="${x + k * (pw / 5)}" y="${y + 196}" width="${pw / 5}" height="40" fill="${t.h}"/>`).join("");
    return `<g id="${exXml(r.slug)}"><rect x="${x}" y="${y}" width="${pw}" height="${r.tints.length ? 236 : ph}" rx="4" fill="${r.h}"/>${tint}`
      + `<text x="${x + 12}" y="${y + 24}" font-family="Georgia, serif" font-size="20" fill="${fg}">${exXml(r.name)}</text>`
      + `<text x="${x + 12}" y="${y + 44}" font-family="Menlo, monospace" font-size="11" fill="${fg}" fill-opacity=".85">${r.h}</text>`
      + `<text x="${x + 12}" y="${y + (r.tints.length ? 178 : ph - 38)}" font-family="Menlo, monospace" font-size="11" fill="${fg}" fill-opacity=".85">${exXml(r.ok)}</text>`
      + `<text x="${x + 12}" y="${y + (r.tints.length ? 192 : ph - 18)}" font-family="Georgia, serif" font-style="italic" font-size="14" fill="${fg}" fill-opacity=".9">${exXml([r.role, exPct(r.share)].filter(Boolean).join(" · "))}</text></g>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">\n<title>${exXml(exTitle(opts))}</title>\n<desc>${exXml(exHeadNote + (opts.note ? " " + opts.note : ""))}</desc>\n`
    + `<rect width="${W}" height="${H}" fill="#EFEBE3"/>\n<text x="${pad}" y="44" font-family="Georgia, serif" font-size="28" fill="#141311">${exXml(exTitle(opts))}</text>\n${plates}\n`
    + `<text x="${pad}" y="${H - 14}" font-family="Georgia, serif" font-style="italic" font-size="12" fill="#5E5A51">Made in ColorHub. ${exXml(exHeadNote)}</text>\n</svg>\n`;
}

// ---------- binary formats ----------
const exU16 = n => [(n >> 8) & 255, n & 255];
const exU32 = n => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const exF32 = v => { const b = new DataView(new ArrayBuffer(4)); b.setFloat32(0, v, false); return [0, 1, 2, 3].map(i => b.getUint8(i)); };
const exU16s = s => { const out = []; for (const ch of String(s)) { const c = ch.codePointAt(0); if (c > 0xFFFF) { const d = c - 0x10000; out.push(...exU16(0xD800 + (d >> 10)), ...exU16(0xDC00 + (d & 1023))); } else out.push(...exU16(c)); } return out; };
// Adobe Swatch Exchange: "ASEF", version 1.0, a block count, then blocks. A group start (0xC001) holds the title,
// each color is a block (0x0001): UTF-16BE name with a null, "RGB ", three float32 (0..1, sRGB-encoded), a type
// (2 = normal), and the group ends with 0xC002.
function exASE(cols, opts = {}) {
  const rows = exRows(cols, opts), blocks = [];
  const nameBytes = s => { const u = exU16s(s); return { n: u.length / 2 + 1, bytes: [...u, 0, 0] }; };
  const block = (type, body) => [...exU16(type), ...exU32(body.length), ...body];
  const g = nameBytes(exTitle(opts));
  blocks.push(block(0xC001, [...exU16(g.n), ...g.bytes]));
  rows.flatMap(r => [[r.h, r.name], ...r.tints.map(t => [t.h, `${r.name} ${t.key}`])]).forEach(([h, name]) => {
    const nb = nameBytes(name);
    blocks.push(block(0x0001, [...exU16(nb.n), ...nb.bytes, 82, 71, 66, 32, ...exRgb(h).flatMap(v => exF32(v / 255)), ...exU16(2)]));
  });
  blocks.push(block(0xC002, []));
  return Uint8Array.from([65, 83, 69, 70, ...exU16(1), ...exU16(0), ...exU32(blocks.length), ...blocks.flat()]);
}
// CRC-32 and a store-only ZIP writer (no compression, so no library): enough for a one-file .swatches archive
const EX_CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function exCrc32(bytes) { let c = 0xFFFFFFFF; for (let i = 0; i < bytes.length; i++) c = EX_CRC[(c ^ bytes[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
const exLE16 = n => [n & 255, (n >> 8) & 255], exLE32 = n => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
function exZip(files) {   // files: [{ name, data: Uint8Array }]
  const enc = new TextEncoder(), parts = [], central = [], DATE = 0x5D48, TIME = 0;   // 2026-10-08 00:00, fixed so the output is deterministic
  let offset = 0;
  files.forEach(f => {
    const name = enc.encode(f.name), crc = exCrc32(f.data);
    const local = Uint8Array.from([0x50, 0x4B, 3, 4, ...exLE16(20), ...exLE16(0x0800), ...exLE16(0), ...exLE16(TIME), ...exLE16(DATE), ...exLE32(crc), ...exLE32(f.data.length), ...exLE32(f.data.length), ...exLE16(name.length), ...exLE16(0), ...name]);
    parts.push(local, f.data);
    central.push(Uint8Array.from([0x50, 0x4B, 1, 2, ...exLE16(20), ...exLE16(20), ...exLE16(0x0800), ...exLE16(0), ...exLE16(TIME), ...exLE16(DATE), ...exLE32(crc), ...exLE32(f.data.length), ...exLE32(f.data.length), ...exLE16(name.length), ...exLE16(0), ...exLE16(0), ...exLE16(0), ...exLE16(0), ...exLE32(0), ...exLE32(offset), ...name]));
    offset += local.length + f.data.length;
  });
  const cdSize = central.reduce((s, c) => s + c.length, 0);
  const end = Uint8Array.from([0x50, 0x4B, 5, 6, ...exLE16(0), ...exLE16(0), ...exLE16(files.length), ...exLE16(files.length), ...exLE32(cdSize), ...exLE32(offset), ...exLE16(0)]);
  const all = [...parts, ...central, end], out = new Uint8Array(all.reduce((s, p) => s + p.length, 0));
  let o = 0; all.forEach(p => { out.set(p, o); o += p.length; });
  return out;
}
const exHsb = hex => {
  const [r, g, b] = exRgb(hex).map(v => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0; if (d) h = mx === r ? ((g - b) / d + (g < b ? 6 : 0)) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { hue: +(h / 6).toFixed(5), saturation: +(mx ? d / mx : 0).toFixed(5), brightness: +mx.toFixed(5), alpha: 1, colorSpace: 0 };
};
// Procreate .swatches: a ZIP holding Swatches.json, [{ name, swatches: [{ hue, saturation, brightness, alpha, colorSpace }] }], HSB in 0..1
function exProcreate(cols, opts = {}) {
  const rows = exRows(cols, opts), list = rows.flatMap(r => [r.h, ...r.tints.map(t => t.h)]);
  const json = JSON.stringify([{ name: exTitle(opts), swatches: list.map(exHsb) }]);
  return exZip([{ name: "Swatches.json", data: new TextEncoder().encode(json) }]);
}

// ---------- the sheet ----------
const EX_FORMATS = [
  { k: "css", t: "CSS variables", d: "Hex, oklch() and a role for each", ext: "css", mime: "text/css", text: true },
  { k: "tailwind", t: "Tailwind", d: "A colors block for your config", ext: "tailwind.config.js", mime: "text/javascript", text: true },
  { k: "svg", t: "SVG swatch card", d: "Pastes into Figma with its names", ext: "svg", mime: "image/svg+xml", text: true },
  { k: "gpl", t: "GIMP palette", d: "Also opens in Krita and Inkscape", ext: "gpl", mime: "text/plain", text: true },
  { k: "ase", t: "Adobe swatches", d: "Photoshop, Illustrator and InDesign", ext: "ase", mime: "application/octet-stream" },
  { k: "swatches", t: "Procreate", d: "Opens as a palette in Procreate", ext: "swatches", mime: "application/octet-stream" },
];
const EX_WRITE = { css: exCSS, tailwind: exTailwind, svg: exSVG, gpl: exGPL, ase: exASE, swatches: exProcreate };
function exBuild(k, cols, opts) { return EX_WRITE[k](cols, opts); }

async function exDeliver(name, mime, data) {
  const blob = new Blob([data], { type: mime }), file = new File([blob], name, { type: mime });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file] }); return "shared"; }
  } catch (e) { if (e && e.name === "AbortError") return "cancel"; }
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return "saved";
}
function exCopy(text, msg = "Copied") {
  try { navigator.clipboard.writeText(text).then(() => toast(msg), () => toast("Couldn't copy here")); } catch (e) { toast("Couldn't copy here"); }
}
// opts: { cols: [{h, share?}], title, note }
function exOpenSheet(opts) {
  const cols = opts.cols.slice(), title = opts.title || "Palette", canShareFiles = !!(navigator.canShare && (() => { try { return navigator.canShare({ files: [new File(["x"], "x.txt", { type: "text/plain" })] }); } catch (e) { return false; } })());
  let tints = false;
  const { sh, close } = sheet(`
    <h3>Export</h3>
    <p>${cols.length} color${cols.length === 1 ? "" : "s"}, each with its name. Screen colors are approximate.</p>
    <button class="item ex-tints" data-ex-tints aria-pressed="false"><span>Add 5 tints per color</span><em>Off</em></button>
    ${EX_FORMATS.map(f => `<div class="item ex-row" data-ex-row="${f.k}"><span class="ex-t"><b>${f.t}</b><small>${f.d}</small></span>
      <span class="ex-acts">${f.text ? `<button data-ex-copy="${f.k}">Copy</button>` : ""}<button data-ex-file="${f.k}">${canShareFiles ? "Share" : "Save"}</button></span></div>`).join("")}
    <p class="fine ex-fine">Adobe swatches and Procreate files follow community-documented formats; if one won't open, the CSS and SVG always will.</p>`);
  sh.classList.add("ex-sheet");
  const o = () => ({ title, note: opts.note, tints });
  const slug = exSlug(title);
  sh.querySelector("[data-ex-tints]").onclick = e => {
    tints = !tints; e.currentTarget.setAttribute("aria-pressed", tints ? "true" : "false"); e.currentTarget.querySelector("em").textContent = tints ? "On" : "Off"; buzz(4);
  };
  sh.addEventListener("click", async e => {
    const c = e.target.closest("[data-ex-copy]"), f = e.target.closest("[data-ex-file]");
    if (c) { exCopy(exBuild(c.dataset.exCopy, cols, o())); buzz(6); }
    if (f) {
      const fmt = EX_FORMATS.find(x => x.k === f.dataset.exFile), data = exBuild(fmt.k, cols, o());
      const name = fmt.k === "tailwind" ? "tailwind.colorhub-" + slug + ".js" : `colorhub-${slug}.${fmt.ext}`;
      const r = await exDeliver(name, fmt.mime, data);
      if (r === "saved") toast("Saved " + name); else if (r === "shared") buzz(8);
    }
  });
  return { sh, close };
}

// ---------- tap opens the page, hold copies (Studio rows, David 2026-10-08: one tap on a color opens its page) ----------
// Rows that used to copy a hex on tap keep `data-copy` and gain `data-swatch`, so a tap opens the color's page;
// exLongCopy(root) adds the copy back as a press and hold, and swallows the click that follows it.
let EX_LONG_AT = 0;
window.addEventListener("click", e => {
  if (EX_LONG_AT && performance.now() - EX_LONG_AT < 900) { EX_LONG_AT = 0; e.stopPropagation(); e.preventDefault(); }
}, true);
function exLongCopy(root) {
  if (!root || root.dataset.exLong) return;
  root.dataset.exLong = "1";
  let t = 0;
  root.addEventListener("pointerdown", e => {
    const b = e.target.closest("[data-copy]"); if (!b) return;
    EX_LONG_AT = 0; clearTimeout(t);
    t = setTimeout(() => { EX_LONG_AT = performance.now(); buzz(10); exCopy(b.dataset.copy, "Copied " + b.dataset.copy); }, 520);
  });
  ["pointerup", "pointercancel", "pointerleave"].forEach(ev => root.addEventListener(ev, () => clearTimeout(t)));
}
