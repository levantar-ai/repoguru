// The browser app's analysis-result types — the in-browser repoguru
// `analyzeGitStats()` produces a `GitStatsAnalysis` of this shape, and
// every chart in @repoguru/ui consumes a slice of it. This file is the
// authoritative type contract for the *view layer*; the canonical
// section types in `./gitStats.ts` are the streaming/adapter contract.
//
// Both adapters ultimately produce a `GitStatsAnalysis` (the browser
// adapter natively, the desktop adapter via a small canonical→legacy
// projection) so the same React tree renders in both apps.

// ── GitHub-shape pieces preserved by the analysis ──

export interface GitHubCommitActivity {
  total: number;
  week: number; // unix seconds
  days: number[]; // length 7, Sun..Sat
}

export type GitHubCodeFrequency = [number, number, number]; // [unix seconds, additions, deletions]

// ── Processed / derived types ──

export interface ContributorSummary {
  login: string;
  avatarUrl: string;
  totalCommits: number;
  totalAdditions: number;
  totalDeletions: number;
  commitPercentage: number;
  firstCommitWeek: number;
  lastCommitWeek: number;
}

export interface FileChurnEntry {
  filename: string;
  changeCount: number;
  totalAdditions: number;
  totalDeletions: number;
  contributors: string[];
}

export interface CommitMessageStats {
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
  wordFrequency: { word: string; count: number }[];
}

export interface BusFactorData {
  busFactor: number;
  herfindahlIndex: number;
  cumulativeContributors: {
    login: string;
    cumulativePercentage: number;
  }[];
}

export interface CommitSizeDistribution {
  buckets: {
    label: string;
    min: number;
    max: number;
    count: number;
  }[];
}

export interface RepoGrowthPoint {
  date: string;
  cumulativeAdditions: number;
  cumulativeDeletions: number;
  netGrowth: number;
}

export interface PunchCardData {
  day: number; // 0=Sun .. 6=Sat
  hour: number; // 0-23
  commits: number;
}

export interface WeeklyActivity {
  weekStart: string;
  total: number;
  days: number[];
}

export interface LanguageEntry {
  name: string;
  bytes: number;
  percentage: number;
}

export interface AuthorOfPeriod {
  period: string;
  authorName: string;
  commits: number;
  totalAuthors: number;
}

export interface AuthorTimeline {
  authorName: string;
  points: [string, number][];
}

export interface ContributorNode {
  id: string;
  name: string;
}

export interface ContributorEdge {
  source: string;
  target: string;
  weight: number;
}

export interface OwnershipEntry {
  path: string;
  ownerName: string;
  lines: number;
}

export interface ChangeChain {
  files: string[];
  occurrences: number;
  avgSpanHours: number;
  confidence: number;
}

export interface ExtMonthlyChurn {
  months: string[];
  extensions: string[];
  data: number[][];
}

export interface LinesStatsSummary {
  label: string;
  min: number;
  max: number;
  avg: number;
  median: number;
  total: number;
}

export interface TagSummary {
  name: string;
  date: string;
  timestamp: number;
  commitsSincePrev: number;
}

export interface RadarMetric {
  label: string;
  value: number;
}

export interface HotspotEntry {
  path: string;
  commits: number;
  distinctAuthors: number;
  totalChurn: number;
}

export interface ActivePeriod {
  period: string;
  commits: number;
  insertions: number;
  deletions: number;
}

export interface GitStatsAnalysis {
  owner: string;
  repo: string;
  totalCommits: number;
  totalLinesOfCode: number;
  binaryFileCount: number;
  contributors: ContributorSummary[];
  busFactor: BusFactorData;
  fileChurn: FileChurnEntry[];
  commitMessages: CommitMessageStats;
  commitSizeDistribution: CommitSizeDistribution;
  repoGrowth: RepoGrowthPoint[];
  punchCard: PunchCardData[];
  weeklyActivity: WeeklyActivity[];
  languages: LanguageEntry[];
  commitActivity: GitHubCommitActivity[] | null;
  codeFrequency: GitHubCodeFrequency[] | null;
  commitsByWeekday: number[];
  commitsByMonth: number[];
  commitsByYear: { year: number; count: number }[];
  commitsByExtension: { ext: string; count: number }[];
  linesByExtension: { ext: string; additions: number; deletions: number }[];
  fileCoupling: { file1: string; file2: string; cochanges: number }[];
  firstCommitDate: string;
  repoAgeDays: number;
  commitsByHour: number[];
  commitsByDomain: { domain: string; count: number }[];
  authorOfYear: AuthorOfPeriod[];
  authorOfMonth: AuthorOfPeriod[];
  authorTimelines: AuthorTimeline[];
  contributorNodes: ContributorNode[];
  contributorEdges: ContributorEdge[];
  codeOwnership: OwnershipEntry[];
  timezoneData: { offset: number; count: number }[];
  sequentialCoupling: ChangeChain[];
  linesByExtTime: ExtMonthlyChurn | null;
  linesStatsSummary: LinesStatsSummary[];
  cumulativeFiles: { date: string; count: number }[];
  fileOperations: { operation: string; count: number }[];
  tagHistory: TagSummary[];
  locOverTime: { date: string; loc: number }[];
  radarMetrics: RadarMetric[];
  hotspots: HotspotEntry[];
  topActivePeriods: ActivePeriod[];
}
