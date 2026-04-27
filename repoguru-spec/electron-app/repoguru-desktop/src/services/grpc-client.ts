/**
 * Typed wrappers around window.repoGuru IPC calls.
 * These provide a clean API for React components and hooks.
 */

export interface ScanRequest {
  repo_path: string;
  out_path: string;
  threads?: number;
  merge_policy?: string;
  renames?: boolean;
  copies?: boolean;
  rename_threshold?: number;
  include_remotes?: boolean;
  max_top?: number;
  report?: boolean;
  max_diff_files?: number;
  merge_diff_limit?: number;
  worker_cache_mb?: number;
}

export interface ScanProgress {
  phase: string;
  message: string;
  commits_processed: number;
  file_changes_processed: number;
  elapsed_seconds: number;
  done: boolean;
  error: string;
}

export interface Signal {
  name: string;
  found: boolean;
  details: string;
  points: number;
}

export interface CategoryScore {
  key: string;
  label: string;
  score: number;
  grade: string;
  weight: number;
  signals: Signal[];
}

export interface ScoreResponse {
  overall_score: number;
  grade: string;
  categories: CategoryScore[];
  strengths: string[];
  risks: string[];
  next_steps: string[];
  scored_at: string;
}

export interface OrgScanRequest {
  org_or_user: string;
  is_user: boolean;
  github_token: string;
  clone_base_dir: string;
  max_repos: number;
  skip_forks: boolean;
  skip_archived: boolean;
}

export interface OrgScanProgress {
  phase: string;
  repo_name: string;
  repos_total: number;
  repos_completed: number;
  repo_scores: Array<{
    repo_name: string;
    overall_score: number;
    grade: string;
    categories: CategoryScore[];
  }>;
  average_score: number;
  average_grade: string;
  error: string;
}

// Convenience functions wrapping window.repoGuru

export const grpcClient = {
  scan: (req: ScanRequest, onProgress: (p: ScanProgress) => void) =>
    window.repoGuru.scan(req as any, onProgress as any),

  describeScan: (outPath: string) =>
    window.repoGuru.describeScan(outPath),

  getSection: (outPath: string, section: string, repoPath?: string) =>
    window.repoGuru.getSection(outPath, section, repoPath),

  getReport: (outPath: string) =>
    window.repoGuru.getReport(outPath),

  listSections: () =>
    window.repoGuru.listSections(),

  scoreReportCard: (repoPath: string, outPath?: string) =>
    window.repoGuru.scoreReportCard(repoPath, outPath) as Promise<ScoreResponse>,

  evaluatePolicy: (preset: string, reportCard: ScoreResponse) =>
    window.repoGuru.evaluatePolicy(preset, reportCard),

  evaluatePolicyCustom: (policy: unknown, reportCard: ScoreResponse) =>
    window.repoGuru.evaluatePolicyCustom(policy, reportCard),

  detectTech: (repoPath: string) =>
    window.repoGuru.detectTech(repoPath),

  generateSBOM: (repoPath: string, format?: string) =>
    window.repoGuru.generateSBOM(repoPath, format),

  exportReport: (format: string, reportCard: ScoreResponse, repoName: string) =>
    window.repoGuru.exportReport(format, reportCard, repoName),

  scanOrg: (req: OrgScanRequest, onProgress: (p: OrgScanProgress) => void) =>
    window.repoGuru.scanOrg(req as any, onProgress as any),

  compareRepos: (pathA: string, pathB: string) =>
    window.repoGuru.compareRepos(pathA, pathB),

  health: () =>
    window.repoGuru.health(),

  selectDirectory: () =>
    window.repoGuru.selectDirectory(),

  openExternal: (url: string) =>
    window.repoGuru.openExternal(url),
};
