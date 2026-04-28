import type { ReactNode } from 'react';

export interface LoadingPanelProps {
  message: string;
}

/** Spinner + message panel matching the in-browser app's loading state. */
export function LoadingPanel({ message }: LoadingPanelProps) {
  return (
    <div className="text-center py-16">
      <div className="inline-flex items-center gap-3 px-6 py-4 rounded-xl bg-surface-alt border border-border">
        <svg
          className="animate-spin h-5 w-5 text-neon"
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
        <span className="text-text-secondary">{message}</span>
      </div>
    </div>
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
    <div className="max-w-2xl mx-auto mb-8 px-5 py-4 rounded-xl bg-grade-f/10 border border-grade-f/25">
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
