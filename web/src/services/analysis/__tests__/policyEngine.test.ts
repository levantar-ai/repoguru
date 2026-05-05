import { describe, it, expect } from 'vitest';
import { evaluatePolicy, DEFAULT_POLICIES } from '../policyEngine';
import type {
  AnalysisReport,
  CategoryResult,
  PolicySet,
  PolicyRule,
  RepoInfo,
} from '../../../types';

function makeRepoInfo(): RepoInfo {
  return {
    owner: 'testowner',
    repo: 'testrepo',
    defaultBranch: 'main',
    description: 'Test',
    stars: 10,
    forks: 2,
    openIssues: 1,
    license: 'MIT',
    language: 'TypeScript',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-06-01T00:00:00Z',
    topics: [],
    archived: false,
    size: 512,
  };
}

function makeCategory(
  key: CategoryResult['key'],
  label: string,
  score: number,
  signals: { name: string; found: boolean }[] = [],
): CategoryResult {
  return { key, label, score, weight: 0.15, signals: signals.map((s) => ({ ...s })) };
}

function makeReport(overrides: Partial<AnalysisReport> = {}): AnalysisReport {
  return {
    id: 'test-id',
    repo: { owner: 'testowner', repo: 'testrepo' },
    repoInfo: makeRepoInfo(),
    categories: [
      makeCategory('documentation', 'Documentation', 80, [
        { name: 'README exists', found: true },
        { name: 'CONTRIBUTING.md', found: false },
      ]),
      makeCategory('security', 'Security', 65, [
        { name: 'SECURITY.md', found: true },
        { name: 'Dependabot configured', found: false },
      ]),
      makeCategory('cicd', 'CI/CD', 70, [{ name: 'GitHub Actions workflows', found: true }]),
      makeCategory('dependencies', 'Dependencies', 55, []),
      makeCategory('codeQuality', 'Code Quality', 75, [{ name: 'Tests present', found: true }]),
      makeCategory('license', 'License', 90, [{ name: 'License file exists', found: true }]),
      makeCategory('community', 'Community', 50, [
        { name: '.gitignore present', found: true },
        { name: 'Code of conduct', found: false },
      ]),
    ],
    overallScore: 72,
    grade: 'B',
    techStack: [],
    strengths: [],
    risks: [],
    nextSteps: [],
    repoStructure: '',
    analyzedAt: '2024-06-15T10:00:00Z',
    fileCount: 50,
    treeEntryCount: 80,
    ...overrides,
  };
}

function makeRule(overrides: Partial<PolicyRule> = {}): PolicyRule {
  return {
    id: 'test-rule',
    name: 'Test Rule',
    description: 'A test rule',
    type: 'overall-score',
    operator: '>=',
    value: 60,
    severity: 'error',
    ...overrides,
  };
}

function makePolicy(rules: PolicyRule[], overrides: Partial<PolicySet> = {}): PolicySet {
  return {
    id: 'test-policy',
    name: 'Test Policy',
    description: 'A test policy set',
    rules,
    createdAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('evaluatePolicy', () => {
  // ── Overall-score rules ──

  describe('overall-score rule', () => {
    it('passes when score >= threshold', () => {
      const policy = makePolicy([makeRule({ operator: '>=', value: 70 })]);
      const report = makeReport({ overallScore: 72 });
      const evaluation = evaluatePolicy(policy, report);
      expect(evaluation.results[0].passed).toBe(true);
    });

    it('fails when score < threshold', () => {
      const policy = makePolicy([makeRule({ operator: '>=', value: 80 })]);
      const report = makeReport({ overallScore: 72 });
      const evaluation = evaluatePolicy(policy, report);
      expect(evaluation.results[0].passed).toBe(false);
    });

    it('passes when score equals threshold with >= operator', () => {
      const policy = makePolicy([makeRule({ operator: '>=', value: 72 })]);
      const report = makeReport({ overallScore: 72 });
      const evaluation = evaluatePolicy(policy, report);
      expect(evaluation.results[0].passed).toBe(true);
    });

    it('provides descriptive actual and expected fields', () => {
      const policy = makePolicy([makeRule({ operator: '>=', value: 60 })]);
      const report = makeReport({ overallScore: 72 });
      const evaluation = evaluatePolicy(policy, report);
      expect(evaluation.results[0].actual).toContain('72');
      expect(evaluation.results[0].expected).toContain('>= 60');
    });
  });

  // ── Category-score rules ──

  describe('category-score rule', () => {
    it('evaluates the correct category score', () => {
      const rule = makeRule({
        type: 'category-score',
        category: 'security',
        operator: '>=',
        value: 60,
      });
      const policy = makePolicy([rule]);
      const report = makeReport(); // security score = 65
      const evaluation = evaluatePolicy(policy, report);
      expect(evaluation.results[0].passed).toBe(true);
    });

    it('fails when category score is below threshold', () => {
      const rule = makeRule({
        type: 'category-score',
        category: 'community',
        operator: '>=',
        value: 60,
      });
      const policy = makePolicy([rule]);
      const report = makeReport(); // community score = 50
      const evaluation = evaluatePolicy(policy, report);
      expect(evaluation.results[0].passed).toBe(false);
    });

    it('defaults to score 0 when category not found', () => {
      const rule = makeRule({
        type: 'category-score',
        category: 'documentation',
        operator: '>=',
        value: 10,
      });
      // Report with no categories
      const report = makeReport({ categories: [] });
      const policy = makePolicy([rule]);
      const evaluation = evaluatePolicy(policy, report);
      // Score defaults to 0, which is < 10
      expect(evaluation.results[0].passed).toBe(false);
    });
  });

  // ── Signal rules ──

  describe('signal rule', () => {
    it('passes with "exists" when signal is found', () => {
      const rule = makeRule({
        type: 'signal',
        signal: 'README exists',
        operator: 'exists',
      });
      const policy = makePolicy([rule]);
      const evaluation = evaluatePolicy(policy, makeReport());
      expect(evaluation.results[0].passed).toBe(true);
    });

    it('fails with "exists" when signal is not found', () => {
      const rule = makeRule({
        type: 'signal',
        signal: 'CONTRIBUTING.md',
        operator: 'exists',
      });
      const policy = makePolicy([rule]);
      const evaluation = evaluatePolicy(policy, makeReport());
      expect(evaluation.results[0].passed).toBe(false);
    });

    it('passes with "not-exists" when signal is not found', () => {
      const rule = makeRule({
        type: 'signal',
        signal: 'Dependabot configured',
        operator: 'not-exists',
      });
      const policy = makePolicy([rule]);
      const evaluation = evaluatePolicy(policy, makeReport());
      // Dependabot configured is found=false, so signalFound=false, not-exists passes
      expect(evaluation.results[0].passed).toBe(true);
    });

    it('fails with "not-exists" when signal is found', () => {
      const rule = makeRule({
        type: 'signal',
        signal: 'README exists',
        operator: 'not-exists',
      });
      const policy = makePolicy([rule]);
      const evaluation = evaluatePolicy(policy, makeReport());
      expect(evaluation.results[0].passed).toBe(false);
    });

    it('performs case-insensitive signal matching', () => {
      const rule = makeRule({
        type: 'signal',
        signal: 'readme EXISTS',
        operator: 'exists',
      });
      const policy = makePolicy([rule]);
      const evaluation = evaluatePolicy(policy, makeReport());
      expect(evaluation.results[0].passed).toBe(true);
    });

    it('reports actual as "Present" when signal found', () => {
      const rule = makeRule({
        type: 'signal',
        signal: 'README exists',
        operator: 'exists',
      });
      const policy = makePolicy([rule]);
      const evaluation = evaluatePolicy(policy, makeReport());
      expect(evaluation.results[0].actual).toBe('Present');
    });

    it('reports actual as "Missing" when signal not found', () => {
      const rule = makeRule({
        type: 'signal',
        signal: 'CONTRIBUTING.md',
        operator: 'exists',
      });
      const policy = makePolicy([rule]);
      const evaluation = evaluatePolicy(policy, makeReport());
      expect(evaluation.results[0].actual).toBe('Missing');
    });
  });

  // ── Aggregate evaluation ──

  describe('aggregate evaluation', () => {
    it('sets passed=true when all rules pass', () => {
      const policy = makePolicy([
        makeRule({ id: 'r1', operator: '>=', value: 70 }),
        makeRule({
          id: 'r2',
          type: 'signal',
          signal: 'README exists',
          operator: 'exists',
        }),
      ]);
      const evaluation = evaluatePolicy(policy, makeReport());
      expect(evaluation.passed).toBe(true);
      expect(evaluation.failCount).toBe(0);
      expect(evaluation.passCount).toBe(2);
    });

    it('sets passed=false when any rule fails', () => {
      const policy = makePolicy([
        makeRule({ id: 'r1', operator: '>=', value: 70 }), // passes (72 >= 70)
        makeRule({ id: 'r2', operator: '>=', value: 90 }), // fails (72 < 90)
      ]);
      const evaluation = evaluatePolicy(policy, makeReport());
      expect(evaluation.passed).toBe(false);
      expect(evaluation.failCount).toBe(1);
      expect(evaluation.passCount).toBe(1);
    });

    it('includes policy and repo information', () => {
      const policy = makePolicy([], { id: 'my-policy', name: 'My Policy' });
      const evaluation = evaluatePolicy(policy, makeReport());
      expect(evaluation.policy.id).toBe('my-policy');
      expect(evaluation.repo).toBe('testowner/testrepo');
    });

    it('includes evaluatedAt timestamp', () => {
      const policy = makePolicy([]);
      const evaluation = evaluatePolicy(policy, makeReport());
      expect(evaluation.evaluatedAt).toBeTruthy();
      // Should be a valid ISO string
      expect(new Date(evaluation.evaluatedAt).toISOString()).toBe(evaluation.evaluatedAt);
    });
  });

  // ── Different operators ──

  describe('operators', () => {
    it('>= passes when equal', () => {
      const policy = makePolicy([makeRule({ operator: '>=', value: 72 })]);
      const result = evaluatePolicy(policy, makeReport({ overallScore: 72 }));
      expect(result.results[0].passed).toBe(true);
    });

    it('> fails when equal', () => {
      const policy = makePolicy([makeRule({ operator: '>', value: 72 })]);
      const result = evaluatePolicy(policy, makeReport({ overallScore: 72 }));
      expect(result.results[0].passed).toBe(false);
    });

    it('> passes when above', () => {
      const policy = makePolicy([makeRule({ operator: '>', value: 70 })]);
      const result = evaluatePolicy(policy, makeReport({ overallScore: 72 }));
      expect(result.results[0].passed).toBe(true);
    });

    it('<= passes when equal', () => {
      const policy = makePolicy([makeRule({ operator: '<=', value: 72 })]);
      const result = evaluatePolicy(policy, makeReport({ overallScore: 72 }));
      expect(result.results[0].passed).toBe(true);
    });

    it('<= passes when below', () => {
      const policy = makePolicy([makeRule({ operator: '<=', value: 80 })]);
      const result = evaluatePolicy(policy, makeReport({ overallScore: 72 }));
      expect(result.results[0].passed).toBe(true);
    });

    it('< passes when below', () => {
      const policy = makePolicy([makeRule({ operator: '<', value: 80 })]);
      const result = evaluatePolicy(policy, makeReport({ overallScore: 72 }));
      expect(result.results[0].passed).toBe(true);
    });

    it('< fails when equal', () => {
      const policy = makePolicy([makeRule({ operator: '<', value: 72 })]);
      const result = evaluatePolicy(policy, makeReport({ overallScore: 72 }));
      expect(result.results[0].passed).toBe(false);
    });

    it('== passes when equal', () => {
      const policy = makePolicy([makeRule({ operator: '==', value: 72 })]);
      const result = evaluatePolicy(policy, makeReport({ overallScore: 72 }));
      expect(result.results[0].passed).toBe(true);
    });

    it('== fails when not equal', () => {
      const policy = makePolicy([makeRule({ operator: '==', value: 70 })]);
      const result = evaluatePolicy(policy, makeReport({ overallScore: 72 }));
      expect(result.results[0].passed).toBe(false);
    });
  });

  // ── Unknown rule type fallback ──

  describe('unknown rule type', () => {
    it('returns passed=false for an unknown rule type', () => {
      const rule = makeRule({ type: 'unknown-type' as PolicyRule['type'] });
      const policy = makePolicy([rule]);
      const result = evaluatePolicy(policy, makeReport());
      expect(result.results[0].passed).toBe(false);
    });
  });
});

describe('DEFAULT_POLICIES', () => {
  it('has exactly 3 preset policies', () => {
    expect(DEFAULT_POLICIES).toHaveLength(3);
  });

  it('includes "Basic Hygiene" preset', () => {
    const basic = DEFAULT_POLICIES.find((p) => p.id === 'basic-hygiene');
    expect(basic).toBeDefined();
    expect(basic!.name).toBe('Basic Hygiene');
    expect(basic!.rules.length).toBeGreaterThan(0);
  });

  it('includes "Production Ready" preset', () => {
    const prod = DEFAULT_POLICIES.find((p) => p.id === 'production-ready');
    expect(prod).toBeDefined();
    expect(prod!.name).toBe('Production Ready');
    expect(prod!.rules.length).toBeGreaterThan(0);
  });

  it('includes "Security Focused" preset', () => {
    const sec = DEFAULT_POLICIES.find((p) => p.id === 'security-focused');
    expect(sec).toBeDefined();
    expect(sec!.name).toBe('Security Focused');
    expect(sec!.rules.length).toBeGreaterThan(0);
  });

  it('each policy has a valid createdAt date', () => {
    for (const policy of DEFAULT_POLICIES) {
      expect(() => new Date(policy.createdAt)).not.toThrow();
      expect(new Date(policy.createdAt).toISOString()).toBe(policy.createdAt);
    }
  });

  it('each rule has required fields', () => {
    for (const policy of DEFAULT_POLICIES) {
      for (const rule of policy.rules) {
        expect(rule.id).toBeTruthy();
        expect(rule.name).toBeTruthy();
        expect(rule.type).toBeTruthy();
        expect(rule.operator).toBeTruthy();
        expect(['error', 'warning', 'info']).toContain(rule.severity);
      }
    }
  });
});

describe('unknown operator fallback', () => {
  it('defaults to not-passed for unknown operator', () => {
    const rule = makeRule({
      operator: 'unknown-op' as PolicyRule['operator'],
      value: 50,
    });
    const policy = makePolicy([rule]);
    const report = makeReport({ overallScore: 72 });
    const evaluation = evaluatePolicy(policy, report);
    expect(evaluation.results[0].passed).toBe(false);
  });
});
