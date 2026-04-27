import type { PolicyRule } from '../types';

/** Clean up rule fields when the rule type changes. */
export function cleanRuleForTypeChange(
  updated: PolicyRule,
  newType: PolicyRule['type'],
): PolicyRule {
  if (newType === 'overall-score') {
    delete updated.category;
    delete updated.signal;
    if (updated.operator === 'exists' || updated.operator === 'not-exists') {
      updated.operator = '>=';
    }
    updated.value ??= 60;
  } else if (newType === 'category-score') {
    delete updated.signal;
    if (!updated.category) updated.category = 'documentation';
    if (updated.operator === 'exists' || updated.operator === 'not-exists') {
      updated.operator = '>=';
    }
    updated.value ??= 60;
  } else if (newType === 'signal') {
    delete updated.category;
    delete updated.value;
    if (updated.operator !== 'exists' && updated.operator !== 'not-exists') {
      updated.operator = 'exists';
    }
    if (!updated.signal) updated.signal = '';
  }
  return updated;
}
