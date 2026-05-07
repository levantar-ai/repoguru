// Smoke check for browserAnalyzer mappers + streaming. Run with:
//   pnpm --filter @repoguru/browser-adapter smoke

import { GIT_STATS_SECTIONS, runAnalyzer, type ProgressEvent } from '@repoguru/core';
import {
  BrowserAnalyzer,
  type BrowserAnalysisRunner,
  mapBrowserAnalysis,
  mapContributors,
  mapHealth,
  mapPatterns,
  mapCodebase,
  mapActivity,
} from './browserAnalyzer.js';
import type { BrowserGitStatsAnalysis } from './wireTypes.js';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`smoke failed: ${msg}`);
}

// ── Fixture ─────────────────────────────────────────────────────────────────

const analysis: BrowserGitStatsAnalysis = {
  owner: 'levantar-ai',
  repo: 'repoguru',
  totalCommits: 1000,
  totalLinesOfCode: 50000,
  binaryFileCount: 10,
  contributors: [
    {
      login: 'ada',
      avatarUrl: 'https://example.com/ada.png',
      totalCommits: 600,
      totalAdditions: 30000,
      totalDeletions: 5000,
      commitPercentage: 60,
      firstCommitWeek: 1640000000,
      lastCommitWeek: 1700000000,
    },
    {
      login: 'grace',
      avatarUrl: 'https://example.com/grace.png',
      totalCommits: 400,
      totalAdditions: 20000,
      totalDeletions: 3000,
      commitPercentage: 40,
      firstCommitWeek: 1650000000,
      lastCommitWeek: 1700000000,
    },
  ],
  busFactor: {
    busFactor: 1,
    herfindahlIndex: 0.52,
    cumulativeContributors: [
      { login: 'ada', cumulativePercentage: 60 },
      { login: 'grace', cumulativePercentage: 100 },
    ],
  },
  fileChurn: [
    {
      filename: 'src/foo.ts',
      changeCount: 50,
      totalAdditions: 800,
      totalDeletions: 200,
      contributors: ['ada', 'grace'],
    },
  ],
  commitMessages: {
    totalCommits: 1000,
    averageLength: 42,
    medianLength: 35,
    mergeCommitCount: 50,
    conventionalCommits: {
      feat: 200,
      fix: 300,
      docs: 50,
      style: 10,
      refactor: 100,
      test: 80,
      chore: 60,
      ci: 30,
      perf: 20,
      build: 10,
      other: 140,
    },
    conventionalPercentage: 86,
    wordFrequency: [
      { word: 'fix', count: 300 },
      { word: 'feat', count: 200 },
    ],
  },
  commitSizeDistribution: {
    buckets: [
      { label: '0-10', min: 0, max: 10, count: 400 },
      { label: '11-100', min: 11, max: 100, count: 500 },
      { label: '100+', min: 100, max: 999999, count: 100 },
    ],
  },
  repoGrowth: [
    {
      date: '2024-01-01',
      cumulativeAdditions: 1000,
      cumulativeDeletions: 100,
      netGrowth: 900,
    },
  ],
  punchCard: [{ day: 1, hour: 9, commits: 25 }],
  weeklyActivity: [{ weekStart: '2024-01-07', total: 50, days: [10, 5, 8, 9, 12, 4, 2] }],
  languages: [
    { name: 'TypeScript', bytes: 100000, percentage: 70 },
    { name: 'CSS', bytes: 30000, percentage: 30 },
  ],
  codeFrequency: [[Math.floor(Date.parse('2024-01-07') / 1000), 500, 100]],
  commitsByWeekday: [10, 20, 30, 25, 40, 5, 2],
  commitsByMonth: Array(12).fill(83),
  commitsByYear: [
    { year: 2023, count: 600 },
    { year: 2024, count: 400 },
  ],
  commitsByExtension: [{ ext: '.ts', count: 700 }],
  linesByExtension: [{ ext: '.ts', additions: 30000, deletions: 5000 }],
  fileCoupling: [{ file1: 'a.ts', file2: 'b.ts', cochanges: 100 }],
  firstCommitDate: '2022-01-15',
  repoAgeDays: 1300,
  commitsByHour: Array(24).fill(40),
  commitsByDomain: [{ domain: 'example.com', count: 800 }],
  authorOfYear: [{ period: '2024', authorName: 'ada', commits: 400, totalAuthors: 2 }],
  authorOfMonth: [{ period: '2024-01', authorName: 'ada', commits: 50, totalAuthors: 2 }],
  authorTimelines: [{ authorName: 'ada', points: [['2024-01', 50]] }],
  contributorNodes: [
    { id: 'ada', name: 'ada' },
    { id: 'grace', name: 'grace' },
  ],
  contributorEdges: [{ source: 'ada', target: 'grace', weight: 30 }],
  codeOwnership: [{ path: 'src/foo.ts', ownerName: 'ada', lines: 800 }],
  timezoneData: [
    { offset: 0, count: 600 },
    { offset: 60, count: 400 },
  ],
  sequentialCoupling: [],
  linesByExtTime: null,
  linesStatsSummary: [
    {
      label: 'commit-size',
      min: 1,
      max: 999,
      avg: 50,
      median: 30,
      total: 50000,
    },
  ],
  cumulativeFiles: [{ date: '2024-01-01', count: 200 }],
  fileOperations: [{ operation: 'modified', count: 800 }],
  tagHistory: [
    {
      name: 'v1.0.0',
      date: '2024-06-01',
      timestamp: 1717200000,
      commitsSincePrev: 234,
    },
  ],
  locOverTime: [{ date: '2024-01-01', loc: 50000 }],
  radarMetrics: [{ label: 'documentation', value: 75 }],
  hotspots: [{ path: 'src/foo.ts', commits: 50, distinctAuthors: 4, totalChurn: 1000 }],
  topActivePeriods: [{ period: '2024-01', commits: 100, insertions: 1000, deletions: 200 }],
};

// ── Mapper checks ───────────────────────────────────────────────────────────

const slice = mapBrowserAnalysis(analysis);

assert(slice.overview?.owner === 'levantar-ai', 'overview.owner');
assert(slice.contributors?.contributors[0]?.id === 'ada', 'contributor id = login');
assert(slice.contributors?.contributors[0]?.avatarUrl?.endsWith('ada.png'), 'avatarUrl preserved');
assert(slice.contributors?.contributors[0]?.commitPercentage === 60, 'commitPercentage preserved');
assert(slice.codebase?.fileCoupling[0]?.fileA === 'a.ts', 'fileCoupling renamed (file1 → fileA)');
assert(slice.codebase?.fileCoupling[0]?.count === 100, 'fileCoupling count = cochanges');
assert(
  Math.round((slice.codebase?.fileCoupling[0]?.couplingPct ?? 0) * 10) === 100,
  'couplingPct = 100/1000*100 = 10',
);
assert(slice.health?.busFactor.factor === 1, 'busFactor factor renamed');
assert(slice.health?.busFactor.lorenz.length === 2, 'lorenz derived from cumulativeContributors');
assert(slice.health?.busFactor.lorenz[0] === 0.6, 'lorenz[0] = 0.6');
assert(
  slice.patterns?.languageBreakdown[0]?.language === 'TypeScript',
  'language renamed (name → language)',
);
assert(
  slice.patterns?.wordFrequencies[0]?.word === 'fix',
  'wordFrequencies surfaced from commitMessages',
);
assert(slice.patterns?.conventionalCommits.feat === 200, 'conventionalCommits flattened');
assert(
  slice.patterns?.commitMessages?.conventionalPercentage === 86,
  'commitMessages preserved (top fields)',
);
assert(
  slice.activity?.timeseries[0]?.commits === 50,
  'timeseries[0].commits = weeklyActivity total',
);
assert(
  slice.activity?.timeseries[0]?.insertions === 500,
  'timeseries[0].insertions joined from codeFrequency',
);
assert(slice.activity?.timeseries[0]?.authors === 0, 'timeseries authors = 0 (browser unknown)');
assert(slice.timezone?.buckets[1]?.offset === 60, 'timezone passed through');

// ── Streaming analyzer ──────────────────────────────────────────────────────

const runner: BrowserAnalysisRunner = {
  async run(_req, onProgress) {
    onProgress({ phase: 'cloning', message: 'cloning…', progress: 0.1 });
    onProgress({ phase: 'analyzing', message: 'analyzing…', progress: 0.7 });
    return analysis;
  },
};

const analyzer = new BrowserAnalyzer(runner);
let progressCount = 0;
let sectionCount = 0;
let doneData: unknown = null;
for await (const event of analyzer.analyze({
  source: 'levantar-ai/repoguru',
})) {
  if (event.kind === 'progress') progressCount++;
  if (event.kind === 'section') sectionCount++;
  if (event.kind === 'done') doneData = event.data;
  if (event.kind === 'error') throw event.error;
}
assert(progressCount === 2, `expected 2 progress events, got ${progressCount}`);
assert(sectionCount === 7, `expected 7 section events, got ${sectionCount}`);
assert(doneData !== null, 'received done event');

// ── runAnalyzer convenience ─────────────────────────────────────────────────

const data = await runAnalyzer(new BrowserAnalyzer(runner), {
  source: 'levantar-ai/repoguru',
});
for (const name of GIT_STATS_SECTIONS) {
  assert(data[name] !== undefined, `aggregate has section ${name}`);
}

console.log('browserAnalyzer smoke check: OK');
console.log(`  contributors: ${data.contributors?.contributors.length}`);
console.log(`  hotspots:     ${data.codebase?.hotspots.length}`);
console.log(
  `  timeseries:   ${data.activity?.timeseries.length} pt(s), insertions=${data.activity?.timeseries[0]?.insertions}`,
);
console.log(
  `  bus factor:   ${data.health?.busFactor.factor}, lorenz=[${data.health?.busFactor.lorenz.join(', ')}]`,
);

// Silence unused-import lints in case someone tightens noUnusedLocals later.
void mapContributors;
void mapHealth;
void mapPatterns;
void mapCodebase;
void mapActivity;
void ({} as ProgressEvent);
