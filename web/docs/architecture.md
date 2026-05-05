# RepoGuru Architecture

## Overview

RepoGuru is a fully client-side GitHub repository analyzer built with **React 19**, **TypeScript**, and **Vite**. All analysis runs in the browser — no backend server is required. The app fetches repository data via the GitHub API and runs scoring, visualization, and detection engines locally.

## Analysis Pipeline

```
User Input (owner/repo)
    │
    ▼
Fetch Repo Info ──► GitHub API /repos/{owner}/{repo}
    │
    ▼
Fetch File Tree ──► GitHub API /git/trees/{sha}?recursive=1
    │
    ▼
Filter Target Files ──► ~25 files (README, LICENSE, CI configs, manifests, etc.)
    │
    ▼
Fetch File Contents ──► GitHub API /contents/{path}
    │
    ▼
Run Analyzers ──► 7 category analyzers in parallel
    │
    ▼
Compute Score ──► Weighted average → Letter Grade (A-F)
```

## Scoring System

Seven categories contribute to the overall score:

| Category      | Weight | What It Checks                                                 |
| ------------- | ------ | -------------------------------------------------------------- |
| Documentation | 20%    | README quality, CONTRIBUTING, CHANGELOG, API docs              |
| Security      | 15%    | SECURITY.md, CODEOWNERS, Dependabot, branch protection signals |
| CI/CD         | 15%    | GitHub Actions workflows, CI config files                      |
| Dependencies  | 15%    | Lock files, outdated dependency signals, manifest presence     |
| Code Quality  | 15%    | Linter configs, formatter configs, TypeScript, EditorConfig    |
| License       | 10%    | LICENSE file presence and type                                 |
| Community     | 10%    | Code of Conduct, issue templates, PR templates, FUNDING        |

Grades: **A** (85+), **B** (70-84), **C** (55-69), **D** (40-54), **F** (<40)

## Git Stats Pipeline

The Git Stats feature clones repositories directly in the browser using **isomorphic-git** and a Web Worker:

```
Clone Repo (in-browser via isomorphic-git)
    │
    ▼
Extract Commits ──► Walk git log (up to 1,000 commits)
    │
    ▼
Extract Details ──► File changes, additions, deletions per commit
    │
    ▼
Compute Analytics ──► Contributors, bus factor, file churn, commit patterns,
                      weekday/month/year distributions, file coupling, etc.
    │
    ▼
Render Charts ──► ECharts + D3.js visualizations
```

## Tech Detection Pipeline

```
Fetch File Tree ──► GitHub API
    │
    ▼
Filter Tech Files ──► Up to 60 relevant files (manifests, IaC, source)
    │
    ▼
Fetch Contents ──► Parallel content fetching
    │
    ▼
Run Detectors:
  ├── AWS (SDK v3, SDK v2, boto3, CloudFormation, Terraform, CDK)
  ├── Azure (Terraform azurerm, ARM templates, Bicep, npm SDK, Python SDK)
  ├── GCP (Terraform google, npm SDK, Python SDK)
  ├── Node (package.json)
  ├── Python (requirements.txt, pyproject.toml, Pipfile, setup.py/cfg)
  ├── Go (go.mod)
  ├── Java (pom.xml, build.gradle)
  ├── PHP (composer.json)
  ├── Rust (Cargo.toml)
  └── Ruby (Gemfile)
```

## Key Technologies

| Technology      | Purpose                                              |
| --------------- | ---------------------------------------------------- |
| React 19        | UI framework                                         |
| TypeScript 5.9  | Type safety                                          |
| Vite 7          | Build tool and dev server                            |
| Tailwind CSS 4  | Utility-first styling                                |
| ECharts 6       | Interactive charts and visualizations                |
| D3.js 7         | Data visualization (word clouds, specialized charts) |
| isomorphic-git  | Pure JS git implementation for browser               |
| IndexedDB (idb) | Client-side persistence for history, settings, cache |
| Mermaid         | Diagram rendering                                    |

## Directory Structure

```
src/
├── components/     # React components organized by feature
├── context/        # React Context providers (App, Analysis)
├── hooks/          # Custom React hooks
├── pages/          # Page-level components
├── services/       # Business logic
│   ├── analysis/   # Scoring and detection engines
│   ├── export/     # CSV, Markdown, SBOM exporters
│   ├── git/        # Git clone and extraction (Web Worker)
│   ├── github/     # GitHub API client
│   ├── llm/        # LLM integration
│   └── persistence/# IndexedDB storage
├── types/          # TypeScript type definitions
└── utils/          # Shared utilities
```
