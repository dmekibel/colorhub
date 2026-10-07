// Fashion (Explore → World → Fashion). Decades, Pantone's Color of the Year, house signature colors,
// and fashion-history pages. Rendered by js/world.js; this file only holds data.
// Hex values are screen approximations, named here as precisely as the sources allow. Quotes stay under
// 15 words and attributed. Pantone® is a trademark of Pantone LLC; "Tiffany Blue" and the red-soled shoe
// are mentioned as trademarks, never implied to be the official values. Gate: node tools/check_names.js.
window.FASHION = {

dek: "Color trends, couture houses and the history of dress, from sumptuary law to Barbiecore.",

// ---------------------------------------------------------------- decades
// Each: a named palette (5-7 colors), why those colors, 2-4 iconic pieces in words, and a hedge where trend
// claims are fuzzy. Palettes describe the fashionable end of Paris/London/New York, not everyone's wardrobe.
decades: [
  {
    id: "1900s", label: "1900s", years: "1900–1909",
    swatches: [["#FFFFF0","Ivory"],["#C8A2C8","Lilac"],["#B0E0E6","Powder blue"],["#A8778F","Mauve"],["#FFD700","Gold"],["#16171A","Black"]],
    why: "The Edwardian decade favored pale, powdery color next to black. Ivory lace, lilac, powder blue and mauve were easy to get in quantity now that aniline dyes, decades on from [[mauveine|mauve's 1856 debut]], made even pastel tints cheap and reliable. The S-bend corset pushed the whole silhouette into a soft curve, and mourning customs still shaped the palette: a widow's black, worked loose through grey and lilac half-mourning, was common enough to color the whole decade, not only the bereaved (see [[#history:mourning-dress|mourning dress]]).",
    pieces: [
      "The House of Worth — pastel silk day and tea gowns, c. 1900–05, the kind of dress illustrators drew onto the 'Gibson Girl', the decade's most repeated image of fashionable women (an illustration style, not a designer).",
      "Paul Poiret — early designs, c. 1903–06, already loosening the corset years before his more famous 1910s line."
    ],
    hedge: "Any single 'palette of a decade' simplifies a world where wardrobes varied hugely by class, climate and country; this describes fashionable Paris and London, not everyone.",
    sources: ["Steele, V. (2010). Fashion: A History from the 18th to the 20th Century. Taschen/Kyoto Costume Institute.", "Mendes, V. & de la Haye, A. (1999). 20th Century Fashion. Thames & Hudson."]
  },
  {
    id: "1910s", label: "1910s", years: "1910–1919",
    swatches: [["#50C878","Emerald"],["#0047AB","Cobalt"],["#FFD700","Gold"],["#800020","Burgundy"],["#BDB76B","Khaki"],["#16171A","Black"]],
    why: "When the Ballets Russes opened in Paris in 1909, Léon Bakst's jewel-toned, Orientalist costumes for Scheherazade pushed emerald, cobalt and gold into fashionable drawing rooms. Paul Poiret answered with narrower, higher-waisted dresses in the same saturated colors, loosening the corset for good. The decade ends in a different palette entirely: the First World War put millions of women into [[#history:khaki-camo|khaki]] work clothes and put much of civilian fashion into mourning black and grey.",
    pieces: [
      "Paul Poiret — the 'Sorbet' and 'Minaret' dresses, c. 1912–13, lampshade tunics over narrow underskirts in saturated color.",
      "Léon Bakst — costumes for the Ballets Russes' Scheherazade, 1910, credited with popularizing jewel-toned Orientalism in Paris fashion.",
      "Wartime khaki and blue overalls worn by women in munitions and transport work, 1914–18 (see [[#history:khaki-camo|khaki, field grey and camouflage]])."
    ],
    sources: ["Troy, N. J. (2003). Couture Culture: A Study in Modern Art and Fashion. MIT Press.", "Imperial War Museum, 'Women's work in the First World War' (iwm.org.uk)."]
  },
  {
    id: "1920s", label: "1920s", years: "1920–1929",
    swatches: [["#16171A","Black"],["#FFD700","Gold"],["#C0C0C0","Silver"],["#00A86B","Jade"],["#800020","Burgundy"],["#FFFFF0","Ivory"]],
    why: "Two very different sources colored the Jazz Age. Howard Carter's 1922 opening of Tutankhamun's tomb set off an Egyptian-revival taste for jade, lapis-like blue and gold in jewelry and beading. Meanwhile flapper dresses leaned on black, silver and gold for movement and shimmer under electric light. Late in the decade, the bias cut, which lets a straight-grain fabric stretch and fall along the body, let Madeleine Vionnet build gowns that needed almost no color at all to look modern: cut was doing the work color used to do.",
    pieces: [
      "Coco Chanel — a simple black crepe dress Vogue featured in 1926 is usually credited with popularizing the 'little black dress' as modern daywear. Chanel did not invent the black dress, though: black evening wear was already common well before 1926.",
      "Madeleine Vionnet — bias-cut gowns of the late 1920s, illustrated in La Gazette du Bon Ton, needing little ornament to show the body's line.",
      "Egyptian-revival jewelry and beading in jade, gold and lapis-blue, following the 1922 Tutankhamun discovery."
    ],
    img: { thumb: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/25/Thayaht_-_Gazette_du_bon_ton_-_Un_manteau_de_Madeleine_Vionnet.jpg/500px-Thayaht_-_Gazette_du_bon_ton_-_Un_manteau_de_Madeleine_Vionnet.jpg", w: 500, h: 680,
      alt: "Fashion plate of a woman in a coat by Madeleine Vionnet, drawn by Thayaht", caption: "Thayaht's 1922 plate for La Gazette du Bon Ton, showing a coat by Madeleine Vionnet.",
      credit: "Museum of Fine Arts, Boston · CC0", licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/", commons: "https://commons.wikimedia.org/wiki/File:Thayaht_-_Gazette_du_bon_ton_-_Un_manteau_de_Madeleine_Vionnet.jpg" },
    sources: ["Metropolitan Museum of Art, Heilbrunn Timeline, '1920–1929' (metmuseum.org).", "Steele, V. (2010). Fashion: A History from the 18th to the 20th Century. Taschen."]
  },
  {
    id: "1930s", label: "1930s", years: "1930–1939",
    swatches: [["#C0C0C0","Silver"],["#FFFFF0","Ivory"],["#B0E0E6","Powder blue"],["#FFCBA4","Peach"],["#800020","Burgundy"],["#E3007D","Shocking pink (approx.)"]],
    why: "The Depression cut into fashion budgets everywhere, and the decade answered two ways: everyday clothes grew plainer, while Hollywood sold escapism in silver, ivory and pastel. Jean Harlow and other stars wore Adrian's bias-cut satin gowns that photographed brilliantly in black-and-white film, so the 'palette' many people actually saw was grey-scale light and shadow on a cinema screen, not real color. Right at the decade's end, Elsa Schiaparelli broke the hush with a loud magenta-pink she simply called Shocking, a signature she carried into Houses (below).",
    pieces: [
      "Adrian (Gilbert Adrian) — bias-cut satin gowns for MGM stars including Jean Harlow, mid-1930s, designed to read as pure light and shadow on film.",
      "Elsa Schiaparelli — the 'Shocking' perfume bottle and color, 1937, named for a pink she said shocked even her."
    ],
    sources: ["Gutner, H. (2001). Gowns by Adrian. Pompton Plains, NJ: Pomegranate.", "Blum, D. E. (2003). Shocking! The Art and Fashion of Elsa Schiaparelli. Philadelphia Museum of Art."]
  },
  {
    id: "1940s", label: "1940s", years: "1940–1949",
    swatches: [["#808000","Olive"],["#1C2B5A","Navy"],["#36454F","Charcoal"],["#8E7F71","Taupe"],["#F28DB2","Soft rose"],["#36454F","Dior grey"]],
    why: "Wartime rationing (Britain's Utility Clothing Scheme, from 1941) narrowed civilian color to practical olive, navy and grey, while millions of uniforms made [[#history:khaki-camo|khaki]] and field colors a daily sight even off the battlefield. Peace reversed the mood fast: Christian Dior's February 1947 collection, soon nicknamed the 'New Look', brought back yards of fabric, a cinched waist and a return to softer, richer color after years of austerity.",
    pieces: [
      "Christian Dior — the Bar Suit, from the 'New Look' collection, February 1947: a soft charcoal skirt and jacket that announced postwar extravagance.",
      "Britain's Utility Clothing Scheme garments, 1941–1952, plain-cut and fabric-rationed, in olive, navy and grey.",
      "Rosie-the-Riveter-style denim workwear worn by women war workers in Allied factories (see [[#history:denim-workwear|denim: work clothes first]])."
    ],
    sources: ["Veillon, D. (2002). Fashion Under the Occupation. Berg.", "Pochna, M.-F. (1996). Christian Dior: The Man Who Made the World Look New. Arcade."]
  },
  {
    id: "1950s", label: "1950s", years: "1950–1959",
    swatches: [["#F4C2C2","Baby pink"],["#A8EBC4","Mint"],["#40E0D0","Turquoise"],["#FFEF00","Canary"],["#FF2400","Scarlet"],["#36454F","Charcoal"]],
    why: "Dior's hourglass line kept ruling eveningwear while a separate, pastel domestic palette, baby pink, mint, turquoise, took over kitchens, cars and prom dresses. Mamie Eisenhower's pink gown at the 1953 presidential inauguration became a shorthand for the whole look (see [[#history:pink-blue-babies|pink and blue for babies]] for how recent the pink-for-women, pink-for-girls pairing actually is). Against the pastels sat rock-and-roll's leather jackets and denim, a hard charcoal and indigo counter-current that the 1960s would inherit.",
    pieces: [
      "Mamie Eisenhower's pink gown, worn at her husband's 1953 inauguration, widely credited with the decade's 'Mamie pink' nickname.",
      "Christian Dior's continuing hourglass silhouette, through the house's 1950s collections.",
      "Marilyn Monroe's white halter dress in The Seven Year Itch, 1955, an image more famous than any single color."
    ],
    sources: ["Paoletti, J. B. (2012). Pink and Blue: Telling the Boys from the Girls in America. Indiana University Press.", "Metropolitan Museum of Art, Heilbrunn Timeline, '1950–1959' (metmuseum.org)."]
  },
  {
    id: "1960s", label: "1960s", years: "1960–1969",
    swatches: [["#16171A","Black"],["#F7F6F2","White"],["#FF69B4","Hot pink"],["#F28500","Tangerine"],["#7FFF00","Chartreuse"],["#C0C0C0","Silver"]],
    why: "The decade split roughly in two. Early on, Mod fashion in London ran on graphic black and white, close to Op Art, while Space Age designers in Paris, André Courrèges and Pierre Cardin among them, dressed the future in white, silver and metallic plastic. By the late 1960s psychedelia and the counterculture pushed in saturated rainbow color instead, paisley and tie-dye replacing the earlier decade's crisp geometry.",
    pieces: [
      "Mary Quant — the miniskirt, popularized from about 1964–65 in London (who first shortened the hem is still debated among historians).",
      "Yves Saint Laurent — the 'Mondrian' cocktail dresses shown in autumn 1965, color-blocked in homage to Piet Mondrian's paintings (see Yves Saint Laurent in Houses, below).",
      "André Courrèges — the 'Space Age' collection, 1964, in white, silver and sharp geometric cuts."
    ],
    hedge: "Who 'invented' the miniskirt is contested; Quant, Courrèges and John Bates all shortened hemlines around the same years.",
    sources: ["Wilcox, C. (2007). The Golden Age of Couture: Paris and London 1947–57. V&A Publishing.", "Watson, L. (2004). Vintage Fashion Complete. Carlton Books."]
  },
  {
    id: "1970s", label: "1970s", years: "1970–1979",
    swatches: [["#CFA41C","Mustard"],["#B7410E","Rust"],["#CC5500","Burnt orange"],["#808000","Olive"],["#FFD700","Gold"],["#16171A","Black"]],
    why: "Two 1970s coexisted in color. Disco's Studio 54 crowd wore slinky jersey in gold, bronze and jewel tones under mirror-ball light, while a much larger boho and 'natural' mood, part fashion, part 1970s economic austerity after the decade's oil shocks, settled into mustard, rust and olive earth tones that read as sober and grounded. Right at the end, London punk answered both with torn black and safety pins, rejecting color almost entirely.",
    pieces: [
      "Halston (Roy Halston Frowick) — minimalist jersey gowns, mid-1970s, often in warm neutral or jewel color, favored by Studio 54's crowd.",
      "Vivienne Westwood and Malcolm McLaren — clothing sold from their London shop, 1976–77, that gave the Sex Pistols' punk look its uniform of black.",
      "Earth-toned 'boho' dressing of the mid-1970s, in mustard, rust and olive corduroy and suede."
    ],
    sources: ["Gross, M. (2001). Halston: An American Original. HarperCollins.", "Wilson, E. (2003). Adorned in Dreams: Fashion and Modernity. I. B. Tauris."]
  },
  {
    id: "1980s", label: "1980s", years: "1980–1989",
    swatches: [["#FF69B4","Hot pink"],["#0047AB","Cobalt"],["#FFEF00","Neon yellow (approx.)"],["#16171A","Black"],["#FF2400","Scarlet"],["#7B3FA0","Purple"]],
    why: "Corporate 'power dressing', bold primary suits with shoulder pads, borrowed its confidence from the decade's television business dramas, while a separate neon palette lit up aerobics studios and early MTV. Haute couture answered with its own extravagance: Christian Lacroix's 1987 'pouf' dresses used yards of taffeta and saturated color at a scale fashion hadn't seen in decades.",
    pieces: [
      "Christian Lacroix — the 'pouf' dress, shown in his couture debut collection, 1987, in saturated silk taffeta.",
      "Power-suit dressing with shoulder pads, as costumed on 1980s television dramas such as Dynasty (TV costuming, not a single designer's doing).",
      "Neon aerobics-wear of the Jane Fonda workout-video era, early-to-mid 1980s."
    ],
    sources: ["Reeder, C. (2010). How to Read a Dress. Bloomsbury.", "Metropolitan Museum of Art, 'Christian Lacroix' (Costume Institute object records)."]
  },
  {
    id: "1990s", label: "1990s", years: "1990–1999",
    swatches: [["#8E7F71","Taupe"],["#808000","Olive"],["#36454F","Charcoal"],["#16171A","Black"],["#C0C0C0","Silver"],["#BDB76B","Khaki"]],
    why: "Minimalism scrubbed the 1980s' color back to taupe, charcoal and black: Calvin Klein and Jil Sander built whole collections around restraint. Grunge, which reached runways by 1992–93, drew its muted olive and flannel palette from Seattle thrift stores rather than any designer's studio. Late in the decade Tom Ford's Gucci swung the other way, back into rich jewel-toned velvet, while Y2K anticipation brought silver and metallic sheen into eveningwear.",
    pieces: [
      "Calvin Klein — minimalist slip dresses and neutral tailoring, mid-1990s.",
      "Marc Jacobs — the 'grunge' collection for Perry Ellis, 1992–93, which borrowed Seattle thrift-store flannel and muted color and drew sharp criticism at the time.",
      "Tom Ford — early collections for Gucci from 1995, in deep burgundy, black and bottle-green velvet (see Gucci in Houses, below)."
    ],
    sources: ["Gross, M. (2015). Focus: The Secret, Sexy, Sometimes Sordid World of Fashion Photography. Atria.", "Thomas, D. (2007). Deluxe: How Luxury Lost Its Luster. Penguin."]
  },
  {
    id: "2000s", label: "2000s", years: "2000–2009",
    swatches: [["#FF69B4","Hot pink"],["#3B638C","Denim"],["#C0C0C0","Silver"],["#BFFF00","Lime"],["#40E0D0","Turquoise"],["#16171A","Black"]],
    why: "Early-2000s 'Y2K' fashion mixed low-rise denim with bubblegum pink, metallic fabric and logo-heavy branding, a look TV, celebrity gossip sites and velour tracksuits all pushed at once. By the back half of the decade a quieter boho revival, influenced by musicians and actresses photographed off-duty, brought in warmer earth tones alongside the brights.",
    pieces: [
      "Juicy Couture — velour tracksuits, early-to-mid 2000s, often in bubblegum pink or pale blue with rhinestone branding.",
      "Low-rise denim and trucker-hat styling associated with early-2000s celebrity culture.",
      "Alexander McQueen's theatrical runway shows of the decade, which used color and spectacle together rather than one signature palette."
    ],
    sources: ["Bolton, A. (2011). Alexander McQueen: Savage Beauty. Metropolitan Museum of Art.", "Blanks, T. (various). Vogue Runway archive, 2000–2009 seasons (vogue.com)."]
  },
  {
    id: "2010s", label: "2010s", years: "2010–2019",
    swatches: [["#F4C2C2","Millennial pink (approx.)"],["#9CAF88","Sage"],["#36454F","Charcoal"],["#E2725B","Terracotta"],["#CFA41C","Mustard"],["#808080","Athleisure grey (approx.)"]],
    why: "Two quiet neutrals defined the decade's wider culture: 'normcore' and athleisure's grey, black and navy basics, and 'millennial pink', a dusty, desaturated pink that spread from design and branding into clothing from roughly the mid-2010s on (its exact starting point is debated; it's often linked loosely to a 2011 fashion campaign, but no single source coined it). Against that calm, Alessandro Michele's Gucci, from 2015, went the opposite way: maximalist, eclectic and richly colored.",
    pieces: [
      "Alessandro Michele's Gucci collections, from 2015, mixing clashing prints and saturated color against the decade's dominant restraint.",
      "'Millennial pink' spreading through fashion, interiors and branding from the mid-2010s.",
      "Athleisure and 'normcore' basics in grey, black and navy, worn on and off the gym."
    ],
    hedge: "The '2010s palette' is closer to a retrospective media label than a single trend any forecaster set; it is still being written up by historians.",
    sources: ["Friedman, V. (2017). 'Why Millennial Pink Refuses to Go Away'. The New York Times.", "Vogue Runway archive, Gucci collections 2015–2019 (vogue.com)."]
  },
  {
    id: "2020s", label: "2020s", years: "2020–",
    swatches: [["#FF69B4","Barbiecore pink (approx.)"],["#FFFDD0","Cream"],["#E2725B","Terracotta"],["#BFFF00","Lime"],["#0047AB","Cobalt"],["#8E7F71","Quiet-luxury taupe"]],
    why: "Two opposite moods have run side by side so far. 'Dopamine dressing', bright, saturated color worn for mood rather than matching, followed the pandemic's muted years, and 'Barbiecore' pink peaked around the 2023 Barbie film. At the same time a 'quiet luxury' taste for unlabeled, neutral tailoring, associated with brands such as The Row and Loro Piana, pulled the other way toward cream, taupe and camel.",
    pieces: [
      "Barbiecore pink, amplified by the marketing around the 2023 live-action Barbie film and its press tour.",
      "Valentino's all-pink 'Pink PP' collection, creative director Pierpaolo Piccioli, shown 2022, ahead of the film and widely linked to the same trend.",
      "'Quiet luxury' neutral dressing, associated loosely with brands including The Row and Loro Piana, early 2020s."
    ],
    hedge: "This decade isn't over, and its color story is still being argued over in real time; treat this entry as an early, unfinished read rather than settled history.",
    sources: ["Vogue Business, 'What is quiet luxury?' (voguebusiness.com).", "Reuters/AP coverage of Barbie-film marketing and 'Barbiecore', July 2023."]
  }
],

// ---------------------------------------------------------------- Pantone Color of the Year
// Approximate screen colors; Pantone® is a trademark of Pantone LLC. The full page data/wiki-nodes.js
// "color-of-the-year" covers the idea in prose; this is the year-by-year list.
cotyNote: "Pantone, the color-standards company, has named one 'Color of the Year' every December since 2000. It reads less like a forecast than an announcement: by the time it's named, the color has usually already been chosen for the next season's fabric and yarn at mills and fiber fairs (events like Première Vision in Paris), informed by forecasters including Pantone's own Color Institute and the trend service WGSN, who track film, travel, design and runway color up to two years ahead. Nothing measures whether a pick truly captures 'the mood of the year'; it is one company's story about the year, timed to sell trend reports, paint chips and licensed products alongside it. Brands follow it unevenly, and plenty of fashion color has nothing to do with it at all.",
coty: [
  { year: 2000, name: "Cerulean", hex: "#9BB7D4", note: "A soft sky blue, paler than the painters' [[Cerulean]]; the first pick of the series." },
  { year: 2001, name: "Fuchsia Rose", hex: "#C74375", note: "A warm pink-red, chosen as the millennium's fashion and beauty color took a brighter turn." },
  { year: 2002, name: "True Red", hex: "#BC243C", note: "A clear, classic red, pitched as timeless rather than trendy." },
  { year: 2003, name: "Aqua Sky", hex: "#7BC4C4", note: "A pale blue-green, following the early-2000s taste for spa-like calm." },
  { year: 2004, name: "Tigerlily", hex: "#E2583E", note: "A bold orange-red, named for the lily, pushing warmth after several cooler years." },
  { year: 2005, name: "Blue Turquoise", hex: "#53B0AE", note: "A deep blue-green, between [[Teal]] and [[Turquoise]]." },
  { year: 2006, name: "Sand Dollar", hex: "#DECDBE", note: "A pale neutral beige, a quiet pick after some saturated years." },
  { year: 2007, name: "Chili Pepper", hex: "#9B1B30", note: "A deep, spicy red, close to [[Oxblood]]." },
  { year: 2008, name: "Blue Iris", hex: "#5A5B9F", note: "A blue-violet, between [[Indigo]] and [[Periwinkle]]." },
  { year: 2009, name: "Mimosa", hex: "#F0C05A", note: "A warm, optimistic yellow, picked as the global financial crisis hit." },
  { year: 2010, name: "Turquoise", hex: "#45B5AA", note: "A vivid blue-green, pitched as 'inviting' and 'escapist'." },
  { year: 2011, name: "Honeysuckle", hex: "#D94F70", note: "A bold pink-red, described by Pantone as a 'confident' color for uncertain times." },
  { year: 2012, name: "Tangerine Tango", hex: "#DD4124", note: "A fiery red-orange, close to [[Vermilion]]." },
  { year: 2013, name: "Emerald", hex: "#009B77", note: "A deep green, Pantone's first use of a stone's name rather than a mixed-sounding word." },
  { year: 2014, name: "Radiant Orchid", hex: "#B565A7", note: "A bright purple-pink, between [[Orchid]] and [[Magenta]]." },
  { year: 2015, name: "Marsala", hex: "#955251", note: "A brownish wine-red, named for the fortified wine." },
  { year: 2016, name: "Rose Quartz & Serenity", hex: "#F7CAC9", note: "Two colors named together for the first time: a pale pink and a pale blue, side by side." },
  { year: 2017, name: "Greenery", hex: "#88B04B", note: "A fresh yellow-green, close to [[Pistachio]], pitched as a 'breath of fresh air'." },
  { year: 2018, name: "Ultra Violet", hex: "#5F4B8B", note: "A deep blue-violet, linking the color to music, art and stargazing." },
  { year: 2019, name: "Living Coral", hex: "#FF6F61", note: "A warm, animated orange-pink, between [[Coral]] and [[Salmon]]." },
  { year: 2020, name: "Classic Blue", hex: "#0F4C81", note: "A deep, reassuring blue close to [[Cobalt]], described as 'instilling calm'." },
  { year: 2021, name: "Ultimate Gray & Illuminating", hex: "#939597", note: "Two colors again: a steady grey with a bright, hopeful yellow, named during the pandemic." },
  { year: 2022, name: "Very Peri", hex: "#6667AB", note: "A new blue-violet mix Pantone said it created rather than selected from an existing chip." },
  { year: 2023, name: "Viva Magenta", hex: "#BB2649", note: "A crimson-leaning red, not a true [[Magenta]], described by Pantone as 'brave and fearless'." },
  { year: 2024, name: "Peach Fuzz", hex: "#FFBE98", note: "A soft, warm peach, close to [[Peach]], pitched as 'kind and tactile'." },
  { year: 2025, name: "Mocha Mousse", hex: "#A47864", note: "A milky brown, close to [[Sepia]], tied to a taste for 'comfort' colors." },
  { year: 2026, name: "Cloud Dancer", hex: "#F0EFEA", note: "An airy off-white, the first white Pantone has named Color of the Year." }
],

// ---------------------------------------------------------------- houses and signature colors
houses: [
  { id: "schiaparelli", house: "Schiaparelli", label: "Shocking pink", hex: "#E3007D",
    body: "In 1937 Elsa Schiaparelli named a jolt of magenta-pink 'Shocking' and built a perfume bottle, a boutique and much of her late-1930s collection around it. The color, closer to a bright [[Magenta]] than to softer [[Pink]], became her signature the way red is Valentino's: not her only color, but the one that still says her name.",
    hedge: "The exact shade has shifted across reissues and relaunches since the house's 2012 couture revival; treat any single hex as approximate.",
    sources: ["Blum, D. E. (2003). Shocking! The Art and Fashion of Elsa Schiaparelli. Philadelphia Museum of Art.", "Secrest, M. (2014). Elsa Schiaparelli: A Biography. Alfred A. Knopf."] },
  { id: "valentino", house: "Valentino", label: "Valentino red", hex: "#C40233",
    body: "Valentino Garavani favored one saturated red across six decades of collections, often called 'Rosso Valentino' in the press. He traced it, in interviews, to a childhood memory of a flamenco dancer in red in Barcelona, a vivid but hard-to-verify origin story like many designers tell about their own signatures.",
    hedge: "No single Pantone number is published as 'the' official Rosso Valentino; the house's reds have varied by season and fabric.",
    sources: ["Mauriès, P. (2014). Valentino: Themes and Variations. Rizzoli.", "Vogue, interviews with Valentino Garavani on 'Valentino red' (various years)."] },
  { id: "hermes", house: "Hermès", label: "Hermès orange", hex: "#FF6600",
    body: "Hermès boxes and ribbons are now almost synonymous with a bright orange, but the house's own telling is practical, not aesthetic: wartime paper shortages around 1942 reportedly forced a switch from the original cream box, and the orange stock on hand stuck once peace returned. It is a rare branding color whose origin story is supply-chain accident rather than design intent.",
    hedge: "Hermès' own retellings of the exact year and reason vary slightly across interviews; treat the wartime-shortage account as the commonly repeated version, not a documented certainty.",
    sources: ["Hermès, company history notes (hermes.com, 'Our story').", "Chadwick, S. (2017). Hermès: A History. Rizzoli."] },
  { id: "tiffany", house: "Tiffany & Co.", label: "Tiffany Blue", hex: "#81D8D0",
    body: "Tiffany & Co. has used a robin's-egg blue on its catalogues and boxes since the mid-1800s, and has held it as a registered US trademark since 1998 for jewelry packaging. Pantone, the company behind the [[color-of-the-year|Color of the Year]], mixes it privately as 'PMS 1837', after 1837, the year Tiffany was founded; it is not a publicly listed Pantone color. See [[color-trademarks|owning a color]] for how color trademarks work and their limits.",
    sources: ["Tiffany & Co., 'The story of Tiffany Blue' (tiffany.com).", "US Trademark Reg. No. 2,359,351, Tiffany & Co."] },
  { id: "chanel", house: "Chanel", label: "Black and beige", hex: "#16171A",
    body: "Chanel's 1926 black crepe day dress, featured in Vogue, helped move black from mourning and servants' uniforms into ordinary daywear, though Chanel did not invent the black dress: evening black was already fashionable, and the magazine's famous nickname for it as 'Chanel's Ford' is often repeated but hard to source to a first printing. Her 1954 comeback collection, after years away during and after the war, reasserted a second signature: black, [[Navy]] and beige together, a deliberately quiet palette against the decade's fuller color.",
    hedge: "The 'Chanel's Ford' Vogue quote is widely repeated in fashion writing but its original source is unclear; treat it as a famous line of uncertain provenance.",
    sources: ["Charles-Roux, E. (2005). Chanel and Her World. Vendome Press.", "Koda, H. & Bolton, A. (2005). Chanel. Metropolitan Museum of Art."] },
  { id: "ysl", house: "Yves Saint Laurent", label: "Mondrian colors & Majorelle Blue", hex: "#6050DC",
    body: "Saint Laurent's autumn 1965 cocktail dresses, color-blocked panels in red, blue, yellow, black and white, paid homage to Piet Mondrian's paintings and became one of fashion's best-known art crossovers. A different blue carries his name today for a different reason: in 1980 Saint Laurent and his partner Pierre Bergé bought the Majorelle Garden in Marrakech to save it from redevelopment, restoring its cobalt-blue buildings, painted in a shade the French artist Jacques Majorelle had mixed in the 1930s. Saint Laurent's ashes were scattered there after his death in 2008.",
    sources: ["Rawsthorn, A. (1996). Yves Saint Laurent: A Biography. Doubleday.", "Jardin Majorelle, 'History' (jardinmajorelle.com)."] },
  { id: "dior", house: "Dior", label: "Dior grey", hex: "#8B8680",
    body: "Christian Dior called grey the most elegant of colors and used a pale, cool version of it on the walls of his first 1947 Avenue Montaigne salon; the house still calls a signature grey 'Gris Dior' across packaging and boutiques. It is a quieter kind of house color than a loud signature red or pink: a backdrop that is supposed to make everything placed in front of it look better.",
    sources: ["Pochna, M.-F. (1996). Christian Dior: The Man Who Made the World Look New. Arcade.", "Dior, 'The Dior grey' (dior.com, maison notes)."] },
  { id: "balenciaga", house: "Balenciaga", label: "Black", hex: "#0B0B0D",
    body: "Cristóbal Balenciaga built some of his most sculptural 1950s-60s shapes, the 'Infanta' and 'baby doll' silhouettes among them, in black, letting cut and volume do what color might otherwise do. The house under creative director Demna, from 2015, has kept black central to a very different, streetwear-inflected version of the brand.",
    sources: ["Healy, R. (2011). Balenciaga: Working in Black. V&A Publishing.", "Miller, L. (2007). Cristóbal Balenciaga. V&A Publishing."] },
  { id: "missoni", house: "Missoni", label: "Rainbow zigzag", hex: "#D62F2F",
    body: "Ottavio and Rosita Missoni spent the 1950s-70s developing zigzag, striped and space-dyed knitwear that layers many colors into one garment rather than choosing a single signature hue. It is the exception on this list: Missoni's identity is a method (irregular color, repeated motifs, loosely controlled dyeing) more than one named color.",
    sources: ["Sozzani, F. (2014). Missoni: La Grande Maison. Rizzoli.", "Fashion Institute of Technology, 'Missoni' exhibition notes (fitnyc.edu)."] },
  { id: "pucci", house: "Emilio Pucci", label: "Psychedelic prints", hex: "#7B3FA0",
    body: "Emilio Pucci's silk prints of the 1950s-60s, swirling, kaleidoscopic and saturated, were worn widely by jet-set clientele; Marilyn Monroe reportedly owned several and is said to have been buried in a Pucci dress, a detail repeated often but not independently confirmed. Like Missoni, Pucci's signature is a method, dense pattern in many bright colors, rather than one hex code.",
    hedge: "The 'buried in Pucci' detail comes from entertainment reporting rather than a primary record; treat it as a widely repeated claim.",
    sources: ["Mauriès, P. (2016). Emilio Pucci. Rizzoli.", "Victoria and Albert Museum, 'Emilio Pucci' collection notes (vam.ac.uk)."] },
  { id: "lanvin", house: "Lanvin", label: "Lanvin blue", hex: "#1E3A8A",
    body: "Jeanne Lanvin, who founded her house in 1889, favored a deep cobalt-ultramarine she used across early-20th-century collections and packaging; design writers often trace it to the blues in Fra Angelico's Renaissance frescoes, a connection that is more often repeated than documented firsthand. It predates, and likely influenced the naming sense behind, later 'signature blues' like Tiffany's and YSL's Majorelle Blue.",
    hedge: "The Fra Angelico link is a popular design-history story; no surviving note from Lanvin herself confirms it as her stated inspiration.",
    sources: ["Picon, J. (2007). Jeanne Lanvin. Éditions du Regard.", "Palais Galliera, 'Jeanne Lanvin' exhibition notes (palaisgalliera.paris.fr)."] },
  { id: "louboutin", house: "Christian Louboutin", label: "Red sole", hex: "#C40233",
    body: "Christian Louboutin has said he painted a shoe's sole with red nail polish on impulse in 1992 because the design needed 'energy', and the lacquered red sole became the house's trademark. US courts (Louboutin v. Yves Saint Laurent, 2nd Circuit, 2012) upheld trademark protection for the red sole specifically when it contrasts with a different-colored upper, but not when a shoe is red all over; protection has varied in other countries' courts.",
    sources: ["Louboutin, C. interviews on the red sole's origin (various, including Harper's Bazaar).", "Christian Louboutin S.A. v. Yves Saint Laurent America, Inc., 696 F.3d 206 (2d Cir. 2012)."] },
  { id: "bottega", house: "Bottega Veneta", label: "Bottega green", hex: "#2E7D4F",
    body: "A saturated green, nicknamed 'Bottega green' or 'parakeet green' online, became closely associated with the house's 2018-19 collections under creative director Daniel Lee, alongside its decades-old woven-leather 'intrecciato' technique. The nickname is informal, not a trademarked or official Bottega Veneta name.",
    sources: ["Vogue Runway, Bottega Veneta collection reviews 2018–2019 (vogue.com).", "Business of Fashion, 'How Daniel Lee Rebuilt Bottega Veneta' (businessoffashion.com)."] },
  { id: "barbiecore", house: "Barbiecore (Mattel / Valentino)", label: "Barbiecore pink", hex: "#FF69B4",
    body: "Barbiecore, a 2022-23 media and social-media trend, borrowed its pink from Mattel's Barbie doll, itself tracing to the saturated pink of the doll's 1959 packaging, and was amplified by Valentino's all-pink 'Pink PP' 2022 collection and the marketing around the 2023 live-action Barbie film. Unlike the other entries here, it isn't one house's decades-old signature; it's a short, loud, film-driven moment, worth noting precisely because of how fast it moved.",
    sources: ["Reuters/AP, coverage of 'Barbiecore' and Barbie-film marketing, July 2023.", "Mattel, 'Barbie history' (mattel.com, brand notes)."] },
  { id: "gucci", house: "Gucci", label: "Burgundy, black and bottle-green velvet", hex: "#4A0000",
    body: "Tom Ford's tenure as Gucci's creative director, 1994-2004, restyled a struggling house around sleek, sexualized glamour in deep burgundy, black and bottle-green velvet, a palette widely credited with Gucci's commercial turnaround. Later creative directors, including Alessandro Michele from 2015, kept jewel-toned richness while adding eclectic pattern and maximalism on top (see the 2010s above).",
    sources: ["Thomas, D. (2007). Deluxe: How Luxury Lost Its Luster. Penguin.", "Frankel, S. (2001). Visionaries: Interviews with Fashion Designers. V&A Publishing."] }
],

// ---------------------------------------------------------------- fashion history pages
history: [
  {
    id: "purple-law", title: "Purple and the law", dek: "In Rome and Byzantium a dye, not a hue, was the crime: wearing the wrong purple could cost your life.",
    body: [
      "Roman and Byzantine purple came from the glands of Mediterranean murex sea snails; each snail gave only a drop of dye, so a single garment's trim could need thousands of them. Ancient writers priced the finest grade above gold, and the law followed the money: senators wore a purple stripe, a triumphant general a full purple toga for one day, and by the 4th century AD the emperor alone could wear solid [[tyrian-purple|Tyrian purple]]. Because the dye, not a measured hue, was what the law policed ('purple' then covered everything from crimson to near-black), fakes made from cheaper plant dyes were common and were exactly what the rules were written to catch.",
      "Byzantium kept the system for another thousand years: imperial children were 'born in the purple', and Justinian and Theodora appear in deep purple against gold in the 6th-century mosaics of Ravenna's Basilica of San Vitale. The trade declined after Constantinople's sack in 1204 and the recipe was effectively lost by the city's fall in 1453. In 1464 the pope moved cardinals from purple to [[kermes|kermes]] scarlet, a red Europe could still buy, and when [[william-perkin|William Perkin]] made [[mauveine|mauve]] from coal tar in 1856, he first marketed it as 'Tyrian purple', borrowing two thousand years of imperial glamour for a dye anyone could own."
    ],
    swatches: [["#5B1F3E","Tyrian, dark"],["#7A2C55","Imperial purple"],["#A33B4B","Clotted-blood red"],["#C9A54A","Gold ground"]],
    facts: [["Source","Murex sea snails"],["Imperial monopoly","By the 4th century AD"],["Recipe lost","By 1453"]],
    sources: ["Ball, P. (2001). Bright Earth: Art and the Invention of Color. Farrar, Straus and Giroux.", "Pastoureau, M. (2017). Red: The History of a Color. Princeton University Press.", "Reinhold, M. (1970). History of Purple as a Status Symbol in Antiquity. Latomus.", "Cooksey, C. J. (2001). Tyrian purple: 6,6'-dibromoindigo and related compounds. Molecules 6(9)."]
  },
  {
    id: "tudor-sumptuary", title: "Who could wear scarlet", dek: "Medieval and Tudor sumptuary laws tied color to rank. They were strict on paper and leaky in practice.",
    body: [
      "Before chemical dyes, color read as cost: a deep, even red needed [[kermes|kermes]], a dye made from insects gathered in bulk off Mediterranean oaks, and dyeing it well took skill most dyers couldn't match. European towns and crowns, from the 12th century on, passed sumptuary laws tying specific dyes and fabrics to rank, hoping a glance could tell a lord from a merchant. Henry VIII's Acts of Apparel (from 1510, restated 1533) and Elizabeth I's later proclamations kept silk 'of the colour of purple' and cloth of gold for the royal family, and crimson and blue velvet for the high nobility.",
      "The clearest evidence the laws failed is how often they were reissued: towns raised fines and hired inspectors, then let enforcement lapse, over and over, until England's Parliament repealed the old acts outright in 1604. One unplanned effect mattered more than the law itself: merchants barred from scarlet turned to a different luxury the rules allowed, a deep, costly black dyed with oak galls, which spread from Italian city-states to the Burgundian court and from there across Europe."
    ],
    img: { thumb: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/dc/Elizabeth_I_Darnley_Portrait.jpg/500px-Elizabeth_I_Darnley_Portrait.jpg", w: 500, h: 732,
      alt: "Portrait of Elizabeth I in elaborate dress and jewelry, known as the Darnley Portrait", caption: "The 'Darnley Portrait' of Elizabeth I, c. 1575, whose reign saw some of the strictest English apparel proclamations.",
      credit: "National Portrait Gallery, London · Public Domain Mark 1.0", licenseUrl: "https://creativecommons.org/publicdomain/mark/1.0/", commons: "https://commons.wikimedia.org/wiki/File:Elizabeth_I_Darnley_Portrait.jpg" },
    swatches: [["#B3202A","Kermes scarlet"],["#7E1F2B","Crimson grain"],["#6E5A4A","Russet"],["#17161A","Gall black"]],
    facts: [["Oldest English statute","1337 (wool and fur)"],["Tudor acts","1510, 1533"],["Repealed in England","1604"]],
    sources: ["Hunt, A. (1996). Governance of the Consuming Passions: A History of Sumptuary Law. Macmillan.", "Pastoureau, M. (2009). Black: The History of a Color. Princeton University Press.", "Greenfield, A. B. (2005). A Perfect Red. HarperCollins.", "Hayward, M. (2009). Rich Apparel: Clothing and the Law in Henry VIII's England. Ashgate."]
  },
  {
    id: "edo-browns", title: "Forty-eight browns, a hundred greys", dek: "Banned from bright luxury, Edo-period townspeople turned brown, grey and indigo into a fashion of their own.",
    body: [
      "Japan's Tokugawa shogunate issued sumptuary edicts across more than two centuries (a well-known one in 1683) that kept silk brocade, gold thread and expensive dyes like safflower red and gromwell purple away from merchants and townspeople, even as those same merchants grew rich. What the edicts left legal was ordinary: cotton and plain silk in [[Brown|brown]], [[Grey|grey]] and [[Indigo|indigo]], colors cheap dyes and repeated dipping could give. Within those limits, dyers chased fine distinctions instead of forbidden brightness, naming shades after kabuki actors and places: Danjūrō-cha, a persimmon brown named for an acting dynasty, or Rikyū-nezumi, a grey tinged with tea.",
      "The saying shijūhatcha hyakunezumi, 'forty-eight browns and a hundred greys', summed up the result, though the numbers are figurative, meaning simply 'countless', not an actual catalogue. By the 19th century this restraint had become a positive taste of its own, later described by the philosopher Kuki Shūzō as iki, an urbane chic that prized a dark ground and a hint of unexpected color at a hem or lining over anything loud. The lesson travels beyond Japan: when bright color is forbidden or simply expensive, attention shifts to nuance instead."
    ],
    img: { thumb: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ef/Kitagawa_Utamaro_ukiyo-e_woodblock_print.jpg/500px-Kitagawa_Utamaro_ukiyo-e_woodblock_print.jpg", w: 500, h: 707,
      alt: "Ukiyo-e woodblock print of a woman with a mirror, by Kitagawa Utamaro", caption: "A bijin-ga ('beauty picture') woodblock print by Kitagawa Utamaro, Edo period.",
      credit: "Wikimedia Commons · Public domain (PD-old-100)", licenseUrl: "https://en.wikipedia.org/wiki/Public_domain", commons: "https://commons.wikimedia.org/wiki/File:Kitagawa_Utamaro_ukiyo-e_woodblock_print.jpg" },
    swatches: [["#7A4B2A","Danjūrō-cha"],["#6E6A4E","Rokō-cha"],["#6F6A66","Rikyū-nezumi"],["#2C3A52","Indigo"]],
    facts: [["Period","Edo, 1603–1868"],["Famous edict","1683"],["The numbers","Figurative: 'countless'"]],
    sources: ["Shively, D. H. (1964–65). Sumptuary Regulation and Status in Early Tokugawa Japan. Harvard Journal of Asiatic Studies 25.", "Gluckman, D. C. & Takeda, S. T. (1992). When Art Became Fashion: Kosode in Edo-Period Japan. LACMA.", "Kuki, S. (1930). Iki no kōzō; trans. Nara, H. (2004), The Structure of Detachment. University of Hawai'i Press."]
  },
  {
    id: "kasane", title: "Kasane: colors in layers", dek: "Heian court women wore a season in silk, stacked robes whose edges showed a poetically named color.",
    body: [
      "At the Heian court (794–1185), a noblewoman wore several unlined silk robes at once, and only their edges showed, at sleeve, neck and hem. Rules called kasane no irome, 'the colors of layering', paired those edges into named combinations such as red plum, cherry or autumn maple, each tied to a season or occasion. Choosing the right combination at the right moment showed taste and attention; getting it wrong, or wearing last month's combination, was a real and recorded social failure.",
      "Later writers, working after the Heian period itself, tried to fix lists of correct kasane, and they disagree with each other on details, a reminder that much of what's taught today as 'the' Heian color code was reconstructed afterward rather than written down whole at the time. [[Lavender]] and deep [[Purple]] carried particular prestige, continuing the association between purple and rank found across many cultures (see [[#history:purple-law|purple and the law]]). The idea that clothing color could be read almost like a calendar, each layer a small, legible statement, has no exact modern equivalent, but it's an extreme version of something true everywhere: color choices are judged, remembered and sometimes catalogued by people who were paying far closer attention than we now assume."
    ],
    swatches: [["#C8A2C8","Lavender"],["#F28DB2","Cherry"],["#CC5500","Autumn maple"],["#7B3FA0","Deep purple"]],
    facts: [["Period","Heian, 794–1185"],["System","Kasane no irome, 'colors of layering'"],["Caution","Later written lists disagree with each other"]],
    sources: ["Dalby, L. (2001). Kimono: Fashioning Culture. University of Washington Press.", "Shively, D. H. & McCullough, W. H. (eds.) (1999). The Cambridge History of Japan, Vol. 2: Heian Japan. Cambridge University Press.", "Murasaki Shikibu (c. 1000s). The Tale of Genji; trans. Royall Tyler (2001), Penguin Classics (on dress and kasane)."]
  },
  {
    id: "mourning-dress", title: "Mourning dress in the 1800s", dek: "Victorian grief had a dress code: matte black crape, then grey, then mauve, timed almost in months.",
    body: [
      "Nineteenth-century Britain and America turned mourning into graded dress. A widow's 'deep' mourning, a year and a day or more in dull black crape, a crinkled silk gauze crimped to kill its shine, gave way to lighter black, then 'half mourning' in [[Grey|grey]], [[Lilac|lilac]] and [[Mauve|mauve]]. Shine meant celebration, so mourning avoided it on purpose: even jewelry had to be matte or black, which is why jet, a fossil wood from Whitby, boomed after 1861. Queen Victoria's forty years in black after Prince Albert's 1861 death made her the system's figurehead, though the fashion for graded mourning predates her and was already a going industry, with specialist 'mourning warehouses' selling full outfits at short notice.",
      "The First World War broke the system for good: with mourning numbers so high, dressing every household in full black for months at a time became impractical and was seen as bad for public morale, and many families wore only an armband instead. By the 1920s black had drifted from grief toward ordinary chic, and the elaborate Victorian timetable of color, crape giving way to silk, then grey, then mauve, never returned."
    ],
    img: { thumb: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b1/Fashion_Plate_%28Evening_Mourning_Dress%29_LACMA_M.86.266.87.jpg/500px-Fashion_Plate_%28Evening_Mourning_Dress%29_LACMA_M.86.266.87.jpg", w: 500, h: 687,
      alt: "Hand-colored engraving of a woman in an evening mourning dress with a veil, 1810", caption: "An 'Evening Mourning Dress' fashion plate by Rudolph Ackermann, December 1810, decades before Victoria's own mourning made the custom famous.",
      credit: "Los Angeles County Museum of Art (LACMA) · Public domain", licenseUrl: "https://en.wikipedia.org/wiki/Public_domain", commons: "https://commons.wikimedia.org/wiki/File:Fashion_Plate_(Evening_Mourning_Dress)_LACMA_M.86.266.87.jpg" },
    swatches: [["#141315","Crape black"],["#77737A","Grey"],["#B7A3C9","Lavender"],["#9A7A9E","Mauve"]],
    facts: [["Deep mourning","A year and a day, or more"],["Fabric","Black silk crape"],["Victoria in black","1861–1901"]],
    sources: ["Taylor, L. (1983). Mourning Dress: A Costume and Social History. Allen & Unwin.", "Metropolitan Museum of Art (2014). Death Becomes Her: A Century of Mourning Attire (catalogue).", "Jalland, P. (1996). Death in the Victorian Family. Oxford University Press."]
  },
  {
    id: "aniline-craze", title: "The aniline craze", dek: "Mauve, then magenta, then a flood: coal-tar dyes made the 1860s the loudest decade in fashion yet.",
    body: [
      "In 1856 [[william-perkin|William Perkin]], then eighteen, was trying to make the malaria drug quinine when an experiment with coal-tar aniline left a sludge that dyed silk a bright purple. He patented it and opened a factory in 1857; the fashion for the color, which he called mauve after the mallow flower, had actually started a year earlier in Paris with plant- and guano-derived purples, and Queen Victoria wearing mauve velvet to her daughter's 1858 wedding helped push it further. 'First aniline dye' is the safe claim for Perkin's mauveine; a synthetic yellow, picric acid, had already dyed silk commercially in Lyon from the 1840s, so 'first synthetic dye' overstates it.",
      "Magenta followed fast: French chemist François-Emmanuel Verguin made a red-purple from aniline in 1858-59 and named it fuchsine, after the fuchsia flower, before it was renamed for the 1859 battles of Magenta and Solferino. Dozens of new colors, Hofmann's violets, aniline blues, Bismarck brown, arrived within a decade, ending the old link between bright color and wealth almost overnight: a maid could now afford a mauve ribbon that would once have needed a king's dye works. Not every effect was good. Some early aniline colors faded or ran, dye-works pollution poisoned wells in at least one documented 1860s case near Basel, and William Morris later called the whole palette hideous and went back to natural dyes in his own workshops."
    ],
    swatches: [["#8E4A9A","Perkin's mauve"],["#C2307E","Fuchsine magenta"],["#6A3FA0","Hofmann's violet"],["#8A4B22","Bismarck brown"]],
    facts: [["Mauveine","1856, W. H. Perkin"],["Factory opened","1857, Greenford"],["Fuchsine (magenta)","1858–59, Verguin"]],
    sources: ["Garfield, S. (2000). Mauve: How One Man Invented a Color That Changed the World. Faber & Faber.", "Ball, P. (2001). Bright Earth. Farrar, Straus and Giroux.", "Blaszczyk, R. L. (2012). The Color Revolution. MIT Press."]
  },
  {
    id: "arsenic-green", title: "Arsenic green dresses", dek: "Victorian greens were often dyed and dusted with arsenic. The real danger fell on the workers who made them.",
    body: [
      "Before reliable synthetic dyes, a bright, clear [[Green|green]] was hard to get on cloth, so Scheele's green and [[Emerald|emerald]] green, copper-arsenic pigments rather than true dyes, became popular for ball gowns, artificial-flower wreaths and wallpaper from the late 1850s on. Because they didn't bond to fiber the way a dye does, they were often held onto fabric with starch or glue, and they shed as loose, toxic dust. Chemists who tested green tarlatan gowns in the 1860s found arsenic coming off in exactly that way, and Punch magazine printed a cartoon of skeletons dressed for 'The Arsenic Waltz' in 1862.",
      "Wearers mostly suffered skin irritation where the fabric touched them; the real harm fell further upstream, on the young women who made artificial flowers by hand, dusting leaves with green powder all day. Matilda Scheurer, a nineteen-year-old London flower maker, died of arsenic poisoning in 1861, and the inquest's medical testimony helped turn public opinion against the pigments, as historian Alison Matthews David has argued, decades before any single British law banned them outright; newer synthetics and bad publicity simply made them unfashionable by the 1890s. The popular claim that arsenic-green wallpaper killed Napoleon on St Helena remains unproven; most researchers now favor stomach cancer, and the story is best told as an open question, not a fact."
    ],
    swatches: [["#3F9F4F","Scheele's green"],["#2BA866","Emerald green"],["#9ACD32","Leaf powder"],["#1F6B45","Faded green"]],
    facts: [["Scheele's green","1775"],["Emerald green","1814, Schweinfurt"],["Flower-maker's death","1861, London"]],
    sources: ["Matthews David, A. (2015). Fashion Victims: The Dangers of Dress Past and Present. Bloomsbury.", "Whorton, J. C. (2010). The Arsenic Century. Oxford University Press.", "Wellcome Collection, 'The Arsenic Waltz' (Punch, 1862)."]
  },
  {
    id: "khaki-camo", title: "Khaki, field grey and camouflage", dek: "Armies once dressed to be seen. Accurate rifles changed that, and the color of dust became the color of war.",
    body: [
      "For centuries soldiers wore bright coats, [[Scarlet|scarlet]] for the British, blue for the French, so commanders could tell friend from foe through smoke. Long-range rifle fire made that deadly, and the answer was [[Khaki|khaki]], named from a Hindustani word for dust, first worn by a British-Indian frontier unit in 1846 and dyed, early on, with whatever was on hand: mud, tea, plant extract. After the Second Boer War (1899-1902) showed how badly bright uniforms exposed troops, Britain adopted khaki service dress army-wide in 1902; Germany followed with field grey in 1910, France switched from its old blue-and-red to pale 'horizon blue' in 1915 after catastrophic early losses, and the first dedicated camouflage units appeared the same year.",
      "These were a new kind of military color, chosen to hide rather than show anything, and camouflage soon crossed into civilian fashion: army-surplus khaki became cheap postwar leisurewear, Vogue photographed camouflage-inspired looks as early as 1943, and Andy Warhol painted camouflage canvases in the 1980s. Printed camo in pink, blue or any color now carries no hiding power at all, just the memory of what it once did."
    ],
    swatches: [["#B5A27A","Khaki drab"],["#7A7356","Olive drab"],["#7C7F6E","Field grey"],["#8FA4BF","Horizon blue"]],
    facts: [["First khaki","Corps of Guides, 1846"],["British service dress","1902, after the Boer War"],["German field grey","1910"]],
    sources: ["Newark, T. (2007). Camouflage. Thames & Hudson / Imperial War Museum.", "Pastoureau, M. (2001). Blue: The History of a Color. Princeton University Press.", "Forbes, P. (2009). Dazzled and Deceived: Mimicry and Camouflage. Yale University Press."]
  },
  {
    id: "denim-workwear", title: "Denim: work clothes first", dek: "Jeans spent most of their life as sensible workwear. Rebellion came later, and only in some places.",
    body: [
      "Blue jeans are twill cotton with an [[indigo-dye|indigo]]-dyed warp and an undyed weft, which is why they're blue outside, paler inside, and fade at the knees and seams rather than evenly: indigo sits on the surface of the yarn instead of soaking all the way through, so friction wears the color off exactly where a garment is worn hardest. In 1873 Levi Strauss and tailor Jacob Davis patented copper-riveted work trousers for miners and laborers, offered in both brown canvas and blue denim; blue won out and stayed the standard for decades of plain, unglamorous workwear.",
      "The idea that jeans were 'always' rebel clothing doesn't hold up. American films of the 1950s (The Wild One, Rebel Without a Cause) gave them a youth-rebellion image, and historian Michel Pastoureau argues jeans only picked up that mythic charge in Europe from the late 1960s; for most of their history before and after, jeans meant ordinary comfort, not revolt, which is exactly why they were just as easily worn by presidents and grandparents within a generation. Making denim look old or worn today, stone-washing, bleaching, sandblasting (now banned by many brands for the lung disease it caused workers), uses real resources to fake the fading that honest work once did for free."
    ],
    swatches: [["#1F2C4D","Raw indigo"],["#2F4A75","Rinse wash"],["#8DA5C4","Light wash"],["#F1EEE6","White weft"]],
    facts: [["Patent","20 May 1873"],["Weave","Twill, indigo-dyed warp only"],["Myth","'Always rebel clothing'"]],
    sources: ["Balfour-Paul, J. (2011). Indigo: Egyptian Mummies to Blue Jeans. British Museum Press.", "Pastoureau, M. (2001). Blue: The History of a Color. Princeton University Press.", "Downey, L. (2016). Levi Strauss: The Man Who Gave Blue Jeans to the World. University of Massachusetts Press."]
  },
  {
    id: "pink-blue-babies", title: "Pink and blue for babies", dek: "Babies wore white for a century. Pink-for-girls came later, and the real history is messier than the legend.",
    body: [
      "Through most of the 1800s, young children of both sexes, boys included, wore white dresses that could be boiled clean; pink and blue existed only as nursery pastels, chosen for the child or the season rather than to announce sex. A real 1918 American trade article did tell retailers that the 'generally accepted rule' was pink for boys and blue for girls, reasoning pink the 'stronger' color, but it wasn't the universal custom it's often made out to be: a 1927 Time magazine survey of major stores found them split, and in 2012 psychologist Marco Del Giudice searched large digitized book collections and found 'blue for boys, pink for girls' already far more common even before the 1940s, calling the idea of a full color-reversal an urban legend.",
      "Historian Jo Paoletti traces the code hardening through the 1930s-40s as colorfast dyes made colored baby clothes practical and manufacturers began sorting clothes firmly by sex, with pink settling on girls; a unisex trend in the 1960s-70s loosened it again, before prenatal sex testing in the 1980s let parents shop by sex before birth and the pink-and-blue aisles returned stronger than before. Neither 'pink was always for girls' nor 'pink used to be for boys' survives the evidence; what actually happened was a slow, uneven sorting that took most of a century, a useful caution against any claim that a color has always meant one fixed thing."
    ],
    img: { thumb: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Thomas_Gainsborough_-_The_Blue_Boy_%28The_Huntington_Library%2C_San_Marino_L._A.%29.jpg/500px-Thomas_Gainsborough_-_The_Blue_Boy_%28The_Huntington_Library%2C_San_Marino_L._A.%29.jpg", w: 500, h: 754,
      alt: "Thomas Gainsborough's painting 'The Blue Boy', a young man in 18th-century blue satin dress", caption: "Gainsborough's 'The Blue Boy', c. 1770, often paired in museum display with Lawrence's 'Pinkie', a pairing of two unrelated portraits, not evidence of a period color code.",
      credit: "The Huntington Library, Art Museum and Botanical Gardens · Public Domain Mark 1.0", licenseUrl: "https://creativecommons.org/publicdomain/mark/1.0/", commons: "https://commons.wikimedia.org/wiki/File:Thomas_Gainsborough_-_The_Blue_Boy_(The_Huntington_Library,_San_Marino_L._A.).jpg" },
    swatches: [["#F8F6F0","Nursery white"],["#F4C2C9","Baby pink"],["#B6CFE6","Baby blue"]],
    facts: [["Earnshaw's article","June 1918"],["Store survey","Time magazine, 1927: split"],["Became standard","US, c. 1940s"]],
    sources: ["Paoletti, J. B. (2012). Pink and Blue: Telling the Boys from the Girls in America. Indiana University Press.", "Del Giudice, M. (2012). The twentieth century reversal of pink-blue gender coding: a scientific urban legend? Archives of Sexual Behavior 41(6).", "Pastoureau, M. (2017). Red: The History of a Color. Princeton University Press."]
  }
]
};
