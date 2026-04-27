import { parseErrorWithTip } from '../../utils/humanizeError';

interface Props {
  message: string;
  tip?: string;
  onDismiss?: () => void;
}

export function ErrorBanner({ message, tip: tipProp, onDismiss }: Props) {
  const parsed = parseErrorWithTip(message);
  const displayMessage = parsed.message;
  const tip = tipProp ?? parsed.tip;

  return (
    <div
      className="w-full max-w-2xl mx-auto mt-6 bg-grade-f/10 border border-grade-f/30 rounded-xl px-5 py-4"
      role="alert"
      aria-live="assertive"
    >
      <div className="flex items-start gap-3">
        <svg
          className="h-5 w-5 text-grade-f mt-0.5 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
          />
        </svg>
        <p className="text-sm text-text flex-1">{displayMessage}</p>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-text-muted hover:text-grade-f transition-colors"
            aria-label="Dismiss error"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>
      {tip && (
        <div className="mt-3 flex items-start gap-2 px-1 py-2 rounded-lg bg-surface-alt/50 text-xs text-text-secondary">
          <svg
            className="h-4 w-4 mt-0.5 shrink-0 text-neon"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
          </svg>
          <p>
            <strong>Tip:</strong> {tip}
          </p>
        </div>
      )}
    </div>
  );
}
