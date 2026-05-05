import type { PolicySet } from '../../types';

const STORE_KEY = 'repoguru-policies';

export function getSavedPolicies(): PolicySet[] {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function savePolicy(policy: PolicySet): void {
  const policies = getSavedPolicies();
  const idx = policies.findIndex((p) => p.id === policy.id);
  if (idx >= 0) policies[idx] = policy;
  else policies.push(policy);
  localStorage.setItem(STORE_KEY, JSON.stringify(policies));
}

export function deletePolicy(id: string): void {
  const policies = getSavedPolicies().filter((p) => p.id !== id);
  localStorage.setItem(STORE_KEY, JSON.stringify(policies));
}
