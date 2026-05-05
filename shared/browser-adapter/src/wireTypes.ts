// Source-of-truth shape produced by the in-browser analysis pipeline
// (clone via isomorphic-git → analyzeGitStats). Mirrors the
// `GitStatsAnalysis` interface in
//   repoguru/src/types/gitStats.ts
// Intentionally pinned here rather than imported so the mapper is the
// single point that has to track upstream drift.

export interface BrowserContributorSummary {
  login: string;
  avatarUrl: string;
  totalCommits: number;
  totalAdditions: number;
  totalDeletions: number;
  /** 0..100 */
  commitPercentage: number;
  firstCommitWeek: number;
  lastCommitWeek: number;
}

export interface BrowserBusFactorData {
  busFactor: number;
  herfindahlIndex: number;
  cumulativeContributors: Array<{
    login: string;
    cumulativePercentage: number;
  }>;
}

export interface BrowserFileChurnEntry {
  filename: string;
  changeCount: number;
  totalAdditions: number;
  totalDeletions: number;
  contributors: string[];
}

export interface BrowserCommitMessageStats {
  totalCommits: number;
  averageLength: number;
  medianLength: number;
  mergeCommitCount: number;
  conventionalCommits: {
    feat: number;
    fix: number;
    docs: number;
    style: number;
    refactor: number;
    test: number;
    chore: number;
    ci: number;
    perf: number;
    build: number;
    other: number;
  };
  conventionalPercentage: number;
  wordFrequency: Array<{ word: string; count: number }>;
}

export interface BrowserCommitSizeBucket {
  label: string;
  min: number;
  max: number;
  count: number;
}

export interface BrowserRepoGrowthPoint {
  date: string;
  cumulativeAdditions: number;
  cumulativeDeletions: number;
  netGrowth: number;
}

export interface BrowserPunchCardPoint {
  day: number;
  hour: number;
  commits: number;
}

export interface BrowserWeeklyActivity {
  weekStart: string;
  total: number;
  days: number[];
}

export interface BrowserLanguageEntry {
  name: string;
  bytes: number;
  /** 0..100 */
  percentage: number;
}

export interface BrowserAuthorOfPeriod {
  period: string;
  authorName: string;
  commits: number;
  totalAuthors: number;
}

export interface BrowserAuthorTimeline {
  authorName: string;
  points: Array<[string, number]>;
}

export interface BrowserContributorNode {
  id: string;
  name: string;
}

export interface BrowserContributorEdge {
  source: string;
  target: string;
  weight: number;
}

export interface BrowserOwnershipEntry {
  path: string;
  ownerName: string;
  lines: number;
}

export interface BrowserChangeChain {
  files: string[];
  occurrences: number;
  avgSpanHours: number;
  confidence: number;
}

export interface BrowserExtMonthlyChurn {
  months: string[];
  extensions: string[];
  data: number[][];
}

export interface BrowserLinesStatsSummary {
  label: string;
  min: number;
  max: number;
  avg: number;
  median: number;
  total: number;
}

export interface BrowserTagSummary {
  name: string;
  date: string;
  timestamp: number;
  commitsSincePrev: number;
}

export interface BrowserRadarMetric {
  label: string;
  value: number;
}

export interface BrowserHotspotEntry {
  path: string;
  commits: number;
  distinctAuthors: number;
  totalChurn: number;
}

export interface BrowserActivePeriod {
  period: string;
  commits: number;
  insertions: number;
  deletions: number;
}

/** [timestamp, additions, deletions] (GitHub /stats/code_frequency). */
export type BrowserCodeFrequency = [number, number, number];

export interface BrowserGitStatsAnalysis {
  owner: string;
  repo: string;
  totalCommits: number;
  totalLinesOfCode: number;
  binaryFileCount: number;
  contributors: BrowserContributorSummary[];
  busFactor: BrowserBusFactorData;
  fileChurn: BrowserFileChurnEntry[];
  commitMessages: BrowserCommitMessageStats;
  commitSizeDistribution: { buckets: BrowserCommitSizeBucket[] };
  repoGrowth: BrowserRepoGrowthPoint[];
  punchCard: BrowserPunchCardPoint[];
  weeklyActivity: BrowserWeeklyActivity[];
  languages: BrowserLanguageEntry[];
  codeFrequency: BrowserCodeFrequency[] | null;
  commitsByWeekday: number[];
  commitsByMonth: number[];
  commitsByYear: Array<{ year: number; count: number }>;
  commitsByExtension: Array<{ ext: string; count: number }>;
  linesByExtension: Array<{ ext: string; additions: number; deletions: number }>;
  fileCoupling: Array<{ file1: string; file2: string; cochanges: number }>;
  firstCommitDate: string;
  repoAgeDays: number;
  commitsByHour: number[];
  commitsByDomain: Array<{ domain: string; count: number }>;
  authorOfYear: BrowserAuthorOfPeriod[];
  authorOfMonth: BrowserAuthorOfPeriod[];
  authorTimelines: BrowserAuthorTimeline[];
  contributorNodes: BrowserContributorNode[];
  contributorEdges: BrowserContributorEdge[];
  codeOwnership: BrowserOwnershipEntry[];
  timezoneData: Array<{ offset: number; count: number }>;
  sequentialCoupling: BrowserChangeChain[];
  linesByExtTime: BrowserExtMonthlyChurn | null;
  linesStatsSummary: BrowserLinesStatsSummary[];
  cumulativeFiles: Array<{ date: string; count: number }>;
  fileOperations: Array<{ operation: string; count: number }>;
  tagHistory: BrowserTagSummary[];
  locOverTime: Array<{ date: string; loc: number }>;
  radarMetrics: BrowserRadarMetric[];
  hotspots: BrowserHotspotEntry[];
  topActivePeriods: BrowserActivePeriod[];
}
