#!/bin/bash
cd "$(dirname "$0")/../.." || exit 1
export OMP_NUM_THREADS=1
for m in czechia switzerland_other latinamerica; do echo "== $m"; python3 "tools/stage/$m.py" 2>&1 | grep -v "^   WDQS" | tail -3 | cut -c1-900; done
