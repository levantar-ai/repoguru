import { useState, useCallback, useRef } from 'react';
import { useRepoGuru } from '../services/Provider.js';
import { CompareView } from '../views/CompareView.js';
import { PageContainer } from '../chrome/PageContainer.js';
import { PageHero } from '../chrome/PageHero.js';
import { PrimaryButton, SecondaryButton } from '../chrome/Buttons.js';
import { LoadingPanel, ErrorPanel } from '../chrome/StatusPanels.js';
import { RepoPicker } from '../chrome/RepoPicker.js';
import type { CompareResult } from '../services/types.js';

type Step = 'idle' | 'loading' | 'done' | 'error';

interface State {
  step: Step;
  progress: string;
  result: CompareResult | null;
  error: string | null;
}

/**
 * Authoritative Compare page. Both hosts mount this same component —
 * only the injected `services.compare` differs (browser: in-page light
 * analysis over two clones; desktop: gRPC `CompareRepos` to the CLI).
 *
 * The host also supplies `services.RepoPicker` so the input picker fits
 * the host's repo namespace (GitHub slugs vs filesystem paths) while
 * the surrounding chrome (hero, layout, button styling, status panels)
 * is rendered identically across hosts.
 */
export function ComparePage() {
  const { compare } = useRepoGuru();

  const [inputA, setInputA] = useState('');
  const [inputB, setInputB] = useState('');
  const [state, setState] = useState<State>({
    step: 'idle',
    progress: '',
    result: null,
    error: null,
  });
  const abortRef = useRef<AbortController | null>(null);

  const handleCompare = useCallback(async () => {
    if (!inputA.trim() || !inputB.trim()) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState({ step: 'loading', progress: 'Starting comparison...', result: null, error: null });
    try {
      const result = await compare.run(inputA.trim(), inputB.trim(), {
        signal: controller.signal,
        onProgress: (msg) =>
          setState((prev) => (prev.step === 'loading' ? { ...prev, progress: msg } : prev)),
      });
      setState({ step: 'done', progress: '', result, error: null });
    } catch (err) {
      if ((err as { name?: string })?.name === 'AbortError') return;
      setState({
        step: 'error',
        progress: '',
        result: null,
        error: err instanceof Error ? err.message : 'An unexpected error occurred.',
      });
    }
  }, [inputA, inputB, compare]);

  const handleReset = useCallback(() => {
    abortRef.current?.abort();
    setState({ step: 'idle', progress: '', result: null, error: null });
  }, []);

  return (
    <PageContainer>
      <PageHero
        title="Compare"
        highlight="Repositories"
        subtitle="Analyze two repositories side by side. See which one scores higher across all categories."
      />

      <div className="mb-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          <RepoPicker
            inputId="compare-repo-a"
            label="Repo A"
            value={inputA}
            onChange={setInputA}
            onSubmit={handleCompare}
            disabled={state.step === 'loading'}
          />
          <RepoPicker
            inputId="compare-repo-b"
            label="Repo B"
            value={inputB}
            onChange={setInputB}
            onSubmit={handleCompare}
            disabled={state.step === 'loading'}
            hideAuthChrome
          />
        </div>
        <div className="flex justify-center gap-3">
          <PrimaryButton
            onClick={handleCompare}
            disabled={state.step === 'loading' || !inputA.trim() || !inputB.trim()}
          >
            {state.step === 'loading' ? 'Comparing...' : 'Compare'}
          </PrimaryButton>
          {state.step === 'done' && (
            <SecondaryButton onClick={handleReset}>Reset</SecondaryButton>
          )}
        </div>
      </div>

      {state.step === 'loading' && <LoadingPanel message={state.progress} />}

      {state.step === 'error' && state.error && (
        <ErrorPanel title="Comparison failed" message={state.error} />
      )}

      {state.step === 'done' && state.result && (
        <CompareView
          reportA={state.result.reportA}
          reportB={state.result.reportB}
          deltas={state.result.deltas}
          winner={state.result.winner}
          scoreDelta={state.result.scoreDelta}
          extras={state.result.extras}
        />
      )}
    </PageContainer>
  );
}
