## [0.11.4](https://github.com/levantar-ai/repoguru/compare/v0.11.3...v0.11.4) (2026-04-10)

### Bug Fixes

- share object cache across all diffs — 63× speedup on large repos ([e2c7fca](https://github.com/levantar-ai/repoguru/commit/e2c7fca897f5704c61a6735b2537223fb69b191a))

## [0.11.3](https://github.com/levantar-ai/repoguru/compare/v0.11.2...v0.11.3) (2026-04-09)

### Bug Fixes

- rewrite diffCommit with native tree diff to restore diffing speed ([e2b4a8e](https://github.com/levantar-ai/repoguru/commit/e2b4a8e6a31ba0e7d20e59fcfc1c84adb47689ec))

### Reverts

- remove checkpoint/resume system ([37a6823](https://github.com/levantar-ai/repoguru/commit/37a6823d47910e74d3ed6a66917532b065299823))

## [0.11.2](https://github.com/levantar-ai/repoguru/compare/v0.11.1...v0.11.2) (2026-04-07)

### Bug Fixes

- revert batch size to 25, checkpoint every 4th batch ([fa8b236](https://github.com/levantar-ai/repoguru/commit/fa8b236bfa05be1046a31050595c0f80628abc7e))

## [0.11.1](https://github.com/levantar-ai/repoguru/compare/v0.11.0...v0.11.1) (2026-04-07)

### Bug Fixes

- handle 401 by clearing expired token and prompting reconnect ([f3c2a3a](https://github.com/levantar-ai/repoguru/commit/f3c2a3a7263da0742340603b391b5143a11a4125))

# [0.11.0](https://github.com/levantar-ai/repoguru/compare/v0.10.0...v0.11.0) (2026-04-07)

### Features

- add context-aware GA4 custom events ([7adadf6](https://github.com/levantar-ai/repoguru/commit/7adadf6fa9c61bb4d203daf88c7723316aee503f))

# [0.10.0](https://github.com/levantar-ai/repoguru/compare/v0.9.0...v0.10.0) (2026-04-07)

### Bug Fixes

- update vite to patch path traversal vulnerability ([0b5b3a3](https://github.com/levantar-ai/repoguru/commit/0b5b3a3974c6ce09679a9355b3bde7cb868712c3))

### Features

- add checkpoint/resume and speed up diffing ([34cc520](https://github.com/levantar-ai/repoguru/commit/34cc520b365f6679dafc617541f97ed742a90799))

# [0.9.0](https://github.com/levantar-ai/repoguru/compare/v0.8.1...v0.9.0) (2026-04-06)

### Bug Fixes

- use localeCompare for string sorts (SonarCloud S2871) ([cc53805](https://github.com/levantar-ai/repoguru/commit/cc5380597cfa0473d540c59e6b3c751bccfb721b))

### Features

- add 26 new visualizations to match CLI report output ([3831d9a](https://github.com/levantar-ai/repoguru/commit/3831d9a6e18bca51826ec727bddff18d63118a4f))

## [0.8.1](https://github.com/levantar-ai/repoguru/compare/v0.8.0...v0.8.1) (2026-04-05)

### Bug Fixes

- handle GitHub App installation callback and fix refresh ([0b64c74](https://github.com/levantar-ai/repoguru/commit/0b64c74cd431f6fa86c6c04f9d359ca34f590047))

# [0.8.0](https://github.com/levantar-ai/repoguru/compare/v0.7.0...v0.8.0) (2026-04-05)

### Features

- auto-open org picker after first GitHub sign-in ([0846d12](https://github.com/levantar-ai/repoguru/commit/0846d12594a9037f5b8f1d5a9c698b7d1207fd51))

# [0.7.0](https://github.com/levantar-ai/repoguru/compare/v0.6.0...v0.7.0) (2026-04-05)

### Bug Fixes

- downgrade mermaid to v10 to resolve high-severity audit findings ([205625a](https://github.com/levantar-ai/repoguru/commit/205625a8673d8f5c826ea5ae2c01a1a4898ef763)), closes [hi#severity](https://github.com/hi/issues/severity)
- npm audit fix — resolve dependency vulnerabilities ([04346ee](https://github.com/levantar-ai/repoguru/commit/04346ee000d4a9e05fc9b5a42723b9bf1ef9c910))
- resolve TS error in useMyRepos onRate callback type ([5c67225](https://github.com/levantar-ai/repoguru/commit/5c67225e97b2650b43a62825e85d9ee377ec4fdb))

### Features

- add GitHub App installation flow for org-level access control ([8fc89c4](https://github.com/levantar-ai/repoguru/commit/8fc89c48285a8d44e2ae9726cc5d07d3f73a0c7e))

# [0.6.0](https://github.com/levantar-ai/repoguru/compare/v0.5.0...v0.6.0) (2026-02-23)

### Bug Fixes

- **oauth:** request repo and read:org scopes ([ab0d409](https://github.com/levantar-ai/repoguru/commit/ab0d4096c7a55bc3fa0c776bdf724269501349db))

### Features

- **compare:** add separate RepoPicker for each repo slot ([df74ce1](https://github.com/levantar-ai/repoguru/commit/df74ce1f34d5832ef601001602144f5097a1ebda))

# [0.5.0](https://github.com/levantar-ai/repoguru/compare/v0.4.2...v0.5.0) (2026-02-22)

### Features

- **compare:** add RepoPicker to compare page ([5f57c88](https://github.com/levantar-ai/repoguru/commit/5f57c88a47a1de5d3ed3e24b4adcbb8ec373d29b))

## [0.4.2](https://github.com/levantar-ai/repoguru/compare/v0.4.1...v0.4.2) (2026-02-22)

### Bug Fixes

- **ci:** inject VITE\_ env vars during build step ([810a344](https://github.com/levantar-ai/repoguru/commit/810a3444c15204013e0aa68df0617f84d13eed58))

## [0.4.1](https://github.com/levantar-ai/repoguru/compare/v0.4.0...v0.4.1) (2026-02-22)

### Bug Fixes

- use proxy.repo.guru custom domain for CORS proxy ([939002e](https://github.com/levantar-ai/repoguru/commit/939002efce7dcec48e102031a91cf14b4bb80a17))

# [0.4.0](https://github.com/levantar-ai/repoguru/compare/v0.3.4...v0.4.0) (2026-02-22)

### Bug Fixes

- stop filtering out archived repos and forks from org scan ([17271c9](https://github.com/levantar-ai/repoguru/commit/17271c9bef76b7485d3907e186f9e6bec08790a3))

### Features

- preserve page state across navigation with display:none ([b934550](https://github.com/levantar-ai/repoguru/commit/b93455037773f73fe0cd2504865720bb0855a5aa))

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
