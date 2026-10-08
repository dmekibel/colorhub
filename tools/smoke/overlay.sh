#!/bin/bash
# overlay.sh <repo root> <dir>: build the directory the smoke server serves. Every top-level entry of the repo is
# symlinked in, except index.html, which is a copy with tools/smoke/capture.js added as its first script (so
# errors are recorded from the first byte of the page). The repo itself is never modified.
set -e
ROOT="$1"; DIR="$2"
for f in "$ROOT"/* "$ROOT"/.[!.]*; do
  n="$(basename "$f")"
  case "$n" in index.html|.git|.claude|research|prototype|.DS_Store) continue;; esac
  [ -e "$f" ] && ln -s "$f" "$DIR/$n"
done
sed 's#<head>#<head><script src="/tools/smoke/capture.js"></script>#' "$ROOT/index.html" > "$DIR/index.html"
grep -q 'smoke/capture.js' "$DIR/index.html" || { echo "overlay: index.html has no <head> to inject into"; exit 1; }
