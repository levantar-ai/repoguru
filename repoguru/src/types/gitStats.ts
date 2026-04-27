// GitHub API response types (raw clone-input only) live here.
// Analysis-result types (the shape every chart consumes) have moved to
// @repoguru/core's `legacy` module and are re-exported below for
// backwards compatibility with existing imports.

import type { legacy as Legacy } from '@repoguru/core';

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
  w: number;
  a: number;
  d: number;
  c: number;
}

export interface GitHubContributorStats {
  author: {
    login: string;
    avatar_url: string;
  };
  total: number;
  weeks: GitHubContributorStatsWeek[];
}

export interface GitHubParticipation {
  all: number[];
  owner: number[];
}

/** [day, hour, commits] — day 0=Sun, hour 0-23 */
export type GitHubPunchCard = [number, number, number];

export type GitHubLanguages = Record<string, number>;

// ── Processed / derived types — re-exported from @repoguru/core ──

export type CommitInfo = {
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
};

export type ContributorSummary = Legacy.ContributorSummary;
export type FileChurnEntry = Legacy.FileChurnEntry;
export type CommitMessageStats = Legacy.CommitMessageStats;
export type BusFactorData = Legacy.BusFactorData;
export type CommitSizeDistribution = Legacy.CommitSizeDistribution;
export type RepoGrowthPoint = Legacy.RepoGrowthPoint;
export type PunchCardData = Legacy.PunchCardData;
export type WeeklyActivity = Legacy.WeeklyActivity;
export type LanguageEntry = Legacy.LanguageEntry;
export type AuthorOfPeriod = Legacy.AuthorOfPeriod;
export type AuthorTimeline = Legacy.AuthorTimeline;
export type ContributorNode = Legacy.ContributorNode;
export type ContributorEdge = Legacy.ContributorEdge;
export type OwnershipEntry = Legacy.OwnershipEntry;
export type ChangeChain = Legacy.ChangeChain;
export type ExtMonthlyChurn = Legacy.ExtMonthlyChurn;
export type LinesStatsSummary = Legacy.LinesStatsSummary;
export type TagSummary = Legacy.TagSummary;
export type RadarMetric = Legacy.RadarMetric;
export type HotspotEntry = Legacy.HotspotEntry;
export type ActivePeriod = Legacy.ActivePeriod;
export type GitStatsAnalysis = Legacy.GitStatsAnalysis;
/** Re-exported here for the in-browser pipeline that produces this shape. */
export type GitHubCodeFrequency = Legacy.GitHubCodeFrequency;
export type GitHubCommitActivity = Legacy.GitHubCommitActivity;

// ── Aggregate raw types — browser-app only ──

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
  /**
   * Canonical sectioned shape from @repoguru/core. Populated by
   * BrowserAnalyzer alongside `analysis`. Lifted charts in @repoguru/ui
   * read from this; charts that haven't moved yet read from `analysis`.
   */
  canonical: import('@repoguru/core').GitStatsData | null;
  error: string | null;
}
