import { useState, useCallback, useRef, type ReactNode } from 'react';
import { useRepoGuru } from '../services/Provider.js';
import { PolicyView } from '../views/PolicyView.js';
import { PageContainer } from '../chrome/PageContainer.js';
import { PageHero } from '../chrome/PageHero.js';
import { PrimaryButton, SecondaryButton } from '../chrome/Buttons.js';
import { LoadingPanel, ErrorPanel } from '../chrome/StatusPanels.js';
import { RepoPicker } from '../chrome/RepoPicker.js';
import type { PolicyEvalResult } from '../views/policyTypes.js';
import type { AnalysisProgress } from '../services/types.js';

type Step = 'idle' | 'loading' | 'done' | 'error';

interface State {
  step: Step;
  message: string;
  progress: AnalysisProgress | null;
  result: PolicyEvalResult | null;
  error: string | null;
}

export interface PolicyPageProps {
  /** Host-rendered editor / additional sections (e.g. browser-only
   *  rule builder). Rendered above the evaluator. */
  editorSection?: ReactNode;
}

/** Authoritative Compliance Policy page. Both hosts mount this same
 *  React file — services.policy injects the host's preset list and
 *  evaluation engine (browser: in-page rule engine over a full
 *  AnalysisReport; desktop: gRPC EvaluatePolicy against the CLI). */
export function PolicyPage({ editorSection }: PolicyPageProps) {
  const { policy } = useRepoGuru();
  const presets = policy.listPresets();
  const [presetId, setPresetId] = useState(presets[0]?.id ?? '');
  const [input, setInput] = useState('');
  const [state, setState] = useState<State>({
    step: 'idle',
    message: '',
    progress: null,
    result: null,
    error: null,
  });
  const abortRef = useRef<AbortController | null>(null);

  const handleEvaluate = useCallback(async () => {
    if (!input.trim() || !presetId) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setState({
      step: 'loading',
      message: 'Scoring repository…',
      progress: { message: 'Scoring repository…', overall: 1, sub: 0, phase: 'starting' },
      result: null,
      error: null,
    });
    try {
      const result = await policy.evaluate(
        { repo: input.trim(), presetId },
        {
          signal: controller.signal,
          onProgress: (p) =>
            setState((prev) =>
              prev.step === 'loading' ? { ...prev, message: p.message, progress: p } : prev,
            ),
        },
      );
      setState({ step: 'done', message: '', progress: null, result, error: null });
    } catch (err) {
      if ((err as { name?: string })?.name === 'AbortError') return;
      setState({
        step: 'error',
        message: '',
        progress: null,
        result: null,
        error: err instanceof Error ? err.message : 'An unexpected error occurred.',
      });
    }
  }, [input, presetId, policy]);

  const handleReset = useCallback(() => {
    abortRef.current?.abort();
    setState({ step: 'idle', message: '', progress: null, result: null, error: null });
  }, []);

  return (
    <PageContainer>
      <PageHero
        title="Run a repo through your"
        highlight="compliance policy."
        subtitle="PASS / FAIL on every rule, with severity and threshold. Pick a preset or paste your own ruleset."
      />

      {editorSection}

      {state.step !== 'done' && (
        <div className="mb-8 max-w-4xl mx-auto">
          <RepoPicker
            inputId="policy-repo"
            label="Repository"
            value={input}
            onChange={setInput}
            onSubmit={handleEvaluate}
            disabled={state.step === 'loading'}
          />

          {presets.length > 0 && (
            <div className="mt-4">
              <label htmlFor="policy-preset" className="block text-sm font-medium text-text-secondary mb-1.5">
                Preset
              </label>
              <select
                id="policy-preset"
                value={presetId}
                onChange={(e) => setPresetId(e.target.value)}
                disabled={state.step === 'loading'}
                className="w-full px-4 py-3 rounded-xl bg-surface-alt border border-border text-text focus:outline-none focus:border-border-bright focus:ring-1 focus:ring-border-bright transition-colors disabled:opacity-50"
              >
                {presets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}{p.description ? ` — ${p.description}` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex justify-center gap-3 mt-4">
            <PrimaryButton
              onClick={handleEvaluate}
              disabled={state.step === 'loading' || !input.trim() || !presetId}
            >
              {state.step === 'loading' ? 'Evaluating...' : 'Evaluate Policy'}
            </PrimaryButton>
          </div>
        </div>
      )}

      {state.step === 'loading' && (
        <LoadingPanel
          message={state.message}
          subMessage={state.progress?.phase}
          progress={state.progress?.overall}
          subProgress={state.progress?.sub}
        />
      )}

      {state.step === 'error' && state.error && (
        <ErrorPanel
          title="Evaluation failed"
          message={state.error}
          action={<SecondaryButton onClick={handleReset}>Try again</SecondaryButton>}
        />
      )}

      {state.step === 'done' && state.result && (
        <PolicyView
          result={state.result}
          actions={<SecondaryButton onClick={handleReset}>New Evaluation</SecondaryButton>}
        />
      )}
    </PageContainer>
  );
}
