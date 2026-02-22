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

export function cloneAndExtract(
  owner: string,
  repo: string,
  onProgress: (step: string, percent: number, message: string) => void,
  token?: string,
): Promise<GitStatsRawData> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./git.worker.ts', import.meta.url), { type: 'module' });

    const timeout = setTimeout(() => {
      worker.terminate();
      reject(new Error('Clone timed out after 2 minutes'));
    }, TIMEOUT_MS);

    worker.onmessage = (e: MessageEvent<WorkerOutMessage>) => {
      const msg = e.data;

      switch (msg.type) {
        case 'progress':
          onProgress(msg.step, msg.percent, msg.message);
          break;

        case 'result':
          clearTimeout(timeout);
          worker.terminate();
          // Populate cache with tree/files from the full clone
          if (msg.tree && msg.files) {
            setCache(owner, repo, msg.tree, msg.files);
          }
          resolve(msg.data);
          break;

        case 'error':
          clearTimeout(timeout);
          worker.terminate();
          reject(new Error(msg.message));
          break;
      }
    };

    worker.onerror = (err) => {
      clearTimeout(timeout);
      worker.terminate();
      reject(new Error(err.message || 'Worker error'));
    };

    const message: CloneMessage = {
      type: 'clone',
      owner,
      repo,
      corsProxy: CORS_PROXY,
      ...(token ? { token } : {}),
    };

    worker.postMessage(message);
  });
}

export function ensureCloned(
  owner: string,
  repo: string,
  onProgress?: (step: string, percent: number, message: string) => void,
  token?: string,
): Promise<CachedRepoData> {
  // 1. Check cache — return immediately if hit
  const cached = getCache(owner, repo);
  if (cached) return Promise.resolve(cached);

  // 2. Check pending clone — await if in-flight for the same repo
  const pending = getPendingClone(owner, repo);
  if (pending) return pending;

  // 3. Launch clone-cache-only worker
  const promise = new Promise<CachedRepoData>((resolve, reject) => {
    const worker = new Worker(new URL('./git.worker.ts', import.meta.url), { type: 'module' });

    const timeout = setTimeout(() => {
      worker.terminate();
      clearPendingClone();
      reject(new Error('Clone timed out after 2 minutes'));
    }, TIMEOUT_MS);

    worker.onmessage = (e: MessageEvent<WorkerOutMessage>) => {
      const msg = e.data;

      switch (msg.type) {
        case 'progress':
          onProgress?.(msg.step, msg.percent, msg.message);
          break;

        case 'cache-only-result':
          clearTimeout(timeout);
          worker.terminate();
          setCache(owner, repo, msg.tree, msg.files);
          clearPendingClone();
          resolve(getCache(owner, repo)!);
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
      type: 'clone-cache-only',
      owner,
      repo,
      corsProxy: CORS_PROXY,
      ...(token ? { token } : {}),
    };

    worker.postMessage(message);
  });

  setPendingClone(owner, repo, promise);
  return promise;
}

export type { CachedRepoData };
