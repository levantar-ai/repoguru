import type {
  RepoInfo,
  ParsedRepo,
  Signal,
  CategoryResult,
  CategoryKey,
  AnalysisReport,
  TechStackItem,
  RateLimitInfo,
  RecentRepo,
  LetterGrade,
  ContributorFriendliness,
  LlmInsights,
} from '../types';
import type {
  ContributorSummary,
  BusFactorData,
  FileChurnEntry,
  CommitMessageStats,
  PunchCardData,
  WeeklyActivity,
  LanguageEntry,
  GitHubCommitActivity,
  GitHubCodeFrequency,
  CommitSizeDistribution,
  RepoGrowthPoint,
  GitStatsAnalysis,
} from '../types/gitStats';
import type { TechDetectResult } from '../types/techDetect';

// ── Primitives ────────────────────────────────────────────

export function makeParsedRepo(overrides?: Partial<ParsedRepo>): ParsedRepo {
  return {
    owner: 'facebook',
    repo: 'react',
    branch: 'main',
    ...overrides,
  };
}

export function makeRepoInfo(overrides?: Partial<RepoInfo>): RepoInfo {
  return {
    owner: 'facebook',
    repo: 'react',
    defaultBranch: 'main',
    description: 'The library for web and native user interfaces.',
    stars: 225_000,
    forks: 46_000,
    openIssues: 850,
    license: 'MIT',
    language: 'JavaScript',
    createdAt: '2013-05-24T16:15:54Z',
    updatedAt: '2025-01-15T10:30:00Z',
    topics: ['react', 'javascript', 'ui', 'frontend'],
    archived: false,
    size: 320_000,
    ...overrides,
  };
}

export function makeSignal(overrides?: Partial<Signal>): Signal {
  return {
    name: 'README.md exists',
    found: true,
    details: 'Found at root level',
    ...overrides,
  };
}

export function makeRateLimit(overrides?: Partial<RateLimitInfo>): RateLimitInfo {
  return {
    limit: 5000,
    remaining: 4832,
    reset: Math.floor(Date.now() / 1000) + 3600,
    used: 168,
    ...overrides,
  };
}

// ── Categories ────────────────────────────────────────────

const categoryDefaults: Record<CategoryKey, { label: string; weight: number }> = {
  documentation: { label: 'Documentation', weight: 20 },
  security: { label: 'Security', weight: 15 },
  cicd: { label: 'CI/CD', weight: 15 },
  dependencies: { label: 'Dependencies', weight: 15 },
  codeQuality: { label: 'Code Quality', weight: 15 },
  license: { label: 'License', weight: 10 },
  community: { label: 'Community', weight: 10 },
};

export function makeCategoryResult(
  key: CategoryKey,
  overrides?: Partial<CategoryResult>,
): CategoryResult {
  const def = categoryDefaults[key];
  return {
    key,
    label: def.label,
    score: 85,
    weight: def.weight,
    signals: [
      makeSignal({ name: `${def.label} signal 1`, found: true }),
      makeSignal({ name: `${def.label} signal 2`, found: true }),
      makeSignal({ name: `${def.label} signal 3`, found: false }),
    ],
    ...overrides,
  };
}

export function makeCategories(grade?: LetterGrade): CategoryResult[] {
  const scoreMap: Record<LetterGrade, number> = { A: 92, B: 78, C: 62, D: 45, F: 25 };
  const base = grade ? scoreMap[grade] : 85;
  const keys: CategoryKey[] = [
    'documentation',
    'security',
    'cicd',
    'dependencies',
    'codeQuality',
    'license',
    'community',
  ];
  return keys.map((k, i) =>
    makeCategoryResult(k, { score: Math.max(0, Math.min(100, base + (i % 2 === 0 ? 5 : -8))) }),
  );
}

// ── Tech Stack ────────────────────────────────────────────

export function makeTechStack(): TechStackItem[] {
  return [
    { name: 'TypeScript', category: 'language' },
    { name: 'React', category: 'framework' },
    { name: 'Vite', category: 'tool' },
    { name: 'Tailwind CSS', category: 'framework' },
    { name: 'Node.js', category: 'platform' },
    { name: 'PostgreSQL', category: 'database' },
    { name: 'ESLint', category: 'tool' },
    { name: 'Docker', category: 'platform' },
  ];
}

// ── Analysis Report ───────────────────────────────────────

export function makeAnalysisReport(overrides?: Partial<AnalysisReport>): AnalysisReport {
  const grade = overrides?.grade ?? 'B';
  const scoreMap: Record<LetterGrade, number> = { A: 92, B: 78, C: 62, D: 45, F: 25 };
  return {
    id: 'rpt-001',
    repo: makeParsedRepo(),
    repoInfo: makeRepoInfo(),
    categories: makeCategories(grade),
    overallScore: scoreMap[grade],
    grade,
    techStack: makeTechStack(),
    strengths: [
      'Comprehensive documentation with API reference',
      'Active community with quick issue response times',
      'Well-structured CI/CD pipeline with automated testing',
    ],
    risks: [
      'Some dependencies are outdated by 2+ major versions',
      'No SECURITY.md or vulnerability disclosure policy',
    ],
    nextSteps: [
      'Add a SECURITY.md file with vulnerability reporting instructions',
      'Update outdated dependencies to latest stable versions',
      'Add branch protection rules for the main branch',
    ],
    repoStructure: `src/
├── components/
├── hooks/
├── services/
├── utils/
└── types/`,
    analyzedAt: '2025-01-15T10:30:00Z',
    fileCount: 142,
    treeEntryCount: 380,
    llmInsights: {
      summary: 'A well-maintained React project with good documentation and testing practices.',
      risks: ['Heavy reliance on a single maintainer for core modules'],
      recommendations: ['Consider adding more automated security scanning to the CI pipeline'],
      generatedAt: '2025-01-15T10:31:00Z',
    },
    contributorScore: makeContributorFriendliness(),
    ...overrides,
  };
}

// ── Contributor Friendliness ──────────────────────────────

export function makeContributorFriendliness(
  overrides?: Partial<ContributorFriendliness>,
): ContributorFriendliness {
  return {
    score: 72,
    signals: [
      makeSignal({ name: 'CONTRIBUTING.md', found: true }),
      makeSignal({ name: 'Good first issues labeled', found: true }),
      makeSignal({ name: 'Code of Conduct', found: false }),
    ],
    readinessChecklist: [
      { label: 'Contributing guide', passed: true, description: 'CONTRIBUTING.md exists' },
      { label: 'Issue templates', passed: true, description: 'Bug and feature templates found' },
      {
        label: 'Code of Conduct',
        passed: false,
        description: 'No CODE_OF_CONDUCT.md found',
      },
    ],
    ...overrides,
  };
}

// ── LLM Insights ──────────────────────────────────────────

export function makeLlmInsights(overrides?: Partial<LlmInsights>): LlmInsights {
  return {
    summary: 'A well-maintained React project with good documentation and testing practices.',
    risks: ['Heavy reliance on a single maintainer for core modules'],
    recommendations: ['Consider adding more automated security scanning to the CI pipeline'],
    generatedAt: '2025-01-15T10:31:00Z',
    ...overrides,
  };
}

// ── Recent Repos ──────────────────────────────────────────

export function makeRecentRepos(count = 5): RecentRepo[] {
  const repos: { owner: string; repo: string; grade: LetterGrade; score: number }[] = [
    { owner: 'facebook', repo: 'react', grade: 'A', score: 94 },
    { owner: 'vercel', repo: 'next.js', grade: 'A', score: 91 },
    { owner: 'tailwindlabs', repo: 'tailwindcss', grade: 'B', score: 82 },
    { owner: 'vitejs', repo: 'vite', grade: 'B', score: 79 },
    { owner: 'denoland', repo: 'deno', grade: 'C', score: 65 },
    { owner: 'torvalds', repo: 'linux', grade: 'B', score: 76 },
    { owner: 'microsoft', repo: 'vscode', grade: 'A', score: 90 },
  ];
  return repos.slice(0, count).map((r) => ({
    ...r,
    analyzedAt: new Date(Date.now() - Math.random() * 7 * 86_400_000).toISOString(),
    overallScore: r.score,
  }));
}

// ── Git Stats: Contributors ───────────────────────────────

export function makeContributors(count = 6): ContributorSummary[] {
  const names = ['alice', 'bob', 'charlie', 'diana', 'eve', 'frank', 'grace', 'hank'];
  return names.slice(0, count).map((login, i) => ({
    login,
    avatarUrl: `https://avatars.githubusercontent.com/u/${1000 + i}`,
    totalCommits: Math.max(5, 200 - i * 35),
    totalAdditions: Math.max(100, 15000 - i * 2500),
    totalDeletions: Math.max(50, 8000 - i * 1200),
    commitPercentage: Math.max(2, 40 - i * 8),
    firstCommitWeek: 1672531200 + i * 604800,
    lastCommitWeek: 1705017600,
  }));
}

// ── Git Stats: Bus Factor ─────────────────────────────────

export function makeBusFactorData(overrides?: Partial<BusFactorData>): BusFactorData {
  return {
    busFactor: 3,
    herfindahlIndex: 0.22,
    cumulativeContributors: [
      { login: 'alice', cumulativePercentage: 40 },
      { login: 'bob', cumulativePercentage: 65 },
      { login: 'charlie', cumulativePercentage: 82 },
      { login: 'diana', cumulativePercentage: 92 },
      { login: 'eve', cumulativePercentage: 97 },
      { login: 'frank', cumulativePercentage: 100 },
    ],
    ...overrides,
  };
}

// ── Git Stats: File Churn ─────────────────────────────────

export function makeFileChurn(count = 8): FileChurnEntry[] {
  const files = [
    'src/App.tsx',
    'src/index.css',
    'src/utils/helpers.ts',
    'package.json',
    'src/components/Header.tsx',
    'src/services/api.ts',
    'README.md',
    'src/types/index.ts',
    'tsconfig.json',
    'vite.config.ts',
  ];
  return files.slice(0, count).map((filename, i) => ({
    filename,
    changeCount: Math.max(2, 50 - i * 6),
    totalAdditions: Math.max(10, 400 - i * 45),
    totalDeletions: Math.max(5, 200 - i * 22),
    contributors: ['alice', 'bob', 'charlie'].slice(0, Math.max(1, 3 - Math.floor(i / 3))),
  }));
}

// ── Git Stats: Commit Messages ────────────────────────────

export function makeCommitMessageStats(
  overrides?: Partial<CommitMessageStats>,
): CommitMessageStats {
  return {
    totalCommits: 482,
    averageLength: 52,
    medianLength: 45,
    mergeCommitCount: 38,
    conventionalCommits: {
      feat: 120,
      fix: 95,
      docs: 32,
      style: 15,
      refactor: 48,
      test: 28,
      chore: 42,
      ci: 18,
      perf: 8,
      build: 12,
      other: 64,
    },
    conventionalPercentage: 67,
    wordFrequency: [
      { word: 'fix', count: 95 },
      { word: 'add', count: 78 },
      { word: 'update', count: 65 },
      { word: 'remove', count: 42 },
      { word: 'refactor', count: 38 },
      { word: 'improve', count: 30 },
      { word: 'support', count: 25 },
      { word: 'component', count: 22 },
      { word: 'test', count: 20 },
      { word: 'style', count: 18 },
      { word: 'docs', count: 16 },
      { word: 'config', count: 14 },
      { word: 'cleanup', count: 12 },
      { word: 'merge', count: 10 },
      { word: 'release', count: 8 },
    ],
    ...overrides,
  };
}

// ── Git Stats: Punch Card ─────────────────────────────────

export function makePunchCardData(): PunchCardData[] {
  const data: PunchCardData[] = [];
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      const isWorkHour = hour >= 9 && hour <= 17;
      const isWeekday = day >= 1 && day <= 5;
      const base = isWorkHour && isWeekday ? 12 : isWeekday ? 3 : 1;
      data.push({ day, hour, commits: Math.floor(base * (0.5 + Math.random())) });
    }
  }
  return data;
}

// ── Git Stats: Weekly Activity ────────────────────────────

export function makeWeeklyActivity(count = 12): WeeklyActivity[] {
  const result: WeeklyActivity[] = [];
  const now = Date.now();
  for (let i = count - 1; i >= 0; i--) {
    const weekStart = new Date(now - i * 7 * 86_400_000).toISOString().slice(0, 10);
    const days = Array.from({ length: 7 }, () => Math.floor(Math.random() * 15));
    result.push({ weekStart, total: days.reduce((a, b) => a + b, 0), days });
  }
  return result;
}

// ── Git Stats: Languages ──────────────────────────────────

export function makeLanguages(): LanguageEntry[] {
  return [
    { name: 'TypeScript', bytes: 450_000, percentage: 62.5 },
    { name: 'JavaScript', bytes: 120_000, percentage: 16.7 },
    { name: 'CSS', bytes: 80_000, percentage: 11.1 },
    { name: 'HTML', bytes: 45_000, percentage: 6.3 },
    { name: 'Shell', bytes: 25_000, percentage: 3.4 },
  ];
}

// ── Git Stats: Commit Activity ────────────────────────────

export function makeCommitActivity(): GitHubCommitActivity[] {
  const result: GitHubCommitActivity[] = [];
  const now = Math.floor(Date.now() / 1000);
  for (let i = 51; i >= 0; i--) {
    const days = Array.from({ length: 7 }, () => Math.floor(Math.random() * 10));
    result.push({
      days,
      total: days.reduce((a, b) => a + b, 0),
      week: now - i * 604800,
    });
  }
  return result;
}

// ── Git Stats: Code Frequency ─────────────────────────────

export function makeCodeFrequency(): GitHubCodeFrequency[] {
  const result: GitHubCodeFrequency[] = [];
  const now = Math.floor(Date.now() / 1000);
  for (let i = 25; i >= 0; i--) {
    result.push([
      now - i * 604800,
      Math.floor(Math.random() * 500 + 50),
      -Math.floor(Math.random() * 300 + 20),
    ]);
  }
  return result;
}

// ── Git Stats: Commit Size Distribution ───────────────────

export function makeCommitSizeDistribution(
  overrides?: Partial<CommitSizeDistribution>,
): CommitSizeDistribution {
  return {
    buckets: [
      { label: '1-10', min: 1, max: 10, count: 145 },
      { label: '11-50', min: 11, max: 50, count: 198 },
      { label: '51-100', min: 51, max: 100, count: 72 },
      { label: '101-500', min: 101, max: 500, count: 45 },
      { label: '500+', min: 501, max: 99999, count: 22 },
    ],
    ...overrides,
  };
}

// ── Git Stats: Repo Growth ────────────────────────────────

export function makeRepoGrowth(count = 12): RepoGrowthPoint[] {
  let cumAdd = 0;
  let cumDel = 0;
  const result: RepoGrowthPoint[] = [];
  for (let i = 0; i < count; i++) {
    const add = Math.floor(Math.random() * 2000 + 500);
    const del = Math.floor(Math.random() * 800 + 100);
    cumAdd += add;
    cumDel += del;
    result.push({
      date: new Date(Date.now() - (count - i) * 30 * 86_400_000).toISOString().slice(0, 10),
      cumulativeAdditions: cumAdd,
      cumulativeDeletions: cumDel,
      netGrowth: cumAdd - cumDel,
    });
  }
  return result;
}

// ── Git Stats: File Coupling ──────────────────────────────

export function makeFileCoupling(count = 6): { file1: string; file2: string; cochanges: number }[] {
  const pairs = [
    { file1: 'src/App.tsx', file2: 'src/App.test.tsx', cochanges: 28 },
    { file1: 'src/types/index.ts', file2: 'src/services/api.ts', cochanges: 22 },
    { file1: 'package.json', file2: 'package-lock.json', cochanges: 45 },
    { file1: 'src/components/Header.tsx', file2: 'src/components/Layout.tsx', cochanges: 18 },
    { file1: 'src/index.css', file2: 'tailwind.config.ts', cochanges: 14 },
    { file1: 'tsconfig.json', file2: 'vite.config.ts', cochanges: 10 },
    { file1: 'src/utils/helpers.ts', file2: 'src/utils/helpers.test.ts', cochanges: 8 },
    { file1: '.eslintrc.js', file2: '.prettierrc', cochanges: 6 },
  ];
  return pairs.slice(0, count);
}

// ── Git Stats: Full Analysis ──────────────────────────────

export function makeGitStatsAnalysis(overrides?: Partial<GitStatsAnalysis>): GitStatsAnalysis {
  return {
    owner: 'facebook',
    repo: 'react',
    totalCommits: 482,
    totalLinesOfCode: 84_500,
    binaryFileCount: 3,
    contributors: makeContributors(),
    busFactor: makeBusFactorData(),
    fileChurn: makeFileChurn(),
    commitMessages: makeCommitMessageStats(),
    commitSizeDistribution: makeCommitSizeDistribution(),
    repoGrowth: makeRepoGrowth(),
    punchCard: makePunchCardData(),
    weeklyActivity: makeWeeklyActivity(),
    languages: makeLanguages(),
    commitActivity: makeCommitActivity(),
    codeFrequency: makeCodeFrequency(),
    commitsByWeekday: [32, 78, 85, 92, 88, 72, 35],
    commitsByMonth: [28, 35, 42, 38, 50, 45, 55, 48, 42, 38, 32, 29],
    commitsByYear: [
      { year: 2022, count: 120 },
      { year: 2023, count: 185 },
      { year: 2024, count: 177 },
    ],
    commitsByExtension: [
      { ext: '.ts', count: 180 },
      { ext: '.tsx', count: 145 },
      { ext: '.css', count: 52 },
      { ext: '.json', count: 48 },
      { ext: '.md', count: 35 },
      { ext: '.yml', count: 22 },
    ],
    linesByExtension: [
      { ext: '.ts', additions: 12000, deletions: 5000 },
      { ext: '.tsx', additions: 9000, deletions: 3500 },
      { ext: '.css', additions: 3000, deletions: 1200 },
    ],
    fileCoupling: makeFileCoupling(),
    firstCommitDate: '2022-03-15T08:00:00Z',
    repoAgeDays: 1040,
    ...overrides,
  };
}

// ── Tech Detect ───────────────────────────────────────────

export function makeTechDetectResult(overrides?: Partial<TechDetectResult>): TechDetectResult {
  return {
    aws: [
      { service: 'S3', sdkPackage: '@aws-sdk/client-s3', source: 'package.json', via: 'js-sdk-v3' },
      {
        service: 'DynamoDB',
        sdkPackage: '@aws-sdk/client-dynamodb',
        source: 'package.json',
        via: 'js-sdk-v3',
      },
    ],
    azure: [],
    gcp: [],
    python: [],
    node: [
      { name: 'express', version: '^4.18.2', source: 'package.json' },
      { name: 'typescript', version: '^5.3.3', source: 'package.json' },
    ],
    go: [],
    java: [],
    php: [],
    rust: [],
    ruby: [],
    manifestFiles: ['package.json', 'tsconfig.json', 'Dockerfile'],
    ...overrides,
  };
}
