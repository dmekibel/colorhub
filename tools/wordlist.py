#!/usr/bin/env python3
"""Shared word lexicon for the data-quality checks (core names typos, Maerz & Paul OCR filter).

known(word) is True when a lowercase token is an English word, a proper name/place (macOS web2, web2a,
propernames), a color/pigment/dye word from the curated extras below, or part of a trusted color-name source
(CSS, xkcd, ISCC-NBS, Wikipedia lists, Werner, Ridgway as stored in data/library.json for sources that are
hand-keyed or machine-readable, never OCR). Deliberately NOT built from the Maerz & Paul OCR itself.
"""
import json, re, unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Color, pigment, dye, textile, mineral and place words the system dictionary lacks (not exhaustive: anything
# else that the trusted sources use is picked up from library.json below).
EXTRAS = set("""
aniline alizarin ultramarine cerulean cadmium viridian vermilion vermillion carmine cochineal madder indigo
woad weld sienna umber ochre ocher sepia gamboge verdigris smalt zaffre malachite azurite orpiment realgar
cinnabar minium massicot terre verte kermes tyrian mauveine mauve magenta solferino fuchsine lilac wisteria
heliotrope periwinkle celadon eau nil chartreuse cerise fuchsia puce taupe ecru beige khaki buff fawn
champagne claret burgundy bordeaux maroon russet auburn chestnut mahogany sorrel roan dun cinereous
isabelline coquelicot capucine nacarat ponceau rosolane gridelin tabac havana corinth corinthian
lavender lilas violette jonquil canary primrose saffron mustard citron aquamarine turquoise cyan teal
cadet gunmetal pewter slate graphite charcoal ebony sable jet onyx obsidian ivory alabaster
chalcedony carnelian cornelian jasper agate amethyst topaz peridot beryl garnet jacinth hyacinth zircon
spinel tourmaline malachite turquoise lapis lazuli sapphire emerald ruby opal jade
tangerine mandarin apricot nectarine marigold amber copper bronze brass rust terracotta sienna
raw burnt umber sepia bistre bister bitumen asphaltum madder alizarin lake
bluey greeny pinky yellowy reddish bluish greenish yellowish purplish brownish greyish orangish pinkish
grayish greenish
macaroni nubian egyptian roman persian chinese japanese spanish russian prussian indian turkish venetian
parisian florentine castilian neapolitan bavarian saxon austrian german french english scottish welsh irish
african american canadian mexican brazilian peruvian chilean cuban jamaican hawaiian polynesian
oxford cambridge yale harvard princeton eton harrow stanford columbia cornell dartmouth
""".split())

_cache = None


def _norm(w):
    return unicodedata.normalize("NFKD", w).encode("ascii", "ignore").decode().lower()


def lexicon():
    global _cache
    if _cache is not None:
        return _cache
    words = set()
    for f in ("/usr/share/dict/web2", "/usr/share/dict/web2a", "/usr/share/dict/propernames"):
        try:
            for line in open(f, encoding="latin-1"):
                words.add(_norm(line.strip()))
        except OSError:
            pass
    words |= EXTRAS
    # trusted color-name sources: tokens used by CSS / xkcd / ISCC-NBS / Wikipedia / Werner / Ridgway entries
    try:
        lib = json.loads((ROOT / "data" / "library.json").read_text(encoding="utf-8"))
        for e in lib:
            if set(e["src"]) & {"css", "xkcd", "iscc-nbs", "wiki", "werner", "ridgway", "ral", "app"}:
                for t in re.split(r"[^A-Za-z]+", _norm(e["n"])):
                    if len(t) > 1:
                        words.add(t)
    except Exception:
        pass
    words.discard("")
    _cache = words
    return words


def tokens(name):
    return [t for t in re.split(r"[^a-z]+", _norm(name)) if t]


def unknown_tokens(name, extra=()):
    lex = lexicon()
    out = []
    for t in tokens(name):
        if len(t) < 2 or t in lex or t in extra:
            continue
        # simple plural / possessive / -y / -ish tolerance
        if (t.endswith("s") and t[:-1] in lex) or (t.endswith("ish") and t[:-3] in lex) or (t.endswith("y") and t[:-1] in lex):
            continue
        out.append(t)
    return out
