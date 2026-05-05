import { describe, it, expect } from 'vitest';
import { analyzeCodeQuality } from '../codeQualityAnalyzer';
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

describe('analyzeCodeQuality', () => {
  it('returns score 0 for empty inputs', () => {
    const result = analyzeCodeQuality([], []);
    expect(result.key).toBe('codeQuality');
    expect(result.label).toBe('Code Quality');
    expect(result.score).toBe(0);
    expect(result.weight).toBe(0.15);
    for (const s of result.signals) {
      expect(s.found).toBe(false);
    }
  });

  // ── Linter detection ──

  it('gives +20 for eslint.config.js (linter detected)', () => {
    const files = [file('eslint.config.js', 'module.exports = {}')];
    const result = analyzeCodeQuality(files, []);
    expect(result.score).toBe(20);
    const sig = result.signals.find((s) => s.name === 'Linter configured');
    expect(sig?.found).toBe(true);
    expect(sig?.details).toBe('ESLint');
  });

  it('detects ESLint via .eslintrc.json', () => {
    const files = [file('.eslintrc.json', '{}')];
    const result = analyzeCodeQuality(files, []);
    const sig = result.signals.find((s) => s.name === 'Linter configured');
    expect(sig?.found).toBe(true);
    expect(sig?.details).toBe('ESLint');
  });

  it('detects ESLint via .eslintrc.js', () => {
    const files = [file('.eslintrc.js', 'module.exports = {}')];
    const result = analyzeCodeQuality(files, []);
    const sig = result.signals.find((s) => s.name === 'Linter configured');
    expect(sig?.found).toBe(true);
  });

  it('detects ESLint via eslint.config.mjs', () => {
    const result = analyzeCodeQuality([], [blob('eslint.config.mjs')]);
    const sig = result.signals.find((s) => s.name === 'Linter configured');
    expect(sig?.found).toBe(true);
    expect(sig?.details).toBe('ESLint');
  });

  it('detects Flake8 linter from .flake8', () => {
    const files = [file('.flake8', '[flake8]\nmax-line-length = 120')];
    const result = analyzeCodeQuality(files, []);
    const sig = result.signals.find((s) => s.name === 'Linter configured');
    expect(sig?.found).toBe(true);
    expect(sig?.details).toBe('Flake8');
  });

  it('detects Pylint from .pylintrc', () => {
    const result = analyzeCodeQuality([], [blob('.pylintrc')]);
    const sig = result.signals.find((s) => s.name === 'Linter configured');
    expect(sig?.found).toBe(true);
    expect(sig?.details).toBe('Pylint');
  });

  it('detects Biome from biome.json', () => {
    const result = analyzeCodeQuality([], [blob('biome.json')]);
    const sig = result.signals.find((s) => s.name === 'Linter configured');
    expect(sig?.found).toBe(true);
    expect(sig?.details).toBe('Biome');
  });

  it('detects golangci-lint from .golangci.yml', () => {
    const result = analyzeCodeQuality([], [blob('.golangci.yml')]);
    const sig = result.signals.find((s) => s.name === 'Linter configured');
    expect(sig?.found).toBe(true);
    expect(sig?.details).toBe('golangci-lint');
  });

  it('detects linter from treePaths when not in files', () => {
    const treeEntries = [blob('.eslintrc.json')];
    const result = analyzeCodeQuality([], treeEntries);
    const sig = result.signals.find((s) => s.name === 'Linter configured');
    expect(sig?.found).toBe(true);
  });

  // ── Formatter detection ──

  it('gives +15 for Prettier config (formatter detected)', () => {
    const files = [file('.prettierrc', '{}')];
    const result = analyzeCodeQuality(files, []);
    expect(result.score).toBe(15);
    const sig = result.signals.find((s) => s.name === 'Formatter configured');
    expect(sig?.found).toBe(true);
    expect(sig?.details).toBe('Prettier');
  });

  it('detects Prettier from .prettierrc.json', () => {
    const result = analyzeCodeQuality([], [blob('.prettierrc.json')]);
    const sig = result.signals.find((s) => s.name === 'Formatter configured');
    expect(sig?.found).toBe(true);
    expect(sig?.details).toBe('Prettier');
  });

  it('detects Prettier from prettier.config.js', () => {
    const result = analyzeCodeQuality([file('prettier.config.js', '')], []);
    const sig = result.signals.find((s) => s.name === 'Formatter configured');
    expect(sig?.found).toBe(true);
  });

  it('detects rustfmt from rustfmt.toml', () => {
    const result = analyzeCodeQuality([], [blob('rustfmt.toml')]);
    const sig = result.signals.find((s) => s.name === 'Formatter configured');
    expect(sig?.found).toBe(true);
    expect(sig?.details).toBe('rustfmt');
  });

  it('detects clang-format', () => {
    const result = analyzeCodeQuality([], [blob('.clang-format')]);
    const sig = result.signals.find((s) => s.name === 'Formatter configured');
    expect(sig?.found).toBe(true);
    expect(sig?.details).toBe('clang-format');
  });

  // ── TypeScript ──

  it('gives +15 for tsconfig.json (TypeScript)', () => {
    const files = [file('tsconfig.json', '{}')];
    const result = analyzeCodeQuality(files, []);
    expect(result.score).toBe(15);
    const sig = result.signals.find((s) => s.name === 'Type system');
    expect(sig?.found).toBe(true);
    expect(sig?.details).toBe('TypeScript');
  });

  it('detects TypeScript from treePaths', () => {
    const result = analyzeCodeQuality([], [blob('tsconfig.json')]);
    const sig = result.signals.find((s) => s.name === 'Type system');
    expect(sig?.found).toBe(true);
  });

  // ── Git hooks ──

  it('gives +10 for .husky/pre-commit (git hooks)', () => {
    const files = [file('.husky/pre-commit', '#!/bin/sh\nnpx lint-staged')];
    const result = analyzeCodeQuality(files, []);
    expect(result.score).toBe(10);
    const sig = result.signals.find((s) => s.name === 'Git hooks');
    expect(sig?.found).toBe(true);
    expect(sig?.details).toBe('Husky');
  });

  it('detects Husky from treePaths (.husky/pre-commit)', () => {
    const result = analyzeCodeQuality([], [blob('.husky/pre-commit')]);
    const sig = result.signals.find((s) => s.name === 'Git hooks');
    expect(sig?.found).toBe(true);
    expect(sig?.details).toBe('Husky');
  });

  it('detects Husky from .husky tree directory', () => {
    const result = analyzeCodeQuality([], [blob('.husky')]);
    const sig = result.signals.find((s) => s.name === 'Git hooks');
    expect(sig?.found).toBe(true);
    expect(sig?.details).toBe('Husky');
  });

  it('detects pre-commit from .pre-commit-config.yaml', () => {
    const files = [file('.pre-commit-config.yaml', 'repos:\n  - repo: ...')];
    const result = analyzeCodeQuality(files, []);
    const sig = result.signals.find((s) => s.name === 'Git hooks');
    expect(sig?.found).toBe(true);
    expect(sig?.details).toBe('pre-commit');
  });

  it('detects pre-commit from treePaths', () => {
    const result = analyzeCodeQuality([], [blob('.pre-commit-config.yaml')]);
    const sig = result.signals.find((s) => s.name === 'Git hooks');
    expect(sig?.found).toBe(true);
    expect(sig?.details).toBe('pre-commit');
  });

  it('detects Lefthook from .lefthook.yml', () => {
    const result = analyzeCodeQuality([], [blob('.lefthook.yml')]);
    const sig = result.signals.find((s) => s.name === 'Git hooks');
    expect(sig?.found).toBe(true);
    expect(sig?.details).toBe('Lefthook');
  });

  it('detects Lefthook from lefthook.yml (without dot)', () => {
    const result = analyzeCodeQuality([], [blob('lefthook.yml')]);
    const sig = result.signals.find((s) => s.name === 'Git hooks');
    expect(sig?.found).toBe(true);
    expect(sig?.details).toBe('Lefthook');
  });

  // ── Tests detection ──

  it('gives +20 for test files (.test.ts in tree)', () => {
    const treeEntries = [blob('src/utils.test.ts')];
    const result = analyzeCodeQuality([], treeEntries);
    expect(result.score).toBe(20);
    const sig = result.signals.find((s) => s.name === 'Tests present');
    expect(sig?.found).toBe(true);
    expect(sig?.details).toContain('1 test files');
  });

  it('detects .spec.tsx test files', () => {
    const treeEntries = [blob('src/App.spec.tsx')];
    const result = analyzeCodeQuality([], treeEntries);
    const sig = result.signals.find((s) => s.name === 'Tests present');
    expect(sig?.found).toBe(true);
  });

  it('detects Go test files (_test.go)', () => {
    const treeEntries = [blob('main_test.go')];
    const result = analyzeCodeQuality([], treeEntries);
    const sig = result.signals.find((s) => s.name === 'Tests present');
    expect(sig?.found).toBe(true);
  });

  it('detects Rust test files (_test.rs)', () => {
    const treeEntries = [blob('lib_test.rs')];
    const result = analyzeCodeQuality([], treeEntries);
    const sig = result.signals.find((s) => s.name === 'Tests present');
    expect(sig?.found).toBe(true);
  });

  it('detects Python test files (test_*.py)', () => {
    const treeEntries = [blob('test_utils.py')];
    const result = analyzeCodeQuality([], treeEntries);
    const sig = result.signals.find((s) => s.name === 'Tests present');
    expect(sig?.found).toBe(true);
  });

  it('detects Ruby spec files (_spec.rb)', () => {
    const treeEntries = [blob('models/user_spec.rb')];
    const result = analyzeCodeQuality([], treeEntries);
    const sig = result.signals.find((s) => s.name === 'Tests present');
    expect(sig?.found).toBe(true);
  });

  it('detects test directories', () => {
    const treeEntries = [tree('tests'), tree('__tests__')];
    const result = analyzeCodeQuality([], treeEntries);
    const sig = result.signals.find((s) => s.name === 'Tests present');
    expect(sig?.found).toBe(true);
    expect(sig?.details).toContain('tests');
  });

  it('counts multiple test files', () => {
    const treeEntries = [blob('src/a.test.ts'), blob('src/b.test.tsx'), blob('src/c.spec.ts')];
    const result = analyzeCodeQuality([], treeEntries);
    const sig = result.signals.find((s) => s.name === 'Tests present');
    expect(sig?.found).toBe(true);
    expect(sig?.details).toContain('3 test files');
  });

  // ── CI runs tests ──

  it('gives +10 for CI test commands in workflow', () => {
    const files = [file('.github/workflows/ci.yml', 'steps:\n  - run: npm test')];
    const result = analyzeCodeQuality(files, []);
    const sig = result.signals.find((s) => s.name === 'CI runs tests');
    expect(sig?.found).toBe(true);
    expect(sig?.details).toBe('via npm test');
  });

  it('detects vitest in CI workflow', () => {
    const files = [file('.github/workflows/ci.yml', 'steps:\n  - run: vitest run')];
    const result = analyzeCodeQuality(files, []);
    const sig = result.signals.find((s) => s.name === 'CI runs tests');
    expect(sig?.found).toBe(true);
    expect(sig?.details).toBe('via Vitest');
  });

  it('detects pytest in CI workflow', () => {
    const files = [file('.github/workflows/test.yml', 'steps:\n  - run: pytest')];
    const result = analyzeCodeQuality(files, []);
    const sig = result.signals.find((s) => s.name === 'CI runs tests');
    expect(sig?.found).toBe(true);
    expect(sig?.details).toBe('via pytest');
  });

  it('detects cargo test in CI workflow', () => {
    const files = [file('.github/workflows/ci.yml', 'steps:\n  - run: cargo test')];
    const result = analyzeCodeQuality(files, []);
    const sig = result.signals.find((s) => s.name === 'CI runs tests');
    expect(sig?.found).toBe(true);
    expect(sig?.details).toBe('via cargo test');
  });

  it('does not detect CI test from non-workflow files', () => {
    const files = [file('Makefile', 'test:\n\tnpm test')];
    const result = analyzeCodeQuality(files, []);
    const sig = result.signals.find((s) => s.name === 'CI runs tests');
    expect(sig?.found).toBe(false);
  });

  // ── EditorConfig ──

  // Note: .editorconfig is in both FORMATTER_FILES and checked directly for EditorConfig,
  // so it counts as both formatter (+15) and editorconfig (+10) = 25 total
  it('gives +25 for .editorconfig (formatter + editorconfig)', () => {
    const files = [file('.editorconfig', 'root = true')];
    const result = analyzeCodeQuality(files, []);
    expect(result.score).toBe(25);
    const sig = result.signals.find((s) => s.name === 'EditorConfig');
    expect(sig?.found).toBe(true);
    const formatter = result.signals.find((s) => s.name === 'Formatter configured');
    expect(formatter?.found).toBe(true);
    expect(formatter?.details).toBe('EditorConfig');
  });

  it('detects .editorconfig from treePaths', () => {
    const result = analyzeCodeQuality([], [blob('.editorconfig')]);
    const sig = result.signals.find((s) => s.name === 'EditorConfig');
    expect(sig?.found).toBe(true);
  });

  // ── Full score ──

  it('returns score 100 for full setup', () => {
    const files = [
      file('eslint.config.js', 'module.exports = {}'),
      file('.prettierrc', '{}'),
      file('tsconfig.json', '{}'),
      file('.husky/pre-commit', '#!/bin/sh'),
      file('.editorconfig', 'root = true'),
      file('.github/workflows/ci.yml', 'steps:\n  - run: npm test'),
    ];
    const treeEntries = [
      blob('eslint.config.js'),
      blob('.prettierrc'),
      blob('tsconfig.json'),
      blob('.husky/pre-commit'),
      blob('.editorconfig'),
      blob('.github/workflows/ci.yml'),
      blob('src/app.test.ts'),
    ];
    const result = analyzeCodeQuality(files, treeEntries);
    // 20 (linter) + 15 (formatter) + 15 (TS) + 10 (hooks) + 20 (tests) + 10 (CI tests) + 10 (editorconfig) = 100
    expect(result.score).toBe(100);
  });
});
