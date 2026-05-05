# Reports

Pipelines for marketing-style "State of …" reports built on real
public repository data, served from this repo.

Each subdirectory here is a **report type** — a self-contained
generator (its own scripts, plan, and structure) that can be pointed
at any number of organisation lists ("targets") to produce the same
shape of output.

## Report types

| Type | Description |
|---|---|
| [`state-of-code/`](./state-of-code/) | Modelled on Google's *State of DevOps* / GitHub's *Octoverse* — enumerates GitHub orgs, scans each repo with `repoanalyze detect-tech`, aggregates into per-section view-models for the report layout. |

## Where the data lives

The repo holds **only** the engine, the report plans, and per-target
configuration (`target.json` + `orgs.txt`). All collected data — repo
metadata, tech-detect JSONs, scan logs, derived view-models — is
written **outside the repo**, under:

```
$DATA_ROOT/<report-type>/<target-slug>/
```

`DATA_ROOT` defaults to `~/.repoguru-reports/`. Override with the env
var if you want it elsewhere.

This separation means:
- Source control sees only generator + config — small, reviewable,
  diff-friendly.
- A 50 GB scan of a fresh target can never accidentally land in a
  commit.
- Two checkouts of the repo can share the same data cache.

The top-level `.gitignore` here also defensively excludes `data/` and
`viewmodels/` directories anywhere under `reports/`, so even if
something writes inside the repo by mistake it stays untracked.
