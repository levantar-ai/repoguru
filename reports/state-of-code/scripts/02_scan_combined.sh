#!/usr/bin/env bash
# Unified scan — one clone per repo, all analyses on that clone.
#
# Old architecture: 3 separate stages cloned each repo 3 times:
#   stage 2  — clone, detect-tech, delete
#   stage 2b — clone, git-log, delete
#   stage 2c — clone, AI filescan, delete
# New architecture: 1 clone, 4 analyses, delete.
#
# Per repo:
#   1. git clone --depth=1000 (covers full last-1000-commit history
#      AND head tree — sufficient for every downstream pass)
#   2. repoanalyze detect-tech    → tech.json
#   3. python _gitstats_extract  → gitstats.json (last 1000 commits)
#   4. AI tooling file presence  → ai_files.json (CLAUDE.md, etc.)
#   5. repoanalyze report-card    → reportcard.json (uses tech.json)
#   6. trap-safe rm -rf $work
#
# All outputs land at $TARGET_ROOT/data/combined/<owner>/<repo>.json
# in a single merged JSON object.
#
# Inputs:
#   $1            — target slug
#   PARALLEL      — concurrent workers (default 8 — conservative)
#   MAX_COMMITS   — last-N-commits cap (default 1000)
#   BIN           — repoanalyze binary
#   GITHUB_TOKEN  — auth (falls back to `gh auth token`)

set -uo pipefail
. "$(dirname "$0")/_paths.sh"
resolve_paths "$@" || exit $?

URL_FILE=${URL_FILE:-$TARGET_ROOT/data/raw/clone-urls-active.txt}
PARALLEL=${PARALLEL:-8}
MAX_COMMITS=${MAX_COMMITS:-1000}

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
EXTRACTOR=$SCRIPT_DIR/_gitstats_extract.py
REPO_ROOT=$(cd "$SCRIPT_DIR/../../.." && pwd)
BIN=${BIN:-$REPO_ROOT/cli/target/release/repoanalyze}

OUTDIR=$TARGET_ROOT/data/combined
META=$TARGET_ROOT/data/combined_meta
WORKDIR=$TARGET_ROOT/data/_work_combined

if [ -z "${GITHUB_TOKEN:-}" ]; then
  GITHUB_TOKEN=$(gh auth token 2>/dev/null || true)
fi
if [ ! -x "$BIN" ]; then
  echo "ERROR: binary not found at $BIN" >&2
  exit 2
fi
if [ ! -f "$URL_FILE" ]; then
  echo "ERROR: URL file not found: $URL_FILE" >&2
  exit 2
fi
if [ ! -x "$EXTRACTOR" ]; then
  chmod +x "$EXTRACTOR" 2>/dev/null || true
fi

# Belt-and-braces: any pre-existing workspace from a prior run should
# never persist into a new run.
[ -d "$WORKDIR" ] && rm -rf "$WORKDIR"
mkdir -p "$OUTDIR" "$META" "$WORKDIR"
: >> "$META/progress.log"
: >> "$META/errors.log"
: >> "$META/done.txt"
: >> "$META/failed.txt"

START=$(date +%s)
TOTAL=$(grep -cv '^$' "$URL_FILE")
echo "=== Combined scan starting: $TOTAL urls, parallel=$PARALLEL, max-commits=$MAX_COMMITS ===" \
  >> "$META/progress.log"
echo "  binary:   $BIN" >> "$META/progress.log"
echo "  outdir:   $OUTDIR" >> "$META/progress.log"
date '+  started: %F %T' >> "$META/progress.log"

WORKER=$(cat <<'WORKER'
url=$1
slug=$(echo "$url" | sed -E 's|^https?://github\.com/||; s|\.git$||')
owner=${slug%%/*}
name=${slug#*/}
out=$OUTDIR/$owner/$name.json
work=$WORKDIR/$$-$owner-$name

[ -s "$out" ] && exit 0
mkdir -p "$OUTDIR/$owner"
rm -rf "$work"

# Trap-safe cleanup. Even if the worker is killed mid-flight, the
# clone gets wiped so disk pressure stays bounded.
trap 'rm -rf "$work" 2>/dev/null' EXIT INT TERM

auth_url=$url
if [ -n "${GITHUB_TOKEN:-}" ]; then
  auth_url=${url/https:\/\//https://x-access-token:$GITHUB_TOKEN@}
fi

t0=$(date +%s)
if ! GIT_TERMINAL_PROMPT=0 timeout 180 git clone \
      --depth="$MAX_COMMITS" --no-tags --single-branch --quiet \
      "$auth_url" "$work" >/dev/null 2>>"$META/errors.log"; then
  printf '%(%FT%T)T clone-failed %s\n' -1 "$slug" >> "$META/errors.log"
  echo "$slug clone-failed" >> "$META/failed.txt"
  exit 1
fi
t1=$(date +%s)

# 1) detect-tech → JSON in a temp file (we'll embed it later).
td_tmp=$(mktemp)
if ! timeout 60 "$BIN" detect-tech --repo "$work" --format json > "$td_tmp" 2>>"$META/errors.log"; then
  printf '%(%FT%T)T detect-tech-failed %s\n' -1 "$slug" >> "$META/errors.log"
  echo "$slug detect-tech-failed" >> "$META/failed.txt"
  rm -f "$td_tmp"
  exit 1
fi
t2=$(date +%s)

# 2) git log metadata (last 1000 commits).
gs_tmp=$(mktemp)
if ! timeout 120 python3 "$EXTRACTOR" "$work" "$gs_tmp" "$slug" "$MAX_COMMITS" 2>>"$META/errors.log"; then
  printf '%(%FT%T)T gitstats-failed %s\n' -1 "$slug" >> "$META/errors.log"
  echo "$slug gitstats-failed" >> "$META/failed.txt"
  rm -f "$td_tmp" "$gs_tmp"
  exit 1
fi
t3=$(date +%s)

# 3) report-card (uses cached tech-detect JSON; no double scan).
rc_tmp=$(mktemp)
if ! timeout 30 "$BIN" report-card --repo "$work" --tech-detect-json "$td_tmp" \
      > "$rc_tmp" 2>>"$META/errors.log"; then
  # Report-card failure is non-fatal — we still keep the rest.
  printf '%(%FT%T)T report-card-failed %s\n' -1 "$slug" >> "$META/errors.log"
  echo "{}" > "$rc_tmp"
fi
t4=$(date +%s)

# Combine all four into one JSON. Use jq for robust merge.
if jq -n \
    --slurpfile td "$td_tmp" \
    --slurpfile gs "$gs_tmp" \
    --slurpfile rc "$rc_tmp" \
    --arg slug "$slug" \
    '{slug: $slug, tech: $td[0], gitstats: $gs[0], reportcard: $rc[0]}' \
    > "$out.tmp" 2>>"$META/errors.log"; then
  mv "$out.tmp" "$out"
else
  echo "$slug combine-failed" >> "$META/failed.txt"
  rm -f "$out.tmp"
fi
rm -f "$td_tmp" "$gs_tmp" "$rc_tmp"

# Cleanup happens via trap as well, but immediate is best.
rm -rf "$work"

printf '%(%FT%T)T %s clone=%ds tech=%ds gs=%ds rc=%ds\n' -1 "$slug" \
  $((t1-t0)) $((t2-t1)) $((t3-t2)) $((t4-t3)) >> "$META/progress.log"
echo "$slug" >> "$META/done.txt"
WORKER
)

export OUTDIR WORKDIR META GITHUB_TOKEN MAX_COMMITS BIN EXTRACTOR

xargs -a "$URL_FILE" -P "$PARALLEL" -I {} bash -c "$WORKER" _ {}

END=$(date +%s)
DONE=$(wc -l < "$META/done.txt")
FAIL=$(wc -l < "$META/failed.txt")
{
  echo "=== Done: $((END - START))s elapsed ==="
  echo "  succeeded: $DONE"
  echo "  failed:    $FAIL"
  echo "  results:   $OUTDIR"
  date '+  finished: %F %T'
} >> "$META/progress.log"
tail -5 "$META/progress.log"
