# Target template

A target is a single instance of the State-of-Code report — a list of
GitHub orgs to scan, a title, a narrative voice. Every target is
*external to this repo*. They live under `$DATA_ROOT/state-of-code/`
(default: `~/.repoguru-reports/state-of-code/`) so the data they
collect (potentially many GB of clones and scan output) can never
land in source control.

This directory is the **template**: the schema and structure a target
must follow. Use it to scaffold a new target.

## Files in a target

| File | Purpose | Required |
|---|---|---|
| `target.json` | Title, blurb, entity labels — drives the report's copy | yes |
| `orgs.txt` | One GitHub org slug per line | yes |
| `NARRATIVE.md` | Target-specific framing, predicted headlines, sensitivities | recommended |

The pipeline writes alongside these:

| Path | Contents |
|---|---|
| `data/raw/` | `repos.tsv`, clone-URL lists, fetch logs |
| `data/techdetect/<owner>/<repo>.json` | One tech-detect result per repo |
| `data/scan_meta/` | Progress / error / done / failed manifests |
| `viewmodels/` | Generated report inputs (one JSON per section) |

## Creating a new target

```bash
bash reports/state-of-code/scripts/init.sh <slug>
```

This copies the template into `$DATA_ROOT/state-of-code/<slug>/`, after
which you edit:

1. `target.json` — fill in the placeholders.
2. `orgs.txt` — drop in the GitHub org slugs you want to scan.
3. `NARRATIVE.md` — capture the angle (optional but useful).

Then run the pipeline:

```bash
bash reports/state-of-code/scripts/run_all.sh <slug>
```
