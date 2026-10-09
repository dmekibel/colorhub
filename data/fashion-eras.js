// Measured eras (Explore → World → Fashion → Measured eras). Three periods -- 1700s, 1800-1849, 1850-1899 --
// where the garment archive (data/fashion/garments.json, the Met + Cleveland Museum of Art open-access
// corpus) actually has enough western-Europe-and-North-America pieces to measure rather than only describe.
// David (2026-10-09): "Fashion decades have one little palette and tiny articles -- not enough. We need as
// much nuance as possible." The existing Decades (data/fashion.js, 1900s-2020s) stay documented-but-
// unmeasured, because the open-access collections used here hold almost nothing dated after 1900 for this
// culture group (see research/FASHION.md); rather than fake precision there, this file adds real multi-
// palette, stats-backed depth where the corpus supports it, and is explicit where it doesn't. Numbers (the
// "measured" object on each entry) are computed by tools/fashion_measure.py into data/fashion/measured-
// eras.json, loaded lazily; this file holds only the written article, which quotes those numbers but does
// not duplicate them, so the two can never drift apart. Rendered by js/world.js (fashionEraDetail);
// js/fashion.js owns the gallery and tab UI. Gate: node tools/check_names.js.
window.FASHION_ERAS = [
  {
    id: "1700s", years: "1700–1799",
    title: "The 1700s",
    dek: "Before synthetic dye, color came from plants, insects and minerals -- and from how much of them a household could afford.",
    lead: [
      "There is no single '1700s palette' the way the later Decades pages can sketch one: this is a century, not a decade, and European and colonial dress ran from undyed working linen to silk brocades dyed in three separate vats. What the measured pieces below actually show, across 79 western garments and textiles from the Met and Cleveland Museum of Art, is less a hue and more a texture: muted, earthy neutrals (taupe, umber, sepia, camel) dominate the cloth that survived and was collected, with brighter silk brocades as the visible exception rather than the rule."
    ],
    sections: [
      {
        title: "What's measured here, and what isn't",
        text: [
          "Before [[william-perkin|synthetic dye]] arrived in 1856, every color in this gallery came from a plant, an insect or a mineral: [[indigo-dye|indigo]] and woad for blue, [[madder|madder]] and [[kermes|kermes]] or [[cochineal|cochineal]] for red, weld and fustic for yellow, logwood for purplish brown, and iron or oak-gall mordants for the blacks and greys that show up so often below. None of that chemistry limited the color wheel the way it's sometimes told: 18th-century dyers could and did hit vivid reds, blues and golds. What limited a household's palette was cost, climate for growing or importing the dyestuff, and how many dye baths a fabric could survive without falling apart.",
          "The museums' own collecting habits shape this gallery as much as the century did. Surviving 1700s textiles are disproportionately the ones worth keeping: formal silks, trade brocades, and ecclesiastical or upholstery fabric, rather than the plain wool and linen that made up most people's actual wardrobes and wore out or was cut down and reused. 61 of the 79 pieces here are textile fragments, lengths and furnishing cloth rather than finished dress -- read the measured palette as 'surviving luxury and trade cloth of the 1700s', not 'what people wore'."
        ]
      },
      {
        title: "The measured palette",
        text: [
          "Taupe, umber and camel cover the most cloth across the full set, and 91% of these 79 pieces show a neutral color -- black, white, grey, beige or brown -- somewhere across at least an eighth of their surface. Some of that is real: plain-woven wool, linen and undyed or lightly mordanted silk were everyday cloth. Some of it is also age: 18th-century dyes fade and yellow over three centuries of light exposure even in a museum's controlled storage, and a faded indigo or madder often measures closer to grey-brown than its original hue. Treat 'muted' here as partly a fact about 1700s dyeing and partly a fact about photographing 300-year-old cloth.",
          "Where brocades and gold-metal weaves appear -- a fifth of the dress pieces here carry visible 'Gunmetal', against 2% of the rest of the set -- they stand out exactly because the baseline is so quiet. That gap is itself a finding: formal 18th-century dress saved its saturated color and metallic thread for silk, while the century's much larger stock of furnishing and trade cloth ran plainer."
        ]
      }
    ],
    hedge: "A century isn't a decade: fashionable Europe's silk trade and a farm laborer's wool coat belong to the same hundred years but not the same palette, and this corpus leans toward the silk trade. Treat every number here as a property of 79 surviving, collected, photographed pieces -- not a survey of the 1700s.",
    sources: ["Metropolitan Museum of Art (2026). Open Access collection data.", "Cleveland Museum of Art (2026). Open Access collection data.", "Greenfield, A. (2005). A Perfect Red: Empire, Espionage, and the Quest for the Color of Desire. Harper.", "Pastoureau, M. (2001/2008). Blue/Black: The History of a Color. Princeton University Press."]
  },
  {
    id: "1800-1849", years: "1800–1849",
    title: "1800–1849",
    dek: "Cotton and cheaper mordant dyeing put color within reach of more households, while mourning and modesty still kept much of fashionable dress neutral.",
    lead: [
      "86 western garments here, three-quarters of them finished dresses rather than fragments, give the first half of the 1800s the best-populated and most dress-heavy measured palette in this corpus. Silver and its close cousins -- grey, taupe, umber -- still lead, but beige, ecru and tan (the cottons and lighter silks of day dress) take a far bigger share than in the 1700s set, where dark brocade and furnishing weaves dominated."
      ],
    sections: [
      {
        title: "Cotton, chemistry and cheaper color",
        text: [
          "Napoleonic-era neoclassical dress (high-waisted, pale muslin) runs into the Romantic 1820s-40s silhouette of wide sleeves and a dropped waist, and both lean on the same technical shift: printed and mordant-dyed cotton got markedly cheaper and more reliable across this half-century, well before [[william-perkin|synthetic dye]] existed. [[madder|Madder]] on cotton (the base of the English 'madder style' and French indiennes) gave fast reds, browns and purples at industrial scale, and this corpus's measured beige, tan and ecru likely include a good number of these printed cottons alongside plain undyed muslin.",
          "12% of these pieces show visible white, three times the 1700s rate (4%) in this same corpus -- consistent with [[white|white muslin's rise]] as the fashionable, launderable fabric of the early 1800s, though a sample this size can't rule out that white textiles also simply survive and photograph more legibly than faded dark ones."
        ]
      },
      {
        title: "Black, mourning and the limits of a palette",
        text: [
          "Black already runs at real scale here (present on close to a third of the measured pieces, concentrated in dresses), years before the much better-known mid-century mourning wardrobe described in [[#history:mourning-dress|mourning dress in the 1800s]]. Court, church and professional dress kept black in steady use across the period for reasons that had nothing to do with grief; 1800-1849 is really the quiet first half of a story that peaks after 1861."
        ]
      }
    ],
    hedge: "This is still fashionable, preserved dress skewed toward what museums chose to keep -- working dress, undergarments and anything that wore to rags are underrepresented, and that gap, not period taste, likely explains some of the measured neutrality.",
    sources: ["Metropolitan Museum of Art (2026). Open Access collection data.", "Cleveland Museum of Art (2026). Open Access collection data.", "Paoletti, J. (2012). Pink and Blue: Telling the Boys from the Girls in America. Indiana University Press.", "Steele, V. (2010). Fashion: A History from the 18th to the 20th Century. Taschen/Kyoto Costume Institute."]
  },
  {
    id: "1850-1899", years: "1850–1899",
    title: "1850–1899",
    dek: "The best-measured half-century in this archive, and the one where the aniline-dye flood and Victorian mourning custom both show up as real numbers, not just stories.",
    lead: [
      "98 western garments, 90 of them dresses, make the second half of the 1800s the deepest set here. Black and its near neighbors (silver, grey, charcoal) lead by a clear margin -- black alone is visible on close to a third of every measured piece, and on a third of the dresses specifically versus none of the smaller handful of non-dress textiles in this bucket. That split lines up with two real, documented forces at once: Victorian [[#history:mourning-dress|mourning dress]], and black's long-standing status as a formal and professional color independent of grief (see [[#history:black|black in fashion]])."
    ],
    sections: [
      {
        title: "The aniline flood, measured against the baseline",
        text: [
          "William Perkin's 1856 [[mauveine|mauve]] opened the [[#history:aniline-craze|aniline craze]]: a run of cheap, intensely saturated synthetic dyes (mauve, then magenta, then a widening range) that textile histories describe as the loudest fashionable color of the 1860s. This corpus can't isolate 'aniline-dyed cloth' directly -- the measurement is a photograph's color, not a dye test -- but the era-level palette is still consistent with the documented story: alongside the neutral majority, saturated pinks, violets and magentas appear here far more than in the 1700s or 1800-1849 sets, exactly the decades when they became possible to make cheaply.",
          "The gap between that bright minority and the neutral majority is itself informative: even in the dye's loudest decade, dark and neutral dress for daywear, mourning and formal occasions still measured as the plurality of surviving pieces. A famous new color doesn't erase everything that came before it -- it adds a visible streak on top."
        ]
      },
      {
        title: "Arsenic green, briefly and carefully",
        text: [
          "Victorian green dye is sometimes associated with arsenic-based pigments (see [[#history:arsenic-green|arsenic green dresses]]); this corpus holds too few clearly green 1850-1899 pieces to say anything numeric about that specific pigment family, and no chemical testing was done on any image here -- this is a photograph-color measurement, not a lab analysis, and the two shouldn't be confused."
        ]
      }
    ],
    hedge: "Ninety-eight pieces, nearly all museum-grade formal and dress garments, is still a small, non-random sample of one half-century's fashionable dress in two (mostly American and British) collections -- read every percentage here as a property of this corpus, stated honestly rather than rounded away.",
    sources: ["Metropolitan Museum of Art (2026). Open Access collection data.", "Cleveland Museum of Art (2026). Open Access collection data.", "Garfield, S. (2000). Mauve: How One Man Invented a Color That Changed the World. W. W. Norton.", "Taylor, L. (1983). Mourning Dress: A Costume and Social History. Allen & Unwin."]
  }
];
