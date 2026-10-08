#!/usr/bin/env bash
# Stopgap: flags calls to top-level functions that are not defined anywhere.
# Heuristic (names that look like our own helpers); L3's undef_scan.js replaces this.
set -e
cd "$(dirname "$0")/.."
defs=$(grep -hoE '(^|[^.\w$])function +[A-Za-z_$][A-Za-z0-9_$]*|(const|let|var) +[A-Za-z_$][A-Za-z0-9_$]* *= *(async *)?(function|\()' js/*.js index.html 2>/dev/null \
  | sed -E 's/.*(function|const|let|var) +//; s/[ =(].*//' | sort -u)
calls=$(grep -hoE '(^|[^.\w$])[a-z][A-Za-z0-9]{5,}\(' js/*.js 2>/dev/null | sed -E 's/^[^a-z]*//; s/\($//' | sort -u)
missing=0
for c in $calls; do
  # only report names with an internal capital (our camelCase helpers), skipping JS/DOM builtins
  case "$c" in *[A-Z]*) ;; *) continue;; esac
  if ! printf '%s\n' "$defs" | grep -qx "$c"; then
    # allow methods/builtins that appear after a dot elsewhere: cheap filter
    if ! grep -qE "\.$c\(" js/*.js 2>/dev/null; then
      echo "UNDEFINED?  $c  (called in: $(grep -ln "\b$c(" js/*.js | tr '\n' ' '))"; missing=1
    fi
  fi
done
[ "$missing" = 0 ] && echo "undef_check: ok" || { echo "undef_check: FAIL (review each; false positives possible)"; exit 1; }
