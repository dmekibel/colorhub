"""Other Spanish museums (MNAC, Cordoba, Valencia, Sevilla, Bilbao, Lazaro Galdiano, Reina Sofia, Sorolla, San Fernando, Zaragoza, Romanticismo, El Greco, Girona, Cerralbo, Cau Ferrat, Trinidad, Balaguer): paintings from Wikidata collection(s) (P195) with a Commons image; see wd.py for the filters and the public-domain gate."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import wd  # noqa: E402

wd.run('spain_other', [('Q861252', 'MNAC'), ('Q6034310', 'Museo de la Trinidad'), ('Q6033943', 'Museo de Bellas Artes de Cordoba'), ('Q526170', 'Biblioteca Museu Victor Balaguer'), ('Q1322403', 'Real Academia de San Fernando'), ('Q1748404', 'Museu de Belles Arts de Valencia'), ('Q2163496', 'Museo de Bellas Artes de Sevilla'), ('Q127064', 'Bilbao Fine Arts Museum'), ('Q386570', 'Museo Lazaro Galdiano'), ('Q460889', 'Museo Reina Sofia'), ('Q1592523', 'Museo Sorolla'), ('Q2837755', 'Museo de Zaragoza'), ('Q6974501', 'Museo del Romanticismo'), ('Q3848124', 'Museo del Greco'), ('Q976019', 'Museo Cerralbo'), ('Q11694558', "Museu d'Art de Girona"), ('Q4894835', 'Museu Cau Ferrat')], 'Other Spanish museums (MNAC, Cordoba, Valencia, Sevilla, Bilbao, Lazaro Galdiano, Reina Sofia, Sorolla, San Fernando, Zaragoza, Romanticismo, El Greco, Girona, Cerralbo, Cau Ferrat, Trinidad, Balaguer)', country='Spain')
