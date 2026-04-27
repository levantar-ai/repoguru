import { describe, it, expect } from 'vitest';
import { analyzeOpenssf } from '../openssfAnalyzer';
import type { FileContent, TreeEntry } from '../../../types';

// ── Helpers ──

function blob(path: string): TreeEntry {
  return { path, mode: '100644', type: 'blob', sha: 'abc' };
}

function file(path: string, content: string): FileContent {
  return { path, content, size: content.length };
}

// ── Tests ──

describe('analyzeOpenssf', () => {
  // ── Structure ──

  it('returns key "openssf" and label "OpenSSF"', () => {
    const result = analyzeOpenssf([], []);
    expect(result.key).toBe('openssf');
    expect(result.label).toBe('OpenSSF');
  });

  it('returns 10 signals', () => {
    const result = analyzeOpenssf([], []);
    expect(result.signals).toHaveLength(10);
  });

  it('has weight 0.1', () => {
    const result = analyzeOpenssf([], []);
    expect(result.weight).toBe(0.1);
  });

  it('score is between 0 and 100', () => {
    const result = analyzeOpenssf([], []);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  // ── Token permissions (15 pts) ──

  it('detects token permissions when workflow has permissions: block', () => {
    const wf = file(
      '.github/workflows/ci.yml',
      'name: CI\npermissions:\n  contents: read\njobs:\n  test:\n    runs-on: ubuntu-latest',
    );
    const result = analyzeOpenssf([wf], [blob('.github/workflows/ci.yml')]);
    const sig = result.signals.find((s) => s.name === 'Token permissions');
    expect(sig?.found).toBe(true);
  });

  it('does not detect token permissions without permissions block', () => {
    const wf = file(
      '.github/workflows/ci.yml',
      'name: CI\njobs:\n  test:\n    runs-on: ubuntu-latest',
    );
    const result = analyzeOpenssf([wf], [blob('.github/workflows/ci.yml')]);
    const sig = result.signals.find((s) => s.name === 'Token permissions');
    expect(sig?.found).toBe(false);
  });

  // ── Pinned dependencies (15 pts) ──

  it('detects pinned deps when all actions use SHA refs', () => {
    const wf = file(
      '.github/workflows/ci.yml',
      'steps:\n  - uses: actions/checkout@a5ac7e51b41094c92402da3b24376905380afc29\n  - uses: actions/setup-node@60edb5dd545a775178f52524783378180af0d1f8',
    );
    const result = analyzeOpenssf([wf], [blob('.github/workflows/ci.yml')]);
    const sig = result.signals.find((s) => s.name === 'Pinned dependencies');
    expect(sig?.found).toBe(true);
  });

  it('does not detect pinned deps when actions use tag refs', () => {
    const wf = file(
      '.github/workflows/ci.yml',
      'steps:\n  - uses: actions/checkout@v4\n  - uses: actions/setup-node@v4',
    );
    const result = analyzeOpenssf([wf], [blob('.github/workflows/ci.yml')]);
    const sig = result.signals.find((s) => s.name === 'Pinned dependencies');
    expect(sig?.found).toBe(false);
  });

  it('does not detect pinned deps when no action refs exist', () => {
    const wf = file('.github/workflows/ci.yml', 'steps:\n  - run: echo hello');
    const result = analyzeOpenssf([wf], [blob('.github/workflows/ci.yml')]);
    const sig = result.signals.find((s) => s.name === 'Pinned dependencies');
    expect(sig?.found).toBe(false);
  });

  // ── No dangerous workflow patterns (10 pts) ──

  it('detects dangerous pattern: pull_request_target + head checkout', () => {
    const wf = file(
      '.github/workflows/ci.yml',
      'on: pull_request_target\njobs:\n  test:\n    steps:\n      - uses: actions/checkout\n        with:\n          ref: github.event.pull_request.head.ref',
    );
    const result = analyzeOpenssf([wf], [blob('.github/workflows/ci.yml')]);
    const sig = result.signals.find((s) => s.name === 'No dangerous workflow patterns');
    expect(sig?.found).toBe(false);
  });

  it('passes when no dangerous patterns exist', () => {
    const wf = file(
      '.github/workflows/ci.yml',
      'on: pull_request\njobs:\n  test:\n    steps:\n      - uses: actions/checkout@v4',
    );
    const result = analyzeOpenssf([wf], [blob('.github/workflows/ci.yml')]);
    const sig = result.signals.find((s) => s.name === 'No dangerous workflow patterns');
    expect(sig?.found).toBe(true);
  });

  // ── No binary artifacts (10 pts) ──

  it('detects binary artifacts (.exe)', () => {
    const result = analyzeOpenssf([], [blob('build/app.exe')]);
    const sig = result.signals.find((s) => s.name === 'No binary artifacts');
    expect(sig?.found).toBe(false);
  });

  it('detects binary artifacts (.dll)', () => {
    const result = analyzeOpenssf([], [blob('lib/native.dll')]);
    const sig = result.signals.find((s) => s.name === 'No binary artifacts');
    expect(sig?.found).toBe(false);
  });

  it('detects binary artifacts (.jar)', () => {
    const result = analyzeOpenssf([], [blob('libs/app.jar')]);
    const sig = result.signals.find((s) => s.name === 'No binary artifacts');
    expect(sig?.found).toBe(false);
  });

  it('detects binary artifacts (.pyc)', () => {
    const result = analyzeOpenssf([], [blob('__pycache__/module.pyc')]);
    const sig = result.signals.find((s) => s.name === 'No binary artifacts');
    expect(sig?.found).toBe(false);
  });

  it('passes when no binary artifacts exist', () => {
    const result = analyzeOpenssf([], [blob('src/index.ts'), blob('README.md')]);
    const sig = result.signals.find((s) => s.name === 'No binary artifacts');
    expect(sig?.found).toBe(true);
  });

  // ── SLSA / signed releases (10 pts) ──

  it('detects SLSA in workflow content', () => {
    const wf = file(
      '.github/workflows/release.yml',
      'steps:\n  - uses: slsa-framework/slsa-github-generator@v1',
    );
    const result = analyzeOpenssf([wf], [blob('.github/workflows/release.yml')]);
    const sig = result.signals.find((s) => s.name === 'SLSA / signed releases');
    expect(sig?.found).toBe(true);
  });

  it('detects cosign in workflow content', () => {
    const wf = file(
      '.github/workflows/release.yml',
      'steps:\n  - run: cosign sign --key env://COSIGN_KEY',
    );
    const result = analyzeOpenssf([wf], [blob('.github/workflows/release.yml')]);
    const sig = result.signals.find((s) => s.name === 'SLSA / signed releases');
    expect(sig?.found).toBe(true);
  });

  it('detects sigstore in workflow content', () => {
    const wf = file(
      '.github/workflows/release.yml',
      'steps:\n  - uses: sigstore/cosign-installer@v3',
    );
    const result = analyzeOpenssf([wf], [blob('.github/workflows/release.yml')]);
    const sig = result.signals.find((s) => s.name === 'SLSA / signed releases');
    expect(sig?.found).toBe(true);
  });

  it('does not detect SLSA without relevant content', () => {
    const wf = file('.github/workflows/ci.yml', 'steps:\n  - run: npm test');
    const result = analyzeOpenssf([wf], [blob('.github/workflows/ci.yml')]);
    const sig = result.signals.find((s) => s.name === 'SLSA / signed releases');
    expect(sig?.found).toBe(false);
  });

  // ── Fuzzing (10 pts) ──

  it('detects fuzz directory in tree', () => {
    const result = analyzeOpenssf([], [blob('fuzz/fuzz_target.go')]);
    const sig = result.signals.find((s) => s.name === 'Fuzzing');
    expect(sig?.found).toBe(true);
  });

  it('detects oss-fuzz reference in file content', () => {
    const f = file('README.md', 'This project is tested with oss-fuzz.');
    const result = analyzeOpenssf([f], [blob('README.md')]);
    const sig = result.signals.find((s) => s.name === 'Fuzzing');
    expect(sig?.found).toBe(true);
  });

  it('does not detect fuzzing without any references', () => {
    const result = analyzeOpenssf([], [blob('src/index.ts')]);
    const sig = result.signals.find((s) => s.name === 'Fuzzing');
    expect(sig?.found).toBe(false);
  });

  // ── SBOM generation (10 pts) ──

  it('detects CycloneDX in workflow content', () => {
    const wf = file(
      '.github/workflows/sbom.yml',
      'steps:\n  - uses: CycloneDX/gh-node-module-generatebom@v1',
    );
    const result = analyzeOpenssf([wf], [blob('.github/workflows/sbom.yml')]);
    const sig = result.signals.find((s) => s.name === 'SBOM generation');
    expect(sig?.found).toBe(true);
  });

  it('detects syft in workflow content', () => {
    const wf = file(
      '.github/workflows/release.yml',
      'steps:\n  - uses: anchore/sbom-action@v0\n  - run: syft packages',
    );
    const result = analyzeOpenssf([wf], [blob('.github/workflows/release.yml')]);
    const sig = result.signals.find((s) => s.name === 'SBOM generation');
    expect(sig?.found).toBe(true);
  });

  it('does not detect SBOM without relevant content', () => {
    const wf = file('.github/workflows/ci.yml', 'steps:\n  - run: npm test');
    const result = analyzeOpenssf([wf], [blob('.github/workflows/ci.yml')]);
    const sig = result.signals.find((s) => s.name === 'SBOM generation');
    expect(sig?.found).toBe(false);
  });

  // ── Dependency update tool (10 pts) ──

  it('detects Dependabot config', () => {
    const f = file('.github/dependabot.yml', 'version: 2');
    const result = analyzeOpenssf([f], [blob('.github/dependabot.yml')]);
    const sig = result.signals.find((s) => s.name === 'Dependency update tool');
    expect(sig?.found).toBe(true);
    expect(sig?.details).toBe('Dependabot');
  });

  it('detects Renovate config (.renovaterc)', () => {
    const result = analyzeOpenssf([], [blob('.renovaterc')]);
    const sig = result.signals.find((s) => s.name === 'Dependency update tool');
    expect(sig?.found).toBe(true);
    expect(sig?.details).toBe('Renovate');
  });

  it('detects Renovate config (renovate.json)', () => {
    const result = analyzeOpenssf([], [blob('renovate.json')]);
    const sig = result.signals.find((s) => s.name === 'Dependency update tool');
    expect(sig?.found).toBe(true);
    expect(sig?.details).toBe('Renovate');
  });

  it('does not detect dependency update tool without config', () => {
    const result = analyzeOpenssf([], [blob('src/index.ts')]);
    const sig = result.signals.find((s) => s.name === 'Dependency update tool');
    expect(sig?.found).toBe(false);
  });

  // ── Security policy (5 pts) ──

  it('detects SECURITY.md', () => {
    const f = file('SECURITY.md', '# Security Policy');
    const result = analyzeOpenssf([f], [blob('SECURITY.md')]);
    const sig = result.signals.find((s) => s.name === 'Security policy');
    expect(sig?.found).toBe(true);
  });

  it('detects SECURITY.md from tree only', () => {
    const result = analyzeOpenssf([], [blob('SECURITY.md')]);
    const sig = result.signals.find((s) => s.name === 'Security policy');
    expect(sig?.found).toBe(true);
  });

  // ── License detected (5 pts) ──

  it('detects LICENSE file', () => {
    const result = analyzeOpenssf([], [blob('LICENSE')]);
    const sig = result.signals.find((s) => s.name === 'License detected');
    expect(sig?.found).toBe(true);
  });

  it('detects LICENSE.md file', () => {
    const result = analyzeOpenssf([], [blob('LICENSE.md')]);
    const sig = result.signals.find((s) => s.name === 'License detected');
    expect(sig?.found).toBe(true);
  });

  it('detects COPYING file', () => {
    const result = analyzeOpenssf([], [blob('COPYING')]);
    const sig = result.signals.find((s) => s.name === 'License detected');
    expect(sig?.found).toBe(true);
  });

  // ── Scoring ──

  it('scores 20 for an empty repo (no binary + no dangerous patterns)', () => {
    const result = analyzeOpenssf([], []);
    // No binary artifacts = 10, No dangerous patterns = 10
    expect(result.score).toBe(20);
  });

  it('scores 30 for repo with LICENSE and SECURITY.md', () => {
    const result = analyzeOpenssf([], [blob('LICENSE'), blob('SECURITY.md')]);
    // 10 (no binary) + 10 (no dangerous) + 5 (security policy) + 5 (license) = 30
    expect(result.score).toBe(30);
  });

  it('achieves high score with all signals present', () => {
    const wf = file(
      '.github/workflows/ci.yml',
      [
        'permissions:',
        '  contents: read',
        'steps:',
        '  - uses: actions/checkout@a5ac7e51b41094c92402da3b24376905380afc29',
        '  - uses: slsa-framework/slsa-github-generator@a5ac7e51b41094c92402da3b24376905380afc29',
        '  - run: syft packages',
      ].join('\n'),
    );
    const dependabot = file('.github/dependabot.yml', 'version: 2');
    const security = file('SECURITY.md', '# Security');
    const tree = [
      blob('.github/workflows/ci.yml'),
      blob('.github/dependabot.yml'),
      blob('SECURITY.md'),
      blob('LICENSE'),
      blob('fuzz/target.go'),
    ];
    const result = analyzeOpenssf([wf, dependabot, security], tree);
    expect(result.score).toBe(100);
  });

  it('loses 10 points when binary artifacts are present', () => {
    const withoutBinary = analyzeOpenssf([], [blob('src/main.ts')]);
    const withBinary = analyzeOpenssf([], [blob('src/main.ts'), blob('build/app.exe')]);
    expect(withoutBinary.score - withBinary.score).toBe(10);
  });
});
