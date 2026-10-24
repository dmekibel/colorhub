#!/usr/bin/env bash
# Rebuild everything that is keyed to the gallery order, in the one order that works, then run every gate.
# Run it after ANY change to data/corpus/*.json, data/corpus-nonpaintings.json or tools/gallery.py.
#
#   tools/rebuild_all.sh            # gallery -> derived files -> thumbs -> pages -> gates (atlas only checked)
#   tools/rebuild_all.sh --atlas       # also update the painting-map atlas, incrementally: only groups whose paintings
#                                      # changed are fetched (the gallery order is append-only, so a new batch = minutes)
#   tools/rebuild_all.sh --atlas-full  # rebuild every atlas sheet from scratch (hours; only if sheets are suspect)
#
# Why one script (2026-10-20): the chain is order-dependent and a half-finished run silently breaks the app. gallery.py deletes
# metrics.bin and thumbs.txt; portraits.json kept an old order for ten days and Van Gogh's page showed a Bonnard. Every step
# here is also covered by node tools/check_ids.js, which names the tool that fixes whatever is out of step.
set -euo pipefail
# one thread per worker: numpy otherwise spawns dozens of threads in each of the 8 pool workers (load average 300 on 10 cores, 5x slower)
export OMP_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1 VECLIB_MAXIMUM_THREADS=1 MKL_NUM_THREADS=1 NUMEXPR_NUM_THREADS=1
cd "$(dirname "$0")/.."
ATLAS=0; SKIPGAL=0
for a in "$@"; do case "$a" in --atlas) ATLAS=1;; --atlas-full) ATLAS=2;; --skip-gallery) SKIPGAL=1;; esac; done   # --skip-gallery: resume after a gallery.py that already finished
step() { echo; echo "== $*"; }

step "audit the new art (dates, same-painting duplicates, non-paintings) -- read it before shipping"
python3 tools/audit_artists.py | grep -E "^[A-Z].*rows|DATE" || true

step "gallery (deletes metrics.bin and thumbs.txt; the steps below put them back)"
[ "$SKIPGAL" = 1 ] || python3 tools/gallery.py --raw research/_raw | tail -1 | cut -c1-160
for s in analyze metrics_build facets artwiki_build; do step "$s"; python3 tools/$s.py | tail -1 | cut -c1-160; done
step "painter counts, movements, portraits and most-famous rails (all store gallery positions)"
python3 tools/wikidata_artists.py | tail -1 | cut -c1-160
python3 tools/artwiki_portraits.py | tail -2 | cut -c1-160
step "painting-map thumbnails list"
python3 tools/paintmap_thumbs.py | tail -1
step "subject tags (Wikidata genre/depicts for new paintings, polite and resumable; follows ids.txt order)"
python3 tools/subjects.py | tail -1
step "model-detected subject tags (CLIP on cached images; skips quietly if research/_raw/clipenv is missing; new paintings only)"
python3 tools/subjects_clip.py | tail -2
if [ "$ATLAS" != 0 ]; then
  step "painting-map atlas ($([ "$ATLAS" = 2 ] && echo "full rebuild: hours" || echo "incremental: only changed groups"))"
  [ "$ATLAS" = 2 ] && python3 tools/paintmap_atlas.py clean
  python3 tools/paintmap_atlas.py build | tail -3 | cut -c1-160
fi
step "crawlable pages"
python3 tools/pages.py | tail -1 | cut -c1-160

step "gates"
node tools/check_ids.js
node tools/check.js | tail -8
node tools/check_wiki.js | tail -1; node tools/check_names.js | tail -1; node tools/check_solvable.js | tail -1; node tools/check_aliases.js | tail -1; node tools/check_nearest.js | tail -1
step "upload the data to Cloudflare R2 (data.chromatlas.app) -- BEFORE the push that bumps ?v="
if [ -f ~/.chromatlas-r2 ]; then python3 tools/r2_sync.py | tail -2; else echo "no ~/.chromatlas-r2: skipped (the live site falls back to the repo's own copy)"; fi
echo; echo "Done. Bump the ?v= tag in index.html, run tools/smoke.sh, then commit and push."
