"use strict";
// Early fetch (David, 2026-10-25: "this loads too slowly sometimes; even a super pixelated, blurry, tiny version of the painting is better than a
// color"). Loaded first, from <head> (async, so it never blocks the page), before any other script: a COLD OPEN (no address, or an address on
// the painting map) is about to show the painting map, and measured on a throttled 4G line the map waited ~20 s for its data because that data
// was only asked for once paintmap.js had loaded and run (the line sat idle between the waterfall of scripts). So everything the first map frame
// needs starts downloading NOW, while the ~70 scripts are still arriving, in the order the map will want it:
//   gallery index (index.json, index.bin, est.json) and facets (facets.json, facets.bin)   what the layout is built from; handed over to
//                                                                                          js/gallery.js loadGallery and js/browse.js xbLoad
//   micro.json + micro-*.webp                                                              every painting at 5x5 px, ~1.8 MB, drawn under
//                                                                                          everything (js/paintmap.js pmMicroLoad)
//   manifest.json, cluster.json + cluster.bin                                              the tier-0/tier-1 layout (tier 1 starts at once) and where
//                                                                                          each painting sits in a cluster pack (paintmap_cluster.py)
// The tier-0 sheets (13 MB) are NOT started here: they would compete with the layout data; paintmap.js starts them once the layout is up.
// Each promise waits in a single-use store and is taken once by its reader; a reader that finds nothing (or a failure) fetches for itself.
// URLs follow js/loader.js: the same ?v= tag as this script, and data.chromatlas.app (R2) on the live site with the site's own copy as the fallback.
(function () {
  try {
    var h = location.hash;
    var mapOpen = /^#\/paintings\/map/.test(h), todayOpen = /^#?\/?$/.test(h) || /^#\/feed/.test(h);   // (David, 2026-10-26: the app opens on Today: its gallery, facets and beauty files start at once too)
    if ((!mapOpen && !todayOpen) || typeof fetch !== "function") return;
    var m = (document.currentScript && document.currentScript.src || "").match(/[?&]v=([^&]+)/), v = m ? m[1] : "";
    var base = /(^|\.)chromatlas\.app$|github\.io$/.test(location.hostname) ? "https://data.chromatlas.app/" : "";
    var P = window.__PM_PRE = {}, R = {};   // P: parsed values by file name under data/paintmap/; R: Response promises by data path
    var raw = function (path, pri) {
      var u = path + (v ? "?v=" + v : ""), o = { priority: pri };
      return base ? fetch(base + u, o).then(function (r) { return r.ok ? r : fetch(u, o); }, function () { return fetch(u, o); }) : fetch(u, o);
    };
    var val = function (name, pri, kind) { return raw("data/paintmap/" + name, pri).then(function (r) { if (!r.ok) throw new Error(name); return kind === "json" ? r.json() : kind === "buf" ? r.arrayBuffer() : r.blob(); }); };
    window.__EARLY = { take: function (path) { var p = R[path]; delete R[path]; return p || null; } };
    ["data/gallery/index.json", "data/gallery/index.bin", "data/gallery/est.json", "data/facets/facets.json", "data/facets/facets.bin"].concat(todayOpen ? ["data/gallery/aesthetic.json", "data/gallery/aesthetic.bin"] : []).forEach(function (p) { var q = R[p] = raw(p, "low"); q.catch(function () {}); });
    var micro = P["micro.json"] = val("micro.json", "auto", "json");
    micro.then(function (meta) {
      var all = meta.sheets.map(function (n) { return (P[n] = val(n, "auto", "blob")); });
      all.forEach(function (p) { p.catch(function () {}); });
    }, function () {});
    micro.catch(function () {});
    if (!mapOpen) return;   // Today does not need the map's layout files
    P["cluster.json"] = val("cluster.json", "auto", "json"); P["cluster.json"].catch(function () {}); P["cluster.bin"] = val("cluster.bin", "auto", "buf"); P["cluster.bin"].catch(function () {});
    var man = P["manifest.json"] = val("manifest.json", "auto", "json"); man.catch(function () {});
  } catch (e) {}
})();
