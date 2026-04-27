# RepoGuru

**Analyze any GitHub repository in seconds — entirely in your browser.**

RepoGuru is a suite of independent analysis tools that clone and scan repositories locally in your browser using WebAssembly-powered git. No servers process your code. Nothing leaves your machine.

---

## Tools

### Report Card

Grade any repository across 8 categories: security, documentation, CI/CD, dependencies, code quality, community health, licensing, and contributor patterns. Get an instant A–F letter grade with actionable recommendations.

### Tech Stack Detector

Discover every technology in a repository — languages, frameworks, databases, cloud services (AWS/Azure/GCP), CI/CD pipelines, testing tools, and all package dependencies. Supports Python, Node.js, Go, Java, PHP, Rust, and Ruby ecosystems.

### Git History Stats

Visualize commit history, contributor activity, code churn, and development velocity with interactive charts. Identify bus factor risks, weekend warriors, and contribution patterns over time.

### Org Scanner

Scan an entire GitHub organization at once. Get letter grades for every repository in a sortable, filterable dashboard.

### Portfolio View

Aggregate multiple repositories into a single portfolio health overview.

### Compare

Put two repositories side by side and compare their scores across all categories.

### Discover

Browse trending and notable repositories with one-click analysis.

---

## Why sign in?

Signing in with GitHub grants RepoGuru **read-only** access so you can:

- **Analyze private repositories** — clone and scan repos only you have access to
- **Browse your repo list** — pick any repo from your account or orgs with one click
- **80x higher rate limits** — 5,000 requests/hour vs 60 unauthenticated

Public repositories work without signing in.

## Permissions

| Permission          | Access    | Why                           |
| ------------------- | --------- | ----------------------------- |
| Repository contents | Read-only | Clone and analyze source code |
| Repository metadata | Read-only | List your repositories        |

RepoGuru **never writes** to your repositories. No webhooks. No background access. Your token is stored locally in your browser and only used when you actively run an analysis.

## Privacy

- All analysis runs **client-side** in your browser
- Source code is **never sent to any server**
- No telemetry on your code contents
- Token stored via the browser Credential Management API with IndexedDB fallback

[Privacy Policy](https://repo.guru/policy) · [Website](https://repo.guru)
