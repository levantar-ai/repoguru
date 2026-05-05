#!/usr/bin/env bash
# Scaffold a new target by copying the template into $DATA_ROOT.
#
# Usage:
#   bash reports/state-of-code/scripts/init.sh <slug>
#
# After running, edit:
#   $DATA_ROOT/state-of-code/<slug>/target.json
#   $DATA_ROOT/state-of-code/<slug>/orgs.txt
#   $DATA_ROOT/state-of-code/<slug>/NARRATIVE.md (optional)
#
# Then run the pipeline:
#   bash reports/state-of-code/scripts/run_all.sh <slug>

set -uo pipefail

slug=${1:-}
if [ -z "$slug" ]; then
  echo "ERROR: target slug required" >&2
  echo "       usage: $0 <slug>" >&2
  exit 2
fi

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
REPORT_TYPE_DIR=$(cd "$SCRIPT_DIR/.." && pwd)
REPORT_TYPE=$(basename "$REPORT_TYPE_DIR")
TEMPLATE_DIR=$REPORT_TYPE_DIR/target-template

DATA_ROOT=${DATA_ROOT:-$HOME/.repoguru-reports}
TARGET_ROOT=$DATA_ROOT/$REPORT_TYPE/$slug

if [ -d "$TARGET_ROOT" ]; then
  if [ -f "$TARGET_ROOT/target.json" ]; then
    echo "ERROR: target already exists at $TARGET_ROOT" >&2
    echo "       (target.json present — refusing to overwrite)" >&2
    exit 2
  fi
fi

mkdir -p "$TARGET_ROOT"
# Copy the template files but skip the template's README — that's
# documentation for the template, not for an instantiated target.
for f in target.json orgs.txt NARRATIVE.md; do
  if [ -f "$TEMPLATE_DIR/$f" ]; then
    cp "$TEMPLATE_DIR/$f" "$TARGET_ROOT/$f"
  fi
done

# Replace <slug> placeholders with the actual slug name.
if command -v sed >/dev/null; then
  for f in target.json NARRATIVE.md; do
    [ -f "$TARGET_ROOT/$f" ] && sed -i "s|<slug>|$slug|g; s|<target slug>|$slug|g" "$TARGET_ROOT/$f"
  done
fi

cat <<EOF
Target scaffolded at: $TARGET_ROOT

Next steps:
  1. Edit $TARGET_ROOT/target.json — fill in title, blurb, entity_label.
  2. Edit $TARGET_ROOT/orgs.txt — add one GitHub org slug per line.
  3. (Optional) Edit $TARGET_ROOT/NARRATIVE.md — capture the angle.

Then run:
  bash $SCRIPT_DIR/run_all.sh $slug
EOF
