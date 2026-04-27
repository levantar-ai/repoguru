import { useState } from 'react';
import { grpcClient, type ScoreResponse } from '@/services/grpc-client';
import { useReportCard } from '@/hooks/useReportCard';
import { RepoPicker } from '@/components/common/RepoPicker';

interface PolicyRuleResult {
  rule: {
    id: string;
    name: string;
    description: string;
    type: string;
    operator: string;
    value: number;
    category: string;
    signal: string;
    severity: string;
  };
  passed: boolean;
  actual: string;
  expected: string;
}

interface PolicyResult {
  passed: boolean;
  pass_count: number;
  fail_count: number;
  results: PolicyRuleResult[];
  evaluated_at: string;
}

const PRESETS = [
  { id: 'basic-hygiene', label: 'Basic Hygiene', desc: 'README, LICENSE, and CI/CD basics' },
  { id: 'production-ready', label: 'Production Ready', desc: 'Full CI/CD, security, and quality gates' },
  { id: 'security-focused', label: 'Security Focused', desc: 'Strict security and supply chain rules' },
];

const SEVERITY_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  error: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20' },
  warning: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/20' },
  info: { bg: 'bg-sky-500/10', text: 'text-sky-400', border: 'border-sky-500/20' },
};

export function PolicyEngine() {
  const [repoPath, setRepoPath] = useState('');
  const [selectedPreset, setSelectedPreset] = useState('basic-hygiene');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PolicyResult | null>(null);
  const { score, scoreRepo } = useReportCard();

  // Custom rule editor state
  const [customMode, setCustomMode] = useState(false);
  const [customRules, setCustomRules] = useState<Array<{
    name: string; type: string; operator: string; value: number; category: string; signal: string; severity: string;
  }>>([]);

  const handleEvaluate = async () => {
    if (!repoPath) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const reportCard = await scoreRepo(repoPath) || null;
      if (!reportCard) {
        setError('Failed to score repository. Check the path and try again.');
        setLoading(false);
        return;
      }

      const res = await grpcClient.evaluatePolicy(selectedPreset, reportCard) as PolicyResult;
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const addCustomRule = () => {
    setCustomRules([...customRules, {
      name: '', type: 'category-score', operator: '>=', value: 70,
      category: 'documentation', signal: '', severity: 'error',
    }]);
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h2 className="text-2xl font-bold text-white mb-2">Policy Engine</h2>
      <p className="text-sm text-gray-500 mb-6">Evaluate compliance rules against a scored report card.</p>

      {/* Repository selection */}
      <div className="mb-6">
        <RepoPicker
          value={repoPath}
          onChange={setRepoPath}
          label="Repository"
          placeholder="/path/to/repo or search GitHub repos..."
        />
      </div>

      {/* Preset selection */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            onClick={() => { setSelectedPreset(preset.id); setCustomMode(false); }}
            className={`text-left p-4 rounded-lg border transition-all ${
              selectedPreset === preset.id && !customMode
                ? 'border-sky-500/50 bg-sky-500/10'
                : 'border-gray-800 bg-gray-900/50 hover:border-gray-700'
            }`}
          >
            <div className="text-sm font-medium text-gray-200">{preset.label}</div>
            <div className="text-xs text-gray-500 mt-0.5">{preset.desc}</div>
          </button>
        ))}
      </div>

      {/* Custom rules toggle */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setCustomMode(!customMode)}
          className={`text-xs px-3 py-1.5 rounded border transition-colors ${
            customMode ? 'border-sky-500/50 bg-sky-500/10 text-sky-400' : 'border-gray-700 text-gray-500 hover:text-gray-300'
          }`}
        >
          {customMode ? 'Custom Rules Mode' : 'Switch to Custom Rules'}
        </button>
        {customMode && (
          <button onClick={addCustomRule} className="text-xs text-sky-400 hover:text-sky-300">
            + Add Rule
          </button>
        )}
      </div>

      {/* Custom rule editor */}
      {customMode && customRules.length > 0 && (
        <div className="space-y-2 mb-6">
          {customRules.map((rule, i) => (
            <div key={i} className="flex items-center gap-2 rounded border border-gray-800 bg-gray-900/50 p-3 text-xs">
              <input
                value={rule.name}
                onChange={(e) => { const r = [...customRules]; r[i].name = e.target.value; setCustomRules(r); }}
                placeholder="Rule name"
                className="w-32 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-gray-300"
              />
              <select
                value={rule.type}
                onChange={(e) => { const r = [...customRules]; r[i].type = e.target.value; setCustomRules(r); }}
                className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-gray-300"
              >
                <option value="overall-score">Overall Score</option>
                <option value="category-score">Category Score</option>
                <option value="signal">Signal</option>
              </select>
              {rule.type === 'category-score' && (
                <select
                  value={rule.category}
                  onChange={(e) => { const r = [...customRules]; r[i].category = e.target.value; setCustomRules(r); }}
                  className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-gray-300"
                >
                  {['documentation', 'security', 'cicd', 'dependencies', 'code_quality', 'license', 'community', 'openssf'].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              )}
              <select
                value={rule.operator}
                onChange={(e) => { const r = [...customRules]; r[i].operator = e.target.value; setCustomRules(r); }}
                className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-gray-300"
              >
                {['>=', '>', '<=', '<', '==', 'exists', 'not-exists'].map((op) => (
                  <option key={op} value={op}>{op}</option>
                ))}
              </select>
              {!['exists', 'not-exists'].includes(rule.operator) && (
                <input
                  type="number"
                  value={rule.value}
                  onChange={(e) => { const r = [...customRules]; r[i].value = Number(e.target.value); setCustomRules(r); }}
                  className="w-16 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-gray-300"
                />
              )}
              <select
                value={rule.severity}
                onChange={(e) => { const r = [...customRules]; r[i].severity = e.target.value; setCustomRules(r); }}
                className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-gray-300"
              >
                <option value="error">Error</option>
                <option value="warning">Warning</option>
                <option value="info">Info</option>
              </select>
              <button
                onClick={() => setCustomRules(customRules.filter((_, j) => j !== i))}
                className="text-gray-600 hover:text-red-400"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={handleEvaluate}
        disabled={loading || !repoPath}
        className="px-6 py-2.5 bg-sky-600 hover:bg-sky-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-md text-sm font-medium text-white transition-colors"
      >
        {loading ? 'Scoring & Evaluating...' : 'Evaluate Policy'}
      </button>

      {error && (
        <div className="mt-4 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">{error}</div>
      )}

      {/* Results */}
      {result && (
        <div className="mt-6 space-y-4">
          {/* Summary */}
          <div className={`rounded-lg border p-4 flex items-center gap-4 ${
            result.passed ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5'
          }`}>
            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl ${
              result.passed ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
            }`}>
              {result.passed ? (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </div>
            <div>
              <div className={`text-lg font-bold ${result.passed ? 'text-green-400' : 'text-red-400'}`}>
                {result.passed ? 'Policy Passed' : 'Policy Failed'}
              </div>
              <div className="text-xs text-gray-500">
                {result.pass_count} passed, {result.fail_count} failed
              </div>
            </div>
          </div>

          {/* Rule results */}
          <div className="space-y-2">
            {result.results.map((r, i) => {
              const sev = SEVERITY_STYLES[r.rule.severity] || SEVERITY_STYLES.info;
              return (
                <div
                  key={i}
                  className={`flex items-center gap-3 rounded-lg border p-3 ${
                    r.passed ? 'border-gray-800 bg-gray-900/30' : `${sev.bg} border ${sev.border}`
                  }`}
                >
                  {r.passed ? (
                    <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className={`w-4 h-4 ${sev.text} flex-shrink-0`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-200">{r.rule.name}</div>
                    {r.rule.description && (
                      <div className="text-xs text-gray-500">{r.rule.description}</div>
                    )}
                  </div>
                  <div className="text-right text-xs">
                    <div className="text-gray-400">{r.actual}</div>
                    <div className="text-gray-600">{r.expected}</div>
                  </div>
                  <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${sev.bg} ${sev.text}`}>
                    {r.rule.severity}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
