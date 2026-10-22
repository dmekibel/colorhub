"""Nationalmuseum Sweden, via Wikidata (cross-check of the official API): paintings from Wikidata collection(s) (P195) with a Commons image; see wd.py for the filters and the public-domain gate."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import wd  # noqa: E402

wd.run('nationalmuseum_wd', [('Q842858', 'Nationalmuseum')], 'Nationalmuseum Sweden, via Wikidata (cross-check of the official API)', country='Sweden')
