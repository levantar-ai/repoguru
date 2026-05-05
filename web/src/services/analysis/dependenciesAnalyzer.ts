import type { CategoryResult, FileContent, TreeEntry, Signal, TechStackItem } from '../../types';

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

interface FrameworkDetection {
  keys: string[];
  name: string;
  category: TechStackItem['category'];
}

const FRAMEWORK_DETECTIONS: FrameworkDetection[] = [
  { keys: ['react', 'react-dom'], name: 'React', category: 'framework' },
  { keys: ['vue'], name: 'Vue', category: 'framework' },
  { keys: ['@angular/core'], name: 'Angular', category: 'framework' },
  { keys: ['svelte'], name: 'Svelte', category: 'framework' },
  { keys: ['next'], name: 'Next.js', category: 'framework' },
  { keys: ['express'], name: 'Express', category: 'framework' },
  { keys: ['fastify'], name: 'Fastify', category: 'framework' },
  { keys: ['nestjs', '@nestjs/core'], name: 'NestJS', category: 'framework' },
  { keys: ['typescript'], name: 'TypeScript', category: 'language' },
  { keys: ['tailwindcss'], name: 'Tailwind CSS', category: 'tool' },
  { keys: ['webpack'], name: 'Webpack', category: 'tool' },
  { keys: ['vite'], name: 'Vite', category: 'tool' },
  { keys: ['jest', 'vitest', 'mocha'], name: 'Test Framework', category: 'tool' },
];

interface ManifestDetection {
  files: string[];
  name: string;
  category: TechStackItem['category'];
}

const MANIFEST_DETECTIONS: ManifestDetection[] = [
  { files: ['Cargo.toml'], name: 'Rust', category: 'language' },
  { files: ['go.mod'], name: 'Go', category: 'language' },
  {
    files: ['requirements.txt', 'pyproject.toml', 'Pipfile'],
    name: 'Python',
    category: 'language',
  },
  { files: ['Gemfile'], name: 'Ruby', category: 'language' },
  { files: ['composer.json'], name: 'PHP', category: 'language' },
  {
    files: ['pom.xml', 'build.gradle', 'build.gradle.kts'],
    name: 'Java/JVM',
    category: 'language',
  },
  { files: ['Dockerfile'], name: 'Docker', category: 'platform' },
];

function detectPackageJsonTechStack(
  deps: Record<string, unknown>,
  techStack: TechStackItem[],
): void {
  for (const detection of FRAMEWORK_DETECTIONS) {
    if (detection.keys.some((key) => key in deps)) {
      techStack.push({ name: detection.name, category: detection.category });
    }
  }
}

function parsePackageJson(pkg: FileContent, techStack: TechStackItem[]): number {
  try {
    const parsed = JSON.parse(pkg.content);
    const deps = { ...parsed.dependencies, ...parsed.devDependencies };
    const depCount = Object.keys(deps).length;
    detectPackageJsonTechStack(deps, techStack);
    return depCount;
  } catch {
    return 0;
  }
}

function detectManifestTechStack(treePaths: Set<string>, techStack: TechStackItem[]): void {
  for (const detection of MANIFEST_DETECTIONS) {
    if (detection.files.some((f) => treePaths.has(f))) {
      techStack.push({ name: detection.name, category: detection.category });
    }
  }

  if (treePaths.has('tsconfig.json') && !techStack.some((t) => t.name === 'TypeScript')) {
    techStack.push({ name: 'TypeScript', category: 'language' });
  }
}

function computeScore(
  manifests: string[],
  lockfiles: string[],
  depCount: number,
  reasonable: boolean,
  techStack: TechStackItem[],
): number {
  let score = 0;
  if (manifests.length > 0) score += 30;
  if (lockfiles.length > 0) score += 25;
  if (depCount > 0) score += 20;
  if (reasonable) score += 15;
  if (techStack.length > 0) score += 10;
  return Math.min(100, score);
}

export function analyzeDependencies(
  files: FileContent[],
  tree: TreeEntry[],
): { result: CategoryResult; techStack: TechStackItem[] } {
  const signals: Signal[] = [];
  const fileMap = new Map(files.map((f) => [f.path, f]));
  const treePaths = new Set(tree.map((e) => e.path));
  const techStack: TechStackItem[] = [];

  // Has manifest file
  const manifests = MANIFEST_FILES.filter((m) => fileMap.has(m) || treePaths.has(m));
  signals.push({
    name: 'Dependency manifest',
    found: manifests.length > 0,
    details: manifests.join(', '),
  });

  // Has lockfile
  const lockfiles = LOCKFILES.filter((l) => treePaths.has(l));
  signals.push({
    name: 'Lockfile present',
    found: lockfiles.length > 0,
    details: lockfiles.join(', '),
  });

  // Detect tech stack from package.json
  const pkg = fileMap.get('package.json');
  const depCount = pkg ? parsePackageJson(pkg, techStack) : 0;

  // Detect from other manifests
  detectManifestTechStack(treePaths, techStack);

  signals.push({
    name: 'Dependencies tracked',
    found: depCount > 0,
    details: depCount > 0 ? `${depCount} dependencies` : undefined,
  });

  // Reasonable dependency count (not bloated)
  const reasonable = depCount < 200;
  signals.push({
    name: 'Reasonable dependency count',
    found: reasonable,
    details: depCount > 0 ? `${depCount} total` : undefined,
  });

  const score = computeScore(manifests, lockfiles, depCount, reasonable, techStack);

  return {
    result: {
      key: 'dependencies',
      label: 'Dependencies',
      score,
      weight: 0.15,
      signals,
    },
    techStack,
  };
}
