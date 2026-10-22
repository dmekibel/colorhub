"""Hungary (Museum of Fine Arts, Hungarian National Gallery, National Museum, Pecs, Csontvary, Herman Otto): paintings from Wikidata collection(s) (P195) with a Commons image; see wd.py for the filters and the public-domain gate."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import wd  # noqa: E402

wd.run('hungary', [('Q840886', 'Szepmuveszeti Muzeum'), ('Q252071', 'Magyar Nemzeti Galeria'), ('Q914141', 'Magyar Nemzeti Muzeum'), ('Q1178249', 'Modern Magyar Galeria Pecs'), ('Q874325', 'Csontvary Muzeum'), ('Q1035562', 'Herman Otto Muzeum')], 'Hungary (Museum of Fine Arts, Hungarian National Gallery, National Museum, Pecs, Csontvary, Herman Otto)', country='Hungary')
