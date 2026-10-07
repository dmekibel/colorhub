// ColorHub curriculum data.
// Each color: n name, h hex, vs the neighbor it is compared with (same unit or an earlier one),
// d how it differs from that neighbor, o origin of the name (only when it is solid), src where the hex came from:
//   css  = CSS named color      wiki = Wikipedia "List of colors"      xkcd = xkcd color survey (2010)
//   pick = chosen between those references because the standard value is not what people picture
// Hex values are screen approximations. tools/check.js verifies that no two colors in a unit are too close to tell apart.
window.DATA = {
basics: [
  ["Red","#D62F2F"],["Orange","#F07A1A"],["Yellow","#F2C81F"],["Green","#2E9A4F"],["Blue","#2563C9"],["Purple","#7B3FA0"],
  ["Pink","#F28DB2"],["Brown","#7A5230"],["Grey","#8C9096"],["Black","#16171A"],["White","#F7F6F2"]
],
tiers: {
  2: { name: "The in-betweens", short: "In-betweens", blurb: "The everyday words between the basics: teal, maroon, beige, mauve." },
  3: { name: "The designer's vocabulary", short: "Designer's vocabulary", blurb: "The precise names painters and designers use: cerulean, vermilion, ochre." }
},
units: [
{ id:"t2-blues", tier:2, title:"Blues", colors:[
  {n:"Navy", h:"#1C2B5A", src:"pick", vs:"Royal blue", d:"Far darker and greyer than royal blue, nearly black.", o:"From naval uniforms, dyed dark to resist sun and sea. Between 1910 and 1950 it replaced black for police, postmen and men's suits."},
  {n:"Royal blue", h:"#4169E1", src:"css", vs:"Navy", d:"A bright, deep blue, much lighter and more vivid than navy."},
  {n:"Sky blue", h:"#87CEEB", src:"css", vs:"Aqua", d:"Softer than aqua, without its green tint."},
  {n:"Periwinkle", h:"#A3A8EE", src:"pick", vs:"Sky blue", d:"Sky blue with a drop of violet.", o:"Named after the periwinkle flower."},
  {n:"Turquoise", h:"#40E0D0", src:"css", vs:"Aqua", d:"Greener and a little deeper than aqua.", o:"After the stone. Turquoise is French for 'Turkish': Europeans thought the stone came from Turkey, though most came from Persia."},
  {n:"Teal", h:"#008080", src:"css", vs:"Turquoise", d:"Much darker than turquoise, and slightly bluer.", o:"Named after the teal duck, which has a stripe of this color on its head."},
  {n:"Aqua", h:"#00FFFF", src:"css", vs:"Turquoise", d:"Brighter and bluer than turquoise. On screens it is the same as cyan.", o:"Latin for water."}
]},
{ id:"t2-reds", tier:2, title:"Reds & pinks", colors:[
  {n:"Scarlet", h:"#FF2400", src:"wiki", vs:"Crimson", d:"A bright red leaning orange. Crimson leans the other way, toward blue.", o:"First the name of a luxury wool cloth that could be any color, even blue or black. The best was dyed with kermes, so by the 1300s the word meant the red."},
  {n:"Crimson", h:"#DC143C", src:"css", vs:"Scarlet", d:"Deeper than scarlet, leaning toward purple.", o:"From kermes, an insect dye. The word goes back through Arabic qirmiz to a Sanskrit word for 'worm'."},
  {n:"Maroon", h:"#800000", src:"css", vs:"Burgundy", d:"A dark brownish red. Burgundy is more purple.", o:"From the French marron, chestnut."},
  {n:"Burgundy", h:"#800020", src:"wiki", vs:"Maroon", d:"Dark red with a purple, wine-like tint. Maroon is browner.", o:"Named after the red wine of Burgundy, France."},
  {n:"Coral", h:"#FF7F50", src:"css", vs:"Salmon", d:"More orange and more vivid than salmon.", o:"After red coral, worn as jewelry for thousands of years."},
  {n:"Salmon", h:"#FA8072", src:"css", vs:"Coral", d:"Pinker and softer than coral.", o:"The color of salmon flesh."},
  {n:"Baby pink", h:"#F4C2C2", src:"wiki", vs:"Hot pink", d:"A pale, quiet pink, far lighter and softer than hot pink.", o:"Pink for girls is recent. In 1918 a trade paper called pink the stronger color, better for boys; the rule settled only in the mid-1900s."},
  {n:"Hot pink", h:"#FF69B4", src:"css", vs:"Magenta", d:"Pinker and softer than magenta, with no purple in it."},
  {n:"Magenta", h:"#FF00FF", src:"css", vs:"Hot pink", d:"Purple-pink at full strength, more violet than hot pink.", o:"The 1858 aniline dye was first called fuchsine, then renamed for the bloody Battle of Magenta (1859). On screens, fuchsia is the same color."}
]},
{ id:"t2-greens", tier:2, title:"Greens", colors:[
  {n:"Lime", h:"#BFFF00", src:"wiki", vs:"Kelly green", d:"A bright yellow-green, much lighter and yellower than kelly green.", o:"The color of lime peel."},
  {n:"Mint", h:"#A8EBC4", src:"pick", vs:"Emerald", d:"Much paler and softer than emerald, slightly cooler.", o:"Named after the herb."},
  {n:"Kelly green", h:"#4CBB17", src:"wiki", vs:"Emerald", d:"A vivid grass green, yellower than emerald.", o:"After the common Irish surname Kelly; the name dates from the early 1900s. Ireland's green is younger than it seems: St Patrick's color was blue until the 1700s."},
  {n:"Emerald", h:"#50C878", src:"wiki", vs:"Kelly green", d:"Cooler and bluer than kelly green.", o:"Named after the gemstone. 'Emerald green' paint (1814) was made with copper and arsenic and colored Victorian wallpapers."},
  {n:"Sage", h:"#9CAF88", src:"pick", vs:"Mint", d:"Greyer and darker than mint, and a little yellower.", o:"After the grey-green leaves of the sage herb."},
  {n:"Olive", h:"#808000", src:"css", vs:"Forest green", d:"A yellowish dark green. Forest green is greener.", o:"The color of green olives."},
  {n:"Forest green", h:"#228B22", src:"css", vs:"Kelly green", d:"Darker and deeper than kelly green."}
]},
{ id:"t2-purples", tier:2, title:"Purples", colors:[
  {n:"Lavender", h:"#BFA2E8", src:"pick", vs:"Lilac", d:"Bluer and brighter than lilac.", o:"Named after the lavender flower."},
  {n:"Lilac", h:"#C8A2C8", src:"wiki", vs:"Lavender", d:"Pinker and greyer than lavender.", o:"After the lilac flower."},
  {n:"Mauve", h:"#A8778F", src:"pick", vs:"Lilac", d:"A dusty pink-purple, darker and pinker than lilac.", o:"French for the mallow flower. In 1856 an 18-year-old chemist, William Perkin, made mauveine, the first aniline dye, and mauve became a craze."},
  {n:"Plum", h:"#8E4585", src:"wiki", vs:"Mauve", d:"Deeper and richer than mauve.", o:"After the fruit's skin."},
  {n:"Violet", h:"#8000FF", src:"wiki", vs:"Indigo", d:"A vivid blue-purple, far brighter than indigo.", o:"Named after the flower. Newton's first spectrum ended in 'purple'; he later called the far end violet."},
  {n:"Indigo", h:"#3D2B8E", src:"pick", vs:"Violet", d:"Darker and bluer than violet.", o:"From the plant dye; the name is Greek for 'from India'. Newton added it to the rainbow probably to get seven colors, one for each note of the musical scale."}
]},
{ id:"t2-earths", tier:2, title:"Yellows & browns", colors:[
  {n:"Gold", h:"#FFD700", src:"css", vs:"Mustard", d:"A bright, warm yellow, cleaner and lighter than mustard.", o:"Medieval gold leaf was beaten from coins, about a hundred leaves from one ducat."},
  {n:"Mustard", h:"#CFA41C", src:"pick", vs:"Gold", d:"A darker, earthier yellow than gold.", o:"The color of the condiment, made from mustard seed."},
  {n:"Khaki", h:"#BDB76B", src:"css", vs:"Tan", d:"Greener than tan, with an olive tinge.", o:"From the Persian and Urdu word for dust. British troops in India dyed their uniforms this color."},
  {n:"Tan", h:"#D2B48C", src:"css", vs:"Khaki", d:"Warmer and softer than khaki, like light leather.", o:"From tanbark, the oak bark used to tan leather."},
  {n:"Rust", h:"#B7410E", src:"wiki", vs:"Chocolate", d:"An orange-red brown, brighter and lighter than chocolate.", o:"The color of iron oxide."},
  {n:"Chocolate", h:"#7B3F00", src:"wiki", vs:"Rust", d:"A deep brown, darker than rust and less red."}
]},
{ id:"t2-neutrals", tier:2, title:"Whites & greys", colors:[
  {n:"Ivory", h:"#FFFFF0", src:"css", vs:"Cream", d:"Almost white, with only a hint of yellow. Cream is yellower.", o:"After elephant tusks."},
  {n:"Cream", h:"#FFFDD0", src:"wiki", vs:"Ivory", d:"Yellower than ivory.", o:"After the cream that rises on fresh milk."},
  {n:"Beige", h:"#E6D5B0", src:"pick", vs:"Cream", d:"Darker and sandier than cream.", o:"French for undyed wool. In 2002 astronomers averaged the light of 200,000 galaxies; the universe came out beige."},
  {n:"Taupe", h:"#8E7F71", src:"pick", vs:"Slate", d:"A brownish grey. Slate is a bluish grey.", o:"French for mole. Real mole fur is a cold dark grey; the color name has drifted toward brown."},
  {n:"Silver", h:"#C0C0C0", src:"css", vs:"Slate", d:"A clean light grey with no tint, much lighter than slate.", o:"A flat screen stand-in for the shiny metal."},
  {n:"Slate", h:"#708090", src:"css", vs:"Charcoal", d:"A mid grey with a blue tint, lighter than charcoal.", o:"After slate rock, split into roof tiles."},
  {n:"Charcoal", h:"#36454F", src:"wiki", vs:"Slate", d:"A very dark grey with a touch of blue, darker than slate.", o:"After burnt wood."}
]},
{ id:"t3-blues", tier:3, title:"Blues", colors:[
  {n:"Powder blue", h:"#B0E0E6", src:"css", vs:"Sky blue", d:"Paler and greyer than sky blue."},
  {n:"Cornflower", h:"#6495ED", src:"css", vs:"Azure", d:"Softer and lighter than azure.", o:"After the blue petals of the cornflower."},
  {n:"Azure", h:"#007FFF", src:"wiki", vs:"Cornflower", d:"A bright, clear blue, more vivid than cornflower.", o:"From Persian lazhward, the source of lapis lazuli. Blue was on 1 in 20 European coats of arms in 1200, and nearly 1 in 3 by 1400."},
  {n:"Cerulean", h:"#007BA7", src:"wiki", vs:"Steel blue", d:"Greener than steel blue, leaning toward teal.", o:"From Latin caeruleus, sky blue. As a paint made of cobalt and tin it reached artists in the 1860s; Monet and Signac used it heavily."},
  {n:"Cobalt", h:"#0047AB", src:"pick", vs:"Denim", d:"A deep, vivid blue, much brighter than denim.", o:"Named for the kobold, a mine goblin blamed for poisoning Saxon silver miners. Thénard made it into a pure blue paint in 1802."},
  {n:"Steel blue", h:"#4682B4", src:"css", vs:"Azure", d:"Greyer and calmer than azure."},
  {n:"Denim", h:"#3B638C", src:"xkcd", vs:"Cobalt", d:"Greyer and duller than cobalt, like worn jeans.", o:"Probably from French serge de Nîmes, a twill from Nîmes, though the origin is debated."},
  {n:"Petrol", h:"#005F6A", src:"xkcd", vs:"Teal", d:"Darker and bluer than teal."},
  {n:"Midnight blue", h:"#191970", src:"css", vs:"Navy", d:"Darker, richer and more violet than navy."}
]},
{ id:"t3-reds", tier:3, title:"Reds", colors:[
  {n:"Vermilion", h:"#E34234", src:"wiki", vs:"Scarlet", d:"A warm orange-red, softer than scarlet.", o:"Mercury sulfide red. The Romans ground it from cinnabar ore; from the Middle Ages it was made by heating mercury with sulfur. The name is Latin for 'little worm', after an insect dye."},
  {n:"Carmine", h:"#960018", src:"wiki", vs:"Crimson", d:"A deep red, darker than crimson.", o:"Made from cochineal insects, about 70,000 to a pound of dye. It still colors food as E120."},
  {n:"Oxblood", h:"#4A0000", src:"wiki", vs:"Burgundy", d:"Darker than burgundy, a nearly black red."},
  {n:"Brick", h:"#A03623", src:"xkcd", vs:"Rust", d:"Darker and duller than rust, and a touch redder.", o:"The color of fired clay bricks."},
  {n:"Cerise", h:"#DE3163", src:"wiki", vs:"Crimson", d:"Pinker than crimson.", o:"French for cherry."},
  {n:"Raspberry", h:"#B00149", src:"xkcd", vs:"Cerise", d:"A deep pink-red, darker than cerise."}
]},
{ id:"t3-oranges", tier:3, title:"Oranges & yellows", colors:[
  {n:"Peach", h:"#FFCBA4", src:"wiki", vs:"Apricot", d:"Paler and softer than apricot."},
  {n:"Apricot", h:"#FFB16D", src:"xkcd", vs:"Peach", d:"A deeper, stronger orange than peach."},
  {n:"Tangerine", h:"#F28500", src:"wiki", vs:"Burnt orange", d:"Lighter and yellower than burnt orange.", o:"After the fruit, named for Tangier in Morocco."},
  {n:"Burnt orange", h:"#CC5500", src:"wiki", vs:"Tangerine", d:"Darker and redder than tangerine."},
  {n:"Ochre", h:"#CC7722", src:"wiki", vs:"Tangerine", d:"Duller, browner and darker than tangerine.", o:"An iron-rich earth, one of the oldest pigments. Heating yellow ochre turns it red, a trick cave painters already used."},
  {n:"Marigold", h:"#EAA221", src:"wiki", vs:"Amber", d:"Darker and more orange than amber.", o:"After the marigold flower."},
  {n:"Amber", h:"#FFBF00", src:"wiki", vs:"Gold", d:"More orange than gold.", o:"After fossil tree resin. The Greeks called amber elektron, which gave us 'electricity'."},
  {n:"Canary", h:"#FFEF00", src:"wiki", vs:"Gold", d:"Lighter and greener than gold, a pure yellow.", o:"After the canary bird."}
]},
{ id:"t3-greens", tier:3, title:"Greens", colors:[
  {n:"Chartreuse", h:"#7FFF00", src:"css", vs:"Lime", d:"Greener than lime, halfway between yellow and green.", o:"Named after a French liqueur made by Carthusian monks."},
  {n:"Pistachio", h:"#93C572", src:"wiki", vs:"Emerald", d:"Softer and yellower than emerald.", o:"The nut's green kernel."},
  {n:"Celadon", h:"#ACCFB0", src:"pick", vs:"Mint", d:"Greyer and a little darker than mint.", o:"Named after Céladon, a shepherd dressed in pale green in a 1607 French novel. Europeans gave his name to Chinese green-glazed ware."},
  {n:"Jade", h:"#00A86B", src:"pick", vs:"Emerald", d:"Darker and bluer than emerald.", o:"After the gemstone."},
  {n:"Malachite", h:"#0BDA51", src:"wiki", vs:"Emerald", d:"Brighter and more intense than emerald.", o:"A banded copper mineral, ground into green pigment in ancient Egypt."},
  {n:"Viridian", h:"#40826D", src:"wiki", vs:"Teal", d:"Greener than teal.", o:"A chromium oxide paint from the 1800s. Latin viridis means green."},
  {n:"Moss", h:"#8A9A5B", src:"wiki", vs:"Sage", d:"Darker and more olive than sage."},
  {n:"Hunter green", h:"#355E3B", src:"wiki", vs:"Bottle green", d:"Greyer and yellower than bottle green.", o:"Worn by hunters to blend into woods."},
  {n:"Bottle green", h:"#006A4E", src:"pick", vs:"Hunter green", d:"Bluer and deeper than hunter green.", o:"The color of old glass bottles."}
]},
{ id:"t3-purples", tier:3, title:"Purples & pinks", colors:[
  {n:"Thistle", h:"#D8BFD8", src:"css", vs:"Lilac", d:"Paler and greyer than lilac.", o:"After the thistle flower."},
  {n:"Orchid", h:"#DA70D6", src:"css", vs:"Magenta", d:"Softer than magenta.", o:"After the orchid flower."},
  {n:"Amethyst", h:"#9966CC", src:"wiki", vs:"Orchid", d:"Bluer and darker than orchid.", o:"After the purple quartz gem."},
  {n:"Puce", h:"#CC8899", src:"wiki", vs:"Mauve", d:"Lighter and pinker than mauve.", o:"French for flea. It was the fashion at Marie Antoinette's court."},
  {n:"Mulberry", h:"#C54B8C", src:"wiki", vs:"Plum", d:"Pinker and brighter than plum.", o:"After the berry."},
  {n:"Byzantium", h:"#702963", src:"wiki", vs:"Plum", d:"Darker than plum.", o:"Named after the Byzantine Empire and its imperial purple."},
  {n:"Aubergine", h:"#3D0734", src:"xkcd", vs:"Byzantium", d:"Much darker than byzantium, almost black.", o:"The British name for eggplant."}
]},
{ id:"t3-earths", tier:3, title:"Earths & greys", colors:[
  {n:"Ecru", h:"#F0E6D2", src:"pick", vs:"Beige", d:"Lighter and greyer than beige.", o:"French for raw, as in unbleached linen."},
  {n:"Camel", h:"#C19A6B", src:"wiki", vs:"Tan", d:"Darker and a little richer than tan.", o:"After camel hair, the coat fabric."},
  {n:"Terracotta", h:"#E2725B", src:"wiki", vs:"Salmon", d:"Earthier and darker than salmon.", o:"Italian for baked earth."},
  {n:"Sienna", h:"#A0522D", src:"css", vs:"Rust", d:"Duller and browner than rust.", o:"An earth pigment first dug near Siena, Italy. Roasting it gives the redder burnt sienna."},
  {n:"Sepia", h:"#8A6A4F", src:"pick", vs:"Taupe", d:"Warmer and browner than taupe.", o:"Originally ink from the cuttlefish, whose Latin name is sepia."},
  {n:"Umber", h:"#635147", src:"wiki", vs:"Sepia", d:"Darker and greyer than sepia.", o:"A brown earth pigment, darkened by manganese. The name probably comes from Latin umbra, shadow, more likely than from Umbria."},
  {n:"Mahogany", h:"#6C2E1F", src:"pick", vs:"Maroon", d:"Browner and duller than maroon.", o:"After the reddish tropical hardwood."},
  {n:"Ash", h:"#B2BEB5", src:"wiki", vs:"Silver", d:"Silver with a faint green-grey cast.", o:"After wood ash."},
  {n:"Gunmetal", h:"#2A3439", src:"wiki", vs:"Charcoal", d:"Darker than charcoal.", o:"After the bronze once used to cast cannons."}
]}
]};
