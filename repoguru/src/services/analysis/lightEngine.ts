import type {
  ParsedRepo,
  RepoInfo,
  TreeEntry,
  LightAnalysisReport,
  CategoryResult,
  Signal,
  TechStackItem,
} from '../../types';
import {
  CATEGORY_WEIGHTS,
  CATEGORY_LABELS,
  WORKFLOW_DIR,
  ISSUE_TEMPLATE_DIR,
  PR_TEMPLATE,
  PR_TEMPLATE_ALT,
} from '../../utils/constants';
import { scoreToGrade } from '../../utils/formatters';

/** Case-insensitive path lookup: checks if any of the candidates exist in the tree (case-insensitive). */
function ciHas(lowerToOriginal: Map<string, string>, ...candidates: string[]): boolean {
  return candidates.some((c) => lowerToOriginal.has(c.toLowerCase()));
}

/** Returns non-standard casing note if the file exists but not in canonical form. */
function casingNote(lowerToOriginal: Map<string, string>, canonical: string): string | undefined {
  const actual = lowerToOriginal.get(canonical.toLowerCase());
  if (!actual || actual === canonical) return undefined;
  return `Found as "${actual}" — standard convention is "${canonical}"`;
}

/**
 * Light analysis mode — runs analysis using only the tree (no file content).
 * Uses just 2 API calls per repo: repo info + tree.
 */
export function runLightAnalysis(
  parsedRepo: ParsedRepo,
  repoInfo: RepoInfo,
  tree: TreeEntry[],
): LightAnalysisReport {
  const treePaths = new Set(tree.map((e) => e.path));
  const treeDirs = new Set(tree.filter((e) => e.type === 'tree').map((e) => e.path));
  // Lowercase→original path map for case-insensitive lookups
  const lowerToOriginal = new Map<string, string>();
  for (const e of tree) {
    const lower = e.path.toLowerCase();
    // Keep first occurrence (prefer exact casing from GitHub)
    if (!lowerToOriginal.has(lower)) lowerToOriginal.set(lower, e.path);
  }

  const documentation = analyzeDocumentationLight(treePaths, treeDirs, lowerToOriginal);
  const security = analyzeSecurityLight(treePaths, tree, lowerToOriginal);
  const cicd = analyzeCicdLight(treePaths, tree);
  const dependencies = analyzeDependenciesLight(treePaths);
  const codeQuality = analyzeCodeQualityLight(treePaths, tree, treeDirs);
  const license = analyzeLicenseLight(treePaths, repoInfo, lowerToOriginal);
  const community = analyzeCommunityLight(treePaths, tree, lowerToOriginal);
  const openssf = analyzeOpenssfLight(treePaths, tree, lowerToOriginal);

  const categories = [
    documentation,
    security,
    cicd,
    dependencies.result,
    codeQuality,
    license,
    community,
    openssf,
  ];

  // Compute overall score
  let totalWeight = 0;
  let weightedSum = 0;
  for (const cat of categories) {
    weightedSum += cat.score * cat.weight;
    totalWeight += cat.weight;
  }
  const overallScore = totalWeight === 0 ? 0 : Math.round(weightedSum / totalWeight);
  const grade = scoreToGrade(overallScore);

  // Add language from repoInfo if not already in techStack
  const techStack = [...dependencies.techStack];
  if (
    repoInfo.language &&
    !techStack.some((t) => t.name.toLowerCase() === repoInfo.language!.toLowerCase())
  ) {
    techStack.unshift({ name: repoInfo.language, category: 'language' });
  }

  return {
    repo: parsedRepo,
    repoInfo,
    grade,
    overallScore,
    categories,
    techStack,
    treeEntryCount: tree.length,
    analyzedAt: new Date().toISOString(),
  };
}

// ── Documentation (tree-only) ──

function analyzeDocumentationLight(
  _treePaths: Set<string>,
  treeDirs: Set<string>,
  lowerMap: Map<string, string>,
): CategoryResult {
  const signals: Signal[] = [];

  const hasReadme = ciHas(lowerMap, 'README.md', 'readme.md', 'README.rst');
  const readmeCasing = hasReadme
    ? (casingNote(lowerMap, 'README.md') ?? casingNote(lowerMap, 'README.rst'))
    : undefined;
  signals.push({ name: 'README exists', found: hasReadme, details: readmeCasing || undefined });

  const hasContributing = ciHas(lowerMap, 'CONTRIBUTING.md');
  const contributingCasing = hasContributing ? casingNote(lowerMap, 'CONTRIBUTING.md') : undefined;
  signals.push({
    name: 'CONTRIBUTING.md',
    found: hasContributing,
    details: contributingCasing || undefined,
  });

  const hasChangelog = ciHas(lowerMap, 'CHANGELOG.md', 'CHANGES.md', 'HISTORY.md');
  const changelogCasing = hasChangelog
    ? (casingNote(lowerMap, 'CHANGELOG.md') ??
      casingNote(lowerMap, 'CHANGES.md') ??
      casingNote(lowerMap, 'HISTORY.md'))
    : undefined;
  signals.push({ name: 'CHANGELOG', found: hasChangelog, details: changelogCasing || undefined });

  const lowerDirs = new Set([...treeDirs].map((d) => d.toLowerCase()));
  const hasDocs = lowerDirs.has('docs') || lowerDirs.has('doc');
  signals.push({ name: 'docs/ directory', found: hasDocs });

  let score = 0;
  if (hasReadme) score += 35;
  if (hasContributing) score += 20;
  if (hasChangelog) score += 20;
  if (hasDocs) score += 25;

  return {
    key: 'documentation',
    label: CATEGORY_LABELS.documentation,
    score: Math.min(100, score),
    weight: CATEGORY_WEIGHTS.documentation,
    signals,
  };
}

// ── Security (tree-only) ──

function analyzeSecurityLight(
  treePaths: Set<string>,
  tree: TreeEntry[],
  lowerMap: Map<string, string>,
): CategoryResult {
  const signals: Signal[] = [];

  const hasSecurity = ciHas(lowerMap, 'SECURITY.md');
  const securityCasing = hasSecurity ? casingNote(lowerMap, 'SECURITY.md') : undefined;
  signals.push({ name: 'SECURITY.md', found: hasSecurity, details: securityCasing || undefined });

  const hasCodeowners = ciHas(lowerMap, 'CODEOWNERS', '.github/CODEOWNERS');
  signals.push({ name: 'CODEOWNERS', found: hasCodeowners });

  const hasDependabot =
    treePaths.has('.github/dependabot.yml') || treePaths.has('.github/dependabot.yaml');
  signals.push({ name: 'Dependabot configured', found: hasDependabot });

  const hasCodeQL = tree.some(
    (e) =>
      e.type === 'blob' &&
      e.path.startsWith(WORKFLOW_DIR) &&
      e.path.toLowerCase().includes('codeql'),
  );
  signals.push({ name: 'CodeQL / security scanning', found: hasCodeQL });

  const hasGitignore = treePaths.has('.gitignore');
  signals.push({ name: '.gitignore present', found: hasGitignore });

  const suspiciousFiles = tree.some(
    (e) =>
      e.type === 'blob' &&
      (e.path.endsWith('.env') || /credentials/i.test(e.path) || /secret/i.test(e.path)),
  );
  signals.push({ name: 'No exposed secret files', found: !suspiciousFiles });

  let score = 0;
  if (hasSecurity) score += 20;
  if (hasCodeowners) score += 15;
  if (hasDependabot) score += 20;
  if (hasCodeQL) score += 15;
  if (hasGitignore) score += 15;
  if (!suspiciousFiles) score += 15;

  return {
    key: 'security',
    label: CATEGORY_LABELS.security,
    score: Math.min(100, score),
    weight: CATEGORY_WEIGHTS.security,
    signals,
  };
}

// ── CI/CD (tree-only) ──

function analyzeCicdLight(treePaths: Set<string>, tree: TreeEntry[]): CategoryResult {
  const signals: Signal[] = [];

  const workflowFiles = tree.filter((e) => e.type === 'blob' && e.path.startsWith(WORKFLOW_DIR));
  signals.push({
    name: 'GitHub Actions workflows',
    found: workflowFiles.length > 0,
    details: `${workflowFiles.length} workflow file(s)`,
  });

  const hasDocker = tree.some(
    (e) => e.type === 'blob' && (e.path === 'Dockerfile' || e.path.endsWith('/Dockerfile')),
  );
  signals.push({ name: 'Dockerfile', found: hasDocker });

  const hasCompose = treePaths.has('docker-compose.yml') || treePaths.has('docker-compose.yaml');
  signals.push({ name: 'Docker Compose', found: hasCompose });

  const hasMakefile = treePaths.has('Makefile');
  signals.push({ name: 'Makefile', found: hasMakefile });

  // In light mode we can't inspect file content, so we check for CI-like filenames
  const hasCiFile = workflowFiles.some(
    (e) =>
      e.path.toLowerCase().includes('ci') ||
      e.path.toLowerCase().includes('test') ||
      e.path.toLowerCase().includes('build'),
  );
  signals.push({ name: 'CI workflow (test/build)', found: hasCiFile });

  const hasDeployFile = workflowFiles.some(
    (e) => e.path.toLowerCase().includes('deploy') || e.path.toLowerCase().includes('release'),
  );
  signals.push({ name: 'Deploy / release workflow', found: hasDeployFile });

  let score = 0;
  if (workflowFiles.length > 0) score += 25;
  if (hasCiFile) score += 25;
  if (hasDeployFile) score += 15;
  if (hasDocker) score += 15;
  if (hasCompose) score += 10;
  if (hasMakefile) score += 10;

  return {
    key: 'cicd',
    label: CATEGORY_LABELS.cicd,
    score: Math.min(100, score),
    weight: CATEGORY_WEIGHTS.cicd,
    signals,
  };
}

// ── Dependencies (tree-only) ──

const MANIFEST_FILES = [
  'package.json',
  'Cargo.toml',
  'go.mod',
  'requirements.txt',
  'Pipfile',
  'pyproject.toml',
  'setup.py',
  'setup.cfg',
  'Gemfile',
  'composer.json',
  'pom.xml',
  'build.gradle',
  'build.gradle.kts',
];

const LOCKFILES = [
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'Cargo.lock',
  'go.sum',
  'Gemfile.lock',
];

function analyzeDependenciesLight(treePaths: Set<string>): {
  result: CategoryResult;
  techStack: TechStackItem[];
} {
  const signals: Signal[] = [];
  const techStack: TechStackItem[] = [];

  const manifests = MANIFEST_FILES.filter((m) => treePaths.has(m));
  signals.push({
    name: 'Dependency manifest',
    found: manifests.length > 0,
    details: manifests.join(', '),
  });

  const lockfiles = LOCKFILES.filter((l) => treePaths.has(l));
  signals.push({
    name: 'Lockfile present',
    found: lockfiles.length > 0,
    details: lockfiles.join(', '),
  });

  // Detect tech stack from manifest presence
  if (treePaths.has('package.json')) techStack.push({ name: 'Node.js', category: 'platform' });
  if (treePaths.has('Cargo.toml')) techStack.push({ name: 'Rust', category: 'language' });
  if (treePaths.has('go.mod')) techStack.push({ name: 'Go', category: 'language' });
  if (
    treePaths.has('requirements.txt') ||
    treePaths.has('pyproject.toml') ||
    treePaths.has('Pipfile')
  ) {
    techStack.push({ name: 'Python', category: 'language' });
  }
  if (treePaths.has('Gemfile')) techStack.push({ name: 'Ruby', category: 'language' });
  if (treePaths.has('composer.json')) techStack.push({ name: 'PHP', category: 'language' });
  if (
    treePaths.has('pom.xml') ||
    treePaths.has('build.gradle') ||
    treePaths.has('build.gradle.kts')
  ) {
    techStack.push({ name: 'Java/JVM', category: 'language' });
  }
  if (treePaths.has('Dockerfile')) techStack.push({ name: 'Docker', category: 'platform' });
  if (treePaths.has('tsconfig.json')) techStack.push({ name: 'TypeScript', category: 'language' });

  let score = 0;
  if (manifests.length > 0) score += 40;
  if (lockfiles.length > 0) score += 35;
  if (techStack.length > 0) score += 25;

  return {
    result: {
      key: 'dependencies',
      label: CATEGORY_LABELS.dependencies,
      score: Math.min(100, score),
      weight: CATEGORY_WEIGHTS.dependencies,
      signals,
    },
    techStack,
  };
}

// ── Code Quality (tree-only) ──

const LINTER_FILES = [
  '.eslintrc.json',
  '.eslintrc.js',
  '.eslintrc.yml',
  '.eslintrc',
  'eslint.config.js',
  'eslint.config.mjs',
  '.flake8',
  '.pylintrc',
  'clippy.toml',
  '.rubocop.yml',
  '.golangci.yml',
  'biome.json',
  'deno.json',
];

const FORMATTER_FILES = [
  '.prettierrc',
  '.prettierrc.json',
  '.prettierrc.js',
  'prettier.config.js',
  '.prettierrc.yaml',
  'rustfmt.toml',
  '.clang-format',
  'biome.json',
  '.editorconfig',
];

const TEST_DIR_NAMES = ['test', 'tests', '__tests__', 'spec', 'src/test', 'src/__tests__'];

const TEST_FILE_PATTERNS = [
  /\.test\.[jt]sx?$/,
  /\.spec\.[jt]sx?$/,
  /_test\.go$/,
  /_test\.rs$/,
  /test_.*\.py$/,
  /_spec\.rb$/,
];

function analyzeCodeQualityLight(
  treePaths: Set<string>,
  tree: TreeEntry[],
  treeDirs: Set<string>,
): CategoryResult {
  const signals: Signal[] = [];

  const hasLinter = LINTER_FILES.some((f) => treePaths.has(f));
  signals.push({ name: 'Linter configured', found: hasLinter });

  const hasFormatter = FORMATTER_FILES.some((f) => treePaths.has(f));
  signals.push({ name: 'Formatter configured', found: hasFormatter });

  const hasTypeScript = treePaths.has('tsconfig.json');
  signals.push({
    name: 'Type system',
    found: hasTypeScript,
    details: hasTypeScript ? 'TypeScript' : undefined,
  });

  const hasHooks =
    treePaths.has('.husky/pre-commit') ||
    treePaths.has('.husky') ||
    treePaths.has('.pre-commit-config.yaml') ||
    treePaths.has('.lefthook.yml') ||
    treePaths.has('lefthook.yml');
  signals.push({ name: 'Git hooks', found: hasHooks });

  const testDirs = TEST_DIR_NAMES.filter((d) => treeDirs.has(d));
  const testFileCount = tree.filter(
    (e) => e.type === 'blob' && TEST_FILE_PATTERNS.some((r) => r.test(e.path)),
  ).length;
  const hasTests = testDirs.length > 0 || testFileCount > 0;
  signals.push({
    name: 'Tests present',
    found: hasTests,
    details: (() => {
      if (testFileCount > 0) return `${testFileCount} test files`;
      if (testDirs.length > 0) return testDirs.join(', ');
      return undefined;
    })(),
  });

  const hasEditorConfig = treePaths.has('.editorconfig');
  signals.push({ name: 'EditorConfig', found: hasEditorConfig });

  let score = 0;
  if (hasLinter) score += 20;
  if (hasFormatter) score += 15;
  if (hasTypeScript) score += 15;
  if (hasHooks) score += 15;
  if (hasTests) score += 25;
  if (hasEditorConfig) score += 10;

  return {
    key: 'codeQuality',
    label: CATEGORY_LABELS.codeQuality,
    score: Math.min(100, score),
    weight: CATEGORY_WEIGHTS.codeQuality,
    signals,
  };
}

// ── License (tree-only) ──

const PERMISSIVE_LICENSES = new Set([
  'MIT',
  'Apache-2.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'ISC',
  'Unlicense',
  'CC0-1.0',
]);
const COPYLEFT_LICENSES = ['GPL-2.0', 'GPL-3.0', 'AGPL-3.0', 'LGPL-2.1', 'LGPL-3.0', 'MPL-2.0'];

function analyzeLicenseLight(
  _treePaths: Set<string>,
  repoInfo: RepoInfo,
  lowerMap: Map<string, string>,
): CategoryResult {
  const signals: Signal[] = [];

  const hasLicenseFile = ciHas(
    lowerMap,
    'LICENSE',
    'LICENSE.md',
    'LICENSE.txt',
    'COPYING',
    'LICENCE',
  );
  signals.push({ name: 'License file exists', found: hasLicenseFile });

  const spdxId = repoInfo.license;
  const hasDetected = !!spdxId && spdxId !== 'NOASSERTION';
  signals.push({ name: 'SPDX license detected', found: hasDetected, details: spdxId || undefined });

  const isPermissive = !!spdxId && PERMISSIVE_LICENSES.has(spdxId);
  signals.push({
    name: 'Permissive license',
    found: isPermissive,
    details: isPermissive ? spdxId : undefined,
  });

  const isCopyleft = !!spdxId && COPYLEFT_LICENSES.includes(spdxId);
  signals.push({
    name: 'Copyleft license',
    found: isCopyleft,
    details: isCopyleft ? spdxId : undefined,
  });

  let score = 0;
  if (hasLicenseFile) score += 40;
  if (hasDetected) score += 30;
  if (isPermissive) score += 30;
  else if (isCopyleft) score += 20;
  else if (hasDetected) score += 10;

  return {
    key: 'license',
    label: CATEGORY_LABELS.license,
    score: Math.min(100, score),
    weight: CATEGORY_WEIGHTS.license,
    signals,
  };
}

// ── Community (tree-only) ──

function analyzeCommunityLight(
  _treePaths: Set<string>,
  tree: TreeEntry[],
  lowerMap: Map<string, string>,
): CategoryResult {
  const signals: Signal[] = [];

  const issueTemplateDirLower = ISSUE_TEMPLATE_DIR.toLowerCase();
  const issueTemplates = tree.filter(
    (e) => e.type === 'blob' && e.path.toLowerCase().startsWith(issueTemplateDirLower),
  );
  signals.push({
    name: 'Issue templates',
    found: issueTemplates.length > 0,
    details: `${issueTemplates.length} template(s)`,
  });

  const hasPRTemplate = ciHas(lowerMap, PR_TEMPLATE, PR_TEMPLATE_ALT, 'PULL_REQUEST_TEMPLATE.md');
  signals.push({ name: 'PR template', found: hasPRTemplate });

  const hasCOC = ciHas(lowerMap, 'CODE_OF_CONDUCT.md', '.github/CODE_OF_CONDUCT.md');
  signals.push({ name: 'Code of Conduct', found: hasCOC });

  const hasContributing = ciHas(lowerMap, 'CONTRIBUTING.md');
  signals.push({ name: 'CONTRIBUTING.md', found: hasContributing });

  const hasFunding = ciHas(lowerMap, '.github/FUNDING.yml');
  signals.push({ name: 'Funding configuration', found: hasFunding });

  const hasSupport = ciHas(lowerMap, '.github/SUPPORT.md', 'SUPPORT.md');
  signals.push({ name: 'SUPPORT.md', found: hasSupport });

  let score = 0;
  if (issueTemplates.length > 0) score += 20;
  if (hasPRTemplate) score += 20;
  if (hasCOC) score += 20;
  if (hasContributing) score += 20;
  if (hasFunding) score += 10;
  if (hasSupport) score += 10;

  return {
    key: 'community',
    label: CATEGORY_LABELS.community,
    score: Math.min(100, score),
    weight: CATEGORY_WEIGHTS.community,
    signals,
  };
}

// ── OpenSSF (tree-only) ──

const BINARY_EXTENSIONS_LIGHT = new Set(['.exe', '.dll', '.jar', '.so', '.class', '.pyc']);

function analyzeOpenssfLight(
  treePaths: Set<string>,
  tree: TreeEntry[],
  lowerMap: Map<string, string>,
): CategoryResult {
  const signals: Signal[] = [];

  // Token permissions — cannot detect without file content in light mode
  signals.push({
    name: 'Token permissions',
    found: false,
    details: 'Requires file content (full analysis)',
  });

  // Pinned dependencies — cannot detect without file content in light mode
  signals.push({
    name: 'Pinned dependencies',
    found: false,
    details: 'Requires file content (full analysis)',
  });

  // Dangerous workflow patterns — cannot detect without file content
  signals.push({
    name: 'No dangerous workflow patterns',
    found: true,
    details: 'Cannot verify without file content; assumed safe',
  });

  // No binary artifacts — CAN detect from tree
  const hasBinaryArtifacts = tree.some(
    (e) =>
      e.type === 'blob' &&
      BINARY_EXTENSIONS_LIGHT.has(e.path.slice(e.path.lastIndexOf('.')).toLowerCase()),
  );
  signals.push({ name: 'No binary artifacts', found: !hasBinaryArtifacts });

  // SLSA / signed releases — check workflow filenames for scorecard/slsa patterns
  const hasSlsaWorkflow = tree.some(
    (e) =>
      e.type === 'blob' &&
      e.path.startsWith(WORKFLOW_DIR) &&
      (e.path.toLowerCase().includes('slsa') ||
        e.path.toLowerCase().includes('provenance') ||
        e.path.toLowerCase().includes('scorecard')),
  );
  signals.push({ name: 'SLSA / signed releases', found: hasSlsaWorkflow });

  // Fuzzing — detect fuzz dirs/files from tree
  const hasFuzzing = tree.some(
    (e) => e.path.toLowerCase().includes('fuzz') || e.path.toLowerCase().includes('oss-fuzz'),
  );
  signals.push({ name: 'Fuzzing', found: hasFuzzing });

  // SBOM generation — cannot fully detect without content
  signals.push({
    name: 'SBOM generation',
    found: false,
    details: 'Requires file content (full analysis)',
  });

  // Dependency update tool — Dependabot or Renovate config
  const hasDependabot =
    treePaths.has('.github/dependabot.yml') || treePaths.has('.github/dependabot.yaml');
  const hasRenovate =
    treePaths.has('.renovaterc') ||
    treePaths.has('.renovaterc.json') ||
    treePaths.has('renovate.json');
  const hasDepUpdateTool = hasDependabot || hasRenovate;
  signals.push({
    name: 'Dependency update tool',
    found: hasDepUpdateTool,
    details: hasDependabot ? 'Dependabot' : hasRenovate ? 'Renovate' : undefined,
  });

  // Security policy
  const hasSecurityPolicy = ciHas(lowerMap, 'SECURITY.md');
  signals.push({ name: 'Security policy', found: hasSecurityPolicy });

  // License detected
  const hasLicense = ciHas(lowerMap, 'LICENSE', 'LICENSE.md', 'LICENSE.txt', 'LICENCE', 'COPYING');
  signals.push({ name: 'License detected', found: hasLicense });

  // Scoring — only count what we can actually detect
  let score = 0;
  // Token permissions: 0 (can't detect)
  // Pinned deps: 0 (can't detect)
  score += 10; // No dangerous patterns assumed safe in light mode
  if (!hasBinaryArtifacts) score += 10; // No binary artifacts
  if (hasSlsaWorkflow) score += 10;
  if (hasFuzzing) score += 10;
  // SBOM: 0 (can't detect)
  if (hasDepUpdateTool) score += 10;
  if (hasSecurityPolicy) score += 5;
  if (hasLicense) score += 5;

  return {
    key: 'openssf',
    label: CATEGORY_LABELS.openssf,
    score: Math.min(100, score),
    weight: CATEGORY_WEIGHTS.openssf,
    signals,
  };
}
