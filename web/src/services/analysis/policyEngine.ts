import type {
  PolicySet,
  PolicyRule,
  PolicyEvaluation,
  PolicyRuleResult,
  AnalysisReport,
} from '../../types';

/**
 * Evaluates a policy set against an analysis report.
 * Returns detailed pass/fail results for each rule.
 */
export function evaluatePolicy(policy: PolicySet, report: AnalysisReport): PolicyEvaluation {
  const results: PolicyRuleResult[] = policy.rules.map((rule) => evaluateRule(rule, report));

  const passCount = results.filter((r) => r.passed).length;
  const failCount = results.filter((r) => !r.passed).length;

  return {
    policy,
    repo: `${report.repo.owner}/${report.repo.repo}`,
    results,
    passed: failCount === 0,
    passCount,
    failCount,
    evaluatedAt: new Date().toISOString(),
  };
}

function evaluateRule(rule: PolicyRule, report: AnalysisReport): PolicyRuleResult {
  switch (rule.type) {
    case 'overall-score':
      return evaluateScoreRule(rule, report.overallScore, 'Overall');

    case 'category-score': {
      const category = report.categories.find((c) => c.key === rule.category);
      const score = category?.score ?? 0;
      const label = category?.label ?? rule.category ?? 'Unknown';
      return evaluateScoreRule(rule, score, label);
    }

    case 'signal':
      return evaluateSignalRule(rule, report);

    default:
      return {
        rule,
        passed: false,
        actual: 'Unknown rule type',
        expected: rule.type,
      };
  }
}

function evaluateScoreRule(rule: PolicyRule, score: number, label: string): PolicyRuleResult {
  const threshold = rule.value ?? 0;
  let passed = false;

  switch (rule.operator) {
    case '>=':
      passed = score >= threshold;
      break;
    case '>':
      passed = score > threshold;
      break;
    case '<=':
      passed = score <= threshold;
      break;
    case '<':
      passed = score < threshold;
      break;
    case '==':
      passed = score === threshold;
      break;
    default:
      break;
  }

  return {
    rule,
    passed,
    actual: `${label} score: ${score}`,
    expected: `${rule.operator} ${threshold}`,
  };
}

function evaluateSignalRule(rule: PolicyRule, report: AnalysisReport): PolicyRuleResult {
  const signalName = rule.signal ?? '';

  // Search through all category signals for the signal name
  let signalFound = false;
  for (const category of report.categories) {
    const signal = category.signals.find((s) => s.name.toLowerCase() === signalName.toLowerCase());
    if (signal) {
      signalFound = signal.found;
      break;
    }
  }

  let passed = false;
  if (rule.operator === 'exists') {
    passed = signalFound;
  } else if (rule.operator === 'not-exists') {
    passed = !signalFound;
  }

  return {
    rule,
    passed,
    actual: signalFound ? 'Present' : 'Missing',
    expected: rule.operator === 'exists' ? 'Present' : 'Missing',
  };
}

// ── Default Policy Presets ──

export const DEFAULT_POLICIES: PolicySet[] = [
  {
    id: 'basic-hygiene',
    name: 'Basic Hygiene',
    description: 'Minimum requirements for any public repository: README, LICENSE, and .gitignore.',
    rules: [
      {
        id: 'bh-readme',
        name: 'README exists',
        description: 'Repository must have a README file',
        type: 'signal',
        signal: 'README exists',
        operator: 'exists',
        severity: 'error',
      },
      {
        id: 'bh-license',
        name: 'License file exists',
        description: 'Repository must have a LICENSE file',
        type: 'signal',
        signal: 'License file exists',
        operator: 'exists',
        severity: 'error',
      },
      {
        id: 'bh-gitignore',
        name: '.gitignore present',
        description: 'Repository must have a .gitignore file',
        type: 'signal',
        signal: '.gitignore present',
        operator: 'exists',
        severity: 'warning',
      },
    ],
    createdAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'production-ready',
    name: 'Production Ready',
    description:
      'Requirements for production-grade repositories: strong scores across all categories, CI, tests, and license.',
    rules: [
      {
        id: 'pr-overall',
        name: 'Overall score >= 60',
        description: 'Overall repository health score must be at least 60',
        type: 'overall-score',
        operator: '>=',
        value: 60,
        severity: 'error',
      },
      {
        id: 'pr-docs',
        name: 'Documentation >= 60',
        description: 'Documentation score must be at least 60',
        type: 'category-score',
        category: 'documentation',
        operator: '>=',
        value: 60,
        severity: 'warning',
      },
      {
        id: 'pr-security',
        name: 'Security >= 60',
        description: 'Security score must be at least 60',
        type: 'category-score',
        category: 'security',
        operator: '>=',
        value: 60,
        severity: 'warning',
      },
      {
        id: 'pr-cicd',
        name: 'CI/CD >= 60',
        description: 'CI/CD score must be at least 60',
        type: 'category-score',
        category: 'cicd',
        operator: '>=',
        value: 60,
        severity: 'warning',
      },
      {
        id: 'pr-deps',
        name: 'Dependencies >= 60',
        description: 'Dependencies score must be at least 60',
        type: 'category-score',
        category: 'dependencies',
        operator: '>=',
        value: 60,
        severity: 'warning',
      },
      {
        id: 'pr-quality',
        name: 'Code Quality >= 60',
        description: 'Code Quality score must be at least 60',
        type: 'category-score',
        category: 'codeQuality',
        operator: '>=',
        value: 60,
        severity: 'warning',
      },
      {
        id: 'pr-license',
        name: 'License >= 60',
        description: 'License score must be at least 60',
        type: 'category-score',
        category: 'license',
        operator: '>=',
        value: 60,
        severity: 'error',
      },
      {
        id: 'pr-community',
        name: 'Community >= 60',
        description: 'Community score must be at least 60',
        type: 'category-score',
        category: 'community',
        operator: '>=',
        value: 60,
        severity: 'warning',
      },
      {
        id: 'pr-openssf',
        name: 'OpenSSF >= 40',
        description: 'OpenSSF Scorecard score must be at least 40',
        type: 'category-score',
        category: 'openssf',
        operator: '>=',
        value: 40,
        severity: 'warning',
      },
      {
        id: 'pr-ci',
        name: 'Has CI workflows',
        description: 'Repository must have GitHub Actions workflows',
        type: 'signal',
        signal: 'GitHub Actions workflows',
        operator: 'exists',
        severity: 'error',
      },
      {
        id: 'pr-tests',
        name: 'Has tests',
        description: 'Repository must have tests',
        type: 'signal',
        signal: 'Tests present',
        operator: 'exists',
        severity: 'error',
      },
      {
        id: 'pr-license-file',
        name: 'License file exists',
        description: 'Repository must have a LICENSE file',
        type: 'signal',
        signal: 'License file exists',
        operator: 'exists',
        severity: 'error',
      },
    ],
    createdAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'security-focused',
    name: 'Security Focused',
    description:
      'Strict security requirements: high security score, Dependabot, SECURITY.md, CODEOWNERS, and CodeQL.',
    rules: [
      {
        id: 'sf-score',
        name: 'Security score >= 80',
        description: 'Security category score must be at least 80',
        type: 'category-score',
        category: 'security',
        operator: '>=',
        value: 80,
        severity: 'error',
      },
      {
        id: 'sf-dependabot',
        name: 'Dependabot configured',
        description: 'Repository must have Dependabot configured for automated dependency updates',
        type: 'signal',
        signal: 'Dependabot configured',
        operator: 'exists',
        severity: 'error',
      },
      {
        id: 'sf-security-md',
        name: 'SECURITY.md exists',
        description: 'Repository must have a security policy',
        type: 'signal',
        signal: 'SECURITY.md',
        operator: 'exists',
        severity: 'error',
      },
      {
        id: 'sf-codeowners',
        name: 'CODEOWNERS exists',
        description: 'Repository must have CODEOWNERS for review enforcement',
        type: 'signal',
        signal: 'CODEOWNERS',
        operator: 'exists',
        severity: 'error',
      },
      {
        id: 'sf-codeql',
        name: 'CodeQL enabled',
        description: 'Repository must have CodeQL or equivalent security scanning',
        type: 'signal',
        signal: 'CodeQL / security scanning',
        operator: 'exists',
        severity: 'warning',
      },
    ],
    createdAt: '2024-01-01T00:00:00.000Z',
  },
];
