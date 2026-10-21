# Russian expansion, 2026-10-21 (staging only)

Method: painters = Wikidata occupation painter with citizenship Russia / Russian Empire / USSR / RSFSR (9,980); 835 of them have at least one Wikidata painting with an image (11,295 works).
"Russian" for staging = birthplace country Russia (the backfill labelling rule) or no birth country on record. Russian Empire painters born in Ukraine, Belarus, Lithuania, Poland, Finland, Estonia, Georgia and so on are NOT staged here (listed at the end).
Held = rows in data/corpus (114,544 rows at origin/main 3f5fde859) credited to the painter (matched via the backfill Wikidata Q). WD = Wikidata paintings (P170 + P18). Cat = files directly in Commons "Category:Paintings by <name>" / files directly in the painter main category (subcategories not counted, so these are floors).

## Gap table (Russia-born painters, ranked by max(WD, Cat) minus held; first pass, before dedupe)

| # | Painter | Q | Years | Held | WD | Cat paintings | Cat main | Gap |
|---|---|---|---|---|---|---|---|---|
| 1 | Vasily Surikov | Q110228 | 1848-1916 | 8 | 20 | 213+7 sub | 61+9 sub | 205 |
| 2 | Konstantin Gorbatov | Q943854 | 1876-1945 | 0 | 1 | 178+5 sub | 6+1 sub | 178 |
| 3 | Grigory Gagarin | Q887801 | 1810-1893 | 1 | 2 | 0+0 sub | 166+7 sub | 165 |
| 4 | Pavel Svinyin | Q3210067 | 1788-1839 | 0 | 23 | 0+0 sub | 150+2 sub | 150 |
| 5 | Nikolai Sverchkov | Q952189 | 1817-1898 | 3 | 11 | 148+4 sub | 6+1 sub | 145 |
| 6 | Alexey Akindinov | Q4059557 | 1977- | 0 | 5 | 113+0 sub | 3+1 sub | 113 |
| 7 | Arkady Rylov | Q3623704 | 1870-1939 | 1 | 5 | 97+1 sub | 6+2 sub | 96 |
| 8 | Illarion Mikhailovich Pryanishnikov | Q1350315 | 1840-1894 | 0 | 2 | 0+0 sub | 90+0 sub | 90 |
| 9 | Ivan Kulikov | Q4246205 | 1875-1941 | 0 | 3 | 0+0 sub | 87+3 sub | 87 |
| 10 | Nikolay Nikanorovich Dubovskoy | Q1349819 | 1859-1918 | 3 | 24 | 0+0 sub | 85+4 sub | 82 |
| 11 | Aleksey Kivshenko | Q2834352 | 1851-1895 | 1 | 1 | 0+1 sub | 75+1 sub | 74 |
| 12 | Nikolay Argunov | Q16272543 | 1771-1831 | 6 | 14 | 0+0 sub | 79+0 sub | 73 |
| 13 | Alexander Varnek | Q4103951 | 1782-1843 | 6 | 9 | 0+0 sub | 76+1 sub | 70 |
| 14 | Constantin Westchiloff | Q4110314 | 1878-1945 | 0 | 4 | 0+0 sub | 67+0 sub | 67 |
| 15 | Viktor Hartmann | Q924605 | 1834-1873 | 0 | 0 | 0+0 sub | 61+1 sub | 61 |
| 16 | Leonid Solomatkin | Q4428224 | 1837-1883 | 2 | 4 | 57+3 sub | 0+1 sub | 55 |
| 17 | Nikolai Dmitriev-Orenburgsky | Q2030263 | 1837-1898 | 1 | 20 | 0+0 sub | 55+0 sub | 54 |
| 18 | Fedor Petrovich Chumakov | Q4518000 | 1823-1911 | 0 | 4 | 0+0 sub | 54+0 sub | 54 |
| 19 | Jalmari Ruokokoski | Q6083861 | 1886-1936 | 0 | 21 | 0+0 sub | 53+1 sub | 53 |
| 20 | Carl Ludwig Johann Christineck | Q4501477 | 1732-1792 | 6 | 20 | 0+0 sub | 59+0 sub | 53 |
| 21 | Mitrofan Grekov | Q1313237 | 1882-1934 | 2 | 3 | 0+0 sub | 55+2 sub | 53 |
| 22 | Martiros Saryan | Q718409 | 1880-1972 | 0 | 47 | 10+3 sub | 51+7 sub | 51 |
| 23 | Konstantin Yuon | Q1343751 | 1875-1958 | 0 | 4 | 50+3 sub | 5+1 sub | 50 |
| 24 | Konstantin Trutovsky | Q4464564 | 1826-1893 | 1 | 3 | 8+1 sub | 46+3 sub | 45 |
| 25 | Ilya Glazunov | Q1396524 | 1930-2017 | 0 | 1 | 0+0 sub | 44+3 sub | 44 |
| 26 | Elizaveta Kruglikova | Q4241935 | 1865-1941 | 0 | 1 | 0+0 sub | 43+2 sub | 43 |
| 27 | Kirill Gorbunov | Q4143705 | 1822-1893 | 2 | 8 | 0+0 sub | 43+0 sub | 41 |
| 28 | Rafail Levitsky | Q2215640 | 1844-http | 0 | 2 | 0+0 sub | 41+0 sub | 41 |
| 29 | Eugene Lanceray | Q1520898 | 1875-1946 | 1 | 1 | 42+1 sub | 27+3 sub | 41 |
| 30 | Alexey Vassilievich Tyranov | Q627347 | 1808-1859 | 5 | 16 | 0+0 sub | 45+0 sub | 40 |
| 31 | Pavel Filonov | Q466187 | 1883-1941 | 2 | 17 | 39+21 sub | 7+4 sub | 37 |
| 32 | Pehr Adolf Kruskopf | Q5924798 | 1805-1852 | 0 | 3 | 0+0 sub | 36+0 sub | 36 |
| 33 | Simon Kozhin | Q1738984 | 1979- | 0 | 22 | 0+0 sub | 35+0 sub | 35 |
| 34 | Lukian Popov | Q4372528 | 1873-1914 | 0 | 5 | 0+0 sub | 35+0 sub | 35 |
| 35 | Dmitri Zhilinsky | Q1972155 | 1927-2015 | 0 | 2 | 0+0 sub | 35+0 sub | 35 |
| 36 | Wilhelm von Kügelgen | Q288186 | 1802-1867 | 0 | 4 | 0+0 sub | 34+1 sub | 34 |
| 37 | Albert Nikolayevitch Benois | Q946949 | 1852-1936 | 0 | 4 | 0+0 sub | 33+5 sub | 33 |
| 38 | Alexander Fedorovich Pershakov | Q33132621 | 1843-1905 | 4 | 4 | 0+0 sub | 36+0 sub | 32 |
| 39 | Carl Christian Philipp Reichel | Q1037303 | 1788-1857 | 1 | 3 | 0+0 sub | 33+2 sub | 32 |
| 40 | Grigory Gurkin | Q4152414 | 1870-1937 | 0 | 1 | 0+0 sub | 32+0 sub | 32 |
| 41 | Vassily Maximov | Q1350341 | 1844-1911 | 4 | 6 | 35+2 sub | 5+2 sub | 31 |
| 42 | Vladimir Tatlin | Q310320 | 1885-1953 | 5 | 7 | 35+0 sub | 17+10 sub | 30 |
| 43 | Yelena Polenova | Q462815 | 1850-1898 | 0 | 0 | 0+0 sub | 30+1 sub | 30 |
| 44 | Alfred Hirv | Q4722861 | 1880-1918 | 0 | 22 | 0+0 sub | 29+0 sub | 29 |
| 45 | Maxim Vorobiev | Q443001 | 1787-1855 | 2 | 5 | 0+0 sub | 31+1 sub | 29 |
| 46 | Lev Lagorio | Q1400810 | 1826-1905 | 0 | 5 | 29+2 sub | 9+3 sub | 29 |
| 47 | Vasily Sternberg | Q4526852 | 1818-1845 | 1 | 3 | 0+0 sub | 30+0 sub | 29 |
| 48 | Sergey Malyutin | Q3742270 | 1859-1937 | 2 | 6 | 0+0 sub | 30+6 sub | 28 |
| 49 | Andrei Mironov | Q20753169 | 1975- | 0 | 27 | 24+2 sub | 1+2 sub | 27 |
| 50 | Pyotr Basin | Q4078998 | 1793-1877 | 4 | 7 | 0+0 sub | 31+5 sub | 27 |
| 51 | Otto Friedrich Theodor von Möller | Q4300491 | 1812-1874 | 2 | 3 | 0+0 sub | 29+1 sub | 27 |
| 52 | Yakov Kapkov | Q4213040 | 1816-1854 | 2 | 4 | 0+0 sub | 28+0 sub | 26 |
| 53 | Mikhail Scotti | Q1661107 | 1814-1861 | 1 | 3 | 0+0 sub | 27+0 sub | 26 |
| 54 | Vladimir Makovsky | Q740592 | 1846-1920 | 7 | 28 | 32+6 sub | 18+3 sub | 25 |
| 55 | Alexandre Jacovleff | Q593879 | 1887-1938 | 2 | 9 | 0+0 sub | 27+8 sub | 25 |
| 56 | Sergei Gribkov | Q4148890 | 1822-1893 | 0 | 6 | 0+0 sub | 25+0 sub | 25 |
| 57 | Alexey Leonov | Q154269 | 1934-2019 | 0 | 0 | 0+0 sub | 25+6 sub | 25 |
| 58 | Israel Tsvaygenbaum | Q211437 | 1961- | 0 | 6 | 0+0 sub | 24+0 sub | 24 |
| 59 | Grigory Chernetsov | Q4513429 | 1802-1865 | 1 | 3 | 0+0 sub | 25+2 sub | 24 |
| 60 | François Nicholas Riss | Q452457 | 1804-1868 | 1 | 4 | 0+0 sub | 24+0 sub | 23 |
| 61 | Alexander Alexeyevich Borisov | Q762344 | 1866-1934 | 1 | 4 | 0+0 sub | 24+0 sub | 23 |
| 62 | Alexandre Roubtzoff | Q2577968 | 1884-1949 | 0 | 3 | 23+1 sub | 3+4 sub | 23 |
| 63 | Vladimir Osipovich Sherwood | Q4523044 | 1832-1897 | 0 | 6 | 0+0 sub | 22+6 sub | 22 |
| 64 | Vasily Vereshchagin | Q4107761 | 1835-1909 | 0 | 5 | 22+8 sub | 3+2 sub | 22 |
| 65 | Aleksey Yegorov | Q4173709 | 1776-1851 | 3 | 5 | 0+0 sub | 25+0 sub | 22 |
| 66 | Pyotr Gruzinsky | Q2387613 | 1837-1892 | 0 | 3 | 0+0 sub | 22+1 sub | 22 |
| 67 | Geliy Korzhev | Q4232997 | 1925-2012 | 0 | 1 | 0+0 sub | 22+0 sub | 22 |
| 68 | Alexander Rodchenko | Q312631 | 1891-1956 | 0 | 0 | 3+0 sub | 22+4 sub | 22 |
| 69 | Fyodor Bronnikov | Q4097027 | 1827-1902 | 2 | 23 | 16+4 sub | 3+1 sub | 21 |
| 70 | Yekaterina Zarudnaya-Cavos | Q18019632 | 1862-1917 | 2 | 5 | 0+0 sub | 23+0 sub | 21 |
| 71 | Ludwig Bohnstedt | Q70337 | 1822-1885 | 0 | 0 | 0+0 sub | 21+17 sub | 21 |
| 72 | Elena Guro | Q442658 | 1877-1913 | 0 | 0 | 0+0 sub | 21+1 sub | 21 |
| 73 | Anna Ostroumova-Lebedeva | Q562945 | 1871-1955 | 0 | 0 | 0+0 sub | 21+3 sub | 21 |
| 74 | Ivan Makarov | Q4275370 | 1822-1897 | 7 | 27 | 5+2 sub | 2+2 sub | 20 |
| 75 | Maria Feodorova | Q4494045 | 1859-1934 | 0 | 6 | 20+0 sub | 0+1 sub | 20 |
| 76 | Vasili Bazhenov | Q51129 | 1737-1799 | 0 | 0 | 0+0 sub | 20+6 sub | 20 |
| 77 | Lydia Lopokova | Q271920 | 1892-1981 | 0 | 0 | 0+0 sub | 20+0 sub | 20 |
| 78 | Nicolas de Staël | Q470551 | 1914-1955 | 0 | 0 | 1+1 sub | 20+3 sub | 20 |
| 79 | Mstislav Dobuzhinsky | Q972018 | 1875-1957 | 0 | 0 | 0+0 sub | 20+3 sub | 20 |
| 80 | Konstantin Korovin | Q437792 | 1861-1939 | 13 | 27 | 32+4 sub | 17+8 sub | 19 |

Total first-pass gap across 404 Russia-born painters with a positive gap: 5470 (upper bound; includes duplicates and non-paintings).

## Big collections on Commons (category sizes, files + subcategories)

| Category | Files | Subcats |
|---|---|---|
| Paintings in the Tretyakov Gallery | 369 | 8 (century and genre splits, plus per-artist categories) |
| Paintings in the Tretyakov Gallery by artist | 19 | 44 |
| Paintings in the Pushkin Museum | 55 | 7 |
| Paintings in the Pushkin Museum by artist | 0 | 83 |
| Paintings in the Russian Museum | 5 | 7 |
| Paintings in the Russian Museum by artist | 0 | 5 |
| Paintings in the Hermitage Museum / Peterhof / State Museum Reserve Peterhof | category name does not exist; found via search, see below | |

## Russian Empire / Soviet painters born outside Russia (not staged; labelled Ukraine, Belarus, etc. by the backfill)

- Юзеф Хелмоньский (Q983949, Poland): held 0, WD 337, Cat 0/9, gap 337
- Michał Stachowicz (Q4441365, Poland): held 0, WD 23, Cat 58/171, gap 171
- Franciszek Kostrzewski (Q3595563, Poland): held 0, WD 17, Cat 26/162, gap 162
- Zurab Tsereteli (Q1358703, Georgia): held 0, WD 0, Cat 0/134, gap 134
- Julius Sergius von Klever (Q89421, Estonia): held 40, WD 40, Cat 0/144, gap 104
- Stanisław Bohusz-Siestrzeńcewicz (Q1753301, Lithuania): held 0, WD 7, Cat 0/90, gap 90
- Heinrich Vogeler (Q213734, Germany): held 0, WD 20, Cat 86/23, gap 86
- Zygmunt Vogel (Q245396, Belarus): held 0, WD 5, Cat 0/84, gap 84
- Eduard von Gebhardt (Q322440, Estonia): held 0, WD 26, Cat 0/79, gap 79
- Franz Roubaud (Q662242, Ukraine): held 0, WD 10, Cat 0/77, gap 77
- Sergey Zaryanko (Q1985660, Belarus): held 6, WD 10, Cat 0/83, gap 77
- Wilhelm Ostwald (Q12658, Latvia): held 0, WD 0, Cat 0/76, gap 76
- Wincenty Sleńdziński (Q15966593, Lithuania): held 0, WD 3, Cat 0/72, gap 72
- Maximilian Voloshin (Q358885, Ukraine): held 0, WD 0, Cat 0/64, gap 64
- Gregor von Bochmann (Q884043, Estonia): held 0, WD 13, Cat 0/61, gap 61
- Bahruz Kangarli (Q4219337, Azerbaijan): held 0, WD 7, Cat 61/12, gap 61
- Lilly Walther (Q31275332, Estonia): held 0, WD 18, Cat 59/11, gap 59
- Feliks Sypniewski (Q5441836, Poland): held 0, WD 5, Cat 0/59, gap 59
- Альфред Исидор Ромер (Q1255520, Lithuania): held 0, WD 3, Cat 0/59, gap 59
- August Matthias Hagen (Q762976, Latvia): held 2, WD 20, Cat 0/59, gap 57
- Emma Andiyevska (Q291500, Ukraine): held 0, WD 0, Cat 0/56, gap 56
- Tiit Pääsuke (Q7801796, Estonia): held 0, WD 15, Cat 54/2, gap 54
- Boris Schatz (Q893776, Lithuania): held 0, WD 0, Cat 2/53, gap 53
- Witold Wojtkiewicz (Q2093769, Poland): held 0, WD 25, Cat 0/52, gap 52
- Aleksander Lesser (Q3270591, Poland): held 0, WD 21, Cat 0/52, gap 52
