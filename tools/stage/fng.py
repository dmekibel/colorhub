"""Finnish National Gallery (Ateneum), via Wikidata (Finna API is behind a bot challenge): paintings from Wikidata collection(s) (P195) with a Commons image; see wd.py for the filters and the public-domain gate."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import wd  # noqa: E402

wd.run('fng', [('Q2983474', 'Finnish National Gallery'), ('Q11853265', 'Ateneum')], 'Finnish National Gallery (Ateneum), via Wikidata (Finna API is behind a bot challenge)', country='Finland')
