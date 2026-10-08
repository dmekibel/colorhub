"""Origin-tier rules for tools/graph_build.py: what kind of thing is a color NAME named after?

Deterministic, no LLM. Eight tiers from the master plan (design/MASTER-PLAN-2026-10-08.md section 3) plus two honest
extras so nothing is forced into a wrong box:

  pigment-mineral-dye    cobalt, cerulean, vermilion, indigo, lapis, emerald, amethyst, verdigris...
  traditional-system     Japanese traditional colors (the romaji names of the `jp` source: Konjo-iro, Hanada...)
  nature                 plants, animals, foods and landscape: mauve, lilac, salmon, moss, robin's egg, sky...
  place-institution      Oxford, Yale, Delft, Capri, Air Superiority Blue, United Nations Blue...
  person                 Skobeloff, Payne's grey, Hooker's green, Isabelline, Rebecca Purple...
  standard-system        CSS/X11, RAL, NCS/Munsell/Process qualifiers, Ridgway's and ISCC-NBS systematic names
  commercial             Crayola and other brand names
  descriptive-modifier   Light X, Pale X, Greenish X, Blue-green: a modifier grammar word on a name that exists
  basic-term             the eleven basic English color words (a class of their own, not a "kind of" anything)
  undocumented           nothing in our data says where the name came from (said plainly, never guessed)

Precedence (first hit wins), each decision recorded with a `why` string:
  0. data/graph-tier-overrides.json (manual, by slug)       1. basic term
  2. parenthetical qualifier, "Magenta (Crayola)"           3. descriptive-modifier (modifier words + an existing name)
  4. Japanese traditional (the name IS a `jp` source name)  5. keyword classes: pigment > person > place > nature
  6. Crayola note -> commercial                             7. source lists: ral/css/iscc-nbs/ridgway/wiki-X11 -> standard
  8. otherwise undocumented
Keyword lists are curated below and are deliberately conservative: a miss falls to "undocumented", not to a guess.
"""
import re

BASICS = {"red", "orange", "yellow", "green", "blue", "purple", "pink", "brown", "grey", "gray", "black", "white"}
FAMILY = BASICS | {"violet", "cyan", "magenta"}

MODIFIERS = {"light", "dark", "pale", "deep", "dusky", "dusty", "bright", "vivid", "medium", "dull", "soft", "pastel",
             "very", "strong", "moderate", "luminous", "pallid", "faded", "muted", "warm", "cool", "neon", "darkish",
             "lightish", "lighter", "mid", "middle", "pure", "rich", "flat", "fresh", "true", "clear", "washed", "out",
             "vibrant", "dirty", "electric", "greyish", "grayish", "blackish", "whitish", "reddish", "yellowish",
             "greenish", "bluish", "purplish", "pinkish", "brownish", "orangish", "orangeish", "tealish", "greeny",
             "bluey", "pinky", "purply", "yellowy", "orangey", "reddy", "browny", "purpleish", "light", "really",
             "off", "heavy", "pearl", "metallic", "maximum", "hot", "baby", "ugly", "boring", "sickly", "nasty"}
# modifiers that are real names when alone or are part of a real name (never treated as a modifier of Blue Bell etc.)
NOT_MOD_HEADS = {"hot", "baby", "pearl", "metallic", "maximum", "ugly", "boring", "sickly", "nasty", "electric", "off"}

PIGMENT = set("""cadmium cobalt cerulean vermilion vermillion carmine alizarin alizarine madder cochineal ochre ocher ocre
sienna umber sinopia verdigris malachite azurite lapis ultramarine smalt zaffre viridian phthalo quinacridone gamboge
indigo woad orpiment realgar minium massicot bistre bister sepia terre verte prussian berlin naples aureolin chrome
chromium zinc titanium lead mars hansa arylide ruber bole rhodamine haematite hematite cinnabar scheele scheele's
emerald amethyst sapphire ruby topaz citrine jade jasper opal onyx garnet spinel zircon carnelian tourmaline aquamarine
turquoise peridot olivine agate quartz basalt graphite chalcedony fluorite tyrolite microcline pyrite serpentine
zinnwaldite rhodonite thulite variscite amber jet bronze copper gold silver platinum nickel steel iron aluminium
tyrian kermes mauveine aniline naphthalene anthracene methyl eosine eosin rosolane primuline diamine diamin trypan
nigrosin haematoxylin fuchsine rocellin orchil saffron lake dye ink pigment gypsum chessylite xanthine
anthracite indanthrene litho cyanine benzo acetin ceruleum chalk coral-red sulphate sulphine sulphur sulfur naphthol
verditter bice ultramarine crimson azure lazuli lazuline cinereous""".split())
PIGMENT_PHRASES = ["green earth", "terre verte", "paris green", "indian yellow", "egyptian blue", "han purple",
                   "naples yellow", "king's yellow", "yellow ochre", "raw sienna", "burnt sienna", "burnt umber", "raw umber",
                   "lamp black", "bone black", "ivory black", "mummy brown", "dragon's-blood", "rose madder",
                   "indian red", "venetian red", "tuscan red", "oxide red", "red ochre", "persian indigo", "alizarin",
                   "yinmn", "prussian", "payne's grey", "sap green", "emerald green", "cobalt", "brunswick green",
                   "stil de grain", "lemon chrome", "orange chrome", "spanish carmine", "japanese carmine", "pictorial carmine",
                   "permanent geranium lake", "sepia brown", "cerulean", "van dyke brown", "vandyke red", "naples"]

PERSON = set("""skobeloff leitch payne prout hooker ackermann hay hay's bishop's blanc blanc's chapman mathews' rood rood's
scheele saccardo saccardo's sanford sanford's davy davy's vandyke vanderpoel varley varley's veronese mountbatten
isabella isabelline rebecca alice medici rinnemann rinnemann's klein majorelle lincoln victoria pompadour dauphin dauphin's
kaiser rajah mikado yvette eugenia kobe bradley bradley's windsor perrywinkle schauss baker-miller barney kermit
mona lisa tiffany barbie wada trypan gotham""".split()) - {"hay", "kobe", "windsor", "tiffany", "barbie", "gotham", "lisa", "mona", "rajah", "mikado", "trypan", "wada", "bishop's"}
PERSON |= {"bishop's"}
PERSON_PHRASES = ["mona lisa", "baker-miller", "bradley's", "rebecca purple", "alice blue", "leitch's", "ackermann's",
                  "hooker's", "hay's", "blanc's", "chapman's", "mathews'", "rood's", "scheele's", "prout's", "payne's",
                  "sanford's", "davy's", "saccardo's", "varley's", "vanderpoel's", "rinnemann's", "dauphin's", "kronberg's",
                  "paolo veronese", "mountbatten", "isabelline", "isabella color", "skobeloff", "yves klein", "international klein",
                  "majorelle", "kaiser brown", "lincoln green", "rose pompadour", "tyrian"]

PLACE = set("""persian spanish french russian english indian chinese dutch venetian tuscan tuscany italian roman japanese
german swiss american british irish scotch mexican brazil brazilian moroccan morocco turkish egyptian
oxford cambridge yale harvard columbia carolina eton tufts princeton syracuse cornell delft dresden brussels antwerp bremen
paris berlin nile niagara ontario capri sorrento montpellier caribbean pacific honolulu amazon
windsor danube tiber elm oural neva helvetia hessian dijon florence bordeaux portland sacramento
venice siena bologna macedonian pompeian etruscan arctic antarctic alpine atlantic mediterranean
rouge-et hollywood california texas kentucky havana cuban kashmir kashmiri persia byzantine byzantium
sahara sahel siberian york new-york golden-gate xanadu xander xumo cyber india pakistan erin windsor
united nations independence liberty lagoon""".split()) - {"elm", "lagoon", "nations", "united", "independence", "liberty", "cyber", "xander", "xumo", "xanadu", "arctic", "alpine", "atlantic", "rouge-et", "new-york", "golden-gate", "york", "kashmir", "kashmiri", "persia", "sahara", "sahel", "siberian", "danube", "hessian"}
PLACE |= {"kobe", "burgundy", "navy", "cadet", "sailor", "marine", "battleship", "cardinal", "danube", "hessian", "kashmir", "persia", "sahara"}
PLACE_PHRASES = ["united nations", "air superiority", "golden gate", "new york", "racing green", "british racing",
                 "school bus", "dodger blue", "wild blue yonder", "purple mountain", "sacramento state", "university of",
                 "msu green", "ksu purple", "ou crimson", "up maroon", "up forest", "usafa", "ua blue", "ua red", "crimson (ua)",
                 "tufts blue", "cambridge blue", "oxford blue", "columbia blue", "carolina blue", "yale blue", "eton blue",
                 "duke blue", "syracuse orange", "princeton orange", "windsor tan", "kentucky", "texas", "notre dame",
                 "independence", "liberty", "gotham green", "hollywood cerise", "xanadu", "air force", "bleu de france",
                 "st. patrick", "connor's lakefront", "cyber grape", "android green", "windows blue", "xbox green",
                 "mountain meadow", "tropical rainforest", "pakistan green", "india green", "irish green", "erin"]

NATURE = set("""apple apricot avocado banana berry blueberry cherry cranberry raspberry strawberry melon watermelon peach pear
plum pumpkin tomato lemon lime mango kiwi grape grapefruit olive pistachio almond hazel chestnut walnut pecan cinnamon cocoa
coffee chocolate mustard honey butter caramel cream vanilla tea wine fig date prune currant mulberry persimmon quince
squash carrot onion leek endive chicory beet beetroot radish spinach pea asparagus broccoli celery lettuce cucumber
cabbage corn wheat oat oatmeal rice bran flax linen cotton silk wool velvet leather suede hemp
lilac lavender rose violet iris orchid pansy petunia wisteria heliotrope marigold dandelion primrose jasmine daffodil lotus
poppy tulip carnation magnolia hyacinth hydrangea dahlia begonia geranium cyclamen fuchsia mallow mauve thistle heather
periwinkle cornflower buttercup sunflower daisy lily camellia azalea columbine gentian campanula hellebore lobelia phlox
nasturtium bluebell blue-bell foxglove lupin lupine peony sweet pea pea-green orchid mimosa gardenia hibiscus lotus
magnolia wisteria clover pansy anemone forget-me-not celandine hortense hyssop dogwood perilla vernonia eupatorium
corydalis gnaphalium auricula laelia campanula cress oriental plumbago sage mint basil pine spruce fir cedar oak ivy
reed leaf grass lichen bamboo willow laurel yew moss fern bracken seaweed algae kelp cactus palm olive bay hay straw
thatch bark rust walnut mahogany ebony rosewood teak oakwood driftwood sandalwood aloewood vetiver
salmon flamingo peacock robin dove canary raven sparrow mouse squirrel fawn beaver lion camel mole fox tiger zebra
shrimp lobster pigeon gull linnet kestrel partridge duck parrot swan crow rook jay macaw toucan turtle frog lizard
mantis wasp bee beetle pig piggy liver snake dragon squirrel mouse elephant hathi ox bull bear wolf rabbit hare
egg eggshell shell pearly oyster
sky sea ocean sand stone earth mud clay snow ice cloud cloudy storm stormy sunset sunrise dawn dusk twilight midnight night
forest jungle meadow desert swamp lagoon sun moon star space tundra cliff slate smoke ash charcoal soot coal dust
dirt lava volcano glacier fog mist ember flame fire candle sunshine sunny rainbow rain spring autumn winter summer
daffodil fallen harvest bonbon seafoam sea-foam foam mushroom truffle toast bread biscuit cookie cracker
cumin turmeric paprika curry ginger pepper chili chilli salmon-pink eggplant aubergine
blood bruise bone ivory skin flesh hair tan khaki terracotta
bubblegum bubble gum candy cotton sugar plum-pudding""".split()) - {"pea", "date", "tan", "khaki", "cream", "wine", "teak", "ash", "star", "moon", "sun", "space", "silk", "linen", "cotton", "wool", "velvet", "leather", "suede", "candle", "candy", "sugar", "bubble", "gum", "bubblegum", "cotton", "ink", "oriental", "cress", "hortense", "hyssop", "perilla", "vernonia", "eupatorium", "corydalis", "gnaphalium", "auricula", "laelia", "mauve", "bay", "bonbon", "dragon", "slate", "smoke", "charcoal", "soot", "coal", "rust", "tiger", "elephant", "hathi", "iris", "violet"}
NATURE |= {"pearl", "espresso", "merlot", "mandarin", "custard", "spearmint", "mocha", "pea", "maroon", "auburn", "puce", "cerise", "coral", "aqua", "teal", "taupe", "beige", "buff", "tawny", "russet", "shamrock", "goldenrod", "honeydew", "bisque", "myrtle", "evergreen", "lawn", "sandstone", "seashell", "seal", "tumbleweed", "wheat", "sandy", "champagne", "chartreuse", "celadon", "inchworm", "mindaro", "paua", "manatee", "timberwolf", "wintergreen", "verde", "lagoon", "cream", "jonquil", "citron", "reseda", "siskin", "rainette", "warbler", "ramier", "motmot", "parula", "cotinga", "courge", "pois", "pinard", "oxblood", "unbleached", "papyrus", "denim", "fallow", "mauve", "iris", "violet", "slate", "charcoal", "smoke", "rust", "perilla", "hortense", "hyssop", "vernonia", "eupatorium", "corydalis", "gnaphalium", "auricula", "laelia", "cress", "bay", "dragon", "bonbon"}
NATURE_PHRASES = ["robin's egg", "robin egg", "duck egg", "forest green", "sea green", "sea foam", "pea soup", "pea green",
                  "granny smith", "key lime", "macaroni and cheese", "peach puff", "strawberry blonde", "orange peel",
                  "orange soda", "blood orange", "onion-skin", "cherry blossom", "tea rose", "yellow rose", "mint cream",
                  "ghost white", "snow white", "white smoke", "old lace", "fallen leaf", "spring onion", "spring bud",
                  "rose dust", "cotton candy", "candy apple", "dark walnut", "fawn color", "slate color", "salmon color"]

CRAYOLA_QUALIFIERS = {"crayola"}
QUALIFIER_TIER = {
    "crayola": ("commercial", "named in the Crayola box (qualifier)"),
    "ncs": ("standard-system", "NCS (Natural Colour System) basic color"), "munsell": ("standard-system", "Munsell system hue"),
    "process": ("standard-system", "printing-ink process color"), "ryb": ("standard-system", "RYB painter's primary"),
    "color wheel": ("standard-system", "color-wheel position"), "x11": ("standard-system", "X11 rgb.txt variant"),
    "web": ("standard-system", "web (CSS/X11) variant"), "rgb": ("standard-system", "RGB/CSS definition"),
    "pigment": ("standard-system", "pigment-industry reference value"), "metallic": ("standard-system", "metallic finish convention"),
    "x11 grey": ("standard-system", "X11 grey"), "m&p": ("standard-system", "Maerz and Paul 1930 plate variant"),
    "fogra29": ("standard-system", "FOGRA print standard"), "fogra39": ("standard-system", "FOGRA print standard"),
    "engineering": ("standard-system", "engineering/aerospace standard"), "traditional": ("standard-system", "traditional variant"),
    "ua": ("place-institution", "University of Arizona"), "golden gate bridge": ("place-institution", "the Golden Gate Bridge"),
    "dye": ("pigment-mineral-dye", "dye variant"), "dogs": ("nature", "the coat color of dogs"), "organ": ("nature", "the organ"),
    "horses": ("nature", "the coat color of horses"), "floral": ("nature", "the flower"), "perbang": ("commercial", "PerBang product line"),
    "blaze orange": ("standard-system", "hunter safety orange"), "light": ("descriptive-modifier", "light variant"),
    "dark": ("descriptive-modifier", "dark variant"), "rich black": ("standard-system", "print rich black"),
}
SIGNAL_WORDS = {"traffic", "signal", "safety", "ral", "telegrey", "selective"}
JP_ROMAJI_HINT = re.compile(r"(-iro|iro$|zome$|cha$|nezumi$|murasaki|beni|midori|ai$)", re.I)

SOURCE_DATES = {  # year the source list was published; None = not a dated publication of names
    "werner": (1821, "Werner's Nomenclature of Colours, Syme's 2nd edition, Edinburgh 1821"),
    "ridgway": (1912, "Ridgway, Color Standards and Color Nomenclature, 1912"),
    "maerz-paul": (1930, "Maerz and Paul, A Dictionary of Color, 1930"),
    "iscc-nbs": (1955, "ISCC-NBS dictionary, NBS Circular 553, 1955"),
    "ral": (1927, "RAL Classic (first RAL colors, 1927)"),
    "xkcd": (2010, "xkcd color survey, 2010"),
    "css": (None, "CSS Color / X11 rgb.txt (late 1980s to 2000s)"),
    "crayola": (None, "Crayola crayon names (Wikipedia list; per-name dates not in our data)"),
    "wiki": (None, "Wikipedia 'List of colors'"),
    "jp": (None, "Traditional colors of Japan (Wikipedia list)"),
    "pigment": (None, "historical pigment names (David's notes; dated in the note where known)"),
    "app": (None, "ColorHub curriculum"),
}


def tokens(name):
    s = re.sub(r"\(.*?\)", " ", name.lower())
    return [t for t in re.split(r"[^a-z']+", s) if t]


def qualifier(name):
    m = re.search(r"\(([^)]*)\)\s*$", name)
    return m.group(1).strip().lower() if m else None


def _hit(words, toks):
    for t in toks:
        if t in words or t.rstrip("'s") in words or (t.endswith("'s") and t[:-2] in words):
            return t
    return None


def _phrase(phrases, low):
    for p in phrases:
        if p in low:
            return p
    return None


def keyword_tier(name):
    """pigment > person > place > nature on the NAME alone. Returns (tier, why) or None."""
    low = re.sub(r"\(.*?\)", " ", name.lower()).replace("grey", "grey")
    toks = tokens(name)
    p = _phrase(PIGMENT_PHRASES, low) or _hit(PIGMENT, toks)
    if p:
        return "pigment-mineral-dye", "pigment, dye or mineral word: " + p
    p = _phrase(PERSON_PHRASES, low) or _hit(PERSON, toks)
    if p:
        return "person", "named for a person: " + p
    p = _phrase(PLACE_PHRASES, low) or _hit(PLACE, toks)
    if p:
        return "place-institution", "place or institution word: " + p
    p = _phrase(NATURE_PHRASES, low) or _hit(NATURE, toks)
    if p:
        return "nature", "plant, animal, food or landscape word: " + p
    return None


def modifier_parent(name, key_of, by_key):
    """If `name` is modifier word(s) + an existing name (or two color words), return (parent_key, modifiers)."""
    low = re.sub(r"\(.*?\)", " ", name.lower()).replace("-", " ")
    toks = [t for t in low.split() if t]
    if len(toks) < 1:
        return None
    mods = []
    i = 0
    while i < len(toks) - 1 and toks[i] in MODIFIERS and toks[i] not in NOT_MOD_HEADS:
        mods.append(toks[i]); i += 1
    rest = toks[i:]
    if rest and rest[-1] in ("color", "colour"):
        rest = rest[:-1]
    if not rest:
        return None
    if mods:
        k = key_of(" ".join(rest))
        if k in by_key:
            return k, mods
        if len(rest) == 1 and rest[0] in FAMILY:
            return key_of(rest[0]), mods
    # two color words: "blue green", "red orange", "yellow green": lean + head
    if not mods and len(toks) == 2 and toks[0] in FAMILY and toks[1] in FAMILY and toks[0] != toks[1]:
        return key_of(toks[1]), [toks[0]]
    # hue-lean prefix + color word where the lean is itself a family word ("green brown", "grey blue")
    return None


def classify(node, key_of, by_key, overrides):
    """node: dict with n, slug, srcs (set), note, jp_name(bool). Returns (tier, why, parent_key|None)."""
    name, slug = node["n"], node["slug"]
    if slug in overrides:
        o = overrides[slug]
        return o["tier"], "manual override: " + o.get("why", ""), o.get("parent")
    low = name.lower()
    if low in BASICS:
        return "basic-term", "one of the eleven basic English color words", None
    q = qualifier(name)
    if q is not None:
        for k, (t, why) in QUALIFIER_TIER.items():
            if q == k or q.startswith(k):
                base = re.sub(r"\s*\(.*?\)\s*$", "", name)
                return t, why, key_of(base) if key_of(base) in by_key else None
    mp = modifier_parent(name, key_of, by_key)
    if mp and mp[0] != key_of(name) and not node.get("jp_name"):
        parent, mods = mp
        return "descriptive-modifier", "modifier grammar: " + " ".join(mods) + " + " + parent, parent
    if node.get("jp_name"):
        return "traditional-system", "a Japanese traditional color name (Wikipedia 'Traditional colors of Japan')", None
    kt = keyword_tier(name)
    srcs = node["srcs"]
    note = node.get("note") or ""
    if kt:
        extra = " (also in Crayola)" if "Crayola" in note else ""
        return kt[0], kt[1] + extra, None
    if "Crayola" in note:
        return "commercial", "Crayola name (Wikipedia list); no earlier origin in our data", None
    if _hit(SIGNAL_WORDS, tokens(name)) or "ral" in srcs:
        return "standard-system", "RAL / industrial signal color", None
    if "css" in srcs or "X11" in note or "Web" in note:
        return "standard-system", "CSS / X11 color keyword", None
    if "ridgway" in srcs:
        return "standard-system", "Ridgway 1912 systematic nomenclature", None
    if "iscc-nbs" in srcs:
        return "standard-system", "ISCC-NBS 1955 dictionary name", None
    if "Maerz" in note or "ISCC" in note:
        return "standard-system", "dictionary-of-color name (Maerz and Paul / ISCC-NBS)", None
    if "werner" in srcs:
        return "undocumented", "Werner 1821 name; the book gives examples but not the name's origin", None
    if "xkcd" in srcs and len(srcs - {"xkcd"}) == 0:
        return "undocumented", "xkcd 2010 survey crowd name", None
    return "undocumented", "origin of the name not documented in our data", None
