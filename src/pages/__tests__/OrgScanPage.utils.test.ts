import { describe, it, expect } from 'vitest';
import { getCategoryScore } from '../orgScanUtils';
import type { CategoryResult, CategoryKey } from '../../types';

// ── Helper to create a CategoryResult ──

function makeCategoryResult(key: CategoryKey, score: number): CategoryResult {
  return {
    key,
    label: key,
    score,
    weight: 0.15,
    signals: [],
  };
}

describe('getCategoryScore', () => {
  it('returns the score for a matching category key', () => {
    const categories: CategoryResult[] = [
      makeCategoryResult('documentation', 85),
      makeCategoryResult('security', 70),
      makeCategoryResult('cicd', 60),
    ];
    expect(getCategoryScore(categories, 'security')).toBe(70);
  });

  it('returns the score for the first matching key', () => {
    const categories: CategoryResult[] = [
      makeCategoryResult('documentation', 85),
      makeCategoryResult('codeQuality', 92),
      makeCategoryResult('license', 50),
    ];
    expect(getCategoryScore(categories, 'codeQuality')).toBe(92);
  });

  it('returns 0 when category key is not found', () => {
    const categories: CategoryResult[] = [
      makeCategoryResult('documentation', 85),
      makeCategoryResult('security', 70),
    ];
    expect(getCategoryScore(categories, 'community')).toBe(0);
  });

  it('returns 0 for an empty categories array', () => {
    expect(getCategoryScore([], 'documentation')).toBe(0);
  });

  it('returns 0 score when the matching category has score 0', () => {
    const categories: CategoryResult[] = [makeCategoryResult('cicd', 0)];
    expect(getCategoryScore(categories, 'cicd')).toBe(0);
  });

  it('returns 100 score when the matching category has score 100', () => {
    const categories: CategoryResult[] = [makeCategoryResult('dependencies', 100)];
    expect(getCategoryScore(categories, 'dependencies')).toBe(100);
  });

  it('works for all 7 category keys', () => {
    const allKeys: CategoryKey[] = [
      'documentation',
      'security',
      'cicd',
      'dependencies',
      'codeQuality',
      'license',
      'community',
    ];
    const categories: CategoryResult[] = allKeys.map((key, i) =>
      makeCategoryResult(key, (i + 1) * 10),
    );
    allKeys.forEach((key, i) => {
      expect(getCategoryScore(categories, key)).toBe((i + 1) * 10);
    });
  });
});
