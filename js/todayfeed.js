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

const TF_TYPES = [["paint", "Paintings"], ["board", "Boards"], ["color", "Colors"], ["pal", "Palettes"], ["art", "Stories"]];   // row one of the home (David, 2026-10-26): Paintings is the start and holds nothing else
const TF_BATCH = 24, TF_SHARDS = 48;
// articles still being written (status pilot/draft in data/articles): never in the feed
const TF_SKIP = new Set(["b-dazzled-blue", "carolina-blue", "columbia-blue", "cyber-grape", "dark-slate-grey", "deep-rose-red", "delft-blue", "dresden-brown", "dull-indian-purple", "english-violet", "helvetia-blue", "india-spice", "indian-pink", "indigo", "irish-green", "isabelline", "japanese-blue", "link-map", "madder", "mauve", "pale-green-blue-grey", "pale-greyish-vinaceous", "pale-gull-grey", "pale-hortense-violet", "pale-oak", "pale-purple-drab", "pale-purplish-vinaceous", "pale-sea-grey", "pale-turtle-green", "pale-violet-plumbeous", "pale-wistaria-blue", "papyrus-white", "parula-blue", "pastel-parchment", "patina-green", "pauncy-green", "pea-soup-green", "peach-blush", "peachbeige", "pearl-beige", "pearl-blackberry", "pearl-gentian", "pearl-green", "pearly-purple", "perilla-purple", "phlox", "phlox-pink", "pig-pink", "pigeon-blue", "pinard-yellow", "plumbago-grey", "plumbago-slate", "pois-green", "pomegranate-purple", "poppy-purple", "porcelain-green", "prussian-blue", "purple-pizzazz", "red-plum", "reed-green", "reed-yellow", "robin-s-egg", "robin-s-egg-blue", "rose-castor", "rose-dawn", "rose-dust", "spanish-bistre", "steel-pink"]);
let TF = null;          // today's pool: { k, items:{paint,pal,color,art,cotd}, shown:{filter:n}, ready }
let TF_LITE = null;     // the articles index, once

const tfInk = hex => lab(hex)[0] > 60 ? "#141311" : "#F6F2EA";
let TF_KIND = "paint", TF_LENS = "foryou", TF_EXTRA = [], TF_FROM_BOARD = false, TF_BTAB = "all";   // each launch opens on Paintings and For you; where you went afterwards is kept only for this visit (a Back returns to it)
const tfFilter = () => (TF_TYPES.some(t => t[0] === TF_KIND) ? TF_KIND : "paint");
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
  (it[f] || []).forEach(push);
  if (f === "color") {   // the two learning cards ride along with the colors: yours (Continue learning) and the one game
    const g = Math.min(8, out.length), at = Math.min(3, out.length);
    out.splice(g, 0, { t: "game", key: "game" });
    out.splice(at, 0, { t: "cont", key: "cont" });
  }
  return out;
}

// ---------- the cards ----------
const tfStripes = i => glPal(i).map(c => `<i style="--c:${c.h};flex:${Math.max(c.share, .02).toFixed(3)}"></i>`).join("");
const tfEqual = i => glPal(i).map(c => `<i style="--c:${c.h}"></i>`).join("");
function tfCard(it) {
  switch (it.t) {
    case "paint": {
      const i = it.gi, dom = glPal(i).reduce((a, b) => b.share > a.share ? b : a);
      return `<button type="button" class="tf-card tf-paint wait" data-tf="paint" data-gi="${i}"><span class="tf-im" style="--c:${dom.h};aspect-ratio:${(1 / glAR(i)).toFixed(3)}"></span><span class="tf-pal" aria-hidden="true">${tfStripes(i)}</span><span class="tf-heart" role="button" tabindex="0" data-tf-heart aria-pressed="false" aria-label="Keep this painting">${TF_HEART}</span><span class="tf-tx"><b></b><small></small></span></button>`;
    }
    case "sp":   // a seed painting (js/homefeed.js hfSeedRiver): drawn from its own record, before the archive has loaded
      return `<button type="button" class="tf-card tf-paint" data-tf="paint" data-gi="${it.gi}"><span class="tf-im" style="--c:${it.c};aspect-ratio:${(1 / it.ar).toFixed(3)}"><img class="on" src="${esc(it.img)}" alt="" decoding="async" loading="lazy"></span><span class="tf-heart" role="button" tabindex="0" data-tf-heart aria-pressed="false" aria-label="Keep this painting">${TF_HEART}</span><span class="tf-tx"><b>${esc(it.ti)}</b><small>${esc(it.p)}${it.p && it.y ? " · " : ""}${it.y || ""}</small></span></button>`;
    case "pal":
      return `<button type="button" class="tf-card tf-palette wait" data-tf="pal" data-gi="${it.gi}"><span class="tf-stripes" aria-hidden="true" style="aspect-ratio:${(1 / it.r).toFixed(3)}">${tfEqual(it.gi)}</span><span class="tf-tx"><b></b><small>6 colors</small></span></button>`;
    case "color":
      return `<button type="button" class="tf-card tf-color" data-tf="name" data-n="${esc(it.n)}" data-h="${it.h}" style="--c:${it.h};--ink:${tfInk(it.h)};aspect-ratio:1/${it.r.toFixed(2)}"><b>${esc(it.n)}</b></button>`;   // the name only (David, 2026-10-26: "should be only the name, not the description")
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
const tfBust = (u, t) => u + (u.includes("?") ? "&" : "?") + "r=" + t;
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
      if (el.dataset.first) { img.loading = "eager"; img.fetchPriority = "high"; }
      const cs = glCropStyle(i, d, glAR(i)); if (cs) img.setAttribute("style", (cs.match(/style="([^"]*)"/) || [])[1] || "");
      // a failed or stalled picture is asked for again (a slow or rate-limited museum host used to leave a blurry tile that never sharpened)
      img.onload = () => img.classList.add("on");
      img.onerror = () => { const t = img._try = (img._try || 0) + 1; if (t > 3) return img.remove(); setTimeout(() => { if (img.isConnected) img.src = tfBust(d.img, t); }, 700 * t); };
      img._t0 = performance.now(); img.dataset.src = d.img;
      img.src = d.img; im.appendChild(img);
      b.textContent = d.t; sm.innerHTML = glByline(i, d);
      const hb = el.querySelector("[data-tf-heart]"); if (hb && typeof fvArtHas === "function") { const on = fvArtHas(d.id); hb.classList.toggle("on", on); hb.setAttribute("aria-pressed", on); hb.innerHTML = on ? TF_HEART_ON : TF_HEART; }
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
const tfWide = () => document.documentElement.classList.contains("desk") || innerWidth >= 700;
const tfMaxCols = () => (tfWide() ? 10 : 6);
// how many across: the last pinch's choice (kept per device, one for a phone and one for a wide screen), else about one per 260 px (a phone: two)
const tfColCount = w => { const z = hfS().zc && hfS().zc[tfWide() ? "w" : "p"]; if (z) return Math.max(1, Math.min(tfMaxCols(), z)); return tfWide() ? Math.max(3, Math.min(8, Math.round(w / 260))) : 2; };

let TF_PRE = null;   // the day's presets (movement, painter, a painting to be "like", a color): js/homefeed.js hfPresets
const TF_HEART = icon("heart", 18), TF_HEART_ON = icon("heartOn", 18);
function todayFeed() {
  const back = typeof BACK_RENDER !== "undefined" && BACK_RENDER, k = today();
  if (S.tab !== "feed") { S.tab = "feed"; save(); }   // the place you were last: every "go(S.tab)" Close or Back (the daily game's ✕) comes back here
  const el = show(`<i class="tf-sent" aria-hidden="true"></i>
    <div class="tf-bars"><div class="tf-chips tf-kinds" role="radiogroup" aria-label="Show">${TF_TYPES.map(([id, label]) => `<button type="button" role="radio" class="tf-chip" data-tf-f="${id}" aria-checked="false">${label}</button>`).join("")}</div><button type="button" class="tf-tune" data-tf-tune aria-label="Home settings">${typeof FD_ICON_TUNE !== "undefined" ? FD_ICON_TUNE : ""}</button><div class="tf-chips tf-lenses" role="radiogroup" aria-label="Paintings"></div></div>
    <div class="tf-lens-head" data-tf-lh hidden></div>
    <div class="tf-feed${hfS().caps ? "" : " nocaps"}" data-tf-feed>${tfSkeleton(k)}</div>`, "tf-screen", "feed");
  const host = el.querySelector("[data-tf-feed]"), bars = el.querySelector(".tf-bars"), kindsRow = el.querySelector(".tf-kinds"), lensRow = el.querySelector(".tf-lenses"), lh = el.querySelector("[data-tf-lh]");
  let st = TF && TF.k === k && TF.ready ? TF : null, pre = TF_PRE && TF_PRE.k === k ? TF_PRE : null, tok = 0, salt = 0;
  const stop = [];
  cleanup.push(() => { stop.concat(stop.live || []).forEach(f => { try { f(); } catch (e) {} }); });
  const lensId = () => TF_LENS;
  const setKinds = () => kindsRow.querySelectorAll(".tf-chip").forEach(b => { const on = b.dataset.tfF === tfFilter(); b.classList.toggle("on", on); b.setAttribute("aria-checked", on); });
  const tfChipList = () => { const base = hfChips(pre, TF_EXTRA.some(c => c.id === lensId()) ? null : lensId()), seen = new Set(base.map(c => c.id)); return base.concat(TF_EXTRA.filter(c => !seen.has(c.id))); };
  let extraBusy = false;
  // always more to the right: when the row's end is near, new movements, painters and colors are added
  const moreLenses = async () => {
    if (extraBusy) return; extraBusy = true;
    try { const have = new Set(tfChipList().map(c => c.id)), add = await hfMoreLenses(have, 8); if (add.length) { TF_EXTRA.push(...add); const sx = lensRow.scrollLeft; drawLenses(); lensRow.scrollLeft = sx; } } catch (e) {}
    extraBusy = false;
  };
  lensRow.addEventListener("scroll", () => { if (lensRow.scrollLeft + lensRow.clientWidth > lensRow.scrollWidth - 240) moreLenses(); }, { passive: true });
  const drawLenses = () => {
    const on = tfFilter() === "paint"; lensRow.hidden = !on; lh.hidden = !on || !lh.innerHTML;
    if (!on) return;
    lensRow.innerHTML = tfChipList().map(c => `<button type="button" role="radio" class="tf-chip tf-lens${c.id === lensId() ? " on" : ""}" data-tf-l="${esc(c.id)}" aria-checked="${c.id === lensId()}">${esc(c.label)}</button>`).join("");
  };
  setKinds(); drawLenses();
  const showBars = () => { bars.classList.remove("hid"); document.documentElement.classList.remove("tf-hid"); };
  // ---- Paintings: the lens list ----
  const empty = (msg, retry) => { host.innerHTML = `<div class="tf-state"><p class="title-3">Nothing here yet.</p><p class="small">${esc(msg)}</p>${retry ? `<button type="button" class="btn ghost" data-tf-retry>Try again</button>` : ""}</div>`; };
  const drawHead = res => {
    const h = res.head || { kind: "f" }, fol = (kind, name) => `<button type="button" class="tf-follow${hfHas(kind, name) ? " on" : ""}" data-tf-follow="${kind}:${esc(name)}" aria-pressed="${hfHas(kind, name)}">${hfHas(kind, name) ? TF_HEART_ON : TF_HEART}<span>${hfHas(kind, name) ? "Following" : "Follow"}</span></button>`;
    let html = "";
    if (h.kind === "f") html = "";
    else if (h.kind === "m" || h.kind === "p") html = `<h2 class="tf-lh-t">${esc(h.name)}</h2><span class="tf-lh-n">${res.total ? res.total.toLocaleString("en-US") + " paintings" : ""}</span>${fol(h.kind, h.name)}${h.kind === "p" ? `<button type="button" class="tf-mini" data-tf-order>${hfS().pOrder === "old" ? "Oldest first" : "Shuffled"}</button>` : ""}`;
    else if (h.kind === "l") html = `<span class="tf-seed" data-tf-seed></span><div class="tf-lh-x"><h2 class="tf-lh-t" data-tf-seedt>Like this one</h2><span class="tf-lh-n" data-tf-seedn></span></div><div class="tf-seg" role="group" aria-label="Match by"><button type="button" class="${h.by === "vibe" ? "on" : ""}" data-tf-by="vibe">By look</button><button type="button" class="${h.by === "color" ? "on" : ""}" data-tf-by="color">By color</button></div><button type="button" class="tf-mini" data-tf-another="like">Another</button>`;
    else if (h.kind === "c") { const row = TODAY_TABLE.find(x => x[2] === h.hex); let nm = row ? row[1] : h.hex; if (!row) { try { nm = nameOf(h.hex).n; } catch (e) {} } html = `<span class="tf-sw" style="--c:${esc(h.hex)}"></span><h2 class="tf-lh-t">Near ${esc(nm.toLowerCase())}</h2><button type="button" class="tf-mini" data-tf-another="color">Another</button>`; }
    if ((h.kind === "mo" || h.kind === "e" || h.kind === "g") && !html) html = `<h2 class="tf-lh-t">${esc(h.name)}</h2><span class="tf-lh-n">${res.total ? res.total.toLocaleString("en-US") + " paintings" : ""}</span>`;
    if (html && TF_FROM_BOARD && h.kind !== "f") html = `<button type="button" class="tf-mini tf-back" data-tf-boards>\u2039 Boards</button>` + html;
    lh.innerHTML = html; lh.hidden = !html; lh.dataset.kind = h.kind;
    if (h.kind === "l") glShard(Math.floor(h.seed / GAL.shard)).then(() => { const d = glDetailNow(h.seed); if (!d || !lh.isConnected) return; const t = lh.querySelector("[data-tf-seedt]"), n = lh.querySelector("[data-tf-seedn]"), sd = lh.querySelector("[data-tf-seed]"); if (t) t.textContent = "Like " + d.t; if (n) n.textContent = [d.a, glYear(h.seed)].filter(Boolean).join(" · "); if (sd && d.img) { const im = new Image(); im.alt = ""; im.onload = () => sd.appendChild(im); im.src = d.img; } if (pre && pre.li === h.seed && !pre.likeTitle) { pre.likeTitle = hfShortTitle(d.t); drawLenses(); } }).catch(() => {});
  };
  const lensKeys = id => { const hk = k + "|" + HF_SESSION + "|" + hfRoll("foryou"); return { hk, ck: [id, hk, hfRoll(id), hfS().pOrder, hfS().likeBy].join("|"), fy: id === "foryou" }; };
  const mkItems = list => list.map(gi => ({ t: "paint", key: "g:" + gi, gi }));
  // one list per lens and visit (also what a sideways swipe shows next door before you let go)
  const lensOv = (id, res, items) => {
    const { hk, ck, fy } = lensKeys(id);
    const ov = HF_CACHE.get(ck) || { key: "paint:" + ck, list: items || mkItems(res.ids), seen: fy, end: "That is every painting here.", res, more: fy ? () => hfLens("foryou", hk, ++salt).then(r => mkItems(r.ids)) : null };
    HF_CACHE.set(ck, ov); return ov;
  };
  const paintings = restore => {
    const my = ++tok, id = lensId(), { hk, ck, fy } = lensKeys(id);
    const go = (res, items) => {
      if (my !== tok || !host.isConnected) return;
      drawHead(res);
      if (!res.ids.length) return empty(res.empty || "Try another one.", false);
      const ov = lensOv(id, res, items);
      tfPaint(el, host, HF_STATE, "paint", restore, stop, ov);
    };
    // the same list comes back when you return to a lens (a Back, a tab switch), so what you had on screen is still there
    if (HF_CACHE.has(ck)) return go(HF_CACHE.get(ck).res);
    host.innerHTML = tfSkeleton(k);
    // the archive's 9 MB has not arrived: the first screen comes from the small seed set at once, and the real river carries on from its last painting when more is asked for
    if (fy && !(typeof GAL !== "undefined" && GAL && GAL.n)) hfSeedLoad().then(seed => {
      if (!seed || my !== tok || !host.isConnected || HF_CACHE.has(ck) || (typeof GAL !== "undefined" && GAL && GAL.n && HF_CACHE.has(ck))) return;
      const items = hfSeedRiver(seed, hfSeedOf(hk, "seed"), 60); if (!items.length) return;
      let seeded = false; const used = items.map(x => x.gi);
      const ov = { key: "paint:" + ck, list: items, seen: false, end: "That is every painting here.", res: { ids: used, more: true, head: { kind: "f" } },
        more: () => { if (!seeded) { seeded = true; return hfAfterSeed(hk, used).then(ids => mkItems(ids)); } return hfLens("foryou", hk, ++salt).then(r => mkItems(r.ids)); } };
      HF_CACHE.set(ck, ov); drawHead(ov.res);
      tfPaint(el, host, HF_STATE, "paint", false, stop, ov);
    });
    // never stuck: a list that has not arrived in 12 s becomes a message with a retry, and the beauty list stands in for For you at 5 s
    const slow = fy ? setTimeout(() => { if (my === tok && host.isConnected && host.querySelector(".tf-sk")) hfLens("foryou", hk, 0, true).then(r => { if (my === tok && !HF_CACHE.has(ck)) go(r); }).catch(() => {}); }, 10000) : 0;
    hfBudget(hfLens(id, hk, 0), 12000, "timeout").then(res => {
      clearTimeout(slow);
      if (res === "timeout") { if (my === tok && host.isConnected && !HF_CACHE.has(ck)) empty("That is taking too long. Check your connection.", true); return; }
      if (!HF_CACHE.has(ck)) go(res);
    }).catch(() => { clearTimeout(slow); if (my === tok && host.isConnected && !HF_CACHE.has(ck)) empty("The paintings didn't load. You may be offline.", true); });
  };
  // ---- the other kinds: Colors, Palettes, Stories ----
  const others = restore => {
    const f = tfFilter(); lh.hidden = true;
    if (!st) { host.innerHTML = tfSkeleton(k); return; }
    tok++; tfPaint(el, host, st, f, restore, stop);
  };
  // Boards (David, 2026-10-26: "smart folders you scroll and pick one to expand"): a page of folder covers; a folder opens as the same endless feed with that lens
  const boardsView = () => {
    tok++; lh.hidden = true; host.innerHTML = `<div class="tf-state"><p class="small">Folders are loading…</p></div>`;
    const my = tok;
    hfBoards().then(secs => {
      if (my !== tok || !host.isConnected || tfFilter() !== "board") return;
      const TABS = [["all", "All"], ["genres", "Genres"], ["moods", "Moods"], ["painters", "Painters"], ["periods", "Periods"], ["movements", "Movements"], ["colors", "Colors"]].filter(t => t[0] === "all" || secs.some(sc => sc.tab === t[0]));
      if (!TABS.some(t => t[0] === TF_BTAB)) TF_BTAB = "all";
      // the page of categories (a board of boards): one folder per kind of board; its cover is a painting from each of three of its boards
      const catSec = tab => secs.filter(sc => sc.tab === tab), catCount = tab => catSec(tab).reduce((a, sc) => a + sc.boards.length, 0);
      const fillCat = card => {
        const tab = card.dataset.tfCat; if (card.dataset.cv) return; card.dataset.cv = "1";
        const all = catSec(tab).flatMap(sc => sc.boards), rnd = seededRnd(hash(HF_SESSION + tab)), pick = [];
        while (pick.length < 3 && all.length) pick.push(all.splice(Math.floor(rnd() * all.length), 1)[0]);
        Promise.all(pick.map(b => hfCoverIds(b.id).then(g => g[0]))).then(gis => Promise.all(gis.filter(g => g != null).map(g => glShard(Math.floor(g / GAL.shard)).then(() => [g, glDetailNow(g)])))).then(rows => {
          const ims = card.querySelectorAll(".tf-bcov i");
          rows.forEach(([g, d], n) => { if (d && d.img && ims[n]) { const im = new Image(); im.alt = ""; im.decoding = "async"; const sty = glCropStyle(g, d, glAR(g)); if (sty) im.setAttribute("style", (sty.match(/style="([^"]*)"/) || [])[1] || ""); im.onload = () => im.classList.add("on"); im.src = d.img; ims[n].appendChild(im); } });
        }).catch(() => {});
      };
      const fill = card => {
        const id = card.dataset.tfBoard; if (card.dataset.cv) return; card.dataset.cv = "1";
        hfCoverIds(id).then(gis => Promise.all(gis.map(g => glShard(Math.floor(g / GAL.shard)).then(() => [g, glDetailNow(g)])))).then(rows => {
          const ims = card.querySelectorAll(".tf-bcov i");
          rows.forEach(([g, d], n) => { if (d && d.img && ims[n]) { const im = new Image(); im.alt = ""; im.decoding = "async"; const sty = glCropStyle(g, d, glAR(g)); if (sty) im.setAttribute("style", (sty.match(/style="([^"]*)"/) || [])[1] || ""); im.onload = () => im.classList.add("on"); im.src = d.img; ims[n].appendChild(im); } });
        }).catch(() => {});
      };
      let io = null, zoomB = null;
      const wideB = () => document.documentElement.classList.contains("desk") || innerWidth >= 700, maxB = () => (wideB() ? 10 : 6);
      const colsB = () => { const z = hfS().zb && hfS().zb[wideB() ? "w" : "p"]; return z ? Math.max(1, Math.min(maxB(), z)) : wideB() ? Math.max(3, Math.min(8, Math.round((host.clientWidth || innerWidth) / 230))) : 2; };
      let bcols = colsB();
      const draw = () => {
        if (io) { io.disconnect(); io = null; }
        if (zoomB) { zoomB.destroy(); zoomB = null; }
        bcols = colsB();
        const cats = TF_BTAB === "all" ? TABS.filter(t => t[0] !== "all") : [];
        host.innerHTML = `<div class="tf-chips tf-btabs" role="tablist" aria-label="Boards">${TABS.map(([id, label]) => `<button type="button" role="tab" class="tf-chip${id === TF_BTAB ? " on" : ""}" data-tf-btab="${id}" aria-selected="${id === TF_BTAB}">${label}</button>`).join("")}</div>` +
          `<div class="tf-bwrap" style="--bcols:${bcols}">` + (cats.length ? `<h2 class="tf-bh">Browse by</h2><div class="tf-bgrid">${cats.map(([id, label]) => `<button type="button" class="tf-board tf-cat" data-tf-cat="${id}"><span class="tf-bcov"><i></i><i></i><i></i></span><b>${label}</b><small>${catCount(id)} boards</small></button>`).join("")}</div>` : "") + secs.filter(sc => sc.tab === TF_BTAB).map(sc => `<h2 class="tf-bh">${esc(sc.title)}</h2><div class="tf-bgrid">${sc.boards.map(b => `<button type="button" class="tf-board" data-tf-board="${esc(b.id)}"><span class="tf-bcov" ${b.hex ? `style="--c:${esc(b.hex)}"` : ""}><i></i><i></i><i></i></span><b>${esc(b.label)}</b><small>${esc(b.sub)}</small></button>`).join("")}</div>`).join("") + `</div>`;
        const bw = host.querySelector(".tf-bwrap");
        // zoom out and in (pinch, trackpad, ctrl+wheel, + / -): how many folders across, the one under your fingers staying put
        if (bw && typeof gzAttach === "function") zoomB = gzAttach(bw, { cols: () => bcols, min: () => 1, max: maxB, ghost: true, colW: () => { const c = bw.querySelector(".tf-board"); return c ? c.offsetWidth : 0; }, setCols: (c, fx, fy, toY) => {
          c = Math.max(1, Math.min(maxB(), c)); if (c === bcols) return false;
          const vy = fy == null ? innerHeight / 2 : fy, hit = document.elementFromPoint(fx == null ? innerWidth / 2 : fx, vy), card = hit && hit.closest("[data-tf-board]"), id = card && card.dataset.tfBoard, y0 = card ? card.getBoundingClientRect().top : 0;
          bcols = c; const sv = hfS(); sv.zb = sv.zb || {}; sv.zb[wideB() ? "w" : "p"] = c; save(); bw.style.setProperty("--bcols", c);
          const k2 = id ? [...bw.querySelectorAll("[data-tf-board]")].find(x => x.dataset.tfBoard === id) : null;
          if (k2) tfScrollTo(el, tfY(el) + k2.getBoundingClientRect().top - (toY == null ? y0 : y0 + (toY - vy)));
          return true; } });
        const cards = [...host.querySelectorAll("[data-tf-board], [data-tf-cat]")];
        if (typeof IntersectionObserver === "function") { io = new IntersectionObserver(es => es.forEach(x => { if (x.isIntersecting) { (x.target.dataset.tfCat ? fillCat : fill)(x.target); io.unobserve(x.target); } }), { rootMargin: "600px 0px" }); cards.forEach(c => io.observe(c)); }
        else cards.slice(0, 24).forEach(c => (c.dataset.tfCat ? fillCat : fill)(c));
      };
      host.onclick = e => { const cat = e.target.closest("[data-tf-cat]"); if (cat) { TF_BTAB = cat.dataset.tfCat; buzz(4); draw(); tfScrollTo(el, 0); return; } const tb = e.target.closest("[data-tf-btab]"); if (tb) { TF_BTAB = tb.dataset.tfBtab; buzz(3); draw(); tfScrollTo(el, 0); return; } const b = e.target.closest("[data-tf-board]"); if (!b) return; buzz(5); TF_KIND = "paint"; TF_LENS = b.dataset.tfBoard; TF_FROM_BOARD = true; setKinds(); drawLenses(); const on = lensRow.querySelector(".tf-lens.on"); if (on) tfChipInView(lensRow, on); showBars(); tfScrollTo(el, 0); salt = 0; paintings(false); };
      draw(); stop.push(() => { if (io) io.disconnect(); if (zoomB) zoomB.destroy(); });
    }).catch(() => { if (my === tok) host.innerHTML = `<div class="tf-state"><p class="small">The folders didn't load.</p></div>`; });
  };
  const render = restore => { const f = tfFilter(); if (f === "paint") paintings(restore); else if (f === "board") boardsView(); else others(restore); };
  kindsRow.addEventListener("click", e => {
    const b = e.target.closest("[data-tf-f]"); if (!b || b.dataset.tfF === tfFilter()) return;
    buzz(4); TF_KIND = b.dataset.tfF; TF_FROM_BOARD = false; setKinds(); drawLenses(); tfChipInView(kindsRow, b); showBars();
    if (st) st.shown[b.dataset.tfF] = 0; tfScrollTo(el, 0); render(false);
  });
  // a tap on a chip starts at the top with the rows showing; a SWIPE (want = where the next page's first row was on screen) lands exactly there: no scroll to the top, the rows stay as they were
  const pickLens = (id, want) => {
    buzz(4); TF_LENS = id; drawLenses(); const on = lensRow.querySelector(".tf-lens.on"); if (on) tfChipInView(lensRow, on);
    salt = 0;
    if (want == null) { showBars(); tfScrollTo(el, 0); paintings(false); }
    else {
      host.style.minHeight = host.offsetHeight + "px";   // the page keeps its height while the new list fills in, so the scroll cannot be clamped back up to the rows
      paintings(false); const cur = host.getBoundingClientRect().top; tfScrollTo(el, tfY(el) + cur - want);
      setTimeout(() => { host.style.minHeight = ""; }, 1800);
    }
    if (on && on === lensRow.lastElementChild) moreLenses();
    warmSoon();
  };
  lensRow.addEventListener("click", e => {
    const b = e.target.closest("[data-tf-l]"); if (!b) return;
    if (b.dataset.tfL === lensId()) { if (lensId() === "foryou") refresh(); return; }
    pickLens(b.dataset.tfL);
  });
  // swipe sideways on the paintings to go to the next / previous lens (Pinterest does the same); the row grows as you reach its end
  // the paintings follow your finger sideways with the next (or previous) lens already beside them, a thin gap between, like Pinterest's tabs:
  // you see what you are swiping to. A lens whose list is not ready yet is fetched as the swipe starts.
  let sw = null;
  const still = !matchMedia("(prefers-reduced-motion:reduce)").matches, GAP = 8;
  const glide = (x, ms) => { host.style.transition = ms ? `transform ${ms}ms cubic-bezier(.2,.8,.2,1)` : "none"; host.style.transform = x ? `translate3d(${x}px,0,0)` : ""; };
  const peekLoad = id => { const { ck, hk } = lensKeys(id); if (HF_CACHE.has(ck)) return Promise.resolve(HF_CACHE.get(ck)); return hfBudget(hfLens(id, hk, 0), 8000, "timeout").then(r => (r === "timeout" || !r || !r.ids || !r.ids.length ? null : lensOv(id, r))).catch(() => null); };
  // the lenses beside this one, ready before you swipe: their lists, their details and their first pictures (so the page that slides in is sharp, not a blur)
  const warmNeighbors = () => {
    if (!host.isConnected || tfFilter() !== "paint") return;
    const list = tfChipList(), i = list.findIndex(c => c.id === lensId());
    [list[i + 1], list[i - 1]].forEach(c => { if (!c) return; peekLoad(c.id).then(ov => {
      if (!ov) return; const gis = ov.list.slice(0, 18).filter(x => x.t === "paint").map(x => x.gi), by = new Map();
      gis.forEach(g => { const k = Math.floor(g / GAL.shard); if (!by.has(k)) by.set(k, []); by.get(k).push(g); });
      by.forEach((gs, k) => glShard(k).then(() => gs.forEach(g => { const d = glDetailNow(g); if (d && d.img) { const im = new Image(); im.decoding = "async"; im.src = d.img; } })).catch(() => {}));
    }); });
  };
  let warmT = 0; const warmSoon = () => { clearTimeout(warmT); warmT = setTimeout(warmNeighbors, 1200); };
  warmSoon();
  const peekBuild = (ov, side) => {   // side: 1 = right of the page, -1 = left
    const W = host.clientWidth || innerWidth, count = tfColCount(W), cols = Array.from({ length: count }, () => ({ h: 0, html: "" }));
    ov.list.slice(0, 26).forEach(it => { if (it.t !== "paint") return; let c = cols[0]; for (const x of cols) if (x.h < c.h) c = x; c.h += 1 / glAR(it.gi); c.html += tfCard(it); });
    const d = document.createElement("div"); d.className = "tf-peek"; d.setAttribute("aria-hidden", "true");
    const topPx = Math.max(0, Math.round(tfY(el)));   // the new page's first row sits where the first row sits at scroll 0 (under the rows), seen from where this page is scrolled to
    d.style.cssText = `position:absolute;top:${topPx}px;left:${side * (innerWidth + GAP)}px;width:${W}px;pointer-events:none`;
    d.innerHTML = `<div class="tf-cols">${cols.map(c => `<div class="tf-col">${c.html}</div>`).join("")}</div>`;
    host.appendChild(d);
    if (typeof fdMicroPaint === "function") d.querySelectorAll(".tf-paint .tf-im").forEach(im => fdMicroPaint(im, +im.closest(".tf-card").dataset.gi));
    d.querySelectorAll(".tf-card").forEach((c, n) => { if (n < 18) c.dataset.first = "1"; });   // eager and high priority: off to the side, a lazy picture would never load, and you would swipe onto blur
    try { tfFill(d.querySelector(".tf-cols")); } catch (e) {}   // the real pictures, as for the page itself
    return d;
  };
  const peeksOff = () => { host.querySelectorAll(".tf-peek").forEach(n => n.remove()); host.style.position = ""; document.documentElement.style.overflowX = ""; };
  el.addEventListener("touchstart", e => {
    sw = e.touches.length === 1 && e.touches[0].clientX > 24 && e.touches[0].clientX < innerWidth - 24 && tfFilter() === "paint" && !e.target.closest(".tf-bars,.sheet,input,[data-nopull-x]") ? { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now(), lock: 0, pk: {} } : null;
  }, { passive: true });
  const peekFor = (s0, side) => {   // the lens on that side, loaded (once) and drawn beside the page when it arrives
    if (s0.pk[side]) return s0.pk[side];
    const list = tfChipList(), i = list.findIndex(c => c.id === lensId()), j = i + (side > 0 ? 1 : -1), tgt = list[j];
    const o = s0.pk[side] = { id: tgt ? tgt.id : null, ov: null, el: null, ready: !tgt };
    if (tgt) peekLoad(tgt.id).then(ov => { o.ov = ov; o.ready = true; if (ov && sw === s0 && still && host.isConnected) { o.el = peekBuild(ov, side); } else if (ov && s0.ending) o.el = null; });
    else if (side > 0) moreLenses();
    return o;
  };
  el.addEventListener("touchmove", e => {
    if (!sw) return; if (e.touches.length > 1) { sw = null; glide(0, 0); peeksOff(); return; }
    const dx = e.touches[0].clientX - sw.x, dy = e.touches[0].clientY - sw.y;
    if (!sw.lock && (Math.abs(dx) > 12 || Math.abs(dy) > 12)) {
      sw.lock = Math.abs(dx) > Math.abs(dy) * 1.3 ? 1 : -1;
      if (sw.lock === 1 && still) { showBars(); host.style.position = "relative"; document.documentElement.style.overflowX = "hidden"; peekFor(sw, 1); peekFor(sw, -1); }
    }
    if (sw.lock === 1 && still) {
      const side = dx < 0 ? 1 : -1, pk = sw.pk[side], blocked = !pk || !pk.id;   // nothing beyond this end: it gives, but only a little
      glide(blocked ? dx * .25 : dx, 0);
    }
  }, { passive: true });
  el.addEventListener("touchend", async e => {
    const s0 = sw; sw = null; if (!s0 || !e.changedTouches.length) return;
    s0.ending = true;
    const dx = e.changedTouches[0].clientX - s0.x, dy = e.changedTouches[0].clientY - s0.y, side = dx < 0 ? 1 : -1;
    const back = () => { if (s0.lock === 1) { glide(0, 240); setTimeout(peeksOff, 260); } };
    if (Math.abs(dx) < 70 || Math.abs(dy) > Math.abs(dx) * .55 || Date.now() - s0.t > 700 || document.querySelector(".sheet")) return back();
    let pk = peekFor(s0, side);
    if (!pk.id) { await moreLenses(); const list = tfChipList(), i = list.findIndex(c => c.id === lensId()), tgt = list[i + (side > 0 ? 1 : -1)]; if (!tgt) return back(); pk = s0.pk[side] = { id: tgt.id, ov: null, el: null, ready: false }; peekLoad(tgt.id).then(ov => { pk.ov = ov; pk.ready = true; }); }
    const t0 = Date.now(); while (!pk.ready && Date.now() - t0 < 900) await new Promise(r => setTimeout(r, 40));   // the neighbor's list is on its way
    if (!pk.ov) return back();
    if (still) {
      if (!pk.el) pk.el = peekBuild(pk.ov, side);
      glide(-side * (innerWidth + GAP), 230); await new Promise(r => setTimeout(r, 235));
    }
    glide(0, 0); peeksOff();
    pickLens(pk.id);   // the new page starts at its top, under the rows, exactly where the page beside this one showed it
  }, { passive: true });
  el.querySelector("[data-tf-tune]").addEventListener("click", () => tfSettings(key => {
    if (key === "caps") host.classList.toggle("nocaps", !hfS().caps);
    else if ((key === "alike") && lensId() === "foryou" && tfFilter() === "paint" && host.querySelector(".tf-paint[data-gi]")) reanchor();
    else if (key === "river" || key === "alike") { HF_CACHE.clear(); HF_ENDS.clear(); HF_VR.clear(); salt = 0; tfScrollTo(el, 0); paintings(false); }
  }));
  // a settings change keeps the painting you are on and the few around it, and lets the rest follow the new settings from there (no jump to a new spot)
  const reanchor = async () => {
    const top0 = bars.getBoundingClientRect().bottom, vis = [...host.querySelectorAll(".tf-paint[data-gi][data-ix]")].map(c => ({ c, r: c.getBoundingClientRect() })).filter(x => x.r.bottom > top0 + 20 && x.r.top < innerHeight - 20).sort((a, b) => a.c.dataset.ix - b.c.dataset.ix);
    if (!vis.length) { HF_CACHE.clear(); HF_ENDS.clear(); HF_VR.clear(); salt = 0; paintings(false); return; }
    const mid = innerHeight / 2, mine = vis.reduce((b, x) => (Math.abs(x.r.top + x.r.height / 2 - mid) < Math.abs(b.r.top + b.r.height / 2 - mid) ? x : b), vis[0]);
    const keep = vis.slice(0, 8).map(x => +x.c.dataset.gi), anchor = +mine.c.dataset.gi, y0 = mine.r.top, my = ++tok, { hk, ck } = lensKeys("foryou");
    HF_ENDS.clear(); HF_VR.clear();
    const res = await hfAround(hk, keep).catch(() => null);
    if (my !== tok || !host.isConnected || !res || !res.after.length) { if (my === tok) { HF_CACHE.clear(); salt = 0; paintings(false); } return; }
    const ids = [...res.before, ...keep, ...res.after];
    HF_CACHE.delete(ck);
    const ov = lensOv("foryou", { ids, more: true, head: { kind: "f" } }, mkItems(ids));
    ov.res = { ids, more: true, head: { kind: "f" } };
    HF_STATE.shown[ov.key] = Math.max(TF_BATCH, ids.indexOf(anchor) + 16); delete HF_STATE.y[ov.key];   // enough cards drawn to reach the painting you were on
    tfPaint(el, host, HF_STATE, "paint", true, stop, ov);
    const card = host.querySelector(`.tf-paint[data-gi="${anchor}"]`);
    if (card) tfScrollTo(el, tfY(el) + card.getBoundingClientRect().top - y0);
  };
  // a new seed for "Like this one" or "Near a color"
  const another = w => {
    const s2 = hfS(); s2.roll = { ...(s2.roll || {}), [w]: hfRoll(w) + 1 }; save(); buzz(6);
    hfPresets(k).then(p => { pre = TF_PRE = p; const nid = w === "like" ? (p.li >= 0 ? "l:" + p.li : "foryou") : (p.color ? "c:" + p.color.h : "foryou"); TF_LENS = nid; drawLenses(); tfScrollTo(el, 0); paintings(false); });
  };
  // pull down at the very top (or re-tap For you): a new river for For you, a new shuffle for a movement or painter, a new seed for the other two
  const refresh = () => {
    if (tfFilter() !== "paint") return;
    const id = lensId();
    if (id.startsWith("l:")) return another("like");
    if (id.startsWith("c:")) return another("color");
    const s2 = hfS(); s2.roll = { ...(s2.roll || {}), [id]: hfRoll(id) + 1 }; salt = 0; save(); buzz(8); tfScrollTo(el, 0); showBars(); paintings(false);
  };
  lh.addEventListener("click", e => {
    const fo = e.target.closest("[data-tf-follow]"), or = e.target.closest("[data-tf-order]"), by = e.target.closest("[data-tf-by]"), an = e.target.closest("[data-tf-another]"), rs = e.target.closest("[data-tf-reshuffle]");
    if (e.target.closest("[data-tf-boards]")) { buzz(4); TF_KIND = "board"; TF_FROM_BOARD = false; setKinds(); drawLenses(); showBars(); tfScrollTo(el, 0); render(false); return; }
    if (fo) { const [kind, ...r] = fo.dataset.tfFollow.split(":"), name = r.join(":"), on = !hfHas(kind, name); buzz(on ? 10 : 4); hfSetFollow(kind, name, on); fo.classList.toggle("on", on); fo.setAttribute("aria-pressed", on); fo.innerHTML = `${on ? TF_HEART_ON : TF_HEART}<span>${on ? "Following" : "Follow"}</span>`; drawLenses(); toast(on ? "Following " + name : "Unfollowed " + name, { low: true, ms: 2200 }); }
    if (or) { hfS().pOrder = hfS().pOrder === "old" ? "shuffle" : "old"; save(); buzz(4); tfScrollTo(el, 0); paintings(false); }
    if (by) { hfS().likeBy = by.dataset.tfBy; save(); buzz(4); tfScrollTo(el, 0); paintings(false); }
    if (an) another(an.dataset.tfAnother);
  });
  // the bars stick under the top; once they do, a strip of ground color covers the status-bar zone above them (no layout change)
  const sent = el.querySelector(".tf-sent");
  if (sent && typeof IntersectionObserver === "function") { const so = new IntersectionObserver(es => bars.classList.toggle("stuck", !es[0].isIntersecting)); so.observe(sent); stop.push(() => so.disconnect()); }
  tfBarWire(el, bars, stop);
  tfPullWire(el, host, () => refresh(), stop);
  const load = () => {
    host.innerHTML = tfSkeleton(k);
    tfBuild(k).then(s => { TF = st = s; if (host.isConnected && tfFilter() !== "paint") others(back); }).catch(() => { if (host.isConnected && tfFilter() !== "paint") empty("You may be offline. Nothing is lost.", true); });
    loadGallery().then(() => hfPresets(k)).then(p => { pre = TF_PRE = p; if (host.isConnected) drawLenses(); }).catch(() => {});
  };
  host.addEventListener("click", e => { if (e.target.closest("[data-tf-retry]")) { buzz(6); HF_CACHE.clear(); st = null; load(); render(false); } });
  if (st) { if (!pre) loadGallery().then(() => hfPresets(k)).then(p => { pre = TF_PRE = p; if (host.isConnected) drawLenses(); }).catch(() => {}); render(back); } else { load(); if (tfFilter() === "paint") paintings(back); }
  return el;
}
// the room's scroller is the screen itself (a room sheet), or the window on a wide page: read and set whichever one scrolls
const tfScrolls = scr => scr.scrollHeight > scr.clientHeight + 2;
const tfY = scr => tfScrolls(scr) ? scr.scrollTop : scrollY;
function tfScrollTo(scr, y) { if (tfScrolls(scr)) scr.scrollTop = y; else scrollTo(0, y); }
// pull down at the very top to refresh, the way a phone browser does: a circle grows as you pull, a new list on release (touch only)
function tfPullWire(scr, host, onRefresh, stop) {
  const ind = document.createElement("div"); ind.className = "tf-pull"; ind.setAttribute("aria-hidden", "true");
  ind.innerHTML = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 4v5h-5"/></svg>`;
  host.parentNode.insertBefore(ind, host);
  let y0 = 0, pull = 0, on = false, spin = 0;
  const set = (h, anim) => { ind.style.transition = anim ? "height .22s var(--ease)" : "none"; ind.style.height = h + "px"; const p = Math.min(1, h / 64); ind.firstChild.style.opacity = p; ind.firstChild.style.transform = `rotate(${h * 4}deg) scale(${.6 + .4 * p})`; ind.classList.toggle("ready", h >= 64); };
  const down = e => { if (e.touches.length !== 1 || tfY(scr) > 0 || tfFilter() !== "paint") { on = false; return; } y0 = e.touches[0].clientY; pull = 0; on = true; };
  const move = e => {
    if (!on) return;
    const dy = e.touches[0].clientY - y0;
    if (dy <= 0 || tfY(scr) > 0) { if (pull) set(0, true); pull = 0; if (dy <= 0) on = dy < -2 ? false : on; return; }
    pull = Math.min(dy * .5, 96); if (pull > 4 && e.cancelable) e.preventDefault(); set(pull, false);
  };
  const up = () => { if (!on) return; on = false; const go = pull >= 64; set(go ? 40 : 0, true); if (go) { buzz(8); ind.classList.add("busy"); setTimeout(() => { ind.classList.remove("busy"); set(0, true); }, 700); onRefresh(); } pull = 0; };
  scr.addEventListener("touchstart", down, { passive: true }); scr.addEventListener("touchmove", move, { passive: false }); scr.addEventListener("touchend", up); scr.addEventListener("touchcancel", up);
  stop.push(() => { scr.removeEventListener("touchstart", down); scr.removeEventListener("touchmove", move); scr.removeEventListener("touchend", up); scr.removeEventListener("touchcancel", up); ind.remove(); });
}
// the Home settings (David, 2026-10-26): painter and year are off by default so the paintings take the screen; the river can be turned off for a plain shuffle
// the half-height panel (the same look as the Explorer's settings): the page stays visible above it, so you see what a slider does as you move it
function tfHalf(sh) {
  const desk = document.documentElement.classList.contains("desk");
  sh.classList.add(desk ? "tf-pop" : "fs-half");
  const sc = sh.previousElementSibling; if (sc && sc.classList.contains("scrim")) sc.classList.add("hm-scrim-clear");
  const close = () => { const c = document.querySelector(".scrim.hm-scrim-clear"); if (c) c.dispatchEvent(new PointerEvent("pointerdown")); };
  const x = document.createElement("button"); x.type = "button"; x.className = "tf-x"; x.setAttribute("aria-label", "Close"); x.innerHTML = ICON.x;
  x.onclick = () => { buzz(4); close(); };
  sh.querySelector(".fs-head").appendChild(x);
  // a tap anywhere outside the card closes it (the page behind stays live, so the scrim cannot do this)
  const away = e => { if (!sh.isConnected) { removeEventListener("pointerdown", away, true); return; } if (sh.contains(e.target) || e.target.closest("[data-tf-tune]")) return; removeEventListener("pointerdown", away, true); close(); };
  setTimeout(() => addEventListener("pointerdown", away, true), 60);
}
function tfSettings(onChange) {
  const sw = (k, label, on) => `<div class="fs-c fs-tg"><p>${label}</p><button type="button" class="fs-switch" role="switch" aria-checked="${on}" data-tfs="${k}"><i></i></button></div>`;
  const word = v => (v > 80 ? "Almost the same" : v > 55 ? "Steady" : v > 30 ? "Varied" : "Exploring");
  const tword = v => (v > 80 ? "The same few years" : v > 55 ? "The same era" : v > 30 ? "A few eras" : "Any time");
  const pword = v => (v > 80 ? "The same country" : v > 55 ? "Mostly the same" : v > 30 ? "A few countries" : "Anywhere");
  const wordOf = k => (k === "alikeT" ? tword : k === "alikeP" ? pword : word);
  const rng = (k, label, v) => `<div class="fs-c"><div class="fs-row"><p>${label}</p><b data-tfout="${k}">${wordOf(k)(v)}</b></div><input type="range" min="0" max="100" step="1" value="${v}" style="--p:${v}%" data-tfal="${k}" aria-label="${label}"></div>`;
  const c = Math.round(hfAlikeC() * 100), v = Math.round(hfAlikeV() * 100), t = Math.round(hfAlikeT() * 100), pl = Math.round(hfAlikeP() * 100);
  const { sh } = sheet(`<div class="fs-sheet"><div class="fs-head"><h3>Settings</h3></div><div class="fs-scroll">${sw("caps", "Show painter and year", !!hfS().caps)}${sw("river", "Flow by color", hfRiverOn())}
    <div data-tfalikebox${hfRiverOn() ? "" : " hidden"}>${rng("alikeC", "Color", c)}${rng("alikeV", "Look", v)}${rng("alikeT", "Time", t)}${rng("alikeP", "Place", pl)}</div></div></div>`, { lock: false });
  tfHalf(sh);
  const paint = (k, n) => { const r = sh.querySelector(`[data-tfal="${k}"]`); if (!r) return; r.value = n; r.style.setProperty("--p", n + "%"); const o = sh.querySelector(`[data-tfout="${k}"]`); if (o) o.textContent = wordOf(k)(n); };
  sh.addEventListener("input", e => {
    const r = e.target.closest("[data-tfal]"); if (!r) return; const k = r.dataset.tfal, n = +r.value; paint(k, n);
  });
  sh.addEventListener("change", e => {
    const r = e.target.closest("[data-tfal]"); if (!r) return; const st = hfS(), n = +r.value;
    st[r.dataset.tfal] = n;
    save(); buzz(4); onChange("alike");
  });
  sh.addEventListener("click", e => {
    const b = e.target.closest("[data-tfs]"); if (!b) return;
    const k = b.dataset.tfs, st = hfS(); st[k === "river" ? "river" : "caps"] = k === "river" ? !hfRiverOn() : !st.caps; save();
    b.setAttribute("aria-checked", k === "river" ? hfRiverOn() : !!st.caps); buzz(4);
    if (k === "river") sh.querySelector("[data-tfalikebox]").hidden = !hfRiverOn();
    onChange(k);
  });
}
// the two rows slide away as you scroll down and come back as soon as you scroll up (Pinterest and Safari do the same); near the top they stay
function tfBarWire(scr, bars, stop) {
  const root = document.documentElement; let last = tfY(scr), acc = 0, hid = false;
  const set = h => { if (h === hid) return; hid = h; bars.classList.toggle("hid", h); root.classList.toggle("tf-hid", h); };
  const on = () => {
    const y = tfY(scr), d = y - last; last = y;
    if (y < 90) { acc = 0; return set(false); }
    if (d && Math.sign(d) !== Math.sign(acc)) acc = 0;
    acc += d; if (acc > 16) set(true); else if (acc < -10) set(false);
  };
  addEventListener("scroll", on, { passive: true }); scr.addEventListener("scroll", on, { passive: true });
  stop.push(() => { removeEventListener("scroll", on); scr.removeEventListener("scroll", on); root.classList.remove("tf-hid"); });
}
const HF_STATE = { shown: {}, y: {} }, HF_CACHE = new Map();   // HF_CACHE: a lens list per day, kept for the session   // where each painting list was, for Back
// ov: a painting list from js/homefeed.js { key, list, seen, more, end } -- used instead of one of the Colors / Palettes / Stories pools
function tfPaint(scr, host, st, f, restore, stop, ov) {
  const live = stop.live || (stop.live = []); live.forEach(fn => { try { fn(); } catch (e) {} }); live.length = 0;
  const list = ov ? ov.list : tfList(st, f), fk = ov ? ov.key : f, cotd = !ov && f === "color" && st.items.cotd;
  const real = list.filter(x => x.t !== "cont" && x.t !== "game");
  if (!real.length && !cotd) {
    const why = f === "pal" ? (st.galOk ? "" : "The paintings didn't load. You may be offline.") : f === "art" || f === "color" ? (st.artOk ? "" : "The articles didn't load. You may be offline.") : "";
    host.innerHTML = `<div class="tf-state"><p class="title-3">Nothing here yet.</p><p class="small">${esc(why || "Try another one.")}</p><button type="button" class="btn ghost" data-tf-retry>Try again</button></div>`;
    return;
  }
  const shown = Math.min(list.length, restore && st.shown[fk] ? st.shown[fk] : TF_BATCH);
  let cols = [];
  host.innerHTML = `${cotd ? tfCard(cotd) : ""}<div class="tf-cols"></div><div class="tf-more" aria-hidden="true"></div><p class="tf-end" hidden>${ov ? esc(ov.end || "") : "That is today's set. A new one arrives tomorrow."}</p>`;
  const wrap = host.querySelector(".tf-cols"), more = host.querySelector(".tf-more"), end = host.querySelector(".tf-end");
  let n = 0, count = 0, loading = false;
  // what is on screen jumps the queue: its picture is made eager and high priority, and a picture still missing after 4 s on screen is asked for again
  if (typeof IntersectionObserver === "function") {
    const vis = new Set();
    const io2 = new IntersectionObserver(es => es.forEach(x => {
      const card = x.target, im = card.querySelector(".tf-im img");
      if (x.isIntersecting) { vis.add(card); if (im && !im.classList.contains("on")) { im.loading = "eager"; im.fetchPriority = "high"; } } else vis.delete(card);
    }), { rootMargin: "120px 0px" });
    wrap._io2 = io2; live.push(() => { io2.disconnect(); clearInterval(wd); });
    const wd = setInterval(() => {
      if (!host.isConnected) return clearInterval(wd);
      vis.forEach(card => {
        const im = card.querySelector(".tf-im img"); if (!im || im.classList.contains("on") || !im.dataset.src) return;
        if (performance.now() - (im._t0 || 0) < 4000) return;
        im._t0 = performance.now(); im._try = (im._try || 0) + 1; if (im._try > 4) return;
        im.loading = "eager"; im.fetchPriority = "high"; im.src = tfBust(im.dataset.src, im._try);
      });
    }, 1500);
  }
  // every painting tile shows its own tiny blurred picture at once (js/feed.js fdMicroPaint), before its details or the museum photo arrive
  if (typeof fdMicroUse === "function") {
    fdMicroUse();
    const mc = () => wrap.querySelectorAll(".tf-paint .tf-im:not([data-mc])").forEach(im => fdMicroPaint(im, +im.closest(".tf-card").dataset.gi));
    FDM_SUBS.add(mc); live.push(() => { FDM_SUBS.delete(mc); fdMicroFree(); });
  }
  const add = upTo => {
    const tpl = document.createElement("template");
    // column heights are kept as numbers (read once per batch, then estimated from each card's known shape), not re-read from the page after every card:
    // that read forced a full layout per card, which on a phone is what made a batch of cards a visible stall
    const cw = cols[0] ? cols[0].offsetWidth : 0, hs = cols.map(c => c.offsetHeight), capH = host.classList.contains("nocaps") ? 0 : 50;
    const est = it => it.t === "sp" ? cw / it.ar + capH : it.t === "paint" ? cw / glAR(it.gi) + capH : it.t === "pal" ? cw / it.r : it.t === "color" ? cw * it.r : null;
    for (; n < Math.min(upTo, list.length); n++) {
      tpl.innerHTML = tfCard(list[n]);
      const node = tpl.content.firstElementChild; if (!node) continue;
      let bi = 0; for (let q = 1; q < cols.length; q++) if (hs[q] < hs[bi]) bi = q;
      const s = cols[bi];
      if (n < 10) { node.dataset.first = "1"; node.querySelectorAll("img").forEach(im => { im.loading = "eager"; im.fetchPriority = "high"; }); }
      node.dataset.ix = n;
      s.appendChild(node); if (wrap._io2) wrap._io2.observe(node);
      { const e = cw ? est(list[n]) : null; hs[bi] += e != null ? e : node.offsetHeight; }
      if (list[n].t === "paint" && typeof fdMicroPaint === "function") fdMicroPaint(node.querySelector(".tf-im"), list[n].gi);
      if (ov && ov.seen && list[n].gi != null) hfMarkSeen(list[n].gi);
    }
    if (ov && ov.seen) save();
    tfFill(wrap);
    st.shown[fk] = Math.max(st.shown[fk] || 0, n);
    end.hidden = n < list.length || !!(ov && ov.more);
  };
  // the list ran out: For you asks for the next batch; a finished list says so
  const grow = () => {
    if (loading || !ov || !ov.more) return;
    loading = true;
    ov.more().then(items => { loading = false; if (!host.isConnected) return; const have = new Set(list.map(x => x.key)); items.forEach(x => { if (!have.has(x.key)) list.push(x); }); if (n < list.length) add(n + TF_BATCH); }).catch(() => { loading = false; end.hidden = false; });
  };
  const layout = (upTo, reuse) => {
    // reuse: the cards on the page are moved into the new columns as they are (their pictures stay loaded), then the list goes on from there
    const keep = reuse ? [...wrap.querySelectorAll(".tf-card[data-ix]")].sort((a, b) => a.dataset.ix - b.dataset.ix) : [];
    count = tfColCount(host.clientWidth || innerWidth); wrap.innerHTML = ""; cols = [];
    for (let c = 0; c < count; c++) { const d = document.createElement("div"); d.className = "tf-col"; wrap.appendChild(d); cols.push(d); }
    n = 0;
    for (const node of keep) { let s = cols[0]; for (const c of cols) if (c.offsetHeight < s.offsetHeight) s = c; s.appendChild(node); n++; }
    add(upTo);
  };
  layout(shown);
  // pinch (two fingers, a trackpad pinch, ctrl+wheel, + / -) changes how many across, the same module as the painting page (js/gridzoom.js)
  if (typeof gzAttach === "function") {
    const setCols = (c, fx, fy, toY) => {
      c = Math.max(1, Math.min(tfMaxCols(), c)); if (c === count) return false;
      const vy = fy == null ? innerHeight / 2 : fy, el = document.elementFromPoint(fx == null ? innerWidth / 2 : fx, vy), card = el && el.closest(".tf-card[data-ix]"), ix = card ? card.dataset.ix : null;
      const y0 = card ? card.getBoundingClientRect().top : 0;
      const sv = hfS(); sv.zc = sv.zc || {}; sv.zc[tfWide() ? "w" : "p"] = c; save();
      // like Photos: the picture under your fingers stays put, every card keeps its picture and shape, and the ones that were off screen fade in
      const seen = new Set([...wrap.querySelectorAll(".tf-card[data-ix]")].filter(k => { const r = k.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; }).map(k => k.dataset.ix));
      layout(n, true);
      wrap.querySelectorAll(".tf-card[data-ix]").forEach(k => { const r = k.getBoundingClientRect(); if (r.bottom > 0 && r.top < innerHeight && !seen.has(k.dataset.ix)) { k.classList.add("tf-fadein"); setTimeout(() => k.classList.remove("tf-fadein"), 600); } });
      const k2 = ix != null ? wrap.querySelector(`.tf-card[data-ix="${ix}"]`) : null;
      if (k2) tfScrollTo(scr, tfY(scr) + k2.getBoundingClientRect().top - (toY == null ? y0 : y0 + (toY - vy)));
      return true;
    };
    const zoom = gzAttach(wrap, { cols: () => count, min: () => 1, max: tfMaxCols, ghost: true, colW: () => (wrap.firstChild ? wrap.firstChild.offsetWidth : 0), setCols });
    live.push(() => zoom.destroy());
  }
  // coming Back: the cards that were on screen are drawn again (heights are known up front), then the scroll goes where it was
  if (restore && st.y && st.y[fk]) { const y = st.y[fk]; tfScrollTo(scr, y); requestAnimationFrame(() => tfScrollTo(scr, y)); }
  if (typeof IntersectionObserver === "function") {
    const io = new IntersectionObserver(es => { if (es.some(x => x.isIntersecting)) { if (n < list.length) add(n + TF_BATCH); else grow(); io.unobserve(more); io.observe(more); } }, { root: /(auto|scroll)/.test(getComputedStyle(scr).overflowY) ? scr : null, rootMargin: "0px 0px 1600px 0px" });
    io.observe(more); live.push(() => io.disconnect());
  } else add(list.length);
  let rt = 0;
  const onResize = () => { clearTimeout(rt); rt = setTimeout(() => { if (host.isConnected && tfColCount(host.clientWidth || innerWidth) !== count) layout(n); }, 120); };
  addEventListener("resize", onResize); live.push(() => removeEventListener("resize", onResize));
  const onOnline = () => tfFill(wrap); addEventListener("online", onOnline); live.push(() => removeEventListener("online", onOnline));
  host.onclick = e => {
    if (e.target.closest("[data-tf-retry]")) return;
    const hb = e.target.closest("[data-tf-heart]");
    if (hb) { e.stopPropagation(); e.preventDefault(); const c0 = hb.closest(".tf-card"), i0 = +c0.dataset.gi, d0 = glDetailNow(i0); if (d0 && typeof fvArtSet === "function") { const on = !fvArtHas(d0.id); fvArtSet(i0, d0, on); hb.classList.toggle("on", on); hb.setAttribute("aria-pressed", on); hb.innerHTML = on ? TF_HEART_ON : TF_HEART; buzz(on ? 10 : 4); } return; }
    const c = e.target.closest(".tf-card[data-tf]"); if (!c) return;
    const kind = c.dataset.tf;
    const open = () => {
      buzz(6);
      (st.y = st.y || {})[fk] = tfY(scr);
      if (kind === "paint") { GL_FROM_TODAY = true; return galleryPage(+c.dataset.gi, true); }
      if (kind === "pal") return plvOpen("painting", +c.dataset.gi);
      if (kind === "game") return daily();
      if (kind === "cont") return go("learn");
      if (kind === "name") return tfOpenName(c.dataset.n, c.dataset.h);
    };
    // a double-tap likes a painting or a color (a tap opens it after a beat; the second tap in that beat keeps it instead)
    if (kind === "paint" || kind === "pal") return hfTap("tf" + c.dataset.gi, open, (x, y) => hfLikeTile(c, +c.dataset.gi, x, y), e.clientX, e.clientY);
    if (kind === "name" && c.classList.contains("tf-color")) return hfTap("tfc" + c.dataset.h, open, (x, y) => hfLikeColor(c, c.dataset.h, c.dataset.n, x, y), e.clientX, e.clientY);
    open();
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
