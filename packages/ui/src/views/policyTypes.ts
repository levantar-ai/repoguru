// Authoritative shape consumed by <PolicyView />. The browser's
// `PolicyEvaluation` and the CLI's `PolicyResponse` both project into this
// shape — see PolicyView.tsx for the projection helpers.

export type PolicySeverity = 'error' | 'warning' | 'info';

export interface PolicyEvalRule {
  id: string;
  name: string;
  description: string;
  /** Wire convention: 'overall-score' | 'category-score' | 'signal'. */
  type: string;
  /** Wire convention: '>=' | '>' | '<=' | '<' | '==' | 'exists' | 'not-exists'. */
  operator: string;
  value?: number;
  /** Category key for `type === 'category-score'`. */
  category?: string;
  /** Signal name for `type === 'signal'`. */
  signal?: string;
  severity: PolicySeverity;
}

export interface PolicyEvalRuleResult {
  rule: PolicyEvalRule;
  passed: boolean;
  /** Renderable description of the actual measured value. */
  actual: string;
  /** Renderable description of the threshold (operator + value). */
  expected: string;
}

export interface PolicyEvalResult {
  passed: boolean;
  passCount: number;
  failCount: number;
  results: PolicyEvalRuleResult[];
  /** Optional display label for the policy itself (the desktop CLI evaluates by
   *  preset name; the browser knows the full PolicySet). */
  policyName?: string;
  /** Optional display label for the repo being evaluated. */
  repoLabel?: string;
  /** Optional category-key → friendly-label map. The browser supplies its
   *  CATEGORY_LABELS; the desktop omits it (falls back to the raw key). */
  categoryLabels?: Record<string, string>;
}
