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

// ================================================================== EXPLORE
for (const [part, expect] of [["all", ".x-feed .pin, .x-feed [data-pin]"], ["art", ".xb-pick"], ["ideas", ".x-feed .pin, .x-feed [data-pin]"], ["world", "#world *"]]) {
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
  await t.waitFor(() => t.$$(".ar-fig").length >= 2, 25000, "the article's figure cards");
  const figs = t.$$(".ar-fig");
  t.expect(figs.length <= 5, `${figs.length} auto-figures, the limit is 5`);
  t.expect(figs.every(f => /\d+% match to Mauve/.test(t.text(f.querySelector(".ar-fig-m")))), "a card is missing its '% match to Mauve' line");
  t.expect(figs.every(f => [112, 88].includes(f.querySelector(".ar-fig-im").getBoundingClientRect().width)), "a card's picture box lost its fixed size");
  const secs = figs.map(f => (f.closest("[data-ar-sec]") || {}).id || "seen").filter(x => x !== "seen");
  t.expect(new Set(secs).size === secs.length, "two figures landed in one section");
  const card = t.$('.ar-fig[data-kind="gem"] .ar-fig-b') || t.$(".ar-fig .ar-fig-b");
  const title = t.text(card.querySelector(".ar-fig-n"));
  await t.click(card, { wait: 700 });
  await t.waitFor(() => !t.$(".ar") && t.$(".p-title, .cp-hero-foot h1, .gl-page, .film-page"), 10000, `the page for "${title}"`);
  await t.click("[data-back]", { wait: 600 });
  await t.waitFor(() => t.$(".ar") && t.$$(".ar-fig").length >= 2, 20000, "the article and its figures after Back");
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
  // the Learn button opens the instant-deck sheet (js/practice.js); Learn it is one of its methods
  if (t.$(".pr-quick")) { await t.click('[data-method="lesson"]', { wait: 200 }); await t.click(".pr-quick [data-go]", { wait: 600 }); }
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
  await t.waitFor(".pr-quick", 4000, "the instant-deck sheet");
  await t.click('.pr-quick [data-size="5"]', { wait: 150 });
  await t.click('.pr-quick [data-method="cards"]', { wait: 150 });
  await t.click(".pr-quick [data-go]", { wait: 600 });
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
  await t.click("[data-pr-study]", { wait: 600 });
  await t.waitFor(".pr-quick", 4000, "the instant-deck sheet from Home");
  t.expect(/Learn/.test(t.$("[data-qtitle]").textContent), "the sheet title");
  t.expect(t.$$(".pr-quick .pr-plate i").length >= 5, "the deck plate");
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

// ================================================================== LEARN (past the first units: js/learnmore.js)
scenario("learn", "the path goes past the first units: Begin teaches a generated unit as core cards", async t => {
  await t.open("#shot=lx:room", { settle: 600 });
  await t.waitFor(".path-list .lx-stage-h", 10000, "the path's current stage header");
  t.expect(/of 655 · Fluent/.test(t.text(".coll-n")), `the collection counts toward Fluent ("${t.text(".coll-n")}")`);
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
  await t.waitFor(".pr-quick [data-method='lesson']", 6000, "Practice's sheet offering Learn it for a name past the first units");
  await t.click("[data-method='lesson']", { wait: 300 });
  await t.click(".pr-quick [data-go]", { wait: 700 });
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
scenario("paintings", "a pair page, the masters' chords, and a painting with its color pinned", async t => {
  await t.open("#/pair/c2412d+4f6b3a", { settle: 600 });
  await t.waitFor(".pt-finding", 12000, "the pair page");
  await PT.count(t);
  t.expect(t.$$(".pt-chip").length === 2, "the pair page doesn't show two colors");
  await t.open("#/chords", { settle: 600 });
  await t.waitFor(".chd-row", 12000, "chord rows");
  t.expect(t.$$(".chd-row").length >= 10, "fewer than ten chords");
  await t.click('[data-kind="avoid"]', { wait: 400 });
  t.expect(t.$$(".chd-row").length >= 5, "no pairs painters keep apart");
  await t.click('[data-kind="pairs"]', { wait: 300 });
  await t.click(".chd-row", { force: true, wait: 700 });
  await t.waitFor(".pt-page .pt-chip", 12000, "a pair opened from a chord");
  await t.open("#/gallery/15146?c=0047ab&t=3", { settle: 800 });
  await t.waitFor(() => /covers/.test(t.text(".pt-arrive")), 14000, "the pinned coverage line");
  t.expect(t.$(".pt-arrive [data-t]"), "no tolerance switch on the arrival");
});
scenario("paintings", "a color page's In paintings section: presets re-run the query; Fine-tune opens the sliders", async t => {
  await t.open("#/color/cobalt", { settle: 800 });
  const sec = await t.waitFor("[data-glin]", 12000, "the In paintings section");
  sec.scrollIntoView();
  await t.waitFor("[data-pt-quick] [data-pre-tol]", 15000, "the tolerance presets");
  await t.waitFor(() => t.$$("[data-pt-rail] .gl-pin, [data-pt-rail] .pin").length > 0 || /No painting/.test(t.text("[data-pt-lead]")), 20000, "the rail or an honest empty line");
  await t.click('[data-pt-quick] [data-pre-tol="10"]', { force: true, wait: 600 });
  await t.click("[data-pt-tune]", { force: true, wait: 400 });
  t.expect(t.$$("[data-pt-tuner] .pt-range").length === 2, "Fine-tune doesn't open two sliders");
});

// ================================================================== DIRECT LOADS (a typed or shared address on a fresh load)
scenario("pages", "a fresh load of #/painter/<slug> opens that painter, not Home", async t => {
  await t.open("#/painter/abraham-bloemaert", { settle: 600 });
  await t.waitFor(".aw-page, [data-awpainter-page], .screen.aw", 15000, "the painter page on a direct load");
  t.expect(/Bloemaert/.test(t.$("#app").innerText), "the painter's page doesn't name the painter");
  t.expect(!t.$(".hm canvas"), "a direct painter address landed on Home");
  t.expect(t.w.location.hash === "#/painter/abraham-bloemaert", `the address changed to ${t.w.location.hash}`);
});
