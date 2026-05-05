#!/usr/bin/env bash
# Quick status snapshot of the running combined scan.
#
# Usage:  bash reports/state-of-code/scripts/status.sh [target-slug]
#
# Prints a concise progress line — useful as a manual `watch -n 10`.

set -uo pipefail
. "$(dirname "$0")/_paths.sh"
resolve_paths "$@" || exit $?

META=$TARGET_ROOT/data/combined_meta
if [ ! -d "$META" ]; then
  echo "No combined scan has been started for target '$TARGET_SLUG'."
  exit 0
fi

URL_FILE=$TARGET_ROOT/data/raw/clone-urls-active.txt
TOTAL=0
[ -f "$URL_FILE" ] && TOTAL=$(grep -cv '^$' "$URL_FILE")

DONE=$(wc -l < "$META/done.txt" 2>/dev/null || echo 0)
FAIL=$(wc -l < "$META/failed.txt" 2>/dev/null || echo 0)
PROC=$((DONE + FAIL))
PCT=$(awk -v p=$PROC -v t=$TOTAL 'BEGIN { if (t>0) printf "%.1f", 100*p/t; else print "0.0" }')

# How many workers in flight (clones currently held)?
WORKDIR=$TARGET_ROOT/data/_work_combined
INFLIGHT=0
[ -d "$WORKDIR" ] && INFLIGHT=$(ls "$WORKDIR" 2>/dev/null | wc -l)

# Disk used by the clone workspace.
WORKSIZE=$(du -sh "$WORKDIR" 2>/dev/null | cut -f1)
WORKSIZE=${WORKSIZE:-0}

# Most recent progress line (per-repo timing).
LAST=$(grep -E '^[0-9]{4}-[0-9]{2}-[0-9]{2}T' "$META/progress.log" 2>/dev/null | tail -1)
LAST=${LAST:-(no per-repo lines yet)}

# Determine if scan is currently running.
RUNNING="no"
if pgrep -f '02_scan_combined' >/dev/null 2>&1; then
  RUNNING="yes"
fi

cat <<EOF
=== Combined scan status — target: $TARGET_SLUG ===
running:    $RUNNING
progress:   $PROC / $TOTAL ($PCT%)
  done:     $DONE
  failed:   $FAIL
in flight:  $INFLIGHT clones · $WORKSIZE on disk
last line:  $LAST

results:    $TARGET_ROOT/data/combined/
meta:       $META/
follow:     tail -f $META/progress.log
EOF
