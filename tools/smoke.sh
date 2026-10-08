#!/bin/bash
# ColorHub smoke test: run before every push.  Usage: tools/smoke.sh [--group <name>] [--only <scenario,scenario>] [--static-only]
#   1. static scan: calls/assignments to names that are never declared anywhere (tools/undef_scan.js)
#   2. serve the repo on a free local port (python3 -m http.server; never 8791)
#   3. drive headless Chrome through a 375x812 same-origin iframe (tools/smoke/wrapper.html), one Chrome per scenario
#      group, in parallel, and assert each screen's behavior with real DOM events (tools/smoke/scenarios.js)
# Exits non-zero on any failure. It is a smoke test: it catches "this button throws" and "this screen is blank",
# not visual or design problems (those stay with tools/shots.sh and a human look).
set -u
cd "$(dirname "$0")/.."
ROOT="$(pwd)"
FILTER=()
STATIC_ONLY=0
while [ $# -gt 0 ]; do
  case "$1" in
    --group) FILTER+=(--group "$2"); shift 2;;
    --only) FILTER+=(--only "$2"); shift 2;;
    --static-only) STATIC_ONLY=1; shift;;
    *) echo "unknown option $1"; exit 2;;
  esac
done
CHROME="${SMOKE_CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
START=$(date +%s)
FAIL=0

# ---- 1. static scan (needs acorn in tools/node_modules; installed on first run, never touches the app) ----
if [ ! -d tools/node_modules/acorn ]; then
  echo "installing acorn into tools/node_modules (one time)..."
  npm install --prefix tools --no-save --no-package-lock --no-audit --no-fund acorn >/dev/null 2>&1 || { echo "could not install acorn"; exit 2; }
fi
echo "== static scan (tools/undef_scan.js)"
node tools/undef_scan.js || FAIL=1
[ "$STATIC_ONLY" = 1 ] && { [ $FAIL = 0 ] && echo "static scan OK" ; exit $FAIL; }

# ---- 2. serve the repo ----
[ -x "$CHROME" ] || { echo "Chrome not found at: $CHROME (set SMOKE_CHROME)"; exit 2; }
PORT=$(python3 - <<'PY'
import socket
while True:
    s = socket.socket(); s.bind(("127.0.0.1", 0)); p = s.getsockname()[1]; s.close()
    if p != 8791: print(p); break
PY
)
OVERLAY="$(mktemp -d)"
bash tools/smoke/overlay.sh "$ROOT" "$OVERLAY" || exit 2
python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$OVERLAY" >/dev/null 2>&1 &
SERVER=$!; disown
trap 'kill $SERVER 2>/dev/null; rm -rf "$OVERLAY"' EXIT
for i in $(seq 1 50); do curl -s -o /dev/null "http://127.0.0.1:$PORT/index.html" && break; sleep 0.1; done

# ---- 3. the browser scenarios ----
echo "== browser scenarios (port $PORT)"
node tools/smoke/run.js "$PORT" ${FILTER[@]+"${FILTER[@]}"} || FAIL=1

echo "total: $(( $(date +%s) - START ))s -- $([ $FAIL = 0 ] && echo SMOKE OK || echo SMOKE FAILED)"
exit $FAIL
