#!/usr/bin/env bash
# End-to-end pipeline orchestrator for the State-of-Code report type.
#
# Runs all three stages against a target slug:
#   1. enumerate every public repo for each org listed in the target
#   2. tech-detect every active repo (shallow clone → scan → cleanup)
#   3. build the report's view-models from the raw + scanned data
#
# Each stage is idempotent — re-running picks up incremental progress.
# Use the SKIP_* env vars to re-run only the tail of the pipeline; the
# most useful is SKIP_ENUM=1 SKIP_TECHDETECT=1 to rebuild view-models
# from cached data after editing the aggregator.
#
# Required:
#   $1   — target slug (e.g. "uk-gov"); resolves to:
#            config: reports/state-of-code/targets/<slug>/    (in repo)
#            data:   $DATA_ROOT/state-of-code/<slug>/         (outside repo)
#
# Optional env:
#   DATA_ROOT         — where data lives (default: $HOME/.repoguru-reports)
#   PARALLEL          — concurrency for the cloner (default: 16)
#   SKIP_ENUM         — set to skip stage 1 (use cached repos.tsv)
#   SKIP_TECHDETECT   — set to skip stage 2 (use cached JSONs)
#   SKIP_VIEWMODELS   — set to skip stage 3

set -uo pipefail
. "$(dirname "$0")/_paths.sh"
resolve_paths "$@" || exit $?

TITLE=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("title",""))' "$TARGET_ROOT/target.json")
SCRIPTS=$(dirname "$0")

echo "═════════════════════════════════════════════════════════════"
echo "  State-of-Code report — $TARGET_SLUG"
echo "  title: $TITLE"
echo "  root:  $TARGET_ROOT"
echo "═════════════════════════════════════════════════════════════"

if [ -z "${SKIP_ENUM:-}" ]; then
  echo
  echo "[1/3] Enumerating repos for each org…"
  bash "$SCRIPTS/01_enumerate_repos.sh" "$TARGET_SLUG"
else
  echo "[1/3] SKIPPED (SKIP_ENUM set)"
fi

if [ -z "${SKIP_TECHDETECT:-}" ]; then
  echo
  echo "[2/3] Tech-detecting every active repo…"
  bash "$SCRIPTS/02_techdetect_all.sh" "$TARGET_SLUG"
else
  echo "[2/3] SKIPPED (SKIP_TECHDETECT set)"
fi

if [ -z "${SKIP_VIEWMODELS:-}" ]; then
  echo
  echo "[3/4] Building view-models…"
  python3 "$SCRIPTS/03_build_viewmodels.py"
else
  echo "[3/4] SKIPPED (SKIP_VIEWMODELS set)"
fi

if [ -z "${SKIP_SITE:-}" ]; then
  echo
  echo "[4/4] Rendering magazine-style HTML site…"
  python3 "$SCRIPTS/04_render_site.py"
else
  echo "[4/4] SKIPPED (SKIP_SITE set)"
fi

echo
echo "═════════════════════════════════════════════════════════════"
echo "  Done. Outputs:"
echo "    $TARGET_ROOT/viewmodels/         — section view-models"
echo "    $TARGET_ROOT/viewmodels/per_org/ — one JSON per org"
echo "    $TARGET_ROOT/viewmodels/manifest.json — provenance"
echo "    $TARGET_ROOT/site/index.html     — rendered report (open in browser)"
echo "═════════════════════════════════════════════════════════════"
