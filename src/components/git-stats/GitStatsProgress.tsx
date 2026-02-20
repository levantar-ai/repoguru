import type { GitStatsState } from '../../types/gitStats';

interface Props {
  state: GitStatsState;
}

const STEP_LABELS: Record<string, string> = {
  cloning: 'Cloning Repository',
  'extracting-commits': 'Reading Commits',
  'extracting-details': 'Computing Diffs',
  'computing-stats': 'Building Statistics',
  'fetching-commits': 'Fetching Commits',
  'fetching-details': 'Fetching Commit Details',
  'fetching-stats': 'Fetching Statistics',
  analyzing: 'Analyzing Data',
};

export function GitStatsProgress({ state }: Props) {
  const stepLabel = STEP_LABELS[state.step] || state.step;

  return (
    <div className="max-w-2xl mx-auto mb-12">
      {/* Step indicator */}
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
          <span className="font-medium text-text">{stepLabel}</span>
        </div>
        <span className="text-neon font-bold tabular-nums">{Math.round(state.progress)}%</span>
      </div>

      {/* Progress bar */}
      <div className="h-3 bg-surface-alt rounded-full overflow-hidden border border-border">
        <div
          className="h-full bg-gradient-to-r from-primary-500 to-neon rounded-full transition-all duration-300 ease-out"
          style={{
            width: `${state.progress}%`,
            boxShadow: '0 0 12px rgba(56, 189, 248, 0.4)',
          }}
        />
      </div>

      {/* Status message */}
      <p className="text-sm text-text-secondary mt-2">{state.statusMessage}</p>

      {/* Stats counters — only shown during REST API fallback */}
      {(state.step === 'fetching-commits' ||
        state.step === 'fetching-details' ||
        state.step === 'fetching-stats') && (
        <div className="flex items-center gap-6 mt-4 text-xs text-text-muted">
          {state.commitsFetched > 0 && (
            <span>
              <span className="text-neon font-semibold">{state.commitsFetched}</span> commits
              fetched
            </span>
          )}
          {state.detailsFetched > 0 && (
            <span>
              <span className="text-neon font-semibold">{state.detailsFetched}</span> details loaded
            </span>
          )}
        </div>
      )}
    </div>
  );
}
