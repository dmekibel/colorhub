#!/bin/bash
# Runs the Europe / Latin America Wikidata stagers one after another (WDQS: one request at a time).
cd "$(dirname "$0")/../.." || exit 1
export OMP_NUM_THREADS=1
for m in prado thyssen spain_other mnaa portugal_other nationalmuseum_wd sweden_other nasjonalmuseet norway_other fng finland_other \
         mnw mnk poland_other czechia hungary khm belvedere austria_other kunsthaus_zurich switzerland_other baltics greece ireland latinamerica; do
  echo "== $m"
  python3 "tools/stage/$m.py" 2>&1 | grep -v "^   WDQS" | cut -c1-900
done
