import { describe, it, expect } from 'vitest';
import { analyzeDependencies } from '../dependenciesAnalyzer';
import type { FileContent, TreeEntry } from '../../../types';

// ── Helpers ──

function blob(path: string): TreeEntry {
  return { path, mode: '100644', type: 'blob', sha: 'abc' };
}

function file(path: string, content: string): FileContent {
  return { path, content, size: content.length };
}

function makePkgJson(
  deps: Record<string, string> = {},
  devDeps: Record<string, string> = {},
): string {
  return JSON.stringify({ dependencies: deps, devDependencies: devDeps });
}

// ── Tests ──

describe('analyzeDependencies', () => {
  it('returns score 15 for empty inputs (reasonable count is true when 0 deps)', () => {
    const { result, techStack } = analyzeDependencies([], []);
    expect(result.key).toBe('dependencies');
    expect(result.label).toBe('Dependencies');
    // 0 < 200 so "reasonable" is true => +15
    expect(result.score).toBe(15);
    expect(result.weight).toBe(0.15);
    expect(techStack).toEqual([]);
    // Manifest, lockfile, and tracked should all be false
    const manifest = result.signals.find((s) => s.name === 'Dependency manifest');
    expect(manifest?.found).toBe(false);
    const lockfile = result.signals.find((s) => s.name === 'Lockfile present');
    expect(lockfile?.found).toBe(false);
    const tracked = result.signals.find((s) => s.name === 'Dependencies tracked');
    expect(tracked?.found).toBe(false);
  });

  // ── Manifest detection ──

  it('gives +30 for package.json manifest', () => {
    const files = [file('package.json', makePkgJson())];
    const treeEntries = [blob('package.json')];
    const { result } = analyzeDependencies(files, treeEntries);
    const sig = result.signals.find((s) => s.name === 'Dependency manifest');
    expect(sig?.found).toBe(true);
    expect(sig?.details).toContain('package.json');
    expect(result.score).toBeGreaterThanOrEqual(30);
  });

  it('detects Cargo.toml as manifest', () => {
    const treeEntries = [blob('Cargo.toml')];
    const { result } = analyzeDependencies([], treeEntries);
    const sig = result.signals.find((s) => s.name === 'Dependency manifest');
    expect(sig?.found).toBe(true);
    expect(sig?.details).toContain('Cargo.toml');
  });

  it('detects go.mod as manifest', () => {
    const treeEntries = [blob('go.mod')];
    const { result } = analyzeDependencies([], treeEntries);
    const sig = result.signals.find((s) => s.name === 'Dependency manifest');
    expect(sig?.found).toBe(true);
  });

  it('detects requirements.txt as manifest', () => {
    const treeEntries = [blob('requirements.txt')];
    const { result } = analyzeDependencies([], treeEntries);
    const sig = result.signals.find((s) => s.name === 'Dependency manifest');
    expect(sig?.found).toBe(true);
  });

  it('detects pyproject.toml as manifest', () => {
    const treeEntries = [blob('pyproject.toml')];
    const { result } = analyzeDependencies([], treeEntries);
    const sig = result.signals.find((s) => s.name === 'Dependency manifest');
    expect(sig?.found).toBe(true);
  });

  it('detects Gemfile as manifest', () => {
    const treeEntries = [blob('Gemfile')];
    const { result } = analyzeDependencies([], treeEntries);
    const sig = result.signals.find((s) => s.name === 'Dependency manifest');
    expect(sig?.found).toBe(true);
  });

  it('detects composer.json as manifest', () => {
    const treeEntries = [blob('composer.json')];
    const { result } = analyzeDependencies([], treeEntries);
    const sig = result.signals.find((s) => s.name === 'Dependency manifest');
    expect(sig?.found).toBe(true);
  });

  it('detects pom.xml as manifest', () => {
    const treeEntries = [blob('pom.xml')];
    const { result } = analyzeDependencies([], treeEntries);
    const sig = result.signals.find((s) => s.name === 'Dependency manifest');
    expect(sig?.found).toBe(true);
  });

  it('detects build.gradle as manifest', () => {
    const treeEntries = [blob('build.gradle')];
    const { result } = analyzeDependencies([], treeEntries);
    const sig = result.signals.find((s) => s.name === 'Dependency manifest');
    expect(sig?.found).toBe(true);
  });

  it('detects build.gradle.kts as manifest', () => {
    const treeEntries = [blob('build.gradle.kts')];
    const { result } = analyzeDependencies([], treeEntries);
    const sig = result.signals.find((s) => s.name === 'Dependency manifest');
    expect(sig?.found).toBe(true);
  });

  it('lists multiple manifests in details', () => {
    const files = [file('package.json', makePkgJson())];
    const treeEntries = [blob('package.json'), blob('Cargo.toml')];
    const { result } = analyzeDependencies(files, treeEntries);
    const sig = result.signals.find((s) => s.name === 'Dependency manifest');
    expect(sig?.details).toContain('package.json');
    expect(sig?.details).toContain('Cargo.toml');
  });

  // ── Lockfile detection ──

  it('gives +25 for lockfile present', () => {
    const treeEntries = [blob('package-lock.json')];
    const { result } = analyzeDependencies([], treeEntries);
    const sig = result.signals.find((s) => s.name === 'Lockfile present');
    expect(sig?.found).toBe(true);
    expect(sig?.details).toContain('package-lock.json');
  });

  it('detects yarn.lock', () => {
    const treeEntries = [blob('yarn.lock')];
    const { result } = analyzeDependencies([], treeEntries);
    const sig = result.signals.find((s) => s.name === 'Lockfile present');
    expect(sig?.found).toBe(true);
  });

  it('detects pnpm-lock.yaml', () => {
    const treeEntries = [blob('pnpm-lock.yaml')];
    const { result } = analyzeDependencies([], treeEntries);
    const sig = result.signals.find((s) => s.name === 'Lockfile present');
    expect(sig?.found).toBe(true);
  });

  it('detects Cargo.lock', () => {
    const treeEntries = [blob('Cargo.lock')];
    const { result } = analyzeDependencies([], treeEntries);
    const sig = result.signals.find((s) => s.name === 'Lockfile present');
    expect(sig?.found).toBe(true);
  });

  it('detects go.sum', () => {
    const treeEntries = [blob('go.sum')];
    const { result } = analyzeDependencies([], treeEntries);
    const sig = result.signals.find((s) => s.name === 'Lockfile present');
    expect(sig?.found).toBe(true);
  });

  it('detects Gemfile.lock', () => {
    const treeEntries = [blob('Gemfile.lock')];
    const { result } = analyzeDependencies([], treeEntries);
    const sig = result.signals.find((s) => s.name === 'Lockfile present');
    expect(sig?.found).toBe(true);
  });

  // ── Dependencies tracked ──

  it('gives +20 for dependencies tracked (depCount > 0)', () => {
    const files = [file('package.json', makePkgJson({ react: '^18.0.0' }))];
    const treeEntries = [blob('package.json')];
    const { result } = analyzeDependencies(files, treeEntries);
    const sig = result.signals.find((s) => s.name === 'Dependencies tracked');
    expect(sig?.found).toBe(true);
    expect(sig?.details).toBe('1 dependencies');
  });

  it('counts both deps and devDeps', () => {
    const files = [
      file('package.json', makePkgJson({ react: '^18' }, { vitest: '^1.0', typescript: '^5' })),
    ];
    const { result } = analyzeDependencies(files, [blob('package.json')]);
    const sig = result.signals.find((s) => s.name === 'Dependencies tracked');
    expect(sig?.details).toBe('3 dependencies');
  });

  it('does not flag dependencies tracked when no package.json deps', () => {
    const files = [file('package.json', '{}')];
    const { result } = analyzeDependencies(files, [blob('package.json')]);
    const sig = result.signals.find((s) => s.name === 'Dependencies tracked');
    expect(sig?.found).toBe(false);
  });

  // ── Reasonable dependency count ──

  it('gives +15 for reasonable count (<200)', () => {
    const deps: Record<string, string> = {};
    for (let i = 0; i < 50; i++) deps[`pkg-${i}`] = '^1.0.0';
    const files = [file('package.json', makePkgJson(deps))];
    const { result } = analyzeDependencies(files, [blob('package.json')]);
    const sig = result.signals.find((s) => s.name === 'Reasonable dependency count');
    expect(sig?.found).toBe(true);
    expect(sig?.details).toBe('50 total');
  });

  it('marks unreasonable when deps >= 200 (bloated)', () => {
    const deps: Record<string, string> = {};
    for (let i = 0; i < 200; i++) deps[`pkg-${i}`] = '^1.0.0';
    const files = [file('package.json', makePkgJson(deps))];
    const { result } = analyzeDependencies(files, [blob('package.json')]);
    const sig = result.signals.find((s) => s.name === 'Reasonable dependency count');
    expect(sig?.found).toBe(false);
    expect(sig?.details).toBe('200 total');
  });

  it('reasonable is true when depCount = 0 (no package.json parsing)', () => {
    const { result } = analyzeDependencies([], []);
    const sig = result.signals.find((s) => s.name === 'Reasonable dependency count');
    // 0 < 200, so reasonable is true, but no details since no deps
    expect(sig?.found).toBe(true);
  });

  // ── Tech stack detection ──

  it('gives +10 for tech stack detected', () => {
    const files = [file('package.json', makePkgJson({ react: '^18' }))];
    const { result, techStack } = analyzeDependencies(files, [blob('package.json')]);
    // techStack should have React
    expect(techStack.length).toBeGreaterThan(0);
    expect(result.score).toBeGreaterThanOrEqual(10);
  });

  it('detects React from package.json deps', () => {
    const files = [file('package.json', makePkgJson({ react: '^18', 'react-dom': '^18' }))];
    const { techStack } = analyzeDependencies(files, [blob('package.json')]);
    expect(techStack).toContainEqual({ name: 'React', category: 'framework' });
  });

  it('detects Vue from package.json deps', () => {
    const files = [file('package.json', makePkgJson({ vue: '^3' }))];
    const { techStack } = analyzeDependencies(files, [blob('package.json')]);
    expect(techStack).toContainEqual({ name: 'Vue', category: 'framework' });
  });

  it('detects Angular from package.json deps', () => {
    const files = [file('package.json', makePkgJson({ '@angular/core': '^17' }))];
    const { techStack } = analyzeDependencies(files, [blob('package.json')]);
    expect(techStack).toContainEqual({ name: 'Angular', category: 'framework' });
  });

  it('detects Svelte from package.json deps', () => {
    const files = [file('package.json', makePkgJson({ svelte: '^4' }))];
    const { techStack } = analyzeDependencies(files, [blob('package.json')]);
    expect(techStack).toContainEqual({ name: 'Svelte', category: 'framework' });
  });

  it('detects Next.js from package.json deps', () => {
    const files = [file('package.json', makePkgJson({ next: '^14' }))];
    const { techStack } = analyzeDependencies(files, [blob('package.json')]);
    expect(techStack).toContainEqual({ name: 'Next.js', category: 'framework' });
  });

  it('detects Express from package.json deps', () => {
    const files = [file('package.json', makePkgJson({ express: '^4' }))];
    const { techStack } = analyzeDependencies(files, [blob('package.json')]);
    expect(techStack).toContainEqual({ name: 'Express', category: 'framework' });
  });

  it('detects Fastify from package.json deps', () => {
    const files = [file('package.json', makePkgJson({ fastify: '^4' }))];
    const { techStack } = analyzeDependencies(files, [blob('package.json')]);
    expect(techStack).toContainEqual({ name: 'Fastify', category: 'framework' });
  });

  it('detects NestJS from @nestjs/core', () => {
    const files = [file('package.json', makePkgJson({ '@nestjs/core': '^10' }))];
    const { techStack } = analyzeDependencies(files, [blob('package.json')]);
    expect(techStack).toContainEqual({ name: 'NestJS', category: 'framework' });
  });

  it('detects TypeScript from package.json deps', () => {
    const files = [file('package.json', makePkgJson({}, { typescript: '^5' }))];
    const { techStack } = analyzeDependencies(files, [blob('package.json')]);
    expect(techStack).toContainEqual({ name: 'TypeScript', category: 'language' });
  });

  it('detects Tailwind CSS from package.json deps', () => {
    const files = [file('package.json', makePkgJson({}, { tailwindcss: '^3' }))];
    const { techStack } = analyzeDependencies(files, [blob('package.json')]);
    expect(techStack).toContainEqual({ name: 'Tailwind CSS', category: 'tool' });
  });

  it('detects Webpack from package.json deps', () => {
    const files = [file('package.json', makePkgJson({}, { webpack: '^5' }))];
    const { techStack } = analyzeDependencies(files, [blob('package.json')]);
    expect(techStack).toContainEqual({ name: 'Webpack', category: 'tool' });
  });

  it('detects Vite from package.json deps', () => {
    const files = [file('package.json', makePkgJson({}, { vite: '^5' }))];
    const { techStack } = analyzeDependencies(files, [blob('package.json')]);
    expect(techStack).toContainEqual({ name: 'Vite', category: 'tool' });
  });

  it('detects Test Framework from jest', () => {
    const files = [file('package.json', makePkgJson({}, { jest: '^29' }))];
    const { techStack } = analyzeDependencies(files, [blob('package.json')]);
    expect(techStack).toContainEqual({ name: 'Test Framework', category: 'tool' });
  });

  it('detects Test Framework from vitest', () => {
    const files = [file('package.json', makePkgJson({}, { vitest: '^1' }))];
    const { techStack } = analyzeDependencies(files, [blob('package.json')]);
    expect(techStack).toContainEqual({ name: 'Test Framework', category: 'tool' });
  });

  // ── Non-JS tech stack detection from tree ──

  it('detects Go from go.mod in tree', () => {
    const treeEntries = [blob('go.mod')];
    const { techStack } = analyzeDependencies([], treeEntries);
    expect(techStack).toContainEqual({ name: 'Go', category: 'language' });
  });

  it('detects Rust from Cargo.toml in tree', () => {
    const treeEntries = [blob('Cargo.toml')];
    const { techStack } = analyzeDependencies([], treeEntries);
    expect(techStack).toContainEqual({ name: 'Rust', category: 'language' });
  });

  it('detects Python from requirements.txt in tree', () => {
    const treeEntries = [blob('requirements.txt')];
    const { techStack } = analyzeDependencies([], treeEntries);
    expect(techStack).toContainEqual({ name: 'Python', category: 'language' });
  });

  it('detects Python from pyproject.toml', () => {
    const treeEntries = [blob('pyproject.toml')];
    const { techStack } = analyzeDependencies([], treeEntries);
    expect(techStack).toContainEqual({ name: 'Python', category: 'language' });
  });

  it('detects Python from Pipfile', () => {
    const treeEntries = [blob('Pipfile')];
    const { techStack } = analyzeDependencies([], treeEntries);
    expect(techStack).toContainEqual({ name: 'Python', category: 'language' });
  });

  it('detects Ruby from Gemfile', () => {
    const treeEntries = [blob('Gemfile')];
    const { techStack } = analyzeDependencies([], treeEntries);
    expect(techStack).toContainEqual({ name: 'Ruby', category: 'language' });
  });

  it('detects PHP from composer.json', () => {
    const treeEntries = [blob('composer.json')];
    const { techStack } = analyzeDependencies([], treeEntries);
    expect(techStack).toContainEqual({ name: 'PHP', category: 'language' });
  });

  it('detects Java/JVM from pom.xml', () => {
    const treeEntries = [blob('pom.xml')];
    const { techStack } = analyzeDependencies([], treeEntries);
    expect(techStack).toContainEqual({ name: 'Java/JVM', category: 'language' });
  });

  it('detects Java/JVM from build.gradle', () => {
    const treeEntries = [blob('build.gradle')];
    const { techStack } = analyzeDependencies([], treeEntries);
    expect(techStack).toContainEqual({ name: 'Java/JVM', category: 'language' });
  });

  it('detects Java/JVM from build.gradle.kts', () => {
    const treeEntries = [blob('build.gradle.kts')];
    const { techStack } = analyzeDependencies([], treeEntries);
    expect(techStack).toContainEqual({ name: 'Java/JVM', category: 'language' });
  });

  it('detects Docker from Dockerfile in tree', () => {
    const treeEntries = [blob('Dockerfile')];
    const { techStack } = analyzeDependencies([], treeEntries);
    expect(techStack).toContainEqual({ name: 'Docker', category: 'platform' });
  });

  it('detects TypeScript from tsconfig.json when not in package.json', () => {
    const treeEntries = [blob('tsconfig.json')];
    const { techStack } = analyzeDependencies([], treeEntries);
    expect(techStack).toContainEqual({ name: 'TypeScript', category: 'language' });
  });

  it('does not duplicate TypeScript if already detected from package.json', () => {
    const files = [file('package.json', makePkgJson({}, { typescript: '^5' }))];
    const treeEntries = [blob('package.json'), blob('tsconfig.json')];
    const { techStack } = analyzeDependencies(files, treeEntries);
    const tsEntries = techStack.filter((t) => t.name === 'TypeScript');
    expect(tsEntries.length).toBe(1);
  });

  // ── Invalid JSON in package.json ──

  it('handles invalid JSON in package.json gracefully', () => {
    const files = [file('package.json', '{invalid json}')];
    const treeEntries = [blob('package.json')];
    const { result } = analyzeDependencies(files, treeEntries);
    // Manifest is found (path match), but no deps parsed
    const manifest = result.signals.find((s) => s.name === 'Dependency manifest');
    expect(manifest?.found).toBe(true);
    const tracked = result.signals.find((s) => s.name === 'Dependencies tracked');
    expect(tracked?.found).toBe(false);
  });

  // ── Full score ──

  it('returns high score for full JS project setup', () => {
    const deps = { react: '^18', 'react-dom': '^18' };
    const devDeps = { typescript: '^5', vitest: '^1', vite: '^5' };
    const files = [file('package.json', makePkgJson(deps, devDeps))];
    const treeEntries = [blob('package.json'), blob('package-lock.json'), blob('tsconfig.json')];
    const { result, techStack } = analyzeDependencies(files, treeEntries);
    // 30 (manifest) + 25 (lockfile) + 20 (tracked) + 15 (reasonable) + 10 (tech stack) = 100
    expect(result.score).toBe(100);
    expect(techStack.length).toBeGreaterThan(0);
  });

  it('bloated deps (200+) reduce score by 15', () => {
    const deps: Record<string, string> = {};
    for (let i = 0; i < 200; i++) deps[`pkg-${i}`] = '^1.0.0';
    const files = [file('package.json', makePkgJson(deps))];
    const treeEntries = [blob('package.json'), blob('package-lock.json')];
    const { result } = analyzeDependencies(files, treeEntries);
    // 30 + 25 + 20 + 0 (not reasonable) + 0 (no known framework) = 75
    expect(result.score).toBe(75);
    const sig = result.signals.find((s) => s.name === 'Reasonable dependency count');
    expect(sig?.found).toBe(false);
  });
});
