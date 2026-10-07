"use strict";
// Content files are optional (they grow as the wiki is written): load whatever exists, then start.
const OPTIONAL_DATA = ["data/wiki-colors.js", "data/wiki-nodes.js", "data/stories.js", "data/paintings.js"];
// Screenshot mode for design review: index.html#shot=<screen> renders one screen with sample progress
// (in memory only; nothing is saved). Used by tools/shots.sh.
const SHOT = location.hash.startsWith("#shot=") ? decodeURIComponent(location.hash.slice(6)) : null;
Promise.all(OPTIONAL_DATA.map(src => new Promise(done => {
  const s = document.createElement("script"); s.src = src; s.onload = s.onerror = done; document.head.appendChild(s);
}))).then(() => { if (SHOT) return shot(SHOT); S.placed ? go(S.tab || "learn") : welcome(); });

function shot(name) {
  S = Object.assign(fresh(), { placed: { tier: 2, at: today() }, done: { "t2-blues": today() } });
  const pool = ALL.slice().sort((a, b) => a.id.localeCompare(b.id)).filter((_, i) => i % 3 === 0);
  pool.slice(0, 30).forEach((c, i) => { S.cards[c.id] = { b: 1, due: addDays(today(), 3), own: i < 24 }; });
  S.gym.skills = { hue: { level: 2.6, best: 2.4, hist: [["a", 7], ["b", 5.2], ["c", 3.9], ["d", 3.1], ["e", 2.6]], fam: { Blues: 2.1, Reds: 2.8, Greens: 3.4, Greys: 1.9 } },
    temp: { level: 4.8, best: 4.6, hist: [["a", 9], ["b", 6.4], ["c", 4.8]], fam: {} } };
  S.best.lightning = 14;
  const [screen, arg] = name.split(":"), g = () => graph();
  const later2 = (f, ms) => setTimeout(f, ms);
  switch (screen) {
    case "welcome": return welcome();
    case "learn": return go("learn");
    case "gym": return go("gym");
    case "explore": S.lens = arg || "all"; return go("explore");
    case "meet": meet(UNITS[1]); if (arg) later2(() => { const p = document.getElementById("pager"); p.scrollTop = p.clientHeight * +arg; }, 300); return;
    case "deck": deck("learn", { unit: UNITS[1] }); later2(() => dispatchEvent(new KeyboardEvent("keydown", { key: " " })), 600); return;
    case "drill": return runDrill(arg || "hue", { trials: 10, done: () => {} });
    case "closeup": return closeup(g().nodes.get(arg || "c:Cobalt"));
    case "page": return openNode(g().nodes.get(arg || "alchemy"));
    case "story": { const st = g().stories[+arg || 0]; return storyPlayer(st); }
    case "daily": S.daily = {}; return daily();
    case "lab": return LAB[arg || "harmony"]();
  }
}
