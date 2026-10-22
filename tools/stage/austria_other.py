"""Other Austrian museums (Liechtenstein, Leopold, Academy, Salzburg, Wien Museum, Tyrol, Vorarlberg, Schonbrunn, Albertina): paintings from Wikidata collection(s) (P195) with a Commons image; see wd.py for the filters and the public-domain gate."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import wd  # noqa: E402

wd.run('austria_other', [('Q1824069', 'Liechtenstein Museum'), ('Q59435', 'Leopold Museum'), ('Q414219', 'Akademie der bildenden Kunste'), ('Q1248553', 'Residenzgalerie Salzburg'), ('Q505873', 'Wien Museum'), ('Q2215920', 'Salzburg Museum'), ('Q2436253', 'Tiroler Landesmuseum'), ('Q2533480', 'vorarlberg museum'), ('Q131330', 'Schonbrunn'), ('Q371908', 'Albertina')], 'Other Austrian museums (Liechtenstein, Leopold, Academy, Salzburg, Wien Museum, Tyrol, Vorarlberg, Schonbrunn, Albertina)', country='Austria')
