"""National Museum in Krakow: paintings from Wikidata collection(s) (P195) with a Commons image; see wd.py for the filters and the public-domain gate."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import wd  # noqa: E402

wd.run('mnk', [('Q195311', 'Muzeum Narodowe w Krakowie')], 'National Museum in Krakow', country='Poland')
