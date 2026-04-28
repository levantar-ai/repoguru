# Unification status

Updated 2026-04-28. **Unification is complete** — every page renders from
a single React file in `@repoguru/ui` mounted by both apps. The web is
the visual authority; the desktop is the same React tree backed by a
different processing engine. Same model VS Code uses for browser vs
desktop builds.

## Architecture

```
                        ┌─────────────────────────┐
                        │     @repoguru/ui        │
                        │  (one source of truth)  │
                        │                         │
                        │  pages/                 │
                        │   ├ ComparePage         │
                        │   ├ ReportCardPage      │
                        │   ├ TechDetectPage      │
                        │   ├ PolicyPage          │
                        │   ├ OrgScanPage         │
                        │   └ GitStatsPage        │
                        │                         │
                        │  chrome/  RepoPicker,   │
                        │           PageHero, …   │
                        │  views/   ReportCardView│
                        │           CompareView…  │
                        │  charts/  ECharts/D3 …  │
                        │  services/types         │
                        └────────────┬────────────┘
                                     │
              ┌──────────────────────┴──────────────────────┐
              │                                              │
   ┌──────────▼──────────┐                       ┌──────────▼──────────┐
   │   repoguru/         │                       │  repoguru-desktop/  │
   │   (in-browser app)  │                       │  (Electron app)     │
   │                     │                       │                     │
   │   makeBrowserSvcs:  │                       │   desktopServices:  │
   │   • compare/score/  │                       │   • compare/score/  │
   │     techDetect via  │                       │     techDetect via  │
   │     isomorphic-git  │                       │     gRPC to Rust    │
   │     + GitHub API    │                       │     CLI sidecar     │
   │   • orgScan via     │                       │   • orgScan via     │
   │     /orgs/X/repos   │                       │     CLI ScanOrg     │
   │     + lightAnalysis │                       │     streaming       │
   │   • gitStats via    │                       │   • gitStats via    │
   │     isomorphic-git  │                       │     CLI Scan +      │
   │     worker (1000-   │                       │     section stream  │
   │     commit cap)     │                       │     (ALL commits)   │
   │   • repoBrowse:     │                       │   • repoBrowse:     │
   │     prompt + recent │                       │     selectDirectory │
   │     GitHub repos    │                       │     + recent paths  │
   │                     │                       │                     │
   │   App.tsx wraps in  │                       │   App.tsx wraps in  │
   │   <RepoGuruProvider>│                       │   <RepoGuruProvider>│
   │   and routes to     │                       │   and routes to     │
   │   the SAME pages    │                       │   the SAME pages    │
   └─────────────────────┘                       └─────────────────────┘
```

## What's shared

Every page lives in `packages/ui/src/pages/` and is the only copy of that
page anywhere in the codebase. Both hosts mount it directly:

```tsx
import { ComparePage, ReportCardPage, TechDetectPage,
         PolicyPage, OrgScanPage, GitStatsPage,
         RepoGuruProvider } from '@repoguru/ui';
```

The pages call `useRepoGuru()` to get the host's services bag —
`compare.run`, `score.run`, `techDetect.run`, `policy.evaluate`,
`orgScan.run`, `gitStats.run`, `repoBrowse.{browse,recents,hint}`. The
contract lives at `packages/ui/src/services/types.ts`. The pages never
import anything host-specific.

The chrome (`<PageHero>`, `<RepoPicker>`, `<PrimaryButton>`,
`<LoadingPanel>`, `<ErrorPanel>`, …) and the views (`<CompareView>`,
`<ReportCardView>`, `<TechDetectView>`, `<PolicyView>`, `<OrgScanView>`,
`<GitStatsView>`) all live in `@repoguru/ui` and are imported by both
hosts.

## What differs per host

Three things, all explicitly intentional:

1. **Processing engine** — browser runs `isomorphic-git` + GitHub API in
   the page; desktop calls the Rust CLI sidecar over gRPC. Injected via
   `RepoGuruServices`.
2. **Repo browse semantics** — browser pops a prompt and lists recent
   GitHub analyses; desktop opens the OS folder picker via
   `window.repoGuru.selectDirectory()` and lists recent local paths.
3. **App shell** — browser uses a top horizontal nav (Layout); desktop
   uses a left sidebar (App.tsx). The user explicitly OK'd this.

Everything else is byte-for-byte identical because the React tree is
identical.

## Visible nuances expected per host

- **Git Stats subtitle**: web reads "across the most recent **1000
  commits**" (browser limitation); desktop reads "across **every
  commit**" (the CLI scans the full local clone). Driven off
  `services.isDesktop`.
- **Compare extras**: the browser supplies a `TechStackComparison` and
  `Repository Stats` table below the breakdown — neither of these
  appear on the desktop because the CLI's CompareRepos RPC doesn't
  surface that data. Delivered through `services.compare.run().extras`.
- **Report Card extras**: browser supplies a Stats card row + Tech
  Stack section (same reason). Delivered through
  `services.score.run().extras`.

## Verification (Apr 2026)

Side-by-side Playwright screenshots at 1400×1000 of both apps for all
six pages — see `SBS-{1..6}-{WEB,DESKTOP}-*.png` in the repo root:

| Page | Web data | Desktop data | Visual parity |
|---|---|---|---|
| Compare | octocat/hello-world vs expressjs/express | repoguru vs repoguru-spec | identical chrome ✓ |
| Report Card | expressjs/express, C 57/100 | repoguru, A 93/100 | identical chrome ✓ |
| Tech Detect | expressjs/express, JavaScript 86% | repoguru, TypeScript 88.4% | identical chrome ✓ |
| Policy | expressjs/express, "Open Source Ready" | repoguru, "Production Ready" | identical chrome ✓ |
| Org Scan | empty form | empty form | identical empty state ✓ |
| Git Stats | empty form (note: 1000 commits) | empty form (note: every commit) | identical empty state ✓ |

The web app dev server runs at `pnpm --filter repoguru dev`. The desktop
renderer was driven via a mock-bridge static server
(`repoguru-spec/electron-app/repoguru-desktop/serve-mock.mjs`) that
serves the production build with canned CLI fixtures, so the React tree
runs in a regular browser tab for visual diffing. To run the actual
Electron app, use `pnpm --filter repoguru-desktop dev`.

## Commit chain

```
f8fb977 feat(ui): lift GitStatsPage — all 6 pages now shared
f962ddc feat(ui): lift OrgScanPage
3cd8fea feat(ui): lift PolicyPage
97136d3 feat(ui): lift TechDetectPage
f0f1936 feat(ui): lift ReportCardPage
e45945e feat(ui): lift ComparePage as the first VS Code-style shared page
58c7354 feat(ui): lift RepoPicker UI
a86cfe6 feat(ui): lift page chrome (PageContainer, PageHero, …)
dcd4d67 feat(ui): extract canonical theme to @repoguru/ui/theme.css
886bc32 feat(ui): lift Org Scan view + wire desktop ScanOrg
36587ea feat(ui): lift Policy view + wire desktop EvaluatePolicy
c78cc1e feat(ui): lift Compare view + wire desktop CompareRepos
[earlier commits: views, charts, theme, base layout]
```

## Verification commands

```sh
pnpm typecheck                            # all 6 in-scope packages
pnpm --filter repoguru test               # 1075 vitest tests
pnpm --filter @repoguru/desktop-adapter smoke
pnpm --filter @repoguru/browser-adapter smoke

# Run the web dev server:
pnpm --filter repoguru dev                # http://localhost:5173

# Run the actual Electron desktop app:
pnpm --filter repoguru-desktop dev        # launches Electron window
# (the gRPC sidecar at 127.0.0.1:50051 is started by Electron's main
# process; the Rust CLI binary lives at
# repoguru-spec/electron-app/repoguru-desktop/resources/bin/
# repoanalyze-linux-x86_64)
```

## Definition of done

> Every chart, dashboard panel, and page-level view that exists in both
> apps is rendered by a single React component tree in `@repoguru/ui`.

Hit. Both hosts mount the same six pages from `@repoguru/ui/pages/`.
The only per-host code is the services-injection layer (data engine +
repo browse + nav shell).
