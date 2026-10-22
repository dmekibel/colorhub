"""Ireland (National Gallery of Ireland, Hugh Lane): paintings from Wikidata collection(s) (P195) with a Commons image; see wd.py for the filters and the public-domain gate."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import wd  # noqa: E402

wd.run('ireland', [('Q2018379', 'National Gallery of Ireland'), ('Q496040', 'Hugh Lane Gallery')], 'Ireland (National Gallery of Ireland, Hugh Lane)', country='Ireland')
