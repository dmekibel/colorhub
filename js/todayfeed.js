"use strict";
// The Today feed (David, 2026-10-21): "Today" is a Pinterest-style home feed, not the one daily game. Route #/feed
// (#/today stays Learn's address, DESIGN-SYSTEM §2); desktop nav "Today" and Places > Today open it. js/today.js is the
// separate "One Today" table (todayPick) -- this file only quotes it, to keep today's game answer out of the feed.
//
// What it is: a masonry of mixed cards, seeded by the date so everyone's Today is the same all day and new tomorrow.
//   color of the day (the first card) · paintings · palettes · colors · articles · one "Name today's color" card · Continue learning
// Pools (all read-only, nothing is made up):
//   paintings + palettes: the gallery (js/gallery.js loadGallery/glPal/glShard). 48 seeded shards of 100, 3 paintings each
//     (best of each third by the same colorfulness weighting as glDaily): the two to show, the most colorful as a palette card.
//     A shard is one small file, so the feed asks for ~48, only as cards near the screen need their title and picture.
//   colors + articles: data/analysis/articles-lite.json (the checked articles). Long ones are Article cards, short ones are
//     Color cards, the color of the day is a long one about a pigment, tradition, nature or person. Pilot/draft articles stay out.
// Cards render 24 at a time (IntersectionObserver), each into the shortest column: columns only ever grow, so nothing jumps.
// Back returns to the same screen: todayFeed() re-renders what was shown (TF.shown) and core.js restores the scroll.
// Everything here is prefixed tf / TF_.

const TF_TYPES = [["all", "All"], ["color", "Colors"], ["paint", "Paintings"], ["pal", "Palettes"], ["art", "Articles"]];
const TF_BATCH = 24, TF_SHARDS = 48;
// the rhythm of "All": 5 paintings, 3 colors, 2 palettes, 2 articles in every 12
const TF_PATTERN = ["paint", "color", "paint", "pal", "art", "paint", "color", "pal", "paint", "art", "color", "paint"];
// articles still being written (status pilot/draft in data/articles): never in the feed
const TF_SKIP = new Set(["b-dazzled-blue", "carolina-blue", "columbia-blue", "cyber-grape", "dark-slate-grey", "deep-rose-red", "delft-blue", "dresden-brown", "dull-indian-purple", "english-violet", "helvetia-blue", "india-spice", "indian-pink", "indigo", "irish-green", "isabelline", "japanese-blue", "link-map", "madder", "mauve", "pale-green-blue-grey", "pale-greyish-vinaceous", "pale-gull-grey", "pale-hortense-violet", "pale-oak", "pale-purple-drab", "pale-purplish-vinaceous", "pale-sea-grey", "pale-turtle-green", "pale-violet-plumbeous", "pale-wistaria-blue", "papyrus-white", "parula-blue", "pastel-parchment", "patina-green", "pauncy-green", "pea-soup-green", "peach-blush", "peachbeige", "pearl-beige", "pearl-blackberry", "pearl-gentian", "pearl-green", "pearly-purple", "perilla-purple", "phlox", "phlox-pink", "pig-pink", "pigeon-blue", "pinard-yellow", "plumbago-grey", "plumbago-slate", "pois-green", "pomegranate-purple", "poppy-purple", "porcelain-green", "prussian-blue", "purple-pizzazz", "red-plum", "reed-green", "reed-yellow", "robin-s-egg", "robin-s-egg-blue", "rose-castor", "rose-dawn", "rose-dust", "spanish-bistre", "steel-pink"]);
let TF = null;          // today's pool: { k, items:{paint,pal,color,art,cotd}, shown:{filter:n}, ready }
let TF_LITE = null;     // the articles index, once

const tfInk = hex => lab(hex)[0] > 60 ? "#141311" : "#F6F2EA";
const tfFilter = () => { const f = S.tf && S.tf.filter; return TF_TYPES.some(t => t[0] === f) ? f : "all"; };
// plain text out of an article's lede (no markup)
const tfPlain = s => String(s || "").replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1").replace(/\[\d+\]/g, "").replace(/[*`]/g, "").replace(/\s+/g, " ").trim();
// the first sentence whole; if it is longer than max, its first clause (up to a comma or dash) as a sentence of its own; a word cut only as the last resort
function tfSentence(s, max) {
  s = tfPlain(s);
  const m = s.match(/^.*?[.!?](?=\s|$)/);
  let t = m ? m[0] : s;
  if (t.length <= max) return t;
  const c = t.search(/, | — |; /);
  if (c >= 30 && c <= max) return t.slice(0, c).replace(/[,;—\s]+$/, "") + ".";
  return t.slice(0, max).replace(/\s+\S*$/, "") + "…";
}
// "Abbey is a vivid blue-violet that appears in…" -> "A vivid blue-violet": what the color is, in the article's own words
function tfWhat(s) {
  const m = tfPlain(s).match(/^.{1,48}? is (an? [^.;]{3,42}?)(?= (?:that|from|which|in|filed|named|first|and|with|used|appears|recorded|made|found|as|of|to|for|by|on)\b|[.;]|$)/);
  const w = m ? m[1].replace(/[,\s]+$/, "") : "";
  return w ? w.charAt(0).toUpperCase() + w.slice(1) : "";
}
const tfRead = words => Math.max(1, Math.round(words / 200));
const tfDate = k => new Date(k + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
function tfLite() {
  if (TF_LITE) return TF_LITE;
  return (TF_LITE = fetch("data/analysis/articles-lite.json" + (typeof galVer === "function" ? galVer() : "")).then(r => { if (!r.ok) throw new Error("articles " + r.status); return r.json(); })
    .catch(e => { TF_LITE = null; throw e; }));
}
const tfShuffle = (a, rnd) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// ---------- the day's pool ----------
function tfBuild(k) {
  const rnd = seededRnd(hash("today-feed" + k));
  let game = ""; try { const t = todayPick(k); game = t && t.color ? t.color.n.toLowerCase() : ""; } catch (e) {}
  return Promise.allSettled([tfLite(), loadGallery()]).then(([la, lg]) => {
    if (la.status !== "fulfilled" && lg.status !== "fulfilled") throw new Error("offline");
    const items = { paint: [], pal: [], color: [], art: [], cotd: null };
    if (la.status === "fulfilled") {
      // [slug, name, hex, words, tier, lede, names]
      const ok = la.value.filter(a => a[2] && a[5] && a[4] !== "descriptive" && !TF_SKIP.has(a[0]) && String(a[1]).toLowerCase() !== game);
      const mk = (a, t) => ({ t, key: t + ":" + a[0], slug: a[0], n: a[1], h: a[2], words: a[3], lede: a[5] });
      const story = ok.filter(a => a[3] >= 700 && ["pigment", "traditional", "nature", "person"].includes(a[4]));
      const pick = story.length ? story[Math.floor(rnd() * story.length)] : null;
      if (pick) items.cotd = mk(pick, "cotd");
      tfShuffle(ok.filter(a => a !== pick && a[3] >= 450), rnd).slice(0, 60).forEach(a => items.art.push(mk(a, "art")));
      tfShuffle(ok.filter(a => a !== pick && a[3] >= 200 && a[3] < 450), rnd).slice(0, 80).forEach(a => { const it = mk(a, "color"); it.r = 1 + rnd() * .3; items.color.push(it); });
    }
    if (lg.status === "fulfilled" && GAL) {
      const G = GAL, nSh = Math.ceil(G.n / G.shard), order = Array.from({ length: nSh }, (_, i) => i);
      for (let i = order.length - 1; i > order.length - 1 - TF_SHARDS && i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
      order.slice(-TF_SHARDS).reverse().forEach(s => {
        const lo = s * G.shard, hi = Math.min(G.n, lo + G.shard), len = hi - lo, picks = [];
        if (len < 3) return;
        for (let t = 0; t < 3; t++) {   // the best of each third of the shard (a weighted draw: more colorful paintings surface sooner)
          let best = -1, bk = -Infinity;
          for (let i = lo + Math.floor(len * t / 3); i < lo + Math.floor(len * (t + 1) / 3); i++) { const kk = Math.log(rnd() + 1e-9) / (.6 + G.C[i] / 22); if (kk > bk) { bk = kk; best = i; } }
          if (best >= 0) picks.push(best);
        }
        picks.sort((a, b) => G.C[b] - G.C[a]);
        const pal = picks.shift();
        items.pal.push({ t: "pal", key: "g:" + pal, gi: pal, r: 1.1 + rnd() * .45 });
        picks.forEach(i => items.paint.push({ t: "paint", key: "g:" + i, gi: i }));
      });
    }
    return { k, items, shown: {}, ready: true, galOk: lg.status === "fulfilled", artOk: la.status === "fulfilled" };
  });
}
// what a filter shows, in order. "All" mixes by the rhythm; every other chip is that type's whole pool.
function tfList(st, f) {
  const it = st.items, seen = new Set(), out = [];
  const push = x => { if (x && !seen.has(x.key)) { seen.add(x.key); out.push(x); } };
  if (f === "all") {
    const q = { paint: it.paint.slice(), pal: it.pal.slice(), color: it.color.slice(), art: it.art.slice() };
    for (;;) {
      let any = false;
      TF_PATTERN.forEach(t => { const x = q[t].shift(); if (x) { push(x); any = true; } });
      if (!any) break;
    }
    // the card that is yours (live learner state, not part of the day's pool) and the one game card, never first
    const g = Math.min(8, out.length), at = Math.min(3, out.length);
    out.splice(g, 0, { t: "game", key: "game" });
    out.splice(at, 0, { t: "cont", key: "cont" });
    return out;
  }
  (it[f] || []).forEach(push);
  return out;
}

// ---------- the cards ----------
const tfStripes = i => glPal(i).map(c => `<i style="--c:${c.h};flex:${Math.max(c.share, .02).toFixed(3)}"></i>`).join("");
const tfEqual = i => glPal(i).map(c => `<i style="--c:${c.h}"></i>`).join("");
function tfCard(it) {
  switch (it.t) {
    case "paint": {
      const i = it.gi, dom = glPal(i).reduce((a, b) => b.share > a.share ? b : a);
      return `<button type="button" class="tf-card tf-paint wait" data-tf="paint" data-gi="${i}"><span class="tf-im" style="--c:${dom.h};aspect-ratio:${(1 / glAR(i)).toFixed(3)}"></span><span class="tf-pal" aria-hidden="true">${tfStripes(i)}</span><span class="tf-tx"><b></b><small></small></span></button>`;
    }
    case "pal":
      return `<button type="button" class="tf-card tf-palette wait" data-tf="pal" data-gi="${it.gi}"><span class="tf-stripes" aria-hidden="true" style="aspect-ratio:${(1 / it.r).toFixed(3)}">${tfEqual(it.gi)}</span><span class="tf-tx"><b></b><small>6 colors</small></span></button>`;
    case "color":
      return `<button type="button" class="tf-card tf-color" data-tf="name" data-n="${esc(it.n)}" data-h="${it.h}" style="--c:${it.h};--ink:${tfInk(it.h)};aspect-ratio:1/${it.r.toFixed(2)}"><b>${esc(it.n)}</b>${tfWhat(it.lede) ? `<span>${esc(tfWhat(it.lede))}</span>` : ""}</button>`;
    case "art":
      return `<button type="button" class="tf-card tf-art" data-tf="name" data-n="${esc(it.n)}" data-h="${it.h}"><span class="tf-hero" style="--c:${it.h};--ink:${tfInk(it.h)}"><b>${esc(it.n)}</b></span><span class="tf-tx"><span class="tf-lede">${esc(tfSentence(it.lede, 400))}</span><small>Article · ${tfRead(it.words)} min read</small></span></button>`;
    case "cotd":
      return `<button type="button" class="tf-card tf-cotd" data-tf="name" data-n="${esc(it.n)}" data-h="${it.h}" style="--c:${it.h};--ink:${tfInk(it.h)}"><span class="tf-cotd-t"><em>Color of the day</em><b>${esc(it.n)}</b></span><span class="tf-cotd-s">${esc(tfSentence(it.lede, 240))}<i class="tf-go">Read its story ${ICON.arrow}</i></span></button>`;
    case "game": {
      let hex = "", done = false, no = 0;
      try { const t = todayPick(today()); hex = t.color.h; no = t.no; done = typeof dnDone === "function" && dnDone(); } catch (e) {}
      return `<button type="button" class="tf-card tf-game" data-tf="game">${hex ? `<i class="tf-dot" style="--c:${hex}"></i>` : ""}<span class="tf-tx"><b>${done ? "Named today's color" : "Name today's color"}</b><small>${done ? "A new color tomorrow." : (no ? "No. " + no + ". " : "") + "What is this one called?"}</small></span></button>`;
    }
    case "cont": {
      let due = [], nu = null;
      try { due = S.placed ? dueList() : []; nu = S.placed && !due.length ? nextUnit() : null; } catch (e) {}
      const strip = (due.length ? due : nu ? nu.colors : []).slice(0, 6).map(c => `<i style="--c:${c.h}"></i>`).join("");
      const t = !S.placed ? ["Learn your color names", "A short placement, then one unit at a time."]
        : due.length ? [`${due.length === 1 ? "One color" : due.length + " colors"} to recall`, "Due today, after a night's sleep."]
        : nu ? [`Next: ${nu.title}`, `${nu.colors.length} new names.`] : ["All caught up", "Your next review comes tomorrow."];
      return `<button type="button" class="tf-card tf-cont" data-tf="cont">${strip ? `<span class="tf-strip" aria-hidden="true">${strip}</span>` : ""}<span class="tf-tx"><b>${esc(t[0])}</b><small>${esc(t[1])}</small></span></button>`;
    }
  }
  return "";
}
// a painting card waits for its shard (title, artist, picture); the box and the colors are already there, so nothing moves
function tfFill(root) {
  if (typeof GAL === "undefined" || !GAL) return;
  const want = new Map();
  root.querySelectorAll(".tf-card.wait").forEach(el => { const k = Math.floor(+el.dataset.gi / GAL.shard); if (!want.has(k)) want.set(k, []); want.get(k).push(el); });
  want.forEach((els, k) => glShard(k).then(() => els.forEach(el => {
    if (!el.isConnected || !el.classList.contains("wait")) return;
    const i = +el.dataset.gi, d = glDetailNow(i); if (!d) return;
    el.classList.remove("wait", "off");
    el.setAttribute("aria-label", el.classList.contains("tf-palette") ? `Palette from ${d.t}` : d.t);
    const b = el.querySelector("b"), sm = el.querySelector("small");
    if (el.classList.contains("tf-paint")) {
      const im = el.querySelector(".tf-im"), img = new Image();
      img.alt = ""; img.decoding = "async"; img.loading = "lazy";
      const cs = glCropStyle(i, d, glAR(i)); if (cs) img.setAttribute("style", (cs.match(/style="([^"]*)"/) || [])[1] || "");
      img.onload = () => img.classList.add("on");
      img.onerror = () => img.remove();
      img.src = d.img; im.appendChild(img);
      b.textContent = d.t; sm.innerHTML = glByline(i, d);
    } else {
      b.textContent = "From " + d.t; sm.textContent = "6 colors" + (d.a ? " · " + d.a : "");
    }
  })).catch(() => els.forEach(el => { if (el.isConnected) el.classList.add("off"); })));
}

// ---------- the screen ----------
function tfSkeleton(k) {
  const rnd = seededRnd(hash("tf-sk" + k)), tab = typeof TODAY_TABLE !== "undefined" ? TODAY_TABLE : [];
  const hexes = tab.length ? tfShuffle(tab.map(r => r[2]), rnd) : ["#8A9A5B", "#464196", "#CFA41C", "#3B638C", "#A03623", "#EED9C4"];
  const hs = [1.25, .9, 1.1, 1.4, .95, 1.2, 1.05, 1.3, .85, 1.15];
  return `<div class="tf-cols tf-sk" aria-hidden="true">${[0, 1, 2, 3, 4].map(c => `<div class="tf-col">${[0, 1, 2].map(r => { const n = c + r * 5; return `<div class="tf-card sk" style="--c:${hexes[n % hexes.length]};aspect-ratio:1/${hs[n % hs.length]}"></div>`; }).join("")}</div>`).join("")}</div>`;
}
// bring the chosen chip fully into the chip row (the row scrolls sideways on a narrow phone)
function tfChipInView(row, b) { const l = b.offsetLeft - 20, r = b.offsetLeft + b.offsetWidth + 20; if (l < row.scrollLeft) row.scrollTo({ left: Math.max(0, l), behavior: "smooth" }); else if (r > row.scrollLeft + row.clientWidth) row.scrollTo({ left: r - row.clientWidth, behavior: "smooth" }); }
const tfColCount =w => document.documentElement.classList.contains("desk") ? (w >= 1240 ? 5 : w >= 900 ? 4 : 3) : w >= 700 ? 3 : 2;

function todayFeed() {
  const back = typeof BACK_RENDER !== "undefined" && BACK_RENDER, k = today();
  if (S.tab !== "feed") { S.tab = "feed"; save(); }   // the place you were last: every "go(S.tab)" Close or Back (the daily game's ✕) comes back here
  const streak = typeof chStreak === "function" ? chStreak() : 0;
  const el = show(`<header class="room-head tf-head"><h1 class="title-1">Today</h1><span class="note">${esc(tfDate(k))}${streak > 0 ? ` · ${streak}-day streak` : ""}</span></header>
    <i class="tf-sent" aria-hidden="true"></i>
    <div class="tf-chips" role="radiogroup" aria-label="Show">${TF_TYPES.map(([id, label]) => `<button type="button" role="radio" class="tf-chip" data-tf-f="${id}" aria-checked="false">${label}</button>`).join("")}</div>
    <div class="tf-feed" data-tf-feed>${tfSkeleton(k)}</div>`, "tf-screen", "feed");
  const host = el.querySelector("[data-tf-feed]"), chips = el.querySelector(".tf-chips");
  const setChips = () => chips.querySelectorAll(".tf-chip").forEach(b => { const on = b.dataset.tfF === tfFilter(); b.classList.toggle("on", on); b.setAttribute("aria-checked", on); });
  setChips();
  let st = TF && TF.k === k && TF.ready ? TF : null;
  const stop = [];
  cleanup.push(() => { stop.concat(stop.live || []).forEach(f => { try { f(); } catch (e) {} }); });
  const paint = restore => tfPaint(el, host, st, tfFilter(), restore, stop);
  chips.addEventListener("click", e => {
    const b = e.target.closest("[data-tf-f]"); if (!b || b.dataset.tfF === tfFilter() || !st) return;
    buzz(4); S.tf = { ...(S.tf || {}), filter: b.dataset.tfF }; save(); setChips(); tfChipInView(chips, b);
    st.shown[b.dataset.tfF] = 0; tfScrollTo(el, 0); paint(false);
  });
  // the chips stick under the top; once they do, a strip of ground color covers the status-bar zone above them (no layout change)
  const sent = el.querySelector(".tf-sent");
  if (sent && typeof IntersectionObserver === "function") { const so = new IntersectionObserver(es => chips.classList.toggle("stuck", !es[0].isIntersecting)); so.observe(sent); stop.push(() => so.disconnect()); }
  const load = () => {
    host.innerHTML = tfSkeleton(k);
    tfBuild(k).then(s => { TF = st = s; if (host.isConnected) paint(false); })
      .catch(() => { if (host.isConnected) host.innerHTML = `<div class="tf-state"><p class="title-3">Today didn't arrive.</p><p class="small">You may be offline. Nothing is lost.</p><button type="button" class="btn ghost" data-tf-retry>Try again</button></div>`; });
  };
  host.addEventListener("click", e => { if (e.target.closest("[data-tf-retry]")) { buzz(6); load(); } });
  if (st) paint(back); else load();
  return el;
}
// the room's scroller is the screen itself (a room sheet), or the window on a wide page: read and set whichever one scrolls
const tfScrolls = scr => scr.scrollHeight > scr.clientHeight + 2;
const tfY = scr => tfScrolls(scr) ? scr.scrollTop : scrollY;
function tfScrollTo(scr, y) { if (tfScrolls(scr)) scr.scrollTop = y; else scrollTo(0, y); }
function tfPaint(scr, host, st, f, restore, stop) {
  const live = stop.live || (stop.live = []); live.forEach(fn => { try { fn(); } catch (e) {} }); live.length = 0;
  const list = tfList(st, f), real = list.filter(x => x.t !== "cont" && x.t !== "game"), cotd = (f === "all" || f === "color") && st.items.cotd;
  if (!real.length && !cotd) {
    const why = f === "pal" || f === "paint" ? (st.galOk ? "" : "The paintings didn't load. You may be offline.") : f === "art" || f === "color" ? (st.artOk ? "" : "The articles didn't load. You may be offline.") : "";
    host.innerHTML = `<div class="tf-state"><p class="title-3">Nothing here yet.</p><p class="small">${esc(why || "Try another filter.")}</p><button type="button" class="btn ghost" data-tf-retry>Try again</button></div>`;
    return;
  }
  const shown = Math.min(list.length, restore && st.shown[f] ? st.shown[f] : TF_BATCH);
  let cols = [];
  host.innerHTML = `${cotd ? tfCard(cotd) : ""}<div class="tf-cols"></div><div class="tf-more" aria-hidden="true"></div><p class="tf-end" hidden>That is today's set. A new one arrives tomorrow.</p>`;
  const wrap = host.querySelector(".tf-cols"), more = host.querySelector(".tf-more"), end = host.querySelector(".tf-end");
  let n = 0, count = 0;
  const add = upTo => {
    const tpl = document.createElement("template");
    for (; n < Math.min(upTo, list.length); n++) {
      tpl.innerHTML = tfCard(list[n]);
      const node = tpl.content.firstElementChild; if (!node) continue;
      let s = cols[0]; for (const c of cols) if (c.offsetHeight < s.offsetHeight) s = c;
      s.appendChild(node);
    }
    tfFill(wrap);
    st.shown[f] = Math.max(st.shown[f] || 0, n);
    end.hidden = n < list.length;
  };
  const layout = upTo => {
    count = tfColCount(host.clientWidth || innerWidth); wrap.innerHTML = ""; cols = [];
    for (let c = 0; c < count; c++) { const d = document.createElement("div"); d.className = "tf-col"; wrap.appendChild(d); cols.push(d); }
    n = 0; add(upTo);
  };
  layout(shown);
  // coming Back: the cards that were on screen are drawn again (heights are known up front), then the scroll goes where it was
  if (restore && st.y && st.y[f]) { const y = st.y[f]; tfScrollTo(scr, y); requestAnimationFrame(() => tfScrollTo(scr, y)); }
  if (typeof IntersectionObserver === "function") {
    const io = new IntersectionObserver(es => { if (es.some(x => x.isIntersecting)) { if (n < list.length) add(n + TF_BATCH); io.unobserve(more); if (n < list.length) io.observe(more); } }, { root: /(auto|scroll)/.test(getComputedStyle(scr).overflowY) ? scr : null, rootMargin: "1400px 0px" });
    io.observe(more); live.push(() => io.disconnect());
  } else add(list.length);
  let rt = 0;
  const onResize = () => { clearTimeout(rt); rt = setTimeout(() => { if (host.isConnected && tfColCount(host.clientWidth || innerWidth) !== count) layout(n); }, 120); };
  addEventListener("resize", onResize); live.push(() => removeEventListener("resize", onResize));
  const onOnline = () => tfFill(wrap); addEventListener("online", onOnline); live.push(() => removeEventListener("online", onOnline));
  host.onclick = e => {
    if (e.target.closest("[data-tf-retry]")) return;
    const c = e.target.closest(".tf-card[data-tf]"); if (!c) return;
    buzz(6);
    (st.y = st.y || {})[f] = tfY(scr);
    const kind = c.dataset.tf;
    if (kind === "paint") return galleryPage(+c.dataset.gi, true);
    if (kind === "pal") return plvOpen("painting", +c.dataset.gi);
    if (kind === "game") return daily();
    if (kind === "cont") return go("learn");
    if (kind === "name") return tfOpenName(c.dataset.n, c.dataset.h);
  };
}
// a color or article by its name: the same door the router uses for #/color/<slug>, so core colors and library names both open, and Back returns here
function tfOpenName(name, hex) {
  const slug = routeSlug(name), c = routeColor(slug);
  if (c) return whenWiki(() => { const nd = colorNode(c); if (nd) openNode(nd); else openCoreName(hex, name); });
  whenWiki(() => routeNameAsync(slug).then(r => {
    if (r && r.color) return openNode(colorNode(r.color));
    if (r && r.entry) return namePage(r.entry);
    openCoreName(hex, name);
  }).catch(() => toast("That page didn't load")));
}
