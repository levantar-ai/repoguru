import { describe, it, expect } from 'vitest';
import { analyzeContributorFriendliness } from '../contributorAnalyzer';
import type { FileContent, TreeEntry, RepoInfo } from '../../../types';

function blob(path: string): TreeEntry {
  return { path, mode: '100644', type: 'blob', sha: 'abc' };
}

function file(path: string, content: string): FileContent {
  return { path, content, size: content.length };
}

const baseRepoInfo: RepoInfo = {
  owner: 'test',
  repo: 'test',
  defaultBranch: 'main',
  description: '',
  stars: 0,
  forks: 0,
  openIssues: 0,
  license: null,
  language: null,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  topics: [],
  archived: false,
  size: 0,
};

describe('analyzeContributorFriendliness', () => {
  it('returns score 0 for empty repo', () => {
    const result = analyzeContributorFriendliness([], [], baseRepoInfo);
    expect(result.score).toBe(0);
    expect(result.signals.every((s) => !s.found)).toBe(true);
  });

  it('scores CONTRIBUTING.md exists', () => {
    const files = [file('CONTRIBUTING.md', 'Short')];
    const treeEntries = [blob('CONTRIBUTING.md')];
    const result = analyzeContributorFriendliness(files, treeEntries, baseRepoInfo);
    expect(result.score).toBeGreaterThanOrEqual(12);
    expect(result.signals.find((s) => s.name === 'CONTRIBUTING.md exists')?.found).toBe(true);
  });

  it('scores substantial CONTRIBUTING.md', () => {
    const content = 'x'.repeat(300);
    const files = [file('CONTRIBUTING.md', content)];
    const treeEntries = [blob('CONTRIBUTING.md')];
    const result = analyzeContributorFriendliness(files, treeEntries, baseRepoInfo);
    expect(result.score).toBeGreaterThanOrEqual(20); // 12 + 8
  });

  it('scores issue templates', () => {
    const treeEntries = [
      blob('.github/ISSUE_TEMPLATE/bug_report.yml'),
      blob('.github/ISSUE_TEMPLATE/feature_request.yml'),
    ];
    const result = analyzeContributorFriendliness([], treeEntries, baseRepoInfo);
    expect(result.signals.find((s) => s.name === 'Issue templates')?.found).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(17); // 12 + 5 for >=2
  });

  it('scores PR template', () => {
    const treeEntries = [blob('.github/PULL_REQUEST_TEMPLATE.md')];
    const result = analyzeContributorFriendliness([], treeEntries, baseRepoInfo);
    expect(result.signals.find((s) => s.name === 'PR template')?.found).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(12);
  });

  it('scores Code of Conduct', () => {
    const files = [file('CODE_OF_CONDUCT.md', 'Be nice')];
    const result = analyzeContributorFriendliness(files, [], baseRepoInfo);
    expect(result.signals.find((s) => s.name === 'Code of Conduct')?.found).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(10);
  });

  it('scores good first issue in templates', () => {
    const files = [
      file('.github/ISSUE_TEMPLATE/bug.yml', 'labels: good first issue\nother content'),
    ];
    const treeEntries = [blob('.github/ISSUE_TEMPLATE/bug.yml')];
    const result = analyzeContributorFriendliness(files, treeEntries, baseRepoInfo);
    expect(
      result.signals.find((s) => s.name === 'Good first issue label in templates')?.found,
    ).toBe(true);
  });

  it('scores Contributing section in README', () => {
    const files = [file('README.md', '# My App\n\n## Contributing\n\nPlease help!')];
    const result = analyzeContributorFriendliness(files, [], baseRepoInfo);
    expect(result.signals.find((s) => s.name === 'README has Contributing section')?.found).toBe(
      true,
    );
  });

  it('scores setup instructions in README', () => {
    const files = [file('README.md', '# My App\n\n## Getting Started\n\nnpm install')];
    const result = analyzeContributorFriendliness(files, [], baseRepoInfo);
    expect(result.signals.find((s) => s.name === 'Setup instructions in README')?.found).toBe(true);
  });

  it('scores funding configured', () => {
    const files = [file('.github/FUNDING.yml', 'github: testuser')];
    const treeEntries = [blob('.github/FUNDING.yml')];
    const result = analyzeContributorFriendliness(files, treeEntries, baseRepoInfo);
    expect(result.signals.find((s) => s.name === 'Funding configured')?.found).toBe(true);
  });

  it('scores SUPPORT.md', () => {
    const files = [file('SUPPORT.md', 'Get help here')];
    const treeEntries = [blob('SUPPORT.md')];
    const result = analyzeContributorFriendliness(files, treeEntries, baseRepoInfo);
    expect(result.signals.find((s) => s.name === 'SUPPORT.md')?.found).toBe(true);
  });

  it('builds readiness checklist', () => {
    const result = analyzeContributorFriendliness([], [], baseRepoInfo);
    expect(result.readinessChecklist.length).toBe(9);
    expect(result.readinessChecklist[0]).toHaveProperty('label');
    expect(result.readinessChecklist[0]).toHaveProperty('passed');
    expect(result.readinessChecklist[0]).toHaveProperty('description');
  });

  it('caps score at 100', () => {
    const content = 'x'.repeat(300);
    const readme =
      '# App\n\n## Install\n\nnpm i\n\n## Contributing\n\nHelp us\n\n## Setup\n\nRun it';
    const files = [
      file('CONTRIBUTING.md', content),
      file('CODE_OF_CONDUCT.md', 'Be nice'),
      file('.github/FUNDING.yml', 'github: user'),
      file('SUPPORT.md', 'Help'),
      file('README.md', readme),
      file('.github/ISSUE_TEMPLATE/bug.yml', 'labels: good-first-issue'),
    ];
    const treeEntries = [
      blob('CONTRIBUTING.md'),
      blob('CODE_OF_CONDUCT.md'),
      blob('.github/FUNDING.yml'),
      blob('SUPPORT.md'),
      blob('README.md'),
      blob('.github/ISSUE_TEMPLATE/bug.yml'),
      blob('.github/ISSUE_TEMPLATE/feature.yml'),
      blob('.github/PULL_REQUEST_TEMPLATE.md'),
    ];
    const result = analyzeContributorFriendliness(files, treeEntries, baseRepoInfo);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.score).toBeGreaterThanOrEqual(90);
  });
});
