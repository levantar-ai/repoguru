import { describe, it, expect } from 'vitest';
import { runLightAnalysis } from '../lightEngine';
import type { ParsedRepo, RepoInfo, TreeEntry } from '../../../types';

// ── Helpers ──

function blob(path: string): TreeEntry {
  return { path, mode: '100644', type: 'blob', sha: 'abc' };
}

function tree(path: string): TreeEntry {
  return { path, mode: '040000', type: 'tree', sha: 'abc' };
}

function makeRepoInfo(overrides: Partial<RepoInfo> = {}): RepoInfo {
  return {
    owner: 'test-owner',
    repo: 'test-repo',
    defaultBranch: 'main',
    description: 'A test repository',
    stars: 100,
    forks: 10,
    openIssues: 5,
    license: null,
    language: null,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-06-01T00:00:00Z',
    topics: [],
    archived: false,
    size: 1000,
    ...overrides,
  };
}

const defaultParsedRepo: ParsedRepo = { owner: 'test-owner', repo: 'test-repo' };

function findCategory(report: ReturnType<typeof runLightAnalysis>, key: string) {
  return report.categories.find((c) => c.key === key)!;
}

function findSignal(report: ReturnType<typeof runLightAnalysis>, catKey: string, sigName: string) {
  const cat = findCategory(report, catKey);
  return cat.signals.find((s) => s.name === sigName)!;
}

// ── Tests ──

describe('runLightAnalysis', () => {
  // ── 1. Overall structure ──

  describe('overall structure', () => {
    it('returns correct shape with all required fields', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), []);
      expect(report).toHaveProperty('repo');
      expect(report).toHaveProperty('repoInfo');
      expect(report).toHaveProperty('grade');
      expect(report).toHaveProperty('overallScore');
      expect(report).toHaveProperty('categories');
      expect(report).toHaveProperty('techStack');
      expect(report).toHaveProperty('treeEntryCount');
      expect(report).toHaveProperty('analyzedAt');
    });

    it('returns the passed parsedRepo and repoInfo directly', () => {
      const parsed: ParsedRepo = { owner: 'foo', repo: 'bar', branch: 'dev' };
      const info = makeRepoInfo({ owner: 'foo', repo: 'bar' });
      const report = runLightAnalysis(parsed, info, []);
      expect(report.repo).toBe(parsed);
      expect(report.repoInfo).toBe(info);
    });

    it('has exactly 8 category results', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), []);
      expect(report.categories).toHaveLength(8);
      const keys = report.categories.map((c) => c.key);
      expect(keys).toEqual([
        'documentation',
        'security',
        'cicd',
        'dependencies',
        'codeQuality',
        'license',
        'community',
        'openssf',
      ]);
    });

    it('computes overall score as weighted average of category scores', () => {
      // On empty tree:
      // security scores 15 ("No exposed secret files" is found=true), weight=0.1
      // openssf scores 20 (no dangerous patterns + no binary artifacts), weight=0.1
      // Weighted: 15 * 0.1 + 20 * 0.1 = 3.5, total weight = 1.0 => round(3.5) = 4
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), []);
      expect(report.overallScore).toBe(4);
    });

    it('assigns grade F for score 0', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), []);
      expect(report.grade).toBe('F');
    });

    it('assigns grade A for a well-equipped repo', () => {
      const entries: TreeEntry[] = [
        // Documentation
        blob('README.md'),
        blob('CONTRIBUTING.md'),
        blob('CHANGELOG.md'),
        tree('docs'),
        // Security
        blob('SECURITY.md'),
        blob('.github/CODEOWNERS'),
        blob('.github/dependabot.yml'),
        blob('.github/workflows/codeql.yml'),
        blob('.gitignore'),
        // CI/CD
        blob('.github/workflows/ci.yml'),
        blob('.github/workflows/deploy.yml'),
        blob('Dockerfile'),
        blob('docker-compose.yml'),
        blob('Makefile'),
        // Dependencies
        blob('package.json'),
        blob('package-lock.json'),
        blob('tsconfig.json'),
        // Code Quality
        blob('.eslintrc.json'),
        blob('.prettierrc'),
        blob('.husky/pre-commit'),
        blob('src/App.test.tsx'),
        blob('.editorconfig'),
        // License
        blob('LICENSE'),
        // Community
        blob('.github/ISSUE_TEMPLATE/bug.md'),
        blob('.github/PULL_REQUEST_TEMPLATE.md'),
        blob('CODE_OF_CONDUCT.md'),
        blob('.github/FUNDING.yml'),
        blob('.github/SUPPORT.md'),
        blob('SUPPORT.md'),
        // Tree entries for directories
        tree('.github'),
        tree('.github/workflows'),
        tree('.github/ISSUE_TEMPLATE'),
        tree('.husky'),
        tree('src'),
      ];
      const report = runLightAnalysis(
        defaultParsedRepo,
        makeRepoInfo({ license: 'MIT', language: 'TypeScript' }),
        entries,
      );
      expect(report.overallScore).toBeGreaterThanOrEqual(85);
      expect(report.grade).toBe('A');
    });

    it('records treeEntryCount correctly', () => {
      const entries = [blob('README.md'), tree('src'), blob('src/index.ts')];
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), entries);
      expect(report.treeEntryCount).toBe(3);
    });

    it('sets analyzedAt to a valid ISO date', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), []);
      expect(() => new Date(report.analyzedAt)).not.toThrow();
      expect(new Date(report.analyzedAt).toISOString()).toBe(report.analyzedAt);
    });

    it('computes correct weighted average with mixed scores', () => {
      // Give documentation a high score (README = 35) and everything else 0
      const entries: TreeEntry[] = [blob('README.md')];
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), entries);
      // documentation score = 35, weight = 0.15
      // security: no suspicious => score = 15, weight = 0.1
      // openssf: no binary + no dangerous = 20, weight = 0.1
      // All others = 0
      // Expected: Math.round((35*0.15 + 15*0.1 + 20*0.1) / 1.0) = Math.round(5.25 + 1.5 + 2.0) = Math.round(8.75) = 9
      expect(report.overallScore).toBe(9);
    });
  });

  // ── 2. Documentation light ──

  describe('documentation', () => {
    it('detects README.md', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [blob('README.md')]);
      const sig = findSignal(report, 'documentation', 'README exists');
      expect(sig.found).toBe(true);
    });

    it('detects README.rst', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [blob('README.rst')]);
      const sig = findSignal(report, 'documentation', 'README exists');
      expect(sig.found).toBe(true);
    });

    it('detects readme.md case-insensitively', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [blob('readme.md')]);
      const sig = findSignal(report, 'documentation', 'README exists');
      expect(sig.found).toBe(true);
    });

    it('detects CONTRIBUTING.md', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [blob('CONTRIBUTING.md')]);
      const sig = findSignal(report, 'documentation', 'CONTRIBUTING.md');
      expect(sig.found).toBe(true);
    });

    it('detects CHANGELOG.md', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [blob('CHANGELOG.md')]);
      const sig = findSignal(report, 'documentation', 'CHANGELOG');
      expect(sig.found).toBe(true);
    });

    it('detects CHANGES.md as a changelog variant', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [blob('CHANGES.md')]);
      const sig = findSignal(report, 'documentation', 'CHANGELOG');
      expect(sig.found).toBe(true);
    });

    it('detects HISTORY.md as a changelog variant', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [blob('HISTORY.md')]);
      const sig = findSignal(report, 'documentation', 'CHANGELOG');
      expect(sig.found).toBe(true);
    });

    it('detects docs/ directory', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [tree('docs')]);
      const sig = findSignal(report, 'documentation', 'docs/ directory');
      expect(sig.found).toBe(true);
    });

    it('detects doc/ directory as alternative to docs/', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [tree('doc')]);
      const sig = findSignal(report, 'documentation', 'docs/ directory');
      expect(sig.found).toBe(true);
    });

    it('scores 100 when all documentation signals are present', () => {
      const entries = [
        blob('README.md'),
        blob('CONTRIBUTING.md'),
        blob('CHANGELOG.md'),
        tree('docs'),
      ];
      const cat = findCategory(
        runLightAnalysis(defaultParsedRepo, makeRepoInfo(), entries),
        'documentation',
      );
      expect(cat.score).toBe(100);
    });

    it('scores 0 when nothing is present', () => {
      const cat = findCategory(
        runLightAnalysis(defaultParsedRepo, makeRepoInfo(), []),
        'documentation',
      );
      expect(cat.score).toBe(0);
    });

    it('produces casing note for readme.MD (non-canonical)', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [blob('readme.MD')]);
      const sig = findSignal(report, 'documentation', 'README exists');
      expect(sig.found).toBe(true);
      expect(sig.details).toContain('readme.MD');
      expect(sig.details).toContain('README.md');
    });
  });

  // ── 3. Security light ──

  describe('security', () => {
    it('detects SECURITY.md', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [blob('SECURITY.md')]);
      const sig = findSignal(report, 'security', 'SECURITY.md');
      expect(sig.found).toBe(true);
    });

    it('detects CODEOWNERS at root', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [blob('CODEOWNERS')]);
      const sig = findSignal(report, 'security', 'CODEOWNERS');
      expect(sig.found).toBe(true);
    });

    it('detects .github/CODEOWNERS', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [
        blob('.github/CODEOWNERS'),
      ]);
      const sig = findSignal(report, 'security', 'CODEOWNERS');
      expect(sig.found).toBe(true);
    });

    it('detects dependabot.yml', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [
        blob('.github/dependabot.yml'),
      ]);
      const sig = findSignal(report, 'security', 'Dependabot configured');
      expect(sig.found).toBe(true);
    });

    it('detects dependabot.yaml', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [
        blob('.github/dependabot.yaml'),
      ]);
      const sig = findSignal(report, 'security', 'Dependabot configured');
      expect(sig.found).toBe(true);
    });

    it('detects CodeQL workflow', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [
        blob('.github/workflows/codeql-analysis.yml'),
      ]);
      const sig = findSignal(report, 'security', 'CodeQL / security scanning');
      expect(sig.found).toBe(true);
    });

    it('detects .gitignore', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [blob('.gitignore')]);
      const sig = findSignal(report, 'security', '.gitignore present');
      expect(sig.found).toBe(true);
    });

    it('flags .env as suspicious file', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [blob('.env')]);
      const sig = findSignal(report, 'security', 'No exposed secret files');
      expect(sig.found).toBe(false);
    });

    it('flags credentials file as suspicious', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [
        blob('config/credentials.json'),
      ]);
      const sig = findSignal(report, 'security', 'No exposed secret files');
      expect(sig.found).toBe(false);
    });

    it('flags secret file as suspicious', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [
        blob('my-secret-key.txt'),
      ]);
      const sig = findSignal(report, 'security', 'No exposed secret files');
      expect(sig.found).toBe(false);
    });

    it('reports no suspicious files when tree is clean', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [
        blob('.gitignore'),
        blob('README.md'),
      ]);
      const sig = findSignal(report, 'security', 'No exposed secret files');
      expect(sig.found).toBe(true);
    });

    it('scores full when all security signals are present', () => {
      const entries = [
        blob('SECURITY.md'),
        blob('.github/CODEOWNERS'),
        blob('.github/dependabot.yml'),
        blob('.github/workflows/codeql.yml'),
        blob('.gitignore'),
      ];
      const cat = findCategory(
        runLightAnalysis(defaultParsedRepo, makeRepoInfo(), entries),
        'security',
      );
      // 20+15+20+15+15+15 = 100
      expect(cat.score).toBe(100);
    });

    it('produces casing note for security.md (non-canonical)', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [blob('security.md')]);
      const sig = findSignal(report, 'security', 'SECURITY.md');
      expect(sig.found).toBe(true);
      expect(sig.details).toContain('security.md');
      expect(sig.details).toContain('SECURITY.md');
    });
  });

  // ── 4. CI/CD light ──

  describe('cicd', () => {
    it('detects GitHub Actions workflow files', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [
        blob('.github/workflows/main.yml'),
      ]);
      const sig = findSignal(report, 'cicd', 'GitHub Actions workflows');
      expect(sig.found).toBe(true);
      expect(sig.details).toBe('1 workflow file(s)');
    });

    it('counts multiple workflow files', () => {
      const entries = [
        blob('.github/workflows/ci.yml'),
        blob('.github/workflows/deploy.yml'),
        blob('.github/workflows/lint.yml'),
      ];
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), entries);
      const sig = findSignal(report, 'cicd', 'GitHub Actions workflows');
      expect(sig.details).toBe('3 workflow file(s)');
    });

    it('detects Dockerfile', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [blob('Dockerfile')]);
      const sig = findSignal(report, 'cicd', 'Dockerfile');
      expect(sig.found).toBe(true);
    });

    it('detects Dockerfile in subdirectory', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [
        blob('services/api/Dockerfile'),
      ]);
      const sig = findSignal(report, 'cicd', 'Dockerfile');
      expect(sig.found).toBe(true);
    });

    it('detects docker-compose.yml', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [
        blob('docker-compose.yml'),
      ]);
      const sig = findSignal(report, 'cicd', 'Docker Compose');
      expect(sig.found).toBe(true);
    });

    it('detects docker-compose.yaml', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [
        blob('docker-compose.yaml'),
      ]);
      const sig = findSignal(report, 'cicd', 'Docker Compose');
      expect(sig.found).toBe(true);
    });

    it('detects Makefile', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [blob('Makefile')]);
      const sig = findSignal(report, 'cicd', 'Makefile');
      expect(sig.found).toBe(true);
    });

    it('detects CI workflow by name containing "ci"', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [
        blob('.github/workflows/ci.yml'),
      ]);
      const sig = findSignal(report, 'cicd', 'CI workflow (test/build)');
      expect(sig.found).toBe(true);
    });

    it('detects CI workflow by name containing "test"', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [
        blob('.github/workflows/run-tests.yml'),
      ]);
      const sig = findSignal(report, 'cicd', 'CI workflow (test/build)');
      expect(sig.found).toBe(true);
    });

    it('detects CI workflow by name containing "build"', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [
        blob('.github/workflows/build.yml'),
      ]);
      const sig = findSignal(report, 'cicd', 'CI workflow (test/build)');
      expect(sig.found).toBe(true);
    });

    it('detects deploy workflow', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [
        blob('.github/workflows/deploy.yml'),
      ]);
      const sig = findSignal(report, 'cicd', 'Deploy / release workflow');
      expect(sig.found).toBe(true);
    });

    it('detects release workflow', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [
        blob('.github/workflows/release.yml'),
      ]);
      const sig = findSignal(report, 'cicd', 'Deploy / release workflow');
      expect(sig.found).toBe(true);
    });

    it('scores 100 when all CI/CD signals are present', () => {
      const entries = [
        blob('.github/workflows/ci.yml'),
        blob('.github/workflows/deploy.yml'),
        blob('Dockerfile'),
        blob('docker-compose.yml'),
        blob('Makefile'),
      ];
      const cat = findCategory(
        runLightAnalysis(defaultParsedRepo, makeRepoInfo(), entries),
        'cicd',
      );
      // 25+25+15+15+10+10 = 100
      expect(cat.score).toBe(100);
    });

    it('does not count tree entries as workflow files', () => {
      const entries = [tree('.github/workflows')];
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), entries);
      const sig = findSignal(report, 'cicd', 'GitHub Actions workflows');
      expect(sig.found).toBe(false);
      expect(sig.details).toBe('0 workflow file(s)');
    });
  });

  // ── 5. Dependencies light ──

  describe('dependencies', () => {
    it('detects package.json as manifest', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [blob('package.json')]);
      const sig = findSignal(report, 'dependencies', 'Dependency manifest');
      expect(sig.found).toBe(true);
      expect(sig.details).toBe('package.json');
    });

    it('detects all 13 manifest types', () => {
      const manifests = [
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
      const entries = manifests.map((m) => blob(m));
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), entries);
      const sig = findSignal(report, 'dependencies', 'Dependency manifest');
      expect(sig.found).toBe(true);
      for (const m of manifests) {
        expect(sig.details).toContain(m);
      }
    });

    it('detects all 6 lockfile types', () => {
      const lockfiles = [
        'package-lock.json',
        'yarn.lock',
        'pnpm-lock.yaml',
        'Cargo.lock',
        'go.sum',
        'Gemfile.lock',
      ];
      const entries = lockfiles.map((l) => blob(l));
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), entries);
      const sig = findSignal(report, 'dependencies', 'Lockfile present');
      expect(sig.found).toBe(true);
      for (const l of lockfiles) {
        expect(sig.details).toContain(l);
      }
    });

    it('infers Node.js from package.json', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [blob('package.json')]);
      expect(report.techStack).toContainEqual({ name: 'Node.js', category: 'platform' });
    });

    it('infers Rust from Cargo.toml', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [blob('Cargo.toml')]);
      expect(report.techStack).toContainEqual({ name: 'Rust', category: 'language' });
    });

    it('infers Go from go.mod', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [blob('go.mod')]);
      expect(report.techStack).toContainEqual({ name: 'Go', category: 'language' });
    });

    it('infers Python from requirements.txt', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [
        blob('requirements.txt'),
      ]);
      expect(report.techStack).toContainEqual({ name: 'Python', category: 'language' });
    });

    it('infers Python from pyproject.toml', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [blob('pyproject.toml')]);
      expect(report.techStack).toContainEqual({ name: 'Python', category: 'language' });
    });

    it('infers Python from Pipfile', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [blob('Pipfile')]);
      expect(report.techStack).toContainEqual({ name: 'Python', category: 'language' });
    });

    it('infers Ruby from Gemfile', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [blob('Gemfile')]);
      expect(report.techStack).toContainEqual({ name: 'Ruby', category: 'language' });
    });

    it('infers PHP from composer.json', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [blob('composer.json')]);
      expect(report.techStack).toContainEqual({ name: 'PHP', category: 'language' });
    });

    it('infers Java/JVM from pom.xml', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [blob('pom.xml')]);
      expect(report.techStack).toContainEqual({ name: 'Java/JVM', category: 'language' });
    });

    it('infers Java/JVM from build.gradle', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [blob('build.gradle')]);
      expect(report.techStack).toContainEqual({ name: 'Java/JVM', category: 'language' });
    });

    it('infers Java/JVM from build.gradle.kts', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [
        blob('build.gradle.kts'),
      ]);
      expect(report.techStack).toContainEqual({ name: 'Java/JVM', category: 'language' });
    });

    it('infers Docker from Dockerfile', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [blob('Dockerfile')]);
      expect(report.techStack).toContainEqual({ name: 'Docker', category: 'platform' });
    });

    it('infers TypeScript from tsconfig.json', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [blob('tsconfig.json')]);
      expect(report.techStack).toContainEqual({ name: 'TypeScript', category: 'language' });
    });

    it('scores 100 when manifest, lockfile, and tech stack are present', () => {
      const entries = [blob('package.json'), blob('package-lock.json')];
      const cat = findCategory(
        runLightAnalysis(defaultParsedRepo, makeRepoInfo(), entries),
        'dependencies',
      );
      // 40 (manifest) + 35 (lockfile) + 25 (tech stack from Node.js) = 100
      expect(cat.score).toBe(100);
    });

    it('scores 0 when no dependency files exist', () => {
      const cat = findCategory(
        runLightAnalysis(defaultParsedRepo, makeRepoInfo(), []),
        'dependencies',
      );
      expect(cat.score).toBe(0);
    });
  });

  // ── 6. Code quality light ──

  describe('code quality', () => {
    it('detects eslint config (.eslintrc.json)', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [blob('.eslintrc.json')]);
      const sig = findSignal(report, 'codeQuality', 'Linter configured');
      expect(sig.found).toBe(true);
    });

    it('detects eslint flat config (eslint.config.js)', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [
        blob('eslint.config.js'),
      ]);
      const sig = findSignal(report, 'codeQuality', 'Linter configured');
      expect(sig.found).toBe(true);
    });

    it('detects eslint flat config (eslint.config.mjs)', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [
        blob('eslint.config.mjs'),
      ]);
      const sig = findSignal(report, 'codeQuality', 'Linter configured');
      expect(sig.found).toBe(true);
    });

    it('detects flake8 linter (.flake8)', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [blob('.flake8')]);
      const sig = findSignal(report, 'codeQuality', 'Linter configured');
      expect(sig.found).toBe(true);
    });

    it('detects pylint linter (.pylintrc)', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [blob('.pylintrc')]);
      const sig = findSignal(report, 'codeQuality', 'Linter configured');
      expect(sig.found).toBe(true);
    });

    it('detects clippy linter (clippy.toml)', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [blob('clippy.toml')]);
      const sig = findSignal(report, 'codeQuality', 'Linter configured');
      expect(sig.found).toBe(true);
    });

    it('detects rubocop linter (.rubocop.yml)', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [blob('.rubocop.yml')]);
      const sig = findSignal(report, 'codeQuality', 'Linter configured');
      expect(sig.found).toBe(true);
    });

    it('detects golangci-lint (.golangci.yml)', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [blob('.golangci.yml')]);
      const sig = findSignal(report, 'codeQuality', 'Linter configured');
      expect(sig.found).toBe(true);
    });

    it('detects biome (biome.json) as both linter and formatter', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [blob('biome.json')]);
      const linterSig = findSignal(report, 'codeQuality', 'Linter configured');
      const formatterSig = findSignal(report, 'codeQuality', 'Formatter configured');
      expect(linterSig.found).toBe(true);
      expect(formatterSig.found).toBe(true);
    });

    it('detects deno config (deno.json) as linter', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [blob('deno.json')]);
      const sig = findSignal(report, 'codeQuality', 'Linter configured');
      expect(sig.found).toBe(true);
    });

    it('detects prettier formatter (.prettierrc)', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [blob('.prettierrc')]);
      const sig = findSignal(report, 'codeQuality', 'Formatter configured');
      expect(sig.found).toBe(true);
    });

    it('detects prettier config js (prettier.config.js)', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [
        blob('prettier.config.js'),
      ]);
      const sig = findSignal(report, 'codeQuality', 'Formatter configured');
      expect(sig.found).toBe(true);
    });

    it('detects rustfmt formatter (rustfmt.toml)', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [blob('rustfmt.toml')]);
      const sig = findSignal(report, 'codeQuality', 'Formatter configured');
      expect(sig.found).toBe(true);
    });

    it('detects clang-format (.clang-format)', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [blob('.clang-format')]);
      const sig = findSignal(report, 'codeQuality', 'Formatter configured');
      expect(sig.found).toBe(true);
    });

    it('detects TypeScript (tsconfig.json) as type system', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [blob('tsconfig.json')]);
      const sig = findSignal(report, 'codeQuality', 'Type system');
      expect(sig.found).toBe(true);
      expect(sig.details).toBe('TypeScript');
    });

    it('does not report type system without tsconfig.json', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), []);
      const sig = findSignal(report, 'codeQuality', 'Type system');
      expect(sig.found).toBe(false);
      expect(sig.details).toBeUndefined();
    });

    it('detects husky git hooks (.husky/pre-commit)', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [
        blob('.husky/pre-commit'),
      ]);
      const sig = findSignal(report, 'codeQuality', 'Git hooks');
      expect(sig.found).toBe(true);
    });

    it('detects .husky directory as git hooks presence', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [blob('.husky')]);
      const sig = findSignal(report, 'codeQuality', 'Git hooks');
      expect(sig.found).toBe(true);
    });

    it('detects pre-commit config (.pre-commit-config.yaml)', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [
        blob('.pre-commit-config.yaml'),
      ]);
      const sig = findSignal(report, 'codeQuality', 'Git hooks');
      expect(sig.found).toBe(true);
    });

    it('detects lefthook config (.lefthook.yml)', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [blob('.lefthook.yml')]);
      const sig = findSignal(report, 'codeQuality', 'Git hooks');
      expect(sig.found).toBe(true);
    });

    it('detects lefthook config (lefthook.yml without dot)', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [blob('lefthook.yml')]);
      const sig = findSignal(report, 'codeQuality', 'Git hooks');
      expect(sig.found).toBe(true);
    });

    it('detects test directories', () => {
      const testDirs = ['test', 'tests', '__tests__', 'spec', 'src/test', 'src/__tests__'];
      for (const dir of testDirs) {
        const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [tree(dir)]);
        const sig = findSignal(report, 'codeQuality', 'Tests present');
        expect(sig.found).toBe(true);
        expect(sig.details).toContain(dir);
      }
    });

    it('detects test files by pattern (.test.tsx)', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [
        blob('src/App.test.tsx'),
      ]);
      const sig = findSignal(report, 'codeQuality', 'Tests present');
      expect(sig.found).toBe(true);
      expect(sig.details).toBe('1 test files');
    });

    it('detects test files by pattern (.spec.js)', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [
        blob('src/utils.spec.js'),
      ]);
      const sig = findSignal(report, 'codeQuality', 'Tests present');
      expect(sig.found).toBe(true);
    });

    it('detects Go test files (_test.go)', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [blob('handler_test.go')]);
      const sig = findSignal(report, 'codeQuality', 'Tests present');
      expect(sig.found).toBe(true);
    });

    it('detects Rust test files (_test.rs)', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [blob('lib_test.rs')]);
      const sig = findSignal(report, 'codeQuality', 'Tests present');
      expect(sig.found).toBe(true);
    });

    it('detects Python test files (test_*.py)', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [blob('test_handler.py')]);
      const sig = findSignal(report, 'codeQuality', 'Tests present');
      expect(sig.found).toBe(true);
    });

    it('detects Ruby spec files (_spec.rb)', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [blob('model_spec.rb')]);
      const sig = findSignal(report, 'codeQuality', 'Tests present');
      expect(sig.found).toBe(true);
    });

    it('detects .editorconfig', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [blob('.editorconfig')]);
      const sig = findSignal(report, 'codeQuality', 'EditorConfig');
      expect(sig.found).toBe(true);
    });

    it('.editorconfig is detected as both formatter and editorconfig signals', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [blob('.editorconfig')]);
      const fmtSig = findSignal(report, 'codeQuality', 'Formatter configured');
      const ecSig = findSignal(report, 'codeQuality', 'EditorConfig');
      expect(fmtSig.found).toBe(true);
      expect(ecSig.found).toBe(true);
    });

    it('scores 100 when all code quality signals are present', () => {
      const entries = [
        blob('.eslintrc.json'),
        blob('.prettierrc'),
        blob('tsconfig.json'),
        blob('.husky/pre-commit'),
        blob('src/App.test.tsx'),
        blob('.editorconfig'),
      ];
      const cat = findCategory(
        runLightAnalysis(defaultParsedRepo, makeRepoInfo(), entries),
        'codeQuality',
      );
      // 20+15+15+15+25+10 = 100
      expect(cat.score).toBe(100);
    });

    it('scores 0 when nothing is present', () => {
      const cat = findCategory(
        runLightAnalysis(defaultParsedRepo, makeRepoInfo(), []),
        'codeQuality',
      );
      expect(cat.score).toBe(0);
    });

    it('prefers test file count details over directory names when both exist', () => {
      const entries = [tree('tests'), blob('src/App.test.tsx')];
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), entries);
      const sig = findSignal(report, 'codeQuality', 'Tests present');
      expect(sig.found).toBe(true);
      // When testFileCount > 0, details shows file count
      expect(sig.details).toBe('1 test files');
    });
  });

  // ── 7. License light ──

  describe('license', () => {
    it('detects LICENSE file', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [blob('LICENSE')]);
      const sig = findSignal(report, 'license', 'License file exists');
      expect(sig.found).toBe(true);
    });

    it('detects LICENSE.md file', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [blob('LICENSE.md')]);
      const sig = findSignal(report, 'license', 'License file exists');
      expect(sig.found).toBe(true);
    });

    it('detects LICENSE.txt file', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [blob('LICENSE.txt')]);
      const sig = findSignal(report, 'license', 'License file exists');
      expect(sig.found).toBe(true);
    });

    it('detects COPYING file', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [blob('COPYING')]);
      const sig = findSignal(report, 'license', 'License file exists');
      expect(sig.found).toBe(true);
    });

    it('detects LICENCE (British spelling) file', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [blob('LICENCE')]);
      const sig = findSignal(report, 'license', 'License file exists');
      expect(sig.found).toBe(true);
    });

    it('detects license file case-insensitively', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [blob('license')]);
      const sig = findSignal(report, 'license', 'License file exists');
      expect(sig.found).toBe(true);
    });

    it('detects SPDX license from repoInfo', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo({ license: 'MIT' }), []);
      const sig = findSignal(report, 'license', 'SPDX license detected');
      expect(sig.found).toBe(true);
      expect(sig.details).toBe('MIT');
    });

    it('rejects NOASSERTION as a valid SPDX license', () => {
      const report = runLightAnalysis(
        defaultParsedRepo,
        makeRepoInfo({ license: 'NOASSERTION' }),
        [],
      );
      const sig = findSignal(report, 'license', 'SPDX license detected');
      expect(sig.found).toBe(false);
    });

    it('identifies MIT as permissive', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo({ license: 'MIT' }), [
        blob('LICENSE'),
      ]);
      const sig = findSignal(report, 'license', 'Permissive license');
      expect(sig.found).toBe(true);
      expect(sig.details).toBe('MIT');
    });

    it('identifies Apache-2.0 as permissive', () => {
      const report = runLightAnalysis(
        defaultParsedRepo,
        makeRepoInfo({ license: 'Apache-2.0' }),
        [],
      );
      const sig = findSignal(report, 'license', 'Permissive license');
      expect(sig.found).toBe(true);
    });

    it('identifies GPL-3.0 as copyleft', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo({ license: 'GPL-3.0' }), [
        blob('LICENSE'),
      ]);
      const copyleftSig = findSignal(report, 'license', 'Copyleft license');
      expect(copyleftSig.found).toBe(true);
      expect(copyleftSig.details).toBe('GPL-3.0');
      const permSig = findSignal(report, 'license', 'Permissive license');
      expect(permSig.found).toBe(false);
    });

    it('identifies AGPL-3.0 as copyleft', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo({ license: 'AGPL-3.0' }), []);
      const sig = findSignal(report, 'license', 'Copyleft license');
      expect(sig.found).toBe(true);
    });

    it('scores higher for permissive license than copyleft', () => {
      const permissiveReport = runLightAnalysis(
        defaultParsedRepo,
        makeRepoInfo({ license: 'MIT' }),
        [blob('LICENSE')],
      );
      const copyleftReport = runLightAnalysis(
        defaultParsedRepo,
        makeRepoInfo({ license: 'GPL-3.0' }),
        [blob('LICENSE')],
      );
      const permCat = findCategory(permissiveReport, 'license');
      const copyleftCat = findCategory(copyleftReport, 'license');
      // permissive: 40 + 30 + 30 = 100
      // copyleft: 40 + 30 + 20 = 90
      expect(permCat.score).toBe(100);
      expect(copyleftCat.score).toBe(90);
      expect(permCat.score).toBeGreaterThan(copyleftCat.score);
    });

    it('gives partial score for detected but non-classified license', () => {
      const report = runLightAnalysis(
        defaultParsedRepo,
        makeRepoInfo({ license: 'Artistic-2.0' }),
        [blob('LICENSE')],
      );
      const cat = findCategory(report, 'license');
      // 40 (file) + 30 (detected) + 10 (detected but not permissive/copyleft) = 80
      expect(cat.score).toBe(80);
    });

    it('scores 0 with no license file and null SPDX', () => {
      const cat = findCategory(
        runLightAnalysis(defaultParsedRepo, makeRepoInfo({ license: null }), []),
        'license',
      );
      expect(cat.score).toBe(0);
    });
  });

  // ── 8. Community light ──

  describe('community', () => {
    it('detects issue templates', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [
        blob('.github/ISSUE_TEMPLATE/bug.md'),
        blob('.github/ISSUE_TEMPLATE/feature.md'),
      ]);
      const sig = findSignal(report, 'community', 'Issue templates');
      expect(sig.found).toBe(true);
      expect(sig.details).toBe('2 template(s)');
    });

    it('detects issue templates case-insensitively', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [
        blob('.github/issue_template/bug.md'),
      ]);
      const sig = findSignal(report, 'community', 'Issue templates');
      expect(sig.found).toBe(true);
    });

    it('detects PR template (.github/PULL_REQUEST_TEMPLATE.md)', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [
        blob('.github/PULL_REQUEST_TEMPLATE.md'),
      ]);
      const sig = findSignal(report, 'community', 'PR template');
      expect(sig.found).toBe(true);
    });

    it('detects alternative PR template (.github/pull_request_template.md)', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [
        blob('.github/pull_request_template.md'),
      ]);
      const sig = findSignal(report, 'community', 'PR template');
      expect(sig.found).toBe(true);
    });

    it('detects PR template by name PULL_REQUEST_TEMPLATE.md (case-insensitive)', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [
        blob('PULL_REQUEST_TEMPLATE.md'),
      ]);
      const sig = findSignal(report, 'community', 'PR template');
      expect(sig.found).toBe(true);
    });

    it('detects Code of Conduct at root', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [
        blob('CODE_OF_CONDUCT.md'),
      ]);
      const sig = findSignal(report, 'community', 'Code of Conduct');
      expect(sig.found).toBe(true);
    });

    it('detects Code of Conduct in .github/', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [
        blob('.github/CODE_OF_CONDUCT.md'),
      ]);
      const sig = findSignal(report, 'community', 'Code of Conduct');
      expect(sig.found).toBe(true);
    });

    it('detects CONTRIBUTING.md', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [blob('CONTRIBUTING.md')]);
      const sig = findSignal(report, 'community', 'CONTRIBUTING.md');
      expect(sig.found).toBe(true);
    });

    it('detects FUNDING.yml', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [
        blob('.github/FUNDING.yml'),
      ]);
      const sig = findSignal(report, 'community', 'Funding configuration');
      expect(sig.found).toBe(true);
    });

    it('detects SUPPORT.md in .github/', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [
        blob('.github/SUPPORT.md'),
      ]);
      const sig = findSignal(report, 'community', 'SUPPORT.md');
      expect(sig.found).toBe(true);
    });

    it('detects SUPPORT.md at root', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [blob('SUPPORT.md')]);
      const sig = findSignal(report, 'community', 'SUPPORT.md');
      expect(sig.found).toBe(true);
    });

    it('scores 100 when all community signals are present', () => {
      const entries = [
        blob('.github/ISSUE_TEMPLATE/bug.md'),
        blob('.github/PULL_REQUEST_TEMPLATE.md'),
        blob('CODE_OF_CONDUCT.md'),
        blob('CONTRIBUTING.md'),
        blob('.github/FUNDING.yml'),
        blob('SUPPORT.md'),
      ];
      const cat = findCategory(
        runLightAnalysis(defaultParsedRepo, makeRepoInfo(), entries),
        'community',
      );
      // 20+20+20+20+10+10 = 100
      expect(cat.score).toBe(100);
    });

    it('scores 0 when nothing community-related is present', () => {
      const cat = findCategory(
        runLightAnalysis(defaultParsedRepo, makeRepoInfo(), []),
        'community',
      );
      expect(cat.score).toBe(0);
    });

    it('shows 0 template(s) when no issue templates exist', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), []);
      const sig = findSignal(report, 'community', 'Issue templates');
      expect(sig.found).toBe(false);
      expect(sig.details).toBe('0 template(s)');
    });
  });

  // ── 9. Tech stack ──

  describe('tech stack', () => {
    it('adds repoInfo.language if not already in tech stack', () => {
      const report = runLightAnalysis(
        defaultParsedRepo,
        makeRepoInfo({ language: 'JavaScript' }),
        [],
      );
      expect(report.techStack).toContainEqual({ name: 'JavaScript', category: 'language' });
    });

    it('does not duplicate language when already detected from manifest', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo({ language: 'Rust' }), [
        blob('Cargo.toml'),
      ]);
      const rustItems = report.techStack.filter((t) => t.name.toLowerCase() === 'rust');
      expect(rustItems).toHaveLength(1);
    });

    it('does not duplicate language (case-insensitive comparison)', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo({ language: 'TypeScript' }), [
        blob('tsconfig.json'),
      ]);
      const tsItems = report.techStack.filter((t) => t.name.toLowerCase() === 'typescript');
      expect(tsItems).toHaveLength(1);
    });

    it('prepends repoInfo.language at the beginning of tech stack', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo({ language: 'JavaScript' }), [
        blob('package.json'),
      ]);
      // JavaScript should be first (unshifted), Node.js should follow
      expect(report.techStack[0]).toEqual({ name: 'JavaScript', category: 'language' });
    });

    it('does not add language if repoInfo.language is null', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo({ language: null }), []);
      expect(report.techStack).toHaveLength(0);
    });

    it('handles multiple tech stack items from different manifests', () => {
      const entries = [
        blob('package.json'),
        blob('requirements.txt'),
        blob('Dockerfile'),
        blob('tsconfig.json'),
      ];
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), entries);
      expect(report.techStack).toContainEqual({ name: 'Node.js', category: 'platform' });
      expect(report.techStack).toContainEqual({ name: 'Python', category: 'language' });
      expect(report.techStack).toContainEqual({ name: 'Docker', category: 'platform' });
      expect(report.techStack).toContainEqual({ name: 'TypeScript', category: 'language' });
    });
  });

  // ── 10. Edge cases ──

  describe('edge cases', () => {
    it('handles empty tree array', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), []);
      // Security scores 15 ("No exposed secret files"), weight=0.1
      // OpenSSF scores 20 (no binary + no dangerous patterns), weight=0.1
      // Weighted: (15*0.1 + 20*0.1) / 1.0 = 3.5, rounded = 4
      expect(report.overallScore).toBe(4);
      expect(report.grade).toBe('F');
      expect(report.treeEntryCount).toBe(0);
      expect(report.categories).toHaveLength(8);
    });

    it('handles tree with only directory entries', () => {
      const entries = [tree('src'), tree('docs'), tree('test')];
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), entries);
      // docs dir and test dir should be found
      const docSig = findSignal(report, 'documentation', 'docs/ directory');
      expect(docSig.found).toBe(true);
      const testSig = findSignal(report, 'codeQuality', 'Tests present');
      expect(testSig.found).toBe(true);
    });

    it('case-insensitive matching works for README variants', () => {
      const variants = ['README.md', 'readme.md', 'Readme.md', 'ReadMe.MD', 'README.MD'];
      for (const v of variants) {
        const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [blob(v)]);
        const sig = findSignal(report, 'documentation', 'README exists');
        expect(sig.found).toBe(true);
      }
    });

    it('produces casing note when file has non-canonical casing', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [blob('contributing.md')]);
      const sig = findSignal(report, 'documentation', 'CONTRIBUTING.md');
      expect(sig.found).toBe(true);
      expect(sig.details).toContain('contributing.md');
      expect(sig.details).toContain('CONTRIBUTING.md');
    });

    it('does not produce casing note when file has exact canonical casing', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [blob('CONTRIBUTING.md')]);
      const sig = findSignal(report, 'documentation', 'CONTRIBUTING.md');
      expect(sig.found).toBe(true);
      expect(sig.details).toBeUndefined();
    });

    it('lowerToOriginal keeps first occurrence when duplicates exist', () => {
      // If tree has both README.md and readme.md, first one wins in the map
      const entries = [blob('README.md'), blob('readme.md')];
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), entries);
      const sig = findSignal(report, 'documentation', 'README exists');
      expect(sig.found).toBe(true);
      // Since README.md is first and matches canonical, no casing note
      expect(sig.details).toBeUndefined();
    });

    it('score is capped at 100 even if many signals contribute', () => {
      // All documentation signals present => 35+20+20+25 = 100 (exactly at cap)
      const entries = [
        blob('README.md'),
        blob('CONTRIBUTING.md'),
        blob('CHANGELOG.md'),
        tree('docs'),
      ];
      const cat = findCategory(
        runLightAnalysis(defaultParsedRepo, makeRepoInfo(), entries),
        'documentation',
      );
      expect(cat.score).toBeLessThanOrEqual(100);
    });

    it('each category has the correct weight from CATEGORY_WEIGHTS', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), []);
      const expectedWeights: Record<string, number> = {
        documentation: 0.15,
        security: 0.1,
        cicd: 0.15,
        dependencies: 0.15,
        codeQuality: 0.15,
        license: 0.1,
        community: 0.1,
        openssf: 0.1,
      };
      for (const cat of report.categories) {
        expect(cat.weight).toBe(expectedWeights[cat.key]);
      }
    });

    it('each category has the correct label from CATEGORY_LABELS', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), []);
      const expectedLabels: Record<string, string> = {
        documentation: 'Documentation',
        security: 'Security',
        cicd: 'CI/CD',
        dependencies: 'Dependencies',
        codeQuality: 'Code Quality',
        license: 'License',
        community: 'Community',
        openssf: 'OpenSSF',
      };
      for (const cat of report.categories) {
        expect(cat.label).toBe(expectedLabels[cat.key]);
      }
    });

    it('grade B for score between 70 and 84', () => {
      // Build a tree that gets roughly 70-84 overall
      const entries = [
        // Documentation: README (35) + CONTRIBUTING (20) + docs (25) = 80
        blob('README.md'),
        blob('CONTRIBUTING.md'),
        tree('docs'),
        // Security: all (100)
        blob('SECURITY.md'),
        blob('.github/CODEOWNERS'),
        blob('.github/dependabot.yml'),
        blob('.github/workflows/codeql.yml'),
        blob('.gitignore'),
        // CI/CD: workflows + ci + deploy = 25+25+15 = 65
        blob('.github/workflows/ci.yml'),
        blob('.github/workflows/deploy.yml'),
        // Dependencies: package.json + lockfile = 40+35+25 = 100
        blob('package.json'),
        blob('package-lock.json'),
        // Code quality: linter + tests = 20+25 = 45
        blob('.eslintrc.json'),
        blob('src/App.test.tsx'),
        // License: file + MIT = 100
        blob('LICENSE'),
        // Community: contributing + COC = 20+20 = 40
        blob('CODE_OF_CONDUCT.md'),
      ];
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo({ license: 'MIT' }), entries);
      expect(report.overallScore).toBeGreaterThanOrEqual(70);
      expect(report.overallScore).toBeLessThan(85);
      expect(report.grade).toBe('B');
    });

    it('parsedRepo with branch is preserved', () => {
      const parsed: ParsedRepo = { owner: 'x', repo: 'y', branch: 'feature/test' };
      const report = runLightAnalysis(parsed, makeRepoInfo(), []);
      expect(report.repo.branch).toBe('feature/test');
    });

    it('.env file nested in subdirectory is still flagged as suspicious', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [blob('config/.env')]);
      const sig = findSignal(report, 'security', 'No exposed secret files');
      expect(sig.found).toBe(false);
    });

    it('tree entries (directories) are not counted as workflow files', () => {
      const entries = [tree('.github/workflows'), blob('.github/workflows/ci.yml')];
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), entries);
      const sig = findSignal(report, 'cicd', 'GitHub Actions workflows');
      expect(sig.details).toBe('1 workflow file(s)');
    });

    it('dependabot detection is case-sensitive (exact path match)', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [
        blob('.github/Dependabot.yml'),
      ]);
      const sig = findSignal(report, 'security', 'Dependabot configured');
      // treePaths.has() is case-sensitive, so capitalized won't match
      expect(sig.found).toBe(false);
    });

    it('CodeQL detection is case-insensitive in path name', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), [
        blob('.github/workflows/CodeQL.yml'),
      ]);
      const sig = findSignal(report, 'security', 'CodeQL / security scanning');
      expect(sig.found).toBe(true);
    });

    it('only Python is added once even if multiple Python manifests present', () => {
      const entries = [blob('requirements.txt'), blob('pyproject.toml'), blob('Pipfile')];
      const report = runLightAnalysis(
        defaultParsedRepo,
        makeRepoInfo({ language: 'Python' }),
        entries,
      );
      const pythonItems = report.techStack.filter((t) => t.name.toLowerCase() === 'python');
      // analyzeDependenciesLight only pushes Python once (single if block)
      // plus repoInfo.language won't duplicate since it already exists
      expect(pythonItems).toHaveLength(1);
    });
  });

  // ── 11. OpenSSF light analysis branch coverage ──

  describe('analyzeOpenssfLight', () => {
    it('detects Dependabot config and sets details', () => {
      const entries = [blob('.github/dependabot.yml')];
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), entries);
      const sig = findSignal(report, 'openssf', 'Dependency update tool');
      expect(sig.found).toBe(true);
      expect(sig.details).toBe('Dependabot');
    });

    it('detects Renovate config (.renovaterc) and sets details', () => {
      const entries = [blob('.renovaterc')];
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), entries);
      const sig = findSignal(report, 'openssf', 'Dependency update tool');
      expect(sig.found).toBe(true);
      expect(sig.details).toBe('Renovate');
    });

    it('detects Renovate config (renovate.json)', () => {
      const entries = [blob('renovate.json')];
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), entries);
      const sig = findSignal(report, 'openssf', 'Dependency update tool');
      expect(sig.found).toBe(true);
      expect(sig.details).toBe('Renovate');
    });

    it('does not detect dep update tool without config', () => {
      const entries = [blob('src/index.ts')];
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), entries);
      const sig = findSignal(report, 'openssf', 'Dependency update tool');
      expect(sig.found).toBe(false);
      expect(sig.details).toBeUndefined();
    });

    it('detects binary artifacts (.exe)', () => {
      const entries = [blob('build/app.exe')];
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), entries);
      const sig = findSignal(report, 'openssf', 'No binary artifacts');
      expect(sig.found).toBe(false);
    });

    it('passes when no binary artifacts exist', () => {
      const entries = [blob('src/index.ts'), blob('README.md')];
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), entries);
      const sig = findSignal(report, 'openssf', 'No binary artifacts');
      expect(sig.found).toBe(true);
    });

    it('detects SLSA workflow file', () => {
      const entries = [blob('.github/workflows/slsa.yml')];
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), entries);
      const sig = findSignal(report, 'openssf', 'SLSA / signed releases');
      expect(sig.found).toBe(true);
    });

    it('detects scorecard workflow file', () => {
      const entries = [blob('.github/workflows/scorecard.yml')];
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), entries);
      const sig = findSignal(report, 'openssf', 'SLSA / signed releases');
      expect(sig.found).toBe(true);
    });

    it('detects fuzz directory', () => {
      const entries = [blob('fuzz/fuzz_target.go')];
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), entries);
      const sig = findSignal(report, 'openssf', 'Fuzzing');
      expect(sig.found).toBe(true);
    });

    it('does not detect fuzzing without fuzz directory', () => {
      const entries = [blob('src/index.ts')];
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), entries);
      const sig = findSignal(report, 'openssf', 'Fuzzing');
      expect(sig.found).toBe(false);
    });

    it('detects SECURITY.md for security policy signal', () => {
      const entries = [blob('SECURITY.md')];
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), entries);
      const sig = findSignal(report, 'openssf', 'Security policy');
      expect(sig.found).toBe(true);
    });

    it('detects LICENSE for license signal', () => {
      const entries = [blob('LICENSE')];
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), entries);
      const sig = findSignal(report, 'openssf', 'License detected');
      expect(sig.found).toBe(true);
    });

    it('scores correctly with multiple openssf signals present', () => {
      const entries = [
        blob('.github/dependabot.yml'),
        blob('SECURITY.md'),
        blob('LICENSE'),
        blob('fuzz/target.go'),
        blob('.github/workflows/slsa.yml'),
      ];
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), entries);
      const cat = findCategory(report, 'openssf');
      // no dangerous (10) + no binary (10) + SLSA (10) + fuzz (10) + dep tool (10) + security (5) + license (5) = 60
      expect(cat.score).toBe(60);
    });

    it('token permissions signal is always not found in light mode', () => {
      const entries = [blob('.github/workflows/ci.yml')];
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), entries);
      const sig = findSignal(report, 'openssf', 'Token permissions');
      expect(sig.found).toBe(false);
    });

    it('pinned deps signal is always not found in light mode', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), []);
      const sig = findSignal(report, 'openssf', 'Pinned dependencies');
      expect(sig.found).toBe(false);
    });

    it('SBOM signal is always not found in light mode', () => {
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), []);
      const sig = findSignal(report, 'openssf', 'SBOM generation');
      expect(sig.found).toBe(false);
    });

    it('prefers Dependabot over Renovate when both present', () => {
      const entries = [blob('.github/dependabot.yml'), blob('.renovaterc')];
      const report = runLightAnalysis(defaultParsedRepo, makeRepoInfo(), entries);
      const sig = findSignal(report, 'openssf', 'Dependency update tool');
      expect(sig.found).toBe(true);
      expect(sig.details).toBe('Dependabot');
    });
  });
});
