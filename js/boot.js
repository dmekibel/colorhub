"use strict";
// Content files are optional (they grow as the wiki is written): load whatever exists, then start.
const OPTIONAL_DATA = ["data/wiki-colors.js", "data/wiki-nodes.js", "data/stories.js", "data/paintings.js", "data/images.js"];
// Screenshot mode for design review: index.html#shot=<screen> renders one screen with sample progress
// (in memory only; nothing is saved). Used by tools/shots.sh.
const SHOT = location.hash.startsWith("#shot=") ? decodeURIComponent(location.hash.slice(6)) : null;
Promise.all(OPTIONAL_DATA.map(src => new Promise(done => {
  const s = document.createElement("script"); s.src = src; s.onload = s.onerror = done; document.head.appendChild(s);
}))).then(() => { if (SHOT) return shot(SHOT); S.placed ? go(S.tab || "learn") : welcome(); });

function shot(name) {
  S = Object.assign(fresh(), { placed: { tier: 2, at: today() }, done: { "t2-blues": today() }, profileAsked: true });
  const pool = ALL.slice().sort((a, b) => a.id.localeCompare(b.id)).filter((_, i) => i % 3 === 0);
  pool.slice(0, 30).forEach((c, i) => { S.cards[c.id] = { b: 1, due: addDays(today(), 3), own: i < 24, ownBy: i < 18 ? "pick" : "swipe" }; });
  S.gym.skills = { hue: { level: 2.6, best: 2.4, hist: [["a", 7], ["b", 5.2], ["c", 3.9], ["d", 3.1], ["e", 2.6]], fam: { Blues: 2.1, Reds: 2.8, Greens: 3.4, Greys: 1.9 } },
    temp: { level: 4.8, best: 4.6, hist: [["a", 9], ["b", 6.4], ["c", 4.8]], fam: {} },
    value: { level: 5, best: 4.2, hist: [["a", 11], ["b", 7], ["c", 5.1]], fam: {} },
    neutral: { level: 4.1, best: 3.6, hist: [["a", 7.5], ["b", 4.1]], fam: {} } };
  S.best.lightning = 14;
  const [screen, arg] = name.split(":"), g = () => graph();
  const later2 = (f, ms) => setTimeout(f, ms);
  switch (screen) {
    case "welcome": return welcome();
    case "how": return how();
    case "profile": return profileSetup(() => go("gym"), { why: "Before you train" });
    case "learn": return go("learn");
    case "gym": return go("gym");
    case "studio": return go("studio");
    case "explore": S.lens = arg || "all"; return go("explore");
    case "meet": meet(UNITS[1]); if (arg) later2(() => { const p = document.getElementById("pager"); p.scrollTop = p.clientHeight * +arg; }, 300); return;
    case "deck": deck("learn", { unit: UNITS[1] }); later2(() => dispatchEvent(new KeyboardEvent("keydown", { key: " " })), 600); return;
    case "drill": return runDrill(arg || "hue", { trials: 10, noIntro: true, done: () => {} });
    case "gx": return gymShot(arg);
    case "screen": return screenCheck(() => go("gym"));
    case "gymres": return stationDone({ k: arg || "neutral", est: 3.2, before: 4.1, pb: true, best: 3.2 });
    case "closeup": return closeup(g().nodes.get(arg || "c:Cobalt"));
    case "page": return openNode(g().nodes.get(arg || "alchemy"));
    case "story": { const st = g().stories[+arg || 0]; return storyPlayer(st); }
    case "daily": S.daily = {}; return daily();
    case "lab": return LAB[arg || "harmony"]();
    case "taste": return tasteShot(arg);
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
  }
}

try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) {}
if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
