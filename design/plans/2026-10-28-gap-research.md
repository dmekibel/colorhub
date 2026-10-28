# Gap research, 2026-10-28 (Commons API + Wikidata; "held" matched by painter name, so transliteration can understate)
Rule: public domain / CC0 / CC BY(-SA); painters died before 1955 or anonymous; no post-1955. The 50-per-country floor was a guide, not a rule (David).

## Biggest country gaps (Wikidata painters d<1955 with a Commons category / their Commons files / rows we hold)
Czechia 456/8,924/596 | Ukraine 347/5,167/277 | Romania 165/3,497/11 | Hungary 247/2,399/646 | Canada 106/1,502/54 | Slovakia 93/1,326/25 | Greece 135/1,410/220 | Croatia 56/805/2 | Turkey 74/812/119 | Chile 39/674/43 | Bulgaria 31/608/0 | Mexico 51/840/258 | Georgia 35/513/0 | Serbia 58/497/2 | Colombia 19/241/4.
Not held at all: Bulgaria, Georgia, Azerbaijan, Albania, Iceland. Under 5: Croatia, Serbia, Colombia, Armenia, Malta, Vietnam.

## Russian Empire painters with the biggest gaps (exact Commons category -> files, held, rough gap)
Roerich 2686/608/~2000 (many sketches) | Kandinsky 1350/839/~500 | Repin 727/289/~400 | Polenov 614/164/~450 | Gerson (Poland) 450/130/~320 | Vrubel 350/42/~300 | Surikov 492/223/~270 | Gallen-Kallela 576/327/~250 | Petrov-Vodkin 377/149/~230 | Karazin 206/0/~200 | Ciurlionis 208/1/~200 | Savrasov 278/72/~200 | Malevich 452/252/~200 | Vereshchagin 605/397/~200 | Kramskoi 273/98/~170 | Filonov 180/23/~150 | Aivazovsky 707/573/~130. Others small. Icons pool ~260 (Rublev, Stroganov, Palekh). Pirosmani 418 files, held 0 (name mismatch likely, in Caucasus batch). Burliuk (David, d.1967) is OUT.

## Talents to consider (from knowledge, unverified): Csontvary, Munkacsy, Rippl-Ronai (Hungary); Grigorescu, Luchian (Romania); Bukovac (Croatia); Mednyanszky (Slovakia); Tom Thomson, Emily Carr, Krieghoff (Canada); Torres Garcia, Pedro Lira (Chile/Uruguay); Osman Hamdi Bey (Turkey); Gyzis, Theophilos (Greece); Murashko, Trush (Ukraine).

## Indigenous and African (direct Commons files)
Ledger art 487; hide painting 52; Codex Mendoza 223, Zouche-Nuttall 366, Selden 191, Florentine 163, Borgia 105, Laud 56, Dresden 79, Madrid 53, Fejervary-Mayer 40, Boturini 38, Lienzo de Tlaxcala 63; Cuzco School 70; Maori portraits 54 (Lindauer d.1926: tikanga sensitivity); Ethiopian Orthodox icons 71, manuscripts 110, Garima Gospels 7 (sacred); Coptic icons 48; Timbuktu manuscripts 58. Tiny on Commons: Pueblo (Tonita Pena 8 ok), Navajo sandpainting 20 (ceremonial: skip/label).
Met open search (public domain + images): Plains Indian 210, Pueblo 293, Navajo 47, Tlingit 54, Cuzco 52, Ethiopian 80, Maori 35 (upper bounds, all object types). Cleveland CC0: Plains Indian 16, Navajo 26, Pueblo 33. AIC API returned 403; Smithsonian/NMAI/Brooklyn/Walters API not tested.
Sensitivity: label or skip ceremonial material; no living or post-1955 artists; keep devotional context for icons.

## Cave and rock art (Commons categories, depth-1 files)
Altamira 153, Lascaux 165 (Lascaux 2/4 are replicas), Chauvet 19, Cueva de las Manos 274, El Castillo 75, Bhimbetka 300 (+492 rock shelters), Tassili n'Ajjer 321, Leang-Leang (Sulawesi) 97, Ubirr 61 + Burrungkuy 42 + Anbangbang 20 (Aboriginal-owned: sensitivity), Drakensberg 27, Tsodilo 34, Coa 94, Siega Verde 23, Cosquer 23, Niaux 37. Licences mostly CC BY-SA (carry attribution) plus CC0/PD. Not classified: wall photos vs replicas/landscapes. Colors approximate (artificial light, rock).

## Met API note: the old /v1/search endpoint returns 410 since 2026-10-01; /v1.1/search works; /v1/objects/<id> still works (tools/met_asia_extra.py uses objects only).
