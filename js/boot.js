"use strict";
// Content files are optional (they grow as the wiki is written): load whatever exists, then start.
const OPTIONAL_DATA = ["data/wiki-colors.js", "data/wiki-nodes.js", "data/stories.js", "data/paintings.js"];
Promise.all(OPTIONAL_DATA.map(src => new Promise(done => {
  const s = document.createElement("script"); s.src = src; s.onload = s.onerror = done; document.head.appendChild(s);
}))).then(() => { S.placed ? go(S.tab || "learn") : welcome(); });
