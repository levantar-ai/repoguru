import { useState, useCallback } from 'react';
import { useTechDetect } from '../hooks/useTechDetect';
import { TechDetectResults } from '../components/tech-detect/TechDetectResults';
import { RepoPicker } from '../components/common/RepoPicker';

interface Props {
  onBack: () => void;
}

const STEP_LABELS: Record<string, string> = {
  'fetching-tree': 'Fetching Repository',
  'fetching-files': 'Fetching Files',
  analyzing: 'Analyzing Technologies',
};

export function TechDetectPage({ onBack }: Props) {
  const [repoInput, setRepoInput] = useState('');
  const { state, analyze, reset } = useTechDetect();

  const isLoading = state.step !== 'idle' && state.step !== 'done' && state.step !== 'error';
  const hasResults = state.step === 'done' && state.result;

  const handleSubmit = () => {
    if (repoInput.trim()) {
      analyze(repoInput.trim());
    }
  };

  const handlePickerSelect = useCallback(
    (slug: string) => {
      setRepoInput(slug);
      analyze(slug);
    },
    [analyze],
  );

  return (
    <div className="w-full px-8 lg:px-12 xl:px-16 py-10 sm:py-16">
      {/* Back button */}
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-neon transition-colors mb-8"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to analyzer
      </button>

      {/* Header */}
      <div className="text-center mb-10">
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-text tracking-tight">
          Tech <span className="text-neon neon-text">Detection</span>
        </h1>
        <p className="mt-4 text-lg text-text-secondary max-w-2xl mx-auto leading-relaxed">
          Scan a repository to detect cloud services, language dependencies, and
          infrastructure-as-code.
        </p>
      </div>

      {/* Input */}
      {!hasResults && (
        <div className="max-w-3xl mx-auto mb-10">
          {/* Manual input */}
          <div className="flex gap-3">
            <input
              type="text"
              value={repoInput}
              onChange={(e) => setRepoInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder="owner/repo (e.g. aws/aws-sdk-js-v3)"
              disabled={isLoading}
              className="flex-1 px-4 py-3.5 text-base rounded-xl border border-border bg-surface-alt text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-neon/50 focus:border-neon/50 transition-all disabled:opacity-50"
            />
            <button
              onClick={handleSubmit}
              disabled={!repoInput.trim() || isLoading}
              className="px-6 py-3.5 text-base font-semibold rounded-xl bg-neon text-surface transition-all hover:shadow-lg hover:shadow-neon/20 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none whitespace-nowrap"
            >
              {isLoading ? 'Scanning...' : 'Analyze'}
            </button>
          </div>

          {/* Shared repo picker — hide during loading so progress bar is visible */}
          {!isLoading && <RepoPicker onSelect={handlePickerSelect} disabled={isLoading} />}

          <div className="mt-4 px-5 py-3 rounded-xl bg-neon/5 border border-neon/20 text-sm text-text-secondary">
            <div className="flex items-start gap-2">
              <svg
                className="h-4 w-4 mt-0.5 shrink-0 text-neon"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>
                Detects AWS, Azure, and GCP cloud services plus Node, Python, Go, Java, PHP, Rust,
                and Ruby dependencies from manifests and infrastructure-as-code.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Progress */}
      {isLoading && (
        <div className="max-w-2xl mx-auto mb-12">
          <div className="flex items-center justify-between text-sm mb-3">
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 text-neon animate-spin" viewBox="0 0 24 24" fill="none">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              <span className="font-medium text-text">{STEP_LABELS[state.step] || state.step}</span>
            </div>
            <span className="text-neon font-bold tabular-nums">{Math.round(state.progress)}%</span>
          </div>
          <div className="h-3 bg-surface-alt rounded-full overflow-hidden border border-border">
            <div
              className="h-full bg-gradient-to-r from-primary-500 to-neon rounded-full transition-all duration-300 ease-out"
              style={{
                width: `${state.progress}%`,
                boxShadow: '0 0 12px rgba(56, 189, 248, 0.4)',
              }}
            />
          </div>
          <p className="text-sm text-text-secondary mt-2">{state.statusMessage}</p>
        </div>
      )}

      {/* Error */}
      {state.step === 'error' && state.error && (
        <div className="max-w-2xl mx-auto mb-8">
          <div className="px-5 py-4 rounded-xl bg-grade-f/10 border border-grade-f/25 text-sm">
            <div className="flex items-start gap-3">
              <svg
                className="h-5 w-5 text-grade-f shrink-0 mt-0.5"
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
                <p className="font-medium text-grade-f">Scan failed</p>
                <p className="mt-1 text-text-secondary">{state.error}</p>
              </div>
            </div>
            <button
              onClick={reset}
              className="mt-3 text-sm text-neon hover:text-neon/80 transition-colors"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {/* Results */}
      {hasResults && state.result && (
        <div className="space-y-6">
          <div className="flex items-center justify-end">
            <button
              onClick={reset}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-border hover:bg-surface-hover hover:border-border-bright text-text-secondary hover:text-neon transition-all"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              New Scan
            </button>
          </div>
          <TechDetectResults result={state.result} />
        </div>
      )}

      {/* Empty idle state */}
      {state.step === 'idle' && (
        <div className="text-center mt-12">
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
                d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-text mb-2">Detect Technologies</h3>
          <p className="text-sm text-text-muted max-w-md mx-auto leading-relaxed">
            Enter a repository to scan for AWS services, Python packages, infrastructure-as-code,
            and SDK usage.
          </p>
        </div>
      )}
    </div>
  );
}
