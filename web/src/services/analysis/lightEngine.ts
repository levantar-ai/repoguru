import type {
  ParsedRepo,
  RepoInfo,
  TreeEntry,
  LightAnalysisReport,
  CategoryResult,
  Signal,
  TechStackItem,
} from '../../types';
import { CATEGORY_WEIGHTS, CATEGORY_LABELS } from '../../utils/constants';
import { scoreToGrade } from '../../utils/formatters';
import { detectProjectTypeLight, naReasonFor } from './projectType';
import { detectCI, detectDeployAutomation } from './detectors/ci';
import { detectCodeOwnership } from './detectors/codeOwnership';
import { detectDependencyUpdates } from './detectors/dependencyUpdates';
import { detectSAST } from './detectors/sast';
import { detectFunding } from './detectors/funding';

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
    treeOnly: true,
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
  const input = { files: [], tree, treePaths };

  signals.push({
    name: 'Security policy',
    found: ciHas(lowerMap, 'SECURITY.md', '.github/SECURITY.md'),
  });

  const owners = detectCodeOwnership(input);
  signals.push({
    name: 'Code ownership',
    found: owners.found,
    details: owners.found ? owners.tools.join(', ') : undefined,
  });

  const depUpdates = detectDependencyUpdates(input);
  signals.push({
    name: 'Automated dependency updates',
    found: depUpdates.found,
    details: depUpdates.found ? depUpdates.tools.join(', ') : undefined,
  });

  // SAST detection in light mode is limited to config-file presence
  // (no workflow-content matching). detectSAST handles that already.
  const sast = detectSAST(input);
  signals.push({
    name: 'Static security analysis',
    found: sast.found,
    details: sast.found ? sast.tools.join(', ') : undefined,
  });

  signals.push({
    name: 'Source-control ignore file',
    found: treePaths.has('.gitignore') || treePaths.has('.hgignore'),
  });

  const suspiciousFiles = tree.some(
    (e) =>
      e.type === 'blob' &&
      (e.path.endsWith('.env') || /credentials/i.test(e.path) || /secret/i.test(e.path)),
  );
  signals.push({ name: 'No exposed secret files', found: !suspiciousFiles });

  const weights: Record<string, number> = {
    'Security policy': 20,
    'Code ownership': 15,
    'Automated dependency updates': 25,
    'Static security analysis': 20,
    'Source-control ignore file': 10,
    'No exposed secret files': 10,
  };
  let score = 0;
  for (const sig of signals) {
    if (sig.found) score += weights[sig.name] ?? 0;
  }

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
  const { type } = detectProjectTypeLight(treePaths, tree);
  const dockerApplicable = type === 'server' || type === 'unknown';
  const input = { files: [], tree, treePaths };

  const ci = detectCI(input);
  signals.push({
    name: 'Continuous integration',
    found: ci.found,
    details: ci.found ? ci.tools.join(', ') : undefined,
  });

  const deploy = detectDeployAutomation(input);
  signals.push({
    name: 'Deployment automation',
    found: deploy.found,
    details: deploy.found ? deploy.tools.join(', ') : undefined,
  });

  // Pre-merge checks needs workflow content to verify; without it we
  // can't honestly score, so skip rather than guess.
  signals.push({
    name: 'Pre-merge checks',
    found: false,
    details: 'Needs file contents — skipped (clone failed)',
  });

  const hasDocker = tree.some(
    (e) => e.type === 'blob' && (e.path === 'Dockerfile' || e.path.endsWith('/Dockerfile')),
  );
  signals.push({
    name: 'Container image build',
    found: hasDocker,
    notApplicable: !dockerApplicable,
    notApplicableReason: dockerApplicable
      ? undefined
      : naReasonFor(type, `containerisation only matters for server apps`),
  });

  const hasCompose = treePaths.has('docker-compose.yml') || treePaths.has('docker-compose.yaml');
  signals.push({
    name: 'Multi-service local dev',
    found: hasCompose,
    notApplicable: !dockerApplicable,
    notApplicableReason: dockerApplicable
      ? undefined
      : naReasonFor(type, `compose orchestrates multi-service local dev`),
  });

  const hasBuildScript =
    treePaths.has('Makefile') ||
    treePaths.has('Taskfile.yml') ||
    treePaths.has('Taskfile.yaml') ||
    treePaths.has('justfile') ||
    treePaths.has('Justfile') ||
    treePaths.has('mage.go');
  signals.push({ name: 'Build / task runner', found: hasBuildScript });

  const weights: Record<string, number> = {
    'Continuous integration': 35,
    'Deployment automation': 20,
    'Pre-merge checks': 20,
    'Container image build': 10,
    'Multi-service local dev': 5,
    'Build / task runner': 10,
  };
  let achieved = 0;
  let applicable = 0;
  for (const sig of signals) {
    if (sig.notApplicable) continue;
    const w = weights[sig.name] ?? 0;
    applicable += w;
    if (sig.found) achieved += w;
  }
  const score = applicable === 0 ? 0 : Math.round((achieved / applicable) * 100);

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
  treePaths: Set<string>,
  tree: TreeEntry[],
  lowerMap: Map<string, string>,
): CategoryResult {
  const signals: Signal[] = [];
  const input = { files: [], tree, treePaths };

  const issueTemplates = tree.filter(
    (e) =>
      e.type === 'blob' &&
      (e.path.toLowerCase().startsWith('.github/issue_template/') ||
        e.path.toLowerCase().startsWith('.gitlab/issue_templates/') ||
        e.path.toLowerCase().startsWith('.gitea/issue_template/')),
  );
  signals.push({
    name: 'Issue templates',
    found: issueTemplates.length > 0,
    details: issueTemplates.length > 0 ? `${issueTemplates.length} template(s)` : undefined,
  });

  const hasMRTemplate = ciHas(
    lowerMap,
    '.github/PULL_REQUEST_TEMPLATE.md',
    'PULL_REQUEST_TEMPLATE.md',
    'docs/PULL_REQUEST_TEMPLATE.md',
    '.gitlab/merge_request_templates/Default.md',
    '.gitea/PULL_REQUEST_TEMPLATE.md',
  );
  signals.push({ name: 'Change-request template', found: hasMRTemplate });

  const hasCOC = ciHas(
    lowerMap,
    'CODE_OF_CONDUCT.md',
    '.github/CODE_OF_CONDUCT.md',
    'docs/CODE_OF_CONDUCT.md',
  );
  signals.push({ name: 'Code of Conduct', found: hasCOC });

  const hasContributing = ciHas(
    lowerMap,
    'CONTRIBUTING.md',
    '.github/CONTRIBUTING.md',
    'docs/CONTRIBUTING.md',
  );
  signals.push({ name: 'Contributing guide', found: hasContributing });

  const funding = detectFunding(input);
  signals.push({
    name: 'Funding info',
    found: funding.found,
    details: funding.found ? funding.tools.join(', ') : undefined,
  });

  const hasSupport = ciHas(lowerMap, '.github/SUPPORT.md', 'SUPPORT.md', 'docs/SUPPORT.md');
  signals.push({ name: 'Support channels', found: hasSupport });

  const weights: Record<string, number> = {
    'Issue templates': 20,
    'Change-request template': 20,
    'Code of Conduct': 20,
    'Contributing guide': 20,
    'Funding info': 10,
    'Support channels': 10,
  };
  let score = 0;
  for (const sig of signals) {
    if (sig.found) score += weights[sig.name] ?? 0;
  }

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
  const input = { files: [], tree, treePaths };

  // GitHub-Actions-specific hardening signals can't be verified without
  // workflow contents. Detect GHA presence; if present, mark these as
  // "skipped" (can't tell); if absent, mark N/A entirely.
  const ci = detectCI(input);
  const usesGHA = ci.tools.includes('GitHub Actions');
  const ghaNAReason = usesGHA
    ? undefined
    : 'These hardening checks apply to GitHub Actions; this repo uses a different CI tool';

  signals.push({
    name: 'Hardened CI permissions',
    found: false,
    details: usesGHA ? 'Needs file contents — skipped (clone failed)' : undefined,
    notApplicable: !usesGHA,
    notApplicableReason: ghaNAReason,
  });
  signals.push({
    name: 'Pinned CI dependencies',
    found: false,
    details: usesGHA ? 'Needs file contents — skipped (clone failed)' : undefined,
    notApplicable: !usesGHA,
    notApplicableReason: ghaNAReason,
  });
  signals.push({
    name: 'No untrusted-PR-checkout patterns',
    found: true,
    details: usesGHA ? 'Couldn’t scan workflows — assumed safe' : undefined,
    notApplicable: !usesGHA,
    notApplicableReason: ghaNAReason,
  });

  const hasBinaryArtifacts = tree.some(
    (e) =>
      e.type === 'blob' &&
      BINARY_EXTENSIONS_LIGHT.has(e.path.slice(e.path.lastIndexOf('.')).toLowerCase()),
  );
  signals.push({ name: 'No binary artifacts in tree', found: !hasBinaryArtifacts });

  // Signed releases — light mode can only spot config-file hints.
  const signedReleaseTools: string[] = [];
  if (
    tree.some(
      (e) =>
        e.type === 'blob' &&
        /(slsa|provenance|scorecard)/i.test(e.path) &&
        e.path.includes('workflows'),
    )
  ) {
    signedReleaseTools.push('SLSA/Scorecard workflow');
  }
  if (treePaths.has('.cosign.yaml') || treePaths.has('cosign.pub')) {
    signedReleaseTools.push('cosign');
  }
  signals.push({
    name: 'Signed releases',
    found: signedReleaseTools.length > 0,
    details: signedReleaseTools.length > 0 ? signedReleaseTools.join(', ') : undefined,
  });

  const fuzzTools: string[] = [];
  if (tree.some((e) => e.path.toLowerCase().includes('oss-fuzz'))) fuzzTools.push('OSS-Fuzz');
  if (
    tree.some((e) => e.type === 'blob' && (e.path.startsWith('fuzz/') || e.path.includes('/fuzz/')))
  ) {
    fuzzTools.push('language-native fuzzing');
  }
  signals.push({
    name: 'Fuzzing',
    found: fuzzTools.length > 0,
    details: fuzzTools.length > 0 ? fuzzTools.join(', ') : undefined,
  });

  signals.push({
    name: 'Software bill of materials',
    found: false,
    details: 'Needs file contents — skipped (clone failed)',
  });

  const depUpdates = detectDependencyUpdates(input);
  signals.push({
    name: 'Automated dependency updates',
    found: depUpdates.found,
    details: depUpdates.found ? depUpdates.tools.join(', ') : undefined,
  });

  signals.push({
    name: 'Security policy',
    found: ciHas(lowerMap, 'SECURITY.md', '.github/SECURITY.md'),
  });

  signals.push({
    name: 'License declared',
    found: ciHas(lowerMap, 'LICENSE', 'LICENSE.md', 'LICENSE.txt', 'LICENCE', 'COPYING'),
  });

  const weights: Record<string, number> = {
    'Hardened CI permissions': 15,
    'Pinned CI dependencies': 15,
    'No untrusted-PR-checkout patterns': 10,
    'No binary artifacts in tree': 10,
    'Signed releases': 10,
    Fuzzing: 10,
    'Software bill of materials': 10,
    'Automated dependency updates': 10,
    'Security policy': 5,
    'License declared': 5,
  };
  let achieved = 0;
  let applicable = 0;
  for (const sig of signals) {
    if (sig.notApplicable) continue;
    const w = weights[sig.name] ?? 0;
    applicable += w;
    if (sig.found) achieved += w;
  }
  const score = applicable === 0 ? 0 : Math.round((achieved / applicable) * 100);

  return {
    key: 'openssf',
    label: CATEGORY_LABELS.openssf,
    score: Math.min(100, score),
    weight: CATEGORY_WEIGHTS.openssf,
    signals,
  };
}
