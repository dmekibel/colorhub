// Fashion history pages (Explore → World → Fashion → History). 25 pages in titled sections, written for the wiki and
// merged here into the Fashion screens (js/world.js), loaded lazily. Ten of them replace the shorter versions of the same
// pages in data/fashion.js (same ids); fifteen are new. [[a|b]] links resolve through the color web; [[#history:id|label]]
// opens another page here. Facts come from the private book notes (two books agreeing) and web checks; every myth in
// CLAUDE.md is only stated to be corrected. Method and honesty notes: research/FASHION.md.
window.FASHION_HISTORY = [
 {
  "id": "purple-law",
  "title": "Purple and the law",
  "dek": "In Rome and Byzantium a dye, not a hue, was the crime. Wearing the wrong purple could cost your life.",
  "y": -50,
  "e": "e0",
  "g": "mideast",
  "lead": [
   "Rome and Byzantium turned [[tyrian-purple|shellfish purple]] into law. Bands of [[Purple|purple]] marked senators, a solid purple toga marked a triumph, and by the 4th century AD true purple belonged to the emperor alone (see [[royal-purple|royal purple]]).",
   "The laws named the dye, not the color, because ancient 'purple' ran from [[Crimson|crimson]] to near-[[Black|black]]. When the trade ended, Europe's grandest red became [[kermes|kermes]] scarlet, and purple survived as the color of [[Byzantium|Byzantium]] and of the church's [[liturgical-colors|penitential seasons]]."
  ],
  "sections": [
   {
    "title": "A color priced like gold",
    "text": [
     "Purple cloth came from the glands of Mediterranean murex snails. Each snail gave a drop of colorless fluid that turned yellow, green and blue before settling into purple in the sun, and it took thousands of snails to dye the trim of one garment. Ancient writers priced the best grades above gold, and Pliny describes the finest as the color of clotted blood: nearly black in reflected light, glowing red when held up to the sun.",
     "So 'purple' did not mean one hue. Greek porphyra and Latin purpura covered dark reds, crimsons and violets, and Roman lawyers defined it by what it was dyed with. That vagueness matters for everything that follows: the law could not police a shade, so it policed a substance."
    ]
   },
   {
    "title": "Rome: stripes, triumphs and treason",
    "text": [
     "In the Republic, purple was a sign of office rather than a monopoly. Senators wore a broad purple stripe on the tunic, knights a narrow one, and the toga praetexta of magistrates had a purple border. A general celebrating a triumph wore a toga dyed solid purple and worked with gold for a single day.",
     "Under the emperors the rules tightened. Julius Caesar is said to have limited full purple togas to himself, and later emperors went further. Suetonius tells of a young man in full purple arrested under Caligula; by the 4th century AD only the emperor could wear true shellfish purple, and making it outside the imperial dye works could be punished by death. 'Taking the purple' meant seizing the throne."
    ]
   },
   {
    "title": "Byzantium: born in the purple",
    "text": [
     "The eastern empire kept the system for another thousand years. Imperial children were porphyrogennetos, 'born in the purple', a name tied to a palace chamber lined with porphyry stone. The 6th-century mosaics of San Vitale in Ravenna show Justinian and Theodora in deep purple robes, the color set against gold to mark them as rulers chosen by God.",
     "Law codes from Theodosius to Justinian banned private purple dyeing and the sale of the best grades. They also show the rules leaking: repeated bans, a black market in purple cloth, and recipes for imitation purples made by overdyeing blue with red plant dyes."
    ]
   },
   {
    "title": "Fakes, cheaper purples and the end",
    "text": [
     "Most people never saw true Tyrian purple. Papyrus recipe books from Roman Egypt explain how to fake it with woad or indigo topped with madder or lichen dyes, and the result looked close enough at a glance. That is why the law cared about the snail: the fake was cheap, the original was a state asset.",
     "The trade faded with Byzantium itself. After the sack of Constantinople in 1204 imperial production declined, and by the time the city fell in 1453 the recipe was effectively lost. In 1464 Pope Paul II moved cardinals from purple to scarlet, a red made from the kermes insect, which Europe could still buy."
    ]
   },
   {
    "title": "What survives, and what doesn't",
    "text": [
     "Almost no ancient purple cloth survives in a state we can trust, so modern reconstructions vary from fuchsia pink to blackish violet. The chemistry is now known: the dye is dibromoindigo, a close cousin of [[indigo-dye|indigo]], which is why some snails give bluer tones than others.",
     "Purple's prestige outlived the snail. When the chemist [[william-perkin|William Perkin]] made [[mauveine|mauve]] from coal tar in 1856, he first sold it as 'Tyrian purple', borrowing two thousand years of imperial glamour for a dye anyone could buy."
    ]
   }
  ],
  "colors": [
   "Purple",
   "Byzantium",
   "Crimson",
   "Mulberry",
   "Gold"
  ],
  "swatches": [
   [
    "#5B1F3E",
    "Tyrian, dark"
   ],
   [
    "#7A2C55",
    "Imperial purple"
   ],
   [
    "#8E3B6E",
    "Bluer murex"
   ],
   [
    "#A33B4B",
    "Clotted-blood red"
   ],
   [
    "#C9A54A",
    "Gold ground"
   ]
  ],
  "facts": [
   [
    "Source",
    "Murex sea snails"
   ],
   [
    "Imperial monopoly",
    "By 4th c. AD"
   ],
   [
    "Recipe lost",
    "By 1453"
   ],
   [
    "Chemistry",
    "Dibromoindigo"
   ]
  ],
  "sources": [
   "Ball, P. (2001). Bright Earth: Art and the Invention of Color, ch. 17. Farrar, Straus and Giroux.",
   "Gage, J. (1993). Colour and Culture: Practice and Meaning from Antiquity to Abstraction, ch. 1–2. Thames & Hudson.",
   "Pastoureau, M. (2017). Red: The History of a Color. Princeton University Press.",
   "Finlay, V. (2002). Colour: Travels Through the Paintbox, ch. 'Purple'. Sceptre.",
   "Reinhold, M. (1970). History of Purple as a Status Symbol in Antiquity. Latomus.",
   "Cooksey, C. J. (2001). Tyrian purple: 6,6'-dibromoindigo and related compounds. Molecules 6(9): 736–769."
  ]
 },
 {
  "id": "kasane",
  "title": "Kasane: colors in layers",
  "dek": "Heian court women wore a season in silk: robes stacked so each edge showed a band of color with a poetic name.",
  "y": 1000,
  "e": "e0",
  "g": "japan",
  "lead": [
   "At the Heian court (794–1185), a noblewoman's dress was a stack of unlined silk robes. Only the edges showed, at the sleeves, neck and hem, and those bands of color were chosen by rules called kasane no irome, 'the colors of layering'.",
   "Combinations had seasonal names such as red plum, cherry, kerria rose and autumn maple. Wearing the right one at the right time showed taste; wearing it late was a famous social failure. The color [[Lavender|lavender]] and deep [[Purple|purple]] carried special prestige."
  ],
  "sections": [
   {
    "title": "Dressing in edges",
    "text": [
     "Formal court dress for women, later nicknamed jūnihitoe ('twelve layers'), was a set of wide robes worn one over another. The number of layers varied and twelve was not a rule. Because each robe was a little shorter or narrower than the one beneath, the sleeves and hems formed stripes of color, like the edge of a closed book.",
     "Those stripes were the point. They were seen from a distance, under curtains, spilling from a carriage, so a woman could be judged by a few centimeters of color."
    ]
   },
   {
    "title": "A season in silk",
    "text": [
     "Each combination had a name and a season. 'Red plum' (kōbai) layered pinks and deep reds for late winter; 'cherry' set white over pale red or violet for spring; 'kerria' (yamabuki) paired yellow with orange or green; maple combinations ran from yellow to deep red for autumn. Many names come from plants, but the colors evoke a feeling of the season rather than copying it exactly: one winter set called 'under the snow' puts white over pink over green.",
     "Some combinations meant a single robe with a different-colored lining; others meant a gradient across several robes, called nioi when it ran from dark to light."
    ]
   },
   {
    "title": "Taste on display",
    "text": [
     "The literature of the period treats color as character. In The Pillow Book, Sei Shōnagon lists things that are dispiriting, including a robe in a color that is out of season. In The Tale of Genji, written by the court lady known as Murasaki Shikibu, characters are judged by the combinations they choose and the gifts of robes they give.",
     "The author's own nickname points to the most prestigious dye. Murasaki means purple, from the gromwell root, and deep purple was one of the colors restricted by rank at court."
    ]
   },
   {
    "title": "Rules written down later",
    "text": [
     "Most surviving lists of kasane combinations were written after the Heian period, by court experts trying to preserve or reconstruct the practice. They disagree with each other, and the dye colors behind the names are hard to pin down, since plant dyes fade and few Heian textiles survive.",
     "So modern charts of 'Heian colors' are reconstructions. They are still useful for what they show: a color system built on combinations, seasons and poetry, not on single hues."
    ]
   },
   {
    "title": "Why it still matters",
    "text": [
     "Kasane is an early design system for palettes. It teaches that a color means something next to its neighbors, that order matters, and that a small edge of color can carry as much as a whole field. The same idea runs through Japanese traditional color names today, and through modern palette tools that name combinations rather than single colors (see [[color-harmony|color harmony]])."
    ]
   }
  ],
  "colors": [
   "Lavender",
   "Purple",
   "Baby pink",
   "Crimson",
   "Canary",
   "Moss"
  ],
  "swatches": [
   [
    "#B03A48",
    "Kōbai · red plum"
   ],
   [
    "#F2D7DD",
    "Sakura · cherry"
   ],
   [
    "#E8B32E",
    "Yamabuki · kerria"
   ],
   [
    "#C24A2B",
    "Momiji · maple"
   ],
   [
    "#6B4C8A",
    "Murasaki · purple"
   ],
   [
    "#6E7F4A",
    "Matsu · pine"
   ]
  ],
  "facts": [
   [
    "Period",
    "Heian, 794–1185"
   ],
   [
    "System",
    "Kasane no irome"
   ],
   [
    "Layers",
    "Varied; 'twelve' is a nickname"
   ],
   [
    "Prestige dye",
    "Gromwell purple"
   ]
  ],
  "sources": [
   "Dalby, L. C. (1993). Kimono: Fashioning Culture. Yale University Press (ch. 'The Cultured Nature of Heian Colors').",
   "Morris, I. (1964). The World of the Shining Prince: Court Life in Ancient Japan. Oxford University Press.",
   "Sei Shōnagon, The Pillow Book. Trans. M. McKinney (2006). Penguin Classics.",
   "Wikipedia, 'Jūnihitoe' and 'Kasane no irome'.",
   "Japan Government, Highlighting Japan (October 2020): 'Kimono Combinations: The Seasons in Layers of Silk'. gov-online.go.jp"
  ]
 },
 {
  "id": "tudor-sumptuary",
  "title": "Who could wear scarlet",
  "dek": "Medieval and Tudor laws ranked people by cloth and color. The rules were strict on paper and leaky in life.",
  "y": 1400,
  "e": "e0",
  "g": "western",
  "lead": [
   "From the 12th to the 17th century, European towns and kings passed sumptuary laws that tied clothing to rank. The costliest dyes, above all [[kermes|kermes]] [[Scarlet|scarlet]], went to the top; plain russet and [[Grey|grey]] went to the bottom.",
   "The laws banned dyestuffs and fabrics more than hues, they were constantly re-issued because people ignored them, and they had a side effect nobody planned: rich merchants shut out of scarlet turned to luxurious [[Black|black]] (see [[#history:black|black in fashion]])."
  ],
  "sections": [
   {
    "title": "Color as a price tag",
    "text": [
     "Before chemical dyes, color was a direct readout of cost. A deep, even red needed kermes, a dye made from insects gathered on Mediterranean oaks, and a lot of it. In 15th-century Florence a dyers' manual ranked crimson as the first and highest of colors, and red cloth cost far more to dye than blue. Bright, saturated color was wealth you could see across a street.",
     "Sumptuary laws tried to keep that signal honest. They told each rank which fabrics, furs, trimmings and dyes it could wear, so that a glance would tell a lord from a merchant and a merchant from a servant."
    ]
   },
   {
    "title": "What the laws actually said",
    "text": [
     "The details varied by place. In 13th-century Castile, scarlet was reserved for the king. English statutes of the 14th century limited carters and herdsmen to cheap russet and blanket cloth. Florence's laws named crimson among restricted luxuries, and Venetian rules kept the best scarlets for princes and officials while barring clerics, widows and magistrates from showy colors, stripes and checks.",
     "Henry VIII's Acts of Apparel (from 1510, restated in 1533) and Elizabeth I's proclamations went further. Silk 'of the colour of purple' and cloth of gold tissue were kept for the royal family, crimson and blue velvet for the high nobility and knights of the Garter. Historians read these lists as a picture of what people wanted to wear, not of what they wore."
    ]
   },
   {
    "title": "Laws nobody obeyed",
    "text": [
     "The clearest evidence that sumptuary laws failed is how often they were repeated. Towns re-issued them every few years, raised fines, hired inspectors and then quietly stopped enforcing them. Elizabeth I issued proclamations on apparel again and again, and Parliament repealed the old acts in 1604.",
     "Enforcement was also selective. Many rules aimed at women's dress and at newcomers with money, and some cities used them to mark outsiders: Milan in 1323 made prostitutes wear a distinctive garment, and church councils required marks of difference on Jewish and Muslim clothing. Colors that marked shame are part of the same system as colors that marked rank."
    ]
   },
   {
    "title": "The unintended winner: black",
    "text": [
     "Merchants who could afford scarlet but were forbidden it needed another way to look rich. From about 1360 dyers learned to make a deep, true black on wool, using costly oak galls rather than cheap bark, and black became the luxury loophole. It was sober, so the law allowed it, and expensive, so everyone could tell.",
     "The fashion spread from Italian city-states to the Burgundian court, where Philip the Good wore black for decades, and from there to the Habsburgs and Spain. By 1600 the most powerful men in Europe dressed in black, a story told in [[#history:black|black in fashion]]."
    ]
   },
   {
    "title": "Reading the evidence",
    "text": [
     "Two cautions. First, laws describe intentions; inventories and paintings describe practice. Florence's 1343 survey of women's clothes counted thousands of garments and found red far ahead of every other color, which tells us what was popular, not what was permitted. Second, color words shifted: 'scarlet' long meant a grade of fine wool cloth that could be dyed several colors before it came to mean the red.",
     "So the honest summary is that rank was coded in dye and fabric, the code was enforced unevenly, and fashion kept finding gaps in it."
    ]
   }
  ],
  "colors": [
   "Scarlet",
   "Crimson",
   "Black",
   "Purple",
   "Brown",
   "Grey"
  ],
  "swatches": [
   [
    "#B3202A",
    "Kermes scarlet"
   ],
   [
    "#7E1F2B",
    "Crimson grain"
   ],
   [
    "#6E5A4A",
    "Russet"
   ],
   [
    "#7D7B78",
    "Undyed grey"
   ],
   [
    "#17161A",
    "Gall black"
   ]
  ],
  "facts": [
   [
    "Oldest English statute",
    "1337 (wool and fur)"
   ],
   [
    "Tudor acts",
    "1510, 1533"
   ],
   [
    "Repealed in England",
    "1604"
   ],
   [
    "Most restricted red",
    "Kermes scarlet"
   ]
  ],
  "sources": [
   "Hunt, A. (1996). Governance of the Consuming Passions: A History of Sumptuary Law. Macmillan.",
   "Pastoureau, M. (2009). Black: The History of a Color. Princeton University Press.",
   "Pastoureau, M. (2017). Red: The History of a Color. Princeton University Press.",
   "Gage, J. (1993). Colour and Culture, ch. 'The Rise of Colour Theory'. Thames & Hudson.",
   "Greenfield, A. B. (2005). A Perfect Red. HarperCollins.",
   "Hayward, M. (2009). Rich Apparel: Clothing and the Law in Henry VIII's England. Ashgate."
  ]
 },
 {
  "id": "andean-cloth",
  "title": "Andean cloth: cochineal and camelid wool",
  "dek": "In the Andes, cloth was wealth, tax and diplomacy. Its reds came from an insect Europe would later crave.",
  "y": 1500,
  "e": "e1",
  "g": "americas",
  "lead": [
   "For more than two thousand years, Andean weavers dyed cotton and camelid wool (alpaca, llama, vicuña) in reds, blues, yellows and browns of astonishing range. The prized red came from [[cochineal|cochineal]] insects, the blues from [[indigo-dye|indigo]] plants.",
   "Under the Inca, the finest cloth, cumbi, was a state treasure. After the Spanish conquest, cochineal became one of the most valuable exports of the Americas and changed what [[Crimson|crimson]] and [[Scarlet|scarlet]] meant in Europe."
  ],
  "sections": [
   {
    "title": "A fiber that takes color",
    "text": [
     "Camelid wool absorbs dye deeply, which is one reason Andean textiles hold such saturated colors. Cotton, grown on the coast in natural white and brown, was spun alongside it. Weavers combined the two: cotton warps with dyed wool wefts in tapestry, so the color sits on the surface.",
     "Some of the oldest textiles come from the dry south coast of Peru, where the desert preserved cloth for millennia. Embroidered mantles from the Paracas culture, roughly two thousand years old, show figures in dozens of shades."
    ]
   },
   {
    "title": "Reds from an insect",
    "text": [
     "Cochineal lives on prickly-pear cactus. Dried and crushed, the females give carminic acid; with different mordants, dyers got pinks, reds, crimsons and purples. Andean dyers also used plant reds from relbunium roots. Textiles from Peruvian burials about two thousand years old contain cochineal red, though scholars still debate whether Andean or Mexican peoples began using it first.",
     "Blues came from indigo plants, yellows from various plants, and greens from blue over yellow. Indigo-dyed yarn in Andean graves often survives better than the reds and yellows beside it."
    ]
   },
   {
    "title": "Cloth as state wealth",
    "text": [
     "In the Inca empire (15th to early 16th century), cloth worked like money and diplomacy. Households owed woven cloth as tax; specialist weavers, including the aqllakuna or 'chosen women' and male cumbicamayoc, made fine cumbi tapestry for the state. The ruler gave cloth to reward loyalty and burned it in rituals.",
     "Inca men's tunics, called unku, followed strict designs. Some carry rows of small square motifs, tocapu, whose meaning is still debated; a few tunics are covered in them and probably belonged to the highest rank."
    ]
   },
   {
    "title": "When Europe met cochineal",
    "text": [
     "Spanish conquistadors found cochineal for sale in Aztec markets in Mexico in 1519, and by the late 1500s it was crossing the Atlantic by the shipload. It gave a stronger, brighter red than Europe's [[kermes|kermes]], and Spain guarded the source for two centuries. Cochineal dyed cardinals' robes, the coats of British soldiers and the reds in many European paintings.",
     "Andean weaving continued under colonial rule, mixing local and European motifs and materials, and continues today in highland communities that keep natural dyes alive alongside synthetic ones."
    ]
   }
  ],
  "colors": [
   "Crimson",
   "Scarlet",
   "Indigo",
   "Mustard",
   "Cream",
   "Chocolate"
  ],
  "swatches": [
   [
    "#A3243B",
    "Cochineal red"
   ],
   [
    "#C45A7A",
    "Cochineal pink"
   ],
   [
    "#5E2A4F",
    "Cochineal purple"
   ],
   [
    "#26345E",
    "Indigo"
   ],
   [
    "#D8A031",
    "Plant yellow"
   ],
   [
    "#6B4A33",
    "Natural brown cotton"
   ]
  ],
  "facts": [
   [
    "Fibers",
    "Cotton, alpaca, llama, vicuña"
   ],
   [
    "Prized red",
    "Cochineal"
   ],
   [
    "Inca fine cloth",
    "Cumbi"
   ],
   [
    "Cochineal to Europe",
    "From the 1520s"
   ]
  ],
  "sources": [
   "Stone-Miller, R. (1992). To Weave for the Sun: Ancient Andean Textiles in the Museum of Fine Arts, Boston. Thames & Hudson.",
   "Phipps, E., Hecht, J. & Esteras Martín, C. (2004). The Colonial Andes: Tapestries and Silverwork, 1530–1830. The Metropolitan Museum of Art.",
   "Greenfield, A. B. (2005). A Perfect Red. HarperCollins.",
   "Finlay, V. (2002). Colour: Travels Through the Paintbox, ch. 'Red'. Sceptre.",
   "Balfour-Paul, J. (2011). Indigo: Egyptian Mummies to Blue Jeans. British Museum Press.",
   "Murra, J. V. (1962). Cloth and Its Functions in the Inca State. American Anthropologist 64(4): 710–728."
  ]
 },
 {
  "id": "black",
  "title": "Black in fashion",
  "dek": "Black went from poor dye to princely luxury, Protestant virtue, the bourgeois suit and the little black dress.",
  "y": 1600,
  "e": "e1",
  "g": "western",
  "lead": [
   "In medieval Europe, black cloth was usually a dull brownish dye for the poor and for mourning. From the late 1300s new dyeing made a deep, true [[Black|black]] possible, and it became a luxury favored by merchants, then by the Burgundian and Spanish courts, then by Protestant reformers.",
   "The 19th century made the black suit the uniform of respectable men, and in 1926 Vogue presented a short black dress by Chanel as fashion's equivalent of a Ford. Chanel did not invent the black dress, but she helped make it chic rather than funereal."
  ],
  "sections": [
   {
    "title": "The hard color",
    "text": [
     "Black is difficult to dye. Medieval dyers often got grey, brown or bluish results from bark and iron, and the color looked cheap and faded fast. Only the finest blacks, using expensive oak galls imported from the Near East, or over-dyeing with woad, came out deep and even. Dishonest dyers topped poor blacks with soot, a fraud that crops up in court records.",
     "That difficulty is why black could flip from cheap to costly. Once dyers could make a rich black on fine wool, it read as quality."
    ]
   },
   {
    "title": "Merchants and princes",
    "text": [
     "Black clothing began to climb in prestige around 1300 among lawyers and magistrates, as a sign of gravity. In the late 1300s Italian merchants, barred by sumptuary laws from the best scarlets, took it up as a permitted luxury (see [[#history:tudor-sumptuary|who could wear scarlet]]).",
     "Philip the Good, Duke of Burgundy, wore black from about 1419, at first in mourning for his murdered father. The Burgundian court passed the habit to the Habsburgs, and under Charles V and Philip II, Spanish court black became the height of European elegance. Portraits of the period show black velvet and silk set off by white ruffs, gold and jewels."
    ]
   },
   {
    "title": "Protestant black",
    "text": [
     "The Reformation pushed black from luxury to morality. Reformers condemned bright, showy dress, and Protestant merchants, ministers and burghers wore black and white. Dutch group portraits of the 1600s are seas of black cloth and white collars, though the black was often costly silk or fine wool, so modesty and wealth went together.",
     "By the 1630s fashion was turning; Louis XIV's court loved color. But black kept its place among clergy, lawyers, scholars and the old."
    ]
   },
   {
    "title": "The century of the black suit",
    "text": [
     "From the late 18th century, men's dress drained toward dark colors, and by the mid-1800s the black coat and trousers were the uniform of respectable men across classes. The writer Thomas Hardy described rural crowds as dark as London ones. Dark dyes from logwood, a Central American tree, made black cheaper for the mass market.",
     "Women wore black for mourning (see [[#history:mourning-dress|mourning dress]]) and, increasingly, for elegance. John Singer Sargent's 1884 portrait of Madame Gautreau in a black evening gown caused a scandal for its pose and plunging neckline, not its color."
    ]
   },
   {
    "title": "The little black dress",
    "text": [
     "In October 1926 American Vogue published a drawing of a simple black crepe dress by Gabrielle 'Coco' Chanel and compared it to a Ford car: a standard design that everyone could adopt. The line 'Chanel's Ford' stuck, and the little black dress became a fashion idea.",
     "But black dresses were already fashionable. Designers such as Paul Poiret and Jacques Doucet had shown black before the First World War, and the war's mourning had made black familiar. The fair claim is that Chanel and Vogue gave the short black dress its modern meaning, not that she invented it."
    ]
   },
   {
    "title": "Black after Chanel",
    "text": [
     "In the 20th century black kept collecting meanings: bohemian and existentialist cool in 1950s Paris, rebellion in leather (see [[#history:punk|punk]]), and the avant-garde of Japanese designers who brought deep, layered black to Paris in the early 1980s. Black is now the default of fashion workers themselves, a color that says 'serious' without saying much else."
    ]
   }
  ],
  "colors": [
   "Black",
   "Charcoal",
   "White",
   "Ivory"
  ],
  "swatches": [
   [
    "#121214",
    "Gall black"
   ],
   [
    "#2A2622",
    "Bark black"
   ],
   [
    "#1C1F2B",
    "Blue-black"
   ],
   [
    "#F2EEE4",
    "White ruff"
   ],
   [
    "#B89545",
    "Gold trim"
   ]
  ],
  "facts": [
   [
    "True black wool",
    "From c. 1360"
   ],
   [
    "Burgundian black",
    "From 1419"
   ],
   [
    "Spanish court black",
    "c. 1550–1650"
   ],
   [
    "'Chanel's Ford'",
    "Vogue, October 1926"
   ]
  ],
  "sources": [
   "Pastoureau, M. (2009). Black: The History of a Color. Princeton University Press.",
   "Harvey, J. (1995). Men in Black. Reaktion Books.",
   "Greenfield, A. B. (2005). A Perfect Red, ch. 11. HarperCollins.",
   "Gage, J. (1993). Colour and Culture. Thames & Hudson.",
   "Edwards, L. (2017). How to Read a Dress. Bloomsbury.",
   "Victoria and Albert Museum, 'What makes Chanel so iconic?' vam.ac.uk"
  ]
 },
 {
  "id": "indian-cottons",
  "title": "Indian cotton: chintz, madder and indigo",
  "dek": "India's washable, colorfast cottons dazzled the world. Europe banned them, then copied them.",
  "y": 1680,
  "e": "e1",
  "g": "india",
  "lead": [
   "For centuries Indian dyers made what no one else could: cotton printed and painted in fast reds, [[Indigo|blues]] and blacks that survived washing. Their secret was mordant dyeing with madder-type reds and resist dyeing with [[indigo-dye|indigo]].",
   "Chintz and calico took over European fashion in the late 1600s. France and England banned them to protect wool and silk, copied the techniques, and the race to imitate them helped launch mechanized textile printing."
  ],
  "sections": [
   {
    "title": "The washable miracle",
    "text": [
     "Most European dyes of the 1600s sat poorly on cotton and ran in the wash. Indian painted and printed cottons did not. Their reds came from madder-family roots, including chay root on the Coromandel coast, fixed with alum; iron mordants gave blacks and purples; and indigo, applied with wax resists, gave blues. Yellows painted over blue made greens.",
     "The process took weeks: bleaching, mordanting with a pen or block, dyeing, washing in rivers, waxing, and dyeing again. The word kalamkari, 'pen work', names the hand-drawn version."
    ]
   },
   {
    "title": "Words that traveled with the cloth",
    "text": [
     "The trade left its words in English. Calico comes from Calicut on the Kerala coast. Chintz comes from a Hindi word for spotted or sprinkled cloth. In France printed cottons were called indiennes, and those that came overland through Persia were called perses whatever their origin.",
     "Indian makers adapted designs to each market. Palampores, large painted bed covers with flowering trees, were made for European buyers; other patterns went to Southeast Asia, Japan and East Africa. In Japan, imported Indian cottons called sarasa were so admired that local dyers learned to imitate them."
    ]
   },
   {
    "title": "The calico craze and the bans",
    "text": [
     "By the 1680s the English and Dutch East India Companies were shipping printed cottons by the million pieces, and light, bright chintz became a fashion for dresses and furnishings. Wool and silk weavers protested, sometimes violently.",
     "France banned printed cotton in 1686 and kept the ban, with exceptions and smuggling, until 1759. England banned imports of printed Indian calico in 1700 and, in 1721, the wearing of printed calico altogether. The bans protected home industries and pushed Europeans to master cotton printing themselves."
    ]
   },
   {
    "title": "Cloth, slavery and empire",
    "text": [
     "Indian cottons were also a currency of the Atlantic slave trade. Blue-dyed and checked 'Guinea cloths' from the Coromandel coast were among the main goods European traders exchanged for enslaved people in West Africa, and indigo grown by enslaved workers in the Americas came back to dye European cloth.",
     "Under British rule in the 19th century, Indian indigo was grown for export under harsh contracts, which led to the Indigo Revolt of 1859–60 in Bengal. Gandhi's later call for homespun khadi turned cloth into a symbol of independence."
    ]
   },
   {
    "title": "Europe catches up",
    "text": [
     "European printers learned mordant dyeing from Indian and Ottoman methods during the 18th century. Copperplate and roller printing came next, and the 'Turkey red' process for a brilliant, fast red on cotton spread from the Levant to France and Scotland. The economic historian K. N. Chaudhuri suggested that the demand created by Indian cottons was one root of Britain's mechanized textile industry, an argument still debated.",
     "By the mid-19th century the flow had reversed, and machine-printed cottons from Lancashire were flooding Indian markets."
    ]
   }
  ],
  "colors": [
   "Indigo",
   "Brick",
   "Rust",
   "Ochre",
   "Cream"
  ],
  "swatches": [
   [
    "#A8322D",
    "Madder red"
   ],
   [
    "#1F2F5C",
    "Indigo"
   ],
   [
    "#2B2420",
    "Iron black"
   ],
   [
    "#6A2E4B",
    "Iron-madder purple"
   ],
   [
    "#5E7A3A",
    "Overdyed green"
   ],
   [
    "#EFE4CC",
    "Bleached ground"
   ]
  ],
  "facts": [
   [
    "Key techniques",
    "Mordant and resist dyeing"
   ],
   [
    "French ban",
    "1686–1759"
   ],
   [
    "English bans",
    "1700 and 1721"
   ],
   [
    "Word origins",
    "Calicut, chhīṇṭ"
   ]
  ],
  "sources": [
   "Crill, R. (2008). Chintz: Indian Textiles for the West. V&A Publishing.",
   "Riello, G. (2013). Cotton: The Fabric that Made the Modern World. Cambridge University Press.",
   "Finlay, V. (2021). Fabric: The Hidden History of the Material World. Profile Books.",
   "Balfour-Paul, J. (2011). Indigo: Egyptian Mummies to Blue Jeans. British Museum Press.",
   "Ball, P. (2001). Bright Earth, ch. 17. Farrar, Straus and Giroux.",
   "Chaudhuri, K. N. (1978). The Trading World of Asia and the English East India Company, 1660–1760. Cambridge University Press."
  ]
 },
 {
  "id": "edo-browns",
  "title": "Forty-eight browns, a hundred greys",
  "dek": "Edo townspeople were banned from bright luxury, so they made a fashion out of brown, grey and indigo.",
  "y": 1700,
  "e": "e2",
  "g": "japan",
  "lead": [
   "Japan's Tokugawa shogunate issued sumptuary edicts for more than two centuries, keeping silk, gold thread, deep purple and safflower red from townspeople. The answer was a refined taste for subdued [[Brown|browns]], [[Grey|greys]] and [[Indigo|indigo]], summed up in the saying shijūhatcha hyakunezumi, 'forty-eight browns and a hundred greys'.",
   "The numbers are figurative: they mean 'countless'. Some of the shades were named after kabuki actors, and the restraint itself became a style later called iki."
  ],
  "sections": [
   {
    "title": "Rich merchants, nervous rulers",
    "text": [
     "Edo-period Japan (1603–1868) placed merchants at the bottom of the official social order, below samurai, farmers and artisans. Yet merchants held the money, and their wives' kosode robes in the late 1600s could outshine anything at court: all-over tie-dyed dots, gold embroidery, bold designs on crimson grounds.",
     "The shogunate answered with edicts. A famous one in 1683 barred townspeople from gold brocade, embroidery and the labor-heavy fawn-spot tie-dye called kanoko. Later reform drives, in the 1720s, around 1790 and again in the 1840s, tightened the rules on silk, colors and decoration."
    ]
   },
   {
    "title": "What was taken away",
    "text": [
     "The banned colors were the expensive ones. Deep purple from gromwell root and bright crimson from safflower needed large amounts of dyestuff and skill, so they read as luxury. Some reds and purples had long been 'forbidden colors' at the imperial court too.",
     "What stayed legal was ordinary: cotton and plain silk in browns, greys and indigo, colors that cheap dyes and many dips could give. Indigo-dyed cotton was everywhere, from work clothes to bedding."
    ]
   },
   {
    "title": "Countless browns and greys",
    "text": [
     "Within those limits, dyers and customers chased tiny differences. A brown could lean red or green, a grey could carry a hint of plum, indigo or tea. Shades took names from places, plants and above all from kabuki stars: Danjūrō-cha was the persimmon brown of the Ichikawa Danjūrō acting line, and Rokō-cha a muted green-brown linked to the actor Segawa Kikunojō II. Grey names included Fukagawa-nezumi and Rikyū-nezumi, after the tea master.",
     "The phrase 'forty-eight browns and a hundred greys' is a saying, not a count. Forty-eight and a hundred mean 'a great many', and modern lists of traditional colors name more or fewer depending on the source."
    ]
   },
   {
    "title": "Luxury on the inside",
    "text": [
     "Another workaround was to hide the luxury. A plain outer robe could have a silk lining in a vivid color or a striking pattern, seen only when the wearer moved. Under-robes and linings, small accessories and fine stripes let wealth show to those who knew where to look.",
     "Kimono from the period in museum collections often look restrained at first and remarkable up close: a dark ground, a finely dyed small pattern, a flash of color at the hem."
    ]
   },
   {
    "title": "From rule to taste",
    "text": [
     "By the 19th century, restraint had become a positive ideal. The philosopher Kuki Shūzō later described iki, the urbane chic of Edo townspeople, and singled out grey, brown and blue as its colors. Many historians caution against reading iki purely as a reaction to law; it also came from the pleasure quarters, the theater and the city's own sense of style.",
     "Either way, the lesson travels. When bright color is forbidden or simply expensive, attention moves to nuance: texture, a shift in undertone, the name you give a grey."
    ]
   }
  ],
  "colors": [
   "Brown",
   "Grey",
   "Indigo",
   "Umber",
   "Taupe",
   "Ash",
   "Charcoal",
   "Sepia"
  ],
  "swatches": [
   [
    "#7A4B2A",
    "Danjūrō-cha"
   ],
   [
    "#6E6A4E",
    "Rokō-cha"
   ],
   [
    "#6F6A66",
    "Rikyū-nezumi"
   ],
   [
    "#5E6670",
    "Fukagawa-nezumi"
   ],
   [
    "#2C3A52",
    "Indigo"
   ],
   [
    "#8A7765",
    "Tea brown"
   ]
  ],
  "facts": [
   [
    "Period",
    "Edo, 1603–1868"
   ],
   [
    "Famous edict",
    "1683"
   ],
   [
    "Saying",
    "Shijūhatcha hyakunezumi"
   ],
   [
    "The numbers",
    "Figurative: 'countless'"
   ]
  ],
  "sources": [
   "Shively, D. H. (1964–65). Sumptuary Regulation and Status in Early Tokugawa Japan. Harvard Journal of Asiatic Studies 25: 123–164.",
   "Gluckman, D. C. & Takeda, S. T. (1992). When Art Became Fashion: Kosode in Edo-Period Japan. Los Angeles County Museum of Art.",
   "Kuki, S. (1930). Iki no kōzō (The Structure of Iki). Trans. in Nara, H. (2004), The Structure of Detachment. University of Hawai'i Press.",
   "Balfour-Paul, J. (2011). Indigo: Egyptian Mummies to Blue Jeans. British Museum Press.",
   "The Metropolitan Museum of Art, Heilbrunn Timeline of Art History: 'Kosode' and 'Edo Period (1615–1868)'. metmuseum.org"
  ]
 },
 {
  "id": "navy",
  "title": "Navy blue and the uniform",
  "dek": "Indigo-dyed wool for sailors became the color of police, schools, blazers and the modern suit.",
  "y": 1748,
  "e": "e2",
  "g": "western",
  "lead": [
   "[[Navy|Navy blue]] takes its name from the dark [[indigo-dye|indigo]]-dyed wool of the Royal Navy, whose officers got their first official uniform in 1748. Dark blue held up at sea, hid dirt and did not fade the way other colors did.",
   "From the navy it spread to police forces, schools, airlines and business suits. The historian Michel Pastoureau calls navy the most common color of Western clothing, inheriting many of the jobs black once did."
  ],
  "sections": [
   {
    "title": "Why indigo for the sea",
    "text": [
     "Indigo is unusually lightfast: it fades by wearing away rather than changing hue, so a dark indigo coat stays blue under sun and salt. Many dips built a deep shade, and a little woad in the vat helped the fermentation. English dyers in the 1700s had names for a dozen indigo shades, from milk blue and pearl blue through queen's blue to the darkest, navy blue.",
     "Dark blue also hid tar and dirt better than lighter cloth, which mattered on a working ship."
    ]
   },
   {
    "title": "1748: the first naval uniform",
    "text": [
     "Under Lord Anson, the Admiralty issued the first uniform regulations for Royal Navy officers in 1748: blue coats faced with white, worn with white breeches and stockings. Ordinary sailors had no official uniform until 1857 and wore 'slops' bought from the purser, though blue was already common.",
     "A popular story says the King chose blue and white after seeing a duchess in a riding habit of those colors. It is a legend, and one version names a king who had already died; the plain explanation is that blue was durable, available and already used."
    ]
   },
   {
    "title": "Blue for the state",
    "text": [
     "Other uniforms followed. Prussian soldiers had worn dark blue since the 18th century, and revolutionary France made blue its 'national' military color in the 1790s. When London's Metropolitan Police was founded in 1829, its officers were dressed in dark blue tailcoats, deliberately unlike the army's red, to look civil rather than military.",
     "In much of the 19th century, black was the color of clerks and officials. In the early 20th, navy took over many of those roles, partly because it looked less severe and showed dirt less."
    ]
   },
   {
    "title": "From sailor suits to blazers",
    "text": [
     "Navy became fashion through children first: the sailor suit, popularized when the young Prince Albert Edward was painted in one in 1846, dressed boys and then girls for a century. The navy blazer, gold buttons and all, came from rowing clubs and naval officers to schools and weekend wardrobes.",
     "Today navy is the safe dark: smart without the formality of black, the color of countless school uniforms, airline crews, suits and jeans (see [[#history:denim-workwear|denim]])."
    ]
   }
  ],
  "colors": [
   "Navy",
   "Midnight blue",
   "Indigo",
   "Royal blue",
   "White",
   "Gold"
  ],
  "swatches": [
   [
    "#1B2545",
    "Navy blue"
   ],
   [
    "#233A6B",
    "Garter blue"
   ],
   [
    "#4E6E9A",
    "Watchet"
   ],
   [
    "#9DB4CF",
    "Pearl blue"
   ],
   [
    "#F5F3EE",
    "White facings"
   ],
   [
    "#C9A54A",
    "Gold lace"
   ]
  ],
  "facts": [
   [
    "Officers' uniform",
    "1748"
   ],
   [
    "Ratings' uniform",
    "1857"
   ],
   [
    "London police",
    "1829, dark blue"
   ],
   [
    "Dye",
    "Indigo, plus woad"
   ]
  ],
  "sources": [
   "Balfour-Paul, J. (2011). Indigo: Egyptian Mummies to Blue Jeans. British Museum Press.",
   "Pastoureau, M. (2001). Blue: The History of a Color. Princeton University Press.",
   "Miller, A. (2007). Dressed to Kill: British Naval Uniform, Masculinity and Contemporary Fashions, 1748–1857. National Maritime Museum.",
   "Finlay, V. (2002). Colour: Travels Through the Paintbox, ch. 'Indigo'. Sceptre.",
   "Royal Museums Greenwich, 'Royal Navy uniforms'. rmg.co.uk",
   "Wikipedia, 'Uniforms of the Royal Navy'."
  ]
 },
 {
  "id": "imperial-yellow",
  "title": "Imperial yellow and the dragon robe",
  "dek": "In Qing China a robe's yellow told you exactly who wore it: emperor, heir, prince, or no one allowed.",
  "y": 1759,
  "e": "e2",
  "g": "china",
  "lead": [
   "In late imperial China, [[Yellow|yellow]] stood for the center and for earth, and it became the emperor's color. Under the Qing dynasty (1644–1911) the rules were codified in 1759: bright yellow for the emperor, apricot yellow for the heir, golden yellow for other princes.",
   "Officials wore dragon robes in [[Navy|blue]] and other colors, with square rank badges showing birds for civil officials and animals for military ones. By the dynasty's end, yellow was being granted as a favor, and its meaning thinned."
  ],
  "sections": [
   {
    "title": "Why yellow",
    "text": [
     "Chinese cosmology linked five colors to five directions and elements: green-blue for east, red for south, white for west, black for north, and yellow for the center and earth. The ruler sat at the center, so yellow suited him. Imperial use of yellow robes goes back at least to the Tang dynasty, and later dynasties narrowed who could wear which yellow.",
     "Yellow also covered the palace: glazed yellow roof tiles on the Forbidden City, yellow carriages, banners and seal wrappings. A European book of 1735 already explained to Western readers that yellow meant the center of the universe there."
    ]
   },
   {
    "title": "The 1759 rulebook",
    "text": [
     "In 1748 the Qianlong emperor ordered a review of court dress, and in 1759 the result appeared as the Huangchao liqi tushi, an illustrated catalogue of ritual objects, instruments, weapons and clothing. It specified who wore which robe, in which color, with which ornaments, for which occasion.",
     "Bright yellow (minghuang) was for the emperor, the empress and the empress dowager. The crown prince wore apricot yellow (xinghuang). The emperor's other sons and high princes wore golden yellow (jinhuang). Below them, princes and officials wore blue, blue-black or other permitted colors, with dragons whose number of claws and placement were also regulated."
    ]
   },
   {
    "title": "Dragons, waves and rank badges",
    "text": [
     "The everyday court garment of the elite was the jifu, now often called a dragon robe: a long robe with horseshoe cuffs, covered with dragons among clouds above a band of diagonal stripes and waves at the hem. Read together, waves, mountains and sky make the robe a small map of the universe, with the wearer's body as its axis.",
     "Rank showed on a square badge (buzi) sewn to the surcoat worn over the robe. Civil officials had birds, from the crane at the top to smaller birds lower down; military officials had animals, from the qilin and lion down. Color and badge together let anyone at court read status at a glance."
    ]
   },
   {
    "title": "How the yellow was made",
    "text": [
     "Dyers made imperial yellows from plant dyes. One recipe used the root of Chinese foxglove (Rehmannia) with plant-ash mordants; pagoda-tree buds and the bark of the Amur cork tree were other common yellow sources. Small differences in mordant and dye strength separated bright, golden and apricot yellows, which is one reason surviving robes vary and one reason the rules were written down at all."
    ]
   },
   {
    "title": "Yellow given away",
    "text": [
     "By the late 19th century the system was loosening. The 'yellow riding jacket' had long been awarded to officials as an honor, and the Empress Dowager Cixi granted yellow to favorites, reportedly including a train driver. When the American painter Katharine Carl painted Cixi in 1903 the empress was wrapped in imperial yellow, but the dynasty had eight years left.",
     "After 1911 the color code ended with the empire. A different uniformity followed later in the century, when many people in the People's Republic wore plain blue or grey suits."
    ]
   }
  ],
  "colors": [
   "Yellow",
   "Gold",
   "Apricot",
   "Mustard",
   "Navy",
   "Midnight blue"
  ],
  "swatches": [
   [
    "#F2C200",
    "Minghuang · bright yellow"
   ],
   [
    "#E8A94E",
    "Xinghuang · apricot"
   ],
   [
    "#D9A21B",
    "Jinhuang · golden"
   ],
   [
    "#1F2C5A",
    "Official blue"
   ],
   [
    "#1A1A2A",
    "Blue-black"
   ]
  ],
  "facts": [
   [
    "Dynasty",
    "Qing, 1644–1911"
   ],
   [
    "Codified",
    "1759, Huangchao liqi tushi"
   ],
   [
    "Emperor",
    "Bright yellow"
   ],
   [
    "Crown prince",
    "Apricot yellow"
   ]
  ],
  "sources": [
   "Vollmer, J. E. (2002). Ruling from the Dragon Throne: Costume of the Qing Dynasty (1644–1911). Ten Speed Press.",
   "Wilson, V. (1986). Chinese Dress. Victoria and Albert Museum.",
   "Garrett, V. M. (2007). Chinese Dress: From the Qing Dynasty to the Present. Tuttle.",
   "Pastoureau, M. (2019). Yellow: The History of a Color. Princeton University Press.",
   "St Clair, K. (2016). The Secret Lives of Colour, 'Imperial yellow'. John Murray.",
   "Victoria and Albert Museum, leaves from the Huangchao liqi tushi (Illustrated Regulations for Ceremonial Paraphernalia), 1759. collections.vam.ac.uk"
  ]
 },
 {
  "id": "white",
  "title": "White: muslin, laundry and the wedding dress",
  "dek": "Queen Victoria didn't invent the white wedding dress. White's real story is about cotton, cleaning and money.",
  "y": 1840,
  "e": "e3",
  "g": "western",
  "lead": [
   "For centuries clean [[White|white]] cloth signaled wealth, because only people with servants could keep lace, ruffs and linen spotless. Around 1800, imported Indian muslin made white dresses the height of fashion.",
   "Queen Victoria married in white silk satin in 1840, and her choice was widely copied, but she did not start the custom: royal and wealthy brides had worn white before, and brides in France and Italy were already marrying in white in the 1830s. Most women married in their best dress, in any color, until much later."
  ],
  "sections": [
   {
    "title": "White as wealth",
    "text": [
     "White is easy to dye, in the sense that it needs no dye: just bleaching, sun and washing. What it needs is labor. Linen shirts, lace collars and starched ruffs had to be washed, bleached and pressed constantly, so a crisp white collar showed that someone else did the work. In portraits from the 1500s to the 1700s, white at the neck and wrists is a badge of status set against dark cloth (see [[#history:black|black in fashion]])."
    ]
   },
   {
    "title": "The muslin moment",
    "text": [
     "In 1783 the painter Élisabeth Vigée Le Brun exhibited a portrait of Marie Antoinette in a simple white cotton dress, and critics thought the queen looked as if she were in her underwear. Within twenty years, light white dresses of Indian muslin, high-waisted and inspired by images of ancient statues, were the fashion across Europe.",
     "Muslin came from Bengal, where weavers spun cotton fine enough for cloth that was nearly transparent. The craze lasted into the 1820s and drew criticism for being cold in northern winters, for its expense, and for its dependence on imports. Napoleon urged French women to wear French silk instead."
    ]
   },
   {
    "title": "Victoria's wedding",
    "text": [
     "On 10 February 1840 Queen Victoria married Prince Albert in a white silk satin dress trimmed with Honiton lace, choosing British-made materials. She wore a wreath of orange blossom and a lace veil rather than royal robes, and images of the wedding circulated widely.",
     "Her choice was influential, but white weddings predated it among the elite: Mary, Queen of Scots, married in white in 1558. The historian Michel Pastoureau notes French and Italian brides already in white in the 1830s and suggests Victoria's real novelty was the veil."
    ]
   },
   {
    "title": "White for everyone, slowly",
    "text": [
     "For most women a white dress worn once was an impossible luxury. Brides wore their best dress, often dark so it could be worn again; village brides in parts of France wore red, a color local dyers did well. The white wedding spread with cheaper cotton, ready-made clothes, and photography in the late 19th and early 20th century, and became the norm in much of the West only in the 20th.",
     "Elsewhere, white means something else. In China and much of East Asia, white has long been the color of mourning, and brides wore red (see [[mourning-colors|mourning colors]])."
    ]
   },
   {
    "title": "White's other jobs",
    "text": [
     "White also meant hygiene and sport: tennis and cricket whites, nurses' uniforms, the white coats of doctors and scientists. Like the wedding dress, they rely on the idea that white shows dirt and so proves cleanliness. Pure white garments were among the first to use optical brighteners, chemicals that turn invisible ultraviolet into a faint blue glow so whites look whiter."
    ]
   }
  ],
  "colors": [
   "White",
   "Ivory",
   "Cream",
   "Ecru"
  ],
  "swatches": [
   [
    "#F7F6F2",
    "Bleached linen"
   ],
   [
    "#F2EBDD",
    "Muslin"
   ],
   [
    "#EFE6D0",
    "Ivory satin"
   ],
   [
    "#E8DFC8",
    "Lace"
   ],
   [
    "#F4F7FB",
    "Blued white"
   ]
  ],
  "facts": [
   [
    "Chemise portrait",
    "Vigée Le Brun, 1783"
   ],
   [
    "Muslin from",
    "Bengal"
   ],
   [
    "Victoria's wedding",
    "10 February 1840"
   ],
   [
    "Myth",
    "'Victoria started it'"
   ]
  ],
  "sources": [
   "Pastoureau, M. (2023). White: The History of a Color. Princeton University Press.",
   "Ehrman, E. (2011). The Wedding Dress: 300 Years of Bridal Fashions. V&A Publishing.",
   "St Clair, K. (2016). The Secret Lives of Colour, 'Ivory' and 'Lead white'. John Murray.",
   "Finlay, V. (2021). Fabric: The Hidden History of the Material World. Profile Books.",
   "Royal Collection Trust, 'Queen Victoria's wedding dress'. rct.uk",
   "Riello, G. (2013). Cotton: The Fabric that Made the Modern World. Cambridge University Press."
  ]
 },
 {
  "id": "batik-ikat",
  "title": "Batik and ikat",
  "dek": "Two ways to keep dye out: wax on the cloth, or ties on the thread. Indonesia made both into high arts.",
  "y": 1850,
  "e": "e4",
  "g": "seasia",
  "lead": [
   "Batik draws a pattern in wax on cloth before dyeing; ikat ties off bundles of thread before weaving. Both are resist techniques, and Indonesia's islands made them central to dress, ritual and status, often in [[Indigo|indigo]] and a warm brown or red.",
   "Javanese batik later inspired the Dutch-made 'wax prints' that became a West African fashion (see [[#history:wax-prints|wax prints]])."
  ],
  "sections": [
   {
    "title": "Wax on cloth",
    "text": [
     "In batik, hot wax is drawn onto cotton or silk with a canting, a small copper pen, or stamped with a copper block. The cloth goes into the dye; waxed areas stay pale. Wax is scraped or boiled off and reapplied for each new color, so a many-colored batik can take weeks.",
     "Hand-drawn batik is called tulis; stamped batik, cap (pronounced 'chap'), spread from the mid-19th century and made batik cheaper and far more common. UNESCO inscribed Indonesian batik on its list of intangible cultural heritage in 2009."
    ]
   },
   {
    "title": "Court colors and coastal colors",
    "text": [
     "Central Java's court cities favored a restrained palette: indigo blue and soga brown, from tree bark, on a cream ground. Some patterns, such as large diagonal parang designs, were reserved for the royal families of Yogyakarta and Surakarta, an Indonesian version of sumptuary law.",
     "On the north coast, trading towns with Chinese, Arab, Indian and Dutch communities made brighter batik: reds, pinks and greens, flowers and birds, designs aimed at many different buyers. Color in batik often tells you where it was made before it tells you anything else."
    ]
   },
   {
    "title": "Ties on thread",
    "text": [
     "Ikat moves the resist to the yarn. Weavers stretch the warp (or weft, or both) on a frame, bind bundles tightly with fiber, and dye; the bound parts stay undyed. After several rounds of binding and dyeing, the threads are woven, and the pattern appears with soft, feathered edges, because threads never line up perfectly.",
     "On Sumba, men's hinggi cloths pair red from morinda root with indigo blue; dyeing could be ritually restricted, and the strongest colors marked rank. Double ikat, where both warp and weft are tied, is made in only a few places, including Tenganan in Bali (geringsing) and Patan in Gujarat (patola)."
    ]
   },
   {
    "title": "Cloth that carries power",
    "text": [
     "Across the archipelago, cloth was given at births, weddings and funerals, and some textiles were treated as heirlooms with protective power. Indian patola silks, traded to Indonesia for centuries, were kept by royal families and imitated locally. Indigo dyeing was surrounded by rules about who could approach a vat, and blue-and-white cloth was used in rites of protection in Java and Bali.",
     "These meanings varied island by island and changed over time, so any single 'meaning' of a color in Indonesian textiles is best treated as local, not universal."
    ]
   }
  ],
  "colors": [
   "Indigo",
   "Sepia",
   "Cream",
   "Brick",
   "Rust",
   "Chocolate"
  ],
  "swatches": [
   [
    "#1E2D4F",
    "Indigo"
   ],
   [
    "#7B4A27",
    "Soga brown"
   ],
   [
    "#EADBB8",
    "Cream ground"
   ],
   [
    "#9C2F25",
    "Morinda red"
   ],
   [
    "#2E2420",
    "Over-dyed black"
   ]
  ],
  "facts": [
   [
    "Batik tool",
    "Canting (wax pen)"
   ],
   [
    "Stamped batik",
    "From mid-1800s"
   ],
   [
    "UNESCO",
    "Indonesian batik, 2009"
   ],
   [
    "Double ikat",
    "Bali and Gujarat"
   ]
  ],
  "sources": [
   "Gillow, J. (1992). Traditional Indonesian Textiles. Thames & Hudson.",
   "Elliott, I. M. (1984). Batik: Fabled Cloth of Java. Clarkson N. Potter.",
   "Balfour-Paul, J. (2011). Indigo: Egyptian Mummies to Blue Jeans, ch. 7–9. British Museum Press.",
   "UNESCO, 'Indonesian Batik', Representative List of the Intangible Cultural Heritage of Humanity (2009). ich.unesco.org",
   "Maxwell, R. (2003). Textiles of Southeast Asia: Tradition, Trade and Transformation. Periplus."
  ]
 },
 {
  "id": "kente-adinkra",
  "title": "Kente and adinkra",
  "dek": "Kente is woven in bright strips; adinkra is stamped with symbols. Read their color meanings with care.",
  "y": 1850,
  "e": "e4",
  "g": "africa",
  "lead": [
   "Kente is a strip-woven cloth of the Asante and Ewe peoples of Ghana and Togo, famous for its [[Gold|gold]], [[Kelly green|green]], [[Scarlet|red]] and [[Black|black]] patterns. Adinkra is cotton cloth stamped with symbols, traditionally worn for mourning in dark brown, red or black.",
   "Popular lists give each kente color one meaning, but scholars treat those lists as recent and loose; pattern names, often proverbs, carried the older meanings."
  ],
  "sections": [
   {
    "title": "Woven in strips",
    "text": [
     "Kente is woven by men on narrow looms in strips about ten centimeters wide, then sewn edge to edge into a large wrapper. Each strip alternates blocks of different patterns, so when strips are joined the cloth becomes a checkerboard of designs. Asante weaving centers include Bonwire and Adanwomase; Ewe weavers make their own distinct styles.",
     "Silk entered Asante weaving through trade, and older accounts say weavers unraveled imported silk cloth for its thread. Rayon and cotton later made kente more widely available."
    ]
   },
   {
    "title": "Names, not color codes",
    "text": [
     "Kente designs have names, and those names are the cloth's traditional language. Some refer to proverbs, some to historical figures or events, some to a pattern's technical difficulty; a famous one, adwinasa, is said to mean that every motif has been used up. Certain designs were reserved for the Asantehene, the Asante king, and his court.",
     "The tidy list that gives every color one meaning, gold for wealth, green for growth, and so on, circulates widely, especially in the United States. Researchers such as Doran Ross note that such lists are recent and vary; it is fairer to say colors carry associations than fixed meanings."
    ]
   },
   {
    "title": "Kente travels",
    "text": [
     "At Ghana's independence in 1957, Kwame Nkrumah and his ministers wore kente, and the cloth became a symbol of African freedom. In the United States from the 1960s, and widely from the 1990s, kente stoles at graduations and in churches became a sign of African American pride.",
     "Printed 'kente' patterns on factory cloth are now common, which raises the same questions of copying and credit that surround other famous textiles."
    ]
   },
   {
    "title": "Adinkra: cloth for farewell",
    "text": [
     "Adinkra cloth is stamped by hand with carved calabash stamps dipped in a thick black dye made by boiling the bark of the badie tree with iron slag. The stamps make a grid of symbols, each linked to a proverb or idea: Gye Nyame ('except God') is the best known.",
     "Traditionally adinkra was mourning dress. The three classic funeral cloths are kuntunkuni (dark brown), kobene (red) and brisi (black); some accounts say the red is for the closest relatives. Adinkra on white or bright grounds was worn for happier occasions."
    ]
   },
   {
    "title": "A legend and an older cloth",
    "text": [
     "A popular story says adinkra began when the Asante defeated a king named Adinkra of Gyaman around 1818 and took the craft from his court. But an adinkra cloth collected in Kumasi by the British envoy Thomas Bowdich in 1817, now in the British Museum, suggests the cloth is older than the legend. Both can be true in a sense: the story explains a name, the cloth shows a practice."
    ]
   }
  ],
  "colors": [
   "Gold",
   "Kelly green",
   "Scarlet",
   "Black",
   "Chocolate",
   "Royal blue"
  ],
  "swatches": [
   [
    "#E2A80F",
    "Kente gold"
   ],
   [
    "#1E7B3E",
    "Green"
   ],
   [
    "#B5232B",
    "Red"
   ],
   [
    "#16161A",
    "Black"
   ],
   [
    "#4A2E1F",
    "Kuntunkuni brown"
   ],
   [
    "#A52A1F",
    "Kobene red"
   ]
  ],
  "facts": [
   [
    "Kente makers",
    "Asante and Ewe"
   ],
   [
    "Strip width",
    "About 10 cm"
   ],
   [
    "Adinkra dye",
    "Badie bark and iron"
   ],
   [
    "Oldest dated adinkra",
    "Collected 1817"
   ]
  ],
  "sources": [
   "Ross, D. H. (1998). Wrapped in Pride: Ghanaian Kente and African American Identity. UCLA Fowler Museum of Cultural History.",
   "Mato, D. (1986). Clothed in Symbol: The Art of Adinkra among the Akan of Ghana. PhD dissertation, Indiana University.",
   "Picton, J. & Mack, J. (1989). African Textiles. British Museum Press.",
   "Balfour-Paul, J. (2011). Indigo: Egyptian Mummies to Blue Jeans. British Museum Press.",
   "Smarthistory, 'Adinkra cloth'. smarthistory.org",
   "British Museum, adinkra cloth collected in Kumasi by T. E. Bowdich in 1817. britishmuseum.org"
  ]
 },
 {
  "id": "aniline-craze",
  "title": "The aniline craze",
  "dek": "Mauve, then magenta, then a flood: coal-tar dyes made the 1860s the loudest decade in fashion yet.",
  "y": 1859,
  "e": "e4",
  "g": "western",
  "lead": [
   "In 1856 [[william-perkin|William Perkin]] made [[mauveine|mauveine]], the first aniline dye, from coal tar. Within a few years [[Mauve|mauve]] and [[Magenta|magenta]] were the colors of the moment, followed by aniline violets, blues and greens.",
   "The new dyes were bright, cheap and sometimes fugitive. Critics called them vulgar, satirists joked about 'mauve measles', and a new chemical industry was born."
  ],
  "sections": [
   {
    "title": "A purple from coal tar",
    "text": [
     "Perkin was eighteen and trying to make quinine, the malaria drug, when an experiment with aniline left a black sludge that dyed silk a bright purple. He patented it, and in 1857 his family built a factory near London to make it. He first sold it as 'Tyrian purple', borrowing the glamour of [[#history:purple-law|imperial purple]], before adopting the French fashion name mauve, from the mallow flower.",
     "'First aniline dye' is the safe claim. Chemists had made dyes in the lab before, and a synthetic yellow, picric acid, was dyeing silk in Lyon by the 1840s, but mauve was the first coal-tar dye made at industrial scale and the first famous one."
    ]
   },
   {
    "title": "The mauve mania",
    "text": [
     "The fashion for mauve actually began in Paris in 1857 with French purples made from lichens and from murexide, a dye made from bird guano. Empress Eugénie was said to think the color matched her eyes. In January 1858 Queen Victoria wore mauve velvet to her daughter's wedding, and by 1859 the London magazine Punch was mocking an epidemic of 'mauve measles'.",
     "Perkin's dye arrived on the crest of that wave. It was brighter and more stable than the lichen purples, and it made mauve ribbons and dresses affordable far beyond the court."
    ]
   },
   {
    "title": "Magenta and the flood",
    "text": [
     "In 1858–59 the French chemist François-Emmanuel Verguin made a bright red-purple from aniline and called it fuchsine, after the fuchsia flower. It was renamed after two battles of 1859 in northern Italy, Magenta and Solferino, and 'magenta' stuck.",
     "Dozens of new colors followed within a decade: Hofmann's violets, aniline blues, Bismarck brown, Martius yellow. Women's dresses of the early 1860s, wide over crinolines, show the new palette at full strength, sometimes several of these colors at once."
    ]
   },
   {
    "title": "Loved and loathed",
    "text": [
     "Not everyone was pleased. Some early aniline colors faded quickly in light or ran in the wash. Arsenic was used in making magenta, and dye works polluted rivers and wells: in the 1860s a Basel dye firm was found guilty of poisoning local wells with arsenic. William Morris later called the new colors hideous and revived natural dyes in his workshops.",
     "Painters had similar complaints about aniline lakes, which faded on canvas. The dyes were a revolution in what color cost, not yet in how long it lasted."
    ]
   },
   {
    "title": "What changed for good",
    "text": [
     "The aniline craze ended the old link between brightness and rank. A vivid purple or red no longer proved wealth, because a maid could afford a mauve ribbon. Within a generation synthetic dyes replaced madder and much indigo, and the dye works of Germany and Switzerland grew into today's chemical and drug companies.",
     "It also began the modern fashion cycle in color: a new hue appears, sweeps through every shop, and is suddenly dated."
    ]
   }
  ],
  "colors": [
   "Mauve",
   "Magenta",
   "Violet",
   "Lilac",
   "Purple",
   "Hot pink"
  ],
  "swatches": [
   [
    "#8E4A9A",
    "Perkin's mauve"
   ],
   [
    "#C2307E",
    "Fuchsine magenta"
   ],
   [
    "#6A3FA0",
    "Hofmann's violet"
   ],
   [
    "#2E4FA3",
    "Aniline blue"
   ],
   [
    "#8A4B22",
    "Bismarck brown"
   ],
   [
    "#E6B800",
    "Martius yellow"
   ]
  ],
  "facts": [
   [
    "Mauveine",
    "1856, W. H. Perkin"
   ],
   [
    "Factory opened",
    "1857, Greenford"
   ],
   [
    "Fuchsine",
    "1858–59, Verguin"
   ],
   [
    "'Mauve measles'",
    "Punch, 1859"
   ]
  ],
  "sources": [
   "Garfield, S. (2000). Mauve: How One Man Invented a Color That Changed the World. Faber & Faber.",
   "Ball, P. (2001). Bright Earth, ch. 17. Farrar, Straus and Giroux.",
   "Finlay, V. (2002). Colour: Travels Through the Paintbox. Sceptre.",
   "Science Museum Group Collection, Perkin's mauve dye and mauve-dyed silk. collection.sciencemuseumgroup.org.uk",
   "Blaszczyk, R. L. (2012). The Color Revolution. MIT Press.",
   "St Clair, K. (2016). The Secret Lives of Colour, 'Mauve'. John Murray."
  ]
 },
 {
  "id": "arsenic-green",
  "title": "Arsenic green dresses",
  "dek": "Victorian greens were dyed and dusted with arsenic. The danger was real, mostly for the workers who made them.",
  "y": 1862,
  "e": "e4",
  "g": "western",
  "lead": [
   "The brilliant greens of the 1800s, Scheele's green and [[Emerald|emerald]] green, were copper-arsenic pigments (see [[arsenic-greens|arsenic greens]]). They colored ball gowns, artificial flowers and wreaths as well as wallpaper.",
   "The people most harmed were the women and girls who made artificial flowers and dusted fabric with the powder. Claims that green wallpaper killed Napoleon remain unproven."
  ],
  "sections": [
   {
    "title": "Green that would not stay",
    "text": [
     "Before synthetic dyes, a bright, clear green was hard to get on cloth. Dyers over-dyed blue with yellow, and the yellow faded. Arsenical pigments offered something new: an intense, slightly yellow green, cheap and vivid under gaslight.",
     "But they were pigments, not dyes, and they did not bond to fiber. On fabric they were often applied as loose powder held by starch or glue, which is why they shed."
    ]
   },
   {
    "title": "Ball gowns and wreaths",
    "text": [
     "In the late 1850s and 1860s green tarlatan, a stiff, gauzy cotton, was a favorite for evening dresses, and fashionable heads wore wreaths of artificial leaves dyed green. Chemists who tested such fabric found arsenic coming off as dust. In 1862 Punch printed 'The Arsenic Waltz', a cartoon of skeletons dressed for a ball.",
     "Wearers mostly suffered rashes and sores where the fabric touched skin. The deeper danger lay upstream."
    ]
   },
   {
    "title": "The flower makers",
    "text": [
     "Artificial flowers were made in small workshops, often by young women who dusted leaves with green powder all day, breathed it and ate with unwashed hands. In 1861 Matilda Scheurer, a nineteen-year-old flower maker in London, died of arsenic poisoning; the inquest and the doctors' descriptions of her symptoms helped turn public opinion.",
     "Historians such as Alison Matthews David argue that the real 'fashion victims' were these workers, not the wealthy wearers, a pattern that repeats in later stories of dye and garment work (see [[#history:fast-fashion|fast fashion]])."
    ]
   },
   {
    "title": "How it ended",
    "text": [
     "Britain never passed a single ban on arsenical pigments, but publicity, medical warnings and new synthetic greens made them unfashionable. By the 1890s arsenical wallpapers and dress greens had largely gone. Some museums today handle surviving green garments with gloves and test them before display.",
     "Did green wallpaper kill Napoleon on St Helena? His hair contained arsenic and his rooms had green paper, but most researchers think he died of stomach cancer. The story is unproven and best told as a question."
    ]
   }
  ],
  "colors": [
   "Emerald",
   "Kelly green",
   "Lime",
   "Chartreuse",
   "Green"
  ],
  "swatches": [
   [
    "#3F9F4F",
    "Scheele's green"
   ],
   [
    "#2BA866",
    "Emerald green"
   ],
   [
    "#6FBF3F",
    "Tarlatan green"
   ],
   [
    "#9ACD32",
    "Leaf powder"
   ],
   [
    "#1F6B45",
    "Faded green"
   ]
  ],
  "facts": [
   [
    "Scheele's green",
    "1775"
   ],
   [
    "Emerald green",
    "1814, Schweinfurt"
   ],
   [
    "Flower maker's death",
    "1861, London"
   ],
   [
    "Napoleon theory",
    "Unproven"
   ]
  ],
  "sources": [
   "Matthews David, A. (2015). Fashion Victims: The Dangers of Dress Past and Present. Bloomsbury.",
   "Whorton, J. C. (2010). The Arsenic Century. Oxford University Press.",
   "Ball, P. (2001). Bright Earth, ch. 7. Farrar, Straus and Giroux.",
   "Finlay, V. (2002). Colour: Travels Through the Paintbox, ch. 'Green'. Sceptre.",
   "Bata Shoe Museum (2014–16). Fashion Victims: The Pleasures and Perils of Dress in the 19th Century (exhibition).",
   "Wellcome Collection, 'The Arsenic Waltz' (Punch, 1862), V0042226. wellcomecollection.org"
  ]
 },
 {
  "id": "mourning-dress",
  "title": "Mourning dress in the 1800s",
  "dek": "Victorian grief had a dress code: matte black crape, then grey, then mauve, timed in months.",
  "y": 1865,
  "e": "e4",
  "g": "western",
  "lead": [
   "Nineteenth-century Britain and America turned mourning into a detailed system of dress. A widow wore dull [[Black|black]] crape for a year or more, then lighter black, then 'half mourning' in [[Grey|grey]], [[Lilac|lilac]] and [[Mauve|mauve]].",
   "Queen Victoria's forty years in black after Prince Albert's death in 1861 made her the system's figurehead. It was also an industry, and it faded after the First World War, when grief became too widespread for the old rules (see [[mourning-colors|mourning colors]])."
  ],
  "sections": [
   {
    "title": "Stages measured in months",
    "text": [
     "Etiquette books laid out the rules. A widow's 'deep' or first mourning lasted a year and a day or more, in black wool or silk covered with crape, a crinkled, matte silk gauze that reflected no light. Then came second mourning, with less crape, then ordinary mourning in plain black, then half mourning, when grey, lavender, mauve and white trim returned. Some guides gave a widow two and a half years in all; a widower might need only three months.",
     "Children, parents, siblings and distant cousins each had their own shorter scales. The detail was the point: dress made grief visible and measurable."
    ]
   },
   {
    "title": "Why matte",
    "text": [
     "Shine meant celebration, so mourning avoided it. Crape was made dull by crimping silk gauze with heated rollers and gum, and black dyes for it used iron salts that could weaken the fabric over time. Jewelry had to be matte or black too: jet from Whitby in Yorkshire, a hard fossil wood, boomed after 1861.",
     "As mourning eased, shine and color came back by degrees, a little like a dimmer switch: first black silk, then grey, then the soft purples that the new [[mauveine|aniline dyes]] made cheap in the 1860s."
    ]
   },
   {
    "title": "The widow of Windsor",
    "text": [
     "When Prince Albert died in December 1861, Queen Victoria went into deep mourning and stayed in black, with white widow's caps, for the remaining forty years of her life. Her court followed strict mourning, and the public imitated her, at least in part.",
     "Her example coincided with an age of high death rates and a large middle class eager to do things properly. Mourning dress became something every respectable household had to own, ready for the next death."
    ]
   },
   {
    "title": "An industry of grief",
    "text": [
     "Specialist shops called mourning warehouses sold complete outfits at short notice; Jay's London General Mourning Warehouse opened in 1841. The textile firm Courtaulds grew rich on black crape. Department stores kept mourning departments, and dressmakers could turn out a black wardrobe in a day or two.",
     "Critics complained about the cost to poor families and the profits of the trade, and some reformers urged simpler customs well before the century ended."
    ]
   },
   {
    "title": "The end of the rules",
    "text": [
     "The First World War broke the system. With millions dead, full mourning for everyone was impossible and was seen as bad for morale; many families wore only an armband. By the 1920s black had shifted from grief toward chic (see [[#history:black|black in fashion]]). Mourning customs survive, but the timetable of colors is gone."
    ]
   }
  ],
  "colors": [
   "Black",
   "Grey",
   "Lilac",
   "Mauve",
   "Lavender",
   "White"
  ],
  "swatches": [
   [
    "#141315",
    "Crape black"
   ],
   [
    "#2B2A2E",
    "Second mourning"
   ],
   [
    "#77737A",
    "Grey"
   ],
   [
    "#B7A3C9",
    "Lavender"
   ],
   [
    "#9A7A9E",
    "Mauve"
   ],
   [
    "#F3F1EC",
    "White cap"
   ]
  ],
  "facts": [
   [
    "Deep mourning",
    "A year and a day or more"
   ],
   [
    "Fabric",
    "Black silk crape"
   ],
   [
    "Half mourning",
    "Grey, lilac, mauve"
   ],
   [
    "Victoria in black",
    "1861–1901"
   ]
  ],
  "sources": [
   "Taylor, L. (1983). Mourning Dress: A Costume and Social History. Allen & Unwin.",
   "The Metropolitan Museum of Art (2014). Death Becomes Her: A Century of Mourning Attire (exhibition and catalogue).",
   "Finlay, V. (2021). Fabric: The Hidden History of the Material World. Profile Books.",
   "Jalland, P. (1996). Death in the Victorian Family. Oxford University Press.",
   "St Clair, K. (2016). The Secret Lives of Colour, 'Heliotrope' and 'Jet'. John Murray.",
   "Garfield, S. (2000). Mauve. Faber & Faber."
  ]
 },
 {
  "id": "denim-workwear",
  "title": "Denim: work clothes first",
  "dek": "Jeans spent most of their life as sensible workwear. Rebellion came later, and only in some places.",
  "y": 1873,
  "e": "e4",
  "g": "western",
  "lead": [
   "Blue jeans are twill cotton with an [[indigo-dye|indigo]]-dyed warp and a white weft, which is why they are blue outside, paler inside, and fade at the knees. In 1873 Levi Strauss and the tailor Jacob Davis patented riveted work trousers for miners and laborers.",
   "The idea that jeans were always rebel clothing is a myth: they were practical workwear for decades, became youth rebellion in 1950s films and late-1960s Europe, and then simply everyday clothes. [[Denim|Denim]] blue is now among the most familiar colors in the world."
  ],
  "sections": [
   {
    "title": "Names with disputed roots",
    "text": [
     "Two popular etymologies tie the cloth to Europe. 'Denim' is said to come from serge de Nîmes, a twill from the French town, and 'jeans' from a sturdy fustian associated with Genoa (Gênes in French). Both are plausible, both are argued over, and historians caution that the old cloths were not the same fabric as modern denim. Treat them as likely stories, not settled facts."
    ]
   },
   {
    "title": "Rivets and a patent",
    "text": [
     "In the California gold-rush economy, Levi Strauss ran a dry-goods business in San Francisco. Jacob Davis, a tailor in Reno, had begun reinforcing the stress points of work trousers with copper rivets, and he partnered with Strauss to patent the idea; the patent was granted on 20 May 1873. Their 'waist overalls' were made in brown duck canvas and blue denim, and blue won.",
     "For decades, denim trousers, overalls and jackets were the clothes of farmers, miners, railway workers and factory hands."
    ]
   },
   {
    "title": "Why indigo, and why it fades",
    "text": [
     "Indigo does not soak all the way into cotton. It builds up in layers on the outside of the yarn, leaving the core white. As the fabric rubs, the dyed surface wears away and the white shows through, so jeans fade along creases and seams while keeping the same hue. In denim only the warp is dyed, and the twill weave puts it on the face.",
     "Synthetic indigo, sold by BASF from 1897, made the dye cheap and consistent. By mid-century, when other synthetic blues outperformed indigo for most uses, jeans became its main market."
    ]
   },
   {
    "title": "When jeans became rebellious",
    "text": [
     "In the 1950s American films such as The Wild One (1953) and Rebel Without a Cause (1955) put young stars in jeans, and some schools banned them. In Europe, the historian Michel Pastoureau argues, jeans took on their mythic, rebellious meaning mainly from the late 1960s. Jeans also crossed the Iron Curtain as a coveted Western import.",
     "Within a generation they were ordinary again: worn by presidents and grandparents, sold faded, torn or stone-washed. Pastoureau notes that for most of their history jeans meant comfort and conformity, not revolt."
    ]
   },
   {
    "title": "The cost of the blue",
    "text": [
     "Making denim look old uses a lot of resources. Stone-washing, bleaching and sandblasting, the last now banned by many brands for the lung disease it caused in workers, all wear away the indigo on purpose. Indigo dyeing itself needs chemical reducing agents, and denim mills have polluted rivers in several producing regions. Newer methods use lasers, ozone and less water (see [[#history:fast-fashion|fast fashion]])."
    ]
   }
  ],
  "colors": [
   "Denim",
   "Indigo",
   "Navy",
   "Powder blue",
   "Steel blue"
  ],
  "swatches": [
   [
    "#1F2C4D",
    "Raw indigo"
   ],
   [
    "#2F4A75",
    "Rinse wash"
   ],
   [
    "#4F6E9C",
    "Mid wash"
   ],
   [
    "#8DA5C4",
    "Light wash"
   ],
   [
    "#C9D4E2",
    "Bleached"
   ],
   [
    "#F1EEE6",
    "White weft"
   ]
  ],
  "facts": [
   [
    "Patent",
    "20 May 1873"
   ],
   [
    "Weave",
    "Twill, indigo warp"
   ],
   [
    "Synthetic indigo",
    "BASF, 1897"
   ],
   [
    "Myth",
    "'Always rebel clothing'"
   ]
  ],
  "sources": [
   "Balfour-Paul, J. (2011). Indigo: Egyptian Mummies to Blue Jeans. British Museum Press.",
   "Pastoureau, M. (2001). Blue: The History of a Color. Princeton University Press.",
   "Downey, L. (2016). Levi Strauss: The Man Who Gave Blue Jeans to the World. University of Massachusetts Press.",
   "Miller, D. & Woodward, S. (eds.) (2011). Global Denim. Berg.",
   "Sullivan, J. (2006). Jeans: A Cultural History of an American Icon. Gotham.",
   "US Patent 139,121, 'Improvement in fastening pocket-openings', J. Davis and Levi Strauss & Co., 20 May 1873."
  ]
 },
 {
  "id": "wax-prints",
  "title": "Wax prints: a Dutch, Javanese and African cloth",
  "dek": "Made in Europe, copied from Java, named and worn in West Africa. Whose cloth is it? All three.",
  "y": 1890,
  "e": "e4",
  "g": "africa",
  "lead": [
   "African wax prints are factory-printed cotton made with a wax or resin resist, in bold colors and patterns. They began in the 19th century as Dutch machine imitations of Javanese [[#history:batik-ikat|batik]], found their real market in West Africa, and became one of the continent's best-known fashions.",
   "Their story runs through colonial trade and soldiers, but the designs' names, meanings and uses were made by African traders, tailors and wearers. Many classic designs are [[Indigo|indigo]] and white; others use strong [[Gold|gold]], [[Scarlet|red]] and [[Kelly green|green]]."
  ],
  "sections": [
   {
    "title": "A machine copy of batik",
    "text": [
     "In the mid-1800s Dutch textile makers tried to undercut hand-made Javanese batik with machine printing. In Haarlem, Jean Baptiste Prévinaire adapted a banknote press to print a resin resist on both sides of the cloth, and firms such as P. F. van Vlissingen in Helmond, later Vlisco, followed. The results had flaws: the resin cracked, and dye seeped into fine veins and off-register blotches.",
     "Javanese buyers largely rejected the copies. The cloth needed another market."
    ]
   },
   {
    "title": "Why West Africa",
    "text": [
     "One thread of the story runs through soldiers. Between 1831 and 1872 the Dutch recruited several thousand men from the Gold Coast, today's Ghana, to serve in the colonial army in Indonesia. Some returned to Elmina with batik and a taste for it. Historians treat this as one factor among several, alongside Dutch and British trade routes and the long West African trade in Indian cloth.",
     "What is clear is that by the late 19th century, Dutch and then British printers were selling to the Gold Coast and its neighbors, and that the 'flaws' Javanese buyers disliked, the crackle and the irregular bleeds, were exactly what West African buyers came to prize as proof of real wax."
    ]
   },
   {
    "title": "African design and meaning",
    "text": [
     "European factories printed the cloth, but its meaning was made in markets. Traders, many of them women, chose designs, judged quality and gave patterns names, often proverbs, sayings or references to events and people, so that a cloth could say something about its wearer. In Lomé, Togo, the wax-print traders known as 'Nana Benz' became famous for their wealth in the 1950s–70s.",
     "Tailors turned the six-yard lengths into wrappers, dresses and suits, and families bought matching cloth for weddings, funerals and celebrations. A design's name can differ from country to country, and meanings shift; written lists of 'what each pattern means' are best read as snapshots, not codes."
    ]
   },
   {
    "title": "Authenticity, a live debate",
    "text": [
     "Because wax prints were designed and printed in Europe for African buyers, some critics call them a colonial product dressed up as tradition; others answer that adoption, naming and use are what make a cloth belong. The British-Nigerian artist Yinka Shonibare has made this tension his material, dressing figures in Victorian costumes cut from Dutch wax.",
     "Production has moved too. Factories in Ghana, Nigeria and Côte d'Ivoire print wax cloth, and since the 2000s large volumes of cheaper prints have come from China, raising arguments about copying and local jobs."
    ]
   },
   {
    "title": "Reading the colors",
    "text": [
     "Indigo-and-white designs remain the classic in Ghana, where indigo is associated with love and tenderness as well as mourning, depending on context. Bright multi-color prints follow fashion seasons like any other cloth. As with [[#history:kente-adinkra|kente]], it is safer to say a color has meanings in a place and moment than one fixed meaning."
    ]
   }
  ],
  "colors": [
   "Indigo",
   "Gold",
   "Scarlet",
   "Kelly green",
   "Tangerine",
   "Black"
  ],
  "swatches": [
   [
    "#1C2A63",
    "Indigo"
   ],
   [
    "#F4F0E6",
    "White"
   ],
   [
    "#E3A11B",
    "Gold"
   ],
   [
    "#C8262C",
    "Red"
   ],
   [
    "#1F8A4C",
    "Green"
   ],
   [
    "#E06A1B",
    "Orange"
   ]
  ],
  "facts": [
   [
    "Technique",
    "Machine-printed resin resist"
   ],
   [
    "Began",
    "Mid-1800s, Netherlands"
   ],
   [
    "Market",
    "West and Central Africa"
   ],
   [
    "Soldiers to Indonesia",
    "1831–1872"
   ]
  ],
  "sources": [
   "Gott, S. & Loughran, K. (eds.) (2010). Contemporary African Fashion. Indiana University Press.",
   "Sylvanus, N. (2016). Patterns in Circulation: Cloth, Gender, and Materiality in West Africa. University of Chicago Press.",
   "Kroese, W. T. (1976). The Origin of the Wax Block Prints on the Coast of West Africa. Hengelo.",
   "Finlay, V. (2021). Fabric: The Hidden History of the Material World. Profile Books.",
   "Balfour-Paul, J. (2011). Indigo: Egyptian Mummies to Blue Jeans. British Museum Press.",
   "Textile Research Centre, Leiden, 'Vlisco and West African printed textiles'. trc-leiden.nl"
  ]
 },
 {
  "id": "khaki-camo",
  "title": "Khaki, field grey and camouflage",
  "dek": "Armies once dressed to be seen. Rifles changed that, and the color of dust became the color of war.",
  "y": 1902,
  "e": "e5",
  "g": "western",
  "lead": [
   "For centuries soldiers wore bright coats, [[Scarlet|scarlet]] for the British, blue for the French, so commanders could see their troops through smoke. Accurate long-range rifles made that deadly. The answer was [[Khaki|khaki]], from a Hindustani word for dust, first worn by a British-Indian unit in 1846.",
   "Field grey, horizon blue and olive drab followed, then patterned camouflage, which later became a fashion print of its own."
  ],
  "sections": [
   {
    "title": "Dressed to be seen",
    "text": [
     "Bright uniforms had reasons. They made friend and foe easy to tell apart on a smoky battlefield, impressed civilians and enemies, and showed off a state's wealth in dye. British soldiers' red coats were dyed with madder for the ranks and costly cochineal for officers; French infantry wore madder-red trousers from 1829 until 1915."
    ]
   },
   {
    "title": "The color of dust",
    "text": [
     "In 1846 Lieutenant Harry Lumsden raised the Corps of Guides at Peshawar on the north-west frontier of British India and, with his second-in-command William Hodson, dressed them in drab cotton dyed to match the land. The color took the name khaki, from the Hindustani (originally Persian) word for dust or soil. Dyes were improvised from mud, tea, coffee and plant extracts, and early khaki varied from grey to brown.",
     "Khaki spread through British and Indian units in campaigns in India, Afghanistan and Africa. After the Boer War of 1899–1902, where marksmen picked off brightly dressed troops, the British Army adopted khaki service dress for all troops in 1902."
    ]
   },
   {
    "title": "Grey, blue and olive",
    "text": [
     "Other armies chose their own neutral colors. Germany adopted field grey (feldgrau) in 1910, the United States olive drab, Russia a greenish khaki. France went to war in 1914 in blue coats and red trousers, and after appalling losses switched in 1915 to 'horizon blue', a pale blue-grey meant to fade into the sky. The historian Michel Pastoureau suggests the red trousers cost many lives.",
     "These colors were a new kind of military color: chosen not to show anything, but to hide."
    ]
   },
   {
    "title": "Camouflage",
    "text": [
     "France formed the first dedicated camouflage unit in 1915; the word comes from a French verb for theatrical make-up. Artists painted guns, trucks and observation posts to break up their outlines. At sea, Britain and the United States painted ships in 'dazzle', bold stripes and angles that did not hide the ship but made its speed and heading hard to judge.",
     "Printed camouflage uniforms spread in the Second World War, with patterns suited to forests, deserts and snow, and later digital patterns of small pixels."
    ]
   },
   {
    "title": "From battlefield to street",
    "text": [
     "Khaki and camouflage both crossed into civilian fashion. Khaki trousers became leisure wear after the World Wars, and army-surplus jackets were cheap and durable. Vogue showed camouflage-inspired fashion in 1943, Andy Warhol made camouflage paintings in the 1980s, and camo prints in pink, blue and every other color now carry no hiding power at all, only the memory of it."
    ]
   }
  ],
  "colors": [
   "Khaki",
   "Olive",
   "Tan",
   "Sage",
   "Moss",
   "Scarlet"
  ],
  "swatches": [
   [
    "#B5A27A",
    "Khaki drab"
   ],
   [
    "#7A7356",
    "Olive drab"
   ],
   [
    "#7C7F6E",
    "Field grey"
   ],
   [
    "#8FA4BF",
    "Horizon blue"
   ],
   [
    "#B3202A",
    "Old red coat"
   ]
  ],
  "facts": [
   [
    "First khaki",
    "Corps of Guides, 1846"
   ],
   [
    "British service dress",
    "1902"
   ],
   [
    "German field grey",
    "1910"
   ],
   [
    "French horizon blue",
    "1915"
   ]
  ],
  "sources": [
   "Newark, T. (2007). Camouflage. Thames & Hudson / Imperial War Museum.",
   "Pastoureau, M. (2001). Blue: The History of a Color. Princeton University Press.",
   "Westland, S. (2024). Universal Principles of Color. Rockport.",
   "Barthorp, M. (1982). British Infantry Uniforms Since 1660. Blandford.",
   "Wikipedia, 'Khaki' and 'Corps of Guides (India)'.",
   "Forbes, P. (2009). Dazzled and Deceived: Mimicry and Camouflage. Yale University Press."
  ]
 },
 {
  "id": "pink-blue-babies",
  "title": "Pink and blue for babies",
  "dek": "Babies wore white for a century. Pink for girls came later, and the evidence is messier than the legend.",
  "y": 1918,
  "e": "e5",
  "g": "western",
  "lead": [
   "In the 1800s most babies and toddlers, boys and girls alike, wore [[White|white]] dresses that could be boiled clean. [[Baby pink|Pink]] and [[Powder blue|blue]] arrived as nursery pastels in the mid-19th century, but not yet as a code for sex.",
   "A 1918 trade article saying pink was for boys is real, but it was not the general rule; a 1927 survey found stores split. Pink for girls and blue for boys became standard in the United States around the 1940s and hardened later (see [[pink-and-blue|pink and blue]])."
  ],
  "sections": [
   {
    "title": "White, then pastels",
    "text": [
     "Small children of both sexes wore dresses until boys were 'breeched', put into trousers, somewhere between about four and seven. White cotton was practical: it could be boiled and bleached. Portraits show little boys in white frocks with sashes and ribbons of pink, blue or red, chosen to suit the child or the season, not to announce sex.",
     "The famous 18th-century pairing of Gainsborough's Blue Boy and Lawrence's Pinkie, hung together at the Huntington Library, is a museum match of two separate portraits, not a period color code."
    ]
   },
   {
    "title": "The 1918 quote",
    "text": [
     "In June 1918 the American trade magazine Earnshaw's Infants' Department told retailers that the 'generally accepted rule' was pink for boys and blue for girls, reasoning that pink was the stronger color. The quotation is genuine and much repeated.",
     "But one article is not a custom. Other sources of the same years said the opposite, and when Time magazine surveyed big American stores in 1927, they disagreed among themselves. In 2012 the psychologist Marco Del Giudice searched large collections of digitized books and found 'blue for boys, pink for girls' far more common than the reverse even before the 1940s, and called the idea of a complete flip an urban legend."
    ]
   },
   {
    "title": "How the code hardened",
    "text": [
     "The historian Jo Paoletti traces how American manufacturers and stores sorted children's clothes by sex through the 1930s and 1940s, with pink settling on girls. Colorfast washable dyes made colored baby clothes practical. After the Second World War pink became strongly feminine for adults too; Mamie Eisenhower's pink inaugural gown of 1953 is the usual emblem.",
     "A unisex trend in the 1960s and 70s softened the code, and then, Paoletti argues, prenatal sex testing in the 1980s let parents shop by sex before birth, and the pink and blue aisles returned stronger than ever."
    ]
   },
   {
    "title": "What the story teaches",
    "text": [
     "Neither 'pink was always for girls' nor 'pink used to be for boys' holds up. What the evidence shows is a slow, uneven sorting that took most of the 20th century. It is a good case for being careful with any claim that a color has always meant one thing (see [[color-psychology|color psychology]])."
    ]
   }
  ],
  "colors": [
   "Baby pink",
   "Powder blue",
   "Pink",
   "Blue",
   "White"
  ],
  "swatches": [
   [
    "#F8F6F0",
    "Nursery white"
   ],
   [
    "#F4C2C9",
    "Baby pink"
   ],
   [
    "#B6CFE6",
    "Baby blue"
   ],
   [
    "#E58FA8",
    "Rose sash"
   ],
   [
    "#7FA6D3",
    "Blue sash"
   ]
  ],
  "facts": [
   [
    "Earnshaw's article",
    "June 1918"
   ],
   [
    "Store survey",
    "Time, 1927: split"
   ],
   [
    "Became standard",
    "US, c. 1940s"
   ],
   [
    "Myth",
    "'Pink was always for girls'"
   ]
  ],
  "sources": [
   "Paoletti, J. B. (2012). Pink and Blue: Telling the Boys from the Girls in America. Indiana University Press.",
   "Del Giudice, M. (2012). The twentieth century reversal of pink-blue gender coding: a scientific urban legend? Archives of Sexual Behavior 41(6): 1321–1323.",
   "Del Giudice, M. (2017). Pink, blue, and gender: an update. Archives of Sexual Behavior 46(6): 1555–1563.",
   "Pastoureau, M. (2017). Red: The History of a Color. Princeton University Press.",
   "Smithsonian Magazine (2011). 'When Did Girls Start Wearing Pink?' smithsonianmag.com"
  ]
 },
 {
  "id": "schiaparelli",
  "title": "Schiaparelli and shocking pink",
  "dek": "In 1937 an Italian couturier in Paris named a blazing pink 'Shocking' and made it her signature.",
  "y": 1937,
  "e": "e5",
  "g": "western",
  "lead": [
   "Elsa Schiaparelli, a Paris couturier close to the Surrealists, launched a perfume called Shocking in 1937 and gave the name to the intense [[Hot pink|pink]] of its packaging. Shocking pink became her house color.",
   "Pink had been a fashionable color before, especially in 18th-century France, but Schiaparelli made a loud, saturated pink stand for wit and daring rather than sweetness, decades before it became coded as girlish (see [[#history:pink-blue-babies|pink and blue]])."
  ],
  "sections": [
   {
    "title": "A couturier among artists",
    "text": [
     "Born in Rome in 1890, Schiaparelli built her Paris house in the late 1920s on knitwear with trompe-l'oeil bows, then on evening clothes full of jokes and images. She worked with Salvador Dalí on a dress printed with a lobster and a hat shaped like a shoe, with Jean Cocteau on embroidered designs, and with the painter Leonor Fini, who designed the Shocking perfume bottle in the shape of a dressmaker's torso, said to be modeled on the actress Mae West."
    ]
   },
   {
    "title": "The color with a name",
    "text": [
     "In her memoir, Shocking Life (1954), Schiaparelli describes the color coming to her in a flash: bright, impossible and impudent, she says, and she called it shocking. Naming a color after an emotion rather than a flower or a pigment was itself a marketing invention, and the name outlived the perfume.",
     "Shocking pink was a vivid, slightly blue-leaning pink, close to what the app calls [[Hot pink|hot pink]] and some way from [[Magenta|magenta]]. It appeared on boxes, labels, linings and gowns, and the house used it for decades."
    ]
   },
   {
    "title": "Pink before and after",
    "text": [
     "Pink was not new to fashion. In 18th-century France it was a color of aristocratic pleasure, from Madame de Pompadour's porcelain to the frothy dresses of rococo painting, and men wore it as readily as women. What changed in the 20th century was its loudness: synthetic dyes could make a pink brighter than any natural rose.",
     "After the war, pink became a mass color of femininity in the United States, and later the color of Barbie. Schiaparelli's version sits apart from both: it was meant to provoke."
    ]
   },
   {
    "title": "Legacy",
    "text": [
     "Schiaparelli's house closed in 1954 and was revived in the 2010s. Her idea that a fashion house could own a color, give it a memorable name and use it as a signature runs through later fashion and branding, from Valentino's red to the trademarked colors of luxury boxes (see [[color-trademarks|color trademarks]])."
    ]
   }
  ],
  "colors": [
   "Hot pink",
   "Magenta",
   "Pink",
   "Cerise",
   "Black"
  ],
  "swatches": [
   [
    "#FC0FC0",
    "Shocking pink (screen)"
   ],
   [
    "#E4508C",
    "Faded shocking"
   ],
   [
    "#F4A7C3",
    "Rococo pink"
   ],
   [
    "#14121A",
    "Black crepe"
   ],
   [
    "#C9A54A",
    "Gold embroidery"
   ]
  ],
  "facts": [
   [
    "Shocking perfume",
    "1937"
   ],
   [
    "Bottle",
    "Leonor Fini"
   ],
   [
    "Memoir",
    "Shocking Life, 1954"
   ],
   [
    "House closed",
    "1954"
   ]
  ],
  "sources": [
   "Schiaparelli, E. (1954). Shocking Life. J. M. Dent.",
   "Blum, D. E. (2003). Shocking! The Art and Fashion of Elsa Schiaparelli. Philadelphia Museum of Art.",
   "Koda, H. & Bolton, A. (2012). Schiaparelli and Prada: Impossible Conversations. The Metropolitan Museum of Art.",
   "Maison Schiaparelli, 'Leonor Fini: Shocking perfume bottle'. schiaparelli.com",
   "St Clair, K. (2016). The Secret Lives of Colour, 'Shocking pink'. John Murray."
  ]
 },
 {
  "id": "new-look",
  "title": "Dior's New Look and postwar color",
  "dek": "After rationing, Dior's 1947 collection spent fabric lavishly. Its palette was quieter than its shape.",
  "y": 1947,
  "e": "e5",
  "g": "western",
  "lead": [
   "On 12 February 1947 Christian Dior showed his first collection in Paris: soft shoulders, tiny waists, long, full skirts using many meters of cloth. The editor Carmel Snow is reported to have called it a new look, and the name stuck.",
   "Its best-known outfit, the Bar suit, paired a pale natural silk jacket with a pleated [[Black|black]] skirt. Dior loved [[Grey|grey]], [[Navy|navy]] and black, with pink and red as accents; the shock of the New Look was abundance, not color."
  ],
  "sections": [
   {
    "title": "After rationing",
    "text": [
     "During the Second World War clothing was rationed in Britain from 1941, and the Utility scheme set rules for how much fabric a garment could use. In the United States, regulation L-85 limited skirt widths, hems and trims. Fashion became short, narrow and practical, in colors dyers could get: navies, browns, greens and greys, with bright touches in hats and scarves.",
     "Postwar Europe still had shortages, and Britain kept clothes rationing until 1949."
    ]
   },
   {
    "title": "The look",
    "text": [
     "Dior's 'Corolle' line, named for the petals of a flower, put women back into padded hips, boned bodices and skirts that could take many meters of fabric. The Bar suit, now in museum collections, set a pale shantung jacket with a peplum over a black wool skirt.",
     "The reaction was mixed. Fashion editors were thrilled; some politicians and many women objected to the waste of cloth and the return of corsetry, and there are stories of models being heckled in Paris streets during a photo shoot. The look won anyway and shaped the silhouette of the 1950s."
    ]
   },
   {
    "title": "Dior's colors",
    "text": [
     "Dior's palette was famously restrained. He wrote fondly of grey as an elegant neutral and used it for his salons; navy and black were staples; and he gave each season a few signature accents, often pinks and reds. In his Little Dictionary of Fashion (1954) he treats color as something to use carefully, with a strong preference for clear, simple combinations.",
     "The luxury of the New Look was in volume, cut and fabric quality. Color was the frame."
    ]
   },
   {
    "title": "The 1950s palette",
    "text": [
     "In the following decade, color returned through new materials. Nylon, acrylic and polyester took synthetic dyes in clear pastels; ready-to-wear and mail-order catalogs spread coordinated sets of colors for clothes, kitchens and cars. Color forecasting services grew to match (see [[#history:forecasting|color forecasting]]).",
     "Pastel pink, turquoise and mint now read as 'the fifties'; in their own time they were simply what modern dyes and fibers did well."
    ]
   }
  ],
  "colors": [
   "Black",
   "Grey",
   "Navy",
   "Cream",
   "Baby pink",
   "Scarlet"
  ],
  "swatches": [
   [
    "#E9DFC8",
    "Shantung jacket"
   ],
   [
    "#141416",
    "Black wool skirt"
   ],
   [
    "#8E8E91",
    "Dior grey"
   ],
   [
    "#1E2848",
    "Navy"
   ],
   [
    "#E7A9B5",
    "Pink accent"
   ],
   [
    "#B32630",
    "Red accent"
   ]
  ],
  "facts": [
   [
    "First show",
    "12 February 1947"
   ],
   [
    "Line",
    "Corolle"
   ],
   [
    "Famous outfit",
    "Bar suit"
   ],
   [
    "UK rationing ended",
    "1949"
   ]
  ],
  "sources": [
   "Dior, C. (1954). The Little Dictionary of Fashion. Cassell (reprinted V&A, 2007).",
   "Wilcox, C. (ed.) (2007). The Golden Age of Couture: Paris and London 1947–57. V&A Publishing.",
   "Palmer, A. (2009). Dior: A New Look, a New Enterprise (1947–57). V&A Publishing.",
   "Summers, J. (2015). Fashion on the Ration: Style in the Second World War. Profile Books.",
   "Victoria and Albert Museum, 'Christian Dior: Designer of Dreams' (2019) and 'The Bar suit'. vam.ac.uk"
  ]
 },
 {
  "id": "sixties",
  "title": "1960s: mod, space age and psychedelia",
  "dek": "The decade went from white space-age minimalism to Day-Glo swirls, then turned dusky and brown by 1970.",
  "y": 1966,
  "e": "e5",
  "g": "western",
  "lead": [
   "The 1960s ran through several palettes fast. Early mod London liked crisp black and white and primary blocks; Paris couturiers showed space-age [[White|white]] and silver; by 1966–67 psychedelic posters and clothes glowed with fluorescent pinks, oranges and greens.",
   "By the end of the decade taste had swung to muted [[Plum|plums]], [[Mustard|mustards]] and browns, the palette of the London store Biba and of the 1970s."
  ],
  "sections": [
   {
    "title": "Mod and black-and-white",
    "text": [
     "In London, Mary Quant's shop Bazaar, opened in 1955, sold short, simple clothes to young women, and by the mid-1960s the miniskirt was a symbol of the city. Mod style favored sharp contrasts: black and white, navy and white, and bold flat blocks of red, yellow and blue. Op art, the optical painting of Bridget Riley and Victor Vasarely, was printed onto dresses, sometimes without the artists' consent."
    ]
   },
   {
    "title": "Space age",
    "text": [
     "In Paris, André Courrèges showed his 1964 'Space Age' collection: white trouser suits, white boots and short, structured dresses, alongside Pierre Cardin's geometric shapes and Paco Rabanne's dresses of linked plastic and metal discs. White and silver suggested the future, clean and unadorned.",
     "In 1965 Yves Saint Laurent turned Piet Mondrian's grids of red, yellow and blue into a collection of shift dresses, one of the best-known meetings of fashion and modern art."
    ]
   },
   {
    "title": "Turning on the color",
    "text": [
     "From about 1966 the counterculture brought a different color sense. Concert posters in San Francisco used clashing complementary colors that seemed to vibrate. Fluorescent Day-Glo pigments, invented in the 1930s, glowed under ultraviolet light at clubs and concerts. Tie-dye, an old resist technique, became a home-made symbol of the era.",
     "Men's clothes, dark for a century, exploded into velvet, florals and bright shirts in what journalists called the 'peacock revolution'."
    ]
   },
   {
    "title": "Dusk at Biba",
    "text": [
     "Barbara Hulanicki's Biba, which began as a mail-order business in 1964 and became a London department store, sold a darker, nostalgic palette: plum, mulberry, rust, mustard and muddy browns, with art deco and Victorian influences. A color forecaster later linked mauve with Biba and the 1970s.",
     "That turn, from bright and futuristic to dusky and historical, set up the earth tones of the next decade."
    ]
   }
  ],
  "colors": [
   "White",
   "Silver",
   "Hot pink",
   "Tangerine",
   "Lime",
   "Plum",
   "Mustard",
   "Rust"
  ],
  "swatches": [
   [
    "#F5F5F3",
    "Courrèges white"
   ],
   [
    "#BFC2C7",
    "Silver"
   ],
   [
    "#FF3EA5",
    "Day-Glo pink"
   ],
   [
    "#FF8C1A",
    "Fluorescent orange"
   ],
   [
    "#8E4A6E",
    "Biba plum"
   ],
   [
    "#C49A2C",
    "Mustard"
   ]
  ],
  "facts": [
   [
    "Bazaar opened",
    "1955, London"
   ],
   [
    "Space Age",
    "Courrèges, 1964"
   ],
   [
    "Mondrian dresses",
    "Saint Laurent, 1965"
   ],
   [
    "Biba",
    "From 1964"
   ]
  ],
  "sources": [
   "Breward, C., Gilbert, D. & Lister, J. (eds.) (2006). Swinging Sixties: Fashion in London and Beyond 1955–1970. V&A Publishing.",
   "Rose, J. (ed.) (2019). Mary Quant. V&A Publishing.",
   "Hulanicki, B. (1983). From A to Biba. Hutchinson.",
   "Livingstone, M. (2014). Vision and Art: The Biology of Seeing. Abrams.",
   "Garfield, S. (2000). Mauve. Faber & Faber.",
   "The Metropolitan Museum of Art, Heilbrunn Timeline: 'Yves Saint Laurent (1936–2008)'. metmuseum.org"
  ]
 },
 {
  "id": "punk",
  "title": "Punk and black",
  "dek": "Punk wore black leather, torn tartan and safety pins, then splashed on fluorescent pink and green.",
  "y": 1977,
  "e": "e5",
  "g": "western",
  "lead": [
   "Punk in mid-1970s London and New York took [[Black|black]], the color of leather jackets, bikers and bohemians, and made it the uniform of refusal. It mixed black with ripped tartan, safety pins and slogans, and with dyed hair and graphics in loud [[Hot pink|pink]], [[Chartreuse|acid yellow]] and green.",
   "Black's role as a rebel color had a long run-up, from Romantic melancholy to 1950s bikers and existentialists (see [[#history:black|black in fashion]])."
  ],
  "sections": [
   {
    "title": "Black's rebel pedigree",
    "text": [
     "Before punk, black already meant dissent. Romantic poets cultivated black melancholy; 19th-century anarchists flew black flags; 1950s bikers wore black leather jackets, an image fixed by Marlon Brando in The Wild One (1953); Left Bank existentialists and beatniks wore black sweaters. Each borrowed black's seriousness and turned it against respectability."
    ]
   },
   {
    "title": "King's Road",
    "text": [
     "In London, Vivienne Westwood and Malcolm McLaren ran a shop at 430 King's Road, renamed SEX in 1974 and Seditionaries in 1976. They sold bondage trousers, rubber and leather, T-shirts with provocative prints, and clothes that looked torn and pinned back together. The Sex Pistols, managed by McLaren, wore their clothes.",
     "Punk's look was partly do-it-yourself: secondhand clothes, school blazers, safety pins and paint, more about attitude than any single color."
    ]
   },
   {
    "title": "Fluorescent on black",
    "text": [
     "Against the black, punk used deliberately cheap, synthetic brightness. Jamie Reid's sleeve for the Sex Pistols' album Never Mind the Bollocks (1977) set black lettering on fluorescent yellow and pink, ransom-note style. Hair was dyed in colors no hairdresser had sold before. The effect mocked good taste, which had been training people since the 1950s to avoid clashing brights."
    ]
   },
   {
    "title": "After punk",
    "text": [
     "Punk splintered into goth, new romantic and hardcore, each with its own color codes; goth kept the black and added velvet, lace and pale skin. In the early 1980s Japanese designers brought sculptural, deep black to Paris runways, and black became the uniform of designers and art students.",
     "Museum shows such as the Met's 'Punk: Chaos to Couture' (2013) turned punk into fashion history, which says something about how quickly rebellion becomes a style."
    ]
   }
  ],
  "colors": [
   "Black",
   "Hot pink",
   "Chartreuse",
   "Scarlet",
   "Charcoal"
  ],
  "swatches": [
   [
    "#101012",
    "Leather black"
   ],
   [
    "#FF3EA5",
    "Fluorescent pink"
   ],
   [
    "#E8F021",
    "Acid yellow"
   ],
   [
    "#B3202A",
    "Tartan red"
   ],
   [
    "#2B5E3B",
    "Tartan green"
   ]
  ],
  "facts": [
   [
    "SEX shop",
    "1974, 430 King's Road"
   ],
   [
    "Seditionaries",
    "1976"
   ],
   [
    "Album sleeve",
    "Jamie Reid, 1977"
   ],
   [
    "Met exhibition",
    "2013"
   ]
  ],
  "sources": [
   "Bolton, A. (2013). Punk: Chaos to Couture. The Metropolitan Museum of Art.",
   "Hebdige, D. (1979). Subculture: The Meaning of Style. Methuen.",
   "Pastoureau, M. (2009). Black: The History of a Color. Princeton University Press.",
   "Westwood, V. & Kelly, I. (2014). Vivienne Westwood. Picador.",
   "Victoria and Albert Museum, 'Vivienne Westwood: an introduction'. vam.ac.uk"
  ]
 },
 {
  "id": "forecasting",
  "title": "Who decides next year's colors?",
  "dek": "Panels and agencies predict fashion colors two years ahead. Their power is easy to overstate.",
  "y": 2000,
  "e": "e5",
  "g": "western",
  "lead": [
   "Dyeing yarn and weaving cloth take time, so the textile industry has long agreed on colors a season or two ahead. Color cards, trade associations and forecasting agencies grew up to make those guesses. Pantone's [[color-of-the-year|Color of the Year]] (since 2000) is the public face; trend services like WGSN sell the detailed forecasts.",
   "Forecasts can become self-fulfilling when factories and retailers follow them. But fashion also ignores forecasts, and there is little hard evidence on how much any single announcement changes what people buy."
  ],
  "sections": [
   {
    "title": "Why forecast at all",
    "text": [
     "A garment in a shop in spring was designed a year earlier, and its yarn was dyed months before that. Dye houses, mills, button makers and retailers all need to agree on a palette long before customers see it. In the 19th century French silk makers in Lyon set much of the pace; by the early 20th century, industry groups issued color cards to coordinate.",
     "The Textile Color Card Association of the United States, founded in 1915, published standard and seasonal colors. Its forecaster Margaret Hayden Rorke was among the most influential color experts of the 1920s and 30s."
    ]
   },
   {
    "title": "How a forecast is made",
    "text": [
     "Today's forecasters work from many signals: what sold last season, runway shows, street style, art exhibitions, films, consumer research and the mood of the news. Panels from national color associations meet to debate and agree a set of directions; the international group Intercolor, founded in 1963, does this for member countries two years ahead. Agencies such as WGSN, founded in London in 1998, sell reports to brands.",
     "The result is a palette with names and stories rather than a single prediction, and it is revised as the season approaches."
    ]
   },
   {
    "title": "Color of the Year",
    "text": [
     "Pantone, the color-matching company built by Lawrence Herbert in the 1960s, began naming a Color of the Year for 2000 with Cerulean, a pale sky blue. The choice is announced each December with a story about the times and a run of licensed products. It is a forecast and a marketing event at once, and Pantone does not publish evidence of its effect on sales."
    ]
   },
   {
    "title": "Influence, honestly",
    "text": [
     "There are two honest views. One is that forecasting coordinates an industry that would otherwise make clashing, unsellable stock, so its influence is real but mostly upstream, at the mill. The other is that announcements like the Color of the Year mostly reflect colors already rising. Both can be true, and the film monologue about a 'cerulean' sweater trickling down from couture to discount bins is a good story but fiction.",
     "For a shopper, the useful lesson is that the colors in stores are partly chosen for you, years ahead, by people guessing what you will want."
    ]
   }
  ],
  "colors": [
   "Cerulean",
   "Coral",
   "Peach",
   "Mustard",
   "Sage"
  ],
  "swatches": [
   [
    "#98B4D4",
    "Cerulean 2000"
   ],
   [
    "#FF6F61",
    "Living Coral 2019"
   ],
   [
    "#0F4C81",
    "Classic Blue 2020"
   ],
   [
    "#FFBE98",
    "Peach Fuzz 2024"
   ],
   [
    "#A47864",
    "Mocha Mousse 2025"
   ]
  ],
  "facts": [
   [
    "US color card association",
    "1915"
   ],
   [
    "Intercolor",
    "1963"
   ],
   [
    "WGSN",
    "1998, London"
   ],
   [
    "First Color of the Year",
    "Cerulean, 2000"
   ]
  ],
  "sources": [
   "Blaszczyk, R. L. (2012). The Color Revolution. MIT Press.",
   "Diane, T. & Cassidy, T. (2005). Colour Forecasting. Blackwell.",
   "Westland, S. (2024). Universal Principles of Color. Rockport.",
   "Pantone, 'Color of the Year' archive. pantone.com",
   "WGSN, 'About'. wgsn.com"
  ]
 },
 {
  "id": "fast-fashion",
  "title": "Fast fashion and the cost of dye",
  "dek": "Cheap clothes come in every color. The dyeing and finishing behind them is one of industry's dirtiest steps.",
  "y": 2017,
  "e": "e5",
  "g": "western",
  "lead": [
   "Since about 2000, clothing production has roughly doubled while each garment is worn fewer times, according to the Ellen MacArthur Foundation's 2017 report. Most textile dyes are synthetic and made from fossil fuels, and dyeing and finishing use large amounts of water, energy and chemicals.",
   "A figure that textiles cause about 20% of industrial water pollution is widely quoted, often credited to the World Bank, but its original source is hard to trace; treat it as an estimate. Natural dyes are not automatically greener."
  ],
  "sections": [
   {
    "title": "Faster cycles, more clothes",
    "text": [
     "Fast fashion brands moved from two or four seasons a year to new stock every few weeks, made possible by global supply chains and cheap synthetic fibers. The Ellen MacArthur Foundation estimated in 2017 that clothing production doubled between 2000 and 2014, that the number of times a garment is worn fell, and that less than 1% of material used to make clothing is recycled into new clothing.",
     "Many garments now end up in landfills, incinerators or secondhand markets abroad. Reporting from the Kantamanto market in Accra and from desert dumps in northern Chile has shown what happens to the surplus."
    ]
   },
   {
    "title": "Where the color goes",
    "text": [
     "Dyeing is chemistry in water. Cloth is scoured, bleached, dyed, fixed and finished in baths that, if untreated, carry unfixed dye, salts, heavy metals and finishing chemicals into rivers. Rivers near textile clusters, such as parts of the Citarum in Indonesia or around Dhaka in Bangladesh, have been documented running colored with effluent. Treatment plants exist but cost money to run, and enforcement is uneven.",
     "Some dyes are themselves hazardous. The European Union restricts azo dyes that can release cancer-linked amines, and campaigns have pushed brands to drop other harmful finishing chemicals."
    ]
   },
   {
    "title": "Not just a modern problem",
    "text": [
     "Dye pollution is as old as dyeing. Ancient purple works stank so much they sat downwind of towns, medieval dyers were kept outside city walls, and in the 1860s a Swiss aniline dye works poisoned local wells with arsenic (see [[#history:aniline-craze|the aniline craze]]). Workers have carried much of the cost, from flower makers in the 1800s (see [[#history:arsenic-green|arsenic green dresses]]) to denim sandblasters in recent decades.",
     "What is new is the scale."
    ]
   },
   {
    "title": "What helps, with caveats",
    "text": [
     "Proposed fixes include dyeing with less water (dope-dyeing synthetic fibers before spinning, waterless processes using supercritical carbon dioxide), closed-loop treatment, digital printing, and simply making and buying fewer, longer-lasting clothes. Natural dyes appeal, but many need metal mordants, land and large amounts of plant material, so they are not a simple replacement at today's volumes.",
     "Claims about which fix matters most are often made with confident numbers that trace back to thin sources. The safest summary is that the biggest lever is volume: fewer garments, worn more times."
    ]
   }
  ],
  "colors": [
   "Indigo",
   "Hot pink",
   "Black",
   "Khaki",
   "Teal"
  ],
  "swatches": [
   [
    "#1F2C4D",
    "Indigo effluent"
   ],
   [
    "#C2307E",
    "Reactive magenta"
   ],
   [
    "#14161A",
    "Sulfur black"
   ],
   [
    "#5E6B4E",
    "River green"
   ],
   [
    "#8E8A80",
    "Undyed grey"
   ]
  ],
  "facts": [
   [
    "Production 2000–2014",
    "Roughly doubled (EMF)"
   ],
   [
    "Recycled into new clothes",
    "Under 1% (EMF)"
   ],
   [
    "'20% of water pollution'",
    "Widely cited, poorly sourced"
   ],
   [
    "Biggest lever",
    "Fewer garments"
   ]
  ],
  "sources": [
   "Ellen MacArthur Foundation (2017). A New Textiles Economy: Redesigning Fashion's Future. ellenmacarthurfoundation.org",
   "Matthews David, A. (2015). Fashion Victims: The Dangers of Dress Past and Present. Bloomsbury.",
   "Thomas, D. (2019). Fashionopolis: The Price of Fast Fashion and the Future of Clothes. Penguin Press.",
   "Niinimäki, K. et al. (2020). The environmental price of fast fashion. Nature Reviews Earth & Environment 1: 189–200.",
   "European Union, REACH Annex XVII, entry 43 (azo colourants). echa.europa.eu",
   "Westland, S. (2024). Universal Principles of Color. Rockport."
  ]
 }
];
