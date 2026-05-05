import { describe, it, expect } from 'vitest';
import { analyzeCicd } from '../cicdAnalyzer';
import type { FileContent, TreeEntry } from '../../../types';

// ── Helpers ──

function blob(path: string): TreeEntry {
  return { path, mode: '100644', type: 'blob', sha: 'abc' };
}

function file(path: string, content: string): FileContent {
  return { path, content, size: content.length };
}

// ── Tests ──

describe('analyzeCicd', () => {
  it('returns score 0 for empty inputs', () => {
    const result = analyzeCicd([], []);
    expect(result.key).toBe('cicd');
    expect(result.label).toBe('CI/CD');
    expect(result.score).toBe(0);
    expect(result.weight).toBe(0.15);
  });

  it('gives +25 when workflow files exist in tree', () => {
    const treeEntries = [blob('.github/workflows/ci.yml')];
    const result = analyzeCicd([], treeEntries);
    expect(result.score).toBe(25);
    const sig = result.signals.find((s) => s.name === 'GitHub Actions workflows');
    expect(sig?.found).toBe(true);
    expect(sig?.details).toBe('1 workflow file(s)');
  });

  it('counts multiple workflow files', () => {
    const treeEntries = [
      blob('.github/workflows/ci.yml'),
      blob('.github/workflows/release.yml'),
      blob('.github/workflows/lint.yml'),
    ];
    const result = analyzeCicd([], treeEntries);
    const sig = result.signals.find((s) => s.name === 'GitHub Actions workflows');
    expect(sig?.details).toBe('3 workflow file(s)');
  });

  it('gives +25 for CI workflow with push + test content', () => {
    const files = [
      file('.github/workflows/ci.yml', 'on: push\njobs:\n  build:\n    run: npm test'),
    ];
    const treeEntries = [blob('.github/workflows/ci.yml')];
    const result = analyzeCicd(files, treeEntries);
    // 25 (workflows) + 25 (CI) = 50
    const sig = result.signals.find((s) => s.name === 'CI workflow (test/build)');
    expect(sig?.found).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(50);
  });

  it('detects CI workflow with pull_request + build keywords', () => {
    const files = [
      file('.github/workflows/ci.yml', 'on: [pull_request]\nsteps:\n  - run: npm run build'),
    ];
    const treeEntries = [blob('.github/workflows/ci.yml')];
    const result = analyzeCicd(files, treeEntries);
    const sig = result.signals.find((s) => s.name === 'CI workflow (test/build)');
    expect(sig?.found).toBe(true);
  });

  it('detects CI workflow with "ci" keyword', () => {
    const files = [file('.github/workflows/ci.yml', 'on: push\nname: ci')];
    const treeEntries = [blob('.github/workflows/ci.yml')];
    const result = analyzeCicd(files, treeEntries);
    const sig = result.signals.find((s) => s.name === 'CI workflow (test/build)');
    expect(sig?.found).toBe(true);
  });

  it('does not detect CI if workflow has push but no test/build/ci', () => {
    const files = [file('.github/workflows/docs.yml', 'on: push\njobs:\n  docs:\n    run: mkdocs')];
    const treeEntries = [blob('.github/workflows/docs.yml')];
    const result = analyzeCicd(files, treeEntries);
    const sig = result.signals.find((s) => s.name === 'CI workflow (test/build)');
    expect(sig?.found).toBe(false);
  });

  it('gives +15 for deploy/release workflow (path-based)', () => {
    const files = [file('.github/workflows/deploy.yml', 'name: Deploy to prod')];
    const treeEntries = [blob('.github/workflows/deploy.yml')];
    const result = analyzeCicd(files, treeEntries);
    const sig = result.signals.find((s) => s.name === 'Deploy / release workflow');
    expect(sig?.found).toBe(true);
  });

  it('detects release workflow by path', () => {
    const files = [file('.github/workflows/release.yml', 'name: Release')];
    const treeEntries = [blob('.github/workflows/release.yml')];
    const result = analyzeCicd(files, treeEntries);
    const sig = result.signals.find((s) => s.name === 'Deploy / release workflow');
    expect(sig?.found).toBe(true);
  });

  it('detects deploy workflow by content (deploy keyword)', () => {
    const files = [file('.github/workflows/cd.yml', 'steps:\n  - run: deploy to staging')];
    const treeEntries = [blob('.github/workflows/cd.yml')];
    const result = analyzeCicd(files, treeEntries);
    const sig = result.signals.find((s) => s.name === 'Deploy / release workflow');
    expect(sig?.found).toBe(true);
  });

  it('detects deploy workflow by content (publish keyword)', () => {
    const files = [file('.github/workflows/npm.yml', 'steps:\n  - run: npm publish')];
    const treeEntries = [blob('.github/workflows/npm.yml')];
    const result = analyzeCicd(files, treeEntries);
    const sig = result.signals.find((s) => s.name === 'Deploy / release workflow');
    expect(sig?.found).toBe(true);
  });

  it('gives +15 for PR-triggered checks', () => {
    const files = [file('.github/workflows/pr.yml', 'on:\n  pull_request:\n    branches: [main]')];
    const treeEntries = [blob('.github/workflows/pr.yml')];
    const result = analyzeCicd(files, treeEntries);
    const sig = result.signals.find((s) => s.name === 'PR-triggered checks');
    expect(sig?.found).toBe(true);
  });

  it('does not detect PR trigger if not present', () => {
    const files = [file('.github/workflows/ci.yml', 'on: push\nname: CI')];
    const treeEntries = [blob('.github/workflows/ci.yml')];
    const result = analyzeCicd(files, treeEntries);
    const sig = result.signals.find((s) => s.name === 'PR-triggered checks');
    expect(sig?.found).toBe(false);
  });

  it('gives +10 for Dockerfile', () => {
    const treeEntries = [blob('Dockerfile')];
    const result = analyzeCicd([], treeEntries);
    expect(result.score).toBe(10);
    const sig = result.signals.find((s) => s.name === 'Dockerfile');
    expect(sig?.found).toBe(true);
  });

  it('detects nested Dockerfile (e.g. services/app/Dockerfile)', () => {
    const treeEntries = [blob('services/app/Dockerfile')];
    const result = analyzeCicd([], treeEntries);
    const sig = result.signals.find((s) => s.name === 'Dockerfile');
    expect(sig?.found).toBe(true);
  });

  it('gives +5 for docker-compose.yml', () => {
    const treeEntries = [blob('docker-compose.yml')];
    const result = analyzeCicd([], treeEntries);
    expect(result.score).toBe(5);
    const sig = result.signals.find((s) => s.name === 'Docker Compose');
    expect(sig?.found).toBe(true);
  });

  it('detects docker-compose.yaml (alternative extension)', () => {
    const treeEntries = [blob('docker-compose.yaml')];
    const result = analyzeCicd([], treeEntries);
    const sig = result.signals.find((s) => s.name === 'Docker Compose');
    expect(sig?.found).toBe(true);
  });

  it('gives +5 for Makefile', () => {
    const treeEntries = [blob('Makefile')];
    const result = analyzeCicd([], treeEntries);
    expect(result.score).toBe(5);
    const sig = result.signals.find((s) => s.name === 'Makefile');
    expect(sig?.found).toBe(true);
  });

  it('ignores non-workflow files for CI detection', () => {
    const files = [file('src/test.ts', 'push test build')];
    const result = analyzeCicd(files, []);
    const sig = result.signals.find((s) => s.name === 'CI workflow (test/build)');
    expect(sig?.found).toBe(false);
  });

  it('returns score 100 for full setup', () => {
    const ciWorkflow = 'on:\n  push:\n  pull_request:\njobs:\n  test:\n    run: npm test';
    const deployWorkflow = 'name: deploy\non: push\nsteps:\n  - deploy';
    const files = [
      file('.github/workflows/ci.yml', ciWorkflow),
      file('.github/workflows/deploy.yml', deployWorkflow),
    ];
    const treeEntries = [
      blob('.github/workflows/ci.yml'),
      blob('.github/workflows/deploy.yml'),
      blob('Dockerfile'),
      blob('docker-compose.yml'),
      blob('Makefile'),
    ];
    const result = analyzeCicd(files, treeEntries);
    // 25 (workflows) + 25 (CI) + 15 (deploy) + 15 (PR) + 10 (Dockerfile) + 5 (compose) + 5 (Makefile) = 100
    expect(result.score).toBe(100);
  });

  it('caps score at 100', () => {
    // Even with all signals, score should not exceed 100
    const result = analyzeCicd(
      [
        file('.github/workflows/ci.yml', 'on: push\npull_request\ntest\nbuild\nci'),
        file('.github/workflows/deploy.yml', 'deploy publish release'),
      ],
      [
        blob('.github/workflows/ci.yml'),
        blob('.github/workflows/deploy.yml'),
        blob('Dockerfile'),
        blob('docker-compose.yml'),
        blob('Makefile'),
      ],
    );
    expect(result.score).toBeLessThanOrEqual(100);
  });
});
