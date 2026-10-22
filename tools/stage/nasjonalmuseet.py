"""Nasjonalmuseet (Norway), via Wikidata (DigitaltMuseum API needs a key): paintings from Wikidata collection(s) (P195) with a Commons image; see wd.py for the filters and the public-domain gate."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import wd  # noqa: E402

wd.run('nasjonalmuseet', [('Q1132918', 'Nasjonalmuseet'), ('Q3330707', 'Nasjonalgalleriet')], 'Nasjonalmuseet (Norway), via Wikidata (DigitaltMuseum API needs a key)', country='Norway')
