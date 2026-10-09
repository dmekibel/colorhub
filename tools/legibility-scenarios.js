"use strict";
// Registers one scenario per screen in tools/legibility-routes.js, reusing tools/smoke/harness.js's `scenario`/
// `t.open`/`t.ev` machinery (the same iframe-driving code the real smoke tests use) so the legibility crawl
// gets the same settle/virtual-clock handling for free. Each scenario opens its route, injects the audit
// function from tools/legibility-audit.js into the app iframe, and stashes the raw JSON result in t.notes[0]
// so tools/check_legibility.js (which drives this page the same way tools/smoke/run.js drives scenarios.js)
// can read it back out of the dumped DOM.
/* global scenario, window */
(function () {
  const ROUTES = typeof LEGIBILITY_ROUTES !== "undefined" ? LEGIBILITY_ROUTES : [];
  const AUDIT_SRC = (typeof window !== "undefined" && window.__legibilityAuditSrc ? window.__legibilityAuditSrc : null);
  const only = new URLSearchParams(location.search).get("keyOnly") === "1";
  ROUTES.filter(r => !only || r.key).forEach(r => {
    scenario("legibility", r.name, async t => {
      await t.open(r.hash, { settle: r.settle || 600 });
      if (!AUDIT_SRC) throw new Error("legibility-audit.js did not load");
      const report = t.ev("(" + AUDIT_SRC.toString() + ")()");
      t.notes.push(JSON.stringify(report));
    });
  });
})();
