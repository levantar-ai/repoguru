import type { ReactNode } from 'react';

export interface LoadingPanelProps {
  message: string;
  /** Optional secondary line shown under the main message (e.g. current
   *  step name like "Diffing commits"). */
  subMessage?: string;
  /** Overall progress 0–100. When provided, renders the overall bar. */
  progress?: number;
  /** Sub-progress 0–100. When provided, renders the second (smaller) bar. */
  subProgress?: number;
}

/** Spinner + double-progress-bar panel matching the in-browser app's
 *  scan UI. Falls back to spinner-only when no progress numbers are
 *  supplied. */
export function LoadingPanel({
  message,
  subMessage,
  progress,
  subProgress,
}: LoadingPanelProps) {
  const showBars = typeof progress === 'number';
  if (!showBars) {
    return (
      // role=status + aria-live=polite so AT users hear "Analyzing…" /
      // "Cloning…" / etc. updates instead of silence during long
      // scoring runs (WCAG 4.1.3 Status Messages).
      <div className="text-center py-16" role="status" aria-live="polite" aria-atomic="true">
        <div className="inline-flex items-center gap-3 px-6 py-4 rounded-xl bg-surface-alt border border-border">
          <Spinner />
          <span className="text-text-secondary">{message}</span>
        </div>
      </div>
    );
  }
  const overall = Math.max(0, Math.min(100, progress!));
  const sub = Math.max(0, Math.min(100, subProgress ?? 0));
  return (
    <div
      className="max-w-3xl mx-auto py-12"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div
        className="flex items-center justify-between text-sm mb-2"
        role="progressbar"
        aria-label="Overall analysis progress"
        aria-valuenow={Math.round(overall)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <span className="font-medium text-text">Overall Progress</span>
        <span className="text-neon font-bold tabular-nums">{Math.round(overall)}%</span>
      </div>
      <div className="h-3 bg-surface-alt rounded-full overflow-hidden border border-border">
        <div
          className="h-full bg-gradient-to-r from-primary-500 to-neon rounded-full transition-all duration-300 ease-out"
          style={{ width: `${overall}%`, boxShadow: '0 0 12px rgba(56,189,248,0.4)' }}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-text-secondary mt-3 mb-1.5">
        <div className="flex items-center gap-2">
          <Spinner small />
          <span>{subMessage || message}</span>
        </div>
        {typeof subProgress === 'number' && (
          <span className="tabular-nums">{Math.round(sub)}%</span>
        )}
      </div>
      {typeof subProgress === 'number' && (
        <div
          className="h-1.5 bg-surface-alt rounded-full overflow-hidden border border-border/50"
          role="progressbar"
          aria-label={subMessage || 'Sub-task progress'}
          aria-valuenow={Math.round(sub)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full bg-neon/60 rounded-full transition-all duration-200 ease-out"
            style={{ width: `${sub}%` }}
          />
        </div>
      )}

      {message && subMessage && (
        <p className="text-sm text-text-secondary mt-2">{message}</p>
      )}
    </div>
  );
}

function Spinner({ small = false }: { small?: boolean }) {
  const size = small ? 'h-3.5 w-3.5' : 'h-5 w-5';
  return (
    <svg
      className={`animate-spin ${size} text-neon`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
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
  );
}

export interface ErrorPanelProps {
  title: string;
  message: string;
  /** Optional retry/reset button rendered below the message. */
  action?: ReactNode;
}

/** Error panel matching the in-browser app's failure state. */
export function ErrorPanel({ title, message, action }: ErrorPanelProps) {
  return (
    // role=alert (which implies aria-live=assertive + aria-atomic=true)
    // so AT users hear the failure immediately rather than discovering
    // it on next focus move.
    <div
      className="max-w-2xl mx-auto mb-8 px-5 py-4 rounded-xl bg-grade-f/10 border border-grade-f/25"
      role="alert"
    >
      <div className="flex items-start gap-3">
        <svg
          className="h-5 w-5 text-grade-f shrink-0 mt-0.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <div>
          <p className="text-sm font-medium text-grade-f">{title}</p>
          <p className="text-sm text-text-secondary mt-1">{message}</p>
        </div>
      </div>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
