// ColorHub guided stories: the front doors into the Explore wiki.
// Each story is a short full-screen slide deck (Instagram Stories / Brilliant style).
// Schema and visual types are enforced by tools/check_wiki.js. Hex values are screen approximations.
// Every specific claim was checked against the sources listed on its story.
window.STORIES = [

// ---------------------------------------------------------------- words
{
  id: "two-blues", shelf: "words",
  title: "Two blues, one word",
  dek: "Russian splits blue in two. Does that change what Russian speakers see?",
  cover: ["#87CEEB", "#0047AB", "#1C2B5A"],
  slides: [
    { v: { t: "pair", a: { h: "#87CEEB", label: "goluboy" }, b: { h: "#0047AB", label: "siniy" } },
      text: "To you, these are two shades of blue. To a Russian speaker, they are two different colors, the way [[Pink|pink]] and [[Red|red]] are different to you." },
    { v: { t: "type", word: "goluboy", sub: "light blue" },
      text: "Russian has no everyday word that covers every blue. Lighter blues, like the [[Sky blue|sky]], are goluboy. You can't just say 'blue'. You have to choose." },
    { v: { t: "type", word: "siniy", sub: "dark blue" },
      text: "Darker blues are siniy. Both are basic words, learned early and used by everyone. English does the same with red: light red got its own name, [[Pink|pink]]." },
    { v: { t: "row", items: [{ h: "#6FA3DA", label: "top" }, { h: "#6FA3DA", label: "same" }, { h: "#4D84CC", label: "different" }] },
      text: "In 2007, researchers showed Russian and English speakers three [[Blue|blue]] squares: which of the bottom two matches the top one? They timed every answer." },
    { v: { t: "strip", from: "#B4DAF5", to: "#1F3F8F", steps: 8 },
      text: "Russian speakers were faster when the two blues sat on opposite sides of their goluboy/siniy line, most of all for close shades. English speakers showed no such edge. [[linguistic-relativity|Do words change what we see?]]" },
    { v: { t: "type", word: "busy", sub: "a word task wipes out the edge" },
      text: "Then the researchers kept people's language busy with a second task. The Russian speakers' edge vanished; a spatial task didn't touch it. The words were helping in the moment, not rewiring the [[trichromacy|eye]]." },
    { v: { t: "pair", a: { h: "#9CC8EE", label: "goluboy" }, b: { h: "#3F6FC0", label: "siniy" } },
      text: "Keep it in proportion. The edge was a fraction of a second, and a 2020 study found no speed advantage at this line at all. [[linguistic-relativity|Words give you handles]] for color. They don't give you new eyes." }
  ],
  colors: ["Sky blue", "Cobalt", "Pink", "Red"],
  links: ["linguistic-relativity", "basic-color-terms"],
  sources: [
    "Winawer, Witthoft, Frank, Wu, Wade & Boroditsky 2007, Russian blues reveal effects of language on color discrimination, PNAS 104(19)",
    "Martinovic, Paramei & MacInnes 2020, Russian blues reveal the limits of language influencing colour discrimination, Cognition 201"
  ]
},
{
  id: "eleven-words", shelf: "words",
  title: "Eleven words, one order",
  dek: "Languages gain color words in a surprisingly fixed order. Can you guess what comes third?",
  cover: ["#16171A", "#F7F6F2", "#D62F2F", "#F2C81F", "#2563C9"],
  slides: [
    { v: { t: "pair", a: { h: "#22333B", label: "mili" }, b: { h: "#EFC9A4", label: "mola" } },
      text: "The Dani of New Guinea have just two [[basic-color-terms|basic color words]]. Mili covers dark and cool colors, mola covers light and warm ones. That's the whole set." },
    { v: { t: "big", n: "98", sub: "languages compared" },
      text: "In 1969, [[berlin-and-kay|Brent Berlin and Paul Kay]] compared color words across 98 languages and tested 20 of them with color chips. The number of words varied. The order did not." },
    { v: { t: "quiz", q: "A language has three basic color words. Two are black and white. Guess the third.",
        options: [{ label: "Red", h: "#D62F2F" }, { label: "Blue", h: "#2563C9" }, { label: "Green", h: "#2E9A4F" }, { label: "Yellow", h: "#F2C81F" }], answer: 0,
        explain: "Red. In Berlin and Kay's data the third word was red, then green or yellow, then the other one, then [[Blue|blue]]. Blue, the sky's color, comes surprisingly late." } },
    { v: { t: "row", items: [{ h: "#16171A" }, { h: "#F7F6F2" }, { h: "#D62F2F" }, { h: "#2E9A4F" }, { h: "#F2C81F" }, { h: "#2563C9" }, { h: "#7A5230" }] },
      text: "The order: dark and light, then red, then green and yellow, then blue, then [[Brown|brown]]. These are the [[basic-color-terms|basic color terms]], words everyone knows and no one has to explain." },
    { v: { t: "row", items: [{ h: "#7B3FA0", label: "purple" }, { h: "#F28DB2", label: "pink" }, { h: "#F07A1A", label: "orange" }, { h: "#8C9096", label: "grey" }] },
      text: "[[Purple]], [[Pink|pink]], orange and grey arrive last, in any order. English has all eleven. Russian adds a twelfth, a separate word for light blue." },
    { v: { t: "big", n: "110", sub: "languages, World Color Survey" },
      text: "A bigger follow-up surveyed 110 unwritten languages in the late 1970s. It softened the story: the first two words aren't really [[Black|black]] and [[White|white]] but dark-cool and light-warm, like mili and mola." },
    { v: { t: "strip", from: "#16171A", to: "#F7F6F2", steps: 6 },
      text: "So the order is a strong tendency, not a law of nature. But it's striking: people who never met keep carving the [[spectrum|colors]] up in nearly the same sequence." }
  ],
  colors: ["Red", "Blue", "Brown", "Pink", "Orange", "Grey", "Purple"],
  links: ["berlin-and-kay", "basic-color-terms", "linguistic-relativity"],
  sources: [
    "Berlin & Kay 1969, Basic Color Terms: Their Universality and Evolution, University of California Press",
    "Heider (Rosch) 1972, Universals in color naming and memory, Journal of Experimental Psychology (the Dani)",
    "Kay, Berlin, Maffi, Merrifield & Cook 2009, The World Color Survey, CSLI Publications"
  ]
},
{
  id: "before-orange", shelf: "words",
  title: "Before orange was a color",
  dek: "For centuries English had orange things but no word for orange. Foxes paid the price.",
  cover: ["#F07A1A", "#F28500", "#CC5500"],
  slides: [
    { v: { t: "swatch", h: "#E2702B", label: "a robin's breast" },
      text: "Look at a robin. Its breast is plainly [[Orange|orange]]. So why is it a redbreast? Because the name dates from the 1300s, when orange wasn't a color word in English yet." },
    { v: { t: "quote", q: "His colour was bitwixe yelow and reed", by: "Chaucer, The Nun's Priest's Tale" },
      text: "Chaucer, writing in the late 1300s, had the same problem with a fox. With no word for its fur, he called it something between [[Yellow|yellow]] and [[Red|red]]." },
    { v: { t: "type", word: "nāraṅga", sub: "Sanskrit: orange tree" },
      text: "The fruit brought the word. Sanskrit nāraṅga became Persian nārang, Arabic nāranj, then French orenge. In Italian and French the first n slipped off, swallowed by the word for 'a'." },
    { v: { t: "big", n: "1502", sub: "orange, first recorded as a color" },
      text: "English named the fruit long before the color. The first known use of orange as a color word is from 1502, in a list of cloth bought for the princess Margaret Tudor. [[Orange]]" },
    { v: { t: "row", items: [{ h: "#C8642A", label: "red fox" }, { h: "#B5512B", label: "red hair" }, { h: "#A8552A", label: "red squirrel" }] },
      text: "That's why so many orange things are still called red. Red foxes, red squirrels, red hair: [[Red|red]] had simply stretched to cover them, and the names stuck." },
    { v: { t: "quiz", q: "Orange isn't alone: color names are borrowed from things. Puce comes from the French word for…",
        options: [{ label: "A flea" }, { label: "A plum" }, { label: "A mole" }, { label: "A chestnut" }], answer: 0,
        explain: "A flea. [[Puce]] was the fashion at Marie Antoinette's court. The others are real too: [[Taupe|taupe]] means mole, and [[Maroon|maroon]] comes from marron, chestnut." } },
    { v: { t: "row", items: [{ h: "#C8A2C8", label: "lilac" }, { h: "#FA8072", label: "salmon" }, { h: "#40E0D0", label: "turquoise" }, { h: "#BDB76B", label: "khaki" }] },
      text: "A flower, a fish, a stone, and an Urdu word for dust. Of the 90 names you learn in this app, all but a handful are borrowed from a thing: [[Lilac|lilac]], [[Salmon|salmon]], [[Turquoise|turquoise]], [[Khaki|khaki]]." }
  ],
  colors: ["Orange", "Puce", "Taupe", "Maroon", "Lilac", "Salmon", "Turquoise", "Khaki"],
  links: ["basic-color-terms"],
  sources: [
    "Oxford English Dictionary, orange (1502 colour sense), via Wikipedia, Orange (colour)",
    "Wikipedia, Orange (word): Sanskrit to Arabic to French, and loss of the initial n by rebracketing",
    "Chaucer, The Nun's Priest's Tale, Harvard Chaucer site (chaucer.fas.harvard.edu)",
    "Etymonline, redbreast (early 14th century)",
    "Wikipedia, Puce (couleur puce, Marie Antoinette's court)"
  ]
},
{
  id: "blue-go-light", shelf: "words",
  title: "Why Japan's green light is blue",
  dek: "In Japan the go light is called ao, blue. It looks green. Blame a very old word.",
  cover: ["#00A99D", "#2563C9", "#2E9A4F"],
  slides: [
    { v: { t: "swatch", h: "#00A99D", label: "a Japanese go light" },
      text: "In Japan, drivers wait for the 'blue' light. Look at it: it's [[Green|green]], perhaps a bluish green. Ask anyone, though, and it's ao, blue." },
    { v: { t: "type", word: "ao", sub: "青: blue, and once green too" },
      text: "For most of Japanese history, ao covered blue and green together: sky, sea and leaves. Many languages work this way. Linguists call such a word 'grue'. [[basic-color-terms|Basic color terms]]" },
    { v: { t: "type", word: "midori", sub: "緑: green" },
      text: "Midori comes from an old verb for coming into leaf. Over centuries it became the everyday word for green, but ao never fully let go." },
    { v: { t: "row", items: [{ h: "#3E8E3A", label: "ao-yasai" }, { h: "#7BB661", label: "aoba" }, { h: "#A8D46F", label: "ao-ringo" }] },
      text: "The old grue word survives in food and plants. Fresh leaves are aoba, a green apple is an ao-ringo, and leafy greens can be ao-yasai, literally 'blue vegetables'." },
    { v: { t: "big", n: "1930", sub: "Japan's first traffic lights" },
      text: "When traffic lights arrived, around 1930, the rules called the go light green. People called it ao anyway, and now the law itself says 'blue light'." },
    { v: { t: "pair", a: { h: "#2E9A4F", label: "green" }, b: { h: "#00A99D", label: "bluer green" } },
      text: "Since the 1970s Japan's go lights have been made a bluer green. The story of a 1973 government order to match the name has no document behind it, so treat that part as legend. [[linguistic-relativity|Do words change what we see?]]" }
  ],
  colors: ["Green", "Blue"],
  links: ["basic-color-terms", "linguistic-relativity", "berlin-and-kay"],
  sources: [
    "Japan, Road Traffic Act Enforcement Order (道路交通法施行令), Article 2: the go signal is 青色の灯火, 'blue light'",
    "Motor Club web column (mc-web.jp, 2023): the 1930 regulations called it a 'green signal'",
    "Wikipedia, Blue–green distinction in language; Green (Japanese midori from midoru, 'to come into leaf')",
    "Atlas Obscura 2017, According to Japanese Traffic Lights, 'Bleen' Means Go (the unconfirmed 1973 story)"
  ]
},

// ---------------------------------------------------------------- history
{
  id: "snail-purple", shelf: "history",
  title: "The purple that stank of snails",
  dek: "Emperors' purple came from sea snails, thousands of them for a pinch of dye.",
  cover: ["#66023C", "#702963", "#3D0734"],
  slides: [
    { v: { t: "big", n: "12,000", sub: "sea snails for 1.4 grams of dye" },
      text: "In 1909 the chemist Paul Friedländer crushed 12,000 sea snails to find out what [[tyrian-purple|Tyrian purple]] was made of. He got 1.4 grams of dye." },
    { v: { t: "swatch", h: "#66023C", label: "Tyrian purple, roughly" },
      text: "[[tyrian-purple|Tyrian purple]] came from a gland in murex sea snails, worked in dye houses around Tyre, in today's Lebanon. The vats of rotting snails stank, and the dye works were famous for it." },
    { v: { t: "type", word: "clotted blood", sub: "Pliny on the finest shade" },
      text: "It wasn't the violet we call purple now. Pliny the Elder said the best was the color of clotted blood: blackish at first glance, glowing when held up to the light. Think [[Byzantium|byzantium]] or darker." },
    { v: { t: "quiz", q: "In 301 AD, Rome fixed maximum prices. A pound of purple-dyed silk cost how much next to a pound of gold?",
        options: [{ label: "A tenth as much" }, { label: "About the same" }, { label: "About twice as much" }], answer: 2,
        explain: "Twice as much: 150,000 denarii against 72,000 for refined [[Gold|gold]], in Diocletian's price edict. A pound of purple wool cost 50,000, about 2,000 days' pay for a farm worker." } },
    { v: { t: "pair", a: { h: "#66023C", label: "imperial purple" }, b: { h: "#C8A2C8", label: "lighter purple" } },
      text: "Emperors guarded it. Roman law limited who could make the real dye, and in later centuries wearing imperial purple in public could look like a claim to the throne. [[royal-purple|Purple and power]]" },
    { v: { t: "type", word: "porphyrogennetos", sub: "Greek: born in the purple" },
      text: "In Constantinople, children born to a reigning emperor were [[royal-purple|'born in the purple']], delivered in a palace room lined with purple stone. The phrase still means royal by birth." },
    { v: { t: "row", items: [{ h: "#66023C" }, { h: "#702963" }, { h: "#8E4585" }, { h: "#3D0734" }] },
      text: "Rich, lasting purple stayed a luxury for centuries. Then in 1856 an 18-year-old chemist made one from coal tar by accident. That story is [[mauveine|Mauveine and the aniline dyes]]." }
  ],
  colors: ["Byzantium", "Plum", "Aubergine", "Lilac"],
  links: ["tyrian-purple", "royal-purple", "mauveine"],
  sources: [
    "Wolk & Frimer 2010, Preparation of Tyrian Purple (6,6'-Dibromoindigo): Past and Present, Molecules 15(8): 5473–5508 (Friedländer 1909: 12,000 snails, 1.4 g)",
    "Pliny the Elder, Natural History, Book 9 (the clotted-blood shade)",
    "Kropff 2016, An English translation of the Edict on Maximum Prices (Diocletian, 301 AD): purple silk 150,000, purple wool 50,000, gold 72,000 denarii per pound; farm labourer 25 a day",
    "Wikipedia, Born in the purple; Britannica, Constantine VII Porphyrogenitus"
  ]
},
{
  id: "perkins-purple", shelf: "history",
  title: "Perkin's purple accident",
  dek: "A teenager tried to make a malaria drug and made a color that took over London.",
  cover: ["#8D029B", "#A8778F", "#16171A"],
  slides: [
    { v: { t: "swatch", h: "#8D029B", label: "mauveine, roughly" },
      text: "This purple was an accident. Easter, 1856: William Perkin, just 18, was working in a home lab during his college break, trying to make something else entirely. [[william-perkin|William Perkin]]" },
    { v: { t: "type", word: "quinine", sub: "what he was really after" },
      text: "He was trying to make quinine, the malaria drug, from chemicals in coal tar. He failed. What he got instead dyed silk a brilliant [[Purple|purple]] that didn't wash out." },
    { v: { t: "type", word: "mauve", sub: "French for the mallow flower" },
      text: "He patented the dye that August and, against his teacher's advice, opened a factory near London in 1857 with his father's money. By 1859 it was called [[Mauve|mauve]], the French word for mallow." },
    { v: { t: "big", n: "1859", sub: "London catches 'mauve measles'" },
      text: "By 1859 the color was everywhere. Punch magazine joked that London had caught the 'mauve measles', a rash of ribbons spreading across the city." },
    { v: { t: "row", items: [{ h: "#8D029B", label: "mauveine" }, { h: "#FF00FF", label: "magenta" }, { h: "#66023C", label: "snail purple" }] },
      text: "Before Perkin, dyes came from plants, insects and snails. After him, chemists raced to brew colors from coal tar. [[Magenta|Magenta]] followed within a few years." },
    { v: { t: "big", n: "36", sub: "Perkin's age when he sold up" },
      text: "[[william-perkin|Perkin]] wasn't the first to coax a dye out of coal-tar chemicals, but he was the first to build an industry on one. He sold the business at 36 and went back to research." },
    { v: { t: "pair", a: { h: "#8D029B", label: "mauve in 1856" }, b: { h: "#A8778F", label: "mauve today" } },
      text: "The name outlived the color. Today's [[Mauve|mauve]] is a dusty pink-purple, nothing like Perkin's electric violet. More in [[mauveine|Mauveine and the aniline dyes]]." }
  ],
  colors: ["Mauve", "Magenta"],
  links: ["mauveine", "william-perkin", "tyrian-purple"],
  sources: [
    "Science History Institute, William Henry Perkin (biography)",
    "Science Museum, The colourful chemistry of artificial dyes (Perkin not the first to make an aniline dye; 'mauve measles', Punch 1859)",
    "Ashmolean Museum, The colour revolution in Victorian fashion"
  ]
},
{
  id: "bluer-than-gold", shelf: "history",
  title: "A blue as precious as gold",
  dek: "Europe's finest blue came from one mountain valley in Afghanistan. Painters paid dearly.",
  cover: ["#2440A6", "#1C2B5A", "#FFD700"],
  slides: [
    { v: { t: "swatch", h: "#2440A6", label: "ultramarine, roughly" },
      text: "In Renaissance Europe this blue cost as much as [[Gold|gold]], sometimes more. Painters saved it for the most important thing in the picture, usually the Virgin Mary's robe." },
    { v: { t: "type", word: "ultramarine", sub: "Latin: from beyond the sea" },
      text: "It was ground from lapis lazuli, a stone mined near Sar-i Sang in the mountains of Afghanistan and traded west through Venice. Hence the name. [[ultramarine-pigment|Ultramarine and lapis lazuli]]" },
    { v: { t: "pair", a: { h: "#7D8AA8", label: "just ground" }, b: { h: "#2440A6", label: "extracted" } },
      text: "Making the paint was hard. Plain ground lapis gives a dull [[Slate|grey-blue]]. Painters kneaded the powder into a dough of wax, resins and oils, then worked it in lye until the pure blue washed out." },
    { v: { t: "pair", a: { h: "#2440A6", label: "the plan" }, b: { h: "#E9DFC8", label: "bare panel" } },
      text: "Michelangelo's Entombment, in London's National Gallery, has an empty patch where the Virgin should kneel. The gallery suggests he was waiting for [[ultramarine-pigment|ultramarine]], the costliest paint, when he left the work unfinished." },
    { v: { t: "swatch", h: "#24418F", label: "Vermeer's headscarf" },
      text: "Vermeer used the real thing. The 2018 'Girl in the Spotlight' study of [[painting-pearl-earring|Girl with a Pearl Earring]] found high-quality ultramarine in her blue headscarf, made at least partly from heated lapis." },
    { v: { t: "big", n: "6,000", sub: "francs for a synthetic blue" },
      text: "In 1824 a French society offered 6,000 francs to anyone who could make it cheaply. Jean-Baptiste Guimet claimed the prize in 1828. Today the ultramarine in a paint tube is almost always synthetic." },
    { v: { t: "row", items: [{ h: "#2440A6", label: "ultramarine" }, { h: "#0047AB", label: "cobalt" }, { h: "#1C2B5A", label: "navy" }] },
      text: "In the 1950s one artist made ultramarine his signature: [[yves-klein|Yves Klein]]. Compare it with [[Cobalt|cobalt]] and [[Navy|navy]]." }
  ],
  colors: ["Cobalt", "Navy", "Gold"],
  links: ["ultramarine-pigment", "vermeer", "painting-pearl-earring", "yves-klein"],
  sources: [
    "National Gallery, London, Michelangelo, The Entombment (catalogue entry on the missing ultramarine)",
    "van Loon, Vandivere et al. 2020, Out of the blue: Vermeer's use of ultramarine in Girl with a Pearl Earring, Heritage Science 8",
    "WebExhibits, Pigments through the Ages: Ultramarine (price, 1824 prize, Guimet 1828)",
    "Wikipedia, Ultramarine (Cennini's extraction method; Sar-i Sang)"
  ]
},
{
  id: "strange-paints", shelf: "history",
  title: "Paint made of bugs and mummies",
  dek: "Some of history's best colors came from the strangest places. Can you guess which?",
  cover: ["#960018", "#5C3A21", "#8A6A4F"],
  slides: [
    { v: { t: "quiz", q: "Which of these colors was made from crushed insects?",
        options: [{ label: "Carmine", h: "#960018" }, { label: "Sepia", h: "#8A6A4F" }, { label: "Ochre", h: "#CC7722" }, { label: "Cobalt", h: "#0047AB" }], answer: 0,
        explain: "[[Carmine]]. It comes from cochineal, tiny scale insects that live on prickly-pear cactus. The red is carminic acid, carried by the females." } },
    { v: { t: "big", n: "70,000", sub: "dried insects for a pound of dye" },
      text: "It took as many as 70,000 dried insects to make a pound of dye. People in Mexico and Central America were farming them long before Europeans arrived. [[cochineal|Cochineal and carmine]]" },
    { v: { t: "swatch", h: "#C41E3A", label: "cochineal red" },
      text: "Spain kept the source to itself. Cochineal became one of its most valuable exports from Mexico, second only to silver. It outshone the reds Europe already had, like [[kermes|kermes]]." },
    { v: { t: "type", word: "E120", sub: "cochineal on a food label" },
      text: "It never left. If a label says [[Carmine|carmine]], Natural Red 4 or E120, that's cochineal, still coloring foods and cosmetics today." },
    { v: { t: "swatch", h: "#5C3A21", label: "mummy brown, roughly" },
      text: "Mummy brown was made from ground-up Egyptian mummies. From at least the 1500s into the early 1900s, European painters prized it for its rich, see-through brown. [[mummy-brown|Mummy brown]]" },
    { v: { t: "type", word: "buried", sub: "Burne-Jones and his tube" },
      text: "When the painter Edward Burne-Jones found out [[mummy-brown|what it was made of]], he took his tube into the garden and gave it a funeral. His nephew, Rudyard Kipling, was there and remembered it." },
    { v: { t: "pair", a: { h: "#8A6A4F", label: "sepia" }, b: { h: "#CC7722", label: "ochre" } },
      text: "[[Sepia]] began as cuttlefish ink; sepia is the animal's Latin name. [[Ochre]] is plain iron-rich earth, the oldest paint of all. Painters used whatever worked. [[earth-pigments|Earth pigments]]" }
  ],
  colors: ["Carmine", "Sepia", "Ochre", "Cobalt"],
  links: ["cochineal", "mummy-brown", "kermes", "earth-pigments"],
  sources: [
    "Smithsonian Magazine 2017, The Bug That Had the World Seeing Red (70,000 insects per pound; second only to silver; E120)",
    "National Geographic, Was this masterpiece painted with ground mummy? (16th to early 20th century use)",
    "Rudyard Kipling, Something of Myself (1937), on Burne-Jones burying his Mummy Brown"
  ]
},

// ---------------------------------------------------------------- philosophy
{
  id: "newtons-seven", shelf: "philosophy",
  title: "Why the rainbow has seven colors",
  dek: "A rainbow is a smooth blur. Newton counted seven, and his reason was music.",
  cover: ["#E8392E", "#F28A1C", "#F5D327", "#3BAA4A", "#3D2B8E"],
  slides: [
    { v: { t: "row", items: [{ h: "#E8392E" }, { h: "#F28A1C" }, { h: "#F5D327" }, { h: "#3BAA4A" }, { h: "#1F8FD6" }, { h: "#3D2B8E" }, { h: "#8000FF" }] },
      text: "Count the colors in a rainbow. There are no lines in the sky: the light shades smoothly from one end to the other. The count of seven comes from one man. [[spectrum|The spectrum and the rainbow]]" },
    { v: { t: "quote", q: "Red, yellow, Green, Blew, & a violet purple", by: "Isaac Newton" },
      text: "In the 1660s [[isaac-newton|Isaac Newton]] split sunlight with a prism. His first list had five main colors. Later he added two more: orange and indigo." },
    { v: { t: "quiz", q: "Why did Newton want exactly seven colors?",
        options: [{ label: "To match the notes of a musical scale" }, { label: "To match the days of the week" }, { label: "Seven is how many he could see" }], answer: 0,
        explain: "Music. He matched the colors to the seven notes of a scale, and even sized the slices of his [[color-wheel|color circle]] by musical intervals." } },
    { v: { t: "type", word: "indigo", sub: "the color squeezed in" },
      text: "That's how [[Indigo|indigo]] got in. Plenty of people can't find it as a band of its own; Isaac Asimov said it never seemed worth the dignity. Some think Newton's blue was nearer our cyan, though scholars disagree." },
    { v: { t: "wheel", base: "#E8392E", scheme: "analogous" },
      text: "In [[opticks|Opticks]] (1704) Newton bent the band into a circle, red touching violet. It's one of the first color wheels on record. [[color-wheel|The color wheel]]" },
    { v: { t: "row", items: [{ h: "#E8392E", label: "red" }, { h: "#FF00FF", label: "magenta" }, { h: "#8000FF", label: "violet" }] },
      text: "Later wheels filled that join with purples and [[Magenta|magenta]]. No single wavelength of light looks magenta. Your brain makes it when red and blue light arrive together. [[extra-spectral|Colors that aren't in the rainbow]]" },
    { v: { t: "strip", from: "#F5D327", to: "#3BAA4A", steps: 12 },
      text: "So seven is Newton's choice, not a fact of physics. The light is continuous; the lines are ours. The same is true of every [[basic-color-terms|color word]] you learn." }
  ],
  colors: ["Indigo", "Magenta", "Violet"],
  links: ["isaac-newton", "spectrum", "opticks", "color-wheel", "extra-spectral"],
  sources: [
    "Newton 1672, A New Theory about Light and Colours, Philosophical Transactions; Newton 1704, Opticks",
    "Wikipedia, Indigo (Newton's five then seven colours; Asimov's remark); ROYGBIV (musical scale)",
    "Wikipedia, Color wheel (Newton's circle divided by musical intervals); Line of purples"
  ]
},
{
  id: "goethe-vs-newton", shelf: "philosophy",
  title: "Goethe's war on Newton",
  dek: "Germany's greatest poet spent decades insisting Newton was wrong about color. Was he?",
  cover: ["#F2C81F", "#2563C9", "#16171A", "#F7F6F2"],
  slides: [
    { v: { t: "swatch", h: "#F7F6F2", label: "a white wall" },
      text: "[[goethe|Goethe]] borrowed some prisms. Before sending them back, he looked through one at a white wall, expecting the whole wall to burst into a rainbow. It stayed white." },
    { v: { t: "pair", a: { h: "#F2C81F", label: "light side" }, b: { h: "#2563C9", label: "dark side" } },
      text: "Color showed up only at the edges, where light met dark: [[Yellow|yellows]] on one side, [[Blue|blues]] on the other. So Goethe decided color isn't hidden inside white light. It's made where light and darkness meet." },
    { v: { t: "big", n: "1810", sub: "Goethe's Theory of Colours" },
      text: "He spent decades on it. [[theory-of-colours|Theory of Colours]] (1810) is huge, and its attack on [[isaac-newton|Newton]] was so violent that the English translator left that part out." },
    { v: { t: "quote", q: "in my century I am the only person who knows the truth", by: "Goethe to Eckermann, on colour" },
      text: "Late in life he told his secretary that his poems didn't make him proud. Being right about [[theory-of-colours|color]] did." },
    { v: { t: "type", word: "both", sub: "right about different things" },
      text: "So who was right? On physics, Newton: white light really is a mix of [[spectrum|wavelengths]]. But Goethe was studying what eyes and minds do with light, and there he saw things Newton never looked for." },
    { v: { t: "pair", a: { h: "#E8392E", label: "stare at this" }, b: { h: "#3FC6C0", label: "then see this" } },
      text: "He catalogued afterimages and colored shadows, and built a wheel where opposite colors call each other up in the eye. That's the root of [[complementary-colors|complementary colors]]." },
    { v: { t: "swatch", h: "#E8B04A", label: "Turner's light" },
      text: "Artists and thinkers kept reading him. Turner painted Light and Colour (Goethe's Theory) in 1843, and [[wittgenstein|Wittgenstein]]'s last notes on color start from Goethe. [[remarks-on-colour|Remarks on Colour]]" }
  ],
  colors: ["Yellow", "Blue"],
  links: ["goethe", "theory-of-colours", "isaac-newton", "complementary-colors", "remarks-on-colour"],
  sources: [
    "Goethe 1810, Zur Farbenlehre; English translation by Charles Eastlake 1840 (polemical part omitted)",
    "Eckermann, Conversations with Goethe, trans. John Oxenford 1850",
    "Wikipedia, Theory of Colours (the prism and the white wall; influence on Turner, Schopenhauer, Wittgenstein)",
    "Tate, J. M. W. Turner, Light and Colour (Goethe's Theory), exhibited 1843"
  ]
},
{
  id: "your-red-my-red", shelf: "philosophy",
  title: "Is your red my red?",
  dek: "You and a friend both call a tomato red. Is it the same red inside your heads?",
  cover: ["#D62F2F", "#2E9A4F", "#8C9096"],
  slides: [
    { v: { t: "swatch", h: "#D62F2F", label: "red" },
      text: "You and a friend both call this red. You agree on every tomato and stop sign. But is the red in your head the same as the red in theirs? There's no obvious way to check. [[qualia|Is your red my red?]]" },
    { v: { t: "pair", a: { h: "#8000FF", label: "violet" }, b: { h: "#EAA221", label: "marigold" } },
      text: "John Locke asked this in 1689. Suppose a [[Violet|violet]] gave one person the sight a [[Marigold|marigold]] gives another, and the other way round. They'd use every word the same way, so nobody would ever find out." },
    { v: { t: "strip", from: "#F2C81F", to: "#3B2F0A", steps: 7 },
      text: "A clue that a swap might show up after all. Darken yellow and it turns into [[Olive|olive]] and brown, new colors with new names." },
    { v: { t: "strip", from: "#87CEEB", to: "#1C2B5A", steps: 7 },
      text: "Darken [[Blue|blue]] and it's still blue. The philosopher C. L. Hardin argued that lopsided color space like this would give a swap away. A perfectly hidden swap is harder than Locke thought." },
    { v: { t: "swatch", h: "#8C9096", label: "Mary's room" },
      text: "Frank Jackson's 1982 version: Mary is a scientist who knows every physical fact about [[trichromacy|color vision]], but has spent her whole life in a black-and-white room, seeing the world on a black-and-white screen." },
    { v: { t: "swatch", h: "#D62F2F", label: "her first red" },
      text: "One day she walks out and sees [[Red|red]] for the first time. Does she learn something new? If she does, then all the facts about wavelengths and neurons seem to leave something out: what red is like." },
    { v: { t: "type", word: "qualia", sub: "what an experience is like" },
      text: "Philosophers call that 'what it's like' [[qualia|qualia]], and they still argue. Jackson himself later changed sides and became a physicalist. The question has outlived his answer." }
  ],
  colors: ["Red", "Violet", "Marigold", "Olive"],
  links: ["qualia", "trichromacy"],
  sources: [
    "John Locke 1689, An Essay Concerning Human Understanding, Book II, ch. 32 (violet and marigold)",
    "Frank Jackson 1982, Epiphenomenal Qualia, Philosophical Quarterly 32",
    "C. L. Hardin 1988, Color for Philosophers: Unweaving the Rainbow (asymmetries of color space)",
    "Wikipedia, Inverted spectrum; Knowledge argument (Jackson's later physicalism)"
  ]
},
{
  id: "reddish-green", shelf: "philosophy",
  title: "Can you picture reddish green?",
  dek: "Reddish yellow is orange, bluish red is purple. So why can't anyone imagine a reddish green?",
  cover: ["#D62F2F", "#2E9A4F", "#F2C81F", "#2563C9"],
  slides: [
    { v: { t: "pair", a: { h: "#D62F2F", label: "red" }, b: { h: "#F2C81F", label: "yellow" } },
      text: "Picture a reddish yellow: that's [[Orange|orange]]. A bluish red: [[Purple|purple]]. Easy. Our minds blend neighbors without effort." },
    { v: { t: "pair", a: { h: "#D62F2F", label: "red" }, b: { h: "#2E9A4F", label: "green" } },
      text: "Now picture a reddish green. Not brown, not grey: a green that is also red. Most people find they can't. [[wittgenstein|Wittgenstein]] puzzled over exactly this in his last year of life." },
    { v: { t: "quiz", q: "Which of these can't you picture as one color?",
        options: [{ label: "Reddish yellow" }, { label: "Bluish red" }, { label: "Yellowish green" }, { label: "Bluish yellow" }], answer: 3,
        explain: "Bluish yellow, the other 'forbidden' pair. A yellowish green is just [[Chartreuse|chartreuse]]. But blue against yellow, like red against green, seems to cancel out." } },
    { v: { t: "type", word: "opponents", sub: "red vs green, blue vs yellow" },
      text: "In the late 1800s the physiologist Ewald Hering proposed that vision codes color in opposed pairs: [[Red|red]] against [[Green|green]], blue against yellow, light against dark. A signal can lean one way, never both." },
    { v: { t: "type", word: "logic?", sub: "or physics?" },
      text: "Wittgenstein asked what kind of truth 'there is no reddish green' is. Not a finding of physics, he thought, but something like a geometry of our color concepts. [[remarks-on-colour|Remarks on Colour]]" },
    { v: { t: "pair", a: { h: "#E03A2F", label: "red stripe" }, b: { h: "#2FA34A", label: "green stripe" } },
      text: "In 1983 two scientists used an eye tracker to pin a red and a green stripe to the eye, so the border never moved. Some viewers said they saw reddish green. Some saw a color they couldn't name." },
    { v: { t: "swatch", h: "#6E5A2E", label: "or just mud?" },
      text: "Since then: a 2001 study saw it again with brightness matched, while a 2006 study said viewers were only seeing muddy in-between colors. The forbidden color is still on trial. [[trichromacy|How eyes see color]]" }
  ],
  colors: ["Orange", "Purple", "Chartreuse", "Red", "Green"],
  links: ["wittgenstein", "remarks-on-colour", "trichromacy"],
  sources: [
    "Wittgenstein, Remarks on Colour (written 1950–51, published 1977)",
    "Crane & Piantanida 1983, On seeing reddish green and yellowish blue, Science 221",
    "Billock, Gleason & Tsou 2001, Perception of forbidden colors in retinally stabilized equiluminant images, JOSA A 18",
    "Hsieh & Tse 2006, Illusory color mixing upon perceptual fading and filling-in does not result in 'forbidden colors', Vision Research 46",
    "Wikipedia, Opponent process; Impossible color"
  ]
},
// ---------------------------------------------------------------- mind
{
  id: "the-dress", shelf: "mind",
  title: "The dress that split the internet",
  dek: "Blue and black, or white and gold? One photo showed how your brain edits every color you see.",
  cover: ["#8D9BCB", "#77623C", "#2747A8", "#16171A"],
  slides: [
    { v: { t: "pair", a: { h: "#8D9BCB", label: "stripes, in the photo" }, b: { h: "#77623C", label: "lace, in the photo" } },
      text: "February 2015. A mother photographed a dress before her daughter's wedding, and the picture went viral. Some people saw [[White|white]] and [[Gold|gold]]. Others saw blue and black, and couldn't believe anyone didn't." },
    { v: { t: "quiz", q: "What color was the real dress?",
        options: [{ label: "Blue and black", h: "#2747A8" }, { label: "White and gold", h: "#E9E2CF" }, { label: "Blue and brown", h: "#6B5232" }], answer: 0,
        explain: "[[Royal blue]] with [[Black|black]] lace, from the British label Roman Originals. The photo was overexposed and badly white-balanced, so its pixels sit somewhere in between." } },
    { v: { t: "big", n: "57%", sub: "saw blue and black" },
      text: "Scientists surveyed about 1,400 people: 57% saw blue and black, 30% white and gold, 11% blue and brown. Same pixels, different colors." },
    { v: { t: "pair", a: { h: "#B9C7E8", label: "bluish daylight" }, b: { h: "#E8C48A", label: "warm lamplight" } },
      text: "Your brain never takes color at face value. It guesses the light falling on a thing and subtracts it, so a white shirt looks white at noon and at sunset. The dress photo gives no clear clue about the light. [[color-constancy|Color constancy]]" },
    { v: { t: "pair", a: { h: "#F1ECDF", label: "if you assumed shade" }, b: { h: "#2747A8", label: "if you assumed lamplight" } },
      text: "Assume the dress is in bluish shade, and your brain subtracts blue: white and gold. Assume warm indoor light, and it subtracts yellow: blue and black. Both are sensible guesses." },
    { v: { t: "type", word: "larks", sub: "and night owls" },
      text: "Psychologist Pascal Wallisch found a hint of why people differ. Early risers, who see more daylight, leaned white and gold. Night owls, used to lamplight, leaned blue and black." },
    { v: { t: "swatch", h: "#8D9BCB", label: "the famous pixels" },
      text: "So the dress wasn't really a trick. It caught your eyes doing what they do every second: [[color-constancy|guessing the light and correcting for it]]. Usually the guess is so good you never notice." }
  ],
  colors: ["Royal blue", "Black", "White", "Gold"],
  links: ["color-constancy", "trichromacy"],
  sources: [
    "Lafer-Sousa, Hermann & Conway 2015, Striking individual differences in color perception uncovered by 'the dress' photograph, Current Biology 25",
    "Wallisch 2017, Illumination assumptions account for individual differences in the perceptual interpretation of a profoundly ambiguous stimulus in the color domain, Journal of Vision 17",
    "Wikipedia, The dress (photograph, Roman Originals, survey figures)"
  ]
},
{
  id: "one-color-two-faces", shelf: "mind",
  title: "One color, two faces",
  dek: "The same color can look like two different ones. Josef Albers built a whole course on that.",
  cover: ["#A08C9C", "#F2C81F", "#5B2C83"],
  slides: [
    { v: { t: "contrast", inner: "#A08C9C", grounds: ["#F2C81F", "#5B2C83"] },
      text: "Two small squares. One looks darker and purpler, the other lighter and yellower. Tap to take the backgrounds away. [[simultaneous-contrast|Simultaneous contrast]]" },
    { v: { t: "type", word: "relative", sub: "Albers on color" },
      text: "[[josef-albers|Josef Albers]] taught that color is the most relative thing in art. We almost never see a color as it physically is, because its neighbors keep changing it." },
    { v: { t: "big", n: "1963", sub: "Interaction of Color" },
      text: "He taught at the [[bauhaus|Bauhaus]], Black Mountain College and Yale. In 1963 he published [[interaction-of-color|Interaction of Color]]: not rules, but exercises with colored paper that train the eye." },
    { v: { t: "contrast", inner: "#808080", grounds: ["#16171A", "#F7F6F2"] },
      text: "The simplest version: one grey, on black and on white. On black it glows; on white it sinks. Your eye judges every color against what surrounds it. [[value|Value: light and dark]]" },
    { v: { t: "type", word: "two as one", sub: "Albers' harder trick" },
      text: "His harder [[interaction-of-color|trick]]: make two different colors look the same. Put the lighter one on a light ground and the darker one on a dark ground, and they can meet in the middle." },
    { v: { t: "row", items: [{ h: "#C9A227", label: "outer" }, { h: "#D9B84A", label: "middle" }, { h: "#EBD27A", label: "inner" }] },
      text: "From 1950 [[josef-albers|Albers]] painted hundreds of Homage to the Square pictures: three or four nested squares, each one testing how neighbors push and pull. On the back he listed the exact paints." },
    { v: { t: "swatch", h: "#121212", label: "this app's frame" },
      text: "It's why this app keeps everything around a swatch a neutral dark grey. A colored frame would [[simultaneous-contrast|change]] the very color you're trying to learn." }
  ],
  colors: ["Grey", "Yellow", "Purple"],
  links: ["simultaneous-contrast", "josef-albers", "interaction-of-color", "value"],
  sources: [
    "Josef Albers 1963, Interaction of Color, Yale University Press",
    "Wikipedia, Josef Albers (Bauhaus, Black Mountain College, Yale; Homage to the Square from 1950, per the Josef and Anni Albers Foundation)",
    "ColorHub DESIGN.md (neutral surround, ISO 3664 viewing standard)"
  ]
},
{
  id: "daltons-eye", shelf: "mind",
  title: "The scientist who saw pink as blue",
  dek: "John Dalton studied his own color blindness, then left his eyes to science to test a theory.",
  cover: ["#F28DB2", "#87CEEB", "#D62F2F", "#2E9A4F"],
  slides: [
    { v: { t: "pair", a: { h: "#F28DB2", label: "pink" }, b: { h: "#87CEEB", label: "sky blue" } },
      text: "John Dalton, the chemist behind atomic theory, mixed up [[Pink|pink]] and [[Sky blue|blue]]. In 1794 he described his own color vision in one of the first scientific papers on color blindness." },
    { v: { t: "pair", a: { h: "#FF2400", label: "scarlet" }, b: { h: "#2E9A4F", label: "green" } },
      text: "He and his brother also confused [[Scarlet|scarlet]] with green, the classic red–green mix-up. That his brother had it too was a clue that it runs in families. [[color-blindness|Color blindness]]" },
    { v: { t: "type", word: "daltonism", sub: "color blindness, in many languages" },
      text: "His name stuck to it. In English 'daltonism' is a rare word, but in French, Spanish and many other languages it's the everyday term for [[color-blindness|color blindness]]." },
    { v: { t: "swatch", h: "#3C5A9A", label: "his theory: blue eye fluid" },
      text: "Dalton guessed that the jelly inside his eyeballs was tinted blue, soaking up [[Red|red]] light. To prove it, he asked that his eyes be examined after his death." },
    { v: { t: "big", n: "1844", sub: "the eyes are examined" },
      text: "He died in 1844, and the examination was done as he asked. The fluid was perfectly clear. The theory was wrong, but the eye was kept, preserved in Manchester." },
    { v: { t: "big", n: "1995", sub: "DNA from Dalton's eye" },
      text: "In 1995 scientists extracted DNA from that eye. Dalton was a deuteranope: he lacked the cone pigment tuned to middle, 'green' wavelengths. [[trichromacy|How eyes see color]]" },
    { v: { t: "big", n: "1 in 12", sub: "men of Northern European descent" },
      text: "It's common. [[color-blindness|Red–green color blindness]] affects about 8% of men and 0.5% of women of Northern European ancestry. Blue–yellow types and total color blindness are much rarer." }
  ],
  colors: ["Pink", "Sky blue", "Scarlet", "Green"],
  links: ["color-blindness", "trichromacy"],
  sources: [
    "Dalton 1798 (read 1794), Extraordinary facts relating to the vision of colours, Memoirs of the Manchester Literary and Philosophical Society",
    "Hunt, Dulai, Bowmaker & Mollon 1995, The chemistry of John Dalton's color blindness, Science 267",
    "Wikipedia, John Dalton; Color blindness (prevalence 8% of men, 0.5% of women, Northern European ancestry)"
  ]
},
{
  id: "red-wins", shelf: "mind",
  title: "Does red make you win?",
  dek: "Famous studies say red helps athletes and pink calms prisoners. Here's what held up.",
  cover: ["#D62F2F", "#2563C9", "#FF91AF"],
  slides: [
    { v: { t: "pair", a: { h: "#D62F2F", label: "red corner" }, b: { h: "#2563C9", label: "blue corner" } },
      text: "At the 2004 Olympics, boxers, wrestlers and taekwondo fighters were randomly assigned [[Red|red]] or [[Blue|blue]]. Two researchers at Durham counted who won." },
    { v: { t: "quiz", q: "How often did the fighters in red win?",
        options: [{ label: "About half: no difference" }, { label: "55% of bouts" }, { label: "75% of bouts" }], answer: 1,
        explain: "55%, published in Nature in 2005. In closely matched bouts it rose to about 60%. A real edge, but a small one, and it only mattered when fighters were evenly matched." } },
    { v: { t: "type", word: "referees", sub: "seeing red" },
      text: "Part of it may be the judges. In a 2008 study, taekwondo referees watched bouts with the colors digitally swapped. The fighter in red scored more points, though the fighting was identical." },
    { v: { t: "swatch", h: "#FF91AF", label: "Baker-Miller pink" },
      text: "Then there's pink. In 1979 a researcher claimed this bubble-gum [[Pink|pink]] calmed aggressive inmates in a US Navy jail in Seattle. It became famous, and other jails painted cells to match." },
    { v: { t: "big", n: "59", sub: "prisoners, pink or white cells" },
      text: "A careful test in Switzerland put 59 prisoners into pink or plain white cells at random. Aggression fell over three days in both, with no difference by color. The calming pink didn't hold up. [[color-psychology|Color psychology, myths and evidence]]" },
    { v: { t: "row", items: [{ h: "#D62F2F" }, { h: "#FF91AF" }, { h: "#2563C9" }] },
      text: "The pattern: [[color-psychology|color can nudge us a little]], in some settings, and the stories grow faster than the evidence. When someone says a color 'makes' you do something, ask for the study." }
  ],
  colors: ["Red", "Blue", "Pink"],
  links: ["color-psychology"],
  sources: [
    "Hill & Barton 2005, Red enhances human performance in contests, Nature 435",
    "Hagemann, Strauss & Leißing 2008, When the referee sees red, Psychological Science 19",
    "Genschow, Noll, Wänke & Gersbach 2015, Does Baker-Miller pink reduce aggression in prison detention cells? A critical empirical examination, Psychology, Crime & Law 21",
    "Wikipedia, Baker–Miller Pink; Color psychology (55% and 60% figures)"
  ]
},
// ---------------------------------------------------------------- culture
{
  id: "white-for-mourning", shelf: "culture",
  title: "When mourning wore white",
  dek: "Black for grief feels natural. For French queens, and in China, the color was white.",
  cover: ["#F7F6F2", "#16171A", "#C8A2C8"],
  slides: [
    { v: { t: "swatch", h: "#F7F6F2", label: "white" },
      text: "Picture a funeral and you probably see black. But for medieval European queens, the color of deepest mourning was white. [[mourning-colors|Colors of mourning]]" },
    { v: { t: "type", word: "deuil blanc", sub: "French: white mourning" },
      text: "The French called it deuil blanc, white mourning. A widowed queen dressed in [[White|white]], not black." },
    { v: { t: "big", n: "1934", sub: "Dutch royals mourn in white" },
      text: "It never quite died out. When Queen Wilhelmina's husband died in 1934, the Dutch court mourned in white, as he had asked. Dutch royals wore white again at later royal funerals, though not at every one." },
    { v: { t: "pair", a: { h: "#F7F6F2", label: "white" }, b: { h: "#16171A", label: "black" } },
      text: "In China, white has long been the color of death and mourning. [[Black]] mourning in Europe goes back to Rome, where mourners wore the toga pulla, a toga of dark wool." },
    { v: { t: "big", n: "1861–1901", sub: "Queen Victoria in mourning" },
      text: "Queen Victoria wore widow's mourning from Prince Albert's death in 1861 until her own in 1901. Her era turned grief into a [[mourning-colors|strict system]], with rules for every stage." },
    { v: { t: "quiz", q: "After the deepest stage, Victorian widows moved into 'half mourning'. Which colors were allowed?",
        options: [{ label: "Lilac, grey and lavender", h: "#C8A2C8" }, { label: "Navy and burgundy", h: "#1C2B5A" }, { label: "Anything but red", h: "#D62F2F" }], answer: 0,
        explain: "Soft [[Lilac|lilac]], grey and [[Lavender|lavender]]: muted colors that signalled grief was easing. A pale purple dress could tell the street where you were in your year." } },
    { v: { t: "row", items: [{ h: "#16171A", label: "full" }, { h: "#8C9096", label: "half" }, { h: "#C8A2C8", label: "half" }, { h: "#F7F6F2", label: "white" }] },
      text: "The color of grief isn't written in nature. It's a habit, learned like a word, and it changes from place to place and century to century." }
  ],
  colors: ["White", "Black", "Lilac", "Lavender", "Grey"],
  links: ["mourning-colors"],
  sources: [
    "Wikipedia, Mourning (white as deepest mourning for medieval queens; Wilhelmina 1934; toga pulla; Victorian half mourning in lilac, grey and lavender; white in China)",
    "Ashmolean Museum, The colour revolution in Victorian fashion (Victoria's widow's weeds, 1861 to 1901)",
    "Irish Times, 'Dutch mourn Queen Juliana at funeral' (2004): royals in white"
  ]
},
{
  id: "pink-and-blue", shelf: "culture",
  title: "Was pink ever for boys?",
  dek: "A famous 1918 quote says pink was for boys. The real story is messier, and better.",
  cover: ["#F4C2C2", "#B0E0E6", "#F28DB2", "#87CEEB"],
  slides: [
    { v: { t: "pair", a: { h: "#F4C2C2", label: "for boys?" }, b: { h: "#B0E0E6", label: "for girls?" } },
      text: "You've probably heard it: a hundred years ago, pink was for boys and blue was for girls. There's a real quote behind it. [[pink-and-blue|Pink for girls, blue for boys]]" },
    { v: { t: "big", n: "1918", sub: "a trade magazine: pink for boys" },
      text: "In June 1918 a trade magazine for baby-clothes sellers said the accepted rule was [[Pink|pink]] for boys, as the stronger color, and blue for girls, as the daintier one." },
    { v: { t: "quiz", q: "In 1927, Time magazine checked which color big US department stores recommended for boys. What did they say?",
        options: [{ label: "All said blue" }, { label: "All said pink" }, { label: "They disagreed" }], answer: 2,
        explain: "They disagreed: six stores said pink for boys, four said blue. There simply wasn't a settled rule yet." } },
    { v: { t: "row", items: [{ h: "#F4C2C2", label: "1823" }, { h: "#F28DB2", label: "1834" }, { h: "#F4C2C2", label: "1862" }] },
      text: "But pink for girls is old too. Old sources tie it to girls in the Netherlands in 1823, France in 1834 and England in 1862. Different places had different habits, or none." },
    { v: { t: "big", n: "1950s", sub: "when the code took over in the US" },
      text: "Historian Jo Paoletti found [[pink-and-blue|pink-and-blue coding]] known by the late 1860s, but not dominant in most of the US until the 1950s, and universal only a generation later." },
    { v: { t: "type", word: "urban legend?", sub: "the great pink flip" },
      text: "So did the colors ever flip? Psychologist Marco Del Giudice went looking and found no evidence of reversed or mixed-up usage before the 1940s. He called the flip a 'scientific urban legend'." },
    { v: { t: "pair", a: { h: "#F4C2C2", label: "baby pink" }, b: { h: "#B0E0E6", label: "powder blue" } },
      text: "The honest version: for a long time there was no firm rule, a few voices said pink for boys, and the modern code hardened in the mid-1900s. [[Baby pink|Baby pink]] and [[Powder blue|powder blue]] are fashion, not nature." }
  ],
  colors: ["Baby pink", "Powder blue", "Pink", "Sky blue"],
  links: ["pink-and-blue"],
  sources: [
    "Earnshaw's Infants' Department, June 1918 (quoted in Wikipedia, Pink)",
    "Time magazine 1927 department-store chart (via Wikipedia, Gendered associations of pink and blue)",
    "Jo B. Paoletti 2012, Pink and Blue: Telling the Boys from the Girls in America, Indiana University Press",
    "Del Giudice 2012, The twentieth century reversal of pink-blue gender coding: a scientific urban legend?, Archives of Sexual Behavior 41"
  ]
},
{
  id: "berlin-blue", shelf: "culture",
  title: "The Berlin blue in the Great Wave",
  dek: "A botched batch of red in a Berlin lab gave Hokusai the blue of the world's most famous wave.",
  cover: ["#003153", "#1C2B5A", "#F0E6D2"],
  slides: [
    { v: { t: "swatch", h: "#003153", label: "Prussian blue" },
      text: "Around 1706, a Berlin color maker named Diesbach mixed a batch of paint and got a deep, inky blue. It wasn't what he was trying to make. [[prussian-blue|Prussian blue]]" },
    { v: { t: "quiz", q: "What was Diesbach trying to make when the blue appeared?",
        options: [{ label: "A red", h: "#C41E3A" }, { label: "A gold", h: "#FFD700" }, { label: "A medicine" }], answer: 0,
        explain: "A red, from [[cochineal|cochineal]] insects. His potash was tainted with animal blood, and with iron it made a blue instead. One of the luckiest mistakes in color history." } },
    { v: { t: "big", n: "1710", sub: "the new blue goes public" },
      text: "It was the first modern synthetic [[prussian-blue|pigment]]: strong, cheap and lightfast. It appeared in print by 1710 and spread across Europe's studios." },
    { v: { t: "type", word: "bero-ai", sub: "Japanese: 'Berlin indigo'" },
      text: "By about 1829 it was reaching Japan cheaply, through Chinese and Dutch traders. Printmakers called it bero, after Berlin. Unlike the plant blues they had been using, it didn't fade." },
    { v: { t: "swatch", h: "#1F4E79", label: "the wave's blue" },
      text: "Hokusai went all in. The Great Wave, from around 1831, was among the first Japanese prints to feature Prussian blue. [[painting-great-wave|The Great Wave off Kanagawa]]" },
    { v: { t: "big", n: "8,000", sub: "impressions, by one estimate" },
      text: "Woodblocks made it cheap to multiply: perhaps 8,000 impressions in all. About 111 original impressions are known to survive today." },
    { v: { t: "row", items: [{ h: "#003153", label: "Prussian" }, { h: "#1C2B5A", label: "navy" }, { h: "#191970", label: "midnight" }] },
      text: "It has a second life as a medicine: it binds radioactive caesium in the gut, and doctors used it after Brazil's 1987 Goiânia radiation accident. Compare it with [[Navy|navy]] and [[Midnight blue|midnight blue]]." }
  ],
  colors: ["Navy", "Midnight blue"],
  links: ["prussian-blue", "painting-great-wave"],
  sources: [
    "Wikipedia, Prussian blue (Diesbach c. 1706, first published 1710; antidote use after the Goiânia accident)",
    "Wikipedia, The Great Wave off Kanagawa (first prints with Prussian blue)",
    "Korenberg, C., 'The Great Wave: the making of an icon' (British Museum, 2020): up to 8,000 impressions, 111 located",
    "Scholten Japanese Art, 'Blue printed pictures (aizuri-e)': Prussian blue cheap and plentiful from c. 1829"
  ]
},
// ---------------------------------------------------------------- harmony
{
  id: "van-gogh-opposites", shelf: "harmony",
  title: "Van Gogh's opposites",
  dek: "Van Gogh borrowed a chemist's law of color and pushed it until his canvases hummed.",
  cover: ["#F2C81F", "#1F3A93", "#D62F2F", "#2E9A4F"],
  slides: [
    { v: { t: "wheel", base: "#F2C81F", scheme: "complementary" },
      text: "Colors facing each other on the painter's wheel are complements: red and green, blue and orange, yellow and violet. Side by side, each makes the other look stronger. [[complementary-colors|Complementary colors]]" },
    { v: { t: "quote", q: "the terrible passions of humanity by means of red and green", by: "Vincent van Gogh, 1888" },
      text: "In 1888 [[van-gogh|Van Gogh]] painted an all-night café in Arles: blood-red walls, a green billiard table, yellow lamps. He wrote to his brother Theo that he wanted the clash of red and green to carry the feeling." },
    { v: { t: "pair", a: { h: "#D62F2F", label: "red" }, b: { h: "#2E9A4F", label: "green" } },
      text: "Complements at equal brightness, side by side, both look more intense. Van Gogh copied out a critic's line that they lift each other to an intensity the eye can scarcely bear. Mixed as paint, they cancel toward [[Grey|grey]]." },
    { v: { t: "pair", a: { h: "#2A4BA0", label: "blue" }, b: { h: "#F08A24", label: "orange" } },
      text: "The idea goes back to the chemist [[chevreul|Chevreul]], and Van Gogh named it in a letter: 'the law of simultaneous contrast'. Opposites, placed together, heighten each other. [[simultaneous-contrast|Simultaneous contrast]]" },
    { v: { t: "pair", a: { h: "#1F3A93", label: "night blue" }, b: { h: "#F2C81F", label: "star yellow" } },
      text: "[[painting-starry-night|The Starry Night]], painted in June 1889 from the view out of his window at the asylum in Saint-Rémy, sets swirling blues against yellow stars and moon: another pair of near-opposites." },
    { v: { t: "row", items: [{ h: "#F2C81F" }, { h: "#EAA221" }, { h: "#CFA41C" }, { h: "#FFD700" }, { h: "#CC7722" }] },
      text: "[[painting-sunflowers|Sunflowers]] went the other way: a study in yellows, made possible partly by new pigments like [[chrome-yellow|chrome yellow]]. Harmony by sameness instead of opposition." },
    { v: { t: "wheel", base: "#F2C81F", scheme: "analogous" },
      text: "Two ways to build a palette: opposites for punch, neighbors for calm. Painters often combine them, a family of neighbors with one small accent from the far side. [[color-harmony|Color harmony]]" }
  ],
  colors: ["Red", "Green", "Yellow", "Marigold", "Mustard", "Gold", "Ochre"],
  links: ["van-gogh", "complementary-colors", "painting-starry-night", "painting-sunflowers", "chevreul"],
  sources: [
    "Van Gogh, letter to Theo on The Night Café, September 1888 (via Wikipedia, The Night Café)",
    "Wikipedia, Michel Eugène Chevreul (Van Gogh quoting 'the law of simultaneous contrast')",
    "Wikipedia, The Starry Night (June 1889, Saint-Rémy); Sunflowers (Van Gogh series) (new pigments)"
  ]
},
{
  id: "chevreul-black", shelf: "harmony",
  title: "The black dye that wasn't broken",
  dek: "Tapestry weavers said their black dye was weak. A chemist found the fault was in their eyes.",
  cover: ["#16171A", "#1E3A9E", "#5B2C83"],
  slides: [
    { v: { t: "swatch", h: "#16171A", label: "the 'weak' black" },
      text: "The Gobelins tapestry works in Paris had a complaint: some dyes looked weak, the black especially. The chemist [[chevreul|Michel Eugène Chevreul]], who ran the dye works there, was asked to fix them." },
    { v: { t: "quiz", q: "Chevreul tested the black dye. What did he find?",
        options: [{ label: "It had faded and needed fixing" }, { label: "It was first-rate" }, { label: "It was secretly dark blue" }], answer: 1,
        explain: "The black was first-rate. It only looked weak and reddish where it was woven beside deep blues and [[Purple|purples]]. The problem wasn't the dye. It was the neighbors." } },
    { v: { t: "contrast", inner: "#6B6B6B", grounds: ["#1E3A9E", "#E8902A"] },
      text: "Every color nudges its neighbor toward its own opposite. Beside blue, a grey leans warm; beside orange, it leans cool. Tap to see the two are identical. [[simultaneous-contrast|Simultaneous contrast]]" },
    { v: { t: "big", n: "1839", sub: "the law of simultaneous contrast" },
      text: "Chevreul published it in 1839 as a book-length [[simultaneous-contrast|law of color contrast]], with advice for tapestries, gardens, maps, stained glass, clothing and even military uniforms." },
    { v: { t: "row", items: [{ h: "#E8902A" }, { h: "#1E3A9E" }, { h: "#E8902A" }, { h: "#1E3A9E" }, { h: "#E8902A" }] },
      text: "Painters read it closely. It gave the [[impressionism|Impressionists]] and Seurat a scientific reason to set pure colors side by side instead of mixing them. [[painting-grande-jatte|A Sunday on La Grande Jatte]]" },
    { v: { t: "big", n: "102", sub: "Chevreul's age at death" },
      text: "He lived to 102, studied aging in his final years, and is one of 72 scientists and engineers whose names are engraved on the Eiffel Tower. [[optical-mixing|Optical mixing]]" }
  ],
  colors: ["Black", "Grey", "Blue", "Orange"],
  links: ["chevreul", "simultaneous-contrast", "optical-mixing", "impressionism"],
  sources: [
    "Chevreul 1839, De la loi du contraste simultané des couleurs (English 1854, The Principles of Harmony and Contrast of Colours)",
    "Wikipedia, Michel Eugène Chevreul (the Gobelins black dye; influence on Impressionism and Seurat; lived to 102; Eiffel Tower)"
  ]
},
{
  id: "blue-shadows", shelf: "harmony",
  title: "Why Monet's shadows are blue",
  dek: "Old masters painted shadows brown. The Impressionists went outside, looked again and saw blue.",
  cover: ["#F2C81F", "#7A8CC8", "#F7F6F2"],
  slides: [
    { v: { t: "pair", a: { h: "#5C4632", label: "a studio shadow" }, b: { h: "#7A8CC8", label: "a shadow on snow" } },
      text: "For centuries, painters darkened a shadow with [[Brown|brown]] or [[Black|black]]. Then a group of painters took their easels outdoors and noticed something odd: in sunlight, shadows are often blue." },
    { v: { t: "swatch", h: "#87CEEB", label: "the sky fills the shade" },
      text: "Why? Direct sun is blocked from a shadow, but the whole [[Sky blue|blue sky]] still shines into it. So shadows on snow really are bluish, and sunlit snow looks warm beside them." },
    { v: { t: "contrast", inner: "#9A9DA6", grounds: ["#F2B33D", "#4A5A9A"] },
      text: "Your eye adds to it. A neutral grey surrounded by warm sunlight looks cooler and bluer than it really is. Tap to compare the two greys. [[simultaneous-contrast|Simultaneous contrast]]" },
    { v: { t: "row", items: [{ h: "#7A8CC8", label: "shadow" }, { h: "#9C7FB8", label: "violet" }, { h: "#F2C81F", label: "sun" }, { h: "#F7F6F2", label: "snow" }] },
      text: "The [[impressionism|Impressionists]] made it a habit: no black paint, shadows painted with the blue of the sky, darks mixed from complementary colors. Blue shadows on snow helped inspire the whole approach." },
    { v: { t: "swatch", h: "#A7B9CB", label: "the white dress, sampled" },
      text: "Look at the white dress in [[monet|Monet]]'s [[painting-woman-parasol|Woman with a Parasol]] (1875). Sample its pixels and it's mostly pale blues and greys, not white, and nowhere brown. He painted the light he saw." },
    { v: { t: "type", word: "colored shadows", sub: "Goethe saw them too" },
      text: "They weren't the first to notice. [[goethe|Goethe]]'s [[theory-of-colours|Theory of Colours]] (1810) already described colored shadows in detail, decades before the Impressionists." },
    { v: { t: "swatch", h: "#8A97C9", label: "look again" },
      text: "Try it on the next sunny day: find a shadow on a white wall. Is it grey? Keep looking. [[warm-and-cool|Warm and cool colors]]" }
  ],
  colors: ["White", "Grey", "Violet", "Yellow"],
  links: ["impressionism", "monet", "painting-woman-parasol", "warm-and-cool", "simultaneous-contrast"],
  sources: [
    "Wikipedia, Impressionism (shadows painted with the blue of the sky; blue shadows on snow; avoidance of black; darks from complements)",
    "Wikipedia, Theory of Colours (descriptions of coloured shadows)",
    "National Gallery of Art, Washington, Claude Monet, Woman with a Parasol – Madame Monet and Her Son (1875)"
  ]
},
{
  id: "triangle-is-yellow", shelf: "harmony",
  title: "Is a triangle yellow?",
  dek: "Kandinsky was sure every shape had its own color. Decades later, people were asked, and disagreed.",
  cover: ["#F2C81F", "#D62F2F", "#2563C9"],
  slides: [
    { v: { t: "quiz", q: "Kandinsky matched yellow, red and blue to a triangle, a square and a circle. Which color did he give the triangle?",
        options: [{ label: "Yellow", h: "#F2C81F" }, { label: "Red", h: "#D62F2F" }, { label: "Blue", h: "#2563C9" }], answer: 0,
        explain: "Yellow. Yellow triangle, red square, blue circle: sharp, solid and calm. [[kandinsky|Kandinsky]] thought these pairings were fundamental, built into how we see." } },
    { v: { t: "row", items: [{ h: "#F2C81F", label: "triangle" }, { h: "#D62F2F", label: "square" }, { h: "#2563C9", label: "circle" }] },
      text: "He turned it into a questionnaire at the [[bauhaus|Bauhaus]], the German art and design school that ran from 1919 to 1933. Kandinsky taught there from 1922 until it closed." },
    { v: { t: "wheel", base: "#D62F2F", scheme: "triadic" },
      text: "Red, yellow and blue sit about a third of the way around the painter's wheel from one another. That's a triad: three colors spaced evenly, bold and balanced. [[color-harmony|Color harmony]]" },
    { v: { t: "big", n: "200", sub: "students, 2002" },
      text: "In 2002 the psychologist Thomas Jacobsen gave a version of [[kandinsky|Kandinsky]]'s questionnaire to 200 university students. They had to match the three colors to the three shapes." },
    { v: { t: "row", items: [{ h: "#D62F2F", label: "triangle" }, { h: "#2563C9", label: "square" }, { h: "#F2C81F", label: "circle" }] },
      text: "About half chose a [[Red|red]] triangle, a blue square and a yellow circle, and explained them as a warning sign and the sun. Kandinsky's own answer was the least popular of all." },
    { v: { t: "type", word: "no link", sub: "Liverpool, 2013" },
      text: "A 2013 study looked for hidden, automatic links between Kandinsky's pairs and found none worth the name. A 2015 study found Japanese volunteers had their own steady set: red circle, blue square, yellow triangle." },
    { v: { t: "row", items: [{ h: "#F2C81F" }, { h: "#D62F2F" }, { h: "#2563C9" }] },
      text: "Color and shape links seem to come from the world we've seen, like warning signs and the sun, more than from the shapes themselves. [[spiritual-in-art|Kandinsky's rule]] was poetry, not law." }
  ],
  colors: ["Yellow", "Red", "Blue"],
  links: ["kandinsky", "bauhaus", "color-harmony", "spiritual-in-art"],
  sources: [
    "Jacobsen 2002, Kandinsky's questionnaire revisited: fundamental correspondence of basic colors and forms?, Perceptual and Motor Skills 95",
    "Makin & Wuerger 2013, The IAT shows no evidence for Kandinsky's color-shape associations, Frontiers in Psychology 4",
    "Chen, Tanaka & Watanabe 2015, Color-shape associations revealed with implicit association tests, PLoS ONE 10",
    "Wikipedia, Bauhaus (1919–1933); Wassily Kandinsky (taught at the Bauhaus 1922–1933)"
  ]
},
// ---------------------------------------------------------------- design
{
  id: "klein-blue", shelf: "design",
  title: "The blue Yves Klein made his own",
  dek: "One artist mixed a blue so intense he put his name on it. He never patented it.",
  cover: ["#002FA7", "#16171A", "#1C2B5A"],
  slides: [
    { v: { t: "swatch", h: "#002FA7", label: "IKB, screen approx." },
      text: "This is as close as a screen gets to International Klein Blue. In person it's deeper still, with a dry, matte surface that seems to hover off the canvas. [[yves-klein|Yves Klein]]" },
    { v: { t: "quiz", q: "In 1957 Klein hung 11 identical blue paintings in a Milan gallery. How were they priced?",
        options: [{ label: "All the same" }, { label: "All differently" }, { label: "Free, to the right buyer" }], answer: 1,
        explain: "All differently. Klein's idea was that each buyer would see something in their canvas that others missed. Same blue, different price." } },
    { v: { t: "type", word: "Rhodopas", sub: "the binder behind the blue" },
      text: "The secret was the binder. Mixed into linseed oil, ultramarine powder goes dull. With the Paris paint seller Édouard Adam, Klein found a synthetic resin that kept its brilliance. [[ultramarine-pigment|Ultramarine]]" },
    { v: { t: "big", n: "1960", sub: "Klein registers the formula" },
      text: "In May 1960 he registered the formula in a sealed French 'Soleau envelope', which records the date of an invention. He never patented it, and Adam's shop still sells the binder." },
    { v: { t: "swatch", h: "#0A2E9C", label: "blue bodies" },
      text: "He went all in: blue sponge reliefs, blue sculptures, and performances where models covered in the paint pressed their bodies onto canvas while he directed from a distance." },
    { v: { t: "type", word: "the void", sub: "sold for gold" },
      text: "He even sold empty space for gold, then threw half the gold into the Seine. Klein died in 1962, aged 34. The blue outlived him." },
    { v: { t: "row", items: [{ h: "#002FA7", label: "IKB" }, { h: "#3D2B8E", label: "indigo" }, { h: "#0047AB", label: "cobalt" }] },
      text: "Its nearest names in this app are [[Indigo|indigo]] and [[Cobalt|cobalt]]. Its ancestor is the ultramarine once ground from Afghan lapis lazuli, the blue that cost as much as gold." }
  ],
  colors: ["Indigo", "Cobalt", "Navy"],
  links: ["yves-klein", "ultramarine-pigment"],
  sources: [
    "Wikipedia, International Klein Blue (Édouard Adam, Rhodopas binder, Soleau envelope May 1960, never patented)",
    "Wikipedia, Yves Klein (Milan, January 1957: 11 identical canvases priced differently; Zones of Immaterial Pictorial Sensibility; 1928–1962)"
  ]
},
{
  id: "own-a-color", shelf: "design",
  title: "Can you own a color?",
  dek: "Tiffany owns a blue and Owens Corning a pink. Cadbury fought for purple. Here's how it works.",
  cover: ["#81D8D0", "#F3A6C3", "#4F2683"],
  slides: [
    { v: { t: "swatch", h: "#81D8D0", label: "Tiffany blue, approx." },
      text: "This blue belongs to a jeweler. Tiffany & Co. put it on the cover of its catalogue, the Blue Book, in 1845, and has held it as a registered trademark since 1998. [[color-trademarks|Owning a color]]" },
    { v: { t: "big", n: "1837", sub: "Tiffany blue's Pantone number" },
      text: "Pantone mixes it as a private custom color, number 1837: the year Tiffany was founded. You won't find it in the public swatch books. [[Turquoise|Turquoise]] is its nearest everyday name." },
    { v: { t: "quiz", q: "Which company won a landmark 1985 US court ruling to register a color as its trademark?",
        options: [{ label: "Owens Corning, pink insulation", h: "#F3A6C3" }, { label: "Coca-Cola, red", h: "#E41E2B" }, { label: "UPS, brown", h: "#5C3A21" }], answer: 0,
        explain: "Owens Corning, for its [[Pink|pink]] building insulation. In 1985 a US appeals court agreed that, on insulation, pink had come to mean them." } },
    { v: { t: "big", n: "1995", sub: "US Supreme Court: yes, a color" },
      text: "In 1995 the US Supreme Court confirmed it, in Qualitex v. Jacobson, a case about green-gold pads for dry-cleaning presses. The catch: buyers must already link the color to you." },
    { v: { t: "swatch", h: "#4F2683", label: "Dairy Milk purple, approx." },
      text: "Cadbury has wrapped Dairy Milk in [[Purple|purple]] since 1914. But when it tried to register purple as the 'predominant' color of its packaging, Nestlé objected, and the UK Court of Appeal found it too vague." },
    { v: { t: "row", items: [{ h: "#81D8D0", label: "a box" }, { h: "#F3A6C3", label: "insulation" }, { h: "#4F2683", label: "chocolate" }] },
      text: "The rule of thumb: you can't own a color, [[color-trademarks|only a color in a context]], like pink on insulation or blue on a jewelry box, and only once customers have learned it means you." }
  ],
  colors: ["Turquoise", "Pink", "Purple"],
  links: ["color-trademarks"],
  sources: [
    "Wikipedia, Tiffany Blue (Blue Book 1845; trademark since 1998; Pantone 1837)",
    "Wikipedia, Color trademark (Owens Corning 1985; Qualitex Co. v. Jacobson Products Co., 1995; Société des Produits Nestlé v Cadbury UK)",
    "Société des Produits Nestlé v Cadbury UK [2012] EWHC 2637 (Ch) (purple used since 1914) and [2013] EWCA Civ 1174 (4 October 2013)"
  ]
},
{
  id: "why-facebook-blue", shelf: "design",
  title: "Why Facebook is blue",
  dek: "Not market research: its founder is red-green color-blind. What that teaches every designer.",
  cover: ["#3B5998", "#8D7E28", "#F7F6F2"],
  slides: [
    { v: { t: "swatch", h: "#3B5998", label: "Facebook blue, 2000s" },
      text: "Why is Facebook blue? In 2010 Mark Zuckerberg told The New Yorker that he is red-green color-blind, and that blue is the color he sees best. So the site went blue, close to what this app calls [[Denim|denim]]." },
    { v: { t: "type", word: "all of blue", sub: "Zuckerberg, 2010" },
      text: "He'd found out from an online test a few years earlier. Blue, he said, is the richest color for him: he can see all of it. [[color-blindness|Color blindness]]" },
    { v: { t: "pair", a: { h: "#8D7E28", label: "red, simulated" }, b: { h: "#8E8354", label: "green, simulated" } },
      text: "Here's a rough simulation of [[Red|red]] and [[Green|green]] for deuteranopia, the most common type. Both slide toward the same muddy olive. That's the red–green confusion." },
    { v: { t: "pair", a: { h: "#2563C9", label: "blue" }, b: { h: "#0060C7", label: "blue, simulated" } },
      text: "[[Blue]] barely changes. If you want a color that almost everyone sees much the same way, blue is a safe bet." },
    { v: { t: "type", word: "never color alone", sub: "the accessibility rule" },
      text: "Web accessibility guidelines make it a rule: never let color be the only way to show information. Pair red and green with a label, an icon, or a clear light-dark difference. [[value|Value: light and dark]]" },
    { v: { t: "strip", from: "#3B5998", to: "#F7F6F2", steps: 5 },
      text: "A quick test for any design: view it in greyscale. If it still works, it works for nearly everyone. [[trichromacy|How eyes see color]]" }
  ],
  colors: ["Red", "Green", "Blue", "Denim"],
  links: ["color-blindness", "trichromacy", "value"],
  sources: [
    "Jose Antonio Vargas, The Face of Facebook, The New Yorker, 20 September 2010",
    "Machado, Oliveira & Fernandes 2009, A physiologically-based model for simulation of color vision deficiency, IEEE TVCG 15 (simulation used for the swatches)",
    "W3C, Web Content Accessibility Guidelines 2, Success Criterion 1.4.1 Use of Color"
  ]
},
// ---------------------------------------------------------------- poetry
{
  id: "vowels-have-colors", shelf: "poetry",
  title: "When vowels have colors",
  dek: "A teenage poet gave every vowel a color. Some people really do see letters that way.",
  cover: ["#16171A", "#F7F6F2", "#D62F2F", "#2E9A4F", "#2563C9"],
  slides: [
    { v: { t: "row", items: [{ h: "#16171A", label: "A" }, { h: "#F7F6F2", label: "E" }, { h: "#D62F2F", label: "I" }, { h: "#2E9A4F", label: "U" }, { h: "#2563C9", label: "O" }] },
      text: "A black, E white, I red, U green, O blue. That's how a sonnet by [[rimbaud|Arthur Rimbaud]] begins. He wrote it by September 1871, before his 17th birthday. [[voyelles|Voyelles]]" },
    { v: { t: "quote", q: "A noir, E blanc, I rouge, U vert, O bleu : voyelles", by: "Arthur Rimbaud, Voyelles" },
      text: "Then each vowel gets its images: black buzzing flies, white mists and glaciers, red spat blood and laughing lips, green rippling seas, and for O a trumpet, silences and a [[Violet|violet]] ray." },
    { v: { t: "type", word: "why?", sub: "nobody knows" },
      text: "Why these colors? Nobody knows. Theories run from colored alphabet blocks he played with as a child to occult reading to pure invention. Few French poems have been argued over more." },
    { v: { t: "type", word: "synesthesia", sub: "senses that cross" },
      text: "For some people, letters really do arrive with colors attached: automatically, and the same every time, for life. It's called grapheme-color [[synesthesia|synesthesia]]." },
    { v: { t: "big", n: "1.2%", sub: "have grapheme-color synesthesia" },
      text: "How common is it? A 2015 study of 2,847 people found [[synesthesia|grapheme-color synesthesia]] in about 1.2% of them, in line with earlier estimates. Roughly one person in eighty." },
    { v: { t: "type", word: "toy letters", sub: "colors learned in childhood" },
      text: "Here's the twist. In 2013, researchers found 11 synesthetes whose letter colors matched startlingly well, traced to childhood toys with colored letters. An earlier case traced to a set of fridge magnets." },
    { v: { t: "row", items: [{ h: "#16171A", label: "A" }, { h: "#F7F6F2", label: "E" }, { h: "#D62F2F", label: "I" }, { h: "#2E9A4F", label: "U" }, { h: "#2563C9", label: "O" }] },
      text: "So the alphabet-block theory about [[rimbaud|Rimbaud]] isn't silly. Toys can paint letters for life. Whether his colors were seen, remembered or invented, the poem made millions see them." }
  ],
  colors: ["Black", "White", "Red", "Green", "Blue"],
  links: ["rimbaud", "voyelles", "synesthesia"],
  sources: [
    "Arthur Rimbaud, Voyelles (written by September 1871; first published by Verlaine in Lutèce, 1883)",
    "Wikipedia, Voyelles (theories: childhood alphabet blocks, esoteric reading)",
    "Carmichael, Down, Shillcock, Eagleman & Simner 2015, Validating a standardised test battery for synesthesia, Consciousness and Cognition 33 (1.2% of 2,847)",
    "Witthoft & Winawer 2013, Learning, memory, and synesthesia, Psychological Science 24 (11 synesthetes, childhood colored letters)"
  ]
},
{
  id: "wine-dark-sea", shelf: "poetry",
  title: "Homer's wine-dark sea",
  dek: "Homer never calls the sea blue. A future prime minister wondered if the Greeks could see it.",
  cover: ["#3A2340", "#1C2B5A", "#5B2C4A"],
  slides: [
    { v: { t: "swatch", h: "#3A2340", label: "wine-dark?" },
      text: "In [[homer|Homer]] the sea is oinops pontos: the 'wine-faced', or wine-dark, sea. Not blue. Never blue." },
    { v: { t: "big", n: "17", sub: "wine-dark seas in Homer" },
      text: "The phrase turns up 5 times in the Iliad and 12 in the Odyssey, often for rough, stormy water. The only other wine-dark things in [[homer|Homer]] are oxen." },
    { v: { t: "quiz", q: "Later Greek used kyanos for blue. What does Homer use kyanos to describe?",
        options: [{ label: "Zeus's eyebrows" }, { label: "The sky" }, { label: "The sea" }], answer: 0,
        explain: "Zeus's eyebrows. In Homer kyanos almost certainly meant just 'dark'. Only later did it become a blue, and it lives on in our word cyan, the screen color of [[Aqua|aqua]]." } },
    { v: { t: "type", word: "Gladstone", sub: "Studies on Homer, 1858" },
      text: "In 1858 William Gladstone, later Britain's prime minister, noticed the missing [[Blue|blue]]. He argued Homer's color words track light and dark more than hue. Many readers took him to mean the Greeks were half color-blind." },
    { v: { t: "row", items: [{ h: "#16171A" }, { h: "#F7F6F2" }, { h: "#D62F2F" }, { h: "#F2C81F" }, { h: "#2E9A4F" }, { h: "#2563C9" }] },
      text: "In the 1860s Lazarus Geiger found blue missing from many ancient texts and proposed that color words arrive in order, with blue last, a century before [[berlin-and-kay|Berlin and Kay]]." },
    { v: { t: "swatch", h: "#1034A6", label: "the Greeks saw this" },
      text: "But the Greeks saw blue perfectly well, and painted with it: Theophrastus wrote about kyanos, a blue pigment with an Egyptian kind. Homer lacked a basic word for blue, not the sight. [[egyptian-blue|Egyptian blue]]" },
    { v: { t: "pair", a: { h: "#3A2340", label: "wine" }, b: { h: "#1C2B5A", label: "deep sea" } },
      text: "So what did wine-dark mean? Scholars still argue: the sea's darkness, its glinting sheen, its restless movement. Homer may have been painting a feeling, not a hue." }
  ],
  colors: ["Blue", "Navy"],
  links: ["homer", "basic-color-terms", "berlin-and-kay", "egyptian-blue"],
  sources: [
    "Wikipedia, Wine-dark sea (Homer) (5 times in the Iliad, 12 in the Odyssey; oxen; kyanos and Zeus's eyebrows; Gladstone 1858; Geiger)",
    "W. E. Gladstone 1858, Studies on Homer and the Homeric Age, Oxford University Press",
    "Wikipedia, Egyptian blue (Theophrastus, De Lapidibus, on kyanos)"
  ]
},
{
  id: "greener-than-grass", shelf: "poetry",
  title: "Why jealousy is green",
  dek: "Shakespeare made jealousy a green-eyed monster. Sappho turned green with longing long before.",
  cover: ["#4CBB17", "#93C572", "#355E3B"],
  slides: [
    { v: { t: "quote", q: "It is the green-eyed monster which doth mock the meat it feeds on", by: "Shakespeare, Othello" },
      text: "Iago warns Othello against jealousy, and in one line hands English a phrase it still uses four centuries later." },
    { v: { t: "type", word: "green-eyed", sub: "Shakespeare, twice" },
      text: "He had used it before: in The Merchant of Venice, Portia speaks of 'green-eyed jealousy'. Since Shakespeare, [[Green|green]] has meant jealousy and envy in English. Hence 'green with envy'." },
    { v: { t: "quote", q: "I am greener than grass", by: "Sappho, fragment 31" },
      text: "More than two thousand years earlier, the Greek poet Sappho watched a man sit opposite the woman she loved and listed what it did to her body: fire under the skin, ringing ears, cold sweat, trembling." },
    { v: { t: "type", word: "chlōros", sub: "green, or pale?" },
      text: "Translators split over Sappho's word, chlōros. It covered the pale yellow-green of new shoots and the pallor of a frightened face, so some write 'greener than grass', others 'paler'." },
    { v: { t: "row", items: [{ h: "#C9E4A0", label: "new shoots" }, { h: "#ACCFB0", label: "pallid" }, { h: "#93C572", label: "green" }] },
      text: "That's a theme in this app: old color words cut the world differently. Chlōros is less a hue than a look, fresh or sickly or alive. Our nearest names: [[Pistachio|pistachio]], [[Celadon|celadon]]. [[linguistic-relativity|Do words change what we see?]]" },
    { v: { t: "swatch", h: "#4CBB17", label: "green with envy" },
      text: "Why green for jealousy, exactly? Nobody can trace it cleanly. What we can show is how long poets have tied fierce feeling to a green-pale face: from Sappho to Iago to 'green with envy'." }
  ],
  colors: ["Kelly green", "Pistachio", "Celadon", "Hunter green"],
  links: ["linguistic-relativity", "homer"],
  sources: [
    "Shakespeare, Othello, Act 3 Scene 3; The Merchant of Venice, Act 3 Scene 2",
    "Sappho, fragment 31 (χλωροτέρα δὲ ποίας ἔμμι), via Wikipedia, Sappho 31",
    "Wikipedia, Jealousy (green associated with jealousy and envy since Shakespeare's 'green-eyed monster')"
  ]
}

];
