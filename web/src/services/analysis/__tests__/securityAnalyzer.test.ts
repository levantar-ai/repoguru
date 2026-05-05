import { describe, it, expect } from 'vitest';
import { analyzeSecurity } from '../securityAnalyzer';
import type { FileContent, TreeEntry } from '../../../types';

// ── Helpers ──

function blob(path: string): TreeEntry {
  return { path, mode: '100644', type: 'blob', sha: 'abc' };
}

function file(path: string, content: string): FileContent {
  return { path, content, size: content.length };
}

// ── Tests ──

describe('analyzeSecurity', () => {
  it('returns score 10 for empty inputs (no suspicious files = +10)', () => {
    const result = analyzeSecurity([], []);
    expect(result.key).toBe('security');
    expect(result.label).toBe('Security');
    // Empty tree has no suspicious files, so "No exposed secret files" is true => +10
    expect(result.score).toBe(10);
    expect(result.weight).toBe(0.1);
    const noSecrets = result.signals.find((s) => s.name === 'No exposed secret files');
    expect(noSecrets?.found).toBe(true);
    // All other signals should be false
    const otherSignals = result.signals.filter((s) => s.name !== 'No exposed secret files');
    for (const s of otherSignals) {
      expect(s.found).toBe(false);
    }
  });

  it('gives +20 for SECURITY.md in files', () => {
    const files = [file('SECURITY.md', 'Report vulnerabilities')];
    const treeEntries = [blob('SECURITY.md'), blob('.gitignore')];
    const result = analyzeSecurity(files, treeEntries);
    const sig = result.signals.find((s) => s.name === 'SECURITY.md');
    expect(sig?.found).toBe(true);
    // 20 (SECURITY.md) + 10 (.gitignore) + 10 (no secrets) = 40
    expect(result.score).toBe(40);
  });

  it('gives +20 for SECURITY.md found only in tree', () => {
    const treeEntries = [blob('SECURITY.md')];
    const result = analyzeSecurity([], treeEntries);
    const sig = result.signals.find((s) => s.name === 'SECURITY.md');
    expect(sig?.found).toBe(true);
    // 20 + 10 (no secrets) = 30
    expect(result.score).toBe(30);
  });

  it('gives +15 for CODEOWNERS in root', () => {
    const files = [file('CODEOWNERS', '* @owner')];
    const treeEntries = [blob('CODEOWNERS')];
    const result = analyzeSecurity(files, treeEntries);
    const sig = result.signals.find((s) => s.name === 'CODEOWNERS');
    expect(sig?.found).toBe(true);
  });

  it('gives +15 for .github/CODEOWNERS', () => {
    const files = [file('.github/CODEOWNERS', '* @owner')];
    const treeEntries = [blob('.github/CODEOWNERS')];
    const result = analyzeSecurity(files, treeEntries);
    const sig = result.signals.find((s) => s.name === 'CODEOWNERS');
    expect(sig?.found).toBe(true);
  });

  it('detects CODEOWNERS from treePaths when not in files', () => {
    const treeEntries = [blob('.github/CODEOWNERS')];
    const result = analyzeSecurity([], treeEntries);
    const sig = result.signals.find((s) => s.name === 'CODEOWNERS');
    expect(sig?.found).toBe(true);
  });

  it('gives +20 for .github/dependabot.yml', () => {
    const files = [file('.github/dependabot.yml', 'version: 2')];
    const result = analyzeSecurity(files, []);
    const sig = result.signals.find((s) => s.name === 'Dependabot configured');
    expect(sig?.found).toBe(true);
  });

  it('gives +20 for .github/dependabot.yaml (alternative extension)', () => {
    const files = [file('.github/dependabot.yaml', 'version: 2')];
    const result = analyzeSecurity(files, []);
    const sig = result.signals.find((s) => s.name === 'Dependabot configured');
    expect(sig?.found).toBe(true);
  });

  it('gives +15 for CodeQL detection via path', () => {
    const files = [file('.github/workflows/codeql.yml', 'name: CodeQL')];
    const treeEntries = [blob('.github/workflows/codeql.yml')];
    const result = analyzeSecurity(files, treeEntries);
    const sig = result.signals.find((s) => s.name === 'CodeQL / security scanning');
    expect(sig?.found).toBe(true);
  });

  it('gives +15 for CodeQL detection via content (codeql-analysis)', () => {
    const files = [file('.github/workflows/security.yml', 'uses: github/codeql-analysis')];
    const result = analyzeSecurity(files, []);
    const sig = result.signals.find((s) => s.name === 'CodeQL / security scanning');
    expect(sig?.found).toBe(true);
  });

  it('gives +15 for CodeQL detection via content (CodeQL keyword)', () => {
    const files = [file('.github/workflows/ci.yml', 'name: Run CodeQL checks')];
    const result = analyzeSecurity(files, []);
    const sig = result.signals.find((s) => s.name === 'CodeQL / security scanning');
    expect(sig?.found).toBe(true);
  });

  it('gives +10 for PR-triggered workflows', () => {
    const files = [file('.github/workflows/ci.yml', 'on:\n  pull_request:\n    branches: [main]')];
    const result = analyzeSecurity(files, []);
    const sig = result.signals.find((s) => s.name === 'PR-triggered workflows');
    expect(sig?.found).toBe(true);
  });

  it('detects pull-request (hyphenated) trigger', () => {
    const files = [file('.github/workflows/ci.yml', 'on: [pull-request]')];
    const result = analyzeSecurity(files, []);
    const sig = result.signals.find((s) => s.name === 'PR-triggered workflows');
    expect(sig?.found).toBe(true);
  });

  it('does not detect PR trigger from non-workflow files', () => {
    const files = [file('src/index.ts', 'pull_request')];
    const result = analyzeSecurity(files, []);
    const sig = result.signals.find((s) => s.name === 'PR-triggered workflows');
    expect(sig?.found).toBe(false);
  });

  it('gives +10 for .gitignore present', () => {
    const treeEntries = [blob('.gitignore')];
    const result = analyzeSecurity([], treeEntries);
    const sig = result.signals.find((s) => s.name === '.gitignore present');
    expect(sig?.found).toBe(true);
  });

  it('gives +10 for no exposed secret files (clean tree)', () => {
    const treeEntries = [blob('src/index.ts')];
    const result = analyzeSecurity([], treeEntries);
    const sig = result.signals.find((s) => s.name === 'No exposed secret files');
    expect(sig?.found).toBe(true);
  });

  it('gives 0 for "No exposed secret files" when .env is in tree', () => {
    const treeEntries = [blob('.env')];
    const result = analyzeSecurity([], treeEntries);
    const sig = result.signals.find((s) => s.name === 'No exposed secret files');
    expect(sig?.found).toBe(false);
  });

  it('detects suspicious files named credentials', () => {
    const treeEntries = [blob('credentials.json')];
    const result = analyzeSecurity([], treeEntries);
    const sig = result.signals.find((s) => s.name === 'No exposed secret files');
    expect(sig?.found).toBe(false);
  });

  it('detects suspicious files named with "secret"', () => {
    const treeEntries = [blob('my-secret-keys.txt')];
    const result = analyzeSecurity([], treeEntries);
    const sig = result.signals.find((s) => s.name === 'No exposed secret files');
    expect(sig?.found).toBe(false);
  });

  it('does not flag tree entries (directories) as suspicious', () => {
    const treeEntries: TreeEntry[] = [{ path: '.env', mode: '040000', type: 'tree', sha: 'abc' }];
    const result = analyzeSecurity([], treeEntries);
    const sig = result.signals.find((s) => s.name === 'No exposed secret files');
    expect(sig?.found).toBe(true);
  });

  it('returns score 100 for a full security setup', () => {
    const files = [
      file('SECURITY.md', 'Report vulnerabilities'),
      file('.github/CODEOWNERS', '* @owner'),
      file('.github/dependabot.yml', 'version: 2'),
      file('.github/workflows/codeql.yml', 'uses: codeql-analysis'),
      file('.github/workflows/ci.yml', 'on:\n  pull_request:\n    branches: [main]'),
    ];
    const treeEntries = [
      blob('SECURITY.md'),
      blob('.github/CODEOWNERS'),
      blob('.github/dependabot.yml'),
      blob('.github/workflows/codeql.yml'),
      blob('.github/workflows/ci.yml'),
      blob('.gitignore'),
    ];
    const result = analyzeSecurity(files, treeEntries);
    // 20 + 15 + 20 + 15 + 10 + 10 + 10 = 100
    expect(result.score).toBe(100);
  });
});
