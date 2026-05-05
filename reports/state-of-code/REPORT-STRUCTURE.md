# Generic report structure

Every target produces a report with the same skeleton. This document
captures the *generator-side* structure — the section-by-section
viewmodel contract — without committing to a particular target's
narrative voice. The narrative for a specific target lives in its own
`reports/targets/<slug>/REPORT-PLAN.md`.

## Sections produced

| # | Section | Viewmodel | What it contains |
|---|---|---|---|
| 0 | Cover / hero | `00_hero.json` | Totals, scan stats, headline strings |
| 1 | Shape of the corpus | `01_shape.json` | Top orgs, concentration, size buckets, push-year histogram, zombie ratio, extremes |
| 2 | Languages | `02_languages.json` | Top languages by repo + file count, per-org primaries |
| 3 | Frameworks & stacks | `03_frameworks.json` | Web framework distribution, per-org top tool |
| 4 | Cloud diaspora | `04_cloud.json` | AWS / Azure / GCP shares + per-cloud top services + container + IaC adoption |
| 5 | Engineering discipline | `05_engineering.json` | CI/CD + testing tools + "no CI, no tests" gaps |
| 6 | Data layer | `06_data_layer.json` | Database / ORM tooling |
| 7 | Open-source health | `07_oss_health.json` | Star distribution, most-starred, zombies, empty |
| 8 | League table | `08_league_table.json` | Per-org radar metrics (8 dimensions) |
| 9 | Headlines | `09_headlines.json` | Pre-computed pull-quote strings |
| — | Per-org appendix | `per_org/<org>.json` | One-pager per org |
| — | Provenance | `manifest.json` | Inputs, counts, generation timestamp |

## League-table radar dimensions

Each org row in `08_league_table.json` carries the 8 metrics any
designer can plot on a per-org radar chart:

| Dimension | Field | Range |
|---|---|---|
| Scale | `scale_repo_count` | total repos |
| Active scale | `scale_active_count` | non-archived, non-fork repos |
| Freshness | `freshness_pct_pushed_12mo` | % of repos pushed in last 12 months |
| CI score | `ci_score_pct` | % of scanned repos with detected CI/CD |
| Test score | `test_score_pct` | % of scanned repos with detected testing |
| Cloud breadth | `cloud_breadth` | count of {AWS, Azure, GCP} used |
| OSS share | `oss_share_starred_pct` | % of repos with at least 1 star |
| Archive ratio | `archive_ratio_pct` | % archived |
| Language diversity | `language_diversity` | distinct languages detected |

## Target customisation surface

A target supplies via `target.json`:

| Field | Where it appears |
|---|---|
| `title` | `00_hero.target.title` (cover headline) |
| `subtitle` | `00_hero.target.subtitle` (cover sub-headline) |
| `audience_label` | `00_hero.headline_strings[0]` ("…across N {audience_label}") |
| `entity_label` | `09_headlines.did_you_know` ("the largest single {entity_label} repository …") |
| `hero_blurb` | available in `target.json` for the renderer to use on the cover spread |

These are the only target-specific knobs in the engine. Everything else
flows from the data.

## Recommended part headings (for a 10-section report)

Generic, target-agnostic. Targets adapt these in their own
`REPORT-PLAN.md`:

1. **The shape of the corpus** — scale, concentration, growth
2. **Languages** — what's used, by whom
3. **Frameworks & stacks** — web, frontend, server-rendered split
4. **Cloud** — AWS / Azure / GCP, lock-in vs multi-cloud
5. **Engineering discipline** — CI / testing / dark-matter
6. **Data layer** — engines + ORMs
7. **Open-source health** — stars, zombies, empty
8. **League table** — per-org radar
9. **Headlines & did-you-knows** — the share-bait spread
10. **What this means for you** — audience-specific takeaways
