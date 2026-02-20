import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { cleanRuleForTypeChange } from './policyUtils';
import type {
  PolicySet,
  PolicyRule,
  PolicyEvaluation,
  PolicyRuleResult,
  PolicyOperator,
  CategoryKey,
  RepoInfo,
} from '../types';
import { evaluatePolicy, DEFAULT_POLICIES } from '../services/analysis/policyEngine';
import { parseRepoUrl } from '../services/github/parser';
import { githubFetch } from '../services/github/client';
import { fetchTree } from '../services/github/tree';
import { filterTargetFiles, fetchFileContents } from '../services/github/contents';
import { runAnalysis } from '../services/analysis/engine';
import { useApp } from '../context/AppContext';
import { CATEGORY_LABELS } from '../utils/constants';
import type { GitHubRepoResponse } from '../services/github/types';

// ─── Props ───────────────────────────────────────────────────────────────────

interface Props {
  onNavigate: (page: string) => void;
}

// ─── localStorage helpers ────────────────────────────────────────────────────

const STORAGE_KEY = 'reporev:policy-sets';

function loadPolicySets(): PolicySet[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as PolicySet[];
  } catch {
    return [];
  }
}

function savePolicySets(policies: PolicySet[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(policies));
  } catch {
    // Storage may be full or unavailable
  }
}

// ─── Unique ID helper ────────────────────────────────────────────────────────

function uid(): string {
  return `${Date.now()}-${crypto.randomUUID().slice(0, 7)}`;
}

// ─── Preset Policies ─────────────────────────────────────────────────────────

const PRESET_POLICIES: PolicySet[] = [
  {
    id: 'preset-open-source-ready',
    name: 'Open Source Ready',
    description:
      'Ensures the repository has essential files for open-source projects: license, README, and CONTRIBUTING guide.',
    rules: [
      {
        id: 'osr-license',
        name: 'License file exists',
        description: 'Repository must have a LICENSE file for open-source compliance',
        type: 'signal',
        signal: 'LICENSE file exists',
        operator: 'exists',
        severity: 'error',
      },
      {
        id: 'osr-readme',
        name: 'README exists',
        description: 'Repository must have a README for project documentation',
        type: 'signal',
        signal: 'README.md',
        operator: 'exists',
        severity: 'error',
      },
      {
        id: 'osr-contributing',
        name: 'CONTRIBUTING guide exists',
        description: 'Repository should have a CONTRIBUTING.md to guide new contributors',
        type: 'signal',
        signal: 'CONTRIBUTING.md',
        operator: 'exists',
        severity: 'warning',
      },
    ],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'preset-enterprise-grade',
    name: 'Enterprise Grade',
    description: 'Strict requirements for enterprise repositories: high security and CI/CD scores.',
    rules: [
      {
        id: 'eg-security',
        name: 'Security score >= 80',
        description: 'Security category score must be at least 80 for enterprise compliance',
        type: 'category-score',
        category: 'security',
        operator: '>=',
        value: 80,
        severity: 'error',
      },
      {
        id: 'eg-cicd',
        name: 'CI/CD score >= 70',
        description: 'CI/CD category score must be at least 70 for enterprise readiness',
        type: 'category-score',
        category: 'cicd',
        operator: '>=',
        value: 70,
        severity: 'error',
      },
    ],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'preset-beginner-friendly',
    name: 'Beginner Friendly',
    description:
      'Ensures the repository is welcoming to new contributors with good community practices.',
    rules: [
      {
        id: 'bf-community',
        name: 'Community score >= 60',
        description: 'Community category score must be at least 60 to support new contributors',
        type: 'category-score',
        category: 'community',
        operator: '>=',
        value: 60,
        severity: 'error',
      },
      {
        id: 'bf-contributing',
        name: 'CONTRIBUTING guide exists',
        description: 'Repository must have a CONTRIBUTING.md for new contributor guidance',
        type: 'signal',
        signal: 'CONTRIBUTING.md',
        operator: 'exists',
        severity: 'error',
      },
    ],
    createdAt: new Date().toISOString(),
  },
];

// ─── Empty rule template ─────────────────────────────────────────────────────

function emptyRule(): PolicyRule {
  return {
    id: uid(),
    name: '',
    description: '',
    type: 'overall-score',
    operator: '>=',
    value: 60,
    severity: 'warning',
  };
}

// ─── Empty policy template ───────────────────────────────────────────────────

function emptyPolicy(): PolicySet {
  return {
    id: uid(),
    name: '',
    description: '',
    rules: [emptyRule()],
    createdAt: new Date().toISOString(),
  };
}

// cleanRuleForTypeChange is imported from policyUtils.ts

// ─── Category options ────────────────────────────────────────────────────────

const CATEGORY_OPTIONS: { value: CategoryKey; label: string }[] = [
  { value: 'documentation', label: 'Documentation' },
  { value: 'security', label: 'Security' },
  { value: 'cicd', label: 'CI/CD' },
  { value: 'dependencies', label: 'Dependencies' },
  { value: 'codeQuality', label: 'Code Quality' },
  { value: 'license', label: 'License' },
  { value: 'community', label: 'Community' },
];

const OPERATOR_OPTIONS: { value: PolicyOperator; label: string }[] = [
  { value: '>=', label: '>=' },
  { value: '>', label: '>' },
  { value: '<=', label: '<=' },
  { value: '<', label: '<' },
  { value: '==', label: '==' },
  { value: 'exists', label: 'exists' },
  { value: 'not-exists', label: 'not-exists' },
];

const SEVERITY_OPTIONS: { value: 'error' | 'warning' | 'info'; label: string; color: string }[] = [
  { value: 'error', label: 'Error', color: 'text-grade-f' },
  { value: 'warning', label: 'Warning', color: 'text-grade-c' },
  { value: 'info', label: 'Info', color: 'text-neon' },
];

// ─── Evaluation phase ────────────────────────────────────────────────────────

type EvalPhase =
  | 'idle'
  | 'fetching-info'
  | 'fetching-tree'
  | 'fetching-files'
  | 'analyzing'
  | 'evaluating'
  | 'done'
  | 'error';

// ─── Component ───────────────────────────────────────────────────────────────

export function PolicyPage({ onNavigate }: Props) {
  const { state: appState } = useApp();
  const githubToken = appState.githubToken;

  // ── Policy Builder state ───────────────────────────────────────────────
  const [savedPolicies, setSavedPolicies] = useState<PolicySet[]>([]);
  const [editingPolicy, setEditingPolicy] = useState<PolicySet | null>(null);
  const [showBuilder, setShowBuilder] = useState(false);
  const [builderError, setBuilderError] = useState<string | null>(null);

  // ── Policy Evaluator state ─────────────────────────────────────────────
  const [repoUrl, setRepoUrl] = useState('');
  const [selectedPolicyId, setSelectedPolicyId] = useState<string>('');
  const [evalPhase, setEvalPhase] = useState<EvalPhase>('idle');
  const [evalProgress, setEvalProgress] = useState(0);
  const [evalError, setEvalError] = useState<string | null>(null);
  const [evaluation, setEvaluation] = useState<PolicyEvaluation | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // ── Load saved policies from localStorage on mount ─────────────────────
  useEffect(() => {
    setSavedPolicies(loadPolicySets()); // eslint-disable-line react-hooks/set-state-in-effect -- load once on mount
  }, []);

  // ── All available policies (saved + presets + defaults from engine) ─────
  const allPolicies = useMemo(() => {
    const combined = [...savedPolicies];
    // Add presets that haven't been saved/overridden
    for (const preset of PRESET_POLICIES) {
      if (!combined.some((p) => p.id === preset.id)) {
        combined.push(preset);
      }
    }
    // Add default policies from the engine
    for (const def of DEFAULT_POLICIES) {
      if (!combined.some((p) => p.id === def.id)) {
        combined.push(def);
      }
    }
    return combined;
  }, [savedPolicies]);

  // ── Save policies helper ───────────────────────────────────────────────
  const persistPolicies = useCallback((policies: PolicySet[]) => {
    setSavedPolicies(policies);
    savePolicySets(policies);
  }, []);

  // ── Start editing a new policy ─────────────────────────────────────────
  const startNewPolicy = useCallback(() => {
    setEditingPolicy(emptyPolicy());
    setShowBuilder(true);
    setBuilderError(null);
  }, []);

  // ── Start editing an existing policy ───────────────────────────────────
  const startEditPolicy = useCallback((policy: PolicySet) => {
    setEditingPolicy({ ...policy, rules: policy.rules.map((r) => ({ ...r })) });
    setShowBuilder(true);
    setBuilderError(null);
  }, []);

  // ── Load a preset into the builder ─────────────────────────────────────
  const loadPreset = useCallback((preset: PolicySet) => {
    setEditingPolicy({
      ...preset,
      id: uid(),
      name: preset.name,
      rules: preset.rules.map((r) => ({ ...r, id: uid() })),
      createdAt: new Date().toISOString(),
    });
    setShowBuilder(true);
    setBuilderError(null);
  }, []);

  // ── Delete a saved policy ──────────────────────────────────────────────
  const deletePolicy = useCallback(
    (id: string) => {
      const updated = savedPolicies.filter((p) => p.id !== id);
      persistPolicies(updated);
    },
    [savedPolicies, persistPolicies],
  );

  // ── Save the editing policy ────────────────────────────────────────────
  const savePolicy = useCallback(() => {
    if (!editingPolicy) return;

    if (!editingPolicy.name.trim()) {
      setBuilderError('Policy name is required.');
      return;
    }

    if (editingPolicy.rules.length === 0) {
      setBuilderError('At least one rule is required.');
      return;
    }

    for (const rule of editingPolicy.rules) {
      if (!rule.name.trim()) {
        setBuilderError(`Rule name is required for all rules.`);
        return;
      }
      if (rule.type === 'category-score' && !rule.category) {
        setBuilderError(`Rule "${rule.name}" requires a category.`);
        return;
      }
      if (rule.type === 'signal' && !rule.signal?.trim()) {
        setBuilderError(`Rule "${rule.name}" requires a signal name.`);
        return;
      }
    }

    const existing = savedPolicies.findIndex((p) => p.id === editingPolicy.id);
    let updated: PolicySet[];
    if (existing >= 0) {
      updated = [...savedPolicies];
      updated[existing] = editingPolicy;
    } else {
      updated = [...savedPolicies, editingPolicy];
    }

    persistPolicies(updated);
    setEditingPolicy(null);
    setShowBuilder(false);
    setBuilderError(null);
  }, [editingPolicy, savedPolicies, persistPolicies]);

  // ── Cancel editing ─────────────────────────────────────────────────────
  const cancelEdit = useCallback(() => {
    setEditingPolicy(null);
    setShowBuilder(false);
    setBuilderError(null);
  }, []);

  // ── Update a field on the editing policy ───────────────────────────────
  const updatePolicyField = useCallback((field: 'name' | 'description', value: string) => {
    setEditingPolicy((prev) => (prev ? { ...prev, [field]: value } : prev));
  }, []);

  // ── Add a rule to the editing policy ───────────────────────────────────
  const addRule = useCallback(() => {
    setEditingPolicy((prev) => {
      if (!prev) return prev;
      return { ...prev, rules: [...prev.rules, emptyRule()] };
    });
  }, []);

  // ── Remove a rule from the editing policy ──────────────────────────────
  const removeRule = useCallback((ruleId: string) => {
    setEditingPolicy((prev) => {
      if (!prev) return prev;
      return { ...prev, rules: prev.rules.filter((r) => r.id !== ruleId) };
    });
  }, []);

  // ── Update a rule field ────────────────────────────────────────────────
  const updateRule = useCallback((ruleId: string, updates: Partial<PolicyRule>) => {
    setEditingPolicy((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        rules: prev.rules.map((r) => {
          if (r.id !== ruleId) return r;
          const updated = { ...r, ...updates };
          if (updates.type) {
            return cleanRuleForTypeChange(updated, updates.type);
          }
          return updated;
        }),
      };
    });
  }, []);

  // ── Run Evaluation ─────────────────────────────────────────────────────
  const runEvaluation = useCallback(async () => {
    const url = repoUrl.trim();
    if (!url || !selectedPolicyId) return;

    const policy = allPolicies.find((p) => p.id === selectedPolicyId);
    if (!policy) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setEvalPhase('fetching-info');
    setEvalProgress(5);
    setEvalError(null);
    setEvaluation(null);

    try {
      // Parse URL
      const parsed = parseRepoUrl(url);
      if (!parsed) {
        setEvalPhase('error');
        setEvalError('Invalid GitHub URL. Try: owner/repo or https://github.com/owner/repo');
        return;
      }

      const token = githubToken || undefined;

      // Fetch repo info
      setEvalPhase('fetching-info');
      setEvalProgress(10);
      const raw = await githubFetch<GitHubRepoResponse>(
        `/repos/${parsed.owner}/${parsed.repo}`,
        token,
      );

      if (controller.signal.aborted) return;

      const repoInfo: RepoInfo = {
        owner: raw.full_name.split('/')[0],
        repo: raw.name,
        defaultBranch: raw.default_branch,
        description: raw.description || '',
        stars: raw.stargazers_count,
        forks: raw.forks_count,
        openIssues: raw.open_issues_count,
        license: raw.license?.spdx_id || null,
        language: raw.language,
        createdAt: raw.created_at,
        updatedAt: raw.updated_at,
        topics: raw.topics || [],
        archived: raw.archived,
        size: raw.size,
      };

      const branch = parsed.branch || repoInfo.defaultBranch;

      // Fetch tree
      setEvalPhase('fetching-tree');
      setEvalProgress(25);
      const tree = await fetchTree(parsed.owner, parsed.repo, branch, token);

      if (controller.signal.aborted) return;

      // Filter and fetch file contents
      setEvalPhase('fetching-files');
      setEvalProgress(40);
      const targetFiles = filterTargetFiles(tree);
      const files = await fetchFileContents(parsed.owner, parsed.repo, branch, targetFiles, token);

      if (controller.signal.aborted) return;

      // Run analysis
      setEvalPhase('analyzing');
      setEvalProgress(75);
      const report = runAnalysis({ ...parsed, branch }, repoInfo, tree, files);

      if (controller.signal.aborted) return;

      // Evaluate policy
      setEvalPhase('evaluating');
      setEvalProgress(90);
      const result = evaluatePolicy(policy, report);

      setEvaluation(result);
      setEvalPhase('done');
      setEvalProgress(100);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setEvalPhase('error');
      setEvalError(
        err instanceof Error ? err.message : 'An unexpected error occurred during evaluation.',
      );
    }
  }, [repoUrl, selectedPolicyId, allPolicies, githubToken]);

  // ── Reset evaluation ───────────────────────────────────────────────────
  const resetEvaluation = useCallback(() => {
    abortRef.current?.abort();
    setEvalPhase('idle');
    setEvalProgress(0);
    setEvalError(null);
    setEvaluation(null);
  }, []);

  // ── Severity display helpers ───────────────────────────────────────────

  function severityBadge(severity: 'error' | 'warning' | 'info') {
    const styles = {
      error: 'bg-grade-f/15 text-grade-f border-grade-f/25',
      warning: 'bg-grade-c/15 text-grade-c border-grade-c/25',
      info: 'bg-neon/15 text-neon border-neon/25',
    };
    return (
      <span
        className={`inline-block px-2 py-0.5 rounded-md text-xs font-semibold border ${styles[severity]}`}
      >
        {severity.toUpperCase()}
      </span>
    );
  }

  function resultBadge(result: PolicyRuleResult) {
    if (result.passed) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-grade-a/15 text-grade-a border border-grade-a/25">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M5 13l4 4L19 7"
            />
          </svg>
          PASS
        </span>
      );
    }

    const failStyles = {
      error: 'bg-grade-f/15 text-grade-f border-grade-f/25',
      warning: 'bg-grade-c/15 text-grade-c border-grade-c/25',
      info: 'bg-neon/15 text-neon border-neon/25',
    };

    return (
      <span
        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border ${failStyles[result.rule.severity]}`}
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.5}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
        FAIL
      </span>
    );
  }

  // ── Phase label ────────────────────────────────────────────────────────
  const phaseLabel: Record<EvalPhase, string> = {
    idle: '',
    'fetching-info': 'Fetching repository info...',
    'fetching-tree': 'Fetching file tree...',
    'fetching-files': 'Fetching file contents...',
    analyzing: 'Running analysis...',
    evaluating: 'Evaluating policy rules...',
    done: 'Evaluation complete',
    error: 'Evaluation failed',
  };

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <div className="w-full px-8 lg:px-12 xl:px-16 py-10 sm:py-16">
      {/* Back button */}
      <button
        onClick={() => onNavigate('home')}
        className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-neon transition-colors mb-8"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to analyzer
      </button>

      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-text tracking-tight">
          Compliance <span className="text-neon neon-text">Policy</span>
        </h1>
        <p className="mt-4 text-lg text-text-secondary max-w-2xl mx-auto leading-relaxed">
          Create policy rule sets and evaluate GitHub repositories against them. Enforce compliance
          standards across your projects.
        </p>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 1: Policy Builder
          ══════════════════════════════════════════════════════════════════════ */}
      <div className="mb-16">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-text">
            Policy <span className="text-neon">Builder</span>
          </h2>
          {!showBuilder && (
            <button
              onClick={startNewPolicy}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl bg-neon text-surface transition-all hover:shadow-lg hover:shadow-neon/20"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              New Policy
            </button>
          )}
        </div>

        {/* Preset quick-load buttons */}
        {!showBuilder && (
          <div className="mb-8">
            <p className="text-sm text-text-muted mb-3">Quick start with a preset:</p>
            <div className="flex flex-wrap gap-3">
              {PRESET_POLICIES.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => loadPreset(preset)}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl border border-border bg-surface-alt text-text-secondary hover:border-neon/50 hover:text-neon transition-all"
                >
                  <svg
                    className="h-4 w-4 text-neon/60"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  {preset.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Policy builder form */}
        {showBuilder && editingPolicy && (
          <div className="rounded-2xl border border-border bg-surface-alt p-6 sm:p-8 neon-glow mb-8">
            <h3 className="text-lg font-semibold text-text mb-6">
              {savedPolicies.some((p) => p.id === editingPolicy.id)
                ? 'Edit Policy'
                : 'Create New Policy'}
            </h3>

            {/* Policy name & description */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div>
                <label
                  htmlFor="policy-name"
                  className="block text-sm font-medium text-text-secondary mb-1.5"
                >
                  Policy Name
                </label>
                <input
                  id="policy-name"
                  type="text"
                  value={editingPolicy.name}
                  onChange={(e) => updatePolicyField('name', e.target.value)}
                  placeholder="e.g. Enterprise Security Policy"
                  className="w-full px-4 py-2.5 text-sm rounded-xl border border-border bg-surface text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-neon/50 focus:border-neon/50 transition-all"
                />
              </div>
              <div>
                <label
                  htmlFor="policy-description"
                  className="block text-sm font-medium text-text-secondary mb-1.5"
                >
                  Description
                </label>
                <input
                  id="policy-description"
                  type="text"
                  value={editingPolicy.description}
                  onChange={(e) => updatePolicyField('description', e.target.value)}
                  placeholder="What does this policy enforce?"
                  className="w-full px-4 py-2.5 text-sm rounded-xl border border-border bg-surface text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-neon/50 focus:border-neon/50 transition-all"
                />
              </div>
            </div>

            {/* Rules */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-semibold text-text">
                  Rules ({editingPolicy.rules.length})
                </label>
                <button
                  onClick={addRule}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-neon hover:text-neon/80 transition-colors"
                >
                  <svg
                    className="h-3.5 w-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  Add Rule
                </button>
              </div>

              <div className="space-y-4">
                {editingPolicy.rules.map((rule, ruleIdx) => (
                  <div
                    key={rule.id}
                    className="rounded-xl border border-border bg-surface p-4 sm:p-5"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
                        Rule {ruleIdx + 1}
                      </span>
                      {editingPolicy.rules.length > 1 && (
                        <button
                          onClick={() => removeRule(rule.id)}
                          className="text-text-muted hover:text-grade-f transition-colors"
                          title="Remove rule"
                        >
                          <svg
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {/* Rule name */}
                      <div>
                        <label
                          htmlFor={`rule-name-${rule.id}`}
                          className="block text-xs text-text-muted mb-1"
                        >
                          Name
                        </label>
                        <input
                          id={`rule-name-${rule.id}`}
                          type="text"
                          value={rule.name}
                          onChange={(e) => updateRule(rule.id, { name: e.target.value })}
                          placeholder="Rule name"
                          className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-surface-alt text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-neon/50 focus:border-neon/50 transition-all"
                        />
                      </div>

                      {/* Rule description */}
                      <div>
                        <label
                          htmlFor={`rule-desc-${rule.id}`}
                          className="block text-xs text-text-muted mb-1"
                        >
                          Description
                        </label>
                        <input
                          id={`rule-desc-${rule.id}`}
                          type="text"
                          value={rule.description}
                          onChange={(e) => updateRule(rule.id, { description: e.target.value })}
                          placeholder="What does this rule check?"
                          className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-surface-alt text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-neon/50 focus:border-neon/50 transition-all"
                        />
                      </div>

                      {/* Rule type */}
                      <div>
                        <label
                          htmlFor={`rule-type-${rule.id}`}
                          className="block text-xs text-text-muted mb-1"
                        >
                          Type
                        </label>
                        <select
                          id={`rule-type-${rule.id}`}
                          value={rule.type}
                          onChange={(e) =>
                            updateRule(rule.id, { type: e.target.value as PolicyRule['type'] })
                          }
                          className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-surface-alt text-text focus:outline-none focus:ring-2 focus:ring-neon/50 focus:border-neon/50 transition-all"
                        >
                          <option value="overall-score">Overall Score</option>
                          <option value="category-score">Category Score</option>
                          <option value="signal">Signal</option>
                        </select>
                      </div>

                      {/* Category (if category-score) */}
                      {rule.type === 'category-score' && (
                        <div>
                          <label
                            htmlFor={`rule-category-${rule.id}`}
                            className="block text-xs text-text-muted mb-1"
                          >
                            Category
                          </label>
                          <select
                            id={`rule-category-${rule.id}`}
                            value={rule.category || 'documentation'}
                            onChange={(e) =>
                              updateRule(rule.id, { category: e.target.value as CategoryKey })
                            }
                            className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-surface-alt text-text focus:outline-none focus:ring-2 focus:ring-neon/50 focus:border-neon/50 transition-all"
                          >
                            {CATEGORY_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Signal name (if signal) */}
                      {rule.type === 'signal' && (
                        <div>
                          <label
                            htmlFor={`rule-signal-${rule.id}`}
                            className="block text-xs text-text-muted mb-1"
                          >
                            Signal Name
                          </label>
                          <input
                            id={`rule-signal-${rule.id}`}
                            type="text"
                            value={rule.signal || ''}
                            onChange={(e) => updateRule(rule.id, { signal: e.target.value })}
                            placeholder="e.g. README.md, CONTRIBUTING.md"
                            className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-surface-alt text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-neon/50 focus:border-neon/50 transition-all"
                          />
                        </div>
                      )}

                      {/* Operator */}
                      <div>
                        <label
                          htmlFor={`rule-operator-${rule.id}`}
                          className="block text-xs text-text-muted mb-1"
                        >
                          Operator
                        </label>
                        <select
                          id={`rule-operator-${rule.id}`}
                          value={rule.operator}
                          onChange={(e) =>
                            updateRule(rule.id, { operator: e.target.value as PolicyOperator })
                          }
                          className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-surface-alt text-text focus:outline-none focus:ring-2 focus:ring-neon/50 focus:border-neon/50 transition-all"
                        >
                          {OPERATOR_OPTIONS.filter((opt) => {
                            if (rule.type === 'signal')
                              return opt.value === 'exists' || opt.value === 'not-exists';
                            return opt.value !== 'exists' && opt.value !== 'not-exists';
                          }).map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Value (if score-based) */}
                      {(rule.type === 'overall-score' || rule.type === 'category-score') && (
                        <div>
                          <label
                            htmlFor={`rule-value-${rule.id}`}
                            className="block text-xs text-text-muted mb-1"
                          >
                            Value (0-100)
                          </label>
                          <input
                            id={`rule-value-${rule.id}`}
                            type="number"
                            min={0}
                            max={100}
                            value={rule.value ?? 60}
                            onChange={(e) =>
                              updateRule(rule.id, {
                                value: Math.min(
                                  100,
                                  Math.max(0, Number.parseInt(e.target.value) || 0),
                                ),
                              })
                            }
                            className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-surface-alt text-text focus:outline-none focus:ring-2 focus:ring-neon/50 focus:border-neon/50 transition-all"
                          />
                        </div>
                      )}

                      {/* Severity */}
                      <div>
                        <label
                          htmlFor={`rule-severity-${rule.id}`}
                          className="block text-xs text-text-muted mb-1"
                        >
                          Severity
                        </label>
                        <select
                          id={`rule-severity-${rule.id}`}
                          value={rule.severity}
                          onChange={(e) =>
                            updateRule(rule.id, {
                              severity: e.target.value as PolicyRule['severity'],
                            })
                          }
                          className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-surface-alt text-text focus:outline-none focus:ring-2 focus:ring-neon/50 focus:border-neon/50 transition-all"
                        >
                          {SEVERITY_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Builder error */}
            {builderError && (
              <div className="mb-4 px-4 py-3 rounded-xl bg-grade-f/10 border border-grade-f/25 text-sm text-grade-f">
                {builderError}
              </div>
            )}

            {/* Builder actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={savePolicy}
                className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold rounded-xl bg-neon text-surface transition-all hover:shadow-lg hover:shadow-neon/20"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                Save Policy
              </button>
              <button
                onClick={cancelEdit}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-xl border border-border text-text-secondary hover:text-text hover:border-border-bright transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Saved policies list */}
        {savedPolicies.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4">
              Saved Policies ({savedPolicies.length})
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {savedPolicies.map((policy) => (
                <div
                  key={policy.id}
                  className="rounded-2xl border border-border bg-surface-alt p-5 hover:border-neon/30 transition-all group"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="text-base font-semibold text-text group-hover:text-neon transition-colors">
                      {policy.name}
                    </h4>
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      <button
                        onClick={() => startEditPolicy(policy)}
                        className="p-1.5 text-text-muted hover:text-neon transition-colors rounded-lg hover:bg-neon/10"
                        title="Edit policy"
                      >
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                      </button>
                      <button
                        onClick={() => deletePolicy(policy.id)}
                        className="p-1.5 text-text-muted hover:text-grade-f transition-colors rounded-lg hover:bg-grade-f/10"
                        title="Delete policy"
                      >
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                  {policy.description && (
                    <p className="text-sm text-text-muted mb-3 line-clamp-2">
                      {policy.description}
                    </p>
                  )}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-text-muted">
                      {policy.rules.length} rule{policy.rules.length !== 1 ? 's' : ''}
                    </span>
                    <span className="text-xs text-text-muted/50">|</span>
                    {policy.rules.some((r) => r.severity === 'error') && (
                      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-grade-f/15 text-grade-f">
                        {policy.rules.filter((r) => r.severity === 'error').length} errors
                      </span>
                    )}
                    {policy.rules.some((r) => r.severity === 'warning') && (
                      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-grade-c/15 text-grade-c">
                        {policy.rules.filter((r) => r.severity === 'warning').length} warnings
                      </span>
                    )}
                    {policy.rules.some((r) => r.severity === 'info') && (
                      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-neon/15 text-neon">
                        {policy.rules.filter((r) => r.severity === 'info').length} info
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Presets and defaults from engine */}
        {!showBuilder && (
          <div className="mt-8">
            <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4">
              Built-in Policy Templates
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...PRESET_POLICIES, ...DEFAULT_POLICIES].map((policy) => (
                <div
                  key={policy.id}
                  className="rounded-2xl border border-border bg-surface-alt/50 p-5 hover:border-neon/30 transition-all group"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="text-base font-semibold text-text group-hover:text-neon transition-colors">
                      {policy.name}
                    </h4>
                    <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-medium bg-neon/10 text-neon/70 border border-neon/20 shrink-0 ml-2">
                      PRESET
                    </span>
                  </div>
                  {policy.description && (
                    <p className="text-sm text-text-muted mb-3 line-clamp-2">
                      {policy.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-text-muted">
                      {policy.rules.length} rule{policy.rules.length !== 1 ? 's' : ''}
                    </span>
                    <button
                      onClick={() => loadPreset(policy)}
                      className="text-xs font-medium text-neon/70 hover:text-neon transition-colors"
                    >
                      Use as template
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 2: Policy Evaluator
          ══════════════════════════════════════════════════════════════════════ */}
      <div>
        <h2 className="text-2xl font-bold text-text mb-6">
          Policy <span className="text-neon">Evaluator</span>
        </h2>

        {/* Evaluator inputs */}
        {(evalPhase === 'idle' || evalPhase === 'error') && (
          <div className="rounded-2xl border border-border bg-surface-alt p-6 sm:p-8 mb-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              {/* Repo URL input */}
              <div>
                <label
                  htmlFor="eval-repo-url"
                  className="block text-sm font-medium text-text-secondary mb-1.5"
                >
                  GitHub Repository
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <svg
                      className="h-4.5 w-4.5 text-text-muted"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                      />
                    </svg>
                  </div>
                  <input
                    id="eval-repo-url"
                    type="text"
                    value={repoUrl}
                    onChange={(e) => setRepoUrl(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && runEvaluation()}
                    placeholder="e.g. facebook/react or https://github.com/facebook/react"
                    className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-border bg-surface text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-neon/50 focus:border-neon/50 transition-all"
                  />
                </div>
              </div>

              {/* Policy selector */}
              <div>
                <label
                  htmlFor="eval-policy-select"
                  className="block text-sm font-medium text-text-secondary mb-1.5"
                >
                  Policy to Evaluate
                </label>
                <select
                  id="eval-policy-select"
                  value={selectedPolicyId}
                  onChange={(e) => setSelectedPolicyId(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm rounded-xl border border-border bg-surface text-text focus:outline-none focus:ring-2 focus:ring-neon/50 focus:border-neon/50 transition-all"
                >
                  <option value="">Select a policy...</option>
                  {savedPolicies.length > 0 && (
                    <optgroup label="Saved Policies">
                      {savedPolicies.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <optgroup label="Presets">
                    {PRESET_POLICIES.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Built-in Templates">
                    {DEFAULT_POLICIES.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>
            </div>

            <button
              onClick={runEvaluation}
              disabled={!repoUrl.trim() || !selectedPolicyId}
              className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold rounded-xl bg-neon text-surface transition-all hover:shadow-lg hover:shadow-neon/20 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Evaluate Repository
            </button>

            {!githubToken && (
              <p className="text-xs text-text-muted mt-3">
                Evaluation requires fetching repo data. Without a token you have 60 req/hr. Add a
                GitHub token in Settings for 5,000 req/hr.
              </p>
            )}

            {/* Error display */}
            {evalPhase === 'error' && evalError && (
              <div className="mt-4 px-5 py-4 rounded-xl bg-grade-f/10 border border-grade-f/25 text-sm text-grade-f">
                <div className="flex items-start gap-3">
                  <svg
                    className="h-5 w-5 shrink-0 mt-0.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <div>
                    <p className="font-medium">Evaluation failed</p>
                    <p className="mt-1 text-grade-f/80">{evalError}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Progress */}
        {evalPhase !== 'idle' && evalPhase !== 'error' && evalPhase !== 'done' && (
          <div className="max-w-2xl mx-auto mb-12">
            <div className="flex justify-between text-sm text-text-secondary mb-2">
              <span>{phaseLabel[evalPhase]}</span>
              <span className="text-neon font-medium">{Math.round(evalProgress)}%</span>
            </div>
            <div className="h-3 bg-surface-alt rounded-full overflow-hidden border border-border">
              <div
                className="h-full bg-gradient-to-r from-primary-500 to-neon rounded-full transition-all duration-300 ease-out"
                style={{ width: `${evalProgress}%`, boxShadow: '0 0 12px rgba(0, 212, 255, 0.4)' }}
              />
            </div>
          </div>
        )}

        {/* Evaluation Results */}
        {evalPhase === 'done' && evaluation && (
          <div>
            {/* Overall status card */}
            <div
              className={`rounded-2xl border p-6 sm:p-8 mb-8 neon-glow ${
                evaluation.passed
                  ? 'border-grade-a/40 bg-grade-a/5'
                  : 'border-grade-f/40 bg-grade-f/5'
              }`}
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  {/* Pass/Fail icon */}
                  <div
                    className={`flex items-center justify-center h-16 w-16 rounded-2xl ${
                      evaluation.passed
                        ? 'bg-grade-a/15 border border-grade-a/30'
                        : 'bg-grade-f/15 border border-grade-f/30'
                    }`}
                  >
                    {evaluation.passed ? (
                      <svg
                        className="h-8 w-8 text-grade-a"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2.5}
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="h-8 w-8 text-grade-f"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2.5}
                          d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    )}
                  </div>

                  <div>
                    <h3
                      className={`text-2xl font-bold ${evaluation.passed ? 'text-grade-a' : 'text-grade-f'}`}
                    >
                      {evaluation.passed ? 'POLICY PASSED' : 'POLICY FAILED'}
                    </h3>
                    <p className="text-sm text-text-secondary mt-1">
                      <span className="text-neon font-medium">{evaluation.repo}</span> evaluated
                      against{' '}
                      <span className="text-text font-medium">{evaluation.policy.name}</span>
                    </p>
                  </div>
                </div>

                {/* Pass/Fail counts */}
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-grade-a">{evaluation.passCount}</div>
                    <div className="text-xs text-text-muted uppercase tracking-wider">Passed</div>
                  </div>
                  <div className="h-10 w-px bg-border" />
                  <div className="text-center">
                    <div className="text-3xl font-bold text-grade-f">{evaluation.failCount}</div>
                    <div className="text-xs text-text-muted uppercase tracking-wider">Failed</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Detailed rule results */}
            <div className="rounded-2xl border border-border bg-surface-alt overflow-hidden neon-glow mb-8">
              <div className="px-6 py-4 border-b border-border">
                <h3 className="text-base font-semibold text-text">Rule Results</h3>
              </div>

              <div className="divide-y divide-border">
                {evaluation.results.map((result, idx) => {
                  const rowBg = result.passed
                    ? 'bg-grade-a/[0.02]'
                    : result.rule.severity === 'error'
                      ? 'bg-grade-f/[0.03]'
                      : result.rule.severity === 'warning'
                        ? 'bg-grade-c/[0.03]'
                        : 'bg-neon/[0.02]';

                  const ruleTypeLabel =
                    result.rule.type === 'overall-score'
                      ? 'Overall Score'
                      : result.rule.type === 'category-score'
                        ? CATEGORY_LABELS[result.rule.category as CategoryKey] ||
                          result.rule.category
                        : 'Signal';

                  return (
                    <div
                      key={`${result.rule.id}-${idx}`}
                      className={`px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 ${rowBg}`}
                    >
                      {/* Result badge */}
                      <div className="shrink-0">{resultBadge(result)}</div>

                      {/* Rule details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-text">
                            {result.rule.name}
                          </span>
                          {severityBadge(result.rule.severity)}
                          <span className="text-xs text-text-muted px-1.5 py-0.5 rounded bg-surface border border-border">
                            {ruleTypeLabel}
                          </span>
                        </div>
                        {result.rule.description && (
                          <p className="text-xs text-text-muted mt-1">{result.rule.description}</p>
                        )}
                      </div>

                      {/* Actual vs Expected */}
                      <div className="shrink-0 text-right sm:min-w-[200px]">
                        <div className="text-xs text-text-muted">
                          Actual:{' '}
                          <span
                            className={`font-semibold ${result.passed ? 'text-grade-a' : 'text-grade-f'}`}
                          >
                            {result.actual}
                          </span>
                        </div>
                        <div className="text-xs text-text-muted">
                          Expected:{' '}
                          <span className="font-semibold text-text">{result.expected}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={resetEvaluation}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-xl border border-border text-text-secondary hover:text-neon hover:border-neon/30 transition-all"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                New Evaluation
              </button>
            </div>
          </div>
        )}

        {/* Empty state */}
        {evalPhase === 'idle' && !evaluation && (
          <div className="text-center mt-8 mb-8">
            <div className="inline-flex items-center justify-center h-20 w-20 rounded-2xl bg-neon/10 border border-neon/20 mb-6">
              <svg
                className="h-10 w-10 text-neon"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-text mb-2">Evaluate a Repository</h3>
            <p className="text-sm text-text-muted max-w-md mx-auto leading-relaxed">
              Enter a GitHub repo URL and select a policy above to check compliance. The evaluator
              will run a full analysis and report pass/fail for each rule.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
