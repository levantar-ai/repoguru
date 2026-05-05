// Unified GitStats schema — the canonical shape consumed by every view in
// @repoguru/ui. Both adapters (browser isomorphic-git pipeline and desktop
// gRPC client) must produce data that conforms to this contract.
//
// Conventions:
// - camelCase property names (TypeScript-idiomatic). The desktop adapter is
//   responsible for snake_case→camelCase mapping at the gRPC boundary.
// - String IDs for graph nodes/edges (the browser uses login strings; the
//   desktop side maps numeric author_id → string at the boundary).
// - Object form preferred over tuple form for any payload with more than two
//   semantically distinct numbers (tuples don't survive type-driven refactors).
// - Every section is independently optional on the aggregate so that views
//   can render progressively as sections stream in.

// ────────────────────────────────────────────────────────────────────────────
// Overview
// ────────────────────────────────────────────────────────────────────────────

export interface RepoOverview {
  /** Owner/org slug — empty string for local-only scans. */
  owner: string;
  /** Repository name. */
  repo: string;
  totalCommits: number;
  totalLinesOfCode: number;
  binaryFileCount: number;
  /** ISO date of the first commit reachable from the analysed ref. */
  firstCommitDate: string;
  repoAgeDays: number;
}

// ────────────────────────────────────────────────────────────────────────────
// Activity
// ────────────────────────────────────────────────────────────────────────────

export interface TimeseriesPoint {
  /** ISO date marking the start of the bucket (week or month). */
  periodStart: string;
  commits: number;
  insertions: number;
  deletions: number;
  authors: number;
}

export interface CumulativeFilePoint {
  date: string;
  count: number;
}

export interface FileOperationCount {
  /** "added" | "modified" | "deleted" | "renamed" | "copied" */
  operation: string;
  count: number;
}

export interface LinesByExtension {
  ext: string;
  additions: number;
  deletions: number;
}

export interface LinesStatsSummary {
  label: string;
  min: number;
  max: number;
  avg: number;
  median: number;
  total: number;
}

export interface ActivitySection {
  timeseries: TimeseriesPoint[];
  cumulativeFiles: CumulativeFilePoint[];
  fileOperations: FileOperationCount[];
  linesByExtension: LinesByExtension[];
  linesStatsSummary: LinesStatsSummary[];
}

// ────────────────────────────────────────────────────────────────────────────
// Contributors
// ────────────────────────────────────────────────────────────────────────────

export interface Contributor {
  /** Stable identifier — login when available, otherwise email or name. */
  id: string;
  name: string;
  email?: string;
  /** GitHub login when known (browser flow has it; desktop usually doesn't). */
  login?: string;
  avatarUrl?: string;
  commits: number;
  insertions: number;
  deletions: number;
  /** Unix seconds of first/last commit. */
  firstCommit: number;
  lastCommit: number;
  /** Share of total commits, 0..100. */
  commitPercentage?: number;
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

export interface AuthorOfPeriod {
  /** Year ("2024") or year-month ("2024-03") depending on context. */
  period: string;
  authorName: string;
  commits: number;
  totalAuthors: number;
}

export interface AuthorTimelinePoint {
  authorName: string;
  /** [ISO period, commit count] series. */
  points: Array<[string, number]>;
}

export interface OwnershipEntry {
  path: string;
  ownerName: string;
  lines: number;
}

export interface ContributorsSection {
  contributors: Contributor[];
  network: {
    nodes: ContributorNode[];
    edges: ContributorEdge[];
  };
  authorOfYear?: AuthorOfPeriod[];
  authorOfMonth?: AuthorOfPeriod[];
  authorTimelines?: AuthorTimelinePoint[];
  /** Per-file ownership from blame-style analysis — desktop only for now. */
  codeOwnership?: OwnershipEntry[];
}

// ────────────────────────────────────────────────────────────────────────────
// Codebase
// ────────────────────────────────────────────────────────────────────────────

export interface HotspotEntry {
  path: string;
  commits: number;
  totalChurn: number;
  distinctAuthors: number;
}

export interface FileCouplingEntry {
  fileA: string;
  fileB: string;
  /** Number of co-changes. */
  count: number;
  /** Coupling strength as a percentage 0..100. */
  couplingPct: number;
}

export interface FileChurnEntry {
  filename: string;
  changeCount: number;
  totalAdditions: number;
  totalDeletions: number;
  /** Contributor IDs (matches Contributor.id). */
  contributors: string[];
}

export interface ChangeChain {
  files: string[];
  occurrences: number;
  avgSpanHours: number;
  /** 0..1 confidence that this chain is meaningful. */
  confidence: number;
}

export interface ExtensionMonthlyChurn {
  months: string[];
  extensions: string[];
  /** data[monthIndex][extensionIndex] = lines changed. */
  data: number[][];
}

export interface CodebaseSection {
  hotspots: HotspotEntry[];
  fileCoupling: FileCouplingEntry[];
  fileChurn?: FileChurnEntry[];
  sequentialCoupling?: ChangeChain[];
  linesByExtTime?: ExtensionMonthlyChurn;
}

// ────────────────────────────────────────────────────────────────────────────
// Patterns
// ────────────────────────────────────────────────────────────────────────────

export interface PunchCardPoint {
  /** 0=Sun .. 6=Sat */
  day: number;
  /** 0..23 */
  hour: number;
  commits: number;
}

export interface CommitSizeBucket {
  label: string;
  /** Lower bound (inclusive). Optional for rendering-only buckets. */
  min?: number;
  /** Upper bound (exclusive). */
  max?: number;
  count: number;
}

export interface WeeklyActivity {
  /** ISO date of the Sunday starting the week. */
  weekStart: string;
  total: number;
  /** 7 entries, Sun=0 .. Sat=6. Browser flow populates this; desktop may not. */
  days?: number[];
}

export interface WordFrequency {
  word: string;
  count: number;
}

export interface LanguageEntry {
  language: string;
  /** 0..100 */
  percentage: number;
  fileCount?: number;
  totalLines?: number;
  /** Bytes attributed to the language (browser flow via GitHub /languages). */
  bytes?: number;
}

export interface CommitMessageStats {
  totalCommits: number;
  averageLength: number;
  medianLength: number;
  mergeCommitCount: number;
  /** 0..100 */
  conventionalPercentage: number;
}

export interface CommitsByYear {
  year: number;
  count: number;
}

export interface CommitsByExtension {
  ext: string;
  count: number;
}

export interface CommitsByDomain {
  /** Email domain part after the '@'. */
  domain: string;
  count: number;
}

export interface PatternsSection {
  /** Length 7, Sun=0 .. Sat=6. */
  commitsByWeekday: number[];
  /** Length 12, Jan=0 .. Dec=11. */
  commitsByMonth: number[];
  commitsByYear: CommitsByYear[];
  /** Length 24, hour 0..23. */
  commitsByHour: number[];
  punchCard: PunchCardPoint[];
  commitSizeHistogram: CommitSizeBucket[];
  weeklyActivity: WeeklyActivity[];
  wordFrequencies: WordFrequency[];
  languageBreakdown: LanguageEntry[];
  /** Keyed by commit type ("feat", "fix", "docs", …, "other"). */
  conventionalCommits: Record<string, number>;
  commitMessages?: CommitMessageStats;
  commitsByExtension?: CommitsByExtension[];
  commitsByDomain?: CommitsByDomain[];
}

// ────────────────────────────────────────────────────────────────────────────
// Health
// ────────────────────────────────────────────────────────────────────────────

export interface BusFactor {
  /** Minimum number of contributors holding >50% of commits. */
  factor: number;
  /** Lorenz curve points, 0..1, length = number of contributors. */
  lorenz: number[];
  /** Herfindahl–Hirschman index of contribution concentration, 0..1. */
  herfindahlIndex?: number;
  cumulativeContributors?: Array<{
    contributorId: string;
    cumulativePercentage: number;
  }>;
}

export interface RadarMetric {
  label: string;
  /** 0..100 score. */
  value: number;
}

export interface TagSummary {
  name: string;
  date: string;
  /** Unix seconds. */
  timestamp: number;
  commitsSincePrev: number;
}

export interface RepoGrowthPoint {
  date: string;
  cumulativeAdditions: number;
  cumulativeDeletions: number;
  netGrowth: number;
}

export interface LocOverTimePoint {
  date: string;
  loc: number;
}

export interface ActivePeriod {
  period: string;
  commits: number;
  insertions: number;
  deletions: number;
}

export interface HealthSection {
  busFactor: BusFactor;
  radarMetrics: RadarMetric[];
  tagHistory: TagSummary[];
  repoGrowth?: RepoGrowthPoint[];
  locOverTime?: LocOverTimePoint[];
  topActivePeriods?: ActivePeriod[];
}

// ────────────────────────────────────────────────────────────────────────────
// Timezone
// ────────────────────────────────────────────────────────────────────────────

export interface TimezoneBucket {
  /** UTC offset in minutes (e.g. -480 for PST, 60 for CET). */
  offset: number;
  count: number;
}

export interface TimezoneSection {
  buckets: TimezoneBucket[];
}

// ────────────────────────────────────────────────────────────────────────────
// Aggregate
// ────────────────────────────────────────────────────────────────────────────

/** The canonical section names — used by analyzer streaming and UI gating. */
export const GIT_STATS_SECTIONS = [
  'overview',
  'activity',
  'contributors',
  'codebase',
  'patterns',
  'health',
  'timezone',
] as const;

export type GitStatsSectionName = (typeof GIT_STATS_SECTIONS)[number];

/**
 * The full unified shape. Every section is optional so the UI can render
 * incrementally as the analyzer streams sections in.
 */
export interface GitStatsData {
  overview?: RepoOverview;
  activity?: ActivitySection;
  contributors?: ContributorsSection;
  codebase?: CodebaseSection;
  patterns?: PatternsSection;
  health?: HealthSection;
  timezone?: TimezoneSection;
}

/** Discriminated union used by streaming analyzers. */
export type GitStatsSection =
  | { name: 'overview'; data: RepoOverview }
  | { name: 'activity'; data: ActivitySection }
  | { name: 'contributors'; data: ContributorsSection }
  | { name: 'codebase'; data: CodebaseSection }
  | { name: 'patterns'; data: PatternsSection }
  | { name: 'health'; data: HealthSection }
  | { name: 'timezone'; data: TimezoneSection };
