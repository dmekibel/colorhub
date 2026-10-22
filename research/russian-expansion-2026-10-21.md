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

## Staged result

**4789 new paintings staged** in 229 files under data/corpus-staging/ (309 painters). Not read by the app. 0 of them share an id or a Commons file with data/corpus; 0 duplicate ids inside staging.
Row shape = the existing zz-commons rows (id commons-Q.../commons-F..., src, t, a, y, co null, mv null, img = Special:FilePath?width=400, p = 6 palette entries, L, C, url) plus one extra key `orig` (the original upload.wikimedia.org file URL, no query string).
Palettes are measured with the repo's current tools/corpus.py palette_of on a 200 px copy of the 400 px thumbnail; the real vivid-v2 re-measure still happens in gallery.py when the rows move into data/corpus.
`a` uses the name the corpus already holds for that painter (matched through the backfill Wikidata Q), so rows join the existing painter page; unmatched painters carry their Wikidata English label.

### By painter (top 80 by staged rows)

| Painter | Staged | Held before |
|---|---|---|
| Konstantin Gorbatov | 248 | 0 |
| Vasily Surikov | 225 | 8 |
| Vladimir Makovsky | 195 | 6 |
| Kuzma Petrov-Vodkin | 183 | 2 |
| Ilya Mashkov | 170 | 1 |
| Alexei Savrasov | 163 | 6 |
| Andrei Mironov | 140 | 0 |
| Konstantin Korovin | 133 | 13 |
| Nikolai Sverchkov | 131 | 3 |
| Alexey Akindinov | 106 | 0 |
| Karl Bryullov | 96 | 65 |
| Alexei Harlamov | 95 | 0 |
| Ivan Makarov | 82 | 7 |
| Arkady Rylov | 77 | 1 |
| Aristarkh Lentulov | 76 | 4 |
| Fyodor Alekseyev | 73 | 2 |
| Nikolay Nikanorovich Dubovskoy | 72 | 3 |
| Fyodor Bronnikov | 68 | 2 |
| Leonid Solomatkin | 62 | 2 |
| Abram Arkhipov | 61 | 1 |
| Ivan Kulikov | 58 | 0 |
| Constantin Westchiloff | 56 | 0 |
| Vasily Perov | 55 | 17 |
| Fyodor Vasilyev | 54 | 124 |
| Konstantin Yuon | 49 | 0 |
| Filipp Malyavin | 45 | 2 |
| Alexander Varnek | 42 | 6 |
| Lev Lagorio | 40 | 0 |
| Natalia Goncharova | 35 | 0 |
| Vassily Maximov | 35 | 4 |
| Jalmari Ruokokoski | 33 | 0 |
| Simon Kozhin | 31 | 0 |
| Carl Ludwig Johann Christineck | 30 | 6 |
| Orest Kiprensky | 30 | 8 |
| Robert Falk | 30 | 0 |
| Nikolai Dmitriev-Orenburgsky | 28 | 1 |
| Sergey Malyutin | 28 | 2 |
| Vasily Vereshchagin | 28 | 382 |
| Aleksey Kivshenko | 27 | 1 |
| Alexander Fedorovich Pershakov | 26 | 4 |
| Alexey Vassilievich Tyranov | 26 | 5 |
| Ilya Repin | 26 | 264 |
| Isaac Levitan | 26 | 256 |
| Nikolay Argunov | 26 | 6 |
| Pavel Filonov | 26 | 2 |
| Arkhip Kuindzhi | 25 | 303 |
| Mikhail Matyushin | 25 | 1 |
| Grigory Gurkin | 24 | 0 |
| Vladimir Tatlin | 24 | 5 |
| Stepan Shchukin | 23 | 1 |
| Aleksey Antropov | 22 | 11 |
| Nikolay Koshelev | 22 | 1 |
| Alfred Hirv | 21 | 0 |
| Grigory Soroka | 21 | 3 |
| Ivan Argunov | 21 | 5 |
| Konstantin Savitsky | 21 | 2 |
| Alexandre Jacovleff | 20 | 2 |
| Andrey Shishkin | 20 | 0 |
| Eugene Lanceray | 20 | 1 |
| Maria Feodorova | 20 | 0 |
| El Lissitzky | 19 | 1 |
| Grigory Gagarin | 19 | 1 |
| Yefim Volkov | 19 | 1 |
| Mikhail Vrubel | 18 | 24 |
| Nadezhda Udaltsova | 18 | 0 |
| Carl Christian Philipp Reichel | 17 | 1 |
| Martiros Saryan | 17 | 0 |
| Mikhail Larionov | 17 | 0 |
| Vasily Andreevich Tropinin | 17 | 32 |
| Lukian Popov | 16 | 0 |
| Nikolai Ge | 16 | 10 |
| Bogdan Willewalde | 15 | 2 |
| Grigory Chernetsov | 15 | 1 |
| Illarion Mikhailovich Pryanishnikov | 15 | 0 |
| Konstantin Trutovsky | 15 | 1 |
| Albert Nikolayevitch Benois | 14 | 0 |
| Dmitri Zhilinsky | 14 | 0 |
| Vladimir Osipovich Sherwood | 14 | 0 |
| Yelena Polenova | 14 | 0 |
| Alexandre Roubtzoff | 13 | 0 |
| ... 229 more painters | 792 | |

### Collections pass (Wikidata paintings P195 in a Russian museum, creator a Russian-citizen painter)

Source query: items with collection located in Russia + P18 + P170 whose creator has Russian / Russian Empire / USSR citizenship. Most of the 3,576 items were already in the corpus (about 2,500 same id), so few are new. "russia" = creator born in Russia or no birth record; "empire" = creator born in Ukraine, Belarus, Lithuania or Armenia (Repin, Levitan and the like: they stay credited to their own country by the backfill rule, listed here so you can decide).

| Pass | Collection | Staged | File |
|---|---|---|---|
| russia | tretyakov | 3 | data/corpus-staging/zz-commons-rucolltretyakov-1.json |
| russia | russianmuseum | 33 | data/corpus-staging/zz-commons-rucollrussianmuseum-1.json |
| russia | yekaterinburg | 18 | data/corpus-staging/zz-commons-rucollyekaterinburg-1.json |
| russia | regional | 94 | data/corpus-staging/zz-commons-rucollregional-1.json |
| russia | hermitage | 8 | data/corpus-staging/zz-commons-rucollhermitage-1.json |
| russia | pushkin | 1 | data/corpus-staging/zz-commons-rucollpushkin-1.json |
| empire | russianmuseum | 25 | data/corpus-staging/zz-commons-rucollrussianmuseumempire-1.json |
| empire | yekaterinburg | 4 | data/corpus-staging/zz-commons-rucollyekaterinburgempire-1.json |
| empire | regional | 39 | data/corpus-staging/zz-commons-rucollregionalempire-1.json |
| empire | tretyakov | 5 | data/corpus-staging/zz-commons-rucolltretyakovempire-1.json |
| empire | radishchev | 1 | data/corpus-staging/zz-commons-rucollradishchevempire-1.json |

Per-museum Commons categories "Paintings by <X> in the Tretyakov Gallery / Russian Museum / Pushkin Museum" (226 categories, 207 resolved to a painter) were walked as extra roots for those painters; their new rows sit in the painter files (suffix -2, -3, ...).
Not reachable as a collection: Commons has no "Paintings in the Hermitage Museum" / "Peterhof" category trees by artist for Russian painters (the names asked for do not exist; Hermitage Russian paintings come only through Wikidata, 8 new rows), and the Tretyakov / Russian Museum open data is not on Commons in bulk, which is why the new count stays small: the earlier Russian batch (78 painters) already holds most of what Commons has.

### Dropped (approximate counts; a file can hit one rule only, first rule wins)

| Reason | Count |
|---|---|
| file: drawing/print/photo/detail/copy by name or category | 1894 |
| too small (under 300 px or 0.25 MP) | 1144 |
| wd: not a painting class | 392 |
| clean: photo of a hall/exhibition/frame, not a painting | 242 |
| clean: cross-file duplicate (same id or same Commons file) | 207 |
| coll: wd: not a painting class | 178 |
| B: near-greyscale image (black-and-white photo of a picture) | 173 |
| wd: title/file says drawing/print/detail/copy | 169 |
| near-duplicate file of the same work (same title and year) | 158 |
| B: same picture by image hash (existing or new) | 133 |
| coll: too small (under 300 px or 0.25 MP) | 120 |
| icon (listed separately) | 81 |
| coll: wd: title/file says drawing/print/detail/copy | 35 |
| file: also in another painter's category (doubtful) | 24 |
| file: not raster | 16 |
| coll: twin of an existing row (artist + title + year) | 11 |
| wd: not a raster image | 10 |
| clean: title says sketch/preparatory/print (second pass) | 4 |
| coll: wd: not a raster image | 3 |
| coll: icon (listed separately) | 3 |
| B: image fetch failed | 1 |
| already in data/corpus (same id / same Commons file) | 9941 |
| twin of an existing row (artist + title + year +-2) | 99 |

### Orthodox icons (kept OUT of staging; 61 found, first 60 listed: painter / id / title / file)

- Alexey Akindinov / F135552471 / Alexey Akindinov. Icon — Jesus Christ — the Savior of the World. 2018- / Alexey Akindinov. Icon — Jesus Christ — the Savior of the Wo
- Alexey Akindinov / F135552264 / Alexey Akindinov. Icon — Saints Peter and Fevronia of Murom. 2018-2019 / Alexey Akindinov. Icon — Saints Peter and Fevronia of Murom.
- Alexey Akindinov / F135551785 / Alexey Akindinov. Icon — St. Vasily I Bishop of Ryazan and Murom. 2018 / Alexey Akindinov. Icon — St. Vasily I Bishop of Ryazan and M
- Alexey Akindinov / F134258476 / Alexey Akindinov. Veil of the Most Holy Theotokos. 2015 / Alexey Akindinov. Veil of the Most Holy Theotokos. 2015.jpg
- Illarion Mikhailovich Pryanishnikov / F157629 / Easter Processionlabel QS:Len,"Easter Procession"label QS:Lde,"Oster-P / Illarion Michajlowitsch Prjanischnikow 001.jpg
- Ivan Kulikov / F16716635 / Russian:  «Старинный обряд благословения невесты в городе Муроме.»Anci / Ivan Kulikov Ancient rite of blessing the bride in Murom 190
- Aleksey Kivshenko / F66985838 / Russia 3573 - BIG Decision (4166103552) / Russia 3573 - BIG Decision (4166103552).jpg
- Konstantin Trutovsky / F80423466 / Разлучница / Разлучница.jpg
- Konstantin Trutovsky / F56420963 / Живописное обозрение 1891, № 01-26 (6 янв. - 30 июня); № 27-52 (7 июля / Живописное обозрение 1891, № 01-26 (6 янв. - 30 июня); № 27-
- Pavel Filonov / F218929 / Countenances (Faces on an Icon) / Pavel Filonov Faces.jpg
- Vassily Maximov / F155066 / Russian:  «Больной муж»Sick Husbandtitle QS:P1476,ru:"Больной муж"labe / Wassilij Maximowitsch Maximow 002.jpg
- Vassily Maximov / F36549071 / Максимов В.М. Красный угол в избе. 1869 / Максимов В.М. Красный угол в избе. 1869.jpg
- Vassily Maximov / F22781582 / Максимов Красный-угол-в-избе 1869 / Максимов Красный-угол-в-избе 1869.jpg
- Andrei Mironov / F113787985 / Russian:  «Портрет игумена Никона (Воробьёва)»Portrait of Abbot Nikon  / Nikon (Vorobyov). A. Mironov.jpg
- Andrei Mironov / F33960434 / Saint Panteleimon. A.N. Mironov / Saint Panteleimon. A.N. Mironov.jpg
- Andrei Mironov / F33960629 / The face of Christ not made by hand. Artist A.N. Mironov / The face of Christ not made by hand. Artist A.N. Mironov.jpg
- Vladimir Makovsky / F156011881 / Vladimir Makovsky — Icon of Christ Pantacrator (1894) / Vladimir Makovsky — Icon of Christ Pantacrator (1894).jpg
- Vladimir Makovsky / F156011882 / Vladimir Makovsky — Icon of Jesus Christ (1894) / Vladimir Makovsky — Icon of Jesus Christ (1894).jpg
- Vladimir Makovsky / F156011888 / Vladimir Makovsky — The Iconographer (1891) / Vladimir Makovsky — The Iconographer (1891).jpg
- Vladimir Makovsky / F56381340 / Живописное обозрение 1890, № 01-26 (1 янв. - 24 июня); № 27-52 (1 июля / Живописное обозрение 1890, № 01-26 (1 янв. - 24 июня); № 27-
- Vasily Vereshchagin / F65922292 / Икона Николы с верховьев реки Пинеги / Икона Николы с верховьев реки Пинеги (Верещагин).jpg
- Vasily Vereshchagin / F3125490 / Icon of St Nicholas from the Upper Reaches of the River Pinegalabel QS / Икона Николы с верховья реки Пинеги.jpg
- Vasily Vereshchagin / F69579438 / Иконостас деревянной церкви Иоанна Богослова на Ишне, близ Ростова Яро / Иконостас деревянной церкви Иоанна Богослова на Ишне.jpg
- Vasily Vereshchagin / F69643055 / Иконостас церкви в селе Белая Слуда Вологодской губернии / Иконостас церкви в селе Белая Слуда Вологодской губернии.jpg
- Konstantin Korovin / F114231125 / Exposition La collection Morozov - icônes de l’art moderne - Fondation / Exposition La collection Morozov - icônes de l’art moderne -
- Konstantin Korovin / F114231126 / Exposition La collection Morozov - icônes de l’art moderne - Fondation / Exposition La collection Morozov - icônes de l’art moderne -
- Konstantin Korovin / F114181509 / Portrait of Ivan Abramovich Morozov. Konstantin Korovin. 1903 / Portrait of Ivan Abramovich Morozov. Konstantin Korovin. 190
- Konstantin Korovin / F114230851 / "Portrait de F.I. Chaliapine" de K. Korovine (Fondation Vuitton, Paris / "Portrait de F.I. Chaliapine" de K. Korovine (Fondation Vuit
- Konstantin Korovin / F114231067 / Exposition La collection Morozov - icônes de l’art moderne - Fondation / Exposition La collection Morozov - icônes de l’art moderne -
- Konstantin Korovin / F114181535 / Portrait de l'artiste Konstantine Korovine. Valentin Serov. 1891 / Portrait de l'artiste Konstantine Korovine. Valentin Serov. 
- collections / Q61754887 / Welcomming the Icon / Савицкий К. А. (1878) Встреча иконы.jpg
- Alexei Savrasov / F69967066 / У иконы. Богомольцы / Savrasov icon pilgrims.jpg
- Kuzma Petrov-Vodkin / F10596995 / Vasya / Kuzma Petrov-Vodkin (Russian 1878-1939), 'Vasya', Christie's
- Kuzma Petrov-Vodkin / F143974168 / Троица. Эскиз витража для Троицкого собора в Сумах / Троица. Эскиз витража для Троицкого собора в Сумах.jpg
- Kuzma Petrov-Vodkin / F16779431 / Здание с иконой богоматери, Александровский парк / Здание с иконой богоматери, Александровский парк.jpg
- Kuzma Petrov-Vodkin / F16776531 / Майоликовая икона Богоматери, Александровский парк, 5 / Майоликовая икона Богоматери, Александровский парк, 5.jpg
- Nikolay Koshelev / F114645840 / Василий Юрьевич Квашня во время охоты в лесу находит на большой сосне  / Василий Юрьевич Квашня во время охоты в лесу находит на боль
- Natalia Goncharova / F8894853 / WLA lacma Archangel Michael / WLA lacma Archangel Michael.jpg
- Pyotr Shamshin / F11739162 / ProcleConstantinoble / ProcleConstantinoble.jpg
- Pavel Korin / F25719702 / Нестеров М.В. портрет П. Коріна 1925 / Нестеров М.В. портрет П. Коріна 1925.jpg
- Mikhail Nesterov / F90472399 / Портрет художника Павла Коріна (Михайло Нестеров, 1925) / Портрет художника Павла Коріна (Михайло Нестеров, 1925).jpg
- Evgraf Semenovich Sorokin / F12038838 / Razval (Evgraf Sorokin) / Razval (Evgraf Sorokin).jpg
- Ilya Mashkov / F114181681 / Autoportrait. Ilia Machkov. 1911 / Autoportrait. Ilia Machkov. 1911.jpg
- Ilya Mashkov / F114231132 / Exposition La collection Morozov - icônes de l’art moderne - Fondation / Exposition La collection Morozov - icônes de l’art moderne -
- Ilya Mashkov / F114181689 / Nature morte. Plateau de fruits. Ilia Machkov. 1910 / Nature morte. Plateau de fruits. Ilia Machkov. 1910.jpg
- Vladimir Borovikovsky / F15876621 / The Archangel Gabriel (From The Annunciation)label QS:Lru,"Архангел Га / Archangel Gabriel from the Annunciation.jpg
- Vladimir Borovikovsky / F15876575 / The Virgin Mary (From The Annunciation)label QS:Lru,"Дева Мария (из "Б / GRM Inv. J-3177.jpg
- Vladimir Borovikovsky / F15876720 / St Mark the Evangelistlabel QS:Lru,"Евангелист Марк"label QS:Len,"St M / GRM Inv. J-3179.jpg
- Vladimir Borovikovsky / F15876952 / St Matthew the Evangelistlabel QS:Lru,"Евангелист Матфей"label QS:Len, / GRM Inv. J-3181.jpg
- Vladimir Borovikovsky / F15876999 / St John the Evangelistlabel QS:Lru,"Евангелист Иоанн"label QS:Len,"St  / GRM Inv. J-3182.jpg
- Vladimir Borovikovsky / F15881590 / GRM Inv. JB-407 / GRM Inv. JB-407.jpg
- Vladimir Borovikovsky / F76338441 / King Davidlabel QS:Lru,"Царь Давид"label QS:Len,"King David" / King David by Borovikovsky.jpg
- Vladimir Borovikovsky / F15877067 / St. Catherinelabel QS:Lru,"Святая Екатерина"label QS:Len,"St. Catherin / S.Catherine by Borovikovskiy (Russian museum).jpg
- Vladimir Borovikovsky / F15876803 / St Luke the Evangelistlabel QS:Lru,"Евангелист Лука"label QS:Len,"St L / St Luke the Evangelist.jpg
- Mikhail Nesterov / F50465933 / Saint Olga by Nesterov (1927, GTG) / Saint Olga by Nesterov (1927, GTG).jpg
- Ilya Repin / Q20800356 / Young Boy Carrying an Icon, sketch / Ilja Jefimovitš Repin - Young Boy Carrying an Icon, sketch -
- Valentin Serov / F114181634 / Sirène. Valentin Serov. 1896 / Sirène. Valentin Serov. 1896.jpg
- collections / Q47509308 / Icon of St Nicholas from the Upper Reaches of the River Pinega / Икона Николы с верховьев реки Пинеги (Верещагин).jpg
- Mikhail Vrubel / Q4089584 / The Mother of God with the child (Vrubel) / Mikhail-Vrubel-Icon.png
- Andrei Petrovich Ryabushkin / F4471028 / У чудотворной иконы / У чудотворной иконы.jpg

### Doubtful attributions (dropped, not staged; 17 listed up to 30 per painter): file is also in another painter's "Paintings by ..." category

- Vladimir Makovsky: Живописное обозрение 1890, № 01-26 (1 янв. - 24 июня); № 27-52 (1 июля (also in Paintings by Vasily Surikov)
- Pavel Svinyin: Tableau of Indian Faces MET DP276571.jpg (also in Paintings by John Lewis Krimmel)
- Illarion Mikhailovich Pryanishnikov: Memorial Service for Illarion Mikhaylovich Pryanishnikov (1900).jpg (also in Paintings by Aleksey Korin)
- Illarion Mikhailovich Pryanishnikov: Perov-Pryanishnikov.jpg (also in Paintings by Vasilij Perov)
- Eugene Lanceray: Ivan Bilibin by B.Kustodiev (1914).jpg (also in Paintings by Boris Kustodiev)
- Vassily Maximov: Живописное обозрение 1890, № 01-26 (1 янв. - 24 июня); № 27-52 (1 июля (also in Paintings by Carl Theodor von Piloty)
- Lev Lagorio: Appolinary Goravsky. Portrait of Lev Lagorio.jpg (also in Paintings by Apollinary Goravsky)
- Vladimir Makovsky: Ilya Repin, Vasily Polenov, Vladimir Makovsky — The Bouquet of Flowers (also in Paintings by Vasiliy Polenov)
- Alexandre Jacovleff: V.Shukhaev in sailor suite by A.Yakovlev.jpg (also in Paintings by Vasily Shukhaev)
- Alexandre Jacovleff: Vasily Shukhaev in his studio by A.Yakovlev (1928, priv.coll.).jpg (also in Paintings by Vasily Shukhaev)
- Mikhail Matyushin: Exhibition of Works by Petrograd Artists of All Trends, 1918-1923.jpg (also in Paintings by Kazimir Malevich)
- Leon Benois: Партрэт Л. Н. Бенуа.JPG (also in Paintings by Oleksandr Murashko)
- Pavel Korin: Mikhail Nesterov 051.jpg (also in Paintings by Mikhail Nesterov)
- Pavel Korin: P.D. Korin by M.Nesterov.jpg (also in Paintings by Mikhail Nesterov)
- Ivan Puni: Newspaper article about Tramway V exhibition.jpg (also in Paintings by Kazimir Malevich)
- Aristarkh Lentulov: Interiors of New Tretyakov Gallery P1060734.JPG (also in Paintings by Alexandra Exter)
- Lyubov Popova: Динамический супрематизм № 57 в ГТГ (2).jpg (also in Paintings by Ivan Kliun)

### Known weak spots

- About 20% of titles are Cyrillic or transliterated Russian from Commons file names (kept as the original, per the rule; no English Wikidata label exists for those works). About 6% are "Untitled" (file name was only a number / the painter's name).
- Near-duplicate photos of the same painting are caught by title+year and a 9x8 difference hash plus an 8x8 colour signature; two different photos of one painting with very different colour casts can still both survive (seen once in Surikov: "Pir Valtasara" and "Belshazzar's Feast").
- Oil studies ("etude") are kept as paintings; anything titled sketch / preparatory / drawing / print / album / detail / FRAME photo is dropped. Photos taken inside museum halls were filtered by title only.
- Painters credited by Wikidata citizenship alone (not birth) may be Russian-Empire minorities (Tatar, Estonian, Finnish-Karelian); they are staged only when born in Russia.
