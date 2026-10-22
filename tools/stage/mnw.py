"""National Museum in Warsaw: paintings from Wikidata collection(s) (P195) with a Commons image; see wd.py for the filters and the public-domain gate."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import wd  # noqa: E402

wd.run('mnw', [('Q153306', 'Muzeum Narodowe w Warszawie')], 'National Museum in Warsaw', country='Poland')
