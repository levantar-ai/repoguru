import { useState, useCallback, useRef, type ReactNode } from 'react';
import { useRepoGuru } from '../services/Provider.js';
import { ReportCardView } from '../views/ReportCardView.js';
import { PageContainer } from '../chrome/PageContainer.js';
import { PageHero } from '../chrome/PageHero.js';
import { PrimaryButton, SecondaryButton } from '../chrome/Buttons.js';
import { LoadingPanel, ErrorPanel } from '../chrome/StatusPanels.js';
import { PrivacyStrip } from '../chrome/PrivacyStrip.js';
import { DemoChips } from '../chrome/DemoChips.js';
import { RepoPicker } from '../chrome/RepoPicker.js';
import type { ScoreResult } from '../services/types.js';

type Step = 'idle' | 'loading' | 'done' | 'error';

interface State {
  step: Step;
  progress: string;
  result: ScoreResult | null;
  error: string | null;
}

/** Authoritative Report Card page. Both hosts mount this same React file —
 *  only `services.score` differs (browser: full in-browser AnalysisReport;
 *  desktop: gRPC ScoreReportCard via the CLI). The page rendering, hero,
 *  picker, action bar, and result chrome are identical. Hosts may attach
 *  additional content under the report card via `ScoreResult.extras`
 *  (e.g. browser-only TechStack, MermaidDiagram, LlmInsightsPanel,
 *  ContributorScore, BadgeGenerator, FixItLinks). */
export interface ReportCardPageProps {
  /** Optional pre-filled repo (e.g. coming from a deep-link or a recent
   *  analyses click). The page auto-runs once mounted with this set. */
  initialRepo?: string;
  /** Optional action element rendered next to the Rescore button after a
   *  scoring run completes (export buttons, share links, …). */
  actions?: ReactNode;
}

export function ReportCardPage({ initialRepo, actions }: ReportCardPageProps) {
  const { score } = useRepoGuru();
  const [input, setInput] = useState(initialRepo ?? '');
  const [state, setState] = useState<State>({
    step: 'idle',
    progress: '',
    result: null,
    error: null,
  });
  const abortRef = useRef<AbortController | null>(null);
  const autoStartedRef = useRef(false);

  const handleScore = useCallback(
    async (repoOverride?: string) => {
      const repo = (repoOverride ?? input).trim();
      if (!repo) return;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setState({ step: 'loading', progress: 'Starting analysis...', result: null, error: null });
      try {
        const result = await score.run(repo, {
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
    },
    [input, score],
  );

  const handleReset = useCallback(() => {
    abortRef.current?.abort();
    setState({ step: 'idle', progress: '', result: null, error: null });
  }, []);

  // Auto-start on initialRepo, once.
  if (initialRepo && !autoStartedRef.current && state.step === 'idle') {
    autoStartedRef.current = true;
    queueMicrotask(() => handleScore(initialRepo));
  }

  // The "done" state renders the report at full main-area width so the
  // section nav rail can sit flush against the app's main left sidebar.
  // The hero / picker / status panels remain inside the padded
  // PageContainer for centred layout.
  if (state.step === 'done' && state.result) {
    return (
      <>
        <ReportCardView
          report={state.result.report}
          actions={
            <div className="flex flex-wrap gap-2 items-center">
              {actions}
              <SecondaryButton onClick={handleReset}>New Analysis</SecondaryButton>
            </div>
          }
        />
        {state.result.extras}
      </>
    );
  }

  return (
    <PageContainer>
      <PageHero
        title="Score any repo —"
        highlight="instantly, in your browser."
        subtitle="A–F grade across security, documentation, CI/CD, and code health. No code leaves your machine."
      />
      <PrivacyStrip />

      <div className="mb-8 max-w-4xl mx-auto">
        <RepoPicker
          inputId="report-card-repo"
          label="Repository"
          value={input}
          onChange={setInput}
          onSubmit={() => handleScore()}
          disabled={state.step === 'loading'}
        />
        <div className="flex justify-center gap-3 mt-4 mb-6">
          <PrimaryButton
            onClick={() => handleScore()}
            disabled={state.step === 'loading' || !input.trim()}
          >
            {state.step === 'loading' ? 'Analyzing…' : 'Score'}
          </PrimaryButton>
        </div>
        <DemoChips
          disabled={state.step === 'loading'}
          onPick={(slug) => {
            setInput(slug);
            handleScore(slug);
          }}
        />
      </div>

      {state.step === 'loading' && <LoadingPanel message={state.progress} />}

      {state.step === 'error' && state.error && (
        <ErrorPanel
          title="Analysis failed"
          message={state.error}
          action={<SecondaryButton onClick={handleReset}>Try again</SecondaryButton>}
        />
      )}
    </PageContainer>
  );
}
