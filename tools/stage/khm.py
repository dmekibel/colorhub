"""Kunsthistorisches Museum Vienna: paintings from Wikidata collection(s) (P195) with a Commons image; see wd.py for the filters and the public-domain gate."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import wd  # noqa: E402

wd.run('khm', [('Q95569', 'Kunsthistorisches Museum')], 'Kunsthistorisches Museum Vienna', country='Austria')
