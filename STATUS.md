# Unification status

Updated 2026-04-27. Workspace is now a single git repo (the previous
per-subproject `.git` dirs in `repoguru/` and `repoguru-spec/` have been
removed; this is the source of truth).

## Snapshot

Two RepoGuru frontends are being consolidated behind a shared view layer:

- `repoguru/` — in-browser app (clones via `isomorphic-git`, analyses in-page).
- `repoguru-spec/electron-app/repoguru-desktop/` — Electron renderer that
  talks gRPC to a Rust `repoanalyze` sidecar.

The shared layer lives under `packages/`:

| Package                    | Role                                                    |
| -------------------------- | ------------------------------------------------------- |
| `@repoguru/core`           | Canonical `GitStatsData` types + `RepoAnalyzer` port    |
| `@repoguru/desktop-adapter`| `GrpcAnalyzer` — wire→canonical mappers                 |
| `@repoguru/browser-adapter`| `BrowserAnalyzer` — wraps the browser pipeline runner   |
| `@repoguru/ui`             | Shared React charts; depends only on `@repoguru/core`   |

The contract: every chart in `@repoguru/ui` consumes only `@repoguru/core`
types. Both adapters produce canonical `GitStatsData`. Hosts inject an
analyzer and feed canonical sections into the shared charts. Each lifted
chart accepts `card={false}` so a host that already supplies card chrome
(the in-browser app's `<ChartSection>`) can suppress the built-in
`ChartCard` wrapper.

## Done

- [x] `@repoguru/core` — types + `RepoAnalyzer` port + `runAnalyzer` helper.
- [x] `@repoguru/desktop-adapter` — `GrpcAnalyzer`, every wire→canonical mapper, smoke test.
- [x] `@repoguru/browser-adapter` — `BrowserAnalyzer`, every mapper, smoke test.
- [x] `@repoguru/ui` — `ChartCard`, `echartsTheme`, and 7 lifted charts (each with optional `card` chrome):
  - `CommitsByWeekdayChart` (`PatternsSection.commitsByWeekday`)
  - `CommitsByMonthChart` (`PatternsSection.commitsByMonth`)
  - `CommitsByHourChart` (`PatternsSection.commitsByHour`)
  - `CommitsByYearChart` (`PatternsSection.commitsByYear`)
  - `LanguageBreakdownChart` (`PatternsSection.languageBreakdown`)
  - `BusFactorChart` (`HealthSection.busFactor`)
  - `HealthRadarChart` (`HealthSection.radarMetrics`)
- [x] **Desktop side**: `GitStats.tsx` consumes all 5 lifted charts from
  `canonical.*`; the 4 superseded local copies under
  `repoguru-spec/.../components/charts/` have been deleted.
- [x] **Browser side**: `BrowserAnalyzer` is wired into the in-browser
  app's `useGitStats`. The hook now exposes a `canonical: GitStatsData`
  slice alongside the legacy `analysis`. The 7 corresponding browser
  components (`CommitsByWeekday`, `CommitsByMonth`, `CommitsByHour`,
  `CommitsByYear`, `LanguageBreakdown`, `BusFactor`, `RadarHealthCard`)
  embed the lifted charts internally with `card={false}`. Components
  that need it (`BusFactor`, `RadarHealthCard`, `LanguageBreakdown`)
  source their props from `state.canonical.*` in `GitStatsPage.tsx`.
  `LanguageBreakdown` keeps its host-local treemap fallback alongside
  the lifted donut.
- [x] `pnpm typecheck` green across all 6 in-scope workspace packages.
- [x] Both adapter smoke tests pass.

## In flight

_Nothing currently in flight._

## Next

Two parallel tracks, either of which is now valuable because both apps
consume the shared chart for any lifted concept:

1. **Lift more desktop charts.** The simpler ones next:
   `CommitsByYearChart`, `LanguageBreakdownChart`, `TagHistoryChart`,
   `TimezoneChart` — each lift removes one entry from the desktop
   wire-shape `GitStatsData` interface in
   `repoguru-spec/.../hooks/useGitStats.ts` and lets the desktop
   `GitStats.tsx` page read from `canonical`. After lifting, swap the
   browser-side equivalent to render the lifted chart in the same
   commit so both apps benefit at once.
2. **Restore lost annotations on `BusFactorChart`.** When the browser
   `BusFactor` panel was swapped to the lifted ECharts chart, two D3-
   only annotations were dropped: a 50% threshold reference line and a
   vertical bus-factor marker line. Adding `markLine` series to the
   shared chart would restore them in both apps.

## Backlog — desktop charts not yet lifted

Ranked by lift complexity:

- **Trivial** (numeric array or simple object input):
  `CommitSizeHistogram`, `ConventionalCommitsChart`, `RepoGrowthChart`.
- **Medium** (light aggregation or structural mapping):
  `CodeFrequencyChart`, `PunchCardChart`, `TimezoneChart`,
  `FileChurnTable`, `FileCouplingTable`, `TagHistoryChart`,
  `RadarChart`.
- **Hard** (stateful layout, force simulation, or specialized rendering):
  `WordCloudChart`, `ContributorChart`, `CommitHeatmap`.

The desktop `useGitStats` hook still exposes a snake_case wire-shape
`GitStatsData` interface for un-lifted charts. That interface shrinks
each time a chart is lifted, and goes away naturally when the last
chart moves.

## Non-goals (deferred)

- Folding `repoguru/` and `repoguru-spec/` into a single deployable. The
  goal is shared views, not a single binary.
- Killing the wire-shape `GitStatsData` interface in
  `repoguru-spec/.../hooks/useGitStats.ts` ahead of schedule. It dies on
  its own as charts lift.

## Verification commands

```sh
pnpm typecheck
pnpm --filter @repoguru/desktop-adapter smoke
pnpm --filter @repoguru/browser-adapter smoke
```

Manual UI verification of the browser wiring still pending: run
`pnpm --filter repoguru dev`, scan a small public repo, and confirm
`state.canonical` populates, the 5 swapped charts render, and overall
progress/done UX is unchanged from before the BrowserAnalyzer wiring.
