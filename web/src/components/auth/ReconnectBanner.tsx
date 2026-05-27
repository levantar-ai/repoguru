import { useApp } from '../../context/AppContext';
import { isOAuthAvailable, startOAuthFlow } from '../../utils/oauth';

/** Inline banner shown when the GitHub fetcher saw a 401. Sits above
 *  the main content area so the user sees it on whatever page they
 *  were on; one click reconnects and returns them here. */
export function ReconnectBanner() {
  const { state, dispatch } = useApp();

  if (!state.authExpired) return null;

  const canReconnect = isOAuthAvailable();

  return (
    <div role="alert" className="border-b border-amber-400/30 bg-amber-400/10 px-4 py-2.5">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <svg
            className="h-4 w-4 text-amber-400 shrink-0"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm-.75-12a.75.75 0 011.5 0v4.5a.75.75 0 01-1.5 0V6zm.75 8.5a1 1 0 110-2 1 1 0 010 2z"
              clipRule="evenodd"
            />
          </svg>
          <p className="text-sm text-text truncate">
            <span className="font-semibold">GitHub session expired.</span>{' '}
            <span className="text-text-secondary">
              Reconnect to keep using private repos and avoid rate limits.
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {canReconnect ? (
            <button
              type="button"
              onClick={() => startOAuthFlow()}
              className="rounded-md bg-amber-400 px-3 py-1.5 text-xs font-semibold text-black hover:bg-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-1 focus:ring-offset-surface"
            >
              Reconnect to GitHub
            </button>
          ) : (
            <button
              type="button"
              onClick={() => dispatch({ type: 'TOGGLE_SETTINGS' })}
              className="rounded-md bg-amber-400 px-3 py-1.5 text-xs font-semibold text-black hover:bg-amber-300"
            >
              Open settings
            </button>
          )}
          <button
            type="button"
            onClick={() => dispatch({ type: 'SET_AUTH_EXPIRED', expired: false })}
            aria-label="Dismiss"
            className="rounded p-1 text-text-muted hover:text-text hover:bg-white/5"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
