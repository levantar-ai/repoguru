import { useEffect, useRef } from 'react';
import type { PageId } from '../types';
import { useApp } from '../context/AppContext';
import { useAnalysis } from '../hooks/useAnalysis';
import { RepoInput } from '../components/input/RepoInput';
import { RepoPicker } from '../components/common/RepoPicker';
import { DemoRepoCards } from '../components/input/DemoRepoCards';
import { RecentReposList } from '../components/input/RecentReposList';
import { ProgressBar } from '../components/common/ProgressBar';
import { ErrorBanner } from '../components/common/ErrorBanner';
import { ReportCard } from '../components/report/ReportCard';

interface Props {
  onNavigate: (page: PageId) => void;
  initialRepo?: string | null;
}

export function HomePage({ onNavigate, initialRepo }: Props) {
  const { state: appState } = useApp();
  const { state, analyze, reset } = useAnalysis();
  const didAutoStart = useRef(false);

  useEffect(() => {
    if (initialRepo && !didAutoStart.current) {
      didAutoStart.current = true;
      analyze(initialRepo);
    }
  }, [initialRepo, analyze]);

  const isLoading = state.step !== 'idle' && state.step !== 'done' && state.step !== 'error';

  // Show report if we have one
  if (state.step === 'done' && state.report) {
    return <ReportCard report={state.report} onNewAnalysis={reset} />;
  }

  // File fetch progress
  const progress =
    state.step === 'fetching-files' && state.filesTotal > 0
      ? 35 + (state.filesFetched / state.filesTotal) * 45
      : state.progress;

  return (
    <div className="w-full px-8 lg:px-12 xl:px-16 py-16 sm:py-24">
      {/* Hero */}
      <div className="text-center mb-12">
        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight">
          <span className="text-text">Repository </span>
          <span className="text-neon neon-text">Report Card</span>
        </h1>
        <p className="mt-5 text-lg sm:text-xl text-text-secondary max-w-2xl mx-auto leading-relaxed">
          Analyze any GitHub repository — public or private with a token — for security,
          documentation, CI/CD, dependencies, and more. Instant letter grades, entirely in your
          browser.
        </p>
        <button
          onClick={() => onNavigate('docs')}
          className="mt-4 inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-neon transition-colors"
          aria-label="Learn how Repo Guru scoring works"
        >
          Learn how it works
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Rate limit warning */}
      {!appState.githubToken && appState.rateLimit && appState.rateLimit.remaining < 10 && (
        <div
          className="w-full max-w-2xl mx-auto mb-6 px-5 py-3 rounded-xl bg-grade-c/10 border border-grade-c/25 text-sm text-grade-c"
          role="alert"
        >
          Low rate limit ({appState.rateLimit.remaining} remaining). Add a GitHub token in Settings
          for 5,000 req/hr.
        </div>
      )}

      {/* Input */}
      <RepoInput onSubmit={analyze} isLoading={isLoading} />

      {/* My repos picker — hide during loading so progress bar is visible */}
      {!isLoading && (
        <div className="w-full max-w-2xl mx-auto">
          <RepoPicker onSelect={analyze} disabled={isLoading} />
        </div>
      )}

      {/* Progress */}
      {isLoading && (
        <ProgressBar
          step={state.step}
          progress={progress}
          subProgress={state.subProgress}
          filesFetched={state.filesFetched}
          filesTotal={state.filesTotal}
        />
      )}

      {/* Error */}
      {state.step === 'error' && state.error && (
        <ErrorBanner message={state.error} onDismiss={reset} />
      )}

      {/* Demo repos & recent repos when idle */}
      {!isLoading && state.step !== 'error' && (
        <>
          <DemoRepoCards onSelect={analyze} disabled={isLoading} />
          <RecentReposList repos={appState.recentRepos} onSelect={analyze} disabled={isLoading} />
        </>
      )}
    </div>
  );
}
