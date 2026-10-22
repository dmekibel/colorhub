"""Baltics (Latvian National Museum of Art, Riga Bourse, Art Museum of Estonia, Tartu, Kadriorg, Lithuanian National Museum of Art): paintings from Wikidata collection(s) (P195) with a Commons image; see wd.py for the filters and the public-domain gate."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import wd  # noqa: E402

wd.run('baltics', [('Q1370465', 'Latvian National Museum of Art', 'Latvia'), ('Q1954623', 'Art Museum Riga Bourse', 'Latvia'), ('Q56189782', 'Art Museum of Estonia', 'Estonia'), ('Q56189773', 'Art Museum of Estonia foreign', 'Estonia'), ('Q55986655', 'Tartu Art Museum', 'Estonia'), ('Q16412739', 'Kadriorg Art Museum', 'Estonia'), ('Q56459717', 'Narva Museum', 'Estonia'), ('Q1865041', 'Lithuanian National Museum of Art', 'Lithuania')], 'Baltics (Latvian National Museum of Art, Riga Bourse, Art Museum of Estonia, Tartu, Kadriorg, Lithuanian National Museum of Art)', country=None)
