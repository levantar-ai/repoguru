import { describe, it, expect } from 'vitest';
import { reportToMarkdown } from '../markdown';
import type { AnalysisReport, CategoryResult, RepoInfo } from '../../../types';

function makeRepoInfo(overrides: Partial<RepoInfo> = {}): RepoInfo {
  return {
    owner: 'testowner',
    repo: 'testrepo',
    defaultBranch: 'main',
    description: 'A test repository description',
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

function makeCategory(key: CategoryResult['key'], label: string, score: number): CategoryResult {
  return {
    key,
    label,
    score,
    weight: 0.15,
    signals: [],
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
    ],
    overallScore: 72,
    grade: 'B',
    techStack: [{ name: 'TypeScript', category: 'language' }],
    strengths: ['Great documentation', 'Active maintenance'],
    risks: ['No SECURITY.md found'],
    nextSteps: ['Add a security policy'],
    repoStructure: 'graph TD\n  ROOT["/"]\n',
    analyzedAt: '2024-06-15T10:00:00Z',
    fileCount: 100,
    treeEntryCount: 150,
    ...overrides,
  };
}

describe('reportToMarkdown', () => {
  it('starts with "# Repo Guru Report:" followed by the repo name', () => {
    const md = reportToMarkdown(makeReport());
    expect(md).toMatch(/^# Repo Guru Report: testowner\/testrepo/);
  });

  it('contains grade and score', () => {
    const md = reportToMarkdown(makeReport({ overallScore: 72, grade: 'B' }));
    expect(md).toContain('**Grade: B**');
    expect(md).toContain('72/100');
  });

  it('contains grade and score for different values', () => {
    const md = reportToMarkdown(makeReport({ overallScore: 91, grade: 'A' }));
    expect(md).toContain('**Grade: A**');
    expect(md).toContain('91/100');
  });

  it('contains the category table header', () => {
    const md = reportToMarkdown(makeReport());
    expect(md).toContain('| Category | Score | Grade |');
    expect(md).toContain('|---|---|---|');
  });

  it('includes each category row in the table', () => {
    const md = reportToMarkdown(makeReport());
    expect(md).toContain('| Documentation | 80/100 | B |');
    expect(md).toContain('| Security | 65/100 | C |');
    expect(md).toContain('| CI/CD | 70/100 | B |');
  });

  it('assigns correct grade letters in category rows', () => {
    const report = makeReport({
      categories: [
        makeCategory('documentation', 'Documentation', 90), // A
        makeCategory('security', 'Security', 42), // D
        makeCategory('codeQuality', 'Code Quality', 30), // F
        makeCategory('cicd', 'CI/CD', 55), // C
      ],
    });
    const md = reportToMarkdown(report);
    expect(md).toContain('| Documentation | 90/100 | A |');
    expect(md).toContain('| Security | 42/100 | D |');
    expect(md).toContain('| Code Quality | 30/100 | F |');
    expect(md).toContain('| CI/CD | 55/100 | C |');
  });

  it('contains strengths section when strengths are present', () => {
    const md = reportToMarkdown(makeReport({ strengths: ['Good docs', 'Fast CI'] }));
    expect(md).toContain('## Strengths');
    expect(md).toContain('- Good docs');
    expect(md).toContain('- Fast CI');
  });

  it('omits strengths section when strengths array is empty', () => {
    const md = reportToMarkdown(makeReport({ strengths: [] }));
    expect(md).not.toContain('## Strengths');
  });

  it('contains risks section when risks are present', () => {
    const md = reportToMarkdown(makeReport({ risks: ['Missing license'] }));
    expect(md).toContain('## Risks');
    expect(md).toContain('- Missing license');
  });

  it('omits risks section when risks array is empty', () => {
    const md = reportToMarkdown(makeReport({ risks: [] }));
    expect(md).not.toContain('## Risks');
  });

  it('contains next steps section when present', () => {
    const md = reportToMarkdown(makeReport({ nextSteps: ['Add tests', 'Fix linting'] }));
    expect(md).toContain('## Next Steps');
    expect(md).toContain('- Add tests');
    expect(md).toContain('- Fix linting');
  });

  it('omits next steps section when array is empty', () => {
    const md = reportToMarkdown(makeReport({ nextSteps: [] }));
    expect(md).not.toContain('## Next Steps');
  });

  it('contains AI insights section when llmInsights is provided', () => {
    const md = reportToMarkdown(
      makeReport({
        llmInsights: {
          summary: 'This repository is well maintained.',
          risks: ['Dependency outdated'],
          recommendations: ['Update Node version'],
          generatedAt: '2024-06-15T12:00:00Z',
        },
      }),
    );
    expect(md).toContain('## AI Insights');
    expect(md).toContain('This repository is well maintained.');
    expect(md).toContain('### AI-Identified Risks');
    expect(md).toContain('- Dependency outdated');
    expect(md).toContain('### AI Recommendations');
    expect(md).toContain('- Update Node version');
  });

  it('omits AI insights section when llmInsights is undefined', () => {
    const md = reportToMarkdown(makeReport({ llmInsights: undefined }));
    expect(md).not.toContain('## AI Insights');
    expect(md).not.toContain('### AI-Identified Risks');
    expect(md).not.toContain('### AI Recommendations');
  });

  it('renders AI insights without risks when risks array is empty', () => {
    const md = reportToMarkdown(
      makeReport({
        llmInsights: {
          summary: 'All clear.',
          risks: [],
          recommendations: ['Keep it up'],
          generatedAt: '2024-06-15T12:00:00Z',
        },
      }),
    );
    expect(md).toContain('## AI Insights');
    expect(md).not.toContain('### AI-Identified Risks');
    expect(md).toContain('### AI Recommendations');
  });

  it('renders AI insights without recommendations when array is empty', () => {
    const md = reportToMarkdown(
      makeReport({
        llmInsights: {
          summary: 'Needs work.',
          risks: ['Critical issue'],
          recommendations: [],
          generatedAt: '2024-06-15T12:00:00Z',
        },
      }),
    );
    expect(md).toContain('### AI-Identified Risks');
    expect(md).not.toContain('### AI Recommendations');
  });

  it('ends with an attribution line', () => {
    const md = reportToMarkdown(makeReport());
    expect(md).toContain('*Generated by [Repo Guru]');
  });

  it('includes the description as a blockquote when present', () => {
    const md = reportToMarkdown(makeReport());
    expect(md).toContain('> A test repository description');
  });

  it('omits the description blockquote when description is empty', () => {
    const md = reportToMarkdown(makeReport({ repoInfo: makeRepoInfo({ description: '' }) }));
    expect(md).not.toContain('> ');
  });

  it('includes tech stack when present', () => {
    const md = reportToMarkdown(
      makeReport({
        techStack: [
          { name: 'TypeScript', category: 'language' },
          { name: 'React', category: 'framework' },
        ],
      }),
    );
    expect(md).toContain('**Tech Stack:** TypeScript, React');
  });

  it('omits tech stack section when array is empty', () => {
    const md = reportToMarkdown(makeReport({ techStack: [] }));
    expect(md).not.toContain('**Tech Stack:**');
  });
});
