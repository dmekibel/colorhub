// Gems and minerals behind ColorHub's colors: what gives each stone its color (impurity, charge transfer,
// color center or structure), the colors and names it lent the world, a hedged slice of history, and three
// short essays on the chemistry and physics of gem color. Built from public-domain and general reference
// facts (color-kb/books/notes.jsonl, source "jewels-finlay", cross-checked against Mindat, GIA, Smithsonian
// and Wikipedia) plus original writing — see research/GEMS.md for the full source list. Loaded by js/gems.js,
// same lazy pattern as data/botany.js.
//
// Shape: window.GEMS = { gems: [...], essays: [...], note }
//   gem:   { id, title, dek, facts: [[label,value],...], body: [p1,p2,...], palette: [[hex,label],...],
//            colors: [ColorHub color names this gem actually gave its name to], sources: [...], img? }
//   essay: { id, title, dek, body: [...], colors: [...], sources: [...] }
//   img (optional, hotlinked Commons thumbnail): { src, w, h, alt, caption, credit, licenseUrl, commons }

window.GEMS = {

note: "Palette swatches are illustrative screen colors, not measured from real stones or any grading standard — natural gems vary enormously, often within one crystal.",

// Hotlinked Wikimedia Commons thumbnails, keyed by graph node id, merged into window.WIKI_IMAGES by
// js/gems.js so the generic figHTML()/wikiPage() picks them up for free, same shape as data/images.js.
images: {
  "gm:gem:ruby": [{ src: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0d/Ruby_cristal.jpg/500px-Ruby_cristal.jpg", w: 500, h: 696, alt: "An unfaceted red ruby crystal about 2 cm long", caption: "A rough ruby crystal, before cutting.", credit: "Adrian Pingstone", license: "Public domain", licenseUrl: "", commons: "https://commons.wikimedia.org/wiki/File:Ruby_cristal.jpg" }],
  "gm:gem:diamond": [{ src: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/Hope_Diamond.jpg/500px-Hope_Diamond.jpg", w: 500, h: 506, alt: "The Hope Diamond, a 45.52-carat dark greyish-blue diamond in a pendant setting", caption: "The Hope Diamond, type IIb and boron-blue, at the Smithsonian.", credit: "David Bjorgen · CC BY-SA 3.0", license: "CC BY-SA 3.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0", commons: "https://commons.wikimedia.org/wiki/File:Hope_Diamond.jpg" }],
  "gm:gem:opal": [{ src: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/49/Precious_opal_%28Australia%29_1_%2827064229482%29.jpg/500px-Precious_opal_%28Australia%29_1_%2827064229482%29.jpg", w: 500, h: 297, alt: "A precious opal specimen showing bright flashes of red, green and blue play of color", caption: "Precious opal from Australia, showing play of color.", credit: "James St. John · CC BY 2.0", license: "CC BY 2.0", licenseUrl: "https://creativecommons.org/licenses/by/2.0", commons: "https://commons.wikimedia.org/wiki/File:Precious_opal_(Australia)_1_(27064229482).jpg" }],
  "gm:gem:labradorite": [{ src: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5d/Labradorite_detail.jpg/500px-Labradorite_detail.jpg", w: 500, h: 493, alt: "A polished labradorite surface flashing blue and gold labradorescence", caption: "Polished labradorite, showing labradorescence.", credit: "Gregory Phillips · CC BY-SA 3.0", license: "CC BY-SA 3.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0", commons: "https://commons.wikimedia.org/wiki/File:Labradorite_detail.jpg" }],
  "gm:gem:alexandrite": [{ src: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/01/Alexandrite_26.75cts.jpg/500px-Alexandrite_26.75cts.jpg", w: 500, h: 236, alt: "The same alexandrite gem photographed twice, bluish green on the left and purple-red on the right", caption: "The same 26.75-carat alexandrite under two lights: daylight (left), incandescent (right).", credit: "David Weinberg, Alexandrite.net · CC BY-SA 3.0", license: "CC BY-SA 3.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0", commons: "https://commons.wikimedia.org/wiki/File:Alexandrite_26.75cts.jpg" }],
  "gm:gem:spinel": [{ src: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f7/Imperial_State_Crown.JPG/500px-Imperial_State_Crown.JPG", w: 500, h: 382, alt: "The Imperial State Crown in profile, showing the large red Black Prince's Ruby set above the Cullinan II diamond", caption: "The Imperial State Crown: the Black Prince's Ruby, a 170-carat red spinel, sits above the Cullinan II.", credit: "Public domain", license: "Public domain", licenseUrl: "", commons: "https://commons.wikimedia.org/wiki/File:Imperial_State_Crown.JPG" }],
  "gm:gem:lapis-lazuli": [{ src: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/Lazurite%2C_pyrite%2C_calcite_3.jpg/500px-Lazurite%2C_pyrite%2C_calcite_3.jpg", w: 500, h: 413, alt: "A lapis lazuli specimen showing deep blue lazurite, white calcite veins and metallic gold-colored pyrite flecks", caption: "Lazurite, calcite and pyrite together — the flecks are pyrite, not gold.", credit: "Parent Géry · CC BY-SA 3.0", license: "CC BY-SA 3.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0", commons: "https://commons.wikimedia.org/wiki/File:Lazurite,_pyrite,_calcite_3.jpg" }]
},

gems: [

{
  id: "ruby", title: "Ruby",
  dek: "Red corundum — the same mineral as sapphire, turned red by a trace of chromium.",
  facts: [["Mineral", "Corundum (aluminium oxide)"], ["Color from", "Chromium replacing aluminium in the crystal"], ["Hardness", "9 on the Mohs scale, second only to diamond"], ["Library name", "Ruby, #E0115F"]],
  body: [
    "Ruby is corundum, plain aluminium oxide, with a little chromium standing in for some of the aluminium atoms. Chromium absorbs green and violet light and lets red and a little blue through, the same trick that colors [[Emerald|emerald]] green in a different host crystal. More chromium and a redder, more saturated stone; too much and the color darkens toward brown. Any corundum that isn't dominantly red is called sapphire instead, by convention rather than chemistry — ruby and sapphire are one mineral under two names.",
    "Burmese stones from Mogok set the standard: a pure, slightly purplish red traders call \"pigeon's blood,\" graded by eye and best judged in the tropical daylight between about 10am and 4pm, when the stone's own red fluorescence adds to its glow. Grades run down through \"ox blood\" and \"rabbit blood\" to a pale \"flower pink.\" English once called the stone a carbuncle, from a Latin word for glowing coal, and Chinese traders called it hung pao shi, red treasured stone. Not every historical \"ruby\" is one: \"Balas ruby\" is spinel, and \"Bohemian,\" \"Cape\" and \"Colorado\" rubies are usually pyrope garnet.",
    "Mogok's mines fed Burma's ruby trade for centuries until cheap synthetic rubies, grown by the Verneuil flame-fusion method from about 1902, undercut natural stone prices; the main pit flooded in 1925 and is now a lake. ColorHub's own [[Scarlet]], [[Crimson]] and [[Oxblood]] sit in the same red family a fine ruby occupies, though none claims to be its exact match."
  ],
  palette: [["#9B111E", "Burmese “pigeon's blood”"], ["#E0115F", "Bright commercial ruby"], ["#AA4069", "Paler “flower pink”"], ["#5C0E1A", "Deep, chromium-dark stone"]],
  colors: [],
  sources: ["Finlay, Jewels: A Secret History (2006), ch. 16–17", "GIA, 'Ruby Description'", "Wikipedia, 'Ruby'; 'Corundum'", "geology.com, 'Ruby and Sapphire: Gems of the Mineral Corundum'"]
},

{
  id: "sapphire", title: "Sapphire",
  dek: "Any color of corundum except red — most famously a deep blue from iron and titanium working together.",
  facts: [["Mineral", "Corundum (aluminium oxide)"], ["Color from", "Iron and titanium, by charge transfer"], ["Hardness", "9 on the Mohs scale"], ["Library name", "Sapphire, #0F52BA"]],
  body: [
    "Where ruby gets its red from chromium alone, classic blue sapphire needs two trace elements working as a pair: an electron hops between a nearby iron and titanium ion when blue-range light hits the crystal, absorbing it and leaving a cool blue behind. It takes only a few hundredths of a percent of iron and titanium together to color a stone, and more iron deepens the blue. Sapphire comes in every other color too — pink, yellow, green, violet, colorless — each from its own trace impurity; only the red member of the corundum family gets to call itself [[gm:gem:ruby|ruby]] instead.",
    "The word traveled oddly. Ancient \"sapphirus\" in Mediterranean texts most likely meant [[gm:gem:lapis-lazuli|lapis lazuli]], and only later did the name settle on blue corundum alone. The most prized orange-pink sapphire, padparadscha, takes its name from the Sinhalese for lotus color; a rarer purple sapphire was once sold as an \"Oriental amethyst.\" Pale stones have been heated to deepen their blue for centuries — a Portuguese visitor to Ceylon described the trick around the 1510s — by converting ferric iron to ferrous iron inside the crystal, and sellers have also rolled pale rough in blue carbor paper to fake color that vanishes the moment the stone is cut.",
    "Medieval bishops favored sapphire because its blue was read as heaven's color and thought to encourage pure thought; some modern bishops wear amethyst instead, said to evoke communion wine and costing far less. ColorHub's own [[Cobalt]], [[Royal blue]] and [[Azure]] sit near a fine sapphire's blue, though — as with any gem — no single swatch stands in for how much a real stone can vary."
  ],
  palette: [["#0F52BA", "Classic blue sapphire"], ["#0067A5", "Deep “Kashmir” blue"], ["#F4A6A0", "Padparadscha (orange-pink)"], ["#5C3A6E", "Purple, once sold as “Oriental amethyst”"]],
  colors: [],
  sources: ["Finlay, Jewels: A Secret History (2006), ch. 16", "GIA, 'Sapphire Description'", "Wikipedia, 'Sapphire'; 'Corundum'"]
},

{
  id: "emerald", title: "Emerald",
  dek: "Green beryl, coloured by a trace of chromium or vanadium — ColorHub's own gem color page has the fuller history.",
  facts: [["Mineral", "Beryl (beryllium aluminium silicate)"], ["Color from", "Chromium, sometimes vanadium"], ["Needs", "A rare tectonic meeting of beryllium and chromium"], ["Library name", "Emerald, #50C878"]],
  body: [
    "Emerald is beryl, the same mineral family as [[gm:gem:aquamarine|aquamarine]] and [[gm:gem:morganite|morganite]], turned green by a trace of chromium or (less often) vanadium standing in for aluminium. Beryllium and chromium rarely occur in the same rock, so a fine emerald needs an unusual geological coincidence — typically a collision zone where chromium-bearing rock meets a beryllium-rich fluid, which is why good emerald deposits are so few. Jewelers call the internal flaws that almost every natural emerald carries jardin, \"garden\"; most stones are routinely oiled to make them less visible.",
    "Colombia's Chivor and Muzo mines, opened in 1537 and 1567, produced larger, clearer, more saturated stones than Egypt's much older Eastern Desert mines, and \"emerald green\" today usually means that Colombian shade. A flux-grown synthetic emerald, the first to succeed, came from Carroll Chatham in 1935; earlier efforts (Verneuil's furnace process made synthetic ruby and sapphire from 1902) never managed emerald.",
    "ColorHub's full [[Emerald]] color page carries the rest of the story — Ptolemaic mines, the Emerald City, Pantone's 2013 Color of the Year, and the disputed Nero \"sunglasses\" tale — along with [[Jade]], [[Malachite]] and the other greens in its own family."
  ],
  palette: [["#50C878", "Common emerald green"], ["#046307", "Deep Colombian green"], ["#6C9C55", "Paler Egyptian green"]],
  colors: ["Emerald"],
  sources: ["Finlay, Jewels: A Secret History (2006), ch. 15", "Wikipedia, 'Emerald'", "Harrell, J. A. (2004). Archaeological geology of the world's first emerald mine. Geoscience Canada 31(2)"]
},

{
  id: "aquamarine", title: "Aquamarine",
  dek: "Pale sea-blue beryl, colored by iron instead of the chromium that makes its cousin emerald green.",
  facts: [["Mineral", "Beryl (beryllium aluminium silicate)"], ["Color from", "Iron (Fe²⁺ and Fe³⁺)"], ["Treatment", "Usually heated to remove a greenish tint"], ["Library name", "Aquamarine, #7FFFD4"]],
  body: [
    "Swap chromium for iron in beryl's crystal lattice and the green of [[gm:gem:emerald|emerald]] becomes the pale blue of aquamarine instead — two iron oxidation states, Fe²⁺ and Fe³⁺, pull the color toward blue and yellow-green respectively, and most rough crystals come out with some of both. Heating aquamarine gently drives off the yellow component and leaves a cleaner blue, a treatment so routine that an untreated stone is the unusual one.",
    "The name simply means \"seawater\" in Latin, and large, clean, relatively affordable crystals have made it one of the most widely cut beryls. Its pink beryl cousin, [[gm:gem:morganite|morganite]], shows what the same mineral looks like with manganese instead of iron doing the coloring. ColorHub's own [[Aqua]] and [[Powder blue]] sit near a pale aquamarine's range."
  ],
  palette: [["#7FFFD4", "Common aquamarine"], ["#5F9EA0", "Deeper sea-blue"], ["#C9F3EA", "Pale, lightly saturated stone"]],
  colors: [],
  sources: ["Finlay, Jewels: A Secret History (2006), ch. 15", "Wikipedia, 'Aquamarine (gem)'", "GIA, 'Aquamarine Description'"]
},

{
  id: "morganite", title: "Morganite",
  dek: "Pink beryl, found in 1911 and named for the banker J. P. Morgan rather than for its color.",
  facts: [["Mineral", "Beryl (beryllium aluminium silicate)"], ["Color from", "Manganese"], ["Named for", "J. P. Morgan, 1911"], ["Treatment", "Heat often deepens raw salmon to vivid pink"]],
  body: [
    "Morganite is beryl colored by manganese rather than the chromium of [[gm:gem:emerald|emerald]] or the iron of [[gm:gem:aquamarine|aquamarine]]. First found in Madagascar in 1911, it was named not for its color but for the financier J. P. Morgan, a patron of the American Museum of Natural History, by the mineralogist George Kunz. Raw crystals tend to be a pale salmon; heating most stones on the market deepens that into a more saturated raspberry pink.",
    "ColorHub's own [[Salmon]] and [[Raspberry]] roughly bracket morganite's range, from its pale natural color to its heated one."
  ],
  palette: [["#F4C2C2", "Raw, pale salmon"], ["#E8809A", "Heated raspberry pink"]],
  colors: [],
  sources: ["Finlay, Jewels: A Secret History (2006), ch. 15", "Wikipedia, 'Morganite'"]
},

{
  id: "amethyst", title: "Amethyst",
  dek: "Purple quartz, named by the Greeks for sobriety — ColorHub's own gem color page covers the full story.",
  facts: [["Mineral", "Quartz (silicon dioxide)"], ["Color from", "Iron color centers made by natural radiation"], ["Pairs with", "Citrine — the same mineral, a different oxidation state"], ["Library name", "Amethyst, #9966CC"]],
  body: [
    "Amethyst is ordinary quartz with a trace of iron that's been converted into a color center by natural background radiation over geological time; the iron sits at a specific oxidation state (often written Fe⁴⁺) that absorbs yellow-green light and lets violet and red through. Heat it past about 300–470°C and that color center breaks down, the iron shifts toward Fe³⁺, and the stone turns yellow or orange — which is exactly how most commercial [[gm:gem:citrine|citrine]] is made from amethyst or smoky quartz, rather than mined that color outright.",
    "ColorHub's full [[Amethyst]] color page carries the history — the Greek root meaning \"not drunk,\" the stone's old reputation for sobriety, and its modern use as a cheaper stand-in for a bishop's sapphire."
  ],
  palette: [["#9966CC", "Common amethyst"], ["#5D3A8C", "Deep Siberian/Uruguayan purple"], ["#C9A0DC", "Pale “Rose de France”"]],
  colors: ["Amethyst"],
  sources: ["Wikipedia, 'Amethyst'", "Finlay, Jewels: A Secret History (2006), ch. 16"]
},

{
  id: "citrine", title: "Citrine",
  dek: "Yellow-to-orange quartz, usually made by heating amethyst or smoky quartz rather than mined that color.",
  facts: [["Mineral", "Quartz (silicon dioxide)"], ["Color from", "Fe³⁺ iron"], ["Natural citrine", "Genuinely rare — most on the market is heat-treated"], ["Library name", "Citrine, #E4D00A"]],
  body: [
    "Citrine's yellow to brownish-orange comes from iron in the Fe³⁺ state, chemically distinct from the iron color center behind [[gm:gem:amethyst|amethyst]]'s purple. Natural citrine, formed that color underground, is genuinely uncommon; the great majority sold today is heat-treated amethyst or smoky quartz, whose color shifts to yellow once heating breaks down the purple color center. \"Madeira\" and \"orange citrine\" name its deeper, more saturated end.",
    "ColorHub's own [[Gold]], [[Mustard]] and [[Amber]] bracket citrine's range from pale lemon to deep sherry."
  ],
  palette: [["#E4D00A", "Common citrine"], ["#947629", "Deep “Madeira” citrine"], ["#FFF4B8", "Pale lemon quartz"]],
  colors: [],
  sources: ["Wikipedia, 'Citrine (quartz)'", "crystals.com, 'Natural Citrine vs Heat-Treated Amethyst'"]
},

{
  id: "garnet", title: "Garnet",
  dek: "Not one gem but a family of chemically related minerals, from blood-red pyrope to grass-green tsavorite.",
  facts: [["Mineral family", "Nesosilicates, formula X₃Y₂(SiO₄)₃"], ["Name from", "Latin granatum, “pomegranate,” for its red seed-like crystals"], ["Red varieties", "Pyrope, almandine, rhodolite, spessartine"], ["Green varieties", "Tsavorite, demantoid"]],
  body: [
    "\"Garnet\" covers an isomorphous series of minerals that share the same crystal structure but swap out which metal sits at the X site: magnesium gives pyrope (cherry red), iron gives almandine (a browner red), manganese gives spessartine (red-orange), and blends of these give rhodolite, a pinker \"raspberry\" red. A separate, calcium-bearing branch of the family can be colored green instead — tsavorite, a chromium-green garnet found in Kenya's Tsavo region in the 1960s, is brighter and tougher than [[Emerald|emerald]] and sells for a fraction of the price.",
    "Many historical \"rubies\" were actually pyrope garnet sold under a place name: \"Bohemian,\" \"Cape\" and \"Colorado\" ruby were all garnet trading on a better-known stone's reputation. ColorHub's own [[Oxblood]], [[Burgundy]] and [[Maroon]] sit in garnet's classic red range; its green varieties lean toward [[Kelly green]] and [[Hunter green]]."
  ],
  palette: [["#9B111E", "Pyrope (cherry red)"], ["#813932", "Almandine (brownish red)"], ["#C76D8E", "Rhodolite (raspberry)"], ["#00A693", "Tsavorite (chromium green)"]],
  colors: [],
  sources: ["Finlay, Jewels: A Secret History (2006), ch. 13, app.", "Wikipedia, 'Garnet'; 'Pyrope'; 'Spessartine'", "ganoksin.com, 'Nesosilicate — Garnet Group'"]
},

{
  id: "peridot", title: "Peridot",
  dek: "Olive-green olivine, always green because its iron is part of the mineral's own formula, not a trace impurity.",
  facts: [["Mineral", "Olivine, (Mg,Fe)₂SiO₄"], ["Color from", "Iron built into the chemical formula"], ["Old name", "“Evening emerald,” for how it glows at dusk"], ["Found on", "Earth, meteorites, and (spectroscopically) Mars"]],
  body: [
    "Most colored gems are colorless minerals tinted by a trace impurity. Peridot works differently: its iron is part of olivine's own formula, at least a tenth of the crystal's mass, so peridot is always some shade of green — there's no colorless or differently colored version of the same mineral. The Red Sea island the Egyptians called Zabargad (\"Topaz Island,\" confusingly) supplied peridot for millennia; its yellowish-green glow holds up better by lamplight than a bluer true [[Emerald|emerald]], which is why it was long sold as the \"evening emerald.\"",
    "Peridot crystals also turn up embedded in nickel-iron inside pallasite meteorites, and in 2003 spacecraft data showed vast stretches of Mars rich in olivine — the first gemstone identified on another planet, even if no one is mining it there. On Earth, about nine in ten gem-quality stones today come from the San Carlos Apache reservation in Arizona. ColorHub's own [[Lime]], [[Chartreuse]] and [[Pistachio]] sit near peridot's olive-green range."
  ],
  palette: [["#9ACD32", "Common peridot green"], ["#6B8E23", "Deeper olive"], ["#C3D186", "Pale “evening” glow"]],
  colors: [],
  sources: ["Finlay, Jewels: A Secret History (2006), ch. 14", "Wikipedia, 'Peridot'; 'Olivine'"]
},

{
  id: "topaz", title: "Topaz",
  dek: "A fluorine-bearing silicate whose color comes entirely from impurities and radiation damage, not its own formula.",
  facts: [["Mineral", "Topaz, an aluminium fluorosilicate"], ["Pink/red from", "Chromium"], ["Yellow/orange/blue from", "Irradiation color centers"], ["Blue on the market", "Almost always treated — natural blue topaz is rare"]],
  body: [
    "Pure topaz is colorless; every color it comes in is \"allochromatic,\" caused by something extra rather than by the mineral's own chemistry. Chromium substituting for aluminium gives natural pink, red and violet stones, including the orange-red \"imperial topaz\" prized since the 18th century. Yellow, brown and blue, by contrast, come from color centers — lattice defects created by natural irradiation, the same broad mechanism behind [[gm:essay:why-colored|several other gems' colors]].",
    "Almost all blue topaz sold today is irradiated and heated in a lab; genuinely natural blue topaz is rare enough that the trade treats it as the exception. Different radiation doses and heating steps give \"sky,\" \"Swiss\" and \"London\" blue, running from palest to deepest. ColorHub's own [[Marigold]] and [[Amber]] sit near imperial topaz's warm range; its treated blues run toward [[Sky blue]] and [[Cerulean]]."
  ],
  palette: [["#FFC87C", "Imperial/sherry topaz"], ["#D7A98C", "Natural pink"], ["#9FD3E8", "Treated “sky” blue"], ["#1F4E8C", "Treated “London” blue"]],
  colors: [],
  sources: ["GIA, 'Topaz Description'", "Wikipedia, 'Topaz'", "orau.org, 'Blue Topaz'"]
},

{
  id: "tourmaline", title: "Tourmaline",
  dek: "A chemically varied borosilicate that comes in almost every color, sometimes several at once in one crystal.",
  facts: [["Mineral family", "Complex borosilicates"], ["Color from", "Iron, manganese or (rarely) copper"], ["Watermelon tourmaline", "A pink core and green rim in one crystal"], ["Paraíba tourmaline", "Colored by copper — unique among tourmalines"]],
  body: [
    "Tourmaline's crystal structure can host an unusually wide range of metal ions, which is why the mineral comes in almost every color: iron tends toward blues and greens, manganese toward pinks and reds, and a crystal's chemistry can shift mid-growth, banding a single stone from a pink core to a green rim — \"watermelon\" tourmaline. Many tourmalines are also pleochroic, showing a different color depending on which way light passes through them (see [[gm:essay:color-change|color change and pleochroism]]).",
    "Paraíba tourmaline, found on one hill in Brazil's Paraíba state and later in parts of Africa, is colored by copper — an element that colors [[gm:gem:turquoise|turquoise]] but no other tourmaline — giving an electric \"swimming-pool\" blue-green that can sell for tens of thousands of dollars a carat. Dutch sailors, noticing how a warmed tourmaline crystal attracts ash and lint (a pyroelectric effect, not magic), nicknamed it the \"ash-attractor.\" ColorHub's own [[Teal]] and [[Raspberry]] sit near tourmaline's cooler and warmer ends."
  ],
  palette: [["#1B4D3E", "Verdelite (green)"], ["#C2185B", "Rubellite (pink-red)"], ["#00C2CB", "Paraíba (copper blue-green)"], ["#F2A0BE", "Watermelon's pink core"]],
  colors: [],
  sources: ["Finlay, Jewels: A Secret History (2006), app.", "GIA, 'Tourmaline Quality Factors'", "Wikipedia, 'Tourmaline'"]
},

{
  id: "spinel", title: "Spinel",
  dek: "A long-overlooked gem once sold as ruby — the famous “Black Prince's Ruby” in the Imperial State Crown is one.",
  facts: [["Mineral", "Spinel, MgAl₂O₄"], ["Color from", "Chromium (red) or other trace metals"], ["Famous stone", "The Black Prince's Ruby, 170 carats, Imperial State Crown"], ["Library name", "Spinel Red, #CC526B"]],
  body: [
    "Red spinel is colored by chromium, the same element that reddens [[gm:gem:ruby|ruby]], which is why the two were confused for most of history — spinel is still nicknamed gemology's \"great impostor.\" The uncut, irregular cabochon known as the Black Prince's Ruby, set at the front of Britain's Imperial State Crown, passed through Moorish and Spanish kings before the Black Prince received it in 1367; only in the 16th century did jewelers recognize it as spinel rather than true ruby.",
    "Blue spinel, colored by iron and other trace metals, was likewise long confused with sapphire, a mix-up gem writers compared to the difference between azurite and [[gm:gem:lapis-lazuli|ultramarine]] in old paintings — one leans toward sea-green, the other toward heaven's blue. Unlike dichroic ruby, spinel shows the same color from every angle, one of the few reliable ways historically to tell the two apart by eye."
  ],
  palette: [["#CC526B", "Red spinel"], ["#1F3D73", "Blue spinel"], ["#D9732C", "Flame-orange spinel"]],
  colors: [],
  sources: ["GIA, 'Spinel History and Lore'", "lotusgemology.com, 'The Black Prince's Ruby'", "Wikipedia, \"Black Prince's Ruby\""]
},

{
  id: "opal", title: "Opal",
  dek: "Not a crystal at all, but packed silica spheres that split white light into moving flashes of color.",
  facts: [["Mineral(oid)", "Hydrated silica, non-crystalline"], ["Color from", "Ordered silica spheres (play of color) or none at all (“potch”)"], ["Sphere size", "A few hundred nanometers — close to visible light's wavelength"], ["Famous stone", "The Hope Diamond's opposite number: black opal, first marketed from Lightning Ridge, Australia, c. 1902"]],
  body: [
    "Precious opal isn't a crystal; it's a mineraloid, microscopic spheres of silica stacked in a regular, close-packed lattice. When those spheres are evenly sized and ordered — roughly a few hundred nanometers across, in the same range as the wavelengths of visible light — the structure diffracts white light into pure spectral colors that shift as the stone turns: larger spheres give red flashes, smaller ones blue. Disordered spheres give plain, colorless \"potch,\" the miners' word for opal with no play of color at all. The mechanism is pure geometry, with no pigment involved — see [[gm:essay:play-of-color|play of color]] for the physics it shares with [[gm:gem:labradorite|labradorite]].",
    "The name likely comes from a Greek word for \"changing color.\" A 13th-century Holy Roman crown jewel, the Orphanus, was described as snow-white splashed with red like wine; Napoleon gave Josephine a red opal he called \"The Burning of Troy.\" Opal's reputation for bad luck seems to trace to a single novel — Walter Scott's Anne of Geierstein (1829), in which a baroness wearing an opal turns to ashes when touched by holy water — rather than to any older tradition; Victorians had prized the stone before that. Black opal, first sold commercially around 1902 from Lightning Ridge, Australia, was slow to catch on until a dealer championed it; fine stones now fetch vastly more than the earliest sales."
  ],
  palette: [["#F7EDF2", "Light/white opal base"], ["#1C1C1C", "Black opal base"], ["#FF4500", "Red play-of-color flash"], ["#2E8FE0", "Blue play-of-color flash"]],
  colors: [],
  sources: ["Finlay, Jewels: A Secret History (2006), ch. 13", "Wikipedia, 'Opal'", "mindat.org entries on precious opal structure"]
},

{
  id: "pearl", title: "Pearl",
  dek: "The only gem grown by a living animal, built in microscopic layers that bend light into its own soft glow.",
  facts: [["Source", "Nacre, secreted by a mollusk"], ["Built from", "Aragonite (calcium carbonate) and conchiolin (a protein)"], ["Color range", "White to champagne, pink, grey, black and rarely green"], ["Milestone", "First commercial cultured pearls, Mikimoto, 1893–1919"]],
  body: [
    "A pearl is nacre, the same iridescent lining that coats the inside of many mollusk shells, built up in alternating microscopic layers of aragonite crystal and a horn-like protein called conchiolin. Light bouncing between those layers interferes with itself the way it does in a soap bubble, producing \"orient,\" the shimmer that moves across a fine pearl as it turns — a structural effect, not a pigment, that pairs with a separate body color ranging from pure white through champagne, pink, grey and black to, rarely, green. A pearl left dry in a vault slowly yellows; worn against skin, it keeps its glow.",
    "Scottish and Irish river pearls, some the prized rose-pink of the River Oykel, were once exported across Europe; a Lapland pearler blamed the local peat for the color, since peat-free waters there tend to produce grey pearls instead. Commercial culturing, pioneered by Kokichi Mikimoto from the 1890s and a sensation in London by 1919, eventually displaced wild pearling almost entirely — commercial Tahitian black pearls, for instance, have only existed since the 1960s, and all of them are cultured."
  ],
  palette: [["#F7F1E6", "Classic white"], ["#F2C9A0", "Golden/champagne"], ["#E6C6C6", "Pink river pearl"], ["#33393D", "Black/Tahitian"]],
  colors: [],
  sources: ["Finlay, Jewels: A Secret History (2006), ch. 12", "Wikipedia, 'Pearl'", "Nature Scientific Reports, 'Structural colors of pearls' (2021)"]
},

{
  id: "coral", title: "Coral",
  dek: "A colonial animal's calcium-carbonate skeleton, colored by the same pigments that give its living polyps color.",
  facts: [["Source", "Skeleton of a colonial marine animal"], ["Material", "Calcium carbonate"], ["Color from", "Carotenoid pigments in the living tissue"], ["Status", "Many red and pink species are now protected; harvesting has collapsed historic beds"]],
  body: [
    "Precious coral is the hard calcium-carbonate skeleton a colony of tiny marine animals builds and leaves behind; its color comes from carotenoid pigments the living polyps carry, the same family of pigments that colors carrots and flamingos. Centuries of harvesting for jewelry hit the richest red and pink beds hard enough that many species are now protected, and the deep ox-blood reds once common in the trade are far rarer today.",
    "ColorHub's full [[Coral]] color page carries the fuller naming history — how Living Coral, like Mimosa and Marsala before it, borrowed a thing you could picture, the same instinct that named [[Salmon]] and [[Mustard]]."
  ],
  palette: [["#FF7F50", "Common coral"], ["#F88379", "Pink coral"], ["#7A0C0C", "Rare deep “ox-blood” red"]],
  colors: ["Coral"],
  sources: ["Wikipedia, 'Coral'; 'Precious coral'"]
},

{
  id: "jet", title: "Jet",
  dek: "Fossilized wood, polished glossy black — the material behind a Victorian mourning-jewelry boom.",
  facts: [["Material", "Fossilized wood (lignite), chiefly Araucaria-type conifers"], ["Age", "Around 170 million years"], ["Streak test", "Real jet leaves a chocolate-brown streak; imitations streak differently"], ["Boom", "Whitby, England, 1860s–70s, after Queen Victoria's mourning"]],
  body: [
    "Jet is fossilized wood, compressed and mineralized without oxygen over roughly 170 million years, most famously preserved in mudstone near Whitby on England's northeast coast. It can be told from its imitators by a simple streak test on rough porcelain: real jet leaves a chocolate-brown streak, where coal leaves black, glass leaves white, and vulcanite (a dyed, hardened rubber fake) leaves grey.",
    "Queen Victoria's public mourning after Prince Albert's death in 1861 drove a huge demand for Whitby jet jewelry through the 1860s and 70s; by the 1880s fashion (and the queen herself, by then wearing white pearls and diamonds again) had moved on, and cheap imitations — black glass (\"French jet\") and dyed vulcanite — undercut the real Whitby trade. Mourning colors vary by culture far beyond that: Armenians traditionally wore sky blue, hoping the dead were in heaven; Persians wore the pale brown of withered leaves; much of Asia wore white. Black jet beads were also worn against the evil eye in parts of Spain into the 1930s, and pilgrims still buy jet charms on Santiago de Compostela's Azabache (\"Jet\") Street."
  ],
  palette: [["#343434", "Rough jet"], ["#131516", "Polished jet"]],
  colors: [],
  sources: ["Finlay, Jewels: A Secret History (2006), ch. 11", "Wikipedia, 'Jet (lignite)'"]
},

{
  id: "lapis-lazuli", title: "Lapis lazuli",
  dek: "A blue rock, not a single mineral — and the gold-colored flecks in it are pyrite, not gold.",
  facts: [["Material", "A rock: mostly lazurite, with calcite and pyrite"], ["Color from", "A sulfur radical (S₃⁻) trapped in lazurite's crystal cage"], ["Myth", "The flecks are pyrite, not gold"], ["Library name", "Lapis Lazuli, #26619C"]],
  body: [
    "Lapis lazuli isn't one mineral but a rock — mostly blue lazurite, a member of the sodalite group, mixed with white calcite and, usually, scattered metallic flecks of pyrite. Those flecks are routinely mistaken for gold; they're iron pyrite, \"fool's gold,\" and the confusion is old enough to count as one of the stone's oldest myths. Lazurite's own blue comes from a trisulfur radical anion, S₃⁻, trapped inside its aluminosilicate cage: a single electronic transition in that ion absorbs strongly around 600 nanometers (orange-red light) and leaves a deep blue behind. A little of its sulfur relative S₂⁻ can pull the color toward yellow, and S₄⁻ toward red, which is part of why natural lapis varies so much in hue.",
    "For millennia the only major source was a single set of mines in the Badakhshan mountains of Afghanistan, which supplied both the carved stone itself and, ground and refined, the pigment [[ultramarine-pigment|ultramarine]] — ColorHub's page on that pigment carries the longer history, including how expensive it was and how [[Azure]] got its name from the Persian word for this same stone."
  ],
  palette: [["#26619C", "Classic Afghan lapis"], ["#1A3A5C", "Deep, less-flecked blue"], ["#8E8268", "Pyrite-flecked, lighter stone"]],
  colors: [],
  sources: ["Wikipedia, 'Lazurite'; 'Ultramarine'", "Gage, Colour and Culture (1993)", "mdpi.com, 'Spectroscopic and Crystal-Chemical Features of Sodalite-Group Minerals from Gem Lazurite Deposits' (2020)"]
},

{
  id: "turquoise", title: "Turquoise",
  dek: "A copper mineral whose sky-blue color turns greener as iron takes some of copper's place.",
  facts: [["Mineral", "Hydrous copper aluminium phosphate, CuAl₆(PO₄)₄(OH)₈·4H₂O"], ["Color from", "Copper (Cu²⁺)"], ["Greener stones", "Iron substituting for some aluminium"], ["Library name", "Turquoise, #40E0D0"]],
  body: [
    "Turquoise's sky-blue base color comes from copper ions (Cu²⁺) in its crystal structure; as iron substitutes for some of the aluminium alongside it, the color shifts from sky blue toward green or an earthy yellow-green. Egyptians mined turquoise in the Sinai from roughly the same era and the same general region they mined the copper mineral [[Malachite|malachite]], and the two still turn up together in old pieces.",
    "ColorHub's full [[Turquoise]] color page covers more of the naming and the stone's long history across Persian, Egyptian and American Southwest traditions."
  ],
  palette: [["#40E0D0", "Common turquoise"], ["#1CA9C9", "Persian/robin's-egg blue"], ["#6E8B74", "Greener, iron-rich stone"]],
  colors: ["Turquoise"],
  sources: ["Wikipedia, 'Turquoise'", "durangosilver.com, 'The Physical Properties of Turquoise'"]
},

{
  id: "jade", title: "Jade",
  dek: "Two unrelated minerals sharing one name — jadeite and nephrite — ColorHub's own color page covers the full history.",
  facts: [["Minerals", "Jadeite (a pyroxene) and nephrite (an amphibole) — unrelated, confused by name only"], ["Jadeite color from", "Chromium or iron"], ["Nephrite color from", "Mostly iron"], ["Library name", "Jade, #00A86B"]],
  body: [
    "\"Jade\" is really two different minerals that happen to look alike and were named as one stone until a French mineralogist, Alexis Damour, told them apart chemically in 1863. Jadeite, a sodium-aluminium pyroxene, can reach the intense, saturated \"imperial\" green that traces to chromium (or sometimes iron) and is the variety most prized in Chinese and Burmese jade carving; nephrite, a calcium-magnesium amphibole, colors mostly by iron and runs a duller, more muted green, along with white, yellow and brown.",
    "ColorHub's full [[Jade]] color page carries the rest — the stone's imperial Chinese status, its separate arrival in Mesoamerica, and the etymology (piedra de ijada, \"flank stone\") that also gave English the word nephrite."
  ],
  palette: [["#00A86B", "Jadeite (imperial green)"], ["#8FAE7C", "Nephrite (duller green)"], ["#C9A0DC", "Lavender jadeite"]],
  colors: ["Jade"],
  sources: ["Wikipedia, 'Jade'; 'Jadeite'", "Finlay, Jewels: A Secret History (2006), app."]
},

{
  id: "malachite", title: "Malachite",
  dek: "A banded copper mineral, the blue-green twin of azurite — ColorHub's gem color page covers its full history.",
  facts: [["Mineral", "Copper carbonate hydroxide, Cu₂CO₃(OH)₂"], ["Color from", "Copper"], ["Blue twin", "Azurite — the same copper, a different carbonate ratio"], ["Library name", "Malachite, #0BDA51"]],
  body: [
    "Malachite is a copper carbonate hydroxide, its banded green coming directly from copper in the mineral's own formula rather than a trace impurity. It sits chemically beside [[gm:gem:azurite|azurite]], a blue copper mineral with a different ratio of carbonate to hydroxide, and the two are often found together in the same deposits; over centuries, azurite can slowly weather into malachite.",
    "ColorHub's full [[Malachite]] color page and its [[malachite-pigment|malachite pigment]] page carry the rest — ancient Egyptian eye paint, the mineral's long run as a painter's green, and Russia's malachite-clad palace rooms."
  ],
  palette: [["#0BDA51", "Common malachite"], ["#355E3B", "Darker banded green"]],
  colors: ["Malachite"],
  sources: ["Wikipedia, 'Malachite'", "Finlay, Color: A Natural History of the Palette (2002)"]
},

{
  id: "azurite", title: "Azurite",
  dek: "A deep-blue copper mineral, malachite's chemical twin, long used as an artist's pigment before it fades to green.",
  facts: [["Mineral", "Copper carbonate hydroxide, Cu₃(CO₃)₂(OH)₂"], ["Color from", "Copper"], ["Green twin", "Malachite — azurite slowly weathers into it over time"], ["Library name", "Azurite Blue, #434D7B"]],
  body: [
    "Azurite is chemically close kin to [[gm:gem:malachite|malachite]] — both are copper carbonate hydroxides, differing only in the ratio of carbonate to hydroxide — and the two routinely occur together in the same copper deposits, azurite blue beside malachite green. Left exposed to air and moisture over long periods, azurite can slowly convert into malachite, which is why some old blue passages in medieval paintings have quietly turned green.",
    "As a pigment, azurite has been used by artists since Roman times; it's now comparatively rare as source rock has been mined out, and spinel traders once compared azurite's sea-toned blue to ultramarine's \"heaven\" blue as a way of telling look-alike blue stones apart."
  ],
  palette: [["#434D7B", "Classic azurite blue"], ["#1F2A4D", "Deep azurite"]],
  colors: [],
  sources: ["Wikipedia, 'Azurite'", "Finlay, Jewels: A Secret History (2006), app."]
},

{
  id: "cinnabar", title: "Cinnabar",
  dek: "Mercury sulfide, colored red by its own crystal structure rather than by any impurity — and toxic to handle.",
  facts: [["Mineral", "Mercury sulfide, HgS"], ["Color from", "Its own crystal structure (a semiconductor band gap)"], ["Pigment", "Ground into vermilion"], ["Caution", "Toxic; mercury-bearing"]],
  body: [
    "Cinnabar is mercury sulfide, and unlike most colored gems its red isn't a trace impurity riding along in a colorless host — the color comes from the band gap of the mineral's own crystal structure, which happens to absorb in a way that leaves red behind. Ground up, it's the source of the pigment vermilion; a synthetic version made the same chemical compound far more cheaply once chemists learned to produce it artificially, at a fraction of the natural mineral's cost.",
    "Ancient classifiers already ranked cinnabar among the \"brilliant\" colors, alongside [[gm:gem:azurite|azurite]]'s \"armenium blue\" and [[gm:gem:malachite|malachite]] green, against duller earths like ochre. The mineral and the pigment it yields are both toxic, since both carry mercury; ColorHub's own [[Vermilion]] and [[Carmine]] sit near its red."
  ],
  palette: [["#E34234", "Common cinnabar red"], ["#8B1A10", "Darker vermilion"]],
  colors: [],
  sources: ["Jarman, Chroma (2014)", "Wikipedia, 'Cinnabar'; 'Vermilion'"]
},

{
  id: "amber", title: "Amber",
  dek: "Fossilized tree resin, tens of millions of years old — ColorHub's gem color page covers the etymology and electricity.",
  facts: [["Material", "Fossilized conifer resin (not a mineral)"], ["Age", "Baltic amber: roughly 40 million years"], ["Myth", "Too young, almost everywhere, to hold dinosaur DNA"], ["Fake test", "Acetone leaves real amber unaffected; it softens copal or plastic"]],
  body: [
    "Amber is fossilized tree resin, not a mineral at all, and most commercial amber — Baltic amber runs roughly 40 million years old, Dominican amber 30–45 million — postdates the dinosaurs' extinction around 66 million years ago by tens of millions of years. Only rare, much older deposits, like Cretaceous-age Lebanese or Burmese amber (over 100 million years), could in principle hold an insect from the dinosaur era; the popular idea that ordinary amber preserves dinosaur DNA, as in Jurassic Park, doesn't hold up against that math, and no DNA has actually been recovered from amber of any age. To spot a fake: acetone leaves genuine amber unaffected but makes younger copal resin or plastic imitations tacky, and real amber smells faintly of pine when burned.",
    "ColorHub's full [[Amber]] color page has the rest — the Greek word elektron, sunlit in color and the root of \"electricity\" once rubbed amber was shown to attract lint, plus the Baltic amber trade's darker history of monopoly and punishment."
  ],
  palette: [["#FFBF00", "Common amber"], ["#C68E17", "Deeper “cognac” amber"], ["#F0EAD6", "Rare, cloudy white amber"], ["#4A4A4A", "Rare, oven-darkened “green/black” amber"]],
  colors: ["Amber"],
  sources: ["Finlay, Jewels: A Secret History (2006), ch. 10", "Wikipedia, 'Amber'", "St Clair, The Secret Lives of Colour (2016)"]
},

{
  id: "diamond", title: "Diamond and colored diamonds",
  dek: "Pure carbon, usually colorless — but nitrogen, boron, radiation and crystal defects can each tint it differently.",
  facts: [["Mineral", "Carbon, cubic crystal structure"], ["Yellow/brown from", "Nitrogen"], ["Blue from", "Boron (type IIb)"], ["Pink from", "Crystal distortion (“graining”), usually without any impurity at all"], ["Famous blue stone", "The Hope Diamond, type IIb, phosphoresces red under UV"]],
  body: [
    "Diamond is carbon, and in its purest form it's colorless; almost every tint a diamond can show traces to one specific cause. Nitrogen, the most common trace element, gives a yellow or brownish cast. Boron, far rarer, gives blue — the famous Hope Diamond is a type IIb stone, one of only about one in a thousand diamonds, meaning boron rather than nitrogen dominates its chemistry; it glows red under ultraviolet light for several seconds after the light is switched off, a property called phosphorescence. Irradiation, natural or artificial, can tint a stone green; high heat and pressure treatments can shift color further still.",
    "Pink and brown diamonds are the odd ones out: in the large majority of cases their color comes not from any trace element but from graining, a physical distortion in the crystal lattice formed under intense pressure deep underground, concentrated along thin parallel planes rather than spread evenly through the stone. The Hope Diamond itself began as a rough 110-carat stone Jean-Baptiste Tavernier sold to Louis XIV in the 1660s, cut down over the centuries to its current 45.5 carats; a contemporary reviewer once called its color \"indignant indigo.\" ColorHub's own [[Royal blue]] sits near its blue; [[Gold]] and [[Mustard]] near a classic \"Cape\" yellow diamond."
  ],
  palette: [["#F7F7FA", "Colorless (D)"], ["#F4E3A1", "Cape yellow (type Ia)"], ["#1F5FA8", "Fancy blue (type IIb, boron)"], ["#355E3B", "Fancy green (irradiated)"], ["#C98FA0", "Fancy pink (graining)"]],
  colors: [],
  sources: ["GIA, 'Why are Pink Diamonds Pink?'", "Wikipedia, 'Diamond color'; 'Diamond type'; 'Hope Diamond'", "Smithsonian, 'History of the Hope Diamond'", "Finlay, Jewels: A Secret History (2006), ch. 18"]
},

{
  id: "alexandrite", title: "Alexandrite",
  dek: "A chrysoberyl that looks green in daylight and red under lamplight, discovered in the Urals in 1830.",
  facts: [["Mineral", "Chrysoberyl, BeAl₂O₄"], ["Color-change from", "Chromium absorbing red-yellow and blue-green light almost equally"], ["Daylight", "Green to bluish-green"], ["Incandescent light", "Red to purplish-red"], ["Discovered", "Urals, 1830; named for the future Tsar Alexander II"]],
  body: [
    "Alexandrite is chrysoberyl colored by a trace of chromium, whose two absorption bands — one in yellow-green light, one in violet-blue — happen to be nearly balanced, so which color reaches the eye depends on which wavelengths dominate the light source rather than on the stone alone. Daylight and fluorescent light are rich in blue and green, which push the stone toward green or bluish-green; warmer incandescent and candlelight are rich in red and yellow, pushing the same crystal toward red or purplish-red. See [[gm:essay:color-change|color change and pleochroism]] for how this differs from a gem that simply looks different depending on the angle you view it from.",
    "First found in the Ural Mountains in 1830, it was named for the future Tsar Alexander II; red and green, the colors it switches between, happened also to be Imperial Russia's military colors, which the stone's discoverers took as a fitting coincidence."
  ],
  palette: [["#2E8B57", "Daylight green"], ["#A33A5D", "Incandescent red-purple"]],
  colors: [],
  sources: ["Finlay, Jewels: A Secret History (2006), app.", "compoundchem.com, 'The chemistry of colour-changing alexandrite'", "PMC, 'Explanation of the Colour Change in Alexandrites'"]
},

{
  id: "tanzanite", title: "Tanzanite",
  dek: "Violet-blue zoisite, found near Kilimanjaro in 1967 and named by Tiffany & Co. for the marketing.",
  facts: [["Mineral", "Zoisite, a calcium aluminium silicate"], ["Shows", "Trichroism — blue, violet and burgundy depending on viewing direction"], ["Almost always", "Heat-treated to remove a brownish “veil” and bring out the blue-violet"], ["Discovered", "Merelani, Tanzania, 1967"]],
  body: [
    "Tanzanite is the blue-violet variety of zoisite, discovered near Mount Kilimanjaro in Merelani, Tanzania, in 1967 — accounts differ on exactly who first picked up the crystals, naming both a Maasai herder and, in a later official account, a local gypsum miner. Rough zoisite from this deposit is typically a dull reddish-brown; nearly every tanzanite on the market has been heated to drive off that brown \"veil\" and bring out the saturated blue-violet the gem is known for. It's strongly trichroic — a single crystal shows blue, violet and a burgundy-red depending on which direction you look through it (see [[gm:essay:color-change|color change and pleochroism]]) — so how a stone is cut and oriented strongly affects which color dominates.",
    "Tiffany & Co. introduced the stone to the market in 1968 under the name \"tanzanite,\" judging \"blue-violet zoisite\" a harder sell. A persistent piece of film lore holds that James Cameron chose tanzanite for the fictional \"Heart of the Ocean\" in Titanic because blue diamond looked too dark and sapphire too dull; that account comes from a single source and should be read as film lore rather than a documented fact, not a claim about any real jewel."
  ],
  palette: [["#4B3B8C", "Cut, violet-blue"], ["#7A4B8C", "Violet facet"], ["#8B5E3C", "Rough, unheated stone"]],
  colors: [],
  sources: ["Wikipedia, 'Tanzanite'", "Smithsonian NMNH, 'Zoisite (var. tanzanite)'", "Finlay, Jewels: A Secret History (2006), ch. 16 (film-lore note, treated as disputed)"]
},

{
  id: "moonstone", title: "Moonstone",
  dek: "A feldspar whose light-blue sheen comes from scattering between paper-thin internal layers, not from any pigment.",
  facts: [["Mineral", "Alkali feldspar — intergrown orthoclase and albite"], ["Effect", "Adularescence"], ["Cause", "Light scattering between nanometer-thin feldspar layers"], ["Finest grade", "Colorless with a floating blue sheen"]],
  body: [
    "Moonstone is an intergrowth of two feldspar minerals, orthoclase and albite, that separate into thin, stacked, alternating layers as the crystal slowly cools after forming. Light entering the stone scatters where it crosses those layer boundaries, producing a soft, moving sheen called adularescence rather than any fixed body color — the same broad family of effect as [[gm:gem:labradorite|labradorite]]'s flashier version, covered together in [[gm:essay:play-of-color|play of color]]. Layers in the range of roughly 60–150 nanometers scatter mostly shorter wavelengths, giving the prized blue \"floating\" sheen; thicker layers scatter more broadly and give a plainer white glow.",
    "The rarest, most valued moonstones are nearly colorless with that blue sheen seeming to hover just above the surface, moving as the stone turns — often described as light floating on water."
  ],
  palette: [["#EAF2FA", "Blue-sheen moonstone"], ["#E8E4D8", "Classic white/grey"], ["#D8C9A3", "Peach/champagne"]],
  colors: [],
  sources: ["Wikipedia, 'Moonstone (gemstone)'; 'Adularescence'", "gemmology.dev, 'Adularescence'"]
},

{
  id: "labradorite", title: "Labradorite",
  dek: "A feldspar that flashes blue, gold or violet as it turns — the same optics as a soap bubble, at crystal scale.",
  facts: [["Mineral", "Plagioclase feldspar"], ["Effect", "Labradorescence"], ["Cause", "Thin-film interference off nanometer-scale internal layers"], ["Layer spacing", "Roughly 128–252 nanometers — thinner gives blue, thicker gives gold/red"]],
  body: [
    "As labradorite cools slowly underground, its feldspar structure separates into alternating sodium-rich and calcium-rich layers only around 128 to 252 nanometers apart — thin enough that light reflecting off the boundaries between them interferes with itself, amplifying one wavelength and canceling others, exactly the physics that colors a soap bubble or an oil slick (thin-film interference). Thinner layers amplify blue; thicker ones shift the flash toward gold, orange and red. Because the layers all run roughly parallel to one direction in the crystal, the effect — called labradorescence — is locked to that orientation: turn the stone and the flash appears, vanishes and reappears as the angle changes.",
    "See [[gm:essay:play-of-color|play of color]] for how this compares to [[gm:gem:opal|opal]]'s different structural-color mechanism and [[gm:gem:moonstone|moonstone]]'s milder version of the same layered-feldspar effect. ColorHub's own [[Steel blue]] and [[Petrol]] sit near labradorite's blue flash."
  ],
  palette: [["#1C3A52", "Base grey-blue"], ["#2F7BA6", "Blue flash"], ["#C99A3E", "Gold/copper flash"], ["#7B3F61", "Violet flash"]],
  colors: [],
  sources: ["Wikipedia, 'Labradorite'", "mindat.org, 'Labradorite'", "mooniquecreation.com, 'Lamellar Structures in Labradorite and Moonstone'"]
},

{
  id: "rose-quartz", title: "Rose quartz",
  dek: "Pale pink quartz whose color cause is still debated — a trace element in some stones, microscopic fibers in others.",
  facts: [["Mineral", "Quartz (silicon dioxide)"], ["Color from", "Titanium/iron charge transfer in some stones; microscopic dumortierite fibers in others"], ["Star effect", "Oriented rutile needles can produce asterism"], ["Status", "A genuinely debated case among gem color mechanisms"]],
  body: [
    "Rose quartz's gentle pink doesn't have one settled explanation. Some specimens owe their color to a charge-transfer effect between titanium and iron, similar in spirit to the mechanism behind blue sapphire's color. More recent research has found that in many other specimens, the color actually comes from countless microscopic fibers of dumortierite, a separate borosilicate mineral, embedded throughout the quartz and scattering light to produce a soft, milky pink rather than a true dissolved-impurity color.",
    "Some rose quartz also contains fine, oriented needles of rutile (titanium dioxide, sometimes called \"Venus hair\" or \"cupid's darts\"); cut as a cabochor, these can throw a six-rayed star across the surface, an effect called asterism and unrelated to the stone's pink color itself. ColorHub's own [[Baby pink]] and [[Peach]] sit near rose quartz's gentle range."
  ],
  palette: [["#F7CAC9", "Pale rose quartz"], ["#E0A6AD", "Deeper dusty pink"]],
  colors: [],
  sources: ["geologypage.com, 'Rose Quartz: The Pink Gemstone'", "Wikipedia, 'Rose quartz'"]
}

],

essays: [

{
  id: "why-colored", title: "Why gems are colored",
  dek: "Most colored gems are, chemically, a colorless mineral with something else mixed in — a few parts per million of a different element, or a flaw left by old radiation.",
  body: [
    "Gemologists sort color causes into a few broad families. The simplest is idiochromatic color: the coloring element is part of the mineral's own chemical formula, so every clean crystal of it comes out that color. [[gm:gem:peridot|Peridot]]'s iron, [[gm:gem:malachite|malachite]] and [[gm:gem:azurite|azurite]]'s copper, and [[gm:gem:turquoise|turquoise]]'s copper all work this way — there's no colorless version of the same mineral waiting underneath.",
    "Far more gems are allochromatic: the host mineral is colorless on its own, and color comes from a trace impurity, often well under one percent, substituting for one of the mineral's own atoms. Chromium does this across several unrelated minerals at once — red in [[gm:gem:ruby|ruby]] (corundum), green in [[gm:gem:emerald|emerald]] (beryl), color-change in [[gm:gem:alexandrite|alexandrite]] (chrysoberyl) — while in other gems the color comes from two different impurities working together through charge transfer, an electron hopping between neighboring ions each time the right wavelength of light arrives. Blue [[gm:gem:sapphire|sapphire]]'s iron-and-titanium pair and some rose quartz's titanium-and-iron pair both work this way.",
    "A third family needs no impurity at all: natural (or artificial) irradiation over long stretches of time can knock an electron out of place, leaving a \"color center\" — a lattice defect that absorbs light on its own. This is how most [[gm:gem:amethyst|amethyst]] gets its purple, how [[gm:gem:topaz|topaz]]'s yellows and browns and most of its blues form, and how a diamond can turn pink or brown not from any added element but from physical distortion (\"graining\") in its crystal lattice under the immense pressure where it formed — see [[gm:gem:diamond|diamond]] for how that plays out across a whole range of fancy colors."
  ],
  colors: [],
  sources: ["GIA educational materials on gemstone color causes", "Wikipedia, 'Causes of color'", "Finlay, Jewels: A Secret History (2006), various chapters"]
},

{
  id: "play-of-color", title: "Play of color",
  dek: "Some gems have no pigment at all — their color is pure geometry, light splitting apart as it passes through a structure built at almost exactly its own wavelength.",
  body: [
    "A handful of gems get their color from structure rather than chemistry — the same broad phenomenon that makes a soap bubble, a butterfly wing or an oil slick flash with color even though none of them contain any colored pigment. [[gm:gem:opal|Opal]]'s precious varieties are microscopic silica spheres stacked in a regular lattice, close enough in size to the wavelengths of visible light that the structure diffracts white light into pure spectral colors; sphere size sets the color, larger spheres giving red and smaller ones blue.",
    "[[gm:gem:labradorite|Labradorite]] and [[gm:gem:moonstone|moonstone]] work by a related but distinct mechanism, thin-film interference: both are feldspars that separate into nanometer-thin alternating layers as they cool, and light reflecting between those layers reinforces one wavelength and cancels others, exactly as it does in a soap film. Thinner layers favor blue, thicker ones favor gold and red — labradorite's dramatic, angle-locked \"labradorescence\" and moonstone's softer, more diffuse \"adularescence\" are really the same optics at two different layer thicknesses and two different scales of order.",
    "[[gm:gem:pearl|Pearl]]'s shimmer, or \"orient,\" belongs to the same family again: nacre's alternating microscopic layers of aragonite and protein interfere with light the same way, layered over a separate body color that comes from the mollusk itself rather than from the structure. In every one of these gems, turning the stone changes what you see — not because the material itself has changed, but because the angle between your eye, the light and the structure has."
  ],
  colors: [],
  sources: ["Wikipedia, 'Structural coloration'; 'Opal'; 'Labradorite'; 'Adularescence'", "Finlay, Jewels: A Secret History (2006), ch. 13"]
},

{
  id: "color-change", title: "Color change and pleochroism",
  dek: "Two different ways a single gem can show more than one color — one depends on the light it's under, the other on the angle you look through it.",
  body: [
    "It's easy to conflate two distinct effects that both make a gem seem to \"change color,\" but they work differently. Color change, as in [[gm:gem:alexandrite|alexandrite]], depends on the light source: the gem's chromium absorbs two separate bands of the spectrum almost equally, so which color reaches your eye depends on which wavelengths dominate whatever is lighting it — green or bluish-green in daylight's blue-rich light, red or purplish-red under incandescent light's warmer glow. Move the same stone to a different light and it changes; the stone itself, and your angle of view, don't matter.",
    "Pleochroism is a different phenomenon entirely: a single crystal absorbs light differently depending on which direction it passes through the crystal's own structure, so the gem shows two or three distinct colors depending on the angle you view it from, under one constant light source. [[gm:gem:tanzanite|Tanzanite]] is strongly trichroic, showing blue, violet and a burgundy-red from three different directions through the same stone, which is why cutters orient the rough carefully to favor the blue-violet the market wants. [[gm:gem:tourmaline|Tourmaline]] and [[gm:gem:ruby|ruby]] are both pleochroic too — a ruby looks crimson-pink along one axis and more orange across another, which is part of why the same rough crystal can be cut to favor either tone.",
    "A gem can in principle show both effects at once, but they're independent: color change is about the light source, pleochroism is about the viewing direction, and only one of them — color change — would look any different if you simply swapped the light bulb overhead."
  ],
  colors: [],
  sources: ["Wikipedia, 'Pleochroism'; 'Alexandrite effect'", "PMC, 'Explanation of the Colour Change in Alexandrites'", "Wikipedia, 'Tanzanite'"]
}

]

};
