import type { ReactNode } from 'react';
import {
  type PolicyEvalResult,
  type PolicyEvalRuleResult,
  type PolicySeverity,
} from './policyTypes.js';

export interface PolicyViewProps {
  result: PolicyEvalResult;
  /** Optional action bar shown above the summary (e.g. "New Evaluation"). */
  actions?: ReactNode;
}

/**
 * Authoritative policy-evaluation results view. Both apps render this against
 * a `PolicyEvalResult`:
 *   - browser app projects its `PolicyEvaluation` (from `services/analysis/
 *     policyEngine.ts`) into the shape and supplies `policyName`, `repoLabel`,
 *     and a `categoryLabels` map.
 *   - desktop app projects the gRPC `PolicyResponse` straight through; the
 *     preset name and repo path are passed as optional context.
 *
 * The rule **editor** stays browser-only — this view only renders the result.
 */
export function PolicyView({ result, actions }: PolicyViewProps) {
  return (
    <div className="space-y-6">
      {actions && <div className="flex items-center justify-end">{actions}</div>}

      {/* Summary card */}
      <div
        className={`rounded-2xl border p-6 sm:p-8 ${
          result.passed ? 'border-grade-a/40 bg-grade-a/5' : 'border-grade-f/40 bg-grade-f/5'
        }`}
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className={`flex items-center justify-center h-16 w-16 rounded-2xl ${
                result.passed
                  ? 'bg-grade-a/15 border border-grade-a/30'
                  : 'bg-grade-f/15 border border-grade-f/30'
              }`}
            >
              {result.passed ? <CheckBigIcon /> : <CrossBigIcon />}
            </div>
            <div>
              <h3
                className={`text-2xl font-bold ${result.passed ? 'text-grade-a' : 'text-grade-f'}`}
              >
                {result.passed ? 'POLICY PASSED' : 'POLICY FAILED'}
              </h3>
              {(result.repoLabel || result.policyName) && (
                <p className="text-sm text-text-secondary mt-1">
                  {result.repoLabel && (
                    <>
                      <span className="text-neon font-medium">{result.repoLabel}</span>
                      {result.policyName && ' evaluated against '}
                    </>
                  )}
                  {result.policyName && (
                    <span className="text-text font-medium">{result.policyName}</span>
                  )}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-grade-a">{result.passCount}</div>
              <div className="text-xs text-text-muted uppercase tracking-wider">Passed</div>
            </div>
            <div className="h-10 w-px bg-border" />
            <div className="text-center">
              <div className="text-3xl font-bold text-grade-f">{result.failCount}</div>
              <div className="text-xs text-text-muted uppercase tracking-wider">Failed</div>
            </div>
          </div>
        </div>
      </div>

      {/* Rule results */}
      <div className="rounded-2xl border border-border bg-surface-alt overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h3 className="text-base font-semibold text-text">Rule Results</h3>
        </div>
        <div className="divide-y divide-border">
          {result.results.map((r, idx) => (
            <RuleRow
              key={`${r.rule.id}-${idx}`}
              result={r}
              categoryLabels={result.categoryLabels}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────── primitives ───────────────────────────

function RuleRow({
  result,
  categoryLabels,
}: {
  result: PolicyEvalRuleResult;
  categoryLabels?: Record<string, string>;
}) {
  const { rule } = result;
  const rowBg = result.passed
    ? 'bg-grade-a/[0.02]'
    : rule.severity === 'error'
      ? 'bg-grade-f/[0.03]'
      : rule.severity === 'warning'
        ? 'bg-grade-c/[0.03]'
        : 'bg-neon/[0.02]';

  const ruleTypeLabel = formatRuleTypeLabel(rule.type, rule.category, categoryLabels);

  return (
    <div className={`px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 ${rowBg}`}>
      <div className="shrink-0">
        <ResultBadge passed={result.passed} severity={rule.severity} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-text">{rule.name}</span>
          <SeverityBadge severity={rule.severity} />
          {ruleTypeLabel && (
            <span className="text-xs text-text-muted px-1.5 py-0.5 rounded bg-surface border border-border">
              {ruleTypeLabel}
            </span>
          )}
        </div>
        {rule.description && <p className="text-xs text-text-muted mt-1">{rule.description}</p>}
      </div>

      <div className="shrink-0 text-right sm:min-w-[200px]">
        <div className="text-xs text-text-muted">
          Actual:{' '}
          <span className={`font-semibold ${result.passed ? 'text-grade-a' : 'text-grade-f'}`}>
            {result.actual}
          </span>
        </div>
        <div className="text-xs text-text-muted">
          Expected: <span className="font-semibold text-text">{result.expected}</span>
        </div>
      </div>
    </div>
  );
}

function ResultBadge({ passed, severity }: { passed: boolean; severity: PolicySeverity }) {
  if (passed) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-grade-a/15 text-grade-a border border-grade-a/25">
        <CheckSmallIcon />
        PASS
      </span>
    );
  }
  const failStyles = SEVERITY_BADGE_STYLES[severity];
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border ${failStyles}`}
    >
      <CrossSmallIcon />
      FAIL
    </span>
  );
}

function SeverityBadge({ severity }: { severity: PolicySeverity }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-md text-xs font-semibold border ${SEVERITY_BADGE_STYLES[severity]}`}
    >
      {severity.toUpperCase()}
    </span>
  );
}

const SEVERITY_BADGE_STYLES: Record<PolicySeverity, string> = {
  error: 'bg-grade-f/15 text-grade-f border-grade-f/25',
  warning: 'bg-grade-c/15 text-grade-c border-grade-c/25',
  info: 'bg-neon/15 text-neon border-neon/25',
};

function formatRuleTypeLabel(
  type: string,
  category: string | undefined,
  categoryLabels: Record<string, string> | undefined,
): string {
  if (type === 'overall-score') return 'Overall Score';
  if (type === 'signal') return 'Signal';
  if (type === 'category-score') {
    if (!category) return 'Category Score';
    return categoryLabels?.[category] || titleCase(category);
  }
  return type;
}

function titleCase(s: string): string {
  return s
    .replace(/[-_]/g, ' ')
    .split(' ')
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : word))
    .join(' ');
}

// ─────────────────────────── icons ───────────────────────────

function CheckBigIcon() {
  return (
    <svg className="h-8 w-8 text-grade-a" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2.5}
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function CrossBigIcon() {
  return (
    <svg className="h-8 w-8 text-grade-f" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2.5}
        d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function CheckSmallIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function CrossSmallIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2.5}
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
}
