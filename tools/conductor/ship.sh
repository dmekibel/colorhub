#!/bin/bash
# Conductor ship: bump ?v=, gates, smoke (2 tries), push only when green.
cd "$(dirname "$0")/../.." || exit 1
OLD=$(grep -o '?v=[0-9a-z]*' index.html | head -1 | cut -c4-); NEW="$(date +%Y%m%d%H%M)"
sed -i '' "s/?v=$OLD/?v=$NEW/g" index.html
fail=0
for f in js/*.js; do node --check "$f" >/dev/null 2>&1 || { echo "SYNTAX $f"; fail=1; }; done
node tools/check.js 2>&1 | grep -q "0 files name colors" || { node tools/check.js | tail -3; fail=1; }
node tools/check_names.js | grep -q "0 duplicate" || { echo NAMES; fail=1; }
[ -f tools/article_gate.py ] && { python3 tools/article_gate.py >/tmp/ag.log 2>&1 || { tail -3 /tmp/ag.log; fail=1; }; }
ok=0; for i in 1 2; do bash tools/smoke.sh > /tmp/smoke.log 2>&1 && { ok=1; break; }; done
[ $ok = 1 ] || { grep -A6 FAILURES /tmp/smoke.log; fail=1; }
if [ $fail = 0 ]; then git add index.html; git commit -qm "Ship ?v=$NEW

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"; git push -q origin main 2>&1 | tail -1; echo "SHIPPED ?v=$NEW"; else git checkout -q index.html; echo "NOT SHIPPED"; fi
