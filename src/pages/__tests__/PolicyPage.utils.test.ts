import { describe, it, expect } from 'vitest';
import { cleanRuleForTypeChange } from '../policyUtils';
import type { PolicyRule } from '../../types';

// ── Helper to create a base rule ──

function baseRule(overrides: Partial<PolicyRule> = {}): PolicyRule {
  return {
    id: 'test-rule',
    name: 'Test Rule',
    description: 'A test rule',
    type: 'overall-score',
    operator: '>=',
    value: 60,
    severity: 'warning',
    ...overrides,
  };
}

// ── Changing to overall-score ──

describe('cleanRuleForTypeChange → overall-score', () => {
  it('removes category and signal fields', () => {
    const rule = baseRule({ category: 'security', signal: 'README.md' });
    const result = cleanRuleForTypeChange(rule, 'overall-score');
    expect(result.category).toBeUndefined();
    expect(result.signal).toBeUndefined();
  });

  it('resets operator from exists to >=', () => {
    const rule = baseRule({ operator: 'exists' });
    const result = cleanRuleForTypeChange(rule, 'overall-score');
    expect(result.operator).toBe('>=');
  });

  it('resets operator from not-exists to >=', () => {
    const rule = baseRule({ operator: 'not-exists' });
    const result = cleanRuleForTypeChange(rule, 'overall-score');
    expect(result.operator).toBe('>=');
  });

  it('preserves numeric operators like >', () => {
    const rule = baseRule({ operator: '>' });
    const result = cleanRuleForTypeChange(rule, 'overall-score');
    expect(result.operator).toBe('>');
  });

  it('defaults value to 60 when undefined', () => {
    const rule = baseRule({ value: undefined });
    const result = cleanRuleForTypeChange(rule, 'overall-score');
    expect(result.value).toBe(60);
  });

  it('preserves existing value', () => {
    const rule = baseRule({ value: 80 });
    const result = cleanRuleForTypeChange(rule, 'overall-score');
    expect(result.value).toBe(80);
  });
});

// ── Changing to category-score ──

describe('cleanRuleForTypeChange → category-score', () => {
  it('removes signal field', () => {
    const rule = baseRule({ signal: 'README.md' });
    const result = cleanRuleForTypeChange(rule, 'category-score');
    expect(result.signal).toBeUndefined();
  });

  it('sets default category to documentation when not present', () => {
    const rule = baseRule();
    delete rule.category;
    const result = cleanRuleForTypeChange(rule, 'category-score');
    expect(result.category).toBe('documentation');
  });

  it('preserves existing category', () => {
    const rule = baseRule({ category: 'security' });
    const result = cleanRuleForTypeChange(rule, 'category-score');
    expect(result.category).toBe('security');
  });

  it('resets operator from exists to >=', () => {
    const rule = baseRule({ operator: 'exists' });
    const result = cleanRuleForTypeChange(rule, 'category-score');
    expect(result.operator).toBe('>=');
  });

  it('resets operator from not-exists to >=', () => {
    const rule = baseRule({ operator: 'not-exists' });
    const result = cleanRuleForTypeChange(rule, 'category-score');
    expect(result.operator).toBe('>=');
  });

  it('preserves numeric operators like <=', () => {
    const rule = baseRule({ operator: '<=' });
    const result = cleanRuleForTypeChange(rule, 'category-score');
    expect(result.operator).toBe('<=');
  });

  it('defaults value to 60 when undefined', () => {
    const rule = baseRule({ value: undefined });
    const result = cleanRuleForTypeChange(rule, 'category-score');
    expect(result.value).toBe(60);
  });

  it('preserves existing value', () => {
    const rule = baseRule({ value: 90 });
    const result = cleanRuleForTypeChange(rule, 'category-score');
    expect(result.value).toBe(90);
  });
});

// ── Changing to signal ──

describe('cleanRuleForTypeChange → signal', () => {
  it('removes category and value fields', () => {
    const rule = baseRule({ category: 'security', value: 80 });
    const result = cleanRuleForTypeChange(rule, 'signal');
    expect(result.category).toBeUndefined();
    expect(result.value).toBeUndefined();
  });

  it('sets operator to exists when it was a numeric operator', () => {
    const rule = baseRule({ operator: '>=' });
    const result = cleanRuleForTypeChange(rule, 'signal');
    expect(result.operator).toBe('exists');
  });

  it('preserves exists operator', () => {
    const rule = baseRule({ operator: 'exists' });
    const result = cleanRuleForTypeChange(rule, 'signal');
    expect(result.operator).toBe('exists');
  });

  it('preserves not-exists operator', () => {
    const rule = baseRule({ operator: 'not-exists' });
    const result = cleanRuleForTypeChange(rule, 'signal');
    expect(result.operator).toBe('not-exists');
  });

  it('sets signal to empty string when not present', () => {
    const rule = baseRule();
    delete rule.signal;
    const result = cleanRuleForTypeChange(rule, 'signal');
    expect(result.signal).toBe('');
  });

  it('preserves existing signal name', () => {
    const rule = baseRule({ signal: 'CONTRIBUTING.md' });
    const result = cleanRuleForTypeChange(rule, 'signal');
    expect(result.signal).toBe('CONTRIBUTING.md');
  });

  it('converts < operator to exists', () => {
    const rule = baseRule({ operator: '<' });
    const result = cleanRuleForTypeChange(rule, 'signal');
    expect(result.operator).toBe('exists');
  });

  it('converts == operator to exists', () => {
    const rule = baseRule({ operator: '==' });
    const result = cleanRuleForTypeChange(rule, 'signal');
    expect(result.operator).toBe('exists');
  });
});

// ── General behavior ──

describe('cleanRuleForTypeChange general', () => {
  it('preserves id, name, description, and severity', () => {
    const rule = baseRule({
      id: 'my-rule-id',
      name: 'My Rule',
      description: 'Important',
      severity: 'error',
    });
    const result = cleanRuleForTypeChange(rule, 'signal');
    expect(result.id).toBe('my-rule-id');
    expect(result.name).toBe('My Rule');
    expect(result.description).toBe('Important');
    expect(result.severity).toBe('error');
  });

  it('returns the same object reference (mutates in place)', () => {
    const rule = baseRule();
    const result = cleanRuleForTypeChange(rule, 'overall-score');
    expect(result).toBe(rule);
  });
});
