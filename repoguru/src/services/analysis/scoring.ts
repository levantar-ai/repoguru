import type { CategoryResult, LetterGrade } from '../../types';
import { scoreToGrade } from '../../utils/formatters';

export function computeOverallScore(categories: CategoryResult[]): number {
  let totalWeight = 0;
  let weightedSum = 0;

  for (const cat of categories) {
    weightedSum += cat.score * cat.weight;
    totalWeight += cat.weight;
  }

  if (totalWeight === 0) return 0;
  return Math.round(weightedSum / totalWeight);
}

export function computeGrade(score: number): LetterGrade {
  return scoreToGrade(score);
}

export function generateStrengths(categories: CategoryResult[]): string[] {
  const strengths: string[] = [];

  for (const cat of categories) {
    if (cat.score >= 80) {
      const topSignals = cat.signals
        .filter((s) => s.found)
        .slice(0, 2)
        .map((s) => s.name);
      if (topSignals.length > 0) {
        strengths.push(`Strong ${cat.label.toLowerCase()}: ${topSignals.join(', ')}`);
      }
    }
  }

  return strengths;
}

export function generateRisks(categories: CategoryResult[]): string[] {
  const risks: string[] = [];

  for (const cat of categories) {
    if (cat.score < 40) {
      const missingSignals = cat.signals
        .filter((s) => !s.found)
        .slice(0, 2)
        .map((s) => s.name);
      if (missingSignals.length > 0) {
        risks.push(`Weak ${cat.label.toLowerCase()}: missing ${missingSignals.join(', ')}`);
      }
    }
  }

  return risks;
}

export function generateNextSteps(categories: CategoryResult[]): string[] {
  const steps: string[] = [];

  // Sort by score ascending to prioritize weakest areas
  const sorted = [...categories].sort((a, b) => a.score - b.score);

  for (const cat of sorted.slice(0, 3)) {
    const missing = cat.signals.filter((s) => !s.found);
    if (missing.length > 0) {
      steps.push(
        `Add ${missing[0].name.toLowerCase()} to improve ${cat.label.toLowerCase()} score`,
      );
    }
  }

  return steps;
}
