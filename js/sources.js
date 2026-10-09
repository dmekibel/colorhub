"use strict";
// Source pages (David, 2026-10-09): every naming system the app cites gets its own short page at #/source/<id>,
// so a tappable source mention ("Named from nature · Ridgway, 1912") goes somewhere instead of being inert text.
// Registry is static, hand-written, original prose (never copied from ../color-kb/books/): what the system is,
// who made it, when and why, how it names colors, and an honest caveat. The strip of colors below is live: every
// name in CORE_NAMES/the library whose `src`/citation mentions this system, or whose RC_STAMPS match it.
// Top-level names start with src / SOURCE, per tools/check_names.js's one-global-scope rule.

const SOURCE_SYSTEMS = {
  ridgway: { title: "Ridgway's color standards", short: "Ridgway, 1912", who: "Robert Ridgway, curator of birds at the Smithsonian",
    when: "1912, “Color Standards and Color Nomenclature” (an earlier, smaller 1886 nomenclature came first)",
    why: "Ridgway needed exact, repeatable color words for describing birds, eggs and plumage in scientific writing, where “reddish brown” wasn’t precise enough to compare specimens across museums.",
    n: "about 1,115 named colors", how: "Each name is plotted on a hand-painted plate at a specific hue, tone and shade, arranged in a logical grid rather than picked for familiarity — which is why some of its names (“Deep Quaker Drab”) read as technical rather than everyday.",
    caveat: "The original plates have shifted with a century of aging and reproduction; our hex values are read from scanned copies, so they are an approximation of an approximation." },
  "maerz-paul": { title: "A dictionary of color", short: "Maerz & Paul, 1930", who: "Aloys John Maerz and Morris Rea Paul",
    when: "1930, “A Dictionary of Color”, with a second edition in 1950",
    why: "Aimed at designers, printers and manufacturers who needed a shared color vocabulary for commerce — matching a client’s swatch to a sellable name.",
    n: "about 7,000 named colors (one of the largest printed color dictionaries)", how: "Colors are organized on a set of numbered charts by hue family, each swatch printed in ink and given a name drawn from trade usage, nature and earlier dictionaries alike.",
    caveat: "Printed ink swatches drift in reprint; our values come from later digitizations of surviving copies, so treat them as close rather than exact." },
  "iscc-nbs": { title: "The ISCC-NBS system", short: "ISCC-NBS, 1955", who: "The Inter-Society Color Council, with the National Bureau of Standards",
    when: "1955, built from work going back to the 1930s",
    why: "To give every field — science, industry, art — one shared, unambiguous way to describe a color in plain words, as a common layer under the many competing naming systems already in use.",
    n: "267 standard color-name blocks (combinations like “vivid red”, “light grayish olive”)", how: "The whole color solid is divided into blocks by hue, lightness and saturation, each given a systematic descriptive name built from a fixed small vocabulary of modifiers — not a proper name, a description.",
    caveat: "Because the names are descriptive rather than exact coordinates, two different hexes can land in the same ISCC-NBS block; we show it as the closest block, not a precise match." },
  werner: { title: "Werner's nomenclature of colours", short: "Werner, 1821", who: "Abraham Gottlob Werner, a German mineralogist; adapted and illustrated by Patrick Syme, an Edinburgh flower painter",
    when: "Werner's original system (1774) was translated and expanded by Syme in 1814, with a revised edition in 1821",
    why: "Built for naturalists in the field — geologists, botanists, zoologists — who needed one fixed color word they could all agree matched a mineral, a petal or a bird's wing, long before photography existed.",
    n: "110 named colors", how: "Each color is defined by three real-world examples — an animal, a vegetable and a mineral that all show it — then hand-painted onto the page as a swatch. Charles Darwin carried a copy on the Beagle.",
    caveat: "The swatches survive only in hand-painted copies, so our hex values are a modern best guess at pigments and inks that have faded unevenly over two centuries." },
  xkcd: { title: "The xkcd color survey", short: "xkcd survey, 2010", who: "Randall Munroe (xkcd), who ran an open online survey",
    when: "2010", why: "To find out what ordinary people actually call a color, rather than what a dictionary or a paint company says they should call it — the opposite approach from Ridgway or Maerz & Paul.",
    n: "about 954 names that survived filtering, from several million individual responses", how: "Visitors were shown a random color swatch and typed whatever name they'd use for it; names used by many people, for similar enough colors, were kept and averaged.",
    caveat: "It's a survey of common usage, not a measurement: the same name was typed for a wide range of similar hexes, so its colors are centroids of popular opinion, not fixed points." },
  crayola: { title: "Crayola crayon colors", short: "Crayola", who: "Crayola LLC (originally Binney & Smith)",
    when: "Crayons since 1903; named colors have been added, renamed and retired steadily since then",
    why: "Consumer products need friendly, memorable names a child (or a parent reading a label) will recognize — “Blue” was the start, but the box grew.",
    n: "over 200 names across the brand's history", how: "Names are chosen for warmth and familiarity (“Macaroni and Cheese”, “Tickle Me Pink”) rather than technical precision, and several have been renamed over the decades for cultural reasons.",
    caveat: "Crayon pigment colors vary batch to batch and fade; the hex values in circulation (including ours) are approximations made from scans and manufacturer references, not a lab measurement." },
  css: { title: "CSS and X11 color names", short: "X11 / CSS", who: "The X11 windowing system (1980s), later standardized for the web by the CSS and SVG specifications",
    when: "X11's name list dates to the 1980s; CSS adopted and extended it starting in the late 1990s",
    why: "Early computer displays needed a short, typeable list of named colors programmers could use directly in code, without looking up a hex value.",
    n: "147 names in the CSS specification", how: "Names are plain English color words (“Tomato”, “SteelBlue”, “RebeccaPurple”) mapped to one fixed hex value apiece, chosen for memorability rather than any underlying system.",
    caveat: "These are exact, specification-defined hex values — the most precise of any system here — but the set was never designed to be complete or evenly spaced across the color space." },
  pantone: { title: "Pantone", short: "Pantone", who: "Pantone LLC, a commercial color-matching company",
    when: "Since 1963", why: "Printers, textile makers and brands needed a numbered, licensable standard so a color specified in one factory prints identically in another, anywhere in the world.",
    n: "over 15,000 numbered colors across its various systems (PMS, fashion and home, process colors...)", how: "Each color is a numbered ink or dye formula, licensed to printers and manufacturers; the number, not a name, is the actual standard.",
    caveat: "Pantone's exact formulas and screen conversions are commercial and not published for free reuse, so we can state facts about the system but cannot show its proprietary color values here." },
  ral: { title: "The RAL color system", short: "RAL", who: "RAL gGmbH, a German standards institute (originally the Reichsausschuß für Lieferbedingungen)",
    when: "Since 1927, with the widely used RAL Classic range dating to 1961", why: "German industry needed one numbered standard for paint and coatings — architecture, cars, signage, appliances — so a specified color could be ordered and matched by number alone, across any manufacturer.",
    n: "over 200 colors in RAL Classic, with larger ranges (RAL Design, RAL Effect) alongside it", how: "Each color is a four-digit number (RAL 5010, “Gentian blue”) tied to a physical sample card; the number is the standard, the name is a secondary convenience.",
    caveat: "RAL's official sample cards are the true reference; our hex values are conversions published by third parties, not RAL's own digital standard." },
  munsell: { title: "The Munsell color system", short: "Munsell", who: "Albert H. Munsell, an American painter and art teacher",
    when: "First published 1905, still maintained today (Munsell Color, a unit of X-Rite)", why: "Munsell wanted color teaching and specification to be as rigorous as music notation: a fixed, perceptually even grid instead of poetic color names.",
    n: "a continuous three-dimensional notation (hue, value, chroma), not a fixed list of named colors", how: "Every color is a coordinate, like “5R 4/14” (hue, lightness, saturation), spaced so that equal steps in the notation look like roughly equal steps to the eye — the first system built from human perception rather than physics or pigment chemistry.",
    caveat: "Munsell notations convert to hex only approximately, since the system predates digital color and was built around physical paint chips viewed under standard lighting." },
  jp: { title: "Japanese traditional colors", short: "Japanese traditional", who: "A centuries-long tradition of dyers, painters and poets, not any one author",
    when: "Many names trace to the Heian period (794–1185) and earlier; the tradition kept growing through the Edo period", why: "Names grew out of dyeing, court dress and poetry — a color named for a flower, a season or a dye recipe carried meaning beyond the hue itself.",
    n: "several hundred names in common reference lists", how: "Most names come from a natural source (a plant, a dye, an season) and often describe a specific traditional dyeing or pigment process as much as an exact shade.",
    caveat: "Because many of these names describe a dye process rather than one fixed color, the same name can refer to a range of hexes depending on the source consulted; ours is one reasonable reading." },
  wiki: { title: "Wikipedia color lists", short: "Wikipedia", who: "Wikipedia's volunteer editors, compiling from many of the sources on this page and others",
    when: "Ongoing", why: "To gather color names from many specialist systems (web colors, paint lines, cultural names) into one cross-referenced, publicly editable list.",
    n: "thousands of entries across several list articles", how: "Each entry cites a source system (often one listed here) for its hex value; Wikipedia itself does not mint new colors, it collects and cross-checks them.",
    caveat: "Because it's a compiled secondary source, accuracy depends on the underlying citation; where we can we point to the original system instead." },
  pigment: { title: "Pigment and dye names", short: "Pigment lists", who: "The history of art materials — pigment makers, conservators and art historians",
    when: "Spans from prehistoric ochres to modern synthetic pigments", why: "Painters and dyers have always needed to name the physical substance they're using — the mineral, plant or synthesized compound — which is a different question from naming a perceived color.",
    n: "varies; the app draws on a working list of historically documented pigments and dyes", how: "A pigment name (ultramarine, vermilion, Prussian blue) names the material, with a representative color measured from it; the same pigment can look different depending on how finely it's ground and what it's mixed with.",
    caveat: "A pigment's color varies by source, era and preparation; the hex shown is one representative reading, not the only one a historical pigment could produce." },
};
// CORE_NAMES loads lazily (js/loader.js); a direct #/source/<id> load can land before it has. Waits for it
// (coreFallback's small built-in list has no .src tags to match against) rather than saying "none" too soon.
function srcColorsFor(id) {
  const ready = typeof CORE_NAMES !== "undefined" && CORE_NAMES;
  const go = list => list.filter(e => (e.src || []).includes(id) || (e.fs === id)).slice(0, 48);
  if (ready) return Promise.resolve(go(CORE_NAMES));
  if (typeof loadCoreNames === "function") return loadCoreNames().then(() => go((typeof CORE_NAMES !== "undefined" && CORE_NAMES) || []));
  return Promise.resolve([]);
}
function srcLinkHTML(id, label) {
  if (!SOURCE_SYSTEMS[id]) return esc(label || "");
  return `<button type="button" class="src-link" data-src-open="${esc(id)}">${esc(label || SOURCE_SYSTEMS[id].short)}</button>`;
}
function srcWireLinks(el) {
  el.querySelectorAll("[data-src-open]").forEach(b => { if (b.__srcWired) return; b.__srcWired = true; b.onclick = e => { e.preventDefault(); e.stopPropagation(); sourcePage(b.dataset.srcOpen); }; });
}
function sourcePage(id) {
  const sys = SOURCE_SYSTEMS[id];
  if (!sys) { toast("That source isn't in our list yet"); return; }
  const el = show(`
    <header class="src-top"><button class="icon-btn glass" data-back aria-label="Back">${ICON.back}</button><span class="src-top-t">Source</span><span class="ar-rd-sp"></span></header>
    <div class="src-band"><p class="eyebrow">A naming system</p><h1>${esc(sys.title)}</h1><p class="src-short">${esc(sys.short)}</p></div>
    <dl class="ar-facts src-facts">
      <div><dt>Who</dt><dd>${esc(sys.who)}</dd></div>
      <div><dt>When</dt><dd>${esc(sys.when)}</dd></div>
      <div><dt>Why</dt><dd>${esc(sys.why)}</dd></div>
      <div><dt>How many</dt><dd>${esc(sys.n)}</dd></div>
      <div><dt>How it names colors</dt><dd>${esc(sys.how)}</dd></div>
    </dl>
    <p class="fine src-caveat">${esc(sys.caveat)} Screen colors are always approximate.</p>
    <div data-src-colors></div>
  `, "article src-page");
  el.querySelector("[data-back]").onclick = xBack;
  onKey = e => { if (e.key === "Escape") xBack(); };
  srcColorsFor(id).then(colors => {
    const box = el.querySelector("[data-src-colors]"); if (!box || !el.isConnected) return;
    box.innerHTML = colors.length
      ? `<h2 class="src-h2">Colors in our archive from this source</h2><div class="lk-list src-strip">${colors.map(e => `<button class="lk-row" data-nn="${esc(e.n)}" data-h="${e.h}"><i style="--c:${e.h}"></i><b>${esc(e.n)}</b></button>`).join("")}</div>`
      : `<p class="fine">We don't have any of our colors tagged to this source yet.</p>`;
    box.querySelectorAll("[data-nn]").forEach(b => b.onclick = () => openCoreName(b.dataset.h, b.dataset.nn));
  });
  return el;
}
