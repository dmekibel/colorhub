"""Other Finnish museums (Serlachius, Turku, Gallen-Kallela, Lonnstrom, Jarvenpaa, HAM, Tampere, Hameenlinna, Pori): paintings from Wikidata collection(s) (P195) with a Commons image; see wd.py for the filters and the public-domain gate."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import wd  # noqa: E402

wd.run('finland_other', [('Q11860868', 'Gosta Serlachius'), ('Q4502138', 'Turku Art Museum'), ('Q1636905', 'Gallen-Kallela Museum'), ('Q83222759', 'Lonnstrom Art Museum'), ('Q15607005', 'Jarvenpaa Art Museum'), ('Q5710459', 'HAM Helsinki'), ('Q10690515', 'Tampere Art Museum'), ('Q11864061', 'Hameenlinna Art Museum'), ('Q86443703', 'Pori art collection')], 'Other Finnish museums (Serlachius, Turku, Gallen-Kallela, Lonnstrom, Jarvenpaa, HAM, Tampere, Hameenlinna, Pori)', country='Finland')
