#!/usr/bin/env bash
# Stage 1 — enumerate every public repo for each org listed in the
# target's orgs.txt and emit a TSV with one row per repo.
#
# orgs.txt format (one entry per line; comments allowed):
#
#   alphagov              # bare slug → defaults to GitHub
#   github:alphagov       # explicit GitHub
#   gitlab:gitlab-org     # gitlab.com group
#   bitbucket:atlassian   # bitbucket.org workspace
#
# Output (TSV under $TARGET_ROOT/data/raw/repos.tsv):
#   platform, org, repo, clone_url, ssh_url, default_branch,
#   archived, fork, private, stars, size_kb, pushed_at.
#
# Notes:
#   • Azure DevOps is deprecating public projects, and AWS CodeCommit
#     requires authenticated access — neither is included here.
#   • GitLab/Bitbucket "size" and "stars" don't always have direct
#     equivalents; the script writes 0 / "" where missing.

set -u
. "$(dirname "$0")/_paths.sh"
resolve_paths "$@" || exit $?

ORG_FILE=${ORG_FILE:-$TARGET_ROOT/orgs.txt}
OUTDIR=$TARGET_ROOT/data/raw

if [ ! -f "$ORG_FILE" ]; then
  echo "ERROR: org file not found: $ORG_FILE" >&2
  exit 2
fi

mkdir -p "$OUTDIR"
OUT=$OUTDIR/repos.tsv
LOG=$OUTDIR/fetch.log
ERR=$OUTDIR/errors.log
SUMMARY=$OUTDIR/summary.tsv

: > "$OUT"
: > "$LOG"
: > "$ERR"
: > "$SUMMARY"

printf 'platform\torg\trepo\tclone_url\tssh_url\tdefault_branch\tarchived\tfork\tprivate\tstars\tsize_kb\tpushed_at\n' > "$OUT"
printf 'platform\torg\trepo_count\tstatus\n' > "$SUMMARY"

# ───────────────────────── per-platform enumerators ─────────────────────────

# GitHub — owner.login is the canonical org slug from the API.
GH_JQ='.[] | [
  "github",
  .owner.login,
  .name,
  .clone_url,
  .ssh_url,
  (.default_branch // ""),
  (.archived | tostring),
  (.fork | tostring),
  (.private | tostring),
  (.stargazers_count | tostring),
  (.size | tostring),
  (.pushed_at // "")
] | @tsv'

enum_github() {
  local org=$1
  if ! gh api "orgs/$org" --silent 2>>"$ERR" >/dev/null; then
    echo "  (github $org: not found / no access)" >> "$LOG"
    printf 'github\t%s\t%d\t%s\n' "$org" 0 "missing" >> "$SUMMARY"
    return 0
  fi
  local before=$(wc -l < "$OUT")
  if gh api "orgs/$org/repos?per_page=100&type=public" --paginate --jq "$GH_JQ" >> "$OUT" 2>>"$ERR"; then
    local after=$(wc -l < "$OUT"); local count=$((after - before))
    echo "  github $org: +$count repos" >> "$LOG"
    printf 'github\t%s\t%d\t%s\n' "$org" "$count" "ok" >> "$SUMMARY"
  else
    printf 'github\t%s\t%d\t%s\n' "$org" 0 "failed" >> "$SUMMARY"
  fi
}

# GitLab.com — public REST API, no auth required for public projects.
# include_subgroups=true so we capture nested groups too.
GL_JQ='.[] | [
  "gitlab",
  (.namespace.full_path // .namespace.path // ""),
  .path,
  .http_url_to_repo,
  (.ssh_url_to_repo // ""),
  (.default_branch // ""),
  (.archived | tostring),
  (if .forked_from_project then "true" else "false" end),
  "false",
  ((.star_count // 0) | tostring),
  "0",
  (.last_activity_at // "")
] | @tsv'

enum_gitlab() {
  local group=$1
  local base="https://gitlab.com/api/v4"
  # Probe — does the group exist & is it public?
  local probe
  probe=$(curl -fsS "$base/groups/$(printf %s "$group" | jq -sRr @uri)" 2>>"$ERR" || true)
  if [ -z "$probe" ]; then
    echo "  (gitlab $group: not found)" >> "$LOG"
    printf 'gitlab\t%s\t%d\t%s\n' "$group" 0 "missing" >> "$SUMMARY"
    return 0
  fi
  local before=$(wc -l < "$OUT") count=0 page=1
  while :; do
    local resp
    resp=$(curl -fsS \
      "$base/groups/$(printf %s "$group" | jq -sRr @uri)/projects?include_subgroups=true&per_page=100&page=$page&visibility=public" \
      2>>"$ERR" || true)
    [ -z "$resp" ] && break
    local items
    items=$(echo "$resp" | jq -r "$GL_JQ" 2>>"$ERR" || true)
    [ -z "$items" ] && break
    echo "$items" >> "$OUT"
    local n
    n=$(echo "$resp" | jq 'length')
    [ "$n" -eq 0 ] && break
    count=$((count + n))
    [ "$n" -lt 100 ] && break
    page=$((page + 1))
  done
  local after=$(wc -l < "$OUT")
  echo "  gitlab $group: +$((after - before)) repos (across $page pages)" >> "$LOG"
  printf 'gitlab\t%s\t%d\t%s\n' "$group" "$((after - before))" "ok" >> "$SUMMARY"
}

# Bitbucket Cloud — public REST API.
BB_JQ='.values[] | select(.is_private == false) | [
  "bitbucket",
  .workspace.slug,
  .slug,
  ((.links.clone[]? | select(.name == "https") | .href) // ""),
  ((.links.clone[]? | select(.name == "ssh") | .href) // ""),
  (.mainbranch.name // ""),
  "false",
  (if .parent then "true" else "false" end),
  "false",
  "0",
  ((.size // 0) / 1024 | floor | tostring),
  (.updated_on // "")
] | @tsv'

enum_bitbucket() {
  local ws=$1
  local base="https://api.bitbucket.org/2.0/repositories/$ws?pagelen=100&q=is_private=false"
  local before=$(wc -l < "$OUT") next=$base count=0
  while [ -n "$next" ] && [ "$next" != "null" ]; do
    local resp
    resp=$(curl -fsS "$next" 2>>"$ERR" || true)
    if [ -z "$resp" ]; then
      printf 'bitbucket\t%s\t%d\t%s\n' "$ws" 0 "missing" >> "$SUMMARY"
      echo "  (bitbucket $ws: not found / no public repos)" >> "$LOG"
      return 0
    fi
    local items
    items=$(echo "$resp" | jq -r "$BB_JQ" 2>>"$ERR" || true)
    [ -n "$items" ] && echo "$items" >> "$OUT"
    next=$(echo "$resp" | jq -r '.next // empty')
    count=$((count + 1))
    [ "$count" -ge 30 ] && break  # safety cap
  done
  local after=$(wc -l < "$OUT")
  echo "  bitbucket $ws: +$((after - before)) repos" >> "$LOG"
  printf 'bitbucket\t%s\t%d\t%s\n' "$ws" "$((after - before))" "ok" >> "$SUMMARY"
}

# ───────────────────────── dispatch ─────────────────────────

total=$(grep -cv '^[[:space:]]*#\|^[[:space:]]*$' "$ORG_FILE" || true)
i=0
while IFS= read -r line || [ -n "$line" ]; do
  # Skip blanks and comments.
  case "$line" in ''|\#*) continue ;; esac
  line=$(echo "$line" | sed 's/[[:space:]]\+#.*$//; s/^[[:space:]]\+//; s/[[:space:]]\+$//')
  [ -z "$line" ] && continue
  i=$((i + 1))

  # Parse `<platform>:<slug>` or default to GitHub.
  case "$line" in
    github:*)    platform=github;    slug=${line#github:} ;;
    gitlab:*)    platform=gitlab;    slug=${line#gitlab:} ;;
    bitbucket:*) platform=bitbucket; slug=${line#bitbucket:} ;;
    *)           platform=github;    slug=$line ;;
  esac

  echo "[$i/$total] $platform:$slug" >> "$LOG"
  case "$platform" in
    github)    enum_github "$slug" ;;
    gitlab)    enum_gitlab "$slug" ;;
    bitbucket) enum_bitbucket "$slug" ;;
  esac
done < "$ORG_FILE"

# Derived URL-only lists. Column 4 is clone_url under the new schema.
tail -n +2 "$OUT" | awk -F'\t' '{print $4}' > "$OUTDIR/clone-urls.txt"
tail -n +2 "$OUT" | awk -F'\t' '$7 == "false" && $8 == "false" {print $4}' > "$OUTDIR/clone-urls-active.txt"

total_repos=$(($(wc -l < "$OUT") - 1))
echo "DONE. $total_repos repos → $OUT" >> "$LOG"
echo "       active (non-archived, non-fork): $(wc -l < "$OUTDIR/clone-urls-active.txt")" >> "$LOG"
