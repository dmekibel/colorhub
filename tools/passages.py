#!/usr/bin/env python3
"""ColorHub passages pipeline: color in literature, from US public-domain texts only.

  python3 tools/passages.py --fetch              # download every work in WORKS (cached in research/_raw/passages/)
  python3 tools/passages.py --candidates [key..] # rank color-heavy paragraphs per work -> research/_raw/passages/cand/<key>.txt
  python3 tools/passages.py --find key "phrase"  # show the paragraph(s) containing a phrase, with their numbers
  python3 tools/passages.py                      # build data/passages.json from PICKS and IMAGES (end of this file)
  python3 tools/passages.py --check              # validate data/passages.json and data/films.js
  python3 tools/passages.py --films a.json b.json # write data/films.js from film records (JSON arrays), sorted by year

Sources: Project Gutenberg through its mirror (mirrors.xmission.com, per the PG robot policy: no crawling of
www.gutenberg.org), plus a few texts from other public-domain archives listed in EXTRA. Every work here was
first published (and, for translations, the translation was published) before 1930. Reasoning per work:
research/PASSAGES-FILMS.md.

Each passage: id, title, author, work, year, translator, trYear, loc, source, text, context, imgs, colors (unique, in order of
first mention: {name, h, app = nearest of the app's 101 colors, d = its CIEDE2000 distance, n = times named}) and mentions
([offset, length, color index]; the word itself is text[offset:offset+length]). Needs Python 3 with numpy.
"""
import json, re, sys, time, unicodedata, urllib.request
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "research" / "_raw" / "passages"
OUT = ROOT / "data" / "passages.json"
UA = "ColorHubBot/1.0 (https://github.com/dmekibel/colorhub)"
MIRROR = "https://mirrors.xmission.com/gutenberg"

# ---------------------------------------------------------------------------------------------
# The works. key: (Gutenberg id, author, work, first published, translator, translation year)
# A translation counts only if the translation itself was published before 1930.
# ---------------------------------------------------------------------------------------------
WORKS = {
    "melville-moby":       (2701, "Herman Melville", "Moby-Dick", 1851, None, None),
    "fitzgerald-gatsby":   (64317, "F. Scott Fitzgerald", "The Great Gatsby", 1925, None, None),
    "baum-oz":             (55, "L. Frank Baum", "The Wonderful Wizard of Oz", 1900, None, None),
    "woolf-dalloway":      (71865, "Virginia Woolf", "Mrs Dalloway", 1925, None, None),
    "woolf-jacob":         (5670, "Virginia Woolf", "Jacob's Room", 1922, None, None),
    "woolf-monday":        (29220, "Virginia Woolf", "Monday or Tuesday", 1921, None, None),
    "woolf-voyage":        (144, "Virginia Woolf", "The Voyage Out", 1915, None, None),
    "joyce-portrait":      (4217, "James Joyce", "A Portrait of the Artist as a Young Man", 1916, None, None),
    "joyce-ulysses":       (4300, "James Joyce", "Ulysses", 1922, None, None),
    "joyce-dubliners":     (2814, "James Joyce", "Dubliners", 1914, None, None),
    "hawthorne-scarlet":   (25344, "Nathaniel Hawthorne", "The Scarlet Letter", 1850, None, None),
    "hawthorne-mosses":    (512, "Nathaniel Hawthorne", "Mosses from an Old Manse", 1846, None, None),
    "goethe-colours":      (50572, "Johann Wolfgang von Goethe", "Theory of Colours", 1810, "Charles Lock Eastlake", 1840),
    "goethe-faust":        (14591, "Johann Wolfgang von Goethe", "Faust, Part One", 1808, "Bayard Taylor", 1870),
    "tolstoy-anna":        (1399, "Leo Tolstoy", "Anna Karenina", 1878, "Constance Garnett", 1901),
    "tolstoy-war":         (2600, "Leo Tolstoy", "War and Peace", 1869, "Louise and Aylmer Maude", 1923),
    "dostoevsky-crime":    (2554, "Fyodor Dostoevsky", "Crime and Punishment", 1866, "Constance Garnett", 1914),
    "dostoevsky-karamazov": (28054, "Fyodor Dostoevsky", "The Brothers Karamazov", 1880, "Constance Garnett", 1912),
    "chekhov-bishop":      (13419, "Anton Chekhov", "The Bishop and Other Stories", 1888, "Constance Garnett", 1919),
    "chekhov-lady":        (13415, "Anton Chekhov", "The Lady with the Dog and Other Stories", 1899, "Constance Garnett", 1917),
    "chekhov-darling":     (13416, "Anton Chekhov", "The Darling and Other Stories", 1899, "Constance Garnett", 1916),
    "turgenev-sportsman":  (8597, "Ivan Turgenev", "A Sportsman's Sketches", 1852, "Constance Garnett", 1895),
    "flaubert-bovary":     (2413, "Gustave Flaubert", "Madame Bovary", 1857, "Eleanor Marx-Aveling", 1886),
    "flaubert-salammbo":   (1290, "Gustave Flaubert", "Salammbô", 1862, "an unnamed translator", None),
    "zola-paradise":       (54726, "Émile Zola", "The Ladies' Paradise", 1883, "Ernest A. Vizetelly (ed.)", 1895),
    "zola-fat":            (5744, "Émile Zola", "The Fat and the Thin", 1873, "Ernest A. Vizetelly", 1896),
    "zola-masterpiece":    (15900, "Émile Zola", "His Masterpiece", 1886, "Ernest A. Vizetelly", 1902),
    "proust-swann":        (7178, "Marcel Proust", "Swann's Way", 1913, "C. K. Scott Moncrieff", 1922),
    "proust-grove":        (63532, "Marcel Proust", "Within a Budding Grove", 1919, "C. K. Scott Moncrieff", 1924),
    "proust-guermantes":   (73425, "Marcel Proust", "The Guermantes Way", 1920, "C. K. Scott Moncrieff", 1925),
    "hugo-notre-dame":     (2610, "Victor Hugo", "Notre-Dame de Paris", 1831, "Isabel F. Hapgood", 1888),
    "hugo-miserables":     (135, "Victor Hugo", "Les Misérables", 1862, "Isabel F. Hapgood", 1887),
    "wilde-dorian":        (174, "Oscar Wilde", "The Picture of Dorian Gray", 1891, None, None),
    "austen-pride":        (1342, "Jane Austen", "Pride and Prejudice", 1813, None, None),
    "austen-northanger":   (121, "Jane Austen", "Northanger Abbey", 1817, None, None),
    "bronte-jane":         (1260, "Charlotte Brontë", "Jane Eyre", 1847, None, None),
    "bronte-wuthering":    (768, "Emily Brontë", "Wuthering Heights", 1847, None, None),
    "dickens-bleak":       (1023, "Charles Dickens", "Bleak House", 1853, None, None),
    "dickens-expectations": (1400, "Charles Dickens", "Great Expectations", 1861, None, None),
    "dickens-hard-times":  (786, "Charles Dickens", "Hard Times", 1854, None, None),
    "dickens-carol":       (46, "Charles Dickens", "A Christmas Carol", 1843, None, None),
    "hardy-native":        (122, "Thomas Hardy", "The Return of the Native", 1878, None, None),
    "hardy-tess":          (110, "Thomas Hardy", "Tess of the d'Urbervilles", 1891, None, None),
    "conrad-heart":        (219, "Joseph Conrad", "Heart of Darkness", 1899, None, None),
    "chopin-awakening":    (160, "Kate Chopin", "The Awakening", 1899, None, None),
    "wharton-mirth":       (284, "Edith Wharton", "The House of Mirth", 1905, None, None),
    "wharton-innocence":   (541, "Edith Wharton", "The Age of Innocence", 1920, None, None),
    "wharton-frome":       (4517, "Edith Wharton", "Ethan Frome", 1911, None, None),
    "cather-antonia":      (242, "Willa Cather", "My Ántonia", 1918, None, None),
    "cather-pioneers":     (24, "Willa Cather", "O Pioneers!", 1913, None, None),
    "gilman-yellow":       (1952, "Charlotte Perkins Gilman", "The Yellow Wallpaper", 1892, None, None),
    "poe-masque":          (1064, "Edgar Allan Poe", "The Masque of the Red Death", 1842, None, None),
    "poe-pym":             (51060, "Edgar Allan Poe", "The Narrative of Arthur Gordon Pym", 1838, None, None),
    "carroll-alice":       (11, "Lewis Carroll", "Alice's Adventures in Wonderland", 1865, None, None),
    "carroll-glass":       (12, "Lewis Carroll", "Through the Looking-Glass", 1871, None, None),
    "murasaki-genji-1":    (66057, "Murasaki Shikibu", "The Tale of Genji, vol. 1", 1010, "Arthur Waley", 1925),
    "murasaki-genji-2":    (67111, "Murasaki Shikibu", "The Sacred Tree (The Tale of Genji, vol. 2)", 1010, "Arthur Waley", 1926),
    "murasaki-genji-3":    (75852, "Murasaki Shikibu", "A Wreath of Cloud (The Tale of Genji, vol. 3)", 1010, "Arthur Waley", 1927),
    "murasaki-genji-4":    (77408, "Murasaki Shikibu", "Blue Trousers (The Tale of Genji, vol. 4)", 1010, "Arthur Waley", 1928),
    "sei-pillow":          (76016, "Sei Shōnagon", "The Pillow-Book", 1002, "Arthur Waley", 1928),
    "nights-burton-1":     (3435, "Anonymous", "The Book of the Thousand Nights and a Night, vol. 1", 900, "Richard F. Burton", 1885),
    "nights-lane-1":       (34206, "Anonymous", "The Thousand and One Nights, vol. 1", 900, "Edward William Lane", 1839),
    "cervantes-quixote":   (996, "Miguel de Cervantes", "Don Quixote", 1605, "John Ormsby", 1885),
    "dante-purgatory":     (1996, "Dante Alighieri", "Purgatory", 1320, "Charles Eliot Norton (prose)", 1891),
    "dante-paradise":      (1997, "Dante Alighieri", "Paradise", 1320, "Charles Eliot Norton (prose)", 1892),
    "ruskin-elements":     (30325, "John Ruskin", "The Elements of Drawing", 1857, None, None),
    "ruskin-modern-1":     (29907, "John Ruskin", "Modern Painters, vol. 1", 1843, None, None),
    "ruskin-stones-2":     (30755, "John Ruskin", "The Stones of Venice, vol. 2", 1853, None, None),
    "pater-renaissance":   (2398, "Walter Pater", "The Renaissance", 1873, None, None),
    "hearn-glimpses":      (8130, "Lafcadio Hearn", "Glimpses of Unfamiliar Japan", 1894, None, None),
    "hearn-kokoro":        (8882, "Lafcadio Hearn", "Kokoro", 1896, None, None),
    "hearn-east":          (55802, "Lafcadio Hearn", "Out of the East", 1895, None, None),
    "crane-badge":         (73, "Stephen Crane", "The Red Badge of Courage", 1895, None, None),
    "crane-boat":          (45524, "Stephen Crane", "The Open Boat and Other Stories", 1898, None, None),
    "thoreau-walden":      (205, "Henry David Thoreau", "Walden", 1854, None, None),
    "thoreau-excursions":  (9846, "Henry David Thoreau", "Excursions", 1863, None, None),
    "twain-mississippi":   (245, "Mark Twain", "Life on the Mississippi", 1883, None, None),
    "eliot-middlemarch":   (145, "George Eliot", "Middlemarch", 1872, None, None),
    "montgomery-anne":     (45, "L. M. Montgomery", "Anne of Green Gables", 1908, None, None),
    "wells-war":           (36, "H. G. Wells", "The War of the Worlds", 1898, None, None),
    "london-scarlet":      (21970, "Jack London", "The Scarlet Plague", 1912, None, None),
    "chesterton-trifles":  (8092, "G. K. Chesterton", "Tremendous Trifles", 1909, None, None),
    "kandinsky-spiritual": (5321, "Wassily Kandinsky", "Concerning the Spiritual in Art", 1911, "Michael Sadleir", 1914),
    "newton-opticks":      (33504, "Isaac Newton", "Opticks", 1704, None, None),
    "leonardo-notebooks":  (5000, "Leonardo da Vinci", "The Notebooks", 1519, "Jean Paul Richter", 1888),
    "vitruvius":           (20239, "Vitruvius", "The Ten Books on Architecture", -20, "Morris Hicky Morgan", 1914),
    "stendhal-red":        (44747, "Stendhal", "The Red and the Black", 1830, "Horace B. Samuel", 1916),
    "balzac-unknown":      (23060, "Honoré de Balzac", "The Unknown Masterpiece", 1831, "an unnamed translator", None),
    "cao-red-chamber":     (9603, "Cao Xueqin", "Hung Lou Meng (Dream of the Red Chamber), book 1", 1791, "H. Bencraft Joly", 1892),
    "homer-odyssey":       (1727, "Homer", "The Odyssey", -700, "Samuel Butler (prose)", 1900),
    "homer-iliad":         (2199, "Homer", "The Iliad", -750, "Samuel Butler (prose)", 1898),
    "huysmans-against":    (12341, "Joris-Karl Huysmans", "Against the Grain", 1884, "John Howard", 1922),
    "okakura-tea":         (769, "Okakura Kakuzō", "The Book of Tea", 1906, None, None),
    "doyle-scarlet":       (244, "Arthur Conan Doyle", "A Study in Scarlet", 1887, None, None),
    "doyle-adventures":    (1661, "Arthur Conan Doyle", "The Adventures of Sherlock Holmes", 1892, None, None),
    "mansfield-bliss":     (44385, "Katherine Mansfield", "Bliss and Other Stories", 1920, None, None),
    "lawrence-rainbow":    (28948, "D. H. Lawrence", "The Rainbow", 1915, None, None),
    "lawrence-women":      (4240, "D. H. Lawrence", "Women in Love", 1920, None, None),
    "mann-venice":         (66073, "Thomas Mann", "Death in Venice", 1912, "Kenneth Burke", 1925),
    "burnett-garden":      (113, "Frances Hodgson Burnett", "The Secret Garden", 1911, None, None),
    "kalidasa-shakuntala": (16659, "Kālidāsa", "Shakuntala and Other Works", 400, "Arthur W. Ryder", 1912),
    "polo-travels":        (10636, "Marco Polo", "The Travels of Marco Polo, vol. 1", 1300, "Henry Yule (rev. Henri Cordier)", 1903),
    "bible-kjv":           (10, "The Bible", "King James Version", 1611, None, None),
    "tagore-home":         (7166, "Rabindranath Tagore", "The Home and the World", 1916, "Surendranath Tagore", 1919),
}

# ---------------------------------------------------------------------------------------------
# Color words. Each entry: regex (case-insensitive, whole word) -> (display name, hex or None to look up).
# None = take the hex from the app's 101 colors, else from data/library.json. A hex given here is our own
# screen approximation of what the word meant in older English (e.g. "rose" = a soft pink-red, not #FF0080).
# Ambiguous words (rose, orange, olive, cream, lime, plum...) count only in clearly color-like forms.
# ---------------------------------------------------------------------------------------------
LEX = [
    # compounds first (longest match wins)
    (r"blood[- ]red", "Blood red", None), (r"sea[- ]green", "Sea green", None), (r"sea[- ]blue", "Sea blue", "#2E6F95"),
    (r"snow[- ]white|snowy", "Snow white", "#FFFAFA"), (r"milk[- ]white|milky", "Milk white", "#F3F1E7"),
    (r"jet[- ]black|coal[- ]black|pitch[- ]black|raven[- ]black|ink[- ]black|inky", "Jet black", "#131516"),
    (r"sky[- ]blue", "Sky blue", None), (r"pea[- ]green", "Pea green", None), (r"bottle[- ]green", "Bottle green", None),
    (r"grass[- ]green", "Grass green", "#5CAC2D"), (r"apple[- ]green", "Apple green", "#8DB600"), (r"olive[- ](?:green|colou?red)", "Olive green", "#6B7A2E"),
    (r"emerald[- ]green", "Emerald", None), (r"rose[- ]red", "Rose red", None), (r"rose[- ]pink", "Rose pink", "#E8879C"),
    (r"rose[- ]colou?r(?:ed)?|rosy|roseate", "Rose", "#E37B93"),
    (r"flame[- ]colou?r(?:ed)?", "Flame", None), (r"lemon[- ](?:yellow|colou?red)", "Lemon yellow", None),
    (r"straw[- ]colou?r(?:ed)?", "Straw", None), (r"cream[- ]colou?r(?:ed)?|creamy", "Cream", None),
    (r"primrose(?:[- ]yellow)?", "Primrose", "#EDE18E"), (r"steel[- ]blue", "Steel blue", None), (r"steel[- ]gr[ae]y", "Steel grey", None),
    (r"iron[- ]gr[ae]y", "Iron grey", None), (r"ash[- ]gr[ae]y|ashen", "Ash grey", None), (r"slate[- ](?:gr[ae]y|colou?red|blue)", "Slate", None),
    (r"pearl[- ]gr[ae]y", "Pearl grey", "#CBCBC3"), (r"dove[- ](?:gr[ae]y|colou?red)", "Dove grey", "#9A9590"),
    (r"peacock[- ]blue", "Peacock blue", None), (r"prussian blue", "Prussian blue", None), (r"cobalt[- ]blue", "Cobalt", None),
    (r"plum[- ]colou?r(?:ed)?", "Plum", None), (r"wine[- ]colou?r(?:ed)?|wine[- ]dark", "Wine", None), (r"claret(?:[- ]colou?red)?", "Claret", None),
    (r"cherry[- ](?:colou?r(?:ed)?|red)", "Cherry", None), (r"lemon[- ]colou?r(?:ed)?", "Lemon", None),
    (r"brick[- ]red", "Brick", None), (r"copper[- ]colou?r(?:ed)?|coppery", "Copper", None), (r"fawn[- ]colou?r(?:ed)?", "Fawn", None),
    (r"orange[- ](?:colou?r(?:ed)?|tawny|red|yellow)", "Orange", None), (r"lime[- ]green", "Lime", None),
    (r"lilac[- ]colou?r(?:ed)?", "Lilac", None), (r"tyrian purple|tyrian", "Tyrian purple", None),
    (r"burnt sienna", "Burnt sienna", None), (r"raw umber", "Raw umber", None), (r"yellow ochre", "Yellow ochre", None),
    (r"emerald(?:s)?", "Emerald", None), (r"rub(?:y|ies)", "Ruby", None), (r"sapphires?", "Sapphire", None), (r"amethysts?", "Amethyst", None),
    (r"turquoises?", "Turquoise", None), (r"jade", "Jade", None), (r"opal(?:s|ine|escent)?", "Opal", None), (r"pearly|pearl", "Pearl", "#EAE6DA"),
    (r"amber", "Amber", None), (r"ivory", "Ivory", None), (r"ebony", "Ebony", "#1E1B18"), (r"coral", "Coral", None),
    (r"crimson(?:ed|ing)?", "Crimson", None), (r"scarlet", "Scarlet", None), (r"vermill?ion", "Vermilion", None), (r"carmine", "Carmine", None),
    (r"cinnabar", "Cinnabar", None), (r"madder", "Madder", "#A8323C"), (r"cochineal", "Cochineal", "#9B1B30"),
    (r"maroon", "Maroon", None), (r"russet", "Russet", None), (r"tawny", "Tawny", None), (r"auburn", "Auburn", "#8E4A2C"),
    (r"hazel", "Hazel", None), (r"chestnut", "Chestnut", None), (r"copper", "Copper", None), (r"bronzed?", "Bronze", None),
    (r"saffron", "Saffron", None), (r"och(?:re|er)", "Ochre", None), (r"umber", "Umber", None), (r"sienna", "Sienna", None), (r"sepia", "Sepia", None),
    (r"sable", "Sable", "#1D1A17"), (r"dun", "Dun", "#A08B6C"), (r"livid", "Livid", "#6E7F99"), (r"sallow", "Sallow", "#C8B67E"),
    (r"flaxen", "Flax", None), (r"ruddy", "Ruddy", "#B5523B"), (r"sanguine", "Sanguine", "#8A2A1E"),
    (r"indigo", "Indigo", None), (r"ultramarine", "Ultramarine", None), (r"azure", "Azure", None), (r"cerulean", "Cerulean", None), (r"cobalt", "Cobalt", None),
    (r"lilac", "Lilac", None), (r"lavender", "Lavender", None), (r"mauve", "Mauve", None), (r"magenta", "Magenta", None),
    (r"heliotrope", "Heliotrope", None), (r"violet", "Violet", "#7F4FC9"), (r"puce", "Puce", None), (r"cerise", "Cerise", None),
    (r"verdigris", "Verdigris", None), (r"khaki", "Khaki", None), (r"beige", "Beige", None), (r"buff", "Buff", None), (r"drab", "Drab", None),
    (r"gold(?:en)?|gilt|gilded", "Gold", None), (r"silver(?:y|ed)?", "Silver", None), (r"leaden", "Lead grey", "#6B6E73"),
    (r"verdant", "Green", None), (r"hoary|grizzled", "Grey", None),
    # the basic words and their forms
    (r"red(?:dish|ness|der|dest|dened|dening|den)?|reds", "Red", None),
    (r"green(?:ish|ness|er|est)?", "Green", None),
    (r"blu(?:e|ish|eish|eness|er|est)", "Blue", None),
    (r"yellow(?:ish|ness|ed|ing)?", "Yellow", None),
    (r"whit(?:e|ish|eness|er|est|ened|ening|en)|whites", "White", None),
    (r"black(?:ish|ness|er|est|ened|ening)?", "Black", None),
    (r"gr[ae]y(?:ish|ness|ing|er)?", "Grey", None),
    (r"brown(?:ish|ness|ed)?", "Brown", None),
    (r"purpl(?:e|ish|ed)|empurpled", "Purple", None),
    (r"pink(?:ish|y)?", "Pink", None),
    (r"orange", "Orange", None),
]


IMAGES = {}   # work key -> [{src, w, h, alt, caption, credit, license, licenseUrl, commons}] (filled at the end of this file)

# ---------------------------------------------------------------------------------------------
# color math (shared with tools/paintings.py)
# ---------------------------------------------------------------------------------------------
sys.path.insert(0, str(Path(__file__).resolve().parent))
from paintings import rgb_to_lab, de2000, hex_to_rgb  # noqa: E402


def app_colors():
    W = {}
    src = (ROOT / "data" / "colors.js").read_text()
    m = re.search(r"window\.DATA\s*=\s*", src)
    body = src[m.end():].rstrip().rstrip(";")
    # colors.js is a JS object literal; pull basics and unit colors with regexes rather than a JS engine
    basics = re.findall(r'\[\s*"([^"]+)"\s*,\s*"(#[0-9A-Fa-f]{6})"\s*\]', body)
    units = re.findall(r'\bn\s*:\s*"([^"]+)"\s*,\s*h\s*:\s*"(#[0-9A-Fa-f]{6})"', body)
    for n, h in basics + units:
        W[n] = h.upper()
    return W


APP = app_colors()
LIB = {}
for x in json.loads((ROOT / "data" / "library.json").read_text()):
    if not x.get("crude"):
        LIB.setdefault(x["n"].lower(), x)
_APP_NAMES = list(APP)
_APP_LAB = rgb_to_lab(np.array([hex_to_rgb(APP[n]) for n in _APP_NAMES]))


def nearest_app(h):
    d = de2000(rgb_to_lab(np.array([hex_to_rgb(h)])), _APP_LAB)[0]
    i = int(np.argmin(d))
    return _APP_NAMES[i], float(d[i])


def resolve(name, hx):
    if hx:
        return hx.upper()
    for n, h in APP.items():
        if n.lower() == name.lower():
            return h
    x = LIB.get(name.lower())
    if x:
        return x["h"].upper()
    raise SystemExit(f"no hex for {name}")


LEXR = [(re.compile(r"(?<![\w])(?:%s)(?![\w])" % rx, re.I), name, resolve(name, hx)) for rx, name, hx in LEX]


def mentions(text, skip=()):
    """Every color word in text: [{w, at, len, name, h, app}], longest/earliest match first, no overlaps."""
    found = []
    for rx, name, h in LEXR:
        for m in rx.finditer(text):
            found.append((m.start(), m.end(), name, h, m.group(0)))
    found.sort(key=lambda f: (f[0], -(f[1] - f[0])))
    out, end = [], -1
    for a, b, name, h, w in found:
        if a < end:
            continue
        # skip words listed per pick, and capitalised words mid-sentence: names (Mr. Brown, the Red Sea, Green Park)
        if w.lower() in skip or w in skip:
            continue
        before = text[max(0, a - 6):a]
        if w[0].isupper() and a > 0 and (re.search(r"\b(?:Mr|Mrs|Miss|Dr|Mme|Mlle|St)\.?\s*$", before) or not re.search(r"[.!?\"“‘'(\n]\s*$", text[max(0, a - 3):a])) and not w.isupper():
            continue
        end = b
        app, d = (name, 0.0) if name in APP else nearest_app(h)
        out.append({"w": w, "at": a, "len": b - a, "name": name, "h": h, "app": app, "d": round(d, 1)})
    return out


# ---------------------------------------------------------------------------------------------
# texts
# ---------------------------------------------------------------------------------------------
def pg_path(i):
    s = str(i)
    return "/".join(list(s[:-1]) or ["0"]) + f"/{s}"


def fetch_text(key):
    pid = WORKS[key][0]
    dst = RAW / f"{key}.txt"
    if dst.exists():
        return dst.read_text(encoding="utf-8")
    base = f"{MIRROR}/{pg_path(pid)}"
    for name, enc in ((f"{pid}-0.txt", "utf-8"), (f"{pid}.txt", "latin-1"), (f"{pid}-8.txt", "latin-1"), (f"{pid}-0.txt", "utf-8")):
        try:
            req = urllib.request.Request(f"{base}/{name}", headers={"User-Agent": UA})
            raw = urllib.request.urlopen(req, timeout=60).read()
            try:
                txt = raw.decode("utf-8")
            except UnicodeDecodeError:
                txt = raw.decode(enc, errors="replace")
            dst.write_text(txt, encoding="utf-8")
            time.sleep(1.5)
            return txt
        except Exception:
            continue
    # fallback: the mirror's cache tree
    url = f"{MIRROR}/cache/epub/{pid}/pg{pid}.txt"
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    txt = urllib.request.urlopen(req, timeout=60).read().decode("utf-8", errors="replace")
    dst.write_text(txt, encoding="utf-8")
    time.sleep(1.5)
    return txt


def body_of(txt):
    a = re.search(r"\*\*\*\s*START OF (?:THE|THIS) PROJECT GUTENBERG[^\n]*\n", txt)
    b = re.search(r"\*\*\*\s*END OF (?:THE|THIS) PROJECT GUTENBERG", txt)
    return txt[a.end() if a else 0: b.start() if b else len(txt)]


HEAD = re.compile(r"^(?:CHAPTER|Chapter|BOOK|Book|PART|Part|CANTO|Canto|STAVE|Stave|LETTER|SECTION|ACT|Act|SCENE|Scene|NIGHT|VOLUME|[IVXLC]+\.?$|[IVXLC]+\.\s|\d+\.?\s*$)")


def paragraphs(key):
    """[(text, loc)] with hard wraps undone and _italics_ marks removed; loc = the last heading seen."""
    txt = body_of(fetch_text(key)).replace("\r\n", "\n")
    out, loc = [], ""
    for block in re.split(r"\n\s*\n", txt):
        lines = [l.strip() for l in block.strip().split("\n")]
        t = " ".join(l for l in lines if l)
        t = re.sub(r"\s+", " ", t).strip()
        t = re.sub(r"(?<![\w])_([^_]+)_(?![\w])", r"\1", t)
        t = t.replace("--", "—")
        if not t:
            continue
        if len(t) < 90 and (HEAD.match(t) or (t.isupper() and len(t) > 3)):
            loc = t.rstrip(".").strip()
            if len(loc) > 70:
                loc = loc[:70]
            continue
        out.append((t, loc))
    return out


# ---------------------------------------------------------------------------------------------
# candidates for curation
# ---------------------------------------------------------------------------------------------
def candidates(keys, top=14):
    (RAW / "cand").mkdir(exist_ok=True)
    for key in keys:
        paras = paragraphs(key)
        scored = []
        for i, (t, loc) in enumerate(paras):
            if len(t) < 160 or len(t) > 2600:
                continue
            ms = mentions(t)
            if len(ms) < 2:
                continue
            distinct = len({m["name"] for m in ms})
            score = (len(ms) + 1.5 * distinct) / (len(t) / 400) ** 0.5
            scored.append((score, i, t, loc, ms))
        scored.sort(reverse=True)
        with open(RAW / "cand" / f"{key}.txt", "w") as f:
            f.write(f"# {key}: {WORKS[key][1]}, {WORKS[key][2]} — {len(paras)} paragraphs\n\n")
            for score, i, t, loc, ms in scored[:top]:
                marked, last = "", 0
                for m in ms:
                    marked += t[last:m["at"]] + "«" + t[m["at"]:m["at"] + m["len"]] + "»"
                    last = m["at"] + m["len"]
                marked += t[last:]
                f.write(f"[{i}] score {score:.1f} · {loc} · {len(t)} chars\n{marked}\n\n")
        print(key, len(paras), "paragraphs,", len(scored), "color-rich")


def find(key, phrase):
    for i, (t, loc) in enumerate(paragraphs(key)):
        if phrase.lower() in t.lower():
            print(f"[{i}] {loc} · {len(t)} chars\n{t}\n")


# ---------------------------------------------------------------------------------------------
# build
# ---------------------------------------------------------------------------------------------
def slug(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


SMALL = {"of", "the", "and", "a", "an", "in", "on", "to", "at", "by", "for", "with", "or"}


def nice_loc(s):
    """'CHAPTER 42. THE WHITENESS OF THE WHALE' -> 'Chapter 42. The Whiteness of the Whale'; a bare 'IV' -> 'Chapter IV'."""
    s = s.strip().rstrip(".").strip()
    if re.fullmatch(r"[IVXLC]+|\d+", s):
        return "Chapter " + s
    out = []
    for i, w in enumerate(s.split()):
        if w.isupper() and len(w) > 1 and not re.fullmatch(r"[IVXLC]+\.?", w):
            w = w.lower() if (i and w.lower() in SMALL and not out[-1].endswith((".", ":"))) else w.capitalize()
        out.append(w)
    return " ".join(out)


def locate(paras, anchor):
    hits = [i for i, (t, _) in enumerate(paras) if anchor in t]
    if len(hits) != 1:
        raise SystemExit(f"anchor {anchor!r}: {len(hits)} matches")
    return hits[0]


def build():
    picks = json.loads(PICKS.read_text()) if isinstance(PICKS, Path) else PICKS
    cache, out, ids = {}, [], set()
    for p in picks:
        key = p["work"]
        pid, author, work, year, tr, tr_year = WORKS[key]
        paras = cache.get(key) or cache.setdefault(key, paragraphs(key))
        i = locate(paras, p["anchor"])
        n = p.get("n", 1)
        text = "\n\n".join(t for t, _ in paras[i:i + n])
        if p.get("from"):
            a = text.find(p["from"])
            if a < 0:
                raise SystemExit(f"{p['title']}: from {p['from']!r} not found")
            text = text[a:]
        if p.get("to"):
            b = text.find(p["to"])
            if b < 0:
                raise SystemExit(f"{p['title']}: to {p['to']!r} not found")
            text = text[:b + len(p["to"])]
        if p.get("cut"):
            for c in p["cut"]:
                if c not in text:
                    raise SystemExit(f"{p['title']}: cut {c!r} not found")
                text = text.replace(c, " … ")
            text = re.sub(r"\s+…\s+", " … ", text)
        # editors' apparatus out: footnote markers [10] {3} [FN#2], [Footnote: …], [Illustration: …]
        text = re.sub(r"\[(?:Footnote|Illustration)[^\]]*\]", "", text)
        text = re.sub(r"\s?(?:\[(?:\d+|FN#\d+)\]|\{\d+\})", "", text)
        text = re.sub(r"[ \t]{2,}", " ", text).strip()
        ms = mentions(text, skip=set(p.get("skip", [])))
        if not ms:
            raise SystemExit(f"{p['title']}: no color words")
        pid_ = p.get("id") or slug(f"{author.split()[-1]}-{p['title']}")[:60]
        if pid_ in ids:
            raise SystemExit(f"duplicate id {pid_}")
        ids.add(pid_)
        colors, seen = [], {}
        for m in ms:
            if m["name"] not in seen:
                seen[m["name"]] = len(colors)
                colors.append({"name": m["name"], "h": m["h"], "app": m["app"], "d": m["d"], "n": 0})
            colors[seen[m["name"]]]["n"] += 1
        rec = {
            "id": pid_, "title": p["title"], "author": author, "work": work, "year": year,
            "translator": tr, "trYear": tr_year,
            "loc": p.get("loc") or nice_loc(paras[i][1] or ""),
            "source": f"https://www.gutenberg.org/ebooks/{pid}",
            "text": text,
            # compact: [offset, length, index into colors]; the word is text[offset:offset+length]
            "mentions": [[m["at"], m["len"], seen[m["name"]]] for m in ms],
            "colors": colors,
            "context": p["context"],
        }
        if p.get("tags"):
            rec["tags"] = p["tags"]
        # pictures: the work's public-domain/CC illustrations (IMAGES), in the pick's preferred order
        imgs = IMAGES.get(key, [])
        order = p.get("img", list(range(len(imgs))))
        if imgs and order:
            rec["imgs"] = [imgs[i] for i in order if i < len(imgs)]
        out.append(rec)
    out.sort(key=lambda r: (r["year"], r["author"], r["id"]))
    OUT.write_text(json.dumps({"v": 1, "passages": out}, ensure_ascii=False, separators=(",", ":")))
    print(f"{len(out)} passages, {len({r['author'] for r in out})} authors, {len({r['work'] for r in out})} works, "
          f"{OUT.stat().st_size // 1024} KB")


# ---------------------------------------------------------------------------------------------
# films: data/films.js from JSON records (written and fact-checked per research/PASSAGES-FILMS.md)
# ---------------------------------------------------------------------------------------------
FILM_KEYS = ["id", "title", "year", "director", "country", "early", "dek", "body", "img", "palette", "images", "colors", "facts", "links", "sources", "pd"]


def films(paths):
    recs = []
    for p in paths:
        recs += json.loads(Path(p).read_text())
    recs.sort(key=lambda f: (f["year"], f["title"]))
    lines = []
    for f in recs:
        f = {k: f[k] for k in FILM_KEYS if f.get(k) not in (None, "", [], {})}
        lines.append(json.dumps(f, ensure_ascii=False))
    head = ("// ColorHub films: how directors use color. Built by tools/passages.py --films; method and sources in research/PASSAGES-FILMS.md.\n"
            "// Films under copyright: original text only, no stills, no frame-sampled palettes; `colors` are named colors we chose to\n"
            "// illustrate the text (\"colors discussed\"). Early films (`early`, before 1930) are public domain in the US: `img` is a small\n"
            "// Wikimedia Commons copy in img/films/ and `palette` is sampled from that scan. Hex values are screen approximations.\n")
    (ROOT / "data" / "films.js").write_text(head + "window.FILMS = [\n" + ",\n".join(lines) + "\n];\n")
    print(f"{len(recs)} films -> data/films.js")


# ---------------------------------------------------------------------------------------------
# check (passages + films)
# ---------------------------------------------------------------------------------------------
HEX = re.compile(r"^#[0-9A-F]{6}$")


def check():
    errs, warns = [], []
    app_lower = {n.lower() for n in APP}
    d = json.loads(OUT.read_text())
    seen = set()
    for r in d["passages"]:
        w = f"passage {r['id']}"
        if r["id"] in seen:
            errs.append(f"{w}: duplicate id")
        seen.add(r["id"])
        for k in ("title", "author", "work", "year", "source", "text", "context"):
            if r.get(k) in (None, ""):
                errs.append(f"{w}: missing {k}")
        yr = r["trYear"] if r.get("translator") else r["year"]
        if yr is None:
            warns.append(f"{w}: translation year unknown (Gutenberg-cleared US public domain; see research/PASSAGES-FILMS.md)")
        elif yr >= 1930:
            errs.append(f"{w}: published {yr}, not before 1930")
        if not 120 <= len(r["text"]) <= 3200:
            warns.append(f"{w}: text is {len(r['text'])} chars")
        if len(r["context"]) > 420:
            errs.append(f"{w}: context {len(r['context'])} chars (max 420)")
        for im in r.get("imgs", []):
            for k in ("src", "credit", "license", "commons", "caption"):
                if not im.get(k):
                    errs.append(f"{w}: image missing {k}")
            if im.get("src") and not (ROOT / im["src"]).exists():
                errs.append(f"{w}: image {im['src']} missing")
        for at, ln, ci in r["mentions"]:
            word = r["text"][at:at + ln]
            if not mentions(word) or ci >= len(r["colors"]) or mentions(word)[0]["name"] != r["colors"][ci]["name"]:
                errs.append(f"{w}: mention at {at} ({word!r}) does not match its color")
        for c in r["colors"]:
            if not HEX.match(c["h"]) or c["app"].lower() not in app_lower:
                errs.append(f"{w}: color {c['name']} bad hex or app color")
        if len(r["title"]) > 48:
            errs.append(f"{w}: title over 48 chars")
    fp = ROOT / "data" / "films.js"
    films = []
    if fp.exists():
        src = fp.read_text()
        films = json.loads(src[src.index("["): src.rindex("]") + 1])
        fids = set()
        for f in films:
            w = f"film {f.get('id')}"
            if f["id"] in fids:
                errs.append(f"{w}: duplicate id")
            fids.add(f["id"])
            for k in ("title", "year", "director", "dek", "body", "colors", "links", "sources"):
                if not f.get(k):
                    errs.append(f"{w}: missing {k}")
            if len(f.get("dek", "")) > 110:
                errs.append(f"{w}: dek over 110 chars")
            words = sum(len(re.sub(r"\[\[([^\]|]+)\|?([^\]]*)\]\]", lambda m: m.group(2) or m.group(1), p).split()) for p in f.get("body", []))
            if not 140 <= words <= 320:
                errs.append(f"{w}: body is {words} words (150-300)")
            for p in f.get("body", []):
                for m in re.finditer(r"\[\[([^\]|]+)(?:\|[^\]]+)?\]\]", p):
                    if m.group(1).strip().lower() not in app_lower:
                        errs.append(f"{w}: link [[{m.group(1)}]] is not an app color")
                for q in re.findall(r"[“\"]([^”\"]+)[”\"]", p):
                    if len(q.split()) > 15:
                        errs.append(f"{w}: quote over 15 words: {q[:40]}…")
            if not 3 <= len(f.get("colors", [])) <= 5:
                errs.append(f"{w}: needs 3-5 colors discussed")
            for c in f.get("colors", []):
                if not HEX.match(c.get("h", "")) or c.get("app", "").lower() not in app_lower:
                    errs.append(f"{w}: color {c.get('name')} bad hex or app name")
            if f.get("early"):
                if f["year"] >= 1930:
                    errs.append(f"{w}: early film from {f['year']}")
                im = f.get("img") or {}
                for k in ("src", "credit", "license", "commons"):
                    if not im.get(k):
                        errs.append(f"{w}: img missing {k}")
                if im.get("src") and not (ROOT / im["src"]).exists():
                    errs.append(f"{w}: image {im['src']} missing")
                if f.get("palette") and abs(sum(c["share"] for c in f["palette"]) - 1) > .02:
                    errs.append(f"{w}: palette shares do not sum to 1")
            elif f.get("img") or f.get("palette"):
                errs.append(f"{w}: copyrighted film must not carry stills or sampled palettes (related-subject pictures go in images)")
            for im in f.get("images", []):
                for k in ("src", "credit", "license", "commons", "caption"):
                    if not im.get(k):
                        errs.append(f"{w}: image missing {k}")
                if im.get("src") and not (ROOT / im["src"]).exists():
                    errs.append(f"{w}: image {im['src']} missing")
    for m in warns:
        print("warn ", m)
    for m in errs:
        print("FAIL ", m)
    print(f"passages check: {len(errs)} failures, {len(warns)} warnings ({len(d['passages'])} passages, {len(films)} films)")
    return not errs


# =============================================================================================
# DATA: the curated picks (one per passage; see research/PASSAGES-FILMS.md for the method) and the pictures per work.
# =============================================================================================
PICKS = [
    {"work": "wharton-frome", "anchor": "Seen thus, from the pure and frosty darkness", "n": 2, "from": "Seen thus", "cut": ["By this time the music had stopped, and the musicians—a fiddler, and the young lady who played the harmonium on Sundays—were hastily refreshing themselves at one corner of the supper-table which aligned its devastated pie-dishes and ice-cream saucers on the platform at the end of the hall. "], "title": "The cherry-coloured scarf", "loc": "Chapter I", "context": "Ethan watches the church dance from the snowy dark outside. In a book drained to white, grey and black winter, the one warm color is the scarf on Mattie's head, and Wharton lets it fly loose in the reel so that Ethan, and the reader, can't look anywhere else."},
    {"work": "melville-moby", "anchor": "Aside from those more obvious considerations", "n": 2, "from": "It was the whiteness of the whale that above all", "to": "than that redness which affrights in blood.", "cut": ["even the barbaric, grand old kings of Pegu placing the title “Lord of the White Elephants” above all their other magniloquent ascriptions of dominion; and the modern kings of Siam unfurling the same snow-white quadruped in the royal standard; and the Hanoverian flag bearing the one figure of a snow-white charger; and the great Austrian Empire, Cæsarian, heir to overlording Rome, having for the imperial colour the same imperial hue; and though this pre-eminence in it applies to the human race itself, giving the white man ideal mastership over every dusky tribe; and though, besides, all this, ", "though among the Red Men of America the giving of the white belt of wampum was the deepest pledge of honor; ", "by the Persian fire worshippers, the white forked flame being held the holiest on the altar; and in the Greek mythologies, Great Jove himself being made incarnate in a snow-white bull; and though to the noble Iroquois, the midwinter sacrifice of the sacred White Dog was by far the holiest festival of their theology, that spotless, faithful creature being held the purest envoy they could send to the Great Spirit with the annual tidings of their own fidelity; and though directly from the Latin word for white, all Christian priests derive the name of one part of their sacred vesture, the alb or tunic, worn beneath the cassock; and though among the holy pomps of the Romish faith, white is specially employed in the celebration of the Passion of our Lord; "], "title": "The whiteness of the whale", "loc": "Chapter 42", "context": "Melville gives a whole chapter to one color. Ishmael lists white's noble meanings (brides, judges' ermine, the robes of the saved) and then says that joined to something terrible, white frightens more than the red of blood. The full list also carries the racial assumptions of 1851, trimmed here."},
    {"work": "melville-moby", "anchor": "Is it that by its indefiniteness it shadows forth", "title": "The colourless, all-colour of atheism", "loc": "Chapter 42", "context": "Here Ishmael borrows the physics of his day: white light holds every color, and surface colors were thought to be laid on from outside. He turns that science into dread. A white world is at once all colors and none, a blank that hides whatever lies beneath."},
    {"work": "fitzgerald-gatsby", "anchor": "distinguished nothing except a single green light", "title": "A single green light", "loc": "Chapter 1", "context": "Nick's first sight of Gatsby is a man reaching across dark water toward one small green light. Fitzgerald keeps it tiny and nameless here; only later do we learn it burns at the end of Daisy's dock, and many readers take it as the book's emblem of longing."},
    {"work": "fitzgerald-gatsby", "anchor": "He took out a pile of shirts and began throwing them", "n": 2, "title": "Such beautiful shirts", "loc": "Chapter 5", "context": "Gatsby shows Daisy his wealth as a soft heap of color: coral, apple-green, lavender, faint orange, monograms in indian blue. Fitzgerald names each shade the way a shop would, and the pile of pale, costly color moves Daisy to tears where talk could not."},
    {"work": "fitzgerald-gatsby", "anchor": "About halfway between West Egg and New York", "n": 2, "title": "The valley of ashes", "loc": "Chapter 2", "context": "Between the green lawns of the rich and the city lies a world drained to ash-grey, where even the men are grey. The only color left is an old billboard: huge blue eyes behind yellow spectacles, faded by sun and rain, which many readers see as a blind god watching over the waste."},
    {"work": "fitzgerald-gatsby", "anchor": "first picked out the green light at the end of Daisy", "n": 2, "title": "Gatsby believed in the green light", "loc": "Chapter 9", "context": "The closing pages return to the light from the first chapter and widen it to a whole nation's hope. Green, the color of go-ahead, of spring and of money, carries all three at once, and the dream is on a blue lawn, already turning to night."},
    {"work": "baum-oz", "anchor": "I am the Guardian of the Gates, and since you demand", "n": 5, "from": "I am the Guardian of the Gates", "title": "Green spectacles, locked on", "context": "In Baum's book the Emerald City comes with a rule: everyone who enters is fitted with green glasses, fastened with gold bands and locked with a key. It is a children's lesson in filters. A tinted lens changes every color behind it."},
    {"work": "baum-oz", "anchor": "Even with eyes protected by the green spectacles", "n": 2, "title": "Everything in the Emerald City", "context": "Seen through green lenses, the marble, the glass, the candy, the lemonade and even the sun's rays are green. Readers who know the 1939 film may be surprised that in the book Dorothy walks the yellow brick road in silver shoes; the ruby slippers were the film's change, made to show off Technicolor."},
    {"work": "baum-oz", "anchor": "Just to amuse myself, and keep the good people busy", "n": 3, "title": "No greener than any other city", "context": "The Wizard admits the trick: the city is no greener than any other, but people have worn green glasses so long that most believe it is made of emerald. The eye really does adapt to a tint worn for a long time, until the filtered world simply feels normal."},
    {"work": "hawthorne-scarlet", "anchor": "On the breast of her gown, in fine red cloth", "title": "The letter A in red and gold", "loc": "Chapter 2, The Market-Place", "context": "Hester turns her punishment into the finest needlework in town: fine red cloth ringed with flourishes of gold thread. In a colony whose sumptuary laws limited showy dress, the letter is both a badge of shame and a defiant ornament."},
    {"work": "hawthorne-scarlet", "anchor": "We have spoken of Pearl’s rich and luxuriant beauty", "n": 2, "from": "We have spoken of Pearl’s", "skip": ["Pearl"], "title": "The scarlet letter endowed with life", "loc": "Chapter 7, The Governor's Hall", "context": "Hester dresses her daughter in crimson velvet embroidered with gold, so the child becomes a walking copy of the letter. Bright red cloth was an expensive dyer's product in the 1600s, which makes the outfit a statement in a town of sad gray, brown and black."},
    {"work": "hawthorne-scarlet", "anchor": "The stigma gone, Hester heaved a long, deep sigh", "title": "A flood of sunshine", "loc": "Chapter 18", "context": "In the forest Hester unpins the letter, and Hawthorne lets color rush back: a crimson flush on her pale cheek, green leaves, yellow leaves turned to gold, gray trunks lit up. Here, many readers note, red stands for life returning rather than for sin."},
    {"work": "hawthorne-mosses", "anchor": "in the centre of Georgiana’s left cheek there was a singular mark", "to": "sway over all hearts.", "title": "A crimson stain upon the snow", "loc": "The Birthmark", "context": "Hawthorne makes the birthmark behave like real skin color: it vanishes when Georgiana blushes, because the whole cheek floods red, and stands out sharply when she turns pale. Her scientist husband comes to read the small crimson hand as the mark of mortality."},
    {"work": "hawthorne-mosses", "anchor": "Watch the stain of the rainbow fading out the sky", "title": "The crimson hand fades", "loc": "The Birthmark", "context": "Aylmer's potion works: the crimson hand fades from Georgiana's marble-pale cheek like a rainbow leaving the sky. Hawthorne compares the vanishing color to the most fleeting color in nature, and the story's ending shows what removing it costs."},
    {"work": "hawthorne-mosses", "anchor": "In the midst, by the shattered fountain, grew the magnificent shrub", "from": "In the midst, by the shattered fountain", "title": "Purple gems by the fountain", "loc": "Rappaccini's Daughter", "context": "Dr. Rappaccini's prize shrub bears purple blossoms that glow like gems and fill the pool with colored light, and Beatrice dresses to match it. The color is lovely and deadly at once. Some real poisonous plants, like foxglove and deadly nightshade, do have purple flowers."},
    {"work": "poe-masque", "anchor": "had long devastated the country", "title": "Blood was its Avatar", "context": "Poe's invented plague is named for its color, and its mark is scarlet stains on the face. Real diseases were named the same way, like scarlet fever and yellow fever, after what they did to the skin."},
    {"work": "poe-masque", "anchor": "It was a voluptuous scene, that masquerade", "cut": ["In many palaces, however, such suites form a long and straight vista, while the folding doors slide back nearly to the walls on either hand, so that the view of the whole extent is scarcely impeded. Here the case was very different, as might have been expected from the duke’s love of the bizarre. "], "title": "Seven rooms, seven colors", "context": "Prince Prospero's seven rooms run east to west: blue, purple, green, orange, white, violet, and a black room lit through blood-red panes. Each is lit only by fire through stained glass. Critics often read the sequence as the stages of a life, though Poe never says so."},
    {"work": "poe-pym", "anchor": "every possible shade of purple, like the hues", "from": "I am at a loss to give a distinct idea", "title": "Water in veins of purple", "loc": "Chapter 18", "context": "On the island of Tsalal, where nothing is white, Poe invents water striped with veins of purple that never mix. He compares it to changeable silk, which is woven with threads of two colors so the cloth shifts hue as it moves."},
    {"work": "poe-pym", "anchor": "The white ashy material fell now continually", "n": 3, "title": "The perfect whiteness of the snow", "loc": "Chapter 25", "context": "Pym's story breaks off in pure whiteness: falling white ash, a milky sea, pale birds, and a giant shrouded figure white as snow. After the all-black island, white becomes the color of the unknown. Readers often set this ending beside Melville's chapter on the whiteness of the whale, written 13 years later."},
    {"work": "gilman-yellow", "anchor": "One of those sprawling flamboyant patterns", "n": 4, "title": "A smouldering, unclean yellow", "context": "Gilman's narrator, confined to a room for a 'rest cure', describes the wallpaper with a painter's precision and a patient's disgust: smouldering, unclean yellow, lurid orange, a sickly sulphur tint. Gilman had been given that same treatment herself in the 1880s."},
    {"work": "gilman-yellow", "anchor": "There are always new shoots on the fungus", "n": 12, "to": "A yellow smell.", "title": "A yellow smell", "context": "The yellow spreads past the eye: it stains clothes and becomes a smell. Gilman separates good yellows like buttercups from 'old foul, bad' ones. Yellow has long carried both sides, sunlight and gold on one hand, age, illness and decay on the other."},
    {"work": "chopin-awakening", "anchor": "There was something extremely gorgeous about the appearance of the table", "title": "A table of yellow and gold", "loc": "Chapter 30", "context": "Edna's birthday dinner is built around one color: pale yellow satin, candles under yellow silk shades, yellow and red roses, silver and gold. Many readers see the golden table as Edna at the height of her new independence, just before it falls apart."},
    {"work": "chopin-awakening", "anchor": "Mrs. Highcamp was weaving a garland of roses", "n": 7, "title": "To paint in color rather than in words", "loc": "Chapter 30", "context": "A guest is crowned with yellow and red roses and draped in a white scarf, and another wishes she could paint 'in color rather than in words'. Gouvernail murmurs lines from Swinburne about Desire painted in red on a ground of gold, the same colors as the table."},
    {"work": "wharton-mirth", "anchor": "They had paused before the table on which the bride", "title": "The glow of the stones", "loc": "Book 1, Chapter 8", "context": "Lily Bart reads jewels the way a painter reads pigments: the milky gleam of pearls, rubies against velvet, sapphires made bluer by the diamonds around them. Each color is heightened by its setting, which is exactly what Lily wants for herself."},
    {"work": "wharton-mirth", "anchor": "The scenes were taken from old pictures", "title": "Living pictures", "loc": "Book 1, Chapter 12", "context": "Society women stage tableaux vivants, posed copies of famous paintings: a Goya, a Titian of gold on gold, a Van Dyck in black satin. The pastime was real in Gilded Age New York, and Wharton uses it to show women arranged and judged like pictures."},
    {"work": "wharton-innocence", "anchor": "his eye lit on a cluster of yellow roses", "title": "Yellow roses, not lilies", "loc": "Chapter 9", "context": "Archer sends his fiancée May white lilies of the valley every day. Sun-gold yellow roses, too rich and strong for her, go instead, without a card, to Ellen Olenska. Wharton lets two flower colors stand for two women and two kinds of life."},
    {"work": "wharton-innocence", "anchor": "ghastly greenish-yellow stone that the younger architects", "to": "full of modern Saxe.", "title": "Brownstone like cold chocolate sauce", "loc": "Chapter 9", "context": "Brownstone gave old New York its single brown, which Archer compares to cold chocolate sauce. The new greenish-yellow stone is meant as a fashionable protest, yet he sees his whole married future in its color, down to the purple satin and yellow tufts of the drawing room."},
    {"work": "wharton-frome", "anchor": "looking sideways around his coat-sleeve, he could just catch", "title": "Delicate blue shadows on the snow", "loc": "Chapter 9", "context": "On their last sleigh ride Ethan sees the winter woods as a painter would: black forest on white hills, pine trunks reddening in low sun, blue shadows on the snow, bluish cones like bronze. Shadows on snow really do look blue, because they are lit by the blue sky rather than the sun."},
    {"work": "wharton-frome", "anchor": "through her hair she had run a streak of crimson ribbon", "title": "A dish of gay red glass", "loc": "Chapter 4", "context": "With Zeena away, Mattie wears a crimson ribbon and sets the table with the red glass pickle dish that Zeena keeps unused on a high shelf. In a book of snow and gray farmhouses, Wharton saves red for Mattie: earlier a cherry-colored scarf, here the ribbon and the dish whose breaking gives the pair away."},
    {"work": "cather-antonia", "anchor": "Everywhere, as far as the eye could reach, there was nothing but rough", "n": 3, "from": "Everywhere, as far as the eye could reach", "title": "The colour of wine-stains", "loc": "Book I, Chapter 2", "context": "Jim's first morning on the Nebraska prairie, before the ploughing: the tall grass of autumn is red, and the whole country looks like wine stains or fresh seaweed. Big bluestem, a main prairie grass, does turn a copper red in fall."},
    {"work": "cather-antonia", "anchor": "the miles of copper-red grass were drenched in sunlight", "title": "Copper-red grass, red-gold corn", "loc": "Book I, Chapter 6", "context": "Cather paints the late-afternoon prairie as a burning bush: copper-red grass, red-gold corn, rosy haystacks. Low sun pushes every color toward red and gold, the light photographers now call the golden hour."},
    {"work": "cather-antonia", "anchor": "We sat looking off across the country, watching the sun go down", "n": 3, "title": "A picture writing on the sun", "loc": "Book II, Chapter 14", "context": "The book's most famous image: a plough left in a field, magnified and black against the red disk of the setting sun. Moments later it shrinks back to an ordinary tool, and many readers take it as Cather's picture of the pioneer age, heroic and then gone."},
    {"work": "cather-pioneers", "anchor": "They made a pretty picture in the strong sunlight", "from": "They made a pretty picture", "to": "like the sparks from a forge.", "title": "The color of sunflower honey", "loc": "Part II, Chapter 6", "context": "Carl studies Marie's eyes like a color sample: a brown iris slashed with yellow, 'the color of sunflower honey, or of old amber'. Cather sets the fair Swedish Alexandra, white and gold, beside the quick, brown, sparkling Marie."},
    {"work": "crane-badge", "anchor": "He was being looked at by a dead man", "title": "Blue faded to green", "loc": "Chapter 7", "context": "Crane writes death as color change: a blue uniform faded to a melancholy green, a red mouth turned yellow, gray skin. Crane had never seen a battle when he wrote the novel, and he built much of its war out of color."},
    {"work": "crane-badge", "anchor": "He now sprang to his feet and, going closer", "n": 5, "title": "Pasted in the sky like a wafer", "loc": "Chapter 9", "context": "The novel's most quoted line closes the chapter where Jim Conklin dies. A wafer then could be a small disk of colored paste used to seal letters, often red, or a communion wafer, and critics still argue over which Crane meant.", "skip": ["livid"]},
    {"work": "crane-boat", "anchor": "None of them knew the colour of the sky", "title": "None of them knew the colour of the sky", "loc": "The Open Boat", "context": "Crane opens with what four shipwrecked men cannot afford to look at. Their whole world is slate-gray waves with white tops. The story grew from Crane's own days in a dinghy after the steamer Commodore sank in 1897."},
    {"work": "crane-boat", "anchor": "When the correspondent again opened his eyes", "n": 3, "to": "flatly indifferent.", "title": "Carmine and gold upon the waters", "loc": "The Open Boat", "context": "Dawn comes in gray, then carmine and gold, then pure blue, over a beach with no rescuers. Carmine is a crimson named for the dye made from cochineal insects. Crane sets the splendid morning beside the men's danger and decides nature is simply indifferent."},
    {"work": "thoreau-walden", "anchor": "All our Concord waters have two colors at least", "from": "All our Concord waters have two colors at least", "to": "Such is the color of its iris.", "title": "Walden is blue at one time and green", "loc": "The Ponds", "context": "Thoreau works out why Walden looks blue from a hilltop and green up close. From afar it mirrors the sky; near the shore the blue mixes with the yellow of the sand. It is careful field optics more than poetry, and his explanation largely holds."},
    {"work": "thoreau-walden", "anchor": "All our Concord waters have two colors at least", "from": "Like the rest of our waters, when much agitated", "to": "fit studies for a Michael Angelo.", "title": "More cerulean than the sky itself", "loc": "The Ponds", "context": "On the water, Thoreau sees a light blue 'more cerulean than the sky', yet a glass of it is colorless, like a small piece of window glass that only looks green in a thick slab. Water really is faintly blue, and the color builds with depth."},
    {"work": "thoreau-walden", "anchor": "Like the water, the Walden ice, seen near at hand", "to": "the most transparent is the bluest.", "title": "Like a great emerald", "loc": "The Pond in Winter", "context": "Walden ice looks green close up and blue from afar; a cake that falls in the street lies there like an emerald. Thoreau guesses the blue comes from light and air. We now know the blue of thick ice comes mostly from water absorbing red light, while trapped air bubbles make ice look white."},
    {"work": "thoreau-excursions", "anchor": "Shall the names of so many of our colors continue", "title": "Names for our colors", "loc": "Autumnal Tints", "context": "Thoreau asks why Americans name colors after far-off places and shop goods (Naples yellow, Prussian blue, raw sienna, burnt umber) or after gems few have seen, and hopes tree names will join the color vocabulary. Sienna really is named for Siena in Italy."},
    {"work": "thoreau-excursions", "anchor": "The Scarlet Oak asks a clear sky", "title": "You see a redder tree than exists", "loc": "Autumnal Tints, The Scarlet Oak", "context": "Watching scarlet oaks in late sun, Thoreau notices the red seems to glow in the air on this side of the trees, 'borrowed fire'. Low evening light is rich in red, and it does make red leaves blaze far beyond how they look up close."},
    {"work": "thoreau-excursions", "anchor": "The large ones on our Common are particularly beautiful", "title": "A yellow that amounts to a scarlet", "loc": "Autumnal Tints, The Sugar-Maple", "context": "Thoreau compares two yellows: the sugar maple's, which with the sun behind it 'amounts to a scarlet', and the pale lemon yellow of an elm beside it. Backlit leaves glow because light passes through them, and a color looks different next to its neighbor."},
    {"work": "twain-mississippi", "anchor": "Now when I had mastered the language of this water", "n": 2, "cut": ["I stood like one bewitched. I drank it in, in a speechless rapture. The world was new to me, and I had never seen anything like this at home. But as I have said, a day came when I began to cease from noting the glories and the charms which the moon and the sun and the twilight wrought upon the river's face; another day came when I ceased altogether to note them. ", "the lines and circles in the slick water over yonder are a warning that that troublesome place is shoaling up dangerously; "], "title": "The river turned to blood", "loc": "Chapter 9", "context": "Twain describes one sunset twice: first as a young man would, in blood red, gold, opal and silver, then as a trained pilot, for whom each color is a warning about wind, snags and sandbars. Learning to read the water, he says, cost him its beauty."},
    {"work": "london-scarlet", "anchor": "He's always saying that,” he said to Edwin. “What is scarlet?", "n": 7, "title": "Scarlet ain't anything, but red is red", "loc": "Chapter 1", "context": "Sixty years after a plague, an old man insists on the word scarlet while boys raised after the collapse say red is red. London makes a color word a measure of lost culture. Granser quotes Bliss Carman's poem about the scarlet of autumn maples."},
    {"work": "london-scarlet", "anchor": "The Scarlet Death broke out in San Francisco", "to": "we knew that it had come.", "title": "Her face had suddenly turned scarlet", "loc": "Chapter 3", "context": "London's imagined pandemic announces itself by color: a student's face turning scarlet in the middle of a lecture. Like scarlet fever or yellow fever, his disease is named for what it does to the skin."},
    {"work": "montgomery-anne", "anchor": "there’s one little early wild rose out", "from": "Oh, look, there’s one little early wild rose out!", "title": "Redheaded people can't wear pink", "loc": "Chapter 5", "context": "Anne's rule that redheads can't wear pink was a familiar piece of dress advice, and it shows how hair color decided a girl's palette. Montgomery's heroine spends much of the book hoping her red hair will darken into 'a handsome auburn'."},
    {"work": "montgomery-anne", "anchor": "Look at my hair, Marilla,” she whispered", "n": 5, "title": "A queer, dull, bronzy green", "loc": "Chapter 27", "context": "Anne buys a peddler's dye promised to turn her hair raven black and gets a dull, bronzy green streaked with the old red. Dye on hair works more like a glaze than a coat of paint: the color underneath still shows through."},
    {"work": "austen-pride", "anchor": "Both changed colour, one looked", "from": "Mr. Darcy corroborated it with a bow", "title": "One looked white, the other red", "loc": "Chapter XV", "context": "Austen hardly ever describes colour, so this flash stands out. Darcy and Wickham meet in the street and each changes colour, one going pale and one flushing, and Austen will not say which. To \"change colour\" was the period's phrase for a blush or a sudden paleness, and here it is the first hint of a buried history."},
    {"work": "bronte-jane", "anchor": "room was a square chamber, very seldom slept in", "title": "The red-room", "loc": "Chapter II", "context": "Young Jane is locked in this room as a punishment. Everything is red, crimson or mahogany, except the bed and chair, which glare white \"like a pale throne\". Critics often read the red-room as an image of rage, fear and confinement that returns through the novel; the fawn walls with a blush of pink are a reminder of how carefully Brontë sees."},
    {"work": "bronte-jane", "anchor": "hung like it with a Tyrian-dyed curtain", "title": "Snow and fire", "loc": "Chapter XI", "context": "Tyrian purple was the famously costly ancient dye made from sea snails; by Brontë's day \"Tyrian\" meant any rich purple-crimson. The room is built on one contrast, white carpets and snowy plaster against crimson couches and ruby glass. Ruby glass was often coloured with a tiny amount of gold, so the richest red in the room is literally made of money."},
    {"work": "bronte-jane", "anchor": "fixed on a rich silk of the most brilliant amethyst dye", "from": "With anxiety I watched his eye rove", "title": "Amethyst and pink, or black and grey", "loc": "Chapter XXIV", "context": "Rochester wants to dress his bride in brilliant amethyst and pink satin; Jane trades them for sober black and pearl-grey. Colour becomes a quiet argument about money, class and who Jane is allowed to be. Black and pearl-grey were the quiet, respectable choices of a governess."},
    {"work": "bronte-wuthering", "anchor": "a splendid place carpeted with crimson", "from": "We crept through a broken hedge", "to": "shimmering with little soft tapers.", "title": "Crimson, white and gold at the Grange", "loc": "Chapter VI", "context": "Heathcliff and Cathy press their faces to the window of Thrushcross Grange and see wealth as colour: crimson carpet and chairs, a pure white ceiling edged in gold, silver chains. Crimson comes, through Arabic, from kermes, the insect once crushed to make the dye. Against the grey moor it looks like heaven to the children."},
    {"work": "dickens-bleak", "anchor": "Smoke lowering down from chimney-pots", "n": 2, "cut": ["Dogs, undistinguishable in mire. Horses, scarcely better; splashed to their very blinkers. Foot passengers, jostling one another’s umbrellas in a general infection of ill temper, and losing their foot-hold at street-corners, where tens of thousands of other foot passengers have been slipping and sliding since the day broke (if this day ever broke), adding new deposits to the crust upon crust of mud, sticking at those points tenaciously to the pavement, and accumulating at compound interest."], "title": "Black drizzle, gone into mourning", "loc": "Chapter I", "context": "The famous fog opening holds very few colour words, and that is the point. Coal smoke falls as a soft black drizzle, with soot flakes as big as snowflakes, \"gone into mourning\" for the sun; black was the colour of Victorian mourning dress. The only green is upriver among the aits, the small river islands, away from the city."},
    {"work": "dickens-bleak", "anchor": "glittering above a red-and-violet-tinted cloud of smoke", "title": "The golden cross over the smoke", "loc": "Chapter XIX", "context": "Jo, the crossing-sweeper who owns nothing, eats his scraps under St Paul's. The city's own smoke tints the evening red and violet, and the gold cross on the dome glitters above it, \"so far out of his reach\". Dickens makes gold the colour of everything Jo will never be given."},
    {"work": "dickens-expectations", "anchor": "She was dressed in rich materials,—satins, and lace, and silks,—all of white", "n": 2, "to": "had no brightness left but the brightness of her sunken eyes.", "title": "White that had been white long ago", "loc": "Chapter VIII", "context": "Miss Havisham stopped every clock on her wedding day, but she could not stop colour. White silk and lace yellow as they age in light and air, so her dress records the years she refuses to count. Pip sees it in one sentence: everything that ought to be white \"had been white long ago\"."},
    {"work": "dickens-hard-times", "anchor": "It was a town of red brick, or of brick that would have been red", "to": "like the head of an elephant in a state of melancholy madness.", "title": "Coketown's red, black and purple", "loc": "Book I, Chapter V", "context": "Dickens paints the industrial town in three colours: red brick blackened by smoke, a black canal, and a river running purple with dye. Mills that dyed cloth emptied their waste into rivers, which could run the colour of the day's batch. The simile of the painted face is of its time; the purple river was a real sight in mill towns."},
    {"work": "dickens-carol", "anchor": "like ruddy smears upon the palpable brown air", "title": "Ruddy smears on brown air", "loc": "Stave I", "context": "It is three in the afternoon and already dark. London's coal-smoke fogs were not white but yellow and brown, thick enough to touch, so Dickens calls the air \"palpable brown\". Candles in the office windows show through it only as ruddy smears."},
    {"work": "dickens-carol", "anchor": "It was clothed in one simple green robe, or mantle", "title": "The spirit in a green robe", "loc": "Stave III", "context": "Dickens's Ghost of Christmas Present wears green trimmed with white fur and a holly wreath, the colours of evergreen at midwinter. Victorian pictures of Father Christmas show him in many colours, green among them, before red settled in as the usual costume."},
    {"work": "hardy-native", "anchor": "singular in colour, this being a lurid red", "n": 2, "title": "The reddleman", "loc": "Book I, Chapter II", "context": "Diggory Venn sells reddle, a red ochre earth that shepherds rubbed on their sheep to mark them. The iron-oxide pigment soaks into his clothes, skin and van until he is \"completely red\". Hardy presents him as the last of a dying trade, and the colour makes him an outsider long before the plot does."},
    {"work": "hardy-native", "anchor": "Reddle spreads its lively hues over everything", "n": 5, "cut": ["The reddleman lived like a gipsy; but gipsies he scorned. He was about as thriving as travelling basket and mat makers; but he had nothing to do with them. He was more decently born and brought up than the cattledrovers who passed and repassed him in his wanderings; but they merely nodded to him. His stock was more valuable than that of pedlars; but they did not think so, and passed his cart with eyes straight ahead. He was such an unnatural colour to look at that the men of roundabouts and waxwork shows seemed gentlemen beside him; but he considered them low company, and remained aloof. Among all these squatters and folks of the road the reddleman continually found himself; yet he was not of them. His occupation tended to isolate him, and isolated he was mostly seen to be.\n\nIt was sometimes suggested that reddlemen were criminals for whose misdeeds other men wrongfully suffered—that in escaping the law they had not escaped their own consciences, and had taken to the trade as a lifelong penance. Else why should they have chosen it? In the present case such a question would have been particularly apposite. The reddleman who had entered Egdon that afternoon was an instance of the pleasing being wasted to form the ground-work of the singular, when an ugly foundation would have done just as well for that purpose. The one point that was forbidding about this reddleman was his colour. Freed from that he would have been as agreeable a specimen of rustic manhood as one would often see. A keen observer might have been inclined to think—which was, indeed, partly the truth—that he had relinquished his proper station in life for want of interest in it. Moreover, after looking at him one would have hazarded the guess that good nature, and an acuteness as extreme as it could be without verging on craft, formed the framework of his character.\n\nWhile he darned the stocking his face became rigid with thought. Softer expressions followed this, and then again recurred the tender sadness which had sat upon him during his drive along the highway that afternoon. Presently his needle stopped. He laid down the stocking, arose from his seat, and took a leathern pouch from a hook in the corner of the van. This contained among other articles a brown-paper packet, which, to judge from the hinge-like character of its worn folds, seemed to have been carefully opened and closed a good many times. He sat down on a three-legged milking stool that formed the only seat in the van, and, examining his packet by the light of a candle, took thence an old letter and spread it open."], "to": "against a vermilion sunset.", "title": "As with the mark of Cain", "loc": "Book I, Chapter IX", "context": "Reddle stains everything it touches, and Hardy says Wessex mothers once scared children with the reddleman as a bogeyman. The same stain turns a girl's old letter pale red, so its black handwriting looks like winter twigs against a vermilion sunset: the colour of his trade has dyed his love too."},
    {"work": "hardy-native", "anchor": "The July sun shone over Egdon and fired its crimson heather to scarlet", "title": "The heath's four colours", "loc": "Book IV, Chapter I", "context": "Hardy reads the heath's year as a single day: green fern for morning, crimson and scarlet heather for noon, brown and russet for evening, and the dark of winter for night. Heather on English heaths flowers in pinks and purples; Hardy pushes it toward scarlet to show the July sun at full strength."},
    {"work": "hardy-tess", "anchor": "The banded ones were all dressed in white gowns", "n": 8, "cut": ["There were a few middle-aged and even elderly women in the train, their silver-wiry hair and wrinkled faces, scourged by time and trouble, having almost a grotesque, certainly a pathetic, appearance in such a jaunty situation. In a true view, perhaps, there was more to be gathered and told of each anxious and experienced one, to whom the years were drawing nigh when she should say, “I have no pleasure in them,” than of her juvenile comrades. But let the elder be passed over here for those under whose bodices the life throbbed quick and warm.\n\nThe young girls formed, indeed, the majority of the band, and their heads of luxuriant hair reflected in the sunshine every tone of gold, and black, and brown. Some had beautiful eyes, others a beautiful nose, others a beautiful mouth and figure: few, if any, had all. A difficulty of arranging their lips in this crude exposure to public scrutiny, an inability to balance their heads, and to dissociate self-consciousness from their features, was apparent in them, and showed that they were genuine country girls, unaccustomed to many eyes.\n\nAnd as each and all of them were warmed without by the sun, so each had a private little sun for her soul to bask in; some dream, some affection, some hobby, at least some remote and distant hope which, though perhaps starving to nothing, still lived on, as hopes will. They were all cheerful, and many of them merry.\n\nThey came round by The Pure Drop Inn, and were turning out of the high road to pass through a wicket-gate into the meadows, when one of the women said—"], "to": "such a pronounced adornment.", "title": "No two whites alike, and a red ribbon", "loc": "Phase the First, Chapter II", "context": "Hardy's painter's eye sees that a crowd in white is never one white: some blanched, some bluish, some yellowed with age. Then one girl, Tess, wears a red ribbon. Many readers follow a thread of red through the novel from this ribbon to its ending, and it starts here as a small bright mark among the white."},
    {"work": "hardy-tess", "anchor": "As he had her basket she could not well do otherwise", "n": 3, "title": "Staring vermilion words", "loc": "Phase the Second, Chapter XII", "context": "A travelling text-painter daubs a Bible threat on a stile in vermilion, the bright mercury-based red long used for lettering and for the red letters in old books. Against the soft decaying tints of autumn and the blue horizon, the red seems to shout, and Tess feels it as an accusation aimed at her."},
    {"work": "hardy-tess", "anchor": "arrested by a spot in the middle of its white surface", "n": 2, "title": "A gigantic ace of hearts", "loc": "Phase the Seventh, Chapter LVI", "context": "A landlady notices a small red spot on a white ceiling that slowly spreads. Hardy turns the discovery of a killing into an image from a pack of cards, white ground and one scarlet heart, and the red that began with Tess's ribbon reaches its end."},
    {"work": "eliot-middlemarch", "anchor": "Celia had unclasped the necklace and drawn it off", "n": 5, "title": "Colours that penetrate like scent", "loc": "Chapter I", "context": "Dorothea means to give up jewels, then the sun strikes an emerald and she is caught. Her line that colours \"penetrate one, like scent\" names how colour reaches us before thought. The book of Revelation lists emerald and amethyst among the jewelled foundations of the heavenly city, which lets her excuse her delight as devotion."},
    {"work": "eliot-middlemarch", "anchor": "Mr. and Mrs. Casaubon, returning from their wedding journey", "n": 2, "title": "The blue-green boudoir in snow", "loc": "Chapter XXVIII", "context": "Back from a disappointing honeymoon, Dorothea finds the world shrunk to white snow, a dun sky and a faded blue-green room where even the tapestry stag looks like a ghost. Dun is an old word for a dull greyish brown. Against it Eliot sets warm red: the leather cases, her lips, the fire."},
    {"work": "carroll-alice", "anchor": "the roses growing on it were white, but there were three gardeners", "n": 10, "to": "we’re doing our best, afore she comes, to—”", "title": "Painting the roses red", "loc": "Chapter VIII", "context": "Three playing-card gardeners planted a white rose tree where the Queen wanted red, so they paint the flowers. Some readers hear a joke on the Wars of the Roses, the white rose of York against the red of Lancaster. Either way it is the purest nonsense about colour: a fact of nature fixed with a brush to please a tyrant."},
    {"work": "doyle-scarlet", "anchor": "the finest study I ever came across: a study in scarlet", "from": "I might not have gone but for you", "to": "expose every inch of it.", "title": "The scarlet thread of murder", "loc": "Part I, Chapter IV", "context": "Holmes borrows \"a little art jargon\": a study is a painter's sketch, and painters of the time gave pictures colour titles. His image of a red thread running through a colourless skein echoes one Goethe used, taken from the red thread said to be woven through Royal Navy rope. The title of the first Holmes story comes from this line."},
    {"work": "doyle-scarlet", "anchor": "leaving a yellow square of coarse plastering", "n": 2, "to": "See this smear where it has trickled down the wall!", "title": "Blood-red letters on yellow", "loc": "Part I, Chapter III", "context": "Where the wallpaper has peeled away, a square of bare yellow plaster frames one word written in blood. Doyle sets the brightest red in the book against a dull yellow ground, the way a sign painter would, so the clue cannot be missed."},
    {"work": "doyle-adventures", "anchor": "We shall now see how the electric-blue dress will become you", "n": 2, "to": "seemed quite exaggerated in its vehemence.", "skip": ["beige"], "title": "A peculiar shade of electric blue", "loc": "XII. The Adventure of the Copper Beeches", "context": "The governess must wear a dress of \"electric blue\", a fashionable shade name of the late 1800s that suggests the glare of electric light. She calls it \"a sort of beige\": beige was then still often the name of a plain woollen cloth, not only a colour. The dress matters because it belonged to someone else."},
    {"work": "doyle-adventures", "anchor": "Every shade of colour they were—straw, lemon, orange, brick", "to": "the real vivid flame-coloured tint.", "title": "Straw, lemon, orange, brick", "loc": "II. The Red-Headed League", "context": "A crowd of red-haired men answers an advertisement, and Doyle lists their shades the way people actually named hair: straw, lemon, orange, brick, Irish-setter, liver, clay. Each is borrowed from an ordinary object, which is how most colour words began."},
    {"work": "doyle-adventures", "anchor": "It’s a bonny thing,” said he. “Just see how it glints", "title": "A carbuncle that is blue", "loc": "VII. The Adventure of the Blue Carbuncle", "context": "\"Carbuncle\" was an old name for glowing red stones, usually garnets, so a blue one is a contradiction, which is what makes Doyle's invented jewel unique. Holmes even calls it crystallised charcoal, which sounds more like diamond. No blue garnet was known in Doyle's day."},
    {"work": "wells-war", "anchor": "Apparently the vegetable kingdom in Mars, instead of having green", "n": 2, "to": "blue and violet were as black to them.", "title": "The red weed", "loc": "Book II, Chapter II", "context": "Wells imagines a world whose plants are blood-red instead of green. Earth plants look green because chlorophyll absorbs red and blue light and sends the green back; scientists today still speculate about other-coloured plants on other worlds. He also gives the Martians eyes that see blue and violet as black."},
    {"work": "wells-war", "anchor": "a pale, violet-purple fluorescent glow, quivering", "title": "A violet glow over London", "loc": "Book II, Chapter VII", "context": "Night over a ruined London: orange-red fires, deep blue sky, black city, and the alien weed giving off a faint violet-purple light. Above it all Mars glows red. The planet's colour is real; its dust is rich in iron oxide, the same rusty chemistry as red ochre on Earth."},
    {"work": "conrad-heart", "anchor": "a deuce of a lot of blue", "from": "Two women, one fat and the other slim", "to": "Dead in the centre.", "title": "A vast amount of red", "loc": "Part I", "context": "Imperial maps coloured each colony by its ruler. Readers usually decode Marlow's map this way: red for Britain, blue for France, green for Italy, orange for Portugal, purple for German East Africa, and yellow for the Congo Free State, King Leopold II's private possession. Marlow is going \"into the yellow\", and the cheerful colours hide what they stand for."},
    {"work": "conrad-heart", "anchor": "The day was ending in a serenity of still and exquisite brilliance", "n": 2, "from": "The day was ending", "title": "From glowing white to dull red", "loc": "Part I", "context": "On the Thames at dusk the sun turns from white to a dull red without rays. A low sun reddens because its light crosses more air, which scatters the blue away. Conrad makes the ordinary change look like a death, as if the gloom over London had put the sun out, and the tale has not even begun."},
    {"work": "chesterton-trifles", "anchor": "I not only liked brown paper, but liked the quality of brownness", "to": "like the first fierce stars that sprang out of divine darkness.", "title": "The quality of brownness", "loc": "II. A Piece of Chalk", "context": "Chesterton goes drawing on the downs with coloured chalks and brown paper. Artists have long drawn on toned paper because a middle colour lets both dark marks and bright chalk show; he turns that practical trick into a picture of creation, with gold, blood-red and sea-green sparks struck out of brown twilight."},
    {"work": "chesterton-trifles", "anchor": "One of the wise and awful truths which this brown-paper art reveals", "n": 2, "title": "White is a colour", "loc": "II. A Piece of Chalk", "context": "Having left his white chalk at home, Chesterton argues that white is not an absence but \"a shining and affirmative thing\". On brown paper that is literally true: white is the brightest mark you can make. Physics agrees in its own way, since white light contains every colour of the spectrum."},
    {"work": "burnett-garden", "anchor": "It was the sweetest, most mysterious-looking place anyone could imagine", "from": "All the ground was covered", "to": "It was this hazy tangle from tree to tree which made it all look so mysterious.", "title": "Wintry brown and gray", "loc": "Chapter IX", "context": "Mary's first sight of the locked garden is almost colourless: wintry brown grass and gray or brown rose stems hanging like a hazy mantle. The book measures the garden's waking, and the children's, by colour, and it starts here from brown and gray."},
    {"work": "burnett-garden", "anchor": "it seemed like everything was gray. Look round now", "n": 4, "title": "A green gauze veil", "loc": "Chapter XV", "context": "In early spring new leaves show first as a faint haze of green over bare twigs, the \"green gauze veil\" Mary sees. Dickon's Yorkshire answer, greener and greener \"till th' gray's all gone\", is the whole story of the book in one line."},
    {"work": "burnett-garden", "anchor": "The place was a wilderness of autumn gold and purple", "title": "An embowered temple of gold", "loc": "Chapter XXVII", "context": "When Mary and Colin's father finally enters the garden, it is autumn and the colours have arrived in full: gold, purple, violet-blue, scarlet, white and ruby lilies. Burnett reminds us the children first found it in its grayness, so the scene closes the circle the book began."},
    {"work": "wilde-dorian", "anchor": "The studio was filled with the rich odour of roses", "n": 2, "to": "seek to convey the sense of swiftness and motion.", "skip": ["lilac"], "title": "The studio", "loc": "Chapter I", "context": "The novel opens in a painter's studio full of scent and soft colour: pink thorn, honey-coloured laburnum, tussore silk, gilt woodbine. Shadows on the curtain make Lord Henry think of Japanese painting, then the height of artistic fashion in London. Wilde sets his Aesthetic stage before a single person speaks."},
    {"work": "wilde-dorian", "anchor": "On one occasion he took up the study of jewels", "title": "The olive-green chrysoberyl", "loc": "Chapter XI", "context": "Dorian's jewel catalogue is full of real colour lore. The chrysoberyl that is olive-green by day and red by lamplight is alexandrite, found in the Urals in the 1830s; cinnamon-stone is an orange-brown garnet. Wilde lets the names and shades pile up until the list itself becomes a kind of jewellery."},
    {"work": "wilde-dorian", "anchor": "He had a special passion, also, for ecclesiastical vestments", "from": "He possessed a gorgeous cope", "to": "altar frontals of crimson velvet and blue linen;", "title": "Crimson copes and green velvet", "loc": "Chapter XI", "context": "Church vestments follow a calendar of colours, with white, red, green and violet changing with the seasons and feasts. Dorian collects them for their beauty alone: crimson silk with golden pomegranates, green velvet, amber, blue, pink damask. Wilde shows the colours drained of meaning and kept as treasure."},
    {"work": "woolf-dalloway", "anchor": "There were flowers: delphiniums, sweet peas, bunches of lilac", "skip": ["lilac"], "loc": "The flower shop", "title": "Every flower seems to burn by itself", "context": "Clarissa in the florist's shop imagines the hour between six and seven, when flowers seem to glow in the dusk. As light fades the eye shifts toward night vision and colours change their weight, so pale and white blooms seem to float and shine. Woolf catches that half-hour in one long, unfolding sentence."},
    {"work": "woolf-dalloway", "anchor": "Indeed it was—Sir William Bradshaw’s motor car", "to": "with scarcely anything left to wish for", "title": "Grey furs, silver grey rugs", "loc": "Harley Street", "context": "The fashionable doctor who will fail Septimus drives a grey car, with grey furs and silver-grey rugs to match. Grey reads as sober, scientific and neutral; Woolf shows it as the colour of quiet power and a mounting \"wall of gold\"."},
    {"work": "woolf-jacob", "anchor": "The Scilly Isles were turning bluish", "title": "An entire emerald tinged with yellow", "loc": "Chapter Four", "context": "Sailing off the Scilly Isles, Woolf records the sea's colours as fast as they change: bluish, blue, purple, green, grey, a purple mark \"like a bruise\", an emerald tinged with yellow. Sea colour shifts with depth, sky and the sand beneath, and she paints it the way an Impressionist would, one quick stroke at a time."},
    {"work": "woolf-jacob", "anchor": "By six o'clock a breeze blew in off an icefield", "skip": ["gold"], "title": "Wedges of apple-green", "loc": "Chapter Four", "context": "Woolf logs a sunset by the clock: purple at seven, then a patch like goldbeater's skin, the thin membrane used to hammer gold leaf, then apple-green and pale yellow after nine. That greenish band in the sky after sunset is a real effect, often missed because it does not last long."},
    {"work": "woolf-monday", "anchor": "The pointed fingers of glass hang downwards", "n": 2, "title": "Blue and green", "loc": "Blue & Green", "context": "Two short prose pieces, each built from one colour. Green drips from the glass drops of a chandelier onto marble and becomes parakeets, palms and ocean; blue becomes a whale, a wrecked boat, bluebells and the veils of madonnas. Woolf treats a colour as a thread of association rather than a fixed meaning."},
    {"work": "woolf-monday", "anchor": "From the oval-shaped flower-bed there rose perhaps a hundred stalks", "title": "Red, blue and yellow lights", "loc": "Kew Gardens", "context": "Woolf watches light pass through petals and stain the brown earth with coloured light, then swell a raindrop with colour before it goes silver-grey again. It is a story told at the height of a snail, and its subject is how colour travels: through things, not just off them."},
    {"work": "woolf-voyage", "anchor": "the little boat was now approaching a white crescent of sand", "title": "After four weeks of the sea", "loc": "Chapter VII", "context": "After a month of grey-blue ocean, the travellers reach land and the colours overwhelm them: white sand, deep green valley, white houses with brown roofs, black cypresses, mountains flushed with red. Woolf's first novel already treats colour as a shock to the senses."},
    {"work": "joyce-portrait", "anchor": "coloured the earth green and the clouds maroon", "n": 8, "cut": ["He opened the geography to study the lesson; but he could not learn the names of places in America. Still they were all different places that had different names. They were all in different countries and the countries were in continents and the continents were in the world and the world was in the universe.\n\nHe turned to the flyleaf of the geography and read what he had written there: himself, his name and where he was.\n\nStephen Dedalus Class of Elements Clongowes Wood College Sallins County Kildare Ireland Europe The World The Universe\n\nThat was in his writing: and Fleming one night for a cod had written on the opposite page:\n\nStephen Dedalus is my name, Ireland is my nation. Clongowes is my dwellingplace And heaven my expectation.\n\nHe read the verses backwards but then they were not poetry. Then he read the flyleaf from the bottom to the top till he came to his own name. That was he: and he read down the page again. What was after the universe? Nothing. But was there anything round the universe to show where it stopped before the nothing place began? It could not be a wall but there could be a thin thin line there all round everything. It was very big to think about everything and everywhere. Only God could do that. He tried to think what a big thought that must be but he could only think of God. God was God’s name just as his name was Stephen. Dieu was the French for God and that was God’s name too; and when anyone prayed to God and said Dieu then God knew at once that it was a French person that was praying. But though there were different names for God in all the different languages in the world and God understood what all the people who prayed said in their different languages still God remained always the same God and God’s real name was God."], "title": "For the green or for the maroon", "loc": "Chapter I", "context": "Dante, Stephen's governess, keeps two brushes: maroon for Michael Davitt of the Land League, green for Parnell. When Parnell falls in scandal she rips the green off. Green had long stood for Irish nationalism, and maroon comes from the French marron, chestnut. A small boy meets politics as two colours."},
    {"work": "joyce-portrait", "anchor": "White roses and red roses: those were beautiful colours to think of", "from": "He could not get out the answer", "title": "But you could not have a green rose", "loc": "Chapter I", "context": "Stephen's class is split into York and Lancaster, the white rose and the red. His mind drifts to pink, cream and lavender, then to a green rose, which he decides cannot exist, \"But perhaps somewhere in the world you could\". In fact a green-flowered China rose had been grown in Europe since the mid-1800s."},
    {"work": "joyce-portrait", "anchor": "Words. Was it their colours?", "title": "Was it their colours?", "loc": "Chapter IV", "context": "Stephen asks whether he loves words for their colours: sunrise gold, the russet and green of orchards, azure waves. He decides it is their rhythm instead. Joyce lets the young writer try out the idea that language is a palette, and then put it down."},
    {"work": "joyce-ulysses", "anchor": "A new art colour for our Irish poets: snotgreen", "n": 13, "cut": ["Stephen stood up and went over to the parapet. Leaning on it he looked down on the water and on the mailboat clearing the harbourmouth of Kingstown.\n\n—Our mighty mother! Buck Mulligan said.\n\nHe turned abruptly his grey searching eyes from the sea to Stephen’s face.\n\n—The aunt thinks you killed your mother, he said. That’s why she won’t let me have anything to do with you.\n\n—Someone killed her, Stephen said gloomily.\n\n—You could have knelt down, damn it, Kinch, when your dying mother asked you, Buck Mulligan said. I’m hyperborean as much as you. But to think of your mother begging you with her last breath to kneel down and pray for her. And you refused. There is something sinister in you....\n\nHe broke off and lathered again lightly his farther cheek. A tolerant smile curled his lips.\n\n—But a lovely mummer! he murmured to himself. Kinch, the loveliest mummer of them all!\n\nHe shaved evenly and with care, in silence, seriously."], "title": "The snotgreen sea", "loc": "Episode 1, Telemachus", "context": "Buck Mulligan mocks the fashion for new \"art colours\" with one of his own, then quotes Homer's \"wine-dark sea\", a phrase whose colour sense is still debated. For Stephen the green of Dublin Bay turns into the green bile in a white china bowl by his mother's deathbed."},
    {"work": "joyce-ulysses", "anchor": "Snotgreen, bluesilver, rust: coloured signs", "n": 6, "cut": ["Stephen closed his eyes to hear his boots crush crackling wrack and shells. You are walking through it howsomever. I am, a stride at a time. A very short space of time through very short times of space. Five, six: the nacheinander. Exactly: and that is the ineluctable modality of the audible. Open your eyes. No. Jesus! If I fell over a cliff that beetles o’er his base, fell through the nebeneinander ineluctably! I am getting on nicely in the dark. My ash sword hangs at my side. Tap with it: they do. My two feet in his boots are at the ends of his legs, nebeneinander. Sounds solid: made by the mallet of Los Demiurgos. Am I walking into eternity along Sandymount strand? Crush, crack, crick, crick. Wild sea money. Dominie Deasy kens them a’.\n\nWon’t you come to Sandymount, Madeline the mare?\n\nRhythm begins, you see. I hear. A catalectic tetrameter of iambs marching. No, agallop: deline the mare."], "title": "Ineluctable modality of the visible", "loc": "Episode 3, Proteus", "context": "Walking on the strand with his eyes shut, Stephen thinks about how we see, using Aristotle, whom Dante called the master of those who know. Aristotle held that colour is seen through a transparent medium, the \"diaphane\". Snotgreen, bluesilver and rust are \"coloured signs\"; closing his eyes risks the black \"adiaphane\"."},
    {"work": "joyce-ulysses", "anchor": "Roygbiv Vance taught us", "from": "Best time to spray plants", "to": "My native land, goodnight.", "title": "Roygbiv Vance taught us", "loc": "Episode 13, Nausicaa", "context": "Bloom recalls his schoolroom spectrum: red, orange, yellow, green, blue, indigo, violet. Red rays really are the longest visible waves. The seven bands are a convention, not a fact of nature; Newton chose seven partly to echo the musical scale, and the spectrum itself is continuous."},
    {"work": "joyce-dubliners", "anchor": "He watched sleepily the flakes, silver and dark", "title": "The snow at the end of The Dead", "loc": "The Dead", "context": "The famous last paragraph never calls the snow white. The flakes are \"silver and dark\" against the lamplight, and then simply falling, over the plain, the hills and the churchyard. Joyce lets the whiteness stay unsaid, which is part of why the ending feels so quiet."},
    {"work": "joyce-dubliners", "anchor": "terracotta and salmon-pink panels of her skirt", "title": "Salmon-pink made black and white", "loc": "The Dead", "context": "Gabriel sees his wife on a dark stair and knows her only by her skirt, terracotta and salmon-pink panels that the shadow turns to black and white. In dim light our colour vision fails before our sight of shapes, so colours sink to greys. Joyce notices that, and it makes a fitting image for how little Gabriel knows her."},
    {"work": "mansfield-bliss", "anchor": "slender pear tree in fullest, richest bloom", "n": 9, "cut": ["“What creepy things cats are!” she stammered, and she turned away from the window and began walking up and down. . . .\n\nHow strong the jonquils smelled in the warm room. Too strong? Oh, no. And yet, as though overcome, she flung down on a couch and pressed her hands to her eyes.\n\n“I’m too happy—too happy!” she murmured.", "Really—really—she had everything. She was young. Harry and she were as much in love as ever, and they got on together splendidly and were really good pals. She had an adorable baby. They didn’t have to worry about money. They had this absolutely satisfactory house and garden. And friends—modern, thrilling friends, writers and painters and poets or people keen on social questions—just the kind of friends they wanted. And then there were books, and there was music, and she had found a wonderful little dressmaker, and they were going abroad in the summer, and their new cook made the most superb omelettes. . . .\n\n“I’m absurd. Absurd!” She sat up; but she felt quite dizzy, quite drunk. It must have been the spring.\n\nYes, it was the spring. Now she was so tired she could not drag herself upstairs to dress."], "title": "The pear tree and the jade-green sky", "loc": "Bliss", "context": "Bertha sees a pear tree in full white bloom against a jade-green evening sky and takes it as a symbol of her own life. Without meaning to, she then dresses as the tree: white dress, jade beads, green shoes. Jade is a stone before it is a colour name, a soft cool green."},
    {"work": "mansfield-bliss", "anchor": "These last she had bought to tone in with the new dining-room carpet", "n": 2, "title": "Purple grapes to match the carpet", "loc": "Bliss", "context": "Bertha buys purple grapes to \"bring the carpet up to the table\", then admits it sounds absurd. The silver bloom on the white grapes is real, a natural wax on the skin. Mansfield's comedy is gentle: colour harmony as a modern, slightly anxious household art."},
    {"work": "mansfield-bliss", "anchor": "The dining-room window had a square of coloured glass at each corner", "to": "and a yellow fence.", "title": "A blue lawn and a yellow lawn", "loc": "Prelude", "context": "Little Kezia looks through the coloured corner panes of a window and sees the whole garden turn blue, then yellow. Coloured glass works like a filter, letting through only part of the light. Prelude is drawn from Mansfield's own childhood move outside Wellington, New Zealand."},
    {"work": "lawrence-rainbow", "anchor": "The dawn came. They stood together on a high place", "n": 4, "title": "A flush of rose, then yellow", "loc": "Chapter XV", "context": "Lawrence slows a dawn down to its stages: the dark turning bluer, a pale rim, whiteness, a flush of rose, new-created yellow, then the sun too strong to look at. It is a close record of how the sky actually changes before sunrise, written with the intensity of a revelation."},
    {"work": "lawrence-women", "anchor": "The sisters were crossing a black path through a dark, soiled field", "n": 2, "title": "Grass-green stockings in a black town", "loc": "Chapter I", "context": "Gudrun, back from art school in London, walks through a mining town where everything is black, smoked or darkened red brick. Her grass-green stockings and strong blue coat make her a target for every stare. The colliery town is usually taken to be modelled on Eastwood, where Lawrence grew up."},
    {"work": "lawrence-women", "anchor": "Ursula was watching the butterflies, of which there were dozens", "title": "It was the orange that made the halo", "loc": "Chapter X", "context": "Ursula sees two white butterflies with a halo of colour around them, then realises they are orange-tips. Only the male orange-tip carries the orange wing tips; the female is white. Lawrence catches the moment perception sorts out a blur of colour into a name."},
    {"work": "goethe-colours", "anchor": "contrast which we call a polarity", "n": 4, "to": "This union we call green.", "cut": ["Action. Negation.[1] "], "title": "Yellow and blue as the two poles", "loc": "§696–697", "context": "Goethe built his theory on one opposition: yellow, the color nearest light, against blue, the color nearest darkness, with green as their balanced union. Physics followed Newton's prism instead, but Goethe's pairing of warm and cold, near and far, stayed in painters' vocabulary."},
    {"work": "goethe-colours", "anchor": "In travelling over the Harz in winter", "n": 2, "title": "Green shadows on the Brocken", "loc": "§75", "context": "Coloured shadows are real. When snow is lit by warm yellow or red light, the shadows look blue, violet or green, partly from the sky's light and partly because the eye pushes a shadow toward the opposite of its surroundings. Records like this one are why painters valued Goethe even after science sided with Newton."},
    {"work": "goethe-colours", "anchor": "This is the colour nearest the light", "n": 6, "cut": [" How the chemical yellow developes itself in and upon the white, has been circumstantially described in its proper place."], "title": "Yellow, the colour nearest the light", "loc": "§765–770", "context": "This is Goethe's chapter on the 'sensible-moral' effects of color, how each hue acts on mood. Read them as his observations, not laws: modern studies find color feelings shift with culture and context. Note how he splits pure, glowing yellow from the sour sulphur yellow that tips toward green."},
    {"work": "goethe-colours", "anchor": "As no colour can be considered as stationary", "n": 2, "title": "Red-yellow, the glow of fire", "loc": "§772–773", "context": "Goethe's 'red-yellow' is roughly our orange, a color English named after the fruit only around the 1500s. He hears warmth and splendor in it, and adds a note on national taste: the French, he says, like their leather yellows pushed toward red."},
    {"work": "goethe-colours", "anchor": "As yellow is always accompanied with light", "n": 7, "title": "Blue, a stimulating negation", "loc": "§778–784", "context": "Goethe ties blue to darkness, cold and distance: blue walls seem to retreat, blue rooms feel empty, blue glass makes the world gloomy. Painters had long used blue for far hills, and he turns that habit into a feeling. The emotions are his reports, not rules."},
    {"work": "goethe-faust", "anchor": "My worthy friend, gray are all theories", "title": "Gray is all theory", "loc": "Part One, the study scene", "context": "Mephistopheles, dressed as Faust, teases a student hungry for learning. In German the line sets grau against grün: gray for dry book knowledge, green for living things. It became a proverb, and it is a joke worth noticing from the poet who also wrote a long theory of colours."},
    {"work": "tolstoy-anna", "anchor": "Anna was not in lilac, as Kitty had so urgently wished", "n": 2, "from": "Anna was not in lilac", "title": "Not in lilac, but black", "loc": "Part One, Chapter 22", "context": "Kitty has pictured Anna at the ball in soft, fashionable lilac. Anna comes in black velvet instead, and Kitty sees that the dress is only a frame. Tolstoy uses the plainest color to make Anna, not her clothes, the thing everyone looks at."},
    {"work": "tolstoy-anna", "anchor": "When Levin, after loading his gun, moved on", "to": "over the green of the grass.", "title": "The marsh at sunrise", "loc": "Part Six, Chapter 12", "context": "Tolstoy tracks color changing minute by minute as the sun climbs behind clouds: silvery dew turns to gold, pools become amber, the bluish grass goes yellow-green. It is a hunter's eye for how light, not the things themselves, sets the colors of a landscape."},
    {"work": "tolstoy-war", "anchor": "Mounting the steps to the knoll Pierre", "n": 4, "from": "It was the same panorama", "to": "came the report a second later.", "cut": [" There were troops to be seen everywhere, in front and to the right and left. All this was vivid, majestic, and unexpected; but what impressed Pierre most of all was the view of the battlefield itself, of Borodinó and the hollows on both sides of the Kolochá.\n\nAbove the Kolochá, in Borodinó and on both sides of it, especially to the left where the Vóyna flowing between its marshy banks falls into the Kolochá, a mist had spread which seemed to melt, to dissolve, and to become translucent when the brilliant sun appeared and magically colored and outlined everything. The smoke of the guns mingled with this mist, and over the whole expanse and through that mist the rays of the morning sun were reflected, flashing back like lightning from the water, from the dew, and from the bayonets of the troops crowded together by the riverbanks and in Borodinó. A white church could be seen through the mist, and here and there the roofs of huts in Borodinó as well as dense masses of soldiers, or green ammunition chests and ordnance. And all this moved, or seemed to move, as the smoke and mist spread out over the whole space. Just as in the mist-enveloped hollow near Borodinó, so along the entire line outside and above it and especially in the woods and fields to the left, in the valleys and on the summits of the high ground, clouds of powder smoke seemed continually to spring up out of nothing, now singly, now several at a time, some translucent, others dense, which, swelling, growing, rolling, and blending, extended over the whole expanse."], "title": "Borodino in morning smoke", "loc": "Book Ten, Chapter 30", "context": "Pierre, a civilian, sees the battlefield as a painting: rosy and golden light, a forest like yellowish-green stone, cannon smoke turning from violet to gray to milky white. Tolstoy lets this beauty stand right beside the killing that is about to start."},
    {"work": "tolstoy-war", "anchor": "The weather was already growing wintry", "to": "the young wolves were bigger than dogs.", "title": "Golden islands in green rye", "loc": "Book Seven, Chapter 3", "context": "By September the colors of the land have flipped: woods that were green islands in black fields are now gold and red islands in green winter rye. Tolstoy reads the season, and the start of the hunting season, straight from the color of the fields."},
    {"work": "dostoevsky-crime", "anchor": "The little room into which the young man walked", "n": 2, "to": "that was all.", "title": "The pawnbroker's yellow room", "loc": "Part One, Chapter 1", "context": "Yellow returns again and again in this novel: yellow wallpaper, yellow wood, sallow faces, and the 'yellow ticket', the passport that marked registered prostitutes in imperial Russia. Many critics read it as the color of the city's sickness and poverty."},
    {"work": "dostoevsky-crime", "anchor": "picked out one clumsy, white flower", "title": "Counting petals on yellow paper", "loc": "Part Two, Chapter 4", "context": "Raskolnikov stares at one flower on his dirty yellow wallpaper so he need not hear talk of the murder. Readers often take the yellow of his tiny room, which Dostoevsky keeps naming, as the color of his trapped and feverish mind."},
    {"work": "dostoevsky-karamazov", "anchor": "The vault of heaven, full of soft, shining stars", "from": "He did not stop on the steps either", "title": "White towers against a sapphire sky", "loc": "Book Seven, Chapter 4: Cana of Galilee", "context": "Leaving Father Zossima's coffin, Alyosha walks out into the night and will soon fall to kiss the earth. Dostoevsky keeps the colors few and clear, white, gold and sapphire, close to the palette of a church icon, for the novel's great moment of grace."},
    {"work": "chekhov-bishop", "anchor": "The boy gazed at the familiar places, while the hateful chaise", "to": "like bloodstains.", "title": "Cherry blossom on the tombstones", "loc": "The Steppe, Chapter 1", "context": "Leaving home, nine-year-old Yegorushka remembers the cemetery through its colors: white crosses lost in white cherry blossom in spring, spotted red like blood when the cherries ripen. Chekhov folds a child's knowledge of death into one seasonal change of color."},
    {"work": "chekhov-bishop", "anchor": "Meanwhile a wide boundless plain encircled", "n": 3, "cut": ["The cut rye, the coarse steppe grass, the milkwort, the wild hemp, all withered from the sultry heat, turned brown and half dead, now washed by the dew and caressed by the sun, revived, to fade again. Arctic petrels flew across the road with joyful cries; marmots called to one another in the grass. Somewhere, far away to the left, lapwings uttered their plaintive notes. A covey of partridges, scared by the chaise, fluttered up and with their soft \"trrrr!\" flew off to the hills. In the grass crickets, locusts and grasshoppers kept up their churring, monotonous music."], "title": "The steppe from dawn to noon", "loc": "The Steppe, Chapter 1", "context": "Chekhov's steppe is mostly light and color: a lilac distance at dawn, a yellow streak racing over the grass, then hills brownish-green and lilac in the July haze. Lilac for far hills is true to life, since distance and haze cool and soften colors."},
    {"work": "chekhov-lady", "anchor": "The wonderful bay reflected the moonshine", "from": "Kovrin went out on to the balcony", "title": "A colour difficult to name", "loc": "The Black Monk, Chapter 9", "context": "Chekhov admits the bay's color has no ready name and builds one: a blend of dark blue and green, and in places 'blue vitriol', the vivid blue of copper sulphate crystals. Naming a color by a familiar substance is one of the oldest ways languages grow color words."},
    {"work": "chekhov-lady", "anchor": "They walked and talked of the strange light on the sea", "from": "She laughed.", "to": "after a hot day.", "title": "A sea of soft warm lilac", "loc": "The Lady with the Dog, Chapter 1", "context": "Gurov and Anna's first walk in Yalta. Their small talk is about the light on the water, lilac with a golden streak of moon, and Chekhov lets that color carry the mood of an affair that has not yet begun."},
    {"work": "turgenev-sportsman", "anchor": "It was a glorious July day, one of those days", "to": "bright but not glaring; everything is suffused with a kind of touching tenderness.", "title": "A July day, cloud by cloud", "loc": "Bezhin Lea", "context": "Turgenev reads a whole fine-weather day from the sky: a soft rose sunrise rather than a fiery one, gold-gray clouds with white edges, a pale lilac horizon that never changes, a crimson afterglow. Russian readers long treated this as a model of exact nature writing."},
    {"work": "turgenev-sportsman", "anchor": "The heat forced us at last to go into the wood", "from": "A marvellously sweet occupation", "to": "the deep, pure blue stirs on one's lips a smile, innocent as itself;", "title": "Looking up into green and blue", "loc": "Kassyan of Fair Springs", "context": "Lying on his back in the wood, the narrator watches leaves turn from emerald to gold to a green so deep it is almost black, against patches of blue. Leaf color really does change this way, from light shining through a leaf to light bouncing off it."},
    {"work": "flaubert-bovary", "anchor": "He saw her from behind in the glass between two lights", "title": "A gown of pale saffron", "loc": "Part One, Chapter 8", "context": "Dressing for the ball at La Vaubyessard, Emma is seen in the mirror: black eyes, hair with a blue sheen, a gown of pale saffron with pink roses and green. It is a fashion-plate image, and the ball becomes the picture of elegance she chases for the rest of the book."},
    {"work": "flaubert-bovary", "anchor": "The sunshade of silk of the colour of pigeons", "from": "Once, during a thaw", "title": "Silk the colour of pigeons' breasts", "loc": "Part One, Chapter 2", "context": "Flaubert's French calls the silk gorge-de-pigeon, shot silk woven from two colors of thread so it shifts hue like a pigeon's neck. Sun through the sunshade throws moving tints over Emma's white skin, and Charles is lost."},
    {"work": "flaubert-bovary", "anchor": "that makes of this quarter of Rouen a wretched little Venice", "from": "The river, that makes", "to": "skeins of cotton were drying in the air.", "title": "A river yellow, violet or blue", "loc": "Part One, Chapter 1", "context": "Rouen was a cotton and dyeing town, and its small rivers ran the colors of the dye works. Flaubert's student Charles looks down on water that changes with the vats, a 'wretched little Venice' standing in for the green countryside he misses."},
    {"work": "flaubert-salammbo", "anchor": "It was the mantle of the goddess, the holy zaïmph", "title": "The zaïmph, veil of the goddess", "loc": "Chapter 5: Tanith", "context": "The sacred veil of Carthage is described only through impossible color: bluish as night, yellow as dawn, purple as the sun. Carthage was a Phoenician city, and the Phoenicians grew rich on purple dye from murex sea snails, so purple runs through the whole novel."},
    {"work": "flaubert-salammbo", "anchor": "Her hair, which was powdered with violet sand", "title": "Salammbô in violet and purple", "loc": "Chapter 1: The Feast", "context": "Salammbô's first appearance: hair powdered with violet sand, lips like a pomegranate, red flowers on a black tunic, a dark purple mantle of unknown stuff. Flaubert researched Carthage for years, but here he picks colors for their strangeness as much as their history."},
    {"work": "flaubert-salammbo", "anchor": "With his torch he lit a miner", "title": "Hamilcar's treasury of gems", "loc": "Chapter 7: Hamilcar Barca", "context": "Flaubert fills Hamilcar's vault with ancient gem lore: stones fallen from the moon, carbuncles formed from lynx urine, gems that cure poison or bring dreams. These are beliefs from writers like Pliny, not facts, and the colored fires show color as a form of wealth."},
    {"work": "zola-paradise", "anchor": "placing blue, grey, and yellow side by side", "from": "For some minutes however", "title": "Blind the customers!", "loc": "Chapter 2", "context": "The clerk Hutin arranges silks in soft harmonies of blue, gray and yellow. Mouret, the owner, wants red, green and yellow side by side, colors that clash and stop shoppers in their tracks. Zola studied real Paris department stores, and this is retail color strategy in a single line."},
    {"work": "zola-paradise", "anchor": "What caused the ladies to stop was the prodigious spectacle", "n": 2, "cut": [" However, the eye soon became accustomed to this unique whiteness; to the left, in the Monsigny Gallery, white promontories of cotton and calico jutted out, with white rocks formed of sheets, napkins, and handkerchiefs; whilst to the right, in the Michodière Gallery, occupied by the mercery, the hosiery, and the woollen goods, were erections of mother of pearl buttons, a grand decoration composed of white socks and one whole room covered with white swanskin illumined by a stream of light from the distance. But the greatest radiance of this nucleus of light came from the central gallery, from amidst the ribbons and the neckerchiefs, the gloves and the silks. The counters disappeared beneath the whiteness of the silks, the ribbons, the gloves and the neckerchiefs."], "title": "The great exhibition of white", "loc": "Chapter 14", "context": "Paris stores held big sales of white household linens, and Zola makes one into a cathedral of white: snow, glaciers, swans, lace like butterflies, a white bridal tent. One color in many textures shows how much variety white alone can carry."},
    {"work": "zola-paradise", "anchor": "In the silk department there was also a crowd", "from": "A perfect torrent of material", "title": "Nile-green and Danube-blue", "loc": "Chapter 4", "context": "Nile-green, Indian-azure, May-pink, Danube-blue: shops gave new dye colors romantic trade names to sell them. Zola stacks the silks from light at the top to heavy velvets at the bottom, a waterfall of color built to make customers lose their heads."},
    {"work": "zola-fat", "anchor": "At the crossway in the Rue des Halles cabbages were piled", "title": "Cabbages, pumpkins and eggplants at dawn", "loc": "Chapter 1", "context": "Zola paints Les Halles, the great Paris food market, like a still life: wine-lee red cabbages, orange pumpkins, blood-red tomatoes, the sombre violet of eggplant. The young painter Claude Lantier, hero of His Masterpiece, roams these same markets in this novel."},
    {"work": "zola-fat", "anchor": "Beneath the stall show-table, formed of a slab of red marble", "to": "send rolling down the stony paths as they clamber along ahead of their flocks.", "title": "A symphony of cheeses", "loc": "Chapter 5", "context": "Readers call this the 'symphony of cheeses', and it works mostly through smell, but color does steady work: golden Cheshire, Dutch cheeses like heads suffused with dry blood, Bries like dead moons, Roquefort marbled blue and yellow. Mould is a color too."},
    {"work": "zola-fat", "anchor": "Then she glanced at a little jar full of a sort of reddish dye", "n": 2, "from": "Then she glanced", "title": "Dyeing the butter yellow", "loc": "Chapter 5", "context": "Butter's yellow comes from carotene in fresh grass, so winter butter is pale, and sellers long added annatto, a dye from the seed coats of the achiote tree, to keep it golden. The translator's 'anotta' is annatto, still used to color butter and cheese today."},
    {"work": "zola-masterpiece", "anchor": "all-invading theory respecting the complementary", "from": "But the terrible affair which unhinged him once more", "to": "Insanity seemed to be at the end of it all.", "title": "Objects have no fixed colour", "loc": "Chapter 9", "context": "Claude's theory follows Chevreul's law of simultaneous contrast, which painters of the time read closely: a color shifts toward the opposite of its neighbor. The 'three primitive colours' are a painter's rule for mixing pigments, not the eye's own primaries, and Zola shows the theory pushing Claude toward violet flesh and despair."},
    {"work": "zola-masterpiece", "anchor": "The subject Claude chose was a corner of the Place du Carrousel", "from": "The subject Claude chose", "to": "sombre patches eaten into by the vivid glare.", "title": "Paving-stones that bled", "loc": "Chapter 8", "context": "Claude's painting of a Paris square at noon breaks sunlight into blues, yellows and reds where no one expected them, close to what the Impressionists were doing in these years. Zola knew Manet and Cézanne well, and the laughing crowds in the novel echo what they faced."},
    {"work": "zola-masterpiece", "anchor": "On the walls of the studio hung a series of sketches", "from": "On the walls of the studio", "to": "showing white, like a mosque, amidst a far-stretching blood-red plain.", "title": "Sketches of a burnt Provence", "loc": "Chapter 2", "context": "Claude's southern studies, tawny earth, grayish olive trees, a blood-red plain under blue sky, echo the country around Aix where Zola grew up with Cézanne. Many readers see Cézanne in Claude, though Zola mixed several painters into him."},
    {"work": "proust-swann", "anchor": "Its windows were never so brilliant as on days when the sun scarcely shone", "from": "Its windows were never so brilliant", "cut": [" (at one of those rare moments when the airy, empty church, more human somehow and more luxurious with the sun shewing off all its rich furnishings, seemed to have almost a habitable air, like the hall—all sculptured stone and painted glass—of some mediaeval mansion)"], "title": "The windows of Combray church", "loc": "Combray", "context": "Old stained glass is colored right through with metal oxides, and cobalt gives the deep blue Proust keeps returning to. He watches one window turn from peacock iridescence to hard sapphire as the light moves, the same glass never the same color twice."},
    {"work": "proust-swann", "anchor": "And it was indeed a hawthorn, but one whose flowers were pink", "cut": [" It, too, was in holiday attire, for one of those days which are the only true holidays, the holy days of religion, because they are not appointed by any capricious accident, as secular holidays are appointed, upon days which are not specially ordained for such observances, which have nothing about them that is essentially festal—but it was attired even more richly than the rest, for", " (with the simplicity of a woman from a village shop, labouring at the decoration of a street altar for some procession)"], "title": "The pink hawthorn", "loc": "Combray", "context": "Why does pink seem finer than white to the child? Because at Combray pink meant the dearest biscuits and cream cheese stained with strawberries. Proust shows a color's value being learned from food and festivals, then felt as if nature itself had chosen it."},
    {"work": "proust-swann", "anchor": "what fascinated me would be the asparagus", "from": "I would stop by the table", "title": "Asparagus stippled in mauve and azure", "loc": "Combray", "context": "Proust turns a kitchen vegetable into a sunrise: ultramarine and pink tips fading through mauve and azure to white feet. Real asparagus tips do carry purple and green tints, and the passage shows how close looking finds a whole gradient in one stalk."},
    {"work": "proust-grove", "anchor": "Sunrise is a necessary concomitant of long railway journeys", "from": "At a certain moment", "title": "Running between windows to save the dawn", "loc": "Place-Names: The Place", "context": "From a night train the narrator sees a strip of pink sky, loses it at a bend, then finds it red in the opposite window. He runs back and forth to piece the fragments into one 'continuous picture', an image of how we assemble a color from glimpses."},
    {"work": "proust-grove", "anchor": "Presently the days grew shorter and at the moment when I entered my room", "to": "precipitating it into the sea.", "title": "Sunsets in the bookcase glass", "loc": "Seascape, with Frieze of Girls", "context": "At Balbec the sunsets reflect in the glass of low bookcases, which Proust compares to the scattered panels of an old altarpiece. His colors come from the dinner table, aspic, gray mullet, salmon pink, keeping the sky tied to appetite. The painter Elstir, met at Balbec, is teaching him to see this way."},
    {"work": "proust-guermantes", "anchor": "Mme. de Guermantes advanced resolutely towards the carriage", "to": "they didn’t offend me in the least.”", "title": "Red dress, black shoes", "loc": "Chapter Two", "context": "Swann has just told the Duke and Duchess that he is dying. They hurry off to dinner, yet the Duke sends his wife back upstairs because black shoes clash with her red dress. Proust lets one rule of color matching outweigh a friend's death."},
    {"work": "hugo-notre-dame", "anchor": "This little chamber, which the king reserved for himself", "title": "A green of orpiment and indigo", "loc": "Book Ten, Chapter 5", "context": "Painters long mixed greens from a yellow and a blue. Orpiment, a bright yellow arsenic mineral, mixed with indigo made a green used in medieval manuscripts and painted rooms. Hugo, a keen antiquarian, gives Louis XI's cell the right recipe."},
    {"work": "hugo-notre-dame", "anchor": "In the church he found the gloom and silence of a cavern", "title": "Stained glass by moonlight", "loc": "Book Nine, Chapter 1", "context": "At night the painted windows keep only 'the doubtful colors of night'. That is true to vision: in dim light the eye's color cells go quiet and the rods, which see no hue, take over. Hugo turns the effect into a deathly violet, white and blue for a man in torment."},
    {"work": "hugo-miserables", "anchor": "The sky was of that charming, undecided hue", "title": "A sky that may be white or blue", "loc": "Part Five, Book One", "context": "Dawn over the barricade before the last assault. Hugo will not fix the sky's color, white or blue, and sets that gentle, undecided hue against black figures, livid house fronts, a rosy roof and a dead man's gray hair."},
    {"work": "hugo-miserables", "anchor": "From a dull hue he had turned red", "title": "From red to purple to flame", "loc": "Chapter 8: Marble against granite", "context": "Hugo grades an old royalist's anger like a color scale: dull, red, purple, flame. The trigger is one word, 'republic', spoken by his grandson. It is a comic use of the old idea that a face's color tracks the heat of feeling."},
    {"work": "stendhal-red", "anchor": "who am eternally condemned to wear this gloomy black suit", "title": "Condemned to this gloomy black", "loc": "Book Two", "context": "Julien envies the uniforms of Napoleon's day; now ambition means the priest's black coat. Stendhal never explained his title, and readers have taken red and black as army and church, or as roulette colors. Passages like this are why the first reading is so common."},
    {"work": "stendhal-red", "anchor": "He found it gloomy and deserted. All the transepts", "n": 3, "title": "Holy water like blood", "loc": "Book One, Chapter 5", "context": "Early in the book the crimson curtains of the church at Verrières make holy water look like blood, beside a scrap about an executed man. Julien will later fire on Madame de Rênal in this same church, its windows again hung with crimson, and die on the scaffold."},
    {"work": "balzac-unknown", "anchor": "see how three or four strokes of the brush and a thin glaze of blue", "to": "where the blood lay congealed instead of coursing through the veins?", "title": "A thin glaze of blue", "loc": "Chapter 1: Gillette", "context": "Frenhofer, the old master, fixes a painting in a few strokes: a blue glaze to put air around a head, brown-red and burnt ochre to warm a cold gray shadow. Glazing, thin transparent layers laid over dry paint, was a core method of the Flemish and Venetian masters he reveres."},
    {"work": "balzac-unknown", "anchor": "Your good woman is not badly done, but she is not alive", "from": "No, my friend, the blood does not flow", "title": "Blood that does not flow", "loc": "Chapter 1: Gillette", "context": "Frenhofer's charge is that the young painter's flesh is colored correctly but is not alive. The story ends with Frenhofer's own masterpiece buried under layers of paint, all but one perfect foot, and painters from Cézanne to Picasso saw themselves in it."},
    {"work": "mann-venice", "anchor": "In the glass he saw his brows arch more evenly", "from": "In the glass he saw", "to": "as red as raspberries.", "title": "Lips as red as raspberries", "loc": "Chapter 5", "context": "In his last days Aschenbach lets a barber dye his hair and paint his face: crimson cheeks, raspberry lips. It echoes the rouged old man who disgusted him on the boat to Venice, so the colors of cosmetics mark his fall."},
    {"work": "mann-venice", "anchor": "Revived by his sleep, he watched this miraculous event", "from": "Sky, earth, and sea", "to": "mounted the horizon.", "title": "Eos rises over the Lido", "loc": "Chapter 4", "context": "Mann paints the dawn in the language of Greek myth: roses strewn on the edge of the world, rosy and bluish mist, purple on the sea, golden spears. The classical colors match Aschenbach's dream of the boy Tadzio as a Greek god."},
    {"work": "huysmans-against", "anchor": "Slowly, one by one, he selected the colors.", "n": 6, "title": "Choosing colors by candlelight", "loc": "Chapter 2", "context": "Des Esseintes picks colors only for how they look under lamps, since he lives by night. His notes are sharp: candlelight is yellowish, so blues drift toward green or gray and violet keeps only its red. Santonin, the drug he mentions, was known to tint vision."},
    {"work": "huysmans-against", "anchor": "Of these, he preferred orange, thus by his own example", "n": 9, "cut": ["He studied all their nuances by candlelight, discovering a shade which, it seemed to him, would not lose its dominant tone, but would stand every test required of it. These preliminaries completed, he sought to refrain from using, for his study at least, oriental stuffs and rugs which have become cheapened and ordinary, now that rich merchants can easily pick them up at auctions and shops.\n\nHe finally decided to bind his walls, like books, with coarse-grained morocco, with Cape skin, polished by strong steel plates under a powerful press."], "title": "A study in orange and indigo", "loc": "Chapter 2", "context": "The theory that temperament picks color, dreamers blue and the nervous orange, is Des Esseintes's decadent fancy, not science. His room is real color sense: indigo wainscots against orange leather, two opposites that keep each other strong at night."},
    {"work": "huysmans-against", "anchor": "This tortoise was a fancy which had seized Des Esseintes", "n": 5, "title": "The gilded tortoise", "loc": "Chapter 4", "context": "To quiet a rug that is too bright, Des Esseintes has a live tortoise's shell glazed with gold, then set with jewels. It is a real lesson in contrast, one strong object can calm the colors around it, inside a cruel joke: the tortoise dies under its jewels."},
    {"work": "cervantes-quixote", "anchor": "dressed in a gaban of fine green cloth", "title": "The Knight of the Green Gaban", "loc": "Part Two, Chapter 16", "context": "Don Diego de Miranda, a sensible country gentleman, is dressed in green from cloak to spurs, and Don Quixote's nickname for him sticks. A gaban is a hooded riding cloak. Green was the color of hunting and country life, fitting for a man who lives quietly on his estate."},
    {"work": "cervantes-quixote", "anchor": "Am I to mark this day with a", "title": "A white stone or a black", "loc": "Part Two", "context": "Don Quixote borrows a Roman habit: marking lucky days with a white stone and unlucky ones with a black. Roman writers mention it, and English 'red-letter day' plays the same trick with the red ink of church calendars."},
    {"work": "dante-purgatory", "anchor": "A sweet color of oriental sapphire", "to": "afflicted my eyes and my breast.", "cut": [" pure even to the first circle,[1]"], "title": "Sweet color of oriental sapphire", "loc": "Purgatory, Canto I", "context": "Climbing out of Hell, Dante's first sight is the dawn sky: dolce color d'oriental zaffiro. 'Oriental' was a jeweler's word for the finest stones, so the line offers the best blue there is, after cantos of darkness."},
    {"work": "dante-purgatory", "anchor": "Thither we came to the first great stair", "to": "seated upon the threshold that seemed to me stone of adamant.", "title": "Three steps: white, dark, flame-red", "loc": "Purgatory, Canto IX", "context": "The steps at Purgatory's gate are usually read as the stages of confession: polished white marble where the sinner sees himself, cracked stone darker than perse for sorrow, blood-red porphyry for love. Dante defines perse elsewhere as a mix of purple and black in which the black wins."},
    {"work": "dante-purgatory", "anchor": "I have seen ere now at the beginning of the day the eastern region all rosy", "to": "beneath a green mantle.", "title": "Beatrice in white, green and flame", "loc": "Purgatory, Canto XXX", "context": "Beatrice returns in the colors of the three theological virtues: a white veil for faith, a green mantle for hope, a flame-red dress for love. As a boy, Dante writes in the Vita Nuova, he first saw her dressed in blood-red."},
    {"work": "dante-paradise", "anchor": "In form then of a pure white rose the holy host", "to": "the rest so white that no snow reaches that extreme.", "cut": ["[1]"], "title": "The white rose of heaven", "loc": "Paradise, Canto XXXI", "context": "Dante's last great image of the blessed is a vast white rose, with angels flying in and out like bees: faces of flame, wings of gold, the rest whiter than snow. By the end of the poem his palette has shrunk to light itself."},
    {"work": "homer-odyssey", "anchor": "Minerva sent them a fair wind from the West", "from": "Minerva sent them", "to": "as she sped onward.", "cut": ["22", "23"], "title": "Deep blue waves for a wine-dark sea", "loc": "Book II", "context": "Butler's 'deep blue waves' renders the Greek oinopa ponton, the sea 'wine-faced', usually translated 'wine-dark'; his own footnote quotes it. Scholars think Homer's color words track darkness and sheen as much as hue. It is a puzzle of vocabulary, not of Greek eyesight."},
    {"work": "homer-odyssey", "anchor": "The root was black, while the flower was as white as milk", "title": "Moly: black root, white flower", "loc": "Book X", "context": "Hermes gives Ulysses the herb moly against Circe's drugs. Its only description is a pair of colors, a black root and a milk-white flower, and readers have argued since antiquity about which real plant, if any, Homer meant."},
    {"work": "homer-iliad", "anchor": "He wrought also a fair fallow field, large and thrice ploughed", "n": 3, "cut": ["He wrought also a field of harvest corn, and the reapers were reaping with sharp sickles in their hands. Swathe after swathe fell to the ground in a straight line behind them, and the binders bound them in bands of twisted straw. There were three binders, and behind them there were boys who gathered the cut corn in armfuls and kept on bringing them to be bound: among them all the owner of the land stood by in silence and was glad. The servants were getting a meal ready under an oak, for they had sacrificed a great ox, and were busy cutting him up, while the women were making a porridge of much white barley for the labourers’ dinner."], "to": "the vines were trained on poles of silver.", "title": "A gold field that looked ploughed", "loc": "Book XVIII", "context": "On Achilles' shield the smith-god makes a field of gold that turns dark behind the plough, and black grapes on a golden vine. Bronze Age craftsmen did inlay metals of different colors, and Homer imagines that craft at a divine level."},
    {"work": "homer-iliad", "anchor": "Thus all day long the young men worshipped the god with song", "to": "as she sped onward.", "title": "Rosy-fingered Dawn and a deep blue wave", "loc": "Book I", "context": "Two of Homer's stock color epithets in one short voyage: rhododaktylos, 'rosy-fingered' Dawn, and the wave Butler calls 'deep blue', in Greek porphyreos, a word later tied to purple dye but here perhaps meaning dark or surging. Homer's colors are a puzzle of words and their uses, not of eyesight."},
    {"work": "murasaki-genji-1", "anchor": "It reminded him of the trunk of Samantabhadra", "from": "A moment afterwards he suddenly became aware of her main defect.", "to": "had turned definitely black with age.", "cut": ["She was very thin, her bones showing in the most painful manner, particularly her shoulder-bones which jutted out pitiably above her dress. He was sorry now that he had exacted from her this distressing exhibition, but so extraordinary a spectacle did she provide that he could not help continuing to gaze upon her. "], "title": "A nose the colour of safflower", "context": "Waley's “saffron-flower” is the safflower, suetsumuhana in Japanese, whose petals gave the Heian court its costly red dye. Hana means both flower and nose, so the red-tipped princess is named for the dye plant. Her purple faded to black is the second joke: old dye, old fashions."},
    {"work": "murasaki-genji-1", "anchor": "he put a dab of red on her nose", "from": "She was wearing a plain close-fitting dress of cherry colour", "to": "I would rather have a red nose than a black one.’", "title": "A dab of red on the nose", "context": "Genji, still thinking of the red-nosed princess, tests how one touch of red ruins a face, first in a picture, then on his own nose. The scene also records Heian make-up: a girl blackened her teeth when she came of age and painted her eyebrows, and Murasaki's old-fashioned grandmother had kept the child's teeth white."},
    {"work": "murasaki-genji-1", "anchor": "His servants brought him his light grey mourner", "from": "His servants brought him his light grey mourner", "to": "could not make him look peaked or drab.", "title": "Light grey for a wife, deep dye for a husband", "loc": "Chapter IX. Aoi", "context": "Heian mourning was worn in greys, and the depth of the dye showed how close the loss was. A husband mourning his wife wore a lighter grey than a widow would wear for him. Genji's poem turns that rule of shades into grief: the dress is light, the sorrow is black."},
    {"work": "murasaki-genji-2", "anchor": "party (the left) exhibited their pictures", "n": 2, "from": "Lady Chūjō’s party (the left)", "to": "their tunics, brown outside and yellow within.", "title": "Two teams dressed for a picture contest", "context": "At this court contest even the boxes, carpets and page girls are color-matched to their team. Note the phrases “blue outside and light green within” and “brown outside and yellow within”: Heian robes were seen as pairs of face and lining colors, and choosing the pair was an art."},
    {"work": "murasaki-genji-2", "anchor": "The procession moved on its way", "from": "The procession moved on its way", "to": "the handsomest figure in all the throng.", "title": "Green cloaks, and here and there a scarlet", "context": "At the Heian court rank was worn as color: each grade of official had a set hue for his cloak, so a crowd could be read at a glance. Waley's note adds that higher officers wore deeper shades, cloth dipped more often in the dye and so more costly."},
    {"work": "murasaki-genji-3", "anchor": "At the end of the year there took place the usual distribution", "from": "Murasaki had a peculiar talent in such matters", "to": "a somewhat heavy russet floss.", "title": "Choosing New Year robes for every lady", "context": "Murasaki, whose name is also the name of a purple dye plant, is praised as the subtlest judge of dyes at court. Her advice, to match a stuff to the wearer's complexion rather than to how it looks in the box, is still good color sense."},
    {"work": "murasaki-genji-3", "anchor": "To Tamakatsura he sent, among other gifts", "n": 3, "to": "during the Festival of the New Year.", "title": "A robe for each woman, a message in each", "context": "Each gift is read as a portrait: kerria flowers on red for the newcomer Tamakatsura, a “willow” pairing of white over green for the dowdy Suyetsumu, a dark purple lining that tells Murasaki how much the Lady of Akashi matters. Named face-and-lining pairs like the willow were part of the court's color vocabulary."},
    {"work": "murasaki-genji-3", "anchor": "They had been ordered to wear dove-grey lined with pale green", "from": "A tremendous cleaning and polishing", "to": "one crimson giant.", "title": "Emperor and minister in one crimson", "context": "A dress order puts the whole retinue in dove-grey over pale green, so the two figures in crimson stand out as one. Many readers see more than pageantry here: the shared color quietly pairs Genji with the young emperor, who is in secret his own son."},
    {"work": "sei-pillow", "anchor": "I like to think of a bachelor", "to": "as he disappears into the distance.", "title": "A lover's cloak of azalea-yellow or vermilion", "loc": "Stray Notes", "context": "Sei Shōnagon does not only say the man looks fine; she prescribes his colors, azalea-yellow or vermilion over white, as part of a perfect scene. The letter he writes is the next-morning poem a Heian lover owed after a night together, and even its paper and color were judged."},
    {"work": "sei-pillow", "anchor": "so calm was the lake that it looked as though", "title": "A lake like light green silk", "loc": "The Storm", "context": "She reaches for cloth to describe water: a calm lake is a sheet of glossy light green silk. For a court lady who judged people by their silks it is the natural comparison, and it makes the sudden storm feel like a betrayal."},
    {"work": "sei-pillow", "anchor": "It is the eighth month. A girl is wearing an unlined robe", "title": "An aster mantle in the eighth month", "loc": "Illness", "context": "Waley's note explains that “aster” names a color pairing: light purple lined with clear blue. Heian dress named such pairings after flowers and wore them in their season, so an aster mantle in the eighth month, mid-autumn, is in perfect taste, which makes the girl's illness more poignant."},
    {"work": "nights-burton-1", "anchor": "and the tarn and its fishes of four colours", "from": "They fared on till they had climbed the mountain", "to": "never did we set eyes upon it during all our days.\"", "title": "A tarn of fish in four colours", "context": "In the tale of the Fisherman and the Jinni, a lake appears where no lake was, full of fish in four colors: red, white, yellow and blue. The king will not go home until he knows why. The answer, later in the story, is that each color is a people under a spell."},
    {"work": "nights-lane-1", "anchor": "she transformed them into fish: the white are the Muslims", "from": "May God, by means of my enchantment", "to": "and the yellow, the Jews.", "title": "The fish were the people of a city", "context": "Lane used this passage to date the tale: around 1300 a decree in Mamluk Egypt made Christians wear blue turbans and Jews yellow ones, with white for Muslims. Dress laws like this turned colors into public labels of faith, and the story simply carries them over to the fish."},
    {"work": "cao-red-chamber", "anchor": "a cap of gold of purplish tinge, inlaid with precious gems", "title": "Pao-yue in deep red and slate blue", "context": "Our first sight of the hero, through his newly arrived cousin's eyes, is a catalogue of colors and embroidery. Red runs through the whole novel: the title Hung Lou Meng means a dream of red chambers, a phrase for the rich inner rooms where the women of a great house lived."},
    {"work": "cao-red-chamber", "anchor": "very much like the egg of a bird", "n": 3, "to": "maidens fair and young.", "title": "The stone the boy was born with", "context": "This is the jade Pao-yue was born holding in his mouth, revealed as the useless stone of the novel's opening myth; the book's other title is The Story of the Stone. Joly's “bright russet cloud” renders a Chinese image of bright, rosy clouds."},
    {"work": "cao-red-chamber", "anchor": "nor be fond of (girls dressed) in red", "title": "Stop tasting rouge and loving red", "context": "Hsi Jen's list of Pao-yue's bad habits includes mixing rouge, tasting the rouge on girls' lips and loving girls in red. In the novel red stands for the world of young women he adores; even his rooms in the great garden are called the Happy Red Court."},
    {"work": "kalidasa-shakuntala", "anchor": "Like powder black and soft I seem to see", "title": "A dark cloud on white Kailasa", "loc": "The Cloud-Messenger, stanza LIX", "context": "In The Cloud-Messenger an exiled demigod sends a rain cloud with a message to his wife. Here the dark cloud against the white peak becomes the dark-blue robe on the white shoulder of the Ploughman, Balarama, a god pictured fair-skinned and dressed in blue."},
    {"work": "kalidasa-shakuntala", "anchor": "Narrow the river seems from heaven's blue", "title": "A river of pearls, a cloud of sapphire", "loc": "The Cloud-Messenger, stanza XLVI", "context": "Seen from the sky, the thin bright river is a string of pearls, and the dark cloud stooping to drink from it becomes the sapphire at its center. Kālidāsa builds the whole journey of his cloud out of contrasts like this, dark against bright, told in jewels."},
    {"work": "tagore-home", "anchor": "clad in ascetic ochre, rushes into the quadrangle", "title": "Youths in ascetic ochre", "context": "In the Swadeshi movement of 1905 that the novel depicts, young nationalists took up the ochre robes of Hindu renunciants. Bimala sees them as a silt-reddened flood. Many readers take the novel as Tagore's warning about the heat of that movement, and this color is its first sign."},
    {"work": "okakura-tea", "anchor": "Luwuh considered the blue as the ideal colour for the tea-cup", "title": "Why the tea bowl should be blue", "context": "Lu Yu, the eighth-century author of the Classic of Tea, ranked bowls by what they did to the tea's color: bluish celadon made it look greener, white made it look pinkish. Okakura shows the taste in bowls changing as the way of making tea changed."},
    {"work": "okakura-tea", "anchor": "In the tea-room the fear of repetition is a constant presence", "title": "No colour repeated in the tea-room", "context": "Okakura's rule for the tea-room: nothing repeated, not even a black glaze beside black lacquer. Restraint here is not an absence of color but care with every single note, so that each object can be seen for itself."},
    {"work": "hearn-glimpses", "anchor": "Elfish everything seems", "n": 2, "to": "fictitious appearance of splendour.", "cut": ["For there are no immediately discernible laws of construction or decoration: each building seems to have a fantastic prettiness of its own; nothing is exactly like anything else, and all is bewilderingly novel. But gradually, after an hour passed in the quarter, the eye begins to recognise in a vague way some general plan in the construction of these low, light, queerly-gabled wooden houses, mostly unpainted, with their first stories all open to the street, and thin strips of roofing sloping above each shop-front, like awnings, back to the miniature balconies of paper-screened second stories. You begin to understand the common plan of the tiny shops, with their matted floors well raised above the street level, and the general perpendicular arrangement of sign-lettering, whether undulating on drapery or glimmering on gilded and lacquered signboards."], "title": "A city dressed in dark blue", "context": "Hearn's first morning in Yokohama in 1890: blue roofs, blue shop curtains, blue clothes. The rich dark blue was indigo, the everyday dye of working Japan, and he notices how lettering in white on dark blue turned a laborer's coat into a sign."},
    {"work": "hearn-glimpses", "anchor": "There are no such sunsets in Japan as in the tropics", "n": 3, "title": "Sunset over the lake at Matsue", "context": "Hearn guesses that Japan's soft, vapor-toned light shaped the taste of its dyers, then proves his eye with a sunset of purples, faint vermilions, ghostly greens and bronze. Take the theory as his own; the painting in words is exact."},
    {"work": "hearn-kokoro", "anchor": "that he saw again the mountains of his native land", "title": "Fuji turning pink, gold and white", "loc": "A Conservative, VIII", "context": "A returning exile sees Fuji at dawn. The snow goes from pink to gold to white as the sun climbs, while the mountain's base stays lost in shadow. It is a careful record of how the color of sunlight changes as the sun rises."},
    {"work": "hearn-kokoro", "anchor": "the morning sun immediately paints upon my shoji", "title": "A blue shadow on a golden screen", "loc": "From a Traveling Diary, II", "context": "Sunlight through paper turns the shoji gold, and the peach-tree's shadow reads as dark blue against it, the kind of colored shadow painters learned to see. Hearn wonders whether rooms lit through paper trained the eyes of Japanese artists."},
    {"work": "hearn-east", "anchor": "Mile after mile I rolled along that shore", "title": "All was steeped in blue", "loc": "The Dream of a Summer Day, III", "context": "On a coast road in Kyushu, sea, sky and the far mountains of Higo all dissolve into one blue. Hearn's comparison with the inside of a shell catches how haze and distance pull every form toward the color of the sky."},
    {"work": "polo-travels", "anchor": "should be clothed entirely in white; so, that day, everybody is in", "to": "beautiful animals, and richly caparisoned.", "title": "The White Feast of the New Year", "context": "Marco Polo describes the Mongol court's New Year, when everyone dressed in white for luck and gave white gifts, down to white horses. Mongolians still call their lunar New Year Tsagaan Sar, the White Month."},
    {"work": "polo-travels", "anchor": "hath set apart 12,000 of his", "to": "who are, as it were, his comrades.", "title": "Twelve thousand barons in one colour", "context": "Thirteen times a year the Great Kaan dressed 12,000 barons in robes of a single color, matching his own, with a different color for each feast. A whole court in one dye was a display of power: everyone could see whose men they were."},
    {"work": "polo-travels", "anchor": "those fine and valuable gems the Balas Rubies are found", "n": 2, "to": "a very cold one.", "skip": ["silver"], "title": "Balas rubies and the finest azure", "context": "The “azure” mined in Badakhshan, in today's northeast Afghanistan, is lapis lazuli, the stone ground into ultramarine, the costliest blue of European painting. The same valleys are still its classic source. Balas rubies are red spinels."},
    {"work": "bible-kjv", "anchor": "28:31 And thou shalt make the robe of the ephod all of blue.", "n": 4, "title": "A robe all of blue", "loc": "Exodus 28", "context": "The high priest's robe is “all of blue”, hemmed with pomegranates and golden bells. The Hebrew behind blue and purple names dyes usually traced to sea snails, and the scarlet came from an insect; all three were among the costliest colors of the ancient world."},
    {"work": "bible-kjv", "anchor": "And thou shalt make the breastplate of judgment with cunning work", "n": 6, "title": "Twelve stones on the high priest's breast", "loc": "Exodus 28", "context": "The breastplate set four rows of gems, one stone for each tribe of Israel, on cloth of gold, blue, purple and scarlet. The Hebrew stone names are hard to match to modern minerals, so “emerald” and “sapphire” are the translators' best guesses; the ancient sapphire may have been lapis lazuli."},
    {"work": "bible-kjv", "anchor": "4:2 And immediately I was in the spirit", "n": 5, "title": "A rainbow like an emerald", "loc": "Revelation 4", "context": "John's vision of the throne is built from stones and light: jasper, sardine (sard, a red stone), a rainbow “like unto an emerald”, white robes, gold crowns and a sea of glass. Readers have long noted that a green rainbow is no natural rainbow; it belongs to vision, not weather."},
    {"work": "ruskin-elements", "anchor": "what may be called the innocence of the eye", "title": "The innocence of the eye", "loc": "Letter I, note 1", "context": "Ruskin's famous claim: we see only flat patches of color and learn by experience to read them as solid things. To paint well, he says, you must recover a child's way of seeing those patches. The phrase became a touchstone for later painters and critics."},
    {"work": "ruskin-elements", "anchor": "MY DEAR READER,—If you have been obedient", "from": "For I should be sorry if, when you were led", "to": "can make a colorist.", "title": "Color is wholly relative", "context": "Ruskin warns his amateur pupils that a line can be judged right or wrong at once, but color is relative: every new touch changes every color already on the paper. Josef Albers built a whole course on the same truth a century later."},
    {"work": "ruskin-elements", "anchor": "However small a point of black may be", "from": "However small a point of black may be", "title": "Velázquez's black", "context": "Ruskin's rule: shadows should glow with color, and true black should be rare enough to surprise. He names Velázquez, famous for his blacks and greys, as the master of the “black chords”, whose black is worth more than other painters' crimson."},
    {"work": "ruskin-modern-1", "anchor": "Not long ago, I was slowly descending this very bit of carriage-road", "from": "But as I climbed the long slope of the Alban mount", "to": "first a torch and then an emerald.", "title": "I cannot call it color, it was conflagration", "context": "Ruskin wrote this to shame a dull brown landscape of La Riccia then given to Gaspar Poussin in the National Gallery. He walked the real road and found purple, crimson, scarlet and emerald: his proof that nature is far brighter than the old masters' browns."},
    {"work": "ruskin-modern-1", "anchor": "Throughout the works of Turner, the same truthful principle", "title": "Turner's greys and his one pure blue", "context": "Ruskin argues that Turner's brilliance comes from restraint. Pure white, crimson or blue appear in tiny doses, and everything else is softened toward grey or gold, so the few pure notes ring. A blue, he says, looks vivid by opposition."},
    {"work": "ruskin-stones-2", "anchor": "a multitude of pillars and white domes, clustered into a long low pyramid", "from": "And well may they fall back", "to": "inlaid them with coral and amethyst.", "cut": ["—sculpture fantastic and involved, of palm leaves and lilies, and grapes and pomegranates, and birds clinging and fluttering among the branches, all twined together into an endless network of buds and plumes; and, in the midst of it, the solemn forms of angels, sceptred, and robed to the feet, and leaning to each other across the gates, their figures indistinct among the gleaming of the golden ground through the leaves beside them, interrupted and dim, like the morning light as it faded back among the branches of Eden, when first its gates were angel-guarded long ago.", "their capitals rich with interwoven tracery, rooted knots of herbage, and drifting leaves of acanthus and vine, and mystical signs, all beginning and ending in the Cross; and above them, in the broad archivolts, a continuous chain of language and of life—angels, and the signs of heaven, and the labors of men, each in its appointed season upon the earth; and above these,"], "title": "St Mark's, a pyramid of colored light", "context": "Ruskin's most famous description: the front of St Mark's in Venice as a heap of gold, opal, alabaster, serpentine and blue. Every color he names is a real material, marble, porphyry or gold mosaic, gathered over centuries and much of it brought from the East."},
    {"work": "ruskin-stones-2", "anchor": "if the blue were taken from the sky", "title": "Color is the holiest gift", "context": "Ruskin answers those who call a love of color a mere sensual pleasure: take away the blue, gold, green and crimson and imagine a white world. His line that the purest minds love color most comes from this defense of the bright early buildings of Venice."},
    {"work": "pater-renaissance", "anchor": "woven through and through with gold thread", "title": "Landscapes woven with gold thread", "context": "Pater on the Venetian painters around Giorgione: their landscapes seem shot through with gold that warms flesh, huts and cypresses alike, with one cool blue peak for balance. He writes about the glow a picture leaves in the mind more than about its pigments."},
    {"work": "pater-renaissance", "anchor": "those pieces of pale blue and white earthenware", "title": "Della Robbia's blue and white", "context": "Luca della Robbia's glazed terracotta, white figures on pale blue grounds, became part of the look of Florence. Pater's image of fragments of milky sky fallen into the streets explains why the pairing still feels Tuscan."},
    {"work": "kandinsky-spiritual", "anchor": "Yellow, if steadily gazed at in any geometrical form", "n": 3, "cut": ["[Footnote: Any parallel between colour and music can only be relative. Just as a violin can give various shades of tone,—so yellow has shades, which can be expressed by various instruments. But in making such parallels, I am assuming in each case a pure tone of colour or sound, unvaried by vibration or dampers, etc.]"], "title": "Yellow, the earthly colour", "loc": "VI. The Language of Form and Colour", "context": "These are Kandinsky's own views from 1911, not findings of science. To him yellow pushes toward the viewer, turns shrill and aggressive, and can never be deep. His aim was a grammar of color for abstract painting, built on how colors felt to him."},
    {"work": "kandinsky-spiritual", "anchor": "The power of profound meaning is found in blue", "n": 8, "cut": ["[Footnote: ...The halos are golden for emperors and prophets (i.e. for mortals), and sky-blue for symbolic figures (i.e. spiritual beings); (Kondakoff, Histoire de l'An Byzantine consideree principalement dans les miniatures, vol. ii, p. 382, Paris, 1886-91).]", "[Footnote: Supernatural rest, not the earthly contentment of green. The way to the supernatural lies through the natural. And we mortals passing from the earthly yellow to the heavenly blue must pass through green.]", "[Footnote: As an echo of grief violet stand to blue as does green in its production of rest.]"], "title": "Blue, the heavenly colour", "loc": "VI. The Language of Form and Colour", "context": "Kandinsky's blue moves away from the viewer and deepens toward rest, grief and the spiritual, and he hears its shades as instruments, from flute to organ. It is a personal system, written as he was moving toward pure abstraction."},
    {"work": "kandinsky-spiritual", "anchor": "A well-balanced mixture of blue and yellow produces green", "title": "Green, the colour of the bourgeoisie", "loc": "VI. The Language of Form and Colour", "context": "For Kandinsky green is yellow and blue cancelling each other's movement, so it is restful and, after a while, dull: the self-satisfied middle class of colors. Read it as his opinion, vividly put, not as a rule of perception."},
    {"work": "kandinsky-spiritual", "anchor": "This world is too far above us for its harmony", "n": 2, "from": "White, therefore, has this harmony of silence", "to": "or even mute altogether.", "title": "White silence and black silence", "loc": "VI. The Language of Form and Colour", "context": "Kandinsky contrasts two silences: white, full of possibility, like the pause before music begins, and black, final, like ashes. His practical aside is sound studio lore: most colors look stronger against black than against white."},
    {"work": "newton-opticks", "anchor": "For the Rays to speak properly are not coloured", "title": "The rays are not coloured", "context": "Newton's key distinction: light rays have no color in themselves, only a power to stir up the sensation of a color. Color, in this view, is made in the seeing, an idea modern vision science still holds in spirit."},
    {"work": "newton-opticks", "anchor": "Exper. 15. Lastly, In attempting to compound a white", "to": "composed a dun Colour like that of a Mouse.", "title": "Why mixed paints make mouse-grey, not white", "context": "Mixing all the colors of light gives white, but Newton found that mixing painters' powders gives a dusky grey like ashes or a mouse. Pigments take light away rather than add it, which is why light and paint mix differently."},
    {"work": "newton-opticks", "anchor": "proportional to the seven Musical Tones or Intervals", "to": "from F to G all degrees of yellow, and so on.", "title": "Newton bends the spectrum into a circle", "context": "Newton joins the two ends of the spectrum into a circle, an ancestor of the color wheel, and sizes its seven parts by the intervals of a musical scale. The seven bands are his choice and his analogy; his own phrase “gradually passing into one another” admits the spectrum has no fixed borders."},
    {"work": "leonardo-notebooks", "anchor": "There is another kind of perspective which I call Aerial Perspective", "to": "make it five times bluer.", "cut": [" [Footnote 10: quado il sole e per leuante (when the sun is in the East). Apparently the author refers here to morning light in general. H. LUDWIG however translates this passage from the Vatican copy \"wenn namlich die Sonne (dahinter) im Osten steht\".] when the sun is in the East [Footnote 11: See Footnote 10]."], "title": "Five times as far, five times bluer", "context": "Leonardo's rule for painters: distant things take on the blue of the air between, so make far buildings bluer in step with their distance. The blue mountains behind his own paintings show the rule at work."},
    {"work": "leonardo-notebooks", "anchor": "Experience shows us that the air must have darkness beyond it", "title": "Why the sky is blue, tried with smoke", "loc": "Section 301", "context": "Leonardo's experiment: thin wood smoke seen against black velvet looks blue. He concluded that the sky's blue comes from fine particles lit against dark space. The modern answer is the scattering of sunlight by the air itself, but his smoke shows the same kind of scattering."},
    {"work": "leonardo-notebooks", "anchor": "The shadow caused by the light e, which is yellow, has a blue tinge", "from": "The shadow caused by the light e, which is yellow", "title": "A yellow light casts a blue shadow", "loc": "Section 272", "context": "With two colored lights, each shadow is lit by the other light: the shadow from the yellow lamp is blue where the blue light falls into it. Leonardo worked out colored shadows centuries before the Impressionists made them famous."},
    {"work": "vitruvius", "anchor": "We shall first set forth the natural colours that are dug up", "skip": ["silver"], "title": "Ochre followed like silver", "loc": "Book VII, Chapter VII", "context": "Yellow ochre, an earth stained by iron, is one of the oldest pigments of all. Vitruvius says the best came from the Athenian silver mines, where miners followed a vein of ochre as if it were silver itself."},
    {"work": "vitruvius", "anchor": "I will now return to the preparation of vermilion", "n": 3, "title": "Faberius and the blackened vermilion", "loc": "Book VII, Chapter IX", "context": "Vermilion, ground from cinnabar, a mercury ore, was the luxury red of Roman walls, and it can darken in strong light, as the secretary Faberius learned to his cost. Vitruvius's cure is a coat of melted wax, the treatment the Greeks called ganosis."},
    {"work": "vitruvius", "anchor": "Methods of making blue were first discovered in Alexandria", "skip": ["copper"], "title": "Cooking blue from sand, natron and copper", "loc": "Book VII, Chapter XI", "context": "This is Egyptian blue, the Romans' caeruleum, made by firing sand, natron and copper together. Often called the oldest synthetic pigment, it was made in Egypt for thousands of years before Vitruvius described its manufacture near Naples."},
    {"work": "vitruvius", "anchor": "I shall now begin to speak of purple, which exceeds all the colours", "n": 3, "title": "Purple, costliest of colours", "loc": "Book VII, Chapter XIII", "context": "Shellfish purple, the dye of imperial robes, came from murex snails, and Vitruvius records how it was crushed from them. His idea that the shade depends on the sun's course is his own; modern studies point to the kind of snail and the dyeing method instead."},
]

IMAGES = {
    "baum-oz": [
        {"src": "img/passages/baum-oz-1.jpg", "w": 677, "h": 900, "alt": "Green-tinted drawing of Dorothy, the Lion, the Scarecrow and the Tin Woodman walking through a crowded street of the Emerald City.", "caption": "W. W. Denslow's green plate of the friends entering the Emerald City, from the first edition, 1900.", "credit": "W. W. Denslow · Public domain", "license": "Public domain", "licenseUrl": "", "commons": "https://commons.wikimedia.org/wiki/File:The_Wonderful_Wizard_of_Oz_Book_-_p165.jpg"},
        {"src": "img/passages/baum-oz-2.jpg", "w": 723, "h": 900, "alt": "Green chapter page reading 'Chapter XI. The Wonderful Emerald City of Oz', with a small green-clad figure beside it.", "caption": "Denslow printed whole chapters of the 1900 first edition in one color; the Emerald City chapters are green.", "credit": "W. W. Denslow · Public domain", "license": "Public domain", "licenseUrl": "", "commons": "https://commons.wikimedia.org/wiki/File:The_Wonderful_Wizard_of_Oz_Book_-_p143.jpg"},
        {"src": "img/passages/baum-oz-3.jpg", "w": 688, "h": 900, "alt": "Green and yellow plate of a huge bald head on a throne, with Dorothy standing small below it.", "caption": "Dorothy meets the Wizard as a giant head in his green throne room, drawn by W. W. Denslow for the 1900 first edition.", "credit": "W. W. Denslow · Public domain", "license": "Public domain", "licenseUrl": "", "commons": "https://commons.wikimedia.org/wiki/File:The_Wonderful_Wizard_of_Oz_Book_-_p151.jpg"},
    ],
    "melville-moby": [
        {"src": "img/passages/melville-moby-1.jpg", "w": 574, "h": 900, "alt": "Black-and-white illustration of a huge white whale rising from the sea and crushing a whaleboat in its jaws.", "caption": "A. Burnham Shute's drawing of the white whale biting a whaleboat in two, from an illustrated edition of the 1890s.", "credit": "Augustus Burnham Shute · Public domain", "license": "Public domain", "licenseUrl": "", "commons": "https://commons.wikimedia.org/wiki/File:Moby_Dick_p510_illustration.jpg"},
        {"src": "img/passages/melville-moby-2.jpg", "w": 572, "h": 900, "alt": "Black-and-white illustration of Ahab standing in a whaleboat, raising a harpoon over a whale in rough water.", "caption": "I. W. Taber's illustration of the final chase, made for a 1902 edition of Moby-Dick.", "credit": "I. W. Taber · Public domain", "license": "Public domain", "licenseUrl": "", "commons": "https://commons.wikimedia.org/wiki/File:Moby_Dick_final_chase.jpg"},
    ],
    "fitzgerald-gatsby": [
        {"src": "img/passages/fitzgerald-gatsby-1.jpg", "w": 635, "h": 900, "alt": "Deep blue book cover with a woman's face and eyes floating over a glowing carnival-lit city skyline.", "caption": "Francis Cugat's cover for the first edition, 1925: a face in a night-blue sky above the lights of a city.", "credit": "Francis Cugat · Public domain", "license": "Public domain", "licenseUrl": "", "commons": "https://commons.wikimedia.org/wiki/File:The_Great_Gatsby_Cover_1925_Retouched.jpg"},
        {"src": "img/passages/fitzgerald-gatsby-2.jpg", "w": 716, "h": 900, "alt": "Black-and-white photograph of F. Scott Fitzgerald, young, in a suit, with hair parted in the middle.", "caption": "F. Scott Fitzgerald in a publicity photograph published in 1921, four years before Gatsby.", "credit": "Photographer unknown · Public domain", "license": "Public domain", "licenseUrl": "", "commons": "https://commons.wikimedia.org/wiki/File:F._Scott_Fitzgerald_(1921_portrait_-_crop)_Retouched.jpg"},
    ],
    "hawthorne-scarlet": [
        {"src": "img/passages/hawthorne-scarlet-1.jpg", "w": 730, "h": 900, "alt": "Oil painting of a dark-haired woman in a dark dress and red shawl holding a sleeping child.", "caption": "Hugues Merle's painting of Hester Prynne and Pearl, 1861; Hawthorne admired it (Walters Art Museum).", "credit": "Hugues Merle · Public domain", "license": "Public domain", "licenseUrl": "", "commons": "https://commons.wikimedia.org/wiki/File:Hugues_Merle_-_The_Scarlet_Letter_-_Walters_37172.jpg"},
        {"src": "img/passages/hawthorne-scarlet-2.jpg", "w": 595, "h": 900, "alt": "Engraving of Hester Prynne holding her baby on the pillory platform before a crowd.", "caption": "Hester on the scaffold with Pearl, an 1878 engraving by A. V. S. Anthony after Mary Hallock Foote.", "credit": "Mary Hallock Foote; engraved by A. V. S. Anthony · Public domain", "license": "Public domain", "licenseUrl": "", "commons": "https://commons.wikimedia.org/wiki/File:Hester_Prynne.jpg"},
    ],
    "goethe-colours": [
        {"src": "img/passages/goethe-colours-1.jpg", "w": 591, "h": 900, "alt": "Hand-painted color wheel in red, orange, yellow, green, blue and violet, with handwritten words around the ring.", "caption": "Goethe's own watercolor color wheel of 1809, labelling each color with a quality of the mind (Frankfurt Goethe Museum).", "credit": "Johann Wolfgang von Goethe · Public domain", "license": "Public domain", "licenseUrl": "", "commons": "https://commons.wikimedia.org/wiki/File:Goethe,_Farbenkreis_zur_Symbolisierung_des_menschlichen_Geistes-_und_Seelenlebens,_1809.jpg"},
        {"src": "img/passages/goethe-colours-2.jpg", "w": 900, "h": 558, "alt": "Two octagonal plates of black-and-white and colored patterns used for prism experiments.", "caption": "Plate from Zur Farbenlehre, 1810: black-and-white patterns to look at through a prism and see colored fringes.", "credit": "Johann Wolfgang von Goethe · Public domain", "license": "Public domain", "licenseUrl": "", "commons": "https://commons.wikimedia.org/wiki/File:Goethe_Tafel_Farbenlehre.jpg"},
        {"src": "img/passages/goethe-colours-3.jpg", "w": 730, "h": 900, "alt": "Oil portrait of an elderly Goethe in a dark coat, holding a letter.", "caption": "Goethe at 79, painted by Joseph Karl Stieler in 1828.", "credit": "Joseph Karl Stieler · Public domain", "license": "Public domain", "licenseUrl": "", "commons": "https://commons.wikimedia.org/wiki/File:Goethe_(Stieler_1828).jpg"},
    ],
    "goethe-faust": [
        {"src": "img/passages/goethe-faust-1.jpg", "w": 667, "h": 900, "alt": "Lithograph of a winged devil flying over a dark town with church spires.", "caption": "Eugène Delacroix's lithograph of Mephistopheles in the air, from his 1828 Faust series (Cleveland Museum of Art).", "credit": "Eugène Delacroix · CC0", "license": "CC0", "licenseUrl": "http://creativecommons.org/publicdomain/zero/1.0/deed.en", "commons": "https://commons.wikimedia.org/wiki/File:Eug%C3%A8ne_Delacroix_-_Illustrations_for_Faust-_M%C3%A9phistoph%C3%A9l%C3%A9s_in_the_air_-_1933.145.2_-_Cleveland_Museum_of_Art.jpg"},
        {"src": "img/passages/goethe-faust-2.jpg", "w": 730, "h": 900, "alt": "Oil portrait of an elderly Goethe in a dark coat, holding a letter.", "caption": "Goethe at 79, painted by Joseph Karl Stieler in 1828.", "credit": "Joseph Karl Stieler · Public domain", "license": "Public domain", "licenseUrl": "", "commons": "https://commons.wikimedia.org/wiki/File:Goethe_(Stieler_1828).jpg"},
    ],
    "poe-masque": [
        {"src": "img/passages/poe-masque-1.jpg", "w": 666, "h": 900, "alt": "Black-and-white drawing of a tall shrouded figure beside a great clock, revellers fleeing behind.", "caption": "Harry Clarke's plate for The Masque of the Red Death, from Tales of Mystery and Imagination, London, 1919.", "credit": "Harry Clarke · Public domain", "license": "Public domain", "licenseUrl": "", "commons": "https://commons.wikimedia.org/wiki/File:The_dagger_dropped_gleaming_upon_the_sable_carpet_-_Harry_Clarke_(BL_12703.i.43).tif"},
        {"src": "img/passages/poe-masque-2.jpg", "w": 640, "h": 900, "alt": "Black-and-white daguerreotype portrait of Edgar Allan Poe with dark moustache and tired eyes.", "caption": "Poe in a daguerreotype made in 1849, the year he died.", "credit": "Unknown photographer · Public domain", "license": "Public domain", "licenseUrl": "", "commons": "https://commons.wikimedia.org/wiki/File:Edgar_Allan_Poe,_circa_1849,_restored,_squared_off.jpg"},
    ],
    "joyce-ulysses": [
        {"src": "img/passages/joyce-ulysses-1.jpg", "w": 444, "h": 562, "alt": "Plain blue book cover with 'Ulysses' and 'James Joyce' in white capitals.", "caption": "The first edition, Paris, 1922: Joyce wanted the cover in the blue of the Greek flag, lettered in white.", "credit": "Shakespeare and Company (cover) · Public domain", "license": "Public domain", "licenseUrl": "", "commons": "https://commons.wikimedia.org/wiki/File:JoyceUlysses2.jpg"},
        {"src": "img/passages/joyce-ulysses-2.jpg", "w": 900, "h": 675, "alt": "Round stone Martello tower on the rocky shore at Sandycove, under a grey sky.", "caption": "The Martello tower at Sandycove, where Ulysses opens above the 'snotgreen sea'.", "credit": "moppet65535 · CC BY-SA 2.0", "license": "CC BY-SA 2.0", "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0", "commons": "https://commons.wikimedia.org/wiki/File:Martello_Tower,_Sandycove.jpg"},
    ],
    "joyce-portrait": [
        {"src": "img/passages/joyce-portrait-1.jpg", "w": 369, "h": 518, "alt": "Worn pale-blue cloth book cover with the title lettered in faded gold.", "caption": "The first American edition of A Portrait of the Artist as a Young Man, B. W. Huebsch, New York, 1916.", "credit": "B. W. Huebsch (publisher) · Public domain", "license": "Public domain", "licenseUrl": "", "commons": "https://commons.wikimedia.org/wiki/File:JamesJoyce_Portrait1916.jpg"},
        {"src": "img/passages/joyce-portrait-2.jpg", "w": 570, "h": 764, "alt": "Sepia photograph of James Joyce in a dark coat, seated in profile with a moustache.", "caption": "James Joyce in Zurich around the time the Portrait was published.", "credit": "Unknown · Public domain", "license": "Public domain", "licenseUrl": "", "commons": "https://commons.wikimedia.org/wiki/File:Revolutionary_Joyce_Better_Contrast.jpg"},
    ],
    "joyce-dubliners": [
        {"src": "img/passages/joyce-dubliners-1.jpg", "w": 522, "h": 850, "alt": "Title page reading 'Dubliners by James Joyce, London, Grant Richards Ltd.'", "caption": "Title page of the first edition of Dubliners, London, 1914.", "credit": "Grant Richards (publisher) · Public domain", "license": "Public domain", "licenseUrl": "", "commons": "https://commons.wikimedia.org/wiki/File:Joyce_-_Dubliners,_1914_-_3690390_F.jpg"},
    ],
    "woolf-dalloway": [
        {"src": "img/passages/woolf-dalloway-1.jpg", "w": 659, "h": 900, "alt": "Black-and-white photograph of the young Virginia Woolf in profile, hair in a low bun.", "caption": "Virginia Woolf at twenty, photographed by George Charles Beresford in 1902.", "credit": "George Charles Beresford · Public domain", "license": "Public domain", "licenseUrl": "", "commons": "https://commons.wikimedia.org/wiki/File:George_Charles_Beresford_-_Virginia_Woolf_in_1902_-_Restoration.jpg"},
        {"src": "img/passages/woolf-dalloway-2.jpg", "w": 497, "h": 761, "alt": "Plain title page reading 'Mrs. Dalloway, Virginia Woolf', published at the Hogarth Press, 1925.", "caption": "Title page of the first edition, printed by Leonard and Virginia Woolf's Hogarth Press, 1925.", "credit": "Hogarth Press · Public domain", "license": "Public domain", "licenseUrl": "", "commons": "https://commons.wikimedia.org/wiki/File:Mrs_Dalloway_1925.jpg"},
    ],
    "woolf-voyage": [
        {"src": "img/passages/woolf-voyage-1.jpg", "w": 329, "h": 534, "alt": "Title page reading 'The Voyage Out by Virginia Woolf, London, Duckworth & Co., 1915'.", "caption": "Title page of Woolf's first novel, Duckworth, London, 1915.", "credit": "Duckworth & Co. · Public domain", "license": "Public domain", "licenseUrl": "", "commons": "https://commons.wikimedia.org/wiki/File:The_Voyage_Out.jpg"},
    ],
}

if __name__ == "__main__":
    a = sys.argv[1:]
    RAW.mkdir(parents=True, exist_ok=True)
    # --picks <json> / --out <json>: build from another picks file into another output (for drafts)
    if "--picks" in a:
        PICKS = Path(a[a.index("--picks") + 1])
    if "--images" in a:
        IMAGES = json.loads(Path(a[a.index("--images") + 1]).read_text())
    if "--out" in a:
        OUT = Path(a[a.index("--out") + 1])
    if "--fetch" in a:
        for k in (a[a.index("--fetch") + 1:] or WORKS):
            try:
                fetch_text(k)
                print("ok", k)
            except Exception as e:
                print("FAILED", k, e)
    elif "--candidates" in a:
        candidates(a[a.index("--candidates") + 1:] or list(WORKS))
    elif "--find" in a:
        find(a[a.index("--find") + 1], a[a.index("--find") + 2])
    elif "--films" in a:
        films(a[a.index("--films") + 1:])
        sys.exit(0 if check() else 1)
    elif "--check" in a:
        sys.exit(0 if check() else 1)
    else:
        build()
        sys.exit(0 if check() else 1)
