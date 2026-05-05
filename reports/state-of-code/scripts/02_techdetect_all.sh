#!/usr/bin/env bash
# Stage 2 — tech-detect every repo in the target's clone-urls list.
#
# Per repo: shallow clone → detect-tech → write JSON → delete clone.
# Streaming model: max N repos in flight, peak disk usage stays small.
# Idempotent: rerunning skips repos whose JSON already exists, so a
# crash or Ctrl-C is just "rerun, picks up where it left off".
#
# Inputs:
#   $1            — target slug (e.g. "uk-gov")
#   PARALLEL      — concurrent workers (default: 16; cap ~30 to dodge
#                   GitHub abuse-detection)
#   BIN           — path to repoanalyze binary
#   GITHUB_TOKEN  — auth for higher per-IP rate; pulls from `gh` if unset
#
# Outputs (under $TARGET_ROOT):
#   data/techdetect/<owner>/<repo>.json — one tech-detect JSON per repo
#   data/scan_meta/progress.log         — per-repo timing + final summary
#   data/scan_meta/errors.log           — clone/scan failures
#   data/scan_meta/done.txt             — slugs that succeeded
#   data/scan_meta/failed.txt           — slugs that failed (audit / retry)

set -uo pipefail
. "$(dirname "$0")/_paths.sh"
resolve_paths "$@" || exit $?

URL_FILE=${URL_FILE:-$TARGET_ROOT/data/raw/clone-urls-active.txt}
PARALLEL=${PARALLEL:-16}
REPO_ROOT=$(cd "$(dirname "$0")/../../.." && pwd)
BIN=${BIN:-$REPO_ROOT/cli/target/release/repoanalyze}
OUTDIR=$TARGET_ROOT/data/techdetect
META=$TARGET_ROOT/data/scan_meta
WORKDIR=$TARGET_ROOT/data/_work

if [ -z "${GITHUB_TOKEN:-}" ]; then
  GITHUB_TOKEN=$(gh auth token 2>/dev/null || true)
fi
if [ -z "${GITHUB_TOKEN:-}" ]; then
  echo "WARN: no GITHUB_TOKEN — clones will use anonymous rate limit" >&2
fi

if [ ! -x "$BIN" ]; then
  echo "ERROR: binary not found at $BIN" >&2
  echo "       build it with: cargo build --release --bin repoanalyze" >&2
  echo "       (from $REPO_ROOT/cli/)" >&2
  exit 2
fi
if [ ! -f "$URL_FILE" ]; then
  echo "ERROR: URL file not found: $URL_FILE" >&2
  echo "       run stage 1 first: 01_enumerate_repos.sh $TARGET_SLUG" >&2
  exit 2
fi

mkdir -p "$OUTDIR" "$META" "$WORKDIR"
: >> "$META/progress.log"
: >> "$META/errors.log"
: >> "$META/done.txt"
: >> "$META/failed.txt"

START=$(date +%s)
TOTAL=$(grep -cv '^$' "$URL_FILE")
echo "=== Tech-detect run starting: $TOTAL urls, parallel=$PARALLEL ===" >> "$META/progress.log"

process_one() {
  local url="$1"
  local slug
  slug=$(echo "$url" | sed -E 's|^https?://github\.com/||; s|\.git$||')
  local owner="${slug%%/*}"
  local name="${slug#*/}"
  local out="$OUTDIR/$owner/$name.json"
  local work
  work="$WORKDIR/$$-$owner-$name"

  if [ -s "$out" ]; then
    return 0
  fi

  mkdir -p "$OUTDIR/$owner"
  rm -rf "$work"

  local auth_url="$url"
  if [ -n "${GITHUB_TOKEN:-}" ]; then
    auth_url="${url/https:\/\//https://x-access-token:$GITHUB_TOKEN@}"
  fi

  local t0 t1 t2 ec=0
  t0=$(date +%s)
  if ! GIT_TERMINAL_PROMPT=0 git clone \
        --depth=1 --no-tags --single-branch --quiet \
        "$auth_url" "$work" >/dev/null 2>>"$META/errors.log"; then
    {
      printf '%(%FT%T)T clone-failed %s\n' -1 "$slug"
    } >> "$META/errors.log"
    echo "$slug clone-failed" >> "$META/failed.txt"
    rm -rf "$work"
    return 1
  fi
  t1=$(date +%s)

  if ! "$BIN" detect-tech --repo "$work" --format json \
        > "$out.tmp" 2>>"$META/errors.log"; then
    {
      printf '%(%FT%T)T scan-failed %s\n' -1 "$slug"
    } >> "$META/errors.log"
    echo "$slug scan-failed" >> "$META/failed.txt"
    rm -f "$out.tmp"
    rm -rf "$work"
    return 1
  fi
  mv "$out.tmp" "$out"
  t2=$(date +%s)

  rm -rf "$work"
  printf '%(%FT%T)T %s clone=%ds scan=%ds\n' -1 "$slug" $((t1-t0)) $((t2-t1)) \
    >> "$META/progress.log"
  echo "$slug" >> "$META/done.txt"
  return $ec
}

export -f process_one
export BIN OUTDIR WORKDIR META GITHUB_TOKEN

xargs -a "$URL_FILE" -P "$PARALLEL" -I {} bash -c 'process_one "$@"' _ {}

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
