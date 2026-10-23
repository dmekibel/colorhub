#!/usr/bin/env python3
"""Fill missing country (`co`) and missing / impossible year (`y`) on corpus rows. Nothing in data/corpus is edited here.

  python3 tools/fill_country_date.py [--corpus DIR] [--raw DIR] [--stage all|fetch|build] [--no-search] [--sleep 0.8]
      -> data/fills/country-date-fills.json         {row id: fill}   (read by tools/apply_fills.py)
      -> data/fills/country-date-fills.stats.json   counts by field / method / confidence, remaining unknowns, samples
      -> data/fills/_cache.json                     every Wikidata / Commons answer (resumable; delete to refetch)

Resumable: every API answer is cached, a re-run asks only for what is missing, and `--stage build` rebuilds the fills
from the cache with no network. Polite: one request at a time, a pause between requests, maxlag=5, Retry-After and
exponential backoff on 429/503. A 403 stops the run (the host blocks us); it never tries to get round it.

Method, in order of trust (a fill never replaces a value; it only fills a blank, or an impossible year):
  COUNTRY
    record         the museum's own record (research/_raw/<src>/meta.json): made_country, creator nationality, ...
    wikidata       work: P495 country of origin on the painting's item (high confidence)
                   artist: P27 citizenship, else country of the P19 birthplace (med / low; rule says which)
    artist-country GUESS: the modern country of the artist's other rows in this corpus, when >= 3 rows and >= 70% agree
  YEAR
    record         museum dates (only a range of <= 25 years)
    wikidata       P571 inception on the painting's item / Commons file (year or decade precision), only if it fits
                   the artist's life
    artist-years   GUESS: artist life dates known -> the middle of the working years (birth+20 to death, capped at
                   1955); y = midpoint, span = the width of that range. If life dates are unknown but the artist has
                   >= 8 dated works here: the middle of their 10th-90th percentile (rule artist-dated-works).
Anonymous works with no other clue stay empty.

Stored convention (checked against the code, 2026-10-23): the corpus builder (tools/corpus.py) keeps `span` = date_end -
date_start (the full width, in years) beside `y`, and uses it only at build time (decade / century bucket filters:
rows with span > DECADE_SPAN / CENTURY_SPAN are left out). Shards and the gallery do not store span and nothing in js/
shows a "c." prefix. So fills use that same meaning: y = midpoint, span = full width, plus `yest` / `coest` = true on a
GUESS so a stat or the UI can tell measured from estimated. Those three fields are new to the shards: gallery.py reads
only y and co, so the estimate flag has no effect until gallery.py / the stats code is taught to read it.
"""
import argparse, ast, gzip, json, os, random, re, sys, time, unicodedata, urllib.error, urllib.parse, urllib.request
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
UA = "Chromatlas/1.0 (https://chromatlas.app; dmekibel@gmail.com)"
WD = "https://www.wikidata.org/w/api.php"
CM = "https://commons.wikimedia.org/w/api.php"
ARTIST_OCC = {"Q1028181", "Q1281618", "Q1925963", "Q329439", "Q15296811", "Q11569986", "Q5322166", "Q483501", "Q1209498",
              "Q17307272", "Q42973", "Q16947657", "Q18074503", "Q1114448", "Q3391743", "Q4610556", "Q644687", "Q33231",
              "Q10862983", "Q10862618", "Q1371925", "Q6625963"}
WANT = ["P170", "P571", "P495", "P27", "P569", "P570", "P19", "P17", "P106"]
TIME = {"P571", "P569", "P570"}
ANON = re.compile(r"^(unknown|anonymous|anon\b|workshop|school|circle|follower|attributed|manner|after|studio|master|"
                  r"various|unidentified)", re.I)
LIFE_CAP = 1955
UNMAPPED = Counter()

# Wikidata country labels (modern and historical) -> the corpus's own country names. Labels not found here are
# stripped of "Kingdom of" etc. and tried against the countries already in the corpus; anything else stays unmapped
# (counted in the stats) instead of being guessed.
HIST = "h"
EXACT = {
    "United States of America": "United States", "United States": "United States", "Kingdom of the Netherlands": "Netherlands",
    "Dutch Republic": HIST + "Netherlands", "Batavian Republic": HIST + "Netherlands",
    "Habsburg Netherlands": HIST + "Belgium", "Spanish Netherlands": HIST + "Belgium", "Austrian Netherlands": HIST + "Belgium",
    "County of Flanders": HIST + "Belgium", "Duchy of Brabant": HIST + "Belgium", "United Kingdom of the Netherlands": HIST + "Netherlands",
    "Kingdom of France": HIST + "France", "First French Empire": HIST + "France", "Second French Empire": HIST + "France",
    "French Third Republic": HIST + "France", "July Monarchy": HIST + "France", "Bourbon Restoration": HIST + "France",
    "First French Republic": HIST + "France", "French Second Republic": HIST + "France", "Vichy France": HIST + "France",
    "Kingdom of Italy": HIST + "Italy", "Republic of Venice": HIST + "Italy", "Papal States": HIST + "Italy",
    "Grand Duchy of Tuscany": HIST + "Italy", "Kingdom of Naples": HIST + "Italy", "Kingdom of Sardinia": HIST + "Italy",
    "Kingdom of the Two Sicilies": HIST + "Italy", "Duchy of Milan": HIST + "Italy", "Republic of Florence": HIST + "Italy",
    "Republic of Genoa": HIST + "Italy", "Duchy of Savoy": HIST + "Italy", "Kingdom of Sicily": HIST + "Italy",
    "Duchy of Mantua": HIST + "Italy", "Duchy of Parma": HIST + "Italy", "Duchy of Modena and Reggio": HIST + "Italy",
    "Lombardy–Venetia": HIST + "Italy", "Italian Social Republic": HIST + "Italy", "Duchy of Ferrara": HIST + "Italy",
    "Crown of Castile": HIST + "Spain", "Crown of Aragon": HIST + "Spain", "Spanish Empire": HIST + "Spain",
    "Kingdom of Spain": "Spain", "Second Spanish Republic": HIST + "Spain", "Kingdom of Castile": HIST + "Spain",
    "German Empire": HIST + "Germany", "Weimar Republic": HIST + "Germany", "Nazi Germany": HIST + "Germany",
    "Kingdom of Prussia": HIST + "Germany", "Kingdom of Bavaria": HIST + "Germany", "Kingdom of Saxony": HIST + "Germany",
    "Holy Roman Empire": HIST + "Germany", "German Confederation": HIST + "Germany", "East Germany": HIST + "Germany",
    "Kingdom of Württemberg": HIST + "Germany", "Kingdom of Hanover": HIST + "Germany", "Electorate of Saxony": HIST + "Germany",
    "Free City of Frankfurt": HIST + "Germany", "Duchy of Prussia": HIST + "Germany", "Margraviate of Brandenburg": HIST + "Germany",
    "Austrian Empire": HIST + "Austria", "Austria-Hungary": HIST + "Austria", "Habsburg monarchy": HIST + "Austria",
    "Archduchy of Austria": HIST + "Austria", "Cisleithania": HIST + "Austria", "Empire of Austria": HIST + "Austria",
    "Kingdom of Hungary": HIST + "Hungary", "Czechoslovakia": HIST + "Czechia", "Czech Republic": "Czechia",
    "Kingdom of Bohemia": HIST + "Czechia", "Bohemia": HIST + "Czechia", "Moravia": HIST + "Czechia",
    "Russian Empire": HIST + "Russia", "Soviet Union": HIST + "Russia", "Tsardom of Russia": HIST + "Russia",
    "Russian Soviet Federative Socialist Republic": HIST + "Russia", "Grand Duchy of Moscow": HIST + "Russia",
    "Russian Republic": HIST + "Russia", "Ukrainian SSR": HIST + "Ukraine", "Byelorussian SSR": HIST + "Belarus",
    "Kingdom of Poland": HIST + "Poland", "Polish–Lithuanian Commonwealth": HIST + "Poland", "Congress Poland": HIST + "Poland",
    "Second Polish Republic": HIST + "Poland", "Polish People's Republic": HIST + "Poland", "Grand Duchy of Lithuania": HIST + "Lithuania",
    "Denmark–Norway": HIST + "Denmark", "Kingdom of Denmark": "Denmark", "Kingdom of Sweden": "Sweden",
    "Kingdom of Norway": "Norway", "Grand Duchy of Finland": HIST + "Finland",
    "Kingdom of Great Britain": HIST + "United Kingdom", "Kingdom of England": HIST + "United Kingdom",
    "United Kingdom of Great Britain and Ireland": HIST + "United Kingdom", "England": "United Kingdom",
    "Scotland": "United Kingdom", "Wales": "United Kingdom", "Northern Ireland": "United Kingdom",
    "Kingdom of Scotland": HIST + "United Kingdom", "British Raj": HIST + "India", "Kingdom of Ireland": HIST + "Ireland",
    "Old Swiss Confederacy": HIST + "Switzerland", "Helvetic Republic": HIST + "Switzerland",
    "Empire of Japan": HIST + "Japan", "Tokugawa shogunate": HIST + "Japan", "Qing dynasty": HIST + "China",
    "Ming dynasty": HIST + "China", "People's Republic of China": "China", "Republic of China (1912–1949)": HIST + "China",
    "Song dynasty": HIST + "China", "Yuan dynasty": HIST + "China", "Tang dynasty": HIST + "China",
    "South Korea": "Korea", "North Korea": "Korea", "Joseon": HIST + "Korea", "Korean Empire": HIST + "Korea",
    "Mughal Empire": HIST + "India", "Ottoman Empire": HIST + "Turkey", "Safavid Iran": HIST + "Iran",
    "Qajar Iran": HIST + "Iran", "Kingdom of Portugal": "Portugal", "Portuguese Empire": HIST + "Portugal",
    "Kingdom of Greece": "Greece", "Ottoman Greece": HIST + "Greece", "Mexico": "Mexico", "Viceroyalty of Peru": HIST + "Peru",
    "Viceroyalty of New Spain": HIST + "Mexico", "Empire of Brazil": HIST + "Brazil", "Yugoslavia": HIST + "Croatia",
    "Kingdom of Yugoslavia": HIST + "Croatia", "Socialist Federal Republic of Yugoslavia": HIST + "Croatia",
    "Duchy of Courland": HIST + "Latvia", "Swedish Empire": HIST + "Sweden",
    "Southern Netherlands": HIST + "Belgium", "Austria–Hungary": HIST + "Austria", "German Reich": HIST + "Germany",
    "Republic of Geneva": HIST + "Switzerland", "Grand Duchy of Baden": HIST + "Germany", "Duchy of Württemberg": HIST + "Germany",
    "Landgraviate of Hesse-Kassel": HIST + "Germany", "Electorate of Hesse": HIST + "Germany", "Lübeck": HIST + "Germany",
    "Hamburg": HIST + "Germany", "Electoral Palatinate": HIST + "Germany", "Lordship of Bologna": HIST + "Italy",
    "Duchy of Florence": HIST + "Italy", "Republic of Siena": HIST + "Italy", "Kingdom of Aragon": HIST + "Spain",
    "Russian Socialist Federative Soviet Republic": HIST + "Russia", "Northern Low Countries": HIST + "Netherlands",
    "Prince-Bishopric of Liège": HIST + "Belgium", "Burgundian Netherlands": HIST + "Belgium", "Duchy of Lorraine": HIST + "France",
    "Ukraine": "Ukraine", "Philippines": "Philippines", "Slovakia": "Slovakia",
}
PREFIX = re.compile(r"^(Kingdom|Republic|Grand Duchy|Duchy|Empire|Principality|State|Commonwealth) of( the)? ", re.I)


def norm(s):
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def map_country(label, vocab):
    """(country, historical?) or (None, False)."""
    if not label:
        return None, False
    v = EXACT.get(label)
    if v:
        return (v[1:], True) if v[0] == HIST else (v, False)
    if label in vocab:
        return label, False
    bare = PREFIX.sub("", label)
    if bare in vocab:
        return bare, True
    UNMAPPED[label] += 1
    return None, False


DEMONYM = {"american": "United States", "french": "France", "italian": "Italy", "dutch": "Netherlands",
           "british": "United Kingdom", "english": "United Kingdom", "scottish": "United Kingdom", "welsh": "United Kingdom",
           "german": "Germany", "flemish": "Belgium", "belgian": "Belgium", "spanish": "Spain", "swiss": "Switzerland",
           "greek": "Greece", "russian": "Russia", "swedish": "Sweden", "portuguese": "Portugal", "austrian": "Austria",
           "danish": "Denmark", "chinese": "China", "irish": "Ireland", "polish": "Poland", "norwegian": "Norway",
           "canadian": "Canada", "mexican": "Mexico", "japanese": "Japan", "korean": "Korea", "indian": "India",
           "hungarian": "Hungary", "czech": "Czechia", "finnish": "Finland", "guatemalan": "Guatemala", "egyptian": "Egypt",
           "peruvian": "Peru", "brazilian": "Brazil", "argentine": "Argentina", "turkish": "Turkey", "persian": "Iran",
           "australian": "Australia", "ukrainian": "Ukraine", "romanian": "Romania", "estonian": "Estonia"}


def demonym(text):
    t = re.sub(r"\(.*?\)|\?", "", text or "").strip().lower()
    return DEMONYM.get(t)


# ------------------------------------------------------------------ corpus + cache
def load_rows(corpus):
    rows = []
    for f in sorted(Path(corpus).glob("*.json")):
        d = json.loads(f.read_text(encoding="utf-8"))
        d = d.get("rows", d) if isinstance(d, dict) else d
        rows.extend(d)
    return rows


def lit(v):
    if isinstance(v, str):
        try:
            return ast.literal_eval(v)
        except Exception:
            return v
    return v


def load_json(p, default):
    try:
        return json.loads(Path(p).read_text(encoding="utf-8"))
    except Exception:
        return default


class Abort(Exception):
    pass


class Api:
    def __init__(self, sleep):
        self.sleep, self.last, self.n = sleep, 0.0, 0

    def get(self, base, params):
        url = base + "?" + urllib.parse.urlencode(dict(params, format="json", maxlag=5))
        for attempt in range(7):
            wait = self.last + self.sleep - time.time()
            if wait > 0:
                time.sleep(wait)
            ra = None
            try:
                req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Encoding": "gzip"})
                with urllib.request.urlopen(req, timeout=60) as r:
                    raw = r.read()
                    if r.headers.get("Content-Encoding") == "gzip":
                        raw = gzip.decompress(raw)
                    ra = r.headers.get("Retry-After")
                self.last = time.time()
                self.n += 1
                d = json.loads(raw)
            except urllib.error.HTTPError as e:
                self.last = time.time()
                if e.code == 403:
                    raise Abort("403 from %s: the host blocks this client; stopping" % base)
                if e.code in (429, 500, 502, 503, 504):
                    back = int(e.headers.get("Retry-After") or 0) or min(300, 20 * 2 ** attempt)
                    print("  HTTP %d, waiting %ds" % (e.code, back), flush=True)
                    time.sleep(back)
                    continue
                raise
            except (urllib.error.URLError, TimeoutError, ConnectionError, ValueError) as e:
                print("  network trouble (%s), retrying" % e, flush=True)
                time.sleep(min(120, 10 * 2 ** attempt))
                continue
            if "error" in d:
                if d["error"].get("code") == "maxlag":
                    time.sleep(max(5, int(ra or 5)))
                    continue
                raise Abort("API error: %s" % d["error"])
            return d
        raise Abort("gave up after 7 tries: " + url[:120])


def reduce_entity(ent):
    out = {}
    lab = (ent.get("labels") or {}).get("en", {}).get("value")
    if lab:
        out["l"] = lab
    claims = ent.get("claims") or ent.get("statements") or {}
    for pid in WANT:
        vals = []
        for st in claims.get(pid, []):
            ms = st.get("mainsnak", {})
            if ms.get("snaktype") != "value" or st.get("rank") == "deprecated":
                continue
            dv = ms.get("datavalue", {}).get("value")
            pref = st.get("rank") == "preferred"
            if pid in TIME:
                m = re.match(r"([+-])(\d+)-", dv.get("time", ""))
                if m:
                    vals.append([(-1 if m.group(1) == "-" else 1) * int(m.group(2)), dv.get("precision"), pref])
            elif isinstance(dv, dict) and dv.get("id"):
                vals.append([dv["id"], pref])
        if vals:
            out[pid] = vals
    return out


class Cache:
    def __init__(self, path):
        self.path = Path(path)
        d = load_json(path, {})
        self.ent, self.lab, self.search = d.get("ent", {}), d.get("lab", {}), d.get("search", {})
        self.dirty = 0

    def save(self):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.path.with_suffix(".tmp")
        tmp.write_text(json.dumps(dict(ent=self.ent, lab=self.lab, search=self.search), ensure_ascii=False, separators=(",", ":")))
        os.replace(tmp, self.path)
        self.dirty = 0


def fetch_entities(api, cache, ids, label=""):
    """Wikidata items (Q...) and Commons file entities (M...), 50 per request."""
    todo = sorted({i for i in ids if i and i not in cache.ent})
    if not todo:
        return
    print("fetch %s: %d entities (%d requests)" % (label, len(todo), (len(todo) + 49) // 50), flush=True)
    for kind, base in (("Q", WD), ("M", CM)):
        mine = [i for i in todo if i[0] == kind]
        for k in range(0, len(mine), 50):
            chunk = mine[k:k + 50]
            d = api.get(base, dict(action="wbgetentities", ids="|".join(chunk), languages="en",
                                   props="claims|labels" if kind == "Q" else "claims"))
            ents = d.get("entities", {})
            for i in chunk:
                e = ents.get(i) or {}
                cache.ent[i] = {"missing": 1} if (not e or "missing" in e) else reduce_entity(e)
            cache.dirty += 1
            if cache.dirty >= 10:
                cache.save()
                print("  %s %d/%d (requests so far %d)" % (kind, k + len(chunk), len(mine), api.n), flush=True)
    cache.save()


def fetch_labels(api, cache, ids):
    todo = sorted({i for i in ids if i and i not in cache.lab})
    for k in range(0, len(todo), 50):
        chunk = todo[k:k + 50]
        d = api.get(WD, dict(action="wbgetentities", ids="|".join(chunk), languages="en", props="labels"))
        for i in chunk:
            cache.lab[i] = ((d.get("entities", {}).get(i) or {}).get("labels") or {}).get("en", {}).get("value") or ""
    if todo:
        cache.save()


def first_val(vals):
    """Statement values after rank: preferred ones if any."""
    if not vals:
        return []
    pref = [v for v in vals if v[-1]]
    return pref or vals


# ------------------------------------------------------------------ the analysis (pure functions of rows + cache)
class World:
    def __init__(self, rows, cache, meta, aliases, raw):
        self.rows, self.cache, self.aliases, self.raw = rows, cache, aliases, raw
        self.vocab = {r["co"] for r in rows if r.get("co")}
        self.fold = lambda n: aliases.get(n, n) if n else n
        self.by_artist = defaultdict(list)
        for r in rows:
            self.by_artist[self.fold(r.get("a"))].append(r)
        self.meta_q = {}
        for e in (meta.get("a") or {}).values():
            if e.get("q") and e.get("n"):
                self.meta_q[self.fold(e["n"])] = e["q"]
        self.search_names = set()
        self.art = {}                    # folded name -> validated artist info
        self.rejected = []
        self._raw = {}

    # ---- ids
    @staticmethod
    def ent_id(row):
        m = re.match(r"commons-([QF])(\d+)$", row["id"])
        if not m:
            return None
        return ("Q" if m.group(1) == "Q" else "M") + m.group(2)

    def pent(self, row):
        i = self.ent_id(row)
        return self.cache.ent.get(i) if i else None

    # ---- artist resolution
    def candidates(self, name):
        out = []
        q = self.meta_q.get(name)
        if q:
            out.append((q, "meta"))
        votes, n = Counter(), 0
        for r in self.by_artist[name]:
            e = self.pent(r)
            if e and e.get("P170"):
                n += 1
                votes.update({v[0] for v in e["P170"]})
        if votes:
            q2, c = votes.most_common(1)[0]
            if c / n >= 0.6 and q2 not in [x[0] for x in out]:
                out.append((q2, "painting-P170"))
        for q3 in self.cache.search.get(name, []):
            if q3 not in [x[0] for x in out]:
                out.append((q3, "search"))
        return out

    def person(self, q):
        e = self.cache.ent.get(q) or {}
        if e.get("missing"):
            return None
        yr = lambda p: next((v[0] for v in first_val(e.get(p)) if v[1] and v[1] >= 9), None)
        return dict(q=q, label=e.get("l"), b=yr("P569"), d=yr("P570"), e=e)

    def country_of(self, qs, pref=None):
        """Countries for a list of country-QID statements -> (country, rule note, conf) or None."""
        got = []
        for v in first_val(qs):
            c, h = map_country(self.cache.lab.get(v[0]), self.vocab)
            if c:
                got.append((c, h))
        if not got:
            return None
        names = list(dict.fromkeys(c for c, h in got))
        if len(names) == 1:
            return names[0], "med"
        if pref in names:               # several citizenships: the one the artist's other rows already carry
            return pref, "med"
        modern = list(dict.fromkeys(c for c, h in got if not h))
        if len(modern) == 1:
            return modern[0], "low"
        return names[0], "low"

    def valid(self, name, p, src):
        dated = [r["y"] for r in self.by_artist[name] if r.get("y") is not None]
        if p["b"] is None or p["d"] is None or len(dated) < 3:
            return True
        inside = sum(1 for y in dated if p["b"] - 2 <= y <= p["d"] + 3)
        return inside / len(dated) >= (0.6 if src == "search" else 0.4)

    def resolve_artists(self):
        self.art, self.rejected = {}, []
        for name in self.by_artist:
            if not name or ANON.match(name):
                continue
            for q, src in self.candidates(name):
                p = self.person(q)
                if not p:
                    continue
                if src == "search":
                    occ = {v[0] for v in p["e"].get("P106", [])}
                    if norm(p["label"]) != norm(name) or not (occ & ARTIST_OCC):
                        continue
                if not self.valid(name, p, src):
                    self.rejected.append((name, q, src))
                    continue
                co = None
                p27 = p["e"].get("P27")
                if p27:
                    mj = self.majority_country(name)
                    r = self.country_of(p27, mj[0] if mj else None)
                    if r:
                        co = (r[0], "artist-P27 %s (%s)" % (q, p["label"]), r[1])
                if not co and p["e"].get("P19"):
                    for pl in first_val(p["e"]["P19"]):
                        pe = self.cache.ent.get(pl[0]) or {}
                        if pe.get("P17"):
                            r = self.country_of(pe["P17"])
                            if r:
                                co = (r[0], "artist-birthplace-P19-P17 %s" % q, "low")
                                break
                self.art[name] = dict(q=q, src=src, b=p["b"], d=p["d"], co=co, label=p["label"])
                break

    # ---- museum records
    def raw_rows(self, src):
        if src not in self._raw:
            base = src[:-1] if src.endswith("2") else src
            d = load_json(Path(self.raw) / base / "meta.json", None)
            d = d.get("rows", d) if isinstance(d, dict) else d
            self._raw[src] = {str(x.get("id")): x for x in (d or [])}
        return self._raw[src]

    def record(self, row):
        """(country, year, span) from the museum's own record; any of them None."""
        src = row["src"]
        if src.startswith("commons"):
            return None, None, None
        x = self.raw_rows(src).get(row["id"].split("-", 1)[1])
        if not x:
            return None, None, None
        co, lo, hi = None, None, None
        base = src[:-1] if src.endswith("2") else src
        try:
            if base == "rijks":
                co = next((c for c in (x.get("made_country"), x.get("birth_country")) if c and c != "None" and c in self.vocab), None)
                ys = [int(y) for y in re.findall(r"\b(1\d{3}|[5-9]\d{2})\b", str(x.get("created") or ""))]
                lo, hi = (min(ys), max(ys)) if ys else (None, None)
            elif base == "nga":
                co = demonym(x.get("nationality"))
                lo, hi = x.get("beginyear"), x.get("endyear")
            elif base == "cma":
                for c in lit(x.get("creators")) or []:
                    m = re.search(r"\(([A-Za-z\-]+)[,)]", c.get("description") or "")
                    co = co or (demonym(m.group(1)) if m else None)
                lo, hi = x.get("creation_date_earliest"), x.get("creation_date_latest")
            elif base == "smk":
                for p in lit(x.get("production")) or []:
                    co = co or demonym(p.get("creator_nationality"))
                pd = lit(x.get("production_date")) or []
                if pd:
                    lo, hi = (int(str(pd[0].get("start"))[:4]), int(str(pd[0].get("end"))[:4]))
            elif base == "aic":
                m = re.search(r"\(([A-Za-z\-]+)[,)]", x.get("artist_display") or "")
                co = demonym(m.group(1)) if m else None
                lo, hi = x.get("date_start"), x.get("date_end")
            lo = int(lo) if lo not in (None, "None", "") else None
            hi = int(hi) if hi not in (None, "None", "") else None
        except Exception:
            lo = hi = None
        if lo is None or hi is None or hi < lo or hi - lo > 25:
            return co, None, None
        return co, (lo + hi + 1) // 2 if hi > lo else lo, hi - lo

    # ---- year facts
    def life_ok(self, name, y):
        a = self.art.get(name)
        if not a or a["b"] is None:
            return True
        hi = a["d"] if a["d"] is not None else a["b"] + 100
        return a["b"] - 1 <= y <= hi + 1

    def p571(self, row, name):
        if row["id"].startswith("commons-F"):   # a Commons file's P571 is when the photo was made, not the painting
            return None, None, "file-date"
        e = self.pent(row)
        vals = [v for v in first_val((e or {}).get("P571")) if v[1] and v[1] >= 8]
        if not vals:
            return None, None, "none"
        ys = {v[0] if v[1] >= 9 else v[0] // 10 * 10 for v in vals}
        if len(ys) > 1 and max(ys) - min(ys) > 10 and not any(v[2] for v in vals):
            return None, None, "ambiguous"
        v = vals[0]
        if v[1] >= 9:
            y, span = v[0], None
        else:
            y, span = v[0] // 10 * 10 + 4, 9
        if not (-3000 < y <= 2025) or not self.life_ok(name, y):
            return None, None, "implausible"
        return y, span, "ok"

    def impossible(self):
        """Row ids whose y lies outside the (validated) artist's life +-1; skip an artist when > 30% of theirs would be."""
        out = {}
        for name, a in self.art.items():
            if a["b"] is None or a["d"] is None:
                continue
            dated = [r for r in self.by_artist[name] if r.get("y") is not None]
            bad = [r for r in dated if r["y"] < a["b"] - 1 or r["y"] > a["d"] + 1]
            if dated and len(bad) / len(dated) <= 0.3:
                out.update({r["id"]: r["y"] for r in bad})
        return out

    def dated_range(self, name):
        ys = sorted(r["y"] for r in self.by_artist[name] if r.get("y") is not None)
        if len(ys) < 8:
            return None
        lo, hi = ys[int(len(ys) * 0.1)], ys[min(len(ys) - 1, int(len(ys) * 0.9))]
        return (lo + hi) // 2, hi - lo, len(ys)

    def majority_country(self, name):
        c = Counter(r["co"] for r in self.by_artist[name] if r.get("co"))
        n = sum(c.values())
        if n < 3:
            return None
        co, k = c.most_common(1)[0]
        return (co, k / n, n) if k / n >= 0.7 else None


# ------------------------------------------------------------------ fetching pipeline
def pipeline_fetch(w, api, a):
    c, rows = w.cache, w.rows
    # 1. a few rows per artist that has no Wikidata id yet, to learn the creator (P170) from the painting's own item
    samples = []
    for name, rs in w.by_artist.items():
        if not name or ANON.match(name) or name in w.meta_q:
            continue
        if not any((not r.get("co")) or r.get("y") is None for r in rs):
            continue
        ids = [w.ent_id(r) for r in rs if w.ent_id(r)]
        random.Random(name).shuffle(ids)
        samples += ids[:3]
    fetch_entities(api, c, samples, "artist samples")
    # 2. search by name for artists still without a candidate
    if not a.no_search:
        todo = []
        for name, rs in w.by_artist.items():
            if not name or ANON.match(name) or name in c.search or w.candidates(name):
                continue
            if any((not r.get("co")) or r.get("y") is None for r in rs):
                todo.append(name)
        print("name searches: %d" % len(todo), flush=True)
        for k, name in enumerate(todo):
            d = api.get(WD, dict(action="wbsearchentities", search=name, language="en", type="item", limit=5))
            c.search[name] = [x["id"] for x in d.get("search", [])]
            c.dirty += 1
            if c.dirty >= 20:
                c.save()
                print("  searched %d/%d" % (k + 1, len(todo)), flush=True)
        c.save()
    # 3. every candidate artist, then birthplaces of those without citizenship, then country labels
    qs = {q for name in w.by_artist if name and not ANON.match(name) for q, _ in w.candidates(name)}
    fetch_entities(api, c, qs, "artists")
    places = set()
    for q in qs:
        e = c.ent.get(q) or {}
        if not e.get("P27"):
            places |= {v[0] for v in e.get("P19", [])}
    fetch_entities(api, c, places, "birthplaces")
    cq = set()
    for q in qs:
        cq |= {v[0] for v in (c.ent.get(q) or {}).get("P27", [])}
    for p in places:
        cq |= {v[0] for v in (c.ent.get(p) or {}).get("P17", [])}
    fetch_labels(api, c, cq)
    w.resolve_artists()
    print("artists resolved: %d of %d names (%d rejected by the life-dates check)"
          % (len(w.art), sum(1 for n in w.by_artist if n), len(w.rejected)), flush=True)
    # 4. the paintings whose year is missing / impossible, and country-blank rows whose artist gave no country
    imp = w.impossible()
    need = []
    for r in rows:
        i = w.ent_id(r)
        if not i:
            continue
        name = w.fold(r.get("a"))
        art = w.art.get(name)
        if r.get("y") is None or r["id"] in imp or (not r.get("co") and not (art and art["co"])):
            need.append(i)
    random.Random(7).shuffle(need)
    fetch_entities(api, c, need, "paintings (year / country)")
    pc = set()
    for i in need:
        pc |= {v[0] for v in (c.ent.get(i) or {}).get("P495", [])}
    fetch_labels(api, c, pc)


# ------------------------------------------------------------------ build the fills
def build(w):
    imp = w.impossible()
    fills, why = {}, Counter()
    for r in w.rows:
        name = w.fold(r.get("a"))
        art = w.art.get(name)
        f = {}
        rco, ry, rspan = w.record(r)
        # ---- country
        if not r.get("co"):
            e = w.pent(r) or {}
            wk = w.country_of(e["P495"]) if e.get("P495") else None
            maj = w.majority_country(name) if name else None
            if rco:
                f.update(co=rco, co_how="record", co_conf="high", co_rule="museum record")
            elif wk:
                f.update(co=wk[0], co_how="wikidata", co_conf="high" if wk[1] == "med" else "med", co_rule="work-P495")
            elif art and art["co"] and not (art["co"][2] == "low" and maj and maj[1] >= 0.9 and maj[2] >= 5):
                f.update(co=art["co"][0], co_how="wikidata", co_conf=art["co"][2], co_rule=art["co"][1] + " via " + art["src"])
            elif maj:
                f.update(co=maj[0], co_how="artist-country", co_conf="med" if maj[1] >= 0.9 and maj[2] >= 5 else "low",
                         co_rule="corpus-majority %d%% of %d rows" % (round(maj[1] * 100), maj[2]), coest=True)
        # ---- year
        replace = r["id"] in imp
        if r.get("y") is None or replace:
            y = None
            if ry is not None and (not replace or w.life_ok(name, ry)):
                y, span, how, conf, rule = ry, rspan or None, "record", "high" if (rspan or 0) <= 10 else "med", "museum record"
            if y is None:
                py, ps, st = w.p571(r, name)
                why["p571-" + st] += 1
                if py is not None:
                    y, span, how, conf, rule = py, ps, "wikidata", "high" if ps is None else "med", "P571 inception"
            if y is None and art and art["b"] is not None:
                b, d = art["b"], art["d"]
                end = min(d if d is not None else b + 60, LIFE_CAP)
                start = b + 20 if (d is None or d - b > 30) else b + 15
                if end > start:
                    y, span = (start + end) // 2, end - start
                    how, conf, rule = "artist-years", "low", "life %d-%s: middle of %d-%d (birth+20 to death, cap %d)" % (b, d if d is not None else "?", start, end, LIFE_CAP)
                    f["yest"] = True
            if y is None and name and not ANON.match(name):
                dr = w.dated_range(name)
                if dr:
                    y, span = dr[0], dr[1]
                    how, conf, rule = "artist-years", "low", "artist-dated-works: middle of 10th-90th percentile of %d dated works" % dr[2]
                    f["yest"] = True
            if y is not None:
                f.update(y=y, y_how=how, y_conf=conf, y_rule=rule)
                if span:
                    f["span"] = span
                if replace:
                    f.update(replace=True, was=r["y"])
        if f:
            f["how"] = f.get("co_how") if "co" in f and "y" not in f else (f.get("y_how") if "y" in f and "co" not in f else "mixed")
            f["conf"] = f.get("co_conf") if "co" in f and "y" not in f else (f.get("y_conf") if "y" in f and "co" not in f else "mixed")
            fills[r["id"]] = f
    return fills, imp, why


def stats(w, fills, imp, why):
    rows = w.rows
    needco = [r for r in rows if not r.get("co")]
    needy = [r for r in rows if r.get("y") is None]
    s = dict(rows=len(rows), missing_country=len(needco), missing_year=len(needy), impossible_year_rows=len(imp),
             artists_resolved=len(w.art), artists_rejected=len(w.rejected), p571_outcomes=dict(why),
             unmapped_wikidata_country_labels=UNMAPPED.most_common(25))
    by = Counter()
    for i, f in fills.items():
        if "co" in f:
            by["co/" + f["co_how"] + "/" + f["co_conf"]] += 1
        if "y" in f:
            by[("y-replace/" if f.get("replace") else "y/") + f["y_how"] + "/" + f["y_conf"]] += 1
    s["fills"] = dict(sorted(by.items()))
    ids = {r["id"] for r in needco}
    s["country_still_unknown"] = sum(1 for i in ids if "co" not in fills.get(i, {}))
    ids = {r["id"] for r in needy}
    s["year_still_unknown"] = sum(1 for i in ids if "y" not in fills.get(i, {}))
    return s


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--corpus", default=str(ROOT / "data" / "corpus"))
    ap.add_argument("--raw", default=os.environ.get("COLORHUB_RAW") or str(ROOT / "research" / "_raw"))
    ap.add_argument("--out", default=str(ROOT / "data" / "fills" / "country-date-fills.json"))
    ap.add_argument("--cache", default=str(ROOT / "data" / "fills" / "_cache.json"))
    ap.add_argument("--stage", default="all", choices=["all", "fetch", "build"])
    ap.add_argument("--no-search", action="store_true", help="skip Wikidata name searches for artists with no id")
    ap.add_argument("--sleep", type=float, default=0.8)
    a = ap.parse_args()
    rows = load_rows(a.corpus)
    print("corpus rows: %d" % len(rows), flush=True)
    cache = Cache(a.cache)
    meta = load_json(ROOT / "data" / "artists" / "meta.json", {})
    aliases = load_json(ROOT / "data" / "artists" / "aliases.json", {})
    w = World(rows, cache, meta, aliases, a.raw)
    if a.stage in ("all", "fetch"):
        try:
            pipeline_fetch(w, Api(a.sleep), a)
        except Abort as e:
            cache.save()
            print("STOPPED: %s (cache saved; re-run to resume)" % e, flush=True)
            sys.exit(2)
        except KeyboardInterrupt:
            cache.save()
            print("interrupted (cache saved; re-run to resume)")
            sys.exit(130)
    if a.stage in ("all", "build"):
        w.resolve_artists()
        fills, imp, why = build(w)
        out = Path(a.out)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(fills, ensure_ascii=False, separators=(",", ":")))
        st = stats(w, fills, imp, why)
        byid = {r["id"]: r for r in rows}
        guesses = sorted(i for i, f in fills.items() if f.get("coest") or f.get("yest"))
        st["samples_guess"] = [dict(id=i, artist=byid[i].get("a"), title=(byid[i].get("t") or "")[:60], **fills[i])
                               for i in random.Random(3).sample(guesses, min(10, len(guesses)))]
        out.with_suffix(".stats.json").write_text(json.dumps(st, ensure_ascii=False, indent=1))
        print(json.dumps({k: v for k, v in st.items() if k != "samples_guess"}, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
