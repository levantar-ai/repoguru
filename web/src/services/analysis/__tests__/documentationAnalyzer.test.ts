import { describe, it, expect } from 'vitest';
import { analyzeDocumentation } from '../documentationAnalyzer';
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

describe('analyzeDocumentation', () => {
  it('returns score 0 and key metadata for empty inputs', () => {
    const result = analyzeDocumentation([], []);
    expect(result.key).toBe('documentation');
    expect(result.label).toBe('Documentation');
    expect(result.score).toBe(0);
    expect(result.weight).toBe(0.15);
    expect(result.signals.length).toBeGreaterThan(0);
    // Every signal should be found=false
    for (const s of result.signals) {
      expect(s.found).toBe(false);
    }
  });

  it('gives +25 when README.md exists', () => {
    const files = [file('README.md', 'Hello')];
    const treeEntries = [blob('README.md')];
    const result = analyzeDocumentation(files, treeEntries);
    expect(result.score).toBeGreaterThanOrEqual(25);
    const sig = result.signals.find((s) => s.name === 'README exists');
    expect(sig?.found).toBe(true);
  });

  it('gives +20 for substantial README (>500 chars)', () => {
    const longContent = 'x'.repeat(501);
    const files = [file('README.md', longContent)];
    const result = analyzeDocumentation(files, [blob('README.md')]);
    // 25 (exists) + 20 (substantial) = 45
    expect(result.score).toBe(45);
    const sig = result.signals.find((s) => s.name === 'Substantial README (>500 chars)');
    expect(sig?.found).toBe(true);
    expect(sig?.details).toBe('501 characters');
  });

  it('does not give substantial bonus for short README', () => {
    const files = [file('README.md', 'Short')];
    const result = analyzeDocumentation(files, [blob('README.md')]);
    const sig = result.signals.find((s) => s.name === 'Substantial README (>500 chars)');
    expect(sig?.found).toBe(false);
  });

  it('gives +15 when README has >=3 headers', () => {
    const content = '# Title\n## Section A\n### Section B\nSome text';
    const files = [file('README.md', content)];
    const result = analyzeDocumentation(files, [blob('README.md')]);
    const sig = result.signals.find((s) => s.name === 'README has sections');
    expect(sig?.found).toBe(true);
    expect(sig?.details).toBe('3 headers found');
  });

  it('does not award section points for <3 headers', () => {
    const content = '# Title\n## Section A\nSome text';
    const files = [file('README.md', content)];
    const result = analyzeDocumentation(files, [blob('README.md')]);
    const sig = result.signals.find((s) => s.name === 'README has sections');
    expect(sig?.found).toBe(false);
    expect(sig?.details).toBe('2 headers found');
  });

  it('gives +10 when README has code blocks', () => {
    const content = 'Hello\n```js\nconsole.log("hi");\n```\n';
    const files = [file('README.md', content)];
    const result = analyzeDocumentation(files, [blob('README.md')]);
    const sig = result.signals.find((s) => s.name === 'Code examples in README');
    expect(sig?.found).toBe(true);
  });

  it('does not award code-block points when none present', () => {
    const files = [file('README.md', 'No code here')];
    const result = analyzeDocumentation(files, [blob('README.md')]);
    const sig = result.signals.find((s) => s.name === 'Code examples in README');
    expect(sig?.found).toBe(false);
  });

  it('gives +10 for CONTRIBUTING.md', () => {
    const files = [file('CONTRIBUTING.md', 'Contribute!')];
    const result = analyzeDocumentation(files, [blob('CONTRIBUTING.md')]);
    expect(result.score).toBe(10);
    const sig = result.signals.find((s) => s.name === 'CONTRIBUTING.md');
    expect(sig?.found).toBe(true);
  });

  it('gives +10 for CHANGELOG.md', () => {
    const files = [file('CHANGELOG.md', '## 1.0.0\n- Initial')];
    const result = analyzeDocumentation(files, [blob('CHANGELOG.md')]);
    expect(result.score).toBe(10);
    const sig = result.signals.find((s) => s.name === 'CHANGELOG');
    expect(sig?.found).toBe(true);
  });

  it('detects CHANGES.md as a changelog variant', () => {
    const files = [file('CHANGES.md', 'Changes')];
    const result = analyzeDocumentation(files, [blob('CHANGES.md')]);
    const sig = result.signals.find((s) => s.name === 'CHANGELOG');
    expect(sig?.found).toBe(true);
  });

  it('detects HISTORY.md as a changelog variant', () => {
    const files = [file('HISTORY.md', 'History')];
    const result = analyzeDocumentation(files, [blob('HISTORY.md')]);
    const sig = result.signals.find((s) => s.name === 'CHANGELOG');
    expect(sig?.found).toBe(true);
  });

  it('gives +10 for docs/ directory in tree', () => {
    const treeEntries = [tree('docs')];
    const result = analyzeDocumentation([], treeEntries);
    expect(result.score).toBe(10);
    const sig = result.signals.find((s) => s.name === 'docs/ directory');
    expect(sig?.found).toBe(true);
  });

  it('detects doc/ directory (alternative to docs/)', () => {
    const treeEntries = [tree('doc')];
    const result = analyzeDocumentation([], treeEntries);
    const sig = result.signals.find((s) => s.name === 'docs/ directory');
    expect(sig?.found).toBe(true);
  });

  it('handles case-insensitive README lookup (e.g. Readme.md)', () => {
    const files = [file('Readme.md', 'x'.repeat(100))];
    const result = analyzeDocumentation(files, [blob('Readme.md')]);
    const sig = result.signals.find((s) => s.name === 'README exists');
    expect(sig?.found).toBe(true);
    // Should note the non-standard casing
    expect(sig?.details).toContain('Readme.md');
  });

  it('handles case-insensitive README.rst lookup', () => {
    const files = [file('README.rst', 'x'.repeat(100))];
    const result = analyzeDocumentation(files, [blob('README.rst')]);
    const sig = result.signals.find((s) => s.name === 'README exists');
    expect(sig?.found).toBe(true);
  });

  it('returns score 100 for a full repo with all signals', () => {
    const longReadme =
      '# Title\n## Section 1\n### Section 2\n' + 'x'.repeat(500) + '\n```js\ncode();\n```\n';
    const files = [
      file('README.md', longReadme),
      file('CONTRIBUTING.md', 'Contribute!'),
      file('CHANGELOG.md', '## v1.0'),
    ];
    const treeEntries = [
      blob('README.md'),
      blob('CONTRIBUTING.md'),
      blob('CHANGELOG.md'),
      tree('docs'),
    ];
    const result = analyzeDocumentation(files, treeEntries);
    // 25 + 20 + 15 + 10 + 10 + 10 + 10 = 100
    expect(result.score).toBe(100);
    for (const s of result.signals) {
      expect(s.found).toBe(true);
    }
  });

  it('caps score at 100 even if more points accumulate', () => {
    // This scenario is the same as above — max is 100
    const longReadme = '# A\n## B\n### C\n' + 'x'.repeat(600) + '\n```py\nprint(1)\n```\n';
    const files = [
      file('README.md', longReadme),
      file('CONTRIBUTING.md', 'c'),
      file('CHANGELOG.md', 'cl'),
    ];
    const treeEntries = [
      blob('README.md'),
      blob('CONTRIBUTING.md'),
      blob('CHANGELOG.md'),
      tree('docs'),
    ];
    const result = analyzeDocumentation(files, treeEntries);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('does not count blob entries as docs/ directory', () => {
    const treeEntries = [blob('docs')];
    const result = analyzeDocumentation([], treeEntries);
    const sig = result.signals.find((s) => s.name === 'docs/ directory');
    expect(sig?.found).toBe(false);
  });

  it('reports 0 headers when no README exists', () => {
    const result = analyzeDocumentation([], []);
    const sig = result.signals.find((s) => s.name === 'README has sections');
    expect(sig?.found).toBe(false);
    expect(sig?.details).toBe('0 headers found');
  });
});
