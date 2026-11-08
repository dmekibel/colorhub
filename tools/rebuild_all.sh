#!/usr/bin/env bash
# Rebuild everything that is keyed to the gallery order, in the one order that works, then run every gate.
# Run it after ANY change to data/corpus/*.json, data/corpus-nonpaintings.json or tools/gallery.py.
#
#   tools/rebuild_all.sh            # gallery -> derived files -> thumbs -> pages -> gates (atlas only checked)
#   tools/rebuild_all.sh --atlas       # also update the painting-map atlas, incrementally: only groups whose paintings
#                                      # changed are fetched (the gallery order is append-only, so a new batch = minutes)
#   tools/rebuild_all.sh --atlas-full  # rebuild every atlas sheet from scratch (hours; only if sheets are suspect)
#   tools/rebuild_all.sh --atlas --resume  # after a crash: skip the steps the last run finished (.rebuild-done), redo the rest
#
# Why one script (2026-10-20): the chain is order-dependent and a half-finished run silently breaks the app. gallery.py deletes
# metrics.bin and thumbs.txt; portraits.json kept an old order for ten days and Van Gogh's page showed a Bonnard. Every step
# here is also covered by node tools/check_ids.js, which names the tool that fixes whatever is out of step.
set -euo pipefail
# one thread per worker: numpy otherwise spawns dozens of threads in each of the 8 pool workers (load average 300 on 10 cores, 5x slower)
export OMP_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1 VECLIB_MAXIMUM_THREADS=1 MKL_NUM_THREADS=1 NUMEXPR_NUM_THREADS=1
cd "$(dirname "$0")/.."
ATLAS=0; SKIPGAL=0; RESUME=0
for a in "$@"; do case "$a" in --atlas) ATLAS=1;; --atlas-full) ATLAS=2;; --skip-gallery) SKIPGAL=1;; --resume) RESUME=1;; esac; done   # --skip-gallery: resume after a gallery.py that already finished
# Resume (David, 2026-11-08: a crash an hour in meant starting over). Each step that finishes is written to .rebuild-done;
# --resume skips those and redoes the rest. A run without --resume starts clean; a run that finishes deletes the file.
# A step counts as finished when the next one starts, so the step that crashed is always redone. Gates and R2 always run.
STATE=.rebuild-done CUR="" FINISHED=0
[ "$RESUME" = 1 ] || rm -f "$STATE"
[ "$RESUME" = 1 ] && [ -f "$STATE" ] && echo "resuming: $(wc -l < "$STATE" | tr -d ' ') steps already done"
step() {   # returns 1 (skip the body) when --resume and this step finished in the last run
  [ -n "$CUR" ] && echo "$CUR" >> "$STATE"; CUR="$*"; echo
  if [ "$RESUME" = 1 ] && grep -qxF -- "$*" "$STATE" 2>/dev/null; then echo "== $* (done in the last run: skipped)"; return 1; fi
  echo "== $*"
}
always() { [ -n "$CUR" ] && echo "$CUR" >> "$STATE"; CUR=""; echo; echo "== $*"; }
trap '[ "$FINISHED" = 1 ] || { echo; echo "!! stopped during: ${CUR:-?} -- fix it, then rerun with --resume (the same flags) to pick up there"; }' EXIT
FAILED=()   # steps that are allowed to fail without stopping the run, listed loudly at the end (2026-10-27: a crashed look layout went unnoticed until the last line)

if step "audit the new art (dates, same-painting duplicates, non-paintings) -- read it before shipping"; then
  python3 tools/audit_artists.py | grep -E "^[A-Z].*rows|DATE" || true
fi

if step "crops: deep white margins (data/crop-margins.json, 30 s), then every palette measured inside its crop (frame crops come from tools/crop_paintings.py run, a separate step)"; then
  python3 tools/crop_margins.py | tail -1 | cut -c1-200
  python3 tools/crop_paintings.py apply | tail -1 | cut -c1-160
fi

if step "painter name variants (data/artists/aliases.json; live merges never change, new ones need the same lifetime)"; then
  [ "$SKIPGAL" = 1 ] || python3 tools/artist_aliases.py | sed -n 2p
fi
if step "gallery (deletes metrics.bin and thumbs.txt; the steps below put them back)"; then
  [ "$SKIPGAL" = 1 ] || python3 tools/gallery.py --raw research/_raw | tail -1 | cut -c1-160
fi
if step "hidden non-artworks (data/gallery/hidden.json: blank scans, journal covers, data/hide-overrides.json; a filter, never a deletion)"; then
  python3 tools/hide_duplicates.py | tail -1 | cut -c1-160
  python3 tools/hide_nonart.py | tail -1 | cut -c1-160
fi
if step "finer color index (data/colorindex/: color cell -> paintings, keyed to gallery positions; skips quietly without research/_raw's image caches)"; then
  if [ -d research/_raw/commons/img ]; then python3 tools/color_index.py --raw research/_raw --workers 8 | tail -2 | cut -c1-160; else echo "no research/_raw image caches: skipped (check_ids.js will fail until it is rebuilt)"; fi
fi
if step "By look layout (CLIP embeddings -> UMAP -> even grid; fills missing embeddings first; skips quietly without research/_raw/clipenv; a rebuild may move every painting)"; then
  python3 tools/subjects.py | tail -1   # look_layout reads subjects.json for the new ids: it must be current first (2026-10-27: the look step crashed without it)
  { python3 tools/subjects_clip.py --embed-only && python3 tools/look_layout.py; } 2>&1 | tail -2 | cut -c1-160 || FAILED+=("$CUR")
fi
if step "By vibe neighbors (exact top-60 by CLIP cosine per painting -> data/gallery/vibe/*.bin; served from R2; skips quietly without the venv)"; then
  python3 tools/vibe_knn.py 2>&1 | tail -2 | cut -c1-160 || FAILED+=("$CUR")
fi
if step "hidden again, now that new paintings have image embeddings (bad shots and far-off photos, doubles incl. visitor photos)"; then
  [ -x research/_raw/clipenv/bin/python ] && research/_raw/clipenv/bin/python tools/audit_photos.py --hide | grep -E "^wrote" | cut -c1-160
  python3 tools/hide_duplicates.py | tail -1 | cut -c1-160
  python3 tools/hide_nonart.py | tail -1 | cut -c1-160
fi
for s in analyze metrics_build facets artwiki_build; do if step "$s"; then python3 tools/$s.py | tail -1 | cut -c1-160; fi; done
if step "painter counts, movements, portraits and most-famous rails (all store gallery positions)"; then
  python3 tools/wikidata_artists.py | tail -1 | cut -c1-160
  python3 tools/kinds.py   # illustration and other non-painting rows by gallery position (the Illustration room)
  python3 tools/facts_build.py   # Wikidata facts (museum, medium, size, genre) by gallery position, for the painting page
  python3 tools/painters_lite.py | tail -1 | cut -c1-160   # gallery indices: lite painters go stale otherwise (Abel Faivre showed a Monet, 2026-10-25)
  python3 tools/artwiki_portraits.py | tail -2 | cut -c1-160
fi
if step "painting-map thumbnails list"; then
  python3 tools/paintmap_thumbs.py | tail -1
fi
if step "subject tags (Wikidata genre/depicts for new paintings, polite and resumable; follows ids.txt order)"; then
  python3 tools/subjects.py | tail -1
fi
if step "model-detected subject tags (CLIP on cached images; skips quietly if research/_raw/clipenv is missing; new paintings only)"; then
  python3 tools/subjects_clip.py | tail -2
fi
if step "Subjects list (names, covers, palettes for the vibe islands -> data/gallery/island-names.json; needs the tags and look-islands.bin above)"; then
  python3 tools/island_names.py | head -1
fi
if [ "$ATLAS" != 0 ]; then
  if step "painting-map atlas ($([ "$ATLAS" = 2 ] && echo "full rebuild: hours" || echo "incremental: only changed groups"))"; then
    [ "$ATLAS" = 2 ] && python3 tools/paintmap_atlas.py clean
    # plain build = PATCH: only tiles whose source line (picture + crop) changed are recomputed (2026-10-27: 2,581 changed crops redid 135,000 tiles, 5 h)
    python3 tools/paintmap_atlas.py build $([ "$ATLAS" = 2 ] && echo --full) | tail -3 | cut -c1-160
  fi
fi
if [ "$ATLAS" != 0 ] || [ ! -f data/paintmap/micro.json ] || [ ! -f data/paintmap/cluster.json ]; then
  if step "painting-map micro layer (every painting as 5x5 px, from the tier-0 sheets: the map's first frame; ~6 s)"; then
    python3 tools/paintmap_micro.py | tail -1 | cut -c1-160
  fi
  if step "painting-map cluster packs (Color-layout blocks at 40 px, from the tier-1 sheets: a first view is a few packs, not ~100 sheets; ~2 min, ~1 GB RAM)"; then
    python3 tools/paintmap_cluster.py | tail -1 | cut -c1-160
  fi
fi
if step "crawlable pages"; then
  python3 tools/pages.py | tail -1 | cut -c1-160
fi

always "gates"
node tools/check_ids.js
node tools/check.js | tail -8
node tools/check_wiki.js | tail -1; node tools/check_names.js | tail -1; node tools/check_solvable.js | tail -1; node tools/check_aliases.js | tail -1; node tools/check_nearest.js | tail -1
always "upload the data to Cloudflare R2 (data.chromatlas.app) -- BEFORE the push that bumps ?v="
if [ -n "${NO_R2:-}" ]; then echo "NO_R2 set: upload held (run python3 tools/r2_sync.py, then bump ?v= and push)"; elif [ -f ~/.chromatlas-r2 ]; then python3 tools/r2_sync.py | tail -2; else echo "no ~/.chromatlas-r2: skipped (the live site falls back to the repo's own copy)"; fi
FINISHED=1
if [ ${#FAILED[@]} -gt 0 ]; then
  for f in "${FAILED[@]}"; do grep -vxF -- "$f" "$STATE" > "$STATE.tmp" || true; mv "$STATE.tmp" "$STATE"; done   # --resume redoes them
  echo; echo "!! FAILED STEPS: ${FAILED[*]} -- the run continued without them; fix, then rerun with --resume to redo just those"; exit 1
fi
rm -f "$STATE"
echo; echo "Done. Bump the ?v= tag in index.html, run tools/smoke.sh, then commit and push."
