# Sourced by every stage script. Resolves the paths the pipeline uses
# from a single target slug. Targets live entirely outside the repo
# (under $DATA_ROOT) — config + data are siblings inside one self-
# contained dir per target.
#
# Usage (from a stage script):
#   . "$(dirname "$0")/_paths.sh"
#   resolve_paths "$@"        # parses $1 as target slug, sets globals
#
# Globals exported after resolve_paths:
#   TARGET_SLUG    — e.g. "uk-gov"
#   REPORT_TYPE    — e.g. "state-of-code"
#   TARGET_ROOT    — $DATA_ROOT/<type>/<slug>/  (config + data + viewmodels)
#   DATA_ROOT      — defaults to $HOME/.repoguru-reports

resolve_paths() {
  local slug=${1:-${TARGET_SLUG:-}}
  if [ -z "$slug" ]; then
    echo "ERROR: target slug required (e.g. 'uk-gov')" >&2
    echo "       usage: $0 <target-slug>" >&2
    return 2
  fi

  local script_dir
  script_dir=$(cd "$(dirname "${BASH_SOURCE[1]}")" && pwd)
  local report_type_dir
  report_type_dir=$(cd "$script_dir/.." && pwd)

  TARGET_SLUG=$slug
  REPORT_TYPE=$(basename "$report_type_dir")
  DATA_ROOT=${DATA_ROOT:-$HOME/.repoguru-reports}
  TARGET_ROOT=$DATA_ROOT/$REPORT_TYPE/$slug

  if [ ! -d "$TARGET_ROOT" ]; then
    echo "ERROR: target not found: $TARGET_ROOT" >&2
    echo "       create it with: bash $script_dir/init.sh $slug" >&2
    return 2
  fi
  if [ ! -f "$TARGET_ROOT/target.json" ]; then
    echo "ERROR: $TARGET_ROOT/target.json not found" >&2
    return 2
  fi
  if [ ! -f "$TARGET_ROOT/orgs.txt" ]; then
    echo "ERROR: $TARGET_ROOT/orgs.txt not found" >&2
    return 2
  fi

  mkdir -p "$TARGET_ROOT"/{data/raw,data/techdetect,data/scan_meta,viewmodels}

  export TARGET_SLUG REPORT_TYPE TARGET_ROOT DATA_ROOT
}
