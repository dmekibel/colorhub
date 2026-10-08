"use strict";
// Shared palette engine (David, 2026-10-09): "a photo should get every palette type the painting page has."
// The painting page (js/gallery.js) builds its chips from a pool decoded from each painting's offline analysis
// (glPoolDecode) and picks types with GL_MODES/glModeSet/glPoolPick/glStandOut — all plain functions of a pool,
// already global (classic <script> tags, one shared scope: ROADMAP.md, CLAUDE.md "Tech"). js/studio.js's photo
// page reuses those exact functions directly (gallery.js loads earlier in index.html) rather than forking a
// second copy, so "every palette type" really is the same code on both pages.
// What gallery.js does NOT expose on its own are standalone pixel kernels: its "On the painting" markers and
// highlight (litBuild/litDraw/markDraw) are private closures inside glPage(), built around museum images that
// are only SOMETIMES readable (CORS). A photo's own canvas is always readable, so this file gives that reading
// a home any page can call: palPix() samples an <img> into a small Lab grid, palHighlightPaint() dims everything
// not near a palette, palMarkerFind() places each color's numbered marker(s). Same math as gallery.js's own
// copy, factored out once here rather than inlined twice.
// Not wired into index.html (js/studio.js's palLoad() injects this file's <script> tag the first time a photo's
// palette view needs it, the same lazy pattern js/gallery.js's glQuizLoad() uses for js/thingquiz.js) — so this
// file ships without the conductor having to touch the shared script list first.

// ---------- a photo's own pixels: always readable, no museum CORS limits ----------
// img -> a small Lab grid (same algorithm as js/gallery.js's glPage litBuild, standalone)
function palPix(img, maxSide = 140) {
  try {
    const k = maxSide / Math.max(img.naturalWidth, img.naturalHeight);
    const w = Math.max(1, Math.round(img.naturalWidth * k)), h = Math.max(1, Math.round(img.naturalHeight * k));
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const x = c.getContext("2d", { willReadFrequently: true }); x.drawImage(img, 0, 0, w, h);
    const px = x.getImageData(0, 0, w, h).data, L = new Float32Array(w * h * 3);
    for (let j = 0; j < w * h; j++) {
      const l = lab("#" + ((1 << 24) | px[j * 4] << 16 | px[j * 4 + 1] << 8 | px[j * 4 + 2]).toString(16).slice(1));
      L[j * 3] = l[0]; L[j * 3 + 1] = l[1]; L[j * 3 + 2] = l[2];
    }
    return { w, h, L };
  } catch (e) { return null; }
}
// paints cv (sized to pix) dark everywhere except near one of pal's colors (same read as gallery.js's litDraw)
function palHighlightPaint(cv, pix, pal) {
  if (!cv || !pix || !pal.length) return false;
  cv.width = pix.w; cv.height = pix.h;
  const x = cv.getContext("2d"), out = x.createImageData(pix.w, pix.h), T = pal.map(p => lab(p.h));
  for (let j = 0; j < pix.w * pix.h; j++) {
    let m = 1e9;
    for (const t of T) { const dd = Math.hypot(pix.L[j * 3] - t[0], pix.L[j * 3 + 1] - t[1], pix.L[j * 3 + 2] - t[2]); if (dd < m) m = dd; }
    const o = j * 4; out.data[o] = 14; out.data[o + 1] = 13; out.data[o + 2] = 11; out.data[o + 3] = m < 13 ? 0 : 205;
  }
  x.putImageData(out, 0, 0); return true;
}
// each pal color's main place(s), up to three, as fractions of pix.w/pix.h (same grid-density read as markDraw)
function palMarkerFind(pix, pal) {
  const w = pix.w, h = pix.h, T = pal.map(p => lab(p.h)), G = Math.max(5, Math.round(Math.min(w, h) / 9));
  const gw = Math.max(1, Math.ceil(w / G)), gh = Math.max(1, Math.ceil(h / G)), NC = gw * gh, R = 18;
  const W = T.map(() => new Float32Array(NC)), SX = T.map(() => new Float32Array(NC)), SY = T.map(() => new Float32Array(NC));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const j = (y * w + x) * 3; let bk = -1, bd = R;
    for (let k = 0; k < T.length; k++) { const t = T[k], dd = Math.hypot(pix.L[j] - t[0], pix.L[j + 1] - t[1], pix.L[j + 2] - t[2]); if (dd < bd) { bd = dd; bk = k; } }
    if (bk < 0) continue;
    const ww = 1 - bd / R, c = (y / G | 0) * gw + (x / G | 0);
    W[bk][c] += ww; SX[bk][c] += ww * x; SY[bk][c] += ww * y;
  }
  const near = (c, f) => { const cx = c % gw, cy = c / gw | 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const X = cx + dx, Y = cy + dy; if (X >= 0 && Y >= 0 && X < gw && Y < gh) f(Y * gw + X); } };
  const found = [];
  T.forEach((t, k) => {
    const sm = new Float32Array(NC); for (let c = 0; c < NC; c++) near(c, n => { sm[c] += W[k][n]; });
    let first = 0;
    for (let n = 0; n < 3; n++) {
      let bc = -1; for (let c = 0; c < NC; c++) if (sm[c] > 0 && (bc < 0 || sm[c] > sm[bc])) bc = c;
      if (bc < 0 || (n && (sm[bc] < first * .45 || sm[bc] < 3))) break;
      if (!n) first = sm[bc];
      let ww = 0, sx = 0, sy = 0; near(bc, m => { ww += W[k][m]; sx += SX[k][m]; sy += SY[k][m]; });
      if (!(ww > 0)) break;
      found.push({ k, n, fx: (sx / ww + .5) / w, fy: (sy / ww + .5) / h });
      const bx = bc % gw, by = bc / gw | 0;
      for (let c = 0; c < NC; c++) if (Math.abs(c % gw - bx) <= 2 && Math.abs((c / gw | 0) - by) <= 2) sm[c] = -1;
    }
  });
  return found.sort((a, b) => a.n - b.n);
}
