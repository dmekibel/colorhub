"use strict";
// One share-card renderer for the whole app (design/IDEAS-10X/soul-delight.md, spec 1). Every share image is a
// 1080 x 1350 card in the design system: the warm-black ground, Instrument Serif for every word, Geist Mono only
// for codes, sentence case everywhere (no uppercase labels), and the colors themselves as the picture.
// It waits for the web fonts before drawing, so a card never comes out in Georgia on a cold start.
//   cardRender(spec) -> Promise<Blob>      cardShare(spec, text, url) -> share sheet / copy / download
// Layouts:
//   palette  { note, title, sub, plates: [{ h, hit }] }      Today's painting: its palette, hits ringed in paper
//   guesses  { note, title, sub, rows: [{ h, close, win }] }  Name today's color: each guess's real color and how
//                                                            close it came, a ladder converging on the answer
//   color    { note, name, hex, line }                         a single color, named
// Spoilers are the caller's job: these layouts draw only what the spec hands them.

const CARD_W = 1080, CARD_H = 1350, CARD_M = 84;
const CARD_INK = { ground: "#0E0D0B", paper: "#EFEBE3", soft: "#A39E92", faint: "#837E73", rule: "rgba(236,232,223,.14)" };
const CARD_SERIF = "'Instrument Serif', Georgia, serif", CARD_MONO = "'Geist Mono', ui-monospace, Menlo, monospace";

function cardFonts() {
  if (!document.fonts || !document.fonts.load) return Promise.resolve();
  const want = Promise.all([document.fonts.load(`130px ${CARD_SERIF}`), document.fonts.load(`italic 40px ${CARD_SERIF}`), document.fonts.load(`32px ${CARD_MONO}`)]);
  // never hang the share on a font server: after 2.5 s draw with whatever has arrived
  return Promise.race([want, new Promise(r => setTimeout(r, 2500))]).catch(() => {});
}
// a rounded rect path (Safari before 16 has no roundRect)
function cardRR(x, X, Y, W, H, r) {
  x.beginPath();
  if (x.roundRect) { x.roundRect(X, Y, W, H, r); return; }
  x.moveTo(X + r, Y); x.arcTo(X + W, Y, X + W, Y + H, r); x.arcTo(X + W, Y + H, X, Y + H, r); x.arcTo(X, Y + H, X, Y, r); x.arcTo(X, Y, X + W, Y, r); x.closePath();
}
// text that shrinks to fit a width
function cardFit(x, text, font, size, maxW) {
  let s = size;
  do { x.font = font.replace("{s}", s); } while (x.measureText(text).width > maxW && (s -= 4) > 24);
  return s;
}
function cardHead(x, spec) {
  x.fillStyle = CARD_INK.soft; x.font = `italic 400 40px ${CARD_SERIF}`;
  x.fillText(spec.note || "", CARD_M, CARD_M + 40);
  if (spec.title) {
    x.fillStyle = CARD_INK.paper;
    cardFit(x, spec.title, `400 {s}px ${CARD_SERIF}`, 150, CARD_W - 2 * CARD_M);
    x.fillText(spec.title, CARD_M - 6, CARD_M + 200);
  }
  if (spec.sub) { x.fillStyle = CARD_INK.soft; x.font = `400 38px ${CARD_SERIF}`; x.fillText(spec.sub, CARD_M, CARD_M + 262); }
}
function cardFoot(x) {
  // the wordmark: a small bubble and the name, bottom right, quiet
  x.font = `400 44px ${CARD_SERIF}`;
  const w = x.measureText("ColorHub").width, X = CARD_W - CARD_M - w, Y = CARD_H - CARD_M + 4;
  x.fillStyle = CARD_INK.paper; x.fillText("ColorHub", X, Y);
  x.beginPath(); x.arc(X - 30, Y - 14, 12, 0, Math.PI * 2); x.fillStyle = CARD_INK.paper; x.fill();
}
const CARD_LAYOUT = {
  palette(x, spec) {
    cardHead(x, spec);
    const ps = spec.plates || [], n = Math.max(1, ps.length), gap = 28, top = 470, bot = CARD_H - 250;
    const w = (CARD_W - 2 * CARD_M - gap * (n - 1)) / n, h = bot - top;
    ps.forEach((p, i) => {
      const X = CARD_M + i * (w + gap);
      x.fillStyle = p.h; cardRR(x, X, top, w, h, 10); x.fill();
      if (lab(p.h)[0] < 12) { x.strokeStyle = "rgba(255,255,255,.1)"; x.lineWidth = 2; cardRR(x, X + 1, top + 1, w - 2, h - 2, 9); x.stroke(); }
      if (p.hit) { x.strokeStyle = CARD_INK.paper; x.lineWidth = 7; cardRR(x, X - 11, top - 11, w + 22, h + 22, 18); x.stroke(); }
      // a palette of names (the You card): each plate's name under it, fitted to the plate (design round 2)
      if (p.n) { x.fillStyle = CARD_INK.soft; cardFit(x, p.n, `italic 400 {s}px ${CARD_SERIF}`, 34, w); const tw = x.measureText(p.n).width; x.fillText(p.n, X + (w - tw) / 2, bot + 56); }
      else if (p.hit === false) { x.fillStyle = CARD_INK.faint; x.font = `italic 400 34px ${CARD_SERIF}`; const t = "missed", tw = x.measureText(t).width; x.fillText(t, X + (w - tw) / 2, bot + 56); }
    });
  },
  guesses(x, spec) {
    cardHead(x, spec);
    const rows = spec.rows || [], n = Math.max(1, rows.length), top = 440, bot = CARD_H - 190, gap = 18;
    const rh = Math.min(118, (bot - top - gap * (n - 1)) / n), sw = rh, barX = CARD_M + sw + 30, barW = CARD_W - CARD_M - barX;
    rows.forEach((r, i) => {
      const Y = top + i * (rh + gap);
      x.fillStyle = r.h; cardRR(x, CARD_M, Y, sw, rh, 8); x.fill();
      if (lab(r.h)[0] < 12) { x.strokeStyle = "rgba(255,255,255,.1)"; x.lineWidth = 2; cardRR(x, CARD_M + 1, Y + 1, sw - 2, rh - 2, 7); x.stroke(); }
      if (r.win) { x.strokeStyle = CARD_INK.paper; x.lineWidth = 6; cardRR(x, CARD_M - 10, Y - 10, sw + 20, rh + 20, 15); x.stroke(); }
      // the closeness track: a hairline the full width, filled in the guess's own color as far as it came
      const bh = 16, by = Y + rh / 2 - bh / 2;
      x.fillStyle = CARD_INK.rule; cardRR(x, barX, by, barW, bh, 8); x.fill();
      x.fillStyle = r.h; cardRR(x, barX, by, Math.max(bh, barW * clamp(r.close, 0, 100) / 100), bh, 8); x.fill();
    });
  },
  color(x, spec) {
    x.fillStyle = spec.hex; cardRR(x, CARD_M, CARD_M, CARD_W - 2 * CARD_M, 760, 12); x.fill();
    x.fillStyle = CARD_INK.soft; x.font = `italic 400 40px ${CARD_SERIF}`; x.fillText(spec.note || "", CARD_M, 960);
    x.fillStyle = CARD_INK.paper; cardFit(x, spec.name, `400 {s}px ${CARD_SERIF}`, 130, CARD_W - 2 * CARD_M); x.fillText(spec.name, CARD_M - 4, 1090);
    x.fillStyle = CARD_INK.soft; x.font = `400 32px ${CARD_MONO}`; x.fillText(spec.hex, CARD_M, 1150);
    if (spec.line) { x.font = `400 36px ${CARD_SERIF}`; x.fillText(spec.line, CARD_M, 1206); }
  },
};
async function cardRender(spec) {
  await cardFonts();
  const cv = document.createElement("canvas"); cv.width = CARD_W; cv.height = CARD_H;
  const x = cv.getContext("2d");
  x.fillStyle = CARD_INK.ground; x.fillRect(0, 0, CARD_W, CARD_H);
  (CARD_LAYOUT[spec.layout] || CARD_LAYOUT.color)(x, spec);
  cardFoot(x);
  return new Promise((res, rej) => cv.toBlob(b => b ? res(b) : rej(new Error("no image")), "image/png"));
}
// Share the card as an image where the phone allows it, else the text, else copy it; a desktop gets a download.
async function cardShare(spec, text, url, fileName = "colorhub.png") {
  let blob = null;
  try { blob = await cardRender(spec); } catch (e) {}
  const file = blob && typeof File === "function" ? new File([blob], fileName, { type: "image/png" }) : null;
  try {
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text: text + (url ? "\n" + url : "") }); return "shared"; }
    if (navigator.share) { await navigator.share({ text, url }); return "shared"; }
  } catch (e) { if (e && e.name === "AbortError") return "cancelled"; }
  try { await navigator.clipboard.writeText(text + (url ? "\n" + url : "")); toast("Copied. The image is saving too"); } catch (e) {}
  if (blob) { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = fileName; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
  return "saved";
}
