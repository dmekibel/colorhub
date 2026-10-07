#!/bin/sh
# Screenshots of app screens at iPhone size for design review.
# Usage: tools/shots.sh <base-url> <out-dir> screen [screen...]   e.g. tools/shots.sh http://localhost:8791 /tmp/shots learn gym "closeup:c:Teal"
BASE="$1"; OUT="$2"; shift 2
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
mkdir -p "$OUT"
for s in "$@"; do
  f="$OUT/$(echo "$s" | tr ':/' '--').png"
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --no-first-run --user-data-dir="$OUT/.profile" \
    --window-size=390,844 --force-device-scale-factor=2 --virtual-time-budget=5000 \
    --screenshot="$f" "$BASE/#shot=$s" >/dev/null 2>&1
  echo "$f"
done
