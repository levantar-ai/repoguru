import { useState, useEffect, useCallback, useMemo } from 'react';
import { fetchMyRepos, fetchInstallations, fetchInstallationRepos } from '../services/github/org';
import { useApp } from '../context/AppContext';
import type { RepoInfo, RateLimitInfo } from '../types';
import type { GitHubInstallation } from '../services/github/types';

const STORAGE_KEY = 'repoguru:my-repos';
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

interface StoredCache {
  token: string;
  repos: RepoInfo[];
  timestamp: number;
}

// Module-level cache so repos survive SPA navigation / component unmounts
let memCache: StoredCache | null = null;

function readStorage(): StoredCache | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: StoredCache = JSON.parse(raw);
    if (Date.now() - parsed.timestamp > CACHE_TTL_MS) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeStorage(data: StoredCache) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage full or unavailable
  }
}

function getCache(token: string): RepoInfo[] | null {
  if (memCache?.token === token && Date.now() - memCache.timestamp < CACHE_TTL_MS) {
    return memCache.repos;
  }
  const stored = readStorage();
  if (stored?.token === token) {
    memCache = stored;
    return stored.repos;
  }
  return null;
}

function setCache(token: string, repos: RepoInfo[]) {
  const entry: StoredCache = { token, repos, timestamp: Date.now() };
  memCache = entry;
  writeStorage(entry);
}

function clearCache() {
  memCache = null;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* */
  }
}

/** Try reading cached repos without knowing the token yet (for initial state). */
function readAnyCachedRepos(): RepoInfo[] {
  if (memCache && Date.now() - memCache.timestamp < CACHE_TTL_MS) return memCache.repos;
  const stored = readStorage();
  if (stored) {
    memCache = stored;
    return stored.repos;
  }
  return [];
}

export function useMyRepos() {
  const { state: appState, dispatch: appDispatch } = useApp();
  const token = appState.githubToken || '';
  const loaded = appState.loaded;

  // Initialise with whatever is in cache — we validate the token match later
  const [repos, setRepos] = useState<RepoInfo[]>(() => readAnyCachedRepos());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [installations, setInstallations] = useState<GitHubInstallation[]>([]);

  const load = useCallback(
    (bypassCache = false) => {
      // Don't do anything until AppContext has loaded the token from storage
      if (!loaded) return;

      if (!token) {
        setRepos([]);
        setInstallations([]);
        clearCache();
        return;
      }

      if (!bypassCache) {
        const cached = getCache(token);
        if (cached) {
          setRepos(cached);
          return;
        }
      }

      setLoading(true);
      setError(null);

      const onRate = (info: RateLimitInfo) => appDispatch({ type: 'SET_RATE_LIMIT', info });

      // Try installation-based fetch first; fall back to classic /user/repos
      fetchInstallations(token, onRate)
        .catch(() => [] as GitHubInstallation[]) // token may lack app scope — fall back gracefully
        .then(async (installs) => {
          setInstallations(installs);

          if (installs.length > 0) {
            // Fetch repos from each installation in parallel
            const perInstall = await Promise.all(
              installs.map((inst) =>
                fetchInstallationRepos(inst.id, token, onRate).catch(() => [] as RepoInfo[]),
              ),
            );
            // Deduplicate by owner/repo
            const seen = new Set<string>();
            const unique: RepoInfo[] = [];
            for (const batch of perInstall) {
              for (const r of batch) {
                const key = `${r.owner}/${r.repo}`;
                if (!seen.has(key)) {
                  seen.add(key);
                  unique.push(r);
                }
              }
            }
            return unique;
          }

          // No installations — fall back to classic OAuth token fetch
          return fetchMyRepos(token, onRate);
        })
        .then((result) => {
          setCache(token, result);
          setRepos(result);
          setLoading(false);
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : 'Failed to load repos');
          setLoading(false);
        });
    },
    [token, loaded, appDispatch],
  );

  /* eslint-disable react-hooks/set-state-in-effect -- initial data fetch on mount */
  useEffect(() => {
    load();
  }, [load]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const refresh = useCallback(() => load(true), [load]);

  const orgList = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of repos) {
      counts.set(r.owner, (counts.get(r.owner) || 0) + 1);
    }
    return [...counts.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, count]) => ({ name, count }));
  }, [repos]);

  return {
    repos,
    loading,
    error,
    refresh,
    orgList,
    installations,
    hasToken: loaded ? !!token : !!readAnyCachedRepos().length,
  };
}
