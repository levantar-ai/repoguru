// Flat re-export of @repoguru/core's `legacy` namespace. The browser
// chart components were written against these names directly (without
// the `legacy.` prefix), so we keep them flat here to avoid mass-
// rewriting every type usage in the lifted files.

import type { legacy } from '@repoguru/core';

export type ActivePeriod = legacy.ActivePeriod;
export type AuthorOfPeriod = legacy.AuthorOfPeriod;
export type AuthorTimeline = legacy.AuthorTimeline;
export type BusFactorData = legacy.BusFactorData;
export type ChangeChain = legacy.ChangeChain;
export type CommitMessageStats = legacy.CommitMessageStats;
export type CommitSizeDistribution = legacy.CommitSizeDistribution;
export type ContributorEdge = legacy.ContributorEdge;
export type ContributorNode = legacy.ContributorNode;
export type ContributorSummary = legacy.ContributorSummary;
export type ExtMonthlyChurn = legacy.ExtMonthlyChurn;
export type FileChurnEntry = legacy.FileChurnEntry;
export type GitHubCodeFrequency = legacy.GitHubCodeFrequency;
export type GitHubCommitActivity = legacy.GitHubCommitActivity;
export type GitStatsAnalysis = legacy.GitStatsAnalysis;
export type HotspotEntry = legacy.HotspotEntry;
export type LanguageEntry = legacy.LanguageEntry;
export type LinesStatsSummary = legacy.LinesStatsSummary;
export type OwnershipEntry = legacy.OwnershipEntry;
export type PunchCardData = legacy.PunchCardData;
export type RadarMetric = legacy.RadarMetric;
export type RepoGrowthPoint = legacy.RepoGrowthPoint;
export type RepoSizerStats = legacy.RepoSizerStats;
export type TagSummary = legacy.TagSummary;
export type WeeklyActivity = legacy.WeeklyActivity;

/**
 * Subset of the browser's GitStatsState that the lifted GitStatsProgress
 * panel reads. Excludes browser-only fields like `rawData` so the panel
 * works for any host that drives the same step machine.
 */
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
  analysis: GitStatsAnalysis | null;
  error: string | null;
}
