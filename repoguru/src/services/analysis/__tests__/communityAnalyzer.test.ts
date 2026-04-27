import { describe, it, expect } from 'vitest';
import { analyzeCommunity } from '../communityAnalyzer';
import type { FileContent, TreeEntry } from '../../../types';

// ── Helpers ──

function blob(path: string): TreeEntry {
  return { path, mode: '100644', type: 'blob', sha: 'abc' };
}

function tree(path: string): TreeEntry {
  return { path, mode: '040000', type: 'tree', sha: 'abc' };
}

function file(path: string, content: string): FileContent {
  return { path, content, size: content.length };
}

// ── Tests ──

describe('analyzeCommunity', () => {
  it('returns score 0 for empty inputs', () => {
    const result = analyzeCommunity([], []);
    expect(result.key).toBe('community');
    expect(result.label).toBe('Community');
    expect(result.score).toBe(0);
    expect(result.weight).toBe(0.1);
    for (const s of result.signals) {
      expect(s.found).toBe(false);
    }
  });

  // ── Issue templates ──

  it('gives +20 for issue templates in .github/ISSUE_TEMPLATE/', () => {
    const treeEntries = [
      blob('.github/ISSUE_TEMPLATE/bug_report.md'),
      blob('.github/ISSUE_TEMPLATE/feature_request.md'),
    ];
    const result = analyzeCommunity([], treeEntries);
    const sig = result.signals.find((s) => s.name === 'Issue templates');
    expect(sig?.found).toBe(true);
    expect(sig?.details).toBe('2 template(s)');
    expect(result.score).toBeGreaterThanOrEqual(20);
  });

  it('counts single issue template', () => {
    const treeEntries = [blob('.github/ISSUE_TEMPLATE/bug.yml')];
    const result = analyzeCommunity([], treeEntries);
    const sig = result.signals.find((s) => s.name === 'Issue templates');
    expect(sig?.found).toBe(true);
    expect(sig?.details).toBe('1 template(s)');
  });

  it('does not count tree entries (directories) as issue templates', () => {
    const treeEntries = [tree('.github/ISSUE_TEMPLATE/subdir')];
    const result = analyzeCommunity([], treeEntries);
    const sig = result.signals.find((s) => s.name === 'Issue templates');
    expect(sig?.found).toBe(false);
  });

  it('reports 0 templates when directory is empty', () => {
    const result = analyzeCommunity([], []);
    const sig = result.signals.find((s) => s.name === 'Issue templates');
    expect(sig?.details).toBe('0 template(s)');
  });

  // ── PR template ──

  it('gives +20 for PR template (.github/PULL_REQUEST_TEMPLATE.md)', () => {
    const treeEntries = [blob('.github/PULL_REQUEST_TEMPLATE.md')];
    const result = analyzeCommunity([], treeEntries);
    const sig = result.signals.find((s) => s.name === 'PR template');
    expect(sig?.found).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(20);
  });

  it('detects lowercase PR template (.github/pull_request_template.md)', () => {
    const treeEntries = [blob('.github/pull_request_template.md')];
    const result = analyzeCommunity([], treeEntries);
    const sig = result.signals.find((s) => s.name === 'PR template');
    expect(sig?.found).toBe(true);
  });

  it('detects root-level PULL_REQUEST_TEMPLATE.md', () => {
    const treeEntries = [blob('PULL_REQUEST_TEMPLATE.md')];
    const result = analyzeCommunity([], treeEntries);
    const sig = result.signals.find((s) => s.name === 'PR template');
    expect(sig?.found).toBe(true);
  });

  // ── Code of Conduct ──

  it('gives +20 for CODE_OF_CONDUCT.md', () => {
    const files = [file('CODE_OF_CONDUCT.md', 'Be nice')];
    const treeEntries = [blob('CODE_OF_CONDUCT.md')];
    const result = analyzeCommunity(files, treeEntries);
    const sig = result.signals.find((s) => s.name === 'Code of Conduct');
    expect(sig?.found).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(20);
  });

  it('detects CODE_OF_CONDUCT.md in .github/', () => {
    const files = [file('.github/CODE_OF_CONDUCT.md', 'CoC')];
    const treeEntries = [blob('.github/CODE_OF_CONDUCT.md')];
    const result = analyzeCommunity(files, treeEntries);
    const sig = result.signals.find((s) => s.name === 'Code of Conduct');
    expect(sig?.found).toBe(true);
  });

  it('detects CODE_OF_CONDUCT.md from tree only (no file content)', () => {
    const treeEntries = [blob('CODE_OF_CONDUCT.md')];
    const result = analyzeCommunity([], treeEntries);
    const sig = result.signals.find((s) => s.name === 'Code of Conduct');
    expect(sig?.found).toBe(true);
  });

  // ── CONTRIBUTING.md ──

  it('gives +20 for CONTRIBUTING.md', () => {
    const files = [file('CONTRIBUTING.md', 'How to contribute')];
    const treeEntries = [blob('CONTRIBUTING.md')];
    const result = analyzeCommunity(files, treeEntries);
    const sig = result.signals.find((s) => s.name === 'CONTRIBUTING.md');
    expect(sig?.found).toBe(true);
  });

  it('detects CONTRIBUTING.md from tree only', () => {
    const treeEntries = [blob('CONTRIBUTING.md')];
    const result = analyzeCommunity([], treeEntries);
    const sig = result.signals.find((s) => s.name === 'CONTRIBUTING.md');
    expect(sig?.found).toBe(true);
  });

  // ── Funding ──

  it('gives +10 for .github/FUNDING.yml', () => {
    const files = [file('.github/FUNDING.yml', 'github: [sponsor]')];
    const treeEntries = [blob('.github/FUNDING.yml')];
    const result = analyzeCommunity(files, treeEntries);
    const sig = result.signals.find((s) => s.name === 'Funding configuration');
    expect(sig?.found).toBe(true);
  });

  it('detects FUNDING.yml from tree only', () => {
    const treeEntries = [blob('.github/FUNDING.yml')];
    const result = analyzeCommunity([], treeEntries);
    const sig = result.signals.find((s) => s.name === 'Funding configuration');
    expect(sig?.found).toBe(true);
  });

  // ── SUPPORT.md ──

  it('gives +10 for SUPPORT.md', () => {
    const files = [file('SUPPORT.md', 'Get help here')];
    const treeEntries = [blob('SUPPORT.md')];
    const result = analyzeCommunity(files, treeEntries);
    const sig = result.signals.find((s) => s.name === 'SUPPORT.md');
    expect(sig?.found).toBe(true);
  });

  it('detects .github/SUPPORT.md', () => {
    const files = [file('.github/SUPPORT.md', 'Support')];
    const treeEntries = [blob('.github/SUPPORT.md')];
    const result = analyzeCommunity(files, treeEntries);
    const sig = result.signals.find((s) => s.name === 'SUPPORT.md');
    expect(sig?.found).toBe(true);
  });

  it('detects SUPPORT.md from tree only', () => {
    const treeEntries = [blob('SUPPORT.md')];
    const result = analyzeCommunity([], treeEntries);
    const sig = result.signals.find((s) => s.name === 'SUPPORT.md');
    expect(sig?.found).toBe(true);
  });

  // ── Full score ──

  it('returns score 100 for full community setup', () => {
    const files = [
      file('CODE_OF_CONDUCT.md', 'Be respectful'),
      file('CONTRIBUTING.md', 'How to contribute'),
      file('.github/FUNDING.yml', 'github: [me]'),
      file('SUPPORT.md', 'Get help'),
    ];
    const treeEntries = [
      blob('.github/ISSUE_TEMPLATE/bug_report.md'),
      blob('.github/PULL_REQUEST_TEMPLATE.md'),
      blob('CODE_OF_CONDUCT.md'),
      blob('CONTRIBUTING.md'),
      blob('.github/FUNDING.yml'),
      blob('SUPPORT.md'),
    ];
    const result = analyzeCommunity(files, treeEntries);
    // 20 + 20 + 20 + 20 + 10 + 10 = 100
    expect(result.score).toBe(100);
  });

  it('caps score at 100', () => {
    const files = [
      file('CODE_OF_CONDUCT.md', 'CoC'),
      file('.github/CODE_OF_CONDUCT.md', 'CoC'),
      file('CONTRIBUTING.md', 'c'),
      file('.github/FUNDING.yml', 'f'),
      file('SUPPORT.md', 's'),
      file('.github/SUPPORT.md', 's'),
    ];
    const treeEntries = [
      blob('.github/ISSUE_TEMPLATE/bug.md'),
      blob('.github/PULL_REQUEST_TEMPLATE.md'),
      blob('CODE_OF_CONDUCT.md'),
      blob('CONTRIBUTING.md'),
      blob('.github/FUNDING.yml'),
      blob('SUPPORT.md'),
    ];
    const result = analyzeCommunity(files, treeEntries);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});
