"""Czechia (National Gallery Prague, Moravian Gallery, Prague City Gallery, Lobkowicz, Kromeriz): paintings from Wikidata collection(s) (P195) with a Commons image; see wd.py for the filters and the public-domain gate."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import wd  # noqa: E402

wd.run('czechia', [('Q1419555', 'Narodni galerie Praha'), ('Q3094617', 'Moravska galerie'), ('Q101017476', 'Galerie hlavniho mesta Prahy'), ('Q27922184', 'Lobkowicz Collections'), ('Q18702931', 'Kromeriz')], 'Czechia (National Gallery Prague, Moravian Gallery, Prague City Gallery, Lobkowicz, Kromeriz)', country='Czechia')
