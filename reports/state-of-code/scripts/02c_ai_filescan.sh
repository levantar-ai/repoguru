#!/usr/bin/env bash
# Stage 2c — detect AI-assistant tooling files across the corpus by
# shallow-cloning each active repo and checking for known config paths.
#
# This is the right shape: cloning is rate-limit-free (only abuse-
# detection at very high concurrency), so we get every repo without
# hitting any API quota. ~10–20 min wall-clock for 11.5k repos at
# parallel=16 — same shape as stage 2 (techdetect).
#
# Inputs:
#   $1            — target slug
#   PARALLEL      — concurrent workers (default: 16)
#   GITHUB_TOKEN  — auth (falls back to `gh auth token`)
#
# Output:
#   $TARGET_ROOT/data/ai_filescan/repos/<owner>/<repo>.json — per-repo
#   $TARGET_ROOT/data/ai_filescan_meta/{progress,errors,done,failed}.{log,txt}

set -uo pipefail
. "$(dirname "$0")/_paths.sh"
resolve_paths "$@" || exit $?

URL_FILE=${URL_FILE:-$TARGET_ROOT/data/raw/clone-urls-active.txt}
PARALLEL=${PARALLEL:-16}
OUTDIR=$TARGET_ROOT/data/ai_filescan/repos
META=$TARGET_ROOT/data/ai_filescan_meta
WORKDIR=$TARGET_ROOT/data/_work_aiscan

if [ -z "${GITHUB_TOKEN:-}" ]; then
  GITHUB_TOKEN=$(gh auth token 2>/dev/null || true)
fi
if [ ! -f "$URL_FILE" ]; then
  echo "ERROR: URL file not found: $URL_FILE" >&2
  exit 2
fi

# Hard-clean any prior leftover workspace before starting — even if a
# previous run was killed, the workspace shouldn't persist.
if [ -d "$WORKDIR" ]; then
  rm -rf "$WORKDIR"
fi
mkdir -p "$OUTDIR" "$META" "$WORKDIR"
: >> "$META/progress.log"
: >> "$META/errors.log"
: >> "$META/done.txt"
: >> "$META/failed.txt"

START=$(date +%s)
TOTAL=$(grep -cv '^$' "$URL_FILE")
echo "=== AI filescan starting: $TOTAL urls, parallel=$PARALLEL ===" >> "$META/progress.log"

# Self-contained worker — checks for AI tooling files and emits JSON.
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

# Belt-and-braces cleanup: any exit path (including a crash, SIGTERM,
# parent script being killed) wipes the worktree. The original
# `rm -rf "$work"` lines remain as immediate cleanup on the happy path.
trap 'rm -rf "$work" 2>/dev/null' EXIT INT TERM

auth_url=$url
if [ -n "${GITHUB_TOKEN:-}" ]; then
  auth_url=${url/https:\/\//https://x-access-token:$GITHUB_TOKEN@}
fi

if ! GIT_TERMINAL_PROMPT=0 git clone --depth=1 --no-tags --single-branch --quiet \
      "$auth_url" "$work" >/dev/null 2>>"$META/errors.log"; then
  printf '%(%FT%T)T clone-failed %s\n' -1 "$slug" >> "$META/errors.log"
  echo "$slug clone-failed" >> "$META/failed.txt"
  rm -rf "$work"
  exit 1
fi

# Build a JSON record of which AI-tooling paths exist in the working tree.
exists() { [ -e "$work/$1" ] && echo true || echo false; }
count_files() { find "$work/$1" -type f 2>/dev/null | wc -l; }

claude_md=$(exists CLAUDE.md)
agents_md=$(exists AGENTS.md)
copilot_md=$(exists .github/copilot-instructions.md)
cursorrules=$(exists .cursorrules)
cursor_dir=$(exists .cursor)
claude_dir=$(exists .claude)
claude_agents=$(count_files .claude/agents)
claude_skills=$(count_files .claude/skills)
aider=$(exists .aider.conf.yml)
windsurf=$(exists .windsurfrules)
cline=$(exists .clinerules)
continue_dir=$(exists .continue)

cat >"$out" <<EOF
{"slug":"$slug","claude_md":$claude_md,"agents_md":$agents_md,"copilot_instructions":$copilot_md,"cursorrules":$cursorrules,"cursor_dir":$cursor_dir,"claude_dir":$claude_dir,"claude_agents_files":$claude_agents,"claude_skills_files":$claude_skills,"aider_conf":$aider,"windsurfrules":$windsurf,"clinerules":$cline,"continue_dir":$continue_dir}
EOF

rm -rf "$work"
echo "$slug" >> "$META/done.txt"
WORKER
)

export OUTDIR WORKDIR META GITHUB_TOKEN

xargs -a "$URL_FILE" -P "$PARALLEL" -I {} bash -c "$WORKER" _ {}

END=$(date +%s)
DONE=$(wc -l < "$META/done.txt")
FAIL=$(wc -l < "$META/failed.txt")
{
  echo "=== Done: $((END - START))s elapsed ==="
  echo "  succeeded: $DONE"
  echo "  failed:    $FAIL"
} >> "$META/progress.log"
tail -3 "$META/progress.log"
