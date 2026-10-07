"use strict";
// Explore tab: the color wiki, as an editorial feed.
//  - Lens chips recompose the feed: For you, Colors (opens on the color explorer, colorsets.js), Paintings, Ideas.
//    Saved (the heart) holds what you keep. Search finds any node by name.
//  - Tap any pin for its closeup: the pin big, then "More like this" (its connections, each saying why).
//  - Pages: every color, idea, pigment, person, book and painting has an article full of [[links]].

let XSTACK = [];       // back stack inside Explore (closeups and pages)

// ======================================================================
// Explore is a Pinterest-style feed. The key (lens chips) recomposes it: For you, Spectrum, Harmony,
// Origins, Paintings, History, Symbols, Saved. Tap any pin for its closeup and "More like this":
// its connections as pins, each labeled with why, then connections of connections.
// ======================================================================
// Four lenses: a mixed feed, every color, the paintings, and the ideas (stories, systems, history). Saved lives behind the heart.
const LENSES = [["all", "For you"], ["spectrum", "Colors"], ["paintings", "Paintings"], ["ideas", "Ideas"]];
const ORIGIN_GROUPS = [["Flowers & plants", ["flower", "plant"]], ["Fruit, food & drink", ["fruit", "food", "drink"]], ["Gems, stones & metals", ["gem", "mineral", "metal"]], ["Animals", ["animal"]], ["Places & people", ["place", "person"]], ["Materials & dyes", ["material", "dye"]], ["Sky & nature", ["nature"]], ["Plain color words", ["abstract"]]];
const ERAS = [["Prehistory", -1e9, -3000], ["The ancient world", -3000, 500], ["The Middle Ages", 500, 1400], ["The Renaissance", 1400, 1600], ["The 1600s", 1600, 1700], ["The 1700s", 1700, 1800], ["The 1800s", 1800, 1900], ["The 1900s and after", 1900, 1e9]];
const hash = s => { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const seeded = (arr, seed) => arr.map(x => [hash(seed + (x.id || x.title)), x]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
const ICON_HEART = sv('<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>', 20, 1.8);
const isSaved = id => (S.saved || []).includes(id);
function toggleSave(id) {
  S.saved = S.saved || [];
  const i = S.saved.indexOf(id);
  if (i >= 0) S.saved.splice(i, 1); else S.saved.unshift(id);
  save(); buzz(8);
  toast(i >= 0 ? "Removed from Saved" : "Saved");
  return i < 0;
}

// ---------- pins: every node kind has one, with an estimated height for the masonry ----------
function pin(n, extra = {}) {
  const badge = extra.rel ? `<span class="pin-badge">${esc(extra.rel)}</span>` : "";
  const why = extra.why ? `<p class="pin-why">${esc(extra.why)}</p>` : "";
  const id = esc(n.id);
  if (n.kind === "color") {
    const h = extra.h || 150 + (hash(n.id) % 4) * 26, st = n.c.id && S.cards[n.c.id];
    const cap = extra.cap != null ? extra.cap : n.wiki && n.wiki.since ? fmtYear(n.wiki.since) : n.wiki && NAMED_LABEL[n.wiki.named] ? NAMED_LABEL[n.wiki.named] : "";
    return { h: h + (why ? 44 : 0), html: `<button class="pin pin-color" data-pin="${id}"><span class="pc" style="--c:${n.h};height:${h}px" data-ink="${ink(n.h)}">${badge}${st && st.own ? '<i class="own-dot" title="Yours"></i>' : ""}<b>${esc(n.title)}</b>${cap ? `<small>${esc(cap)}</small>` : ""}</span>${why}</button>` };
  }
  if (n.kind === "painting") {
    const ar = n.w && n.h ? n.h / n.w : .78, src = n.thumb || n.img;
    return { h: 167 * ar + 64 + (why ? 44 : 0), html: `<button class="pin pin-art" data-pin="${id}">${badge}${src ? `<img src="${esc(src)}" alt="" loading="lazy" style="aspect-ratio:${(1 / ar).toFixed(3)}">` : `<span class="noimg"></span>`}
      ${(n.palette || []).length ? `<span class="mini-pal">${n.palette.map(c => `<i style="--c:${c.h};flex:${c.share}"></i>`).join("")}</span>` : ""}<b>${esc(n.title)}</b><small>${esc(n.artist || "")}${n.year ? " · " + esc(n.year) : ""}</small>${why}</button>` };
  }
  if (n.kind === "story") {
    return { h: 236 + (why ? 44 : 0), html: `<button class="pin pin-story" data-pin="${id}" style="--g:linear-gradient(150deg,${n.cover.join(",")})">${badge}<span class="ps"><span class="eyebrow">Story · ${n.slides.length} slides</span><b>${esc(n.title)}</b><small>${esc(n.dek)}</small></span>${why}</button>` };
  }
  // pages: ideas, pigments, people, books, traditions
  const sw = (n.swatches || []).slice(0, 6), col = nodeColor(n);
  const system = extra.system && sw.length >= 3;
  if (system) {
    return { h: 64 + sw.length * 34, html: `<button class="pin pin-sys" data-pin="${id}">${badge}<span class="eyebrow">${esc(TYPE_LABEL[n.type] || "System")}</span><b>${esc(n.title)}</b>${sw.map(x => `<span class="sys-row"><i style="--c:${x.h}"></i>${esc(x.label || "")}</span>`).join("")}</button>` };
  }
  const dek = n.stub ? "" : plainText(n.dek || (n.body && n.body[0]) || "");
  return { h: 70 + 92 + (dek ? 40 : 0) + (why ? 44 : 0), html: `<button class="pin pin-page" data-pin="${id}">${badge}<span class="pp-head">${sw.length ? sw.map(x => `<i style="--c:${x.h}"></i>`).join("") : `<i style="--c:${col || "#3a3a3a"}"></i>`}</span>
    <span class="pp-body"><span class="eyebrow">${esc(TYPE_LABEL[n.type] || "Page")}${n.year != null ? ` · ${esc(fmtYear({ year: n.year }))}` : ""}</span><b>${esc(n.title)}</b>${dek ? `<small>${esc(dek.length > 110 ? dek.slice(0, 108) + "…" : dek)}</small>` : ""}</span>${why}</button>` };
}
function pairPin(a, b, label) {
  return { h: 190, html: `<button class="pin pin-pair" data-pin="${esc(a.id)}"><span class="pair2"><span style="--c:${a.h}" data-ink="${ink(a.h)}"><b>${esc(a.title)}</b></span><span style="--c:${b.h}" data-ink="${ink(b.h)}"><b>${esc(b.title)}</b></span></span><small>${esc(label)}</small></button>` };
}
// two columns, each pin placed in the shorter one
function masonry(pins) {
  const cols = [[], []], hgt = [0, 0];
  pins.forEach(p => { const k = hgt[0] <= hgt[1] ? 0 : 1; cols[k].push(p.html); hgt[k] += p.h + 10; });
  return `<div class="masonry"><div>${cols[0].join("")}</div><div>${cols[1].join("")}</div></div>`;
}

// ---------- what each lens shows ----------
function lensSections(lens) {
  const g = graph(), nodes = [...g.nodes.values()];
  const colors = nodes.filter(n => n.kind === "color"), paintings = nodes.filter(n => n.kind === "painting" && !n.stub);
  const pages = nodes.filter(n => n.kind === "page" && !n.stub), stories = g.stories;
  const hueKey = n => { const [L, C, H] = lch(n.h); return C < 12 ? 1000 + (100 - L) : (H + 330) % 360 + (100 - L) / 400; };
  switch (lens) {
    case "spectrum":
      return [{ honey: true }, ...lensSections("origins").map(sec => ({ ...sec, title: sec.title === "Still being traced" ? sec.title : "Named after · " + sec.title }))];
    case "ideas": {
      const sys = pages.filter(p => (p.swatches || []).length >= 3), ideas = pages.filter(p => !sys.includes(p) && ["concept", "person", "work", "tradition", "culture"].includes(p.type));
      return [{ title: "Stories", sub: "Short reads, a few swipes each.", pins: stories.map(n => pin(n)) },
        { title: "Color systems", sub: "Traditions that gave each color a meaning.", pins: sys.map(n => pin(n, { system: true })) },
        { title: "Ideas and people", pins: seeded(ideas, today()).map(n => pin(n)) },
        ...lensSections("history").map(sec => ({ ...sec, title: "Through history · " + sec.title }))];
    }
    case "harmony": {
      const vivid = colors.filter(n => lch(n.h)[1] > 28).sort((a, b) => hueKey(a) - hueKey(b));
      const pairs = vivid.map(n => { const [o] = nearestColors(opposite(n.h), 1, n.title); return o ? pairPin(n, colorNode(o[0]), "Opposites") : null; }).filter(Boolean);
      return [{ title: "Opposites", sub: "Across the wheel from each other. Side by side, each looks stronger.", pins: pairs }];
    }
    case "origins":
      return ORIGIN_GROUPS.map(([title, keys]) => ({ title, pins: colors.filter(n => n.wiki && keys.includes(n.wiki.named)).map(n => pin(n)) })).filter(s => s.pins.length)
        .concat([{ title: "Still being traced", sub: "Their stories are being written.", pins: colors.filter(n => !n.wiki || !n.wiki.named || n.wiki.named === "unknown").map(n => pin(n, { cap: "" })) }].filter(s => s.pins.length));
    case "paintings":
      // the hand-built pages first, in a row; then the full gallery (js/gallery.js), loaded when this lens opens
      return [{ title: "Featured · with stories", sub: "Hand-built pages with the story of the paint.", rail: true, pins: paintings.slice().sort((a, b) => (parseInt(String(a.year).replace(/\D+/g, "")) || 0) - (parseInt(String(b.year).replace(/\D+/g, "")) || 0)).map(n => pin(n)) },
        { gallery: true }];
    case "history": {
      const dated = [...colors.filter(n => n.wiki && n.wiki.since).map(n => ({ n, y: n.wiki.since.year })), ...pages.filter(p => p.year != null).map(n => ({ n, y: n.year }))].sort((a, b) => a.y - b.y);
      const secs = ERAS.map(([title, a, b]) => ({ title, pins: dated.filter(d => d.y >= a && d.y < b).map(d => pin(d.n, d.n.kind === "color" ? { cap: `${fmtYear(d.n.wiki.since)} · ${d.n.wiki.since.what}` } : {})) })).filter(s => s.pins.length);
      return secs.length ? secs : [{ title: "History", sub: "Dates are being researched. The timeline fills in as they're verified.", pins: [] }];
    }
    case "symbols": {
      const sys = pages.filter(p => (p.swatches || []).length >= 3);
      return [{ title: "Color systems", sub: "Traditions that gave each color a meaning.", pins: sys.map(n => pin(n, { system: true })) }];
    }
    case "saved": {
      const list = (S.saved || []).map(id => g.nodes.get(id)).filter(Boolean);
      return [{ title: "Saved", sub: list.length ? `${list.length} kept` : "Tap ♡ on anything to keep it here.", pins: list.map(n => pin(n)) }];
    }
    default: {
      // For you: colors shuffled by day, with a painting, a story or a page every few pins
      const day = today(), cs = seeded(colors, day), others = seeded([...paintings, ...stories, ...pages.filter(p => p.dek)], day);
      const out = [];
      cs.forEach((c, i) => { out.push(pin(c)); if (i % 3 === 2 && others.length) out.push(pin(others.shift())); });
      others.forEach(o => out.push(pin(o)));
      return [{ pins: out }];
    }
  }
}

function LAB_TILES(keys = ["harmony", "contrast", "eye", "studio"]) {
  const ring = ringStops(), tri = [30, 150, 270].map(a => { const r = 30, x = 40 + r * Math.cos(a * Math.PI / 180), y = 40 - r * Math.sin(a * Math.PI / 180); return [x.toFixed(1), y.toFixed(1)]; });
  const triCols = [30, 150, 270].map(a => lchHex(62, 52, (90 - (90 - a) + 0) % 360));
  const tiles = {
  harmony: `<button class="lab lab-x" data-lab="harmony"><span class="lv lv-wheel"><span class="lv-ring" style="background:${ring}"></span>
      <svg viewBox="0 0 80 80"><polygon points="${tri.map(p => p.join(",")).join(" ")}" fill="none" stroke="#F3F3F1" stroke-width="1.4" stroke-linejoin="round"/>${tri.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="6" fill="${triCols[i]}" stroke="#F3F3F1" stroke-width="1.6"/>`).join("")}</svg></span>
    <b>Harmony</b><small>Build palettes on the wheel</small></button>`,
  contrast: `<button class="lab lab-x" data-lab="contrast"><span class="lv lv-albers"><i style="--g:#BFA2E8"></i><i style="--g:#CC7722"></i></span>
    <b>Albers</b><small>One color, two looks</small></button>`,
  eye: `<button class="lab lab-x" data-lab="eye"><span class="lv lv-namer"><span class="lv-loupe"></span><span class="lv-tag">Coral</span></span>
    <b>Color eye</b><small>Point the camera, get the name</small></button>`,
  studio: `<button class="lab lab-x" data-lab="studio"><span class="lv lv-studio">${["#EFE6D2", "#C8553D", "#E0A458", "#5B7F6E", "#2A2620"].map(h => `<i style="--c:${h}"></i>`).join("")}</span>
    <b>Studio</b><small>Make, keep and share palettes</small></button>` };
  return keys.map(k => tiles[k]).join("");
}
function exploreHome() {
  XSTACK = [];
  const lens = LENSES.some(l => l[0] === S.lens) || S.lens === "saved" ? S.lens : "all";
  const media = (S.profile && S.profile.media) || [];
  const first = media.includes("paint") && !media.includes("screen") ? ["paintings"] : [];
  const lensOrder = [LENSES[0], ...LENSES.slice(1).filter(l => first.includes(l[0])).sort((a, b) => first.indexOf(a[0]) - first.indexOf(b[0])), ...LENSES.slice(1).filter(l => !first.includes(l[0]))];
  const SECS = lensSections(lens).filter(x => !x.title || x.honey || (x.pins && x.pins.length) || x.sub);
  const el = show(`
    <header class="x-head">
      ${tabHead(`<span class="x-acts"><button class="icon-btn${lens === "saved" ? " on" : ""}" data-saved aria-label="Saved">${ICON_HEART}${(S.saved || []).length ? `<em>${S.saved.length}</em>` : ""}</button><button class="icon-btn" data-search aria-label="Search">${ICON.search}</button></span>`)}
      <div class="x-row"><h1 class="tab-title">${lens === "saved" ? "Saved" : "Explore"}</h1></div>
      <div class="lens-key" role="tablist">${lensOrder.map(([k, t]) => `<button role="tab" class="${k === lens ? "on" : ""}" data-lens="${k}">${t}${k === "saved" && (S.saved || []).length ? ` <em>${S.saved.length}</em>` : ""}</button>`).join("")}</div>
    </header>
    <div class="x-search" hidden><label class="search"><span>${ICON.search}</span><input id="q" type="search" placeholder="Search colors, paintings, people, pigments" autocomplete="off"></label><div id="results"></div></div>
    <div class="x-feed" id="feed">
      ${(() => {
        // a contents row (like Wikipedia's) when a lens has several sections; "Through history · The 1800s" groups under "Through history"
        const seen = new Set(), toc = [];
        SECS.forEach((x, i) => { if (!x.title) return; const g = x.title.split(" · ")[0]; if (!seen.has(g)) { seen.add(g); toc.push([i, g]); } });
        return toc.length > 2 ? `<nav class="toc x-toc" aria-label="Contents"><span class="eyebrow">Contents</span>${toc.map(([i, g]) => `<a data-jump="${i}">${esc(g)}</a>`).join("")}</nav>` : "";
      })()}
      ${SECS.map((sec, i) => sec.gallery ? `<div class="gl-wrap" id="gallery"></div>` : `${sec.title ? `<div class="sec-head x-sec" id="xs-${i}"><b>${esc(sec.title)}</b>${sec.pins && sec.pins.length ? `<span>${sec.pins.length}</span>` : ""}</div>` : ""}${sec.sub ? `<p class="x-sub">${esc(sec.sub)}</p>` : ""}${sec.honey ? `<div class="honey-panel" id="honey"></div>` : sec.rail ? `<div class="gl-rail">${sec.pins.map(p => p.html).join("")}</div>` : masonry(sec.pins)}`).join("")}
      <p class="fine">Hex values are screen approximations. Every page lists its sources.</p>
    </div>
  `, "explore", "explore");
  el.querySelectorAll("[data-lens]").forEach(b => b.onclick = () => { S.lens = b.dataset.lens; save(); exploreHome(); });
  el.querySelectorAll("[data-jump]").forEach(a => a.onclick = () => { const t = el.querySelector("#xs-" + a.dataset.jump); if (t) t.scrollIntoView({ block: "start", behavior: reduceMotion ? "auto" : "smooth" }); });
  el.querySelector("[data-saved]").onclick = () => { S.lens = lens === "saved" ? "all" : "saved"; save(); exploreHome(); };
  const hp = el.querySelector("#honey"); if (hp) colorBrowser(hp, { focus: dailyColor(), pick: c => closeup(colorNode(c)) });
  const gw = el.querySelector("#gallery"); if (gw) galleryMount(gw);
  const on = el.querySelector(".lens-key .on"); if (on) on.scrollIntoView({ inline: "center", block: "nearest" });
  el.addEventListener("click", e => {
    const p = e.target.closest("[data-pin]"); if (p) return closeup(graph().nodes.get(p.dataset.pin));
    if (e.target.closest("[data-daily]")) return daily();
    const l = e.target.closest("[data-lab]"); if (l) return LAB[l.dataset.lab]();
    const t = e.target.closest("[data-taste]"); if (t) return tasteIntro(t.dataset.taste);
  });
  // search
  const box = el.querySelector(".x-search"), q = el.querySelector("#q"), results = el.querySelector("#results"), feed = el.querySelector("#feed");
  el.querySelector("[data-search]").onclick = () => { box.hidden = !box.hidden; feed.hidden = !box.hidden; if (!box.hidden) q.focus(); };
  q.addEventListener("input", () => {
    const s = q.value.trim().toLowerCase();
    const hits = s ? [...graph().nodes.values()].filter(n => (n.title || "").toLowerCase().includes(s)).slice(0, 40) : [];
    results.innerHTML = s ? (hits.length ? masonry(hits.map(n => pin(n))) : `<p class="fine">Nothing called that yet.</p>`) : "";
  });
  results.addEventListener("click", e => { const p = e.target.closest("[data-pin]"); if (p) closeup(graph().nodes.get(p.dataset.pin)); });
}

// ======================================================================
// Closeup: the pin big, then "More like this" (its connections, each saying why), then connections of connections
// ======================================================================
const CONN_LENSES = [["all", "All"], ["spectrum", "Looks"], ["harmony", "Harmony"], ["origins", "Origins"], ["paintings", "Paintings"], ["history", "History"], ["ideas", "Ideas"], ["stories", "Stories"]];
function closeup(n, opts = {}) {
  if (!n) return exploreHome();
  if (!opts.back) { if (XSTACK[XSTACK.length - 1] !== "z:" + n.id) XSTACK.push("z:" + n.id); }
  const conns = connections(n);
  const lensesHere = CONN_LENSES.filter(([k]) => k === "all" || conns.some(c => c.lens === k));
  const pick = opts.lens && lensesHere.some(l => l[0] === opts.lens) ? opts.lens : "all";
  const shown = pick === "all" ? conns : conns.filter(c => c.lens === pick);
  const saved = isSaved(n.id);
  const sum = n.kind === "color" ? (n.wiki && n.wiki.facets[0] ? n.wiki.facets[0].text : n.c.d || n.c.o || "")
    : n.kind === "painting" ? n.note || "" : n.kind === "story" ? n.dek : n.stub ? "" : n.dek || (n.body && n.body[0]) || "";
  const st = n.kind === "color" && n.c.id && S.cards[n.c.id];
  const hero = n.kind === "color"
    ? `<div class="z-hero z-color" style="--c:${n.h}" data-ink="${ink(n.h)}"><span class="eyebrow">${n.c.basic ? "Basic color word" : st ? (st.own ? "Yours" : "Learning") : n.c.unit ? esc(unitLabel(n.c.unit)) : ""}</span><h1>${esc(n.title)}</h1><span class="mono">${n.h}</span></div>`
    : n.kind === "painting" ? `<div class="z-hero z-art">${n.img ? `<img src="${esc(n.img)}" alt="${esc(n.title)}">` : ""}${(n.palette || []).length ? `<span class="z-pal">${n.palette.map(c => `<i style="--c:${c.h};flex:${c.share}"></i>`).join("")}</span>` : ""}</div><h1 class="z-title">${esc(n.title)}</h1><p class="z-meta">${esc(n.artist || "")}${n.year ? " · " + esc(n.year) : ""}</p>`
    : n.kind === "story" ? `<div class="z-hero z-story" style="--g:linear-gradient(150deg,${n.cover.join(",")})"><span class="eyebrow">Story · ${n.slides.length} slides</span><h1>${esc(n.title)}</h1></div>`
    : `<div class="z-hero z-page">${(n.swatches || []).length ? n.swatches.slice(0, 7).map(x => `<i style="--c:${x.h}"><span data-ink="${ink(x.h)}">${esc(x.label || "")}</span></i>`).join("") : `<i style="--c:${nodeColor(n) || "#2c2c2c"}"></i>`}</div><p class="eyebrow z-type">${esc(TYPE_LABEL[n.type] || "Page")}</p><h1 class="z-title">${esc(n.title)}</h1>`;
  const el = show(`
    <header class="art-top"><button class="icon-btn glass" data-back aria-label="Back">${ICON.back}</button>
      <div class="z-actions"><button class="icon-btn glass${saved ? " saved" : ""}" data-save aria-label="Save">${saved ? "♥" : "♡"}</button></div></header>
    ${hero}
    ${sum ? `<p class="z-sum">${linkText(sum)}</p>` : ""}
    <div class="row2 z-btns">${n.kind === "story" ? `<button class="btn" data-play>${ICON.play} Play story</button>` : `<button class="btn" data-read>Read the page ${ICON.arrow}</button>`}</div>
    ${conns.length ? `<div class="sec-head"><b>More like this</b><span>${conns.length} connections</span></div>
    <div class="lens-key in-page">${lensesHere.map(([k, t]) => `<button class="${k === pick ? "on" : ""}" data-zl="${k}">${t}</button>`).join("")}</div>
    ${masonry(shown.map(c => pin(c.to, { rel: c.rel, why: c.why, h: c.to.kind === "color" ? 120 + (hash(c.to.id) % 3) * 20 : undefined })))}` : ""}
    <div id="more"></div>
  `, "article closeup");
  el.querySelector("[data-back]").onclick = () => {
    XSTACK.pop();
    const prev = XSTACK[XSTACK.length - 1];
    if (!prev) return go("explore");
    if (prev.startsWith("g:")) return galleryPage(+prev.slice(2), false);
    const node = graph().nodes.get(prev.replace(/^[zp]:/, ""));
    return prev.startsWith("z:") ? closeup(node, { back: true }) : openNode(node, false);
  };
  el.querySelector("[data-save]").onclick = e => { const on = toggleSave(n.id); e.currentTarget.textContent = on ? "♥" : "♡"; e.currentTarget.classList.toggle("saved", on); };
  const rd = el.querySelector("[data-read]"); if (rd) rd.onclick = () => openNode(n);
  const pl = el.querySelector("[data-play]"); if (pl) pl.onclick = () => storyPlayer(n);
  el.querySelectorAll("[data-zl]").forEach(b => b.onclick = () => closeup(n, { back: true, lens: b.dataset.zl }));
  el.addEventListener("click", e => {
    const p = e.target.closest("[data-pin]"); if (p) { e.preventDefault(); return closeup(graph().nodes.get(p.dataset.pin)); }
    const a = e.target.closest("[data-to]"); if (a) { e.preventDefault(); return closeup(graph().nodes.get(a.dataset.to)); }
  });
  // connections of connections, loaded when you scroll near the end
  const more = el.querySelector("#more");
  const io = new IntersectionObserver(es => {
    if (!es[0].isIntersecting) return;
    io.disconnect();
    const seen = new Set([n.id, ...conns.map(c => c.to.id)]), second = [];
    conns.slice(0, 8).forEach(c => connections(c.to).forEach(x => { if (!seen.has(x.to.id)) { seen.add(x.to.id); second.push(x.to); } }));
    if (second.length) more.innerHTML = `<div class="sec-head"><b>Keep exploring</b><span>two steps away</span></div>${masonry(seeded(second, n.id).slice(0, 40).map(x => pin(x)))}`;
  }, { rootMargin: "400px" });
  io.observe(more);
  cleanup.push(() => io.disconnect());
  onKey = e => { if (e.key === "Escape") el.querySelector("[data-back]").click(); };
}
// older entry points
const orbit = id => closeup(graph().nodes.get(id));
// ======================================================================
// Opening any node
// ======================================================================
function openNode(n, push = true) {
  if (!n) return;
  if (n.kind === "story") return storyPlayer(n);
  if (push) XSTACK.push("p:" + n.id);
  if (n.kind === "color") return colorPage(n);
  if (n.kind === "painting") return paintingPage(n);
  return wikiPage(n);
}
function xBack() {
  XSTACK.pop();
  const prev = XSTACK[XSTACK.length - 1];
  if (!prev) return go("explore");
  if (prev.startsWith("g:")) return galleryPage(+prev.slice(2), false);   // a gallery painting (js/gallery.js)
  const node = graph().nodes.get(prev.replace(/^[zp]:/, ""));
  return prev.startsWith("z:") ? closeup(node, { back: true }) : openNode(node, false);
}
// links inside any article
function wireLinks(el) {
  el.addEventListener("click", e => {
    const a = e.target.closest("[data-to],[data-node]");
    if (!a) return;
    e.preventDefault();
    openNode(graph().nodes.get(a.dataset.to || a.dataset.node));
  });
}

// ======================================================================
// Article pages
// ======================================================================
function connSection(n) {
  const conns = connections(n);
  if (!conns.length) return "";
  return `<section class="conns"><h3>Connections</h3>${CONN_LENSES.filter(([g]) => g !== "all").map(([g, name]) => {
    const list = conns.filter(c => c.lens === g);
    if (!list.length) return "";
    return `<div class="cg"><p class="eyebrow">${name}</p><div class="chips-wrap">${list.slice(0, 14).map(c => {
      const col = nodeColor(c.to);
      return `<button class="pchip" data-node="${esc(c.to.id)}">${col ? `<i style="--c:${col}"></i>` : ""}${esc(c.to.title)}<em>${esc(c.rel)}</em></button>`;
    }).join("")}</div></div>`;
  }).join("")}</section>`;
}
const sourcesHTML = list => list && list.length ? `<section class="srcs"><h3>Sources</h3><ul>${list.map(s => `<li>${/^https?:\/\//.test(s) ? `<a href="${esc(s)}" target="_blank" rel="noopener">${esc(s.replace(/^https?:\/\/(www\.)?/, "").slice(0, 60))}</a>` : esc(s)}</li>`).join("")}</ul></section>` : "";
const artTop = n => `<header class="art-top"><button class="icon-btn glass" data-back aria-label="Back">${ICON.back}</button><button class="glass-pill" data-web>${ICON.explore}<span>More like this</span></button></header>`;
function wireArticle(el, n) {
  el.querySelector("[data-back]").onclick = xBack;
  el.querySelector("[data-web]").onclick = () => closeup(n);
  wireLinks(el);
  onKey = e => { if (e.key === "Escape") xBack(); };
}
// approximate print and screen codes
function codes(hex) {
  const [r, g, b] = rgb(hex), k = 1 - Math.max(r, g, b) / 255;
  const cmy = [r, g, b].map(v => k >= 1 ? 0 : Math.round((1 - v / 255 - k) / (1 - k) * 100));
  const mx = Math.max(r, g, b) / 255, mn = Math.min(r, g, b) / 255, l = (mx + mn) / 2, d = mx - mn;
  let h = 0; if (d) { h = mx === r / 255 ? ((g - b) / 255 / d) % 6 : mx === g / 255 ? (b - r) / 255 / d + 2 : (r - g) / 255 / d + 4; h = Math.round(h * 60 + 360) % 360; }
  const s = d ? d / (1 - Math.abs(2 * l - 1)) : 0;
  return [["HEX", hex], ["RGB", `${r} ${g} ${b}`], ["HSL", `${h}° ${Math.round(s * 100)}% ${Math.round(l * 100)}%`], ["CMYK", `${cmy.join(" ")} ${Math.round(k * 100)}`]];
}

// Wikipedia-style pieces: sections that fold open and shut, a contents row, and photographs with credits.
const secHTML = (id, title, inner, open) => `<details class="sec" id="s-${id}"${open ? " open" : ""}><summary><span>${esc(title)}</span><i aria-hidden="true"></i></summary><div class="sec-body">${inner}</div></details>`;
const tocHTML = list => list.length > 2 ? `<nav class="toc" aria-label="Contents"><span class="eyebrow">Contents</span>${list.map(([id, t]) => `<a data-sec="${id}">${esc(t)}</a>`).join("")}</nav>` : "";
function figHTML(key, i = 0) {
  const imgs = (window.WIKI_IMAGES || {})[key]; if (!imgs || !imgs[i]) return "";
  const f = imgs[i];
  return `<figure class="fig"><img src="${esc(f.src)}" alt="${esc(f.alt || "")}" loading="lazy"${f.w ? ` width="${f.w}" height="${f.h}"` : ""}><figcaption>${esc(f.caption || "")}<span>${f.commons ? `<a href="${esc(f.commons)}" target="_blank" rel="noopener">${esc(f.credit || "Wikimedia Commons")}</a>` : esc(f.credit || "")}${f.licenseUrl ? ` · <a href="${esc(f.licenseUrl)}" target="_blank" rel="noopener">License</a>` : ""}</span></figcaption></figure>`;
}
function wireSections(el) {
  el.querySelectorAll("[data-sec]").forEach(a => a.onclick = () => { const d = el.querySelector("#s-" + a.dataset.sec); if (d) { d.open = true; d.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" }); } });
}
// codes shown depend on what the person works with (asked at the start): screens, paint or print
function codeRows(hex) {
  const all = codes(hex), media = (S.profile && S.profile.media) || [], [L, C] = lch(hex);
  if (!media.length) return all;
  const rows = [];
  if (media.includes("screen")) rows.push(...all.slice(0, 3));
  if (media.includes("print")) rows.push(all[3]);
  if (media.includes("paint")) rows.push(["VALUE ≈", (L / 10).toFixed(1)], ["CHROMA ≈", (C / 5).toFixed(1)]);
  return rows.length ? rows : all;
}

function colorPage(n) {
  const c = n.c, w = n.wiki, nb = neighbor(c), st = c.id && S.cards[c.id];
  const status = c.basic ? "One of the eleven basic color words" : st ? (st.own ? "Yours: you recalled it after a day" : "Learning: it's in your reviews") : `Not learned yet · ${c.unit ? unitLabel(c.unit) : ""}`;
  const el = show(`
    ${artTop(n)}
    <div class="c-hero" style="--c:${c.h}" data-ink="${ink(c.h)}"><p class="eyebrow">${esc(status)}</p><h1>${esc(c.n)}</h1></div>
    <div class="codes">${codeRows(c.h).map(([k, v]) => `<button data-copy="${esc(v)}"><span>${k}</span><b class="mono">${esc(v)}</b></button>`).join("")}</div>
    ${nb && c.d ? `<section class="cmp-sec"><div class="compare"><div style="--c:${c.h}" data-ink="${ink(c.h)}">${esc(c.n)}</div><div style="--c:${nb.h}" data-ink="${ink(nb.h)}" data-node="c:${esc(nb.n)}">${esc(nb.n)}</div></div><p class="diff">${esc(c.d)}</p></section>` : ""}
    ${c.o && !(w && w.facets.some(f => f.k === "language")) ? `<p class="lead">${esc(c.o)}</p>` : ""}
    ${figHTML(c.n)}
    ${(() => {
      const secs = (w ? w.facets : []).map((f, i) => [f.k + i, FACET_LABEL[f.k] || f.k, `<p>${linkText(f.text)}</p>` + (i === 0 ? figHTML(c.n, 1) : "")]);
      if (w && w.related && w.related.length) secs.push(["kin", "Kin", w.related.map(r => { const x = graph().resolve(r.to); return x ? `<button class="kin" data-node="${esc(x.id)}"><i style="--c:${x.h}"></i><b>${esc(x.title)}</b><span>${esc(r.why)}</span></button>` : ""; }).join("")]);
      return (w ? "" : `<p class="fine">The full page for ${esc(c.n)} is being written. Its connections below are already live.</p>`) + tocHTML(secs.map(x => [x[0], x[1]])) + secs.map((x, i) => secHTML(x[0], x[1], x[2], i < 2)).join("");
    })()}
    <section class="gl-in" data-glin></section>
    ${connSection(n)}
    ${w && w.sources ? secHTML("src", "Sources", sourcesHTML(w.sources), false) : ""}
  `, "article");
  wireArticle(el, n); wireSections(el);
  const gi = el.querySelector("[data-glin]"); if (gi) galleryColorRow(gi, c);
  el.querySelectorAll("[data-copy]").forEach(b => b.onclick = () => { try { navigator.clipboard.writeText(b.dataset.copy); toast("Copied " + b.dataset.copy); } catch (e) {} });
}

function wikiPage(n) {
  const sw = n.swatches || [];
  const el = show(`
    ${artTop(n)}
    ${sw.length ? `<div class="p-hero">${sw.map(s => `<div style="--c:${s.h}" data-ink="${ink(s.h)}" title="${esc(s.label || "")}"><span>${esc(sw.length > 3 ? (s.label || "").split(/ · |: |, /)[0] : s.label || "")}</span></div>`).join("")}</div>` : ""}
    <p class="eyebrow p-type">${esc(TYPE_LABEL[n.type] || "Page")}</p>
    <h1 class="p-title">${esc(n.title)}</h1>
    ${n.dek ? `<p class="p-dek">${linkText(n.dek)}</p>` : ""}
    ${figHTML(n.id)}
    ${n.facts && n.facts.length ? `<dl class="facts">${n.facts.map(f => `<div><dt>${esc(f.label)}</dt><dd>${linkText(f.value)}</dd></div>`).join("")}</dl>` : ""}
    ${(() => {
      if (n.stub) return `<p class="fine">This page is being written. Its connections are already live.</p>`;
      const body = n.body || [];
      // pages written with sections use them; older pages get a lead paragraph and a folding "full story"
      const secs = n.sections && n.sections.length ? n.sections.map((x, i) => ["p" + i, x.title, (Array.isArray(x.text) ? x.text : [x.text]).map(t => `<p>${linkText(t)}</p>`).join("") + (x.img != null ? figHTML(n.id, x.img) : "")])
        : body.length > 1 ? [["story", "The full story", body.slice(1).map(t => `<p>${linkText(t)}</p>`).join("") + figHTML(n.id, 1)]] : [];
      if (n.colors && n.colors.length) secs.push(["colors", "Colors", `<div class="chips-wrap">${n.colors.map(cn => { const x = graph().resolve(cn); return x ? `<button class="pchip" data-node="${esc(x.id)}"><i style="--c:${x.h}"></i>${esc(x.title)}</button>` : ""; }).join("")}</div>`]);
      return (body[0] && !(n.sections && n.sections.length) ? `<p class="lead">${linkText(body[0])}</p>` : "") + tocHTML(secs.map(x => [x[0], x[1]])) + secs.map((x, i) => secHTML(x[0], x[1], x[2], i === 0)).join("");
    })()}
    ${connSection(n)}
    ${n.sources ? secHTML("src", "Sources", sourcesHTML(n.sources), false) : ""}
  `, "article");
  wireArticle(el, n); wireSections(el);
}

function paintingPage(n) {
  const pal = n.palette || [];
  const el = show(`
    ${artTop(n)}
    ${n.img ? `<div class="ptg"><img id="pimg" src="${esc(n.img)}" alt="${esc(n.title)} by ${esc(n.artist)}"><canvas id="pmask"></canvas></div>` : ""}
    <p class="eyebrow p-type">Painting · ${esc(n.year || "")}</p>
    <h1 class="p-title">${esc(n.title)}</h1>
    <p class="p-dek">${esc(n.artist || "")}${n.place ? ` · ${esc(n.place)}` : ""}</p>
    ${pal.length ? `<div class="palette">${pal.map((p, i) => `<button class="pal" data-pi="${i}" style="--c:${p.h};flex:${Math.max(p.share, .08)}" data-ink="${ink(p.h)}"><span>${Math.round(p.share * 100)}%</span></button>`).join("")}</div>
      <div class="pal-names">${pal.map((p, i) => `<button class="pal-name" data-pi="${i}"><i style="--c:${p.h}"></i><b>${esc(p.name)}</b>${p.vocab ? `<span>your word: <a class="wl" data-to="c:${esc(p.vocab)}">${esc(p.vocab)}</a></span>` : ""}<em class="mono">${p.h}</em></button>`).join("")}</div>
      <p class="fine">Tap a swatch to see where it lives in the painting.</p>` : `<p class="fine">This painting's palette is being extracted.</p>`}
    ${n.note ? `<p class="p-body">${linkText(n.note)}</p>` : ""}
    ${connSection(n)}
    ${n.commons ? `<section class="srcs"><h3>Image</h3><ul><li><a href="${esc(n.commons)}" target="_blank" rel="noopener">Wikimedia Commons</a> · ${esc(n.license || "Public domain")}</li></ul></section>` : ""}
  `, "article");
  wireArticle(el, n);
  // highlight where a palette color sits, using the index map
  const img = el.querySelector("#pimg"), cv = el.querySelector("#pmask");
  let mapData = null;
  if (img && n.map) {
    const m = new Image();
    m.onload = () => { const c = document.createElement("canvas"); c.width = m.width; c.height = m.height; const x = c.getContext("2d"); x.drawImage(m, 0, 0); mapData = x.getImageData(0, 0, m.width, m.height); };
    m.src = n.map;
  }
  let on = -1;
  el.querySelectorAll("[data-pi]").forEach(b => b.addEventListener("click", e => {
    if (e.target.closest("[data-to]")) return;
    const i = +b.dataset.pi;
    on = on === i ? -1 : i;
    el.querySelectorAll("[data-pi]").forEach(x => x.classList.toggle("on", +x.dataset.pi === on));
    if (!mapData || !cv) return;
    cv.width = mapData.width; cv.height = mapData.height;
    const ctx = cv.getContext("2d"), out = ctx.createImageData(mapData.width, mapData.height);
    for (let p = 0; p < mapData.data.length; p += 4) {
      const idx = Math.round(mapData.data[p] / 40), dim = on >= 0 && idx !== on;
      out.data[p] = out.data[p + 1] = out.data[p + 2] = 10; out.data[p + 3] = dim ? 200 : 0;
    }
    ctx.putImageData(out, 0, 0);
    cv.classList.toggle("on", on >= 0);
  }));
}

// ======================================================================
// Color of the day: guess its name from four close ones, then read about it
// ======================================================================
function daily() {
  const c = dailyColor(), k = today(), ans = S.daily[k];
  const decoys = nearestColors(c.h, 3, c.n).map(x => x[0]);
  const opts = ans ? null : shuffle([c, ...decoys]);
  const n = colorNode(c), w = n.wiki;
  const dateStr = new Date(Date.now() - 4 * 3600e3).toLocaleDateString(undefined, { month: "long", day: "numeric" });
  const el = show(`
    <header class="deck-top"><button class="icon-btn" data-close aria-label="Close">${ICON.x}</button><span class="eyebrow" style="flex:1;text-align:center">Color of the day · ${esc(dateStr)}</span><span style="width:44px"></span></header>
    <div class="d-swatch" style="--c:${c.h}" data-ink="${ink(c.h)}"><span class="mono">${c.h}</span>${ans ? `<h1>${esc(c.n)}</h1>` : ""}</div>
    <div class="d-body" id="dbody"></div>
  `, "fixed daily");
  const body = el.querySelector("#dbody");
  el.querySelector("[data-close]").onclick = () => go(S.tab || "learn");
  const reveal = ok => {
    const sw = el.querySelector(".d-swatch");
    if (!sw.querySelector("h1")) sw.insertAdjacentHTML("beforeend", `<h1>${esc(c.n)}</h1>`);
    body.innerHTML = `
      <p class="d-verdict ${ok ? "y" : "n"}">${ok ? "You named it." : `It's ${esc(c.n)}.`}</p>
      <p class="d-text">${w && w.facets[0] ? linkText(w.facets[0].text) : esc(c.o || c.d || "")}</p>
      <div class="stack">
        <button class="btn" data-share>${ICON.share} Share today's color</button>
        <div class="row2"><button class="btn ghost" data-page>Its page</button><button class="btn ghost" data-web>More like this</button></div>
      </div>`;
    wireLinks(body);
    body.querySelector("[data-share]").onclick = () => shareCard(c, ok, dateStr);
    body.querySelector("[data-page]").onclick = () => { XSTACK = []; openNode(n); };
    body.querySelector("[data-web]").onclick = () => closeup(n);
  };
  if (ans) return reveal(ans.ok);
  body.innerHTML = `<p class="d-q">What's this color called?</p><div class="d-opts">${opts.map((o, i) => `<button data-i="${i}">${esc(o.n)}</button>`).join("")}</div>`;
  body.querySelectorAll("[data-i]").forEach(b => b.onclick = () => {
    const ok = opts[+b.dataset.i] === c;
    S.daily[k] = { n: c.n, ok }; save();
    buzz(ok ? 12 : [10, 40, 10]);
    b.classList.add(ok ? "right" : "wrong");
    body.querySelector(`[data-i="${opts.indexOf(c)}"]`).classList.add("right");
    later(() => reveal(ok), 650);
  });
}

// A 1080x1350 card: the color, its name and the date. Shared as an image where the browser allows it.
function shareCard(c, ok, dateStr) {
  const W = 1080, H = 1350, cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const x = cv.getContext("2d");
  x.fillStyle = "#121212"; x.fillRect(0, 0, W, H);
  x.fillStyle = c.h; x.beginPath(); x.roundRect(60, 60, W - 120, 900, 48); x.fill();
  x.fillStyle = "#F5F4F0"; x.beginPath(); x.roundRect(60, 920, W - 120, 370, [0, 0, 48, 48]); x.fill();
  x.fillRect(60, 920, W - 120, 60);
  x.fillStyle = "#66665F"; x.font = "600 30px Geist, system-ui, sans-serif"; x.fillText(`COLOR OF THE DAY · ${dateStr.toUpperCase()}`, 110, 1000);
  x.fillStyle = "#141414"; x.font = "400 130px 'Instrument Serif', Georgia, serif"; x.fillText(c.n, 104, 1150);
  x.fillStyle = "#66665F"; x.font = "500 32px 'Geist Mono', monospace"; x.fillText(`${c.h}   ·   ${ok ? "named it" : "learned it"} on ColorHub`, 110, 1230);
  const text = `Today's color: ${c.n} ${ok ? "(I named it)" : ""} · ColorHub`;
  const url = shareURL("color/" + routeSlug(c.n));   // the color's own page, with a preview card
  cv.toBlob(async blob => {
    const file = new File([blob], `colorhub-${c.n.toLowerCase().replace(/\s+/g, "-")}.png`, { type: "image/png" });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) return await navigator.share({ files: [file], text, url });
      if (navigator.share) return await navigator.share({ text, url });
    } catch (e) { if (e && e.name === "AbortError") return; }
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = file.name; a.click();
    toast("Saved the card");
  }, "image/png");
}
