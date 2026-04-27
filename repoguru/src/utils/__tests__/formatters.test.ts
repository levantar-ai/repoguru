import { describe, it, expect } from 'vitest';
import {
  scoreToGrade,
  formatNumber,
  formatDate,
  gradeColorClass,
  gradeBgClass,
} from '../formatters';
import type { LetterGrade } from '../../types';

// ── scoreToGrade ──

describe('scoreToGrade', () => {
  it('returns A for scores >= 85', () => {
    expect(scoreToGrade(85)).toBe('A');
    expect(scoreToGrade(100)).toBe('A');
    expect(scoreToGrade(95)).toBe('A');
  });

  it('returns B for scores 70-84', () => {
    expect(scoreToGrade(70)).toBe('B');
    expect(scoreToGrade(84)).toBe('B');
  });

  it('returns C for scores 55-69', () => {
    expect(scoreToGrade(55)).toBe('C');
    expect(scoreToGrade(69)).toBe('C');
  });

  it('returns D for scores 40-54', () => {
    expect(scoreToGrade(40)).toBe('D');
    expect(scoreToGrade(54)).toBe('D');
  });

  it('returns F for scores below 40', () => {
    expect(scoreToGrade(39)).toBe('F');
    expect(scoreToGrade(0)).toBe('F');
  });

  it('handles boundary values exactly at thresholds', () => {
    expect(scoreToGrade(85)).toBe('A');
    expect(scoreToGrade(70)).toBe('B');
    expect(scoreToGrade(55)).toBe('C');
    expect(scoreToGrade(40)).toBe('D');
  });
});

// ── formatNumber ──

describe('formatNumber', () => {
  it('formats millions', () => {
    expect(formatNumber(1_500_000)).toBe('1.5M');
  });

  it('formats thousands', () => {
    expect(formatNumber(2_500)).toBe('2.5k');
  });

  it('returns raw number for small values', () => {
    expect(formatNumber(42)).toBe('42');
  });

  it('formats exactly 1 million', () => {
    expect(formatNumber(1_000_000)).toBe('1.0M');
  });

  it('formats exactly 1 thousand', () => {
    expect(formatNumber(1_000)).toBe('1.0k');
  });

  it('formats zero', () => {
    expect(formatNumber(0)).toBe('0');
  });

  it('formats 999 as raw number', () => {
    expect(formatNumber(999)).toBe('999');
  });
});

// ── formatDate ──

describe('formatDate', () => {
  it('formats an ISO date string to a non-empty string', () => {
    const result = formatDate('2024-06-15T10:30:00Z');
    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('includes the year in the formatted output', () => {
    const result = formatDate('2024-06-15T10:30:00Z');
    expect(result).toContain('2024');
  });

  it('formats a different date correctly', () => {
    const result = formatDate('2023-01-01T00:00:00Z');
    expect(result).toContain('2023');
    expect(result.length).toBeGreaterThan(0);
  });

  it('handles date-only ISO string', () => {
    const result = formatDate('2025-12-25');
    expect(result).toBeTruthy();
    expect(result).toContain('2025');
  });
});

// ── gradeColorClass ──

describe('gradeColorClass', () => {
  it('returns text-grade-a for grade A', () => {
    expect(gradeColorClass('A')).toBe('text-grade-a');
  });

  it('returns text-grade-b for grade B', () => {
    expect(gradeColorClass('B')).toBe('text-grade-b');
  });

  it('returns text-grade-c for grade C', () => {
    expect(gradeColorClass('C')).toBe('text-grade-c');
  });

  it('returns text-grade-d for grade D', () => {
    expect(gradeColorClass('D')).toBe('text-grade-d');
  });

  it('returns text-grade-f for grade F', () => {
    expect(gradeColorClass('F')).toBe('text-grade-f');
  });

  it('returns correct class for every valid grade', () => {
    const grades: LetterGrade[] = ['A', 'B', 'C', 'D', 'F'];
    for (const grade of grades) {
      const result = gradeColorClass(grade);
      expect(result).toBe(`text-grade-${grade.toLowerCase()}`);
    }
  });
});

// ── gradeBgClass ──

describe('gradeBgClass', () => {
  it('returns bg-grade-a for grade A', () => {
    expect(gradeBgClass('A')).toBe('bg-grade-a');
  });

  it('returns bg-grade-b for grade B', () => {
    expect(gradeBgClass('B')).toBe('bg-grade-b');
  });

  it('returns bg-grade-c for grade C', () => {
    expect(gradeBgClass('C')).toBe('bg-grade-c');
  });

  it('returns bg-grade-d for grade D', () => {
    expect(gradeBgClass('D')).toBe('bg-grade-d');
  });

  it('returns bg-grade-f for grade F', () => {
    expect(gradeBgClass('F')).toBe('bg-grade-f');
  });

  it('returns correct class for every valid grade', () => {
    const grades: LetterGrade[] = ['A', 'B', 'C', 'D', 'F'];
    for (const grade of grades) {
      const result = gradeBgClass(grade);
      expect(result).toBe(`bg-grade-${grade.toLowerCase()}`);
    }
  });
});
