"use strict";
// Page actions (design/SIMPLIFY/PLAN.md §3.6/§9): "at most 3 actions on the surface... one paper, two
// secondary." Stubbed by Lane 1 (the day-0 contract); owned by Lane 4, which wires each page's own row
// through it (js/gallery.js, js/richpage.js, js/setpage.js, js/artwiki.js). pageActions(el, actions) renders
// nothing on its own screen until a lane calls it from its own markup -- it's a helper, not a gate.
//
// actions: [{ t (label), icon?, primary? (paper, at most one), run }], length <= 3.
function pageActions(el, actions = []) {
  if (actions.length > 3) console.warn("pageActions: more than 3 actions passed; the surface rule is PLAN §3.6 (at most 3, one paper)", actions.map(a => a.t));
  const html = actions.slice(0, 3).map((a, i) => `<button type="button" class="btn${a.primary ? "" : " ghost"}" data-pk="${i}">${a.icon ? a.icon : ""}${esc(a.t)}</button>`).join("");
  const host = typeof el === "string" ? null : el;
  if (host) {
    host.addEventListener("click", e => { const b = e.target.closest("[data-pk]"); if (!b) return; const a = actions[+b.dataset.pk]; if (a && a.run) { buzz(8); a.run(); } });
  }
  return html;
}
