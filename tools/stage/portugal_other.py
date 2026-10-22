"""Other Portuguese museums (Chiado, Gulbenkian, Soares dos Reis, Malhoa, Grao Vasco, Machado de Castro, Ajuda, Anastacio Goncalves, Cenaculo): paintings from Wikidata collection(s) (P195) with a Commons image; see wd.py for the filters and the public-domain gate."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import wd  # noqa: E402

wd.run('portugal_other', [('Q2745620', 'Museu do Chiado'), ('Q211262', 'Museu Calouste Gulbenkian'), ('Q1054339', 'CAM Gulbenkian'), ('Q3052794', 'Fundacao Calouste Gulbenkian'), ('Q5047773', 'Casa-Museu Anastacio Goncalves'), ('Q1141468', 'Museu Nacional Soares dos Reis'), ('Q6292942', 'Museu Jose Malhoa'), ('Q10333873', 'Museu Frei Manuel do Cenaculo'), ('Q5612742', 'Museu Grao Vasco'), ('Q6974439', 'Museu Machado de Castro'), ('Q1478288', 'Palacio da Ajuda'), ('Q10333556', 'Museu Carlos Reis')], 'Other Portuguese museums (Chiado, Gulbenkian, Soares dos Reis, Malhoa, Grao Vasco, Machado de Castro, Ajuda, Anastacio Goncalves, Cenaculo)', country='Portugal')
