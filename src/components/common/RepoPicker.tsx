import { useState, useMemo } from 'react';
import { useMyRepos } from '../../hooks/useMyRepos';
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
    return (
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
          <span className="text-text-muted">
            Add a GitHub token in <strong className="text-text-secondary">Settings</strong> (gear
            icon) to browse your repositories and scan private repos.{' '}
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
