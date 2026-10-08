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
    const sels = ["[data-swatch]", ".lk-row[data-cp-near]", ".lk-row[data-np-near]", ".pchip[data-node]", ".kin[data-node]"];
    let target = null, used = "";
    for (const s of sels) { const e = t.$$(s, t.$("#app"))[0]; if (e) { target = e; used = s; break; } }
    t.expect(target, "no swatch / near-color / palette chip on the page to tap");
    // a section folded away in a closed <details> opens with a tap on its summary first, like a thumb would
    const fold = target.closest("details:not([open])");
    if (fold) { await t.click(fold.querySelector("summary"), { wait: 200 }); t.expect(fold.open, "the folded section did not open"); }
    await t.click(target, { wait: 400 });
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
  t.expect(t.$(".screen.hm").classList.contains("chrome-hide"), "chrome did not hide while dragging (test premise)");
  cv.dispatchEvent(new t.w.PointerEvent("pointerup", o));
  await t.sleep(4000);   // the old bug: the buttons faded and went untappable after a timer
  for (const sel of ["#hmView", "[data-rooms-corner]"]) {
    const e = t.$(sel); t.expect(e, `${sel} is missing`);
    const why = t.reachable(e); t.expect(!why, `${sel} ${why} after the honeycomb was touched`);
  }
});

scenario("home", "View sheet opens; stage chips change the count", async t => {
  await H.homeReady(t);
  await t.click("#hmView", { pointer: true });
  await t.waitFor(".hm-chooser", 10000, "the View sheet");
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

scenario("home", "View sheet: Look tab, styles and sliders", async t => {
  await H.homeReady(t);
  await t.click("#hmView", { pointer: true });
  await t.waitFor(".hm-chooser", 10000, "the View sheet");
  await t.click('.hm-chooser [data-tab="look"]');
  t.expect(!t.$('.hm-chooser [data-panel="look"]').hidden, "the Look panel did not show");
  t.expect(t.$('.hm-chooser [data-panel="show"]').hidden, "the Show panel stayed visible on the Look tab");
  const styles = t.$$(".hm-look-chip");
  t.expect(styles.length >= 3, `only ${styles.length} style chips`);
  const n0 = H.num(t.text("[data-count]"));
  for (const s of styles.filter(s => !s.classList.contains("on")).slice(0, 3)) {
    await t.click(s, { wait: 300 });
    t.expect(s.classList.contains("on"), `style chip "${t.text(s)}" did not turn on`);
  }
  const sliders = t.$$(".hm-look-sliders input[type=range]");
  t.expect(sliders.length === 4, `${sliders.length} fine-tune sliders instead of 4`);
  for (const inp of sliders) {
    const out = inp.parentElement.querySelector("b"), was = out.textContent, mid = (+inp.min + +inp.max) / 2;
    inp.value = String(+inp.value === mid ? +inp.max : mid);
    inp.dispatchEvent(new t.w.Event("input", { bubbles: true }));
    await t.sleep(150);
    t.expect(out.textContent !== was, `slider "${t.text(inp.parentElement.firstElementChild)}" did not update its readout`);
  }
  await t.click('.hm-chooser [data-tab="show"]');
  t.expect(!t.$('.hm-chooser [data-panel="show"]').hidden, "back to the Show tab did not show it");
  t.expect(H.num(t.text("[data-count]")) === n0, "looking at styles changed the item count");
  const cv = t.$("canvas"); t.expect(cv && cv.width > 0, "the honeycomb canvas disappeared");
});

scenario("home", "View sheet: filters, Surprise me, Search", async t => {
  const cv = await H.homeReady(t);
  await t.click("#hmView", { pointer: true });
  await t.waitFor(".hm-chooser", 10000, "the View sheet");
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
  await t.click("#hmView", { pointer: true });
  await t.waitFor(".hm-chooser", 6000, "the View sheet again");
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
for (const [shot, id, label, needs] of [["learn", "learn", "Learn", ".plates, .btn"], ["gym", "gym", "Train", ".gs-tile"], ["explore", "explore", "Explore", ".xp-cover"], ["studio", "studio", "Studio", "[data-wheel]"]]) {
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

// ================================================================== TRAIN
scenario("train", "check-in card opens the drill", async t => {
  await t.open("#shot=gx:due", { settle: 600 });
  const ck = await t.waitFor("[data-checkin]", 6000, "the weekly check-in card");
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

scenario("train", "Odd one out: tap tiles through a whole round", async t => {
  await t.open("#shot=gx:home", { settle: 600 });
  const st = await t.waitFor('[data-st="hue"]', 6000, "the Odd one out tile");
  await t.click(st, { wait: 500 });
  await t.waitFor(".drill .tile", 6000, "the 3x3 grid of tiles");
  t.expect(t.$$(".drill .tile").length === 9, `${t.$$(".drill .tile").length} tiles instead of 9`);
  const first = t.$(".drill #dstage").innerHTML;
  await t.click(".drill .tile", { wait: 1200 });
  t.expect(t.$(".drill #dstage").innerHTML !== first || t.$(".result"), "tapping a tile changed nothing");
  let taps = 1;
  for (let i = 0; i < 60 && !t.$(".result"); i++) {
    const b = t.$("[data-cf]") || t.$("[data-next]") || t.$(".drill .tile:not(.ring):not(.miss):not(.picked)");
    if (b) { await t.click(b, { force: true, wait: 400 }); taps++; } else await t.sleep(300);
  }
  await t.waitFor(".result", 6000, "the station result screen");
  t.expect(t.$(".result").innerText.length > 40, "the result screen is empty");
  t.notes.push(`${taps} taps to the result`);
});

// ================================================================== EXPLORE
for (const [part, expect] of [["all", ".x-feed .pin, .x-feed [data-pin]"], ["art", ".art-bubbles"], ["ideas", ".x-feed .pin, .x-feed [data-pin]"], ["world", "#world *"]]) {
  scenario("explore", `${part} cover opens and goes back`, async t => {
    await t.open("#shot=explore:all", { settle: 600 });
    const cover = await t.waitFor(`.xp-cover[data-part="${part}"]`, 8000, `the ${part} cover`);
    t.expect(t.$$(".xp-cover").length === 4, `${t.$$(".xp-cover").length} covers instead of 4`);
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

scenario("explore", "Art with a color shows pins", async t => {
  await t.open("#shot=explore:art:Denim", { settle: 600 });
  await t.waitFor(".art-band", 8000, "the Art screen");
  t.expect(/denim/i.test(t.text(".art-band .p-dek")), `Art's line says "${t.text(".art-band .p-dek")}"`);
  const pins = await t.waitFor(() => { const p = t.$$(".art-feed .pin"); return p.length >= 6 && p; }, 25000, "painting pins in the Art feed");
  t.notes.push(`${pins.length} pins`);
  const gi = t.$(".art-feed [data-gi]");
  t.expect(gi, "no painting pin to open");
  await t.click(gi, { force: true, wait: 600 });
  await t.waitFor(() => t.$(".gl-page, .cp-page, .article") && !t.$(".art-feed"), 12000, "a painting page after tapping a pin");
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

scenario("pages", "Learn it runs meet > recall from a color page", async t => {
  await H.openPage(t, "#/color/teal", "Teal");
  await t.click("[data-learnit]", { wait: 600 });
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

// ================================================================== STUDIO
scenario("studio", "gamut wheel: presets, mask, keep, swatch tap", async t => {
  await t.open("#shot=studio", { settle: 600 });
  await t.click("[data-wheel]", { wait: 700 });
  await t.waitFor("canvas.gw-wheel", 6000, "the gamut wheel");
  const presets = t.$$("[data-m]");
  t.expect(presets.length === 5, `${presets.length} mask presets instead of 5`);
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

// ================================================================== YOUR COLORS (L23: favorites, ranking, taste)
scenario("favs", "Home pick mode: tap and hold-sweep heart colors, Save keeps them", async t => {
  const cv = await H.homeReady(t);
  await t.click("#hmFav", { wait: 500 });
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
  await t.waitFor(".screen.deck", 6000, "the Learn my favorites deck");
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
  async farOut(t, src = "stage:1000") {
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
  await t.tapAt(cv, r.left + r.width / 2 + 70, r.top + r.height / 2 + 50, { wait: 600 });
  t.expect(!t.$(".cp-page"), "the first tap on a tiny bubble opened a page");
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
scenario("map", "Look: family names when zoomed out is off by default and toggles on", async t => {
  await H.homeReady(t);
  t.expect(!t.ev("S.hm.famNames"), "family names are on by default");
  await t.click("#hmView", { pointer: true });
  await t.waitFor(".hm-chooser", 10000, "the View sheet");
  t.expect(!/\b101\b/.test(t.text(".hm-chooser")), "the View sheet says 101");
  await t.click('[data-tab="look"]', { wait: 300 });
  await t.click('[data-fam="1"]', { wait: 300 });
  t.expect(t.ev("S.hm.famNames") === true && t.$('[data-fam="1"]').classList.contains("on"), "the Family names choice did not turn on");
});
