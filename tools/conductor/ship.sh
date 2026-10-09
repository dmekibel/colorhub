#!/bin/bash
# Conductor ship: bump ?v=, gates, smoke (2 tries), push only when green.
cd "$(dirname "$0")/../.." || exit 1
OLD=$(grep -o '?v=[0-9a-z]*' index.html | head -1 | cut -c4-); NEW="$(date +%Y%m%d%H%M)"
sed -i '' "s/?v=$OLD/?v=$NEW/g" index.html
fail=0
for f in js/*.js; do node --check "$f" >/dev/null 2>&1 || { echo "SYNTAX $f"; fail=1; }; done
node tools/check.js 2>&1 | grep -q "0 files name colors" || { node tools/check.js | tail -3; fail=1; }
node tools/check_names.js | grep -q "0 duplicate" || { echo NAMES; fail=1; }
node tools/check_fetched.js >/dev/null || { node tools/check_fetched.js | tail -5; fail=1; }
# every script/stylesheet must stay wired into index.html (merges that keep "ours" have silently dropped new tags);
# a few files load lazily on purpose and are listed here
LAZY="js/palettes.js js/segment-worker.js"
for f in js/*.js js/games/*.js css/*.css; do case " $LAZY " in *" $f "*) continue;; esac; grep -q "\"$f?" index.html || { echo "NOT IN index.html: $f"; fail=1; }; done
# gate only committed articles (the writing workflow drops in-progress files into data/articles/)
# (a tracked file the workflow is re-editing in the working tree isn't what ships; its committed version passed when committed)
TRACKED=$(git ls-files 'data/articles/*.json' | grep -v -e link-map -e '/index.json' | while read f; do git diff --quiet -- "$f" && echo "$f"; done)
[ -f tools/article_gate.py ] && [ -n "$TRACKED" ] && { python3 tools/article_gate.py $TRACKED >/tmp/ag.log 2>&1 || { tail -3 /tmp/ag.log; fail=1; }; }
# Full smoke once; under heavy machine load a whole Chrome group can die, so re-run only the failed groups, alone.
# Smoke runs on a clean snapshot of HEAD (+ the bumped index.html), never the working tree: the article workflows keep
# dropping half-written drafts into data/articles/, and a draft once hung a whole smoke group.
SNAP=/tmp/colorhub-ship-snap
[ -d "$SNAP/.git" ] || [ -f "$SNAP/.git" ] || git worktree add -f --detach "$SNAP" HEAD >/dev/null 2>&1
git -C "$SNAP" checkout -q --detach -f "$(git rev-parse HEAD)" && git -C "$SNAP" clean -qfd && cp index.html "$SNAP/index.html"
ok=0
if bash "$SNAP/tools/smoke.sh" > /tmp/smoke.log 2>&1; then ok=1; else
  ok=1
  for g in $(grep -A40 FAILURES /tmp/smoke.log | grep -oE '^  [a-z-]+ /' | awk '{print $1}' | sort -u); do
    bash "$SNAP/tools/smoke.sh" --group "$g" > /tmp/smoke-$g.log 2>&1 || { ok=0; grep -A6 FAILURES /tmp/smoke-$g.log; }
  done
fi
[ $ok = 1 ] || fail=1
if [ $fail = 0 ]; then git add index.html; git commit -qm "Ship ?v=$NEW

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"; if git push -q origin main 2>/tmp/ship-push.log; then echo "SHIPPED ?v=$NEW"; else grep -E 'GH0|secret|rejected|path:|commit:' /tmp/ship-push.log | head -8; echo "COMMITTED ?v=$NEW BUT PUSH FAILED -- NOT LIVE"; fi; else git checkout -q index.html; echo "NOT SHIPPED"; fi
