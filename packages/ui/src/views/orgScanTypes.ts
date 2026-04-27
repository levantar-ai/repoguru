// Authoritative shape consumed by <OrgScanView />. The browser's
// `LightAnalysisReport[]` and the CLI's streamed `RepoScore[]` both project
// into this shape — see OrgScanView.tsx for the projection helpers.

import type { Grade } from './reportCardTypes.js';

export interface OrgScanCategoryScore {
  /** Stable category key, e.g. 'documentation', 'security', 'cicd', ... */
  key: string;
  /** Display label shown in column headers and mobile cards. */
  label: string;
  /** 0..100. */
  score: number;
}

export interface OrgScanItem {
  repo: { owner: string; repo: string };
  grade: Grade;
  /** 0..100. */
  overallScore: number;
  /** Per-category scores. The view derives table columns from the first
   *  item's category list, so all items should share the same key set. */
  categories: OrgScanCategoryScore[];
  /** Optional language tag rendered next to the repo name. */
  language?: string;
}

export interface OrgScanSummary {
  totalRepos: number;
  /** 0..100. */
  averageScore: number;
  averageGrade: Grade;
  /** Counts of each letter grade. Missing keys render as 0. */
  gradeDistribution?: Partial<Record<Grade, number>>;
}
