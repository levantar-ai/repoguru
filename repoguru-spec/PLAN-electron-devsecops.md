# RepoGuru Desktop Platform — Agent Team Plan

## Vision
Build a world-class desktop DevSecOps platform by:
1. Achieving feature parity with repoguru web app (minus the 1000-commit limit — we do ALL commits)
2. Wrapping the Rust binary in an Electron desktop app with rich interactive UI
3. Full CI/CD, security scanning, and release automation

## Feature Gap Analysis (repoguru-spec vs repoguru web)

### Already in repoguru-spec (Rust CLI)
- [x] Full commit history analysis (unlimited commits, 62K in 85s)
- [x] File churn / hotspots
- [x] File coupling analysis
- [x] Sequential change chains
- [x] Contributor analysis (top authors, timelines, network graph)
- [x] Activity timeseries (daily/weekly/monthly)
- [x] Commit patterns (weekday, month, year, hour, punch card)
- [x] Language breakdown by extension
- [x] Word frequencies in commit messages
- [x] Bus factor
- [x] Tag/release history
- [x] Timezone distribution
- [x] Code ownership map
- [x] git-sizer metrics (object DB analysis)
- [x] Technology detection (languages, frameworks, cloud, CI/CD, DBs)
- [x] Self-contained HTML report with ECharts
- [x] gRPC server with streaming scan progress
- [x] Binary table output (commit_stats, file_stats, rename_events)

### Missing — Needs Implementation
- [ ] **Report Card Scoring** — 8 weighted categories (docs, security, CI/CD, deps, code quality, license, community, OpenSSF)
- [ ] **Policy Engine** — Custom compliance rules with presets (Open Source Ready, Enterprise Grade, Beginner Friendly)
- [ ] **SBOM Export** — CycloneDX 1.5 format
- [ ] **CSV Export** — Per-category scores and signals
- [ ] **Markdown Export** — Formatted report
- [ ] **Badge Generation** — Embeddable HTML/SVG badges
- [ ] **Org Scan** — Bulk analysis of all repos in a GitHub org
- [ ] **Portfolio Analysis** — Analyze all repos for a GitHub user
- [ ] **Repo Comparison** — Side-by-side analysis of two repos
- [ ] **Contributor Friendliness Score** — Onboarding readiness checklist
- [ ] **LLM Enrichment** — Optional AI-powered insights via Claude API
- [ ] **Health Radar Enhancement** — Multidimensional scoring radar chart
- [ ] **Conventional Commits Parsing** — Structured commit message analysis
- [ ] **Commit Size Histogram** — Distribution visualization data

## Architecture

### Electron App (separate worktree: `electron-app`)
```
repoguru-desktop/
├── electron/
│   ├── main.ts              — Electron main process
│   ├── preload.ts           — Context bridge
│   ├── grpc-bridge.ts       — gRPC client ↔ Rust binary
│   ├── process-manager.ts   — Spawn/monitor/restart Rust binary
│   └── auto-updater.ts      — Electron auto-update
├── src/                     — React + TypeScript frontend
│   ├── pages/
│   │   ├── Dashboard.tsx        — Home with repo input + recent repos
│   │   ├── ReportCard.tsx       — 8-category scoring with animated grades
│   │   ├── GitStats.tsx         — 15+ interactive charts
│   │   ├── TechDetect.tsx       — Technology detection results
│   │   ├── Compare.tsx          — Side-by-side repo comparison
│   │   ├── OrgScan.tsx          — Bulk org analysis
│   │   ├── Portfolio.tsx        — User portfolio analysis
│   │   ├── PolicyEngine.tsx     — Custom compliance rules
│   │   └── Settings.tsx         — App settings
│   ├── components/
│   │   ├── charts/              — ECharts + D3 visualizations
│   │   ├── report/              — Report card components
│   │   ├── scan/                — Progress + streaming UI
│   │   └── common/              — Shared components
│   ├── services/
│   │   ├── grpc-client.ts       — gRPC service bindings
│   │   ├── github-api.ts        — GitHub REST API client
│   │   └── storage.ts           — Local persistence
│   └── hooks/                   — React hooks
├── resources/
│   └── bin/                     — Embedded Rust binaries (per-platform)
├── package.json
├── electron-builder.yml         — Cross-platform packaging
├── vite.config.ts
└── tsconfig.json
```

### Communication Flow
```
Electron UI (React)
    ↕ IPC (contextBridge)
Electron Main Process
    ↕ gRPC (tonic client via @grpc/grpc-js)
Rust Binary (repoanalyze serve)
    ↕ gix
Git Repository
```

### New gRPC Endpoints Needed
```protobuf
rpc ScoreReportCard(ScoreRequest) returns (ScoreResponse);
rpc EvaluatePolicy(PolicyRequest) returns (PolicyResponse);
rpc GenerateSBOM(SBOMRequest) returns (SBOMResponse);
rpc ExportReport(ExportRequest) returns (ExportResponse);
rpc ScanOrg(OrgScanRequest) returns (stream OrgScanProgress);
rpc CompareRepos(CompareRequest) returns (CompareResponse);
```

## Agent Team Structure

### 1. Architect (Team Lead)
- Design system, define contracts, approve plans
- Coordinate between all teammates
- Review and synthesize outputs

### 2. Rust Backend Engineer
- Report card scoring engine (8 categories)
- Policy engine with presets
- SBOM generation (CycloneDX)
- Export formats (CSV, Markdown, badges)
- New gRPC endpoints
- Enhanced contributor metrics

### 3. Electron Shell Engineer
- Electron + React + Vite scaffold in worktree
- Binary embedding + process manager
- gRPC client bridge
- Cross-platform packaging
- Auto-update mechanism

### 4. Frontend UI Engineer
- Dashboard, report card, git stats pages
- 15+ interactive charts (ECharts + D3)
- Real-time scan progress UI
- Compare, org scan, policy engine views
- Dark/light theme, responsive layout
- Export toolbar

### 5. DevSecOps Engineer
- GitHub Actions CI/CD (Rust + Electron matrix)
- Cross-compilation (Linux x86_64, macOS ARM/x86, Windows)
- Code signing + notarization
- Security scanning (CodeQL, cargo-audit, npm audit)
- SLSA provenance
- Release automation (semantic-release)
- Docker build for Rust binary
