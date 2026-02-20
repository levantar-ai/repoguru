import { useState, useCallback, useRef } from 'react';
import type { CategoryKey, LetterGrade } from '../types';
import {
  CATEGORY_LABELS,
  CATEGORY_WEIGHTS,
  GITHUB_API_BASE,
  GRADE_COLORS,
} from '../utils/constants';
import { scoreToGrade, gradeColorClass, formatNumber } from '../utils/formatters';

// ── Props ──

interface Props {
  onBack: () => void;
  onAnalyze: (url: string) => void;
  githubToken: string;
}

// ── Internal types ──

interface GitHubRepoResponse {
  name: string;
  full_name: string;
  fork: boolean;
  language: string | null;
  stargazers_count: number;
  description: string | null;
  default_branch: string;
  license: { spdx_id: string } | null;
}

interface TreeEntry {
  path: string;
  type: string;
}

interface RepoAnalysis {
  name: string;
  fullName: string;
  grade: LetterGrade;
  score: number;
  language: string | null;
  stars: number;
  categories: Record<CategoryKey, number>;
  techDetected: string[];
}

interface PortfolioData {
  username: string;
  avatarUrl: string;
  repoCount: number;
  repos: RepoAnalysis[];
  overallScore: number;
  overallGrade: LetterGrade;
  topLanguages: { name: string; count: number; color: string }[];
  categoryAverages: Record<CategoryKey, number>;
  strengths: string[];
  allTech: string[];
}

// ── Constants ──

const CATEGORY_KEYS: CategoryKey[] = [
  'documentation',
  'security',
  'cicd',
  'dependencies',
  'codeQuality',
  'license',
  'community',
];

const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Python: '#3572a5',
  Rust: '#dea584',
  Go: '#00add8',
  Java: '#b07219',
  Ruby: '#701516',
  'C++': '#f34b7d',
  C: '#555555',
  'C#': '#178600',
  PHP: '#4f5d95',
  Swift: '#f05138',
  Kotlin: '#a97bff',
  Shell: '#89e051',
  HTML: '#e34c26',
  CSS: '#563d7c',
  Dart: '#00b4ab',
  Scala: '#c22d40',
  Lua: '#000080',
  Elixir: '#6e4a7e',
  Haskell: '#5e5086',
};

const TECH_DETECT_MAP: Record<string, string> = {
  'package.json': 'Node.js',
  'tsconfig.json': 'TypeScript',
  'Cargo.toml': 'Rust',
  'go.mod': 'Go',
  'requirements.txt': 'Python',
  Gemfile: 'Ruby',
  Dockerfile: 'Docker',
  'pom.xml': 'Java',
  'build.gradle': 'Java',
  'build.gradle.kts': 'Kotlin',
  'pyproject.toml': 'Python',
  'setup.py': 'Python',
  'composer.json': 'PHP',
  Pipfile: 'Python',
  'mix.exs': 'Elixir',
  'stack.yaml': 'Haskell',
  'Package.swift': 'Swift',
};

const MAX_REPOS = 15;

// ── Helpers ──

function authHeaders(token: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

function has(paths: Set<string>, ...names: string[]): boolean {
  return names.some((n) => paths.has(n));
}

function hasPrefix(paths: Set<string>, prefix: string): boolean {
  for (const p of paths) {
    if (p.startsWith(prefix)) return true;
  }
  return false;
}

function countPrefix(paths: Set<string>, prefix: string): number {
  let count = 0;
  for (const p of paths) {
    if (p.startsWith(prefix)) count++;
  }
  return count;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

// ── Light analysis (tree-only) — category helpers ──

function scoreDocumentation(paths: Set<string>): number {
  let doc = 0;
  if (has(paths, 'README.md', 'readme.md', 'README.rst', 'README')) doc += 30;
  if (has(paths, 'CONTRIBUTING.md', '.github/CONTRIBUTING.md')) doc += 20;
  if (has(paths, 'CHANGELOG.md', 'CHANGES.md', 'HISTORY.md')) doc += 15;
  if (hasPrefix(paths, 'docs/') || hasPrefix(paths, 'doc/')) doc += 15;
  if (has(paths, 'LICENSE', 'LICENSE.md', 'LICENSE.txt', 'LICENCE', 'LICENCE.md')) doc += 20;
  return clamp(doc, 0, 100);
}

function scoreSecurity(paths: Set<string>): number {
  let sec = 0;
  if (has(paths, 'SECURITY.md', '.github/SECURITY.md')) sec += 25;
  if (has(paths, 'CODEOWNERS', '.github/CODEOWNERS')) sec += 20;
  if (has(paths, '.github/dependabot.yml', '.github/dependabot.yaml')) sec += 25;
  if (has(paths, '.gitignore')) sec += 15;
  if (hasPrefix(paths, '.github/workflows/')) sec += 15;
  return clamp(sec, 0, 100);
}

function scoreCicd(paths: Set<string>): number {
  let ci = 0;
  if (hasPrefix(paths, '.github/workflows/')) ci += 35;
  if (has(paths, 'Dockerfile')) ci += 20;
  if (has(paths, 'Makefile')) ci += 15;
  if (has(paths, 'docker-compose.yml', 'docker-compose.yaml')) ci += 15;
  if (countPrefix(paths, '.github/workflows/') > 1) ci += 15;
  return clamp(ci, 0, 100);
}

function scoreDependencies(paths: Set<string>): number {
  let deps = 0;
  const manifests = [
    'package.json',
    'Cargo.toml',
    'go.mod',
    'requirements.txt',
    'Gemfile',
    'composer.json',
    'pom.xml',
    'build.gradle',
    'build.gradle.kts',
    'pyproject.toml',
    'setup.py',
    'Pipfile',
    'mix.exs',
  ];
  const manifestCount = manifests.filter((m) => paths.has(m)).length;
  if (manifestCount > 0) deps += 30;
  const lockfiles = [
    'package-lock.json',
    'yarn.lock',
    'pnpm-lock.yaml',
    'Cargo.lock',
    'go.sum',
    'Gemfile.lock',
    'composer.lock',
    'Pipfile.lock',
  ];
  if (lockfiles.some((l) => paths.has(l))) deps += 25;
  if (manifestCount > 0) deps += 20; // reasonable assumed
  if (manifestCount > 1) deps += 25;
  return clamp(deps, 0, 100);
}

function scoreCodeQuality(paths: Set<string>): number {
  let quality = 0;
  const linters = [
    '.eslintrc.json',
    '.eslintrc.js',
    '.eslintrc.yml',
    '.eslintrc',
    'eslint.config.js',
    'eslint.config.mjs',
    '.flake8',
    '.pylintrc',
    'clippy.toml',
    '.golangci.yml',
    '.rubocop.yml',
  ];
  if (linters.some((l) => paths.has(l))) quality += 25;
  const formatters = [
    '.prettierrc',
    '.prettierrc.json',
    '.prettierrc.js',
    'prettier.config.js',
    'rustfmt.toml',
    '.clang-format',
  ];
  if (formatters.some((f) => paths.has(f))) quality += 20;
  if (has(paths, 'tsconfig.json')) quality += 15;
  if (
    hasPrefix(paths, 'test/') ||
    hasPrefix(paths, 'tests/') ||
    hasPrefix(paths, '__tests__/') ||
    hasPrefix(paths, 'spec/')
  )
    quality += 25;
  if (has(paths, '.editorconfig')) quality += 15;
  return clamp(quality, 0, 100);
}

function scoreLicense(paths: Set<string>, repoLicense: { spdx_id: string } | null): number {
  let lic = 0;
  if (has(paths, 'LICENSE', 'LICENSE.md', 'LICENSE.txt', 'LICENCE', 'LICENCE.md')) lic += 50;
  if (has(paths, 'LICENSE.md', 'LICENSE.txt', 'LICENCE.md') && has(paths, 'LICENSE', 'LICENCE')) {
    // has extension variant too
  } else if (has(paths, 'LICENSE.md', 'LICENSE.txt', 'LICENCE.md')) {
    lic += 10;
  }
  if (repoLicense?.spdx_id && repoLicense.spdx_id !== 'NOASSERTION') lic += 40;
  return clamp(lic, 0, 100);
}

function scoreCommunity(paths: Set<string>): number {
  let comm = 0;
  if (hasPrefix(paths, '.github/ISSUE_TEMPLATE/') || has(paths, '.github/ISSUE_TEMPLATE.md'))
    comm += 25;
  if (has(paths, '.github/PULL_REQUEST_TEMPLATE.md', '.github/pull_request_template.md'))
    comm += 20;
  if (has(paths, 'CODE_OF_CONDUCT.md', '.github/CODE_OF_CONDUCT.md')) comm += 20;
  if (has(paths, 'CONTRIBUTING.md', '.github/CONTRIBUTING.md')) comm += 20;
  if (has(paths, '.github/FUNDING.yml')) comm += 15;
  return clamp(comm, 0, 100);
}

function detectTech(paths: Set<string>): string[] {
  const tech: string[] = [];
  for (const [file, techName] of Object.entries(TECH_DETECT_MAP)) {
    if (paths.has(file) && !tech.includes(techName)) {
      tech.push(techName);
    }
  }
  return tech;
}

// ── Light analysis (tree-only) ──

function analyzeTree(
  paths: Set<string>,
  repoInfo: { license: { spdx_id: string } | null; language: string | null },
): { categories: Record<CategoryKey, number>; tech: string[] } {
  return {
    categories: {
      documentation: scoreDocumentation(paths),
      security: scoreSecurity(paths),
      cicd: scoreCicd(paths),
      dependencies: scoreDependencies(paths),
      codeQuality: scoreCodeQuality(paths),
      license: scoreLicense(paths, repoInfo.license),
      community: scoreCommunity(paths),
    },
    tech: detectTech(paths),
  };
}

function computeOverallScore(cats: Record<CategoryKey, number>): number {
  let total = 0;
  for (const key of CATEGORY_KEYS) {
    total += cats[key] * CATEGORY_WEIGHTS[key];
  }
  return Math.round(total);
}

// ── Helpers for analyze callback (reduce cognitive complexity) ──

async function fetchUserRepos(
  trimmed: string,
  headers: Record<string, string>,
  signal: AbortSignal,
): Promise<GitHubRepoResponse[]> {
  const reposRes = await fetch(
    `${GITHUB_API_BASE}/users/${encodeURIComponent(trimmed)}/repos?sort=updated&per_page=30&type=owner`,
    { headers, signal },
  );

  if (!reposRes.ok) {
    if (reposRes.status === 404) throw new Error(`User "${trimmed}" not found on GitHub.`);
    if (reposRes.status === 403)
      throw new Error('GitHub API rate limit exceeded. Add a token in Settings.');
    throw new Error(`GitHub API error: ${reposRes.status} ${reposRes.statusText}`);
  }

  return reposRes.json();
}

async function analyzeSingleRepo(
  repo: GitHubRepoResponse,
  headers: Record<string, string>,
  signal: AbortSignal,
): Promise<RepoAnalysis | null> {
  const treeRes = await fetch(
    `${GITHUB_API_BASE}/repos/${repo.full_name}/git/trees/${repo.default_branch}?recursive=1`,
    { headers, signal },
  );

  if (!treeRes.ok) return null;

  const treeData: { tree: TreeEntry[] } = await treeRes.json();
  const pathSet = new Set(treeData.tree.filter((e) => e.type === 'blob').map((e) => e.path));

  const { categories, tech } = analyzeTree(pathSet, {
    license: repo.license,
    language: repo.language,
  });
  const score = computeOverallScore(categories);

  return {
    name: repo.name,
    fullName: repo.full_name,
    grade: scoreToGrade(score),
    score,
    language: repo.language,
    stars: repo.stargazers_count,
    categories,
    techDetected: tech,
  };
}

async function analyzeReposSequentially(
  repos: GitHubRepoResponse[],
  headers: Record<string, string>,
  signal: AbortSignal,
  setProgress: (n: number) => void,
  setProgressLabel: (s: string) => void,
): Promise<RepoAnalysis[]> {
  const analyses: RepoAnalysis[] = [];
  for (let i = 0; i < repos.length; i++) {
    if (signal.aborted) break;

    const repo = repos[i];
    setProgress(Math.round(10 + ((i + 1) / repos.length) * 85));
    setProgressLabel(`Analyzing ${repo.name} (${i + 1}/${repos.length})...`);

    try {
      const result = await analyzeSingleRepo(repo, headers, signal);
      if (result) analyses.push(result);
    } catch {
      if (signal.aborted) break;
    }
  }
  return analyses;
}

function buildPortfolioData(trimmed: string, analyses: RepoAnalysis[]): PortfolioData {
  const avgScore = Math.round(analyses.reduce((sum, r) => sum + r.score, 0) / analyses.length);

  const categoryAverages = {} as Record<CategoryKey, number>;
  for (const key of CATEGORY_KEYS) {
    categoryAverages[key] = Math.round(
      analyses.reduce((sum, r) => sum + r.categories[key], 0) / analyses.length,
    );
  }

  const langCounts: Record<string, number> = {};
  for (const r of analyses) {
    if (r.language) {
      langCounts[r.language] = (langCounts[r.language] || 0) + 1;
    }
  }
  const topLanguages = Object.entries(langCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({
      name,
      count,
      color: LANGUAGE_COLORS[name] || '#8b949e',
    }));

  const strengths: string[] = [];
  for (const key of CATEGORY_KEYS) {
    if (categoryAverages[key] >= 70) {
      strengths.push(`Strong ${CATEGORY_LABELS[key]}`);
    }
  }

  const techSet = new Set<string>();
  for (const r of analyses) {
    for (const t of r.techDetected) techSet.add(t);
  }

  return {
    username: trimmed,
    avatarUrl: `https://github.com/${encodeURIComponent(trimmed)}.png?size=80`,
    repoCount: analyses.length,
    repos: [...analyses].sort((a, b) => b.score - a.score),
    overallScore: avgScore,
    overallGrade: scoreToGrade(avgScore),
    topLanguages,
    categoryAverages,
    strengths,
    allTech: Array.from(techSet).sort((a, b) => a.localeCompare(b)),
  };
}

// ── Component ──

export function PortfolioPage({ onBack, onAnalyze, githubToken }: Props) {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const analyze = useCallback(async () => {
    const trimmed = username.trim();
    if (!trimmed) return;

    setLoading(true);
    setProgress(0);
    setProgressLabel('Fetching repositories...');
    setError(null);
    setPortfolio(null);

    const controller = new AbortController();
    abortRef.current = controller;
    const signal = controller.signal;
    const headers = authHeaders(githubToken);

    try {
      const reposData = await fetchUserRepos(trimmed, headers, signal);
      const nonForkRepos = reposData.filter((r) => !r.fork).slice(0, MAX_REPOS);

      if (nonForkRepos.length === 0) {
        throw new Error(`No non-fork repositories found for "${trimmed}".`);
      }

      setProgress(10);
      setProgressLabel(`Analyzing ${nonForkRepos.length} repositories...`);

      const analyses = await analyzeReposSequentially(
        nonForkRepos,
        headers,
        signal,
        setProgress,
        setProgressLabel,
      );

      if (analyses.length === 0) {
        throw new Error('Could not analyze any repositories. They may be empty or inaccessible.');
      }

      setProgress(100);
      setProgressLabel('Complete!');
      setPortfolio(buildPortfolioData(trimmed, analyses));
    } catch (err: unknown) {
      if (!signal.aborted) {
        setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
      }
    } finally {
      setLoading(false);
    }
  }, [username, githubToken]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    analyze();
  };

  const resetAnalysis = () => {
    if (abortRef.current) abortRef.current.abort();
    setPortfolio(null);
    setError(null);
    setLoading(false);
    setProgress(0);
  };

  return (
    <div className="w-full px-8 lg:px-12 xl:px-16 py-10">
      {/* Back button */}
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-neon transition-colors mb-6"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to analyzer
      </button>

      {/* Header */}
      <div className="mb-10">
        <h1 className="text-4xl lg:text-5xl font-bold text-text">
          Developer <span className="text-neon neon-text">Portfolio</span>
        </h1>
        <p className="text-lg text-text-secondary mt-3 max-w-2xl leading-relaxed">
          Analyze a GitHub user's public repositories to generate a comprehensive developer profile
          with scores, language breakdown, and skill assessment.
        </p>
      </div>

      {/* Input form */}
      {!portfolio && (
        <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto mb-10">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <svg
                  className="h-5 w-5 text-text-muted"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter GitHub username..."
                disabled={loading}
                className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-surface-alt border border-border text-text placeholder:text-text-muted focus:outline-none focus:border-neon focus:ring-1 focus:ring-neon/30 transition-all text-base disabled:opacity-50"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !username.trim()}
              className="px-6 py-3.5 rounded-xl bg-neon/10 border border-neon/30 text-neon font-semibold text-base hover:bg-neon/20 hover:border-neon/50 transition-all disabled:opacity-40 disabled:cursor-not-allowed neon-glow whitespace-nowrap"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Analyzing...
                </span>
              ) : (
                'Analyze Portfolio'
              )}
            </button>
          </div>
        </form>
      )}

      {/* Progress */}
      {loading && (
        <div className="w-full max-w-2xl mx-auto mb-10">
          <div className="flex justify-between text-sm text-text-secondary mb-2">
            <span>{progressLabel}</span>
            <span className="text-neon font-medium">{progress}%</span>
          </div>
          <div className="h-3 bg-surface-alt rounded-full overflow-hidden border border-border">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%`, boxShadow: '0 0 12px rgba(0, 212, 255, 0.4)' }}
            />
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="w-full max-w-2xl mx-auto mb-10 px-5 py-4 rounded-xl bg-grade-f/10 border border-grade-f/25 flex items-start gap-3">
          <svg
            className="h-5 w-5 text-grade-f shrink-0 mt-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div className="flex-1">
            <p className="text-sm text-grade-f font-medium">{error}</p>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-text-muted hover:text-text transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      )}

      {/* Results */}
      {portfolio && (
        <div className="space-y-8">
          {/* Profile Card Header */}
          <div className="p-6 sm:p-8 rounded-2xl bg-surface-alt border border-border">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
              {/* Avatar + info */}
              <img
                src={portfolio.avatarUrl}
                alt={`${portfolio.username}'s avatar`}
                className="h-20 w-20 rounded-full border-2 border-border shrink-0"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
              <div className="flex-1 text-center sm:text-left">
                <h2 className="text-2xl sm:text-3xl font-bold text-text">{portfolio.username}</h2>
                <p className="text-text-secondary mt-1">
                  {portfolio.repoCount} {portfolio.repoCount === 1 ? 'repository' : 'repositories'}{' '}
                  analyzed
                </p>
              </div>
              {/* Overall grade */}
              <div className="shrink-0">
                <OverallGradeRing grade={portfolio.overallGrade} score={portfolio.overallScore} />
              </div>
            </div>

            {/* New analysis button */}
            <div className="mt-6 flex justify-center sm:justify-start">
              <button
                onClick={resetAnalysis}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-border bg-surface-alt hover:bg-surface-hover hover:border-neon/30 transition-all duration-200 text-text-secondary hover:text-text"
              >
                Analyze Another User
              </button>
            </div>
          </div>

          {/* Top Languages */}
          {portfolio.topLanguages.length > 0 && (
            <div className="p-6 rounded-2xl bg-surface-alt border border-border">
              <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4">
                Top Languages
              </h3>
              <div className="flex flex-wrap gap-2">
                {portfolio.topLanguages.map((lang) => (
                  <span
                    key={lang.name}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border border-border bg-surface-hover"
                  >
                    <span
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: lang.color }}
                    />
                    <span className="text-text">{lang.name}</span>
                    <span className="text-text-muted text-xs">({lang.count})</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Category Averages — horizontal bars */}
          <div className="p-6 rounded-2xl bg-surface-alt border border-border">
            <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-5">
              Category Averages
            </h3>
            <div className="space-y-4">
              {CATEGORY_KEYS.map((key) => {
                const score = portfolio.categoryAverages[key];
                const grade = scoreToGrade(score);
                const color = GRADE_COLORS[grade];

                return (
                  <div key={key}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-text">{CATEGORY_LABELS[key]}</span>
                      <span
                        className="text-sm font-bold tabular-nums"
                        style={{ color, textShadow: `0 0 8px ${color}30` }}
                      >
                        {score}
                      </span>
                    </div>
                    <div className="h-2.5 bg-surface-hover rounded-full overflow-hidden border border-border">
                      <div
                        className="h-full rounded-full transition-all duration-700 ease-out"
                        style={{
                          width: `${score}%`,
                          backgroundColor: color,
                          boxShadow: `0 0 10px ${color}40`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Strengths */}
          {portfolio.strengths.length > 0 && (
            <div className="p-6 rounded-2xl bg-surface-alt border border-border">
              <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4">
                Strengths
              </h3>
              <div className="flex flex-wrap gap-2">
                {portfolio.strengths.map((s) => (
                  <span
                    key={s}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-grade-a/10 border border-grade-a/25 text-grade-a"
                  >
                    <svg
                      className="h-4 w-4 shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Repo Breakdown Table */}
          <div className="rounded-2xl bg-surface-alt border border-border overflow-hidden">
            <div className="px-6 py-4 border-b border-border">
              <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
                Repository Breakdown
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-6 text-text-secondary font-semibold">
                      Repository
                    </th>
                    <th className="text-center py-3 px-4 text-text-secondary font-semibold">
                      Grade
                    </th>
                    <th className="text-center py-3 px-4 text-text-secondary font-semibold">
                      Score
                    </th>
                    <th className="text-left py-3 px-4 text-text-secondary font-semibold hidden sm:table-cell">
                      Language
                    </th>
                    <th className="text-right py-3 px-6 text-text-secondary font-semibold hidden sm:table-cell">
                      Stars
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {portfolio.repos.map((repo) => {
                    const gradeColor = gradeColorClass(repo.grade);
                    return (
                      <tr
                        key={repo.fullName}
                        className="border-b border-border last:border-b-0 hover:bg-surface-hover transition-colors"
                      >
                        <td className="py-3 px-6">
                          <button
                            onClick={() => onAnalyze(repo.fullName)}
                            className="text-neon hover:underline font-medium text-left"
                            title={`Analyze ${repo.fullName}`}
                          >
                            {repo.name}
                          </button>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`${gradeColor} font-bold text-lg`}>{repo.grade}</span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="text-text tabular-nums">{repo.score}</span>
                        </td>
                        <td className="py-3 px-4 hidden sm:table-cell">
                          {repo.language ? (
                            <span className="inline-flex items-center gap-1.5 text-text-secondary">
                              <span
                                className="h-2.5 w-2.5 rounded-full shrink-0"
                                style={{
                                  backgroundColor: LANGUAGE_COLORS[repo.language] || '#8b949e',
                                }}
                              />
                              {repo.language}
                            </span>
                          ) : (
                            <span className="text-text-muted">--</span>
                          )}
                        </td>
                        <td className="py-3 px-6 text-right hidden sm:table-cell">
                          <span className="text-text-muted tabular-nums">
                            {formatNumber(repo.stars)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Skills Summary */}
          {portfolio.allTech.length > 0 && (
            <div className="p-6 rounded-2xl bg-surface-alt border border-border">
              <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4">
                Skills Summary
              </h3>
              <p className="text-sm text-text-muted mb-4">
                Technologies detected across all analyzed repositories.
              </p>
              <div className="flex flex-wrap gap-2">
                {portfolio.allTech.map((tech) => (
                  <span
                    key={tech}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium bg-neon/10 border border-neon/20 text-neon"
                  >
                    {tech}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Subcomponent: Overall Grade Ring ──

function OverallGradeRing({ grade, score }: { grade: LetterGrade; score: number }) {
  const color = GRADE_COLORS[grade];
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const viewBox = 120;
  const center = viewBox / 2;

  return (
    <div className="relative h-28 w-28 flex items-center justify-center">
      <svg className="absolute inset-0 -rotate-90" viewBox={`0 0 ${viewBox} ${viewBox}`}>
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={4}
          className="text-border"
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={4}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
          style={{ filter: `drop-shadow(0 0 8px ${color}60)` }}
        />
      </svg>
      <div className="text-center">
        <div className="text-4xl font-black" style={{ color, textShadow: `0 0 20px ${color}40` }}>
          {grade}
        </div>
        <div className="text-xs text-text-secondary font-semibold mt-0.5">{score}/100</div>
      </div>
    </div>
  );
}
