// Smoke check for grpcAnalyzer mappers. Run with:
//   pnpm --filter @repoguru/desktop-adapter smoke
//
// Exercises every mapper against a representative wire payload, then runs
// the full analyzer with a stub GrpcSectionClient to verify the streaming
// path produces a valid GitStatsData. Throws on any inconsistency.

import { GIT_STATS_SECTIONS, runAnalyzer } from '@repoguru/core';
import {
  GrpcAnalyzer,
  type GrpcSectionClient,
  mapActivity,
  mapCodebase,
  mapContributors,
  mapHealth,
  mapOverview,
  mapPatterns,
  mapTimezone,
} from './grpcAnalyzer.js';
import type {
  WireActivity,
  WireCodebase,
  WireContributors,
  WireHealth,
  WireMetrics,
  WirePatterns,
  WireTimezone,
} from './wireTypes.js';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`smoke failed: ${msg}`);
}

// ── Fixtures ────────────────────────────────────────────────────────────────

const metrics: WireMetrics = {
  authors: { '1': 'Ada Lovelace', '2': 'Grace Hopper' },
  owner: 'levantar-ai',
  repo: 'repoguru',
  total_commits: 1234,
  total_lines_of_code: 56789,
  binary_file_count: 12,
  first_commit_date: '2022-01-15',
  repo_age_days: 1300,
};

const activity: WireActivity = {
  timeseries: [
    { period_start: '2024-01-01', commits: 5, insertions: 100, deletions: 20, authors: 2 },
  ],
  cumulative_files: [['2024-01-01', 42]],
  file_operations: [['added', 7], ['modified', 19]],
  lines_by_ext: [['.ts', 1000, 200]],
  lines_stats_summary: [{ label: 'overall', min: 1, max: 99, avg: 50, median: 50, total: 1000 }],
};

const contributors: WireContributors = {
  authors: [
    { author_id: 1, commits: 800, insertions: 50000, deletions: 10000, first_commit: 1640000000, last_commit: 1700000000 },
    { author_id: 2, commits: 434, insertions: 30000, deletions: 5000, first_commit: 1650000000, last_commit: 1700000000 },
  ],
  contributor_network_nodes: [[1, 'Ada Lovelace'], [2, 'Grace Hopper']],
  contributor_network_edges: [{ source: 1, target: 2, weight: 17 }],
};

const codebase: WireCodebase = {
  hotspots: [{ path: 'src/foo.ts', commits: 50, total_churn: 800, distinct_authors: 4 }],
  file_coupling: [{ file_a: 'a.ts', file_b: 'b.ts', count: 25, coupling_pct: 76.5 }],
};

const patterns: WirePatterns = {
  commits_by_weekday: [10, 20, 30, 25, 40, 5, 2],
  commits_by_month: Array(12).fill(10),
  commits_by_year: { '2023': 600, '2024': 634 },
  commits_by_hour: Array(24).fill(5),
  punch_card: [[1, 9, 10], [3, 14, 25]],
  commit_size_histogram: [['0-10', 100], ['11-100', 200]],
  weekly_activity: [['2024-01-07', 50]],
  word_frequencies: [['fix', 120], ['feat', 80]],
  language_breakdown: [{ language: 'TypeScript', percentage: 70, file_count: 200, total_lines: 30000 }],
  conventional_commits: { feat: 80, fix: 120, other: 30 },
};

const health: WireHealth = {
  bus_factor: { factor: 2, lorenz: [0, 0.4, 0.7, 1.0] },
  radar_metrics: [{ label: 'documentation', value: 75 }],
  tag_history: [{ name: 'v1.0.0', date: '2024-06-01', timestamp: 1717200000, commits_since_prev: 234 }],
};

const timezone: WireTimezone = {
  timezone_data: [[-480, 50], [60, 200]],
};

// ── Mapper checks ───────────────────────────────────────────────────────────

const overviewOut = mapOverview(metrics);
assert(overviewOut.owner === 'levantar-ai', 'overview.owner');
assert(overviewOut.totalCommits === 1234, 'overview.totalCommits');

const activityOut = mapActivity(activity);
assert(activityOut.timeseries[0]?.periodStart === '2024-01-01', 'timeseries.periodStart');
assert(activityOut.cumulativeFiles[0]?.date === '2024-01-01', 'cumulativeFiles.date');
assert(activityOut.fileOperations[0]?.operation === 'added', 'fileOperations.operation');
assert(activityOut.linesByExtension[0]?.ext === '.ts', 'linesByExtension.ext');

const contribOut = mapContributors(contributors, metrics.authors ?? {});
assert(contribOut.contributors[0]?.name === 'Ada Lovelace', 'contributor name resolved');
assert(contribOut.contributors[0]?.id === '1', 'contributor id stringified');
assert(
  Math.round((contribOut.contributors[0]?.commitPercentage ?? 0) * 100) === 6483,
  'commitPercentage = 800/1234*100 ≈ 64.83',
);
assert(contribOut.network.nodes[0]?.id === '1', 'network node id stringified');
assert(contribOut.network.edges[0]?.source === '1', 'network edge source stringified');

const codebaseOut = mapCodebase(codebase);
assert(codebaseOut.hotspots[0]?.totalChurn === 800, 'hotspot totalChurn renamed');
assert(codebaseOut.fileCoupling[0]?.fileA === 'a.ts', 'fileCoupling fileA renamed');
assert(codebaseOut.fileCoupling[0]?.couplingPct === 76.5, 'fileCoupling couplingPct renamed');

const patternsOut = mapPatterns(patterns);
assert(patternsOut.commitsByYear[0]?.year === 2023, 'commitsByYear sorted ascending');
assert(patternsOut.commitsByYear[1]?.count === 634, 'commitsByYear count preserved');
assert(patternsOut.punchCard[0]?.day === 1, 'punchCard tuple → object');
assert(patternsOut.weeklyActivity[0]?.weekStart === '2024-01-07', 'weeklyActivity tuple → object');
assert(patternsOut.languageBreakdown[0]?.fileCount === 200, 'language fileCount renamed');

const healthOut = mapHealth(health);
assert(healthOut.busFactor.factor === 2, 'busFactor preserved');
assert(healthOut.tagHistory[0]?.commitsSincePrev === 234, 'tag commitsSincePrev renamed');

const tzOut = mapTimezone(timezone);
assert(tzOut.buckets[0]?.offset === -480, 'timezone tuple → object');

// ── Analyzer end-to-end ─────────────────────────────────────────────────────

const stubClient: GrpcSectionClient = {
  async getReport() {
    return { metrics_json: JSON.stringify(metrics) };
  },
  async getSection(_outPath, name) {
    const payload = { activity, contributors, codebase, patterns, health, timezone }[name];
    if (!payload) throw new Error(`unknown section ${name}`);
    return { data_json: JSON.stringify(payload) };
  },
};

const analyzer = new GrpcAnalyzer(stubClient);
const data = await runAnalyzer(analyzer, {
  source: '/tmp/repo',
  outPath: '/tmp/repoguru-scan',
});

for (const name of GIT_STATS_SECTIONS) {
  assert(data[name] !== undefined, `aggregate has section ${name}`);
}

console.log('grpcAnalyzer smoke check: OK');
console.log(`  contributors: ${data.contributors?.contributors.length}`);
console.log(`  hotspots:     ${data.codebase?.hotspots.length}`);
console.log(`  years:        ${data.patterns?.commitsByYear.map((y) => y.year).join(', ')}`);
