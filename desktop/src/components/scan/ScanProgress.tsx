import type { ScanProgress as ScanProgressType } from '@/services/grpc-client';

const PHASE_LABELS: Record<string, string> = {
  open: 'Opening repository...',
  walk: 'Walking commit history...',
  diff: 'Computing file diffs...',
  sizer: 'Analyzing object database...',
  report: 'Generating report...',
  done: 'Scan complete!',
};

const PHASE_ORDER = ['open', 'walk', 'diff', 'sizer', 'report', 'done'];

interface Props {
  progress: ScanProgressType;
}

export function ScanProgress({ progress }: Props) {
  const phaseIndex = PHASE_ORDER.indexOf(progress.phase);
  const pct = progress.done ? 100 : Math.max(5, (phaseIndex / (PHASE_ORDER.length - 1)) * 100);

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-300">
          {PHASE_LABELS[progress.phase] || progress.message}
        </span>
        <span className="text-xs text-gray-500 tabular-nums">
          {progress.elapsed_seconds.toFixed(1)}s
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2 rounded-full bg-gray-800 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${pct}%`,
            backgroundColor: progress.error ? '#ef4444' : progress.done ? '#22c55e' : '#38bdf8',
          }}
        />
      </div>

      {/* Stats row */}
      <div className="mt-2 flex gap-4 text-[11px] text-gray-500">
        {progress.commits_processed > 0 && (
          <span>{progress.commits_processed.toLocaleString()} commits</span>
        )}
        {progress.file_changes_processed > 0 && (
          <span>{progress.file_changes_processed.toLocaleString()} file changes</span>
        )}
      </div>

      {/* Phase indicators */}
      <div className="mt-3 flex gap-1">
        {PHASE_ORDER.slice(0, -1).map((phase, i) => (
          <div
            key={phase}
            className="flex-1 h-1 rounded-full transition-colors"
            style={{
              backgroundColor: i < phaseIndex ? '#22c55e' : i === phaseIndex ? '#38bdf8' : '#1e293b',
            }}
          />
        ))}
      </div>

      {progress.error && (
        <div className="mt-3 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded px-3 py-2">
          {progress.error}
        </div>
      )}
    </div>
  );
}
