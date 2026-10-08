"use strict";
// Injected as the very first script of the app's index.html (tools/smoke/overlay.sh makes the copy the smoke
// server hands out), so it sees everything: load-time syntax errors, a script that 404s, exceptions in event
// handlers and timers, unhandled promise rejections, and console.error (the app logs swallowed errors that way).
// harness.js reads window.__smokeErrors.
(function () {
  var E = window.__smokeErrors = [];
  var short = function (u) { return String(u || "").replace(location.origin, "").replace(/\?v=\w+/, ""); };
  addEventListener("error", function (e) {
    if (e.target && e.target !== window && e.target.tagName) {   // a resource failed to load: only our own scripts and styles count
      var u = e.target.src || e.target.href || "";
      if (/^(SCRIPT|LINK)$/.test(e.target.tagName) && u.indexOf(location.origin) === 0) E.push("load-failed: " + short(u));
      return;
    }
    E.push("error: " + (e.message || e.error) + " @ " + short(e.filename) + ":" + e.lineno);
  }, true);
  addEventListener("unhandledrejection", function (e) {
    var r = e.reason;
    E.push("unhandled-rejection: " + String(r && (r.stack || r.message) || r).split("\n").slice(0, 3).join(" | "));
  });
  var ce = console.error;
  console.error = function () {
    E.push("console.error: " + Array.prototype.map.call(arguments, function (a) { return a && a.stack ? a.stack.split("\n").slice(0, 2).join(" | ") : String(a); }).join(" ").slice(0, 300));
    return ce.apply(console, arguments);
  };
})();
