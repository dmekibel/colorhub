"use strict";
// You (#/you): everything that is yours, in one place, reached from the rooms stem (design round 2, 2026-10-08).
// It gathers what was scattered: the Yours count and stage (Learn's quilt), your week (the challenge streak and
// the Learner Model's days), the colors you mix up, your hearted colors and taste (favs.js, favprofile.js,
// taste.js), your eye (games/oo-ui.js, challenge.js eyeReport), what you made (Studio palettes, photos, Explore's
// Saved), what you looked at lately (learner.js trail) and, at the end, the settings (the old ⋯ menu).
// Every block renders only when it has something real to show (DESIGN-SYSTEM §10: no empty headings).
// Also here: the shared menu family's two helpers, mnHead() and mnConfirm(), and the settings sheet (menu()).

const YM_I = {
  eye: sv('<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>', 20, 1.7),
  tap: sv('<path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V11m0-2a1.5 1.5 0 0 1 3 0v2m0-1a1.5 1.5 0 0 1 3 0v4.5a6 6 0 0 1-6 6h-.8a5 5 0 0 1-4-2L4.6 15a1.5 1.5 0 0 1 2.2-2L9 15"/>', 20, 1.6),
  quick: sv('<path d="M13 2.5L4.5 13.5H11l-1 8 8.5-11H12z"/>', 20, 1.7),
  down: sv('<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>', 20, 1.7),
  up: sv('<path d="M12 15V4M7 9l5-5 5 5M5 20h14"/>', 20, 1.7),
  path: sv('<circle cx="6" cy="18" r="2.2"/><circle cx="18" cy="6" r="2.2"/><path d="M8 17c6-1 2-9 8-10"/>', 20, 1.7),
  book: sv('<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5zM4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/>', 20, 1.6),
  trash: sv('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>', 20, 1.7),
  x: sv('<path d="M6 6l12 12M18 6L6 18"/>', 20, 2),
};

// ---------------------------------------------------------------- the menu family (css/menus2.css)
// mnHead(title, o): a sheet header. title-2 on the left (an optional note under it), and at most two solid
// 44 px icon buttons on the right: o.close adds ✕ (data-mn-close), o.icons is extra button HTML.
const mnHead = (title, o = {}) => `<header class="mn-head"><div><h3 class="mn-title">${title}</h3>${o.note ? `<p class="mn-note">${o.note}</p>` : ""}</div>
  <span class="mn-acts">${o.icons || ""}${o.close ? `<button class="mn-icon" type="button" data-mn-close aria-label="Close">${YM_I.x}</button>` : ""}</span></header>`;
// a quiet row: lead (glyph or chip HTML), label, optional sub line, then a value note and › — or a switch
function mnRow(r) {
  const tail = r.sw != null ? `<span class="mn-sw${r.sw ? " on" : ""}" aria-hidden="true"><i></i></span>`
    : `${r.value ? `<span class="mn-val">${r.value}</span>` : ""}${r.danger || r.noChev ? "" : `<span class="mn-chev">${ICON.chev}</span>`}`;
  const role = r.sw != null ? ` role="switch" aria-checked="${r.sw ? "true" : "false"}"` : "";
  return `<button type="button" class="mn-row${r.danger ? " danger" : ""}" data-mn="${r.k}"${role}>${r.lead ? `<span class="mn-lead">${r.lead}</span>` : ""}
    <span class="mn-txt"><b>${r.label}</b>${r.sub ? `<small>${r.sub}</small>` : ""}</span>${tail}</button>`;
}
const mnGroup = (note, rows) => `<section class="mn-group">${note ? `<p class="mn-gnote">${note}</p>` : ""}${rows.map(mnRow).join("")}</section>`;
// mnConfirm({ title, body, yes, no, danger }) → Promise<boolean>. Replaces window.confirm(): a sheet in the
// family, the risky action as an opaque capsule (in --bad when it destroys), "Keep it" as quiet text.
function mnConfirm(o) {
  return new Promise(res => {
    let done = false;
    const { sh, close } = sheet(`<div class="mn-confirm">
      ${mnHead(esc(o.title))}${o.body ? `<p class="mn-body">${esc(o.body)}</p>` : ""}
      <button type="button" class="mn-act${o.danger ? " danger" : ""}" data-yes>${esc(o.yes || "Continue")}</button>
      <button type="button" class="mn-quiet" data-no>${esc(o.no || "Keep it")}</button></div>`);
    const end = v => { if (done) return; done = true; res(v); };
    sh.querySelector("[data-yes]").onclick = () => { buzz(o.danger ? [10, 40, 10] : 8); end(true); close(); };
    sh.querySelector("[data-no]").onclick = () => { end(false); close(); };
    // closing any other way (scrim, swipe, Escape) is a no
    new MutationObserver((_, ob) => { if (!sh.isConnected) { ob.disconnect(); end(false); } }).observe(document.body, { childList: true });
  });
}

// ---------------------------------------------------------------- settings (the old ⋯ menu), shared by the
// You page (inline, at the end) and the Settings sheet (menu() in js/learn.js)
const YM_CVD = { typical: "Typical", "red-green": "Red–green", "blue-yellow": "Blue–yellow", unsure: "Not sure" };
function ymSettingsHTML() {
  const p = S.profile || null, last = S.backedUp ? fmtDay(S.backedUp) : "";
  return mnGroup("How you see", [
    { k: "profile", lead: YM_I.eye, label: "Color vision and tools", value: p ? esc(YM_CVD[p.cvd] || "Set") : "Not set" }])
  + mnGroup("While you learn", [
    { k: "haptics", lead: YM_I.tap, label: "Haptics", sub: "A small tap on every answer", sw: S.haptics !== false },
    { k: "quick", lead: YM_I.quick, label: "Quick mode", sub: "Reviews skip typing and mixing", sw: !!S.quick }])
  + mnGroup("Your progress", [
    { k: "backup", lead: YM_I.down, label: "Back up your progress", value: last ? `Last ${esc(last)}` : "Never" },
    { k: "restore", lead: YM_I.up, label: "Restore a backup" },
    { k: "place", lead: YM_I.path, label: "Retake the placement test" }])
  + mnGroup("", [{ k: "about", lead: YM_I.book, label: "About the colors" }])
  + mnGroup("", [{ k: "reset", lead: YM_I.trash, label: "Reset all progress", danger: true }]);
}
// wire the rows inside root; back() redraws whatever screen they sit on, close() puts a sheet away first
function ymWireSettings(root, back, close = () => {}) {
  root.addEventListener("click", e => {
    const b = e.target.closest("[data-mn]"); if (!b || !root.contains(b)) return;
    const k = b.dataset.mn, flip = on => { b.querySelector(".mn-sw").classList.toggle("on", on); b.setAttribute("aria-checked", on ? "true" : "false"); };
    if (k === "haptics") { S.haptics = S.haptics === false; save(); flip(S.haptics); buzz(12); return; }
    if (k === "quick") { S.quick = !S.quick; save(); flip(S.quick); buzz(8); return; }
    if (k === "backup") { backupProgress(); const v = b.querySelector(".mn-val"); if (v) v.textContent = `Last ${fmtDay(S.backedUp)}`; return; }
    if (k === "reset") {
      return mnConfirm({ title: "Reset all progress?", body: "Every color you've learned, your reviews, your eye and your taste are erased from this phone. A backup file can bring them back; nothing else can.", yes: "Erase everything", no: "Keep my progress", danger: true })
        .then(yes => { if (!yes) return; close(); S = fresh(); save(); welcome(); });
    }
    if (k === "you") { close(); return youPage(); }
    close();
    if (k === "profile") profileSetup(back);
    if (k === "restore") restoreProgress();
    if (k === "place") how();
    if (k === "about") about();
  });
}
// the Settings sheet: menu() in js/learn.js opens this (every older [data-menu] button still lands here)
function ymSettingsSheet() {
  const { sh, close } = sheet(`<div class="mn-sheet">${mnHead("Settings", { close: true })}
    ${mnGroup("", [{ k: "you", lead: ymBubbleArt("mn-you-art"), label: "You", sub: esc(ymNote()) }])}
    ${ymSettingsHTML()}</div>`);
  sh.querySelector("[data-mn-close]").onclick = () => close();
  ymWireSettings(sh, () => go(S.tab || "learn"), close);
}

// ---------------------------------------------------------------- the stem's bubble and note (js/core.js)
// your Yours colors as one disc, in hue order; before anything is yours, the colors you're learning
function ymYours() {
  const cards = typeof cardsAll === "function" ? cardsAll() : [];
  const hk = c => { const [L, C, H] = lch(c.h); return C < 12 ? 1000 + (100 - L) : (H + 330) % 360 + (100 - L) / 400; };
  const mine = cards.filter(c => isMine(S.cards[c.id])).sort((a, b) => hk(a) - hk(b));
  const lrn = cards.filter(c => !isMine(S.cards[c.id])).sort((a, b) => hk(a) - hk(b));
  return { mine, lrn };
}
function ymBubbleArt(cls = "") {
  let cols = [];
  try { const { mine, lrn } = ymYours(); cols = (mine.length ? mine : lrn).map(c => c.h); } catch (e) {}
  if (cols.length > 16) cols = Array.from({ length: 16 }, (_, i) => cols[Math.floor(i * cols.length / 16)]);
  if (!cols.length) cols = ["#3A3732"];
  const step = 100 / cols.length;
  const g = cols.length === 1 ? cols[0] : `conic-gradient(${cols.map((h, i) => `${h} ${(i * step).toFixed(2)}% ${((i + 1) * step).toFixed(2)}%`).join(",")})`;
  return `<span class="rm-art rm-art-you ${cls}" style="background:${g}"><i></i></span>`;
}
function ymNote() {
  try { const n = ownedCount(); return n ? `${n.toLocaleString("en-US")} yours` : "Your colors and settings"; } catch (e) { return "Your colors and settings"; }
}

// ---------------------------------------------------------------- the page
// the last seven days as dots, each in a color you recalled or looked at that day (honest: logged events only)
function ymWeek() {
  const ev = (S.learn && Array.isArray(S.learn.ev)) ? S.learn.ev : [], by = {};
  ev.forEach(r => { if (!r.t || !r.h || (r.e !== "answer" && r.e !== "seen" && r.e !== "find")) return; const k = keyOf(new Date(r.t - 4 * 3600e3)); if (!by[k] || r.e === "answer") by[k] = by[k] && by[k].e === "answer" ? by[k] : r; });
  const ch = S.challenge || {};
  const days = Array.from({ length: 7 }, (_, i) => { const k = addDays(today(), i - 6), [y, m, d] = k.split("-").map(Number);
    const r = by[k], played = !!ch[k];
    return { k, h: r ? r.h : played && typeof challengeRounds === "function" ? (challengeRounds(k)[0] || {}).base : null, w: new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "narrow" }), on: !!(r || played), now: i === 6 }; });
  return days;
}
function ymEyeBars() {
  if (typeof ooEyeInfo !== "function" || typeof OO_FAMS === "undefined") return "";
  const rows = Object.keys(OO_FAMS).map(f => [f, ooEyeInfo(f, null)]).filter(([, e]) => e && e.n >= 6);
  if (rows.length < 2) return "";
  const mx = Math.max(...rows.map(r => r[1].th));
  return `<div class="ym-bars">${rows.sort((a, b) => a[1].th - b[1].th).map(([f, e]) => `<div><span>${esc(f)}</span><i style="--c:${typeof ooFamHex === "function" ? ooFamHex(f) : "#888"};--w:${Math.max(8, e.th / mx * 100).toFixed(0)}%"></i><b class="mono">${esc(e.pct)}</b></div>`).join("")}</div>`;
}
const ymSlugHash = n => "#/name/" + routeSlug(n);
function youPage() {
  S.tab = "you"; save();
  const { mine, lrn } = ymYours(), owned = mine.length, due = typeof dueList === "function" ? dueList().length : 0;
  const ck = typeof lxCheckpoint === "function" ? (() => { try { return lxCheckpoint(owned); } catch (e) { return null; } })() : null;
  const since = S.placed && S.placed.at ? `Since ${fmtDay(S.placed.at)}` : "";
  const band = (mine.length ? mine : lrn).slice(0, 40);
  const week = ymWeek(), dayN = week.filter(d => d.on).length, streak = typeof chStreak === "function" ? chStreak() : 0;
  const mix = typeof confusions === "function" ? confusions(null, 3).filter(p => p.a && p.b && p.ha && p.hb) : [];
  const fvN = typeof fvCount === "function" ? fvCount() : 0, fvTop = fvN ? fvOrder("all").slice(0, 10) : [];
  const head = fvN >= 3 && typeof fpHeadline === "function" ? fpHeadline() : "";
  const tz = S.taste || {};
  const pals = (S.palettes || []).slice(0, 3), saved = (S.saved || []).length;
  const lately = (typeof trail === "function" ? trail(14) : []).filter(x => x.kind === "color" && x.colors[0]).slice(0, 8);
  const eyeLine = typeof ooEyeLine === "function" ? ooEyeLine() : "", eyeBars = ymEyeBars();
  const trained = typeof TRAIN_KEYS !== "undefined" && typeof stationLevel === "function" && TRAIN_KEYS.some(k => { try { return stationLevel(k).tried; } catch (e) { return false; } });
  const n0 = n => Number(n).toLocaleString("en-US");
  const sets = ymSets();

  const el = show(`
    <header class="room-head"><h1 class="title-1">You</h1>${since ? `<span class="note">${esc(since)}</span>` : ""}</header>

    <section class="ym-hero">
      ${band.length ? `<button class="ym-band${mine.length ? "" : " faint"}" data-ym="map" aria-label="See your colors on the map">${band.map((c, k) => `<i style="--c:${c.h};--k:${k}"></i>`).join("")}</button>` : ""}
      <div class="ym-count"><b class="ym-n" data-count="${owned}">${owned}</b>
        <span class="ym-of"><span class="note">${owned === 1 ? "color" : "colors"} yours</span>${ck ? `<small>${owned >= ck.n ? "every name on the path" : `${ck.approx ? "about " : ""}${n0(ck.n - owned)} to ${esc(ck.name || "the next stage")}`}</small>` : ""}</span></div>
      ${owned || lrn.length ? `<div class="ym-figs">
        <div><b class="mono">${n0(lrn.length)}</b><span>learning</span></div>
        ${due && typeof deck === "function" ? `<button type="button" data-ym="recall" aria-label="Recall ${n0(due)} ${due === 1 ? "color" : "colors"} now"><b class="mono">${n0(due)}</b><span>to recall today</span></button>` : `<div><b class="mono">${n0(due)}</b><span>to recall today</span></div>`}
        <div><b class="mono">${n0(fvN)}</b><span>hearted</span></div></div>
        ${mine.length ? `<div class="ym-links"><button class="mn-link" data-ym="map">See them on your map</button>${typeof cardShare === "function" && mine.length >= 3 ? `<button class="mn-link" data-ym="share">Share your colors</button>` : ""}</div>` : ""}`
      : `<div class="mn-empty"><b>Nothing yours yet</b><small>A color becomes yours when you can still name it a day later.</small></div><button class="mn-link" data-ym="learn">Start in Learn</button>`}
    </section>

    ${dayN || streak ? `<section class="ym-sec">
      <h2 class="ym-h">Your week</h2>
      <div class="ym-week">${week.map(d => `<span class="${d.on ? "on" : ""}${d.now ? " now" : ""}"><i${d.h ? ` style="--c:${d.h}"` : ""}></i><small>${d.w}</small></span>`).join("")}</div>
      <p class="note">Color on ${dayN} of the last 7 days${streak > 1 ? ` · daily challenge ${streak} days running` : streak === 1 ? " · daily challenge played today" : ""}</p>
    </section>` : ""}

    ${sets.length ? `<section class="ym-sec">
      <h2 class="ym-h">You can name</h2>
      <div class="ym-name">${sets.map(x => `<button type="button" class="ym-set" data-set="${esc(x.id)}" aria-label="${esc(x.t)}, ${covLabel0(x.cov)}">
        <span class="ym-set-top">${coverageRing(x.cov, { size: 40, stroke: 5 })}<span class="ym-set-c">${x.hs.slice(0, 8).map(h => `<i style="--c:${h}"></i>`).join("")}</span></span>
        <b>${esc(x.t)}</b><small>${x.cov.yours} of ${x.cov.total}</small></button>`).join("")}</div>
    </section>` : ""}

    ${mix.length ? `<section class="ym-sec">
      <h2 class="ym-h">You mix these up</h2>
      ${mix.map(p => `<div class="ym-pair"><a class="ym-chip" href="${ymSlugHash(p.a)}" style="--c:${p.ha}" aria-label="${esc(p.a)}"></a><a class="ym-chip" href="${ymSlugHash(p.b)}" style="--c:${p.hb}" aria-label="${esc(p.b)}"></a>
        <span class="mn-txt"><b>${esc(p.a)} and ${esc(String(p.b).toLowerCase())}</b><small>${p.n === 1 ? "Once" : `${n0(p.n)} times`}${typeof lookDiff === "function" ? ` · ${esc(ymDiff(p))}` : ""}</small></span>
        ${typeof prQuick === "function" ? `<button type="button" class="ym-untangle" data-untangle="${mix.indexOf(p)}" aria-label="Untangle ${esc(p.a)} and ${esc(String(p.b).toLowerCase())}">Untangle</button>` : ""}</div>`).join("")}
    </section>` : ""}

    <section class="ym-sec">
      <h2 class="ym-h">What you love</h2>
      ${fvN ? `<button class="ym-strip" data-ym="favs">${fvTop.map(h => `<i style="--c:${h}"></i>`).join("")}</button>` : ""}
      ${mnRow({ k: "favs", label: "Your colors", value: fvN ? `${n0(fvN)} hearted` : "", sub: fvN ? "" : "Heart the colors you love, then rank them" })}
      ${typeof fvArtStrip === "function" ? fvArtStrip() : ""}${typeof fvCatDoors === "function" ? fvCatDoors() : ""}
      ${head ? mnRow({ k: "ftaste", label: esc(head), sub: "Your taste, from your hearts" }) : ""}
      ${tz.color ? mnRow({ k: "tzc", label: "Your color", sub: "From the 20-tap taste test", value: tz.color.at ? esc(fmtDay(tz.color.at)) : "" }) : mnRow({ k: "tzcnew", label: "Find your color", value: "20 taps" })}
      ${tz.palette ? mnRow({ k: "tzp", label: "Your palette", sub: "From the palette taste test", value: tz.palette.at ? esc(fmtDay(tz.palette.at)) : "" }) : ""}
    </section>

    <section class="ym-sec">
      <h2 class="ym-h">Your eye</h2>
      ${eyeLine ? `<p class="ym-lead">${esc(eyeLine)}</p>` : ""}
      ${eyeBars}
      ${mnRow({ k: "oo", label: "Odd one out profile", sub: "By family and by lightness, vividness, hue" })}
      ${trained ? mnRow({ k: "eyer", label: "Stations and check-ins", sub: "Your levels over time" }) : ""}
    </section>

    ${pals.length || saved ? `<section class="ym-sec">
      <h2 class="ym-h">What you made and kept</h2>
      ${pals.map(p => `<button class="ym-pal" data-pal="${esc(p.id)}"><span class="ym-pal-c">${p.cols.map(h => `<i style="--c:${h}"></i>`).join("")}</span><span class="mn-txt"><b>${esc(p.name || p.from || "Palette")}</b><small>${esc([p.cols.length + " colors", p.at ? fmtDay(p.at) : ""].filter(Boolean).join(" · "))}</small></span></button>`).join("")}
      ${(S.palettes || []).length > 3 ? mnRow({ k: "studio", label: "All your palettes", value: n0(S.palettes.length) }) : ""}
      ${saved ? mnRow({ k: "saved", label: "Saved in Explore", value: n0(saved) }) : ""}
    </section>` : ""}
    <section class="ym-sec" data-ym-photos hidden><h2 class="ym-h">Your photos</h2><div class="ym-photos"></div></section>

    ${lately.length ? `<section class="ym-sec">
      <h2 class="ym-h">Lately</h2>
      <div class="ym-lately">${lately.map(x => `<a href="${ymSlugHash(x.title)}" class="ym-late"><i style="--c:${x.colors[0].h}"></i><span>${esc(x.title)}</span></a>`).join("")}</div>
    </section>` : ""}

    <section class="ym-sec ym-settings">
      <h2 class="ym-h">Settings</h2>
      ${ymSettingsHTML()}
      <p class="ym-fine">Your progress lives only on this phone. A backup file keeps it safe.</p>
    </section>
  `, "you-page", "you");

  el.addEventListener("click", e => {
    const b = e.target.closest("[data-ym],[data-mn],[data-pal],[data-untangle],[data-set]"); if (!b) return;
    const k = b.dataset.ym || b.dataset.mn;
    if (b.dataset.untangle != null) { const p = mix[+b.dataset.untangle]; if (p) { buzz(8); ymUntangle(p); } return; }
    if (b.dataset.set) { const x = sets.find(z => z.id === b.dataset.set); if (x) { buzz(8); ymLearnSet(x); } return; }
    if (k === "recall") { buzz(8); return typeof deck === "function" ? deck("review") : go("learn"); }
    if (b.dataset.pal) return openSavedPalette(b.dataset.pal);
    if (k === "map") { S.hm = S.hm || {}; S.hm.filter = "learned"; save(); buzz(8); return roomToFloor(b); }
    if (k === "learn") return go("learn");
    if (k === "share") { buzz(8); return cardShare(ymShareSpec(mine), `${owned} colors I can name now, learned on ColorHub.`, routeURL("today"), "colorhub-my-colors.png"); }
    if (k === "favs") { S.fvCat = "colors"; return favShelf(); }
    if (k === "favart") { S.fvCat = "paintings"; save(); return favShelf(); }
    if (k === "ftaste") return favTaste();
    if (k === "tzc") return tzReopen("color");
    if (k === "tzp") return tzReopen("palette");
    if (k === "tzcnew") return tasteIntro("color");
    if (k === "oo") return ooEyePage();
    if (k === "eyer") return eyeReport();
    if (k === "studio") return go("studio");
    if (k === "saved") { S.lens = "saved"; save(); return go("explore"); }
  });
  ymWireSettings(el.querySelector(".ym-settings"), youPage);
  // photos live in IndexedDB: the shelf appears only once there's one to show
  if (typeof phList === "function") phList().then(rows => {
    const sec = el.querySelector("[data-ym-photos]"); if (!sec || !sec.isConnected || !rows.length) return;
    sec.querySelector(".ym-photos").innerHTML = rows.slice(0, 8).map(r => `<button class="ym-ph" data-ph="${r.id}"><img src="${phURL(r)}" alt="" loading="lazy"></button>`).join("");
    sec.hidden = false;
    sec.querySelectorAll("[data-ph]").forEach(x => x.onclick = () => photoPage(x.dataset.ph));
  }).catch(() => {});
  return el;
}
// saved Sets (Study keeps them in S.practice.ls.sets, js/learnset.js), newest first, each with how much of it you can name
const covLabel0 = c => typeof covLabel === "function" ? covLabel(c) : "";
function ymSets() {
  if (typeof setCoverage !== "function" || typeof coverageRing !== "function") return [];
  try {
    const ls = typeof lsState === "function" ? lsState() : null, all = (ls && ls.sets) || {};
    return Object.keys(all).map(id => ({ id, ...all[id] })).filter(x => x.t && Array.isArray(x.hs) && x.hs.length >= 2)
      .sort((a, b) => String(b.last).localeCompare(String(a.last))).slice(0, 8).map(x => ({ ...x, cov: setCoverage(x.hs) }));
  } catch (e) { return []; }
}
// back to the You page after a lesson, whichever way it ends
const ymBack = () => { if (typeof openRoute === "function" && openRoute("#/you")) return; youPage(); };
function ymLearnSet(x) { if (typeof prQuick === "function") prQuick({ items: x.hs, label: x.t, src: x.src, back: ymBack }); }
// Untangle: the pair plus its nearest third color, as a 3-color lesson (the Learn sheet opens on that pair)
function ymUntangle(p) {
  if (typeof prQuick !== "function") return;
  const go = () => {
    const a = typeof prSeed === "function" ? prSeed({ n: p.a, h: p.ha }) : null, b = typeof prSeed === "function" ? prSeed({ n: p.b, h: p.hb }) : null;
    const items = [a, b].filter(Boolean);
    if (items.length === 2 && typeof prCore === "function" && typeof de2000 === "function") {
      const near = prCore().filter(c => c.key !== a.key && c.key !== b.key && c.h !== a.h && c.h !== b.h)
        .map(c => ({ c, d: Math.min(de2000(a.h, c.h), de2000(b.h, c.h)) })).sort((m, n) => m.d - n.d)[0];
      if (near) items.push(near.c);
    }
    prQuick({ items: items.length ? items : [p.ha, p.hb], seed: a || undefined, source: "these", label: `${p.a} and ${String(p.b).toLowerCase()}`, src: "mixup", back: ymBack });
  };
  if (typeof CORE_NAMES !== "undefined" && !CORE_NAMES && typeof loadCoreNames === "function") loadCoreNames().then(go); else go();
}
// the You card (js/sharecard.js palette layout): six of your colors spread across the hue order, each named
function ymShareSpec(mine) {
  const k = Math.min(6, mine.length), picks = Array.from({ length: k }, (_, i) => mine[Math.floor((i + .5) * mine.length / k)]);
  return { layout: "palette", note: `Mine, as of ${fmtDay(today())}`, title: `${mine.length.toLocaleString("en-US")} colors`, sub: "Each one named from memory a day later.",
    plates: picks.map(c => ({ h: c.h, n: c.n })) };
}
// screenshot mode: boot.js #shot=you[:empty|:card], a simulated person, in memory only (never saved)
function ymShot(arg = "") {
  if (arg === "empty") { S.cards = {}; S.placed = { tier: 1, at: today() }; S.done = {}; return youPage(); }
  if (typeof fvDemo === "function") fvDemo(14, true);
  const now = Date.now(), day = 864e5, C = (n, h) => ({ n, h });
  [[0, "Teal", "#008080"], [1, "Coral", "#FF7F50"], [3, "Ochre", "#CC7722"], [4, "Lavender", "#B57EDC"], [6, "Sage", "#9CAF88"]]
    .forEach(([d, n, h]) => learnerLog({ type: "answer", color: C(n, h), ok: true, by: "pick", at: now - d * day - 3600e3 }));
  learnerLog({ type: "confuse", color: C("Teal", "#008080"), b: C("Petrol", "#005F6A"), src: "lesson" });
  learnerLog({ type: "confuse", color: C("Teal", "#008080"), b: C("Petrol", "#005F6A"), src: "lesson" });
  learnerLog({ type: "confuse", color: C("Mauve", "#E0B0FF"), b: C("Lilac", "#C8A2C8"), src: "lesson" });
  ["Cerulean", "Vermilion", "Celadon", "Umber"].forEach((n, i) => { const c = BYNAME.get(n.toLowerCase()); if (c) learnerLog({ type: "seen", color: C(c.n, c.h), src: "page", at: now - i * 600e3 }); });
  S.palettes = [{ id: "demo1", cols: ["#2F4E73", "#C8553D", "#E0A458", "#9CAF88", "#EFEBE3"], name: "Harbor at dusk", from: "From a photo", at: addDays(today(), -2) },
    { id: "demo2", cols: ["#5E3A2E", "#B07A52", "#D9C3A0", "#6F7D5C"], from: "Gamut wheel", at: addDays(today(), -5) }];
  S.challenge = { [today()]: { hits: [1, 1, 0, 1, 1, 1] }, [addDays(today(), -1)]: { hits: [1, 0, 1, 1, 0, 1] } };
  const el = youPage();
  if (arg === "card") cardRender(ymShareSpec(ymYours().mine)).then(b => show(`<img src="${URL.createObjectURL(b)}" style="width:100%;display:block;margin:auto">`, "fixed"));
  return el;
}
// "Petrol is darker and bluer": the honest direction words, from lookDiff
function ymDiff(p) {
  try { const d = lookDiff({ n: p.a, h: p.ha }, { n: p.b, h: p.hb }); return d === "almost the same" ? "almost the same" : `${String(p.b).toLowerCase()} is ${d}`; } catch (e) { return ""; }
}
