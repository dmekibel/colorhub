"use strict";
// Tiny flags for search rows (sqFlagHTML): a compact descriptor per country, drawn as one inline SVG (30x20 box,
// cropped to a rounded square by the row's 40px tile). Emoji flags are not reliable on every platform, so none are
// used. A country with no entry (a historical state such as the Holy Roman Empire) returns "" and the row falls
// back to its palette strip.
const sqFlagH = (...c) => c.map((x, i) => `<rect y="${i * 20 / c.length}" width="30" height="${20 / c.length + .1}" fill="${x}"/>`).join("");
const sqFlagV = (...c) => c.map((x, i) => `<rect x="${i * 30 / c.length}" width="${30 / c.length + .1}" height="20" fill="${x}"/>`).join("");
const sqFlagNordic = (bg, cr, inner) => `<rect width="30" height="20" fill="${bg}"/><rect x="8" width="4" height="20" fill="${cr}"/><rect y="8" width="30" height="4" fill="${cr}"/>${inner ? `<rect x="9" width="2" height="20" fill="${inner}"/><rect y="9" width="30" height="2" fill="${inner}"/>` : ""}`;
const sqFlagDisc = (bg, c, r = 5, cx = 15) => `<rect width="30" height="20" fill="${bg}"/><circle cx="${cx}" cy="10" r="${r}" fill="${c}"/>`;
const SQ_FLAGS = {
  "France": sqFlagV("#0055A4", "#fff", "#EF4135"), "Italy": sqFlagV("#009246", "#fff", "#CE2B37"), "Germany": sqFlagH("#000", "#DD0000", "#FFCE00"),
  "Netherlands": sqFlagH("#AE1C28", "#fff", "#21468B"), "Belgium": sqFlagV("#000", "#FDDA24", "#EF3340"), "Spain": `<rect width="30" height="20" fill="#AA151B"/><rect y="5" width="30" height="10" fill="#F1BF00"/>`,
  "Russia": sqFlagH("#fff", "#0039A6", "#D52B1E"), "Austria": sqFlagH("#ED2939", "#fff", "#ED2939"), "Poland": sqFlagH("#fff", "#DC143C"), "Ireland": sqFlagV("#169B62", "#fff", "#FF883E"),
  "Sweden": sqFlagNordic("#006AA7", "#FECC00"), "Denmark": sqFlagNordic("#C8102E", "#fff"), "Norway": sqFlagNordic("#BA0C2F", "#fff", "#00205B"), "Finland": sqFlagNordic("#fff", "#003580"),
  "Switzerland": `<rect width="30" height="20" fill="#D52B1E"/><rect x="13" y="4" width="4" height="12" fill="#fff"/><rect x="9" y="8" width="12" height="4" fill="#fff"/>`,
  "Japan": sqFlagDisc("#fff", "#BC002D", 6), "China": `<rect width="30" height="20" fill="#DE2910"/><circle cx="6" cy="6" r="2.6" fill="#FFDE00"/>`,
  "India": sqFlagH("#FF9933", "#fff", "#138808") + `<circle cx="15" cy="10" r="2" fill="none" stroke="#000080" stroke-width=".7"/>`, "Mexico": sqFlagV("#006847", "#fff", "#CE1126"),
  "Greece": sqFlagH("#0D5EAF", "#fff", "#0D5EAF", "#fff", "#0D5EAF", "#fff", "#0D5EAF", "#fff", "#0D5EAF") + `<rect width="11" height="11" fill="#0D5EAF"/><rect x="4.5" width="2" height="11" fill="#fff"/><rect y="4.5" width="11" height="2" fill="#fff"/>`,
  "Hungary": sqFlagH("#CE2939", "#fff", "#477050"), "Romania": sqFlagV("#002B7F", "#FCD116", "#CE1126"), "Portugal": `<rect width="30" height="20" fill="#FF0000"/><rect width="12" height="20" fill="#006600"/><circle cx="12" cy="10" r="3" fill="#FFCC00"/>`,
  "Czechia": sqFlagH("#fff", "#D7141A") + `<path d="M0 0L15 10L0 20Z" fill="#11457E"/>`, "Brazil": `<rect width="30" height="20" fill="#009C3B"/><path d="M15 2L28 10L15 18L2 10Z" fill="#FFDF00"/><circle cx="15" cy="10" r="4" fill="#002776"/>`,
  "Canada": `<rect width="30" height="20" fill="#fff"/><rect width="7.5" height="20" fill="#D52B1E"/><rect x="22.5" width="7.5" height="20" fill="#D52B1E"/><circle cx="15" cy="10" r="3" fill="#D52B1E"/>`,
  "Australia": `<rect width="30" height="20" fill="#012169"/><rect width="15" height="10" fill="#012169"/><path d="M0 0L15 10M15 0L0 10" stroke="#fff" stroke-width="2"/><path d="M7.5 0V10M0 5H15" stroke="#C8102E" stroke-width="2.4"/><circle cx="22" cy="14" r="1.6" fill="#fff"/>`,
  "Turkey": sqFlagDisc("#E30A17", "#fff", 5, 11) + `<circle cx="12.5" cy="10" r="4" fill="#E30A17"/>`, "Egypt": sqFlagH("#CE1126", "#fff", "#000"), "Iran": sqFlagH("#239F40", "#fff", "#DA0000"),
  "Korea": sqFlagDisc("#fff", "#CD2E3A", 5), "Ukraine": sqFlagH("#0057B7", "#FFD700"), "Estonia": sqFlagH("#0072CE", "#000", "#fff"), "Peru": sqFlagV("#D91023", "#fff", "#D91023"),
  "Argentina": sqFlagH("#74ACDF", "#fff", "#74ACDF"), "Colombia": `<rect width="30" height="20" fill="#003893"/><rect width="30" height="10" fill="#FCD116"/><rect y="15" width="30" height="5" fill="#CE1126"/>`,
  "Lithuania": sqFlagH("#FDB913", "#006A44", "#C1272D"), "Latvia": sqFlagH("#9E3039", "#fff", "#9E3039"), "Bulgaria": sqFlagH("#fff", "#00966E", "#D62612"), "Serbia": sqFlagH("#C6363C", "#0C4076", "#fff"),
  "Croatia": sqFlagH("#FF0000", "#fff", "#171796"), "Slovakia": sqFlagH("#fff", "#0B4EA2", "#EE1C25"), "Luxembourg": sqFlagH("#ED2939", "#fff", "#00A1DE"), "Armenia": sqFlagH("#D90012", "#0033A0", "#F2A800"),
  "Indonesia": sqFlagH("#FF0000", "#fff"), "Thailand": sqFlagH("#A51931", "#fff", "#2D2A4A", "#fff", "#A51931"), "Nigeria": sqFlagV("#008751", "#fff", "#008751"), "Ghana": sqFlagH("#CE1126", "#FCD116", "#006B3F"),
  "Ethiopia": sqFlagH("#078930", "#FCDD09", "#DA121A"), "Mongolia": sqFlagV("#C4272F", "#015197", "#C4272F"), "Algeria": sqFlagV("#fff", "#006233") + `<circle cx="15" cy="10" r="3.2" fill="#D21034"/>`,
  "Pakistan": `<rect width="30" height="20" fill="#01411C"/><rect width="7.5" height="20" fill="#fff"/><circle cx="19" cy="10" r="4" fill="#fff"/>`, "Cuba": sqFlagH("#002A8F", "#fff", "#002A8F", "#fff", "#002A8F") + `<path d="M0 0L13 10L0 20Z" fill="#CF142B"/>`,
  "Nepal": `<path d="M2 1H20L9 9H20L2 19Z" fill="#DC143C" stroke="#003893" stroke-width="1.2"/>`, "Israel": `<rect width="30" height="20" fill="#fff"/><rect y="2" width="30" height="2.6" fill="#0038B8"/><rect y="15.4" width="30" height="2.6" fill="#0038B8"/>`,
  "United Kingdom": `<rect width="30" height="20" fill="#012169"/><path d="M0 0L30 20M30 0L0 20" stroke="#fff" stroke-width="4"/><path d="M0 0L30 20M30 0L0 20" stroke="#C8102E" stroke-width="1.5"/><rect x="12" width="6" height="20" fill="#fff"/><rect y="7" width="30" height="6" fill="#fff"/><rect x="13" width="4" height="20" fill="#C8102E"/><rect y="8" width="30" height="4" fill="#C8102E"/>`,
  "United States": sqFlagH("#B22234", "#fff", "#B22234", "#fff", "#B22234", "#fff", "#B22234", "#fff", "#B22234", "#fff", "#B22234", "#fff", "#B22234") + `<rect width="13" height="10.8" fill="#3C3B6E"/>`
};
// -> an inline <svg> string, or "" when the country has no flag
function sqFlagHTML(country) {
  const f = SQ_FLAGS[country]; if (!f) return "";
  return `<svg class="sq-flag" viewBox="5 0 20 20" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${f}</svg>`;
}
