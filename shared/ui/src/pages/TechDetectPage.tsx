import { useState, useCallback, useRef } from 'react';
import { useRepoGuru } from '../services/Provider.js';
import { TechDetectView } from '../views/TechDetectView.js';
import { PageContainer } from '../chrome/PageContainer.js';
import { PageHero } from '../chrome/PageHero.js';
import { PrivacyStrip } from '../chrome/PrivacyStrip.js';
import { PrimaryButton, SecondaryButton } from '../chrome/Buttons.js';
import { LoadingPanel, ErrorPanel } from '../chrome/StatusPanels.js';
import { RepoPicker } from '../chrome/RepoPicker.js';
import type { TechDetectResult } from '@repoguru/core';
import type { AnalysisProgress } from '../services/types.js';

type Step = 'idle' | 'loading' | 'done' | 'error';

interface State {
  step: Step;
  message: string;
  progress: AnalysisProgress | null;
  result: TechDetectResult | null;
  error: string | null;
}

/** Authoritative Tech Detection page. Both hosts mount this same React
 *  file — only `services.techDetect` differs (browser scans manifests via
 *  the in-page tech detector; desktop calls the CLI's DetectTech RPC). */
export function TechDetectPage() {
  const { techDetect } = useRepoGuru();
  const [input, setInput] = useState('');
  const [state, setState] = useState<State>({
    step: 'idle',
    message: '',
    progress: null,
    result: null,
    error: null,
  });
  const abortRef = useRef<AbortController | null>(null);

  const handleDetect = useCallback(async () => {
    if (!input.trim()) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setState({
      step: 'loading',
      message: 'Scanning repository…',
      progress: {
        message: 'Scanning repository…',
        overall: 1,
        sub: 0,
        phase: 'starting',
      },
      result: null,
      error: null,
    });
    try {
      const result = await techDetect.run(input.trim(), {
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
  }, [input, techDetect]);

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

  // Done state: render the View flush against the page area's left
  // edge so the SectionLayout rail can sit next to the app sidebar.
  // Same pattern as Report Card and Git Stats.
  if (state.step === 'done' && state.result) {
    return (
      <TechDetectView
        result={state.result}
        actions={<SecondaryButton onClick={handleReset}>New Scan</SecondaryButton>}
      />
    );
  }

  return (
    <PageContainer>
      <PageHero
        title="Detect the"
        highlight="tech stack."
        subtitle="Frameworks, databases, cloud services, CI/CD, testing — every signal pulled from the repo, no third-party scanners."
      />
      <PrivacyStrip />

      {state.step === 'idle' && (
        <div className="mb-8 max-w-4xl mx-auto">
          <RepoPicker
            inputId="tech-detect-repo"
            label="Repository"
            value={input}
            onChange={setInput}
            onSubmit={handleDetect}
          />
          <div className="flex justify-center gap-3 mt-4">
            <PrimaryButton onClick={handleDetect} disabled={!input.trim()}>
              Detect
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
          title="Tech detection failed"
          message={state.error}
          action={<SecondaryButton onClick={handleReset}>Try again</SecondaryButton>}
        />
      )}
    </PageContainer>
  );
}
