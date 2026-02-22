import { useState, useCallback, useEffect, useRef } from 'react';
import { parseErrorWithTip } from '../utils/humanizeError';
import { useGitStats } from '../hooks/useGitStats';
import { GitStatsProgress } from '../components/git-stats/GitStatsProgress';
import { StatsOverviewCards } from '../components/git-stats/StatsOverviewCards';
import { CommitHeatmap } from '../components/git-stats/CommitHeatmap';
import { CodeFrequencyChart } from '../components/git-stats/CodeFrequencyChart';
import { ContributorBreakdown } from '../components/git-stats/ContributorBreakdown';
import { PunchCard } from '../components/git-stats/PunchCard';
import { LanguageBreakdown } from '../components/git-stats/LanguageBreakdown';
import { CommitSizeHistogram } from '../components/git-stats/CommitSizeHistogram';
import { RepoGrowthTimeline } from '../components/git-stats/RepoGrowthTimeline';
import { FileChurnTable } from '../components/git-stats/FileChurnTable';
import { CommitPatterns } from '../components/git-stats/CommitPatterns';
import { CommitMessageCloud } from '../components/git-stats/CommitMessageCloud';
import { BusFactor } from '../components/git-stats/BusFactor';
import { RepoPicker } from '../components/common/RepoPicker';
import { CommitsByWeekday } from '../components/git-stats/CommitsByWeekday';
import { CommitsByMonth } from '../components/git-stats/CommitsByMonth';
import { CommitsByYear } from '../components/git-stats/CommitsByYear';
import { CommitsByExtension } from '../components/git-stats/CommitsByExtension';
import { FileCoupling } from '../components/git-stats/FileCoupling';

interface Props {
  initialRepo?: string | null;
}

function ChartSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-surface-alt p-6">
      <h3 className="text-base font-semibold text-text mb-4">{title}</h3>
      {children}
    </section>
  );
}

export function GitStatsPage({ initialRepo }: Props) {
  const [repoInput, setRepoInput] = useState(initialRepo ?? '');
  const { state, analyze, reset } = useGitStats();
  const didAutoStart = useRef(false);

  useEffect(() => {
    if (initialRepo && !didAutoStart.current) {
      didAutoStart.current = true;
      analyze(initialRepo);
    }
  }, [initialRepo, analyze]);

  const isLoading = state.step !== 'idle' && state.step !== 'done' && state.step !== 'error';
  const hasResults = state.step === 'done' && state.analysis;

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
      {/* Header */}
      <div className="text-center mb-10">
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-text tracking-tight">
          Git <span className="text-neon neon-text">Stats</span>
        </h1>
        <p className="mt-4 text-lg text-text-secondary max-w-2xl mx-auto leading-relaxed">
          Deep commit and contributor analysis with interactive visualizations. Analyze the last
          1,000 commits for patterns, bus factor, code churn, and more.
        </p>
      </div>

      {/* Input */}
      {!hasResults && (
        <div className="max-w-xl mx-auto mb-10">
          <div className="flex gap-3">
            <input
              type="text"
              value={repoInput}
              onChange={(e) => setRepoInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder="owner/repo (e.g. facebook/react)"
              disabled={isLoading}
              className="flex-1 px-4 py-3.5 text-base rounded-xl border border-border bg-surface-alt text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-neon/50 focus:border-neon/50 transition-all disabled:opacity-50"
            />
            <button
              onClick={handleSubmit}
              disabled={!repoInput.trim() || isLoading}
              className="px-6 py-3.5 text-base font-semibold rounded-xl bg-neon text-surface transition-all hover:shadow-lg hover:shadow-neon/20 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none whitespace-nowrap"
            >
              {isLoading ? 'Analyzing...' : 'Analyze Git Stats'}
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
                Clones the repository entirely in your browser — no server required. Works with
                public repos out of the box. Add a GitHub token in Settings for private repos and
                80&times; higher API limits.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Progress */}
      {isLoading && <GitStatsProgress state={state} />}

      {/* Error */}
      {state.step === 'error' &&
        state.error &&
        (() => {
          const { message: errMsg, tip: errTip } = parseErrorWithTip(state.error);
          return (
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
                    <p className="font-medium text-grade-f">Analysis failed</p>
                    <p className="mt-1 text-text-secondary">{errMsg}</p>
                  </div>
                </div>
                {errTip && (
                  <div className="mt-3 flex items-start gap-2 px-1 py-2 rounded-lg bg-surface-alt/50 text-xs text-text-secondary">
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
                        d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                      />
                    </svg>
                    <p>
                      <strong>Tip:</strong> {errTip}
                    </p>
                  </div>
                )}
                <button
                  onClick={reset}
                  className="mt-3 text-sm text-neon hover:text-neon/80 transition-colors"
                >
                  Try again
                </button>
              </div>
            </div>
          );
        })()}

      {/* Results */}
      {hasResults && state.analysis && (
        <div className="space-y-6">
          {/* Action bar */}
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-text">
              <span className="text-neon">
                {state.analysis.owner}/{state.analysis.repo}
              </span>
            </h2>
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
              New Analysis
            </button>
          </div>

          {/* Overview Cards */}
          <StatsOverviewCards analysis={state.analysis} />

          {/* Commit Heatmap */}
          {state.analysis.commitActivity && state.analysis.commitActivity.length > 0 && (
            <ChartSection title="Commit Activity (Last 52 Weeks)">
              <CommitHeatmap commitActivity={state.analysis.commitActivity} />
            </ChartSection>
          )}

          {/* Code Frequency + Language */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {state.analysis.codeFrequency && state.analysis.codeFrequency.length > 0 && (
              <div className="lg:col-span-2">
                <ChartSection title="Code Frequency">
                  <CodeFrequencyChart codeFrequency={state.analysis.codeFrequency} />
                </ChartSection>
              </div>
            )}
            {state.analysis.languages.length > 0 && (
              <ChartSection title="Languages">
                <LanguageBreakdown languages={state.analysis.languages} />
              </ChartSection>
            )}
          </div>

          {/* Contributor Breakdown */}
          {state.analysis.contributors.length > 0 && (
            <ChartSection title="Contributors">
              <ContributorBreakdown contributors={state.analysis.contributors} />
            </ChartSection>
          )}

          {/* Punch Card + Commit Size */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {state.analysis.punchCard.length > 0 && (
              <ChartSection title="Commit Punch Card">
                <PunchCard punchCard={state.analysis.punchCard} />
              </ChartSection>
            )}
            {state.analysis.commitSizeDistribution.buckets.some((b) => b.count > 0) && (
              <ChartSection title="Commit Size Distribution">
                <CommitSizeHistogram distribution={state.analysis.commitSizeDistribution} />
              </ChartSection>
            )}
          </div>

          {/* Repo Growth + Bus Factor */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {state.analysis.repoGrowth.length > 0 && (
              <div className="lg:col-span-2">
                <ChartSection title="Repository Growth">
                  <RepoGrowthTimeline repoGrowth={state.analysis.repoGrowth} />
                </ChartSection>
              </div>
            )}
            <ChartSection title="Bus Factor (Lorenz Curve)">
              <BusFactor busFactor={state.analysis.busFactor} />
            </ChartSection>
          </div>

          {/* Commit Patterns + Word Cloud */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartSection title="Commit Patterns">
              <CommitPatterns commitMessages={state.analysis.commitMessages} />
            </ChartSection>
            <ChartSection title="Commit Message Word Cloud">
              <CommitMessageCloud wordFrequency={state.analysis.commitMessages.wordFrequency} />
            </ChartSection>
          </div>

          {/* File Churn Table */}
          <ChartSection title="File Churn (Most Changed Files)">
            <FileChurnTable fileChurn={state.analysis.fileChurn} />
          </ChartSection>

          {/* Commits by Weekday + Month */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {state.analysis.commitsByWeekday.some((c) => c > 0) && (
              <ChartSection title="Commits by Day of Week">
                <CommitsByWeekday commitsByWeekday={state.analysis.commitsByWeekday} />
              </ChartSection>
            )}
            {state.analysis.commitsByMonth.some((c) => c > 0) && (
              <ChartSection title="Commits by Month">
                <CommitsByMonth commitsByMonth={state.analysis.commitsByMonth} />
              </ChartSection>
            )}
          </div>

          {/* Commits by Year + Extension */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {state.analysis.commitsByYear.length > 0 && (
              <ChartSection title="Commits by Year">
                <CommitsByYear commitsByYear={state.analysis.commitsByYear} />
              </ChartSection>
            )}
            {state.analysis.commitsByExtension.length > 0 && (
              <ChartSection title="Commits by File Extension">
                <CommitsByExtension commitsByExtension={state.analysis.commitsByExtension} />
              </ChartSection>
            )}
          </div>

          {/* File Coupling */}
          {state.analysis.fileCoupling.length > 0 && (
            <ChartSection title="File Coupling (Co-changed Files)">
              <FileCoupling fileCoupling={state.analysis.fileCoupling} />
            </ChartSection>
          )}
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
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-text mb-2">Analyze Git History</h3>
          <p className="text-sm text-text-muted max-w-md mx-auto leading-relaxed">
            Enter a repository to analyze commit patterns, contributor distribution, code frequency,
            language breakdown, and more.
          </p>
        </div>
      )}
    </div>
  );
}
