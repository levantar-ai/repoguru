// ── Raw GitHub API response types for stats endpoints ──

export interface GitHubCommitAuthor {
  login?: string;
  avatar_url?: string;
}

export interface GitHubCommitResponse {
  sha: string;
  commit: {
    message: string;
    author: {
      name: string;
      email: string;
      date: string;
    };
    committer: {
      name: string;
      date: string;
    };
  };
  author: GitHubCommitAuthor | null;
  committer: GitHubCommitAuthor | null;
}

export interface GitHubCommitDetailResponse {
  sha: string;
  commit: {
    message: string;
    author: {
      name: string;
      email: string;
      date: string;
    };
  };
  author: GitHubCommitAuthor | null;
  stats: {
    total: number;
    additions: number;
    deletions: number;
  };
  files?: {
    sha: string;
    filename: string;
    status: string;
    additions: number;
    deletions: number;
    changes: number;
  }[];
}

export interface GitHubContributorStatsWeek {
  w: number; // unix timestamp
  a: number; // additions
  d: number; // deletions
  c: number; // commits
}

export interface GitHubContributorStats {
  author: {
    login: string;
    avatar_url: string;
  };
  total: number;
  weeks: GitHubContributorStatsWeek[];
}

/** [timestamp, additions, deletions] */
export type GitHubCodeFrequency = [number, number, number];

export interface GitHubCommitActivity {
  days: number[]; // 7 entries: Sun=0 .. Sat=6
  total: number;
  week: number; // unix timestamp
}

export interface GitHubParticipation {
  all: number[]; // 52 weeks
  owner: number[]; // 52 weeks
}

/** [day, hour, commits] — day 0=Sun, hour 0-23 */
export type GitHubPunchCard = [number, number, number];

export type GitHubLanguages = Record<string, number>;

// ── Processed / derived types ──

export interface CommitInfo {
  sha: string;
  message: string;
  authorLogin: string | null;
  authorName: string;
  authorEmail: string;
  date: string;
  additions: number;
  deletions: number;
  filesChanged: number;
  files: {
    filename: string;
    additions: number;
    deletions: number;
    changes: number;
  }[];
}

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
  weekStart: string; // ISO date
  total: number;
  days: number[];
}

export interface LanguageEntry {
  name: string;
  bytes: number;
  percentage: number;
}

// ── Extended analysis types ──

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

// ── Aggregate types ──

export interface GitStatsRawData {
  commits: GitHubCommitResponse[];
  commitDetails: GitHubCommitDetailResponse[];
  contributorStats: GitHubContributorStats[] | null;
  codeFrequency: GitHubCodeFrequency[] | null;
  commitActivity: GitHubCommitActivity[] | null;
  participation: GitHubParticipation | null;
  punchCard: GitHubPunchCard[] | null;
  languages: GitHubLanguages | null;
  totalLinesOfCode?: number;
  binaryFileCount?: number;
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

// ── Pipeline state ──

export type GitStatsStep =
  | 'idle'
  | 'cloning'
  | 'reading-files'
  | 'extracting-commits'
  | 'extracting-details'
  | 'computing-stats'
  | 'fetching-commits'
  | 'fetching-details'
  | 'fetching-stats'
  | 'analyzing'
  | 'done'
  | 'error';

export interface GitStatsState {
  step: GitStatsStep;
  progress: number;
  subProgress: number;
  commitsFetched: number;
  detailsFetched: number;
  statusMessage: string;
  rawData: GitStatsRawData | null;
  analysis: GitStatsAnalysis | null;
  error: string | null;
}
