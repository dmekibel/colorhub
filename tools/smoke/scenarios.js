"use strict";
// The smoke scenarios. Each one is scenario(group, name, async t => { ... }); `t` comes from harness.js.
// Rules of the road: drive the screen the way a thumb does (real PointerEvents on canvases, .click() on buttons),
// assert what a person would see (a page opened, a sheet showed, the count changed), and let the harness fail the
// scenario on ANY window error / unhandled rejection / failed script load. Groups run as parallel Chrome processes.
const H = {
  // the page open in the iframe: its h1 (colorPage / namePage / ...)
  title: t => t.text(".cp-page .cp-hero-foot h1"),
  chip: t => t.text(".cp-page .cp-chip"),
  async openPage(t, hash, expectTitle) {
    await t.open(hash, { settle: 300 });
    await t.waitFor(() => t.$(".cp-page .cp-hero-foot h1") && t.$(".cp-page .cp-hero-foot h1").textContent.trim(), 12000, `a color page at ${hash}`);
    if (expectTitle) t.expect(H.title(t).toLowerCase() === expectTitle.toLowerCase(), `${hash} shows "${H.title(t)}", expected "${expectTitle}"`);
    t.expect(t.$(".cp-hero-full") && t.$(".cp-hero-full").getBoundingClientRect().height > 100, `${hash}: the hero has no size`);
    t.expect(t.$("#app").innerText.length > 200, `${hash}: the page is nearly empty`);
  },
  // Tap something on a color/name page that should open another page (a swatch, a near color, a palette chip).
  async tapSwatch(t) {
    const before = H.title(t) + "|" + H.chip(t);
    // the Walk's honeycomb is a color page's one neighbor list now (it absorbed Nearest names, 2026-10-08)
    const sels = ["[data-swatch]", ".lk-row[data-cp-near]", ".lk-row[data-np-near]", ".rp-hc-c[data-rc-open]", ".pchip[data-node]", ".kin[data-node]"];
    let target = null, used = "";
    for (const s of sels) { const e = t.$$(s, t.$("#app"))[0]; if (e) { target = e; used = s; break; } }
    t.expect(target, "no swatch / near-color / palette chip on the page to tap");
    // a section folded away in a closed <details> opens with a tap on its summary first, like a thumb would
    const fold = target.closest("details:not([open])");
    if (fold) { await t.click(fold.querySelector("summary"), { wait: 200 }); t.expect(fold.open, "the folded section did not open"); }
    await t.click(target, { wait: 400 });
    // the Walk's first tap walks to that color (it becomes the center); a second tap on the centered one opens its page
    if (used === ".rp-hc-c[data-rc-open]") await t.click(target, { wait: 400 });
    await t.waitFor(() => t.$(".cp-page .cp-hero-foot h1") && (H.title(t) + "|" + H.chip(t)) !== before, 8000, `${used} to open another page`);
    return used;
  },
  async back(t) {
    const cur = H.title(t);
    await t.click("[data-back]", { wait: 500 });
    await t.waitFor(() => !t.$(".cp-page") || H.title(t) !== cur, 6000, `Back to leave the "${cur}" page`);
  },
  // average color of a small square of the honeycomb canvas
  canvasSig(cv, x, y, r = 6) {
    const d = cv.getContext("2d").getImageData(Math.round(x - r), Math.round(y - r), r * 2, r * 2).data;
    let R = 0, G = 0, B = 0, n = d.length / 4;
    for (let i = 0; i < d.length; i += 4) { R += d[i]; G += d[i + 1]; B += d[i + 2]; }
    return [R / n, G / n, B / n];
  },
  dist: (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]),
  slug: (t, n) => t.w.eval("routeSlug")(n),   // router.js keeps routeSlug in the app's own global scope
  num: s => +(/[\d,]+/.exec(s || "") || ["0"])[0].replace(/,/g, ""),
  async homeReady(t, hash = "#shot=home") {
    await t.open(hash);
    const cv = await t.waitFor("canvas", 10000, "the honeycomb canvas");
    await t.waitFor(() => /\d/.test(t.text(".hm-title small")) && !/Loading/.test(t.text(".hm-title small")), 10000, "the honeycomb to fill");
    return cv;
  },
  // Home's right corner: one button, a labeled menu (js/home.js doMenu); which = a [data-do] row
  async menu(t, which) {
    await t.click("#hmDo", { wait: 120 });
    await t.waitFor(".hm-do-stem [data-do]", 6000, "the right corner's menu");
    if (which) await t.click(`.hm-do-stem [data-do="${which}"]`, { wait: 200 });
  },
  async sheet(t, which = "colors") {
    await H.menu(t, which);
    await t.waitFor(`.hm-chooser[data-which="${which}"]`, 10000, `the ${which} sheet`);
  },
  async keys(t, key) { t.w.dispatchEvent(new t.w.KeyboardEvent("keydown", { key, bubbles: true })); await t.sleep(300); },
};

// ================================================================== HOME
scenario("home", "center bubble opens a color page", async t => {
  const cv = await H.homeReady(t);
  const r = cv.getBoundingClientRect();
  t.expect(!t.$(".cp-page"), "a color page was already open");
  await t.tapAt(cv, r.left + r.width / 2, r.top + r.height / 2, { wait: 400 });
  await t.waitFor(".cp-page", 6000, "a color page after tapping the center bubble");
  t.expect(H.title(t), "the opened color page has no title");
  await H.back(t);
  await t.waitFor("canvas", 6000, "the honeycomb again after Back");
});

// js/learn.js's placement hint ("Tap any color to open it") marks itself pending with S.mapHint = 1 so a later
// Home open can show it again if the app closed before that first touch (its own comment says so, but nothing
// called lrMapHint() on a later open, and js/home.js's hmDismissHint was guarded by `typeof` with no function
// behind it, so a pending hint from an earlier session could never reappear or be dismissed on this Home).
scenario("home", "a pending placement hint reappears on a later Home open, and a bubble tap clears it", async t => {
  // a real address (not #shot=home, which builds its own demo state and ignores localStorage) so the seeded save loads
  try { localStorage.setItem("colorhub-v1", JSON.stringify({ v: 3, placed: { tier: 1, at: "2026-10-01" }, mapHint: 1 })); } catch (e) {}
  await t.open("#/home", { settle: 300, keepState: true });
  const cv = await t.waitFor("canvas", 10000, "the honeycomb canvas");
  await t.waitFor(() => /\d/.test(t.text(".hm-title small")) && !/Loading/.test(t.text(".hm-title small")), 10000, "the honeycomb to fill");
  await t.waitFor(".lr-maphint", 3000, "the pending hint on a fresh Home open");
  t.expect(/Tap any color/.test(t.text(".lr-maphint")), `the hint reads "${t.text(".lr-maphint")}"`);
  const r = cv.getBoundingClientRect();
  await t.tapAt(cv, r.left + r.width / 2, r.top + r.height / 2, { wait: 400 });
  await t.waitFor(".cp-page", 6000, "a color page after tapping the center bubble");
  t.expect(!t.ev("S.mapHint"), "S.mapHint is still set after the tap (hmDismissHint)");
  await H.back(t);
  await t.waitFor("canvas", 6000, "the honeycomb again after Back");
  t.expect(!t.$(".lr-maphint"), "the hint is still in the DOM after being dismissed");
});

scenario("home", "a far bubble glides to the middle, it does not open", async t => {
  const cv = await H.homeReady(t);
  const r = cv.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const before = H.canvasSig(cv, r.width / 2, r.height / 2, 8);
  let glided = false, tried = 0;
  // try spots well outside the open zone until one lands on a bubble (a miss does nothing)
  for (const rad of [235, 265, 290]) for (let a = 0; a < 360 && !glided; a += 15) {
    const x = cx + rad * Math.cos(a * Math.PI / 180), y = cy + rad * Math.sin(a * Math.PI / 180);
    if (x < 24 || x > r.width - 24 || y < 120 || y > r.height - 130) continue;
    tried++;
    await t.tapAt(cv, x, y, { wait: 900 });
    t.expect(!t.$(".cp-page"), `tapping a far bubble (${Math.round(x)},${Math.round(y)}) opened a page instead of gliding it to the middle`);
    if (H.dist(before, H.canvasSig(cv, r.width / 2, r.height / 2, 8)) > 10) glided = true;
  }
  t.expect(glided, `none of ${tried} taps on the outer honeycomb moved a bubble to the middle`);
  t.notes.push(`${tried} tap${tried === 1 ? "" : "s"} to find one`);
});

scenario("home", "chrome buttons stay tappable after a touch", async t => {
  const cv = await H.homeReady(t);
  const r = cv.getBoundingClientRect(), x = r.left + r.width / 2 + 120, y = r.top + r.height / 2 + 160;
  const o = { bubbles: true, clientX: x, clientY: y, pointerId: 1, pointerType: "touch", isPrimary: true, view: t.w };
  cv.dispatchEvent(new t.w.PointerEvent("pointerdown", o));
  t.expect(!t.$(".screen.hm").classList.contains("chrome-hide"), "a touch that hasn't moved already hid the chrome (a tap would blink it)");
  const o2 = { ...o, clientX: x - 40, clientY: y - 30 };
  cv.dispatchEvent(new t.w.PointerEvent("pointermove", o2));
  t.expect(t.$(".screen.hm").classList.contains("chrome-hide"), "chrome did not hide while dragging (test premise)");
  // every corner fades together (David: "everything disappears except the flashcards")
  const shown = t.$$(".screen.hm .corner").filter(c => getComputedStyle(c).pointerEvents !== "none");
  t.expect(!shown.length, `still tappable while dragging: ${shown.map(c => c.getAttribute("aria-label")).join(", ")}`);
  cv.dispatchEvent(new t.w.PointerEvent("pointerup", o2));
  await t.sleep(4000);   // the old bug: the buttons faded and went untappable after a timer
  for (const sel of ["#hmDo", "[data-rooms-corner]"].filter(s => t.$(s))) {
    const e = t.$(sel); t.expect(e, `${sel} is missing`);
    const why = t.reachable(e); t.expect(!why, `${sel} ${why} after the honeycomb was touched`);
  }
});

// David: "Sometimes when you click a setting and choose it, the bottom corner buttons disappear." Pick options in each
// corner sheet, close it every way (the ✕, a tap outside, Escape, Back), also after a drag that ends off the map, and
// both corners must be visible and tappable every time.
scenario("home", "corners always come back after a sheet or a drag", async t => {
  const corners = async why => {
    await t.sleep(500);
    for (const sel of ["#hmDo", "[data-rooms-corner]"]) {
      const e = t.$(sel); t.expect(e, `${sel} is missing ${why}`);
      if (!e) continue;
      const cs = getComputedStyle(e);
      t.expect(+cs.opacity > .9 && cs.visibility !== "hidden" && cs.pointerEvents !== "none", `${sel} is hidden ${why} (opacity ${cs.opacity}, pointer-events ${cs.pointerEvents})`);
      const r = t.reachable(e); t.expect(!r, `${sel} ${r} ${why}`);
    }
  };
  const cv = await H.homeReady(t);
  const closers = [["the close button", async () => t.click("[data-sheet-close]", { wait: 300 })],
    ["a tap outside", async () => { const s = t.$(".scrim"); s.dispatchEvent(new t.w.PointerEvent("pointerdown", { bubbles: true, cancelable: true, clientX: 30, clientY: 80, pointerId: 1, pointerType: "touch", isPrimary: true, view: t.w })); await t.sleep(400); }],
    ["Escape", async () => H.keys(t, "Escape")],
    ["Back", async () => { t.w.dispatchEvent(new t.w.PopStateEvent("popstate", { state: { ch: 1 } })); await t.sleep(500); }]];
  for (const which of ["colors", "arrange"]) {
    for (const [how, close] of closers) {
      await H.sheet(t, which);
      const opts = t.$$(which === "colors" ? '.hm-chooser [data-src^="stage:"]:not(.on), .hm-chooser .hm-fam:not(.on)' : ".hm-chooser .hm-look-chip:not(.on), .hm-chooser .hm-arr-b:not(.on)");
      if (opts[0]) await t.click(opts[0], { wait: 400 });
      if (opts[1]) await t.click(opts[1], { wait: 400 });
      if (t.$(".sheet")) await close();
      await t.waitFor(() => !t.$(".sheet"), 4000, `the ${which} sheet to close with ${how}`);
      await corners(`after picking in ${which} and closing with ${how}`);
    }
  }
  // a pan that ends off the canvas (the finger lifts over a corner or outside the window): the chrome still comes back
  const c2 = t.$("canvas"), r = c2.getBoundingClientRect(), o = { bubbles: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, pointerId: 1, pointerType: "touch", isPrimary: true, view: t.w };
  c2.dispatchEvent(new t.w.PointerEvent("pointerdown", o));
  c2.dispatchEvent(new t.w.PointerEvent("pointermove", { ...o, clientX: o.clientX - 60, clientY: o.clientY + 40 }));
  t.d.body.dispatchEvent(new t.w.PointerEvent("pointerup", { ...o, clientX: 10, clientY: 10 }));
  await corners("after a pan that ended off the map");
  // the menu, opened and closed with its own corner
  await H.menu(t); { const r2 = t.$("#hmDo").getBoundingClientRect(); await t.tapAt(t.d.elementFromPoint(r2.left + r2.width / 2, r2.top + r2.height / 2), r2.left + r2.width / 2, r2.top + r2.height / 2, { wait: 500 }); }
  await corners("after the corner menu opened and closed");
  t.expect(cv, "no canvas");
});

scenario("home", "View sheet opens; stage chips change the count", async t => {
  await H.homeReady(t);
  await H.sheet(t, "colors");
  const chips = t.$$('.hm-chooser [data-src^="stage:"]');
  t.expect(chips.length >= 3, `only ${chips.length} stage chips`);
  const count0 = H.num(t.text("[data-count]")), seen = [count0];
  t.expect(count0 > 0, `the View sheet says "${t.text("[data-count]")}"`);
  let changed = 0;
  for (const c of chips.filter(c => !c.classList.contains("on"))) {
    const prev = t.text("[data-count]");
    await t.click(c, { wait: 100 });
    await t.waitFor(() => t.text("[data-count]") !== prev && !!H.num(t.text("[data-count]")), 10000, `the count to change after the "${t.text(c)}" chip (was "${prev}")`);
    seen.push(H.num(t.text("[data-count]"))); changed++;
    t.expect(c.classList.contains("on"), `the "${t.text(c)}" chip did not turn on`);
    if (changed >= 3) break;
  }
  t.expect(new Set(seen).size >= 3, `item counts did not vary across stages: ${seen.join(", ")}`);
  t.notes.push("counts " + seen.join(" > "));
  // the title above the honeycomb follows the choice
  t.expect(H.num(t.text(".hm-title small")) === seen[seen.length - 1], `the title says "${t.text(".hm-title small")}" but the sheet says ${seen[seen.length - 1]}`);
});

scenario("home", "Arrange sheet: Looks and the feel sliders", async t => {
  await H.homeReady(t);
  await H.sheet(t, "arrange");
  t.expect(!t.$(".hm-tabs, [data-tab]"), "the Arrange sheet still has tabs");
  const styles = t.$$(".hm-look-chip");
  t.expect(styles.length === 2, `${styles.length} Look chips (Bubbles and Honeycomb; magnification is the Magnify slider)`);
  const n0 = H.num(t.text("[data-count]"));
  for (const s of styles.filter(s => !s.classList.contains("on")).slice(0, 3)) {
    await t.click(s, { wait: 300 });
    t.expect(s.classList.contains("on"), `style chip "${t.text(s)}" did not turn on`);
  }
  t.expect(!t.$(".hm-look-sliders, [data-lab-open]"), "the developer sliders or lab link are back in the View sheet");
  // the three friendly sliders: words at the ends, never raw numbers; Magnify changes the middle bubble; Reset restores
  const feel = t.$$(".hm-feel-row");
  t.expect(feel.length === 3, `${feel.length} feel sliders`);
  t.expect(!feel.some(r => /\d/.test(r.innerText)), "a feel slider shows a number");
  const mag = t.$('[data-feel="mag"] input'), cfg0 = t.ev("HM_CTRL.getCfg().resolved.m0");
  mag.value = "0.1"; mag.dispatchEvent(new t.w.Event("input", { bubbles: true })); await t.sleep(100);
  const cfg1 = t.ev("HM_CTRL.getCfg().resolved.m0");
  t.expect(cfg1 < cfg0 - .5, `Magnify down did not flatten the lens (${cfg0} -> ${cfg1})`);
  t.expect(Math.abs(t.ev("S.hm.feel.mag") - .1) < .01, "Magnify was not kept");
  await t.click("[data-feel-reset]", { wait: 150 });
  t.expect(Math.abs(t.ev("HM_CTRL.getCfg().resolved.m0") - cfg0) < .01 && Math.abs(+mag.value - t.ev("HM_FEEL0.mag")) < .01, "Reset did not bring the feel back");
  t.expect(H.num(t.text("[data-count]")) === n0, "looking at styles changed the item count");
  const cv = t.$("canvas"); t.expect(cv && cv.width > 0, "the honeycomb canvas disappeared");
});

scenario("home", "Arrange sheet: the strip morphs the map and keeps every color", async t => {
  await H.homeReady(t);
  await H.sheet(t, "arrange");
  const arrs = t.$$(".hm-chooser [data-arr]");
  t.expect(arrs.length >= 5, `only ${arrs.length} shapes`);
  // each shape has its own flat icon (js/home.js hmArrIcon) and a one-line label
  t.expect(arrs.every(b => b.querySelectorAll(".hm-arr-pic svg circle, .hm-arr-pic svg rect, .hm-arr-pic svg path").length >= 6), "an arrangement picture is empty");
  t.expect(arrs.every(b => b.querySelector("b").scrollWidth <= b.querySelector("b").clientWidth + 1), "an arrangement label is cut off");
  const n0 = H.num(t.text("[data-count]"));
  for (const b of arrs.filter(b => !b.classList.contains("on"))) {
    await t.click(b, { wait: 120 });
    t.expect(b.classList.contains("on") && t.ev("S.hm.arr") === b.dataset.arr, `arrangement "${b.dataset.arr}" did not turn on`);
    t.expect(t.ev("HM_CTRL.getCfg().resolved.layout") === t.ev(`hmLayoutKey("${b.dataset.arr}", S.hm.style)`), `the map did not take "${b.dataset.arr}"`);
    t.expect(H.num(t.text("[data-count]")) === n0, `arrangement "${b.dataset.arr}" changed the count`);
    t.expect(/\S/.test(t.text("[data-arr-sub]")), "no line says what the arrangement means");
  }
  // every color exactly once in each shape, in every order
  const dupes = t.ev("HONEY_ARR_IDS.flatMap(id => (honeyOrdersOf(id).length ? honeyOrdersOf(id) : ['']).map(o => [id, o])).filter(([id, o]) => { const its = hmStageItems(250); const l = honeyLayout(its, hmLayoutKey(id, 'original', o)); return new Set(l.pts.map(p => p.it.n)).size !== its.length || l.pts.length !== its.length; }).map(x => x.join(':'))");
  t.expect(!dupes.length, `shape and order pairs that drop or repeat colors: ${dupes.join(", ")}`);
  // leaving: the clear ✕, and a tap on the map above the sheet
  await t.click("[data-sheet-close]", { wait: 450 });
  t.expect(!t.$(".hm-chooser"), "✕ did not close the Arrange sheet");
  await H.sheet(t, "colors");
  const scrim = t.$(".scrim.hm-scrim-clear");
  t.expect(scrim, "the Colors sheet dims the map (no clear scrim)");   // the look itself is checked in the screenshots: headless virtual time leaves the fade mid-way
  scrim.dispatchEvent(new t.w.PointerEvent("pointerdown", { bubbles: true, cancelable: true }));
  await t.sleep(450);
  t.expect(!t.$(".hm-chooser"), "a tap on the map did not close the View sheet");
});

scenario("home", "Arrange sheet: Center on and Sort by change the order inside a shape, and are kept", async t => {
  await H.homeReady(t);
  await H.sheet(t, "arrange");
  const n0 = H.num(t.text("[data-count]"));
  await t.click('.hm-chooser [data-arr="rings"]', { wait: 150 });
  t.expect(/Center on/.test(t.text("[data-ord-row]")), "Rings has no Center on row");
  for (const id of ["vivid", "muted", "dark", "known", "near", "today"]) {
    await t.click(`[data-ord="${id}"]`, { wait: 120 });
    t.expect(t.ev("hmOrd('rings')") === id && t.$(`[data-ord="${id}"]`).classList.contains("on"), `Center on ${id} did not turn on`);
    t.expect(t.ev("HM_CTRL.getCfg().resolved.layout").startsWith("rings~" + id), `the map did not take Center on ${id}`);
    t.expect(/Middle: .+ Edge: /.test(t.text("[data-arr-sub]")), `no line says what the middle and edge mean (${id})`);
    t.expect(H.num(t.text("[data-count]")) === n0, `Center on ${id} changed the count`);
  }
  await t.click('[data-ord="vivid"]', { wait: 120 });
  // the most vivid sits in the middle: the middle bubble is stronger than the average
  const midC = t.ev("(() => { const l = honeyLayout(hmStageItems(100), 'rings~vivid'); const s = l.pts.slice().sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y)); return [s[0].it.C, s.reduce((t, p) => t + p.it.C, 0) / s.length]; })()");
  t.expect(midC[0] > midC[1] * 1.5, `Center on Vivid put a weak color in the middle (${midC.map(x => x.toFixed(0)).join(" vs ")})`);
  await t.click('.hm-chooser [data-arr="map"]', { wait: 150 });
  t.expect(/Sort by/.test(t.text("[data-ord-row]")), "the Map has no Sort by row");
  await t.click('[data-ord="light"]', { wait: 150 });
  t.expect(t.ev("HM_CTRL.getCfg().resolved.layout") === "map~light", "the Map did not take Sort by lightness");
  t.expect(t.$$(".hm-ax-l, .hm-ax-r").length === 2, "no edge captions for a sorted Map");
  await t.click('[data-ord="painted"]', { wait: 400 });
  await t.waitFor(() => t.ev("!!HONEY_PAINTED") && t.ev("HM_CTRL.getCfg().resolved.layout") === "map~painted", 6000, "the painting counts to load");
  await t.click('[data-ord="hue"]', { wait: 150 });
  t.expect(t.ev("S.hm.ord.rings") === "vivid" && t.ev("S.hm.ord.map") === "hue", "the orders were not kept per shape");
  await t.click('.hm-chooser [data-arr="temp"]', { wait: 150 });
  t.expect(t.$("[data-ord-row]").hidden, "Warm and cool shows an order row (its plane has no order)");
  // an old save upgrades: Color wheel = Rings centered on greys; the Magnifier = Bubbles with a strong Magnify
  t.ev("S.hm.arr = 'wheel'; S.hm.style = 'magnifier'; S.hm.feel.mag = .5; hmView()");
  t.expect(t.ev("S.hm.arr") === "rings" && t.ev("S.hm.ord.rings") === "muted" && t.ev("S.hm.style") === "original" && t.ev("S.hm.feel.mag") >= .9, "an old save did not upgrade");
  t.ev("S.hm.arr = 'map'; S.hm.ord = {}; S.hm.feel.mag = HM_FEEL0.mag");
});

scenario("home", "View sheet: families tell the truth and combine with tone and your words", async t => {
  await H.homeReady(t, "#shot=home:fam:Pinks");
  const names = t.ev("[...new Set(HM_CTRL.studyPoints().pts.map(p => p.n.toLowerCase()))]");
  for (const n of ["hot pink", "rose", "cerise", "baby pink", "dusty rose", "magenta"]) t.expect(names.includes(n), `Pinks is missing ${n}`);
  for (const n of ["crimson", "lavender", "pale periwinkle"]) t.expect(!names.includes(n), `Pinks includes ${n}`);
  await H.sheet(t, "colors");
  const fam = t.$('[data-famv="Pinks"]'); t.expect(fam.classList.contains("on"), "the Pinks chip is not on");
  const nP = H.num(t.text("[data-count]"));
  t.expect(H.num(t.text(fam.querySelector("[data-n]"))) === nP, "the Pinks chip's count disagrees with the map");
  const vivid = t.$('.hm-seg[data-key="tone"] [data-val="vivid"]'), nV = H.num(t.text(vivid.querySelector("[data-n]")));
  await t.click(vivid, { wait: 100 });
  await t.waitFor(() => H.num(t.text("[data-count]")) === nV, 8000, `Vivid pinks to show ${nV}`);
  t.expect(nV > 0 && nV < nP, `vivid pinks ${nV} of ${nP}`);
  t.expect(/Vivid pinks/.test(t.text("[data-count]")), `the count line says "${t.text("[data-count]")}"`);
  t.expect(!t.$("[data-clear]").hidden, "no Clear filters with a filter on");
  await t.click("[data-clear]", { wait: 100 });
  await t.waitFor(() => !t.ev("S.hm.fam") && !t.ev("S.hm.tone"), 6000, "Clear filters");
});

scenario("home", "View sheet: filters, Surprise me, Search", async t => {
  const cv = await H.homeReady(t);
  await H.sheet(t, "colors");
  const all = H.num(t.text("[data-count]"));
  const seg = t.$$('.hm-seg[data-key="filter"] button');
  t.expect(seg.length >= 2, "no filter buttons");
  for (const b of seg.filter(b => !b.classList.contains("on"))) {
    await t.click(b, { wait: 100 });
    await t.waitFor(() => /only|color/.test(t.text("[data-count]")), 6000, "the count line after a filter");
    t.expect(b.classList.contains("on"), `filter "${t.text(b)}" did not turn on`);
  }
  await t.click('[data-val="all"]', { wait: 100 });
  await t.waitFor(() => H.num(t.text("[data-count]")) === all, 8000, `All to bring back ${all} colors (says "${t.text("[data-count]")}")`);
  // Surprise me closes the sheet and moves the honeycomb
  await t.click("[data-surprise]", { wait: 500 });
  t.expect(!t.$(".hm-chooser"), "Surprise me left the View sheet open");
  // Search reveals the field; typing narrows the honeycomb without errors
  await H.sheet(t, "colors");
  await t.click("[data-search]", { wait: 400 });
  t.expect(!t.$(".hm-chooser"), "Search left the View sheet open");
  t.expect(!t.$("#hmSearch").hidden, "the search field did not appear");
  const q = t.$("#hmq"); q.value = "teal"; q.dispatchEvent(new t.w.Event("input", { bubbles: true }));
  await t.tick(); await t.sleep(600);
  t.expect(cv.isConnected, "the honeycomb was replaced while searching");
});

scenario("home", "Rooms corner opens the stem; each room bubble navigates", async t => {
  const rooms = [["learn", "Learn"], ["gym", "Train"], ["explore", "Explore"], ["studio", "Studio"]];
  for (const [id, label] of rooms) {
    await H.homeReady(t);
    await t.click("[data-rooms-corner]");
    await t.waitFor(".rooms-stem", 4000, "the rooms stem");
    const bubbles = t.$$(".rooms-stem .rm-bubble").map(b => b.dataset.room);
    t.expect(rooms.every(([r]) => bubbles.includes(r)), `the stem shows ${bubbles.join(", ")}`);
    await t.click(`.rooms-stem .rm-bubble[data-room="${id}"]`, { wait: 700 });
    await t.waitFor(`.room-sheet[data-room="${id}"]`, 6000, `the ${label} room`);
    t.expect(t.$(".room-sheet").innerText.length > 80, `the ${label} room is empty`);
  }
  // from inside a room the stem also holds Home, which goes back to the honeycomb
  await t.click("[data-rooms-corner]");
  await t.waitFor('.rooms-stem .rm-bubble[data-room="home"]', 4000, "Home in the stem");
  await t.click('.rooms-stem .rm-bubble[data-room="home"]', { wait: 900 });
  await t.waitFor("canvas", 6000, "the honeycomb after Rooms > Home");
});

// ================================================================== ROOMS
for (const [shot, id, label, needs] of [["learn", "learn", "Learn", ".plates, .btn"], ["gym", "gym", "Train", ".r2-g, .gs-tile"], ["explore", "explore", "Explore", ".xp-cover"], ["studio", "studio", "Studio", "[data-wheel]"]]) {
  scenario("rooms", `${label} renders inside the room sheet`, async t => {
    await t.open("#shot=" + shot, { settle: 600 });
    await t.waitFor(`.room-sheet[data-room="${id}"]`, 8000, `the ${label} room sheet`);
    await t.waitFor(() => t.$(needs, t.$(".room-sheet")), 6000, `${label}'s content (${needs})`);
    const sheet = t.$(".room-sheet");
    t.expect(sheet.innerText.length > 100, `${label} is nearly empty`);
    const r = sheet.getBoundingClientRect(); t.expect(r.height > 300, `${label}'s sheet is only ${Math.round(r.height)}px tall`);
    const why = t.reachable(t.$("[data-rooms-corner]")); t.expect(!why, `the Rooms corner ${why}`);
  });
}

// ================================================================== LEARN
scenario("learn", "Begin starts the lesson and the deck runs to the end", async t => {
  await t.open("#shot=learn", { settle: 600 });
  await t.waitFor(".room-learn", 6000, "the Learn room");
  const begin = t.$("[data-learn],[data-review],[data-go].btn");
  t.expect(begin, "Learn has no Begin / Continue button");
  await t.click(begin, { wait: 500 });
  await t.waitFor("#pager", 5000, "the meet pager after Begin");
  t.expect(t.$$("#pager .page").length >= 4, "the meet pager has too few pages");
  await t.click("#pager .ready [data-go]", { force: true, wait: 500 });
  await t.waitFor(".deck .card", 5000, "the deck's first card");
  let swiped = 0;
  for (let i = 0; i < 80 && !t.$(".result"); i++) {
    const rev = t.$("[data-reveal]");
    if (rev) await t.click(rev, { wait: 80 });
    const yes = t.$("[data-yes]");
    if (yes) { await t.click(yes, { wait: 350 }); swiped++; } else await t.sleep(200);
  }
  await t.waitFor(".result h1", 5000, "the unit-done screen");
  t.expect(/named/i.test(t.text(".result h1")), `unit-done says "${t.text(".result h1")}"`);
  t.notes.push(`${swiped} cards swiped`);
});

scenario("learn", "a due review starts a deck", async t => {
  await t.open("#shot=learn", { settle: 600 });
  await t.waitFor(".room-learn", 6000, "the Learn room");
  t.ev("Object.values(S.cards).forEach(c => { c.due = addDays(today(), -1); }); home();");
  await t.waitFor("[data-review]", 4000, "a Begin button for reviews");
  t.expect(/to recall/i.test(t.text(".room-learn h2")), `the headline says "${t.text(".room-learn h2")}"`);
  await t.click("[data-review]", { wait: 600 });
  await t.waitFor(".deck", 5000, "the review deck");
  await t.waitFor(".deck .card, .deck .pi-board, .deck [data-pick], .deck .pick", 5000, "the first review card");
  for (let i = 0; i < 4; i++) { const rev = t.$("[data-reveal]"); if (!rev) break; await t.click(rev, { wait: 80 }); const y = t.$("[data-yes]"); if (y) await t.click(y, { wait: 400 }); }
});

// ================================================================== THE DAILIES (js/challenge.js, js/colordle.js)
scenario("daily", "Today row: both tiles show their art and open their games", async t => {
  await t.open("#shot=learn", { settle: 600 });
  await t.waitFor("#dlPaintArt img", 8000, "the painting tile's thumbnail");
  await t.waitFor(() => !t.$("#dlColorArt.dl-ph"), 8000, "the color tile's swatch");
  await t.click("[data-dpaint]", { wait: 500 });
  await t.waitFor("#dpFrame", 8000, "Today's painting after tapping its tile");
});
scenario("daily", "Name today's color: a typed guess draws a row, a second says which way", async t => {
  await t.open("#/daily", { settle: 600 });
  const inp = await t.waitFor(".dn-in", 10000, "the guess field");
  const t0 = t.ev("dnTarget()"), names = t.ev("nearestCore(dnTarget().h, CORE_NAMES, 6).map(x => x.n)").filter(n => n !== t0.n);
  for (const n of names.slice(0, 2)) {
    inp.value = n; inp.dispatchEvent(new t.w.Event("input", { bubbles: true }));
    t.$("#dnForm").dispatchEvent(new t.w.Event("submit", { bubbles: true, cancelable: true }));
    await t.sleep(300);
  }
  t.expect(t.$$(".dn-row").length === 2, `expected 2 guess rows, got ${t.$$(".dn-row").length}`);
  t.expect(/than/.test(t.text("#dnMsg")), `the newest guess has no direction sentence: "${t.text("#dnMsg")}"`);
  t.expect(t.$$(".dn-row .dn-cell").length >= 6, "the rows have no axis cells");
  inp.value = t0.n; inp.dispatchEvent(new t.w.Event("input", { bubbles: true }));
  t.$("#dnForm").dispatchEvent(new t.w.Event("submit", { bubbles: true, cancelable: true }));
  await t.waitFor(".dn-hero.named", 4000, "the named reveal after the right guess");
  t.expect(t.$("[data-share]") && t.$("[data-page]"), "the finish has no share or page button");
});
scenario("daily", "Today's painting: a tap answers round 1, Next opens round 2's names", async t => {
  await t.open("#/challenge", { settle: 600 });
  const f = await t.waitFor("#dpFrame", 10000, "the painting");
  await t.stable(f);
  await t.waitFor(() => t.ev("S.dpNow && S.dpNow.p"), 6000, "the round state");
  const r = f.getBoundingClientRect();
  f.dispatchEvent(new t.w.MouseEvent("click", { bubbles: true, clientX: r.left + r.width * .5, clientY: r.top + r.height * .5 }));
  await t.waitFor("[data-next]", 4000, "Next after the tap");
  t.expect(t.$(".dp-ring"), "no ring where the tap landed");
  await t.click("[data-next]", { wait: 400 });
  await t.waitFor("#dpFoot [data-o]", 4000, "round 2's four names");
  t.expect(t.$$("#dpFoot [data-o]").length === 4, "round 2 doesn't have four names");
});

// ================================================================== TRAIN
scenario("train", "check-in card opens the drill", async t => {
  await t.open("#shot=gx:due", { settle: 600 });
  // the check-in lives on Train > Your eye (js/rooms2.js); the row says it's ready
  const eyeRow = await t.waitFor("[data-r2-eye]", 6000, "the Your eye row");
  t.expect(/check-in/i.test(eyeRow.textContent), "the Your eye row doesn't say a check-in is ready");
  await t.click(eyeRow, { wait: 500 });
  const ck = await t.waitFor("[data-checkin]", 6000, "the weekly check-in row");
  await t.click(ck, { wait: 500 });
  await t.waitFor(".drill.gy-checkin", 6000, "the check-in drill");
  await t.waitFor(".drill .tile, .drill .half, .drill .sq-dot, .drill [data-check], .drill [data-lock], .drill input[type=range]", 5000, "something to answer in the drill");
  t.expect(t.$$(".drill .segs i").length >= 6, "the check-in has no progress segments");
  const done0 = t.$$(".drill .segs i.on").length;
  for (let i = 0; i < 40 && t.$$(".drill .segs i.on").length < done0 + 3 && !t.$(".result"); i++) {
    const b = t.$("[data-lock]") || t.$("[data-cf]") || t.$("[data-next]") || t.$(".drill .tile:not(.ring):not(.miss):not(.picked)") || t.$(".drill .half:not(.ring):not(.miss):not(.picked)");
    if (b) await t.click(b, { force: true, wait: 400 }); else await t.sleep(300);
  }
  t.expect(t.$$(".drill .segs i.on").length >= done0 + 3 || t.$(".result"), "answering three check-in rounds did not advance the progress bar");
});

scenario("train", "every entry on the Train menu opens something (nothing locked)", async t => {
  // js/rooms2.js: Today (3), the six games, then Drills and Your eye; each tap must leave the room (a game, a
  // drill, a page) or answer with a sheet or a toast, with no error. Then every drill on the Drills page.
  await t.open("#shot=gx:home", { settle: 600 });
  await t.waitFor(".r2-games .r2-g", 6000, "the Train games grid");
  const SEL = ".r2-td-row .r2-td, .r2-games .r2-g, .r2-rows .r2-row";
  const n = t.$$(SEL).length, g = t.$$(".r2-games .r2-g").length;
  t.expect(g >= 6 && g <= 7, `${g} game tiles on Train (want the six)`);
  t.expect(t.$$(".r2-td-row .r2-td").length === 3, "the Today row doesn't have three parts");
  t.expect(t.$$(".r2-new").length <= 2, `${t.$$(".r2-new").length} "New" tags (at most two)`);
  t.expect(!t.$(".r2-train .locked, .r2-train [data-locked]"), "a locked entry on the Train menu");
  // nothing sits under the rooms button: scrolled to the end, the last row ends at least a corner (48 px) plus its
  // gap above the room's bottom edge (measured against the room itself, which may still be mid-entrance here)
  t.ev("document.querySelectorAll('.r2-train').forEach(e => e.scrollTop = 1e6); window.scrollTo(0, 1e6)"); await t.sleep(300);
  const last = t.$$(".r2-rows .r2-row").pop(), room = t.$(".r2-train");
  if (last && room) { const a2 = last.getBoundingClientRect(), r2 = room.getBoundingClientRect(), k = r2.width / room.offsetWidth || 1, gap = (r2.bottom - a2.bottom) / k; t.expect(gap >= 56, `the last Train row ends ${Math.round(gap)} px from the bottom, under the rooms button`); }
  for (let i = 0; i < n; i++) {
    const b = t.$$(SEL)[i], label = (b.querySelector("b") || b).textContent.trim();
    await t.click(b, { wait: 500 });
    await t.waitFor(() => !t.$('.room-sheet[data-room="gym"]') || t.$(".sheet") || t.$(".toast"), 6000, `"${label}" to open something`);
    t.ev("document.querySelectorAll('.scrim,.sheet,.toast').forEach(n => n.remove()); go('gym')");
    await t.waitFor(".r2-games .r2-g", 6000, `the Train menu again after "${label}"`);
  }
  await t.click("[data-r2-drills]", { wait: 500 });
  await t.waitFor(".r2-sub .r2-list .r2-li", 6000, "the Drills page");
  const d = t.$$(".r2-sub .r2-li").length;
  t.expect(d >= 12, `only ${d} drills on the Drills page`);
  for (let i = 0; i < d; i++) {
    const b = t.$$(".r2-sub .r2-li")[i], label = (b.querySelector("b") || b).textContent.trim();
    await t.click(b, { wait: 500 });
    await t.waitFor(() => !t.$(".r2-sub") || t.$(".sheet") || t.$(".toast"), 6000, `drill "${label}" to open something`);
    t.ev("document.querySelectorAll('.scrim,.sheet,.toast').forEach(n => n.remove()); r2DrillsPage()");
    await t.waitFor(".r2-sub .r2-li", 6000, `the Drills page again after "${label}"`);
  }
  await t.click("[data-close]", { wait: 500 });
  await t.waitFor(".r2-games .r2-g", 6000, "Train after Back from Drills");
  await t.click("[data-r2-eye]", { wait: 500 });
  await t.waitFor(".r2-fams.big .r2-fam", 6000, "the Your eye page");
  t.expect(t.$$(".r2-fams.big .r2-fam").length === 9, "Your eye doesn't show nine families");
  t.notes.push(`${n} Train entries and ${d} drills opened`);
});

scenario("train", "Odd one out: tap tiles through a whole round", async t => {
  // js/games: the Train shelf opens the Odd one out map (a played save), then level 1
  await t.open("#shot=gx:home", { settle: 600 });
  const st = await t.waitFor("[data-oo-map]", 6000, "the Odd one out shelf");
  await t.click(st, { wait: 600 });
  const play = await t.waitFor("[data-play], .oo-board", 6000, "the map or level 1");
  if (play.matches("[data-play]")) await t.click(play, { wait: 600 });
  await t.waitFor(".oo-board .oo-t", 6000, "the board");
  t.expect(t.$$(".oo-board .oo-t").length >= 9, `${t.$$(".oo-board .oo-t").length} tiles`);
  const first = t.$("#oostage").innerHTML;
  await t.click(".oo-board .oo-t", { wait: 1200 });
  t.expect(t.$("#oostage").innerHTML !== first || t.$(".result") || t.$("#oofoot").innerText.length > 5, "tapping a tile changed nothing");
  let taps = 1;
  for (let i = 0; i < 60 && !t.$(".result"); i++) {
    const b = t.$("[data-next]") || t.$("[data-w]") || t.$("[data-k]:not(:disabled)") || t.$(".oo-board .oo-t:not(.ring):not(.miss):not(.sel):not(:disabled)");
    if (b) { await t.click(b, { force: true, wait: 400 }); taps++; } else await t.sleep(300);
  }
  await t.waitFor(".result", 6000, "the station result screen");
  t.expect(t.$(".result").innerText.length > 40, "the result screen is empty");
  t.notes.push(`${taps} taps to the result`);
});

// Gradients (js/games/hue-*.js): the shelf opens the teaching board; swap the two tiles with real taps, then play
// level 1 to the results by tapping each tile home (tile, then its slot), the way a thumb would.
const hgSolveByTaps = async t => {
  for (let k = 0; k < 80; k++) {
    const pair = t.ev(`(() => { const L = HG_LIVE; if (!L || L.st.done) return null; const b = L.board, at = L.at;
      for (let s = 0; s < at.length; s++) { if (hgHome(b, at, s) || (b.geo.twins && b.geo.cells[s].i >= b.geo.n / 2)) continue;
        const f = at.findIndex((x, j) => j !== s && b.hex[x] === b.hex[s] && !hgHome(b, at, j)); if (f >= 0) return [f, s]; } return null; })()`);
    if (!pair) break;
    await t.click(`.hg-board .hg-s[data-s="${pair[0]}"]`, { force: true, wait: 60 });
    await t.click(`.hg-board .hg-s[data-s="${pair[1]}"]`, { force: true, wait: 320 });
  }
};
scenario("train", "Gradients: teaching board then level 1 by taps", async t => {
  await t.open("#shot=gx:home", { settle: 600 });
  const shelf = await t.waitFor("[data-hg-map], [data-r2-extra=hue]", 6000, "the Gradients tile");
  await t.click(shelf, { wait: 600 });
  await t.waitFor(".hg-board .hg-s", 6000, "the teaching board");
  t.expect(/swapped/i.test(t.text("#hgq")), `the first board teaches by doing ("${t.text("#hgq")}")`);
  await hgSolveByTaps(t);
  await t.waitFor(".hg-foot [data-go]", 6000, "Play level 1 after the teaching board");
  await t.sleep(400);
  await t.sleep(600);
  await t.click(".hg-foot [data-go]", { force: true, wait: 700 });
  await t.waitFor(() => !/game|swapped/i.test(t.text("#app #hgq")) && t.$("#app .hg-board .hg-s:not(.fix)"), 6000, "level 1");
  const moves0 = t.text(".hg-moves");
  await hgSolveByTaps(t);
  t.expect(t.text(".hg-moves") !== moves0, "tapping tiles did not count a move");
  const go = await t.waitFor("#app .hg-foot [data-go]", 8000, "the reveal after solving");
  t.expect(t.text("#hgq").length > 2, "the source's name did not come up");
  await t.click(go, { wait: 700 });
  await t.waitFor(".hg-res", 6000, "the results screen");
  t.expect(t.$$(".hg-corner").length === 4, `${t.$$(".hg-corner").length} corner chips instead of 4`);
  t.expect(t.$(".hg-heat"), "no heat map on the results");
  t.notes.push(`${t.text(".hg-res .res b")}`);
});
scenario("train", "Gradients: map and Choose mode and the daily board", async t => {
  await t.open("#shot=gx:hue:map", { settle: 600 });
  await t.waitFor(".hg-lv", 6000, "the level grid");
  t.expect(t.$$(".hg-lv.locked").length === 0, "levels are locked in For you: nothing should be locked");
  await t.click("[data-mode=choose]", { wait: 500 });
  await t.waitFor("[data-diff]", 4000, "the difficulty picker");
  await t.click("[data-diff=hard]", { wait: 500 });
  const lockedOpen = t.$$(".hg-world:not([data-w='4']) .hg-lv.locked").length;
  t.expect(lockedOpen === 0, `${lockedOpen} levels still locked in Choose mode`);
  t.expect(/Hard|2\.\d%/.test(t.text(".hg-modeline")) || t.$("[data-diff=hard].on"), "Hard is not selected");
  await t.click("[data-mode=you]", { wait: 500 });
  await t.click("[data-daily]", { wait: 700 });
  await t.waitFor(".hg-board .hg-s", 6000, "today's board");
  t.expect(/today/i.test(t.text("#hgq")), "the daily board has no title");
});

// ================================================================== EXPLORE
for (const [part, expect] of [["all", ".x-feed .pin, .x-feed [data-pin]"], ["art", ".xb-pick"], ["ideas", ".x-feed .pin, .x-feed [data-pin]"], ["world", "#world *"], ["saved", ".x-feed"]]) {
  scenario("explore", `${part} cover opens and goes back`, async t => {
    await t.open("#shot=explore:all", { settle: 600 });
    const cover = await t.waitFor(`.xp-cover[data-part="${part}"]`, 8000, `the ${part} cover`);
    t.expect(t.$$(".xp-cover").length === 5, `${t.$$(".xp-cover").length} covers instead of 5`);
    let pinOpened = false;
    await t.click(cover, { force: true, wait: 500 });
    await t.waitFor(".p-title", 8000, `the ${part} screen`);
    await t.waitFor(expect, 12000, `${part} content (${expect})`);
    if (/pin/.test(expect)) {   // a pin opens a closeup
      const pin = t.$$(expect).find(p => p.getBoundingClientRect().width > 0);
      t.expect(pin, "no visible pin");
      const title = t.text(".p-title");
      await t.click(pin, { force: true, wait: 600 });
      await t.waitFor(() => t.text(".p-title") !== title || t.$(".closeup, .cp-page, .article"), 6000, "a pin to open");
      await t.sleep(200);
      pinOpened = true;
    }
    if (pinOpened) { await t.click("[data-back]", { wait: 500 }); await t.waitFor(() => t.$(".p-title") || t.$(".xp-cover"), 6000, "a screen after Back from the pin"); }
    if (!t.$(".xp-cover")) await t.click("[data-back]", { wait: 500 });
    await t.waitFor(".xp-cover", 6000, "the pager of covers after Back");
  });
}

// For you (js/explore.js, default lens): a strong painting interest (interests(), js/learner.js) nudges
// painting pins earlier in the mix -- a nudge like fvForYou's, never a filter, so every kind still shows.
scenario("explore", "For you nudges pins toward a strand you follow, without hiding the others", async t => {
  try {
    localStorage.setItem("colorhub-v1", JSON.stringify({
      v: 3, placed: { tier: 1, at: "2026-10-01" },
      learn: { v: 1, ev: Array.from({ length: 20 }, (_, i) => ({ t: Date.now() - i * 36e5, e: "seen", src: "painting" })), agg: { c: {}, p: {} }, sets: {}, bf: 1 },
    }));
  } catch (e) {}
  await t.open("#shot=explore:all", { settle: 600, keepState: true });
  await t.click('.xp-cover[data-part="all"]', { force: true, wait: 500 });
  await t.waitFor(".x-feed .pin", 10000, "pins in the For you feed");
  const kinds = t.$$(".x-feed .pin").map(p => p.className.match(/pin-(\w+)/)?.[1] || "");
  t.expect(kinds.includes("art"), "no painting pin anywhere in the feed despite a strong painting interest");
  t.expect(kinds.includes("color"), "the color pins disappeared; a nudge should never hide the others");
});

scenario("explore", "a cover's palette chip opens its color page; the primary opens the part", async t => {
  await t.open("#shot=explore:all", { settle: 600 });
  const chip = await t.waitFor('.xp-cover[data-part="all"] .xp-chip', 8000, "a palette chip on the For you cover");
  await t.click(chip, { force: true, wait: 500 });
  await t.waitFor(".cp-page, .nm-page, .p-title", 8000, "a color page after tapping a palette chip");
  t.expect(!t.$(".x-feed"), "the chip opened the For you feed instead of its color page");
  await t.open("#shot=explore:all", { settle: 600 });
  const go = await t.waitFor('.xp-cover[data-part="saved"] [data-go]', 8000, "the Saved cover's primary");
  await t.click(go, { force: true, wait: 500 });
  await t.waitFor(".p-title", 8000, "a part after the Saved cover's primary");
});

scenario("explore", "Art with a color shows tiles", async t => {
  await t.open("#shot=explore:art:Denim", { settle: 600 });
  await t.waitFor(".art-band", 8000, "the Art screen");
  await t.waitFor(() => /denim/i.test(t.text(".art-band .p-dek")), 15000, "Art's line to name denim");
  const tiles = await t.waitFor(() => { const p = t.$$(".xb-body .xb-t"); return p.length >= 6 && p; }, 25000, "painting tiles in the Art grid");
  t.notes.push(`${tiles.length} tiles`);
  await t.click(tiles[0], { force: true, wait: 600 });
  await t.waitFor(() => t.$(".gl-page") && !t.$(".xb-screen"), 12000, "a painting page after tapping a tile");
  await t.click(".gl-page [data-back]", { wait: 600 });
  await t.waitFor(() => t.$(".xb-screen") && /denim/i.test(t.text(".xb-crumbs")), 12000, "Art again, still on denim, after Back");
});

// Explore 2.0 (js/browse-ui.js): a facet sheet narrows the count, the crumb's x and Back unwind, every view draws
scenario("explore", "Art facets, views and Back", async t => {
  await t.open("#shot=explore:art", { settle: 600 });
  await t.waitFor(".xb-screen [data-xbn]", 25000, "the Art count");
  const count = () => H.num(t.text("[data-xbn]"));
  const all = count();
  t.expect(all > 20000, `Art starts with ${all} paintings`);
  await t.click('.xb-facets [data-xbfacet="mood"]', { wait: 500 });
  await t.waitFor(".xb-sheet", 4000, "the Mood sheet");
  await t.click('.xb-sheet [data-xbopt="key"][data-v="2"]', { wait: 400 });
  const light = count();
  t.expect(light > 0 && light < all, `Light key: ${light} of ${all}`);
  await t.click(".xb-sheet [data-xbshgo]", { wait: 500 });
  t.expect(/light key/i.test(t.text(".xb-crumbs")), `the breadcrumb says "${t.text(".xb-crumbs")}"`);
  for (const v of ["river", "painters", "wall", "grid"]) {
    await t.click(`[data-xbview="${v}"]`, { wait: 600 });
    await t.waitFor({ river: ".xb-river, .xb-empty", painters: ".xb-pr", wall: ".xb-wall canvas", grid: ".xb-t" }[v], 8000, `the ${v} view`);
  }
  await t.click('[data-xbx="key"]', { wait: 500 });
  t.expect(count() === all, `removing the crumb brings back all ${all} (now ${count()})`);
  await t.click(".art-top [data-back]", { wait: 500 });
  t.expect(count() === light, `Back unwinds to the light-key filter (${count()})`);
  await t.click(".art-top [data-back]", { wait: 500 });
  t.expect(count() === all, `Back again unwinds to everything (${count()})`);
});

// ================================================================== COLOR PAGES
scenario("pages", "colorPage x3: renders, swatch opens another, Back works", async t => {
  const names = await t.open("#shot=home").then(() => t.ev("ALL.map(c => c.n)"));
  const picks = ["Teal", ...t.sample(names.filter(n => n !== "Teal"), 2, "color")];
  for (const n of picks) {
    const slug = H.slug(t, n);
    await H.openPage(t, "#/color/" + slug, n);
    const used = await H.tapSwatch(t);
    const other = H.title(t);
    await H.back(t);
    await t.waitFor(() => !t.$(".cp-page") || H.title(t) === n, 6000, `Back to return to ${n}`);
    if (t.$(".cp-page")) await H.back(t);
    t.expect(!t.$(".cp-page"), `Back from ${n} left a page open`);
    t.notes.push(`${n} > ${other} (${used.replace(/\[data-|\]|\.lk-row|\.pchip/g, "")})`);
  }
});

scenario("pages", "nearest stories: a name without an article offers the nearest ones, a tap opens another page", async t => {
  // a name with no story of its own. Stories keep landing (pale-aqua got one in article wave 2, and a missing row then
  // timed out the whole group), so take the first candidate whose page settles on nearest stories, not a story.
  let first = null;
  for (const s of ["pale-aqua", "pale-teal", "dull-aqua", "pale-cyan", "light-aqua", "pale-blue-green"]) {
    await H.openPage(t, "#/name/" + s);
    const got = await t.waitFor(() => t.$(".rp-ns-row") ? "rows" : t.$("[data-ar-slot]:not([hidden])") ? "story" : null, 10000, `${s}: its story or its nearest stories`);
    if (got === "rows") { first = H.title(t); break; }
  }
  t.expect(first, "every candidate name has its own story now: pick new ones for this scenario");
  await t.waitFor(".rp-ns-row", 10000, "a nearest-story row on a color with no article of its own");
  const rows = t.$$(".rp-ns-row", t.$("#app"));
  t.expect(rows.length >= 1 && rows.length <= 3, `${rows.length} nearest-story rows`);
  t.expect(/match/.test(rows[0].textContent) && /min read/.test(rows[0].textContent), "a row shows the match and the minutes to read");
  t.expect(!/\bthe 101\b/i.test(t.$("#app").innerText), "the page says 'the 101'");
  await t.click(rows[0], { wait: 400 });
  await t.waitFor(() => t.$(".cp-page .cp-hero-foot h1") && H.title(t) !== first, 8000, "a nearest-story tap to open another page");
  t.notes.push(`${first} > ${H.title(t)}`);
});

scenario("pages", "namePage x3: renders, a near name opens another, Back works", async t => {
  await t.open("#shot=home");
  const core = await fetch("/data/core-names.json").then(r => r.json());
  const taught = new Set(t.ev("ALL.concat(BASICS).map(c => c.n.toLowerCase())"));
  const pool = core.map(e => e.n).filter(n => !taught.has(n.toLowerCase()));
  const picks = t.sample(pool, 3, "name");
  for (const n of picks) {
    await H.openPage(t, "#/name/" + H.slug(t, n), n);
    t.expect(t.$(".cp-page.names"), `${n}: not a library name page`);
    const used = await H.tapSwatch(t);
    const other = H.title(t);
    await H.back(t);
    await t.waitFor(() => !t.$(".cp-page") || H.title(t) === n, 6000, `Back to return to ${n}`);
    if (t.$(".cp-page")) await H.back(t);
    t.expect(!t.$(".cp-page"), `Back from ${n} left a page open`);
    t.notes.push(`${n} > ${other}`);
  }
});

// js/article-refs.js: the figure cards in an article (Mauve has an article, a twin gem, a film and paintings that hold the color)
scenario("pages", "article figure cards: Mauve draws them, a card opens its page, Back returns to the article", async t => {
  await H.openPage(t, "#/color/mauve", "Mauve");
  // a long story is a door on the page (chapters, minutes); Begin reading opens the book on its own screen
  const door = await t.waitFor(".ar-door [data-ar-begin]", 20000, "Mauve's story door");
  t.expect(!t.$(".cp-page .ar-sec"), "the long story is drawn inline on the color page, not behind its door");
  t.expect(t.$$(".ar-door [data-ar-chap]").length >= 2, "the door lists no chapters");
  await t.click(door, { wait: 700 });
  await t.waitFor(() => t.$(".ar-read .ar") && /#\/read\/mauve/.test(decodeURIComponent(t.w.location.hash)), 15000, "the book at #/read/mauve");
  await t.waitFor(() => t.$$(".ar-fig").length >= 2, 25000, "the article's figure cards");
  // the planned twins (at most 5, one per section) plus the pictures that break up long runs of text (data-ar-gap, at most 10)
  const all = t.$$(".ar-fig"), figs = all.filter(f => !f.hasAttribute("data-ar-gap")), gapFigs = all.filter(f => f.hasAttribute("data-ar-gap"));
  t.expect(figs.length <= 5, `${figs.length} auto-figures, the limit is 5`);
  t.expect(gapFigs.length <= 10, `${gapFigs.length} pictures between paragraphs, the limit is 10`);
  t.expect(all.every(f => /\d+% match to Mauve/.test(t.text(f.querySelector(".ar-fig-m")))), "a card is missing its '% match to Mauve' line");
  // a compact card's picture is a fixed 112 (88 under 360 px) square; a wide one fills the measure at a fixed 4:3 or 3:2
  t.expect(all.every(f => { const r = f.querySelector(".ar-fig-im").getBoundingClientRect(); return f.classList.contains("ar-wide") ? r.width > 200 && [3 / 4, 2 / 3].some(k => Math.abs(r.height - r.width * k) < 2) : [112, 88].includes(r.width); }), "a card's picture box lost its fixed proportions");
  const secs = figs.map(f => (f.closest("[data-ar-sec]") || {}).id || "seen").filter(x => x !== "seen");
  t.expect(new Set(secs).size === secs.length, "two figures landed in one section");
  const card = t.$('.ar-fig[data-kind="gem"] .ar-fig-b') || t.$(".ar-fig .ar-fig-b");
  const title = t.text(card.querySelector(".ar-fig-n"));
  await t.click(card, { wait: 700 });
  await t.waitFor(() => !t.$(".ar") && t.$(".p-title, .cp-hero-foot h1, .gl-page, .film-page"), 10000, `the page for "${title}"`);
  await t.click("[data-back]", { wait: 600 });
  await t.waitFor(() => t.$(".ar-read .ar") && t.$$(".ar-fig").length >= 2, 20000, "the book and its figures after Back");
  await t.click("[data-back]", { wait: 600 });
  await t.waitFor(() => t.$(".cp-page .cp-hero-foot h1") && H.title(t) === "Mauve" && t.$(".ar-door"), 15000, "Back from the book to Mauve's page and its door");
});

scenario("pages", "a tapped in-between hex opens its nearest name with 'Your color'", async t => {
  await H.openPage(t, "#/color/teal", "Teal");
  let sawYours = 0;
  for (const hex of ["#7A4B63", "#6E8A3A", "#B8905C", "#5A7D9A"]) {
    // a swatch drawn anywhere in the app is just an element with data-swatch; the delegated click handler does the rest
    const sw = t.d.createElement("button"); sw.dataset.swatch = hex; sw.style.cssText = "position:fixed;left:150px;top:300px;width:60px;height:60px;z-index:9999";
    t.d.body.appendChild(sw);
    const before = H.title(t) + "|" + H.chip(t);
    await t.click(sw, { wait: 400 });
    sw.remove();
    await t.waitFor(() => t.$(".cp-page .cp-hero-foot h1") && (H.title(t) + "|" + H.chip(t)) !== before, 10000, `a page for ${hex}`);
    t.expect(/Your color|Yours|New to you|In your reviews|Learning|basic|Library color|Stage/.test(H.chip(t)), `${hex}: odd status chip "${H.chip(t)}"`);
    t.notes.push(`${hex} > ${H.title(t)} (${H.chip(t).slice(0, 30)})`);
    if (/Your color/.test(H.chip(t))) {
      sawYours++;
      const hero = getComputedStyle(t.$(".cp-hero-full")).getPropertyValue("--c").trim().toUpperCase();
      t.check(hero === hex, `${hex}: the hero shows ${hero}, not the tapped color`);
    }
    await H.tapSwatch(t);
    await H.back(t);
    await H.back(t);
    await H.openPage(t, "#/color/teal", "Teal");
  }
  t.expect(sawYours >= 1, "none of the in-between colors showed a 'Your color' page");
});

scenario("pages", "a world twin (In gems) opens its page in one tap, Back returns to the color", async t => {
  await H.openPage(t, "#/name/fiery-rose", "Fiery Rose");
  const d = await t.waitFor(() => t.$('[data-rp-drawer="world"]'), 8000, "the 'In the world' drawer");
  await t.waitFor(() => !d.hidden && t.$$("[data-to]", d).length > 0, 10000, "a twin row (gem, flower, fashion or film) in the world drawer");
  if (!d.open) await t.click(d.querySelector("summary"), { wait: 200 });
  const row = t.$$("[data-to]", d).find(e => /^gm:/.test(e.dataset.to)) || t.$$("[data-to]", d)[0];
  t.expect(row, "no twin row to tap");
  const id = row.dataset.to;
  await t.click(row, { wait: 700 });
  await t.waitFor(() => !t.$(".cp-page .cp-hero-foot h1") || H.title(t) !== "Fiery Rose", 8000, `the twin page for ${id} to open`);
  t.expect(t.$("#app").innerText.length > 100, `the page for ${id} is empty`);
  t.notes.push(`Fiery Rose > ${id}`);
  await t.click("[data-back]", { wait: 600 });
  await t.waitFor(() => t.$(".cp-page .cp-hero-foot h1") && H.title(t) === "Fiery Rose", 8000, "Back to return to Fiery Rose");
});

// design/audit-graph/CHECKPOINT.md #6/#7: role paintings (ar.rp_) and Werner's 1821 examples (node.werner),
// both already computed, never shown before this -- js/richcolor.js rcRolePaintingsHTML / rcWernerLine.
scenario("pages", "role paintings and Werner's 1821 example show on the color page", async t => {
  await H.openPage(t, "#/name/auburn", "Auburn");
  const paint = await t.waitFor(() => t.$('[data-rp-drawer="paint"]'), 8000, "the 'In paintings' drawer");
  if (!paint.open) await t.click(paint.querySelector("summary"), { wait: 200 });
  await t.waitFor(() => t.$$(".rc-ri", paint).length >= 2, 15000, "a role-paintings row (shadow/mid/light/accent/hidden)");
  const tiles = t.$$(".rc-ri", paint);
  t.expect(tiles.every(x => /Shadow|Mid|Light|Accent|Hidden/.test(x.textContent)), "a role tile is missing its label");
  const tile = await t.waitFor(() => tiles.find(x => x.dataset.rcGi), 15000, "a role painting resolved to a gallery index");
  await t.click(tile, { wait: 700 });
  await t.waitFor(() => t.$(".gl-page"), 10000, "the role painting's own page");
  await t.click("[data-back]", { wait: 600 });
  await t.waitFor(() => t.$(".cp-page .cp-hero-foot h1") && H.title(t) === "Auburn", 8000, "Back to return to Auburn");

  await H.openPage(t, "#/name/indigo-blue", "Indigo Blue");
  const world = await t.waitFor(() => t.$('[data-rp-drawer="world"]'), 8000, "the 'In the world' drawer");
  if (!world.open) await t.click(world.querySelector("summary"), { wait: 200 });
  const line = await t.waitFor(() => t.$(".rc-werner", world), 15000, "Werner's 1821 example line");
  t.expect(/Werner, 1821:.*Blue Copper Ore.*\(mineral\)/.test(t.text(line)), `the Werner line reads "${t.text(line)}"`);
});

scenario("pages", "hold the cover: the flower rises, dragging lights a hex, letting go opens that color; Back returns", async t => {
  await H.openPage(t, "#/name/fiery-rose", "Fiery Rose");
  const hero = t.$(".cp-hero"), r = hero.getBoundingClientRect();
  const ev = (type, x, y) => new t.w.PointerEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 7, pointerType: "touch", isPrimary: true, view: t.w });
  hero.dispatchEvent(ev("pointerdown", r.left + r.width / 2, r.top + r.height / 3));
  await t.sleep(520);
  t.expect(t.$(".rp-hold .rp-flower"), "holding the cover did not raise the flower");
  const hex = t.$$(".rp-hold .rp-hex[data-h]")[0];
  t.expect(hex, "the flower has no neighbor to walk to");
  const hr = hex.getBoundingClientRect(), name = hex.dataset.n;
  hero.dispatchEvent(ev("pointermove", hr.left + hr.width / 2, hr.top + hr.height / 2));
  await t.sleep(150);
  t.expect(hex.classList.contains("hot"), "dragging onto a hex did not light it");
  hero.dispatchEvent(ev("pointerup", hr.left + hr.width / 2, hr.top + hr.height / 2));
  await t.waitFor(() => !t.$(".rp-hold") && t.$(".cp-page .cp-hero-foot h1") && H.title(t) !== "Fiery Rose", 8000, `letting go on ${name} to open its page`);
  t.notes.push(`Fiery Rose > ${H.title(t)} (hold-to-walk)`);
  await H.back(t);
  await t.waitFor(() => t.$(".cp-page .cp-hero-foot h1") && H.title(t) === "Fiery Rose", 8000, "Back to return to Fiery Rose");
});

scenario("pages", "Learn it runs meet > recall from a color page", async t => {
  await H.openPage(t, "#/color/teal", "Teal");
  await t.click("[data-learnit]", { wait: 600 });
  await t.waitFor(".ls-sheet", 4000, "Learn it opens the Learn sheet with settings");
  // the sheet offers "The full lesson" as one of its methods for a color with its own unit page
  if (t.$(".pr-quick")) await t.click('[data-method="lesson"]', { wait: 600 });
  await t.waitFor("#ltPager", 6000, "the Learn it meet pager");
  t.expect(t.$$("#ltPager .lt-page").length >= 3, "the meet pager has too few pages");
  // (smooth scrolling does not run under the virtual clock, so jump page by page like a finger would, then press Enter on the last one)
  const pager = t.$("#ltPager"), pages = pager.children.length;
  for (let i = 1; i < pages; i++) { pager.scrollTop = pager.clientHeight * i; await t.tick(); await t.sleep(250); }
  await H.keys(t, "Enter");
  await t.waitFor(".learnit.lt-recall .card", 6000, "the recall deck after the last meet page");
  let n = 0;
  for (let i = 0; i < 30 && t.$(".lt-recall") && n < 3; i++) {
    const rev = t.$("[data-reveal]"); if (rev) await t.click(rev, { wait: 80 });
    const yes = t.$("[data-yes]"); if (yes) { await t.click(yes, { wait: 400 }); n++; } else await t.sleep(200);
  }
  t.expect(n >= 1, "could not swipe a recall card");
  // closing returns to the color's own page
  await t.click("[data-close]", { wait: 600 });
  await t.waitFor(".cp-page", 6000, "the color page after closing Learn it");
});

scenario("pages", "Learn opens the instant deck; Start plays flashcards to the results", async t => {
  await H.openPage(t, "#/color/teal", "Teal");
  await t.click("[data-learnit]", { wait: 600 });
  await t.waitFor(".pr-quick", 4000, "the Learn sheet (Learn it opens it directly now)");
  t.ev("(() => { const r = document.querySelector('.pr-quick [data-size]'); r.value = 5; r.dispatchEvent(new Event('input', { bubbles: true })); })()");
  await t.click('.pr-quick [data-method="cards"]', { wait: 600 });
  await t.waitFor(".pr-play .pr-card", 4000, "the flashcard");
  for (let i = 0; i < 20 && !t.$(".pr-res"); i++) {
    const st = t.$(".pr-stage"); if (st && st._prReveal && !t.$(".pr-card.revealed")) { st._prReveal(); await t.sleep(150); }
    const yes = t.$("[data-yes]"); if (yes) await t.click(yes, { wait: 450 }); else await t.sleep(200);
  }
  await t.waitFor(".pr-res", 4000, "the results screen");
  t.expect(/known/.test(t.$(".pr-res-t").textContent), "the results title");
  await t.click(".pr-res [data-close]", { wait: 600 });
  await t.waitFor(".cp-page", 6000, "back on the color page after closing");
});

scenario("home", "Study corner opens the instant deck seeded with the middle color", async t => {
  await H.homeReady(t);
  await H.menu(t, "learn");
  await t.waitFor(".pr-quick", 4000, "the instant-deck sheet from Home");
  t.expect(/Learn/.test(t.$("[data-qtitle]").textContent), "the sheet title");
  t.expect(t.$$(".pr-quick .pr-plate i").length >= 5, "the deck plate");
});

// ================================================================== LEARN A SET (js/learnset.js)
const LS_SOLVE = `(() => {
  const st = document.querySelector('.ls-study .pr-stage'); if (!st) return 'gone';
  const boss = st.querySelector('[data-boss]'); if (boss) { boss.click(); return 'boss'; }
  const nx = st.querySelector('[data-next]'); if (nx) { nx.click(); return 'next'; }
  const it = st._lsIt, nm = it ? prName(it) : '';
  if (st.querySelector('.pr-s-match') && st._prMatch) {
    const { tiles } = st._prMatch, btns = [...st.querySelectorAll('.pr-tile')];
    const k = tiles.findIndex((t, i) => !t.sw && !btns[i].classList.contains('gone')); if (k < 0) return 'wait';
    const j = tiles.findIndex(t => t.sw && t.i === tiles[k].i); btns[k].click(); btns[j].click(); return 'match';
  }
  if (st.querySelector('.pr-s-odd')) { st._prChoose(st._prOpts.findIndex(o => !o.same)); return 'odd'; }
  if (st.querySelector('.pr-s-quiz')) { st._prChoose([...st.querySelectorAll('.pr-opt')].findIndex(b => b.textContent.trim() === nm)); return 'qn'; }
  if (st.querySelector('.pr-s-qc')) { st._prChoose([...st.querySelectorAll('.pr-cell .pr-tag')].findIndex(b => b.textContent.trim() === nm)); return 'qc'; }
  if (st.querySelector('.pr-s-type input') && !st.querySelector('.pr-typef.done')) { st._prType(nm); return 'type'; }
  if (st.querySelector('.pr-s-card')) { if (!st.querySelector('.pr-card.revealed')) { st._prReveal(); return 'reveal'; } const y = st.querySelector('[data-yes]'); if (y) { y.click(); return 'yes'; } }
  return 'wait';
})()`;
scenario("learnset", "Learn sheet: live preview, size and closeness sliders, Look and Study both there", async t => {
  await H.openPage(t, "#/color/teal", "Teal");
  await t.click("[data-learnit]", { wait: 600 });
  await t.waitFor(".ls-sheet", 4000, "Learn it opens the Learn sheet directly");
  t.expect(t.$(".ls-sheet [data-look]") && t.$(".ls-sheet [data-go]"), "Look and Study are both on the sheet");
  const set = v => t.ev(`(() => { const r = document.querySelector('.ls-sheet [data-size]'); r.value = ${v}; r.dispatchEvent(new Event('input', { bubbles: true })); return document.querySelectorAll('.ls-prev i').length; })()`);
  t.expect(await set(4) === 4, "the preview follows the size slider (4)");
  t.expect(await set(14) === 14, "the preview follows the size slider (14)");
  const before = t.ev("[...document.querySelectorAll('.ls-prev i')].map(i => i.style.cssText).join()");
  t.ev("(() => { const r = document.querySelector('.ls-sheet [data-closeness]'); r.value = 4; r.dispatchEvent(new Event('input', { bubbles: true })); })()");
  t.expect(t.ev("[...document.querySelectorAll('.ls-prev i')].map(i => i.style.cssText).join()") !== before, "the closeness slider changes the set");
  t.expect(/Wide/.test(t.text(".ls-sheet [data-closev]")), "the closeness label reads Wide");
});
scenario("learnset", "Study from a pair: its colors are pinned, look-alikes are added per color and can be removed or Studied", async t => {
  SP.placed();
  await t.open("#/pair/2b2a4c+e0c097", { settle: 800, keepState: true });
  await t.waitFor(".sp-page .sp-strip, .sp-page .sp-pair", 12000, "the pair page");
  await t.click('[data-cs="learn"]', { force: true, wait: 800 });
  await t.waitFor(".ls-sheet [data-groups] .ls-chip.pin", 6000, "the Study sheet with the pair pinned");
  t.expect(t.$$(".ls-sheet .ls-chip.pin").length === 2, "both colors of the pair are pinned");
  const nb = () => t.$$(".ls-sheet .ls-chip.nb").length;
  t.expect(nb() === 4, `a pair defaults to 2 look-alikes each (${nb()})`);
  const set = v => t.ev(`(() => { const r = document.querySelector('.ls-sheet [data-per]'); r.value = ${v}; r.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  set(0); await t.sleep(150); t.expect(nb() === 0 && t.$$(".ls-sheet .ls-chip.pin").length === 2, "0 neighbors leaves only the pair");
  set(3); await t.sleep(150); t.expect(nb() === 6, `3 each is 6 look-alikes (${nb()})`);
  await t.click(".ls-sheet .ls-chip.nb", { force: true, wait: 200 });
  t.expect(nb() === 5 && t.$$(".ls-sheet .ls-chip.pin").length === 2, "tapping a look-alike removes just it");
  t.expect(t.$(".ls-sheet [data-add]"), "there's a + to add any color");
  await t.click(".ls-sheet [data-go]", { force: true, wait: 900 });
  await t.waitFor(".ls-study .ls-meet", 8000, "Study starts with a Meet card");
  t.expect(/In your set/.test(t.text(".ls-study .ls-meet-tag")), "the first card is a pinned color");
});
scenario("learnset", "Look: every view draws, a tile opens its page", async t => {
  await H.openPage(t, "#/color/teal", "Teal");
  await t.click("[data-learnit]", { wait: 600 });
  await t.waitFor(".ls-sheet", 4000, "Learn it opens the Learn sheet directly");
  await t.click(".ls-sheet [data-look]", { wait: 600 });
  await t.waitFor(".ls-lookscr", 4000, "the Look screen");
  for (const v of ["grid", "strip", "pairs", "map", "art", "carousel"]) {
    await t.click(`.ls-views [data-view="${v}"]`, { wait: 250 });
    t.expect(t.$(`.ls-body[data-view="${v}"]`) && t.$(".ls-body").innerText.length + t.$$(".ls-body [style*='--c'], .ls-body polygon").length > 3, `the ${v} view is empty`);
  }
  await t.click('.ls-views [data-view="grid"]', { wait: 250 });
  await t.click(".ls-tile", { wait: 500 });
  await t.waitFor(".cp-page", 6000, "a color page from a Look tile");
});
scenario("learnset", "Study: a mixed session runs to the results", async t => {
  await H.openPage(t, "#/color/teal", "Teal");
  await t.click("[data-learnit]", { wait: 600 });
  await t.waitFor(".ls-sheet", 4000, "Learn it opens the Learn sheet directly");
  t.ev("(() => { const r = document.querySelector('.ls-sheet [data-size]'); r.value = 4; r.dispatchEvent(new Event('input', { bubbles: true })); })()");
  await t.click(".ls-sheet [data-go]", { wait: 600 });
  await t.waitFor(".ls-study .pr-stage .pr-step", 6000, "the first question");
  const kinds = new Set();
  for (let i = 0; i < 160 && !t.$(".ls-res"); i++) { const k = t.ev(LS_SOLVE); kinds.add(k); await t.sleep(k === "wait" ? 300 : 250); }
  await t.waitFor(".ls-res", 6000, "the Study results");
  t.notes.push("kinds: " + [...kinds].join(","));
  t.expect(kinds.has("qn") && (kinds.has("qc") || kinds.has("odd")), "the session mixed question kinds");
  t.expect(kinds.has("boss"), "the final round came up");
  t.expect(/climbed/.test(t.text(".pr-res-t")), "the results title");
  t.expect(/back tomorrow/.test(t.text(".ls-tmrw")), "the results say the colors come back tomorrow");
  t.expect(t.$$(".ls-res .ls-ring").length >= 1, "each climbed color has a ring for tomorrow");
  t.expect(t.ev("Object.values(S.cards).filter(c => c.from && c.due > today()).length") >= 1, "the Study colors are in spaced review");
  await t.click(".ls-res [data-a=look]", { wait: 500 });
  await t.waitFor(".ls-lookscr", 4000, "Look again from the results");
});
// Lane E (David, 2026-10-09): Learn it opens the Learn sheet with its settings showing (size, closeness, neighbors,
// pace, Look vs Study), seeded with the color + its 3 nearest (the old quick mode's shape) — not straight into
// Study any more. Start is still one tap away and lands on a Meet card.
scenario("learnset", "Color page -> Learn it -> the sheet with settings visible -> Start -> a Meet card", async t => {
  await H.openPage(t, "#/color/teal", "Teal");
  await t.click(".cp-page [data-learnit]", { wait: 400 });
  await t.waitFor(".ls-sheet", 4000, "Learn it opens the Learn sheet instead of starting Study straight away");
  t.expect(t.$(".ls-sheet [data-size]") && t.$(".ls-sheet [data-closeness]"), "the how-many and how-close settings are visible");
  t.expect(t.$$(".ls-sheet [data-pace]").length === 4 && t.$(".ls-sheet [data-pace].on"), "the pace chips (Meet first by default) are visible");
  t.expect(t.$(".ls-sheet [data-look]") && t.$(".ls-sheet [data-go]"), "Look and Study(Start) are both one tap away");
  t.expect(t.$$(".ls-prev i").length === 4, `the seed defaults to the color + 3 nearest (${t.$$(".ls-prev i").length})`);
  await t.click(".ls-sheet [data-go]", { wait: 600 });
  await t.waitFor(".ls-study .ls-meet", 4000, "Start begins Study and lands on a Meet card");
  t.expect(t.$$(".ls-prog i").length === 4, `${t.$$(".ls-prog i").length} colors in Study, expected 4`);
});
// David, 2026-10-09: the Meet run plays as an Instagram-story pager — tap/swipe the right to advance, the left to
// go back — with thin segmented bars standing in for the usual "Next" taps.
scenario("learnset", "Meet plays as a story pager: right taps advance, left taps go back, swipe works too", async t => {
  await H.openPage(t, "#/color/teal", "Teal");
  await t.click("[data-learnit]", { wait: 600 });
  await t.waitFor(".ls-sheet", 4000, "the Learn sheet");
  t.ev("(() => { const r = document.querySelector('.ls-sheet [data-size]'); r.value = 4; r.dispatchEvent(new Event('input', { bubbles: true })); })()");
  await t.click(".ls-sheet [data-go]", { wait: 600 });
  await t.waitFor(".ls-study .ls-story-bars", 6000, "the story's segmented bars over the first Meet card");
  await t.sleep(350);   // past the beat that guards a fast double tap from skipping a card unseen
  const at = () => t.ev("document.querySelector('.ls-study .pr-stage')._lsStory.at()");
  // a tap: pointerdown and pointerup at the same point, x as a fraction of the stage width
  const tap = x => t.ev(`(() => { const s = document.querySelector('.ls-study .pr-stage'); const r = s.getBoundingClientRect();
    const o = { bubbles: true, clientX: r.left + r.width * ${x}, clientY: r.top + r.height / 2, pointerId: 97 };
    s.dispatchEvent(new PointerEvent('pointerdown', o)); s.dispatchEvent(new PointerEvent('pointerup', o)); })()`);
  // a swipe: pointerdown at x0, pointerup at x1, far enough apart to read as a drag rather than a tap
  const swipe = (x0, x1) => t.ev(`(() => { const s = document.querySelector('.ls-study .pr-stage'); const r = s.getBoundingClientRect(), y = r.top + r.height / 2;
    s.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: r.left + r.width * ${x0}, clientY: y, pointerId: 98 }));
    s.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: r.left + r.width * ${x1}, clientY: y, pointerId: 98 })); })()`);
  t.expect(at() === 0, "the story starts on the first card");
  tap(.8); await t.sleep(300);
  t.expect(at() === 1, `a right-side tap advanced the story (at ${at()})`);
  tap(.1); await t.sleep(300);
  t.expect(at() === 0, `a left-side tap went back (at ${at()})`);
  swipe(.8, .1); await t.sleep(300);
  t.expect(at() === 1, `swiping leftward (finger moving toward lower x) advanced the story (at ${at()})`);
  swipe(.1, .8); await t.sleep(300);
  t.expect(at() === 0, `swiping rightward went back (at ${at()})`);
});
// Answer wrong (every other question, so the session can end) and press Next the way an iPhone does: a touch
// pointerdown/pointerup with no click after it (iOS can drop the synthesized click), or the miss compare's Got it.
// David, 2026-10-08: "I'm clicking Next and it's stuck."
const LS_WRONG = `(() => {
  const st = document.querySelector('.ls-study .pr-stage'); if (!st) return 'gone';
  const touch = (b, k) => { const r = b.getBoundingClientRect(), o = { bubbles: true, pointerId: 7 + k, pointerType: 'touch', isPrimary: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
    b.dispatchEvent(new PointerEvent('pointerdown', o)); b.dispatchEvent(new PointerEvent('pointerup', o)); };
  window.__lsN = (window.__lsN || 0) + 1;
  const mc = document.querySelector('.mc:not(.out) .mc-go'); if (mc) { if (window.__lsN % 2) touch(mc, 1); else mc.click(); return 'mc'; }
  const meet = document.querySelector('.ls-study [data-meetnext]'); if (meet) { meet.click(); return 'meet'; }
  const boss = st.querySelector('[data-boss]'); if (boss) { boss.click(); return 'boss'; }
  const nx = st.querySelector('[data-next]'); if (nx) { if (window.__lsN % 2) touch(nx, 2); else nx.click(); return 'next'; }
  const it = st._lsIt, nm = it ? prName(it) : '', wrong = (window.__lsW = !window.__lsW);
  const pick = labels => { const k = labels.findIndex(t => (t === nm) !== wrong); return k < 0 ? 0 : k; };
  if (st.querySelector('.pr-s-match') && st._prMatch) {
    const { tiles } = st._prMatch, btns = [...st.querySelectorAll('.pr-tile')];
    const k = tiles.findIndex((t, i) => !t.sw && !btns[i].classList.contains('gone')); if (k < 0) return 'wait';
    const j = tiles.findIndex(t => t.sw && t.i === tiles[k].i); btns[k].click(); btns[j].click(); return 'match';
  }
  if (st.querySelector('.pr-s-odd')) { const k = st._prOpts.findIndex(o => !o.same); st._prChoose(wrong ? (k + 1) % st._prOpts.length : k); return wrong ? 'oddx' : 'odd'; }
  if (st.querySelector('.pr-s-quiz')) { const b = [...st.querySelectorAll('.pr-opt')]; b[pick(b.map(x => x.textContent.trim()))].click(); return wrong ? 'qnx' : 'qn'; }
  if (st.querySelector('.pr-s-qc')) { const b = [...st.querySelectorAll('.pr-cell')]; b[pick(b.map(x => x.querySelector('.pr-tag').textContent.trim()))].click(); return wrong ? 'qcx' : 'qc'; }
  if (st.querySelector('.pr-s-type input') && !st.querySelector('.pr-typef.done')) { st._prType(wrong ? 'qqqq' : nm); return wrong ? 'typex' : 'type'; }
  if (st.querySelector('.pr-s-card')) { if (!st.querySelector('.pr-card.revealed')) { st._prReveal(); return 'reveal'; } const y = st.querySelector(wrong ? '[data-no]' : '[data-yes]'); if (y) { y.click(); return 'card'; } }
  return 'wait';
})()`;
scenario("learnset", "Study: wrong answers and touch-only Next play a 3-color session to the end", async t => {
  await H.openPage(t, "#/color/teal", "Teal");
  t.ev("window.__lsN = 0; window.__lsW = false");
  await t.click("[data-learnit]", { wait: 600 });
  await t.waitFor(".ls-sheet", 4000, "the Learn sheet");
  t.ev("(() => { const r = document.querySelector('.ls-sheet [data-size]'); r.value = 3; r.dispatchEvent(new Event('input', { bubbles: true })); })()");
  await t.click(".ls-sheet [data-go]", { wait: 600 });
  await t.waitFor(".ls-study", 6000, "the Study screen");
  const seen = [];
  let lastSig = "", same = 0;
  for (let i = 0; i < 260 && !t.$(".ls-res"); i++) {
    const k = t.ev(LS_WRONG); seen.push(k);
    await t.sleep(k === "wait" ? 300 : k === "next" || k === "mc" ? 450 : 300);
    const sig = t.ev("(() => { const s = document.querySelector('.ls-study .pr-stage'); return s ? s.innerHTML.length + '|' + !!s.querySelector('[data-next]') : 'x'; })()");
    if (k === "next" && sig === lastSig && /true$/.test(sig)) { same++; t.expect(same < 2, `Next did nothing (stuck after: ${seen.slice(-8).join(" ")})`); } else same = 0;
    lastSig = sig;
  }
  await t.waitFor(".ls-res", 8000, "the results after a session with misses");
  t.notes.push("steps: " + seen.length + " · " + [...new Set(seen)].join(","));
  t.expect(seen.some(k => /x$/.test(k)), "the session had wrong answers");
  t.expect(seen.includes("next") || seen.includes("mc"), "a Next or Got it was pressed after a miss");
});
scenario("learnset", "Study: new colors are met (a Meet card each, then the closest two) before any question; Test me skips Meet", async t => {
  await H.openPage(t, "#/color/teal", "Teal");
  await t.click("[data-learnit]", { wait: 600 });
  await t.waitFor(".ls-sheet", 4000, "Learn it opens the Learn sheet directly");
  t.expect(t.$$(".ls-sheet [data-pace]").length === 4 && t.$(".ls-sheet [data-pace].on"), "the pace chips, one on");
  t.expect(/new ones? first|Nothing new/.test(t.text(".ls-sheet [data-pacesay]")), "the pace line says what Study will do");
  t.ev("(() => { const r = document.querySelector('.ls-sheet [data-size]'); r.value = 4; r.dispatchEvent(new Event('input', { bubbles: true })); })()");
  await t.click(".ls-sheet [data-go]", { wait: 600 });
  await t.waitFor(".ls-study .ls-meet", 6000, "a Meet card first");
  t.expect(/Meet/.test(t.text(".ls-study [data-status]")), "the status says Meet");
  t.expect(t.$(".ls-meet .ls-meet-n") && t.text(".ls-meet .ls-meet-n").length > 1, "the Meet card names the color");
  t.expect(!t.$(".ls-study .pr-s-quiz, .ls-study .pr-s-qc"), "no question before the colors are met");
  const seen = [];
  for (let i = 0; i < 12 && !t.$(".ls-study .pr-s-quiz, .ls-study .pr-s-qc"); i++) {
    seen.push(t.$(".ls-mpair") ? "pair" : t.$(".ls-meet") ? "meet" : "?");
    await t.waitFor(".ls-study [data-meetnext][data-next]", 3000, "the Meet card's Next");
    await t.click(".ls-study [data-meetnext][data-next]", { wait: 420 });
  }
  t.notes.push(seen.join(" "));
  t.expect(seen.filter(x => x === "meet").length >= 2 && seen.filter(x => x === "meet").length <= 3, `a wave of 2-3 colors is met (${seen.join(" ")})`);
  t.expect(seen.includes("pair"), "the closest two are shown side by side");
  t.expect(t.$(".ls-study .pr-s-quiz, .ls-study .pr-s-qc"), "then the first question");
  // Test me: straight to a question
  t.ev("lsState().pace = 'test'");
  t.ev("lsStudy(lsAlike(prByKey('teal'), 4, 5), { label: 'x' })");
  await t.waitFor(".ls-study .pr-step", 4000, "a Test me session");
  t.expect(!t.$(".ls-study .ls-meet"), "Test me skips Meet");
  t.ev("lsState().pace = 'you'");
});
scenario("learnset", "Study: stop part-way, Keep going picks each color up at its level", async t => {
  await H.openPage(t, "#/color/teal", "Teal");
  await t.click("[data-learnit]", { wait: 600 });
  await t.waitFor(".ls-sheet", 4000, "Learn it opens the Learn sheet directly");
  t.ev("(() => { const r = document.querySelector('.ls-sheet [data-size]'); r.value = 4; r.dispatchEvent(new Event('input', { bubbles: true })); })()");
  await t.click(".ls-sheet [data-go]", { wait: 600 });
  await t.waitFor(".ls-study .pr-stage .pr-step", 6000, "the first question");
  const lvSum = () => t.ev("[...document.querySelectorAll('.ls-prog i')].reduce((s, i) => s + (+i.style.getPropertyValue('--lv') || 0), 0)");
  for (let i = 0; i < 40 && lvSum() < .9; i++) { const k = t.ev(LS_SOLVE); await t.sleep(k === "wait" ? 300 : 250); }
  const before = lvSum();
  t.expect(before > 0, "some colors climbed before stopping");
  await t.click(".ls-study [data-close]", { wait: 500 });
  await t.waitFor(".ls-res", 4000, "the results after stopping");
  t.expect(/back tomorrow/.test(t.text(".ls-tmrw")), "a stopped session still schedules what you answered");
  await t.click(".ls-res [data-a=again]", { wait: 600 });
  await t.waitFor(".ls-study .pr-stage .pr-step", 6000, "Keep going");
  t.expect(Math.abs(lvSum() - before) < .01, `Keep going restarted the levels (${lvSum()} vs ${before})`);
});

// ================================================================== STUDIO
scenario("studio", "gamut wheel: presets, mask, keep, swatch tap", async t => {
  await t.open("#shot=studio", { settle: 600 });
  await t.click("[data-wheel]", { wait: 700 });
  await t.waitFor("canvas.gw-wheel", 6000, "the gamut wheel");
  const presets = t.$$("[data-m]");
  t.expect(presets.length === 7, `${presets.length} mask presets instead of 7`);
  const sw0 = t.$$("i[data-swatch]").map(e => e.dataset.swatch).join();
  for (const p of presets) await t.click(p, { wait: 250 });
  const sw1 = t.$$("i[data-swatch]").map(e => e.dataset.swatch).join();
  t.expect(sw1 && sw1 !== sw0, "changing the mask did not change the palette");
  const mask = t.$("#mask"), r = mask.getBoundingClientRect();
  await t.tapAt(mask, r.left + r.width * .6, r.top + r.height * .4, { wait: 300 });
  if (t.$("[data-names]")) await t.click("[data-names]", { wait: 300 });
  if (t.$("[data-keep]")) await t.click("[data-keep]", { wait: 400 });
  const chip = t.$$("i[data-swatch]").find(e => e.getBoundingClientRect().width > 0);
  t.expect(chip, "no palette swatch to tap");
  await t.click(chip, { force: true, wait: 400 });
  await t.waitFor(".cp-page", 8000, "a color page after tapping a palette swatch");
});

scenario("studio", "camera screen fails gracefully with no camera", async t => {
  await t.open("#shot=studio", { settle: 600 });
  // a Mac with no camera / a refused permission both end in a rejected getUserMedia; make that instant and certain
  t.ev("navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('Requested device not found', 'NotFoundError'))");
  await t.click("[data-eye]", { wait: 500 });
  await t.waitFor(".screen.eye", 6000, "the camera screen");
  await t.waitFor(() => t.$(".screen.eye.nocam") && t.$("#off") && !t.$("#off").hidden, 20000, "the 'no camera' state");
  t.expect(t.$("#off").innerText.length > 5, "the no-camera state has no message");
  if (t.$("#shut")) await t.click("#shut", { force: true, wait: 200 });
  if (t.$("#file2")) t.expect(t.$("#file2"), "no photo picker offered without a camera");
  await t.click("[data-back]", { wait: 500 });
  await t.waitFor('.room-sheet[data-room="studio"], .screen.studio', 6000, "Studio after Back");
});

scenario("studio", "photo palette: controls work and a chip opens its page", async t => {
  await t.open("#shot=studiopv", { settle: 900 });
  await t.waitFor("i[data-swatch]", 8000, "the photo palette chips");
  const n0 = t.$$("i[data-swatch]").length;
  const btns = t.$$("button[data-n]");
  const other = btns.find(b => !b.classList.contains("on"));
  if (other) { await t.click(other, { wait: 400 }); }
  for (const b of t.$$("button[data-look]").filter(b => !b.classList.contains("on"))) await t.click(b, { wait: 300 });
  const pct = t.$("button[data-pct]"); if (pct) await t.click(pct, { wait: 300 });
  t.expect(t.$$("i[data-swatch]").length >= 3, `only ${t.$$("i[data-swatch]").length} chips after changing the controls (was ${n0})`);
  const chip = t.$$("i[data-swatch]").find(e => e.getBoundingClientRect().width > 0);
  await t.click(chip, { force: true, wait: 400 });
  await t.waitFor(".cp-page", 8000, "a color page after tapping a photo-palette chip");
  await H.back(t);
  t.expect(!t.$(".cp-page"), "Back left the color page open");
  t.expect(t.$("#app").innerText.length > 60, "Back from the color page landed on an empty screen");
});

// ---- L13 Studio: Name any color, the Isolator, the Export sheet, Closest in the archive ----
scenario("studio", "Name any color: tabs, drag, save, a name opens its page", async t => {
  await t.open("#/studio/namer?c=5F8C8A", { settle: 600 });
  await t.waitFor(".nmr-hero", 8000, "the namer");
  const n0 = t.text("#name");
  t.expect(n0.length > 2 && t.$$(".nmr-row").length === 4, "the namer shows a name and four next names");
  for (const k of ["plane", "field", "type", "eye", "ring"]) { await t.click(`[data-tab='${k}']`, { force: true, wait: 350 }); t.expect(t.$("#pane").children.length, `the ${k} tab is empty`); }
  await t.click("[data-tab='type']", { force: true, wait: 300 });
  const hx = t.$("#hx"); hx.value = "#C8553D"; hx.dispatchEvent(new t.w.Event("input", { bubbles: true }));
  await t.waitFor(() => t.text("#name") !== n0, 6000, "the name to follow a typed hex");
  await t.click("#acts [data-save]", { force: true, wait: 300 });
  t.expect(t.$$(".nmr-chips button").length === 1, "Save did not add the color to the tray");
  await t.click(".nmr-row", { force: true, wait: 500 });
  await t.waitFor(".cp-page", 8000, "a color page after tapping a near name");
  await H.back(t);
  await t.waitFor(".nmr-hero", 6000, "the namer again after Back");
  await t.click("[data-back]", { force: true, wait: 700 });
  await t.waitFor(() => !t.$(".nmr-hero") && t.$("#app").innerText.length > 60, 6000, "a room after Back from the namer (opened by address, so it falls back to the current room)");
});

// Eyedrop (js/namer.js), a photo: a kept find used to go nowhere -- typeof hmDismissHint-style six-function rot,
// here js/learner.js's learnerLog was simply never called. A Save on an Eyedrop pick now logs a "find" (color,
// src "photo"), the same Learner Model event the camera screen (js/camera.js) logs on a tapped name.
scenario("studio", "Name any color, Eyedrop tab: a kept photo find logs to the Learner Model", async t => {
  await t.open("#/studio/namer?c=5F8C8A", { settle: 600 });
  await t.waitFor(".nmr-hero", 8000, "the namer");
  await t.click("[data-tab='eye']", { force: true, wait: 300 });
  await t.waitFor("#ef", 4000, "the Eyedrop tab's photo picker");
  const n0 = (t.ev("S.learn && S.learn.ev ? S.learn.ev.length : 0")) || 0;
  // a tiny 1x1 PNG, so the test needs no real photo, camera permission or network image
  await t.ev(`(async () => {
    const r = await fetch("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=");
    const b = await r.blob(), f = new File([b], "swatch.png", { type: "image/png" }), dt = new DataTransfer();
    dt.items.add(f); document.getElementById("ef").files = dt.files;
    document.getElementById("ef").dispatchEvent(new Event("change", { bubbles: true }));
  })()`);
  await t.waitFor(() => t.$("#ecv") && t.$("#ecv").width > 0, 6000, "the chosen photo to draw into the Eyedrop canvas");
  await t.sleep(200);
  await t.click("#acts [data-save]", { force: true, wait: 300 });
  t.expect(t.$$(".nmr-chips button").length >= 1, "Save did not add the color to the tray");
  const ev = t.ev("S.learn.ev") || [];
  t.expect(ev.length > n0, "no new Learner Model event after the save");
  const find = ev.slice(n0).find(e => e.e === "find" && e.src === "photo");
  t.expect(find, `the new event(s) ${JSON.stringify(ev.slice(n0))} don't include a "find" with src "photo"`);
});

scenario("home", "View sheet: the picker icon opens Name any color", async t => {
  await t.open("#shot=home:views", { settle: 1500 });
  await t.waitFor("[data-namer]", 8000, "the picker icon in the View sheet");
  await t.click("[data-namer]", { force: true, wait: 800 });
  await t.waitFor(".nmr-hero", 6000, "Name any color from Home");
});

scenario("studio", "Isolator: guess, reveal alone, hold to see it back, try another", async t => {
  await t.open("#shot=studiopv", { settle: 900 });
  const img = await t.waitFor(() => { const i = t.$(".pv-img img"); return i && i.complete && i.naturalWidth ? i : null; }, 8000, "the photo");
  const r = img.getBoundingClientRect();
  img.dispatchEvent(new t.w.MouseEvent("click", { bubbles: true, clientX: r.left + r.width * .5, clientY: r.top + r.height * .5, view: t.w }));
  await t.waitFor(".iso .iso-opts button", 6000, "the four options");
  t.expect(t.$$(".iso-opts button").length >= 3, "fewer than three options");
  await t.click(".iso-opts button", { force: true, wait: 700 });
  await t.waitFor(".iso.isolated .iso-name", 4000, "the reveal");
  const f = t.$("#isoFrame"), fr = f.getBoundingClientRect(), w = t.w, o = { bubbles: true, cancelable: true, clientX: fr.left + 30, clientY: fr.top + 30, pointerId: 1, pointerType: "touch", isPrimary: true, view: w };
  f.dispatchEvent(new w.PointerEvent("pointerdown", o)); await t.sleep(450);
  t.expect(t.$(".iso.peek"), "holding the picture did not bring the surroundings back");
  f.dispatchEvent(new w.PointerEvent("pointerup", o)); await t.sleep(300);
  t.expect(!t.$(".iso.peek"), "letting go did not isolate again");
  await t.click("[data-again]", { force: true, wait: 400 });
  t.expect(t.$(".iso-opts"), "Try another spot did not ask again");
  await t.click("[data-iso-close]", { force: true, wait: 300 });
  t.expect(!t.$(".iso"), "the Isolator did not close");
});

scenario("studio", "Export sheet opens and Closest in the archive switches metric", async t => {
  await t.open("#shot=studiopv", { settle: 900 });
  await t.waitFor("[data-export]", 8000, "the Export button");
  await t.click("[data-export]", { force: true, wait: 500 });
  await t.waitFor(".ex-sheet [data-ex-copy='css']", 4000, "the Export sheet");
  t.expect(t.$$(".ex-sheet [data-ex-row]").length === 6, "the sheet should list six formats");
  await t.click(".ex-sheet [data-ex-tints]", { force: true, wait: 200 });
  t.$("#twins").scrollIntoView();
  await t.waitFor(".tw-card", 20000, "the closest paintings");
  t.expect(t.$$(".tw-chips button").length >= 6, "the metric chips are missing");
  for (const m of ["dominant", "mood", "light"]) {
    await t.click(`.tw-chips [data-m='${m}']`, { force: true, wait: 300 });
    await t.waitFor(() => t.$(".tw-out .tw-card .tw-why"), 25000, `results for ${m}`);
    t.expect(t.text(".tw-why").length > 12, `${m}: a result has no reason`);
  }
});

// ================================================================== YOUR COLORS (L23: favorites, ranking, taste)
scenario("favs", "Home pick mode: tap and hold-sweep heart colors, Save keeps them", async t => {
  const cv = await H.homeReady(t);
  await H.menu(t, "fav");
  await t.waitFor(".fv-bar", 4000, "the pick bar");
  const count = () => +t.text(".fv-count b");
  t.expect(count() === 0, "pick mode starts with picks already made");
  const r = cv.getBoundingClientRect(), o = (x, y) => ({ bubbles: true, cancelable: true, clientX: r.left + x, clientY: r.top + y, pointerId: 5, pointerType: "touch", isPrimary: true, view: t.w });
  await t.tapAt(cv, r.left + r.width / 2, r.top + r.height / 2, { wait: 300 });
  t.expect(count() === 1, `a tap should heart one bubble (count ${count()})`);
  // hold still, then drag across a run
  cv.dispatchEvent(new t.w.PointerEvent("pointerdown", o(r.width * .25, r.height * .72)));
  await t.sleep(420);
  for (const x of [.32, .4, .5, .6, .7]) { cv.dispatchEvent(new t.w.PointerEvent("pointermove", o(r.width * x, r.height * .72))); await t.sleep(40); }
  cv.dispatchEvent(new t.w.PointerEvent("pointerup", o(r.width * .7, r.height * .72)));
  await t.sleep(300);
  t.expect(count() >= 4, `hold-then-drag should sweep a run (count ${count()})`);
  const n = count();
  await t.click(".fv-save", { wait: 400 });
  t.expect(t.ev("fvCount()") === n, `Save kept ${t.ev("fvCount()")} colors, expected ${n}`);
  t.expect(t.$(".fv-bar[data-mode=saved]"), "no saved state after Save");
  await t.click("[data-shelf]", { wait: 800 });
  await t.waitFor(".fv-shelf .fv-top5", 6000, "the shelf after Save");
});

scenario("favs", "shelf: top five, a plate opens its page, Back returns, a row heart removes with Undo", async t => {
  await t.open("#shot=favs:shelf", { settle: 900 });
  await t.waitFor(".fv-shelf .fv-top5 .fv-plate", 6000, "the shelf");
  t.expect(t.$$(".fv-top5 .fv-plate").length === 5, "the shelf should show a top five");
  t.expect(t.$("#fvHero canvas"), "no honeycomb of your colors");
  await t.click(".fv-top5 .fv-plate", { wait: 500 });
  await t.waitFor(".cp-page", 8000, "a color page from the top plate");
  t.expect(t.$("[data-fv-chip]") && !t.$("[data-fv-chip]").hidden, "the page doesn't show your rank for a favorite");
  await H.back(t);
  await t.waitFor(".fv-shelf", 6000, "the shelf after Back");
  const n = t.ev("fvCount()");
  await t.click(".fv-un", { wait: 700 });
  t.expect(t.ev("fvCount()") === n - 1, "the row heart didn't remove the color");
  const undo = t.$(".fv-toast button"); t.expect(undo, "no Undo after removing");
  await t.click(undo, { wait: 700 });
  t.expect(t.ev("fvCount()") === n, "Undo didn't bring the color back");
  // the share card draws without throwing (the real share sheet is replaced by a canvas run)
  t.ev("window.__card = false; window.tzShareCanvas = d => { const c = document.createElement('canvas'); c.width = 1080; c.height = 1350; d(c.getContext('2d')); window.__card = true; }");
  await t.click("[data-share]", { wait: 300 });
  t.expect(t.ev("window.__card"), "the My colors card didn't draw");
  // the verbs: Learn opens a deck (and Close comes back), Keep saves a palette, the primary opens a ranking screen, On the map opens Home
  await t.click("[data-cs=learn]", { wait: 600 });
  // Learn now opens Practice's quick sheet (prInstantDeck) first: start it, then a deck or a Practice run appears
  await t.waitFor(".screen.deck, [data-qgo], .screen.pr-play", 6000, "the Learn sheet or deck");
  if (t.ev("!!document.querySelector('[data-qgo]')")) await t.click("[data-qgo] [data-go]", { wait: 600 });
  await t.waitFor(".screen.deck, .screen.pr-play, .screen.learnit, .screen.pr-say-intro, .screen.meet", 6000, "the Learn my favorites deck");
  await t.click("[data-close]", { wait: 500 });
  await t.waitFor(".fv-shelf", 6000, "the shelf after closing the deck");
  await t.click("[data-go]", { wait: 500 });
  await t.waitFor(".screen.fv-run", 6000, "a ranking screen");
  await t.click("[data-close]", { wait: 500 });
  await t.waitFor(".fv-shelf", 6000, "the shelf after closing the ranking");
  await t.click("[data-cs=map]", { wait: 900 });
  await t.waitFor(".hm canvas", 15000, "Home with your colors lit");
});

scenario("favs", "best of three: keep one, drop one, a new set arrives; Undo takes it back", async t => {
  await t.open("#shot=favs:rank:bws", { settle: 700 });
  await t.waitFor(".fv-tri .fv-p", 6000, "three plates");
  const c0 = t.ev("fvChoices('all')"), first = t.$$(".fv-tri .fv-p").map(p => p.dataset.k).join();
  await t.click(".fv-tri .fv-p:nth-child(1)", { wait: 300 });
  t.expect(t.$(".fv-tri .fv-p.kept"), "keeping a plate showed no heart");
  await t.click(".fv-tri .fv-p:nth-child(3)", { wait: 900 });
  t.expect(t.ev("fvChoices('all')") === c0 + 2, `two taps should add two choices (${c0} to ${t.ev("fvChoices('all')")})`);
  t.expect(t.$$(".fv-tri .fv-p").length === 3, "no new set of three");
  await t.click("[data-undo]", { wait: 500 });
  t.expect(t.ev("fvChoices('all')") === c0, "Undo didn't restore the choice count");
  t.expect(t.$$(".fv-tri .fv-p").map(p => p.dataset.k).join() === first, "Undo didn't bring the same set back");
});

scenario("favs", "tier board, swipe stack, ten drops and drag-to-order each take input and end on the summary", async t => {
  await t.open("#shot=favs:rank:tiers", { settle: 700 });
  await t.waitFor(".fv-chip", 6000, "the tier chips");
  const k0 = t.$$(".fv-chip").length;
  await t.click(".fv-chip", { pointer: true, wait: 200 });
  await t.click(".fv-tier[data-t='0']", { wait: 500 });
  t.expect(t.$$(".fv-chip").length === k0 - 1 && t.$$(".fv-tier[data-t='0'] .fv-dot").length === 1, "tap a chip, tap a tier: the color didn't land in Love");
  await t.click(".fv-tier .fv-dot", { wait: 400 });
  t.expect(t.$$(".fv-chip").length === k0, "tapping a placed dot didn't take it back");
  await t.open("#shot=favs:rank:swipe", { settle: 700 });
  await t.waitFor(".fv-card", 6000, "the swipe card");
  for (let i = 0; i < 20 && t.$(".fv-card"); i++) { await t.click(i % 2 ? "[data-no]" : "[data-yes]", { force: true, wait: 450 }); }
  await t.waitFor(".fv-settle", 8000, "the summary after the stack");
  await t.open("#shot=favs:rank:budget", { settle: 700 });
  await t.waitFor("[data-add]", 6000, "the budget plates");
  for (let i = 0; i < 10; i++) await t.click("[data-add]", { force: true, wait: 120 });
  t.expect(t.text("#frLeft") === "0", "ten drops didn't spend to zero");
  await t.click("[data-go]", { force: true, wait: 600 });
  await t.waitFor(".fv-settle", 6000, "the summary after the drops");
  await t.open("#shot=favs:rank:order", { settle: 700 });
  await t.waitFor(".fv-or", 6000, "the order rows");
  await t.click("[data-go]", { force: true, wait: 600 });
  await t.waitFor(".fv-settle", 6000, "the summary after ordering");
  await t.click("[data-again]", { force: true, wait: 600 });
});

scenario("favs", "taste profile: findings, the painter match and a palette from the top five", async t => {
  await t.open("#shot=favs:taste", { settle: 900 });
  await t.waitFor(".fp-find", 10000, "the findings");
  t.expect(t.$$(".fp-find").length >= 3, "fewer than three findings");
  t.expect(/lean|spans/.test(t.text(".fp-lead")), "no headline sentence");
  await t.waitFor(".fp-painter", 10000, "the painter match");
  const n = t.ev("(S.palettes||[]).length");
  await t.click("[data-pal]", { wait: 800 });
  t.expect(t.ev("(S.palettes||[]).length") === n + 1, "no palette saved from the top five");
});

// ================================================================== MAP (L18: the honeycomb build)
const L18M = {
  // Home on a big stage, zoomed all the way out
  async farOut(t, src = "every-name") {
    await H.homeReady(t);
    t.ev(`S.hm.src = ${JSON.stringify(src)}; S.hm.filter = "all"; hmHome();`);
    // the old Home crossfades out: wait until only the new one (and its canvas) is left
    await t.waitFor(() => t.$$(".screen.hm").length === 1 && H.num(t.text(".hm-title small")) > 500, 10000, "the big stage to fill");
    await t.sleep(300);
    t.ev("HM_CTRL.zoom(0.01, false)");
    await t.sleep(300);
    return t.$(".screen.hm canvas");
  },
};
scenario("map", "zoomed out: a tap zooms onto a tiny bubble, the next tap opens it", async t => {
  const cv = await L18M.farOut(t);
  t.expect(t.ev("HM_CTRL.isZoomedOut()"), `the map is not zoomed out (zoom ${t.ev("HM_CTRL.zoomValue()")})`);
  const z0 = t.ev("HM_CTRL.zoomValue()"), r = cv.getBoundingClientRect();
  await t.tapAt(cv, r.left + r.width / 2 + 70, r.top + r.height / 2 + 50, { wait: 300 });
  t.expect(!t.$(".cp-page"), "the first tap on a tiny bubble opened a page");
  await t.waitFor(() => t.ev("HM_CTRL.zoomValue()") > z0 * 1.5, 3000, "the zoom to change after the tap").catch(() => {});
  // under heavy machine load a first synthetic tap can land between frames; one more tap on another tiny bubble
  if (t.ev("HM_CTRL.zoomValue()") <= z0 * 1.5) { t.notes.push("second tap"); await t.tapAt(cv, r.left + r.width / 2 - 60, r.top + r.height / 2 + 70, { wait: 600 }); }
  const z1 = t.ev("HM_CTRL.zoomValue()");
  t.expect(z1 > z0 * 1.5 && !t.ev("HM_CTRL.isZoomedOut()"), `the tap did not zoom in (${z0.toFixed(2)} > ${z1.toFixed(2)})`);
  t.notes.push(`zoom ${z0.toFixed(2)} > ${z1.toFixed(2)}`);
  await t.tapAt(cv, r.left + r.width / 2, r.top + r.height / 2, { wait: 500 });
  await t.waitFor(".cp-page", 8000, "a page on the second tap");
});
scenario("map", "stage glide: no overlap at a quarter, half and three quarters of the way", async t => {
  await H.homeReady(t);
  const res = [];
  for (const n of [250, 50, 1000]) {
    const r = t.ev(`HM_CTRL._morphCheck(hmStageItems(${n}))`);
    t.expect(r.ok, `glide to ${n}: ${JSON.stringify(r)}`);
    res.push(`${n}: ${r.out.map(o => o.drawn).join("/")}`);
  }
  t.notes.push(res.join(", "));
});
scenario("map", "search 2.0: a hex and a modifier fly; a decade, a painter and a road light up", async t => {
  const ask = async q => {
    if (t.$("#hmSearch").hidden) t.ev("document.querySelector('#hmView') && 0"), t.$("#hmSearch").hidden = false;
    const inp = t.$("#hmq"); inp.focus(); inp.value = q; inp.dispatchEvent(new t.w.Event("input", { bubbles: true }));
    await t.waitFor(() => !t.$("#hmqHint").hidden, 15000, `a hint for "${q}"`);
    const hint = t.text("#hmqHint");
    inp.dispatchEvent(new t.w.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await t.sleep(500);
    return hint;
  };
  await H.homeReady(t);
  // the pull-down opens the field
  const cv = t.$(".screen.hm canvas"), r = cv.getBoundingClientRect(), o = y => ({ bubbles: true, cancelable: true, clientX: r.left + r.width / 2, clientY: r.top + y, pointerId: 7, pointerType: "touch", isPrimary: true, view: t.w });
  cv.dispatchEvent(new t.w.PointerEvent("pointerdown", o(40)));
  for (const y of [60, 80, 100, 130]) { cv.dispatchEvent(new t.w.PointerEvent("pointermove", o(y))); await t.sleep(20); }
  cv.dispatchEvent(new t.w.PointerEvent("pointerup", o(130)));
  await t.sleep(200);
  t.expect(!t.$("#hmSearch").hidden, "a pull down from the top did not open search");
  let h = await ask("#2A6F77");
  t.expect(/Fly to/.test(h) && /≈/.test(t.text(".toast")), `hex: hint "${h}", toast "${t.text(".toast")}"`);
  h = await ask("deep celadon");
  t.expect(/≈/.test(t.text(".toast")), `deep celadon: no "≈" toast (hint "${h}")`);
  h = await ask("1660s");
  await t.waitFor(".cs-hl-pill", 15000, "the 1660s constellation");
  t.expect(/1660s · [\d,]+ paintings · as photographed/.test(t.text(".cs-hl-pill")), `decade pill says "${t.text(".cs-hl-pill")}"`);
  await H.homeReady(t);
  h = await ask("sargent");
  await t.waitFor(() => /Sargent/.test(t.text(".cs-hl-pill")), 15000, "Sargent's constellation");
  await H.homeReady(t);
  h = await ask("between teal and navy");
  await t.waitFor(() => /Between Teal and Navy/i.test(t.text(".cs-hl-pill")), 15000, "the road constellation");
});
scenario("map", "On the map: a painting page lights its colors on Home; #/map/gallery/<i> does the same", async t => {
  await H.homeReady(t); t.ev("openRoute('#/painting/starry-night')");   // shot mode: placed, so Home is the floor
  const b = await t.waitFor("[data-cs=map]", 12000, "the On the map button on a painting page");
  await t.click(b, { force: true, wait: 900 });
  await t.waitFor(() => /as photographed/.test(t.text(".cs-hl-pill")), 15000, "the painting's constellation on Home");
  t.notes.push(t.text(".cs-hl-pill"));
  await H.homeReady(t); t.ev("openRoute('#/map/gallery/3')");
  await t.waitFor(() => /named colou?rs? · as photographed/.test(t.text(".cs-hl-pill")), 20000, "a museum painting's constellation from its address");
  // How many: the measured pool, not a fixed six; the lit set and the named chips follow the slider
  const nIn = t.$$(".cs-hl-n input").pop();
  t.expect(nIn && +nIn.max > 6, "a museum painting on the map has no How many slider over its pool");
  nIn.value = 12; nIn.dispatchEvent(new t.w.Event("input", { bubbles: true })); nIn.dispatchEvent(new t.w.Event("change", { bubbles: true }));
  await t.waitFor(() => { const bs = t.$$(".cs-hl-bar"), bb = bs[bs.length - 1]; return bb && bb.querySelectorAll(".cs-hl-c").length === t.ev("HONEY_HL.hexes.length") && t.ev("HONEY_HL.hexes.length") > 6; }, 4000, "the named chips to follow the How many slider").catch(() => {});
  const bars = t.$$(".cs-hl-bar"), bar = bars[bars.length - 1], lit = t.ev("HONEY_HL.hexes.length"), chips = bar.querySelectorAll(".cs-hl-c").length;
  t.expect(lit > 6 && lit <= 12 && chips === lit, `How many 12 lit ${lit} colors and named ${chips}`);
  t.expect(/%/.test(bar.querySelector(".cs-hl-c").textContent), "the named chips don't say their share of the canvas");
});
scenario("map", "panning keeps the resting seams, and fast pans and pinches at every size never blank the canvas", async t => {
  const cv = await H.homeReady(t), r = cv.getBoundingClientRect();
  const o = (x, y, id = 9) => ({ bubbles: true, cancelable: true, clientX: r.left + x, clientY: r.top + y, pointerId: id, pointerType: "touch", isPrimary: id === 9, view: t.w });
  await t.sleep(300);
  const rest = t.ev("HM_CTRL._gapStat()");
  // a slow drag, one move a frame: the seams while moving match the seams at rest (David: gaps too big while panning)
  cv.dispatchEvent(new t.w.PointerEvent("pointerdown", o(200, 500)));
  let worst = 0;
  for (let i = 1; i <= 24; i++) { cv.dispatchEvent(new t.w.PointerEvent("pointermove", o(200 - i * 4, 500 - i * 6))); await t.sleep(16); if (i > 6) worst = Math.max(worst, t.ev("HM_CTRL._gapStat()").gap); }
  cv.dispatchEvent(new t.w.PointerEvent("pointerup", o(104, 356)));
  t.expect(worst <= rest.gap + 1.2, `seams while panning ${worst}px, at rest ${rest.gap}px`);
  t.notes.push(`seam rest ${rest.gap}px, panning ≤ ${worst}px`);
  // stress: the biggest sets, zoomed out and in, flung fast and pinched
  for (const src of ["stage:1000", "every-name"]) {
    t.ev(`S.hm.src = "${src}"; S.hm.filter = "all"; hmHome();`);
    await t.waitFor(() => t.$$(".screen.hm").length === 1 && H.num(t.text(".hm-title small")) > 500, 15000, `${src} to fill`);
    const c2 = t.$(".screen.hm canvas");
    for (const z of [0.01, 1, 2.5]) {
      t.ev(`HM_CTRL.zoom(${z}, false)`);
      c2.dispatchEvent(new t.w.PointerEvent("pointerdown", o(180, 400)));
      for (let i = 1; i <= 30; i++) c2.dispatchEvent(new t.w.PointerEvent("pointermove", o(180 + (i % 2 ? 1 : -1) * i * 9, 400 - i * 11)));
      c2.dispatchEvent(new t.w.PointerEvent("pointerup", o(180, 70)));
      c2.dispatchEvent(new t.w.PointerEvent("pointerdown", o(150, 400)));
      c2.dispatchEvent(new t.w.PointerEvent("pointerdown", o(230, 400, 10)));
      for (let i = 1; i <= 20; i++) { c2.dispatchEvent(new t.w.PointerEvent("pointermove", o(150 - i * 3 + (i % 3), 400 + (i % 2)))); c2.dispatchEvent(new t.w.PointerEvent("pointermove", o(230 + i * 3, 400 - (i % 2), 10))); }
      c2.dispatchEvent(new t.w.PointerEvent("pointerup", o(90, 400, 10))); c2.dispatchEvent(new t.w.PointerEvent("pointerup", o(90, 400)));
      const st = t.ev("HM_CTRL._gapStat()");
      t.expect(st.n > 6 && st.w > 0 && st.h > 0, `${src} at zoom ${z}: ${JSON.stringify(st)}`); t.notes.push(`${src}@${z}: ${st.n} drawn, seam ${st.gap}/${st.p90}`);
    }
  }
});
scenario("map", "the map keeps its pan and zoom when you open a color and come back", async t => {
  const cv = await H.homeReady(t), r = cv.getBoundingClientRect();
  const o = (x, y) => ({ bubbles: true, cancelable: true, clientX: r.left + x, clientY: r.top + y, pointerId: 11, pointerType: "touch", isPrimary: true, view: t.w });
  cv.dispatchEvent(new t.w.PointerEvent("pointerdown", o(200, 520)));
  for (let i = 1; i <= 12; i++) { cv.dispatchEvent(new t.w.PointerEvent("pointermove", o(200 - i * 9, 520 - i * 7))); await t.sleep(16); }
  await t.sleep(200);
  cv.dispatchEvent(new t.w.PointerEvent("pointerup", o(92, 436)));
  await t.sleep(400);
  t.ev("HM_CTRL.zoom(0.8, false)");
  const before = t.ev("HM_CTRL.panValue()"), name = t.ev("HM_CTRL.current().n");
  t.ev("hmOpenColor(ALL[3])");
  await t.waitFor(".cp-page", 8000, "a color page");
  await H.back(t);
  await t.waitFor(() => t.$$(".screen.hm canvas").length === 1, 8000, "Home again");
  const after = t.ev("HM_CTRL.panValue()");
  t.expect(Math.hypot(after[0] - before[0], after[1] - before[1]) < .6 && Math.abs(after[2] - before[2]) < .02, `pan/zoom reset: ${before.map(v => v.toFixed(2))} -> ${after.map(v => v.toFixed(2))}`);
  t.expect(t.ev("HM_CTRL.current().n") === name, `the middle changed from ${name} to ${t.ev("HM_CTRL.current().n")}`);
});
// David, 2026-10-08 ("clicking a color makes it stick"): after a few taps and Backs, big unlabeled bubbles stayed stuck
// over the map and the map came back off-center. Three opens in a row, each one a far bubble tapped again mid-glide
// (taps open at once), with Back between: no stand-in bubble or flying chip is left anywhere, and Home comes back
// centered on a bubble, not on a half-way pan.
scenario("map", "three bubble taps with Back between leave no stuck bubble and Home re-centers", async t => {
  let cv = await H.homeReady(t);
  const leftovers = () => t.$$(".hc-morph, .flyer").length;
  const onLattice = () => t.ev(`(() => { const [x, y] = HM_CTRL.panValue(), sp = HM_CTRL.studyPoints(); return sp.pts.reduce((m, p) => Math.min(m, Math.hypot(p.x - x, p.y - y)), 1e9); })()`);
  for (let i = 0; i < 3; i++) {
    cv = t.$(".screen.hm canvas");
    const r = cv.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    // a bubble outside the open zone (it glides to the middle first), a different one each round
    const far = t.ev(`(() => { const seen = new Set(), out = []; for (const p of HM_CTRL.studyPoints().pts) { const h = p.o.h; if (seen.has(h)) continue; seen.add(h);
      const l = HM_CTRL.locate(h); if (!l || l.d < 34) continue; const d = Math.hypot(l.x - ${cx}, l.y - ${cy}); if (d > 130 && d < 230) out.push({ h, n: p.n, d }); }
      return out.sort((a, b) => a.d - b.d)[${i}] || null; })()`);
    t.expect(far, `round ${i + 1}: no bubble outside the open zone to tap`);
    let at = t.ev(`HM_CTRL.locate(${JSON.stringify(far.h)})`);
    await t.tapAt(cv, at.x, at.y, { wait: 40 });   // starts the glide
    at = t.ev(`HM_CTRL.locate(${JSON.stringify(far.h)})`) || at;
    await t.tapAt(cv, at.x, at.y, { wait: 60 });   // the same bubble again, mid-glide: it opens
    if (!t.$("[data-back]")) { await t.tapAt(cv, cx, cy, { wait: 60 }); }   // (a slow frame finished the glide: the middle one opens)
    await t.waitFor("[data-back]", 8000, `round ${i + 1}: a page for ${far.n}`);
    t.expect(!t.$(".hc-morph"), `round ${i + 1}: the tapped bubble's stand-in stayed on the page`);
    await t.click("[data-back]", { wait: 80 });   // Back at once, while the page may still be flying in
    await t.waitFor(() => t.$$(".screen.hm canvas").length === 1, 8000, `round ${i + 1}: Home again`);
    await t.sleep(1000);
    t.expect(leftovers() === 0, `round ${i + 1}: ${leftovers()} stuck bubble(s) over Home after Back`);
    const off = onLattice();
    t.expect(off < .05, `round ${i + 1}: Home came back off-center (${off.toFixed(2)} from the nearest bubble)`);
  }
  t.notes.push("3 opens mid-glide, no leftovers, centered on return");
});
scenario("map", "one right corner: its menu holds every verb, and closes on a tap outside, Escape and Back", async t => {
  await H.homeReady(t);
  t.expect(t.$$(".screen.hm .corner").length === 2, `${t.$$(".screen.hm .corner").length} corner buttons on Home`);
  t.expect(!t.$("#hmMapStudy, [data-pr-study], #hmFav, #hmView"), "a verb still has its own button on Home");
  await H.menu(t);
  const rows = t.$$(".hm-do-stem [data-do]").map(b => b.dataset.do);
  for (const k of ["learn", "map", "fav", "search", "colors", "arrange"]) t.expect(rows.includes(k), `the menu has no ${k}`);
  t.expect(t.$$(".hm-do-stem [data-do]").every(b => t.text(b.querySelector("b")).length > 2), "a menu row has no label");
  t.$(".rm-scrim").dispatchEvent(new t.w.PointerEvent("pointerdown", { bubbles: true, cancelable: true }));
  await t.sleep(450);
  t.expect(!t.$(".hm-do-stem") && t.$("#hmDo").getAttribute("aria-expanded") === "false", "a tap outside did not close the menu");
  await H.menu(t);
  await H.keys(t, "Escape"); await t.sleep(400);
  t.expect(!t.$(".hm-do-stem"), "Escape did not close the menu");
  await H.menu(t, "map");
  await t.waitFor(".ms", 8000, "Study the map from the menu");
  t.expect(!t.ev("'famNames' in S.hm && S.hm.famNames"), "the family names setting is back");
});


// ================================================================== LEARN (past the first units: js/learnmore.js)
scenario("learn", "the path goes past the first units: Begin teaches a generated unit as core cards", async t => {
  await t.open("#shot=lx:room", { settle: 600 });
  await t.waitFor(".lx-words .lx-bar-fill", 10000, "the Your words bar");
  t.expect(/Next stop · 150 words/.test(t.text(".lx-words-head")), `the bar names the next stop ("${t.text(".lx-words-head")}")`);
  t.expect(!/the 101|\/101/.test(t.text("#app")), "the Learn room mentions the 101");
  const before = t.ev("Object.keys(S.cards).filter(k => k.startsWith('core:')).length");
  await t.click("[data-learn]", { wait: 600 });
  await t.waitFor("#pager", 6000, "the meet pager for the generated unit");
  t.expect(/Unit \d+ · to /.test(t.text("#pager .eyebrow")), `the unit label ("${t.text("#pager .eyebrow")}")`);
  const pager = t.$("#pager");
  pager.scrollTop = pager.scrollHeight; await t.tick(); await t.sleep(300);
  await t.click("[data-go]", { wait: 600 });
  await t.waitFor(".deck .card", 6000, "the swipe deck");
  for (let i = 0; i < 60 && !t.$(".result"); i++) {
    const rev = t.$("[data-reveal]"); if (rev) await t.click(rev, { wait: 60 });
    const yes = t.$("[data-yes]"); if (yes) await t.click(yes, { wait: 350 }); else await t.sleep(150);
  }
  await t.waitFor(".result", 6000, "the unit-done screen");
  const after = t.ev("Object.keys(S.cards).filter(k => k.startsWith('core:') && S.cards[k].n && S.cards[k].h).length");
  t.expect(after >= before + 4, `the unit's colors became core:<slug> cards with their own name and hex (${before} -> ${after})`);
  const bet = t.$(".lx-bet-b[data-n='2']"); t.expect(bet, "the bet-on-tomorrow row");
  await t.click(bet, { wait: 200 });
  t.expect(t.ev("!!(S.bets && S.bets[today()] && S.bets[today()].n === 2)"), "the bet was kept");
  await t.click("[data-next]", { wait: 600 });
  await t.waitFor("#pager", 6000, "the next generated unit");
});
scenario("learn", "Learn it opens on a name past the first units", async t => {
  await t.open("#/name/chestnut", { settle: 600 });
  await t.waitFor(".cp-page [data-learnit]", 10000, "Learn it on the Chestnut name page");
  await t.click("[data-learnit]", { wait: 600 });
  await t.waitFor(".pr-quick [data-method='lesson']", 6000, "Learn it opens the Learn sheet directly, offering the full lesson for a name past the first units");
  await t.click("[data-method='lesson']", { wait: 700 });
  await t.waitFor("#ltPager", 6000, "the Learn it meet pager");
  t.expect(t.$$("#ltPager .lt-page").length >= 3, "the group has look-alikes from the ~1,000 names");
  await t.click("[data-lt-x]", { wait: 600 });
  await t.waitFor(".cp-page", 6000, "back on the name page after closing");
});
scenario("learn", "Edges: tap a step, every step gets its name, the border is kept", async t => {
  await t.open("#shot=lx:edge", { settle: 600 });
  await t.waitFor(".lt-edge-b", 8000, "the Edges strip");
  await t.click(t.$$(".lt-edge-b")[5], { wait: 300 });
  t.expect(t.$$(".lt-edge-lab").filter(e => e.textContent.trim()).length === 9, "every step is labeled with its nearest name");
  t.expect(t.$(".lt-edge-b.mid"), "the halfway mark");
  t.expect(t.ev("Object.keys(S.edges || {}).length") >= 1, "the border was kept in S.edges");
  t.expect(t.$("[data-next]") && !t.$("[data-next]").hidden, "Next shows after the reveal");
});
scenario("learn", "Learn it done: the group joins review as core cards, due tomorrow", async t => {
  await t.open("#shot=lx:ltdone", { settle: 600 });
  await t.waitFor(".lt-done-pal", 8000, "the Learn it done screen");
  t.expect(t.ev("!!S.cards['core:chestnut'] && S.cards['core:chestnut'].n === 'Chestnut'"), "Chestnut joined spaced review as core:chestnut");
  t.expect(t.ev("cardsAll().some(c => c.id === 'core:chestnut') && !dueList().some(c => c.id === 'core:chestnut')"), "cardsAll covers it, due tomorrow, not today");
  await t.click("[data-lt-back]", { wait: 700 });
  await t.waitFor(".cp-page", 8000, "the name page after Done");
});

// ================================================================== PAINTINGS (lane L26: color in paintings)
const PT = {
  num: t => H.num(t.text("[data-finding]")),
  async count(t) { await t.waitFor(() => !/Measuring/.test(t.text("[data-finding]")) && t.text("[data-finding]"), 20000, "the finding line"); return PT.num(t); },
  slide(t, k, v) { const r = t.$$(".pt-range")[k]; r.value = v; r.dispatchEvent(new t.w.Event("input", { bubbles: true })); },
};
scenario("paintings", "paintings-of: looser tolerance never finds fewer; a second color joins; chips drop it", async t => {
  await t.open("#/paintings-of/8a6b52?t=3&m=1", { settle: 600 });
  await t.waitFor(".pt-page .pt-range", 12000, "the two sliders");
  const a = await PT.count(t);
  t.expect(a > 0, "no paintings for a common brown at 3% / 1%");
  PT.slide(t, 0, 8); await t.sleep(300);                      // How close: index 8 = 10%
  const b = await PT.count(t);
  t.expect(b >= a, `looser tolerance found fewer paintings (${a} then ${b})`);
  PT.slide(t, 1, 9); await t.sleep(300);                      // How much: stricter
  await t.waitFor(() => PT.num(t) !== b, 15000, "the count to change after the coverage slider");
  const c = PT.num(t);
  t.expect(c <= b, `stricter coverage found more paintings (${b} then ${c})`);
  t.expect(t.$$(".pt-results .pin, .pt-results .gl-pin").length > 0, "no painting tiles under the count");
  await t.click("[data-add]", { wait: 500 });
  await t.waitFor(".sheet .pt-add-sw button", 6000, "the add-a-color sheet");
  await t.click(".sheet .pt-add-sw button", { force: true, wait: 700 });
  await t.waitFor(() => t.$$(".pt-chip").length === 2, 6000, "two color chips");
  t.expect(t.$$("[data-mode]").length === 3, "no All / Any / As a palette switch with two colors");
  await t.click('[data-mode="any"]', { wait: 600 });
  await PT.count(t);
  await t.click("[data-drop]", { force: true, wait: 600 });
  await t.waitFor(() => t.$$(".pt-chip").length === 1, 4000, "the chip to drop");
});
scenario("paintings", "a pair's paintings, the masters' chords, and a painting with its color pinned", async t => {
  await t.open("#/paintings-of/c2412d+4f6b3a?t=4&m=1", { settle: 600 });
  await t.waitFor(".pt-finding", 12000, "the pair's paintings");
  await PT.count(t);
  t.expect(t.$$(".pt-chip").length === 2, "the pair's paintings don't show two colors");
  await t.open("#/chords", { settle: 600 });
  await t.waitFor(".chd-row", 12000, "chord rows");
  t.expect(t.$$(".chd-row").length >= 10, "fewer than ten chords");
  await t.click('[data-kind="avoid"]', { wait: 400 });
  t.expect(t.$$(".chd-row").length >= 5, "no pairs painters keep apart");
  await t.click('[data-kind="pairs"]', { wait: 300 });
  await t.click(".chd-row", { force: true, wait: 700 });
  await t.waitFor(".sp-page .sp-pair", 12000, "a pair page opened from a chord");
  await t.open("#/gallery/15146?c=0047ab&t=3", { settle: 800 });
  await t.waitFor(() => /covers/.test(t.text(".pt-arrive")), 14000, "the pinned coverage line");
  // David, 2026-10-08: the color you came from sits under the palette, one quiet row; the tolerance opens on a tap
  t.expect(t.$(".pt-arrive").getBoundingClientRect().top > t.$("[data-glrows]").getBoundingClientRect().top, "the arriving color sits above the palette");
  t.expect(t.$(".pt-ar-more").hidden, "the arrival's tools are open before a tap");
  await t.click(".pt-ar-txt", { force: true, wait: 300 });
  t.expect(t.$(".pt-arrive [data-t]") && !t.$(".pt-ar-more").hidden, "no tolerance switch after a tap on the arrival");
});
scenario("paintings", "a painting's On the painting control: numbered Markers that are remembered and a Highlight that dims", async t => {
  await t.open("#/gallery/12", { settle: 800 });
  await t.waitFor(() => { const w = t.$("[data-glwhere]"); return w && !w.hidden && w; }, 15000, "the On the painting control (a local copy, so its pixels can be read)");
  await t.click('[data-glw="mark"]', { force: true, wait: 400 });
  const marks = t.$$(".gl-mks .gl-mk:not(.sm)");
  t.expect(marks.length >= 3, `only ${marks.length} numbered markers`);
  t.expect(t.$$("[data-glswatches] .gl-n").length === t.$$("[data-glswatches] [data-swatch]").length, "the strip chips aren't numbered like the markers");
  t.expect(t.ev("S.glWhere") === "mark", "the choice isn't remembered");
  const hexes = new Set(t.$$("[data-glswatches] [data-swatch]").map(b => b.dataset.swatch));
  t.expect(marks.every(m => hexes.has(m.dataset.swatch)), "a marker isn't one of the palette's colors");
  await t.click('[data-glw="lit"]', { force: true, wait: 400 });
  t.expect(!t.$(".gl-mks .gl-mk") && t.$("[data-gllitcv]").classList.contains("on"), "Highlight didn't swap the markers for the dimmed painting");
  await t.click('[data-glw="off"]', { force: true, wait: 300 });
  t.expect(!t.$("[data-gllitcv]").classList.contains("on"), "Off left the painting dimmed");
});
// The Analysis section's "Learn this painting" button (js/artwiki.js awAnalysis) was guarded by
// `typeof paintingLesson === "function"`, a function that was never defined anywhere, so the button never
// rendered. It now opens the painting's palette as a quick deck (prQuick -> js/learnset.js lsOpen).
scenario("paintings", "a painting's Analysis: Learn this painting opens a deck of its palette", async t => {
  await t.open("#/gallery/12", { settle: 800 });
  const btn = await t.waitFor("[data-awlesson]", 15000, "the Learn this painting button");
  t.expect(/learn this painting/i.test(t.text(btn)), `the button reads "${t.text(btn)}"`);
  await t.click(btn, { force: true, wait: 500 });
  await t.waitFor(".sheet.ls-sheet, .sheet.pr-qsheet", 8000, "a quick-deck sheet after Learn this painting");
});
// "You and this color" (js/richcolor.js rcYouHTML): opening a painting logs it as seen (js/gallery.js glPage),
// so one of its colors should quietly say "You met it in <title>, a painting", one tap back to that painting.
scenario("paintings", "a color page says where you met it, and the link reopens that painting", async t => {
  await t.open("#/gallery/12", { settle: 800 });
  const title = t.text(".p-title");
  const sw = await t.waitFor("[data-glswatches] [data-swatch]", 15000, "a palette swatch on the painting");
  await t.click(sw, { force: true, wait: 600 });
  await t.waitFor(".cp-page", 8000, "the color page after tapping a palette swatch");
  const met = await t.waitFor(".rc-you .rc-met", 8000, 'the "You met it in…" line');
  t.expect(new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).test(t.text(met)), `the met line "${t.text(met)}" doesn't name "${title}"`);
  const link = t.$(".rc-you [data-rc-met]");
  t.expect(link, 'the met line has no one-tap link back to the painting');
  await t.click(link, { force: true, wait: 600 });
  await t.waitFor(() => t.text(".p-title") === title, 8000, "the painting to reopen from the met line");
});
scenario("paintings", "a color page's In paintings section: presets re-run the query; Fine-tune opens the sliders", async t => {
  await t.open("#/color/cobalt", { settle: 800 });
  const sec = await t.waitFor("[data-glin]", 12000, "the In paintings section");
  // it lives in the "In paintings" field-note drawer (closed until a tap, like a thumb would)
  const dr = sec.closest("details");
  if (dr && !dr.open) await t.click(dr.querySelector("summary"), { wait: 300 });
  sec.scrollIntoView();
  await t.waitFor("[data-pt-quick] [data-pre-tol]", 15000, "the tolerance presets");
  await t.waitFor(() => t.$$("[data-pt-rail] .gl-pin, [data-pt-rail] .pin").length > 0 || /No painting/.test(t.text("[data-pt-lead]")), 20000, "the rail or an honest empty line");
  await t.click('[data-pt-quick] [data-pre-tol="10"]', { force: true, wait: 600 });
  await t.click("[data-pt-tune]", { force: true, wait: 400 });
  t.expect(t.$$("[data-pt-tuner] .pt-range").length === 2, "Fine-tune doesn't open two sliders");
});

// ================================================================== SET PAGES (js/settray.js, js/setpage.js: a page for every pair and palette)
const SP = {
  placed() { try { localStorage.clear(); localStorage.setItem("colorhub-v1", JSON.stringify({ v: 3, placed: { tier: 1, at: "2026-10-01" }, tlHint: 1 })); } catch (e) {} },
  async lead(t) { await t.waitFor(() => t.text("[data-lead]") && !/Reading the paintings/.test(t.text("[data-lead]")), 25000, "the pair's headline finding"); return t.text("[data-lead]"); },
};
scenario("sets", "Pair with on a color page: picker suggests, searches, try-on before committing, and Add opens the pair page", async t => {
  SP.placed();
  await t.open("#/color/teal", { settle: 800, keepState: true });
  const btn = await t.waitFor("[data-sx-pair]", 12000, "the Pair with… button");
  await t.click(btn, { wait: 600 });
  await t.waitFor(".sheet.sx-sheet .sx-opt", 6000, "the picker's suggestions");
  t.expect(t.$$(".sx-sheet .sx-sec").length >= 2, "fewer than two suggestion rows");
  t.expect(t.$(".sx-try-sw.empty"), "the try-on strip starts with a dashed empty slot");
  const q = t.$(".sx-sheet [data-sx-q]"); q.value = "rose"; q.dispatchEvent(new t.w.Event("input", { bubbles: true })); await t.sleep(200);
  await t.waitFor(".sx-sheet .sx-li", 6000, "search results for rose");
  q.value = ""; q.dispatchEvent(new t.w.Event("input", { bubbles: true })); await t.sleep(200);
  await t.click(".sx-sheet [data-sx-any]", { force: true, wait: 400 });
  t.expect(t.$(".sx-sheet .sx-picker .cp"), "Any color didn't open the ring picker");
  // tapping a suggestion drops it into the trying slot, with its name and the relation line — no navigation yet
  const firstOpt = t.$(".sx-sheet .sx-opt");
  const hex1 = firstOpt.dataset.sxHex;
  await t.click(firstOpt, { force: true, wait: 300 });
  t.expect(!t.$(".sp-page"), "tapping a candidate must not navigate away");
  t.expect(t.$(".sx-try-sw.trying"), "the trying slot is filled");
  t.expect(/· .+% apart · contrast/.test(t.text(".sx-try-rel")), "the relation line reads name · % apart · contrast");
  // swapping to another candidate replaces the trial
  const opts = t.$$(".sx-sheet .sx-opt"), second = opts.find(b => b.dataset.sxHex !== hex1);
  if (second) { await t.click(second, { force: true, wait: 300 }); t.expect(t.ev("de2000")(t.$(".sx-try-sw.trying").style.getPropertyValue("--c"), second.dataset.sxHex) < 1, "swapping candidates replaces the trial, not adds to it"); }
  // Cancel discards the trial, leaving the set unchanged
  await t.click("[data-try-cancel]", { force: true, wait: 200 });
  t.expect(!t.$(".sx-try-sw.trying") && t.$(".sx-try-sw.empty"), "Cancel clears the trying slot");
  t.expect(t.ev("sxTray().length") === 0, "Cancel left the tray unchanged");
  // Add commits it
  await t.click(t.$(".sx-sheet .sx-opt"), { force: true, wait: 300 });
  await t.click("[data-try-add]", { force: true, wait: 800 });
  await t.waitFor(".sp-page .sp-pair .sp-plate", 12000, "the pair page");
  t.expect(/^#\/pair\/[0-9a-f]{6}\+[0-9a-f]{6}$/.test(t.w.location.hash), `the pair's address is ${t.w.location.hash}`);
  await SP.lead(t);
  t.expect(t.$$(".sp-fact").length >= 5, "the relationship facts are missing");
});
scenario("sets", "a pair page: facts and paintings and Add a color makes a trio", async t => {
  SP.placed();
  await t.open("#/pair/4f6b3a+c2412d", { settle: 800, keepState: true });
  await t.waitFor(".sp-page .sp-plate", 12000, "the pair page");
  await SP.lead(t);
  await t.waitFor(() => t.$("[data-ptg] .gl-pin") || /too few|No painting/.test(t.text("[data-ptg]")), 25000, "paintings or an honest line");
  t.expect(/:1 contrast/.test(t.text(".sp-facts")), "no contrast ratio");
  await t.click('.cs-act[data-sp-add]', { wait: 600 });
  await t.waitFor(".sheet.sx-sheet .sx-opt", 6000, "the add-a-color picker");
  await t.click(".sx-sheet .sx-opt", { force: true, wait: 300 });
  await t.click(".sx-sheet [data-try-add]", { force: true, wait: 800 });
  await t.waitFor(() => /^#\/set\//.test(t.w.location.hash) && t.$(".sp-page .sp-strip"), 12000, "the trio page");
  t.expect(t.$$(".sp-names .sp-name").length === 3, "the trio doesn't list three colors");
  await t.click(".sp-page .sp-plus ~ button, .sp-names [data-swatch]", { force: true, wait: 800 });
  await t.waitFor(".cp-page .cp-hero-foot h1", 12000, "a color page from the trio");
});
scenario("sets", "double-tap the top swatches keeps the palette (a heart burst); a single tap still opens that color", async t => {
  SP.placed();
  await t.open("#/pair/4f6b3a+c2412d", { settle: 800, keepState: true });
  await t.waitFor(".sp-page .sp-plate", 12000, "the pair page");
  t.ev("S.palettes = []; save()");
  const plate = t.$(".sp-pair .sp-plate");
  await t.click(plate, { wait: 60 });
  await t.click(plate, { wait: 300 });
  t.expect(!t.$(".sp-page.cp-page") && t.$(".sp-page .sp-plate"), "a double tap must not navigate away");
  t.expect(t.ev("S.palettes") && t.ev("S.palettes").length === 1, "the double tap didn't keep the palette");
  t.expect(t.ev("S.palettes[0].cols.length") === 2, "the kept palette doesn't hold both colors");
  t.expect(t.$(".sp-heart"), "no heart burst on the double tap");
  // a single tap (no second tap follows) still opens that color's page, just after the double-tap wait
  await t.open("#/pair/4f6b3a+c2412d", { settle: 800, keepState: true });
  await t.waitFor(".sp-page .sp-plate", 12000, "the pair page again");
  await t.click(t.$(".sp-pair .sp-plate"), { wait: 500 });
  await t.waitFor(".cp-page .cp-hero-foot h1", 8000, "a single tap on a plate still opens its color page");
});
scenario("sets", "a set page: pairs inside and Improve with Apply and Undo", async t => {
  SP.placed();
  await t.open("#/set/2b2a4c-b85c38-e0c097-6f8f72", { settle: 800, keepState: true });
  await t.waitFor(".sp-page .sp-strip", 12000, "the set page");
  await SP.lead(t);
  await t.waitFor(() => t.$$("[data-pairs] .sp-prow").length === 6, 25000, "six pairs inside a four-color set");
  for (const k of ["subtle", "bold", "clear"]) await t.click(`[data-str="${k}"]`, { force: true, wait: 150 });
  // Improve: a suggestion offers per-color locks; locking one keeps it exactly as it was, and the After strip lights only what moved
  const lockBtn = t.$("[data-lock]");
  if (lockBtn) {
    const [id, i] = lockBtn.dataset.lock.split(":");
    await t.click(lockBtn, { force: true, wait: 300 });
    const again = t.$$(`[data-lock="${id}:${i}"]`)[0];
    t.expect(again && again.classList.contains("on"), "the lock toggles on");
    const card = again && again.closest(".sp-imp");
    if (card && !card.classList.contains("blocked")) t.expect(![...card.querySelectorAll(".sp-istrip.after i")][+i].classList.contains("moved"), "a locked color is not changed");
    await t.click(again, { force: true, wait: 300 });
  }
  const ap = t.$("[data-apply]");
  if (ap) {
    const before = t.w.location.hash;
    await t.click(ap, { force: true, wait: 800 });
    await t.waitFor(() => t.$("[data-undo]") && t.w.location.hash !== before, 8000, "the applied palette with Undo");
    await t.click("[data-undo]", { force: true, wait: 800 });
    await t.waitFor(() => t.w.location.hash === before, 8000, "Undo to restore the palette");
  } else t.expect(/Nothing the numbers call for/.test(t.text("[data-impbody]")), "no suggestion and no honest line");
  await t.click(".sp-names .sp-drop", { force: true, wait: 800 });
  await t.waitFor(() => t.$$(".sp-names .sp-name").length === 3, 8000, "a color to drop");
});
scenario("sets", "the tray is only for building: opening the set page consumes it, and it stays gone on a single color", async t => {
  SP.placed();
  await t.open("#/color/teal", { settle: 800, keepState: true });
  t.ev('sxSetTray(["#2B2A4C", "#E0C097"])'); await t.sleep(300);
  t.expect(t.$(".sx-tray:not([hidden])"), "the tray shows while a set is being built");
  await t.click(".sx-tray-main", { force: true, wait: 800 });
  await t.waitFor(".sp-page .sp-pair", 12000, "the pair page");
  t.expect(t.ev("sxTray().length") === 0, "opening the pair page consumed the tray");
  t.ev('location.hash = "#/color/teal"'); await t.waitFor(".cp-page", 12000, "a single color");
  await t.sleep(300);
  t.expect(!t.$(".sx-tray:not([hidden])"), "the pair does not float over a single color");
  // a stale half-built set clears itself after two screens without adding
  t.ev('sxSetTray(["#2B2A4C"])'); t.ev('location.hash = "#/color/rose"'); await t.sleep(500); t.ev('location.hash = "#/color/teal"'); await t.sleep(500);
  t.expect(t.ev("sxTray().length") === 0, "a half-built set clears after two screens without adding");
});
scenario("sets", "long-press a swatch adds it to the tray and the tray opens the set", async t => {
  SP.placed();
  // long-press a palette chip on a painting: it joins the set, the tray shows, the page stays; the tray opens the pair
  await t.open("#/gallery/15146", { settle: 800, keepState: true });
  t.ev('sxSetTray(["#C9A227"])');
  const sw = await t.waitFor(() => t.$$("#app .pal[data-swatch], #app .pal-name[data-swatch]").find(e => e.getBoundingClientRect().width > 10 && t.ev("de2000")(e.dataset.swatch, "#C9A227") > 3), 15000, "a palette chip on the painting");
  sw.scrollIntoView({ block: "center" }); await t.sleep(400);   // let the scroll settle: a scroll cancels a hold
  const r = sw.getBoundingClientRect(), o = { bubbles: true, cancelable: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, pointerId: 1, pointerType: "touch", isPrimary: true, view: t.w };
  const n0 = t.ev("sxTray().length"), page = t.w.location.hash;
  sw.dispatchEvent(new t.w.PointerEvent("pointerdown", o)); await t.sleep(700); sw.dispatchEvent(new t.w.PointerEvent("pointerup", o)); sw.click(); await t.sleep(400);
  t.expect(t.ev("sxTray().length") === n0 + 1, `the long-press didn't add the color (${n0} then ${t.ev("sxTray().length")})`);
  t.expect(t.w.location.hash === page, `the long-press also opened ${t.w.location.hash}`);
  await t.waitFor(() => t.$(".sx-tray:not([hidden])"), 6000, "the tray pill");
  await t.click(".sx-tray-main", { wait: 800 });
  await t.waitFor(".sp-page .sp-pair", 12000, "the tray to open the pair");
});
scenario("sets", "a pair's painting rail carries the whole pair, not one color: the arrival row shows both", async t => {
  SP.placed();
  // two real, clearly different colors from the same painting: that painting is guaranteed to hold the pair
  await t.open("#/gallery/15146", { settle: 600, keepState: true });
  const pair = t.ev(`(() => { const pal = glPal(15146); let best = null;
    for (let i = 0; i < pal.length; i++) for (let j = i + 1; j < pal.length; j++) { const d = de2000(pal[i].h, pal[j].h); if (!best || d > best.d) best = { a: pal[i].h, b: pal[j].h, d }; }
    return best; })()`);
  t.expect(pair && pair.d > 15, "painting 15146's palette colors are too similar to form a clear pair");
  const a = pair.a.slice(1).toLowerCase(), b = pair.b.slice(1).toLowerCase();
  await t.open(`#/pair/${a}+${b}`, { settle: 800, keepState: true });
  await t.waitFor(".sp-page .sp-pair .sp-plate", 12000, "the pair page");
  await SP.lead(t);
  const pin = await t.waitFor("[data-ptg] .gl-pin", 25000, "a painting holding this pair (painting 15146 itself, at least)");
  await t.click(pin, { force: true, wait: 900 });
  await t.waitFor(".pt-arrive [data-opensp]", 14000, "the painting's arrival row");
  t.expect(/You came from/.test(t.text(".pt-arrive")), `the arrival row doesn't say "You came from": ${t.text(".pt-arrive")}`);
  t.expect(t.$$(".pt-ar-sw-s").length === 2, `the arrival row shows ${t.$$(".pt-ar-sw-s").length} swatches, expected 2 (the whole pair)`);
  // tapping the row (not a swatch, not the map button) reopens the pair page
  await t.click(".pt-arrive [data-opensp]", { force: true, wait: 800 });
  await t.waitFor(".sp-page .sp-pair .sp-plate", 12000, "the row reopened the pair page");
});

// ================================================================== DIRECT LOADS (a typed or shared address on a fresh load)
scenario("pages", "a fresh load of #/painter/<slug> opens that painter, not Home", async t => {
  await t.open("#/painter/abraham-bloemaert", { settle: 600 });
  await t.waitFor(".aw-page, [data-awpainter-page], .screen.aw", 15000, "the painter page on a direct load");
  t.expect(/Bloemaert/.test(t.$("#app").innerText), "the painter's page doesn't name the painter");
  t.expect(!t.$(".hm canvas"), "a direct painter address landed on Home");
  t.expect(t.w.location.hash === "#/painter/abraham-bloemaert", `the address changed to ${t.w.location.hash}`);
});

// ================================================================== THE TRAIL (js/trail.js: one Back for everything, the map glyph)
const TRL = {
  // a placed learner (so the map, not the welcome, is the floor), with nothing else in the save
  placed(t) { try { localStorage.clear(); localStorage.setItem("colorhub-v1", JSON.stringify({ v: 3, placed: { tier: 1, at: "2026-10-01" }, tlHint: 1 })); } catch (e) {} },
  async open(t, hash) { TRL.placed(t); await t.open(hash, { settle: 600, keepState: true }); },
  hash: t => decodeURIComponent(t.w.location.hash),
  depth: t => t.ev("XSTACK.length"),
  screenBack: t => t.$("#app .screen [data-back]"),
  async atHash(t, re, msg) { return t.waitFor(() => re.test(TRL.hash(t)) && t.$("#app .screen [data-back]") && !t.$(".screen.waiting"), 20000, msg); },
  async tap(t, sel, msg) { const e = await t.waitFor(() => t.$$(sel).find(x => x.getBoundingClientRect().width), 20000, msg); await t.click(e, { wait: 500 }); return e; },
  // color (cobalt) > a painting with it > its painter > another of their paintings > a color in it > a gem near that color
  async chain(t) {
    const seen = [];
    const note = () => seen.push({ hash: TRL.hash(t), y: Math.round(t.w.scrollY), n: TRL.depth(t) });
    await TRL.atHash(t, /^#\/color\/cobalt/, "the cobalt page");
    // 2. a painting from its In paintings rail (the tap scrolls the rail into view, so the page's scroll is remembered)
    const sec = await t.waitFor("[data-glin]", 12000, "the In paintings section");
    const fold = sec.closest("details:not([open])"); if (fold) await t.click(fold.querySelector("summary"), { wait: 300 });   // the shelf may sit in a folded section
    sec.scrollIntoView(); t.w.dispatchEvent(new t.w.Event("scroll")); await t.sleep(300);
    const pin = await t.waitFor(() => { sec.scrollIntoView(); t.w.dispatchEvent(new t.w.Event("scroll")); return t.$$("[data-pt-rail] .gl-pin, [data-pt-rail] .pin, [data-glin] [data-gi]")[0]; }, 25000, "a painting in cobalt's In paintings rail");
    pin.scrollIntoView({ block: "center" }); await t.sleep(200);
    note(); await t.click(pin, { wait: 600 });
    await TRL.atHash(t, /^#\/gallery\/\d+/, "the painting page");
    // 3. its painter
    const painter = await t.waitFor(() => t.$("#app .screen [data-awpainter]"), 20000, "the painter link on the painting");
    note(); await t.click(painter, { wait: 600 });
    await TRL.atHash(t, /^#\/painter\//, "the painter page");
    // 4. another painting of theirs
    const other = await t.waitFor(() => t.$$("#app .screen [data-gi]").find(x => +x.dataset.gi >= 0 && !seen.some(s => s.hash.includes("/gallery/" + x.dataset.gi + "?") || s.hash.endsWith("/gallery/" + x.dataset.gi))), 20000, "another painting on the painter page");
    note(); await t.click(other, { wait: 600 });
    await TRL.atHash(t, /^#\/gallery\/\d+/, "the second painting");
    note();
    // 5 + 6. a color in it whose page has a gem: try the palette's colors until one does
    const nSw = (await t.waitFor(() => t.$$("[data-glswatches] [data-swatch]").length && t.$$("[data-glswatches] [data-swatch]"), 15000, "the painting's palette")).length;
    let gem = null;
    for (let i = 0; i < nSw && !gem; i++) {
      await t.click(t.$$("[data-glswatches] [data-swatch]")[i], { wait: 600 });
      await TRL.atHash(t, /^#\/(color|name)\//, "a color page from the palette");
      gem = await t.waitFor(() => t.$("#app .screen [data-to^='gm:gem:']"), 2500, "a gem", 1500).catch(() => null);
      if (!gem) { await t.click(TRL.screenBack(t), { wait: 500 }); await TRL.atHash(t, /^#\/gallery\//, "back on the second painting"); }
    }
    t.expect(gem, "no color in the second painting has a gem on its page");
    seen.push({ hash: TRL.hash(t), y: 0, n: TRL.depth(t) });
    const gf = gem.closest("details:not([open])"); if (gf) await t.click(gf.querySelector("summary"), { wait: 300 });
    await t.click(gem, { wait: 600 });
    await TRL.atHash(t, /^#\/gem\//, "the gem page");
    seen.push({ hash: TRL.hash(t), y: 0, n: TRL.depth(t) });
    return seen;
  },
};

scenario("trail", "a 6-deep chain (color, painting, painter, painting, color, gem) backs out one step at a time", async t => {
  await TRL.open(t, "#/color/cobalt");
  const seen = await TRL.chain(t);
  t.expect(seen.length === 6, `the chain is ${seen.length} deep, not 6`);
  t.expect(TRL.depth(t) === 6, `the trail holds ${TRL.depth(t)} pages at depth 6: ${t.ev("XSTACK.join(' , ')")} // ${seen.map(s => s.hash + "@" + s.n).join(" ")}`);
  t.expect(t.$("#app .screen [data-tl-exit]"), "the gem page has no map glyph");
  // one step at a time: the ‹ button, then the browser's own Back (the iOS edge swipe does the same), alternating
  for (let i = seen.length - 2; i >= 0; i--) {
    if (i % 2) await t.click(TRL.screenBack(t), { wait: 600 });
    else { t.w.history.back(); await t.sleep(700); }
    await t.waitFor(() => TRL.hash(t) === seen[i].hash && !t.$(".screen.waiting"), 15000, `Back to land on ${seen[i].hash} (on ${TRL.hash(t)})`);
    t.expect(TRL.depth(t) === i + 1, `after Back to ${seen[i].hash} the trail holds ${TRL.depth(t)}, expected ${i + 1}`);
    if (seen[i].y > 200) { await t.sleep(400); t.check(Math.abs(t.w.scrollY - seen[i].y) < 60, `${seen[i].hash} came back at scroll ${Math.round(t.w.scrollY)}, left at ${seen[i].y}`); }
  }
  // the trail ran out: a page opened from an address goes back to the map
  await t.click(TRL.screenBack(t), { wait: 700 });
  await t.waitFor(".hm canvas", 10000, "the map after the trail ran out");
  t.expect(!t.$(".room-sheet"), "the trail ran out into a room instead of the map");
});

scenario("trail", "a page's colors lit on the map keep the trail: the pill's ‹ returns to the page", async t => {
  await TRL.open(t, "#/color/cobalt");
  const h0 = TRL.hash(t), d0 = TRL.depth(t);
  t.ev("csOnMap(colorSet({ kind: 'color', id: 'cobalt', title: 'Cobalt and kin', colors: [{ h: '#0047AB' }, { h: '#2A52BE' }, { h: '#1F3A93' }] }))");
  await t.waitFor(".hm canvas", 12000, "the map with the set lit");
  const back = await t.waitFor(".cs-hl-back", 6000, "the lit set's ‹ back to its page");
  t.expect(TRL.depth(t) === d0, `the map wiped the trail: ${TRL.depth(t)} pages, was ${d0}`);
  await t.click(back, { wait: 800 });
  await t.waitFor(() => TRL.hash(t) === h0 && !t.$(".screen.waiting"), 12000, `back on ${h0} (on ${TRL.hash(t)})`);
  t.expect(!t.$(".cs-hl-pill"), "the lit set's pill is still up after going back");
});

scenario("trail", "long-press ‹ shows the trail; a row jumps there; the map glyph exits with the map's pan and zoom kept", async t => {
  await TRL.open(t, "#/home");
  const cv = await t.waitFor(".hm canvas", 12000, "the map");
  await t.sleep(600);
  // pan the map, so there's a position to keep
  const r = cv.getBoundingClientRect(), o = (x, y) => ({ bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 7, pointerType: "touch", isPrimary: true, view: t.w });
  cv.dispatchEvent(new t.w.PointerEvent("pointerdown", o(r.width * .5, r.height * .6)));
  for (let k = 1; k <= 6; k++) { cv.dispatchEvent(new t.w.PointerEvent("pointermove", o(r.width * .5 - k * 14, r.height * .6 - k * 10))); await t.sleep(30); }
  cv.dispatchEvent(new t.w.PointerEvent("pointerup", o(r.width * .5 - 84, r.height * .6 - 60)));
  await t.sleep(900);
  // a bubble's tap is hmOpenColor (the bubble tap itself is the home group's job): a trail rooted on the map
  t.ev("hmOpenColor(BYNAME.get('cobalt'))");
  const seen = await TRL.chain(t);
  const pan = JSON.stringify(t.ev("HONEY_PAN"));
  t.expect(pan && pan !== "null", "the map has no remembered pan");
  // long-press ‹: the trail sheet, newest first, and the release doesn't also go back
  const back = TRL.screenBack(t), br = back.getBoundingClientRect(), bo = { bubbles: true, cancelable: true, clientX: br.left + 10, clientY: br.top + 10, pointerId: 9, pointerType: "touch", isPrimary: true, view: t.w };
  back.dispatchEvent(new t.w.PointerEvent("pointerdown", bo));
  await t.sleep(700);
  t.w.dispatchEvent(new t.w.PointerEvent("pointerup", bo)); back.click();
  await t.waitFor(".tl-sheet", 4000, "the trail sheet after a long press on ‹");
  t.expect(/^#\/gem\//.test(TRL.hash(t)), "the long press also went back");
  const rows = t.$$(".tl-sheet .tl-row");
  t.expect(rows.length >= 7, `the trail sheet shows ${rows.length} rows, expected 6 pages and the map`);
  t.expect(rows[0].classList.contains("here"), "the first row isn't where you are");
  t.expect(t.$$(".tl-sheet .tl-row .tl-th img, .tl-sheet .tl-row .tl-th[style]").length >= 4, "the trail rows have no pictures");
  // jump to the painter (third from the start)
  const painterRow = t.$$(".tl-sheet [data-tl-go]").find(b => b.dataset.tlGo === "2");
  await t.click(painterRow, { wait: 700 });
  await t.waitFor(() => TRL.hash(t) === seen[2].hash && !t.$(".sheet"), 12000, "the painter page from its trail row");
  t.expect(TRL.depth(t) === 3, `after the jump the trail holds ${TRL.depth(t)}, expected 3`);
  // the map glyph: straight to the map, its pan and zoom as they were
  await t.click("#app .screen [data-tl-exit]", { wait: 900 });
  await t.waitFor(".hm canvas", 10000, "the map after the map glyph");
  await t.sleep(500);
  t.expect(TRL.depth(t) === 0, "the trail wasn't cleared by the map glyph");
  const after = t.ev("HONEY_PAN"), before = JSON.parse(pan);
  t.expect(after && Math.abs(after.x - before.x) < 1 && Math.abs(after.y - before.y) < 1 && after.z === before.z, `the map moved: ${pan} -> ${JSON.stringify(after)}`);
});

// fresh loads of shared addresses: each opens its page, and Back goes to the map (not a room)
[["#/painter/abraham-bloemaert", /Bloemaert/], ["#/gallery/15146?c=0047ab", null], ["#/pair/4f6b3a+c2412d", null], ["#/set/2b2a4c-b85c38-e0c097", null], ["#/look/rococo", /Rococo/], ["#/hub/source:crayola", /Crayola/i]].forEach(([hash, re]) => {
  scenario("trail-links", `a fresh ${hash.split("/")[1].split("?")[0]} address opens it; Back goes to the map`, async t => {
    await TRL.open(t, hash);
    await t.waitFor(() => t.$("#app .screen [data-back]") && !t.$(".screen.waiting") && t.$("#app").innerText.length > 120, 20000, `the page at ${hash}`);
    t.expect(TRL.hash(t) === decodeURIComponent(hash), `the address changed to ${TRL.hash(t)}`);
    if (re) t.expect(re.test(t.$("#app").innerText), `${hash} doesn't show what it names`);
    t.expect(t.$("#app .screen [data-tl-exit]"), `${hash} has no map glyph`);
    await t.click(TRL.screenBack(t), { wait: 700 });
    await t.waitFor(".hm canvas", 10000, `the map after Back from ${hash}`);
  });
});

scenario("trail-links", "the Museum: its own address, the old one still works, and a part's trail runs out back into it", async t => {
  await TRL.open(t, "#/museum");
  await t.waitFor(".xp-pager", 15000, "the Museum's covers at #/museum");
  t.expect(/^Museum/.test(t.d.title), `the title is "${t.d.title}"`);
  await TRL.open(t, "#/explore/ideas");
  await t.waitFor(".x-feed", 15000, "Ideas at the old #/explore/ideas");
  t.expect(TRL.hash(t) === "#/museum/ideas", `the old address became ${TRL.hash(t)}`);
  const pin = await t.waitFor(() => t.$$(".x-feed [data-pin]")[0], 10000, "a pin in Ideas");
  await t.click(pin, { wait: 600 });
  await t.waitFor(() => t.$(".screen[data-tl] [data-back]"), 10000, "a closeup on the trail");
  await t.click(TRL.screenBack(t), { wait: 700 });
  await t.waitFor(".x-feed", 10000, "Ideas again after the trail ran out (not the map, not another room)");
});

// ================================================================== STUDY THE MAP (js/mapstudy.js, v2: design/MAP-STUDY-2.md)
// The honeycomb's hit callback (MS_DEBUG.onHit) stands in for a thumb on the canvas: the same path a real tap takes.
const MSH = {
  async ready(t, mode) {
    await t.open("#/mapstudy", { settle: 500 });
    await t.waitFor("[data-go]", 12000, "the Study the map setup");
    if (mode) { await t.click(`[data-mode="${mode}"]`, { wait: 500 }); await t.waitFor(`[data-mode="${mode}"].on`, 8000, `${mode} chosen`); await t.waitFor("[data-go]", 8000, "the setup again"); }
  },
  hit: (t, n) => t.ev(`(() => { const D = MS_DEBUG, it = D.mapItems.find(x => x.n === ${JSON.stringify(n)}) || (D.P.board || []).find(x => x.n === ${JSON.stringify(n)}); D.onHit(it || { n: ${JSON.stringify(n)}, h: "#808080" }); })()`),
};
scenario("mapstudy", "Find it: a whole session, misses teach, the end lights the field", async t => {
  await MSH.ready(t, "find");
  t.expect(t.$("[data-field]"), "no field dial on the setup");
  t.expect(!t.$('[data-mode="path"]'), "Path is still offered");
  await t.click("[data-go]", { wait: 500 });
  for (let i = 0; i < 40 && !t.$(".ms-end"); i++) {
    if (t.$("[data-next]")) { await t.click("[data-next]", { wait: 350 }); continue; }
    const P = t.ev("MS_DEBUG.P");
    if (!P || P.answered || P.kind !== "find") { await t.sleep(300); continue; }
    // every third round miss on purpose (a board neighbor), the rest right
    const wrong = i % 3 === 1 && P.board && P.board.find(x => x.n !== P.t.n);
    MSH.hit(t, wrong ? wrong.n : P.t.n); await t.sleep(wrong ? 300 : 1200);
    if (wrong) t.expect(/is here|Next door|Warmer/.test(t.text(".ms-panel")), "a miss said nothing useful");
  }
  await t.waitFor(".ms-end", 8000, "the end of the session");
  t.expect(/found so far/.test(t.text(".ms-end")), "the end doesn't say how much of the field is found");
  await t.click("[data-setup]", { wait: 500 });
  await t.waitFor("[data-go]", 8000, "back to the setup");
});
scenario("mapstudy", "Name it, Neighborhood and Wander all play; Choose shows both dials", async t => {
  await MSH.ready(t, "name");
  await t.click("[data-go]", { wait: 600 });
  const opt = await t.waitFor(".ms-opt", 8000, "name options");
  t.expect(t.$$(".ms-opt").length >= 3 && t.$$(".ms-opt").length <= 6, `${t.$$(".ms-opt").length} name options`);
  await t.click(opt, { wait: 400 });
  t.expect(t.$(".ms-res"), "picking a name gave no result");
  await t.click("[data-close]", { wait: 600 });
  await MSH.ready(t, "hood");
  await t.click("[data-go]", { wait: 700 });
  const P = t.ev("MS_DEBUG.P"); t.expect(P && P.kind === "hood", "no neighborhood");
  MSH.hit(t, P.list[0].n); await t.sleep(300);
  const ho = await t.waitFor(".ms-hood-opts .ms-opt", 5000, "the ring's names to match");
  await t.click(ho, { wait: 400 });
  t.expect(t.ev("MS_DEBUG.P.done.size") === 1, "matching a name didn't count");
  await t.click("[data-reveal]", { wait: 500 });
  await t.waitFor(".ms-end", 5000, "the corner's end");
  await t.click("[data-setup]", { wait: 500 });
  await t.click('[data-mode="wander"]', { wait: 500 });
  await t.click("[data-go]", { wait: 600 });
  const a = t.ev("MS_DEBUG.mapItems[0].n"), b = t.ev("MS_DEBUG.mapItems[3].n");
  MSH.hit(t, a); await t.sleep(250); MSH.hit(t, b); await t.sleep(300);
  t.expect(/than/.test(t.text(".ms-panel")), "wander didn't compare two colors");
  await t.click(".ms-panel [data-setup]", { wait: 500 });
  await t.click('[data-mode="find"]', { wait: 500 });
  await t.click('[data-dm="pick"]', { wait: 400 });
  const hr = await t.waitFor("[data-help]", 4000, "the Pick from dial under Choose");
  t.ev(`(() => { const h = document.querySelector("[data-help]"); h.value = 6; h.dispatchEvent(new Event("input")); h.dispatchEvent(new Event("change")); const f = document.querySelector("[data-field]"); f.value = 3; f.dispatchEvent(new Event("input")); f.dispatchEvent(new Event("change")); })()`);
  await t.sleep(800);
  await t.waitFor("[data-go]", 8000, "the setup after moving the dials");
  t.expect(t.ev("S.mapstudy.spec.level") === 25 && t.ev("S.mapstudy.spec.help") === 6, `the dials didn't save (${t.ev("JSON.stringify(S.mapstudy.spec)")})`);
  t.expect(t.$("[data-test]"), "no test-out under Choose");
  await t.click('[data-dm="you"]', { wait: 300 });
});

// ================================================================== LANE F: the lit set is the map's subject (js/honey.js honeyLitBar)
scenario("map-subject", "a painting on the map: the bar's Learn these, Find them, ‹ back with the scroll kept, ✕", async t => {
  await TRL.open(t, "#/painting/milkmaid");
  const b = await t.waitFor("[data-cs=map]", 15000, "the On the map button on The Milkmaid");
  t.w.scrollTo(0, 400); await t.sleep(200);
  const y0 = Math.round(t.w.scrollY);
  await t.click(b, { force: true, wait: 900 });
  await t.waitFor(() => /The Milkmaid/.test(t.text(".cs-hl-bar")) && /as photographed/.test(t.text(".cs-hl-bar")), 15000, "the Milkmaid bar on the map");
  t.expect(t.$(".cs-hl-bar .cs-hl-back"), "the bar has no ‹ back to the painting");
  // Learn these: the Learn sheet on exactly the lit set, with its source
  await t.click("[data-hl-learn]", { wait: 700 });
  await t.waitFor(".ls-sheet", 6000, "the Learn sheet from the bar");
  t.expect(/Milkmaid/.test(t.text("[data-qtitle]")), `the sheet is about ${t.text("[data-qtitle]")}`);
  await H.keys(t, "Escape"); await t.sleep(500);
  // Find them: Study the map's Find it on that set, straight into round 1
  await t.click("[data-hl-find]", { wait: 900 });
  await t.waitFor(() => t.ev("MS_DEBUG.P && MS_DEBUG.P.kind"), 8000, "a Find it round from the bar");
  t.expect(t.ev("S.mapstudy.spec.set") === "custom" && t.ev("MS_DEBUG.P.kind") === "find", "Find them didn't study the lit set");
  await t.click(".ms-x", { wait: 900 });
  // back on the map, still lit, and ‹ still lands on the painting with its scroll
  const back = await t.waitFor(".cs-hl-bar .cs-hl-back", 12000, "the bar and its ‹ after Find them");
  await t.click(back, { wait: 900 });
  await t.waitFor(() => /^#\/painting\/milkmaid/.test(TRL.hash(t)) && !t.$(".screen.waiting"), 12000, `back on the painting (on ${TRL.hash(t)})`);
  await t.waitFor(() => Math.abs(t.w.scrollY - y0) < 40, 4000, `the scroll came back (${Math.round(t.w.scrollY)}, was ${y0})`);
  // ✕ clears the set: your own view comes back
  t.ev("csOnMap(hmPaintingSet(graph().nodes.get('painting-milkmaid')))");
  await t.waitFor(".cs-hl-bar .cs-hl-x", 12000, "the bar again");
  await t.click(".cs-hl-bar .cs-hl-x", { wait: 900 });
  t.expect(!t.$(".cs-hl-bar") && !t.ev("HONEY_HL"), "✕ left the set lit");
});
scenario("map-subject", "the Study corner on a fresh map never studies Grey", async t => {
  await TRL.open(t, "#/home");
  await t.waitFor(() => /\d/.test(t.text(".hm-title small")) && !/Loading/.test(t.text(".hm-title small")), 12000, "the map to fill");
  await H.menu(t, "learn");
  await t.waitFor(".ls-sheet", 6000, "the Learn sheet from the Study corner");
  const names = t.text("[data-names]");
  t.expect(names && !/\bgr[ae]y\b/i.test(names.split(",")[0]) && !/^Learn Grey/.test(t.text("[data-qtitle]")), `the corner studied grey: ${t.text("[data-qtitle]")} | ${names}`);
});

// ================================================================== THE LEARN ROOM, DECLUTTERED (PLAN.md lane C)
scenario("learnroom", "placement lands on the map with a one-line hint that leaves at the first touch", async t => {
  await t.open("#shot=place:result", { settle: 600 });
  await t.click(await t.waitFor(".result [data-go]", 8000, "the placement result's button"), { wait: 900 });
  const cv = await t.waitFor(".hm canvas", 8000, "the map after placement");
  t.expect(!t.$(".room-learn"), "placement opened the Learn room instead of the map");
  await t.waitFor(".lr-maphint", 3000, "the first-run hint");
  t.expect(/Tap any color/.test(t.text(".lr-maphint")) && t.ev("S.mapHint") === 1, "the hint's words or its flag");
  const r = cv.getBoundingClientRect();
  await t.tapAt(cv, r.left + r.width / 2, r.top + r.height / 3);
  await t.sleep(500);
  t.expect(!t.$(".lr-maphint") && !t.ev("S.mapHint"), "the hint stayed after the first touch");
});
scenario("learnroom", "day one: five blocks or fewer, no grid, no stage rows, no Settings", async t => {
  await t.open("#shot=learn", { settle: 600 });
  t.ev("S = Object.assign(fresh(), { placed: { tier: 2, at: today() }, profileAsked: true }); home();");
  await t.waitFor(".room-learn .lx-words", 8000, "the Your words bar");
  const room = t.$(".room-learn");
  t.expect(!t.$(".quilt", room) && !t.$(".path-list", room) && !t.$("[data-menu]", room), "the grid, the stage rows or Settings are still in the room");
  t.expect(t.$$(".lr-today", room).length === 1 && !t.$(".dl-row", room), "Today is not one card");
  const blocks = [".btn[data-learn], .btn[data-review]", ".lr-today", ".pr-entry", ".lx-words", ".inst", ".keep"].filter(s => t.$(s, room)).length;
  t.expect(blocks <= 5, `${blocks} blocks on day one`);
  t.expect(!/units? to|the 101/i.test(room.innerText), "old path copy is still there");
  t.expect(!t.$("[data-words-map]", room), "See them on the map shows with nothing to see");
});
scenario("learnroom", "Your words names the next stop and opens the map on the Learned view", async t => {
  await t.open("#shot=lx:room", { settle: 600 });
  await t.waitFor(".lx-words .lx-bar-fill", 10000, "the Your words bar");
  t.expect(/Next stop · 150 words/.test(t.text(".lx-words-head")), `next stop ("${t.text(".lx-words-head")}")`);
  t.expect(/\d+ names? to go/.test(t.text(".lx-words-foot")), `what's left ("${t.text(".lx-words-foot")}")`);
  await t.click("[data-words-map]", { wait: 900 });
  await t.waitFor(".hm canvas", 8000, "the map from See them on the map");
  t.expect(t.ev("S.hm.filter") === "learned" && /^stage:\d+$/.test(t.ev("S.hm.src")), `the map's view (${t.ev("S.hm.src")} · ${t.ev("S.hm.filter")})`);
});
scenario("learnroom", "the Today card shows the painting and opens both of its parts", async t => {
  await t.open("#shot=learn", { settle: 600 });
  await t.waitFor(".lr-today #dlPaintArt img", 8000, "Today's painting in the card");
  await t.waitFor(() => t.$("#lrTcSw.on"), 8000, "today's color swatch");
  t.expect(/,|hides in/.test(t.text("#lrTcTitle")) && t.text("#lrTcSub").length > 3, `the card's title ("${t.text("#lrTcTitle")}")`);
  if (t.ev("typeof todayPick") !== "function") t.expect(!t.$(".lr-tc-chip.on"), "a color chip sits on a painting it isn't linked to");
  await t.click(".lr-tc-act[data-daily]", { wait: 600 });
  await t.waitFor(".dn-in", 10000, "Name it in six from the card");
  await t.open("#shot=learn", { settle: 600 });
  await t.click(await t.waitFor(".lr-tc-act[data-dpaint]", 8000, "the Look row"), { wait: 600 });
  await t.waitFor("#dpFrame", 8000, "Today's painting from the card");
});
scenario("you-coverage", "You: Untangle on a mix-up opens the Learn sheet on that pair, saved sets show a ring, the count is never negative", async t => {
  await t.open("#/you", { settle: 400 });
  t.ev(`(() => { const t = today(), c = (n, h) => ({ n, h });
    learnerLog({ type: "confuse", color: c("Teal", "#008080"), b: c("Petrol", "#005F6A"), src: "lesson" });
    const ls = lsState(); ls.sets.sdemo = { t: "The Milkmaid", src: "painting", r: "", hs: ["#008080", "#005F6A", "#FF7F50"], at: t, last: t, climbed: [] };
    const u = ALL.find(x => !x.basic) || ALL[0]; S.cards[u.id] = { b: 1, due: addDays(t, -1), since: addDays(t, -3), own: false, n: u.n, h: u.h };
    save(); youPage(); })()`);
  await t.sleep(500);
  t.expect(t.$(".ym-set .cov-ring"), "no ring on the saved set");
  t.expect(/You can name/.test(t.text("#app")), "no You can name strip");
  t.expect(!/-\d/.test(t.text(".ym-count")), `the count shows ${t.text(".ym-count")}`);
  const u = await t.waitFor(".ym-untangle", 3000, "an Untangle button on the mix-up");
  await t.click(u, { wait: 700 });
  await t.waitFor(".ls-sheet", 4000, "the Learn sheet");
  t.expect(/Teal/i.test(t.text(".ls-sheet")) && /Petrol/i.test(t.text(".ls-sheet")), "the sheet isn't on the pair");
});

// The week strip (js/you.js ymWeek): a played-but-not-recalled day used to read `challengeRounds(k)[0].base`,
// a function that never existed, so a typeof guard quietly left that day's dot blank. It now reads the day's
// stored focal color (chState()[k].focal, js/challenge.js) instead.
scenario("you-coverage", "You: the week strip shows a color for a day you only played the daily painting", async t => {
  await t.open("#/you", { settle: 400 });
  t.ev(`(() => { const k = addDays(today(), -1); S.challenge = { [k]: { hits: [true, false, true, true, true], p: "g1", focal: { n: "Cerulean", h: "#2A52BE" }, v: 2 } }; save(); youPage(); })()`);
  await t.sleep(400);
  const dots = t.$$(".ym-week span");
  t.expect(dots.length === 7, `${dots.length} days in the week strip instead of 7`);
  const played = dots[5];   // yesterday: index 6 is "now" (today)
  t.expect(played.classList.contains("on"), "yesterday isn't marked played");
  const i = played.querySelector("i");
  t.expect(i && getComputedStyle(i).getPropertyValue("--c").trim().toUpperCase() === "#2A52BE", `the played day's dot is "${i && getComputedStyle(i).getPropertyValue("--c")}", expected the day's focal color`);
});

// ================================================================== THE PAINTING PAGE + NAME IT / FIND IT (PLAN.md lane A)
scenario("paintings", "lane A: a painting page leads with what stands out; Name its colors runs three rounds, logs them, and offers Learn", async t => {
  await t.open("#/gallery/12", { settle: 800 });
  await t.waitFor(".pal-name b", 12000, "the palette rows");
  t.expect(!t.$$(".pal-name b").some(b => /^between/i.test(b.textContent)), "a 'between X and Y' is used as a name");
  t.expect(t.$("[data-glswatches] .pal.gl-out"), "the strip doesn't lead with a stands-out color");
  const L0 = t.ev(`lab(document.querySelector("[data-glswatches] .pal").dataset.swatch)[0]`);
  t.expect(L0 > 30, `the first chip is a near-black (L* ${Math.round(L0)})`);
  // David, 2026-10-08: the palette is right under the painting, and both fit one screen so you can change types and sizes
  const heroB = t.$(".gl-hero>span").getBoundingClientRect().bottom, stripB = t.$("[data-glswatches]").getBoundingClientRect().bottom;
  t.expect(stripB <= t.ev("innerHeight"), `the palette strip sits below the first screen (${Math.round(stripB)})`);
  t.expect(t.$("[data-glswatches]").getBoundingClientRect().top - heroB < 24, "the palette strip isn't right under the painting");
  t.expect(t.$("[data-glorder]").getBoundingClientRect().top - stripB < 24, "the palette types aren't right under the strip");
  const nTypes = t.$$("[data-glorder] [data-glo]").length;
  t.expect(nTypes >= 5, `only ${nTypes} palette types`);
  await t.click('[data-glo="shadows"]', { wait: 300 });
  const kIn = t.$("[data-glk]");
  t.expect(kIn && !kIn.closest("[hidden]"), "no How many colors slider on Shadows");
  t.ev(`(() => { const s = document.querySelector("[data-glk]"); s.value = 3; s.dispatchEvent(new Event("input", { bubbles: true })); })()`);
  t.expect(t.$$("[data-glswatches] [data-swatch]").length === 3, "the slider didn't redraw the palette live");
  await t.click('[data-glo="out"]', { wait: 300 });
  await t.waitFor(() => /You can name \d+ of \d+/.test(t.text(".gl-cov")), 6000, "the coverage line");
  await t.click('[data-glo="area"]', { wait: 300 });
  const shares = t.$$("[data-glswatches] .pal span").map(s => parseInt(s.textContent, 10) || 0);
  t.expect(shares[0] >= Math.max(...shares), "By area doesn't lead with the biggest color");
  await t.click('[data-glo="out"]', { wait: 300 });
  const answers = () => t.ev(`lnS().ev.filter(e => e.e === "answer" && /-it$/.test(e.by || "")).length`);
  const n0 = answers();
  await t.click(await t.waitFor(".tq-open", 8000, "the Name its colors button"), { wait: 500 });
  for (let r = 0; r < 3; r++) {
    await t.waitFor(".tq-opts button, .tq.finding", 6000, `round ${r + 1}`);
    if (t.$(".tq.finding")) t.ev(`(() => { const f = document.querySelector(".tq-frame"), b = f.getBoundingClientRect(); f.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: b.left + b.width / 2, clientY: b.top + b.height * .4 })); })()`);
    else await t.click(".tq-opts button", { wait: 300 });
    await t.click(await t.waitFor(".tq-next", 4000, `round ${r + 1}'s answer`), { wait: 400 });
  }
  await t.waitFor(".tq-learn", 4000, "the end of the quiz");
  t.expect(answers() - n0 === 3, `the quiz logged ${answers() - n0} answers, not 3`);
  t.expect(t.ev(`lnS().ev.slice(-6).filter(e => e.e === "answer").every(e => e.c && e.src === "painting")`), "an answer was logged without its name");
  await t.click(".tq-learn", { wait: 700 });
  await t.waitFor(".ls-sheet", 5000, "the Learn sheet from the quiz");
  t.expect(/Helena/.test(t.text(".ls-sheet")), "the Learn sheet doesn't name the painting");
});
// Lane H (design/IMPROVE-2026-10-08/PLAN.md): Across the line clicks. The anchor chip shows the word's own color,
// a right answer offers the neighbor word, adding it makes a review card due tomorrow, a miss says "In ColorHub's
// map", and each answer is logged to the Learner Model with names.
scenario("train", "Across the line: anchor, add the neighbor word, honest miss, answers logged with names", async t => {
  await t.open("#/train", { settle: 600 });
  t.ev("S.scr = { ok: true, t: today() }; ooAcross()");   // past the one-time screen check
  await t.click(await t.waitFor("[data-go]", 8000, "Play eight rounds"), { wait: 600 });
  await t.waitFor(".oo-line .oo-board .oo-t", 10000, "the first board");
  const anc = t.ev("(() => { const a = document.querySelector('#ooq .oo-lanchor'); return a ? getComputedStyle(a).backgroundColor + ' ' + a.getBoundingClientRect().width : null; })()");
  t.expect(anc && /rgb/.test(anc) && parseFloat(anc.split(" ").pop()) >= 16, `no anchor swatch beside the word (${anc})`);
  const ev0 = t.ev("S.learn && S.learn.ev ? S.learn.ev.length : 0");
  await t.click(t.$$(".oo-line .oo-board .oo-t")[t.ev("OO_LAST.ans[0]")], { force: true, wait: 700 });
  await t.waitFor(".oo-lstrip", 4000, "the reveal strip");
  const add = t.$("[data-ladd]");
  if (add) {
    const n0 = t.ev("Object.keys(S.cards).length");
    await t.click(add, { wait: 400 });
    t.expect(t.ev("Object.keys(S.cards).length") === n0 + 1, "Add to your words made no review card");
    t.expect(t.$(".oo-ladded"), "the add row didn't settle");
  } else t.notes.push("the neighbor word was already yours");
  const ev1 = t.ev("S.learn.ev.slice(-3).map(r => r.e + ':' + (r.c || '') + ':' + (r.by || '')).join('|')");
  t.expect(t.ev("S.learn.ev.length") > ev0 && /answer:[^:]+:game/.test(ev1), `the answer wasn't logged with a name (${ev1})`);
  await t.click("[data-next]", { wait: 700 });
  await t.waitFor(".oo-line .oo-board .oo-t:not(:disabled)", 10000, "the second board");
  await t.click(t.$$(".oo-line .oo-board .oo-t")[(t.ev("OO_LAST.ans[0]") + 1) % t.$$(".oo-line .oo-board .oo-t").length], { force: true, wait: 700 });
  t.expect(/In ColorHub's map/.test(t.text("#oofoot")), `the miss line isn't honest: "${t.text("#oofoot")}"`);
  t.expect(t.ev("S.learn.ev.some(r => r.e === 'confuse' && r.src === 'across' && r.c && r.b)"), "the miss wasn't logged as a named mix-up");
});

// ================================================================== ONE TODAY (PLAN.md lane B)
scenario("one-today", "todayPick names a color and the painting that holds it; the Museum Art cover, Today's painting and the Learn card all quote it", async t => {
  await t.open("#/explore", { settle: 600 });
  t.expect(t.ev("typeof todayPick") === "function", "todayPick isn't loaded");
  const pk = t.ev(`(() => { const p = todayPick(); return p && { c: p.color.n, h: p.color.h, id: p.painting.id, s: p.painting.share, bs: p.board.seed, bp: p.board.painting, dc: dailyColor().n, same: JSON.stringify(todayPick()) === JSON.stringify(todayPick(today())) }; })()`);
  t.expect(pk && pk.c && pk.id && pk.s >= 2 && pk.bs === pk.h && pk.bp === pk.id && pk.same, "todayPick isn't {color, painting at 2%+, board}: " + JSON.stringify(pk));
  t.expect(pk.dc.toLowerCase() === pk.c.toLowerCase(), `dailyColor is ${pk.dc}, not ${pk.c}`);
  const note = () => t.text('.xp-cover[data-part="art"] .xp-note');
  await t.waitFor(() => new RegExp(pk.c, "i").test(note()) && / in /.test(note()), 8000, "the Art cover to name today's color and painting");
  const e = await t.ev(`dpLoad().then(e => ({ id: e.id, t: e.t }))`);
  t.expect(e && e.id === pk.id, `Today's painting is ${e && e.id}, not ${pk.id}`);
  t.expect(note().includes(e.t), "the Art cover doesn't name today's painting");
  await t.open("#shot=learn", { settle: 600 });
  await t.waitFor(".lr-tc-chip.on", 8000, "the Learn card's color chip on the painting");
});

// ---- the painting map (js/paintmap.js) and painting favorites (js/favs.js §4–5) ----
scenario("paintmap", "the map lays out, a tap glides a painting to the middle, the middle one opens, Back lands on it again", async t => {
  await t.open("#/paintings/map?arr=color", { settle: 800 });
  await t.waitFor(() => t.w.PM_CTRL && t.w.PM_CTRL.count > 20000 && t.w.PM_CTRL.drawn > 30, 20000, "the map to lay out thousands of paintings");
  const cv = t.$(".pmx-cv"), r = cv.getBoundingClientRect(), c0 = t.w.PM_CTRL.center;
  t.expect(c0 >= 0, "nothing in the middle");
  await t.tapAt(cv, r.left + r.width / 2, r.top + r.height / 2 - 210, { wait: 900 });
  await t.waitFor(() => t.w.PM_CTRL.center !== c0, 6000, "a tap above the middle to glide that painting to the middle");
  const c1 = t.w.PM_CTRL.center;
  await t.tapAt(cv, r.left + r.width / 2, r.top + r.height / 2, { wait: 900 });
  await t.waitFor(() => /#\/gallery\//.test(t.w.location.hash), 10000, "the middle painting to open");
  t.expect(t.w.location.hash.startsWith("#/gallery/" + c1), `opened ${t.w.location.hash}, not the painting in the middle (${c1})`);
  await t.waitFor("[data-fva]", 8000, "the heart under the painting");
  t.expect(!t.$(".gl-hero .sq-key"), "the black-and-white button is still on the painting");
  await t.click("[data-back]", { wait: 900 });
  await t.waitFor(() => t.w.PM_CTRL && t.$(".pmx-cv") && t.w.PM_CTRL.center === c1, 12000, "Back to the map, with the same painting in the middle");
});
scenario("paintmap", "arrange by time and painter and around the middle one then filter by century (counts and address follow)", async t => {
  await t.open("#/paintings/map?arr=color&co=France", { settle: 800 });
  await t.waitFor(() => t.w.PM_CTRL && t.w.PM_CTRL.count > 100, 20000, "the map of France");
  const n = t.w.PM_CTRL.count;
  for (const k of ["time", "painter"]) {
    await t.click(".pmx-do", { wait: 300 });
    await t.waitFor(`.pmx-stem [data-pmdo="${k}"]`, 4000, "the corner's arc");
    await t.click(`.pmx-stem [data-pmdo="${k}"]`, { force: true, wait: 600 });
    await t.waitFor(() => t.w.PM_CTRL.spec.arr === k && t.w.PM_CTRL.drawn > 0, 8000, `the ${k} arrangement`);
    t.expect(t.w.PM_CTRL.count === n, `${k} shows ${t.w.PM_CTRL.count} paintings, not the same ${n}`);
    t.expect(t.text("[data-pmwhy]").length > 10, `${k}: no line saying what position means`);
  }
  const mid = t.w.PM_CTRL.center;
  await t.click(".pmx-do", { wait: 300 });
  await t.waitFor('.pmx-stem [data-pmdo="similar"]', 4000, "the corner's arc");
  await t.click('.pmx-stem [data-pmdo="similar"]', { force: true, wait: 900 });
  await t.waitFor(() => t.w.PM_CTRL.spec.arr === "similar" && t.w.PM_CTRL.center === mid, 8000, "the painting in the middle to stay there as the seed");
  t.expect(/arr=similar/.test(t.w.location.hash) && /seed=/.test(t.w.location.hash), `the address doesn't carry the arrangement: ${t.w.location.hash}`);
  await t.click("[data-pmfilter]", { wait: 600 });
  await t.waitFor(".pmx-sheet [data-pmcent]", 6000, "the filter sheet");
  const chip = t.$$(".pmx-sheet [data-pmcent]").find(b => !b.disabled && +(b.querySelector("em") || { textContent: "0" }).textContent.replace(/\D/g, "") > 20);
  t.expect(chip, "no century with paintings");
  await t.click(chip, { force: true, wait: 400 });
  const want = +t.text(".pmx-sheet [data-pmn]").replace(/\D/g, "");
  t.expect(want > 0 && want < n, `a century didn't narrow the count (${want} of ${n})`);
  await t.click(".pmx-sheet [data-pmgo]", { force: true, wait: 900 });
  await t.waitFor(() => Math.abs(t.w.PM_CTRL.count - want) <= 1, 8000, "the map to show the filtered paintings");
  t.expect(/y0=\d+/.test(t.w.location.hash), `the address doesn't carry the years: ${t.w.location.hash}`);
});
scenario("favs", "a painting's heart (now in the top bar) and a double-tap on the picture both keep it; the shelf sorts favorites into kinds with counts, remembered", async t => {
  await t.open("#/gallery/8136", { settle: 800 });
  await t.waitFor("[data-fva]", 14000, "the heart under the painting");
  t.expect(!!t.$(".art-top [data-fva]"), "the heart isn't in the top bar beside the museum link, where it's visible without scrolling");
  // double-tap to like (Instagram-style): a quick second tap on the picture favorites it, with a heart burst,
  // before its single-tap action (name a spot) gets to fire
  const hero = t.$(".gl-hero>span");
  await t.click(hero, { wait: 100 });
  await t.click(hero, { wait: 500 });
  t.expect(t.ev("Object.keys(S.favArt || {}).length") === 1, "a double-tap on the painting didn't favorite it");
  t.expect(t.$("[data-fva]").getAttribute("aria-pressed") === "true", "the heart didn't fill after the double-tap");
  await t.click("[data-fva]", { wait: 400 });
  t.expect(t.ev("Object.keys(S.favArt || {}).length") === 0, "the heart button didn't un-favorite it again");
  await t.click("[data-fva]", { wait: 400 });
  t.expect(t.$("[data-fva]").getAttribute("aria-pressed") === "true", "the heart didn't fill");
  t.expect(t.ev("Object.keys(S.favArt || {}).length") === 1, "the painting isn't in favorites");
  t.ev(`S.favs = { "#008080": { n: "Teal", at: today() }, "#4682B4": { n: "Steel blue", at: today() } }; S.fvCat = "all"; save(); favShelf()`);
  await t.waitFor(".fv-cats [data-fvcat]", 6000, "the kinds on the shelf");
  const kinds = t.$$(".fv-cats [data-fvcat]").map(b => b.dataset.fvcat).join(",");
  t.expect(kinds === "all,colors,paintings", `the shelf's kinds are ${kinds}`);
  t.expect(t.$$(".fv-group").length === 2, "All doesn't show one section per kind");
  await t.click('.fv-cats [data-fvcat="paintings"]', { wait: 400 });
  await t.waitFor(".fva-grid .fva-pin", 4000, "the paintings grid");
  t.expect(t.ev("S.fvCat") === "paintings", "the chosen kind isn't remembered");
  await t.click(".fva-grid .fva-pin", { wait: 900 });
  await t.waitFor(() => /#\/gallery\/8136/.test(t.w.location.hash), 10000, "a kept painting to open");
});

// ---------- the bubble <-> page move and the exact return (js/mapxfer.js, honey.js HONEY_RET; David, 2026-10-08) ----------
const MXT = {
  // both corners drawn, opaque and the top thing under a finger
  corners(t, when) {
    for (const sel of ["[data-rooms-corner]", "#hmDo"]) {
      const b = t.$(".screen.hm " + sel); t.expect(b, `${when}: no ${sel}`);
      const cs = t.w.getComputedStyle(b);
      t.expect(+cs.opacity > .95 && cs.visibility !== "hidden" && cs.pointerEvents !== "none", `${when}: ${sel} is hidden (opacity ${cs.opacity}, ${cs.pointerEvents})`);
      t.expect(!t.reachable(b), `${when}: ${sel} ${t.reachable(b)}`);
    }
    t.expect(!t.$(".chrome-hide"), `${when}: .chrome-hide left on`);
  },
  async pan(t, dx, dy) {
    const cv = t.$(".screen.hm canvas"), r = cv.getBoundingClientRect();
    const o = (x, y) => ({ bubbles: true, cancelable: true, clientX: r.left + x, clientY: r.top + y, pointerId: 21, pointerType: "touch", isPrimary: true, view: t.w });
    cv.dispatchEvent(new t.w.PointerEvent("pointerdown", o(190, 480)));
    for (let i = 1; i <= 12; i++) { cv.dispatchEvent(new t.w.PointerEvent("pointermove", o(190 + dx * i / 12, 480 + dy * i / 12))); await t.sleep(16); }
    await t.sleep(200);
    cv.dispatchEvent(new t.w.PointerEvent("pointerup", o(190 + dx, 480 + dy)));
    await t.sleep(700);
  },
  // tap the middle bubble (it opens on one tap), check the page grew from it, go Back, check the view came back exactly
  async roundTrip(t, when) {
    // the pan at rest (a pan's release springs onto a bubble for a moment)
    t.ev("HM_CTRL._settle()");   // the pan at rest (a release springs onto a bubble; headless frames may not run it)
    let before, cur, at;
    // a tap may first zoom onto a small bubble (the zoomed-out rule): then the next tap on the same one opens it
    for (let k = 0; k < 3 && !t.$(".cp-page [data-back]"); k++) {
      t.ev("HM_CTRL._settle()");
      before = t.ev("HM_CTRL.panValue()"); cur = t.ev("HM_CTRL.current()"); at = t.ev(`HM_CTRL.locate(${JSON.stringify(cur.h)})`); at.top = t.$(".screen.hm canvas").getBoundingClientRect().top;   // (in canvas px: a headless entrance may still hold the screen a few px down)
      t.expect(at && at.d > 20, `${when}: no middle bubble to tap`);
      await t.tapAt(t.$(".screen.hm canvas"), at.x, at.y, { wait: 30 });
      try { await t.waitFor(".cp-page [data-back]", 1500, "", 600); } catch (e) {}
    }
    await t.waitFor(".cp-page [data-back]", 10000, `${when}: the page for ${cur.n}`);
    await t.waitFor(() => !t.$(".mx") && !t.$(".mx-hold"), 6000, `${when}: the grow to finish`);
    t.expect(t.$(".cp-hero").style.getPropertyValue("--c").trim().toUpperCase() === String(cur.h).toUpperCase(), `${when}: the page's color is not the tapped bubble's`);
    await t.click(".cp-page [data-back]", { wait: 60 });
    await t.waitFor(() => t.$$(".screen.hm canvas").length === 1 && !t.$(".mx") && !t.$(".mx-floor"), 8000, `${when}: back on the map with the shrink done`);
    await t.sleep(120);
    const after = t.ev("HM_CTRL.panValue()"), at2 = t.ev(`HM_CTRL.locate(${JSON.stringify(cur.h)})`), top2 = t.$(".screen.hm canvas").getBoundingClientRect().top;
    t.expect(Math.hypot(after[0] - before[0], after[1] - before[1]) < .01 && Math.abs(after[2] - before[2]) < .01, `${when}: the view moved: ${before.map(v => v.toFixed(3))} -> ${after.map(v => v.toFixed(3))}`);
    t.expect(at2 && Math.hypot(at2.x - at.x, (at2.y - top2) - (at.y - at.top)) < 1, `${when}: ${cur.n} came back at ${at2 && [at2.x, at2.y].map(Math.round)}, was ${[at.x, at.y].map(Math.round)}`);
    MXT.corners(t, when);
    return cur.n;
  },
};
scenario("map-return", "exact return after pan and zoom", async t => {
  await H.homeReady(t);
  await MXT.pan(t, -95, -80);
  t.ev("HM_CTRL.zoom(0.8, false)");
  await t.sleep(150);
  const n1 = await MXT.roundTrip(t, "after a pan and zoom");
  await MXT.pan(t, 70, 110);   // pan again from the restored view, tap, Back
  const n2 = await MXT.roundTrip(t, "after a second pan");
  t.notes.push(`${n1}, ${n2}: same view within .01, same spot within 1px`);
});
scenario("map-return", "exact return in a lit set", async t => {
  await H.homeReady(t);
  t.ev("csOnMap(colorSet({ kind: 'color', id: 'mx-teal', title: 'Teals', colors: [{ h: '#008080' }, { h: '#367588' }, { h: '#00827F' }, { h: '#4E8975' }] }))");
  await t.waitFor(() => t.$(".screen.hm canvas") && t.ev("typeof HONEY_HL !== 'undefined' && !!HONEY_HL"), 12000, "the map with the set lit");
  await t.sleep(900);
  const n = await MXT.roundTrip(t, "a lit set");
  t.expect(t.ev("typeof HONEY_HL !== 'undefined' && !!HONEY_HL"), "the lit set went out on the way back");
  t.notes.push(`${n} in a lit set`);
});
scenario("map-return", "exact return in Rings", async t => {
  await H.homeReady(t);
  t.ev("S.hm.arr = 'rings'; save(); hmHome()");
  await t.waitFor(() => t.$(".screen.hm canvas") && t.ev("S.hm.arr === 'rings' && !!HM_CTRL.studyPoints()"), 10000, "the map in Rings");
  await t.sleep(500);
  await MXT.pan(t, -40, -60);
  const n = await MXT.roundTrip(t, "Rings");
  t.notes.push(`${n} in Rings`);
});
scenario("map-return", "set changed: tapped color under the same point", async t => {
  await H.homeReady(t);
  await MXT.pan(t, -60, -50);
  t.ev("HM_CTRL._settle()");
  const cur = t.ev("HM_CTRL.current()"), at = t.ev(`HM_CTRL.locate(${JSON.stringify(cur.h)})`);
  await t.tapAt(t.$(".screen.hm canvas"), at.x, at.y, { wait: 30 });
  await t.waitFor(".cp-page [data-back]", 10000, "the page");
  t.ev("S.hm.src = S.hm.src === 'stage:400' ? 'stage:800' : 'stage:400'; save()");   // a different set of colors
  await t.click(".cp-page [data-back]", { wait: 60 });
  await t.waitFor(() => t.$$(".screen.hm canvas").length === 1 && !t.$(".mx"), 10000, "back on the map");
  await t.sleep(200);
  const at2 = t.ev(`HM_CTRL.locate(${JSON.stringify(cur.h)})`);
  t.expect(at2 && Math.hypot(at2.x - at.x, at2.y - at.y) < 3, `${cur.n} came back at ${at2 && [at2.x, at2.y].map(Math.round)}, was ${[at.x, at.y].map(Math.round)}`);
  MXT.corners(t, "after the set changed");
});
scenario("map-return", "corners back after the Colors sheet", async t => {
  await H.homeReady(t);
  await MXT.pan(t, -50, -30);
  await H.menu(t, "colors");
  await t.waitFor(".hm-chooser", 6000, "the Colors sheet");
  const b = t.$('.hm-chooser [data-src^="stage:"]:not(.on)'); t.expect(b, "no other stage to pick");
  await t.click(b, { wait: 500 });
  await t.click(".hm-chooser [data-sheet-close]", { wait: 600 });
  await t.waitFor(() => !t.$(".sheet"), 4000, "the sheet to close");
  MXT.corners(t, "after the Colors sheet");
});
scenario("pages", "double-tap the cover to favorite", async t => {
  await H.openPage(t, "#/color/teal");
  const hero = t.$(".cp-hero"), r = hero.getBoundingClientRect(), h = t.$(".cp-hex").dataset.copy;
  const tap = () => { const o = { bubbles: true, cancelable: true, clientX: r.left + r.width / 2, clientY: r.top + 160, pointerId: 31, pointerType: "touch", isPrimary: true, view: t.w }; hero.dispatchEvent(new t.w.PointerEvent("pointerdown", o)); hero.dispatchEvent(new t.w.PointerEvent("pointerup", o)); };
  const has = () => t.ev(`fvHas(${JSON.stringify(h)})`), was = has();
  tap(); await t.sleep(60);
  t.expect(has() === was && !t.$(".rp-like"), "a single tap changed the favorite");
  tap(); await t.sleep(80);
  t.expect(has() === !was, "a double tap did not toggle the favorite");
  t.expect(t.$(".cp-hero .rp-like"), "no heart bloomed where you tapped");
  await t.sleep(400);
  tap(); await t.sleep(60); tap(); await t.sleep(80);
  t.expect(has() === was, "a second double tap did not undo it");
  const hx = t.$(".cp-hex"), up = () => hx.dispatchEvent(new t.w.PointerEvent("pointerup", { bubbles: true, clientX: 10, clientY: 10, isPrimary: true, view: t.w }));
  up(); up();
  t.expect(has() === was, "a double tap on the hex button toggled the favorite");
});

// David (2026-10-09): "color > painting > color in the painting, then I have to go back all the way to reach the map".
// Close (top right, labeled) exits everything: the map exactly as it was, the trail forgotten, Back stays on the map.
scenario("trail", "Close from color > painting > color: the map as it was, the trail forgotten, corners back", async t => {
  await TRL.open(t, "#/home");
  await t.waitFor(".hm canvas", 12000, "the map");
  await t.sleep(500);
  await MXT.pan(t, -70, -55);
  const pan0 = t.ev("HM_CTRL._settle()");
  t.ev("hmOpenColor(BYNAME.get('cobalt'))");
  await TRL.atHash(t, /^#\/color\/cobalt/, "the cobalt page");
  t.expect(t.$("#app .screen .cp-hero [data-tl-exit]") && /Close/.test(t.text("#app .screen .cp-hero [data-tl-exit]")), "the color page has no labeled Close");
  t.expect(t.$(".rp-bar [data-tl-exit]"), `the pinned color header has no Close (bar: ${!!t.$(".rp-bar")}, exits: ${t.$$("[data-tl-exit]").length}, tl: ${t.$("#app .screen").dataset.tl})`);
  const sec = await t.waitFor("[data-glin]", 12000, "the In paintings section");
  const fold = sec.closest("details:not([open])"); if (fold) await t.click(fold.querySelector("summary"), { wait: 300 });
  const pin = await t.waitFor(() => { sec.scrollIntoView(); t.w.dispatchEvent(new t.w.Event("scroll")); return t.$$("[data-pt-rail] .gl-pin, [data-pt-rail] .pin, [data-glin] [data-gi]")[0]; }, 25000, "a painting in cobalt's rail");
  pin.scrollIntoView({ block: "center" }); await t.sleep(200);
  await t.click(pin, { wait: 600 });
  await TRL.atHash(t, /^#\/gallery\/\d+/, "the painting page");
  t.expect(t.$("#app .screen [data-tl-exit]"), "the painting page has no Close");
  await t.waitFor(() => t.$$("[data-glswatches] [data-swatch]").length, 15000, "the painting's palette");
  await t.click(t.$$("[data-glswatches] [data-swatch]")[0], { wait: 600 });
  await TRL.atHash(t, /^#\/(color|name)\//, "a color from the painting");
  t.expect(TRL.depth(t) >= 3, `the trail holds ${TRL.depth(t)} pages, expected 3`);
  t.w.scrollTo(0, 0); await t.sleep(200);
  await t.click("#app .screen .cp-hero [data-tl-exit]", { wait: 300 });
  await t.waitFor(() => t.$$(".screen.hm canvas").length === 1 && !t.$(".mx") && !t.$(".mx-floor"), 10000, "the map after Close");
  await t.sleep(300);
  t.expect(TRL.depth(t) === 0, `Close left ${TRL.depth(t)} pages on the trail`);
  const pan1 = t.ev("HM_CTRL._settle()");
  t.expect(Math.hypot(pan1[0] - pan0[0], pan1[1] - pan0[1]) < .01 && Math.abs(pan1[2] - pan0[2]) < .01, `the map moved: ${pan0.map(v => v.toFixed(3))} -> ${pan1.map(v => v.toFixed(3))}`);
  MXT.corners(t, "after Close");
  // the chain is forgotten: the browser's Back (the iOS swipe) stays on the map
  t.w.history.back(); await t.sleep(800);
  t.expect(t.$(".screen.hm canvas") && !t.$(".cp-page") && !t.$(".room-sheet"), `Back after Close left the map (${TRL.hash(t)})`);
});

// David's iPhone (2026-10-09): on a color's cover, ‹ and Close sat on the status bar. With an iPhone's safe area (59px,
// simulated here), every inner page's ‹ and Close sit below it.
scenario("pages", "with an iPhone safe area, ‹ and Close sit below the status bar on every kind of inner page", async t => {
  const INSET = 59, bad = [];
  for (const hash of ["#/color/cobalt", "#/name/rose-pink", "#/read/mauve", "#/hub/source:crayola", "#/gallery/15146", "#/pair/4f6b3a+c2412d"]) {
    await t.open(hash, { settle: 300 });
    { const st = t.w.document.createElement("style"); st.textContent = `:root{--top:${INSET}px !important}`; t.w.document.head.appendChild(st); }   // a simulated iPhone safe area
    t.w.location.hash = "#/home"; await t.sleep(300); t.w.location.hash = hash; await t.sleep(300);   // drawn again with the inset in place
    await t.waitFor(() => t.$("#app .screen [data-back]") && t.$("#app .screen [data-tl-exit]") && !t.$(".screen.waiting"), 15000, `‹ and Close on ${hash}`);
    t.w.scrollTo(0, 0); await t.sleep(80);
    for (const sel of ["[data-back]", "[data-tl-exit]"]) {
      const r = t.$("#app .screen " + sel).getBoundingClientRect();
      if (r.top < INSET + 6) bad.push(`${hash} ${sel} at ${Math.round(r.top)}px`);
    }
  }
  t.expect(!bad.length, `on the status bar: ${bad.join(", ")}`);
});
