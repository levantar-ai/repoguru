import type { CategoryResult } from '../types';

type CategoryKey = CategoryResult['key'];

/** Get a category score from a categories array, defaulting to 0 if not found. */
export function getCategoryScore(categories: CategoryResult[], key: CategoryKey): number {
  return categories.find((c) => c.key === key)?.score ?? 0;
}
