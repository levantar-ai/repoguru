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
