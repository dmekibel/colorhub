"""Museo Thyssen-Bornemisza and Museu/Carmen Thyssen (Spain): paintings from Wikidata collection(s) (P195) with a Commons image; see wd.py for the filters and the public-domain gate."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import wd  # noqa: E402

wd.run('thyssen', [('Q176251', 'Thyssen-Bornemisza Museum'), ('Q5043601', 'Carmen Thyssen Museum')], 'Museo Thyssen-Bornemisza and Museu/Carmen Thyssen (Spain)', country='Spain')
