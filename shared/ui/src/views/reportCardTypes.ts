// Authoritative shape consumed by <ReportCardView />. The browser app's
// AnalysisReport is a superset that maps to this; the desktop's gRPC
// ScoreResponse projects up to it via a small wire→view helper.

export type Grade = 'A' | 'B' | 'C' | 'D' | 'F';

export interface ReportCardSignal {
  name: string;
  found: boolean;
  details?: string;
}

export interface ReportCardCategory {
  key: string;
  label: string;
  score: number;
  /** 0..1 (browser convention). */
  weight: number;
  signals: ReportCardSignal[];
}

export interface ReportCardRepoInfo {
  description?: string;
  stars?: number;
  forks?: number;
  openIssues?: number;
  archived?: boolean;
}

export interface ReportCardData {
  repo: { owner: string; repo: string };
  grade: Grade;
  overallScore: number;
  categories: ReportCardCategory[];
  strengths: string[];
  risks: string[];
  nextSteps: string[];
  /** ISO timestamp the report was produced. */
  analyzedAt: string;
  repoInfo?: ReportCardRepoInfo;
}

export const GRADE_COLORS: Record<Grade, string> = {
  A: '#22c55e',
  B: '#84cc16',
  C: '#eab308',
  D: '#f97316',
  F: '#ef4444',
};

export function scoreToGrade(score: number): Grade {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

export function gradeAdjective(g: Grade): string {
  switch (g) {
    case 'A':
      return 'Excellent';
    case 'B':
      return 'Good';
    case 'C':
      return 'Fair';
    case 'D':
      return 'Needs Work';
    case 'F':
      return 'Critical';
  }
}
