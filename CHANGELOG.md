## [0.3.4](https://github.com/levantar-ai/repoguru/compare/v0.3.3...v0.3.4) (2026-02-22)

### Bug Fixes

- paginate user repo fetches in PortfolioPage and org service ([87bc42b](https://github.com/levantar-ai/repoguru/commit/87bc42bf21c9c91c132d7673b49737924f838bea))

## [0.3.3](https://github.com/levantar-ai/repoguru/compare/v0.3.2...v0.3.3) (2026-02-22)

### Bug Fixes

- paginate org repo fetches to return all repos ([d69b2cb](https://github.com/levantar-ai/repoguru/commit/d69b2cbf2ba2ea425f2d2b7ec14777ba087cbe58))

## [0.3.2](https://github.com/levantar-ai/repoguru/compare/v0.3.1...v0.3.2) (2026-02-22)

### Bug Fixes

- move SLSA provenance into CI pipeline after release ([cec1ddf](https://github.com/levantar-ai/repoguru/commit/cec1ddf7b5eeb042474a46701458656ac8b25834))
- remove ZAP baseline scan (passive-only, no XSS detection) ([238b9aa](https://github.com/levantar-ai/repoguru/commit/238b9aa725f97a3c8fbbbfb8afbcea9311650266))

## [0.3.1](https://github.com/levantar-ai/repoguru/compare/v0.3.0...v0.3.1) (2026-02-22)

### Bug Fixes

- trigger SLSA provenance on release event and fix subject format ([4a25a00](https://github.com/levantar-ai/repoguru/commit/4a25a00f6156e99953f9e8461cb5897764c0668a))

# [0.3.0](https://github.com/levantar-ai/repoguru/compare/v0.2.0...v0.3.0) (2026-02-22)

### Bug Fixes

- correct typecheck error in analytics test and eslint ignores ([c413f7c](https://github.com/levantar-ai/repoguru/commit/c413f7ceb75c17a8194460e08e12c9a3e69a3ab0))
- lower coverage thresholds and format index.html ([3160089](https://github.com/levantar-ai/repoguru/commit/3160089c16b2ca083ef167b23933c2db4dd92df7))

### Features

- add CI quality gates, conventional commits, and OAuth ([563ef14](https://github.com/levantar-ai/repoguru/commit/563ef14541917cf08411ba0acc083373f76e4792))
- add DAST/fuzzing gates with fast-check and OWASP ZAP ([ce2cfbc](https://github.com/levantar-ai/repoguru/commit/ce2cfbc9bf04063aa41b9fbf1ceb91596387bc74))

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Repository report card analysis with letter grades (A-F)
- Seven scoring categories: Documentation, Security, CI/CD, Dependencies, Code Quality, License, Community
- Git statistics with interactive visualizations (commit heatmap, punch card, bus factor, code frequency, etc.)
- Technology detection for AWS, Azure, GCP cloud services and language dependencies (Node, Go, Java, PHP, Rust, Ruby, Python)
- Organization-wide scanning with aggregate scores
- Side-by-side repository comparison
- Developer portfolio analysis
- Policy engine for custom compliance rules
- Commits by weekday, month, year, and file extension charts
- File coupling analysis (co-changed files)
- Multiple export formats (CSV, Markdown, SBOM)
- Dark/light theme support
- CI pipeline with linting, type checking, testing, and security scanning
- Open source foundation: LICENSE, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY
