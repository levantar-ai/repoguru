import type { GitStatsRawData } from '../../types/gitStats';
import type { CloneMessage, WorkerOutMessage } from './git.worker';
import {
  getCache,
  setCache,
  getPendingClone,
  setPendingClone,
  clearPendingClone,
} from './repoCache';
import type { CachedRepoData } from './repoCache';

const TIMEOUT_MS = 120_000; // 2 minutes

const CORS_PROXY = 'https://repoguru-git-proxy.andy-rea.workers.dev';

interface CloneOptions {
  includeStats?: boolean;
  token?: string;
  onProgress?: (step: string, percent: number, message: string) => void;
}

interface CloneResult {
  cached: CachedRepoData;
  statsData?: GitStatsRawData;
}

export function cloneRepo(
  owner: string,
  repo: string,
  options: CloneOptions = {},
): Promise<CloneResult> {
  const { includeStats, token, onProgress } = options;

  // Check cache — if hit and no stats needed, return immediately
  const cached = getCache(owner, repo);
  if (cached && !includeStats) {
    return Promise.resolve({ cached });
  }

  // Check pending clone — if in-flight for the same repo and no stats needed, await it
  if (!includeStats) {
    const pending = getPendingClone(owner, repo);
    if (pending) return pending.then((c) => ({ cached: c }));
  }

  const promise = new Promise<CloneResult>((resolve, reject) => {
    const worker = new Worker(new URL('./git.worker.ts', import.meta.url), { type: 'module' });

    const timeout = setTimeout(() => {
      worker.terminate();
      clearPendingClone();
      reject(new Error('Clone timed out after 2 minutes'));
    }, TIMEOUT_MS);

    let cachedData: CachedRepoData | null = null;

    worker.onmessage = (e: MessageEvent<WorkerOutMessage>) => {
      const msg = e.data;

      switch (msg.type) {
        case 'progress':
          onProgress?.(msg.step, msg.percent, msg.message);
          break;

        case 'clone-done':
          setCache(owner, repo, msg.tree, msg.files);
          cachedData = getCache(owner, repo)!;
          clearPendingClone();
          // If no stats requested, resolve immediately
          if (!includeStats) {
            clearTimeout(timeout);
            worker.terminate();
            resolve({ cached: cachedData });
          }
          break;

        case 'stats-done':
          clearTimeout(timeout);
          worker.terminate();
          resolve({
            cached: cachedData ?? getCache(owner, repo)!,
            statsData: msg.data,
          });
          break;

        case 'error':
          clearTimeout(timeout);
          worker.terminate();
          clearPendingClone();
          reject(new Error(msg.message));
          break;
      }
    };

    worker.onerror = (err) => {
      clearTimeout(timeout);
      worker.terminate();
      clearPendingClone();
      reject(new Error(err.message || 'Worker error'));
    };

    const message: CloneMessage = {
      type: 'clone',
      owner,
      repo,
      corsProxy: CORS_PROXY,
      includeStats,
      ...(token ? { token } : {}),
    };

    worker.postMessage(message);
  });

  // Register as pending so other non-stats callers can piggyback
  if (!includeStats) {
    setPendingClone(
      owner,
      repo,
      promise.then((r) => r.cached),
    );
  }

  return promise;
}

export function cloneAndExtract(
  owner: string,
  repo: string,
  onProgress: (step: string, percent: number, message: string) => void,
  token?: string,
): Promise<GitStatsRawData> {
  return cloneRepo(owner, repo, { includeStats: true, token, onProgress }).then(
    (r) => r.statsData!,
  );
}

export function ensureCloned(
  owner: string,
  repo: string,
  onProgress?: (step: string, percent: number, message: string) => void,
  token?: string,
): Promise<CachedRepoData> {
  return cloneRepo(owner, repo, { token, onProgress }).then((r) => r.cached);
}

export type { CachedRepoData };
