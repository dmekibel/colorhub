#!/usr/bin/env python3
"""Subject tags for every painting ("search by subject", like Apple Photos). Data only, no UI.

  python3 tools/subjects.py            # fetch Wikidata answers for QIDs not cached yet (polite, resumable), then build
  python3 tools/subjects.py --offline  # build from caches only (no network)
  SUBJECTS_RAW=/path/to/research/_raw python3 tools/subjects.py   # caches live in the main checkout, not in a worktree

Output: data/gallery/subjects.json, one entry per painting in data/gallery/ids.txt order (the append-only gallery order):
  {"v":1,"tags":[name...],"grp":["g"|"t"|"i" per tag],"ia":[[tag idx]...],"it":[[tag idx]...],"im":[],"prov":{...}}
  grp g = GENRE (portrait, landscape, still life...), t = THINGS (dog, boat, tree...), i = ICONOGRAPHY (Wikidata
  depicts labels that have no vocabulary mapping but recur >= ICON_MIN times: saints, Annunciation, Judith...).
  ia = AUTHORITY tags: Wikidata P136 genre / P180 depicts / P921 main subject, or museum metadata (AIC classification).
  it = TITLE-KEYWORD tags (multilingual whole-word match on the title).
  im = reserved, [] today: a future image-recognition pass fills a parallel per-painting list with confidences,
       so curated ia/it are never overwritten. A painting's full set = ia + it (+ im); a UI should trust ia > it > im.

Sources: Wikidata via WDQS for ids "commons-Q<n>" (cache research/_raw/subjects/wd.jsonl, one line per QID, so a
re-run only asks for new paintings; 1 request/second, User-Agent below, backoff on 429/timeouts); museum rows use the
cached museum metadata only (only AIC carries any subject-like field: classification_titles, e.g. "portrait"; Rijks,
SMK, NGA, CMA, Met cache none); titles for everything. GENRES/THINGS below are the controlled vocabulary with hand-made
synonyms. Unmapped frequent depicts labels are listed in research/_raw/subjects/unmapped.txt: extend the tables from it.
Deterministic given the caches. When tools/check_ids.js says subjects.json is out of step: python3 tools/subjects.py
"""
import collections, glob, hashlib, json, os, re, sys, time, unicodedata, urllib.error, urllib.parse, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = Path(os.environ.get("SUBJECTS_RAW", ROOT / "research" / "_raw"))
CACHE = RAW / "subjects"
UA = "colorhub/1.0 (dmekibel@gmail.com)"
WDQS = "https://query.wikidata.org/sparql"
BATCH = 300
ICON_MIN = 25
ICON_MAX = 120
ICON_STOP = {"sitting", "standing", "waist-length hair", "brown hair", "blond hair", "black hair", "red hair", "grey hair", "long hair", "beard", "breast", "navel", "barefoot", "gaze towards the viewer", "smile", "eyebrow", "chignon", "drapery", "nudity", "human body", "face", "hand", "hands", "eye", "eyes", "nose", "mouth", "ear", "arm", "leg", "head", "hair", "lying", "kneeling", "walking", "bark", "gemstone", "group of humans", "domestic worker", "moustache", "hat", "bow", "hip", "nipple", "areola", "back", "waist", "pubic hair removal", "wall", "sleep", "finger", "foot", "feet", "shoulder", "neck", "cheek", "lip", "forehead", "skin", "flesh", "muscle", "bone", "tooth", "teeth", "profile", "bust", "torso", "buttocks", "thigh", "knee", "elbow"}

# tag -> phrases (lowercase, accent-free, whole words; a plural s/es is matched automatically)
GENRES = {
 "portrait": "portrait,portrait painting,portraiture,bildnis,portret,ritratto,retrato,head of,study of a head,half length,bust",
 "self-portrait": "self-portrait,self portrait,selbstbildnis,selbstportrat,autoportrait,zelfportret,autoritratto,autorretrato",
 "group portrait": "group portrait,family portrait,groepsportret,militia,regents,regentesses,syndics,anatomy lesson,gruppenbildnis",
 "landscape": "landscape,landscape art,landscape painting,paysage,landschap,landschaft,paesaggio,paisaje,pastoral,countryside,wooded landscape,mountain landscape,river landscape,vista",
 "seascape": "seascape,marine,marine art,marine painting,zeegezicht,seestuck,marina,shipwreck,sea piece,naval battle,calm sea,stormy sea",
 "cityscape": "cityscape,veduta,vedute,townscape,city view,view of the city,stadsgezicht,stadtansicht,vue de,street scene,view of venice,view of rome,view of amsterdam",
 "architecture": "architecture,architectural painting,capriccio,church interior,cathedral interior,architectural fantasy",
 "still life": "still life,still-life,nature morte,stilleven,stillleben,natura morta,bodegon,banquet piece,pronkstilleven,breakfast piece,kitchen piece,vanitas still life",
 "flowers": "flower painting,flowers,bouquet,fleurs,bloemen,blumen,fiori,flores,roses,tulips,sunflowers,irises,poppies,water lilies,lilies,blumenstuck,bloemstilleven,peonies,chrysanthemums,anemones,lilacs,daisies,pansies,carnations",
 "religious": "religious art,religious painting,christian art,biblical painting,biblical,madonna,virgin,annunciation,crucifixion,nativity,adoration,pieta,lamentation,deposition,resurrection,holy family,altarpiece,flight into egypt,ascension,assumption,descent from the cross,last supper,baptism of christ,magi,epiphany,transfiguration,christ,jesus,saint,st,sainte,san,santa,sint,sankt,angel,angels,apostle,apostles,evangelist,martyrdom,madonna and child,virgin and child,mary magdalene,pentecost,ecce homo,visitation,presentation in the temple,gethsemane,crowning with thorns,christ child,maria,heilige,calvary,golgotha,noah,moses,abraham,david and goliath,judith,salome,susanna,esther,tobias,samson,jonah,adam and eve,temptation of saint anthony,hermit,pope,bishop,cardinal,mary,john the baptist,jerome,francis of assisi,catherine of alexandria,penitent magdalene,sacra conversazione,peter,paul,joseph,anthony,sebastian",
 "mythological": "mythological painting,mythology,greek mythology,roman mythology,venus,diana,bacchus,apollo,jupiter,juno,minerva,neptune,saturn,hercules,perseus,orpheus,narcissus,psyche,cupid,eros,europa,leda,danae,ariadne,galatea,satyr,nymph,nymphs,centaur,muses,triton,prometheus,achilles,aeneas,ulysses,odysseus,medusa,minotaur,zeus,hera,athena,aphrodite,dionysus,poseidon,hades,hermes,artemis,bacchanal,bacchante,pomona,vulcan,ceres,proserpina,persephone,adonis,atalanta,actaeon,callisto,judgement of paris,faun,silenus,maenad,mermaid,naiad,thetis,pygmalion,pan and syrinx,cephalus,andromeda,endymion,midas,icarus,daedalus,theseus,jason,medea,circe,calypso",
 "history": "history painting,historical painting,historical,coronation,treaty,assassination,execution,death of,triumph of,entry of,surrender of,crossing the,revolution",
 "battle": "battle,battle scene,battle painting,bataille,slag,schlacht,battaglia,skirmish,siege of,cavalry charge,hussars,cossacks,warriors",
 "genre scene": "genre art,genre painting,genre scene,peasants,peasant,tavern,inn,kermis,fair,merry company,card players,card-players,party,wedding,village festival,drinkers,smokers,gamblers,beggars,schoolmaster,lacemaker,washerwoman,music lesson,gossip,harvesters,reapers,gleaners,farmers,laborers,fishermen,spinner,milkmaid,brawl,physician,cobbler,tailor,sower,shepherdess,kitchen maid,gypsy,gypsies,fortune teller,skaters,tavern scene,peasant dance,peasant wedding,card game,dice players",
 "interior": "interior,interieur,room,salon,studio,kitchen,bedroom,drawing room,parlour,library,bedchamber,sala,stube,kamer",
 "nude": "nude,nude art,nudes,nu,akt,nudo,desnudo,naked,bather,bathers,baigneuse,baigneuses,odalisque,reclining nude,toilette,bathsheba,after the bath,dormeuse,sleeping venus,standing nude,female nude,male nude,nudity",
 "animal": "animal painting,animals,animal,wildlife,menagerie,cattle,herd,flock,poultry,hens,cock,rooster,ducks,cows,sheep,horses,dogs,cats,birds,lion,tiger,wolf,fox,deer,stag,hare,rabbit,bear,elephant,camel,fish,bull,ox,pig,donkey,goat,swan,peacock,owl,eagle,parrot,monkey,leopard,boar,stable,hunting dog,dead game,game piece,fowl",
 "allegory": "allegory,allegorical,allegorical painting,allegory of,personification,emblem,fortune,truth,justice,virtue,vice,four seasons,five senses,the senses,fates",
 "vanitas": "vanitas,memento mori,skull,skulls,hourglass,death",
 "hunting": "hunting,hunting scene,hunt,hunter,hunters,chasse,jacht,jagd,caccia,huntsman,falconry,hawking,hounds,fowling,angler,anglers",
 "abstract": "abstract,abstract art,composition,suprematist,suprematism,improvisation,non-objective,constructivist,black square,cubist,cubism,geometric,color field,harmony in,symphony in,arrangement in,nocturne in",
 "orientalist": "orientalism,orientalist,oriental,harem,arab,arabs,turkish,moorish,bazaar,egyptian,algiers,tangier,morocco,bedouin,sultan,pasha,souk,caravan,snake charmer,slave market,jerusalem,cairo,constantinople",
 "fantasy": "fantasy,fantastic,visionary,nightmare,devil,demons,hell,inferno,last judgment,temptation,witches,witch,sabbath,fairy,fairies,ghost,ghosts,monsters,dragon,apocalypse,symbolism,fairy tale,elves,gnome,gnomes",
 "music & dance": "music,musician,musicians,concert,singer,singers,orchestra,dancer,dancers,dancing,dance,ballet,ballerina,ballerinas,dance class,theatre,theater,opera,actor,actress,pierrot,harlequin,clown,circus,carnival,masquerade,masked,serenade,lute player,violinist,guitarist,flute player,pianist,cellist",
}
THINGS = {
 "dog": "dog,dogs,hound,hounds,puppy,spaniel,greyhound,chien,hond,hund,perro,poodle,terrier,mastiff,dachshund",
 "horse": "horse,horses,pony,stallion,mare,cheval,chevaux,paard,pferd,cavallo,caballo,foal,colt,racehorse,horseman,rider,cavalier,jockey,equestrian,horseback,riding,equestrianism",
 "cat": "cat,cats,kitten,kittens,chat,kat,katze,gatto,gato,feline",
 "cow": "cow,cows,cattle,ox,oxen,bull,bulls,calf,calves,vache,koe,kuh,mucca,vaca",
 "sheep": "sheep,lamb,lambs,ram,flock,mouton,schaap,schaf,pecora,oveja,shepherd,shepherdess",
 "bird": "bird,birds,duck,ducks,swan,swans,goose,geese,hen,hens,chicken,rooster,cock,peacock,parrot,owl,eagle,dove,doves,pigeon,heron,crane,falcon,hawk,sparrow,nightingale,swallow,stork,oiseau,vogel,uccello,pajaro,songbird,pheasant,partridge,turkey,raven,crow,magpie,finch,canary,goldfinch,cockatoo,lark,gull,seagull,wildfowl,poultry,fowl",
 "fish": "fish,fishes,salmon,herring,carp,pike,trout,cod,eel,oyster,oysters,lobster,crab,shrimp,mussels,poisson,vis,fisch,pesce,pescado,fishmonger,sturgeon,tuna,sardine,mackerel,perch,whale,dolphin",
 "lion": "lion,lions,lioness,leopard,tiger,panther,lynx,jaguar,cheetah,big cat",
 "deer": "deer,stag,stags,doe,hart,buck,roe deer,reindeer,elk,moose,fallow deer,antelope,gazelle,hind",
 "rabbit": "rabbit,rabbits,hare,hares,bunny,lapin,konijn,hase,lepre,liebre",
 "pig": "pig,pigs,swine,boar,hog,sow,piglet,porc,varken,schwein,maiale,cerdo,wild boar",
 "goat": "goat,goats,billy goat,chevre,geit,ziege,cabra",
 "donkey": "donkey,donkeys,mule,burro,ane,ezel,esel,asino,asno",
 "elephant": "elephant,elephants,camel,camels,giraffe,rhinoceros,rhino,hippo,zebra",
 "butterfly": "butterfly,butterflies,moth,insect,insects,bee,bees,dragonfly,beetle,caterpillar,ant,fly,flies,spider,snail,ladybird,papillon,vlinder,schmetterling",
 "boat": "boat,boats,sailboat,sailboats,rowboat,rowing boat,dinghy,gondola,canoe,barge,barque,ferry,skiff,fishing boat,fishing boats,yacht,regatta,steamboat,steamer,lifeboat,raft,sail,sails,sailing,bateau,bateaux,boot,barca,barco,punt,tugboat,sloop,schooner,cutter,vessel",
 "ship": "ship,ships,frigate,warship,man-of-war,man of war,galleon,fleet,armada,naval,navy,flagship,clipper,brig,tall ship,merchantman,east indiaman,shipwreck,navire,vaisseau,schip,schiff,nave,navio,battleship,gunboat,steamship,liner,ironclad",
 "sea": "sea,ocean,waves,wave,surf,breakers,tide,mer,zee,meer,mare,seascape,seashore,seaside,shore,coast,coastal,coastline,bay,cove,cliff,cliffs,estuary,roadstead,fjord,reef,lagoon,gulf",
 "harbor": "harbor,harbour,port,haven,hafen,porto,puerto,quay,pier,jetty,dock,lighthouse,phare,vuurtoren,anchorage,marina",
 "beach": "beach,beaches,plage,strand,spiaggia,playa,sand,dunes,sands,shore,seashore,seaside,bathers",
 "river": "river,rivers,stream,streams,brook,creek,fleuve,riviere,rivier,fluss,fiume,rio,canal,canals,seine,thames,rhine,danube,tiber,arno,loire,volga,hudson,nile,rhone,meuse,riverbank,riverside,weir,torrent,rapids,watercourse",
 "lake": "lake,lakes,pond,ponds,lac,lago,loch,tarn,mere,reservoir,etang,vijver,teich,stagno,estanque,marsh,swamp,bog,fen,wetland,lakeside,water lily,water lilies",
 "waterfall": "waterfall,waterfalls,cascade,cascades,falls,cataract,wasserfall,cascata",
 "mountain": "mountain,mountains,mount,peak,peaks,alps,alpine,glacier,summit,massif,montagne,berg,berge,gebirge,monte,montagna,montana,sierra,volcano,vesuvius,etna,fuji,matterhorn,mont blanc,highlands,gorge,ravine,canyon,crag,hills,hill,hillside,rock,rocks,rocky",
 "tree": "tree,trees,oak,oaks,beech,birch,willow,willows,poplar,poplars,elm,pine,pines,fir,spruce,cypress,cypresses,olive tree,olive trees,palm,palms,palm tree,chestnut,apple tree,cherry tree,grove,arbre,arbres,boom,bomen,baum,baume,albero,alberi,arbol,trunk,branches,foliage,linden,maple,alder,blossom,blossoms,blossoming,almond blossom",
 "forest": "forest,forests,woods,wood,woodland,woodlands,foret,bos,bossen,wald,bosco,bosque,thicket,copse,glade,clearing,sous-bois,undergrowth,jungle,bois,wooded",
 "field": "field,fields,meadow,meadows,pasture,pastures,wheatfield,wheat field,cornfield,hayfield,champ,champs,veld,feld,campo,prairie,plain,plains,steppe,heath,moor,moorland,stubble,furrows,grassland,rice field,haystack,haystacks,wheat,harvest,haymaking,plough,ploughing,rural area,rural,countryside,grass,meadow",
 "garden": "garden,gardens,jardin,jardins,tuin,garten,giardino,park,parks,parc,parco,terrace,arbour,pergola,hedge,lawn,flowerbed,orchard,orangery,greenhouse,gardener,gardeners",
 "bridge": "bridge,bridges,pont,ponts,brug,brucke,ponte,puente,viaduct,aqueduct,footbridge,drawbridge,rialto",
 "church": "church,churches,cathedral,cathedrals,chapel,chapels,abbey,abbeys,basilica,minster,monastery,convent,cloister,cloisters,eglise,cathedrale,kerk,kirche,chiesa,iglesia,duomo,temple,temples,synagogue,mosque,pagoda,shrine,altar,belfry,steeple,spire,bell tower,campanile,minaret,notre-dame,notre dame,westminster,chartres",
 "castle": "castle,castles,chateau,kasteel,schloss,burg,castello,castillo,fortress,fort,citadel,palace,palaces,palais,paleis,palast,palazzo,palacio,manor,mansion,villa",
 "house": "house,houses,home,cottage,cottages,hut,huts,cabin,farm,farmhouse,farmstead,barn,maison,huis,haus,casa,hovel,shack,lodge,chalet,roof,roofs,rooftops,courtyard,building,buildings",
 "village": "village,villages,hamlet,dorp,dorf,paese,pueblo,small town,market town,fishing village,hill town",
 "city": "city,cities,town,ville,stad,stadt,citta,ciudad,skyline,panorama,urban,old town,london,paris,rome,venice,venezia,florence,firenze,amsterdam,delft,haarlem,antwerp,brussels,bruges,vienna,berlin,munich,prague,moscow,petersburg,madrid,toledo,seville,naples,genoa,milan,athens,istanbul,new york,boston,edinburgh,dublin,rouen,lyon,marseille,rotterdam,utrecht,leiden,cologne,hamburg,warsaw,copenhagen,stockholm",
 "street": "street,streets,rue,straat,strasse,strada,calle,avenue,boulevard,alley,lane,road,roads,chemin,weg,path,promenade,piazza,plaza,square,marketplace,market,crossroads,arcade,arcades",
 "window": "window,windows,fenetre,raam,fenster,finestra,ventana,casement,skylight,shutters,curtain,curtains,balcony,loggia,veranda,porch,doorway,door,porte,deur,tur,porta,puerta,staircase,stairs",
 "table": "table,tables,tablecloth,desk",
 "mirror": "mirror,mirrors,miroir,spiegel,specchio,espejo,looking glass,reflection,reflected",
 "candle": "candle,candles,candlelight,lamp,lamps,lantern,lanterns,torch,torches,chandelier,oil lamp,bougie,kaars,kerze,candela,vela",
 "book": "book,books,manuscript,letter,letters,newspaper,scroll,reading,reader,bible,missal",
 "vase": "vase,vases,jar,jars,urn,urns,jug,pitcher,bowl,bowls,teapot,porcelain,goblet,goblets,wine glass,carafe,basket,baskets,basketry",
 "fruit": "fruit,fruits,fruit piece,pomegranate,pomegranates,cherries,cherry,peach,peaches,plum,plums,pear,pears,grapes,grape,melon,melons,fig,figs,orange,oranges,citrus,berries,strawberries,strawberry,raspberries,currants,gooseberries,nuts,walnut,walnuts,hazelnut,apricot,apricots,banana,bananas,pineapple,quince,medlar,vegetables,vegetable,cabbage,pumpkin,onion,onions,carrot,carrots,asparagus,artichoke,artichokes,cucumber,tomato,tomatoes,potato,potatoes,fruit bowl,fruit basket",
 "apple": "apple,apples,pomme,pommes,appel,apfel,mela,manzana,apple tree,apple blossom",
 "grapes": "grapes,grape,vine,vines,vineyard,wine,wine press,wine bottle,wine bottles,bottle,bottles",
 "lemon": "lemon,lemons,citron,limone,limon,citrus",
 "bread": "bread,loaf,loaves,pain,brood,brot,cheese,cheeses,egg,eggs,ham,sausage,pie,cake,cakes,tart,pastry,oysters,breakfast,banquet",
 "flower": "flower,flowers,rose,roses,tulip,tulips,sunflower,sunflowers,iris,irises,poppy,poppies,lily,lilies,lilac,lilacs,peony,peonies,daisy,daisies,pansy,pansies,carnation,carnations,chrysanthemum,chrysanthemums,anemone,anemones,orchid,orchids,hyacinth,hyacinths,narcissus,daffodil,daffodils,violet,violets,lavender,geranium,geraniums,bouquet,bouquets,garland,garlands,wreath,wreaths,posy,blossom,blossoms,bloom,blooms,petal,petals,fleur,fleurs,bloem,bloemen,blume,blumen,fiore,fiori,flor,flores,wildflower,wildflowers,buttercup,buttercups,cornflower,cornflowers,marigold,marigolds,primrose,primroses,forget-me-not,plant,plants",
 "skull": "skull,skulls,skeleton,skeletons,hourglass,memento mori,bones,corpse,corpses,dead body",
 "sky": "sky,skies,cloud,clouds,cloudy,heaven,heavens,horizon,rainbow,storm,thunderstorm,lightning,rain,rainy,fog,foggy,mist,misty,haze,hazy,ciel,lucht,himmel,cielo,overcast,stormy,tempest",
 "sun": "sun,sunlight,sunshine,sunny,sunrise,sunset,sunsets,dawn,daybreak,soleil,zon,sonne,sole,sunbeam,sunbeams,sunlit,golden hour",
 "moon": "moon,moonlight,moonlit,moonrise,full moon,crescent,lune,maan,mond,luna,stars,starry,starlight,starry night,comet,eclipse",
 "night": "night,nights,nocturne,nocturnal,nuit,nacht,notte,noche,midnight,candlelit,lamplight",
 "snow": "snow,snowy,snowstorm,snowfall,winter,wintry,frost,frosty,frozen,ice,icy,skaters,sledge,sleigh,neige,sneeuw,schnee,neve,nieve,hiver,blizzard",
 "child": "child,children,boy,boys,girl,girls,infant,infants,baby,babies,toddler,enfant,enfants,kind,kinder,kinderen,bambino,bambini,nino,nina,little girl,little boy,young girl,young boy,schoolboy,schoolgirl,cherub,cherubs,putto,putti,amorini,mother and child,madonna and child,virgin and child,christ child,infant jesus",
 "woman": "woman,women,lady,ladies,girl,girls,maiden,maid,mother,wife,widow,bride,queen,princess,duchess,countess,empress,actress,courtesan,femme,vrouw,vrouwen,frau,donna,mujer,dame,madame,mademoiselle,servant girl,milkmaid,washerwoman,lacemaker,seamstress,spinner,peasant woman,farm girl,flower girl,shepherdess,gleaner,nude woman,reclining woman,seated woman,young woman,old woman,mary",
 "man": "man,men,gentleman,gentlemen,old man,young man,father,husband,king,prince,duke,emperor,sailor,fisherman,fishermen,farmer,peasant,shepherd,hunter,monk,priest,bishop,cardinal,pope,scholar,philosopher,doctor,physician,merchant,beggar,jester,drinker,smoker,boatman,coachman,uomo,homme,hombre,mann,herr,monsieur,cavalier,knight",
 "couple": "couple,couples,lovers,lover,bride and groom,embrace,embracing,courtship,husband and wife,kiss,kissing,man and woman",
 "soldier": "soldier,soldiers,officer,officers,army,troops,cavalry,infantry,hussar,hussars,cossack,cossacks,musketeer,musketeers,guard,guards,guardsman,militia,regiment,warrior,warriors,knight,knights,general,marshal,commander",
 "musical instrument": "instrument,instruments,violin,violins,viola,cello,lute,lutes,guitar,guitars,harp,harps,harpsichord,spinet,virginal,piano,pianos,flute,flutes,recorder,oboe,clarinet,trumpet,trumpets,trombone,drum,drums,tambourine,cymbals,bagpipe,bagpipes,hurdy-gurdy,mandolin,banjo,sheet music",
 "hat": "hat,hats,cap,caps,bonnet,bonnets,hood,turban,helmet,helmets,wig,crown,crowns,veil",
 "carriage": "carriage,carriages,coach,cart,carts,wagon,wagons,sleigh,train,locomotive,railway,railroad,station,tram,omnibus,bicycle,cyclist,automobile,wheel",
 "windmill": "windmill,windmills,mill,mills,watermill,moulin,molen,muhle,mulino,molino,lighthouse,factory,factories,chimney,chimneys,forge,mine,quarry,shipyard,warehouse",
 "ruins": "ruins,ruin,ruined,antiquities,colosseum,forum,pantheon,parthenon,acropolis,arch of,column,columns,pillar,pillars,pyramid,pyramids,sphinx,obelisk,tomb,tombs,crypt,mausoleum,sarcophagus",
 "desert": "desert,deserts,sahara,dune,dunes,oasis,wilderness,wasteland,canyon,mesa,savanna,steppe,tundra,arctic,iceberg,glacier,volcano,lava,crater,geyser",
 "cross": "cross,crosses,crucifix,rosary",
 "dress": "dress,dresses,gown,gowns,robe,robes,cloak,cloaks,cape,shawl,shawls,scarf,costume,costumes,uniform,uniforms,lace,silk,velvet,fur,jewel,jewels,necklace,pearl,pearls,fan,parasol,umbrella,glove,gloves,clothing,earring,earrings,jewellery,jewelry",
 "statue": "statue,statues,sculpture,sculptures,bust,busts,relief,fountain,fountains",
 "crowd": "crowd,crowds,people,figures,folk,procession,gathering,assembly,audience,congregation,mob,throng,festival",
 "weapon": "sword,swords,dagger,spear,lance,body armor,armor,armour,shield,weapon,weapons,bow,arrow,musket,cannon,helmet,knife,sceptre",
 "chair": "chair,chairs,seat,stool,armchair,bench,sofa,couch,bed,beds,throne",
 "artist": "painter,artist,sculptor,easel,palette",
 "family": "family,families,sacra conversazione,holy family,parents,household",
}
GROUPS = [("g", GENRES), ("t", THINGS)]

# Wikidata labels that mean "this painting is about a person" -> thing tags via gender; and labels never worth keeping
GENDER = {"Q6581072": "woman", "Q6581097": "man"}
JUNK = {"painting", "art", "picture", "image", "oil painting", "work of art", "artwork", "visual artwork", "human", "person", "human being", "people", "individual"}


def norm(s):
    s = unicodedata.normalize("NFKD", s.lower())
    s = "".join(c for c in s if not unicodedata.combining(c))
    return " " + re.sub(r"[^a-z0-9]+", " ", s).strip() + " "


def build_matchers():
    """tag -> compiled regex over a normalized string; phrases may carry a plural s/es."""
    out = []
    for g, table in GROUPS:
        for tag, phr in table.items():
            ps = sorted({norm(p).strip() for p in phr.split(",") if p.strip()} | {norm(tag).strip()}, key=lambda x: -len(x))
            rx = re.compile(r"(?<![a-z0-9])(?:" + "|".join(re.escape(p) for p in ps) + r")(?:s|es)?(?![a-z0-9])")
            out.append((tag, g, rx))
    return out


def tags_in(text, matchers):
    n = norm(text)
    return [t for t, g, rx in matchers if rx.search(n)]


# ---- Wikidata fetch (resumable: one cache line per QID) ----
def wd_cache_load():
    f = CACHE / "wd.jsonl"
    d = {}
    if f.exists():
        for line in f.read_text(encoding="utf-8").splitlines():
            try:
                r = json.loads(line)
                d[r["q"]] = r
            except Exception:
                pass
    return d


def _sparql(query):
    body = urllib.parse.urlencode({"query": query}).encode()
    delay = 5
    for attempt in range(8):
        try:
            req = urllib.request.Request(WDQS, data=body, headers={"User-Agent": UA, "Accept": "application/sparql-results+json"})
            with urllib.request.urlopen(req, timeout=120) as r:
                return json.loads(r.read())["results"]["bindings"]
        except urllib.error.HTTPError as e:
            wait = int(e.headers.get("Retry-After", delay)) if e.code == 429 else delay
            print(f"  WDQS HTTP {e.code}; waiting {wait}s", flush=True)
            time.sleep(wait)
        except Exception as e:
            print(f"  WDQS error {type(e).__name__}; waiting {delay}s", flush=True)
            time.sleep(delay)
        delay = min(delay * 2, 120)
    raise SystemExit("WDQS kept failing; re-run to resume")


def wdqs(qids):
    """Two small queries per batch (a UNION + OPTIONAL in one query times out): genre P136, then depicts P180 / main subject P921
    with the depicted item's gender P21 when it has one. Returns rows with keys q, k (g|d), xl, s."""
    vals = " ".join("wd:" + q for q in qids)
    out = []
    for b in _sparql("SELECT ?q ?xl WHERE { VALUES ?q { %s } ?q wdt:P136 ?x . ?x rdfs:label ?xl FILTER(LANG(?xl)=\"en\") }" % vals):
        out.append({"q": b["q"], "k": {"value": "g"}, "xl": b["xl"]})
    time.sleep(1)
    for b in _sparql("SELECT ?q ?xl ?s WHERE { VALUES ?q { %s } ?q wdt:P180|wdt:P921 ?x . ?x rdfs:label ?xl FILTER(LANG(?xl)=\"en\") OPTIONAL { ?x wdt:P21 ?s } }" % vals):
        out.append({"q": b["q"], "k": {"value": "d"}, "xl": b["xl"], **({"s": b["s"]} if "s" in b else {})})
    return out


def wd_fetch(qids, cache):
    todo = sorted(q for q in qids if q not in cache)
    if not todo:
        return
    CACHE.mkdir(parents=True, exist_ok=True)
    print(f"Wikidata: {len(todo)} QIDs to fetch ({len(qids) - len(todo)} cached)", flush=True)
    with open(CACHE / "wd.jsonl", "a", encoding="utf-8") as fh:
        for i in range(0, len(todo), BATCH):
            chunk = todo[i:i + BATCH]
            rows = wdqs(chunk)
            by = {q: {"q": q, "g": [], "d": [], "s": []} for q in chunk}
            for b in rows:
                q = b["q"]["value"].rsplit("/", 1)[-1]
                lab = b["xl"]["value"]
                e = by[q]
                (e["g"] if b["k"]["value"] == "g" else e["d"]).append(lab)
                if "s" in b:
                    e["s"].append(b["s"]["value"].rsplit("/", 1)[-1])
            for q in chunk:
                e = by[q]
                for k in ("g", "d", "s"):
                    e[k] = sorted(set(e[k]))
                cache[q] = e
                fh.write(json.dumps(e, ensure_ascii=False) + "\n")
            fh.flush()
            print(f"  {min(i + BATCH, len(todo))}/{len(todo)}", flush=True)
            time.sleep(1)


def main():
    offline = "--offline" in sys.argv
    ids = (ROOT / "data" / "gallery" / "ids.txt").read_text().splitlines()
    titles = {}
    for f in sorted(glob.glob(str(ROOT / "data" / "corpus" / "*.json"))):
        d = json.load(open(f, encoding="utf-8"))
        for x in (d.get("rows", d) if isinstance(d, dict) else d):
            titles.setdefault(x["id"], x.get("t") or "")
    qids = sorted({i.split("-", 1)[1] for i in ids if i.startswith("commons-Q")})
    cache = wd_cache_load()
    if not offline:
        wd_fetch(qids, cache)
    # AIC classification (the only museum subject-like field cached)
    aic = {}
    try:
        d = json.load(open(RAW / "aic" / "meta.json", encoding="utf-8"))
        for r in (d["rows"] if isinstance(d, dict) else d):
            aic[f"aic-{r['id']}"] = [str(c).lower() for c in (r.get("classification_titles") or [])]
    except Exception:
        pass
    aic_map = {"portrait": "portrait", "landscape": "landscape", "still life": "still life", "religious": "religious",
               "mythological": "mythological", "animal": "animal", "seascape": "seascape", "genre": "genre scene"}
    matchers = build_matchers()
    thing_ms = [m for m in matchers if m[1] == "t"]
    gen_of = {t: g for t, g, _ in matchers}

    # pass 1: authority labels per painting; count unmapped depicts labels
    auth = []   # per painting: set of tags
    unmapped = collections.Counter()
    nomap = collections.Counter()   # depicts labels no phrase explains at all (the report to extend the tables from)
    pend = []   # per painting unmapped depicts labels
    for pid in ids:
        a, un = set(), []
        if pid.startswith("commons-Q"):
            w = cache.get(pid.split("-", 1)[1])
            if w:
                for lab in w["g"] + w["d"]:
                    if lab.lower() in JUNK:
                        continue
                    t = tags_in(lab, matchers)
                    if t:
                        a.update(t)
                    elif lab in w["d"] and lab.lower() not in ICON_STOP:
                        nomap[lab] += 1
                    if lab in w["d"] and not tags_in(lab, thing_ms):
                        un.append(lab)
                        unmapped[lab] += 1
                for s in w["s"]:
                    if s in GENDER:
                        a.add(GENDER[s])
        elif pid in aic:
            for c in aic[pid]:
                if c in aic_map:
                    a.add(aic_map[c])
        auth.append(a)
        pend.append(un)
    icons = [l for l, n in unmapped.most_common(ICON_MAX) if n >= ICON_MIN and len(l) > 2 and not l.isdigit() and l.lower() not in ICON_STOP]
    icon_set = set(icons)
    (CACHE).mkdir(parents=True, exist_ok=True)
    (CACHE / "unmapped.txt").write_text("\n".join(f"{n}\t{l}" for l, n in nomap.most_common(400)) + "\n", encoding="utf-8")

    # vocabulary: genres, things (only tags actually used), iconography
    used = collections.Counter()
    tit = []
    for pid, a in zip(ids, auth):
        t = set(tags_in(titles.get(pid, ""), matchers)) - a
        tit.append(t)
    for a, t in zip(auth, tit):
        used.update(a); used.update(t)
    tags = [t for g, tb in GROUPS for t in tb if used[t]]
    grp = [gen_of[t] if False else next(g for g, tb in GROUPS if t in tb) for t in tags]
    have = {t.lower() for t in tags}
    icons = [l for l in icons if l.lower() not in have]
    icon_set = set(icons)
    for l in sorted(icons):
        tags.append(l); grp.append("i")
    ix = {t: i for i, t in enumerate(tags)}
    ia, it = [], []
    for a, un, t in zip(auth, pend, tit):
        s = {ix[x] for x in a if x in ix} | {ix[l] for l in un if l in icon_set}
        ia.append(sorted(s))
        it.append(sorted(ix[x] for x in t if x in ix and ix[x] not in s))

    # provenance counts
    def src(pid):
        return "wikidata" if pid.startswith("commons-Q") else pid.split("-", 1)[0]
    gset = {i for i, g in enumerate(grp) if g == "g"}
    tset = {i for i, g in enumerate(grp) if g == "t"}
    prov = collections.OrderedDict()
    for pid, x, y in zip(ids, ia, it):
        p = prov.setdefault(src(pid), collections.Counter())
        p["n"] += 1
        for nm, lst in (("authority", x), ("title", y)):
            if lst: p[nm + "_any"] += 1
            if any(i in gset for i in lst): p[nm + "_genre"] += 1
            if any(i in tset for i in lst): p[nm + "_thing"] += 1
        if any(i in gset for i in x + y): p["genre"] += 1
        if any(i in tset for i in x + y): p["thing"] += 1
        if x or y: p["any"] += 1
    # keep the model-detected "im" (tools/subjects_clip.py) by painting id, remapped by tag NAME in case indices moved
    im = [[] for _ in ids]
    old_prov_im = None
    try:
        old = json.load(open(ROOT / "data" / "gallery" / "subjects.json", encoding="utf-8"))
        oids = (ROOT / "data" / "gallery" / "ids.txt").read_text().splitlines()
        old_prov_im = (old.get("prov") or {}).get("im")
        byid = {pid: x for pid, x in zip(oids, old.get("im") or []) if x}
        for k, pid in enumerate(ids):
            im[k] = [[ix[old["tags"][t]], c] for t, c in byid.get(pid, []) if old["tags"][t] in ix]
    except Exception:
        pass
    out = {"v": 1, "tags": tags, "grp": grp, "ia": ia, "it": it, "im": im,
           "prov": {k: dict(v) for k, v in prov.items()}}
    if old_prov_im:
        out["prov"]["im"] = old_prov_im
    (ROOT / "data" / "gallery" / "subjects.json").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"subjects.json: {len(ids)} paintings, {len(tags)} tags ({len(icons)} iconography)")


if __name__ == "__main__":
    main()
