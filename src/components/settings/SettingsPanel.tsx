import { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import type { AppSettings } from '../../types';
import { saveGithubToken, clearGithubToken } from '../../services/persistence/credentials';

function GitHubTokenField() {
  const { state, dispatch } = useApp();
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'unsupported'>('idle');

  const handleSave = async () => {
    if (!state.githubToken) return;
    const ok = await saveGithubToken(state.githubToken);
    setSaveStatus(ok ? 'saved' : 'unsupported');
    setTimeout(() => setSaveStatus('idle'), 3000);
  };

  const handleClear = async () => {
    dispatch({ type: 'SET_GITHUB_TOKEN', token: '' });
    await clearGithubToken();
  };

  return (
    <div className="mb-8">
      <label htmlFor="github-token" className="block text-sm font-semibold text-text mb-1.5">
        GitHub Token
      </label>
      <p id="github-token-desc" className="text-sm text-text-muted mb-3 leading-relaxed">
        Increases API rate limit from 60 to 5,000 req/hr. Enables private repo access and repo
        browsing. Stored via your browser's Credential Management API with IndexedDB fallback.
        Persists across sessions.
      </p>
      <div className="flex gap-2">
        <input
          id="github-token"
          type="password"
          value={state.githubToken}
          onChange={(e) => {
            dispatch({ type: 'SET_GITHUB_TOKEN', token: e.target.value });
            setSaveStatus('idle');
          }}
          placeholder="ghp_..."
          className="flex-1 px-4 py-2.5 text-sm rounded-lg border border-border bg-surface-alt text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-neon/50 focus:border-neon/50 transition-all"
          aria-describedby="github-token-desc"
          autoComplete="off"
        />
        {state.githubToken && (
          <>
            <button
              onClick={handleSave}
              className="px-4 py-2.5 text-sm rounded-lg border border-neon/30 hover:bg-neon/10 text-neon transition-all"
              aria-label="Save GitHub token"
            >
              {saveStatus === 'saved' ? 'Saved' : 'Save'}
            </button>
            <button
              onClick={handleClear}
              className="px-4 py-2.5 text-sm rounded-lg border border-border hover:bg-surface-hover hover:border-grade-f/30 text-text-secondary hover:text-grade-f transition-all"
              aria-label="Clear GitHub token"
            >
              Clear
            </button>
          </>
        )}
      </div>
      {saveStatus === 'unsupported' && (
        <p className="text-xs text-grade-c mt-2">
          Your browser doesn't support the Credential Management API. Token will be kept in memory
          only.
        </p>
      )}
    </div>
  );
}

export function SettingsPanel() {
  const { state, dispatch } = useApp();
  const panelRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const handleClose = useCallback(() => {
    dispatch({ type: 'TOGGLE_SETTINGS' });
  }, [dispatch]);

  // Focus the close button when panel opens
  useEffect(() => {
    if (state.settingsOpen) {
      closeButtonRef.current?.focus();
    }
  }, [state.settingsOpen]);

  // Escape key closes panel
  useEffect(() => {
    if (!state.settingsOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
        return;
      }

      // Focus trap
      if (e.key === 'Tab' && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll<HTMLElement>(
          'button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [state.settingsOpen, handleClose]);

  if (!state.settingsOpen) return null;

  const pillClass = (active: boolean) =>
    `px-4 py-2 text-sm font-medium rounded-lg border transition-all duration-200 ${
      active
        ? 'border-neon/50 bg-neon/10 text-neon'
        : 'border-border hover:bg-surface-hover text-text-secondary'
    }`;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <dialog
        ref={panelRef}
        className="fixed top-0 right-0 h-full w-full max-w-md bg-surface border-l border-border shadow-2xl z-50 overflow-y-auto m-0 p-0"
        aria-label="Settings"
        open
      >
        <div className="p-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-bold text-text" id="settings-title">
              Settings
            </h2>
            <button
              ref={closeButtonRef}
              onClick={handleClose}
              className="p-2 rounded-lg hover:bg-surface-hover text-text-secondary hover:text-neon transition-all duration-200"
              aria-label="Close settings"
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
          </div>

          {/* Theme */}
          <fieldset className="mb-8">
            <legend className="block text-sm font-semibold text-text mb-3">Theme</legend>
            <div className="flex gap-2">
              {(['dark', 'light'] as const).map((theme) => (
                <label
                  key={theme}
                  className={`cursor-pointer ${pillClass(state.settings.theme === theme)}`}
                >
                  <input
                    type="radio"
                    name="theme"
                    value={theme}
                    checked={state.settings.theme === theme}
                    onChange={() => dispatch({ type: 'SET_THEME', theme })}
                    className="sr-only"
                  />
                  {theme.charAt(0).toUpperCase() + theme.slice(1)}
                </label>
              ))}
            </div>
          </fieldset>

          {/* GitHub Token */}
          <GitHubTokenField />

          {/* LLM Mode */}
          <fieldset className="mb-8">
            <legend className="block text-sm font-semibold text-text mb-1.5">AI Enrichment</legend>
            <p id="llm-mode-desc" className="text-sm text-text-muted mb-3 leading-relaxed">
              Uses your Anthropic API key to generate AI-powered executive summary, risks, and
              recommendations.
            </p>
            <div className="flex gap-2" aria-describedby="llm-mode-desc">
              {(['off', 'enriched'] as AppSettings['llmMode'][]).map((mode) => (
                <label
                  key={mode}
                  className={`cursor-pointer ${pillClass(state.settings.llmMode === mode)}`}
                >
                  <input
                    type="radio"
                    name="llm-mode"
                    value={mode}
                    checked={state.settings.llmMode === mode}
                    onChange={() => dispatch({ type: 'SET_LLM_MODE', mode })}
                    className="sr-only"
                  />
                  {mode === 'off' ? 'Off' : 'AI Enriched'}
                </label>
              ))}
            </div>
          </fieldset>

          {/* Anthropic API Key */}
          {state.settings.llmMode === 'enriched' && (
            <div className="mb-8">
              <label
                htmlFor="anthropic-key"
                className="block text-sm font-semibold text-text mb-1.5"
              >
                Anthropic API Key
              </label>
              <p id="anthropic-key-desc" className="text-sm text-text-muted mb-3 leading-relaxed">
                Your key is kept in memory only and never persisted.
              </p>
              <div className="flex gap-2">
                <input
                  id="anthropic-key"
                  type="password"
                  value={state.anthropicKey}
                  onChange={(e) => dispatch({ type: 'SET_ANTHROPIC_KEY', key: e.target.value })}
                  placeholder="sk-ant-..."
                  className="flex-1 px-4 py-2.5 text-sm rounded-lg border border-border bg-surface-alt text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-neon/50 focus:border-neon/50 transition-all"
                  aria-describedby="anthropic-key-desc"
                  autoComplete="off"
                />
                {state.anthropicKey && (
                  <button
                    onClick={() => dispatch({ type: 'SET_ANTHROPIC_KEY', key: '' })}
                    className="px-4 py-2.5 text-sm rounded-lg border border-border hover:bg-surface-hover hover:border-grade-f/30 text-text-secondary hover:text-grade-f transition-all"
                    aria-label="Clear Anthropic API key"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Rate limit info */}
          {state.rateLimit && (
            <output
              className="block p-5 rounded-xl bg-surface-alt border border-border"
              aria-label="API rate limit information"
            >
              <h3 className="text-sm font-semibold text-text mb-2">API Rate Limit</h3>
              <div className="text-sm text-text-muted space-y-1">
                <p>
                  Used:{' '}
                  <span className="text-text-secondary">
                    {state.rateLimit.used}/{state.rateLimit.limit}
                  </span>
                </p>
                <p>
                  Remaining:{' '}
                  <span className="text-text-secondary">{state.rateLimit.remaining}</span>
                </p>
                <p>
                  Resets:{' '}
                  <span className="text-text-secondary">
                    {new Date(state.rateLimit.reset * 1000).toLocaleTimeString()}
                  </span>
                </p>
              </div>
              {!state.githubToken && state.rateLimit.remaining < 20 && (
                <p className="text-sm text-grade-c mt-3 font-medium" role="alert">
                  Running low on unauthenticated requests. Add a GitHub token above for 5,000
                  req/hr.
                </p>
              )}
            </output>
          )}
        </div>
      </dialog>
    </>
  );
}
