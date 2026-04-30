import { useEffect, useMemo, useState } from 'react';
import { useRepoGuru } from '../services/Provider.js';
import type { GitHubRepoSummary, RepoPickerProps } from '../services/types.js';

/** Authoritative repo picker. Both hosts mount this same component:
 *
 *   - The labelled input + Browse button + recents chips section
 *     comes from the host's `repoBrowse` service (filesystem picker on
 *     desktop, prompt on web).
 *   - The "Connect to GitHub" panel and the user's repo finder
 *     (org sidebar + filtered list) is rendered when
 *     `repoBrowse.hasGitHubToken()` returns true OR a connect-flow
 *     handler is provided. Hosts wire `listGitHubRepos`,
 *     `connectGitHub`, and `refreshGitHubRepos` to the platform's
 *     GitHub integration (browser: in-page OAuth + GitHub API;
 *     desktop: secureStore-backed token + Electron IPC).
 *
 *  When the user picks a GitHub repo on desktop, the chosen value is
 *  the `owner/repo` slug — pages then call host services
 *  (compare.run, score.run, …). The desktop's services are
 *  responsible for cloning the repo locally before invoking the CLI;
 *  the picker UI itself doesn't care which host receives the value.
 */
export function RepoPicker({
  label,
  value,
  onChange,
  onSubmit,
  disabled,
  inputId,
  placeholder = 'owner/repo or /path/to/repo',
}: RepoPickerProps) {
  const { repoBrowse } = useRepoGuru();
  const [browsing, setBrowsing] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  // Bumped after a successful OAuth so hasGitHubToken() re-evaluates.
  // Web doesn't need this (its OAuth navigates the page), but desktop
  // OAuth resolves in-place and dispatches a custom event we listen for.
  const [tokenTick, setTokenTick] = useState(0);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = () => setTokenTick((n) => n + 1);
    window.addEventListener('repoguru:github-connected', handler);
    return () => window.removeEventListener('repoguru:github-connected', handler);
  }, []);

  const recents = repoBrowse.recents();
  const id = inputId ?? `repo-${label.replace(/\s+/g, '-').toLowerCase()}`;

  // GitHub state ----------------------------------------------------------
  const hasToken = repoBrowse.hasGitHubToken();
  const supportsGitHub = !!(
    repoBrowse.connectGitHub ||
    repoBrowse.listGitHubRepos
  );
  // Reference tokenTick so eslint sees it as load-bearing for
  // re-renders that re-evaluate hasGitHubToken.
  void tokenTick;

  const [ghRepos, setGhRepos] = useState<GitHubRepoSummary[]>([]);
  const [ghLoading, setGhLoading] = useState(false);
  const [ghError, setGhError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);

  useEffect(() => {
    if (!hasToken || !repoBrowse.listGitHubRepos) return;
    let cancelled = false;
    setGhLoading(true);
    setGhError(null);
    repoBrowse
      .listGitHubRepos()
      .then((list) => {
        if (cancelled) return;
        setGhRepos(list);
      })
      .catch((err) => {
        if (cancelled) return;
        setGhError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setGhLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [hasToken, repoBrowse]);

  const orgList = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of ghRepos) {
      const key = r.ownerLabel ?? r.owner;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [ghRepos]);

  const filteredRepos = useMemo(() => {
    let list = ghRepos;
    if (selectedOrg) {
      list = list.filter((r) => (r.ownerLabel ?? r.owner) === selectedOrg);
    }
    if (filter) {
      const q = filter.toLowerCase();
      list = list.filter(
        (r) =>
          r.repo.toLowerCase().includes(q) ||
          r.owner.toLowerCase().includes(q) ||
          (r.language || '').toLowerCase().includes(q) ||
          (r.description || '').toLowerCase().includes(q),
      );
    }
    return list;
  }, [ghRepos, selectedOrg, filter]);

  const handleBrowse = async () => {
    if (browsing) return;
    setBrowsing(true);
    try {
      const picked = await repoBrowse.browse();
      if (picked) onChange(picked);
    } finally {
      setBrowsing(false);
    }
  };

  const handleRefresh = async () => {
    if (!repoBrowse.refreshGitHubRepos || !repoBrowse.listGitHubRepos) return;
    setGhLoading(true);
    setGhError(null);
    try {
      await repoBrowse.refreshGitHubRepos();
      const list = await repoBrowse.listGitHubRepos();
      setGhRepos(list);
    } catch (err) {
      setGhError(err instanceof Error ? err.message : String(err));
    } finally {
      setGhLoading(false);
    }
  };

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-text-secondary mb-1.5">
        {label}
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && onSubmit) onSubmit();
          }}
          className="flex-1 min-w-0 px-4 py-3 rounded-xl bg-surface-alt border border-border text-text placeholder-text-muted focus:outline-none focus:border-border-bright focus:ring-1 focus:ring-border-bright transition-colors disabled:opacity-50"
        />
        <button
          type="button"
          onClick={handleBrowse}
          disabled={disabled || browsing}
          className="px-4 py-3 rounded-xl bg-surface-alt border border-border text-text-secondary hover:text-neon hover:border-neon/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-2 whitespace-nowrap"
          title="Browse"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
            />
          </svg>
          Browse
        </button>
      </div>

      {repoBrowse.hint && (
        <p className="mt-1.5 text-xs text-text-muted">{repoBrowse.hint}</p>
      )}

      {!disabled && recents.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {recents.slice(0, 6).map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => onChange(s.value)}
              title={s.hint ?? s.value}
              className="px-2.5 py-1 rounded-lg text-xs bg-surface-alt border border-border text-text-secondary hover:text-neon hover:border-neon/30 transition-all max-w-[260px] truncate"
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      {/* ── GitHub Connect / repo finder ───────────────────────────── */}
      {supportsGitHub && !hasToken && (
        <div className="mt-4 px-5 py-4 rounded-xl bg-neon/5 border border-neon/20 text-sm text-text-secondary">
          {repoBrowse.connectGitHub && (
            <div className="mb-3">
              <button
                type="button"
                disabled={connecting}
                onClick={async () => {
                  if (connecting) return;
                  setConnecting(true);
                  setConnectError(null);
                  try {
                    await repoBrowse.connectGitHub?.();
                    // hasGitHubToken() polls synchronously; force a
                    // re-eval in case the host didn't dispatch the event.
                    setTokenTick((n) => n + 1);
                  } catch (err) {
                    const message = err instanceof Error ? err.message : String(err);
                    // Drop "Cancelled" — that's a user choice, not an error.
                    if (!/cancel/i.test(message)) setConnectError(message);
                  } finally {
                    setConnecting(false);
                  }
                }}
                className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg bg-[#24292f] hover:bg-[#32383f] disabled:opacity-60 text-white text-sm font-medium transition-colors"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                </svg>
                {connecting ? 'Waiting for GitHub…' : 'Connect to GitHub'}
              </button>
              {connectError && (
                <div className="mt-2 px-3 py-2 rounded-md bg-red-500/10 border border-red-500/30 text-xs text-red-400">
                  {connectError}
                </div>
              )}
              <div className="text-center text-xs text-text-muted mt-2">
                to browse your repos, unlock private access, and get 80× rate limits
              </div>
            </div>
          )}
          {repoBrowse.tokenSetupHelp && (
            <div className="flex items-start gap-2">
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
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="text-text-muted">{repoBrowse.tokenSetupHelp}</span>
            </div>
          )}
        </div>
      )}

      {supportsGitHub && hasToken && ghLoading && ghRepos.length === 0 && (
        <div className="mt-4 flex items-center gap-2 px-4 py-3 rounded-xl border border-border bg-surface-alt text-sm text-text-muted">
          <svg className="h-4 w-4 text-neon animate-spin shrink-0" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading your repositories…
        </div>
      )}

      {supportsGitHub && hasToken && ghError && ghRepos.length === 0 && (
        <div className="mt-4 flex items-center gap-2 px-4 py-3 rounded-xl border border-grade-f/25 bg-grade-f/5 text-sm text-grade-f">
          <span>{ghError}</span>
          {repoBrowse.refreshGitHubRepos && (
            <button onClick={handleRefresh} className="ml-auto text-neon hover:underline text-xs">
              Retry
            </button>
          )}
        </div>
      )}

      {supportsGitHub && hasToken && ghRepos.length > 0 && (
        <div className="mt-4 rounded-xl border border-border bg-surface-alt overflow-hidden">
          <div className="p-2.5 border-b border-border flex gap-2">
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search your repos…"
              disabled={disabled}
              className="flex-1 px-3 py-2 text-sm rounded-lg border border-border bg-surface text-text placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-neon/50 disabled:opacity-50"
            />
            {repoBrowse.refreshGitHubRepos && (
              <button
                type="button"
                onClick={handleRefresh}
                disabled={ghLoading || disabled}
                title="Refresh repos"
                className="px-2.5 py-2 rounded-lg border border-border text-text-muted hover:text-neon hover:border-neon/40 transition-all disabled:opacity-40"
              >
                <svg
                  className={`h-4 w-4 ${ghLoading ? 'animate-spin' : ''}`}
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
            )}
          </div>

          <div className="flex" style={{ height: '20rem' }}>
            {orgList.length > 1 && (
              <div className="w-44 shrink-0 border-r border-border overflow-y-auto bg-surface/50">
                <button
                  type="button"
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
                    {ghRepos.length}
                  </span>
                </button>
                {orgList.map((org) => (
                  <button
                    type="button"
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

            <div className="flex-1 overflow-y-auto">
              {filteredRepos.length === 0 ? (
                <div className="px-4 py-6 text-sm text-text-muted text-center">No matching repos</div>
              ) : (
                filteredRepos.map((repo) => (
                  <button
                    type="button"
                    key={`${repo.owner}/${repo.repo}`}
                    onClick={() => onChange(`${repo.owner}/${repo.repo}`)}
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
                        <div className="text-xs text-text-muted truncate mt-0.5">{repo.description}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {repo.language && <span className="text-xs text-text-muted">{repo.language}</span>}
                      {typeof repo.stars === 'number' && repo.stars > 0 && (
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
      )}
    </div>
  );
}
