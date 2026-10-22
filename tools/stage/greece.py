"""Greece (National Gallery Athens, Benaki, Byzantine and Christian Museum, Antivouniotissa, MOMus, Niarchos): paintings from Wikidata collection(s) (P195) with a Commons image; see wd.py for the filters and the public-domain gate."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import wd  # noqa: E402

wd.run('greece', [('Q1167467', 'National Gallery Athens'), ('Q816669', 'Benaki Museum'), ('Q276900', 'Antivouniotissa'), ('Q1018775', 'Byzantine and Christian Museum'), ('Q247518', 'MOMus'), ('Q15697027', 'Stavros Niarchos Collection')], 'Greece (National Gallery Athens, Benaki, Byzantine and Christian Museum, Antivouniotissa, MOMus, Niarchos)', country='Greece')
