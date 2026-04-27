import { describe, it, expect } from 'vitest';
import { runAnalysis } from '../engine';
import type { ParsedRepo, RepoInfo, TreeEntry, FileContent, CategoryKey } from '../../../types';

// ── Helpers ──

function blob(path: string): TreeEntry {
  return { path, mode: '100644', type: 'blob', sha: 'abc' };
}

function dir(path: string): TreeEntry {
  return { path, mode: '040000', type: 'tree', sha: 'def' };
}

function file(path: string, content: string): FileContent {
  return { path, content, size: content.length };
}

function makeRepo(overrides?: Partial<ParsedRepo>): ParsedRepo {
  return { owner: 'test-owner', repo: 'test-repo', ...overrides };
}

function makeRepoInfo(overrides?: Partial<RepoInfo>): RepoInfo {
  return {
    owner: 'test-owner',
    repo: 'test-repo',
    defaultBranch: 'main',
    description: 'A test repository',
    stars: 10,
    forks: 2,
    openIssues: 3,
    license: null,
    language: null,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-06-01T00:00:00Z',
    topics: [],
    archived: false,
    size: 100,
    ...overrides,
  };
}

const EXPECTED_CATEGORY_KEYS: CategoryKey[] = [
  'documentation',
  'security',
  'cicd',
  'dependencies',
  'codeQuality',
  'license',
  'community',
  'openssf',
];

// ── Empty repo ──

describe('runAnalysis – empty repo', () => {
  it('returns a valid report with low scores when given no files and no tree entries', () => {
    const report = runAnalysis(makeRepo(), makeRepoInfo(), [], []);

    expect(report.overallScore).toBeGreaterThanOrEqual(0);
    expect(report.overallScore).toBeLessThanOrEqual(100);
    expect(report.categories).toHaveLength(8);
    expect(report.fileCount).toBe(0);
    expect(report.treeEntryCount).toBe(0);
  });

  it('assigns a low grade (D or F) for an empty repo', () => {
    const report = runAnalysis(makeRepo(), makeRepoInfo(), [], []);

    expect(['D', 'F']).toContain(report.grade);
  });

  it('has an empty or minimal techStack for an empty repo', () => {
    const report = runAnalysis(makeRepo(), makeRepoInfo(), [], []);

    // With no files/tree and no repoInfo.language, techStack should be empty
    expect(report.techStack).toEqual([]);
  });
});

// ── Report structure ──

describe('runAnalysis – report structure', () => {
  const report = runAnalysis(makeRepo(), makeRepoInfo(), [], []);

  it('contains an id string with owner/repo prefix', () => {
    expect(typeof report.id).toBe('string');
    expect(report.id).toContain('test-owner/test-repo@');
  });

  it('contains the parsedRepo as repo', () => {
    expect(report.repo).toEqual(makeRepo());
  });

  it('contains the repoInfo', () => {
    expect(report.repoInfo).toEqual(makeRepoInfo());
  });

  it('has exactly 8 categories', () => {
    expect(report.categories).toHaveLength(8);
  });

  it('has all 8 expected category keys', () => {
    const keys = report.categories.map((c) => c.key);
    expect(keys).toEqual(EXPECTED_CATEGORY_KEYS);
  });

  it('has an overallScore between 0 and 100', () => {
    expect(report.overallScore).toBeGreaterThanOrEqual(0);
    expect(report.overallScore).toBeLessThanOrEqual(100);
  });

  it('has a valid LetterGrade', () => {
    expect(['A', 'B', 'C', 'D', 'F']).toContain(report.grade);
  });

  it('has techStack as an array', () => {
    expect(Array.isArray(report.techStack)).toBe(true);
  });

  it('has strengths as an array of strings', () => {
    expect(Array.isArray(report.strengths)).toBe(true);
    for (const s of report.strengths) {
      expect(typeof s).toBe('string');
    }
  });

  it('has risks as an array of strings', () => {
    expect(Array.isArray(report.risks)).toBe(true);
    for (const r of report.risks) {
      expect(typeof r).toBe('string');
    }
  });

  it('has nextSteps as an array of strings', () => {
    expect(Array.isArray(report.nextSteps)).toBe(true);
    for (const n of report.nextSteps) {
      expect(typeof n).toBe('string');
    }
  });

  it('has repoStructure as a string', () => {
    expect(typeof report.repoStructure).toBe('string');
  });

  it('has analyzedAt as a valid ISO date string', () => {
    expect(typeof report.analyzedAt).toBe('string');
    const date = new Date(report.analyzedAt);
    expect(date.getTime()).not.toBeNaN();
  });

  it('has contributorScore with score, signals, and readinessChecklist', () => {
    expect(report.contributorScore).toBeDefined();
    expect(typeof report.contributorScore!.score).toBe('number');
    expect(Array.isArray(report.contributorScore!.signals)).toBe(true);
    expect(Array.isArray(report.contributorScore!.readinessChecklist)).toBe(true);
  });

  it('has fileCount and treeEntryCount as numbers', () => {
    expect(typeof report.fileCount).toBe('number');
    expect(typeof report.treeEntryCount).toBe('number');
  });
});

// ── File count and tree entry count ──

describe('runAnalysis – fileCount and treeEntryCount', () => {
  it('sets fileCount to match the number of input files', () => {
    const files = [file('a.txt', 'hello'), file('b.txt', 'world')];
    const tree = [blob('a.txt'), blob('b.txt'), dir('src')];
    const report = runAnalysis(makeRepo(), makeRepoInfo(), tree, files);

    expect(report.fileCount).toBe(2);
  });

  it('sets treeEntryCount to match the number of input tree entries', () => {
    const tree = [blob('a.txt'), blob('b.txt'), dir('src'), blob('src/c.ts')];
    const report = runAnalysis(makeRepo(), makeRepoInfo(), tree, []);

    expect(report.treeEntryCount).toBe(4);
  });

  it('handles a large number of files and tree entries', () => {
    const files = Array.from({ length: 50 }, (_, i) => file(`file${i}.txt`, `content ${i}`));
    const tree = Array.from({ length: 100 }, (_, i) => blob(`file${i}.txt`));
    const report = runAnalysis(makeRepo(), makeRepoInfo(), tree, files);

    expect(report.fileCount).toBe(50);
    expect(report.treeEntryCount).toBe(100);
  });
});

// ── Categories array ──

describe('runAnalysis – categories', () => {
  it('returns categories in the order: documentation, security, cicd, dependencies, codeQuality, license, community, openssf', () => {
    const report = runAnalysis(makeRepo(), makeRepoInfo(), [], []);
    const keys = report.categories.map((c) => c.key);
    expect(keys).toEqual(EXPECTED_CATEGORY_KEYS);
  });

  it('each category has a label, score, weight, and signals array', () => {
    const report = runAnalysis(makeRepo(), makeRepoInfo(), [], []);

    for (const cat of report.categories) {
      expect(typeof cat.label).toBe('string');
      expect(cat.label.length).toBeGreaterThan(0);
      expect(typeof cat.score).toBe('number');
      expect(cat.score).toBeGreaterThanOrEqual(0);
      expect(cat.score).toBeLessThanOrEqual(100);
      expect(typeof cat.weight).toBe('number');
      expect(cat.weight).toBeGreaterThan(0);
      expect(cat.weight).toBeLessThanOrEqual(1);
      expect(Array.isArray(cat.signals)).toBe(true);
    }
  });

  it('category weights sum to approximately 1.0', () => {
    const report = runAnalysis(makeRepo(), makeRepoInfo(), [], []);
    const totalWeight = report.categories.reduce((sum, c) => sum + c.weight, 0);
    expect(totalWeight).toBeCloseTo(1.0, 5);
  });
});

// ── Language from repoInfo ──

describe('runAnalysis – language from repoInfo', () => {
  it('unshifts repoInfo.language to the front of techStack when not already present', () => {
    const report = runAnalysis(makeRepo(), makeRepoInfo({ language: 'Kotlin' }), [], []);

    expect(report.techStack.length).toBeGreaterThanOrEqual(1);
    expect(report.techStack[0]).toEqual({ name: 'Kotlin', category: 'language' });
  });

  it('does not add repoInfo.language when it already exists in techStack (case-insensitive)', () => {
    // Provide a package.json that triggers TypeScript detection, then set language to 'typescript'
    const tree = [blob('package.json'), blob('tsconfig.json')];
    const files = [
      file(
        'package.json',
        JSON.stringify({ dependencies: {}, devDependencies: { typescript: '^5.0.0' } }),
      ),
    ];
    const report = runAnalysis(makeRepo(), makeRepoInfo({ language: 'TypeScript' }), tree, files);

    const tsItems = report.techStack.filter((t) => t.name.toLowerCase() === 'typescript');
    expect(tsItems.length).toBe(1);
  });

  it('does not add language when repoInfo.language is null', () => {
    const report = runAnalysis(makeRepo(), makeRepoInfo({ language: null }), [], []);

    // No language items added from repoInfo
    const languageItems = report.techStack.filter((t) => t.category === 'language');
    expect(languageItems.length).toBe(0);
  });

  it('handles case-insensitive matching for language dedup (e.g. "python" vs "Python")', () => {
    const tree = [blob('requirements.txt')];
    const files: FileContent[] = [];
    // dependencies analyzer detects Python from requirements.txt in tree
    const report = runAnalysis(makeRepo(), makeRepoInfo({ language: 'python' }), tree, files);

    const pythonItems = report.techStack.filter((t) => t.name.toLowerCase() === 'python');
    expect(pythonItems.length).toBe(1);
  });
});

// ── Grade assignment ──

describe('runAnalysis – grade assignment', () => {
  // Grade thresholds: A >= 85, B >= 70, C >= 55, D >= 40, F < 40

  it('assigns grade F for an empty repo (very low score)', () => {
    const report = runAnalysis(makeRepo(), makeRepoInfo(), [], []);
    // An empty repo gets a non-zero score only from "reasonable dependency count" and
    // ".gitignore not present" / "no exposed secret files" signals.
    // Should be at most D or F.
    expect(['D', 'F']).toContain(report.grade);
  });

  it('assigns grade A for a well-configured repo', () => {
    const { tree, files } = makeWellConfiguredRepo();
    const report = runAnalysis(
      makeRepo(),
      makeRepoInfo({ license: 'MIT', language: 'TypeScript' }),
      tree,
      files,
    );

    expect(report.overallScore).toBeGreaterThanOrEqual(85);
    expect(report.grade).toBe('A');
  });

  it('grade is consistent with overallScore thresholds', () => {
    const { tree, files } = makeWellConfiguredRepo();
    const report = runAnalysis(
      makeRepo(),
      makeRepoInfo({ license: 'MIT', language: 'TypeScript' }),
      tree,
      files,
    );

    const score = report.overallScore;
    const grade = report.grade;

    if (score >= 85) expect(grade).toBe('A');
    else if (score >= 70) expect(grade).toBe('B');
    else if (score >= 55) expect(grade).toBe('C');
    else if (score >= 40) expect(grade).toBe('D');
    else expect(grade).toBe('F');
  });
});

// ── Well-configured repo ──

function makeWellConfiguredRepo(): { tree: TreeEntry[]; files: FileContent[] } {
  const readmeContent = [
    '# My Project',
    '',
    '## Installation',
    '',
    'Run `npm install` to get started.',
    '',
    '## Usage',
    '',
    '```typescript',
    'import { something } from "my-project";',
    '```',
    '',
    '## Contributing',
    '',
    'See CONTRIBUTING.md for details.',
    '',
    '## License',
    '',
    'MIT',
    '',
    // Pad to exceed 500 chars
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(10),
  ].join('\n');

  const packageJson = JSON.stringify({
    name: 'my-project',
    dependencies: { react: '^18.0.0', 'react-dom': '^18.0.0' },
    devDependencies: {
      typescript: '^5.0.0',
      vitest: '^1.0.0',
      eslint: '^8.0.0',
      prettier: '^3.0.0',
    },
  });

  const ciWorkflow = [
    'name: CI',
    'on:',
    '  push:',
    '    branches: [main]',
    '  pull_request:',
    '    branches: [main]',
    'jobs:',
    '  test:',
    '    runs-on: ubuntu-latest',
    '    steps:',
    '      - uses: actions/checkout@v4',
    '      - run: npm test',
  ].join('\n');

  const deployWorkflow = [
    'name: Deploy',
    'on:',
    '  push:',
    '    tags: ["v*"]',
    'jobs:',
    '  deploy:',
    '    runs-on: ubuntu-latest',
    '    steps:',
    '      - uses: actions/checkout@v4',
    '      - run: npm run deploy',
  ].join('\n');

  const dependabotYml = [
    'version: 2',
    'updates:',
    '  - package-ecosystem: npm',
    '    directory: /',
    '    schedule:',
    '      interval: weekly',
  ].join('\n');

  const contributingContent = [
    '# Contributing',
    '',
    'Thank you for your interest in contributing to this project! ' +
      'Please read the following guidelines carefully before submitting ' +
      'any pull requests or issues. We appreciate your help in making ' +
      'this project better for everyone.',
  ].join('\n');

  const tree: TreeEntry[] = [
    blob('README.md'),
    blob('LICENSE'),
    blob('SECURITY.md'),
    blob('CONTRIBUTING.md'),
    blob('CHANGELOG.md'),
    blob('CODE_OF_CONDUCT.md'),
    blob('.gitignore'),
    blob('.editorconfig'),
    blob('tsconfig.json'),
    blob('package.json'),
    blob('package-lock.json'),
    blob('.eslintrc.json'),
    blob('.prettierrc'),
    blob('.github/dependabot.yml'),
    blob('.github/workflows/ci.yml'),
    blob('.github/workflows/deploy.yml'),
    blob('.github/ISSUE_TEMPLATE/bug_report.md'),
    blob('.github/ISSUE_TEMPLATE/feature_request.md'),
    blob('.github/PULL_REQUEST_TEMPLATE.md'),
    blob('.github/FUNDING.yml'),
    blob('.github/CODEOWNERS'),
    blob('SUPPORT.md'),
    blob('Dockerfile'),
    blob('Makefile'),
    blob('src/index.ts'),
    blob('src/app.test.ts'),
    dir('docs'),
    dir('src'),
    dir('.github'),
    dir('.github/ISSUE_TEMPLATE'),
    dir('.github/workflows'),
    dir('.husky'),
    blob('.husky/pre-commit'),
  ];

  const files: FileContent[] = [
    file('README.md', readmeContent),
    file('SECURITY.md', '# Security Policy\n\nReport vulnerabilities to security@example.com'),
    file('CONTRIBUTING.md', contributingContent),
    file('CHANGELOG.md', '# Changelog\n\n## v1.0.0\n- Initial release'),
    file('CODE_OF_CONDUCT.md', '# Code of Conduct\n\nBe nice.'),
    file('SUPPORT.md', '# Support\n\nOpen an issue for help.'),
    file('package.json', packageJson),
    file('.github/dependabot.yml', dependabotYml),
    file('.github/workflows/ci.yml', ciWorkflow),
    file('.github/workflows/deploy.yml', deployWorkflow),
    file(
      '.github/ISSUE_TEMPLATE/bug_report.md',
      '---\nname: Bug Report\nlabels: bug, good first issue\n---\n',
    ),
    file('.github/ISSUE_TEMPLATE/feature_request.md', '---\nname: Feature Request\n---\n'),
    file('.github/PULL_REQUEST_TEMPLATE.md', '## Description\n\n## Checklist\n'),
    file('.github/FUNDING.yml', 'github: test-owner'),
    file('.github/CODEOWNERS', '* @test-owner'),
    file('.eslintrc.json', '{}'),
    file('.prettierrc', '{}'),
    file('.editorconfig', 'root = true'),
    file('.husky/pre-commit', '#!/bin/sh\nnpx lint-staged'),
  ];

  return { tree, files };
}

describe('runAnalysis – well-configured repo', () => {
  const { tree, files } = makeWellConfiguredRepo();
  const report = runAnalysis(
    makeRepo(),
    makeRepoInfo({ license: 'MIT', language: 'TypeScript' }),
    tree,
    files,
  );

  it('achieves a high overall score (>= 85)', () => {
    expect(report.overallScore).toBeGreaterThanOrEqual(85);
  });

  it('earns grade A', () => {
    expect(report.grade).toBe('A');
  });

  it('has a non-empty techStack', () => {
    expect(report.techStack.length).toBeGreaterThan(0);
  });

  it('detects TypeScript in the techStack', () => {
    const ts = report.techStack.find((t) => t.name === 'TypeScript');
    expect(ts).toBeDefined();
  });

  it('detects React in the techStack', () => {
    const react = report.techStack.find((t) => t.name === 'React');
    expect(react).toBeDefined();
  });

  it('has strengths identified', () => {
    expect(report.strengths.length).toBeGreaterThan(0);
  });

  it('has minimal or no risks', () => {
    // A well-configured repo should have very few risks
    expect(report.risks.length).toBeLessThanOrEqual(2);
  });

  it('has a non-empty repoStructure (mermaid diagram)', () => {
    expect(report.repoStructure).toContain('graph TD');
  });

  it('has high documentation score', () => {
    const docCat = report.categories.find((c) => c.key === 'documentation');
    expect(docCat).toBeDefined();
    expect(docCat!.score).toBeGreaterThanOrEqual(80);
  });

  it('has high security score', () => {
    const secCat = report.categories.find((c) => c.key === 'security');
    expect(secCat).toBeDefined();
    expect(secCat!.score).toBeGreaterThanOrEqual(80);
  });

  it('has high community score', () => {
    const comCat = report.categories.find((c) => c.key === 'community');
    expect(comCat).toBeDefined();
    expect(comCat!.score).toBeGreaterThanOrEqual(80);
  });

  it('has high license score with MIT', () => {
    const licCat = report.categories.find((c) => c.key === 'license');
    expect(licCat).toBeDefined();
    expect(licCat!.score).toBe(100);
  });

  it('has a contributorScore with high score', () => {
    expect(report.contributorScore).toBeDefined();
    expect(report.contributorScore!.score).toBeGreaterThanOrEqual(70);
  });
});

// ── Partial repos and edge cases ──

describe('runAnalysis – partial and edge cases', () => {
  it('handles a repo with only a README', () => {
    const tree = [blob('README.md')];
    const files = [file('README.md', '# Hello\n\nA short readme.')];
    const report = runAnalysis(makeRepo(), makeRepoInfo(), tree, files);

    expect(report.categories).toHaveLength(8);
    const docCat = report.categories.find((c) => c.key === 'documentation');
    expect(docCat!.score).toBeGreaterThan(0);
  });

  it('detects Rust tech stack from Cargo.toml in tree', () => {
    const tree = [blob('Cargo.toml'), blob('src/main.rs')];
    const files: FileContent[] = [];
    const report = runAnalysis(makeRepo(), makeRepoInfo({ language: 'Rust' }), tree, files);

    const rustItem = report.techStack.find((t) => t.name === 'Rust');
    expect(rustItem).toBeDefined();
    // Should not have duplicates
    const rustItems = report.techStack.filter((t) => t.name === 'Rust');
    expect(rustItems.length).toBe(1);
  });

  it('detects Go tech stack from go.mod in tree', () => {
    const tree = [blob('go.mod'), blob('main.go')];
    const files: FileContent[] = [];
    const report = runAnalysis(makeRepo(), makeRepoInfo({ language: 'Go' }), tree, files);

    const goItem = report.techStack.find((t) => t.name === 'Go');
    expect(goItem).toBeDefined();
    const goItems = report.techStack.filter((t) => t.name === 'Go');
    expect(goItems.length).toBe(1);
  });

  it('detects Docker in tech stack when Dockerfile is present', () => {
    const tree = [blob('Dockerfile')];
    const report = runAnalysis(makeRepo(), makeRepoInfo(), tree, []);

    const dockerItem = report.techStack.find((t) => t.name === 'Docker');
    expect(dockerItem).toBeDefined();
  });

  it('produces a repoStructure string starting with graph TD', () => {
    const tree = [dir('src'), dir('tests'), blob('src/index.ts'), blob('tests/index.test.ts')];
    const report = runAnalysis(makeRepo(), makeRepoInfo(), tree, []);

    expect(report.repoStructure).toMatch(/^graph TD/);
    expect(report.repoStructure).toContain('src');
    expect(report.repoStructure).toContain('tests');
  });

  it('the id contains an ISO date substring', () => {
    const report = runAnalysis(makeRepo(), makeRepoInfo(), [], []);
    // The id format is "owner/repo@<ISO date>"
    const atIndex = report.id.indexOf('@');
    expect(atIndex).toBeGreaterThan(0);
    const isoStr = report.id.slice(atIndex + 1);
    const parsed = new Date(isoStr);
    expect(parsed.getTime()).not.toBeNaN();
  });

  it('assigns reasonable dependency count signal as found when no package.json exists', () => {
    // With no package.json, depCount is 0, and 0 < 200, so "Reasonable dependency count" is found
    const report = runAnalysis(makeRepo(), makeRepoInfo(), [], []);
    const depCat = report.categories.find((c) => c.key === 'dependencies');
    expect(depCat).toBeDefined();
    const reasonableSignal = depCat!.signals.find((s) => s.name === 'Reasonable dependency count');
    expect(reasonableSignal).toBeDefined();
    expect(reasonableSignal!.found).toBe(true);
  });

  it('nextSteps suggest improvements for the weakest categories', () => {
    // An empty repo should have next steps pointing to the weakest areas
    const report = runAnalysis(makeRepo(), makeRepoInfo(), [], []);

    expect(report.nextSteps.length).toBeGreaterThan(0);
    expect(report.nextSteps.length).toBeLessThanOrEqual(3);
    for (const step of report.nextSteps) {
      expect(step).toMatch(/^Add .+ to improve .+ score$/);
    }
  });
});
