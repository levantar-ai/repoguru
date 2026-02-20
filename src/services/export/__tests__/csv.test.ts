import { describe, it, expect } from 'vitest';
import { reportToCsv, orgScanToCsv } from '../csv';
import type {
  AnalysisReport,
  CategoryResult,
  LightAnalysisReport,
  OrgScanResult,
  RepoInfo,
} from '../../../types';

/** Builds a minimal RepoInfo for test fixtures. */
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

/** Builds a minimal CategoryResult. */
function makeCategory(
  key: CategoryResult['key'],
  label: string,
  score: number,
  signals: { name: string; found: boolean }[] = [],
): CategoryResult {
  return {
    key,
    label,
    score,
    weight: 0.15,
    signals: signals.map((s) => ({ name: s.name, found: s.found })),
  };
}

/** Builds a minimal AnalysisReport for test fixtures. */
function makeReport(overrides: Partial<AnalysisReport> = {}): AnalysisReport {
  return {
    id: 'test-id',
    repo: { owner: 'testowner', repo: 'testrepo' },
    repoInfo: makeRepoInfo(),
    categories: [
      makeCategory('documentation', 'Documentation', 80, [
        { name: 'README exists', found: true },
        { name: 'CONTRIBUTING.md', found: false },
      ]),
      makeCategory('security', 'Security', 65, [{ name: 'SECURITY.md', found: true }]),
      makeCategory('cicd', 'CI/CD', 70, []),
      makeCategory('dependencies', 'Dependencies', 55, []),
      makeCategory('codeQuality', 'Code Quality', 75, []),
      makeCategory('license', 'License', 90, [{ name: 'License file exists', found: true }]),
      makeCategory('community', 'Community', 50, [{ name: 'Code of conduct', found: false }]),
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

/** Builds a minimal LightAnalysisReport for org scan tests. */
function makeLightReport(
  owner: string,
  repo: string,
  overallScore: number,
  grade: 'A' | 'B' | 'C' | 'D' | 'F',
): LightAnalysisReport {
  return {
    repo: { owner, repo },
    repoInfo: makeRepoInfo({ owner, repo }),
    grade,
    overallScore,
    categories: [
      makeCategory('documentation', 'Documentation', 80),
      makeCategory('security', 'Security', 70),
      makeCategory('cicd', 'CI/CD', 60),
      makeCategory('dependencies', 'Dependencies', 50),
      makeCategory('codeQuality', 'Code Quality', 75),
      makeCategory('license', 'License', 90),
      makeCategory('community', 'Community', 55),
    ],
    techStack: [],
    treeEntryCount: 100,
    analyzedAt: '2024-06-15T10:00:00Z',
  };
}

describe('reportToCsv', () => {
  it('starts with a header row containing expected columns', () => {
    const csv = reportToCsv(makeReport());
    const lines = csv.split('\n');
    expect(lines[0]).toBe('Category,Score,Weight,Grade,Signals Found,Signals Missing');
  });

  it('produces one data row per category', () => {
    const report = makeReport();
    const csv = reportToCsv(report);
    const lines = csv.split('\n');
    // Lines: 1 header + 7 categories + 1 empty + 1 summary = 10
    const dataLines = lines.slice(1, 1 + report.categories.length);
    expect(dataLines).toHaveLength(report.categories.length);
  });

  it('includes a summary row with the overall score and grade', () => {
    const report = makeReport({ overallScore: 72, grade: 'B' });
    const csv = reportToCsv(report);
    expect(csv).toContain('Overall,72,,B,,');
  });

  it('lists found signals separated by semicolons', () => {
    const csv = reportToCsv(makeReport());
    // Documentation category has "README exists" as found
    const lines = csv.split('\n');
    const docLine = lines[1]; // first data row = Documentation
    expect(docLine).toContain('README exists');
  });

  it('lists missing signals separated by semicolons', () => {
    const csv = reportToCsv(makeReport());
    const lines = csv.split('\n');
    const docLine = lines[1]; // Documentation row
    expect(docLine).toContain('CONTRIBUTING.md');
  });

  it('wraps values containing commas in double quotes (CSV escaping)', () => {
    const report = makeReport({
      categories: [
        makeCategory('documentation', 'Docs, Guides & Tutorials', 80, [
          { name: 'README, intro file', found: true },
        ]),
      ],
    });
    const csv = reportToCsv(report);
    // The label "Docs, Guides & Tutorials" should be quoted
    expect(csv).toContain('"Docs, Guides & Tutorials"');
    // The signal "README, intro file" should also be quoted
    expect(csv).toContain('"README, intro file"');
  });

  it('escapes double quotes inside values by doubling them', () => {
    const report = makeReport({
      categories: [
        makeCategory('documentation', 'Documentation', 80, [
          { name: 'File "important"', found: true },
        ]),
      ],
    });
    const csv = reportToCsv(report);
    // Should produce: "File ""important"""
    expect(csv).toContain('"File ""important"""');
  });

  it('has correct grade for each category score', () => {
    const report = makeReport();
    const csv = reportToCsv(report);
    const lines = csv.split('\n');
    // Documentation score=80 -> grade B (80 >= 70, < 85)
    expect(lines[1]).toContain(',B,');
    // License score=90 -> grade A (>= 85)
    const licenseLine = lines.find((l) => l.startsWith('License'));
    expect(licenseLine).toContain(',A,');
  });
});

describe('orgScanToCsv', () => {
  function makeOrgScanResult(): OrgScanResult {
    return {
      org: 'testorg',
      repos: [
        makeLightReport('testorg', 'repo-a', 85, 'A'),
        makeLightReport('testorg', 'repo-b', 60, 'C'),
      ],
      averageScore: 72.5,
      averageGrade: 'B',
      scanDate: '2024-06-15T10:00:00Z',
      categoryAverages: {
        documentation: 80,
        security: 70,
        cicd: 60,
        dependencies: 50,
        codeQuality: 75,
        license: 90,
        community: 55,
      },
    };
  }

  it('starts with a header containing Repo, Score, Grade, and category names', () => {
    const csv = orgScanToCsv(makeOrgScanResult());
    const header = csv.split('\n')[0];
    expect(header).toContain('Repo');
    expect(header).toContain('Score');
    expect(header).toContain('Grade');
    expect(header).toContain('Documentation');
    expect(header).toContain('Security');
    expect(header).toContain('CI/CD');
  });

  it('includes one row per repo', () => {
    const result = makeOrgScanResult();
    const csv = orgScanToCsv(result);
    const lines = csv.split('\n');
    // Header + 2 repo rows + 1 empty + 1 average = 5
    expect(lines[1]).toContain('testorg/repo-a');
    expect(lines[2]).toContain('testorg/repo-b');
  });

  it('includes an average row at the end', () => {
    const csv = orgScanToCsv(makeOrgScanResult());
    const lines = csv.split('\n');
    const lastLine = lines[lines.length - 1];
    expect(lastLine).toContain('Average');
    expect(lastLine).toContain('73'); // Math.round(72.5) = 73 (note: 72.5 rounds to 73)
    expect(lastLine).toContain('B');
  });

  it('includes category scores for each repo row', () => {
    const csv = orgScanToCsv(makeOrgScanResult());
    const lines = csv.split('\n');
    // repo-a row should contain its category scores
    const repoALine = lines[1];
    expect(repoALine).toContain('85'); // overall score
    expect(repoALine).toContain('A'); // grade
  });

  it('includes category averages in the average row', () => {
    const csv = orgScanToCsv(makeOrgScanResult());
    const lines = csv.split('\n');
    const avgLine = lines[lines.length - 1];
    // categoryAverages: documentation=80, security=70, cicd=60, ...
    expect(avgLine).toContain('80');
    expect(avgLine).toContain('70');
    expect(avgLine).toContain('60');
  });

  it('handles repos with missing categories gracefully', () => {
    const result: OrgScanResult = {
      org: 'testorg',
      repos: [
        {
          ...makeLightReport('testorg', 'sparse-repo', 40, 'D'),
          categories: [makeCategory('documentation', 'Documentation', 60)],
        },
      ],
      averageScore: 40,
      averageGrade: 'D',
      scanDate: '2024-06-15T10:00:00Z',
      categoryAverages: {
        documentation: 60,
        security: 0,
        cicd: 0,
        dependencies: 0,
        codeQuality: 0,
        license: 0,
        community: 0,
      },
    };
    const csv = orgScanToCsv(result);
    const lines = csv.split('\n');
    expect(lines[1]).toContain('sparse-repo');
    expect(lines[1]).toContain('40');
  });
});
