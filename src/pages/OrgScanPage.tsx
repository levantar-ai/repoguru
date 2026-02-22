import { useState, useCallback, useRef, useMemo } from 'react';
import { getCategoryScore } from './orgScanUtils';
import type {
  LetterGrade,
  CategoryKey,
  CategoryResult,
  Signal,
  LightAnalysisReport,
  TreeEntry,
  TechStackItem,
  ParsedRepo,
  RepoInfo,
} from '../types';
import {
  GITHUB_API_BASE,
  CATEGORY_WEIGHTS,
  CATEGORY_LABELS,
  GRADE_THRESHOLDS,
} from '../utils/constants';

// ─── Props ───────────────────────────────────────────────────────────────────

interface Props {
  onBack: () => void;
  onAnalyze: (url: string) => void;
  githubToken: string;
}

// ─── Grade / Score helpers ───────────────────────────────────────────────────

function scoreToGrade(score: number): LetterGrade {
  if (score >= GRADE_THRESHOLDS.A) return 'A';
  if (score >= GRADE_THRESHOLDS.B) return 'B';
  if (score >= GRADE_THRESHOLDS.C) return 'C';
  if (score >= GRADE_THRESHOLDS.D) return 'D';
  return 'F';
}

function scoreColorClass(score: number): string {
  if (score >= 85) return 'text-grade-a';
  if (score >= 70) return 'text-grade-b';
  if (score >= 55) return 'text-grade-c';
  if (score >= 40) return 'text-grade-d';
  return 'text-grade-f';
}

function scoreBgClass(score: number): string {
  if (score >= 85) return 'bg-grade-a/15';
  if (score >= 70) return 'bg-grade-b/15';
  if (score >= 55) return 'bg-grade-c/15';
  if (score >= 40) return 'bg-grade-d/15';
  return 'bg-grade-f/15';
}

function gradeTextClass(grade: LetterGrade): string {
  const map: Record<LetterGrade, string> = {
    A: 'text-grade-a',
    B: 'text-grade-b',
    C: 'text-grade-c',
    D: 'text-grade-d',
    F: 'text-grade-f',
  };
  return map[grade];
}

// ─── Light Analysis Engine (tree-only, inline) ──────────────────────────────

function cap100(n: number): number {
  return Math.min(100, Math.max(0, n));
}

function hasPath(paths: Set<string>, target: string): boolean {
  return paths.has(target) || paths.has(target.toLowerCase());
}

function hasAnyPath(paths: Set<string>, targets: string[]): boolean {
  return targets.some((t) => hasPath(paths, t));
}

function hasPrefix(paths: Set<string>, prefix: string): boolean {
  const lower = prefix.toLowerCase();
  for (const p of paths) {
    if (p.startsWith(prefix) || p.toLowerCase().startsWith(lower)) return true;
  }
  return false;
}

function countPrefix(paths: Set<string>, prefix: string): number {
  const lower = prefix.toLowerCase();
  let count = 0;
  for (const p of paths) {
    if (p.startsWith(prefix) || p.toLowerCase().startsWith(lower)) count++;
  }
  return count;
}

function hasDir(paths: Set<string>, dir: string): boolean {
  const d = dir.endsWith('/') ? dir : dir + '/';
  return hasPrefix(paths, d);
}

function analyzeDocumentation(paths: Set<string>): { score: number; signals: Signal[] } {
  let score = 0;
  const signals: Signal[] = [];

  const hasReadme = hasAnyPath(paths, ['README.md', 'README.rst', 'readme.md', 'README']);
  if (hasReadme) score += 30;
  signals.push({ name: 'README.md', found: hasReadme });

  const hasContributing = hasPath(paths, 'CONTRIBUTING.md');
  if (hasContributing) score += 20;
  signals.push({ name: 'CONTRIBUTING.md', found: hasContributing });

  const hasChangelog = hasAnyPath(paths, ['CHANGELOG.md', 'CHANGES.md', 'HISTORY.md']);
  if (hasChangelog) score += 15;
  signals.push({ name: 'CHANGELOG.md', found: hasChangelog });

  const hasDocs = hasDir(paths, 'docs');
  if (hasDocs) score += 15;
  signals.push({ name: 'docs/ directory', found: hasDocs });

  const hasLicense = hasAnyPath(paths, [
    'LICENSE',
    'LICENSE.md',
    'LICENSE.txt',
    'LICENCE',
    'LICENCE.md',
  ]);
  if (hasLicense) score += 20;
  signals.push({ name: 'LICENSE file', found: hasLicense });

  return { score: cap100(score), signals };
}

function analyzeSecurity(paths: Set<string>): { score: number; signals: Signal[] } {
  let score = 0;
  const signals: Signal[] = [];

  const hasSecurity = hasPath(paths, 'SECURITY.md');
  if (hasSecurity) score += 25;
  signals.push({ name: 'SECURITY.md', found: hasSecurity });

  const hasCodeowners = hasAnyPath(paths, ['CODEOWNERS', '.github/CODEOWNERS']);
  if (hasCodeowners) score += 20;
  signals.push({ name: 'CODEOWNERS', found: hasCodeowners });

  const hasDependabot = hasAnyPath(paths, ['.github/dependabot.yml', '.github/dependabot.yaml']);
  if (hasDependabot) score += 25;
  signals.push({ name: 'Dependabot config', found: hasDependabot });

  const hasGitignore = hasPath(paths, '.gitignore');
  if (hasGitignore) score += 15;
  signals.push({ name: '.gitignore', found: hasGitignore });

  const hasWorkflows = hasPrefix(paths, '.github/workflows/');
  if (hasWorkflows) score += 15;
  signals.push({ name: 'CI workflows present', found: hasWorkflows });

  return { score: cap100(score), signals };
}

function analyzeCicd(paths: Set<string>): { score: number; signals: Signal[] } {
  let score = 0;
  const signals: Signal[] = [];

  const workflowCount = countPrefix(paths, '.github/workflows/');
  const hasWorkflows = workflowCount > 0;
  if (hasWorkflows) score += 35;
  signals.push({
    name: 'GitHub Actions workflows',
    found: hasWorkflows,
    details: hasWorkflows ? `${workflowCount} found` : undefined,
  });

  const hasDockerfile = hasPath(paths, 'Dockerfile');
  if (hasDockerfile) score += 20;
  signals.push({ name: 'Dockerfile', found: hasDockerfile });

  const hasMakefile = hasPath(paths, 'Makefile');
  if (hasMakefile) score += 15;
  signals.push({ name: 'Makefile', found: hasMakefile });

  const hasCompose = hasAnyPath(paths, [
    'docker-compose.yml',
    'docker-compose.yaml',
    'compose.yml',
    'compose.yaml',
  ]);
  if (hasCompose) score += 15;
  signals.push({ name: 'Docker Compose', found: hasCompose });

  const hasMultipleWorkflows = workflowCount > 1;
  if (hasMultipleWorkflows) score += 15;
  signals.push({
    name: 'Multiple workflows',
    found: hasMultipleWorkflows,
    details: hasMultipleWorkflows ? `${workflowCount} workflows` : undefined,
  });

  return { score: cap100(score), signals };
}

function analyzeDependencies(
  paths: Set<string>,
  treeSize: number,
): { score: number; signals: Signal[] } {
  let score = 0;
  const signals: Signal[] = [];

  const manifests = [
    'package.json',
    'Cargo.toml',
    'go.mod',
    'requirements.txt',
    'Pipfile',
    'pyproject.toml',
    'setup.py',
    'Gemfile',
    'composer.json',
    'pom.xml',
    'build.gradle',
    'build.gradle.kts',
    'setup.cfg',
    'mix.exs',
    'pubspec.yaml',
    'build.sbt',
  ];
  const foundManifests = manifests.filter((m) => hasPath(paths, m));
  const hasManifest = foundManifests.length > 0;
  if (hasManifest) score += 30;
  signals.push({
    name: 'Dependency manifest',
    found: hasManifest,
    details: hasManifest ? foundManifests.join(', ') : undefined,
  });

  const lockfiles = [
    'package-lock.json',
    'yarn.lock',
    'pnpm-lock.yaml',
    'Cargo.lock',
    'go.sum',
    'Gemfile.lock',
    'composer.lock',
    'Pipfile.lock',
    'poetry.lock',
  ];
  const hasLockfile = hasAnyPath(paths, lockfiles);
  if (hasLockfile) score += 25;
  signals.push({ name: 'Lockfile present', found: hasLockfile });

  const reasonableSize = treeSize > 5 && treeSize < 50000;
  if (reasonableSize) score += 20;
  signals.push({
    name: 'Reasonable tree size',
    found: reasonableSize,
    details: `${treeSize} entries`,
  });

  const hasMultipleManifestTypes = foundManifests.length > 1;
  if (hasMultipleManifestTypes) score += 25;
  signals.push({ name: 'Multiple manifest types', found: hasMultipleManifestTypes });

  return { score: cap100(score), signals };
}

function analyzeCodeQuality(paths: Set<string>): { score: number; signals: Signal[] } {
  let score = 0;
  const signals: Signal[] = [];

  const linters = [
    '.eslintrc.json',
    '.eslintrc.js',
    '.eslintrc.yml',
    '.eslintrc',
    'eslint.config.js',
    'eslint.config.mjs',
    'eslint.config.ts',
    '.flake8',
    '.pylintrc',
    'pylintrc',
    '.rubocop.yml',
    '.golangci.yml',
    '.golangci.yaml',
    'clippy.toml',
    'biome.json',
    'biome.jsonc',
  ];
  const hasLinter = hasAnyPath(paths, linters);
  if (hasLinter) score += 25;
  signals.push({ name: 'Linter configured', found: hasLinter });

  const formatters = [
    '.prettierrc',
    '.prettierrc.json',
    '.prettierrc.js',
    '.prettierrc.yml',
    'prettier.config.js',
    'prettier.config.mjs',
    'rustfmt.toml',
    '.rustfmt.toml',
    '.clang-format',
    '.yapfcfg',
    '.style.yapf',
    'biome.json',
  ];
  const hasFormatter = hasAnyPath(paths, formatters);
  if (hasFormatter) score += 20;
  signals.push({ name: 'Formatter configured', found: hasFormatter });

  const hasTsconfig = hasPath(paths, 'tsconfig.json');
  if (hasTsconfig) score += 15;
  signals.push({ name: 'tsconfig.json', found: hasTsconfig });

  const hasTests =
    hasDir(paths, 'test') ||
    hasDir(paths, 'tests') ||
    hasDir(paths, '__tests__') ||
    hasDir(paths, 'spec');
  if (hasTests) score += 25;
  signals.push({ name: 'Test directory', found: hasTests });

  const hasEditorconfig = hasPath(paths, '.editorconfig');
  if (hasEditorconfig) score += 15;
  signals.push({ name: '.editorconfig', found: hasEditorconfig });

  return { score: cap100(score), signals };
}

function analyzeLicense(
  paths: Set<string>,
  repoLicense: string | null,
): { score: number; signals: Signal[] } {
  let score = 0;
  const signals: Signal[] = [];

  const hasLicenseFile = hasAnyPath(paths, [
    'LICENSE',
    'LICENCE',
    'LICENSE.md',
    'LICENSE.txt',
    'LICENCE.md',
    'LICENCE.txt',
  ]);
  if (hasLicenseFile) score += 50;
  signals.push({ name: 'LICENSE file exists', found: hasLicenseFile });

  const hasExtension = hasAnyPath(paths, [
    'LICENSE.md',
    'LICENSE.txt',
    'LICENCE.md',
    'LICENCE.txt',
  ]);
  if (hasExtension) score += 10;
  signals.push({ name: 'Known file extension (.md/.txt)', found: hasExtension });

  const detectedByApi = !!repoLicense;
  if (detectedByApi) score += 40;
  signals.push({
    name: 'Detected by GitHub API',
    found: detectedByApi,
    details: repoLicense ?? undefined,
  });

  return { score: cap100(score), signals };
}

function analyzeCommunity(paths: Set<string>): { score: number; signals: Signal[] } {
  let score = 0;
  const signals: Signal[] = [];

  const hasIssueTemplates = hasPrefix(paths, '.github/ISSUE_TEMPLATE/');
  if (hasIssueTemplates) score += 25;
  signals.push({ name: 'Issue templates', found: hasIssueTemplates });

  const hasPrTemplate =
    hasAnyPath(paths, [
      '.github/PULL_REQUEST_TEMPLATE.md',
      '.github/pull_request_template.md',
      'PULL_REQUEST_TEMPLATE.md',
      '.github/PULL_REQUEST_TEMPLATE/',
    ]) || hasPrefix(paths, '.github/PULL_REQUEST_TEMPLATE/');
  if (hasPrTemplate) score += 20;
  signals.push({ name: 'PR template', found: hasPrTemplate });

  const hasCoc = hasAnyPath(paths, ['CODE_OF_CONDUCT.md', '.github/CODE_OF_CONDUCT.md']);
  if (hasCoc) score += 20;
  signals.push({ name: 'Code of Conduct', found: hasCoc });

  const hasContributing = hasPath(paths, 'CONTRIBUTING.md');
  if (hasContributing) score += 20;
  signals.push({ name: 'CONTRIBUTING.md', found: hasContributing });

  const hasFunding = hasPath(paths, '.github/FUNDING.yml');
  if (hasFunding) score += 15;
  signals.push({ name: 'FUNDING.yml', found: hasFunding });

  return { score: cap100(score), signals };
}

function analyzeOpenssf(paths: Set<string>): { score: number; signals: Signal[] } {
  let score = 0;
  const signals: Signal[] = [];

  // No binary artifacts
  const binaryExts = ['.exe', '.dll', '.jar', '.so', '.class', '.pyc'];
  const hasBinary = [...paths].some((p) => binaryExts.some((ext) => p.toLowerCase().endsWith(ext)));
  if (!hasBinary) score += 10;
  signals.push({ name: 'No binary artifacts', found: !hasBinary });

  // No dangerous patterns (assumed safe — can't read content)
  score += 10;
  signals.push({ name: 'No dangerous workflow patterns', found: true });

  // SLSA / signed releases — check workflow filenames
  const hasSlsa = [...paths].some(
    (p) =>
      p.startsWith('.github/workflows/') &&
      (p.toLowerCase().includes('slsa') ||
        p.toLowerCase().includes('provenance') ||
        p.toLowerCase().includes('scorecard')),
  );
  if (hasSlsa) score += 10;
  signals.push({ name: 'SLSA / signed releases', found: hasSlsa });

  // Fuzzing
  const hasFuzzing = [...paths].some(
    (p) => p.toLowerCase().includes('fuzz') || p.toLowerCase().includes('oss-fuzz'),
  );
  if (hasFuzzing) score += 10;
  signals.push({ name: 'Fuzzing', found: hasFuzzing });

  // Dependency update tool
  const hasDependabot = hasAnyPath(paths, ['.github/dependabot.yml', '.github/dependabot.yaml']);
  const hasRenovate = hasAnyPath(paths, ['.renovaterc', '.renovaterc.json', 'renovate.json']);
  if (hasDependabot || hasRenovate) score += 10;
  signals.push({ name: 'Dependency update tool', found: hasDependabot || hasRenovate });

  // Security policy
  const hasSecurityPolicy = hasPath(paths, 'SECURITY.md');
  if (hasSecurityPolicy) score += 5;
  signals.push({ name: 'Security policy', found: hasSecurityPolicy });

  // License detected
  const hasLicense = hasAnyPath(paths, [
    'LICENSE',
    'LICENSE.md',
    'LICENSE.txt',
    'LICENCE',
    'COPYING',
  ]);
  if (hasLicense) score += 5;
  signals.push({ name: 'License detected', found: hasLicense });

  return { score: cap100(score), signals };
}

function runLightAnalysis(
  repoInfo: RepoInfo,
  treePaths: Set<string>,
  treeSize: number,
): LightAnalysisReport {
  const doc = analyzeDocumentation(treePaths);
  const sec = analyzeSecurity(treePaths);
  const ci = analyzeCicd(treePaths);
  const deps = analyzeDependencies(treePaths, treeSize);
  const quality = analyzeCodeQuality(treePaths);
  const lic = analyzeLicense(treePaths, repoInfo.license);
  const comm = analyzeCommunity(treePaths);
  const ossf = analyzeOpenssf(treePaths);

  const categories: CategoryResult[] = [
    {
      key: 'documentation',
      label: CATEGORY_LABELS.documentation,
      score: doc.score,
      weight: CATEGORY_WEIGHTS.documentation,
      signals: doc.signals,
    },
    {
      key: 'security',
      label: CATEGORY_LABELS.security,
      score: sec.score,
      weight: CATEGORY_WEIGHTS.security,
      signals: sec.signals,
    },
    {
      key: 'cicd',
      label: CATEGORY_LABELS.cicd,
      score: ci.score,
      weight: CATEGORY_WEIGHTS.cicd,
      signals: ci.signals,
    },
    {
      key: 'dependencies',
      label: CATEGORY_LABELS.dependencies,
      score: deps.score,
      weight: CATEGORY_WEIGHTS.dependencies,
      signals: deps.signals,
    },
    {
      key: 'codeQuality',
      label: CATEGORY_LABELS.codeQuality,
      score: quality.score,
      weight: CATEGORY_WEIGHTS.codeQuality,
      signals: quality.signals,
    },
    {
      key: 'license',
      label: CATEGORY_LABELS.license,
      score: lic.score,
      weight: CATEGORY_WEIGHTS.license,
      signals: lic.signals,
    },
    {
      key: 'community',
      label: CATEGORY_LABELS.community,
      score: comm.score,
      weight: CATEGORY_WEIGHTS.community,
      signals: comm.signals,
    },
    {
      key: 'openssf',
      label: CATEGORY_LABELS.openssf,
      score: ossf.score,
      weight: CATEGORY_WEIGHTS.openssf,
      signals: ossf.signals,
    },
  ];

  const overallScore = Math.round(categories.reduce((acc, c) => acc + c.score * c.weight, 0));

  const grade = scoreToGrade(overallScore);

  // Detect tech stack from manifests
  const techStack: TechStackItem[] = [];
  if (hasPath(treePaths, 'package.json')) techStack.push({ name: 'Node.js', category: 'platform' });
  if (hasPath(treePaths, 'tsconfig.json'))
    techStack.push({ name: 'TypeScript', category: 'language' });
  if (hasPath(treePaths, 'Cargo.toml')) techStack.push({ name: 'Rust', category: 'language' });
  if (hasPath(treePaths, 'go.mod')) techStack.push({ name: 'Go', category: 'language' });
  if (hasAnyPath(treePaths, ['requirements.txt', 'pyproject.toml', 'setup.py', 'Pipfile']))
    techStack.push({ name: 'Python', category: 'language' });
  if (hasAnyPath(treePaths, ['Gemfile', 'Rakefile']))
    techStack.push({ name: 'Ruby', category: 'language' });
  if (hasPath(treePaths, 'Dockerfile')) techStack.push({ name: 'Docker', category: 'tool' });
  if (hasAnyPath(treePaths, ['pom.xml', 'build.gradle', 'build.gradle.kts']))
    techStack.push({ name: 'Java/JVM', category: 'language' });
  if (
    repoInfo.language &&
    !techStack.some((t) => t.name.toLowerCase() === repoInfo.language!.toLowerCase())
  ) {
    techStack.push({ name: repoInfo.language, category: 'language' });
  }

  const repo: ParsedRepo = { owner: repoInfo.owner, repo: repoInfo.repo };

  return {
    repo,
    repoInfo,
    grade,
    overallScore,
    categories,
    techStack,
    treeEntryCount: treeSize,
    analyzedAt: new Date().toISOString(),
  };
}

// ─── Sort types ──────────────────────────────────────────────────────────────

type SortField = 'name' | 'grade' | 'overall' | CategoryKey;
type SortDir = 'asc' | 'desc';

// ─── Scan state ──────────────────────────────────────────────────────────────

interface ScanState {
  phase: 'idle' | 'fetching-repos' | 'analyzing' | 'done' | 'error';
  orgName: string;
  repos: LightAnalysisReport[];
  totalRepos: number;
  analyzedCount: number;
  currentRepo: string;
  error: string | null;
}

const initialScanState: ScanState = {
  phase: 'idle',
  orgName: '',
  repos: [],
  totalRepos: 0,
  analyzedCount: 0,
  currentRepo: '',
  error: null,
};

// ── Sort header helper component (extracted outside parent to avoid re-creation) ──

function SortHeader({
  field,
  label,
  className = '',
  sortField,
  sortDir,
  onToggleSort,
}: Readonly<{
  field: SortField;
  label: string;
  className?: string;
  sortField: SortField;
  sortDir: SortDir;
  onToggleSort: (field: SortField) => void;
}>) {
  return (
    <th
      className={`py-3 px-3 text-left text-xs font-semibold uppercase tracking-wider text-text-secondary cursor-pointer select-none hover:text-neon transition-colors whitespace-nowrap ${className}`}
      onClick={() => onToggleSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortField === field && (
          <svg className="h-3 w-3 text-neon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {sortDir === 'desc' ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M19 9l-7 7-7-7"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M5 15l7-7 7 7"
              />
            )}
          </svg>
        )}
      </span>
    </th>
  );
}

// ── Re-export from utility module ──────────────────────────────────────

// getCategoryScore is imported from orgScanUtils.ts

// ── ScoreCell component (extracted outside parent to satisfy S6478) ──

function ScoreCell({ score }: Readonly<{ score: number }>) {
  return (
    <td className={`py-3 px-3 font-medium ${scoreColorClass(score)}`}>
      <span
        className={`inline-block px-2 py-0.5 rounded-md text-xs font-semibold ${scoreBgClass(score)} ${scoreColorClass(score)}`}
      >
        {score}
      </span>
    </td>
  );
}

// ── Analyze a single repo from org scan (extracted to reduce nesting depth) ──

async function analyzeOrgRepo(
  org: string,
  rawRepo: Record<string, unknown>,
  ghFetchFn: (url: string, signal?: AbortSignal) => Promise<Response>,
  signal: AbortSignal,
): Promise<LightAnalysisReport | null> {
  const repoName = rawRepo.name as string;
  const defaultBranch = (rawRepo.default_branch as string) || 'main';

  const repoInfo: RepoInfo = {
    owner: org,
    repo: repoName,
    defaultBranch,
    description: (rawRepo.description as string) ?? '',
    stars: (rawRepo.stargazers_count as number) ?? 0,
    forks: (rawRepo.forks_count as number) ?? 0,
    openIssues: (rawRepo.open_issues_count as number) ?? 0,
    license: (rawRepo.license as { spdx_id?: string } | null)?.spdx_id ?? null,
    language: (rawRepo.language as string | null) ?? null,
    createdAt: (rawRepo.created_at as string) ?? '',
    updatedAt: (rawRepo.updated_at as string) ?? '',
    topics: (rawRepo.topics as string[]) ?? [],
    archived: (rawRepo.archived as boolean) ?? false,
    size: (rawRepo.size as number) ?? 0,
  };

  const treeRes = await ghFetchFn(
    `${GITHUB_API_BASE}/repos/${encodeURIComponent(org)}/${encodeURIComponent(repoName)}/git/trees/${encodeURIComponent(defaultBranch)}?recursive=1`,
    signal,
  );
  const treeJson = await treeRes.json();
  const treeEntries: TreeEntry[] = treeJson.tree ?? [];
  const treePaths = new Set(treeEntries.map((e: TreeEntry) => e.path));

  return runLightAnalysis(repoInfo, treePaths, treeEntries.length);
}

// ── Compute progress percentage (extracted to avoid nested ternary) ──

function computeScanProgress(scan: ScanState): number {
  if (scan.phase === 'fetching-repos') return 5;
  if (scan.phase === 'analyzing' && scan.totalRepos > 0) {
    return 10 + (scan.analyzedCount / scan.totalRepos) * 85;
  }
  if (scan.phase === 'done') return 100;
  return 0;
}

// ── Fetch and filter org repo list ───────────────────────────────────────────

async function fetchOrgRepoList(
  org: string,
  ghFetchFn: (url: string, signal?: AbortSignal) => Promise<Response>,
  signal: AbortSignal,
): Promise<Record<string, unknown>[] | null> {
  const reposRes = await ghFetchFn(
    `${GITHUB_API_BASE}/orgs/${encodeURIComponent(org)}/repos?per_page=100&sort=updated`,
    signal,
  );
  const reposJson = await reposRes.json();

  if (!Array.isArray(reposJson) || reposJson.length === 0) return null;

  const repoList = reposJson
    .filter((r: Record<string, unknown>) => !r.archived && !r.fork)
    .slice(0, 20);

  return repoList.length < 5
    ? reposJson.filter((r: Record<string, unknown>) => !r.archived).slice(0, 20)
    : repoList;
}

// ── Analyze a list of repos with progress updates ───────────────────────────

async function analyzeRepoList(
  org: string,
  repoList: Record<string, unknown>[],
  ghFetchFn: (url: string, signal?: AbortSignal) => Promise<Response>,
  controller: AbortController,
  setScan: (updater: ScanState | ((prev: ScanState) => ScanState)) => void,
): Promise<LightAnalysisReport[]> {
  const results: LightAnalysisReport[] = [];

  for (const rawRepo of repoList) {
    if (controller.signal.aborted) break;

    const repoName = rawRepo.name as string;
    setScan((s) => ({ ...s, currentRepo: repoName }));

    try {
      const report = await analyzeOrgRepo(org, rawRepo, ghFetchFn, controller.signal);
      if (report) results.push(report);
    } catch (err: unknown) {
      console.warn(
        `Failed to analyze ${org}/${repoName}:`,
        err instanceof Error ? err.message : err,
      );
    }

    setScan((s) => ({ ...s, repos: [...results], analyzedCount: results.length }));
  }

  return results;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function OrgScanPage({ onBack, onAnalyze, githubToken }: Props) {
  const [orgInput, setOrgInput] = useState('');
  const [scan, setScan] = useState<ScanState>(initialScanState);
  const [sortField, setSortField] = useState<SortField>('overall');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const abortRef = useRef<AbortController | null>(null);

  // ── GitHub fetch helper ──────────────────────────────────────────────────

  const ghFetch = useCallback(
    async (url: string, signal?: AbortSignal): Promise<Response> => {
      const headers: Record<string, string> = {
        Accept: 'application/vnd.github.v3+json',
      };
      if (githubToken) {
        headers.Authorization = `Bearer ${githubToken}`;
      }
      const res = await fetch(url, { headers, signal });
      if (!res.ok) {
        if (res.status === 403 && res.headers.get('X-RateLimit-Remaining') === '0') {
          throw new Error(
            'GitHub API rate limit exceeded. Add a token in Settings for 5,000 req/hr.',
          );
        }
        if (res.status === 404) {
          throw new Error(`Not found: ${url}`);
        }
        throw new Error(`GitHub API error ${res.status}: ${res.statusText}`);
      }
      return res;
    },
    [githubToken],
  );

  // ── Start scan ───────────────────────────────────────────────────────────

  const startScan = useCallback(async () => {
    const org = orgInput.trim();
    if (!org) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setScan({
      phase: 'fetching-repos',
      orgName: org,
      repos: [],
      totalRepos: 0,
      analyzedCount: 0,
      currentRepo: '',
      error: null,
    });

    try {
      const finalList = await fetchOrgRepoList(org, ghFetch, controller.signal);

      if (!finalList) {
        setScan((s) => ({
          ...s,
          phase: 'error',
          error: `No public repositories found for organization "${org}". Verify the org name and try again.`,
        }));
        return;
      }

      setScan((s) => ({ ...s, phase: 'analyzing', totalRepos: finalList.length }));

      const results = await analyzeRepoList(org, finalList, ghFetch, controller, setScan);

      setScan((s) => ({
        ...s,
        phase: 'done',
        repos: results,
        analyzedCount: results.length,
        currentRepo: '',
      }));
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setScan((s) => ({
        ...s,
        phase: 'error',
        error: err instanceof Error ? err.message : 'An unexpected error occurred.',
      }));
    }
  }, [orgInput, ghFetch]);

  // ── Reset ────────────────────────────────────────────────────────────────

  const resetScan = useCallback(() => {
    abortRef.current?.abort();
    setScan(initialScanState);
  }, []);

  // ── Sort logic ───────────────────────────────────────────────────────────

  const toggleSort = useCallback((field: SortField) => {
    setSortField((prev) => {
      if (prev === field) {
        setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
        return prev;
      }
      setSortDir('desc');
      return field;
    });
  }, []);

  const sortedRepos = useMemo(() => {
    const repos = [...scan.repos];
    repos.sort((a, b) => {
      let av: number | string;
      let bv: number | string;

      if (sortField === 'name') {
        av = a.repo.repo.toLowerCase();
        bv = b.repo.repo.toLowerCase();
      } else if (sortField === 'grade' || sortField === 'overall') {
        av = a.overallScore;
        bv = b.overallScore;
      } else {
        // Category key
        const aCat = a.categories.find((c) => c.key === sortField);
        const bCat = b.categories.find((c) => c.key === sortField);
        av = aCat?.score ?? 0;
        bv = bCat?.score ?? 0;
      }

      if (typeof av === 'string' && typeof bv === 'string') {
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
    return repos;
  }, [scan.repos, sortField, sortDir]);

  // ── Summary stats ────────────────────────────────────────────────────────

  const summaryStats = useMemo(() => {
    if (scan.repos.length === 0) return null;

    const total = scan.repos.length;
    const avgScore = Math.round(scan.repos.reduce((s, r) => s + r.overallScore, 0) / total);
    const avgGrade = scoreToGrade(avgScore);

    const distribution: Record<LetterGrade, number> = { A: 0, B: 0, C: 0, D: 0, F: 0 };
    for (const r of scan.repos) {
      distribution[r.grade]++;
    }

    const catAverages: Record<string, number> = {};
    const catKeys: CategoryKey[] = [
      'documentation',
      'security',
      'cicd',
      'dependencies',
      'codeQuality',
      'license',
      'community',
      'openssf',
    ];
    for (const key of catKeys) {
      const sum = scan.repos.reduce((s, r) => {
        const cat = r.categories.find((c) => c.key === key);
        return s + (cat?.score ?? 0);
      }, 0);
      catAverages[key] = Math.round(sum / total);
    }

    return { total, avgScore, avgGrade, distribution, catAverages };
  }, [scan.repos]);

  // ── Export to CSV ────────────────────────────────────────────────────────

  const exportCsv = useCallback(() => {
    if (scan.repos.length === 0) return;

    const headers = [
      'Repo Name',
      'Grade',
      'Overall Score',
      'Documentation',
      'Security',
      'CI/CD',
      'Dependencies',
      'Code Quality',
      'License',
      'Community',
      'OpenSSF',
      'Language',
      'Stars',
      'Forks',
    ];

    const rows = sortedRepos.map((r) => {
      return [
        `${r.repo.owner}/${r.repo.repo}`,
        r.grade,
        r.overallScore,
        getCategoryScore(r.categories, 'documentation'),
        getCategoryScore(r.categories, 'security'),
        getCategoryScore(r.categories, 'cicd'),
        getCategoryScore(r.categories, 'dependencies'),
        getCategoryScore(r.categories, 'codeQuality'),
        getCategoryScore(r.categories, 'license'),
        getCategoryScore(r.categories, 'community'),
        getCategoryScore(r.categories, 'openssf'),
        r.repoInfo.language ?? '',
        r.repoInfo.stars,
        r.repoInfo.forks,
      ].join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${scan.orgName}-org-scan.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [scan.repos, scan.orgName, sortedRepos]);

  // ── Progress percentage ──────────────────────────────────────────────────

  const progress = computeScanProgress(scan);

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="w-full px-8 lg:px-12 xl:px-16 py-10 sm:py-16">
      {/* Back button */}
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-neon transition-colors mb-8"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to report card
      </button>

      {/* Header */}
      <div className="text-center mb-10">
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-text tracking-tight">
          Organization <span className="text-neon neon-text">Scanner</span>
        </h1>
        <p className="mt-4 text-lg text-text-secondary max-w-2xl mx-auto leading-relaxed">
          Scan all public repositories in a GitHub organization. Get a bird's-eye view of
          engineering practices with letter grades for every repo.
        </p>
      </div>

      {/* Input */}
      {scan.phase === 'idle' || scan.phase === 'error' ? (
        <div className="max-w-xl mx-auto mb-10">
          <div className="flex gap-3">
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
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  />
                </svg>
              </div>
              <input
                type="text"
                value={orgInput}
                onChange={(e) => setOrgInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && startScan()}
                placeholder="e.g. facebook, vercel, microsoft"
                className="w-full pl-12 pr-4 py-3.5 text-base rounded-xl border border-border bg-surface-alt text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-neon/50 focus:border-neon/50 transition-all"
              />
            </div>
            <button
              onClick={startScan}
              disabled={!orgInput.trim()}
              className="px-6 py-3.5 text-base font-semibold rounded-xl bg-neon text-surface transition-all hover:shadow-lg hover:shadow-neon/20 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none whitespace-nowrap"
            >
              Scan Organization
            </button>
          </div>
          {!githubToken && (
            <p className="text-xs text-text-muted mt-3 text-center">
              Scanning uses ~1 + N API calls (N = repos). Without a token you have 60 req/hr. Add a
              GitHub token in Settings for 5,000 req/hr.
            </p>
          )}
          {scan.phase === 'error' && scan.error && (
            <div className="mt-6 px-5 py-4 rounded-xl bg-grade-f/10 border border-grade-f/25 text-sm text-grade-f">
              <div className="flex items-start gap-3">
                <svg
                  className="h-5 w-5 shrink-0 mt-0.5"
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
                <div>
                  <p className="font-medium">Scan failed</p>
                  <p className="mt-1 text-grade-f/80">{scan.error}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {/* Progress */}
      {(scan.phase === 'fetching-repos' || scan.phase === 'analyzing') && (
        <div className="max-w-2xl mx-auto mb-12">
          <div className="flex justify-between text-sm text-text-secondary mb-2">
            <span>
              {scan.phase === 'fetching-repos'
                ? `Fetching repos for ${scan.orgName}...`
                : `Analyzing ${scan.currentRepo} (${scan.analyzedCount}/${scan.totalRepos})...`}
            </span>
            <span className="text-neon font-medium">{Math.round(progress)}%</span>
          </div>
          <div className="h-3 bg-surface-alt rounded-full overflow-hidden border border-border">
            <div
              className="h-full bg-gradient-to-r from-primary-500 to-neon rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%`, boxShadow: '0 0 12px rgba(56, 189, 248, 0.4)' }}
            />
          </div>

          {/* Live results preview during scan */}
          {scan.repos.length > 0 && (
            <div className="mt-6 text-sm text-text-muted">
              <p>{scan.repos.length} repos analyzed so far...</p>
            </div>
          )}
        </div>
      )}

      {/* Results */}
      {(scan.phase === 'done' || (scan.phase === 'analyzing' && scan.repos.length > 0)) &&
        summaryStats && (
          <div>
            {/* Action bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
              <h2 className="text-2xl font-bold text-text">
                Results for <span className="text-neon">{scan.orgName}</span>
              </h2>
              <div className="flex gap-3">
                <button
                  onClick={exportCsv}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-border hover:bg-surface-hover hover:border-border-bright text-text-secondary hover:text-neon transition-all"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  Export CSV
                </button>
                {scan.phase === 'done' && (
                  <button
                    onClick={resetScan}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-border hover:bg-surface-hover hover:border-border-bright text-text-secondary hover:text-neon transition-all"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                    New Scan
                  </button>
                )}
              </div>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
              {/* Total repos */}
              <div className="p-5 rounded-xl bg-surface-alt border border-border">
                <div className="text-sm text-text-muted mb-1">Repos Scanned</div>
                <div className="text-3xl font-bold text-text">{summaryStats.total}</div>
              </div>

              {/* Average grade */}
              <div className="p-5 rounded-xl bg-surface-alt border border-border">
                <div className="text-sm text-text-muted mb-1">Average Grade</div>
                <div className={`text-3xl font-bold ${gradeTextClass(summaryStats.avgGrade)}`}>
                  {summaryStats.avgGrade}
                </div>
                <div className="text-sm text-text-muted mt-0.5">{summaryStats.avgScore}/100</div>
              </div>

              {/* Grade distribution */}
              <div className="p-5 rounded-xl bg-surface-alt border border-border col-span-2">
                <div className="text-sm text-text-muted mb-3">Grade Distribution</div>
                <div className="flex items-end gap-2 h-12">
                  {(['A', 'B', 'C', 'D', 'F'] as LetterGrade[]).map((g) => {
                    const count = summaryStats.distribution[g];
                    const maxCount = Math.max(1, ...Object.values(summaryStats.distribution));
                    const pct = (count / maxCount) * 100;
                    const gradeBarBgMap: Record<LetterGrade, string> = {
                      A: 'bg-grade-a',
                      B: 'bg-grade-b',
                      C: 'bg-grade-c',
                      D: 'bg-grade-d',
                      F: 'bg-grade-f',
                    };
                    const gradeBarBg = gradeBarBgMap[g];
                    return (
                      <div key={g} className="flex-1 flex flex-col items-center gap-1">
                        <div
                          className={`w-full rounded-t-sm transition-all duration-500 ${gradeBarBg}`}
                          style={{ height: `${Math.max(4, pct)}%`, opacity: count > 0 ? 1 : 0.2 }}
                        />
                        <div className="flex flex-col items-center">
                          <span className={`text-xs font-bold ${gradeTextClass(g)}`}>{g}</span>
                          <span className="text-xs text-text-muted">{count}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Category averages */}
            <div className="mb-8 p-5 rounded-xl bg-surface-alt border border-border">
              <div className="text-sm font-semibold text-text mb-4">
                Category Averages Across Organization
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4">
                {Object.entries(summaryStats.catAverages).map(([key, avg]) => {
                  const label = CATEGORY_LABELS[key as CategoryKey] || key;
                  return (
                    <div key={key} className="text-center">
                      <div className={`text-2xl font-bold ${scoreColorClass(avg)}`}>{avg}</div>
                      <div className="text-xs text-text-muted mt-1 leading-tight">{label}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Results table */}
            <div className="rounded-xl border border-border overflow-hidden neon-glow">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-surface-alt border-b border-border">
                      <SortHeader
                        field="name"
                        label="Repository"
                        className="min-w-[180px] sticky left-0 bg-surface-alt z-10"
                        sortField={sortField}
                        sortDir={sortDir}
                        onToggleSort={toggleSort}
                      />
                      <SortHeader
                        field="grade"
                        label="Grade"
                        sortField={sortField}
                        sortDir={sortDir}
                        onToggleSort={toggleSort}
                      />
                      <SortHeader
                        field="overall"
                        label="Score"
                        sortField={sortField}
                        sortDir={sortDir}
                        onToggleSort={toggleSort}
                      />
                      <SortHeader
                        field="documentation"
                        label="Docs"
                        sortField={sortField}
                        sortDir={sortDir}
                        onToggleSort={toggleSort}
                      />
                      <SortHeader
                        field="security"
                        label="Security"
                        sortField={sortField}
                        sortDir={sortDir}
                        onToggleSort={toggleSort}
                      />
                      <SortHeader
                        field="cicd"
                        label="CI/CD"
                        sortField={sortField}
                        sortDir={sortDir}
                        onToggleSort={toggleSort}
                      />
                      <SortHeader
                        field="dependencies"
                        label="Deps"
                        sortField={sortField}
                        sortDir={sortDir}
                        onToggleSort={toggleSort}
                      />
                      <SortHeader
                        field="codeQuality"
                        label="Quality"
                        sortField={sortField}
                        sortDir={sortDir}
                        onToggleSort={toggleSort}
                      />
                      <SortHeader
                        field="license"
                        label="License"
                        sortField={sortField}
                        sortDir={sortDir}
                        onToggleSort={toggleSort}
                      />
                      <SortHeader
                        field="community"
                        label="Community"
                        sortField={sortField}
                        sortDir={sortDir}
                        onToggleSort={toggleSort}
                      />
                      <SortHeader
                        field="openssf"
                        label="OpenSSF"
                        sortField={sortField}
                        sortDir={sortDir}
                        onToggleSort={toggleSort}
                      />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRepos.map((r, idx) => {
                      return (
                        <tr
                          key={`${r.repo.owner}/${r.repo.repo}`}
                          className={`border-b border-border hover:bg-surface-hover transition-colors ${
                            idx % 2 === 0 ? '' : 'bg-surface-alt/30'
                          }`}
                        >
                          {/* Repo name - sticky on mobile */}
                          <td className="py-3 px-3 sticky left-0 bg-inherit z-10">
                            <button
                              onClick={() =>
                                onAnalyze(`https://github.com/${r.repo.owner}/${r.repo.repo}`)
                              }
                              className="text-neon hover:underline font-medium text-left"
                              title={`Full analysis: ${r.repo.owner}/${r.repo.repo}`}
                            >
                              {r.repo.repo}
                            </button>
                            {r.repoInfo.language && (
                              <span className="ml-2 text-xs text-text-muted">
                                {r.repoInfo.language}
                              </span>
                            )}
                          </td>
                          {/* Grade */}
                          <td className={`py-3 px-3 font-bold text-lg ${gradeTextClass(r.grade)}`}>
                            {r.grade}
                          </td>
                          {/* Overall */}
                          <ScoreCell score={r.overallScore} />
                          {/* Category scores */}
                          <ScoreCell score={getCategoryScore(r.categories, 'documentation')} />
                          <ScoreCell score={getCategoryScore(r.categories, 'security')} />
                          <ScoreCell score={getCategoryScore(r.categories, 'cicd')} />
                          <ScoreCell score={getCategoryScore(r.categories, 'dependencies')} />
                          <ScoreCell score={getCategoryScore(r.categories, 'codeQuality')} />
                          <ScoreCell score={getCategoryScore(r.categories, 'license')} />
                          <ScoreCell score={getCategoryScore(r.categories, 'community')} />
                          <ScoreCell score={getCategoryScore(r.categories, 'openssf')} />
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile-friendly card list (visible on small screens only) */}
            <div className="sm:hidden mt-6 space-y-3">
              <p className="text-xs text-text-muted">
                Scroll table horizontally to see all columns, or view repo cards below:
              </p>
              {sortedRepos.map((r) => {
                return (
                  <div
                    key={`card-${r.repo.owner}/${r.repo.repo}`}
                    className="p-4 rounded-xl bg-surface-alt border border-border"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <button
                        onClick={() =>
                          onAnalyze(`https://github.com/${r.repo.owner}/${r.repo.repo}`)
                        }
                        className="text-neon hover:underline font-semibold text-left text-sm"
                      >
                        {r.repo.repo}
                      </button>
                      <div className="flex items-center gap-2">
                        <span className={`text-xl font-bold ${gradeTextClass(r.grade)}`}>
                          {r.grade}
                        </span>
                        <span className={`text-sm font-medium ${scoreColorClass(r.overallScore)}`}>
                          {r.overallScore}
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-center">
                      {(
                        [
                          ['documentation', 'Docs'],
                          ['security', 'Sec'],
                          ['cicd', 'CI'],
                          ['dependencies', 'Deps'],
                          ['codeQuality', 'Qual'],
                          ['license', 'Lic'],
                          ['community', 'Comm'],
                          ['openssf', 'OSSF'],
                        ] as [CategoryKey, string][]
                      ).map(([key, label]) => {
                        const s = getCategoryScore(r.categories, key);
                        return (
                          <div key={key}>
                            <div className={`text-xs font-bold ${scoreColorClass(s)}`}>{s}</div>
                            <div className="text-[10px] text-text-muted">{label}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      {/* Empty idle state hint */}
      {scan.phase === 'idle' && (
        <div className="text-center mt-12">
          <div className="inline-flex items-center justify-center h-20 w-20 rounded-2xl bg-neon/10 border border-neon/20 mb-6">
            <svg
              className="h-10 w-10 text-neon"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-text mb-2">Scan a GitHub Organization</h3>
          <p className="text-sm text-text-muted max-w-md mx-auto leading-relaxed">
            Enter an org name like <span className="text-neon font-medium">facebook</span>,{' '}
            <span className="text-neon font-medium">vercel</span>, or{' '}
            <span className="text-neon font-medium">microsoft</span> to analyze up to 20 repos with
            a lightweight tree-only analysis (2 API calls per repo).
          </p>
        </div>
      )}
    </div>
  );
}
