import type { AnalysisStep } from '../../types';

const STEP_LABELS: Record<AnalysisStep, string> = {
  idle: '',
  parsing: 'Parsing URL...',
  'fetching-info': 'Fetching repository info...',
  cloning: 'Cloning repository...',
  'fetching-tree': 'Fetching file tree...',
  'fetching-files': 'Downloading files for analysis...',
  analyzing: 'Running heuristic analysis...',
  'llm-enrichment': 'Getting AI insights...',
  done: 'Complete!',
  error: 'Error',
};

interface Props {
  step: AnalysisStep;
  progress: number;
  subProgress?: number;
  filesFetched?: number;
  filesTotal?: number;
}

export function ProgressBar({ step, progress, subProgress, filesFetched, filesTotal }: Props) {
  if (step === 'idle') return null;

  const label = STEP_LABELS[step];
  const fileProgress =
    step === 'fetching-files' && filesTotal ? ` (${filesFetched}/${filesTotal})` : '';

  const roundedProgress = Math.round(progress);
  const showSubBar = subProgress != null && subProgress > 0 && step === 'cloning';

  return (
    <output className="block w-full max-w-2xl mx-auto mt-8" aria-live="polite">
      {/* Overall progress */}
      <div className="flex justify-between text-sm text-text-secondary mb-2">
        <span>Overall Progress</span>
        <span className="text-neon font-medium" aria-hidden="true">
          {roundedProgress}%
        </span>
      </div>
      <div className="h-3 bg-surface-alt rounded-full overflow-hidden border border-border">
        <div
          className="h-full bg-gradient-to-r from-primary-500 to-neon rounded-full transition-all duration-300 ease-out"
          style={{ width: `${progress}%`, boxShadow: '0 0 10px rgba(56, 189, 248, 0.3)' }}
          aria-hidden="true"
        />
      </div>

      {/* Sub-task progress — shown during clone */}
      {showSubBar && (
        <>
          <div className="flex justify-between text-xs text-text-muted mt-2.5 mb-1">
            <span>
              {label}
              {fileProgress}
            </span>
            <span className="tabular-nums">{Math.round(subProgress)}%</span>
          </div>
          <div className="h-1.5 bg-surface-alt rounded-full overflow-hidden border border-border/50">
            <div
              className="h-full bg-neon/60 rounded-full transition-all duration-200 ease-out"
              style={{ width: `${subProgress}%` }}
              aria-hidden="true"
            />
          </div>
        </>
      )}

      {/* Step label when no sub-bar */}
      {!showSubBar && (
        <div className="text-sm text-text-secondary mt-2">
          {label}
          {fileProgress}
        </div>
      )}

      <progress
        className="sr-only"
        value={roundedProgress}
        max={100}
        aria-label={`${label}${fileProgress} ${roundedProgress}% complete`}
      />
    </output>
  );
}
