#!/usr/bin/env python3
"""Apply the Wikidata metadata backfill to data/corpus/*.json (country, year, movement). PHASE 2 TOOL: phase 1 only prepared it.

  python3 tools/apply_backfill.py                      # DRY RUN (default): counts per field, nothing written
  python3 tools/apply_backfill.py --selftest           # proves the file writer is byte-identical when nothing changes
  python3 tools/apply_backfill.py --write              # patch data/corpus/*.json in place
  options:
    --co-policy chain|birth|citizenship|existing-majority   country source for blank rows (default chain: the painter's existing majority
                                                      label, else a single-country citizenship P27, else birth country; then the overrides)
    --mv painting|painter|both|none                    movement source (default painting; painter = the painter's only movement)
    --years P571,commons-date,title                    which year sources to accept (default all three; "title" is the weakest)
    --min-confidence 0.5                               skip painters matched below this confidence
    --corpus DIR                                       default data/corpus

Rules: only BLANK fields are filled (co null/missing, y null/missing, mv null/missing); a non-blank value is never changed.
Rows keep their key order and the file layout (one compact row per line). After --write run, in this order:
  tools/rebuild_all.sh --atlas     (gallery order is append-only, so no row moves; facets/analysis/stat files are rebuilt)
and the usual gates. New countries (Ukraine, Belarus, Latvia, Lithuania, Slovakia ...) must be added to the app's naming
(facets.py reads the names from the rows, so they appear on their own; js/ country lists, flags and NAV text are checked
by tools/check.js). See research/metadata-backfill/README.md for what to decide first.

Inputs: research/metadata-backfill/painters.json (painter label -> country, ...) and paintings.json (row id -> fill fields).
"""
import argparse, glob, json, os, sys, collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BF = os.path.join(ROOT, "research", "metadata-backfill")


FAMOUS = ["John Singer Sargent", "James McNeill Whistler", "Peter Paul Rubens", "Camille Pissarro", "Wassily Kandinsky", "Marc Chagall",
          "Kazimir Malevich", "Ilya Repin", "Ivan Aivazovsky", "Piet Mondrian", "Edvard Munch", "Gustav Klimt", "Francisco Goya",
          "Salvador Dal", "Pablo Picasso", "Vincent van Gogh", "Claude Monet", "Rembrandt", "Johannes Vermeer", "J. M. W. Turner",
          "John Constable", "Hokusai", "Mary Cassatt", "Edgar Degas", "Paul Gauguin", "El Greco", "Titian", "Caravaggio", "Anthony van Dyck", "Winslow Homer"]


def dump(rows):
    return "[\n" + ",\n".join(json.dumps(r, ensure_ascii=False, separators=(",", ":")) for r in rows) + "\n]\n"


def override_table():
    p = os.path.join(BF, "country-overrides.json")
    return json.load(open(p)) if os.path.exists(p) else {}


def pick_country(label, pr, policy, ov):
    if label in ov: return ov[label]
    if not pr: return None
    ex = pr.get("existing_co") or {}
    # existing_co is the painter's top 3 labels already in the rows; the first is the majority
    maj = max(ex, key=ex.get) if ex else None
    if policy == "birth": return pr.get("country_app")
    if policy == "citizenship": return pr.get("country_p27") or pr.get("country_app")
    if policy == "existing-majority": return maj or pr.get("country_app")
    birth, one = pr.get("country_app"), pr.get("country_p27_single")
    if maj == "Netherlands" and birth == "Belgium": return "Belgium"   # Flemish painters: museums say Netherlands (Southern Netherlands), Wikidata says born in Belgium
    signals = set(pr.get("country_p27_all") or []) | {birth}
    # a museum label is trusted when it agrees with a Wikidata signal (birth or any citizenship); a museum that merely holds
    # the work (Friedrich -> Sweden, Menzel -> Russia) loses to Wikidata
    if maj and (maj in signals or not (signals - {None})):
        if not (birth and one and birth == one and maj != birth): return maj
    return one or birth or maj


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true")
    ap.add_argument("--selftest", action="store_true")
    ap.add_argument("--co-policy", default="chain", choices=["chain", "birth", "citizenship", "existing-majority"])
    ap.add_argument("--mv", default="both", choices=["painting", "painter", "both", "none"])
    ap.add_argument("--years", default="P571,commons-date,title")
    ap.add_argument("--famous", action="store_true", help="print before/after country for ~30 famous painters and exit")
    ap.add_argument("--min-movement-n", type=int, default=25)
    ap.add_argument("--min-confidence", type=float, default=0.0)
    ap.add_argument("--corpus", default=os.path.join(ROOT, "data", "corpus"))
    a = ap.parse_args()
    files = sorted(glob.glob(os.path.join(a.corpus, "*.json")))
    if a.selftest:
        bad = 0
        for f in files:
            raw = open(f, encoding="utf-8").read()
            if dump(json.loads(raw)) != raw:
                bad += 1; print("NOT byte-identical:", os.path.relpath(f, ROOT))
        print("selftest:", len(files), "files,", bad, "differ")
        return 1 if bad else 0
    P = json.load(open(os.path.join(BF, "painters.json")))["painters"]
    W = json.load(open(os.path.join(BF, "paintings.json")))["rows"]
    if a.famous:
        OV0 = override_table()
        for n in FAMOUS:
            ks = [k for k in P if k == n] or [k for k in P if n.lower() in k.lower()][:1]
            for k in ks:
                pr = P[k]; print(f"{k:28s} rows {pr['n']:5d}  existing {pr.get('existing_co')}  birth {pr.get('country_app')}  p27 {pr.get('country_p27_single')}  -> {pick_country(k, pr, a.co_policy, OV0)}")
        return 0
    ysrc = set(a.years.split(","))
    OV = override_table()
    count = collections.Counter(); after = collections.Counter()
    # movement vocabulary: the app's own movements plus any new one that reaches --min-movement-n paintings
    fac = json.load(open(os.path.join(ROOT, "data", "facets", "facets.json")))["movements"]
    tot = collections.Counter()
    for f in files:
        for r in json.loads(open(f, encoding="utf-8").read()):
            if r.get("mv"): tot[r["mv"]] += 1
            elif "mv" in W.get(r["id"], {}) and (a.mv == "both" or a.mv == W[r["id"]].get("ms", "painting")): tot[W[r["id"]]["mv"]] += 1
    allowed = set(fac) | {m for m, n in tot.items() if n >= a.min_movement_n}
    count["movements_vocab"] = len(allowed); count["movements_dropped_small"] = len([m for m in tot if m not in allowed])
    for f in files:
        rows = json.loads(open(f, encoding="utf-8").read()); changed = 0
        for r in rows:
            w = W.get(r["id"], {})
            pr = P.get(r.get("a") or "")
            # country
            if not r.get("co"):
                c = None
                if (pr and pr.get("confidence", 0) >= a.min_confidence) or r.get("a") in OV:
                    c = pick_country(r.get("a"), pr, a.co_policy, OV)
                c = c or (w.get("co") if w.get("cs") == "P495" else None)
                if c: r["co"] = c; count["co"] += 1; changed += 1
            # year
            if not r.get("y") and "y" in w and w.get("ys", "P571") in ysrc:
                r["y"] = w["y"]; count["y:" + w.get("ys", "P571")] += 1; changed += 1
            # movement
            if not r.get("mv") and "mv" in w:
                src = w.get("ms", "painting")
                if (a.mv == "both" or a.mv == src) and w["mv"] in allowed:
                    r["mv"] = w["mv"]; count["mv:" + src] += 1; changed += 1
            if r.get("co"): after["co"] += 1
            if r.get("y"): after["y"] += 1
            if r.get("mv"): after["mv"] += 1
        count["files_touched"] += bool(changed)
        if a.write and changed:
            open(f, "w", encoding="utf-8").write(dump(rows))
    print("MODE:", "WRITE" if a.write else "dry run (nothing written)")
    for k, v in sorted(count.items()): print(f"  {k:24s} {v}")
    print("  rows with country / year / movement after:", after["co"], after["y"], after["mv"])
    return 0


if __name__ == "__main__":
    sys.exit(main())
