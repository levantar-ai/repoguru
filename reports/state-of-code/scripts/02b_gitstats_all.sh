#!/usr/bin/env bash
# Stage 2b — extract git metadata (last 1000 commits) for every active
# repo. Cheap shallow-clone with --depth=1000, then `git log` (via the
# Python helper) to harvest author/email/timestamp/files-changed
# records. One JSON per repo.
#
# Bounded execution: every repo caps at MAX_COMMITS regardless of
# total history length. Predictable, parallelisable, fast.
#
# Inputs:
#   $1            — target slug (e.g. "uk-gov")
#   PARALLEL      — concurrent workers (default: 16)
#   MAX_COMMITS   — last-N-commits cap (default: 1000)
#   GITHUB_TOKEN  — auth (falls back to `gh auth token`)
#
# Outputs (under $TARGET_ROOT):
#   data/gitstats/<owner>/<repo>.json   — one record per repo
#   data/gitstats_meta/progress.log
#   data/gitstats_meta/errors.log
#   data/gitstats_meta/done.txt
#   data/gitstats_meta/failed.txt

set -uo pipefail
. "$(dirname "$0")/_paths.sh"
resolve_paths "$@" || exit $?

URL_FILE=${URL_FILE:-$TARGET_ROOT/data/raw/clone-urls-active.txt}
PARALLEL=${PARALLEL:-16}
MAX_COMMITS=${MAX_COMMITS:-1000}

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
EXTRACTOR=$SCRIPT_DIR/_gitstats_extract.py

OUTDIR=$TARGET_ROOT/data/gitstats
META=$TARGET_ROOT/data/gitstats_meta
WORKDIR=$TARGET_ROOT/data/_work_gitstats

if [ -z "${GITHUB_TOKEN:-}" ]; then
  GITHUB_TOKEN=$(gh auth token 2>/dev/null || true)
fi
if [ ! -f "$URL_FILE" ]; then
  echo "ERROR: URL file not found: $URL_FILE" >&2
  exit 2
fi
if [ ! -x "$EXTRACTOR" ]; then
  chmod +x "$EXTRACTOR" 2>/dev/null || true
fi

mkdir -p "$OUTDIR" "$META" "$WORKDIR"
: >> "$META/progress.log"
: >> "$META/errors.log"
: >> "$META/done.txt"
: >> "$META/failed.txt"

START=$(date +%s)
TOTAL=$(grep -cv '^$' "$URL_FILE")
echo "=== Git-stats run starting: $TOTAL urls, parallel=$PARALLEL, max-commits=$MAX_COMMITS ===" >> "$META/progress.log"

# The per-URL worker is a self-contained bash one-liner so it can be
# safely passed through xargs / bash -c. We avoid `export -f` (which
# blows up with embedded heredocs in some shells).
WORKER_SCRIPT=$(cat <<'WORKER'
url=$1
slug=$(echo "$url" | sed -E 's|^https?://github\.com/||; s|\.git$||')
owner=${slug%%/*}
name=${slug#*/}
out=$OUTDIR/$owner/$name.json
work=$WORKDIR/$$-$owner-$name

[ -s "$out" ] && exit 0
mkdir -p "$OUTDIR/$owner"
rm -rf "$work"

auth_url=$url
if [ -n "${GITHUB_TOKEN:-}" ]; then
  auth_url=${url/https:\/\//https://x-access-token:$GITHUB_TOKEN@}
fi

t0=$(date +%s)
if ! GIT_TERMINAL_PROMPT=0 git clone \
      --depth="$MAX_COMMITS" --no-tags --single-branch --quiet \
      "$auth_url" "$work" >/dev/null 2>>"$META/errors.log"; then
  printf '%(%FT%T)T clone-failed %s\n' -1 "$slug" >> "$META/errors.log"
  echo "$slug clone-failed" >> "$META/failed.txt"
  rm -rf "$work"
  exit 1
fi
t1=$(date +%s)

if ! python3 "$EXTRACTOR" "$work" "$out" "$slug" "$MAX_COMMITS" 2>>"$META/errors.log"; then
  printf '%(%FT%T)T extract-failed %s\n' -1 "$slug" >> "$META/errors.log"
  echo "$slug extract-failed" >> "$META/failed.txt"
  rm -rf "$work"
  exit 1
fi
t2=$(date +%s)

rm -rf "$work"
printf '%(%FT%T)T %s clone=%ds extract=%ds\n' -1 "$slug" $((t1-t0)) $((t2-t1)) >> "$META/progress.log"
echo "$slug" >> "$META/done.txt"
WORKER
)

export OUTDIR WORKDIR META GITHUB_TOKEN MAX_COMMITS EXTRACTOR

xargs -a "$URL_FILE" -P "$PARALLEL" -I {} bash -c "$WORKER_SCRIPT" _ {}

END=$(date +%s)
DONE_COUNT=$(wc -l < "$META/done.txt")
FAIL_COUNT=$(wc -l < "$META/failed.txt")
{
  echo "=== Done: $((END - START))s elapsed ==="
  echo "  succeeded: $DONE_COUNT"
  echo "  failed:    $FAIL_COUNT"
  echo "  results:   $OUTDIR"
} >> "$META/progress.log"
tail -5 "$META/progress.log"
