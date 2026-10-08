#!/bin/sh
# Screenshots at true phone widths (e.g. 375x812, 320x568) through tools/_qa/frame.html, since headless
# Chrome won't size its window below ~500px.
# Usage: tools/_qa/frameshots.sh <base-url> <out-dir> <WxH> <list-file>
#   list-file: one shot per line, tab-separated: name<TAB>hash<TAB>optional JS run inside the app 1.5 s after load
#   e.g.  train	#shot=gym
#         menu	#shot=learn	menu()
# Headless Chrome often stays alive after writing the shot (the honeycomb's animation loop), so each run is
# watched: as soon as the PNG lands it's cropped and that Chrome is stopped. Two shots run at a time.
BASE="$1"; OUT="$2"; SIZE="$3"; LIST="$4"
W="${SIZE%x*}"; H="${SIZE#*x}"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
mkdir -p "$OUT"
enc() { python3 -c 'import sys,urllib.parse;print(urllib.parse.quote(sys.argv[1],safe=""))' "$1"; }
WW=$W; [ "$W" -lt 520 ] && WW=520
TAB=$(printf '\t')
one() {
  n="$1"; hash="$2"; js="$3"; f="$OUT/$n.png"; rm -f "$f"
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --no-first-run --user-data-dir="$OUT/.profile-$n" \
    --window-size=$WW,$H --force-device-scale-factor=2 --virtual-time-budget=7000 \
    --screenshot="$f" "$BASE/tools/_qa/frame.html?w=$W&h=$H&hash=$(enc "$hash")&js=$(enc "$js")" >/dev/null 2>&1 &
  pid=$!; t=0
  while [ ! -s "$f" ] && [ $t -lt 120 ] && kill -0 $pid 2>/dev/null; do sleep 0.5; t=$((t + 1)); done
  sleep 0.5; kill $pid 2>/dev/null; pkill -9 -f "user-data-dir=$OUT/.profile-$n" 2>/dev/null; wait $pid 2>/dev/null
  rm -rf "$OUT/.profile-$n"
  [ -s "$f" ] && python3 -c 'import sys;from PIL import Image;i=Image.open(sys.argv[1]);i.crop((0,0,int(sys.argv[2])*2,int(sys.argv[3])*2)).save(sys.argv[1])' "$f" "$W" "$H" && echo "$f" || echo "FAILED $n"
}
i=0
while IFS="$TAB" read -r n hash js; do
  [ -z "$n" ] && continue
  case "$n" in \#*) continue;; esac
  one "$n" "$hash" "$js" &
  i=$((i + 1)); [ $((i % 2)) -eq 0 ] && wait
done < "$LIST"
wait
