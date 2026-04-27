import { describe, it, expect } from 'vitest';
import { analyzeLicense } from '../licenseAnalyzer';
import type { TreeEntry, RepoInfo } from '../../../types';

// ── Helpers ──

function blob(path: string): TreeEntry {
  return { path, mode: '100644', type: 'blob', sha: 'abc' };
}

function makeRepoInfo(overrides: Partial<RepoInfo> = {}): RepoInfo {
  return {
    owner: 'test',
    repo: 'test-repo',
    defaultBranch: 'main',
    description: 'A test repo',
    stars: 10,
    forks: 2,
    openIssues: 0,
    license: null,
    language: 'TypeScript',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-06-01T00:00:00Z',
    topics: [],
    archived: false,
    size: 100,
    ...overrides,
  };
}

// ── Tests ──

describe('analyzeLicense', () => {
  it('returns score 0 when no license exists', () => {
    const result = analyzeLicense([], [], makeRepoInfo());
    expect(result.key).toBe('license');
    expect(result.label).toBe('License');
    expect(result.score).toBe(0);
    expect(result.weight).toBe(0.1);
    for (const s of result.signals) {
      expect(s.found).toBe(false);
    }
  });

  it('gives +40 when LICENSE file exists in tree', () => {
    const treeEntries = [blob('LICENSE')];
    const result = analyzeLicense([], treeEntries, makeRepoInfo());
    expect(result.score).toBe(40);
    const sig = result.signals.find((s) => s.name === 'License file exists');
    expect(sig?.found).toBe(true);
  });

  it('detects LICENSE.md variant', () => {
    const treeEntries = [blob('LICENSE.md')];
    const result = analyzeLicense([], treeEntries, makeRepoInfo());
    const sig = result.signals.find((s) => s.name === 'License file exists');
    expect(sig?.found).toBe(true);
    expect(result.score).toBe(40);
  });

  it('detects LICENSE.txt variant', () => {
    const treeEntries = [blob('LICENSE.txt')];
    const result = analyzeLicense([], treeEntries, makeRepoInfo());
    const sig = result.signals.find((s) => s.name === 'License file exists');
    expect(sig?.found).toBe(true);
  });

  it('detects COPYING variant', () => {
    const treeEntries = [blob('COPYING')];
    const result = analyzeLicense([], treeEntries, makeRepoInfo());
    const sig = result.signals.find((s) => s.name === 'License file exists');
    expect(sig?.found).toBe(true);
  });

  it('detects LICENCE (British spelling) variant', () => {
    const treeEntries = [blob('LICENCE')];
    const result = analyzeLicense([], treeEntries, makeRepoInfo());
    const sig = result.signals.find((s) => s.name === 'License file exists');
    expect(sig?.found).toBe(true);
  });

  it('gives +30 for SPDX detected license (repoInfo.license = MIT)', () => {
    const result = analyzeLicense([], [], makeRepoInfo({ license: 'MIT' }));
    // No file = 0, SPDX = 30, permissive = 30 => 60
    expect(result.score).toBe(60);
    const spdx = result.signals.find((s) => s.name === 'SPDX license detected');
    expect(spdx?.found).toBe(true);
    expect(spdx?.details).toBe('MIT');
  });

  it('gives +30 for permissive license (MIT)', () => {
    const treeEntries = [blob('LICENSE')];
    const result = analyzeLicense([], treeEntries, makeRepoInfo({ license: 'MIT' }));
    // 40 (file) + 30 (SPDX) + 30 (permissive) = 100
    expect(result.score).toBe(100);
    const sig = result.signals.find((s) => s.name === 'Permissive license');
    expect(sig?.found).toBe(true);
    expect(sig?.details).toBe('MIT');
  });

  it('gives +30 for Apache-2.0 (permissive)', () => {
    const treeEntries = [blob('LICENSE')];
    const result = analyzeLicense([], treeEntries, makeRepoInfo({ license: 'Apache-2.0' }));
    expect(result.score).toBe(100);
    const sig = result.signals.find((s) => s.name === 'Permissive license');
    expect(sig?.found).toBe(true);
  });

  it('gives +30 for BSD-2-Clause (permissive)', () => {
    const result = analyzeLicense([], [blob('LICENSE')], makeRepoInfo({ license: 'BSD-2-Clause' }));
    expect(result.score).toBe(100);
  });

  it('gives +20 instead of +30 for copyleft license (GPL-3.0)', () => {
    const treeEntries = [blob('LICENSE')];
    const result = analyzeLicense([], treeEntries, makeRepoInfo({ license: 'GPL-3.0' }));
    // 40 (file) + 30 (SPDX) + 20 (copyleft, not permissive) = 90
    expect(result.score).toBe(90);
    const copyleft = result.signals.find((s) => s.name === 'Copyleft license');
    expect(copyleft?.found).toBe(true);
    expect(copyleft?.details).toBe('GPL-3.0');
    const permissive = result.signals.find((s) => s.name === 'Permissive license');
    expect(permissive?.found).toBe(false);
  });

  it('gives +20 for AGPL-3.0 (copyleft)', () => {
    const result = analyzeLicense([], [blob('LICENSE')], makeRepoInfo({ license: 'AGPL-3.0' }));
    // 40 + 30 + 20 = 90
    expect(result.score).toBe(90);
  });

  it('gives +10 for unknown detected license (not permissive nor copyleft)', () => {
    const treeEntries = [blob('LICENSE')];
    const result = analyzeLicense([], treeEntries, makeRepoInfo({ license: 'WTFPL' }));
    // 40 (file) + 30 (SPDX detected) + 10 (unknown type) = 80
    expect(result.score).toBe(80);
    const spdx = result.signals.find((s) => s.name === 'SPDX license detected');
    expect(spdx?.found).toBe(true);
    const permissive = result.signals.find((s) => s.name === 'Permissive license');
    expect(permissive?.found).toBe(false);
    const copyleft = result.signals.find((s) => s.name === 'Copyleft license');
    expect(copyleft?.found).toBe(false);
  });

  it('does not treat NOASSERTION as a detected license', () => {
    const result = analyzeLicense([], [], makeRepoInfo({ license: 'NOASSERTION' }));
    const spdx = result.signals.find((s) => s.name === 'SPDX license detected');
    expect(spdx?.found).toBe(false);
    expect(result.score).toBe(0);
  });

  it('does not treat empty string as a detected license', () => {
    const result = analyzeLicense([], [], makeRepoInfo({ license: '' }));
    const spdx = result.signals.find((s) => s.name === 'SPDX license detected');
    expect(spdx?.found).toBe(false);
  });

  it('does not treat null as a detected license', () => {
    const result = analyzeLicense([], [], makeRepoInfo({ license: null }));
    const spdx = result.signals.find((s) => s.name === 'SPDX license detected');
    expect(spdx?.found).toBe(false);
  });

  it('files parameter is unused (_files)', () => {
    // The analyzer ignores the files parameter entirely
    const files = [{ path: 'LICENSE', content: 'MIT', size: 3 }];
    const result = analyzeLicense(files, [], makeRepoInfo());
    // No tree entry for LICENSE, so file signal is false
    const sig = result.signals.find((s) => s.name === 'License file exists');
    expect(sig?.found).toBe(false);
  });
});
