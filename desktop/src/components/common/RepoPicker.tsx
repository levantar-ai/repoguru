import { useState, useEffect, useRef, useCallback } from 'react';
import { getRecentRepos, addRecentRepo, type RecentRepo } from '@/services/storage';
import { loadToken } from '@/services/token';

interface RepoPickerProps {
  value: string;
  onChange: (path: string) => void;
  label?: string;
  placeholder?: string;
  showRecent?: boolean;
  disabled?: boolean;
  onSubmit?: () => void;
  trackRecent?: boolean;
}

interface GitHubRepo {
  full_name: string;
  description: string | null;
  stargazers_count: number;
  language: string | null;
  html_url: string;
  owner: { avatar_url: string };
}

// Debounce helper
function useDebounce(value: string, delay: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function RepoPicker({
  value,
  onChange,
  label = 'Repository Path',
  placeholder = '/path/to/repo or search GitHub repos...',
  showRecent = true,
  disabled = false,
  onSubmit,
  trackRecent = true,
}: RepoPickerProps) {
  const [recentRepos, setRecentRepos] = useState<RecentRepo[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [githubResults, setGithubResults] = useState<GitHubRepo[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedValue = useDebounce(value, 400);

  // Load recent repos and check for GitHub token
  useEffect(() => {
    if (showRecent) setRecentRepos(getRecentRepos());
    let cancelled = false;
    loadToken().then((t) => {
      if (!cancelled) setHasToken(!!t);
    });
    return () => { cancelled = true; };
  }, [showRecent]);

  // GitHub search when typing (if token available)
  useEffect(() => {
    if (!debouncedValue || debouncedValue.startsWith('/') || debouncedValue.startsWith('.') || !hasToken) {
      setGithubResults([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setSearching(true);
      try {
        const token = await loadToken();
        const query = encodeURIComponent(debouncedValue);
        const res = await fetch(`https://api.github.com/search/repositories?q=${query}&per_page=8&sort=stars`, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github.v3+json',
          },
        });
        if (!cancelled && res.ok) {
          const data = await res.json();
          setGithubResults(data.items || []);
        }
      } catch {
        // ignore search errors
      } finally {
        if (!cancelled) setSearching(false);
      }
    })();
    return () => { cancelled = true; };
  }, [debouncedValue, hasToken]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleBrowse = async () => {
    try {
      const selected = await window.repoGuru.selectDirectory();
      if (selected) {
        onChange(selected);
        if (trackRecent) addRecentRepo(selected);
        setShowDropdown(false);
      }
    } catch (err) {
      console.error('Browse failed:', err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (trackRecent && value) addRecentRepo(value);
      onSubmit?.();
      setShowDropdown(false);
    }
    if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  const handleSelectRecent = (repo: RecentRepo) => {
    onChange(repo.path);
    setShowDropdown(false);
    inputRef.current?.focus();
  };

  const handleSelectGithub = (repo: GitHubRepo) => {
    onChange(repo.full_name);
    if (trackRecent) addRecentRepo(repo.full_name);
    setShowDropdown(false);
    inputRef.current?.focus();
  };

  const handleFocus = () => {
    setShowDropdown(true);
    if (showRecent) setRecentRepos(getRecentRepos()); // refresh
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
    setShowDropdown(true);
  };

  const filteredRecent = recentRepos.filter(
    (r) =>
      !value ||
      r.name.toLowerCase().includes(value.toLowerCase()) ||
      r.path.toLowerCase().includes(value.toLowerCase()),
  );

  const hasDropdownContent = filteredRecent.length > 0 || githubResults.length > 0 || searching || !hasToken;

  const formatStars = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <label className="block text-sm font-medium text-gray-300 mb-2">{label}</label>
      )}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={handleInputChange}
            onFocus={handleFocus}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            className="w-full bg-gray-800 border border-gray-700 rounded-md pl-9 pr-3 py-2.5 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30 transition-colors disabled:opacity-50"
          />
          {searching && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-gray-600 border-t-sky-400 rounded-full animate-spin" />
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={handleBrowse}
          disabled={disabled}
          className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-md text-sm text-gray-300 transition-colors disabled:opacity-50 flex items-center gap-1.5"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          Browse
        </button>
      </div>

      {/* Dropdown */}
      {showDropdown && hasDropdownContent && (
        <div className="absolute z-20 mt-1 w-full bg-gray-800 border border-gray-700 rounded-md shadow-xl max-h-80 overflow-y-auto">
          {/* Recent repos section */}
          {filteredRecent.length > 0 && (
            <>
              <div className="px-3 py-1.5 text-[10px] text-gray-500 uppercase tracking-wider border-b border-gray-700 flex items-center gap-1.5">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Recent
              </div>
              {filteredRecent.slice(0, 5).map((repo) => (
                <button
                  key={repo.path}
                  type="button"
                  onClick={() => handleSelectRecent(repo)}
                  className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-700/50 transition-colors"
                >
                  <svg className="w-3.5 h-3.5 text-gray-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-200 truncate">{repo.name}</div>
                    <div className="text-[10px] text-gray-500 truncate">{repo.path}</div>
                  </div>
                </button>
              ))}
            </>
          )}

          {/* GitHub results section */}
          {githubResults.length > 0 && (
            <>
              <div className="px-3 py-1.5 text-[10px] text-gray-500 uppercase tracking-wider border-b border-gray-700 border-t border-t-gray-700 flex items-center gap-1.5">
                <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
                </svg>
                GitHub
              </div>
              {githubResults.map((repo) => (
                <button
                  key={repo.full_name}
                  type="button"
                  onClick={() => handleSelectGithub(repo)}
                  className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-700/50 transition-colors"
                >
                  <img
                    src={repo.owner.avatar_url}
                    alt=""
                    className="w-5 h-5 rounded-full flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-200 truncate">{repo.full_name}</div>
                    {repo.description && (
                      <div className="text-[10px] text-gray-500 truncate">{repo.description}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 text-[10px] text-gray-600">
                    {repo.language && <span>{repo.language}</span>}
                    <span>★ {formatStars(repo.stargazers_count)}</span>
                  </div>
                </button>
              ))}
            </>
          )}

          {/* Hint when no token */}
          {!hasToken && !filteredRecent.length && (
            <div className="px-3 py-3 text-xs text-gray-500 text-center">
              <p>Type a local path or set a GitHub token in <strong className="text-gray-400">Settings</strong> to search repos.</p>
            </div>
          )}

          {/* Searching indicator */}
          {searching && githubResults.length === 0 && (
            <div className="px-3 py-3 text-xs text-gray-500 text-center flex items-center justify-center gap-2">
              <div className="w-3 h-3 border-2 border-gray-600 border-t-sky-400 rounded-full animate-spin" />
              Searching GitHub...
            </div>
          )}

          {/* Browse local hint */}
          {!value && !filteredRecent.length && hasToken && (
            <div className="px-3 py-3 text-xs text-gray-500 text-center">
              Start typing to search GitHub, or click <strong className="text-gray-400">Browse</strong> for a local repo.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
