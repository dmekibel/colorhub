"""Museo del Prado (Madrid): paintings from the Wikidata collection Q160112 (the Prado publishes its own open data only as
linked data with no bulk dump reachable from here; Wikidata/Commons carry the catalogue). See wd.py for the filters."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import wd  # noqa: E402

wd.run("prado", [("Q160112", "Museo del Prado")], "Museo del Prado", country="Spain")
