import { describe, it, expect } from 'vitest';
import {
  computeOverallScore,
  computeGrade,
  generateStrengths,
  generateRisks,
  generateNextSteps,
} from '../scoring';
import type { CategoryResult, Signal } from '../../../types';

function makeCategory(
  score: number,
  weight: number,
  overrides?: Partial<CategoryResult>,
): CategoryResult {
  return {
    key: 'documentation',
    label: 'Documentation',
    score,
    weight,
    signals: [],
    ...overrides,
  };
}

function makeSignal(name: string, found: boolean, details?: string): Signal {
  return { name, found, details };
}

// ── computeOverallScore ──

describe('computeOverallScore', () => {
  it('computes weighted average correctly', () => {
    const categories = [makeCategory(100, 0.5), makeCategory(50, 0.5)];
    expect(computeOverallScore(categories)).toBe(75);
  });

  it('returns 0 for empty categories', () => {
    expect(computeOverallScore([])).toBe(0);
  });

  it('handles unequal weights', () => {
    const categories = [makeCategory(100, 0.8), makeCategory(0, 0.2)];
    expect(computeOverallScore(categories)).toBe(80);
  });

  it('rounds the result to nearest integer', () => {
    // 33 * 0.5 + 67 * 0.5 = 50
    const categories = [makeCategory(33, 0.5), makeCategory(67, 0.5)];
    expect(computeOverallScore(categories)).toBe(50);
  });
});

// ── computeGrade ──

describe('computeGrade', () => {
  it('maps scores to correct grades', () => {
    expect(computeGrade(95)).toBe('A');
    expect(computeGrade(85)).toBe('A');
    expect(computeGrade(75)).toBe('B');
    expect(computeGrade(70)).toBe('B');
    expect(computeGrade(60)).toBe('C');
    expect(computeGrade(55)).toBe('C');
    expect(computeGrade(45)).toBe('D');
    expect(computeGrade(40)).toBe('D');
    expect(computeGrade(20)).toBe('F');
    expect(computeGrade(0)).toBe('F');
  });
});

// ── generateStrengths ──

describe('generateStrengths', () => {
  it('returns strength string for category scoring >= 80 with found signals', () => {
    const categories = [
      makeCategory(90, 0.2, {
        key: 'documentation',
        label: 'Documentation',
        signals: [
          makeSignal('README', true),
          makeSignal('CONTRIBUTING', true),
          makeSignal('CHANGELOG', false),
        ],
      }),
    ];
    const result = generateStrengths(categories);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe('Strong documentation: README, CONTRIBUTING');
  });

  it('uses only the top 2 found signals', () => {
    const categories = [
      makeCategory(85, 0.2, {
        key: 'security',
        label: 'Security',
        signals: [
          makeSignal('SECURITY.md', true),
          makeSignal('Dependabot', true),
          makeSignal('Branch protection', true),
        ],
      }),
    ];
    const result = generateStrengths(categories);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe('Strong security: SECURITY.md, Dependabot');
  });

  it('does not include categories with score < 80', () => {
    const categories = [
      makeCategory(79, 0.2, {
        key: 'cicd',
        label: 'CI/CD',
        signals: [makeSignal('GitHub Actions', true)],
      }),
    ];
    const result = generateStrengths(categories);
    expect(result).toHaveLength(0);
  });

  it('does not include categories with score >= 80 but no found signals', () => {
    const categories = [
      makeCategory(95, 0.2, {
        key: 'license',
        label: 'License',
        signals: [makeSignal('LICENSE file', false)],
      }),
    ];
    const result = generateStrengths(categories);
    expect(result).toHaveLength(0);
  });

  it('handles multiple qualifying categories', () => {
    const categories = [
      makeCategory(90, 0.2, {
        key: 'documentation',
        label: 'Documentation',
        signals: [makeSignal('README', true)],
      }),
      makeCategory(85, 0.15, {
        key: 'cicd',
        label: 'CI/CD',
        signals: [makeSignal('GitHub Actions', true)],
      }),
    ];
    const result = generateStrengths(categories);
    expect(result).toHaveLength(2);
    expect(result[0]).toContain('Strong documentation');
    expect(result[1]).toContain('Strong ci/cd');
  });

  it('returns empty array when no categories qualify', () => {
    const categories = [makeCategory(50, 0.2)];
    const result = generateStrengths(categories);
    expect(result).toHaveLength(0);
  });

  it('handles category with score exactly 80', () => {
    const categories = [
      makeCategory(80, 0.2, {
        key: 'community',
        label: 'Community',
        signals: [makeSignal('CODE_OF_CONDUCT', true)],
      }),
    ];
    const result = generateStrengths(categories);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe('Strong community: CODE_OF_CONDUCT');
  });
});

// ── generateRisks ──

describe('generateRisks', () => {
  it('returns risk string for category scoring < 40 with missing signals', () => {
    const categories = [
      makeCategory(20, 0.15, {
        key: 'security',
        label: 'Security',
        signals: [
          makeSignal('SECURITY.md', false),
          makeSignal('Dependabot', false),
          makeSignal('Branch protection', true),
        ],
      }),
    ];
    const result = generateRisks(categories);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe('Weak security: missing SECURITY.md, Dependabot');
  });

  it('uses only the top 2 missing signals', () => {
    const categories = [
      makeCategory(10, 0.2, {
        key: 'documentation',
        label: 'Documentation',
        signals: [
          makeSignal('README', false),
          makeSignal('CONTRIBUTING', false),
          makeSignal('CHANGELOG', false),
        ],
      }),
    ];
    const result = generateRisks(categories);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe('Weak documentation: missing README, CONTRIBUTING');
  });

  it('does not include categories with score >= 40', () => {
    const categories = [
      makeCategory(40, 0.15, {
        key: 'cicd',
        label: 'CI/CD',
        signals: [makeSignal('GitHub Actions', false)],
      }),
    ];
    const result = generateRisks(categories);
    expect(result).toHaveLength(0);
  });

  it('does not include categories with score < 40 but no missing signals', () => {
    const categories = [
      makeCategory(10, 0.1, {
        key: 'license',
        label: 'License',
        signals: [makeSignal('LICENSE file', true)],
      }),
    ];
    const result = generateRisks(categories);
    expect(result).toHaveLength(0);
  });

  it('handles multiple risky categories', () => {
    const categories = [
      makeCategory(10, 0.2, {
        key: 'documentation',
        label: 'Documentation',
        signals: [makeSignal('README', false)],
      }),
      makeCategory(5, 0.15, {
        key: 'security',
        label: 'Security',
        signals: [makeSignal('SECURITY.md', false)],
      }),
    ];
    const result = generateRisks(categories);
    expect(result).toHaveLength(2);
  });

  it('returns empty array when no categories qualify', () => {
    const categories = [makeCategory(60, 0.2)];
    const result = generateRisks(categories);
    expect(result).toHaveLength(0);
  });
});

// ── generateNextSteps ──

describe('generateNextSteps', () => {
  it('returns top 3 lowest-scoring categories with their first missing signal', () => {
    const categories = [
      makeCategory(90, 0.2, {
        key: 'documentation',
        label: 'Documentation',
        signals: [makeSignal('README', true)],
      }),
      makeCategory(30, 0.15, {
        key: 'security',
        label: 'Security',
        signals: [makeSignal('SECURITY.md', false), makeSignal('Dependabot', false)],
      }),
      makeCategory(20, 0.15, {
        key: 'cicd',
        label: 'CI/CD',
        signals: [makeSignal('GitHub Actions', false)],
      }),
      makeCategory(50, 0.15, {
        key: 'dependencies',
        label: 'Dependencies',
        signals: [makeSignal('Lock file', false)],
      }),
      makeCategory(10, 0.1, {
        key: 'license',
        label: 'License',
        signals: [makeSignal('LICENSE file', false)],
      }),
    ];
    const result = generateNextSteps(categories);
    expect(result).toHaveLength(3);
    // Sorted by score ascending: license(10), cicd(20), security(30)
    expect(result[0]).toBe('Add license file to improve license score');
    expect(result[1]).toBe('Add github actions to improve ci/cd score');
    expect(result[2]).toBe('Add security.md to improve security score');
  });

  it('skips categories with no missing signals', () => {
    const categories = [
      makeCategory(20, 0.15, {
        key: 'cicd',
        label: 'CI/CD',
        signals: [makeSignal('GitHub Actions', true)], // all found
      }),
      makeCategory(30, 0.15, {
        key: 'security',
        label: 'Security',
        signals: [makeSignal('SECURITY.md', false)],
      }),
    ];
    const result = generateNextSteps(categories);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe('Add security.md to improve security score');
  });

  it('returns fewer than 3 steps when fewer categories have missing signals', () => {
    const categories = [
      makeCategory(50, 0.2, {
        key: 'documentation',
        label: 'Documentation',
        signals: [makeSignal('README', false)],
      }),
    ];
    const result = generateNextSteps(categories);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe('Add readme to improve documentation score');
  });

  it('returns empty array when all signals are found', () => {
    const categories = [
      makeCategory(90, 0.2, {
        key: 'documentation',
        label: 'Documentation',
        signals: [makeSignal('README', true)],
      }),
      makeCategory(85, 0.15, {
        key: 'security',
        label: 'Security',
        signals: [makeSignal('SECURITY.md', true)],
      }),
    ];
    const result = generateNextSteps(categories);
    expect(result).toHaveLength(0);
  });

  it('returns empty array when categories have no signals at all', () => {
    const categories = [makeCategory(10, 0.2), makeCategory(20, 0.15)];
    const result = generateNextSteps(categories);
    expect(result).toHaveLength(0);
  });

  it('uses first missing signal name lowercased in step message', () => {
    const categories = [
      makeCategory(25, 0.15, {
        key: 'codeQuality',
        label: 'Code Quality',
        signals: [makeSignal('Linter Config', false), makeSignal('EditorConfig', false)],
      }),
    ];
    const result = generateNextSteps(categories);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe('Add linter config to improve code quality score');
  });
});
