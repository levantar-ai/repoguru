# RepoGuru Desktop Platform — Architecture

## System Overview

```
┌────────────────────────────────────────────────────────────────┐
│                    Electron Desktop App                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              React + TypeScript Frontend                  │  │
│  │  Dashboard │ ReportCard │ GitStats │ TechDetect          │  │
│  │  Compare   │ OrgScan   │ Policy   │ Settings             │  │
│  └──────────────────┬───────────────────────────────────────┘  │
│                     │ IPC (contextBridge)                       │
│  ┌──────────────────┴───────────────────────────────────────┐  │
│  │              Electron Main Process                        │  │
│  │  process-manager.ts │ grpc-bridge.ts │ auto-updater.ts   │  │
│  └──────────────────┬───────────────────────────────────────┘  │
└─────────────────────┼──────────────────────────────────────────┘
                      │ gRPC (localhost, @grpc/grpc-js)
┌─────────────────────┴──────────────────────────────────────────┐
│                   Rust Binary (repoanalyze serve)              │
│  ┌──────────┐ ┌──────────┐ ┌────────┐ ┌────────┐ ┌─────────┐ │
│  │ Pipeline │ │ Scoring  │ │ Policy │ │  SBOM  │ │ Export  │ │
│  │ (scan)   │ │ (8 cats) │ │ Engine │ │ (CDX)  │ │ (CSV…) │ │
│  ├──────────┤ ├──────────┤ ├────────┤ ├────────┤ ├─────────┤ │
│  │ TechDet  │ │ OrgScan  │ │Compare │ │ gRPC   │ │  Model  │ │
│  └──────┬───┘ └──────────┘ └────────┘ │ Server │ └─────────┘ │
│         │                              └────┬───┘             │
│         └───────── gix ─────────────────────┘                 │
└─────────────────────┼──────────────────────────────────────────┘
                      │
              Git Repository (local)
```

## Communication Protocol

### Electron → Rust IPC

1. **Electron main process** spawns `repoanalyze serve --listen [::1]:0` (OS-assigned port)
2. Rust binary prints `LISTENING ON [::1]:<port>` to stdout on startup
3. Main process reads the port, creates a `@grpc/grpc-js` client
4. All renderer ↔ Rust communication goes through: **Renderer → IPC → Main → gRPC → Rust**
5. No direct renderer→Rust connection (security: contextBridge isolation)

### Process Lifecycle

```
App Launch → spawn Rust binary → wait for LISTENING line → connect gRPC → ready
App Close  → send Health() with 2s deadline → SIGTERM → 5s timeout → SIGKILL
Crash      → detect exit code → respawn with backoff (1s, 2s, 4s, max 30s)
```

### IPC Channel API (contextBridge)

```typescript
// preload.ts exposes:
window.repoGuru = {
  // Scan
  scan(req: ScanRequest, onProgress: (p: ScanProgress) => void): Promise<void>,
  describeScan(outPath: string): Promise<DescribeScanResponse>,
  getSection(outPath: string, section: string): Promise<GetSectionResponse>,

  // Report Card
  scoreReportCard(repoPath: string, outPath?: string): Promise<ScoreResponse>,

  // Policy
  evaluatePolicy(preset: string, reportCard: ScoreResponse): Promise<PolicyResponse>,
  evaluatePolicyCustom(policy: PolicySet, reportCard: ScoreResponse): Promise<PolicyResponse>,

  // Tech & SBOM
  detectTech(repoPath: string): Promise<DetectTechResponse>,
  generateSBOM(repoPath: string, format?: string): Promise<SBOMResponse>,

  // Export
  exportReport(format: string, reportCard: ScoreResponse, repoName: string): Promise<ExportResponse>,

  // Org Scan
  scanOrg(req: OrgScanRequest, onProgress: (p: OrgScanProgress) => void): Promise<void>,

  // Compare
  compareRepos(pathA: string, pathB: string): Promise<CompareResponse>,

  // System
  health(): Promise<HealthResponse>,
  selectDirectory(): Promise<string | null>,  // native file dialog
  openExternal(url: string): Promise<void>,   // open in browser
}
```

## New Rust Modules

### 1. `src/scoring/` — Report Card Scoring Engine

```
src/scoring/
├── mod.rs            — Public API: score_repo(repo_path, scan_out) → ScoreResult
├── categories.rs     — Category weights, grade thresholds
├── documentation.rs  — Documentation category analyzer
├── security.rs       — Security category analyzer
├── cicd.rs           — CI/CD category analyzer
├── dependencies.rs   — Dependencies category analyzer
├── code_quality.rs   — Code Quality category analyzer
├── license.rs        — License category analyzer
├── community.rs      — Community category analyzer
├── openssf.rs        — OpenSSF category analyzer
└── tree_reader.rs    — Read HEAD tree entries + file content via gix
```

**Data Flow:**
```
repo_path → gix open → HEAD tree → walk tree entries
  → fetch target files content (README, LICENSE, workflows, configs…)
  → run 8 category analyzers in parallel (rayon)
  → each returns CategoryScore with signals
  → compute weighted overall score + grade
  → generate strengths/risks/next_steps
  → return ScoreResult
```

**Key design:** The scoring engine reads the HEAD tree directly via gix (no working directory needed — works on bare repos). Each category analyzer receives a `TreeContext` containing:
- `entries: Vec<TreeEntry>` — all blobs/trees in HEAD
- `files: HashMap<String, Vec<u8>>` — content of TARGET_FILES fetched from the object DB
- `scan_metrics: Option<ScanMetrics>` — enrichment from scan output (commit count, authors, etc.)

### 2. `src/policy/` — Policy Engine

```
src/policy/
├── mod.rs       — Public API: evaluate(policy, score_result) → PolicyEvaluation
├── presets.rs   — Built-in presets: basic-hygiene, production-ready, security-focused
└── rules.rs     — Rule evaluation logic (score comparison, signal existence)
```

**Data Flow:**
```
ScoreResult + PolicySet → evaluate each rule against categories/signals → PolicyEvaluation
```

### 3. `src/sbom/` — SBOM Generation

```
src/sbom/
├── mod.rs           — Public API: generate_sbom(repo_path) → SbomDocument
└── cyclonedx.rs     — CycloneDX 1.5 JSON serialization
```

**Data Flow:**
```
repo_path → run tech detection → collect frameworks, deps, languages
  → map to CycloneDX components (type, name, group, purl, bom-ref)
  → wrap in CycloneDX 1.5 envelope (metadata, tools, serial number)
  → serialize to JSON
```

### 4. `src/export/` — Export Formats

```
src/export/
├── mod.rs       — Public API: export(format, score_result, repo_name) → String
├── csv.rs       — CSV export (category scores + signals)
├── markdown.rs  — Markdown report
└── badge.rs     — SVG badge generation
```

### 5. `src/orgscan/` — Org/User Bulk Scanning

```
src/orgscan/
├── mod.rs       — Public API: scan_org(request, progress_tx) → OrgScanResult
├── github.rs    — GitHub API client (list repos, clone URLs)
└── runner.rs    — Sequential repo processing (clone → scan → score → report)
```

**Data Flow:**
```
org_name + token → GitHub API list repos → filter (forks, archived)
  → for each repo:
    → clone/fetch to clone_base_dir
    → score_repo() → ScoreResult
    → stream progress
  → aggregate: average scores, category averages
  → stream final result
```

### 6. `src/compare/` — Repo Comparison

```
src/compare/
├── mod.rs       — Public API: compare(path_a, path_b) → CompareResult
```

**Data Flow:**
```
repo_a, repo_b → score both repos → compute per-category deltas → determine winner
```

## Report Card Scoring Categories (8)

### 1. Documentation (weight: 0.15)

| Signal | Points | Detection |
|--------|--------|-----------|
| README exists | 25 | `README.md`, `README.rst`, `readme.md` in tree |
| Substantial README (>500 chars) | 20 | Byte length of README content |
| README has sections | 15 | Count `^#{1,3}\s+` matches ≥ 3 |
| Code examples in README | 10 | Regex for triple-backtick code blocks |
| CONTRIBUTING.md | 10 | `CONTRIBUTING.md` in tree |
| CHANGELOG | 10 | `CHANGELOG.md`, `CHANGES.md`, `HISTORY.md` |
| docs/ directory | 10 | `docs` or `doc` tree entry |

### 2. Security (weight: 0.10)

| Signal | Points | Detection |
|--------|--------|-----------|
| SECURITY.md | 20 | `SECURITY.md` in tree |
| CODEOWNERS | 15 | `CODEOWNERS` or `.github/CODEOWNERS` |
| Dependabot configured | 20 | `.github/dependabot.yml` or `.yaml` |
| CodeQL / security scanning | 15 | `codeql` in workflow file paths or content |
| PR-triggered workflows | 10 | `pull_request` in workflow content |
| .gitignore present | 10 | `.gitignore` in tree |
| No exposed secret files | 10 | No `.env`, `credentials*`, `secret*` blobs |

### 3. CI/CD (weight: 0.15)

| Signal | Points | Detection |
|--------|--------|-----------|
| GitHub Actions workflows | 25 | `.github/workflows/*.yml` entries |
| CI workflow (test/build) | 25 | Workflow with push/PR + test/build/ci |
| Deploy / release workflow | 15 | Workflow path/content with deploy/release/publish |
| PR-triggered checks | 15 | Workflow with `pull_request` trigger |
| Dockerfile | 10 | `Dockerfile` in tree |
| Docker Compose | 5 | `docker-compose.yml` or `.yaml` |
| Makefile | 5 | `Makefile` in tree |

### 4. Dependencies (weight: 0.15)

| Signal | Points | Detection |
|--------|--------|-----------|
| Dependency manifest | 30 | Any of: `package.json`, `Cargo.toml`, `go.mod`, `requirements.txt`, `Pipfile`, `pyproject.toml`, `Gemfile`, `composer.json`, `pom.xml`, `build.gradle` |
| Lockfile present | 25 | Any of: `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, `Cargo.lock`, `go.sum`, `Gemfile.lock` |
| Dependencies tracked | 20 | Parse manifest, dep count > 0 |
| Reasonable dependency count | 15 | dep count < 200 |
| Tech stack detected | 10 | At least one framework/language found |

### 5. Code Quality (weight: 0.15)

| Signal | Points | Detection |
|--------|--------|-----------|
| Linter configured | 20 | `.eslintrc*`, `eslint.config.*`, `.flake8`, `.pylintrc`, `clippy.toml`, `.rubocop.yml`, `.golangci.yml`, `biome.json` |
| Formatter configured | 15 | `.prettierrc*`, `prettier.config.*`, `rustfmt.toml`, `.clang-format`, `biome.json`, `.editorconfig` |
| Type system | 15 | `tsconfig.json` in tree |
| Git hooks | 10 | `.husky/pre-commit`, `.pre-commit-config.yaml`, `lefthook.yml` |
| Tests present | 20 | `test`/`tests`/`__tests__`/`spec` dirs or `*.test.*`/`*.spec.*`/`_test.go`/`_test.rs`/`test_*.py` files |
| CI runs tests | 10 | Workflow contains test command strings |
| EditorConfig | 10 | `.editorconfig` in tree |

### 6. License (weight: 0.10)

| Signal | Points | Detection |
|--------|--------|-----------|
| License file exists | 40 | `LICENSE`, `LICENSE.md`, `LICENSE.txt`, `COPYING`, `LICENCE` |
| SPDX license detected | 30 | Parse LICENSE content to identify SPDX ID |
| Permissive license | 30 | MIT, Apache-2.0, BSD-2/3-Clause, ISC, Unlicense, CC0-1.0 |
| Copyleft license | 20 | GPL-2.0/3.0, AGPL-3.0, LGPL-2.1/3.0, MPL-2.0 |

### 7. Community (weight: 0.10)

| Signal | Points | Detection |
|--------|--------|-----------|
| Issue templates | 20 | `.github/ISSUE_TEMPLATE/` entries |
| PR template | 20 | `.github/PULL_REQUEST_TEMPLATE.md` |
| Code of Conduct | 20 | `CODE_OF_CONDUCT.md` or `.github/CODE_OF_CONDUCT.md` |
| CONTRIBUTING.md | 20 | `CONTRIBUTING.md` in tree |
| Funding configuration | 10 | `.github/FUNDING.yml` |
| SUPPORT.md | 10 | `SUPPORT.md` or `.github/SUPPORT.md` |

### 8. OpenSSF (weight: 0.10)

| Signal | Points | Detection |
|--------|--------|-----------|
| Token permissions | 15 | `permissions:` in workflow files |
| Pinned dependencies | 15 | Actions use `@<40-hex-char-SHA>` refs |
| No dangerous workflow patterns | 10 | No `pull_request_target` + checkout of PR head |
| No binary artifacts | 10 | No `.exe`, `.dll`, `.jar`, `.so`, `.class`, `.pyc` |
| SLSA / signed releases | 10 | `slsa`, `provenance`, `sigstore`, `cosign` in workflows |
| Fuzzing | 10 | `fuzz` or `oss-fuzz` in paths or content |
| SBOM generation | 10 | `cyclonedx`, `spdx`, `sbom`, `syft` in workflows |
| Dependency update tool | 10 | Dependabot or Renovate config |
| Security policy | 5 | `SECURITY.md` in tree |
| License detected | 5 | `LICENSE`/`LICENCE`/`COPYING` in tree |

### Grade Thresholds

| Grade | Min Score |
|-------|-----------|
| A | 85 |
| B | 70 |
| C | 55 |
| D | 40 |
| F | 0 |

## Electron App Structure

```
repoguru-desktop/
├── electron/
│   ├── main.ts              — App lifecycle, window management, tray
│   ├── preload.ts           — contextBridge API (see IPC section above)
│   ├── grpc-bridge.ts       — @grpc/grpc-js client wrapping all RPCs
│   ├── process-manager.ts   — Spawn/monitor/restart repoanalyze binary
│   └── auto-updater.ts      — electron-updater integration
├── src/
│   ├── App.tsx              — Router + layout shell
│   ├── pages/
│   │   ├── Dashboard.tsx        — Repo input, recent repos, quick stats
│   │   ├── ReportCard.tsx       — 8-category scoring with animated grades
│   │   ├── GitStats.tsx         — 15+ interactive charts (activity, contributors…)
│   │   ├── TechDetect.tsx       — Technology detection results
│   │   ├── Compare.tsx          — Side-by-side repo comparison
│   │   ├── OrgScan.tsx          — Bulk org/user portfolio analysis
│   │   ├── PolicyEngine.tsx     — Policy evaluation with presets
│   │   └── Settings.tsx         — Theme, binary path, GitHub token
│   ├── components/
│   │   ├── charts/              — ECharts wrappers (activity, punch card, etc.)
│   │   ├── report/              — Grade badge, category card, signal list
│   │   ├── scan/                — Progress bar, phase indicator
│   │   └── common/              — Layout, nav, buttons, inputs
│   ├── services/
│   │   ├── grpc-client.ts       — Typed wrappers calling window.repoGuru
│   │   └── storage.ts           — localStorage/IndexedDB for recent repos
│   └── hooks/
│       ├── useScan.ts           — Scan lifecycle + progress state
│       ├── useReportCard.ts     — Score + export state
│       └── useOrgScan.ts        — Org scan lifecycle
├── resources/
│   └── bin/                     — Embedded repoanalyze binaries per platform
├── package.json
├── electron-builder.yml
├── vite.config.ts
└── tsconfig.json
```

## Data Flow Diagrams

### Full Scan → Report Card → Export

```
User enters repo path
  → Renderer: scan(req, onProgress)
  → Main: gRPC Scan() stream → forward progress to renderer
  → Scan completes → out_path has binary tables + metrics.json
  → Renderer: scoreReportCard(repoPath, outPath)
  → Main: gRPC ScoreReportCard() → reads HEAD tree + enriches with scan data
  → Returns ScoreResponse with 8 categories, signals, grade
  → Renderer displays animated report card
  → User clicks Export → exportReport("csv", scoreResponse, "org/repo")
  → Returns CSV string → save to file via dialog
```

### Org Scan

```
User enters org name + GitHub token
  → Renderer: scanOrg(req, onProgress)
  → Main: gRPC ScanOrg() stream
  → Rust: GitHub API list repos → for each:
    → clone to temp dir
    → ScoreReportCard(clone_path)
    → stream OrgScanProgress (repo name, scores)
  → Renderer updates table progressively
  → Final: average scores, grade distribution chart
```

### Policy Evaluation

```
User selects preset (or creates custom rules)
  → Renderer: evaluatePolicy("production-ready", scoreResponse)
  → Main: gRPC EvaluatePolicy()
  → Rust: iterate rules, check scores/signals → pass/fail
  → Returns PolicyResponse with per-rule results
  → Renderer shows pass/fail badges per rule
```

## Platform Binary Embedding

```
resources/bin/
├── repoanalyze-linux-x86_64      (Linux)
├── repoanalyze-darwin-x86_64     (macOS Intel)
├── repoanalyze-darwin-aarch64    (macOS Apple Silicon)
└── repoanalyze-win32-x86_64.exe  (Windows)
```

At build time, `electron-builder` packages only the binary matching the target platform. At runtime, `process-manager.ts` resolves the binary path via `process.resourcesPath`.

## Key Dependencies

### Rust (additions to Cargo.toml)
- `reqwest` — HTTP client for GitHub API (org scan)
- `uuid` — SBOM serial number generation
- Existing: `gix`, `tonic`, `prost`, `serde`, `serde_json`, `rayon`

### Electron
- `@grpc/grpc-js` + `@grpc/proto-loader` — gRPC client
- `electron-builder` — cross-platform packaging
- `electron-updater` — auto-update
- `react` + `react-dom` + `react-router`
- `echarts` + `echarts-for-react` — charting
- `vite` + `@vitejs/plugin-react` — build tool
- `tailwindcss` — styling
