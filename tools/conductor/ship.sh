#!/bin/bash
# Conductor ship: bump ?v=, gates, smoke (2 tries), push only when green.
cd "$(dirname "$0")/../.." || exit 1
OLD=$(grep -o '?v=[0-9a-z]*' index.html | head -1 | cut -c4-); NEW="$(date +%Y%m%d%H%M)"
sed -i '' "s/?v=$OLD/?v=$NEW/g" index.html
fail=0
for f in js/*.js; do node --check "$f" >/dev/null 2>&1 || { echo "SYNTAX $f"; fail=1; }; done
node tools/check.js 2>&1 | grep -q "0 files name colors" || { node tools/check.js | tail -3; fail=1; }
node tools/check_names.js | grep -q "0 duplicate" || { echo NAMES; fail=1; }
# gate only committed articles (the writing workflow drops in-progress files into data/articles/)
# (a tracked file the workflow is re-editing in the working tree isn't what ships; its committed version passed when committed)
TRACKED=$(git ls-files 'data/articles/*.json' | grep -v -e link-map -e '/index.json' | while read f; do git diff --quiet -- "$f" && echo "$f"; done)
[ -f tools/article_gate.py ] && [ -n "$TRACKED" ] && { python3 tools/article_gate.py $TRACKED >/tmp/ag.log 2>&1 || { tail -3 /tmp/ag.log; fail=1; }; }
# Full smoke once; under heavy machine load a whole Chrome group can die, so re-run only the failed groups, alone.
ok=0
if bash tools/smoke.sh > /tmp/smoke.log 2>&1; then ok=1; else
  ok=1
  for g in $(grep -A40 FAILURES /tmp/smoke.log | grep -oE '^  [a-z]+ /' | awk '{print $1}' | sort -u); do
    bash tools/smoke.sh --group "$g" > /tmp/smoke-$g.log 2>&1 || { ok=0; grep -A6 FAILURES /tmp/smoke-$g.log; }
  done
fi
[ $ok = 1 ] || fail=1
if [ $fail = 0 ]; then git add index.html; git commit -qm "Ship ?v=$NEW

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"; git push -q origin main 2>&1 | tail -1; echo "SHIPPED ?v=$NEW"; else git checkout -q index.html; echo "NOT SHIPPED"; fi
