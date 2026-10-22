"""Other Polish museums (Wilanow, Royal Castle, Poznan, Wroclaw, Wawel, Lazienki, Kielce, Lodz, Gdansk, Czartoryski, Katowice, Szczecin, Lublin, Torun, Museum of Warsaw): paintings from Wikidata collection(s) (P195) with a Commons image; see wd.py for the filters and the public-domain gate."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import wd  # noqa: E402

wd.run('poland_other', [('Q277333', 'Wilanow'), ('Q756098', 'Zamek Krolewski'), ('Q194533', 'MN Poznan'), ('Q1329563', 'MN Wroclaw'), ('Q18820', 'Wawel'), ('Q345276', 'Lazienki'), ('Q11787092', 'MN Kielce'), ('Q1141934', 'Muzeum Sztuki Lodz'), ('Q1968661', 'MN Gdansk'), ('Q1450630', 'Czartoryski'), ('Q2239241', 'Silesian Museum'), ('Q2802195', 'MN Szczecin'), ('Q6695405', 'MN Lublin'), ('Q11787111', 'Torun'), ('Q202277', 'Museum of Warsaw')], 'Other Polish museums (Wilanow, Royal Castle, Poznan, Wroclaw, Wawel, Lazienki, Kielce, Lodz, Gdansk, Czartoryski, Katowice, Szczecin, Lublin, Torun, Museum of Warsaw)', country='Poland')
