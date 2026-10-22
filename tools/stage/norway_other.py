"""Other Norwegian museums (Munch, Oslo Museum, KODE, Trondheim, Lillehammer, Stavanger, Stenersen, Nordnorsk, Glomdalen): paintings from Wikidata collection(s) (P195) with a Commons image; see wd.py for the filters and the public-domain gate."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import wd  # noqa: E402

wd.run('norway_other', [('Q844926', 'Munchmuseet'), ('Q6877320', 'Oslo Museum'), ('Q12715958', 'KODE'), ('Q1770313', 'Art Museums of Bergen'), ('Q12007630', 'Trondheim kunstmuseum'), ('Q3133600', 'Lillehammer kunstmuseum'), ('Q19382034', 'Museum Stavanger'), ('Q1801421', 'Stenersenmuseet'), ('Q16862765', 'Nordnorsk Kunstmuseum'), ('Q15727804', 'Glomdalsmuseet')], 'Other Norwegian museums (Munch, Oslo Museum, KODE, Trondheim, Lillehammer, Stavanger, Stenersen, Nordnorsk, Glomdalen)', country='Norway')
