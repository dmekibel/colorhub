"use strict";
// Subjects: the painting map's "By vibe" islands as a beautiful list (David, 2026-10-25). Museum > Art > Subjects.
//   #/museum/art/subjects              the list: one big card per island (cover mosaic, name, count, palette), grouped like the map
//   #/museum/art/subject/<slug>        one island: its paintings as the standard grid, closest to its middle first, plus the Map button
// Names, covers and palettes are computed offline (tools/island_names.py -> data/gallery/island-names.json); membership is the map's own
// data/gallery/look-islands.bin. Stale files are flagged by tools/check_ids.js and refused here (the door hides).
const SBI = { ready: null, d: null, mem: new Map(), binP: null };
const sbiNum = n => Number(n).toLocaleString("en-US");
function sbiLoad() {
  if (SBI.ready) return SBI.ready;
  return SBI.ready = Promise.all([loadGallery(), fetch("data/gallery/island-names.json").then(r => { if (!r.ok) throw new Error("names " + r.status); return r.json(); })]).then(([, d]) => {
    if (!d || d.v !== 1 || d.n !== GAL.n || !Array.isArray(d.islands) || !d.islands.length) throw new Error("island names do not match the gallery");
    d.islands.forEach(o => { o.cov = o.cov.filter(c => c[0] >= 0 && c[0] < GAL.n); });
    d.bySlug = new Map(d.islands.map(o => [o.slug, o]));
    return SBI.d = d;
  }).catch(e => { SBI.ready = null; throw e; });
}
const sbiOf = slug => SBI.d && SBI.d.bySlug.get(slug) || null;
// the photo at the width a tile needs (feed.js picks the smallest sufficient copy for each museum)
const sbiSrc = (url, w) => typeof fdSrc === "function" ? fdSrc({ img: url }, w) : glSized(url, "mid");
const sbiImg = (c, w, cls) => `<img src="${esc(sbiSrc(c[2], w))}" alt="" loading="lazy" decoding="async" draggable="false"${cls ? ` class="${cls}"` : ""}>`;
function sbiFade(root) {   // a photo fades in over its color when it lands; one that fails stays a quiet color
  root.querySelectorAll("img:not([data-ld])").forEach(im => {
    im.dataset.ld = "1";
    const ok = () => im.classList.add("ld");
    if (im.complete && im.naturalWidth) ok(); else { im.addEventListener("load", ok, { once: true }); im.addEventListener("error", () => im.remove(), { once: true }); }
  });
}
const sbiPalBar = (pal, cls = "") => `<span class="sbi-pal ${cls}" aria-hidden="true">${pal.map(h => `<i style="--c:${h}"></i>`).join("")}</span>`;
const sbiWait = (fn, args) => {   // the data is not here yet: a calm placeholder on this address, then the screen
  const tok = (waitScreen(), SHOW_N);
  sbiLoad().then(() => { if (SHOW_N !== tok) return; ROUTE_REPLACE = true; fn(...args); })
    .catch(() => { if (SHOW_N === tok && typeof routeFailed === "function") routeFailed(() => sbiWait(fn, args)); else toast("This page didn't load"); });
  return true;
};

// ---------- the list ----------
// families (islands that share a parent on the map) sit together, biggest family first, the parent island leading it
function sbiFamilies(d) {
  const by = new Map();
  d.islands.forEach(o => { if (!by.has(o.par)) by.set(o.par, []); by.get(o.par).push(o); });
  return [...by.entries()].map(([par, list]) => ({ par, list: list.sort((a, b) => (b.k === par) - (a.k === par) || b.n - a.n), n: list.reduce((s, o) => s + o.n, 0) })).sort((a, b) => b.n - a.n);
}
function sbiCardHTML(o) {
  const [a, b, c] = o.cov, pal = o.pal;
  const cell = (x, k, w) => `<span class="sbi-ph" style="--c:${pal[k % pal.length] || "#2a2822"}">${x ? sbiImg(x, w) : ""}</span>`;
  return `<article class="sbi-card" data-sbi-card="${esc(o.slug)}">
    <button class="sbi-open" data-sbi="${esc(o.slug)}" aria-label="${esc(o.name)}, ${sbiNum(o.n)} paintings">
      <span class="sbi-mos m${o.cov.length}">${cell(a, 3, 360)}${b ? cell(b, 1, 180) : ""}${c ? cell(c, 5, 180) : ""}</span>
      <span class="sbi-txt"><b>${esc(o.name)}</b><span class="sbi-n">${sbiNum(o.n)} paintings</span>${o.sub ? `<span class="sbi-sub">${esc(o.sub)}</span>` : ""}</span>
    </button>
    <span class="sbi-colors">${o.pal.map(h => `<button data-swatch="${h}" style="--c:${h}" aria-label="${esc(nameOf(h).text)}"></button>`).join("")}</span>
  </article>`;
}
function sbiSkeleton() { return `<div class="sbi-list" aria-hidden="true">${Array.from({ length: 4 }, () => `<div class="sbi-card sbi-sk"><span class="sbi-mos m3"><span class="sbi-ph"></span><span class="sbi-ph"></span><span class="sbi-ph"></span></span><span class="sbi-txt"><b>&nbsp;</b></span></div>`).join("")}</div>`; }
// these pages carry their own Map button (centered on what you are looking at): the trail's generic map glyph would be a second "Map" beside it
const sbiOwnMap = el => { const rm = () => el.querySelectorAll("[data-tl-exit]").forEach(b => b.remove()); rm(); setTimeout(rm, 60); setTimeout(rm, 400); };
function sbiList() {
  if (!SBI.d) return sbiWait(sbiList, []);
  const d = SBI.d, fams = sbiFamilies(d), total = d.islands.reduce((s, o) => s + o.n, 0);
  const body = fams.map(f => (f.list.length > 1 ? `<div class="sec-head sbi-fam"><b>${esc(d.fam[f.par] || f.list[0].name)}</b><span>${f.list.length} kinds · ${sbiNum(f.n)}</span></div>` : "") + `<div class="sbi-list">${f.list.map(sbiCardHTML).join("")}</div>`).join("");
  const el = show(`
    <header class="art-top"><button class="icon-btn glass" data-back aria-label="Back">${ICON.back}</button>
      <button class="glass-pill" data-pmap="arr=look&lk=isl">${ICON.explore}<span>Map</span></button></header>
    <p class="eyebrow p-type">Art</p><h1 class="p-title">Subjects</h1>
    <p class="p-dek">${d.islands.length} kinds of painting, found by how ${sbiNum(total)} paintings look. They are the islands of the painting map, and each opens its own endless list.</p>
    ${body}`, "article sbi-page");
  el.querySelector("[data-back]").onclick = () => (typeof xBack === "function" && XSTACK.length ? xBack() : xToOrigin());
  onKey = e => { if (e.key === "Escape" && !document.querySelector(".sheet")) el.querySelector("[data-back]").click(); };
  sbiFade(el); sbiOwnMap(el);
  el.addEventListener("click", e => {
    if (e.target.closest("[data-swatch]")) return;   // js/swatch.js opens the color page
    const b = e.target.closest("[data-sbi]"); if (b) { buzz(6); sbiPage(b.dataset.sbi); }
  });
  if (typeof featureRegister === "function") featureRegister("art-subjects", { t: "Subjects", where: "Museum · Art · Subjects", words: ["subject", "subjects", "island", "kinds", "vibe"], run: () => sbiList() });
}

// ---------- members of one island, closest to its middle first ----------
function sbiBin() {
  if (SBI.binP) return SBI.binP;
  const d = SBI.d, hs = parseInt(d.hash, 16);
  return SBI.binP = fetch("data/gallery/look-islands.bin").then(r => { if (!r.ok) throw new Error("islands " + r.status); return r.arrayBuffer(); }).then(b => {
    const dv = new DataView(b), n = d.n;
    if (b.byteLength !== 20 + n * 3 || dv.getUint32(0, true) !== 0x4C53494C || dv.getUint32(8, true) !== n || dv.getUint32(12, true) !== d.islands.length || dv.getUint32(16, true) !== hs) throw new Error("look-islands.bin does not match");
    return { id: new Uint8Array(b, 20, n), lx: new Uint8Array(b, 20 + n, n), ly: new Uint8Array(b, 20 + 2 * n, n) };
  }).catch(e => { SBI.binP = null; throw e; });
}
function sbiMembers(o) {
  if (SBI.mem.has(o.k)) return Promise.resolve(SBI.mem.get(o.k));
  return sbiBin().then(B => {
    const m = [], dist = new Float32Array(B.id.length);
    for (let i = 0; i < B.id.length; i++) if (B.id[i] === o.k) { m.push(i); dist[i] = Math.hypot(B.lx[i] - o.c[0], B.ly[i] - o.c[1]); }
    m.sort((a, b) => dist[a] - dist[b] || a - b);
    SBI.mem.set(o.k, m); return m;
  });
}

// ---------- one island ----------
function sbiPage(slug) {
  if (!SBI.d) return sbiWait(sbiPage, [slug]);
  const o = sbiOf(slug);
  if (!o) return routeMissing("subject", slug);
  const fam = SBI.d.islands.filter(x => x.par === o.par && x.k !== o.k).sort((a, b) => b.n - a.n);
  const hero = o.cov[0], seed = hero ? hero[0] : o.cov.length ? o.cov[0][0] : -1;
  const el = show(`
    <header class="art-top"><button class="icon-btn glass" data-back aria-label="Back">${ICON.back}</button>
      <button class="glass-pill" data-pmap="arr=look&lk=isl${seed >= 0 ? "&on=" + seed : ""}" aria-label="Map: see this subject on the painting map">${ICON.explore}<span>Map</span></button></header>
    <div class="sbi-hero" style="--c:${o.pal[3] || "#2a2822"}">${hero ? sbiImg(hero, 480) : ""}</div>
    <p class="eyebrow p-type">Subject</p><h1 class="p-title">${esc(o.name)}</h1>
    <p class="p-dek">${sbiNum(o.n)} paintings${o.sub ? " · " + esc(o.sub) : ""}</p>
    ${sbiPalBar(o.pal, "big")}
    <div class="rh-walkrow"><button class="btn solid" data-sbiwalk disabled>Walk this room ${ICON.arrow}</button></div>
    <div class="sbi-chips" role="tablist" aria-label="View"><button class="sbi-chip on" role="tab" aria-selected="true" data-sbitab="paintings">Paintings</button><button class="sbi-chip" role="tab" aria-selected="false" data-sbitab="overview">Overview</button></div>
    <div class="sbi-pane" data-sbipane="paintings"><div class="sbi-grid gl-grid" data-sbigrid>${sbiTileSkeleton()}</div><p class="fine">Closest to the middle of this island on the painting map first. Colors are as photographed.</p></div>
    <div class="sbi-pane" data-sbipane="overview" hidden>${sbiOverview(o, fam)}</div>`, "article sbi-page sbi-one");
  el.querySelector("[data-back]").onclick = () => (typeof xBack === "function" && XSTACK.length ? xBack() : xToOrigin());
  onKey = e => { if (e.key === "Escape" && !document.querySelector(".sheet")) el.querySelector("[data-back]").click(); };
  sbiFade(el); sbiOwnMap(el);
  const grid = el.querySelector("[data-sbigrid]");
  sbiMembers(o).then(list => {
    if (!grid.isConnected) return;
    glGrid(grid, { list, cols: matchMedia("(min-width:700px)").matches ? 4 : 3, plain: true, exact: true, pinch: true });
    const w = el.querySelector("[data-sbiwalk]"); if (w && typeof rhWalk === "function" && typeof xbLoad === "function") xbLoad().then(() => { w.disabled = false; w.onclick = () => rhWalk(list, o.name); }).catch(() => w.remove()); else if (w) w.remove();
    grid.classList.add("live");
  }).catch(() => { if (grid.isConnected) grid.innerHTML = `<p class="fine">The paintings didn't load. <button class="wl" data-sbiretry>Try again</button></p>`; });
  el.addEventListener("click", e => {
    const g = e.target.closest("[data-gi]"); if (g) { buzz(4); return galleryPage(+g.dataset.gi, true); }
    if (e.target.closest("[data-sbiretry]")) return sbiPage(slug);
    const t = e.target.closest("[data-sbitab]");
    if (t) {
      el.querySelectorAll("[data-sbitab]").forEach(b => { const on = b === t; b.classList.toggle("on", on); b.setAttribute("aria-selected", on); });
      el.querySelectorAll("[data-sbipane]").forEach(p => { p.hidden = p.dataset.sbipane !== t.dataset.sbitab; });
      buzz(4); if (t.dataset.sbitab === "paintings") dispatchEvent(new Event("scroll"));
      return;
    }
    const sb = e.target.closest("[data-sbi]"); if (sb) { buzz(6); return sbiPage(sb.dataset.sbi); }
    const op = e.target.closest("[data-sbigi]"); if (op) { buzz(4); galleryPage(+op.dataset.sbigi, true); }
  });
}
const sbiTileSkeleton = () => `<div class="sbi-tsk" aria-hidden="true">${Array.from({ length: 12 }, () => "<i></i>").join("")}</div>`;
function sbiOverview(o, fam) {
  const first = o.sub ? o.sub.split(" · ") : [];
  return `<div class="sbi-ov">
    ${o.cov.length ? `<div class="sec-head"><b>Most typical</b><span>nearest the middle</span></div><div class="sbi-three">${o.cov.map(c => `<button class="sbi-t" data-sbigi="${c[0]}" style="--c:${o.pal[2] || "#2a2822"}" aria-label="${esc(c[4])}">${sbiImg(c, 220)}</button>`).join("")}</div>` : ""}
    <div class="sec-head"><b>Its colors</b><span>pooled from ${sbiNum(o.n)} paintings</span></div>
    <div class="sbi-sw">${o.pal.map(h => `<button data-swatch="${h}" style="--c:${h}"><span>${esc(nameOf(h).text)}</span></button>`).join("")}</div>
    ${first.length ? `<div class="sec-head"><b>Mostly</b></div><ul class="sbi-facts">${first.map(f => `<li>${esc(f)}</li>`).join("")}</ul>` : ""}
    ${fam.length ? `<div class="sec-head"><b>Next to it on the map</b><span>${fam.length} neighbors</span></div><div class="sbi-near">${fam.map(x => `<button data-sbi="${esc(x.slug)}"><b>${esc(x.name)}</b><span>${sbiNum(x.n)} paintings</span></button>`).join("")}</div>` : ""}
  </div>`;
}

// ---------- the door on Art's first screen (js/browse-ui.js xbRooms) ----------
function sbiDoorHTML() {
  return `<button class="sbi-door" data-sbidoor hidden aria-label="Subjects: kinds of painting, from portraits to seas"><span class="sbi-door-t"><b>Subjects</b><span data-sbidoorn>Kinds of painting, by how they look</span></span><span class="sbi-door-i" data-sbidoori></span></button>`;
}
function sbiDoorFill(host) {
  const door = host.querySelector("[data-sbidoor]"); if (!door) return;
  sbiLoad().then(d => {
    if (!door.isConnected) return;
    const pick = [...d.islands].sort((a, b) => b.n - a.n).filter(o => o.cov[0]).slice(0, 12), step = Math.max(1, Math.floor(pick.length / 3));
    const three = [pick[0], pick[step], pick[step * 2]].filter(Boolean);
    door.querySelector("[data-sbidoorn]").textContent = `${d.islands.length} kinds of painting, by how they look`;
    door.querySelector("[data-sbidoori]").innerHTML = three.map(o => `<span style="--c:${o.pal[3]}">${sbiImg(o.cov[0], 120)}</span>`).join("");
    door.hidden = false; sbiFade(door);
  }).catch(() => {});
}
document.addEventListener("click", e => {
  const d = e.target.closest && e.target.closest("[data-sbidoor]"); if (!d) return;
  e.preventDefault(); buzz(6); sbiList();
});
