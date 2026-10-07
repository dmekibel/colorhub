// ColorHub wiki: one page per color (the 11 basics + the 90 unit colors in data/colors.js).
// Schema and gate: node tools/check_wiki.js
// named = what the name comes from. facets = the strongest true angles, with [[links]].
// related = non-obvious links to other colors (shared material, story, tradition, rival).
// Every specific claim was checked against the sources listed with the entry.
window.WIKI_COLORS = {

// ───────────── Basics ─────────────

"Red": {
  named: "abstract",
  since: { year: -100000, what: "Red ochre paint made at Blombos Cave, South Africa", approx: true },
  facets: [
    { k: "history", text: "The oldest paint workshop on Earth made red. About 100,000 years ago, people at Blombos Cave in South Africa ground red [[Ochre|ochre]], mixed it with bone and charcoal, and stored the paste in abalone shells. Later reds raised the stakes: [[vermilion-pigment|vermilion]] from mercury ore, and dyes from crushed insects, [[kermes]] and [[cochineal]]." },
    { k: "language", text: "Red is one of the oldest color words we have. English red, Latin ruber and Greek erythros grow from one ancient root. [[berlin-and-kay|Berlin and Kay]] found that a language with only three [[basic-color-terms|color words]] almost always has black, white and red. Medieval scribes wrote headings in red ink, so a heading became a rubric, from rubrica, red earth." },
    { k: "symbolism", text: "In [[alchemy]], red is the finish line. The Great Work ran from [[Black|black]] to [[White|white]] to [[Yellow|yellow]] and ended in rubedo, the reddening that meant the philosopher's stone was done. [[heraldry|Heraldry]] calls red gules. The Catholic Church wears red at Pentecost and on martyrs' feasts ([[liturgical-colors]]). In China, red means weddings and luck, and New Year money comes in red envelopes." },
    { k: "science", text: "Red is the long-wave end of the [[spectrum]], light of roughly 620 to 750 nanometers. A famous 2005 study found Olympic fighters in red won more bouts. A 2024 meta-analysis of over 6,500 bouts, co-written by the same researchers, found red won just 50.5%: no reliable red advantage. See [[color-psychology]]." }
  ],
  related: [
    { to: "Ochre", why: "Red ochre was humanity's first red, ground 100,000 years ago" },
    { to: "Crimson", why: "Named for kermes, the insect behind Europe's finest medieval reds" },
    { to: "Vermilion", why: "The mercury-ore red of the old masters" },
    { to: "Black", why: "Alchemy's Great Work begins in black and ends in red" },
    { to: "Green", why: "Its opposite on the painter's wheel, and on every traffic light" }
  ],
  sources: [
    "Henshilwood et al., 'A 100,000-year-old ochre-processing workshop at Blombos Cave', Science 334 (2011)",
    "Berlin & Kay, Basic Color Terms (1969); Etymonline, 'red', 'rubric'",
    "Hill & Barton, 'Red enhances human performance in contests', Nature 435: 293 (2005)",
    "Peperkoorn, Hill, Barton & Pollet, 'Meta-analysis of the red advantage in combat sports', Scientific Reports 14: 30822 (2024)",
    "Britannica, 'Alchemy'; 'Tincture (heraldry)'"
  ]
},

"Orange": {
  named: "fruit",
  since: { year: 1502, what: "First use of orange as a color word in English", approx: false },
  facets: [
    { k: "language", text: "The fruit came first. Its name traveled from Sanskrit naranga through Persian and Arabic into French, losing its first n on the way. Before oranges reached England, people said geoluread, yellow-red, which is one reason a robin's breast and a fox's coat are still called red. The first record of orange as a color in English is from 1502, for clothes bought for Margaret Tudor." },
    { k: "art", text: "In [[painting-impression-sunrise|Impression, Sunrise]], [[monet|Monet]]'s orange sun is no brighter than the grey sky around it. Neuroscientist Margaret Livingstone showed that in a black-and-white photo the sun all but vanishes. Your color vision sees it blaze while your brightness vision barely registers it, so it seems to shimmer. Orange against blue-grey is the [[complementary-colors|complementary]] pair at work." },
    { k: "culture", text: "The Dutch royal House of Orange took its name from a town in southern France, not the fruit. The story that Dutch growers bred orange carrots to honor William of Orange has no documents behind it, and orange carrots seem to predate him. Orange did become the Dutch national color, and fans still flood stadiums with it." },
    { k: "design", text: "The Golden Gate Bridge is painted International Orange. The US Navy wanted black and yellow stripes so ships could see it in fog. Consulting architect Irving Morrow fell for the red-orange primer on the steel and argued for it: warm against the hills, and still visible in the mist. See [[warm-and-cool]]." }
  ],
  related: [
    { to: "Blue", why: "Its complementary opposite, the pair behind Monet's Impression, Sunrise" },
    { to: "Brown", why: "Brown is dark orange, seen against brighter surroundings" },
    { to: "Red", why: "Before the 1500s, English called orange things red or yellow-red" },
    { to: "Tangerine", why: "Another color named after a citrus fruit, this one via Tangier" },
    { to: "Marigold", why: "The orange flower of Mexico's Day of the Dead" }
  ],
  sources: [
    "Wikipedia, 'Orange (colour)' and 'Orange (word)', citing the OED for 1502",
    "Livingstone, Vision and Art (2002); Harvard Magazine, 'The Neurobiology of Art' (2003)",
    "Live Science, 'Are carrots orange because of a Dutch revolutionary?'",
    "NPR, 'The Golden Gate Bridge's accidental color' (2011)"
  ]
},

"Yellow": {
  named: "abstract",
  since: { year: -15000, what: "Yellow ochre painted on the walls of Lascaux", approx: true },
  facets: [
    { k: "language", text: "Yellow and [[Gold|gold]] come from the same ancient root, *ghel-, to shine. Gleam and glow belong to the family too. To the first speakers, yellow simply was the shining color." },
    { k: "history", text: "Yellow [[Ochre|ochre]] glows on the cave walls of Lascaux. Egyptians painted with orpiment, a gorgeous, poisonous arsenic yellow. In the 1800s [[chrome-yellow|chrome yellow]] arrived, and [[van-gogh|Van Gogh]] loaded his [[painting-sunflowers|Sunflowers]] with it. Scientists studying the Amsterdam version found its paler, sulfate-rich chrome yellow slowly darkening toward brown under light." },
    { k: "culture", text: "In Qing China, bright yellow was reserved for the emperor, the empress and the empress dowager. Ordinary people could not wear it; the crown prince wore apricot yellow and other princes a golden yellow. Yellow was the color of earth, the center of the five elements, and so of the ruler at the center of the world." },
    { k: "symbolism", text: "[[alchemy|Alchemy]] named a yellowing stage, citrinitas, between the white and the final red. [[heraldry|Heraldry]] treats yellow as gold and calls it or." },
    { k: "philosophy", text: "[[goethe|Goethe]] called yellow 'the colour nearest the light' in his [[theory-of-colours|Theory of Colours]]. He set it against [[Blue|blue]], the color that brings darkness with it, and built his whole system on that pair, pushing back against [[isaac-newton|Newton]]." }
  ],
  related: [
    { to: "Blue", why: "Goethe's polar pair: yellow nearest light, blue nearest darkness" },
    { to: "Gold", why: "Same ancient root, *ghel-, to shine" },
    { to: "Purple", why: "Imperial yellow in Qing China, imperial purple in Rome" },
    { to: "Ochre", why: "Yellow ochre was the cave painters' yellow" },
    { to: "Red", why: "Alchemy's last two stages: yellowing, then reddening" }
  ],
  sources: [
    "Etymonline, 'yellow', 'gold'",
    "Monico et al., 'Evidence for degradation of the chrome yellows in Van Gogh's Sunflowers', Angewandte Chemie International Edition 54(47) (2015)",
    "Goethe, Theory of Colours (1810), trans. Eastlake (1840), §765",
    "South China Morning Post, 'What was the Qing dynasty's imperial yellow jacket'"
  ]
},

"Green": {
  named: "abstract",
  facets: [
    { k: "language", text: "Green, grow and grass come from one root meaning to grow. The word is a picture of living plants. Some languages use a single word for green and [[Blue|blue]]: Vietnamese xanh covers both, and linguists nickname such words grue. See [[basic-color-terms]]." },
    { k: "history", text: "Green was a painter's headache. Copper greens like [[verdigris]] could brown with age. In 1775 Carl Scheele made a cheap, brilliant copper arsenite green, and Victorian homes were papered in poison ([[arsenic-greens]]). The tale that green wallpaper killed Napoleon is unproven: his hair held arsenic and his St Helena wallpaper did too, but most historians blame stomach cancer." },
    { k: "science", text: "Your eyes are most sensitive to yellow-green. In daylight, light near 555 nanometers looks brighter than any other wavelength of the same strength. See [[trichromacy]]." },
    { k: "philosophy", text: "[[goethe|Goethe]] saw green as the point where [[Yellow|yellow]] and [[Blue|blue]] balance. On it, he wrote, 'the eye and the mind repose', which made green his pick for rooms you live in ([[theory-of-colours]])." },
    { k: "culture", text: "The Quran dresses the people of paradise in green silk, and green became Islam's color, found on many Muslim flags. Catholic priests wear green through Ordinary Time, the long stretches between feasts ([[liturgical-colors]]). [[heraldry|Heraldry]] calls it vert." },
    { k: "art", text: "The woman in van Eyck's [[painting-arnolfini|Arnolfini Portrait]] wears a deep green gown, fur-lined, its heavy folds pooling on the floor: a show of costly cloth in a room full of luxuries." }
  ],
  related: [
    { to: "Red", why: "Complementary opposites, and the stop and go of every traffic light" },
    { to: "Blue", why: "Many languages use one word for both, the 'grue' words" },
    { to: "Emerald", why: "Emerald green paint of 1814 was laced with arsenic" },
    { to: "Grey", why: "Goethe's Faust: grey is theory, green the golden tree of life" },
    { to: "Malachite", why: "One of the oldest green pigments, a ground copper mineral" }
  ],
  sources: [
    "Etymonline, 'green', 'grow', 'grass'",
    "Jones & Ledingham, 'Arsenic in Napoleon's wallpaper', Nature (1982); BMJ/PMC, 'Channelling the Emperor: what really killed Napoleon?'",
    "Goethe, Theory of Colours, trans. Eastlake (1840)",
    "CIE photopic luminosity function (peak 555 nm)"
  ]
},

"Blue": {
  named: "abstract",
  since: { year: -3250, what: "Egyptian blue, the first synthetic pigment", approx: true },
  facets: [
    { k: "language", text: "[[homer|Homer]] never calls the sea blue. He calls it wine-dark. In 1858 William Gladstone noticed that blue is missing from Homer altogether, and some readers decided the Greeks couldn't see it. They could. They lacked a basic word for it, as many languages once did. Russian today splits light blue (goluboy) from dark blue (siniy), and its speakers tell those blues apart a little faster. See [[linguistic-relativity]]." },
    { k: "history", text: "Blue was the first color people learned to manufacture. [[egyptian-blue|Egyptian blue]], a fired copper silicate, dates to about 3250 BCE, the oldest known synthetic pigment. Then came [[ultramarine-pigment|ultramarine]], ground from Afghan lapis lazuli and priced like gold, and in about 1706 [[prussian-blue|Prussian blue]], a lucky accident in a Berlin color-maker's shop." },
    { k: "symbolism", text: "Blue was a minor color in early medieval Europe. In the 12th century painters began dressing the Virgin Mary in a blue mantle, and the color climbed: into stained glass, onto royal coats of arms, all the way to Europe's favorite color. The historian Michel Pastoureau traced that rise. See [[heraldry]]." },
    { k: "art", text: "[[vermeer|Vermeer]] painted the turban of [[painting-pearl-earring|Girl with a Pearl Earring]] in costly natural ultramarine, and even mixed it into the shadows of her yellow jacket. Hokusai's [[painting-great-wave|Great Wave]] curls in Prussian blue, newly imported to Japan. And [[yves-klein|Yves Klein]] made one ultramarine so much his own that it carries his name." },
    { k: "science", text: "The sky is blue because air scatters short blue waves far more than long red ones. Blue is rare in living things: the blue morpho butterfly and the blue jay have no blue pigment at all. Their blue comes from microscopic structures that sort light." }
  ],
  related: [
    { to: "Yellow", why: "Goethe's polar pair: blue nearest darkness, yellow nearest light" },
    { to: "Orange", why: "Complementary opposites; Monet set them side by side at Le Havre" },
    { to: "Azure", why: "Named for lapis lazuli, the stone behind ultramarine" },
    { to: "Indigo", why: "The plant dye behind the world's blue cloth, from uniforms to jeans" },
    { to: "Pink", why: "The two swapped places as boys' and girls' colors in the 1900s" }
  ],
  sources: [
    "Gladstone, Studies on Homer and the Homeric Age (1858); Winawer et al., PNAS 104 (2007)",
    "Harvard Gazette, 'When Egyptians made blue' (2026); Wikipedia, 'Egyptian blue' (Hierakonpolis bowl, c. 3250 BCE)",
    "Pastoureau, Blue: The History of a Color (2001)",
    "Kremer Pigmente / UPenn Architectural Conservation Lab, 'Prussian blue'"
  ]
},

"Purple": {
  named: "dye",
  facets: [
    { k: "history", text: "Purple was the color of snail slime and emperors. [[tyrian-purple|Tyrian purple]] came from murex sea snails. In 1909 the chemist Paul Friedländer crushed 12,000 of them to get 1.4 grams of pure dye. Diocletian's price edict of 301 CE capped a pound of purple silk at 150,000 denarii, the same price it set for a lion. See [[royal-purple]]." },
    { k: "language", text: "Purple is named after a shellfish. Latin purpura and Greek porphyra meant both the murex snail and its dye. Byzantine children born to a reigning emperor were called porphyrogennetos, born in the purple, after the palace chamber where empresses gave birth." },
    { k: "science", text: "Purple is a color your brain makes up. No single wavelength looks purple; you see it when red and blue light arrive together. [[Violet]], at the short end of the [[spectrum]], is a real rainbow color, so purple and violet are not quite the same thing. See [[extra-spectral]]." },
    { k: "symbolism", text: "Purple is the Church's color of waiting and penance, worn in Advent and Lent ([[liturgical-colors]]). In 1856, 18-year-old [[william-perkin|William Perkin]], trying to make quinine, made [[mauveine]] instead: the first synthetic dye, and the end of purple as a privilege." }
  ],
  related: [
    { to: "Indigo", why: "Tyrian purple is indigo's molecule with two bromine atoms added" },
    { to: "Byzantium", why: "Named for the empire that made purple its imperial monopoly" },
    { to: "Mauve", why: "The first synthetic dye made purple cheap in 1856" },
    { to: "Violet", why: "The rainbow's real end; purple has no wavelength of its own" },
    { to: "Yellow", why: "Imperial purple in Rome, imperial yellow in Qing China" }
  ],
  sources: [
    "Friedländer (1909), via Wikipedia, 'Tyrian purple' (6,6'-dibromoindigo)",
    "Edict on Maximum Prices (301 CE), trans. Kropff, University of Bergen",
    "Garfield, Mauve (2000); Royal Society of Chemistry, 'William Perkin'"
  ]
},

"Pink": {
  named: "flower",
  since: { year: 1680, what: "Pink first used as a color name in English", approx: true },
  facets: [
    { k: "language", text: "Pink is named after a flower. Garden pinks (Dianthus) have frilly petal edges, as if trimmed with pinking shears, and the flower's name came first. Pink as a color word shows up in the 1600s." },
    { k: "culture", text: "Pink for girls is younger than you think. A 1918 trade magazine, Earnshaw's Infants' Department, called pink the stronger color and so right for boys, with dainty blue for girls. Other sources said the opposite, and stores disagreed for decades. Historian Jo Paoletti shows the girls-in-pink rule only hardened in the mid-1900s. See [[pink-and-blue]]." },
    { k: "design", text: "In 1937 Elsa Schiaparelli launched a perfume called Shocking and a loud pink to match, shocking pink. Barbie's pink is a Pantone shade, 219 C. And in 2016 the artist Stuart Semple sold the 'pinkest pink' to everyone except Anish Kapoor, in protest at Kapoor's exclusive rights to [[vantablack|Vantablack]]." },
    { k: "science", text: "In 1979 Alexander Schauss claimed a bubblegum shade, Baker-Miller pink, calmed aggressive prisoners, and jails painted cells to match. Later, tighter studies by other researchers did not find the effect. See [[color-psychology]]." },
    { k: "art", text: "In Fragonard's [[painting-the-swing|The Swing]], a woman in a froth of pink silk kicks her slipper into the air over a hidden admirer. The dress is the brightest thing in a dim, green garden." }
  ],
  related: [
    { to: "Blue", why: "Its partner in the boys-and-girls rule, which once ran the other way" },
    { to: "Hot pink", why: "Schiaparelli's shocking pink of 1937 set the loud end of pink" },
    { to: "Baby pink", why: "The nursery pink of the mid-century gender rule" },
    { to: "Black", why: "The Vantablack feud produced the 'pinkest pink'" },
    { to: "Red", why: "Pink is red lightened with white" }
  ],
  sources: [
    "Wikipedia, 'Pink' (color sense from the 17th century, after the Dianthus flower)",
    "Paoletti, Pink and Blue: Telling the Boys from the Girls in America (2012); Smithsonian Magazine, 'When did girls start wearing pink?' (2011)",
    "Schiaparelli, official site, 'Shocking perfume bottle'; V&A, 'Elsa Schiaparelli: a timeline'",
    "Genschow et al., 'Does Baker-Miller pink reduce aggression in prison detention cells?' (2015)"
  ]
},

"Brown": {
  named: "abstract",
  facets: [
    { k: "language", text: "Bear may simply mean 'the brown one'. Many linguists think early Germanic speakers avoided the animal's real name out of fear and called it by its color instead; Greek arktos and Latin ursus kept the old name. Brown itself comes from a root meaning bright or brown." },
    { k: "science", text: "Brown isn't in the rainbow. It's dark orange or yellow seen next to brighter things. Light a brown object alone in a dark room and it can look orange. Your brain decides what brown is from the surroundings. See [[color-constancy]] and [[spectrum]]." },
    { k: "history", text: "Painters once used a brown made of people. [[mummy-brown|Mummy brown]] was ground from Egyptian mummies. The painter Edward Burne-Jones, learning the truth, gave his tube a funeral in his garden. The London colormen C. Roberson said their last batch came in 1964, when they ran out of mummies. Most browns are safer [[earth-pigments]]." },
    { k: "design", text: "In 2012 researchers asked 1,000 Australian smokers to pick the least appealing color for cigarette packs. They chose Pantone 448 C, a drab dark brown, now required on every pack. UPS went the other way and built a brand on its brown, which it calls Pullman brown. See [[color-trademarks]]." }
  ],
  related: [
    { to: "Orange", why: "Brown is dark orange, seen against brighter surroundings" },
    { to: "Olive", why: "Australia first called its ugly pack color olive, until olive growers objected" },
    { to: "Umber", why: "The earth pigment behind painters' deepest natural browns" },
    { to: "Sepia", why: "Brown ink from cuttlefish, and the tone of old photographs" }
  ],
  sources: [
    "Etymonline, 'brown', 'bear'",
    "Smithsonian Magazine, 'Ground-up mummies were once an ingredient in paint'; Journal of Art in Society, 'The life and death of mummy brown'",
    "Wikipedia, 'Pantone 448 C' (GfK Bluemoon research, 2012)"
  ]
},

"Grey": {
  named: "abstract",
  facets: [
    { k: "language", text: "Grey or gray? Both. Britain mostly writes grey and America gray, and both come from Old English græg." },
    { k: "art", text: "Whistler didn't call it Whistler's Mother. He called it Arrangement in Grey and Black No. 1 ([[painting-whistlers-mother]]) and wanted it seen as a study of tones. Painting entirely in greys has its own name, grisaille, and was often used to imitate carved stone." },
    { k: "science", text: "A grey has no fixed look. On red it leans green; on blue it leans orange. [[chevreul|Chevreul]] described this [[simultaneous-contrast|simultaneous contrast]] in 1839. In Edward Adelson's checker-shadow illusion, a square that looks dark and one that looks light are the identical grey. See [[color-constancy]]." },
    { k: "poetry", text: "In [[goethe|Goethe]]'s Faust, the devil Mephistopheles tells a student: 'Grey, dear friend, is all theory, and green the golden tree of life.' Grey stands for dry learning, [[Green|green]] for life itself." }
  ],
  related: [
    { to: "Green", why: "Goethe's Faust: grey is theory, green the golden tree of life" },
    { to: "Black", why: "Whistler's 'Arrangement in Grey and Black', the famous mother portrait" },
    { to: "Silver", why: "Grey with a shine; heraldry's argent is white or silver" },
    { to: "Lavender", why: "With grey and mauve, a color of Victorian half-mourning" }
  ],
  sources: [
    "Musée d'Orsay / Britannica, 'Arrangement in Grey and Black, No. 1' (1871)",
    "Chevreul, De la loi du contraste simultané des couleurs (1839); Adelson, checker-shadow illusion (1995)",
    "Goethe, Faust, Part One (1808)"
  ]
},

"Black": {
  named: "abstract",
  since: { year: -30000, what: "Charcoal drawings on the walls of Chauvet Cave", approx: true },
  facets: [
    { k: "language", text: "Old English had near-twins: blæc, black, and blac, pale or shining. Both may come from a root meaning to burn: the glow of fire and the soot it leaves. Medieval writers mixed them up so often that the surname Blake can mean either pale or dark." },
    { k: "history", text: "Black was the first drawing material. People drew lions and rhinos in charcoal on the walls of Chauvet Cave in France more than 30,000 years ago. Painters later charred bones and [[Ivory|ivory]] for bone black and ivory black, and collected soot for lamp black." },
    { k: "symbolism", text: "Black opens the alchemist's Great Work: nigredo, the blackening, rot before rebirth ([[alchemy]]). [[heraldry|Heraldry]] calls black sable, after the dark fur. Across much of Europe it is the color of [[mourning-colors|mourning]]; Queen Victoria wore it for forty years after Prince Albert died in 1861." },
    { k: "design", text: "Henry Ford wrote that a customer could have a Model T 'any colour that he wants so long as it is black.' In fact the car came in red, grey, green and blue until 1914 and got colors back in 1926. The story that black was chosen because it dried fastest has little evidence. In 1926 Vogue called Chanel's little black dress 'Chanel's Ford'." },
    { k: "science", text: "The blackest blacks are forests of carbon nanotubes. [[vantablack|Vantablack]], unveiled in 2014, swallows about 99.96% of light, so a crumpled sheet coated in it looks like a flat hole. The sculptor Anish Kapoor's exclusive right to use it as art sparked a long feud." }
  ],
  related: [
    { to: "White", why: "Every language names dark and light first; color words start here" },
    { to: "Red", why: "Alchemy's Great Work begins in black and ends in red" },
    { to: "Charcoal", why: "Burnt wood, the black of the first cave drawings" },
    { to: "Ivory", why: "Ivory black was made by charring ivory scraps" },
    { to: "Pink", why: "Vantablack's exclusive license provoked the 'pinkest pink'" }
  ],
  sources: [
    "Etymonline, 'black'",
    "Ford, My Life and Work (1922); Ed Conway, 'Watching paint dry' (Model T colors 1908-1926)",
    "Vogue, October 1926, via Wikipedia, 'Little black dress'",
    "Surrey NanoSystems (2014); Smithsonian Magazine on the Kapoor-Semple feud (2016)"
  ]
},

"White": {
  named: "abstract",
  facets: [
    { k: "language", text: "White and wheat share a root. Wheat is the white grain, named for its pale flour, and both words go back to an ancient root meaning to shine." },
    { k: "science", text: "In 1666 [[isaac-newton|Newton]] began splitting sunlight with prisms and showed that white is not pure: it is every color at once ([[opticks]], [[spectrum]]). [[goethe|Goethe]] spent years arguing he was wrong. [[wittgenstein|Wittgenstein]] asked a stranger question in [[remarks-on-colour|Remarks on Colour]]: why can glass be clear and green, but never clear and white?" },
    { k: "history", text: "For about two thousand years, European painters' main white was [[lead-white|lead white]]: brilliant, flexible and poisonous. Zinc white arrived in the 1800s. Titanium white, made in bulk from 1916, reached artists' tubes in 1921 and is now the standard." },
    { k: "culture", text: "Queen Victoria married in white silk in 1840, breaking with royal custom, and brides across the West followed. In China, white is the traditional color of [[mourning-colors|mourning]], and Hindu widows in India have long worn white." },
    { k: "symbolism", text: "[[alchemy|Alchemy]]'s second stage, albedo, washes the blackened matter white. [[heraldry|Heraldry]] calls white argent, silver. The Church wears white at Easter and Christmas ([[liturgical-colors]])." }
  ],
  related: [
    { to: "Black", why: "Every language names light and dark first; color words start here" },
    { to: "Silver", why: "Heraldry's argent: white and silver are the same tincture" },
    { to: "Red", why: "In China, red for weddings and white for funerals" },
    { to: "Powder blue", why: "Laundry blue: a dash of blue made yellowed linen look whiter" },
    { to: "Ivory", why: "The warm white named after elephant tusk" }
  ],
  sources: [
    "Etymonline, 'white', 'wheat'",
    "Newton, Opticks (1704); Wittgenstein, Remarks on Colour (1977); Lugg, 'Wittgenstein on transparent white'",
    "Pigments through the Ages (WebExhibits), 'Titanium white'",
    "FIT Museum, Fashion History Timeline, '1840: Queen Victoria's wedding dress'"
  ]
},

// ───────────── Blues ─────────────

"Navy": {
  named: "abstract",
  since: { year: 1748, what: "Royal Navy officers get dark blue uniforms", approx: false },
  facets: [
    { k: "history", text: "In 1748 Britain's Royal Navy gave its officers their first official uniforms: dark blue coats with white facings. The blue came from [[indigo-dye|indigo]], which stood up unusually well to sun and salt water. Navies around the world followed, and the color took the navy's name. A popular tale says George II picked the blue after admiring a duchess's riding habit; it's told without solid evidence." }
  ],
  related: [
    { to: "Indigo", why: "The dye that let navy cloth hold its color at sea" },
    { to: "Khaki", why: "Another color civilians borrowed from a British uniform" },
    { to: "Midnight blue", why: "The darker blue that challenged black for evening wear" },
    { to: "White", why: "Navy and white: the 1748 uniform, and every sailor suit since" }
  ],
  sources: [
    "National Portrait Gallery, 'An Officer and a Gentleman: naval uniform and male fashion in the eighteenth century'",
    "Wikipedia, 'Navy blue'; 'Uniforms of the Royal Navy'"
  ]
},

"Royal blue": {
  named: "abstract",
  facets: [
    { k: "history", text: "A popular story says millers in Rode, Somerset, won a contest to dye a dress for Queen Charlotte, wife of George III, and that their winning shade became royal blue. No documents from the time back it up, so treat it as legend." },
    { k: "design", text: "On screens, royal blue is CSS royalblue, #4169E1. It is one of the named colors browsers inherited from the X Window System, a 1980s list that also gave the web names like [[Cornflower|cornflowerblue]] and [[Steel blue|steelblue]]." }
  ],
  related: [
    { to: "Azure", why: "The blue field of France's royal coat of arms" },
    { to: "Purple", why: "The older royal color; blue only rose to royalty in medieval Europe" },
    { to: "Cornflower", why: "Another X11 color name the web adopted wholesale" }
  ],
  sources: [
    "Georgian Era blog, 'Fashionable blues of the 18th century' (the Rode legend)",
    "W3C, CSS Color Module Level 4, named colors"
  ]
},

"Sky blue": {
  named: "nature",
  facets: [
    { k: "science", text: "Sunlight bounces off the molecules of the air, and short blue waves scatter far more than long red ones, so blue reaches you from every direction. Lord Rayleigh worked out the math in 1871. At sunset the light crosses so much air that the blue is scattered away before it arrives, leaving [[Orange|orange]] and [[Red|red]]. See [[spectrum]]." },
    { k: "history", text: "In 1789 the Swiss scientist Horace-Bénédict de Saussure built a cyanometer: a ring of 53 numbered blues, from nearly white to nearly black, for measuring the sky. He took readings in Geneva, at Chamonix and on Mont Blanc, and concluded that the sky's blue depends on what is floating in the air." }
  ],
  related: [
    { to: "Cerulean", why: "From caeruleus, the Latin word for the blue of sky and sea" },
    { to: "Orange", why: "The same scattering paints a blue noon and an orange sunset" },
    { to: "Kelly green", why: "Ireland's Order of St Patrick (1783) dressed its knights in sky blue" },
    { to: "Cornflower", why: "France's 1915 sky-blue uniforms gave the cornflower its meaning" }
  ],
  sources: [
    "Strutt (Lord Rayleigh), 'On the light from the sky', Philosophical Magazine (1871)",
    "Wikipedia, 'Cyanometer'; Colossal, 'The cyanometer is a 225-year-old tool' (2014)"
  ]
},

"Periwinkle": {
  named: "flower",
  facets: [
    { k: "language", text: "Periwinkle is named after Vinca, a creeping evergreen with [[Violet|violet]]-[[Blue|blue]] flowers. The name runs back through Old English perwince to Latin pervinca. The edible sea snail called a periwinkle got its name separately." },
    { k: "history", text: "The pretty flower had a grim side. In medieval England, garlands of it were set on condemned prisoners; one chronicle says the Scottish knight Simon Fraser was crowned with periwinkle, in mockery, on his way to execution in 1306. In Italy it was called the flower of death and woven into wreaths for dead children." }
  ],
  related: [
    { to: "Cornflower", why: "Another blue named after a European flower" },
    { to: "Violet", why: "Its flower sits right on the line between blue and violet" },
    { to: "Lavender", why: "A sister color named after a flowering plant" }
  ],
  sources: [
    "Etymonline, 'periwinkle'",
    "Grieve, A Modern Herbal (1931), 'Periwinkle'"
  ]
},

"Turquoise": {
  named: "gem",
  since: { year: -1950, what: "Egyptian temple to Hathor at the Sinai turquoise mines", approx: true },
  facets: [
    { k: "language", text: "Turquoise means Turkish. The stone reached Europe from Persian mines through Turkish traders, and the French called it the Turkish stone." },
    { k: "history", text: "Ancient Egyptians sent expeditions to the Sinai for turquoise. At the mines of Serabit el-Khadim they built a temple to Hathor, who was called the lady of turquoise. Half a world away, Aztec artisans covered masks, and at least one human skull, in turquoise mosaic." },
    { k: "science", text: "Turquoise is a copper mineral, like [[Malachite|malachite]], and copper gives it the [[Sky blue|sky color]]. A little iron in the mix pushes it greener." }
  ],
  related: [
    { to: "Malachite", why: "Another stone colored by copper, prized in ancient Egypt" },
    { to: "Azure", why: "Persia's other famous blue stone, lapis lazuli, gave us azure" },
    { to: "Teal", why: "Named after a duck's eye patch of nearly the same blue-green" }
  ],
  sources: [
    "The Metropolitan Museum of Art, 'Turquoise in Ancient Egypt'",
    "British Museum, turquoise mosaic mask of Tezcatlipoca",
    "Etymonline, 'turquoise'"
  ]
},

"Teal": {
  named: "animal",
  since: { year: 1917, what: "Teal first used as a color word in English", approx: false },
  facets: [
    { k: "language", text: "Teal is a duck. The male Eurasian teal has a green-blue band sweeping back from its eye, and that patch gave the color its name, one of many colors named after animals, like [[Canary|canary]] and [[Taupe|taupe]]. It is usually dated as a color word to 1917, though some dictionaries find it only in the early 1920s." }
  ],
  related: [
    { to: "Canary", why: "Another color named after a bird" },
    { to: "Taupe", why: "Also named after an animal: taupe is French for mole" },
    { to: "Turquoise", why: "The stone version of the same blue-green" }
  ],
  sources: [
    "Wikipedia, 'Teal' (first color use 1917, after Maerz & Paul)",
    "Wikipedia, 'Eurasian teal'"
  ]
},

"Aqua": {
  named: "nature",
  facets: [
    { k: "language", text: "Aqua is Latin for water. On screens it is exactly cyan, #00FFFF: the 16 basic HTML colors, taken from the Windows VGA palette, gave cyan a second name, aqua, and the web kept both. Cyan comes from Greek kyanos, dark blue enamel, the word [[homer|Homer]] used for the dark brows of Zeus." },
    { k: "design", text: "Cyan is one of the three printing inks, with [[Magenta|magenta]] and [[Yellow|yellow]], plus black: CMYK. Every full-color magazine photo is built from tiny dots of those inks that your eye blends. See [[optical-mixing]]." }
  ],
  related: [
    { to: "Magenta", why: "Its partner ink in four-color printing" },
    { to: "Yellow", why: "The third printing primary, with cyan and magenta" },
    { to: "Blue", why: "Homer's kyanos, the root of cyan, meant dark, not sky blue" }
  ],
  sources: [
    "W3C, HTML 3.2 Reference Specification (1997), the 16 color names",
    "Etymonline, 'cyan'"
  ]
},

"Powder blue": {
  named: "material",
  since: { year: 1650, what: "Powder blue: ground cobalt glass sold for laundry", approx: true },
  facets: [
    { k: "history", text: "Powder blue was a product before it was a shade. In the 1650s it meant powdered smalt, ground blue [[Cobalt|cobalt]] glass, sold to laundresses. A pinch in the rinse water tinted yellowed linen just enough to look [[White|whiter]], a trick called bluing. Only in the 1890s did the name settle on the soft pale blue we know." },
    { k: "science", text: "Bluing works because a faint blue cancels a faint [[Yellow|yellow]], its [[complementary-colors|complement]], and the cloth reads as neutral white. Modern detergents do the same job with optical brighteners, which soak up invisible ultraviolet and give it back as a faint blue glow." }
  ],
  related: [
    { to: "Cobalt", why: "The original powder blue was ground cobalt glass" },
    { to: "White", why: "Laundry blue made yellowed whites look white again" },
    { to: "Yellow", why: "Bluing works by canceling yellow" }
  ],
  sources: [
    "Wikipedia, 'Powder blue' (1650s smalt; color name from 1894)",
    "Wikipedia, 'Bluing (fabric)'; 'Optical brightener'"
  ]
},

"Cornflower": {
  named: "flower",
  facets: [
    { k: "culture", text: "Cornflowers grew wild in grain fields, which the British call corn. In 1915 young French soldiers arrived at the front in new horizon-blue uniforms and were nicknamed bleuets, cornflowers. The flower became France's symbol of remembrance, the way the poppy is in Britain." },
    { k: "history", text: "A small wreath of cornflowers and olive leaves lay on Tutankhamun's coffin. In Prussia, a legend said Queen Louise hid her children in a cornflower field while fleeing Napoleon; whatever its truth, her son Wilhelm I adopted the flower, and Germans called it the emperor's flower." },
    { k: "language", text: "Its Latin name, Centaurea cyanus, carries the same Greek root as [[Aqua|cyan]]: kyanos, dark blue." }
  ],
  related: [
    { to: "Olive", why: "Tutankhamun's wreath wove cornflowers with olive leaves" },
    { to: "Aqua", why: "Cyanus and cyan share the Greek root kyanos" },
    { to: "Periwinkle", why: "Another European flower that named a blue" },
    { to: "Sky blue", why: "The horizon-blue uniforms that made the cornflower a war memorial" }
  ],
  sources: [
    "Griffith Institute, Oxford, Tutankhamun archive, 'The funeral wreath of Tutankhamun'",
    "Wikipedia, 'Bleuet de France'",
    "Wikipedia, 'Centaurea cyanus'"
  ]
},

"Azure": {
  named: "gem",
  facets: [
    { k: "language", text: "Azure is a word that lost its first letter. Persian lajvard named lapis lazuli and a place where it was mined. Arabic made it lazaward, and in French and Spanish the opening l fell away, apparently taken for the article: l'azur. Lapis lazuli kept its l." },
    { k: "history", text: "Lapis lazuli came from mines in the Badakhshan mountains of Afghanistan. Ground and purified, it made [[ultramarine-pigment|ultramarine]], blue from beyond the sea, so costly that painters saved it for the robes of the Virgin." },
    { k: "symbolism", text: "[[heraldry|Heraldry]] calls blue azure. The arms of the French kings were azure with gold lilies, and in 1887 the writer Stéphen Liégeard named the Riviera the Côte d'Azur." }
  ],
  related: [
    { to: "Gold", why: "France's royal arms: gold lilies on an azure field" },
    { to: "Turquoise", why: "Persia's other blue stone, named after the Turks who traded it" },
    { to: "Cobalt", why: "Cobalt blue gave painters a cheap stand-in for lapis ultramarine" },
    { to: "Blue", why: "Lapis made Europe's costliest blue" }
  ],
  sources: [
    "OED, 'azure'; Wiktionary, 'lapis lazuli'",
    "Britannica, 'Lapis lazuli'; 'Ultramarine'",
    "Wikipedia, 'French Riviera' (Liégeard, La Côte d'Azur, 1887)"
  ]
},

"Cerulean": {
  named: "nature",
  since: { year: 1860, what: "Rowney sells cerulean blue paint as 'coeruleum'", approx: true },
  facets: [
    { k: "language", text: "Cerulean comes from Latin caeruleus, the dark blue of sea and sky, probably from caelum, heaven." },
    { k: "history", text: "Cerulean blue paint is cobalt and tin oxides fired together. A Swiss chemist made it in the late 1700s, but painters only got it after the London colorman George Rowney sold it as 'coeruleum' around 1860. It is a cool, slightly greenish blue that does not fade. See [[cobalt-blue-pigment]]." },
    { k: "design", text: "Pantone launched its [[color-of-the-year|Color of the Year]] with Cerulean for 2000, to mark the turn of the millennium. Six years later, The Devil Wears Prada built a famous speech around a cerulean sweater and how a runway shade trickles down to the bargain bin." }
  ],
  related: [
    { to: "Cobalt", why: "Both are cobalt pigments; cerulean adds tin" },
    { to: "Sky blue", why: "Caeruleus was the Romans' word for the sky's blue" },
    { to: "Coral", why: "Another Pantone Color of the Year, 2019's Living Coral" }
  ],
  sources: [
    "Natural Pigments, 'Cerulean blue' (Höpfner; Rowney 1860)",
    "Pantone, 'Cerulean 15-4020', Color of the Year 2000",
    "Etymonline, 'cerulean'"
  ]
},

"Cobalt": {
  named: "metal",
  since: { year: 1802, what: "Thénard invents cobalt blue pigment", approx: false },
  facets: [
    { k: "language", text: "Cobalt is named after a goblin. German miners called a troublesome ore kobold: it gave off poisonous arsenic fumes when smelted and yielded none of the metal they wanted. In the 1730s the Swedish chemist Georg Brandt showed it held a new metal, the one that turns glass blue." },
    { k: "history", text: "In 1802 the French chemist Louis Jacques Thénard heated cobalt with alumina and got a deep, stable blue. Cobalt blue gave painters a reliable, affordable rival to [[ultramarine-pigment|ultramarine]]. See [[cobalt-blue-pigment]]." },
    { k: "culture", text: "Centuries earlier, cobalt made China's blue-and-white porcelain. In the 14th century, under the Mongol Yuan dynasty, potters at Jingdezhen painted with cobalt brought from Persia, then sealed it under a clear glaze. The style sailed the world and was copied from Delft to Iznik." }
  ],
  related: [
    { to: "White", why: "Cobalt on white porcelain: China's blue-and-white" },
    { to: "Powder blue", why: "Smalt, ground cobalt glass, was the first 'powder blue'" },
    { to: "Cerulean", why: "A cobalt pigment with tin added, lighter and greener" },
    { to: "Azure", why: "Cobalt blue was the affordable answer to lapis ultramarine" }
  ],
  sources: [
    "Royal Society of Chemistry, Periodic Table, 'Cobalt'",
    "Royal Talens, 'Cobalt blue: from fake silver to colourful pigment'",
    "Jesus College Cambridge, 'Branding Jingdezhen blue-and-white porcelain in the fourteenth century'"
  ]
},

"Steel blue": {
  named: "metal",
  facets: [
    { k: "science", text: "Real blued steel isn't painted. Heat polished steel to about 300 °C and an oxide film a few dozen nanometers thick grows on it. Light bouncing off the top and the bottom of that film interferes, and the steel shows [[Blue|blue]]. Watchmakers still blue screws and hands this way." }
  ],
  related: [
    { to: "Gunmetal", why: "Another grey-blue named after worked metal" },
    { to: "Silver", why: "Polished metal greys: silver tarnishes, steel blues when heated" },
    { to: "Petrol", why: "Both named after industrial materials" }
  ],
  sources: [
    "Bhadeshia, 'Oxide on steel and tempering colours', University of Cambridge"
  ]
},

"Denim": {
  named: "material",
  since: { year: 1873, what: "Riveted blue jeans patented in the US", approx: false },
  facets: [
    { k: "language", text: "Denim is short for serge de Nîmes, a twill named after the city in southern France. Jeans are named after Genoa, Gênes in French, whose tough cotton cloth was called jean." },
    { k: "history", text: "On May 20, 1873, Levi Strauss and the tailor Jacob Davis got a US patent for work pants with copper rivets at the pocket corners, where seams tore. The blue jean was born, dyed with [[indigo-dye|indigo]]." },
    { k: "science", text: "Jeans fade because indigo barely sticks. It coats the outside of each cotton yarn and leaves the core white. Wear rubs the blue away where you move: thighs, knees and pocket edges." }
  ],
  related: [
    { to: "Indigo", why: "The dye that makes jeans blue, and lets them fade" },
    { to: "Navy", why: "Indigo blue dressed both naval officers and miners" }
  ],
  sources: [
    "Levi Strauss & Co., 'The history of denim'",
    "US National Archives, 'Forever in blue jeans' (patent 139,121)",
    "Heddels, 'Ring dyeing'"
  ]
},

"Petrol": {
  named: "material",
  facets: [
    { k: "language", text: "Petrol blue, a deep, inky [[Teal|teal]], is a British and European name, from petrol, the British word for gasoline, and appears in the early 1900s. Why petrol is unclear: maybe the tint of fuel, maybe blue-dyed products like paraffin. The idea that it's a misspelling of petrel, the seabird, has no support." }
  ],
  related: [
    { to: "Steel blue", why: "Both named after industrial materials" },
    { to: "Teal", why: "The deeper, inkier cousin of teal" }
  ],
  sources: [
    "Wiktionary, 'petrol blue' and its discussion page"
  ]
},

"Midnight blue": {
  named: "nature",
  facets: [
    { k: "culture", text: "In the 1920s the Prince of Wales, later the Duke of Windsor, wore evening suits in midnight blue instead of [[Black|black]]. Under electric light, tailors said, it looked blacker than black, and in photographs it showed the cut better. Midnight-blue dinner jackets have been a classic since." }
  ],
  related: [
    { to: "Black", why: "The blue said to look blacker than black under electric light" },
    { to: "Navy", why: "Both blues came to fashion from men's uniforms and dress codes" }
  ],
  sources: [
    "Encyclopedia.com (Fashion, Costume and Culture), 'Windsor, Duke and Duchess of'",
    "Wikipedia, 'Midnight blue'"
  ]
},

// ───────────── Reds & pinks ─────────────

"Scarlet": {
  named: "material",
  facets: [
    { k: "language", text: "Scarlet was a fabric before it was a color. In medieval England the word meant a costly, finely finished wool cloth, and because the best of it was dyed brilliant red, the name slid from the cloth to its color. It came through French and Medieval Latin; the deeper origin is uncertain, perhaps Arabic siqillat, a fine silk." },
    { k: "history", text: "The dye made the difference. [[kermes|Kermes]] insects from Mediterranean oaks gave the finest medieval scarlet, until American [[cochineal]] took over. In the British army, ordinary soldiers wore red coats dyed with cheap madder, while officers paid for scarlet dyed with cochineal." },
    { k: "poetry", text: "In the Book of Revelation the great harlot is dressed in purple and scarlet. In Hawthorne's The Scarlet Letter (1850), Hester Prynne must wear a red letter A for adultery. Scarlet became the color of sin worn in public." }
  ],
  related: [
    { to: "Crimson", why: "Both were kermes reds; crimson's name means 'made by worms'" },
    { to: "Carmine", why: "Cochineal carmine dyed British officers' scarlet coats" },
    { to: "Purple", why: "Revelation pairs them: the two luxury dyes of the ancient world" },
    { to: "Vermilion", why: "Mineral red against insect red, rivals for centuries" }
  ],
  sources: [
    "Etymonline, 'scarlet'",
    "Wikipedia, 'Scarlet (color)'; 'Cochineal'",
    "Revelation 17:4; Hawthorne, The Scarlet Letter (1850)"
  ]
},

"Crimson": {
  named: "animal",
  since: { year: 1400, what: "Crimson enters English from Medieval Latin", approx: true },
  facets: [
    { k: "language", text: "Crimson means 'made by a worm'. It came into English around 1400 from Medieval Latin cremesinus, from Arabic qirmizi, and back through Persian to Sanskrit krmija, the dye from tiny insects. [[Carmine]] shares the root, and [[Vermilion|vermilion]], from Latin vermiculus, 'little worm', carries the same idea." },
    { k: "history", text: "[[kermes|Kermes]] insects live on the kermes oak around the Mediterranean. Dried, they look like seeds, so old texts called the dye grain, and colorfast cloth was 'dyed in the grain', which is where ingrained comes from. American [[cochineal]] later gave the same red with a tenth as many insects." },
    { k: "culture", text: "Harvard's sports teams and its student newspaper are both called the Crimson." }
  ],
  related: [
    { to: "Carmine", why: "Same Arabic root, qirmiz; carmine swapped kermes for cochineal" },
    { to: "Vermilion", why: "Another 'little worm' name, though vermilion is a mineral" },
    { to: "Scarlet", why: "The luxury cloth that kermes dyed red" }
  ],
  sources: [
    "Wikipedia, 'Crimson' (etymology; kermes vs carmine)",
    "Etymonline, 'crimson', 'ingrain'"
  ]
},

"Maroon": {
  named: "fruit",
  since: { year: 1789, what: "Maroon first used as a color word in English", approx: false },
  facets: [
    { k: "language", text: "Maroon is French marron, chestnut; in modern French marron simply means [[Brown|brown]]. It was first used as a color in English in 1789. The other maroon, to strand someone, is unrelated: it comes from Spanish cimarrón, wild or runaway, the name for the free communities escaped slaves built in the Caribbean." },
    { k: "culture", text: "Maroon became a badge. The maroon beret of airborne troops began with Britain's Parachute Regiment in 1942. Tibetan Buddhist monks, the Dalai Lama among them, wear maroon robes, and Queensland made maroon its official state color in 2003." }
  ],
  related: [
    { to: "Burgundy", why: "Maroon leans brown like chestnut; burgundy leans purple like wine" },
    { to: "Chocolate", why: "Two browns named after foods: chestnut and cacao" },
    { to: "Mahogany", why: "Both browns named after trees: chestnut and mahogany" }
  ],
  sources: [
    "Wikipedia, 'Maroon (color)' (first use 1789)",
    "Etymonline, 'maroon'"
  ]
},

"Burgundy": {
  named: "drink",
  since: { year: 1881, what: "Burgundy first used as a color word in English", approx: false },
  facets: [
    { k: "language", text: "Burgundy is named after the [[Red|red]] wine of Burgundy in eastern France, made from Pinot Noir grapes. It is recorded as a color name in English from 1881. Most passports issued by European Union countries are burgundy." }
  ],
  related: [
    { to: "Chartreuse", why: "Another color named after a French drink" },
    { to: "Oxblood", why: "The next step darker, named for a different red liquid" },
    { to: "Maroon", why: "Maroon leans brown like chestnut; burgundy leans purple like wine" },
    { to: "Mustard", why: "Dijon mustard and Burgundy wine come from the same region" }
  ],
  sources: [
    "Wikipedia, 'Burgundy (color)' (first use 1881)"
  ]
},

"Coral": {
  named: "gem",
  since: { year: 1513, what: "Coral first used as a color word in English", approx: false },
  facets: [
    { k: "history", text: "Red coral, Corallium rubrum, is the skeleton of tiny Mediterranean sea animals. It has been carved into beads and charms since antiquity, and European babies were long given coral amulets and teething rattles for luck and protection. Coral is recorded as a color in English from 1513." },
    { k: "poetry", text: "Ovid tells where coral came from. In the Metamorphoses, Perseus lays Medusa's severed head on a bed of seaweed, and the soft weed hardens to stone as it touches her." },
    { k: "design", text: "Pantone chose Living Coral as its [[color-of-the-year|Color of the Year]] for 2019." }
  ],
  related: [
    { to: "Salmon", why: "Two pink-oranges named after sea creatures" },
    { to: "White", why: "Stressed reef corals lose their algae and bleach white" },
    { to: "Peach", why: "Another Pantone Color of the Year, 2024's Peach Fuzz" }
  ],
  sources: [
    "Wikipedia, 'Coral (color)' (first use 1513, after Maerz & Paul)",
    "Ovid, Metamorphoses, Book 4",
    "Pantone, Color of the Year 2019: Living Coral 16-1546"
  ]
},

"Salmon": {
  named: "animal",
  since: { year: 1776, what: "Salmon first used as a color word in English", approx: false },
  facets: [
    { k: "science", text: "Salmon are [[Pink|pink]] because of what they eat. Krill and shrimp carry astaxanthin, a red-orange pigment, and it builds up in the fish's muscle. Without it, farmed salmon would be pale, so farmers add the pigment to the feed and choose the shade from a numbered color fan." },
    { k: "language", text: "Salmon has been a color name in English since 1776." }
  ],
  related: [
    { to: "Coral", why: "Two pink-oranges named after sea creatures" },
    { to: "Pink", why: "Flamingos get their pink the same way: carotenoids in their food" },
    { to: "Carmine", why: "Another animal-made color that ends up in food" }
  ],
  sources: [
    "Wikipedia, 'Salmon (color)' (first use 1776; astaxanthin)",
    "Wikipedia, 'Astaxanthin'"
  ]
},

"Baby pink": {
  named: "abstract",
  facets: [
    { k: "culture", text: "Baby pink belongs to the nursery rule that girls wear pink. The rule is younger than it looks: early-1900s advice columns disagreed about which color suited which sex, and pink for girls only became standard in the mid-20th century. See [[pink-and-blue]]." }
  ],
  related: [
    { to: "Powder blue", why: "The pale blue it was paired against in the nursery" },
    { to: "Pink", why: "The pale face of the girls-in-pink rule" }
  ],
  sources: [
    "Paoletti, Pink and Blue: Telling the Boys from the Girls in America (2012)",
    "Smithsonian Magazine, 'When did girls start wearing pink?' (2011)"
  ]
},

"Hot pink": {
  named: "abstract",
  since: { year: 1937, what: "Schiaparelli launches shocking pink", approx: false },
  facets: [
    { k: "design", text: "Hot pink's loud ancestor is shocking [[Pink|pink]]. Elsa Schiaparelli launched it in 1937 with a perfume called Shocking, in a bottle shaped like a dressmaker's dummy, designed by the painter Leonor Fini. The bright, impudent pink became her house signature." }
  ],
  related: [
    { to: "Pink", why: "Schiaparelli turned pink from sweet to shocking" },
    { to: "Magenta", why: "Its purpler neighbor, born in a dye lab in 1859" }
  ],
  sources: [
    "Schiaparelli, official site, 'Shocking perfume bottle by Leonor Fini'",
    "V&A, 'Elsa Schiaparelli: a timeline'"
  ]
},

"Magenta": {
  named: "place",
  since: { year: 1859, what: "Fuchsine dye made in France, soon renamed magenta", approx: true },
  facets: [
    { k: "history", text: "Magenta is named after a battle. Around 1859 the French chemist François-Emmanuel Verguin made a vivid aniline dye and called it fuchsine, after the fuchsia flower. On 4 June 1859 France and Sardinia beat Austria near the Italian town of Magenta, and British chemists renamed the dye after the victory. It followed [[mauveine]] in the first wave of synthetic dyes." },
    { k: "science", text: "Magenta isn't in the rainbow. No single wavelength looks magenta; your brain builds it when red and blue light arrive without green. On the light wheel it sits opposite [[Green|green]]. See [[extra-spectral]]." },
    { k: "design", text: "Magenta is one of the printing inks in CMYK, with [[Aqua|cyan]] and [[Yellow|yellow]]. Deutsche Telekom trademarked its magenta and has gone after companies in unrelated fields, such as the insurer Lemonade. See [[color-trademarks]]." }
  ],
  related: [
    { to: "Mauve", why: "The first aniline dye; magenta followed within three years" },
    { to: "Aqua", why: "Cyan and magenta, the colored printing inks with yellow" },
    { to: "Green", why: "Its opposite: magenta is light with the green taken out" },
    { to: "Purple", why: "Both are colors the brain assembles, with no wavelength of their own" }
  ],
  sources: [
    "Wikipedia, 'Magenta' (Verguin; Nicholson and Maule, 1860; Battle of Magenta, 4 June 1859)",
    "Wikipedia, 'Fuchsine'"
  ]
},

// ───────────── Reds ─────────────

"Vermilion": {
  named: "mineral",
  since: { year: 1289, what: "Vermilion first recorded as a color word in English", approx: false },
  facets: [
    { k: "history", text: "Vermilion is ground cinnabar, mercury sulfide. Rome got it from Almadén in Spain; Pliny says about ten thousand pounds a year arrived, at a price fixed by law. Generals celebrating a triumph had their faces painted with it, and the red walls of Pompeii's Villa of the Mysteries are cinnabar. See [[vermilion-pigment]]." },
    { k: "science", text: "Chinese makers probably learned to synthesize vermilion from mercury and sulfur, the two great principles of [[alchemy]], by the 4th century BCE; an Arabic alchemical text described it by the early 800s. It has a flaw: around 1400 the painter Cennino Cennini warned that, exposed to air, it can turn black." },
    { k: "culture", text: "In China vermilion was the red of seals, carved lacquer and the emperor's own hand: Qing emperors answered officials' reports in vermilion ink, a privilege no one else had." }
  ],
  related: [
    { to: "Crimson", why: "Both names mean 'little worm', though only crimson is made of insects" },
    { to: "Scarlet", why: "Mineral red against insect red, rivals for centuries" },
    { to: "Red", why: "The prestige red of Roman walls and Chinese emperors" }
  ],
  sources: [
    "Wikipedia, 'Vermilion' (Pliny, Natural History 33; Cennini, Il libro dell'arte)",
    "Gettens, Feller & Chase, 'Vermilion and cinnabar', Studies in Conservation (1972)"
  ]
},

"Carmine": {
  named: "dye",
  since: { year: 1520, what: "Spain begins importing cochineal from the Americas", approx: true },
  facets: [
    { k: "history", text: "Carmine comes from [[cochineal]] insects that feed on prickly-pear cacti in Mexico and Peru. Spain began shipping them to Europe in the 1520s, and the dye became New Spain's most valuable export after silver. It takes about 70,000 insects to make a pound of dye." },
    { k: "culture", text: "You have probably eaten some. Carmine, labeled E120 or cochineal extract, colors yogurts, sweets and drinks. In 2012 Starbucks dropped it from its strawberry drinks after vegetarians objected." },
    { k: "language", text: "Carmine comes from Medieval Latin carminium, probably a blend of Arabic qirmiz, the kermes insect, and Latin minium, red lead. It is a close cousin of [[Crimson|crimson]]." }
  ],
  related: [
    { to: "Crimson", why: "Same Arabic root; cochineal replaced the old kermes" },
    { to: "Scarlet", why: "Cochineal dyed British officers' scarlet coats" },
    { to: "Salmon", why: "Another animal-made color that ends up in food" }
  ],
  sources: [
    "Wikipedia, 'Cochineal' (70,000 insects per pound; second to silver)",
    "Etymonline, 'carmine'",
    "BBC News, 'Starbucks to stop using cochineal insect dye' (2012)"
  ]
},

"Oxblood": {
  named: "animal",
  since: { year: 1705, what: "Chinese potters develop the oxblood copper-red glaze", approx: true },
  facets: [
    { k: "art", text: "Chinese potters called it Lang kiln red; Europeans called it sang de boeuf, oxblood. This copper-red glaze was developed around 1705 to 1712, under the Kangxi emperor, to revive a lost Ming red. Copper only turns red in a kiln starved of oxygen, the same trick that turns [[Celadon|celadon]] green, and the results were so unpredictable that Western potters spent decades trying to copy it." },
    { k: "culture", text: "On 1 April 1960 Dr. Martens launched its 1460 boot in cherry red, a deep oxblood. Skinheads took it up in the late 1960s, then punks in the 1970s." }
  ],
  related: [
    { to: "Celadon", why: "China's other great glaze; both need a kiln starved of oxygen" },
    { to: "Brick", why: "Kiln chemistry again: oxygen decides fired clay's color" },
    { to: "Burgundy", why: "Two near-black reds, one named for wine and one for blood" }
  ],
  sources: [
    "Wikipedia, 'Sang de boeuf glaze'",
    "Wikipedia, 'Dr. Martens' (1460 boot, 1 April 1960)"
  ]
},

"Brick": {
  named: "material",
  facets: [
    { k: "science", text: "Bricks are red because of iron. Fired with plenty of air, the iron in clay becomes red iron oxide, kin to red [[Ochre|ochre]] and [[Rust|rust]]. Starve the kiln of oxygen and the same clay can come out dark blue-grey, the way engineering bricks are made." }
  ],
  related: [
    { to: "Terracotta", why: "Both are fired clay; terracotta just means 'baked earth'" },
    { to: "Celadon", why: "Same iron, different fire: oxygen makes red, its lack makes celadon green" },
    { to: "Rust", why: "Both owe their red to iron oxide" }
  ],
  sources: [
    "Wikipedia, 'Brick' (firing and color)",
    "Rhodes, Clay and Glazes for the Potter (oxidation and reduction)"
  ]
},

"Cerise": {
  named: "fruit",
  since: { year: 1858, what: "Cerise in The Times, the OED's first example", approx: false },
  facets: [
    { k: "language", text: "Cerise is French for cherry. English borrowed it as a color in the mid-1800s: the Oxford English Dictionary's first example is from The Times in 1858, though a book of crochet patterns used it in 1845." }
  ],
  related: [
    { to: "Raspberry", why: "Another red named after a fruit" },
    { to: "Ecru", why: "Another French word English kept as a color: écru, raw" }
  ],
  sources: [
    "Wikipedia, 'Cerise (color)', citing the OED"
  ]
},

"Raspberry": {
  named: "fruit",
  facets: [
    { k: "language", text: "Blowing a raspberry, the rude noise, comes from Cockney rhyming slang: raspberry tart, fart." }
  ],
  related: [
    { to: "Mulberry", why: "Another berry that named a deep pink-red" },
    { to: "Cerise", why: "Another fruit-named red, from the French for cherry" }
  ],
  sources: [
    "Etymonline, 'raspberry'; Oxford English Dictionary"
  ]
},

// ───────────── Greens ─────────────

"Lime": {
  named: "fruit",
  since: { year: 1883, what: "Lime green first used as a color name in English", approx: true },
  facets: [
    { k: "language", text: "Lime green is recorded as a color name by 1883." },
    { k: "science", text: "A 2009 US Fire Administration study found fluorescent yellow-green and orange the easiest colors to spot in daylight, and some fire departments now paint their trucks lime-yellow instead of red. It works because your eye is most sensitive to yellow-green ([[trichromacy]])." }
  ],
  related: [
    { to: "Red", why: "Some fire departments swapped red trucks for lime-yellow ones" },
    { to: "Chartreuse", why: "Its slightly greener twin, named after a liqueur" },
    { to: "Green", why: "Yellow-green sits at the peak of the eye's sensitivity" }
  ],
  sources: [
    "Wikipedia, 'Lime (color)' (first use 1890)",
    "US Fire Administration, Emergency Vehicle Visibility and Conspicuity Study, FA-323 (August 2009)"
  ]
},

"Mint": {
  named: "plant",
  facets: [
    { k: "poetry", text: "Mint is named after the herb, whose name runs back through Latin mentha to Greek minthe. In Greek myth Minthe was a nymph whom Persephone turned into the fragrant plant; Ovid mentions the story in the Metamorphoses." }
  ],
  related: [
    { to: "Sage", why: "Another green named after a kitchen herb" },
    { to: "Pistachio", why: "Another soft green from the kitchen" }
  ],
  sources: [
    "Etymonline, 'mint (n.1)'",
    "Ovid, Metamorphoses, Book 10"
  ]
},

"Kelly green": {
  named: "person",
  facets: [
    { k: "culture", text: "Kelly green is named after Kelly, one of Ireland's most common surnames. Ireland has been the [[Emerald|Emerald Isle]] since William Drennan's 1795 poem 'When Erin First Rose'. Officially, though, Ireland's [[heraldry|heraldic]] color is blue: the [[Gold|gold]] harp sits on [[Azure|azure]], the knights of the Order of St Patrick (1783) wore [[Sky blue|sky blue]], and the all-Ireland football team played in blue until 1931." }
  ],
  related: [
    { to: "Emerald", why: "Ireland is the Emerald Isle, a phrase from a 1795 poem" },
    { to: "Orange", why: "Ireland's flag sets green beside orange, with white for peace between" },
    { to: "Sky blue", why: "Ireland's knights of St Patrick wore sky blue, not green" },
    { to: "Bottle green", why: "British racing green began as a salute to Ireland in 1903" }
  ],
  sources: [
    "Wikipedia, 'Kelly green'; 'William Drennan'",
    "Wikipedia, 'St. Patrick's blue' (Order of St Patrick, 1783; football kit to 1931)"
  ]
},

"Emerald": {
  named: "gem",
  since: { year: -250, what: "Ptolemaic emerald mines in Egypt's Eastern Desert", approx: true },
  facets: [
    { k: "science", text: "Emerald is green beryl. Pure beryl is colorless; a trace of chromium, or sometimes vanadium, turns it green." },
    { k: "history", text: "Egypt's Eastern Desert emerald mines were opened under the Ptolemies, after 300 BCE, and worked hard by the Romans. Spanish conquerors later found far richer stones in Colombia, which became the world's great source. Emerald green paint was something else: a copper-arsenic pigment made from 1814 and sold as Paris green. See [[arsenic-greens]]." },
    { k: "poetry", text: "In L. Frank Baum's The Wonderful Wizard of Oz (1900), the Emerald City is only as green as its visitors' glasses: everyone inside must wear green spectacles, locked on." },
    { k: "design", text: "Pantone made Emerald its [[color-of-the-year|Color of the Year]] for 2013." }
  ],
  related: [
    { to: "Viridian", why: "Chromium colors emerald, and viridian is a chromium oxide" },
    { to: "Kelly green", why: "Ireland, the Emerald Isle" },
    { to: "Jade", why: "Spain met both in the Americas: emeralds in Colombia, jade in Mexico" },
    { to: "Green", why: "Emerald green paint was one of the deadly arsenic greens" },
    { to: "Orchid", why: "Pantone's Color of the Year right after Emerald, in 2014" }
  ],
  sources: [
    "Wikipedia, 'Emerald' (chromium/vanadium)",
    "Harrell, J. A. (2004). Archaeological geology of the world's first emerald mine. Geoscience Canada 31(2)",
    "Baum, The Wonderful Wizard of Oz (1900)",
    "Pantone, Color of the Year 2013: Emerald 17-5641"
  ]
},

"Sage": {
  named: "plant",
  facets: [
    { k: "language", text: "Sage, the herb, comes from Latin salvia, from salvus, healthy: it was a healing plant. The wise sage is a different word, from Latin sapere, to know." }
  ],
  related: [
    { to: "Mint", why: "Another green named after a kitchen herb" },
    { to: "Olive", why: "Another grey-green from the Mediterranean kitchen" },
    { to: "Moss", why: "Another soft grey-green named after a plant" }
  ],
  sources: [
    "Etymonline, 'sage (n.1)', 'sage (adj.)'"
  ]
},

"Olive": {
  named: "fruit",
  facets: [
    { k: "symbolism", text: "In Genesis, Noah's dove comes back with an olive leaf, the sign the flood is over, and the olive branch became a sign of peace. In Greek myth, Athena won Athens from Poseidon by giving it the first olive tree." },
    { k: "history", text: "Olive drab, a brownish olive, is recorded from 1892 and became the US Army's field color in the Second World War." },
    { k: "design", text: "In 2012 Australia first described the ugliest color it could find for cigarette packs, Pantone 448 C, as olive green. Olive growers objected, and the official name became drab dark [[Brown|brown]]." }
  ],
  related: [
    { to: "Khaki", why: "The two great military colors: khaki drill and olive drab" },
    { to: "Brown", why: "Australia's cigarette-pack brown was briefly called olive" },
    { to: "Cornflower", why: "Tutankhamun's wreath wove olive leaves with cornflowers" }
  ],
  sources: [
    "Genesis 8:11",
    "Wikipedia, 'Olive (color)' (olive drab 1892; OD7 1943; OG-107 1952)",
    "Wikipedia, 'Pantone 448 C'"
  ]
},

"Forest green": {
  named: "nature",
  since: { year: 1810, what: "Forest green first used as a color name in English", approx: false },
  facets: [
    { k: "history", text: "Forest green is recorded from 1810, but England had an older woodland green: Lincoln green, wool dyed [[Blue|blue]] with woad, the European [[indigo-dye|indigo]], and then [[Yellow|yellow]] with weld, the cloth Robin Hood's men wear in the ballads. It was the cheaper choice: in 1182, Lincoln [[Scarlet|scarlet]] cost more than twice as much per ell as Lincoln green." }
  ],
  related: [
    { to: "Scarlet", why: "Lincoln's two famous cloths; scarlet cost twice as much in 1182" },
    { to: "Indigo", why: "Lincoln green began as woad blue, the same dye molecule as indigo" },
    { to: "Hunter green", why: "Another green named for life in the woods" }
  ],
  sources: [
    "Wikipedia, 'Shades of green' (forest green, 1810)",
    "Wikipedia, 'Lincoln green' (woad and weld; 1182 prices)"
  ]
},

"Chartreuse": {
  named: "drink",
  since: { year: 1884, what: "Chartreuse first used as a color word in English", approx: false },
  facets: [
    { k: "history", text: "Chartreuse was a liqueur first. In 1605 a French nobleman gave the Carthusian monks near Grenoble an [[alchemy|alchemical]] manuscript for an elixir of long life. The monks began working on it in 1737 and fixed the elixir's formula in 1764. It uses about 130 herbs, plants and flowers, and only two monks at a time know the whole recipe. Green Chartreuse dates from 1840; the color name followed in 1884." }
  ],
  related: [
    { to: "Burgundy", why: "Another color named after a French drink" },
    { to: "Yellow", why: "The monks also make a yellow Chartreuse, milder and sweeter" },
    { to: "Lime", why: "Its yellower twin, named after a fruit" }
  ],
  sources: [
    "Wikipedia, 'Chartreuse (liqueur)' (1605 manuscript; 1737; 1840; color name 1884)"
  ]
},

"Pistachio": {
  named: "food",
  facets: [
    { k: "language", text: "Pistachio came into English through Italian and Latin from Greek pistakion, and further back from Persian. The kernel's green comes from chlorophyll, the same pigment that makes leaves [[Green|green]]." }
  ],
  related: [
    { to: "Peach", why: "Another food that carries Persia in its name" },
    { to: "Mint", why: "Another soft green from the kitchen" }
  ],
  sources: [
    "Etymonline, 'pistachio'"
  ]
},

"Celadon": {
  named: "person",
  since: { year: 100, what: "Proto-celadon glazes in Eastern Han China", approx: true },
  facets: [
    { k: "language", text: "Celadon is named after a lovesick shepherd. In Honoré d'Urfé's pastoral novel L'Astrée (1607 to 1627), Céladon wears pale green ribbons, and French collectors gave his name to the soft green glaze on Chinese ceramics." },
    { k: "science", text: "Celadon's green comes from a pinch of iron, roughly 1 to 2.5 percent, in a glaze fired in a kiln starved of oxygen. The missing oxygen turns the iron from its red form, the one that colors [[Brick|bricks]], to a green one. Fire the same glaze with plenty of air and it comes out yellow-brown." },
    { k: "art", text: "Chinese potters made celadons for well over a thousand years, from Yue ware to the Longquan kilns of the Southern Song, prized because they looked like [[Jade|jade]]. Korean potters of the Goryeo period (918 to 1392) invented their own inlay: they carved designs and filled them with black and white clay." }
  ],
  related: [
    { to: "Jade", why: "Chinese potters prized celadon for looking like jade" },
    { to: "Brick", why: "Same iron, different fire: celadon green or brick red" },
    { to: "Oxblood", why: "China's other legendary glaze, copper red fired the same way" },
    { to: "Bottle green", why: "Iron tints both bottle glass and celadon glaze green" }
  ],
  sources: [
    "Wikipedia, 'Celadon' (L'Astrée; iron 0.75-2.5%; Goryeo sanggam inlay)",
    "Wikipedia, 'Longquan celadon'; 'Goryeo ware'"
  ]
},

"Jade": {
  named: "gem",
  since: { year: -4700, what: "Hongshan culture carving jade in China", approx: true },
  facets: [
    { k: "language", text: "Jade means 'flank stone'. Spaniards in the Americas called it piedra de ijada, recorded in 1565, believing it cured pains in the side and kidneys. Translated into Latin as lapis nephriticus, kidney stone, it also gave us nephrite." },
    { k: "science", text: "Jade is two different minerals. In 1863 the French mineralogist Alexis Damour showed that 'jade' could be nephrite or jadeite, which look alike but differ in chemistry." },
    { k: "culture", text: "In China jade was the imperial gem, valued above [[Gold|gold]] and carved for ritual since Neolithic cultures like Hongshan and Liangzhu. In Mesoamerica, the Olmec and Maya took all their jade from one river valley, the Motagua in Guatemala." }
  ],
  related: [
    { to: "Celadon", why: "The glaze Chinese potters made to look like jade" },
    { to: "Gold", why: "In Chinese tradition, jade outranked gold" },
    { to: "Emerald", why: "Spain met both in the Americas: jade in Mexico, emeralds in Colombia" }
  ],
  sources: [
    "Wikipedia, 'Jade' (piedra de ijada 1565; Damour 1863; Motagua valley)"
  ]
},

"Malachite": {
  named: "mineral",
  since: { year: -4000, what: "Egyptians mining malachite for green pigment", approx: true },
  facets: [
    { k: "language", text: "Malachite means mallow stone. The Greeks named it after the green leaves of the mallow plant, the same plant whose flower gave French its word [[Mauve|mauve]]." },
    { k: "history", text: "Egyptians mined malachite in the Sinai from about 4000 BCE, ground it for green eye paint and pigment, and pictured part of the afterlife as a Field of Malachite. It stayed a painter's green until about 1800. See [[malachite-pigment]]." },
    { k: "design", text: "Russia's tsars clad whole rooms in malachite from the Urals; the Malachite Room of the Winter Palace in St Petersburg is the famous one." }
  ],
  related: [
    { to: "Mauve", why: "Both named after the mallow: one its leaf, one its flower" },
    { to: "Turquoise", why: "Another copper stone the Egyptians mined in the Sinai" },
    { to: "Green", why: "One of the oldest green pigments" }
  ],
  sources: [
    "Wikipedia, 'Malachite' (molochites; Egypt c. 4000 BC; pigment until c. 1800)",
    "State Hermitage Museum, 'The Malachite Room'"
  ]
},

"Viridian": {
  named: "abstract",
  since: { year: 1838, what: "Viridian first made in Paris", approx: false },
  facets: [
    { k: "history", text: "Viridian is hydrated chromium oxide, a cool, transparent blue-green first made in Paris in 1838 by the color maker Pannetier and his assistant Binet. They kept the process secret and the paint expensive, until Charles Guignet patented a cheaper method in 1859. J. M. W. Turner was already using it by 1840. See [[viridian-pigment]]." },
    { k: "language", text: "Its name comes from Latin viridis, green, the root of French vert and English verdant." }
  ],
  related: [
    { to: "Emerald", why: "Chromium again: it tints emerald, and viridian is a chromium oxide" },
    { to: "Green", why: "A permanent green with no arsenic in it" }
  ],
  sources: [
    "Wikipedia, 'Viridian' (Pannetier and Binet 1838; Guignet 1859; Turner 1840)"
  ]
},

"Moss": {
  named: "plant",
  since: { year: 1884, what: "Moss green first used as a color name in English", approx: false },
  facets: [
    { k: "language", text: "Moss green is recorded as a color name in English from 1884." }
  ],
  related: [
    { to: "Sage", why: "Another soft grey-green named after a plant" },
    { to: "Olive", why: "Another yellowish green from the plant world" }
  ],
  sources: [
    "Wikipedia, 'Shades of green' (moss green, 1884)"
  ]
},

"Hunter green": {
  named: "abstract",
  facets: [
    { k: "culture", text: "Hunter green is the deep woodland green of traditional hunting clothes, meant to melt into the trees. Today most US states require hunters to wear blaze [[Orange|orange]] instead, so that other hunters can see them." }
  ],
  related: [
    { to: "Orange", why: "Hunters now wear blaze orange instead, to be seen by other hunters" },
    { to: "Forest green", why: "Another green named for life in the woods" }
  ],
  sources: [
    "Wikipedia, 'Safety orange' (hunter orange requirements)"
  ]
},

"Bottle green": {
  named: "material",
  facets: [
    { k: "science", text: "Old bottles are green because of iron. Ordinary sand carries traces of it, and unless glassmakers remove the iron or mask it, the glass comes out green." },
    { k: "culture", text: "Britain's motor-racing color is a deep bottle green. In 1903 the Gordon Bennett Cup was held in Ireland, because racing on public roads was illegal in Britain, and the British cars were painted shamrock green in honor of their hosts. See [[racing-colors]]." }
  ],
  related: [
    { to: "Celadon", why: "Iron again: the trace metal that tints both glass and glaze green" },
    { to: "Kelly green", why: "British racing green began as a salute to Ireland in 1903" },
    { to: "Red", why: "Racing colors: green for Britain, red for Italy" }
  ],
  sources: [
    "Wikipedia, 'British racing green' (Napier; 1903 Gordon Bennett Cup)",
    "Wikipedia, 'Glass coloring and color marking' (iron impurities)"
  ]
},

// ───────────── Purples & pinks ─────────────

"Lavender": {
  named: "flower",
  since: { year: 1705, what: "Lavender first used as a color word in English", approx: false },
  facets: [
    { k: "language", text: "Lavender is recorded as a color in English from 1705. The plant's name is often traced to Latin lavare, to wash, because lavender scented baths and linen, but that may be folk etymology: Latin lividus, bluish, is another candidate." },
    { k: "culture", text: "In Georgian, Victorian and Edwardian Britain, lavender was one of the few colors a woman could wear in half-mourning, the gentler stage after full black ([[mourning-colors]]). In the 20th century it became a queer color: the 1950s Lavender Scare drove gay workers out of the US government, and in 1969 Betty Friedan called lesbians in the women's movement a lavender menace, a label activists then took back." }
  ],
  related: [
    { to: "Grey", why: "Partners in half-mourning, the softer stage after black" },
    { to: "Lilac", why: "Another flower purple worn as mourning eased" },
    { to: "Thistle", why: "Another pale purple named after a flowering plant" }
  ],
  sources: [
    "Wikipedia, 'Lavender (color)' (first use 1705; half-mourning; Lavender Scare)",
    "Etymonline, 'lavender'"
  ]
},

"Lilac": {
  named: "flower",
  since: { year: 1775, what: "Lilac first used as a color word in English", approx: false },
  facets: [
    { k: "language", text: "Lilac probably goes back to Persian lilak, a form of nilak, bluish, from nil, indigo, and Sanskrit nila, dark blue. Indigo's old name, anil, comes from the same root and gave chemistry the word aniline, the base of the first synthetic dyes like [[mauveine]]. Lilac is recorded as a color in English from 1775." },
    { k: "poetry", text: "Walt Whitman's elegy for Abraham Lincoln, 'When Lilacs Last in the Dooryard Bloom'd' (1865), ties the flower to grief: the lilacs were in bloom that April when Lincoln was shot." },
    { k: "culture", text: "In British and European mourning customs, lilac belonged to the final stage, as black gave way to softer colors ([[mourning-colors]])." }
  ],
  related: [
    { to: "Indigo", why: "Same root: Sanskrit nila, dark blue" },
    { to: "Mauve", why: "Aniline, the base of mauve dye, is named after indigo's anil" },
    { to: "Lavender", why: "Both were worn in the last stage of mourning" }
  ],
  sources: [
    "Wikipedia, 'Lilac (color)' (first use 1775; mourning)",
    "Etymonline, 'lilac', 'aniline'",
    "Whitman, 'When Lilacs Last in the Dooryard Bloom'd' (1865)"
  ]
},

"Mauve": {
  named: "flower",
  since: { year: 1856, what: "Perkin makes mauveine, the first synthetic dye", approx: false },
  facets: [
    { k: "history", text: "In 1856, eighteen-year-old [[william-perkin|William Perkin]] tried to make quinine from coal-tar chemicals and got a black sludge. Cleaning the flask with alcohol, he saw purple. He patented the dye, opened a factory the next year, and in 1859 it was renamed mauve, French for the mallow flower. See [[mauveine]]." },
    { k: "culture", text: "Mauve mania followed. Between 1859 and 1861 fashionable Britain wore it everywhere, and Punch joked that 'the Mauve Measles' were spreading. By 1870 newer synthetic dyes had pushed it aside, but chemistry had become the new source of color." }
  ],
  related: [
    { to: "Malachite", why: "Both named after the mallow: its flower and its leaf" },
    { to: "Magenta", why: "The next aniline dye, named for a battle in 1859" },
    { to: "Purple", why: "Perkin's dye ended purple's long career as a luxury" },
    { to: "Lilac", why: "Aniline dyes take their name from indigo's anil, lilac's cousin" }
  ],
  sources: [
    "Wikipedia, 'Mauveine' (1856; Greenford works 1857; renamed 1859; Punch)",
    "Garfield, Mauve: How One Man Invented a Color That Changed the World (2000)"
  ]
},

"Plum": {
  named: "fruit",
  facets: [
    { k: "language", text: "Plum and prune are the same word. Both come from Latin prunum. English wore it down to plum for the fruit, then borrowed prune from French, where it still means a fresh plum, for the dried one." }
  ],
  related: [
    { to: "Aubergine", why: "Another dark purple from the kitchen" },
    { to: "Mulberry", why: "Another fruit-named purple" }
  ],
  sources: [
    "Etymonline, 'plum', 'prune (n.)'"
  ]
},

"Violet": {
  named: "flower",
  facets: [
    { k: "science", text: "Violet is the real end of the rainbow: light of roughly 380 to 450 nanometers, the shortest waves we can see. Just past it lies ultraviolet, named for being beyond violet. [[Purple]], by contrast, is a mix with no wavelength of its own ([[extra-spectral]])." },
    { k: "philosophy", text: "[[isaac-newton|Newton]] named seven colors in the [[spectrum]], ending with violet, partly to match the seven notes of the musical scale. That is why [[Indigo|indigo]] sits in the rainbow at all." },
    { k: "poetry", text: "[[rimbaud|Rimbaud]]'s sonnet [[voyelles|Voyelles]] gives each vowel a color: A black, E white, I red, U green, O blue. The poem ends on O, the Omega, 'the violet ray of His Eyes'. See [[synesthesia]]." }
  ],
  related: [
    { to: "Purple", why: "Violet is in the rainbow; purple has no wavelength" },
    { to: "Indigo", why: "Newton's last two rainbow colors" },
    { to: "Amethyst", why: "The violet gem the Greeks wore against drunkenness" }
  ],
  sources: [
    "Wikipedia, 'Violet (color)'",
    "Newton, Opticks (1704)",
    "Rimbaud, 'Voyelles' (1871)"
  ]
},

"Indigo": {
  named: "plant",
  facets: [
    { k: "language", text: "Indigo comes from Greek indikon, 'the Indian dye', because India supplied it to Europe. Its other old name, anil, from Arabic an-nil and Sanskrit nila, lives on in aniline, the chemical behind the first synthetic dyes, and probably in [[Lilac|lilac]]." },
    { k: "history", text: "European woad and Indian Indigofera make the same blue molecule. The trade was brutal: in 1859 Bengal's farmers rose against European planters in the Indigo Revolt, and in colonial South Carolina, indigo grown by enslaved people became the second cash crop after rice. Adolf von Baeyer synthesized indigo in 1878, and BASF's factory indigo, from 1897, undercut the plantations. See [[indigo-dye]]." },
    { k: "philosophy", text: "[[isaac-newton|Newton]] first counted five colors in his prism. In the 1670s he added orange and indigo, making seven to match the musical scale. Many people today struggle to see indigo as its own band. See [[spectrum]]." }
  ],
  related: [
    { to: "Purple", why: "Tyrian purple is indigo's molecule with two bromine atoms added" },
    { to: "Denim", why: "The dye that makes jeans blue, and lets them fade" },
    { to: "Lilac", why: "Same root: Sanskrit nila, dark blue" },
    { to: "Violet", why: "Newton's last two rainbow colors" }
  ],
  sources: [
    "Wikipedia, 'Indigo dye' (Baeyer 1878; BASF 1897; Indigo Revolt 1859; Newton, Lectiones Opticae)",
    "Balfour-Paul, Indigo: Egyptian Mummies to Blue Jeans (2011)"
  ]
},

"Thistle": {
  named: "flower",
  facets: [
    { k: "culture", text: "The thistle is Scotland's emblem. James VII founded the Order of the Thistle in 1687 with the motto Nemo me impune lacessit, no one provokes me with impunity: touch it and it stings. The order claimed to revive an ancient one, which historians doubt; the thistle as a royal badge goes back to James III's coins in the 1400s." }
  ],
  related: [
    { to: "Green", why: "The Order of the Thistle's own color is green" },
    { to: "Sky blue", why: "Ireland's Order of St Patrick chose sky blue to stand apart" },
    { to: "Lavender", why: "Another pale purple named after a plant" }
  ],
  sources: [
    "Wikipedia, 'Order of the Thistle' (1687; motto; James III)"
  ]
},

"Orchid": {
  named: "flower",
  facets: [
    { k: "language", text: "Orchid comes from Greek orkhis, testicle, after the paired round tubers on many orchids' roots." },
    { k: "design", text: "Pantone made Radiant Orchid its [[color-of-the-year|Color of the Year]] for 2014." }
  ],
  related: [
    { to: "Emerald", why: "Pantone's Color of the Year just before it, in 2013" },
    { to: "Lavender", why: "Another purple named after a flower" }
  ],
  sources: [
    "Etymonline, 'orchid'",
    "Pantone, Color of the Year 2014: Radiant Orchid 18-3224"
  ]
},

"Amethyst": {
  named: "gem",
  facets: [
    { k: "language", text: "Amethyst means 'not drunk'. The Greeks believed the stone kept its wearer sober. Anglican bishops traditionally wear amethyst rings, recalling Peter's words at Pentecost that the apostles were not drunk (Acts 2:15)." },
    { k: "science", text: "Amethyst is quartz tinted by iron and natural radiation. Heat it and the [[Violet|violet]] turns [[Yellow|yellow]]-brown, like citrine. Once ranked among the most precious gems, it lost most of its value after huge deposits were found in Brazil." }
  ],
  related: [
    { to: "Violet", why: "The gem of violet quartz" },
    { to: "Yellow", why: "Heated amethyst turns yellow and is sold as citrine" },
    { to: "Burgundy", why: "Wine and its antidote: amethyst was worn against drunkenness" }
  ],
  sources: [
    "Wikipedia, 'Amethyst' (etymology; iron and irradiation; bishops' rings; Brazil)"
  ]
},

"Puce": {
  named: "animal",
  since: { year: 1775, what: "Puce in fashion at the court of Louis XVI", approx: true },
  facets: [
    { k: "language", text: "Puce is French for flea. Couleur puce, flea color, was the fashion at the court of Louis XVI in the late 1700s and is said to have been a favorite of Marie Antoinette." }
  ],
  related: [
    { to: "Taupe", why: "Another French animal color: taupe is a mole, puce a flea" },
    { to: "Camel", why: "Another color named after an animal" }
  ],
  sources: [
    "Wikipedia, 'Puce'"
  ]
},

"Mulberry": {
  named: "fruit",
  facets: [
    { k: "poetry", text: "Ovid explains why mulberries are dark. In Book 4 of the Metamorphoses, the lovers Pyramus and Thisbe die under a white mulberry tree; his blood stains the fruit, and the gods keep it dark [[Red|red]] forever. Shakespeare's amateur players stage the story in A Midsummer Night's Dream." },
    { k: "science", text: "Silk depends on mulberries: domestic silkworms feed on the leaves of the white mulberry tree." }
  ],
  related: [
    { to: "Raspberry", why: "Another berry that named a deep pink-red" },
    { to: "Plum", why: "Another fruit-named purple" },
    { to: "Red", why: "In Ovid, blood turned the white mulberry red" }
  ],
  sources: [
    "Ovid, Metamorphoses 4.55-166; Wikipedia, 'Pyramus and Thisbe'",
    "Wikipedia, 'Morus alba'"
  ]
},

"Byzantium": {
  named: "place",
  facets: [
    { k: "history", text: "Byzantine emperors kept the finest [[tyrian-purple|purple]] for themselves, and sumptuary laws barred everyone else. Children born to a reigning emperor were porphyrogennetos, born in the purple: delivered in a palace room lined with purple porphyry stone. See [[royal-purple]]." },
    { k: "art", text: "In the mosaics of San Vitale in Ravenna, finished in 547, the emperor Justinian stands in a purple cloak on a gold ground, his courtiers around him in white." }
  ],
  related: [
    { to: "Purple", why: "The emperor's color, a Byzantine monopoly" },
    { to: "Gold", why: "Byzantine mosaics set imperial purple on gold" }
  ],
  sources: [
    "Wikipedia, 'Porphyrogennetos' (Anna Komnene's description of the Porphyra)",
    "Britannica, 'San Vitale'"
  ]
},

"Aubergine": {
  named: "food",
  facets: [
    { k: "language", text: "Aubergine came to English through French from Catalan alberginia, from Arabic badhinjan, Persian badingan and Sanskrit vatingana, with roots in the Dravidian languages of south India. Americans say eggplant, a name first recorded in 1763 for [[White|white]] varieties shaped like hen's eggs." }
  ],
  related: [
    { to: "White", why: "The first 'eggplants' in English were white, egg-shaped fruits" },
    { to: "Plum", why: "Another dark purple from the kitchen" }
  ],
  sources: [
    "Wikipedia, 'Eggplant' (etymology; 'eggplant' 1763)"
  ]
},

// ───────────── Yellows & browns ─────────────

"Gold": {
  named: "metal",
  facets: [
    { k: "art", text: "Gustav Klimt's [[painting-the-kiss|The Kiss]] is oil paint and real gold leaf. Klimt, the son of a gold engraver, painted it at the height of his golden phase, after the gold-ground Byzantine mosaics he saw in Ravenna in 1903." },
    { k: "symbolism", text: "In medieval icons and altarpieces, gold leaf stood for heavenly light rather than for a color. [[alchemy|Alchemists]] chased gold as the perfect metal and wrote it with the sun's sign, a circle with a dot. [[heraldry|Heraldry]] calls gold or and lets it stand in for [[Yellow|yellow]]." },
    { k: "culture", text: "Olympic gold medals haven't been solid gold since 1912. Today's are silver, plated with at least six grams of gold." }
  ],
  related: [
    { to: "Byzantium", why: "Klimt's gold was inspired by the mosaics of Ravenna" },
    { to: "Silver", why: "Alchemy's sun and moon; heraldry's two metals" },
    { to: "Yellow", why: "Same root, *ghel-; heraldry treats them as one" },
    { to: "Azure", why: "Gold lilies on azure: the arms of the French kings" },
    { to: "Amber", why: "The Amber Room: fossil resin panels backed with gold leaf" }
  ],
  sources: [
    "Belvedere, Vienna, 'The Kiss' (oil and gold leaf on canvas)",
    "Britannica, 'Gustav Klimt'",
    "International Olympic Committee, 'Are Olympic gold medals made of gold?'"
  ]
},

"Mustard": {
  named: "food",
  facets: [
    { k: "language", text: "Mustard is named after grape juice. French moustarde comes from Latin mustum, must, the fresh grape juice that was mixed with ground seeds to make the paste." }
  ],
  related: [
    { to: "Burgundy", why: "Dijon mustard and Burgundy wine come from the same French region" },
    { to: "Ochre", why: "An earthy yellow close to painters' yellow ochre" }
  ],
  sources: [
    "Etymonline, 'mustard'"
  ]
},

"Khaki": {
  named: "nature",
  since: { year: 1848, what: "Khaki uniforms made official for the Corps of Guides", approx: false },
  facets: [
    { k: "language", text: "Khaki means dusty, or soil-colored. The word is Hindustani, from Persian khak, soil, and came into English through the British Indian Army." },
    { k: "history", text: "The Corps of Guides, raised in British India in 1846, was the first unit to wear it, and khaki became their official uniform in 1848. British troops fought in khaki in Abyssinia in 1868, and after the Boer War of 1899 to 1902 the army standardized it, ending the age of the [[Scarlet|scarlet]] coat in battle." }
  ],
  related: [
    { to: "Scarlet", why: "Khaki ended the British army's red coats in the field" },
    { to: "Olive", why: "The two great military colors: khaki drill and olive drab" },
    { to: "Navy", why: "Another color civilians borrowed from a British uniform" }
  ],
  sources: [
    "Wikipedia, 'Khaki' (Corps of Guides 1846; uniform 1848; Abyssinia 1868)"
  ]
},

"Tan": {
  named: "material",
  facets: [
    { k: "language", text: "Tan comes from tanning: soaking hides in oak bark, whose tannins turn skin into leather and stain it [[Brown|brown]]. Tan and tannin share the root." },
    { k: "culture", text: "Fashionable Europeans long avoided the sun. In the 1920s suntans came into style, and Coco Chanel usually gets the credit." }
  ],
  related: [
    { to: "Camel", why: "Another warm brown named after what coats are made of" },
    { to: "Sepia", why: "Another brown named after the substance that made it" }
  ],
  sources: [
    "Etymonline, 'tan', 'tannin'"
  ]
},

"Rust": {
  named: "material",
  facets: [
    { k: "science", text: "Rust is iron oxide, the same family of compounds that colors red [[Ochre|ochre]], [[Sienna|sienna]] and bricks. Mars is red for the same reason: its dust is rich in iron oxide." },
    { k: "design", text: "Some steel is meant to rust. Weathering steel grows a tight skin of rust that protects the metal underneath, which is why Richard Serra built his sculptures from it and Antony Gormley used it for the Angel of the North." }
  ],
  related: [
    { to: "Ochre", why: "Both are iron oxides: one grown on metal, one dug from the earth" },
    { to: "Brick", why: "Both owe their red to iron oxide" },
    { to: "Sienna", why: "Burnt sienna is iron oxide too, reddened by heat" }
  ],
  sources: [
    "NASA, 'Mars: the red planet' (iron oxide dust)",
    "Wikipedia, 'Weathering steel' (Serra; Angel of the North)"
  ]
},

"Chocolate": {
  named: "food",
  facets: [
    { k: "language", text: "Chocolate came into English through Spanish from Nahuatl, the language of the Aztecs. The popular story derives it from xocolatl, bitter water, but linguists dispute that, and the true source word is unsettled." }
  ],
  related: [
    { to: "Carmine", why: "Two gifts of Aztec Mexico to Europe: cacao and cochineal" },
    { to: "Maroon", why: "Two browns named after foods: cacao and chestnut" }
  ],
  sources: [
    "Etymonline, 'chocolate'"
  ]
},

// ───────────── Whites & greys ─────────────

"Ivory": {
  named: "material",
  facets: [
    { k: "history", text: "Ivory black, a deep warm [[Black|black]], was made by charring ivory scraps; the paint sold under that name today is made from bone. In 1989 the CITES treaty voted to ban the international commercial ivory trade to protect elephants." },
    { k: "poetry", text: "The Song of Songs praises a neck like a tower of ivory. The ivory tower as a place of lofty seclusion comes from an 1837 poem by the French critic Sainte-Beuve." }
  ],
  related: [
    { to: "Black", why: "Charred ivory made ivory black, a painter's warm black" },
    { to: "White", why: "The warm white named after elephant tusk" },
    { to: "Cream", why: "Its yellower neighbor, named after milk" }
  ],
  sources: [
    "Wikipedia, 'Bone char' (ivory black)",
    "CITES, 'Elephants' (1989 Appendix I listing)",
    "Etymonline, 'ivory tower'"
  ]
},

"Cream": {
  named: "food",
  facets: [
    { k: "design", text: "In the 1760s Josiah Wedgwood perfected a cream-colored earthenware and supplied it to Queen Charlotte, which let him sell it as Queen's ware. Creamware was cheaper than porcelain and filled tables across Europe: by the 1780s Wedgwood shipped most of his output abroad, including the vast Frog Service for Catherine the Great." }
  ],
  related: [
    { to: "Royal blue", why: "Queen Charlotte again: her name is on both stories" },
    { to: "Ivory", why: "Its whiter neighbor, named after tusk" },
    { to: "Ecru", why: "Another pale color named after a natural material" }
  ],
  sources: [
    "Wikipedia, 'Creamware' (Wedgwood; Queen's ware; Frog Service)",
    "V&A, 'Wedgwood creamware'"
  ]
},

"Beige": {
  named: "material",
  since: { year: 1887, what: "Beige first used as a color word in English", approx: false },
  facets: [
    { k: "language", text: "Beige is French for natural wool, neither bleached nor dyed, as [[Ecru|ecru]] is for linen. The word spread in France around 1855 to 1860 and is recorded as a color in English from 1887." },
    { k: "design", text: "From the 1970s to the 1990s, beige was the color of computers: keyboards, monitors and towers, a look Apple and IBM popularized and German office rules helped lock in." }
  ],
  related: [
    { to: "Ecru", why: "Both mean undyed: beige wool, ecru linen" },
    { to: "Taupe", why: "Another French word English borrowed for a neutral" }
  ],
  sources: [
    "Wikipedia, 'Beige' (first English use 1887; computers)"
  ]
},

"Taupe": {
  named: "animal",
  since: { year: 1846, what: "Taupe listed among fashionable greys in English", approx: false },
  facets: [
    { k: "language", text: "Taupe is French for mole, from Latin talpa. It first meant the [[Grey|grey]]-[[Brown|brown]] of a mole's fur; an English fashion note of 1846 lists it among the fashionable greys. Since the 1940s it has stretched to cover almost any greyish brown, and no one agrees on a single taupe." }
  ],
  related: [
    { to: "Puce", why: "Another French animal color: taupe is a mole, puce a flea" },
    { to: "Teal", why: "Another color named after an animal" }
  ],
  sources: [
    "Wikipedia, 'Taupe' (OED first citation 1911; earlier use 1846)"
  ]
},

"Silver": {
  named: "metal",
  facets: [
    { k: "science", text: "Photography began with silver. Silver salts darken in light, and Louis Daguerre's process of 1839 fixed images on silver-plated copper. Black-and-white film and prints are made of tiny grains of silver." },
    { k: "art", text: "Before pencils, artists drew with silver. Silverpoint, a silver wire dragged over prepared paper, leaves fine grey lines that tarnish to warm brown over months. Albrecht Dürer drew his self-portrait in silverpoint at 13." },
    { k: "symbolism", text: "[[heraldry|Heraldry]] calls silver argent and paints it white. [[alchemy|Alchemy]] ties silver to the moon, as it ties [[Gold|gold]] to the sun." }
  ],
  related: [
    { to: "Gold", why: "Alchemy's moon and sun; heraldry's two metals" },
    { to: "White", why: "Heraldry paints silver as white: argent" },
    { to: "Sepia", why: "Sepia toning turns a photo's silver into brown silver sulfide" }
  ],
  sources: [
    "Wikipedia, 'Silverpoint' (tarnish; Dürer)",
    "Britannica, 'Daguerreotype'"
  ]
},

"Slate": {
  named: "mineral",
  facets: [
    { k: "science", text: "Slate is mudstone squeezed by heat and pressure until it splits into thin, flat sheets, perfect for roofs. Schoolchildren once wrote on handheld slates and wiped them clean, which is where a clean slate comes from." }
  ],
  related: [
    { to: "Charcoal", why: "Two greys named after things you could write or draw with" },
    { to: "Gunmetal", why: "Another grey named after a hard material" }
  ],
  sources: [
    "Britannica, 'Slate'",
    "Etymonline, 'slate'"
  ]
},

"Charcoal": {
  named: "material",
  facets: [
    { k: "history", text: "Charcoal is the oldest drawing tool and the first [[Black|black]]. Artists at Chauvet Cave in France drew with it more than 30,000 years ago, and artists still use sticks of charred willow and vine for quick, smudgy sketches." }
  ],
  related: [
    { to: "Black", why: "Charcoal drew the first black lines in caves" },
    { to: "Ash", why: "What burning leaves behind: charcoal if starved of air, ash if not" },
    { to: "Slate", why: "Two greys named after things you could write or draw with" }
  ],
  sources: [
    "Bradshaw Foundation, 'Chauvet Cave'",
    "Wikipedia, 'Charcoal (art)'"
  ]
},

// ───────────── Oranges & yellows ─────────────

"Peach": {
  named: "fruit",
  facets: [
    { k: "language", text: "Peach means Persian. The Romans called it malum persicum, Persian apple, and the word wore down to peach. But the fruit comes from China, where it was domesticated around 6000 BCE in the Yangtze valley." },
    { k: "design", text: "Pantone named Peach Fuzz its [[color-of-the-year|Color of the Year]] for 2024." }
  ],
  related: [
    { to: "Apricot", why: "The early-ripening cousin of the 'Persian apple'" },
    { to: "Pistachio", why: "Another food that carries Persia in its name" },
    { to: "Coral", why: "Another Pantone Color of the Year, 2019's Living Coral" }
  ],
  sources: [
    "Wikipedia, 'Peach' (persicum; Kuahuqiao, c. 6000 BCE)",
    "Pantone, Color of the Year 2024: Peach Fuzz 13-1023"
  ]
},

"Apricot": {
  named: "fruit",
  facets: [
    { k: "language", text: "Apricot and precocious share a root. Latin praecoquum meant early-ripening, because apricots ripen before [[Peach|peaches]]. The word passed into Greek, then Arabic as al-barquq, then Spanish and French, and reached English in the 1500s as abrecock." }
  ],
  related: [
    { to: "Peach", why: "The early-ripening cousin of the 'Persian apple'" },
    { to: "Aubergine", why: "Another food word that reached English through Arabic and Spanish" }
  ],
  sources: [
    "Wikipedia, 'Apricot' (etymology)",
    "Etymonline, 'apricot', 'precocious'"
  ]
},

"Tangerine": {
  named: "fruit",
  facets: [
    { k: "language", text: "Tangerine means 'of Tangier', the Moroccan port that shipped the fruit, a kind of mandarin. The word appears in 1710 for a native of Tangier; the fruit has been called a tangerine since the 1840s." },
    { k: "design", text: "Pantone named Tangerine Tango its [[color-of-the-year|Color of the Year]] for 2012." }
  ],
  related: [
    { to: "Orange", why: "Another color named after a citrus fruit" },
    { to: "Magenta", why: "Another color named, indirectly, after a place" }
  ],
  sources: [
    "Wikipedia, 'Tangerine' (Tangier; OED 1710)",
    "Pantone, Color of the Year 2012: Tangerine Tango 17-1463"
  ]
},

"Burnt orange": {
  named: "abstract",
  since: { year: 1915, what: "Burnt orange first used as a color name in English", approx: false },
  facets: [
    { k: "language", text: "Burnt orange has been a color name since 1915. It is a school color of the University of Texas at Austin, Auburn and Virginia Tech." }
  ],
  related: [
    { to: "Sienna", why: "Burnt sienna: heat makes earth pigments darker and redder" },
    { to: "Umber", why: "Painters' other 'burnt' color" }
  ],
  sources: [
    "Wikipedia, 'Burnt orange' (since 1915)"
  ]
},

"Ochre": {
  named: "mineral",
  since: { year: -75000, what: "Engraved ochre at Blombos Cave, South Africa", approx: true },
  facets: [
    { k: "history", text: "Ochre is the oldest paint there is. Evidence from Africa suggests people were processing it some 300,000 years ago. At Blombos Cave someone engraved a crosshatch on a piece of it about 75,000 years ago, and at Lascaux a horse was painted in yellow ochre about 17,300 years ago. See [[earth-pigments]]." },
    { k: "science", text: "Ochre is earth colored by iron. Yellow ochre owes its color to goethite. Heat it, the goethite turns to hematite, and the yellow becomes red, so early painters could get both colors from one earth." },
    { k: "culture", text: "Australia has over 400 recorded ochre pits and quarries, and prized red ochre traveled across the continent along the songlines, the Aboriginal routes of trade and story." },
    { k: "language", text: "The name comes from Greek ochra, from ochros, pale." }
  ],
  related: [
    { to: "Red", why: "Red ochre was humanity's first red" },
    { to: "Sienna", why: "Another iron earth; heat reddens both" },
    { to: "Umber", why: "The earth pigment trio: ochre, sienna, umber" },
    { to: "Rust", why: "Both are iron oxides" }
  ],
  sources: [
    "Wikipedia, 'Ochre' (Blombos c. 75,000 years; Lascaux 17,300 years; goethite to hematite)",
    "Henshilwood et al., 'Emergence of modern human behavior', Science 295 (2002)"
  ]
},

"Marigold": {
  named: "flower",
  facets: [
    { k: "language", text: "Marigold means Mary's [[Gold|gold]]. The name first belonged to the pot marigold, Calendula, and honored the Virgin Mary." },
    { k: "culture", text: "In Mexico, Tagetes erecta is cempasúchil, from the Nahuatl for twenty flower, and its orange blooms are the flower of the dead, heaped on altars and graves for the Day of the Dead. The Aztecs grew it for medicine and ceremony." }
  ],
  related: [
    { to: "Gold", why: "Marigold is 'Mary's gold'" },
    { to: "Blue", why: "The Virgin's other color, the blue of her mantle" },
    { to: "Orange", why: "The orange flower of Mexico's Day of the Dead" }
  ],
  sources: [
    "Wikipedia, 'Tagetes erecta' (cempasúchil; Day of the Dead; 'Mary's gold')"
  ]
},

"Amber": {
  named: "gem",
  facets: [
    { k: "language", text: "Amber gave us electricity. The Greek word for amber was elektron. Rubbed amber attracts dust and straw, and in 1600 William Gilbert coined the Latin electricus, amber-like, for that force." },
    { k: "history", text: "Amber is fossilized tree resin. Prussia built a whole room of it, backed with [[Gold|gold]] leaf, and gave it to Peter the Great in 1716. German troops took the Amber Room from the Catherine Palace in 1941; it vanished after 1945, and a reconstruction opened in 2003." },
    { k: "culture", text: "On British traffic lights, the middle light is amber; Americans call it [[Yellow|yellow]]." }
  ],
  related: [
    { to: "Gold", why: "The Amber Room's panels were backed with gold leaf" },
    { to: "Yellow", why: "Traffic lights: Britain's amber is America's yellow" }
  ],
  sources: [
    "Wikipedia, 'Amber' (elektron; Gilbert, De Magnete, 1600)",
    "Wikipedia, 'Amber Room' (1716 gift; looted 14 October 1941; rebuilt 2003)"
  ]
},

"Canary": {
  named: "animal",
  facets: [
    { k: "language", text: "The canary is named after the islands, not the other way round. The Romans called them Canariae Insulae, islands of dogs; Pliny reports huge dogs there. Wild canaries are a streaky [[Yellow|yellow]]-[[Green|green]]; the clear canary yellow came from breeding." },
    { k: "history", text: "British coal miners carried canaries underground from around 1900 as an early warning: the birds succumbed to carbon monoxide before people did. Electronic detectors replaced them in 1986." }
  ],
  related: [
    { to: "Teal", why: "Another color named after a bird" },
    { to: "Yellow", why: "A yellow bred into the bird, not born wild" }
  ],
  sources: [
    "Wikipedia, 'Canary Islands' (Canariae Insulae; Pliny)",
    "Wikipedia, 'Domestic canary' (coal mines, c. 1900 to 1986)"
  ]
},

// ───────────── Earths & greys ─────────────

"Ecru": {
  named: "material",
  facets: [
    { k: "language", text: "Ecru is French for raw: écru, from Latin crudus, the root of crude. It names linen and silk left unbleached, in their natural state." }
  ],
  related: [
    { to: "Beige", why: "Both mean undyed: ecru linen, beige wool" },
    { to: "Cerise", why: "Another French word English kept as a color" }
  ],
  sources: [
    "Etymonline, 'ecru'"
  ]
},

"Camel": {
  named: "animal",
  facets: [
    { k: "design", text: "Camel hair, gathered from Bactrian camels as they shed, makes soft, warm coat cloth. Max Mara's 101801 coat, designed by Anne-Marie Beretta in 1981 in camel-colored wool and cashmere, became the label's icon." }
  ],
  related: [
    { to: "Tan", why: "Another warm brown named after what coats are made of" },
    { to: "Taupe", why: "Another color named after an animal" }
  ],
  sources: [
    "Wikipedia, 'Max Mara' (101801 coat, 1981)",
    "Wikipedia, 'Camel hair'"
  ]
},

"Terracotta": {
  named: "material",
  facets: [
    { k: "language", text: "Terracotta is Italian for baked earth: clay fired hard, from flowerpots and roof tiles to statues." },
    { k: "art", text: "China's Terracotta Army, buried with the first emperor, Qin Shi Huang, in 210 to 209 BCE, was once brightly painted: cinnabar [[Vermilion|red]], [[Malachite|malachite]] green, azurite blue and Han [[Purple|purple]], a rare synthetic. When a figure is unearthed, the lacquer under the paint can curl in fifteen seconds and flake off in four minutes." }
  ],
  related: [
    { to: "Brick", why: "Both are fired clay, reddened by iron" },
    { to: "Vermilion", why: "The Terracotta Army was painted with cinnabar red" },
    { to: "Malachite", why: "Ground malachite painted the soldiers' greens" }
  ],
  sources: [
    "Wikipedia, 'Terracotta Army' (210-209 BCE; pigments; lacquer loss)"
  ]
},

"Sienna": {
  named: "place",
  since: { year: 1760, what: "Sienna first used as a color name in English", approx: false },
  facets: [
    { k: "history", text: "Sienna is earth from Tuscany, dug on Monte Amiata in lands once ruled by the city of Siena. Raw sienna is a yellow-brown iron earth; roast it, the iron turns to hematite, and you get red-brown burnt sienna. Renaissance painters made it standard, and the Italian deposits were largely worked out by the 1940s. See [[earth-pigments]]." },
    { k: "language", text: "Sienna is recorded as a color name in English from 1760, and burnt sienna from 1853." }
  ],
  related: [
    { to: "Umber", why: "Its darker partner in every painter's box of earths" },
    { to: "Ochre", why: "Iron earths: heat turns yellow ochre red and raw sienna burnt" },
    { to: "Burnt orange", why: "Another color 'burnt' darker and redder" }
  ],
  sources: [
    "Wikipedia, 'Sienna' (Monte Amiata; first use 1760; burnt sienna 1853)"
  ]
},

"Sepia": {
  named: "animal",
  facets: [
    { k: "history", text: "Sepia is cuttlefish ink: sepia is the Greek and Latin word for cuttlefish. It was a writing ink in Greco-Roman times, and in the late 1700s a Dresden professor, Jakob Seydelmann, refined it into a concentrated paint for artists." },
    { k: "science", text: "Old brown photographs owe nothing to cuttlefish. Sepia toning converts the [[Silver|silver]] of a black-and-white print into silver sulfide, which stands up to air pollution far better, so toned prints last longer. The warm brown was a side effect of preservation." }
  ],
  related: [
    { to: "Silver", why: "Sepia photos are silver images turned to silver sulfide" },
    { to: "Umber", why: "Painters' brown from the earth, as sepia was brown from the sea" },
    { to: "Charcoal", why: "Two classic drawing materials that named colors" }
  ],
  sources: [
    "Wikipedia, 'Sepia (color)' (cuttlefish; Seydelmann)",
    "Wikipedia, 'Sepia toning' (silver sulfide; archival stability)"
  ]
},

"Umber": {
  named: "mineral",
  since: { year: 1650, what: "Burnt umber first used as a color name in English", approx: false },
  facets: [
    { k: "language", text: "No one is sure where umber's name comes from. It may be terra d'ombra, earth of Umbria in Italy, or Latin umbra, shadow, which suits a pigment painters reach for in the shadows." },
    { k: "history", text: "Umber is an iron earth rich in manganese oxide, which makes it darker than [[Ochre|ochre]] and [[Sienna|sienna]] and helps oil paint dry fast. Most of it comes from Cyprus. Roasted, it becomes burnt umber, a color name in English since 1650. See [[earth-pigments]]." }
  ],
  related: [
    { to: "Sienna", why: "Its lighter partner in every painter's box of earths" },
    { to: "Ochre", why: "The earth pigment trio: ochre, sienna, umber" },
    { to: "Sepia", why: "Brown from the earth versus brown from the sea" }
  ],
  sources: [
    "Wikipedia, 'Umber' (manganese; Cyprus; burnt umber 1650)"
  ]
},

"Mahogany": {
  named: "plant",
  facets: [
    { k: "history", text: "Mahogany first appears in English in 1670, from a source no one has pinned down, possibly Caribbean or West African. After Britain dropped duties on colonial timber in 1721, imports soared, from 525 tons in 1740 to over 30,000 in 1788, and it became the wood of Georgian furniture. Overlogging followed, and bigleaf mahogany came under CITES trade controls in 2003." }
  ],
  related: [
    { to: "Maroon", why: "Both browns named after trees: mahogany and chestnut" },
    { to: "Chocolate", why: "Another brown that crossed the Atlantic in colonial trade" }
  ],
  sources: [
    "Wikipedia, 'Mahogany' (Ogilby 1670; Naval Stores Act 1721; CITES 2003)"
  ]
},

"Ash": {
  named: "material",
  facets: [
    { k: "symbolism", text: "On Ash Wednesday, the first day of Lent, many Western Christians are marked with ash made by burning the palms from the previous year's Palm Sunday. The traditional words come from Genesis: 'Remember that you are dust, and to dust you shall return.' See [[liturgical-colors]]." }
  ],
  related: [
    { to: "Charcoal", why: "What burning leaves behind: ash if fully burned, charcoal if not" },
    { to: "Purple", why: "Lent begins with ashes, and the Church wears violet through it" }
  ],
  sources: [
    "Wikipedia, 'Ash Wednesday' (palms; formula; Urban II, 1091)",
    "Genesis 3:19"
  ]
},

"Gunmetal": {
  named: "metal",
  facets: [
    { k: "history", text: "Gunmetal is a bronze, about 88 percent copper with tin and zinc, first used mainly for guns and long since replaced by steel. Freshly cast it is [[Gold|golden]], not [[Grey|grey]]; the color name matches the darker look of old metal and steel gun barrels." }
  ],
  related: [
    { to: "Steel blue", why: "Another color named after worked metal" },
    { to: "Gold", why: "Fresh gunmetal bronze is golden, not grey" }
  ],
  sources: [
    "Wikipedia, 'Gunmetal' (88% copper, 8-10% tin, 2-4% zinc)"
  ]
}

};
