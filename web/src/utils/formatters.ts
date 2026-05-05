import type { LetterGrade } from '../types';
import { GRADE_THRESHOLDS } from './constants';

export function scoreToGrade(score: number): LetterGrade {
  if (score >= GRADE_THRESHOLDS.A) return 'A';
  if (score >= GRADE_THRESHOLDS.B) return 'B';
  if (score >= GRADE_THRESHOLDS.C) return 'C';
  if (score >= GRADE_THRESHOLDS.D) return 'D';
  return 'F';
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toString();
}

export function gradeColorClass(grade: LetterGrade): string {
  const map: Record<LetterGrade, string> = {
    A: 'text-grade-a',
    B: 'text-grade-b',
    C: 'text-grade-c',
    D: 'text-grade-d',
    F: 'text-grade-f',
  };
  return map[grade];
}

export function gradeBgClass(grade: LetterGrade): string {
  const map: Record<LetterGrade, string> = {
    A: 'bg-grade-a',
    B: 'bg-grade-b',
    C: 'bg-grade-c',
    D: 'bg-grade-d',
    F: 'bg-grade-f',
  };
  return map[grade];
}
