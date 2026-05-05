# State-of-Code report

A reusable pipeline that generates marketing-style "State of Code"
reports (modelled on Google's *State of DevOps*, GitHub's *Octoverse*)
by enumerating a list of GitHub organisations, scanning every public
repo with `repoanalyze detect-tech`, and aggregating the results into
structured view-models a designer or report renderer can consume.

Nothing about *which* set of organisations is being analysed lives in
this directory. **Targets live entirely outside the repo** — under
`$DATA_ROOT/state-of-code/<slug>/` (default
`~/.repoguru-reports/state-of-code/<slug>/`). The repo holds only the
engine and a target template.

## Layout (in repo)

```
state-of-code/
├── README.md                  ← this file
├── REPORT-PLAN.md             ← generic plan (peer reports, structure, sequencing)
├── REPORT-STRUCTURE.md        ← view-model contract (per-section schema)
├── target-template/           ← schema + placeholder files for a new target
│   ├── README.md
│   ├── target.json
│   ├── orgs.txt
│   └── NARRATIVE.md
└── scripts/                   ← the pipeline (target-agnostic)
    ├── _paths.sh              ← target-path resolution
    ├── init.sh                ← scaffold a new target from the template
    ├── 01_enumerate_repos.sh
    ├── 02_techdetect_all.sh
    ├── 03_build_viewmodels.py
    └── run_all.sh
```

## Layout (per target, outside repo)

```
$DATA_ROOT/state-of-code/<slug>/      ← e.g. ~/.repoguru-reports/state-of-code/uk-gov/
├── target.json                       ← config: title, blurb, entity_label
├── orgs.txt                          ← input: GitHub org slugs
├── NARRATIVE.md                      ← target-specific framing notes
├── data/
│   ├── raw/                          ← repos.tsv + clone-URL lists
│   ├── techdetect/<owner>/<repo>.json
│   └── scan_meta/                    ← progress.log, errors.log, done/failed
└── viewmodels/
    ├── 00_hero.json … 09_headlines.json
    ├── per_org/<org>.json
    └── manifest.json
```

## Creating a new target

```bash
bash reports/state-of-code/scripts/init.sh <slug>
```

This copies the template into `$DATA_ROOT/state-of-code/<slug>/`. Then
edit:

1. `target.json` — fill in title, blurb, entity_label.
2. `orgs.txt` — drop in the GitHub org slugs you want to scan.
3. `NARRATIVE.md` — capture the angle (optional but useful).

## Running an existing target

```bash
# end-to-end (~35 min for ~10k repos)
bash reports/state-of-code/scripts/run_all.sh <slug>

# rebuild only the view-models (~10s, useful when iterating)
SKIP_ENUM=1 SKIP_TECHDETECT=1 \
  bash reports/state-of-code/scripts/run_all.sh <slug>
```

### Stage-by-stage

| Stage | Time | Inputs | Outputs |
|---|---|---|---|
| 1 — enumerate | ~3-5 min | `<slug>/orgs.txt` | `<slug>/data/raw/repos.tsv` + URL lists |
| 2 — tech-detect | ~30 min | `<slug>/data/raw/clone-urls-active.txt` | `<slug>/data/techdetect/<owner>/<repo>.json` |
| 3 — build viewmodels | <30 s | `<slug>/data/raw/`, `<slug>/data/techdetect/`, `<slug>/data/scan_meta/` | `<slug>/viewmodels/*.json` |

All three are idempotent.

## Configurable env vars

| Variable | Default | Used by |
|---|---|---|
| `DATA_ROOT` | `$HOME/.repoguru-reports` | all stages (where targets live) |
| `PARALLEL` | `16` | stage 2 (cap ~30 to dodge GitHub abuse limits) |
| `BIN` | repo's `target/release/repoanalyze` | stage 2 |
| `GITHUB_TOKEN` | falls back to `gh auth token` | stages 1, 2 |
| `SKIP_ENUM` / `SKIP_TECHDETECT` / `SKIP_VIEWMODELS` | unset | `run_all.sh` |

## Prerequisites

- `gh` CLI authenticated (`gh auth status` — needs `read:org`,
  `repo`).
- The `repoanalyze` Rust binary built:
  ```bash
  cd cli && cargo build --release --bin repoanalyze
  ```
- `git`, `python3` (3.10+, stdlib only — no pip deps).
- ~1 GB free disk during the scan; ~70 MB after cleanup per target.
