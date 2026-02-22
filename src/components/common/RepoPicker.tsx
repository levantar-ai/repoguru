import { useState, useMemo } from 'react';
import { useMyRepos } from '../../hooks/useMyRepos';
import { startOAuthFlow, isOAuthAvailable } from '../../utils/oauth';
import { trackEvent } from '../../utils/analytics';
import type { RepoInfo } from '../../types';

interface Props {
  onSelect: (slug: string) => void;
  disabled?: boolean;
}

export function RepoPicker({ onSelect, disabled }: Props) {
  const { repos, loading, error, refresh, orgList, hasToken } = useMyRepos();
  const [filterText, setFilterText] = useState('');
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);

  const filteredRepos = useMemo(() => {
    let list = repos;
    if (selectedOrg) {
      list = list.filter((r) => r.owner === selectedOrg);
    }
    if (filterText) {
      const q = filterText.toLowerCase();
      list = list.filter(
        (r) =>
          r.repo.toLowerCase().includes(q) ||
          r.owner.toLowerCase().includes(q) ||
          (r.language || '').toLowerCase().includes(q) ||
          (r.description || '').toLowerCase().includes(q),
      );
    }
    return list;
  }, [repos, selectedOrg, filterText]);

  const handleSelect = (repo: RepoInfo) => {
    setFilterText('');
    setSelectedOrg(null);
    onSelect(`${repo.owner}/${repo.repo}`);
  };

  // No token: show setup instructions
  if (!hasToken) {
    const oauthAvailable = isOAuthAvailable();
    return (
      <div className="mt-4 px-5 py-3 rounded-xl bg-neon/5 border border-neon/20 text-sm text-text-secondary">
        {oauthAvailable && (
          <div className="mb-3">
            <button
              onClick={() => {
                trackEvent('oauth_start', { source: 'repo_picker' });
                startOAuthFlow();
              }}
              className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg bg-[#24292f] hover:bg-[#32383f] text-white text-sm font-medium transition-colors"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
              Sign in with GitHub
            </button>
            <div className="text-center text-xs text-text-muted mt-2">
              to browse repos, unlock private access, and get 80x rate limits
            </div>
          </div>
        )}
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
          <span className="text-text-muted">
            {oauthAvailable ? 'Or add' : 'Add'} a GitHub token in{' '}
            <strong className="text-text-secondary">Settings</strong> (gear icon) to browse your
            repos, unlock private repo access, and get 80&times; higher API rate limits.{' '}
            <a
              href="https://github.com/settings/personal-access-tokens/new"
              target="_blank"
              rel="noopener noreferrer"
              className="text-neon hover:underline"
            >
              Create a fine-grained token
            </a>{' '}
            with read-only access to{' '}
            <code className="px-1 py-0.5 rounded bg-surface-alt text-xs">Contents</code> and{' '}
            <code className="px-1 py-0.5 rounded bg-surface-alt text-xs">Metadata</code>. For org
            scanning, also grant{' '}
            <code className="px-1 py-0.5 rounded bg-surface-alt text-xs">
              Organization: Members
            </code>{' '}
            (read). Alternatively, a classic token with{' '}
            <code className="px-1 py-0.5 rounded bg-surface-alt text-xs">public_repo</code> scope
            works for public repos.{' '}
            <a href="#how-it-works" className="text-neon hover:underline">
              See How It Works &rarr; Token Setup
            </a>
          </span>
        </div>
      </div>
    );
  }

  // Initial loading (no cached data)
  if (loading && repos.length === 0) {
    return (
      <div className="mt-4 flex items-center gap-2 px-4 py-3 rounded-xl border border-border bg-surface-alt text-sm text-text-muted">
        <svg className="h-4 w-4 text-neon animate-spin shrink-0" viewBox="0 0 24 24" fill="none">
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
        Loading your repositories...
      </div>
    );
  }

  // Error with no cached data
  if (error && repos.length === 0) {
    return (
      <div className="mt-4 flex items-center gap-2 px-4 py-3 rounded-xl border border-grade-f/25 bg-grade-f/5 text-sm text-grade-f">
        <span>{error}</span>
        <button onClick={refresh} className="ml-auto text-neon hover:underline text-xs">
          Retry
        </button>
      </div>
    );
  }

  if (repos.length === 0) return null;

  return (
    <div className="mt-4 rounded-xl border border-border bg-surface-alt overflow-hidden">
      {/* Search bar + refresh */}
      <div className="p-2.5 border-b border-border flex gap-2">
        <input
          type="text"
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          placeholder="Search your repos..."
          disabled={disabled}
          className="flex-1 px-3 py-2 text-sm rounded-lg border border-border bg-surface text-text placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-neon/50 disabled:opacity-50"
        />
        <button
          onClick={refresh}
          disabled={loading || disabled}
          title="Refresh repos"
          className="px-2.5 py-2 rounded-lg border border-border text-text-muted hover:text-neon hover:border-neon/40 transition-all disabled:opacity-40"
        >
          <svg
            className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>
      </div>

      {/* Two-column: org sidebar | repo list */}
      <div className="flex" style={{ height: '20rem' }}>
        {/* Org sidebar */}
        {orgList.length > 0 && (
          <div className="w-44 shrink-0 border-r border-border overflow-y-auto bg-surface/50">
            <button
              onClick={() => setSelectedOrg(null)}
              className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left text-xs font-medium transition-all ${
                selectedOrg === null
                  ? 'bg-neon/10 text-neon border-r-2 border-neon'
                  : 'text-text-secondary hover:text-text hover:bg-surface-hover'
              }`}
            >
              <span className="truncate">All repos</span>
              <span
                className={`shrink-0 tabular-nums ${selectedOrg === null ? 'text-neon' : 'text-text-muted'}`}
              >
                {repos.length}
              </span>
            </button>
            {orgList.map((org) => (
              <button
                key={org.name}
                onClick={() => setSelectedOrg(selectedOrg === org.name ? null : org.name)}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left text-xs font-medium transition-all ${
                  selectedOrg === org.name
                    ? 'bg-neon/10 text-neon border-r-2 border-neon'
                    : 'text-text-secondary hover:text-text hover:bg-surface-hover'
                }`}
              >
                <span className="truncate">{org.name}</span>
                <span
                  className={`shrink-0 tabular-nums ${selectedOrg === org.name ? 'text-neon' : 'text-text-muted'}`}
                >
                  {org.count}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Repo list */}
        <div className="flex-1 overflow-y-auto">
          {filteredRepos.length === 0 ? (
            <div className="px-4 py-6 text-sm text-text-muted text-center">No matching repos</div>
          ) : (
            filteredRepos.map((repo) => (
              <button
                key={`${repo.owner}/${repo.repo}`}
                onClick={() => handleSelect(repo)}
                disabled={disabled}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-hover transition-colors disabled:opacity-50 border-b border-border/50 last:border-b-0"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-text truncate">
                    {!selectedOrg && (
                      <span className="text-text-muted font-normal">{repo.owner}/</span>
                    )}
                    {repo.repo}
                  </div>
                  {repo.description && (
                    <div className="text-xs text-text-muted truncate mt-0.5">
                      {repo.description}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {repo.language && (
                    <span className="text-xs text-text-muted">{repo.language}</span>
                  )}
                  {repo.stars > 0 && (
                    <span className="text-xs text-text-muted flex items-center gap-0.5">
                      <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                      </svg>
                      {repo.stars}
                    </span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
