# RepoGuru Unification — Specification

A durable reference for the consolidation work, written so any agent
can resume without re-discovering context. Read this top-to-bottom
before touching code.

---

## 1. Mental model

There are two RepoGuru frontends in this monorepo:

- `web/` — **the in-browser web app**. Clones repos via
  `isomorphic-git` in a Web Worker, hits the GitHub API for metadata,
  and produces an `AnalysisReport` / `GitStatsAnalysis` /
  `TechDetectResult` entirely client-side.
- `desktop/` — **the Electron
  desktop app**. Drives a Rust CLI sidecar (`repoanalyze`) over gRPC
  to produce the same logical reports against a local clone.

**The web app's view layer is the authoritative reference.** Every
chart, panel, and page that exists in both apps is rendered by the
same React component tree, hosted in `@repoguru/ui`. The desktop app
projects its CLI output into the web's view shapes; the web app
passes its native shapes through unchanged.

> The user's reference screenshot lives at
> `/media/psf/Home/Downloads/screencapture-repo-guru-2026-04-27-22_56_26.png`.
> When in doubt about visual style — gradients, rounded corners,
> chart palette, layout density — that screenshot is the bar.

**Hard rule: the desktop and the browser must render the same React
tree for any concept that exists in both.** No second implementation,
no "desktop variant of chart X". If the data shapes differ, project
both into a shared shape; lift the view; render once.

**Hard rule: UI ↔ CLI report parity.** Whatever the CLI emits from
its `serve` (gRPC) or one-shot subcommands (`scan`, `detect-tech`)
must end up in the same view the browser renders. The projection
happens at the desktop adapter / hook boundary, never inside view
components.

---

## 2. Workspace layout

```
repoguru-unified/                ← single git repo (root)
├── shared/
│   ├── core/                    @repoguru/core
│   │   ├── src/gitStats.ts      Canonical streaming sections (RepoAnalyzer port)
│   │   ├── src/legacy.ts        Browser-shape view types (GitStatsAnalysis, etc.)
│   │   ├── src/techDetect.ts    Canonical TechDetectResult
│   │   └── src/analyzer.ts      RepoAnalyzer interface + AnalyzeError
│   ├── desktop-adapter/         @repoguru/desktop-adapter
│   │   └── src/grpcAnalyzer.ts  GrpcAnalyzer + wire→canonical mappers
│   ├── browser-adapter/         @repoguru/browser-adapter
│   │   └── src/browserAnalyzer.ts BrowserAnalyzer wrapping cloneAndExtract
│   └── ui/                      @repoguru/ui — shared React view layer
│       ├── src/charts/          ~38 lifted git-stats components + EChartsWrapper, D3Container, RadarChart, theme
│       ├── src/tech-detect/     7 lifted tech-detect components
│       └── src/views/           Page-level views: GitStatsView, ReportCardView, TechDetectView
│
├── web/                    Web app — workspace member
└── desktop/
                                 Electron renderer — workspace member
```

The Rust CLI binary lives at:
```
desktop/resources/bin/repoanalyze-linux-x86_64
```

---

## 3. Architecture rules

### 3.1 The view package is host-agnostic

- `@repoguru/ui` depends only on `@repoguru/core` types, React, ECharts,
  d3, d3-cloud — no app code, no host-specific services.
- Hosts pass data + an `actions` slot. Charts render bare; the host
  wraps them in its own card chrome (browser uses `<ChartSection>`,
  desktop uses panels).
- Use the `repoguru` ECharts theme everywhere — registered once in
  `@repoguru/ui/src/charts/EChartsWrapper.tsx` against modular ECharts
  imports.

### 3.2 Two type contracts, one view

There are two type families in `@repoguru/core` and they're
deliberately separate:

- **`./gitStats.ts` (canonical)** — sectioned, streaming-friendly,
  used at the `RepoAnalyzer` port (`AnalyzeEvent`, `GitStatsData`,
  `GitStatsSection`, etc.). Adapters produce this; the streaming UI
  state machine consumes it.
- **`./legacy.ts` (view)** — the browser app's `GitStatsAnalysis`
  with all its sub-shapes (`BusFactorData`, `LanguageEntry`,
  `RadarMetric`, …). Lifted views in `@repoguru/ui` consume this.
  Re-exported via the `legacy` namespace: `import { legacy } from
  '@repoguru/core'`.

`@repoguru/ui` charts use `legacyTypes.ts` (a flat re-export of the
`legacy` namespace under the original names) so lifted browser code
compiles unchanged.

### 3.3 The desktop has a wire-to-view projection

`spec/.../src/services/wireToLegacy.ts` is the authoritative
projection from the gRPC sidecar's JSON wire shape into `GitStatsAnalysis`.
Mirror this pattern for every other CLI RPC:

- `wireToLegacy.ts` — `metrics.json` + section payloads → `GitStatsAnalysis`
- `pages/ReportCard.tsx::scoreToReportCardData()` — `ScoreResponse` → `ReportCardData`
- `pages/TechDetect.tsx::cliToTechDetect()` — DetectTech JSON → `TechDetectResult`

The pattern: probe the live CLI with `@grpc/grpc-js`, write a small
projection function next to where it's consumed, sanitise the
sidecar's `u32::MAX` (4294967295) sentinels for binary files.

### 3.4 The vite-isomorphic-git fix is non-obvious

`isomorphic-git`'s package `exports."."` only declares a CJS `default`
that `require('crypto')`s Node. The browser app's `vite.config.ts`
aliases the bare specifier at `node_modules/isomorphic-git/index.js`
(ESM, uses `crypto.subtle` only) and forces `optimizeDeps` to
pre-bundle that absolute path. Don't touch this without re-running
the Playwright scan — it's load-bearing.

### 3.5 Workspace is a single git repo

The inner `.git` dirs in `web/` and `spec/` were
deleted; the workspace root is the single source of truth.
`spec/.gitignore` and `web/.gitignore` are no longer
authoritative. Use the workspace root `.gitignore` only. Backup
copies of the original projects live at `~/Development/web/`
and `~/Development/spec/`.

---

## 4. Status — pages

| Page         | Web                              | Desktop                              | Shared view                              |
|--------------|----------------------------------|--------------------------------------|------------------------------------------|
| Git Stats    | renders `<GitStatsView />`       | renders `<GitStatsView />`           | ✅ `GitStatsView` (every chart lifted)    |
| Report Card  | renders rich legacy view ¹       | renders `<ReportCardView />`         | ✅ `ReportCardView` (intersection)        |
| Tech Detect  | renders `<TechDetectView />`     | renders `<TechDetectView />`         | ✅ `TechDetectView` (full lift)           |
| Compare      | LightAnalysisReport per repo     | `<CompareResult>` (gRPC)             | ❌ — see §5                                |
| Org Scan     | GitHub API + light analysis      | `ScanOrg` streaming                  | ❌ — see §5                                |
| Policy       | Full editor + evaluation         | `EvaluatePolicy` viewing             | ❌ — see §5                                |

¹ The web app's `ReportCard.tsx` still renders TechStack, FixItLinks,
BadgeGenerator, ContributorScore, LlmInsights, MermaidDiagram —
extras the desktop never had. Acceptable as a superset; the
intersection is `<ReportCardView />`.

Browser-only pages without a desktop equivalent (HomePage hero,
DiscoverPage, PortfolioPage, HowItWorksPage) stay browser-only —
they need GitHub API data the CLI doesn't expose.

Desktop-only pages (Dashboard, Settings) stay desktop-only.

---

## 5. Outstanding work — Compare, Org Scan, Policy

### 5.1 The pattern (mandatory — do not deviate)

For each remaining page, follow these steps in order:

1. **Probe the CLI.** Start `repoanalyze-linux-x86_64 serve --listen
   127.0.0.1:50051`. Write a `probe-<rpc>.mjs` under
   `desktop/`, call the RPC with
   `@grpc/grpc-js`, dump every key shape. Record it in this section.
   `probe-*.mjs` files are gitignored — leave them in place to help
   future debugging.
2. **Read the web page.** Identify the main render component. Any
   browser-only sections (TechStack, MermaidDiagram, LLM insights —
   things the CLI doesn't surface) stay browser-side.
3. **Lift the shared view.** Bulk-copy the relevant `web/src/
   components/<area>/*.tsx` into `shared/ui/src/<area>/`. Sed
   `from '../../types/<x>'` → `from './legacyTypes.js'` (or
   `@repoguru/core` if you've added the types there). Sed
   `from '@repoguru/ui'` → `from '../charts/EChartsWrapper.js'` to
   break self-import cycles.
4. **Add a `<XView />` wrapper** in `shared/ui/src/views/`,
   exposing exactly the props both apps can supply. Add an
   `actions?: ReactNode` slot for host-specific buttons.
5. **Project both apps into the view:**
   - Browser page: replace its inline JSX with `<XView />`. Browser-
     only extras stay outside the `XView`.
   - Desktop page: write a `wire→view` projection function inline
     (mirroring `wireToLegacy`/`scoreToReportCardData`/`cliToTechDetect`),
     replace the page body with `<XView projection={...} actions={...} />`.
6. **Delete the old browser components dir** once nothing else
   imports from it (`grep -rl "components/<area>" web/src`).
7. **Verify:**
   - `pnpm typecheck` (all 6 in-scope packages)
   - `pnpm --filter repoguru test` (1099 tests should still pass;
     update story fixtures if a chart's prop names changed)
   - Playwright: navigate to the page, run a real analysis against
     `octocat/hello-world` (small) or `facebook/react` (rich), screenshot
   - CLI probe: confirm the projection populates every field the view
     reads
8. **Commit per page** with this format:
   ```
   feat(ui): lift <Page> view + wire desktop <RPC>

   <one-paragraph what-and-why>

   What's in @repoguru/ui now: <list>
   Browser: <change>
   Desktop: <change>
   Verified against live CLI: <data shape summary>
   ```

### 5.2 Compare

- **CLI RPC:** `CompareRepos(CompareRequest) returns (CompareResponse)`
  in `spec/proto/repoanalyze.proto`. Returns
  `{ report_card_a: ScoreResponse, report_card_b: ScoreResponse,
  deltas: [{category, score_a, score_b, delta, winner}], winner,
  score_delta }`.
- **Browser shape:** `LightAnalysisReport` (a stripped `AnalysisReport`)
  built by `runLightAnalysis` from GitHub API data. Two of them.
- **Shared view:** `<CompareView reportA={ReportCardData}
  reportB={ReportCardData} deltas?={Delta[]} actions? />`. Reuse
  `<ReportCardView />` columns side-by-side.
- **Desktop projection:** wrap `scoreToReportCardData(ScoreResponse,
  path)` over both report cards.
- **Browser projection:** `LightAnalysisReport` → `ReportCardData` is
  a near-identity (same field names, missing `repoInfo` for some).

### 5.3 Org Scan

- **CLI RPC:** `ScanOrg(OrgScanRequest) returns (stream OrgScanProgress)`.
  Streams per-repo progress including final scores.
- **Browser shape:** `OrgScanResult { repos: [{owner, repo, grade,
  overallScore, ...}] }` from GitHub API + `runLightAnalysis` per
  repo.
- **Shared view:** `<OrgScanView items={OrgScanItem[]} actions? />`.
  Renders a sortable/filterable table or grid of repo summaries with
  letter grades, links to drill into each. The browser has a 1,451-
  line page with rich filters/sort/tags — lift the table view, leave
  filter UI host-local for now.
- **Desktop projection:** consume the streaming progress, accumulate
  into `OrgScanItem[]`.

### 5.4 Policy

- **CLI RPC:** `EvaluatePolicy(PolicyRequest) returns (PolicyResponse)`.
  Returns `{ passed: bool, rules: [{key, label, expected, actual,
  passed, severity}], summary }`.
- **Browser shape:** lives in `web/src/pages/PolicyPage.tsx`
  (~1,471 lines including a full rule editor). The result-rendering
  part is a subset.
- **Shared view:** `<PolicyView result={PolicyEvalResult} actions? />`.
  Renders the rule pass/fail table + summary. **The rule EDITOR
  stays browser-only** — the desktop currently only views results.
- **Desktop projection:** identity (`PolicyResponse` is already the
  view shape).

---

## 6. Conventions

### 6.1 Imports

- View components in `@repoguru/ui` import types from
  `@repoguru/core` (canonical or via `legacy` namespace) — never
  from app code.
- Within `@repoguru/ui`, use `.js` suffix on relative imports
  (`'./EChartsWrapper.js'`) — required by ESM + `verbatimModuleSyntax`.
- Browser/desktop pages import shared views from `@repoguru/ui`.

### 6.2 ECharts

- Always render through `<EChartsWrapper option={...} height={...} />`
  — it owns the modular ECharts core registration, the `repoguru`
  theme, and ResizeObserver handling.
- Bar charts use linear gradients with rounded top corners
  (`borderRadius: [4, 4, 0, 0]`). Palette: `#a78bfa→#7c3aed` for
  weekday, `#34d399→#059669` for month, `#38bdf8→#0284c7` for hour,
  `#fb923c→#ea580c` for year.

### 6.3 Sentinels

The Rust CLI emits `4294967295` (`u32::MAX`) as a binary-file
sentinel in lines/churn fields. Sanitise before charts render
(see `wireToLegacy::sanitize()`).

### 6.4 Error handling

- Hosts catch errors and render an error panel; views never throw
  on missing optional fields.
- Use `parseErrorWithTip(state.error)` for user-facing copy in the
  browser; desktop renders a simpler "Error: <message>".

### 6.5 What NOT to do

- Don't add a "desktop variant" of a shared chart. Project the data
  into the shared shape instead.
- Don't add fields to `legacy.GitStatsAnalysis` to accommodate one
  app's quirks. Use `optional` properly or extend the canonical type
  in `@repoguru/core`.
- Don't bypass the dep optimizer on isomorphic-git — see §3.4.
- Don't commit `*.png` screenshots or `probe-*.mjs` scripts. They're
  in `.gitignore`.

---

## 7. Verification commands

Run before every commit:

```sh
pnpm typecheck                                       # all 6 in-scope packages
pnpm --filter repoguru test                          # 1099 vitest tests
pnpm --filter @repoguru/desktop-adapter smoke
pnpm --filter @repoguru/browser-adapter smoke
```

Live browser smoke (when touching a page):

```sh
pnpm --filter repoguru dev   # http://localhost:5173
# Then drive via Playwright MCP — see §8 for the proven nav pattern
```

CLI probe (when touching a desktop projection):

```sh
# In one terminal:
./desktop/resources/bin/repoanalyze-linux-x86_64 \
    serve --listen 127.0.0.1:50051

# In another, use @grpc/grpc-js + the proto file. Template:
# desktop/probe-<rpc>.mjs
```

---

## 8. Playwright nav patterns that work

The browser app's `page` state is `useState`-driven, not URL-routed.
Vite HMR can reset it during the first scan when isomorphic-git deps
are pre-optimised.

Reliable flow:

```js
async (page) => {
  await page.getByRole('button', { name: 'Open navigation menu' }).click();
  await page.getByRole('button', { name: 'Git Stats', exact: true }).click();
  await page.getByPlaceholder('owner/repo (e.g. facebook/react)').fill('facebook/react');
  await page.getByRole('button', { name: 'Analyze Git Stats' }).click();
}
```

Poll for completion (canvas count is the most reliable):

```js
const start = Date.now();
while (Date.now() - start < 240000) {
  await page.waitForTimeout(3000);
  if (await page.locator('p:has-text("Analysis failed")').count() > 0) {
    return { state: 'error' };
  }
  if (await page.locator('canvas').count() > 5) {
    return { state: 'done', elapsed: Math.round((Date.now() - start) / 1000) };
  }
}
```

---

## 9. Things I cannot verify from this environment

- The Electron app at runtime — I have no headless harness for it.
  Desktop verification is at the construction level (typecheck +
  shared component identity with the browser).
- ScreenCaptures of the Electron renderer.

If the user wants live desktop screenshots, that's a separate
out-of-band step (`pnpm --filter repoguru-desktop dev` in their
local environment).

---

## 10. Reading order for resuming

1. This file (you're here).
2. `STATUS.md` — last-touched rolling progress log; cross-check
   against §4 above for discrepancies.
3. `git log --oneline | head -20` — the commit chain tells the
   story of every lift in the order it happened.
4. `shared/ui/src/views/GitStatsView.tsx` — the canonical
   reference for how a `<*View />` is structured.
5. `desktop/src/services/wireToLegacy.ts`
   — the canonical reference for a CLI→view projection.

---

## 11. Definition of done

This unification is complete when **every chart, dashboard panel,
and page-level view that exists in both apps is rendered by a single
React component tree in `@repoguru/ui`, fed by a CLI projection on
the desktop side and the browser's existing pipeline on the web
side**, and verified end-to-end against the live `repoanalyze` CLI
plus a Playwright run on the browser. No second implementations.
No silent data drops at the projection boundary.

The remaining pages (§5) are the only blockers.
