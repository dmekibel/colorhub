"use strict";
// Start. The first screen draws right away from data/colors.js; the wiki (data/wiki-*.js, stories, paintings,
// photo credits) loads lazily (loader.js) and is prefetched as soon as that screen is up.
// An address like #/color/teal opens that screen (router.js).
// Screenshot mode for design review: index.html#shot=<screen> renders one screen with sample progress
// (in memory only; nothing is saved). Used by tools/shots.sh. It waits for the whole wiki first.
const SHOT = location.hash.startsWith("#shot=") ? decodeURIComponent(location.hash.slice(6)) : null;
if (SHOT) loadWiki().then(() => shot(SHOT));
else {
  ROUTE_REPLACE = true;   // the first screen takes over the page's own history entry
  if (!openRoute(location.hash, true)) S.placed ? go(S.tab || "learn") : welcome();
  prefetchWiki();
}

function shot(name) {
  S = Object.assign(fresh(), { placed: { tier: 2, at: today() }, done: { "t2-blues": today() }, profileAsked: true });
  const pool = ALL.slice().sort((a, b) => a.id.localeCompare(b.id)).filter((_, i) => i % 3 === 0);
  pool.slice(0, 30).forEach((c, i) => { S.cards[c.id] = { b: 1, due: addDays(today(), 3), own: i < 24, ownBy: i < 18 ? "pick" : "swipe" }; });
  S.gym.skills = { hue: { level: 2.6, best: 2.4, hist: [["a", 7], ["b", 5.2], ["c", 3.9], ["d", 3.1], ["e", 2.6]], fam: { Blues: 2.1, Reds: 2.8, Greens: 3.4, Greys: 1.9 } },
    temp: { level: 4.8, best: 4.6, hist: [["a", 9], ["b", 6.4], ["c", 4.8]], fam: {} },
    value: { level: 5, best: 4.2, hist: [["a", 11], ["b", 7], ["c", 5.1]], fam: {} },
    neutral: { level: 4.1, best: 3.6, hist: [["a", 7.5], ["b", 4.1]], fam: {} } };
  S.best.lightning = 14;
  const [screen, ...rest] = name.split(":"), arg = rest.join(":"), g = () => graph();   // closeup:c:Teal keeps "c:Teal"
  const later2 = (f, ms) => setTimeout(f, ms);
  switch (screen) {
    case "welcome": return welcome();
    case "how": return how();
    case "profile": return profileSetup(() => go("gym"), { why: "Before you train" });
    case "learn": return go("learn");
    // the honeycomb home (js/home.js): home, home:sheet, home:sheetfull, home:views, home:search
    case "home": return hmShot(arg);
    // the Learn it mini-lesson (js/learnit.js): learnit:<meet|tell|sort|pick|memory|done>
    case "learnit": return hmLearnitShot(arg || "meet");
    case "gym": return go("gym");
    case "studio": return go("studio");
    // a Studio photo palette, for design review (ROADMAP §17 job #1 screenshots): a synthetic canvas run
    // through the real extractPalette()/studioFromImage(), never a saved or uploaded photo
    case "studiopv": {
      const c = document.createElement("canvas"); c.width = 300; c.height = 200;
      const x = c.getContext("2d");
      [["#2F6F4E", 0, 0, 160, 110], ["#C8553D", 160, 0, 140, 110], ["#E0A458", 0, 110, 100, 90],
       ["#3F7C8C", 100, 110, 100, 90], ["#8C5E58", 200, 110, 100, 90]].forEach(([h, bx, by, bw, bh]) => { x.fillStyle = h; x.fillRect(bx, by, bw, bh); });
      return studioFromImage(c, "From a photo");
    }
    case "explore": S.lens = arg || "all"; return go("explore");
    case "meet": meet(UNITS[1]); if (arg) later2(() => { const p = document.getElementById("pager"); p.scrollTop = p.clientHeight * +arg; }, 300); return;
    case "deck": deck("learn", { unit: UNITS[1] }); later2(() => dispatchEvent(new KeyboardEvent("keydown", { key: " " })), 600); return;
    case "drill": return runDrill(arg || "hue", { trials: 10, noIntro: true, done: () => {} });
    case "gx": return gymShot(arg);
    case "screen": return screenCheck(() => go("gym"));
    case "gymres": return stationDone({ k: arg || "neutral", est: 3.2, before: 4.1, pb: true, best: 3.2 });
    case "closeup": return closeup(g().nodes.get(arg || "c:Cobalt"));
    case "name": return namesShot(arg);   // js/names.js: name:<slug>[@scrolldown], e.g. name:ecru or name:seafoam-green@700
    // a honeycomb tap on a non-101 bubble, from a bigger stage (js/home.js hmOpenName): hmname[:stage]
    case "hmname": { S.hm = S.hm || {}; S.hm.src = "stage:" + (arg || "400"); return loadCoreNames().then(() => { const item = hmStageItems(+(arg || 400)).find(it => !it.c); return item ? hmOpenName(item) : hmHome(); }); }
    case "page": return openNode(g().nodes.get(arg || "alchemy"));
    case "story": { const st = g().stories[+arg || 0]; return storyPlayer(st); }
    case "daily": S.daily = {}; return daily();
    case "lab": return LAB[arg || "harmony"]();
    // archive (js/passages.js, js/films.js): passage:<id>, passages[:<family>], film:<id>, cpage:<color> (scrolled to In books), films (Ideas lens at Films)
    case "passage": return archWhen(() => archOpen(archNode("passage", PSG.byId.get(arg) || PSG.list[0])));
    case "passages": return archWhen(() => { archOpen(PSG_INDEX_NODE()); if (arg) passagesIndexPage(arg); });
    case "film": return archWhen(() => archOpen(archNode("film", FILMS.find(f => f.id === arg) || FILMS[0])));
    case "cpage": return archWhen(() => { openNode(colorNode(BYNAME.get((arg || "Teal").toLowerCase()))); later2(() => { const r = document.querySelector(".arch-rows"); if (r) scrollTo(0, r.getBoundingClientRect().top + scrollY - 60); }, 900); });
    case "films": S.lens = "ideas"; go("explore"); return archWhen(() => later2(() => { const h = [...document.querySelectorAll(".x-sec")].find(x => /^Films/.test(x.textContent)); if (h) scrollTo(0, h.getBoundingClientRect().top + scrollY - 20); }, 1500));
    // botany (js/botany.js): botany:world, botany:plants|dyes|essays, botany:plant:<id>, botany:dye:<id>, botany:essay:<id>, botany:flori
    case "botany": { const [sub, a2] = (arg || "world").split(":");
      if (sub === "world") { S.lens = "world"; return go("explore"); }
      return btWhen(() => {
        if (sub === "flori") return btFloriPage();
        if (BT_LIST_META[sub]) return btListPage(sub);
        const n = a2 && btNode("bt:" + sub + ":" + a2);
        if (n) return openNode(n);
        S.lens = "world"; go("explore");
      }); }
    case "taste": return tasteShot(arg);
    case "poem": return poemPage(name.slice(5), {});   // poem:<poem id>
    case "poemcolor": { const n = g().nodes.get("c:" + (arg || "Crimson")); XSTACK = ["p:" + n.id]; colorPage(n); const x = document.querySelector(".c-poems"), h = document.querySelector(".c-hero"); if (x && h) h.after(x); return; }   // "In poems" moved up so one screen shows it
    case "potd": return show(`<div class="sec-head"><b>Today</b></div><div class="today">${poemOfTheDayCard()}</div>`, "", "learn");
    case "match": return openMatch(arg || "list", { shot: name.split(":")[2] || "task" });   // match:<id>[:reveal|:curves|:lvN|:done]
    case "say": case "make": case "intro": return prodShot(screen, arg);   // say:<empty|typed|right|close|wrong|gave>, make:<picking|result>, intro:<say|make>
    case "pick": case "place": case "exp": return pickShot(screen, arg);   // pick:<ask|right|wrong>, place:<ask|result>, exp:<about|test|done>
    case "colors": {   // older hook: colors:<set id>:<view id>:<act>, read through the old S.cb shape
      const [, set, view, act] = name.split(":"), def = COLOR_SETS.find(x => x.id === (set || "101")) || COLOR_SETS[0];
      S.lens = "spectrum"; S.cb = { preset: def.id, state: JSON.parse(JSON.stringify(def.state)), view: view || "map" };
      return colorExplorer({ focus: dailyColor(), pick: c => closeup(colorNode(c)), shot: act });
    }
    case "cx": {   // the explorer: cx:<choice>:<act>. choice: 101 | all | yours | 50 | 200 | 500, joined by + to a family,
      // feel or tradition id (blues+all, pastels+all, src-jp). act: sheet | tune | tuned | wheel | tap | press | zoomin
      const [, choice = "101", act = ""] = name.split(":"), ch = { which: "101" };
      choice.split("+").forEach(t => { if (["101", "all", "yours"].includes(t)) ch.which = t; else if (/^\d+$/.test(t)) { ch.which = "spread"; ch.n = +t; } else ch.narrow = t; });
      S.lens = "spectrum"; S.cb = { ch, view: act === "wheel" ? "wheel" : "map" };
      if (act === "tuned") Object.assign(S.cb, { tuned: true, state: { ...cxState(cxNorm(ch)), hue: [190, 280], L: [30, 80] } });
      return colorExplorer({ focus: dailyColor(), pick: c => closeup(colorNode(c)), shot: ["wheel", "tuned"].includes(act) ? "" : act });
    }
    case "gallery": return galleryShot(name.slice(8));   // gallery, gallery:scroll=600, gallery:color=Cobalt, gallery:adjust=Cobalt, gallery:page=12, gallery:cpage=Cobalt
    case "world": case "fashiondecade": case "fashioncoty": case "fashionhouse": case "fashionhistory":
      return typeof worldShot === "function" && worldShot(screen, arg);   // js/world.js
    // the color link sheet (ROADMAP §13, js/swatch.js) opened over a real screen: swsheet:gallery|studio|fashion
    case "swsheet": {
      if (arg === "studio") { gamutWheel(); return later2(() => nameSheet("#4CBB17"), 900); }
      if (arg === "fashion") { if (window.FASHION) fashionDecadeDetail(FASHION.decades[2].id); else fashionFallback(); return later2(() => nameSheet("#1C2B5A"), 700); }
      return loadGallery().then(() => { galleryPage(0); later2(() => nameSheet(glHex(0, 0)), 700); });
    }
    // gems (js/gems.js): gems:world, gems:gems|essays, gems:gem:<id>, gems:essay:<id>
    case "gems": { const [sub, a2] = (arg || "world").split(":");
      if (sub === "world") { S.lens = "world"; return go("explore"); }
      return gmWhen(() => {
        if (GM_LIST_META[sub]) return gmListPage(sub);
        const n = a2 && gmNode("gm:" + sub + ":" + a2);
        if (n) return openNode(n);
        S.lens = "world"; go("explore");
      }); }
  }
}

try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) {}
if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
