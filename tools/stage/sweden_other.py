"""Other Swedish museums (Portrait Gallery, Gothenburg, Hallwyl, Skokloster, Thiel, Drottningholm, Malmo, Moderna, Zorn, Waldemarsudde, Ostergotland): paintings from Wikidata collection(s) (P195) with a Commons image; see wd.py for the filters and the public-domain gate."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import wd  # noqa: E402

wd.run('sweden_other', [('Q2817221', 'Statens portrattsamling Gripsholm'), ('Q1992004', 'Goteborgs konstmuseum'), ('Q4346239', 'Hallwylska museet'), ('Q1891413', 'Skokloster'), ('Q252259', 'Thielska galleriet'), ('Q18572999', 'Drottningholm'), ('Q2791306', 'Malmo konstmuseum'), ('Q1274511', 'Moderna Museet'), ('Q4976948', 'Zorn collections'), ('Q537', 'Waldemarsudde'), ('Q10727870', 'Ostergotlands museum')], 'Other Swedish museums (Portrait Gallery, Gothenburg, Hallwyl, Skokloster, Thiel, Drottningholm, Malmo, Moderna, Zorn, Waldemarsudde, Ostergotland)', country='Sweden')
