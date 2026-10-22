"""Other Swiss museums (Basel, Bern, Geneva, Winterthur, Buhrle, Langmatt, Romerholz, Lucerne, St Gallen, Solothurn, Klee, Beyeler): paintings from Wikidata collection(s) (P195) with a Commons image; see wd.py for the filters and the public-domain gate."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import wd  # noqa: E402

wd.run('switzerland_other', [('Q194626', 'Kunstmuseum Basel'), ('Q194622', 'Kunstmuseum Bern'), ('Q679075', "Musee d'art et d'histoire Geneve"), ('Q650299', 'Kunst Museum Winterthur'), ('Q689829', 'Kunst Museum Winterthur Reinhart'), ('Q666331', 'Sammlung Buhrle'), ('Q1341595', 'Museum Langmatt'), ('Q682406', 'Am Romerholz'), ('Q1792543', 'Kunstmuseum Luzern'), ('Q1792552', 'Kunstmuseum St. Gallen'), ('Q683163', 'Kunstmuseum Solothurn'), ('Q191189', 'Zentrum Paul Klee'), ('Q673833', 'Fondation Beyeler'), ('Q3329523', 'Musee cantonal des Beaux-Arts'), ('Q684556', 'Villa Flora'), ('Q18752218', 'Petit Palais Geneve'), ('Q1020806', 'Bundner Kunstmuseum')], 'Other Swiss museums (Basel, Bern, Geneva, Winterthur, Buhrle, Langmatt, Romerholz, Lucerne, St Gallen, Solothurn, Klee, Beyeler)', country='Switzerland')
