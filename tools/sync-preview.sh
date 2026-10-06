#!/bin/sh
# Mirrors the site into the session scratchpad that the local preview server reads from.
# (The preview server can't read ~/Documents directly on this Mac.) Usage: tools/sync-preview.sh <dest>
cd "$(dirname "$0")/.." && rsync -a --delete --exclude .xfer_done --exclude .claude --exclude .git --exclude prototype ./ "$1/"
