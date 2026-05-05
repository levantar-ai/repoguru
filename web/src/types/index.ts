// ── GitHub Types ──

export interface ParsedRepo {
  owner: string;
  repo: string;
  branch?: string;
}

export interface RepoInfo {
  owner: string;
  repo: string;
  defaultBranch: string;
  description: string;
  stars: number;
  forks: number;
  openIssues: number;
  license: string | null;
  language: string | null;
  createdAt: string;
  updatedAt: string;
  topics: string[];
  archived: boolean;
  size: number;
}

export interface TreeEntry {
  path: string;
  mode: string;
  type: 'blob' | 'tree';
  sha: string;
  size?: number;
}

export interface FileContent {
  path: string;
  content: string;
  size: number;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
  used: number;
}

// ── Analysis Types ──

export type CategoryKey =
  | 'documentation'
  | 'security'
  | 'cicd'
  | 'dependencies'
  | 'codeQuality'
  | 'license'
  | 'community'
  | 'openssf';

export interface CategoryResult {
  key: CategoryKey;
  label: string;
  score: number; // 0-100
  weight: number;
  signals: Signal[];
}

export interface Signal {
  name: string;
  found: boolean;
  details?: string;
}

export type LetterGrade = 'A' | 'B' | 'C' | 'D' | 'F';

export interface AnalysisReport {
  id: string;
  repo: ParsedRepo;
  repoInfo: RepoInfo;
  categories: CategoryResult[];
  overallScore: number;
  grade: LetterGrade;
  techStack: TechStackItem[];
  strengths: string[];
  risks: string[];
  nextSteps: string[];
  repoStructure: string;
  analyzedAt: string;
  llmInsights?: LlmInsights;
  contributorScore?: ContributorFriendliness;
  fileCount: number;
  treeEntryCount: number;
}

export interface TechStackItem {
  name: string;
  category: 'language' | 'framework' | 'tool' | 'platform' | 'database';
}

// ── LLM Types ──

export interface LlmInsights {
  summary: string;
  risks: string[];
  recommendations: string[];
  generatedAt: string;
}

export type LlmMode = 'off' | 'enriched';

// ── App State Types ──

export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  llmMode: LlmMode;
}

export interface RecentRepo {
  owner: string;
  repo: string;
  grade: LetterGrade;
  analyzedAt: string;
  overallScore: number;
}

// ── Analysis Pipeline State ──

export type AnalysisStep =
  | 'idle'
  | 'parsing'
  | 'fetching-info'
  | 'cloning'
  | 'fetching-tree'
  | 'fetching-files'
  | 'analyzing'
  | 'llm-enrichment'
  | 'done'
  | 'error';

export interface AnalysisState {
  step: AnalysisStep;
  progress: number;
  subProgress: number;
  report: AnalysisReport | null;
  error: string | null;
  filesTotal: number;
  filesFetched: number;
}

// ── Light Analysis (tree-only, no content fetch — 2 API calls per repo) ──

export interface LightAnalysisReport {
  repo: ParsedRepo;
  repoInfo: RepoInfo;
  grade: LetterGrade;
  overallScore: number;
  categories: CategoryResult[];
  techStack: TechStackItem[];
  treeEntryCount: number;
  analyzedAt: string;
}

// ── Contributor Friendliness ──

export interface ContributorFriendliness {
  score: number; // 0-100
  signals: Signal[];
  readinessChecklist: ChecklistItem[];
}

export interface ChecklistItem {
  label: string;
  passed: boolean;
  description: string;
}

// ── Signal Education ──

export interface SignalEducation {
  name: string;
  category: CategoryKey;
  why: string;
  howToFix: string;
  fixUrl?: string; // GitHub new-file URL template
  learnMoreUrl?: string;
}

// ── Multi-Repo / Org Scanning ──

export interface OrgScanResult {
  org: string;
  repos: LightAnalysisReport[];
  averageScore: number;
  averageGrade: LetterGrade;
  scanDate: string;
  categoryAverages: Record<CategoryKey, number>;
}

// ── Comparison ──

export interface ComparisonReport {
  repoA: AnalysisReport;
  repoB: AnalysisReport;
  categoryDiffs: {
    key: CategoryKey;
    label: string;
    scoreA: number;
    scoreB: number;
    diff: number;
  }[];
  winner: 'A' | 'B' | 'tie';
  generatedAt: string;
}

// ── Portfolio ──

export interface PortfolioResult {
  username: string;
  repos: LightAnalysisReport[];
  averageScore: number;
  averageGrade: LetterGrade;
  topLanguages: { name: string; count: number }[];
  categoryAverages: Record<CategoryKey, number>;
  strengths: string[];
  analyzedAt: string;
}

// ── Policy Engine ──

export type PolicyOperator = '>=' | '>' | '<=' | '<' | '==' | 'exists' | 'not-exists';

export interface PolicyRule {
  id: string;
  name: string;
  description: string;
  type: 'category-score' | 'overall-score' | 'signal';
  category?: CategoryKey;
  signal?: string;
  operator: PolicyOperator;
  value?: number;
  severity: 'error' | 'warning' | 'info';
}

export interface PolicySet {
  id: string;
  name: string;
  description: string;
  rules: PolicyRule[];
  createdAt: string;
}

export interface PolicyEvaluation {
  policy: PolicySet;
  repo: string;
  results: PolicyRuleResult[];
  passed: boolean;
  passCount: number;
  failCount: number;
  evaluatedAt: string;
}

export interface PolicyRuleResult {
  rule: PolicyRule;
  passed: boolean;
  actual: string;
  expected: string;
}

// ── History / Trends ──

export interface HistoryEntry {
  owner: string;
  repo: string;
  overallScore: number;
  grade: LetterGrade;
  categoryScores: Record<CategoryKey, number>;
  analyzedAt: string;
}

// ── Discovery ──

export interface DiscoveryFilters {
  language: string;
  minStars: number;
  topic: string;
  sort: 'stars' | 'updated' | 'forks';
}

export interface DiscoveryResult {
  repoInfo: RepoInfo;
  lightReport?: LightAnalysisReport;
}

// ── Badge ──

export interface BadgeConfig {
  style: 'flat' | 'flat-square' | 'pill';
  label: string;
  grade: LetterGrade;
  score: number;
}

// ── Navigation ──

export type PageId =
  | 'home'
  | 'docs'
  | 'org-scan'
  | 'compare'
  | 'portfolio'
  | 'discover'
  | 'policy'
  | 'git-stats'
  | 'tech-detect';

// ── Git Stats Types ──

export type {
  GitHubCommitResponse,
  GitHubCommitDetailResponse,
  GitHubContributorStats,
  GitHubCodeFrequency,
  GitHubCommitActivity,
  GitHubParticipation,
  GitHubPunchCard,
  GitHubLanguages,
  CommitInfo,
  ContributorSummary,
  FileChurnEntry,
  CommitMessageStats,
  BusFactorData,
  CommitSizeDistribution,
  RepoGrowthPoint,
  PunchCardData,
  WeeklyActivity,
  LanguageEntry,
  GitStatsRawData,
  GitStatsAnalysis,
  GitStatsStep,
  GitStatsState,
} from './gitStats';
