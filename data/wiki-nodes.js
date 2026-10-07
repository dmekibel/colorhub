// ColorHub wiki: concept, tradition, culture, movement, pigment, person and work pages.
// One page per id in data/wiki-seed.js (nodes). Painting pages live in data/paintings.js.
// Links: [[Color name]] or [[seed-id|shown text]]. Gate: node tools/check_wiki.js
// Hex values in swatches are screen approximations.
window.WIKI_NODES = [

// ---------------------------------------------------------------- concepts
{
  id: "basic-color-terms", type: "concept", title: "Basic color terms",
  dek: "English has 11 everyday color words. Some languages have two. The order they arrive in is surprisingly fixed.",
  body: [
    "A basic color term is a short, everyday color word that every speaker knows and that isn't a kind of some other color. English has eleven: [[Black]], [[White]], [[Red]], [[Green]], [[Yellow]], [[Blue]], [[Brown]], [[Purple]], [[Pink]], [[Orange]] and [[Grey]]. [[Crimson]] doesn't count, because crimson is a kind of red. Neither does [[Teal]], because plenty of speakers never use it.",
    "In 1969 [[berlin-and-kay|Brent Berlin and Paul Kay]] compared color words across 98 languages, testing speakers of 20 of them on a grid of Munsell color chips. They claimed languages gain basic terms in a fixed order. With only two words, a language splits dark from light. A third word is always red. Next comes green or yellow, then [[Blue|blue]], then brown, and last purple, pink, orange and grey.",
    "That sequence explains an old puzzle. [[homer|Homer]] never calls the sea blue, and blue words arrive late in many languages. It doesn't mean people couldn't see blue. Their eyes were like ours; they just didn't have a separate everyday word for it. One popular idea is that blue words wait for blue dyes and paints like [[egyptian-blue|Egyptian blue]] and [[indigo-dye|indigo]], since little in nature is reliably blue besides the sky. It's a hypothesis, not a proven rule.",
    "The theory has critics, and it has been revised. The World Color Survey, which gathered color names from 110 unwritten languages, kept the broad pattern but loosened the strict stages. Some languages carve color in ways the scheme doesn't predict. Russian, for one, has two basic blues, which is where the debate over [[linguistic-relativity|whether words change what we see]] gets its best evidence."
  ],
  colors: ["Black", "White", "Red", "Green", "Yellow", "Blue", "Brown", "Purple"],
  swatches: [
    { h: "#16171A", label: "Dark · stage I" },
    { h: "#F7F6F2", label: "Light · stage I" },
    { h: "#D62F2F", label: "Red · stage II" },
    { h: "#2E9A4F", label: "Green · stage III–IV" },
    { h: "#F2C81F", label: "Yellow · stage III–IV" },
    { h: "#2563C9", label: "Blue · stage V" },
    { h: "#7A5230", label: "Brown · stage VI" },
    { h: "#7B3FA0", label: "Purple, pink, orange, grey · stage VII" }
  ],
  facts: [
    { label: "Basic terms in English", value: "11" },
    { label: "Key study", value: "Berlin and Kay, 1969" },
    { label: "Follow-up", value: "World Color Survey, 110 languages" }
  ],
  sources: [
    "Berlin, B. & Kay, P. (1969). Basic Color Terms: Their Universality and Evolution. University of California Press.",
    "Kay, P., Berlin, B., Maffi, L., Merrifield, W. R. & Cook, R. (2009). The World Color Survey. CSLI Publications.",
    "Hardin, C. L. 'Berlin and Kay Theory', Encyclopedia of Color Science and Technology (Springer)."
  ]
},
{
  id: "linguistic-relativity", type: "concept", title: "Do words change what we see?",
  dek: "Russian has two words for blue. Do its speakers tell those blues apart faster? Maybe, a little.",
  body: [
    "Linguistic relativity is the idea that the language you speak shapes how you think. Its strong form, that words decide what you can see, is wrong: people without a word for [[Blue|blue]] still see blue. The live question is the weak form. Do color words nudge perception at the edges?",
    "The best evidence comes from blues. Russian has no single everyday word for blue. Light blues are goluboy and dark blues are siniy, as separate as [[Pink|pink]] and [[Red|red]] are in English. In a 2007 study, Jonathan Winawer and colleagues showed Russian speakers three blue squares and asked which two matched. They were faster when the two blues fell on opposite sides of the goluboy/siniy line. English speakers showed no such edge.",
    "Two details make the result convincing and keep it honest. The advantage vanished when Russian speakers silently rehearsed a string of digits, which ties up the verbal system, but not during a spatial task. So the word helps live, in the moment. And the effect is modest: a small speed gain, largest on hard comparisons. A careful 2020 repeat of the experiment found no speed advantage at the goluboy/siniy line at all, so the effect may be smaller or less reliable than first reported. It isn't a different visual world: the eyes themselves ([[trichromacy|how eyes see color]]) work the same in every language.",
    "That's the bet behind learning more [[basic-color-terms|color names]]: a word like [[Teal]] or [[Periwinkle]] gives you a handle, and practice with feedback sharpens the eye. You may have seen a viral TV clip about a tribe that 'couldn't see blue'. It was misreported, so skip it. The real research, from [[berlin-and-kay|Berlin and Kay]] onward, is quieter and more interesting."
  ],
  colors: ["Sky blue", "Cobalt"],
  swatches: [
    { h: "#87CEEB", label: "Goluboy · light blue" },
    { h: "#2B4C9E", label: "Siniy · dark blue" }
  ],
  facts: [
    { label: "Key study", value: "Winawer et al., PNAS, 2007" },
    { label: "Effect size", value: "Real but modest" }
  ],
  sources: [
    "Winawer, J. et al. (2007). Russian blues reveal effects of language on color discrimination. PNAS 104(19): 7780–7785.",
    "Regier, T. & Kay, P. (2009). Language, thought, and color: Whorf was half right. Trends in Cognitive Sciences 13(10): 439–446.",
    "Deutscher, G. (2010). Through the Language Glass. Metropolitan Books."
  ]
},
{
  id: "color-wheel", type: "concept", title: "The color wheel",
  dek: "Bend the rainbow into a circle and you get the most useful diagram in color.",
  body: [
    "A color wheel bends the [[spectrum|rainbow]] into a loop, so [[Red|red]] at one end meets [[Violet|violet]] at the other, joined by purples the rainbow doesn't contain. [[isaac-newton|Isaac Newton]] drew one of the first color circles in his [[opticks|Opticks]] (1704), sizing its seven slices to match the intervals of a musical scale.",
    "Painters wanted a wheel for mixing paint, not light. Around 1766 the English engraver Moses Harris printed a wheel built on three 'principal' colors, red, yellow and blue, with orange, green and purple mixed between. That red-yellow-blue wheel is still the one in art classrooms. [[goethe|Goethe]] drew his own in his [[theory-of-colours|Theory of Colours]], and [[johannes-itten|Johannes Itten]], who taught at the [[bauhaus|Bauhaus]], popularized the 12-part wheel many painters learn today.",
    "The red-yellow-blue wheel is a tradition more than a measurement. It spaces red, yellow and blue evenly, though to the eye red and yellow are much closer, and no mix of those three paints gives a clean [[Magenta|magenta]] or cyan. Screens mix light from red, green and blue, so on a screen's wheel the opposite of red is a cyan like [[Aqua|aqua]], not green. Printers build theirs on cyan, magenta and yellow ink. Each wheel suits its own job: light, ink or paint.",
    "A wheel earns its place in three ways: it helps predict what a mix will give, it maps how hues relate, and it turns [[color-harmony|harmony]] ideas into geometry, with neighbors, opposites and triangles. Just remember that which colors count as [[complementary-colors|opposites]] changes from wheel to wheel, and that a flat wheel leaves out lightness, the dimension that matters most (see [[value|value]])."
  ],
  colors: ["Red", "Orange", "Yellow", "Green", "Blue", "Purple"],
  swatches: [
    { h: "#D62F2F", label: "Red · RYB 'primary' (tradition)" },
    { h: "#F07A1A", label: "Orange · RYB secondary" },
    { h: "#F2C81F", label: "Yellow · RYB 'primary' (tradition)" },
    { h: "#2E9A4F", label: "Green · RYB secondary" },
    { h: "#2563C9", label: "Blue · RYB 'primary' (tradition)" },
    { h: "#7B3FA0", label: "Purple · RYB secondary" }
  ],
  facts: [
    { label: "Early color circle", value: "Newton, Opticks, 1704" },
    { label: "Red-yellow-blue wheel", value: "Moses Harris, c. 1766" }
  ],
  sources: [
    "Newton, I. (1704). Opticks. Book I, Part II.",
    "Harris, M. (c. 1766). The Natural System of Colours. Royal Academy of Arts collection.",
    "Gage, J. (1993). Colour and Culture. Thames & Hudson."
  ]
},
{
  id: "complementary-colors", type: "concept", title: "Complementary colors",
  dek: "Every color has an opposite, but which one depends on the map: the painter's wheel, light, or your eye.",
  body: [
    "Complementary colors are pairs that sit opposite each other, but opposite on which map? There are three common answers, and they disagree. On the painter's red-yellow-blue [[color-wheel|wheel]], the pairs are red–green, blue–orange and yellow–violet. In light, and in the afterimages your eye makes, they are red–cyan, green–magenta and blue–yellow. On perceptual maps like CIELAB, built so equal distances look equally different, the hue opposite a [[Red|red]] is a blue-green close to [[Teal|teal]].",
    "You can test the eye's version yourself. Stare at a red dot for thirty seconds, then look at a white page, and a blue-green ghost floats there: cyan-ish, not the plain green of the painter's wheel. The cells that were busy reporting red tire, so the balance tips the other way. Deeper in the visual system, color is coded as opponent pairs, red against green and blue against yellow, as Ewald Hering proposed in 1878, which is why no one sees a 'reddish green' (see [[trichromacy|how eyes see color]]).",
    "Side by side, opposites make each other look stronger, and painters have leaned on that for two centuries. [[chevreul|Chevreul]] made it part of his law of [[simultaneous-contrast|simultaneous contrast]] in 1839. The [[impressionism|Impressionists]] set orange light against blue-violet shadows, and [[van-gogh|Van Gogh]], thinking in painter's-wheel pairs, said that in his Night Café he tried to show “the terrible passions of humanity by means of red and green.”",
    "Mixed, opposites cancel. Two opposite lights add up to white or grey. Two opposite paints dull each other toward a neutral grey, brown or near-black, depending on the paints. Seurat set complementary dots side by side across [[painting-grande-jatte|A Sunday on La Grande Jatte]] instead of mixing them. Designers use complements for pop, like a [[Tangerine|tangerine]] button on a [[Navy|navy]] page; one complement as an accent usually beats a fifty-fifty split."
  ],
  colors: ["Red", "Green", "Blue", "Orange", "Red", "Aqua", "Green", "Magenta", "Red", "Teal"],
  swatches: [
    { h: "#D62F2F", label: "Painter's wheel · red" },
    { h: "#2E9A4F", label: "Painter's wheel · its opposite, green" },
    { h: "#2563C9", label: "Painter's wheel · blue" },
    { h: "#F07A1A", label: "Painter's wheel · its opposite, orange" },
    { h: "#D62F2F", label: "Light and afterimage · red" },
    { h: "#00FFFF", label: "Light and afterimage · its opposite, cyan" },
    { h: "#2E9A4F", label: "Light and afterimage · green" },
    { h: "#FF00FF", label: "Light and afterimage · its opposite, magenta" },
    { h: "#D62F2F", label: "CIELAB · red" },
    { h: "#1D919F", label: "CIELAB · its opposite, blue-green" }
  ],
  facts: [
    { label: "Painter's wheel (RYB)", value: "Red–green, blue–orange, yellow–violet" },
    { label: "Light and afterimages", value: "Red–cyan, green–magenta, blue–yellow" },
    { label: "Opponent axes (Hering, CIELAB)", value: "Red–green, yellow–blue" }
  ],
  sources: [
    "Chevreul, M. E. (1839). De la loi du contraste simultané des couleurs. Paris.",
    "Van Gogh, V. Letter to Theo, 8 September 1888. Van Gogh Museum, vangoghletters.org.",
    "Hering, E. (1878). Zur Lehre vom Lichtsinne. Vienna.",
    "Fairchild, M. D. (2013). Color Appearance Models, 3rd ed. Wiley."
  ]
},
{
  id: "color-harmony", type: "concept", title: "Color harmony",
  dek: "Why do colors look good together? Old rules say geometry. Lab studies say similar hues, different lightness.",
  body: [
    "Color harmony is the sense that colors belong together. For centuries it was taught as geometry on the [[color-wheel|color wheel]]: neighbors (analogous), opposites ([[complementary-colors|complementary]]), three evenly spaced hues (triadic), or a color plus the two neighbors of its opposite (split complementary).",
    "[[chevreul|Chevreul]] split harmony into two kinds in 1839: harmonies of analogy, colors that are alike, and harmonies of contrast, colors that oppose. [[johannes-itten|Johannes Itten]] at the [[bauhaus|Bauhaus]] built 'color chords' of two, three or four hues on his wheel. [[josef-albers|Josef Albers]], who studied and then taught there, distrusted fixed rules and trained students to judge by eye in [[interaction-of-color|Interaction of Color]].",
    "What does research say? In 2011 Karen Schloss and Stephen Palmer had people rate many pairs of colors. Both liking and harmony went up as the two hues got more similar, which backs Chevreul's harmony of analogy. Liking also went up when the two colors differed in lightness: a pale [[Sage|sage]] with a deep [[Hunter green|hunter green]]. People also agreed more on what looked harmonious than on what they liked.",
    "A practical rule that survives: vary [[value|value]] more than hue. One or two hues at several lightnesses usually reads as calm and deliberate. Whistler even titled his mother's portrait an 'Arrangement in Grey and Black' ([[painting-whistlers-mother|Whistler's Mother]]): almost no hue at all, and perfectly composed.",
    "Designers also learn harmony from examples. The best-loved collection is [[dictionary-of-color-combinations|A Dictionary of Color Combinations]], drawn from the Japanese painter Sanzo Wada's pattern books of the 1930s and reissued in 2010: page after page of tested pairs and trios, with no rules attached."
  ],
  colors: ["Sage", "Hunter green", "Blue", "Red", "Yellow"],
  swatches: [
    { h: "#9CAF88", label: "Similar hue..." },
    { h: "#355E3B", label: "...different lightness" },
    { h: "#2563C9", label: "Triad · blue" },
    { h: "#D62F2F", label: "Triad · red" },
    { h: "#F2C81F", label: "Triad · yellow" }
  ],
  facts: [
    { label: "Two kinds (Chevreul)", value: "Analogy and contrast" },
    { label: "Lab finding", value: "Similar hues read as harmonious" }
  ],
  sources: [
    "Schloss, K. B. & Palmer, S. E. (2011). Aesthetic response to color combinations: preference, harmony, and similarity. Attention, Perception & Psychophysics 73(2): 551–571.",
    "Palmer, S. E., Schloss, K. B. & Sammartino, J. (2013). Visual aesthetics and human preference. Annual Review of Psychology 64: 77–107.",
    "Chevreul, M. E. (1839). De la loi du contraste simultané des couleurs. Paris."
  ]
},
{
  id: "simultaneous-contrast", type: "concept", title: "Simultaneous contrast",
  dek: "The same grey looks warm on blue and cool on orange. Every color changes its neighbors.",
  body: [
    "Simultaneous contrast is the way a color shifts depending on what surrounds it. Put one mid-grey square on a [[Blue|blue]] ground and another on an [[Orange|orange]] ground. The first looks faintly orange, the second faintly blue. Each surround pushes the square toward its [[complementary-colors|opposite]], and makes it look lighter on dark grounds and darker on light ones.",
    "The idea has a great origin story. In 1824 the chemist [[chevreul|Michel Eugène Chevreul]] took charge of dyeing at the Gobelins tapestry works in Paris, where customers complained that the black wool looked weak and reddish. The dye was fine. The blacks sat next to blues and purples, which tinted them. He published the rules in 1839, and the book became a handbook for painters, above all Seurat and the Neo-Impressionists ([[painting-grande-jatte|La Grande Jatte]]).",
    "[[josef-albers|Josef Albers]] turned it into a course. The exercises in his [[interaction-of-color|Interaction of Color]] (1963) ask students to make one color look like two, and two different colors look like one, using nothing but what surrounds them. Once you've done it with paper squares, you stop trusting a swatch seen alone.",
    "This is why ColorHub's screens are neutral grey: a colored frame would tint every swatch. It's why paint chips look different on the wall at home. And it's the flip side of [[color-constancy|color constancy]]: the brain judges color by comparing, not by measuring."
  ],
  colors: ["Grey", "Blue", "Orange"],
  swatches: [
    { h: "#8C9096", label: "The same grey..." },
    { h: "#2563C9", label: "...looks warmer on blue" },
    { h: "#F07A1A", label: "...and cooler on orange" }
  ],
  facts: [
    { label: "Named by", value: "Chevreul, 1839" },
    { label: "Found at", value: "Gobelins tapestry works, Paris" }
  ],
  sources: [
    "Chevreul, M. E. (1839). De la loi du contraste simultané des couleurs. Paris (English trans. 1854).",
    "Albers, J. (1963). Interaction of Color. Yale University Press.",
    "Viénot, F. (2002). Michel-Eugène Chevreul: from laws and principles to the production of colour plates. Color Research & Application 27(1)."
  ]
},
{
  id: "color-constancy", type: "concept", title: "Color constancy",
  dek: "A white shirt looks white under orange lamplight and in blue shade. Your brain quietly subtracts the light.",
  body: [
    "Color constancy is the brain's habit of seeing an object's color rather than the light coming off it. A [[White|white]] page under a [[warm-and-cool|warm]] bulb sends yellowish light to your eye, and the same page in blue shade sends bluish light, yet you see white both times. The brain estimates the lighting and discounts it, much as it judges a color against its neighbors in [[simultaneous-contrast|simultaneous contrast]].",
    "In February 2015 a photo of a striped dress split the internet. Some saw [[White|white]] and [[Gold|gold]]; others saw [[Blue|blue]] and [[Black|black]] (the real dress was blue and black). In a study of over 1,400 people, Rosa Lafer-Sousa and colleagues found 57% saw blue/black and 30% white/gold. The photo hides its lighting, so each brain guessed. Assume cool shade and you subtract blue and see white-gold. Assume warm light and you see blue-black.",
    "Edwin Land, the inventor of Polaroid instant photography, made constancy famous in the 1970s with 'Mondrian' displays: patchworks of colored paper lit by three adjustable projectors, roughly one for each [[trichromacy|cone type]]. A patch kept its color even when the light it sent to the eye changed a lot, because the brain compares each patch with the rest of the scene, the same principle [[josef-albers|Josef Albers]] taught with paper squares. He called his theory retinex, from retina plus cortex.",
    "Constancy keeps you alive and trips up painters. Beginners paint snow white because they know it's white; [[monet|Monet]] painted it in blues and lilacs because that's the light he saw. His [[painting-rouen-cathedral|Rouen Cathedral]] series shows one stone facade changing color with the hour. See also [[simultaneous-contrast|simultaneous contrast]]."
  ],
  colors: ["Periwinkle", "Sepia", "Royal blue", "Black"],
  swatches: [
    { h: "#96A1C9", label: "Photo pixels · pale blue" },
    { h: "#77623E", label: "Photo pixels · brown-gold" },
    { h: "#4169E1", label: "Real dress · blue" },
    { h: "#16171A", label: "Real dress · black" }
  ],
  facts: [
    { label: "The dress", value: "February 2015" },
    { label: "Saw blue/black", value: "57% (Lafer-Sousa et al. 2015)" },
    { label: "Retinex theory", value: "Edwin Land, 1970s" }
  ],
  sources: [
    "Lafer-Sousa, R., Hermann, K. L. & Conway, B. R. (2015). Striking individual differences in color perception uncovered by 'the dress' photograph. Current Biology 25(13): R545–R546.",
    "Land, E. H. (1977). The retinex theory of color vision. Scientific American 237(6).",
    "Foster, D. H. (2011). Color constancy. Vision Research 51(7): 674–700."
  ]
},
{
  id: "spectrum", type: "concept", title: "The spectrum and the rainbow",
  dek: "White light holds every color. Newton proved it with two prisms, then picked seven colors to match music.",
  body: [
    "Shine sunlight through a prism and it fans into a band from [[Red|red]] to [[Violet|violet]]. [[isaac-newton|Isaac Newton]] called that band a spectrum, Latin for an apparition. In his prism experiments of the 1660s he sent one color from a first prism through a second, and it stayed the same color. The prism wasn't adding color: white light is a mixture of all of them. It's the core of his [[opticks|Opticks]].",
    "The spectrum is continuous; nothing divides it into bands. Newton first named five main colors, then added [[Orange|orange]] and [[Indigo|indigo]] so there would be seven, like the notes of a musical scale. That's why the rainbow is taught as seven colors, and why so many people can't find indigo in a real one. Physically, visible light runs from about 380 to 700 nanometers in wavelength.",
    "A rainbow is the same spectrum painted on the sky by raindrops. Each drop bends sunlight, bounces it once inside, and bends it again on the way out, sending each color off at a slightly different angle, [[Red|red]] on the outside of the bow and [[Violet|violet]] inside. Theodoric of Freiberg worked this out in the early 1300s using water-filled glass globes as giant raindrops, and Descartes completed the geometry in 1637. Long before, [[aristotle|Aristotle]] had counted three colors in it.",
    "Some colors you know aren't in the spectrum at all: [[Magenta|magenta]], [[Pink|pink]], [[Brown|brown]] and [[Grey|grey]]. Your brain builds them; see [[extra-spectral|colors that aren't in the rainbow]]. Bend the spectrum into a loop and close the gap with purples, and you have the [[color-wheel|color wheel]]."
  ],
  colors: ["Red", "Orange", "Yellow", "Green", "Blue", "Indigo", "Violet"],
  swatches: [
    { h: "#D62F2F", label: "Red · ~650 nm" },
    { h: "#F07A1A", label: "Orange · ~600 nm" },
    { h: "#F2C81F", label: "Yellow · ~580 nm" },
    { h: "#2E9A4F", label: "Green · ~530 nm" },
    { h: "#2563C9", label: "Blue · ~470 nm" },
    { h: "#3D2B8E", label: "Indigo · ~445 nm" },
    { h: "#8000FF", label: "Violet · ~410 nm" }
  ],
  facts: [
    { label: "Visible range", value: "About 380–700 nm" },
    { label: "Seven colors since", value: "Newton (orange and indigo added)" },
    { label: "Rainbow geometry", value: "Theodoric of Freiberg c. 1304–1310; Descartes 1637" }
  ],
  sources: [
    "Newton, I. (1672). A new theory about light and colors. Philosophical Transactions 6: 3075–3087.",
    "'Music inspired Newton's rainbow'. Nature 520: 436 (2015).",
    "Boyer, C. B. (1959). The Rainbow: From Myth to Mathematics. Thomas Yoseloff."
  ]
},
{
  id: "extra-spectral", type: "concept", title: "Colors that aren't in the rainbow",
  dek: "Magenta, pink, brown and grey appear nowhere in the rainbow. Your brain invents them.",
  body: [
    "A prism shows a ribbon running from [[Red|red]] to [[Violet|violet]]. Look for [[Magenta|magenta]] and it isn't there. No single wavelength of light looks magenta. You see it when light from both ends of the [[spectrum|spectrum]] arrives together, reddish and bluish, with little green between. Faced with that mix, the brain makes up a hue that closes the circle.",
    "Scientists draw this as the 'line of purples', the straight edge along the bottom of the horseshoe-shaped chart of every visible color. Everything along it, from [[Purple|purple]] to magenta, is non-spectral. It's why the [[color-wheel|color wheel]] can be a wheel at all: the purples join red back to violet.",
    "Other familiar colors are missing for other reasons. [[Pink|Pink]] is red mixed with white light, so no pure wavelength makes it (its meaning has flipped too: see [[pink-and-blue|pink for girls, blue for boys]]). [[Brown|Brown]] is dark orange or yellow, and it only exists in context: an orange spot of light in a dark room looks orange, but surround it with brighter white and it turns brown. [[Grey|Grey]] is white seen as dimmer than its surroundings. See [[simultaneous-contrast|simultaneous contrast]].",
    "None of this makes magenta less real than green. Every hue is the brain's reading of three kinds of cone signals; see [[trichromacy|how eyes see color]]. Magenta just has no single wavelength behind it. Its name is young, too: the dye that first carried it, fuchsine, was renamed after the 1859 Battle of Magenta; see [[mauveine|the aniline dyes]].",
    "Scientists have even made a color no one had seen. In 2025 a UC Berkeley team used lasers aimed at single cone cells to stimulate only the medium-wavelength cones, which no natural light can do, since every wavelength also tickles their neighbors. The five people who saw it described a blue-green of unprecedented saturation and named it olo. Some vision scientists question calling it a new color; it shows how much of color lives in [[trichromacy|the eye and brain]]."
  ],
  colors: ["Magenta", "Pink", "Brown", "Grey"],
  swatches: [
    { h: "#FF00FF", label: "Magenta · red + blue light" },
    { h: "#F28DB2", label: "Pink · red + white" },
    { h: "#7A5230", label: "Brown · dark orange in context" },
    { h: "#8C9096", label: "Grey · dim white in context" }
  ],
  facts: [
    { label: "Not in the spectrum", value: "Magenta, purple, pink, brown, grey" },
    { label: "On the chart", value: "The line of purples" }
  ],
  sources: [
    "Wyszecki, G. & Stiles, W. S. (1982). Color Science, 2nd ed. Wiley.",
    "Fairchild, M. D. (2013). Color Appearance Models, 3rd ed. Wiley.",
    "Colour Literacy Project, 'Magenta is real' (colourliteracy.org).",
    "Fong, J. et al. (2025). Novel color via stimulation of individual photoreceptors at population scale. Science Advances 11."
  ]
},
{
  id: "trichromacy", type: "concept", title: "How eyes see color",
  dek: "Three kinds of cone cells, and every color you've ever seen is a ratio of their signals.",
  body: [
    "Your retina has three kinds of color-sensing cells called cones. One responds best to short wavelengths (peaking near 420 nm, [[Violet|violet]]-blue), one to medium (near 534 nm, [[Green|green]]) and one to long (near 564 nm, which is [[Lime|yellow-green]], not red). A color is the brain's reading of how strongly each type fires compared with the others. That's trichromacy, 'three colors'.",
    "[[thomas-young|Thomas Young]] guessed this in 1802, long before anyone could see a cone. He reasoned the eye couldn't hold a separate sensor for every color, so it must mix a few. Hermann von Helmholtz developed the idea in the 1850s, and [[james-clerk-maxwell|James Clerk Maxwell]] showed it by matching colors with three lights. In 1861 he projected the first color photograph, a tartan ribbon, from three pictures taken through red, green and blue filters.",
    "Trichromacy is why screens need only red, green and blue pixels, the trick [[james-clerk-maxwell|Maxwell]] used for the first color photograph. The [[Yellow|yellow]] on your phone contains no yellow light, just red and green light that excite your cones the way real yellow light does. Two lights that differ physically but look identical are called metamers. It's also why a paint can match a swatch in the shop and fail at home: different light, different match (see [[color-constancy|color constancy]]).",
    "The three signals don't stay three. Further along, the visual system recodes them as opposites, red against green and blue against yellow, as Ewald Hering proposed in 1878. That's why no one sees a 'reddish green' (see [[complementary-colors|complementary colors]]). If one cone type is missing or shifted, the result is [[color-blindness|color blindness]]."
  ],
  colors: ["Violet", "Malachite", "Lime"],
  swatches: [
    { h: "#6A00FF", label: "S cone peak · ~420 nm" },
    { h: "#4CD43A", label: "M cone peak · ~534 nm" },
    { h: "#C3E62B", label: "L cone peak · ~564 nm" }
  ],
  facts: [
    { label: "Cone types", value: "3 (short, medium, long)" },
    { label: "Proposed", value: "Thomas Young, 1802" },
    { label: "Peaks measured", value: "Bowmaker & Dartnall, 1980" }
  ],
  sources: [
    "Bowmaker, J. K. & Dartnall, H. J. A. (1980). Visual pigments of rods and cones in a human retina. Journal of Physiology 298: 501–511.",
    "Young, T. (1802). On the theory of light and colours. Philosophical Transactions 92: 12–48.",
    "Maxwell, J. C. (1861). On the theory of three primary colours. Royal Institution lecture, 17 May 1861."
  ]
},
{
  id: "color-blindness", type: "concept", title: "Color blindness",
  dek: "About 8% of European men mix up some reds and greens. The first man to describe it left his eyes to science.",
  body: [
    "Most color blindness isn't blindness to color. One cone type is missing or shifted, so some colors that look different to most people look alike. The common kind blurs [[Red|red]], [[Green|green]], [[Brown|brown]] and [[Orange|orange]]. About 8% of men and 0.5% of women of Northern European descent have red-green color deficiency. Men are hit far more often because the genes for the long- and medium-wavelength cone pigments (loosely, 'red' and 'green') sit on the X chromosome. See [[trichromacy|how eyes see color]].",
    "The chemist John Dalton described his own case in 1794. He guessed the fluid inside his eyeball was tinted [[Blue|blue]] and asked for his eyes to be examined after his death. They were, and the fluid was clear. In 1995 scientists extracted DNA from his preserved eye and found he lacked the gene for the medium-wavelength (green) cone pigment, one of the three behind [[trichromacy|trichromacy]]. In French and Spanish the condition is still called daltonism.",
    "Testing began on the railways. After two trains collided at Lagerlunda in Sweden in 1875, the physiologist Frithiof Holmgren blamed staff who misread colored signal lamps. He tested thousands of railway workers by asking them to sort colored skeins of wool, and testing spread to railways and ships. Historians who later reread the trial records doubt color blindness caused that crash at all. The familiar dot plates came later, from Shinobu Ishihara in 1917, hiding numbers among dots of easily confused colors like [[Red|red]], [[Olive|olive]] and [[Brown|brown]].",
    "What about the opposite, super color vision? Some women carry genes for a fourth cone type, and articles claim they see 100 million colors. Lab tests are far more sober: in a 2010 Cambridge study of 24 such carriers, only one behaved like a true four-color viewer. Rare confirmed cases exist; most tetrachromacy claims are hype. [[james-clerk-maxwell|James Clerk Maxwell]] was among the first to measure color-blind vision with mixtures of colored light."
  ],
  colors: ["Red", "Brown", "Olive", "Green"],
  swatches: [
    { h: "#D62F2F", label: "Often confused · red" },
    { h: "#7A5230", label: "Often confused · brown" },
    { h: "#808000", label: "Often confused · olive" },
    { h: "#2E9A4F", label: "Often confused · green" }
  ],
  facts: [
    { label: "Red-green deficiency", value: "~8% of men, ~0.5% of women (N. European descent)" },
    { label: "First described", value: "John Dalton, 1794" },
    { label: "Dot-plate test", value: "Shinobu Ishihara, 1917" }
  ],
  sources: [
    "Hunt, D. M. et al. (1995). The chemistry of John Dalton's color blindness. Science 267(5200): 984–988.",
    "Birch, J. (2012). Worldwide prevalence of red-green color deficiency. Journal of the Optical Society of America A 29(3): 313–320.",
    "Mollon, J. D. & Cavonius, L. R. (2012). The Lagerlunda collision and the introduction of color vision testing. Survey of Ophthalmology 57(2): 178–194.",
    "Jordan, G., Deeb, S. S., Bosten, J. M. & Mollon, J. D. (2010). The dimensionality of color vision in carriers of anomalous trichromacy. Journal of Vision 10(8): 12."
  ]
},
{
  id: "synesthesia", type: "concept", title: "Synesthesia",
  dek: "For some people the letter A is always red. It's real, it's consistent, and sometimes it's learned from toys.",
  body: [
    "Synesthesia is a crossing of the senses: a sound, letter or number automatically brings a color, every time; poets like [[rimbaud|Rimbaud]] only played at it. The most common kind is grapheme-color synesthesia, where letters and digits have their own colors. In a 2006 survey that tested people instead of waiting for volunteers, Julia Simner's team found about 4% of people had some form of synesthesia, and about 1% had colored letters or numbers.",
    "It isn't make-believe. Ask a synesthete the color of K and you'll get the same shade months or years later, which ordinary people can't fake. But the colors can be learned. In 2013 Nathan Witthoft and Jonathan Winawer described 11 American synesthetes whose letter colors matched a popular Fisher-Price set of fridge magnets (A [[Red|red]], B [[Orange|orange]], C [[Yellow|yellow]]), and 10 of them remembered owning it.",
    "Artists have chased the idea for a long time. [[kandinsky|Wassily Kandinsky]] wrote that hearing Wagner's Lohengrin in Moscow, “I saw all my colours in spirit, before my eyes.” Whether he had synesthesia in the clinical sense is debated, but he built a whole theory of color as sound in [[spiritual-in-art|Concerning the Spiritual in Art]]. [[rimbaud|Arthur Rimbaud]]'s sonnet [[voyelles|Voyelles]] gives each vowel a color, but it reads like a poet's invention, not a report.",
    "Synesthesia shows how tightly a brain can bind a color to a symbol. Francis Galton described people with colored numbers in 1880, and the novelist Vladimir Nabokov described his colored alphabet in his memoir. Learning [[basic-color-terms|color words]] builds a weaker version of the same bond in everyone: a name that calls up a color."
  ],
  colors: ["Red", "Orange", "Yellow", "Green"],
  swatches: [
    { h: "#D62F2F", label: "A · red (magnet set)" },
    { h: "#F07A1A", label: "B · orange (magnet set)" },
    { h: "#F2C81F", label: "C · yellow (magnet set)" },
    { h: "#2E9A4F", label: "D · green (magnet set)" }
  ],
  facts: [
    { label: "Any form", value: "~4% of people (Simner et al. 2006)" },
    { label: "Colored letters or digits", value: "~1% (Simner et al. 2006)" }
  ],
  sources: [
    "Simner, J. et al. (2006). Synaesthesia: the prevalence of atypical cross-modal experiences. Perception 35(8): 1024–1033.",
    "Witthoft, N. & Winawer, J. (2013). Learning, memory, and synesthesia. Psychological Science 24(3): 258–265.",
    "Kandinsky, W. (1913). Rückblicke (Reminiscences). Berlin: Der Sturm."
  ]
},
{
  id: "color-psychology", type: "concept", title: "Color psychology, myths and evidence",
  dek: "Red doesn't make you win and pink doesn't calm prisoners. Here's what color psychology can actually claim.",
  body: [
    "Color psychology is full of confident claims: [[Red|red]] boosts appetite, [[Blue|blue]] calms, [[Pink|pink]] pacifies. Most come from small studies or marketing folklore. A few effects hold up. The useful line is between what colors mean, which is learned and powerful, and what colors do to your body, which is usually small or unproven.",
    "Three famous claims that didn't survive. [[Red|Red]] and winning: a 2005 Nature paper found fighters in red won more Olympic bouts in 2004, but later Games didn't repeat it, and a 2024 meta-analysis found red won about 50.5% of bouts, no real edge. Red and test scores: a 2020 meta-analysis found no solid evidence that seeing red hurts performance. Baker-Miller [[Pink|pink]]: the 1979 claim that pink cells calm prisoners failed a controlled test in a Swiss prison.",
    "What holds up is preference. Across many countries people tend to like [[Blue|blues]] and dislike dark yellows and [[Olive|olive]] browns. Stephen Palmer and Karen Schloss explain this with their 'ecological valence' theory: we like the colors of things we like, such as clear sky and clean water, and dislike the colors of rot and waste. Australia used this in reverse: in 2012 it wrapped cigarettes in a drab olive-brown, Pantone 448 C (from the company behind the [[color-of-the-year|Color of the Year]]), after smokers picked it as the least appealing color.",
    "Meaning is learned, and it works: red for stop and for Italian [[racing-colors|racing cars]], [[mourning-colors|black or white for mourning]], [[pink-and-blue|pink and blue]] for babies, [[liturgical-colors|violet for Lent]], [[royal-purple|purple for power]]. These vary by culture and era, which shows they're conventions, not wiring. Effects on mood and body heat are weaker; tests of whether a red room feels warmer give mixed results (see [[warm-and-cool|warm and cool]]). Treat any bold claim about what a color 'does' to you with suspicion."
  ],
  colors: ["Umber", "Pink", "Blue"],
  swatches: [
    { h: "#4A412A", label: "Pantone 448 C · least liked (approx.)" },
    { h: "#FF91AF", label: "Baker-Miller pink · didn't calm (approx.)" },
    { h: "#2563C9", label: "Blue · most often liked" }
  ],
  facts: [
    { label: "Red helps you win", value: "Not supported by later data" },
    { label: "Pink calms prisoners", value: "Didn't replicate" },
    { label: "Most liked hue", value: "Blue, in most samples" }
  ],
  sources: [
    "Hill, R. A. & Barton, R. A. (2005). Red enhances human performance in contests. Nature 435: 293.",
    "Peperkoorn, L. S., Hill, R. A., Barton, R. A. & Pollet, T. V. (2024). Meta-analysis of the red advantage in combat sports. Scientific Reports 14: 30822.",
    "Gnambs, T. (2020). Limited evidence for the effect of red color on cognitive performance: a meta-analysis. Psychonomic Bulletin & Review 27.",
    "Genschow, O., Noll, T., Wänke, M. & Gersbach, R. (2015). Does Baker-Miller pink reduce aggression in prison detention cells? Psychology, Crime & Law 21(5).",
    "Palmer, S. E. & Schloss, K. B. (2010). An ecological valence theory of human color preference. PNAS 107(19): 8877–8882."
  ]
},
{
  id: "qualia", type: "concept", title: "Is your red my red?",
  dek: "When you and I both say “red”, do we see the same thing? Philosophers have argued about it since 1690.",
  body: [
    "Qualia (singular quale) are the felt qualities of experience: the redness of red as it looks to you. Here's the puzzle. You and a friend both call a tomato [[Red|red]] and grass [[Green|green]]. What if the way red looks to you is the way green looks to your friend, and the reverse? You'd use every color word identically, so no naming test could ever reveal it.",
    "John Locke posed this 'inverted spectrum' in 1690, in his Essay Concerning Human Understanding, imagining a [[Violet|violet]] giving one person the same idea a [[Marigold|marigold]] gives another. He thought it wouldn't make anyone's ideas false, since both would still sort the world the same way. Philosophers have used the case ever since to ask whether experience is fully captured by behavior and brain function.",
    "Color science pushes back a little. Color space isn't symmetrical: pure [[Yellow|yellow]] is far lighter than pure [[Blue|blue]], and some regions hold more distinguishable shades than others. A simple swap of red and green might show up in odd judgments, like which color looks lighter or more like a sunset. An inversion clever enough to keep every relation intact remains, for now, untestable.",
    "Two more thought experiments sharpen the question. Frank Jackson's 1982 'Mary' is a scientist who knows every physical fact about color vision but has lived all her life in a black-and-white room. When she first sees a red tomato, does she learn something new? And [[wittgenstein|Ludwig Wittgenstein]], in his [[remarks-on-colour|Remarks on Colour]], asked what color words can mean at all. Meanwhile [[color-blindness|color blindness]] shows people really can see differently, and prove it."
  ],
  colors: ["Red", "Green"],
  swatches: [
    { h: "#D62F2F", label: "Your red..." },
    { h: "#2E9A4F", label: "...my red?" }
  ],
  facts: [
    { label: "Inverted spectrum", value: "John Locke, 1690" },
    { label: "Mary's room", value: "Frank Jackson, 1982" }
  ],
  sources: [
    "Byrne, A. 'Inverted Qualia', Stanford Encyclopedia of Philosophy.",
    "Nida-Rümelin, M. & O Conaill, D. 'Qualia: The Knowledge Argument', Stanford Encyclopedia of Philosophy.",
    "Locke, J. (1690). An Essay Concerning Human Understanding, Book II, ch. 32, §15.",
    "Jackson, F. (1982). Epiphenomenal qualia. Philosophical Quarterly 32: 127–136."
  ]
},
{
  id: "warm-and-cool", type: "concept", title: "Warm and cool colors",
  dek: "Oranges feel warm and blues cool. Green and violet are up for debate. Physics runs the other way.",
  body: [
    "Painters sort colors by temperature. Reds, oranges and yellows reliably feel warm, like fire and sun; blues reliably feel cool, like water and shade. Green and violet are contested: each sits between a warm and a cool, so whether one reads warm, cool or neither depends on which way it leans and what's beside it. [[goethe|Goethe]] framed the split in his [[theory-of-colours|Theory of Colours]] as a polarity: a lively 'plus' side of yellow and orange and a restless 'minus' side of blue.",
    "Temperature is relative. [[Crimson|Crimson]] gets called a cool red beside [[Vermilion|vermilion]], though it's more precise to say crimson is purpler and vermilion oranger. A [[Teal|teal]] can look warm next to an icy blue, and whites and greys lean too: put a creamy white beside a bluish one and both leans jump out. In a lab study of 'color emotion' with British and Chinese observers, warmth peaked near red-orange and coolness at the opposite hue, a greenish blue, and stronger colors felt warmer or cooler than dull ones.",
    "Physics runs the other way. Heat a piece of iron and it glows [[Red|red]], then [[Yellow|yellow]], then bluish [[White|white]] as it gets hotter. Light bulbs are rated on this scale in kelvin, so a 'warm' 2,700 K bulb is rated lower than 'cool' 6,500 K daylight. Our words follow feelings about fire and ice, not thermodynamics.",
    "Does a warm-colored room feel warmer? This 'hue-heat' idea has been tested for decades with mixed results. In paintings, though, temperature does real work. Outdoors, sunlit surfaces look warm while shadows, lit by blue sky instead of sun, look cool, which is why the [[impressionism|Impressionists]] painted violet shadows. [[monet|Monet]]'s [[painting-impression-sunrise|Impression, Sunrise]] hangs one orange sun in a cool blue-grey harbor."
  ],
  colors: ["Vermilion", "Crimson", "Blue", "Green", "Purple", "Ecru", "White", "Apricot", "White"],
  swatches: [
    { h: "#E34234", label: "Vermilion · warm, oranger red" },
    { h: "#DC143C", label: "Crimson · cooler, purpler red" },
    { h: "#2563C9", label: "Blue · reliably cool" },
    { h: "#2E9A4F", label: "Green · contested" },
    { h: "#7B3FA0", label: "Violet-purple · contested" },
    { h: "#F6EEDC", label: "Ecru · warm white" },
    { h: "#F7F6F2", label: "White · cooler white" },
    { h: "#FFAD5E", label: "2,700 K bulb · 'warm' light" },
    { h: "#F6F4FF", label: "6,500 K daylight · 'cool' light" }
  ],
  facts: [
    { label: "Reliably warm", value: "Red, orange, yellow" },
    { label: "Reliably cool", value: "Blue" },
    { label: "Contested", value: "Green and violet: warm, cool or neither" },
    { label: "Kelvin scale", value: "Higher number = bluer light" }
  ],
  sources: [
    "Goethe, J. W. von (1810). Zur Farbenlehre; trans. C. L. Eastlake (1840), Theory of Colours, Part VI.",
    "Ou, L.-C., Luo, M. R., Woodcock, A. & Wright, A. (2004). A study of colour emotion and colour preference. Part I: Colour emotions for single colours. Color Research & Application 29(3): 232–240.",
    "Gage, J. (1993). Colour and Culture. Thames & Hudson.",
    "Battistel, L., Zandonella Callegher, R., Zampini, M. & Parin, R. (2024). Investigating the validity of the hue-heat effect on thermal sensitivity. Scientific Reports 14: 21413."
  ]
},
{
  id: "value", type: "concept", title: "Value: light and dark",
  dek: "Squint at a painting and the colors fade. What's left, light and dark, is what makes it work.",
  body: [
    "Value is how light or dark a color is, from [[Black|black]] (at the extreme, [[vantablack|Vantablack]], which reflects almost nothing) to [[White|white]], whatever its hue. Albert Munsell built it into his color system in 1905, with a value scale running from 0 for black to 10 for white. A [[Canary|canary]] yellow sits near the top of that scale and a [[Navy|navy]] near the bottom, even though both are strong colors.",
    "Painters like to say value does the work and color gets the credit. Turn a painting to greyscale and it still reads if the values are right. Squinting is the classic trick: it blurs detail and hue and leaves the big shapes of light and dark. [[painting-pearl-earring|Girl with a Pearl Earring]] reads as a lit face against a near-black ground before you even notice the blue and yellow. Leonardo's sfumato, soft blending without outlines in the [[painting-mona-lisa|Mona Lisa]], is value handled with extreme subtlety.",
    "Hues have natural values. At full strength [[Yellow|yellow]] is the lightest color and [[Violet|violet]] the darkest, which is why a yellow can't be deep and pure at once: darken it and it slides toward [[Olive|olive]] or [[Mustard|mustard]]. Value also shifts with its surroundings (see [[simultaneous-contrast|simultaneous contrast]]). Judging value is often harder than judging hue, which is why ColorHub's eye gym drills 'lighter or darker?'",
    "Value is the key to [[color-harmony|harmony]] and readability. Designers check text contrast by value, which is why yellow text on white fails and navy on [[Cream|cream]] works. Close values feel soft and atmospheric, far-apart values dramatic: compare the fog of [[monet|Monet]]'s [[painting-houses-of-parliament|Houses of Parliament]] or Friedrich's [[painting-wanderer|Wanderer above the Sea of Fog]] with the hard light of [[vermeer|Vermeer]]."
  ],
  colors: ["Black", "Charcoal", "Grey", "Silver", "White"],
  swatches: [
    { h: "#16171A", label: "Black · value ~1" },
    { h: "#36454F", label: "Charcoal · value ~3" },
    { h: "#8C9096", label: "Grey · value ~6" },
    { h: "#C0C0C0", label: "Silver · value ~8" },
    { h: "#F7F6F2", label: "White · value ~9.5" }
  ],
  facts: [
    { label: "Munsell scale", value: "0 (black) to 10 (white)" },
    { label: "Lightest pure hue", value: "Yellow" },
    { label: "Darkest pure hue", value: "Violet" }
  ],
  sources: [
    "Munsell, A. H. (1905). A Color Notation. Boston: G. H. Ellis.",
    "Livingstone, M. (2002). Vision and Art: The Biology of Seeing. Abrams.",
    "W3C, Web Content Accessibility Guidelines (WCAG) 2.1, contrast ratio."
  ]
},
{
  id: "optical-mixing", type: "concept", title: "Optical mixing",
  dek: "Put tiny dots of color side by side, step back, and your eye blends them into one.",
  body: [
    "Optical mixing happens when small patches of color sit so close that the eye can't separate them and blends them into one. Step back from dots of [[Blue|blue]] and [[Yellow|yellow]] and they merge. Because the eye averages light, the blend comes out a soft warm grey, not the green you'd get by mixing the two paints. Your phone screen works this way: tiny red, green and blue lights fuse into every color. So does printing, with dots of cyan, [[Magenta|magenta]], yellow and black.",
    "In the 1880s Georges Seurat and Paul Signac turned this into a method, often called pointillism or divisionism. They had read [[chevreul|Chevreul]] on [[simultaneous-contrast|contrast]] and the American physicist Ogden Rood, whose Modern Chromatics (1879) discussed colors mixing in the eye. Seurat spent about two years on [[painting-grande-jatte|A Sunday on La Grande Jatte]], placing small strokes of separate colors side by side.",
    "The theory promised brighter color than mixing on the palette, since paint mixtures get duller, especially mixes of [[complementary-colors|complements]]. In practice the eye averages the dots, so from a distance divisionist paintings tend to look soft and a little muted. What they gain is shimmer: up close the dots vibrate against each other; far away they settle.",
    "Time has altered the dots too. Seurat used a new zinc yellow that has browned: strokes that were bright yellow now look like [[Ochre|ochre]], and greens have drifted toward [[Olive|olive]]. Researchers have built digital reconstructions of the brighter original. The looser broken color of the [[impressionism|Impressionists]] works on the same principle."
  ],
  colors: ["Blue", "Yellow", "Grey"],
  swatches: [
    { h: "#2563C9", label: "Dots of blue..." },
    { h: "#F2C81F", label: "...and yellow..." },
    { h: "#B3A095", label: "...average to a warm grey" }
  ],
  facts: [
    { label: "Method", value: "Pointillism, or divisionism" },
    { label: "Key text", value: "Ogden Rood, Modern Chromatics (1879)" }
  ],
  sources: [
    "Rood, O. N. (1879). Modern Chromatics. New York: D. Appleton.",
    "Berns, R. S. (2006). Rejuvenating the color palette of Georges Seurat's A Sunday on La Grande Jatte—1884: a simulation. Color Research & Application 31(4).",
    "Art Institute of Chicago (2004). Seurat and the Making of La Grande Jatte."
  ]
},

// ---------------------------------------------------------------- traditions and culture
{
  id: "alchemy", type: "tradition", title: "Alchemy's colors",
  dek: "Alchemists tracked their Great Work in colors: black, white, yellow, red. Along the way they made vermilion.",
  body: [
    "Alchemists hoped to turn base matter into [[Gold|gold]], and they judged progress by color. The Great Work ran through four stages, each named for one: nigredo, the [[Black|blackening]]; albedo, the [[White|whitening]]; citrinitas, the [[Yellow|yellowing]]; and rubedo, the [[Red|reddening]]. Black meant decay and dissolution, white purification, yellow dawning, red completion. The philosophers' stone itself was often imagined as red.",
    "After about the 15th century many writers folded yellow into red and kept three stages: [[Black|black]], [[White|white]], [[Red|red]]. Others described a flash of every color between, the cauda pavonis or 'peacock's tail'. The prize at the end was [[Gold|gold]], the metal of the sun.",
    "Alchemy left a real pigment behind. Heat mercury with sulfur in a sealed flask and you get black mercury sulfide, which sublimes into brilliant red crystals: [[vermilion-pigment|vermilion]]. Chinese alchemists, who linked red cinnabar with long life, were probably making it this way centuries BCE. Recipes reached Europe by the 8th or 9th century, and [[Vermilion|vermilion]] became a favorite red of medieval manuscripts and altarpieces.",
    "In the 20th century Carl Jung read the stages as a map of the psyche, from the despair of nigredo to the wholeness of rubedo. Whatever alchemists meant, the sequence is one of the oldest stories told in colors, alongside [[heraldry|heraldry]] and the [[liturgical-colors|church calendar]]."
  ],
  colors: ["Black", "White", "Yellow", "Red", "Gold", "Vermilion"],
  swatches: [
    { h: "#16171A", label: "Nigredo · blackening, decay" },
    { h: "#F7F6F2", label: "Albedo · whitening, purification" },
    { h: "#F2C81F", label: "Citrinitas · yellowing, dawn" },
    { h: "#D62F2F", label: "Rubedo · reddening, completion" },
    { h: "#FFD700", label: "Gold · the goal" },
    { h: "#E34234", label: "Vermilion · alchemy's red pigment" }
  ],
  facts: [
    { label: "Four stages", value: "Nigredo, albedo, citrinitas, rubedo" },
    { label: "Alchemy's red", value: "Vermilion: mercury + sulfur" }
  ],
  sources: [
    "Principe, L. M. (2013). The Secrets of Alchemy. University of Chicago Press.",
    "Thompson, D. V. (1956). The Materials and Techniques of Medieval Painting. Dover.",
    "Jung, C. G. (1944). Psychologie und Alchemie (Psychology and Alchemy)."
  ]
},
{
  id: "heraldry", type: "tradition", title: "Heraldry's tinctures",
  dek: "Heraldry has its own color words, gules, azure, vert and sable, and one rule that still makes signs readable.",
  body: [
    "Knights in armor needed to be recognized from far off, so shields carried bold designs in a small set of colors called tinctures. There are two metals, or ([[Gold|gold]], often painted yellow) and argent ([[White|silver]], usually painted white), and five main colors: gules ([[Red|red]]), azure ([[Azure|blue]]), vert ([[Green|green]]), purpure ([[Purple|purple]]) and sable ([[Black|black]]). Furs like ermine make a third group.",
    "The words are a history lesson. Azure comes through Arabic from the Persian name for lapis lazuli, the stone ground into [[ultramarine-pigment|ultramarine]]. Sable is the dark fur of the sable, a kind of marten; it may be the costly fur lining Giovanni Arnolfini's robe in [[painting-arnolfini|The Arnolfini Portrait]]. Gules is disputed: it may come from strips of fur worn at the throat, and the popular link to a Persian word for rose has no firm evidence.",
    "The rule of tincture says never put metal on metal or color on color: a [[Red|red]] lion goes on [[Gold|gold]] or [[Silver|silver]], not on [[Blue|blue]]. The point is contrast, so a shield reads at a distance, the same logic behind legible signs and flags today (see [[value|value]]). The most famous exception, the arms of the crusader Kingdom of Jerusalem, sets gold crosses on silver, traditionally explained as a place too holy for ordinary rules.",
    "How do you show color in a black-and-white engraving? In 1638 the Jesuit Silvester Petra Sancta published a hatching code that stuck: vertical lines for red, horizontal for blue, diagonals for green and purple, dots for gold, blank for silver, crosshatching for black. Compare the color codes of the [[liturgical-colors|church year]] and of [[racing-colors|racing nations]]."
  ],
  colors: ["Gold", "White", "Red", "Azure", "Green", "Purple", "Black"],
  swatches: [
    { h: "#FFD700", label: "Or · gold (metal)" },
    { h: "#F7F6F2", label: "Argent · silver (metal)" },
    { h: "#D62F2F", label: "Gules · red" },
    { h: "#007FFF", label: "Azure · blue" },
    { h: "#2E9A4F", label: "Vert · green" },
    { h: "#7B3FA0", label: "Purpure · purple" },
    { h: "#16171A", label: "Sable · black" }
  ],
  facts: [
    { label: "Metals", value: "Or, argent" },
    { label: "Colors", value: "Gules, azure, vert, purpure, sable" },
    { label: "Hatching code", value: "Petra Sancta, 1638" }
  ],
  sources: [
    "Fox-Davies, A. C. (1909). A Complete Guide to Heraldry. London: T. C. & E. C. Jack.",
    "Woodcock, T. & Robinson, J. M. (1988). The Oxford Guide to Heraldry. Oxford University Press.",
    "Velde, F. 'The tincture Gules', heraldica.org."
  ]
},
{
  id: "liturgical-colors", type: "tradition", title: "Liturgical colors",
  dek: "Catholic priests change color with the calendar: violet for waiting, white for feasts, red for fire and blood.",
  body: [
    "Walk into a Catholic church through the year and the priest's vestments change color with the season. In today's Roman rite, [[White|white]] (or [[Gold|gold]] on big days) marks Christmas, Easter and feasts; red marks Pentecost, Good Friday and the martyrs; green fills the long stretch called Ordinary Time; violet marks Advent and Lent, the seasons of waiting and penance. Black is allowed for funerals (see [[mourning-colors|colors of mourning]]).",
    "The scheme is younger than the church. Colors varied from place to place until the 1190s, when Lotario dei Segni, soon to be Pope Innocent III, wrote a treatise on the Mass describing white, red, black and green in Rome. [[Violet|Violet]] gradually replaced [[Black|black]] for Advent and Lent, and in 1570 Pope Pius V's Missal fixed the sequence for the whole Roman church.",
    "Two Sundays get a surprise: rose. On Gaudete Sunday in Advent and Laetare Sunday in Lent, the halfway points, violet lightens to rose, as if the season exhales. Each color carries meaning: white for joy and purity, [[Red|red]] for the fire of the Spirit and the blood of martyrs, [[Green|green]] for growth and hope, [[Violet|violet]] for penance. Anglican, Lutheran and Orthodox churches use related but different schemes.",
    "Violet's place echoes the long story of [[royal-purple|purple and power]], and black's the [[mourning-colors|colors of mourning]]. Like [[heraldry|heraldry]] and [[alchemy|alchemy]], it's a code in which each hue means one thing, so anyone who knows it can read the calendar off a robe."
  ],
  colors: ["White", "Red", "Green", "Purple", "Pink", "Black"],
  swatches: [
    { h: "#F7F6F2", label: "White · Christmas, Easter, feasts" },
    { h: "#D62F2F", label: "Red · Pentecost, martyrs" },
    { h: "#2E9A4F", label: "Green · Ordinary Time" },
    { h: "#7B3FA0", label: "Violet · Advent, Lent" },
    { h: "#F28DB2", label: "Rose · Gaudete, Laetare" },
    { h: "#16171A", label: "Black · funerals" }
  ],
  facts: [
    { label: "Described", value: "Innocent III (as cardinal), 1190s" },
    { label: "Fixed", value: "Missal of Pius V, 1570" }
  ],
  sources: [
    "Encyclopaedia Britannica, 'Church year: Liturgical colours'.",
    "General Instruction of the Roman Missal (2002), §§345–347.",
    "Thurston, H. (1910). 'Liturgical Colours', Catholic Encyclopedia, vol. 8."
  ]
},
{
  id: "mourning-colors", type: "culture", title: "Colors of mourning",
  dek: "Black for grief is a local habit, not a law. Medieval queens mourned in white, as China long has.",
  body: [
    "In much of Europe and the Americas, grief wears [[Black|black]]. Elsewhere it doesn't. [[White|White]] is the traditional color of mourning in Chinese culture, where white clothes were long tied to death. In Thailand black is now usual, though historically it was white, and widows may wear purple. Colors of grief are conventions, learned like words (see [[color-psychology|color psychology]]).",
    "Europe had its own white mourning. The deepest mourning of medieval queens was [[White|white]], and French queens wore deuil blanc, 'white mourning'. The custom echoed into the 20th century: in 1934 the Dutch royal family mourned Queen Wilhelmina's husband, Prince Hendrik, in white, as he had asked, and in 1938 Norman Hartnell made an all-white wardrobe for Britain's Queen Elizabeth, later the Queen Mother, for a state visit to France while she mourned her mother.",
    "The Victorians turned black into a system. After Prince Albert died in 1861, Queen Victoria's long, public grief shaped how a whole society mourned. Widows moved through stages: full mourning in heavy black crape, then 'half mourning', when muted [[Lilac|lilac]], [[Lavender|lavender]] and [[Grey|grey]] were allowed back. Jet, a black stone formed from fossil wood, became the mourning jewel.",
    "Half mourning's lilacs overlapped with the late-1850s craze for the new [[mauveine|mauve]] dye. Black also runs through church practice, where black vestments may be worn at funerals (see [[liturgical-colors|liturgical colors]]). And the same white that means a wedding in one culture can mean a funeral in another."
  ],
  colors: ["Black", "White", "Lilac", "Lavender", "Grey", "Purple"],
  swatches: [
    { h: "#16171A", label: "Black · Western mourning" },
    { h: "#F7F6F2", label: "White · Chinese mourning; medieval queens" },
    { h: "#C8A2C8", label: "Lilac · Victorian half mourning" },
    { h: "#BFA2E8", label: "Lavender · Victorian half mourning" },
    { h: "#8C9096", label: "Grey · Victorian half mourning" },
    { h: "#7B3FA0", label: "Purple · Thai widows" }
  ],
  facts: [
    { label: "Victorian stages", value: "Full mourning, then half mourning" },
    { label: "White mourning", value: "Medieval queens (deuil blanc); Chinese tradition" }
  ],
  sources: [
    "The Metropolitan Museum of Art (2014). Death Becomes Her: A Century of Mourning Attire.",
    "Taylor, L. (1983). Mourning Dress: A Costume and Social History. Allen & Unwin.",
    "Wikipedia, 'Mourning' (sections on Asia, white mourning and the Victorian era)."
  ]
},
{
  id: "royal-purple", type: "culture", title: "Purple and power",
  dek: "Twelve thousand sea snails made enough purple to trim one garment. No wonder emperors kept it to themselves.",
  body: [
    "For two thousand years the most powerful color in the Mediterranean came from sea snails. [[tyrian-purple|Tyrian purple]], named for the Phoenician city of Tyre, was drawn from the glands of murex shellfish. When the chemist Paul Friedländer tried it in the early 1900s, 12,000 snails gave just 1.4 grams of pure dye, about enough for the trim of one garment.",
    "That cost made purple a badge. Rome's senior magistrates wore a [[White|white]] toga with a [[Purple|purple]] border, and a general in triumph wore one dyed solid purple and edged with [[Gold|gold]]. By the 4th century AD only the emperor could wear true purple, and 'taking the purple' meant becoming emperor. Diocletian's price edict of 301 AD capped a pound of purple silk at 150,000 denarii, the same price as a lion.",
    "In Byzantium a child born to a reigning emperor was porphyrogennetos, 'born in the purple'. The color [[Byzantium|Byzantium]] still carries the empire's name. When crusaders sacked Constantinople in 1204, imperial purple production ended, and Western Europe turned to red [[kermes|kermes]] for its grandest cloth. Purple kept its prestige in the church, in the [[Violet|violet]] of [[liturgical-colors|Advent and Lent]].",
    "Then chemistry made purple cheap. In 1856 the 18-year-old [[william-perkin|William Perkin]] made [[mauveine|mauveine]] from coal tar, and within a few years [[Mauve|mauve]] and then [[Magenta|magenta]] dresses filled the streets of London and Paris. The color of emperors became the color of anyone who could afford a ribbon."
  ],
  colors: ["Byzantium", "Purple", "Plum", "Magenta"],
  swatches: [
    { h: "#66023C", label: "Tyrian purple · emperors (approx.)" },
    { h: "#7B3FA0", label: "Violet-purple · church penance" },
    { h: "#8F3B8F", label: "Mauveine · purple for everyone (approx.)" },
    { h: "#FF00FF", label: "Magenta · the 1859 dye" }
  ],
  facts: [
    { label: "Snails for 1.4 g of dye", value: "About 12,000 (Friedländer)" },
    { label: "Price cap, 301 AD", value: "150,000 denarii per pound of purple silk" },
    { label: "Born in the purple", value: "Byzantine porphyrogennetos" }
  ],
  sources: [
    "Cooksey, C. J. (2001). Tyrian purple: 6,6'-dibromoindigo and related compounds. Molecules 6(9): 736–769.",
    "Jacoby, D. (2004). Silk economics and cross-cultural artistic interaction: Byzantium, the Muslim world, and the Christian West. Dumbarton Oaks Papers 58.",
    "Diocletian, Edict on Maximum Prices (301 AD).",
    "Garfield, S. (2000). Mauve: How One Man Invented a Color That Changed the World. Faber & Faber."
  ]
},
{
  id: "pink-and-blue", type: "culture", title: "Pink for girls, blue for boys",
  dek: "In 1918 a trade magazine said pink was for boys. The real history is messier than either rule.",
  body: [
    "Today in Europe and the US, [[Pink|pink]] means girl and [[Blue|blue]] means boy. The rule is barely a century old. Through the 1800s most small children of both sexes wore [[White|white]]: it could be boiled clean, and early dyes would have washed out. A small boy in a white dress with pink ribbons was nothing unusual.",
    "Then came the famous line. In June 1918 the trade journal Earnshaw's Infants' Department told shops the 'generally accepted rule' was [[Baby pink|pink]] for boys and [[Powder blue|blue]] for girls, since pink was stronger and more decided, blue daintier. The quote is real. But it spoke for one corner of the trade, other writers said the opposite, and later searches of old print found the pink-for-boys rule was never widespread. Practice was inconsistent for decades.",
    "The historian Jo Paoletti traced how American stores and parents drifted toward pink for girls in the 1930s and 40s until it became the norm. Mamie Eisenhower's [[Pink|pink]] inaugural gown in 1953 helped tie pink to ladylike femininity. Paoletti argues that prenatal tests, which let parents know the sex and shop ahead, sharpened the split from the 1980s on.",
    "So neither 'pink was always for girls' nor 'pink was always for boys' holds up. The older logic, that pink is a light [[Red|red]] and red was a manly, military color, shows how one hue can flip meaning within a lifetime. Pink had adult glamour too: 18th-century France adored it, from Madame de Pompadour's porcelain to the frothy dress in Fragonard's [[painting-the-swing|The Swing]] (1767). Color meanings are conventions (see [[color-psychology|color psychology]])."
  ],
  colors: ["Baby pink", "Powder blue", "White"],
  swatches: [
    { h: "#F4C2C2", label: "Pink · girls (since about the 1940s)" },
    { h: "#B0E0E6", label: "Blue · boys (since about the 1940s)" },
    { h: "#F7F6F2", label: "White · all small children (1800s)" }
  ],
  facts: [
    { label: "The 1918 quote", value: "Real (Earnshaw's Infants' Department)" },
    { label: "Pink-for-girls settled", value: "1940s, in the US" }
  ],
  sources: [
    "Paoletti, J. B. (2012). Pink and Blue: Telling the Boys from the Girls in America. Indiana University Press.",
    "Del Giudice, M. (2012). The twentieth century reversal of pink-blue gender coding: a scientific urban legend? Archives of Sexual Behavior 41(6): 1321–1323.",
    "Earnshaw's Infants' Department, June 1918."
  ]
},
{
  id: "racing-colors", type: "culture", title: "National racing colors",
  dek: "British racing green began as a courtesy to Ireland. Germany's silver may come from scraped paint, or not.",
  body: [
    "Early motor races were contests between nations, so the cars wore national colors. In the Gordon Bennett Cup of 1900, the United States took [[Red|red]], Germany [[White|white]] and France [[Blue|blue]]. When Britain joined in 1902 its flag colors were gone, and Selwyn Edge raced a green Napier. He won, so the 1903 race went to Ireland, since racing on public roads was illegal in Great Britain. As a courtesy to the hosts, the British cars were painted shamrock [[Green|green]].",
    "That's the root of British racing green, which never had one exact shade: early cars ran lighter olive and moss greens, later ones the deep [[Hunter green|hunter-like]] green the name means today. Italy came to race in red, the rosso corsa Ferrari still wears; France stayed blue; Germany raced in white.",
    "Then Germany turned [[Silver|silver]]. The legend says that in 1934 the new Mercedes W25 weighed 751 kg against a 750 kg limit, so the team scraped off its white paint overnight and raced in bare aluminum. The story first appeared in 1958, in team manager Alfred Neubauer's memoirs; nothing from 1934 backs it, and silver Mercedes cars had raced before. A good tale, not history.",
    "National colors faded once sponsors' liveries took over in the late 1960s, but they never vanished: Ferrari [[Red|red]], Mercedes silver and British [[Green|green]] still echo them. Like [[heraldry|heraldry]], racing colors were a way to tell sides apart at a glance, at speed."
  ],
  colors: ["Hunter green", "Red", "Denim", "White", "Silver"],
  swatches: [
    { h: "#355E3B", label: "Green · Britain (from 1903)" },
    { h: "#D62F2F", label: "Red · USA in 1900; later Italy" },
    { h: "#2B5BA8", label: "Blue · France" },
    { h: "#F7F6F2", label: "White · Germany (early)" },
    { h: "#C0C0C0", label: "Silver · Germany (1930s on)" }
  ],
  facts: [
    { label: "Origin", value: "Gordon Bennett Cup, 1900" },
    { label: "British green", value: "1903 race, held in Ireland" },
    { label: "Scraped-paint story", value: "Unverified (first told in 1958)" }
  ],
  sources: [
    "Wikipedia, 'British racing green' and 'Silver Arrows'.",
    "Neubauer, A. (1958). Männer, Frauen und Motoren. Hamburg.",
    "Fédération Internationale de l'Automobile, Code Sportif International (historic national colors)."
  ]
},
{
  id: "color-of-the-year", type: "culture", title: "Pantone Color of the Year",
  dek: "Since 2000, Pantone has crowned one color a year. It's a trend forecast and a marketing event, not a science.",
  body: [
    "Each year the Pantone Color Institute names a 'Color of the Year' for the year ahead. The first, for 2000, was Cerulean, a soft sky blue much paler than the [[Cerulean|cerulean]] painters know. Since then the picks have run from Tangerine Tango (2012) to Living Coral (2019), and twice Pantone named two colors at once: Rose Quartz and Serenity for 2016, Ultimate Gray and Illuminating for 2021.",
    "How is it chosen? Pantone describes a year of trend-watching across fashion, film, design and travel, then writes a story about the mood of the moment. For 2026 it picked Cloud Dancer, an airy off-[[White|white]] and the first white on the list. Read the picks as forecasts and marketing: they sell trend reports and licensed products, and nothing measures whether a color truly 'reflects the times' (see [[color-psychology|color psychology]]).",
    "The names are a lesson in how loosely color words travel. Viva Magenta (2023) is really a crimson-leaning red, not a true [[Magenta|magenta]]. Classic Blue (2020) is close to [[Cobalt|cobalt]], Peach Fuzz (2024) to [[Peach|peach]], and Mocha Mousse (2025) is a milky brown.",
    "Notice the trick behind the names: Living Coral, Mimosa, Marsala and Mocha Mousse each borrow a thing you can picture, the same way [[Coral|coral]], [[Salmon|salmon]] and [[Mustard|mustard]] got their names. A name gives a color a handle (see [[basic-color-terms|color terms]] and [[linguistic-relativity|whether words change what we see]])."
  ],
  colors: ["Periwinkle", "Vermilion", "Salmon", "Cobalt", "Raspberry", "Peach", "Sepia", "White"],
  swatches: [
    { h: "#9BB7D4", label: "2000 · Cerulean (Pantone's)" },
    { h: "#DD4124", label: "2012 · Tangerine Tango" },
    { h: "#FF6F61", label: "2019 · Living Coral" },
    { h: "#0F4C81", label: "2020 · Classic Blue" },
    { h: "#BB2649", label: "2023 · Viva Magenta" },
    { h: "#FFBE98", label: "2024 · Peach Fuzz" },
    { h: "#A47864", label: "2025 · Mocha Mousse" },
    { h: "#F0EFEA", label: "2026 · Cloud Dancer" }
  ],
  facts: [
    { label: "First", value: "Cerulean, for 2000" },
    { label: "2026", value: "Cloud Dancer, PANTONE 11-4201" },
    { label: "Two-color years", value: "2016 and 2021" }
  ],
  sources: [
    "Pantone, 'PANTONE 11-4201 Cloud Dancer, Color of the Year 2026' (pantone.com).",
    "Pantone Color Institute, Color of the Year archive (pantone.com).",
    "Wikipedia, 'Pantone', section 'Color of the Year'."
  ]
},
{
  id: "color-trademarks", type: "culture", title: "Owning a color",
  dek: "Can you own a color? Tiffany, Owens Corning and Louboutin did, within limits. Yves Klein never did.",
  body: [
    "A company can't own a color outright, but it can sometimes own a color for one kind of product, as a trademark. Roughly, buyers must read the color as a sign of who made the thing, and the color can't do a practical job. In 1985 a US appeals court let Owens Corning protect [[Pink|pink]] for its building insulation, a landmark ruling for color trademarks. In 1995 the US Supreme Court confirmed, in a case about green-gold dry-cleaning pads, that a color alone can be a trademark.",
    "Famous cases: Tiffany's robin's-egg blue has been a registered trademark since 1998, and Pantone, the company behind the [[color-of-the-year|Color of the Year]], mixes it privately as 'PMS 1837', after the year Tiffany was founded. Christian Louboutin's red soles are protected in several countries, within limits set by courts. Cadbury lost a key round in 2013, when the UK Court of Appeal found its description of [[Purple|purple]] too loose; later rounds went both ways.",
    "Useful colors can't be owned. US rulings denied protection to orange and yellow for phone booths (they're easy to see), coral for earplugs (easy to spot in safety checks) and John Deere's [[Green|green]] for loaders, because farmers want loaders that match their tractors. If a color helps a product work or sell for reasons beyond its maker, everyone keeps it.",
    "The most famous 'owned' color isn't owned at all. [[yves-klein|Yves Klein]] recorded the formula of his [[ultramarine-pigment|ultramarine]] paint, International Klein Blue, in a sealed, dated envelope in 1960, a French way to prove when you invented something. He never patented it. Today's fights are over materials: the artist Anish Kapoor holds exclusive art rights to a spray form of [[vantablack|Vantablack]]."
  ],
  colors: ["Turquoise", "Red", "Indigo", "Pink"],
  swatches: [
    { h: "#81D8D0", label: "Tiffany Blue · trademark since 1998 (approx.)" },
    { h: "#C30D23", label: "Louboutin red sole · protected (approx.)" },
    { h: "#002FA7", label: "Klein blue · recorded, never patented (approx.)" },
    { h: "#F4A7B9", label: "Owens Corning pink · first US color mark (approx.)" }
  ],
  facts: [
    { label: "Landmark US color case", value: "Owens Corning pink, 1985" },
    { label: "US Supreme Court", value: "Qualitex v. Jacobson, 1995" },
    { label: "International Klein Blue", value: "Recorded 1960; never patented" }
  ],
  sources: [
    "In re Owens-Corning Fiberglas Corp., 774 F.2d 1116 (Fed. Cir. 1985).",
    "Qualitex Co. v. Jacobson Products Co., 514 U.S. 159 (1995).",
    "Deere & Co. v. Farmhand, Inc., 560 F. Supp. 85 (S.D. Iowa 1982).",
    "Société des Produits Nestlé SA v Cadbury UK Ltd [2013] EWCA Civ 1174; Cadbury UK Ltd v Comptroller General [2022] EWHC 1671 (Ch).",
    "In re Orange Communications, 41 USPQ2d 1036 (TTAB 1996); In re Howard S. Leight & Assocs., 39 USPQ2d 1058 (TTAB 1996).",
    "Wikipedia, 'International Klein Blue' (Soleau envelope, 1960)."
  ]
},

// ---------------------------------------------------------------- movements
{
  id: "bauhaus", type: "movement", title: "The Bauhaus",
  dek: "A German art school that lasted only 14 years, and still shapes how designers are taught color.",
  body: [
    "The Bauhaus was an art and design school founded by the architect Walter Gropius in Weimar in 1919. It moved to Dessau in 1925 and to Berlin in 1932, and closed in 1933 under pressure from the Nazis. In fourteen years it reshaped design: simple forms, function first, art and industry together. It also taught color more systematically than any art school before it, drawing on [[goethe|Goethe]] and [[chevreul|Chevreul]].",
    "Color teaching there had several authors. [[johannes-itten|Johannes Itten]] ran the preliminary course until 1923, drilling students in color contrasts and a 12-part color wheel. [[kandinsky|Wassily Kandinsky]], who arrived in 1922, taught that colors and shapes have inner sounds. Paul Klee lectured on color too. And [[josef-albers|Josef Albers]], a student who became a teacher, later turned the school's hands-on approach into [[interaction-of-color|Interaction of Color]].",
    "Kandinsky had already paired color with shape in [[spiritual-in-art|Concerning the Spiritual in Art]] (1911): sharp colors suit sharp forms, like a [[Yellow|yellow]] triangle, and soft, deep colors suit round ones, like a [[Blue|blue]] circle. He brought those ideas into his Bauhaus classes. Treat them as shared intuition, not a law of nature.",
    "When the school closed, its teachers scattered and took the method with them. Albers went to Black Mountain College in North Carolina and later to Yale; Gropius to Harvard; László Moholy-Nagy founded the New Bauhaus in Chicago. The first-year course in color and form at art schools worldwide descends from the Bauhaus, including the [[color-wheel|color wheel]] and [[simultaneous-contrast|contrast]] exercises design students still do."
  ],
  colors: ["Yellow", "Blue"],
  swatches: [
    { h: "#F2C81F", label: "Yellow · sharp forms, like a triangle (Kandinsky)" },
    { h: "#2563C9", label: "Blue · round forms, like a circle (Kandinsky)" }
  ],
  facts: [
    { label: "Founded", value: "Weimar, 1919, by Walter Gropius" },
    { label: "Moved", value: "Dessau 1925, Berlin 1932" },
    { label: "Closed", value: "1933" }
  ],
  sources: [
    "Droste, M. (2019). Bauhaus 1919–1933. Taschen.",
    "Kandinsky, W. (1911). Über das Geistige in der Kunst; trans. M. Sadleir (1914), Concerning the Spiritual in Art.",
    "Wikipedia, 'Bauhaus'."
  ]
},
{
  id: "impressionism", type: "movement", title: "Impressionism",
  dek: "A critic's joke about one hazy sunrise named a movement that banished black and painted shadows blue.",
  body: [
    "In April 1874 a group of painters, including [[monet|Claude Monet]], Renoir, Pissarro, Degas and Berthe Morisot, held their own show in the former studio of the photographer Nadar, outside the official Salon. The critic Louis Leroy mocked Monet's [[painting-impression-sunrise|Impression, Sunrise]] in the paper Le Charivari, calling the group 'Impressionists'. They took the name, and showed together eight times by 1886.",
    "Their color was new. Working outdoors, they caught passing light with short broken strokes of unmixed color. They mostly gave up black and the old [[earth-pigments|earth browns]], mixing darks from [[complementary-colors|complements]] instead, and painted shadows with the [[Blue|blue]] and [[Violet|violet]] of the sky. Monet's series, like [[painting-rouen-cathedral|Rouen Cathedral]] and the [[painting-houses-of-parliament|Houses of Parliament]], show one subject changing color through the day: [[color-constancy|color constancy]] switched off on purpose.",
    "Chemistry helped. Bright synthetic pigments, among them [[cobalt-blue-pigment|cobalt blue]], [[viridian-pigment|viridian]], synthetic [[ultramarine-pigment|ultramarine]] and [[chrome-yellow|chrome yellow]], were on sale by the 1840s, and paint came in the collapsible tin tube patented by John Goffe Rand in 1841. Renoir's son reported him saying that without tubes there would have been no Impressionism, though historians note that portable paint alone doesn't explain the style.",
    "The next generation pushed the science further. Seurat and Signac, who showed at the last Impressionist exhibition in 1886, turned broken color into dots ([[optical-mixing|optical mixing]], [[painting-grande-jatte|La Grande Jatte]]), and [[van-gogh|Van Gogh]] arrived in Paris in 1886 and brightened his palette within months. See also [[warm-and-cool|warm and cool]]."
  ],
  colors: ["Blue", "Violet", "Orange", "Cobalt", "Viridian"],
  swatches: [
    { h: "#2563C9", label: "Blue · shadows" },
    { h: "#8000FF", label: "Violet · shadows" },
    { h: "#F07A1A", label: "Orange · sunlight" },
    { h: "#0047AB", label: "Cobalt · new pigment" },
    { h: "#40826D", label: "Viridian · new pigment" }
  ],
  facts: [
    { label: "First exhibition", value: "April 1874, Paris" },
    { label: "Named by", value: "Louis Leroy, Le Charivari, 1874" },
    { label: "Paint tube patent", value: "John Goffe Rand, 1841" }
  ],
  sources: [
    "Musée d'Orsay (2024). Paris 1874: Inventing Impressionism.",
    "Callen, A. (2000). The Art of Impressionism: Painting Technique and the Making of Modernity. Yale University Press.",
    "Bomford, D. et al. (1990). Art in the Making: Impressionism. National Gallery, London."
  ]
},

// ---------------------------------------------------------------- pigments and dyes
{
  id: "earth-pigments", type: "pigment", title: "Earth pigments",
  dek: "Dig up rusty clay, grind it, and you have paint. Humans have done it for at least 100,000 years.",
  body: [
    "Earth pigments are colored clays and minerals dug from the ground, mostly tinted by iron oxides. Yellow [[Ochre|ochre]] owes its color to goethite, red ochre to hematite. Add manganese and the earth turns brown: raw [[Umber|umber]] and raw [[Sienna|sienna]]. Heat any of them and they redden, as the yellow iron mineral changes into the red one. That's why painters' tubes say 'burnt sienna' and 'burnt umber'.",
    "They're the oldest paints we know. At Blombos Cave in South Africa, people mixed [[Ochre|ochre]] in abalone shells about 100,000 years ago, and pieces of ochre engraved with crosshatched lines there are about 75,000 years old. Cave painters used [[Red|red]] and [[Yellow|yellow]] ochre at Altamira and Pech Merle, and a horse at Lascaux was colored with yellow ochre about 17,000 years ago.",
    "The names are maps. [[Sienna|Sienna]] was the 'earth of Siena', a Tuscan earth rich in manganese. Umber may come from Umbria in Italy or from Latin umbra, 'shadow'; scholars disagree (see [[Umber|umber]]). In the 1780s Jean-Étienne Astier of Roussillon in Provence worked out how to refine ochre on an industrial scale, and the red cliffs there were quarried for France's ochre trade.",
    "Earth colors are cheap, stable and safe, which is why they never left the palette. Renaissance painters built flesh and shadow with them; the [[impressionism|Impressionists]] mostly mixed their browns from brighter colors instead. Modern iron-oxide pigments are made synthetically, but the old names, [[Ochre]], [[Sienna]], [[Umber]] and [[Terracotta|terracotta]], survive. Not every old brown came from the earth, though: [[mummy-brown|mummy brown]] was ground from Egyptian mummies."
  ],
  colors: ["Ochre", "Sienna", "Umber", "Rust", "Terracotta"],
  swatches: [
    { h: "#CC7722", label: "Yellow ochre · goethite" },
    { h: "#A0522D", label: "Burnt sienna · heated, reddened" },
    { h: "#635147", label: "Raw umber · iron plus manganese" },
    { h: "#B7410E", label: "Red ochre · hematite (approx.)" },
    { h: "#E2725B", label: "Terracotta · fired clay" }
  ],
  year: -100000,
  yearNote: "Ochre paint kit, Blombos Cave, c. 100,000 years ago",
  facts: [
    { label: "Made from", value: "Iron-oxide clays (plus manganese for umbers)" },
    { label: "Oldest use", value: "Blombos Cave, about 100,000 years ago" },
    { label: "'Burnt'", value: "Heated, which turns yellow iron oxide red" }
  ],
  sources: [
    "Henshilwood, C. S. et al. (2011). A 100,000-year-old ochre-processing workshop at Blombos Cave, South Africa. Science 334(6053): 219–222.",
    "Helwig, K. (2007). Iron oxide pigments. In Artists' Pigments, vol. 4. National Gallery of Art, Washington.",
    "Wikipedia, 'Ochre' and 'Umber'."
  ]
},
{
  id: "ultramarine-pigment", type: "pigment", title: "Ultramarine and lapis lazuli",
  dek: "Ground from a stone mined in Afghanistan, it was at times as pricey as gold. Painters saved it for the Virgin.",
  body: [
    "Natural ultramarine is ground lapis lazuli, a deep blue stone mined for millennia in the Badakhshan mountains of Afghanistan. Its name means 'beyond the sea', for the long trade route that brought it to Italy through Venice. Simply grinding the stone gives a greyish powder; the brilliant blue comes from a slow extraction, kneading the powder in wax and resin and washing out the blue particles, described by the 13th-century writer al-Tifashi. Its deep, slightly violet blue sits between the app's [[Cobalt|cobalt]] and [[Indigo|indigo]].",
    "Good ultramarine was at times as expensive as gold. The painter Cennino Cennini, around 1400, called it “a glorious, lovely and absolutely perfect pigment.” Contracts specified it, and painters often saved it for the robes of the Virgin Mary, using cheaper azurite underneath. The word [[Azure|azure]], via Arabic, comes from the Persian name for the same stone (see [[heraldry|heraldry]]).",
    "[[vermeer|Johannes Vermeer]] used it lavishly, even mixing it into shadows. The turban in [[painting-pearl-earring|Girl with a Pearl Earring]] is natural ultramarine with varying amounts of lead white, a darker blue laid over a lighter one, and the blue apron in [[painting-milkmaid|The Milkmaid]] is ultramarine too.",
    "Cheaper rivals had arrived, [[prussian-blue|Prussian blue]] around 1706 and [[cobalt-blue-pigment|cobalt blue]] in 1802, but in 1824 a French society still offered 6,000 francs for a synthetic ultramarine. Jean-Baptiste Guimet in France and Christian Gmelin in Germany both found a way in the late 1820s, and cheap 'French ultramarine' filled the tubes of the [[impressionism|Impressionists]]. In the 1950s [[yves-klein|Yves Klein]] suspended synthetic ultramarine in a matte binder to make International Klein Blue (see [[color-trademarks|owning a color]])."
  ],
  colors: ["Cobalt", "Azure", "Indigo"],
  swatches: [
    { h: "#1F3A93", label: "Natural ultramarine · the Virgin's robe (approx.)" },
    { h: "#007FFF", label: "Azure · named for lapis" },
    { h: "#002FA7", label: "Klein blue · synthetic ultramarine (approx.)" }
  ],
  year: 600,
  yearNote: "Ground lapis as paint in cave temples near Bamiyan, 6th–7th century CE",
  facts: [
    { label: "Made from", value: "Lapis lazuli (the mineral lazurite)" },
    { label: "Mined in", value: "Badakhshan, Afghanistan" },
    { label: "Synthetic", value: "Guimet and Gmelin, late 1820s" }
  ],
  sources: [
    "Plesters, J. (1993). Ultramarine blue, natural and artificial. In Artists' Pigments, vol. 2. National Gallery of Art, Washington.",
    "Cennini, C. (c. 1400). Il libro dell'arte; trans. L. Broecke (2015). Archetype.",
    "National Gallery, London. Technical studies of Vermeer's ultramarine.",
    "Wikipedia, 'Ultramarine'.",
    "Delaney, J. K., Dooley, K. A., van Loon, A. & Vandivere, A. (2020). Mapping the pigment distribution of Vermeer's Girl with a Pearl Earring. Heritage Science 8: 4."
  ]
},
{
  id: "egyptian-blue", type: "pigment", title: "Egyptian blue",
  dek: "The first color people made from scratch, over 5,000 years ago. Under infrared light it still glows.",
  body: [
    "Egyptian blue is the oldest known synthetic pigment: not dug up but cooked. Heat sand, lime, a copper source (ore or bronze scrap) and a little alkali to around 850–950 °C, and you get [[Blue|blue]] crystals of calcium copper silicate. The earliest known example, on a bowl from Hierakonpolis now in Boston's Museum of Fine Arts, dates to around 3250 BCE.",
    "Egyptians painted tombs, statues and coffins with it for three thousand years, and the Romans called it caeruleum, probably from caelum, the sky, a root shared by our word [[Cerulean|cerulean]]. The architect Vitruvius gave a recipe in the 1st century BCE, and Roman sources say a man named Vestorius brought production from Alexandria to Pozzuoli near Naples. After Rome the know-how faded, and the pigment dropped out of use until chemists reconstructed it in the 1800s.",
    "Its strangest property was noticed only recently. Egyptian blue absorbs visible light and gives off strong, long-lasting infrared light, just past the red end of the [[spectrum|spectrum]]: invisible to us, bright to an infrared camera. Conservators use it to find faded traces of blue on statues and walls that look unpainted, and it has turned up in places no one expected, including Raphael's 16th-century fresco The Triumph of Galatea.",
    "It also corrects a myth. People in the ancient world made and traded a bright, stable blue, whatever their word lists say: Theophrastus called it kyanos. When [[homer|Homer]] skips blue, it's a matter of [[basic-color-terms|vocabulary]], not eyesight. Its modern cousins include [[cobalt-blue-pigment|cobalt blue]], [[prussian-blue|Prussian blue]], synthetic [[ultramarine-pigment|ultramarine]] and the 2009 newcomer [[yinmn-blue|YInMn blue]]."
  ],
  colors: ["Cobalt", "Azure"],
  swatches: [
    { h: "#1034A6", label: "Egyptian blue · first synthetic pigment (approx.)" },
    { h: "#007FFF", label: "Caeruleum · the Roman 'sky' name" }
  ],
  year: -3250,
  yearNote: "c. 3250 BCE, earliest known use (Hierakonpolis bowl)",
  facts: [
    { label: "Made from", value: "Sand, lime, copper and alkali, fired" },
    { label: "Chemistry", value: "Calcium copper silicate (CaCuSi4O10)" },
    { label: "Party trick", value: "Glows in near-infrared" }
  ],
  sources: [
    "Museum of Fine Arts, Boston. Late Predynastic bowl from Hierakonpolis (identified by L. H. Corcoran).",
    "Vitruvius, De architectura, Book VII.",
    "Verri, G. (2009). The spatially resolved characterisation of Egyptian blue, Han blue and Han purple by photo-induced luminescence digital imaging. Analytical and Bioanalytical Chemistry 394: 1011–1021.",
    "Wikipedia, 'Egyptian blue'."
  ]
},
{
  id: "prussian-blue", type: "pigment", title: "Prussian blue",
  dek: "A Berlin paint maker tried to make red, got blue, and changed art from Paris to Edo.",
  body: [
    "Around 1706 in Berlin, the color maker Johann Jacob Diesbach was making a red lake pigment from [[cochineal|cochineal]]. According to a story published decades later, he borrowed potash tainted with animal blood from the alchemist Johann Konrad Dippel. Instead of red he got a deep blue, iron ferrocyanide: the first modern synthetic pigment. By 1709 it was being sold as Prussian blue, and a painting from that year, Pieter van der Werff's Entombment of Christ, is the oldest known to use it.",
    "It was strong, stable and far cheaper than [[ultramarine-pigment|ultramarine]], so it spread fast: Watteau was using it in Paris within a few years. Prussian infantry coats were dyed a dark blue of the same name. In 1782 the chemist Carl Wilhelm Scheele isolated a deadly gas from it, hydrogen cyanide, still called prussic acid; 'cyanide' itself comes from the Greek for dark blue.",
    "Then it crossed the world. Japanese printmakers had no lasting bright blue until imported Prussian blue reached them, and Hokusai's [[painting-great-wave|The Great Wave off Kanagawa]] (1831), the first print in his Thirty-six Views of Mount Fuji, helped make it the color of a whole printmaking boom. In 1842 John Herschel's cyanotype process used light to form Prussian blue on paper, which is why architects' copies became 'blueprints'.",
    "It has a second life in medicine. Swallowed, Prussian blue traps thallium and radioactive cesium in the gut, and it's on the World Health Organization's list of essential medicines. Its deep tone sits near [[Navy|navy]] and [[Midnight blue|midnight blue]], and mixed with white it gives the soft [[Steel blue|steel blues]] of the Great Wave's sky."
  ],
  colors: ["Navy", "Steel blue"],
  swatches: [
    { h: "#003153", label: "Prussian blue · mass tone (approx.)" },
    { h: "#4F7CAC", label: "Prussian blue · tint with white (approx.)" }
  ],
  year: 1706,
  yearNote: "Made by Diesbach in Berlin, around 1706",
  facts: [
    { label: "Made from", value: "Iron salts and ferrocyanide" },
    { label: "First painting", value: "Van der Werff, Entombment of Christ, 1709" },
    { label: "Also", value: "An antidote for thallium and radioactive cesium" }
  ],
  sources: [
    "Kirby, J. & Saunders, D. (2004). Fading and colour change of Prussian blue. National Gallery Technical Bulletin 25.",
    "Bartoll, J. (2008). The early use of Prussian blue in paintings. 9th International Conference on NDT of Art, Jerusalem.",
    "World Health Organization, Model List of Essential Medicines (Prussian blue).",
    "Wikipedia, 'Prussian blue' and 'Cyanotype'."
  ]
},
{
  id: "cobalt-blue-pigment", type: "pigment", title: "Cobalt blue",
  dek: "Chinese potters used cobalt for a thousand years. In 1802 a French chemist made it a painter's blue.",
  body: [
    "Cobalt colored glass and pottery [[Blue|blue]] long before anyone knew the metal existed. It gave Chinese blue-and-white porcelain its blue from about the 8th or 9th century, and European glassmakers ground cobalt glass into a weak blue pigment called smalt. German miners called the troublesome ore kobold, a goblin, because it held no useful metal and gave off poisonous arsenic fumes when smelted, the element later behind the [[arsenic-greens|arsenic greens]]. In the 1730s chemists showed it contained a new metal, named cobalt after the goblin.",
    "The bright pigment came from a government order. The French state wanted a cheaper rival to [[ultramarine-pigment|ultramarine]], and in 1802 the chemist Louis Jacques Thénard produced cobalt aluminate, a clean, stable, slightly cool blue. Commercial production began in 1807, and watercolorists soon recommended it for skies.",
    "Painters from Turner to the [[impressionism|Impressionists]] and [[van-gogh|Van Gogh]] used it. Renoir's The Umbrellas shows how pigments can date a painting: scientists at London's National Gallery found the parts painted around 1881 use vivid cobalt blue, while the parts he repainted around 1885–86 use a greyer mix based on ultramarine.",
    "The app's [[Cobalt|cobalt]] is a strong, slightly cool mid blue, darker than [[Azure|azure]] and less violet than ultramarine. Like many bright pigments, the real thing is toxic if swallowed or inhaled. In 2009, chemists at Oregon State found [[yinmn-blue|YInMn blue]], whose bluest form matches cobalt's color without its toxicity."
  ],
  colors: ["Cobalt", "Cobalt"],
  swatches: [
    { h: "#0047AB", label: "Cobalt blue · Thénard, 1802" },
    { h: "#003399", label: "Smalt · cobalt glass, ground (approx.)" }
  ],
  year: 1802,
  yearNote: "Thénard's cobalt aluminate blue, Paris, 1802",
  facts: [
    { label: "Made from", value: "Cobalt oxide and alumina" },
    { label: "Invented", value: "Louis Jacques Thénard, 1802" },
    { label: "Name", value: "From kobold, a mine goblin" }
  ],
  sources: [
    "Bomford, D. et al. (1990). Art in the Making: Impressionism. National Gallery, London.",
    "National Gallery, London. Renoir's The Umbrellas: pigment analysis.",
    "Wikipedia, 'Cobalt blue' and 'Cobalt'."
  ]
},
{
  id: "indigo-dye", type: "pigment", title: "Indigo dye",
  dek: "The world's favorite blue dye comes out of the vat yellow-green and turns blue in the air.",
  body: [
    "Indigo is the blue of jeans, and one of the oldest dyes on earth. The oldest known indigo-dyed cloth, about 6,000 years old, was found at Huaca Prieta in Peru. The main source plant, Indigofera tinctoria, was domesticated in India, and the Greek name indikon, 'from India', became our word [[Indigo|indigo]]. Europe used a plant with the same dye, woad, until sea trade brought cheaper Indian indigo; woad interests got it restricted in parts of 16th-century Europe.",
    "Dyeing with it is a small miracle. Indigo doesn't dissolve in water, so dyers ferment or chemically reduce it into a soluble, yellowish 'white indigo'. Cloth dipped in that bath comes out yellow-green, then turns blue before your eyes as air oxidizes the dye back. Each dip adds a layer, which is why indigo goes from pale [[Sky blue|sky]] to near-[[Navy|navy]].",
    "Its history is also one of forced labor and revolt: plantations in the Americas were worked by enslaved people, and in 1859 Bengal's indigo farmers rose against European planters. Then chemistry took over, as it had for purple with [[mauveine|mauveine]]. Adolf von Baeyer synthesized indigo in 1878–80, and by 1897 BASF sold synthetic indigo at scale. Natural production collapsed within two decades.",
    "Today most indigo is synthetic, and most goes into [[Denim|denim]]. It also sits inside the rainbow by accident: [[isaac-newton|Newton]] named indigo as one of seven [[spectrum|spectral colors]], partly to match the seven notes of a scale, which is why the app's indigo is a violet-blue while the dye is a deep blue."
  ],
  colors: ["Navy", "Denim", "Khaki"],
  swatches: [
    { h: "#233A5E", label: "Indigo dye · many dips (approx.)" },
    { h: "#3B638C", label: "Denim · indigo on cotton" },
    { h: "#C9C25A", label: "Leuco-indigo bath · yellow-green (approx.)" }
  ],
  year: -4000,
  yearNote: "Oldest indigo-dyed cloth, Peru, c. 6,000 years ago",
  facts: [
    { label: "Made from", value: "Indigofera leaves (also woad); now synthetic" },
    { label: "Synthesis", value: "Baeyer 1878–80; BASF commercial 1897" },
    { label: "Name", value: "Greek indikon, 'from India'" }
  ],
  sources: [
    "Splitstoser, J. C. et al. (2016). Early pre-Hispanic use of indigo blue in Peru. Science Advances 2(9): e1501623.",
    "Balfour-Paul, J. (1998). Indigo. British Museum Press.",
    "Wikipedia, 'Indigo dye'."
  ]
},
{
  id: "tyrian-purple", type: "pigment", title: "Tyrian purple",
  dek: "A dye milked from sea snails, worth its weight in silver, that smelled of rotting fish.",
  body: [
    "Tyrian purple comes from the glands of predatory sea snails, the murex. Crush or 'milk' them, let the secretion react with light and air, and it turns from clear to a deep red-purple: 6,6'-dibromoindigo, a cousin of [[indigo-dye|indigo]] with bromine from the sea. Phoenicians were producing it by around 1200 BCE, and it's named for their city of Tyre.",
    "It was staggeringly expensive. The Greek historian Theopompus wrote that purple dye fetched its weight in silver, and when the chemist Paul Friedländer worked it out in the early 1900s, 12,000 snails gave 1.4 grams of pure dye. That cost made it the badge of rank in Rome and Byzantium (see [[royal-purple|purple and power]]).",
    "It also stank. Ancient writers complained of the smell of the dye works, where heaps of snails rotted in vats, and an Egyptian papyrus says a dyer's hands reek of rotten fish. Cloth could be dyed shades from a near-black, [[Oxblood|oxblood]]-like 'clotted blood' to [[Violet|violet]] by mixing species and double-dipping.",
    "Imperial production ended when crusaders sacked Constantinople in 1204, and the recipe was lost. When chemists built cheap purples in the 1850s, starting with [[william-perkin|William Perkin]]'s [[mauveine|mauveine]], purple stopped meaning money. The app's [[Byzantium|Byzantium]] and [[Purple|purple]] are the nearest names."
  ],
  colors: ["Byzantium", "Plum"],
  swatches: [
    { h: "#66023C", label: "Tyrian purple · red-purple (approx.)" },
    { h: "#8F3B8F", label: "Tyrian purple · violet shade (approx.)" }
  ],
  year: -1200,
  yearNote: "Phoenician production by about 1200 BCE",
  facts: [
    { label: "Made from", value: "Murex sea snails" },
    { label: "Chemistry", value: "6,6'-dibromoindigo" },
    { label: "Yield", value: "~12,000 snails for 1.4 g of dye" }
  ],
  sources: [
    "Cooksey, C. J. (2001). Tyrian purple: 6,6'-dibromoindigo and related compounds. Molecules 6(9): 736–769.",
    "Friedländer, P. (1909). Über den Farbstoff des antiken Purpurs aus Murex brandaris. Berichte der deutschen chemischen Gesellschaft 42.",
    "Wikipedia, 'Tyrian purple'."
  ]
},
{
  id: "cochineal", type: "pigment", title: "Cochineal and carmine",
  dek: "Crushed cactus bugs made the reddest red of the old world, and they're still in your lipstick.",
  body: [
    "Cochineal is a small scale insect that lives on prickly pear cactus in Mexico and Peru. The females make carminic acid, up to about a fifth of their dry weight, to fend off predators. Dried and crushed, they give a brilliant [[Crimson|crimson]], sold as [[Carmine|carmine]]. It takes around 70,000 insects to make a pound of dye. People in the Americas were using it by the 2nd century BCE, and Aztec tribute lists record towns paying in bags of cochineal.",
    "After the Spanish conquest of the Aztec Empire, cochineal crossed the Atlantic in the 1520s and became New Spain's second most valuable export after silver. It was stronger than Europe's old insect red, [[kermes|kermes]], and replaced it. Dyers made scarlets and [[Crimson|crimsons]], including for British soldiers' red coats, and painters used it as carmine, a red 'lake' pigment.",
    "Lake pigments like carmine fade in light, a weakness already known in the 1400s. Many old paintings have lost their reds, which is why some skies and fabrics look different from what the painter mixed. [[van-gogh|Van Gogh]] described the walls of his Bedroom as pale violet; in the painting they now look blue, because a red pigment in the mix has faded.",
    "Carmine never left. Like [[saffron-dye|saffron]], it still colors food, and cosmetics too, labeled E120 or 'natural red 4', which surprises vegetarians. Peru is now the biggest producer. The app's [[Carmine|carmine]] and [[Crimson|crimson]] come from this dye's names."
  ],
  colors: ["Carmine", "Crimson"],
  swatches: [
    { h: "#960018", label: "Carmine · cochineal lake" },
    { h: "#DC143C", label: "Crimson · cochineal-dyed silk (approx.)" }
  ],
  year: -200,
  yearNote: "Used in the Americas by the 2nd century BCE",
  facts: [
    { label: "Made from", value: "Dactylopius coccus insects" },
    { label: "Insects per pound", value: "About 70,000" },
    { label: "Food code", value: "E120" }
  ],
  sources: [
    "Greenfield, A. B. (2005). A Perfect Red: Empire, Espionage, and the Quest for the Color of Desire. HarperCollins.",
    "Van Gogh Museum. The Bedroom: research into faded colors.",
    "Wikipedia, 'Cochineal'."
  ]
},
{
  id: "kermes", type: "pigment", title: "Kermes",
  dek: "Before cochineal, Europe's luxury red came from tiny insects on oak trees, mistaken for grain.",
  body: [
    "Kermes is a red dye made from the dried bodies of a scale insect, Kermes vermilio, that lives on the kermes oak around the Mediterranean. Egyptians, Mesopotamians, Greeks and Romans used it, and jars of it have turned up in a Neolithic cave burial in Provence. Its color is a deep [[Red|red]], a true [[Crimson|crimson]].",
    "The name traveled far. It goes back to Sanskrit krmija, 'made by a worm', then Persian and Arabic qirmiz, and from there to our words [[Crimson|crimson]] and [[Carmine|carmine]]. Medieval Europeans thought the dried insects were seeds and called the dye 'grain', so cloth dyed with it was 'dyed in the grain'.",
    "In the Middle Ages, kermes-dyed scarlet wool and crimson silk were the most prized cloths in Europe, more desirable than the lost [[tyrian-purple|Tyrian purple]]. Wool dyed blue with woad and then dipped in kermes gave purples and near-blacks.",
    "Then the Spanish brought [[cochineal|cochineal]] from Mexico. It was several times stronger, so less was needed, and kermes faded from the market. The app's [[Scarlet|scarlet]] and [[Crimson|crimson]] carry its legacy. The other great medieval red, [[vermilion-pigment|vermilion]], was a mineral, not a bug."
  ],
  colors: ["Raspberry", "Crimson"],
  swatches: [
    { h: "#A91B3A", label: "Kermes crimson (approx.)" },
    { h: "#DC143C", label: "Crimson · named via Arabic qirmiz" }
  ],
  facts: [
    { label: "Made from", value: "Kermes vermilio insects on oak" },
    { label: "Name", value: "Sanskrit krmija, 'worm-made'" },
    { label: "Replaced by", value: "Cochineal, 16th century" }
  ],
  sources: [
    "Munro, J. H. (2007). The anti-red shift: to the dark side. Colour changes in Flemish luxury woollens, 1300–1550. Medieval Clothing and Textiles 3.",
    "Cardon, D. (2007). Natural Dyes: Sources, Tradition, Technology and Science. Archetype.",
    "Wikipedia, 'Kermes (dye)'."
  ]
},
{
  id: "vermilion-pigment", type: "pigment", title: "Vermilion and cinnabar",
  dek: "Ground from a mercury ore, then cooked up by alchemists, vermilion was painting's great red for centuries.",
  body: [
    "Cinnabar is a heavy [[Red|red]] mineral, mercury sulfide, and ground cinnabar is the pigment [[Vermilion|vermilion]]. People used it at Çatalhöyük in Turkey around 8000–7000 BCE, making it one of the oldest paints after the [[earth-pigments|earth pigments]]. Rome's main source was the Almadén mine in Spain, worked by prisoners because mercury is poisonous; Pliny says the ore was shipped to Rome under seal at a fixed price. It colored the walls of Pompeii's Villa of the Mysteries.",
    "Mining was dangerous, so people learned to make it. Heat mercury with sulfur and you get black mercury sulfide, which turns brilliant red when sublimed or ground. Chinese alchemists probably did this by the 4th century BCE, and the method reached Europe by the 8th or 9th century (see [[alchemy|alchemy]]). Cennino Cennini noted that the longer you grind it, the better the red.",
    "From the Renaissance to the 1900s vermilion was painters' main bright red, and in China it colored the famous red lacquer. It has two flaws: it's toxic, and on walls it can darken to purplish [[Grey|grey]] or [[Black|black]] as light breaks it down, which is why some old frescoes have black patches where red once was. In the 20th century cadmium red replaced it, though Munch still used vermilion in [[painting-the-scream|The Scream]] (1893).",
    "The app's [[Vermilion|vermilion]] is an orange-leaning red, warmer than [[Crimson|crimson]] and [[Carmine|carmine]]; Kandinsky wrote that it has the charm of flame. Oddly, its name comes from Latin vermiculus, 'little worm', though vermilion is a mineral red, not an insect red like [[kermes|kermes]]."
  ],
  colors: ["Vermilion", "Vermilion", "Umber"],
  swatches: [
    { h: "#E34234", label: "Vermilion · ground or synthetic HgS" },
    { h: "#E44D2E", label: "Cinnabar · the ore (approx.)" },
    { h: "#4B3B3B", label: "Darkened vermilion · light damage (approx.)" }
  ],
  year: -7500,
  yearNote: "Ground cinnabar at Çatalhöyük, c. 8000–7000 BCE",
  facts: [
    { label: "Made from", value: "Mercury sulfide (cinnabar, or mercury + sulfur)" },
    { label: "Synthesis", value: "China by c. 4th century BCE; Europe by the 8th–9th century" },
    { label: "Replaced by", value: "Cadmium red, 20th century" }
  ],
  sources: [
    "Gettens, R. J., Feller, R. L. & Chase, W. T. (1993). Vermilion and cinnabar. In Artists' Pigments, vol. 2. National Gallery of Art, Washington.",
    "Pliny the Elder, Natural History, Book XXXIII.",
    "Wikipedia, 'Vermilion'."
  ]
},
{
  id: "lead-white", type: "pigment", title: "Lead white",
  dek: "For two thousand years the painter's white was poison, made by burying lead in vinegar and dung.",
  body: [
    "Lead white, basic lead carbonate, was the main [[White|white]] of painting from antiquity into the 1800s. The recipe barely changed: put strips of lead over vinegar in clay pots and let the acid fumes corrode them into a white crust. Theophrastus described making it around 300 BCE. In 17th-century Holland, in [[vermeer|Vermeer]]'s day, the 'stack' or 'Dutch' process added stacks of pots buried in horse manure or tanbark, whose heat and carbon dioxide sped the reaction.",
    "Painters loved it. It's dense, opaque, flexible and quick-drying in oil, perfect for flesh, highlights and thick impasto, and for mixing tints, as in the [[Sky blue|sky blues]] of countless landscapes, mixed from lead white and [[ultramarine-pigment|ultramarine]] or [[prussian-blue|Prussian blue]]. Because lead blocks X-rays, lead white shows up bright in X-ray images of paintings, revealing hidden first ideas and the 'skeleton' under the picture.",
    "It was also a cosmetic. In Greece, China, Japan and 18th-century Europe, people whitened their faces with lead, despite well-known poisoning. Painters and lead workers suffered 'painter's colic', a form of lead poisoning.",
    "Zinc white arrived in the 19th century and titanium white in the 20th, and today lead white is restricted and sold with warnings. The [[White|white]] in the app is a screen white; the warm, slightly creamy white of old paintings is closer to [[Ivory|ivory]]. [[vermeer|Vermeer]] built the light of [[painting-milkmaid|The Milkmaid]]'s wall from lead white, umber and charcoal black."
  ],
  colors: ["White", "Ivory"],
  swatches: [
    { h: "#EEEBE3", label: "Lead white · in oil (approx.)" },
    { h: "#FFFFF0", label: "Ivory · aged lead white (approx.)" }
  ],
  year: -300,
  yearNote: "Lead-and-vinegar recipe in Theophrastus, c. 300 BCE",
  facts: [
    { label: "Made from", value: "Lead corroded by vinegar fumes" },
    { label: "Seen in", value: "X-rays of paintings" },
    { label: "Replaced by", value: "Zinc white, then titanium white" }
  ],
  sources: [
    "Gettens, R. J., Kühn, H. & Chase, W. T. (1993). Lead white. In Artists' Pigments, vol. 2. National Gallery of Art, Washington.",
    "Theophrastus, On Stones (De lapidibus).",
    "Wikipedia, 'Lead white'."
  ]
},
{
  id: "arsenic-greens", type: "pigment", title: "Scheele's green and the arsenic greens",
  dek: "The bright greens of the 1800s were made with arsenic, and they ended up in wallpaper, dresses and sweets.",
  body: [
    "In 1775 the Swedish chemist Carl Wilhelm Scheele made a vivid yellow-green from copper and arsenic. Scheele's green was brighter than older copper greens like [[verdigris|verdigris]] and [[malachite-pigment|malachite]], and by the 19th century it colored paints, wallpapers, fabrics, candles, book covers, toys, and even green sweets. In 1814 two German paint makers in Schweinfurt made a more durable version, [[Emerald|emerald]] green, later sold as Paris green. Both darken and fail in the presence of sulfur.",
    "The danger was real. Victorian papers reported children sickening in [[Green|green]] rooms and ladies fainting in green dresses. In 1861 a 19-year-old woman who dusted artificial leaves with the pigment died of arsenic poisoning, and the story fed public alarm. Damp, moldy wallpaper was blamed for giving off arsenic gas; modern work suggests that gas was less toxic than feared, and that flaking dust was the bigger hazard.",
    "Did green wallpaper kill Napoleon? His rooms on St Helena were green, and his hair held arsenic. But most researchers now think he died of stomach cancer. The wallpaper story is unproven, like many [[color-psychology|color myths]]. Meanwhile William Morris, whose wallpapers made pattern fashionable, was a director of Devon Great Consols, a mine that became one of the world's largest arsenic producers.",
    "By the 1890s arsenic wallpapers had stopped, though Paris green lived on as an insecticide. Painters moved to safe greens like [[viridian-pigment|viridian]]. The app's [[Emerald|emerald]] and [[Kelly green|Kelly green]] are about as loud as these greens were."
  ],
  colors: ["Forest green", "Emerald"],
  swatches: [
    { h: "#478800", label: "Scheele's green (modern match)" },
    { h: "#50C878", label: "Emerald or Paris green (approx.)" }
  ],
  year: 1775,
  yearNote: "Scheele's green invented in Sweden, 1775",
  facts: [
    { label: "Made from", value: "Copper and arsenic compounds" },
    { label: "Emerald (Paris) green", value: "Schweinfurt, 1814" },
    { label: "Napoleon theory", value: "Unproven; stomach cancer favored" }
  ],
  sources: [
    "Whorton, J. C. (2010). The Arsenic Century: How Victorian Britain Was Poisoned at Home, Work, and Play. Oxford University Press.",
    "Hawksley, L. (2016). Bitten by Witch Fever: Wallpaper & Arsenic in the Victorian Home. Thames & Hudson.",
    "Wikipedia, 'Scheele's green' and 'Paris green'."
  ]
},
{
  id: "verdigris", type: "pigment", title: "Verdigris",
  dek: "The green crust on old copper, scraped off and ground into paint. Gorgeous, cheap, and prone to turning brown.",
  body: [
    "Verdigris is the name for [[Green|green]] and blue-green copper acetates, the crust that forms when copper meets acid. Painters made it on purpose: in the Middle Ages, copper strips over vinegar, buried in dung for a few weeks (much like [[lead-white|lead white]]), then scraped. In 18th-century Montpellier, women ran a cellar industry, stacking copper plates in clay pots with wine and scraping off the crystals; most of it was exported.",
    "The name is a puzzle. Old French verte grez became English verdigris. One theory reads it as 'green of vinegar'; the more popular one is vert de Grèce, 'green of Greece', because the pigment was long imported from there. It sits near the app's [[Jade|jade]] and [[Teal|teal]].",
    "It was the brightest green available to painters for centuries, used in panel paintings, manuscripts and maps. Its weakness is time. Cooked into a resin glaze ('copper resinate'), it slowly turns brown, so many late-medieval and Renaissance landscapes and robes that were green now look brown or dark. In the Mystical Nativity of 1500 by Botticelli, painter of [[painting-birth-of-venus|The Birth of Venus]], the angels' blue-green robes have darkened.",
    "The green patina on the Statue of Liberty is often called verdigris, but it's mostly other copper salts, sulfates and chlorides formed by weather. Painters dropped verdigris for steadier greens like [[viridian-pigment|viridian]], after a detour through toxic [[arsenic-greens|arsenic greens]]. Its cousin [[malachite-pigment|malachite]] is a natural copper green."
  ],
  colors: ["Turquoise", "Teal", "Sepia"],
  swatches: [
    { h: "#43B3AE", label: "Verdigris · copper acetate (approx.)" },
    { h: "#1F7F78", label: "Verdigris glaze · when new (approx.)" },
    { h: "#7A6340", label: "Copper resinate · browned with age (approx.)" }
  ],
  facts: [
    { label: "Made from", value: "Copper exposed to vinegar or wine acids" },
    { label: "Name", value: "Probably vert de Grèce, 'green of Greece'" },
    { label: "Weakness", value: "Turns brown as a resin glaze" }
  ],
  sources: [
    "Kühn, H. (1993). Verdigris and copper resinate. In Artists' Pigments, vol. 2. National Gallery of Art, Washington.",
    "National Gallery, London. Botticelli, Mystical Nativity: technical notes.",
    "Wikipedia, 'Verdigris'."
  ]
},
{
  id: "viridian-pigment", type: "pigment", title: "Viridian",
  dek: "A clear, cool, safe green that replaced the poisonous ones. Its recipe was a secret until 1859.",
  body: [
    "Viridian is a hydrated chromium oxide, a deep, transparent blue-[[Green|green]], colored by the same element as [[chrome-yellow|chrome yellow]]. Its name is just Latin viridis, 'green'. The Paris color maker Pannetier and his assistant Binet first made it in 1838, but their process was slow, costly and secret. In 1859 the chemist C. E. Guignet patented a cheaper method, and viridian became a standard tube color.",
    "Painters valued it because it was everything the [[arsenic-greens|arsenic greens]] were not: permanent, stable with other pigments and non-toxic. It's transparent, so it glazes beautifully and mixes clean. J. M. W. Turner was using it by 1840, Winsor & Newton listed it by 1849, and [[monet|Monet]] used it widely in his Gare Saint-Lazare of 1877, now in London's National Gallery. Munch used it in [[painting-the-scream|The Scream]] (1893).",
    "Viridian is strong and cool. Mixed with [[Cobalt|cobalt]] blue it gives sea greens; with yellow, fresh grass greens; with [[Red|red]], rich dark neutrals, since red and green are painter's-wheel [[complementary-colors|complements]].",
    "The app's [[Viridian|viridian]] is a dark, muted blue-green, darker than [[Jade|jade]] and less blue than [[Teal|teal]]. It was one of the bright modern pigments that let the [[impressionism|Impressionists]] paint outdoor light."
  ],
  colors: ["Viridian", "Bottle green"],
  swatches: [
    { h: "#40826D", label: "Viridian · chromium oxide green" },
    { h: "#006A4E", label: "Viridian · mass tone (approx.)" }
  ],
  year: 1838,
  yearNote: "First made by Pannetier in Paris, 1838",
  facts: [
    { label: "Made from", value: "Hydrated chromium(III) oxide" },
    { label: "Cheap process", value: "Guignet's patent, 1859" },
    { label: "Name", value: "Latin viridis, 'green'" }
  ],
  sources: [
    "Newman, R. (1997). Chromium oxide greens. In Artists' Pigments, vol. 3. National Gallery of Art, Washington.",
    "Bomford, D. et al. (1990). Art in the Making: Impressionism. National Gallery, London.",
    "Wikipedia, 'Viridian'.",
    "ColourLex, 'Claude Monet, The Gare Saint-Lazare' (National Gallery, London, NG6479): viridian used extensively."
  ]
},
{
  id: "malachite-pigment", type: "pigment", title: "Malachite",
  dek: "A banded green copper stone, worn as eye paint in Egypt and carved into whole rooms by Russian tsars.",
  body: [
    "Malachite is a copper carbonate mineral, green with swirling bands of light and dark. The name comes through Latin from Greek molochites, 'mallow-green stone', after the color of mallow leaves. Ground up, it makes a [[Green|green]] pigment that painters used from antiquity until about 1800, when cheaper synthetic greens took over, its own synthetic twin among them and later the [[arsenic-greens|arsenic greens]].",
    "In ancient Egypt [[Green|green]], wadj, meant new life and resurrection, and the afterlife included a 'Field of Malachite'. Green malachite eye paint was part of burial goods, even in modest tombs. It was also a copper ore: at Timna in today's Israel, people mined and smelted it for copper thousands of years ago.",
    "Its most lavish use is decorative. Russian tsars, supplied from mines in the Urals, paneled rooms in it; the Malachite Room of St Petersburg's Winter Palace (now the Hermitage) is the famous example. Malachite also appears in Chinese art from the Eastern Zhou period.",
    "As a pigment it's only moderately lightfast and sensitive to acid, and it often sits next to its blue twin, azurite, in the same rocks; its man-made copper cousin is [[verdigris|verdigris]]. The app's [[Malachite|malachite]] is brighter and more electric than the stone, closer to a screen green; the mineral's real banded greens run nearer [[Emerald|emerald]] and [[Bottle green|bottle green]]."
  ],
  colors: ["Jade", "Bottle green", "Malachite"],
  swatches: [
    { h: "#3FA36B", label: "Malachite stone · light band (approx.)" },
    { h: "#0B5D3B", label: "Malachite stone · dark band (approx.)" },
    { h: "#0BDA51", label: "Malachite · the app's color name" }
  ],
  facts: [
    { label: "Made from", value: "Copper carbonate hydroxide mineral" },
    { label: "Name", value: "Greek molochites, 'mallow-green stone'" },
    { label: "Famous room", value: "Malachite Room, Hermitage, St Petersburg" }
  ],
  sources: [
    "Gettens, R. J. & FitzHugh, E. W. (1993). Malachite and green verditer. In Artists' Pigments, vol. 2. National Gallery of Art, Washington.",
    "State Hermitage Museum. The Malachite Room.",
    "Wikipedia, 'Malachite'."
  ]
},
{
  id: "mummy-brown", type: "pigment", title: "Mummy brown",
  dek: "A brown paint made from ground-up Egyptian mummies, sold into the 20th century. Really.",
  body: [
    "Mummy brown was exactly what it sounds like: the remains of Egyptian mummies, human and cat, ground and mixed with white pitch and myrrh. It made a warm, transparent brown between raw and burnt [[Umber|umber]], good for glazes and shadows. By 1712 a Paris color shop called 'À la momie' sold paints, varnish and powdered mummy, and a 1797 London guide recommended mummy flesh as the finest brown glaze.",
    "It went with a broader trade. Ground mummy, mumia, was also sold as medicine in early modern Europe. Painters including Delacroix, Burne-Jones and Alma-Tadema are thought to have used the pigment, though few paintings have been tested, because the test destroys a sample.",
    "The most famous story is true, as far as we know. In 1881 Edward Burne-Jones learned from Alma-Tadema, who had seen a mummy at his color maker's being ground up, that the name was literal. His wife Georgiana wrote that he insisted on giving his tube a “decent burial there and then” in the garden.",
    "Supplies of mummies and demand both dried up. In 1964 Time reported that London's C. Roberson & Co., the last supplier, had run out a few years before. A Roberson tube survives in Harvard's Forbes Pigment Collection. Today's 'mummy brown' paints are iron-oxide mixes, closer to [[Sepia|sepia]] and [[Umber|umber]] (see [[earth-pigments|earth pigments]])."
  ],
  colors: ["Sienna", "Sepia"],
  swatches: [
    { h: "#8F4B28", label: "Mummy brown · transparent glaze (approx.)" },
    { h: "#8A6A4F", label: "Sepia · a near neighbor" }
  ],
  year: 1712,
  yearNote: "Sold in Paris by 1712 (start date unclear)",
  facts: [
    { label: "Made from", value: "Ground mummies, white pitch and myrrh" },
    { label: "Last supplier", value: "C. Roberson & Co., London; out of mummies by about 1960" },
    { label: "Famous burial", value: "Burne-Jones's tube, 1881" }
  ],
  sources: [
    "Burne-Jones, G. (1904). Memorials of Edward Burne-Jones. Macmillan.",
    "Woodcock, S. (1996). Body colour: the misuse of mummy. The Conservator 20(1): 87–94.",
    "Harvard Art Museums, Forbes Pigment Collection.",
    "Wikipedia, 'Mummy brown'."
  ]
},
{
  id: "saffron-dye", type: "pigment", title: "Saffron",
  dek: "Each crocus gives three red threads. A kilo takes about 150,000 flowers, picked by hand.",
  body: [
    "Saffron is the dried stigmas of the saffron crocus, Crocus sativus, a sterile plant that only reproduces when people dig up and replant its bulbs. Each [[Lilac|lilac]]-purple flower carries three [[Crimson|crimson]] threads. About 150,000 flowers, picked by hand in a few autumn weeks, make one kilogram, and premium saffron sells for thousands of dollars a kilo.",
    "Its color comes from crocin, a water-soluble carotenoid that turns rice, cloth and water [[Gold|golden]] yellow. That made it a dye as well as a spice: saffron-dyed textiles were known in Levantine cities like Sidon and Tyre, home of [[tyrian-purple|Tyrian purple]], and in China and India. Aegean frescoes of about 1600 BCE show crocus gathering, and the name comes from Arabic za'faran, of uncertain origin; one guess traces it to a Persian word meaning 'gold-feathered'.",
    "Because it's so costly, 'saffron' often means something cheaper. Medieval Europeans called turmeric 'Indian saffron', safflower is sold as 'Portuguese saffron', and powdered saffron is easily faked with turmeric and paprika. The color word 'saffron' usually means a deep yellow-orange, near the app's [[Marigold|marigold]] and [[Amber|amber]].",
    "Saffron sits in the long list of colors named for costly materials, alongside [[ultramarine-pigment|ultramarine]], [[tyrian-purple|Tyrian purple]] and [[Gold|gold]]. The yellow it gives is warm and luminous, the opposite of the cheap earth [[Ochre|ochre]]."
  ],
  colors: ["Marigold", "Amber", "Carmine"],
  swatches: [
    { h: "#F4A81D", label: "Saffron yellow · dyed cloth (approx.)" },
    { h: "#FFBF00", label: "Amber · a near neighbor" },
    { h: "#9B1B1E", label: "Saffron threads · dried stigmas (approx.)" }
  ],
  year: -1600,
  yearNote: "Crocus gathering in Aegean frescoes, c. 1600 BCE",
  facts: [
    { label: "Made from", value: "Stigmas of Crocus sativus" },
    { label: "Flowers per kilo", value: "About 150,000" },
    { label: "Color molecule", value: "Crocin, a carotenoid" }
  ],
  sources: [
    "Willard, P. (2001). Secrets of Saffron: The Vagabond Life of the World's Most Seductive Spice. Beacon Press.",
    "Cardon, D. (2007). Natural Dyes: Sources, Tradition, Technology and Science. Archetype.",
    "Wikipedia, 'Saffron'."
  ]
},
{
  id: "mauveine", type: "pigment", title: "Mauveine and the aniline dyes",
  dek: "An 18-year-old chasing a malaria drug made purple instead, and launched the chemical industry.",
  body: [
    "In the Easter holidays of 1856, [[william-perkin|William Perkin]], an 18-year-old student of the chemist August Wilhelm von Hofmann, was trying to make quinine, the malaria drug, from coal-tar chemicals in his home lab in east London. One attempt left a black sludge. Cleaning it out with alcohol, he saw a vivid purple. It dyed silk and didn't wash out.",
    "It was not the very first synthetic dye: picric acid, a yellow, was dyeing silk in Lyon from 1845. Mauveine was the first aniline dye, made from coal tar, and it became a fashion sensation. Perkin patented it that August, and in 1857 opened a dye works at Greenford, west of London. Perkin first marketed it as 'Tyrian purple', and it was also called aniline purple; by 1859 it was [[Mauve|mauve]], after the French word for the mallow flower. Empress Eugénie and Queen Victoria wore the color, the crinoline's huge skirts used yards of cloth, and by 1859 the craze was so big that Punch joked about 'the mauve measles'.",
    "Mauveine opened the floodgates. Chemists across Europe raced to make new colors from aniline. In France, François-Emmanuel Verguin made a red-purple he called fuchsine; a British firm sold a similar dye as roseine, then, by 1860, as [[Magenta|magenta]], after the Battle of Magenta in June 1859. Then came synthetic alizarin reds and, by 1897, synthetic [[indigo-dye|indigo]]. Germany came to dominate the industry.",
    "The result was a democratization of color. Purples that once needed [[tyrian-purple|sea snails]] were now a few pence a ribbon (see [[royal-purple|purple and power]]), though dye workers paid a price: aniline dye work was later linked to bladder cancer. The app's [[Mauve|mauve]] today is a soft greyish purple, much duller than Perkin's original bright violet-purple."
  ],
  colors: ["Plum", "Magenta", "Mauve"],
  swatches: [
    { h: "#8F3B8F", label: "Mauveine · Perkin's purple (approx.)" },
    { h: "#FF00FF", label: "Magenta · fuchsine, 1859" },
    { h: "#A8778F", label: "Mauve · today's soft meaning" }
  ],
  year: 1856,
  yearNote: "Discovered by William Perkin in London, 1856",
  facts: [
    { label: "Made from", value: "Aniline from coal tar, oxidized" },
    { label: "Discovered", value: "Easter 1856, by an 18-year-old" },
    { label: "Name", value: "French mauve, the mallow flower" }
  ],
  sources: [
    "Garfield, S. (2000). Mauve: How One Man Invented a Color That Changed the World. Faber & Faber.",
    "Royal Society of Chemistry. William Henry Perkin and mauveine.",
    "Wikipedia, 'Mauveine', 'William Henry Perkin' and 'Magenta'."
  ]
},
{
  id: "chrome-yellow", type: "pigment", title: "Chrome yellow",
  dek: "The bright new yellow of Van Gogh's Sunflowers, and of North American school buses. It darkens with time.",
  body: [
    "In 1797 the French chemist Louis Nicolas Vauquelin studied crocoite, a bright [[Orange|orange]] mineral from Siberia, and found a new element in it: chromium, from Greek chroma, color, because its compounds are so colorful; chromium also gives [[viridian-pigment|viridian]] its green. Lead chromate made in the lab gave a range of strong yellows to oranges, and a painting by Sir Thomas Lawrence from before 1810 is the earliest known to use it. It joined older yellows, from earthy [[Ochre|ochre]] to costly [[saffron-dye|saffron]].",
    "Chrome yellow was cheap and intense, and painters seized it. [[van-gogh|Van Gogh]] built his [[painting-sunflowers|Sunflowers]] of 1888 from several shades of it. In 1939 a conference of US school transport officials picked a yellow-orange for school buses, originally named National School Bus Chrome and made with lead chromate, because black lettering on it read best at dusk.",
    "It has two problems. It contains lead and chromate, both toxic. And it can darken: light and sulfur in the air turn some chrome yellows brownish, and scientists studying [[van-gogh|Van Gogh]]'s paintings found the paler, sulfur-rich varieties darken most. Some of his yellows were brighter when he painted them.",
    "Cadmium yellow replaced it for artists, and organic pigments have largely replaced both. The app's [[Canary|canary]] and [[Yellow|yellow]] are close to the lemon end of the chrome range, [[Amber|amber]] and [[Marigold|marigold]] to the deep end."
  ],
  colors: ["Gold", "Marigold", "Burnt orange"],
  swatches: [
    { h: "#FFD300", label: "Chrome yellow · lemon (approx.)" },
    { h: "#F0A818", label: "Chrome yellow · deep (approx.)" },
    { h: "#D86A1A", label: "Chrome orange (approx.)" }
  ],
  year: 1809,
  yearNote: "Earliest known use: a Lawrence painting, before 1810",
  facts: [
    { label: "Made from", value: "Lead chromate" },
    { label: "Element found", value: "Chromium, Vauquelin, 1797" },
    { label: "School bus yellow", value: "Chosen in 1939, first made with lead chromate" }
  ],
  sources: [
    "Monico, L. et al. (2011). Degradation process of lead chromate in paintings by Vincent van Gogh studied by means of synchrotron X-ray spectromicroscopy. Analytical Chemistry 83(4): 1214–1223.",
    "Kühn, H. & Curran, M. (1986). Chrome yellow and other chromate pigments. In Artists' Pigments, vol. 1. National Gallery of Art, Washington.",
    "Wikipedia, 'Chrome yellow' and 'School bus yellow'."
  ]
},
{
  id: "yinmn-blue", type: "pigment", title: "YInMn blue",
  dek: "Found by accident in an Oregon lab in 2009 while chemists were hunting for electronics materials.",
  body: [
    "In 2009, Mas Subramanian and his graduate student Andrew Smith at Oregon State University were heating oxides to explore materials for electronics. One sample, made of yttrium, indium and manganese oxides fired to about 1,200 °C, came out an intense, near-perfect [[Blue|blue]]. The name is just the chemical symbols: Y, In, Mn.",
    "Its blue comes from manganese ions held in an unusual crystal arrangement. The pigment is stable, doesn't fade, resists acid, and is non-toxic, a selling point against [[cobalt-blue-pigment|cobalt blue]], whose color its bluest form matches. It also reflects infrared strongly, so surfaces painted with it stay cooler in the sun.",
    "Commercial use was slow. A US supplier got the environmental approvals to sell it in 2020, and artists' paint makers released small batches after that; the raw pigment is still scarce and expensive, as [[ultramarine-pigment|ultramarine]] once was. Crayola's 2017 crayon 'Bluetiful' was inspired by YInMn but contains none of it.",
    "Changing the indium-to-manganese ratio shifts the color, and the same chemistry has since produced new greens, purples and oranges. Its blue sits between the app's [[Cobalt|cobalt]] and [[Royal blue|royal blue]], and it carries on the long hunt for blues that began with [[egyptian-blue|Egyptian blue]] and [[ultramarine-pigment|ultramarine]]."
  ],
  colors: ["Cobalt", "Royal blue"],
  swatches: [
    { h: "#2E5090", label: "YInMn blue (approx.)" },
    { h: "#4169E1", label: "Royal blue · a near neighbor" }
  ],
  year: 2009,
  yearNote: "Discovered at Oregon State University, 2009",
  facts: [
    { label: "Made from", value: "Oxides of yttrium, indium and manganese" },
    { label: "Discovered", value: "Subramanian and Smith, 2009" },
    { label: "Bonus", value: "Reflects infrared, so it stays cool" }
  ],
  sources: [
    "Smith, A. E., Mizoguchi, H., Delaney, K., Spaldin, N. A., Sleight, A. W. & Subramanian, M. A. (2009). Mn3+ in trigonal bipyramidal coordination: a new blue chromophore. Journal of the American Chemical Society 131(47): 17084–17086.",
    "Wikipedia, 'YInMn Blue'."
  ]
},
{
  id: "vantablack", type: "pigment", title: "Vantablack and the blackest blacks",
  dek: "A forest of carbon nanotubes that swallows 99.965% of light, and an art-world feud over who may use it.",
  body: [
    "Vantablack is not a paint in the usual sense. The original was a coating of carbon nanotubes grown standing up like a microscopic forest; the name means 'vertically aligned nanotube arrays' plus [[Black|black]]. Light that enters bounces between the tubes until it's absorbed as heat. Surrey NanoSystems in England unveiled it in July 2014, and it absorbs up to 99.965% of visible light hitting it head on.",
    "Coat a crumpled sheet or a sculpted face in it and the shape vanishes: the eye sees a flat hole, because there's almost no reflected light to show shading, the light-and-dark [[value|value]] the eye reads as form. That's the point for its main users, telescope and camera makers, who need to kill stray light. Spray-on versions followed, and in 2019 MIT engineers made a material reflecting a tenth as much light as Vantablack.",
    "Then came the feud. In 2016 the sculptor Anish Kapoor got exclusive rights to use Vantablack in art. Many artists objected. The artist Stuart Semple answered with 'The World's Pinkest Pink', sold to anyone who declared they weren't Kapoor; Kapoor got some anyway and posted a photo of his middle finger dipped in it. Semple went on to make cheap matte blacks for everyone (see [[color-trademarks|owning a color]]).",
    "Ordinary [[Black|black]] paint reflects a few percent of light, which is why black cars and shoes still show highlights and shape. Painters often avoid pure black altogether and mix dark [[complementary-colors|complements]] instead, as the [[impressionism|Impressionists]] did."
  ],
  colors: ["Black", "Black"],
  swatches: [
    { h: "#000000", label: "Vantablack · ~0.035% reflected (screen can't show it)" },
    { h: "#16171A", label: "Ordinary black paint · a few % reflected" }
  ],
  year: 2014,
  yearNote: "Unveiled by Surrey NanoSystems, July 2014",
  facts: [
    { label: "Made from", value: "Vertically aligned carbon nanotubes" },
    { label: "Absorbs", value: "Up to 99.965% of visible light" },
    { label: "Art rights", value: "Exclusive to Anish Kapoor since 2016" }
  ],
  sources: [
    "Surrey NanoSystems. Vantablack technical information.",
    "Cui, K. & Wardle, B. L. (2019). Breakdown of native oxide enables multifunctional, free-form carbon nanotube–metal hierarchical architectures. ACS Applied Materials & Interfaces 11(38).",
    "Wikipedia, 'Vantablack' and 'Stuart Semple'."
  ]
},

// ---------------------------------------------------------------- people
{
  id: "aristotle", type: "person", title: "Aristotle",
  dek: "Every color, he said, is a mix of light and dark, and the rainbow has three. Europe agreed for 2,000 years.",
  body: [
    "Aristotle (384–322 BCE) thought colors were born between [[White|white]] and [[Black|black]], light and darkness. In his short work On Sense and the Sensible he suggested that colors are blends of white and black in different proportions, and that the pleasing ones follow simple ratios, like the harmonious intervals of music, an idea that echoes all the way to [[isaac-newton|Newton]]'s musical [[spectrum|rainbow]].",
    "He counted seven species of color, if grey is treated as a kind of black: white, yellow, crimson, violet, leek-green, deep blue and black. He liked the number: he counted seven tastes too, and paired the two lists. Greek itself had many more color words; the much later idea of [[basic-color-terms|basic color terms]] asks which ones every speaker shares.",
    "His [[spectrum|rainbow]], in the Meteorology, had three colors: [[Red|red]], [[Green|green]] and [[Purple|purple]], with yellow appearing between red and green only by contrast. He added that these are colors painters can't mix: “no mixing will give red, green, or purple.” He was wrong about how the rainbow forms, but his careful look at it was unmatched for centuries.",
    "A treatise called On Colors, long credited to him but probably by a student such as Theophrastus or Strato, spelled out the light-and-dark theory in detail. That view ruled until Newton's prisms showed that white light holds all the colors. [[goethe|Goethe]]'s [[theory-of-colours|Theory of Colours]], which also sees color arising at the meeting of light and dark, is in some ways a return to Aristotle."
  ],
  colors: ["White", "Black", "Red", "Green", "Purple"],
  swatches: [
    { h: "#F7F6F2", label: "White · light, one pole" },
    { h: "#16171A", label: "Black · darkness, the other pole" },
    { h: "#D62F2F", label: "Rainbow red · Aristotle's band 1" },
    { h: "#2E9A4F", label: "Rainbow green · band 2" },
    { h: "#7B3FA0", label: "Rainbow purple · band 3" }
  ],
  facts: [
    { label: "Lived", value: "384–322 BCE" },
    { label: "Color idea", value: "Colors are mixtures of light and dark" },
    { label: "His rainbow", value: "Red, green, purple (yellow by contrast)" }
  ],
  sources: [
    "Aristotle, On Sense and the Sensible, ch. 3; trans. J. I. Beare.",
    "Aristotle, Meteorology, Book III, ch. 2–4; trans. E. W. Webster.",
    "Pseudo-Aristotle, On Colors (De coloribus).",
    "Lee, R. L. & Fraser, A. B. (2001). The Rainbow Bridge: Rainbows in Art, Myth, and Science. Penn State Press."
  ]
},
{
  id: "homer", type: "person", title: "Homer",
  dek: "Homer's sea is 'wine-dark' and his sky is never blue. That started a 150-year argument about color words.",
  body: [
    "Homer, the poet (or poets) of the Iliad and the Odyssey, traditionally dated to around the 8th century BCE, calls the sea oinops pontos: literally the 'wine-faced sea', usually translated 'wine-dark sea'. The phrase appears 17 times across the two epics, often for rough, stormy water. Dawn is 'rosy-fingered'. But nowhere does Homer call the sea or the sky [[Blue|blue]].",
    "In 1858 the British statesman William Gladstone, in a three-volume study of Homer, noticed the missing blue and argued that Homer's color words tracked light and dark more than hue. Some readers took him to mean the Greeks were [[color-blindness|color-blind]], which he later denied. In the 1860s the philologist Lazarus Geiger found blue missing from other ancient texts too, including the Vedas and the Hebrew Bible, and proposed that color words appear in a fixed order, with blue last.",
    "Geiger's order anticipated [[berlin-and-kay|Berlin and Kay]]'s [[basic-color-terms|basic color terms]] a century later. The modern verdict: Homer's Greeks saw blue as well as we do; they lacked an everyday word for it. The word kyanos, later 'blue', means 'dark' in Homer, who uses it for Zeus's eyebrows. Greeks used a manufactured blue, [[egyptian-blue|Egyptian blue]], so the gap is in the words, not the eyes (see [[linguistic-relativity|do words change what we see?]]).",
    "Why 'wine-dark'? Nobody knows for sure. Greek wine may have looked different from ours, or the phrase may carry the sea's mood, heady, dark and dangerous, more than its hue; Homer also uses oinops for reddish oxen. Old color words often measure darkness, shine or feeling as much as hue, which is exactly how [[aristotle|Aristotle]] later built colors out of light and dark."
  ],
  colors: ["Navy", "Baby pink", "Midnight blue"],
  swatches: [
    { h: "#2E2A4F", label: "Oinops · 'wine-faced' sea (approx.)" },
    { h: "#F4C2C2", label: "Rhododaktylos · rosy-fingered dawn" },
    { h: "#191970", label: "Kyaneos · 'dark' (later 'blue')" }
  ],
  facts: [
    { label: "Lived", value: "Traditionally c. 8th century BCE (uncertain)" },
    { label: "'Wine-dark sea'", value: "5 times in the Iliad, 12 in the Odyssey" },
    { label: "Noticed the missing blue", value: "William Gladstone, 1858" }
  ],
  sources: [
    "Gladstone, W. E. (1858). Studies on Homer and the Homeric Age. Oxford University Press.",
    "Gladstone, W. E. (1877). The Colour-Sense. The Nineteenth Century 2 (October 1877).",
    "Deutscher, G. (2010). Through the Language Glass. Metropolitan Books.",
    "Alexander, C. (2013). A winelike sea. Lapham's Quarterly 6(3).",
    "Wikipedia, 'Wine-dark sea'."
  ]
},
{
  id: "isaac-newton", type: "person", title: "Isaac Newton",
  dek: "He split white light with a prism, added indigo to the rainbow to match music, and drew a color wheel.",
  body: [
    "Isaac Newton (1643–1727) is famous for gravity, but his first public triumph was color. In 1666 he noticed that sunlight passed through a prism spread into a band of colors longer than it was wide: the prism bent each color by a different amount. White light, he concluded, isn't pure; it's a mixture of all the [[spectrum|spectral colors]], and each color is a property of the light itself.",
    "His 1672 paper on light and colors, his first, set off a bitter fight with Robert Hooke. Newton held back his full account until after Hooke died in 1703, then published [[opticks|Opticks]] in 1704, in English rather than Latin. In it he named seven colors, adding [[Orange|orange]] and [[Indigo|indigo]] to the five he had counted before, so the spectrum would match the seven notes of a musical scale.",
    "He also joined the two ends of the spectrum into a circle, one of the first [[color-wheel|color wheels]], and showed that mixing red and violet light gives a red-purple found in no rainbow ([[extra-spectral|colors that aren't in the rainbow]]). He insisted color is a sensation in the mind, not a thing in objects. Because glass lenses split colors and blurred telescope images, he built the first working reflecting telescope, which uses a mirror instead.",
    "His theory overturned the old view, inherited from [[aristotle|Aristotle]], that colors are light mixed with darkness. Not everyone gave in: [[goethe|Goethe]] spent decades attacking Newton in his [[theory-of-colours|Theory of Colours]]. A century later [[thomas-young|Thomas Young]] showed light behaves as a wave, and [[james-clerk-maxwell|Maxwell]] made color mixing a measurable science."
  ],
  colors: ["Red", "Orange", "Yellow", "Green", "Blue", "Indigo", "Violet"],
  swatches: [
    { h: "#D62F2F", label: "Red · one of the original five" },
    { h: "#F07A1A", label: "Orange · added by Newton" },
    { h: "#F2C81F", label: "Yellow · one of the original five" },
    { h: "#2E9A4F", label: "Green · one of the original five" },
    { h: "#2563C9", label: "Blue · one of the original five" },
    { h: "#3D2B8E", label: "Indigo · added by Newton" },
    { h: "#8000FF", label: "Violet · one of the original five" }
  ],
  facts: [
    { label: "Lived", value: "1643–1727" },
    { label: "First paper", value: "On light and colors, 1672" },
    { label: "Opticks", value: "1704, in English" }
  ],
  sources: [
    "Newton, I. (1672). A new theory about light and colors. Philosophical Transactions 6: 3075–3087.",
    "Newton, I. (1704). Opticks. London.",
    "'Music inspired Newton's rainbow'. Nature 520: 436 (2015).",
    "Wikipedia, 'Isaac Newton' and 'Opticks'."
  ]
},
{
  id: "goethe", type: "person", title: "Johann Wolfgang von Goethe",
  dek: "The poet who spent decades fighting Newton, and found that color is born where light meets dark.",
  body: [
    "Johann Wolfgang von Goethe (1749–1832) wrote Faust, yet according to his secretary Johann Peter Eckermann he took more pride in his color theory than in his poetry. It began around 1790 with a borrowed prism. Expecting a white wall to burst into a rainbow, he saw it stay white; color appeared only at edges, where light met dark. He decided on the spot that [[isaac-newton|Newton]] was wrong.",
    "His [[theory-of-colours|Theory of Colours]] (1810) is a vast catalogue of how color looks: colored shadows, afterimages, the yellow of light seen through haze and the blue of darkness seen through lit air. He drew a symmetrical [[color-wheel|color wheel]] with opposites facing each other, anticipating Ewald Hering's opponent colors, and split colors into a lively 'plus' side and a restless 'minus' side, the root of talk about [[warm-and-cool|warm and cool]].",
    "As physics his attack on Newton failed: white light really is a mix of spectral colors. As a study of perception it was ahead of its time, and artists and philosophers read it closely. J. M. W. Turner, painter of [[painting-temeraire|The Fighting Temeraire]], exhibited Light and Colour (Goethe's Theory) in 1843, and [[wittgenstein|Ludwig Wittgenstein]]'s [[remarks-on-colour|Remarks on Colour]] grew out of reading him.",
    "Goethe also gave colors moral and emotional qualities, an early color psychology. On one circle he paired red with the beautiful, orange with the noble, yellow with the good, green with the useful, blue with the common and violet with the unnecessary. It's poetry rather than evidence (see [[color-psychology|color psychology]]), but it shaped how [[kandinsky|Kandinsky]] and the [[bauhaus|Bauhaus]] talked about color."
  ],
  colors: ["Red", "Orange", "Yellow", "Green", "Blue", "Purple"],
  swatches: [
    { h: "#D62F2F", label: "Red · the beautiful" },
    { h: "#F07A1A", label: "Orange · the noble" },
    { h: "#F2C81F", label: "Yellow · the good" },
    { h: "#2E9A4F", label: "Green · the useful" },
    { h: "#2563C9", label: "Blue · the common" },
    { h: "#7B3FA0", label: "Violet · the unnecessary" }
  ],
  facts: [
    { label: "Lived", value: "1749–1832" },
    { label: "Color book", value: "Zur Farbenlehre, 1810 (English 1840)" },
    { label: "Key idea", value: "Colors arise at the meeting of light and dark" }
  ],
  sources: [
    "Goethe, J. W. von (1810). Zur Farbenlehre; trans. C. L. Eastlake (1840), Theory of Colours.",
    "Eckermann, J. P. (1836–48). Gespräche mit Goethe (Conversations with Goethe).",
    "Tate. J. M. W. Turner, Light and Colour (Goethe's Theory), exhibited 1843.",
    "Wikipedia, 'Theory of Colours'."
  ]
},
{
  id: "thomas-young", type: "person", title: "Thomas Young",
  dek: "A London doctor who guessed, in 1802, that the eye needs only three kinds of color sensor. He was right.",
  body: [
    "Thomas Young (1773–1829) was a physician and one of history's great all-rounders. He read about a dozen languages as a teenager, worked out how the eye's lens changes shape to focus (years before he turned to [[trichromacy|color vision]]), was the first to describe astigmatism, and helped decipher Egyptian hieroglyphs on the Rosetta Stone.",
    "His big color idea came in lectures at the Royal Institution in 1801–02. The eye, he reasoned, can't hold a separate sensor for every color, so it must have just three kinds, each responding to a broad band of light, with every color a blend of their signals. He first named them red, yellow and blue, then revised them to red, green and violet. That's [[trichromacy|trichromacy]], later developed by Hermann von Helmholtz and tested by [[james-clerk-maxwell|James Clerk Maxwell]].",
    "At the same time he was arguing, against the authority of [[isaac-newton|Newton]], that light is a wave. His experiments with interference, light waves adding and canceling like ripples on water, let him estimate the wavelengths of different colors, and his numbers came close to modern values. Red light's waves are longer than violet's (see [[spectrum|the spectrum]]).",
    "Young's guess was confirmed in the 20th century, when scientists measured three cone pigments in the human retina. It explains [[color-blindness|color blindness]], why screens need only red, green and blue pixels, and why three lights can match almost any color."
  ],
  colors: ["Red", "Green", "Violet", "Yellow", "Blue"],
  swatches: [
    { h: "#D62F2F", label: "Red · receptor in both versions" },
    { h: "#2E9A4F", label: "Green · revised version" },
    { h: "#8000FF", label: "Violet · revised version" },
    { h: "#F2C81F", label: "Yellow · first version" },
    { h: "#2563C9", label: "Blue · first version" }
  ],
  facts: [
    { label: "Lived", value: "1773–1829" },
    { label: "Three-receptor idea", value: "Royal Institution lectures, 1801–02" },
    { label: "Also", value: "Wave theory of light; Rosetta Stone" }
  ],
  sources: [
    "Young, T. (1802). On the theory of light and colours. Philosophical Transactions 92: 12–48.",
    "Mollon, J. D. (2003). The origins of modern color science. In S. Shevell (ed.), The Science of Color. Optical Society of America.",
    "Wikipedia, 'Thomas Young (scientist)' and 'Young–Helmholtz theory'."
  ]
},
{
  id: "james-clerk-maxwell", type: "person", title: "James Clerk Maxwell",
  dek: "He measured color with spinning tops, then showed the first three-color photograph: a tartan ribbon, in 1861.",
  body: [
    "James Clerk Maxwell (1831–1879) is best known for showing that light is an electromagnetic wave. Before that, as a young man in Edinburgh, he turned color into measurement. Using spinning tops with adjustable sectors of colored paper, which blur into a single color as they spin ([[optical-mixing|optical mixing]]), he matched mixtures by eye and recorded the proportions, showing that colors can be added like numbers.",
    "His 1855 paper 'Experiments on Colour' backed [[thomas-young|Thomas Young]]'s idea that the eye has three kinds of color receptor ([[trichromacy|trichromacy]]). He plotted mixtures on a triangle with red, green and blue at the corners, an ancestor of the color charts scientists still use, and he tested color-blind observers to see which mixtures they confused (see [[color-blindness|color blindness]]).",
    "In 1855 he also proposed photographing a scene three times, through [[Red|red]], [[Green|green]] and [[Blue|blue]] filters, and projecting the three images on top of each other. On 17 May 1861, at the Royal Institution in London, he showed the result: a tartan ribbon photographed by Thomas Sutton. The plates were barely sensitive to red, so it was rough, but every color camera and screen since uses the same three-color idea.",
    "The Royal Society gave him its Rumford Medal in 1860 for his work on color. By 1865 his equations showed light to be an electromagnetic wave, which made the visible [[spectrum|spectrum]] one narrow band in a far wider range that includes radio waves."
  ],
  colors: ["Red", "Green", "Blue"],
  swatches: [
    { h: "#D62F2F", label: "Red · filter 1 (1861)" },
    { h: "#2E9A4F", label: "Green · filter 2 (1861)" },
    { h: "#2563C9", label: "Blue-violet · filter 3 (1861)" }
  ],
  facts: [
    { label: "Lived", value: "1831–1879" },
    { label: "Color photograph", value: "Tartan ribbon, 17 May 1861" },
    { label: "Color paper", value: "Experiments on Colour, 1855" }
  ],
  sources: [
    "Maxwell, J. C. (1855). Experiments on colour, as perceived by the eye, with remarks on colour-blindness. Transactions of the Royal Society of Edinburgh 21: 275–298.",
    "James Clerk Maxwell Foundation. The first colour photographic image.",
    "Wikipedia, 'James Clerk Maxwell'."
  ]
},
{
  id: "chevreul", type: "person", title: "Michel Eugène Chevreul",
  dek: "A chemist who lived to 102, explained soap, and showed painters that colors change their neighbors.",
  body: [
    "Michel Eugène Chevreul (1786–1889) was a chemist first. His studies of animal fats explained how soap forms and improved candle-making; he isolated and named stearic and oleic acids. His name is one of the 72 engraved on the Eiffel Tower. He lived to 102, and France celebrated his 100th birthday as a national event.",
    "In 1824 he became director of dyeing at the Gobelins tapestry works in Paris. Complaints about dull black wool led him to [[simultaneous-contrast|simultaneous contrast]]: colors seen side by side shift away from each other in hue and lightness, so a good black beside blues and violets looks weak and reddish. His 1839 book on the 'law of simultaneous contrast' gave rules for tapestries, gardens, clothing, maps and painting, including [[color-harmony|harmonies]] of similar and of contrasting colors.",
    "Painters took it as a manual. The [[impressionism|Impressionists]] absorbed his ideas about [[complementary-colors|complementary]] contrast, and Camille Pissarro, explaining the method Seurat had pioneered, said it rested on “the theory of colors discovered by M. Chevreul.” That method, separate dots that mix in the eye, became [[optical-mixing|optical mixing]] and [[painting-grande-jatte|La Grande Jatte]].",
    "At 100 he sat for a series of conversations photographed by Paul Nadar, the first photo-interview published in a magazine. Over a century later, [[josef-albers|Josef Albers]]'s [[interaction-of-color|Interaction of Color]] turned his discovery into a classroom course: no color is seen alone."
  ],
  colors: ["Black", "Blue", "Purple"],
  swatches: [
    { h: "#16171A", label: "Gobelins black · looked weak and reddish..." },
    { h: "#2563C9", label: "...beside blue..." },
    { h: "#7B3FA0", label: "...and violet" }
  ],
  facts: [
    { label: "Lived", value: "1786–1889 (aged 102)" },
    { label: "Gobelins dye director", value: "From 1824" },
    { label: "Contrast book", value: "1839 (English 1854)" }
  ],
  sources: [
    "Chevreul, M. E. (1839). De la loi du contraste simultané des couleurs. Paris (English trans. 1854).",
    "Viénot, F. (2002). Michel-Eugène Chevreul: from laws and principles to the production of colour plates. Color Research & Application 27(1).",
    "Wikipedia, 'Michel Eugène Chevreul'.",
    "Pissarro, C., letter to Paul Durand-Ruel, November 1886 (quoted in J. Rewald, The History of Impressionism)."
  ]
},
{
  id: "william-perkin", type: "person", title: "William Perkin",
  dek: "At 18, in a makeshift home lab, he failed to make a malaria drug and made the color mauve instead.",
  body: [
    "William Henry Perkin (1838–1907) entered London's Royal College of Chemistry at 15 to study under August Wilhelm von Hofmann. Over the Easter holiday of 1856, aged 18, he was trying to make quinine, the malaria drug, in a crude lab at his family home in east London. He got a black sludge instead; washed out with alcohol, it gave a brilliant purple, [[mauveine|mauveine]].",
    "He saw the business before most chemists would have. With his brother and a friend he tested it on silk, sent samples to a dye works in Perth, patented it in August 1856, and in 1857 opened a factory at Greenford, west of London. [[Mauve|Mauve]] became a craze. Local lore says the canal beside his works changed color from week to week.",
    "His success started the synthetic dye industry: [[Magenta|magenta]], aniline blues and greens, synthetic alizarin red (Perkin found a process in 1869, but BASF patented the same one a day earlier) and eventually synthetic [[indigo-dye|indigo]]. As Germany came to dominate the business, Perkin left manufacturing and went back to research, finding ways to make coumarin, an early synthetic perfume ingredient.",
    "He was knighted in 1906, the 50th anniversary of mauve, and received the first Perkin Medal, still among the highest honors in American industrial chemistry. His accident turned [[royal-purple|purple]], once the color of emperors and [[tyrian-purple|sea snails]], into something anyone could wear."
  ],
  colors: ["Plum", "Mauve", "Magenta"],
  swatches: [
    { h: "#8F3B8F", label: "Mauveine · 1856 (approx.)" },
    { h: "#A8778F", label: "Mauve · the word today" },
    { h: "#FF00FF", label: "Magenta · the next aniline hit" }
  ],
  facts: [
    { label: "Lived", value: "1838–1907" },
    { label: "Discovery", value: "Mauveine, Easter 1856, aged 18" },
    { label: "Honors", value: "Knighted 1906; first Perkin Medal" }
  ],
  sources: [
    "Garfield, S. (2000). Mauve: How One Man Invented a Color That Changed the World. Faber & Faber.",
    "Royal Society of Chemistry. William Henry Perkin (1838–1907).",
    "Wikipedia, 'William Henry Perkin'."
  ]
},
{
  id: "rimbaud", type: "person", title: "Arthur Rimbaud",
  dek: "At 16 he gave every vowel a color: A black, E white, I red, U green, O blue. At 20 he quit poetry.",
  body: [
    "Arthur Rimbaud (1854–1891) wrote nearly all his poetry between about 15 and 20, then stopped and spent the rest of his short life as a trader and traveler, much of it in Africa. In May 1871, at 16, he wrote to friends that a poet must become a 'seer' through a long, deliberate derangement of all the senses. Within months he had written [[voyelles|Voyelles]], a sonnet that gives each vowel a color: A black, E white, I red, U green, O blue.",
    "Two years later, in A Season in Hell, he looked back on it in a section titled 'Alchemy of the Word': “J'inventai la couleur des voyelles!” (I invented the color of the vowels!). The title ties his poetics to [[alchemy|alchemy]], the art of transformation, and the vowel colors read like a recipe for turning sound into sight.",
    "Was he a synesthete? There's no evidence for it. Scholars have traced the colors to a childhood alphabet book or colored letter blocks, to occult reading, or to nothing at all. Either way, the sonnet became the most famous literary picture of [[synesthesia|synesthesia]] and fed the Symbolist idea that the senses answer one another, which [[kandinsky|Kandinsky]] carried into painting.",
    "Real synesthetes don't agree with him: for many English speakers with colored letters, A is red, not [[Black|black]], and every person's palette differs. The poem is better read as a dare, binding sounds and colors by imagination, the same kind of bond this app builds by practice."
  ],
  colors: ["Black", "White", "Red", "Green", "Blue"],
  swatches: [
    { h: "#16171A", label: "A · black" },
    { h: "#F7F6F2", label: "E · white" },
    { h: "#D62F2F", label: "I · red" },
    { h: "#2E9A4F", label: "U · green" },
    { h: "#2563C9", label: "O · blue" }
  ],
  facts: [
    { label: "Lived", value: "1854–1891" },
    { label: "Voyelles", value: "Written 1871, published 1883" },
    { label: "Stopped writing", value: "Around age 20" }
  ],
  sources: [
    "Rimbaud, A. (1873). Une saison en enfer, 'Délires II: Alchimie du verbe'.",
    "Robb, G. (2000). Rimbaud. Picador.",
    "Wikipedia, 'Arthur Rimbaud' and 'Voyelles'."
  ]
},
{
  id: "kandinsky", type: "person", title: "Wassily Kandinsky",
  dek: "He quit law at 30 to paint, and heard colors as instruments: yellow a trumpet, deep blue an organ.",
  body: [
    "Wassily Kandinsky (1866–1944) gave up teaching law in Moscow at 30 to study painting in Munich. Before he left, in 1896, he saw one of [[monet|Monet]]'s haystacks and couldn't tell what it showed, only that the color gripped him. Wagner's Lohengrin moved him the same way; he wrote that he “saw all my colours in spirit, before my eyes.”",
    "In [[spiritual-in-art|Concerning the Spiritual in Art]] (1911) he argued that colors act on the soul like sounds. Keen lemon yellow hurts the eye like a shrill trumpet; light blue is a flute, darker blue a cello, the darkest blue an organ; green is the calm middle notes of a violin; [[Vermilion|vermilion]] has the charm of flame. “Blue is the typical heavenly colour,” he wrote, and yellow the typically earthly one.",
    "Whether he was a synesthete in the clinical sense is debated ([[synesthesia|synesthesia]]), but he built his art on the musical analogy, naming paintings 'Improvisations' and 'Compositions'. [[painting-composition-vii|Composition VII]] (1913) is often counted among the high points of early abstract painting. From 1922 to 1933 he taught at the [[bauhaus|Bauhaus]], pairing sharp yellow with the triangle and deep blue with the circle.",
    "His color meanings are personal and poetic, not science (see [[color-psychology|color psychology]]). But the idea that color can stand on its own, free of objects the way music is free of words, changed modern art, and it began with a haystack he couldn't recognize."
  ],
  colors: ["Canary", "Sky blue", "Blue", "Navy", "Green", "Vermilion"],
  swatches: [
    { h: "#FFF44F", label: "Lemon yellow · shrill trumpet" },
    { h: "#9BC4E2", label: "Light blue · flute" },
    { h: "#3F5FA8", label: "Darker blue · cello" },
    { h: "#1C2B5A", label: "Darkest blue · organ" },
    { h: "#2E9A4F", label: "Green · calm violin" },
    { h: "#E34234", label: "Vermilion · flame" }
  ],
  facts: [
    { label: "Lived", value: "1866–1944" },
    { label: "Color book", value: "Concerning the Spiritual in Art, 1911" },
    { label: "Bauhaus", value: "Taught 1922–1933" }
  ],
  sources: [
    "Kandinsky, W. (1911). Über das Geistige in der Kunst; trans. M. Sadleir (1914), Concerning the Spiritual in Art.",
    "Kandinsky, W. (1913). Rückblicke (Reminiscences). Berlin: Der Sturm.",
    "Wikipedia, 'Wassily Kandinsky'."
  ]
},
{
  id: "johannes-itten", type: "person", title: "Johannes Itten",
  dek: "The Bauhaus teacher who opened class with breathing exercises and taught seven kinds of color contrast.",
  body: [
    "Johannes Itten (1888–1967) was a Swiss painter and teacher who created and ran the [[bauhaus|Bauhaus]] preliminary course from 1919 to 1922. Class could start with breathing and gymnastic exercises before any drawing. Itten followed Mazdaznan, a Zoroastrian-inspired movement with a strict vegetarian diet and meditation; his mysticism clashed with Walter Gropius's turn toward industry, and he left in 1923.",
    "His lasting legacy is a method. Itten taught seven contrasts: of hue; of light and dark ([[value|value]]); of [[warm-and-cool|warm and cool]]; of [[complementary-colors|complements]]; [[simultaneous-contrast|simultaneous contrast]], from [[chevreul|Chevreul]]; of saturation; and of extension, meaning how much area each color gets, from [[goethe|Goethe]]. Each came with exercises, and art schools still teach them.",
    "His 12-part [[color-wheel|color wheel]], with a triangle of yellow, red and blue at the center, built on his mentor Adolf Hölzel's work and spread worldwide through his book The Art of Color (1961). Color scientists criticize red-yellow-blue wheels for misplacing how colors actually relate, but for many painters Itten's wheel simply is the color wheel.",
    "He also linked palettes to personalities and named the types after seasons. Soon after his death the idea fed 'seasonal color analysis' in the cosmetics world, with books like Color Me a Season telling readers whether they're a spring or a winter. It's a styling system, not science (see [[color-psychology|color psychology]]), and a reminder of how far one classroom exercise can travel."
  ],
  colors: ["Yellow", "Red", "Blue", "Orange", "Purple", "Green"],
  swatches: [
    { h: "#F2C81F", label: "Yellow · primary (Itten's wheel)" },
    { h: "#D62F2F", label: "Red · primary (Itten's wheel)" },
    { h: "#2563C9", label: "Blue · primary (Itten's wheel)" },
    { h: "#F07A1A", label: "Orange · secondary" },
    { h: "#7B3FA0", label: "Violet · secondary" },
    { h: "#2E9A4F", label: "Green · secondary" }
  ],
  facts: [
    { label: "Lived", value: "1888–1967" },
    { label: "Bauhaus", value: "Preliminary course, 1919–1922" },
    { label: "Book", value: "Kunst der Farbe (The Art of Color), 1961" }
  ],
  sources: [
    "Itten, J. (1961). Kunst der Farbe; trans. (1973) The Art of Color. Van Nostrand Reinhold.",
    "Droste, M. (2019). Bauhaus 1919–1933. Taschen.",
    "Wikipedia, 'Johannes Itten'."
  ]
},
{
  id: "josef-albers", type: "person", title: "Josef Albers",
  dek: "He painted squares inside squares for over 25 years to show that no color is ever seen on its own.",
  body: [
    "Josef Albers (1888–1976) began as a schoolteacher and stained-glass maker in Germany. He joined the [[bauhaus|Bauhaus]] as a student in 1920, taking [[johannes-itten|Johannes Itten]]'s preliminary course, and stayed on to teach, leading part of that course himself from 1923. When the Bauhaus closed under Nazi pressure in 1933, he and his wife, the textile artist Anni Albers, moved to Black Mountain College in North Carolina.",
    "In America he became one of the century's most influential art teachers. His Black Mountain students included Robert Rauschenberg and Ruth Asawa, and from 1950 to 1958 he headed the design department at Yale. His method, carried over from the [[bauhaus|Bauhaus]], was to look first and theorize later: students moved colored papers around until they could see what color was doing.",
    "In 1963 he published that method as [[interaction-of-color|Interaction of Color]], a set of exercises showing that a color almost never looks like itself: it shifts with its neighbors ([[simultaneous-contrast|simultaneous contrast]]), with its area and with the light. One exercise makes a single color look like two; another makes two different colors look the same.",
    "His own painting tested the same idea. Homage to the Square, begun in 1950, runs to hundreds of paintings and prints of three or four nested squares, with the paints recorded on the back. Side by side, the same [[Yellow|yellow]] or [[Grey|grey]] keeps changing character. In 1971 he became the first living artist given a solo show at New York's Metropolitan Museum of Art."
  ],
  colors: ["Yellow", "Marigold", "Taupe"],
  swatches: [
    { h: "#F2C81F", label: "Inner square (Homage-style example)" },
    { h: "#EAA221", label: "Middle square (example)" },
    { h: "#8E7F71", label: "Outer square (example)" }
  ],
  facts: [
    { label: "Lived", value: "1888–1976" },
    { label: "Taught", value: "Bauhaus, Black Mountain College, Yale" },
    { label: "Series", value: "Homage to the Square, from 1950" }
  ],
  sources: [
    "Albers, J. (1963). Interaction of Color. Yale University Press.",
    "Josef and Anni Albers Foundation. Josef Albers: biography.",
    "Wikipedia, 'Josef Albers'.",
    "Josef and Anni Albers Foundation, 'Homage to the Square' (series begun 1950)."
  ]
},
{
  id: "yves-klein", type: "person", title: "Yves Klein",
  dek: "He showed 11 identical blue paintings at 11 different prices, and never actually patented his blue.",
  body: [
    "Yves Klein (1928–1962) was a French artist from Nice, and a judo black belt who trained in Japan. From early on he painted monochromes, canvases of a single color. When visitors to his first shows of [[Orange|orange]], [[Yellow|yellow]], [[Red|red]], [[Pink|pink]] and [[Blue|blue]] monochromes treated them as a kind of mosaic, he narrowed down to one color: blue.",
    "With the Paris paint dealer Édouard Adam he found a way to keep synthetic [[ultramarine-pigment|ultramarine]] as intense on canvas as it is as dry powder, by suspending it in a clear, matte synthetic resin instead of oil, which dulls it. In 1957 in Milan he showed 11 identical blue canvases, each priced differently, betting that every buyer would see something different. The color became International Klein Blue, or IKB.",
    "In May 1960 he deposited the formula in a sealed, dated Soleau envelope, a French way of proving when you invented something. He never patented or trademarked it, so the popular story that he 'owned' a blue isn't true (see [[color-trademarks|owning a color]]). Adam still sells the binder.",
    "Blue was one of three colors in Klein's private system, with rose pink and [[Gold|gold]]. Late in life he made pink monochromes and gold ones in real gold leaf, the material that also lights up Klimt's [[painting-the-kiss|The Kiss]]. He left a small box of blue pigment, pink pigment and gold leaf as an offering at a monastery in Italy. He staged 'living brush' paintings, the Anthropometries, and showed an empty white gallery called The Void. He died in 1962, aged 34."
  ],
  colors: ["Indigo", "Puce", "Gold"],
  swatches: [
    { h: "#002FA7", label: "IKB · his signature blue (approx.)" },
    { h: "#D9849B", label: "Rose · the monopinks (approx.)" },
    { h: "#FFD700", label: "Gold · the monogolds (gold leaf, approx.)" }
  ],
  facts: [
    { label: "Lived", value: "1928–1962" },
    { label: "Blue Epoch show", value: "Milan, January 1957" },
    { label: "IKB formula", value: "Soleau envelope, May 1960; never patented" }
  ],
  sources: [
    "Centre Pompidou. Yves Klein collection and chronology.",
    "Weitemeier, H. (2001). Yves Klein, 1928–1962: International Klein Blue. Taschen.",
    "Wikipedia, 'Yves Klein' and 'International Klein Blue'."
  ]
},
{
  id: "wittgenstein", type: "person", title: "Ludwig Wittgenstein",
  dek: "Why is there no transparent white, and no reddish green? Late in life he filled notebooks with such puzzles.",
  body: [
    "Ludwig Wittgenstein (1889–1951) was an Austrian-British philosopher of logic and language, and in the last year of his life much of what he wrote was about color. The notes, published in 1977 as [[remarks-on-colour|Remarks on Colour]], grew out of reading [[goethe|Goethe]]'s [[theory-of-colours|Theory of Colours]] and a letter by the painter Philipp Otto Runge that Goethe printed there.",
    "The puzzles are easy to state and hard to answer. Why can't there be a transparent white, when there is transparent [[Red|red]] and [[Green|green]] glass? Why is there no reddish green, though there are reddish yellows and bluish greens? Is green a mixture of blue and yellow, or a color in its own right? These don't feel like facts learned by experiment, and they don't feel like mere definitions either.",
    "His answer, roughly, is that they belong to the logic, or 'geometry', of our color concepts: the rules of the game we play with color words. Physics explains wavelengths; it doesn't tell us why 'reddish green' makes no sense. Vision science now offers part of an answer, opponent channels in the eye (see [[complementary-colors|complementary colors]]), but the conceptual puzzle remains.",
    "His earlier image of a 'beetle in a box', each person's private sensation that no one else can inspect, from the Philosophical Investigations (1953), is often linked to the puzzle of whether your red is my red (see [[qualia|qualia]]). He suggested that what can't be shared, even in principle, plays no part in what our words mean."
  ],
  colors: ["White", "Red", "Green"],
  swatches: [
    { h: "#F7F6F2", label: "White · no transparent white" },
    { h: "#D62F2F", label: "Red..." },
    { h: "#2E9A4F", label: "...and green: no 'reddish green'" }
  ],
  facts: [
    { label: "Lived", value: "1889–1951" },
    { label: "Color notes", value: "Written 1950–51, published 1977" },
    { label: "Big idea", value: "Color puzzles are about our concepts" }
  ],
  sources: [
    "Wittgenstein, L. (1977). Remarks on Colour, ed. G. E. M. Anscombe, trans. L. L. McAlister and M. Schättle. Blackwell.",
    "Westphal, J. (1991). Colour: A Philosophical Introduction, 2nd ed. Blackwell.",
    "Biletzki, A. & Matar, A. 'Ludwig Wittgenstein', Stanford Encyclopedia of Philosophy."
  ]
},
{
  id: "berlin-and-kay", type: "person", title: "Brent Berlin and Paul Kay",
  dek: "An anthropologist and a linguist showed in 1969 that the world's color words follow a hidden order.",
  body: [
    "Brent Berlin (born 1936), an anthropologist who studied how the Maya of Chiapas name plants and animals, and Paul Kay (born 1934), then an anthropologist at the University of California, Berkeley, and later a linguist there, published [[basic-color-terms|Basic Color Terms]]: Their Universality and Evolution in 1969. Their question: do languages carve up color arbitrarily, as many scholars then believed, or is there a pattern?",
    "They asked speakers of 20 languages to name colors and point them out on a grid of Munsell color chips, and added published descriptions of 78 more languages. Two findings stood out. People agreed strikingly on the best example of each color word, even where the edges of their words differed. And languages seemed to gain [[basic-color-terms|basic color terms]] in a fixed order, from dark and light, to red, to green and yellow, to blue, to brown, then the rest.",
    "That was a blow to strong [[linguistic-relativity|linguistic relativity]], and it revived an older idea: Lazarus Geiger, reading [[homer|Homer]] and other ancient texts in the 1860s, had proposed that blue words come last. Kay and colleagues later ran the World Color Survey of 110 unwritten languages, which kept the broad trends and softened the strict sequence.",
    "Critics such as the linguist John Lucy argued that the method pushed English-style categories onto other languages, where 'color' words can also mean shine, freshness or texture. Kay himself later concluded, with Terry Regier, that '[[linguistic-relativity|Whorf was half right]]': universal tendencies shape color naming, and language still nudges perception. The 11 basic colors in this app are their English list."
  ],
  colors: ["Black", "White", "Red", "Green", "Yellow", "Blue", "Brown", "Purple", "Pink", "Orange", "Grey"],
  swatches: [
    { h: "#16171A", label: "Black · stage I" }, { h: "#F7F6F2", label: "White · stage I" },
    { h: "#D62F2F", label: "Red · stage II" }, { h: "#2E9A4F", label: "Green · stage III–IV" },
    { h: "#F2C81F", label: "Yellow · stage III–IV" }, { h: "#2563C9", label: "Blue · stage V" },
    { h: "#7A5230", label: "Brown · stage VI" }, { h: "#7B3FA0", label: "Purple · stage VII" },
    { h: "#F28DB2", label: "Pink · stage VII" }, { h: "#F07A1A", label: "Orange · stage VII" },
    { h: "#8C9096", label: "Grey · stage VII" }
  ],
  facts: [
    { label: "Book", value: "Basic Color Terms, 1969" },
    { label: "Data", value: "20 languages tested, 78 more from sources" },
    { label: "Follow-up", value: "World Color Survey, 110 languages" }
  ],
  sources: [
    "Berlin, B. & Kay, P. (1969). Basic Color Terms: Their Universality and Evolution. University of California Press.",
    "Lucy, J. A. (1997). The linguistics of 'color'. In C. L. Hardin & L. Maffi (eds.), Color Categories in Thought and Language. Cambridge University Press.",
    "Regier, T. & Kay, P. (2009). Language, thought, and color: Whorf was half right. Trends in Cognitive Sciences 13(10): 439–446.",
    "Kay, P., Berlin, B., Maffi, L., Merrifield, W. R. & Cook, R. (2009). The World Color Survey. CSLI Publications."
  ]
},
{
  id: "monet", type: "person", title: "Claude Monet",
  dek: "He painted the same haystack, cathedral and pond again and again to catch color changing with the light.",
  body: [
    "Claude Monet (1840–1926) gave [[impressionism|Impressionism]] its name: a critic mocked his harbor view [[painting-impression-sunrise|Impression, Sunrise]] at the group's first show in 1874. Taught to paint outdoors by Eugène Boudin, Monet wanted to paint not things but the light on them, like the sunlit white dress and green-shadowed parasol of [[painting-woman-parasol|Woman with a Parasol]] (1875).",
    "From 1890 he worked in series. He painted haystacks at different hours and seasons, then dozens of views of [[painting-rouen-cathedral|Rouen Cathedral]]'s facade as the light moved, switching canvases through the day. In London he painted the [[painting-houses-of-parliament|Houses of Parliament]] at sunset and in fog. The subject stays put; the color is the story (see [[color-constancy|color constancy]]). One of his haystacks later set [[kandinsky|Kandinsky]] on the road to abstraction.",
    "His last great subject was his garden at Giverny, with its lily pond and [[painting-japanese-footbridge|Japanese footbridge]]. From 1899 until his death he made more than 250 paintings of [[painting-water-lilies|water lilies]]. Like the other Impressionists he mostly avoided black, built darks from colors, and loved violet shadows and [[warm-and-cool|warm-cool]] contrasts.",
    "Then his eyes failed. Cataracts dimmed his sight from around 1912, and his paintings grew broader and leaned toward [[Red|reds]] and [[Yellow|yellows]]. After surgery in 1923 he saw things strongly [[Blue|bluish]] for a time, destroyed some canvases from his years of poor sight, and retouched others with bluer water lilies: a rare record of a painter's eyes changing his color."
  ],
  colors: ["Orange", "Slate", "Lilac", "Cornflower"],
  swatches: [
    { h: "#F07A1A", label: "Impression, Sunrise · the orange sun (approx.)" },
    { h: "#708090", label: "Impression, Sunrise · blue-grey harbor (approx.)" },
    { h: "#C8A2C8", label: "Violet shadows (approx.)" },
    { h: "#6495ED", label: "Bluer lilies after 1923 surgery (approx.)" }
  ],
  facts: [
    { label: "Lived", value: "1840–1926" },
    { label: "Series", value: "Haystacks, Rouen Cathedral, Parliament, Water Lilies" },
    { label: "Cataract surgery", value: "1923" }
  ],
  sources: [
    "Musée d'Orsay and Musée de l'Orangerie. Claude Monet collections.",
    "Marmor, M. F. (2006). Ophthalmology and art: simulation of Monet's cataracts and Degas' retinal disease. Archives of Ophthalmology 124(12): 1764–1769.",
    "Wikipedia, 'Claude Monet'."
  ]
},
{
  id: "van-gogh", type: "person", title: "Vincent van Gogh",
  dek: "He came to bright color late, then used it like a voice: red against green for 'terrible passions'.",
  body: [
    "Vincent van Gogh (1853–1890) painted for barely a decade and made about 860 oil paintings, most of them in his last two years. His early Dutch work is dark, all browns and earth colors. In 1886 he moved to Paris to live with his brother Theo, met the [[impressionism|Impressionists]] and the painters around them, studied Japanese prints, and his palette brightened fast.",
    "In Arles in 1888 he used color to express feeling more than to describe things. He built his [[painting-sunflowers|Sunflowers]] from several shades of the new [[chrome-yellow|chrome yellow]]. For The Night Café he set blood-red walls against a green billiard table, telling Theo he wanted to show 'the terrible passions of humanity' through red and green, painter's-wheel [[complementary-colors|complements]].",
    "His letters, more than 600 to Theo alone, are a running color diary of what he mixed and what each color should do. In 1889, in the asylum at Saint-Rémy, he painted [[painting-starry-night|The Starry Night]], with swirling blues around yellow stars and moon. A curious footnote: one of his first teachers, for a few weeks in The Hague, was the painter Anton Mauve, no relation to the color [[Mauve|mauve]].",
    "Some colors are no longer what he painted. Red lake pigments have faded: he described his Bedroom's walls as pale violet, and they now look blue. Some chrome yellows have darkened toward brown. Researchers use his letters and paint analysis to reconstruct how the canvases looked when new (see [[cochineal|cochineal and carmine]])."
  ],
  colors: ["Yellow", "Red", "Green", "Lavender", "Cornflower", "Cobalt"],
  swatches: [
    { h: "#F5C518", label: "Chrome yellow · Sunflowers (approx.)" },
    { h: "#C0282D", label: "Blood red · Night Café walls (approx.)" },
    { h: "#2E8B57", label: "Green · Night Café billiard table (approx.)" },
    { h: "#B9A6D9", label: "Pale violet · Bedroom walls as painted (approx.)" },
    { h: "#7C9CD6", label: "Blue · Bedroom walls today (approx.)" },
    { h: "#1F4C99", label: "Blue · Starry Night sky (approx.)" }
  ],
  facts: [
    { label: "Lived", value: "1853–1890" },
    { label: "Output", value: "About 860 oil paintings" },
    { label: "Letters", value: "600+ to his brother Theo" }
  ],
  sources: [
    "Van Gogh Museum, Amsterdam. Vincent van Gogh: The Letters (vangoghletters.org).",
    "Van Gogh Museum. The Bedroom: research into faded colors.",
    "Monico, L. et al. (2011). Degradation process of lead chromate in paintings by Vincent van Gogh. Analytical Chemistry 83(4).",
    "Wikipedia, 'Vincent van Gogh'."
  ]
},
{
  id: "vermeer", type: "person", title: "Johannes Vermeer",
  dek: "About 35 paintings, a fortune's worth of ultramarine, and a widow left in debt.",
  body: [
    "Johannes Vermeer (1632–1675) spent his life in Delft painting quiet rooms full of daylight, like the kitchen of [[painting-milkmaid|The Milkmaid]]. He worked slowly, perhaps a few paintings a year, and only about 34 are universally accepted as his today. He also dealt in art, and when the war of 1672 wrecked the Dutch art market he stopped selling. He died at 43; his widow was left with 11 children and debts.",
    "His great extravagance was color. No other 17th-century painter used natural [[ultramarine-pigment|ultramarine]], ground from lapis lazuli and at times as costly as gold, so lavishly or so early in his career. He used it not only for blue things but under other colors: beneath the shadows of the red dress in The Girl with the Wine Glass, a layer of ultramarine gives the red a crisp, slightly purple coolness.",
    "In [[painting-milkmaid|The Milkmaid]] the blue cloth is ultramarine, the bodice a bright lead-tin yellow, and the white wall is built from [[lead-white|lead white]], [[Umber|umber]] and charcoal black. In [[painting-pearl-earring|Girl with a Pearl Earring]] the turban is natural ultramarine and lead white, and he even put ultramarine in the shadows of her yellow jacket. Its near-black background was once a green glaze, made with indigo and a yellow dye, weld, that have faded.",
    "After his death he was nearly forgotten for two centuries, until the French critic Théophile Thoré-Bürger championed him in the 1860s and nicknamed him 'the Sphinx of Delft'. His pairing of clear yellow with ultramarine blue is now one of the most recognizable in Western painting (see [[value|value]] for how his light works)."
  ],
  colors: ["Cobalt", "Yellow", "White"],
  swatches: [
    { h: "#1F3A93", label: "Ultramarine · turban, apron (approx.)" },
    { h: "#E6C34A", label: "Lead-tin yellow · bodice (approx.)" },
    { h: "#EEEBE3", label: "Lead white · walls and light (approx.)" }
  ],
  facts: [
    { label: "Lived", value: "1632–1675" },
    { label: "Paintings", value: "About 34 universally accepted" },
    { label: "Signature pigment", value: "Natural ultramarine" }
  ],
  sources: [
    "Mauritshuis, The Hague. Girl with a Pearl Earring: research project (2018).",
    "Rijksmuseum, Amsterdam. The Milkmaid: technical notes.",
    "National Gallery, London. The altered appearance of ultramarine in the paintings of Vermeer.",
    "Wikipedia, 'Johannes Vermeer'.",
    "Delaney, J. K., Dooley, K. A., van Loon, A. & Vandivere, A. (2020). Mapping the pigment distribution of Vermeer's Girl with a Pearl Earring. Heritage Science 8: 4.",
    "Essential Vermeer, 'The Girl with the Wine Glass' (after Wheelock 1995): ultramarine under the shadows of the red dress."
  ]
},

// ---------------------------------------------------------------- works
{
  id: "opticks", type: "work", title: "Newton's Opticks (1704)",
  dek: "Newton's book of prism experiments, written in English, that made white light a mixture of colors.",
  body: [
    "Opticks, or a Treatise of the Reflexions, Refractions, Inflexions and Colours of Light was published by [[isaac-newton|Isaac Newton]] in 1704, in English rather than scholarly Latin; a Latin edition followed in 1706. He had held it back until his rival Robert Hooke died in 1703. Unlike his mathematical Principia, it reads like a lab notebook: each claim is backed by an experiment a reader could repeat.",
    "Book One holds the color theory. Prisms show that white light is a mixture of rays, each bent by its own amount and each with its own color. In the 'crucial experiment', a color picked out by one prism passes through a second unchanged: the prism doesn't create color, it sorts it. Newton names seven colors, matching the [[spectrum|spectrum]] to a musical scale, and arranges them in a circle, an early [[color-wheel|color wheel]] that predicts what mixtures will look like.",
    "He also makes a point philosophers still cite: “the Rays to speak properly are not coloured.” They only have a power to stir up a sensation of color in us (see [[qualia|is your red my red?]]). And he shows that red and violet light mixed make a purple found nowhere in the spectrum ([[extra-spectral|colors that aren't in the rainbow]]).",
    "The book ends with 'Queries', open questions about light, heat, gravity and matter that grew from 16 in 1704 to 31 by 1730. It overturned the [[aristotle|Aristotelian]] idea that colors are light mixed with darkness, and a century later it provoked [[goethe|Goethe]]'s [[theory-of-colours|Theory of Colours]]."
  ],
  colors: ["Red", "Orange", "Yellow", "Green", "Blue", "Indigo", "Violet"],
  swatches: [
    { h: "#D62F2F", label: "Red · Newton's seven" },
    { h: "#F07A1A", label: "Orange · Newton's seven" },
    { h: "#F2C81F", label: "Yellow · Newton's seven" },
    { h: "#2E9A4F", label: "Green · Newton's seven" },
    { h: "#2563C9", label: "Blue · Newton's seven" },
    { h: "#3D2B8E", label: "Indigo · Newton's seven" },
    { h: "#8000FF", label: "Violet · Newton's seven" }
  ],
  facts: [
    { label: "Published", value: "London, 1704 (Latin edition 1706)" },
    { label: "Language", value: "English" },
    { label: "Queries", value: "16 in 1704; 31 by 1730" }
  ],
  sources: [
    "Newton, I. (1704). Opticks. London (text on Project Gutenberg).",
    "Shapiro, A. E. (1993). Fits, Passions, and Paroxysms. Cambridge University Press.",
    "Wikipedia, 'Opticks'."
  ]
},
{
  id: "theory-of-colours", type: "work", title: "Goethe's Theory of Colours (1810)",
  dek: "Goethe's attack on Newton was wrong about physics and right about perception, and artists loved it.",
  body: [
    "Zur Farbenlehre (1810), translated as Theory of Colours in 1840, was [[goethe|Goethe]]'s answer to [[isaac-newton|Newton]]'s [[opticks|Opticks]]. It has a teaching part packed with observations, a fierce polemic against Newton, and a history of color theory from the ancients onward. Goethe reportedly valued it above his poetry.",
    "Its starting point is that color is born where light meets darkness. Light seen through haze turns yellow, and darkness seen through lit air turns blue, which Goethe used to explain a yellow sun and a blue sky. Through a [[spectrum|prism]], colors appear only at edges: a blue-violet fringe where light runs into dark, a red-yellow fringe where dark runs into light.",
    "Its most lasting chapters are on 'physiological colors', the ones the eye makes: afterimages, colored shadows, and the way a color seems to call up its opposite. He set colors in a symmetrical circle with opposites facing, foreshadowing Hering's opponent colors and modern talk of [[complementary-colors|complements]] and [[warm-and-cool|warm and cool]]. He also gave each color a moral character, from the beautiful (red) to the unnecessary (violet).",
    "Physicists rejected the attack on Newton, but painters and philosophers kept the book alive. Turner exhibited Light and Colour (Goethe's Theory) in 1843; [[kandinsky|Kandinsky]] and the [[bauhaus|Bauhaus]] built on its color psychology; and [[wittgenstein|Wittgenstein]]'s [[remarks-on-colour|Remarks on Colour]] began as notes on it. Read it as a field guide to seeing, not as physics."
  ],
  colors: ["Indigo", "Orange", "Yellow", "Blue"],
  swatches: [
    { h: "#4B2E9E", label: "Blue-violet edge · light running into dark" },
    { h: "#F0801A", label: "Red-yellow edge · dark running into light" },
    { h: "#F2C81F", label: "Yellow · light seen through haze" },
    { h: "#2563C9", label: "Blue · darkness seen through lit air" }
  ],
  facts: [
    { label: "Published", value: "Tübingen, 1810" },
    { label: "English", value: "Trans. Charles Eastlake, 1840" },
    { label: "Parts", value: "Didactic, polemical, historical" }
  ],
  sources: [
    "Goethe, J. W. von (1810). Zur Farbenlehre; trans. C. L. Eastlake (1840), Theory of Colours.",
    "Sepper, D. L. (1988). Goethe contra Newton: Polemics and the Project for a New Science of Color. Cambridge University Press.",
    "Wikipedia, 'Theory of Colours'."
  ]
},
{
  id: "voyelles", type: "work", title: "Rimbaud's \"Voyelles\" (1871)",
  dek: "A teenage poet's sonnet that gives each vowel a color, and the most famous poem about seeing sounds.",
  body: [
    "'Voyelles' ('Vowels') is a sonnet [[rimbaud|Arthur Rimbaud]] wrote by September 1871, before his 17th birthday. It opens: “A noir, E blanc, I rouge, U vert, O bleu : voyelles,” that is, A black, E white, I red, U green, O blue. Each vowel then unfolds into images of its color: black flies buzzing round a stench; white mists, tents and glaciers; red spat blood and laughing lips; rippling green seas; and for O, a trumpet, silences and a violet ray of light from someone's eyes.",
    "The order is A E I U O, not the usual A E I O U, so the poem ends on O as Omega, the last letter of the Greek alphabet. Rimbaud wrote it in the year he declared that a poet must become a 'seer' by deranging all the senses. It wasn't published until 1883, twelve years after [[rimbaud|Rimbaud]] wrote it, when his former lover Paul Verlaine printed it in the review Lutèce.",
    "Readers have hunted for the key ever since: a childhood alphabet book or colored letter blocks, occult and alchemical reading, hidden erotic imagery, or no system at all. The anthropologist Claude Lévi-Strauss read it as a structure of paired oppositions. Rimbaud himself, two years later, wrote in the 'Alchemy of the Word' section of A Season in Hell that he had invented the color of the vowels (see [[alchemy|alchemy]]).",
    "Is it [[synesthesia|synesthesia]]? There's no evidence Rimbaud had it, and his colors don't match what synesthetes typically report, for whom A is often red. But 'Voyelles' became the emblem of the Symbolist dream that the senses answer one another, a dream [[kandinsky|Kandinsky]] carried into painting in [[spiritual-in-art|Concerning the Spiritual in Art]]."
  ],
  colors: ["Black", "White", "Red", "Green", "Blue"],
  swatches: [
    { h: "#16171A", label: "A · black" },
    { h: "#F7F6F2", label: "E · white" },
    { h: "#D62F2F", label: "I · red" },
    { h: "#2E9A4F", label: "U · green" },
    { h: "#2563C9", label: "O · blue (ending in violet)" }
  ],
  facts: [
    { label: "Written", value: "By September 1871" },
    { label: "Published", value: "Lutèce, October 1883" },
    { label: "Form", value: "Sonnet in alexandrines" }
  ],
  sources: [
    "Rimbaud, A. (1871). 'Voyelles'. First printed in Lutèce, 5–12 October 1883.",
    "Rimbaud, A. (1873). Une saison en enfer, 'Alchimie du verbe'.",
    "Wikipedia, 'Voyelles'."
  ]
},
{
  id: "spiritual-in-art", type: "work", title: "Kandinsky's Concerning the Spiritual in Art (1911)",
  dek: "Kandinsky's manifesto: colors are sounds for the soul, and painting can be as abstract as music.",
  body: [
    "Über das Geistige in der Kunst, published in Munich in 1911 and in English as Concerning the Spiritual in Art in 1914, is [[kandinsky|Wassily Kandinsky]]'s case for abstract painting. Its central idea is 'inner necessity': an artist should choose colors and forms for their effect on the soul, not to copy objects.",
    "Color, he argues, works in two steps: a physical effect on the eye, then a 'psychic' effect that sets the soul vibrating. [[Yellow|Yellow]] is the typically earthly color, insistent and aggressive; [[Blue|blue]] the heavenly one, drawing us inward. [[Green|Green]] is the most restful color, calm to the point of tedium. [[White|White]] is a silence full of possibilities; [[Black|black]] the silence of death. Sharp colors suit sharp forms, like a yellow triangle, and deep colors round ones, like a blue circle.",
    "He also maps colors onto instruments: light blue a flute, darker blue a cello, darker still a double bass, the deepest blue an organ; keen lemon yellow a shrill trumpet; green the calm middle notes of a violin. These are personal analogies, close in spirit to [[synesthesia|synesthesia]] and to [[rimbaud|Rimbaud]]'s vowels, and they owe a debt to [[goethe|Goethe]]'s lively and restless sides of color.",
    "None of it is experimental science (see [[color-psychology|color psychology]]), but it changed art. The book came out as Kandinsky moved into fully abstract painting, with works like [[painting-composition-vii|Composition VII]] (1913), and it became a reference for the [[bauhaus|Bauhaus]], where he taught from 1922."
  ],
  colors: ["Yellow", "Blue", "Green", "White", "Black"],
  swatches: [
    { h: "#F2C81F", label: "Yellow · earthly, aggressive" },
    { h: "#2563C9", label: "Blue · heavenly, deep" },
    { h: "#2E9A4F", label: "Green · the most restful" },
    { h: "#F7F6F2", label: "White · silence full of possibility" },
    { h: "#16171A", label: "Black · the silence of death" }
  ],
  facts: [
    { label: "Published", value: "Munich (Piper), 1911" },
    { label: "English", value: "Trans. Michael Sadleir, 1914" },
    { label: "Key idea", value: "Inner necessity" }
  ],
  sources: [
    "Kandinsky, W. (1911). Über das Geistige in der Kunst. Munich: R. Piper; trans. M. Sadleir (1914), Concerning the Spiritual in Art (Project Gutenberg).",
    "Wikipedia, 'Concerning the Spiritual in Art' and 'Wassily Kandinsky'."
  ]
},
{
  id: "interaction-of-color", type: "work", title: "Albers' Interaction of Color (1963)",
  dek: "Josef Albers' course in seeing: make one color look like two, and two colors look like one.",
  body: [
    "Interaction of Color, published by Yale University Press in 1963, records the color course [[josef-albers|Josef Albers]] taught at Black Mountain College and Yale. It has almost no color theory in the usual sense. Instead it sets exercises, done with sheets of colored paper, that train the eye to notice what colors do to each other.",
    "The core claim: we almost never see a color as it physically is. A color changes with its neighbors ([[simultaneous-contrast|simultaneous contrast]]), with how much area it covers, and with the light. So the exercises are traps to catch yourself seeing: make one color look like two by changing its surroundings; make two different colors look alike; find a color that seems to be the mixture of two others, creating illusions of transparency.",
    "Albers worked with colored paper rather than paint, partly because a printed sheet is a fixed, repeatable color, so there are no mixing errors, only perception. Students learned that the eye is easily fooled and that judging color, and [[value|value]] above all, is a trained skill, the same idea behind this app's eye-training gym.",
    "The first edition came as a large portfolio of color plates; later editions, including a digital one, followed. It descends from [[chevreul|Chevreul]]'s 1839 law of contrast and from the [[bauhaus|Bauhaus]] preliminary course, and its lessons run through Albers' own Homage to the Square paintings."
  ],
  colors: ["Taupe", "Beige", "Charcoal"],
  swatches: [
    { h: "#8E7F71", label: "The same color..." },
    { h: "#E6D5B0", label: "...looks darker on a light ground" },
    { h: "#36454F", label: "...and lighter on a dark ground" }
  ],
  facts: [
    { label: "Published", value: "Yale University Press, 1963" },
    { label: "Method", value: "Exercises with colored paper" },
    { label: "Lesson", value: "Color is relative" }
  ],
  sources: [
    "Albers, J. (1963). Interaction of Color. Yale University Press (50th anniversary ed. 2013).",
    "Josef and Anni Albers Foundation. Interaction of Color.",
    "Wikipedia, 'Josef Albers'."
  ]
},
{
  id: "dictionary-of-color-combinations", type: "work", title: "Sanzo Wada's A Dictionary of Color Combinations",
  dek: "A Japanese painter's 1930s pattern books, reissued in 2010 as a pocket guide that designers adore.",
  body: [
    "Sanzo Wada (1883–1967) was a Japanese painter who spent his working life on color. Born in Ikuno, in Hyōgo, he studied Western-style painting under Kuroda Seiki at the Tokyo School of Fine Arts and graduated in 1904. In 1907 his painting South Wind won the highest prize given at the first official Bunten exhibition, a second prize, since no first was awarded. Around 1909 he went to study in Europe, mostly France, and came home in 1915 by way of India and Burma.",
    "Back in Japan he painted, designed for the stage and taught, and he pushed for a shared language of color for industry. In 1927 he founded the Japan Standard Color Association, which issued a standard card of 500 colors and was reorganized in 1945 as the Japan Color Research Institute. Late in life his costumes for Teinosuke Kinugasa's film Gate of Hell (1953) won the Academy Award for color costume design, at the 1955 ceremony.",
    "His most famous work began as a set of pattern books. From 1933 he published Haishoku Sōkan, a six-volume survey of color combinations for working designers, each set of two, three or four colors printed as flat blocks side by side. It is a practical tool from Taishō and early Shōwa Japan, not a theory: almost no text, just combinations to look at.",
    "In 2010 the Kyoto publisher Seigensha reissued a selection as a small paperback, A Dictionary of Color Combinations, with 348 combinations. Eighty years after the originals, it became a cult book among graphic designers, illustrators and web designers, who share its pages online, and a second volume followed in 2020.",
    "This app links to the book rather than copying it: the combinations are Wada's, and the reissue is in copyright. Its lesson fits the rest of [[color-harmony|color harmony]]: instead of rules on a [[color-wheel|color wheel]], you train your eye on many good examples, much as [[josef-albers|Josef Albers]] taught with sheets of colored paper."
  ],
  facts: [
    { label: "Author", value: "Sanzo Wada (1883–1967)" },
    { label: "First published", value: "Haishoku Sōkan, six volumes, from 1933" },
    { label: "Reissue", value: "Seigensha, Kyoto, 2010 (348 combinations)" }
  ],
  sources: [
    "Wada, S. (2010). A Dictionary of Color Combinations. Seigensha Art Publishing, Kyoto. ISBN 978-4-86152-247-5.",
    "https://en.seigensha.com/books/978-4-86152-247-5/",
    "National Museum of Art, Japan, artist database: Wada Sanzō (artplatform.go.jp/artists/A2089).",
    "Wikipedia (Japanese), '和田三造'; Wikipedia, 'Gate of Hell (film)' (27th Academy Awards, costume design)."
  ]
},
{
  id: "remarks-on-colour", type: "work", title: "Wittgenstein's Remarks on Colour",
  dek: "Wittgenstein's last notebooks ask why there's no transparent white and no reddish green.",
  body: [
    "Remarks on Colour collects notes [[wittgenstein|Ludwig Wittgenstein]] wrote in 1950 and early 1951, in the last year of his life, much of it in Oxford. Edited by G. E. M. Anscombe, it was published in 1977 with the German text facing an English translation. It's a sequence of numbered remarks, not a finished argument.",
    "It starts from [[goethe|Goethe]]'s [[theory-of-colours|Theory of Colours]] and from a letter by the painter Philipp Otto Runge that Goethe printed in it. Runge noted things everyone seems forced to agree on: white is the lightest color, there can't be a transparent white, there can't be a reddish green. Wittgenstein asks what kind of truths these are: not discoveries of physics, yet not arbitrary definitions.",
    "His answer is that they belong to the logic, or 'geometry', of our color concepts: the rules of the language game we play with color words. Goethe's theory, he says, isn't really a theory at all, since it predicts nothing; it's an attempt to clarify the concept of color. [[isaac-newton|Newton]] explains light; Goethe and Runge describe how color words fit together.",
    "The book matters to anyone learning color words. It shows how much we know about colors just by knowing their names: that [[Grey|grey]] sits between [[Black|black]] and [[White|white]], that [[Brown|brown]] is never a glowing light, that 'reddish green' makes no sense. Vision science later tied some of this to opponent channels in the eye ([[trichromacy|how eyes see color]]); other questions, like [[qualia|qualia]], stay open."
  ],
  colors: ["White", "Grey", "Brown"],
  swatches: [
    { h: "#F7F6F2", label: "White · the lightest color (Runge)" },
    { h: "#8C9096", label: "Grey · between black and white" },
    { h: "#7A5230", label: "Brown · never a glowing light" }
  ],
  facts: [
    { label: "Written", value: "1950–51" },
    { label: "Published", value: "1977, ed. G. E. M. Anscombe" },
    { label: "Starting point", value: "Goethe and Runge" }
  ],
  sources: [
    "Wittgenstein, L. (1977). Remarks on Colour, ed. G. E. M. Anscombe, trans. L. L. McAlister and M. Schättle. Blackwell.",
    "Westphal, J. (1991). Colour: A Philosophical Introduction, 2nd ed. Blackwell.",
    "Wikipedia, 'Remarks on Colour'."
  ]
}

];
