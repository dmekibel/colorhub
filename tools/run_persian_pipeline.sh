#!/usr/bin/env bash
# One unattended run for the Persian batch (David, 2026-10-27: save credits): wait for the fetch, drop text pages and duplicates, rebuild everything
# (upload to R2 held), redo the audits that follow the gallery order, run the gates. Log: research/_raw/pipeline.log, last line "PIPELINE DONE".
set -uo pipefail
cd "$(dirname "$0")/.."
while pgrep -f "tools/persian_extra.py" >/dev/null; do sleep 60; done
echo "== fetch finished"; tail -3 research/_raw/persian-build.log
echo "== filter"; python3 tools/persian_filter.py
echo "== rebuild (NO_R2)"; NO_R2=1 tools/rebuild_all.sh --atlas
for a in audit_beauty audit_scene audit_mood look_gradient; do echo "== $a"; python3 tools/$a.py | tail -2; done
echo "== gates"; node tools/check_ids.js | tail -3
echo "PIPELINE DONE"
