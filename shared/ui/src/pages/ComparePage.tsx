import { useState, useCallback, useRef } from 'react';
import { useRepoGuru } from '../services/Provider.js';
import { CompareView } from '../views/CompareView.js';
import { PageContainer } from '../chrome/PageContainer.js';
import { PageHero } from '../chrome/PageHero.js';
import { PrivacyStrip } from '../chrome/PrivacyStrip.js';
import { PrimaryButton, SecondaryButton } from '../chrome/Buttons.js';
import { LoadingPanel, ErrorPanel } from '../chrome/StatusPanels.js';
import { RepoPicker } from '../chrome/RepoPicker.js';
import type { CompareResult, AnalysisProgress } from '../services/types.js';

type Step = 'idle' | 'loading' | 'done' | 'error';

interface State {
  step: Step;
  message: string;
  progress: AnalysisProgress | null;
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
    message: '',
    progress: null,
    result: null,
    error: null,
  });
  const abortRef = useRef<AbortController | null>(null);

  const handleCompare = useCallback(async () => {
    if (!inputA.trim() || !inputB.trim()) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState({
      step: 'loading',
      message: 'Starting comparison…',
      progress: {
        message: 'Starting comparison…',
        overall: 1,
        sub: 0,
        phase: 'starting',
      },
      result: null,
      error: null,
    });
    try {
      const result = await compare.run(inputA.trim(), inputB.trim(), {
        signal: controller.signal,
        onProgress: (p) =>
          setState((prev) =>
            prev.step === 'loading' ? { ...prev, message: p.message, progress: p } : prev,
          ),
      });
      setState((prev) =>
        prev.step === 'loading'
          ? {
              ...prev,
              message: 'Complete',
              progress: {
                message: 'Complete',
                overall: 100,
                sub: 100,
                phase: 'done',
              },
            }
          : prev,
      );
      await new Promise((r) => setTimeout(r, 400));
      if (controller.signal.aborted) return;
      setState({
        step: 'done',
        message: '',
        progress: null,
        result,
        error: null,
      });
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
  }, [inputA, inputB, compare]);

  const handleReset = useCallback(() => {
    abortRef.current?.abort();
    setState({
      step: 'idle',
      message: '',
      progress: null,
      result: null,
      error: null,
    });
  }, []);

  return (
    <PageContainer>
      <PageHero
        title="Compare"
        highlight="two repositories side by side."
        subtitle="See which one scores higher across security, code quality, and CI/CD — runs locally."
      />
      <PrivacyStrip />

      {state.step === 'idle' && (
        <div className="mb-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <RepoPicker
              inputId="compare-repo-a"
              label="Repo A"
              value={inputA}
              onChange={setInputA}
              onSubmit={handleCompare}
            />
            <RepoPicker
              inputId="compare-repo-b"
              label="Repo B"
              value={inputB}
              onChange={setInputB}
              onSubmit={handleCompare}
              hideAuthChrome
            />
          </div>
          <div className="flex justify-center gap-3">
            <PrimaryButton onClick={handleCompare} disabled={!inputA.trim() || !inputB.trim()}>
              Compare
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
        <ErrorPanel title="Comparison failed" message={state.error} />
      )}

      {state.step === 'done' && state.result && (
        <>
          <div className="max-w-3xl mx-auto mb-4 flex justify-end">
            <SecondaryButton onClick={handleReset}>New Comparison</SecondaryButton>
          </div>
          <CompareView
            reportA={state.result.reportA}
            reportB={state.result.reportB}
            deltas={state.result.deltas}
            winner={state.result.winner}
            scoreDelta={state.result.scoreDelta}
            extras={state.result.extras}
          />
        </>
      )}
    </PageContainer>
  );
}
