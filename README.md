# repoguru-unified

Working directory for consolidating the two RepoGuru frontends into a single
shared view layer. The two original projects sit here verbatim (copied from
`~/Development/repoguru/` and `~/Development/repoguru-spec/`, both of which
remain untouched as backups). All consolidation work happens in `packages/`.

## Layout

```
packages/
├── core/              @repoguru/core              types + RepoAnalyzer port
├── ui/                @repoguru/ui                shared React views (charts)
├── browser-adapter/   @repoguru/browser-adapter   BrowserAnalyzer (mappers + smoke)
└── desktop-adapter/   @repoguru/desktop-adapter   GrpcAnalyzer (mappers + smoke)

repoguru/              ← in-browser app (workspace member, charts not yet swapped)
repoguru-spec/         ← Rust crate + Electron app (workspace member, lifted charts wired)
```

## Getting the contract running

```sh
pnpm install
pnpm typecheck
pnpm --filter @repoguru/desktop-adapter smoke
pnpm --filter @repoguru/browser-adapter smoke
```

Each smoke check exercises every wire→canonical mapper and runs the
streaming analyzer end-to-end against a stub client/runner.

## Charts lifted into `@repoguru/ui` so far

| Chart                  | Canonical input                           |
| ---------------------- | ----------------------------------------- |
| `CommitsByWeekdayChart`| `PatternsSection['commitsByWeekday']`     |
| `CommitsByMonthChart`  | `PatternsSection['commitsByMonth']`       |
| `CommitsByHourChart`   | `PatternsSection['commitsByHour']`        |
| `BusFactorChart`       | `HealthSection['busFactor']`              |
| `HealthRadarChart`     | `HealthSection['radarMetrics']`           |

All five are wired into the desktop `GitStats` page from `canonical.*`
and their local copies under `repoguru-spec/.../components/charts/` have
been deleted.

## Next migration step

See [`STATUS.md`](./STATUS.md) for the rolling progress log and the
current recommended next step (wiring `BrowserAnalyzer` into the
in-browser app, with substeps).
