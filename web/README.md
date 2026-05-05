<p align="center">
  <img src="public/logo.png" alt="RepoGuru" width="200" />
</p>

<h1 align="center">RepoGuru</h1>

<p align="center"><strong>Instant report cards for GitHub repositories.</strong></p>

<p align="center">
  <a href="https://repo.guru">repo.guru</a>
</p>

RepoGuru analyzes any public GitHub repo for security, documentation, CI/CD, dependencies, code quality, licensing, and community health — then delivers a letter grade (A–F) instantly. Everything runs client-side in your browser; no data ever leaves your machine.

---

### Build & Quality

[![CI](https://github.com/levantar-ai/repoguru/actions/workflows/ci.yml/badge.svg)](https://github.com/levantar-ai/repoguru/actions/workflows/ci.yml)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=levantar-ai_repoguru&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=levantar-ai_repoguru)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=levantar-ai_repoguru&metric=coverage)](https://sonarcloud.io/summary/new_code?id=levantar-ai_repoguru)
[![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project=levantar-ai_repoguru&metric=sqale_rating)](https://sonarcloud.io/summary/new_code?id=levantar-ai_repoguru)
[![Reliability Rating](https://sonarcloud.io/api/project_badges/measure?project=levantar-ai_repoguru&metric=reliability_rating)](https://sonarcloud.io/summary/new_code?id=levantar-ai_repoguru)
[![Dependabot](https://img.shields.io/badge/Dependabot-Enabled-025e8c?logo=dependabot)](https://github.com/levantar-ai/repoguru/network/updates)

### Security

[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/levantar-ai/repoguru/badge)](https://scorecard.dev/viewer/?uri=github.com/levantar-ai/repoguru)
[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=levantar-ai_repoguru&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=levantar-ai_repoguru)
[![Vulnerabilities](https://sonarcloud.io/api/project_badges/measure?project=levantar-ai_repoguru&metric=vulnerabilities)](https://sonarcloud.io/summary/new_code?id=levantar-ai_repoguru)
[![CodeQL](https://github.com/levantar-ai/repoguru/actions/workflows/ci.yml/badge.svg)](https://github.com/levantar-ai/repoguru/actions/workflows/ci.yml)
[![Semgrep](https://img.shields.io/badge/Semgrep-Enabled-blueviolet?logo=semgrep)](https://semgrep.dev/)
[![GitGuardian](https://img.shields.io/badge/GitGuardian-Monitored-blue?logo=git)](https://www.gitguardian.com/)

### Supply Chain Security

[![SLSA 3](https://slsa.dev/images/gh-badge-level3.svg)](https://slsa.dev/)
[![Dependency Review](https://img.shields.io/badge/Dependency%20Review-Enabled-025e8c?logo=github)](https://github.com/levantar-ai/repoguru/actions/workflows/ci.yml)
[![StepSecurity](https://img.shields.io/badge/StepSecurity-Enabled-success?logo=security)](https://www.stepsecurity.io/)

### Project Info

[![Node Version](https://img.shields.io/badge/node-%3E%3D20-brightgreen?logo=node.js)](https://nodejs.org/)
[![Release](https://img.shields.io/github/v/release/levantar-ai/repoguru)](https://github.com/levantar-ai/repoguru/releases)
[![License](https://img.shields.io/github/license/levantar-ai/repoguru)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

---

## What It Does

| Capability         | Description                                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------------------- |
| **Report Card**    | Weighted scoring across 7 categories with detailed signal breakdowns                                    |
| **Git Statistics** | Commit heatmaps, punch cards, bus factor, file churn, contributor breakdown, code frequency             |
| **Tech Detection** | Detect AWS, Azure, and GCP cloud services plus Node, Python, Go, Java, PHP, Rust, and Ruby dependencies |
| **Org Scan**       | Analyze every repo in a GitHub org with aggregate scores                                                |
| **Compare**        | Side-by-side comparison of two repositories                                                             |
| **Portfolio**      | Analyze a developer's public repositories                                                               |
| **Policy Engine**  | Define custom compliance rules and evaluate repos against them                                          |
| **Export**         | CSV, Markdown, and SBOM export formats                                                                  |

> All analysis runs client-side in the browser. No backend, no data collection.

## Quick Start

```bash
git clone https://github.com/levantar-ai/repoguru.git
cd repoguru
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Usage

1. Enter a GitHub repository (e.g. `facebook/react`) in the analyzer
2. View the report card with scores across all categories
3. Explore detailed signal breakdowns and fix-it links
4. Use the Git Stats page for deep commit history analysis
5. Use Tech Detection to discover cloud services and language dependencies

## Tech Stack

| Technology                                   | Purpose        |
| -------------------------------------------- | -------------- |
| [React 19](https://react.dev)                | UI framework   |
| [TypeScript](https://www.typescriptlang.org) | Type safety    |
| [Vite](https://vite.dev)                     | Build tool     |
| [Tailwind CSS 4](https://tailwindcss.com)    | Styling        |
| [ECharts](https://echarts.apache.org)        | Charts         |
| [isomorphic-git](https://isomorphic-git.org) | In-browser git |

## Available Scripts

| Command             | Description              |
| ------------------- | ------------------------ |
| `npm run dev`       | Start dev server         |
| `npm run build`     | Type-check and build     |
| `npm run lint`      | Run ESLint               |
| `npm run format`    | Format with Prettier     |
| `npm run test`      | Run tests                |
| `npm run typecheck` | TypeScript type checking |

## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details.

## License

[MIT](LICENSE)

---

<p align="center">Powered by <a href="https://levantar.ai">levantar.ai</a></p>
