import { useState, useCallback, useRef } from 'react';
import { useRepoGuru } from '../services/Provider.js';
import { GitStatsView } from '../views/GitStatsView.js';
import { PageContainer } from '../chrome/PageContainer.js';
import { PageHero } from '../chrome/PageHero.js';
import { PrimaryButton, SecondaryButton } from '../chrome/Buttons.js';
import { LoadingPanel, ErrorPanel } from '../chrome/StatusPanels.js';
import { RepoPicker } from '../chrome/RepoPicker.js';
import type { GitStatsAnalysis } from '../charts/legacyTypes.js';

type Step = 'idle' | 'loading' | 'done' | 'error';

interface State {
  step: Step;
  message: string;
  analysis: GitStatsAnalysis | null;
  error: string | null;
}

/** Authoritative Git Stats page. Both hosts mount this same React file —
 *  services.gitStats injects the host's commit-history engine (browser:
 *  isomorphic-git clone in a worker, with a 1000-commit cap; desktop:
 *  CLI Scan over the entire local repo, no commit cap). */
export function GitStatsPage() {
  const { gitStats, isDesktop } = useRepoGuru();
  const [input, setInput] = useState('');
  const [state, setState] = useState<State>({
    step: 'idle',
    message: '',
    analysis: null,
    error: null,
  });
  const abortRef = useRef<AbortController | null>(null);

  const handleAnalyze = useCallback(async () => {
    if (!input.trim()) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setState({ step: 'loading', message: 'Cloning repository...', analysis: null, error: null });
    try {
      const result = await gitStats.run(input.trim(), {
        signal: controller.signal,
        onProgress: (msg) =>
          setState((prev) => (prev.step === 'loading' ? { ...prev, message: msg } : prev)),
      });
      setState({
        step: 'done',
        message: '',
        analysis: result.analysis as GitStatsAnalysis,
        error: null,
      });
    } catch (err) {
      if ((err as { name?: string })?.name === 'AbortError') return;
      setState({
        step: 'error',
        message: '',
        analysis: null,
        error: err instanceof Error ? err.message : 'An unexpected error occurred.',
      });
    }
  }, [input, gitStats]);

  const handleReset = useCallback(() => {
    abortRef.current?.abort();
    setState({ step: 'idle', message: '', analysis: null, error: null });
  }, []);

  return (
    <PageContainer>
      <PageHero
        title="Git"
        highlight="Stats"
        subtitle={
          isDesktop
            ? 'Mine commit history, contributors, code ownership, and trends across every commit in the repository.'
            : 'Mine commit history, contributors, code ownership, and trends across the most recent 1000 commits in the repository.'
        }
      />

      {state.step !== 'done' && (
        <div className="mb-8 max-w-2xl mx-auto">
          <RepoPicker
            inputId="git-stats-repo"
            label="Repository"
            value={input}
            onChange={setInput}
            onSubmit={handleAnalyze}
            disabled={state.step === 'loading'}
          />
          <div className="flex justify-center gap-3 mt-4">
            <PrimaryButton
              onClick={handleAnalyze}
              disabled={state.step === 'loading' || !input.trim()}
            >
              {state.step === 'loading' ? 'Analyzing...' : 'Analyze Git Stats'}
            </PrimaryButton>
          </div>
        </div>
      )}

      {state.step === 'loading' && <LoadingPanel message={state.message} />}

      {state.step === 'error' && state.error && (
        <ErrorPanel
          title="Analysis failed"
          message={state.error}
          action={<SecondaryButton onClick={handleReset}>Try again</SecondaryButton>}
        />
      )}

      {state.step === 'done' && state.analysis && (
        <GitStatsView
          analysis={state.analysis}
          actions={<SecondaryButton onClick={handleReset}>New Analysis</SecondaryButton>}
        />
      )}
    </PageContainer>
  );
}
