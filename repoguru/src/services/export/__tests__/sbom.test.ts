import { describe, it, expect } from 'vitest';
import { generateSbom, sbomToJson } from '../sbom';
import type { AnalysisReport, CategoryResult, RepoInfo } from '../../../types';

// ── Test Helpers ──

function makeRepoInfo(overrides: Partial<RepoInfo> = {}): RepoInfo {
  return {
    owner: 'testowner',
    repo: 'testrepo',
    defaultBranch: 'main',
    description: 'A test repository',
    stars: 42,
    forks: 5,
    openIssues: 3,
    license: 'MIT',
    language: 'TypeScript',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-06-01T00:00:00Z',
    topics: ['testing'],
    archived: false,
    size: 1024,
    ...overrides,
  };
}

function makeCategory(
  key: CategoryResult['key'],
  label: string,
  score: number,
  signals: { name: string; found: boolean; details?: string }[] = [],
): CategoryResult {
  return {
    key,
    label,
    score,
    weight: 0.15,
    signals: signals.map((s) => ({ name: s.name, found: s.found, details: s.details })),
  };
}

function makeReport(overrides: Partial<AnalysisReport> = {}): AnalysisReport {
  return {
    id: 'test-id',
    repo: { owner: 'testowner', repo: 'testrepo' },
    repoInfo: makeRepoInfo(),
    categories: [
      makeCategory('documentation', 'Documentation', 80),
      makeCategory('security', 'Security', 65),
      makeCategory('cicd', 'CI/CD', 70),
      makeCategory('dependencies', 'Dependencies', 55),
      makeCategory('codeQuality', 'Code Quality', 75),
      makeCategory('license', 'License', 90),
      makeCategory('community', 'Community', 50),
    ],
    overallScore: 72,
    grade: 'B',
    techStack: [{ name: 'TypeScript', category: 'language' }],
    strengths: ['Good documentation'],
    risks: ['Low community score'],
    nextSteps: ['Add contributing guide'],
    repoStructure: 'graph TD\n  ROOT["/"]\n',
    analyzedAt: '2024-06-15T10:00:00Z',
    fileCount: 100,
    treeEntryCount: 150,
    ...overrides,
  };
}

// ── Tests ──

describe('generateSbom', () => {
  it('returns a proper CycloneDX structure', () => {
    const sbom = generateSbom(makeReport());
    expect(sbom.bomFormat).toBe('CycloneDX');
    expect(sbom.specVersion).toBe('1.5');
    expect(sbom.version).toBe(1);
    expect(sbom.metadata).toBeDefined();
    expect(sbom.components).toBeDefined();
    expect(Array.isArray(sbom.components)).toBe(true);
  });

  it('has a serial number in UUID format', () => {
    const sbom = generateSbom(makeReport());
    // Format: urn:uuid:xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    expect(sbom.serialNumber).toMatch(
      /^urn:uuid:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('includes correct repo name and version in metadata', () => {
    const sbom = generateSbom(makeReport());
    expect(sbom.metadata.component.name).toBe('testowner/testrepo');
    expect(sbom.metadata.component.type).toBe('application');
    // No branch specified, so falls back to defaultBranch
    expect(sbom.metadata.component.version).toBe('main');
  });

  it('uses the explicit branch when provided', () => {
    const report = makeReport({
      repo: { owner: 'testowner', repo: 'testrepo', branch: 'develop' },
    });
    const sbom = generateSbom(report);
    expect(sbom.metadata.component.version).toBe('develop');
  });

  it('includes the analyzedAt timestamp in metadata', () => {
    const sbom = generateSbom(makeReport());
    expect(sbom.metadata.timestamp).toBe('2024-06-15T10:00:00Z');
  });

  it('includes Repo Guru tool info in metadata', () => {
    const sbom = generateSbom(makeReport());
    expect(sbom.metadata.tools).toHaveLength(1);
    expect(sbom.metadata.tools[0].vendor).toBe('Repo Guru');
    expect(sbom.metadata.tools[0].name).toBe('Repo Guru Analyzer');
    expect(sbom.metadata.tools[0].version).toBe('1.0.0');
  });

  it('maps framework tech stack items to framework component type', () => {
    const report = makeReport({
      techStack: [{ name: 'React', category: 'framework' }],
    });
    const sbom = generateSbom(report);
    const reactComponent = sbom.components.find((c) => c.name === 'React');
    expect(reactComponent).toBeDefined();
    expect(reactComponent!.type).toBe('framework');
    expect(reactComponent!.group).toBe('framework');
  });

  it('maps platform tech stack items to application component type', () => {
    const report = makeReport({
      techStack: [{ name: 'Docker', category: 'platform' }],
    });
    const sbom = generateSbom(report);
    const dockerComponent = sbom.components.find((c) => c.name === 'Docker');
    expect(dockerComponent).toBeDefined();
    expect(dockerComponent!.type).toBe('application');
    expect(dockerComponent!.group).toBe('platform');
  });

  it('maps language, tool, and database tech stack items to library component type', () => {
    const report = makeReport({
      techStack: [
        { name: 'TypeScript', category: 'language' },
        { name: 'ESLint', category: 'tool' },
        { name: 'PostgreSQL', category: 'database' },
      ],
    });
    const sbom = generateSbom(report);

    const ts = sbom.components.find((c) => c.name === 'TypeScript');
    expect(ts!.type).toBe('library');
    expect(ts!.group).toBe('language');

    const eslint = sbom.components.find((c) => c.name === 'ESLint');
    expect(eslint!.type).toBe('library');
    expect(eslint!.group).toBe('tool');

    const pg = sbom.components.find((c) => c.name === 'PostgreSQL');
    expect(pg!.type).toBe('library');
    expect(pg!.group).toBe('database');
  });

  it('adds components from "Dependency manifest" signal details', () => {
    const report = makeReport({
      techStack: [],
      categories: [
        makeCategory('dependencies', 'Dependencies', 80, [
          { name: 'Dependency manifest', found: true, details: 'package.json, requirements.txt' },
        ]),
      ],
    });
    const sbom = generateSbom(report);
    const names = sbom.components.map((c) => c.name);
    expect(names).toContain('package.json');
    expect(names).toContain('requirements.txt');
  });

  it('adds components from "Lockfile present" signal details', () => {
    const report = makeReport({
      techStack: [],
      categories: [
        makeCategory('dependencies', 'Dependencies', 80, [
          { name: 'Lockfile present', found: true, details: 'package-lock.json, yarn.lock' },
        ]),
      ],
    });
    const sbom = generateSbom(report);
    const names = sbom.components.map((c) => c.name);
    expect(names).toContain('package-lock.json');
    expect(names).toContain('yarn.lock');
  });

  it('deduplicates components with the same name', () => {
    const report = makeReport({
      techStack: [],
      categories: [
        makeCategory('dependencies', 'Dependencies', 80, [
          { name: 'Dependency manifest', found: true, details: 'package.json' },
          { name: 'Lockfile present', found: true, details: 'package.json' },
        ]),
      ],
    });
    const sbom = generateSbom(report);
    const packageJsonComponents = sbom.components.filter((c) => c.name === 'package.json');
    expect(packageJsonComponents).toHaveLength(1);
  });

  it('produces no components when tech stack is empty and no dependency signals exist', () => {
    const report = makeReport({
      techStack: [],
      categories: [makeCategory('dependencies', 'Dependencies', 0, [])],
    });
    const sbom = generateSbom(report);
    expect(sbom.components).toHaveLength(0);
  });

  it('assigns bom-ref with sanitized names for tech stack components', () => {
    const report = makeReport({
      techStack: [{ name: 'Node.js', category: 'platform' }],
    });
    const sbom = generateSbom(report);
    const nodeComponent = sbom.components.find((c) => c.name === 'Node.js');
    expect(nodeComponent).toBeDefined();
    expect(nodeComponent!['bom-ref']).toBe('techstack-node-js');
  });

  it('assigns bom-ref with manifest- prefix for dependency manifest components', () => {
    const report = makeReport({
      techStack: [],
      categories: [
        makeCategory('dependencies', 'Dependencies', 80, [
          { name: 'Dependency manifest', found: true, details: 'package.json' },
        ]),
      ],
    });
    const sbom = generateSbom(report);
    const pkgComponent = sbom.components.find((c) => c.name === 'package.json');
    expect(pkgComponent!['bom-ref']).toBe('manifest-package-json');
  });

  it('assigns bom-ref with lockfile- prefix for lockfile components', () => {
    const report = makeReport({
      techStack: [],
      categories: [
        makeCategory('dependencies', 'Dependencies', 80, [
          { name: 'Lockfile present', found: true, details: 'yarn.lock' },
        ]),
      ],
    });
    const sbom = generateSbom(report);
    const lockComponent = sbom.components.find((c) => c.name === 'yarn.lock');
    expect(lockComponent!['bom-ref']).toBe('lockfile-yarn-lock');
  });
});

describe('sbomToJson', () => {
  it('returns a valid JSON string', () => {
    const json = sbomToJson(makeReport());
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it('parses back to an object matching generateSbom output', () => {
    const report = makeReport();
    const json = sbomToJson(report);
    const parsed = JSON.parse(json);
    expect(parsed.bomFormat).toBe('CycloneDX');
    expect(parsed.specVersion).toBe('1.5');
    expect(parsed.version).toBe(1);
    expect(parsed.metadata).toBeDefined();
    expect(parsed.components).toBeDefined();
  });

  it('produces formatted JSON with indentation', () => {
    const json = sbomToJson(makeReport());
    // JSON.stringify with indent 2 produces newlines
    expect(json).toContain('\n');
    expect(json).toContain('  ');
  });
});
